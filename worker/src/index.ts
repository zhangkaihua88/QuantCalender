import { Hono } from 'hono'
import { Temporal } from '@js-temporal/polyfill'
import {
  adminLoginSchema,
  calendarFeedSchema,
  decisionSchema,
  exceptionSchema,
  importRowsSchema,
  meetingInputSchema,
  memberLoginSchema
} from '@wq-calendar/shared'
import type { MeetingInput } from '@wq-calendar/shared'
import type { Env, SessionRecord } from './env'
import { allowedOrigins, apiError, readJson } from './http'
import {
  checkLoginLimit,
  clearLoginFailures,
  createSession,
  currentSession,
  destroyCurrentSession,
  loginRateKey,
  recordLoginFailure,
  requireAuth,
  rotateCsrf,
  verifyAdminPassword,
  verifyMutation,
  verifyTurnstile
} from './auth'
import { hmacSha256, normalizeWqId, randomToken, sha256, wqIdHint } from './crypto'
import { audit, listEventExceptions, listPublishedEvents } from './db'
import { expandEvent, normalizeMeetingTimes, publicEvent, type EventRow } from './events'
import { buildCalendarIcs } from './ics'

type Variables = { session: SessionRecord }
const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', async (context, next) => {
  const origin = context.req.header('origin') || ''
  const isAllowed = allowedOrigins(context.env).includes(origin)
  if (origin && isAllowed) {
    context.header('Access-Control-Allow-Origin', origin)
    context.header('Access-Control-Allow-Credentials', 'true')
    context.header('Vary', 'Origin')
  }
  context.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
  context.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
  context.header('Access-Control-Max-Age', '600')
  context.header('X-Content-Type-Options', 'nosniff')
  context.header('Referrer-Policy', 'no-referrer')
  context.header('Cache-Control', 'no-store')
  if (context.req.method === 'OPTIONS') return isAllowed ? context.body(null, 204) : context.body(null, 403)
  await next()
})

app.get('/health', (context) => context.json({ status: 'ok', service: 'wq-meeting-calendar-api' }))

function sessionUser(session: SessionRecord) {
  return {
    role: session.role,
    memberId: session.member_id,
    wqIdHint: session.role === 'admin' ? '管理员' : (session.wq_id_hint || '成员'),
    country: session.country,
    expiresAt: new Date(session.expires_at).toISOString()
  }
}

async function parseMeeting(context: Parameters<typeof readJson>[0]): Promise<MeetingInput | Response> {
  const data = await readJson(context)
  const parsed = meetingInputSchema.safeParse((data as { meeting?: unknown }).meeting ?? data)
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查会议信息', parsed.error.flatten().fieldErrors as Record<string, string[]>)
  try {
    normalizeMeetingTimes(parsed.data)
  } catch (error) {
    const message = error instanceof Error && error.message === 'RECURRENCE_TOO_LONG' ? '重复会议最长只能设置 12 个月' : '会议时间或时区无效'
    return apiError(context, 422, 'INVALID_MEETING_TIME', message)
  }
  return parsed.data
}

async function insertEvent(env: Env, input: MeetingInput, status: EventRow['status'], creator: string, submitterMemberId: string | null): Promise<EventRow> {
  const id = crypto.randomUUID()
  const now = Date.now()
  const normalized = normalizeMeetingTimes(input)
  const uid = `${id}@wq-meeting-calendar`
  await env.DB.prepare(`
    INSERT INTO events (
      id, uid, status, submitter_member_id, title, summary, description, organizer, speaker,
      category, meeting_language, location_type, location_text, registration_url,
      registration_deadline_utc, source_timezone, start_local, end_local, start_utc, end_utc,
      duration_minutes, recurrence_json, sequence, review_note, created_by, reviewed_by,
      created_at, updated_at, published_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
      ?16, ?17, ?18, ?19, ?20, ?21, ?22, 0, '', ?23, NULL, ?24, ?24, ?25
    )
  `).bind(
    id, uid, status, submitterMemberId, input.title, input.summary, input.description,
    input.organizer, input.speaker, input.category, input.meetingLanguage, input.locationType,
    input.locationText, input.registrationUrl, input.registrationDeadlineUtc, input.sourceTimezone,
    input.startLocal, input.endLocal, normalized.startUtc, normalized.endUtc, normalized.durationMinutes,
    JSON.stringify(input.recurrence), creator, now, status === 'published' ? now : null
  ).run()
  return (await env.DB.prepare('SELECT * FROM events WHERE id = ?1').bind(id).first<EventRow>())!
}

