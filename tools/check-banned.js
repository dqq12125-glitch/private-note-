// 查「不能出现的词」：tools/banned-terms.txt 里的每一条，在游戏源码、测试、文档里都不能出现
// 用法：node tools/check-banned.js            有一处就列出来（文件:行  词  这一行），退出码 1
//       node tools/check-banned.js --list     只列要查的文件
// 查哪些文件：仓库里的 .js .html .css .md .json .txt .java .xml .gradle .py（按下面的 SKIP 跳过生成的、第三方的、美术流程的）
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LIST = path.join(__dirname, 'banned-terms.txt');

// 跳过的目录 / 文件（相对仓库根目录，/ 分隔）
const SKIP_DIR = [
  '.git', 'node_modules', 'art', 'assets', 'vendor', 'dl',
  'android/app/build', 'android/.gradle', 'android/build',
  'server/node_modules', 'server/logs', 'server/debug',
  'tests/screenshots',
  'tools/mon3d',      // 美术复核清单和出图提示词：要写清楚「别像哪个现成角色」，仓库不公开
  'tools/blender',    // Blender 的接口名（Strength 之类）
];
const SKIP_FILE = [
  'tools/banned-terms.txt', 'tools/check-banned.js',
  'tools/voice/lines.json', 'tools/voice/misses.jsonl',   // 生成的配音清单，改了源码重新跑 collect.js
  'package-lock.json', 'server/package-lock.json',
];
const EXT = /\.(js|mjs|cjs|html|css|md|json|txt|java|xml|gradle|py|properties\.example)$/i;

function terms() {
  const out = [];
  fs.readFileSync(LIST, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    if (t.startsWith('re:')) {
      const m = /^re:\/(.*)\/([a-z]*)$/.exec(t);
      if (!m) throw new Error('banned-terms.txt 第 ' + (i + 1) + ' 行正则写错了：' + t);
      out.push({ label: t, re: new RegExp(m[1], m[2].replace('g', '')) });
    } else out.push({ label: t, s: t });
  });
  return out;
}

function files() {
  const out = [];
  const walk = rel => {
    const abs = path.join(ROOT, rel);
    for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? rel + '/' + d.name : d.name;
      if (d.isDirectory()) { if (!SKIP_DIR.includes(r)) walk(r); continue; }
      if (SKIP_FILE.includes(r) || !EXT.test(d.name)) continue;
      out.push(r);
    }
  };
  walk('');
  return out.sort();
}

function check() {
  const T = terms(), hits = [];
  for (const f of files()) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const t of T) {
        const hit = t.s ? line.includes(t.s) : t.re.test(line);
        if (hit) hits.push({ f, n: i + 1, term: t.label, line: line.trim().slice(0, 140) });
      }
    });
  }
  return hits;
}

if (require.main === module) {
  if (process.argv.includes('--list')) { files().forEach(f => console.log(f)); return; }
  const hits = check();
  if (!hits.length) { console.log('check-banned: ✓ 没有发现不能出现的词（' + files().length + ' 个文件，' + terms().length + ' 条）'); return; }
  hits.forEach(h => console.log(h.f + ':' + h.n + '  [' + h.term + ']  ' + h.line));
  console.log('check-banned: ✗ ' + hits.length + ' 处（清单在 tools/banned-terms.txt）');
  process.exitCode = 1;
}
module.exports = { check, files, terms };
