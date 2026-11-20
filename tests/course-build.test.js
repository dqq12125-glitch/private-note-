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
    // 有正式的台词翻译表（tools/course/<语言>/lines.json）时 MAP 后面多 LINES / LINES_T / TERMS（下面「台词翻译表」那一段专门测）
    const LN3 = ['LINES', 'LINES_T', 'TERMS'];
    check(Object.keys(c).filter(k => !LN3.includes(k)).join() === 'fmt,lang,name,WORLDS,SCENES,BOOKS,TALK,MAP,VOICE' && (fs.existsSync(path.join(ROOT, 'tools', 'course', lang, 'lines.json')) ? LN3.every(k => k in c) : !LN3.some(k => k in c)),
      '顶层字段：fmt lang name WORLDS SCENES BOOKS TALK MAP VOICE（有 lines.json 才有 LINES / LINES_T / TERMS）', Object.keys(c));
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
        const nTerms = Object.values(F.terms).reduce((s, m) => s + Object.keys(m).length, 0);
        check(Object.values(c.TERMS).reduce((s, m) => s + Object.keys(m).length, 0) === nTerms && Object.entries(F.terms).every(([ty, m]) => Object.keys(m).every(en => c.TERMS[ty] && en in c.TERMS[ty])),
          'TERMS：{ 类别: { 英文词: 译文 } }（' + nTerms + ' 个）');
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
    } finally { fs.rmSync(tmpL, { recursive: true, force: true }); }
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
