import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Props = ViewProps & {
  variant?: 'default' | 'elevated' | 'acid' | 'blood-dashed';
  pad?: keyof typeof PADS;
  style?: ViewStyle | ViewStyle[];
};

const PADS = {
  none: 0,
  sm: 12,
  md: spacing.cardPad,
  lg: 22,
} as const;

export function Panel({ variant = 'default', pad = 'md', style, children, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'acid' && styles.acidBorder,
        variant === 'blood-dashed' && styles.bloodDashed,
        { padding: PADS[pad] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.panel2,
  },
  acidBorder: {
    borderColor: colors.acid,
    borderWidth: 2,
  },
  bloodDashed: {
    borderColor: colors.blood,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
});
