import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BALL_STYLE, EVENT_ICON, STATUS_STYLE, UNASSIGNED } from '../lib/constants'
import { fmtAgo, fmtDate, fmtDateTime } from '../lib/dates'
import type { Ball, StudentStatus, TimelineEvent } from '../lib/types'
import type { StudentInfo } from '../lib/reminders'
import { useStudentInfo } from '../data/hooks'
import { cx, useFloating } from './ui'

export function StatusTag({ status }: { status: StudentStatus }) {
  return <span className={cx('tag', STATUS_STYLE[status])}>{status}</span>
}

export function BallTag({ ball, prefix = true }: { ball: Ball; prefix?: boolean }) {
  return (
    <span className={cx('tag', BALL_STYLE[ball])}>
      {prefix && <span className="font-normal opacity-60">球在</span>}
      {ball}
    </span>
  )
}

export function AssigneeTag({ assignee }: { assignee: string | null }) {
  return (
    <span
      className={cx(
        'tag',
        assignee ? 'bg-white text-slate-600 ring-slate-200' : 'bg-amber-50 text-amber-700 ring-amber-200',
      )}
    >
      {assignee ?? UNASSIGNED}
    </span>
  )
}

export function HighFlag() {
  return <span className="tag bg-rose-50 px-1.5 text-rose-600 ring-rose-200">高</span>
}

/** 打开学生侧边面板（URL 加 ?s=学生id，列表位置不变） */
export function useOpenStudent() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  return (id: string) => {
    if (location.pathname.startsWith('/students/') && location.pathname.split('/').length >= 3) {
      navigate(`/students/${id}`)
      return
    }
    const p = new URLSearchParams(params)
    p.set('s', id)
    setParams(p, { replace: params.has('s') })
  }
}

export function EventMini({ e, today }: { e: TimelineEvent; today?: string }) {
  void today
  return (
    <div className="flex gap-2 text-[13px] leading-snug">
      <span className="w-[4.5rem] shrink-0 text-slate-400 tabular-nums">
        {e.date_unknown ? '日期不明' : fmtDate(e.occurred_on)}
      </span>
      <span className="shrink-0">{EVENT_ICON[e.kind]}</span>
      <span className="line-clamp-3 min-w-0 whitespace-pre-wrap text-slate-700">{e.content}</span>
    </div>
  )
}

export function PreviewCard({ info }: { info: StudentInfo }) {
  const s = info.s
  return (
    <div className="w-[380px] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-900">{s.name}</span>
        {s.english_name && <span className="text-xs text-slate-400">{s.english_name}</span>}
        <StatusTag status={s.status} />
        <BallTag ball={s.ball} />
      </div>
      {info.nextTask && (
        <div className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[13px] text-amber-900">
          下一步：{info.nextTask.content}
          {info.nextTask.due_date && <span className="text-amber-700">（{fmtDate(info.nextTask.due_date)}）</span>}
        </div>
      )}
      <div className="mb-1 text-xs font-medium text-slate-500">最近 3 条记录</div>
      <div className="space-y-1.5">
        {info.recentEvents.length ? (
          info.recentEvents.map((e) => <EventMini key={e.id} e={e} />)
        ) : (
          <div className="text-[13px] text-slate-400">还没有记录</div>
        )}
      </div>
      <div className="mt-2 border-t border-slate-100 pt-1.5 text-xs text-slate-400">
        上次更新 {fmtAgo(info.daysSinceUpdate)} · 最后一条录入于{' '}
        {info.events[0] ? fmtDateTime(info.events[0].created_at) : '—'}
      </div>
    </div>
  )
}

/** 学生名字：点击打开详情面板，鼠标停留显示最近 3 条记录 */
export function StudentLink({
  id,
  className,
  children,
  preview = true,
}: {
  id: string
  className?: string
  children?: ReactNode
  preview?: boolean
}) {
  const info = useStudentInfo(id)
  const open = useOpenStudent()
  const [show, setShow] = useState(false)
  const anchor = useRef<HTMLButtonElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { floating, pos } = useFloating(anchor, show, 'right')
  if (!info) return <span className="text-slate-400">（已删除）</span>
  const enter = () => {
    if (!preview) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(true), 350)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 120)
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (timer.current) clearTimeout(timer.current)
          setShow(false)
          open(id)
        }}
        onMouseEnter={enter}
        onMouseLeave={leave}
        className={cx('text-left font-medium text-slate-900 hover:text-brand-700 hover:underline', className)}
      >
        {children ?? info.s.name}
      </button>
      {show &&
        createPortal(
          <div
            ref={floating}
            onMouseEnter={() => timer.current && clearTimeout(timer.current)}
            onMouseLeave={leave}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="animate-pop-in fixed z-[75] rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <PreviewCard info={info} />
          </div>,
          document.body,
        )}
    </>
  )
}
