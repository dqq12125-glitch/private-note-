import { useState } from 'react'
import { ChevronDown, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { APP_STATUSES, APP_STATUS_STYLE, CONDITION_ACTIVE, OFFER_PENDING, PAYMENT_ACTIVE } from '../../lib/constants'
import { diffDays, fmtAgo, fmtDate } from '../../lib/dates'
import { appDeadlines, appLabel, isOfferTbc, type StudentInfo } from '../../lib/reminders'
import type { Application, AppStatus } from '../../lib/types'
import {
  addApplication,
  changeAppStatus,
  deleteApplication,
  markConditionDone,
  markPaymentDone,
  remindApp,
  setOfferDdl,
  snoozeTbc,
  updateApplication,
} from '../../data/actions'
import { useStore } from '../../data/store'
import { Button, DateField, DaysLeft, Field, MenuItem, Modal, Popover, cx } from '../ui'

export function AppStatusTag({ status }: { status: AppStatus }) {
  return <span className={cx('tag', APP_STATUS_STYLE[status])}>{status}</span>
}

interface OfferState {
  offer_ddl: string | null
  offer_ddl_tbc: boolean
  payment_ddl: string | null
  condition_text: string
  condition_ddl: string | null
}

function OfferFields({
  v,
  set,
  showDdl = true,
  showCondition,
}: {
  v: OfferState
  set: (p: Partial<OfferState>) => void
  showDdl?: boolean
  showCondition: boolean
}) {
  const missing = !v.offer_ddl && !v.offer_ddl_tbc
  return (
    <div className="space-y-3 rounded-lg bg-amber-50/60 p-3 ring-1 ring-amber-200">
      {showDdl && (
      <Field label={<span className="text-amber-900">接 offer 截止日（DDL）· 必填</span>}>
        <div className="flex flex-wrap items-center gap-3">
          <DateField
            value={v.offer_ddl}
            onChange={(d) => set({ offer_ddl: d, offer_ddl_tbc: d ? false : v.offer_ddl_tbc })}
            className={cx('w-44', missing && '[&_input]:border-amber-400')}
          />
          <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
            <input
              type="checkbox"
              checked={v.offer_ddl_tbc}
              onChange={(e) => set({ offer_ddl_tbc: e.target.checked, offer_ddl: e.target.checked ? null : v.offer_ddl })}
            />
            待确认（每 3 天提醒我补上）
          </label>
        </div>
      </Field>
      )}
      <Field label="押金/学费付款截止日（可选）">
        <DateField value={v.payment_ddl} onChange={(d) => set({ payment_ddl: d })} className="w-44" />
      </Field>
      {showCondition && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Con offer 条件（可选）">
            <input
              className="input"
              placeholder="例如：补 official 成绩单、IELTS 6.5"
              value={v.condition_text}
              onChange={(e) => set({ condition_text: e.target.value })}
            />
          </Field>
          <Field label="补材料截止日">
            <DateField value={v.condition_ddl} onChange={(d) => set({ condition_ddl: d })} className="w-44" />
          </Field>
        </div>
      )}
    </div>
  )
}

function offerStateOf(app?: Partial<Application>): OfferState {
  return {
    offer_ddl: app?.offer_ddl ?? null,
    offer_ddl_tbc: app?.offer_ddl_tbc ?? false,
    payment_ddl: app?.payment_ddl ?? null,
    condition_text: app?.condition_text ?? '',
    condition_ddl: app?.condition_ddl ?? null,
  }
}

/** 状态改成 Con offer / Uncon offer 时自动弹出，填 offer 相关字段 */
export function OfferDialog({
  app,
  status,
  onClose,
}: {
  app: Application
  status: AppStatus
  onClose: () => void
}) {
  const [v, setV] = useState<OfferState>(offerStateOf(app))
  const ok = !!v.offer_ddl || v.offer_ddl_tbc
  return (
    <Modal
      open
      onClose={onClose}
      title={`${appLabel(app)}：${app.status} → ${status}`}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              changeAppStatus(app.id, status, {
                ...v,
                payment_done_on: v.payment_ddl !== app.payment_ddl ? null : app.payment_done_on,
                condition_done_on: v.condition_ddl !== app.condition_ddl ? null : app.condition_done_on,
              })
              onClose()
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-slate-500">
        恭喜拿到 offer 🎉 记下接 offer 的截止日，系统会提前 14 / 7 / 3 / 1 天提醒你去提醒学生。
      </p>
      <OfferFields v={v} set={(p) => setV((o) => ({ ...o, ...p }))} showCondition={status === 'Con offer'} />
    </Modal>
  )
}

