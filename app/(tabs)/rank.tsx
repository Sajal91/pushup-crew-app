import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { Sparkline } from '@/components/Sparkline';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { SectionTitle } from '@/components/SectionTitle';
import { ProgressBar } from '@/components/ProgressBar';
import {
  useAppStore,
  selectRankedByToday,
  selectRankedByWeek,
} from '@/state/useAppStore';
import { DEFAULT_DAILY_GOAL, formatEuro, levelFromXp } from '@/lib/mechanics';
import type { CrewMember, PushupLog } from '@/types';

type Mode = 'today' | 'week';
type SparkPoint = { d: string; v: number | null };

const APP_TIME_ZONE = 'Europe/Vienna';
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  const index = date.getUTCDay();
  return DAY_LABELS[index] ?? day.slice(5);
}

function appTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: Number(value('hour')) || 0,
  };
}

function appDayKey(date: Date): string {
  const parts = appTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hourRangeLabel(hour: number): string {
  return `${hour} - ${(hour + 1) % 24}`;
}

function weekDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() + (index - 6) * 24 * 60 * 60 * 1000);
    const day = appDayKey(date);
    return { day, label: dayLabel(day) };
  });
}

function emptyWeekData(): SparkPoint[] {
  return weekDays().map(({ label }) => ({ d: label, v: 0 }));
}

function weekSparklineDataFor(member: CrewMember, logs: PushupLog[]): SparkPoint[] {
  if (logs.length > 0) {
    const buckets = new Map(weekDays().map(({ day }) => [day, 0]));

    logs.forEach((log) => {
      if (log.userId !== member.id) return;
      const day = appDayKey(new Date(log.loggedAt));
      if (!buckets.has(day)) return;
      buckets.set(day, (buckets.get(day) ?? 0) + log.count);
    });

    return weekDays().map(({ day, label }) => ({
      d: label,
      v: buckets.get(day) ?? 0,
    }));
  }

  if (!member.dailyStats?.length) return emptyWeekData();
  return member.dailyStats.map((stat) => ({
    d: dayLabel(stat.day),
    v: stat.count,
  }));
}

function todaySparklineDataFor(member: CrewMember, logs: PushupLog[]): SparkPoint[] {
  const today = appDayKey(new Date());
  const buckets = Array.from({ length: 24 }, () => 0);

  logs.forEach((log) => {
    if (log.userId !== member.id) return;
    const loggedAt = new Date(log.loggedAt);
    const parts = appTimeParts(loggedAt);
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (day !== today) return;
    buckets[parts.hour] += log.count;
  });

  return buckets.map((count, hour) => ({
    d: hourRangeLabel(hour),
    v: count,
  }));
}

export default function RankScreen() {
  const [mode, setMode] = useState<Mode>('today');
  const ranked = useAppStore(mode === 'today' ? selectRankedByToday : selectRankedByWeek);
  const crewMeta = useAppStore((s) => s.crewMeta);
  const dailyGoal = useAppStore((s) => s.dailyGoal);
  const pushupLogs = useAppStore((s) => s.pushupLogs);

  const skipSummary = ranked
    .filter((m) => (m.skipDays ?? 0) > 0)
    .map((m) => `${m.name} ${m.skipDays}`)
    .join(', ');
  const potNote = skipSummary
    ? `Skip days: ${skipSummary}. Each skip = €1.`
    : 'Each missed daily goal adds €1 to the pot.';

  return (
    <ScreenContainer fadeOnFocus>
      <SectionTitle kicker="RANKING">LEADERBOARD</SectionTitle>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 6 }}>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: 'today', label: 'TODAY' },
            { value: 'week', label: 'WEEK' },
          ]}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 14, gap: 10 }}>
        {ranked.map((m, i) => {
          const value = mode === 'today' ? m.today : m.week;
          const memberDailyGoal = m.dailyGoal ?? (m.isMe ? dailyGoal : DEFAULT_DAILY_GOAL);
          const target = mode === 'today' ? memberDailyGoal : memberDailyGoal * 7;
          const progress = target > 0 ? Math.min(value / target, 1) : 0;
          const percent = Math.round(progress * 100);
          const isMe = !!m.isMe;
          const sparklineData =
            mode === 'today'
              ? todaySparklineDataFor(m, pushupLogs)
              : weekSparklineDataFor(m, pushupLogs);
          return (
            <Panel key={m.id} variant={isMe ? 'acid' : 'default'} pad="md">
              <View style={styles.row}>
                <Text style={[styles.rank, i === 0 && { color: colors.acid }]}>
                  {i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {m.name.toUpperCase()}
                    {isMe ? <Text style={{ color: colors.acid }}> · YOU</Text> : null}
                  </Text>
                  <Text style={styles.meta}>
                    LVL {levelFromXp(m.xp)} · {m.streak}D STREAK
                  </Text>
                </View>
                <Text style={[styles.value, i === 0 && { color: colors.acid }]}>
                  {value}
                </Text>
              </View>
              <View style={styles.goalRow}>
                <Text style={styles.goalMeta}>{value} / {target}</Text>
                <Text style={styles.goalMeta}>
                  {percent}% {mode === 'today' ? 'DAILY TARGET' : '7-DAY TARGET'}
                </Text>
              </View>
              <ProgressBar
                progress={progress}
                height={4}
                color={isMe ? colors.acid : colors.acidDim}
              />
              <View style={{ marginTop: 8 }}>
                {mode === 'today' ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.hourlyChart}
                  >
                    <Sparkline
                      data={sparklineData}
                      color={isMe ? colors.acid : colors.acidDim}
                      width={1120}
                      height={100}
                      gap={8}
                    />
                  </ScrollView>
                ) : (
                  <Sparkline
                    data={sparklineData}
                    color={isMe ? colors.acid : colors.acidDim}
                    width={310}
                    height={100}
                  />
                )}
              </View>
            </Panel>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 18 }}>
        <Panel variant="blood-dashed" pad="md">
          <Kicker style={{ color: colors.blood, marginBottom: 6 }}>// SKIP POT</Kicker>
          <Text style={styles.potValue}>{formatEuro(crewMeta.skipPotCents)}</Text>
          <Text style={styles.potNote}>{potNote}</Text>
        </Panel>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.dim,
    width: 44,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.5,
  },
  meta: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1,
  },
  goalRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.dim,
    letterSpacing: 1,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
  },
  hourlyChart: {
    paddingRight: 8,
  },
  potValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.blood,
  },
  potNote: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.dim,
  },
});
