// 把课程源文件（tools/course/<语言>/）生成课程包里的 course.json（格式见 tools/course/SPEC.md §6）
//   node tools/course/build.js <es|ja|zh> [--check] [--out dist/course] [--lines 别的 lines.json]
//   有 tools/course/<语言>/lines.json（台词翻译表，SPEC §8）就并进 LINES / LINES_T / TERMS 和配音名单；--lines 换一份（测试的小样），build(lang, { lines: false }) 不带
//   → <out>/<语言>/course.json：WORLDS / SCENES / BOOKS / TALK / MAP / VOICE，形状和 data.js、book.js 的数组一样，
//     多出来的读音、词块、英文意思放在每条最后那个对象里（game.js 的 meanOf 读它）。
//   先跑一遍 tools/course/check.js（同一份检查），有一处错就不生成。--check 只检查、不写。
//   同一份输入生成的文件逐字节一样（不写时间、不依赖文件系统的顺序）。只有 8 个单元文件齐全的册才进 BOOKS。
// 配音：VOICE 是这门课所有要提前配音的句子 { t, g, p }（t 是目标语言原文，不是读音；g 是声音 f / m；p 是先后：
//   小镇在前、按岛，再按册、按单元），同一句（按 key.js 的 norm 算）只出现一次，g 合并。gen.py 和 tools/pack/build.js 读它。
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
function buildLines(lang, file) {
  RJ = lang === 'zh' ? ' ' : '';
  if (!file || !fs.existsSync(file)) return null;
  const SRC = readJson(path.join(__dirname, 'lines-src.json')), J = readJson(file);
  const PK = require(path.join(ROOT, 'packs.js'))._;
  const kana = lang !== 'es';
  // 译文：西语写成字符串（没有 g 的话），日语 / 中文 { t, seg, r }
  // 整句可以另写自己的意思 zh / en（译文改写过、原来的意思对不上时，SPEC §8.2），原样带上
  const out = x => {
    const v = typeof x === 'string' ? { t: x } : x;
    const gl = o => { for (const k of ['zh', 'en']) if (typeof v[k] === 'string' && v[k]) o[k] = v[k]; return o; };
    if (!kana) return v.g || v.zh || v.en ? gl(v.g ? { t: v.t, g: v.g } : { t: v.t }) : v.t;
    const o = { t: v.t };
    if (Array.isArray(v.seg)) o.seg = v.seg;
    if (v.r != null) o.r = v.r;
    return gl(o);
  };
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

  // 别的岛的剧情 → 对战喊话（按手册编号）→ 手册介绍
  if (LN) [LN.voice.late, LN.voice.mon, LN.voice.dex].forEach(a => a.forEach(e => V.add(norm(e.t), e.g, e.r)));
  const course = {
    fmt: 1, lang, name: src.syl.name,
    WORLDS, SCENES, BOOKS: { list }, TALK,
    MAP: { towns: 1, books: mapBooks, mix: MAP_MIX, kinds: MAP_KINDS },
  };
  // 有台词翻译表才有这三样（没有的时候 course.json 和以前一字不差）
  if (LN) Object.assign(course, LN.course);
  course.VOICE = V.fin();
  READINGS = V.rd();
  return course;
}

// 每句配音的读音 { norm(t): 读音 }（course.json 里不放；tools/voice/gen.py --readings 读，纠正日语的读法）
let READINGS = {};
function readings(lang, o) { buildCourse(lang, o); return READINGS; }

function stats(c) {
  const units = c.BOOKS.list.reduce((s, b) => s + b.units.length, 0);
  const g = { f: 0, m: 0 };
  for (const e of c.VOICE) for (const x of e.g) g[x]++;
  const chars = c.VOICE.reduce((s, e) => s + [...e.t].length, 0);
  const lines = c.LINES ? Object.keys(c.LINES).length : 0, tpl = c.LINES_T ? c.LINES_T.length : 0, terms = c.TERMS ? Object.values(c.TERMS).reduce((s, m) => s + Object.keys(m).length, 0) : 0;
  return { towns: c.WORLDS.length, scenes: c.SCENES.length, books: c.BOOKS.list.length, units, talk: c.TALK.length, voice: c.VOICE.length, clips: g.f + g.m, f: g.f, m: g.m, chars, lines, tpl, terms };
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
  return { course, bytes: data.length, file, stats: stats(course) };
}

if (require.main === module) {
  try {
    const a = process.argv.slice(2), lang = a[0];
    if (!LANGS.includes(lang)) { console.error('用法：node tools/course/build.js <es|ja|zh> [--check] [--out dist/course] [--readings 读音表.json]'); process.exit(2); }
    const o = { check: false, out: '' };
    for (let i = 1; i < a.length; i++) {
      if (a[i] === '--check') o.check = true;
      else if (a[i] === '--out') { o.out = a[++i]; if (!o.out) throw new Error('--out 后面要跟一个目录'); }
      else if (a[i] === '--readings') { o.readings = a[++i]; if (!o.readings) throw new Error('--readings 后面要跟一个文件'); }
      else if (a[i] === '--lines') { o.lines = a[++i]; if (!o.lines) throw new Error('--lines 后面要跟一个 lines.json'); }
      else throw new Error('不认识的参数 ' + a[i]);
    }
    const r = build(lang, o), s = r.stats;
    if (o.readings) { fs.mkdirSync(path.dirname(path.resolve(o.readings)), { recursive: true }); fs.writeFileSync(path.resolve(o.readings), JSON.stringify(READINGS)); console.log('  读音表 ' + Object.keys(READINGS).length + ' 句 → ' + o.readings); }
    console.log((o.check ? '✓ ' + lang + ' 检查过了（没写文件）' : 'course ' + lang + ' → ' + path.relative(ROOT, r.file).replace(/\\/g, '/')) + '：' + s.towns + ' 个小镇、' + s.scenes + ' 段小剧场、' +
      s.books + ' 册 ' + s.units + ' 个单元、' + s.talk + ' 个聊天角色；' + r.bytes + ' 字节');
    if (r.course.LINES) console.log('  台词翻译表：整句 ' + s.lines + '、模板 ' + s.tpl + '、词 ' + s.terms);
    console.log('  配音 ' + s.voice + ' 句 → ' + s.clips + ' 段（女声 ' + s.f + '、男声 ' + s.m + '），一共 ' + s.chars + ' 个字符');
  } catch (e) { console.error('course: ' + e.message); process.exit(1); }
}
module.exports = { build, buildCourse, readings, validate, stats, LANGS };
