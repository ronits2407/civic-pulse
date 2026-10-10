import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { createIssuePipeline } from '@/lib/agents/pipeline'
import { generateEmbedding } from '@/lib/ai/client'
import { AgentState } from '@/lib/db/types'
import { resolveActingUser } from '@/lib/auth/api-auth'
import { isValidLatLng } from '@/lib/evidence/geo'
import { recordEvent } from '@/lib/evidence/repository'
import { errorMessage } from '@/lib/evidence/errors'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { text, imageUrl, videoUrl, coordinates, address, userId } = body

    if (!text || !coordinates || !isValidLatLng(coordinates)) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: text, coordinates' },
        { status: 400 }
      )
    }

    // Prefer the verified session identity (the native client sends a bearer token).
    // Falls back to the legacy client-supplied id only when no credential was sent.
    const identity = await resolveActingUser(req, userId)
    if (!identity.userId) {
      return NextResponse.json(
        { error: identity.error ?? 'Authentication required.' },
        { status: identity.status ?? 401 }
      )
    }
    const actingUserId = identity.userId

    // Location provenance: how the reporter chose the location, GPS accuracy (m) and capture time.
    const locationSource: 'device_gps' | 'map_pin' | null =
      body.locationSource === 'device_gps' || body.locationSource === 'map_pin' ? body.locationSource : null
    const accuracyRaw = Number(body.locationAccuracy)
    const locationAccuracy =
      locationSource === 'device_gps' && Number.isFinite(accuracyRaw) && accuracyRaw >= 0 && accuracyRaw < 100000
        ? accuracyRaw
        : null
    const capturedRaw = typeof body.locationCapturedAt === 'string' ? new Date(body.locationCapturedAt) : null
    const locationCapturedAt =
      capturedRaw && !Number.isNaN(capturedRaw.getTime()) && capturedRaw.getTime() <= Date.now() + 5 * 60_000
        ? capturedRaw.toISOString()
        : null

    const resolvedAddress =
      address ||
      (coordinates && typeof (coordinates as unknown as { address?: string }).address === 'string'
        ? ((coordinates as unknown as { address?: string }).address as string)
        : '')

    const supabase = createServiceClient()

    const embedding = await generateEmbedding(text)

    const { data: issue, error: insertError } = await supabase
      .from('issues')
      .insert({
        user_id: actingUserId,
        description: text,
        photo_url: imageUrl || null,
        video_url: videoUrl || null,
        location: `POINT(${coordinates.lng} ${coordinates.lat})`,
        address: resolvedAddress,
        status: 'open',
        embedding,
        pipeline_stage: 'agent0_translation',
        location_source: locationSource,
        location_accuracy_m: locationAccuracy,
        location_captured_at: locationCapturedAt,
      })
      .select()
      .single()

    if (insertError) throw insertError

    await recordEvent({
      issueId: issue.id,
      eventType: 'reported',
      actorId: actingUserId,
      actorRole: 'citizen',
      summary: 'Issue reported.',
      metadata: { location_source: locationSource },
    }).catch((e) => console.error('Failed to record report event:', e))

    // Award +10 karma for reporting an issue
    await supabase.from('karma_events').insert({
      user_id: actingUserId,
      event_type: 'issue_reported',
      points: 10,
      issue_id: issue.id,
    })

    const pipeline = await createIssuePipeline()

    const initialState: AgentState = {
      reportId: issue.id,
      rawText: text,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      coordinates,
      address: resolvedAddress,
      userId: actingUserId,
      originalLanguage: 'English',
      englishTranslation: '',
      translationTrace: '',
      classification: null,
      deduplication: null,
      validation: null,
      resolution: null,
      error: null,
      imageAnalysis: '',
    }

    // Run asynchronously in the background using Next.js after()
    after(() => {
      const config = { configurable: { thread_id: issue.id } };
      pipeline.invoke(initialState as unknown as Parameters<typeof pipeline.invoke>[0], config).catch(async (err) => {
        console.error('Pipeline Background Error:', err)
        await supabase.from('issues').update({ pipeline_stage: 'failed' }).eq('id', issue.id)
      })
    })

    return NextResponse.json({
      success: true,
      issueId: issue.id,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    )
  }
}