// 把课程源文件（tools/course/<语言>/）生成课程包里的 course.json（格式见 tools/course/SPEC.md §6）
//   node tools/course/build.js <es|ja|zh> [--check] [--out dist/course] [--lines 别的 lines.json]
//   有 tools/course/<语言>/lines.json（台词翻译表，SPEC §8）就并进 LINES / LINES_T / TERMS 和配音名单；--lines 换一份（测试的小样），build(lang, { lines: false }) 不带
//   → <out>/<语言>/course.json：WORLDS / SCENES / BOOKS / TALK / MAP / VOICE，形状和 data.js、book.js 的数组一样，
//     多出来的读音、词块、英文意思放在每条最后那个对象里（game.js 的 meanOf 读它）。
//   先跑一遍 tools/course/check.js（同一份检查），有一处错就不生成。--check 只检查、不写。
//   同一份输入生成的文件逐字节一样（不写时间、不依赖文件系统的顺序）。只有 8 个单元文件齐全的册才进 BOOKS。
// 配音：VOICE 是这门课所有要提前配音的句子 { t, g, p }（t 是目标语言原文，不是读音；g 是声音 f / m；p 是先后：
//   小镇在前、按岛，再按册、按单元），同一句（按 key.js 的 norm 算）只出现一次，g 合并。gen.py 和 tools/pack/build.js 读它。
// 支线委托、今日目击（tools/course/TALK.md 第二轮）：有 tools/course/<语言>/quests.json、sight.json（格式写在 check.js 里）就带上——
//   委托的 ask / note / thanks / bye 和每一句线索并进 LINES（键是英语原文：quests.js 的那一句、sight-src.json 的那一句）和配音名单 VOICE
//   （委托人按 TA 的性别、旁白男女声都配、线索是女声旁白；排在课本后面）；和 LINES 里已有的键撞了：译文一样就算了，不一样报错。
//   course.json 多一项 QUESTS：{ 委托 id: { opener, steps: [示范句…], words: [[这门语言的词, 中文, 英文]…] } }——开场白 / 示范句和 LINES 的整句一个写法
//   （西语字符串，日语 / 中文 { t, seg, r }），词是字符串（西语）或 { t, r }；词的中文 / 英文意思照 quests.js 的 words（[英文, 中文]）。
//   每条另有 names（可以没有）：[[英语名, 这门语言的写法]…]——这条委托的英文原文里出现的、台词翻译表 terms 里定了写法的名字（见 questNames）。
//   文件不存在就没有这几样（和以前一字不差）。--quests / --sight 换一份（测试的小样）；build(lang, { quests, sight })：文件 / false 不带；
//   给了 lines（小样或 false）又没给这两样时不带正式的（见 extraFile）。
// 课前讲解和求助的话（WORDS.md §12）：有 tools/course/<语言>/lessons.json 就并进 course.json 的 LESSONS（原样，加 v: 1），help 进配音名单；
//   --lessons 换一份（测试的小样）；build(lang, { lessons })。英语：node tools/course/build.js --lessons-en [--check] → 根目录的 lessons-en.js
// 发音入门（tools/course/WORDS.md §4）：有 tools/course/<语言>/primer.json 就并进 course.json 的 PRIMER（原样，加 v: 1），
//   只有例词的 t 进配音名单（女声，排在小镇后面；格子自己的 say 不进，游戏里用本机声音念，见 buildPrimer）。--primer 换一份（测试的小样）；build(lang, { primer })：文件 / false 不带；
//   哪一份的规矩和委托一样（extraFile：给了 lines 的测试不带正式的）。
// 聊天角色表（tools/course/TALK.md §1）：
//   node tools/course/build.js --talk [--check]
//   → 仓库根目录的 talk-courses.js：三门语言 course.json 里 TALK 的每一条原样、外加 lang，给中转服务和公开版服务器按 id 查
//     （手机只发角色 id，人设由服务器拼）。--talk --check 只核对它是不是最新的（不是最新退出码 1）。
//     平常生成 course.json 时也顺手核对，不是最新就提醒一句。
//     第二轮多一项 quests：{ 语言: { 委托 id: { opener, steps, words[, names] } } }（纯文字，从 <语言>/quests.json 来；还没有译文的语言不在里面；
//     names 是名字表，查的是 <语言>/lines.json 的 terms——改了名字的写法也要重跑 --talk）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const { norm } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));

const LANGS = ['es', 'ja', 'zh'];
// 冒险出题和对战的偏好：和 levels.js 里英语的一样（SPEC §6 的 MAP 示例）
const MAP_MIX = [0.6, 0.6, 0.8, 0.9, 1, 1];
const MAP_KINDS = [
  { listen: 0.5, fade: [4, 6] }, { listen: 0.3, fade: [3, 5] }, { listen: 0, fade: [2, 4] },
  { listen: 0, fade: [1, 3] }, { listen: 0, fade: [1, 2] }, { listen: 0, fade: [1, 2] },
];

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---------- 检查：和 tools/course/check.js 是同一份（它是个直接跑的脚本，所以开子进程） ----------
function validate(lang) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check.js'), lang, '--quiet'], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

// data.js 里 13 个小镇的岛名、图标、颜色、岛主，和每座岛小剧场的背景（在沙盒里读，不碰全局）
function readIslands() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx, { filename: 'data.js' });
  const W = ctx.window.WORLDS, S = ctx.window.SCENES;
  if (!Array.isArray(W) || W.length !== 13 || !Array.isArray(S) || S.length !== 13) throw new Error('data.js 里要有 13 个 WORLDS 和 13 段 SCENES');
  return W.map((w, i) => ({ name: w.name, icon: w.icon, color: w.color, boss: w.boss, bg: S[i].bg, set: S[i].set }));
}

// ---------- 条目 → 游戏里的数组 / 对象 ----------
const has = v => v !== undefined && v !== null;
// 意思和读音等放在最后那个对象里：没有的字段不写（西语没有 r、seg）
const pickX = (e, keys) => { const x = {}; for (const k of keys) if (has(e[k])) x[k] = e[k]; return x; };
const word = e => [e.t, e.zh || '', e.pic || '', pickX(e, ['en', 'r'])];
const sent = e => [e.t, e.zh || '', pickX(e, ['en', 'seg', 'r'])];
const xs = e => pickX({ zh: e.zh || '', en: e.en, seg: e.seg, r: e.r }, ['zh', 'en', 'seg', 'r']);   // 对话里问 / 答 / 错选项的附加信息（t 已经在前面的数组里）
const dlg = d => [d.q.t, d.a.t, d.wrong.map(w => w.t), { q: xs(d.q), a: xs(d.a), wrong: d.wrong.map(xs) }];

