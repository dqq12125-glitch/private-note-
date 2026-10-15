// 学生卡片要显示的内容：全部由现有数据推算出来（只用于显示，不改任何数据）。
import { KEYDATE_HORIZON, VISA_STEPS } from './constants'
import { diffDays, fmtAgo, fmtDate, fmtDaysLeft } from './dates'
import { appLabel, isOfferPending, isOfferTbc, sortApps, type Deadline, type StudentInfo } from './reminders'
import type { Application, AppStatus, Visa } from './types'

/** 列表分组 */
export type Lane = 'mine' | 'waiting' | 'dormant' | 'closed'

export const LANES: { key: Lane; label: string; hint: string; collapsed: boolean }[] = [
  { key: 'mine', label: '🔴 需要我处理', hint: '球在我们 / 有逾期待办 / 跟进到期', collapsed: false },
  { key: 'waiting', label: '🔵 等别人', hint: '等学生 / 学校 / 签证局', collapsed: false },
  { key: 'dormant', label: '⏸ 休眠中', hint: '到期会自动回来', collapsed: false },
  { key: 'closed', label: '✅ 已完成 / 暂停', hint: '', collapsed: true },
]

/** 卡片左边色条：现在该谁动 */
export type Bar = 'red' | 'orange' | 'blue' | 'gray' | 'green' | 'muted'

export type Tone = 'red' | 'orange' | 'yellow' | 'neutral'

export interface DeadlineBadge {
  /** 例如「UQ 接 offer DDL」 */
  label: string
  /** 例如「剩 5 天」「已过 2 天」 */
  when: string
  text: string
  tone: Tone
  daysLeft: number | null
  title: string
}

export type PillTone = 'gray' | 'blue' | 'yellow' | 'green' | 'red'

export interface AppPill {
  id: string
  school: string
  status: AppStatus
  tone: PillTone
  struck: boolean
}

export interface VisaTrack {
  id: string
  type: string
  steps: { key: string; label: string; done: boolean; current: boolean; date: string | null }[]
  granted: boolean
}

export interface CardInfo {
  lane: Lane
  bar: Bar
  /** 当前状态一句话 */
  headline: string
  headlineFrom: 'task' | 'app' | 'visa' | 'status'
  apps: AppPill[]
  visas: VisaTrack[]
  /** 最近的一个截止日 */
  deadline: DeadlineBadge | null
  /** 其他截止日（大卡片里全部显示） */
  moreDeadlines: DeadlineBadge[]
  tbcCount: number
  overdueTasks: number
  /** 跟进已到期几天（0 = 今天该跟进）；没到期为 null */
  followDueDays: number | null
  /** 休眠已经结束，还没恢复跟进 */
  dormancyEnded: boolean
  /** 最近一条记录；date 是发生日期（日期不明时为 null），用来做提示 */
  lastEvent: { text: string; full: string; ago: string; date: string | null } | null
  /** 组内排序：越小越靠前 */
  sortKey: [number, number, number, number]
}

// ───────────────────────── 申请 / 签证 ─────────────────────────

export function pillTone(status: AppStatus): { tone: PillTone; struck: boolean } {
  switch (status) {
    case '未递交':
      return { tone: 'gray', struck: false }
    case '已递交':
      return { tone: 'blue', struck: false }
    case 'Con offer':
      return { tone: 'yellow', struck: false }
    case 'Uncon offer':
    case '已接受':
    case 'CoE已出':
      return { tone: 'green', struck: false }
    case '被拒':
    case '放弃':
    case 'Offer已过期':
      return { tone: 'red', struck: true }
  }
}

export function appPills(apps: Application[]): AppPill[] {
  return [...apps].sort(sortApps).map((a) => ({ id: a.id, school: appLabel(a), status: a.status, ...pillTone(a.status) }))
}

