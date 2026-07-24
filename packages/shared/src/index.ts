import { z } from 'zod'

export const countrySchema = z.enum(['CN', 'HK'])
export const eventStatusSchema = z.enum(['draft', 'pending', 'published', 'rejected', 'cancelled'])
export const recurrenceKindSchema = z.enum(['none', 'weekly', 'biweekly', 'monthly'])

export const recurrenceSchema = z.object({
  kind: recurrenceKindSchema.default('none'),
  untilLocal: z.string().datetime({ local: true }).nullable().default(null)
}).superRefine((value, context) => {
  if (value.kind !== 'none' && !value.untilLocal) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['untilLocal'], message: '重复会议必须设置结束时间' })
  }
})

const safeHttpsUrl = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}, '仅支持不包含账号密码的 HTTPS 链接')

export const meetingInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(48),
  meetingLanguage: z.enum(['zh', 'en', 'bilingual', 'other']).default('zh'),
  registrationUrl: safeHttpsUrl,
  startLocal: z.string().datetime({ local: true }),
  durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120), z.literal(180)]).default(60),
  recurrence: recurrenceSchema.default({ kind: 'none', untilLocal: null })
}).superRefine((value, context) => {
  if (value.recurrence.untilLocal && value.recurrence.untilLocal <= value.startLocal) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recurrence', 'untilLocal'], message: '重复结束时间必须晚于首次会议' })
  }
})

export const memberLoginSchema = z.object({
  wqId: z.string().trim().min(2).max(64),
  turnstileToken: z.string().max(4096).default('')
})

export const adminLoginSchema = memberLoginSchema.extend({
  password: z.string().min(12).max(256)
})

export const memberImportRowSchema = z.object({
  wqId: z.string().trim().min(2).max(64),
  country: countrySchema
})

export const importRowsSchema = z.object({
  rows: z.array(memberImportRowSchema).min(1).max(100)
})

export const decisionSchema = z.object({
  decision: z.enum(['publish', 'reject']),
  reviewNote: z.string().trim().max(1000).default('')
})

export const exceptionSchema = z.object({
  occurrenceKey: z.string().datetime(),
  action: z.enum(['cancel', 'override']),
  overrideStartLocal: z.string().datetime({ local: true }).nullable().default(null),
  overrideEndLocal: z.string().datetime({ local: true }).nullable().default(null),
  overrideTimezone: z.string().trim().max(80).nullable().default(null),
  note: z.string().trim().max(300).default('')
}).superRefine((value, context) => {
  if (value.action === 'override' && (!value.overrideStartLocal || !value.overrideEndLocal || !value.overrideTimezone)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '改期必须填写新的开始、结束时间和时区' })
  }
})

export const calendarFeedSchema = z.object({
  alarmMinutes: z.union([z.literal(0), z.literal(10), z.literal(30), z.literal(60), z.literal(1440)]).default(30)
})

export type MeetingInput = z.infer<typeof meetingInputSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type Recurrence = z.infer<typeof recurrenceSchema>
export type MemberImportRow = z.infer<typeof memberImportRowSchema>

export interface MeetingOccurrence {
  eventId: string
  occurrenceKey: string
  title: string
  summary: string
  organizer: string
  speaker: string
  category: string
  meetingLanguage: 'zh' | 'en' | 'bilingual' | 'other'
  locationType: 'online' | 'offline' | 'hybrid'
  locationText: string
  registrationUrl: string
  sourceTimezone: string
  startUtc: string
  endUtc: string
  status: 'published' | 'cancelled'
  isException: boolean
}

export interface LeaderboardEntry {
  rank: number
  memberId: string
  wqId: string
  hasFullWqId: boolean
  country: 'CN' | 'HK'
  submissionCount: number
  approvedCount: number
  approvalRate: number
  isCurrentUser: boolean
}

export interface SessionUser {
  role: 'member' | 'admin'
  memberId: string | null
  wqIdHint: string
  country: 'CN' | 'HK' | null
  expiresAt: string
}

export interface ApiErrorShape {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    requestId: string
  }
}
