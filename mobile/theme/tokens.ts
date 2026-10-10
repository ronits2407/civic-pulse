/**
 * CivicPulse mobile design tokens.
 *
 * Palette values are lifted from the existing web app so the product identity
 * carries over exactly: `#0d1117` canvas, `#161b22` surfaces, `#30363d` hairlines,
 * `#2da44e` CivicPulse green, `#0969da` navigation blue.
 */

// ── Surfaces ──────────────────────────────────────────────────────────────────
export const surface = {
  /** App canvas. Matches the web `bg-background`. */
  canvas: '#0d1117',
  /** Cards and tab bar. Matches the web `bg-card`. */
  card: '#161b22',
  /** Nested / sunken areas inside a card. */
  sunken: '#0b0f14',
  /** Pressed or hovered state on an interactive surface. */
  raised: '#1c2128',
} as const

export const line = {
  /** Standard 1px hairline. */
  base: '#30363d',
  /** Softer divider for use inside a card. */
  soft: '#21262d',
  /** Accent hairline on the selected tab / focused input. */
  strong: '#8b949e',
} as const

export const ink = {
  /** Primary text. */
  base: '#e6edf3',
  /** Secondary text, labels, metadata. */
  muted: '#8b949e',
  /** Tertiary text — timestamps, units, hints. */
  faint: '#6e7681',
  /** Text on a filled accent background. */
  inverse: '#0d1117',
} as const

export const accent = {
  /** CivicPulse brand green — primary actions, success. */
  brand: '#2da44e',
  brandDim: '#1f7a38',
  /** Navigation / informational blue. */
  blue: '#0969da',
  /** Hazard red — emergencies, failures, rejected. */
  red: '#cf222e',
  redSoft: '#f87171',
  /** Amber — in progress, attention needed. */
  amber: '#d29922',
  amberSoft: '#fbbf24',
  /** Teal — environment / informational. */
  teal: '#2dd4bf',
  /** Emerald — resolved / done. */
  emerald: '#34d399',
  /** Rose — disputed. */
  rose: '#fb7185',
  /** Slate — neutral / closed / skipped. */
  slate: '#94a3b8',
} as const

// ── Spacing (4pt grid) ────────────────────────────────────────────────────────
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

// ── Type ──────────────────────────────────────────────────────────────────────
// Inter carries the interface; JetBrains Mono is reserved for machine data
// (severity values, SLA countdowns, coordinates, karma, issue ids). Using a
// mono face for data is a deliberate signature — it separates measured values
// from prose at a glance.
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const

/** Font stack used before custom fonts finish loading (or if they fail). */
export const systemFont = {
  regular: undefined as unknown as string,
  medium: undefined as unknown as string,
  semibold: undefined as unknown as string,
  bold: undefined as unknown as string,
  mono: 'monospace',
  monoMedium: 'monospace',
  monoSemibold: 'monospace',
} as const

export const type = {
  display: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyTight: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  data: { fontSize: 14, lineHeight: 18, letterSpacing: -0.2 },
  dataLg: { fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
} as const

// ── Category taxonomy (mirrors the web CATEGORY_DETAILS map) ──────────────────
export const CATEGORY_META: Record<
  string,
  { label: string; color: string; tint: string }
> = {
  infrastructure: { label: 'Infrastructure', color: accent.blue, tint: 'rgba(9,105,218,0.14)' },
  sanitation: { label: 'Sanitation', color: accent.emerald, tint: 'rgba(52,211,153,0.14)' },
  safety: { label: 'Safety', color: accent.redSoft, tint: 'rgba(248,113,113,0.14)' },
  utilities: { label: 'Utilities', color: accent.amberSoft, tint: 'rgba(251,191,36,0.14)' },
  environment: { label: 'Environment', color: accent.teal, tint: 'rgba(45,212,191,0.14)' },
  miscellaneous: { label: 'Miscellaneous', color: accent.slate, tint: 'rgba(148,163,184,0.14)' },
}

export const FALLBACK_CATEGORY = CATEGORY_META.miscellaneous

// ── Status taxonomy (mirrors the web STATUS_DETAILS map + community_review) ───
export type Tone = 'blue' | 'amber' | 'emerald' | 'rose' | 'slate' | 'red'

export const TONE_COLOR: Record<Tone, string> = {
  blue: accent.blue,
  amber: accent.amberSoft,
  emerald: accent.emerald,
  rose: accent.rose,
  slate: accent.slate,
  red: accent.redSoft,
}

export const TONE_TINT: Record<Tone, string> = {
  blue: 'rgba(9,105,218,0.14)',
  amber: 'rgba(251,191,36,0.14)',
  emerald: 'rgba(52,211,153,0.14)',
  rose: 'rgba(251,113,133,0.14)',
  slate: 'rgba(148,163,184,0.14)',
  red: 'rgba(248,113,113,0.16)',
}

/**
 * Every status value the database can hold, mapped to a stable label + tone.
 * `false_closure` is surfaced as "Disputed" exactly as the web app does.
 */
export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Under Review', tone: 'blue' },
  in_progress: { label: 'In Progress', tone: 'amber' },
  resolved: { label: 'Resolved', tone: 'emerald' },
  false_closure: { label: 'Disputed', tone: 'rose' },
  closed: { label: 'Closed', tone: 'slate' },
  community_review: { label: 'Community Review', tone: 'amber' },
}

export const UNKNOWN_STATUS = { label: 'Unknown', tone: 'slate' as Tone }
