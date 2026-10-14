import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { addDays, todayStr } from '../src/lib/dates'
import { computeStudentInfos } from '../src/lib/reminders'
import type { DBState } from '../src/lib/types'
import { emptyDB, type Adapter, type Op } from '../src/data/adapter'
import { initData, useStore } from '../src/data/store'
import {
  addApplication,
  addNote,
  changeAppStatus,
  checkStudent,
  completeTask,
  addTask,
  createStudent,
  editEvent,
  remindApp,
  setCycle,
  setDormant,
  setOfferDdl,
  setStudentStatus,
  toggleVisaStep,
  addVisa,
} from '../src/data/actions'

const ops: Op[] = []
const memAdapter: Adapter = {
  kind: 'local',
  async loadAll() {
    return emptyDB({ ...DEFAULT_SETTINGS })
  },
  async apply(op) {
    ops.push(op)
  },
}

const today = todayStr()
const S = () => useStore.getState()
const eventsOf = (id: string) => S().events.filter((e) => e.student_id === id)

beforeEach(async () => {
  ops.length = 0
  await initData(memAdapter, null)
  useStore.setState({ today })
})

describe('notes and follow-up cycle', () => {
  it('records a note with today as date and recomputes next follow-up', () => {
    const s = createStudent({ name: '甲', follow_cycle_days: 14 })
    addNote(s.id, '打电话了')
    const ev = eventsOf(s.id)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ kind: 'note', occurred_on: today, content: '打电话了', recorder: '我' })
    const st = S().students[0]
    expect(st.last_handled_date).toBe(today)
    expect(st.next_follow_date).toBe(addDays(today, 14))
  })
  it('uses the reminder date when one is set', () => {
    const s = createStudent({ name: '乙' })
    addNote(s.id, '等学生回复', { remindOn: addDays(today, 3) })
    expect(S().students[0].next_follow_date).toBe(addDays(today, 3))
  })
  it('backfilled notes do not move last handled date backwards', () => {
    const s = createStudent({ name: '丙' })
    addNote(s.id, '今天')
    addNote(s.id, '前几天的事', { occurred_on: addDays(today, -5) })
    expect(S().students[0].last_handled_date).toBe(today)
    expect(S().students[0].next_follow_date).toBe(addDays(today, 14))
  })
  it('check only refreshes last check date and does not count as an update', () => {
    const s = createStudent({ name: '丁' })
    checkStudent(s.id)
    const st = S().students[0]
    expect(st.last_checked_date).toBe(today)
    const info = computeStudentInfos(S() as DBState, today)[0]
    expect(info.lastUpdate).toBeNull()
    expect(info.handledToday).toBe(true)
  })
  it('changing the cycle recomputes next follow-up from last handled date', () => {
    const s = createStudent({ name: '戊' })
    addNote(s.id, 'x')
    setCycle(s.id, 30)
    expect(S().students[0].next_follow_date).toBe(addDays(today, 30))
  })
})

describe('status changes are logged as milestones', () => {
  it('logs student status change', () => {
    const s = createStudent({ name: '己' })
    setStudentStatus(s.id, '已完成')
    const ev = eventsOf(s.id)[0]
    expect(ev).toMatchObject({ kind: 'status', content: '状态：进行中 → 已完成', milestone: true })
  })
})

