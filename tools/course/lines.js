// 收集游戏里写死的英语台词 → tools/course/lines-src.json（给翻译台词表的人用，格式见 tools/course/SPEC.md §8）
//   node tools/course/lines.js            生成 lines-src.json，打印统计
//   node tools/course/lines.js --check    只检查（和现有的 lines-src.json 比，不一样就退出码 1）
//   node tools/course/lines.js --raw      调试：打印找到的每个模板和它的拼接表达式（--raw --all 连整句一起）
//   node tools/course/lines.js --dropped  调试：源码里像英语、但没认成台词的字符串（漏收了就看这里）
//   node tools/course/lines.js --misses   列出配音名单（tools/voice/lines.json）里有、这里没收到的句子
//
// 收什么：课程内容以外、英语课里显示或朗读的固定英语——剧情对话、告示牌 / 石碑、说话任务和选回答的题、对战的喊话、
//   回声技能的指令、拿到 / 捡到道具、选伙伴、收服、唤醒、孵蛋……
//   来源：story.js、world.js、monsters.js、game.js、isles/*.js（和 tools/voice/collect.js 一样的那几份），
//   dex.js 的手册介绍（dexEn），monsters.js / dex.js 的名字（怪兽、招式、道具）当「词」（terms）。
// 不收：课程内容（data.js 的 WORLDS / SCENES、book.js、能力检测题库）、别的课里关掉的功能（quests.js 支线委托、sighting.js 今日目击、talk-npcs.js 聊天）、
//   界面文字（i18n 字表里的，走 EchoI18n 翻译界面语言，不是要学的）。
//
// 怎么找：把源文件切成记号（不靠正则硬猜），看每一组括号 ( ) [ ] { } 里逗号分开的每一项：
//   · 「英语, 中文」挨着的两项（函数参数、数组）：一句台词和它的中文意思；函数名是说话的人（prof / mom / nar…）
//   · 对象里的 en / zh：对话框的一页（kind / target / who / g 一起看）；target 是要开口说的；say / speak 是要念的句子
//   · say(…) / E.say(…)：只朗读的句子（对战喊话等）
//   · 一项是「字符串 + 变量 + 字符串」拼的：模板（templates），变量按 SLOTS 认成怪兽名 / 招式名 / 道具名 / 地名……
//     认不出来的变量算 free（翻译的人照样翻，生成课程时展不开，游戏里对不上就按 ENGINE.md §5 的过渡办法）
// 输出按 id 排好、不写时间：同一份源文件生成的文件逐字节一样
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'lines-src.json');
const CJK = /[㐀-鿿豈-﫿]/;

// ======================================================================
//  1. 记号
// ======================================================================
const P3 = ['>>>=', '===', '!==', '**=', '<<=', '>>=', '>>>', '...', '&&=', '||=', '??='];
const P2 = ['=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
function tokenize(src) {
  const T = [];
  let i = 0;
  const n = src.length;
  const isId = c => /[A-Za-z0-9_$]/.test(c);
  // 「/」是除号还是正则：看前一个记号
  const regexOk = () => {
    const p = T[T.length - 1];
    if (!p) return true;
    if (p.t === 'id') return /^(return|typeof|case|in|of|new|delete|void|throw|else|do)$/.test(p.v);
    if (p.t === 'num' || p.t === 'str' || p.t === 'tpl' || p.t === 're') return false;
    return !/^[)\]}]$/.test(p.v);
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, v = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          const d = src[j + 1];
          if (d === 'n') v += '\n'; else if (d === 't') v += '\t';
          else if (d === 'u') { v += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 4; }
          else if (d === 'x') { v += String.fromCharCode(parseInt(src.substr(j + 2, 2), 16)); j += 2; }
          else v += d;
          j += 2;
        } else v += src[j++];
      }
      T.push({ t: 'str', v, s: i, e: j + 1 });
      i = j + 1; continue;
    }
    if (c === '`') {   // 模板字符串：整个当一个记号（这几份文件里没有台词写在里面）
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (depth === 0 && src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '}') { depth--; j++; continue; }
        j++;
      }
      T.push({ t: 'tpl', v: src.slice(i + 1, j), s: i, e: j + 1 });
      i = j + 1; continue;
    }
    if (c === '/' && regexOk()) {
      let j = i + 1, cls = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') cls = true; else if (d === ']') cls = false; else if ((d === '/' && !cls) || d === '\n') break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(src[j])) j++;
      T.push({ t: 're', v: src.slice(i, j), s: i, e: j });
      i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i; while (j < n && /[0-9A-Za-z._]/.test(src[j])) j++;
      T.push({ t: 'num', v: src.slice(i, j), s: i, e: j }); i = j; continue;
    }
    if (isId(c)) { let j = i; while (j < n && isId(src[j])) j++; T.push({ t: 'id', v: src.slice(i, j), s: i, e: j }); i = j; continue; }
    const p = P3.find(x => src.startsWith(x, i)) || P2.find(x => src.startsWith(x, i)) || c;
    T.push({ t: 'p', v: p, s: i, e: i + p.length }); i += p.length;
  }
  // 括号配对：开括号记下 close，每个记号记下外层的开括号 up
  const st = [];
  T.forEach((k, idx) => {
    k.up = st.length ? st[st.length - 1] : -1;
    if (k.t === 'p' && (k.v === '(' || k.v === '[' || k.v === '{')) st.push(idx);
    else if (k.t === 'p' && (k.v === ')' || k.v === ']' || k.v === '}')) {
      const o = st.pop();
      if (o != null) { T[o].close = idx; k.open = o; }
      k.up = st.length ? st[st.length - 1] : -1;
    }
  });
  return T;
}

