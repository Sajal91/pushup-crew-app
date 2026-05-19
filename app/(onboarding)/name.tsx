import React, { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/theme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { AcidButton } from '@/components/AcidButton';
import { Kicker } from '@/components/Kicker';
import { useAppStore } from '@/state/useAppStore';

const MAX_NAME = 16;

export default function NameStep() {
  const router = useRouter();
  const setName = useAppStore((s) => s.setName);
  const initial = useAppStore((s) => s.name);
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);

  const valid = value.trim().length > 0;

  return (
    <OnboardingScreen
      step={1}
      footer={
        <AcidButton
          label="CONTINUE →"
          disabled={!valid}
          onPress={() => {
            setName(value.trim());
            router.push('/(onboarding)/crew');
          }}
        />
      }
    >
      <Kicker style={styles.kicker}>// 01 / WHO ARE YOU</Kicker>
      <Text style={styles.headline}>WHAT&apos;S YOUR NAME, BRO?</Text>
      <Text style={styles.subhead}>This is how your crew sees you on the leaderboard and in chat.</Text>

      <TextInput
        style={[
          styles.input,
          focused && { borderBottomColor: colors.acid, borderBottomWidth: 2 },
        ]}
        placeholder="NIK"
        placeholderTextColor={colors.dim}
        autoCapitalize="characters"
        maxLength={MAX_NAME}
        value={value}
        onChangeText={setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Text style={styles.hint}>{`// ${value.length}/${MAX_NAME} CHARS`}</Text>
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
  subhead: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.dim,
  },
  input: {
    marginTop: 36,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  hint: {
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
  },
});
