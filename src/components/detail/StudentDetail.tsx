import { useStudentInfo } from '../../data/hooks'
import { Applications } from './Applications'
import { StudentHeader } from './Header'
import { KeyDates, Payments, Visas } from './Others'
import { NextSteps } from './Tasks'
import { Timeline } from './Timeline'

/** 学生详情：左栏信息，右栏时间线（容器够宽时两栏，不够宽时上下排） */
export function StudentDetail({ id, compact }: { id: string; compact?: boolean }) {
  const info = useStudentInfo(id)
  if (!info) return <div className="p-8 text-center text-slate-400">找不到这个学生（可能已被删除）</div>
  return (
    <div className="@container">
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <StudentHeader info={info} compact={compact} />
          <NextSteps info={info} />
          <Applications info={info} />
          <Visas info={info} />
          <KeyDates info={info} />
          <Payments info={info} />
        </div>
        <div className="min-w-0">
          <div className="card p-4">
            <Timeline info={info} compact={compact} />
          </div>
        </div>
      </div>
    </div>
  )
}
