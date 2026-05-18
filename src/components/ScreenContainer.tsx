import React from 'react';
import { ScrollView, View, StyleSheet, ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type Props = ScrollViewProps & {
  children: React.ReactNode;
};

/**
 * Standard scrollable container used inside the tab screens.
 * Bottom padding accounts for the floating tab bar (~92px).
 */
export function ScreenContainer({ children, contentContainerStyle, ...rest }: Props) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView
        {...rest}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 140,
  },
});
