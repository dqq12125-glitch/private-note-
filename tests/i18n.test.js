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

// 搬进字表的文件和它们的键前缀（第一批：world / monsters / setup / story / sighting；第二批：game、talk、talk-core、isles）
const FILES = {
  'world.js': ['w.'], 'monsters.js': ['b.'], 'setup.js': ['su.'], 'story.js': ['st.'], 'sighting.js': ['si.'],
  'game.js': ['g.'], 'talk.js': ['tk.'], 'talk-core.js': ['tc.'],
  'isles/a-hello-crayon.js': ['ia.'], 'isles/b-farm-school-lab.js': ['ib.'], 'isles/c-circus-clock-party.js': ['ic.'], 'isles/d-jungle-city-sports.js': ['id.'], 'isles/e-snow-ruins-league.js': ['ie.'],
};
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
// 竖屏 390×844、横屏 844×390 各走一遍（截图 tests/screenshots/i18n-<画面>-<port|land>.png，要看图：英文比中文长，挤没挤、截没截断）：
//   adventure 大地图 HUD、冒险菜单、今日目击、委托本、对话、村民、对战（world.js / monsters.js / sighting.js / story.js）
//   wizard    销售版首次设置向导（setup.js）
//   home      首页三个标签（怪兽冒险 / 闯关练习 课本和小岛 / 和岛民聊天）、顶栏、工具栏、任务栏、首页提示条、页脚、关卡详情、宠物店、成就
//   practice  从首页点开一关走到结算（选听到的词 / 句、排句子、听问选答、跟读、看图说、录音自评），再加几道撤了提示的题
//             （英语界面：看图说、先听一遍再看首字母说）、对话题、Boss 题，结算页和结算后的弹窗
//   review    每日复习：复习本里有到期的题 → 复习弹窗 → 题（含聊天里改过的句子）→ 复习结果
//   chat      和岛民聊天（假的阿里云，和 talk.test.js 一样）：聊天首页、聊天界面和目标卡、说三句、评语页
//   quest     支线委托（和 quests.test.js 一样）：大地图上按 A → 请求 → 聊天 → 评语页 → 道谢、奖励
//   settings  设置、🔒 家长设置、家长密码键盘、冒险时间 / 日报推送 / 版本 / 出错记录 / 从备份恢复 / 能力检测 几个小页面、周报
//   gate      学习锁卡片（要复习、没网临时放行）、拦住时的提示、复习结果页「去和岛民聊天」、第一次设家长密码
//   errors    安装包（假原生桥）：麦克风被永久拒绝的弹窗、没网时话筒下的提示和「先跳过」、首页红条和说明、聊天连不上
//   place     首页「能力检测」卡片 → 谁在学 → 开始之前 → 第一题 → 暂停 → 「继续」卡片
//   zh        （只竖屏）界面语言 = 中文：抽查这些画面的几句和以前一字不差
// 只跑几段：node tests/i18n.test.js --only=home,practice（--view=port 只跑竖屏）；不带参数全跑，约 5–6 分钟
const http = require('http');
const H = require('./helpers');
const FN = require('./fake-native');
const SHOTS = path.join(__dirname, 'screenshots');
const SECTIONS = ['adventure', 'wizard', 'home', 'practice', 'review', 'chat', 'quest', 'settings', 'gate', 'errors', 'place', 'zh', 'look'];
const ONLY_S = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const VIEW = (process.argv.find(a => a.startsWith('--view=')) || '').slice(7);
if (ONLY_S.some(s => !SECTIONS.includes(s))) { console.error('--only= 只认这些：' + SECTIONS.join(',')); process.exit(2); }
const want = s => !ONLY_S.length || ONLY_S.includes(s);
// 看得见的字里允许的中文：语言选择里「中文」这门语言自己的写法、「Language · 界面语言」这个两种语言并排的标题
const OK_RUNS = ['中文', '界面语言'];
const runsOf = s => (String(s).match(new RegExp(CJK.source + '+', 'g')) || []);
// 漏翻的中文是从哪个文件来的：在源码里找这段字（代码文件排前面，内容数据排后面）
const DATA_JS = ['data.js', 'book.js', 'dex.js', 'talk-npcs.js', 'quests.js', 'placement-data.js', 'music-data.js'];
let SRC = null;
function srcOf(run) {
  if (!SRC) {
    const fl = fs.readdirSync(ROOT).filter(f => f.endsWith('.js')).concat(fs.readdirSync(path.join(ROOT, 'isles')).filter(f => f.endsWith('.js')).map(f => 'isles/' + f));
    fl.sort((a, b) => DATA_JS.includes(a) - DATA_JS.includes(b));
    SRC = fl.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]).concat([['index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')]]);
  }
  const hit = SRC.filter(([, s]) => s.includes(run)).map(([f]) => f);
  return hit.length ? hit.slice(0, 3).join(' / ') : '?';
}
// where：哪几个元素里有中文（cjkEls 给的），没过的时候一起打出来
function cjkCheck(what, txt, where) {
  const bad = [...new Set(runsOf(txt).filter(r => !OK_RUNS.includes(r)))];
  check(!bad.length, '英语界面 · ' + what + '：没有中文', bad.slice(0, 14).map(r => r + '〔' + srcOf(r) + '〕').join(' | ') +
    (where && where.length ? '\n    · ' + where.join('\n    · ') : '\n    ' + String(txt).replace(/\s+/g, ' ').slice(0, 300)));
  return !bad.length;
}
// 一块地方里带中文的字在哪几个元素上（文字、aria-label、title、placeholder、alt）
const cjkEls = (p, sel) => p.evaluate(([sel, src, ok]) => {
  const re = new RegExp(src), out = [], okOnly = s => (s.match(new RegExp(src + '+', 'g')) || []).every(r => ok.includes(r));
  const name = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('');
  document.querySelectorAll(sel).forEach(root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) { const e = n.parentElement; if (e && re.test(n.data) && !okOnly(n.data) && e.getClientRects().length) out.push(name(e) + '：' + n.data.trim().replace(/\s+/g, ' ').slice(0, 70)); }
    [root, ...root.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')].forEach(e => { if (!e.getClientRects().length) return; ['aria-label', 'title', 'placeholder', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v && re.test(v) && !okOnly(v)) out.push(name(e) + ' [' + a + ']：' + v.slice(0, 70)); }); });
  });
  return [...new Set(out)].slice(0, 10);
}, [sel, CJK.source, OK_RUNS]);
async function cjkAt(p, what, sel) {
  const txt = await seen(p, sel);
  if (!runsOf(txt).some(r => !OK_RUNS.includes(r))) return cjkCheck(what, txt);
  return cjkCheck(what, txt, await cjkEls(p, sel));
}
// 字表里带中文的句子 → 正则（{参数} 随便是什么）：英语界面弹出来的中文提示是哪个键（哪个文件）的
const ZH_RES = I18N.keys('zh').filter(k => Object.values(FILES).some(ps => ps.some(p => k.startsWith(p)))).flatMap(k => vals(I18N.raw(k, 'zh')).map(v => [k, v])).filter(([, v]) => runsOf(v.replace(/\{\w+\}/g, ' ')).join('').length >= 4)
  .map(([k, v]) => [k, new RegExp(v.replace(/<[^>]+>/g, '').split(/\{\w+\}/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*?'))]);
const fileOfKey = k => Object.keys(FILES).find(f => FILES[f].some(p => k.startsWith(p))) || '?';
const zhSrc = s => { const m = ZH_RES.find(([, re]) => re.test(s)); return m ? m[0] + ' · ' + fileOfKey(m[0]) : srcOf(runsOf(s)[0]); };
// 收集弹出来的提示（#toasts 里的 .toast，3 秒就没了）
const watchToasts = p => p.evaluate(() => { window.__toastLog = window.__toastLog || []; const box = document.getElementById('toasts'); if (box) new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('toast')) window.__toastLog.push(n.textContent); }))).observe(box, { childList: true }); });
// 一路上弹过的提示里不能有中文（英语界面）
async function toastCheck(p, what) {
  const tl = await p.evaluate(() => window.__toastLog || []), zh = tl.filter(s => CJK.test(s));
  check(!zh.length, '英语界面 · ' + what + '：弹出的提示（' + tl.length + ' 条）没有中文', zh.slice(0, 8).map(s => s + '〔' + zhSrc(s) + '〕').join(' / '));
}
// 一块地方看得见的字 + 读屏用的 aria-label / title / placeholder / alt
const seen = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel)].map(e => e.innerText + ' ' + [...e.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')].filter(x => x.getClientRects().length).map(x => [x.getAttribute('aria-label'), x.getAttribute('title'), x.getAttribute('placeholder'), x.getAttribute('alt')].filter(Boolean).join(' ')).join(' ')).join(' | '), sel);
const act = (p, a, extra) => p.evaluate(([a, extra]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra || {}); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra || null]);
// 点一下（不等动画、不等能点，找不到返回 false）
const tap = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
// 内容放不下：有没有横着挤出去的（按钮、战斗面板、HUD、弹窗里）；故意横着滚的一排（课本册、词卡）里的不算，但整个弹窗 / 页面能横着滚就算
const overflow = (p, sel) => p.evaluate(sel => {
  const vw = innerWidth, out = [], BIG = /^(HTML|BODY)$/;
  const scroller = e => { for (let a = e.parentElement; a && !BIG.test(a.tagName); a = a.parentElement) { if (a.id === 'sheet' || a.id === 'modal') return false; const ox = getComputedStyle(a).overflowX; if (/auto|scroll/.test(ox) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
  document.querySelectorAll(sel).forEach(root => root.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return;
    const r = e.getBoundingClientRect();
    if (r.width && (r.right > vw + 1 || r.left < -1) && !scroller(e)) out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ' ' + Math.round(r.left) + '…' + Math.round(r.right));
    const cs = getComputedStyle(e);
    if (/BUTTON/.test(e.tagName) && e.scrollWidth > e.clientWidth + 2 && cs.overflow !== 'hidden' && cs.textOverflow !== 'ellipsis' && cs.overflowX !== 'auto') {
      // 按钮上故意挂在外面的小牌子（关卡上的「开始」和宠物）不算：有绝对定位的子元素时，只看正常排的子元素有没有出了按钮
      const ab = c => /absolute|fixed/.test(getComputedStyle(c).position), br = e.getBoundingClientRect();
      const out1 = ![...e.querySelectorAll('*')].some(ab) || [...e.children].filter(c => !ab(c) && c.getClientRects().length).some(c => { const q = c.getBoundingClientRect(); return q.left < br.left - 2 || q.right > br.right + 2; });
      if (out1) out.push('按钮里的字挤出去了：' + e.innerText.replace(/\s+/g, ' ').slice(0, 40));
    }
  }));
  const sh = document.getElementById('sheet');
  if (sh && sh.getClientRects().length && sh.scrollWidth > sh.clientWidth + 1) out.push('弹窗能横着滚（' + sh.scrollWidth + ' > ' + sh.clientWidth + '）');
  if (document.documentElement.scrollWidth > vw + 1) out.push('整页能横着滚（' + document.documentElement.scrollWidth + ' > ' + vw + '）');
  return out.slice(0, 12);
}, sel);
const fitCheck = async (p, what, sel) => { const o = await overflow(p, sel); check(!o.length, what + '：放得下', o); return !o.length; };
// 等弹窗淡入、反馈条滑上来这种一次性的动画放完再截图（一直转的、一直闪的不等），最多等 0.8 秒
const settle = p => p.evaluate(() => Promise.race([new Promise(r => setTimeout(r, 800)),
  Promise.all(document.getAnimations().filter(a => { try { return a.effect && a.effect.getComputedTiming().iterations !== Infinity; } catch (e) { return false; } }).map(a => a.finished.catch(() => {})))]));
const shotOf = (name, tag) => path.join(SHOTS, 'i18n-' + name + '-' + tag + '.png');
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

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
  await cjkAt(p, tag + ' 大地图 HUD', '#world .w-hud, #world .w-ctrl, #world .ab, #w-joy');
  check(!(await overflow(p, '#world .w-hud')).length, tag + ' HUD 没有挤出屏幕', await overflow(p, '#world .w-hud'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-hud-' + tag + '.png') });
  // 冒险菜单（含今日目击那一行）
  await act(p, 'wMenu'); await W(400);
  await cjkAt(p, tag + ' 冒险菜单', '#modal');
  check(!(await overflow(p, '#modal')).length, tag + ' 冒险菜单放得下', await overflow(p, '#modal'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-menu-' + tag + '.png') });
  // 今日目击告示板：只有英文线索，没有「译」也没有中文意思
  await p.click('#modal [data-act=sgOpen]'); await W(400);
  const sg = await p.evaluate(() => ({ clues: document.querySelectorAll('#modal .sg-clue').length, zh: document.querySelectorAll('#modal .sg-zh').length }));
  check(sg.clues === 3 && sg.zh === 0, tag + ' 今日目击：三条英文线索，没有「译」、没有中文意思', sg);
  await cjkAt(p, tag + ' 今日目击告示板', '#modal');
  check(!(await overflow(p, '#modal')).length, tag + ' 告示板放得下', await overflow(p, '#modal'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-sighting-' + tag + '.png') });
  // 委托本、回声技能、怎么玩
  await act(p, 'wQuests'); await W(400);
  await cjkAt(p, tag + ' 委托本', '#modal');
  await p.screenshot({ path: path.join(SHOTS, 'i18n-quests-' + tag + '.png') });
  await act(p, 'wSkills'); await W(300); await cjkAt(p, tag + ' 回声技能', '#modal');
  check(!(await overflow(p, '#modal')).length, tag + ' 回声技能放得下', await overflow(p, '#modal'));
  await act(p, 'wHelp'); await W(300); await cjkAt(p, tag + ' 怎么玩', '#modal');
  await act(p, 'close'); await W(300);
  // 对话：岛上脚本传来的「旁白」显示成 Narrator，台词的中文意思不显示、没有「译」；说话任务的提示是英文
  await p.evaluate(() => EchoWorld._debug().talk([{ who: '旁白', emo: '💬', en: 'Hello there! Nice to meet you.', zh: '你好！很高兴认识你。' }, { who: 'Amy', look: EchoPeople.LOOKS.mom, g: 'f', en: 'Can you say it?', zh: '你能跟我说一遍吗？', kind: 'speak', target: 'Nice to meet you!' }]));
  await t.typed(); await W(200);
  check(await p.evaluate(() => document.querySelector('#w-dlg .d-name').textContent === 'Narrator' && !document.querySelector('#w-dlg #d-zh')), tag + ' 对话：「旁白」→ Narrator，没有中文意思、没有「译」');
  await cjkAt(p, tag + ' 对话', '#w-dlg');
  await t.A(); await W(400);
  await cjkAt(p, tag + ' 说话任务', '#w-dlg');
  check(!(await overflow(p, '#w-dlg')).length, tag + ' 对话框放得下', await overflow(p, '#w-dlg'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-dialogue-' + tag + '.png') });
  await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); await t.closeDlg();
  check((await p.evaluate(() => EchoWorld.storyZhHTML())) === '', tag + ' 英语界面没有「剧情中文」设置（内容没有英语界面的意思）');
  // 镇上的人：平常的话
  check(await t.talkTo(n => !['trainer', 'leader', 'clerk', 'nurse', 'guard', 'ferry', 'daycare', 'house', 'quiz', 'gift'].includes(n.role) && !n.mon), tag + ' 找到一位村民说话');
  await t.typed(); await cjkAt(p, tag + ' 村民对话', '#w-dlg'); check(!(await p.$('#w-dlg #d-zh')), tag + ' 村民对话：没有中文意思、没有「译」');
  await t.closeDlg(); if (await p.$('#w-dlg [data-act=wSelfDone]')) await t.task(); await t.idle(30);
  await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove()));   // 进地图的提示别挡住对战截图
  // 对战：顶上、招式面板、出招任务、背包、换怪兽、收服
  await p.evaluate(() => MonsterGame.battle('wild', 1)); await W(3200);
  for (let i = 0; i < 20 && !(await p.$('#b-panel [data-act=bMove]')); i++) await W(250);
  await cjkAt(p, tag + ' 对战（招式面板）', '#battle');
  check(!(await overflow(p, '#battle')).length, tag + ' 对战画面放得下', await overflow(p, '#battle'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-battle-' + tag + '.png') });
  await p.click('#b-panel [data-act=bMove][data-i="0"]'); await W(700);
  await cjkAt(p, tag + ' 对战（出招任务）', '#battle');
  check(!(await overflow(p, '#battle')).length, tag + ' 出招任务放得下', await overflow(p, '#battle'));
  await p.screenshot({ path: path.join(SHOTS, 'i18n-battle-task-' + tag + '.png') });
  const back = await p.$('#b-panel [data-act=bBack]'); if (back) { await back.click(); await W(300); }
  await act(p, 'bBag'); await W(300); await cjkAt(p, tag + ' 对战背包', '#modal'); await act(p, 'close'); await W(200);
  await act(p, 'bSwitch'); await W(300); await cjkAt(p, tag + ' 换怪兽', '#modal'); await act(p, 'close'); await W(200);
  // 收服：先选球（有金回声球时问用哪种），再念收服咒语
  await act(p, 'bCatch'); await W(500);
  if (await p.isVisible('#modal')) { await cjkAt(p, tag + ' 选球', '#modal'); await p.click('#modal [data-act=bCatch][data-ball=ball]'); await W(600); }
  await cjkAt(p, tag + ' 收服咒语', '#battle');
  await p.screenshot({ path: path.join(SHOTS, 'i18n-catch-' + tag + '.png') });
  const fought = await t.fight();
  cjkCheck(tag + ' 对战结束', fought);
  for (let i = 0; i < 6 && await p.isVisible('#modal'); i++) { await cjkAt(p, tag + ' 战斗后的弹窗', '#modal'); await p.evaluate(() => { const b = document.querySelector('#modal [data-act=mNickSkip], #modal [data-act=mForget][data-k="-1"], #modal #evo-ok:not([hidden]), #modal [data-act=close]'); if (b) b.click(); }); await W(500); }
  // 回到首页：「怪兽冒险」里的怪兽卡片和今日目击（首页别的部分在 home 那一段）
  await act(p, 'wExit'); await W(800);
  await cjkAt(p, tag + ' 首页的怪兽卡片和今日目击', '#home .mon-card');
  // 一路上弹过的提示：英语界面一句中文都不能有
  await toastCheck(p, tag + ' 冒险');
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
    await cjkAt(p, tag + ' 向导 · ' + name, '#su-box');
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

// ---------- 首页、练习、复习、聊天、委托、设置、学习锁、能力检测、出错的提示（本机小网站 + 假的阿里云） ----------
// 假的原生桥（APK 直连模式走它）：装成阿里云——实时语音、评语、打勾（和 quests.test.js 的一样，不连真的 AI）
const TALK_FAKE = () => {
  const fk = window.__fk = { key: true, wsFail: '', sent: [], items: [], said: [], n: 0, evalMode: 'ok', evalResp: null, stepsResp: [], reply: 'OK! Tell me more.', ins: [], opens: 0 };
  const cb = (id, t, d, ms) => setTimeout(() => window.__echoNative && window.__echoNative(id, t, d), ms || 5);
  const chat = o => ({ choices: [{ message: { content: o } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  window.EchoNative = {
    hasKey: () => !!fk.key, setKey() {}, setOrientation() {},
    wsOpen(id) { fk.opens++; if (fk.wsFail) return cb(id, 'error', fk.wsFail, 20); cb(id, 'open', '', 20); },
    wsSend(id, text) {
      const m = JSON.parse(text); fk.sent.push(m.type);
      if (m.type === 'session.update') fk.ins.push(m.session.instructions);
      if (m.type === 'conversation.item.create') fk.items.push(m.item.content[0].text);
      if (m.type === 'input_audio_buffer.commit') {
        const it = 'it' + (++fk.n);
        cb(id, 'message', JSON.stringify({ type: 'input_audio_buffer.committed', item_id: it }));
        cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: it, transcript: fk.said.shift() || 'hello' }));
      }
      if (m.type === 'response.create') {
        const rid = 'r' + (++fk.n), pcm = btoa(String.fromCharCode.apply(null, new Uint8Array(2400)));
        cb(id, 'message', JSON.stringify({ type: 'response.audio.delta', delta: pcm }));
        cb(id, 'message', JSON.stringify({ type: 'response.audio_transcript.delta', delta: fk.reply }));
        cb(id, 'message', JSON.stringify({ type: 'response.done', response: { id: rid, usage: { input_tokens: 100, output_tokens: 50 } } }));
      }
    },
    wsClose() {},
    post(id, url, body) {
      let b = {}; try { b = JSON.parse(body); } catch (e) {}
      const sys = (b.messages && b.messages[0] && b.messages[0].content) || '';
      // 英语界面的评价提示词是英文写的（talk-core 的 evalBodyOther）
      if (/打勾/.test(sys)) return cb(id, 'ok', JSON.stringify(chat(JSON.stringify({ done: fk.stepsResp.map(x => x + 1) }))), 15);
      if (/打分|feedback on a spoken English conversation/.test(sys)) { if (fk.evalMode === 'hang') return; return cb(id, 'ok', JSON.stringify(chat(JSON.stringify(fk.evalResp))), 30); }
      cb(id, 'fail', '{"code":"NotInTest"}');
    },
  };
};
// 假麦克风（和 apk.test.js 一样）：localStorage['__mic'] = tone 每 2.6 秒「说」一句、deny 不让用
function FAKE_MIC() {
  const md = navigator.mediaDevices;
  if (!md) return;
  md.getUserMedia = async () => {
    const m = localStorage.getItem('__mic') || 'tone';
    if (m === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = 0; osc.connect(g); g.connect(dest); osc.start();
    if (m === 'tone') { const burst = () => { const t = ac.currentTime; g.gain.setValueAtTime(0.3, t + 0.05); g.gain.setValueAtTime(0, t + 0.85); }; burst(); setInterval(burst, 2600); }
    return dest.stream;
  };
}
// 剧情进度：开场做完了，各岛的章节也都做完了（进小镇时不再触发剧情，镇上的人都在老地方）
const FLAGS = Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, 's:z1intro': 1, 's:c5intro': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1])));
const T0 = ymd(new Date());
// 复习本里今天到期的三条（课本 7A Unit 1 = 第 13 号）
const REV3 = () => ({ 'word:13:0': { k: 'word', w: 13, i: 0, b: 0, due: '2000-01-01', x: 1 }, 'sent:13:1': { k: 'sent', w: 13, i: 1, b: 2, due: T0, x: 0 }, 'dlg:13:2': { k: 'dlg', w: 13, i: 2, b: 1, due: T0, x: 0 } });
// 测试存档：界面语言英语、发音在线、口语自评、学习锁关着（学习锁那一段另开）、网页版家长密码 1234
const SAVE = o => {
  o = o || {};
  return Object.assign({
    seenIntro: true, micCheck: T0, coins: 120, xp: 30, homeTab: 'mon', player: { gender: 'girl', name: 'Coco' },
    mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0 }], team: ['a'], dex: { emberpup: 'caught' }, balls: 5, potions: 3, bag: {}, badges: {} },
    world: { v: 3, started: true, map: 't0', x: 10, y: 17, dir: 'up', arrive: null, visited: { 0: 1 }, flags: Object.assign({}, FLAGS), daily: {} },
    stars: { '0-0': 3, '0-1': 2 }, book: { at: 0, mix: 0.6, view: 'book', vb: '' }, rev: { v: 1, items: REV3() },
  }, o, { settings: Object.assign({ ui: 'en', tts: 'online', mode: 'self', sfx: false, music: 'off', gfx: '2d', gate: false, pin: '1234' }, o.settings || {}) });
};
const secs = t => ((Date.now() - t) / 1000).toFixed(1) + ' 秒';

async function screens(view, tag, srv) {
  const { chromium } = require('playwright');
  const HOST = 'http://echo.localhost:' + srv.address().port;
  const b = await chromium.launch(Object.assign({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  // 一个页面：外面的网址一律挡掉（在线发音、版本检查），只留本机；用 echo.localhost：talk.js 不去连本机 8787 的中转服务
  async function mk(inits) {
    const ctx = await b.newContext({ viewport: view });
    await ctx.route(u => !/^(http:\/\/echo\.localhost|data:|blob:)/.test(u.toString()), r => r.abort());
    for (const [f, a] of inits) await ctx.addInitScript(f, a);
    const p = await ctx.newPage();
    p.setDefaultTimeout(6000);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    let opened = false;
    // 换存档重新打开（ls：另外要放进 localStorage 的键）
    const boot = async (save, ls) => {
      if (!opened) { await p.goto(HOST + '/index.html?art=proc', { waitUntil: 'domcontentloaded', timeout: 30000 }); opened = true; }
      await p.evaluate(([s, ls]) => { localStorage.clear(); Object.entries(ls || {}).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('echo-island-v1', JSON.stringify(s)); }, [save, ls || null]);
      await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      // talk.js 没加载上（比如正在改、出了错）也照样往下走：聊天那几段自己会失败
      await p.waitForFunction(() => window.EchoGame && document.querySelector('#home') && !document.querySelector('#home').hidden, null, { timeout: 20000 });
      await p.waitForTimeout(250);
      await p.evaluate(() => { if (window.EchoTalk && EchoTalk.cfg) { EchoTalk.cfg.evalWait = 3000; EchoTalk.cfg.httpWait = 3000; } });
      await watchToasts(p);
    };
    return { ctx, p, errs, boot };
  }
  const M = await mk([[TALK_FAKE]]);
  const { p, boot } = M;
  const W = ms => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  const T = s => tag + ' ' + s;
  // 截图前先拿掉提示条（上一个画面弹的提示会挡住题目；提示的字另外查过了）
  const shot = async (name, full) => { await p.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove())); await settle(p); await p.screenshot({ path: shotOf(name, tag), fullPage: !!full && tag === 'port' }); };
  const until = async (f, n, gap) => { for (let i = 0; i < (n || 40); i++) { if (await f()) return true; await W(gap || 100); } return false; };
  const pin = async ds => { for (const d of ds) await tap(p, '#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(300); };
  // 一块地方的字（有中文时顺便记下在哪几个元素上）
  const grab = async sel => { const txt = await seen(p, sel); return { txt, where: runsOf(txt).some(r => !OK_RUNS.includes(r)) ? await cjkEls(p, sel) : [] }; };

  // 做当前这道题（全答对）：选择题点对的、排句子按顺序点、开口题录一下音再自评「说得好」、Boss 题点对的再自评；返回自评那一块的字
  async function answer(onSelf) {
    const q = await E(() => { const P = EchoGame.P(), q = P && P.q; return q && !P.answered ? { type: q.type, c: q.opts ? q.opts.findIndex(o => o.c) : -1, n: q.tokens ? q.tokens.length : 0 } : null; });
    if (!q) return null;
    let self = null;
    if (/^(lw|ls|lm|lr)$/.test(q.type)) await tap(p, '#p-body .opt[data-i="' + q.c + '"]');
    else if (q.type === 'lo') await E(n => { for (let k = 0; k < n; k++) document.querySelector('#lo-bank [data-act=tile][data-i="' + k + '"]').click(); document.querySelector('#lo-check').click(); }, q.n);
    else {
      if (q.type === 'bt') await tap(p, '#p-body .opt[data-i="' + q.c + '"]');
      else if (await p.$('#mic')) { await tap(p, '#mic'); await until(() => p.$('#mic.on'), 30, 80); await W(250); await tap(p, '#mic'); }
      for (let i = 0; i < 40; i++) {
        if (await tap(p, '#self:not([hidden]) [data-act=selfReveal]')) { await W(120); continue; }
        if (await p.$('#self:not([hidden]) [data-act=rate]')) break;
        await W(100);
      }
      self = await grab('#p-body');
      if (onSelf) await onSelf();
      await tap(p, '#self [data-act=rate][data-v="2"]');
    }
    await p.waitForSelector('#fb.show', { timeout: 4000 }).catch(() => {});
    return self;
  }
  // 一题一题做到结算页：每种题（题型 + 撤提示的格数 + 英语界面换的出法）的字合起来查中文、查放不下；shots：哪种题截图（'*' = 第一题）
  async function playThrough(label, shots) {
    const by = {}, qs = [], over = [], done = new Set();
    const add = (k, g) => { const x = by[k] = by[k] || { txt: [], where: [] }; x.txt.push(g.txt); x.where.push(...g.where); };
    for (let k = 0; k < 30; k++) {
      let st = null;
      for (let i = 0; i < 50 && !st; i++) { st = await E(() => { if (!document.querySelector('#result').hidden) return 'result'; const P = EchoGame.P(); return P && P.q && !P.answered && document.querySelector('#p-body .q-type, #p-body .bubble-row') ? 'q' : null; }); if (!st) await W(100); }
      if (st !== 'q') break;
      await W(150);
      const q = await E(() => { const P = EchoGame.P(), q = P.q, tx = s => (document.querySelector(s) || {}).textContent || ''; return { type: q.type, ear: !!q.ear, cue: P.cue, fade: P.fade, title: tx('#p-body .q-title'), label: tx('#p-body .q-type'), mean: document.querySelector('#p-body .say-zh') ? tx('#p-body .say-zh') : null }; });
      // 题的种类：题型 + 撤提示的格数（英语界面换成看图 pic / 先听一遍 hear）+ 选听到的英文（ear）
      const key = q.type + (q.fade ? '·格' + q.fade + (q.cue && q.cue !== 'mean' ? '·' + q.cue : '') : '') + (q.ear ? '·选听到的' : '');
      qs.push(Object.assign({ key }, q));
      add(key, await grab('#play'));
      const o = await overflow(p, '#play'); if (o.length) over.push(key + '：' + o.join('，'));
      const sn = shots[key] || (!k && shots['*']);
      if (sn && !done.has(sn)) { done.add(sn); await shot(label + '-' + sn); }
      const self = await answer(!done.has('self') && shots.self ? async () => { done.add('self'); await shot(label + '-self'); } : null);
      if (self) add(key, self);
      add(key, await grab('#fb'));
      if (shots.fb && !done.has('fb')) { done.add('fb'); await shot(label + '-fb'); }
      await tap(p, '#fb-btn'); await W(250);
    }
    for (const [k, x] of Object.entries(by)) cjkCheck(T(label + ' · ' + k), x.txt.join(' | '), [...new Set(x.where)].slice(0, 10));
    check(!over.length, T(label + '：题目和反馈条都放得下（' + qs.length + ' 题）'), over);
    return qs;
  }
  // 结算页（和 1.7 秒后弹的升级、成就）
  async function result(label, name) {
    check(await until(() => p.isVisible('#result'), 30), T(label + '：到了结算页'));
    await W(300);
    await cjkAt(p, T(label + ' · 结算页'), '#result');
    await fitCheck(p, T(label + ' · 结算页'), '#result');
    await shot(name);
    await W(1700);
    if (await p.isVisible('#modal')) {
      await cjkAt(p, T(label + ' · 结算后的弹窗'), '#modal');
      const o = (await overflow(p, '#modal')).filter(x => !/^整页能横着滚/.test(x));   // 整页横着滚是后面结算页的事，上面已经算过
      check(!o.length, T(label + ' · 结算后的弹窗：放得下'), o);
    }
    await E(() => EchoGame.closeModal());
  }
  // 聊天：按住话筒说一句（假的阿里云按顺序「听到」__fk.said 里的话）；steps：这句说完以后打勾的步骤
  const speak = async (text, steps) => {
    await E(([t, s]) => { if (s) window.__fk.stepsResp = s; window.__fk.said.push(t); }, [text, steps || null]);
    const n0 = await E(() => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length);
    await p.locator('#tk-mic').dispatchEvent('pointerdown'); await W(650); await p.locator('#tk-mic').dispatchEvent('pointerup');
    await p.waitForFunction(n => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length > n, n0, { timeout: 4000 }).catch(() => {});
    await W(150);
  };
  const evalOK = (n, praise) => E(([n, praise]) => { window.__fk.evalMode = 'ok'; window.__fk.evalResp = { steps: Array.from({ length: n }, () => true), done: true, stars: 3, praise, tips: [{ said: 'It cool in October', better: 'It is cool in October.', note: 'Don\'t forget "is".' }], memory: ['likes autumn'], concern: false, concernWhy: '' }; }, [n, praise]);
  const chatOpen = () => p.waitForSelector('#tk-mic:not([disabled])', { timeout: 8000 }).then(() => true).catch(() => false);
  const evalOpen = () => p.waitForSelector('.tk-eval', { timeout: 8000 }).then(() => true).catch(() => false);

  const SEC = {
    // ---------- 首页：顶栏、标签、任务栏（能力检测卡片、今日复习、今日任务、宝箱）、三个标签、工具栏、页脚 ----------
    async home() {
      await boot(SAVE({ homeTab: 'mon' }));
      await W(300);
      await cjkAt(p, T('首页 · 顶栏、标签、任务栏、怪兽冒险、页脚'), '#topbar, #tabs, #home-bars, #quests, #mon-home, #home > .foot');
      await fitCheck(p, T('首页 · 怪兽冒险'), '#topbar, #home');
      await shot('home-mon', true);
      await tap(p, '#tabs [data-t=quiz]'); await W(300);
      check(await p.isVisible('#quiz-home .tools'), T('首页 · 闯关练习：有工具栏'));
      await cjkAt(p, T('首页 · 闯关练习（课本单元）和工具栏'), '#tabs, #quiz-home, #home > .foot');
      await fitCheck(p, T('首页 · 闯关练习（课本单元）'), '#home');
      await shot('home-quiz', true);
      await tap(p, '#map [data-act=bookPick]'); await W(250);
      await cjkAt(p, T('选正在学的单元'), '#modal'); await fitCheck(p, T('选正在学的单元'), '#modal');
      await E(() => EchoGame.closeModal());
      await tap(p, '#map [data-act=quizView][data-v=isle]'); await W(300);
      await cjkAt(p, T('首页 · 闯关练习（小岛）'), '#quiz-home');
      await fitCheck(p, T('首页 · 闯关练习（小岛）'), '#home');
      await tap(p, '#map .node.cur'); await W(300);
      await tap(p, '#sheet details.pre summary'); await W(150);
      await cjkAt(p, T('关卡详情（含预习）'), '#modal');
      await fitCheck(p, T('关卡详情'), '#modal');
      await shot('level');
      await E(() => EchoGame.closeModal());
      for (const [a, name, sn] of [['shop', '宠物店', 'shop'], ['ach', '成就', 'ach']]) {
        await act(p, a); await W(250);
        await cjkAt(p, T(name), '#modal'); await fitCheck(p, T(name), '#modal');
        if (tag === 'port' || sn === 'shop') await shot(sn);
        await E(() => EchoGame.closeModal());
      }
      await tap(p, '#tabs [data-t=talk]'); await W(300);
      await cjkAt(p, T('首页 · 和岛民聊天'), '#tabs, #talk-home');
      await fitCheck(p, T('首页 · 和岛民聊天'), '#home');
      await shot('home-chat', true);
      await toastCheck(p, T('首页'));
    },

    // ---------- 闯关练习：首页点开一关，一路做到结算；再出几道撤了提示的题、对话题、Boss 题 ----------
    async practice() {
      await boot(SAVE({ homeTab: 'quiz', book: { at: 0, mix: 0.6, view: 'isle', vb: '' }, stars: { '0-0': 3, '0-1': 3, '0-2': 3, '0-3': 3, '0-4': 3 }, rev: { v: 1, items: {} } }));
      await tap(p, '#map .node.cur'); await W(300);
      const lv = await E(() => { const s = document.querySelector('#sheet [data-act=start]'); return s ? s.dataset.w + '-' + s.dataset.l : ''; });
      check(lv === '0-5', T('练习：从首页点开第 1 岛的「挑战」关（7 种题）'), lv);
      await tap(p, '#sheet [data-act=start]'); await W(500);
      const qs = await playThrough('practice', { 'lw·选听到的': 'ear', 'lm·选听到的': 'ear-sent', lo: 'order', lr: 'dialog', 'sp·格2·pic': 'pic', self: 1, fb: 1 });
      const types = [...new Set(qs.map(q => q.type))].sort().join(',');
      check(types === 'lm,lo,lr,ls,lw,sp,sr_s', T('练习：七种题都做到了（' + types + '）'));
      const ear = qs.filter(q => q.type === 'lw' || q.type === 'lm');
      check(ear.length && ear.every(q => q.ear && q.title === (q.type === 'lw' ? 'Listen and choose the word you hear' : 'Listen and choose the sentence you hear')), T('练习：英语界面的「听音选义 / 听句选意」换成「选你听到的词 / 句子」'), ear.map(q => q.title));
      check(qs.filter(q => q.type === 'sp').every(q => q.mean === null && q.cue === 'pic'), T('练习：看图说英语没有意思那一行（只有图）'), qs.filter(q => q.type === 'sp'));
      await result('practice', 'practice-result');
      // 撤了提示的题（复习本里的格子）、跟读、对话题（看着说 / 凭记忆）、Boss 题
      await E(t0 => { Object.assign(EchoGame.S.rev.items, { 'word:0:2': { k: 'word', w: 0, i: 2, b: 4, due: t0 }, 'sent:0:3': { k: 'sent', w: 0, i: 3, b: 2, due: t0 }, 'sent:0:4': { k: 'sent', w: 0, i: 4, b: 5, due: t0 }, 'dlg:0:2': { k: 'dlg', w: 0, i: 2, b: 4, due: t0 } }); EchoGame.goHome(); EchoGame.playQs([['sr_w', 0, 2], ['sr_s', 0, 3], ['sr_s', 0, 4], ['sr_w', 0, 5], ['sr_d', 0, 1], ['sr_d', 0, 2], ['bt', 0, 0]]); }, T0);
      await W(400);
      const q2 = await playThrough('practice', { 'sr_w·格2·pic': 'mem-pic', 'sr_s·格1·hear': 'mem-hear', sr_d: 'say-reply', bt: 'boss' });
      const at = i => q2[i] || {};
      check(at(0).cue === 'pic' && at(0).fade === 2 && at(0).title === 'Look at the picture and say it in English from memory' && at(0).mean === null, T('练习：单词凭记忆说 → 英语界面看图说（没有意思那一行）'), at(0));
      check(at(1).cue === 'hear' && at(1).fade === 1 && /^Listen once, then use the first letters/.test(at(1).title), T('练习：句子看首字母说 → 英语界面先听一遍、再看首字母说'), at(1));
      check(at(2).cue === 'hear' && at(2).fade === 1 && at(2).mean === null, T('练习：句子凭记忆说 → 英语界面也只撤到首字母（没有意思可看）'), at(2));
      check(at(4).type === 'sr_d' && at(5).fade === 2 && at(6).type === 'bt', T('练习：对话题（看着说、凭记忆说）、Boss 题都出了'), q2.map(q => q.key));
      await result('practice', 'practice-result2');
      await toastCheck(p, T('练习'));
    },

    // ---------- 每日复习：有到期的题 → 复习弹窗 → 做题（含聊天里改过的句子）→ 复习结果 ----------
    async review() {
      const items = Object.assign(REV3(), {
        'word:13:3': { k: 'word', w: 13, i: 3, b: 4, due: T0, x: 0 },
        'free:i usually get up at half past six': { k: 'free', en: 'I usually get up at half past six.', zh: '我通常六点半起床。', said: 'I usually get up at six half.', src: 'chat', c: T0, b: 0, due: T0, x: 0 },
      });
      await boot(SAVE({ homeTab: 'quiz', rev: { v: 1, items } }));
      check(await p.isVisible('#quests .rev-card'), T('复习：首页有「今日复习」卡片'));
      await cjkAt(p, T('首页 · 今日复习卡片'), '#quests .rev-card');
      await tap(p, '#quests .rev-card'); await W(300);
      await cjkAt(p, T('每日复习弹窗'), '#modal');
      await fitCheck(p, T('每日复习弹窗'), '#modal');
      await shot('review');
      await tap(p, '#modal [data-act=startReview]'); await W(500);
      const qs = await playThrough('review', { '*': 'q', 'sr_s·格3·hear': 'fix' });
      // 改正说法那题：.say-zh 那一行是他原来的话（划掉的），没有中文意思那一行
      const fix = qs.find(q => q.fade === 3) || {};
      check(qs.length === 5 && fix.title === 'This can be said better: say the right English' && /six half/.test(fix.mean || '') && !CJK.test(fix.mean || ''), T('复习：5 题都做了；聊天里改过的句子显示原话、不显示中文意思'), qs.map(q => q.key + ' ' + q.title + ' ' + q.mean));
      await result('review', 'review-result');
      await toastCheck(p, T('复习'));
    },

    // ---------- 学习锁：首页卡片、拦住的提示、复习结果页「去和岛民聊天」、没网临时放行、第一次设家长密码 ----------
    async gate() {
      await boot(SAVE({ homeTab: 'mon', settings: { gate: true, pin: '' }, rev: { v: 1, items: { 'word:13:0': { k: 'word', w: 13, i: 0, b: 0, due: '2000-01-01', x: 1 } } } }));
      check(await p.isVisible('.gate-card'), T('学习锁：首页有学习锁卡片'));
      await cjkAt(p, T('学习锁卡片（还要复习、聊天）'), '.gate-card');
      await fitCheck(p, T('学习锁卡片'), '#mon-home');
      await E(() => document.querySelector('.gate-card').scrollIntoView({ block: 'center' })); await W(150);
      await shot('gate');
      await tap(p, '#mon-home .world-go'); await W(400);   // 还没做完：拦住（提示条）
      await E(() => EchoGame.playQs([['lw', 13, 0]], true)); await W(400);
      await answer(); await tap(p, '#fb-btn'); await W(500);
      check(!!(await p.$('#result [data-act=gateTalk]')), T('学习锁：复习做完还差聊天，结果页主按钮是「去和岛民聊天」'));
      await result('gate', 'gate-result');
      await E(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); EchoGame.goHome('mon'); }); await W(300);
      await cjkAt(p, T('学习锁卡片（复习做完、没网临时放行）'), '.gate-card');
      await E(() => { delete navigator.onLine; });
      await E(() => EchoGame.T.settings()); await W(200);
      await tap(p, '#sheet [data-act=setGate][data-m="0"]'); await W(250);
      check(await p.isVisible('#pin-pad'), T('学习锁：网页版第一次关学习锁要先设家长密码（数字键盘）'));
      await cjkAt(p, T('设家长密码'), '#sheet'); await fitCheck(p, T('设家长密码'), '#modal');
      await shot('pin-set');
      await pin('1234'); await cjkAt(p, T('设家长密码 · 再输一遍'), '#sheet');
      await pin('1234');
      check(await E(() => EchoGame.S.settings.gate === false && EchoGame.S.settings.pin === '1234'), T('学习锁：密码设好、学习锁关了'));
      await toastCheck(p, T('学习锁'));
    },

    // ---------- 设置、🔒 家长设置（密码键盘、几个小页面）、周报 ----------
    async settings() {
      await boot(SAVE({ homeTab: 'mon', settings: { gate: true, pin: '1234' } }));
      await E(() => EchoGame.T.settings()); await W(250);
      await cjkAt(p, T('设置'), '#sheet'); await fitCheck(p, T('设置'), '#modal');
      await shot('settings');
      await tap(p, '#set-parent summary'); await W(200);
      await E(() => document.querySelector('#set-parent').scrollIntoView({ block: 'start' })); await W(100);
      await cjkAt(p, T('🔒 家长设置'), '#set-parent'); await fitCheck(p, T('🔒 家长设置'), '#modal');
      await shot('parent');
      await tap(p, '#sheet [data-act=limEdit]'); await W(250);
      check(await p.isVisible('#pin-pad'), T('家长设置：改冒险时间要家长密码（数字键盘）'));
      await cjkAt(p, T('家长密码键盘'), '#sheet'); await fitCheck(p, T('家长密码键盘'), '#modal');
      await shot('pin');
      await pin('0000'); await cjkAt(p, T('家长密码输错'), '#sheet');
      await pin('1234');
      check(!(await p.isVisible('#pin-pad')), T('家长密码输对：打开冒险时间'));
      await cjkAt(p, T('冒险时间'), '#sheet'); await fitCheck(p, T('冒险时间'), '#modal');
      await shot('limit');
      // 刚输过密码、弹窗没关：别的小页面不用再输
      for (const [a, name] of [['pushEdit', '日报推送'], ['verEdit', '检查新版本'], ['errLog', '出错记录'], ['bakRestore', '从备份恢复'], ['plSheet', '设置里的能力检测'], ['talk_privacy', '家长须知（聊天）']]) {
        await act(p, 'setBack'); await W(150);
        await act(p, a); await W(250);
        if (await p.isVisible('#pin-pad')) await pin('1234');
        await cjkAt(p, T(name), '#sheet'); await fitCheck(p, T(name), '#modal');
      }
      await E(d => {
        const S = EchoGame.S, mk = o => Object.assign({ min: 30, learn: 15, play: 10 }, o);
        S.log = {};
        S.log[d[0]] = mk({ play: 60, learn: 5, voiceLines: 6, voiceWords: 30, spkQ: 10, spk1: 8, weekN: 5, weekOk: 4, gateOpen: 1 });
        S.log[d[1]] = mk({ night: 1 });
        S.log[d[2]] = mk({ clockBack: 1 });
        S.log[d[3]] = mk({ gateOff: 1, pinFail: 2 });
        S.log[d[4]] = mk({ passAt: Date.now() - 864e5 * 2, passWhy: 'offline' });
        S.log[d[5]] = mk({ gateEx: 'noai', recall: 7, aiChatIn: 20000, aiChatAudioIn: 15000, aiChatOut: 10000, aiChatAudioOut: 8000, asrSec: 300, aiFail: 3 });
        S.log[d[6]] = mk({ gateOpen: 1, voiceMax: 9 });
        S.talk.log = [{ t: Date.now(), npc: 'lily', sec: 60, turns: [], concern: 1, why: 'sad' }];
        EchoGame.closeModal(); EchoGame.reportSheet();
      }, [6, 5, 4, 3, 2, 1, 0].map(daysAgo));
      await W(300);
      check(await p.isVisible('#sheet .report'), T('周报打开了'));
      await cjkAt(p, T('周报'), '#sheet'); await fitCheck(p, T('周报'), '#modal');
      await shot('report');
      await toastCheck(p, T('设置'));
    },

    // ---------- 能力检测：首页卡片 → 谁在学 → 开始之前 → 第一题 → 暂停 → 「继续」卡片 ----------
    async place() {
      await boot(SAVE({ homeTab: 'mon' }));
      check(await p.isVisible('#place-card'), T('能力检测：首页有卡片（老存档、还没测过）'));
      await cjkAt(p, T('首页 · 能力检测卡片'), '#place-card');
      await tap(p, '#place-card [data-act=plOpen]'); await W(300);
      check(await p.isVisible('#place'), T('能力检测：点卡片打开'));
      await cjkAt(p, T('能力检测 · 谁在学'), '#place'); await fitCheck(p, T('能力检测 · 谁在学'), '#place');
      await shot('place-who');
      await tap(p, '#place [data-act=plWho][data-v=teen]'); await W(100);
      await tap(p, '#place [data-act=plKnow][data-v="1"]'); await W(100);
      await tap(p, '#place [data-act=plWhoNext]'); await W(300);
      await cjkAt(p, T('能力检测 · 开始之前'), '#place'); await fitCheck(p, T('能力检测 · 开始之前'), '#place');
      await shot('place-ready');
      await tap(p, '#place [data-act=plStart]'); await W(700);
      await cjkAt(p, T('能力检测 · 第一题'), '#place'); await fitCheck(p, T('能力检测 · 第一题'), '#place');
      await shot('place-q');
      if (await tap(p, '#place [data-act=plPause]')) { await W(300); await cjkAt(p, T('能力检测 · 暂停'), '#place'); await tap(p, '#place [data-act=plExit]'); await W(400); }
      check(await p.isVisible('#place-card') && !(await p.$('#place')), T('能力检测：暂停退出以后首页是「继续」卡片'));
      await cjkAt(p, T('首页 · 能力检测「继续」卡片'), '#place-card');
      await toastCheck(p, T('能力检测'));
    },

    // ---------- 和岛民聊天：聊天界面（目标卡）、说三句、评语页 ----------
    async chat() {
      await boot(SAVE({ homeTab: 'talk', book: { at: 2, mix: 0.6, view: 'book', vb: '' } }));
      if (!(await tap(p, '#talk-home .tk-card.now'))) await tap(p, '#talk-home .tk-card');
      check(await chatOpen(), T('聊天：从聊天首页点开正在学的单元的角色，话筒能用'));
      await W(200);
      await cjkAt(p, T('聊天界面 · 目标卡'), '#tk-ov .tk-goal');
      await cjkAt(p, T('聊天界面'), '#tk-ov'); await fitCheck(p, T('聊天界面'), '#tk-ov');
      await shot('chat');
      const n = await E(() => document.querySelectorAll('#tk-steps li').length);
      for (const [k, line] of ['It is sunny and warm today.', 'I like the fresh air in autumn.', 'We can fly kites in the park.'].entries()) await speak(line, Array.from({ length: Math.min(n, k + 1) }, (_, i) => i));
      await cjkAt(p, T('聊天界面（说了三句、打了勾）'), '#tk-ov'); await fitCheck(p, T('聊天界面（说了三句）'), '#tk-ov');
      await shot('chat-talk');
      await evalOK(n, 'Great talking with you!');
      await tap(p, '#tk-ov [data-act=talk_end]');
      check(await evalOpen(), T('聊天：点「结束」出评语页'));
      await W(300);
      check(/Great talking with you!/.test(await p.textContent('.tk-eval').catch(() => '')) && /It is cool in October/.test(await p.textContent('.tk-eval').catch(() => '')), T('聊天：评语页有评语和「更好的说法」（假的阿里云回了评价）'));
      await cjkAt(p, T('聊天评语页'), '#tk-ov'); await fitCheck(p, T('聊天评语页'), '#tk-ov');
      await shot('chat-eval');
      await tap(p, '.tk-eval [data-act=talk_close]'); await W(300);
      await toastCheck(p, T('聊天'));
    },

    // ---------- 支线委托：大地图上按 A → 请求 → 用英语帮 TA → 聊天 → 评语页 → 道谢、奖励 ----------
    async quest() {
      await boot(SAVE({ homeTab: 'mon' }));
      await tap(p, '[data-act=wEnter]'); await W(1000);
      const typed = async () => { for (let i = 0; i < 60 && await E(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); i++) await W(60); };
      const A = async () => { await typed(); await E(() => document.querySelector('#world [data-act=wA].ba').click()); await W(220); await typed(); };
      await A();
      check(/Ms Rosa/.test(await p.textContent('#w-dlg .d-name').catch(() => '')), T('委托：按 A，Ms Rosa 说请求'));
      await cjkAt(p, T('委托 · 请求'), '#w-dlg');
      for (let i = 0; i < 8 && await E(() => { const d = EchoWorld._debug().dlg; return !!d && d.i < d.pages.length - 1; }); i++) await A();
      check(!!(await p.$('#w-dlg [data-act=wPick]')), T('委托：最后一页是「用英语帮 TA / 以后再说」'));
      await cjkAt(p, T('委托 · 选项页（委托名、要做什么、奖励）'), '#w-dlg'); await fitCheck(p, T('委托 · 选项页'), '#w-dlg');
      await shot('quest-ask');
      await tap(p, '#w-dlg [data-act=wPick][data-i="0"]');
      check(await chatOpen(), T('委托：打开聊天'));
      await W(200);
      await cjkAt(p, T('委托 · 聊天界面'), '#tk-ov'); await fitCheck(p, T('委托 · 聊天界面'), '#tk-ov');
      for (const [k, line] of ['What is his name?', 'What does he look like?', 'Where is he now?'].entries()) await speak(line, Array.from({ length: k + 1 }, (_, i) => i));
      await evalOK(3, 'You asked very clearly!');
      await tap(p, '#tk-ov [data-act=talk_end]');
      check(await evalOpen(), T('委托：评语页'));
      await W(300);
      check(/You asked very clearly!/.test(await p.textContent('.tk-eval').catch(() => '')), T('委托：评语页有评语（假的阿里云回了评价）'));
      await cjkAt(p, T('委托 · 评语页'), '#tk-ov'); await fitCheck(p, T('委托 · 评语页'), '#tk-ov');
      await shot('quest-eval');
      await tap(p, '.tk-eval [data-act=talk_close]'); await W(500); await typed();
      let reward = false;
      for (let i = 0; i < 6 && await E(() => !!EchoWorld._debug().dlg); i++) {
        await cjkAt(p, T('委托 · 道谢、奖励（第 ' + (i + 1) + ' 页）'), '#w-dlg');
        if (!reward && /^You got/.test(await p.textContent('#w-dlg .d-en').catch(() => ''))) { reward = true; await fitCheck(p, T('委托 · 奖励'), '#w-dlg'); await shot('quest-reward'); }
        await A();
      }
      check(reward && await E(() => EchoGame.S.world.flags['q:q0-cap'] === 3), T('委托：道谢、拿到奖励，记成 3 星'));
      await toastCheck(p, T('委托'));
    },
  };

  for (const s of ['home', 'practice', 'review', 'gate', 'settings', 'place', 'chat', 'quest']) {
    if (!want(s)) continue;
    const t0 = Date.now();
    console.log('—— ' + s + '（' + tag + '）');
    try { await SEC[s](); } catch (e) { check(false, T(s + ' 这一段出错了：' + e.message.split('\n')[0])); await E(() => { EchoGame.closeModal(); if (window.EchoTalk) { EchoTalk.endIfOpen(); EchoTalk.endIfOpen(); } }).catch(() => {}); }
    console.log('   （' + secs(t0) + '）');
  }

  // ---------- 界面语言 = 中文：抽查几处和以前一字不差 ----------
  if (tag === 'port' && want('zh')) {
    const t0 = Date.now();
    console.log('—— zh（' + tag + '）');
    await boot(SAVE({ homeTab: 'mon', settings: { ui: 'zh', gate: true } }));
    const hm = await seen(p, '#tabs, #quests');
    check(/🐲 怪兽冒险/.test(hm) && /📚 闯关练习/.test(hm) && /🗣️ 和岛民聊天/.test(hm) && /今日任务/.test(hm) && /今日复习 3 题/.test(hm), '中文界面：首页的标签、今日任务、今日复习照旧', hm.slice(0, 300));
    check(/已开口说 0\/6 句/.test(await p.textContent('.gate-card').catch(() => '')) && await p.textContent('#home > .foot') === '回声岛 · 七年级英语听说闯关 · 进度只保存在这台设备的浏览器里', '中文界面：学习锁卡片、页脚照旧');
    await E(t0 => { EchoGame.S.rev.items['sent:0:4'] = { k: 'sent', w: 0, i: 4, b: 5, due: t0 }; EchoGame.playQs([['lw', 0, 0], ['sr_s', 0, 4]]); }, T0); await W(400);
    let q = await E(() => ({ title: document.querySelector('.q-title').textContent, opts: [...document.querySelectorAll('#p-body .opt .o-t')].map(e => e.textContent), means: WORLDS[0].words.map(w => w[1]) }));
    check(q.title === '听一听，选出正确的意思' && q.opts.length === 4 && q.opts.every(o => q.means.includes(o)), '中文界面：听音选义还是选中文意思', q.title + ' ' + q.opts.join('/'));
    await answer(); await tap(p, '#fb-btn'); await W(400);
    q = await E(() => ({ title: document.querySelector('.q-title').textContent, type: document.querySelector('.q-type').textContent, mean: (document.querySelector('#p-body .say-zh') || {}).textContent, want: WORLDS[0].sents[4][1] }));
    check(q.title === '看中文，凭记忆用英语说出来' && q.type === '🧠 凭记忆说' && q.mean === q.want, '中文界面：凭记忆说（看中文）照旧', q);
    await E(() => { EchoGame.goHome('mon'); EchoGame.T.settings(); }); await W(200);
    const st = await seen(p, '#sheet');
    check(/^设置/.test(await p.textContent('#sheet h2')) && /🔒 家长设置/.test(st) && /界面语言 · Language/.test(st), '中文界面：设置（标题、🔒 家长设置、语言选择）照旧');
    await E(() => { EchoGame.closeModal(); EchoGame.reportSheet(); }); await W(200);
    check(/学习日 \d\/7/.test(await seen(p, '#sheet')), '中文界面：周报「学习日 n/7」照旧');
    await E(() => { EchoGame.closeModal(); EchoGame.goHome('talk'); }); await W(200);
    check(/用英语和岛民聊天/.test(await seen(p, '#talk-home')), '中文界面：聊天首页照旧');
    console.log('   （' + secs(t0) + '）');
  }
  check(!M.errs.length, T('这些画面没有报错'), M.errs.slice(0, 3));
  await M.ctx.close();

  // ---------- 安装包里出错时的提示（假原生桥 + 假麦克风）：麦克风被永久拒绝、没网 ----------
  if (want('errors')) {
    const t0 = Date.now();
    console.log('—— errors（' + tag + '）');
    const N = await mk([[FN.install, { key: 'sk-fake', net: 'offline', mic: 'blocked', pin: '1234' }], [FAKE_MIC]]);
    const q = N.p, QE = (f, a) => q.evaluate(f, a), QW = ms => q.waitForTimeout(ms);
    const qshot = async name => { await settle(q); await q.screenshot({ path: shotOf(name, tag) }); };
    const qu = async (f, n) => { for (let i = 0; i < (n || 40); i++) { if (await f()) return true; await QW(150); } return false; };
    try {
      await N.boot(SAVE({ homeTab: 'quiz', settings: { mode: 'auto' } }), { __mic: 'deny' });
      await QE(() => EchoGame.playQs([['sr_w', 13, 2]])); await QW(900);   // 出题 0.38 秒后会自动念一遍：等它念上再点话筒
      await tap(q, '#mic');
      check(await qu(() => q.$('#sheet [data-act=micFix]')), T('出错：麦克风被永久拒绝，弹窗说明 +「去打开」'));
      await cjkAt(q, T('麦克风被拒的弹窗'), '#sheet'); await fitCheck(q, T('麦克风被拒的弹窗'), '#modal');
      await qshot('err-mic');
      await tap(q, '#sheet [data-act=micFix]'); await QW(300);
      await QE(() => { window.__fakeNative.mic = 'granted'; localStorage.setItem('__mic', 'tone'); EchoGame.closeModal(); EchoGame.goHome('quiz'); EchoGame.playQs([['sr_w', 13, 3]]); }); await QW(900);
      const h0 = await q.textContent('#mic-hint');
      await tap(q, '#mic');
      check(await qu(() => QE(h0 => !document.querySelector('#mic.on') && (document.querySelector('#mic-hint') || {}).textContent !== h0, h0), 80), T('出错：没网，话筒下面说原因'), await q.textContent('#mic-hint').catch(() => ''));
      await cjkAt(q, T('没网：话筒下面的提示'), '#play');
      await tap(q, '#mic');
      check(await qu(() => q.isVisible('#p-skip'), 80), T('出错：没网连着两次，出现「先跳过」'));
      await cjkAt(q, T('没网：「先跳过」'), '#play'); await fitCheck(q, T('没网：「先跳过」'), '#play');
      await qshot('err-net');
      await tap(q, '#p-skip'); await QW(300);
      await cjkAt(q, T('没网：先跳过以后的反馈'), '#play');
      await QE(() => EchoGame.goHome('quiz')); await QW(300);
      check(await q.isVisible('#home-bars .ai-bar'), T('出错：首页挂红条'));
      await cjkAt(q, T('首页红条'), '#home-bars'); await fitCheck(q, T('首页红条'), '#home');
      await tap(q, '#home-bars .ai-bar'); await QW(250);
      await cjkAt(q, T('红条的说明'), '#sheet'); await fitCheck(q, T('红条的说明'), '#modal');
      await qshot('err-bar');
      await QE(() => { EchoGame.closeModal(); EchoTalk.open('kai'); });
      await qu(() => QE(() => { const s = document.querySelector('#tk-status'); return !!s && !/…|\.\.\./.test(s.textContent); }), 40);
      await QW(300);
      await cjkAt(q, T('聊天连不上（没网）'), '#tk-ov'); await fitCheck(q, T('聊天连不上（没网）'), '#tk-ov');
      await qshot('err-chat');
      await QE(() => { EchoTalk.endIfOpen(); EchoTalk.endIfOpen(); });
      await toastCheck(q, T('出错的提示'));
    } catch (e) { check(false, T('errors 这一段出错了：' + e.message.split('\n')[0])); }
    check(!N.errs.length, T('出错的提示：页面没有报错'), N.errs.slice(0, 3));
    await N.ctx.close();
    console.log('   （' + secs(t0) + '）');
  }
  await b.close();
}

// 画面风格（新画风试用，2026-11-19 老板要在 iPhone 上试，App 里加不了 ?look=new）：设置里「Look: Classic / New (preview)」只在 3D 时出现，
// 默认经典；在户外点一下就当场换渲染器（EchoWorld._debug().R.using()：新画风 'open'；经典是老的 world3d.js，没有 using，记作 'std'），
// localStorage['echo-look'] 跟着写上 / 删掉。要画得出 3D：和 look.test.js 一样用 SwiftShader。只跑竖屏
async function lookSetting(srv) {
  const { chromium } = require('playwright');
  const b = await chromium.launch(Object.assign({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(u => !/^(http:\/\/echo\.localhost|data:|blob:)/.test(u.toString()), r => r.abort());
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto('http://echo.localhost:' + srv.address().port + '/index.html?art=proc', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await E(s => { localStorage.clear(); localStorage.setItem('echo-island-v1', JSON.stringify(s)); }, SAVE({ settings: { gfx: 'low' } }));
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden, null, { timeout: 20000 });
  // 现在大地图是谁在画：'open' 新画风 / 'std' 老的 3D / '2d'
  const using = () => E(() => { const d = EchoWorld._debug(), R = d.R; return { map: d.M ? d.M.id : '', who: !R ? '' : R.kind === '2d' ? '2d' : R.using ? R.using() : 'std', ls: localStorage.getItem('echo-look') }; });
  const row = () => E(() => { const r = document.querySelector('#sheet #set-look'); return r ? { on: (r.querySelector('button.on') || {}).dataset.m, txt: r.innerText } : null; });
  await E(() => EchoGame.T.settings()); await W(250);
  const r0 = await row();
  check(!!r0 && r0.on === 'std' && /Look/.test(r0.txt) && /Classic/.test(r0.txt) && /New \(preview\)/.test(r0.txt), 'look · 设置里有「Look: Classic / New (preview)」，默认经典', r0);
  if (r0) cjkCheck('look · 画面风格那一行', r0.txt);
  await E(() => EchoGame.closeModal());
  await p.click('[data-act=wEnter]');
  for (let i = 0; i < 40 && !(await using()).who; i++) await W(150);
  await W(600);
  const u0 = await using();
  check(u0.map === 't0' && u0.who === 'std' && u0.ls == null, 'look · 默认：户外是老的 3D 渲染器', u0);
  // 在大地图上打开设置，换成新画风：当场换渲染器
  await E(() => EchoGame.T.settings()); await W(250);
  await p.click('#sheet [data-act=setLook][data-m=new]');
  for (let i = 0; i < 40 && (await using()).who !== 'open'; i++) await W(150);
  const u1 = await using(), r1 = await row();
  check(u1.map === 't0' && u1.who === 'open' && u1.ls === 'new' && !!r1 && r1.on === 'new', 'look · 换成新画风：户外当场换成新渲染器（using() = open），localStorage 写上 new', { u1, r1 });
  await p.click('#sheet [data-act=setLook][data-m=std]');
  for (let i = 0; i < 40 && (await using()).who !== 'std'; i++) await W(150);
  const u2 = await using();
  check(u2.map === 't0' && u2.who === 'std' && u2.ls == null, 'look · 换回经典：又是老的 3D（using() = std），localStorage 的键删掉了', u2);
  // 2D 流畅模式：没有这一行
  await p.click('#sheet [data-act=setGfx][data-m="2d"]'); await W(400);
  check(!(await row()), 'look · 2D 流畅模式时设置里没有「画面风格」这一行');
  check(!errs.length, 'look · 没有报错', errs.slice(0, 3));
  await b.close();
}

// 竖屏、横屏的 screens() 同时跑（各开一个浏览器，省一半时间）：各自的输出先攒着，跑完一整块打出来，不搅在一起
const { AsyncLocalStorage } = require('async_hooks');
const LOGS = new AsyncLocalStorage(), log0 = console.log;
console.log = (...a) => { const buf = LOGS.getStore(); if (buf) buf.push(require('util').format(...a)); else log0(...a); };
const buffered = f => LOGS.run([], async () => { const buf = LOGS.getStore(); try { await f(); } finally { log0(buf.join('\n')); } });

(async () => {
  const t0 = Date.now();
  const views = [[{ width: 390, height: 844 }, 'port'], [{ width: 844, height: 390 }, 'land']].filter(([, t]) => !VIEW || t === VIEW);
  const srv = ['home', 'practice', 'review', 'chat', 'quest', 'settings', 'gate', 'errors', 'place', 'zh', 'look'].some(want) ? await serve() : null;
  for (const [view, tag] of views) {
    if (want('adventure')) { const t1 = Date.now(); console.log('—— 冒险（' + tag + '）'); await adventure(view, tag); console.log('   （' + secs(t1) + '）'); }
    if (want('wizard')) { const t1 = Date.now(); console.log('—— 销售版向导（' + tag + '）'); await wizard(view, tag); console.log('   （' + secs(t1) + '）'); }
  }
  if (srv) {
    const t1 = Date.now();
    if (['home', 'practice', 'review', 'chat', 'quest', 'settings', 'gate', 'errors', 'place', 'zh'].some(want)) {
      await Promise.all(views.map(([view, tag]) => (views.length > 1 ? buffered(() => screens(view, tag, srv)) : screens(view, tag, srv))));
      console.log('—— 首页到出错提示这几段（' + views.map(v => v[1]).join(' + ') + ' 同时跑）：' + secs(t1));
    }
    if (want('look')) { const t2 = Date.now(); console.log('—— 画面风格（新画风试用）'); await lookSetting(srv); console.log('   （' + secs(t2) + '）'); }
    srv.close();
  }
  console.log('浏览器部分用时 ' + secs(t0));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails || process.exitCode ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
