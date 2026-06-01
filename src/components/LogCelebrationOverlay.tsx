import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, glows } from '@/theme';
import { HeroNumber } from '@/components/HeroNumber';

const LOG_ANIMATION_MS = 2500;

type Props = {
  count: number;
  visible: boolean;
};

export function logCelebrationDurationMs() {
  return LOG_ANIMATION_MS;
}

export function LogCelebrationOverlay({ count, visible }: Props) {
  const ringScale = useSharedValue(0.85);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withTiming(0.85, { duration: 0 })
      ),
      -1,
      false
    );
    progress.value = 0;
    progress.value = withTiming(1, { duration: LOG_ANIMATION_MS, easing: Easing.inOut(Easing.cubic) });
  }, [visible, ringScale, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: 0.35 - ringScale.value * 0.08,
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: progress.value * 200,
  }));

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.overlay} pointerEvents="box-only">
      <View style={styles.center}>
        {/* <Animated.View style={[styles.ring, ringStyle]} /> */}
        <Animated.View entering={FadeInUp.duration(400).springify()}>
          <Text style={styles.kicker}>LOGGED</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(80).duration(450).springify()}>
          <HeroNumber value={`${count}`} size={140} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200).duration(400)} style={styles.sub}>
          PUSHUPS COUNTED
        </Animated.Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
        <Animated.Text entering={FadeIn.delay(350).duration(400)} style={styles.hint}>
          UPDATING CREW…
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: colors.acid,
    ...glows.acidText,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.acid,
    marginBottom: 8,
  },
  sub: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.dim,
  },
  track: {
    marginTop: 28,
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.panel2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.acid,
    borderRadius: 2,
    ...glows.acidButton,
  },
  hint: {
    marginTop: 14,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.dim,
  },
});
