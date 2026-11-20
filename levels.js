// 回声岛 · 能力分级（window.EchoLevels / Node 模块）：六个级别、现有内容对到哪一级、综合级别怎么定
// 2026-11-19 老板定方向：先做语言能力检测（不只英语），测完按能力自动安排内容。这里是「分级」和「内容对照表」唯一的一处，
// 检测本身在 placement.js，按级别说话的岛民在 talk-core.js（中转服务要单独能跑，那几段话写在那边）。
// 加载时不碰 DOM、不读存档；Node 里可以直接 require（tests/place.test.js、tools/place/build.js）。
//
// 六个级别 0–5：入门、初级、初中级、中级、中高级、高级，「约相当于 CEFR Pre-A1 / A1 / A2 / B1 / B2 / C1」只是参照，
// 界面上要写明：这是为了安排内容做的估计，不是考试成绩，也不是证书。
// 检测给每项能力一个 0–6 的连续估计值 e：第 L 级 = [L, L+1)，「典型的第 L 级学习者」大约在 L + 0.5（见 placement.js 的自适应规则）。
(function (root) {
  'use strict';
  const I18N = root.EchoI18n || (typeof module !== 'undefined' && module.exports && typeof require === 'function' ? require('./i18n.js') : null);
  const CEFR = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1'];
  const TOP = CEFR.length - 1;
  const SKILLS = ['vocab', 'listen', 'read', 'speak'];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const okLv = v => typeof v === 'number' && v >= 0 && v <= TOP && v === Math.floor(v);
  // 估计值 → 级别
  const levelOf = e => clamp(Math.floor(+e || 0), 0, TOP);

  // ---------- 内容对照表：现有的内容大约是第几级（以后加别的语言，在这里加一项；加高级课程包见 bookLevel） ----------
  // towns：13 个话题小镇（data.js 的 WORLDS）；books：课本单元各册（book.js 的 BOOKS）；
  // mix：按能力走时，冒险出题里「正在学的单元」占几成（其余是小镇的话题词，1 级的内容，级别高了就少出）；
  // kinds：按能力走时题型怎么偏——listen：对战里要开口的招式有几成换成「听一听、点出来」（0–1 级多听多选）；
  //        fade：[复习到第几格只给首字母, 第几格起凭记忆说]（按课本走是 [2, 4]；3 级以上更早撤掉提示，多凭记忆说）
  const MAP = {
    en: {
      towns: 1,
      books: { hj7a: 1, hj7b: 1, hj8a: 2, hj8b: 2, hj9a: 3, hj9b: 3 },
      mix: [0.6, 0.6, 0.8, 0.9, 1, 1],
      kinds: [
        { listen: 0.5, fade: [4, 6] },
        { listen: 0.3, fade: [3, 5] },
        { listen: 0, fade: [2, 4] },
        { listen: 0, fade: [1, 3] },
        { listen: 0, fade: [1, 2] },
        { listen: 0, fade: [1, 2] },
      ],
    },
  };
  const mapOf = lang => MAP[lang] || MAP.en;
  // 别的语言的课（tools/course/ENGINE.md §2）：内容对照表在课程包的 course.json 里（MAP），game.js 换内容时登记进来。
  // 只收形状对的（towns 级别、books 每册的级别、mix 6 个数、kinds 6 项）；不对的不收，照旧按英语的表
  function addMap(lang, m) {
    if (!lang || lang === 'en' || !m || typeof m !== 'object') return false;
    const ok = okLv(m.towns) && m.books && typeof m.books === 'object' && Object.values(m.books).every(okLv) &&
      Array.isArray(m.mix) && m.mix.length === CEFR.length && m.mix.every(x => typeof x === 'number' && x >= 0 && x <= 1) &&
      Array.isArray(m.kinds) && m.kinds.length === CEFR.length && m.kinds.every(k => k && typeof k.listen === 'number' && Array.isArray(k.fade) && k.fade.length === 2);
    if (!ok) return false;
    MAP[lang] = { towns: m.towns, books: Object.assign({}, m.books), mix: m.mix.slice(), kinds: m.kinds.map(k => ({ listen: k.listen, fade: k.fade.slice() })) };
    return true;
  }
  // 一册书（或者以后的一个课程包）是第几级：数据里自己写了 level 就用它——以后做 4、5 级的课程包，
  // 在 BOOKS.list 里加一册、写上 level: 4，下面的 startAt 就会把 4 级的人排到它那里，这个文件不用改
  function bookLevel(lang, book) {
    if (book && okLv(book.level)) return book.level;
    const m = mapOf(lang), id = book && (book.id || book.book);
    return id && okLv(m.books[id]) ? m.books[id] : m.towns;
  }
  // 现有内容最高到第几级（结果页上「高级课程正在制作」用）
  function topLevel(lang, units) {
    return (units || []).reduce((a, u) => Math.max(a, bookLevel(lang, u)), 0);
  }
  // 第 lv 级从哪个单元开始。units：所有单元排成一列，每个至少有 { book: 册 id }（册自己有 level 的话带上）；open(i)：这个单元开没开放。
  // 返回 { i 第几个单元（-1 = 一个都没有）, level 这个单元是第几级, fit }：
  //   'exact' 正好有这一级的内容；
  //   'below' 没有这么低的内容（入门级）：从最容易的开始，多给提示；
  //   'beyond' 级别比现有内容高：从现有最难的那一册开始（结果页要说实话：高级课程还在做）；
  //   'locked' 这一级的内容有，但这台设备没开放（销售版只开放本学年）：从开放的里面最合适的开始
  function startAt(lang, lv, units, open) {
    units = units || [];
    const all = units.map((u, i) => i), lvOf = i => bookLevel(lang, units[i]);
    const pick = list => {
      if (!list.length) return { i: -1, level: -1, fit: 'none' };
      const ex = list.find(i => lvOf(i) === lv);
      if (ex != null) return { i: ex, level: lv, fit: 'exact' };
      const higher = list.filter(i => lvOf(i) > lv);
      if (higher.length) { const m = Math.min(...higher.map(lvOf)), i = higher.find(k => lvOf(k) === m); return { i, level: m, fit: 'below' }; }
      const m = Math.max(...list.map(lvOf)), top = list.filter(i => lvOf(i) === m);
      const lastBook = units[top[top.length - 1]].book, i = top.find(k => units[k].book === lastBook);
      return { i, level: m, fit: 'beyond' };
    };
    const want = pick(all), got = open ? pick(all.filter(i => open(i))) : want;
    if (got.i >= 0 && got.i !== want.i) got.fit = 'locked';
    return got;
  }
  // 这一级的出题偏好（见 MAP 的说明）
  function profile(lang, lv) {
    const m = mapOf(lang), k = clamp(lv | 0, 0, TOP);
    return { mix: m.mix[k], listen: m.kinds[k].listen, fade: m.kinds[k].fade.slice() };
  }
  // 撤提示：复习到第 box 格（掌握了的传 99）→ 0 看着念 / 1 只给首字母 / 2 凭记忆说
  function fade(lang, lv, box) {
    const f = profile(lang, lv).fade;
    return box >= f[1] ? 2 : box >= f[0] ? 1 : 0;
  }

  // ---------- 综合级别 ----------
  // sk = { vocab: { e }, listen: { e }, read: { e }, speak: { e } 或 { skip: 原因 } }
  // 规则（写给老板看的版本）：
  //   ① 先把测了的几项的估计值取平均，换成级别；
  //   ② 但不能比「听力」「口语」里低的那一项高出一级以上——这个游戏的内容是用耳朵听、用嘴说的，
  //      读写 4 级、口语 1 级的人，综合给 2 级：内容他说得出口，又比现在的口语高一点；
  //   ③ 和岛民聊天单独用「聊天级别」= 口语级别（测了的话），但不超过综合级别 + 1；口语没测就用综合级别。
  // 口语没测（没麦克风、没网、AI 没开通、自己跳过）：只用另外三项，不拿自评来顶。
  function overall(sk) {
    sk = sk || {};
    const has = s => sk[s] && typeof sk[s].e === 'number' && !sk[s].skip;
    const tested = SKILLS.filter(has);
    if (!tested.length) return { lv: -1, talk: -1, mean: -1, cap: -1, capped: false, speak: false };
    const mean = tested.reduce((a, s) => a + sk[s].e, 0) / tested.length;
    const ear = has('listen') ? levelOf(sk.listen.e) : TOP, mouth = has('speak') ? levelOf(sk.speak.e) : TOP;
    const cap = Math.min(ear, mouth) + 1, raw = levelOf(mean), lv = Math.min(raw, cap);
    const talk = has('speak') ? Math.min(mouth, lv + 1) : lv;
    return { lv, talk, mean: +mean.toFixed(2), cap, capped: lv < raw, speak: has('speak') };
  }

  // ---------- 界面上的字 ----------
  const STR = {
    zh: {
      'lv.n0': '入门', 'lv.n1': '初级', 'lv.n2': '初中级', 'lv.n3': '中级', 'lv.n4': '中高级', 'lv.n5': '高级',
      'lv.d0': '刚开始：认识几个单词，还说不了整句',
      'lv.d1': '听得懂、说得出很简单的句子，能聊自己和身边的事',
      'lv.d2': '能应付日常话题的简短对话，读懂简单的短文',
      'lv.d3': '能比较连贯地讲一件事、说出理由，读懂一般的文章',
      'lv.d4': '熟悉的话题能比较自如地讨论，读懂较长、较复杂的文章',
      'lv.d5': '能流利、准确地表达复杂的想法，几乎不受话题限制',
      'lv.cefr': '约相当于 CEFR {c}',
      'lv.tag': '{l} 级 · {n}',
      'lv.sk.vocab': '词汇', 'lv.sk.listen': '听力', 'lv.sk.read': '语法与阅读', 'lv.sk.speak': '口语',
      'lv.lang.en': '英语', 'lv.lang.es': '西班牙语', 'lv.lang.ja': '日语', 'lv.lang.zh': '中文',
    },
    en: {
      'lv.n0': 'Starter', 'lv.n1': 'Beginner', 'lv.n2': 'Elementary', 'lv.n3': 'Intermediate', 'lv.n4': 'Upper-intermediate', 'lv.n5': 'Advanced',
      'lv.d0': 'Just starting: a few words, no full sentences yet',
      'lv.d1': 'Understands and says very simple sentences about yourself and things around you',
      'lv.d2': 'Handles short everyday conversations and reads simple short texts',
      'lv.d3': 'Tells a story with reasons, and reads ordinary texts',
      'lv.d4': 'Discusses familiar topics with ease and reads longer, more complex texts',
      'lv.d5': 'Expresses complex ideas fluently and precisely on almost any topic',
      'lv.cefr': 'roughly CEFR {c}',
      'lv.tag': 'Level {l} · {n}',
      'lv.sk.vocab': 'Vocabulary', 'lv.sk.listen': 'Listening', 'lv.sk.read': 'Grammar & reading', 'lv.sk.speak': 'Speaking',
      'lv.lang.en': 'English', 'lv.lang.es': 'Spanish', 'lv.lang.ja': 'Japanese', 'lv.lang.zh': 'Chinese (Mandarin)',
    },
  };
  if (I18N) I18N.add(STR);
  const tr = (k, p, l) => (I18N ? I18N.t(k, p, l) : k);
  const name = (lv, l) => (okLv(lv) ? tr('lv.n' + lv, null, l) : '');

  const api = {
    N: CEFR.length, TOP, CEFR, SKILLS, MAP, addMap, levelOf, okLv, bookLevel, topLevel, startAt, profile, fade, overall,
    name, desc: (lv, l) => (okLv(lv) ? tr('lv.d' + lv, null, l) : ''), cefr: lv => (okLv(lv) ? CEFR[lv] : ''),
    tag: (lv, l) => (okLv(lv) ? tr('lv.tag', { l: lv, n: name(lv, l) }, l) : ''),
    skill: (s, l) => tr('lv.sk.' + s, null, l),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
