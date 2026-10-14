// 页面内的确认框（不用浏览器自带的 confirm/prompt：托管在 claude.ai 时那些不会弹出来）
import { useEffect, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { Button, Modal } from './ui'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  danger?: boolean
  /** 要求输入这段文字才能确认（用于删除学生、清空数据这类不能撤销的操作） */
  requireText?: string
}

const useConfirm = create<{ opts: ConfirmOptions | null; resolve: ((ok: boolean) => void) | null }>(() => ({
  opts: null,
  resolve: null,
}))

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  useConfirm.getState().resolve?.(false)
  return new Promise((resolve) => useConfirm.setState({ opts, resolve }))
}

export function ConfirmHost() {
  const { opts, resolve } = useConfirm()
  const [typed, setTyped] = useState('')
  useEffect(() => setTyped(''), [opts])
  if (!opts) return null
  const done = (ok: boolean) => {
    useConfirm.setState({ opts: null, resolve: null })
    resolve?.(ok)
  }
  const blocked = !!opts.requireText && typed.trim() !== opts.requireText
  return (
    <Modal
      open
      onClose={() => done(false)}
      title={opts.title}
      footer={
        <>
          <Button onClick={() => done(false)}>取消</Button>
          <Button variant={opts.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => done(true)}>
            {opts.confirmText ?? '确定'}
          </Button>
        </>
      }
    >
      {opts.message && <div className="text-[14px] leading-relaxed whitespace-pre-line text-slate-600">{opts.message}</div>}
      {opts.requireText && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-500">
            请输入「<b className="text-slate-800">{opts.requireText}</b>」确认：
          </div>
          <input
            autoFocus
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !blocked && done(true)}
          />
        </div>
      )}
    </Modal>
  )
}
