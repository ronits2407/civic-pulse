import { NextResponse } from 'next/server'
import { isClineSdkActive, getGeminiFlashModel, getGroqFlashModel, getGroqVisionModel } from '@/lib/ai/client'

export async function GET() {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
    aiProvider: provider,
    geminiKey: process.env.GEMINI_API_KEY ? 'set' : 'missing',
    groqKey: process.env.GROQ_API_KEY ? 'set' : 'missing',
    groqModels: provider === 'groq' ? { text: getGroqFlashModel(), vision: getGroqVisionModel() } : undefined,
    mapsKey: process.env.GOOGLE_MAPS_API_KEY ? 'set' : 'missing',
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 'set' : 'missing',
    clineSdk: isClineSdkActive() ? `active (@cline/sdk provider with model: ${getGeminiFlashModel()})` : 'disabled',
  })
}