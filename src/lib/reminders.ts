// 提醒引擎：根据数据和「今天」算出所有截止日、提醒、分组。全部是纯函数。
import {
  BALL_STUDENT_STALE_DAYS,
  CONDITION_ACTIVE,
  KEYDATE_HORIZON,
  KEYDATE_ICON,
  OFFER_PENDING,
  PAYMENT_ACTIVE,
  THRESHOLDS,
} from './constants'
import { addDays, diffDays, fmtDate, fmtDaysLeft, isoToDate, maxDate } from './dates'
import type { Application, DBState, KeyDate, Student, Task, TimelineEvent, Visa } from './types'

export type DeadlineKind = 'offer' | 'offer_tbc' | 'payment' | 'condition' | 'visa_expiry' | 'keydate' | 'task'

export interface Deadline {
  key: string
  kind: DeadlineKind
  student_id: string
  date: string | null
  daysLeft: number | null
  icon: string
  /** 例如「UQ offer DDL」 */
  title: string
  /** 例如「Master of IT · 2027 S1」 */
  sub: string
  /** 进入了新的提醒节点，还没处理 */
  reminderDue: boolean
  ackOn: string | null
  ref: { table: 'applications' | 'visas' | 'key_dates' | 'tasks'; id: string }
}

/** 当前所处的提醒节点（提前多少天），还没进入任何节点时返回 null */
export function stageFor(daysLeft: number, thresholds: readonly number[]): number | null {
  const sorted = [...thresholds].sort((a, b) => a - b)
  if (daysLeft > sorted[sorted.length - 1]) return null
  for (const t of sorted) if (t >= daysLeft) return t
  return sorted[0]
}

/** 进入当前节点后还没有提醒/确认过 → 需要提醒 */
export function isReminderDue(
  date: string,
  daysLeft: number,
  thresholds: readonly number[],
  ackOn: string | null,
): boolean {
  const stage = stageFor(daysLeft, thresholds)
  if (stage === null) return false
  const stageStart = addDays(date, -stage)
  return !ackOn || ackOn < stageStart
}

export function appLabel(app: Pick<Application, 'school' | 'program'>): string {
  return app.school || app.program || '未命名学校'
}

export function appSub(app: Pick<Application, 'program' | 'intake'>): string {
  return [app.program, app.intake].filter(Boolean).join(' · ')
}

export function isOfferPending(app: Application): boolean {
  return OFFER_PENDING.includes(app.status)
}

export function isOfferTbc(app: Application): boolean {
  return isOfferPending(app) && (app.offer_ddl_tbc || !app.offer_ddl)
}

export function appDeadlines(app: Application, today: string): Deadline[] {
  const out: Deadline[] = []
  const base = { student_id: app.student_id, sub: appSub(app), ackOn: app.last_reminded_on }
  const ref = { table: 'applications' as const, id: app.id }
  if (isOfferPending(app)) {
    if (isOfferTbc(app)) {
      out.push({
        ...base,
        key: `app:${app.id}:offer`,
        kind: 'offer_tbc',
        date: null,
        daysLeft: null,
        icon: '⏳',
        title: `${appLabel(app)} offer DDL 待确认`,
        reminderDue: !app.tbc_remind_on || app.tbc_remind_on <= today,
        ref,
      })
    } else if (app.offer_ddl) {
      const daysLeft = diffDays(app.offer_ddl, today)
      out.push({
        ...base,
        key: `app:${app.id}:offer`,
        kind: 'offer',
        date: app.offer_ddl,
        daysLeft,
        icon: '⏳',
        title: `${appLabel(app)} offer DDL`,
        reminderDue: isReminderDue(app.offer_ddl, daysLeft, THRESHOLDS.offer, app.last_reminded_on),
        ref,
      })
    }
  }
  if (PAYMENT_ACTIVE.includes(app.status) && app.payment_ddl && !app.payment_done_on) {
    const daysLeft = diffDays(app.payment_ddl, today)
    out.push({
      ...base,
      key: `app:${app.id}:payment`,
      kind: 'payment',
      date: app.payment_ddl,
      daysLeft,
      icon: '💳',
      title: `${appLabel(app)} 押金/学费付款截止`,
      reminderDue: isReminderDue(app.payment_ddl, daysLeft, THRESHOLDS.payment, app.last_reminded_on),
      ref,
    })
  }
  if (CONDITION_ACTIVE.includes(app.status) && app.condition_ddl && !app.condition_done_on) {
    const daysLeft = diffDays(app.condition_ddl, today)
    out.push({
      ...base,
      key: `app:${app.id}:condition`,
      kind: 'condition',
      date: app.condition_ddl,
      daysLeft,
      icon: '📑',
      title: `${appLabel(app)} 补材料截止${app.condition_text ? `（${app.condition_text}）` : ''}`,
      reminderDue: isReminderDue(app.condition_ddl, daysLeft, THRESHOLDS.condition, app.last_reminded_on),
      ref,
    })
  }
  return out
}