describe('applications and offer DDL', () => {
  it('logs status changes and handles TBC DDL', () => {
    const s = createStudent({ name: '庚' })
    const a = addApplication(s.id, { school: 'UQ', status: '已递交' })
    changeAppStatus(a.id, 'Con offer', { offer_ddl_tbc: true })
    let app = S().applications[0]
    expect(app).toMatchObject({ offer_ddl_tbc: true, tbc_remind_on: addDays(today, 3) })
    expect(eventsOf(s.id).map((e) => e.content)).toContain('UQ：已递交 → Con offer（接 offer DDL 待确认）')
    setOfferDdl(a.id, addDays(today, 7))
    app = S().applications[0]
    expect(app).toMatchObject({ offer_ddl: addDays(today, 7), offer_ddl_tbc: false })
    remindApp(a.id)
    const last = eventsOf(s.id).at(-1)!
    expect(last.kind).toBe('reminded')
    expect(last.content).toMatch(/^已提醒学生 UQ offer DDL（\d\d\/\d\d\/\d{4}，剩 7 天）$/)
    expect(S().applications[0].last_reminded_on).toBe(today)
    // 接受后 offer 提醒停止
    changeAppStatus(a.id, '已接受')
    const info = computeStudentInfos(S() as DBState, today)[0]
    expect(info.deadlines.filter((d) => d.kind === 'offer')).toHaveLength(0)
  })
  it('logs DDL extension', () => {
    const s = createStudent({ name: '辛' })
    const a = addApplication(s.id, { school: 'Monash', status: 'Uncon offer', offer_ddl: addDays(today, -2) })
    setOfferDdl(a.id, addDays(today, 10))
    expect(eventsOf(s.id).at(-1)!.content).toMatch(/^Monash offer DDL 延期：/)
  })
})

describe('visa steps, tasks and editing', () => {
  it('ticks visa steps with dates and milestones', () => {
    const s = createStudent({ name: '壬' })
    const v = addVisa(s.id, { visa_type: '500' })
    toggleVisaStep(v.id, 'submitted_on')
    expect(S().visas[0].submitted_on).toBe(today)
    expect(eventsOf(s.id).at(-1)).toMatchObject({ kind: 'visa', content: '500 签证：✓ 已递交', milestone: true })
  })
  it('completing a task writes to the timeline', () => {
    const s = createStudent({ name: '癸' })
    const t = addTask(s.id, { content: '交成绩单', handler: 'Maggie' })
    completeTask(t.id)
    expect(eventsOf(s.id).at(-1)).toMatchObject({ kind: 'task', content: '完成待办：交成绩单（Maggie）' })
  })
  it('editing keeps the original text', () => {
    const s = createStudent({ name: '子' })
    addNote(s.id, '原来的话')
    const id = eventsOf(s.id)[0].id
    const created = eventsOf(s.id)[0].created_at
    editEvent(id, { content: '改过的话' })
    const ev = eventsOf(s.id)[0]
    expect(ev.content).toBe('改过的话')
    expect(ev.edit_history[0].content).toBe('原来的话')
    expect(ev.edited_at).not.toBeNull()
    expect(ev.created_at).toBe(created)
  })
})

describe('dormancy', () => {
  it('ends automatically when the student is handled after the dormancy date', () => {
    const s = createStudent({ name: '丑' })
    setDormant(s.id, addDays(today, 30), 'CoE 已出')
    expect(computeStudentInfos(S() as DBState, today)[0].group).toBe('dormant')
    // 模拟时间过去
    useStore.setState({ today: addDays(today, 30) })
    addNote(s.id, '联系学生办签证')
    const st = S().students[0]
    expect(st.dormant_until).toBeNull()
    expect(eventsOf(s.id).some((e) => e.content.includes('休眠结束') && e.content.includes('CoE 已出'))).toBe(true)
  })
})

describe('review fixes', () => {
  it('reminding the student about a TBC offer pushes the TBC reminder 3 days out', () => {
    const s = createStudent({ name: '卯' })
    const a = addApplication(s.id, { school: 'UQ', status: 'Con offer', offer_ddl_tbc: true })
    useStore.setState({ today: addDays(today, 3) })
    remindApp(a.id)
    expect(S().applications.find((x) => x.id === a.id)!.tbc_remind_on).toBe(addDays(today, 6))
  })
  it('a future last handled date is replaced when the student is handled', () => {
    const s = createStudent({ name: '辰', last_handled_date: addDays(today, 60), next_follow_date: addDays(today, 74) })
    checkStudent(s.id)
    const st = S().students.find((x) => x.id === s.id)!
    expect(st.last_handled_date).toBe(today)
    expect(st.next_follow_date).toBe(addDays(today, 14))
  })
})

describe('persistence', () => {
  it('sends every change to the adapter', async () => {
    const s = createStudent({ name: '寅' })
    addNote(s.id, 'x')
    await new Promise((r) => setTimeout(r, 10))
    expect(ops.map((o) => o.op)).toEqual(['insert', 'insert', 'update'])
  })
})
