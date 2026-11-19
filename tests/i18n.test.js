// 界面语言（i18n.js）第一批搬家：world.js、monsters.js、setup.js、story.js、sighting.js 的界面文字都走字表（2026-11-19，「给所有人用」）
// 0. 不开浏览器（node tests/i18n.test.js --static 只跑这一段，几秒）：
//    · 每个文件的字表（I18N.add({ zh: {…}, en: {…} })，只能写纯数据）读得出来；代码里用到的每个键中文、英文都有；missing() 对这几个前缀是空的；
//    · 同一个键中文、英文的 {参数} 一样（复数 / 数组按全部写法合起来比）；英文里没有中文字（少数故意中英并排的键另列）；
//    · 这几个文件的字符串里不再有中文，除了：注释、内容（英文台词的中文意思，见下面 CONTENT 的规则）、ALLOW 里写了原因的几处。
// 1. 浏览器、界面语言 = 英语：大地图 HUD 和菜单、对话、战斗（招式面板、收服）、今日目击告示板、委托本、销售版向导——看得见的字里没有中文
//    （允许的：语言选择里的「中文」）；竖屏 / 横屏截图 tests/screenshots/i18n-*.png（要看图：英文比中文长，按钮、战斗面板、HUD 不能挤出去）
// 2. 界面语言 = 中文：和以前一字不差靠原来的测试（story、battle、adventure、sales……都按中文断言），这里抽查几处
// 运行：node tests/i18n.test.js（大约 2 分钟）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const STATIC_ONLY = process.argv.includes('--static');
const ONLY = (process.argv.find(a => a.startsWith('--file=')) || '').slice(7);
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 1500) : '')); if (!ok) fails++; return ok; };

// 这一批的文件和它们的键前缀
const FILES = { 'world.js': ['w.'], 'monsters.js': ['b.'], 'setup.js': ['su.'], 'story.js': ['st.'], 'sighting.js': ['si.'] };
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;
// 故意留着的中文字符串（不是内容、也不走字表）：[文件, 原样的字符串或正则, 原因]
const ALLOW = [
  ['world.js', '：', 'aiSkipTask 从内容台词的中文意思里切出「：」后面那截存进复习（「大声说：……」）：是逻辑，不显示'],
];
// 英文表里故意带中文的键（语言选择这种「两种语言并排」的）
const EN_CJK_OK = { 'su.ui': '语言选择的标题：两种语言并排，看不懂英文的人也找得到' };

