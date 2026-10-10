import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { resolveActingUser } from '@/lib/auth/api-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lat, lng, userId, address } = body

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const identity = await resolveActingUser(req, userId)
    if (!identity.userId) {
      return NextResponse.json(
        { error: identity.error ?? 'Authentication required.' },
        { status: identity.status ?? 401 }
      )
    }

    const supabase = createServiceClient()
    
    // Save the location as a PostGIS POINT Geography
    const { error } = await supabase
      .from('profiles')
      .update({
        home_location: `POINT(${lng} ${lat})`,
        home_address: address || null
      })
      .eq('id', identity.userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error setting home location:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
