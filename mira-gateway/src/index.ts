import { createHash, randomUUID, webcrypto } from 'node:crypto'

const DEFAULT_PORT = 8787
const ACCESS_TOKEN_FALLBACK_MS = 15 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const QUOTA_PER_CURRENCY_UNIT = 500_000

export interface GatewayConfig {
  newApiBaseUrl: string
  port?: number
  newApiOrigin?: string
  /** 自动读取 new-api 的密码加密开关；旧版无此接口时回退明文。 */
  passwordEncryption?: 'auto' | 'required' | 'disabled'
  /** 仅当 Gateway 另行实现 Mira relay/proxy 时开启；当前默认关闭。 */
  commercialMode?: boolean
  registrationOpen?: boolean
  registrationEmailVerificationRequired?: boolean
  fetchImpl?: typeof fetch
}

interface NewApiUser {
  id: number | string
  username?: string
  email?: string
  display_name?: string
  role?: number
  status?: number
  group?: string
  quota?: number
  used_quota?: number
}

interface NewApiSession {
  sid?: string
  expires_at?: number
}

interface NewApiLoginData {
  access_token?: string
  access_expires_at?: number
  session?: NewApiSession
  user?: NewApiUser
  challenge?: unknown
  [key: string]: unknown
}

type UpstreamAuthMode = 'token' | 'legacy-cookie'

interface NewApiPasswordEncryptionKey {
  enabled?: boolean
  kid?: string
  public_key?: string
}

interface NewApiSubscription {
  subscription?: {
    id?: number
    plan_id?: number
    status?: string
    start_time?: number
    end_time?: number
    amount_total?: number
    amount_used?: number
    next_reset_time?: number
  }
}

interface NewApiPlan {
  plan?: {
    id?: number
    title?: string
    subtitle?: string
    currency?: string
    duration_unit?: string
    duration_value?: number
    total_amount?: number
    quota_reset_period?: string
  }
}

interface GatewaySession {
  upstreamAuthMode: UpstreamAuthMode
  accessToken: string
  refreshToken: string
  upstreamAccessToken: string
  upstreamRefreshCookie: string
  upstreamSessionId: string
  upstreamSessionCookie: string
  user: NewApiUser
  /** 注册或邮箱登录时保留用户输入，兼容 new-api 未开启邮箱存储的部署。 */
  emailHint?: string
  accessExpiresAt: number
  createdAt: number
  expiresAt: number
}

interface JsonRecord {
  [key: string]: unknown
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function errorResponse(status: number, message: string, code?: string): Response {
  return json({ success: false, error: message, ...(code ? { code } : {}) }, status)
}

async function readJson(request: Request): Promise<JsonRecord> {
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value as JsonRecord
  } catch {
    return {}
  }
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function passwordValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeBaseUrl(value: string): string {
  const raw = value.trim()
  if (!raw) throw new Error('NEW_API_BASE_URL 不能为空')
  const parsed = new URL(raw)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('NEW_API_BASE_URL 必须使用 http 或 https')
  }
  if (parsed.search || parsed.hash) throw new Error('NEW_API_BASE_URL 不应包含查询参数或片段')
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.toString().replace(/\/$/, '')
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  const parsed = new URL(value.trim())
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('NEW_API_ORIGIN 必须使用 http 或 https')
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('NEW_API_ORIGIN 必须是纯 Origin')
  }
  return parsed.origin
}

function base64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function pemToDer(publicKey: string): ArrayBuffer {
  const body = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replaceAll(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

async function encryptPassword(password: string, key: NewApiPasswordEncryptionKey): Promise<string> {
  if (!key.kid || !key.public_key) throw new Error('new-api 密码加密公钥无效')
  const publicKey = await webcrypto.subtle.importKey(
    'spki',
    pemToDer(key.public_key),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const plaintext = new TextEncoder().encode(password)
  const modulusLength = (publicKey.algorithm as { modulusLength?: number }).modulusLength || 2048
  if (plaintext.byteLength <= modulusLength / 8 - 66) {
    const encrypted = await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, plaintext)
    return base64(encrypted)
  }

  // new-api v2 envelope supports passwords longer than RSA-OAEP's payload limit.
  const secret = webcrypto.getRandomValues(new Uint8Array(32))
  const nonce = webcrypto.getRandomValues(new Uint8Array(12))
  const aesKey = await webcrypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt'])
  const [wrappedKey, ciphertext] = await Promise.all([
    webcrypto.subtle.encrypt({ name: 'RSA-OAEP', label: new TextEncoder().encode('password-v2') }, publicKey, secret),
    webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode(`password-v2:${key.kid}`) }, aesKey, plaintext),
  ])
  return `v2.${base64(wrappedKey)}.${base64(nonce)}.${base64(ciphertext)}`
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function randomToken(): string {
  return `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`
}

function generatedUsername(email: string): string {
  const local = email.split('@', 1)[0]?.replace(/[^a-zA-Z0-9_-]/g, '') || 'mirauser'
  const suffix = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 5)
  return `${local.slice(0, Math.max(1, 20 - suffix.length - 1))}_${suffix}`.slice(0, 20)
}

