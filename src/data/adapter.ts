import type { DBState, RowOf, Settings, TableName } from '../lib/types'

export type Op =
  | { op: 'insert'; table: TableName; rows: RowOf<TableName>[] }
  | { op: 'update'; table: TableName; id: string; patch: Record<string, unknown> }
  | { op: 'remove'; table: TableName; id: string }
  | { op: 'settings'; settings: Settings }
  | { op: 'reset' }

export interface Adapter {
  kind: 'local' | 'supabase'
  loadAll(): Promise<DBState>
  apply(op: Op): Promise<void>
}

export function emptyDB(settings: Settings): DBState {
  return {
    students: [],
    applications: [],
    visas: [],
    key_dates: [],
    tasks: [],
    payments: [],
    events: [],
    review_items: [],
    settings,
  }
}

export const TABLES: TableName[] = [
  'students',
  'applications',
  'visas',
  'key_dates',
  'tasks',
  'payments',
  'events',
  'review_items',
]
