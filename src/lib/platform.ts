// 运行环境：普通网站（本地模式 / Supabase）或托管在 claude.ai 的 Artifact 页面
export const TARGET: 'web' | 'artifact' = import.meta.env.VITE_TARGET === 'artifact' ? 'artifact' : 'web'

interface ClaudeRuntime {
  use(name: string): Promise<any>
}

export function claudeRuntime(): ClaudeRuntime | null {
  return (typeof window !== 'undefined' && (window as any).claude?.use ? (window as any).claude : null) as ClaudeRuntime | null
}

/** 让用户保存一个文件。Artifact 里通过 downloads 能力（会弹确认），普通网站直接下载。 */
export async function saveFile(filename: string, data: Blob | string): Promise<void> {
  if (TARGET === 'artifact') {
    const downloads = await claudeRuntime()?.use('downloads')
    if (!downloads) throw new Error('这个页面现在不能保存文件')
    try {
      await downloads.save({ filename, data })
    } catch (e: any) {
      if (e?.code === 'declined') return
      throw new Error(e?.message ?? String(e))
    }
    return
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