// 配音名单：按先后收，同一句合并 g
function voiceList() {
  const by = new Map(), out = [], rd = new Map();
  const add = (t, gs, r) => {
    if (typeof t !== 'string' || !t.trim()) return;
    const k = norm(t);
    if (!k) return;
    let e = by.get(k);
    if (!e) { e = { t: t, g: [], p: out.length }; by.set(k, e); out.push(e); }
    if (r && !rd.has(k)) rd.set(k, r);
    for (const g of gs) if (!e.g.includes(g)) e.g.push(g);
  };
  const fin = () => out.map(e => ({ t: e.t, g: ['f', 'm'].filter(g => e.g.includes(g)), p: e.p }));
  return { add, fin, rd: () => Object.fromEntries(rd) };
}

function loadSources(lang) {
  const dir = path.join(__dirname, lang);
  const syl = readJson(path.join(dir, 'syllabus.json'));
  const towns = readJson(path.join(dir, 'towns.json'));
  const books = [];
  for (const b of syl.books) {
    const units = [];
    for (let n = 1; n <= 8; n++) {
      const f = path.join(dir, 'units', b.id + '-' + n + '.json');
      if (!fs.existsSync(f)) break;
      units.push(readJson(f));
    }
    if (units.length === 8) books.push({ syl: b, units });
  }
  return { syl, towns, books };
}

// ---------- 台词翻译表（SPEC §8）：lines-src.json + <语言>/lines.json → LINES / LINES_T / TERMS 和要配音的句子 ----------
// 配音只拼这些带怪兽名的模板（和 tools/voice/collect.js 给英语配的一样：对战喊话、选伙伴、收服、进化、出招），
// 别的带怪兽名的（技能指令、和怪兽说话、学招……多半是起的昵称）游戏里用本机声音念
const VOICE_MON = new Set(['{mon}, your turn!', "Let's battle! {mon}, your turn!", 'Look out! Here comes {mon}!', '{mon}, take a rest!', '{mon} is too tired to go on.',
  'Yes! {mon} is your new friend!', '{mon} joined your team!', '{mon} did not give up!', 'Look! {mon} is growing up!', '{mon}, use {move}!']);
