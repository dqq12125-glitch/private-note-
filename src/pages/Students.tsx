import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, LayoutGrid, List, Plus, Search, X } from 'lucide-react'
import { BUSINESS_TYPES, STUDENT_STATUSES, UNASSIGNED } from '../lib/constants'
import { fmtShort } from '../lib/dates'
import { compareCards, computeCard, LANES, type CardInfo, type Lane } from '../lib/cardInfo'
import type { StudentInfo } from '../lib/reminders'
import { searchStudents } from '../lib/search'
import { createStudent } from '../data/actions'
import { useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { StudentLink, useOpenStudent } from '../components/bits'
import { AppPills, Avatar, Badge, BAR_CLASS, CardActions, HealthDot, StudentCard } from '../components/StudentCard'
import { Button, Field, MenuItem, Modal, Popover, cx, isComposing } from '../components/ui'
import { DemoButton } from './Settings'

type SortKey = 'urgency' | 'name' | 'deadline' | 'stale' | 'follow' | 'assignee'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'urgency', label: '紧急程度' },
  { key: 'deadline', label: '最近截止日' },
  { key: 'stale', label: '最久没更新' },
  { key: 'follow', label: '下次跟进' },
  { key: 'name', label: '姓名' },
  { key: 'assignee', label: '负责人' },
]

type Row = { info: StudentInfo; card: CardInfo }

function sortRows(rows: Row[], key: SortKey, dir: 1 | -1): Row[] {
  const val = (r: Row): string | number => {
    switch (key) {
      case 'name':
        return r.info.s.name
      case 'assignee':
        return r.info.s.assignee ?? '￿'
      case 'deadline':
        return r.card.deadline?.daysLeft ?? 99999
      case 'stale':
        return -(r.info.daysSinceUpdate ?? 0)
      case 'follow':
        return r.info.isDormant ? `z${r.info.s.dormant_until}` : (r.info.s.next_follow_date ?? '9999')
      default:
        return 0
    }
  }
  const out = [...rows]
  if (key === 'urgency') return dir === 1 ? out.sort(compareCards) : out.sort(compareCards).reverse()
  return out.sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh-CN')
    return (c || compareCards(a, b)) * dir
  })
}

