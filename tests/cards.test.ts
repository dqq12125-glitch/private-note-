import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { addDays } from '../src/lib/dates'
import { compareCards, computeCard, headlineOf, laneOf, pillTone, visaTrack, avatarText } from '../src/lib/cardInfo'
import { computeStudentInfos } from '../src/lib/reminders'
import type { DBState, KeyDate, Visa } from '../src/lib/types'
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

// ───────── 代码审查后补的回归测试 ─────────

/** 在示例数据上改一点东西，重新算某个学生的卡片 */
function cardWith(name: string, change: (d: DBState, sid: string) => void) {
  const d: DBState = structuredClone(db)
  const sid = d.students.find((s) => s.name === `示例·${name}`)!.id
  change(d, sid)
  const info = computeStudentInfos(d, today).find((i) => i.s.id === sid)!
  return { info, card: computeCard(info, today) }
}
const stamp = `${today}T00:00:00.000Z`
const visa = (sid: string, id: string, over: Partial<Visa>): Visa => ({
  id,
  student_id: sid,
  visa_type: '500',
  materials_on: null,
  paid_on: null,
  submitted_on: null,
  medical_on: null,
  granted_on: null,
  expiry_date: null,
  expiry_ack_on: null,
  note: '',
  created_at: stamp,
  updated_at: stamp,
  ...over,
})
const keydate = (sid: string, id: string, kind: KeyDate['kind'], date: string): KeyDate => ({
  id,
  student_id: sid,
  kind,
  date,
  note: '',
  ack_on: null,
  created_at: stamp,
  updated_at: stamp,
})

