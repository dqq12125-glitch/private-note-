// 台词翻译分批做的小工具（格式见 tools/course/SPEC.md §8）。翻译是几个人分头写的，各写一个 lines.part-<批>.json，最后合成 lines.json。
//   node tools/course/lines-part.js list <批>            这一批要翻的原文（JSON，打印出来）：批 = g 词和模板 / a 开场和公共 / b / c / d 各岛 / e 手册介绍（按源文件分，见 BATCH）
//   node tools/course/lines-part.js check <语言> <文件>   查一个分批文件：id 对不对、{name} 和空有没有少、seg / r 对不对齐（日语、中文）、这一批还差哪些没翻
//   node tools/course/lines-part.js merge <语言>          把 tools/course/<语言>/lines.part-*.json 合成 lines.json（同一个 id 两处写得不一样就停下）
// 合好以后的完整检查是 node tools/course/check.js <语言>。
'use strict';
const fs = require('fs'), path = require('path');
const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, 'lines-src.json'), 'utf8'));
const BATCH = {
  g: { terms: true, templates: true, files: [] },
  a: { files: ['story.js', 'world.js', 'monsters.js', 'game.js', 'setup.js'] },
  b: { files: ['isles/a-hello-crayon.js', 'isles/b-farm-school-lab.js'] },
  c: { files: ['isles/c-circus-clock-party.js', 'isles/d-jungle-city-sports.js'] },
  // 日语、中文每句都要带词块和读音，一批太大写不完：b、c 再各分两半
  b1: { files: ['isles/a-hello-crayon.js'] },
  b2: { files: ['isles/b-farm-school-lab.js'] },
  c1: { files: ['isles/c-circus-clock-party.js'] },
  c2: { files: ['isles/d-jungle-city-sports.js'] },
  d: { files: ['isles/e-snow-ruins-league.js'] },
  e: { files: ['dex.js'] },
};
const linesOf = b => SRC.lines.filter(l => BATCH[b].files.includes(l.src));
const [cmd, a1, a2] = process.argv.slice(2);
const HAN = /[㐀-鿿豈-﫿]/;
const holes = s => (String(s).match(/\{[a-zA-Z0-9]+\}/g) || []).sort().join(' ');

