import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CrewMember, ChatMessage, Crew, AppScreen } from '@/types';
import { SEED_CREW, SEED_CHAT, SEED_CREW_META } from './seed';
import { EMPTY_CREW, EMPTY_CREW_META, EMPTY_CHAT } from './emptyCrew';
import { XP_PER_PUSHUP, nowHHMM, DEFAULT_DAILY_GOAL, levelFromXp } from '@/lib/mechanics';
import { clampDisplayName } from '@/lib/displayName';
import { supabaseConfigured } from '@/lib/supabase';
import {
  confirmMyProfileName,
  fetchMyCrewSnapshot,
  insertChatMessage,
  insertPushupLog,
  type AccountStatus,
  type CrewSnapshot,
} from '@/lib/crewDb';
import { ensureMeInCrew } from '@/state/crewHelpers';

export type CrewSyncState = 'idle' | 'loading' | 'ready';

const INITIAL_CREW = supabaseConfigured ? EMPTY_CREW : SEED_CREW;
const INITIAL_CREW_META = supabaseConfigured ? EMPTY_CREW_META : SEED_CREW_META;
const INITIAL_CHAT = supabaseConfigured ? EMPTY_CHAT : SEED_CHAT;

const ONBOARDED_KEY = '@pushupcrew/onboarded';
const NAME_CONFIRMED_KEY = '@pushupcrew/name_confirmed';

let crewSyncInFlight: Promise<void> | null = null;

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
  setDailyGoal: (goal: number) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  applyCrewSnapshot: (snapshot: CrewSnapshot) => void;
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

  setDailyGoal: (goal) =>
    set((state) => ({
      dailyGoal: goal,
      crew: state.crew.map((m) => (m.id === state.meId || m.isMe ? { ...m, dailyGoal: goal } : m)),
    })),

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
      crewSyncState: supabaseConfigured ? 'idle' : 'ready',
    });
  },

  applyCrewSnapshot: (snapshot) => {
    const me = snapshot.members.find((m) => m.isMe);
    set((state) => {
      const currentMeImage =
        state.image ||
        state.crew.find((m) => m.id === state.meId || m.isMe)?.image ||
        '';
      const currentMeDailyGoal =
        state.dailyGoal ||
        state.crew.find((m) => m.id === state.meId || m.isMe)?.dailyGoal;
      const members = snapshot.members.map((m) =>
        m.isMe
          ? {
              ...m,
              image: m.image || currentMeImage,
              dailyGoal: m.dailyGoal ?? currentMeDailyGoal,
            }
          : m,
      );

      return {
        crewMeta: snapshot.crew,
        crew: members,
        chat: snapshot.chat,
        dailyGoal: snapshot.dailyGoal,
        crewSyncState: 'ready',
        ...(me
          ? {
              meId: me.id,
              name: me.name,
              image: me.image || currentMeImage,
              dailyGoal: me.dailyGoal ?? currentMeDailyGoal ?? state.dailyGoal,
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
          return;
        }

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

    set({
      crew: crew.map((m) =>
        m.id === meId
          ? {
              ...m,
              today: m.today + count,
              week: m.week + count,
              total: m.total + count,
              xp: newXp,
              level: levelFromXp(newXp),
              streak:
                m.today < (m.dailyGoal ?? dailyGoal) && m.today + count >= (m.dailyGoal ?? dailyGoal)
                  ? m.streak + 1
                  : m.streak,
            }
          : m,
      ),
      levelUpEvent: leveledUp ? Date.now() : get().levelUpEvent,
    });

    if (supabaseConfigured && crewId) {
      void insertPushupLog(crewId, count).catch((err) => {
        if (__DEV__) console.warn('[crew] pushup log insert failed:', err);
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
