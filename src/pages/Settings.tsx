import { useRef, useState } from 'react'
import { Download, FileJson, Plus, Trash2, Upload, X } from 'lucide-react'
import { exportExcel, exportJson } from '../lib/exporter'
import { loadDemo, restoreBackup } from '../data/actions'
import { resetAllData, saveSettings, toast, useStore } from '../data/store'
import { supabaseConfigured } from '../data/supabase'
import { Button, Field, isComposing } from '../components/ui'

export function DemoButton({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <Button
      size={size}
      onClick={() => {
        loadDemo()
        toast('已加载 11 个示例学生（名字前面带「示例·」，不需要时可以在设置里清空）')
      }}
    >
      加载示例数据
    </Button>
  )
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState('')
  const add = () => {
    const t = v.trim()
    if (!t || items.includes(t)) return
    onChange([...items, t])
    setV('')
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((a) => (
          <span key={a} className="tag bg-slate-50 text-slate-700 ring-slate-200">
            {a}
            <button type="button" onClick={() => onChange(items.filter((x) => x !== a))} className="text-slate-400 hover:text-rose-500">
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="input input-sm w-36"
          placeholder={placeholder}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isComposing(e) && add()}
        />
        <Button size="sm" onClick={add} disabled={!v.trim()}>
          <Plus size={13} /> 添加
        </Button>
      </div>
    </Field>
  )
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const mode = useStore((s) => s.mode)
  const counts = { students: useStore((s) => s.students.length), events: useStore((s) => s.events.length) }
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [recorder, setRecorder] = useState(settings.recorder_name)
  const [busy, setBusy] = useState(false)

  const db = () => {
    const s = useStore.getState()
    return {
      students: s.students,
      applications: s.applications,
      visas: s.visas,
      key_dates: s.key_dates,
      tasks: s.tasks,
      payments: s.payments,
      events: s.events,
      review_items: s.review_items,
      settings: s.settings,
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">设置 / 导出</h1>

      <div className="card space-y-4 p-5">
        <h2 className="text-[15px] font-semibold">基本设置</h2>
        <Field label="记录人（写在每条时间线记录上，以后多人用时区分是谁记的）">
          <input
            className="input w-48"
            value={recorder}
            onChange={(e) => setRecorder(e.target.value)}
            onBlur={() => recorder.trim() && recorder !== settings.recorder_name && saveSettings({ recorder_name: recorder.trim() })}
          />
        </Field>
        <ListEditor label="负责人（可增删）" items={settings.assignees} onChange={(assignees) => saveSettings({ assignees })} placeholder="例如 team 3" />
        <ListEditor label="待办「交给谁」的常用人" items={settings.handlers} onChange={(handlers) => saveSettings({ handlers })} placeholder="例如 Maggie" />
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-[15px] font-semibold">备份 / 导出</h2>
        <p className="text-[13px] text-slate-500">
          当前共 {counts.students} 个学生、{counts.events} 条时间线记录。建议每周导出一次 JSON 备份。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await exportExcel(db())
              } catch (e) {
                toast(`导出失败：${e instanceof Error ? e.message : e}`, { tone: 'error' })
              } finally {
                setBusy(false)
              }
            }}
          >
            <Download size={15} /> 导出 Excel
          </Button>
          <Button onClick={() => exportJson(db())}>
            <FileJson size={15} /> 导出 JSON 备份
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> 从 JSON 备份恢复
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const data = JSON.parse(await f.text())
                if (!Array.isArray(data.students)) throw new Error('不是本系统导出的备份文件')
                if (!window.confirm(`备份里有 ${data.students.length} 个学生。恢复会和现有数据合并（同一条记录用备份里的覆盖）。继续？`)) return
                const n = restoreBackup(data)
                toast(`已恢复 ${n} 条数据`)
              } catch (err) {
                toast(`恢复失败：${err instanceof Error ? err.message : err}`, { tone: 'error' })
              }
            }}
          />
        </div>
        <p className="text-xs text-slate-400">
          从「本地模式」换到云端（Supabase）时：先在本地导出 JSON，登录云端后再从 JSON 恢复即可。
        </p>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-[15px] font-semibold">数据存在哪里</h2>
        {mode === 'supabase' ? (
          <p className="text-[13px] text-slate-600">☁️ 云端模式：数据保存在 Supabase，电脑和手机登录同一个账号就能看到。</p>
        ) : (
          <p className="text-[13px] text-amber-700">
            💻 本地模式：{supabaseConfigured ? '' : '还没有配置 Supabase，'}数据只保存在当前这个浏览器里，换电脑/手机看不到，清除浏览器数据会丢失。
            按 README 配置 Supabase 后就能云端同步。
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <DemoButton />
          <Button
            variant="danger"
            onClick={() => {
              const t = window.prompt('这会删除所有学生和记录，无法恢复。建议先导出 JSON 备份。\n确定的话请输入「清空」：')
              if (t === '清空') {
                resetAllData()
                toast('已清空所有数据')
              }
            }}
          >
            <Trash2 size={15} /> 清空所有数据
          </Button>
        </div>
      </div>

      <div className="card p-5 text-[13px] text-slate-600">
        <h2 className="mb-2 text-[15px] font-semibold text-slate-900">键盘快捷键</h2>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <span><span className="kbd">N</span> 快速记录</span>
          <span><span className="kbd">/</span> 搜索</span>
          <span><span className="kbd">Enter</span> 保存当前记录</span>
          <span><span className="kbd">Esc</span> 关闭弹窗或面板</span>
          <span><span className="kbd">→</span> 巡检：下一个</span>
          <span><span className="kbd">←</span> 巡检：上一个</span>
          <span><span className="kbd">C</span> 巡检：已检查没变化</span>
        </div>
      </div>
    </div>
  )
}
