// 课程内容的检查：tools/course/<语言>/{syllabus.json, towns.json, units/*.json, lines.json, quests.json, sight.json}，格式见 tools/course/SPEC.md（台词翻译表 §8）
// 用法：node tools/course/check.js <语言> [--towns] [--units] [--quiet]
//       node tools/course/check.js <语言> --lines [别的 lines.json 文件]   只查台词翻译表（测试用自己的小样文件）
//       node tools/course/check.js <语言> --quests [文件] --sight [文件]    只查委托 / 今日目击的译文（可以和 --lines 一起写）
//   有一条「错」就退出码 1；「提醒」只打印、不算失败
// 委托 quests.json、今日目击的线索 sight.json（tools/course/TALK.md 第二轮 A；格式写在下面两个函数前面）：
//   文件还没有：只提醒「还没有」，不算错（生成课程时就没有这两样）。正式的那份要翻全（缺的列出来，算错）；
//   --quests / --sight 后面另给的文件是测试的小样，缺的只提醒。同一句英语原文在几张表里的译文不一样：算错
'use strict';
const fs = require('fs'), path = require('path');
const lang = process.argv[2];
const flags = new Set(process.argv.slice(3));
if (!/^(es|ja|zh)$/.test(lang || '')) { console.error('用法：node tools/course/check.js <es|ja|zh>'); process.exit(2); }
const DIR = path.join(__dirname, lang);
const bad = [], warn = [];
const E = (w, m) => bad.push(w + '：' + m), Wn = (w, m) => warn.push(w + '：' + m);
const str = v => typeof v === 'string' && v.trim().length > 0;
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { E(path.relative(__dirname, f), '读不了：' + e.message); return null; } };

const HAN = /[㐀-鿿豈-﫿]/;
const TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ]/;
const NEUTRAL = new Set('a ba de di le ma me men na ne ya wa la lo ge zi zhe guo bu shang xia li bian tou jia fu you xi yi shi qu lai dao huo yue qin gu qi wu xiong mei jie di po gong hu fang chuang pu luo dong hou sheng fen yang liang kan guan chu xie'.split(' '));
const words = s => String(s).trim().split(/\s+/).filter(Boolean);
const hanCount = s => (String(s).match(/[㐀-鿿豈-﫿]/g) || []).length;