const EARLY = /^(story|setup|world|monsters|game)\.js$|^isles\/a-/;   // 开场和第 1 组岛：配音排在课本前面
function linesFile(lang, o) { return o && o.lines === false ? null : o && o.lines ? path.resolve(o.lines) : path.join(__dirname, lang, 'lines.json'); }
// 读音（r 是一列或一个字符串）→ 一个字符串：日语直接接，中文拼音用空格
let RJ = '';
const rjoin = r => (Array.isArray(r) ? r.map(String).join(RJ) : typeof r === 'string' ? r : undefined);
// 译文写进 course.json 的样子：西语写成字符串（没有 g 的话），日语 / 中文 { t, seg, r }
// 整句可以另写自己的意思 zh / en（译文改写过、原来的意思对不上时，SPEC §8.2），原样带上
function lineOut(x, kana) {
  const v = typeof x === 'string' ? { t: x } : x;
  const gl = o => { for (const k of ['zh', 'en']) if (typeof v[k] === 'string' && v[k]) o[k] = v[k]; return o; };
  if (!kana) return v.g || v.zh || v.en ? gl(v.g ? { t: v.t, g: v.g } : { t: v.t }) : v.t;
  const o = { t: v.t };
  if (Array.isArray(v.seg)) o.seg = v.seg;
  if (v.r != null) o.r = v.r;
  return gl(o);
}
function buildLines(lang, file) {
  RJ = lang === 'zh' ? ' ' : '';
  if (!file || !fs.existsSync(file)) return null;
  const SRC = readJson(path.join(__dirname, 'lines-src.json')), J = readJson(file);
  const PK = require(path.join(ROOT, 'packs.js'))._;
  const kana = lang !== 'es';
  const out = x => lineOut(x, kana);
  const LINES = {}, early = [], late = [];
  for (const s of SRC.lines) {
    if (!J.lines || !Object.prototype.hasOwnProperty.call(J.lines, s.id)) continue;
    LINES[s.en] = out(J.lines[s.id]);
    const t = typeof LINES[s.en] === 'string' ? LINES[s.en] : LINES[s.en].t;
    if (!/\{(name|rival)\}/.test(t)) (s.src === 'dex.js' ? late : EARLY.test(s.src) ? early : late).push({ t, g: s.g, dex: s.src === 'dex.js', r: rjoin(LINES[s.en].r) });
  }
  const TERMS = {}, termEn = {};
  for (const [ty, arr] of Object.entries(SRC.terms)) {
    termEn[ty] = arr;
    const m = J.terms && J.terms[ty] || {};
    for (const x of arr) {
      if (Object.prototype.hasOwnProperty.call(m, x.id)) (TERMS[ty] = TERMS[ty] || {})[x.en] = out(m[x.id]);
      // 西语的名字牌：和英文一样的人名（Kai、Amy、Orion……）不写（lines-glossary.md），这里照英文填上——
      // 游戏才知道它是人名（界面提示里夹着的「小凯 Kai」留着，不当成英语单词拿掉，ENGINE.md §5）
      else if (ty === 'person' && !kana) (TERMS[ty] = TERMS[ty] || {})[x.en] = x.en;
    }
  }
  const lit = en => en.replace(/\{[a-z0-9]+\}/g, '').length;
  const LINES_T = SRC.templates.filter(s => J.templates && Object.prototype.hasOwnProperty.call(J.templates, s.id)).map(s => {
    const v = typeof J.templates[s.id] === 'string' ? { t: J.templates[s.id] } : J.templates[s.id];
    const o = { en: s.en, t: v.t };
    if (kana && Array.isArray(v.seg)) { o.seg = v.seg; o.r = v.r; }
    o.s = s.slots;
    if (s.an) o.an = true;
    if (v.f != null) o.f = v.f;
    if (v.vals) o.vals = Object.fromEntries(Object.entries(v.vals).map(([k, m]) => [k, Object.fromEntries(Object.entries(m).map(([e, x]) => [e, out(x)]))]));
    return o;
  }).sort((a, b) => lit(b.en) - lit(a.en) || (a.en < b.en ? -1 : a.en > b.en ? 1 : 0));   // 越具体的（字面越长）越先对
  const course = { lang, LINES, LINES_T, TERMS };
  // 要配音的：模板 × 词展开，译文用游戏里同一个 lineFind 拼（拼不出来的——词没翻——就不配）
  const tab = PK.lineTable(course), D = dexInfo();
  const isMon = v => D.names.has(v);
  const V = { early, late, mon: [], dex: late.filter(x => x.dex) };
  V.late = late.filter(x => !x.dex);
  const tr = en => { const r = PK.lineFind(tab, en, { isMon }); return r ? r.t : null; };
  const trr = en => { const r = PK.lineFind(tab, en, { isMon }); return r ? rjoin(r.r) : undefined; };
  const article = (en, tpl) => (tpl.an ? en.replace(/(^|\W)([aA]) ([AEIOUaeiou])/g, (a, p, x, v) => p + x + 'n ' + v) : en);
  for (const s of SRC.templates) {
    if (!LINES_T.some(t => t.en === s.en)) continue;
    const ty = Object.values(s.slots), names = Object.keys(s.slots);
    if (ty.some(x => x === 'num' || x === 'name' || x === 'content')) continue;
    const hasMon = ty.includes('monster');
    if (hasMon && !VOICE_MON.has(s.en) && s.dom !== 'starter') continue;
    // 自由变量：翻译里给了 vals 才拼；两个以上自由变量的（{x1} = {x2} 这种）各自的值不是随便配的，不配音（游戏里用本机声音）
    if (ty.includes('free') && (!(J.templates[s.id] && J.templates[s.id].vals) || ty.filter(x => x === 'free').length > 1)) continue;
    // 每个空的取值（英文）
    const vals = names.map(nm => {
      const k = s.slots[nm];
      if (k === 'monster') return null;   // 怪兽另外按 dom 拼
      if (k === 'free') return Object.keys((J.templates[s.id].vals || {})[nm] || {});
      return (termEn[k] || []).map(x => x.en);
    });
    const combos = [];
    const monList = s.dom === 'starter' ? D.starters : s.dom && s.dom.types ? D.all.filter(sp => sp.types.some(t => s.dom.types.includes(t))) : D.all;
    const rec = (i, acc, sp) => {
      if (i === names.length) { combos.push({ en: acc, sp }); return; }
      const nm = names[i], k = s.slots[nm];
      if (k === 'monster') {
        if (s.dom === 'learnset' || s.dom === 'evo') return;   // 下面单独拼
        if (nm === 'mon2') return;
        for (const m of (sp ? [sp] : monList)) rec(i + 1, acc.split('{' + nm + '}').join(m.en), m);
        return;
      }
      for (const v of vals[i]) rec(i + 1, acc.split('{' + nm + '}').join(v), sp);
    };
    if (s.dom === 'learnset') { for (const sp of D.all) for (const mv of D.learn(sp)) combos.push({ en: s.en.split('{mon}').join(sp.en).split('{move}').join(mv), sp }); }
    else if (s.dom === 'evo') { for (const sp of D.all) for (const to of D.evo(sp)) combos.push({ en: s.en.split('{mon}').join(sp.en).split('{mon2}').join(to.en), sp }); }
    else rec(0, s.en, null);
    for (const c of combos) {
      const en = article(c.en, s), t = tr(en);
      if (!t) continue;
      const e = { t, g: s.g, no: c.sp ? c.sp.no : -1, r: trr(en) };
      if (hasMon && s.dom !== 'starter') V.mon.push(e); else V.early.push(e);
    }
  }
  // 单独念的词：选伙伴时念三只的名字、横幅念地名
  for (const sp of D.starters) { const t = tr(sp.en); if (t && t !== sp.en) V.early.push({ t, g: ['f', 'm'], r: trr(sp.en) }); }
  for (const p of termEn.place || []) { const t = tr(p.en); if (t) V.early.push({ t, g: ['f', 'm'], r: trr(p.en) }); }
  V.mon.sort((a, b) => a.no - b.no);   // 对战喊话按手册编号
  return { course: { LINES, LINES_T, TERMS }, voice: V };
}
// ---------- 支线委托、今日目击的译文（tools/course/TALK.md 第二轮）：<语言>/quests.json、<语言>/sight.json ----------
// 哪一份：o.quests / o.sight 给了文件就用它（测试的小样），给 false 就不带；都没给时——平常（o.lines 也没给）用这门语言正式的那份，
// 另给了台词翻译表的小样、或者 lines: false（测试）时不带正式的（小样的课程只有小样的内容，正式的内容来了测试也不跟着变）。文件不存在 = 没有这一样
function extraFile(lang, o, k) {
  const v = o ? o[k] : undefined;
  if (v === false) return null;
  if (v) return path.resolve(v);
  return o && o.lines !== undefined ? null : path.join(__dirname, lang, k + '.json');
}
const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const textOf = x => (typeof x === 'string' ? x : x && typeof x === 'object' && typeof x.t === 'string' ? x.t : '');
// 返回 { LINES: { 英语原文: 译文 }（对话框里的请求 / 旁白 / 感谢 / 做完以后的那一句、每一句线索——游戏里现成的 lineOf(英语原文) 直接查得到）,
//   QUESTS: { 委托 id: { opener, steps: [示范句…], words: [[这门语言的词, 中文, 英文]…] } }（聊天页显示用，带读音；没有委托的译文是 null）,
//   plain: { 委托 id: { opener, steps, words } }（纯文字，服务器拼人设用：talk-courses.js 的 quests）,
//   voice: [{ t, g, r }]（要配音的：委托人按 TA 的性别、旁白男女声都配、线索是女声旁白）, n: { quests, sight } }
// 委托按 quests.js 的先后、线索按 sight-src.json 的先后（不跟着译文文件里键的顺序）；quests.js 里没有的 id、sight-src.json 里没有的句子不带。
// 写法不全的那条委托不带（check.js 会报错；这里只管别崩）
// 委托的名字表（译者 2026-11-21 指出：人设是英文原文，岛民用别的语言说话时名字会各译各的）：
// 这条委托的英文原文（委托人、岛名、身份、persona、goal、opener）里出现的、这门课台词翻译表 terms 里已经定了写法的名字
// （person / place / monster / item；英语原名在 lines-src.json 的 terms 里）→ [[英语名, 这门语言的写法]…]，按在原文里第一次出现的先后。
// 整词匹配、分大小写；长的名字先配、配上的那一段不再给短的配（「Fisher Tom」先于「Tom」）；写法和英语一样的不列（西语的人名）。
// 用哪份翻译表跟着 o.lines（linesFile：没给 = 这门语言正式的 lines.json，false = 没有名字表，小样 = 小样的 terms）
const NAME_TYPES = ['person', 'place', 'monster', 'item'];
function nameTerms(lang, o) {
  const lf = linesFile(lang, o), sf = path.join(__dirname, 'lines-src.json');
  if (!lf || !fs.existsSync(lf) || !fs.existsSync(sf)) return [];
  const SRC = readJson(sf), J = readJson(lf), seen = new Set(), out = [];
  for (const ty of NAME_TYPES) {
    const m = J && J.terms && J.terms[ty];
    if (!m || typeof m !== 'object') continue;
    for (const x of (SRC.terms && SRC.terms[ty]) || []) {
      const t = own(m, x.id) ? textOf(m[x.id]).trim() : '';
      if (!t || t === x.en || seen.has(x.en) || !/^[A-Z]/.test(x.en)) continue;
      seen.add(x.en);
      out.push([x.en, t]);
    }
  }
  return out.sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
function questNames(q, terms) {
  let text = [q.who, q.place, q.role, q.persona, q.goal, q.opener].map(x => String(x || '')).join('\n');
  const hits = [];
  for (const [en, t] of terms) {
    const re = new RegExp('(^|[^A-Za-z0-9])' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])', 'g');
    const m = re.exec(text);
    if (!m) continue;
    hits.push({ en, t, at: m.index + m[1].length, len: en.length });
    text = text.replace(re, (a, p) => p + ' '.repeat(a.length - p.length));   // 配上的那一段用空格占住（位置不变），短的名字不再配它
  }
  return hits.sort((a, b) => a.at - b.at || b.len - a.len).map(h => [h.en, h.t]);
}
function buildExtra(lang, o) {
  RJ = lang === 'zh' ? ' ' : '';
  const kana = lang !== 'es', out = { LINES: {}, QUESTS: null, plain: null, voice: [], n: { quests: 0, sight: 0 } };
  const line = (en, v, g, where) => {
    const t = textOf(v);
    if (!t.trim()) return;
    // 同一句英语原文出现两次（两条委托里同一句话）：译文一样就算了（配音照样按两个人的声音都配），不一样报错
    if (own(out.LINES, en)) { if (textOf(out.LINES[en]) !== t) throw new Error(where + '：「' + en + '」已经有一个不一样的译文（' + textOf(out.LINES[en]) + ' ≠ ' + t + '）'); }
    else out.LINES[en] = lineOut(v, kana);
    out.voice.push({ t, g, r: rjoin(typeof v === 'object' ? v.r : undefined) });
  };
  const qf = extraFile(lang, o, 'quests'), sf = extraFile(lang, o, 'sight');
  if (qf && fs.existsSync(qf)) {
    const J = readJson(qf), Q = require(path.join(ROOT, 'quests.js')), T = J && J.quests && typeof J.quests === 'object' ? J.quests : {};
    const full = (q, x) => x && typeof x === 'object' && ['ask', 'steps', 'words', 'thanks'].every(k => Array.isArray(x[k]) && x[k].length >= q[k].length && x[k].slice(0, q[k].length).every(textOf)) &&
      textOf(x.opener) && textOf(x.bye) && (!q.note || textOf(x.note));
    const QUESTS = {}, plain = {}, terms = nameTerms(lang, o);
    for (const q of Q.list) {
      const x = own(T, q.id) ? T[q.id] : null;
      if (!full(q, x)) continue;
      const g = [q.g === 'f' ? 'f' : 'm'], w = 'quests.json ' + q.id;
      q.ask.forEach((a, i) => line(a[0], x.ask[i], g, w));
      if (q.note) line(q.note[0], x.note, ['f', 'm'], w);
      q.thanks.forEach((a, i) => line(a[0], x.thanks[i], g, w));
      line(q.bye[0], x.bye, g, w);
      const word = v => (kana && typeof v === 'object' ? (v.r != null ? { t: v.t, r: v.r } : { t: v.t }) : textOf(v));
      QUESTS[q.id] = { opener: lineOut(x.opener, kana), steps: q.steps.map((s, i) => lineOut(x.steps[i], kana)), words: q.words.map((s, i) => [word(x.words[i]), s[1], s[0]]) };
      plain[q.id] = { opener: textOf(x.opener), steps: q.steps.map((s, i) => textOf(x.steps[i])), words: q.words.map((s, i) => textOf(x.words[i])) };
      // 名字表：有才写（两处一样——手机用课程包里的 QUESTS 拼出来的人设要和服务器拼的一样）
      const names = questNames(q, terms);
      if (names.length) { QUESTS[q.id].names = names; plain[q.id].names = names; }
      out.n.quests++;
    }
    if (out.n.quests) { out.QUESTS = QUESTS; out.plain = plain; }
  }
  if (sf && fs.existsSync(sf)) {
    const J = readJson(sf), SRC = readJson(path.join(__dirname, 'sight-src.json')), T = J && J.lines && typeof J.lines === 'object' ? J.lines : {};
    for (const en of SRC.lines) if (own(T, en) && textOf(T[en]).trim()) { line(en, T[en], ['f'], 'sight.json'); out.n.sight++; }
  }
  return out;
}
// ---------- 发音入门（tools/course/WORDS.md §4）：<语言>/primer.json → course.json 的 PRIMER（原样，加 v: 1） ----------
// 哪一份和委托 / 今日目击一样（extraFile）：o.primer 给了文件就用它（测试的小样），false 不带；没给时平常用正式的那份，测试（给了 o.lines）不带正式的。
// 配音（主会话 2026-11-22 定，WORDS.md 改动记录）：只有例词（ex[].t，女声）进配音名单，排在小镇后面（零基础的人最先用到）；
// 格子自己的 say（一个假名、一个字母名、一个汉字）不进——单个音提前合成 / 云端合成都念不准（本机合成多出尾音，云端偶尔冒出几秒乱话），
// 游戏里点格子先用手机自带的声音念（game.js 的 sayUnit）。例词的读音（readings.json，gen.py 纠正读法用）用它自己的 r
function buildPrimer(lang, o) {
  const f = extraFile(lang, o, 'primer');
  if (!f || !fs.existsSync(f)) return null;
  const J = readJson(f), voice = [];
  let cells = 0;
  for (const s of Array.isArray(J.sections) ? J.sections : []) {
    for (const it of Array.isArray(s.items) ? s.items : []) {
      if (!it || typeof it !== 'object') continue;
      cells++;
      for (const x of Array.isArray(it.ex) ? it.ex : []) if (x && typeof x.t === 'string' && x.t.trim()) voice.push({ t: x.t, r: rjoin(x.r) });
    }
  }
  return { PRIMER: Object.assign({}, J, { v: 1 }), voice, n: { sections: Array.isArray(J.sections) ? J.sections.length : 0, cells, ex: voice.length } };
}
// ---------- 课前讲解、求助的话（tools/course/WORDS.md §7 §8 §12）：<语言>/lessons.json → course.json 的 LESSONS（原样，加 v: 1） ----------
// 哪一份和发音入门一样（extraFile：o.lessons 给小样、false 不带；给了 lines 的测试不带正式的）。
// 配音：求助的话（help[].t，整句，女声）排在发音入门的例词后面；句型的例句是这一课里原样有的句子，本来就有配音，不另加。
// 读音（readings.json）：日语中文用 help 自己的 r
function buildLessons(lang, o) {
  const f = extraFile(lang, o, 'lessons');
  if (!f || !fs.existsSync(f)) return null;
  const J = readJson(f), voice = [];
  for (const h of Array.isArray(J.help) ? J.help : []) if (h && typeof h.t === 'string' && h.t.trim()) voice.push({ t: h.t, r: lang === 'es' ? undefined : rjoin(h.r) });
  return { LESSONS: Object.assign({}, J, { v: 1 }), voice, n: { help: voice.length, towns: Object.keys(J.towns || {}).length, units: Object.keys(J.units || {}).length } };
}
// 英语的课前讲解和求助的话：tools/course/en/lessons.json → 仓库根目录的 lessons-en.js（window.LESSONS_EN，也是 Node 模块；index.html 加载）。
// 英语课没有课程包，所以单独生成一个文件；求助的话由 tools/voice/collect.js 收去配音。同样的输入逐字节一样
const LESSONS_EN_FILE = path.join(ROOT, 'lessons-en.js'), LESSONS_EN_SRC = path.join(__dirname, 'en', 'lessons.json');
function emitLessonsEn(J) {
  const L = Object.assign({}, J, { v: 1 });
  return [
    '// 英语课的「📘 这一课学什么」（每个小镇的课前讲解）和「🆘 求助的话」（tools/course/WORDS.md 第 7、8、12 条）。',
    '// 别的语言的课在课程包的 course.json 里（LESSONS）；英语课没有课程包，游戏读这里的 window.LESSONS_EN。',
    '// **由 node tools/course/build.js --lessons-en 从 tools/course/en/lessons.json 生成，不要手改**（--lessons-en --check 核对是不是最新的）',
    '(function (root) {',
    '  const LESSONS = ' + JSON.stringify(L) + ';',
    "  if (typeof module !== 'undefined' && module.exports) module.exports = LESSONS;",
    '  else root.LESSONS_EN = LESSONS;',
    "})(typeof window !== 'undefined' ? window : globalThis);",
    '',
  ].join('\n');
}
function buildLessonsEn(o) {
  o = o || {};
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check.js'), 'en', '--lessons', '--quiet'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('tools/course/en/lessons.json 没过 tools/course/check.js：\n' + ((r.stdout || '') + (r.stderr || '')).trim());
  const text = emitLessonsEn(readJson(LESSONS_EN_SRC));
  let cur = null; try { cur = fs.readFileSync(LESSONS_EN_FILE, 'utf8').replace(/\r\n/g, '\n'); } catch (e) { cur = null; }
  const fresh = cur === text;
  if (!o.check && !fresh) fs.writeFileSync(LESSONS_EN_FILE, text);
  return { text, fresh, file: LESSONS_EN_FILE, bytes: Buffer.byteLength(text, 'utf8') };
}
// 怪兽：手册的顺序、选伙伴的三只、学招表（monsters.js）、进化（在沙箱里加载，和 tools/course/lines.js 一样）
function dexInfo() {
  const SB = require('./lines.js').sandbox();
  const DEX = SB.DEX, MG = SB.MonsterGame;
  const all = DEX.all.map((sp, i) => ({ id: sp.id, en: sp.en, types: sp.types, no: i, sp }));
  const byId = new Map(all.map(x => [x.id, x]));
  const mvName = id => { const m = MG.parseMove(id); return m.sup ? m.sup.en : ((DEX.MOVES[m.type] || [])[m.tier] || [])[0]; };
  return {
    all, names: new Set(all.map(x => x.en)), starters: MG.STARTERS.map(id => byId.get(id)).filter(Boolean),
    learn: x => [...new Set(MG.learnset(x.sp).map(([, id]) => mvName(id)).filter(Boolean))],
    evo: x => (x.sp.evo || []).map(e => byId.get(e.to)).filter(Boolean),
  };
}

