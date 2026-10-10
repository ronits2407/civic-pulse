/**
 * Pipeline state machine.
 *
 * This is a direct port of `getAgentState()` in the web dashboard, which is the
 * single source of truth for how a `pipeline_stage` value maps onto the 6-agent
 * journey. The stage strings are written by the LangGraph nodes themselves, so
 * they must not drift from the backend.
 *
 * Full stage order on the server:
 *   agent0_translation → agent1_classifier → agent2_deduplication →
 *   agent3_validation → [awaiting_community_review] → agent4_resolution → completed
 * Any stage may also appear with a `_failed` suffix, or as plain `failed` / `save_failed`.
 */

export type PipelineNodeState = 'done' | 'active' | 'pending' | 'failed' | 'skipped'

/** Ordered stage identifiers exactly as the backend writes them. */
export const STAGE_ORDER = [
  'agent0_translation',
  'agent1_classifier',
  'agent2_deduplication',
  'agent3_validation',
  'awaiting_community_review',
  'agent4_resolution',
  'completed',
] as const

/** The five nodes rendered on the rail — one per public-facing agent. */
export interface PipelineNode {
  stage: string
  /** 2–3 word title for the rail. */
  short: string
  /** Full name shown in the detail timeline. */
  title: string
  /** What this agent actually does, in the interface's voice. */
  detail: string
}

export const PIPELINE_NODES: PipelineNode[] = [
  {
    stage: 'agent0_translation',
    short: 'Detect',
    title: 'Language & translation',
    detail: 'Detects the language of your report and translates it to English for the agents downstream.',
  },
  {
    stage: 'agent1_classifier',
    short: 'Classify',
    title: 'Classification',
    detail: 'Reads the text and any photo, then sets category, severity and the emergency flag.',
  },
  {
    stage: 'agent2_deduplication',
    short: 'Dedupe',
    title: 'Duplicate check',
    detail: 'Looks for the same problem reported within 200 m and merges it into one case.',
  },
  {
    stage: 'agent3_validation',
    short: 'Verify',
    title: 'Credibility check',
    detail: 'Cross-checks recent weather and local news, then scores credibility out of 10.',
  },
  {
    stage: 'agent4_resolution',
    short: 'Brief',
    title: 'Action brief & SLA',
    detail: 'Drafts the civic action brief and sets the resolution deadline from municipal SOPs.',
  },
]

function cleanStage(currentStage: string | null | undefined): string {
  return currentStage?.replace('_failed', '') ?? ''
}

/** True when the stage string indicates a failed step. */
export function isFailedStage(stage: string | null | undefined): boolean {
  if (!stage) return false
  return stage.endsWith('_failed') || stage === 'failed' || stage === 'save_failed' || stage.endsWith('_failed_save')
}

/**
 * Resolve a single rail node's state. Mirrors the web implementation, including
 * the `skipped` rule: a duplicate never runs validation or resolution.
 */
export function getNodeState(
  currentStage: string | null | undefined,
  targetStage: string,
  isDuplicate?: boolean
): PipelineNodeState {
  if (
    isDuplicate &&
    (targetStage === 'agent3_validation' || targetStage === 'agent4_resolution')
  ) {
    return 'skipped'
  }

  const cleaned = cleanStage(currentStage)
  const currentIndex = currentStage && cleaned ? STAGE_ORDER.indexOf(cleaned as any) : -1
  const targetIndex = STAGE_ORDER.indexOf(targetStage as any)

  if (currentStage === `${targetStage}_failed`) return 'failed'
  if (cleaned === 'completed' || currentIndex > targetIndex) return 'done'
  if (currentIndex === targetIndex) {
    return currentStage?.endsWith('_failed') ? 'failed' : 'active'
  }
  return 'pending'
}

/** All rail node states for an issue, in order. */
export function getRail(
  currentStage: string | null | undefined,
  isDuplicate?: boolean
): { node: PipelineNode; state: PipelineNodeState }[] {
  return PIPELINE_NODES.map((node) => ({
    node,
    state: getNodeState(currentStage, node.stage, isDuplicate),
  }))
}

/**
 * One-line, user-facing summary of where an issue is right now.
 * Never shows raw stage identifiers to a citizen.
 */
export function deriveProgress(stage: string | null | undefined): {
  label: string
  detail: string
  failed: boolean
  complete: boolean
} {
  if (!stage) {
    return { label: 'Queued', detail: 'Waiting for the AI pipeline to pick this up.', failed: false, complete: false }
  }
  if (stage === 'completed') {
    return { label: 'Pipeline complete', detail: 'All agents finished. This issue is with the department.', failed: false, complete: true }
  }
  if (isFailedStage(stage)) {
    const cleaned = cleanStage(stage)
    const node = PIPELINE_NODES.find((n) => n.stage === cleaned)
    return {
      label: node ? `${node.short} step failed` : 'Pipeline failed',
      detail: 'An agent could not finish. You can retry the pipeline from the issue screen.',
      failed: true,
      complete: false,
    }
  }
  if (stage === 'awaiting_community_review') {
    return {
      label: 'Waiting on neighbours',
      detail: 'Credibility was below 6/10, so nearby citizens are verifying this report.',
      failed: false,
      complete: false,
    }
  }
  const node = PIPELINE_NODES.find((n) => n.stage === stage)
  if (node) {
    return { label: `${node.short} in progress`, detail: node.detail, failed: false, complete: false }
  }
  return { label: 'Processing', detail: 'The AI pipeline is working on this report.', failed: false, complete: false }
}

/**
 * Whether the backend will accept a retry for this stage.
 * Contract taken from `app/api/reports/retry/route.ts`: the route rejects anything
 * that neither ends in `_failed` nor sits at `agent4_resolution`.
 */
export function isRetryable(stage: string | null | undefined): boolean {
  if (!stage) return false
  return stage.endsWith('_failed') || stage === 'agent4_resolution'
}
