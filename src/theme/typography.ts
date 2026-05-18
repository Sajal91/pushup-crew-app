// Font families — loaded via expo-google-fonts in app/_layout.tsx.
// Use these constants instead of raw strings so a font rename only happens here.

export const fonts = {
  display: 'Anton_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

// Common type sizes used across screens.
export const fontSize = {
  chip: 9,
  monoLabel: 11,
  body: 14,
  sectionTitle: 32,
  hero: 88,
  display: 120,
  displayXL: 160,
} as const;