export function AppFormModal({
  studentId,
  app,
  initial,
  onClose,
  onSaved,
}: {
  studentId: string
  app?: Application
  initial?: Partial<Application>
  onClose: () => void
  onSaved?: () => void
}) {
  const base = app ?? initial
  const [school, setSchool] = useState(base?.school ?? '')
  const [program, setProgram] = useState(base?.program ?? '')
  const [intake, setIntake] = useState(base?.intake ?? '')
  const [status, setStatus] = useState<AppStatus>(base?.status ?? '未递交')
  const [note, setNote] = useState(base?.note ?? '')
  const [offer, setOffer] = useState<OfferState>(offerStateOf(base))
  const pending = OFFER_PENDING.includes(status)
  const showOffer = pending || PAYMENT_ACTIVE.includes(status)
  const ok = (school.trim() || program.trim()) && (!pending || offer.offer_ddl || offer.offer_ddl_tbc)
  const save = () => {
    if (!ok) return
    const fields: Partial<Application> = {
      school: school.trim(),
      program: program.trim(),
      intake: intake.trim(),
      note: note.trim(),
      payment_ddl: offer.payment_ddl,
      condition_text: offer.condition_text.trim(),
      condition_ddl: offer.condition_ddl,
      ...(pending ? { offer_ddl: offer.offer_ddl, offer_ddl_tbc: offer.offer_ddl_tbc } : {}),
    }
    if (!app) {
      addApplication(studentId, { ...fields, status })
    } else {
      if (app.payment_ddl !== fields.payment_ddl) fields.payment_done_on = null
      if (app.condition_ddl !== fields.condition_ddl) fields.condition_done_on = null
      if (status !== app.status) changeAppStatus(app.id, status, fields)
      else {
        const { offer_ddl, offer_ddl_tbc, ...rest } = fields
        updateApplication(app.id, rest)
        if (pending) {
          const was = isOfferTbc(app) ? null : app.offer_ddl
          const now = offer_ddl_tbc ? null : (offer_ddl ?? null)
          if (was !== now) setOfferDdl(app.id, now)
        }
      }
    }
    onSaved?.()
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-xl"
      title={app ? `编辑申请：${appLabel(app)}` : '添加申请学校'}
      footer={
        <>
          {app && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (window.confirm(`删除「${appLabel(app)}」这条申请？（时间线里的历史记录会保留）`)) {
                  deleteApplication(app.id)
                  onClose()
                }
              }}
            >
              <Trash2 size={14} /> 删除
            </Button>
          )}
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!ok} onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="学校">
            <input autoFocus className="input" placeholder="例如 UQ" value={school} onChange={(e) => setSchool(e.target.value)} />
          </Field>
          <Field label="专业">
            <input className="input" placeholder="例如 Master of IT" value={program} onChange={(e) => setProgram(e.target.value)} />
          </Field>
          <Field label="入学时间">
            <input className="input" placeholder="例如 2027 S1" value={intake} onChange={(e) => setIntake(e.target.value)} />
          </Field>
          <Field label="状态">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as AppStatus)}>
              {APP_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {showOffer && (
          <OfferFields
            v={offer}
            set={(p) => setOffer((o) => ({ ...o, ...p }))}
            showDdl={pending}
            showCondition={CONDITION_ACTIVE.includes(status)}
          />
        )}
        <Field label="备注">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/** 「📣 已提醒学生」按钮 + 上次提醒日期 */
export function RemindButton({ app, size = 'xs', showLast = true }: { app: Application; size?: 'xs' | 'sm'; showLast?: boolean }) {
  const today = useStore((s) => s.today)
  const remindedToday = app.last_reminded_on === today
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        size={size}
        variant={remindedToday ? 'ghost' : 'soft'}
        onClick={() => remindApp(app.id)}
        title="点一下：在时间线记一条「已提醒学生」"
      >
        <Megaphone size={12} /> {remindedToday ? '今天已提醒' : '已提醒学生'}
      </Button>
      {showLast && (
        <span className="text-xs whitespace-nowrap text-slate-400">
          {app.last_reminded_on ? `上次提醒 ${fmtDate(app.last_reminded_on)}（${fmtAgo(diffDays(today, app.last_reminded_on))}）` : '还没提醒过'}
        </span>
      )}
    </span>
  )
}