export function visaDeadlines(visa: Visa, today: string): Deadline[] {
  if (!visa.expiry_date) return []
  const daysLeft = diffDays(visa.expiry_date, today)
  if (daysLeft < -30) return []
  return [
    {
      key: `visa:${visa.id}:expiry`,
      kind: 'visa_expiry',
      student_id: visa.student_id,
      date: visa.expiry_date,
      daysLeft,
      icon: '🛂',
      title: `当前签证到期${visa.visa_type ? `（${visa.visa_type}）` : ''}`,
      sub: visa.note,
      reminderDue: isReminderDue(visa.expiry_date, daysLeft, THRESHOLDS.visa_expiry, visa.expiry_ack_on),
      ackOn: visa.expiry_ack_on,
      ref: { table: 'visas', id: visa.id },
    },
  ]
}

export function keyDateDeadline(kd: KeyDate, today: string): Deadline {
  const daysLeft = diffDays(kd.date, today)
  const thresholds = kd.kind === '签证到期' ? THRESHOLDS.visa_expiry : THRESHOLDS.keydate
  return {
    key: `kd:${kd.id}`,
    kind: 'keydate',
    student_id: kd.student_id,
    date: kd.date,
    daysLeft,
    icon: KEYDATE_ICON[kd.kind],
    title: kd.kind,
    sub: kd.note,
    // 已经过去的关键日期（开学、毕业）不再提醒；签证到期过了也要提醒
    reminderDue:
      (daysLeft >= 0 || kd.kind === '签证到期') && isReminderDue(kd.date, daysLeft, thresholds, kd.ack_on),
    ackOn: kd.ack_on,
    ref: { table: 'key_dates', id: kd.id },
  }
}

export function taskDeadline(task: Task, today: string): Deadline | null {
  if (task.done_on) return null
  const daysLeft = task.due_date ? diffDays(task.due_date, today) : null
  return {
    key: `task:${task.id}`,
    kind: 'task',
    student_id: task.student_id,
    date: task.due_date,
    daysLeft,
    icon: '☑️',
    title: task.content,
    sub: task.handler ? `交给 ${task.handler}` : '',
    reminderDue: daysLeft !== null && daysLeft <= 0,
    ackOn: null,
    ref: { table: 'tasks', id: task.id },
  }
}

/** 截止日剩余天数 → 颜色等级 */
export type Urgency = 'red' | 'orange' | 'yellow' | 'none'
export function offerUrgency(daysLeft: number | null): Urgency {
  if (daysLeft === null) return 'orange'
  if (daysLeft <= 3) return 'red'
  if (daysLeft <= 7) return 'orange'
  if (daysLeft <= 14) return 'yellow'
  return 'none'
}

export function ddlText(d: Deadline): string {
  if (d.kind === 'offer_tbc') return '待确认'
  if (!d.date) return '无日期'
  return `${fmtDate(d.date)}（${fmtDaysLeft(d.daysLeft)}）`
}

