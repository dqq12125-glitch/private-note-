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

// 排队中的写入按账号分开存，换账号登录时不会把别人的修改写进来
let queueKey = 'pending-ops-v1:local'
let adapter: Adapter | null = null
let queue: Op[] = []
let running = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let attempt = 0
/** 每次有新修改就 +1，用来判断重新加载期间有没有新修改 */
let mutationSeq = 0
/** 启动时有没写完的修改：写完后重新加载一次 */
let reloadAfterFlush = false

/** 写入失败的原因是不是「再试也没用」（数据库拒绝，例如学生已被删除、权限不足） */
function isPermanent(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? ''
  return /^(22|23|42|PGRST)/.test(code)
}
const MAX_PERMANENT_ATTEMPTS = 3

function describeOp(op: Op): string {
  if (op.op === 'insert') return `新增 ${op.table}`
  if (op.op === 'update') return `修改 ${op.table}`
  if (op.op === 'remove') return `删除 ${op.table}`
  return op.op
}

function saveQueue() {
  try {
    if (queue.length) localStorage.setItem(queueKey, JSON.stringify(queue))
    else localStorage.removeItem(queueKey)
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

function loadQueue(): Op[] {
  try {
    const raw = localStorage.getItem(queueKey)
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
        if (isPermanent(e) && attempt >= MAX_PERMANENT_ATTEMPTS) {
          // 数据库明确拒绝（比如这个学生已经在别的设备上删掉了）：跳过这一条，别挡住后面的修改
          const dropped = queue.shift()!
          attempt = 0
          saveQueue()
          console.error('写入被拒绝，已跳过', dropped, e)
          toast(`有一条修改没能保存（${describeOp(dropped)}：${msg}），已跳过。可以刷新页面看看最新数据。`, {
            tone: 'error',
            ttl: 12000,
          })
          setSync(null)
          continue
        }
        setSync(msg)
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5))
        if (retryTimer) clearTimeout(retryTimer)
        retryTimer = setTimeout(() => void pump(), delay)
        return
      }
    }
    if (reloadAfterFlush) {
      reloadAfterFlush = false
      void reloadData()
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
  mutationSeq++
  queue.push(op)
  saveQueue()
  setSync(useStore.getState().sync.error)
  void pump()
}

export function hasPendingWrites() {
  return queue.length > 0
}

export async function initData(a: Adapter, userEmail: string | null, userId: string | null = null) {
  endSession()
  adapter = a
  queueKey = `pending-ops-v1:${userId ?? 'local'}`
  useStore.setState({ phase: 'loading', mode: a.kind, userEmail, loadError: null })
  // 先试着把上次没写完的操作写完；写不完也照样加载，后台继续重试
  queue = loadQueue()
  setSync(null)
  if (queue.length) {
    await pump()
    if (queue.length) reloadAfterFlush = true
  }
  try {
    const db = await a.loadAll()
    useStore.setState({ ...db, phase: 'ready', today: todayStr() })
  } catch (e) {
    useStore.setState({ phase: 'error', loadError: e instanceof Error ? e.message : String(e) })
  }
}

/** 退出登录：停止写入，清空内存里的队列（没写完的修改留在本机，下次这个账号登录时继续写） */
export function endSession() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  adapter = null
  queue = []
  attempt = 0
  reloadAfterFlush = false
  setSync(null)
}

/** 重新从存储读一遍（例如手机上改过，电脑切回来时） */
export async function reloadData() {
  if (!adapter || adapter.kind === 'local' || queue.length) return
  const seq = mutationSeq
  const a = adapter
  try {
    const db = await a.loadAll()
    // 加载期间有新修改，或者已经换了账号：丢掉这次的结果，免得覆盖新修改
    if (seq !== mutationSeq || queue.length || adapter !== a) return
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