// 读音
function reading(w, r, text) {
  if (lang === 'es') { if (r != null) Wn(w, '西语不用写 r'); return; }
  if (!str(r)) { E(w, '缺读音 r'); return; }
  if (lang === 'ja') {
    if (HAN.test(r)) E(w, '读音里有汉字：' + r);
    if (/[A-Za-z]/.test(r) && !/[A-Za-z]/.test(text)) E(w, '读音里有拉丁字母：' + r);
  } else {
    if (/\d/.test(r)) E(w, '拼音用声调符号，不用数字：' + r);
    if (HAN.test(r)) E(w, '拼音里有汉字：' + r);
    const syl = words(r.replace(/[，。！？、,.!?…—《》“”"':：；;（）()]/g, ' '));
    const n = hanCount(text);
    const er = syl.filter(s => /r$/.test(s) && !/^[eēéěè]r$/.test(s)).length;   // 儿化：一个音节管两个字
    if (n && syl.length !== n && syl.length + er !== n) E(w, '拼音音节数（' + syl.length + '）和汉字数（' + n + '）对不上：' + text + ' / ' + r);
    // 轻声的音节本来就没有声调符号（péng you、xiè xie），机器分不出「轻声」和「漏标」：只在整块一个声调都没有、又不是语气词 / 助词时提醒
    if (syl.length && !syl.some(s => TONE.test(s)) && !/^[的了吗呢吧啊着过们子个地得呀嘛啦哦么，。！？、]+$/.test(text) && !syl.every(s => NEUTRAL.has(s.toLowerCase()))) Wn(w, '这一块一个声调都没有（都是轻声的话不用管）：' + text + ' / ' + r);
  }
}
// 意思
function mean(w, e, word) {
  if (!str(e.en)) E(w, '缺英文意思 en');
  if (lang !== 'zh' && !str(e.zh)) E(w, '缺中文意思 zh');
  if (word) {
    if (str(e.zh) && [...e.zh].length > 8) E(w, '中文意思超过 8 个字：' + e.zh);
    if (str(e.en) && words(e.en).length > 5) E(w, '英文意思超过 5 个词：' + e.en);
  }
}
function punct(w, t) {
  if (lang !== 'es') return;
  const c = ch => (t.match(new RegExp('\\' + ch, 'g')) || []).length;
  if (c('¿') !== c('?')) E(w, '¿ 和 ? 不成对：' + t);
  if (c('¡') !== c('!')) E(w, '¡ 和 ! 不成对：' + t);
}
// 一个词
function word(w, e) {
  if (!e || !str(e.t)) { E(w, '缺 t'); return; }
  mean(w, e, true); reading(w, e.r, e.t);
  if (e.seg != null) Wn(w, '词不用写 seg');
}
// 一句话；lim = [最少几块, 最多几块]
function sent(w, e, lim) {
  if (!e || !str(e.t)) { E(w, '缺 t'); return 0; }
  mean(w, e, false); punct(w, e.t);
  let n;
  if (lang === 'es') {
    if (e.seg != null && e.seg.join(' ') !== e.t) E(w, 'seg 用空格接起来和 t 不一样');
    n = words(e.t).length;
  } else {
    if (!Array.isArray(e.seg) || !e.seg.every(str)) { E(w, '缺 seg（把 t 切成词块）'); return 0; }
    if (e.seg.join('') !== e.t) E(w, 'seg 接起来和 t 不一样：' + e.seg.join('|') + ' ≠ ' + e.t);
    if (!Array.isArray(e.r) || e.r.length !== e.seg.length) E(w, 'r 要和 seg 一样多（' + (Array.isArray(e.r) ? e.r.length : '不是数组') + ' / ' + e.seg.length + '）');
    else e.seg.forEach((s, i) => reading(w + ' 第 ' + (i + 1) + ' 块', e.r[i], s));
    if (lang === 'ja') e.seg.forEach(s => { if ([...s.replace(/[。、！？「」]/g, '')].length > 8) Wn(w, '这一块太长，再切一下：' + s); });
    n = e.seg.length;
  }
  if (lim && (n < lim[0] || n > lim[1])) E(w, '长度 ' + n + ' 不在 ' + lim[0] + '–' + lim[1] + ' 之间：' + e.t);
  return n;
}
const dup = (w, list, f, what) => {
  const seen = new Map();
  list.forEach((x, i) => { const k = f(x); if (!k) return; if (seen.has(k)) E(w, what + '重复：' + k + '（第 ' + (seen.get(k) + 1) + ' 和第 ' + (i + 1) + ' 条）'); else seen.set(k, i); });
};
const lower = s => String(s || '').trim().toLowerCase();

// 小镇 / 单元共用
function body(w, u, need, lim) {
  const ws = Array.isArray(u.words) ? u.words : [], ss = Array.isArray(u.sents) ? u.sents : [], ds = Array.isArray(u.dlgs) ? u.dlgs : [];
  if (ws.length < need.words[0] || ws.length > need.words[1]) E(w, 'words 要 ' + need.words.join('–') + ' 个，现在 ' + ws.length);
  if (ss.length !== need.sents) E(w, 'sents 要 ' + need.sents + ' 句，现在 ' + ss.length);
  if (ds.length < need.dlgs[0] || ds.length > need.dlgs[1]) E(w, 'dlgs 要 ' + need.dlgs.join('–') + ' 段，现在 ' + ds.length);
  ws.forEach((e, i) => word(w + ' 词 ' + (i + 1), e));
  const pics = ws.filter(e => e && str(e.pic));
  if (pics.length < Math.ceil(ws.length * need.pic)) E(w, '带图 pic 的词不够：' + pics.length + ' / ' + ws.length);
  dup(w, pics, e => e.pic, '图 ');
  dup(w, ws, e => e && lower(e.t), '词 ');
  dup(w, ws, e => e && lower(e.en), '英文意思 ');
  if (lang !== 'zh') dup(w, ws, e => e && lower(e.zh), '中文意思 ');
  ss.forEach((e, i) => sent(w + ' 句 ' + (i + 1), e, lim));
  dup(w, ss, e => e && lower(e.t), '句子 ');
  ds.forEach((d, i) => {
    const x = w + ' 对话 ' + (i + 1);
    if (!d || !d.q || !d.a || !Array.isArray(d.wrong)) { E(x, '要有 q、a、wrong'); return; }
    sent(x + ' 问', d.q); sent(x + ' 答', d.a);
    if (d.wrong.length !== 2) E(x, 'wrong 要 2 句');
    d.wrong.forEach((e, k) => { sent(x + ' 错 ' + (k + 1), e); if (e && d.a && lower(e.t) === lower(d.a.t)) E(x, '错的选项和对的回答一样'); });
    dup(x, d.wrong, e => e && lower(e.t), '错的选项 ');
  });
  dup(w, ds, d => d && d.q && lower(d.q.t), '问句 ');
  if (!u.boss || !str(u.boss.t)) E(w, '缺 boss.t'); else { mean(w + ' boss', u.boss, false); bossRead(w + ' boss', u.boss); }
}
// 岛主的话是两三句连着的：读音是一整串（中文不逐字核对音节，只查有没有）
function bossRead(w, b) {
  if (lang === 'es') return;
  if (!str(b.r)) { E(w, '缺读音 r'); return; }
  if (lang === 'ja' && HAN.test(b.r)) E(w, '读音里有汉字');
  if (lang === 'zh') reading(w, b.r, b.t);
}

// ---------- 大纲 ----------
function syllabus() {
  const f = path.join(DIR, 'syllabus.json');
  if (!fs.existsSync(f)) { Wn('syllabus.json', '还没有'); return null; }
  const s = read(f); if (!s) return null;
  if (s.lang !== lang) E('syllabus', 'lang 要是 ' + lang);
  if (!s.name || !str(s.name.zh) || !str(s.name.en) || !str(s.name.self)) E('syllabus', 'name 要有 zh / en / self');
  if (!str(s.notes)) E('syllabus', '缺 notes（设计思路）');
  if (!Array.isArray(s.towns) || s.towns.length !== 13) E('syllabus', 'towns 要 13 个');
  else s.towns.forEach((t, i) => { if (t.i !== i) E('syllabus 小镇 ' + i, 'i 要是 ' + i); if (!str(t.focus)) E('syllabus 小镇 ' + i, '缺 focus'); });
  if (!Array.isArray(s.books) || s.books.length !== 3) E('syllabus', 'books 要 3 册（1、2、3 级）');
  else s.books.forEach((b, k) => {
    const w = 'syllabus 第 ' + (k + 1) + ' 册';
    if (b.id !== lang + (k + 1)) E(w, 'id 要是 ' + lang + (k + 1));
    if (b.level !== k + 1) E(w, 'level 要是 ' + (k + 1));
    if (!b.name || !str(b.name.zh) || !str(b.name.en)) E(w, 'name 要有 zh / en');
    if (!Array.isArray(b.units) || b.units.length !== 8) { E(w, 'units 要 8 个'); return; }
    b.units.forEach((u, i) => {
      const x = w + ' 单元 ' + (i + 1);
      if (u.n !== i + 1) E(x, 'n 要是 ' + (i + 1));
      for (const k2 of ['t', 'zh', 'en', 'grammar', 'topics']) if (!str(u[k2]) && !(lang === 'zh' && k2 === 'zh')) E(x, '缺 ' + k2);
      if (!u.cando || !str(u.cando.zh) || !str(u.cando.en)) E(x, 'cando 要有 zh / en');
    });
  });
  return s;
}
// ---------- 小镇 ----------
function towns() {
  const f = path.join(DIR, 'towns.json');
  if (!fs.existsSync(f)) { Wn('towns.json', '还没有'); return; }
  const a = read(f); if (!a) return;
  if (!Array.isArray(a) || a.length !== 13) { E('towns', '要 13 个小镇，现在 ' + (Array.isArray(a) ? a.length : '不是数组')); if (!Array.isArray(a)) return; }
  const all = new Map();
  a.forEach((u, i) => {
    const w = '小镇 ' + i;
    if (!u || u.i !== i) E(w, 'i 要是 ' + i);
    if (!str(u.t)) E(w, '缺岛名 t');
    body(w, u, { words: [12, 13], sents: 8, dlgs: [6, 7], pic: 1 }, lang === 'es' ? [2, 10] : [2, 8]);
    (u.words || []).forEach(e => { if (!e || !str(e.t)) return; const k = lower(e.t); if (all.has(k)) Wn(w, '这个词第 ' + all.get(k) + ' 岛教过：' + e.t); else all.set(k, i); });
    const sc = u.scene;
    if (!sc || !Array.isArray(sc.cast) || sc.cast.length !== 2 || !Array.isArray(sc.lines)) { E(w, '缺 scene（cast 两个人 + lines）'); return; }
    sc.cast.forEach((c, k) => { if (!Array.isArray(c) || !str(c[0]) || !str(c[1]) || !/^[fm]$/.test(c[2])) E(w + ' scene', 'cast 第 ' + (k + 1) + ' 个要写成 ["名字", "👧", "f"]'); });
    if (sc.lines.length < 8 || sc.lines.length > 10) E(w + ' scene', 'lines 要 8–10 句，现在 ' + sc.lines.length);
    sc.lines.forEach((l, k) => {
      const x = w + ' scene 第 ' + (k + 1) + ' 句';
      if (!l || (l.who !== 0 && l.who !== 1)) E(x, 'who 要是 0 或 1');
      if (!l || !str(l.t)) { E(x, '缺 t'); return; }
      mean(x, l, false); punct(x, l.t); bossRead(x, l);
    });
  });
}
// ---------- 单元 ----------
function units(syl) {
  const d = path.join(DIR, 'units');
  if (!fs.existsSync(d)) { Wn('units/', '还没有'); return; }
  const files = fs.readdirSync(d).filter(f => /\.json$/.test(f)).sort();
  const bossNames = new Map();
  files.forEach(f => {
    const u = read(path.join(d, f)); if (!u) return;
    const w = 'units/' + f, m = /^([a-z]{2}\d)-(\d)\.json$/.exec(f);
    if (!m) { E(w, '文件名要写成 <册 id>-<n>.json'); return; }
    if (u.book !== m[1] || u.n !== +m[2]) E(w, 'book / n 和文件名对不上');
    for (const k of ['t', 'en', 'icon', 'color']) if (!str(u[k])) E(w, '缺 ' + k);
    if (lang !== 'zh' && !str(u.zh)) E(w, '缺 zh');
    if (str(u.color) && !/^#[0-9A-Fa-f]{6}$/.test(u.color)) E(w, 'color 要写成 #RRGGBB');
    if (!u.key || !str(u.key.t)) E(w, '缺 key.t'); else mean(w + ' key', u.key, false);
    const g = u.grammar;
    if (!g || !g.title || !g.tip || !str(g.title.zh) || !str(g.title.en) || !str(g.tip.zh) || !str(g.tip.en)) E(w, 'grammar 要有 title / tip 的 zh 和 en');
    body(w, u, { words: [24, 24], sents: 16, dlgs: [12, 12], pic: 0.5 }, lang === 'es' ? [2, 16] : [2, 12]);
    const b = u.boss || {};
    if (!str(b.emoji) || !b.name || !str(b.name.zh) || !str(b.name.en)) E(w, 'boss 要有 emoji 和 name 的 zh / en');
    else {
      // 名字按第一个词算（Paco the Octopus / Paco the Pelican 也算重名），Boss 和聊天角色放在一起查：两个人写的单元容易撞名
      const k = lower(b.name.en).split(/\s+/)[0];
      if (bossNames.has(k)) E(w, 'Boss 名字和 ' + bossNames.get(k) + ' 里的角色重名：' + b.name.en); else bossNames.set(k, f);
    }
    if (u.talk && str(u.talk.name)) { const k = lower(u.talk.name).replace(/\s+/g, ''); if (bossNames.has(k)) E(w, '聊天角色和 ' + bossNames.get(k) + ' 里的角色重名：' + u.talk.name); else bossNames.set(k, f); }
    const t = u.talk;
    if (!t) { E(w, '缺 talk'); return; }
    for (const k of ['name', 'persona']) if (!str(t[k])) E(w + ' talk', '缺 ' + k);
    if (!/^[fm]$/.test(t.gender || '')) E(w + ' talk', 'gender 要是 f 或 m');
    for (const k of ['topic', 'goal']) if (!t[k] || !str(t[k].zh) || !str(t[k].en)) E(w + ' talk', k + ' 要有 zh / en');
    if (!t.opener || !str(t.opener.t)) E(w + ' talk', '缺 opener.t');
    if (!Array.isArray(t.steps) || t.steps.length < 3 || t.steps.length > 4) E(w + ' talk', 'steps 要 3–4 步');
    else t.steps.forEach((s, i) => { if (!s || !str(s.zh) || !str(s.en) || !str(s.t)) E(w + ' talk 第 ' + (i + 1) + ' 步', '要有 zh / en / t'); });
    if (!Array.isArray(t.words) || t.words.length < 6 || t.words.length > 8) E(w + ' talk', 'words 要 6–8 个');
  });
  if (syl && Array.isArray(syl.books)) syl.books.forEach(b => (b.units || []).forEach(u => { const f = b.id + '-' + u.n + '.json'; if (!files.includes(f)) Wn('units/', '大纲里有、还没写：' + f); }));
}

// ---------- 台词翻译表 lines.json（SPEC §8）：有就查；没翻的只是提醒 ----------
const PHS = s => (String(s).match(/\{[a-z0-9]+\}/g) || []);
// 日语 / 中文里剩下的英文词：原文里大写开头的（人名、怪兽名、地名）可以留着，别的算没翻干净
// 西语里剩下的英语：这些词西语里没有
const EN_ONLY = new Set("the you your is are and with this that what where here there it its it's let's don't i'm can't won't please thank thanks hello yes of to in on at for from be will can have has".split(' '));
// 一句译文、一个词的检查（台词翻译表、委托、今日目击共用）
const val = v => (typeof v === 'string' ? { t: v } : v && typeof v === 'object' ? v : null);
const kana = lang !== 'es';
// 一句（或模板）的译文：holes = 必须正好出现一次的 {…}（模板的空），vars = {name} / {rival}（个数和原文一样）
function one(w, v, en, holes, vars) {
  const x = val(v);
  if (!x || !str(x.t)) { E(w, '要写译文 t'); return; }
  const texts = [x.t].concat(x.f != null ? [x.f] : []);
  if (x.f != null && (!holes.length || lang !== 'es')) E(w, 'f（阴性的那一句）只有西语模板能写');
  for (const t of texts) {
    punct(w, t);
    const got = PHS(t), want = holes.concat(vars);
    for (const h of holes) { const n = got.filter(g => g === h).length; if (n !== 1) E(w, h + ' 要正好出现一次（现在 ' + n + ' 次）：' + t); }
    for (const p of new Set(vars)) { const n = got.filter(g => g === p).length, m = vars.filter(g => g === p).length; if (n !== m) E(w, p + ' 要和原文一样出现 ' + m + ' 次（现在 ' + n + ' 次）：' + t); }
    for (const g of got) if (!want.includes(g)) E(w, '多出来的 ' + g + '（原文里没有这个空）：' + t);
    // 剩下的英语
    const bare = t.replace(/\{[a-z0-9]+\}/g, ' ');
    const names = new Set((String(en).match(/\b[A-Z][A-Za-z'-]*/g) || []).map(s => s.replace(/'s$/, '')));
    if (kana) { for (const wd of bare.match(/[A-Za-z][A-Za-z'-]*/g) || []) if (!names.has(wd.replace(/'s$/, '')) && wd !== 'OK') E(w, '还有英文词「' + wd + '」（专有名词以外要翻）：' + t); }
    else {
      for (const wd of bare.toLowerCase().match(/[a-z][a-z'’]*/g) || []) if (EN_ONLY.has(wd.replace(/’/g, "'"))) E(w, '还有英语的「' + wd + '」：' + t);
      // 和英语原文一样：一个词的（音符 Sol、人名、Hmm）可能本来就一样，只提醒；一句话一样算没翻
      const bareEn = String(en).replace(/\{[a-z0-9]+\}/g, '').trim();
      if (lower(t.replace(/\{[a-z0-9]+\}/g, '')) === lower(bareEn) && /[a-z]{2,}/.test(bareEn)) (/\s/.test(bareEn) ? E : Wn)(w, '和英语原文一样' + (/\s/.test(bareEn) ? '，没翻' : '（一个词，确认一下是不是本来就一样）') + '：' + t);
    }
  }
  // 这句自己的意思（可选，SPEC §8.2）：译文改写过、原来的意思对不上了才写；只给整句（模板的意思游戏里跟着空换）
  for (const k of ['zh', 'en']) {
    if (x[k] == null) continue;
    if (holes.length) { E(w, k + '（这句的意思）只给整句写，模板不写'); continue; }
    if (!str(x[k])) { E(w, k + '（这句的意思）要写成一句话'); continue; }
    if (k === 'zh' && !HAN.test(x[k])) E(w, 'zh 要写中文：' + x[k]);
    if (k === 'en' && HAN.test(x[k])) E(w, 'en 里不能有中文：' + x[k]);
    for (const p of new Set(vars)) if (PHS(x[k]).filter(g => g === p).length !== vars.filter(g => g === p).length) E(w, k + ' 里的 ' + p + ' 要和原文一样多：' + x[k]);
  }
  if (!kana) { if (x.seg != null || x.r != null) Wn(w, '西语不用写 seg / r'); return; }
  if (!Array.isArray(x.seg) || !x.seg.every(str)) { E(w, '缺 seg（把 t 切成词块，§1）'); return; }
  if (x.seg.join('') !== x.t) E(w, 'seg 接起来和 t 不一样：' + x.seg.join('|') + ' ≠ ' + x.t);
  if (!Array.isArray(x.r) || x.r.length !== x.seg.length) { E(w, 'r 要和 seg 一样多（' + (Array.isArray(x.r) ? x.r.length : '不是数组') + ' / ' + x.seg.length + '）'); return; }
  x.seg.forEach((s, i) => {
    const ph = PHS(s);
    if (ph.length) {
      // 空（或 {name}）自己一块，后面最多跟标点；这一块的 r 就是那个空
      if (ph.length > 1 || s.replace(ph[0], '').replace(/[\s、。，．,.!！?？;；:：「」『』（）()…〜～“”‘’"'«»《》]/g, '') !== '') E(w, '第 ' + (i + 1) + ' 块：' + ph[0] + ' 要自己一块（后面只能跟标点）：' + s);
      if (x.r[i] !== ph[0]) E(w, '第 ' + (i + 1) + ' 块的 r 要写 ' + ph[0] + '：' + x.r[i]);
      return;
    }
    reading(w + ' 第 ' + (i + 1) + ' 块', x.r[i], s);
  });
}
function term(w, v) {
  const x = val(v);
  if (!x || !str(x.t)) { E(w, '要写译文 t'); return; }
  if (x.g != null && !/^[mf]$/.test(x.g)) E(w, 'g 只能是 m 或 f');
  if (x.g != null && lang !== 'es') Wn(w, 'g（阴性 / 阳性）只给西语用');
  if (kana) { if (!str(x.r)) E(w, '缺读音 r（一个字符串）'); else reading(w, x.r, x.t); }
  else if (x.r != null) Wn(w, '西语不用写 r');
}
const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
// 同一句英语原文在几张表里（台词翻译表、委托、今日目击）的译文要一样：生成课程时都并进 LINES（键是英语原文），不一样并不到一起
const SAME = new Map();
function same(en, v, w) {
  const x = val(v);
  if (!x || !str(x.t)) return;
  const o = SAME.get(en);
  if (!o) SAME.set(en, { t: x.t, w });
  else if (o.t !== x.t) E(w, '和「' + o.w + '」是同一句英语原文，译文却不一样（生成时并不到一起）：' + x.t + ' ≠ ' + o.t);
}
function linesJson(fileArg) {
  const f = fileArg || path.join(DIR, 'lines.json');
  if (!fs.existsSync(f)) return;
  const J = read(f); if (!J) return;
  const srcF = path.join(__dirname, 'lines-src.json');
  if (!fs.existsSync(srcF)) { E('lines.json', '没有 tools/course/lines-src.json：先跑 node tools/course/lines.js'); return; }
  const SRC = read(srcF); if (!SRC) return;
  if (J.lang != null && J.lang !== lang) E('lines.json', 'lang 要是 ' + lang);
  const LI = new Map(SRC.lines.map(x => [x.id, x])), TI = new Map(SRC.templates.map(x => [x.id, x]));
  const lines = J.lines && typeof J.lines === 'object' ? J.lines : {}, tpls = J.templates && typeof J.templates === 'object' ? J.templates : {}, terms = J.terms && typeof J.terms === 'object' ? J.terms : {};
  for (const [id, v] of Object.entries(lines)) {
    const s = LI.get(id);
    // 原文删了 / 改了（lines-src.json 重新生成过）：这一条用不上了，只提醒（生成课程时不带它）
    if (!s) { Wn('lines.json 台词 ' + id, 'lines-src.json 里没有这个 id（原文改了或删了，这条用不上，删掉它）'); continue; }
    one('lines.json 台词 ' + id, v, s.en, [], PHS(s.en));
    same(s.en, v, 'lines.json 台词 ' + id);
  }
  for (const [id, v] of Object.entries(tpls)) {
    const s = TI.get(id), w = 'lines.json 模板 ' + id;
    if (!s) { Wn(w, 'lines-src.json 里没有这个 id（原文改了或删了，这条用不上，删掉它）'); continue; }
    const holes = Object.keys(s.slots).map(k => '{' + k + '}');
    one(w, v, s.en, holes, PHS(s.en).filter(p => !holes.includes(p)));
    const x = val(v);
    if (x && x.vals != null) {
      if (typeof x.vals !== 'object') E(w, 'vals 要写成 { 空: { 英文值: 译文 } }');
      else for (const [k, m] of Object.entries(x.vals)) {
        if (s.slots[k] !== 'free') { E(w, 'vals 只给 free 的空（' + k + ' 是 ' + (s.slots[k] || '没有的空') + '）'); continue; }
        for (const [ev, tv] of Object.entries(m || {})) term(w + ' vals.' + k + '「' + ev + '」', tv);
      }
    }
  }
  for (const [ty, m] of Object.entries(terms)) {
    const known = new Map((SRC.terms[ty] || []).map(x => [x.id, x]));
    if (!SRC.terms[ty]) { E('lines.json terms', '没有这一类：' + ty); continue; }
    for (const [id, v] of Object.entries(m || {})) {
      if (!known.has(id)) { Wn('lines.json 词 ' + ty + '.' + id, 'lines-src.json 里没有这个词（删掉它）'); continue; }
      term('lines.json 词 ' + ty + '.' + id, v);
    }
  }
  // 没翻的：按 kind 数一数（提醒）
  const miss = {};
  for (const s of SRC.lines) if (!(s.id in lines)) miss[s.kind] = (miss[s.kind] || 0) + 1;
  const mt = SRC.templates.filter(s => !(s.id in tpls)).length;
  const mterm = Object.entries(SRC.terms).map(([ty, a]) => [ty, a.filter(x => !(terms[ty] && x.id in terms[ty])).length]).filter(([, n]) => n);
  if (Object.keys(miss).length || mt || mterm.length) {
    Wn('lines.json', '还没翻：台词 ' + (Object.entries(miss).map(([k, n]) => k + ' ' + n).join('、') || '0') + '；模板 ' + mt + ' 个；词 ' + (mterm.map(([k, n]) => k + ' ' + n).join('、') || '0') +
      '（没翻的在游戏里按 ENGINE.md §5 的过渡办法）');
  }
}

// ---------- 支线委托 quests.json（TALK.md 第二轮 A1）：英语原文在仓库根目录的 quests.js ----------
// { "lang": "ja", "quests": { 委托 id: { ask: [条目…], note: 条目, opener: 条目, steps: [条目…], words: [词…], thanks: [条目…], bye: 条目 } } }
// 条目和 lines.json 的整句一样写（西语字符串；日语、中文 { t, seg, r }），词是 { t, r }（西语字符串）。
// ask / steps / words / thanks 和 quests.js 一个对一个（个数、先后一样）；note 只有 quests.js 有旁白的那几条写。
// 正式的那份（tools/course/<语言>/quests.json）每条委托都要有；--quests 另给的文件是测试的小样，缺的只提醒
function questsJson(fileArg) {
  const f = fileArg || path.join(DIR, 'quests.json'), sample = !!fileArg;
  if (!fs.existsSync(f)) { Wn('quests.json', '还没有（这门课的支线委托照旧不开）'); return; }
  const J = read(f); if (!J) return;
  let Q = null;
  try { Q = require(path.join(__dirname, '..', '..', 'quests.js')); } catch (e) { Q = null; }
  if (!Q || !Array.isArray(Q.list)) { E('quests.json', '读不了仓库根目录的 quests.js（委托的英语原文）'); return; }
  if (J.lang != null && J.lang !== lang) E('quests.json', 'lang 要是 ' + lang);
  const T = J.quests && typeof J.quests === 'object' && !Array.isArray(J.quests) ? J.quests : null;
  if (!T) { E('quests.json', '要写成 { "lang": "' + lang + '", "quests": { 委托 id: { ask, opener, steps, words, thanks, bye } } }'); return; }
  const KEYS = ['ask', 'note', 'opener', 'steps', 'words', 'thanks', 'bye'];
  for (const id of Object.keys(T)) if (!own(Q.byId, id)) Wn('quests.json ' + id, 'quests.js 里没有这条委托（id 写错了，或者原文删了；生成时不带它）');
  const miss = [];
  for (const q of Q.list) {
    const w = 'quests.json ' + q.id, x = own(T, q.id) ? T[q.id] : null;
    if (x == null) { miss.push(q.id); continue; }
    if (typeof x !== 'object' || Array.isArray(x)) { E(w, '要写成 { ask, opener, steps, words, thanks, bye }'); continue; }
    for (const k of Object.keys(x)) if (!KEYS.includes(k)) Wn(w, '多出来的字段 ' + k + '（只认 ' + KEYS.join(' / ') + '）');
    // 对话框里的固定台词（请求、旁白、感谢、做完以后的那一句）：生成时并进 LINES，键是英语原文
    const line = (w2, v, en) => { one(w2, v, en, [], PHS(en)); same(en, v, w2); };
    // 聊天里的话（开场白、每一步的示范句）：只查写法，不进 LINES
    const say = (w2, v, en) => one(w2, v, en, [], PHS(en));
    const list = (k, src, each) => {
      const a = x[k];
      if (!Array.isArray(a)) { E(w, '缺 ' + k + '（一列，和 quests.js 的 ' + k + ' 一个对一个）'); return; }
      if (a.length !== src.length) E(w, k + ' 要 ' + src.length + ' 条（和 quests.js 一样多、同样的先后），现在 ' + a.length + ' 条');
      a.slice(0, src.length).forEach((v, i) => each(w + ' ' + k + ' 第 ' + (i + 1) + ' 条', v, src[i]));
    };
    list('ask', q.ask, (w2, v, s) => line(w2, v, s[0]));
    if (q.note) { if (x.note == null) E(w, '缺 note（quests.js 这条有一页旁白）'); else line(w + ' note', x.note, q.note[0]); }
    else if (x.note != null) Wn(w, 'quests.js 这条没有旁白，note 不用写（生成时不带它）');
    if (x.opener == null) E(w, '缺 opener（聊天的开场白）'); else say(w + ' opener', x.opener, q.opener);
    list('steps', q.steps, (w2, v, s) => say(w2, v, s[1]));
    list('words', q.words, (w2, v) => term(w2, v));
    list('thanks', q.thanks, (w2, v, s) => line(w2, v, s[0]));
    if (x.bye == null) E(w, '缺 bye（做完以后再找 TA 时说的那一句）'); else line(w + ' bye', x.bye, q.bye[0]);
  }
  if (miss.length) (sample ? Wn : E)('quests.json', (sample ? '小样里没有的委托 ' : '还没翻的委托 ') + miss.length + ' 条（一共 ' + Q.list.length + ' 条' + (sample ? '' : '，都要有') + '）：' + miss.join('、'));
}

// ---------- 今日目击的线索 sight.json（TALK.md 第二轮 A2）：英语原句在 tools/course/sight-src.json ----------
// { "lang": "es", "lines": { "<英语原句，一字不差当键>": 条目 } }，条目和 lines.json 的整句一样写。
// 正式的那份每一句都要有；--sight 另给的文件是测试的小样，缺的只提醒。
// 线索要是真的：方向、颜色最容易翻错，译文里找不到对应的说法时提醒一句（换了别的说法就确认一遍；地形、大小、属性名机器认不出来，要人看）
const DIRS = {
  es: { north: /\bnorte\b/i, south: /\bsur\b/i, east: /\beste\b/i, west: /\boeste\b/i },
  ja: { north: /北|きた/, south: /南|みなみ/, east: /東|ひがし/, west: /西|にし/ },
  zh: { north: /北/, south: /南/, east: /东/, west: /西/ },
};
const COLS = {
  es: { blue: /azul/i, green: /verde/i, grey: /gris/i, orange: /naranja|anaranjad/i, white: /blanc[oa]/i, yellow: /amarill[oa]/i, red: /roj[oa]/i },
  ja: { blue: /青|あお|ブルー/, green: /緑|みどり|グリーン/, grey: /灰|はいいろ|グレー|ねずみ/, orange: /オレンジ|だいだい|橙/, white: /白|しろ/, yellow: /黄|きいろ/, red: /赤|あか/ },
  zh: { blue: /蓝/, green: /绿/, grey: /灰/, orange: /橙|橘/, white: /白/, yellow: /黄/, red: /红/ },
};
function sightJson(fileArg) {
  const f = fileArg || path.join(DIR, 'sight.json'), sample = !!fileArg;
  if (!fs.existsSync(f)) { Wn('sight.json', '还没有（这门课的今日目击照旧不开）'); return; }
  const J = read(f); if (!J) return;
  const srcF = path.join(__dirname, 'sight-src.json');
  if (!fs.existsSync(srcF)) { E('sight.json', '没有 tools/course/sight-src.json（今日目击的英语原句）'); return; }
  const SRC = read(srcF); if (!SRC) return;
  const all = Array.isArray(SRC.lines) ? SRC.lines.filter(str) : [];
  if (J.lang != null && J.lang !== lang) E('sight.json', 'lang 要是 ' + lang);
  const T = J.lines && typeof J.lines === 'object' && !Array.isArray(J.lines) ? J.lines : null;
  if (!T) { E('sight.json', '要写成 { "lang": "' + lang + '", "lines": { "英语原句": 译文 } }'); return; }
  const known = new Set(all);
  for (const en of Object.keys(T)) if (!known.has(en)) Wn('sight.json', 'sight-src.json 里没有这一句（键要和英语原句一字不差；原句改了就删掉它，生成时不带）：' + en);
  const miss = [];
  all.forEach((en, i) => {
    if (!own(T, en)) { miss.push(en); return; }
    const w = 'sight.json 第 ' + (i + 1) + ' 句「' + en + '」';
    one(w, T[en], en, [], []);
    same(en, T[en], w);
    const x = val(T[en]), t = x && str(x.t) ? x.t : '';
    if (!t) return;
    for (const [k, re] of Object.entries(DIRS[lang])) if (new RegExp('\\bGo ' + k + '\\b').test(en) && !re.test(t)) Wn(w, '原句是往 ' + k + ' 走，译文里没找到这个方向（方向不能翻错）：' + t);
    for (const [k, re] of Object.entries(COLS[lang])) if (new RegExp('\\b' + k + '\\b', 'i').test(en) && !re.test(t)) Wn(w, '原句里的颜色 ' + k + ' 在译文里没找到（颜色不能翻错）：' + t);
  });
  if (miss.length) (sample ? Wn : E)('sight.json', (sample ? '小样里没有的线索 ' : '还没翻的线索 ') + miss.length + ' 句（一共 ' + all.length + ' 句' + (sample ? '' : '，每一句都要有') + '）：' +
    miss.slice(0, 20).join(' | ') + (miss.length > 20 ? ' | ……' : ''));
}

// 只查某几张表：--lines / --quests / --sight，后面可以跟一个 .json（测试的小样；不跟就是这门语言正式的那份）
const ARGV = process.argv.slice(3), ONLY = ['--lines', '--quests', '--sight'].filter(x => flags.has(x));
const fileAfter = flag => { const i = ARGV.indexOf(flag), a = i >= 0 ? ARGV[i + 1] : ''; return a && /\.json$/i.test(a) ? path.resolve(a) : null; };
if (ONLY.length) {
  // 老写法「--lines 文件」文件不一定紧跟在后面：只有 --lines 一个时照旧认参数里的第一个 .json
  const any = ONLY.length === 1 ? ARGV.find(a => /\.json$/i.test(a)) : null;
  if (flags.has('--lines')) linesJson(fileAfter('--lines') || (any ? path.resolve(any) : null));
  if (flags.has('--quests')) questsJson(fileAfter('--quests') || (any ? path.resolve(any) : null));
  if (flags.has('--sight')) sightJson(fileAfter('--sight') || (any ? path.resolve(any) : null));
  if (!flags.has('--quiet')) warn.forEach(x => console.log('提醒  ' + x));
  bad.forEach(x => console.log('错    ' + x));
  console.log((bad.length ? '✗ ' : '✓ ') + lang + ' ' + ONLY.map(x => x.slice(2) + '.json').join(' / ') + '：' + bad.length + ' 处错，' + warn.length + ' 处提醒');
  process.exit(bad.length ? 1 : 0);
}
const syl = syllabus();
if (!flags.has('--units')) towns();
if (!flags.has('--towns')) units(syl);
if (!flags.has('--towns') && !flags.has('--units')) { linesJson(); questsJson(); sightJson(); }
if (!flags.has('--quiet')) warn.forEach(x => console.log('提醒  ' + x));
bad.forEach(x => console.log('错    ' + x));
console.log((bad.length ? '✗ ' : '✓ ') + lang + '：' + bad.length + ' 处错，' + warn.length + ' 处提醒');
process.exit(bad.length ? 1 : 0);
