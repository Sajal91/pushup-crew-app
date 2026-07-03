import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logos } from '@/assets/logos';
import { colors, fonts, glows } from '@/theme';

const FADE_CYCLE_MS = 1400;

export function GoogleAuthLoadingScreen() {
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    textOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: FADE_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: FADE_CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [textOpacity]);

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View pointerEvents="none" />
          <View style={styles.iconFrame}>
            <Image source={logos.glyphAcid} style={styles.glyph} resizeMode="contain" />
          </View>
        </View>

        <Animated.View style={[styles.wordmark, textFadeStyle]}>
          <Text style={styles.pushup}>PUSHUP</Text>
          <Text style={styles.crew}>CREW</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const GLYPH_SIZE = 112;
const FRAME_SIZE = 148;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  iconGlow: {
    position: 'absolute',
    width: FRAME_SIZE + 72,
    height: FRAME_SIZE + 72,
    borderRadius: (FRAME_SIZE + 72) / 2,
    backgroundColor: colors.acidGlow,
    opacity: 0.35,
  },
  iconFrame: {
    // width: FRAME_SIZE,
    // height: FRAME_SIZE,
    borderRadius: 28,
    // backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    // borderWidth: 1,
    // borderColor: colors.border,
    // shadowColor: colors.acid,
    // shadowOffset: { width: 0, height: 0 },
    // shadowOpacity: 0.55,
    // shadowRadius: 28,
    elevation: 12,
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  wordmark: {
    alignItems: 'center',
    gap: 2,
  },
  pushup: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: 1.5,
    color: colors.text,
  },
  crew: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: 1.5,
    color: colors.acid,
    ...glows.acidText,
    textShadowRadius: 24,
  },
});
