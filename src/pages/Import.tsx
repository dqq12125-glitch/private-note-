import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileSpreadsheet, Upload } from 'lucide-react'
import { fmtDate, nowIso } from '../lib/dates'
import {
  buildImportPlan,
  COLUMN_LABELS,
  extractRows,
  previewLastUpdate,
  type ColumnKey,
  type HeaderMap,
  type ImportPlan,
} from '../importer/transform'
import { applyImport, newId } from '../data/actions'
import { toast, useStore } from '../data/store'
import { StatusTag } from '../components/bits'
import { Button, cx } from '../components/ui'

interface Parsed {
  fileName: string
  sheets: { sheet: string; data: unknown[][] }[]
  sheetIndex: number
}

export async function readWorkbook(file: File): Promise<{ sheet: string; data: unknown[][] }[]> {
  const { default: readExcelFile } = await import('read-excel-file/universal')
  const buf = await file.arrayBuffer()
  const sheets = await readExcelFile(buf as ArrayBuffer)
  return sheets.map((s: { sheet: string; data: unknown[][] }) => ({ sheet: s.sheet, data: s.data }))
}

export function ImportPage() {
  const students = useStore((s) => s.students)
  const today = useStore((s) => s.today)
  const navigate = useNavigate()
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [skip, setSkip] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [drag, setDrag] = useState(false)

  const extracted = useMemo(() => {
    if (!parsed) return null
    return extractRows(parsed.sheets[parsed.sheetIndex].data)
  }, [parsed])

  const plan: ImportPlan | null = useMemo(() => {
    if (!extracted) return null
    const existing = new Map(students.map((s) => [s.name, s.id]))
    return buildImportPlan(extracted.rows, { today, now: nowIso(), newId, existing })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, today])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (/\.xls$/i.test(file.name)) {
      setError('这是旧版 .xls 文件。请在 Excel 里「另存为」→ 选 .xlsx 格式，再上传。')
      return
    }
    setLoading(true)
    try {
      const sheets = await readWorkbook(file)
      let idx = sheets.findIndex((s) => extractRows(s.data))
      if (idx < 0) {
        setError('没有找到表头。第一行需要包含「学生姓名」和「状态」或「完整详情/历史进度」这些列。')
        idx = 0
      }
      setParsed({ fileName: file.name, sheets, sheetIndex: Math.max(0, idx) })
      setSkip(new Set())
      setExpanded(new Set())
    } catch (e) {
      setError(`读取失败：${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  // 已存在同名学生的默认不导入
  const isSkipped = (i: number) => skip.has(i) !== !!plan?.students[i].duplicateOf

  const doImport = () => {
    if (!plan) return
    const chosen = plan.students.filter((_, i) => !isSkipped(i))
    if (!chosen.length) return
    applyImport(chosen, plan.assignees)
    const reviews = chosen.reduce((n, p) => n + p.reviews.length + p.events.filter((e) => e.date_unknown).length, 0)
    toast(`已导入 ${chosen.length} 个学生，${chosen.reduce((n, p) => n + p.events.length, 0)} 条记录`)
    navigate(reviews ? '/review' : '/students')
  }

  const totals = plan
    ? plan.students.reduce(
        (t, p, i) => {
          if (isSkipped(i)) return t
          t.students++
          t.events += p.events.length
          t.unknown += p.events.filter((e) => e.date_unknown).length
          t.reviews += p.reviews.length
          return t
        },
        { students: 0, events: 0, unknown: 0, reviews: 0 },
      )
    : null

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <h1 className="mb-1 text-xl font-bold text-slate-900">导入 Excel</h1>
      <p className="mb-4 text-[13px] text-slate-500">
        识别的列：{Object.values(COLUMN_LABELS).join('、')}。「最新更新日」那一列不会用，系统按导入后时间线最新的日期自动算。
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void onFile(e.dataTransfer.files[0])
        }}
        className={cx(
          'card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors',
          drag ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-brand-300',
        )}
      >
        <FileSpreadsheet size={32} className="text-emerald-600" />
        <div className="font-medium text-slate-800">{parsed ? parsed.fileName : '点这里选择 Excel 文件，或拖进来'}</div>
        <div className="text-xs text-slate-400">支持 .xlsx。只是预览，确认后才会真正导入。</div>
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        {loading && <div className="text-[13px] text-brand-600">正在读取…</div>}
      </label>
      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</div>}

      {parsed && parsed.sheets.length > 1 && (
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          工作表：
          <select
            className="input input-sm w-auto"
            value={parsed.sheetIndex}
            onChange={(e) => setParsed({ ...parsed, sheetIndex: Number(e.target.value) })}
          >
            {parsed.sheets.map((s, i) => (
              <option key={i} value={i}>
                {s.sheet}
              </option>
            ))}
          </select>
        </div>
      )}

      {extracted && <ColumnMatch map={extracted.map} />}

      {plan && totals && (
        <>
          <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur">
            <span className="text-[13px] text-slate-600">
              将导入 <b className="text-slate-900">{totals.students}</b> 个学生 · <b className="text-slate-900">{totals.events}</b> 条时间线记录
              {totals.unknown > 0 && <> · <b className="text-amber-600">{totals.unknown}</b> 条日期不明</>} ·{' '}
              <b className="text-slate-900">{totals.reviews}</b> 条待确认
            </span>
            <div className="flex-1" />
            <Button variant="primary" onClick={doImport} disabled={!totals.students}>
              <Upload size={15} /> 确认导入
            </Button>
          </div>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2">导入</th>
                  <th className="px-3 py-2">行</th>
                  <th className="px-3 py-2">姓名（清理后）</th>
                  <th className="px-3 py-2">负责人</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">业务类型</th>
                  <th className="px-3 py-2">优先级</th>
                  <th className="px-3 py-2">时间线</th>
                  <th className="px-3 py-2">最新更新</th>
                  <th className="px-3 py-2">处理说明</th>
                </tr>
              </thead>
              <tbody>
                {plan.students.map((p, i) => {
                  const off = isSkipped(i)
                  const open = expanded.has(i)
                  const unknown = p.events.filter((e) => e.date_unknown).length
                  return (
                    <Fragment key={i}>
                      <tr className={cx('border-b border-slate-100 align-top', off && 'opacity-40')}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!off}
                            onChange={() =>
                              setSkip((s) => {
                                const n = new Set(s)
                                if (n.has(i)) n.delete(i)
                                else n.add(i)
                                return n
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-400">{p.raw.row}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">
                            {p.student.name}
                            {p.student.english_name && <span className="ml-1 text-xs text-slate-400">{p.student.english_name}</span>}
                          </div>
                          {p.raw.name !== p.student.name && <div className="text-xs text-slate-400 line-through">{p.raw.name}</div>}
                          {p.duplicateOf && <div className="text-xs text-amber-600">⚠ 已有同名学生，默认不导入</div>}
                        </td>
                        <td className="px-3 py-2">{p.student.assignee ?? <span className="text-amber-600">未分配</span>}</td>
                        <td className="px-3 py-2">
                          <StatusTag status={p.student.status} />
                          {p.reviews.some((r) => r.kind === 'status_conflict') && <div className="mt-0.5 text-xs text-rose-600">状态有冲突</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">{p.student.business_type}</td>
                        <td className="px-3 py-2">{p.student.priority}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
                            onClick={() =>
                              setExpanded((s) => {
                                const n = new Set(s)
                                if (n.has(i)) n.delete(i)
                                else n.add(i)
                                return n
                              })
                            }
                          >
                            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {p.events.length} 条
                          </button>
                          {unknown > 0 && <div className="text-xs text-amber-600">{unknown} 条日期不明</div>}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums">
                          {previewLastUpdate(p)}
                          {p.raw.lastUpdate && p.raw.lastUpdate !== previewLastUpdate(p) && (
                            <div className="text-slate-400">Excel 写的：{p.raw.lastUpdate}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {p.notes.map((n, k) => (
                            <div key={k}>· {n}</div>
                          ))}
                          {p.reviews.length > 0 && <div className="text-amber-700">· {p.reviews.length} 条导入后要确认</div>}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td />
                          <td colSpan={9} className="px-3 py-2">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <div className="mb-1 text-xs font-semibold text-slate-500">拆分后的时间线</div>
                                <div className="space-y-1">
                                  {p.events.map((e) => (
                                    <div key={e.id} className="flex gap-2">
                                      <span className={cx('w-24 shrink-0 tabular-nums', e.date_unknown ? 'text-amber-600' : 'text-slate-500')}>
                                        {e.date_unknown ? '日期不明' : fmtDate(e.occurred_on)}
                                      </span>
                                      <span className="whitespace-pre-wrap text-slate-700">
                                        {e.milestone && '⭐ '}
                                        {e.content}
                                      </span>
                                    </div>
                                  ))}
                                  {!p.events.length && <div className="text-slate-400">（历史进度是空的）</div>}
                                </div>
                              </div>
                              <div>
                                <div className="mb-1 text-xs font-semibold text-slate-500">Excel 原文</div>
                                <div className="max-h-64 overflow-auto rounded bg-white p-2 text-xs whitespace-pre-wrap text-slate-600 ring-1 ring-slate-200">
                                  {p.raw.history || '（空）'}
                                </div>
                                {p.student.background && (
                                  <>
                                    <div className="mt-2 mb-1 text-xs font-semibold text-slate-500">背景备注</div>
                                    <div className="rounded bg-white p-2 text-xs whitespace-pre-wrap text-slate-600 ring-1 ring-slate-200">
                                      {p.student.background}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ColumnMatch({ map }: { map: HeaderMap }) {
  const keys = Object.keys(COLUMN_LABELS) as ColumnKey[]
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
      {keys.map((k) => (
        <span
          key={k}
          className={cx(
            'tag',
            map[k] !== undefined ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-slate-200',
          )}
        >
          {map[k] !== undefined ? '✓' : '✗'} {COLUMN_LABELS[k]}
        </span>
      ))}
    </div>
  )
}