function buildCourse(lang, o) {
  if (!LANGS.includes(lang)) throw new Error('语言要写 es / ja / zh');
  const src = loadSources(lang), isl = readIslands(), V = voiceList();
  const LN = buildLines(lang, linesFile(lang, o));
  const EX = buildExtra(lang, o);
  const PR = buildPrimer(lang, o);
  const LS = buildLessons(lang, o);
  if (!Array.isArray(src.towns) || src.towns.length !== 13) throw new Error('towns.json 要 13 个小镇');
  const cn = lang === 'zh';

  // ----- 小镇：WORLDS、SCENES，配音按岛排在最前面 -----
  const WORLDS = [], SCENES = [];
  src.towns.forEach((t, i) => {
    const d = isl[i];
    WORLDS.push({
      name: d.name, en: t.t, icon: d.icon, color: d.color,
      boss: { emoji: d.boss.emoji, name: d.boss.name, en: d.boss.en, hello: t.boss.t, x: pickX({ r: t.boss.r, zh: t.boss.zh || '', en: t.boss.en }, ['r', 'zh', 'en']) },
      words: t.words.map(word), sents: t.sents.map(sent), dlgs: t.dlgs.map(dlg),
    });
    // bg / set：小剧场的背景（game.js renderTheater 读）按这座岛原来的；标题和地点不写，界面自己用岛名
    SCENES.push({
      bg: d.bg, set: d.set, cast: t.scene.cast,
      lines: t.scene.lines.map(l => [l.who, l.t, l.zh || '', pickX(l, ['en', 'r'])]),
    });
    V.add(t.t, ['f']);
    V.add(t.boss.t, ['f', 'm'], rjoin(t.boss.r));
    t.words.forEach(e => V.add(e.t, ['f'], rjoin(e.r)));
    t.sents.forEach(e => V.add(e.t, ['f'], rjoin(e.r)));
    t.dlgs.forEach(x => { V.add(x.q.t, ['f', 'm'], rjoin(x.q.r)); V.add(x.a.t, ['f', 'm'], rjoin(x.a.r)); x.wrong.forEach(w => V.add(w.t, ['f', 'm'], rjoin(w.r))); });
    t.scene.lines.forEach(l => V.add(l.t, [t.scene.cast[l.who][2] === 'm' ? 'm' : 'f'], rjoin(l.r)));
  });
  // 发音入门（WORDS.md §4）：排在小镇后面（零基础的人最先用到；第 0 岛还是最前面）
  if (PR) PR.voice.forEach(e => V.add(norm(e.t), ['f'], e.r));
  // 求助的话（WORDS.md §8）：紧接着发音入门（学完发音马上学这几句）
  if (LS) LS.voice.forEach(e => V.add(norm(e.t), ['f'], e.r));
  // 台词翻译表：开场和第 1 组岛的剧情、选伙伴、拿到道具、地名排在小镇后面（一开始就用到），别的排在课本后面
  // （配音念的字不带表情符号：和英语一样按 key.js 的 norm，key 本来就不算表情）
  if (LN) LN.voice.early.forEach(e => V.add(norm(e.t), e.g, e.r));

  // ----- 课本：BOOKS、TALK，配音按册、按单元 -----
  const list = [], TALK = [], mapBooks = {};
  for (const { syl, units } of src.books) {
    const short = syl.level + ' 级';
    mapBooks[syl.id] = syl.level;
    list.push({
      id: syl.id, level: syl.level, name: syl.name.zh, short, x: { en: { name: syl.name.en, short: 'L' + syl.level } },
      units: units.map(u => {
        const tk = u.talk;
        V.add(u.boss.t, ['f', 'm'], rjoin(u.boss.r));
        u.words.forEach(e => V.add(e.t, ['f'], rjoin(e.r)));
        u.sents.forEach(e => V.add(e.t, ['f'], rjoin(e.r)));
        u.dlgs.forEach(x => { V.add(x.q.t, ['f', 'm'], rjoin(x.q.r)); V.add(x.a.t, ['f', 'm'], rjoin(x.a.r)); x.wrong.forEach(w => V.add(w.t, ['f', 'm'], rjoin(w.r))); });
        V.add(tk.opener.t, [tk.gender === 'm' ? 'm' : 'f'], rjoin(tk.opener.r));
        TALK.push({
          id: u.book + '-u' + u.n, book: u.book, unit: u.n, name: tk.name, zh: tk.zh || tk.name, gender: tk.gender, kid: !!tk.kid,
          topic: tk.topic.en, topicZh: tk.topic.zh, goal: tk.goal.en, goalZh: tk.goal.zh, persona: tk.persona, opener: tk.opener.t,
          words: tk.words.map(w => w.t), wordsZh: tk.words.map(w => w.zh || ''), wordsEn: tk.words.map(w => w.en),
          goals: [{ goal: tk.goal.en, goalZh: tk.goal.zh, opener: tk.opener.t, steps: tk.steps.map(s => [s.zh, s.t, { en: s.en }]) }],
        });
        return {
          n: u.n,
          // name：中文界面显示的单元名（game.js unitTxt 读 u.name）；中文课没有中文标题，用原文
          name: short + ' Unit ' + u.n + ' ' + (u.zh || u.t),
          en: u.t, zh: u.zh || '', icon: u.icon, color: u.color, key: u.key.t,
          grammar: { title: u.grammar.title.zh, tip: u.grammar.tip.zh, en: { title: u.grammar.title.en, tip: u.grammar.tip.en } },
          boss: { emoji: u.boss.emoji, name: u.boss.name.zh, en: u.boss.name.en, hello: u.boss.t, x: pickX({ r: u.boss.r, zh: u.boss.zh || '', en: u.boss.en }, ['r', 'zh', 'en']) },
          words: u.words.map(word), sents: u.sents.map(sent), dlgs: u.dlgs.map(dlg),
          x: { en: u.en, key: pickX({ r: u.key.r, zh: u.key.zh || '', en: u.key.en }, ['r', 'zh', 'en']) },
        };
      }),
    });
  }

  // 委托的请求 / 旁白 / 感谢、今日目击的线索：排在课本后面、别的岛的剧情前面（和英语的配音一个先后：课本 → 委托 → 目击 → 对战）
  EX.voice.forEach(e => V.add(norm(e.t), e.g, e.r));
  // 别的岛的剧情 → 对战喊话（按手册编号）→ 手册介绍
  if (LN) [LN.voice.late, LN.voice.mon, LN.voice.dex].forEach(a => a.forEach(e => V.add(norm(e.t), e.g, e.r)));
  const course = {
    fmt: 1, lang, name: src.syl.name,
    WORLDS, SCENES, BOOKS: { list }, TALK,
    MAP: { towns: 1, books: mapBooks, mix: MAP_MIX, kinds: MAP_KINDS },
  };
  // 有台词翻译表才有这三样（没有的时候 course.json 和以前一字不差）
  if (LN) Object.assign(course, LN.course);
  // 委托、目击的固定台词并进 LINES（键是英语原文）；和已有的键撞了：译文一样就算了，不一样要报错。没有台词翻译表时 LINES 里就只有它们
  const extra = Object.keys(EX.LINES);
  if (extra.length) {
    course.LINES = course.LINES || {};
    for (const en of extra) {
      if (!own(course.LINES, en)) { course.LINES[en] = EX.LINES[en]; continue; }
      const a = textOf(course.LINES[en]), b = textOf(EX.LINES[en]);
      if (a !== b) throw new Error('「' + en + '」在台词翻译表和委托 / 今日目击的译文里不一样（' + a + ' ≠ ' + b + '）：改成一样的再生成');
    }
  }
  // 有委托的译文才有 QUESTS（聊天页显示用：开场白、每一步的示范句、词卡）
  if (EX.QUESTS) course.QUESTS = EX.QUESTS;
  // 有 primer.json 才有 PRIMER（发音入门的页面：原样 + v: 1；没有的时候 course.json 和以前一字不差）
  if (PR) course.PRIMER = PR.PRIMER;
  // 有 lessons.json 才有 LESSONS（课前讲解、求助的话：原样 + v: 1）
  if (LS) course.LESSONS = LS.LESSONS;
  course.VOICE = V.fin();
  READINGS = V.rd();
  EXTRA = Object.assign({}, EX.n, { primer: PR ? PR.n : null, lessons: LS ? LS.n : null });
  return course;
}

