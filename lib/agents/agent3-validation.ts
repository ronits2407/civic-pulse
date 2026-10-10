import { getChatModel, generateStructuredJSON } from '@/lib/ai/client'
import { AgentState, ValidationResult } from '@/lib/db/types'
import { createServiceClient } from '@/lib/db/server'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search'
import { buildEvidenceAssessment, createIntakePolicy, decideIntakeRouting } from '@/lib/evidence/policy'
import { intakeLocationSignal } from '@/lib/evidence/signals'
import { recordAssessment, recordEvent } from '@/lib/evidence/repository'
import type { EvidenceOutcome, EvidenceSignalResult } from '@/lib/evidence/types'
import { errorMessage } from '@/lib/evidence/errors'

const VALIDATION_SYSTEM = `You are an evidence-gathering agent for an Indian municipal corporation.
Your job is to collect evidence about whether a citizen's civic issue report is PLAUSIBLE at this place and time.
You have tools to check recent weather and to search the web for local news/events.

Instructions:
1. Think about whether weather could have caused the issue (e.g., flooding requires rain, fallen trees require wind). If so, call the get_weather_data tool. DO NOT call the weather tool for issues unrelated to weather, such as protests, garbage, or streetlights.
2. Think about whether there might be local news or events related to this issue (e.g., a major protest or construction). If so, call the web_search tool.
3. Missing evidence is NEVER a contradiction. If a tool is unavailable or returns nothing, say so; do not treat it as evidence against the report.
4. Once you have used the tools you need, provide your final answer as a plain JSON object.

CRITICAL: Do NOT output tool-calling JSON like {"name": "web_search"...} as your final answer. When you are done, output ONLY the final JSON.

The final JSON MUST have exactly these fields. Each outcome is one of "supports", "neutral", "contradicts", "unknown":
{
  "media_outcome": outcome for the visual evidence (use "unknown" if no image was provided),
  "media_reason": "under 30 words",
  "weather_outcome": outcome for weather (use "unknown" if the tool was not used or failed),
  "weather_reason": "under 30 words",
  "events_outcome": outcome for local news/events (use "unknown" if the search was not used or found nothing),
  "events_reason": "under 30 words",
  "summary": "brief plain-language explanation under 50 words"
}
Use "contradicts" ONLY when you hold concrete evidence that conflicts with the report (e.g. the image clearly shows a different problem, or weather data clearly rules out the claimed cause).`

interface TraceMessage {
  name?: string
  content?: unknown
  tool_calls?: unknown[]
  _getType: () => string
}

interface ToolEnvelope {
  status: 'ok' | 'unavailable'
  data: string
}

const envelope = (status: ToolEnvelope['status'], data: string) => JSON.stringify({ status, data } satisfies ToolEnvelope)

