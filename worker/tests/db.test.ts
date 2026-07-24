import { describe, expect, it } from 'vitest'
import type { Env } from '../src/env'
import { listPublishedEvents } from '../src/db'

describe('listPublishedEvents', () => {
  it('sorts with the simplified Beijing-time column', async () => {
    let query = ''
    const env = {
      DB: {
        prepare(sql: string) {
          query = sql
          return { all: async () => ({ results: [] }) }
        }
      }
    } as unknown as Env

    await listPublishedEvents(env)

    expect(query).toContain('ORDER BY start_beijing ASC')
    expect(query).not.toContain('start_utc')
  })
})
