import { useMemo, useState } from 'react'
import { addMonths, diffDays, fmtDate, fmtMonth, fmtWeekday, monthKey } from '../lib/dates'
import { isFollowedStudent, type Deadline } from '../lib/reminders'
import { useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { StudentLink } from '../components/bits'
import { Chips, DaysLeft, cx } from '../components/ui'

interface CalItem {
  key: string
  date: string
  student_id: string
  icon: string
  text: string
  kind: string
  warn: boolean
}

const KIND_FILTERS = [
  { key: 'offer', label: '⏳ Offer DDL' },
  { key: 'deadline', label: '💳 付款/补材料' },
  { key: 'keydate', label: '📅 关键日期' },
  { key: 'visa', label: '🛂 签证到期' },
  { key: 'dormant', label: '💤 休眠结束' },
  { key: 'task', label: '☑️ 待办' },
]

function kindOf(d: Deadline): string {
  if (d.kind === 'offer') return 'offer'
  if (d.kind === 'payment' || d.kind === 'condition') return 'deadline'
  if (d.kind === 'visa_expiry' || (d.kind === 'keydate' && d.title === '签证到期')) return 'visa'
  if (d.kind === 'task') return 'task'
  return 'keydate'
}

export function CalendarPage() {
  const infos = useInfos()
  const today = useStore((s) => s.today)
  const [months, setMonths] = useState<string | null>('6')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const horizon = addMonths(today, Number(months ?? '6'))

  const items = useMemo(() => {
    const out: CalItem[] = []
    for (const i of infos) {
      if (!isFollowedStudent(i)) continue
      for (const d of i.deadlines) {
        if (!d.date) continue
        if (d.kind === 'keydate' && d.date < today) continue
        out.push({
          key: d.key,
          date: d.date,
          student_id: i.s.id,
          icon: d.icon,
          text: d.kind === 'task' ? `待办：${d.title}` : d.title + (d.sub && d.kind !== 'offer' ? ` · ${d.sub}` : ''),
          kind: kindOf(d),
          warn: d.kind === 'visa_expiry' || (d.kind === 'keydate' && d.title === '签证到期'),
        })
      }
      if (i.s.dormant_until)
        out.push({
          key: `dormant:${i.s.id}`,
          date: i.s.dormant_until,
          student_id: i.s.id,
          icon: '💤',
          text: `休眠结束${i.s.dormant_reason ? ` · ${i.s.dormant_reason}` : ''}`,
          kind: 'dormant',
          warn: false,
        })
    }
    return out.filter((x) => x.date <= horizon && !hidden.has(x.kind)).sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [infos, today, horizon, hidden])

  const overdue = items.filter((x) => x.date < today)
  const byMonth = useMemo(() => {
    const m = new Map<string, CalItem[]>()
    let k = monthKey(today)
    while (k <= monthKey(horizon)) {
      m.set(k, [])
      k = monthKey(addMonths(`${k}-01`, 1))
    }
    for (const x of items) if (x.date >= today) m.get(monthKey(x.date))?.push(x)
    return [...m]
  }, [items, today, horizon])
  const max = Math.max(1, ...byMonth.map(([, l]) => l.length))

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">未来几个月</h1>
        <Chips
          options={[
            { key: '3', label: '3 个月' },
            { key: '6', label: '6 个月' },
            { key: '12', label: '12 个月' },
          ]}
          value={months}
          onChange={(k) => setMonths(k ?? '6')}
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h)
                if (n.has(f.key)) n.delete(f.key)
                else n.add(f.key)
                return n
              })
            }
            className={cx(
              'rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset',
              hidden.has(f.key) ? 'bg-white text-slate-400 ring-slate-200 line-through' : 'bg-inverse text-on-inverse ring-inverse',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 每个月有多忙 */}
      <div className="card mb-4 flex items-end gap-2 overflow-x-auto p-4">
        {byMonth.map(([k, list]) => (
          <a key={k} href={`#m-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`m-${k}`)?.scrollIntoView({ behavior: 'smooth' }) }} className="flex min-w-[56px] flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{list.length}</span>
            <div className="flex h-16 w-full items-end rounded bg-slate-50">
              <div
                className={cx('w-full rounded', list.length / max > 0.66 ? 'bg-rose-400' : list.length / max > 0.33 ? 'bg-amber-400' : 'bg-brand-300')}
                style={{ height: `${(list.length / max) * 100}%`, minHeight: list.length ? 4 : 0 }}
              />
            </div>
            <span className="text-[11px] text-slate-500">{fmtMonth(k).replace(/^\d+年/, '')}</span>
          </a>
        ))}
      </div>

      {overdue.length > 0 && (
        <div className="card mb-4 border-rose-200 p-4">
          <h2 className="mb-2 text-[15px] font-semibold text-rose-700">⚠️ 已过期还没处理（{overdue.length}）</h2>
          <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            {overdue.map((x) => (
              <Line key={x.key} x={x} today={today} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {byMonth.map(([k, list]) => (
          <div key={k} id={`m-${k}`} className="card scroll-mt-4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-slate-900">{fmtMonth(k)}</h2>
              <span className="text-xs text-slate-400">{list.length} 件</span>
              {list.some((x) => x.warn) && <span className="text-xs text-rose-500">⚠️</span>}
            </div>
            {list.length ? (
              <div className="space-y-1">
                {list.map((x) => (
                  <Line key={x.key} x={x} today={today} />
                ))}
              </div>
            ) : (
              <div className="py-2 text-[13px] text-slate-300">暂无</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Line({ x, today }: { x: CalItem; today: string }) {
  const n = diffDays(x.date, today)
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-[5.5rem] shrink-0 text-slate-500 tabular-nums">
        {fmtDate(x.date).slice(0, 5)} {fmtWeekday(x.date)}
      </span>
      <span>{x.warn ? '⚠️' : x.icon}</span>
      <StudentLink id={x.student_id} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-slate-600" title={x.text}>
        {x.text}
      </span>
      {n <= 14 && <DaysLeft days={n} scale="week" />}
    </div>
  )
}
