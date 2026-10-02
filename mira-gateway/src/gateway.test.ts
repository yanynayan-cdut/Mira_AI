import { describe, expect, test } from 'bun:test'
import { webcrypto } from 'node:crypto'
import { createGateway } from './index.ts'

function upstreamMock(): { fetch: typeof fetch; calls: Array<{ path: string; init?: RequestInit }> } {
  const calls: Array<{ path: string; init?: RequestInit }> = []
  let refreshCount = 0
  const user = { id: 7, username: 'alice', email: 'alice@example.com', display_name: 'Alice', role: 1, group: 'vip', quota: 1_000_000, used_quota: 250_000 }
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(input)).pathname
    calls.push({ path, init })
    if (path === '/api/user/register') return Response.json({ success: true, message: '' })
    if (path === '/api/user/login') {
      return new Response(JSON.stringify({ success: true, data: { access_token: 'up-access-1', access_expires_at: 4_000_000_000, session: { sid: 'sid-1' }, user } }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'new_api_refresh=up-refresh-1; Path=/api/user/auth; HttpOnly' } })
    }
    if (path === '/api/user/auth/refresh') {
      refreshCount += 1
      return new Response(JSON.stringify({ success: true, data: { access_token: `up-access-${refreshCount + 1}`, access_expires_at: 4_000_000_100, session: { sid: 'sid-1' }, user } }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': `new_api_refresh=up-refresh-${refreshCount + 1}; Path=/api/user/auth; HttpOnly` } })
    }
    if (path === '/api/user/auth/logout') return Response.json({ success: true })
    if (path === '/api/user/self') return Response.json({ success: true, data: user })
    if (path === '/api/subscription/self') return Response.json({ success: true, data: { all_subscriptions: [{ subscription: { id: 1, plan_id: 2, status: 'active', start_time: 1_700_000_000, end_time: 4_000_000_000, amount_total: 500_000, amount_used: 100_000, next_reset_time: 1_800_000_000 } }] } })
    if (path === '/api/subscription/plans') return Response.json({ success: true, data: [{ plan: { id: 2, title: 'Pro', total_amount: 500_000 } }] })
    return Response.json({ success: false, message: 'not found' }, { status: 404 })
  }) as typeof fetch
  return { fetch: fetchMock, calls }
}

async function request(gateway: ReturnType<typeof createGateway>, path: string, init: RequestInit = {}): Promise<Response> {
  return gateway.fetch(new Request(`http://gateway.test${path}`, init))
}

