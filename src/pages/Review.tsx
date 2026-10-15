import { useMemo, useState } from 'react'
import { KEYDATE_KINDS } from '../lib/constants'
import { fmtDate } from '../lib/dates'
import { sortEventsDesc } from '../lib/reminders'
import type { AppStatus, KeyDateKind, ReviewItem, TimelineEvent } from '../lib/types'
import { addKeyDate, addTask, editEvent, resolveReview, setStudentStatus } from '../data/actions'
import { useStore } from '../data/store'
import { StudentLink } from '../components/bits'
import { AppFormModal } from '../components/detail/Applications'
import { Button, DateField, Segmented, cx } from '../components/ui'

const TABS = [
  { key: 'date_mention', label: 'a) 日期 / 期限' },
  { key: 'offer_mention', label: 'b) 提到 offer' },
  { key: 'unknown', label: 'c) 日期不明的记录' },
  { key: 'status_conflict', label: 'd) 状态冲突' },
] as const
type TabKey = (typeof TABS)[number]['key']

function DateMentionItem({ r }: { r: ReviewItem }) {
  const [target, setTarget] = useState<'待办' | '关键日期'>(r.suggestion.target === 'keydate' ? '关键日期' : '待办')
  const [kind, setKind] = useState<KeyDateKind>(r.suggestion.keydate_kind ?? '其他')
  const [date, setDate] = useState<string | null>(r.suggestion.date ?? null)
  const [content, setContent] = useState(r.text)
  const confirm = () => {
    if (!date) return
    if (target === '待办') addTask(r.student_id, { content: content.trim() || r.text, due_date: date })
    else addKeyDate(r.student_id, { kind, date, note: content.trim() })
    resolveReview(r.id, 'done')
  }
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-950">
        「{r.text}」
        <span className="ml-2 text-xs text-amber-700/70">来自{r.suggestion.from}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={['待办', '关键日期'] as const} value={target} onChange={setTarget} size="xs" />
        {target === '关键日期' && (
          <select className="input input-sm w-auto" value={kind} onChange={(e) => setKind(e.target.value as KeyDateKind)}>
            {KEYDATE_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        )}
        <DateField value={date} onChange={setDate} size="sm" className="w-36" />
        {r.suggestion.approx && <span className="text-xs text-amber-600">原文只写了月份，日期是估的</span>}
      </div>
      <input className="input input-sm" value={content} onChange={(e) => setContent(e.target.value)} placeholder={target === '待办' ? '待办内容' : '说明'} />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={!date} onClick={confirm}>
          设为{target}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => resolveReview(r.id, 'dismissed')}>
          不用，忽略
        </Button>
      </div>
    </div>
  )
}

function OfferItem({ r }: { r: ReviewItem }) {
  const allApps = useStore((s) => s.applications)
  const apps = useMemo(() => allApps.filter((a) => a.student_id === r.student_id), [allApps, r.student_id])
  const [form, setForm] = useState<{ school: string; status: AppStatus } | null>(null)
  return (
    <div className="space-y-2">
      <div className="space-y-0.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-950">
        {r.text.split('\n').map((t, i) => (
          <div key={i}>「{t}」</div>
        ))}
      </div>
      {apps.length > 0 && (
        <div className="text-xs text-emerald-700">已经添加了：{apps.map((a) => `${a.school}（${a.status}）`).join('、')}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(r.suggestion.schools ?? []).map((s) => (
          <Button key={s.school} size="sm" variant="soft" onClick={() => setForm(s)}>
            ＋ 补 {s.school} {s.status} 的 DDL
          </Button>
        ))}
        <Button size="sm" onClick={() => setForm({ school: '', status: 'Con offer' })}>
          ＋ 添加其他学校
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="primary" onClick={() => resolveReview(r.id, 'done')}>
          这个学生处理完了
        </Button>
        <Button size="sm" variant="ghost" onClick={() => resolveReview(r.id, 'dismissed')}>
          忽略
        </Button>
      </div>
      {form && (
        <AppFormModal studentId={r.student_id} initial={{ school: form.school, status: form.status }} onClose={() => setForm(null)} />
      )}
    </div>
  )
}

function UnknownItem({ e, events }: { e: TimelineEvent; events: TimelineEvent[] }) {
  const [date, setDate] = useState<string | null>(null)
  const list = events.filter((x) => x.student_id === e.student_id).sort(sortEventsDesc).reverse()
  const i = list.findIndex((x) => x.id === e.id)
  const prev = list.slice(0, i).reverse().find((x) => !x.date_unknown)
  const next = list.slice(i + 1).find((x) => !x.date_unknown)
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[13px] whitespace-pre-wrap text-slate-800">{e.content}</div>
      <div className="text-xs text-slate-500">
        前一条：{prev ? `${fmtDate(prev.occurred_on)} ${prev.content.slice(0, 30)}` : '无'} ／ 后一条：
        {next ? `${fmtDate(next.occurred_on)} ${next.content.slice(0, 30)}` : '无'}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">实际日期</span>
        <DateField value={date} onChange={setDate} size="sm" className="w-36" />
        <Button size="sm" variant="primary" disabled={!date} onClick={() => date && editEvent(e.id, { occurred_on: date })}>
          保存日期
        </Button>
        <Button size="sm" variant="ghost" onClick={() => editEvent(e.id, { occurred_on: e.occurred_on })}>
          记不清，就用 {fmtDate(e.occurred_on)}
        </Button>
      </div>
    </div>
  )
}

