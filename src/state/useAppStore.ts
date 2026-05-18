import { create } from 'zustand';
import type { CrewMember, ChatMessage, Crew, AppScreen } from '@/types';
import { SEED_CREW, SEED_CHAT, SEED_CREW_META } from './seed';
import { XP_PER_PUSHUP, nowHHMM, DEFAULT_DAILY_GOAL, levelFromXp } from '@/lib/mechanics';

type AppState = {
  // Onboarding / profile
  onboarded: boolean;
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
  setName: (name: string) => void;
  setDailyGoal: (goal: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  logPushups: (count: number) => { leveledUp: boolean };
  sendChat: (text: string) => void;
  setActiveScreen: (s: AppScreen) => void;
  consumeLevelUp: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  onboarded: false,
  name: '',
  dailyGoal: DEFAULT_DAILY_GOAL,

  crew: SEED_CREW,
  crewMeta: SEED_CREW_META,
  chat: SEED_CHAT,
  meId: 'nik',

  activeScreen: 'home',
  levelUpEvent: null,

  setName: (name) => set({ name }),
  setDailyGoal: (goal) => set({ dailyGoal: goal }),
  completeOnboarding: () => set({ onboarded: true }),
  resetOnboarding: () =>
    set({
      onboarded: false,
      name: '',
      dailyGoal: DEFAULT_DAILY_GOAL,
    }),

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
