import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Moon, MoreHorizontal, Star, Trash2 } from 'lucide-react'
import {
  BALLS,
  BUSINESS_TYPES,
  FOLLOW_CYCLES,
  STUDENT_STATUSES,
  UNASSIGNED,
} from '../../lib/constants'
import { addMonths, fmtAgo, fmtDate, diffDays } from '../../lib/dates'
import type { StudentInfo } from '../../lib/reminders'
import type { BusinessType } from '../../lib/types'
import {
  deleteStudent,
  endDormancy,
  setBall,
  setCycle,
  setDormant,
  setNextFollow,
  setStudentStatus,
  updateStudent,
} from '../../data/actions'
import { useStore } from '../../data/store'
import { Box, Button, Chips, DateField, Field, InlineText, MenuItem, Modal, Popover, Segmented, cx } from '../ui'
import { confirmDialog } from '../confirm'

export function DormantDialog({
  open,
  onClose,
  studentId,
  initialUntil,
  initialReason,
}: {
  open: boolean
  onClose: () => void
  studentId: string
  initialUntil?: string | null
  initialReason?: string | null
}) {
  const today = useStore((s) => s.today)
  const [until, setUntil] = useState<string | null>(initialUntil ?? null)
  const [reason, setReason] = useState(initialReason ?? '')
  const quick = [
    { key: '1', label: '1个月后', m: 1 },
    { key: '2', label: '2个月后', m: 2 },
    { key: '3', label: '3个月后', m: 3 },
    { key: '6', label: '半年后', m: 6 },
  ]
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="💤 休眠到某天"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!until || until <= today}
            onClick={() => {
              setDormant(studentId, until!, reason.trim())
              onClose()
            }}
          >
            设为休眠
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-slate-500">
        休眠期间这个学生不会出现在首页和巡检里；到了那天会自动回到首页，并显示当初的休眠原因。
        适合「CoE 已出，等几个月后办签证或开学」这类情况。
      </p>
      <div className="space-y-3">
        <Field label="休眠到">
          <div className="space-y-2">
            <Chips
              options={quick.map((q) => ({ key: q.key, label: q.label }))}
              value={quick.find((q) => addMonths(today, q.m) === until)?.key ?? null}
              onChange={(k) => {
                const q = quick.find((x) => x.key === k)
                if (q) setUntil(addMonths(today, q.m))
              }}
            />
            <DateField value={until} onChange={setUntil} className="w-44" />
          </div>
        </Field>
        <Field label="休眠原因（到时候会提醒你）">
          <input
            className="input"
            value={reason}
            placeholder="例如：CoE 已出，2 月开始办学签"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

/** 概要卡片右上角：导出进度报告 + 更多（删除学生） */
export function StudentMoreActions({ info, compact }: { info: StudentInfo; compact?: boolean }) {
  const s = info.s
  const navigate = useNavigate()
  return (
    <>
      {!compact && (
        <Link to={`/students/${s.id}/report`}>
          <Button size="sm">
            <FileText size={14} /> 导出进度报告
          </Button>
        </Link>
      )}
      <Popover
        trigger={({ toggle }) => (
          <Button size="sm" variant="ghost" onClick={toggle} title="更多">
            <MoreHorizontal size={16} />
          </Button>
        )}
      >
        {(close) => (
          <>
            {compact && (
              <MenuItem
                onClick={() => {
                  close()
                  navigate(`/students/${s.id}/report`)
                }}
              >
                <FileText size={14} /> 导出进度报告
              </MenuItem>
            )}
            <MenuItem
              danger
              onClick={async () => {
                close()
                const ok = await confirmDialog({
                  title: `删除学生「${s.name}」？`,
                  message: '会连同这个学生的申请、签证、待办、收费和整条时间线一起删除，无法恢复。',
                  confirmText: '删除学生',
                  danger: true,
                  requireText: s.name,
                })
                if (ok) deleteStudent(s.id)
              }}
            >
              <Trash2 size={14} /> 删除学生
            </MenuItem>
          </>
        )}
      </Popover>
    </>
  )
}