function parseSetCookie(response: Response, cookieName: string): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [response.headers.get('set-cookie') || '']
  for (const value of values) {
    // 兼容 Bun/Node 对多条 Set-Cookie 的不同暴露方式；Cookie 值本身不包含分号。
    const match = value.match(new RegExp(`(?:^|[,;]\\s*)${cookieName}=([^;,\\s]+)`))
    if (match?.[1]) return match[1]
  }
  return ''
}

function parseRefreshCookie(response: Response): string {
  return parseSetCookie(response, 'new_api_refresh')
}

function parseSessionCookie(response: Response): string {
  return parseSetCookie(response, 'session')
}

async function responseBody(response: Response): Promise<JsonRecord> {
  try {
    const value: unknown = await response.json()
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  } catch {
    return {}
  }
}

function upstreamError(body: JsonRecord, fallback: string): string {
  const message = body.error ?? body.message
  if (typeof message === 'string' && message.trim()) return message
  return fallback
}

function upstreamFailed(response: Response, body: JsonRecord): boolean {
  return !response.ok || body.success === false
}

function upstreamStatus(response: Response, fallback: number): number {
  return response.ok ? fallback : response.status
}

function userFromLogin(data: NewApiLoginData): NewApiUser | null {
  if (data.user && typeof data.user === 'object') return data.user
  // new-api v1.0.0-rc.21 直接把用户对象放在 data 中，没有 data.user 包装层。
  return typeof data.id === 'number' || typeof data.id === 'string' ? data as unknown as NewApiUser : null
}

function mapAuth(session: GatewaySession, commercialMode = false): JsonRecord {
  const user = session.user
  return {
    success: true,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.accessExpiresAt,
    userId: String(user.id),
    email: session.emailHint || user.email || user.username || '',
    displayName: user.display_name || user.username || '',
    membershipTier: user.group || 'free',
    commercialMode,
    isAdmin: numberValue(user.role) >= 10,
    username: user.username || '',
  }
}

