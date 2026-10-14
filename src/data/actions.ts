// 所有修改数据的操作都在这里：自动写时间线、自动重算下次跟进日期、自动停止/开始提醒。
import {
  cycleLabel,
  OFFER_PENDING,
  TBC_REMIND_EVERY,
  VISA_STEPS,
} from '../lib/constants'
import { addDays, fmtDate, fmtDaysLeft, maxDate, minDate, nowIso } from '../lib/dates'
import { appDeadlines, appLabel, appSub, isOfferTbc, keyDateDeadline, visaDeadlines } from '../lib/reminders'
import type {
  Application,
  AppStatus,
  DBState,
  RowOf,
  TableName,
  Ball,
  EventKind,
  KeyDate,
  Payment,
  ReviewItem,
  Student,
  StudentStatus,
  Task,
  TimelineEvent,
  Visa,
  VisaStepKey,
} from '../lib/types'
import type { PlannedStudent } from '../importer/transform'
import { TABLES } from './adapter'
import { buildDemo } from './demo'
import { enqueue, insertRows, patchRow, removeRow, saveSettings, toast, useStore } from './store'

export const newId = () => crypto.randomUUID()
const S = () => useStore.getState()
const today = () => S().today
const findStudent = (id: string) => S().students.find((s) => s.id === id)
const findApp = (id: string) => S().applications.find((a) => a.id === id)
const findVisa = (id: string) => S().visas.find((v) => v.id === id)

// ───────────────────────── 时间线 ─────────────────────────

export interface AppendOpts {
  kind: EventKind
  content: string
  occurred_on?: string
  milestone?: boolean
  /** 设提醒：下次跟进日期直接设为这一天 */
  remindOn?: string | null
  /** 是否算「处理过这个学生」（默认是） */
  touch?: boolean
}

export function appendEvent(studentId: string, o: AppendOpts): TimelineEvent {
  const ev: TimelineEvent = {
    id: newId(),
    student_id: studentId,
    kind: o.kind,
    occurred_on: o.occurred_on ?? today(),
    date_unknown: false,
    content: o.content,
    recorder: S().settings.recorder_name || '我',
    milestone: o.milestone ?? false,
    edit_history: [],
    edited_at: null,
    source: null,
    created_at: nowIso(),
  }
  insertRows('events', [ev])
  if (o.touch !== false) touchStudent(studentId, ev.occurred_on, o.remindOn ?? null, o.kind === 'checked')
  return ev
}

/** 处理过学生：更新最后处理日期、重算下次跟进日期、休眠到期的自动结束休眠 */
function touchStudent(id: string, date: string, remindOn: string | null, checked: boolean) {
  const s = findStudent(id)
  if (!s) return
  const t = today()
  const d = minDate(date, t)!
  // 之前的「最后处理日期」如果在未来（数据有误），就不算数
  const prev = s.last_handled_date && s.last_handled_date <= t ? s.last_handled_date : null
  const handled = maxDate(prev, d)!
  const patch: Partial<Student> = { last_handled_date: handled }
  if (remindOn) patch.next_follow_date = remindOn
  else if (!prev || d >= prev) patch.next_follow_date = addDays(handled, s.follow_cycle_days)
  if (checked) patch.last_checked_date = t
  if (s.dormant_until && s.dormant_until <= t) {
    patch.dormant_until = null
    patch.dormant_reason = null
    insertRows('events', [
      {
        id: newId(),
        student_id: id,
        kind: 'status',
        occurred_on: t,
        date_unknown: false,
        content: `💤 休眠结束，恢复跟进${s.dormant_reason ? `（当初原因：${s.dormant_reason}）` : ''}`,
        recorder: S().settings.recorder_name || '我',
        milestone: false,
        edit_history: [],
        edited_at: null,
        source: null,
        created_at: nowIso(),
      },
    ])
  }
  patchRow('students', id, patch)
}

