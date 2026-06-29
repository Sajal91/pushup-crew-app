// Shared types — mirror the README "Crew Model" section. When wiring Supabase,
// align column names with these and add a /lib/db.ts mapper.

export type DailyStat = {
  day: string; // YYYY-MM-DD in the app calendar timezone
  count: number;
};

export type PushupLog = {
  id: number | string;
  userId: string;
  crewId: string | null;
  count: number;
  loggedAt: string;
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
  skipDays?: number;
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
  ownerId?: string;
  region?: string;
};

export type RegionalCrewRank = {
  id: string;
  name: string;
  memberCount: number;
  today: number;
  week: number;
  isMine?: boolean;
};

export type AppScreen = 'home' | 'log' | 'rank' | 'chat' | 'you';