async function updateEvent(env: Env, id: string, input: MeetingInput, status?: EventRow['status']): Promise<EventRow | null> {
  const normalized = normalizeMeetingTimes(input)
  const now = Date.now()
  const current = await env.DB.prepare('SELECT * FROM events WHERE id = ?1').bind(id).first<EventRow>()
  if (!current) return null
  const nextStatus = status || current.status
  await env.DB.prepare(`
    UPDATE events SET status = ?2, title = ?3, summary = ?4, description = ?5, organizer = ?6,
      speaker = ?7, category = ?8, meeting_language = ?9, location_type = ?10, location_text = ?11,
      registration_url = ?12, registration_deadline_utc = ?13, source_timezone = ?14,
      start_local = ?15, end_local = ?16, start_utc = ?17, end_utc = ?18, duration_minutes = ?19,
      recurrence_json = ?20, sequence = sequence + 1, updated_at = ?21,
      published_at = CASE WHEN ?2 = 'published' AND published_at IS NULL THEN ?21 ELSE published_at END
    WHERE id = ?1
  `).bind(
    id, nextStatus, input.title, input.summary, input.description, input.organizer, input.speaker,
    input.category, input.meetingLanguage, input.locationType, input.locationText, input.registrationUrl,
    input.registrationDeadlineUtc, input.sourceTimezone, input.startLocal, input.endLocal,
    normalized.startUtc, normalized.endUtc, normalized.durationMinutes, JSON.stringify(input.recurrence), now
  ).run()
  return env.DB.prepare('SELECT * FROM events WHERE id = ?1').bind(id).first<EventRow>()
}

app.post('/v1/session/member', async (context) => {
  const parsed = memberLoginSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', 'WQ_ID 格式不正确')
  const wqId = normalizeWqId(parsed.data.wqId)
  const remoteIp = context.req.header('cf-connecting-ip') || 'local'
  const rateKey = await loginRateKey(context.env, 'member', remoteIp, wqId)
  const limit = await checkLoginLimit(context.env, rateKey, 10)
  if (!limit.allowed) return apiError(context, 429, 'TOO_MANY_ATTEMPTS', `尝试次数过多，请在 ${Math.ceil(limit.retryAfter / 60)} 分钟后重试`)
  if (!await verifyTurnstile(context.env, parsed.data.turnstileToken, remoteIp)) {
    await recordLoginFailure(context.env, rateKey)
    return apiError(context, 401, 'LOGIN_FAILED', 'WQ_ID 不存在或当前不可用')
  }
  const wqHash = await hmacSha256(wqId, context.env.WQ_ID_HMAC_SECRET)
  const member = await context.env.DB.prepare("SELECT id, wq_id_hint, country FROM members WHERE wq_id_hash = ?1 AND active = 1 AND country IN ('CN', 'HK')")
    .bind(wqHash).first<{ id: string; wq_id_hint: string; country: 'CN' | 'HK' }>()
  if (!member) {
    await recordLoginFailure(context.env, rateKey)
    return apiError(context, 401, 'LOGIN_FAILED', 'WQ_ID 不存在或当前不可用')
  }
  await clearLoginFailures(context.env, rateKey)
  const created = await createSession(context, 'member', member.id)
  return context.json({ user: { role: 'member', memberId: member.id, wqIdHint: member.wq_id_hint, country: member.country, expiresAt: new Date(created.expiresAt).toISOString() }, csrfToken: created.csrfToken })
})

