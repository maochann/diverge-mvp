// Neutral placeholder design tokens — intentionally generic so real branding
// can replace them later without touching component logic.

export const Colors = {
  background: '#ffffff',
  surface: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  textSecondary: '#71717a',
  tint: '#2563eb',
  danger: '#dc2626',
  onTint: '#ffffff',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FontSize = {
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
