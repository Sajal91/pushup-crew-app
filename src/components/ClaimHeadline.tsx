import React from 'react';
import { Text, StyleSheet, View, ViewStyle } from 'react-native';
import { Claim, claimFontSize } from '@/lib/claims';
import { colors, fonts, glows } from '@/theme';

type Props = {
  claim: Claim;
  style?: ViewStyle;
};

export function ClaimHeadline({ claim, style }: Props) {
  const size = claimFontSize(claim.lines);
  const lineHeight = size + 6;

  return (
    <View style={style}>
      {claim.lines.map((line, index) => (
        <Text
          key={`${claim.id}-${index}`}
          style={[
            styles.line,
            { fontSize: size, lineHeight },
            line.accent ? styles.accent : null,
          ]}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: fonts.display,
    paddingTop: 4,
    color: colors.text,
    letterSpacing: -1,
  },
  accent: {
    color: colors.acid,
    ...glows.acidText,
  },
});
