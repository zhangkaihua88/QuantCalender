import { describe, expect, it } from 'vitest'
import { buildCalendarIcs } from '../src/ics'
import type { EventRow } from '../src/events'

const event: EventRow = {
  id:'1', uid:'stable@example', status:'published', submitter_member_id:null, title:'研究分享,第一期', summary:'中文测试',
  description:'第一行\n第二行', organizer:'研究组', speaker:'', category:'培训', meeting_language:'zh', location_type:'online',
  location_text:'线上', registration_url:'https://example.com/register', registration_deadline_utc:null,
  source_timezone:'Asia/Shanghai', start_local:'2026-08-01T10:00:00', end_local:'2026-08-01T11:00:00',
  start_utc:'2026-08-01T02:00:00Z', end_utc:'2026-08-01T03:00:00Z', duration_minutes:60,
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
    expect(output).toContain('第一行\\n第二行')
    expect(output).toContain('LAST-MODIFIED:')
    expect(output.endsWith('\r\n')).toBe(true)
  })
})
