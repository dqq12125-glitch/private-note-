import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  diffDays,
  endOfWeek,
  fmtDate,
  fmtDateTime,
  nearestYear,
  nextOccurrence,
  parseUserDate,
  todayStr,
} from '../src/lib/dates'

describe('dates', () => {
  it('uses Sydney time for today', () => {
    // 2026-10-13 14:30 UTC = 2026-10-14 01:30 悉尼（夏令时 +11）
    expect(todayStr(new Date('2026-10-13T14:30:00Z'))).toBe('2026-10-14')
    expect(todayStr(new Date('2026-10-13T12:00:00Z'))).toBe('2026-10-13')
    expect(fmtDateTime('2026-10-13T14:30:00Z')).toBe('14/10/2026 01:30')
  })
  it('does date arithmetic', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-11-20', '2026-11-13')).toBe(7)
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(endOfWeek('2026-10-14')).toBe('2026-10-18')
    expect(endOfWeek('2026-10-18')).toBe('2026-10-18')
  })
  it('formats DD/MM/YYYY', () => {
    expect(fmtDate('2026-07-09')).toBe('09/07/2026')
  })
  it('parses user input', () => {
    const today = '2026-10-14'
    expect(parseUserDate('20/11/2026', today)).toBe('2026-11-20')
    expect(parseUserDate('20/08/26', today)).toBe('2026-08-20')
    expect(parseUserDate('9/7/2026', today)).toBe('2026-07-09')
    expect(parseUserDate('20.11.2026', today)).toBe('2026-11-20')
    expect(parseUserDate('2026-11-20', today)).toBe('2026-11-20')
    expect(parseUserDate('20112026', today)).toBe('2026-11-20')
    expect(parseUserDate('20/11', today)).toBe('2026-11-20')
    expect(parseUserDate('05/01', '2026-12-20')).toBe('2027-01-05')
    expect(parseUserDate('31/02/2026', today)).toBeNull()
    expect(parseUserDate('abc', today)).toBeNull()
  })
  it('finds nearest/next year', () => {
    expect(nearestYear(1, 5, '2026-12-20')).toBe('2027-01-05')
    expect(nextOccurrence(9, 30, '2026-08-20')).toBe('2026-09-30')
    expect(nextOccurrence(2, 1, '2026-10-14', 31)).toBe('2027-02-01')
  })
})