// ======================================================================
//  2. 一组括号里的各项、一项的值
// ======================================================================
const isP = (k, v) => k && k.t === 'p' && k.v === v;
// [a, b) 里第 0 层按 sep 切开（跳过括号里面的）
function splitTop(T, a, b, seps) {
  const out = [];
  let s = a;
  for (let i = a; i < b; i++) {
    const k = T[i];
    if (k.t === 'p' && (k.v === '(' || k.v === '[' || k.v === '{') && k.close != null) { i = k.close; continue; }
    if (k.t === 'p' && seps.includes(k.v)) { out.push([s, i, k.v]); s = i + 1; }
  }
  out.push([s, b, null]);
  return out.filter(([x, y]) => y > x);
}
// 一项的值 → 几个分支（三元 ?: 、|| 的每一边），每个分支是「字符串 + 表达式 + …」拼起来的几块。
// 不是字符串拼的（函数调用、数字……）那个分支给 null
function parseValue(T, src, a, b) {
  // 箭头函数 n => 'x' + n：值是箭头后面那段，记下参数
  let params = null;
  const arrow = splitTop(T, a, b, ['=>']);
  if (arrow.length === 2) {
    const ps = T.slice(arrow[0][0], arrow[0][1]).filter(k => k.t === 'id').map(k => k.v);
    params = ps; a = arrow[1][0];
    if (isP(T[a], '{')) return null;   // 函数体是一段代码，不是一个值
  }
  // 三元：c ? x : y（可以连着写）；|| ?? 也当成分支（x || '默认的那句'）
  let ranges = [[a, b]];
  const q = splitTop(T, a, b, ['?']);
  if (q.length > 1) {
    ranges = [];
    const rest = splitTop(T, q[0][1] + 1, b, [':']);
    // 只拆最外面一层：后面的分支里可能还有 ?:（递归拆）
    rest.forEach(([x, y]) => ranges.push([x, y]));
  }
  const branches = [];
  for (const [x, y] of ranges) {
    const qq = splitTop(T, x, y, ['?']);
    if (qq.length > 1) { const sub = parseValue(T, src, x, y); if (sub) branches.push(...sub.branches); else branches.push(null); continue; }
    const ors = splitTop(T, x, y, ['||', '??']);
    for (const [u, v] of ors.length > 1 ? ors : [[x, y]]) branches.push(...pieces(T, src, u, v));
  }
  return { params, branches };
}
// 一个分支按第 0 层的 + 切成几块：字符串 { s }，别的 { x: 源码 }。
// 中间一块是「(条件 ? '甲' : '乙')」两个字符串的：拆成两个分支（(slp ? 'Wake up, ' : 'Warm up, ') + 名字 → 两句）；冠词 a / an 那种不拆（ARTICLE）
function pieces(T, src, a, b) {
  const ps = splitTop(T, a, b, ['+']);
  if (!ps.length) return [null];
  let outs = [[]];
  for (const [x, y] of ps) {
    if (y - x === 1 && T[x].t === 'str') { outs.forEach(o => o.push({ s: T[x].v })); continue; }
    // 外面多套一层括号的字符串：('a ')
    if (isP(T[x], '(') && T[x].close === y - 1 && y - x === 3 && T[x + 1].t === 'str') { outs.forEach(o => o.push({ s: T[x + 1].v })); continue; }
    const xs = src.slice(T[x].s, T[y - 1].e).replace(/\s+/g, ' ');
    if (isP(T[x], '(') && T[x].close === y - 1 && !ARTICLE.test(xs)) {
      const q = splitTop(T, x + 1, y - 1, ['?']);
      const alts = q.length === 2 ? splitTop(T, q[1][0], y - 1, [':']) : [];
      if (alts.length === 2 && alts.every(([u, v]) => v - u === 1 && T[u].t === 'str')) {
        outs = outs.flatMap(o => alts.map(([u]) => o.concat([{ s: T[u].v }])));
        continue;
      }
    }
    outs.forEach(o => o.push({ x: xs }));
  }
  return outs.map(o => (o.some(p => p.s != null) ? o : null));
}
const branchText = br => (br ? br.map(p => (p.s != null ? p.s : '\u0000')).join('') : '');
const isEnglish = br => {
  if (!br) return false;
  const lits = br.filter(p => p.s != null).map(p => p.s).join('');
  // 不是语言的字符串：颜色（#ab47bc）、键名 / id（a.b、snake_case、c:1）、HTML
  if (/^\s*#[0-9a-fA-F]{3,8}\s*$/.test(lits) || /^\s*[a-z0-9]+([_:-][a-z0-9]+)+\s*$/.test(lits)) return false;
  return !CJK.test(lits) && /[A-Za-z]{2,}/.test(lits) && !/[<>]|^\s*[a-z]+(\.[a-zA-Z0-9]+)+\s*$/.test(lits);
};
const isChinese = br => !!br && br.some(p => p.s != null && CJK.test(p.s));

// ======================================================================
//  3. 模板里的变量 → 哪一类词（terms）
// ======================================================================
// [文件（正则）, 表达式（正则，整段对上）, 变量名, 词的类别]。英文那半和中文那半同一个变量写的不一样（sp.en / sp.zh）也认成同一个
// 类别：monster 怪兽（手册里的名字，或者起的昵称）、move 招式、item 道具、place 地名、skill 回声技能、crystal 水晶、num 数字、
//   free（这一段剧情自己的一小撮词：翻译的人看 expr 知道是什么，生成课程时展不开）
//   type 属性（选伙伴时说的 fire / water / grass / electric）、name 人名（照原样，不翻译）、content 课程内容本身（已经是这门语言，照原样）、
//   num 数字（照原样）
const SLOTS = [
  [/story\.js/, /^n$/, 'n', 'num'],   // 雕像亮了几座（要排在通用的 n = 怪兽前面）
  [/./, /^(sp|sf|from|old|s|SPECIES\[id\]|SPECIES\[[a-z.]+\])\.(en|zh)$|^MG\.species\([^()]*\)\.(en|zh)$|^nm\(.*\)$|^n$|^name$|^nickCtx\.name$/, 'mon', 'monster'],
  [/monsters\.js/, /^n\.(en|zh)$/, 'mon', 'monster'],
  [/./, /^to\.(en|zh)$/, 'mon2', 'monster'],
  [/./, /^(nm|mv)\[0\]$|^mvName\(.*\)\[0\]$/, 'move', 'move'],
  [/./, /^\(?it \? it\.(en|zh) : n\.give\.item\)?$|^it\.(en|zh)$/, 'item', 'item'],
  [/./, /^S\.(en|zh)$/, 'skill', 'skill'],
  [/./, /^ch\.(crystal|zh)$/, 'crystal', 'crystal'],
  [/world\.js/, /^town$|^w\.name$/, 'place', 'place'],
  [/world\.js/, /^next$|^\(?nx \? nx\.name : ''\)?$/, 'place2', 'place'],
  [/world\.js/, /^p\.en$/, 'place', 'place'],
  [/world\.js/, /^\(M\.z \+ 1\)$|^g\.unitN$/, 'n', 'num'],
  [/world\.js/, /^it\[[01]\]$/, 'text', 'content'],
  [/world\.js/, /^t\.name$/, 'who', 'name'],
  [/story\.js/, /^w\.en\.replace\(.*\)$/, 'text', 'content'],   // E.W[z].en：别的课里是课程的岛名（已经是那门语言）
  [/story\.js/, /^TYPE_EN\[sp\.type\]$/, 'type', 'type'],
  [/story\.js/, /^who$/, 'who', 'name'],
];
// 英语的冠词：'a ' / 'an ' 跟着后面那个词变（模板里写成 a，带 an: true）
const ARTICLE = /^\(?\/\^\[aeiou\]\/i\.test\(it\.en\) \? '(an |An )' : '(a |A )'\)?$/;
function slotOf(file, x) {
  for (const [f, re, name, type] of SLOTS) if (f.test(file) && re.test(x)) return { name, type };
  return null;
}

// ======================================================================
//  4. 扫一份源文件
// ======================================================================
// 只是界面文字 / 键名的函数：参数里的字符串不是台词
const NOT_CONTENT_CALLS = /^(tx|hx|tr|trh|t|h|I18N\.t|I18N\.h|EchoI18n\.t|EchoI18n\.h|learnL|learnLine|E\.learnLine|lbl|label|L|toast|E\.toast|C\.E\.toast|C\.note|note|flag|C\.flag|C\.set|set|\$|\$\$|querySelector|getElementById|addEventListener|fetch|matchMedia|log|console\.log|music|E\.music|jingle|E\.jingle)$/;
const SAY_CALLS = /^(say|E\.say|C\.E\.say|api\.say)$/;
const PAGE_KEYS = ['who', 'kind', 'emo', 'look', 'target', 'onShow', 'pass', 'fail', 'g', 'opts', 'hideEn', 'zhKeep', 'ui', 'pic', 'cap', 'lkey', 'html', 'mount', 'pick'];
const KIND_RANK = { speak: 6, ask: 5, opt: 4, sign: 3, say: 2, ui: 1 };

function lineNo(src, pos) { let n = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++; return n; }
// 一个开括号前面的函数名（a.b.c( → 'a.b.c'）
function calleeOf(T, o) {
  let i = o - 1, parts = [];
  while (i >= 0 && T[i].t === 'id') { parts.unshift(T[i].v); if (isP(T[i - 1], '.')) i -= 2; else break; }
  return parts.join('.');
}
// 对象里的 key: value
function objProps(T, src, o) {
  const props = {};
  for (const [x, y] of splitTop(T, o + 1, T[o].close, [','])) {
    if ((T[x].t === 'id' || T[x].t === 'str') && isP(T[x + 1], ':')) props[T[x].v] = [x + 2, y];
  }
  return props;
}
const litOf = (T, r) => (r && r[1] - r[0] === 1 && T[r[0]].t === 'str' ? T[r[0]].v : null);
const srcOf = (T, src, r) => (r ? src.slice(T[r[0]].s, T[r[1] - 1].e).replace(/\s+/g, ' ') : '');

// 说话的人：helper 函数（const prof = (en, zh, x) => ({ who: 'Professor Echo', … })、L.sayer('Kai', …)）→ 名字
const LIB_WHO = { prof: 'Professor Echo', mom: 'Mom', nar: 'Narrator', me: '{name}', speak: '{name}', orionS: 'Orion' };
function helpers(T, src) {
  const H = [];   // { name, i（声明的位置）, scope: [开, 关], who }
  T.forEach((k, i) => {
    if (!(k.t === 'id' && T[i + 1] && isP(T[i + 1], '=') && T[i - 1] && (T[i - 1].t === 'id' && /^(const|let|var)$/.test(T[i - 1].v) || isP(T[i - 1], ',')))) return;
    // 值的范围：到同一层的 , 或 ;
    let j = i + 2;
    for (; j < T.length; j++) {
      const t = T[j];
      if (t.t === 'p' && (t.v === '(' || t.v === '[' || t.v === '{') && t.close != null) { j = t.close; continue; }
      if (t.t === 'p' && (t.v === ',' || t.v === ';' || t.v === ')' || t.v === '}' || t.v === ']')) break;
    }
    const body = src.slice(T[i + 2].s, T[j - 1] ? T[j - 1].e : T[i + 2].e);
    let who = null, m;
    if ((m = /^(?:L\.|ST\.lib\.)?sayer\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^,()]+)/.exec(body))) who = /^['"]/.test(m[1]) ? m[1].slice(1, -1).replace(/\\(.)/g, '$1') : m[1].trim();
    else if ((m = /^\([^)]*\)\s*=>[\s\S]*?\bwho:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^,}]+)/.exec(body))) who = /^['"]/.test(m[1]) ? m[1].slice(1, -1) : m[1].trim();
    else if ((m = /^(?:L\.)?(prof|mom|nar|me|speak)$/.exec(body))) who = LIB_WHO[m[1]];
    else if ((m = /^\([^)]*\)\s*=>\s*(?:L\.)?([A-Za-z_$][\w$]*)\(en, zh/.exec(body))) who = { alias: m[1] };
    if (who == null) return;
    if (/^tx\('[a-z.]+'\)$|^NAR\(\)$|^I18N/.test(String(who))) who = /sign/.test(who) ? 'Sign' : 'Narrator';
    const sc = k.up >= 0 ? [k.up, T[k.up].close] : [-1, T.length];
    H.push({ name: k.v, i, scope: sc, who });
  });
  return H;
}
function whoAt(H, name, i, depth) {
  let best = null;
  for (const h of H) if (h.name === name && h.scope[0] < i && i < h.scope[1] && (!best || h.scope[0] > best.scope[0] || (h.scope[0] === best.scope[0] && h.i < i && h.i > best.i))) best = h;
  if (!best) return LIB_WHO[name] || null;
  if (best.who && best.who.alias) return (depth || 0) > 4 ? null : whoAt(H, best.who.alias, best.i, (depth || 0) + 1);
  return best.who;
}
const tidyWho = w => {
  if (w == null) return null;
  w = String(w);
  if (/^tx\('w\.who\.sign'\)$/.test(w)) return 'Sign';
  if (/^tx\('[a-z]+\.who\.nar'\)$|^NAR\(\)$/.test(w)) return 'Narrator';
  const m = /^tx\('([a-z]+)\.who\.([a-z]+)'\)$/.exec(w);
  if (m) return m[2][0].toUpperCase() + m[2].slice(1);
  if (/^R\.name$|rival/i.test(w)) return '{rival}';
  const lit = /^\[\s*'([^']+)'/.exec(w);   // ['Baker Bun', 'chef', 'm']
  if (lit) return lit[1];
  if (/[.[(+]|^[a-z]/.test(w)) return null;   // 剧情里现取的名字（v.name、info.name……）：看不出是谁
  return w;
};

const found = [];   // 每一处：{ file, line, br（英语分支）, zh（中文分支或 null）, kind, who, g, params }
function scan(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const T = tokenize(src);
  const H = helpers(T, src);
  // 不看的范围：界面字表 I18N.add(…)、取字的 tx(…) 这种、地图定义里的地名（rows 那一层的 en / name / sub）
  const skip = new Uint8Array(T.length);
  const skipRange = (a, b) => { for (let j = a; j <= b; j++) skip[j] = 1; };
  T.forEach((k, i) => {
    if (!(k.t === 'p' && k.v === '(' && k.close != null)) return;
    const c = calleeOf(T, i);
    if (/(^|\.)add$/.test(c) && /I18N|EchoI18n/.test(c)) skipRange(i, k.close);
    else if (NOT_CONTENT_CALLS.test(c)) skipRange(i, k.close);
  });
  const add = (r, o) => found.push(Object.assign({ file, line: lineNo(src, T[r[0]].s) }, o));
  const val = r => parseValue(T, src, r[0], r[1]);
  // 一项里英语的分支、中文的分支（拆了三元）
  const engOf = v => (v ? v.branches.filter(isEnglish) : []);
  const zhOf = v => (v ? v.branches.filter(isChinese) : []);
  // 英语分支和中文分支对上：个数一样按位置配，中文只有一个就都配它
  const pairUp = (en, zh) => en.map((b, k) => ({ br: b, zh: zh.length === en.length ? zh[k] : zh.length === 1 ? zh[0] : null }));

  for (let o = 0; o < T.length; o++) {
    const k = T[o];
    if (skip[o] || k.t !== 'p' || k.close == null) continue;
    if (k.v === '{') {
      const pr = objProps(T, src, o);
      // 地图定义（有 rows）：en / name 是地名，不是台词（地名另外从 EchoMaps 拿）
      const isMap = 'rows' in pr;
      const page = PAGE_KEYS.some(x => x in pr);
      const kind = litOf(T, pr.kind);
      const who = pr.who ? tidyWho(litOf(T, pr.who) != null ? litOf(T, pr.who) : srcOf(T, src, pr.who)) : null;
      const emo = litOf(T, pr.emo), g = litOf(T, pr.g);
      if (pr.en && !isMap && !('price' in pr) && !skip[pr.en[0]]) {
        const v = val(pr.en), zv = pr.zh ? val(pr.zh) : null;
        const en = engOf(v);
        // 不是对话框的一页、也不像一句话的（道具名、技能名、属性名……）：不算台词
        const sentence = b => /[.!?…"')]\s*$/.test(branchText(b)) || /\s\S+\s/.test(branchText(b).trim());
        for (const p of pairUp(en, zhOf(zv))) {
          if (!page && !sentence(p.br)) continue;
          const tgt = pr.target ? srcOf(T, src, pr.target) : null;
          const kd = kind === 'answer' ? 'ask' : kind === 'speak' && tgt === srcOf(T, src, pr.en) ? 'speak' : emo === '🪧' || emo === '🗿' || who === 'Sign' ? 'sign' : 'say';
          add(pr.en, { br: p.br, zh: p.zh, kind: kd, who, g, params: v.params });
        }
      }
      if (pr.target) {
        const v = val(pr.target);
        for (const b of engOf(v)) add(pr.target, { br: b, zh: null, kind: 'speak', who: who || '{name}', g, params: v.params, target: true });
      }
      // 剧情数据里要念的句子（水晶的 say / sayZh）、地图上村民教的句子（speak）、渡轮问的话（ask）、选项（t / right / wrong）
      for (const [key, zk, kd] of [['say', 'sayZh', 'speak'], ['speak', null, 'speak'], ['ask', null, 'say'], ['right', null, 'opt'], ['t', null, 'opt']]) {
        if (!pr[key] || isMap) continue;
        const v = val(pr[key]);
        if (!v) continue;
        const zv = zk && pr[zk] ? val(pr[zk]) : null;
        // t：只在选项（opts 里、带 c: true 的那种）
        if (key === 't' && !('c' in pr) && !(T[k.up] && isP(T[k.up], '[') && /opts/.test(src.slice(Math.max(0, T[k.up].s - 12), T[k.up].s)))) continue;
        // 回声技能（world.js 的 SKILLS）：say: n => n + ', cut the tree!'，旁边的 types 是哪些属性的怪兽能用（生成配音时只拼这些）
        const types = pr.types && isP(T[pr.types[0]], '[') ? T.slice(pr.types[0], pr.types[1]).filter(t => t.t === 'str').map(t => t.v) : null;
        for (const p of pairUp(engOf(v), zhOf(zv))) add(pr[key], { br: p.br, zh: p.zh, kind: kd, who, g, params: v.params, dom: types && v.params ? { types } : null });
      }
      if (pr.wrong && isP(T[pr.wrong[0]], '[')) {
        const a = pr.wrong[0];
        for (const [x, y] of splitTop(T, a + 1, T[a].close, [','])) { const v = val([x, y]); for (const b of engOf(v)) add([x, y], { br: b, zh: null, kind: 'opt', who, g: null }); }
      }
      continue;
    }
    // 数组和函数参数：挨着的「英语, 中文」
    const isCall = k.v === '(' && T[o - 1] && T[o - 1].t === 'id' && !/^(if|for|while|switch|catch|function|return)$/.test(T[o - 1].v);
    if (k.v !== '[' && !isCall) continue;
    const callee = isCall ? calleeOf(T, o) : '';
    const segs = splitTop(T, o + 1, k.close, [',']);
    const vals = segs.map(r => (skip[r[0]] ? null : val(r)));
    // 这个数组是哪个属性的值（signs: [[…]]、marks、say、lines……）：往外找
    let prop = '';
    if (k.v === '[') {
      for (let u = o, hop = 0; u >= 0 && hop < 3; u = T[u].up, hop++) {
        if (T[u - 1] && isP(T[u - 1], ':') && T[u - 2]) { prop = T[u - 2].v; break; }
        if (T[u - 1] && isP(T[u - 1], '=') && T[u - 2] && T[u - 2].t === 'id') { prop = T[u - 2].v; break; }
      }
    }
    const signy = /^(signs|marks)$/.test(prop);
    let paired = -1;
    for (let a = 0; a < vals.length; a++) {
      const en = engOf(vals[a]);
      if (!en.length) continue;
      const zhv = vals[a + 1], zh = zhOf(zhv);
      // 数据行里的键名、名字（['cut', '开路', 'Clear Way', '🌿']）不是台词：四项以上的数据行里，没有句子标点的小写键 / 大写开头的名字。
      // 剧情里的小词表（['first', '第一']、['went', '去了', '🚶']）留着：模板的自由变量在游戏里按这些查得到翻译
      if (zh.length && !signy && vals.length >= 4 && en.every(b => !b.some(p => p.x != null) && !/[.!?…"'“”]/.test(branchText(b)) && /^([A-Z0-9][\w'-]*( |$))+$|^[a-z_:]+$/.test(branchText(b).trim()))) { a++; continue; }
      if (zh.length) {
        // 英语, 中文：一句台词。说话的人：函数名（helper）；数据里的（地图上村民的 say: [[…]]）看外面那个对象的 name / who
        let who = isCall ? tidyWho(whoAt(H, callee.replace(/^L\./, ''), o)) : null;
        if (!isCall) {
          if (signy) who = 'Sign';
          else for (let u = T[o].up, hop = 0; u >= 0 && hop < 4; u = T[u].up, hop++) {
            if (!isP(T[u], '{')) continue;
            const op = objProps(T, src, u), nm = litOf(T, op.name) || litOf(T, op.who);
            if (nm && !('rows' in op) && !CJK.test(nm)) who = nm;   // 地图定义的 name 是中文地名，不是人
            break;
          }
        }
        const sp = isCall && /(^|\.)speak$/.test(callee) && a === 1;
        const kd = sp ? 'speak' : isCall && /(^|\.)ask$/.test(callee) && a === 1 ? 'ask' : signy || who === 'Sign' ? 'sign' : 'say';
        for (const p of pairUp(en, zh)) add(segs[a], { br: p.br, zh: p.zh, kind: kd, who: sp ? '{name}' : who, g: null, params: vals[a].params });
        paired = a + 1; a++;
        continue;
      }
      if (isCall && SAY_CALLS.test(callee) && a === 0) { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'say', who: null, g: null, params: vals[a].params }); continue; }
      if (isCall && /(^|\.)speak$/.test(callee) && a === 1) { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'speak', who: '{name}', g: null }); continue; }
      // 一句台词后面跟着的英语（选回答的题：对的回答、错的选项）
      if (isCall && paired >= 0) { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'opt', who: null, g: null }); continue; }
      if (k.v === '[' && T[k.up] && isP(T[k.up], '(') && paired < 0) {
        // 错的选项数组 ask(S, en, zh, right, ['…', '…'])：外层调用里前面有「英语, 中文」
        const oc = k.up, osegs = splitTop(T, oc + 1, T[oc].close, [',']), me = osegs.findIndex(([x, y]) => x <= o && o < y);
        const ov = osegs.map(r => val(r));
        if (me >= 2 && ov.slice(0, me).some((v, j) => engOf(v).length && zhOf(ov[j + 1]).length)) { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'opt', who: null, g: null }); continue; }
      }
      // 只有英语的数组：收服时念的句子（CATCH_LINES，一句句完整的话）、唤醒时的几个选项（pool：拼了怪兽名的）
      if (k.v === '[' && /^[A-Z_]+$/.test(prop) && en.every(b => /[.!?]\s*$/.test(branchText(b)))) { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'speak', who: null, g: null, params: vals[a].params }); continue; }
      if (k.v === '[' && prop === 'pool') { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'opt', who: null, g: null, params: vals[a].params }); continue; }
      // 剧情自己的一问一答 q: ['问', '对的回答', ['错 1', '错 2']]（和课程的对话一个形状）
      if (k.v === '[' && prop === 'q') { for (const b of en) add(segs[a], { br: b, zh: null, kind: a === 0 && T[k.up] && !isP(T[k.up], '[') ? 'ask' : 'opt', who: null, g: null }); continue; }
      if (k.v === '[' && T[k.up] && isP(T[k.up], '[') && T[T[k.up].up] && T[T[k.up].up - 1] && isP(T[T[k.up].up - 1], ':') && T[T[k.up].up - 2] && T[T[k.up].up - 2].v === 'q') { for (const b of en) add(segs[a], { br: b, zh: null, kind: 'opt', who: null, g: null }); continue; }
      for (const b of en) dropped.push(file + ':' + lineNo(src, T[segs[a][0]].s) + '\t' + (callee || prop || k.v) + '\t' + branchText(b).replace(/\u0000/g, '{…}'));
    }
  }
  // 变量里存着的一句（const line = 'Hello, ' + sp.en + '! Welcome to the world!'、line = ln ? ln.t : 'Your name is ' + name + '!'）：
  // 叫 line / target 的是要开口说的；只收像一句话的（句末有标点）
  T.forEach((k, i) => {
    if (skip[i] || k.t !== 'id' || !/^(line|target)$/.test(k.v) || !isP(T[i + 1], '=') || !(T[i - 1] && ((T[i - 1].t === 'id' && /^(const|let|var)$/.test(T[i - 1].v)) || isP(T[i - 1], ',')))) return;
    let j = i + 2;
    for (; j < T.length; j++) {
      const t = T[j];
      if (t.t === 'p' && (t.v === '(' || t.v === '[' || t.v === '{') && t.close != null) { j = t.close; continue; }
      if (t.t === 'p' && (t.v === ',' || t.v === ';' || t.v === ')' || t.v === '}' || t.v === ']')) break;
    }
    const v = val([i + 2, j]);
    for (const b of engOf(v)) if (/[.!?]\s*$/.test(branchText(b)) || /\S \S/.test(branchText(b).replace(/\u0000/g, 'X'))) add([i + 2, j], { br: b, zh: null, kind: 'speak', who: '{name}', g: null, params: v.params });
  });
}
const dropped = [];

