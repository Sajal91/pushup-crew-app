// Game mechanic constants & pure helpers. README "Mechanics Constants".

export const XP_PER_PUSHUP = 2;
/** XP to go from level 1 → 2; each subsequent level needs +50 more. */
export const LEVEL_XP_BASE = 500;
export const LEVEL_XP_INCREMENT = 50;
export const WEEKLY_TARGET = 700;
export const SKIP_PENALTY = 1; // € per skipped day
export const DEFAULT_DAILY_GOAL = 100;

/** @deprecated Use xpNeededForNextLevel(level) — kept for imports that expect a constant at lvl 1 */
export const XP_PER_LEVEL = LEVEL_XP_BASE;

/** XP required to advance from `level` to `level + 1` (level is 1-based). */
export const xpRequiredForLevelUp = (level: number): number =>
  LEVEL_XP_BASE + Math.max(0, level - 1) * LEVEL_XP_INCREMENT;

/** Total XP at the start of `level` (level 1 starts at 0 XP). */
export const totalXpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  const steps = level - 1;
  return steps * LEVEL_XP_BASE + (LEVEL_XP_INCREMENT * (steps - 1) * steps) / 2;
};

/** 1-based level from total XP (everyone starts at level 1 with 0 XP). */
export const levelFromXp = (xp: number): number => {
  const safeXp = Math.max(0, xp);
  let level = 1;
  while (totalXpForLevel(level + 1) <= safeXp) level += 1;
  return level;
};

/** XP earned within the current level toward the next one. */
export const xpInLevel = (xp: number): number => {
  const lvl = levelFromXp(xp);
  return Math.max(0, xp) - totalXpForLevel(lvl);
};

/** XP still needed to reach the next level from `level` (1-based). */
export const xpNeededForNextLevel = (level: number): number => xpRequiredForLevelUp(level);

export const levelProgress = (xp: number): number => {
  const lvl = levelFromXp(xp);
  const need = xpNeededForNextLevel(lvl);
  return need > 0 ? Math.min(xpInLevel(xp) / need, 1) : 1;
};

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
