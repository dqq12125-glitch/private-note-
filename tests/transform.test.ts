import { describe, expect, it } from 'vitest'
import {
  buildImportPlan,
  cleanName,
  extractRows,
  mapBusiness,
  mapStatus,
  normalizeAssignee,
} from '../src/importer/transform'

describe('cleanName', () => {
  it('removes status words', () => {
    expect(cleanName('王嘉韫（完成）')).toMatchObject({ name: '王嘉韫', flagDone: true, extras: [] })
    expect(cleanName('李四(更新过)')).toMatchObject({ name: '李四', flagDone: false, removed: ['更新过'] })
    expect(cleanName('张三（不用管了）')).toMatchObject({ name: '张三', flagIgnore: true })
  })
  it('moves other bracket content to extras', () => {
    expect(cleanName('杨心言（年底毕业）')).toMatchObject({ name: '杨心言', extras: ['年底毕业'] })
    expect(cleanName('郭晨（郭晨npy）')).toMatchObject({ name: '郭晨', extras: ['郭晨npy'] })
    expect(cleanName('刘五（完成，tingting手机）')).toMatchObject({
      name: '刘五',
      flagDone: true,
      extras: ['tingting手机'],
    })
  })
  it('splits english names', () => {
    expect(cleanName('王小明 Jenny')).toMatchObject({ name: '王小明', english: 'Jenny' })
  })
})

describe('field mapping', () => {
  it('normalizes assignee', () => {
    expect(normalizeAssignee('team2')).toBe('team 2')
    expect(normalizeAssignee('Team 1')).toBe('team 1')
    expect(normalizeAssignee(' ')).toBeNull()
    expect(normalizeAssignee('tingting')).toBe('tingting')
  })
  it('maps status', () => {
    expect(mapStatus('进行中', true)).toBe('进行中')
    expect(mapStatus('已完成', true)).toBe('已完成')
    expect(mapStatus('暂停', true)).toBe('暂停不跟进')
    expect(mapStatus('', false)).toBe('未开始')
  })
  it('maps business type', () => {
    expect(mapBusiness('学校+签证')).toBe('学校+签证申请')
    expect(mapBusiness('学校申请')).toBe('学校申请类')
    expect(mapBusiness('签证')).toBe('签证申请类')
    expect(mapBusiness('485签证')).toBe('签证申请类')
    expect(mapBusiness('转学')).toBe('学校申请类')
    expect(mapBusiness('')).toBe('其他')
  })
})

describe('buildImportPlan', () => {
  const data = [
    ['学生姓名', '负责手机', '状态', '业务分类', '客户背景/备注', '完整详情/历史进度', '最新更新日', '天数', '任务优先级'],
    [
      '王嘉韫（完成）',
      'team2',
      '进行中',
      '学校+签证',
      '学签2月左右到期',
      '09/07/2026 递交UQ申请\n20/08/26 UQ con offer，10.30号补成绩单\n学生说考雅思',
      '20/08/2026',
      '5',
      '高',
    ],
    ['张贺鑫', '', '进行中', '学校申请', '11.12号Orientation', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
  ]
  let n = 0
  const plan = buildImportPlan(extractRows(data)!.rows, {
    today: '2026-10-14',
    now: '2026-10-14T00:00:00.000Z',
    newId: () => `id${++n}`,
    existing: new Map([['张贺鑫', 'old']]),
  })

  it('creates students with cleaned fields', () => {
    expect(plan.students).toHaveLength(2)
    const s = plan.students[0].student
    expect(s).toMatchObject({
      name: '王嘉韫',
      assignee: 'team 2',
      status: '进行中',
      business_type: '学校+签证申请',
      priority: '高',
      last_handled_date: '2026-08-20',
      next_follow_date: '2026-09-03',
    })
    expect(plan.students[1].student.assignee).toBeNull()
    expect(plan.assignees).toEqual(['team 2'])
  })
  it('splits history into events with unknown dates', () => {
    const ev = plan.students[0].events
    expect(ev).toHaveLength(3)
    expect(ev[2]).toMatchObject({ date_unknown: true, occurred_on: '2026-08-20', source: 'import' })
    expect(ev[1].milestone).toBe(true)
  })
  it('creates review items', () => {
    const kinds = plan.students[0].reviews.map((r) => r.kind).sort()
    expect(kinds).toEqual(['date_mention', 'date_mention', 'offer_mention', 'status_conflict'])
    const orient = plan.students[1].reviews.find((r) => r.kind === 'date_mention')
    expect(orient?.suggestion).toMatchObject({ date: '2026-11-12', keydate_kind: 'Orientation' })
  })
  it('flags duplicates', () => {
    expect(plan.students[1].duplicateOf).toBe('old')
  })
})

describe('import edge cases', () => {
  it('treats negated status as in progress', () => {
    expect(mapStatus('未完成', true)).toBe('进行中')
    expect(mapStatus('还没完成', true)).toBe('进行中')
  })
  it('never sets last handled date in the future', () => {
    const rows = extractRows([
      ['学生姓名', '状态', '完整详情/历史进度'],
      ['甲', '进行中', '09/07/2026 递交\n20/12/2026 交材料'],
    ])!.rows
    let n = 0
    const p = buildImportPlan(rows, { today: '2026-10-14', now: '2026-10-14T00:00:00Z', newId: () => `x${++n}`, existing: new Map() })
    expect(p.students[0].student.last_handled_date).toBe('2026-07-09')
    expect(p.students[0].student.next_follow_date).toBe('2026-07-23')
  })
})
