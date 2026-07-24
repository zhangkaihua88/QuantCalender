import { describe, expect, it } from 'vitest'
import { buildCalendarIcs } from '../src/ics'
import type { EventRow } from '../src/events'

const event: EventRow = {
  id:'1', uid:'stable@example', status:'published', submitter_member_id:null, title:'研究分享,第一期',
  category:'培训', meeting_language:'zh', registration_url:'https://example.com/register',
  start_beijing:'2026-08-01T10:00:00', duration_minutes:60,
  recurrence_json:JSON.stringify({kind:'weekly',untilLocal:'2026-08-31T10:00:00'}), sequence:2, review_note:'', created_by:'admin', reviewed_by:null,
  created_at:0, updated_at:Date.parse('2026-07-23T00:00:00Z'), published_at:0
}

describe('buildCalendarIcs', () => {
  it('creates a stable recurring calendar event with escaped Chinese text', () => {
    const output = buildCalendarIcs([event], [], 30)
    expect(output).toContain('UID:stable@example')
    expect(output).toContain('SEQUENCE:2')
    expect(output).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=')
    expect(output).toContain('TRIGGER:-PT30M')
    expect(output).toContain('研究分享\\,第一期')
    expect(output).toContain('注册链接：https://example.com/register')
    expect(output).toContain('LAST-MODIFIED:')
    expect(output.endsWith('\r\n')).toBe(true)
  })
})
