import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import {
  appDeadlines,
  computeStudentInfos,
  isReminderDue,
  offerCountdown,
  recordStreak,
  stageFor,
  taskBucket,
  todayQueue,
} from '../src/lib/reminders'
import type { Application, DBState, Student, TimelineEvent } from '../src/lib/types'

const today = '2026-10-14'

function student(p: Partial<Student> = {}): Student {
  return {
    id: 's1',
    name: '测试',
    english_name: null,
    assignee: null,
    business_type: '学校申请类',
    status: '进行中',
    ball: '我们',
    priority: '普通',
    background: '',
    referrer: null,
    contact: null,
    follow_cycle_days: 14,
    next_follow_date: '2026-10-20',
    last_handled_date: '2026-10-06',
    last_checked_date: null,
    dormant_until: null,
    dormant_reason: null,
    import_meta: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...p,
  }
}

function app(p: Partial<Application> = {}): Application {
  return {
    id: 'a1',
    student_id: 's1',
    school: 'UQ',
    program: 'Master of IT',
    intake: '2027 S1',
    status: 'Con offer',
    note: '',
    offer_ddl: '2026-10-21',
    offer_ddl_tbc: false,
    tbc_remind_on: null,
    payment_ddl: null,
    payment_done_on: null,
    condition_text: '',
    condition_ddl: null,
    condition_done_on: null,
    last_reminded_on: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...p,
  }
}

function ev(p: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: Math.random().toString(),
    student_id: 's1',
    kind: 'note',
    occurred_on: '2026-10-06',
    date_unknown: false,
    content: 'x',
    recorder: '我',
    milestone: false,
    edit_history: [],
    edited_at: null,
    source: null,
    created_at: '2026-10-06T01:00:00.000Z',
    ...p,
  }
}

function db(p: Partial<DBState>): DBState {
  return {
    students: [],
    applications: [],
    visas: [],
    key_dates: [],
    tasks: [],
    payments: [],
    events: [],
    review_items: [],
    settings: DEFAULT_SETTINGS,
    ...p,
  }
}

describe('reminder stages', () => {
  it('computes the current stage', () => {
    expect(stageFor(20, [14, 7, 3, 1, 0])).toBeNull()
    expect(stageFor(14, [14, 7, 3, 1, 0])).toBe(14)
    expect(stageFor(5, [14, 7, 3, 1, 0])).toBe(7)
    expect(stageFor(0, [14, 7, 3, 1, 0])).toBe(0)
    expect(stageFor(-3, [14, 7, 3, 1, 0])).toBe(0)
  })
  it('is cleared by a reminder after the stage started', () => {
    // DDL 21/10，今天 14/10 → 剩 7 天，7 天节点从 14/10 开始
    expect(isReminderDue('2026-10-21', 7, [14, 7, 3, 1, 0], null)).toBe(true)
    expect(isReminderDue('2026-10-21', 7, [14, 7, 3, 1, 0], '2026-10-10')).toBe(true)
    expect(isReminderDue('2026-10-21', 7, [14, 7, 3, 1, 0], '2026-10-14')).toBe(false)
  })
})

describe('appDeadlines', () => {
  it('stops offer reminders once accepted', () => {
    expect(appDeadlines(app(), today).map((d) => d.kind)).toEqual(['offer'])
    expect(appDeadlines(app({ status: '已接受' }), today)).toEqual([])
    expect(appDeadlines(app({ status: '放弃' }), today)).toEqual([])
  })
  it('keeps payment deadline after acceptance', () => {
    const d = appDeadlines(app({ status: '已接受', payment_ddl: '2026-10-16' }), today)
    expect(d.map((x) => x.kind)).toEqual(['payment'])
    expect(d[0].reminderDue).toBe(true)
  })
  it('reports TBC offers every 3 days', () => {
    const tbc = app({ offer_ddl: null, offer_ddl_tbc: true, tbc_remind_on: '2026-10-15' })
    expect(appDeadlines(tbc, today)[0]).toMatchObject({ kind: 'offer_tbc', reminderDue: false })
    expect(appDeadlines({ ...tbc, tbc_remind_on: '2026-10-14' }, today)[0].reminderDue).toBe(true)
  })
})