export function createGateway(config: GatewayConfig): { fetch: (request: Request) => Promise<Response>; sessions: Map<string, GatewaySession> } {
  const baseUrl = normalizeBaseUrl(config.newApiBaseUrl)
  const newApiOrigin = normalizeOrigin(config.newApiOrigin)
  const passwordEncryption = config.passwordEncryption ?? 'auto'
  const fetchImpl = config.fetchImpl || fetch
  const sessions = new Map<string, GatewaySession>()
  let passwordKeyPromise: Promise<NewApiPasswordEncryptionKey | null> | null = null
  const refreshInFlight = new WeakMap<GatewaySession, Promise<boolean>>()

  async function callNewApi(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    if (newApiOrigin) {
      if (!headers.has('Origin')) headers.set('Origin', newApiOrigin)
      if (!headers.has('Referer')) headers.set('Referer', `${newApiOrigin}/`)
    }
    return fetchImpl(`${baseUrl}${path}`, { ...init, headers })
  }

  async function safeCallNewApi(path: string, init: RequestInit = {}): Promise<Response | null> {
    try {
      return await callNewApi(path, init)
    } catch {
      return null
    }
  }

  async function getPasswordEncryptionKey(): Promise<NewApiPasswordEncryptionKey | null> {
    if (passwordEncryption === 'disabled') return null
    if (!passwordKeyPromise) {
      passwordKeyPromise = (async () => {
        try {
          const response = await callNewApi('/api/user/login/encryption-key')
          const body = await responseBody(response)
          const data = (body.data || {}) as NewApiPasswordEncryptionKey
          if (!response.ok) {
            if (passwordEncryption === 'required') throw new Error('new-api 密码加密接口不可用')
            return null
          }
          if (data.enabled === false) return null
          if (data.enabled === true && data.kid && data.public_key) return data
          if (data.enabled === true) throw new Error('new-api 密码加密公钥无效')
          if (passwordEncryption === 'required') throw new Error('new-api 密码加密公钥无效')
          return null
        } catch (error) {
          if (passwordEncryption === 'required' || error instanceof Error && error.message.includes('公钥无效')) throw error
          return null
        }
      })().finally(() => { passwordKeyPromise = null })
    }
    return passwordKeyPromise
  }

  async function upstreamLoginPayload(username: string, password: string): Promise<JsonRecord> {
    const key = await getPasswordEncryptionKey()
    if (!key) return { username, password }
    return { username, password_encrypted: await encryptPassword(password, key), encryption_key_id: key.kid }
  }

  async function loginUpstream(username: string, password: string, emailHint = '', turnstileToken = ''): Promise<{ session?: GatewaySession; response?: Response }> {
    const loginPath = turnstileToken
      ? `/api/user/login?turnstile=${encodeURIComponent(turnstileToken)}`
      : '/api/user/login'
    let response: Response
    try {
      response = await callNewApi(loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await upstreamLoginPayload(username, password)),
      })
    } catch {
      return { response: errorResponse(502, '无法连接 new-api', 'upstream_unreachable') }
    }
    const body = await responseBody(response)
    if (upstreamFailed(response, body)) return { response: errorResponse(upstreamStatus(response, 401), upstreamError(body, '用户名或密码错误')) }
    const data = (body.data || {}) as NewApiLoginData
    if (data.challenge) return { response: errorResponse(409, '该账号需要二次验证，当前版本暂不支持', 'two_factor_required') }
    const accessToken = textValue(data.access_token)
    const refreshCookie = parseRefreshCookie(response)
    const sessionCookie = parseSessionCookie(response)
    const user = userFromLogin(data)
    const hasTokenSession = Boolean(accessToken && refreshCookie && data.session?.sid)
    const hasLegacySession = Boolean(sessionCookie)
    if (!user || (!hasTokenSession && !hasLegacySession)) {
      return { response: errorResponse(502, 'new-api 登录响应不完整', 'upstream_protocol_error') }
    }
    const accessExpiresAt = numberValue(data.access_expires_at, Math.floor((Date.now() + ACCESS_TOKEN_FALLBACK_MS) / 1000)) * 1000
    const now = Date.now()
    const session: GatewaySession = {
      upstreamAuthMode: hasTokenSession ? 'token' : 'legacy-cookie',
      accessToken: randomToken(),
      refreshToken: randomToken(),
      upstreamAccessToken: accessToken,
      upstreamRefreshCookie: refreshCookie,
      upstreamSessionId: data.session?.sid || '',
      upstreamSessionCookie: sessionCookie,
      user,
      emailHint: emailHint || user.email,
      accessExpiresAt,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }
    sessions.set(session.accessToken, session)
    sessions.set(session.refreshToken, session)
    return { session }
  }

  async function refreshSessionOnce(session: GatewaySession): Promise<boolean> {
    if (session.upstreamAuthMode === 'legacy-cookie') {
      const response = await callNewApi('/api/user/self', {
        headers: upstreamAuthHeaders(session),
      })
      const body = await responseBody(response)
      if (upstreamFailed(response, body)) return false
      const data = (body.data || {}) as NewApiUser
      const user = userFromLogin(data as unknown as NewApiLoginData)
      if (user) session.user = user
      session.accessExpiresAt = Date.now() + ACCESS_TOKEN_FALLBACK_MS
      session.expiresAt = Date.now() + SESSION_TTL_MS
      return true
    }
    const response = await callNewApi('/api/user/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `new_api_refresh=${session.upstreamRefreshCookie}`,
        'X-Auth-Session': session.upstreamSessionId,
      },
    })
    const body = await responseBody(response)
    if (upstreamFailed(response, body)) return false
    const data = (body.data || {}) as NewApiLoginData
    const accessToken = textValue(data.access_token)
    const refreshCookie = parseRefreshCookie(response)
    if (!accessToken || !refreshCookie) return false
    session.upstreamAccessToken = accessToken
    session.upstreamRefreshCookie = refreshCookie
    session.accessExpiresAt = numberValue(data.access_expires_at, Math.floor((Date.now() + ACCESS_TOKEN_FALLBACK_MS) / 1000)) * 1000
    if (data.session?.sid) session.upstreamSessionId = data.session.sid
    if (userFromLogin(data)) session.user = userFromLogin(data)!
    session.expiresAt = Date.now() + SESSION_TTL_MS
    return true
  }

  function upstreamAuthHeaders(session: GatewaySession): Record<string, string> {
    if (session.upstreamAuthMode === 'legacy-cookie') {
      // rc.21 的 UserAuth 同时校验 session Cookie 和 New-Api-User 头。
      return {
        Cookie: `session=${session.upstreamSessionCookie}`,
        'New-Api-User': String(session.user.id),
      }
    }
    return { Authorization: `Bearer ${session.upstreamAccessToken}` }
  }

  async function refreshSession(session: GatewaySession): Promise<boolean> {
    const existing = refreshInFlight.get(session)
    if (existing) return existing
    const pending = refreshSessionOnce(session)
    refreshInFlight.set(session, pending)
    try {
      return await pending
    } finally {
      if (refreshInFlight.get(session) === pending) refreshInFlight.delete(session)
    }
  }

  function rotateGatewayTokens(session: GatewaySession): void {
    sessions.delete(session.accessToken)
    sessions.delete(session.refreshToken)
    session.accessToken = randomToken()
    session.refreshToken = randomToken()
    sessions.set(session.accessToken, session)
    sessions.set(session.refreshToken, session)
  }

  function findSession(request: Request): GatewaySession | null {
    const header = request.headers.get('Authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const session = token ? sessions.get(token) : undefined
    if (!session || session.expiresAt <= Date.now()) return null
    return session
  }

  async function fetchAccount(session: GatewaySession): Promise<{ user: NewApiUser; subscriptions: NewApiSubscription[]; plans: NewApiPlan[] } | null> {
    const userResponse = await safeCallNewApi('/api/user/self', {
      headers: upstreamAuthHeaders(session),
    })
    if (!userResponse) return null
    let userBody = await responseBody(userResponse)
    let refreshed = false
    if (userResponse.status === 401) {
      try {
        refreshed = await refreshSession(session)
      } catch {
        return null
      }
    }
    if (userResponse.status === 401 && refreshed) {
      const retry = await safeCallNewApi('/api/user/self', {
        headers: upstreamAuthHeaders(session),
      })
      if (!retry) return null
      userBody = await responseBody(retry)
      if (upstreamFailed(retry, userBody)) return null
    } else if (upstreamFailed(userResponse, userBody)) {
      return null
    }
    const subscriptionResponse = await safeCallNewApi('/api/subscription/self', {
      headers: upstreamAuthHeaders(session),
    })
    if (!subscriptionResponse) return null
    const subscriptionBody = await responseBody(subscriptionResponse)
    // rc.21 没有订阅 API；账户余额仍可由 /api/user/self 提供。
    const subscriptionsUnavailable = session.upstreamAuthMode === 'legacy-cookie' && subscriptionResponse.status === 404
    if (upstreamFailed(subscriptionResponse, subscriptionBody) && !subscriptionsUnavailable) return null
    const plansResponse = await safeCallNewApi('/api/subscription/plans', {
      headers: upstreamAuthHeaders(session),
    })
    if (!plansResponse) return null
    const plansBody = await responseBody(plansResponse)
    const plansUnavailable = session.upstreamAuthMode === 'legacy-cookie' && plansResponse.status === 404
    if (upstreamFailed(plansResponse, plansBody) && !plansUnavailable) return null
    const user = (userBody.data || {}) as NewApiUser
    const subscriptions = subscriptionsUnavailable ? [] : Array.isArray((subscriptionBody.data as JsonRecord | undefined)?.all_subscriptions)
      ? (subscriptionBody.data as JsonRecord).all_subscriptions as NewApiSubscription[]
      : []
    const plans = plansUnavailable ? [] : Array.isArray(plansBody.data) ? plansBody.data as NewApiPlan[] : []
    return { user, subscriptions, plans }
  }

  async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } })
    }
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/healthz') return json({ ok: true })

    if (request.method === 'GET' && url.pathname === '/v1/auth/registration-options') {
      return json({
        openRegistration: config.registrationOpen ?? true,
        // 当前 Gateway 未实现 OTP 发码/校验，避免客户端进入无法完成的验证码流程。
        emailVerificationRequired: false,
      })
    }

    if (request.method === 'POST' && url.pathname === '/v1/auth/register') {
      if (config.registrationOpen === false) return errorResponse(403, '注册已关闭', 'registration_closed')
      const input = await readJson(request)
      const email = textValue(input.email)
      const username = textValue(input.username) || (email ? generatedUsername(email) : '')
      const password = passwordValue(input.password)
      if (!username || !password) return errorResponse(400, 'username（或 email）和 password 为必填项')
      const payload: JsonRecord = { username, password }
      if (email) payload.email = email
      const displayName = textValue(input.displayName) || textValue(input.display_name)
      if (displayName) payload.display_name = displayName
      const verificationCode = textValue(input.verification_code) || textValue(input.emailOtp)
      const affCode = textValue(input.aff_code) || textValue(input.inviteCode)
      const turnstileToken = textValue(input.turnstile_token) || textValue(input.turnstileToken)
      if (verificationCode) payload.verification_code = verificationCode
      if (affCode) payload.aff_code = affCode
      if (turnstileToken) payload.turnstile_token = turnstileToken
      let response: Response
      try {
        const registerPath = turnstileToken
          ? `/api/user/register?turnstile=${encodeURIComponent(turnstileToken)}`
          : '/api/user/register'
        response = await callNewApi(registerPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } catch {
        return errorResponse(502, '无法连接 new-api', 'upstream_unreachable')
      }
      const body = await responseBody(response)
      if (upstreamFailed(response, body)) return errorResponse(upstreamStatus(response, 502), upstreamError(body, '注册失败'))
      const loggedIn = await loginUpstream(username, password, email, turnstileToken)
      if (!loggedIn.session) return loggedIn.response || errorResponse(502, '注册成功，但自动登录失败')
      return json({ ...mapAuth(loggedIn.session, config.commercialMode === true), registeredUsername: username })
    }

    if (request.method === 'POST' && url.pathname === '/v1/auth/login') {
      const input = await readJson(request)
      const suppliedUsername = textValue(input.username)
      const suppliedEmail = textValue(input.email)
      const turnstileToken = textValue(input.turnstile_token) || textValue(input.turnstileToken)
      // new-api 的登录查询同时支持 username 和 email，保留用户输入以兼容既有账户。
      const username = suppliedUsername || suppliedEmail
      const password = passwordValue(input.password)
      if (!username || !password) return errorResponse(400, 'username（或 email）和 password 为必填项')
      let result = await loginUpstream(username, password, suppliedEmail, turnstileToken)
      // new-api 仅在启用邮箱注册校验时把 email 写入用户表。对 Gateway 创建的账户，
      // 首次用邮箱登录失败时再尝试同一规则生成的用户名，兼容该部署配置。
      if (!result.session && suppliedEmail && !suppliedUsername) {
        const fallbackUsername = generatedUsername(suppliedEmail)
        if (fallbackUsername !== username) result = await loginUpstream(fallbackUsername, password, suppliedEmail, turnstileToken)
      }
      if (!result.session) return result.response || errorResponse(502, '登录失败')
      return json(mapAuth(result.session, config.commercialMode === true))
    }

    if (request.method === 'POST' && url.pathname === '/v1/auth/refresh') {
      const input = await readJson(request)
      const refreshToken = textValue(input.refreshToken)
      const session = refreshToken ? sessions.get(refreshToken) : null
      if (!session || session.expiresAt <= Date.now()) return errorResponse(401, '登录已过期，请重新登录')
      let refreshed = false
      try {
        refreshed = await refreshSession(session)
      } catch {
        return errorResponse(502, '无法连接 new-api', 'upstream_unreachable')
      }
      if (!refreshed) return errorResponse(401, '登录已过期，请重新登录')
      // 并发 refresh 共享同一次上游轮换；只有持有当前代 token 的请求负责轮换
      // Gateway token，其他并发请求返回同一代结果，避免首个响应立即失效。
      if (session.refreshToken === refreshToken) rotateGatewayTokens(session)
      return json(mapAuth(session, config.commercialMode === true))
    }

    if (request.method === 'POST' && url.pathname === '/v1/auth/logout') {
      const session = findSession(request)
      if (session) {
        if (session.upstreamAuthMode === 'legacy-cookie') {
          await callNewApi('/api/user/logout', {
            headers: { Cookie: `session=${session.upstreamSessionCookie}` },
          }).catch(() => undefined)
        } else {
          await callNewApi('/api/user/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.upstreamAccessToken}`, Cookie: `new_api_refresh=${session.upstreamRefreshCookie}`, 'X-Auth-Session': session.upstreamSessionId },
          }).catch(() => undefined)
        }
        sessions.delete(session.accessToken)
        sessions.delete(session.refreshToken)
      }
      return json({ success: true })
    }

    if (request.method === 'GET' && url.pathname === '/v1/account/credits') {
      const session = findSession(request)
      if (!session) return errorResponse(401, '未登录')
      const account = await fetchAccount(session)
      if (!account) return errorResponse(502, '无法读取 new-api 账户信息')
      const quota = numberValue(account.user.quota)
      const usedQuota = numberValue(account.user.used_quota)
      const planMap = new Map<number, NonNullable<NewApiPlan['plan']>>()
      for (const item of account.plans) if (item.plan?.id !== undefined) planMap.set(item.plan.id, item.plan)
      const subscriptions = account.subscriptions.map((item) => {
        const subscription = item.subscription || {}
        const plan = subscription.plan_id === undefined ? undefined : planMap.get(subscription.plan_id)
        const total = numberValue(subscription.amount_total)
        const used = numberValue(subscription.amount_used)
        return {
          ...subscription,
          planTitle: plan?.title || `Plan ${subscription.plan_id ?? ''}`.trim(),
          quotaRemaining: Math.max(0, total - used),
          quotaTotal: total,
          quotaUsed: used,
        }
      })
      const active = subscriptions.find((item) => {
        const endTime = numberValue(item.end_time)
        // new-api 用 0 表示永久订阅。
        return item.status === 'active' && (endTime === 0 || endTime > Math.floor(Date.now() / 1000))
      })
      const activePlan = active?.plan_id === undefined ? undefined : planMap.get(active.plan_id)
      const activeEndTime = active ? numberValue(active.end_time) : 0
      return json({
        success: true,
        balance: quota / QUOTA_PER_CURRENCY_UNIT,
        lifetimeConsumed: usedQuota / QUOTA_PER_CURRENCY_UNIT,
        membershipTier: account.user.group || 'free',
        isVip: false,
        wallet: { quota, usedQuota, remainingQuota: quota },
        subscriptions,
        subscription: active ? {
          hasSubscription: true,
          plan: active.planTitle,
          cycle: activePlan?.duration_unit === 'year' || activePlan?.duration_unit === 'yearly' ? 'yearly' : 'monthly',
          status: active.status,
          startedAt: numberValue(active.start_time) * 1000,
          ...(activeEndTime > 0 ? { expiresAt: activeEndTime * 1000 } : {}),
        } : { hasSubscription: false },
        user: account.user,
      })
    }

    return errorResponse(404, '接口不存在')
  }

  return { fetch: handle, sessions }
}

if (import.meta.main) {
  const config: GatewayConfig = {
    newApiBaseUrl: process.env.NEW_API_BASE_URL || 'http://127.0.0.1:3000',
    port: Number(process.env.MIRA_GATEWAY_PORT || DEFAULT_PORT),
    newApiOrigin: process.env.NEW_API_ORIGIN,
    passwordEncryption: process.env.NEW_API_PASSWORD_ENCRYPTION === 'required'
      ? 'required'
      : process.env.NEW_API_PASSWORD_ENCRYPTION === 'disabled' ? 'disabled' : 'auto',
    commercialMode: process.env.MIRA_GATEWAY_COMMERCIAL_MODE === 'true',
    registrationOpen: process.env.MIRA_GATEWAY_REGISTRATION_OPEN !== 'false',
    registrationEmailVerificationRequired: process.env.MIRA_GATEWAY_REGISTRATION_EMAIL_VERIFICATION === 'true',
  }
  const server = Bun.serve({ port: config.port, fetch: createGateway(config).fetch })
  console.log(`[Mira Gateway] 已启动: http://127.0.0.1:${server.port}`)
  console.log(`[Mira Gateway] new-api: ${config.newApiBaseUrl}`)
}
