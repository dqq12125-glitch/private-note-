import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { addDays } from '../src/lib/dates'
import { compareCards, computeCard, headlineOf, laneOf, pillTone, visaTrack, avatarText } from '../src/lib/cardInfo'
import { computeStudentInfos } from '../src/lib/reminders'
import type { DBState } from '../src/lib/types'
import { buildDemo } from '../src/data/demo'

const today = '2026-10-15'
let n = 0
const demo = buildDemo(today, () => `id-${++n}`)
const db: DBState = { ...demo, settings: DEFAULT_SETTINGS }
const infos = computeStudentInfos(db, today)
const cards = infos.map((info) => ({ info, card: computeCard(info, today) }))
const byName = (name: string) => cards.find((c) => c.info.s.name === `示例·${name}`)!

describe('sample students: lanes and colour bars', () => {
  it('puts each sample student in the right group', () => {
    const lanes = Object.fromEntries(cards.map((c) => [c.info.s.name.replace('示例·', ''), c.card.lane]))
    expect(lanes).toEqual({
      王小明: 'mine', // 球在我们
      李华: 'waiting', // 球在学生
      张伟: 'mine', // 跟进到期 + 逾期待办
      陈静: 'mine', // 休眠今天结束 = 跟进到期
      刘洋: 'mine', // 逾期待办
      赵敏: 'closed',
      孙丽: 'closed',
      周杰: 'mine', // 未开始，球在我们
      吴芳: 'dormant',
      郑凯: 'waiting', // 球在学生（offer DDL 已过，组内排最前）
      黄蕾: 'waiting', // 球在学校
    })
  })
  it('colours the bar by who acts next', () => {
    expect(byName('王小明').card.bar).toBe('red') // offer DDL 2 天内
    expect(byName('刘洋').card.bar).toBe('red') // 逾期待办
    expect(byName('周杰').card.bar).toBe('orange')
    expect(byName('陈静').card.bar).toBe('orange')
    expect(byName('李华').card.bar).toBe('blue')
    expect(byName('郑凯').card.bar).toBe('blue')
    expect(byName('吴芳').card.bar).toBe('gray')
    expect(byName('赵敏').card.bar).toBe('green')
    expect(byName('孙丽').card.bar).toBe('muted')
  })
  it('orders each group by urgency', () => {
    const order = (lane: string) =>
      cards
        .filter((c) => c.card.lane === lane)
        .sort(compareCards)
        .map((c) => c.info.s.name.replace('示例·', ''))
    // 逾期在前（刘洋签证到期 25 天比张伟 52 天近），然后 DDL 近的，然后跟进超期久的
    expect(order('mine')).toEqual(['刘洋', '张伟', '王小明', '陈静', '周杰'])
    expect(order('waiting')).toEqual(['郑凯', '黄蕾', '李华'])
    expect(order('closed')).toEqual(['赵敏', '孙丽'])
  })
})

describe('sample students: countdown badges', () => {
  it('shows the nearest deadline with the right colour', () => {
    expect(byName('王小明').card.deadline).toMatchObject({ text: 'UQ 接 offer DDL · 剩 2 天', tone: 'red' })
    expect(byName('郑凯').card.deadline).toMatchObject({ text: 'Adelaide 接 offer DDL · 已过 2 天', tone: 'red' })
    expect(byName('黄蕾').card.deadline).toMatchObject({ text: 'USYD 付款截止 · 剩 5 天', tone: 'orange' })
    expect(byName('刘洋').card.deadline).toMatchObject({ text: '签证到期 · 剩 25 天', tone: 'neutral' })
    expect(byName('周杰').card.deadline).toBeNull()
  })
  it('flags TBC offers and overdue tasks', () => {
    expect(byName('李华').card.tbcCount).toBe(1)
    expect(byName('张伟').card.overdueTasks).toBe(1)
    expect(byName('刘洋').card.overdueTasks).toBe(1)
    expect(byName('王小明').card.overdueTasks).toBe(0)
  })
})

describe('headline sentence', () => {
  it('uses the first open task, then application/visa progress, then status', () => {
    expect(byName('刘洋').card.headline).toBe('催学生交 AFP 无犯罪证明')
    expect(byName('李华').card.headline).toBe('有 offer 等学生决定（UNSW）')
    expect(byName('黄蕾').card.headline).toBe('已接受 USYD offer，等付押金/学费')
    expect(byName('陈静').card.headline).toBe('Macquarie CoE 已出')
    expect(byName('赵敏').card.headline).toBe('已完成')
    expect(byName('吴芳').card.headline).toBe('休眠中，暂时不用跟进')
  })
  it('describes visa progress', () => {
    const i = byName('张伟').info
    const noTask = { ...i, nextTask: null, openTasks: [] }
    expect(headlineOf(noTask, today).text).toBe('500 签证已递交，等下签')
  })
})

describe('pills, visa steps and avatars', () => {
  it('colours application pills by status', () => {
    expect(pillTone('未递交').tone).toBe('gray')
    expect(pillTone('已递交').tone).toBe('blue')
    expect(pillTone('Con offer').tone).toBe('yellow')
    expect(pillTone('Uncon offer').tone).toBe('green')
    expect(pillTone('已接受').tone).toBe('green')
    expect(pillTone('被拒')).toEqual({ tone: 'red', struck: true })
    expect(pillTone('放弃')).toEqual({ tone: 'red', struck: true })
  })
  it('marks done visa steps and the current one', () => {
    const t = visaTrack(byName('张伟').info.visas[0])
    expect(t.steps.map((s) => [s.done, s.current])).toEqual([
      [true, false],
      [true, false],
      [true, false],
      [false, true],
      [false, false],
    ])
  })
  it('shows short avatar text', () => {
    expect(avatarText('team 1')).toBe('T1')
    expect(avatarText('tingting')).toBe('T')
    expect(avatarText(null)).toBe('?')
  })
  it('keeps the follow-up lane rule for a student whose follow-up is due', () => {
    const i = byName('李华').info
    expect(laneOf({ ...i, followDue: true }, today)).toBe('mine')
    expect(addDays(today, 0)).toBe(today)
  })
})
