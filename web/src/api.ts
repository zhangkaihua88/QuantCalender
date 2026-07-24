import type { ApiErrorShape } from '@wq-calendar/shared'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '')

let csrfToken = ''

export class ApiError extends Error {
  code: string
  fieldErrors?: Record<string, string[]>

  constructor(payload: ApiErrorShape['error']) {
    super(payload.message)
    this.code = payload.code
    this.fieldErrors = payload.fieldErrors
  }
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch(`${API_BASE_URL}/v1/session/csrf`, { credentials: 'include' })
  if (!response.ok) throw await toApiError(response)
  const data = await response.json() as { csrfToken: string }
  csrfToken = data.csrfToken
  return csrfToken
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = await response.json() as ApiErrorShape
    return new ApiError(payload.error)
  } catch {
    return new ApiError({ code: 'NETWORK_ERROR', message: '服务暂时不可用', requestId: 'unknown' })
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-Token', await ensureCsrf())
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function login(path: '/v1/session/member' | '/v1/session/admin', body: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  })
  if (!response.ok) throw await toApiError(response)
  const data = await response.json() as { user: unknown; csrfToken: string }
  csrfToken = data.csrfToken
  return data
}

export function clearCsrf() {
  csrfToken = ''
}
