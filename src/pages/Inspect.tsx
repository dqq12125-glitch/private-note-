import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock, Megaphone } from 'lucide-react'
import { addDays, diffDays, fmtAgo, fmtDate, fmtDaysLeft, fmtShort } from '../lib/dates'
import { todayQueue, type StudentInfo } from '../lib/reminders'
import { addNote, checkStudent, completeTask, endDormancy, remindApp, snoozeStudent } from '../data/actions'
import { useInfoMap, useInfos } from '../data/hooks'
import { useStore } from '../data/store'
import { BallTag, EventMini, StatusTag, StudentLink } from '../components/bits'
import { AckButton } from '../components/deadline'
import { isEnterSave } from '../components/detail/Timeline'
import { Button, DateField, DaysLeft, MenuItem, Popover, RemindPicker, TextArea, cx } from '../components/ui'

// 当天的巡检队列（在页面之间切换时保持不变）
let snapshot: { day: string; ids: string[]; skipped: string[] } = { day: '', ids: [], skipped: [] }

function SnoozeButton({ onPick }: { onPick: (d: string) => void }) {
  const today = useStore((s) => s.today)
  const [custom, setCustom] = useState(false)
  return (
    <Popover
      trigger={({ toggle }) => (
        <Button onClick={toggle}>
          <Clock size={15} /> ⏰ 推迟
        </Button>
      )}
    >
      {(close) =>
        custom ? (
          <div className="p-1">
            <DateField
              value={null}
              autoFocus
              size="sm"
              className="w-40"
              onChange={(d) => {
                if (d) {
                  close()
                  setCustom(false)
                  onPick(d)
                }
              }}
            />
          </div>
        ) : (
          <>
            {[
              ['明天', 1],
              ['3天后', 3],
              ['1周后', 7],
            ].map(([l, n]) => (
              <MenuItem
                key={l}
                onClick={() => {
                  close()
                  onPick(addDays(today, n as number))
                }}
              >
                {l}
                <span className="ml-auto pl-4 text-xs text-slate-400">{fmtDate(addDays(today, n as number))}</span>
              </MenuItem>
            ))}
            <MenuItem onClick={() => setCustom(true)}>选日期…</MenuItem>
          </>
        )
      }
    </Popover>
  )
}

