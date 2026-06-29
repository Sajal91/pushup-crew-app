import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppScreen, ChatMessage, Crew, CrewMember, DailyStat, PushupLog, RegionalCrewRank } from '@/types';
import { SEED_CREW, SEED_CHAT, SEED_CREW_META, SEED_REGIONAL_RANKINGS } from './seed';
import { EMPTY_CREW, EMPTY_CREW_META, EMPTY_CHAT } from './emptyCrew';
import { XP_PER_PUSHUP, nowHHMM, DEFAULT_DAILY_GOAL, levelFromXp } from '@/lib/mechanics';
import { clampDisplayName } from '@/lib/displayName';
import { supabaseConfigured } from '@/lib/supabase';
import {
  confirmMyProfileName,
  fetchCrewPushupLogs,
  fetchMyCrewSnapshot,
  fetchMyPersonalStats,
  fetchRegionalCrewRankings,
  insertChatMessage,
  insertPushupLog,
  memberFromPersonalStats,
  updateMyDailyGoal,
  updateMyCrewName,
  type AccountStatus,
  type CrewSnapshot,
  type PersonalStats,
} from '@/lib/crewDb';
import { ensureMeInCrew, placeholderMe } from '@/state/crewHelpers';
import { syncDailyGoalReminder } from '@/lib/notifications';

export type CrewSyncState = 'idle' | 'loading' | 'ready';

const INITIAL_CREW = supabaseConfigured ? EMPTY_CREW : SEED_CREW;
const INITIAL_CREW_META = supabaseConfigured ? EMPTY_CREW_META : SEED_CREW_META;
const INITIAL_CHAT = supabaseConfigured ? EMPTY_CHAT : SEED_CHAT;
const INITIAL_REGIONAL_RANKINGS = supabaseConfigured ? [] : SEED_REGIONAL_RANKINGS;

const ONBOARDED_KEY = '@pushupcrew/onboarded';
const NAME_CONFIRMED_KEY = '@pushupcrew/name_confirmed';

let crewSyncInFlight: Promise<void> | null = null;
const UTC_DAY_MS = 24 * 60 * 60 * 1000;

