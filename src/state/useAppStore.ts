import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CrewMember, ChatMessage, Crew, AppScreen } from '@/types';
import { SEED_CREW, SEED_CHAT, SEED_CREW_META } from './seed';
import { EMPTY_CREW, EMPTY_CREW_META, EMPTY_CHAT } from './emptyCrew';
import { XP_PER_PUSHUP, nowHHMM, DEFAULT_DAILY_GOAL, levelFromXp } from '@/lib/mechanics';
import { clampDisplayName } from '@/lib/displayName';
import { supabaseConfigured } from '@/lib/supabase';
import {
  fetchMyCrewSnapshot,
  insertChatMessage,
  insertPushupLog,
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
  applyAuthProfile: (name: string, userId: string) => void;
  clearAuthProfile: () => void;
  setName: (name: string) => void;
  confirmProfileName: (name: string) => Promise<void>;
  setDailyGoal: (goal: number) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  applyCrewSnapshot: (snapshot: CrewSnapshot) => void;
  syncCrewFromDb: () => Promise<void>;
  logPushups: (count: number) => { leveledUp: boolean };
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

  applyAuthProfile: (name, userId) => {
    const display = clampDisplayName(name);
    set((state) => ({
      name: display,
      meId: userId,
      crew: ensureMeInCrew(state.crew, userId, display),
    }));
  },

  clearAuthProfile: () =>
    set({
      name: '',
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
    set((state) => ({
      name: display,
      nameConfirmed: true,
      crew: ensureMeInCrew(state.crew, state.meId, display),
    }));
    await AsyncStorage.setItem(NAME_CONFIRMED_KEY, '1');
  },

  setDailyGoal: (goal) => set({ dailyGoal: goal }),

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
      dailyGoal: DEFAULT_DAILY_GOAL,
      crew: INITIAL_CREW,
      crewMeta: INITIAL_CREW_META,
      chat: INITIAL_CHAT,
      crewSyncState: supabaseConfigured ? 'idle' : 'ready',
    });
  },

  applyCrewSnapshot: (snapshot) => {
    const me = snapshot.members.find((m) => m.isMe);
    set({
      crewMeta: snapshot.crew,
      crew: snapshot.members,
      chat: snapshot.chat,
      dailyGoal: snapshot.dailyGoal,
      crewSyncState: 'ready',
      ...(me ? { meId: me.id, name: me.name } : {}),
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
          set({ crew: ensureMeInCrew(state.crew, state.meId, state.name) });
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[crew] Failed to sync from database:', err);
        }
        const state = get();
        if (state.meId) {
          set({ crew: ensureMeInCrew(state.crew, state.meId, state.name) });
        }
      } finally {
        set({ crewSyncState: 'ready' });
        crewSyncInFlight = null;
      }
    })();

    return crewSyncInFlight;
  },

  logPushups: (count) => {
    const { crew, meId } = get();
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
              streak: m.today === 0 ? m.streak + 1 : m.streak,
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
          set((state) => ({
            chat: state.chat.map((m) => (m.id === optimistic.id ? saved : m)),
          }));
        })
        .catch((err) => {
          if (__DEV__) console.warn('[crew] chat insert failed:', err);
        });
    }
  },

  setActiveScreen: (s) => set({ activeScreen: s }),
  consumeLevelUp: () => set({ levelUpEvent: null }),
}));

// Selectors used across screens
export const selectMe = (s: AppState): CrewMember | undefined =>
  s.crew.find((m) => m.id === s.meId) ?? s.crew.find((m) => m.isMe);

export const selectRankedByToday = (s: AppState): CrewMember[] =>
  [...s.crew].sort((a, b) => b.today - a.today || b.total - a.total);

export const selectRankedByWeek = (s: AppState): CrewMember[] =>
  [...s.crew].sort((a, b) => b.week - a.week || b.total - a.total);
