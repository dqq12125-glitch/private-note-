// 导出全部数据：Excel（每类数据一个工作表）和 JSON（完整备份，可以再导入恢复）
import { fmtDate, fmtDateTime, todayStr } from './dates'
import { saveFile } from './platform'
import type { DBState } from './types'

export async function exportJson(db: DBState) {
  const data = { app: 'student-tracker', version: 1, exported_at: new Date().toISOString(), ...db }
  await saveFile(`学生跟进备份_${fmtDate(todayStr()).replace(/\//g, '-')}.json`, JSON.stringify(data, null, 2))
}

type Cell = string | number | null
type Sheet = { sheet: string; data: Cell[][]; columns?: { width: number }[]; stickyRowsCount?: number }

export async function exportExcel(db: DBState) {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const name = new Map(db.students.map((s) => [s.id, s.name]))
  const n = (id: string) => name.get(id) ?? ''
  const d = (x: string | null | undefined) => (x ? fmtDate(x) : '')
  const sheets: Sheet[] = [
    {
      sheet: '学生',
      data: [
        ['姓名', '英文名', '负责人', '业务类型', '状态', '球在谁那', '优先级', '跟进周期(天)', '下次跟进', '最后处理', '最后检查', '休眠到', '休眠原因', '推荐人', '联系人', '背景备注'],
        ...db.students.map((s) => [
          s.name, s.english_name, s.assignee ?? '未分配', s.business_type, s.status, s.ball, s.priority, s.follow_cycle_days,
          d(s.next_follow_date), d(s.last_handled_date), d(s.last_checked_date), d(s.dormant_until), s.dormant_reason, s.referrer, s.contact, s.background,
        ]),
      ],
      columns: [{ width: 12 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 6 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 10 }, { width: 20 }, { width: 60 }],
    },
    {
      sheet: '申请学校',
      data: [
        ['学生', '学校', '专业', '入学', '状态', '接offer DDL', 'DDL待确认', '付款截止', '已付', '条件', '补材料截止', '已补', '上次提醒学生', '备注'],
        ...db.applications.map((a) => [
          n(a.student_id), a.school, a.program, a.intake, a.status, d(a.offer_ddl), a.offer_ddl_tbc ? '是' : '', d(a.payment_ddl), d(a.payment_done_on),
          a.condition_text, d(a.condition_ddl), d(a.condition_done_on), d(a.last_reminded_on), a.note,
        ]),
      ],
    },
    {
      sheet: '签证',
      data: [
        ['学生', '类型', '材料齐全', '已付款', '已递交', '体检完成', '已获批', '当前签证到期', '备注'],
        ...db.visas.map((v) => [n(v.student_id), v.visa_type, d(v.materials_on), d(v.paid_on), d(v.submitted_on), d(v.medical_on), d(v.granted_on), d(v.expiry_date), v.note]),
      ],
    },
    {
      sheet: '关键日期',
      data: [['学生', '类型', '日期', '说明'], ...db.key_dates.map((k) => [n(k.student_id), k.kind, d(k.date), k.note])],
    },
    {
      sheet: '待办',
      data: [['学生', '内容', '截止日', '交给谁', '完成日期'], ...db.tasks.map((t) => [n(t.student_id), t.content, d(t.due_date), t.handler, d(t.done_on)])],
    },
    {
      sheet: '收费',
      data: [['学生', '项目', '金额', '币种', '付款日期', '备注'], ...db.payments.map((p) => [n(p.student_id), p.item, p.amount, p.currency, d(p.paid_on), p.note])],
    },
    {
      sheet: '时间线',
      data: [
        ['学生', '发生日期', '日期不明', '类型', '内容', '里程碑', '记录人', '录入时间', '已编辑', '原文'],
        ...[...db.events]
          .sort((a, b) => (a.student_id === b.student_id ? (a.occurred_on < b.occurred_on ? -1 : 1) : n(a.student_id).localeCompare(n(b.student_id), 'zh-CN')))
          .map((e) => [
            n(e.student_id), d(e.occurred_on), e.date_unknown ? '是' : '', e.kind, e.content, e.milestone ? '★' : '', e.recorder,
            fmtDateTime(e.created_at), e.edited_at ? fmtDateTime(e.edited_at) : '', e.edit_history[0]?.content ?? '',
          ]),
      ],
      columns: [{ width: 12 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 70 }, { width: 6 }, { width: 8 }, { width: 18 }, { width: 18 }, { width: 40 }],
    },
  ]
  for (const s of sheets) s.stickyRowsCount = 1
  const blob = await writeExcelFile(sheets as any).toBlob()
  await saveFile(`学生跟进导出_${fmtDate(todayStr()).replace(/\//g, '-')}.xlsx`, blob)
}