type AppState = {
  // Onboarding / profile
  onboarded: boolean;
  onboardingHydrated: boolean;
  nameConfirmed: boolean;
  name: string;
  image: string;
  dailyGoal: number;

  // Crew domain
  crew: CrewMember[];
  crewMeta: Crew;
  chat: ChatMessage[];
  pushupLogs: PushupLog[];
  regionalCrewRankings: RegionalCrewRank[];
  meId: string;
  crewSyncState: CrewSyncState;

  // UI ephemeral state — not synced
  activeScreen: AppScreen;
  levelUpEvent: number | null;

  // Actions
  hydrateOnboarding: () => Promise<void>;
  applyAuthProfile: (name: string, userId: string, profileImage?: string) => void;
  applyAccountStatus: (status: AccountStatus) => void;
  clearAuthProfile: () => void;
  setName: (name: string) => void;
  confirmProfileName: (name: string) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
  setCrewName: (name: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  applyCrewSnapshot: (snapshot: CrewSnapshot) => void;
  applyPersonalStats: (stats: PersonalStats) => void;
  clearCrew: (personalStats?: PersonalStats) => void;
  syncCrewFromDb: () => Promise<void>;
  logPushups: (count: number) => { leveledUp: boolean };
  applyRemoteChatMessage: (message: ChatMessage, optimisticId?: string | number) => void;
  sendChat: (text: string) => void;
  setActiveScreen: (s: AppScreen) => void;
  consumeLevelUp: () => void;
};

function withMeName(crew: CrewMember[], name: string): CrewMember[] {
  const display = clampDisplayName(name);
  return crew.map((m) => (m.isMe ? { ...m, name: display, id: m.id } : m));
}

function utcIsoDay(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * UTC_DAY_MS);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function emptySevenDayStats(): DailyStat[] {
  return Array.from({ length: 7 }, (_, index) => ({
    day: utcIsoDay(index - 6),
    count: 0,
  }));
}

function addToTodayStats(stats: DailyStat[] | undefined, count: number): DailyStat[] {
  const today = utcIsoDay();
  let foundToday = false;
  const source = stats?.length ? stats : emptySevenDayStats();
  const next = source.map((stat) => {
    if (stat.day !== today) return stat;
    foundToday = true;
    return { ...stat, count: stat.count + count };
  });

  if (!foundToday) {
    next.push({ day: today, count });
  }

  return next.sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
}

function personalStatsFromMe(me: CrewMember | undefined): PersonalStats | undefined {
  if (!me) return undefined;
  return {
    lifetimeTotal: me.total,
    streak: me.streak,
    dailyGoal: me.dailyGoal,
  };
}

function meWithPersonalStats(
  meId: string,
  name: string,
  image: string,
  dailyGoal: number,
  stats: PersonalStats,
): CrewMember {
  return {
    ...placeholderMe(meId, name, image, stats.dailyGoal ?? dailyGoal, stats),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  onboarded: false,
  onboardingHydrated: false,
  nameConfirmed: false,
  name: '',
  image: '',
  dailyGoal: DEFAULT_DAILY_GOAL,

  crew: INITIAL_CREW,
  crewMeta: INITIAL_CREW_META,
  chat: INITIAL_CHAT,
  pushupLogs: [],
  regionalCrewRankings: INITIAL_REGIONAL_RANKINGS,
  meId: supabaseConfigured ? '' : 'nik',
  crewSyncState: supabaseConfigured ? 'idle' : 'ready',

  activeScreen: 'home',
  levelUpEvent: null,

  hydrateOnboarding: async () => {
    try {
      const [onboardedVal, nameConfirmedVal] = await Promise.all([
        AsyncStorage.getItem(ONBOARDED_KEY),
        AsyncStorage.getItem(NAME_CONFIRMED_KEY),
      ]);
      set({
        onboarded: onboardedVal === '1',
        nameConfirmed: nameConfirmedVal === '1',
      });
    } finally {
      set({ onboardingHydrated: true });
    }
  },

  applyAuthProfile: (name, userId, profileImage = '') => {
    const display = clampDisplayName(name);
    set((state) => {
      const nextImage = profileImage || state.image;
      return {
        name: display,
        meId: userId,
        image: nextImage,
        crew: ensureMeInCrew(state.crew, userId, display, nextImage, state.dailyGoal),
      };
    });
  },

  applyAccountStatus: (status) => {
    const display = clampDisplayName(status.name);
    const shouldRestoreOnboarded = status.isReturningUser && status.nameSetupComplete && status.hasCrew;
    set((state) => ({
      name: display,
      nameConfirmed: status.nameSetupComplete,
      onboarded: shouldRestoreOnboarded ? true : state.onboarded,
      dailyGoal: status.dailyGoal,
      crew: ensureMeInCrew(state.crew, state.meId, display, state.image, status.dailyGoal),
    }));
    if (status.nameSetupComplete) {
      void AsyncStorage.setItem(NAME_CONFIRMED_KEY, '1');
    }
    if (shouldRestoreOnboarded) {
      void AsyncStorage.setItem(ONBOARDED_KEY, '1');
    }
  },

  clearAuthProfile: () =>
    set({
      name: '',
      image: '',
      meId: supabaseConfigured ? '' : 'nik',
      crew: INITIAL_CREW,
      crewMeta: INITIAL_CREW_META,
      chat: INITIAL_CHAT,
      pushupLogs: [],
      crewSyncState: supabaseConfigured ? 'idle' : 'ready',
      onboarded: false,
      nameConfirmed: false,
    }),

  setName: (name) => {
    const display = clampDisplayName(name);
    set((state) => ({
      name: display,
      crew: withMeName(state.crew, display),
    }));
  },

  confirmProfileName: async (name) => {
    const display = clampDisplayName(name);
    const dailyGoal = get().dailyGoal;
    if (supabaseConfigured) {
      await confirmMyProfileName(display, dailyGoal);
    }
    set((state) => ({
      name: display,
      nameConfirmed: true,
      crew: ensureMeInCrew(state.crew, state.meId, display, state.image, dailyGoal),
    }));
    await AsyncStorage.setItem(NAME_CONFIRMED_KEY, '1');
  },

  setDailyGoal: async (goal) => {
    const savedGoal = supabaseConfigured ? await updateMyDailyGoal(goal) : goal;
    set((state) => ({
      dailyGoal: savedGoal,
      crew: state.crew.map((m) => (m.id === state.meId || m.isMe ? { ...m, dailyGoal: savedGoal } : m)),
    }));
    const me = get().crew.find((m) => m.id === get().meId || m.isMe);
    void syncDailyGoalReminder(me, savedGoal);
  },

  setCrewName: async (name) => {
    const trimmed = name.trim();
    const savedName = supabaseConfigured ? await updateMyCrewName(trimmed) : trimmed;
    set((state) => ({
      crewMeta: { ...state.crewMeta, name: savedName },
    }));
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    set({ onboarded: true });
  },

  resetOnboarding: async () => {
    await Promise.all([
      AsyncStorage.removeItem(ONBOARDED_KEY),
      AsyncStorage.removeItem(NAME_CONFIRMED_KEY),
    ]);
    set({
      onboarded: false,
      nameConfirmed: false,
      name: '',
      image: '',
      dailyGoal: DEFAULT_DAILY_GOAL,
      crew: INITIAL_CREW,
      crewMeta: INITIAL_CREW_META,
      chat: INITIAL_CHAT,
      pushupLogs: [],
      regionalCrewRankings: INITIAL_REGIONAL_RANKINGS,
      crewSyncState: supabaseConfigured ? 'idle' : 'ready',
    });
  },

  clearCrew: (personalStats) => {
    const state = get();
    const stats =
      personalStats ??
      personalStatsFromMe(state.crew.find((m) => m.id === state.meId || m.isMe));
    const me = stats
      ? meWithPersonalStats(state.meId, state.name, state.image, state.dailyGoal, stats)
      : placeholderMe(state.meId, state.name, state.image, state.dailyGoal);

    set({
      crew: state.meId ? [me] : INITIAL_CREW,
      crewMeta: INITIAL_CREW_META,
      chat: INITIAL_CHAT,
      pushupLogs: [],
      regionalCrewRankings: [],
      crewSyncState: supabaseConfigured ? 'idle' : 'ready',
    });
  },

  applyPersonalStats: (stats) => {
    const state = get();
    if (!state.meId) return;

    const personal = memberFromPersonalStats(stats.lifetimeTotal, stats.streak);
    set({
      ...(stats.dailyGoal !== undefined ? { dailyGoal: stats.dailyGoal } : {}),
      crew: ensureMeInCrew(state.crew, state.meId, state.name, state.image, state.dailyGoal).map(
        (m) =>
          m.id === state.meId || m.isMe
            ? {
              ...m,
              ...personal,
              today: 0,
              week: 0,
              dailyStats: emptySevenDayStats(),
              dailyGoal: stats.dailyGoal ?? m.dailyGoal,
            }
            : m,
      ),
    });
  },

  applyCrewSnapshot: (snapshot) => {
    const me = snapshot.members.find((m) => m.isMe);
    set((state) => {
      const currentMeImage =
        state.image ||
        state.crew.find((m) => m.id === state.meId || m.isMe)?.image ||
        '';
      const profileDailyGoal = snapshot.dailyGoal;
      const members = snapshot.members.map((m) =>
        m.isMe
          ? {
              ...m,
              image: m.image || currentMeImage,
              dailyGoal: profileDailyGoal,
            }
          : m,
      );

      return {
        crewMeta: snapshot.crew,
        crew: members,
        chat: snapshot.chat,
        dailyGoal: profileDailyGoal,
        crewSyncState: 'ready',
        ...(me
          ? {
              meId: me.id,
              name: me.name,
              image: me.image || currentMeImage,
              dailyGoal: profileDailyGoal,
            }
          : {}),
      };
    });
  },

  syncCrewFromDb: async () => {
    if (!supabaseConfigured) {
      set({ crewSyncState: 'ready' });
      return;
    }

    if (crewSyncInFlight) {
      return crewSyncInFlight;
    }

    const alreadyReady = get().crewSyncState === 'ready';
    if (!alreadyReady) {
      set({ crewSyncState: 'loading' });
    }

    crewSyncInFlight = (async () => {
      try {
        const { meId } = get();
        const snapshot = await fetchMyCrewSnapshot(meId || undefined);
        if (snapshot) {
          get().applyCrewSnapshot(snapshot);
          try {
            const pushupLogs = await fetchCrewPushupLogs(snapshot.crew.id);
            set({ pushupLogs });
          } catch (err) {
            if (__DEV__) console.warn('[crew] Failed to sync pushup logs:', err);
          }
          try {
            const regionalCrewRankings = await fetchRegionalCrewRankings();
            set({ regionalCrewRankings });
          } catch (err) {
            if (__DEV__) console.warn('[crew] Failed to sync regional rankings:', err);
          }
          return;
        }

        const personal = await fetchMyPersonalStats();
        if (personal) {
          get().applyPersonalStats(personal);
        }
        set({ pushupLogs: [] });

        const state = get();
        if (state.meId) {
          set({ crew: ensureMeInCrew(state.crew, state.meId, state.name, state.image, state.dailyGoal) });
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[crew] Failed to sync from database:', err);
        }
        const state = get();
        if (state.meId) {
          set({ crew: ensureMeInCrew(state.crew, state.meId, state.name, state.image, state.dailyGoal) });
        }
      } finally {
        set({ crewSyncState: 'ready' });
        crewSyncInFlight = null;
        const state = get();
        const me = state.crew.find((m) => m.id === state.meId) ?? state.crew.find((m) => m.isMe);
        void syncDailyGoalReminder(me, state.dailyGoal);
      }
    })();

    return crewSyncInFlight;
  },

  logPushups: (count) => {
    const { crew, meId, dailyGoal } = get();
    const me = crew.find((m) => m.id === meId);
    if (!me) return { leveledUp: false };

    const newXp = me.xp + count * XP_PER_PUSHUP;
    const leveledUp = levelFromXp(newXp) > levelFromXp(me.xp);

    const crewId = get().crewMeta.id;

    const optimisticLog: PushupLog | null = crewId
      ? {
          id: `local-${Date.now()}`,
          userId: meId,
          crewId,
          count,
          loggedAt: new Date().toISOString(),
        }
      : null;

    set((state) => ({
      crew: crew.map((m) =>
        m.id === meId
          ? {
              ...m,
              today: m.today + count,
              week: m.week + count,
              total: m.total + count,
              dailyStats: addToTodayStats(m.dailyStats, count),
              xp: newXp,
              level: levelFromXp(newXp),
              streak:
                m.today < (m.dailyGoal ?? dailyGoal) && m.today + count >= (m.dailyGoal ?? dailyGoal)
                  ? m.streak + 1
                  : m.streak,
            }
          : m,
      ),
      pushupLogs: optimisticLog ? [...state.pushupLogs, optimisticLog] : state.pushupLogs,
      regionalCrewRankings: supabaseConfigured
        ? state.regionalCrewRankings
        : state.regionalCrewRankings.map((entry) =>
            entry.isMine ? { ...entry, today: entry.today + count, week: entry.week + count } : entry,
          ),
      levelUpEvent: leveledUp ? Date.now() : get().levelUpEvent,
    }));

    const updatedMe = get().crew.find((m) => m.id === meId) ?? get().crew.find((m) => m.isMe);
    void syncDailyGoalReminder(updatedMe, get().dailyGoal);

    if (supabaseConfigured && crewId) {
      void insertPushupLog(crewId, count)
        .then(() => get().syncCrewFromDb())
        .catch((err) => {
          if (__DEV__) console.warn('[crew] pushup log sync failed:', err);
        });
    }

    return { leveledUp };
  },

  applyRemoteChatMessage: (message, optimisticId) =>
    set((state) => {
      const withoutOptimistic =
        optimisticId === undefined
          ? state.chat
          : state.chat.filter((m) => m.id !== optimisticId);
      const exists = withoutOptimistic.some((m) => m.id === message.id);
      if (exists) return { chat: withoutOptimistic };
      return { chat: [...withoutOptimistic, message] };
    }),

  sendChat: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { meId, crewMeta } = get();
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      who: meId,
      t: nowHHMM(),
      text: trimmed,
    };

    set((state) => ({ chat: [...state.chat, optimistic] }));

    if (supabaseConfigured && crewMeta.id) {
      void insertChatMessage(crewMeta.id, trimmed)
        .then((saved) => {
          get().applyRemoteChatMessage(saved, optimistic.id);
        })
        .catch((err) => {
          if (__DEV__) console.warn('[crew] chat insert failed:', err);
          set((state) => ({ chat: state.chat.filter((m) => m.id !== optimistic.id) }));
        });
    }
  },

  setActiveScreen: (s) => set({ activeScreen: s }),
  consumeLevelUp: () => set({ levelUpEvent: null }),
}));

// Selectors used across screens
export const selectMe = (s: AppState): CrewMember | undefined => s.crew.find((m) => m.id === s.meId) ?? s.crew.find((m) => m.isMe);

export const getCrewInviteCode = (s: AppState): string => s.crewMeta.inviteCode;

export const selectRankedByToday = (s: AppState): CrewMember[] => [...s.crew].sort((a, b) => b.today - a.today || b.total - a.total);

export const selectRankedByWeek = (s: AppState): CrewMember[] => [...s.crew].sort((a, b) => b.week - a.week || b.total - a.total);

export const selectRegionalRankedByToday = (s: AppState): RegionalCrewRank[] =>
  [...s.regionalCrewRankings].sort((a, b) => b.today - a.today || a.name.localeCompare(b.name));

export const selectRegionalRankedByWeek = (s: AppState): RegionalCrewRank[] =>
  [...s.regionalCrewRankings].sort((a, b) => b.week - a.week || a.name.localeCompare(b.name));
