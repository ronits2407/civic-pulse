import { describe, expect, test } from 'bun:test'
import { Llms } from '@cline/sdk'
import { generateText, generateStructuredJSON, getClineGeminiHandler, isClineSdkActive, getGeminiFlashModel } from '@/lib/ai/client'

describe('Cline SDK Gemini integration', () => {
  const apiKey = process.env.GEMINI_API_KEY

  test('reports Cline SDK as active', () => {
    expect(isClineSdkActive()).toBe(true)
  })

  test('creates Gemini handler via Cline SDK', () => {
    const handler = Llms.createHandler({
      providerId: 'gemini',
      apiKey: apiKey || 'test_key',
      modelId: 'gemini-2.5-flash',
    })
    expect(handler).toBeDefined()
    expect(handler.getModel().id).toBe('gemini-2.5-flash')
  })

  test('getClineGeminiHandler returns initialized ApiHandler', () => {
    if (!apiKey) return
    const handler = getClineGeminiHandler(false)
    expect(handler).toBeDefined()
    expect(handler.getModel().id).toBe(getGeminiFlashModel())
  })

  test('generates plain text via Cline SDK integration', async () => {
    if (!apiKey) return

    const result = await generateText(
      'Reply with exactly: CivicPulse Verified',
      'You are a testing assistant.'
    )
    expect(result.toLowerCase()).toContain('civicpulse')
  }, 30000)

  test('generates structured JSON via Cline SDK integration', async () => {
    if (!apiKey) return

    interface TestCategory {
      category: string
      severity: number
    }

    const result = await generateStructuredJSON<TestCategory>(
      'Burst water pipe flooding main street',
      'Categorize this issue. Respond strictly in JSON with "category" and "severity" (1-10).'
    )

    expect(result).toBeDefined()
    expect(typeof result.category).toBe('string')
    expect(typeof result.severity).toBe('number')
  }, 30000)
})
