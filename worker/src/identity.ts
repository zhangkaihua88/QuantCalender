import type { Env, Role } from './env'
import { decryptWqId, normalizeWqId } from './crypto'

export type MemberIdentityRow = {
  wq_id_hint: string | null
  wq_id_ciphertext: string | null
  public_wq_id: number | null
}

export function hiddenMemberIdentity(wqId: string): string {
  const letters = normalizeWqId(wqId).match(/[A-Z]/g)?.slice(0, 2).join('') || ''
  return letters || '成员'
}

export async function visibleMemberIdentity(row: MemberIdentityRow | null, env: Env, viewerRole: Role) {
  if (!row) return { wqId: '管理员', hasFullWqId: true }
  const mayReveal = viewerRole === 'admin' || row.public_wq_id === 1
  if (row.wq_id_ciphertext) {
    try {
      const fullWqId = await decryptWqId(row.wq_id_ciphertext, env.WQ_ID_HMAC_SECRET)
      return mayReveal
        ? { wqId: fullWqId, hasFullWqId: true }
        : { wqId: hiddenMemberIdentity(fullWqId), hasFullWqId: false }
    } catch { /* Never expose the legacy numeric hint when ciphertext is unavailable. */ }
  }
  const safeLegacyHint = row.wq_id_hint?.match(/^[A-Z]{1,2}$/)?.[0]
  return { wqId: safeLegacyHint || '成员', hasFullWqId: false }
}
