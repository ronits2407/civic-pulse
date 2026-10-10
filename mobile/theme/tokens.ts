/**
 * Design tokens. Palette, spacing, type and motion live in theme/palette.ts; this file
 * adds the civic taxonomies (category, status, tone) on top. Export names are stable so
 * every screen picks up the palette without import changes.
 */
import { accent } from '@/theme/palette'

export * from '@/theme/palette'

export const CATEGORY_META: Record<string, { label: string; color: string; tint: string }> = {
  infrastructure: { label: 'Infrastructure', color: '#2F55D4', tint: '#E6ECFB' },
  sanitation: { label: 'Sanitation', color: '#1E7F4F', tint: '#E3F2EA' },
  safety: { label: 'Safety', color: '#B42318', tint: '#FBE7E4' },
  utilities: { label: 'Utilities', color: '#A86A0A', tint: '#FBF0DC' },
  environment: { label: 'Environment', color: '#0F7C7A', tint: '#DFF2F1' },
  miscellaneous: { label: 'Other', color: '#6B7385', tint: '#ECEDF1' },
}

export const FALLBACK_CATEGORY = CATEGORY_META.miscellaneous

export type Tone = 'blue' | 'amber' | 'emerald' | 'rose' | 'slate' | 'red'

export const TONE_COLOR: Record<Tone, string> = {
  blue: accent.blue,
  amber: accent.amberSoft,
  emerald: accent.emerald,
  rose: accent.rose,
  slate: accent.slate,
  red: accent.red,
}

export const TONE_TINT: Record<Tone, string> = {
  blue: '#E6ECFB',
  amber: '#FBF0DC',
  emerald: '#E3F2EA',
  rose: '#FBE6EC',
  slate: '#ECEDF1',
  red: '#FBE7E4',
}

/** `false_closure` is surfaced as "Disputed", as the web app does. */
export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Under review', tone: 'blue' },
  in_progress: { label: 'In progress', tone: 'amber' },
  resolved: { label: 'Resolved', tone: 'emerald' },
  false_closure: { label: 'Disputed', tone: 'rose' },
  closed: { label: 'Closed', tone: 'slate' },
  community_review: { label: 'Neighbours checking', tone: 'amber' },
}

export const UNKNOWN_STATUS = { label: 'Unknown', tone: 'slate' as Tone }
