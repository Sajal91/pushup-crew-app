import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { Sparkline } from '@/components/Sparkline';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { SectionTitle } from '@/components/SectionTitle';
import {
  useAppStore,
  selectRankedByToday,
  selectRankedByWeek,
} from '@/state/useAppStore';
import { weekFor } from '@/state/seed';
import { formatEuro } from '@/lib/mechanics';

type Mode = 'today' | 'week';

export default function RankScreen() {
  const [mode, setMode] = useState<Mode>('today');
  const ranked = useAppStore(mode === 'today' ? selectRankedByToday : selectRankedByWeek);
  const crewMeta = useAppStore((s) => s.crewMeta);

  return (
    <ScreenContainer>
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
          const isMe = !!m.isMe;
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
                    LVL {m.level} · {m.streak}D STREAK
                  </Text>
                </View>
                <Text style={[styles.value, i === 0 && { color: colors.acid }]}>
                  {value}
                </Text>
              </View>
              <View style={{ marginTop: 8 }}>
                <Sparkline
                  data={weekFor(m.id)}
                  color={isMe ? colors.acid : colors.acidDim}
                  width={280}
                  height={56}
                />
              </View>
            </Panel>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 18 }}>
        <Panel variant="blood-dashed" pad="md">
          <Kicker style={{ color: colors.blood, marginBottom: 6 }}>// SKIP POT</Kicker>
          <Text style={styles.potValue}>{formatEuro(crewMeta.skipPotCents)}</Text>
          <Text style={styles.potNote}>
            Skip days: Nik 1, Sascha 2. Each skip = €1.
          </Text>
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
  value: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
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
