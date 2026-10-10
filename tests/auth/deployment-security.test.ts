import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

let userId: string | null = null
let role = 'citizen'
const updates = mock(() => { throw new Error('Login must never update roles') })
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
const verifyToken = mock(async (token: string) => token === 'valid-token'
  ? { data: { user: { id: 'token-user' } }, error: null }
  : { data: { user: null }, error: { message: 'Invalid token' } })

mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: verifyToken } }),
}))

mock.module('@/lib/db/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
      exchangeCodeForSession: async () => ({ data: { user: { id: 'signed-in-user' } }, error: null }),
    },
    from: () => ({
      update: updates,
      select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }),
    }),
  }),
}))

const { resolveActingUser } = await import('@/lib/auth/api-auth')
const { GET } = await import('@/app/auth/callback/route')

beforeEach(() => {
  userId = null
  role = 'citizen'
  updates.mockClear()
  verifyToken.mockClear()
  process.env.NEXT_PUBLIC_APP_URL = 'https://civicpulse.example'
})

afterAll(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('Public deployment authentication', () => {
  test('rejects a client-supplied user id without credentials', async () => {
    const result = await resolveActingUser(new Request('https://civicpulse.example/api'), 'victim')
    expect(result.status).toBe(401)
    expect(result.userId).toBeNull()
    expect(verifyToken).not.toHaveBeenCalled()
  })

  test('accepts a verified bearer token without a cookie session', async () => {
    const result = await resolveActingUser(new Request('https://civicpulse.example/api', {
      headers: { authorization: 'Bearer valid-token' },
    }))
    expect(result.userId).toBe('token-user')
    expect(result.identity.source).toBe('bearer')
    expect(verifyToken).toHaveBeenCalledWith('valid-token')
  })

  test('does not fall back to cookies when a bearer token is rejected', async () => {
    userId = 'cookie-user'
    const result = await resolveActingUser(new Request('https://civicpulse.example/api', {
      headers: { authorization: 'Bearer invalid' },
    }))
    expect(result.status).toBe(401)
    expect(result.userId).toBeNull()
    expect(verifyToken).toHaveBeenCalledWith('invalid')
  })

  test('uses a verified session rather than the client-supplied id', async () => {
    userId = 'real-user'
    const result = await resolveActingUser(new Request('https://civicpulse.example/api'), 'victim')
    expect(result.userId).toBe('real-user')
    expect(result.identity.source).toBe('cookie')
  })

  test('rejects an invalid bearer token even with a claimed id', async () => {
    const result = await resolveActingUser(new Request('https://civicpulse.example/api', {
      headers: { authorization: 'Bearer invalid' },
    }), 'victim')
    expect(result.status).toBe(401)
    expect(result.userId).toBeNull()
    expect(verifyToken).toHaveBeenCalledWith('invalid')
  })

  test('does not promote citizens via the role query parameter', async () => {
    const response = await GET(new Request('https://civicpulse.example/auth/callback?code=test&role=admin'))
    expect(response.headers.get('location')).toBe('https://civicpulse.example/dashboard')
    expect(updates).not.toHaveBeenCalled()
  })

  test('routes existing admins to their dashboard', async () => {
    role = 'admin'
    const response = await GET(new Request('https://civicpulse.example/auth/callback?code=test&role=admin'))
    expect(response.headers.get('location')).toBe('https://civicpulse.example/admin/dashboard')
    expect(updates).not.toHaveBeenCalled()
  })

  test('rejects external post-login redirects', async () => {
    for (const next of ['https://evil.example', '//evil.example', '/\\evil.example']) {
      const response = await GET(new Request(`https://civicpulse.example/auth/callback?code=test&next=${encodeURIComponent(next)}`))
      expect(response.headers.get('location')).toBe('https://civicpulse.example/dashboard')
    }
  })
})