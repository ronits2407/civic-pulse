'use client'

import dynamic from 'next/dynamic'
import { Globe } from 'lucide-react'
import type { MapIssue } from '@/components/dashboard/IssueMapInner'

const IssueMapInner = dynamic(() => import('@/components/dashboard/IssueMapInner'), { ssr: false })

const mk = (id: string, title: string, category: string, status: string, lat: number, lng: number, severity: number, cluster_id: string | null = null): MapIssue => ({
  id, title, category, status, address: 'Nashik', location: { lat, lng }, cluster_id, severity,
})

// Mock pins (public deck preview): three duplicate clusters plus standalone reports across Nashik.
const issues: MapIssue[] = [
  mk('a1', 'Deep pothole near College Road', 'infrastructure', 'in_progress', 19.9975, 73.7898, 8, 'c1'),
  mk('a2', 'Pothole on College Road signal', 'infrastructure', 'open', 19.9979, 73.7903, 7, 'c1'),
  mk('a3', 'Road crater by the junction', 'infrastructure', 'open', 19.9971, 73.7893, 8, 'c1'),
  mk('b1', 'Garbage overflow at Panchavati', 'sanitation', 'open', 20.0063, 73.7922, 6, 'c2'),
  mk('b2', 'Bin not cleared, Panchavati', 'sanitation', 'open', 20.0067, 73.7927, 6, 'c2'),
  mk('c1', 'Water pipeline leak in Dwarka', 'utilities', 'community_review', 19.9889, 73.8041, 7, 'c3'),
  mk('c2', 'Lane flooded by leak', 'utilities', 'open', 19.9893, 73.8046, 7, 'c3'),
  mk('c3', 'Pipe burst near Dwarka circle', 'utilities', 'in_progress', 19.9885, 73.8036, 8, 'c3'),
  mk('d1', 'Streetlight out on Gangapur Road', 'utilities', 'resolved', 20.0128, 73.7571, 5),
  mk('d2', 'Open manhole, Nashik Road', 'safety', 'open', 19.9473, 73.8369, 9),
  mk('d3', 'Tree fallen across lane', 'environment', 'in_progress', 20.0219, 73.7702, 6),
  mk('d4', 'Stray dog menace near school', 'safety', 'open', 19.9712, 73.7615, 5),
  mk('d5', 'Illegal dumping by the river', 'environment', 'open', 20.0011, 73.8112, 6),
  mk('d6', 'Broken footpath tiles', 'infrastructure', 'open', 20.0301, 73.7805, 4),
  mk('d7', 'Sewage overflow, Satpur', 'sanitation', 'open', 20.0122, 73.7352, 7),
  mk('d8', 'Dim streetlights, Indira Nagar', 'utilities', 'open', 19.9802, 73.8008, 4),
]

const legend = [
  ['Infra', '#0969da'], ['Sanitation', '#34d399'], ['Safety', '#f87171'], ['Utilities', '#fbbf24'], ['Env', '#2dd4bf'], ['Misc', '#94a3b8'],
]

export function MapPreview() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/15 bg-olive/30"><Globe className="h-4 w-4 text-[#4d6a1f]" /></div>
          <div>
            <p className="text-sm font-bold leading-none text-foreground">City-Wide Issue Map</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{issues.length} active reports — 8 standalone · 8 in clusters</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          {legend.map(([label, color]) => (
            <span key={label} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <IssueMapInner issues={issues} userLocation={null} />
      </div>
    </div>
  )
}
