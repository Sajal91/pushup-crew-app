import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Panel } from '@/components/Panel';
import { SectionTitle } from '@/components/SectionTitle';
import { regionLabel } from '@/lib/regions';
import type { RegionalCrewRank } from '@/types';

type Mode = 'today' | 'week';

type Props = {
  mode: Mode;
  regionId?: string;
  rankings: RegionalCrewRank[];
};

export function RegionalCrewRanking({ mode, regionId, rankings }: Props) {
  if (rankings.length === 0) return null;

  const areaLabel = regionLabel(regionId);

  return (
    <View style={styles.wrap}>
      <SectionTitle kicker={`// ${areaLabel}`}>REGION WISE RANKING</SectionTitle>

      <View style={styles.list}>
        {rankings.map((crew, index) => {
          const value = mode === 'today' ? crew.today : crew.week;
          const isMine = !!crew.isMine;
          const isLead = index === 0;

          return (
            <Panel key={crew.id} variant={isMine ? 'acid' : 'default'} pad="md">
              <View style={styles.row}>
                <Text style={[styles.rank, isLead && { color: colors.acid }]}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {crew.name.toUpperCase()}
                    {isMine ? <Text style={{ color: colors.acid }}> · YOUR CREW</Text> : null}
                  </Text>
                  <Text style={styles.meta}>
                    {crew.memberCount} MEMBER{crew.memberCount === 1 ? '' : 'S'}
                  </Text>
                </View>
                <Text style={[styles.value, isLead && { color: colors.acid }]}>{value}</Text>
              </View>
            </Panel>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 60,
  },
  list: {
    paddingHorizontal: spacing.screen,
    marginTop: 14,
    gap: 10,
  },
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
});
