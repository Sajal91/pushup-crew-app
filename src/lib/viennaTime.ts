/** Europe/Vienna calendar helpers (matches skip-pot + crew snapshot timezone). */

export type ViennaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getViennaParts(date = new Date()): ViennaParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function viennaIsoDay(date = new Date()): string {
  const { year, month, day } = getViennaParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

/** Next wall-clock time in Europe/Vienna (hour:minute), at least 30s in the future. */
export function nextViennaWallClock(hour: number, minute: number, now = new Date()): Date {
  let candidate = new Date(now.getTime() + 60_000);
  candidate.setSeconds(0, 0);

  for (let i = 0; i < 60 * 48; i += 1) {
    const parts = getViennaParts(candidate);
    const matches = parts.hour === hour && parts.minute === minute;
    if (matches && candidate.getTime() > now.getTime() + 30_000) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + 60_000);
  }

  return new Date(now.getTime() + 24 * 60 * 60_000);
}

/** 9:00 PM – 11:30 PM in Europe/Vienna. */
export function isLoneWolfWindow(date = new Date()): boolean {
  const { hour, minute } = getViennaParts(date);
  if (hour < 21) return false;
  if (hour > 23) return false;
  if (hour === 23 && minute > 30) return false;
  return true;
}
