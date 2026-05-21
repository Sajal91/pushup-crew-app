import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CrewMember, ChatMessage, Crew, AppScreen } from '@/types';
import { SEED_CREW, SEED_CHAT, SEED_CREW_META } from './seed';
import { XP_PER_PUSHUP, nowHHMM, DEFAULT_DAILY_GOAL, levelFromXp } from '@/lib/mechanics';
import { clampDisplayName } from '@/lib/displayName';

const ONBOARDED_KEY = '@pushupcrew/onboarded';

type AppState = {
  // Onboarding / profile
  onboarded: boolean;
  onboardingHydrated: boolean;
  name: string;
  dailyGoal: number;

  // Crew domain
  crew: CrewMember[];
  crewMeta: Crew;
  chat: ChatMessage[];
  meId: string;

  // UI ephemeral state — not synced
  activeScreen: AppScreen;
  levelUpEvent: number | null;

  // Actions
  hydrateOnboarding: () => Promise<void>;
  applyAuthProfile: (name: string, userId: string) => void;
  clearAuthProfile: () => void;
  setName: (name: string) => void;
  setDailyGoal: (goal: number) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
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
  name: '',
  dailyGoal: DEFAULT_DAILY_GOAL,

  crew: SEED_CREW,
  crewMeta: SEED_CREW_META,
  chat: SEED_CHAT,
  meId: 'nik',

  activeScreen: 'home',
  levelUpEvent: null,

  hydrateOnboarding: async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDED_KEY);
      if (value === '1') {
        set({ onboarded: true });
      }
    } finally {
      set({ onboardingHydrated: true });
    }
  },

  applyAuthProfile: (name, userId) => {
    const display = clampDisplayName(name);
    set((state) => ({
      name: display,
      meId: userId,
      crew: state.crew.map((m) =>
        m.isMe ? { ...m, id: userId, name: display } : m,
      ),
    }));
  },

  clearAuthProfile: () =>
    set({
      name: '',
      meId: 'nik',
      crew: SEED_CREW,
      onboarded: false,
    }),

  setName: (name) => {
    const display = clampDisplayName(name);
    set((state) => ({
      name: display,
      crew: withMeName(state.crew, display),
    }));
  },

  setDailyGoal: (goal) => set({ dailyGoal: goal }),

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    set({ onboarded: true });
  },

  resetOnboarding: async () => {
    await AsyncStorage.removeItem(ONBOARDED_KEY);
    set({
      onboarded: false,
      name: '',
      dailyGoal: DEFAULT_DAILY_GOAL,
    });
  },

  logPushups: (count) => {
    const { crew, meId } = get();
    const me = crew.find((m) => m.id === meId);
    if (!me) return { leveledUp: false };

    const newXp = me.xp + count * XP_PER_PUSHUP;
    const leveledUp = levelFromXp(newXp) > levelFromXp(me.xp);

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

    return { leveledUp };
  },

  sendChat: (text) => {
    set((state) => ({
      chat: [
        ...state.chat,
        {
          id: state.chat.length + 1,
          who: state.meId,
          t: nowHHMM(),
          text,
        },
      ],
    }));
  },

  setActiveScreen: (s) => set({ activeScreen: s }),
  consumeLevelUp: () => set({ levelUpEvent: null }),
}));

// Selectors used across screens
export const selectMe = (s: AppState): CrewMember | undefined =>
  s.crew.find((m) => m.id === s.meId);

export const selectRankedByToday = (s: AppState): CrewMember[] =>
  [...s.crew].sort((a, b) => b.today - a.today || b.total - a.total);

export const selectRankedByWeek = (s: AppState): CrewMember[] =>
  [...s.crew].sort((a, b) => b.week - a.week || b.total - a.total);
