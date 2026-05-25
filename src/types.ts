// Shared types — mirror the README "Crew Model" section. When wiring Supabase,
// align column names with these and add a /lib/db.ts mapper.

export type DailyStat = {
  day: string; // YYYY-MM-DD in UTC
  count: number;
};

export type CrewMember = {
  id: string;
  image: string;
  name: string;
  handle: string;
  dailyGoal?: number;
  dailyStats?: DailyStat[];
  level: number;
  xp: number;
  streak: number;
  today: number;
  week: number;
  total: number;
  isMe?: boolean;
};

export type ChatMessage = {
  id: number | string;
  who: string;           // user id
  t: string;             // "HH:MM"
  text: string;
  system?: boolean;      // rendered as centered pill
};

export type Crew = {
  id: string;
  name: string;
  inviteCode: string;
  skipPotCents: number;
};

export type AppScreen = 'home' | 'log' | 'rank' | 'chat' | 'you';
