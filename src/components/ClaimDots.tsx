import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  total: number;
  active: number;
};

export function ClaimDots({ total, active }: Props) {
  const compact = total > 8;

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            compact ? styles.dotCompact : styles.dot,
            i === active ? styles.dotActive : styles.dotIdle,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    rowGap: 8,
  },
  dot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  dotCompact: {
    width: 8,
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
