// 云端模式：数据存在 Supabase（每个账号只能看到自己的数据，见 supabase/schema.sql）
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { DBState, TableName } from '../lib/types'
import { emptyDB, TABLES, type Adapter, type Op } from './adapter'

const DB_TABLE: Record<TableName, string> = {
  students: 'students',
  applications: 'applications',
  visas: 'visas',
  key_dates: 'key_dates',
  tasks: 'tasks',
  payments: 'payments',
  events: 'timeline_events',
  review_items: 'review_items',
}

const TS_FIELDS = ['created_at', 'updated_at', 'edited_at', 'resolved_at']

function normalizeRow(row: Record<string, unknown>) {
  const out = { ...row }
  delete out.owner_id
  for (const f of TS_FIELDS) {
    const v = out[f]
    if (typeof v === 'string') out[f] = new Date(v).toISOString()
  }
  if (typeof out.amount === 'string') out.amount = Number(out.amount)
  return out
}

async function fetchAll(sb: SupabaseClient, table: string) {
  const rows: Record<string, unknown>[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`读取 ${table} 失败：${error.message}`)
    rows.push(...(data ?? []).map(normalizeRow))
    if (!data || data.length < page) break
  }
  return rows
}

export function createSupabaseAdapter(sb: SupabaseClient): Adapter {
  return {
    kind: 'supabase',
    async loadAll() {
      const db: DBState = emptyDB({ ...DEFAULT_SETTINGS })
      const results = await Promise.all(TABLES.map((t) => fetchAll(sb, DB_TABLE[t])))
      TABLES.forEach((t, i) => ((db as any)[t] = results[i]))
      const { data, error } = await sb.from('app_settings').select('data').maybeSingle()
      if (error) throw new Error(`读取设置失败：${error.message}`)
      if (data?.data) db.settings = { ...DEFAULT_SETTINGS, ...(data.data as object) }
      return db
    },
    async apply(op: Op) {
      let error: { message: string } | null = null
      switch (op.op) {
        case 'insert': {
          // 分批写入，避免一次请求太大
          for (let i = 0; i < op.rows.length; i += 500) {
            const res = await sb.from(DB_TABLE[op.table]).upsert(op.rows.slice(i, i + 500) as any[])
            if (res.error) {
              error = res.error
              break
            }
          }
          break
        }
        case 'update':
          ;({ error } = await sb.from(DB_TABLE[op.table]).update(op.patch).eq('id', op.id))
          break
        case 'remove':
          ;({ error } = await sb.from(DB_TABLE[op.table]).delete().eq('id', op.id))
          break
        case 'settings': {
          const { data: u } = await sb.auth.getUser()
          ;({ error } = await sb
            .from('app_settings')
            .upsert({ owner_id: u.user?.id, data: op.settings, updated_at: new Date().toISOString() }))
          break
        }
        case 'reset':
          ;({ error } = await sb.rpc('reset_all_data'))
          break
      }
      if (error) throw new Error(error.message)
    },
  }
}
