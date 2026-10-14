import { describe, expect, it } from 'vitest'
import { findFullDates, splitHistory } from '../src/importer/history'

describe('findFullDates', () => {
  it('recognises DD/MM/YYYY and DD/MM/YY', () => {
    const m = findFullDates('09/07/2026 递交；20/08/26 offer')
    expect(m.map((x) => x.date)).toEqual(['2026-07-09', '2026-08-20'])
  })
  it('ignores invalid and partial dates', () => {
    expect(findFullDates('IELTS 6.5 总分 6/7')).toEqual([])
    expect(findFullDates('32/13/2026')).toEqual([])
  })
})

describe('splitHistory', () => {
  it('splits one entry per dated line', () => {
    const r = splitHistory('09/07/2026 递交UQ申请\n20/08/26 UQ con offer，等雅思\n学生说下周考雅思')
    expect(r).toEqual([
      { date: '2026-07-09', text: '递交UQ申请' },
      { date: '2026-08-20', text: 'UQ con offer，等雅思' },
      { date: null, text: '学生说下周考雅思' },
    ])
  })
  it('splits several dates on one line', () => {
    const r = splitHistory('09/07/2026 递交申请；20/08/26：拿到offer 01/09/2026 学生接受')
    expect(r.map((e) => e.date)).toEqual(['2026-07-09', '2026-08-20', '2026-09-01'])
    expect(r[1].text).toBe('拿到offer')
  })
  it('keeps undated text before first date', () => {
    const r = splitHistory('学生想读IT，预算有限。09/07/2026 递交')
    expect(r[0]).toEqual({ date: null, text: '学生想读IT，预算有限。' })
    expect(r[1]).toEqual({ date: '2026-07-09', text: '递交' })
  })
  it('does not split on deadline mentions', () => {
    const r = splitHistory('09/07/2026 学生签证到期日 20/02/27前要续签')
    expect(r).toEqual([{ date: '2026-07-09', text: '学生签证到期日 20/02/27前要续签' }])
    const r2 = splitHistory('10/08/2026 学签在20/02/2027到期')
    expect(r2).toHaveLength(1)
  })
  it('handles date at the end of a line', () => {
    const r = splitHistory('递交UQ申请 09/07/2026\n收到offer（20/08/2026）')
    expect(r).toEqual([
      { date: '2026-07-09', text: '递交UQ申请' },
      { date: '2026-08-20', text: '收到offer' },
    ])
  })
  it('treats list lines after a colon as continuation', () => {
    const r = splitHistory('09/07/2026 让学生准备材料：\n1. 成绩单\n2. 护照\n20/08/2026 材料齐了')
    expect(r).toHaveLength(2)
    expect(r[0].text).toBe('让学生准备材料：\n1. 成绩单\n2. 护照')
  })
  it('handles a date alone on its own line', () => {
    const r = splitHistory('09/07/2026\n递交申请\n20/08/2026\n拿到offer')
    expect(r).toEqual([
      { date: '2026-07-09', text: '递交申请' },
      { date: '2026-08-20', text: '拿到offer' },
    ])
  })
  it('handles numbered dated entries and CRLF', () => {
    const r = splitHistory('1. 09/07/2026 递交\r\n2、20/08/26 offer')
    expect(r.map((e) => e.date)).toEqual(['2026-07-09', '2026-08-20'])
    expect(r[1].text).toBe('offer')
  })
  it('returns empty for empty input', () => {
    expect(splitHistory('')).toEqual([])
    expect(splitHistory(null)).toEqual([])
  })
})