// 给 tools/course/build.js 用：sandbox() 加载 dex / maps / story / isles / monsters（函数声明会提前，下面定义的也拿得到）
module.exports = { tokenize, splitTop, parseValue, sandbox };
if (require.main !== module) return;

// setup.js：销售版家庭定制的开场（家里人陪着念通行证）和家里人的台词
const FILES = ['story.js', 'world.js', 'monsters.js', 'game.js', 'setup.js', ...fs.readdirSync(path.join(ROOT, 'isles')).filter(f => f.endsWith('.js')).sort().map(f => 'isles/' + f)];
FILES.forEach(scan);
if (process.argv.includes('--dropped')) { dropped.forEach(d => console.log(d)); process.exit(0); }
if (process.argv.includes('--raw')) {
  for (const f of found) {
    const tpl = f.br.some(p => p.x != null);
    if (!tpl && !process.argv.includes('--all')) continue;
    console.log(f.file + ':' + f.line + '\t' + f.kind + '\t' + (f.who || '') + '\t' + f.br.map(p => (p.s != null ? JSON.stringify(p.s) : '[' + p.x + ']' + (slotOf(f.file, p.x) ? '' : '??'))).join(' + ') + (f.zh ? '\t| ' + f.zh.map(p => (p.s != null ? p.s : '[' + p.x + ']')).join(' + ') : ''));
  }
  console.log(found.length);
  process.exit(0);
}

