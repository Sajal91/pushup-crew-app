import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/theme';
import { HeroNumber } from '@/components/HeroNumber';
import { calendarWeek, appDayKey } from '@/lib/calendar';
import type { DailyStat } from '@/types';

const STREAK_ORANGE = '#FF9600';
const STREAK_YELLOW = '#FFC800';
const STREAK_RED = '#FF4B4B';

type WeekDayCell = {
  day: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  isSaturday: boolean;
  completed: boolean;
};

type Segment =
  | { type: 'synergy'; days: WeekDayCell[]; includesToday: boolean }
  | { type: 'pending'; day: WeekDayCell };

type Props = {
  streak: number;
  dailyGoal: number;
  todayCount: number;
  dailyStats?: DailyStat[];
};

function pushupsOnDay(
  dailyStats: DailyStat[] | undefined,
  todayCount: number,
  day: string,
): number {
  const todayKey = appDayKey(new Date());
  if (day === todayKey) return todayCount;
  return dailyStats?.find((stat) => stat.day === day)?.count ?? 0;
}

function buildWeekDays(
  dailyStats: DailyStat[] | undefined,
  todayCount: number,
  dailyGoal: number,
): WeekDayCell[] {
  return calendarWeek().map((entry) => {
    const count = pushupsOnDay(dailyStats, todayCount, entry.day);
    return {
      ...entry,
      completed: dailyGoal > 0 && count >= dailyGoal,
    };
  });
}

function buildSegments(days: WeekDayCell[]): Segment[] {
  const segments: Segment[] = [];
  let completedRun: WeekDayCell[] = [];

  const flushCompletedRun = () => {
    if (completedRun.length === 0) return;
    segments.push({
      type: 'synergy',
      days: [...completedRun],
      includesToday: completedRun.some((day) => day.isToday),
    });
    completedRun = [];
  };

  for (const day of days) {
    if (day.completed) {
      completedRun.push(day);
      continue;
    }

    flushCompletedRun();
    segments.push({ type: 'pending', day });
  }

  flushCompletedRun();
  return segments;
}

function SynergyGradientBackground() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="synergyGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={STREAK_YELLOW} />
          <Stop offset="0.45" stopColor={STREAK_ORANGE} />
          <Stop offset="1" stopColor={STREAK_RED} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={22} fill="url(#synergyGrad)" />
    </Svg>
  );
}

function CompletedDayMark() {
  return (
    <View style={styles.completedMark}>
      <Ionicons name="checkmark" size={16} color={STREAK_ORANGE} />
    </View>
  );
}

function PendingDayMark({ day }: { day: WeekDayCell }) {
  if (day.isSaturday) {
    return (
      <View style={[styles.treasureMark, day.completed && styles.treasureMarkDone]} />
    );
  }

  return <View style={[styles.pendingMark, day.isToday && styles.pendingMarkToday]} />;
}

function SynergySegment({
  days,
  includesToday,
}: {
  days: WeekDayCell[];
  includesToday: boolean;
}) {
  return (
    <View
      style={[
        styles.synergyPill,
        { flex: days.length },
        includesToday && styles.synergyPillActive,
      ]}
    >
      <SynergyGradientBackground />
      <View style={styles.synergyDays}>
        {days.map((day) => (
          <View key={day.day} style={styles.synergyDaySlot}>
            {day.isSaturday ? (
              <View style={styles.completedMark}>
                <Ionicons name="gift" size={16} color={STREAK_ORANGE} />
              </View>
            ) : (
              <CompletedDayMark />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export function StreakSynergyBar({ streak, dailyGoal, todayCount, dailyStats }: Props) {
  const weekDays = useMemo(
    () => buildWeekDays(dailyStats, todayCount, dailyGoal),
    [dailyStats, todayCount, dailyGoal],
  );
  const segments = useMemo(() => buildSegments(weekDays), [weekDays]);
  const weekComplete = weekDays.every((day) => day.completed);
  const completedThisWeek = weekDays.filter((day) => day.completed).length;

  return (
    <View style={styles.container}>
      <View style={styles.flameWrap}>
        <View style={styles.flameShadow} />
        <Ionicons name="flame" size={72} color={STREAK_ORANGE} />
      </View>

      <HeroNumber value={streak} size={88} color={STREAK_ORANGE} glow={false} />
      <Text style={styles.streakLabel}>DAYS IN A ROW</Text>

      <View style={styles.barSection}>
        <View style={styles.labelsRow}>
          {weekDays.map((day) => (
            <View key={day.day} style={styles.labelSlot}>
              <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
                {day.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.barRow}>
          {segments.map((segment) => {
            if (segment.type === 'synergy') {
              return (
                <SynergySegment
                  key={segment.days.map((day) => day.day).join('-')}
                  days={segment.days}
                  includesToday={segment.includesToday}
                />
              );
            }

            return (
              <View key={segment.day.day} style={styles.pendingSlot}>
                <PendingDayMark day={segment.day} />
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.motivation}>
        {weekComplete ? (
          <>
            Perfect week — <Text style={styles.motivationHighlight}>7/7</Text> goals crushed.
          </>
        ) : (
          <>
            <Text style={styles.motivationHighlight}>{completedThisWeek}/7</Text> days hit this
            week. Keep the fire going.
          </>
        )}
      </Text>
    </View>
  );
}

const MARK_SIZE = 34;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    width: 88,
    height: 88,
  },
  flameShadow: {
    position: 'absolute',
    bottom: 6,
    width: 56,
    height: 14,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 200, 0, 0.22)',
  },
  streakLabel: {
    marginTop: -2,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
    color: STREAK_ORANGE,
  },
  barSection: {
    width: '100%',
    marginTop: 22,
  },
  labelsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  labelSlot: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.dim,
  },
  dayLabelToday: {
    color: STREAK_ORANGE,
    fontWeight: '700',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MARK_SIZE + 8,
  },
  synergyPill: {
    minHeight: MARK_SIZE + 8,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  synergyPillActive: {
    borderWidth: 3,
    borderColor: STREAK_YELLOW,
  },
  synergyDays: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flex: 1,
    paddingHorizontal: 4,
  },
  synergyDaySlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedMark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingMark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
    borderColor: '#3a3a3a',
    backgroundColor: colors.panel2,
  },
  pendingMarkToday: {
    borderColor: STREAK_ORANGE,
  },
  treasureMark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
    borderColor: '#3a3a3a',
    backgroundColor: colors.panel2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  treasureMarkDone: {
    borderColor: STREAK_YELLOW,
    backgroundColor: 'rgba(255, 150, 0, 0.15)',
  },
  motivation: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.dim,
    paddingHorizontal: 8,
  },
  motivationHighlight: {
    color: STREAK_ORANGE,
    fontWeight: '700',
  },
});
