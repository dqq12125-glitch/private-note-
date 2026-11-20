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
    check(Object.keys(c).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,VOICE', '顶层字段：fmt lang name WORLDS SCENES BOOKS TALK MAP VOICE', Object.keys(c));
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