// ---------- 把 JS 源码切成记号（够用就行：字符串、模板、正则、注释、括号） ----------
function lex(src) {
  const toks = [], comments = [];
  let i = 0, line = 1, prev = null;
  const n = src.length, tplStack = [];
  const push = (type, v, ln, extra) => { const t = Object.assign({ type, v, line: ln, pos: i }, extra || {}); toks.push(t); prev = t; return t; };
  const regexOk = () => !prev || (prev.type === 'p' && !/^[)\]}]$/.test(prev.v)) || (prev.type === 'id' && /^(return|typeof|case|in|of|new|delete|void|throw|instanceof|else|do|yield|await)$/.test(prev.v));
  function tplChunk() {   // 从 ` 或 } 后面读模板的一段，读到 ${ 或 `
    let buf = '';
    const ln = line;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { i++; push('tpl', buf, ln); return false; }
      if (c === '$' && src[i + 1] === '{') { i += 2; push('tpl', buf, ln); push('p', '${', line); tplStack.push(0); return true; }
      if (c === '\n') line++;
      buf += c; i++;
    }
    return false;
  }
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; comments.push({ line, v: src.slice(i + 2, end) }); i = end; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const seg = src.slice(i, e + 2); comments.push({ line, v: seg }); line += (seg.match(/\n/g) || []).length; i = e + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, buf = '';
      while (j < n && src[j] !== c) { if (src[j] === '\\') { buf += src.slice(j, j + 2); j += 2; continue; } buf += src[j]; j++; }
      push('str', buf, line, { raw: src.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (c === '`') { i++; tplChunk(); continue; }
    if (c === '}' && tplStack.length && tplStack[tplStack.length - 1] === 0) { tplStack.pop(); push('p', '}$', line); i++; tplChunk(); continue; }
    if (c === '{') { if (tplStack.length) tplStack[tplStack.length - 1]++; push('p', '{', line); i++; continue; }
    if (c === '}') { if (tplStack.length) tplStack[tplStack.length - 1]--; push('p', '}', line); i++; continue; }
    if (c === '/' && regexOk()) {
      let j = i + 1, cls = false;
      while (j < n) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; j++; }
      j++; while (/[a-z]/i.test(src[j] || '')) j++;
      push('re', src.slice(i, j), line); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; push('id', src.slice(i, j), line); i = j; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < n && /[\w.]/.test(src[j])) j++; push('num', src.slice(i, j), line); i = j; continue; }
    if (src.startsWith('=>', i)) { push('p', '=>', line); i += 2; continue; }
    if (src.startsWith('...', i)) { push('p', '...', line); i += 3; continue; }
    push('p', c, line); i++;
  }
  return { toks, comments };
}
const unq = s => { try { return JSON.parse('"' + s.replace(/\\'/g, "'").replace(/"/g, '\\"').replace(/\\`/g, '`').replace(/\\\$/g, '$') + '"'); } catch (e) { return s; } };

// ---------- 内容：不搬进字表的中文 ----------
// 规则（按顺序）：
//   ① 值是 zh 字段的（{ en: '…', zh: '…' }、quests / 线索这种，还有字表自己的 zh: { … }）；
//   ② 文件里写了 // @i18n-content-calls 名字:第几个参数 …（从 0 数）：这些函数的那个参数是中文意思（P('Hello!', '你好！') 这种台词）；
//   ③ 成对的数组 ['English sentence', '中文', …]：第一个是带空格或句末标点的英文，后面的中文都是它的意思；
//   ④ // @i18n-content 原因 …… // @i18n-content-end 之间的（线索模板这种成块的内容）
function scanFile(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { toks, comments } = lex(src);
  const calls = {};
  comments.forEach(c => { const m = /@i18n-content-calls\s+(.+)/.exec(c.v); if (m) m[1].trim().split(/\s+/).forEach(x => { const [k, v] = x.split(':'); (calls[k] = calls[k] || new Set()).add(+v); }); });
  const regions = [];
  let open = null;
  comments.forEach(c => {
    if (/@i18n-content-end\b/.test(c.v)) { if (open) { regions.push([open.line, c.line, open.why]); open = null; } }
    else if (/@i18n-content(?!-calls)\b/.test(c.v)) open = { line: c.line, why: c.v.replace(/.*@i18n-content/, '').trim() };
  });
  const out = [];   // { line, s, kind: table|zh|call|pair|region|allow|ui }
  const stack = [];   // { o: '(' '[' '{' '${', callee, arg, prop, first: 第 0 个元素的记号们, table: I18N.add( 的括号 }
  const inTable = new Set();   // 字表里面的记号（键名不算「用到」，英文表里的中文另外查）
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k], f = stack[stack.length - 1];
    if (stack.some(x => x.table)) inTable.add(k);
    if (t.type === 'p') {
      if (t.v === '(' || t.v === '[' || t.v === '{' || t.v === '${') {
        const callee = t.v === '(' && toks[k - 1] && toks[k - 1].type === 'id' ? toks[k - 1].v : null;
        const table = callee === 'add' && toks[k - 2] && toks[k - 2].v === '.' && toks[k - 3] && /^(I18N|EchoI18n)$/.test(toks[k - 3].v);
        stack.push({ o: t.v, callee, arg: 0, prop: null, first: [], table });
        continue;
      }
      if (t.v === ')' || t.v === ']' || t.v === '}' || t.v === '}$') { stack.pop(); continue; }
      if (t.v === ',' && f) { f.arg++; f.prop = null; continue; }
      if (t.v === ':' && f && f.o === '{') {
        const a = toks[k - 1], b = toks[k - 2];
        if (a && (a.type === 'id' || a.type === 'str') && b && b.type === 'p' && (b.v === '{' || b.v === ',')) f.prop = a.type === 'str' ? unq(a.v) : a.v;
        continue;
      }
    }
    if (f && f.arg === 0 && f.o === '[') f.first.push(t);
    if (t.type !== 'str' && t.type !== 'tpl') continue;
    const s = unq(t.v);
    if (!CJK.test(s)) continue;
    let kind = 'ui';
    if (inTable.has(k)) kind = 'table';
    else if (stack.some(x => x.o === '{' && x.prop === 'zh')) kind = 'zh';
    else if (f && f.o === '(' && f.callee && calls[f.callee] && calls[f.callee].has(f.arg)) kind = 'call';
    else if (f && f.o === '[' && f.arg >= 1 && f.first.length === 1 && f.first[0].type === 'str' && /[A-Za-z]/.test(f.first[0].v) && !CJK.test(unq(f.first[0].v)) && /\s|[.!?]$/.test(unq(f.first[0].v).trim())) kind = 'pair';
    else if (regions.some(([a, b]) => t.line > a && t.line < b)) kind = 'region';
    else if (ALLOW.some(([fl, m]) => fl === file && (m instanceof RegExp ? m.test(s) : m === s))) kind = 'allow';
    out.push({ line: t.line, s, kind });
  }
  return { src, toks, lits: out, regions, calls, inTable };
}

// ---------- 字表：把 I18N.add({ … }) / EchoI18n.add({ … }) 里的对象原样执行出来 ----------
function tablesOf(file, toks, src) {
  const out = [];
  for (let k = 0; k + 3 < toks.length; k++) {
    if (toks[k].type === 'id' && /^(I18N|EchoI18n)$/.test(toks[k].v) && toks[k + 1].v === '.' && toks[k + 2].v === 'add' && toks[k + 3].v === '(' && toks[k + 4] && toks[k + 4].v === '{') {
      // 找对应的 }：重新按字符数括号（跳过字符串、注释）
      const i0 = toks[k + 4].pos;
      let d = 0, i = i0, q = null;
      for (; i < src.length; i++) {
        const c = src[i];
        if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
        if (c === '{') d++;
        else if (c === '}') { d--; if (!d) break; }
      }
      try { out.push(vm.runInNewContext('(' + src.slice(i0, i + 1) + ')', {})); } catch (e) { out.push({ err: file + ' 第 ' + toks[k].line + ' 行的字表不是纯数据：' + e.message }); }
    }
  }
  return out;
}

// 给别的小工具用（比如核对搬家前后的中文一字不差）：require 这个文件只拿到函数，不跑检查
if (require.main !== module) { module.exports = { lex, unq, scanFile, tablesOf, CJK }; return; }

// node tests/i18n.test.js --list=world.js[:ui]   列出这个文件里带中文的字符串和它们算哪一类（搬字表时对着看）
const LIST = (process.argv.find(a => a.startsWith('--list=')) || '').slice(7);
if (LIST) {
  const [lf, lk] = LIST.split(':');
  scanFile(lf).lits.filter(x => !lk || x.kind === lk).forEach(x => console.log(x.line + '\t' + x.kind + '\t' + x.s.slice(0, 140)));
  process.exit(0);
}

const I18N = require(path.join(ROOT, 'i18n.js'));
const ph = v => { const s = new Set(); const walk = x => { if (typeof x === 'string') (x.match(/\{(\w+)\}/g) || []).forEach(m => s.add(m)); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') Object.values(x).forEach(walk); }; walk(v); return s; };
const vals = v => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(vals) : v && typeof v === 'object' ? Object.values(v).flatMap(vals) : []);

const report = {};
for (const file of Object.keys(FILES).filter(f => !ONLY || f === ONLY)) {
  const pre = FILES[file];
  const { src, toks, lits, regions, inTable } = scanFile(file);
  const tabs = tablesOf(file, toks, src);
  tabs.filter(x => x.err).forEach(x => check(false, x.err));
  const good = tabs.filter(x => !x.err);
  check(good.length <= 1, file + '：一个文件一个字表（现在 ' + good.length + ' 个）');
  good.forEach(tb => I18N.add(tb));
  const zh = Object.assign({}, ...good.map(x => x.zh || {})), en = Object.assign({}, ...good.map(x => x.en || {}));
  const mine = k => pre.some(p => k.startsWith(p));
  const zk = Object.keys(zh), foreign = zk.filter(k => !mine(k)).concat(Object.keys(en).filter(k => !mine(k)));
  // 用到的键：字符串字面量长得像「前缀.名字」的；后面跟着 + 的是动态键的开头（至少要有一个键以它开头）
  const used = new Set(), dyn = new Set();
  toks.forEach((t, k) => {
    if (t.type !== 'str' || inTable.has(k)) return;
    const s = unq(t.v);
    if (!pre.some(p => s.startsWith(p)) || !/^[a-z]+\.[\w.]*$/i.test(s)) return;
    if (toks[k + 1] && toks[k + 1].v === '+') dyn.add(s); else if (!s.endsWith('.')) used.add(s);
  });
  const missZh = [...used].filter(k => !(k in zh)), missEn = [...used].filter(k => !(k in en));
  const deadDyn = [...dyn].filter(p => !zk.some(k => k.startsWith(p)));
  const miss = pre.map(p => I18N.missing(p)).filter(m => Object.keys(m).length);
  const phBad = zk.filter(k => k in en).filter(k => { const a = ph(zh[k]), b = ph(en[k]); a.delete('{n}'); b.delete('{n}'); return a.size !== b.size || [...a].some(x => !b.has(x)); });
  const enCjk = Object.keys(en).filter(k => !EN_CJK_OK[k] && vals(en[k]).some(v => CJK.test(v)));
  const shape = zk.filter(k => k in en && (Array.isArray(zh[k]) !== Array.isArray(en[k]) || (Array.isArray(zh[k]) && zh[k].length !== en[k].length)));
  const ui = lits.filter(x => x.kind === 'ui');
  const by = {}; lits.forEach(x => { by[x.kind] = (by[x.kind] || 0) + 1; });
  report[file] = { keys: zk.length, used: used.size, dyn: dyn.size, lits: by, regions: regions.map(r => r[0] + '–' + r[1] + ' ' + r[2]) };
  check(!foreign.length, file + '：字表里的键都用自己的前缀 ' + pre.join(' '), foreign.slice(0, 20));
  check(!missZh.length && !missEn.length, file + '：用到的 ' + used.size + ' 个键中文、英文都有', { zh: missZh.slice(0, 30), en: missEn.slice(0, 30) });
  check(!deadDyn.length, file + '：拼出来的键（' + dyn.size + ' 种开头）字表里都有', deadDyn);
  check(!miss.length, file + '：EchoI18n.missing() 对 ' + pre.join(' ') + ' 是空的', miss);
  check(!phBad.length, file + '：每个键中文、英文的 {参数} 一样（' + zk.length + ' 个键）', phBad.map(k => k + ' zh=' + JSON.stringify(zh[k]) + ' en=' + JSON.stringify(en[k])).slice(0, 12).join('\n    '));
  check(!shape.length, file + '：数组的键中文、英文一样长', shape);
  check(!enCjk.length, file + '：英文表里没有中文字', enCjk.map(k => k + ': ' + JSON.stringify(en[k])).slice(0, 12).join('\n    '));
  check(!ui.length, file + '：字符串里不再有界面中文（内容 ' + ((by.zh || 0) + (by.call || 0) + (by.pair || 0) + (by.region || 0)) + ' 处、允许 ' + (by.allow || 0) + ' 处）', ui.slice(0, 40).map(x => x.line + ': ' + x.s.slice(0, 80)).join('\n    '));
}
console.log('  ' + JSON.stringify(report, null, 1).replace(/\n/g, '\n  '));

if (STATIC_ONLY || ONLY) process.exit(fails ? 1 : 0);

// ================= 1. 浏览器：界面语言 = 英语 =================
const http = require('http');
const H = require('./helpers');
const FN = require('./fake-native');
const SHOTS = path.join(__dirname, 'screenshots');
// 看得见的字里允许的中文：语言选择里「中文」这门语言自己的写法、「Language · 界面语言」这个标题
const OK_RUNS = ['中文', '界面语言'];
// 第二批（game.js / book.js）才搬的、会出现在这几个画面里的中文：照样列出来，但不算这一批的错
const PHASE_B = [/^[七八九][上下]$/];
const runsOf = s => (String(s).match(new RegExp(CJK.source + '+', 'g')) || []);
function cjkCheck(what, txt) {
  const runs = runsOf(txt).filter(r => !OK_RUNS.includes(r)), later = runs.filter(r => PHASE_B.some(re => re.test(r))), bad = runs.filter(r => !later.includes(r));
  check(!bad.length, '英语界面 · ' + what + '：没有中文' + (later.length ? '（第二批的：' + [...new Set(later)].join(' ') + '）' : ''), [...new Set(bad)].join(' | ') + '\n    ' + String(txt).replace(/\s+/g, ' ').slice(0, 500));
  return !bad.length;
}
// 这几个文件中文字表里带中文的句子 → 正则（{参数} 随便是什么）：英语界面弹出来的提示要是对上了，就是漏翻的
const MY_ZH = I18N.keys('zh').filter(k => Object.values(FILES).some(ps => ps.some(p => k.startsWith(p)))).flatMap(k => vals(I18N.raw(k, 'zh'))).filter(v => runsOf(v.replace(/\{\w+\}/g, ' ')).join('').length >= 4)
  .map(v => new RegExp(v.replace(/<[^>]+>/g, '').split(/\{\w+\}/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*?')));
// 收集弹出来的提示（#toasts 里的 .toast，3 秒就没了）
const watchToasts = p => p.evaluate(() => { window.__toastLog = window.__toastLog || []; const box = document.getElementById('toasts'); if (box) new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) window.__toastLog.push(n.textContent); }))).observe(box, { childList: true }); });
// 一块地方看得见的字 + 读屏用的 aria-label / title / placeholder / alt
const seen = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].map(e => e.innerText + ' ' + [...e.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')].filter(x => x.getClientRects().length).map(x => [x.getAttribute('aria-label'), x.getAttribute('title'), x.getAttribute('placeholder'), x.getAttribute('alt')].filter(Boolean).join(' ')).join(' ')).join(' | '), sel);
const act = (p, a, extra) => p.evaluate(([a, extra]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra || {}); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra || null]);
// 内容放不下：有没有横着挤出去的（按钮、战斗面板、HUD、弹窗里）
const overflow = (p, sel) => p.evaluate(sel => {
  const vw = innerWidth, out = [];
  document.querySelectorAll(sel).forEach(root => root.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > vw + 1 || r.left < -1)) out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(r.left) + '…' + Math.round(r.right));
    const cs = getComputedStyle(e);
    if (/BUTTON/.test(e.tagName) && e.scrollWidth > e.clientWidth + 2 && cs.overflow !== 'hidden' && cs.textOverflow !== 'ellipsis' && cs.overflowX !== 'auto') out.push('按钮里的字挤出去了：' + e.innerText.replace(/\s+/g, ' ').slice(0, 40));
  }));
  return out.slice(0, 12);
}, sel);

