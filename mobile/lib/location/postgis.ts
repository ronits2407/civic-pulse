/**
 * PostGIS point decoding.
 *
 * Supabase returns a `geography(point,4326)` column in one of three shapes
 * depending on how the row was fetched:
 *   1. hex EWKB  — "0101000020E6100000..."  (PostgREST default for this column)
 *   2. WKT       — "POINT(73.7898 19.9975)" (what the insert path writes)
 *   3. an object — already decoded with `lat`/`lng` (e.g. the /api/issues/map route)
 *
 * The web app leans on `wkx` for case 1. That library is Node-oriented, so this
 * module implements a focused Point-only reader instead of pulling a Node polyfill
 * into the bundle. Both byte orders are handled.
 *
 * Note the ordering trap: in EWKB the X coordinate is written first, and X is
 * longitude — not latitude.
 */

export interface LatLng {
  lat: number
  lng: number
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

/** Parse a hex EWKB / WKB Point into lat/lng. Returns null on anything unexpected. */
function decodeHexPoint(rawHex: string): LatLng | null {
  const hex = rawHex.startsWith('\\x') ? rawHex.slice(2) : rawHex
  // Guard against absurdly long values before allocating.
  if (hex.length < 42 || hex.length > 4096 || !/^[0-9a-fA-F]+$/.test(hex)) return null

  const bytes = hexToBytes(hex)
  if (!bytes || bytes.length < 21) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const littleEndian = bytes[0] === 1

  // 1 byte endianness + 4 bytes geometry type
  let offset = 5
  const type = view.getUint32(1, littleEndian)

  // High bits of the type flag encode SRID / Z / M dimensionality.
  const hasZ = (type & 0x80000000) !== 0
  const hasM = (type & 0x40000000) !== 0
  const hasSrid = (type & 0x20000000) !== 0
  if (hasSrid) offset += 4

  // Only 2D points are stored in this schema; refuse anything else rather than
  // reading garbage out of the wrong offsets.
  if (hasZ || hasM) return null
  if (bytes.length < offset + 16) return null

  const lng = view.getFloat64(offset, littleEndian)
  const lat = view.getFloat64(offset + 8, littleEndian)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  return { lat, lng }
}

function decodeWktPoint(raw: string): LatLng | null {
  const match = raw.match(/POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)/)
  if (!match) return null
  const lng = parseFloat(match[1])
  const lat = parseFloat(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function decodeGeoJsonPoint(value: any): LatLng | null {
  if (value?.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    const [lng, lat] = value.coordinates
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  return null
}

/** Normalise any of the three representations into a plain { lat, lng }. */
export function decodePostgisLocation(raw: unknown): LatLng | null {
  if (raw == null) return null

  if (typeof raw === 'object') {
    const direct = decodeGeoJsonPoint(raw)
    if (direct) return direct
    const candidate = raw as any
    if (typeof candidate.lat === 'number' && typeof candidate.lng === 'number') {
      return { lat: candidate.lat, lng: candidate.lng }
    }
    return null
  }

  if (typeof raw !== 'string') return null

  const value = raw.trim()
  if (!value) return null

  if (value.startsWith('{')) {
    try {
      return decodeGeoJsonPoint(JSON.parse(value))
    } catch {
      return null
    }
  }

  if (value.toUpperCase().startsWith('POINT')) return decodeWktPoint(value)
  return decodeHexPoint(value)
}