describe('Mira Gateway', () => {
  test('注册后调用 new-api 注册并自动登录', async () => {
    const mock = upstreamMock()
    const gateway = createGateway({ newApiBaseUrl: 'http://new-api.test', fetchImpl: mock.fetch })
    const response = await request(gateway, '/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alice@example.com', password: 'password123', displayName: 'Alice', inviteCode: 'AFF1', emailOtp: '123456', turnstileToken: 'turnstile-token' }) })
    const body = await response.json() as { success: boolean; accessToken?: string; registeredUsername?: string }
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.accessToken).toBeString()
    expect(body.registeredUsername).toBe('alice_ff8d9')
    const registerCall = mock.calls.find((call) => call.path === '/api/user/register')
    expect(JSON.parse(String(registerCall?.init?.body))).toMatchObject({
      username: 'alice_ff8d9',
      email: 'alice@example.com',
      display_name: 'Alice',
      aff_code: 'AFF1',
      verification_code: '123456',
      turnstile_token: 'turnstile-token',
    })
    expect(mock.calls.map((call) => call.path)).toEqual(['/api/user/register', '/api/user/login/encryption-key', '/api/user/login'])
  })

  test('登录、余额和订阅查询返回 Mira DTO', async () => {
    const mock = upstreamMock()
    const gateway = createGateway({ newApiBaseUrl: 'http://new-api.test', fetchImpl: mock.fetch })
    const login = await request(gateway, '/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }) })
    const auth = await login.json() as { accessToken: string; refreshToken: string }
    const loginCall = mock.calls.find((call) => call.path === '/api/user/login')
    expect(JSON.parse(String(loginCall?.init?.body))).toMatchObject({ username: 'alice@example.com', password: 'password123' })
    const credits = await request(gateway, '/v1/account/credits', { headers: { Authorization: `Bearer ${auth.accessToken}` } })
    const body = await credits.json() as { balance: number; lifetimeConsumed: number; wallet: { quota: number }; subscriptions: Array<{ planTitle: string; quotaRemaining: number }>; subscription: { plan: string } }
    expect(credits.status).toBe(200)
    expect(body.balance).toBe(2)
    expect(body.lifetimeConsumed).toBe(0.5)
    expect(body.wallet.quota).toBe(1_000_000)
    expect(body.subscriptions[0]?.planTitle).toBe('Pro')
    expect(body.subscriptions[0]?.quotaRemaining).toBe(400_000)
    expect(body.subscription.plan).toBe('Pro')
  })

  test('刷新轮换上游会话并注销 Gateway 会话', async () => {
    const mock = upstreamMock()
    const gateway = createGateway({ newApiBaseUrl: 'http://new-api.test', fetchImpl: mock.fetch })
    const login = await request(gateway, '/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'alice', password: 'password123' }) })
    const auth = await login.json() as { accessToken: string; refreshToken: string }
    const refresh = await request(gateway, '/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: auth.refreshToken }) })
    expect(refresh.status).toBe(200)
    const refreshed = await refresh.json() as { accessToken: string; refreshToken: string }
    expect(refreshed.accessToken).not.toBe(auth.accessToken)
    const logout = await request(gateway, '/v1/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${refreshed.accessToken}` } })
    expect(logout.status).toBe(200)
    const afterLogout = await request(gateway, '/v1/account/credits', { headers: { Authorization: `Bearer ${refreshed.accessToken}` } })
    expect(afterLogout.status).toBe(401)
  })

  test('兼容 rc.21 的 session Cookie 登录、余额查询、刷新和注销', async () => {
    const calls: Array<{ path: string; method: string; headers: Headers }> = []
    const user = { id: 21, username: 'legacy-user', display_name: 'Legacy User', role: 1, group: 'default', quota: 750_000, used_quota: 100_000 }
    const fetchMock = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(input)).pathname
      const method = init?.method || 'GET'
      calls.push({ path, method, headers: new Headers(init?.headers) })
      if (path === '/api/user/login/encryption-key') return Response.json({ success: false }, { status: 404 })
      if (path === '/api/user/login') {
        return new Response(JSON.stringify({ success: true, data: user }), {
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=legacy-session; Path=/; HttpOnly' },
        })
      }
      if (path === '/api/user/self') {
        if (calls.at(-1)?.headers.get('Cookie') !== 'session=legacy-session') return Response.json({ success: false }, { status: 401 })
        return Response.json({ success: true, data: user })
      }
      if (path === '/api/subscription/self' || path === '/api/subscription/plans') {
        return Response.json({ success: false, message: '接口不存在' }, { status: 404 })
      }
      if (path === '/api/user/logout' && method === 'GET') {
        return Response.json({ success: true })
      }
      return Response.json({ success: false }, { status: 404 })
    }) as typeof fetch
    const gateway = createGateway({ newApiBaseUrl: 'http://new-api.test', fetchImpl: fetchMock })

    const login = await request(gateway, '/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'legacy-user', password: 'password123' }),
    })
    expect(login.status).toBe(200)
    const auth = await login.json() as { accessToken: string; refreshToken: string; userId: string }
    expect(auth.userId).toBe('21')

    const credits = await request(gateway, '/v1/account/credits', {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    expect(credits.status).toBe(200)
    const creditBody = await credits.json() as { balance: number; subscriptions: unknown[] }
    expect(creditBody.balance).toBe(1.5)
    expect(creditBody.subscriptions).toEqual([])
    expect(calls.find((call) => call.path === '/api/user/self')?.headers.get('Cookie')).toBe('session=legacy-session')
    expect(calls.find((call) => call.path === '/api/user/self')?.headers.get('New-Api-User')).toBe('21')

    const refresh = await request(gateway, '/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    })
    expect(refresh.status).toBe(200)
    const refreshed = await refresh.json() as { accessToken: string }
    expect(refreshed.accessToken).not.toBe(auth.accessToken)
    expect(calls.filter((call) => call.path === '/api/user/self').length).toBe(2)

    const logout = await request(gateway, '/v1/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    })
    expect(logout.status).toBe(200)
    const logoutCall = calls.find((call) => call.path === '/api/user/logout')
    expect(logoutCall?.method).toBe('GET')
    expect(logoutCall?.headers.get('Cookie')).toBe('session=legacy-session')
  })

  test('将 new-api 的业务失败响应转换为 HTTP 错误', async () => {
    const fetchMock = (async (input: string | URL | Request): Promise<Response> => {
      const path = new URL(String(input)).pathname
      if (path === '/api/user/login') return Response.json({ success: false, message: '账号已停用' })
      if (path === '/api/user/register') return Response.json({ success: false, message: '注册已关闭' })
      return Response.json({ success: false, message: '失败' })
    }) as typeof fetch
    const gateway = createGateway({ newApiBaseUrl: 'http://new-api.test', fetchImpl: fetchMock })

    const login = await request(gateway, '/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    })
    expect(login.status).toBe(401)
    expect(((await login.json()) as { error?: string }).error).toBe('账号已停用')

    const register = await request(gateway, '/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    })
    expect(register.status).toBe(502)
    expect(((await register.json()) as { error?: string }).error).toBe('注册已关闭')
  })

  test('关闭注册时在 Gateway 层直接拒绝请求', async () => {
    let upstreamCalled = false
    const gateway = createGateway({
      newApiBaseUrl: 'http://new-api.test',
      registrationOpen: false,
      fetchImpl: (async () => {
        upstreamCalled = true
        return Response.json({ success: true })
      }) as unknown as typeof fetch,
    })
    const response = await request(gateway, '/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    })
    const body = await response.json() as { success: boolean; code?: string }
    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.code).toBe('registration_closed')
    expect(upstreamCalled).toBe(false)
  })

  test('new-api 开启密码加密时发送 RSA-OAEP 登录载荷', async () => {
    const keyPair = await webcrypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    ) as CryptoKeyPair
    const spki = await webcrypto.subtle.exportKey('spki', keyPair.publicKey)
    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(spki).toString('base64')}\n-----END PUBLIC KEY-----`
    const user = { id: 8, username: 'bob', email: 'bob@example.com' }
    let loginPayload: Record<string, unknown> | undefined
    const fetchMock = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(input)).pathname
      if (path === '/api/user/login/encryption-key') return Response.json({ success: true, data: { enabled: true, kid: 'kid-1', public_key: pem } })
      if (path === '/api/user/login') {
        loginPayload = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ success: true, data: { access_token: 'access', session: { sid: 'sid' }, user } }), { headers: { 'Set-Cookie': 'new_api_refresh=refresh' } })
      }
      return Response.json({ success: false }, { status: 404 })
    }) as typeof fetch
    const gateway = createGateway({ newApiBaseUrl: 'https://new-api.test/', passwordEncryption: 'required', fetchImpl: fetchMock })
    const response = await request(gateway, '/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'bob', password: '密码'.repeat(30) }) })
    expect(response.status).toBe(200)
    expect(loginPayload?.username).toBe('bob')
    expect(loginPayload?.password).toBeUndefined()
    expect(loginPayload?.password_encrypted).toBeString()
    expect(loginPayload?.encryption_key_id).toBe('kid-1')
  })

  test('拒绝不安全或带路径的 new-api URL', () => {
    expect(() => createGateway({ newApiBaseUrl: 'ftp://new-api.test' })).toThrow()
    expect(() => createGateway({ newApiBaseUrl: 'https://new-api.test/api' })).not.toThrow()
    expect(() => createGateway({ newApiBaseUrl: 'https://new-api.test', newApiOrigin: 'https://panel.test/path' })).toThrow()
  })

  test('将 Turnstile 令牌放入 new-api 要求的查询参数', async () => {
    const urls: string[] = []
    const user = { id: 9, username: 'turnstile-user' }
    const fetchMock = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const value = String(input)
      urls.push(value)
      const parsed = new URL(value)
      if (parsed.pathname === '/api/user/register') return Response.json({ success: true })
      if (parsed.pathname === '/api/user/login') return new Response(JSON.stringify({ success: true, data: { access_token: 'access', session: { sid: 'sid' }, user } }), { headers: { 'Set-Cookie': 'new_api_refresh=refresh' } })
      return Response.json({ success: false }, { status: 404 })
    }) as typeof fetch
    const gateway = createGateway({ newApiBaseUrl: 'https://new-api.test', fetchImpl: fetchMock })
    const response = await request(gateway, '/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'turnstile@example.com', password: 'password123', turnstileToken: 'token/with+symbols' }),
    })
    expect(response.status).toBe(200)
    expect(new URL(urls[0]!).searchParams.get('turnstile')).toBe('token/with+symbols')
    expect(new URL(urls[2]!).searchParams.get('turnstile')).toBe('token/with+symbols')
  })
})
