import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { HeroNumber } from '@/components/HeroNumber';
import { AcidButton } from '@/components/AcidButton';
import { ProgressBar } from '@/components/ProgressBar';
import { useAppStore, selectMe, selectRankedByToday } from '@/state/useAppStore';
import { SkipPotPanel } from '@/components/SkipPotPanel';
import { DEFAULT_DAILY_GOAL } from '@/lib/mechanics';

export default function Home() {
  const router = useRouter();
  const me = useAppStore(selectMe);
  const ranked = useAppStore(selectRankedByToday);
  const crewMeta = useAppStore((s) => s.crewMeta);
  const dailyGoal = useAppStore((s) => s.dailyGoal);

  if (!me) return null;

  const myDailyGoal = me.dailyGoal ?? dailyGoal;
  const goalProgress = myDailyGoal > 0 ? Math.min(me.today / myDailyGoal, 1) : 0;
  const remaining = Math.max(0, myDailyGoal - me.today);
  const goalMet = remaining === 0;
  const weeklyGoal = Math.max(myDailyGoal * 7, DEFAULT_DAILY_GOAL * 7);
  const leader = ranked[0];
  const myRank = ranked.findIndex((m) => m.id === me.id) + 1;
  const leading = leader.id === me.id;
  const behind = leading ? 0 : leader.today - me.today;
  const weekTotal = me.week;

  const skipSummary = ranked.filter((m) => (m.skipDays ?? 0) > 0).map((m) => `${m.name} ${m.skipDays}`).join(', ');

  return (
    <ScreenContainer fadeOnFocus>
      <View style={styles.hero}>
        <Kicker style={{ color: colors.dim, marginBottom: 8 }}>
          EAT . SLEEP . PUSHUP . REPEAT
        </Kicker>
        <Text style={styles.heroName}>{me.name.toUpperCase()},</Text>
        {leading ? (
          <Text style={[styles.heroStatus, styles.heroStatusAcid]}>YOU&apos;RE LEADING.</Text>
        ) : (
          <Text style={[styles.heroStatus, styles.heroStatusBlood]}>
            YOU&apos;RE {behind} BEHIND.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Panel pad="md">
          <View style={styles.rowBetween}>
            <Kicker style={{ color: colors.dim }}>TODAY</Kicker>
            <Kicker style={{ color: colors.acid }}>
              GOAL {myDailyGoal}
            </Kicker>
          </View>
          <View style={styles.countCenter}>
            <HeroNumber value={me.today} size={120} />
            <Text style={styles.countSuffix}>/ {myDailyGoal} PUSHUPS</Text>
          </View>
          <ProgressBar progress={goalProgress} height={7} glow={goalMet} />
          <View style={[styles.rowBetween, { marginTop: 10, marginBottom: 14 }]}>
            <Text style={[styles.goalMeta, goalMet && { color: colors.acid }]}>
              {goalMet ? 'GOAL COMPLETE' : `${remaining} LEFT TODAY`}
            </Text>
            <Text style={styles.goalMeta}>
              RANK #{myRank}/{ranked.length}
            </Text>
          </View>
          <AcidButton label="+ LOG PUSHUPS" onPress={() => router.push('/(tabs)/log')} />
        </Panel>
      </View>

      <View style={[styles.section, { marginTop: 16 }]}>
        <View style={styles.sectionHead}>
          <Text style={styles.h2}>WHO&apos;S DELIVERING</Text>
        </View>
        {ranked.map((m, i) => {
          const memberGoal = m.dailyGoal ?? (m.isMe ? myDailyGoal : DEFAULT_DAILY_GOAL);
          const pct = memberGoal > 0 ? Math.min(m.today / memberGoal, 1) : 0;
          const percent = Math.round(pct * 100);
          const isLead = i === 0;
          return (
            <Panel key={m.id} pad="md" style={{ marginTop: 8 }}>
              <View style={styles.rankRow}>
                <Text style={styles.rankIdx}>{String(i + 1).padStart(2, '0')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {m.name.toUpperCase()}
                    {m.isMe ? <Text style={{ color: colors.acid }}> · YOU</Text> : null}
                  </Text>
                </View>
                <Text style={[styles.memberCount, isLead && { color: colors.acid }]}>
                  {m.today}
                </Text>
              </View>
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.memberGoalMeta}>{percent}% OF GOAL</Text>
                <Text style={styles.memberGoalMeta}>{memberGoal}/DAY</Text>
              </View>
              <View style={{ marginTop: 8 }}>
                <ProgressBar progress={pct} height={4} color={isLead ? colors.acid : colors.acidDim} />
              </View>
            </Panel>
          );
        })}
      </View>

      <View style={[styles.section, { marginTop: 16 }]}>
        <Panel variant="acid" pad="md">
          <Kicker style={{ marginBottom: 8 }}>// PERSONAL PACE / 7 DAYS</Kicker>
          <Text style={styles.challengeHeadline}>{weeklyGoal} IN 7 DAYS</Text>
          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Text style={styles.challengeMeta}>{weekTotal} / {weeklyGoal}</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar progress={weekTotal / weeklyGoal} height={6} glow />
          </View>
        </Panel>
      </View>

      <View style={[styles.section, { marginTop: 16, marginBottom: 8 }]}>
        <SkipPotPanel skipPotCents={crewMeta.skipPotCents} skipSummary={skipSummary} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 20,
  },
  heroName: {
    fontFamily: fonts.display,
    fontSize: 88,
    lineHeight: 88 * 1.05,
    paddingTop: 6,
    color: colors.text,
    letterSpacing: -1,
  },
  heroStatus: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  heroStatusAcid: {
    color: colors.acid,
    ...glows.acidText,
  },
  heroStatusBlood: {
    color: colors.blood,
    ...glows.bloodText,
  },
  section: {
    paddingHorizontal: spacing.screen,
  },
  sectionHead: {
    paddingBottom: 6,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countCenter: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  countSuffix: {
    marginTop: 2,
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 11,
    letterSpacing: 2,
  },
  goalMeta: {
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 11,
    letterSpacing: 1,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankIdx: {
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 12,
    width: 24,
    letterSpacing: 1,
  },
  memberName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.5,
  },
  memberCount: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
  },
  memberGoalMeta: {
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 10,
    letterSpacing: 1,
  },
  challengeHeadline: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    letterSpacing: 0.5,
  },
  challengeMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1,
  },
});
