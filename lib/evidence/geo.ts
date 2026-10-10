import wkx from 'wkx'

export interface LatLng {
  lat: number
  lng: number
}

/** Parses PostgREST geography output (EWKT, hex WKB or GeoJSON) into lat/lng. */
export function parseGeoPoint(value: unknown): LatLng | null {
  try {
    if (!value) return null
    if (typeof value === 'string') {
      const wkt = /POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(value)
      if (wkt) return { lng: parseFloat(wkt[1]), lat: parseFloat(wkt[2]) }
      const geom = wkx.Geometry.parse(Buffer.from(value, 'hex')) as unknown as { x?: number; y?: number }
      if (typeof geom.x === 'number' && typeof geom.y === 'number') return { lng: geom.x, lat: geom.y }
      return null
    }
    const obj = value as { type?: string; coordinates?: unknown }
    if (obj.type === 'Point' && Array.isArray(obj.coordinates)) {
      const [lng, lat] = obj.coordinates as number[]
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
    }
  } catch {
    return null
  }
  return null
}

export function isValidLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== 'object') return false
  const { lat, lng } = p as Record<string, unknown>
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  )
}

/** Haversine distance in meters. Always computed server-side. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371e3
  const p1 = (a.lat * Math.PI) / 180
  const p2 = (b.lat * Math.PI) / 180
  const dp = ((b.lat - a.lat) * Math.PI) / 180
  const dl = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
