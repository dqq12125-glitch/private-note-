import { useMemo, useState } from 'react'
import { UNASSIGNED } from '../lib/constants'
import { addDays, diffDays, fmtDate, fmtWeekday, isoToDate } from '../lib/dates'
import { sortEventsDesc } from '../lib/reminders'
import type { TimelineEvent } from '../lib/types'
import { useStore } from '../data/store'
import { StudentLink } from '../components/bits'
import { EventRow } from '../components/detail/Timeline'
import { Chips, DateField, Segmented, cx } from '../components/ui'

const RANGES = [
  { key: '7', label: '最近 7 天' },
  { key: '14', label: '最近 2 周' },
  { key: '30', label: '最近 30 天' },
  { key: '90', label: '最近 3 个月' },
]

function dayLabel(d: string, today: string) {
  const n = diffDays(today, d)
  if (n === 0) return '今天'
  if (n === 1) return '昨天'
  return `${fmtDate(d)} ${fmtWeekday(d)}`
}

export function ActivityPage() {
  const events = useStore((s) => s.events)
  const students = useStore((s) => s.students)
  const assignees = useStore((s) => s.settings.assignees)
  const today = useStore((s) => s.today)
  const [range, setRange] = useState<string | null>('7')
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [assignee, setAssignee] = useState('')
  const [mode, setMode] = useState<'全部记录' | '只看里程碑'>('全部记录')
  const [showChecks, setShowChecks] = useState(false)
  const [by, setBy] = useState<'发生日期' | '录入日期'>('发生日期')

  const studentAssignee = useMemo(() => new Map(students.map((s) => [s.id, s.assignee])), [students])
  const start = range ? addDays(today, -Number(range) + 1) : from
  const end = range ? today : to

  const groups = useMemo(() => {
    const keyOf = (e: TimelineEvent) => (by === '发生日期' ? e.occurred_on : isoToDate(e.created_at))
    let list = events.filter((e) => {
      const k = keyOf(e)
      if (start && k < start) return false
      if (end && k > end) return false
      if (mode === '只看里程碑' && (!e.milestone || e.kind === 'checked')) return false
      if (!showChecks && e.kind === 'checked' && mode === '全部记录') return false
      if (assignee) {
        const a = studentAssignee.get(e.student_id)
        if (assignee === UNASSIGNED ? a : a !== assignee) return false
      }
      return true
    })
    list = [...list].sort(sortEventsDesc)
    if (by === '录入日期') list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    const out: { day: string; items: TimelineEvent[] }[] = []
    for (const e of list) {
      const k = keyOf(e)
      if (out[out.length - 1]?.day !== k) out.push({ day: k, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  }, [events, start, end, mode, showChecks, assignee, studentAssignee, by])

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const studentCount = new Set(groups.flatMap((g) => g.items.map((e) => e.student_id))).size

  return (
    <div className="mx-auto max-w-[1200px] p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold text-slate-900">所有学生动态</h1>
        <span className="text-[13px] text-slate-500">
          {total} 条记录 · {studentCount} 个学生
        </span>
      </div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <Chips
          options={RANGES}
          value={range}
          onChange={(k) => {
            setRange(k)
            if (!k) {
              setFrom(addDays(today, -6))
              setTo(today)
            }
          }}
        />
        {!range && (
          <span className="inline-flex items-center gap-1 text-[13px] text-slate-500">
            <DateField value={from} onChange={setFrom} size="sm" className="w-36" />至
            <DateField value={to} onChange={setTo} size="sm" className="w-36" />
          </span>
        )}
        <button type="button" className={cx('text-xs', !range ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600')} onClick={() => { setRange(null); setFrom(from ?? addDays(today, -6)); setTo(to ?? today) }}>
          自定义日期
        </button>
        <select className="input input-sm w-auto" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">全部负责人</option>
          {assignees.map((a) => (
            <option key={a}>{a}</option>
          ))}
          <option value={UNASSIGNED}>{UNASSIGNED}</option>
        </select>
        <Segmented options={['全部记录', '只看里程碑'] as const} value={mode} onChange={setMode} size="xs" />
        <Segmented options={['发生日期', '录入日期'] as const} value={by} onChange={setBy} size="xs" />
        <label className="inline-flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" checked={showChecks} onChange={(e) => setShowChecks(e.target.checked)} />
          显示「已检查无变化」
        </label>
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.day} className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">{dayLabel(g.day, today)}</h2>
              <span className="text-xs text-slate-400">
                {g.items.length} 条 · {new Set(g.items.map((e) => e.student_id)).size} 个学生
              </span>
            </div>
            <div className="space-y-0.5">
              {g.items.map((e) => (
                <EventRow key={e.id} e={e} showStudent={<StudentLink id={e.student_id} className="text-[13px]" />} />
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <div className="card p-10 text-center text-[13px] text-slate-400">这段时间没有记录</div>}
      </div>
    </div>
  )
}
