import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import { colors, fonts, radius, glows } from '@/theme';
import { withTapSound } from '@/lib/tapSound';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Skip tap sound (e.g. not needed when wrapped elsewhere). */
  silent?: boolean;
  style?: ViewStyle;
};

export function AcidButton({
  label,
  variant = 'primary',
  disabled,
  fullWidth = true,
  silent = false,
  style,
  onPress,
  ...rest
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={disabled ? undefined : silent ? onPress : withTapSound(onPress)}
      style={({ pressed }) => [
        styles.base,
        fullWidth && { alignSelf: 'stretch' },
        isPrimary && styles.primary,
        isPrimary && !disabled && glows.acidButton,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        isDanger && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          isGhost ? styles.labelGhost : null,
          isPrimary || isDanger ? styles.labelOnAcid : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.acid,
  },
  secondary: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.blood,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  labelOnAcid: {
    color: '#000',
  },
  labelGhost: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.dim,
  },
});