// ───────────────────────── 每个学生的综合信息 ─────────────────────────

export type GroupKey = 'urgent' | 'ours' | 'waiting' | 'notStarted' | 'dormant' | 'done' | 'paused'

export const GROUPS: { key: GroupKey; label: string; collapsed: boolean }[] = [
  { key: 'urgent', label: '🔥 需要处理', collapsed: false },
  { key: 'ours', label: '🟢 进行中 · 球在我们这', collapsed: false },
  { key: 'waiting', label: '🟡 进行中 · 等学生/学校/签证局', collapsed: false },
  { key: 'notStarted', label: '⚪ 未开始', collapsed: false },
  { key: 'dormant', label: '💤 休眠中', collapsed: true },
  { key: 'done', label: '✅ 已完成', collapsed: true },
  { key: 'paused', label: '⏸ 暂停不跟进', collapsed: true },
]

export type InspectReasonKind =
  | 'offer'
  | 'tbc'
  | 'task'
  | 'deadline'
  | 'dormant_end'
  | 'follow'
  | 'ball_student'

export interface InspectReason {
  kind: InspectReasonKind
  label: string
  /** 越小越急 */
  severity: number
}

export type Stale = 'ok' | 'warn' | 'bad'

export interface StudentInfo {
  s: Student
  active: boolean
  /** 最近一条时间线的发生日期（不含「已检查无变化」） */
  lastUpdate: string | null
  daysSinceUpdate: number | null
  stale: Stale
  isDormant: boolean
  dormancyEnded: boolean
  events: TimelineEvent[]
  recentEvents: TimelineEvent[]
  openTasks: Task[]
  nextTask: Task | null
  apps: Application[]
  visas: Visa[]
  keyDates: KeyDate[]
  deadlines: Deadline[]
  /** 最近的 offer / 付款 / 补材料截止日 */
  nearestDdl: Deadline | null
  hasTbc: boolean
  followDue: boolean
  ballStale: boolean
  urgentReasons: string[]
  inspectReasons: InspectReason[]
  inspectSeverity: number
  handledToday: boolean
  group: GroupKey
  searchText: string
}

export function sortEventsDesc(a: TimelineEvent, b: TimelineEvent): number {
  if (a.occurred_on !== b.occurred_on) return a.occurred_on < b.occurred_on ? 1 : -1
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

function groupBy<T extends { student_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const arr = m.get(r.student_id)
    if (arr) arr.push(r)
    else m.set(r.student_id, [r])
  }
  return m
}

export function sortTasks(a: Task, b: Task): number {
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  if (a.due_date) return -1
  if (b.due_date) return 1
  return a.created_at < b.created_at ? -1 : 1
}

const APP_ORDER: Record<string, number> = {
  'Con offer': 0,
  'Uncon offer': 0,
  已接受: 1,
  已递交: 2,
  未递交: 3,
  CoE已出: 4,
  被拒: 5,
  放弃: 6,
  Offer已过期: 7,
}

/** 申请学校排序：有 offer 的按 DDL 从近到远，其余按状态 */
export function sortApps(a: Application, b: Application): number {
  const oa = APP_ORDER[a.status] ?? 9
  const ob = APP_ORDER[b.status] ?? 9
  if (oa !== ob) return oa - ob
  if (oa === 0) {
    const da = isOfferTbc(a) ? '0000' : (a.offer_ddl ?? '9999')
    const db = isOfferTbc(b) ? '0000' : (b.offer_ddl ?? '9999')
    if (da !== db) return da < db ? -1 : 1
  }
  return a.created_at < b.created_at ? -1 : 1
}