function ConflictItem({ r }: { r: ReviewItem }) {
  const st = r.suggestion.status!
  const student = useStore((s) => s.students.find((x) => x.id === r.student_id))
  return (
    <div className="space-y-2">
      <div className="text-[13px] text-slate-700">{r.text}</div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setStudentStatus(r.student_id, st)
            resolveReview(r.id, 'done')
          }}
        >
          改为「{st}」
        </Button>
        <Button size="sm" onClick={() => resolveReview(r.id, 'dismissed')}>
          保持「{student?.status}」
        </Button>
      </div>
    </div>
  )
}

export function ReviewPage() {
  const reviews = useStore((s) => s.review_items)
  const events = useStore((s) => s.events)
  const [tab, setTab] = useState<TabKey>('date_mention')
  const [showDone, setShowDone] = useState(false)
  const unknown = useMemo(() => events.filter((e) => e.date_unknown), [events])
  const counts: Record<TabKey, number> = {
    date_mention: reviews.filter((r) => r.kind === 'date_mention' && r.status === 'pending').length,
    offer_mention: reviews.filter((r) => r.kind === 'offer_mention' && r.status === 'pending').length,
    status_conflict: reviews.filter((r) => r.kind === 'status_conflict' && r.status === 'pending').length,
    unknown: unknown.length,
  }
  const items = reviews
    .filter((r) => r.kind === tab && (showDone || r.status === 'pending'))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1))

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">导入确认清单</h1>
      <p className="mt-1 mb-4 text-[13px] text-slate-500">导入时自动找出来、需要你确认的地方。可以分几天慢慢处理，进度会保存。</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-[13px] font-medium',
              tab === t.key ? 'bg-inverse text-on-inverse' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {t.label}
            <span className={cx('ml-1.5 rounded-full px-1.5 text-xs', counts[t.key] ? 'bg-rose-500 text-on-accent' : 'bg-slate-200 text-slate-500')}>
              {counts[t.key]}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        {tab !== 'unknown' && (
          <label className="inline-flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> 显示已处理的
          </label>
        )}
      </div>

      <div className="space-y-3">
        {tab === 'unknown'
          ? unknown.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="mb-2">
                  <StudentLink id={e.student_id} />
                </div>
                <UnknownItem e={e} events={events} />
              </div>
            ))
          : items.map((r) => (
              <div key={r.id} className={cx('card p-4', r.status !== 'pending' && 'opacity-50')}>
                <div className="mb-2 flex items-center gap-2">
                  <StudentLink id={r.student_id} />
                  {r.status !== 'pending' && (
                    <>
                      <span className="text-xs text-slate-400">{r.status === 'done' ? '已处理' : '已忽略'}</span>
                      <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => resolveReview(r.id, 'pending')}>
                        撤销
                      </button>
                    </>
                  )}
                </div>
                {r.status === 'pending' ? (
                  r.kind === 'date_mention' ? (
                    <DateMentionItem r={r} />
                  ) : r.kind === 'offer_mention' ? (
                    <OfferItem r={r} />
                  ) : (
                    <ConflictItem r={r} />
                  )
                ) : (
                  <div className="text-[13px] whitespace-pre-wrap text-slate-500">{r.text}</div>
                )}
              </div>
            ))}
        {((tab === 'unknown' && !unknown.length) || (tab !== 'unknown' && !items.length)) && (
          <div className="card p-10 text-center text-[13px] text-slate-400">这一类都处理完了 ✓</div>
        )}
      </div>
    </div>
  )
}
