import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { runPredictiveAgent } from '@/lib/agents/agent5-predictive';

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    // Parse request body for config
    const body = await req.json();
    const { lookbackDays, bbox } = body;

    // Validate lookbackDays
    const days = parseInt(lookbackDays);
    if (isNaN(days) || days <= 0) {
      return NextResponse.json({ error: 'Invalid lookbackDays' }, { status: 400 });
    }

    // Since this can take time, in a true async architecture we might trigger a Cloud Task.
    // For Vercel/Next.js we can return immediately and let it run, but since this is on a Node runtime 
    // or Cloud Run we can just await it or fire and forget.
    // We will await it for now so the UI can get immediate feedback for the MVP.
    const alerts = await runPredictiveAgent(days, bbox);

    return NextResponse.json({ success: true, count: alerts.length, alerts });

  } catch (error: any) {
    console.error('Predictive Agent Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
