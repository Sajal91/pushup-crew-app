import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { StepDots } from './StepDots';
import { preloadTapSound } from '@/lib/tapSound';

type Props = {
  step?: number;
  totalSteps?: number;
  scroll?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Common onboarding chrome: status-area, optional step dots, scrollable content,
 * footer (CTA + optional secondary action).
 */
export function OnboardingScreen({ step, totalSteps = 2, scroll = true, children, footer }: Props) {
  const showDots = step !== undefined;

  useEffect(() => {
    preloadTapSound();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* radial green glow at the top — fake with a View + opacity gradient */}
      <View pointerEvents="none" style={styles.glow} />
      {showDots ? (
        <View style={styles.dots}>
          <StepDots total={totalSteps} active={step} />
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.contentFill]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glow: {
    position: 'absolute',
    top: -80,
    left: '20%',
    right: '20%',
    height: 200,
    borderRadius: 200,
    backgroundColor: colors.acidGlowSoft,
    opacity: 0.6,
  },
  dots: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 32,
    flexGrow: 1,
  },
  contentFill: {
    flex: 1,
    paddingBottom: 0,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.screen,
    gap: 14,
  },
});
