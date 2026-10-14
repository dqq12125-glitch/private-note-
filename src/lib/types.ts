// 所有日期字段（发生日期、截止日等）都用 'YYYY-MM-DD' 字符串，表示悉尼当地日期。
// 所有时间戳字段（created_at 等）都用 ISO 字符串（UTC）。

export type StudentStatus = '未开始' | '进行中' | '已完成' | '暂停不跟进'
export type Ball = '我们' | '学生' | '学校' | '签证局'
export type Priority = '高' | '普通'
export type BusinessType = '学校+签证申请' | '学校申请类' | '签证申请类' | '其他'

export interface ImportMeta {
  row: number
  original_name: string
  original_status: string
  original_business: string
  original_assignee: string
  original_last_update: string
  imported_at: string
}

export interface Student {
  id: string
  name: string
  english_name: string | null
  /** 负责人，null = 未分配 */
  assignee: string | null
  business_type: BusinessType
  status: StudentStatus
  ball: Ball
  priority: Priority
  background: string
  referrer: string | null
  contact: string | null
  follow_cycle_days: number
  next_follow_date: string | null
  last_handled_date: string | null
  last_checked_date: string | null
  dormant_until: string | null
  dormant_reason: string | null
  import_meta: ImportMeta | null
  created_at: string
  updated_at: string
}

export type AppStatus =
  | '未递交'
  | '已递交'
  | 'Con offer'
  | 'Uncon offer'
  | '已接受'
  | 'CoE已出'
  | '被拒'
  | '放弃'
  | 'Offer已过期'

export interface Application {
  id: string
  student_id: string
  school: string
  program: string
  intake: string
  status: AppStatus
  note: string
  /** 接 offer 截止日 */
  offer_ddl: string | null
  /** DDL 待确认 */
  offer_ddl_tbc: boolean
  /** 待确认时，下一次提醒我补 DDL 的日期（每 3 天） */
  tbc_remind_on: string | null
  payment_ddl: string | null
  payment_done_on: string | null
  condition_text: string
  condition_ddl: string | null
  condition_done_on: string | null
  /** 上次「已提醒学生」的日期 */
  last_reminded_on: string | null
  created_at: string
  updated_at: string
}

export type VisaStepKey = 'materials_on' | 'paid_on' | 'submitted_on' | 'medical_on' | 'granted_on'

export interface Visa {
  id: string
  student_id: string
  visa_type: string
  materials_on: string | null
  paid_on: string | null
  submitted_on: string | null
  medical_on: string | null
  granted_on: string | null
  /** 当前签证到期日 */
  expiry_date: string | null
  expiry_ack_on: string | null
  note: string
  created_at: string
  updated_at: string
}

export type KeyDateKind = '签证到期' | '开学' | 'Orientation' | '毕业' | '出成绩' | '其他'

export interface KeyDate {
  id: string
  student_id: string
  kind: KeyDateKind
  date: string
  note: string
  ack_on: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  student_id: string
  content: string
  due_date: string | null
  /** 交给谁（可选） */
  handler: string | null
  done_on: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  student_id: string
  item: string
  amount: number | null
  currency: string
  paid_on: string | null
  note: string
  created_at: string
  updated_at: string
}

export type EventKind = 'note' | 'school' | 'visa' | 'status' | 'task' | 'payment' | 'reminded' | 'checked'

export interface EventEdit {
  content: string
  occurred_on: string
  date_unknown: boolean
  edited_at: string
}

export interface TimelineEvent {
  id: string
  student_id: string
  kind: EventKind
  /** 发生日期（可改，用来补记） */
  occurred_on: string
  /** 导入时没写日期 */
  date_unknown: boolean
  content: string
  /** 记录人 */
  recorder: string | null
  milestone: boolean
  /** 编辑前的历史版本（最早的在前） */
  edit_history: EventEdit[]
  edited_at: string | null
  source: 'import' | null
  /** 录入时间（自动，不能改） */
  created_at: string
}

export type ReviewKind = 'date_mention' | 'offer_mention' | 'status_conflict'

export interface ReviewSuggestion {
  date?: string | null
  approx?: boolean
  target?: 'task' | 'keydate'
  keydate_kind?: KeyDateKind
  schools?: { school: string; status: AppStatus }[]
  status?: StudentStatus
  from?: string
}

export interface ReviewItem {
  id: string
  student_id: string
  kind: ReviewKind
  text: string
  suggestion: ReviewSuggestion
  status: 'pending' | 'done' | 'dismissed'
  created_at: string
  resolved_at: string | null
}

export interface Settings {
  assignees: string[]
  handlers: string[]
  recorder_name: string
}

export interface DBState {
  students: Student[]
  applications: Application[]
  visas: Visa[]
  key_dates: KeyDate[]
  tasks: Task[]
  payments: Payment[]
  events: TimelineEvent[]
  review_items: ReviewItem[]
  settings: Settings
}

export type TableName = Exclude<keyof DBState, 'settings'>

export type RowOf<T extends TableName> = DBState[T][number]
