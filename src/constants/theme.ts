// Diverge design tokens: ink on warm paper with one accent.
// Colors come in a light and a dark palette; read them through `useTheme()`.

export interface Palette {
  /** Page background: warm paper. */
  background: string;
  /** Inputs, sheets, image placeholders. */
  surface: string;
  surfaceElevated: string;
  /** Used only where a boundary carries meaning (chapters, settings rows). */
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** The one accent: selection, unseen, links, likes. */
  tint: string;
  /** Soft wash of the accent for selected surfaces. */
  tintSoft: string;
  onTint: string;
  danger: string;
  like: string;
  skeleton: string;
}

export const LightColors: Palette = {
  background: '#F6F4EF',
  surface: '#EFECE5',
  surfaceElevated: '#FBFAF7',
  border: '#E3DFD7',
  text: '#1C1B1A',
  textSecondary: '#6B6762',
  textTertiary: '#A19C95',
  tint: '#3B4BC8',
  tintSoft: '#E4E6F6',
  onTint: '#FFFFFF',
  danger: '#B4453B',
  like: '#3B4BC8',
  skeleton: '#E7E3DB',
};

export const DarkColors: Palette = {
  background: '#141312',
  surface: '#1D1C1A',
  surfaceElevated: '#232120',
  border: '#2A2826',
  text: '#F2EFE9',
  textSecondary: '#A39F98',
  textTertiary: '#6F6B65',
  tint: '#8A94E8',
  tintSoft: '#23264A',
  onTint: '#141312',
  danger: '#E07A70',
  like: '#8A94E8',
  skeleton: '#2A2826',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Two families: the system sans for everything you read and tap, and a
 * serif reserved for the few places that name a structure — screen titles,
 * chapter markers, endings. Loaded in the root layout.
 */
export const Fonts = {
  serif: 'Newsreader_500Medium',
  serifStrong: 'Newsreader_600SemiBold',
} as const;

/**
 * Four steps. Serif only at the top two; everything you read or tap is the
 * system sans. Sizes are multiples that share a baseline rhythm.
 */
export const Type = {
  /** Screen titles and endings. */
  display: { fontFamily: Fonts.serifStrong, fontSize: 28, lineHeight: 34 },
  /** Chapter markers, section names. */
  chapter: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 26 },
  /** Kept for navigation headers; same family as display, a step smaller. */
  title: { fontFamily: Fonts.serifStrong, fontSize: 22, lineHeight: 28 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  /** Author names: a half step under body so the text stays the subject. */
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  micro: { fontSize: 12, lineHeight: 14, fontWeight: '500' },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
} as const;

/** Two radii: 8 for controls and thumbnails, 10 for post images and sheets. */
export const Radius = {
  sm: 8,
  md: 8,
  lg: 10,
  full: 9999,
} as const;

/** One motion vocabulary for the whole app. */
export const Motion = {
  fast: 150,
  base: 200,
  slow: 400,
  spring: { damping: 14, stiffness: 180, mass: 1 },
} as const;

/** Post images keep their own ratio, clamped to this range (tall 4:5 … wide 1.91:1). */
export const ImageRatio = {
  min: 0.8,
  max: 1.91,
  fallback: 4 / 3,
} as const;