export function addNote(
  studentId: string,
  content: string,
  o: { occurred_on?: string; remindOn?: string | null; milestone?: boolean; status?: StudentStatus; ball?: Ball } = {},
) {
  const s = findStudent(studentId)
  if (!s) return
  if (o.status && o.status !== s.status) setStudentStatus(studentId, o.status, { silentSuggest: true })
  if (o.ball && o.ball !== s.ball) setBall(studentId, o.ball, { silentSuggest: true })
  if (content.trim())
    appendEvent(studentId, {
      kind: 'note',
      content: content.trim(),
      occurred_on: o.occurred_on,
      milestone: o.milestone,
      remindOn: o.remindOn,
    })
  else if (o.remindOn) patchRow('students', studentId, { next_follow_date: o.remindOn })
}

export function editEvent(id: string, patch: { content?: string; occurred_on?: string }) {
  const ev = S().events.find((e) => e.id === id)
  if (!ev) return
  const content = patch.content ?? ev.content
  const occurred_on = patch.occurred_on ?? ev.occurred_on
  const now = nowIso()
  patchRow('events', id, {
    content,
    occurred_on,
    date_unknown: false,
    edit_history: [
      ...ev.edit_history,
      { content: ev.content, occurred_on: ev.occurred_on, date_unknown: ev.date_unknown, edited_at: now },
    ],
    edited_at: now,
  })
}

export function toggleMilestone(id: string) {
  const ev = S().events.find((e) => e.id === id)
  if (ev) patchRow('events', id, { milestone: !ev.milestone })
}

export function checkStudent(studentId: string) {
  appendEvent(studentId, { kind: 'checked', content: '已检查，没有变化' })
}

// ───────────────────────── 学生 ─────────────────────────

export function createStudent(input: Partial<Student> & { name: string }): Student {
  const now = nowIso()
  const cycle = input.follow_cycle_days ?? 14
  const s: Student = {
    id: newId(),
    english_name: null,
    assignee: null,
    business_type: '其他',
    status: '进行中',
    ball: '我们',
    priority: '普通',
    background: '',
    referrer: null,
    contact: null,
    follow_cycle_days: cycle,
    next_follow_date: addDays(today(), cycle),
    last_handled_date: null,
    last_checked_date: null,
    dormant_until: null,
    dormant_reason: null,
    import_meta: null,
    created_at: now,
    updated_at: now,
    ...input,
  }
  insertRows('students', [s])
  return s
}

export function updateStudent(id: string, patch: Partial<Student>) {
  patchRow('students', id, patch)
}

export function deleteStudent(id: string) {
  useStore.setState((s) => ({
    applications: s.applications.filter((x) => x.student_id !== id),
    visas: s.visas.filter((x) => x.student_id !== id),
    key_dates: s.key_dates.filter((x) => x.student_id !== id),
    tasks: s.tasks.filter((x) => x.student_id !== id),
    payments: s.payments.filter((x) => x.student_id !== id),
    events: s.events.filter((x) => x.student_id !== id),
    review_items: s.review_items.filter((x) => x.student_id !== id),
  }))
  removeRow('students', id)
}

export function setStudentStatus(id: string, status: StudentStatus, o: { silentSuggest?: boolean } = {}) {
  const s = findStudent(id)
  if (!s || s.status === status) return
  const patch: Partial<Student> = { status }
  const reactivating = (status === '进行中' || status === '未开始') && (s.status === '已完成' || s.status === '暂停不跟进')
  if (reactivating && (!s.next_follow_date || s.next_follow_date < today()))
    patch.next_follow_date = addDays(today(), s.follow_cycle_days)
  patchRow('students', id, patch)
  appendEvent(id, { kind: 'status', content: `状态：${s.status} → ${status}`, milestone: true })
  void o
}

export function setBall(id: string, ball: Ball, o: { silentSuggest?: boolean } = {}) {
  const s = findStudent(id)
  if (!s || s.ball === ball) return
  patchRow('students', id, { ball })
  appendEvent(id, { kind: 'status', content: `球在谁那：${s.ball} → ${ball}` })
  if (ball === '学生' && !o.silentSuggest) suggestCycle(id, 7, '球在学生，要催学生交东西')
}

export function setCycle(id: string, days: number) {
  const s = findStudent(id)
  if (!s) return
  const base = s.last_handled_date ?? today()
  patchRow('students', id, { follow_cycle_days: days, next_follow_date: addDays(base, days) })
}

export function setNextFollow(id: string, date: string | null) {
  patchRow('students', id, { next_follow_date: date })
}

