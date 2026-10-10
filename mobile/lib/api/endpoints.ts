import { http } from '@/lib/api/client'
import type {
  GeocodeResponse,
  HomeLocationRequest,
  HomeLocationResponse,
  IssuesMapResponse,
  LeaderboardResponse,
  ProcessReportRequest,
  ProcessReportResponse,
  ResumeReportResponse,
  RetryReportResponse,
  ReviewQueueResponse,
  VoteRequest,
  VoteResponse,
} from '@/lib/api/contracts'

/**
 * One function per backend route the citizen app is allowed to call.
 * No UI component should build a URL itself.
 */

export const reportsApi = {
  /** Kick off the 6-agent pipeline. Returns as soon as the row is inserted. */
  process: (payload: ProcessReportRequest) =>
    http.post<ProcessReportResponse>('/api/reports/process', payload, { timeoutMs: 45_000 }),

  /** Re-run from the stage that failed. */
  retry: (issueId: string) =>
    http.post<RetryReportResponse>('/api/reports/retry', { issueId }, { timeoutMs: 30_000 }),

  /** Resume a pipeline paused at the community-review interrupt. */
  resume: (issueId: string) =>
    http.post<ResumeReportResponse>('/api/reports/resume', { issueId }, { timeoutMs: 30_000 }),
}

export const geoApi = {
  /** Reverse geocode via the existing Google Maps proxy. Never throws for a
   *  missing address — the route itself falls back to raw coordinates. */
  reverse: (lat: number, lng: number) =>
    http.get<GeocodeResponse>(`/api/geocode?lat=${lat}&lng=${lng}`, {
      anonymous: true,
      timeoutMs: 12_000,
    }),
}

export const issuesApi = {
  /** City-wide markers for the map screen (up to 500, most recent first). */
  map: () => http.get<IssuesMapResponse>('/api/issues/map', { timeoutMs: 20_000 }),
}

export const profileApi = {
  /** Persist the citizen's home location, which gates the review queue. */
  saveHomeLocation: (payload: HomeLocationRequest) =>
    http.post<HomeLocationResponse>('/api/profile/home-location', payload, { timeoutMs: 20_000 }),
}

export const leaderboardApi = {
  fetch: (userId: string) =>
    http.get<LeaderboardResponse>(`/api/leaderboard?userId=${encodeURIComponent(userId)}`, {
      timeoutMs: 20_000,
    }),
}

export const reviewsApi = {
  /** Issues near the citizen awaiting community verification. */
  queue: (userId: string) =>
    http.get<ReviewQueueResponse>(`/api/reviews?userId=${encodeURIComponent(userId)}`, {
      timeoutMs: 20_000,
    }),

  /**
   * Cast a verdict. Quorum resolution and karma are decided server-side — the
   * client only reports the outcome the route returned.
   */
  vote: (issueId: string, payload: VoteRequest) =>
    http.post<VoteResponse>(`/api/reviews/${encodeURIComponent(issueId)}/vote`, payload, {
      timeoutMs: 20_000,
    }),
}