app.post('/v1/session/admin', async (context) => {
  const parsed = adminLoginSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '管理员凭据格式不正确')
  const wqId = normalizeWqId(parsed.data.wqId)
  const remoteIp = context.req.header('cf-connecting-ip') || 'local'
  const rateKey = await loginRateKey(context.env, 'admin', remoteIp, wqId)
  const limit = await checkLoginLimit(context.env, rateKey, 5)
  if (!limit.allowed) return apiError(context, 429, 'TOO_MANY_ATTEMPTS', `尝试次数过多，请在 ${Math.ceil(limit.retryAfter / 60)} 分钟后重试`)
  const valid = normalizeWqId(context.env.ADMIN_WQ_ID) === wqId
    && await verifyAdminPassword(parsed.data.password, context.env.ADMIN_PASSWORD_HASH)
    && await verifyTurnstile(context.env, parsed.data.turnstileToken, remoteIp)
  if (!valid) {
    await recordLoginFailure(context.env, rateKey)
    return apiError(context, 401, 'LOGIN_FAILED', '管理员凭据不正确')
  }
  await clearLoginFailures(context.env, rateKey)
  const created = await createSession(context, 'admin', null)
  return context.json({ user: { role: 'admin', memberId: null, wqIdHint: '管理员', country: null, expiresAt: new Date(created.expiresAt).toISOString() }, csrfToken: created.csrfToken })
})

app.get('/v1/me', requireAuth(), (context) => context.json({ user: sessionUser(context.get('session')) }))

app.get('/v1/session/csrf', requireAuth(), async (context) => {
  const csrfToken = await rotateCsrf(context, context.get('session'))
  return context.json({ csrfToken })
})

app.delete('/v1/session', requireAuth(), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败，请刷新页面重试')
  await destroyCurrentSession(context)
  return context.body(null, 204)
})

app.post('/v1/admin/sessions/revoke-all', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  await context.env.DB.prepare("DELETE FROM sessions WHERE role = 'admin'").run()
  return context.json({ revoked: true })
})

app.get('/v1/meetings', requireAuth(), async (context) => {
  const now = Temporal.Now.instant()
  const from = context.req.query('from') || now.subtract({ hours: 24 }).toString()
  const to = context.req.query('to') || now.add({ hours: 24 * 180 }).toString()
  try {
    const fromInstant = Temporal.Instant.from(from)
    const toInstant = Temporal.Instant.from(to)
    if (Number(toInstant.epochMilliseconds - fromInstant.epochMilliseconds) > 181 * 24 * 60 * 60 * 1000) {
      return apiError(context, 422, 'DATE_RANGE_TOO_LARGE', '单次最多查询 180 天')
    }
  } catch {
    return apiError(context, 422, 'INVALID_DATE_RANGE', '日期范围无效')
  }
  const events = await listPublishedEvents(context.env)
  const exceptions = await listEventExceptions(context.env, events.map((event) => event.id))
  const query = (context.req.query('q') || '').trim().toLowerCase()
  const category = context.req.query('category') || ''
  const meetingLanguage = context.req.query('meetingLanguage') || ''
  const locationType = context.req.query('locationType') || ''
  const occurrences = events.flatMap((event) => expandEvent(event, exceptions.filter((item) => item.event_id === event.id), from, to))
    .filter((item) => !query || `${item.title} ${item.summary} ${item.organizer} ${item.speaker}`.toLowerCase().includes(query))
    .filter((item) => !category || item.category === category)
    .filter((item) => !meetingLanguage || item.meetingLanguage === meetingLanguage)
    .filter((item) => !locationType || item.locationType === locationType)
    .sort((left, right) => left.startUtc.localeCompare(right.startUtc))
  return context.json({ occurrences })
})

app.get('/v1/meetings/:id', requireAuth(), async (context) => {
  const requested = context.req.param('id')
  const wantsIcs = requested.endsWith('.ics')
  const eventId = wantsIcs ? requested.slice(0, -4) : requested
  const event = await context.env.DB.prepare("SELECT * FROM events WHERE id = ?1 AND status IN ('published', 'cancelled')").bind(eventId).first<EventRow>()
  if (!event) return apiError(context, 404, 'NOT_FOUND', '会议不存在')
  const exceptions = await listEventExceptions(context.env, [event.id])
  if (wantsIcs) {
    const alarm = Number(context.req.query('alarm') || 30)
    const safeAlarm = [10, 30, 60, 1440].includes(alarm) ? alarm : 30
    context.header('Content-Type', 'text/calendar; charset=utf-8')
    context.header('Content-Disposition', `attachment; filename="wq-meeting-${event.id}.ics"`)
    return context.body(buildCalendarIcs([event], exceptions, safeAlarm))
  }
  return context.json({ meeting: publicEvent(event), exceptions })
})

