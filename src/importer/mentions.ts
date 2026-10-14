// 从备注里找出「提到具体日期或期限的句子」和「提到 offer 的句子」，生成导入确认清单。
import { diffDays, makeDate, nextOccurrence } from '../lib/dates'
import type { AppStatus, KeyDateKind } from '../lib/types'
import { findFullDates } from './history'

export interface DateMention {
  sentence: string
  date: string
  approx: boolean
  target: 'task' | 'keydate'
  keydate_kind?: KeyDateKind
}

const SCORE_CONTEXT = /(雅思|ielts|pte|托福|toefl|gpa|均分|总分|小分|分数|wam|成绩是|考了|口语|听力|阅读|写作)\s*[:：]?\s*$/i
const DEADLINE_SUFFIX = '(?:号|日|前|之前|左右|截止|到期)'

function splitClauses(text: string): string[] {
  return text
    .split(/[。；;！!？?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 只取包含匹配位置的那一小段（按逗号切）；太短的话保留整句 */
function narrow(clause: string, index: number): string {
  const parts = clause.split(/([，,])/)
  let pos = 0
  for (const p of parts) {
    if (index >= pos && index < pos + p.length) {
      const t = p.trim()
      if (t.length >= 5) return t
      break
    }
    pos += p.length
  }
  if (clause.length <= 60) return clause
  return clause.slice(Math.max(0, index - 30), index + 30).trim()
}

export function guessKeyDateKind(sentence: string): KeyDateKind | null {
  if (/(签证|学签|visa|签)/i.test(sentence) && /(到期|过期|expire|有效期)/i.test(sentence)) return '签证到期'
  if (/orientation|迎新|\bori\b/i.test(sentence)) return 'Orientation'
  if (/开学|start/i.test(sentence)) return '开学'
  if (/毕业|graduat/i.test(sentence)) return '毕业'
  if (/出成绩|成绩出|放榜|result/i.test(sentence)) return '出成绩'
  return null
}

function scoreLike(clause: string, index: number): boolean {
  return SCORE_CONTEXT.test(clause.slice(Math.max(0, index - 10), index))
}

/**
 * 找出句子里提到的日期。
 * @param base 这段文字写下时的日期，用来推断没写年份的日期
 * @param today 今天；已经过去一周以上的日期不再列出
 */
export function findDateMentions(text: string, base: string, today: string): DateMention[] {
  const out: DateMention[] = []
  const seen = new Set<string>()
  const push = (clause: string, index: number, date: string | null, approx: boolean) => {
    if (!date) return
    // 已经过去的日期不需要再提醒；按月估计的，整个月过去了才算过去
    const cutoff = approx ? diffDays(date, today) + 27 : diffDays(date, today)
    if (cutoff < -7) return
    const sentence = narrow(clause, index)
    const key = `${sentence}|${date}`
    if (seen.has(key)) return
    seen.add(key)
    const kind = guessKeyDateKind(sentence)
    out.push({
      sentence,
      date,
      approx,
      target: kind ? 'keydate' : 'task',
      ...(kind ? { keydate_kind: kind } : {}),
    })
  }

  for (const clause of splitClauses(text)) {
    const taken: [number, number][] = []
    const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a)

    // 完整日期
    for (const m of findFullDates(clause)) {
      taken.push([m.index, m.end])
      push(clause, m.index, m.date, false)
    }
    // 9月30日 / 9月30号 / 9月30
    for (const m of clause.matchAll(/(?<!\d)(?:(\d{4})年)?(\d{1,2})月(\d{1,2})(?:日|号)?/g)) {
      const s = m.index!
      const e = s + m[0].length
      if (overlaps(s, e)) continue
      taken.push([s, e])
      const date = m[1] ? makeDate(+m[1], +m[2], +m[3]) : nextOccurrence(+m[2], +m[3], base)
      push(clause, s, date, false)
    }
    // 9.30号 / 11.12号Orientation / 9.30前
    for (const m of clause.matchAll(new RegExp(`(?<![\\d.])(\\d{1,2})\\.(\\d{1,2})${DEADLINE_SUFFIX}`, 'g'))) {
      const s = m.index!
      const e = s + m[0].length
      if (overlaps(s, e) || scoreLike(clause, s)) continue
      taken.push([s, e])
      push(clause, s, nextOccurrence(+m[1], +m[2], base), false)
    }
    // 30/9 前（日/月，没写年份）
    for (const m of clause.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
      const s = m.index!
      const e = s + m[0].length
      if (overlaps(s, e) || scoreLike(clause, s)) continue
      taken.push([s, e])
      push(clause, s, nextOccurrence(+m[2], +m[1], base), false)
    }
    // 2月左右 / 明年2月 / 2027年2月 / 2月底
    for (const m of clause.matchAll(/(?<!\d)(?:(\d{4})年|(明年|今年))?(\d{1,2})月(?!\d)(份|初|中旬|中|底|下旬|上旬|左右|前)?/g)) {
      const s = m.index!
      const e = s + m[0].length
      if (overlaps(s, e)) continue
      const month = +m[3]
      if (month < 1 || month > 12) continue
      // 只有「X月」没有修饰词、也没有期限相关的词时，很可能不是期限（比如「读了3月」），跳过
      if (!m[1] && !m[2] && !m[4] && !/(到期|截止|开学|毕业|出成绩|前|ddl|deadline|入学|考试|递交|过期)/i.test(clause))
        continue
      taken.push([s, e])
      const day = m[4] === '底' || m[4] === '下旬' ? 25 : m[4] === '中' || m[4] === '中旬' ? 15 : 1
      let date: string | null
      if (m[1]) date = makeDate(+m[1], month, day)
      else if (m[2] === '明年') date = makeDate(Number(base.slice(0, 4)) + 1, month, day)
      else if (m[2] === '今年') date = makeDate(Number(base.slice(0, 4)), month, day)
      else date = nextOccurrence(month, day, base, 31)
      push(clause, s, date, true)
    }
  }
  return out
}

// ───────────────────────── offer ─────────────────────────

export interface OfferMention {
  sentence: string
  schools: { school: string; status: AppStatus }[]
}

const SCHOOL_STOP = new Set([
  'offer', 'con', 'uncon', 'conditional', 'unconditional', 'full', 'the', 'a', 'an', 'got', 'get', 'gets',
  'has', 'have', 'had', 'received', 'receive', 'new', 'package', 'letter', 'ddl', 'deadline', 'accept',
  'accepted', 'and', 'or', 'of', 'to', 'is', 'was', 'with', 'for', 'from', 'my', 'his', 'her', 'their',
  'coe', 'visa', 'and', 'already', 'final',
])

function cleanSchool(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  while (words.length && SCHOOL_STOP.has(words[words.length - 1].toLowerCase().replace(/'s$/, '')))
    words.pop()
  while (words.length && SCHOOL_STOP.has(words[0].toLowerCase())) words.shift()
  return words.slice(-3).join(' ').replace(/'s$/i, '')
}

function offerStatus(qual: string | undefined, sentence: string): AppStatus {
  const q = (qual ?? '').toLowerCase()
  if (/uncon|无条件|full|正式/.test(q)) return 'Uncon offer'
  if (/con|有条件/.test(q)) return 'Con offer'
  if (/uncon|无条件/i.test(sentence)) return 'Uncon offer'
  return 'Con offer'
}

export function findOfferMentions(text: string): OfferMention[] {
  const out: OfferMention[] = []
  const seen = new Set<string>()
  for (const clause of splitClauses(text)) {
    if (!/offer|录取/i.test(clause)) continue
    const schools: { school: string; status: AppStatus }[] = []
    const add = (school: string, status: AppStatus) => {
      if (!school) return
      if (schools.some((x) => x.school.toLowerCase() === school.toLowerCase())) return
      schools.push({ school, status })
    }
    const latin =
      /([A-Za-z][A-Za-z&'.\-]*(?:\s+[A-Za-z][A-Za-z&'.\-]*){0,4})\s*(?:的)?\s*(conditional|unconditional|uncon|con|full|有条件|无条件|正式)?\s*offer/gi
    for (const m of clause.matchAll(latin)) {
      // 第一组可能把 con/uncon 也吃进去了，cleanSchool 会去掉
      const qual = m[2] ?? (/(uncon|unconditional)\s*$/i.test(m[1]) ? 'uncon' : /\b(con|conditional)\s*$/i.test(m[1]) ? 'con' : undefined)
      add(cleanSchool(m[1]), offerStatus(qual, clause))
    }
    const cjk = /([一-龥]{1,10}?(?:大学|学院|理工|学校))\s*(?:的)?\s*(有条件|无条件|正式|con|uncon)?\s*(?:offer|录取)/gi
    for (const m of clause.matchAll(cjk)) add(m[1], offerStatus(m[2], clause))
    const key = clause
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ sentence: clause.length > 80 ? `${clause.slice(0, 80)}…` : clause, schools })
  }
  return out
}
