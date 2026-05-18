export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  // screen padding
  screen: 20,
  cardPad: 18,
  // tab bar
  tabBarSide: 12,
  tabBarBottom: 18,
} as const;

export const radius = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  pill: 999,
} as const;

// Glow / shadow helpers — RN uses textShadow* on Text + boxShadow via shadowOffset on View
export const glows = {
  acidText: {
    textShadowColor: 'rgba(194,255,0,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  bloodText: {
    textShadowColor: 'rgba(255,45,45,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  acidButton: {
    shadowColor: '#c2ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
} as const;
