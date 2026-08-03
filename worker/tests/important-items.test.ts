import { describe, expect, it } from 'vitest'
import { importantItemInputSchema } from '@wq-calendar/shared'
import { buildCalendarIcs, markdownToPlainText } from '../src/ics'
import type { ImportantItemCalendarDateRow, ImportantItemRow } from '../src/important-items'

const baseItem: ImportantItemRow = {
  id:'item-1', uid:'item-1@wq-meeting-calendar', status:'published', kind:'ppa', submitter_member_id:null,
  title:'PPA 夏季主题', content_markdown:'## 内容\n\n- **重点**\n- [资料](https://example.com/guide)',
  start_date:'2026-08-03', end_date:'2026-08-05', sequence:2, review_note:'', created_by:'admin', reviewed_by:null,
  created_at:Date.parse('2026-08-01T00:00:00Z'), updated_at:Date.parse('2026-08-02T00:00:00Z'), published_at:Date.parse('2026-08-02T00:00:00Z')
}

describe('important item validation', () => {
  it('accepts range topics and bonus schedules with optional milestone dates', () => {
    expect(importantItemInputSchema.safeParse({
      kind:'ppa', title:'PPA 主题', contentMarkdown:'**内容**与[资料](https://example.com)',
      startDate:'2026-08-03', endDate:'2026-08-05', announcementDate:null, paymentDate:null
    }).success).toBe(true)
    expect(importantItemInputSchema.safeParse({
      kind:'bonus', title:'季度薪酬', contentMarkdown:'', startDate:'2026-07-01', endDate:'2026-09-30',
      announcementDate:'2026-11-24', paymentDate:'2026-12-31'
    }).success).toBe(true)
  })

  it('rejects unsafe markdown, missing topic content and invalid date ranges', () => {
    const valid = { kind:'competition', title:'比赛主题', contentMarkdown:'比赛说明', startDate:'2026-08-03', endDate:'2026-08-05', announcementDate:null, paymentDate:null }
    expect(importantItemInputSchema.safeParse({ ...valid, contentMarkdown:'[不安全](http://example.com)' }).success).toBe(false)
    expect(importantItemInputSchema.safeParse({ ...valid, contentMarkdown:'![图片](https://example.com/a.png)' }).success).toBe(false)
    expect(importantItemInputSchema.safeParse({ ...valid, contentMarkdown:'' }).success).toBe(false)
    expect(importantItemInputSchema.safeParse({ ...valid, endDate:'2026-08-02' }).success).toBe(false)
    expect(importantItemInputSchema.safeParse({ ...valid, announcementDate:'2026-08-04' }).success).toBe(false)
  })
})

describe('important item ICS', () => {
  it('emits an inclusive all-day range without an alarm and strips markdown from descriptions', () => {
    const output = buildCalendarIcs([], [], 30, [baseItem], [])
    expect(output).toContain('UID:item-1@wq-meeting-calendar')
    expect(output).toContain('DTSTART;VALUE=DATE:20260803')
    expect(output).toContain('DTEND;VALUE=DATE:20260806')
    expect(output).toContain('SUMMARY:PPA 主题 · PPA 夏季主题')
    expect(output).toContain('资料 (https://example.com/guide)')
    expect(output).not.toContain('**')
    expect(output).not.toContain('BEGIN:VALARM')
  })

  it('emits only bonus announcement and payment milestones with stable cancellation records', () => {
    const bonus: ImportantItemRow = { ...baseItem, id:'bonus-1', uid:'bonus-1@wq-meeting-calendar', kind:'bonus', title:'季度薪酬', start_date:'2026-07-01', end_date:'2026-09-30' }
    const dates: ImportantItemCalendarDateRow[] = [
      { id:'date-1', item_id:bonus.id, date_kind:'announcement', uid:'bonus-1-announcement@wq-meeting-calendar', event_date:'2026-11-24', status:'scheduled', sequence:1, created_at:bonus.created_at, updated_at:bonus.updated_at },
      { id:'date-2', item_id:bonus.id, date_kind:'payment', uid:'bonus-1-payment@wq-meeting-calendar', event_date:'2026-12-31', status:'cancelled', sequence:2, created_at:bonus.created_at, updated_at:bonus.updated_at }
    ]
    const output = buildCalendarIcs([], [], 30, [bonus], dates)
    expect(output).not.toContain('UID:bonus-1@wq-meeting-calendar')
    expect(output).toContain('SUMMARY:奖金公布 · 季度薪酬')
    expect(output).toContain('DTSTART;VALUE=DATE:20261124')
    expect(output).toContain('SUMMARY:奖金账单 · 季度薪酬')
    expect(output).toContain('DTSTART;VALUE=DATE:20261231')
    expect(output).toContain('STATUS:CANCELLED')
    expect(output).not.toContain('BEGIN:VALARM')
  })

  it('filters important item categories without adding alarms', () => {
    const output = buildCalendarIcs([], [], 30, [baseItem], [], {
      meetings:true, ppa:false, competition:true, bonus:true
    })
    expect(output).not.toContain('UID:item-1@wq-meeting-calendar')
    expect(output).not.toContain('BEGIN:VALARM')
  })

  it('converts supported markdown to readable calendar text', () => {
    expect(markdownToPlainText('### 标题\n\n> **说明**和`代码`')).toBe('标题\n\n说明和代码')
  })
})
