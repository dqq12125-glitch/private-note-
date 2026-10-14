import type { StudentInfo } from './reminders'

export interface SearchHit {
  info: StudentInfo
  score: number
  snippet: string | null
}

/** 搜姓名、英文名、学校、备注内容 */
export function searchStudents(infos: StudentInfo[], query: string, limit = 30): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  for (const info of infos) {
    const name = info.s.name.toLowerCase()
    const en = (info.s.english_name ?? '').toLowerCase()
    let score = 0
    let snippet: string | null = null
    if (name === q) score = 100
    else if (name.startsWith(q)) score = 80
    else if (name.includes(q)) score = 60
    else if (en && en.includes(q)) score = 50
    else if (info.apps.some((a) => `${a.school} ${a.program}`.toLowerCase().includes(q))) {
      score = 40
      const a = info.apps.find((a) => `${a.school} ${a.program}`.toLowerCase().includes(q))!
      snippet = `🏫 ${[a.school, a.program].filter(Boolean).join(' · ')}（${a.status}）`
    } else {
      const idx = info.searchText.indexOf(q)
      if (idx >= 0) {
        score = 20
        const text = info.searchText
        const start = Math.max(0, idx - 18)
        snippet = `${start > 0 ? '…' : ''}${text.slice(start, idx + q.length + 30).replace(/\n/g, ' ')}…`
      }
    }
    if (score) hits.push({ info, score: score + (info.active ? 1 : 0), snippet })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}
