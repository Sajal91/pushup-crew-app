import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { Panel } from '@/components/Panel';
import { SegmentedToggle } from '@/components/SegmentedToggle';

type Mode = 'join' | 'create';

function randCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `GAINS-${s}`;
}

export default function CrewStep() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('join');
  const [code, setCode] = useState('');
  const generated = useMemo(randCode, []);

  const canContinue = mode === 'create' ? true : code.trim().length >= 4;

  return (
    <OnboardingScreen
      step={2}
      footer={
        <AcidButton
          label="WEITER →"
          disabled={!canContinue}
          onPress={() => router.push('/(onboarding)/goal')}
        />
      }
    >
      <Kicker style={styles.kicker}>// 02 / DEINE CREW</Kicker>
      <Text style={styles.headline}>WER LEIDET MIT DIR?</Text>

      <View style={{ marginTop: 24 }}>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: 'join', label: 'BEITRETEN' },
            { value: 'create', label: 'NEU ERSTELLEN' },
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
          {code.length >= 4 ? (
            <Panel pad="md">
              <Text style={styles.previewName}>DIE BROS · 3 MITGLIEDER</Text>
              <Text style={styles.previewList}>Daniel · Sascha · (du)</Text>
            </Panel>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 20, gap: 14 }}>
          <Panel variant="acid" pad="md" style={styles.codeBox}>
            <Kicker style={{ marginBottom: 8 }}>// DEIN CODE</Kicker>
            <Text style={styles.codeBig}>{generated}</Text>
          </Panel>
          <AcidButton
            label="📋 CODE KOPIEREN"
            variant="secondary"
            onPress={() => {
              // TODO(clipboard): use expo-clipboard to copy `generated`
            }}
          />
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
});
