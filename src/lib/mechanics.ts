// Game mechanic constants & pure helpers. README "Mechanics Constants".

export const XP_PER_PUSHUP = 2;
export const XP_PER_LEVEL = 500;
export const WEEKLY_TARGET = 700;
export const SKIP_PENALTY = 1; // € per skipped day
export const DEFAULT_DAILY_GOAL = 100;

export const levelFromXp = (xp: number) => Math.floor(xp / XP_PER_LEVEL);
export const xpInLevel = (xp: number) => xp % XP_PER_LEVEL;
export const levelProgress = (xp: number) => xpInLevel(xp) / XP_PER_LEVEL;

export const xpAfterLog = (currentXp: number, count: number) =>
  currentXp + count * XP_PER_PUSHUP;

export const didLevelUp = (oldXp: number, newXp: number) =>
  levelFromXp(newXp) > levelFromXp(oldXp);

export const formatEuro = (cents: number) => `€${(cents / 100).toFixed(0)}`;

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