function Card({ info, onNext, skipped }: { info: StudentInfo; onNext: () => void; skipped: boolean }) {
  const today = useStore((s) => s.today)
  const [text, setText] = useState('')
  const [remind, setRemind] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const s = info.s
  useEffect(() => {
    setText('')
    setRemind(null)
    setSaved(false)
  }, [s.id])
  const offerApps = info.apps.filter((a) => info.deadlines.some((d) => d.ref.id === a.id && (d.kind === 'offer' || d.kind === 'offer_tbc')))
  const nearestOffer = info.deadlines
    .filter((d) => d.kind === 'offer' || d.kind === 'offer_tbc')
    .sort((a, b) => (a.daysLeft ?? -999) - (b.daysLeft ?? -999))[0]
  const otherDue = info.deadlines.filter(
    (d) => (d.kind === 'payment' || d.kind === 'condition' || d.kind === 'keydate' || d.kind === 'visa_expiry') && d.reminderDue,
  )
  const save = () => {
    if (!text.trim() && !remind) return
    addNote(s.id, text, { remindOn: remind })
    setText('')
    setRemind(null)
    setSaved(true)
  }
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StudentLink id={s.id} className="text-2xl font-bold" />
          {s.english_name && <span className="text-slate-400">{s.english_name}</span>}
          {s.priority === '高' && <span className="tag bg-rose-50 text-rose-600 ring-rose-200">高优先级</span>}
          <StatusTag status={s.status} />
          <BallTag ball={s.ball} />
          <span className="text-[13px] text-slate-500">{s.assignee ?? '未分配'}</span>
          <div className="flex-1" />
          {info.handledToday && <span className="tag bg-emerald-50 text-emerald-700 ring-emerald-200">✓ 今天已处理</span>}
          {skipped && !info.handledToday && <span className="tag bg-slate-100 text-slate-500 ring-slate-200">⏰ 已推迟</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {info.inspectReasons.map((r, i) => (
            <span key={i} className={cx('tag', r.severity <= 2 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}>
              {r.label}
            </span>
          ))}
          <span className="text-xs text-slate-400">上次更新 {fmtAgo(info.daysSinceUpdate)}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">👉 下一步</div>
            {info.openTasks.length ? (
              <div className="space-y-1">
                {info.openTasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[14px]">
                    <button
                      type="button"
                      onClick={() => completeTask(t.id)}
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500"
                      title="完成"
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className={cx('flex-1', t.due_date && t.due_date < today && 'text-rose-700')}>{t.content}</span>
                    {t.due_date && (
                      <span className="text-xs text-slate-400 tabular-nums">
                        {fmtShort(t.due_date, today)}（{fmtDaysLeft(diffDays(t.due_date, today))}）
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-slate-400">没有待办</div>
            )}
          </div>
          {nearestOffer && (
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">⏳ 最近的 offer DDL</div>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="font-medium">{nearestOffer.title.replace(' 待确认', '')}</span>
                {nearestOffer.kind === 'offer_tbc' ? (
                  <DaysLeft days={null} tbc />
                ) : (
                  <>
                    <span className="tabular-nums">{fmtDate(nearestOffer.date)}</span>
                    <DaysLeft days={nearestOffer.daysLeft} />
                  </>
                )}
              </div>
            </div>
          )}
          {otherDue.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">🔔 其他提醒</div>
              {otherDue.map((d) => (
                <div key={d.key} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span>{d.icon}</span>
                  <span>{d.title}</span>
                  <span className="text-slate-500 tabular-nums">{fmtDate(d.date)}</span>
                  <DaysLeft days={d.daysLeft} scale="week" />
                  <AckButton d={d} label="已提醒" />
                </div>
              ))}
            </div>
          )}
          {info.dormancyEnded && (
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-[13px] text-indigo-900">
              ⏰ 休眠已结束{s.dormant_reason && `，当初原因：${s.dormant_reason}`}
              <Button size="xs" variant="soft" className="ml-2" onClick={() => endDormancy(s.id)}>
                恢复跟进
              </Button>
            </div>
          )}
          {s.contact && <div className="text-[13px] text-slate-500">联系人：{s.contact}</div>}
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">最近记录</div>
          <div className="space-y-2">
            {info.recentEvents.length ? (
              info.recentEvents.map((e) => <EventMini key={e.id} e={e} />)
            ) : (
              <div className="text-[13px] text-slate-400">还没有记录</div>
            )}
          </div>
          {s.background && (
            <div className="mt-3 line-clamp-4 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-slate-500">
              {s.background}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        <TextArea
          ref={inputRef}
          value={text}
          minRows={1}
          onChange={(e) => {
            setText(e.target.value)
            setSaved(false)
          }}
          onKeyDown={(e) => {
            if (isEnterSave(e)) {
              e.preventDefault()
              save()
            }
          }}
          placeholder="写一句进展，回车保存…"
          className="bg-white"
        />
        <div className="mt-2">
          <RemindPicker value={remind} onChange={setRemind} label="设下次提醒" />
        </div>
        {saved && <div className="mt-2 text-[13px] text-emerald-600">✓ 已记录，跟进周期从今天重新算</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!text.trim() && !remind}>
            保存记录
          </Button>
          <Button
            onClick={() => {
              checkStudent(s.id)
              onNext()
            }}
            title="快捷键 C"
          >
            <Check size={15} /> 已检查，没变化 <span className="kbd">C</span>
          </Button>
          {offerApps.length > 0 &&
            offerApps.map((a) => (
              <Button key={a.id} variant="soft" onClick={() => remindApp(a.id)}>
                <Megaphone size={14} /> 已提醒学生{offerApps.length > 1 ? `（${a.school}）` : ''}
                {a.last_reminded_on === today && ' ✓'}
              </Button>
            ))}
          <SnoozeButton
            onPick={(d) => {
              snoozeStudent(s.id, d)
              snapshot.skipped.push(s.id)
              onNext()
            }}
          />
          <div className="flex-1" />
          <Button variant="secondary" onClick={onNext}>
            下一个 <ArrowRight size={15} /> <span className="kbd">→</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function InspectPage() {
  const infos = useInfos()
  const map = useInfoMap()
  const today = useStore((s) => s.today)
  const [, force] = useState(0)

  // 生成/更新今天的队列
  const { pending } = useMemo(() => todayQueue(infos), [infos])
  if (snapshot.day !== today) snapshot = { day: today, ids: pending.map((i) => i.s.id), skipped: [] }
  for (const p of pending) if (!snapshot.ids.includes(p.s.id)) snapshot.ids.push(p.s.id)
  const ids = snapshot.ids.filter((id) => map.has(id))

  const [idx, setIdx] = useState(() => {
    const first = ids.findIndex((id) => !map.get(id)?.handledToday && !snapshot.skipped.includes(id))
    return first >= 0 ? first : 0
  })
  const current = ids[idx] ? map.get(ids[idx]) : undefined
  const doneCount = ids.filter((id) => map.get(id)?.handledToday || snapshot.skipped.includes(id)).length

  const next = () => {
    // 跳到下一个还没处理的
    for (let k = 1; k <= ids.length; k++) {
      const j = (idx + k) % ids.length
      const i = map.get(ids[j])
      if (i && !i.handledToday && !snapshot.skipped.includes(ids[j])) {
        setIdx(j)
        force((n) => n + 1)
        return
      }
    }
    setIdx(Math.min(idx + 1, ids.length))
    force((n) => n + 1)
  }
  const prev = () => setIdx((i) => Math.max(0, i - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useStore.getState()
      if (st.quick.open || st.palette || new URLSearchParams(window.location.hash.split('?')[1]).get('s')) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if ((e.key === 'c' || e.key === 'C') && current) {
        e.preventDefault()
        checkStudent(current.s.id)
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const allDone = ids.length > 0 && doneCount >= ids.length

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">每日巡检</h1>
        <span className="text-[13px] text-slate-500">{fmtDate(today)}</span>
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${ids.length ? (doneCount / ids.length) * 100 : 100}%` }} />
          </div>
          <span className="text-[13px] text-slate-600 tabular-nums">
            {doneCount} / {ids.length}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
          <span className="kbd">←</span>
          <span className="kbd">→</span> 切换 <span className="kbd">C</span> 已检查没变化 <span className="kbd">Enter</span> 保存
        </div>
      </div>

      {!ids.length ? (
        <div className="card p-12 text-center">
          <div className="text-4xl">☕️</div>
          <div className="mt-3 text-lg font-semibold">今天没有需要巡检的学生</div>
          <p className="mt-1 text-[13px] text-slate-500">下次跟进日期到了、有到期待办、offer DDL 14 天内、休眠结束的学生会出现在这里。</p>
          <Link to="/" className="mt-4 inline-block text-brand-600 hover:underline">
            回首页
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="card hidden max-h-[calc(100vh-10rem)] overflow-auto p-2 lg:block">
            {ids.map((id, n) => {
              const i = map.get(id)!
              const done = i.handledToday
              const skipped = snapshot.skipped.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIdx(n)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]',
                    n === idx ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-slate-50',
                  )}
                >
                  <span className="w-4 text-center">{done ? '✅' : skipped ? '⏰' : '○'}</span>
                  <span className={cx('font-medium', done || skipped ? 'text-slate-400' : 'text-slate-800')}>{i.s.name}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">
                    {i.inspectReasons[0]?.label ?? (done ? '已处理' : '')}
                  </span>
                </button>
              )
            })}
          </div>
          <div>
            {allDone && (
              <div className="card mb-4 border-emerald-200 bg-emerald-50 p-5 text-center">
                <div className="text-3xl">🎉</div>
                <div className="mt-1 text-lg font-semibold text-emerald-800">今日巡检完成！</div>
                <div className="text-[13px] text-emerald-700">共 {ids.length} 个学生。明天见～</div>
              </div>
            )}
            {current ? (
              <Card info={current} onNext={next} skipped={snapshot.skipped.includes(current.s.id)} />
            ) : (
              !allDone && <div className="card p-8 text-center text-slate-400">已经到最后了</div>
            )}
            <div className="mt-3 flex justify-between">
              <Button variant="ghost" onClick={prev} disabled={idx === 0}>
                <ArrowLeft size={15} /> 上一个
              </Button>
              <span className="text-[13px] text-slate-400">
                第 {Math.min(idx + 1, ids.length)} / {ids.length} 个
              </span>
              <Button variant="ghost" onClick={next}>
                下一个 <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
