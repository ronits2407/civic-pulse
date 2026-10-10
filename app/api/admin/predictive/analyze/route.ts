import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { analyzePredictiveCluster } from '@/lib/agents/agent5-predictive';

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    // Parse request body for config
    const body = await req.json();
    const { cluster } = body;

    if (!cluster) {
      return NextResponse.json({ error: 'Missing cluster data' }, { status: 400 });
    }

    const alerts = await analyzePredictiveCluster(cluster);

    return NextResponse.json({ success: true, alerts });

  } catch (error: any) {
    console.error('Predictive Agent Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