// 每句配音的读音 { norm(t): 读音 }（course.json 里不放；tools/voice/gen.py --readings 读，纠正日语的读法）
let READINGS = {};
// 最近一次 buildCourse 带了几条委托、几句线索（course.json 里线索和别的台词混在 LINES 里，数不出来）
let EXTRA = { quests: 0, sight: 0 };
function readings(lang, o) { buildCourse(lang, o); return READINGS; }

function stats(c) {
  const units = c.BOOKS.list.reduce((s, b) => s + b.units.length, 0);
  const g = { f: 0, m: 0 };
  for (const e of c.VOICE) for (const x of e.g) g[x]++;
  const chars = c.VOICE.reduce((s, e) => s + [...e.t].length, 0);
  const lines = c.LINES ? Object.keys(c.LINES).length : 0, tpl = c.LINES_T ? c.LINES_T.length : 0, terms = c.TERMS ? Object.values(c.TERMS).reduce((s, m) => s + Object.keys(m).length, 0) : 0;
  return { towns: c.WORLDS.length, scenes: c.SCENES.length, books: c.BOOKS.list.length, units, talk: c.TALK.length, voice: c.VOICE.length, clips: g.f + g.m, f: g.f, m: g.m, chars, lines, tpl, terms,
    quests: c.QUESTS ? Object.keys(c.QUESTS).length : 0 };
}

