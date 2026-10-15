import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarRange,
  ClipboardCheck,
  Expand,
  FileSpreadsheet,
  House,
  ListChecks,
  Menu,
  Plus,
  Search,
  Settings as SettingsIcon,
  Users,
  Activity,
  X,
} from 'lucide-react'
import { todayQueue } from '../lib/reminders'
import { searchStudents } from '../lib/search'
import { useInfos } from '../data/hooks'
import { retrySync, useStore } from '../data/store'
import { supabase } from '../data/supabase'
import { StatusTag, useOpenStudent } from './bits'
import { StudentDetail } from './detail/StudentDetail'
import { QuickRecordModal } from './QuickRecord'
import { ConfirmHost } from './confirm'
import { Toasts, cx, useEscape, isComposing } from './ui'

function NavItem({ to, icon, label, badge, end, onClick }: { to: string; icon: React.ReactNode; label: string; badge?: number; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="rounded-full bg-rose-500 px-1.5 text-[11px] leading-[18px] font-semibold text-on-accent tabular-nums">{badge}</span>
      )}
    </NavLink>
  )
}

function SyncStatus() {
  const sync = useStore((s) => s.sync)
  const mode = useStore((s) => s.mode)
  const email = useStore((s) => s.userEmail)
  return (
    <div className="space-y-1 px-3 text-[11px] text-slate-400">
      {sync.error ? (
        <button type="button" onClick={retrySync} className="block w-full rounded bg-rose-50 px-2 py-1 text-left text-rose-600">
          ⚠ {sync.pending} 条修改没保存成功，点这里重试
          <span className="block truncate opacity-70">{sync.error}</span>
        </button>
      ) : sync.pending ? (
        <div>● 正在保存…</div>
      ) : (
        <div>✓ 已保存</div>
      )}
      {mode === 'artifact' ? (
        <div title="数据存在 claude.ai 上这个页面自带的云端数据库，只有你（和你设为编辑者的人）能看到">☁️ 云端 · claude.ai</div>
      ) : mode === 'local' ? (
        <div className="text-amber-600" title="没有配置 Supabase：数据只存在这个浏览器里，记得定期导出备份">
          本地模式 · 数据只在本浏览器
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="truncate">{email}</span>
          <button type="button" className="shrink-0 text-slate-400 underline hover:text-slate-600" onClick={() => supabase?.auth.signOut()}>
            退出
          </button>
        </div>
      )}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const infos = useInfos()
  const reviews = useStore((s) => s.review_items)
  const events = useStore((s) => s.events)
  const pending = useMemo(() => todayQueue(infos).pending.length, [infos])
  const reviewCount = useMemo(
    () => reviews.filter((r) => r.status === 'pending').length + events.filter((e) => e.date_unknown).length,
    [reviews, events],
  )
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 pt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-lg">🎓</div>
        <div>
          <div className="text-[15px] font-bold text-slate-900">学生跟进</div>
          <div className="text-[11px] text-slate-400">留学 · 签证客户管理</div>
        </div>
      </div>
      <NavItem to="/" end icon={<House size={17} />} label="首页" onClick={onNavigate} />
      <NavItem to="/inspect" icon={<ListChecks size={17} />} label="每日巡检" badge={pending} onClick={onNavigate} />
      <NavItem to="/students" icon={<Users size={17} />} label="学生列表" onClick={onNavigate} />
      <NavItem to="/activity" icon={<Activity size={17} />} label="所有动态" onClick={onNavigate} />
      <NavItem to="/calendar" icon={<CalendarRange size={17} />} label="未来几个月" onClick={onNavigate} />
      <div className="flex-1" />
      <div className="mb-1 border-t border-slate-100 pt-2" />
      {reviewCount > 0 && (
        <NavItem to="/review" icon={<ClipboardCheck size={17} />} label="导入确认清单" badge={reviewCount} onClick={onNavigate} />
      )}
      <NavItem to="/import" icon={<FileSpreadsheet size={17} />} label="导入 Excel" onClick={onNavigate} />
      <NavItem to="/settings" icon={<SettingsIcon size={17} />} label="设置 / 导出" onClick={onNavigate} />
      <div className="mt-2 flex items-center gap-1.5 px-3 text-[11px] text-slate-400">
        <span className="kbd">N</span> 记录 <span className="kbd">/</span> 搜索
      </div>
      <div className="mt-1">
        <SyncStatus />
      </div>
    </div>
  )
}

