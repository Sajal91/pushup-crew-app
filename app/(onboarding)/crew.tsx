import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { Panel } from '@/components/Panel';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { useAppStore } from '@/state/useAppStore';
import { useAuth } from '@/providers/AuthProvider';
import { supabaseConfigured } from '@/lib/supabase';
import {
  createMyCrew,
  generateInviteCode,
  joinCrewByInviteCode,
  normalizeInviteCode,
  previewCrewByInviteCode,
  upsertMyProfile,
  type CrewPreview,
} from '@/lib/crewDb';
import { clampDisplayName } from '@/lib/displayName';

type Mode = 'join' | 'create';

export default function CrewStep() {
  const router = useRouter();
  const { session } = useAuth();
  const meName = useAppStore((s) => s.name);
  const nameConfirmed = useAppStore((s) => s.nameConfirmed);
  const applyCrewSnapshot = useAppStore((s) => s.applyCrewSnapshot);
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const [generated] = useState(generateInviteCode);
  const [preview, setPreview] = useState<CrewPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => normalizeInviteCode(code), [code]);
  const canContinue =
    mode === 'create' ? true : normalizedCode.length >= 4 && Boolean(preview);

  const loadPreview = useCallback(async (inviteCode: string) => {
    if (!supabaseConfigured || inviteCode.length < 4) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await previewCrewByInviteCode(inviteCode);
      if (!result) {
        setPreview(null);
        setPreviewError('No crew found with that code.');
        return;
      }
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Could not load crew');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (supabaseConfigured && !session) {
      router.replace('/(onboarding)/welcome');
      return;
    }
    if (supabaseConfigured && !nameConfirmed) {
      router.replace('/(onboarding)/name');
    }
  }, [session, nameConfirmed, router]);

  useEffect(() => {
    if (mode !== 'join') {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const timer = setTimeout(() => {
      void loadPreview(normalizedCode);
    }, 350);
    return () => clearTimeout(timer);
  }, [mode, normalizedCode, loadPreview]);

  const handleContinue = async () => {
    if (!canContinue || submitting) return;
    setError(null);

    if (!supabaseConfigured) {
      router.push('/(onboarding)/goal');
      return;
    }

    setSubmitting(true);
    try {
      const displayName = clampDisplayName(meName);
      await upsertMyProfile(displayName);

      const crewName = `${displayName || 'MY'}'S CREW`.toUpperCase();
      const snapshot =
        mode === 'create'
          ? await createMyCrew(crewName, generated)
          : await joinCrewByInviteCode(normalizedCode);
      applyCrewSnapshot(snapshot);
      router.push('/(onboarding)/goal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join crew');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    // TODO(clipboard): add expo-clipboard to copy `generated`
  };

  const previewNames = preview?.memberNames ?? [];
  const previewLine =
    previewNames.length > 0
      ? [...previewNames, meName || 'you'].join(' · ')
      : meName
        ? meName
        : 'you';

  return (
    <OnboardingScreen
      step={1}
      totalSteps={3}
      footer={
        <>
          <AcidButton
            label={submitting ? 'SAVING…' : 'CONTINUE →'}
            disabled={!canContinue || submitting}
            onPress={handleContinue}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
    >
      <Kicker style={styles.kicker}>// 02 / YOUR CREW</Kicker>
      <Text style={styles.headline}>WHO&apos;S SUFFERING WITH YOU?</Text>

      <View style={{ marginTop: 24 }}>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: 'join', label: 'JOIN' },
            { value: 'create', label: 'CREATE NEW' },
          ]}
        />
      </View>

      {mode === 'join' ? (
        <View style={{ marginTop: 20, gap: 14 }}>
          <TextInput
            style={styles.codeInput}
            placeholder="GAINS-XXXX"
            placeholderTextColor={colors.dim}
            autoCapitalize="characters"
            maxLength={10}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
          />
          {previewLoading ? (
            <ActivityIndicator color={colors.acid} />
          ) : null}
          {previewError ? <Text style={styles.error}>{previewError}</Text> : null}
          {preview && !previewLoading ? (
            <Panel pad="md">
              <Text style={styles.previewName}>
                {preview.name} · {preview.memberCount} MEMBER
                {preview.memberCount === 1 ? '' : 'S'}
              </Text>
              <Text style={styles.previewList}>{previewLine}</Text>
            </Panel>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 20, gap: 14 }}>
          <Panel variant="acid" pad="md" style={styles.codeBox}>
            <Kicker style={{ marginBottom: 8 }}>// YOUR CODE</Kicker>
            <Text style={styles.codeBig}>{generated}</Text>
          </Panel>
          <AcidButton label="📋 COPY CODE" variant="secondary" onPress={copyCode} />
          <Text style={styles.hint}>// SHARE THIS CODE SO YOUR CREW CAN JOIN</Text>
        </View>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginTop: 12, marginBottom: 16 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 62,
    paddingTop: 6,
    color: colors.text,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  codeInput: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 4,
    color: colors.text,
    textTransform: 'uppercase',
  },
  previewName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
  },
  previewList: {
    marginTop: 4,
    fontFamily: fonts.mono,
    color: colors.dim,
    fontSize: 12,
  },
  codeBox: {
    alignItems: 'center',
    shadowColor: colors.acid,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  codeBig: {
    fontFamily: fonts.display,
    fontSize: 36,
    letterSpacing: 6,
    color: colors.acid,
    textShadowColor: colors.acidGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.blood,
    textAlign: 'center',
    lineHeight: 18,
  },
});
