/**
 * Mock AI helper for CivicPulse.
 *
 * When MOCK_AI_RESPONSES=true (or MOCK_AI_PIPELINE=true / MOCK_AI=true),
 * the AI agents bypass remote LLM calls (Gemini/Ollama) to prevent rate limits
 * (HTTP 429) or timeouts. Responses are realistically hardcoded and displayed
 * sequentially after a configurable delay (default: 3 seconds).
 */

export function isMockAiEnabled(): boolean {
  const val = (
    process.env.MOCK_AI_RESPONSES ||
    process.env.MOCK_AI_PIPELINE ||
    process.env.MOCK_AI ||
    process.env.NEXT_PUBLIC_MOCK_AI
  )
    ?.toLowerCase()
    ?.trim()

  return val === 'true' || val === '1' || val === 'yes'
}

export function getMockAiDelayMs(): number {
  if (process.env.MOCK_AI_DELAY_MS) {
    const ms = Number(process.env.MOCK_AI_DELAY_MS)
    if (!Number.isNaN(ms) && ms >= 0) return ms
  }
  if (process.env.MOCK_AI_DELAY_SECONDS) {
    const sec = Number(process.env.MOCK_AI_DELAY_SECONDS)
    if (!Number.isNaN(sec) && sec >= 0) return sec * 1000
  }
  return 3000
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Generates a mock 768-dimensional embedding vector matching pgvector column definitions.
 */
export function getMockEmbedding(): number[] {
  const embedding = new Array(768)
  for (let i = 0; i < 768; i++) {
    // Small non-zero values to satisfy vector normalization
    embedding[i] = Math.sin(i * 0.1) * 0.05
  }
  return embedding
}
