// cloud/ 里的文件：tools/banned-terms.txt 的词一个都不能有（tools/check-banned.js 的同一份清单和读法）、
// 不把 AI 叫「老师」、没有像密钥的字符串、node_modules 等不进仓库
import fs from 'node:fs';
import path from 'node:path';
import { ok, CLOUD } from './lib.js';

const SKIP = new Set(['node_modules', 'dist', '.wrangler', '.tmp']);
const EXT = /\.(js|mjs|cjs|html|css|md|json|txt|toml|sql)$/i;
function files(dir, rel) {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(d.name)) continue;
    const r = rel ? rel + '/' + d.name : d.name, a = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...files(a, r)); else if (EXT.test(d.name) && d.name !== 'package-lock.json') out.push(r);
  }
  return out;
}
function terms() {
  const out = [];
  fs.readFileSync(path.join(CLOUD, '..', 'tools', 'banned-terms.txt'), 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const m = /^re:\/(.*)\/([a-z]*)$/.exec(t);
    out.push(m ? { re: new RegExp(m[1], m[2].replace('g', '')) } : { s: t });
  });
  return out;
}

export default async function () {
  const list = files(CLOUD, ''), T = terms(), hits = [];
  for (const f of list) {
    const lines = fs.readFileSync(path.join(CLOUD, f), 'utf8').split(/\r?\n/);
    lines.forEach((l, i) => { for (const t of T) if (t.s ? l.includes(t.s) : t.re.test(l)) hits.push(f + ':' + (i + 1)); });
  }
  ok(T.length > 20 && list.length > 15, 'banned-terms.txt 读到 ' + T.length + ' 条，查 cloud/ 里 ' + list.length + ' 个文件');
  ok(!hits.length, 'cloud/ 里没有不能出现的词', hits.slice(0, 10));
  const own = list.filter(f => !/^test\/t-10-files\.js$/.test(f));
  const teacher = [];
  for (const f of own) fs.readFileSync(path.join(CLOUD, f), 'utf8').split(/\r?\n/).forEach((l, i) => { if (/老师|\bteachers?\b/i.test(l)) teacher.push(f + ':' + (i + 1)); });
  ok(!teacher.length, 'cloud/ 里不把 AI 叫「老师」（这几个文件里根本不出现这个词）', teacher);
  const keys = [];
  for (const f of own) fs.readFileSync(path.join(CLOUD, f), 'utf8').split(/\r?\n/).forEach((l, i) => { if (/\bsk-[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(l)) keys.push(f + ':' + (i + 1)); });
  ok(!keys.length, 'cloud/ 里没有像密钥的字符串', keys);
  const gi = fs.readFileSync(path.join(CLOUD, '.gitignore'), 'utf8');
  ok(/^node_modules\/$/m.test(gi) && /^\.wrangler\/$/m.test(gi) && /^dist\/$/m.test(gi) && /^\.dev\.vars$/m.test(gi), 'cloud/.gitignore 忽略 node_modules、.wrangler、dist、.dev.vars');
}
