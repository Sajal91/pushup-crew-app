import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, spacing } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { Panel } from '@/components/Panel';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { useAppStore } from '@/state/useAppStore';
import { supabaseConfigured } from '@/lib/supabase';
import {
  createMyCrew,
  generateInviteCode,
  joinCrewByInviteCode,
  normalizeInviteCode,
  previewCrewByInviteCode,
  type CrewPreview,
} from '@/lib/crewDb';
import { clampDisplayName } from '@/lib/displayName';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'join' | 'create';

export default function ManageCrewScreen() {
  const router = useRouter();
  const meName = useAppStore((s) => s.name);
  const crewMeta = useAppStore((s) => s.crewMeta);
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
  const isSameCrew =
    Boolean(crewMeta.inviteCode) &&
    normalizedCode.length >= 4 &&
    normalizedCode === normalizeInviteCode(crewMeta.inviteCode);
  const canContinue =
    mode === 'create' ? true : normalizedCode.length >= 4 && Boolean(preview) && !isSameCrew;

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
    if (!crewMeta.id) {
      router.replace('/(onboarding)/crew');
    }
  }, [crewMeta.id, router]);

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

  const handleSwitch = async () => {
    if (!canContinue || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const displayName = clampDisplayName(meName);
      const crewName = `${displayName || 'MY'}'S CREW`.toUpperCase();
      const snapshot =
        mode === 'create'
          ? await createMyCrew(crewName, generated)
          : await joinCrewByInviteCode(normalizedCode);
      applyCrewSnapshot(snapshot);
      router.replace('/(tabs)/you');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch crew');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(generated);
    alert('Copied!');
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
      footer={
        <>
          <AcidButton
            label={submitting ? 'SWITCHING…' : 'SWITCH CREW →'}
            disabled={!canContinue || submitting}
            onPress={handleSwitch}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      }
    >
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={colors.dim} />
        <Text style={styles.backLabel}>BACK</Text>
      </Pressable>

      <Kicker style={styles.kicker}>// CHANGE CREW</Kicker>
      <Text style={styles.headline}>JOIN OR CREATE A NEW CREW</Text>
      {crewMeta.name ? (
        <Text style={styles.currentCrew}>
          Currently in <Text style={styles.currentCrewName}>{crewMeta.name}</Text>. You will leave
          this crew when you continue.
        </Text>
      ) : null}

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
          {isSameCrew ? (
            <Text style={styles.error}>That is your current crew&apos;s code.</Text>
          ) : null}
          {previewLoading ? <ActivityIndicator color={colors.acid} /> : null}
          {previewError ? <Text style={styles.error}>{previewError}</Text> : null}
          {preview && !previewLoading && !isSameCrew ? (
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
            <Kicker style={{ marginBottom: 8 }}>// YOUR NEW CODE</Kicker>
            <Text style={styles.codeBig}>{generated}</Text>
          </Panel>
          <AcidButton label="📋 COPY CODE" variant="secondary" onPress={copyCode} />
          <Text style={styles.hint}>// YOUR OLD CREW STAYS FOR OTHER MEMBERS</Text>
        </View>
      )}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.dim,
  },
  kicker: { marginTop: 4, marginBottom: 16 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 50,
    paddingTop: 6,
    color: colors.text,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  currentCrew: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.dim,
    lineHeight: 20,
    paddingRight: spacing.screen,
  },
  currentCrewName: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
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
