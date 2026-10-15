import type { ReactNode } from 'react'
import { Check, ChevronDown, PenLine } from 'lucide-react'
import { BALLS, STUDENT_STATUSES, cycleLabel } from '../lib/constants'
import { fmtAgo, fmtDate } from '../lib/dates'
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

const TONE_CLASS: Record<Tone, string> = {
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

const STALE_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-400', bad: 'bg-rose-500' } as const

export function AppPills({ pills, max }: { pills: AppPill[]; max?: number }) {
  const shown = max ? pills.slice(0, max) : pills
  const rest = pills.length - shown.length
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {shown.map((p) => (
        <span
          key={p.id}
          title={`${p.school}：${p.status}`}
          className={cx('tag max-w-full min-w-0 font-medium', PILL_CLASS[p.tone], p.struck && 'line-through decoration-1')}
        >
          <span className="truncate">{p.school}</span>
          <span className="shrink-0 opacity-50">·</span>
          <span className="shrink-0">{p.status}</span>
        </span>
      ))}
      {rest > 0 && (
        <span className="tag bg-slate-100 text-slate-500 ring-slate-200" title={pills.slice(shown.length).map((p) => `${p.school}：${p.status}`).join('\n')}>
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
      <div className="flex min-w-0 items-center gap-2">
        <span className="tag shrink-0 bg-violet-50 font-semibold text-violet-700 ring-violet-200">{track.type} 签证</span>
        <div className="flex items-center" aria-label={`签证进度 ${doneCount}/5，${summary}`}>
          {track.steps.map((s, i) => (
            <span key={s.key} className="flex items-center">
              {i > 0 && <span className={cx('h-0.5', labels ? 'w-5' : 'w-2.5', s.done ? 'bg-emerald-400' : 'bg-slate-200')} />}
              <span
                className={cx(
                  'block rounded-full',
                  s.done
                    ? 'h-2.5 w-2.5 bg-emerald-500'
                    : s.current
                      ? 'h-3 w-3 bg-white ring-2 ring-brand-500'
                      : 'h-2.5 w-2.5 bg-slate-200',
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

export function Badge({ b }: { b: DeadlineBadge }) {
  return (
    <span title={b.title} className={cx('tag font-medium tabular-nums', TONE_CLASS[b.tone])}>
      {b.tone === 'red' ? '⏰' : b.tone === 'orange' ? '⏳' : '📅'} {b.text}
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
  const text =
    info.stale === 'ok' ? `跟进周期（${cycle}）内` : info.stale === 'warn' ? `超过跟进周期（${cycle}）` : `超过跟进周期（${cycle}）2 倍`
  return <span title={`距上次更新 ${fmtAgo(info.daysSinceUpdate)}，${text}`} className={cx('inline-block h-2 w-2 shrink-0 rounded-full', STALE_CLASS[info.stale])} />
}

/** 「记一笔」「已检查没变化」两个按钮（点了直接生效，不打开详情） */
export function CardActions({ info, size = 'sm', iconOnly }: { info: StudentInfo; size?: 'sm' | 'md'; iconOnly?: boolean }) {
  const today = useStore((s) => s.today)
  const checkedToday = info.s.last_checked_date === today
  const cls = cx(
    'inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-500',
    iconOnly ? 'h-7 w-7 justify-center' : size === 'md' ? 'h-8 px-3 text-sm' : 'h-7 px-2 text-xs',
  )
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={cx(cls, 'bg-brand-50 text-brand-700 hover:bg-brand-100')}
        onClick={(e) => {
          e.stopPropagation()
          useStore.setState({ quick: { open: true, studentId: info.s.id } })
        }}
      >
        <PenLine size={13} /> {iconOnly ? <span className="sr-only">记一笔</span> : '记一笔'}
      </button>
      <button
        type="button"
        disabled={checkedToday}
        title={checkedToday ? '今天已经检查过' : '已检查没变化：刷新最后检查日期，跟进周期从今天重新算'}
        className={cx(cls, checkedToday ? 'cursor-default text-emerald-600' : 'text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-100')}
        onClick={(e) => {
          e.stopPropagation()
          checkStudent(info.s.id)
        }}
      >
        <Check size={13} />{' '}
        {iconOnly ? <span className="sr-only">{checkedToday ? '今天已检查' : '已检查没变化'}</span> : checkedToday ? '今天已检查' : '已检查没变化'}
      </button>
    </div>
  )
}

function Tags({ info, big }: { info: StudentInfo; big?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {info.s.priority === '高' && <span className="tag bg-rose-500 font-semibold text-on-accent ring-rose-500">高</span>}
      <span className={cx('tag bg-white text-slate-500 ring-slate-200', !big && 'hidden min-[360px]:inline-flex')}>{info.s.business_type}</span>
    </div>
  )
}

function DormantLine({ info }: { info: StudentInfo }) {
  if (!info.isDormant) return null
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
      <span>💤 休眠到 <b className="font-semibold tabular-nums">{fmtDate(info.s.dormant_until)}</b></span>
      {info.s.dormant_reason && <span className="truncate">· {info.s.dormant_reason}</span>}
    </div>
  )
}

function Alerts({ card, all }: { card: CardInfo; all?: boolean }) {
  const items: ReactNode[] = []
  if (card.deadline) items.push(<Badge key="d" b={card.deadline} />)
  if (all) card.moreDeadlines.forEach((b, i) => items.push(<Badge key={`m${i}`} b={b} />))
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
  if (!items.length) return null
  return <div className="flex flex-wrap gap-1">{items}</div>
}

// ───────────────────────── 列表卡片 ─────────────────────────

export function StudentCard({ info, card, selected }: { info: StudentInfo; card: CardInfo; selected?: boolean }) {
  const open = useOpenStudent()
  const s = info.s
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${s.name}：${card.headline}`}
      onClick={() => open(s.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault()
          open(s.id)
        }
      }}
      className={cx(
        'group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white pl-1.5 shadow-xs transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        selected ? 'border-brand-300 ring-2 ring-brand-200' : 'border-slate-200',
        card.bar === 'muted' && 'opacity-60 hover:opacity-90',
      )}
    >
      <span aria-hidden title={BAR_TITLE[card.bar]} className={cx('absolute inset-y-0 left-0 w-1.5', BAR_CLASS[card.bar])} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5 pl-3">
        {/* 第 1 行：身份 */}
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 leading-tight">
            <StudentLink id={s.id} className="text-[17px] font-semibold" />
            {s.english_name && <span className="ml-1.5 text-xs text-slate-400">{s.english_name}</span>}
          </div>
          <Tags info={info} />
        </div>
        {/* 第 2 行：现在的状态一句话 */}
        <div className="flex min-w-0 items-start gap-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-snug font-medium text-slate-800" title={card.headline}>
            {card.headline}
          </p>
          <span className={cx('tag mt-0.5 shrink-0', BALL_CLASS[s.ball])}>
            <span className="font-normal opacity-60">球在</span>
            {s.ball}
          </span>
        </div>
        {/* 第 3 行：进度 */}
        {(card.apps.length > 0 || card.visas.length > 0) && (
          <div className="flex min-w-0 flex-col gap-1.5">
            {card.apps.length > 0 && <AppPills pills={card.apps} max={3} />}
            {card.visas.slice(0, 1).map((v) => (
              <VisaDots key={v.id} track={v} />
            ))}
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
              <span className="shrink-0 text-slate-400">· {card.lastEvent.ago}</span>
            </>
          ) : (
            <span className="text-slate-400">还没有记录</span>
          )}
        </div>
      </div>
      {/* 第 6 行：负责人 + 快捷按钮 */}
      <div className="flex min-w-0 items-center gap-2 border-t border-slate-100 py-2 pr-2.5 pl-3">
        <Avatar assignee={s.assignee} />
        <span className={cx('min-w-0 flex-1 truncate text-xs', s.assignee ? 'text-slate-600' : 'text-amber-700')}>
          {s.assignee ?? '未分配'}
        </span>
        <CardActions info={info} />
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
      className={cx('relative overflow-hidden rounded-2xl border border-slate-200 bg-white pl-2 shadow-xs', card.bar === 'muted' && 'opacity-80')}
    >
      <span aria-hidden title={BAR_TITLE[card.bar]} className={cx('absolute inset-y-0 left-0 w-2', BAR_CLASS[card.bar])} />
      <div className="flex flex-col gap-3.5 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight font-bold text-slate-900">
              {s.name}
              {s.english_name && <span className="ml-2 text-base font-normal text-slate-400">{s.english_name}</span>}
            </h1>
          </div>
          <Tags info={info} big />
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 basis-64 text-lg leading-snug font-semibold text-slate-800">{card.headline}</p>
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
            <ChangeMenu value={s.status} options={STUDENT_STATUSES} onPick={(v) => setStudentStatus(s.id, v)} className={STATUS_CLASS[s.status]} label={s.status} />
          </div>
        </div>
        {(card.apps.length > 0 || card.visas.length > 0) && (
          <div className="flex flex-col gap-3">
            {card.apps.length > 0 && <AppPills pills={card.apps} />}
            {card.visas.map((v) => (
              <div key={v.id} className="max-w-md">
                <VisaDots track={v} labels />
              </div>
            ))}
          </div>
        )}
        <DormantLine info={info} />
        <Alerts card={card} all />
        <div className="flex min-w-0 items-start gap-2 text-[13px] text-slate-600">
          <span className="mt-1.5">
            <HealthDot info={info} />
          </span>
          {card.lastEvent ? (
            <p className="min-w-0 flex-1">
              <span className="whitespace-pre-wrap">{card.lastEvent.full}</span>
              <span className="ml-1.5 text-slate-400">· {card.lastEvent.ago}</span>
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
