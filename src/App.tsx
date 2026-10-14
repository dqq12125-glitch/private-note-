import { useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { createLocalAdapter } from './data/localAdapter'
import { createSupabaseAdapter } from './data/supabaseAdapter'
import { hasPendingWrites, initData, reloadData, useStore } from './data/store'
import { supabase } from './data/supabase'
import { emptyDB } from './data/adapter'
import { Shell } from './components/Shell'
import { Button } from './components/ui'
import { HomePage } from './pages/Home'
import { InspectPage } from './pages/Inspect'
import { StudentsPage } from './pages/Students'
import { StudentPage } from './pages/StudentPage'
import { ActivityPage } from './pages/Activity'
import { CalendarPage } from './pages/Calendar'
import { ImportPage } from './pages/Import'
import { ReviewPage } from './pages/Review'
import { SettingsPage } from './pages/Settings'
import { ReportPage } from './pages/Report'
import { LoginPage } from './pages/Login'

function Loading({ text = '正在加载…' }: { text?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      <div className="text-center">
        <div className="animate-pulse text-4xl">🎓</div>
        <div className="mt-2 text-[13px]">{text}</div>
      </div>
    </div>
  )
}

function useBoot(): 'checking' | 'signed-out' | 'ready' {
  const [auth, setAuth] = useState<'checking' | 'signed-out' | 'signed-in'>(supabase ? 'checking' : 'signed-in')
  const userRef = useRef<string | null>(null)
  useEffect(() => {
    if (!supabase) {
      void initData(createLocalAdapter(), null)
      return
    }
    const sb = supabase
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuth('signed-in')
        if (userRef.current !== session.user.id) {
          userRef.current = session.user.id
          const email = session.user.email ?? null
          // 不要在回调里直接调用 supabase（官方建议），放到下一个事件循环
          setTimeout(() => void initData(createSupabaseAdapter(sb), email), 0)
        }
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        userRef.current = null
        setAuth('signed-out')
        useStore.setState({ ...emptyDB(useStore.getState().settings), phase: 'boot' })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])
  return auth === 'signed-in' ? 'ready' : auth
}

function useSyncOnFocus() {
  useEffect(() => {
    let last = Date.now()
    const onFocus = () => {
      if (Date.now() - last > 5 * 60 * 1000 && !hasPendingWrites()) {
        last = Date.now()
        void reloadData()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingWrites()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])
}

export default function App() {
  const boot = useBoot()
  const phase = useStore((s) => s.phase)
  const loadError = useStore((s) => s.loadError)
  useSyncOnFocus()

  if (boot === 'checking') return <Loading />
  if (boot === 'signed-out') return <LoginPage />
  if (phase === 'error')
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <div className="text-3xl">⚠️</div>
          <div className="mt-2 font-semibold">数据加载失败</div>
          <div className="mt-1 text-[13px] break-words text-slate-500">{loadError}</div>
          <div className="mt-2 text-xs text-slate-400">如果是第一次用 Supabase，请确认已经在 SQL Editor 里运行过 supabase/schema.sql。</div>
          <Button className="mt-4" variant="primary" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    )
  if (phase !== 'ready') return <Loading />

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="inspect" element={<InspectPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentPage />} />
          <Route path="students/:id/report" element={<ReportPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
