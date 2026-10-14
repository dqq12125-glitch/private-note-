import { useMemo } from 'react'
import { computeStudentInfos, type StudentInfo } from '../lib/reminders'
import type { DBState } from '../lib/types'
import { useStore } from './store'

// 所有页面共用一份计算结果：输入（各表数组 + 今天）没变就直接返回上次的结果
let lastKey: unknown[] = []
let lastVal: StudentInfo[] = []
function memoInfos(db: DBState, today: string): StudentInfo[] {
  const key = [db.students, db.applications, db.visas, db.key_dates, db.tasks, db.events, today]
  if (key.length === lastKey.length && key.every((k, i) => k === lastKey[i])) return lastVal
  lastKey = key
  lastVal = computeStudentInfos(db, today)
  return lastVal
}

export function useInfos(): StudentInfo[] {
  const students = useStore((s) => s.students)
  const applications = useStore((s) => s.applications)
  const visas = useStore((s) => s.visas)
  const key_dates = useStore((s) => s.key_dates)
  const tasks = useStore((s) => s.tasks)
  const events = useStore((s) => s.events)
  const today = useStore((s) => s.today)
  return memoInfos(
    { students, applications, visas, key_dates, tasks, events } as DBState,
    today,
  )
}

export function useInfoMap(): Map<string, StudentInfo> {
  const infos = useInfos()
  return useMemo(() => new Map(infos.map((i) => [i.s.id, i])), [infos])
}

export function useStudentInfo(id: string | null | undefined): StudentInfo | null {
  const map = useInfoMap()
  return id ? (map.get(id) ?? null) : null
}

export function useStudentName(): (id: string) => string {
  const students = useStore((s) => s.students)
  return useMemo(() => {
    const m = new Map(students.map((s) => [s.id, s.name]))
    return (id: string) => m.get(id) ?? '（已删除）'
  }, [students])
}
