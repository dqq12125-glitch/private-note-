// Excel 行 → 学生、时间线记录、确认清单
import { addDays, fmtDate, makeDate, maxDate } from '../lib/dates'
import type {
  AppStatus,
  BusinessType,
  Priority,
  ReviewItem,
  Student,
  StudentStatus,
  TimelineEvent,
} from '../lib/types'
import { looksLikeMilestone, normalizeText, splitHistory } from './history'
import { findDateMentions, findOfferMentions } from './mentions'

export type ColumnKey =
  | 'name'
  | 'assignee'
  | 'status'
  | 'business'
  | 'background'
  | 'history'
  | 'lastUpdate'
  | 'days'
  | 'priority'

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: '学生姓名',
  assignee: '负责手机',
  status: '状态',
  business: '业务分类',
  background: '客户背景/备注',
  history: '完整详情/历史进度',
  lastUpdate: '最新更新日',
  days: '天数',
  priority: '任务优先级',
}

const HEADER_MATCHERS: [ColumnKey, RegExp][] = [
  ['name', /姓名|学生|名字|name/i],
  ['assignee', /负责|手机|负责人/],
  ['status', /^状态$|状态/],
  ['business', /业务|分类|类型/],
  ['history', /详情|历史|进度/],
  ['background', /背景|备注/],
  ['lastUpdate', /更新/],
  ['days', /天数/],
  ['priority', /优先/],
]

export type HeaderMap = Partial<Record<ColumnKey, number>>

export interface RawRow {
  row: number
  name: string
  assignee: string
  status: string
  business: string
  background: string
  history: string
  lastUpdate: string
  days: string
  priority: string
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    // read-excel-file 把日期单元格读成 UTC 午夜
    const d = makeDate(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
    return d ? fmtDate(d) : ''
  }
  return normalizeText(v)
}

/** 找表头行并匹配列 */
export function detectHeader(data: unknown[][]): { headerRow: number; map: HeaderMap } | null {
  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const row = data[r] ?? []
    const map: HeaderMap = {}
    row.forEach((cell, c) => {
      const text = cellToString(cell).replace(/\s+/g, '')
      if (!text) return
      for (const [key, re] of HEADER_MATCHERS) {
        if (map[key] !== undefined) continue
        if (re.test(text)) {
          // 「负责手机」列名里没有「状态」，但「状态」列可能叫「状态」；避免一列匹配多个
          if (Object.values(map).includes(c)) continue
          map[key] = c
          break
        }
      }
    })
    if (map.name !== undefined && (map.history !== undefined || map.status !== undefined)) return { headerRow: r, map }
  }
  return null
}

export function extractRows(data: unknown[][]): { rows: RawRow[]; map: HeaderMap } | null {
  const h = detectHeader(data)
  if (!h) return null
  const get = (row: unknown[], key: ColumnKey) => (h.map[key] === undefined ? '' : cellToString(row[h.map[key]!]))
  const rows: RawRow[] = []
  for (let r = h.headerRow + 1; r < data.length; r++) {
    const row = data[r] ?? []
    const name = get(row, 'name')
    if (!name) continue
    rows.push({
      row: r + 1,
      name,
      assignee: get(row, 'assignee'),
      status: get(row, 'status'),
      business: get(row, 'business'),
      background: get(row, 'background'),
      history: get(row, 'history'),
      lastUpdate: get(row, 'lastUpdate'),
      days: get(row, 'days'),
      priority: get(row, 'priority'),
    })
  }
  return { rows, map: h.map }
}

// ───────────────────────── 字段清理 ─────────────────────────

export interface CleanName {
  name: string
  english: string | null
  extras: string[]
  removed: string[]
  flagDone: boolean
  flagIgnore: boolean
}

const STATUS_WORDS = /^(已?完成了?|更新过|已更新|不用管了?)$/

