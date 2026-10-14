import type {
  AppStatus,
  Ball,
  BusinessType,
  EventKind,
  KeyDateKind,
  Priority,
  Settings,
  StudentStatus,
  VisaStepKey,
} from './types'

export const STUDENT_STATUSES: StudentStatus[] = ['未开始', '进行中', '已完成', '暂停不跟进']
export const BALLS: Ball[] = ['我们', '学生', '学校', '签证局']
export const PRIORITIES: Priority[] = ['高', '普通']
export const BUSINESS_TYPES: BusinessType[] = ['学校+签证申请', '学校申请类', '签证申请类', '其他']

export const APP_STATUSES: AppStatus[] = [
  '未递交',
  '已递交',
  'Con offer',
  'Uncon offer',
  '已接受',
  'CoE已出',
  '被拒',
  '放弃',
  'Offer已过期',
]

/** 这些状态下 offer DDL 需要提醒 */
export const OFFER_PENDING: AppStatus[] = ['Con offer', 'Uncon offer']
/** 这些状态下押金/学费付款截止需要提醒 */
export const PAYMENT_ACTIVE: AppStatus[] = ['Con offer', 'Uncon offer', '已接受']
/** 这些状态下补材料截止需要提醒 */
export const CONDITION_ACTIVE: AppStatus[] = ['Con offer', '已接受']

export const VISA_TYPES = ['500', '600', '485', '189', '190', '其他']

export const VISA_STEPS: { key: VisaStepKey; label: string; milestone: boolean }[] = [
  { key: 'materials_on', label: '材料齐全', milestone: false },
  { key: 'paid_on', label: '已付款', milestone: true },
  { key: 'submitted_on', label: '已递交', milestone: true },
  { key: 'medical_on', label: '体检完成', milestone: false },
  { key: 'granted_on', label: '已获批', milestone: true },
]

export const KEYDATE_KINDS: KeyDateKind[] = ['签证到期', '开学', 'Orientation', '毕业', '出成绩', '其他']

export const KEYDATE_ICON: Record<KeyDateKind, string> = {
  签证到期: '🛂',
  开学: '🏫',
  Orientation: '🧭',
  毕业: '🎓',
  出成绩: '📄',
  其他: '📌',
}

export const EVENT_KINDS: { kind: EventKind; icon: string; label: string }[] = [
  { kind: 'note', icon: '📝', label: '备注' },
  { kind: 'school', icon: '🏫', label: '学校进度' },
  { kind: 'visa', icon: '🛂', label: '签证' },
  { kind: 'status', icon: '🔄', label: '状态变化' },
  { kind: 'task', icon: '✅', label: '待办完成' },
  { kind: 'payment', icon: '💰', label: '收费' },
  { kind: 'reminded', icon: '📣', label: '已提醒学生' },
  { kind: 'checked', icon: '👀', label: '已检查无变化' },
]

export const EVENT_ICON: Record<EventKind, string> = Object.fromEntries(
  EVENT_KINDS.map((k) => [k.kind, k.icon]),
) as Record<EventKind, string>

export const FOLLOW_CYCLES: { days: number; label: string }[] = [
  { days: 7, label: '1周' },
  { days: 14, label: '2周' },
  { days: 30, label: '1个月' },
  { days: 90, label: '3个月' },
]

export function cycleLabel(days: number): string {
  return FOLLOW_CYCLES.find((c) => c.days === days)?.label ?? `${days}天`
}

export const CURRENCIES = ['AUD', 'CNY', 'USD']

export const DEFAULT_SETTINGS: Settings = {
  assignees: ['team 1', 'team 2', 'tingting'],
  handlers: ['Maggie', 'Cynthia老师', 'Peter老师'],
  recorder_name: '我',
}

export const UNASSIGNED = '未分配'

/** 提醒节点（提前多少天） */
export const THRESHOLDS = {
  offer: [14, 7, 3, 1, 0],
  payment: [7, 2, 0],
  condition: [7, 2, 0],
  visa_expiry: [60, 30, 7, 0],
  keydate: [7, 0],
} as const

export const TBC_REMIND_EVERY = 3
export const BALL_STUDENT_STALE_DAYS = 7
export const KEYDATE_HORIZON = 60

export const STATUS_STYLE: Record<StudentStatus, string> = {
  未开始: 'bg-slate-100 text-slate-600 ring-slate-200',
  进行中: 'bg-blue-50 text-blue-700 ring-blue-200',
  已完成: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  暂停不跟进: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
}

export const BALL_STYLE: Record<Ball, string> = {
  我们: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  学生: 'bg-amber-50 text-amber-700 ring-amber-200',
  学校: 'bg-sky-50 text-sky-700 ring-sky-200',
  签证局: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export const APP_STATUS_STYLE: Record<AppStatus, string> = {
  未递交: 'bg-slate-100 text-slate-600 ring-slate-200',
  已递交: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Con offer': 'bg-amber-50 text-amber-800 ring-amber-200',
  'Uncon offer': 'bg-orange-50 text-orange-700 ring-orange-200',
  已接受: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CoE已出: 'bg-teal-50 text-teal-700 ring-teal-200',
  被拒: 'bg-rose-50 text-rose-700 ring-rose-200',
  放弃: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
  Offer已过期: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
}
