// 细节检查：两次结果对比（默认 before 对 after）——按种类、按画面（只列有变化的），挡路的种类在前
// 用法：node tools/ui-audit/compare.js [--a before] [--b after]
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib'), RUN = require('./run');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const load = tag => JSON.parse(fs.readFileSync(path.join(L.OUT, tag, 'report.json'), 'utf8'));
// 答完题弹上来的反馈条盖住选项是本意（lib.js 后来才不记它）：两边都不算
const keep = q => !(q.k === 'reach-covered' && /fb-t|#fb\b|div#fb/.test(q.by || ''));
function count(res) {
  const k = {}, s = {}, pairs = new Set(); let n = 0;
  res.recs.forEach(r => { n++; pairs.add(r.screen.split(':')[0]); r.problems.filter(keep).forEach(q => { k[q.k] = (k[q.k] || 0) + 1; const x = s[r.screen.split(':')[0]] = s[r.screen.split(':')[0]] || {}; x[q.k] = (x[q.k] || 0) + 1; }); });
  return { k, s, n, screens: pairs.size };
}
const A = count(load(arg('a', 'before'))), B = count(load(arg('b', 'after')));
const K = RUN.KINDS.filter(k => A.k[k] || B.k[k]);
console.log('量过的：' + arg('a', 'before') + ' ' + A.n + ' 次（' + A.screens + ' 个画面）· ' + arg('b', 'after') + ' ' + B.n + ' 次（' + B.screens + ' 个画面）');
console.log('\n按种类（' + arg('a', 'before') + ' → ' + arg('b', 'after') + '）：');
K.forEach(k => console.log('  ' + k.padEnd(14) + String(A.k[k] || 0).padStart(6) + ' → ' + String(B.k[k] || 0).padStart(6)));
const blk = c => RUN.BLOCK.reduce((n, k) => n + ((c || {})[k] || 0), 0) + ['overlap', 'covered', 'clip', 'ellipsis', 'reach-unsafe'].reduce((n, k) => n + ((c || {})[k] || 0), 0);
console.log('\n按画面（不算按钮太小 / 提示条；只列有变化的，前面是改之前）：');
[...new Set(Object.keys(A.s).concat(Object.keys(B.s)))].map(s => [s, blk(A.s[s]), blk(B.s[s])]).filter(x => x[1] !== x[2]).sort((x, y) => (y[1] - y[2]) - (x[1] - x[2]))
  .forEach(([s, a, b]) => console.log('  ' + s.padEnd(30) + String(a).padStart(4) + ' → ' + String(b).padStart(4) + '   ' + K.filter(k => k !== 'tap-small' && k !== 'toast' && ((A.s[s] || {})[k] || (B.s[s] || {})[k])).map(k => k + ' ' + ((A.s[s] || {})[k] || 0) + '→' + ((B.s[s] || {})[k] || 0)).join(' · ')));
