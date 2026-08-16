import type { H3Event } from 'h3'

const ALLOWED_HEADERS = 'authorization, content-type'
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS'

const DEFAULT_ORIGINS = [
  'http://localhost:1420',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost'
]

function getAllowedOrigins(): string[] {
  const config = useRuntimeConfig()
  const raw = (config.allowedOrigins as string) || ''
  const configured = raw.split(',').map(s => s.trim()).filter(Boolean)
  return [...new Set([...DEFAULT_ORIGINS, ...configured])]
}

export function applyCors(event: H3Event) {
  const origin = getHeader(event, 'origin')
  if (!origin) {
    return
  }

  if (getAllowedOrigins().includes(origin)) {
    setResponseHeader(event, 'access-control-allow-origin', origin)
    setResponseHeader(event, 'vary', 'origin')
    setResponseHeader(event, 'access-control-allow-headers', ALLOWED_HEADERS)
    setResponseHeader(event, 'access-control-allow-methods', ALLOWED_METHODS)
  }
}
