/**
 * Request/response shapes for the existing Next.js backend.
 *
 * Every field below was read out of the actual route handler in `app/api/**`.
 * Nothing here is guessed — if a route changes, this file must change with it.
 */

import type { Issue, IssueCategory, IssueStatus, UserRole } from '@/types/civicpulse'

// ── POST /api/reports/process ─────────────────────────────────────────────────
export interface ProcessReportRequest {
  text: string
  userId: string
  imageUrl?: string | null
  videoUrl?: string | null
  coordinates: { lat: number; lng: number; address?: string }
}

export interface ProcessReportResponse {
  success: true
  issueId: string
}

// ── POST /api/reports/retry ───────────────────────────────────────────────────
export interface RetryReportResponse {
  success: true
  /** Node the pipeline resumed from: translate | classify | deduplicate | validate | resolve */
  resumed_from: string
}

// ── POST /api/reports/resume ──────────────────────────────────────────────────
export interface ResumeReportResponse {
  success: true
  resumed: boolean
}

// ── GET /api/geocode?lat&lng ──────────────────────────────────────────────────
export interface GeocodeResponse {
  address: string
  error?: string
}

// ── GET /api/issues/map ───────────────────────────────────────────────────────
export interface MapIssue {
  id: string
  title: string | null
  category: IssueCategory | null
  status: IssueStatus | null
  address: string | null
  severity: number | null
  cluster_id: string | null
  created_at: string
  location: { lat: number; lng: number } | null
}

export interface IssuesMapResponse {
  issues: MapIssue[]
  error?: string
}

// ── GET /api/leaderboard?userId ───────────────────────────────────────────────
export interface LeaderboardEntry {
  id: string
  name: string
  picture: string | null
  karma_score: number
  role: UserRole
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  currentUserStats: { rank: number; karma_score: number }
  error?: string
}

// ── POST /api/profile/home-location ───────────────────────────────────────────
export interface HomeLocationRequest {
  lat: number
  lng: number
  userId: string
  address?: string | null
}

export interface HomeLocationResponse {
  success: true
}

// ── GET /api/reviews?userId ───────────────────────────────────────────────────
/** Subset the reviews route selects — note it deliberately omits video_url. */
export interface ReviewIssue {
  id: string
  title: string | null
  description: string
  category: IssueCategory | null
  severity: number | null
  photo_url: string | null
  status: IssueStatus
  created_at: string
  user_id: string
  credibility_score: number | null
  reasoning: string | null
  is_emergency: boolean | null
  needs_community_verification: boolean | null
  location: { lat: number; lng: number } | null
}

export interface ReviewQueueResponse {
  issues: ReviewIssue[]
  error?: string
}

// ── POST /api/reviews/[issueId]/vote ─────────────────────────────────────────
export type VoteOutcome = 'confirmed' | 'rejected' | 'pending'

export interface VoteRequest {
  userId: string
  verdict: boolean
  comment?: string | null
  distanceMeters?: number | null
}

export interface VoteResponse {
  success: true
  outcome: VoteOutcome
}

// ── Supabase table row (issues) ───────────────────────────────────────────────
/** Direct Supabase reads return the PostGIS location as an opaque string. */
export type IssueRow = Omit<Issue, 'location'> & { location: string | { lat: number; lng: number } | null }
