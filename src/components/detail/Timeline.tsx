import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, History, Pencil, Star } from 'lucide-react'
import { EVENT_ICON, EVENT_KINDS } from '../../lib/constants'
import { fmtDate, fmtDateTime, fmtMonth, fmtWeekday, monthKey } from '../../lib/dates'
import { sortEventsDesc, type StudentInfo } from '../../lib/reminders'
import type { TimelineEvent } from '../../lib/types'
import { addNote, editEvent, toggleMilestone } from '../../data/actions'
import { useStore } from '../../data/store'
import { Button, DateField, Popover, RemindPicker, Segmented, TextArea, cx, isComposing } from '../ui'

export function isEnterSave(e: React.KeyboardEvent) {
  return e.key === 'Enter' && !e.shiftKey && !isComposing(e) && e.keyCode !== 229
}

export function Composer({ studentId, autoFocus, compact }: { studentId: string; autoFocus?: boolean; compact?: boolean }) {
  const today = useStore((s) => s.today)
  const [text, setText] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [changeDate, setChangeDate] = useState(false)
  const [star, setStar] = useState(false)
  const [remind, setRemind] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const save = () => {
    if (!text.trim()) return
    addNote(studentId, text, { occurred_on: date ?? today, milestone: star, remindOn: remind })
    setText('')
    setStar(false)
    setRemind(null)
    setDate(null)
    setChangeDate(false)
    ref.current?.focus()
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
      <TextArea
        ref={ref}
        autoFocus={autoFocus}
        value={text}
        minRows={compact ? 1 : 2}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (isEnterSave(e)) {
            e.preventDefault()
            save()
          }
        }}
        placeholder="记一笔今天的进展…（Enter 保存，Shift+Enter 换行）"
        className="border-0 !p-1 shadow-none focus:ring-0"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          发生日期
          {changeDate ? (
            <DateField value={date ?? today} onChange={(d) => setDate(d)} size="sm" className="w-36" clearable={false} />
          ) : (
            <button type="button" className="font-medium text-slate-700 underline decoration-dotted" onClick={() => setChangeDate(true)}>
              今天 {fmtDate(today)}
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={() => setStar((v) => !v)}
          className={cx('inline-flex items-center gap-1 text-xs', star ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600')}
          title="标为里程碑"
        >
          <Star size={13} className={star ? 'fill-amber-400' : ''} /> 里程碑
        </button>
        <RemindPicker value={remind} onChange={setRemind} />
        <div className="flex-1" />
        <Button size="sm" variant="primary" disabled={!text.trim()} onClick={save}>
          保存
        </Button>
      </div>
    </div>
  )
}

function EditHistory({ e }: { e: TimelineEvent }) {
  return (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600">
          <History size={11} /> 已编辑
        </button>
      )}
    >
      {() => (
        <div className="max-w-sm space-y-2 p-2 text-[13px]">
          <div className="text-xs font-medium text-slate-500">原文 / 历史版本</div>
          {e.edit_history.map((h, i) => (
            <div key={i} className="rounded bg-slate-50 p-2">
              <div className="mb-0.5 text-[11px] text-slate-400">
                {h.date_unknown ? '日期不明' : fmtDate(h.occurred_on)} · {i === 0 ? '原文' : `第 ${i} 次修改后`}（
                {fmtDateTime(h.edited_at)} 被修改）
              </div>
              <div className="whitespace-pre-wrap text-slate-700">{h.content}</div>
            </div>
          ))}
        </div>
      )}
    </Popover>
  )
}

