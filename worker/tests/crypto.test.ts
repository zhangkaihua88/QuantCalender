import { describe, expect, it } from 'vitest'
import { constantTimeEqual, decryptWqId, encryptWqId, normalizeWqId, sha256, wqIdHint } from '../src/crypto'

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
  it('encrypts WQ ids with randomized authenticated encryption', async () => {
    const first = await encryptWqId(' kz79256 ', 'a-high-entropy-test-secret')
    const second = await encryptWqId('KZ79256', 'a-high-entropy-test-secret')
    expect(first).not.toBe(second)
    expect(await decryptWqId(first, 'a-high-entropy-test-secret')).toBe('KZ79256')
    await expect(decryptWqId(first, 'wrong-secret')).rejects.toThrow()
  })
})
