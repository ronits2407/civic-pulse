import { supabase } from '@/lib/supabase/client'
import { decodePostgisLocation, type LatLng } from '@/lib/location/postgis'
import type { Department, Issue } from '@/types/civicpulse'

/**
 * Issue reads go straight to Supabase rather than through a bespoke route.
 *
 * This is the correct authorisation model for the app: the existing RLS policies
 * already grant every signed-in user read access to `issues`
 * ("Users can read all issues"), and scoping by `user_id` is a query concern, not
 * a new permission. It also means Realtime works on the same rows we render.
 *
 * The one thing PostgREST cannot do for us is decode the PostGIS column, so every
 * row passes through `decodePostgisLocation` on the way out.
 */

export interface DecodedIssue extends Omit<Issue, 'location'> {
  location: LatLng | null
}

function decodeRow(row: any): DecodedIssue {
  return { ...row, location: decodePostgisLocation(row?.location) } as DecodedIssue
}

/** Newest reports first for the signed-in citizen. */
export async function fetchMyIssues(userId: string, limit = 50): Promise<DecodedIssue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(decodeRow)
}

/** A single issue. Used by the detail screen and as the Realtime refresh source. */
export async function fetchIssueById(issueId: string): Promise<DecodedIssue | null> {
  const { data, error } = await supabase.from('issues').select('*').eq('id', issueId).maybeSingle()
  if (error) throw error
  return data ? decodeRow(data) : null
}

/** Routing targets used to name the department on the detail screen. */
export async function fetchDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*')
  if (error) throw error
  return (data ?? []) as Department[]
}

/**
 * The citizen's own profile row (role, karma, saved home location).
 * RLS restricts this to `auth.uid() = id`, so only the signed-in user resolves.
 */
export async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    home_location: decodePostgisLocation((data as any).home_location),
  }
}

export type MyProfile = Awaited<ReturnType<typeof fetchMyProfile>>

/** Verdict tally for one issue, used before letting a citizen vote. */
export async function fetchVerdictTally(issueId: string) {
  const { data, error } = await supabase.from('verifications').select('verdict').eq('issue_id', issueId)
  if (error) throw error
  const confirms = (data ?? []).filter((v: any) => v.verdict === true).length
  const denies = (data ?? []).filter((v: any) => v.verdict === false).length
  return { confirms, denies, total: confirms + denies }
}

/** Has the current citizen already voted on this issue? */
export async function hasVoted(issueId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifications')
    .select('id')
    .eq('issue_id', issueId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