export function visaTrack(v: Visa): VisaTrack {
  // 当前步骤 = 最后一个已完成的主线节点（已付款 / 已递交）之后第一个没完成的步骤。
  // 体检可以提前做，不能让它把「当前」推到已获批；已获批就没有当前步骤
  const lastMilestone = VISA_STEPS.findLastIndex((s) => s.milestone && !!v[s.key])
  const firstOpen = v.granted_on ? -1 : VISA_STEPS.findIndex((s, i) => i > lastMilestone && !v[s.key])
  return {
    id: v.id,
    type: v.visa_type,
    granted: !!v.granted_on,
    steps: VISA_STEPS.map((s, i) => ({ key: s.key, label: s.label, done: !!v[s.key], current: i === firstOpen, date: v[s.key] })),
  }
}

const ENDED: AppStatus[] = ['被拒', '放弃', 'Offer已过期']

function appSentence(apps: Application[]): string | null {
  if (!apps.length) return null
  const pending = apps.filter(isOfferPending)
  if (pending.length > 1) return `${pending.length} 个 offer 等学生决定（${pending.map(appLabel).join('、')}）`
  if (pending.length === 1) return `有 offer 等学生决定（${appLabel(pending[0])}）`
  const accepted = apps.find((a) => a.status === '已接受')
  if (accepted) {
    const school = appLabel(accepted)
    if (accepted.payment_ddl && !accepted.payment_done_on) return `已接受 ${school} offer，等付押金/学费`
    if ((accepted.condition_text || accepted.condition_ddl) && !accepted.condition_done_on) return `已接受 ${school} offer，等补材料`
    return `已接受 ${school} offer，等 CoE`
  }
  const coe = apps.find((a) => a.status === 'CoE已出')
  if (coe) return `${appLabel(coe)} CoE 已出`
  const submitted = apps.filter((a) => a.status === '已递交')
  if (submitted.length) return `已递交 ${submitted.length} 所，等 offer`
  const draft = apps.filter((a) => a.status === '未递交')
  if (draft.length) return `准备申请材料（${draft.length} 所）`
  if (apps.every((a) => ENDED.includes(a.status))) return '申请都已结束（被拒/放弃）'
  return null
}

function visaSentence(v: Visa): string {
  const t = v.visa_type && v.visa_type !== '其他' ? `${v.visa_type} 签证` : '签证'
  if (v.granted_on) return `${t}已获批`
  if (v.submitted_on) return v.medical_on ? `${t}已递交，体检已完成，等下签` : `${t}已递交，等下签`
  if (v.paid_on) return `${t}已付款，待递交`
  if (v.materials_on) return `${t}材料齐全，待付款`
  return `${t}准备材料中`
}

function latestStamp(rows: { updated_at: string }[]): string {
  return rows.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), '')
}

/** 当前状态一句话：未完成的第一条待办 > 申请/签证最新状态 > 学生状态 */
export function headlineOf(info: StudentInfo, today: string): { text: string; from: CardInfo['headlineFrom'] } {
  const s = info.s
  if (s.status === '已完成' || s.status === '暂停不跟进') return { text: s.status, from: 'status' }
  if (info.nextTask) return { text: info.nextTask.content, from: 'task' }
  const p = progressSentence(info)
  if (p) return p
  if (info.isDormant) return { text: '休眠中，暂时不用跟进', from: 'status' }
  if (s.status === '未开始') return { text: '还没开始，先约学生聊一聊', from: 'status' }
  void today
  return { text: '进行中，还没写下一步', from: 'status' }
}

function progressSentence(info: StudentInfo): { text: string; from: 'app' | 'visa' } | null {
  const app = appSentence(info.apps)
  const activeVisas = info.visas.filter((v) => !v.granted_on)
  const visa = [...(activeVisas.length ? activeVisas : info.visas)].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0]
  if (app && visa) {
    // 取最近有变化的那一个；还没决定的 offer 优先（最紧急）
    const appFirst = info.apps.some(isOfferPending) || latestStamp(info.apps) >= visa.updated_at
    return appFirst ? { text: app, from: 'app' } : { text: visaSentence(visa), from: 'visa' }
  }
  if (app) return { text: app, from: 'app' }
  if (visa) return { text: visaSentence(visa), from: 'visa' }
  return null
}

