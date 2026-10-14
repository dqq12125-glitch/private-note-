// 把「完整详情/历史进度」整段文字按日期拆成一条条记录。
import { makeDate } from '../lib/dates'

export interface DateMatch {
  index: number
  end: number
  date: string
  raw: string
}

// 1) YYYY/MM/DD  2) DD/MM/YYYY 或 DD/MM/YY  3) DD.MM.YYYY 或 DD-MM-YYYY
const FULL_DATE_RE =
  /(?<![\d/.\-])(?:(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})|(\d{1,2})[.\-](\d{1,2})[.\-](\d{4}))(?![\d]|[/.\-]\d)/g

export function findFullDates(text: string): DateMatch[] {
  const out: DateMatch[] = []
  for (const m of text.matchAll(FULL_DATE_RE)) {
    let date: string | null = null
    if (m[1]) date = makeDate(+m[1], +m[2], +m[3])
    else if (m[4]) {
      const y = m[6].length === 2 ? 2000 + +m[6] : +m[6]
      date = makeDate(y, +m[5], +m[4])
    } else if (m[7]) date = makeDate(+m[9], +m[8], +m[7])
    if (date) out.push({ index: m.index!, end: m.index! + m[0].length, date, raw: m[0] })
  }
  return out
}

const AFTER_MENTION = /^\s*(前|之前|以前|截止|到期|左右|过期|开学|为止)/
const BEFORE_LIST_MARK = /^[\s\-–—•·*#>\d.、)）\]】\[【(（]*$/
const BEFORE_SEPARATOR = /[。；;！!？?，,、:：]\s*$/
const BEFORE_DEADLINE_WORD = /(截止|到期|ddl|前|于|在|是|为|到|至|by|before|due|until|on)\s*$/i
const AFTER_LINE_END = /^\s*[。；;，,.!！)）\]】]*\s*$/

/**
 * 这个日期是不是一条记录的开头（而不是句子里提到的日期）。
 * @param hasPrev 这一行前面已经有一条记录开头了（「09/07/2026 递交 20/07/2026 补材料」这种一行多条的写法）
 * @param today 句子中间提到的未来日期是计划，不是记录日期
 */
export function isBoundary(line: string, m: DateMatch, hasPrev = false, today?: string): boolean {
  const before = line.slice(0, m.index)
  const after = line.slice(m.end)
  if (AFTER_MENTION.test(after)) return false
  if (BEFORE_LIST_MARK.test(before)) return true
  // 下面都是写在行中间的日期：未来的日期当作「提到的计划」，不拆
  if (today && m.date > today) return false
  if (BEFORE_SEPARATOR.test(before)) return true
  if (/[（(【\[]\s*$/.test(before) && /^\s*[）)】\]]/.test(after)) return true
  if (AFTER_LINE_END.test(after) && before.trim()) return !BEFORE_DEADLINE_WORD.test(before)
  // 只用空格隔开的日期：只有这一行开头已经是日期时才算新记录（否则是「学生 09/07/2026 交了押金」这种句子）
  if (hasPrev && /\s$/.test(before) && !BEFORE_DEADLINE_WORD.test(before)) return true
  return false
}

export interface HistoryEntry {
  date: string | null
  text: string
}

const LEAD_TRIM = /^[\s:：,，\-–—.、)）\]】|>]+/
const TRAIL_TRIM = /[\s,，;；|]+$/
const LIST_MARK = /^(\d{1,2}[.、)）]|[-•·*])\s*/

function clean(s: string): string {
  return s.replace(LEAD_TRIM, '').replace(TRAIL_TRIM, '').replace(/^[（(【\[]\s*$/, '').trim()
}

export function normalizeText(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/_x000D_/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

/** 拆分一行 */
function splitLine(line: string, today?: string): HistoryEntry[] {
  const bounds: DateMatch[] = []
  for (const m of findFullDates(line)) if (isBoundary(line, m, bounds.length > 0, today)) bounds.push(m)
  if (!bounds.length) return [{ date: null, text: clean(line) }]

  const rawPrefix = line.slice(0, bounds[0].index)
  const prefix = BEFORE_LIST_MARK.test(rawPrefix) ? '' : clean(rawPrefix)
  const lastAfter = clean(line.slice(bounds[bounds.length - 1].end))

  // 日期写在后面的情况：「递交UQ申请 09/07/2026」
  if (prefix && !lastAfter) {
    const out: HistoryEntry[] = []
    let start = 0
    for (const b of bounds) {
      const text = clean(line.slice(start, b.index).replace(/[（(【\[]\s*$/, ''))
      if (text) out.push({ date: b.date, text })
      start = b.end
    }
    return out
  }

  const out: HistoryEntry[] = []
  if (prefix) out.push({ date: null, text: prefix })
  bounds.forEach((b, i) => {
    const end = i + 1 < bounds.length ? bounds[i + 1].index : line.length
    out.push({ date: b.date, text: clean(line.slice(b.end, end)) })
  })
  return out
}

/**
 * 拆分整段历史进度。
 * - 每个「开头的日期」开始一条新记录
 * - 没有日期的行 → 日期不明（date = null）
 * - 上一条以冒号结尾、或日期单独占一行时，下面没日期的行算作上一条的续行
 */
export function splitHistory(raw: unknown, today?: string): HistoryEntry[] {
  const text = normalizeText(raw)
  if (!text) return []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const out: HistoryEntry[] = []
  let continuing = false
  for (const line of lines) {
    const parts = splitLine(line, today)
    const prev = out[out.length - 1]
    if (parts.length === 1 && parts[0].date === null && prev) {
      const isList = LIST_MARK.test(line)
      const prevOpen = prev.text === '' || /[:：]$/.test(prev.text)
      if (prevOpen || (continuing && isList)) {
        prev.text = prev.text ? `${prev.text}\n${parts[0].text}` : parts[0].text
        continuing = true
        continue
      }
    }
    continuing = false
    for (const p of parts) out.push({ ...p })
  }
  return out.filter((e) => e.text || e.date).map((e) => ({ ...e, text: e.text || '（只有日期，没有内容）' }))
}

const MILESTONE_RE =
  /递交|已交申请|offer|录取|coe|获批|下签|批了|出签|签证批|付款|已付|交了押金|押金已|学费已|拒签|被拒/i

export function looksLikeMilestone(text: string): boolean {
  return MILESTONE_RE.test(text)
}
