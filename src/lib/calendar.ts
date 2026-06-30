export const APP_TIME_ZONE = 'Europe/Vienna';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const CALENDAR_WEEK_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export function appTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
}

export function appDayKey(date: Date): string {
  const parts = appTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function viennaWeekdayIndex(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    weekday: 'short',
  }).format(date);
  return WEEKDAY_INDEX[weekday] ?? 0;
}

export type CalendarWeekDay = {
  day: string;
  label: (typeof CALENDAR_WEEK_LABELS)[number];
  isToday: boolean;
  isFuture: boolean;
  isSaturday: boolean;
};

export function calendarWeek(reference = new Date()): CalendarWeekDay[] {
  const todayKey = appDayKey(reference);
  const dow = viennaWeekdayIndex(reference);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(reference.getTime() + (index - dow) * 86_400_000);
    const day = appDayKey(date);
    return {
      day,
      label: CALENDAR_WEEK_LABELS[index],
      isToday: day === todayKey,
      isFuture: day > todayKey,
      isSaturday: index === 6,
    };
  });
}
