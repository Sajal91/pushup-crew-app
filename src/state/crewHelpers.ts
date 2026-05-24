import type { CrewMember } from '@/types';
import { clampDisplayName } from '@/lib/displayName';

export function placeholderMe(
  userId: string,
  name: string,
  image = '',
  dailyGoal?: number,
): CrewMember {
  const display = clampDisplayName(name) || 'BRO';
  return {
    id: userId,
    name: display,
    image,
    dailyGoal,
    handle: '@me',
    level: 0,
    xp: 0,
    streak: 0,
    today: 0,
    week: 0,
    total: 0,
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
