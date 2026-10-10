import { leaderboardApi } from '@/lib/api/endpoints'
import type { LeaderboardResponse } from '@/lib/api/contracts'
import { useAsync } from '@/hooks/useAsync'

/**
 * Karma leaderboard, fetched through the existing route.
 *
 * The route uses the service-role key server-side (to enrich entries with display
 * names and avatars via the auth admin API), which is exactly why the mobile client
 * must not attempt this query directly against Supabase.
 */
export function useLeaderboard(userId: string | null) {
  return useAsync<LeaderboardResponse>(
    () => leaderboardApi.fetch(userId as string),
    [userId],
    { enabled: Boolean(userId) }
  )
}
