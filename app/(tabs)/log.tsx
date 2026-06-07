import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { HeroNumber } from '@/components/HeroNumber';
import { AcidButton } from '@/components/AcidButton';
import { Chip } from '@/components/Chip';
import { ProgressBar } from '@/components/ProgressBar';
import {
  LogCelebrationOverlay,
  logCelebrationDurationMs,
} from '@/components/LogCelebrationOverlay';
import { useAppStore, selectMe } from '@/state/useAppStore';
import { XP_PER_PUSHUP } from '@/lib/mechanics';
import { withTapSound } from '@/lib/tapSound';

const QUICK = [10, 20, 30, 50];

export default function LogScreen() {
  const router = useRouter();
  const me = useAppStore(selectMe);
  const logPushups = useAppStore((s) => s.logPushups);
  const dailyGoal = useAppStore((s) => s.dailyGoal);
  const [count, setCount] = useState(20);
  const [isLogging, setIsLogging] = useState(false);
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    };
  }, []);

  if (!me) return null;

  const goal = me.dailyGoal ?? dailyGoal;
  const remainingNow = Math.max(0, goal - me.today);
  const newToday = me.today + count;
  const newRemaining = Math.max(0, goal - newToday);
  const newGoalProgress = goal > 0 ? Math.min(newToday / goal, 1) : 0;
  const newXp = me.xp + count * XP_PER_PUSHUP;
  const willHitGoal = me.today < goal && newToday >= goal;
  const quickValues =
    remainingNow > 0 && !QUICK.includes(remainingNow)
      ? [remainingNow, ...QUICK.slice(0, 3)]
      : QUICK;

  const bump = (delta: number) => setCount((c) => Math.max(0, c + delta));

  const submit = () => {
    if (count <= 0 || isLogging) return;
    logPushups(count);
    setIsLogging(true);
    navigateTimer.current = setTimeout(() => {
      router.replace('/(tabs)');
      setIsLogging(false);
    }, logCelebrationDurationMs());
  };

  return (
    <View style={styles.root}>
      <ScreenContainer fadeOnFocus scrollEnabled={!isLogging}>
        <View style={styles.head}>
          <Kicker style={{ color: colors.acid, marginBottom: 6 }}>LOG</Kicker>
          <Text style={styles.title}>HOW MANY?</Text>
        </View>

        <View style={styles.displayWrap}>
          <HeroNumber value={count} size={160} />
          <Text style={styles.pushupsLabel}>PUSHUPS</Text>
        </View>

        <View style={styles.dialRow}>
          {[
            { l: '−5', d: -5, primary: false },
            { l: '−1', d: -1, primary: false },
            { l: '+1', d: 1, primary: true },
            { l: '+5', d: 5, primary: true },
          ].map((b) => (
            <Pressable
              key={b.l}
              onPress={withTapSound(() => bump(b.d))}
              disabled={isLogging}
              style={({ pressed }) => [
                styles.dial,
                b.primary && styles.dialPrimary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={[styles.dialLabel, b.primary && { color: '#000' }]}>{b.l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.quickRow}>
          {quickValues.map((q) => (
            <View key={q} style={{ flex: 1 }}>
              <Chip
                label={q === remainingNow ? 'FINISH' : String(q)}
                selected={count === q}
                onPress={isLogging ? undefined : () => setCount(q)}
              />
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.screen, marginTop: 18 }}>
          <AcidButton label="LOG IT" onPress={submit} disabled={isLogging} />
        </View>

        <View style={[{ paddingHorizontal: spacing.screen, marginTop: 16 }]}>
          <Panel pad="md">
            <Kicker style={{ marginBottom: 8 }}>// BECOMES</Kicker>
            <View style={styles.goalPreview}>
              <View style={styles.goalPreviewHead}>
                <Text style={styles.goalPreviewText}>
                  {newToday} / {goal} TODAY
                </Text>
                <Text style={[styles.goalPreviewText, newRemaining === 0 && { color: colors.acid }]}>
                  {newRemaining === 0 ? 'GOAL HIT' : `${newRemaining} LEFT`}
                </Text>
              </View>
              <ProgressBar progress={newGoalProgress} height={6} glow={newRemaining === 0} />
            </View>
            <View style={styles.previewRow}>
              <PreviewCell label="TODAY" current={me.today} next={newToday} />
              <PreviewCell label="XP" current={me.xp} next={newXp} />
              <PreviewCell
                label="STREAK"
                current={me.streak}
                next={willHitGoal ? me.streak + 1 : me.streak}
              />
            </View>
          </Panel>
        </View>
      </ScreenContainer>
      <LogCelebrationOverlay count={count} visible={isLogging} />
    </View>
  );
}

function PreviewCell({ label, current, next }: { label: string; current: number; next: number }) {
  const changed = current !== next;
  return (
    <View style={styles.previewCell}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>
        <Text style={{ color: colors.dim }}>{current} → </Text>
        <Text style={{ color: changed ? colors.acid : colors.text }}>{next}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  head: {
    paddingHorizontal: spacing.screen,
    paddingTop: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: 0.5,
  },
  displayWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pushupsLabel: {
    marginTop: 4,
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 11,
    letterSpacing: 3,
  },
  dialRow: {
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  dial: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialPrimary: {
    backgroundColor: colors.acid,
    borderColor: colors.acid,
    ...glows.acidButton,
  },
  dialLabel: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  quickRow: {
    marginTop: 14,
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    gap: 8,
  },
  goalPreview: {
    marginBottom: 14,
  },
  goalPreviewHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalPreviewText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.dim,
  },
  previewRow: {
    marginTop: 10,
    display: 'flex',
    gap: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewCell: {
    // flex: 1,
  },
  previewLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.dim,
    textAlign:'center'
  },
  previewValue: {
    textAlign: 'center',
    marginTop: 4,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