function build(lang, o) {
  o = o || {};
  const v = validate(lang);
  if (!v.ok) throw new Error('课程源文件没过 tools/course/check.js，先改好再生成：\n' + v.out.trim());
  // 另外给的台词翻译表（测试的小样）：一样先过检查
  if (o.lines) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'check.js'), lang, '--lines', path.resolve(o.lines), '--quiet'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('台词翻译表没过 tools/course/check.js：\n' + ((r.stdout || '') + (r.stderr || '')).trim());
  }
  // 另外给的委托 / 今日目击的译文、发音入门、课前讲解（测试的小样）：也先过检查（小样可以不全，缺的只提醒）
  const WHAT = { quests: '委托的译文', sight: '今日目击的译文', primer: '发音入门', lessons: '课前讲解' };
  for (const k of Object.keys(WHAT)) {
    if (!o[k]) continue;
    const r = spawnSync(process.execPath, [path.join(__dirname, 'check.js'), lang, '--' + k, path.resolve(o[k]), '--quiet'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(WHAT[k] + '没过 tools/course/check.js：\n' + ((r.stdout || '') + (r.stderr || '')).trim());
  }
  const course = buildCourse(lang, o);
  const data = Buffer.from(JSON.stringify(course) + '\n', 'utf8');
  let file = '';
  if (!o.check) {
    const dir = path.join(path.resolve(o.out || path.join(ROOT, 'dist', 'course')), lang);
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'course.json');
    fs.writeFileSync(file, data);
    // 每句配音的读音表放在 course.json 旁边（不进课程包）：tools/voice/gen.py 读它，让日语 TTS 念课程写的读音
    fs.writeFileSync(path.join(dir, 'readings.json'), JSON.stringify(READINGS));
  }
  return { course, bytes: data.length, file, stats: Object.assign(stats(course), { sight: EXTRA.sight, primer: EXTRA.primer, lessons: EXTRA.lessons }) };
}

