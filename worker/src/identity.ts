import type { Env, Role } from './env'
import { decryptWqId } from './crypto'

export type MemberIdentityRow = {
  wq_id_hint: string | null
  wq_id_ciphertext: string | null
  public_wq_id: number | null
}

export async function visibleMemberIdentity(row: MemberIdentityRow | null, env: Env, viewerRole: Role) {
  if (!row) return { wqId: '管理员', hasFullWqId: true }
  const mayReveal = viewerRole === 'admin' || row.public_wq_id === 1
  if (mayReveal && row.wq_id_ciphertext) {
    try {
      return { wqId: await decryptWqId(row.wq_id_ciphertext, env.WQ_ID_HMAC_SECRET), hasFullWqId: true }
    } catch { /* Fall back to the non-sensitive hint when historical ciphertext is unavailable. */ }
  }
  return { wqId: row.wq_id_hint || '成员', hasFullWqId: false }
}
