import type { CrewMember } from '@/types';
import { formatEuro } from '@/lib/mechanics';
import { isLoneWolfWindow, viennaYesterdayIso } from '@/lib/viennaTime';
import {
  FLAME_EXTINGUISHER_ID,
  MORNING_LEDGER_ID,
  presentCrewNotification,
  rescheduleFlameExtinguisher,
  rescheduleMorningLedger,
  resetCrewNotificationTracking,
  type CrewNotificationPayload,
  type CrewNotificationType,
} from '@/lib/notifications';

const POT_MILESTONE_CENTS = 50 * 100;

let potTrackingInitialized = false;
let lastTrackedPotCents = 0;

export function memberDailyGoal(member: CrewMember, defaultGoal: number): number {
  return member.dailyGoal ?? defaultGoal;
}

export function hasMetGoalToday(member: CrewMember, defaultGoal: number): boolean {
  return member.today >= memberDailyGoal(member, defaultGoal);
}

function slackers(crew: CrewMember[], defaultGoal: number): CrewMember[] {
  return crew.filter((m) => !hasMetGoalToday(m, defaultGoal));
}

function membersWhoMissedYesterday(crew: CrewMember[], defaultGoal: number): CrewMember[] {
  const yesterday = viennaYesterdayIso();
  return crew.filter((m) => {
    const goal = memberDailyGoal(m, defaultGoal);
    const stat = m.dailyStats?.find((s) => s.day === yesterday);
    return (stat?.count ?? 0) < goal;
  });
}

function wasWeeklyOvertaken(
  prevCrew: CrewMember[],
  nextCrew: CrewMember[],
  triggerUserId: string,
  targetUserId: string,
): boolean {
  if (triggerUserId === targetUserId) return false;

  const prevTarget = prevCrew.find((m) => m.id === targetUserId);
  const prevTrigger = prevCrew.find((m) => m.id === triggerUserId);
  const nextTrigger = nextCrew.find((m) => m.id === triggerUserId);
  if (!prevTarget || !prevTrigger || !nextTrigger) return false;

  return prevTrigger.week <= prevTarget.week && nextTrigger.week > prevTarget.week;
}

function buildPayload(
  type: CrewNotificationType,
  title: string,
  body: string,
): CrewNotificationPayload {
  return { type, title, body };
}

function dominoEffect(trigger: CrewMember, target: CrewMember, logCount: number): CrewNotificationPayload {
  return buildPayload(
    'domino_effect',
    `${trigger.name} just pushed! 💪`,
    `${trigger.name} just logged ${logCount} pushups! Your turn, ${target.name}. Drop and get yours done right now.`,
  );
}

function leaderboardThreat(trigger: CrewMember, logCount: number): CrewNotificationPayload {
  return buildPayload(
    'leaderboard_threat',
    `${trigger.name} is pulling ahead! 🏃‍♂️`,
    `${trigger.name} just logged ${logCount} pushups and took your spot on the leaderboard. Go get it back!`,
  );
}

function loneWolf(trigger: CrewMember, target: CrewMember): CrewNotificationPayload {
  return buildPayload(
    'lone_wolf',
    `Don't leave ${trigger.name} hanging! 🤝`,
    `${trigger.name} just finished their night sets. You are now the only one left who hasn't logged today.`,
  );
}

function freePassMotivation(trigger: CrewMember, target: CrewMember, logCount: number): CrewNotificationPayload {
  return buildPayload(
    'free_pass',
    `${trigger.name} is safe today! 🛡️`,
    `${trigger.name} just logged ${logCount} pushups and saved their €1.00. You're still on the hook, ${target.name}—clock's ticking!`,
  );
}

function morningLedger(missedMember: CrewMember, skipPotCents: number): CrewNotificationPayload {
  return buildPayload(
    'morning_ledger',
    'Cha-Ching! 🪙',
    `${missedMember.name} missed yesterday! Thanks for funding the crew. Total pot is now at ${formatEuro(skipPotCents)}!`,
  );
}

