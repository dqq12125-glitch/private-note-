import { create } from 'zustand'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { nowIso, todayStr } from '../lib/dates'
import type { DBState, RowOf, Settings, TableName } from '../lib/types'
import { emptyDB, type Adapter, type Op } from './adapter'

export interface Toast {
  id: number
  text: string
  tone?: 'ok' | 'error' | 'info'
  action?: { label: string; run: () => void }
  ttl?: number
}

export interface AppState extends DBState {
  phase: 'boot' | 'loading' | 'ready' | 'error'
  loadError: string | null
  mode: 'local' | 'supabase'
  userEmail: string | null
  today: string
  sync: { pending: number; error: string | null }
  toasts: Toast[]
  quick: { open: boolean; studentId: string | null }
  palette: boolean
}

export const useStore = create<AppState>(() => ({
  ...emptyDB({ ...DEFAULT_SETTINGS }),
  phase: 'boot',
  loadError: null,
  mode: 'local',
  userEmail: null,
  today: todayStr(),
  sync: { pending: 0, error: null },
  toasts: [],
  quick: { open: false, studentId: null },
  palette: false,
}))

// ───────────────────────── 写入队列 ─────────────────────────
// 界面先更新（乐观更新），再按顺序写到存储里；失败会自动重试，排队中的操作会存到 localStorage，刷新后继续。

const QUEUE_KEY = 'pending-ops-v1'
let adapter: Adapter | null = null
let queue: Op[] = []
let running = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0

function saveQueue() {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

function loadQueue(): Op[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as Op[]) : []
  } catch {
    return []
  }
}

function setSync(error: string | null) {
  useStore.setState({ sync: { pending: queue.length, error } })
}

async function pump() {
  if (running || !adapter) return
  running = true
  try {
    while (queue.length) {
      try {
        await adapter.apply(queue[0])
        queue.shift()
        attempt = 0
        saveQueue()
        setSync(null)
      } catch (e) {
        attempt++
        const msg = e instanceof Error ? e.message : String(e)
        setSync(msg)
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5))
        if (retryTimer) clearTimeout(retryTimer)
        retryTimer = setTimeout(() => void pump(), delay)
        return
      }
    }
  } finally {
    running = false
  }
}

export function retrySync() {
  attempt = 0
  void pump()
}

export function enqueue(op: Op) {
  queue.push(op)
  saveQueue()
  setSync(useStore.getState().sync.error)
  void pump()
}

export function hasPendingWrites() {
  return queue.length > 0
}

export async function initData(a: Adapter, userEmail: string | null) {
  adapter = a
  useStore.setState({ phase: 'loading', mode: a.kind, userEmail, loadError: null })
  // 先把上次没写完的操作写完
  queue = loadQueue()
  setSync(null)
  if (queue.length) {
    await pump()
    if (queue.length) {
      useStore.setState({ phase: 'error', loadError: `有 ${queue.length} 条修改还没保存成功：${useStore.getState().sync.error ?? ''}` })
      return
    }
  }
  try {
    const db = await a.loadAll()
    useStore.setState({ ...db, phase: 'ready', today: todayStr() })
  } catch (e) {
    useStore.setState({ phase: 'error', loadError: e instanceof Error ? e.message : String(e) })
  }
}

/** 重新从存储读一遍（例如手机上改过，电脑切回来时） */
export async function reloadData() {
  if (!adapter || queue.length) return
  try {
    const db = await adapter.loadAll()
    useStore.setState({ ...db, today: todayStr() })
  } catch {
    /* 忽略，下次再试 */
  }
}

// ───────────────────────── 基础读写 ─────────────────────────

const HAS_UPDATED_AT: TableName[] = ['students', 'applications', 'visas', 'key_dates', 'tasks', 'payments']

export function insertRows<T extends TableName>(table: T, rows: RowOf<T>[]) {
  if (!rows.length) return
  useStore.setState((s) => ({ [table]: [...(s[table] as RowOf<T>[]), ...rows] }) as Partial<AppState>)
  enqueue({ op: 'insert', table, rows: rows as RowOf<TableName>[] })
}

export function patchRow<T extends TableName>(table: T, id: string, patch: Partial<RowOf<T>>) {
  const p: Record<string, unknown> = { ...patch }
  if (HAS_UPDATED_AT.includes(table)) p.updated_at = nowIso()
  useStore.setState(
    (s) =>
      ({
        [table]: (s[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...p } : r)),
      }) as Partial<AppState>,
  )
  enqueue({ op: 'update', table, id, patch: p })
}

export function removeRow(table: TableName, id: string) {
  useStore.setState(
    (s) => ({ [table]: (s[table] as { id: string }[]).filter((r) => r.id !== id) }) as Partial<AppState>,
  )
  enqueue({ op: 'remove', table, id })
}

export function saveSettings(patch: Partial<Settings>) {
  const settings = { ...useStore.getState().settings, ...patch }
  useStore.setState({ settings })
  enqueue({ op: 'settings', settings })
}

export function resetAllData() {
  const s = useStore.getState()
  useStore.setState({ ...emptyDB(s.settings) })
  enqueue({ op: 'reset' })
}

// ───────────────────────── 提示条 ─────────────────────────

let toastSeq = 0
export function toast(text: string, opts: Omit<Toast, 'id' | 'text'> = {}) {
  // 同样的提示已经在显示，就不重复弹
  const existing = useStore.getState().toasts.find((t) => t.text === text)
  if (existing) return existing.id
  const id = ++toastSeq
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, ...opts }] }))
  setTimeout(() => dismissToast(id), opts.ttl ?? (opts.action ? 8000 : 3500))
  return id
}

export function dismissToast(id: number) {
  useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

// ───────────────────────── 每分钟检查是否过了午夜（悉尼） ─────────────────────────

if (typeof window !== 'undefined') {
  setInterval(() => {
    const t = todayStr()
    if (t !== useStore.getState().today) useStore.setState({ today: t })
  }, 60_000)
}
