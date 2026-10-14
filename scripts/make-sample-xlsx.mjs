// 生成一个模拟现有 Excel 格式的测试文件（假数据），用来测试导入功能：
//   node scripts/make-sample-xlsx.mjs
import writeExcelFile from 'write-excel-file/node'

const header = ['学生姓名', '负责手机', '状态', '业务分类', '客户背景/备注', '完整详情/历史进度', '最新更新日', '天数', '任务优先级']
const rows = [
  ['测试甲（完成）', 'team2', '进行中', '学校+签证', '本科双非，想读会计', '09/07/2026 递交UQ申请\n20/08/26 UQ con offer，10.30号补成绩单\n学生说下周考雅思', '20/08/2026', 55, '高'],
  ['测试乙（年底毕业）', 'team 1', '进行中', '学校申请', '11.12号Orientation', '01/09/2026 Monash offer已下，等学生决定\n15/09/2026 学生说再考虑下', '15/09/2026', 29, ''],
  ['测试丙(更新过)', '', '进行中', '签证', '学签2月左右到期，有事联系女朋友 Geeth', '交了材料\n05/10/2026 500签证已递交', '05/10/2026', 9, ''],
  ['测试丁（不用管了）', 'tingting', '进行中', '其他', '', '2026/03/01 咨询过一次', '', '', ''],
  ['测试戊（郭晨npy）', 'team1', '已完成', '学校+签证', '', '10/01/2026 签证获批', '10/01/2026', 277, '高'],
  ['测试己', 'team 2', '暂停', '转学', '大概率去英国', '', '', '', ''],
]
await writeExcelFile([header, ...rows], { columns: header.map((_, i) => ({ width: i === 5 ? 60 : 14 })) }).toFile('tests/fixtures/sample.xlsx')
console.log('wrote tests/fixtures/sample.xlsx')
