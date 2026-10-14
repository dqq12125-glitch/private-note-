import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/lib/constants'
import { emptyDB, type Adapter, type Op } from '../src/data/adapter'
import { enqueue, initData, useStore } from '../src/data/store'

afterEach(() => vi.useRealTimers())

describe('write queue', () => {
  it('skips a write the database permanently rejects instead of blocking later writes', async () => {
    vi.useFakeTimers()
    const applied: Op[] = []
    const adapter: Adapter = {
      kind: 'supabase',
      async loadAll() {
        return emptyDB({ ...DEFAULT_SETTINGS })
      },
      async apply(op) {
        if (op.op === 'remove') throw Object.assign(new Error('violates foreign key constraint'), { code: '23503' })
        applied.push(op)
      },
    }
    await initData(adapter, null, 'user-1')
    enqueue({ op: 'remove', table: 'events', id: 'x' })
    enqueue({ op: 'update', table: 'students', id: 'y', patch: { name: 'n' } })
    // 失败 3 次（重试间隔 2s、4s）后跳过
    await vi.advanceTimersByTimeAsync(7_000)
    expect(applied.map((o) => o.op)).toEqual(['update'])
    expect(useStore.getState().sync.pending).toBe(0)
    expect(useStore.getState().toasts.some((t) => t.tone === 'error')).toBe(true)
  })
  it('keeps retrying network errors', async () => {
    vi.useFakeTimers()
    let fail = true
    const applied: Op[] = []
    const adapter: Adapter = {
      kind: 'supabase',
      async loadAll() {
        return emptyDB({ ...DEFAULT_SETTINGS })
      },
      async apply(op) {
        if (fail) throw new Error('Failed to fetch')
        applied.push(op)
      },
    }
    await initData(adapter, null, 'user-2')
    enqueue({ op: 'update', table: 'students', id: 'y', patch: { name: 'n' } })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(applied).toHaveLength(0)
    expect(useStore.getState().sync.pending).toBe(1)
    fail = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(applied).toHaveLength(1)
  })
})
