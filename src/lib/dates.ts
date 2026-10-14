// 日期工具：所有「日期」都是悉尼当地日期的 'YYYY-MM-DD' 字符串。
// 内部用 UTC 午夜的 Date 对象做加减，避免夏令时造成的偏差。

export const TZ = 'Australia/Sydney'

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function sydneyParts(d: Date) {
  const out: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(d)) out[p.type] = p.value
  // en-GB 在午夜会给出 "24"
  const hour = out.hour === '24' ? '00' : out.hour
  return { y: out.year, m: out.month, d: out.day, hh: hour, mm: out.minute }
}

/** 今天（悉尼时间） */
export function todayStr(now: Date = new Date()): string {
  const p = sydneyParts(now)
  return `${p.y}-${p.m}-${p.d}`
}

/** 时间戳 → 悉尼当地日期 */
export function isoToDate(iso: string): string {
  return todayStr(new Date(iso))
}

/** 时间戳 → 'DD/MM/YYYY HH:mm'（悉尼时间） */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = sydneyParts(new Date(iso))
  return `${p.d}/${p.m}/${p.y} ${p.hh}:${p.mm}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(dt: Date): string {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isValidDateStr(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function makeDate(y: number, m: number, d: number): string | null {
  const s = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidDateStr(s) ? s : null
}

export function addDays(date: string, n: number): string {
  const dt = toUtc(date)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fromUtc(dt)
}

export function addMonths(date: string, n: number): string {
  const dt = toUtc(date)
  const day = dt.getUTCDate()
  dt.setUTCDate(1)
  dt.setUTCMonth(dt.getUTCMonth() + n)
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()
  dt.setUTCDate(Math.min(day, last))
  return fromUtc(dt)
}

/** a - b，单位：天 */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86400000)
}

/** 0 = 周日 … 6 = 周六 */
export function weekday(date: string): number {
  return toUtc(date).getUTCDay()
}

/** 本周日（周一为一周开始） */
export function endOfWeek(date: string): string {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? 0 : 7 - wd)
}

export function startOfWeek(date: string): string {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function maxDate(...ds: (string | null | undefined)[]): string | null {
  let best: string | null = null
  for (const d of ds) if (d && (!best || d > best)) best = d
  return best
}

export function minDate(...ds: (string | null | undefined)[]): string | null {
  let best: string | null = null
  for (const d of ds) if (d && (!best || d < best)) best = d
  return best
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** 'DD/MM'，不是今年时显示 'DD/MM/YY' */
export function fmtShort(date: string | null | undefined, today: string = todayStr()): string {
  if (!date) return ''
  const [y, m, d] = date.split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function fmtWeekday(date: string): string {
  return WEEKDAYS[weekday(date)]
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function fmtMonth(key: string): string {
  const [y, m] = key.split('-')
  return `${y}年${Number(m)}月`
}

/** 剩余天数的文字：今天 / 明天 / 剩 N 天 / 已过 N 天 */
export function fmtDaysLeft(n: number | null): string {
  if (n === null) return ''
  if (n === 0) return '今天'
  if (n === 1) return '明天'
  if (n === -1) return '昨天'
  if (n > 0) return `剩 ${n} 天`
  return `已过 ${-n} 天`
}

/** 距今多少天的文字：今天 / 昨天 / N 天前 */
export function fmtAgo(n: number | null): string {
  if (n === null) return '从未'
  if (n <= 0) return '今天'
  if (n === 1) return '昨天'
  return `${n} 天前`
}

/**
 * 解析用户输入的日期。支持：
 * DD/MM/YYYY、DD/MM/YY、DD/MM（年份取离今天最近的）、DD.MM.YYYY、DD-MM-YYYY、YYYY-MM-DD、DDMMYYYY
 */
export function parseUserDate(input: string, today: string = todayStr()): string | null {
  const s = input.trim().replace(/[年月]/g, '/').replace(/[日号]/g, '')
  if (!s) return null
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return makeDate(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[\s/.\-](\d{1,2})[\s/.\-](\d{2}|\d{4})$/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return makeDate(y, +m[2], +m[1])
  }
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/)
  if (m) return makeDate(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})[\s/.\-](\d{1,2})$/)
  if (m) return nearestYear(+m[2], +m[1], today)
  return null
}

/** 只有月日时，选离 today 最近的那一年 */
export function nearestYear(month: number, day: number, today: string): string | null {
  const y = Number(today.slice(0, 4))
  const candidates = [y - 1, y, y + 1]
    .map((yy) => makeDate(yy, month, day))
    .filter((x): x is string => !!x)
  if (!candidates.length) return null
  return candidates.reduce((best, c) => (Math.abs(diffDays(c, today)) < Math.abs(diffDays(best, today)) ? c : best))
}

/** 只有月日时，选 base 之后（允许往前 graceDays 天）最近的一次 */
export function nextOccurrence(month: number, day: number, base: string, graceDays = 30): string | null {
  const y = Number(base.slice(0, 4))
  for (const yy of [y - 1, y, y + 1, y + 2]) {
    const c = makeDate(yy, month, day)
    if (c && diffDays(c, base) >= -graceDays) return c
  }
  return null
}
