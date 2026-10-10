/**
 * Demo mode: admin area is open (no login, no staff memberships) and admins can resolve issues directly.
 * Enabled by default. Set DEMO_MODE=false in .env.local to restore real auth + the evidence workflow.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== 'false'
}

export const DEMO_ADMIN_USER = {
  id: 'demo-admin',
  email: 'demo-admin@civicpulse.demo',
  user_metadata: { full_name: 'Demo Admin' },
}
