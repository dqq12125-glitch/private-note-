import type { ReactNode } from 'react'
import { Check, ChevronDown, PenLine } from 'lucide-react'
import { BALLS, STUDENT_STATUSES, cycleLabel } from '../lib/constants'
import { diffDays, fmtAgo, fmtDate, fmtShort } from '../lib/dates'
import {
  avatarHue,
  avatarText,
  type AppPill,
  type Bar,
  type CardInfo,
  type DeadlineBadge,
  type PillTone,
  type Tone,
  type VisaTrack,
} from '../lib/cardInfo'
import type { StudentInfo } from '../lib/reminders'
import type { Ball, StudentStatus } from '../lib/types'
import { checkStudent, setBall, setStudentStatus } from '../data/actions'
import { useStore } from '../data/store'
import { StudentLink, useOpenStudent } from './bits'
import { MenuItem, Popover, cx } from './ui'

// ───────────────────────── 小零件 ─────────────────────────

export const BAR_CLASS: Record<Bar, string> = {
  red: 'bg-rose-500',
  orange: 'bg-orange-400',
  blue: 'bg-sky-500',
  gray: 'bg-slate-300',
  green: 'bg-emerald-500',
  muted: 'bg-slate-200',
}

const BAR_TITLE: Record<Bar, string> = {
  red: '需要我处理（有逾期或很快到期）',
  orange: '需要我处理',
  blue: '等学生 / 学校 / 签证局',
  gray: '休眠中',
  green: '已完成',
  muted: '暂停不跟进',
}

const PILL_CLASS: Record<PillTone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-rose-50 text-rose-600 ring-rose-200',
}

