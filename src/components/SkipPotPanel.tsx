import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, glows } from '@/theme';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { HeroNumber } from '@/components/HeroNumber';
import { formatEuro, SKIP_PENALTY } from '@/lib/mechanics';

type Props = {
  skipPotCents: number;
  skipSummary?: string;
};

export function SkipPotPanel({ skipPotCents, skipSummary }: Props) {
  const note = skipSummary
    ? `Skip days: ${skipSummary}. €${SKIP_PENALTY} each — charged at settlement.`
    : `Miss your daily goal → €${SKIP_PENALTY} added. Charged from your account at settlement.`;

  return (
    <Panel variant="blood-dashed" pad="lg" style={styles.heroPanel}>
      <Kicker style={{ marginBottom: 4 }} color={"#e6e783"} >// CREW POT</Kicker>
      <Text style={styles.stakesLabel}>REAL MONEY · €{SKIP_PENALTY} PER SKIP</Text>
      <View style={styles.amountWrap}>
        <HeroNumber value={formatEuro(skipPotCents)} size={88} color={"#e6e783"} />
      </View>
      <Text style={styles.note}>{note}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  heroPanel: {
    ...glows.card,
    borderWidth: 2,
    borderColor: "#e6e783"
  },
  kicker: {
    color: "#e6e783",
  },
  stakesLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: "#e6e783",
    opacity: 0.85,
  },
  amountWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  note: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    lineHeight: 16,
    color: colors.dim,
  },
});