export function snoozeStudent(id: string, date: string) {
  patchRow('students', id, { next_follow_date: date })
}

export function setDormant(id: string, until: string, reason: string) {
  const s = findStudent(id)
  if (!s) return
  patchRow('students', id, { dormant_until: until, dormant_reason: reason || null })
  appendEvent(id, {
    kind: 'status',
    content: `💤 设为休眠，到 ${fmtDate(until)}${reason ? `（${reason}）` : ''}`,
  })
}

export function endDormancy(id: string) {
  const s = findStudent(id)
  if (!s || !s.dormant_until) return
  const reason = s.dormant_reason
  patchRow('students', id, { dormant_until: null, dormant_reason: null })
  appendEvent(id, {
    kind: 'status',
    content: `💤 休眠结束，恢复跟进${reason ? `（当初原因：${reason}）` : ''}`,
  })
}

/** 第 7 节：按阶段建议跟进周期（不自动改，弹个提示让我点「应用」） */
export function suggestCycle(studentId: string, days: number, reason: string) {
  const s = findStudent(studentId)
  if (!s || s.follow_cycle_days === days) return
  toast(`💡 ${reason} → 建议跟进周期 ${cycleLabel(days)}`, {
    tone: 'info',
    action: { label: '应用', run: () => setCycle(studentId, days) },
  })
}

function suggestForApp(studentId: string, status: AppStatus, app?: Application) {
  if (status === '未递交') suggestCycle(studentId, 7, '准备材料阶段')
  else if (status === '已递交') suggestCycle(studentId, 14, '已递交，等 offer')
  else if (OFFER_PENDING.includes(status)) suggestCycle(studentId, 7, '有 offer 等学生决定')
  else if (status === '已接受' && app && (app.condition_text || app.condition_ddl))
    suggestCycle(studentId, 30, '已接 con offer，等成绩换 uncon')
  else if (status === 'CoE已出')
    toast('💡 CoE 已出：可以把学生设为「休眠到某天」，到时间自动提醒办签证/开学', { tone: 'info', ttl: 8000 })
}

// ───────────────────────── 申请学校 ─────────────────────────

function offerParts(app: Pick<Application, 'status' | 'offer_ddl' | 'offer_ddl_tbc' | 'condition_text'>): string[] {
  if (!OFFER_PENDING.includes(app.status)) return []
  const parts: string[] = []
  parts.push(app.offer_ddl_tbc || !app.offer_ddl ? '接 offer DDL 待确认' : `接 offer DDL ${fmtDate(app.offer_ddl)}`)
  if (app.status === 'Con offer' && app.condition_text) parts.push(`条件：${app.condition_text}`)
  return parts
}

function paren(parts: string[]): string {
  return parts.length ? `（${parts.join('，')}）` : ''
}

function appDesc(app: Pick<Application, 'school' | 'program' | 'intake'>): string {
  return [appLabel(app), appSub(app)].filter(Boolean).join(' · ')
}

export function addApplication(studentId: string, input: Partial<Application>): Application {
  const now = nowIso()
  const app: Application = {
    id: newId(),
    student_id: studentId,
    school: '',
    program: '',
    intake: '',
    status: '未递交',
    note: '',
    offer_ddl: null,
    offer_ddl_tbc: false,
    tbc_remind_on: null,
    payment_ddl: null,
    payment_done_on: null,
    condition_text: '',
    condition_ddl: null,
    condition_done_on: null,
    last_reminded_on: null,
    created_at: now,
    updated_at: now,
    ...input,
  }
  if (OFFER_PENDING.includes(app.status) && (app.offer_ddl_tbc || !app.offer_ddl)) {
    app.offer_ddl_tbc = true
    app.offer_ddl = null
    app.tbc_remind_on = addDays(today(), TBC_REMIND_EVERY)
  }
  insertRows('applications', [app])
  appendEvent(studentId, {
    kind: 'school',
    content: `新增申请：${appDesc(app)}${paren([app.status, ...offerParts(app)])}`,
    milestone: app.status !== '未递交',
  })
  suggestForApp(studentId, app.status, app)
  return app
}

export function updateApplication(id: string, patch: Partial<Application>) {
  patchRow('applications', id, patch)
}

