import { describe, expect, it } from 'vitest'
import { findDateMentions, findOfferMentions } from '../src/importer/mentions'

const today = '2026-10-14'

describe('findDateMentions', () => {
  it('finds M.D号 style deadlines', () => {
    const r = findDateMentions('学生10.30号补成绩单', '2026-10-01', today)
    expect(r).toHaveLength(1)
    expect(r[0].date).toBe('2026-10-30')
    expect(r[0].target).toBe('task')
  })
  it('finds orientation dates as key dates', () => {
    const r = findDateMentions('11.12号Orientation', '2026-10-01', today)
    expect(r[0]).toMatchObject({ date: '2026-11-12', target: 'keydate', keydate_kind: 'Orientation' })
  })
  it('finds month-only visa expiry', () => {
    const r = findDateMentions('学签2月左右到期，要提前准备', '2026-09-01', today)
    expect(r[0]).toMatchObject({ date: '2027-02-01', approx: true, keydate_kind: '签证到期' })
  })
  it('skips past dates and score numbers', () => {
    expect(findDateMentions('9.30号补成绩单', '2026-08-20', today)).toEqual([])
    expect(findDateMentions('雅思6.5，小分6', '2026-08-20', today)).toEqual([])
  })
  it('finds Chinese 月日 dates', () => {
    const r = findDateMentions('12月5日前交押金', '2026-10-01', today)
    expect(r[0].date).toBe('2026-12-05')
  })
})

describe('findOfferMentions', () => {
  it('extracts school names', () => {
    const r = findOfferMentions('UQ con offer已下，等学生决定')
    expect(r[0].schools).toEqual([{ school: 'UQ', status: 'Con offer' }])
    const r2 = findOfferMentions('Monash offer已下')
    expect(r2[0].schools[0].school).toBe('Monash')
    const r3 = findOfferMentions('拿到 UNSW uncon offer 和 USYD conditional offer')
    expect(r3[0].schools).toEqual([
      { school: 'UNSW', status: 'Uncon offer' },
      { school: 'USYD', status: 'Con offer' },
    ])
  })
  it('extracts Chinese school names', () => {
    const r = findOfferMentions('昆士兰大学offer到了')
    expect(r[0].schools[0].school).toBe('昆士兰大学')
  })
})
