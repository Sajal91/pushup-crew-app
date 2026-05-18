import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { HeroNumber } from '@/components/HeroNumber';
import { AcidButton } from '@/components/AcidButton';
import { Chip } from '@/components/Chip';
import { useAppStore, selectMe } from '@/state/useAppStore';
import { XP_PER_PUSHUP } from '@/lib/mechanics';

const QUICK = [10, 20, 30, 50];

export default function LogScreen() {
  const router = useRouter();
  const me = useAppStore(selectMe);
  const logPushups = useAppStore((s) => s.logPushups);
  const [count, setCount] = useState(20);

  if (!me) return null;

  const newToday = me.today + count;
  const newXp = me.xp + count * XP_PER_PUSHUP;
  const willStartStreak = me.today === 0 && count > 0;

  const bump = (delta: number) => setCount((c) => Math.max(0, c + delta));

  const submit = () => {
    if (count <= 0) return;
    logPushups(count);
    // TODO(animation): trigger confetti + (if leveledUp) level-up overlay
    router.replace('/(tabs)');
  };

  return (
    <ScreenContainer>
      <View style={styles.head}>
        <Kicker style={{ color: colors.acid, marginBottom: 6 }}>// LOG // SET</Kicker>
        <Text style={styles.title}>WIE VIELE?</Text>
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
            onPress={() => bump(b.d)}
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
        {QUICK.map((q) => (
          <View key={q} style={{ flex: 1 }}>
            <Chip label={String(q)} selected={count === q} onPress={() => setCount(q)} />
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 18 }}>
        <AcidButton label="EINTRAGEN" onPress={submit} />
      </View>

      <View style={[{ paddingHorizontal: spacing.screen, marginTop: 16 }]}>
        <Panel pad="md">
          <Kicker style={{ marginBottom: 8 }}>// WIRD ZU</Kicker>
          <View style={styles.previewRow}>
            <PreviewCell label="HEUTE" current={me.today} next={newToday} />
            <PreviewCell label="XP" current={me.xp} next={newXp} />
            <PreviewCell
              label="STREAK"
              current={me.streak}
              next={willStartStreak ? me.streak + 1 : me.streak}
            />
          </View>
        </Panel>
      </View>
    </ScreenContainer>
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
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewCell: {
    flex: 1,
  },
  previewLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.dim,
  },
  previewValue: {
    marginTop: 4,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
