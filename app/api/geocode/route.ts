import { NextRequest, NextResponse } from 'next/server'

async function geocodeWithGoogle(lat: string, lng: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const components = data.results[0].address_components || []

      let specific = ''
      let sublocality = ''
      let city = ''
      let state = ''

      for (const comp of components) {
        const types = comp.types || []
        if (!specific && (types.includes('point_of_interest') || types.includes('establishment') || types.includes('route'))) {
          specific = comp.long_name
        }
        if (!sublocality && (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood'))) {
          sublocality = comp.long_name
        }
        if (!city && (types.includes('locality') || types.includes('administrative_area_level_3') || types.includes('administrative_area_level_2'))) {
          city = comp.long_name
        }
        if (types.includes('administrative_area_level_1')) {
          state = comp.long_name
        }
      }

      const parts = [specific || sublocality, city, state].filter(Boolean)
      const unique = parts.filter((v, i, a) => a.indexOf(v) === i)
      if (unique.length >= 2) {
        return unique.join(', ')
      }
      if (data.results[0].formatted_address) {
        return data.results[0].formatted_address.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,3}[^,]*,?\s*/, '')
      }
    }
  } catch (err) {
    console.warn('[Geocode API] Google Maps lookup failed:', err)
  }
  return null
}

async function geocodeWithNominatim(lat: string, lng: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CivicPulseApp/1.0 (ronit@iitg.ac.in)',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()

    if (data && data.address) {
      const addr = data.address
      const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.amenity || addr.building
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county
      const state = addr.state

      const parts = [road, city !== road ? city : null, state].filter(Boolean)
      const unique = parts.filter((v, i, a) => a.indexOf(v) === i)
      if (unique.length >= 2) {
        return unique.join(', ')
      }

      if (data.display_name) {
        const segments = data.display_name
          .split(', ')
          .map((s: string) => s.trim())
          .filter((s: string) => !/^\d{5,6}$/.test(s) && s !== 'India')
        if (segments.length > 0) {
          return segments.slice(0, 3).join(', ')
        }
        return data.display_name
      }
    }
  } catch (err) {
    console.warn('[Geocode API] Nominatim lookup failed:', err)
  }
  return null
}

async function geocodeWithPhoton(lat: string, lng: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const props = data?.features?.[0]?.properties
    if (props) {
      const name = props.name || props.street || props.district
      const city = props.city || props.town || props.county
      const state = props.state
      const parts = [name, city !== name ? city : null, state].filter(Boolean)
      const unique = parts.filter((v, i, a) => a.indexOf(v) === i)
      if (unique.length > 0) {
        return unique.join(', ')
      }
    }
  } catch (err) {
    console.warn('[Geocode API] Photon lookup failed:', err)
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  }

  const numLat = parseFloat(lat)
  const numLng = parseFloat(lng)
  if (isNaN(numLat) || isNaN(numLng)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  let address: string | null = null

  // 1. Try Google Maps first (if billing and key are enabled)
  address = await geocodeWithGoogle(lat, lng)

  // 2. Fallback to OpenStreetMap Nominatim
  if (!address) {
    address = await geocodeWithNominatim(lat, lng)
  }

  // 3. Fallback to Komoot Photon
  if (!address) {
    address = await geocodeWithPhoton(lat, lng)
  }

  // 4. Final fallback: formatted coordinates
  const finalAddress = address || `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`

  return NextResponse.json({ address: finalAddress })
}
