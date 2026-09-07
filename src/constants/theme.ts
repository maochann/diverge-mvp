// Neutral placeholder design tokens — intentionally generic so real branding
// can replace them later without touching component logic.
// Colors come in a light and a dark palette; read them through `useTheme()`.

export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  tint: string;
  onTint: string;
  danger: string;
  like: string;
  skeleton: string;
}

export const LightColors: Palette = {
  background: '#ffffff',
  surface: '#f4f4f5',
  surfaceElevated: '#ffffff',
  border: '#e4e4e7',
  text: '#18181b',
  textSecondary: '#71717a',
  textTertiary: '#a1a1aa',
  tint: '#2563eb',
  onTint: '#ffffff',
  danger: '#dc2626',
  like: '#e11d48',
  skeleton: '#e4e4e7',
};

export const DarkColors: Palette = {
  background: '#09090b',
  surface: '#18181b',
  surfaceElevated: '#1c1c1f',
  border: '#27272a',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  tint: '#3b82f6',
  onTint: '#ffffff',
  danger: '#f87171',
  like: '#fb7185',
  skeleton: '#27272a',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Text presets without color; pair with a palette color at the call site. */
export const Type = {
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 9999,
} as const;

/** Post images keep their own ratio, clamped to this range (tall 4:5 … wide 1.91:1). */
export const ImageRatio = {
  min: 0.8,
  max: 1.91,
  fallback: 4 / 3,
} as const;
