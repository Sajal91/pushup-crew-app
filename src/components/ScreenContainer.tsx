import React, { useCallback } from 'react';
import { ScrollView, View, StyleSheet, ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '@/theme';

type Props = ScrollViewProps & {
  children: React.ReactNode;
  /** Subtle fade + slide when the tab gains focus */
  fadeOnFocus?: boolean;
};

/**
 * Standard scrollable container used inside the tab screens.
 * Bottom padding accounts for the floating tab bar (~92px).
 */
export function ScreenContainer({
  children,
  contentContainerStyle,
  fadeOnFocus = false,
  ...rest
}: Props) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (!fadeOnFocus) return;
      opacity.value = 0;
      translateY.value = 10;
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    }, [fadeOnFocus, opacity, translateY])
  );

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const scroll = (
    <ScrollView
      {...rest}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <View>{children}</View>
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {fadeOnFocus ? (
        <Animated.View style={[styles.fadeWrap, fadeStyle]}>{scroll}</Animated.View>
      ) : (
        scroll
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fadeWrap: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 140,
  },
});
