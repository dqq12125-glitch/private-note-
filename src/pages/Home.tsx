import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, PenLine, PlayCircle } from 'lucide-react'
import { endOfWeek, fmtAgo, fmtDate, fmtShort, fmtWeekday } from '../lib/dates'
import {
  offerCountdown,
  offerUrgency,
  recordStreak,
  TASK_BUCKETS,
  taskBucket,
  todayQueue,
  upcomingKeyDeadlines,
  type Deadline,
  type StudentInfo,
} from '../lib/reminders'
import type { Task } from '../lib/types'
import { checkStudent, completeTask, endDormancy, postponeTask, setOfferDdl, snoozeStudent, snoozeTbc } from '../data/actions'
import { useInfoMap, useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { StudentLink } from '../components/bits'
import { AckButton } from '../components/deadline'
import { OverdueOfferPrompt, RemindButton } from '../components/detail/Applications'
import { PostponeMenu } from '../components/detail/Tasks'
import { Button, DateField, DaysLeft, Empty, SectionTitle, cx } from '../components/ui'
import { DemoButton } from './Settings'

const DOT = { red: '🔴', orange: '🟠', yellow: '🟡', none: '⚪' }

function OfferRow({ d }: { d: Deadline }) {
  const apps = useStore((s) => s.applications)
  const app = apps.find((a) => a.id === d.ref.id)!
  const [fill, setFill] = useState(false)
  const today = useStore((s) => s.today)
  if (!app) return null
  const overdue = d.daysLeft !== null && d.daysLeft < 0
  const u = d.kind === 'offer_tbc' ? 'orange' : offerUrgency(d.daysLeft)
  return (
    <div className={cx('rounded-lg px-2.5 py-2', overdue ? 'bg-rose-50/70' : d.reminderDue ? 'bg-amber-50/60' : 'hover:bg-slate-50')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-5 text-center">{DOT[u]}</span>
        <StudentLink id={d.student_id} className="min-w-[4.5rem]" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">
          <b className="font-semibold text-slate-800">{app.school}</b>
          {d.sub && <span className="text-slate-500"> · {d.sub}</span>}
          <span className="ml-1 text-xs text-slate-400">{app.status}</span>
        </span>
        {d.kind === 'offer_tbc' ? (
          <span className="inline-flex items-center gap-1.5">
            <DaysLeft days={null} tbc />
            {fill ? (
              <DateField
                value={null}
                autoFocus
                size="sm"
                className="w-36"
                onChange={(v) => {
                  if (v) {
                    setOfferDdl(app.id, v)
                    setFill(false)
                  }
                }}
              />
            ) : (
              <>
                <Button size="xs" variant="soft" onClick={() => setFill(true)}>
                  补上 DDL
                </Button>
                {d.reminderDue && (
                  <Button size="xs" variant="ghost" onClick={() => snoozeTbc(app.id)}>
                    3 天后再提醒
                  </Button>
                )}
              </>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="text-[13px] font-medium tabular-nums">{fmtDate(d.date)}</span>
            <DaysLeft days={d.daysLeft} />
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          {d.reminderDue && d.kind === 'offer' && <span title="到了提醒节点（14/7/3/1 天），还没提醒学生">🔔</span>}
          <RemindButton app={app} showLast={false} />
          <span className="w-28 text-xs text-slate-400">
            {app.last_reminded_on ? `上次提醒 ${fmtShort(app.last_reminded_on, today)}` : '还没提醒过'}
          </span>
        </span>
      </div>
      {overdue && (
        <div className="mt-1.5 pl-8">
          <OverdueOfferPrompt app={app} />
        </div>
      )}
    </div>
  )
}

function TaskLine({ t }: { t: Task }) {
  const today = useStore((s) => s.today)
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <button
        type="button"
        title="完成"
        onClick={() => completeTask(t.id)}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500"
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <StudentLink id={t.student_id} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[14px] text-slate-700">{t.content}</span>
      {t.handler && <span className="tag bg-violet-50 text-violet-700 ring-violet-200">{t.handler}</span>}
      {t.due_date && (
        <span className="text-xs whitespace-nowrap text-slate-400 tabular-nums">
          {fmtShort(t.due_date, today)} {fmtWeekday(t.due_date)}
        </span>
      )}
      <Button size="xs" variant="ghost" className="text-emerald-700" onClick={() => completeTask(t.id)}>
        ✓完成
      </Button>
      <PostponeMenu onPick={(d) => postponeTask(t.id, d)} />
    </div>
  )
}

function TasksSection({ infos }: { infos: StudentInfo[] }) {
  const today = useStore((s) => s.today)
  const tasks = useStore((s) => s.tasks)
  const infoMap = useInfoMap()
  const weekEnd = endOfWeek(today)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const buckets = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (t.done_on) continue
      const i = infoMap.get(t.student_id)
      if (!i || i.s.status === '已完成' || i.s.status === '暂停不跟进') continue
      const b = taskBucket(t.due_date, today, weekEnd)
      if (!m.has(b)) m.set(b, [])
      m.get(b)!.push(t)
    }
    for (const list of m.values()) list.sort((a, b) => ((a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1))
    return m
  }, [tasks, infoMap, today, weekEnd])
  void infos
  const total = [...buckets.values()].reduce((n, l) => n + l.length, 0)
  return (
    <div className="card p-4">
      <SectionTitle count={total}>📋 接下来</SectionTitle>
      {!total && <Empty>没有待办。在学生详情的「下一步」里添加，到期会出现在这里。</Empty>}
      <div className="space-y-2">
        {TASK_BUCKETS.map((b) => {
          const list = buckets.get(b.key) ?? []
          if (!list.length) return null
          const isOpen = open[b.key] ?? !b.collapsed
          return (
            <div key={b.key}>
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [b.key]: !isOpen }))}
                className="flex w-full items-center gap-1 py-1 text-[13px] font-semibold text-slate-600"
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {b.label}
                <span className="font-normal text-slate-400">{list.length}</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {list.map((t) => (
                    <TaskLine key={t.id} t={t} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FollowRow({ info }: { info: StudentInfo }) {
  const today = useStore((s) => s.today)
  const reasons = info.inspectReasons.filter((r) => r.kind === 'follow' || r.kind === 'ball_student')
  return (
    <div className="group rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <div className="flex items-center gap-2">
        <StudentLink id={info.s.id} />
        {info.s.priority === '高' && <span className="text-xs text-rose-500">高</span>}
        <span className="text-xs text-slate-400">{info.s.assignee ?? '未分配'}</span>
        <div className="flex-1" />
        <span className={cx('text-xs', info.stale === 'bad' ? 'text-rose-600' : info.stale === 'warn' ? 'text-amber-600' : 'text-slate-400')}>
          更新于{fmtAgo(info.daysSinceUpdate)}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{reasons.map((r) => r.label).join('；')}</div>
      <div className="mt-1 flex items-center gap-1">
        <Button size="xs" variant="ghost" onClick={() => checkStudent(info.s.id)} title="刷新最后检查日期，跟进周期从今天重算">
          ✓ 已检查没变化
        </Button>
        <Button size="xs" variant="ghost" onClick={() => useStore.setState({ quick: { open: true, studentId: info.s.id } })}>
          <PenLine size={12} /> 写记录
        </Button>
        <PostponeMenu onPick={(d) => snoozeStudent(info.s.id, d)} />
        {info.s.next_follow_date && info.s.next_follow_date < today && (
          <span className="ml-auto text-[11px] text-slate-400">应在 {fmtShort(info.s.next_follow_date, today)} 跟进</span>
        )}
      </div>
    </div>
  )
}

function KeyDateRow({ d }: { d: Deadline }) {
  const today = useStore((s) => s.today)
  return (
    <div className={cx('flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5', d.reminderDue ? 'bg-amber-50/60' : 'hover:bg-slate-50')}>
      <span>{d.icon}</span>
      <StudentLink id={d.student_id} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600" title={d.sub}>
        {d.title}
        {d.sub && <span className="text-slate-400"> · {d.sub}</span>}
      </span>
      <span className="text-xs text-slate-500 tabular-nums">{fmtShort(d.date, today)}</span>
      <DaysLeft days={d.daysLeft} scale="week" />
      {d.reminderDue && <AckButton d={d} label="已提醒" />}
    </div>
  )
}

export function HomePage() {
  const infos = useInfos()
  const today = useStore((s) => s.today)
  const events = useStore((s) => s.events)
  const reviews = useStore((s) => s.review_items)
  const students = useStore((s) => s.students)
  const { pending, done } = useMemo(() => todayQueue(infos), [infos])
  const { streak, recordedToday } = useMemo(() => recordStreak(events, today), [events, today])
  const offers = useMemo(() => offerCountdown(infos), [infos])
  const keyDates = useMemo(() => upcomingKeyDeadlines(infos), [infos])
  const follow = infos
    .filter((i) => (i.followDue || i.ballStale) && !i.handledToday)
    .sort((a, b) => (a.s.next_follow_date ?? '') < (b.s.next_follow_date ?? '') ? -1 : 1)
  const dormantEnded = infos.filter((i) => i.dormancyEnded && i.s.status !== '已完成' && i.s.status !== '暂停不跟进')
  const reviewPending = reviews.filter((r) => r.status === 'pending').length + events.filter((e) => e.date_unknown).length
  const y = new Set([...pending, ...done].map((i) => i.s.id)).size
  const x = done.length
  const dueOffers = offers.filter((d) => d.reminderDue).length

  if (!students.length)
    return (
      <div className="mx-auto max-w-2xl p-8 pt-16 text-center">
        <div className="text-5xl">🎓</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">欢迎使用学生跟进</h1>
        <p className="mt-2 text-slate-500">先把现在的 Excel 导进来，或者加载示例数据看看效果。</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/import">
            <Button variant="primary" size="lg">
              导入 Excel
            </Button>
          </Link>
          <DemoButton size="lg" />
        </div>
        <p className="mt-6 text-[13px] text-slate-400">也可以随时按 N 或右下角 ＋ 直接新建学生并记录。</p>
      </div>
    )

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">今天要做什么</h1>
          <div className="mt-0.5 text-[13px] text-slate-500">
            {fmtDate(today)} {fmtWeekday(today)} · 悉尼时间
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg bg-white px-3 py-1.5 text-[13px] ring-1 ring-slate-200">
            今天已跟进 <b className="text-base text-brand-700 tabular-nums">{x}</b> / {y} 个学生
          </div>
          <div
            className="rounded-lg bg-white px-3 py-1.5 text-[13px] ring-1 ring-slate-200"
            title="按录入时间算；周末没记录不算中断"
          >
            🔥 连续记录 <b className="text-base text-orange-600 tabular-nums">{streak}</b> 天
            {!recordedToday && <span className="ml-1 text-xs text-slate-400">（今天还没记）</span>}
          </div>
        </div>
        <div className="flex-1" />
        <Link to="/inspect">
          <Button variant="primary" size="lg" className="shadow-md shadow-brand-600/20">
            <PlayCircle size={20} /> 开始今日巡检
            {pending.length > 0 && <span className="rounded-full bg-white/20 px-2 text-sm">{pending.length}</span>}
          </Button>
        </Link>
      </div>

      {reviewPending > 0 && (
        <Link
          to="/review"
          className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          📋 导入确认清单还有 <b>{reviewPending}</b> 条要确认（日期、offer、状态冲突）→
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="card p-4">
            <SectionTitle
              count={offers.length}
              right={
                dueOffers > 0 && <span className="text-xs text-amber-700">🔔 {dueOffers} 个到了提醒节点</span>
              }
            >
              ⏳ Offer DDL 倒计时
            </SectionTitle>
            <div className="mb-2 flex gap-3 text-[11px] text-slate-400">
              <span>🔴 3天内</span>
              <span>🟠 7天内</span>
              <span>🟡 14天内</span>
              <span>⚪ 更远</span>
              <span>· 提前 14/7/3/1 天提醒</span>
            </div>
            {offers.length ? (
              <div className="space-y-0.5">
                {offers.map((d) => (
                  <OfferRow key={d.key} d={d} />
                ))}
              </div>
            ) : (
              <Empty>没有等待接受的 offer。申请状态改成 Con offer / Uncon offer 时会自动出现在这里。</Empty>
            )}
          </div>
          <TasksSection infos={infos} />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="card p-4">
            <SectionTitle count={follow.length}>🔁 跟进到期</SectionTitle>
            {follow.length ? (
              <div className="space-y-0.5">
                {follow.map((i) => (
                  <FollowRow key={i.s.id} info={i} />
                ))}
              </div>
            ) : (
              <Empty>今天没有到期的跟进 👍</Empty>
            )}
          </div>
          {dormantEnded.length > 0 && (
            <div className="card p-4">
              <SectionTitle count={dormantEnded.length}>⏰ 休眠结束</SectionTitle>
              <div className="space-y-1">
                {dormantEnded.map((i) => (
                  <div key={i.s.id} className="rounded-lg bg-indigo-50/50 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <StudentLink id={i.s.id} />
                      <span className="text-xs text-slate-500">休眠到 {fmtDate(i.s.dormant_until)}</span>
                      <div className="flex-1" />
                      <Button size="xs" variant="soft" onClick={() => endDormancy(i.s.id)}>
                        恢复跟进
                      </Button>
                    </div>
                    {i.s.dormant_reason && <div className="mt-0.5 text-[13px] text-indigo-900">当初原因：{i.s.dormant_reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card p-4">
            <SectionTitle count={keyDates.length} right={<span className="text-xs text-slate-400">未来 60 天</span>}>
              📅 关键日期
            </SectionTitle>
            {keyDates.length ? (
              <div className="space-y-0.5">
                {keyDates.map((d) => (
                  <KeyDateRow key={d.key} d={d} />
                ))}
              </div>
            ) : (
              <Empty>未来 60 天没有签证到期、开学、Orientation 等日期</Empty>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