// ---------- 聊天角色表 talk-courses.js（tools/course/TALK.md §1） ----------
// 三门语言的 TALK 合成一份（先西语、再日语、再中文，各按单元的先后）。每条 = course.json 里 TALK 的那一条原样，id 后面多一个 lang
const TALK_FILE = path.join(ROOT, 'talk-courses.js');
function talkCourses() {
  const keep = READINGS, list = [];
  try {
    for (const lang of LANGS) for (const t of buildCourse(lang, { lines: false }).TALK) list.push(Object.assign({ id: t.id, lang }, t));
  } finally { READINGS = keep; }   // buildCourse 会顺手改读音表：这里只要 TALK，改回去
  const ids = new Set();
  for (const n of list) { if (ids.has(n.id)) throw new Error('聊天角色的 id 重复了：' + n.id); ids.add(n.id); }
  return list;
}
// 别的语言的课里的委托（TALK.md 第二轮）：每门语言 { 委托 id: { opener, steps: [示范句…], words: [词…] } }，纯文字——
// 服务器拼人设用（talk-core.js 的 questNpc(q, lang, 这一条)；人设和事实还是 quests.js 的英文原文）。
// 每条另有 names（名字表 [[英语名, 这门语言的写法]…]，见 questNames；一个名字都没配上的那条没有这个键）。
// questsPlain(语言, 文件, o)：文件不给 = 这门语言正式的 tools/course/<语言>/quests.json（没有这个文件 = null）；测试给小样的文件。
//   o.lines：名字表查哪份台词翻译表（不给 = 正式的 lines.json，false = 不要名字表，文件 = 小样）
function questsPlain(lang, file, o) {
  const keep = RJ;
  try { return buildExtra(lang, { quests: file === undefined ? path.join(__dirname, lang, 'quests.json') : file || false, sight: false, lines: o ? o.lines : undefined }).plain; } finally { RJ = keep; }
}
// talkQuests(files, o)：三门语言合起来 { es: {…}, ja: {…}, zh: {…} }，只有有委托译文的语言。files（测试用）：{ 语言: 小样文件 }，不给 = 正式的；o 同上
function talkQuests(files, o) {
  const out = {};
  for (const lang of LANGS) {
    const p = questsPlain(lang, files ? files[lang] || false : undefined, o);
    if (p && Object.keys(p).length) out[lang] = p;
  }
  return out;
}
// 文件的样子和 talk-npcs.js 一样：浏览器里 window.TALK_COURSES、Node 里 module.exports（esbuild 当 CommonJS 打包），加载时不碰 DOM。
// 一个角色一行、一条委托一行；同样的源文件生成出来逐字节一样。quests 不给 = 正式的那几份（talkQuests()）
function emitTalk(list, quests) {
  if (quests === undefined) quests = talkQuests();
  const langs = LANGS.filter(l => list.some(n => n.lang === l)), ql = LANGS.filter(l => own(quests, l) && Object.keys(quests[l]).length);
  return [
    '// 别的语言的课（西语 / 日语 / 中文）里能聊天的角色（AI 语音对话）。中转服务 server/relay.js 和公开版服务器 cloud/ 按 id 查这一份：',
    '// 手机只发角色的 id，人设、目标、小步骤由服务器从这里读（和英语的 talk-npcs.js 一个道理），手机发来的人设一概不用。',
    '// 每个角色 = 课程包 course.json 里 TALK 的那一条原样，外加 lang（哪门语言）；音色由 talk-core.js 按语言挑（voiceFor）。',
    '// 游戏界面不加载这份文件（界面用课程包里的 TALK，两份是同一个源文件生成的）。',
    '// quests：别的语言的课里的支线委托 { 语言: { 委托 id: { opener 开场白, steps 每一步的示范句, words 有用的词, names 名字表（可以没有） } } }（纯文字；',
    '// 人设、事实、目标还是 quests.js 的英文原文，talk-core.js 的 questNpc(q, lang, 这一条) 拼）。哪门语言还没有委托的译文，这里就没有它。',
    '// names：[[英语名, 这门语言的写法]…]——这条委托的英文原文里出现的、这门课 lines.json 的 terms 里定了写法的名字（岛民照着说，不各译各的）。',
    '// **由 node tools/course/build.js --talk 从 tools/course/<语言>/units/*.json 的 talk、tools/course/<语言>/quests.json 和 lines.json 的 terms 生成，不要手改**（--talk --check 核对是不是最新的）',
    '(function (root) {',
    '  const LIST = [',
  ].concat(list.map(n => '    ' + JSON.stringify(n) + ','), [
    '  ];',
    '  const QUESTS = {',
  ], ...ql.map(l => ['    ' + JSON.stringify(l) + ': {'].concat(Object.keys(quests[l]).map(id => '      ' + JSON.stringify(id) + ': ' + JSON.stringify(quests[l][id]) + ','), ['    },'])), [
    '  };',
    '  const api = { langs: ' + JSON.stringify(langs) + ', list: LIST, byId: Object.fromEntries(LIST.map(n => [n.id, n])), quests: QUESTS };',
    "  if (typeof module !== 'undefined' && module.exports) module.exports = api;",
    '  else root.TALK_COURSES = api;',
    "})(typeof window !== 'undefined' ? window : globalThis);",
    '',
  ]).join('\n');
}
// 仓库里那份是不是最新的（换行按 \n 比）
function talkFresh(text) {
  let cur = null;
  try { cur = fs.readFileSync(TALK_FILE, 'utf8'); } catch (e) { cur = null; }
  return cur != null && cur.replace(/\r\n/g, '\n') === (text == null ? emitTalk(talkCourses(), talkQuests()) : text);
}
// 生成（或者只核对）：先过一遍 check.js，源文件有错不生成
function buildTalk(o) {
  o = o || {};
  for (const lang of LANGS) {
    const v = validate(lang);
    if (!v.ok) throw new Error('课程源文件没过 tools/course/check.js，先改好再生成：\n' + v.out.trim());
  }
  const list = talkCourses(), quests = talkQuests(), text = emitTalk(list, quests), fresh = talkFresh(text);
  if (!o.check && !fresh) fs.writeFileSync(TALK_FILE, text);
  return { list, quests, text, fresh, file: TALK_FILE, bytes: Buffer.byteLength(text, 'utf8') };
}

