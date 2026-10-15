import { useEffect, useMemo, useRef, useState } from 'react'
import { BALLS, STUDENT_STATUSES } from '../lib/constants'
import { fmtDate } from '../lib/dates'
import { searchStudents } from '../lib/search'
import type { Ball, StudentStatus } from '../lib/types'
import { todayQueue, type StudentInfo } from '../lib/reminders'
import { addNote, createStudent } from '../data/actions'
import { useInfos, useStudentInfo } from '../data/hooks'
import { toast, useStore } from '../data/store'
import { BallTag, StatusTag, useOpenStudent } from './bits'
import { isEnterSave } from './detail/Timeline'
import { Button, DateField, Modal, RemindPicker, Segmented, TextArea, cx, isComposing } from './ui'

export function StudentPicker({
  value,
  onChange,
  autoFocus,
  allowCreate,
}: {
  value: string | null
  onChange: (id: string | null) => void
  autoFocus?: boolean
  allowCreate?: boolean
}) {
  const infos = useInfos()
  const picked = useStudentInfo(value)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const list: StudentInfo[] = useMemo(() => {
    if (q.trim()) return searchStudents(infos, q, 12).map((h) => h.info)
    // 没输入时：今天要跟进的排前面
    const { pending } = todayQueue(infos)
    const rest = infos.filter((i) => i.active && !pending.includes(i))
    return [...pending, ...rest].slice(0, 12)
  }, [infos, q])
  useEffect(() => setIdx(0), [q])

  if (picked)
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5">
        <span className="font-semibold">{picked.s.name}</span>
        {picked.s.english_name && <span className="text-xs text-slate-400">{picked.s.english_name}</span>}
        <StatusTag status={picked.s.status} />
        <BallTag ball={picked.s.ball} />
        <div className="flex-1" />
        <button
          type="button"
          className="text-xs text-brand-700 hover:underline"
          onClick={() => {
            onChange(null)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
        >
          换一个
        </button>
      </div>
    )
  const choose = (i: StudentInfo) => {
    onChange(i.s.id)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="relative">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="input"
        placeholder="输入学生姓名（一两个字就行）"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (isComposing(e)) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIdx((i) => Math.min(i + 1, list.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (list[idx]) choose(list[idx])
          }
        }}
      />
      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {list.map((i, n) => (
            <button
              key={i.s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseMove={() => idx !== n && setIdx(n)}
              className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]', n === idx && 'bg-brand-50')}
            >
              <span className="font-medium text-slate-900">{i.s.name}</span>
              {i.s.english_name && <span className="text-xs text-slate-400">{i.s.english_name}</span>}
              <span className="text-xs text-slate-400">{i.s.assignee ?? '未分配'}</span>
              <div className="flex-1" />
              {i.inspectReasons.length > 0 && !i.handledToday && <span className="text-xs text-amber-600">今天要跟进</span>}
              <StatusTag status={i.s.status} />
            </button>
          ))}
          {!list.length && <div className="px-2 py-2 text-[13px] text-slate-400">没有找到「{q}」</div>}
          {allowCreate && q.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const s = createStudent({ name: q.trim() })
                onChange(s.id)
                setQ('')
                setOpen(false)
                toast(`已新建学生「${s.name}」`)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-brand-700 hover:bg-brand-50"
            >
              ＋ 新建学生「{q.trim()}」
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function QuickRecordModal() {
  const quick = useStore((s) => s.quick)
  const today = useStore((s) => s.today)
  const open = useOpenStudent()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [remind, setRemind] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [status, setStatus] = useState<StudentStatus | null>(null)
  const [ball, setBall] = useState<Ball | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const info = useStudentInfo(studentId)

  useEffect(() => {
    if (quick.open) {
      setStudentId(quick.studentId)
      setText('')
      setDate(null)
      setRemind(null)
      setMore(false)
      setStatus(null)
      setBall(null)
      if (quick.studentId) setTimeout(() => textRef.current?.focus(), 30)
    }
  }, [quick.open, quick.studentId])
  useEffect(() => {
    if (studentId && quick.open) setTimeout(() => textRef.current?.focus(), 30)
  }, [studentId, quick.open])

  const close = () => useStore.setState({ quick: { open: false, studentId: null } })
  const canSave = !!studentId && (!!text.trim() || !!remind || !!status || !!ball)
  const save = () => {
    if (!canSave || !studentId) return
    const name = info?.s.name
    addNote(studentId, text, {
      occurred_on: date ?? today,
      remindOn: remind,
      status: status ?? undefined,
      ball: ball ?? undefined,
    })
    close()
    const id = studentId
    toast(`已记录 · ${name}${remind ? `，${fmtDate(remind)} 提醒你` : ''}`, {
      tone: 'ok',
      action: { label: '查看', run: () => open(id) },
    })
  }

  return (
    <Modal
      open={quick.open}
      onClose={close}
      title="✍️ 快速记录"
      width="max-w-xl"
      footer={
        <>
          <span className="mr-auto hidden self-center text-xs text-slate-400 sm:inline">
            <span className="kbd">Enter</span> 保存 · <span className="kbd">Shift</span>+<span className="kbd">Enter</span> 换行 ·{' '}
            <span className="kbd">Esc</span> 关闭
          </span>
          <Button onClick={close}>取消</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <StudentPicker value={studentId} onChange={setStudentId} autoFocus={!quick.studentId} allowCreate />
        {info?.recentEvents[0] && (
          <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
            上一条（{fmtDate(info.recentEvents[0].occurred_on)}）：
            <span className="text-slate-700">{info.recentEvents[0].content.slice(0, 80)}</span>
          </div>
        )}
        <TextArea
          ref={textRef}
          value={text}
          minRows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (isEnterSave(e)) {
              e.preventDefault()
              save()
            }
          }}
          placeholder="写一句话，例如：学生说下周交成绩单"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          日期
          <DateField value={date ?? today} onChange={setDate} size="sm" className="w-36" clearable={false} />
          {date && date !== today && <span className="text-amber-600">补记 {fmtDate(date)} 的事</span>}
        </div>
        <RemindPicker value={remind} onChange={setRemind} label="设提醒（可选）" />
        <div>
          <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setMore((v) => !v)}>
            {more ? '收起' : '顺手改状态 / 球在谁那 ▾'}
          </button>
          {more && info && (
            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="w-14">状态</span>
                <Segmented options={STUDENT_STATUSES} value={status ?? info.s.status} onChange={setStatus} size="xs" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="w-14">球在谁那</span>
                <Segmented options={BALLS} value={ball ?? info.s.ball} onChange={setBall} size="xs" />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
