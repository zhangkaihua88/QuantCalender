import { Temporal } from '@js-temporal/polyfill'
import type { Recurrence } from '@wq-calendar/shared'
import type { EventRow, ExceptionRow } from './events'

const encoder = new TextEncoder()

function escapeText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\r\n', '\\n').replaceAll('\r', '\\n').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
}

function formatUtc(value: string): string {
  const instant = Temporal.Instant.from(value)
  const date = instant.toZonedDateTimeISO('UTC')
  return `${date.year.toString().padStart(4, '0')}${date.month.toString().padStart(2, '0')}${date.day.toString().padStart(2, '0')}T${date.hour.toString().padStart(2, '0')}${date.minute.toString().padStart(2, '0')}${date.second.toString().padStart(2, '0')}Z`
}

function formatLocal(value: string): string {
  const date = Temporal.PlainDateTime.from(value)
  return `${date.year.toString().padStart(4, '0')}${date.month.toString().padStart(2, '0')}${date.day.toString().padStart(2, '0')}T${date.hour.toString().padStart(2, '0')}${date.minute.toString().padStart(2, '0')}${date.second.toString().padStart(2, '0')}`
}

function foldLine(line: string): string[] {
  if (encoder.encode(line).length <= 75) return [line]
  const lines: string[] = []
  let current = ''
  for (const character of line) {
    const prefix = lines.length === 0 ? '' : ' '
    if (encoder.encode(prefix + current + character).length > 75) {
      lines.push((lines.length === 0 ? '' : ' ') + current)
      current = character
    } else {
      current += character
    }
  }
  if (current) lines.push((lines.length === 0 ? '' : ' ') + current)
  return lines
}

function recurrenceRule(event: EventRow): string | null {
  const recurrence = JSON.parse(event.recurrence_json) as Recurrence
  if (recurrence.kind === 'none' || !recurrence.untilLocal) return null
  const until = Temporal.PlainDateTime.from(recurrence.untilLocal).toZonedDateTime('Asia/Shanghai').toInstant().toString()
  if (recurrence.kind === 'monthly') return `FREQ=MONTHLY;INTERVAL=1;UNTIL=${formatUtc(until)}`
  return `FREQ=WEEKLY;INTERVAL=${recurrence.kind === 'biweekly' ? 2 : 1};UNTIL=${formatUtc(until)}`
}

function alarmLines(minutes: number): string[] {
  const trigger = minutes === 1440 ? '-P1D' : `-PT${minutes}M`
  return ['BEGIN:VALARM', `TRIGGER:${trigger}`, 'ACTION:DISPLAY', 'DESCRIPTION:WQ Meeting Calendar 会议提醒', 'END:VALARM']
}

function baseEventLines(event: EventRow, alarmMinutes: number): string[] {
  const rule = recurrenceRule(event)
  const endLocal = Temporal.PlainDateTime.from(event.start_beijing).add({ minutes: event.duration_minutes }).toString()
  const description = `注册链接：${event.registration_url}`
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(new Date(event.updated_at).toISOString())}`,
    `LAST-MODIFIED:${formatUtc(new Date(event.updated_at).toISOString())}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTART;TZID=Asia/Shanghai:${formatLocal(event.start_beijing)}`,
    `DTEND;TZID=Asia/Shanghai:${formatLocal(endLocal)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${event.registration_url}`,
    `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE'
  ]
  if (rule) lines.push(`RRULE:${rule}`)
  if (event.status !== 'cancelled') lines.push(...alarmLines(alarmMinutes))
  lines.push('END:VEVENT')
  return lines
}

function exceptionLines(event: EventRow, exception: ExceptionRow, alarmMinutes: number): string[] {
  const original = Temporal.Instant.from(exception.occurrence_key).toZonedDateTimeISO('Asia/Shanghai').toPlainDateTime().toString()
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `RECURRENCE-ID;TZID=Asia/Shanghai:${formatLocal(original)}`,
    `DTSTAMP:${formatUtc(new Date(event.updated_at).toISOString())}`,
    `SEQUENCE:${event.sequence}`,
    `SUMMARY:${escapeText(event.title)}`
  ]
  if (exception.action === 'cancel') {
    lines.push(`DTSTART;TZID=Asia/Shanghai:${formatLocal(original)}`, 'STATUS:CANCELLED')
  } else if (exception.override_start_local && exception.override_end_local && exception.override_timezone) {
    lines.push(
      `DTSTART;TZID=${exception.override_timezone}:${formatLocal(exception.override_start_local)}`,
      `DTEND;TZID=${exception.override_timezone}:${formatLocal(exception.override_end_local)}`,
      `DESCRIPTION:${escapeText([exception.note, `注册链接：${event.registration_url}`].filter(Boolean).join('\n\n'))}`,
      `URL:${event.registration_url}`,
      'STATUS:CONFIRMED',
      ...alarmLines(alarmMinutes)
    )
  }
  lines.push('END:VEVENT')
  return lines
}

export function buildCalendarIcs(events: EventRow[], exceptions: ExceptionRow[], alarmMinutes = 30): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//WQ Meeting Calendar//ZH-CN//EN',
    'X-WR-CALNAME:WQ Meeting Calendar',
    'X-WR-TIMEZONE:Asia/Shanghai'
  ]
  for (const event of events) {
    lines.push(...baseEventLines(event, alarmMinutes))
    for (const exception of exceptions.filter((item) => item.event_id === event.id)) {
      lines.push(...exceptionLines(event, exception, alarmMinutes))
    }
  }
  lines.push('END:VCALENDAR')
  return lines.flatMap(foldLine).join('\r\n') + '\r\n'
}
