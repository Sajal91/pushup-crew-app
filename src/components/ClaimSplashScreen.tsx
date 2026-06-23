import React, { useState } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CLAIMS, pickRandomClaimIndex } from '@/lib/claims';
import { colors, spacing } from '@/theme';
import { ClaimPager } from './ClaimPager';
import { ClaimDots } from './ClaimDots';
import { Kicker } from './Kicker';

type Props = ViewProps;

export function ClaimSplashScreen({ style, ...rest }: Props) {
  const [activeClaimIndex, setActiveClaimIndex] = useState(pickRandomClaimIndex);

  return (
    <SafeAreaView style={[styles.safe, style]} {...rest}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.content}>
        <Kicker style={styles.kicker}>// PUSHUPCREW / V1.0</Kicker>
        <View style={styles.claimArea}>
          <ClaimPager
            initialIndex={activeClaimIndex}
            autoScroll
            onActiveIndexChange={setActiveClaimIndex}
          />
        </View>
        <ClaimDots total={CLAIMS.length} active={activeClaimIndex} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glow: {
    position: 'absolute',
    top: -80,
    left: '20%',
    right: '20%',
    height: 200,
    borderRadius: 200,
    backgroundColor: colors.acidGlowSoft,
    opacity: 0.6,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 28,
    paddingBottom: 40,
  },
  kicker: {
    marginBottom: 24,
  },
  claimArea: {
    flex: 1,
    justifyContent: 'center',
  },
});
