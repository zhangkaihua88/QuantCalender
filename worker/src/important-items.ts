import type { Hono } from 'hono'
import {
  decisionSchema,
  importantItemInputSchema,
  type ImportantItem,
  type ImportantItemInput,
  type ImportantItemKind,
  type ImportantItemStatus
} from '@wq-calendar/shared'
import { requireAuth, verifyMutation } from './auth'
import { audit } from './db'
import type { Env, SessionRecord } from './env'
import { apiError, readJson } from './http'

type CalendarApp = Hono<{ Bindings: Env; Variables: { session: SessionRecord } }>

export type ImportantItemRow = {
  id: string
  uid: string
  status: ImportantItemStatus
  kind: ImportantItemKind
  submitter_member_id: string | null
  title: string
  content_markdown: string
  start_date: string
  end_date: string
  sequence: number
  review_note: string
  created_by: string
  reviewed_by: string | null
  created_at: number
  updated_at: number
  published_at: number | null
}

export type ImportantItemCalendarDateRow = {
  id: string
  item_id: string
  date_kind: 'announcement' | 'payment'
  uid: string
  event_date: string
  status: 'scheduled' | 'cancelled'
  sequence: number
  created_at: number
  updated_at: number
}

type ImportantItemWithDatesRow = ImportantItemRow & {
  announcement_date: string | null
  payment_date: string | null
}

const ITEM_SELECT = `
  SELECT ii.*,
    MAX(CASE WHEN iid.date_kind = 'announcement' AND iid.status = 'scheduled' THEN iid.event_date END) AS announcement_date,
    MAX(CASE WHEN iid.date_kind = 'payment' AND iid.status = 'scheduled' THEN iid.event_date END) AS payment_date
  FROM important_items ii
  LEFT JOIN important_item_calendar_dates iid ON iid.item_id = ii.id
`

function publicImportantItem(row: ImportantItemWithDatesRow): ImportantItem {
  return {
    id: row.id,
    uid: row.uid,
    status: row.status,
    kind: row.kind,
    title: row.title,
    contentMarkdown: row.content_markdown,
    startDate: row.start_date,
    endDate: row.end_date,
    announcementDate: row.announcement_date,
    paymentDate: row.payment_date,
    submittedByMember: Boolean(row.submitter_member_id),
    sequence: row.sequence,
    reviewNote: row.review_note,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }
}

async function selectImportantItems(env: Env, where = '', values: unknown[] = []): Promise<ImportantItem[]> {
  const result = await env.DB.prepare(`${ITEM_SELECT} ${where} GROUP BY ii.id ORDER BY ii.start_date ASC, ii.created_at ASC`)
    .bind(...values).all<ImportantItemWithDatesRow>()
  return result.results.map(publicImportantItem)
}

export async function listCalendarImportantItems(env: Env): Promise<{ items: ImportantItemRow[]; dates: ImportantItemCalendarDateRow[] }> {
  const [items, dates] = await Promise.all([
    env.DB.prepare("SELECT * FROM important_items WHERE status IN ('published', 'cancelled') ORDER BY start_date ASC").all<ImportantItemRow>(),
    env.DB.prepare(`
      SELECT iid.* FROM important_item_calendar_dates iid
      JOIN important_items ii ON ii.id = iid.item_id
      WHERE ii.status IN ('published', 'cancelled')
      ORDER BY iid.event_date ASC
    `).all<ImportantItemCalendarDateRow>()
  ])
  return { items: items.results, dates: dates.results }
}

function milestoneStatement(
  env: Env,
  itemId: string,
  kind: ImportantItemCalendarDateRow['date_kind'],
  eventDate: string | null,
  existing: ImportantItemCalendarDateRow | undefined,
  now: number
): D1PreparedStatement | null {
  if (!existing && !eventDate) return null
  if (!existing && eventDate) {
    return env.DB.prepare(`
      INSERT INTO important_item_calendar_dates (id, item_id, date_kind, uid, event_date, status, sequence, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'scheduled', 0, ?6, ?6)
    `).bind(crypto.randomUUID(), itemId, kind, `${itemId}-${kind}@wq-meeting-calendar`, eventDate, now)
  }
  if (existing && eventDate && (existing.event_date !== eventDate || existing.status !== 'scheduled')) {
    return env.DB.prepare(`
      UPDATE important_item_calendar_dates
      SET event_date = ?2, status = 'scheduled', sequence = sequence + 1, updated_at = ?3
      WHERE id = ?1
    `).bind(existing.id, eventDate, now)
  }
  if (existing && !eventDate && existing.status === 'scheduled') {
    return env.DB.prepare(`
      UPDATE important_item_calendar_dates
      SET status = 'cancelled', sequence = sequence + 1, updated_at = ?2
      WHERE id = ?1
    `).bind(existing.id, now)
  }
  return null
}

