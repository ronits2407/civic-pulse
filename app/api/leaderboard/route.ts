import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/db/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  // Use service role client if available, with server client as fallback
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    // Fetch top 10 citizens by karma (exclude admins)
    let { data: topProfiles, error: topError } = await client
      .from('profiles')
      .select('id, karma_score, role')
      .neq('role', 'admin')
      .order('karma_score', { ascending: false })
      .limit(10)

    // Fall back to server anon client if legacy service role key was disabled
    if (topError) {
      const serverClient = await createServerSupabaseClient()
      const fallback = await serverClient
        .from('profiles')
        .select('id, karma_score, role')
        .neq('role', 'admin')
        .order('karma_score', { ascending: false })
        .limit(10)

      if (fallback.error) {
        console.warn('Leaderboard top profiles error:', fallback.error)
        topProfiles = []
      } else {
        topProfiles = fallback.data
        client = serverClient as any
      }
    }

    // Fetch user details for top profiles (gracefully handle auth.admin failure)
    const leaderboard = await Promise.all(
      (topProfiles || []).map(async (p) => {
        let name = 'Citizen'
        let picture = null
        try {
          if (client.auth?.admin?.getUserById) {
            const { data } = await client.auth.admin.getUserById(p.id)
            if (data?.user) {
              name = data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Citizen'
              picture = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null
            }
          }
        } catch {}

        return {
          id: p.id,
          name,
          picture,
          karma_score: p.karma_score || 0,
          role: p.role
        }
      })
    )

    // Fetch current user's karma score
    let currentUserKarma = 0
    let { data: currentUserProfile } = await client
      .from('profiles')
      .select('karma_score')
      .eq('id', userId)
      .maybeSingle()

    if (currentUserProfile) {
      currentUserKarma = currentUserProfile.karma_score || 0
    }

    // Calculate current user's rank (number of CITIZENS with strictly more karma + 1)
    let currentUserRank = 1
    const { count } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .neq('role', 'admin')
      .gt('karma_score', currentUserKarma)

    if (typeof count === 'number') {
      currentUserRank = count + 1
    }

    return NextResponse.json({
      leaderboard,
      currentUserStats: {
        rank: currentUserRank,
        karma_score: currentUserKarma
      }
    })
  } catch (error: any) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
