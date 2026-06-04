import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { useAppStore } from '@/state/useAppStore';
import { clampDisplayName } from '@/lib/displayName';
import { updateUserDisplayName } from '@/lib/auth';
import { onboardingPath, resolveOnboardingStep } from '@/lib/onboardingRoute';
import { supabaseConfigured } from '@/lib/supabase';
import { playTapSound } from '@/lib/tapSound';

export default function NameStep() {
  const router = useRouter();
  const profileName = useAppStore((s) => s.name);
  const nameConfirmed = useAppStore((s) => s.nameConfirmed);
  const onboarded = useAppStore((s) => s.onboarded);
  const hasCrew = useAppStore((s) => Boolean(s.crewMeta.id));
  const confirmProfileName = useAppStore((s) => s.confirmProfileName);
  const [draft, setDraft] = useState(profileName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileName) setDraft(profileName);
  }, [profileName]);

  // Returning users skip name setup (already in database).
  useEffect(() => {
    if (!nameConfirmed) return;
    const next = resolveOnboardingStep({
      session: true,
      onboarded,
      nameConfirmed: true,
      hasCrew,
    });
    router.replace(next ? onboardingPath(next) : '/(tabs)');
  }, [nameConfirmed, onboarded, hasCrew, router]);

  const trimmed = draft.trim();
  const canContinue = trimmed.length > 0;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    playTapSound();
    setError(null);
    setSaving(true);
    try {
      const display = clampDisplayName(draft);
      if (supabaseConfigured) {
        await updateUserDisplayName(display);
      }
      await confirmProfileName(display);
      router.push('/(onboarding)/crew');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your name';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      step={0}
      totalSteps={3}
      footer={
        <>
          <AcidButton
            label={saving ? 'SAVING…' : 'CONTINUE →'}
            disabled={!canContinue || saving}
            onPress={handleContinue}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
    >
      <Kicker style={styles.kicker}>// 00 / YOUR NAME</Kicker>
      <Text style={styles.headline}>WHAT SHOULD WE CALL YOU?</Text>
      <Text style={styles.subhead}>
        Pulled from your Google profile. Change it if you want — this is how your crew sees you.
      </Text>

      <View style={{ marginTop: 28 }}>
        <TextInput
          style={styles.nameInput}
          placeholder="Your name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={16}
          value={draft}
          onChangeText={setDraft}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
        />
        <Text style={styles.hint}>// MAX 16 CHARACTERS</Text>
      </View>
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
  subhead: {
    marginTop: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.dim,
  },
  nameInput: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    fontFamily: fonts.bodySemi,
    fontSize: 22,
    color: colors.text,
  },
  hint: {
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.blood,
    textAlign: 'center',
    lineHeight: 18,
  },
});
