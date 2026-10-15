import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { EVENT_ICON, VISA_STEPS, cycleLabel } from '../lib/constants'
import { fmtDate, fmtDateTime, nowIso } from '../lib/dates'
import { appSub, sortEventsDesc } from '../lib/reminders'
import { fmtMoney } from '../data/actions'
import { useStudentInfo } from '../data/hooks'
import { useStore } from '../data/store'
import { Button } from '../components/ui'
import { saveFile, TARGET } from '../lib/platform'
import { toast } from '../data/store'

/** 把报告存成一个独立的 HTML 文件（托管在 claude.ai 时不能直接打印，用浏览器打开这个文件再打印） */
async function downloadReport(name: string, date: string) {
  const sheet = document.getElementById('report-sheet')
  if (!sheet) return
  const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
  const html = `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} 进度报告 ${date}</title><style>${css}</style></head><body style="background:#f1f5f9"><p class="no-print" style="max-width:800px;margin:16px auto;font:13px system-ui;color:#64748b">按 Ctrl+P（Mac 按 ⌘+P）打印，或在打印窗口里选「另存为 PDF」。</p>${sheet.outerHTML}</body></html>`
  try {
    await saveFile(`${name}_进度报告_${date.replace(/\//g, '-')}.html`, html)
  } catch (e) {
    toast(`保存失败：${e instanceof Error ? e.message : e}`, { tone: 'error' })
  }
}

