// 本地模式：数据存在浏览器的 IndexedDB 里（没配置 Supabase 时使用）
import { createStore, get, set } from 'idb-keyval'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { DBState, TableName } from '../lib/types'
import { emptyDB, TABLES, type Adapter, type Op } from './adapter'

const KEY = 'db-v1'

export function createLocalAdapter(): Adapter {
  const store = createStore('student-tracker', 'kv')
  let db: DBState | null = null
  const persist = () => set(KEY, db, store)

  return {
    kind: 'local',
    async loadAll() {
      const saved = (await get(KEY, store)) as DBState | undefined
      db = emptyDB({ ...DEFAULT_SETTINGS })
      if (saved) {
        for (const t of TABLES) (db as any)[t] = Array.isArray((saved as any)[t]) ? (saved as any)[t] : []
        db.settings = { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }
      }
      return structuredClone(db)
    },
    async apply(op: Op) {
      if (!db) await this.loadAll()
      const d = db!
      switch (op.op) {
        case 'insert': {
          const list = d[op.table] as { id: string }[]
          for (const r of op.rows as { id: string }[]) {
            const i = list.findIndex((x) => x.id === r.id)
            if (i >= 0) list[i] = structuredClone(r)
            else list.push(structuredClone(r))
          }
          break
        }
        case 'update': {
          const list = d[op.table] as { id: string }[]
          const i = list.findIndex((x) => x.id === op.id)
          if (i >= 0) list[i] = { ...list[i], ...structuredClone(op.patch) }
          break
        }
        case 'remove': {
          ;(d as any)[op.table] = (d[op.table as TableName] as { id: string }[]).filter((x) => x.id !== op.id)
          // 删除学生时，连同他的所有记录一起删（和数据库里的 on delete cascade 一样）
          if (op.table === 'students')
            for (const t of TABLES)
              if (t !== 'students')
                (d as any)[t] = (d[t] as { student_id: string }[]).filter((x) => x.student_id !== op.id)
          break
        }
        case 'settings':
          d.settings = structuredClone(op.settings)
          break
        case 'reset':
          db = emptyDB(d.settings)
          break
      }
      await persist()
    },
  }
}