export const TONE_CLASS: Record<Tone, string> = {
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const BALL_CLASS: Record<Ball, string> = {
  我们: 'bg-orange-50 text-orange-700 ring-orange-200',
  学生: 'bg-sky-50 text-sky-700 ring-sky-200',
  学校: 'bg-sky-50 text-sky-700 ring-sky-200',
  签证局: 'bg-violet-50 text-violet-700 ring-violet-200',
}

const STALE_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-400', bad: 'bg-rose-500', off: 'bg-slate-300' } as const

/** 已完成 / 暂停 / 休眠中的学生不需要跟进：圆点灰色，不提示超期 */
function staleLevel(info: StudentInfo): keyof typeof STALE_CLASS {
  return info.active && !info.isDormant ? info.stale : 'off'
}

export function AppPills({ pills, max, wrap }: { pills: AppPill[]; max?: number; wrap?: boolean }) {
  const shown = max ? pills.slice(0, max) : pills
  const rest = pills.length - shown.length
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {shown.map((p) => (
        <span
          key={p.id}
          title={`${p.school}：${p.status}`}
          className={cx(
            'tag max-w-full min-w-0 font-medium',
            wrap && 'rounded-xl whitespace-normal',
            PILL_CLASS[p.tone],
            p.struck && 'line-through decoration-1',
          )}
        >
          <span className={wrap ? 'min-w-0 break-words' : 'truncate'}>{p.school}</span>
          <span className="shrink-0 opacity-50">·</span>
          <span className="shrink-0">{p.status}</span>
        </span>
      ))}
      {rest > 0 && (
        <span
          className="tag bg-slate-100 text-slate-500 ring-slate-200"
          title={pills
            .slice(shown.length)
            .map((p) => `${p.school}：${p.status}`)
            .join('\n')}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

/** 签证进度：材料齐全 → 已付款 → 已递交 → 体检完成 → 已获批 */
export function VisaDots({ track, labels }: { track: VisaTrack; labels?: boolean }) {
  const current = track.steps.find((s) => s.current)
  const doneCount = track.steps.filter((s) => s.done).length
  const summary = track.granted ? '已获批' : current ? `→ ${current.label}` : '进行中'
  return (
    <div
      className={cx('flex min-w-0 gap-2', labels ? 'flex-col items-stretch' : 'items-center')}
      title={track.steps.map((s) => `${s.done ? '✓' : '○'} ${s.label}${s.date ? `（${fmtDate(s.date)}）` : ''}`).join('\n')}
    >
      {/* 卡片窄时「→ 下一步」换到下一行，不被挤成省略号 */}
      <div className={cx('flex min-w-0 items-center gap-2', !labels && 'flex-wrap gap-y-1 @max-[17rem]:gap-x-1.5')}>
        <span className="tag shrink-0 bg-violet-50 font-semibold text-violet-700 ring-violet-200">{track.type} 签证</span>
        <div className="flex items-center" aria-label={`签证进度 ${doneCount}/5，${summary}`}>
          {track.steps.map((s, i) => (
            <span key={s.key} className="flex items-center">
              {i > 0 && (
                <span className={cx('h-0.5', labels ? 'w-5' : 'w-2.5 @max-[17rem]:w-1', s.done ? 'bg-emerald-400' : 'bg-slate-200')} />
              )}
              <span
                className={cx(
                  'block rounded-full',
                  s.done ? 'h-2.5 w-2.5 bg-emerald-500' : s.current ? 'h-3 w-3 bg-white ring-2 ring-brand-500' : 'h-2.5 w-2.5 bg-slate-200',
                )}
              />
            </span>
          ))}
        </div>
        {!labels && <span className="truncate text-xs text-slate-500">{summary}</span>}
      </div>
      {labels && (
        <div className="grid grid-cols-5 gap-1 text-center text-[11px] leading-tight">
          {track.steps.map((s) => (
            <div key={s.key} className={cx(s.done ? 'text-slate-700' : s.current ? 'font-semibold text-brand-700' : 'text-slate-400')}>
              {s.label}
              <div className="text-[10px] text-slate-400 tabular-nums">{s.date ? fmtDate(s.date).slice(0, 5) : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 截止日徽章：学校名太长时只截断前面的名称，「剩 N 天 / 已过 N 天」始终完整显示 */
export function Badge({ b, wrap }: { b: DeadlineBadge; wrap?: boolean }) {
  return (
    <span
      title={b.title}
      className={cx('tag max-w-full min-w-0 font-medium tabular-nums', wrap && 'rounded-xl whitespace-normal', TONE_CLASS[b.tone])}
    >
      <span aria-hidden className="shrink-0">
        {b.tone === 'red' ? '⏰' : b.tone === 'orange' ? '⏳' : '📅'}
      </span>
      <span className={wrap ? 'min-w-0 break-words' : 'min-w-0 truncate'}>{b.label}</span>
      <span className="shrink-0">· {b.when}</span>
    </span>
  )
}

export function Avatar({ assignee, size = 'sm' }: { assignee: string | null; size?: 'sm' | 'md' }) {
  const hue = avatarHue(assignee)
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-on-accent',
        size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]',
      )}
      style={{ background: assignee ? `oklch(62% 0.13 ${hue})` : 'oklch(72% 0.14 70)' }}
    >
      {avatarText(assignee)}
    </span>
  )
}

export function HealthDot({ info }: { info: StudentInfo }) {
  const cycle = cycleLabel(info.s.follow_cycle_days)
  const level = staleLevel(info)
  const text =
    level === 'off'
      ? `${info.isDormant ? '休眠中' : info.s.status}，不需要跟进`
      : level === 'ok'
        ? `跟进周期（${cycle}）内`
        : level === 'warn'
          ? `超过跟进周期（${cycle}）`
          : `超过跟进周期（${cycle}）2 倍`
  const label = `距上次更新 ${fmtAgo(info.daysSinceUpdate)}，${text}`
  return (
    <span role="img" aria-label={label} title={label} className={cx('inline-block h-2 w-2 shrink-0 rounded-full', STALE_CLASS[level])} />
  )
}

/** 跟进超期的文字提示（不只靠圆点颜色） */
export function StaleText({ info, bare }: { info: StudentInfo; bare?: boolean }) {
  const level = staleLevel(info)
  if (level === 'ok' || level === 'off') return null
  return (
    <span className={cx('shrink-0 font-medium', level === 'bad' ? 'text-rose-600' : 'text-amber-700')}>
      {bare ? '' : '· '}
      {level === 'bad' ? '超期 2 倍' : '超期'}
    </span>
  )
}

/** 「现在的状态」是待办时，显示这件事的截止日（排序「下一步到期」用的就是它） */
export function DueText({ date }: { date: string }) {
  const today = useStore((s) => s.today)
  const d = diffDays(date, today)
  return (
    <span
      title={`截止 ${fmtDate(date)}`}
      className={cx(
        'ml-1.5 inline-block text-xs font-medium whitespace-nowrap tabular-nums',
        d < 0 ? 'text-rose-600' : d === 0 ? 'text-orange-700' : 'text-slate-400',
      )}
    >
      {d < 0 ? `逾期 ${-d} 天` : d === 0 ? '今天' : d === 1 ? '明天' : `${fmtShort(date, today)} 截止`}
    </span>
  )
}

/** 「记一笔」「已检查没变化」两个按钮（点了直接生效，不打开详情） */
export function CardActions({
  info,
  size = 'sm',
  iconOnly,
  adaptive,
}: {
  info: StudentInfo
  size?: 'sm' | 'md'
  iconOnly?: boolean
  /** 卡片很窄时（平板两列）按钮只显示图标，把位置留给负责人名字 */
  adaptive?: boolean
}) {
  const labelCls = iconOnly ? 'sr-only' : adaptive ? '@max-[19rem]:sr-only' : undefined
  const today = useStore((s) => s.today)
  const checkedToday = info.s.last_checked_date === today
  const cls = cx(
    'inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-500',
    iconOnly
      ? 'h-7 w-7 justify-center'
      : size === 'md'
        ? 'h-8 px-3 text-sm'
        : 'h-7 px-2 text-xs @max-[19rem]:min-w-7 @max-[19rem]:justify-center @max-[19rem]:px-1.5',
  )
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        title="记一笔：快速记录这个学生的进展"
        className={cx(cls, 'bg-brand-50 text-brand-700 hover:bg-brand-100')}
        onClick={(e) => {
          e.stopPropagation()
          useStore.setState({ quick: { open: true, studentId: info.s.id } })
        }}
      >
        <PenLine size={13} /> <span className={labelCls}>记一笔</span>
      </button>
      <button
        type="button"
        disabled={checkedToday}
        title={checkedToday ? '今天已经检查过' : '已检查没变化：刷新最后检查日期，跟进周期从今天重新算'}
        className={cx(
          cls,
          checkedToday ? 'cursor-default text-emerald-600' : 'text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-100',
        )}
        onClick={(e) => {
          e.stopPropagation()
          checkStudent(info.s.id)
        }}
      >
        <Check size={13} /> <span className={labelCls}>{checkedToday ? '今天已检查' : '已检查没变化'}</span>
      </button>
    </div>
  )
}

function Tags({ info }: { info: StudentInfo }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {info.s.priority === '高' && <span className="tag bg-rose-500 font-semibold text-on-accent ring-rose-500">高</span>}
      <span className="tag bg-white text-slate-500 ring-slate-200">{info.s.business_type}</span>
    </div>
  )
}

function DormantLine({ info, full }: { info: StudentInfo; full?: boolean }) {
  if (!info.isDormant) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
      <span className="shrink-0">
        💤 休眠到 <b className="font-semibold tabular-nums">{fmtDate(info.s.dormant_until)}</b>
      </span>
      {info.s.dormant_reason && (
        <span className={cx('min-w-0 break-words', !full && 'line-clamp-2')} title={info.s.dormant_reason}>
          · {info.s.dormant_reason}
        </span>
      )}
    </div>
  )
}

function Alerts({ card, all }: { card: CardInfo; all?: boolean }) {
  const items: ReactNode[] = []
  if (card.deadline) items.push(<Badge key="d" b={card.deadline} wrap={all} />)
  if (all) card.moreDeadlines.forEach((b, i) => items.push(<Badge key={`m${i}`} b={b} wrap />))
  if (card.tbcCount)
    items.push(
      <span key="t" className={cx('tag font-medium', TONE_CLASS.yellow)} title="接 offer 的截止日还不知道，记得补上">
        ❓ DDL 待确认{card.tbcCount > 1 ? ` ×${card.tbcCount}` : ''}
      </span>,
    )
  if (card.overdueTasks)
    items.push(
      <span key="o" className={cx('tag font-medium', TONE_CLASS.red)}>
        ⚠️ 待办逾期 {card.overdueTasks} 件
      </span>,
    )
  if (card.followDueDays !== null)
    items.push(
      <span key="f" className={cx('tag font-medium', TONE_CLASS.orange)} title="下次跟进日期已到">
        🔁 {card.followDueDays === 0 ? '今天该跟进' : `跟进到期 · 已过 ${card.followDueDays} 天`}
      </span>,
    )
  if (card.dormancyEnded)
    items.push(
      <span key="z" className={cx('tag font-medium', TONE_CLASS.orange)}>
        💤 休眠已结束，该恢复跟进
      </span>,
    )
  if (!items.length) return null
  return <div className="flex flex-wrap gap-1">{items}</div>
}

// ───────────────────────── 列表卡片 ─────────────────────────

export function StudentCard({ info, card, selected }: { info: StudentInfo; card: CardInfo; selected?: boolean }) {
  const open = useOpenStudent()
  const s = info.s
  return (
    // 整张卡片点了打开详情；键盘用户用姓名按钮打开（卡片里不再嵌套按钮语义）
    <article
      onClick={() => open(s.id)}
      className={cx(
        'group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white pl-1.5 shadow-xs transition-[box-shadow,border-color] @container hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300',
        selected ? 'border-brand-300 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
        card.bar === 'muted' && 'opacity-60 hover:opacity-90',
      )}
    >
      <span aria-hidden title={BAR_TITLE[card.bar]} className={cx('absolute inset-y-0 left-0 w-1.5', BAR_CLASS[card.bar])} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5 pl-3">
        {/* 第 1 行：身份 */}
        {/* 卡片窄时标签换到姓名下面，不藏起来 */}
        <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
          <div className="min-w-0 flex-[1_1_6rem] leading-tight">
            <StudentLink id={s.id} className="text-[17px] font-semibold" />
            {s.english_name && <span className="ml-1.5 text-xs text-slate-400">{s.english_name}</span>}
          </div>
          <Tags info={info} />
        </div>
        {/* 第 2 行：现在的状态一句话 */}
        <div className="flex min-w-0 items-start gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug font-medium text-slate-800" title={card.headline}>
            {card.headline}
            {card.headlineFrom === 'task' && info.nextTask?.due_date && <DueText date={info.nextTask.due_date} />}
          </p>
          {card.lane !== 'closed' && (
            <span className={cx('tag mt-0.5 shrink-0', BALL_CLASS[s.ball])}>
              <span className="font-normal opacity-60">球在</span>
              {s.ball}
            </span>
          )}
        </div>
        {/* 第 3 行：进度 */}
        {(card.apps.length > 0 || card.visas.length > 0) && (
          <div className="flex min-w-0 flex-col gap-1.5">
            {card.apps.length > 0 && <AppPills pills={card.apps} max={3} />}
            {card.visas[0] && (
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <VisaDots track={card.visas[0]} />
                </div>
                {card.visas.length > 1 && (
                  <span
                    className="tag shrink-0 bg-slate-100 text-slate-500 ring-slate-200"
                    title={card.visas
                      .slice(1)
                      .map((v) => `${v.type} 签证`)
                      .join('、')}
                  >
                    +{card.visas.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {/* 第 4 行：倒计时 / 休眠 */}
        <DormantLine info={info} />
        <Alerts card={card} />
        {/* 第 5 行：最近动态 */}
        <div className="mt-auto flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <HealthDot info={info} />
          {card.lastEvent ? (
            <>
              <span className="min-w-0 truncate" title={card.lastEvent.full}>
                {card.lastEvent.text}
              </span>
              <span className="shrink-0 text-slate-400" title={card.lastEvent.date ? fmtDate(card.lastEvent.date) : undefined}>
                · {card.lastEvent.ago}
              </span>
              <StaleText info={info} />
            </>
          ) : (
            <span className="text-slate-400">还没有记录</span>
          )}
        </div>
      </div>
      {/* 第 6 行：负责人 + 快捷按钮 */}
      <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 py-2 pr-2.5 pl-3">
        <Avatar assignee={s.assignee} />
        <span
          className={cx('min-w-[3rem] flex-1 truncate text-xs', s.assignee ? 'text-slate-600' : 'text-amber-700')}
          title={s.assignee ?? '未分配'}
        >
          {s.assignee ?? '未分配'}
        </span>
        <CardActions info={info} adaptive />
      </div>
    </article>
  )
}

// ───────────────────────── 详情页顶部的大号概要卡片 ─────────────────────────

function ChangeMenu<T extends string>({
  value,
  options,
  onPick,
  className,
  label,
}: {
  value: T
  options: readonly T[]
  onPick: (v: T) => void
  className: string
  label: ReactNode
}) {
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className={cx('tag cursor-pointer gap-0.5', className)}>
          {label}
          <ChevronDown size={12} className="opacity-50" />
        </button>
      )}
    >
      {(close) =>
        options.map((o) => (
          <MenuItem
            key={o}
            onClick={() => {
              close()
              onPick(o)
            }}
          >
            {o}
            {o === value && <span className="ml-auto pl-4 text-xs text-slate-400">当前</span>}
          </MenuItem>
        ))
      }
    </Popover>
  )
}

const STATUS_CLASS: Record<StudentStatus, string> = {
  未开始: 'bg-slate-100 text-slate-600 ring-slate-200',
  进行中: 'bg-blue-50 text-blue-700 ring-blue-200',
  已完成: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  暂停不跟进: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
}

export function StudentSummary({ info, card, actions }: { info: StudentInfo; card: CardInfo; actions?: ReactNode }) {
  const s = info.s
  return (
    <section
      className={cx(
        'relative overflow-hidden rounded-2xl border border-slate-200 bg-white pl-2 shadow-xs',
        card.bar === 'muted' && 'opacity-80',
      )}
    >
      <span aria-hidden title={BAR_TITLE[card.bar]} className={cx('absolute inset-y-0 left-0 w-2', BAR_CLASS[card.bar])} />
      <div className="flex flex-col gap-3.5 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 grow basis-48">
            <h1 className="text-2xl leading-tight font-bold text-slate-900">
              {s.name}
              {s.english_name && <span className="ml-2 text-base font-normal text-slate-400">{s.english_name}</span>}
            </h1>
          </div>
          <Tags info={info} />
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 basis-64 text-lg leading-snug font-semibold text-slate-800">
            {card.headline}
            {card.headlineFrom === 'task' && info.nextTask?.due_date && <DueText date={info.nextTask.due_date} />}
          </p>
          <div className="flex items-center gap-1">
            <ChangeMenu
              value={s.ball}
              options={BALLS}
              onPick={(b) => setBall(s.id, b)}
              className={BALL_CLASS[s.ball]}
              label={
                <>
                  <span className="font-normal opacity-60">球在</span>
                  {s.ball}
                </>
              }
            />
            <ChangeMenu
              value={s.status}
              options={STUDENT_STATUSES}
              onPick={(v) => setStudentStatus(s.id, v)}
              className={STATUS_CLASS[s.status]}
              label={s.status}
            />
          </div>
        </div>
        {(card.apps.length > 0 || card.visas.length > 0) && (
          <div className="flex flex-col gap-3">
            {card.apps.length > 0 && <AppPills pills={card.apps} wrap />}
            {card.visas.map((v) => (
              <div key={v.id} className="max-w-md">
                <VisaDots track={v} labels />
              </div>
            ))}
          </div>
        )}
        <DormantLine info={info} full />
        <Alerts card={card} all />
        <div className="flex min-w-0 items-start gap-2 text-[13px] text-slate-600">
          <span className="mt-1.5">
            <HealthDot info={info} />
          </span>
          {card.lastEvent ? (
            <p className="min-w-0 flex-1">
              <span className="whitespace-pre-wrap">{card.lastEvent.full}</span>
              <span className="ml-1.5 text-slate-400">· {card.lastEvent.ago}</span> <StaleText info={info} />
            </p>
          ) : (
            <span className="text-slate-400">还没有记录</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Avatar assignee={s.assignee} size="md" />
          <div className="min-w-[9rem] flex-1 text-[13px] leading-tight">
            <div className={s.assignee ? 'font-medium text-slate-700' : 'font-medium text-amber-700'}>{s.assignee ?? '未分配'}</div>
            <div className="text-xs text-slate-400">
              跟进周期 {cycleLabel(s.follow_cycle_days)}
              {info.active && s.next_follow_date && !info.isDormant && <> · 下次跟进 {fmtDate(s.next_follow_date)}</>}
            </div>
          </div>
          <CardActions info={info} size="md" />
        </div>
      </div>
    </section>
  )
}
