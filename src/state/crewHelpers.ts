import type { CrewMember, DailyStat } from '@/types';
import { clampDisplayName } from '@/lib/displayName';
import { memberFromPersonalStats, type PersonalStats } from '@/lib/crewDb';

export function emptySevenDayStats(): DailyStat[] {
  const UTC_DAY_MS = 24 * 60 * 60 * 1000;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() + (index - 6) * UTC_DAY_MS);
    const day = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
    return { day, count: 0 };
  });
}

export function placeholderMe(
  userId: string,
  name: string,
  image = '',
  dailyGoal?: number,
  personal?: PersonalStats,
): CrewMember {
  const display = clampDisplayName(name) || 'BRO';
  const personalFields = personal
    ? memberFromPersonalStats(personal.lifetimeTotal, personal.streak)
    : memberFromPersonalStats(0, 0);
  return {
    id: userId,
    name: display,
    image,
    dailyGoal: personal?.dailyGoal ?? dailyGoal,
    handle: '@me',
    ...personalFields,
    today: 0,
    week: 0,
    dailyStats: emptySevenDayStats(),
    isMe: true,
  };
}

/** Guarantees the signed-in user exists in crew[] so tabs never render blank. */
export function ensureMeInCrew(
  crew: CrewMember[],
  meId: string,
  name: string,
  image?: string,
  dailyGoal?: number,
): CrewMember[] {
  if (!meId) return crew;

  const display = clampDisplayName(name) || 'BRO';
  const idx = crew.findIndex((m) => m.id === meId || m.isMe);

  if (idx === -1) {
    return [
      ...crew.map((m) => ({ ...m, isMe: false })),
      placeholderMe(meId, display, image ?? '', dailyGoal),
    ];
  }

  return crew.map((m, i) =>
    i === idx
      ? {
          ...m,
          id: meId,
          name: display,
          image: image ?? m.image,
          dailyGoal: dailyGoal ?? m.dailyGoal,
          isMe: true,
        }
      : { ...m, isMe: false },
  );
}