if (require.main === module && process.argv.includes('--lessons-en')) {
  try {
    const a = process.argv.slice(2), bad = a.filter(x => x !== '--lessons-en' && x !== '--check');
    if (bad.length) { console.error('用法：node tools/course/build.js --lessons-en [--check]'); process.exit(2); }
    const check = a.includes('--check'), r = buildLessonsEn({ check });
    if (check && !r.fresh) { console.error('✗ lessons-en.js 不是最新的（tools/course/en/lessons.json 改过）：跑 node tools/course/build.js --lessons-en'); process.exit(1); }
    console.log((check ? '✓ lessons-en.js 是最新的' : r.fresh ? '✓ lessons-en.js 本来就是最新的（没写文件）' : 'lessons → lessons-en.js') + '：' + r.bytes + ' 字节（改了求助的话要再跑 node tools/voice/collect.js 配音）');
  } catch (e) { console.error('course: ' + e.message); process.exit(1); }
} else if (require.main === module && process.argv.includes('--talk')) {
  try {
    const a = process.argv.slice(2), bad = a.filter(x => x !== '--talk' && x !== '--check');
    if (bad.length) { console.error('用法：node tools/course/build.js --talk [--check]'); process.exit(2); }
    const check = a.includes('--check'), r = buildTalk({ check });
    const n = LANGS.map(l => l + ' ' + r.list.filter(x => x.lang === l).length).join('、');
    const nq = LANGS.filter(l => r.quests[l]).map(l => l + ' ' + Object.keys(r.quests[l]).length).join('、');
    if (check && !r.fresh) { console.error('✗ talk-courses.js 不是最新的（聊天角色或者委托的译文改过）：跑 node tools/course/build.js --talk'); process.exit(1); }
    console.log((check ? '✓ talk-courses.js 是最新的' : r.fresh ? '✓ talk-courses.js 本来就是最新的（没写文件）' : 'talk → talk-courses.js') + '：' + r.list.length + ' 个聊天角色（' + n + '）、委托的译文' + (nq ? '（' + nq + '）' : '还没有') + '；' + r.bytes + ' 字节');
  } catch (e) { console.error('course: ' + e.message); process.exit(1); }
} else if (require.main === module) {
  try {
    const a = process.argv.slice(2), lang = a[0];
    if (!LANGS.includes(lang)) { console.error('用法：node tools/course/build.js <es|ja|zh> [--check] [--out dist/course] [--readings 读音表.json] [--lines 小样.json] [--quests 小样.json] [--sight 小样.json] [--primer 小样.json]\n      node tools/course/build.js --talk [--check]   （聊天角色表 talk-courses.js）'); process.exit(2); }
    const o = { check: false, out: '' };
    for (let i = 1; i < a.length; i++) {
      if (a[i] === '--check') o.check = true;
      else if (a[i] === '--out') { o.out = a[++i]; if (!o.out) throw new Error('--out 后面要跟一个目录'); }
      else if (a[i] === '--readings') { o.readings = a[++i]; if (!o.readings) throw new Error('--readings 后面要跟一个文件'); }
      else if (a[i] === '--lines') { o.lines = a[++i]; if (!o.lines) throw new Error('--lines 后面要跟一个 lines.json'); }
      else if (a[i] === '--quests') { o.quests = a[++i]; if (!o.quests) throw new Error('--quests 后面要跟一个 quests.json'); }
      else if (a[i] === '--sight') { o.sight = a[++i]; if (!o.sight) throw new Error('--sight 后面要跟一个 sight.json'); }
      else if (a[i] === '--primer') { o.primer = a[++i]; if (!o.primer) throw new Error('--primer 后面要跟一个 primer.json'); }
      else if (a[i] === '--lessons') { o.lessons = a[++i]; if (!o.lessons) throw new Error('--lessons 后面要跟一个 lessons.json'); }
      else throw new Error('不认识的参数 ' + a[i]);
    }
    const r = build(lang, o), s = r.stats;
    if (o.readings) { fs.mkdirSync(path.dirname(path.resolve(o.readings)), { recursive: true }); fs.writeFileSync(path.resolve(o.readings), JSON.stringify(READINGS)); console.log('  读音表 ' + Object.keys(READINGS).length + ' 句 → ' + o.readings); }
    console.log((o.check ? '✓ ' + lang + ' 检查过了（没写文件）' : 'course ' + lang + ' → ' + path.relative(ROOT, r.file).replace(/\\/g, '/')) + '：' + s.towns + ' 个小镇、' + s.scenes + ' 段小剧场、' +
      s.books + ' 册 ' + s.units + ' 个单元、' + s.talk + ' 个聊天角色；' + r.bytes + ' 字节');
    if (r.course.LINES) console.log('  台词翻译表：整句 ' + s.lines + '、模板 ' + s.tpl + '、词 ' + s.terms);
    if (s.quests || s.sight) console.log('  支线委托的译文 ' + s.quests + ' 条、今日目击的线索 ' + s.sight + ' 句（请求 / 感谢 / 线索都算在上面的整句里）');
    if (s.lessons) console.log('  课前讲解 LESSONS：小镇 ' + s.lessons.towns + '、单元 ' + s.lessons.units + '；求助的话 ' + s.lessons.help + ' 句（进了配音名单）');
    if (s.primer) console.log('  发音入门 PRIMER：' + s.primer.sections + ' 段、' + s.primer.cells + ' 格、例词配音 ' + s.primer.ex + ' 句（格子自己的 say 用本机声音念，不配音）');
    console.log('  配音 ' + s.voice + ' 句 → ' + s.clips + ' 段（女声 ' + s.f + '、男声 ' + s.m + '），一共 ' + s.chars + ' 个字符');
    // 顺手核对聊天角色表（服务器按它拼人设）：不是最新只提醒，不拦
    let fresh = true;
    try { fresh = talkFresh(); } catch (e) { fresh = true; }
    if (!fresh) console.log('  提醒：talk-courses.js 不是最新的（聊天角色改过，服务器还在用老的人设）：跑 node tools/course/build.js --talk');
  } catch (e) { console.error('course: ' + e.message); process.exit(1); }
}
module.exports = { build, buildCourse, readings, validate, stats, LANGS, talkCourses, talkQuests, questsPlain, questNames, emitTalk, talkFresh, buildTalk, TALK_FILE, buildLessonsEn, emitLessonsEn, LESSONS_EN_FILE };