describe('computeStudentInfos', () => {
  it('puts offer DDL within 3 days into 🔥', () => {
    const infos = computeStudentInfos(
      db({ students: [student()], applications: [app({ offer_ddl: '2026-10-16' })] }),
      today,
    )
    expect(infos[0].group).toBe('urgent')
    expect(infos[0].inspectReasons[0].kind).toBe('offer')
  })
  it('groups by status, ball and dormancy', () => {
    const g = (p: Partial<Student>) => computeStudentInfos(db({ students: [student(p)] }), today)[0].group
    expect(g({})).toBe('ours')
    expect(g({ ball: '学校' })).toBe('waiting')
    expect(g({ status: '未开始' })).toBe('notStarted')
    expect(g({ dormant_until: '2026-12-01' })).toBe('dormant')
    expect(g({ status: '已完成' })).toBe('done')
    expect(g({ status: '暂停不跟进' })).toBe('paused')
  })
  it('colours staleness by the follow cycle', () => {
    const st = (occurred: string) =>
      computeStudentInfos(db({ students: [student()], events: [ev({ occurred_on: occurred })] }), today)[0].stale
    expect(st('2026-10-01')).toBe('ok')
    expect(st('2026-09-25')).toBe('warn')
    expect(st('2026-09-01')).toBe('bad')
  })
  it('ignores "checked" events for last update', () => {
    const i = computeStudentInfos(
      db({
        students: [student()],
        events: [ev({ occurred_on: '2026-09-01' }), ev({ kind: 'checked', occurred_on: '2026-10-13' })],
      }),
      today,
    )[0]
    expect(i.lastUpdate).toBe('2026-09-01')
  })
  it('flags follow-up due, dormancy end and ball-with-student', () => {
    const infos = computeStudentInfos(
      db({
        students: [
          student({ id: 'a', next_follow_date: '2026-10-14' }),
          student({ id: 'b', dormant_until: '2026-10-14', dormant_reason: '等 CoE' }),
          student({ id: 'c', ball: '学生' }),
        ],
        events: [ev({ student_id: 'c', occurred_on: '2026-10-01' })],
      }),
      today,
    )
    expect(infos[0].inspectReasons.map((r) => r.kind)).toEqual(['follow'])
    expect(infos[1].inspectReasons.map((r) => r.kind)).toContain('dormant_end')
    expect(infos[2].inspectReasons.map((r) => r.kind)).toContain('ball_student')
    const q = todayQueue(infos)
    expect(q.pending.map((i) => i.s.id).sort()).toEqual(['a', 'b', 'c'])
  })
  it('lists offers in the countdown sorted by days left', () => {
    const infos = computeStudentInfos(
      db({
        students: [student()],
        applications: [
          app({ id: 'x', offer_ddl: '2026-11-20' }),
          app({ id: 'y', offer_ddl: '2026-10-15' }),
          app({ id: 'z', status: '已接受' }),
        ],
      }),
      today,
    )
    expect(offerCountdown(infos).map((d) => d.ref.id)).toEqual(['y', 'x'])
  })
})

describe('recordStreak', () => {
  it('counts consecutive days and skips weekends', () => {
    // 14/10/2026 是周三
    const events = ['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-09'].map((d) =>
      ev({ created_at: `${d}T02:00:00.000Z` }),
    )
    expect(recordStreak(events, today)).toEqual({ streak: 4, recordedToday: true })
    expect(recordStreak(events.slice(1), today)).toEqual({ streak: 3, recordedToday: false })
  })
})

describe('taskBucket', () => {
  it('groups by time', () => {
    const we = '2026-10-18'
    expect(taskBucket('2026-10-13', today, we)).toBe('overdue')
    expect(taskBucket('2026-10-14', today, we)).toBe('today')
    expect(taskBucket('2026-10-15', today, we)).toBe('tomorrow')
    expect(taskBucket('2026-10-17', today, we)).toBe('week')
    expect(taskBucket('2026-10-20', today, we)).toBe('later')
    expect(taskBucket(null, today, we)).toBe('nodate')
  })
})
