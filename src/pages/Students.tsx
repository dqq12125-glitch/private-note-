import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Search } from 'lucide-react'
import { BUSINESS_TYPES, cycleLabel, PRIORITIES, STUDENT_STATUSES, UNASSIGNED } from '../lib/constants'
import { fmtDate, fmtShort } from '../lib/dates'
import { defaultGroupSort, GROUPS, type GroupKey, type StudentInfo } from '../lib/reminders'
import { searchStudents } from '../lib/search'
import { createStudent } from '../data/actions'
import { useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { AssigneeTag, BallTag, StatusTag, StudentLink, useOpenStudent } from '../components/bits'
import { Button, DaysLeft, Modal, Field, cx } from '../components/ui'

type SortKey = 'name' | 'assignee' | 'business' | 'status' | 'ball' | 'next' | 'ddl' | 'follow' | 'stale'

const COLS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'name', label: '姓名', className: 'w-[13%] min-w-[9rem]' },
  { key: 'assignee', label: '负责人', className: 'w-[7%]' },
  { key: 'business', label: '业务类型', className: 'w-[8%]' },
  { key: 'status', label: '状态', className: 'w-[7%]' },
  { key: 'ball', label: '球在谁那', className: 'w-[7%]' },
  { key: 'next', label: '下一步', className: 'w-[24%] min-w-[12rem]' },
  { key: 'ddl', label: '最近 DDL', className: 'w-[15%] min-w-[10rem]' },
  { key: 'follow', label: '下次跟进', className: 'w-[8%]' },
  { key: 'stale', label: '距上次更新', className: 'w-[9%]' },
]

function sortValue(i: StudentInfo, k: SortKey): string | number {
  switch (k) {
    case 'name':
      return i.s.name
    case 'assignee':
      return i.s.assignee ?? '~'
    case 'business':
      return i.s.business_type
    case 'status':
      return STUDENT_STATUSES.indexOf(i.s.status)
    case 'ball':
      return i.s.ball
    case 'next':
      return i.nextTask?.due_date ?? (i.nextTask ? '9998' : '9999')
    case 'ddl':
      return i.nearestDdl?.daysLeft ?? (i.hasTbc ? 9998 : 9999)
    case 'follow':
      return i.isDormant ? `z${i.s.dormant_until}` : (i.s.next_follow_date ?? '9999')
    case 'stale':
      return i.daysSinceUpdate ?? 0
  }
}

