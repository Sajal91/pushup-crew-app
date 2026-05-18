// ACID theme — pitch black + neon acid green.
// Single source of truth for colors. Keep keys in sync with the design README.

export const colors = {
  bg: '#050505',
  panel: '#0e0e0e',
  panel2: '#161616',
  border: '#1f1f1f',
  text: '#f4f4f4',
  dim: '#7a7a7a',
  acid: '#c2ff00',
  acidDim: '#7a9e00',
  blood: '#ff2d2d',
  // alpha helpers
  acidGlow: 'rgba(194,255,0,0.45)',
  acidGlowSoft: 'rgba(194,255,0,0.18)',
  bloodGlow: 'rgba(255,45,45,0.4)',
  cardShadow: 'rgba(0,0,0,0.6)',
} as const;

export type ColorToken = keyof typeof colors;