describe('review fixes', () => {
  it('shows the visa in progress first, not an old granted one', () => {
    const { card } = cardWith('周杰', (d, sid) => {
      d.visas.push(visa(sid, 'old', { visa_type: '500', granted_on: '2024-01-10', updated_at: '2024-01-10T00:00:00.000Z' }))
      d.visas.push(visa(sid, 'new', { visa_type: '485', materials_on: '2026-10-01', updated_at: '2026-10-01T00:00:00.000Z' }))
    })
    expect(card.visas.map((v) => v.type)).toEqual(['485', '500'])
    expect(card.visas[0].steps.find((s) => s.current)?.label).toBe('已付款')
  })
  it('has no current step once a visa is granted, even if a step was skipped', () => {
    const t = visaTrack(visa('x', 'v', { materials_on: '2026-01-01', submitted_on: '2026-02-01', granted_on: '2026-03-01' }))
    expect(t.granted).toBe(true)
    expect(t.steps.some((s) => s.current)).toBe(false)
  })
  it('current step follows the last done step (skipped steps stay hollow)', () => {
    const t = visaTrack(visa('x', 'v', { materials_on: '2026-01-01', submitted_on: '2026-02-01' }))
    expect(t.steps.map((s) => [s.done, s.current])).toEqual([
      [true, false],
      [false, false],
      [true, false],
      [false, true],
      [false, false],
    ])
  })
  it('does not show deadlines, TBC or overdue chips for finished or paused students', () => {
    for (const [name, status] of [
      ['赵敏', '已完成'],
      ['孙丽', '暂停不跟进'],
    ]) {
      const { card } = cardWith(name, (d, sid) => {
        d.tasks.push({
          id: 't-old',
          student_id: sid,
          content: '旧待办',
          due_date: '2026-09-01',
          handler: null,
          done_on: null,
          created_at: stamp,
          updated_at: stamp,
        })
      })
      expect(card.deadline).toBeNull()
      expect(card.tbcCount).toBe(0)
      expect(card.overdueTasks).toBe(0)
      expect(card.headline).toBe(status)
    }
  })
  it('only shows key dates within 60 days, and drops past ones except a recent visa expiry', () => {
    const far = cardWith('周杰', (d, sid) => d.key_dates.push(keydate(sid, 'k1', '开学', addDays(today, 90))))
    expect(far.card.deadline).toBeNull()
    const near = cardWith('周杰', (d, sid) => d.key_dates.push(keydate(sid, 'k1', '开学', addDays(today, 20))))
    expect(near.card.deadline?.text).toBe('开学 · 剩 20 天')
    const pastStart = cardWith('周杰', (d, sid) => d.key_dates.push(keydate(sid, 'k1', '开学', addDays(today, -3))))
    expect(pastStart.card.deadline).toBeNull()
    const expired = cardWith('周杰', (d, sid) => d.key_dates.push(keydate(sid, 'k1', '签证到期', addDays(today, -3))))
    expect(expired.card.deadline).toMatchObject({ text: '签证到期 · 已过 3 天', tone: 'red' })
    // 过期很久但还没确认提醒的签证到期：和首页一样继续显示
    const longAgo = cardWith('周杰', (d, sid) => d.key_dates.push(keydate(sid, 'k1', '签证到期', addDays(today, -45))))
    expect(longAgo.card.deadline).toMatchObject({ text: '签证到期 · 已过 45 天', tone: 'red' })
    // 点过「已提醒」就不再显示
    const acked = cardWith('周杰', (d, sid) => d.key_dates.push({ ...keydate(sid, 'k1', '签证到期', addDays(today, -45)), ack_on: today }))
    expect(acked.card.deadline).toBeNull()
  })
  it('does not let an early medical push the current visa step to 已获批', () => {
    const cur = (over: Partial<Visa>) => visaTrack(visa('x', 'v', over)).steps.find((s) => s.current)?.label
    expect(cur({ medical_on: '2026-10-01' })).toBe('材料齐全')
    expect(cur({ materials_on: '2026-10-01', medical_on: '2026-10-05' })).toBe('已付款')
    expect(cur({ paid_on: '2026-10-01', medical_on: '2026-10-05' })).toBe('已递交')
    expect(cur({ materials_on: '2026-10-01', paid_on: '2026-10-02', submitted_on: '2026-10-03', medical_on: '2026-10-04' })).toBe('已获批')
  })
  it('splits the badge into a truncatable label and an always-visible countdown', () => {
    expect(byName('王小明').card.deadline).toMatchObject({ label: 'UQ 接 offer DDL', when: '剩 2 天' })
  })
  it('ignores future-dated timeline entries for the last activity', () => {
    const { card } = cardWith('周杰', (d, sid) => {
      d.events.push({
        id: 'future',
        student_id: sid,
        kind: 'note',
        occurred_on: addDays(today, 5),
        date_unknown: false,
        content: '未来的记录',
        recorder: null,
        milestone: false,
        edit_history: [],
        edited_at: null,
        source: null,
        created_at: stamp,
      })
    })
    expect(card.lastEvent?.full).not.toBe('未来的记录')
    // 只有未来日期的记录时，用一个短标签（放得进紧凑列表的窄列）
    const onlyFuture = cardWith('周杰', (d, sid) => {
      d.events = d.events.map((e) => (e.student_id === sid ? { ...e, occurred_on: addDays(today, 30), date_unknown: false } : e))
    })
    expect(onlyFuture.card.lastEvent?.ago).toBe('未来日期')
  })
  it('explains why a follow-up-due student is in 需要我处理', () => {
    expect(byName('张伟').card.followDueDays).toBeGreaterThanOrEqual(0)
    expect(byName('陈静').card.dormancyEnded).toBe(true)
    expect(byName('陈静').card.followDueDays).toBeNull() // 只显示「休眠已结束」，不重复
    expect(byName('李华').card.followDueDays).toBeNull()
    expect(byName('赵敏').card.followDueDays).toBeNull()
  })
  it('sorts consistently whichever way the comparison runs', () => {
    for (const a of cards)
      for (const b of cards) {
        if (a === b) continue
        expect(Math.sign(compareCards(a, b))).toBe(-Math.sign(compareCards(b, a)))
        expect(compareCards(a, b)).not.toBe(0)
      }
  })
})
