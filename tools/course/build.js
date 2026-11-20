// 把课程源文件（tools/course/<语言>/）生成课程包里的 course.json（格式见 tools/course/SPEC.md §6）
//   node tools/course/build.js <es|ja|zh> [--check] [--out dist/course]
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
  const by = new Map(), out = [];
  const add = (t, gs) => {
    if (typeof t !== 'string' || !t.trim()) return;
    const k = norm(t);
    if (!k) return;
    let e = by.get(k);
    if (!e) { e = { t: t, g: [], p: out.length }; by.set(k, e); out.push(e); }
    for (const g of gs) if (!e.g.includes(g)) e.g.push(g);
  };
  const fin = () => out.map(e => ({ t: e.t, g: ['f', 'm'].filter(g => e.g.includes(g)), p: e.p }));
  return { add, fin };
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

function buildCourse(lang) {
  if (!LANGS.includes(lang)) throw new Error('语言要写 es / ja / zh');
  const src = loadSources(lang), isl = readIslands(), V = voiceList();
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
    V.add(t.boss.t, ['f', 'm']);
    t.words.forEach(e => V.add(e.t, ['f']));
    t.sents.forEach(e => V.add(e.t, ['f']));
    t.dlgs.forEach(x => { V.add(x.q.t, ['f', 'm']); V.add(x.a.t, ['f', 'm']); x.wrong.forEach(w => V.add(w.t, ['f', 'm'])); });
    t.scene.lines.forEach(l => V.add(l.t, [t.scene.cast[l.who][2] === 'm' ? 'm' : 'f']));
  });

  // ----- 课本：BOOKS、TALK，配音按册、按单元 -----
  const list = [], TALK = [], mapBooks = {};
  for (const { syl, units } of src.books) {
    const short = syl.level + ' 级';
    mapBooks[syl.id] = syl.level;
    list.push({
      id: syl.id, level: syl.level, name: syl.name.zh, short, x: { en: { name: syl.name.en, short: 'L' + syl.level } },
      units: units.map(u => {
        const tk = u.talk;
        V.add(u.boss.t, ['f', 'm']);
        u.words.forEach(e => V.add(e.t, ['f']));
        u.sents.forEach(e => V.add(e.t, ['f']));
        u.dlgs.forEach(x => { V.add(x.q.t, ['f', 'm']); V.add(x.a.t, ['f', 'm']); x.wrong.forEach(w => V.add(w.t, ['f', 'm'])); });
        V.add(tk.opener.t, [tk.gender === 'm' ? 'm' : 'f']);
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

  return {
    fmt: 1, lang, name: src.syl.name,
    WORLDS, SCENES, BOOKS: { list }, TALK,
    MAP: { towns: 1, books: mapBooks, mix: MAP_MIX, kinds: MAP_KINDS },
    VOICE: V.fin(),
  };
}

function stats(c) {
  const units = c.BOOKS.list.reduce((s, b) => s + b.units.length, 0);
  const g = { f: 0, m: 0 };
  for (const e of c.VOICE) for (const x of e.g) g[x]++;
  const chars = c.VOICE.reduce((s, e) => s + [...e.t].length, 0);
  return { towns: c.WORLDS.length, scenes: c.SCENES.length, books: c.BOOKS.list.length, units, talk: c.TALK.length, voice: c.VOICE.length, clips: g.f + g.m, f: g.f, m: g.m, chars };
}

function build(lang, o) {
  o = o || {};
  const v = validate(lang);
  if (!v.ok) throw new Error('课程源文件没过 tools/course/check.js，先改好再生成：\n' + v.out.trim());
  const course = buildCourse(lang);
  const data = Buffer.from(JSON.stringify(course) + '\n', 'utf8');
  let file = '';
  if (!o.check) {
    const dir = path.join(path.resolve(o.out || path.join(ROOT, 'dist', 'course')), lang);
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'course.json');
    fs.writeFileSync(file, data);
  }
  return { course, bytes: data.length, file, stats: stats(course) };
}

if (require.main === module) {
  try {
    const a = process.argv.slice(2), lang = a[0];
    if (!LANGS.includes(lang)) { console.error('用法：node tools/course/build.js <es|ja|zh> [--check] [--out dist/course]'); process.exit(2); }
    const o = { check: false, out: '' };
    for (let i = 1; i < a.length; i++) {
      if (a[i] === '--check') o.check = true;
      else if (a[i] === '--out') { o.out = a[++i]; if (!o.out) throw new Error('--out 后面要跟一个目录'); }
      else throw new Error('不认识的参数 ' + a[i]);
    }
    const r = build(lang, o), s = r.stats;
    console.log((o.check ? '✓ ' + lang + ' 检查过了（没写文件）' : 'course ' + lang + ' → ' + path.relative(ROOT, r.file).replace(/\\/g, '/')) + '：' + s.towns + ' 个小镇、' + s.scenes + ' 段小剧场、' +
      s.books + ' 册 ' + s.units + ' 个单元、' + s.talk + ' 个聊天角色；' + r.bytes + ' 字节');
    console.log('  配音 ' + s.voice + ' 句 → ' + s.clips + ' 段（女声 ' + s.f + '、男声 ' + s.m + '），一共 ' + s.chars + ' 个字符');
  } catch (e) { console.error('course: ' + e.message); process.exit(1); }
}
module.exports = { build, buildCourse, validate, stats, LANGS };