// ======================================================================
//  5. 名字（terms）：在沙箱里加载数据文件读出来（和 tools/voice/collect.js 一样的读法）
// ======================================================================
function sandbox() {
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop, getContext: () => null });
  const win = {
    console, setTimeout, clearTimeout, addEventListener: noop, removeEventListener: noop, requestAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop }), location: { search: '', href: '', protocol: 'file:' }, navigator: { userAgent: '' },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    document: { addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), documentElement: el() },
  };
  win.window = win;
  vm.createContext(win);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const isles = [...html.matchAll(/<script src="(isles\/[^"]+)"/g)].map(m => m[1]);
  for (const f of ['dex.js', 'maps.js', 'people.js', 'story.js', ...isles, 'monsters.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), win, { filename: f });
  return win;
}
const SB = sandbox();
const DEX = SB.DEX, MG = SB.MonsterGame, EMAPS = SB.EchoMaps, STORY = SB.EchoStory;
const terms = { monster: [], move: [], item: [], place: [], skill: [], crystal: [], type: [] };
{
  // 怪兽：全部记录（家庭版、销售版的都在 DEX.all 里），按手册的顺序
  for (const sp of DEX.all) terms.monster.push({ id: sp.id, en: sp.en, zh: sp.zh });
  // 招式：每个属性 3 个攻击招式 + 辅助招式（monsters.js 的 SUP，用 parseMove 取）
  const seen = new Set();
  for (const ty of DEX.ORDER || Object.keys(DEX.MOVES)) (DEX.MOVES[ty] || []).forEach((m, k) => { if (!seen.has(m[0])) { seen.add(m[0]); terms.move.push({ id: ty + ':' + k, en: m[0], zh: m[1] }); } });
  for (const k of ['roar', 'guard', 'power', 'speed', 'chill', 'spooky', 'sleep', 'poison', 'para', 'burn', 'confuse', 'heal']) {
    const s = MG.parseMove('s:' + k).sup;
    if (s && !seen.has(s.en)) { seen.add(s.en); terms.move.push({ id: 's:' + k, en: s.en, zh: s.zh }); }
  }
  // 道具（回声贝、进化曲都在 ITEMS 里）
  for (const [id, it] of Object.entries(MG.ITEMS)) terms.item.push({ id, en: it.en, zh: it.zh });
  // 地名：每张有英文名的地图（小镇、路、洞、屋子……）；同名的只留一个
  const pn = new Set();
  for (const m of EMAPS.all().map(id => EMAPS.get(id)).filter(Boolean)) {
    if (!m.en || pn.has(m.en)) continue;
    pn.add(m.en);
    terms.place.push({ id: m.id, en: m.en, zh: m.name || '' });
  }
  for (let z = 0; z < 13; z++) if (!pn.has('Route ' + (z + 1))) { pn.add('Route ' + (z + 1)); terms.place.push({ id: 'route' + z, en: 'Route ' + (z + 1), zh: (z + 1) + ' 号路' }); }
  if (!pn.has('Echo Cave')) terms.place.push({ id: 'cave', en: 'Echo Cave', zh: '回声洞' });
  // 回声技能（回声贝的名字里也有）
  for (const [id, it] of Object.entries(MG.ITEMS)) if (it.hm && it.skill) terms.skill.push({ id: id.slice(3), en: it.skill.en, zh: it.skill.zh });
  // 水晶（第一年主线）
  for (const c of STORY.lib.CH || []) if (c && c.crystal) terms.crystal.push({ id: c.crystal.toLowerCase().replace(/\s+/g, '-'), en: c.crystal, zh: c.zh });
  // 选伙伴时说的属性
  for (const [id, en] of [['fire', 'fire'], ['water', 'water'], ['grass', 'grass'], ['spark', 'electric']]) terms.type.push({ id, en, zh: DEX.TYPES[id].zh });
}

// ======================================================================
//  6. 整理：台词（一句一条）、模板、统计
// ======================================================================
const FNV = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const VARS = t => [...new Set((String(t).match(/\{(name|rival)\}/g) || []))];
const FILE_ORDER = f => { const i = FILES.indexOf(f); return i < 0 ? 99 : i; };
const ids = new Set();
const mkId = (p, s) => { let id = p + FNV(s), k = 1; while (ids.has(id)) id = p + FNV(s) + '_' + (k++); ids.add(id); return id; };
// 配音的声音：和 tools/voice/collect.js 一样（成对的台词男女声都配；对战喊话按旁白 / 对手）
const TPL_G = {
  'Look out! Here comes {mon}!': ['f'], '{mon}, be my partner!': ['f'], "Let's battle! {mon}, your turn!": ['m'], '{mon}, take a rest!': ['f'],
  '{mon} is too tired to go on.': ['f'], 'Yes! {mon} is your new friend!': ['f'], '{mon} joined your team!': ['f'], '{mon} did not give up!': ['f'],
  'Look! {mon} is growing up!': ['f'], '{mon}, use {move}!': ['f'], 'You found a hidden {item}!': ['f'], '{mon} is a {type} monster. Will you take it?': ['f'],
  'Here you are. A {item}.': ['m'],
};
// 生成配音时一个模板拼哪些：starter 只拼选伙伴的三只；learnset 怪兽 × 它学得会的招式；evo 进化前 × 进化后
const TPL_DOM = {
  '{mon}, be my partner!': 'starter', '{mon} is a {type} monster. Will you take it?': 'starter', '{mon} woke up and smiled at you!': 'starter',
  '{mon} is your partner now. Take good care of it!': 'starter', 'Monsters here listen to English. Speak clearly, and {mon} will be strong.': 'starter',
  '{mon}, use {move}!': 'learnset', '{mon}, learn {move}!': 'learnset', '{mon} can learn {move} now!': 'learnset',
  '{mon} has grown up! Say hello to {mon2}!': 'evo',
};
// HTML 里直接写的英语（选伙伴的画面）：找得到这几个字才算（源文件改了就报错，别悄悄漏掉）
const EXTRA = [
  { file: 'story.js', en: 'Which shell will you open?', zh: '你要打开哪个贝壳？', kind: 'ui', who: 'Professor Echo', probe: '>Which shell will you open?<' },
];

const lineMap = new Map(), tplMap = new Map(), warn = [];
function addLine(o) {
  const e = lineMap.get(o.en);
  if (!e) { lineMap.set(o.en, Object.assign({ order: [FILE_ORDER(o.file), o.line] }, o)); return; }
  if ((KIND_RANK[o.kind] || 0) > (KIND_RANK[e.kind] || 0)) e.kind = o.kind;
  if (!e.zh && o.zh) e.zh = o.zh;
  if (!e.who && o.who) e.who = o.who;
  if (o.file !== e.file) (e.also = e.also || new Set()).add(o.file);
}
for (const f of found) {
  const tpl = f.br.some(p => p.x != null);
  const zhLit = f.zh && f.zh.every(p => p.s != null) ? f.zh.map(p => p.s).join('') : null;
  if (!tpl) {
    const en = f.br.map(p => p.s).join('');
    if (en.trim().length < 2) continue;
    addLine({ file: f.file, line: f.line, en, zh: zhLit, kind: f.kind, who: f.who, g: ['f', 'm'] });
    continue;
  }
  // 模板：变量按 SLOTS 认；冠词那一块写成 a / an
  const slots = {}, exprs = {};
  let free = 0, an = false, ok = true;
  const pat = f.br.map((p, k) => {
    if (p.s != null) return p.s;
    const am = ARTICLE.exec(p.x);
    if (am) { an = true; return am[2]; }
    // 箭头函数的参数（n => n + ', cut the tree!'）：monsters.js 的说法和 world.js 的技能都是怪兽名
    const so = slotOf(f.file, p.x) || (f.params && f.params.includes(p.x) ? { name: 'mon', type: 'monster' } : null);
    if (so) { slots[so.name] = so.type; return '{' + so.name + '}'; }
    const nm = 'x' + (++free);
    slots[nm] = 'free'; exprs[nm] = p.x;
    return '{' + nm + '}';
  }).join('');
  if (!ok) continue;
  // 中文那半：同一个变量（sp.zh、同一段源码）写成同一个 {名字}，认不出的写成 {…}
  let zh = null;
  if (f.zh) {
    zh = f.zh.map(p => {
      if (p.s != null) return p.s;
      const so = slotOf(f.file, p.x);
      if (so && slots[so.name]) return '{' + so.name + '}';
      const same = Object.keys(exprs).find(k => exprs[k] === p.x);
      return same ? '{' + same + '}' : '{…}';
    }).join('');
  }
  const key = pat;
  const e = tplMap.get(key);
  if (e) { if ((KIND_RANK[f.kind] || 0) > (KIND_RANK[e.kind] || 0)) e.kind = f.kind; if (!e.zh && zh) e.zh = zh; if (f.file !== e.file) (e.also = e.also || new Set()).add(f.file); continue; }
  tplMap.set(key, { order: [FILE_ORDER(f.file), f.line], file: f.file, line: f.line, en: pat, zh, slots, exprs, an, kind: f.kind, who: f.who, dom: TPL_DOM[pat] || f.dom || null });
}
// 商店店员：'Here you are. ' + (n > 1 ? n + ' ' + it.en + 's' : (A / An) + it.en) + '.'——拆成一个（买一个）和一个带数字的
{
  const s = fs.readFileSync(path.join(ROOT, 'world.js'), 'utf8');
  if (s.includes("E.say('Here you are. ' + (n > 1 ? n + ' ' + it.en + 's' : (/^[aeiou]/i.test(it.en) ? 'An ' : 'A ') + it.en) + '.'")) {
    for (const k of [...tplMap.keys()]) if (/^Here you are\. \{x1\}\.$/.test(k)) tplMap.delete(k);
    tplMap.set('Here you are. A {item}.', { order: [FILE_ORDER('world.js'), 0], file: 'world.js', line: 0, en: 'Here you are. A {item}.', zh: '给你，{item}。', slots: { item: 'item' }, exprs: {}, an: true, kind: 'say', who: 'Clerk', dom: null });
    tplMap.set('Here you are. {n} {item}s.', { order: [FILE_ORDER('world.js'), 0], file: 'world.js', line: 0, en: 'Here you are. {n} {item}s.', zh: '给你，{n} 个{item}。', slots: { n: 'num', item: 'item' }, exprs: {}, an: false, kind: 'say', who: 'Clerk', dom: null });
  } else warn.push('world.js 商店那句 Here you are 改了：tools/course/lines.js 跟着改');
}
for (const x of EXTRA) {
  const s = fs.readFileSync(path.join(ROOT, x.file), 'utf8');
  if (!s.includes(x.probe)) { warn.push(x.file + ' 里找不到「' + x.en + '」：tools/course/lines.js 的 EXTRA 跟着改'); continue; }
  addLine({ file: x.file, line: lineNo(s, s.indexOf(x.probe)), en: x.en, zh: x.zh, kind: x.kind, who: x.who, g: ['f', 'm'] });
}
// 手册里点喇叭听的介绍（dex.js 的 dexEn）
for (const sp of DEX.all) if (sp.dexEn) addLine({ file: 'dex.js', line: 0, order2: sp.dexNo || 0, en: sp.dexEn, zh: sp.dexZh || null, kind: 'ui', who: sp.en, g: ['f'] });

// 不能出现的词（tools/banned-terms.txt）：源文件里有的话 check-banned 早就拦下了，这里再看一眼
{
  const B = require('../check-banned.js').terms();
  for (const e of [...lineMap.values(), ...tplMap.values()]) if (B.some(t => (t.s ? e.en.includes(t.s) : t.re.test(e.en)))) warn.push('有不能出现的词：' + e.en);
}

const byOrder = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || (a.order2 || 0) - (b.order2 || 0) || (a.en < b.en ? -1 : a.en > b.en ? 1 : 0);
const lines = [...lineMap.values()].sort(byOrder).map(e => {
  const o = { id: mkId('l', e.en), en: e.en };
  if (e.zh) o.zh = e.zh;
  o.src = e.file;
  if (e.also) o.also = [...e.also].sort((a, b) => FILE_ORDER(a) - FILE_ORDER(b));
  o.kind = e.kind;
  if (e.who) o.who = e.who;
  o.g = e.g;
  const v = VARS(e.en);
  if (v.length) o.vars = v;
  return o;
});
const templates = [...tplMap.values()].sort(byOrder).map(e => {
  const o = { id: mkId('t', e.en), en: e.en };
  if (e.zh) o.zh = e.zh;
  o.slots = e.slots;
  if (Object.keys(e.exprs).length) o.expr = e.exprs;
  if (e.an) o.an = true;
  o.src = e.file;
  if (Object.values(e.slots).includes('free') && e.line) o.at = e.file + ':' + e.line;   // 自由变量：翻译的人去这一行看有哪些值
  if (e.also) o.also = [...e.also].sort((a, b) => FILE_ORDER(a) - FILE_ORDER(b));
  o.kind = e.kind;
  if (e.who) o.who = e.who;
  o.g = TPL_G[e.en] || ['f', 'm'];
  if (e.dom) o.dom = e.dom;
  const v = VARS(e.en);
  if (v.length) o.vars = v;
  return o;
});

// ======================================================================
//  7. 和配音名单对一对：tools/voice/lines.json（collect.js 上次生成的）里属于剧情 / 对战的句子，这里都要收到（原样，或者模板拼得出来）
// ======================================================================
function covered() {
  const f = path.join(ROOT, 'tools', 'voice', 'lines.json');
  if (!fs.existsSync(f)) return null;
  const voice = JSON.parse(fs.readFileSync(f, 'utf8')).map(e => e.t);
  // 课程内容和关掉的功能：从 data.js / book.js / quests.js / 能力检测 / 今日目击拿到的句子不算
  const content = new Set();
  const ctx = { window: {} };
  for (const fn of ['data.js', 'book.js', 'quests.js']) vm.runInNewContext(fs.readFileSync(path.join(ROOT, fn), 'utf8'), ctx);
  for (const w of ctx.window.WORLDS.concat((ctx.window.BOOKS || { list: [] }).list.flatMap(b => b.units))) {
    w.words.forEach(x => content.add(x[0])); w.sents.forEach(x => content.add(x[0]));
    w.dlgs.forEach(d => { content.add(d[0]); content.add(d[1]); (d[2] || []).forEach(o => content.add(o)); });
    if (w.boss && w.boss.hello) content.add(w.boss.hello);
    if (w.en) content.add(w.en);
  }
  (ctx.window.SCENES || []).forEach(s => (s.lines || []).forEach(l => content.add(l[1])));
  for (const q of (ctx.window.QUESTS || { list: [] }).list) { q.ask.forEach(a => content.add(a[0])); q.thanks.forEach(a => content.add(a[0])); content.add(q.bye[0]); if (q.note) content.add(q.note[0]); content.add(q.en); }
  try { const D = require(path.join(ROOT, 'placement-data.js')); for (const it of (D.en ? D.en.items : [])) { (it.audio || []).forEach(a => content.add(a.text)); if (it.word) content.add(it.word); } } catch (e) {}
  if (SB.EchoSight && SB.EchoSight.lines) for (const t of SB.EchoSight.lines()) content.add(t);
  const plain = new Set(lines.map(l => l.en));
  const res = templates.filter(t => !Object.values(t.slots).includes('free')).map(t => {
    const parts = t.en.split(/(\{[a-z0-9]+\})/);
    const re = new RegExp('^' + parts.map(p => (/^\{[a-z0-9]+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$');
    return t.an ? new RegExp(re.source.replace(/(^|\W)([aA]) \(\.\+\?\)/g, '$1$2n? (.+?)')) : re;
  });
  const tnames = new Set(Object.values(terms).flat().map(x => x.en));
  const miss = voice.filter(t => !content.has(t) && !plain.has(t) && !tnames.has(t) && !res.some(re => re.test(t)) && !/\{(name|rival)\}/.test(t));
  return miss;
}
const miss = covered();

const count = (arr, k) => arr.reduce((o, e) => { o[e[k]] = (o[e[k]] || 0) + 1; return o; }, {});
const sortObj = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const stats = {
  lines: lines.length, templates: templates.length,
  terms: Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, v.length])),
  bySrc: sortObj(count(lines, 'src')), byKind: sortObj(count(lines, 'kind')),
  templatesBySrc: sortObj(count(templates, 'src')), templatesByKind: sortObj(count(templates, 'kind')),
  freeTemplates: templates.filter(t => Object.values(t.slots).includes('free')).length,
  withVars: lines.filter(l => l.vars).length,
  words: lines.reduce((s, l) => s + l.en.split(/\s+/).length, 0) + templates.reduce((s, l) => s + l.en.split(/\s+/).length, 0),
};
const out = {
  fmt: 1,
  note: '游戏里写死的英语台词（课程内容以外）。node tools/course/lines.js 生成，不要手改。翻译写在 tools/course/<语言>/lines.json，格式见 tools/course/SPEC.md §8',
  stats, lines, templates, terms,
};
// 一条一行（好对比、好查）：{ "fmt", "note", "stats", "lines": [ 每句一行 ], "templates": [ … ], "terms": { "monster": [ 每个一行 ], … } }
const J = v => JSON.stringify(v);
const arr = (a, ind) => '[\n' + a.map(x => ind + '  ' + J(x)).join(',\n') + '\n' + ind + ']';
const text = '{\n' +
  ' "fmt": ' + J(out.fmt) + ',\n "note": ' + J(out.note) + ',\n "stats": ' + J(out.stats) + ',\n' +
  ' "lines": ' + arr(out.lines, ' ') + ',\n' +
  ' "templates": ' + arr(out.templates, ' ') + ',\n' +
  ' "terms": {\n' + Object.entries(out.terms).map(([k, v]) => '  ' + J(k) + ': ' + arr(v, '  ')).join(',\n') + '\n }\n}\n';
JSON.parse(text);   // 拼出来的一定是合法的 JSON
if (warn.length) warn.forEach(w => console.error('⚠ ' + w));
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== text) { console.error('lines-src.json 和源文件对不上：跑一遍 node tools/course/lines.js'); process.exit(1); }
  console.log('✓ lines-src.json 是最新的');
} else fs.writeFileSync(OUT, text);
console.log('lines-src: 台词 ' + stats.lines + ' 句（' + Object.entries(stats.byKind).map(([k, v]) => k + ' ' + v).join('、') + '），模板 ' + stats.templates + ' 个（自由变量的 ' + stats.freeTemplates + ' 个），' +
  '词 ' + Object.entries(stats.terms).map(([k, v]) => k + ' ' + v).join('、') + '；约 ' + stats.words + ' 个英文词');
console.log('  来源：' + Object.entries(stats.bySrc).map(([k, v]) => k + ' ' + v).join('、'));
// 对照：配音名单里有、这里没收到的（多是旧的说法、拼出来的半截）。--misses 列出来
const NL = '\n    ';
if (miss) console.log('  配音名单（tools/voice/lines.json）里剧情 / 对战的句子：' + (miss.length ? miss.length + ' 句这里没有（多半是 lines.json 旧了；--misses 列出来）' + (process.argv.includes('--misses') ? '：' + NL + miss.map(t => JSON.stringify(t)).join(NL) : '') : '全都收到了'));
