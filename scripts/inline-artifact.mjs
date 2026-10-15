// 把 `vite build --mode artifact` 的结果合成一个 HTML 片段，用来发布到 claude.ai。
// claude.ai 发布时会自动套上 <html><head><body>，所以这里只输出 title、style、根节点和脚本。
// 传入 dist-standalone 时输出完整的 HTML 文档（离线版，双击就能打开）。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist-artifact'
const full = dir === 'dist-standalone'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const js = html.match(/<script[^>]*src="\.\/([^"]+)"/)?.[1]
const css = html.match(/<link[^>]*href="\.\/([^"]+\.css)"/)?.[1]
if (!js || !css) throw new Error('index.html 里没找到打包后的 js / css')
const code = readFileSync(join(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script')
const style = readFileSync(join(dir, css), 'utf8').replace(/<\/style/gi, '<\\/style')
const body = [
  '<title>学生跟进</title>',
  '<meta name="theme-color" content="#4f46e5">',
  `<style>${style}</style>`,
  '<div id="root"></div>',
  `<script type="module">${code}</script>`,
]
const out = (
  full
    ? [
        '<!doctype html>',
        '<html lang="zh-CN">',
        '<head>',
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
        `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>">`,
        ...body.slice(0, 3),
        '</head>',
        '<body>',
        ...body.slice(3),
        '</body>',
        '</html>',
      ]
    : body
).join('\n') + '\n'
const name = full ? 'student-tracker-offline.html' : 'student-tracker.html'
writeFileSync(join(dir, name), out)
console.log(`wrote ${dir}/${name} (${(out.length / 1024).toFixed(0)} KB)`)