// 记住「卡片 / 紧凑」的选择（只存在这个浏览器里）
function loadView(): 'cards' | 'compact' {
  try {
    return localStorage.getItem('students-view') === 'compact' ? 'compact' : 'cards'
  } catch {
    return 'cards'
  }
}
function saveView(v: 'cards' | 'compact') {
  try {
    localStorage.setItem('students-view', v)
  } catch {
    /* 存不了就算了 */
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
          <input
            autoFocus
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isComposing(e) && save()}
          />
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

/** 一组可以单选的小标签；再点一次已选中的就取消 */
function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { key: string; label: ReactNode; count?: number }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1">
      <span className="shrink-0 pr-0.5 text-[11px] font-medium text-slate-400">{label}</span>
      {options.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? '' : o.key)}
            className={cx(
              'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] whitespace-nowrap ring-1 transition-colors ring-inset',
              on ? 'bg-inverse font-medium text-on-inverse ring-inverse' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cx('text-[11px] tabular-nums', on ? 'opacity-70' : 'text-slate-400')}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

function CompactTable({
  rows,
  selected,
  sort,
  onSort,
}: {
  rows: Row[]
  selected: string | null
  sort: { key: SortKey; dir: 1 | -1 }
  onSort: (k: SortKey) => void
}) {
  const today = useStore((s) => s.today)
  const open = useOpenStudent()
  const Th = ({ k, children, className }: { k?: SortKey; children: ReactNode; className?: string }) => (
    <th
      onClick={k ? () => onSort(k) : undefined}
      className={cx(
        'sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap text-slate-500 backdrop-blur',
        k && 'cursor-pointer select-none hover:text-slate-800',
        className,
      )}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {k && sort.key === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  )
  return (
    <div className="card overflow-x-auto md:overflow-visible">
      <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <Th k="name" className="w-[15%] rounded-tl-xl pl-4">姓名</Th>
            <Th className="w-[30%]">现在的状态</Th>
            <Th className="w-[19%]">进度</Th>
            <Th k="deadline" className="w-[16%]">最近截止</Th>
            <Th k="stale" className="w-[8%]">最近动态</Th>
            <Th k="assignee" className="w-[12%] rounded-tr-xl">负责人</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ info, card }) => (
            <tr
              key={info.s.id}
              onClick={() => open(info.s.id)}
              className={cx(
                'group cursor-pointer transition-colors',
                selected === info.s.id ? 'bg-brand-50' : 'hover:bg-slate-50',
                card.bar === 'muted' && 'opacity-60',
              )}
            >
              <td className="relative truncate border-b border-slate-100 py-2 pr-2 pl-4">
                <span aria-hidden className={cx('absolute inset-y-1.5 left-1.5 w-1 rounded-full', BAR_CLASS[card.bar])} />
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <StudentLink id={info.s.id} className="truncate" />
                  {info.s.priority === '高' && <span className="tag shrink-0 bg-rose-500 px-1.5 text-[10px] text-on-accent ring-rose-500">高</span>}
                  {info.s.english_name && <span className="truncate text-xs text-slate-400">{info.s.english_name}</span>}
                </span>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-slate-400">球在{info.s.ball}</span>
                  <span className="truncate text-slate-800" title={card.headline}>
                    {card.headline}
                  </span>
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                  {card.apps.length > 0 && <AppPills pills={card.apps} max={1} />}
                  {card.visas[0] && (
                    <span className="truncate text-xs text-slate-500">
                      {card.visas[0].type} 签证 {card.visas[0].granted ? '已获批' : `→ ${card.visas[0].steps.find((s) => s.current)?.label ?? ''}`}
                    </span>
                  )}
                  {info.isDormant && <span className="truncate text-xs text-slate-500">💤 到 {fmtShort(info.s.dormant_until, today)}</span>}
                  {!card.apps.length && !card.visas.length && !info.isDormant && <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                  {card.deadline && <Badge b={card.deadline} />}
                  {card.tbcCount > 0 && <span title="offer DDL 待确认" className="tag bg-amber-50 text-amber-800 ring-amber-200">❓ 待确认</span>}
                  {card.overdueTasks > 0 && <span title={`待办逾期 ${card.overdueTasks} 件`} className="tag bg-rose-50 text-rose-700 ring-rose-200">⚠️ {card.overdueTasks}</span>}
                  {!card.deadline && !card.tbcCount && !card.overdueTasks && <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-2 text-xs whitespace-nowrap text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <HealthDot info={info} />
                  {card.lastEvent?.ago ?? '—'}
                </span>
              </td>
              <td className="relative border-b border-slate-100 py-1.5 pr-2 pl-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Avatar assignee={info.s.assignee} />
                  <span className={cx('min-w-0 flex-1 truncate text-xs', info.s.assignee ? 'text-slate-600' : 'text-amber-700')}>
                    {info.s.assignee ?? '未分配'}
                  </span>
                </div>
                {/* 鼠标移上去才出现：记一笔 / 已检查没变化（盖在负责人上面，不占位置） */}
                <span className="absolute inset-y-0 right-1 hidden items-center rounded-md bg-white pl-1 group-focus-within:flex group-hover:flex">
                  <CardActions info={info} iconOnly />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StudentsPage() {
  const infos = useInfos()
  const today = useStore((s) => s.today)
  const assignees = useStore((s) => s.settings.assignees)
  const [params] = useSearchParams()
  const selected = params.get('s')
  const [q, setQ] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fBusiness, setFBusiness] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'urgency', dir: 1 })
  const [view, setViewState] = useState<'cards' | 'compact'>(loadView)
  const [collapsed, setCollapsed] = useState<Record<Lane, boolean>>(
    Object.fromEntries(LANES.map((l) => [l.key, l.collapsed])) as Record<Lane, boolean>,
  )
  const [creating, setCreating] = useState(false)
  const setView = (v: 'cards' | 'compact') => {
    setViewState(v)
    saveView(v)
  }

  const rows: Row[] = useMemo(() => infos.map((info) => ({ info, card: computeCard(info, today) })), [infos, today])

  const filtered = useMemo(() => {
    let list = rows
    if (q.trim()) {
      const ids = new Set(searchStudents(infos, q, 9999).map((h) => h.info.s.id))
      list = list.filter((r) => ids.has(r.info.s.id))
    }
    if (fAssignee) list = list.filter((r) => (fAssignee === UNASSIGNED ? !r.info.s.assignee : r.info.s.assignee === fAssignee))
    if (fStatus) list = list.filter((r) => r.info.s.status === fStatus)
    if (fBusiness) list = list.filter((r) => r.info.s.business_type === fBusiness)
    if (fPriority) list = list.filter((r) => r.info.s.priority === fPriority)
    return list
  }, [rows, infos, q, fAssignee, fStatus, fBusiness, fPriority])

  const lanes = useMemo(
    () => LANES.map((l) => ({ ...l, rows: sortRows(filtered.filter((r) => r.card.lane === l.key), sort.key, sort.dir) })),
    [filtered, sort],
  )

  const filtering = !!(q.trim() || fAssignee || fStatus || fBusiness || fPriority)
  const clearAll = () => {
    setQ('')
    setFAssignee('')
    setFStatus('')
    setFBusiness('')
    setFPriority('')
  }

  // 搜索/筛选时，结果不多的折叠组自动展开
  useEffect(() => {
    if (!filtering) setCollapsed(Object.fromEntries(LANES.map((l) => [l.key, l.collapsed])) as Record<Lane, boolean>)
  }, [filtering])

  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length
  const assigneeOptions = [...new Set([...assignees, ...rows.map((r) => r.info.s.assignee).filter((a): a is string => !!a)])]
  const onSortHeader = (k: SortKey) =>
    setSort((s) => (s.key !== k ? { key: k, dir: 1 } : s.dir === 1 ? { key: k, dir: -1 } : { key: 'urgency', dir: 1 }))

  if (!rows.length)
    return (
      <div className="mx-auto max-w-xl p-6 pt-16 text-center">
        <div className="text-4xl">🗂️</div>
        <h1 className="mt-3 text-xl font-bold text-slate-900">还没有学生</h1>
        <p className="mt-1 text-[14px] text-slate-500">把现在的 Excel 导进来，或者先新建一个学生。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/import">
            <Button variant="primary">导入 Excel</Button>
          </Link>
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} /> 新建学生
          </Button>
          <DemoButton />
        </div>
        {creating && <NewStudentDialog onClose={() => setCreating(false)} />}
      </div>
    )

  return (
    <div className="mx-auto max-w-[1800px] p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-xl font-bold text-slate-900">学生列表</h1>
        <span className="text-[13px] text-slate-400 tabular-nums">{filtering ? `${filtered.length} / ${rows.length}` : rows.length} 人</span>
        <div className="flex-1" />
        <Popover
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[13px] whitespace-nowrap text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
            >
              <span className="text-[11px] font-medium text-slate-400">排序</span>
              {SORTS.find((s) => s.key === sort.key)?.label}
              {sort.dir === -1 && <ArrowDown size={12} />}
              <ChevronDown size={13} className="text-slate-400" />
            </button>
          )}
        >
          {(close) =>
            SORTS.map((s) => (
              <MenuItem
                key={s.key}
                onClick={() => {
                  close()
                  setSort((cur) => (cur.key === s.key ? { key: s.key, dir: (cur.dir * -1) as 1 | -1 } : { key: s.key, dir: 1 }))
                }}
              >
                {s.label}
                {sort.key === s.key && <span className="ml-auto pl-4 text-xs text-slate-400">{sort.dir === 1 ? '↑ 再点一下反过来' : '↓'}</span>}
              </MenuItem>
            ))
          }
        </Popover>
        <div role="radiogroup" aria-label="显示方式" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {(
            [
              ['cards', '卡片视图', LayoutGrid],
              ['compact', '紧凑列表', List],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={view === k}
              onClick={() => setView(k)}
              className={cx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-medium',
                view === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> <span className="hidden sm:inline">新建学生</span>
        </Button>
      </div>

      <div className="relative mb-2">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          id="list-search"
          className="input h-10 !rounded-xl !pr-9 !pl-9 text-[14px]"
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
        {q && (
          <button
            type="button"
            title="清空搜索"
            onClick={() => setQ('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="-mx-4 mb-4 flex items-center gap-3 overflow-x-auto px-4 pb-1 md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <ChipGroup
          label="负责人"
          value={fAssignee}
          onChange={setFAssignee}
          options={[
            ...assigneeOptions.map((a) => ({ key: a, label: a, count: count((r) => r.info.s.assignee === a) })),
            { key: UNASSIGNED, label: UNASSIGNED, count: count((r) => !r.info.s.assignee) },
          ]}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200" />
        <ChipGroup
          label="状态"
          value={fStatus}
          onChange={setFStatus}
          options={STUDENT_STATUSES.map((s) => ({ key: s, label: s, count: count((r) => r.info.s.status === s) }))}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200" />
        <ChipGroup
          label="业务"
          value={fBusiness}
          onChange={setFBusiness}
          options={BUSINESS_TYPES.map((b) => ({ key: b, label: b, count: count((r) => r.info.s.business_type === b) }))}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200" />
        <ChipGroup
          label="优先级"
          value={fPriority}
          onChange={setFPriority}
          options={[{ key: '高', label: '高', count: count((r) => r.info.s.priority === '高') }, { key: '普通', label: '普通' }]}
        />
        {filtering && (
          <button type="button" onClick={clearAll} className="shrink-0 text-[13px] whitespace-nowrap text-brand-600 hover:underline">
            清除筛选
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <div className="text-3xl">🔍</div>
          <div className="font-medium text-slate-800">{q.trim() ? `没有找到「${q.trim()}」` : '没有符合筛选条件的学生'}</div>
          <div className="text-[13px] text-slate-500">可以换个关键词，或者放宽筛选条件。</div>
          <Button size="sm" className="mt-1" onClick={clearAll}>
            清除搜索和筛选
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {lanes.map((lane) => {
            if (!lane.rows.length) return null
            const isCollapsed = collapsed[lane.key] && !(filtering && lane.rows.length <= 10)
            return (
              <section key={lane.key} aria-label={lane.label}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => setCollapsed((c) => ({ ...c, [lane.key]: !isCollapsed }))}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  <span className="text-[15px] font-semibold text-slate-800">{lane.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-500 tabular-nums">{lane.rows.length}</span>
                  {lane.hint && <span className="hidden truncate text-xs text-slate-400 sm:inline">{lane.hint}</span>}
                </button>
                {!isCollapsed &&
                  (view === 'cards' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {lane.rows.map((r) => (
                        <StudentCard key={r.info.s.id} info={r.info} card={r.card} selected={selected === r.info.s.id} />
                      ))}
                    </div>
                  ) : (
                    <CompactTable rows={lane.rows} selected={selected} sort={sort} onSort={onSortHeader} />
                  ))}
              </section>
            )
          })}
        </div>
      )}
      {creating && <NewStudentDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