export function changeAppStatus(id: string, status: AppStatus, extra: Partial<Application> = {}) {
  const app = findApp(id)
  if (!app) return
  const merged = { ...app, ...extra, status }
  const patch: Partial<Application> = { ...extra, status }
  if (OFFER_PENDING.includes(status)) {
    if (merged.offer_ddl_tbc || !merged.offer_ddl) {
      patch.offer_ddl_tbc = true
      patch.offer_ddl = null
      patch.tbc_remind_on = addDays(today(), TBC_REMIND_EVERY)
    } else {
      patch.offer_ddl_tbc = false
      patch.tbc_remind_on = null
    }
  }
  patchRow('applications', id, patch)
  const from = app.status
  appendEvent(app.student_id, {
    kind: 'school',
    content:
      from === status
        ? `${appLabel(app)}：${status}${paren(offerParts({ ...merged, ...patch }))}`
        : `${appLabel(app)}：${from} → ${status}${paren(offerParts({ ...merged, ...patch }))}`,
    milestone: status !== '未递交',
  })
  suggestForApp(app.student_id, status, { ...merged, ...patch } as Application)
}

/** 设 offer DDL（date = null 表示「待确认」） */
export function setOfferDdl(id: string, date: string | null) {
  const app = findApp(id)
  if (!app) return
  const label = appLabel(app)
  if (date === null) {
    patchRow('applications', id, {
      offer_ddl: null,
      offer_ddl_tbc: true,
      tbc_remind_on: addDays(today(), TBC_REMIND_EVERY),
    })
    appendEvent(app.student_id, { kind: 'school', content: `${label} offer DDL 改为待确认`, touch: false })
    return
  }
  const had = app.offer_ddl && !app.offer_ddl_tbc ? app.offer_ddl : null
  patchRow('applications', id, { offer_ddl: date, offer_ddl_tbc: false, tbc_remind_on: null })
  if (had === date) return
  appendEvent(app.student_id, {
    kind: 'school',
    content: had
      ? `${label} offer DDL 延期：${fmtDate(had)} → ${fmtDate(date)}`
      : `${label} offer DDL 确认：${fmtDate(date)}`,
  })
}

export function snoozeTbc(id: string) {
  patchRow('applications', id, { tbc_remind_on: addDays(today(), TBC_REMIND_EVERY) })
}

/** 「已提醒学生」：记一条时间线，并记下提醒日期（这一轮的提醒就消掉了） */
export function remindApp(id: string) {
  const app = findApp(id)
  if (!app) return
  const parts = appDeadlines(app, today()).map((d) =>
    d.kind === 'offer_tbc'
      ? `${appLabel(app)} offer（DDL 待确认）`
      : `${d.title}（${fmtDate(d.date)}，${fmtDaysLeft(d.daysLeft)}）`,
  )
  const patch: Partial<Application> = { last_reminded_on: today() }
  // DDL 还待确认的：问过学生也算处理了这一轮，3 天后再提醒补 DDL
  if (isOfferTbc(app)) patch.tbc_remind_on = addDays(today(), TBC_REMIND_EVERY)
  patchRow('applications', id, patch)
  appendEvent(app.student_id, {
    kind: 'reminded',
    content: `已提醒学生 ${parts.length ? parts.join('；') : `${appLabel(app)} offer`}`,
  })
}

export function markPaymentDone(id: string) {
  const app = findApp(id)
  if (!app) return
  patchRow('applications', id, { payment_done_on: today() })
  appendEvent(app.student_id, {
    kind: 'payment',
    content: `${appLabel(app)} 押金/学费已付${app.payment_ddl ? `（截止 ${fmtDate(app.payment_ddl)}）` : ''}`,
    milestone: true,
  })
}

export function markConditionDone(id: string) {
  const app = findApp(id)
  if (!app) return
  patchRow('applications', id, { condition_done_on: today() })
  appendEvent(app.student_id, {
    kind: 'school',
    content: `${appLabel(app)} offer 条件已满足/材料已补${app.condition_text ? `：${app.condition_text}` : ''}`,
  })
}

export function deleteApplication(id: string) {
  const app = findApp(id)
  if (!app) return
  removeRow('applications', id)
  appendEvent(app.student_id, { kind: 'school', content: `删除了申请：${appDesc(app)}（${app.status}）`, touch: false })
}