async function adventure(view, tag) {
  const t = await H.open({ viewport: view });
  const { p, W } = t;
  await t.save({ map: 't1', badges: { 0: 1, 1: 1 }, visited: { 0: 1, 1: 1 }, bag: { hm_cut: 1, rod: 1, bike: 1, superball: 2 }, team: [['tidalfin', 30], ['flamewolf', 30]] });
  // 界面语言 = 英语；去过 1 号路（今日目击有目标）
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); s.settings.ui = 'en'; s.world.been = { r0: 1 }; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
  await p.reload(); await W(500);
  await watchToasts(p);
  await p.click('[data-act=wEnter]'); await W(1600);
  check(await p.evaluate(() => EchoI18n.lang() === 'en' && document.documentElement.lang === 'en'), tag + ' 界面语言是英语（<html lang="en">）');
  // 大地图 HUD 和操作
  cjkCheck(tag + ' 大地图 HUD', await seen(p, '#world .w-hud, #world .w-ctrl, #world .ab, #w-joy'));
  check(!(await overflow(p, '#world .w-hud')).length, tag + ' HUD 没有挤出屏幕', await overflow(p, '#world .w-hud'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-hud-' + tag + '.png') });
  // 冒险菜单（含今日目击那一行）
  await act(p, 'wMenu'); await W(400);
  cjkCheck(tag + ' 冒险菜单', await seen(p, '#modal'));
  check(!(await overflow(p, '#modal')).length, tag + ' 冒险菜单放得下', await overflow(p, '#modal'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-menu-' + tag + '.png') });
  // 今日目击告示板：只有英文线索，没有「译」也没有中文意思
  await p.click('#modal [data-act=sgOpen]'); await W(400);
  const sg = await p.evaluate(() => ({ clues: document.querySelectorAll('#modal .sg-clue').length, zh: document.querySelectorAll('#modal .sg-zh').length }));
  check(sg.clues === 3 && sg.zh === 0, tag + ' 今日目击：三条英文线索，没有「译」、没有中文意思', sg);
  cjkCheck(tag + ' 今日目击告示板', await seen(p, '#modal'));
  check(!(await overflow(p, '#modal')).length, tag + ' 告示板放得下', await overflow(p, '#modal'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-sighting-' + tag + '.png') });
  // 委托本、回声技能、怎么玩
  await act(p, 'wQuests'); await W(400);
  cjkCheck(tag + ' 委托本', await seen(p, '#modal'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-quests-' + tag + '.png') });
  await act(p, 'wSkills'); await W(300); cjkCheck(tag + ' 回声技能', await seen(p, '#modal'));
  check(!(await overflow(p, '#modal')).length, tag + ' 回声技能放得下', await overflow(p, '#modal'));
  await act(p, 'wHelp'); await W(300); cjkCheck(tag + ' 怎么玩', await seen(p, '#modal'));
  await act(p, 'close'); await W(300);
  // 对话：岛上脚本传来的「旁白」显示成 Narrator，台词的中文意思不显示、没有「译」；说话任务的提示是英文
  await p.evaluate(() => EchoWorld._debug().talk([{ who: '旁白', emo: '💬', en: 'Hello there! Nice to meet you.', zh: '你好！很高兴认识你。' }, { who: 'Amy', look: EchoPeople.LOOKS.mom, g: 'f', en: 'Can you say it?', zh: '你能跟我说一遍吗？', kind: 'speak', target: 'Nice to meet you!' }]));
  await t.typed(); await W(200);
  check(await p.evaluate(() => document.querySelector('#w-dlg .d-name').textContent === 'Narrator' && !document.querySelector('#w-dlg #d-zh')), tag + ' 对话：「旁白」→ Narrator，没有中文意思、没有「译」');
  cjkCheck(tag + ' 对话', await seen(p, '#w-dlg'));
  await t.A(); await W(400);
  cjkCheck(tag + ' 说话任务', await seen(p, '#w-dlg'));
  check(!(await overflow(p, '#w-dlg')).length, tag + ' 对话框放得下', await overflow(p, '#w-dlg'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-dialogue-' + tag + '.png') });
  await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); await t.closeDlg();
  check((await p.evaluate(() => EchoWorld.storyZhHTML())) === '', tag + ' 英语界面没有「剧情中文」设置（内容没有英语界面的意思）');
  // 镇上的人：平常的话
  check(await t.talkTo(n => !['trainer', 'leader', 'clerk', 'nurse', 'guard', 'ferry', 'daycare', 'house', 'quiz', 'gift'].includes(n.role) && !n.mon), tag + ' 找到一位村民说话');
  await t.typed(); cjkCheck(tag + ' 村民对话', await seen(p, '#w-dlg')); check(!(await p.$('#w-dlg #d-zh')), tag + ' 村民对话：没有中文意思、没有「译」');
  await t.closeDlg(); if (await p.$('#w-dlg [data-act=wSelfDone]')) await t.task(); await t.idle(30);
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove()));   // 进地图的提示别挡住对战截图
  // 对战：顶上、招式面板、出招任务、背包、换怪兽、收服
  await p.evaluate(() => MonsterGame.battle('wild', 1)); await W(3200);
  for (let i = 0; i < 20 && !(await p.$('#b-panel [data-act=bMove]')); i++) await W(250);
  cjkCheck(tag + ' 对战（招式面板）', await seen(p, '#battle'));
  check(!(await overflow(p, '#battle')).length, tag + ' 对战画面放得下', await overflow(p, '#battle'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-battle-' + tag + '.png') });
  await p.click('#b-panel [data-act=bMove][data-i="0"]'); await W(700);
  cjkCheck(tag + ' 对战（出招任务）', await seen(p, '#battle'));
  check(!(await overflow(p, '#battle')).length, tag + ' 出招任务放得下', await overflow(p, '#battle'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-battle-task-' + tag + '.png') });
  const back = await p.$('#b-panel [data-act=bBack]'); if (back) { await back.click(); await W(300); }
  await act(p, 'bBag'); await W(300); cjkCheck(tag + ' 对战背包', await seen(p, '#modal')); await act(p, 'close'); await W(200);
  await act(p, 'bSwitch'); await W(300); cjkCheck(tag + ' 换怪兽', await seen(p, '#modal')); await act(p, 'close'); await W(200);
  // 收服：先选球（有金回声球时问用哪种），再念收服咒语
  await act(p, 'bCatch'); await W(500);
  if (await p.isVisible('#modal')) { cjkCheck(tag + ' 选球', await seen(p, '#modal')); await p.click('#modal [data-act=bCatch][data-ball=ball]'); await W(600); }
  cjkCheck(tag + ' 收服咒语', await seen(p, '#battle'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-catch-' + tag + '.png') });
  const fought = await t.fight();
  cjkCheck(tag + ' 对战结束', fought);
  for (let i = 0; i < 6 && await p.isVisible('#modal'); i++) { cjkCheck(tag + ' 战斗后的弹窗', await seen(p, '#modal')); await p.evaluate(() => { const b = document.querySelector('#modal [data-act=mNickSkip], #modal [data-act=mForget][data-k="-1"], #modal #evo-ok:not([hidden]), #modal [data-act=close]'); if (b) b.click(); }); await W(500); }
  // 首页「怪兽冒险」里这几个文件画的卡片（首页别的部分是 game.js，第二批）
  await act(p, 'wExit'); await W(800);
  cjkCheck(tag + ' 首页的怪兽卡片和今日目击', await seen(p, '#home .mon-card'));
  // 一路上弹过的提示：这几个文件的中文字表里的句子不能在英语界面出现（game.js 弹的中文是第二批的，只列出来）
  const tl = await p.evaluate(() => window.__toastLog || []), zhT = tl.filter(s => CJK.test(s));
  const mineT = zhT.filter(s => MY_ZH.some(re => re.test(s)));
  check(!mineT.length, tag + ' 弹出的提示（' + tl.length + ' 条）没有这几个文件的中文' + (zhT.length - mineT.length ? '（game.js 的，第二批：' + zhT.filter(s => !mineT.includes(s)).join(' / ').slice(0, 200) + '）' : ''), mineT);
  if (tag === 'port') {
    // 界面语言 = 中文：抽查几处和以前一样
    await p.evaluate(() => { EchoGame.S.settings.ui = 'zh'; const s = JSON.parse(localStorage.getItem('echo-island-v1')); s.settings.ui = 'zh'; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
    await p.reload(); await W(600);
    await act(p, 'sgOpen'); await W(300);
    const zh = await seen(p, '#modal');
    check(/今日目击/.test(zh) && /回声博士的告示板/.test(zh) && /地图上没有记号/.test(zh) && (await p.$$('#modal button.sg-zh')).length === 3, '中文界面：告示板照旧（今日目击、三个「译」）');
    check(/^<div class="set"><label>📖 剧情中文<\/label>/.test(await p.evaluate(() => EchoWorld.storyZhHTML())), '中文界面：「剧情中文」设置还在');
  }
  await t.done();
}

// 销售版向导（假原生桥），界面语言选英语，从第一页走到最后一页
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.normalize(path.join(ROOT, u === '/' ? 'index.html' : u));
    if (!f.startsWith(ROOT) || /[\\/](android|server|node_modules|art)[\\/]/.test(f.slice(ROOT.length))) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
async function wizard(view, tag) {
  const { chromium } = require('playwright');
  const srv = await serve();
  const b = await chromium.launch(Object.assign({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const p = await (await b.newContext({ viewport: view })).newPage();
  p.setDefaultTimeout(6000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(FN.install, { edition: 'sales', pin: null, key: '', net: 'ok', mic: 'granted' });
  await p.addInitScript(() => { const F = window.__fakeNative; if (F) F.onPost = (id, url, body, cb) => cb(id, 'fail', 'HTTP 500'); });
  const W = ms => p.waitForTimeout(ms);
  const HOST = 'http://127.0.0.1:' + srv.address().port;
  await p.goto(HOST + '/index.html?edition=sales');
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await W(900);
  await watchToasts(p);
  check(!!(await p.$('#setup')), tag + ' 销售版：出现首次设置向导');
  await p.click('[data-act=suUi][data-l=en]'); await W(300);
  const page = async (name, shot) => {
    await W(200);
    cjkCheck(tag + ' 向导 · ' + name, await seen(p, '#su-box'));
    check(!(await overflow(p, '#setup')).length, tag + ' 向导 · ' + name + '：放得下', await overflow(p, '#setup'));
    if (shot) await p.screenshot({ path: path.join(SHOTS, 'i18n-setup-' + name + '-' + tag + '.png') });
  };
  const next = async () => { await p.click('#su-next'); await W(350); };
  await page('welcome', true);
  // 「我自己学」那条路的第一页也看一眼，再换回「给孩子用」（家长向导六步）
  await p.click('[data-act=suWho][data-m=open]'); await W(250); await page('welcome-self', tag === 'port');
  await p.click('[data-act=suWho][data-m=kid]'); await W(250);
  await p.click('#su-consent'); await W(150); await next();
  for (let i = 0; i < 40 && !(await p.$('#su-verdict')); i++) await W(150);
  await page('device', true);
  await next();
  await page('pin', tag === 'port');
  for (const n of [1, 2]) { for (const d of '3691') await p.click('#su-box [data-act=suPin][data-k="' + d + '"]'); await W(400); }
  await page('pin-done', false);
  await next(); await page('key', tag === 'port');
  await p.fill('#su-key', 'hello'); await p.click('#su-key-test'); for (let i = 0; i < 30 && !(await p.$('#su-key-res p')); i++) await W(100);
  await page('key-bad', false);
  await p.click('#su-box [data-act=suKeySkip]').catch(() => {}); await W(350);
  if (await p.evaluate(() => (document.querySelector('#su-box .su-step') || {}).dataset.step === 'key')) await next();
  await p.fill('#su-nick', 'Zhang Wei'); await W(150); await page('nick-warn', false);
  await p.fill('#su-nick', 'Kevin'); await W(150); await page('nick', true);
  await next(); await page('mons', tag === 'port');
  for (const id of await p.evaluate(() => [...document.querySelectorAll('#su-box .su-mon')].map(x => x.dataset.id).slice(0, 3))) { await p.click('#su-box [data-act=suMon][data-id="' + id + '"]'); await W(120); }
  await next();
  for (const rel of ['dad', 'grandma']) { await p.click('#su-box [data-act=suFamAdd][data-rel="' + rel + '"]'); await W(120); }
  await page('fam', true);
  await next(); await page('done', true);
  const tl = await p.evaluate(() => window.__toastLog || []);
  check(tl.length > 0 && !tl.some(s => CJK.test(s)), tag + ' 向导弹出的提示是英文：' + tl.join(' / ').slice(0, 160), tl);
  check(!errs.length, tag + ' 向导没有报错', errs.slice(0, 3));
  await b.close(); srv.close();
}

(async () => {
  for (const [view, tag] of [[{ width: 390, height: 844 }, 'port'], [{ width: 844, height: 390 }, 'land']]) {
    console.log('—— 冒险（' + tag + '）');
    await adventure(view, tag);
    console.log('—— 销售版向导（' + tag + '）');
    await wizard(view, tag);
  }
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails || process.exitCode ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