export function cleanName(raw: string): CleanName {
  const extras: string[] = []
  const removed: string[] = []
  let flagDone = false
  let flagIgnore = false
  let rest = raw.replace(/\s+/g, ' ').trim()
  // 没闭合的括号补上
  if (/[（(][^）)]*$/.test(rest)) rest += '）'
  rest = rest.replace(/[（(]([^（）()]*)[）)]/g, (_all, inner: string) => {
    const keep: string[] = []
    for (const part of inner.split(/[,，、;；/]/).map((p) => p.trim()).filter(Boolean)) {
      if (STATUS_WORDS.test(part) || /^(完成|已完成|更新过|已更新|不用管了?)/.test(part)) {
        removed.push(part)
        if (/完成/.test(part)) flagDone = true
        if (/不用管/.test(part)) flagIgnore = true
      } else keep.push(part)
    }
    if (keep.length) extras.push(keep.join('，'))
    return ' '
  })
  rest = rest.replace(/\s+/g, ' ').trim()
  // 「王嘉韫 Jenny」→ 中文名 + 英文名
  let english: string | null = null
  if (/[一-龥]/.test(rest)) {
    const latin = rest.match(/[A-Za-z][A-Za-z .'\-]*[A-Za-z]|[A-Za-z]/g)
    const cjk = rest.replace(/[A-Za-z][A-Za-z .'\-]*[A-Za-z]|[A-Za-z]/g, ' ').replace(/\s+/g, '').trim()
    if (latin && cjk) {
      english = latin.join(' ').trim()
      rest = cjk
    }
  }
  return { name: rest || raw.trim(), english, extras, removed, flagDone, flagIgnore }
}

export function normalizeAssignee(raw: string): string | null {
  const s = raw.replace(/\s+/g, ' ').trim()
  if (!s) return null
  const m = s.match(/^team\s*(\d+)$/i)
  if (m) return `team ${m[1]}`
  return s
}

export function mapStatus(raw: string, hasHistory: boolean): StudentStatus {
  const s = raw.trim()
  if (!s) return hasHistory ? '进行中' : '未开始'
  if (/暂停|不跟进|不用管|放弃|停止/.test(s)) return '暂停不跟进'
  if (/未开始|待开始|没开始|还没开始/.test(s)) return '未开始'
  if (/(未|没|还没|尚未|待)(完成|结束|结案|办完)/.test(s)) return '进行中'
  if (/完成|结束|结案|已办完/.test(s)) return '已完成'
  return '进行中'
}

export function mapBusiness(raw: string): BusinessType {
  const s = raw.trim()
  if (!s) return '其他'
  const school = /学校|申请|转学|升学|读|课程|大学|入学/.test(s)
  const visa = /签|visa|500|600|485|189|190|移民/i.test(s)
  if (/学校\s*[+＋和&、/]\s*签证|申请\s*[+＋和&、/]\s*签证/.test(s) || (school && visa && /[+＋和&、/]/.test(s)))
    return '学校+签证申请'
  if (/签证/.test(s) && !/学校/.test(s)) return '签证申请类'
  if (school && !visa) return '学校申请类'
  if (visa) return '签证申请类'
  return '其他'
}

export function mapPriority(raw: string): Priority {
  return raw.trim() === '高' || /^高/.test(raw.trim()) ? '高' : '普通'
}

// ───────────────────────── 生成导入计划 ─────────────────────────

export interface PlannedStudent {
  raw: RawRow
  student: Student
  events: TimelineEvent[]
  reviews: ReviewItem[]
  notes: string[]
  duplicateOf: string | null
}

export interface ImportPlan {
  students: PlannedStudent[]
  assignees: string[]
}

export interface PlanOptions {
  today: string
  now: string
  newId: () => string
  /** 已存在的学生：姓名 → id */
  existing: Map<string, string>
  recorder?: string
  defaultCycle?: number
}

export function buildImportPlan(rows: RawRow[], opts: PlanOptions): ImportPlan {
  const assignees = new Set<string>()
  const baseTime = new Date(opts.now).getTime()
  let seq = 0
  const stamp = () => new Date(baseTime + seq++).toISOString()

  const students = rows.map((raw): PlannedStudent => {
    const notes: string[] = []
    const cn = cleanName(raw.name)
    if (cn.removed.length) notes.push(`名字去掉了「${cn.removed.join('、')}」`)
    if (cn.extras.length) notes.push(`括号里的「${cn.extras.join('；')}」移到了背景备注`)
    if (cn.english) notes.push(`英文名：${cn.english}`)

    const assignee = normalizeAssignee(raw.assignee)
    if (assignee) assignees.add(assignee)
    if (assignee && assignee !== raw.assignee.trim()) notes.push(`负责人「${raw.assignee.trim()}」→「${assignee}」`)
    if (!assignee) notes.push('负责人为空 → 未分配')

    const entries = splitHistory(raw.history, opts.today)
    const status = mapStatus(raw.status, entries.length > 0)
    const business = mapBusiness(raw.business)
    if (raw.business.trim() && raw.business.trim() !== '其他' && business === '其他') notes.push(`业务分类「${raw.business.trim()}」没认出来，先算「其他」`)

    const backgroundParts = [normalizeText(raw.background)]
    if (cn.extras.length) backgroundParts.push(`（导入时从名字里移过来：${cn.extras.join('；')}）`)
    const background = backgroundParts.filter(Boolean).join('\n')

    const studentId = opts.newId()
    const createdAt = stamp()

    // 时间线
    // 最后处理日期不能晚于今天（历史进度里万一有未来的日期）
    const known = entries.map((e) => e.date).filter((d): d is string => !!d && d <= opts.today)
    const lastDate = maxDate(...known)
    const events: TimelineEvent[] = []
    let prevKnown: string | null = null
    entries.forEach((e, idx) => {
      let occurred = e.date
      if (!occurred) {
        // 日期不明：先放在前一条有日期的记录那天（没有就用后一条的，再没有就用今天），方便排序
        const next = entries.slice(idx + 1).find((x) => x.date)?.date ?? null
        occurred = prevKnown ?? next ?? opts.today
      } else prevKnown = occurred
      events.push({
        id: opts.newId(),
        student_id: studentId,
        kind: 'note',
        occurred_on: occurred,
        date_unknown: !e.date,
        content: e.text,
        recorder: opts.recorder ?? '导入',
        milestone: looksLikeMilestone(e.text),
        edit_history: [],
        edited_at: null,
        source: 'import',
        created_at: stamp(),
      })
    })
    const unknownCount = events.filter((e) => e.date_unknown).length
    notes.push(`历史进度拆成 ${events.length} 条记录${unknownCount ? `（${unknownCount} 条日期不明）` : ''}`)

    const cycle = opts.defaultCycle ?? 14
    const active = status === '未开始' || status === '进行中'
    const student: Student = {
      id: studentId,
      name: cn.name,
      english_name: cn.english,
      assignee,
      business_type: business,
      status,
      ball: '我们',
      priority: mapPriority(raw.priority),
      background,
      referrer: null,
      contact: null,
      follow_cycle_days: cycle,
      next_follow_date: active ? (lastDate ? addDays(lastDate, cycle) : opts.today) : null,
      last_handled_date: lastDate,
      last_checked_date: null,
      dormant_until: null,
      dormant_reason: null,
      import_meta: {
        row: raw.row,
        original_name: raw.name,
        original_status: raw.status,
        original_business: raw.business,
        original_assignee: raw.assignee,
        original_last_update: raw.lastUpdate,
        imported_at: opts.now,
      },
      created_at: createdAt,
      updated_at: createdAt,
    }

    // 确认清单
    const reviews: ReviewItem[] = []
    const review = (kind: ReviewItem['kind'], text: string, suggestion: ReviewItem['suggestion']) =>
      reviews.push({
        id: opts.newId(),
        student_id: studentId,
        kind,
        text,
        suggestion,
        status: 'pending',
        created_at: createdAt,
        resolved_at: null,
      })

    // d) 状态冲突
    if (cn.flagDone && status !== '已完成')
      review('status_conflict', `名字里写着「完成」，但状态列是「${raw.status.trim() || '空'}」`, { status: '已完成' })
    else if (cn.flagIgnore && status !== '暂停不跟进' && status !== '已完成')
      review('status_conflict', `名字里写着「不用管了」，但状态列是「${raw.status.trim() || '空'}」`, {
        status: '暂停不跟进',
      })

    if (active) {
      // a) 提到日期或期限的句子
      const base = lastDate ?? opts.today
      const seen = new Set<string>()
      const addMentions = (text: string, b: string, from: string) => {
        for (const m of findDateMentions(text, b, opts.today)) {
          const k = `${m.sentence}|${m.date}`
          if (seen.has(k)) continue
          seen.add(k)
          review('date_mention', m.sentence, {
            date: m.date,
            approx: m.approx,
            target: m.target,
            keydate_kind: m.keydate_kind,
            from,
          })
        }
      }
      addMentions(background, base, '背景备注')
      for (const e of events) addMentions(e.content, e.occurred_on, `${fmtDate(e.occurred_on)} 的记录`)

      // b) 提到 offer
      const offerTexts = [background, ...events.map((e) => e.content)]
      const mentions = offerTexts.flatMap((t) => findOfferMentions(t))
      if (mentions.length) {
        const schools: { school: string; status: AppStatus }[] = []
        for (const m of mentions)
          for (const s of m.schools)
            if (!schools.some((x) => x.school.toLowerCase() === s.school.toLowerCase())) schools.push(s)
        review(
          'offer_mention',
          mentions
            .slice(-4)
            .map((m) => m.sentence)
            .join('\n'),
          { schools },
        )
      }
    }

    const duplicateOf = opts.existing.get(cn.name) ?? null
    if (duplicateOf) notes.push('系统里已经有同名学生')

    return { raw, student, events, reviews, notes, duplicateOf }
  })

  return { students, assignees: [...assignees] }
}

/** 已导入学生「最新更新日」= 时间线最新日期（不用 Excel 那一列），这里只用于预览 */
export function previewLastUpdate(p: PlannedStudent): string {
  const d = maxDate(...p.events.filter((e) => !e.date_unknown).map((e) => e.occurred_on))
  return d ? fmtDate(d) : '—'
}

