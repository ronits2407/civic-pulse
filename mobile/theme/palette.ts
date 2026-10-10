/**
 * CivicPulse mobile design tokens: "Paper & Navy".
 *
 * A light, sunlight-legible system for a civic app used on the street. The canvas is a
 * warm paper off-white (cold grey washes out outdoors), ink and hero surfaces are deep
 * navy, and soft periwinkle "mist" carries secondary panels. Kerb amber, the colour of
 * Indian road-marking paint, is the single bold accent and is reserved for live agent
 * activity.
 */

export const palette = {
  paper: '#F3F1EC',
  paperDeep: '#EAE7E0',
  white: '#FFFFFF',
  navy: '#141C2E',
  navyRaised: '#1E2940',
  navySoft: '#2B3856',
  mist: '#E4E8F4',
  mistDeep: '#CCD4EA',
  kerb: '#F0A830',
  kerbDeep: '#B9790F',
} as const

export const surface = {
  /** App canvas. */
  canvas: palette.paper,
  /** Cards. */
  card: palette.white,
  /** Wells inside a card, inputs. */
  sunken: '#F6F5F1',
  /** Pressed / selected neutral surface. */
  raised: '#EEEDE7',
  /** Soft periwinkle panel. */
  mist: palette.mist,
  /** Deep navy hero surface. */
  hero: palette.navy,
  heroRaised: palette.navyRaised,
} as const

export const line = {
  base: '#E2DFD7',
  soft: '#EFEDE8',
  strong: palette.navy,
} as const

export const ink = {
  base: palette.navy,
  muted: '#535D72',
  faint: '#8A92A3',
  /** Text on navy / filled accents. */
  inverse: '#FFFFFF',
  inverseMuted: 'rgba(255,255,255,0.68)',
} as const

export const accent = {
  /** Primary action colour. */
  brand: palette.navy,
  brandDim: palette.navySoft,
  blue: '#2F55D4',
  red: '#B42318',
  redSoft: '#C4321F',
  amber: palette.kerbDeep,
  amberSoft: '#A86A0A',
  /** Live agent activity: the one bold accent. */
  kerb: palette.kerb,
  teal: '#0F7C7A',
  emerald: '#1E7F4F',
  rose: '#C2365A',
  slate: '#6B7385',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const

export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 } as const

/** Soft, diffuse elevation. Paper UIs read depth from shadow, not borders. */
export const shadow = {
  card: {
    shadowColor: '#1B2440',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  float: {
    shadowColor: '#0E1526',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const

/**
 * Anek Latin (Ek Type, Mumbai) for display and figures: slightly condensed, characterful.
 * Mukta (Ek Type) for body: open and legible, and it covers Devanagari, so Marathi and
 * Hindi civic briefs render in the same family instead of a system fallback.
 */
export const font = {
  regular: 'Mukta_400Regular',
  medium: 'Mukta_500Medium',
  semibold: 'Mukta_600SemiBold',
  bold: 'Mukta_700Bold',
  display: 'AnekLatin_600SemiBold',
  displayBold: 'AnekLatin_700Bold',
  mono: 'AnekLatin_500Medium',
  monoMedium: 'AnekLatin_500Medium',
  monoSemibold: 'AnekLatin_600SemiBold',
} as const

const sys = undefined as unknown as string
export const systemFont = {
  regular: sys, medium: sys, semibold: sys, bold: sys,
  display: sys, displayBold: sys, mono: sys, monoMedium: sys, monoSemibold: sys,
} as const

/** Modular scale, ratio ~1.2 around a 16px body. */
export const type = {
  hero: { fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  display: { fontSize: 32, lineHeight: 35, letterSpacing: -0.9 },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  heading: { fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodyTight: { fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 19, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  micro: { fontSize: 12, lineHeight: 15, letterSpacing: 0.1 },
  data: { fontSize: 16, lineHeight: 19, letterSpacing: -0.2 },
  dataLg: { fontSize: 26, lineHeight: 28, letterSpacing: -0.6 },
} as const

/** One spring vocabulary for the whole app, so every movement feels related. */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  softSpring: { damping: 22, stiffness: 140, mass: 1 },
  stagger: 55,
  fast: 160,
  base: 260,
} as const
