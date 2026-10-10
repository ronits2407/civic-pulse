import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { fetchAndClusterIssues } from '@/lib/agents/agent5-predictive';

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

    const clusters = await fetchAndClusterIssues(days, bbox);

    return NextResponse.json({ success: true, count: clusters.length, clusters });

  } catch (error: any) {
    console.error('Predictive Agent Clustering Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
