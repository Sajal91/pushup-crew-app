import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  total: number;
  active: number; // zero-indexed
};

export function StepDots({ total, active }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === active ? styles.dotActive : styles.dotIdle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    backgroundColor: colors.acid,
  },
  dotIdle: {
    backgroundColor: colors.border,
  },
});