function NewStudentDialog({ onClose }: { onClose: () => void }) {
  const assignees = useStore((s) => s.settings.assignees)
  const open = useOpenStudent()
  const [name, setName] = useState('')
  const [assignee, setAssignee] = useState('')
  const [business, setBusiness] = useState<(typeof BUSINESS_TYPES)[number]>('学校+签证申请')
  const save = () => {
    if (!name.trim()) return
    const s = createStudent({ name: name.trim(), assignee: assignee || null, business_type: business })
    onClose()
    open(s.id)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="新建学生"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="姓名">
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="负责人">
            <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">{UNASSIGNED}</option>
              {assignees.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field label="业务类型">
            <select className="input" value={business} onChange={(e) => setBusiness(e.target.value as typeof business)}>
              {BUSINESS_TYPES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function Row({ i, selected, onOpen }: { i: StudentInfo; selected: boolean; onOpen: () => void }) {
  const today = useStore((s) => s.today)
  const s = i.s
  const staleCls =
    i.stale === 'ok' ? 'bg-emerald-500' : i.stale === 'warn' ? 'bg-amber-400' : 'bg-rose-500'
  const nt = i.nextTask
  return (
    <tr
      onClick={onOpen}
      className={cx(
        'cursor-pointer border-b border-slate-100 align-top transition-colors',
        selected ? 'bg-brand-50' : 'hover:bg-slate-50',
      )}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <StudentLink id={s.id} />
          {s.priority === '高' && <span className="tag bg-rose-50 px-1 text-[10px] text-rose-600 ring-rose-200">高</span>}
        </div>
        {s.english_name && <div className="text-xs text-slate-400">{s.english_name}</div>}
        {i.group === 'urgent' && (
          <div className="mt-0.5 line-clamp-2 text-[11px] text-rose-600" title={i.urgentReasons.join('\n')}>
            🔥 {i.urgentReasons[0]}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <AssigneeTag assignee={s.assignee} />
      </td>
      <td className="px-3 py-2 text-xs text-slate-500">{s.business_type}</td>
      <td className="px-3 py-2">
        <StatusTag status={s.status} />
      </td>
      <td className="px-3 py-2">
        <BallTag ball={s.ball} prefix={false} />
      </td>
      <td className="px-3 py-2 text-[13px]">
        {nt ? (
          <div>
            <div className="line-clamp-2 text-slate-700">{nt.content}</div>
            {nt.due_date && (
              <div className={cx('text-xs tabular-nums', nt.due_date < today ? 'font-medium text-rose-600' : nt.due_date === today ? 'text-orange-600' : 'text-slate-400')}>
                {fmtShort(nt.due_date, today)}
                {i.openTasks.length > 1 && <span className="text-slate-400"> · 共 {i.openTasks.length} 件</span>}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-[13px]">
        {i.nearestDdl ? (
          <div>
            <div className="truncate text-slate-700" title={i.nearestDdl.title}>
              {i.nearestDdl.title}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 tabular-nums">{fmtShort(i.nearestDdl.date, today)}</span>
              <DaysLeft days={i.nearestDdl.daysLeft} scale="week" />
            </div>
          </div>
        ) : i.hasTbc ? (
          <span className="tag bg-orange-50 text-orange-700 ring-orange-200">offer DDL 待确认</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-[13px] tabular-nums">
        {i.isDormant ? (
          <span className="text-indigo-600" title={s.dormant_reason ?? ''}>
            💤 {fmtShort(s.dormant_until, today)}
          </span>
        ) : s.next_follow_date && i.active ? (
          <span className={cx(s.next_follow_date <= today ? 'font-medium text-rose-600' : 'text-slate-600')}>
            {fmtShort(s.next_follow_date, today)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
        <div className="text-[11px] text-slate-400">每{cycleLabel(s.follow_cycle_days)}</div>
      </td>
      <td className="px-3 py-2 text-[13px]">
        <div className="flex items-center gap-1.5" title={`跟进周期 ${cycleLabel(s.follow_cycle_days)}；超过周期变黄，超过 2 倍变红`}>
          <span className={cx('h-2 w-2 rounded-full', staleCls)} />
          <span className="tabular-nums">{i.daysSinceUpdate ?? '—'} 天</span>
        </div>
        {i.lastUpdate && <div className="text-[11px] text-slate-400">{fmtDate(i.lastUpdate)}</div>}
      </td>
    </tr>
  )
}

export function StudentsPage() {
  const infos = useInfos()
  const assignees = useStore((s) => s.settings.assignees)
  const [params] = useSearchParams()
  const selected = params.get('s')
  const open = useOpenStudent()
  const [q, setQ] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fBusiness, setFBusiness] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>(
    Object.fromEntries(GROUPS.map((g) => [g.key, g.collapsed])) as Record<GroupKey, boolean>,
  )
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    let list = infos
    if (q.trim()) {
      const ids = new Set(searchStudents(infos, q, 999).map((h) => h.info.s.id))
      list = list.filter((i) => ids.has(i.s.id))
    }
    if (fAssignee) list = list.filter((i) => (fAssignee === UNASSIGNED ? !i.s.assignee : i.s.assignee === fAssignee))
    if (fStatus) list = list.filter((i) => i.s.status === fStatus)
    if (fBusiness) list = list.filter((i) => i.s.business_type === fBusiness)
    if (fPriority) list = list.filter((i) => i.s.priority === fPriority)
    return list
  }, [infos, q, fAssignee, fStatus, fBusiness, fPriority])

  const groups = useMemo(() => {
    return GROUPS.map((g) => {
      const items = filtered.filter((i) => i.group === g.key)
      if (sort)
        items.sort((a, b) => {
          const va = sortValue(a, sort.key)
          const vb = sortValue(b, sort.key)
          const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh-CN')
          return c * sort.dir
        })
      else items.sort(defaultGroupSort)
      return { ...g, items }
    })
  }, [filtered, sort])

  const filtering = !!(q || fAssignee || fStatus || fBusiness || fPriority)
  const assigneeOptions = [...new Set([...assignees, ...infos.map((i) => i.s.assignee).filter((a): a is string => !!a)])]

  const clickSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null))

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold text-slate-900">学生列表</h1>
        <span className="text-[13px] text-slate-400">
          {filtering ? `${filtered.length} / ${infos.length}` : infos.length} 人
        </span>
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> 新建学生
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
          <input
            id="list-search"
            className="input pl-8"
            placeholder="搜姓名、学校、备注内容…（按 / 聚焦）"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQ('')
                ;(e.target as HTMLInputElement).blur()
                e.stopPropagation()
              }
            }}
          />
        </div>
        <select className="input w-auto" value={fAssignee} onChange={(e) => setFAssignee(e.target.value)}>
          <option value="">全部负责人</option>
          {assigneeOptions.map((a) => (
            <option key={a}>{a}</option>
          ))}
          <option value={UNASSIGNED}>{UNASSIGNED}</option>
        </select>
        <select className="input w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">全部状态</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input w-auto" value={fBusiness} onChange={(e) => setFBusiness(e.target.value)}>
          <option value="">全部业务类型</option>
          {BUSINESS_TYPES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input w-auto" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
          <option value="">全部优先级</option>
          {PRIORITIES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {filtering && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQ('')
              setFAssignee('')
              setFStatus('')
              setFBusiness('')
              setFPriority('')
            }}
          >
            清除筛选
          </Button>
        )}
        {sort && (
          <Button size="sm" variant="ghost" onClick={() => setSort(null)}>
            恢复默认排序
          </Button>
        )}
      </div>

      <div className="card overflow-x-auto md:overflow-visible">
        <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => clickSort(c.key)}
                  className={cx(
                    'sticky top-0 z-10 cursor-pointer border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-500 backdrop-blur select-none first:rounded-tl-xl last:rounded-tr-xl hover:text-slate-800',
                    c.className,
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => {
            if (!g.items.length) return null
            const isCollapsed = collapsed[g.key] && !(filtering && g.items.length <= 10)
            return (
              <tbody key={g.key}>
                <tr>
                  <td colSpan={COLS.length} className="border-b border-slate-100 bg-white px-3 pt-3 pb-1.5">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !isCollapsed }))}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-700"
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      {g.label}
                      <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-500">{g.items.length}</span>
                    </button>
                  </td>
                </tr>
                {!isCollapsed &&
                  g.items.map((i) => <Row key={i.s.id} i={i} selected={selected === i.s.id} onOpen={() => open(i.s.id)} />)}
              </tbody>
            )
          })}
        </table>
        {!filtered.length && (
          <div className="py-10 text-center text-[13px] text-slate-400">
            {infos.length ? '没有符合条件的学生' : '还没有学生，先去「导入 Excel」吧'}
          </div>
        )}
      </div>
      {creating && <NewStudentDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
