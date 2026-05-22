import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors, fonts, glows } from '@/theme';

type Props = {
  value: number | string;
  size?: number;
  color?: string;
  glow?: boolean;
  style?: TextStyle;
};

export function HeroNumber({
  value,
  size = 120,
  color = colors.acid,
  glow = true,
  style,
}: Props) {
  return (
    <Text
      // Anton has tall ascenders that clip with line-heights below ~1.15.
      // We also add a tiny paddingTop on iOS because the OS still trims
      // the very top pixel of the glyph cap on big sizes.
      style={[
        {
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: size * 1.15,
          paddingTop: size * 0.08,
          includeFontPadding: false,
          color,
          letterSpacing: -1,
        },
        glow && (color === colors.blood ? glows.bloodText : glows.acidText),
        style,
      ]}
    >
      {value}
    </Text>
  );
}

export const styles = StyleSheet.create({});
