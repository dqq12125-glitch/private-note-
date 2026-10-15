// 生成深色模式的配色：把 Tailwind 的颜色变量在深色下重新映射。
// 运行：node scripts/gen-dark-theme.mjs  → 写入 src/theme-dark.css
// 思路：灰色（slate/zinc）明暗反转；彩色的浅色底（50–300）变成深色底上的淡淡一层颜色，
// 深色文字（700–950）变成浅色文字；500/600 这类按钮色基本不变。
import { readFileSync, writeFileSync } from 'node:fs'

const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8')
const value = (name) => {
  const m = theme.match(new RegExp(`--color-${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`missing --color-${name}`)
  return m[1].trim()
}

const SURFACE = '#141d2f' // 深色卡片底色（= bg-white）
const tinted = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'sky', 'blue', 'indigo', 'violet', 'purple', 'rose']
const mix = (c, pct) => `color-mix(in oklab, ${c} ${pct}%, ${SURFACE})`

const lines = []
// 中性色：页面底 → 卡片 → 填充 → 边框 → 文字
const neutrals = {
  white: SURFACE,
  '50': '#0b1220',
  '100': '#1b2538',
  '200': '#2a364b',
  '300': '#3d4a63',
  '400': '#7d8aa2',
  '500': '#98a3b7',
  '600': '#b5bfce',
  '700': '#cfd6e1',
  '800': '#e2e7ef',
  '900': '#eef2f7',
  '950': '#f7f9fc',
}
lines.push(`  --color-white: ${neutrals.white};`)
for (const n of ['slate', 'zinc', 'gray'])
  for (const s of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'])
    lines.push(`  --color-${n}-${s}: ${neutrals[s]};`)

for (const h of tinted) {
  const v = (s) => value(`${h}-${s}`)
  lines.push(
    `  --color-${h}-50: ${mix(v(500), 14)};`,
    `  --color-${h}-100: ${mix(v(500), 22)};`,
    `  --color-${h}-200: ${mix(v(500), 34)};`,
    `  --color-${h}-300: ${mix(v(500), 50)};`,
    `  --color-${h}-600: ${v(500)};`,
    `  --color-${h}-700: ${v(300)};`,
    `  --color-${h}-800: ${v(200)};`,
    `  --color-${h}-900: ${v(100)};`,
    `  --color-${h}-950: ${v(50)};`,
  )
}
// 主题色（靛蓝）
lines.push(
  `  --color-brand-50: ${mix('#6366f1', 16)};`,
  `  --color-brand-100: ${mix('#6366f1', 26)};`,
  `  --color-brand-200: ${mix('#6366f1', 38)};`,
  `  --color-brand-300: ${mix('#6366f1', 55)};`,
  `  --color-brand-600: #6366f1;`,
  `  --color-brand-700: #a5b4fc;`,
  `  --color-accent-hover: #7c7ff7;`,
  `  --color-inverse: #e2e7ef;`,
  `  --color-on-inverse: #0b1220;`,
  `  --color-scrim: rgb(0 0 0 / 0.55);`,
  `  color-scheme: dark;`,
)

const block = lines.join('\n')
const css = `/* 由 scripts/gen-dark-theme.mjs 生成，不要手改 */
/* 跟随系统深色模式；托管在 claude.ai 时跟随页面右上角的主题（data-theme）。打印时始终用浅色。 */
@media screen and (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${block}
  }
}
@media screen {
  :root[data-theme='dark'] {
${block}
  }
}
`
writeFileSync('src/theme-dark.css', css)
console.log(`wrote src/theme-dark.css (${lines.length} variables)`)