if (cmd === 'list') {
  const b = BATCH[a1]; if (!b) { console.error('批：' + Object.keys(BATCH).join(' / ')); process.exit(2); }
  const out = { batch: a1, lines: linesOf(a1) };
  if (b.templates) out.templates = SRC.templates;
  if (b.terms) out.terms = SRC.terms;
  console.log(JSON.stringify(out, null, 1));
} else if (cmd === 'check') {
  const lang = a1, file = a2, bad = [], J = JSON.parse(fs.readFileSync(file, 'utf8'));
  const E = (id, m) => bad.push(id + '：' + m);
  const byId = new Map(SRC.lines.map(l => [l.id, l])), tById = new Map(SRC.templates.map(t => [t.id, t]));
  const one = (id, v, en, isT) => {
    const o = typeof v === 'string' ? { t: v } : v;
    if (!o || typeof o.t !== 'string' || !o.t.trim()) { E(id, '缺 t'); return; }
    if (holes(o.t) !== holes(en)) E(id, '{…} 和原文不一样：原文 ' + (holes(en) || '（没有）') + '，译文 ' + (holes(o.t) || '（没有）'));
    if (lang === 'es') { if (o.t.trim() === en.trim() && /\s/.test(en)) E(id, '和英语原文一模一样'); return; }
    if (!Array.isArray(o.seg) || !Array.isArray(o.r)) { E(id, '日语 / 中文要有 seg 和 r'); return; }
    if (o.seg.join('') !== o.t) E(id, 'seg 接起来和 t 不一样：' + o.seg.join('|'));
    if (o.r.length !== o.seg.length) E(id, 'r 要和 seg 一样多（' + o.r.length + ' / ' + o.seg.length + '）');
    o.seg.forEach((s, i) => {
      const h = s.match(/\{[a-zA-Z0-9]+\}/);
      if (h) { if (s.replace(/[、。，！？!?,.…「」『』：:；;]/g, '') !== h[0]) E(id, '空要自己一块（后面只能跟标点）：' + s); if (o.r[i] !== h[0]) E(id, '空那一块的 r 写空本身：' + s + ' → ' + o.r[i]); return; }
      const r = String(o.r[i] || '');
      if (!r.trim()) E(id, '第 ' + (i + 1) + ' 块没有读音');
      if (HAN.test(r)) E(id, '读音里有汉字：' + r);
      if (lang === 'zh') {
        if (/\d/.test(r)) E(id, '拼音用声调符号：' + r);
        const n = (s.match(/[㐀-鿿豈-﫿]/g) || []).length, syl = r.trim().split(/\s+/).filter(Boolean).length;
        if (n && syl !== n && !/r\b/.test(r)) E(id, '拼音音节数（' + syl + '）和汉字数（' + n + '）对不上：' + s + ' / ' + r);
      }
    });
    if (isT && o.vals) for (const k of Object.keys(o.vals)) if (!(tById.get(id).slots || {})[k]) E(id, 'vals 里的空 ' + k + ' 模板里没有');
  };
  for (const [id, v] of Object.entries(J.lines || {})) { const s = byId.get(id); if (!s) E(id, 'lines-src.json 里没有这个 id'); else one(id, v, s.en, false); }
  for (const [id, v] of Object.entries(J.templates || {})) { const s = tById.get(id); if (!s) E(id, 'lines-src.json 里没有这个模板'); else { one(id, v, s.en, true); if (typeof v === 'object' && v.f && holes(v.f) !== holes(s.en)) E(id, 'f 那一句的空和原文不一样'); } }
  for (const [cat, m] of Object.entries(J.terms || {})) {
    const ids = new Set((SRC.terms[cat] || []).map(t => t.id));
    if (!SRC.terms[cat]) { E('terms.' + cat, '没有这一类词'); continue; }
    for (const [id, v] of Object.entries(m)) {
      if (!ids.has(id)) { E('terms.' + cat + '.' + id, '没有这个词'); continue; }
      const o = typeof v === 'string' ? { t: v } : v;
      if (!o || !String(o.t || '').trim()) E('terms.' + cat + '.' + id, '缺 t');
      else if (lang !== 'es') { if (!String(o.r || '').trim()) E('terms.' + cat + '.' + id, '缺读音 r'); else if (HAN.test(o.r)) E('terms.' + cat + '.' + id, '读音里有汉字'); }
    }
  }
  bad.forEach(x => console.log('错    ' + x));
  // 这个文件是哪一批的：看它翻了哪些源文件的句子，报这一批还差多少
  const done = new Set(Object.keys(J.lines || {}));
  for (const b of Object.keys(BATCH)) {
    const ls = linesOf(b); if (!ls.length || !ls.some(l => done.has(l.id))) continue;
    const miss = ls.filter(l => !done.has(l.id));
    console.log('批 ' + b + '：' + (ls.length - miss.length) + ' / ' + ls.length + ' 句' + (miss.length ? '，没翻的前几条：' + miss.slice(0, 5).map(l => l.id).join(' ') : ''));
  }
  if (J.templates) console.log('模板：' + Object.keys(J.templates).length + ' / ' + SRC.templates.length);
  if (J.terms) console.log('词：' + Object.entries(SRC.terms).map(([c, l]) => c + ' ' + Object.keys((J.terms || {})[c] || {}).length + '/' + l.length).join('，'));
  console.log((bad.length ? '✗ ' : '✓ ') + bad.length + ' 处错');
  process.exit(bad.length ? 1 : 0);
} else if (cmd === 'merge') {
  const lang = a1, dir = path.join(__dirname, lang);
  const parts = fs.readdirSync(dir).filter(f => /^lines\.part-.*\.json$/.test(f)).sort();
  const out = { lang, lines: {}, templates: {}, terms: {} };
  let clash = 0;
  const put = (bag, k, v, f) => { if (k in bag && JSON.stringify(bag[k]) !== JSON.stringify(v)) { console.log('两处不一样：' + k + '（' + f + '）'); clash++; } else bag[k] = v; };
  for (const f of parts) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [k, v] of Object.entries(j.lines || {})) put(out.lines, k, v, f);
    for (const [k, v] of Object.entries(j.templates || {})) put(out.templates, k, v, f);
    for (const [c, m] of Object.entries(j.terms || {})) { out.terms[c] = out.terms[c] || {}; for (const [k, v] of Object.entries(m)) put(out.terms[c], k, v, f); }
  }
  if (clash) { console.log('✗ ' + clash + ' 处对不上，没写'); process.exit(1); }
  // 按 lines-src.json 的先后排，同一份输入出来的文件一样
  const ord = (bag, list) => Object.fromEntries(list.map(x => x.id).filter(id => id in bag).map(id => [id, bag[id]]));
  out.lines = ord(out.lines, SRC.lines); out.templates = ord(out.templates, SRC.templates);
  for (const c of Object.keys(out.terms)) out.terms[c] = ord(out.terms[c], SRC.terms[c] || []);
  fs.writeFileSync(path.join(dir, 'lines.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('✓ ' + lang + '：' + parts.length + ' 个分批文件 → lines.json（' + Object.keys(out.lines).length + ' / ' + SRC.lines.length + ' 句，模板 ' + Object.keys(out.templates).length + ' / ' + SRC.templates.length + '）');
} else { console.error('用法见文件开头'); process.exit(2); }
