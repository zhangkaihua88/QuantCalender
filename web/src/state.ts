import { reactive } from 'vue'
import type { SessionUser } from '@wq-calendar/shared'
import { api, clearCsrf } from './api'

export const session = reactive<{
  user: SessionUser | null
  ready: boolean
}>({ user: null, ready: false })

let bootstrapPromise: Promise<void> | null = null

export function bootstrapSession() {
  if (bootstrapPromise) return bootstrapPromise
  bootstrapPromise = api<{ user: SessionUser }>('/v1/me')
    .then((data) => { session.user = data.user })
    .catch(() => { session.user = null })
    .finally(() => { session.ready = true })
  return bootstrapPromise
}

export function setUser(user: SessionUser) {
  session.user = user
  session.ready = true
}

export async function logout() {
  try { await api<void>('/v1/session', { method: 'DELETE' }) } finally {
    session.user = null
    clearCsrf()
  }
}