// ───────────────────────── 截止日徽章 ─────────────────────────

const BADGE_KINDS = new Set(['offer', 'payment', 'condition', 'visa_expiry'])
const BADGE_KEYDATES = new Set(['签证到期', '开学', 'Orientation'])

function badgeLabel(d: Deadline, info: StudentInfo): string {
  const app = d.ref.table === 'applications' ? info.apps.find((a) => a.id === d.ref.id) : null
  const school = app ? `${appLabel(app)} ` : ''
  switch (d.kind) {
    case 'offer':
      return `${school}接 offer DDL`
    case 'payment':
      return `${school}付款截止`
    case 'condition':
      return `${school}补材料截止`
    case 'visa_expiry':
      return '签证到期'
    case 'keydate':
      return d.title
    default:
      return d.title
  }
}

export function badgeTone(daysLeft: number): Tone {
  if (daysLeft <= 3) return 'red'
  if (daysLeft <= 7) return 'orange'
  return 'neutral'
}

export function deadlineBadges(info: StudentInfo): DeadlineBadge[] {
  return info.deadlines
    .filter(
      (d) =>
        d.date &&
        d.daysLeft !== null &&
        (BADGE_KINDS.has(d.kind) || (d.kind === 'keydate' && BADGE_KEYDATES.has(d.title))) &&
        // 已经过去的开学/Orientation 不再显示；签证到期过了、还没确认提醒的仍然显示（和首页一致）
        !(d.kind === 'keydate' && d.daysLeft < 0 && !(d.title === '签证到期' && d.reminderDue)) &&
        // 签证到期、开学这类日期只看未来 60 天（和首页一致）；offer/付款/补材料截止不限
        !((d.kind === 'visa_expiry' || d.kind === 'keydate') && d.daysLeft > KEYDATE_HORIZON),
    )
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
    .map((d) => {
      const label = badgeLabel(d, info)
      return {
        label,
        when: fmtDaysLeft(d.daysLeft),
        text: `${label} · ${fmtDaysLeft(d.daysLeft)}`,
        tone: badgeTone(d.daysLeft!),
        daysLeft: d.daysLeft,
        title: `${label}：${fmtDate(d.date)}（${fmtDaysLeft(d.daysLeft)}）${d.sub ? ` · ${d.sub}` : ''}`,
      }
    })
}

// ───────────────────────── 汇总 ─────────────────────────

export function laneOf(info: StudentInfo, today: string): Lane {
  const s = info.s
  if (s.status === '已完成' || s.status === '暂停不跟进') return 'closed'
  if (info.isDormant) return 'dormant'
  const overdueTasks = info.openTasks.filter((t) => t.due_date && t.due_date < today).length
  // 跟进到期（含休眠刚结束的学生，相当于跟进到期）
  const followDue = info.followDue || info.dormancyEnded
  if (s.ball === '我们' || overdueTasks > 0 || followDue) return 'mine'
  return 'waiting'
}

