import { describe, expect, it } from 'vitest'
import { importRowsSchema } from '@wq-calendar/shared'

describe('member import schema', () => {
  it('accepts rows with only WQ ID and country', () => {
    const result = importRowsSchema.safeParse({ rows: [{ wqId: 'KZ79256', country: 'CN' }] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.rows[0]).toEqual({ wqId: 'KZ79256', country: 'CN' })
  })

  it('rejects unsupported countries', () => {
    expect(importRowsSchema.safeParse({ rows: [{ wqId: 'TEST01', country: 'US' }] }).success).toBe(false)
  })
})