/** DDL 已过但还没接受：问我「已接受 / 放弃 / 已延期」 */
export function OverdueOfferPrompt({ app, onDecided }: { app: Application; onDecided?: () => void }) {
  const [extending, setExtending] = useState(false)
  const today = useStore((s) => s.today)
  const days = app.offer_ddl ? diffDays(today, app.offer_ddl) : 0
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[13px] text-rose-800 ring-1 ring-rose-200">
      <span className="font-medium">⚠️ DDL 已过 {days} 天，学生接受了吗？</span>
      {extending ? (
        <span className="inline-flex items-center gap-1">
          新 DDL
          <DateField
            value={null}
            autoFocus
            size="sm"
            className="w-36"
            onChange={(d) => {
              if (d) {
                setOfferDdl(app.id, d)
                setExtending(false)
                onDecided?.()
              }
            }}
          />
          <Button size="xs" variant="ghost" onClick={() => setExtending(false)}>
            取消
          </Button>
        </span>
      ) : (
        <>
          <Button size="xs" variant="primary" onClick={() => (changeAppStatus(app.id, '已接受'), onDecided?.())}>
            已接受
          </Button>
          <Button size="xs" onClick={() => (changeAppStatus(app.id, '放弃'), onDecided?.())}>
            放弃
          </Button>
          <Button size="xs" onClick={() => setExtending(true)}>
            已延期（填新 DDL）
          </Button>
          <Button size="xs" variant="ghost" onClick={() => (changeAppStatus(app.id, 'Offer已过期'), onDecided?.())}>
            已过期
          </Button>
        </>
      )}
    </div>
  )
}

function DdlChip({
  label,
  date,
  days,
  done,
  onDone,
  doneLabel,
}: {
  label: string
  date: string
  days: number
  done?: string | null
  onDone?: () => void
  doneLabel?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium tabular-nums text-slate-800">{fmtDate(date)}</span>
      {done ? (
        <span className="tag bg-emerald-50 text-emerald-700 ring-emerald-200">✓ {doneLabel}</span>
      ) : (
        <>
          <DaysLeft days={days} />
          {onDone && (
            <button type="button" className="text-xs text-slate-400 hover:text-emerald-600" onClick={onDone} title={`标记为${doneLabel}`}>
              ✓{doneLabel}
            </button>
          )}
        </>
      )}
    </span>
  )
}