/** 休眠已经结束：提醒恢复跟进 */
export function DormancyEndedBanner({ info }: { info: StudentInfo }) {
  const s = info.s
  const [dormantOpen, setDormantOpen] = useState(false)
  if (!info.dormancyEnded) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-amber-200">
      ⏰ 休眠已于 {fmtDate(s.dormant_until)} 结束
      {s.dormant_reason && <span>（当初原因：{s.dormant_reason}）</span>}
      <div className="flex-1" />
      <Button size="xs" variant="primary" onClick={() => endDormancy(s.id)}>
        恢复跟进
      </Button>
      <Button size="xs" onClick={() => setDormantOpen(true)}>
        继续休眠…
      </Button>
      {dormantOpen && (
        <DormantDialog open onClose={() => setDormantOpen(false)} studentId={s.id} initialUntil={null} initialReason={s.dormant_reason} />
      )}
    </div>
  )
}

/** 基本信息：姓名、负责人、业务类型、跟进周期、休眠、背景备注等（都可以直接改） */
export function BasicInfo({ info }: { info: StudentInfo }) {
  const s = info.s
  const assignees = useStore((st) => st.settings.assignees)
  const today = useStore((st) => st.today)
  const [dormantOpen, setDormantOpen] = useState(false)
  const [customCycle, setCustomCycle] = useState(!FOLLOW_CYCLES.some((c) => c.days === s.follow_cycle_days))
  const cycleKey = customCycle ? 'custom' : String(s.follow_cycle_days)
  const assigneeOptions = s.assignee && !assignees.includes(s.assignee) ? [...assignees, s.assignee] : assignees

  return (
    <Box icon="🧾" title="基本信息">
      <div className="flex flex-wrap items-center gap-1">
        <InlineText
          value={s.name}
          autoWidth
          onSave={(v) => v && updateStudent(s.id, { name: v })}
          className="max-w-[16rem] !px-1 text-lg font-semibold text-slate-900"
        />
        <InlineText
          value={s.english_name ?? ''}
          autoWidth
          placeholder="英文名"
          onSave={(v) => updateStudent(s.id, { english_name: v || null })}
          className="max-w-[12rem] !px-1 text-sm text-slate-500"
        />
        <button
          type="button"
          title="优先级：点一下切换 高/普通"
          onClick={() => updateStudent(s.id, { priority: s.priority === '高' ? '普通' : '高' })}
          className={cx(
            'tag cursor-pointer',
            s.priority === '高' ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-white text-slate-400 ring-slate-200 hover:text-slate-600',
          )}
        >
          <Star size={12} className={s.priority === '高' ? 'fill-rose-500 text-rose-500' : ''} />
          {s.priority === '高' ? '高优先级' : '普通'}
        </button>
      </div>
      <div className="mt-1 px-1 text-xs text-slate-500">
        上次更新 <b className="font-medium text-slate-700">{fmtAgo(info.daysSinceUpdate)}</b>
        {info.lastUpdate && `（${fmtDate(info.lastUpdate)}）`} · 最后检查 {s.last_checked_date ? fmtDate(s.last_checked_date) : '—'}
        {s.import_meta && <> · Excel 第 {s.import_meta.row} 行导入</>}
      </div>
      <div className="mt-3 grid gap-x-6 gap-y-3 @xl:grid-cols-2">
        <Field label="状态">
          <Segmented options={STUDENT_STATUSES} value={s.status} onChange={(v) => setStudentStatus(s.id, v)} />
        </Field>
        <Field label="球在谁那">
          <Segmented options={BALLS} value={s.ball} onChange={(v) => setBall(s.id, v)} />
        </Field>
        <Field label="负责人">
          <select
            className="input"
            value={s.assignee ?? ''}
            onChange={(e) => updateStudent(s.id, { assignee: e.target.value || null })}
          >
            <option value="">{UNASSIGNED}</option>
            {assigneeOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="业务类型">
          <select
            className="input"
            value={s.business_type}
            onChange={(e) => updateStudent(s.id, { business_type: e.target.value as BusinessType })}
          >
            {BUSINESS_TYPES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="推荐人">
          <InlineText
            value={s.referrer ?? ''}
            placeholder="（可选）"
            onSave={(v) => updateStudent(s.id, { referrer: v || null })}
            className="!border-slate-200 !bg-white"
          />
        </Field>
        <Field label="联系人 / 紧急联系人">
          <InlineText
            value={s.contact ?? ''}
            placeholder="例如：有事联系女朋友 Geeth"
            onSave={(v) => updateStudent(s.id, { contact: v || null })}
            className="!border-slate-200 !bg-white"
          />
        </Field>
        <Field label="跟进周期">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[...FOLLOW_CYCLES.map((c) => String(c.days)), 'custom']}
              value={cycleKey}
              renderLabel={(k) => (k === 'custom' ? '自定义' : FOLLOW_CYCLES.find((c) => String(c.days) === k)!.label)}
              onChange={(k) => {
                if (k === 'custom') setCustomCycle(true)
                else {
                  setCustomCycle(false)
                  setCycle(s.id, Number(k))
                }
              }}
            />
            {customCycle && (
              <span className="inline-flex items-center gap-1 text-[13px]">
                <input
                  type="number"
                  min={1}
                  className="input input-sm w-16"
                  defaultValue={s.follow_cycle_days}
                  onBlur={(e) => {
                    const n = Math.max(1, Math.round(Number(e.target.value) || 14))
                    if (n !== s.follow_cycle_days) setCycle(s.id, n)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                天
              </span>
            )}
          </div>
        </Field>
        <Field
          label={
            <>
              下次跟进{' '}
              <span className="font-normal text-slate-400">（自动 = 最后处理日期 + 周期，可以手动改）</span>
            </>
          }
        >
          <div className="flex items-center gap-2">
            <DateField
              value={s.next_follow_date}
              onChange={(d) => setNextFollow(s.id, d)}
              className="w-44"
            />
            {s.next_follow_date && (
              <span
                className={cx(
                  'text-xs',
                  s.next_follow_date <= today ? 'font-medium text-rose-600' : 'text-slate-400',
                )}
              >
                {s.next_follow_date <= today
                  ? s.next_follow_date === today
                    ? '今天'
                    : `已过 ${diffDays(today, s.next_follow_date)} 天`
                  : `${diffDays(s.next_follow_date, today)} 天后`}
              </span>
            )}
          </div>
        </Field>
        <div className="@xl:col-span-2">
          <Field label="休眠">
            {info.isDormant ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1.5 text-[13px] text-indigo-900">
                <Moon size={14} /> 休眠到 <b>{fmtDate(s.dormant_until)}</b>
                {s.dormant_reason && <span className="text-indigo-700">· {s.dormant_reason}</span>}
                <div className="flex-1" />
                <Button size="xs" onClick={() => setDormantOpen(true)}>
                  修改
                </Button>
                <Button size="xs" onClick={() => endDormancy(s.id)}>
                  结束休眠
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="!px-1.5 text-slate-500" onClick={() => setDormantOpen(true)}>
                <Moon size={14} /> 设为休眠到某天…
              </Button>
            )}
          </Field>
        </div>
        <div className="@xl:col-span-2">
          <Field label="背景备注">
            <InlineText
              multiline
              value={s.background}
              placeholder="学生背景、家庭情况、特殊要求……"
              onSave={(v) => updateStudent(s.id, { background: v })}
              className="!border-slate-200 !bg-slate-50/60 text-[13px]"
            />
          </Field>
        </div>
      </div>
      {dormantOpen && (
        <DormantDialog
          open
          onClose={() => setDormantOpen(false)}
          studentId={s.id}
          initialUntil={info.isDormant ? s.dormant_until : null}
          initialReason={s.dormant_reason}
        />
      )}
    </Box>
  )
}