// ───────────────────────── 签证 ─────────────────────────

export function addVisa(studentId: string, input: Partial<Visa>): Visa {
  const now = nowIso()
  const v: Visa = {
    id: newId(),
    student_id: studentId,
    visa_type: '500',
    materials_on: null,
    paid_on: null,
    submitted_on: null,
    medical_on: null,
    granted_on: null,
    expiry_date: null,
    expiry_ack_on: null,
    note: '',
    created_at: now,
    updated_at: now,
    ...input,
  }
  insertRows('visas', [v])
  appendEvent(studentId, { kind: 'visa', content: `新增签证：${v.visa_type}${v.note ? `（${v.note}）` : ''}` })
  return v
}

export function updateVisa(id: string, patch: Partial<Visa>) {
  const v = findVisa(id)
  if (!v) return
  if ('expiry_date' in patch && patch.expiry_date !== v.expiry_date) patch = { ...patch, expiry_ack_on: null }
  patchRow('visas', id, patch)
}

export function toggleVisaStep(id: string, step: VisaStepKey, date?: string) {
  const v = findVisa(id)
  if (!v) return
  const def = VISA_STEPS.find((s) => s.key === step)!
  if (v[step] && !date) {
    patchRow('visas', id, { [step]: null } as Partial<Visa>)
    appendEvent(v.student_id, { kind: 'visa', content: `${v.visa_type} 签证：撤销「${def.label}」`, touch: false })
    return
  }
  const d = date ?? today()
  patchRow('visas', id, { [step]: d } as Partial<Visa>)
  appendEvent(v.student_id, {
    kind: 'visa',
    content: `${v.visa_type} 签证：✓ ${def.label}`,
    occurred_on: d,
    milestone: def.milestone,
  })
  if (step === 'submitted_on') suggestCycle(v.student_id, 14, '签证已递交，等下签')
}

export function ackVisaExpiry(id: string) {
  const v = findVisa(id)
  if (!v) return
  const d = visaDeadlines(v, today())[0]
  patchRow('visas', id, { expiry_ack_on: today() })
  appendEvent(v.student_id, {
    kind: 'reminded',
    content: `已提醒学生 签证到期（${fmtDate(v.expiry_date)}${d ? `，${fmtDaysLeft(d.daysLeft)}` : ''}）`,
  })
}

export function deleteVisa(id: string) {
  const v = findVisa(id)
  if (!v) return
  removeRow('visas', id)
  appendEvent(v.student_id, { kind: 'visa', content: `删除了签证记录：${v.visa_type}`, touch: false })
}

// ───────────────────────── 关键日期 ─────────────────────────

export function addKeyDate(studentId: string, input: Pick<KeyDate, 'kind' | 'date'> & Partial<KeyDate>): KeyDate {
  const now = nowIso()
  const k: KeyDate = {
    id: newId(),
    student_id: studentId,
    note: '',
    ack_on: null,
    created_at: now,
    updated_at: now,
    ...input,
  }
  insertRows('key_dates', [k])
  return k
}

export function updateKeyDate(id: string, patch: Partial<KeyDate>) {
  const k = S().key_dates.find((x) => x.id === id)
  if (!k) return
  if (patch.date && patch.date !== k.date) patch = { ...patch, ack_on: null }
  patchRow('key_dates', id, patch)
}

export function deleteKeyDate(id: string) {
  removeRow('key_dates', id)
}

export function ackKeyDate(id: string) {
  const k = S().key_dates.find((x) => x.id === id)
  if (!k) return
  const d = keyDateDeadline(k, today())
  patchRow('key_dates', id, { ack_on: today() })
  appendEvent(k.student_id, {
    kind: 'reminded',
    content: `已提醒学生 ${k.kind}${k.note ? ` ${k.note}` : ''}（${fmtDate(k.date)}，${fmtDaysLeft(d.daysLeft)}）`,
  })
}

// ───────────────────────── 待办 ─────────────────────────