export function AppRow({ app, studentId }: { app: Application; studentId: string }) {
  const today = useStore((s) => s.today)
  const [edit, setEdit] = useState(false)
  const [offerFor, setOfferFor] = useState<AppStatus | null>(null)
  const [fillDdl, setFillDdl] = useState(false)
  const pending = OFFER_PENDING.includes(app.status)
  const tbc = isOfferTbc(app)
  const offerDays = app.offer_ddl ? diffDays(app.offer_ddl, today) : null
  const overdue = pending && !tbc && offerDays !== null && offerDays < 0
  const deadlines = appDeadlines(app, today)
  const hasAnyDdl = deadlines.length > 0
  const inactive = ['被拒', '放弃', 'Offer已过期'].includes(app.status)

  const pickStatus = (s: AppStatus) => {
    if (s === app.status) return
    if (OFFER_PENDING.includes(s)) setOfferFor(s)
    else changeAppStatus(app.id, s)
  }

  return (
    <div className={cx('rounded-lg border p-3', overdue ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200', inactive && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">{app.school || '（未填学校）'}</span>
        {app.program && <span className="text-[13px] text-slate-600">{app.program}</span>}
        {app.intake && <span className="tag bg-slate-50 text-slate-500 ring-slate-200">{app.intake}</span>}
        <div className="flex-1" />
        <Popover
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="inline-flex items-center gap-0.5" title="改状态">
              <AppStatusTag status={app.status} />
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          )}
        >
          {(close) =>
            APP_STATUSES.map((s) => (
              <MenuItem
                key={s}
                onClick={() => {
                  close()
                  pickStatus(s)
                }}
              >
                <AppStatusTag status={s} />
                {s === app.status && <span className="ml-auto text-xs text-slate-400">当前</span>}
              </MenuItem>
            ))
          }
        </Popover>
        <Button size="xs" variant="ghost" onClick={() => setEdit(true)} title="编辑">
          <Pencil size={13} />
        </Button>
      </div>

      {(pending || hasAnyDdl || app.condition_text) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {pending &&
            (tbc ? (
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <span className="text-slate-500">接 offer DDL</span>
                <DaysLeft days={null} tbc />
                {fillDdl ? (
                  <DateField
                    value={null}
                    autoFocus
                    size="sm"
                    className="w-36"
                    onChange={(d) => {
                      if (d) {
                        setOfferDdl(app.id, d)
                        setFillDdl(false)
                      }
                    }}
                  />
                ) : (
                  <>
                    <Button size="xs" variant="soft" onClick={() => setFillDdl(true)}>
                      补上 DDL
                    </Button>
                    {app.tbc_remind_on && app.tbc_remind_on <= today && (
                      <Button size="xs" variant="ghost" onClick={() => snoozeTbc(app.id)}>
                        3 天后再提醒
                      </Button>
                    )}
                  </>
                )}
              </span>
            ) : (
              app.offer_ddl && <DdlChip label="接 offer DDL" date={app.offer_ddl} days={offerDays!} />
            ))}
          {app.payment_ddl && PAYMENT_ACTIVE.includes(app.status) && (
            <DdlChip
              label="付款截止"
              date={app.payment_ddl}
              days={diffDays(app.payment_ddl, today)}
              done={app.payment_done_on}
              onDone={() => markPaymentDone(app.id)}
              doneLabel="已付"
            />
          )}
          {(app.condition_text || app.condition_ddl) && CONDITION_ACTIVE.includes(app.status) && (
            <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="text-slate-500">条件</span>
              <span className="text-slate-800">{app.condition_text || '—'}</span>
              {app.condition_ddl && (
                <DdlChip
                  label="截止"
                  date={app.condition_ddl}
                  days={diffDays(app.condition_ddl, today)}
                  done={app.condition_done_on}
                  onDone={() => markConditionDone(app.id)}
                  doneLabel="已补"
                />
              )}
            </span>
          )}
        </div>
      )}
      {(pending || hasAnyDdl) && (
        <div className="mt-2">
          <RemindButton app={app} />
        </div>
      )}
      {overdue && (
        <div className="mt-2">
          <OverdueOfferPrompt app={app} />
        </div>
      )}
      {app.note && <div className="mt-1.5 text-[13px] text-slate-500">{app.note}</div>}

      {edit && <AppFormModal studentId={studentId} app={app} onClose={() => setEdit(false)} />}
      {offerFor && <OfferDialog app={app} status={offerFor} onClose={() => setOfferFor(null)} />}
    </div>
  )
}

export function Applications({ info }: { info: StudentInfo }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-slate-900">🏫 申请学校</h3>
        <span className="text-xs text-slate-400">{info.apps.length} 所</span>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> 添加申请
        </Button>
      </div>
      <div className="space-y-2">
        {info.apps.map((a) => (
          <AppRow key={a.id} app={a} studentId={info.s.id} />
        ))}
        {!info.apps.length && (
          <div className="py-2 text-[13px] text-slate-400">
            还没有申请记录。一个学生可以有多所学校，状态一改会自动记到时间线里。
          </div>
        )}
      </div>
      {adding && <AppFormModal studentId={info.s.id} onClose={() => setAdding(false)} />}
    </div>
  )
}
