import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { Panel } from '@/components/Panel';
import { HeroNumber } from '@/components/HeroNumber';
import { Chip } from '@/components/Chip';
import { useAppStore } from '@/state/useAppStore';
import { DEFAULT_DAILY_GOAL } from '@/lib/mechanics';
import { withTapSound } from '@/lib/tapSound';

const PRESETS = [50, 100, 150, 200];

export default function GoalStep() {
  const router = useRouter();
  const setDailyGoal = useAppStore((s) => s.setDailyGoal);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const initial = useAppStore((s) => s.dailyGoal) || DEFAULT_DAILY_GOAL;
  const [goal, setGoal] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step buttons act as a +/- coarse slider (real slider would need @react-native-community/slider)
  const bump = (delta: number) => setGoal((g) => Math.max(1, g + delta));

  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await setDailyGoal(goal);
      await completeOnboarding();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      step={2}
      totalSteps={3}
      footer={
        <AcidButton
          label={saving ? 'STARTING…' : "LET'S GO →"}
          disabled={saving}
          onPress={handleContinue}
        />
      }
    >
      <Kicker style={styles.kicker}>// 03 / DAILY GOAL</Kicker>
      <Text style={styles.headline}>HOW MANY PER DAY?</Text>

      <Panel pad="lg" style={styles.goalCard}>
        <HeroNumber value={goal} size={130} />
        <Text style={styles.suffix}>/ pushups</Text>
      </Panel>

      <View style={styles.stepRow}>
        <Pressable style={styles.stepBtn} onPress={withTapSound(() => bump(-10))}>
          <Text style={styles.stepLabel}>−10</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={withTapSound(() => bump(-1))}>
          <Text style={styles.stepLabel}>−1</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={withTapSound(() => bump(1))}>
          <Text style={styles.stepLabel}>+1</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={withTapSound(() => bump(10))}>
          <Text style={styles.stepLabel}>+10</Text>
        </Pressable>
      </View>

      <View style={styles.presetGrid}>
        {PRESETS.map((p) => (
          <View key={p} style={{ flexBasis: '23%' }}>
            <Chip label={String(p)} selected={goal === p} onPress={() => setGoal(p)} />
          </View>
        ))}
      </View>

      <Text style={styles.note}>{`// REMINDER: DAILY AT 18:00`}</Text>
      <Text style={styles.note}>{`// SKIP DAY = €1 IN THE CREW POT`}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginTop: 12, marginBottom: 16 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 56,
    paddingTop: 4,
    color: colors.text,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  goalCard: {
    marginTop: 28,
    alignItems: 'center',
    paddingVertical: 28,
  },
  suffix: {
    marginTop: 4,
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 12,
    letterSpacing: 2,
  },
  stepRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  stepLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  presetGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  note: {
    marginTop: 14,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
  },
  error: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.blood,
    lineHeight: 18,
  },
});
