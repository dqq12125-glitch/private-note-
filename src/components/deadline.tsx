import { Megaphone } from 'lucide-react'
import type { Deadline } from '../lib/reminders'
import { ackKeyDate, ackVisaExpiry, remindApp } from '../data/actions'
import { useStore } from '../data/store'
import { Button } from './ui'

export function ackDeadline(d: Deadline) {
  if (d.ref.table === 'applications') remindApp(d.ref.id)
  else if (d.ref.table === 'visas') ackVisaExpiry(d.ref.id)
  else if (d.ref.table === 'key_dates') ackKeyDate(d.ref.id)
}

export function AckButton({ d, label = '已提醒学生' }: { d: Deadline; label?: string }) {
  const today = useStore((s) => s.today)
  if (d.ackOn === today)
    return <span className="text-xs whitespace-nowrap text-emerald-600">✓ 今天已提醒</span>
  return (
    <Button size="xs" variant={d.reminderDue ? 'soft' : 'ghost'} onClick={() => ackDeadline(d)}>
      <Megaphone size={12} /> {label}
    </Button>
  )
}