app.post('/v1/submissions', requireAuth('member'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const input = await parseMeeting(context)
  if (input instanceof Response) return input
  const event = await insertEvent(context.env, input, 'pending', session.member_id!, session.member_id)
  await audit(context.env, session, 'submit', 'event', event.id)
  return context.json({ submission: publicEvent(event) }, 201)
})

app.get('/v1/submissions/mine', requireAuth('member'), async (context) => {
  const session = context.get('session')
  const result = await context.env.DB.prepare("SELECT * FROM events WHERE submitter_member_id = ?1 AND status IN ('pending', 'published', 'rejected', 'cancelled') ORDER BY created_at DESC")
    .bind(session.member_id).all<EventRow>()
  return context.json({ submissions: result.results.map(publicEvent) })
})

app.get('/v1/admin/submissions', requireAuth('admin'), async (context) => {
  const status = context.req.query('status') || 'pending'
  if (!['pending', 'rejected', 'published'].includes(status)) return apiError(context, 422, 'INVALID_STATUS', '投稿状态无效')
  const result = await context.env.DB.prepare('SELECT * FROM events WHERE status = ?1 AND submitter_member_id IS NOT NULL ORDER BY created_at DESC').bind(status).all<EventRow>()
  return context.json({ submissions: result.results.map(publicEvent) })
})

app.get('/v1/admin/events', requireAuth('admin'), async (context) => {
  const result = await context.env.DB.prepare('SELECT * FROM events ORDER BY updated_at DESC LIMIT 500').all<EventRow>()
  return context.json({ events: result.results.map(publicEvent) })
})

app.post('/v1/admin/events', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const raw = await readJson(context)
  const parsedMeeting = meetingInputSchema.safeParse((raw as { meeting?: unknown }).meeting ?? raw)
  if (!parsedMeeting.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查会议信息', parsedMeeting.error.flatten().fieldErrors as Record<string, string[]>)
  const status = (raw as { status?: string }).status === 'draft' ? 'draft' : 'published'
  let event: EventRow
  try { event = await insertEvent(context.env, parsedMeeting.data, status, 'admin', null) } catch { return apiError(context, 422, 'INVALID_MEETING_TIME', '会议时间或时区无效') }
  await audit(context.env, session, 'create', 'event', event.id, { status })
  return context.json({ meeting: publicEvent(event) }, 201)
})

app.patch('/v1/admin/events/:id', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const raw = await readJson(context)
  const parsedMeeting = meetingInputSchema.safeParse((raw as { meeting?: unknown }).meeting ?? raw)
  if (!parsedMeeting.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查会议信息', parsedMeeting.error.flatten().fieldErrors as Record<string, string[]>)
  const requestedStatus = (raw as { status?: EventRow['status'] }).status
  const current = await context.env.DB.prepare('SELECT status FROM events WHERE id = ?1').bind(context.req.param('id')).first<{ status: EventRow['status'] }>()
  if (!current) return apiError(context, 404, 'NOT_FOUND', '会议不存在')
  const mayPublishDraft = current.status === 'draft' && requestedStatus === 'published'
  if (requestedStatus && requestedStatus !== current.status && !mayPublishDraft) {
    return apiError(context, 409, 'INVALID_STATE', '会议状态不能通过编辑操作直接变更')
  }
  let event: EventRow | null
  try { event = await updateEvent(context.env, context.req.param('id'), parsedMeeting.data, requestedStatus) } catch { return apiError(context, 422, 'INVALID_MEETING_TIME', '会议时间或时区无效') }
  if (!event) return apiError(context, 404, 'NOT_FOUND', '会议不存在')
  await audit(context.env, session, 'update', 'event', event.id, { status: event.status })
  return context.json({ meeting: publicEvent(event) })
})

