import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import readExcelFile from 'read-excel-file/universal'
import { buildImportPlan, extractRows } from '../src/importer/transform'

describe('reading the sample workbook', () => {
  it('parses the real xlsx file end to end', async () => {
    const buf = readFileSync('tests/fixtures/sample.xlsx')
    const sheets = await readExcelFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
    const ex = extractRows(sheets[0].data as unknown[][])!
    expect(ex.rows).toHaveLength(6)
    let n = 0
    const plan = buildImportPlan(ex.rows, { today: '2026-10-14', now: '2026-10-14T00:00:00Z', newId: () => `id${++n}`, existing: new Map() })
    const names = plan.students.map((p) => p.student.name)
    expect(names).toEqual(['测试甲', '测试乙', '测试丙', '测试丁', '测试戊', '测试己'])
    expect(plan.students[0].student.assignee).toBe('team 2')
    expect(plan.students[1].student.background).toContain('年底毕业')
    expect(plan.students[2].student.assignee).toBeNull()
    expect(plan.students[2].events[0]).toMatchObject({ date_unknown: true, content: '交了材料', occurred_on: '2026-10-05' })
    expect(plan.students[3].reviews.map((r) => r.kind)).toEqual(['status_conflict'])
    expect(plan.students[5].student.status).toBe('暂停不跟进')
    expect(plan.students[5].student.business_type).toBe('学校申请类')
    const offer = plan.students[1].reviews.find((r) => r.kind === 'offer_mention')
    expect(offer?.suggestion.schools?.[0].school).toBe('Monash')
    const visa = plan.students[2].reviews.find((r) => r.kind === 'date_mention')
    expect(visa?.suggestion).toMatchObject({ date: '2027-02-01', keydate_kind: '签证到期', approx: true })
    expect(plan.assignees.sort()).toEqual(['team 1', 'team 2', 'tingting'])
  })
})