async function createImportantItem(
  env: Env,
  input: ImportantItemInput,
  status: ImportantItemStatus,
  creator: string,
  submitterMemberId: string | null
): Promise<ImportantItem> {
  const id = crypto.randomUUID()
  const now = Date.now()
  const statements: D1PreparedStatement[] = [env.DB.prepare(`
    INSERT INTO important_items (
      id, uid, status, kind, submitter_member_id, title, content_markdown, start_date, end_date,
      sequence, review_note, created_by, reviewed_by, created_at, updated_at, published_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, '', ?10, NULL, ?11, ?11, ?12)
  `).bind(
    id, `${id}@wq-meeting-calendar`, status, input.kind, submitterMemberId, input.title,
    input.contentMarkdown, input.startDate, input.endDate, creator, now, status === 'published' ? now : null
  )]
  if (input.kind === 'bonus') {
    const announcement = milestoneStatement(env, id, 'announcement', input.announcementDate, undefined, now)
    const payment = milestoneStatement(env, id, 'payment', input.paymentDate, undefined, now)
    if (announcement) statements.push(announcement)
    if (payment) statements.push(payment)
  }
  await env.DB.batch(statements)
  return (await selectImportantItems(env, 'WHERE ii.id = ?1', [id]))[0]!
}

async function updateImportantItem(env: Env, id: string, input: ImportantItemInput, requestedStatus?: ImportantItemStatus): Promise<ImportantItem | null> {
  const current = await env.DB.prepare('SELECT * FROM important_items WHERE id = ?1').bind(id).first<ImportantItemRow>()
  if (!current) return null
  const nextStatus = requestedStatus || current.status
  const now = Date.now()
  const existingDates = await env.DB.prepare('SELECT * FROM important_item_calendar_dates WHERE item_id = ?1').bind(id).all<ImportantItemCalendarDateRow>()
  const byKind = new Map(existingDates.results.map((row) => [row.date_kind, row]))
  const statements: D1PreparedStatement[] = [env.DB.prepare(`
    UPDATE important_items SET kind = ?2, title = ?3, content_markdown = ?4, start_date = ?5, end_date = ?6,
      status = ?7, sequence = sequence + 1, updated_at = ?8,
      published_at = CASE WHEN ?7 = 'published' AND published_at IS NULL THEN ?8 ELSE published_at END
    WHERE id = ?1
  `).bind(id, input.kind, input.title, input.contentMarkdown, input.startDate, input.endDate, nextStatus, now)]
  const announcement = milestoneStatement(env, id, 'announcement', input.kind === 'bonus' ? input.announcementDate : null, byKind.get('announcement'), now)
  const payment = milestoneStatement(env, id, 'payment', input.kind === 'bonus' ? input.paymentDate : null, byKind.get('payment'), now)
  if (announcement) statements.push(announcement)
  if (payment) statements.push(payment)
  await env.DB.batch(statements)
  return (await selectImportantItems(env, 'WHERE ii.id = ?1', [id]))[0]!
}

async function parseImportantItem(context: Parameters<typeof readJson>[0]): Promise<ImportantItemInput | Response> {
  const raw = await readJson(context)
  const parsed = importantItemInputSchema.safeParse((raw as { item?: unknown }).item ?? raw)
  if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查重要事项信息', parsed.error.flatten().fieldErrors as Record<string, string[]>)
  return parsed.data
}

