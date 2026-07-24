import { describe, expect, it } from 'vitest'
import { expandEvent, normalizeMeetingTimes, type EventRow } from '../src/events'

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'event-1', uid: 'event-1@example', status: 'published', submitter_member_id: null,
    title: '月度会议', category: '培训', meeting_language: 'zh', registration_url: 'https://example.com/register',
    start_beijing: '2026-01-31T10:00:00',
    duration_minutes: 60, recurrence_json: JSON.stringify({ kind: 'monthly', untilLocal: '2026-04-30T10:00:00' }),
    sequence: 0, review_note: '', created_by: 'admin', reviewed_by: null, created_at: 0, updated_at: 0, published_at: 0,
    ...overrides
  }
}

describe('expandEvent', () => {
  it('normalizes a one-hour Beijing meeting without a client timezone', () => {
    expect(normalizeMeetingTimes({
      title: '顾问周会', category: '顾问周会', meetingLanguage: 'zh',
      registrationUrl: 'https://example.com/register', startLocal: '2026-08-01T18:30:00',
      durationMinutes: 60, recurrence: { kind: 'none', untilLocal: null }
    })).toEqual({
      startUtc: '2026-08-01T10:30:00Z', endUtc: '2026-08-01T11:30:00Z', durationMinutes: 60
    })
  })

  it('skips months that do not contain the original day', () => {
    const result = expandEvent(event(), [], '2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z')
    expect(result.map((item) => item.startUtc)).toEqual(['2026-01-31T02:00:00Z', '2026-03-31T02:00:00Z'])
  })

  it('marks a single occurrence as cancelled', () => {
    const result = expandEvent(event({ recurrence_json: JSON.stringify({ kind: 'weekly', untilLocal: '2026-02-14T10:00:00' }) }), [{
      id: 'x', event_id: 'event-1', occurrence_key: '2026-02-07T02:00:00Z', action: 'cancel', override_start_local: null,
      override_end_local: null, override_timezone: null, note: ''
    }], '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z')
    expect(result.find((item) => item.occurrenceKey === '2026-02-07T02:00:00Z')?.status).toBe('cancelled')
  })
})
