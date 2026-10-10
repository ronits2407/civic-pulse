import { DeckClient } from '@/components/deck/DeckClient'
import { createServiceClient } from '@/lib/db/server'

export const metadata = { title: 'CivicPulse — Deck' }
export const dynamic = 'force-dynamic'

export default async function DeckPage() {
  let receiptId: string | null = null
  try {
    const { data } = await createServiceClient()
      .from('issues').select('id').eq('status', 'resolved').order('created_at', { ascending: false }).limit(1)
    receiptId = data?.[0]?.id ?? null
  } catch {}
  return <DeckClient receiptId={receiptId} />
}
