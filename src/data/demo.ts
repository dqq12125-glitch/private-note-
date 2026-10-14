// 示例数据：方便第一次打开时看看效果（日期都相对于今天生成）
import { addDays } from '../lib/dates'
import type {
  Application,
  DBState,
  EventKind,
  KeyDate,
  Payment,
  Student,
  Task,
  TimelineEvent,
  Visa,
} from '../lib/types'

export function buildDemo(today: string, newId: () => string): Omit<DBState, 'settings' | 'review_items'> & { review_items: [] } {
  const ts = (date: string, h = 10) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00+11:00`).toISOString()
  const d = (n: number) => addDays(today, n)
  const students: Student[] = []
  const applications: Application[] = []
  const visas: Visa[] = []
  const key_dates: KeyDate[] = []
  const tasks: Task[] = []
  const payments: Payment[] = []
  const events: TimelineEvent[] = []

  const student = (p: Partial<Student> & { name: string }): Student => {
    const created = ts(d(-90))
    const s: Student = {
      id: newId(),
      english_name: null,
      assignee: 'team 1',
      business_type: '学校+签证申请',
      status: '进行中',
      ball: '我们',
      priority: '普通',
      background: '',
      referrer: null,
      contact: null,
      follow_cycle_days: 14,
      next_follow_date: d(7),
      last_handled_date: d(-7),
      last_checked_date: null,
      dormant_until: null,
      dormant_reason: null,
      import_meta: null,
      created_at: created,
      updated_at: created,
      ...p,
    }
    students.push(s)
    return s
  }
  const ev = (s: Student, n: number, content: string, kind: EventKind = 'note', milestone = false) =>
    events.push({
      id: newId(),
      student_id: s.id,
      kind,
      occurred_on: d(n),
      date_unknown: false,
      content,
      recorder: '示例',
      milestone,
      edit_history: [],
      edited_at: null,
      source: 'import',
      created_at: ts(d(n), 9 + (events.length % 8)),
    })
  const app = (s: Student, p: Partial<Application>) =>
    applications.push({
      id: newId(),
      student_id: s.id,
      school: '',
      program: '',
      intake: '2027 S1',
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
      created_at: ts(d(-60)),
      updated_at: ts(d(-60)),
      ...p,
    })
  const task = (s: Student, content: string, due: number | null, handler: string | null = null) =>
    tasks.push({
      id: newId(),
      student_id: s.id,
      content,
      due_date: due === null ? null : d(due),
      handler,
      done_on: null,
      created_at: ts(d(-5)),
      updated_at: ts(d(-5)),
    })
  const kd = (s: Student, kind: KeyDate['kind'], n: number, note = '') =>
    key_dates.push({ id: newId(), student_id: s.id, kind, date: d(n), note, ack_on: null, created_at: ts(d(-30)), updated_at: ts(d(-30)) })

  // 1. 两个 offer，DDL 很近
  const s1 = student({
    name: '示例·王小明',
    english_name: 'Tom',
    priority: '高',
    background: '本科 211 计算机，想读 IT 硕士，预算 50 万以内。家长比较着急。',
    contact: '妈妈微信：王妈妈',
    follow_cycle_days: 7,
    next_follow_date: d(0),
    last_handled_date: d(-7),
  })
  ev(s1, -40, '递交 UQ 和 Monash 的申请', 'school', true)
  ev(s1, -12, 'UQ：已递交 → Con offer（条件：补 official 成绩单）', 'school', true)
  ev(s1, -9, 'Monash：已递交 → Uncon offer', 'school', true)
  ev(s1, -7, '和学生电话沟通，倾向 UQ，家长想再比较一下', 'note')
  app(s1, { school: 'UQ', program: 'Master of IT', status: 'Con offer', offer_ddl: d(2), condition_text: '补 official 成绩单', condition_ddl: d(10), last_reminded_on: d(-7) })
  app(s1, { school: 'Monash', program: 'Master of IT', status: 'Uncon offer', offer_ddl: d(12) })
  task(s1, '跟家长确认选 UQ 还是 Monash', 0)

  // 2. offer DDL 待确认 + 球在学生很久
  const s2 = student({ name: '示例·李华', assignee: 'team 2', business_type: '学校申请类', ball: '学生', next_follow_date: d(3), last_handled_date: d(-11) })
  ev(s2, -30, '递交 UNSW 申请', 'school', true)
  ev(s2, -11, 'UNSW con offer 已下，DDL 还没看到，让学生把 offer 邮件转给我', 'school', true)
  app(s2, { school: 'UNSW', program: 'Master of Commerce', status: 'Con offer', offer_ddl_tbc: true, tbc_remind_on: d(0) })

  // 3. 签证递交了，等下签，跟进已过期
  const s3 = student({ name: '示例·张伟', business_type: '签证申请类', ball: '签证局', next_follow_date: d(-3), last_handled_date: d(-17) })
  ev(s3, -25, '500 签证：✓ 材料齐全', 'visa')
  ev(s3, -20, '500 签证：✓ 已付款', 'visa', true)
  ev(s3, -17, '500 签证：✓ 已递交', 'visa', true)
  visas.push({ id: newId(), student_id: s3.id, visa_type: '500', materials_on: d(-25), paid_on: d(-20), submitted_on: d(-17), medical_on: null, granted_on: null, expiry_date: d(52), expiry_ack_on: null, note: '', created_at: ts(d(-25)), updated_at: ts(d(-17)) })
  task(s3, '提醒学生去做体检', -2)
  payments.push({ id: newId(), student_id: s3.id, item: '签证服务费', amount: 1500, currency: 'AUD', paid_on: d(-20), note: '', created_at: ts(d(-20)), updated_at: ts(d(-20)) })
  ev(s3, -20, '收费：签证服务费 AUD 1,500', 'payment', true)

  // 4. 休眠今天结束
  const s4 = student({ name: '示例·陈静', assignee: 'tingting', dormant_until: d(0), dormant_reason: 'CoE 已出，等 1 月开始办学签', next_follow_date: d(-40), last_handled_date: d(-60) })
  ev(s4, -60, 'Macquarie：已接受 → CoE已出', 'school', true)
  ev(s4, -60, '💤 设为休眠（CoE 已出，等 1 月开始办学签）', 'status')
  app(s4, { school: 'Macquarie', program: 'Master of Accounting', status: 'CoE已出' })

  // 5. 485 签证 + 逾期待办 + 签证快到期
  const s5 = student({ name: '示例·刘洋', business_type: '签证申请类', ball: '学生', assignee: 'team 2', next_follow_date: d(5) })
  ev(s5, -8, '学生毕业了，准备申请 485', 'note')
  ev(s5, -6, '让学生办 AFP 无犯罪证明', 'note')
  kd(s5, '签证到期', 25, '当前学签')
  task(s5, '催学生交 AFP 无犯罪证明', -1, 'Maggie')
  visas.push({ id: newId(), student_id: s5.id, visa_type: '485', materials_on: null, paid_on: null, submitted_on: null, medical_on: null, granted_on: null, expiry_date: null, expiry_ack_on: null, note: '', created_at: ts(d(-8)), updated_at: ts(d(-8)) })

  // 6. 已完成
  const s6 = student({ name: '示例·赵敏', status: '已完成', assignee: 'team 1', next_follow_date: null })
  ev(s6, -120, '500 签证：✓ 已获批', 'visa', true)
  ev(s6, -118, '状态：进行中 → 已完成', 'status', true)

  // 7. 暂停
  const s7 = student({ name: '示例·孙丽', status: '暂停不跟进', next_follow_date: null })
  ev(s7, -80, '学生说明年再考虑', 'note')

  // 8. 未开始
  const s8 = student({ name: '示例·周杰', status: '未开始', assignee: null, referrer: '示例·王小明', next_follow_date: d(1), last_handled_date: d(-13) })
  ev(s8, -13, '王小明介绍来的，想读幼教', 'note')
  task(s8, '约学生线上开会，了解背景', 1)

  // 9. 休眠中
  const s9 = student({ name: '示例·吴芳', dormant_until: d(40), dormant_reason: '在国内实习，12 月再联系', next_follow_date: d(-5) })
  ev(s9, -20, '学生在国内实习，12 月再联系', 'note')

  // 10. offer DDL 已过，还没接受
  const s10 = student({ name: '示例·郑凯', ball: '学生', next_follow_date: d(2), last_handled_date: d(-5) })
  ev(s10, -15, 'Adelaide：已递交 → Con offer', 'school', true)
  ev(s10, -5, '已提醒学生 Adelaide offer DDL', 'reminded')
  app(s10, { school: 'Adelaide', program: 'Master of Data Science', status: 'Con offer', offer_ddl: d(-2), last_reminded_on: d(-5) })

  // 11. 已接受，等付款 + 开学
  const s11 = student({ name: '示例·黄蕾', assignee: 'tingting', ball: '学校', follow_cycle_days: 30, next_follow_date: d(20), last_handled_date: d(-10) })
  ev(s11, -10, 'USYD：Uncon offer → 已接受', 'school', true)
  app(s11, { school: 'USYD', program: 'Master of Education', status: '已接受', payment_ddl: d(5) })
  kd(s11, 'Orientation', 5, '线上')
  kd(s11, '开学', 12)

  return { students, applications, visas, key_dates, tasks, payments, events, review_items: [] }
}