export function registerImportantItemRoutes(app: CalendarApp) {
  app.get('/v1/important-items', requireAuth(), async (context) => {
    const kind = context.req.query('kind') || ''
    if (kind && !['ppa', 'competition', 'bonus'].includes(kind)) return apiError(context, 422, 'INVALID_KIND', '重要事项类别无效')
    const where = kind
      ? "WHERE ii.status IN ('published', 'cancelled') AND ii.kind = ?1"
      : "WHERE ii.status IN ('published', 'cancelled')"
    const items = await selectImportantItems(context.env, where, kind ? [kind] : [])
    return context.json({ items:items.map((item) => ({ ...item, reviewNote:'' })) })
  })

  app.post('/v1/important-item-submissions', requireAuth('member'), async (context) => {
    const session = context.get('session')
    if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
    const input = await parseImportantItem(context)
    if (input instanceof Response) return input
    if (input.kind === 'bonus') return apiError(context, 403, 'BONUS_ADMIN_ONLY', '奖金日程仅限管理员维护')
    const item = await createImportantItem(context.env, input, 'pending', session.member_id!, session.member_id)
    await audit(context.env, session, 'submit', 'important_item', item.id, { kind: item.kind })
    return context.json({ submission: item }, 201)
  })

  app.get('/v1/important-item-submissions/mine', requireAuth('member'), async (context) => {
    const session = context.get('session')
    const submissions = await selectImportantItems(context.env, 'WHERE ii.submitter_member_id = ?1', [session.member_id])
    return context.json({ submissions })
  })

  app.get('/v1/admin/important-items', requireAuth('admin'), async (context) => {
    const items = await selectImportantItems(context.env)
    return context.json({ items })
  })

  app.post('/v1/admin/important-items', requireAuth('admin'), async (context) => {
    const session = context.get('session')
    if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
    const raw = await readJson(context)
    const parsed = importantItemInputSchema.safeParse((raw as { item?: unknown }).item ?? raw)
    if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查重要事项信息', parsed.error.flatten().fieldErrors as Record<string, string[]>)
    const status = (raw as { status?: string }).status === 'draft' ? 'draft' : 'published'
    const item = await createImportantItem(context.env, parsed.data, status, 'admin', null)
    await audit(context.env, session, 'create', 'important_item', item.id, { kind: item.kind, status })
    return context.json({ item }, 201)
  })

  app.patch('/v1/admin/important-items/:id', requireAuth('admin'), async (context) => {
    const session = context.get('session')
    if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
    const raw = await readJson(context)
    const parsed = importantItemInputSchema.safeParse((raw as { item?: unknown }).item ?? raw)
    if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '请检查重要事项信息', parsed.error.flatten().fieldErrors as Record<string, string[]>)
    const current = await context.env.DB.prepare('SELECT status, kind FROM important_items WHERE id = ?1').bind(context.req.param('id')).first<{ status: ImportantItemStatus; kind: ImportantItemKind }>()
    if (!current) return apiError(context, 404, 'NOT_FOUND', '重要事项不存在')
    if (!['draft', 'pending', 'published'].includes(current.status)) return apiError(context, 409, 'INVALID_STATE', '当前状态的重要事项不能编辑')
    const requestedStatus = (raw as { status?: ImportantItemStatus }).status
    const mayPublishDraft = current.status === 'draft' && requestedStatus === 'published'
    if (requestedStatus && requestedStatus !== current.status && !mayPublishDraft) return apiError(context, 409, 'INVALID_STATE', '重要事项状态不能通过编辑直接变更')
    if (current.status === 'published' && (current.kind === 'bonus') !== (parsed.data.kind === 'bonus')) {
      return apiError(context, 409, 'KIND_CHANGE_REQUIRES_RECREATE', '已发布事项不能在奖金日程与普通事项之间切换类别')
    }
    const item = await updateImportantItem(context.env, context.req.param('id'), parsed.data, requestedStatus)
    await audit(context.env, session, 'update', 'important_item', item!.id, { kind: item!.kind, status: item!.status })
    return context.json({ item })
  })

  app.post('/v1/admin/important-items/:id/cancel', requireAuth('admin'), async (context) => {
    const session = context.get('session')
    if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
    const now = Date.now()
    const result = await context.env.DB.prepare("UPDATE important_items SET status = 'cancelled', sequence = sequence + 1, updated_at = ?2 WHERE id = ?1 AND status = 'published'")
      .bind(context.req.param('id'), now).run()
    if (!result.meta.changes) return apiError(context, 409, 'INVALID_STATE', '只有已发布的重要事项可以取消')
    await audit(context.env, session, 'cancel', 'important_item', context.req.param('id'))
    return context.json({ cancelled: true })
  })

  app.post('/v1/admin/important-item-submissions/:id/decision', requireAuth('admin'), async (context) => {
    const session = context.get('session')
    if (!await verifyMutation(context, session)) return apiError(context, 403, 'CSRF_FAILED', '安全校验失败')
    const parsed = decisionSchema.safeParse(await readJson(context))
    if (!parsed.success) return apiError(context, 422, 'VALIDATION_ERROR', '审批参数无效')
    const status = parsed.data.decision === 'publish' ? 'published' : 'rejected'
    const now = Date.now()
    const result = await context.env.DB.prepare(`
      UPDATE important_items SET status = ?2, review_note = ?3, reviewed_by = 'admin', sequence = sequence + 1,
        updated_at = ?4, published_at = CASE WHEN ?2 = 'published' THEN ?4 ELSE published_at END
      WHERE id = ?1 AND status = 'pending' AND kind IN ('ppa', 'competition')
    `).bind(context.req.param('id'), status, parsed.data.reviewNote, now).run()
    if (!result.meta.changes) return apiError(context, 409, 'ALREADY_REVIEWED', '该重要事项投稿已经处理')
    await audit(context.env, session, parsed.data.decision, 'important_item', context.req.param('id'), { reviewNote: parsed.data.reviewNote })
    return context.json({ status })
  })
}