export function addTask(studentId: string, input: Pick<Task, 'content'> & Partial<Task>): Task {
  const now = nowIso()
  const t: Task = {
    id: newId(),
    student_id: studentId,
    due_date: null,
    handler: null,
    done_on: null,
    created_at: now,
    updated_at: now,
    ...input,
  }
  insertRows('tasks', [t])
  if (t.handler && !S().settings.handlers.includes(t.handler))
    saveSettings({ handlers: [...S().settings.handlers, t.handler] })
  return t
}

export function updateTask(id: string, patch: Partial<Task>) {
  patchRow('tasks', id, patch)
}

export function completeTask(id: string) {
  const t = S().tasks.find((x) => x.id === id)
  if (!t || t.done_on) return
  patchRow('tasks', id, { done_on: today() })
  appendEvent(t.student_id, {
    kind: 'task',
    content: `完成待办：${t.content}${t.handler ? `（${t.handler}）` : ''}`,
  })
}

export function reopenTask(id: string) {
  patchRow('tasks', id, { done_on: null })
}

export function postponeTask(id: string, date: string) {
  patchRow('tasks', id, { due_date: date })
}

export function deleteTask(id: string) {
  removeRow('tasks', id)
}

// ───────────────────────── 收费 ─────────────────────────

export function fmtMoney(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return currency
  return `${currency} ${amount.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`
}

export function addPayment(studentId: string, input: Partial<Payment>): Payment {
  const now = nowIso()
  const p: Payment = {
    id: newId(),
    student_id: studentId,
    item: '',
    amount: null,
    currency: 'AUD',
    paid_on: today(),
    note: '',
    created_at: now,
    updated_at: now,
    ...input,
  }
  insertRows('payments', [p])
  appendEvent(studentId, {
    kind: 'payment',
    content: `收费：${p.item || '未命名项目'} ${fmtMoney(p.amount, p.currency)}${p.note ? `（${p.note}）` : ''}`,
    occurred_on: p.paid_on ?? today(),
    milestone: true,
  })
  return p
}

export function updatePayment(id: string, patch: Partial<Payment>) {
  patchRow('payments', id, patch)
}

export function deletePayment(id: string) {
  const p = S().payments.find((x) => x.id === id)
  if (!p) return
  removeRow('payments', id)
  appendEvent(p.student_id, {
    kind: 'payment',
    content: `删除了收费记录：${p.item} ${fmtMoney(p.amount, p.currency)}`,
    touch: false,
  })
}

// ───────────────────────── 导入 / 确认清单 ─────────────────────────

export function applyImport(plans: PlannedStudent[], newAssignees: string[]) {
  insertRows(
    'students',
    plans.map((p) => p.student),
  )
  insertRows(
    'events',
    plans.flatMap((p) => p.events),
  )
  insertRows(
    'review_items',
    plans.flatMap((p) => p.reviews),
  )
  const cur = S().settings.assignees
  const add = newAssignees.filter((a) => !cur.includes(a))
  if (add.length) saveSettings({ assignees: [...cur, ...add] })
}

export function resolveReview(id: string, status: ReviewItem['status']) {
  patchRow('review_items', id, { status, resolved_at: status === 'pending' ? null : nowIso() })
}

// ───────────────────────── 示例数据 / 备份恢复 ─────────────────────────


export function loadDemo() {
  const demo = buildDemo(today(), newId)
  for (const t of TABLES) insertRows(t, (demo as any)[t] as RowOf<TableName>[])
}

/** 从 JSON 备份恢复：按 id 合并（同一条记录用备份里的覆盖） */
export function restoreBackup(data: Partial<DBState>): number {
  let count = 0
  const state = S()
  const patch: Record<string, unknown> = {}
  for (const t of TABLES) {
    const rows = (data as any)[t]
    if (!Array.isArray(rows) || !rows.length) continue
    const byId = new Map<string, any>((state[t] as any[]).map((r) => [r.id, r]))
    for (const r of rows) if (r && typeof r.id === 'string') byId.set(r.id, r)
    patch[t] = [...byId.values()]
    count += rows.length
  }
  // 先写学生（其他表引用学生 id）
  useStore.setState(patch as any)
  for (const t of TABLES) {
    const rows = (data as any)[t]
    if (Array.isArray(rows) && rows.length) enqueue({ op: 'insert', table: t, rows })
  }
  if (data.settings) saveSettings({ ...S().settings, ...data.settings })
  return count
}
