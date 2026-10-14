// 托管在 claude.ai 时的存储：Artifact 自带的云端文档数据库（db 能力）。
// 每张表一个集合：t/<表名>/rows/<id>；设置存在 meta/settings。
// 访问规则在发布时声明：只有页面的所有者（和以后被设为「编辑者」的同事）能读写。
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { DBState, TableName } from '../lib/types'
import { emptyDB, TABLES, type Adapter, type Op } from './adapter'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any

const rowsPath = (t: TableName) => `t/${t}/rows`
const SETTINGS_DOC = 'meta/settings'
const PAGE = 1000
const CONCURRENCY = 4

/** 去掉 undefined 等不能存的值 */
function clean<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** 把 db 的错误转成带 code 的 Error，写入队列据此判断要不要重试 */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    throw Object.assign(new Error(e?.message ?? String(e)), { code: e?.code ?? '' })
  }
}

async function pool<T>(items: T[], fn: (x: T) => Promise<void>) {
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const x = items[i++]
      await fn(x)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
}

/** 分页读出一个集合的全部文档（按文档 id 排序，每页 1000 条） */
async function fetchAll(db: Db, path: string, where?: [string, string, unknown]): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let last: string | null = null
  for (;;) {
    let q = db.collection(path)
    if (where) q = q.where(...where)
    if (last) q = q.where('id', '>', last)
    const snap: any = await call(() => q.limit(PAGE).get())
    for (const d of snap.docs as any[]) {
      const data = d.data()
      if (data) out.push(structuredClone(data))
    }
    if (snap.size < PAGE) break
    last = (snap.docs as any[])[snap.docs.length - 1].id
  }
  return out
}

export function createArtifactAdapter(db: Db): Adapter {
  return {
    kind: 'artifact',
    async loadAll() {
      const state: DBState = emptyDB({ ...DEFAULT_SETTINGS })
      const results = await Promise.all(TABLES.map((t) => fetchAll(db, rowsPath(t))))
      TABLES.forEach((t, i) => ((state as any)[t] = results[i]))
      const s = await call(() => db.doc(SETTINGS_DOC).get())
      if ((s as any).exists) state.settings = { ...DEFAULT_SETTINGS, ...((s as any).data() as object) }
      return state
    },
    async apply(op: Op) {
      switch (op.op) {
        case 'insert':
          await pool(op.rows as { id: string }[], (r) =>
            call(() => db.collection(rowsPath(op.table)).doc(r.id).set(clean(r))),
          )
          break
        case 'update':
          await call(() => db.collection(rowsPath(op.table)).doc(op.id).update(clean(op.patch)))
          break
        case 'remove':
          if (op.table === 'students') {
            // 和数据库的级联删除一样：先删这个学生的所有记录
            for (const t of TABLES) {
              if (t === 'students') continue
              const rows = await fetchAll(db, rowsPath(t), ['student_id', '==', op.id])
              await pool(rows as { id: string }[], (r) => call(() => db.collection(rowsPath(t)).doc(r.id).delete()))
            }
          }
          await call(() => db.collection(rowsPath(op.table)).doc(op.id).delete())
          break
        case 'settings':
          await call(() => db.doc(SETTINGS_DOC).set(clean(op.settings) as any))
          break
        case 'reset':
          for (const t of TABLES) {
            const rows = await fetchAll(db, rowsPath(t))
            await pool(rows as { id: string }[], (r) => call(() => db.collection(rowsPath(t)).doc(r.id).delete()))
          }
          break
      }
    },
  }
}