function StudentPanel() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const id = params.get('s')
  const close = () => {
    const p = new URLSearchParams(params)
    p.delete('s')
    setParams(p)
  }
  useEscape(close, !!id)
  if (!id) return null
  return (
    <div className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl md:w-[min(1180px,74vw)]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-[13px] text-slate-500">学生详情</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate(`/students/${id}`)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-slate-600 hover:bg-slate-100"
          title="展开成全屏详情页"
        >
          <Expand size={14} /> 全屏
        </button>
        <button type="button" onClick={close} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" title="关闭（Esc）">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 md:p-4" key={id}>
        <StudentDetail id={id} compact />
      </div>
    </div>
  )
}

function SearchPalette() {
  const open = useStore((s) => s.palette)
  const infos = useInfos()
  const openStudent = useOpenStudent()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const hits = useMemo(() => searchStudents(infos, q, 20), [infos, q])
  const close = () => useStore.setState({ palette: false })
  useEscape(close, open)
  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
    }
  }, [open])
  useEffect(() => setIdx(0), [q])
  if (!open) return null
  const go = (id: string) => {
    close()
    openStudent(id)
  }
  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-scrim p-3 pt-[12vh]" onMouseDown={close}>
      <div className="animate-pop-in w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3">
          <Search size={17} className="text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (isComposing(e)) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(i + 1, hits.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter' && hits[idx]) go(hits[idx].info.s.id)
            }}
            placeholder="搜姓名、英文名、学校、备注内容…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="max-h-[50vh] overflow-auto p-1">
          {hits.map((h, i) => (
            <button
              key={h.info.s.id}
              type="button"
              onMouseMove={() => idx !== i && setIdx(i)}
              onClick={() => go(h.info.s.id)}
              className={cx('flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left', i === idx && 'bg-brand-50')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{h.info.s.name}</span>
                  {h.info.s.english_name && <span className="text-xs text-slate-400">{h.info.s.english_name}</span>}
                  <span className="text-xs text-slate-400">{h.info.s.assignee ?? '未分配'}</span>
                </div>
                {h.snippet && <div className="mt-0.5 truncate text-xs text-slate-500">{h.snippet}</div>}
              </div>
              <StatusTag status={h.info.s.status} />
            </button>
          ))}
          {q && !hits.length && <div className="px-3 py-6 text-center text-[13px] text-slate-400">没有找到「{q}」</div>}
          {!q && <div className="px-3 py-6 text-center text-[13px] text-slate-400">输入关键词开始搜索</div>}
        </div>
      </div>
    </div>
  )
}

/** 全局快捷键：N 快速记录，/ 搜索 */
function useHotkeys() {
  const location = useLocation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const st = useStore.getState()
      if (st.quick.open || st.palette) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        const sid = new URLSearchParams(location.search).get('s') ?? location.pathname.match(/^\/students\/([^/]+)$/)?.[1] ?? null
        useStore.setState({ quick: { open: true, studentId: sid } })
      } else if (e.key === '/') {
        e.preventDefault()
        const listSearch = document.getElementById('list-search') as HTMLInputElement | null
        if (listSearch) listSearch.focus()
        else useStore.setState({ palette: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location])
}

export function Shell() {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  useHotkeys()
  useEffect(() => setDrawer(false), [location.pathname])
  const isReport = location.pathname.endsWith('/report')
  if (isReport)
    return (
      <>
        <Outlet />
        <ConfirmHost />
        <Toasts />
      </>
    )
  return (
    <div className="flex h-full">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <Sidebar />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={() => setDrawer(false)} />
          <div className="animate-slide-in absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          <button type="button" onClick={() => setDrawer(true)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-semibold">🎓 学生跟进</span>
          <div className="flex-1" />
          <button type="button" onClick={() => useStore.setState({ palette: true })} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
            <Search size={20} />
          </button>
        </header>
        <main id="main-scroll" className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <StudentPanel />
      <button
        type="button"
        title="快速记录（N）"
        onClick={() => {
          const sid = new URLSearchParams(location.search).get('s') ?? location.pathname.match(/^\/students\/([^/]+)$/)?.[1] ?? null
          useStore.setState({ quick: { open: true, studentId: sid } })
        }}
        className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-on-accent shadow-lg shadow-brand-600/30 transition-transform hover:scale-105 hover:bg-accent-hover"
      >
        <Plus size={28} />
      </button>
      <QuickRecordModal />
      <SearchPalette />
      <ConfirmHost />
      <Toasts />
    </div>
  )
}
