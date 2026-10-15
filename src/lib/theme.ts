// 外观：跟随系统 / 浅色 / 深色（只在自己部署的网站里用；托管在 claude.ai 时跟随 claude.ai 的主题）
import { TARGET } from './platform'

export type ThemePref = 'system' | 'light' | 'dark'

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem('theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyThemePref(pref: ThemePref) {
  if (TARGET === 'artifact') return
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  try {
    if (pref === 'system') localStorage.removeItem('theme')
    else localStorage.setItem('theme', pref)
  } catch {
    /* 存不了就只对这次有效 */
  }
}
