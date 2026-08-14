import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const SESSION_TTL = 1000 * 60 * 60 * 24 * 7

export function getAccessToken(): string {
  const config = useRuntimeConfig()
  return config.accessToken as string
}

export function isAuthConfigured(): boolean {
  return getAccessToken().length > 0
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    return false
  }
  return timingSafeEqual(ba, bb)
}

export function verifyAccessToken(input: string): boolean {
  const expected = getAccessToken()
  if (!expected || !input) {
    return false
  }
  return safeEqual(input, expected)
}

function sign(expiresAt: string): string {
  return createHmac('sha256', getAccessToken()).update(expiresAt).digest('hex')
}

export function createSessionToken(): string {
  const expiresAt = String(Date.now() + SESSION_TTL)
  return `${expiresAt}.${sign(expiresAt)}`
}

export function verifySessionToken(token: string): boolean {
  if (!token || !isAuthConfigured()) {
    return false
  }
  const dotIndex = token.indexOf('.')
  if (dotIndex <= 0) {
    return false
  }
  const expiresAt = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)
  const expiresMs = Number(expiresAt)
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) {
    return false
  }
  return safeEqual(signature, sign(expiresAt))
}

export function resolveAuthToken(event: H3Event): string {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const queryToken = getQuery(event).token
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken
  }

  return ''
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  const session = await getUserSession(event)
  if (session.user) {
    return true
  }

  const token = resolveAuthToken(event)
  if (token && verifySessionToken(token)) {
    return true
  }

  return false
}

export async function isWsAuthenticated(request: Request): Promise<boolean> {
  const url = new URL(request.url)
  const queryToken = url.searchParams.get('token')
  if (queryToken && verifySessionToken(queryToken)) {
    return true
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    if (verifySessionToken(authHeader.slice(7))) {
      return true
    }
  }

  try {
    const session = await getUserSession({
      headers: request.headers,
      context: {}
    })
    return Boolean(session.user)
  } catch {
    return false
  }
}