const getWeatherTool = tool(
  async ({ lat, lng }) => {
    try {
      console.log(`[Agent 3: Tool] Fetching weather for lat/lng: ${lat}, ${lng}...`)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weathercode,temperature_2m,windspeed_10m&daily=precipitation_sum&past_days=3&forecast_days=1&timezone=auto`
      const response = await fetch(url)
      if (!response.ok) return envelope('unavailable', 'Weather data unavailable')
      const data = await response.json()
      if (!data.current || !data.daily) return envelope('unavailable', 'Weather data unavailable')

      const current = data.current
      const daily = data.daily
      let pastRain = 0
      if (daily.precipitation_sum && daily.precipitation_sum.length > 0) {
        pastRain = daily.precipitation_sum.slice(0, 3).reduce((a: number, b: number) => a + (b || 0), 0)
      }
      return envelope(
        'ok',
        `Current Temp: ${current.temperature_2m}°C, Wind: ${current.windspeed_10m}km/h. Precipitation (Now): ${current.precipitation}mm. Precipitation (Past 3 Days Total): ${pastRain.toFixed(1)}mm.`
      )
    } catch (err) {
      console.warn(`[Agent 3: Tool] Weather data unavailable.`, err)
      return envelope('unavailable', 'Weather data unavailable')
    }
  },
  {
    name: 'get_weather_data',
    description: 'Fetches current weather and past 3 days precipitation for a location.',
    schema: z.object({
      lat: z.number().describe('Latitude of the location'),
      lng: z.number().describe('Longitude of the location'),
    }),
  }
)

const webSearchTool = tool(
  async ({ query }) => {
    try {
      console.log(`[Agent 3: Tool] Web searching for: ${query}`)
      const ddg = new DuckDuckGoSearch({ maxResults: 3 })
      const result = await ddg.invoke(query)
      if (!result || result.includes('anomaly') || result.includes('Error:')) {
        console.warn(`[Agent 3: Tool] DDG search returned an anomaly or error, treating as unavailable.`)
        return envelope('unavailable', 'Web search unavailable (rate limit or error).')
      }
      return envelope('ok', result)
    } catch (err) {
      console.warn(`[Agent 3: Tool] Web search failed.`, err)
      return envelope('unavailable', 'Web search unavailable (rate limit or error).')
    }
  },
  {
    name: 'web_search',
    description: 'Searches the web for recent local news or events. Use this to verify incidents.',
    schema: z.object({
      query: z.string().describe('The search query'),
    }),
  }
)

interface SynthesizedEvidence {
  media_outcome?: string
  media_reason?: string
  weather_outcome?: string
  weather_reason?: string
  events_outcome?: string
  events_reason?: string
  summary?: string
}

const LLM_OUTCOMES = new Set(['supports', 'neutral', 'contradicts', 'unknown'])

function llmOutcome(value: string | undefined): EvidenceOutcome {
  return value && LLM_OUTCOMES.has(value) ? (value as EvidenceOutcome) : 'unknown'
}

type ToolStatus = 'not_called' | 'ok' | 'unavailable'

/** Reads the real status of each tool call from the ReAct trace. Failures are `unavailable`, never contradictory. */
function readToolStatuses(messages: TraceMessage[]): Record<'weather' | 'events', ToolStatus> {
  const status: Record<'weather' | 'events', ToolStatus> = { weather: 'not_called', events: 'not_called' }
  for (const msg of messages) {
    if (msg._getType() !== 'tool') continue
    const key =
      msg.name === 'get_weather_data' ? 'weather' : msg.name === 'web_search' || msg.name === 'duckduckgo-search' ? 'events' : null
    if (!key) continue
    let parsed: ToolEnvelope | null = null
    try {
      parsed = JSON.parse(typeof msg.content === 'string' ? msg.content : '') as ToolEnvelope
    } catch {
      parsed = null
    }
    // One successful call is enough; otherwise remember the failure.
    if (status[key] !== 'ok') status[key] = parsed?.status === 'ok' ? 'ok' : 'unavailable'
  }
  return status
}

function toolSignal(
  key: 'weather' | 'events',
  status: ToolStatus,
  outcome: EvidenceOutcome,
  reason: string | undefined,
  source: string
): EvidenceSignalResult {
  const weight = 1
  if (status === 'not_called') {
    return {
      key,
      outcome: key === 'weather' ? 'not_applicable' : 'unknown',
      weight,
      reason: key === 'weather' ? 'Weather is not relevant to this kind of issue.' : 'No local news search was run.',
      source: 'none',
      freshness: 'unknown',
    }
  }
  if (status === 'unavailable') {
    return {
      key,
      outcome: 'unknown',
      weight,
      reason: `${key === 'weather' ? 'Weather' : 'Web search'} data was unavailable; this does not count against the report.`,
      source,
      freshness: 'unknown',
    }
  }
  return { key, outcome, weight, reason: reason?.slice(0, 200) || 'Checked with no notable finding.', source, freshness: 'fresh' }
}

export function buildIntakeSignals(input: {
  hasImage: boolean
  synthesized: SynthesizedEvidence | null
  tools: Record<'weather' | 'events', ToolStatus>
  locationSource: 'device_gps' | 'map_pin' | null
  locationAccuracyM: number | null
  locationCapturedAt: Date | null
  now: Date
}): EvidenceSignalResult[] {
  const s = input.synthesized
  const media: EvidenceSignalResult = input.hasImage && s
    ? {
        key: 'media',
        outcome: llmOutcome(s.media_outcome),
        weight: 3,
        reason: s.media_reason?.slice(0, 200) || 'Photo analysed.',
        source: 'image analysis',
        freshness: 'fresh',
      }
    : {
        key: 'media',
        outcome: 'unknown',
        weight: 3,
        reason: input.hasImage ? 'Photo analysis was unavailable.' : 'No photo was attached; this does not count against the report.',
        source: 'none',
        freshness: 'unknown',
      }

  return [
    media,
    intakeLocationSignal({
      source: input.locationSource,
      accuracyM: input.locationAccuracyM,
      capturedAt: input.locationCapturedAt,
      now: input.now,
    }),
    {
      key: 'cluster',
      outcome: 'unknown',
      weight: 1,
      reason: 'No similar nearby reports to compare with.',
      source: 'deduplication',
      freshness: 'unknown',
    },
    toolSignal('weather', input.tools.weather, llmOutcome(s?.weather_outcome), s?.weather_reason, 'open-meteo'),
    toolSignal('events', input.tools.events, llmOutcome(s?.events_outcome), s?.events_reason, 'web search'),
  ]
}

export async function runValidationAgent(state: AgentState): Promise<AgentState> {
  console.log(`[Agent 3: Validator] Starting evidence gathering for issue: ${state.issueId || state.reportId || 'unknown'}`)
  try {
    const llm = getChatModel(false)
    const agent = createReactAgent({ llm, tools: [getWeatherTool, webSearchTool] })

    const promptText = `
Report: "${state.englishTranslation || state.rawText}"
Visual Evidence Analysis: ${state.imageAnalysis || 'No image provided'}
Category: ${state.classification?.category || 'unknown'}
Severity claimed: ${state.classification?.severity || 5}/10
Location: ${state.address || 'Unknown'} (Lat: ${state.coordinates?.lat}, Lng: ${state.coordinates?.lng})
Time of report: Just now
`

    console.log(`[Agent 3: Validator] Invoking ReAct agent loop with Prompt:\n${promptText}`)
    const result = (await agent.invoke({
      messages: [
        { role: 'system', content: VALIDATION_SYSTEM },
        { role: 'user', content: promptText },
      ],
    })) as unknown as { messages: TraceMessage[] }

    console.log(`\n============== [Agent 3: Validator Trace] ==============`)
    result.messages.forEach((msg: TraceMessage, i: number) => {
      const type = msg._getType()
      console.log(`\n--- Step ${i + 1} (${type}) ---`)
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        console.log(`🔧 Tool Call(s):`, JSON.stringify(msg.tool_calls, null, 2))
      }
      if (type === 'tool') {
        console.log(`✅ Tool Response [${msg.name}]:`, typeof msg.content === 'string' ? msg.content.substring(0, 500) : msg.content)
      } else if (msg.content) {
        console.log(`💬 Content:`, typeof msg.content === 'string' ? msg.content.substring(0, 500) : msg.content)
      }
    })
    console.log(`========================================================\n`)

    // Feed the whole trace to the synthesizer so it works even if the LLM halts early.
    const conversationHistory = result.messages
      .map((m: TraceMessage) => `${m._getType().toUpperCase()}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n\n')

    const tools = readToolStatuses(result.messages)

    let synthesized: SynthesizedEvidence | null = null
    try {
      synthesized = await generateStructuredJSON<SynthesizedEvidence>(
        `Based on the following reasoning trace and tool outputs, produce the final evidence JSON:\n\n${conversationHistory}`,
        VALIDATION_SYSTEM
      )
    } catch {
      console.warn(`[Agent 3: Validator] Could not synthesize structured evidence; treating LLM-derived factors as unknown.`)
    }

    const supabase = createServiceClient()
    const { data: issueRow } = await supabase
      .from('issues')
      .select('location_source, location_accuracy_m, location_captured_at')
      .eq('id', state.reportId)
      .maybeSingle()

    const now = new Date()
    const capturedAt = issueRow?.location_captured_at ? new Date(issueRow.location_captured_at) : null
    const signals = buildIntakeSignals({
      hasImage: Boolean(state.imageUrl),
      synthesized,
      tools,
      locationSource: (issueRow?.location_source as 'device_gps' | 'map_pin' | null) ?? null,
      locationAccuracyM: issueRow?.location_accuracy_m != null ? Number(issueRow.location_accuracy_m) : null,
      locationCapturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
      now,
    })

    const policy = createIntakePolicy({
      category: state.classification?.category,
      severity: state.classification?.severity,
      isEmergency: state.classification?.is_emergency,
    })
    const draft = buildEvidenceAssessment(signals, policy)
    const routing = decideIntakeRouting(draft, policy)

    await recordAssessment(state.reportId, draft, 0)
    await recordEvent({
      issueId: state.reportId,
      eventType: 'intake_assessed',
      actorRole: 'system',
      summary: `Intake confidence ${draft.confidenceIndex}/100, coverage ${Math.round(draft.evidenceCoverage * 100)}%. ${routing.reason}`,
      metadata: { risk_level: draft.riskLevel, risk_flags: draft.riskFlags },
    })

    const needsReview = routing.needsCommunityReview
    const reasoning = [synthesized?.summary, draft.explanation].filter(Boolean).join(' ').slice(0, 1000)
    // credibility_score is kept (1-10) only so existing screens keep working; the Confidence Index is the source of truth.
    const legacyScore = Math.min(10, Math.max(1, Math.round(draft.confidenceIndex / 10)))

    const { error: updateError } = await supabase
      .from('issues')
      .update({
        credibility_score: legacyScore,
        needs_community_verification: needsReview,
        reasoning,
        weather_checked: tools.weather !== 'not_called',
        web_search_checked: tools.events !== 'not_called',
        status: needsReview ? 'community_review' : undefined,
        pipeline_stage: needsReview ? 'awaiting_community_review' : 'agent4_resolution',
      })
      .eq('id', state.reportId)

    if (updateError) {
      console.error(`[Agent 3: Validator] Database update failed:`, updateError)
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    const validation: ValidationResult = {
      credibility_score: legacyScore,
      reasoning,
      needs_community_verification: needsReview,
      weather_corroborated: signals.some((s) => s.key === 'weather' && s.outcome === 'supports'),
    }

    console.log(`[Agent 3: Validator] Completed successfully.`)
    return { ...state, validation }
  } catch (error: unknown) {
    console.error(`[Agent 3: Validator] Fatal error during validation:`, error)
    try {
      const supabase = createServiceClient()
      await supabase.from('issues').update({ pipeline_stage: 'agent3_validation_failed' }).eq('id', state.reportId)
    } catch (e) {
      console.error(`[Agent 3: Validator] Failed to update pipeline_stage to failed:`, e)
    }
    return {
      ...state,
      error: `Validation agent failed: ${errorMessage(error)}`,
    }
  }
}
