import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { Department, Issue, Profile } from '@/lib/db/types'

// Public, mock-data mirror of /dashboard (which is behind auth) so the deck can embed it.
const now = Date.now()
const h = (hours: number) => new Date(now - hours * 3600_000).toISOString()
const base: Issue = {
  id: '', user_id: 'deck-user', title: '', description: '', category: 'infrastructure', subcategory: null,
  severity: 5, is_emergency: false, status: 'open', pipeline_stage: 'completed', location: { lat: 19.9975, lng: 73.7898 },
  address: 'College Road, Nashik', ward_id: null, photo_url: null, video_url: null, credibility_score: 8, cluster_id: null,
  department_id: 'd1', needs_community_verification: false, reasoning: null, civic_brief: null, local_civic_brief: null,
  original_language: 'English', translation_trace: null, image_analysis: null, sla_deadline: null, resolved_at: null,
  agent5_completed: true, created_at: h(1),
}
const issues: Issue[] = [
  { ...base, id: 'i1', title: 'Deep pothole near College Road signal', description: 'Large pothole causing two-wheeler skids.', severity: 8, status: 'in_progress', sla_deadline: h(-40), created_at: h(6), civic_brief: 'Road surface failure at a high-traffic junction. Dispatch PWD patch crew within 48h.' },
  { ...base, id: 'i2', title: 'Overflowing garbage bin at Panchavati', description: 'Bin not cleared for days.', category: 'sanitation', severity: 6, status: 'open', created_at: h(20), sla_deadline: h(-70) },
  { ...base, id: 'i3', title: 'Streetlight out on Gangapur Road', description: 'Dark stretch, safety risk at night.', category: 'utilities', severity: 5, status: 'resolved', resolved_at: h(3), created_at: h(60) },
  { ...base, id: 'i4', title: 'Water pipeline leak in Dwarka', description: 'Continuous leak flooding the lane.', category: 'utilities', severity: 7, status: 'community_review', created_at: h(30) },
]
const departments: Department[] = [
  { id: 'd1', name: 'Public Works Department (PWD)', category_scope: ['infrastructure'], avg_resolution_hours: 48 },
]
const profile: Profile = {
  id: 'deck-user', phone: null, email: 'asha@civicpulse.demo', role: 'citizen', karma_score: 240, ward_id: null,
  push_subscription: null, home_location: null, home_address: null, created_at: h(900),
}

export default function DeckDashboardPreview() {
  return (
    <DashboardClient
      user={{ id: 'deck-user', email: 'asha@civicpulse.demo', user_metadata: { full_name: 'Asha Patil' } }}
      profile={profile}
      initialIssues={issues}
      departments={departments}
    />
  )
}