function milestoneFeast(skipPotCents: number): CrewNotificationPayload {
  return buildPayload(
    'milestone_feast',
    'Pizza night is getting closer! 🍕',
    `The crew pot just hit ${formatEuro(skipPotCents)} thanks to your lazy days. Who is buying the next slice?`,
  );
}

function flameExtinguisher(streak: number): CrewNotificationPayload {
  return buildPayload(
    'flame_extinguisher',
    "Don't freeze your streak! 🧊",
    `You've hit ${streak} days in a row. Get your sets done before midnight to keep the fire burning.`,
  );
}

function pickSlackerNotification(
  trigger: CrewMember,
  target: CrewMember,
  logCount: number,
  skipPotCents: number,
): CrewNotificationPayload {
  if (skipPotCents > 0 && Math.random() < 0.25) {
    return freePassMotivation(trigger, target, logCount);
  }
  return dominoEffect(trigger, target, logCount);
}

/** Evaluate and fire a single real-time notification after a teammate logs pushups. */
export async function handleTeammatePushupLog(params: {
  triggerUserId: string;
  logCount: number;
  prevCrew: CrewMember[];
  crew: CrewMember[];
  me: CrewMember | undefined;
  dailyGoal: number;
  skipPotCents: number;
}): Promise<void> {
  const { triggerUserId, logCount, prevCrew, crew, me, dailyGoal, skipPotCents } = params;
  if (!me || triggerUserId === me.id) return;
  if (hasMetGoalToday(me, dailyGoal)) return;

  const trigger = crew.find((m) => m.id === triggerUserId);
  if (!trigger) return;

  const remainingSlackers = slackers(crew, dailyGoal);

  if (wasWeeklyOvertaken(prevCrew, crew, triggerUserId, me.id)) {
    await presentCrewNotification(leaderboardThreat(trigger, logCount));
    return;
  }

  if (
    isLoneWolfWindow() &&
    remainingSlackers.length === 1 &&
    remainingSlackers[0]?.id === me.id
  ) {
    await presentCrewNotification(loneWolf(trigger, me));
    return;
  }

  await presentCrewNotification(pickSlackerNotification(trigger, me, logCount, skipPotCents));
}

/** Fire when the crew pot crosses a new €50 milestone. */
export async function syncPotMilestoneNotification(skipPotCents: number): Promise<void> {
  if (!potTrackingInitialized) {
    potTrackingInitialized = true;
    lastTrackedPotCents = skipPotCents;
    return;
  }

  const prevPot = lastTrackedPotCents;
  lastTrackedPotCents = skipPotCents;

  if (skipPotCents <= 0 || skipPotCents % POT_MILESTONE_CENTS !== 0) return;
  if (skipPotCents <= prevPot) return;
  if (Math.floor(skipPotCents / POT_MILESTONE_CENTS) <= Math.floor(prevPot / POT_MILESTONE_CENTS)) {
    return;
  }

  await presentCrewNotification(milestoneFeast(skipPotCents));
}

export async function syncCrewScheduledNotifications(params: {
  me: CrewMember | undefined;
  crew: CrewMember[];
  dailyGoal: number;
  skipPotCents: number;
}): Promise<void> {
  const { me, crew, dailyGoal, skipPotCents } = params;
  if (!me) return;

  const streak = me.streak;

  if (!hasMetGoalToday(me, dailyGoal) && streak >= 3) {
    await rescheduleFlameExtinguisher(flameExtinguisher(streak));
  } else {
    await rescheduleFlameExtinguisher(null);
  }

  const missedYesterday = membersWhoMissedYesterday(crew, dailyGoal);
  if (missedYesterday.length > 0) {
    await rescheduleMorningLedger(morningLedger(missedYesterday[0], skipPotCents));
  } else {
    await rescheduleMorningLedger(null);
  }
}

export function resetCrewNotificationsState(): void {
  potTrackingInitialized = false;
  lastTrackedPotCents = 0;
  resetCrewNotificationTracking();
}

export { FLAME_EXTINGUISHER_ID, MORNING_LEDGER_ID };