export function EventRow({ e, showStudent }: { e: TimelineEvent; showStudent?: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(e.content)
  const [date, setDate] = useState<string | null>(e.occurred_on)
  if (e.kind === 'checked')
    return (
      <div className="flex items-center gap-2 py-0.5 pl-1 text-xs text-slate-300" title={`录入时间 ${fmtDateTime(e.created_at)}`}>
        <span className="w-12 tabular-nums">{fmtDate(e.occurred_on).slice(0, 5)}</span>
        {showStudent}
        <span>👀 已检查，没变化</span>
        {e.recorder && <span>· {e.recorder}</span>}
      </div>
    )
  return (
    <div className={cx('group flex gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50', e.milestone && 'bg-amber-50/40')}>
      <div className="w-12 shrink-0 pt-0.5 text-right">
        <div className={cx('text-[13px] font-medium tabular-nums', e.date_unknown ? 'text-amber-600' : 'text-slate-700')}>
          {e.date_unknown ? '??' : fmtDate(e.occurred_on).slice(0, 5)}
        </div>
        {!e.date_unknown && <div className="text-[11px] text-slate-400">{fmtWeekday(e.occurred_on)}</div>}
      </div>
      <div className="pt-0.5 text-[15px] leading-5">{EVENT_ICON[e.kind]}</div>
      <div className="min-w-0 flex-1">
        {showStudent && <div className="mb-0.5">{showStudent}</div>}
        {editing ? (
          <div className="space-y-1.5">
            <TextArea value={content} onChange={(ev) => setContent(ev.target.value)} autoFocus />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">发生日期</span>
              <DateField value={date} onChange={setDate} size="sm" className="w-36" clearable={false} />
              <div className="flex-1" />
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                取消
              </Button>
              <Button
                size="xs"
                variant="primary"
                onClick={() => {
                  if (content.trim() !== e.content || date !== e.occurred_on || e.date_unknown)
                    editEvent(e.id, { content: content.trim(), occurred_on: date ?? e.occurred_on })
                  setEditing(false)
                }}
              >
                保存修改
              </Button>
            </div>
            <div className="text-[11px] text-slate-400">时间线只能追加不能删除；修改后会显示「已编辑」并保留原文。</div>
          </div>
        ) : (
          <div className={cx('text-[14px] leading-relaxed whitespace-pre-wrap break-words', e.milestone ? 'text-slate-900' : 'text-slate-700')}>
            {e.content}
          </div>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
          {e.date_unknown && (
            <span className="tag bg-amber-50 text-amber-700 ring-amber-200">
              日期不明（暂放在 {fmtDate(e.occurred_on)}）
            </span>
          )}
          {e.recorder && <span>{e.recorder}</span>}
          <span title="录入时间">录入 {fmtDateTime(e.created_at)}</span>
          {e.edit_history.length > 0 && <EditHistory e={e} />}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        <button
          type="button"
          onClick={() => toggleMilestone(e.id)}
          title={e.milestone ? '取消里程碑' : '标为里程碑'}
          className={cx('rounded p-1', e.milestone ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-500')}
        >
          <Star size={14} className={e.milestone ? 'fill-amber-400' : ''} />
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setContent(e.content)
              setDate(e.occurred_on)
              setEditing(true)
            }}
            title="编辑"
            className="rounded p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export function Timeline({ info, compact }: { info: StudentInfo; compact?: boolean }) {
  const [mode, setMode] = useState<'全部记录' | '只看里程碑'>('全部记录')
  const [desc, setDesc] = useState(true)
  const events = useMemo(() => {
    let list = info.events
    if (mode === '只看里程碑') list = list.filter((e) => e.milestone && e.kind !== 'checked')
    const sorted = [...list].sort(sortEventsDesc)
    return desc ? sorted : sorted.reverse()
  }, [info.events, mode, desc])
  const groups = useMemo(() => {
    const out: { key: string; items: TimelineEvent[] }[] = []
    for (const e of events) {
      const k = monthKey(e.occurred_on)
      if (out[out.length - 1]?.key !== k) out.push({ key: k, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  }, [events])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of info.events) m.set(e.kind, (m.get(e.kind) ?? 0) + 1)
    return m
  }, [info.events])
  return (
    <div className="flex flex-col gap-3">
      <Composer studentId={info.s.id} compact={compact} />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={['全部记录', '只看里程碑'] as const} value={mode} onChange={setMode} size="xs" />
        <Button size="xs" variant="ghost" onClick={() => setDesc((v) => !v)} title="切换排序">
          <ArrowDownUp size={12} /> {desc ? '新→旧' : '旧→新'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-400">
        {EVENT_KINDS.filter((k) => counts.get(k.kind)).map((k) => (
          <span key={k.kind}>
            {k.icon}
            {k.label} {counts.get(k.kind)}
          </span>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="sticky top-0 z-[1] -mx-1 mb-1 bg-gradient-to-b from-white via-white to-white/80 px-1 py-1 text-xs font-semibold text-slate-500">
            {fmtMonth(g.key)}
            <span className="ml-1 font-normal text-slate-400">{g.items.length} 条</span>
          </div>
          <div className="space-y-0.5 border-l-2 border-slate-100 pl-1">
            {g.items.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      ))}
      {!events.length && (
        <div className="py-6 text-center text-[13px] text-slate-400">
          {mode === '只看里程碑' ? '还没有里程碑（递交、offer、CoE、签证获批、付款、状态变化会自动算）' : '还没有记录'}
        </div>
      )}
    </div>
  )
}
