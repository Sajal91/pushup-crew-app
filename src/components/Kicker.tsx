import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
};

/**
 * Mono kicker label used above every section.
 * The README convention is `// SOMETHING` — caller passes the text, we just style it.
 */
export function Kicker({ children, color = colors.acid, style }: Props) {
  return <Text style={[styles.text, { color }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