app.post('/v1/admin/events/:id/cancel', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const result = await context.env.DB.prepare("UPDATE events SET status = 'cancelled', sequence = sequence + 1, updated_at = ?2 WHERE id = ?1 AND status = 'published'").bind(context.req.param('id'), Date.now()).run()
  if (!result.meta.changes) return apiError(context, 409, 'INVALID_STATE', '只有已发布会议可以取消')
  await audit(context.env, session, 'cancel', 'event', context.req.param('id'))
  return context.json({ cancelled: true })
})

app.post('/v1/admin/submissions/:id/decision', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const parsed = decisionSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '审批参数无效')
  const status = parsed.data.decision === 'publish' ? 'published' : 'rejected'
  const now = Date.now()
  const result = await context.env.DB.prepare(`
    UPDATE events SET status = ?2, review_note = ?3, reviewed_by = 'admin', sequence = sequence + 1,
      updated_at = ?4, published_at = CASE WHEN ?2 = 'published' THEN ?4 ELSE published_at END
    WHERE id = ?1 AND status = 'pending'
  `).bind(context.req.param('id'), status, parsed.data.reviewNote, now).run()
  if (!result.meta.changes) return apiError(context, 409, 'ALREADY_REVIEWED', '该投稿已经处理')
  await audit(context.env, session, parsed.data.decision, 'event', context.req.param('id'), { reviewNote: parsed.data.reviewNote })
  return context.json({ status })
})

app.put('/v1/admin/events/:id/exceptions/:occurrenceKey', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const raw = await readJson(context)
  const parsed = exceptionSchema.safeParse({ ...(raw as object), occurrenceKey: decodeURIComponent(context.req.param('occurrenceKey')) })
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '例外设置无效')
  const event = await context.env.DB.prepare('SELECT id FROM events WHERE id = ?1').bind(context.req.param('id')).first()
  if (!event) return apiError(context, 404, 'NOT_FOUND', '会议不存在')
  const now = Date.now()
  await context.env.DB.prepare(`
    INSERT INTO event_exceptions (id, event_id, occurrence_key, action, override_start_local, override_end_local, override_timezone, note, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
    ON CONFLICT(event_id, occurrence_key) DO UPDATE SET action = excluded.action,
      override_start_local = excluded.override_start_local, override_end_local = excluded.override_end_local,
      override_timezone = excluded.override_timezone, note = excluded.note, updated_at = excluded.updated_at
  `).bind(crypto.randomUUID(), context.req.param('id'), parsed.data.occurrenceKey, parsed.data.action, parsed.data.overrideStartLocal, parsed.data.overrideEndLocal, parsed.data.overrideTimezone, parsed.data.note, now).run()
  await context.env.DB.prepare('UPDATE events SET sequence = sequence + 1, updated_at = ?2 WHERE id = ?1').bind(context.req.param('id'), now).run()
  await audit(context.env, session, 'set_exception', 'event', context.req.param('id'), parsed.data)
  return context.json({ saved: true })
})

app.post('/v1/admin/member-imports', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const id = crypto.randomUUID()
  await context.env.DB.prepare("INSERT INTO member_imports (id, status, total_rows, created_at) VALUES (?1, 'staging', 0, ?2)").bind(id, Date.now()).run()
  return context.json({ importId: id }, 201)
})

app.post('/v1/admin/member-imports/:id/rows', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const parsed = importRowsSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '成员批次格式无效')
  const importRow = await context.env.DB.prepare("SELECT id FROM member_imports WHERE id = ?1 AND status = 'staging'").bind(context.req.param('id')).first()
  if (!importRow) return apiError(context, 409, 'IMPORT_NOT_STAGING', '导入批次不可用')
  const statements: D1PreparedStatement[] = []
  const recordDate = Temporal.Now.instant().toZonedDateTimeISO('Asia/Shanghai').toPlainDate().toString()
  for (const row of parsed.data.rows) {
    const normalized = normalizeWqId(row.wqId)
    statements.push(context.env.DB.prepare(`
      INSERT INTO member_import_rows (import_id, wq_id_hash, wq_id_hint, country, record_date)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(import_id, wq_id_hash) DO UPDATE SET country = excluded.country, record_date = excluded.record_date
    `).bind(context.req.param('id'), await hmacSha256(normalized, context.env.WQ_ID_HMAC_SECRET), wqIdHint(normalized), row.country, recordDate))
  }
  await context.env.DB.batch(statements)
  const count = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM member_import_rows WHERE import_id = ?1').bind(context.req.param('id')).first<{ count: number }>()
  await context.env.DB.prepare('UPDATE member_imports SET total_rows = ?2 WHERE id = ?1').bind(context.req.param('id'), count?.count || 0).run()
  return context.json({ stagedRows: count?.count || 0 })
})

