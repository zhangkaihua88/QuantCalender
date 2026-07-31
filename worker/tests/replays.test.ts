import { describe, expect, it } from 'vitest'
import { replayInputSchema } from '@wq-calendar/shared'
import { canonicalReplayUrl, detectReplayProvider, parseReplayOccurrenceFilter, publishedReplayOccurrenceKeys } from '../src/replays'
import { hiddenMemberIdentity, visibleMemberIdentity } from '../src/identity'
import { encryptWqId } from '../src/crypto'
import type { Env } from '../src/env'

describe('replay link handling', () => {
  it('normalizes equivalent URLs before duplicate hashing', () => {
    expect(canonicalReplayUrl('https://PAN.BAIDU.com/s/example/#section')).toBe('https://pan.baidu.com/s/example#section')
  })

  it('detects common providers without trusting a user supplied provider name', () => {
    expect(detectReplayProvider('https://pan.baidu.com/s/example')).toBe('baidu')
    expect(detectReplayProvider('https://pan.quark.cn/s/example')).toBe('quark')
    expect(detectReplayProvider('https://drive.google.com/file/d/example')).toBe('google_drive')
    expect(detectReplayProvider('https://files.example.com/replay')).toBe('other')
  })

  it('accepts HTTPS replay submissions and rejects unsafe URLs', () => {
    const valid = { groupId:null, eventId:null, occurrenceKey:null, title:'顾问周会', meetingDate:'2026-07-24', shareUrl:'https://example.com/replay', accessCode:'3k8p', note:'' }
    expect(replayInputSchema.safeParse(valid).success).toBe(true)
    expect(replayInputSchema.safeParse({ ...valid, shareUrl:'http://example.com/replay' }).success).toBe(false)
    expect(replayInputSchema.safeParse({ ...valid, shareUrl:'https://user:pass@example.com/replay' }).success).toBe(false)
    expect(replayInputSchema.safeParse({ ...valid, meetingDate:'2026-02-30' }).success).toBe(false)
    expect(replayInputSchema.safeParse({ ...valid, eventId:crypto.randomUUID(), occurrenceKey:null }).success).toBe(false)
  })

  it('validates exact occurrence filters as a complete pair', () => {
    const eventId = crypto.randomUUID()
    const occurrenceKey = '2026-07-24T10:00:00Z'
    expect(parseReplayOccurrenceFilter('', '')).toEqual({ success:true, data:null })
    expect(parseReplayOccurrenceFilter(eventId, occurrenceKey)).toEqual({ success:true, data:{ eventId, occurrenceKey } })
    expect(parseReplayOccurrenceFilter(eventId, '')).toEqual({ success:false, reason:'pair' })
    expect(parseReplayOccurrenceFilter('not-a-uuid', occurrenceKey)).toEqual({ success:false, reason:'invalid' })
  })

  it('loads only published replay availability for linked event occurrences', async () => {
    let query = ''
    let values: unknown[] = []
    const statement = { bind:(...bound: unknown[]) => { values = bound; return statement } }
    const env = { DB:{
      prepare:(sql: string) => { query = sql; return statement },
      batch:async () => [{ results:[{ event_id:'event-1', occurrence_key:'2026-07-24T10:00:00Z' }] }]
    } } as unknown as Env

    const keys = await publishedReplayOccurrenceKeys(env, ['event-1', 'event-1'])
    expect([...keys]).toEqual(['event-1:2026-07-24T10:00:00Z'])
    expect(query).toContain("rl.status = 'published'")
    expect(values).toEqual(['event-1'])
  })
})

describe('member identity visibility', () => {
  it('reveals full IDs only when the member preference or admin role permits it', async () => {
    const secret = 'identity-test-secret'
    const row = { wq_id_hint:'••••2345', wq_id_ciphertext:await encryptWqId('KZ12345', secret), public_wq_id:1 }
    const env = { WQ_ID_HMAC_SECRET:secret } as Env
    expect(await visibleMemberIdentity(row, env, 'member')).toEqual({ wqId:'KZ12345', hasFullWqId:true })
    expect(await visibleMemberIdentity({ ...row, public_wq_id:0 }, env, 'member')).toEqual({ wqId:'KZ', hasFullWqId:false })
    expect(await visibleMemberIdentity({ ...row, public_wq_id:0 }, env, 'admin')).toEqual({ wqId:'KZ12345', hasFullWqId:true })
    expect(await visibleMemberIdentity({ ...row, wq_id_ciphertext:null, public_wq_id:0 }, env, 'member')).toEqual({ wqId:'成员', hasFullWqId:false })
    expect(hiddenMemberIdentity('a1b234')).toBe('AB')
  })

  it('applies the visibility preference to an administrator WQ_ID listed as a member', async () => {
    const secret = 'identity-test-secret'
    const env = { ADMIN_WQ_ID:'KZ79256', WQ_ID_HMAC_SECRET:secret } as Env
    const row = {
      wq_id_hint:'••••9256',
      wq_id_ciphertext:await encryptWqId('KZ79256', secret),
      public_wq_id:0
    }
    expect(await visibleMemberIdentity(row, env, 'member')).toEqual({ wqId:'KZ', hasFullWqId:false })
    expect(await visibleMemberIdentity(row, env, 'admin')).toEqual({ wqId:'KZ79256', hasFullWqId:true })
  })
})
