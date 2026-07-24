import { Temporal } from '@js-temporal/polyfill'
import type { MeetingInput, MeetingOccurrence, Recurrence } from '@wq-calendar/shared'

export interface EventRow {
  id: string
  uid: string
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'cancelled'
  submitter_member_id: string | null
  title: string
  category: string
  meeting_language: 'zh' | 'en' | 'bilingual' | 'other'
  registration_url: string
  start_beijing: string
  duration_minutes: number
  recurrence_json: string
  sequence: number
  review_note: string
  created_by: string
  reviewed_by: string | null
  created_at: number
  updated_at: number
  published_at: number | null
}

export interface ExceptionRow {
  id: string
  event_id: string
  occurrence_key: string
  action: 'cancel' | 'override'
  override_start_local: string | null
  override_end_local: string | null
  override_timezone: string | null
  note: string
}

export function normalizeMeetingTimes(input: MeetingInput) {
  const startPlain = Temporal.PlainDateTime.from(input.startLocal)
  const endPlain = startPlain.add({ minutes: input.durationMinutes })
  const startZoned = startPlain.toZonedDateTime('Asia/Shanghai')
  const endZoned = endPlain.toZonedDateTime('Asia/Shanghai')
  if (input.recurrence.untilLocal) {
    const until = Temporal.PlainDateTime.from(input.recurrence.untilLocal)
    const maximum = startPlain.add({ months: 12 })
    if (Temporal.PlainDateTime.compare(until, maximum) > 0) throw new Error('RECURRENCE_TOO_LONG')
  }
  const durationMinutes = Math.round(Number(endZoned.epochMilliseconds - startZoned.epochMilliseconds) / 60000)
  return {
    startUtc: startZoned.toInstant().toString(),
    endUtc: endZoned.toInstant().toString(),
    durationMinutes
  }
}

function monthlyOccurrence(original: Temporal.PlainDateTime, monthOffset: number): Temporal.PlainDateTime | null {
  const firstOfMonth = original.with({ day: 1 }).add({ months: monthOffset })
  if (original.day > firstOfMonth.daysInMonth) return null
  return firstOfMonth.with({ day: original.day })
}

export function expandEvent(event: EventRow, exceptions: ExceptionRow[], from: string, to: string): MeetingOccurrence[] {
  const rangeStart = Temporal.Instant.from(from)
  const rangeEnd = Temporal.Instant.from(to)
  const recurrence = JSON.parse(event.recurrence_json) as Recurrence
  const original = Temporal.PlainDateTime.from(event.start_beijing)
  const until = recurrence.untilLocal ? Temporal.PlainDateTime.from(recurrence.untilLocal) : original
  const exceptionMap = new Map(exceptions.map((item) => [item.occurrence_key, item]))
  const localStarts: Temporal.PlainDateTime[] = []

  if (recurrence.kind === 'none') {
    localStarts.push(original)
  } else if (recurrence.kind === 'monthly') {
    for (let month = 0; month <= 12; month += 1) {
      const candidate = monthlyOccurrence(original, month)
      if (!candidate) continue
      if (Temporal.PlainDateTime.compare(candidate, until) > 0) break
      localStarts.push(candidate)
    }
  } else {
    const step = recurrence.kind === 'biweekly' ? 14 : 7
    for (let day = 0; day <= 370; day += step) {
      const candidate = original.add({ days: day })
      if (Temporal.PlainDateTime.compare(candidate, until) > 0) break
      localStarts.push(candidate)
    }
  }

  const result: MeetingOccurrence[] = []
  for (const localStart of localStarts.slice(0, 80)) {
    const zoned = localStart.toZonedDateTime('Asia/Shanghai')
    const key = zoned.toInstant().toString()
    const exception = exceptionMap.get(key)
    let startInstant = zoned.toInstant()
    let endInstant = startInstant.add({ minutes: event.duration_minutes })
    let status: 'published' | 'cancelled' = event.status === 'cancelled' ? 'cancelled' : 'published'
    if (exception?.action === 'cancel') status = 'cancelled'
    if (exception?.action === 'override' && exception.override_start_local && exception.override_end_local && exception.override_timezone) {
      startInstant = Temporal.PlainDateTime.from(exception.override_start_local).toZonedDateTime(exception.override_timezone).toInstant()
      endInstant = Temporal.PlainDateTime.from(exception.override_end_local).toZonedDateTime(exception.override_timezone).toInstant()
    }
    if (Temporal.Instant.compare(endInstant, rangeStart) < 0 || Temporal.Instant.compare(startInstant, rangeEnd) > 0) continue
    result.push({
      eventId: event.id,
      occurrenceKey: key,
      title: event.title,
      summary: event.title,
      organizer: 'WQ',
      speaker: '',
      category: event.category,
      meetingLanguage: event.meeting_language,
      locationType: 'online',
      locationText: '线上会议',
      registrationUrl: event.registration_url,
      sourceTimezone: exception?.override_timezone || 'Asia/Shanghai',
      startUtc: startInstant.toString(),
      endUtc: endInstant.toString(),
      status,
      isException: Boolean(exception)
    })
  }
  return result
}

export function publicEvent(event: EventRow) {
  const normalized = normalizeMeetingTimes({
    title: event.title,
    category: event.category,
    meetingLanguage: event.meeting_language,
    registrationUrl: event.registration_url,
    startLocal: event.start_beijing,
    durationMinutes: event.duration_minutes as MeetingInput['durationMinutes'],
    recurrence: JSON.parse(event.recurrence_json) as Recurrence
  })
  const endLocal = Temporal.PlainDateTime.from(event.start_beijing).add({ minutes: event.duration_minutes }).toString()
  return {
    id: event.id,
    uid: event.uid,
    status: event.status,
    title: event.title,
    summary: event.title,
    description: '',
    organizer: 'WQ',
    speaker: '',
    category: event.category,
    meetingLanguage: event.meeting_language,
    locationType: 'online',
    locationText: '线上会议',
    registrationUrl: event.registration_url,
    registrationDeadlineUtc: null,
    sourceTimezone: 'Asia/Shanghai',
    startLocal: event.start_beijing,
    endLocal,
    startUtc: normalized.startUtc,
    endUtc: normalized.endUtc,
    durationMinutes: event.duration_minutes,
    recurrence: JSON.parse(event.recurrence_json) as Recurrence,
    sequence: event.sequence,
    reviewNote: event.review_note,
    createdAt: new Date(event.created_at).toISOString(),
    updatedAt: new Date(event.updated_at).toISOString()
  }
}
