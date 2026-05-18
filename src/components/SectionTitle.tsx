import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Kicker } from './Kicker';

type Props = {
  kicker?: string;
  children: React.ReactNode;
};

/**
 * Standard section header used on most screens.
 * `// KICKER` line in mono acid + Anton uppercase headline.
 */
export function SectionTitle({ kicker, children }: Props) {
  return (
    <View style={styles.wrap}>
      {kicker ? <Kicker style={{ marginBottom: 6 }}>{`// ${kicker}`}</Kicker> : null}
      <Text style={styles.heading}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 8,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    paddingTop: 4,
    letterSpacing: 0.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
});
