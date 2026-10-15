import { useState } from 'react'
import { supabase } from '../data/supabase'
import { Button, Field } from '../components/ui'

function zhError(msg: string): string {
  if (/failed to fetch|network/i.test(msg)) return '连不上服务器，请检查网络（或 Supabase 地址是否填对）'
  if (/invalid login credentials/i.test(msg)) return '邮箱或密码不对'
  if (/email not confirmed/i.test(msg)) return '邮箱还没验证，请先点邮件里的确认链接'
  if (/rate limit/i.test(msg)) return '操作太频繁，请稍后再试'
  if (/signups not allowed/i.test(msg)) return '这个网站不开放注册'
  if (/password/i.test(msg) && /6/.test(msg)) return '密码至少 6 位'
  return msg
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  const submit = async () => {
    if (!supabase || !email) return
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) setMsg({ tone: 'ok', text: '注册成功！请到邮箱点确认链接，然后回来登录。' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname, shouldCreateUser: false },
        })
        if (error) throw error
        setMsg({ tone: 'ok', text: '登录链接已发到邮箱，点链接就能登录。' })
      }
    } catch (e) {
      setMsg({ tone: 'error', text: zhError(e instanceof Error ? e.message : String(e)) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <form
        className="card w-full max-w-sm p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="mb-5 text-center">
          <div className="text-4xl">🎓</div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">学生跟进</h1>
          <p className="text-[13px] text-slate-500">{mode === 'signup' ? '创建账号' : '登录'}</p>
        </div>
        <div className="space-y-3">
          <Field label="邮箱">
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          {mode !== 'magic' && (
            <Field label="密码">
              <input
                className="input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          {msg && (
            <div className={msg.tone === 'error' ? 'rounded bg-rose-50 px-2.5 py-1.5 text-[13px] text-rose-700' : 'rounded bg-emerald-50 px-2.5 py-1.5 text-[13px] text-emerald-700'}>
              {msg.text}
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !email || (mode !== 'magic' && password.length < 6)}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : mode === 'signup' ? '注册' : '发送登录链接'}
          </Button>
        </div>
        <div className="mt-4 flex justify-between text-xs">
          {mode !== 'magic' ? (
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setMode('magic')}>
              用邮箱链接登录
            </button>
          ) : (
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setMode('login')}>
              用密码登录
            </button>
          )}
          {mode === 'signup' ? (
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setMode('login')}>
              已有账号，去登录
            </button>
          ) : (
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setMode('signup')}>
              第一次用？注册
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