export function computeStudentInfos(db: DBState, today: string): StudentInfo[] {
  const eventsBy = groupBy(db.events)
  const tasksBy = groupBy(db.tasks)
  const appsBy = groupBy(db.applications)
  const visasBy = groupBy(db.visas)
  const kdBy = groupBy(db.key_dates)

  return db.students.map((s) => {
    const events = [...(eventsBy.get(s.id) ?? [])].sort(sortEventsDesc)
    const tasks = tasksBy.get(s.id) ?? []
    const apps = [...(appsBy.get(s.id) ?? [])].sort(sortApps)
    const visas = visasBy.get(s.id) ?? []
    const keyDates = [...(kdBy.get(s.id) ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1))

    const active = s.status === '未开始' || s.status === '进行中'
    const realEvents = events.filter((e) => e.kind !== 'checked')
    const lastUpdate = realEvents[0]?.occurred_on ?? null
    const sinceBase = lastUpdate ?? isoToDate(s.created_at)
    const daysSinceUpdate = diffDays(today, sinceBase)
    const cycle = Math.max(1, s.follow_cycle_days || 14)
    const stale: Stale = daysSinceUpdate <= cycle ? 'ok' : daysSinceUpdate <= cycle * 2 ? 'warn' : 'bad'

    const isDormant = !!s.dormant_until && s.dormant_until > today
    const dormancyEnded = !!s.dormant_until && s.dormant_until <= today

    const openTasks = tasks.filter((t) => !t.done_on).sort(sortTasks)

    const deadlines: Deadline[] = []
    for (const a of apps) deadlines.push(...appDeadlines(a, today))
    for (const v of visas) deadlines.push(...visaDeadlines(v, today))
    for (const k of keyDates) deadlines.push(keyDateDeadline(k, today))
    for (const t of openTasks) {
      const d = taskDeadline(t, today)
      if (d) deadlines.push(d)
    }

    const offerish = deadlines.filter(
      (d) => (d.kind === 'offer' || d.kind === 'payment' || d.kind === 'condition') && d.date,
    )
    offerish.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
    const nearestDdl = offerish[0] ?? null
    const hasTbc = deadlines.some((d) => d.kind === 'offer_tbc')

    const followDue = active && !isDormant && !!s.next_follow_date && s.next_follow_date <= today
    const lastAny = maxDate(lastUpdate)
    const ballStale =
      active &&
      !isDormant &&
      s.ball === '学生' &&
      diffDays(today, lastAny ?? isoToDate(s.created_at)) > BALL_STUDENT_STALE_DAYS

    // 🔥 需要处理：有逾期、今天到期、或 offer DDL 3 天内
    const urgentReasons: string[] = []
    for (const d of deadlines) {
      if (d.kind === 'offer' && d.daysLeft !== null && d.daysLeft <= 3)
        urgentReasons.push(`${d.title} ${fmtDaysLeft(d.daysLeft)}`)
      else if (d.kind === 'task' && d.daysLeft !== null && d.daysLeft <= 0)
        urgentReasons.push(`待办「${d.title}」${d.daysLeft === 0 ? '今天到期' : '已逾期'}`)
      else if ((d.kind === 'payment' || d.kind === 'condition') && d.daysLeft !== null && d.daysLeft <= 0)
        urgentReasons.push(`${d.title} ${fmtDaysLeft(d.daysLeft)}`)
      else if ((d.kind === 'keydate' || d.kind === 'visa_expiry') && d.daysLeft === 0 && d.reminderDue)
        urgentReasons.push(`${d.title} 今天`)
    }

    // 每日巡检的理由
    const inspectReasons: InspectReason[] = []
    if (active && !isDormant) {
      for (const d of deadlines) {
        if (d.kind === 'offer' && d.daysLeft !== null && d.daysLeft <= 14)
          inspectReasons.push({
            kind: 'offer',
            label: `${d.title} ${fmtDaysLeft(d.daysLeft)}`,
            severity: d.daysLeft <= 3 ? 0 : d.daysLeft <= 7 ? 3 : 4,
          })
        else if (d.kind === 'offer_tbc' && d.reminderDue)
          inspectReasons.push({ kind: 'tbc', label: `${d.title}，记得补上`, severity: 5 })
        else if (d.kind === 'task' && d.daysLeft !== null && d.daysLeft <= 0)
          inspectReasons.push({
            kind: 'task',
            label: `待办「${d.title}」${d.daysLeft === 0 ? '今天到期' : fmtDaysLeft(d.daysLeft)}`,
            severity: d.daysLeft < 0 ? 1 : 2,
          })
        else if ((d.kind === 'payment' || d.kind === 'condition') && d.daysLeft !== null && d.daysLeft <= 2)
          inspectReasons.push({
            kind: 'deadline',
            label: `${d.title} ${fmtDaysLeft(d.daysLeft)}`,
            severity: d.daysLeft <= 0 ? 1 : 3,
          })
      }
      if (followDue)
        inspectReasons.push({
          kind: 'follow',
          label:
            s.next_follow_date === today
              ? '今天该跟进了'
              : `跟进已到期（${fmtDate(s.next_follow_date)}）`,
          severity: 6,
        })
      if (ballStale)
        inspectReasons.push({
          kind: 'ball_student',
          label: `球在学生 ${daysSinceUpdate} 天没动静，去催一下`,
          severity: 6,
        })
    }
    if (dormancyEnded && s.status !== '已完成' && s.status !== '暂停不跟进')
      inspectReasons.push({
        kind: 'dormant_end',
        label: `休眠结束${s.dormant_reason ? `（当初原因：${s.dormant_reason}）` : ''}`,
        severity: 5,
      })
    const inspectSeverity = inspectReasons.length ? Math.min(...inspectReasons.map((r) => r.severity)) : 99

    const handledToday = events.some((e) => e.source !== 'import' && isoToDate(e.created_at) === today)

    let group: GroupKey
    if (s.status === '已完成') group = 'done'
    else if (s.status === '暂停不跟进') group = 'paused'
    else if (isDormant) group = 'dormant'
    else if (urgentReasons.length) group = 'urgent'
    else if (s.status === '未开始') group = 'notStarted'
    else if (s.ball === '我们') group = 'ours'
    else group = 'waiting'

    const searchText = [
      s.name,
      s.english_name,
      s.background,
      s.contact,
      s.referrer,
      s.assignee,
      ...apps.flatMap((a) => [a.school, a.program, a.note, a.condition_text]),
      ...visas.map((v) => `${v.visa_type} ${v.note}`),
      ...keyDates.map((k) => k.note),
      ...tasks.map((t) => t.content),
      ...events.map((e) => e.content),
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase()

    return {
      s,
      active,
      lastUpdate,
      daysSinceUpdate,
      stale,
      isDormant,
      dormancyEnded,
      events,
      recentEvents: realEvents.slice(0, 3),
      openTasks,
      nextTask: openTasks[0] ?? null,
      apps,
      visas,
      keyDates,
      deadlines,
      nearestDdl,
      hasTbc,
      followDue,
      ballStale,
      urgentReasons,
      inspectReasons,
      inspectSeverity,
      handledToday,
      group,
      searchText,
    }
  })
}

/** 学生在各分组内的默认排序 */
export function defaultGroupSort(a: StudentInfo, b: StudentInfo): number {
  if (a.group === 'urgent' || a.group === 'ours' || a.group === 'waiting' || a.group === 'notStarted') {
    // 高优先级在前，然后最久没动的在前
    if (a.s.priority !== b.s.priority) return a.s.priority === '高' ? -1 : 1
    const da = a.daysSinceUpdate ?? 0
    const db = b.daysSinceUpdate ?? 0
    if (da !== db) return db - da
  }
  if (a.group === 'dormant') return (a.s.dormant_until ?? '') < (b.s.dormant_until ?? '') ? -1 : 1
  if (a.group === 'done' || a.group === 'paused') return (b.lastUpdate ?? '') < (a.lastUpdate ?? '') ? -1 : 1
  return a.s.name.localeCompare(b.s.name, 'zh-CN')
}

// ───────────────────────── 首页 / 巡检 用的汇总 ─────────────────────────

export function isFollowedStudent(info: StudentInfo): boolean {
  return info.s.status !== '已完成' && info.s.status !== '暂停不跟进'
}

/** 今天需要处理的学生（还没处理的 + 今天已处理的） */
export function todayQueue(infos: StudentInfo[]): { pending: StudentInfo[]; done: StudentInfo[] } {
  const pending = infos
    .filter((i) => i.inspectReasons.length > 0 && !i.handledToday)
    .sort((a, b) => {
      if (a.inspectSeverity !== b.inspectSeverity) return a.inspectSeverity - b.inspectSeverity
      if (a.s.priority !== b.s.priority) return a.s.priority === '高' ? -1 : 1
      return (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0)
    })
  const done = infos.filter((i) => i.handledToday)
  return { pending, done }
}

/** 连续记录天数（按录入时间算；周末没记录不算中断） */
export function recordStreak(events: TimelineEvent[], today: string): { streak: number; recordedToday: boolean } {
  const days = new Set<string>()
  for (const e of events) if (e.source !== 'import') days.add(isoToDate(e.created_at))
  const recordedToday = days.has(today)
  let streak = 0
  let d = recordedToday ? today : addDays(today, -1)
  for (let i = 0; i < 3650; i++) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (days.has(d)) streak++
    else if (wd !== 0 && wd !== 6) break
    d = addDays(d, -1)
  }
  return { streak, recordedToday }
}

