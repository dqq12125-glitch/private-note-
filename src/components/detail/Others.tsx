import { useState } from 'react'
import { Check, Megaphone, Plus, Trash2 } from 'lucide-react'
import { CURRENCIES, KEYDATE_ICON, KEYDATE_KINDS, VISA_STEPS, VISA_TYPES } from '../../lib/constants'
import { fmtDate, fmtDaysLeft } from '../../lib/dates'
import { keyDateDeadline, visaDeadlines, type StudentInfo } from '../../lib/reminders'
import type { KeyDateKind, Visa } from '../../lib/types'
import {
  ackKeyDate,
  ackVisaExpiry,
  addKeyDate,
  addPayment,
  addVisa,
  deleteKeyDate,
  deletePayment,
  deleteVisa,
  fmtMoney,
  toggleVisaStep,
  updateKeyDate,
  updateVisa,
} from '../../data/actions'
import { useStore } from '../../data/store'
import { Box, Button, DateField, InlineText, MenuItem, Popover, cx, isComposing } from '../ui'
import { confirmDialog } from '../confirm'

/** 剩余天数标签：签证到期按 60/30/7 天变色，其他关键日期 7 天内变红 */
export function ExpiryPill({ days, visa = true }: { days: number; visa?: boolean }) {
  const cls =
    days <= 7
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : visa && days <= 30
        ? 'bg-orange-50 text-orange-700 ring-orange-200'
        : visa && days <= 60
          ? 'bg-amber-50 text-amber-700 ring-amber-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200'
  return <span className={cx('tag tabular-nums', cls)}>{fmtDaysLeft(days)}</span>
}

