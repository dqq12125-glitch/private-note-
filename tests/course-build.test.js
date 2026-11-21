// 课程包生成：不开浏览器（几秒）：node tests/course-build.test.js
// tools/course/build.js 把 es / ja / zh 三门课的源文件生成 course.json（tools/course/SPEC.md §6）：
// 1. 三门都生成到临时目录：形状（WORLDS / SCENES / BOOKS / TALK / MAP / VOICE）、个数、小镇的岛名图标颜色岛主照 data.js
// 2. 每条单词 / 句子 / 对话的最后一个对象：en 都在；ja / zh 有 r、句子的 seg 接起来等于原文、r 和 seg 一样多；es 没有 r 和 seg
// 3. VOICE：每句都是 { t, g, p }，p 从 0 连着、不重复，同一个（文字，声音）只出现一次（按 key 算），念的是原文 t（不是读音）；
//    课里每个词、句子、对话、岛主的话、小剧场、聊天开场白都在名单里
// 4. 同一份输入生成两次，文件逐字节一样；--check 不写文件；检查不过的源文件拒绝生成
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const { key, norm } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + JSON.stringify(more).slice(0, 800) : '')); if (!ok) fails++; return ok; };
const throws = f => { try { f(); return ''; } catch (e) { return e.message || String(e); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-course-'));
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-course-'));
const NODE = process.execPath;
const talkOf = {};   // 每门语言 course.json 里的 TALK（下面核对 talk-courses.js 用）
try {
  for (const lang of CB.LANGS) {
    console.log('\n— ' + lang + ' —');
    const r = CB.build(lang, { out: tmp });
    const file = path.join(tmp, lang, 'course.json');
    check(r.file === file && fs.existsSync(file), 'build 写出 <out>/' + lang + '/course.json（' + r.bytes + ' 字节）');
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    const syl = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', lang, 'syllabus.json'), 'utf8'));

    // ---- 1. 形状和个数 ----
    check(c.fmt === 1 && c.lang === lang && JSON.stringify(c.name) === JSON.stringify(syl.name), 'fmt、lang、name 照大纲');
    // 有正式的台词翻译表（tools/course/<语言>/lines.json）时 MAP 后面多 LINES / LINES_T / TERMS（下面「台词翻译表」那一段专门测）
    // 第二轮：有正式的委托译文（quests.json）时 VOICE 前面多 QUESTS；只有 quests.json / sight.json、没有 lines.json 时 LINES 也有（下面「委托和今日目击」那一段专门测）
    const LN3 = ['LINES', 'LINES_T', 'TERMS'], has = f => fs.existsSync(path.join(ROOT, 'tools', 'course', lang, f));
    check(Object.keys(c).filter(k => !LN3.includes(k) && k !== 'QUESTS').join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,VOICE' && (has('lines.json') ? LN3.every(k => k in c) : !['LINES_T', 'TERMS'].some(k => k in c)) &&
      ('QUESTS' in c) === has('quests.json') && (has('lines.json') || has('quests.json') || has('sight.json') || !('LINES' in c)),
      '顶层字段：fmt lang name WORLDS SCENES BOOKS TALK MAP VOICE（有 lines.json 才有 LINES / LINES_T / TERMS，有 quests.json 才有 QUESTS）', Object.keys(c));
    check(c.WORLDS.length === 13 && c.SCENES.length === 13, '13 个小镇、13 段小剧场');
    const ctx = { window: {} };
    require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
    const en = ctx.window.WORLDS;
    check(c.WORLDS.every((w, i) => w.name === en[i].name && w.icon === en[i].icon && w.color === en[i].color && w.boss.emoji === en[i].boss.emoji && w.boss.name === en[i].boss.name &&
      w.boss.en === en[i].boss.en && typeof w.en === 'string' && w.en && typeof w.boss.hello === 'string' && w.boss.hello && w.boss.x && w.boss.x.en), '小镇的中文岛名、图标、颜色、岛主的表情和名字照 data.js；en 是目标语言岛名；岛主的话有 hello 和 x');
    check(c.WORLDS.every(w => w.words.length >= 12 && w.sents.length === 8 && w.dlgs.length >= 6 && w.words.every(e => e.length === 4) && w.sents.every(e => e.length === 3) &&
      w.dlgs.every(d => d.length === 4 && d[2].length === 2 && d[3].q && d[3].a && d[3].wrong.length === 2)), '每个小镇：≥12 词（[t, zh, pic, {…}]）、8 句（[t, zh, {…}]）、≥6 段对话（[问, 答, [错, 错], {q, a, wrong}]）');
    check(c.SCENES.every((s, i) => s.cast.length === 2 && s.cast.every(x => x.length === 3 && /^[fm]$/.test(x[2])) && s.lines.length >= 8 && s.lines.length <= 10 &&
      s.lines.every(l => (l[0] === 0 || l[0] === 1) && l.length === 4 && l[1] && l[3].en) && typeof s.bg === 'string' && !!s.set), '小剧场：两个角色 [名字, 表情, f/m]、8–10 句 [第几个, 原文, 中文, {…}]，有 bg 和 set');
    const built = syl.books.filter(b => [1, 2, 3, 4, 5, 6, 7, 8].every(n => fs.existsSync(path.join(ROOT, 'tools', 'course', lang, 'units', b.id + '-' + n + '.json'))));
    check(c.BOOKS.list.length === built.length && built.length >= 1 && c.BOOKS.list.every((b, i) => b.id === built[i].id && b.level === built[i].level && b.name === built[i].name.zh &&
      b.short === b.level + ' 级' && b.x.en.name === built[i].name.en && b.x.en.short === 'L' + b.level && b.units.length === 8), 'BOOKS.list：只有 8 个单元齐全的册（' + built.map(b => b.id).join('、') + '），id、级别、名字、short、x.en');
    const units = c.BOOKS.list.flatMap(b => b.units);
    check(units.every((u, i) => u.n === (i % 8) + 1 && u.words.length === 24 && u.sents.length === 16 && u.dlgs.length === 12 && u.icon && /^#[0-9A-Fa-f]{6}$/.test(u.color) &&
      typeof u.key === 'string' && u.key && u.x.en && u.x.key.en && u.grammar.title && u.grammar.tip && u.grammar.en.title && u.grammar.en.tip && u.boss.emoji && u.boss.name && u.boss.en && u.boss.hello && u.boss.x.en &&
      typeof u.name === 'string' && u.name && u.en && (lang === 'zh' ? u.zh === '' : !!u.zh)), '每个单元：8 个一册，24 词、16 句、12 段对话、图标、颜色、key、grammar（中文 + en）、Boss、x.en、x.key；中文课 zh 是空的');
    check(c.TALK.length === units.length && c.TALK.every((t, i) => (t.id === c.BOOKS.list[Math.floor(i / 8)].id + '-u' + ((i % 8) + 1) && t.unit === (i % 8) + 1 && /^[fm]$/.test(t.gender) &&
      typeof t.kid === 'boolean' && t.name && t.zh && t.topic && t.topicZh && t.goal && t.goalZh && t.persona && t.opener && t.words.length >= 6 && t.words.length <= 8 &&
      t.wordsZh.length === t.words.length && t.wordsEn.length === t.words.length && t.goals.length === 1 && t.goals[0].steps.length >= 3 && t.goals[0].steps.length <= 4 &&
      t.goals[0].steps.every(s => s.length === 3 && s[0] && s[1] && s[2].en))), 'TALK：每个单元一个聊天角色（id、gender、topic / goal 中英、persona、opener、words / wordsZh / wordsEn、goals[0].steps = [[中文, 目标语言, {en}]]）');
    talkOf[lang] = c.TALK;
    check(c.MAP.towns === 1 && JSON.stringify(c.MAP.books) === JSON.stringify(Object.fromEntries(c.BOOKS.list.map(b => [b.id, b.level]))) && c.MAP.mix.join() === '0.6,0.6,0.8,0.9,1,1' && c.MAP.kinds.length === 6 &&
      JSON.stringify(c.MAP.kinds[0]) === '{"listen":0.5,"fade":[4,6]}', 'MAP：towns 1、books 是 { 册 id: 级别 }、mix 和 kinds 和英语一样');

    // ---- 2. 读音、词块、意思 ----
    const ents = [];   // 每一条带意思的东西：{ t, x }
    const addW = e => ents.push({ kind: 'word', t: e[0], zh: e[1], x: e[3] });
    const addS = e => ents.push({ kind: 'sent', t: e[0], zh: e[1], x: e[2] });
    const addD = d => { ents.push({ kind: 'sent', t: d[0], zh: d[3].q.zh, x: d[3].q }); ents.push({ kind: 'sent', t: d[1], zh: d[3].a.zh, x: d[3].a }); d[2].forEach((w, k) => ents.push({ kind: 'sent', t: w, zh: d[3].wrong[k].zh, x: d[3].wrong[k] })); };
    for (const w of c.WORLDS.concat(units)) { w.words.forEach(addW); w.sents.forEach(addS); w.dlgs.forEach(addD); }
    for (const s of c.SCENES) s.lines.forEach(l => ents.push({ kind: 'line', t: l[1], zh: l[2], x: l[3] }));
    check(ents.every(e => e.x && typeof e.x.en === 'string' && e.x.en && typeof e.t === 'string' && e.t && typeof e.zh === 'string' && (lang === 'zh' ? e.zh === '' : !!e.zh)), '每条都有原文 t 和英文 en；中文意思（第 2 格）：中文课是空字符串，别的都有（' + ents.length + ' 条）');
    if (lang === 'es') {
      check(ents.every(e => e.x.r === undefined && e.x.seg === undefined), '西语：没有 r 和 seg（按空格切）');
    } else {
      check(ents.filter(e => e.kind === 'word').every(e => typeof e.x.r === 'string' && e.x.r), '词都有读音 r（字符串）');
      const ss = ents.filter(e => e.kind === 'sent');
      check(ss.every(e => Array.isArray(e.x.seg) && e.x.seg.length >= 1 && e.x.seg.join('') === e.t), '每个句子 seg 接起来和原文一字不差（' + ss.length + ' 句，含对话的问 / 答 / 错选项）', ss.find(e => !(Array.isArray(e.x.seg) && e.x.seg.join('') === e.t)));
      check(ss.every(e => Array.isArray(e.x.r) && e.x.r.length === e.x.seg.length && e.x.r.every(s => typeof s === 'string' && s)), '句子的 r 是和 seg 一样多的一列');
      check(c.SCENES.every(s => s.lines.every(l => typeof l[3].r === 'string' && l[3].r)) && units.every(u => typeof u.boss.x.r === 'string' && u.boss.x.r) && c.WORLDS.every(w => typeof w.boss.x.r === 'string' && w.boss.x.r),
        '小剧场每一句、岛主的话都有整串读音 r');
      if (lang === 'ja') check(ents.every(e => ![].concat(e.x.r).some(r => /[㐀-鿿]/.test(r))), '日语读音里没有汉字');
      if (lang === 'zh') check(ents.filter(e => e.kind === 'word').every(e => /^[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü'… ]+$/.test(e.x.r)), '中文词的读音只有拼音字母和声调符号（没有汉字、数字）');
    }

    // ---- 3. VOICE ----
    const V = c.VOICE;
    check(V.length > 1000 && V.every(e => Object.keys(e).join() === 't,g,p' && typeof e.t === 'string' && e.t.trim() && Array.isArray(e.g) && e.g.length && e.g.every(g => g === 'f' || g === 'm') && new Set(e.g).size === e.g.length),
      'VOICE：' + V.length + ' 句，每句 { t, g, p }，g 是 f / m 不重复');
    check(V.every((e, i) => e.p === i), 'p 从 0 起连着、不重复（先后：小镇在前、按岛，再按册、按单元）');
    {
      const seen = new Set(); let dupKey = '';
      for (const e of V) for (const g of e.g) { const k = g + '/' + key(e.t); if (seen.has(k)) dupKey = dupKey || k + ' ' + e.t; seen.add(k); }
      check(!dupKey, '同一个（文字，声音）只出现一次（按 key.js 的哈希算，一共 ' + seen.size + ' 段）', dupKey);
    }
    check(V.every(e => norm(e.t) === e.t.replace(/\s+/g, ' ').trim()), '句子里没有表情符号（念的是原文，key 和 norm 不改它）');
    const vk = new Map(V.map(e => [norm(e.t), e]));
    const need = [];
    for (const [i, w] of c.WORLDS.entries()) {
      need.push([w.en, 'f'], [w.boss.hello, 'f'], [w.boss.hello, 'm']);
      w.words.forEach(e => need.push([e[0], 'f'])); w.sents.forEach(e => need.push([e[0], 'f']));
      w.dlgs.forEach(d => [d[0], d[1], ...d[2]].forEach(t => need.push([t, 'f'], [t, 'm'])));
      c.SCENES[i].lines.forEach(l => need.push([l[1], c.SCENES[i].cast[l[0]][2]]));
    }
    for (const u of units) {
      need.push([u.boss.hello, 'f'], [u.boss.hello, 'm']);
      u.words.forEach(e => need.push([e[0], 'f'])); u.sents.forEach(e => need.push([e[0], 'f']));
      u.dlgs.forEach(d => [d[0], d[1], ...d[2]].forEach(t => need.push([t, 'f'], [t, 'm'])));
    }
    for (const t of c.TALK) need.push([t.opener, t.gender]);
    const miss = need.filter(([t, g]) => { const e = vk.get(norm(t)); return !e || !e.g.includes(g); });
    check(!miss.length, '词、句子、对话的问 / 答 / 错的选项、岛主的话、小剧场每一句、聊天开场白都在 VOICE 里（' + need.length + ' 个要求，声音按规矩：词句女声、对话和岛主两种、小剧场按角色性别）', miss.slice(0, 3));
    if (lang === 'ja' || lang === 'zh') check(V.slice(0, 40).every(e => /[぀-ヿ㐀-鿿]/.test(e.t)), '前 40 句都含假名或汉字（原文）');
    check(V[0].t === c.WORLDS[0].en && V[1].t === c.WORLDS[0].boss.hello, '最前面的是第 0 岛：岛名、岛主的话，然后是它的词');

    // ---- 4. 逐字节一样 ----
    CB.build(lang, { out: tmp2 });
    check(fs.readFileSync(file).equals(fs.readFileSync(path.join(tmp2, lang, 'course.json'))), '同一份输入生成两次：文件逐字节一样');

    // ---- 4b. readings.json：每句配音的读音（course.json 旁边，不进课程包；tools/voice/gen.py 用它纠正日语的读法） ----
    const rf = path.join(tmp, lang, 'readings.json');
    check(fs.existsSync(rf), 'readings.json 写在 course.json 旁边');
    const RD = JSON.parse(fs.readFileSync(rf, 'utf8'));
    if (lang === 'es') check(Object.keys(RD).length === 0, '西语没有读音：readings.json 是空的');
    else {
      const isle = new Set(c.WORLDS.map(w => norm(w.en)));   // 岛名源文件里没有读音（town 的 t 只有原文）
      const noR = V.filter(e => !RD[norm(e.t)] && !isle.has(norm(e.t)));
      check(!noR.length, '每句配音都有读音（岛名除外：' + (V.length - Object.keys(RD).length) + ' 句没有）', noR.slice(0, 3).map(e => e.t));
      const w0 = c.WORLDS[0].words[0];
      check(RD[norm(w0[0])] === w0[3].r, '词的读音是源文件里的 r');
      const s0 = c.WORLDS[0].sents[0];
      check(RD[norm(s0[0])] === s0[2].r.join(lang === 'zh' ? ' ' : ''), '句子的读音是 seg 对应的 r 接起来（日语直接接、中文用空格）');
    }
  }

  // ---- 4c. 聊天角色表 talk-courses.js（tools/course/TALK.md §1）：build.js --talk 生成，服务器按它拼人设 ----
  {
    console.log('\n— talk-courses.js（聊天角色表） —');
    const file = path.join(ROOT, 'talk-courses.js');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    check(text !== '' && text === CB.emitTalk(CB.talkCourses()) && text === CB.emitTalk(CB.talkCourses(), CB.talkQuests()) && CB.talkFresh(), 'talk-courses.js 就是 build.js --talk 现在会生成的那一份（没手改、没过期）；不是的话跑 node tools/course/build.js --talk');
    const TC = text ? require(file) : { langs: [], list: [], byId: {} };
    // 第二轮：quests = 每门语言正式的 quests.json 里的委托（纯文字：开场白、每一步的示范句、词），还没有译文的语言没有那个键
    {
      const QS = require(path.join(ROOT, 'quests.js')), real = CB.talkQuests();
      const withFile = CB.LANGS.filter(l => fs.existsSync(path.join(ROOT, 'tools', 'course', l, 'quests.json')));
      check(TC.quests && typeof TC.quests === 'object' && JSON.stringify(TC.quests) === JSON.stringify(real) && JSON.stringify(Object.keys(TC.quests)) === JSON.stringify(withFile) &&
        Object.entries(TC.quests).every(([l, m]) => CB.LANGS.includes(l) && Object.entries(m).every(([id, x]) => { const q = QS.byId[id]; return q && typeof x.opener === 'string' && x.opener && /^opener,steps,words(,names)?$/.test(Object.keys(x).join()) &&
          x.steps.length === q.steps.length && x.steps.every(s => typeof s === 'string' && s) && x.words.length === q.words.length && x.words.every(s => typeof s === 'string' && s); })),
        'talk-courses.js 的 quests：{ 语言: { 委托 id: { opener, steps, words[, names] } } }，纯文字、和 quests.js 一步对一步；只有交了 quests.json 的语言（现在：' + (withFile.join('、') || '还没有') + '）', Object.keys(TC.quests || {}));
      // 名字表 names：这条委托的英文原文里出现的、这门课的台词翻译表（lines.json 的 terms）里定了写法的名字 → [[英语名, 这门语言的写法]…]
      const SRCT = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', 'lines-src.json'), 'utf8')).terms;
      let nNames = 0, badName = '';
      for (const [l, m] of Object.entries(TC.quests || {})) {
        const lj = path.join(ROOT, 'tools', 'course', l, 'lines.json'), T = fs.existsSync(lj) ? JSON.parse(fs.readFileSync(lj, 'utf8')).terms || {} : {};
        const tr = en => { for (const ty of ['person', 'place', 'monster', 'item']) { const s = (SRCT[ty] || []).find(x => x.en === en), v = s && T[ty] && T[ty][s.id]; if (v) return typeof v === 'string' ? v : v.t; } return null; };
        for (const [id, x] of Object.entries(m)) {
          const q = QS.byId[id], src = [q.who, q.place, q.role, q.persona, q.goal, q.opener].join('\n');
          for (const p of x.names || []) { nNames++; if (!(Array.isArray(p) && p.length === 2 && src.includes(p[0]) && tr(p[0]) === p[1] && p[1] !== p[0])) badName = badName || l + ' ' + id + ' ' + JSON.stringify(p); }
          if (x.names && (!x.names.length || new Set(x.names.map(p => p[0])).size !== x.names.length)) badName = badName || l + ' ' + id + ' 空的或者有重复';
          // 委托人自己的名字、岛名在 terms 里有（而且写法和英语不一样）就一定在表里
          for (const en of [q.who, q.place]) if (tr(en) && tr(en) !== en && !(x.names || []).some(p => p[0] === en)) badName = badName || l + ' ' + id + ' 少了 ' + en;
        }
      }
      check(!badName, 'talk-courses.js 的名字表（' + nNames + ' 个）：每个英语名都出自这条委托的英文原文，写法就是这门课 lines.json 的 terms 里那个（和英语一样的不列）；委托人和岛名有译名的都在', badName);
    }
    const all = CB.LANGS.flatMap(l => (talkOf[l] || []).map(t => ({ lang: l, t })));
    check(JSON.stringify(TC.langs) === JSON.stringify(CB.LANGS) && TC.list.length === all.length && all.length >= 24 &&
      TC.list.every((n, i) => n.id === all[i].t.id && n.lang === all[i].lang && n.goals.length === all[i].t.goals.length && n.goals.every((g, k) => g.steps.length === all[i].t.goals[k].steps.length)),
      '和三门语言 course.json 的 TALK 对得上：同样的先后、id、哪门语言、goals 的个数、每个目标几步（' + TC.list.length + ' 个角色）', TC.list.map(n => n.id).slice(0, 4));
    check(TC.list.every((n, i) => { const rest = Object.assign({}, n); delete rest.lang; return JSON.stringify(rest) === JSON.stringify(all[i].t) && Object.keys(n).slice(0, 2).join() === 'id,lang'; }),
      '每个角色 = TALK 的那一条原样，id 后面多一个 lang');
    const en = require(path.join(ROOT, 'talk-npcs.js'));
    check(Object.keys(TC.byId).length === TC.list.length && TC.list.every(n => TC.byId[n.id] === n && /^(es|ja|zh)\d+-u\d+$/.test(n.id) && n.id.startsWith(n.lang) && !Object.prototype.hasOwnProperty.call(en.byId, n.id) && n.id !== 'dyn' && !n.voice),
      'byId 按 id 查得到；id 形如 es1-u1，和英语角色（talk-npcs.js）的不重；角色上不写音色（talk-core 按语言挑）');
    // 命令行：--talk --check 核对；源文件一改就不是最新的（在拷出来的一份上试，不动仓库里的）
    const run = (root, a) => spawnSync(NODE, [path.join(root, 'tools', 'course', 'build.js'), ...a], { encoding: 'utf8' });
    const r0 = run(ROOT, ['--talk', '--check']);
    check(r0.status === 0 && /是最新的/.test(r0.stdout), 'node tools/course/build.js --talk --check：仓库里这份是最新的', (r0.stdout + r0.stderr).slice(0, 200));
    check(run(ROOT, ['--talk', 'es']).status === 2, '--talk 后面多写了别的参数：退出码 2');
    const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-talk-'));
    try {
      const cdir = path.join(fake, 'tools', 'course');
      fs.mkdirSync(path.join(fake, 'tools', 'voice'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'tools', 'voice', 'key.js'), path.join(fake, 'tools', 'voice', 'key.js'));
      fs.copyFileSync(path.join(ROOT, 'data.js'), path.join(fake, 'data.js'));
      fs.copyFileSync(path.join(ROOT, 'quests.js'), path.join(fake, 'quests.js'));   // 委托的英语原文（quests.json 对着它查、对着它生成）
      fs.mkdirSync(cdir, { recursive: true });
      for (const f of ['check.js', 'build.js', 'lines-src.json']) fs.copyFileSync(path.join(ROOT, 'tools', 'course', f), path.join(cdir, f));
      for (const l of CB.LANGS) {
        const real = path.join(ROOT, 'tools', 'course', l);
        fs.mkdirSync(path.join(cdir, l, 'units'), { recursive: true });
        for (const f of ['syllabus.json', 'towns.json']) fs.copyFileSync(path.join(real, f), path.join(cdir, l, f));
        // 正式的委托译文和台词翻译表（有的话）：talk-courses.js 的 quests 从 quests.json 来，每条的名字表查 lines.json 的 terms
        for (const f of ['quests.json', 'lines.json']) if (fs.existsSync(path.join(real, f))) fs.copyFileSync(path.join(real, f), path.join(cdir, l, f));
        for (const f of fs.readdirSync(path.join(real, 'units'))) fs.copyFileSync(path.join(real, 'units', f), path.join(cdir, l, 'units', f));
      }
      const out = path.join(fake, 'talk-courses.js');
      const a = run(fake, ['--talk', '--check']);
      check(a.status === 1 && !fs.existsSync(out) && /不是最新的/.test(a.stderr), '还没有 talk-courses.js：--talk --check 退出码 1（不写文件）', (a.stdout + a.stderr).slice(0, 200));
      const b = run(fake, ['--talk']);
      check(b.status === 0 && fs.existsSync(out) && fs.readFileSync(out, 'utf8') === text && run(fake, ['--talk', '--check']).status === 0, '--talk 写出来的和仓库里的一字不差（同样的源文件逐字节一样），再 --check 就过了', (b.stdout + b.stderr).slice(0, 200));
      const uf = path.join(cdir, 'ja', 'units', 'ja1-3.json'), u = JSON.parse(fs.readFileSync(uf, 'utf8'));
      u.talk.persona += ' She likes green tea.';
      fs.writeFileSync(uf, JSON.stringify(u));
      // 这份拷出来的只有课程源文件，没有整个游戏：带着台词翻译表生成 course.json 要加载游戏的怪兽表，这里生成不了——日语的那份拿掉（名字表跟着没有，反正要重新生成）
      fs.rmSync(path.join(cdir, 'ja', 'lines.json'), { force: true });
      const c1 = run(fake, ['--talk', '--check']), c2 = run(fake, ['ja', '--check']);
      check(c1.status === 1 && /不是最新的/.test(c1.stderr) && fs.readFileSync(out, 'utf8') === text && c2.status === 0 && /提醒：talk-courses\.js 不是最新的/.test(c2.stdout),
        '聊天角色的源文件改过：--talk --check 退出码 1（不动文件）；平常生成 course.json 时提醒一句', (c1.stderr + c2.stdout).slice(-300));
      const d1 = run(fake, ['--talk']), now = fs.readFileSync(out, 'utf8');
      check(d1.status === 0 && now !== text && now.includes('She likes green tea.') && run(fake, ['--talk', '--check']).status === 0 && !/提醒：talk-courses/.test(run(fake, ['ja', '--check']).stdout), '重新 --talk：文件跟上了，不再提醒');
      const tf = path.join(cdir, 'es', 'towns.json'), towns = JSON.parse(fs.readFileSync(tf, 'utf8'));
      towns[0].sents.pop();
      fs.writeFileSync(tf, JSON.stringify(towns));
      const e1 = run(fake, ['--talk']);
      check(e1.status === 1 && /没过 tools\/course\/check\.js/.test(e1.stderr) && fs.readFileSync(out, 'utf8') === now, '源文件检查不过：--talk 不生成（退出码 1，文件不动）', e1.stderr.slice(0, 200));
    } finally { fs.rmSync(fake, { recursive: true, force: true }); }
  }

  // ---- 5. 台词翻译表（tools/course/SPEC.md §8）：tests/course-lines-fixture.js 的小样 ----
  {
    const FX = require(path.join(__dirname, 'course-lines-fixture.js'));
    const PK = require(path.join(ROOT, 'packs.js'))._;
    const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', 'lines-src.json'), 'utf8'));
    const ctxD = { window: {} };
    require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'dex.js'), 'utf8'), ctxD);
    const MONS = ctxD.window.DEX.all.map(s => s.en), isMon = v => MONS.includes(v);
    const tmpL = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-lines-'));
    try {
      for (const lang of CB.LANGS) {
        console.log('\n— 台词翻译表 ' + lang + ' —');
        const F = FX.FIX[lang], file = FX.write(lang, tmpL);
        const r = CB.build(lang, { out: tmpL, lines: file }), c = r.course;
        check(Object.keys(c).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,LINES,LINES_T,TERMS,VOICE', '有翻译表：MAP 后面多 LINES / LINES_T / TERMS', Object.keys(c));
        const val = v => (typeof v === 'string' ? { t: v } : v);
        // LINES：键是英语原文（带 {name}），西语是字符串，日语 / 中文 { t, seg, r }
        check(JSON.stringify(Object.keys(c.LINES).sort()) === JSON.stringify(Object.keys(F.lines).sort()) &&
          Object.entries(F.lines).every(([en, v]) => (lang === 'es' ? c.LINES[en] === v : JSON.stringify(c.LINES[en]) === JSON.stringify({ t: v.t, seg: v.seg, r: v.r }))),
        'LINES：{ 英语原文: 译文 }（' + Object.keys(c.LINES).length + ' 句，' + (lang === 'es' ? '西语是字符串' : '{ t, seg, r }') + '）');
        check(c.LINES_T.length === Object.keys(F.templates).length && c.LINES_T.every(t => t.en && t.t && t.s && Object.keys(t.s).length) &&
          c.LINES_T.every((t, i) => !i || c.LINES_T[i - 1].en.replace(/\{[a-z0-9]+\}/g, '').length >= t.en.replace(/\{[a-z0-9]+\}/g, '').length),
        'LINES_T：模板 { en, t, s }，字面越长越靠前（越具体越先对）');
        // 西语没写的人名 = 和英文一样（lines-glossary.md 的约定），生成时照英文填进 TERMS.person（2026-11-21 第三批：游戏才认得出它是人名）
        const same = lang === 'es' ? SRC.terms.person.filter(x => !(F.terms.person && x.en in F.terms.person)) : [];
        const nTerms = Object.values(F.terms).reduce((s, m) => s + Object.keys(m).length, 0) + same.length;
        check(Object.values(c.TERMS).reduce((s, m) => s + Object.keys(m).length, 0) === nTerms && Object.entries(F.terms).every(([ty, m]) => Object.keys(m).every(en => c.TERMS[ty] && en in c.TERMS[ty])) &&
          same.every(x => c.TERMS.person[x.en] === x.en),
          'TERMS：{ 类别: { 英文词: 译文 } }（' + nTerms + ' 个' + (same.length ? '，其中 ' + same.length + ' 个西语没写的人名照英文填上' : '') + '）');
        const tab = PK.lineTable(c);
        // 英语游戏拼得出的每一句都对得上：模板 × 这一类的每个词（怪兽：手册里每一只；没翻的怪兽名照原样），自己按译文拼一遍比对
        let n = 0, bad = null;
        for (const [en, v0] of Object.entries(F.templates)) {
          const v = val(v0), src = SRC.templates.find(t => t.en === en), names = Object.keys(src.slots);
          const pool = nm => { const ty = src.slots[nm]; if (ty === 'monster') return MONS.map(m => [m, (F.terms.monster && F.terms.monster[m]) || m]); return Object.entries(F.terms[ty] || {}); };
          const rec = (i, eng, out) => {
            if (i === names.length) {
              let e2 = eng;
              if (src.an) e2 = e2.replace(/(^|\W)([aA]) ([AEIOUaeiou])/g, (a, p, x, y) => p + x + 'n ' + y);
              const got = PK.lineFind(tab, e2, { isMon });
              n++;
              if (!got || got.t !== out.t) bad = bad || { en: e2, got, want: out.t };
              return;
            }
            const nm = names[i];
            for (const [ten, tv] of pool(nm)) {
              const x = val(tv), useF = v.f && x.g === 'f';
              const tmpl = i === 0 ? (useF ? v.f : v.t) : out.tmpl;
              rec(i + 1, eng.split('{' + nm + '}').join(ten), { tmpl, t: (i === 0 ? tmpl : out.t).split('{' + nm + '}').join(x.t) });
            }
          };
          rec(0, en, { t: v.t });
        }
        check(n > 386 && !bad, '模板 × 词展开的每一句英语（' + n + ' 句）都查得到、和按译文拼的一字不差（西语阴性用 f 那句；冠词 a / an 都认）', bad);
        // 日语 / 中文：拼出来的 seg 接起来等于 t，r 一样多，空那块的读音是词的读音
        if (lang !== 'es') {
          const x = PK.lineFind(tab, 'Look out! Here comes Tidalfin!', { isMon }), mon = F.terms.monster.Tidalfin;
          check(x && x.seg.join('') === x.t && x.r.length === x.seg.length && x.r.includes(mon.r) && x.seg.includes(mon.t), '拼出来的句子：seg 接起来就是 t、r 对齐、怪兽名那块是它的读音（' + (x && x.t) + '）', x);
        }
        // 名字：{name} 留着，游戏里换；没翻的句子查不到
        check(PK.lineFind(tab, 'My name is {name}.', {}).t.includes('{name}') && PK.lineFind(tab, 'Hello there!', {}) === null && PK.lineFind(tab, 'Zzz, your turn!', { isMon }) === null,
          '{name} 留在译文里；没翻的句子、不认识的怪兽名查不到（游戏里走过渡办法）');
        // 昵称：游戏给的 isMon 认得就照原样
        check((PK.lineFind(tab, 'Momo, your turn!', { isMon: v => v === 'Momo' }) || {}).t === val(F.templates['{mon}, your turn!']).t.split('{mon}').join('Momo'), '起的昵称（Momo）照原样填进模板');
        // VOICE：翻好的台词（不带 {name}）、对战喊话按每只怪兽展开、选伙伴念三只的名字；p 还是连着的
        const V = c.VOICE, vt = new Set(V.map(e => e.t));
        const plain = Object.entries(F.lines).filter(([en]) => !/\{(name|rival)\}/.test(en)).map(([, v]) => val(v).t);
        const look = MONS.map(m => PK.lineFind(tab, 'Look out! Here comes ' + m + '!', { isMon }).t);
        check(plain.every(t => vt.has(norm(t))) && look.every(t => vt.has(norm(t))) && !V.some(e => /\{(name|rival)\}/.test(e.t)) && V.every((e, i) => e.p === i),
          'VOICE 加上了翻好的台词（' + plain.length + ' 句）和「Look out! Here comes …!」× ' + MONS.length + ' 只；带 {name} 的不配；p 连着', { miss: plain.find(t => !vt.has(norm(t))) });
        const pTown = V.findIndex(e => e.t === c.WORLDS[12].sents[7][0]), pOpen = V.findIndex(e => e.t === norm(val(F.lines["I'm a boy."]).t)), pBook = V.findIndex(e => e.t === c.BOOKS.list[0].units[0].words[0][0]);
        const pBattle = V.findIndex(e => e.t === norm(look[0]));
        check(pTown >= 0 && pTown < pOpen && pOpen < pBook && pBook < pBattle, '配音的先后：小镇 → 开场的台词 → 课本 → 对战喊话', { pTown, pOpen, pBook, pBattle });
        // 同一份输入两次：逐字节一样
        const a1 = fs.readFileSync(r.file);
        CB.build(lang, { out: tmpL, lines: file });
        check(a1.equals(fs.readFileSync(r.file)), '有翻译表：同一份输入生成两次逐字节一样');
        check(!('LINES' in CB.buildCourse(lang, { lines: false })), 'lines: false：不带翻译表（和没有 lines.json 一样）');
      }
      // check.js 拦下坏的翻译表
      console.log('\n— 台词翻译表的检查 —');
      const bad = (lang, mut, what, re) => {
        const j = FX.toLines(lang);
        mut(j);
        const f = path.join(tmpL, 'bad-' + lang + '.json');
        fs.writeFileSync(f, JSON.stringify(j));
        const rr = spawnSync(NODE, [path.join(ROOT, 'tools', 'course', 'check.js'), lang, '--lines', f, '--quiet'], { encoding: 'utf8' });
        check(rr.status === 1 && re.test(rr.stdout), 'check.js 拦下：' + what, rr.stdout.slice(0, 400));
        check(throws(() => CB.build(lang, { check: true, lines: f })) !== '', 'build 也不生成（' + what + '）');
      };
      const idOf = (arr, en) => arr.find(x => x.en === en).id;
      const L = en => idOf(SRC.lines, en), T = en => idOf(SRC.templates, en);
      bad('es', j => { delete j.lines[L('My name is {name}.')]; j.lines[L('My name is {name}.')] = 'Me llamo.'; }, '{name} 丢了', /\{name\}/);
      bad('es', j => { j.templates[T('{mon}, your turn!')] = '¡Te toca!'; }, '模板的空丢了', /\{mon\} 要正好出现一次/);
      bad('es', j => { j.lines[L("I'm a boy.")] = 'Soy the boy.'; }, '西语里剩下英语', /还有英语/);
      // 只提醒、不拦的：原文删了的 id（翻译表跟上之前照样生成，不带它）、和英语一样的一个词（音符 Sol、人名）
      {
        const j = FX.toLines('es');
        j.lines.l_nope = 'Hola.';
        const sol = SRC.lines.find(x => /^[A-Z][a-z]{2,}$/.test(x.en));
        if (sol) j.lines[sol.id] = sol.en;
        const f = path.join(tmpL, 'warn-es.json');
        fs.writeFileSync(f, JSON.stringify(j));
        const rr = spawnSync(NODE, [path.join(ROOT, 'tools', 'course', 'check.js'), 'es', '--lines', f], { encoding: 'utf8' });
        const c2 = rr.status === 0 ? CB.build('es', { check: true, lines: f }).course : null;
        check(rr.status === 0 && /提醒.*l_nope.*没有这个 id/.test(rr.stdout) && (!sol || new RegExp('提醒.*' + sol.id + '.*一个词').test(rr.stdout)) && c2 && !Object.values(c2.LINES).includes('Hola.'),
          '只提醒不拦：lines-src.json 里没有的 id（生成时不带）、和英语一样的一个词（' + (sol ? sol.en : '—') + '）', rr.stdout.slice(-600));
      }
      bad('ja', j => { j.lines[L("I'm a boy.")].seg = ['ぼくは', '男の子']; }, 'seg 接起来不等于 t', /seg 接起来/);
      bad('ja', j => { j.lines[L("I'm a boy.")].r = ['ぼくは', '男の子', 'です']; }, '读音里有汉字', /汉字/);
      bad('ja', j => { j.templates[T('{mon}, your turn!')].seg = ['{mon}、きみの', '番だ！']; j.templates[T('{mon}, your turn!')].r = ['{mon}', 'ばんだ']; }, '空没有自己一块', /要自己一块/);
      bad('ja', j => { j.lines[L("I'm a boy.")] = { t: 'I am a boy.', seg: ['I am a boy.'], r: ['あい'] }; }, '日语里剩下英文词', /英文词/);
      bad('zh', j => { j.lines[L("I'm a boy.")].r = ['wǒ', 'shì']; }, 'r 和 seg 不一样多', /r 要和 seg 一样多/);
      bad('zh', j => { j.terms.item[idOf(SRC.terms.item, 'Potion')] = { t: '药水' }; }, '中文的词没有读音', /缺读音/);
      // 第三批：整句可以另写自己的意思 zh / en（SPEC §8.2）——带进 course.json；模板不写、zh 要中文、en 不能有中文
      bad('es', j => { j.templates[T('{mon}, your turn!')] = { t: '¡{mon}, te toca!', zh: '轮到你了' }; }, '模板写了 zh（意思只给整句）', /只给整句/);
      bad('es', j => { j.lines[L("I'm a boy.")] = { t: 'Soy un chico.', en: '我是男孩。' }; }, 'en 里有中文', /en 里不能有中文/);
      {
        const j = FX.toLines('ja'), en = 'Half past six means six thirty.';
        j.lines[L(en)] = Object.assign({}, j.lines[L(en)], { zh: '六点半就是六点三十分。', en: 'Half past six is six thirty.' });
        const f = path.join(tmpL, 'gloss-ja.json');
        fs.writeFileSync(f, JSON.stringify(j));
        const c3 = CB.build('ja', { check: true, lines: f }).course, x = c3.LINES[en];
        check(x && x.zh === '六点半就是六点三十分。' && x.en === 'Half past six is six thirty.' && x.t === j.lines[L(en)].t, '整句自己的意思 zh / en：带进 course.json（游戏里用它当下面那行意思）', x);
        const fe = FX.toLines('es'); fe.lines[L(en)] = { t: 'Las seis y media son las seis treinta.', zh: '六点半就是六点三十分。' };
        const f2 = path.join(tmpL, 'gloss-es.json');
        fs.writeFileSync(f2, JSON.stringify(fe));
        const y = CB.build('es', { check: true, lines: f2 }).course.LINES[en];
        check(y && typeof y === 'object' && y.t === 'Las seis y media son las seis treinta.' && y.zh === '六点半就是六点三十分。', '西语写了 zh：这一句成了对象 { t, zh }（平时还是字符串）', y);
      }
      // 界面提示、台词意思里夹着的英语（packs.js 的纯函数，ENGINE.md §5 第三批）
      {
        const term = x => ({ Tim: 'ティム', 'Graffiti Woods': 'らくがきの森', 'Captain Gale': 'ゲイル船長', Mom: 'ママ' })[x] || null;
        const line = q => ({ "Are you Tim's mom?": 'ティムのお母さんですか？' })[q] || null;
        const z = (s, o) => PK.hintFix(s, Object.assign({ ui: 'zh', term, line }, o)).s;
        check(z('帮蒂姆 Tim 找家人：问 "Are you Tim\'s mom?"（还差{left}）') === '帮蒂姆 ティム 找家人：问 "ティムのお母さんですか？"（还差{left}）', 'hintFix：引着的原句换成译文、名字换成这门课的写法、{占位符}不动');
        check(z('找人问一问："Where is the library?"（走廊里的艾米 Amy）') === '找人问一问（走廊里的艾米）', 'hintFix：没有译文的引号连引号拿掉，不是名字的英文拿掉，多出来的冒号收拾掉');
        check(z('去港口坐盖尔船长 Captain Gale 的渡轮 ferry，去社团岛') === '去港口坐盖尔船长 ゲイル船長 的渡轮，去社团岛' && z('喷泉旁边：red cap（红帽子）、bag（背包），找出他') === '喷泉旁边：红帽子、背包，找出他',
          'hintFix：「渡轮 ferry」拿掉英文，「red cap（红帽子）」只留意思');
        check(z('去气象台 Weather Station（玻璃圆顶的房子）') === '去气象台（玻璃圆顶的房子）' && z('打败 BOSS（课本 BOSS {done}/{need}），按 A') === '打败 BOSS（课本 BOSS {done}/{need}），按 A', 'hintFix：中文名后面的英文 + 说明括号：括号照留；BOSS、A 这种界面记号照留');
        const names = PK.namesRe([['Route 9', 'ルート9'], ['Clear Way', 'みちひらき'], ['Mom', 'ママ']]);
        const e = s => PK.hintFix(s, { ui: 'en', term, line, names }).s;
        check(e('Talk to Mom. Use Clear Way, then cross Sea Route 9 and get the Clear Way Echo Shell') === 'Talk to ママ. Use みちひらき, then cross Sea Route 9 and get the Clear Way Echo Shell' && e('in "📚 Practice", beat the boss') === 'in "📚 Practice", beat the boss',
          'hintFix 英语界面：只换整个名字（「Sea Route 9」「Clear Way Echo Shell」里的不换），引号里不是一句话的（界面上的名字）照留');
        const g = (zh, pairs) => PK.glossFix(zh, pairs, { term, keep: v => v === 'Coco' });
        check(g('“ate”是“eat”的过去式。', [['"Ate" is the past of "eat".', '「食べた」は「食べる」の過去。'], ['Ate', '食べた'], ['eat', '食べる']]) === '“食べた”是“食べる”的过去式。' &&
          g('在你好岛，大家先说“Hello！”', [['Hello!', 'こんにちは！']]) === '在你好岛，大家先说“こんにちは！”' && g('我叫 Tim，Coco 你好！', []) === '我叫 ティム，Coco 你好！',
          'glossFix：意思里的英语换成译文（不分大小写、句末标点对不上也认）、名字换成这门课的写法、主角名字照留');
        check(g('half past six 就是六点半。', []) === null, 'glossFix：换完还剩英语单词 → null（这句意思不显示）');
        const qm = PK.quoteMap(PK.lineTable({ LINES: { 'Ask them: "Are you Tim\'s mom?"': 'Pregúntales: “¿Eres la mamá de Tim?”', 'Say "Hi" and "Bye".': 'Di «Hola».' } }));
        check(qm.get("Are you Tim's mom?") === '¿Eres la mamá de Tim?' && !qm.has('Hi'), 'quoteMap：剧情台词里引着的原句 ↔ 译文里同一个位置的引号（引号个数对不上的不认）');
      }
    } finally { fs.rmSync(tmpL, { recursive: true, force: true }); }
  }

  // ---- 6. 支线委托、今日目击的译文（tools/course/TALK.md 第二轮）：cloud/test/quests-sample.cjs 的小样 ----
  {
    const QF = require(path.join(ROOT, 'cloud', 'test', 'quests-sample.cjs'));
    const FX = require(path.join(__dirname, 'course-lines-fixture.js'));
    const QS = require(path.join(ROOT, 'quests.js')), SS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', 'sight-src.json'), 'utf8')).lines;
    const tmpQ = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-quests-'));
    const txt = v => (typeof v === 'string' ? v : v.t);
    const chk = (lang, a) => spawnSync(NODE, [path.join(ROOT, 'tools', 'course', 'check.js'), lang, ...a], { encoding: 'utf8' });
    try {
      for (const lang of CB.LANGS) {
        console.log('\n— 委托和今日目击 ' + lang + ' —');
        const f = QF.write(lang, tmpQ), J = QF.QUESTS[lang].quests, SJ = QF.SIGHT[lang].lines, ids = Object.keys(J);
        const base = CB.build(lang, { check: true, lines: false }).course;
        const r = CB.build(lang, { check: true, lines: false, quests: f.quests, sight: f.sight }), c = r.course;
        check(Object.keys(base).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,VOICE' && Object.keys(c).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,LINES,QUESTS,VOICE' && r.stats.quests === ids.length && r.stats.sight === Object.keys(SJ).length,
          'lines: false 又没给 quests / sight：不带正式的（和以前一样）；给了小样：多 LINES、QUESTS（没有翻译表就没有 LINES_T / TERMS）', Object.keys(c));
        // LINES：键是英语原文——委托的 ask / note / thanks / bye、每一句线索；写法和台词翻译表的整句一样
        const want = {};
        for (const id of ids) { const q = QS.byId[id], x = J[id]; q.ask.forEach((a, i) => { want[a[0]] = x.ask[i]; }); if (q.note) want[q.note[0]] = x.note; q.thanks.forEach((a, i) => { want[a[0]] = x.thanks[i]; }); want[q.bye[0]] = x.bye; }
        for (const [en, v] of Object.entries(SJ)) want[en] = v;
        check(JSON.stringify(Object.keys(c.LINES).sort()) === JSON.stringify(Object.keys(want).sort()) && Object.entries(want).every(([en, v]) => (lang === 'es' ? c.LINES[en] === v : JSON.stringify(c.LINES[en]) === JSON.stringify({ t: v.t, seg: v.seg, r: v.r }))),
          'LINES：{ 英语原文: 译文 }——委托的请求 / 旁白 / 感谢 / 做完以后那一句和每句线索（' + Object.keys(c.LINES).length + ' 句，' + (lang === 'es' ? '西语是字符串' : '{ t, seg, r }') + '）；开场白、示范句不进 LINES');
        const tab = require(path.join(ROOT, 'packs.js'))._.lineTable(c), find = en => require(path.join(ROOT, 'packs.js'))._.lineFind(tab, en, {});
        check(find(QS.byId['q0-cap'].ask[0][0]).t === txt(J['q0-cap'].ask[0]) && find(Object.keys(SJ)[0]).t === txt(Object.values(SJ)[0]) && find(QS.byId['q0-cap'].opener) === null,
          '游戏里现成的查法（packs.js 的 lineFind(英语原文)）直接查得到请求和线索');
        // QUESTS：聊天页显示用
        check(JSON.stringify(Object.keys(c.QUESTS)) === JSON.stringify(QS.list.map(q => q.id).filter(id => ids.includes(id))) && ids.every(id => {
          const q = QS.byId[id], x = J[id], y = c.QUESTS[id];
          return Object.keys(y).join() === 'opener,steps,words' && JSON.stringify(y.opener) === JSON.stringify(x.opener) && y.steps.length === q.steps.length && y.steps.every((s, i) => JSON.stringify(s) === JSON.stringify(x.steps[i])) &&
            y.words.length === q.words.length && y.words.every((w, i) => w.length === 3 && JSON.stringify(w[0]) === JSON.stringify(x.words[i]) && w[1] === q.words[i][1] && w[2] === q.words[i][0]);
        }), 'QUESTS：{ 委托 id: { opener, steps: [示范句…], words: [[这门语言的词, 中文, 英文]…] } }，按 quests.js 的先后；' + (lang === 'es' ? '西语都是字符串' : '开场白 / 示范句 { t, seg, r }，词 { t, r }') + '；词的中文、英文意思照 quests.js', c.QUESTS[ids[0]]);
        // VOICE：委托人按 TA 的性别、旁白男女声都配、线索是女声旁白；排在课本后面；p 连着
        const V = c.VOICE, vk = new Map(V.map(e => [norm(e.t), e])), needV = [];
        for (const id of ids) { const q = QS.byId[id], x = J[id], g = [q.g === 'f' ? 'f' : 'm']; x.ask.concat(x.thanks, [x.bye]).forEach(v => needV.push([txt(v), g])); if (q.note) needV.push([txt(x.note), ['f', 'm']]); }
        for (const v of Object.values(SJ)) needV.push([txt(v), ['f']]);
        const missV = needV.filter(([t, g]) => { const e = vk.get(norm(t)); return !e || e.g.join() !== g.join(); });
        const pNew = V.findIndex(e => e.t === norm(needV[0][0])), pTalk = V.findIndex(e => e.t === c.TALK[c.TALK.length - 1].opener);
        check(!missV.length && V.length === base.VOICE.length + needV.length && V.every((e, i) => e.p === i) && pTalk >= 0 && pNew === pTalk + 1 && !vk.has(norm(txt(J[ids[0]].opener))) && !vk.has(norm(txt(J[ids[0]].steps[0]))),
          'VOICE 多了 ' + needV.length + ' 句：委托人的话按 TA 的性别、旁白两种声音、线索女声；排在课本后面；开场白和示范句不配（AI 现场说）；p 连着', { missV: missV.slice(0, 2), pNew, pTalk });
        if (lang !== 'es') check(fs.existsSync(path.join(tmpQ, 'x')) === false && (() => { CB.build(lang, { out: tmpQ, lines: false, quests: f.quests, sight: f.sight }); const RD = JSON.parse(fs.readFileSync(path.join(tmpQ, lang, 'readings.json'), 'utf8')); const a = J['q0-cap'].ask[0]; return RD[norm(a.t)] === a.r.join(lang === 'zh' ? ' ' : ''); })(),
          'readings.json 里有委托台词的读音（seg 对应的 r 接起来）');
        const strip = x => { const o = Object.assign({}, x); delete o.LINES; delete o.QUESTS; delete o.VOICE; return JSON.stringify(o); };
        check(strip(c) === strip(base) && JSON.stringify(CB.build(lang, { check: true, lines: false, quests: f.quests, sight: f.sight }).course) === JSON.stringify(c), '别的字段一个字没变；同一份输入两次一样');
        // 和台词翻译表一起：LINES 里两样都有，QUESTS 排在 TERMS 后面
        const lf = FX.write(lang, tmpQ), both = CB.build(lang, { check: true, lines: lf, quests: f.quests, sight: f.sight }).course, only = CB.build(lang, { check: true, lines: lf }).course;
        check(Object.keys(both).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,LINES,LINES_T,TERMS,QUESTS,VOICE' && Object.keys(only).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,LINES,LINES_T,TERMS,VOICE' &&
          Object.keys(both.LINES).length === Object.keys(only.LINES).length + Object.keys(want).length && Object.keys(only.LINES).every(en => JSON.stringify(both.LINES[en]) === JSON.stringify(only.LINES[en])) && Object.keys(want).every(en => en in both.LINES),
          '有翻译表的小样又给了委托 / 目击：并进同一个 LINES，QUESTS 排在 TERMS 后面；只给翻译表的小样：不带正式的委托 / 目击');
        const one = CB.build(lang, { check: true, lines: false, quests: f.quests, sight: false }).course, two = CB.build(lang, { check: true, lines: false, quests: false, sight: f.sight }).course;
        check('QUESTS' in one && !Object.keys(SJ).some(en => en in one.LINES) && !('QUESTS' in two) && Object.keys(two.LINES).length === Object.keys(SJ).length, 'quests / sight 各管各的：给 false 就不带那一样');
        // 服务器用的纯文字（talk-courses.js 的 quests）
        const pl = CB.questsPlain(lang, f.quests, { lines: false });
        check(JSON.stringify(pl) === JSON.stringify(QF.plain(lang)) && ids.every(id => pl[id].steps.every(s => typeof s === 'string') && pl[id].words.every(s => typeof s === 'string')), 'questsPlain(语言, 文件, { lines: false })：{ 委托 id: { opener, steps, words } } 纯文字（和小样自己算的一样；没有翻译表就没有名字表）');
        // 名字表：台词翻译表（这里是小样，另加几个人名）的 terms 里有的名字，按在英文原文里出现的先后；写法和英语一样的不列；两处（QUESTS、纯文字）一样
        const SRCL = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', 'lines-src.json'), 'utf8')), pid = en => SRCL.terms.person.find(x => x.en === en).id;
        const jl = FX.toLines(lang), P = lang === 'es' ? { 'Ms Rosa': 'Sra. Rosa', Ben: 'Ben', 'Fisher Tom': 'Pescador Tom', 'Ms Pen': 'Sra. Pen' }
          : lang === 'ja' ? { 'Ms Rosa': { t: 'ロサさん', r: 'ロサさん' }, Ben: { t: 'ベン', r: 'ベン' }, 'Fisher Tom': { t: 'つり人のトム', r: 'つりびとのトム' } }
            : { 'Ms Rosa': { t: '罗莎女士', r: 'Luó shā nǚ shì' }, Ben: { t: '本', r: 'Běn' }, 'Fisher Tom': { t: '渔夫汤姆', r: 'yú fū Tāng mǔ' } };
        for (const [en, v] of Object.entries(P)) jl.terms.person[pid(en)] = v;
        const lnf = path.join(tmpQ, 'names-lines-' + lang + '.json');
        fs.writeFileSync(lnf, JSON.stringify(jl));
        const cn = CB.build(lang, { check: true, lines: lnf, quests: f.quests, sight: false }).course, hello = txt(FX.FIX[lang].terms.place['Hello Island']);
        const wantN = [['Ms Rosa', txt(P['Ms Rosa'])], ['Hello Island', hello]].concat(lang === 'es' ? [] : [['Ben', txt(P.Ben)]], [['Fisher Tom', txt(P['Fisher Tom'])]]);
        const pn = CB.questsPlain(lang, f.quests, { lines: lnf });
        check(JSON.stringify(cn.QUESTS['q0-cap'].names) === JSON.stringify(wantN) && Object.keys(cn.QUESTS['q0-cap']).join() === 'opener,steps,words,names' && JSON.stringify(pn['q0-cap'].names) === JSON.stringify(wantN) &&
          (lang !== 'es' || JSON.stringify(pn['q1-stock'].names) === '[["Ms Pen","Sra. Pen"]]') && JSON.stringify(Object.assign({}, pn['q0-cap'], { names: undefined })) === JSON.stringify(pl['q0-cap']) && !('names' in c.QUESTS['q0-cap']),
          '名字表 names：' + wantN.map(p => p[0] + ' = ' + p[1]).join('; ') + '（委托人、岛名、人设里的人；' + (lang === 'es' ? '西语里和英语一样的 Ben 不列；' : '') + 'course.json 的 QUESTS 和服务器用的纯文字里一样）', cn.QUESTS['q0-cap'].names);
      }
      // 名字怎么配：整词、分大小写；长的先配、配上的那一段不再给短的配；按在原文里第一次出现的先后
      {
        const T = [['Fisher Tom', 'A'], ['Tom', 'B'], ['Ben', 'C'], ['Echo Ball', 'D'], ['Hello Island', 'E']].sort((a, b) => b[0].length - a[0].length);
        const q = t => ({ who: '', place: '', role: '', persona: t, goal: '', opener: '' });
        check(JSON.stringify(CB.questNames(QS.byId['q0-cap'], T)) === '[["Hello Island","E"],["Ben","C"],["Fisher Tom","A"]]' &&
          JSON.stringify(CB.questNames(q('Tom and Fisher Tom met Tommy, Benny and ben. Fisher Tom has an Echo Ball.'), T)) === '[["Tom","B"],["Fisher Tom","A"],["Echo Ball","D"]]' &&
          JSON.stringify(CB.questNames(q('Nobody is here.'), T)) === '[]' && JSON.stringify(CB.questNames(q("It is Ben's cap. (Tom) Hello Island!"), T)) === '[["Ben","C"],["Tom","B"],["Hello Island","E"]]',
          'questNames：「Fisher Tom」先于「Tom」（它里面的 Tom 不再单独配）、单独出现的 Tom 照样配、Tommy / Benny / 小写的 ben 不配、按出现的先后');
      }
      // talk-courses.js 带上委托：一条委托一行，浏览器里、Node 里都读得出来；没有委托译文的语言没有键
      {
        const files = { es: path.join(tmpQ, 'quests-es.json'), ja: path.join(tmpQ, 'quests-ja.json') };
        const tq = CB.talkQuests(files, { lines: false }), text2 = CB.emitTalk(CB.talkCourses(), tq), none = CB.emitTalk(CB.talkCourses(), {});
        const win = {}, tf = path.join(tmpQ, 'talk-courses-sample.js');
        require('vm').runInNewContext(text2, { window: win });
        fs.writeFileSync(tf, text2);
        const mod = require(tf), win0 = {};
        require('vm').runInNewContext(none, { window: win0 });
        check(JSON.stringify(Object.keys(tq)) === '["es","ja"]' && JSON.stringify(win.TALK_COURSES.quests) === JSON.stringify({ es: QF.plain('es'), ja: QF.plain('ja') }) && JSON.stringify(mod.quests) === JSON.stringify(win.TALK_COURSES.quests) &&
          mod.list.length === CB.talkCourses().length && text2.split('\n').filter(l => /^ {6}"q\d/.test(l)).length === 3 && JSON.stringify(win0.TALK_COURSES.quests) === '{}' && win0.TALK_COURSES.list.length === mod.list.length,
          'emitTalk(角色, 委托)：quests 写进 talk-courses.js（一条委托一行；window.TALK_COURSES 和模块都读得出来）；一门都没有时是 {}', Object.keys(tq));
      }
      // check.js：小样可以不全（只提醒）；写法不对的拦下
      console.log('\n— 委托和今日目击的检查 —');
      const okS = chk('ja', ['--quests', path.join(tmpQ, 'quests-ja.json'), '--sight', path.join(tmpQ, 'sight-ja.json')]);
      check(okS.status === 0 && /提醒.*小样里没有的委托 16 条/.test(okS.stdout) && /提醒.*小样里没有的线索 \d+ 句/.test(okS.stdout) && /ja quests\.json \/ sight\.json：0 处错/.test(okS.stdout), 'check.js --quests 文件 --sight 文件：小样缺的只提醒，退出码 0', okS.stdout.slice(-300));
      const badQ = (lang, mut, what, re) => {
        const j = JSON.parse(JSON.stringify(QF.QUESTS[lang])); mut(j.quests, j);
        const f = path.join(tmpQ, 'bad-quests-' + lang + '.json'); fs.writeFileSync(f, JSON.stringify(j));
        const rr = chk(lang, ['--quests', f, '--quiet']);
        check(rr.status === 1 && re.test(rr.stdout), 'check.js 拦下委托：' + what, rr.stdout.slice(0, 400));
        check(throws(() => CB.build(lang, { check: true, lines: false, quests: f })) !== '', 'build 也不生成（' + what + '）');
      };
      badQ('es', q => { q['q0-cap'].steps.pop(); }, '示范句少了一步', /steps 要 3 条/);
      badQ('es', q => { q['q0-cap'].ask.push('¡Hola!'); }, '请求多了一句', /ask 要 3 条/);
      badQ('es', q => { delete q['q1-stock'].note; }, '有旁白的委托没写 note', /缺 note/);
      badQ('es', q => { delete q['q0-cap'].opener; }, '没有开场白', /缺 opener/);
      badQ('es', q => { q['q0-cap'].bye = 'Hello again, dear! Ben wears his cap every day now.'; }, '西语里是英语原文', /没翻|还有英语/);
      badQ('es', q => { q['q0-cap'].ask[0] = '¡Ay, no! Alguien dejó una gorra azul en la playa?'; }, '¿ ? 不成对', /不成对/);
      badQ('es', (q, j) => { j.lang = 'ja'; }, 'lang 写错', /lang 要是 es/);
      badQ('ja', q => { q['q0-cap'].steps[0].seg = ['かれの', '名前は']; }, '示范句的 seg 接起来不等于 t', /seg 接起来/);
      badQ('ja', q => { q['q0-cap'].words[2] = { t: '名前' }; }, '词没有读音', /缺读音/);
      badQ('zh', q => { q['q0-cap'].thanks[1].r = ['xiè xie', 'nǐ']; }, 'r 和 seg 不一样多', /r 要和 seg 一样多/);
      badQ('zh', q => { q['q0-cap'].opener = { t: 'Thank you! 你想知道什么？', seg: ['Thank you!', '你', '想', '知道', '什么？'], r: ['x', 'nǐ', 'xiǎng', 'zhī dào', 'shén me'] }; }, '中文里剩下英文词', /英文词/);
      const badS = (lang, mut, what, re) => {
        const j = JSON.parse(JSON.stringify(QF.SIGHT[lang])); mut(j.lines, j);
        const f = path.join(tmpQ, 'bad-sight-' + lang + '.json'); fs.writeFileSync(f, JSON.stringify(j));
        const rr = chk(lang, ['--sight', f, '--quiet']);
        check(rr.status === 1 && re.test(rr.stdout), 'check.js 拦下线索：' + what, rr.stdout.slice(0, 400));
        check(throws(() => CB.build(lang, { check: true, lines: false, sight: f })) !== '', 'build 也不生成（' + what + '）');
      };
      badS('es', l => { l['It hides in the tall grass. It is blue.'] = 'It hides in the tall grass. It is blue.'; }, '没翻', /没翻|还有英语/);
      badS('ja', l => { l['It hides in the tall grass. It is blue.'].r.pop(); }, 'r 和 seg 不一样多', /r 要和 seg 一样多/);
      badS('zh', l => { l['It hides in the tall grass. It is blue.'].r[2] = '高高的'; }, '拼音里有汉字', /汉字/);
      // 只提醒的：方向 / 颜色没找到、sight-src.json 里没有的句子、quests.js 里没有的 id（生成时不带）
      {
        const j = JSON.parse(JSON.stringify(QF.SIGHT.es));
        j.lines['It is in the woods. Go north from the town.'] = 'Está en el bosque. Ve al sur desde el pueblo.';
        j.lines['It hides in the tall grass. It is blue.'] = 'Se esconde en la hierba alta. Es verde.';
        j.lines['It is on the moon.'] = 'Está en la luna.';
        const f = path.join(tmpQ, 'warn-sight-es.json'); fs.writeFileSync(f, JSON.stringify(j));
        const q = JSON.parse(JSON.stringify(QF.QUESTS.es)); q.quests['q99-nope'] = q.quests['q0-cap'];
        const f2 = path.join(tmpQ, 'warn-quests-es.json'); fs.writeFileSync(f2, JSON.stringify(q));
        const rr = chk('es', ['--sight', f, '--quests', f2]), c2 = rr.status === 0 ? CB.build('es', { check: true, lines: false, sight: f, quests: f2 }).course : null;
        check(rr.status === 0 && /提醒.*往 north 走.*没找到这个方向/.test(rr.stdout) && /提醒.*颜色 blue.*没找到/.test(rr.stdout) && /提醒.*sight-src\.json 里没有这一句.*It is on the moon\./.test(rr.stdout) && /提醒.*q99-nope.*没有这条委托/.test(rr.stdout) &&
          c2 && !('It is on the moon.' in c2.LINES) && !('q99-nope' in c2.QUESTS), '只提醒不拦：方向 / 颜色在译文里没找到（请人确认）、原句表里没有的句子和 quests.js 里没有的 id（生成时不带）', rr.stdout.slice(-500));
      }
      // 正式的那份要翻全、同一句英语原文的译文要一样：在拷出来的一份上试（自己写的 quests.js：两条委托有同一句请求）
      {
        const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-quests-fake-'));
        try {
          const cdir = path.join(fake, 'tools', 'course'), real = path.join(ROOT, 'tools', 'course', 'es');
          fs.mkdirSync(path.join(cdir, 'es', 'units'), { recursive: true });
          fs.mkdirSync(path.join(fake, 'tools', 'voice'), { recursive: true });
          for (const f of ['check.js', 'build.js', 'sight-src.json']) fs.copyFileSync(path.join(ROOT, 'tools', 'course', f), path.join(cdir, f));
          fs.copyFileSync(path.join(ROOT, 'tools', 'voice', 'key.js'), path.join(fake, 'tools', 'voice', 'key.js'));
          fs.copyFileSync(path.join(ROOT, 'data.js'), path.join(fake, 'data.js'));
          for (const f of ['syllabus.json', 'towns.json']) fs.copyFileSync(path.join(real, f), path.join(cdir, 'es', f));
          for (const f of fs.readdirSync(path.join(real, 'units'))) fs.copyFileSync(path.join(real, 'units', f), path.join(cdir, 'es', 'units', f));
          const q0 = QS.byId['q0-cap'], mk = (id, g) => ({ id, who: 'Ms Rosa', g, ask: [['Can you help me?', '你能帮帮我吗？']], opener: q0.opener, steps: q0.steps.slice(0, 1), words: q0.words.slice(0, 1), thanks: [['Thank you so much!', '太谢谢你了！']], bye: ['See you!', '再见！'] });
          const two = [mk('qa', 'f'), mk('qb', 'm')];
          fs.writeFileSync(path.join(fake, 'quests.js'), 'const L = ' + JSON.stringify(two) + ';\nmodule.exports = { list: L, byId: Object.fromEntries(L.map(q => [q.id, q])) };\n');
          const tr = ask => ({ ask: [ask], opener: '¡Gracias! ¿Qué quieres saber?', steps: ['¿Cómo se llama?'], words: ['De quién'], thanks: ['¡Muchas gracias!'], bye: '¡Nos vemos!' });
          const runF = a => spawnSync(NODE, [path.join(cdir, a[0]), ...a.slice(1)], { encoding: 'utf8' });
          const put = (name, j) => fs.writeFileSync(path.join(cdir, 'es', name), JSON.stringify(j));
          put('quests.json', { lang: 'es', quests: { qa: tr('¿Me puedes ayudar?') } });
          const m1 = runF(['check.js', 'es']), m2 = runF(['build.js', 'es', '--check']);
          check(m1.status === 1 && /错.*还没翻的委托 1 条.*qb/.test(m1.stdout) && m2.status === 1 && /没过 tools\/course\/check\.js/.test(m2.stderr), '正式的 quests.json 少一条委托：算错、列出来是哪条，build 不生成', m1.stdout.slice(-300));
          put('quests.json', { lang: 'es', quests: { qa: tr('¿Me puedes ayudar?'), qb: tr('¿Puedes ayudarme?') } });
          const d1 = runF(['check.js', 'es']);
          check(d1.status === 1 && /同一句英语原文，译文却不一样/.test(d1.stdout) && runF(['build.js', 'es', '--check']).status === 1, '两条委托里同一句英语原文、译文不一样：算错（并不进同一个 LINES）', d1.stdout.slice(-300));
          put('quests.json', { lang: 'es', quests: { qa: tr('¿Me puedes ayudar?'), qb: tr('¿Me puedes ayudar?') } });
          const outF = path.join(fake, 'o'), s1 = runF(['build.js', 'es', '--out', outF]);
          const cF = s1.status === 0 ? JSON.parse(fs.readFileSync(path.join(outF, 'es', 'course.json'), 'utf8')) : null, vF = cF && cF.VOICE.find(e => e.t === '¿Me puedes ayudar?');
          check(s1.status === 0 && /支线委托的译文 2 条、今日目击的线索 0 句/.test(s1.stdout) && cF && Object.keys(cF.LINES).length === 3 && cF.LINES['Can you help me?'] === '¿Me puedes ayudar?' && vF && vF.g.join() === 'f,m' && Object.keys(cF.QUESTS).join() === 'qa,qb',
            '译文一样就算了：LINES 里一条、配音合成两种声音（两个委托人一男一女）；命令行说带了几条委托、几句线索', (s1.stdout + s1.stderr).slice(-300));
          put('sight.json', { lang: 'es', lines: { [SS[0]]: 'Se esconde en la cueva.' } });
          const g1 = runF(['check.js', 'es']);
          check(g1.status === 1 && new RegExp('错.*还没翻的线索 ' + (SS.length - 1) + ' 句').test(g1.stdout), '正式的 sight.json 没翻全：算错（每一句都要有）', g1.stdout.slice(-200));
          fs.rmSync(path.join(cdir, 'es', 'sight.json')); fs.rmSync(path.join(cdir, 'es', 'quests.json'));
          const n1 = runF(['check.js', 'es']), n2 = runF(['build.js', 'es', '--check']);
          check(n1.status === 0 && /提醒  quests\.json：还没有/.test(n1.stdout) && /提醒  sight\.json：还没有/.test(n1.stdout) && n2.status === 0 && !/支线委托的译文/.test(n2.stdout), '两个文件都还没有：只提醒「还没有」，照旧能生成（没有这几样）', n1.stdout.slice(-200));
        } finally { fs.rmSync(fake, { recursive: true, force: true }); }
      }
    } finally { fs.rmSync(tmpQ, { recursive: true, force: true }); }
  }

  console.log('\n— 命令行 —');
  const run = a => spawnSync(NODE, [path.join(ROOT, 'tools', 'course', 'build.js'), ...a], { encoding: 'utf8' });
  const outC = path.join(tmp, 'cli');
  const r1 = run(['es', '--check', '--out', outC]);
  check(r1.status === 0 && !fs.existsSync(outC) && /检查过了/.test(r1.stdout), '--check：只检查、不写文件');
  const r2 = run(['ja', '--out', outC]);
  check(r2.status === 0 && fs.existsSync(path.join(outC, 'ja', 'course.json')), '--out 指定目录');
  check(run(['fr']).status === 2 && run([]).status === 2, '不认识的语言 / 没写语言：退出码 2');
  check(throws(() => CB.buildCourse('en')) !== '', 'buildCourse 不收英语');
  // 检查不过的源文件拒绝生成：拷一份坏的源文件，换掉 check.js 看的目录
  {
    const real = path.join(ROOT, 'tools', 'course', 'es');
    const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-course-bad-'));
    try {
      const cdir = path.join(fake, 'tools', 'course');
      fs.mkdirSync(path.join(cdir, 'es', 'units'), { recursive: true });
      for (const f of ['check.js', 'build.js']) fs.copyFileSync(path.join(ROOT, 'tools', 'course', f), path.join(cdir, f));
      fs.mkdirSync(path.join(fake, 'tools', 'voice'), { recursive: true });
      fs.copyFileSync(path.join(ROOT, 'tools', 'voice', 'key.js'), path.join(fake, 'tools', 'voice', 'key.js'));
      fs.copyFileSync(path.join(ROOT, 'data.js'), path.join(fake, 'data.js'));
      for (const f of ['syllabus.json', 'towns.json']) fs.copyFileSync(path.join(real, f), path.join(cdir, 'es', f));
      for (const f of fs.readdirSync(path.join(real, 'units'))) fs.copyFileSync(path.join(real, 'units', f), path.join(cdir, 'es', 'units', f));
      const towns = JSON.parse(fs.readFileSync(path.join(cdir, 'es', 'towns.json'), 'utf8'));
      towns[0].sents.pop();   // 少一句：check.js 要报错
      fs.writeFileSync(path.join(cdir, 'es', 'towns.json'), JSON.stringify(towns));
      const r = spawnSync(NODE, [path.join(cdir, 'build.js'), 'es', '--out', path.join(fake, 'o')], { encoding: 'utf8' });
      check(r.status === 1 && /没过 tools\/course\/check\.js/.test(r.stderr) && !fs.existsSync(path.join(fake, 'o')), '源文件检查不过：拒绝生成（退出码 1，不写文件）', r.stderr.slice(0, 300));
    } finally { fs.rmSync(fake, { recursive: true, force: true }); }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(tmp2, { recursive: true, force: true });
}
console.log(fails ? '\n✗ ' + fails + ' 项没过' : '\n全部通过');
process.exit(fails ? 1 : 0);
