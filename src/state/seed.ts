// Seed data mirrors shared.jsx so the skeleton matches the prototype 1:1.
import type { CrewMember, ChatMessage, Crew } from '@/types';

export const SEED_CREW: CrewMember[] = [
  { id: 'nik',    image: '', name: 'Nik',    handle: '@nik',  dailyGoal: 100, level: 14, xp: 1820, streak: 23, today: 0,   week: 412, total: 9240,  isMe: true },
  { id: 'daniel', image: '', name: 'Daniel', handle: '@dan',  dailyGoal: 150, level: 16, xp: 2410, streak: 31, today: 120, week: 540, total: 11180 },
  { id: 'sascha', image: '', name: 'Sascha', handle: '@sash', dailyGoal: 80,  level: 12, xp: 1420, streak: 9,  today: 60,  week: 280, total: 7550 },
];

export const SEED_CHAT: ChatMessage[] = [
  { id: 1, who: 'daniel', t: '08:14', text: '120 done, let\'s eat' },
  { id: 2, who: 'sascha', t: '08:22', text: 'bro how' },
  { id: 3, who: 'daniel', t: '08:23', text: 'eat sleep pushup repeat' },
  { id: 4, who: 'nik',    t: '08:31', text: 'coming soon' },
  { id: 5, who: 'sascha', t: '09:02', text: 'if nik skips today, €1 in the pot' },
];

export const SEED_CREW_META: Crew = {
  id: 'crew-1',
  name: 'THE BROS',
  inviteCode: 'GAINS-XY42',
  skipPotCents: 300, // €3
};

// Deterministic pseudo-week data for sparklines, matches shared.jsx algorithm.
const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const weekFor = (id: string) => {
  const seed = id.charCodeAt(0) + (id.charCodeAt(1) ?? 0);
  return dayLabels.map((d, i) => {
    const v = ((seed * 17 + i * 41) % 130) + 30;
    return { d, v: i === 6 ? null : v } as { d: string; v: number | null };
  });
};
