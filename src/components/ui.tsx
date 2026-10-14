import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import { addDays, addMonths, fmtDate, fmtDaysLeft, parseUserDate, weekday } from '../lib/dates'
import { offerUrgency } from '../lib/reminders'
import { dismissToast, useStore } from '../data/store'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

// ───────────────────────── 按钮 ─────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-xs disabled:bg-brand-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-white text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'xs' | 'sm' | 'md' | 'lg' }
>(function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) {
  const sz =
    size === 'xs'
      ? 'h-6 px-1.5 text-xs gap-1 rounded'
      : size === 'sm'
        ? 'h-7 px-2.5 text-[13px] gap-1 rounded-md'
        : size === 'lg'
          ? 'h-11 px-5 text-base gap-2 rounded-lg'
          : 'h-8 px-3 text-sm gap-1.5 rounded-md'
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60',
        sz,
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  )
})

// ───────────────────────── 输入 ─────────────────────────

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean; minRows?: number }
>(function TextArea({ autoGrow = true, minRows = 2, className, onInput, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  const setRef = (el: HTMLTextAreaElement | null) => {
    inner.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  const grow = () => {
    const el = inner.current
    if (!el || !autoGrow) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 420)}px`
  }
  useLayoutEffect(grow, [rest.value])
  return (
    <textarea
      ref={setRef}
      rows={minRows}
      className={cx('input resize-none leading-relaxed', className)}
      onInput={(e) => {
        grow()
        onInput?.(e)
      }}
      {...rest}
    />
  )
})

/** 失焦或回车时才保存的输入框 */
export function InlineText({
  value,
  onSave,
  placeholder,
  className,
  multiline,
  autoWidth,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  /** 宽度跟着内容变 */
  autoWidth?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => {
    if (v !== value) onSave(v.trim())
  }
  if (multiline)
    return (
      <TextArea
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        className={cx('border-transparent bg-transparent shadow-none hover:border-slate-200 focus:bg-white', className)}
      />
    )
  return (
    <input
      value={v}
      placeholder={placeholder}
      style={autoWidth ? { width: `calc(${Math.max(3, [...(v || placeholder || '')].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 1 : 0.55), 0))}em + 1.2rem)` } : undefined}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setV(value)
          e.stopPropagation()
        }
      }}
      className={cx(
        'input border-transparent bg-transparent shadow-none hover:border-slate-200 focus:bg-white',
        className,
      )}
    />
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  renderLabel,
}: {
  options: readonly T[]
  value: T | null
  onChange: (v: T) => void
  size?: 'xs' | 'sm'
  renderLabel?: (v: T) => ReactNode
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cx(
            'rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[13px]',
            value === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {renderLabel ? renderLabel(o) : o}
        </button>
      ))}
    </div>
  )
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string | null
  onChange: (key: string | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(value === o.key ? null : o.key)}
          className={cx(
            'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
            value === o.key
              ? 'bg-brand-600 text-white ring-brand-600'
              : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

// ───────────────────────── 浮层定位 ─────────────────────────

export function useFloating(anchor: RefObject<HTMLElement | null>, open: boolean, placement: 'bottom' | 'right' = 'bottom') {
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null)
  const floating = useRef<HTMLDivElement | null>(null)
  const update = useCallback(() => {
    const a = anchor.current
    const f = floating.current
    if (!a) return
    const r = a.getBoundingClientRect()
    const fw = f?.offsetWidth ?? 280
    const fh = f?.offsetHeight ?? 300
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top: number
    let left: number
    if (placement === 'right') {
      left = r.right + 8
      if (left + fw > vw - 8) left = Math.max(8, r.left - fw - 8)
      top = Math.min(Math.max(8, r.top - 8), vh - fh - 8)
    } else {
      left = Math.min(Math.max(8, r.left), vw - fw - 8)
      top = r.bottom + 4
      if (top + fh > vh - 8 && r.top - fh - 4 > 8) top = r.top - fh - 4
    }
    setPos({ top, left, maxH: vh - 16 })
  }, [anchor, placement])
  useLayoutEffect(() => {
    if (!open) return
    update()
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, update])
  return { floating, pos }
}

/** 点击按钮弹出的小菜单 */
export function Popover({
  trigger,
  children,
  className,
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement | null>(null)
  const { floating, pos } = useFloating(anchor, open)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (floating.current?.contains(t) || anchor.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, floating])
  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger({ open, toggle: () => setOpen((o) => !o) })}
      </span>
      {open &&
        createPortal(
          <div
            ref={floating}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxH }}
            className={cx(
              'animate-pop-in fixed z-[70] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
              className,
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  )
}

export function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] whitespace-nowrap',
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  )
}

// ───────────────────────── 日期选择 ─────────────────────────

const WD = ['一', '二', '三', '四', '五', '六', '日']

export function Calendar({ value, onPick, today }: { value: string | null; onPick: (d: string) => void; today: string }) {
  const [month, setMonth] = useState((value ?? today).slice(0, 7) + '-01')
  const first = month
  const offset = (weekday(first) + 6) % 7
  const start = addDays(first, -offset)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  return (
    <div className="w-64 p-2 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="rounded p-1 hover:bg-slate-100" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-semibold">
          {month.slice(0, 4)}年{Number(month.slice(5, 7))}月
        </div>
        <button type="button" className="rounded p-1 hover:bg-slate-100" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-slate-400">
        {WD.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 text-center text-[13px]">
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7)
          return (
            <button
              type="button"
              key={d}
              onClick={() => onPick(d)}
              className={cx(
                'm-0.5 rounded-md py-1',
                d === value
                  ? 'bg-brand-600 font-semibold text-white'
                  : d === today
                    ? 'font-semibold text-brand-600 ring-1 ring-brand-300 ring-inset hover:bg-brand-50'
                    : inMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50',
              )}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between border-t border-slate-100 pt-2">
        <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => onPick(today)}>
          今天
        </button>
        <span className="text-xs text-slate-400">也可以直接输入 20/11 或 20/11/2026</span>
      </div>
    </div>
  )
}

export function DateField({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  clearable = true,
  className,
  size = 'md',
  autoFocus,
  id,
}: {
  value: string | null
  onChange: (d: string | null) => void
  placeholder?: string
  clearable?: boolean
  className?: string
  size?: 'sm' | 'md'
  autoFocus?: boolean
  id?: string
}) {
  const today = useStore((s) => s.today)
  const [text, setText] = useState(fmtDate(value))
  const [bad, setBad] = useState(false)
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement | null>(null)
  const { floating, pos } = useFloating(anchor, open)
  useEffect(() => {
    setText(fmtDate(value))
    setBad(false)
  }, [value])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (floating.current?.contains(t) || anchor.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, floating])
  const commit = () => {
    if (!text.trim()) {
      if (clearable) onChange(null)
      else setText(fmtDate(value))
      setBad(false)
      return
    }
    const d = parseUserDate(text, today)
    if (d) {
      setBad(false)
      setText(fmtDate(d))
      if (d !== value) onChange(d)
    } else setBad(true)
  }
  return (
    <div ref={anchor} className={cx('relative', className)}>
      <input
        id={id}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            setOpen(false)
          }
          if (e.key === 'Escape' && open) {
            e.stopPropagation()
            setOpen(false)
          }
        }}
        className={cx('input pr-14 tabular-nums', size === 'sm' && 'input-sm', bad && 'border-rose-400 ring-2 ring-rose-100')}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {clearable && value && (
          <button
            type="button"
            tabIndex={-1}
            title="清空"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => onChange(null)}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          title="选日期"
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => setOpen((o) => !o)}
        >
          <CalendarDays size={15} />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={floating}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            className="animate-pop-in fixed z-[80] rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <Calendar
              value={value}
              today={today}
              onPick={(d) => {
                onChange(d)
                setOpen(false)
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}

/** 快捷日期按钮：明天 / 3天后 / 1周后 / 2周后 / 1个月后 */
export const QUICK_OFFSETS: { key: string; label: string; days?: number; months?: number }[] = [
  { key: '1d', label: '明天', days: 1 },
  { key: '3d', label: '3天后', days: 3 },
  { key: '1w', label: '1周后', days: 7 },
  { key: '2w', label: '2周后', days: 14 },
  { key: '1m', label: '1个月后', months: 1 },
]

export function offsetDate(key: string, today: string): string | null {
  const o = QUICK_OFFSETS.find((x) => x.key === key)
  if (!o) return null
  return o.months ? addMonths(today, o.months) : addDays(today, o.days ?? 0)
}

export function RemindPicker({
  value,
  onChange,
  label = '设提醒',
}: {
  value: string | null
  onChange: (d: string | null) => void
  label?: string
}) {
  const today = useStore((s) => s.today)
  const [key, setKey] = useState<string | null>(null)
  const [custom, setCustom] = useState(false)
  useEffect(() => {
    if (!value) {
      setKey(null)
      setCustom(false)
    }
  }, [value])
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <Chips
        options={[...QUICK_OFFSETS.map((o) => ({ key: o.key, label: o.label })), { key: 'custom', label: '选日期' }]}
        value={custom ? 'custom' : key}
        onChange={(k) => {
          if (k === 'custom') {
            setCustom(true)
            setKey(null)
            return
          }
          setCustom(false)
          setKey(k)
          onChange(k ? offsetDate(k, today) : null)
        }}
      />
      {custom && <DateField value={value} onChange={onChange} size="sm" className="w-36" autoFocus />}
      {value && !custom && <span className="text-xs text-slate-400">→ {fmtDate(value)}</span>}
    </div>
  )
}

// ───────────────────────── 剩余天数 ─────────────────────────

const URGENCY_STYLE = {
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  none: 'bg-slate-50 text-slate-600 ring-slate-200',
}
const URGENCY_DOT = { red: '🔴', orange: '🟠', yellow: '🟡', none: '⚪' }

export function DaysLeft({
  days,
  scale = 'offer',
  tbc,
  dot,
}: {
  days: number | null
  scale?: 'offer' | 'week'
  tbc?: boolean
  dot?: boolean
}) {
  if (tbc) return <span className={cx('tag', URGENCY_STYLE.orange)}>待确认</span>
  if (days === null) return null
  const u =
    scale === 'week' ? (days <= 7 ? 'red' : days <= 14 ? 'yellow' : 'none') : offerUrgency(days)
  return (
    <span className={cx('tag tabular-nums', URGENCY_STYLE[u])}>
      {dot && URGENCY_DOT[u]} {fmtDaysLeft(days)}
    </span>
  )
}

// ───────────────────────── 弹窗 / 侧边面板 ─────────────────────────

const escStack: (() => void)[] = []
if (typeof window !== 'undefined')
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !escStack.length || e.defaultPrevented) return
    e.preventDefault()
    escStack[escStack.length - 1]()
  })

export function useEscape(onEsc: () => void, active = true) {
  const ref = useRef(onEsc)
  ref.current = onEsc
  useEffect(() => {
    if (!active) return
    const fn = () => ref.current()
    escStack.push(fn)
    return () => {
      const i = escStack.lastIndexOf(fn)
      if (i >= 0) escStack.splice(i, 1)
    }
  }, [active])
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEscape(onClose, open)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/30 p-3 pt-[8vh] backdrop-blur-[1px]">
      <div className="fixed inset-0" onMouseDown={onClose} />
      <div className={cx('animate-pop-in relative w-full rounded-xl bg-white shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-[15px] font-semibold text-slate-900">{title}</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ───────────────────────── 提示条 ─────────────────────────

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="no-print pointer-events-none fixed bottom-20 left-1/2 z-[90] flex w-[min(92vw,520px)] -translate-x-1/2 flex-col gap-2 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'animate-pop-in pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg',
            t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white',
          )}
        >
          <span className="flex-1">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="rounded bg-white/15 px-2 py-0.5 text-[13px] font-medium hover:bg-white/25"
              onClick={() => {
                t.action!.run()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="text-white/60 hover:text-white" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-6 text-center text-[13px] text-slate-400">{children}</div>
}

export function SectionTitle({ children, right, count }: { children: ReactNode; right?: ReactNode; count?: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h2 className="text-[15px] font-semibold text-slate-900">{children}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-500 tabular-nums">{count}</span>
      )}
      <div className="flex-1" />
      {right}
    </div>
  )
}
