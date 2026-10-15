import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, LayoutGrid, List, Plus, Search, X } from 'lucide-react'
import { BALLS, BUSINESS_TYPES, STUDENT_STATUSES, UNASSIGNED } from '../lib/constants'
import { fmtDate, fmtShort } from '../lib/dates'
import { compareCards, computeCard, LANES, type CardInfo, type Lane } from '../lib/cardInfo'
import type { StudentInfo } from '../lib/reminders'
import { searchStudents } from '../lib/search'
import { createStudent } from '../data/actions'
import { useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { StudentLink, useOpenStudent } from '../components/bits'
import {
  AppPills,
  Avatar,
  Badge,
  BAR_CLASS,
  CardActions,
  DueText,
  HealthDot,
  StaleText,
  StudentCard,
  TONE_CLASS,
} from '../components/StudentCard'
import { Button, Field, MenuItem, Modal, Popover, cx, isComposing } from '../components/ui'
import { DemoButton } from './Settings'

type SortKey = 'urgency' | 'name' | 'deadline' | 'next' | 'stale' | 'follow' | 'assignee' | 'business' | 'status' | 'ball'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'urgency', label: '紧急程度' },
  { key: 'deadline', label: '最近截止日' },
  { key: 'next', label: '下一步到期' },
  { key: 'follow', label: '下次跟进' },
  { key: 'stale', label: '最久没更新' },
  { key: 'name', label: '姓名' },
  { key: 'assignee', label: '负责人' },
  { key: 'business', label: '业务类型' },
  { key: 'status', label: '状态' },
  { key: 'ball', label: '球在谁那' },
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
        // 没有具体日期但有「DDL 待确认」的排在有日期的后面、什么都没有的前面
        return r.card.deadline?.daysLeft ?? (r.card.tbcCount ? 99998 : 99999)
      case 'next':
        return r.info.nextTask?.due_date ?? (r.info.nextTask ? '9998' : '9999')
      case 'business':
        return BUSINESS_TYPES.indexOf(r.info.s.business_type)
      case 'status':
        return STUDENT_STATUSES.indexOf(r.info.s.status)
      case 'ball':
        return BALLS.indexOf(r.info.s.ball)
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
    const s = createStudent({
      name: name.trim(),
      assignee: assignee || null,
      business_type: business,
    })
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
    // 电脑上一组太长（负责人很多）时组内换行，不把整页撑出横向滚动
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-1 md:max-w-full md:flex-wrap md:gap-y-2">
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
            {o.count !== undefined && (
              <span className={cx('text-[11px] tabular-nums', on ? 'opacity-70' : 'text-slate-400')}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** 紧凑列表「下次跟进」：到期标橙/红；休眠显示休眠到哪天 */
function FollowCell({ info, card }: { info: StudentInfo; card: CardInfo }) {
  const today = useStore((s) => s.today)
  const s = info.s
  if (info.isDormant)
    return (
      <span className="text-slate-500" title={`休眠到 ${s.dormant_until}${s.dormant_reason ? `：${s.dormant_reason}` : ''}`}>
        💤 {fmtShort(s.dormant_until, today)}
      </span>
    )
  if (card.dormancyEnded)
    return (
      <span className="font-medium text-orange-700" title="休眠已结束，该恢复跟进">
        💤 已结束
      </span>
    )
  if (card.lane === 'closed' || !s.next_follow_date) return <span className="text-slate-300">—</span>
  if (card.followDueDays !== null)
    return (
      <span
        className={cx('font-medium', card.followDueDays > 0 ? 'text-rose-600' : 'text-orange-700')}
        title={card.followDueDays === 0 ? '今天该跟进' : `跟进到期，已过 ${card.followDueDays} 天`}
      >
        🔁 {card.followDueDays === 0 ? '今天' : fmtShort(s.next_follow_date, today)}
      </span>
    )
  return <span className="text-slate-500">{fmtShort(s.next_follow_date, today)}</span>
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
            <Th k="name" className="w-[13%] rounded-tl-xl pl-4">
              姓名
            </Th>
            <Th k="next" className="w-[25%]">
              现在的状态
            </Th>
            <Th className="w-[16%]">进度</Th>
            <Th k="deadline" className="w-[20%]">
              最近截止
            </Th>
            <Th k="follow" className="w-[8%] !px-2">
              下次跟进
            </Th>
            <Th k="stale" className="w-[8%] !px-2">
              最近动态
            </Th>
            <Th k="assignee" className="w-[10%] rounded-tr-xl !px-2">
              负责人
            </Th>
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
                  <StudentLink id={info.s.id} className="min-w-0 truncate" />
                  {info.s.priority === '高' && (
                    <span className="tag shrink-0 bg-rose-500 px-1.5 text-[10px] text-on-accent ring-rose-500">高</span>
                  )}
                  {/* 位置不够时先压缩英文名，中文名尽量完整 */}
                  {info.s.english_name && <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{info.s.english_name}</span>}
                </span>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-slate-400">球在{info.s.ball}</span>
                  <span className="truncate text-slate-800" title={card.headline}>
                    {card.headline}
                  </span>
                  {card.headlineFrom === 'task' && info.nextTask?.due_date && (
                    <span className="-ml-1.5 shrink-0">
                      <DueText date={info.nextTask.due_date} />
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
                  {card.apps.length > 0 && <AppPills pills={card.apps} max={1} />}
                  {card.visas[0] && (
                    <span className="truncate text-xs text-slate-500">
                      {card.visas[0].type} 签证{' '}
                      {card.visas[0].granted ? '已获批' : `→ ${card.visas[0].steps.find((s) => s.current)?.label ?? ''}`}
                    </span>
                  )}
                  {info.isDormant && (
                    <span className="truncate text-xs text-slate-500" title={info.s.dormant_reason ?? undefined}>
                      💤 {info.s.dormant_reason || '休眠中'}
                    </span>
                  )}
                  {!card.apps.length && !card.visas.length && !info.isDormant && <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-2">
                {/* 逾期待办 / 待确认放前面，截止日徽章太长时换行，「剩 N 天」不会被截掉 */}
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {card.overdueTasks > 0 && (
                    <span title={`待办逾期 ${card.overdueTasks} 件`} className={cx('tag shrink-0 font-medium', TONE_CLASS.red)}>
                      ⚠️ 逾期 {card.overdueTasks}
                    </span>
                  )}
                  {card.tbcCount > 0 && (
                    <span title="接 offer 的截止日还不知道，记得补上" className={cx('tag shrink-0 font-medium', TONE_CLASS.yellow)}>
                      ❓ DDL 待确认
                    </span>
                  )}
                  {card.deadline && <Badge b={card.deadline} />}
                  {!card.deadline && !card.tbcCount && !card.overdueTasks && <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="border-b border-slate-100 px-2 py-2 text-xs whitespace-nowrap tabular-nums">
                <FollowCell info={info} card={card} />
              </td>
              <td className="overflow-hidden border-b border-slate-100 px-2 py-1.5 text-xs whitespace-nowrap text-slate-500">
                <span className="flex min-w-0 items-center gap-1.5" title={card.lastEvent?.date ? fmtDate(card.lastEvent.date) : undefined}>
                  <HealthDot info={info} />
                  <span className="min-w-0 truncate">{card.lastEvent?.ago ?? '—'}</span>
                </span>
                {/* 超期用文字再说一遍，不只靠圆点颜色 */}
                <div className="pl-3.5">
                  <StaleText info={info} bare />
                </div>
              </td>
              <td className="relative border-b border-slate-100 py-1.5 pr-2 pl-2">
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
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: 'urgency',
    dir: 1,
  })
  const [view, setViewState] = useState<'cards' | 'compact'>(loadView)
  // 用户手动展开/折叠过的组记在这里；没动过的按默认（已完成默认折叠）
  const [userCollapsed, setUserCollapsed] = useState<Partial<Record<Lane, boolean>>>({})
  // 搜索/筛选结果不多的组自动展开；这时手动折叠只对这一次搜索有效，换关键词或筛选就重新展开
  const [searchCollapsed, setSearchCollapsed] = useState<{ key: string; lanes: Partial<Record<Lane, boolean>> }>({
    key: '',
    lanes: {},
  })
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
    () =>
      LANES.map((l) => ({
        ...l,
        rows: sortRows(
          filtered.filter((r) => r.card.lane === l.key),
          sort.key,
          sort.dir,
        ),
      })),
    [filtered, sort],
  )

  const filtering = !!(q.trim() || fAssignee || fStatus || fBusiness || fPriority)
  const filterKey = [q.trim(), fAssignee, fStatus, fBusiness, fPriority].join('\n')
  const searchLanes = searchCollapsed.key === filterKey ? searchCollapsed.lanes : {}
  const clearAll = () => {
    setQ('')
    setFAssignee('')
    setFStatus('')
    setFBusiness('')
    setFPriority('')
  }

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
    // 底部多留一些空白，最后一张卡片的按钮不会被右下角的 ➕ 挡住
    <div className="mx-auto max-w-[1800px] p-4 pb-24 md:p-6 md:pb-24">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-xl font-bold text-slate-900">学生列表</h1>
        <span className="text-[13px] text-slate-400 tabular-nums">
          {filtering ? `${filtered.length} / ${rows.length}` : rows.length} 人
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Popover
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[13px] whitespace-nowrap text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
              >
                <span className="sr-only text-[11px] font-medium text-slate-400 sm:not-sr-only">排序</span>
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
                  {sort.key === s.key && (
                    <span className="ml-auto pl-4 text-xs text-slate-400">{sort.dir === 1 ? '↑ 再点一下反过来' : '↓'}</span>
                  )}
                </MenuItem>
              ))
            }
          </Popover>
          <div role="group" aria-label="显示方式" className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ['cards', '卡片视图', LayoutGrid],
                ['compact', '紧凑列表', List],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                aria-label={label}
                title={label}
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
          <Button variant="primary" size="sm" aria-label="新建学生" title="新建学生" onClick={() => setCreating(true)}>
            <Plus size={14} /> <span className="hidden sm:inline">新建学生</span>
          </Button>
        </div>
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
      {filtering && (
        <div className="mb-2 flex items-center gap-2 text-[13px] text-slate-500 md:hidden">
          找到 {filtered.length} 人
          <button type="button" onClick={clearAll} className="font-medium text-brand-700 hover:underline">
            清除搜索和筛选
          </button>
        </div>
      )}

      {/* 手机上左右滑动；电脑上自动换行，全部筛选都看得到 */}
      <div className="-mx-4 mb-4 flex items-center gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:gap-x-5 md:gap-y-2 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <ChipGroup
          label="负责人"
          value={fAssignee}
          onChange={setFAssignee}
          options={[
            ...assigneeOptions.map((a) => ({
              key: a,
              label: a,
              count: count((r) => r.info.s.assignee === a),
            })),
            {
              key: UNASSIGNED,
              label: UNASSIGNED,
              count: count((r) => !r.info.s.assignee),
            },
          ]}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200 md:hidden" />
        <ChipGroup
          label="状态"
          value={fStatus}
          onChange={setFStatus}
          options={STUDENT_STATUSES.map((s) => ({
            key: s,
            label: s,
            count: count((r) => r.info.s.status === s),
          }))}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200 md:hidden" />
        <ChipGroup
          label="业务"
          value={fBusiness}
          onChange={setFBusiness}
          options={BUSINESS_TYPES.map((b) => ({
            key: b,
            label: b,
            count: count((r) => r.info.s.business_type === b),
          }))}
        />
        <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200 md:hidden" />
        <ChipGroup
          label="优先级"
          value={fPriority}
          onChange={setFPriority}
          options={[
            {
              key: '高',
              label: '高',
              count: count((r) => r.info.s.priority === '高'),
            },
            { key: '普通', label: '普通' },
          ]}
        />
        {filtering && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-[13px] font-medium whitespace-nowrap text-brand-700 hover:underline"
          >
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
            const auto = filtering && lane.rows.length <= 10
            const isCollapsed = auto ? (searchLanes[lane.key] ?? false) : (userCollapsed[lane.key] ?? lane.collapsed)
            return (
              <section key={lane.key} aria-label={lane.label} className="@container">
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    auto
                      ? setSearchCollapsed({ key: filterKey, lanes: { ...searchLanes, [lane.key]: !isCollapsed } })
                      : setUserCollapsed((c) => ({ ...c, [lane.key]: !isCollapsed }))
                  }
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                  <span className="text-[15px] font-semibold text-slate-800">{lane.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-500 tabular-nums">
                    {lane.rows.length}
                  </span>
                  {lane.hint && <span className="hidden truncate text-xs text-slate-400 sm:inline">{lane.hint}</span>}
                </button>
                {!isCollapsed &&
                  (view === 'cards' ? (
                    // 按内容区宽度分列（侧边栏占掉的宽度不算）：手机 1 列、平板 2 列、电脑 3–4 列
                    <div className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-2 @[58rem]:grid-cols-3 @[82rem]:grid-cols-4">
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
