import { useState } from 'react'
import { Check, Clock, Trash2, Undo2 } from 'lucide-react'
import { addDays, diffDays, fmtDate } from '../../lib/dates'
import type { StudentInfo } from '../../lib/reminders'
import type { Task } from '../../lib/types'
import { addTask, completeTask, deleteTask, postponeTask, reopenTask, updateTask } from '../../data/actions'
import { useStore } from '../../data/store'
import { Button, DateField, DaysLeft, MenuItem, Popover, QUICK_OFFSETS, cx, offsetDate, isComposing } from '../ui'
import { confirmDialog } from '../confirm'

export function PostponeMenu({
  onPick,
  label = '推迟',
  size = 'xs',
}: {
  onPick: (date: string) => void
  label?: string
  size?: 'xs' | 'sm'
}) {
  const today = useStore((s) => s.today)
  const [custom, setCustom] = useState(false)
  return (
    <Popover
      trigger={({ toggle }) => (
        <Button size={size} variant="ghost" onClick={toggle} title={label}>
          <Clock size={13} /> {label}
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
                  onPick(d)
                  setCustom(false)
                  close()
                }
              }}
            />
          </div>
        ) : (
          <>
            {[
              { label: '1天', d: addDays(today, 1) },
              { label: '3天', d: addDays(today, 3) },
              { label: '1周', d: addDays(today, 7) },
            ].map((o) => (
              <MenuItem
                key={o.label}
                onClick={() => {
                  onPick(o.d)
                  close()
                }}
              >
                {o.label} <span className="ml-auto pl-4 text-xs text-slate-400">{fmtDate(o.d)}</span>
              </MenuItem>
            ))}
            <MenuItem onClick={() => setCustom(true)}>选日期…</MenuItem>
          </>
        )
      }
    </Popover>
  )
}

function TaskRow({ t }: { t: Task }) {
  const today = useStore((s) => s.today)
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(t.content)
  const overdue = t.due_date && t.due_date < today
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <button
        type="button"
        title="完成"
        onClick={() => completeTask(t.id)}
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500"
      >
        <Check size={12} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="input input-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (content.trim() && content !== t.content) updateTask(t.id, { content: content.trim() })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isComposing(e)) (e.target as HTMLInputElement).blur()
            }}
          />
        ) : (
          <button
            type="button"
            className={cx('text-left text-[14px]', overdue ? 'font-medium text-rose-700' : 'text-slate-800')}
            onClick={() => setEditing(true)}
          >
            {t.content}
          </button>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {t.due_date ? (
            <>
              <span className="tabular-nums">{fmtDate(t.due_date)}</span>
              <DaysLeft days={diffDays(t.due_date, today)} scale="week" />
            </>
          ) : (
            <span className="text-slate-400">没有截止日</span>
          )}
          {t.handler && <span className="tag bg-violet-50 text-violet-700 ring-violet-200">交给 {t.handler}</span>}
        </div>
      </div>
      <div className="flex items-center opacity-60 group-hover:opacity-100">
        <PostponeMenu onPick={(d) => postponeTask(t.id, d)} />
        <Popover
          trigger={({ toggle }) => (
            <Button size="xs" variant="ghost" onClick={toggle} title="改截止日">
              📅
            </Button>
          )}
        >
          {(close) => (
            <div className="p-1">
              <DateField
                value={t.due_date}
                size="sm"
                className="w-40"
                onChange={(d) => {
                  updateTask(t.id, { due_date: d })
                  close()
                }}
              />
            </div>
          )}
        </Popover>
        <Button
          size="xs"
          variant="ghost"
          title="删除"
          onClick={async () => (await confirmDialog({ title: `删除待办「${t.content}」？`, confirmText: '删除', danger: true })) && deleteTask(t.id)}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  )
}

export function AddTaskForm({ studentId, onDone }: { studentId: string; onDone?: () => void }) {
  const today = useStore((s) => s.today)
  const handlers = useStore((s) => s.settings.handlers)
  const [content, setContent] = useState('')
  const [due, setDue] = useState<string | null>(null)
  const [handler, setHandler] = useState('')
  const submit = () => {
    if (!content.trim()) return
    addTask(studentId, { content: content.trim(), due_date: due, handler: handler.trim() || null })
    setContent('')
    setDue(null)
    setHandler('')
    onDone?.()
  }
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-2">
      <input
        className="input"
        placeholder="添加下一步要做的事，回车保存…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isComposing(e)) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">截止</span>
        {QUICK_OFFSETS.slice(0, 4).map((o) => {
          const d = offsetDate(o.key, today)
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setDue(due === d ? null : d)}
              className={cx(
                'rounded-full px-2 py-0.5 text-xs ring-1 ring-inset',
                due === d ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-300',
              )}
            >
              {o.label === '明天' ? '明天' : o.label.replace('后', '')}
            </button>
          )
        })}
        <DateField value={due} onChange={setDue} size="sm" className="w-36" />
        <input
          className="input input-sm w-32"
          placeholder="交给谁（可选）"
          list="handler-list"
          value={handler}
          onChange={(e) => setHandler(e.target.value)}
        />
        <datalist id="handler-list">
          {handlers.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <div className="flex-1" />
        <Button size="sm" variant="primary" onClick={submit} disabled={!content.trim()}>
          添加
        </Button>
      </div>
    </div>
  )
}

export function NextSteps({ info }: { info: StudentInfo }) {
  const tasks = useStore((s) => s.tasks)
  const [showDone, setShowDone] = useState(false)
  const done = tasks
    .filter((t) => t.student_id === info.s.id && t.done_on)
    .sort((a, b) => ((a.done_on ?? '') < (b.done_on ?? '') ? 1 : -1))
  return (
    <div className="card border-l-4 border-l-amber-400 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">👉 下一步</h3>
        <span className="text-xs text-slate-400">{info.openTasks.length} 件待办</span>
      </div>
      <div className="space-y-0.5">
        {info.openTasks.map((t) => (
          <TaskRow key={t.id} t={t} />
        ))}
        {!info.openTasks.length && (
          <div className="px-2 py-1 text-[13px] text-slate-400">还没有待办。写下下一步要做什么，到期会自动提醒。</div>
        )}
      </div>
      <div className="mt-2">
        <AddTaskForm studentId={info.s.id} />
      </div>
      {done.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setShowDone((v) => !v)}>
            {showDone ? '收起' : `已完成 ${done.length} 件`}
          </button>
          {showDone && (
            <div className="mt-1 space-y-1">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-2 text-[13px] text-slate-400">
                  <Check size={13} className="text-emerald-500" />
                  <span className="line-through">{t.content}</span>
                  <span className="text-xs">{fmtDate(t.done_on)}</span>
                  <button type="button" title="改回未完成" onClick={() => reopenTask(t.id)} className="hover:text-slate-600">
                    <Undo2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
