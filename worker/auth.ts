/**
 * 单密码访问门禁：无账号体系，登录成功签发无状态会话 Cookie。
 * 会话 = 过期时间戳 + HMAC-SHA256(AUTH_SECRET) 签名，不落库、不占 D1 写额度；
 * 密码、会话密钥与 Turnstile 核销密钥来自 Worker secrets（线上 `wrangler secret put`，本地 .dev.vars）。
 * 密钥未配置时全部拒绝（fail closed）。不做登录限速，防人机 / 防爆破由 Cloudflare Turnstile
 * 承担：登录必须携带前端 widget 签发的 token，服务端经 siteverify 核销后才校验密码（token 一次性）。
 */
import { httpError, readJson } from './http'

const SESSION_COOKIE = 'park_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** 与 LoginPage 渲染 widget 时的 action 保持一致，siteverify 响应带错 action 即拒绝 */
const TURNSTILE_ACTION = 'login'
/** Turnstile token 官方上限 2048 字符，超长按未完成验证处理 */
const TURNSTILE_TOKEN_MAX_LENGTH = 2048

// ===== 加密工具 =====

/** SHA-256 摘要：密码只比较摘要，不做明文比对 */
async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return new Uint8Array(digest)
}

async function hmacSign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return new Uint8Array(signature)
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 常量时间比较：逐字节异或累计；输入为定长摘要，长度差异不构成泄露 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

// ===== 会话 Cookie =====

function readSessionToken(request: Request): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const pair = part.trim()
    if (pair.startsWith(`${SESSION_COOKIE}=`)) return pair.slice(SESSION_COOKIE.length + 1)
  }
  return null
}

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  if (!/^\d+$/.test(exp) || Number(exp) <= Date.now()) return false
  const expected = base64UrlEncode(await hmacSign(exp, secret))
  const received = new TextEncoder().encode(token.slice(dot + 1))
  return timingSafeEqual(received, new TextEncoder().encode(expected))
}

/** 其余全部 /api 的统一守卫：持有未过期且验签通过的会话才算已登录 */
export async function isAuthed(request: Request, env: Env): Promise<boolean> {
  if (!env.AUTH_SECRET) return false
  const token = readSessionToken(request)
  return token !== null && verifySessionToken(token, env.AUTH_SECRET)
}

/** HttpOnly 会话 Cookie；localhost/127.0.0.1 的 http dev 不带 Secure */
function sessionCookie(request: Request, value: string, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
}

function cookieResponse(body: unknown, cookie: string): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': cookie },
  })
}

/** 签发全新有效期的会话 token（登录 / check 滑动续签共用） */
async function issueSessionToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS)
  return `${exp}.${base64UrlEncode(await hmacSign(exp, secret))}`
}

interface TurnstileSiteverifyResult {
  success?: boolean
  action?: string
}

/**
 * 服务端核销 Turnstile token（官方要求浏览器不得直调 siteverify，必须经后端转发）。
 * secret / response 表单提交，10s 超时；任何异常一律视为未通过（fail closed）。
 * 不传 remoteip：挑战解题 IP 与登录请求 IP 可能不同（本地回环、双栈网络），会误拒真实用户，
 * 且 token 本身已绑定 sitekey 且一次性，remoteip 的边际收益抵不过误拒风险。
 */
async function verifyTurnstileToken(env: Env, token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return false
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token })
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return false
    const result = (await res.json()) as TurnstileSiteverifyResult
    if (result.success !== true) return false
    // 本地用官方测试密钥联调时响应可能不带 action，只在带错 action 时拦
    return result.action === undefined || result.action === TURNSTILE_ACTION
  } catch {
    return false
  }
}

/** POST /api/auth/login —— 核销 Turnstile token，校验密码并签发会话 Cookie */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_PASSWORD || !env.AUTH_SECRET) {
    return httpError(500, '服务端未配置访问密码（AUTH_PASSWORD / AUTH_SECRET）')
  }
  if (!env.TURNSTILE_SECRET) {
    return httpError(500, '服务端未配置人机验证密钥（TURNSTILE_SECRET）')
  }

  const body = await readJson<{ password?: unknown; turnstileToken?: unknown }>(request)

  // 人机验证先于密码校验：token 一次性，无论后续成败都已被核销，前端失败后要 reset 重取
  const token = typeof body?.turnstileToken === 'string' ? body.turnstileToken.trim() : ''
  if (token.length === 0 || token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return httpError(400, '请先完成人机验证')
  }
  if (!(await verifyTurnstileToken(env, token))) {
    return httpError(403, '人机验证未通过，请重试')
  }

  const password = typeof body?.password === 'string' ? body.password : ''
  const matched =
    password.length > 0 &&
    timingSafeEqual(await sha256(password), await sha256(env.AUTH_PASSWORD))
  if (!matched) return httpError(401, '密码不正确')

  const sessionToken = await issueSessionToken(env.AUTH_SECRET)
  return cookieResponse(
    { ok: true },
    sessionCookie(request, sessionToken, Math.floor(SESSION_TTL_MS / 1000)),
  )
}

/** GET /api/auth/check —— 前端启动时探测会话；验证通过则滑动续签（重发满有效期 Cookie） */
export async function handleCheck(request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_SECRET || !(await isAuthed(request, env))) {
    return httpError(401, '未登录或会话已过期')
  }
  const sessionToken = await issueSessionToken(env.AUTH_SECRET)
  return cookieResponse(
    { ok: true },
    sessionCookie(request, sessionToken, Math.floor(SESSION_TTL_MS / 1000)),
  )
}

/** POST /api/auth/logout —— 清除会话 Cookie（无状态会话，服务端无吊销列表） */
export async function handleLogout(request: Request): Promise<Response> {
  return cookieResponse({ ok: true }, sessionCookie(request, '', 0))
}
