// 学生卡片要显示的内容：全部由现有数据推算出来（只用于显示，不改任何数据）。
import { VISA_STEPS } from './constants'
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
  lastEvent: { text: string; full: string; ago: string } | null
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
  const firstOpen = VISA_STEPS.findIndex((s) => !v[s.key])
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
  if (s.status === '已完成' || s.status === '暂停不跟进') {
    const extra = progressSentence(info)
    return { text: extra ? `${s.status} · ${extra.text}` : s.status, from: 'status' }
  }
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
        // 已经过去的开学/Orientation 不再显示；签证到期过了仍然提醒
        !(d.kind === 'keydate' && d.title !== '签证到期' && d.daysLeft < 0),
    )
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
    .map((d) => {
      const label = badgeLabel(d, info)
      return {
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
  const badges = deadlineBadges(info)
  const overdueTasks = info.openTasks.filter((t) => t.due_date && t.due_date < today).length
  const tbcCount = info.apps.filter(isOfferTbc).length
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
  const last = info.recentEvents[0]
  const lastEvent = last
    ? {
        full: last.content,
        text: [...last.content.replace(/\s+/g, ' ')].length > 40 ? `${[...last.content.replace(/\s+/g, ' ')].slice(0, 40).join('')}…` : last.content.replace(/\s+/g, ' '),
        ago: last.date_unknown ? '日期不明' : fmtAgo(diffDays(today, last.occurred_on)),
      }
    : null

  // 组内排序：已逾期 > DDL 越近 > 跟进超期越久 > 高优先级
  const followOverdue =
    info.active && s.next_follow_date && s.next_follow_date < today ? diffDays(today, s.next_follow_date) : 0
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
    visas: info.visas.map(visaTrack),
    deadline: nearest,
    moreDeadlines: badges.slice(1),
    tbcCount,
    overdueTasks,
    lastEvent,
    sortKey,
  }
}

export function compareCards(a: { card: CardInfo; info: StudentInfo }, b: { card: CardInfo; info: StudentInfo }): number {
  if (a.card.lane === 'dormant' && b.card.lane === 'dormant')
    return (a.info.s.dormant_until ?? '') < (b.info.s.dormant_until ?? '') ? -1 : 1
  if (a.card.lane === 'closed' && b.card.lane === 'closed') {
    if (a.info.s.status !== b.info.s.status) return a.info.s.status === '已完成' ? -1 : 1
    return (b.info.lastUpdate ?? '') < (a.info.lastUpdate ?? '') ? -1 : 1
  }
  for (let i = 0; i < 4; i++) if (a.card.sortKey[i] !== b.card.sortKey[i]) return a.card.sortKey[i] - b.card.sortKey[i]
  return a.info.s.name.localeCompare(b.info.s.name, 'zh-CN')
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
