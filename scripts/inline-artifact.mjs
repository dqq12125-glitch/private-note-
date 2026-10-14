// 把 `vite build --mode artifact` 的结果合成一个 HTML 片段，用来发布到 claude.ai。
// claude.ai 发布时会自动套上 <html><head><body>，所以这里只输出 title、style、根节点和脚本。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-artifact'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const js = html.match(/<script[^>]*src="\.\/([^"]+)"/)?.[1]
const css = html.match(/<link[^>]*href="\.\/([^"]+\.css)"/)?.[1]
if (!js || !css) throw new Error('index.html 里没找到打包后的 js / css')
const code = readFileSync(join(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script')
const style = readFileSync(join(dir, css), 'utf8').replace(/<\/style/gi, '<\\/style')
const out = [
  '<title>学生跟进</title>',
  '<meta name="theme-color" content="#4f46e5">',
  `<style>${style}</style>`,
  '<div id="root"></div>',
  `<script type="module">${code}</script>`,
  '',
].join('\n')
writeFileSync(join(dir, 'student-tracker.html'), out)
console.log(`wrote ${dir}/student-tracker.html (${(out.length / 1024).toFixed(0)} KB)`)