/** 进度报告：一页打印版，浏览器「打印 → 另存为 PDF」即可 */
export function ReportPage() {
  const { id } = useParams()
  const info = useStudentInfo(id)
  const payments = useStore((s) => s.payments)
  const today = useStore((s) => s.today)
  const [full, setFull] = useState(false)
  const [withPayments, setWithPayments] = useState(false)
  if (!info) return <div className="p-8 text-center text-slate-400">找不到这个学生</div>
  const s = info.s
  const events = [...info.events].filter((e) => e.kind !== 'checked' && (full || e.milestone)).sort(sortEventsDesc).reverse()
  const pays = payments.filter((p) => p.student_id === s.id)
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[800px] flex-wrap items-center gap-3 px-4">
        <Link to={`/students/${s.id}`} className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> 返回
        </Link>
        <div className="flex-1" />
        <label className="inline-flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> 附完整备注（全部记录）
        </label>
        <label className="inline-flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={withPayments} onChange={(e) => setWithPayments(e.target.checked)} /> 包含收费
        </label>
        {TARGET === 'artifact' ? (
          <Button variant="primary" onClick={() => downloadReport(s.name, fmtDate(today))}>
            <Download size={15} /> 下载报告（打开后可打印 / 存 PDF）
          </Button>
        ) : (
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={15} /> 打印 / 另存为 PDF
          </Button>
        )}
      </div>
      <div id="report-sheet" className="mx-auto max-w-[800px] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-end justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-bold">{s.name}{s.english_name && <span className="ml-2 text-lg font-normal text-slate-500">{s.english_name}</span>}</div>
            <div className="mt-1 text-[13px] text-slate-500">进度报告 · {fmtDate(today)}</div>
          </div>
          <div className="text-right text-[12px] text-slate-500">
            负责人：{s.assignee ?? '未分配'}
            <br />
            业务类型：{s.business_type}
          </div>
        </div>

        <table className="mt-4 w-full text-[13px]">
          <tbody>
            <tr>
              <td className="w-24 py-1 text-slate-500">当前状态</td>
              <td className="py-1">{s.status} · 球在{s.ball}{s.priority === '高' && ' · 高优先级'}</td>
              <td className="w-24 py-1 text-slate-500">跟进周期</td>
              <td className="py-1">{cycleLabel(s.follow_cycle_days)}</td>
            </tr>
            {(s.referrer || s.contact) && (
              <tr>
                <td className="py-1 text-slate-500">推荐人</td>
                <td className="py-1">{s.referrer ?? '—'}</td>
                <td className="py-1 text-slate-500">联系人</td>
                <td className="py-1">{s.contact ?? '—'}</td>
              </tr>
            )}
          </tbody>
        </table>
        {s.background && (
          <div className="mt-2 rounded bg-slate-50 p-2 text-[13px] whitespace-pre-wrap text-slate-700">{s.background}</div>
        )}

        {info.openTasks.length > 0 && (
          <>
            <h2 className="mt-5 mb-1.5 text-[15px] font-bold">下一步</h2>
            <ul className="list-disc pl-5 text-[13px]">
              {info.openTasks.map((t) => (
                <li key={t.id}>
                  {t.content}
                  {t.due_date && <span className="text-slate-500">（{fmtDate(t.due_date)} 前）</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {info.apps.length > 0 && (
          <>
            <h2 className="mt-5 mb-1.5 text-[15px] font-bold">申请学校</h2>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1 pr-2 font-medium">学校</th>
                  <th className="py-1 pr-2 font-medium">专业 / 入学</th>
                  <th className="py-1 pr-2 font-medium">状态</th>
                  <th className="py-1 font-medium">截止日</th>
                </tr>
              </thead>
              <tbody>
                {info.apps.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-1 pr-2 font-medium">{a.school}</td>
                    <td className="py-1 pr-2">{appSub(a)}</td>
                    <td className="py-1 pr-2">{a.status}</td>
                    <td className="py-1 text-[12px]">
                      {a.offer_ddl && <div>接 offer：{fmtDate(a.offer_ddl)}</div>}
                      {a.offer_ddl_tbc && <div>接 offer：待确认</div>}
                      {a.payment_ddl && <div>付款：{fmtDate(a.payment_ddl)}{a.payment_done_on && ' ✓'}</div>}
                      {a.condition_ddl && <div>补材料：{fmtDate(a.condition_ddl)}{a.condition_done_on && ' ✓'}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {info.visas.length > 0 && (
          <>
            <h2 className="mt-5 mb-1.5 text-[15px] font-bold">签证</h2>
            {info.visas.map((v) => (
              <div key={v.id} className="text-[13px]">
                <b>{v.visa_type}</b>：
                {VISA_STEPS.map((st) => `${v[st.key] ? '✓' : '○'} ${st.label}${v[st.key] ? `（${fmtDate(v[st.key])}）` : ''}`).join('　')}
                {v.expiry_date && <div className="text-slate-500">当前签证到期：{fmtDate(v.expiry_date)}</div>}
              </div>
            ))}
          </>
        )}

        {info.keyDates.length > 0 && (
          <>
            <h2 className="mt-5 mb-1.5 text-[15px] font-bold">关键日期</h2>
            <div className="text-[13px]">
              {info.keyDates.map((k) => (
                <div key={k.id}>
                  {fmtDate(k.date)} · {k.kind}
                  {k.note && ` · ${k.note}`}
                </div>
              ))}
            </div>
          </>
        )}

        {withPayments && pays.length > 0 && (
          <>
            <h2 className="mt-5 mb-1.5 text-[15px] font-bold">收费</h2>
            <div className="text-[13px]">
              {pays.map((p) => (
                <div key={p.id}>
                  {fmtDate(p.paid_on)} · {p.item} · {fmtMoney(p.amount, p.currency)}
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-5 mb-1.5 text-[15px] font-bold">{full ? '完整时间线' : '里程碑'}</h2>
        <table className="w-full text-[13px]">
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="w-24 py-0.5 pr-2 whitespace-nowrap text-slate-500 tabular-nums">
                  {e.date_unknown ? '日期不明' : fmtDate(e.occurred_on)}
                </td>
                <td className="w-6 py-0.5">{EVENT_ICON[e.kind]}</td>
                <td className="py-0.5 whitespace-pre-wrap">{e.content}</td>
              </tr>
            ))}
            {!events.length && (
              <tr>
                <td className="py-1 text-slate-400">暂无</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="mt-8 border-t border-slate-200 pt-2 text-[11px] text-slate-400">生成于 {fmtDateTime(nowIso())}</div>
      </div>
    </div>
  )
}