function VisaCard({ v }: { v: Visa }) {
  const today = useStore((s) => s.today)
  const exp = visaDeadlines(v, today)[0]
  const doneCount = VISA_STEPS.filter((s) => v[s.key]).length
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="input input-sm w-auto font-semibold"
          value={VISA_TYPES.includes(v.visa_type) ? v.visa_type : '其他'}
          onChange={(e) => updateVisa(v.id, { visa_type: e.target.value })}
        >
          {VISA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === '其他' ? '其他' : `${t} 签证`}
            </option>
          ))}
        </select>
        {!['500', '600', '485', '189', '190'].includes(v.visa_type) && (
          <InlineText
            value={v.visa_type === '其他' ? '' : v.visa_type}
            placeholder="签证类型"
            onSave={(t) => updateVisa(v.id, { visa_type: t || '其他' })}
            className="!w-28 !border-slate-200"
          />
        )}
        <span className="text-xs text-slate-400">
          {doneCount}/{VISA_STEPS.length} 步
        </span>
        <div className="flex-1" />
        <Button
          size="xs"
          variant="ghost"
          title="删除这条签证"
          onClick={async () => (await confirmDialog({ title: '删除这条签证记录？', message: '时间线里的历史会保留。', confirmText: '删除', danger: true })) && deleteVisa(v.id)}
        >
          <Trash2 size={13} />
        </Button>
      </div>
      {/* 进度条 */}
      <div className="relative flex items-start justify-between">
        <div className="absolute top-3 right-[10%] left-[10%] h-0.5 bg-slate-200" />
        <div
          className="absolute top-3 left-[10%] h-0.5 bg-emerald-400 transition-all"
          style={{ width: `${(Math.max(0, VISA_STEPS.findLastIndex((s) => v[s.key])) / (VISA_STEPS.length - 1)) * 80}%` }}
        />
        {VISA_STEPS.map((step) => {
          const date = v[step.key]
          return (
            <div key={step.key} className="relative z-10 flex w-1/5 flex-col items-center text-center">
              {date ? (
                <Popover
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-on-accent shadow-sm hover:bg-emerald-600"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                >
                  {(close) => (
                    <div className="w-48 p-1">
                      <div className="px-2 pb-1 text-xs text-slate-500">「{step.label}」的日期</div>
                      <DateField
                        value={date}
                        clearable={false}
                        size="sm"
                        onChange={(d) => {
                          if (d) toggleVisaStep(v.id, step.key, d)
                          close()
                        }}
                      />
                      <MenuItem
                        danger
                        onClick={() => {
                          close()
                          toggleVisaStep(v.id, step.key)
                        }}
                      >
                        撤销勾选
                      </MenuItem>
                    </div>
                  )}
                </Popover>
              ) : (
                <button
                  type="button"
                  title={`点一下标记「${step.label}」（今天）`}
                  onClick={() => toggleVisaStep(v.id, step.key)}
                  className="h-6 w-6 rounded-full border-2 border-slate-300 bg-white hover:border-emerald-400"
                />
              )}
              <div className={cx('mt-1 text-xs', date ? 'font-medium text-slate-800' : 'text-slate-500')}>{step.label}</div>
              <div className="text-[11px] text-slate-400 tabular-nums">{date ? fmtDate(date) : ''}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[13px]">
        <span className="text-slate-500">当前签证到期日</span>
        <DateField value={v.expiry_date} onChange={(d) => updateVisa(v.id, { expiry_date: d })} size="sm" className="w-36" />
        {exp && exp.daysLeft !== null && <ExpiryPill days={exp.daysLeft} />}
        {exp?.reminderDue && (
          <Button size="xs" variant="soft" onClick={() => ackVisaExpiry(v.id)}>
            <Megaphone size={12} /> 已提醒学生
          </Button>
        )}
        <span className="text-xs text-slate-400">提前 60 / 30 / 7 天提醒</span>
      </div>
      <div className="mt-1">
        <InlineText
          value={v.note}
          placeholder="签证备注（可选）"
          onSave={(t) => updateVisa(v.id, { note: t })}
          className="text-[13px] text-slate-600"
        />
      </div>
    </div>
  )
}

export function Visas({ info }: { info: StudentInfo }) {
  const [type, setType] = useState('500')
  const [adding, setAdding] = useState(false)
  return (
    <Box
      icon="🛂"
      title="签证"
      count={info.visas.length}
      right={
        adding ? (
          <span className="inline-flex items-center gap-1.5">
            <select className="input input-sm w-auto" value={type} onChange={(e) => setType(e.target.value)}>
              {VISA_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                addVisa(info.s.id, { visa_type: type })
                setAdding(false)
              }}
            >
              添加
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              取消
            </Button>
          </span>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> 添加签证
          </Button>
        )
      }
    >
      <div className="space-y-2">
        {info.visas.map((v) => (
          <VisaCard key={v.id} v={v} />
        ))}
        {!info.visas.length && (
          <div className="py-1 text-[13px] text-slate-400">每一步点一下打勾，会自动记日期并写入时间线。</div>
        )}
      </div>
    </Box>
  )
}

export function KeyDates({ info }: { info: StudentInfo }) {
  const today = useStore((s) => s.today)
  const [kind, setKind] = useState<KeyDateKind>('开学')
  const [date, setDate] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const add = () => {
    if (!date) return
    addKeyDate(info.s.id, { kind, date, note: note.trim() })
    setDate(null)
    setNote('')
  }
  return (
    <Box icon="📅" title="关键日期" count={info.keyDates.length}>
      <div className="mb-1 text-xs text-slate-400">offer 相关的截止日在「申请学校」里</div>
      <div className="space-y-1">
        {info.keyDates.map((k) => {
          const d = keyDateDeadline(k, today)
          const past = d.daysLeft! < 0
          return (
            <div key={k.id} className={cx('group flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50', past && 'opacity-55')}>
              <span>{KEYDATE_ICON[k.kind]}</span>
              <span className="w-24 text-[13px] font-medium">{k.kind}</span>
              <DateField value={k.date} clearable={false} onChange={(v) => v && updateKeyDate(k.id, { date: v })} size="sm" className="w-36" />
              {(!past || k.kind === '签证到期') && <ExpiryPill days={d.daysLeft!} visa={k.kind === '签证到期'} />}
              <InlineText value={k.note} placeholder="说明" onSave={(t) => updateKeyDate(k.id, { note: t })} className="!w-auto min-w-[8rem] flex-1 text-[13px]" />
              {d.reminderDue && (
                <Button size="xs" variant="soft" onClick={() => ackKeyDate(k.id)}>
                  <Megaphone size={12} /> 已提醒
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100"
                onClick={async () => (await confirmDialog({ title: `删除关键日期「${k.kind} ${fmtDate(k.date)}」？`, confirmText: '删除', danger: true })) && deleteKeyDate(k.id)}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2">
        <select className="input input-sm w-auto" value={kind} onChange={(e) => setKind(e.target.value as KeyDateKind)}>
          {KEYDATE_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <DateField value={date} onChange={setDate} size="sm" className="w-36" />
        <input
          className="input input-sm min-w-[8rem] flex-1"
          placeholder="说明（可选）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isComposing(e) && add()}
        />
        <Button size="sm" variant="primary" disabled={!date} onClick={add}>
          添加
        </Button>
      </div>
    </Box>
  )
}

export function Payments({ info }: { info: StudentInfo }) {
  const today = useStore((s) => s.today)
  const payments = useStore((s) => s.payments)
  const list = payments
    .filter((p) => p.student_id === info.s.id)
    .sort((a, b) => ((a.paid_on ?? '') < (b.paid_on ?? '') ? 1 : -1))
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('AUD')
  const [date, setDate] = useState<string | null>(today)
  const [note, setNote] = useState('')
  const totals = new Map<string, number>()
  for (const p of list) if (p.amount) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount)
  const add = () => {
    if (!item.trim() && !amount) return
    addPayment(info.s.id, {
      item: item.trim(),
      amount: amount ? Number(amount) : null,
      currency,
      paid_on: date,
      note: note.trim(),
    })
    setItem('')
    setAmount('')
    setNote('')
    setDate(today)
  }
  return (
    <Box
      icon="💰"
      title="收费"
      count={list.length}
      unit="笔"
      defaultOpen={false}
      right={[...totals].map(([c, t]) => (
        <span key={c} className="text-xs text-slate-500">
          合计 <b className="text-slate-800">{fmtMoney(t, c)}</b>
        </span>
      ))}
    >
      {list.length > 0 && (
        <table className="mb-2 w-full text-[13px]">
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="group border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-2 text-slate-500 tabular-nums">{fmtDate(p.paid_on)}</td>
                <td className="py-1.5 pr-2 font-medium">{p.item || '—'}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{fmtMoney(p.amount, p.currency)}</td>
                <td className="py-1.5 pr-2 text-slate-500">{p.note}</td>
                <td className="w-8 py-1.5 text-right">
                  <button
                    type="button"
                    className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500"
                    onClick={async () => (await confirmDialog({ title: `删除收费记录「${p.item || '未命名'}」？`, message: '时间线里会记一条删除记录。', confirmText: '删除', danger: true })) && deletePayment(p.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-2">
        <input className="input input-sm w-32" placeholder="项目，如服务费" value={item} onChange={(e) => setItem(e.target.value)} />
        <input
          className="input input-sm w-24"
          placeholder="金额"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
        />
        <select className="input input-sm w-auto" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <DateField value={date} onChange={setDate} size="sm" className="w-36" />
        <input className="input input-sm min-w-[6rem] flex-1" placeholder="备注" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="primary" onClick={add} disabled={!item.trim() && !amount}>
          记一笔收费
        </Button>
      </div>
    </Box>
  )
}

