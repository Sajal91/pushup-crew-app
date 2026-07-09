import type { PushPayload } from './expoPush.ts';

export type CrewNotificationType =
  | 'domino_effect'
  | 'leaderboard_threat'
  | 'lone_wolf'
  | 'flame_extinguisher'
  | 'free_pass'
  | 'morning_ledger'
  | 'milestone_feast'
  | 'chat_message'
  | 'daily_goal_reminder';

const CREW_CHANNEL = 'crew-alerts';
const DAILY_CHANNEL = 'daily-reminders';

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}

function buildPayload(
  type: CrewNotificationType,
  title: string,
  body: string,
  channelId = CREW_CHANNEL,
): PushPayload {
  return { type, title, body, channelId };
}

export function chatMessagePayload(senderName: string, text: string): PushPayload {
  return buildPayload('chat_message', `${senderName} 💬`, text);
}

export function dailyGoalReminderPayload(remaining: number): PushPayload {
  return buildPayload(
    'daily_goal_reminder',
    'DAILY GOAL',
    `${remaining} pushups left today. Skip = €1 in the pot.`,
    DAILY_CHANNEL,
  );
}

export function dominoEffectPayload(
  triggerName: string,
  targetName: string,
  logCount: number,
): PushPayload {
  return buildPayload(
    'domino_effect',
    `${triggerName} just pushed! 💪`,
    `${triggerName} just logged ${logCount} pushups! Your turn, ${targetName}. Drop and get yours done right now.`,
  );
}

export function leaderboardThreatPayload(triggerName: string, logCount: number): PushPayload {
  return buildPayload(
    'leaderboard_threat',
    `${triggerName} is pulling ahead! 🏃‍♂️`,
    `${triggerName} just logged ${logCount} pushups and took your spot on the leaderboard. Go get it back!`,
  );
}

export function loneWolfPayload(triggerName: string): PushPayload {
  return buildPayload(
    'lone_wolf',
    `Don't leave ${triggerName} hanging! 🤝`,
    `${triggerName} just finished their night sets. You are now the only one left who hasn't logged today.`,
  );
}

export function freePassPayload(
  triggerName: string,
  targetName: string,
  logCount: number,
): PushPayload {
  return buildPayload(
    'free_pass',
    `${triggerName} is safe today! 🛡️`,
    `${triggerName} just logged ${logCount} pushups and saved their €1.00. You're still on the hook, ${targetName}—clock's ticking!`,
  );
}

export function morningLedgerPayload(missedName: string, skipPotCents: number): PushPayload {
  return buildPayload(
    'morning_ledger',
    'Cha-Ching! 🪙',
    `${missedName} missed yesterday! Thanks for funding the crew. Total pot is now at ${formatEuro(skipPotCents)}!`,
  );
}

export function milestoneFeastPayload(skipPotCents: number): PushPayload {
  return buildPayload(
    'milestone_feast',
    'Pizza night is getting closer! 🍕',
    `The crew pot just hit ${formatEuro(skipPotCents)} thanks to your lazy days. Who is buying the next slice?`,
  );
}

export function flameExtinguisherPayload(streak: number): PushPayload {
  return buildPayload(
    'flame_extinguisher',
    "Don't freeze your streak! 🧊",
    `You've hit ${streak} days in a row. Get your sets done before midnight to keep the fire burning.`,
  );
}

export function isLoneWolfWindow(date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  if (hour < 21) return false;
  if (hour > 23) return false;
  if (hour === 23 && minute > 30) return false;
  return true;
}

export function viennaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function viennaIsoDay(date = new Date()): string {
  const { year, month, day } = viennaParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function gmt2IsoDay(date = new Date()): string {
  const gmt2 = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return [
    gmt2.getUTCFullYear(),
    String(gmt2.getUTCMonth() + 1).padStart(2, '0'),
    String(gmt2.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function viennaYesterdayIso(date = new Date()): string {
  const today = viennaIsoDay(date);
  let cursor = new Date(date.getTime());
  for (let i = 0; i < 48; i += 1) {
    cursor = new Date(cursor.getTime() - 60 * 60 * 1000);
    const day = viennaIsoDay(cursor);
    if (day !== today) return day;
  }
  return today;
}

export function pickSlackerPayload(
  triggerName: string,
  targetName: string,
  logCount: number,
  skipPotCents: number,
): PushPayload {
  if (skipPotCents > 0 && Math.random() < 0.25) {
    return freePassPayload(triggerName, targetName, logCount);
  }
  return dominoEffectPayload(triggerName, targetName, logCount);
}