export function computeCard(info: StudentInfo, today: string): CardInfo {
  const s = info.s
  const lane = laneOf(info, today)
  // 已完成/暂停的学生不再提醒截止日（和首页一致）
  const closed = lane === 'closed'
  const badges = closed ? [] : deadlineBadges(info)
  const overdueTasks = closed ? 0 : info.openTasks.filter((t) => t.due_date && t.due_date < today).length
  const tbcCount = closed ? 0 : info.apps.filter(isOfferTbc).length
  const nearest = badges[0] ?? null
  const overdueDeadline = badges.some((b) => b.daysLeft !== null && b.daysLeft < 0)
  const urgentNow = overdueTasks > 0 || overdueDeadline || (nearest?.daysLeft ?? 99) <= 3

  let bar: Bar
  if (s.status === '已完成') bar = 'green'
  else if (s.status === '暂停不跟进') bar = 'muted'
  else if (lane === 'dormant') bar = 'gray'
  else if (lane === 'mine') bar = urgentNow ? 'red' : 'orange'
  else bar = 'blue'

  const head = headlineOf(info, today)
  // 最近动态：不算「已检查无变化」，也不算发生日期写在未来的记录
  const last = info.events.find((e) => e.kind !== 'checked' && e.occurred_on <= today) ?? info.recentEvents[0]
  const oneLine = last ? last.content.replace(/\s+/g, ' ') : ''
  const lastEvent = last
    ? {
        full: last.content,
        text: [...oneLine].length > 40 ? `${[...oneLine].slice(0, 40).join('')}…` : oneLine,
        ago: last.date_unknown ? '日期不明' : last.occurred_on > today ? '未来日期' : fmtAgo(diffDays(today, last.occurred_on)),
        date: last.date_unknown ? null : last.occurred_on,
      }
    : null
  // 休眠刚结束的只显示「休眠已结束」，不再重复显示「跟进到期」
  const followDueDays = !closed && info.followDue && !info.dormancyEnded && s.next_follow_date ? diffDays(today, s.next_follow_date) : null

  // 组内排序：已逾期 > DDL 越近 > 跟进超期越久 > 高优先级
  const followOverdue = info.active && s.next_follow_date && s.next_follow_date < today ? diffDays(today, s.next_follow_date) : 0
  const sortKey: CardInfo['sortKey'] = [
    overdueTasks > 0 || overdueDeadline ? 0 : 1,
    nearest?.daysLeft ?? 9999,
    -followOverdue,
    s.priority === '高' ? 0 : 1,
  ]

  return {
    lane,
    bar,
    headline: head.text,
    headlineFrom: head.from,
    apps: appPills(info.apps),
    // 正在办的签证排前面（最近有变化的在前），和「当前状态一句话」挑的是同一个
    visas: [...info.visas]
      .sort(
        (a, b) =>
          Number(!!a.granted_on) - Number(!!b.granted_on) || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0),
      )
      .map(visaTrack),
    deadline: nearest,
    moreDeadlines: badges.slice(1),
    tbcCount,
    overdueTasks,
    followDueDays,
    dormancyEnded: !closed && info.dormancyEnded,
    lastEvent,
    sortKey,
  }
}

export function compareCards(a: { card: CardInfo; info: StudentInfo }, b: { card: CardInfo; info: StudentInfo }): number {
  const byName = () => a.info.s.name.localeCompare(b.info.s.name, 'zh-CN')
  if (a.card.lane === 'dormant' && b.card.lane === 'dormant') {
    const da = a.info.s.dormant_until ?? ''
    const db = b.info.s.dormant_until ?? ''
    return da !== db ? (da < db ? -1 : 1) : byName()
  }
  if (a.card.lane === 'closed' && b.card.lane === 'closed') {
    if (a.info.s.status !== b.info.s.status) return a.info.s.status === '已完成' ? -1 : 1
    const ua = a.info.lastUpdate ?? ''
    const ub = b.info.lastUpdate ?? ''
    return ua !== ub ? (ub < ua ? -1 : 1) : byName()
  }
  for (let i = 0; i < 4; i++) if (a.card.sortKey[i] !== b.card.sortKey[i]) return a.card.sortKey[i] - b.card.sortKey[i]
  return byName()
}

/** 负责人头像上的字 */
export function avatarText(assignee: string | null): string {
  if (!assignee) return '?'
  const m = assignee.match(/^team\s*(\d+)$/i)
  if (m) return `T${m[1]}`
  return [...assignee.trim()][0]?.toUpperCase() ?? '?'
}

/** 负责人头像颜色（同一个人颜色固定） */
export function avatarHue(assignee: string | null): number {
  if (!assignee) return 40
  let h = 0
  for (const ch of assignee) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