app.get('/v1/admin/member-imports/:id', requireAuth('admin'), async (context) => {
  const batch = await context.env.DB.prepare('SELECT * FROM member_imports WHERE id = ?1').bind(context.req.param('id')).first()
  if (!batch) return apiError(context, 404, 'NOT_FOUND', '导入批次不存在')
  const preview = await context.env.DB.prepare('SELECT wq_id_hint, country, record_date FROM member_import_rows WHERE import_id = ?1 ORDER BY wq_id_hint LIMIT 20').bind(context.req.param('id')).all()
  return context.json({ batch, preview: preview.results })
})

app.post('/v1/admin/member-imports/:id/commit', requireAuth('admin'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const importId = context.req.param('id')
  const batch = await context.env.DB.prepare("SELECT total_rows FROM member_imports WHERE id = ?1 AND status = 'staging'").bind(importId).first<{ total_rows: number }>()
  if (!batch || batch.total_rows === 0) return apiError(context, 409, 'EMPTY_IMPORT', '导入批次为空或已经提交')
  const now = Date.now()
  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO members (id, wq_id_hash, wq_id_hint, country, record_date, active, import_batch_id, created_at, updated_at)
      SELECT lower(hex(randomblob(16))), wq_id_hash, wq_id_hint, country, record_date, 1, ?1, ?2, ?2
      FROM member_import_rows WHERE import_id = ?1 AND 1 = 1
      ON CONFLICT(wq_id_hash) DO UPDATE SET wq_id_hint = excluded.wq_id_hint, country = excluded.country,
        record_date = excluded.record_date, active = 1, import_batch_id = excluded.import_batch_id, updated_at = excluded.updated_at
    `).bind(importId, now),
    context.env.DB.prepare('UPDATE members SET active = 0, updated_at = ?2 WHERE wq_id_hash NOT IN (SELECT wq_id_hash FROM member_import_rows WHERE import_id = ?1)').bind(importId, now),
    context.env.DB.prepare("DELETE FROM sessions WHERE role = 'member' AND member_id IN (SELECT id FROM members WHERE active = 0)"),
    context.env.DB.prepare('UPDATE calendar_tokens SET revoked_at = ?1, updated_at = ?1 WHERE member_id IN (SELECT id FROM members WHERE active = 0) AND revoked_at IS NULL').bind(now),
    context.env.DB.prepare("UPDATE member_imports SET status = 'committed', committed_at = ?2 WHERE id = ?1 AND status = 'staging'").bind(importId, now)
  ])
  await audit(context.env, session, 'commit_import', 'member_import', importId, { rows: batch.total_rows })
  return context.json({ committed: true, activeMembers: batch.total_rows })
})

app.get('/v1/calendar-feed', requireAuth('member'), async (context) => {
  const session = context.get('session')
  const row = await context.env.DB.prepare('SELECT alarm_minutes, created_at, updated_at FROM calendar_tokens WHERE member_id = ?1 AND revoked_at IS NULL').bind(session.member_id).first()
  return context.json({ feed: row ? { exists: true, ...row } : { exists: false, alarm_minutes: 30 } })
})

app.post('/v1/calendar-feed', requireAuth('member'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const parsed = calendarFeedSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '提醒时间无效')
  const token = randomToken()
  const now = Date.now()
  await context.env.DB.prepare(`
    INSERT INTO calendar_tokens (id, member_id, token_hash, alarm_minutes, created_at, updated_at, revoked_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL)
    ON CONFLICT(member_id) DO UPDATE SET token_hash = excluded.token_hash, alarm_minutes = excluded.alarm_minutes,
      updated_at = excluded.updated_at, revoked_at = NULL
  `).bind(crypto.randomUUID(), session.member_id, await sha256(token), parsed.data.alarmMinutes, now).run()
  await audit(context.env, session, 'rotate', 'calendar_feed', session.member_id!)
  return context.json({ url: `${context.env.API_BASE_URL.replace(/\/$/, '')}/ics/${token}/calendar.ics`, alarmMinutes: parsed.data.alarmMinutes })
})

app.patch('/v1/calendar-feed', requireAuth('member'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  const parsed = calendarFeedSchema.safeParse(await readJson(context))
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '提醒时间无效')
  const result = await context.env.DB.prepare('UPDATE calendar_tokens SET alarm_minutes = ?2, updated_at = ?3 WHERE member_id = ?1 AND revoked_at IS NULL').bind(session.member_id, parsed.data.alarmMinutes, Date.now()).run()
  if (!result.meta.changes) return apiError(context, 404, 'NO_FEED', '请先生成订阅地址')
  return context.json({ updated: true })
})

app.delete('/v1/calendar-feed', requireAuth('member'), async (context) => {
  const session = context.get('session')
  if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
  await context.env.DB.prepare('UPDATE calendar_tokens SET revoked_at = ?2, updated_at = ?2 WHERE member_id = ?1').bind(session.member_id, Date.now()).run()
  return context.body(null, 204)
})

app.get('/ics/:token/calendar.ics', async (context) => {
  const tokenHash = await sha256(context.req.param('token'))
  const token = await context.env.DB.prepare(`
    SELECT ct.alarm_minutes FROM calendar_tokens ct
    JOIN members m ON m.id = ct.member_id
    WHERE ct.token_hash = ?1 AND ct.revoked_at IS NULL AND m.active = 1
  `).bind(tokenHash).first<{ alarm_minutes: number }>()
  if (!token) return apiError(context, 404, 'NOT_FOUND', '日历订阅不存在或已经失效')
  const events = await listPublishedEvents(context.env)
  const exceptions = await listEventExceptions(context.env, events.map((event) => event.id))
  const now = Temporal.Now.instant()
  const from = now.subtract({ hours: 90 * 24 }).toString()
  const to = now.add({ hours: 366 * 24 }).toString()
  const relevantEvents = events.filter((event) => expandEvent(event, exceptions.filter((item) => item.event_id === event.id), from, to).length > 0)
  const relevantIds = new Set(relevantEvents.map((event) => event.id))
  const relevantExceptions = exceptions.filter((item) => relevantIds.has(item.event_id))
  context.header('Content-Type', 'text/calendar; charset=utf-8')
  context.header('Content-Disposition', 'inline; filename="wq-meeting-calendar.ics"')
  context.header('Cache-Control', 'private, max-age=300')
  return context.body(buildCalendarIcs(relevantEvents, relevantExceptions, token.alarm_minutes))
})

app.get('/v1/admin/audit', requireAuth('admin'), async (context) => {
  const result = await context.env.DB.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all()
  return context.json({ logs: result.results })
})

app.notFound((context) => apiError(context, 404, 'NOT_FOUND', '接口不存在'))
app.onError((error, context) => {
  console.error('Unhandled worker error', error)
  if (error instanceof Error && error.message === 'INVALID_CONTENT_TYPE') return apiError(context, 422, 'INVALID_CONTENT_TYPE', '请求必须使用 JSON 格式')
  const message = context.env.APP_ENV === 'production' ? '服务暂时不可用，请稍后重试' : `本地开发错误：${error instanceof Error ? error.message : String(error)}`
  return apiError(context, 500, 'INTERNAL_ERROR', message)
})

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = Date.now()
    const staleImport = now - 24 * 60 * 60 * 1000
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now),
      env.DB.prepare("UPDATE member_imports SET status = 'abandoned' WHERE status = 'staging' AND created_at < ?1").bind(staleImport),
      env.DB.prepare('DELETE FROM login_attempts WHERE updated_at < ?1').bind(now - 7 * 24 * 60 * 60 * 1000)
    ])
  }
}
