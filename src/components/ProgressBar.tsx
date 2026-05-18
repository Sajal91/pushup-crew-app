import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  /** 0..1 */
  progress: number;
  height?: number;
  color?: string;
  bg?: string;
  glow?: boolean;
};

export function ProgressBar({
  progress,
  height = 6,
  color = colors.acid,
  bg = colors.panel2,
  glow = false,
}: Props) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height, backgroundColor: bg }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${pct * 100}%`,
            backgroundColor: color,
            shadowColor: glow ? color : 'transparent',
            shadowOpacity: glow ? 0.7 : 0,
            shadowRadius: glow ? 8 : 0,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