export type TaskBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate'

export const TASK_BUCKETS: { key: TaskBucket; label: string; collapsed: boolean }[] = [
  { key: 'overdue', label: '🔴 已逾期', collapsed: false },
  { key: 'today', label: '🟠 今天', collapsed: false },
  { key: 'tomorrow', label: '🟡 明天', collapsed: false },
  { key: 'week', label: '🔵 本周', collapsed: false },
  { key: 'later', label: '⚪ 下周及以后', collapsed: true },
  { key: 'nodate', label: '⚪ 没有截止日', collapsed: true },
]

export function taskBucket(due: string | null, today: string, weekEnd: string): TaskBucket {
  if (!due) return 'nodate'
  const n = diffDays(due, today)
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (due <= weekEnd) return 'week'
  return 'later'
}

/** 首页「关键日期」：未来 60 天内（含今天）的关键日期、签证到期、付款/补材料截止 */
export function upcomingKeyDeadlines(infos: StudentInfo[]): Deadline[] {
  const out: Deadline[] = []
  for (const i of infos) {
    if (!isFollowedStudent(i)) continue
    for (const d of i.deadlines) {
      if (d.kind !== 'keydate' && d.kind !== 'visa_expiry' && d.kind !== 'payment' && d.kind !== 'condition')
        continue
      if (d.daysLeft === null) continue
      const overdueStillRelevant = d.daysLeft < 0 && d.kind !== 'keydate'
      const overdueVisa = d.daysLeft < 0 && d.title === '签证到期' && d.reminderDue
      if ((d.daysLeft >= 0 && d.daysLeft <= KEYDATE_HORIZON) || overdueStillRelevant || overdueVisa) out.push(d)
    }
  }
  return out.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
}

/** 首页「Offer DDL 倒计时」：所有还没接受或放弃的 offer */
export function offerCountdown(infos: StudentInfo[]): Deadline[] {
  const out: Deadline[] = []
  for (const i of infos) {
    if (!isFollowedStudent(i)) continue
    for (const d of i.deadlines) if (d.kind === 'offer' || d.kind === 'offer_tbc') out.push(d)
  }
  return out.sort((a, b) => {
    // 待确认的排最前（需要补），然后按剩余天数
    const da = a.daysLeft ?? -9999
    const db = b.daysLeft ?? -9999
    return da - db
  })
}
