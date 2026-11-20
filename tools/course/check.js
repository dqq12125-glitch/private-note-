// 课程内容的检查：tools/course/<语言>/{syllabus.json, towns.json, units/*.json}，格式见 tools/course/SPEC.md
// 用法：node tools/course/check.js <语言> [--towns] [--units] [--quiet]
//   有一条「错」就退出码 1；「提醒」只打印、不算失败
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

const syl = syllabus();
if (!flags.has('--units')) towns();
if (!flags.has('--towns')) units(syl);
if (!flags.has('--quiet')) warn.forEach(x => console.log('提醒  ' + x));
bad.forEach(x => console.log('错    ' + x));
console.log((bad.length ? '✗ ' : '✓ ') + lang + '：' + bad.length + ' 处错，' + warn.length + ' 处提醒');
process.exit(bad.length ? 1 : 0);
