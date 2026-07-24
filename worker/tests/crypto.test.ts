import { describe, expect, it } from 'vitest'
import { constantTimeEqual, normalizeWqId, sha256, wqIdHint } from '../src/crypto'

describe('crypto helpers', () => {
  it('normalizes and masks WQ ids', () => {
    expect(normalizeWqId('  abc123  ')).toBe('ABC123')
    expect(wqIdHint('abc123')).toBe('••••C123')
  })
  it('compares hashes', async () => {
    const hash = await sha256('secret')
    expect(constantTimeEqual(hash, hash)).toBe(true)
    expect(constantTimeEqual(hash, await sha256('other'))).toBe(false)
  })
})
