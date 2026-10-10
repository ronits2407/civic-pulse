'use client'

import dynamic from 'next/dynamic'
import polyline from '@mapbox/polyline'
import { Map as MapIcon, Navigation } from 'lucide-react'

const RoutePlannerMapInner = dynamic(() => import('@/components/admin/RoutePlannerMapInner'), { ssr: false })

const origin = { lat: 19.9975, lng: 73.7898 }

const mk = (id: string, title: string, category: string, address: string, lat: number, lng: number) => ({
  id, title, category, address, location: { lat, lng },
})

// Example data: one cluster of five open issues, and a pre-computed round trip.
const c1 = [
  mk('r1', 'Deep pothole near College Road', 'infrastructure', 'College Road, Nashik', 20.0062, 73.7712),
  mk('r2', 'Garbage overflow at Panchavati', 'sanitation', 'Panchavati, Nashik', 20.0063, 73.7922),
  mk('r3', 'Streetlight out on Gangapur Road', 'utility', 'Gangapur Road, Nashik', 20.0128, 73.7571),
  mk('r4', 'Water pipeline leak in Dwarka', 'utility', 'Dwarka, Nashik', 19.9889, 73.8041),
  mk('r5', 'Open manhole near CIDCO', 'safety', 'CIDCO, Nashik', 19.9712, 73.7615),
]
const c2 = [
  mk('s1', 'Sewage overflow, Satpur', 'sanitation', 'Satpur, Nashik', 20.0122, 73.7352),
  mk('s2', 'Broken footpath tiles', 'infrastructure', 'Satpur MIDC, Nashik', 20.0181, 73.7402),
]
const c3 = [
  mk('t1', 'Illegal dumping by the river', 'environment', 'Godavari ghat, Nashik', 20.0011, 73.8112),
  mk('t2', 'Tree fallen across lane', 'environment', 'Nashik Road', 19.9473, 73.8369),
]
const clusters = [
  { id: 'k1', issues: c1, centroid: origin },
  { id: 'k2', issues: c2, centroid: origin },
  { id: 'k3', issues: c3, centroid: origin },
]

const order = [3, 1, 0, 2, 4]
const path: [number, number][] = [
  [origin.lat, origin.lng],
  ...order.map(i => [c1[i].location.lat, c1[i].location.lng] as [number, number]),
  [origin.lat, origin.lng],
]
const activeRoute = {
  distanceMeters: 21400,
  duration: '3120s',
  encodedPolyline: polyline.encode(path),
  optimizedWaypointIndices: order,
}

export function RoutePreview() {
  const ordered = order.map(i => c1[i])
  return (
    <div className="flex h-screen w-screen bg-background">
      <div className="z-10 flex h-full w-[350px] shrink-0 flex-col border-r border-border bg-card/60">
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><MapIcon className="h-4 w-4 text-[#2f3fa8]" /> Admin Route Planner</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Select a cluster to generate an optimized route.</p>
        </div>
        <div className="flex-1 space-y-4 overflow-hidden p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Identified Clusters ({clusters.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {clusters.map((c, i) => (
              <div key={c.id} className={`rounded-xl border p-2.5 text-left ${i === 0 ? 'border-black/15 bg-sky/40 ring-1 ring-[#17140f]/40' : 'border-border bg-background'}`}>
                <div className="text-[10px] font-semibold text-foreground">Cluster {i + 1}</div>
                <div className="mt-0.5 text-[9px] text-muted-foreground">{c.issues.length} Issues</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected: Cluster 1</h3>
            <div className="flex h-9 w-full items-center justify-center rounded-lg bg-[#17140f] text-xs font-semibold text-white"><Navigation className="mr-2 h-4 w-4" /> Generate Optimal Route</div>
            <div className="mt-4 space-y-3 rounded-xl border border-black/15 bg-olive/30 p-3">
              <div className="border-b border-black/15 pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#4d6a1f]">Round-Trip Route</div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#4d6a1f]"><span>Total ETA</span><span>{Math.round(parseInt(activeRoute.duration) / 60)} mins</span></div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#4d6a1f]"><span>Total Distance</span><span>{(activeRoute.distanceMeters / 1000).toFixed(1)} km</span></div>
              <p className="text-center text-[9px] leading-tight text-[#2da44e]/80">This route originates from your location, visits all waypoints, and returns back to your location.</p>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground">Waypoints ({ordered.length})</h4>
              {ordered.map((issue, i) => (
                <div key={issue.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#17140f] text-[10px] font-bold text-white">{i + 1}</span>
                  <div className="min-w-0"><p className="line-clamp-1 text-[10px] font-semibold text-foreground">{issue.title}</p><p className="line-clamp-1 text-[9px] text-muted-foreground">{issue.address}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="relative h-full flex-1">
        <RoutePlannerMapInner clusters={clusters} selectedClusterId="k1" userLocation={origin} activeRoute={activeRoute} />
      </div>
    </div>
  )
}
