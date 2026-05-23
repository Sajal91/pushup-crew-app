import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { ProgressBar } from '@/components/ProgressBar';
import { SectionTitle } from '@/components/SectionTitle';
import { AcidButton } from '@/components/AcidButton';
import { useAppStore, selectMe } from '@/state/useAppStore';
import { useAuth } from '@/providers/AuthProvider';
import { XP_PER_LEVEL, xpInLevel, levelFromXp, levelProgress } from '@/lib/mechanics';

type Badge = {
  id: string;
  label: string;
  caption: string;
  unlocked: boolean;
};

export default function YouScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useAppStore(selectMe);
  const [signingOut, setSigningOut] = useState(false);

  if (!me) return null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(onboarding)/welcome');
    } finally {
      setSigningOut(false);
    }
  };

  const lvl = levelFromXp(me.xp);
  const inLevel = xpInLevel(me.xp);
  const progress = levelProgress(me.xp);

  const badges: Badge[] = [
    { id: '7d',   label: '7-DAY',   caption: 'STREAK',   unlocked: me.streak >= 7 },
    { id: '14d',  label: '14-DAY',  caption: 'STREAK',   unlocked: me.streak >= 14 },
    { id: '500',  label: '500',     caption: 'LIFETIME', unlocked: me.total >= 500 },
    { id: '5k',   label: '5K',      caption: 'LIFETIME', unlocked: me.total >= 5000 },
    { id: '10k',  label: '10K',     caption: 'LIFETIME', unlocked: me.total >= 10000 },
    { id: 'top',  label: 'TOPDOG',  caption: 'WEEK 1ST', unlocked: false },
  ];

  return (
    <ScreenContainer>
      <SectionTitle kicker="PROFILE">{me.name}</SectionTitle>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 8 }}>
        <Panel pad="md">
          <View style={styles.rowBetween}>
            <Kicker style={{ color: colors.dim }}>LEVEL</Kicker>
            <Kicker style={{ color: colors.dim }}>
              {inLevel} / {XP_PER_LEVEL} XP
            </Kicker>
          </View>
          <View style={styles.levelCenter}>
            <Text style={styles.levelNum}>{lvl}</Text>
            <Text style={styles.levelNext}>next → {lvl + 1}</Text>
          </View>
          <ProgressBar progress={progress} height={6} glow />
        </Panel>
      </View>

      <View style={[styles.grid, { paddingHorizontal: spacing.screen, marginTop: 12 }]}>
        <Stat label="STREAK" value={`${me.streak}D`} />
        <Stat label="TODAY" value={String(me.today)} />
        <Stat label="WEEK" value={String(me.week)} />
        <Stat label="TOTAL" value={String(me.total)} />
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 12 }}>
        <Text style={styles.sectionH}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeCol}>
              <Panel
                variant={b.unlocked ? 'acid' : 'default'}
                pad="sm"
                style={[styles.badge, !b.unlocked && { opacity: 0.45 }]}
              >
                <Text
                  style={[
                    styles.badgeLabel,
                    b.unlocked && { color: colors.acid, ...glows.acidText },
                  ]}
                >
                  {b.label}
                </Text>
                <Text style={styles.badgeCaption}>{b.caption}</Text>
              </Panel>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.signOutWrap}>
        <AcidButton
          label={signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}
          variant="danger"
          disabled={signingOut}
          onPress={handleSignOut}
        />
      </View>

      <Text style={styles.signOff}>NO DAYS OFF.</Text>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Panel pad="md">
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelCenter: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  levelNum: {
    fontFamily: fonts.display,
    fontSize: 96,
    color: colors.acid,
    ...glows.acidText,
    letterSpacing: -1,
  },
  levelNext: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
    marginTop: -4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCol: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.dim,
  },
  statValue: {
    marginTop: 6,
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
  },
  sectionH: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCol: {
    flexBasis: '31%',
    flexGrow: 1,
  },
  badge: {
    alignItems: 'center',
  },
  badgeLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.dim,
  },
  badgeCaption: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.dim,
  },
  signOutWrap: {
    marginTop: 28,
    paddingHorizontal: spacing.screen,
  },
  signOff: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.dim,
    letterSpacing: 2,
  },
});
