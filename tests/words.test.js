// 单词表、先认识再闯关（单词卡）、我的单词本、发音入门、日语罗马字（tools/course/WORDS.md 第 1–5 条）+ 零基础怎么学（第 7–11 条）；Playwright Chromium，约 3–4 分钟
//   node tests/words.test.js [--only=en,p2,ja,zh,es,real]
//   第二部分：en 里第一次进第 1 关先出「这一课学什么」（例句一字不差、对话里的问答不显示空的意思行）再单词卡；英语界面 / 横屏的课前讲解、求助的话；
//   p2（英语课）：求助的话那张表、聊天页的 🆘、新手路线（每一步、打勾、点了去那里、收成「下一课」、第 3 岛以后不出）、点词看意思（例句、闯关题目、
//   点外面收起、查不到不弹）、朗读慢一点（0.8 倍速、🐢 这一次 0.6、零基础默认慢）；ja / zh / es：用正式的 lessons.json——课前讲解（读音、拼音、罗马字、意思）、
//   发音入门最后一段是求助的话（🔊 放课程包里的那句）、日语例句里点「先生」弹小卡、罗马字按词分开（ohayou gozaimasu、tanaka sensei）
// 自己起本机小网站（游戏文件 + /packs/ 课程包小样）。英语课是老模式（配音在 assets/voice，放了哪段看 <audio> 的地址）；
// 别的课的课程内容是 tools/course/build.js 对真的源文件出的 course.json，发音入门用这里造的小样（每门语言两段、几格），配音是借来的一段假字节，
// 放了哪段看 EchoPacks.hasClip 收到的 key；手机自带的声音是假的 speechSynthesis（记下 text / lang / rate）。
//   en（英语课，中文界面竖屏 + 英语界面 + 横屏）：
//     1 闯关练习页最上面「📒 我的单词本（学过 n 个词）」、每个小镇 / 单元卡片上「📖 单词表」
//     2 单词表：每个词一行（图、词、意思、🔊、状态 🆕 / 🔁 / ✅ 照复习本）、例句（这一课 sents 里第一句含这个词的）、常用句子收起来、
//       长表滚到底关闭按钮还在屏幕里；点 🔊 放的是这个词的配音
//     3 关卡详情：「先预习一下」换成「📖 单词表」，关上回到关卡详情
//     4 单词卡：第一次进第 1 关先过一遍——出现时自动念（女声）、🔊 是男声（没有男声的配音就是女声）、← → 键 / 按住拖着滑 / 按钮翻页、小点、
//       最后一张「我认识了，开始闯关」开考、记 seenCards；第二次直接开考；拿过第 1 关星星的不弹；课本单元第一张是语法；「跳过，直接闯关」；
//       开关 settings.cards 关了不弹；从单词表「▶ 用单词卡过一遍」看完回单词表
//     5 我的单词本：复习本里的词 + 拿过星的小镇的词、三个数、筛选、搜索（词 / 意思）、点一个词展开例句
//     6 英语界面：这几个画面没有中文；横屏两列、按钮在屏幕里
//   ja / zh / es（课程包）：首页「先学发音和文字」卡片 → 发音入门（分段、grid 的格子、list 的行、点一格用本机声音念（ja-JP / zh-CN / es-MX 先挑）、
//     下面出例词（读音、罗马字、意思、🔊 放课程包里的配音）；这台设备没有这门语言的声音时退回 say()）、看过以后卡片不再出；
//     单词表 / 单词卡里日语有读音和罗马字（单词表顶上的开关关了就没有）、中文有拼音读音、西语没有；我的单词本按这门课的存档走
//   real：tools/course/<语言>/primer.json 在、过了 check.js 就拿真的做一遍：每段都打得开、格子数对得上，截图
// 截图 tests/screenshots/words-*.png（2 倍像素，要看：读音有没有压字、罗马字有没有挤出去、长表能不能滚到底、按钮在不在屏幕里）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const EL = require(path.join(ROOT, 'lang.js'));
require(path.join(ROOT, 'lang-ja.js'));
const JA = EL.get('ja');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = s => !ONLY.length || ONLY.includes(s);
const CJK = /[぀-ヿ㐀-鿿]/;
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const T0 = ymd(new Date()), LATER = ymd(new Date(Date.now() + 5 * 864e5));
const PORT = { width: 390, height: 844 }, LAND = { width: 844, height: 390 };

// ---------- 发音入门的小样（每门语言两段：一段 grid、一段 list） ----------
const PRIMER = {
  ja: { lang: 'ja', sections: [
    { id: 'hira', title: { zh: '平假名', en: 'Hiragana' }, intro: { zh: '日语的字母。每格是一个音，小字是片假名。', en: 'The Japanese letters. Each box is one sound; the small one is katakana.' }, layout: 'grid', cols: 5, items: [
      { t: 'あ', sub: 'ア', rom: 'a', say: 'あ', ex: [{ t: '雨', r: 'あめ', zh: '雨', en: 'rain', pic: '🌧️' }] }, { t: 'い', sub: 'イ', rom: 'i', say: 'い' }, { t: 'う', sub: 'ウ', rom: 'u', say: 'う' }, { t: 'え', sub: 'エ', rom: 'e', say: 'え' }, { t: 'お', sub: 'オ', rom: 'o', say: 'お' },
      { t: 'や', sub: 'ヤ', rom: 'ya', say: 'や' }, null, { t: 'ゆ', sub: 'ユ', rom: 'yu', say: 'ゆ' }, null, { t: 'よ', sub: 'ヨ', rom: 'yo', say: 'よ' }] },
    { id: 'long', title: { zh: '长音和促音', en: 'Long sounds and small っ' }, intro: { zh: '长音拉长一拍；小っ停一拍。', en: 'A long sound takes one more beat; a small っ is a short stop.' }, layout: 'list', items: [
      { t: 'おばあさん', sub: 'お・ば・あ・さ・ん', rom: 'obaasan', say: 'おばあさん', zh: '长音：5 拍。', en: 'Long sound: 5 beats.', ex: [{ t: 'お母さん', r: 'おかあさん', zh: '妈妈', en: 'mother', pic: '👩' }] },
      { t: 'きって', rom: 'kitte', say: 'きって', zh: '小っ：停一拍。', en: 'Small っ: stop for one beat.' }] },
  ] },
  zh: { lang: 'zh', sections: [
    { id: 'tones', title: { zh: '四个声调', en: 'The four tones' }, intro: { zh: '同一个音，声调不一样，意思就不一样。', en: 'The same sound with a different tone is a different word.' }, layout: 'grid', cols: 5, items: [
      { t: 'mā', sub: '妈', rom: 'mā', say: '妈', en: '1st tone: high and flat.', ex: [{ t: '妈妈', r: 'mā ma', en: 'mum', pic: '👩' }] }, { t: 'má', sub: '麻', rom: 'má', say: '麻', en: '2nd tone: going up.' },
      { t: 'mǎ', sub: '马', rom: 'mǎ', say: '马', en: '3rd tone: down and up.', ex: [{ t: '马', r: 'mǎ', en: 'horse', pic: '🐴' }] }, { t: 'mà', sub: '骂', rom: 'mà', say: '骂', en: '4th tone: going down.' }, { t: 'ma', sub: '吗', rom: 'ma', say: '吗', en: 'Neutral tone: short and light.' }] },
    { id: 'sandhi', title: { zh: '变调', en: 'Tone changes' }, intro: { zh: '「一」「不」和两个第三声连读时会变调。', en: '一, 不 and two 3rd tones in a row change tone.' }, layout: 'list', items: [
      { t: 'yí gè', sub: '一个', rom: 'yí gè', say: '一个', en: '一 before a 4th tone is said as yí.' }, { t: 'bú shì', sub: '不是', rom: 'bú shì', say: '不是', en: '不 before a 4th tone is said as bú.' }] },
  ] },
  es: { lang: 'es', sections: [
    { id: 'abc', title: { zh: '字母表', en: 'The alphabet' }, intro: { zh: '西语有 27 个字母。小字是大写，下面是字母名。', en: 'Spanish has 27 letters. The small one is the capital; below is the letter name.' }, layout: 'grid', cols: 4, items: [
      { t: 'a', sub: 'A', rom: 'a', say: 'a', ex: [{ t: 'el agua', zh: '水', en: 'water', pic: '💧' }] }, { t: 'b', sub: 'B', rom: 'be', say: 'be' }, { t: 'c', sub: 'C', rom: 'ce', say: 'ce' }, { t: 'ñ', sub: 'Ñ', rom: 'eñe', say: 'eñe', ex: [{ t: 'el niño', zh: '男孩', en: 'boy', pic: '👦' }] }] },
    { id: 'sounds', title: { zh: '和英语不一样的音', en: 'Sounds that differ from English' }, intro: { zh: 'h 不发音，rr 要打舌。', en: 'h is silent; rr is rolled.' }, layout: 'list', items: [
      { t: 'h', rom: 'hola', say: 'hola', zh: 'h 不发音。', en: 'h is silent.' }, { t: 'rr', rom: 'perro', say: 'perro', zh: 'rr 要打舌。', en: 'rr is rolled.', ex: [{ t: 'el perro', zh: '狗', en: 'dog', pic: '🐶' }] }] },
  ] },
};
const exWords = J => J.sections.flatMap(s => s.items.filter(Boolean).flatMap(it => (it.ex || []).map(x => x.t)));

// ---------- 课程包小样 ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-words-'));
const VER = '20261122.1';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
const NAMES = { en: { zh: '英语', en: 'English', self: 'English' }, es: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, ja: { zh: '日语', en: 'Japanese', self: '日本語' }, zh: { zh: '中文', en: 'Chinese', self: '中文' } };
const UI = { ja: 'zh', es: 'zh', zh: 'en' };
function pack(dirName, lang, texts, course) {
  const dir = path.join(TMP, dirName, lang, VER); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  if (course) { const b = Buffer.from(JSON.stringify(course)); fs.writeFileSync(path.join(dir, 'course.json'), b); files.push({ name: 'course.json', kind: 'course', bytes: b.length, crc: PK.crcHex(new Uint8Array(b)) }); }
  const seen = new Set(), items = [];
  texts.forEach(t => { const k = key(t); if (!seen.has(k)) { seen.add(k); items.push({ g: 'f', k, data: new Uint8Array(OGG) }); } });
  const v = PK.packBundle(items);
  fs.writeFileSync(path.join(dir, 'voice-000.bin'), v);
  files.push({ name: 'voice-000.bin', kind: 'voice', core: true, bytes: v.length, crc: PK.crcHex(v), n: items.length });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ fmt: 1, lang, ver: VER, voice: { fmt: 'ogg-opus', f: 'x', m: 'y', n: { f: items.length, m: 0 } }, files }));
  return files.reduce((s, f) => s + f.bytes, 0);
}
const C = {}, CAT = { packs: { fmt: 1, packs: {} }, real: { fmt: 1, packs: {} } };
const REAL = {};
for (const dirName of ['packs', 'real']) { const b = pack(dirName, 'en', ['Hello!']); CAT[dirName].packs.en = { ver: VER, name: NAMES.en, bytes: b, core: b, course: false }; }
for (const l of ['ja', 'zh', 'es']) {
  if (!want(l) && !want('real')) continue;
  const pf = path.join(TMP, 'primer-' + l + '.json');
  fs.writeFileSync(pf, JSON.stringify(PRIMER[l]));
  // 小样的发音入门先过 check.js（build 里会跑）；lines: false：不带台词翻译表（这一套只看单词表这几样）；
  // 课前讲解和求助的话用正式的 tools/course/<语言>/lessons.json（例句一字不差地对着课程内容，课程是真的）
  const lf = path.join(ROOT, 'tools', 'course', l, 'lessons.json'), lo = fs.existsSync(lf) ? { lessons: lf } : {};
  let c;
  try { c = CB.build(l, Object.assign({ check: true, lines: false, primer: pf }, lo)).course; } catch (e) { console.log('  ⚠ ' + l + '：build 没过（' + String(e.message).split('\n').slice(0, 3).join(' / ') + '），用 buildCourse 直接转'); c = CB.buildCourse(l, Object.assign({ lines: false, primer: pf }, lo)); }
  C[l] = c;
  const w0 = c.WORLDS[0], u0 = c.BOOKS.list[0].units[0];
  const texts = w0.words.map(x => x[0]).concat(w0.sents.map(x => x[0]), w0.dlgs.flatMap(d => [d[0], d[1]]), u0.words.map(x => x[0]), u0.sents.map(x => x[0]), exWords(PRIMER[l]), ((c.LESSONS || {}).help || []).map(h => h.t));
  const b = pack('packs', l, texts, c);
  CAT.packs.packs[l] = { ver: VER, name: NAMES[l], bytes: b, core: b, course: true };
  // 真的 primer.json：在、过了 check.js 才用
  const rf = path.join(ROOT, 'tools', 'course', l, 'primer.json');
  if (want('real') && fs.existsSync(rf)) {
    try {
      const rc = CB.build(l, { check: true, lines: false, primer: rf }).course;
      REAL[l] = rc;
      const rb = pack('real', l, rc.WORLDS[0].words.map(x => x[0]).concat(exWords(rc.PRIMER)), rc);
      CAT.real.packs[l] = { ver: VER, name: NAMES[l], bytes: rb, core: rb, course: true };
    } catch (e) { check(false, l + '：真的 primer.json 没过 build / check.js', String(e.message).split('\n').slice(0, 6).join(' / ')); }
  }
}
check(Object.keys(C).every(l => C[l].PRIMER && C[l].PRIMER.v === 1 && C[l].PRIMER.sections.length === 2), 'build.js：小样的 primer.json 并进 course.json 的 PRIMER（原样 + v: 1）');
{
  // 配音名单：有发音入门比没有多出来的，正好是例词（格子自己的 say 不进）
  const extra = {};
  for (const l of Object.keys(C)) {
    const lf = path.join(ROOT, 'tools', 'course', l, 'lessons.json'), base = CB.buildCourse(l, Object.assign({ lines: false }, fs.existsSync(lf) ? { lessons: lf } : {})), bk = new Set(base.VOICE.map(e => key(e.t)));
    extra[l] = { plus: C[l].VOICE.filter(e => !bk.has(key(e.t))).map(e => e.t).sort(), ex: [...new Set(exWords(PRIMER[l]).filter(t => !bk.has(key(t))))].sort(), noPrimer: !('PRIMER' in base) };
  }
  check(Object.values(extra).every(x => JSON.stringify(x.plus) === JSON.stringify(x.ex)), 'build.js：例词进了配音名单 VOICE（女声），格子自己的 say 不进（主会话 11-22 定：单个音用本机声音念）', extra);
  check(Object.keys(C).every(l => C[l].VOICE[0].t === C[l].WORLDS[0].en), 'build.js：配音名单最前面还是第 0 岛的岛名（发音入门的例词排在小镇后面）');
  check(Object.values(extra).every(x => x.noPrimer), 'build.js：测试（给了 lines）不带正式的 primer.json；没给 primer 就没有 PRIMER');
}

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const web = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  const m = /^\/(packs|real)\/(.*)$/.exec(u);
  if (m) {
    if (m[2] === 'catalog.json') return send(200, JSON.stringify(CAT[m[1]]), MIME.json);
    const file = path.join(TMP, m[1], m[2]);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});
// 测试存档：有进度（不进能力检测）、看过说明、口语自评、发音只用配音、不放音乐、自己学；cards: true（单词卡开着）
const SAVE = o => Object.assign({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120, homeTab: 'quiz',
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
  book: { at: 0, mix: 0.6, view: 'isle', vb: '' }, stars: {}, rev: { v: 1, items: {} },
}, o || {}, { settings: Object.assign({ tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh', cards: true }, (o && o.settings) || {}) });

(async () => {
  await new Promise(r => web.listen(0, '127.0.0.1', r));
  const BASE = 'http://echo.localhost:' + web.address().port;
  const browser = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  const W = (p, ms) => p.waitForTimeout(ms);
  const E = (p, f, a) => p.evaluate(f, a);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'words-' + name + '.png') });
  // 点一个按钮（data-act 加别的 data-*），和真的点一样走 game.js 的 ACT
  const act = (p, a, extra) => E(p, ([a, extra]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra || {}); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra || null]);
  const modalText = p => E(p, () => document.getElementById('modal').hidden ? '' : document.getElementById('sheet').innerText);
  const S = p => E(p, () => JSON.parse(JSON.stringify(EchoGame.S)));
  async function openGame(save, view, query) {
    const ctx = await browser.newContext({ viewport: view || PORT, deviceScaleFactor: 2 });
    await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; return /(^|\.)localhost$|^127\.0\.0\.1$/.test(h) ? r.continue() : r.abort(); });
    await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(save));
    // 放了哪段音频（老模式：配音文件的地址）、假的手机自带声音（发音入门的格子先用它）、课程包里查了哪些 key
    await ctx.addInitScript(() => {
      window.__plays = []; window.__rates = []; window.__speak = [];
      window.__voices = [{ name: 'Kyoko', lang: 'ja-JP' }, { name: 'Ting-Ting', lang: 'zh-CN' }, { name: 'Monica', lang: 'es-ES' }, { name: 'Paulina', lang: 'es-MX' }, { name: 'Samantha', lang: 'en-US' }];
      const p0 = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); window.__rates.push(this.playbackRate); return p0.call(this); };
      const fake = { speak(u) { window.__speak.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.name }); setTimeout(() => { if (u.onend) u.onend(); }, 20); }, cancel() {}, getVoices: () => window.__voices.slice(), addEventListener() {}, removeEventListener() {}, speaking: false, pending: false };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => fake });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
    await p.goto(BASE + '/index.html' + (query || ''));
    await homeUp(p);
    return { ctx, p };
  }
  // 换到 L 这门课：装课程包、写这门课的存档、重新打开
  async function toCourse(p, L, o) {
    await E(p, l => EchoPacks.install(l), L);
    await E(p, ([l, o]) => {
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: l, rev: { v: 1, items: {} }, stars: {}, talk: undefined, quests: undefined, log: undefined, place: { lang: l, lv: 1, auto: 1, talk: 1, adj: 0, know: 1, who: 'adult', at: '2026-11-20' } }, o || {});
      Object.assign(s.settings, { track: 'level' }, (o && o.settings) || {});
      localStorage.setItem('echo-island-v1@' + l, JSON.stringify(s)); localStorage.setItem('echo-course', l);
    }, [L, o || null]);
    await p.reload(); await homeUp(p);
    await E(p, () => { window.__keys = []; const h = EchoPacks.hasClip; EchoPacks.hasClip = (k, g) => { window.__keys.push(k + '/' + g); return h(k, g); }; });
  }
  const quiz = async p => { await E(p, () => { EchoGame.S.homeTab = 'quiz'; EchoGame.goHome('quiz'); }); await W(p, 300); };
  // 弹窗里的东西都在屏幕里：关闭 / 返回 / 翻页按钮、最后一行
  const inView = (p, sel) => E(p, sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0; }, sel);
  // 滚到弹窗最底下：最后那一块看得见、贴底的按钮在屏幕里、没有横着滚
  const scrollEnd = (p, lastSel, btnSel) => E(p, ([lastSel, btnSel]) => {
    const sh = document.getElementById('sheet'); sh.scrollTop = sh.scrollHeight;
    const L = [...document.querySelectorAll(lastSel)].pop(), b = document.querySelector(btnSel);
    if (!L || !b) return { ok: false, why: 'no el' };
    const lr = L.getBoundingClientRect(), br = b.getBoundingClientRect(), sr = sh.getBoundingClientRect();
    return { ok: lr.bottom <= br.top + 2 && lr.bottom <= sr.bottom + 1 && br.bottom <= innerHeight + 1 && br.top >= 0 && sh.scrollWidth <= sh.clientWidth + 1, lr: Math.round(lr.bottom), bt: Math.round(br.top), bb: Math.round(br.bottom), h: innerHeight, sw: sh.scrollWidth, cw: sh.clientWidth };
  }, [lastSel, btnSel]);
  // 读音（<rt>）和上一行 / 下一行的字压不压在一起：同一个弹窗里每个 <rt> 的框不和别的行的字的框重叠
  const rubyClash = p => E(p, () => {
    const rts = [...document.querySelectorAll('#sheet rt')].filter(e => e.getClientRects().length), out = [];
    const boxes = [...document.querySelectorAll('#sheet .wd-m, #sheet .wd-rom, #sheet .wc-rom, #sheet .wc-mean, #sheet .wd-st, #sheet h3, #sheet .wc-pic, #sheet small')].filter(e => e.getClientRects().length).map(e => [e, e.getBoundingClientRect()]);
    for (const rt of rts) { const a = rt.getBoundingClientRect(); for (const [e, b] of boxes) { if (e.contains(rt) || rt.closest('.wd-row, .wc-card') !== e.closest('.wd-row, .wc-card')) continue; if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) out.push(rt.textContent + ' × ' + e.className); } }
    return out.slice(0, 5);
  });
  const lastPlay = p => E(p, () => window.__plays[window.__plays.length - 1] || '');
  // 一个词在页面上的位置（点它用）：sel 里第一个含这个词的字（不算读音 <rt>）
  const ptAt = (p, sel, word) => E(p, ([sel, word]) => {
    for (const box of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.data.toLowerCase().indexOf(word.toLowerCase()); if (i >= 0 && !(n.parentElement && n.parentElement.closest('rt'))) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + word.length); const b = rg.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; } }
    }
    return null;
  }, [sel, word]);
  // 点词弹出来的小卡：词、意思（没弹是 null）
  const popOf = p => E(p, () => { const e = document.getElementById('wd-pop'); return e && !e.hidden ? { w: e.querySelector('.wd-w b').textContent, h: e.querySelector('.wd-w b').innerHTML, m: (e.querySelector('.wd-m') || {}).textContent || '' } : null; });

  try {
    // ======================= 英语课 =======================
    if (want('en')) {
      console.log('— 英语课（中文界面、竖屏）');
      const REV = { 'word:0:1': { k: 'word', w: 0, i: 1, b: 2, due: LATER, x: 0, c: '2026-11-10' }, 'word:0:2': { k: 'word', w: 0, i: 2, b: 7, due: '', x: 0, c: '2026-11-01', seen: '2026-11-18' }, 'word:13:0': { k: 'word', w: 13, i: 0, b: 1, due: T0, x: 0, c: T0 } };
      let { ctx, p } = await openGame(SAVE({ rev: { v: 1, items: REV } }));
      const D = await E(p, () => ({ w0: WORLDS[0].words.map(x => x[0]), m0: WORLDS[0].words.map(x => x[1]), s0: WORLDS[0].sents.map(x => x[0]), u0: BOOKS.list[0].units[0].words[0][0], nb: WORLDS.length, unlocked: [...document.querySelectorAll('#map .world')].length }));
      await quiz(p);
      // ---------- 1 入口 ----------
      let bar = await E(p, () => { const b = document.querySelector('#map > .wd-bar'); return b ? { t: b.innerText, first: document.querySelector('#map').firstElementChild === b, primer: !!b.querySelector('[data-act=primer]') } : null; });
      check(!!bar && bar.first && /我的单词本（学过 3 个词）/.test(bar.t) && !bar.primer, '闯关练习页最上面「📒 我的单词本（学过 3 个词）」（复习本里的 3 个词）；英语课没有「发音入门」', bar);
      const wl = await E(p, () => ({ isle0: !!document.querySelector('#w0 [data-act=wordList][data-w="0"]'), locked: !!document.querySelector('.world.locked [data-act=wordList]'), n: document.querySelectorAll('#map [data-act=wordList]').length }));
      check(wl.isle0 && !wl.locked, '小镇卡片上有「📖 单词表」（锁着的小镇没有）', wl);
      // ---------- 2 单词表 ----------
      await p.click('#w0 [data-act=wordList]'); await W(p, 300);
      let L = await E(p, () => ({ rows: [...document.querySelectorAll('#sheet .wd-list:not(.wd-slist) > .wd-row')].map(r => ({ st: r.dataset.st, w: r.querySelector('.wd-w b').textContent, m: (r.querySelector(':scope > .wd-main > .wd-m') || {}).textContent || '', ex: (r.querySelector('.wd-ex-t span') || {}).textContent || '', say: r.querySelector(':scope > .wd-says > .wd-say').dataset.t })),
        sents: document.querySelectorAll('#sheet .wd-sents .wd-row').length, open: document.querySelector('#sheet .wd-sents').open, h2: document.querySelector('#sheet h2').textContent, close: !!document.querySelector('#sheet .row [data-act=close]'), back: !!document.querySelector('#sheet [data-act=wdBack]') }));
      check(L.rows.length === D.w0.length && L.rows.every((r, i) => r.w === D.w0[i] && r.m === D.m0[i] && r.say === D.w0[i]), '单词表：' + D.w0.length + ' 个词一行一个（词、意思、🔊）', L.rows.slice(0, 3));
      check(L.rows[0].st === 'new' && L.rows[1].st === 'rev' && L.rows[2].st === 'ok' && L.rows.slice(3).every(r => r.st === 'new'), '状态照复习本：没进复习本 🆕、还有到期日 🔁、掌握了 ✅', L.rows.map(r => r.st));
      const exOk = L.rows.filter(r => r.ex);
      check(exOk.length >= 3 && exOk.every(r => new RegExp('\\b' + r.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(r.ex) && D.s0.includes(r.ex)), '例句：这一课 sents 里含这个词的那一句（' + exOk.length + ' 个词有例句）', exOk.map(r => r.w + ' → ' + r.ex));
      check(L.sents === D.s0.length && !L.open && /常用句子（8）/.test(await modalText(p)), '常用句子（' + D.s0.length + ' 句）收起来放在下面', L);
      check(L.close && !L.back && /0 ?岛|第 1 岛|你好岛/.test(L.h2 + (await modalText(p))), '标题是小镇名，只有「关闭」（从小镇卡片打开的）', L.h2);
      await shot(p, 'en-list-zh-port');
      await p.click('#sheet .wd-list > .wd-row:first-child > .wd-says > .wd-say'); await W(p, 300);
      check((await lastPlay(p)).endsWith('/f/' + key(D.w0[0]) + '.ogg'), '点 🔊：放的是「' + D.w0[0] + '」的配音', await lastPlay(p));
      await p.click('#sheet .wd-sents summary'); await W(p, 200);
      let se = await scrollEnd(p, '#sheet .wd-sents .wd-row', '#sheet .row [data-act=close]');
      check(se.ok, '长表滚到底：最后一句看得见、「关闭」贴底在屏幕里、不横着滚', se);
      check(!(await rubyClash(p)).length, '英语课没有读音');
      await act(p, 'close'); await W(p, 200);
      // ---------- 3 关卡详情：「先预习一下」换成「📖 单词表」 ----------
      await p.click('#w0 .node[data-l="0"]'); await W(p, 300);
      let lv = await E(p, () => ({ pre: !!document.querySelector('#sheet details.pre'), btn: !!document.querySelector('#sheet [data-act=wordList][data-w="0"][data-l="0"]'), start: !!document.querySelector('#sheet [data-act=start]') }));
      check(!lv.pre && lv.btn && lv.start, '关卡详情：没有收起来的「先预习一下」，换成「📖 单词表」按钮', lv);
      await p.click('#sheet [data-act=wordList]'); await W(p, 250);
      check(await E(p, () => !!document.querySelector('#sheet [data-act=wdBack]') && document.querySelectorAll('#sheet .wd-list > .wd-row').length > 0), '从关卡详情打开的单词表有「← 返回」');
      await p.click('#sheet [data-act=wdBack]'); await W(p, 250);
      check(await E(p, () => !!document.querySelector('#sheet [data-act=start][data-w="0"][data-l="0"]')), '「← 返回」回到这一关的关卡详情');
      // ---------- 4 单词卡 ----------
      await p.click('#sheet [data-act=start]'); await W(p, 500);
      // 第二部分 §7：第一次进第 1 关先看「这一课学什么」，再单词卡，再开考
      const LE = await E(p, () => window.LESSONS_EN && LESSONS_EN.towns['0']);
      const ls = await E(p, () => ({ h: (document.querySelector('#sheet .wd-k') || {}).textContent || '', can: (document.querySelector('#sheet .ls-can span') || {}).textContent || '', pats: document.querySelectorAll('#sheet .ls-pat').length, blanks: document.querySelectorAll('#sheet .ls-p .ls-blank').length,
        ex: [...document.querySelectorAll('#sheet .ls-ex')].map(e => ({ t: e.querySelector('.wd-ex-t > span').textContent, m: (e.querySelector(':scope > small') || {}).textContent || null })), next: (document.querySelector('#sheet [data-act=lsNext]') || {}).textContent || '', skip: !!document.querySelector('#sheet [data-act=lsSkip]'), seen: EchoGame.S.seenLesson }));
      check(!!LE && /这一课学什么/.test(ls.h) && ls.can === LE.can.zh && ls.pats === LE.patterns.length && ls.blanks >= 1 && /下一步：认识单词/.test(ls.next) && ls.skip && ls.seen['0'] === T0,
        '§7 第一次进第 1 关：先出「这一课学什么」（学完能做什么、' + ls.pats + ' 个句型、空的地方画成空格子），「下一步：认识单词 →」；看过记 seenLesson', ls);
      const exAll = LE.patterns.flatMap(x => x.ex), inSent = t => D.s0.includes(t);
      check(ls.ex.length === exAll.length && ls.ex.every((e, k) => e.t === exAll[k] && (inSent(e.t) ? !!e.m : e.m === null)), '§7 例句：一字不差地是这一课的句子；sents 里的带意思，对话（dlgs）里的问答没有意思就不显示空行', ls.ex);
      await shot(p, 'en-lesson-zh-port');
      await E(p, () => { window.__plays.length = 0; });
      await p.click('#sheet [data-act=lsNext]'); await W(p, 600);
      const card = () => E(p, () => { const c = document.getElementById('wc'); if (!c || document.getElementById('modal').hidden) return null; return { n: c.querySelector('.wc-n').textContent, dots: c.querySelectorAll('.wc-dots i').length, on: [...c.querySelectorAll('.wc-dots i')].findIndex(i => i.classList.contains('on')), word: (c.querySelector('.wc-word') || {}).textContent || '', mean: (c.querySelector('.wc-mean') || {}).textContent || '', gram: !!c.querySelector('.wc-card.gram'), pic: (c.querySelector('.wc-pic') || {}).textContent || '', skip: !!c.querySelector('[data-act=wcSkip]'), go: !!document.querySelector('#sheet [data-act=wcGo]'), next: !!document.querySelector('#sheet [data-act=wcNext]'), play: !document.getElementById('play').hidden }; });
      let c = await card();
      check(!!c && c.word === D.w0[0] && c.mean === D.m0[0] && c.dots === D.w0.length && c.on === 0 && c.skip && c.next && !c.play, '第一次进第 1 关：先出单词卡（大图、词、意思；' + c.dots + ' 个小点；「跳过，直接闯关」），没有开考', c);
      check((await E(p, () => window.__plays.slice())).some(s => s.endsWith('/f/' + key(D.w0[0]) + '.ogg')), '单词卡出现时自动念一遍（女声）');
      await E(p, () => { window.__plays.length = 0; });
      await p.click('#sheet [data-act=wcSay]'); await W(p, 300);
      check((await lastPlay(p)).endsWith('/f/' + key(D.w0[0]) + '.ogg'), '点 🔊 要男声：「' + D.w0[0] + '」没有男声的配音，放的是女声', await lastPlay(p));
      await shot(p, 'en-cards-zh-port');
      await p.keyboard.press('ArrowRight'); await W(p, 250);
      c = await card(); check(c.word === D.w0[1] && c.on === 1 && /第 2 \/ 12 张/.test(c.n), '→ 键翻到第 2 张', c);
      await p.keyboard.press('ArrowLeft'); await W(p, 250);
      c = await card(); check(c.word === D.w0[0], '← 键翻回第 1 张', c);
      await p.click('#sheet [data-act=wcNext]'); await W(p, 250);
      c = await card(); check(c.word === D.w0[1], '「→」按钮翻页', c);
      const box = await p.locator('#wc-card').boundingBox();
      await p.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 4 }); await p.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 4 }); await p.mouse.up(); await W(p, 250);
      c = await card(); check(c.word === D.w0[2], '按住往左滑：下一张', c);
      await p.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 6 }); await p.mouse.up(); await W(p, 250);
      c = await card(); check(c.word === D.w0[1], '往右滑：上一张', c);
      for (let k = 0; k < 20 && (await card()).next; k++) { await p.click('#sheet [data-act=wcNext]'); await W(p, 60); }
      c = await card();
      check(c.word === D.w0[D.w0.length - 1] && c.go && !c.next && /我认识了，开始闯关/.test(await modalText(p)), '最后一张：「我认识了，开始闯关」', c);
      check(await inView(p, '#sheet [data-act=wcGo]') && await inView(p, '#sheet [data-act=wcPrev]'), '翻页按钮在屏幕里');
      await p.click('#sheet [data-act=wcGo]'); await W(p, 500);
      let st = await E(p, () => ({ play: !document.getElementById('play').hidden, wi: EchoGame.P() && EchoGame.P().wi, li: EchoGame.P() && EchoGame.P().li, seen: EchoGame.S.seenCards }));
      check(st.play && st.wi === 0 && st.li === 0 && st.seen['0'] === T0, '开始闯关：第 1 关开考，记下 seenCards[0] = 今天', st);
      await E(p, () => EchoGame.goHome('quiz')); await W(p, 300);
      await p.click('#w0 .node[data-l="0"]'); await W(p, 250); await p.click('#sheet [data-act=start]'); await W(p, 400);
      st = await E(p, () => ({ play: !document.getElementById('play').hidden, wc: !!document.getElementById('wc') }));
      check(st.play && !st.wc, '看过单词卡的：再进第 1 关直接开考', st);
      // 课本单元：拿过第 1 关星星的不弹；没拿过的第一张是语法；「跳过，直接闯关」也记一笔
      await E(p, () => { EchoGame.S.stars['13-0'] = 2; EchoGame.goHome('quiz'); });
      const NB = D.nb;
      await act(p, 'start', { w: String(NB), l: '0' }); await W(p, 400);
      st = await E(p, () => ({ play: !document.getElementById('play').hidden, wc: !!document.getElementById('wc') }));
      check(st.play && !st.wc, '老存档：已经拿过第 1 关星星的单元不弹单词卡', st);
      await E(p, () => EchoGame.goHome('quiz'));
      await act(p, 'start', { w: String(NB + 1), l: '0' }); await W(p, 400);
      c = await card();
      const nw1 = await E(p, i => BOOKS.list[0].units[i].words.length, 1);
      check(!!c && c.gram && c.dots === nw1 + 1 && /语法要点/.test(await modalText(p)), '课本单元：单词卡最前面一张是语法要点（标题 + 说明），后面 ' + nw1 + ' 个词', c);
      await W(p, 500);
      check(await inView(p, '#sheet [data-act=wcNext]') && await inView(p, '#sheet [data-act=wcSkip]'), '语法那一张（说明很长）：翻页、跳过还在屏幕里（说明自己滚）');
      await shot(p, 'en-cards-gram-zh-port');
      await p.click('#sheet [data-act=wcSkip]'); await W(p, 400);
      st = await E(p, n => ({ play: !document.getElementById('play').hidden, li: EchoGame.P() && EchoGame.P().li, wi: EchoGame.P() && EchoGame.P().wi, seen: EchoGame.S.seenCards[n] }), NB + 1);
      check(st.play && st.wi === NB + 1 && st.li === 0 && st.seen === T0, '「跳过，直接闯关」：直接开考，也记一笔', st);
      await E(p, () => { EchoGame.S.settings.cards = false; EchoGame.goHome('quiz'); });
      await act(p, 'start', { w: String(NB + 2), l: '0' }); await W(p, 400);
      st = await E(p, n => ({ play: !document.getElementById('play').hidden, wc: !!document.getElementById('wc'), seen: EchoGame.S.seenCards[n] }), NB + 2);
      check(st.play && !st.wc && !st.seen, '开关 settings.cards = false：不弹单词卡（测试存档就这样关）', st);
      await E(p, () => { EchoGame.S.settings.cards = true; EchoGame.goHome('quiz'); });
      // 从单词表「▶ 用单词卡过一遍」：语法在前，看完回单词表
      await act(p, 'wordList', { w: String(NB + 3) }); await W(p, 300);
      const gram = await E(p, () => ({ g: (document.querySelector('#sheet .wd-gram') || {}).innerText || '', cards: !!document.querySelector('#sheet [data-act=wcOpen]') }));
      check(/这一单元的语法：/.test(gram.g) && gram.cards, '课本单元的单词表：标题下面一块「这一单元的语法」、「▶ 用单词卡过一遍」', gram);
      await p.click('#sheet [data-act=wcOpen]'); await W(p, 300);
      c = await card();
      check(c.gram && !c.skip && /← 返回/.test(await modalText(p)), '用单词卡过一遍：第一张是语法，上面是「← 返回」（不是「跳过」）', c);
      for (let k = 0; k < 60 && (await card()).next; k++) await act(p, 'wcNext');
      await W(p, 150);
      check(await E(p, () => !!document.querySelector('#sheet [data-act=wcEnd].btn')) && /✓ 看完了/.test(await modalText(p)), '最后一张是「✓ 看完了」');
      await p.click('#sheet .wc-nav [data-act=wcEnd]'); await W(p, 300);
      st = await E(p, n => ({ list: !!document.querySelector('#sheet .wd-gram') && document.querySelectorAll('#sheet .wd-list > .wd-row').length > 0, seen: EchoGame.S.seenCards[n] }), NB + 3);
      check(st.list && st.seen === T0, '看完回到单词表（也记一笔 seenCards）', st);
      await act(p, 'close');
      // ---------- 5 我的单词本 ----------
      await E(p, () => { EchoGame.S.stars['0-0'] = 3; EchoGame.goHome('quiz'); }); await W(p, 300);
      const expect = await E(p, () => { const seen = new Set(); const add = t => seen.add(String(t).toLowerCase().trim()); WORLDS[0].words.forEach(x => add(x[0])); BOOKS.list[0].units[0].words.forEach(x => add(x[0])); return seen.size; });
      bar = await E(p, () => document.querySelector('#map > .wd-bar').innerText);
      check(new RegExp('学过 ' + expect + ' 个词').test(bar), '入口的数：拿过星的小镇 / 单元的全部单词 + 复习本里的词（同一个写法算一次）= ' + expect, bar);
      await p.click('#map [data-act=wordBook]'); await W(p, 400);
      const book = () => E(p, () => ({ stats: [...document.querySelectorAll('#sheet .wb-stats .stat b')].map(b => +b.textContent), groups: [...document.querySelectorAll('#wb-list .wb-g h3')].map(h => h.textContent), rows: [...document.querySelectorAll('#wb-list .wd-row')].map(r => ({ st: r.dataset.st, w: r.querySelector('.wd-w b').textContent })) }));
      let bk = await book();
      check(bk.stats.join() === [expect, 2, expect - 2].join() && bk.rows.length === expect, '三个数：一共 ' + expect + ' / 在复习 2 / 已掌握 ' + (expect - 2) + '；每个词一行', bk.stats);
      check(bk.groups.length === 2 && /7A|七上/.test(bk.groups[0]) && bk.rows.every(r => r.st === 'rev' || r.st === 'ok'), '按小镇 / 单元分组，新的在上（课本单元今天进的复习本）；状态只有 🔁 / ✅', bk.groups);
      await shot(p, 'en-book-zh-port');
      await p.click('#sheet .wb-f [data-f=rev]'); await W(p, 200);
      bk = await book(); check(bk.rows.length === 2 && bk.rows.every(r => r.st === 'rev'), '筛选「在复习」：只剩 🔁 的', bk.rows);
      await p.click('#sheet .wb-f [data-f=ok]'); await W(p, 200);
      bk = await book(); check(bk.rows.length === expect - 2 && bk.rows.every(r => r.st === 'ok'), '筛选「已掌握」：只剩 ✅ 的', bk.rows.length);
      await p.click('#sheet .wb-f [data-f=all]'); await p.fill('#wb-q', D.m0[0]); await W(p, 200);
      bk = await book(); check(bk.rows.some(r => r.w === D.w0[0]) && bk.rows.length < expect, '搜索意思「' + D.m0[0] + '」：找得到「' + D.w0[0] + '」', bk.rows);
      await p.fill('#wb-q', D.w0[3].slice(0, 5)); await W(p, 200);
      bk = await book(); check(bk.rows.some(r => r.w === D.w0[3]), '搜索词「' + D.w0[3].slice(0, 5) + '」', bk.rows);
      await p.fill('#wb-q', ''); await W(p, 200);
      await p.click('#wb-list .wd-row:first-child .wd-w'); await W(p, 200);
      const ex1 = await E(p, () => { const r = document.querySelector('#wb-list .wd-row'); return { open: r.classList.contains('open'), ex: !!r.querySelector('.wd-ex, .wd-noex') }; });
      await p.click('#wb-list .wd-row:first-child .wd-w'); await W(p, 200);
      const ex2 = await E(p, () => !!document.querySelector('#wb-list .wd-row .wd-ex, #wb-list .wd-row .wd-noex'));
      check(ex1.open && ex1.ex && !ex2, '点一个词：展开例句（这一课没有用到的写一句「没有」），再点收起', ex1);
      se = await scrollEnd(p, '#wb-list .wd-row', '#sheet .row [data-act=close]');
      check(se.ok, '单词本滚到底：最后一个词看得见、「关闭」在屏幕里', se);
      await act(p, 'close');
      await ctx.close();

      // ---------- 6 英语界面、横屏 ----------
      for (const [view, tag] of [[PORT, 'port'], [LAND, 'land']]) {
        console.log('— 英语课（英语界面、' + (tag === 'port' ? '竖屏' : '横屏') + '）');
        ({ ctx, p } = await openGame(SAVE({ rev: { v: 1, items: REV }, stars: { '0-0': 3 }, settings: { ui: 'en' } }), view));
        await quiz(p);
        check(!CJK.test(await E(p, () => document.querySelector('#map > .wd-bar').innerText)), tag + ' 入口没有中文');
        await act(p, 'wordList', { w: '13' }); await W(p, 300);
        let t = await modalText(p);
        check(!CJK.test(t) && /Word list/.test(t) && /Words \(\d+\)/.test(t), tag + ' 单词表（课本单元）：没有中文（意思、语法讲解是中文的不显示）', (t.match(/.{0,20}[぀-ヿ㐀-鿿].{0,20}/) || [])[0]);
        const cols = await E(p, () => getComputedStyle(document.querySelector('#sheet .wd-list')).gridTemplateColumns.split(' ').length);
        check(cols === (tag === 'land' ? 2 : 1), tag + ' 单词一' + (tag === 'land' ? '行两个（横屏两列）' : '列'), cols);
        se = await scrollEnd(p, '#sheet .wd-list:not(.wd-slist) > .wd-row', '#sheet .row [data-act=close]');
        check(se.ok, tag + ' 滚到底：「Close」在屏幕里', se);
        await shot(p, 'en-list-en-' + tag);
        await act(p, 'close');
        await act(p, 'start', { w: '13', l: '0' }); await W(p, 400);
        t = await modalText(p);
        check(!!(await E(p, () => document.getElementById('wc'))) && !CJK.test(t) && /Skip, start the level/.test(t), tag + ' 单词卡：英语界面没有中文', t.slice(0, 120));
        check(await inView(p, '#sheet [data-act=wcNext]') && await inView(p, '#sheet [data-act=wcSkip]') && await inView(p, '#sheet .wc-say'), tag + ' 单词卡：翻页、跳过、🔊 都在屏幕里');
        await shot(p, 'en-cards-en-' + tag);
        await act(p, 'wcSkip'); await W(p, 300);
        await E(p, () => EchoGame.goHome('quiz')); await W(p, 200);
        await p.click('#map [data-act=wordBook]'); await W(p, 300);
        t = await modalText(p);
        check(!CJK.test(t) && /My word book/.test(t), tag + ' 我的单词本：没有中文', (t.match(/.{0,20}[぀-ヿ㐀-鿿].{0,20}/) || [])[0]);
        await shot(p, 'en-book-en-' + tag);
        await act(p, 'close');
        // §7 这一课学什么（英语界面）：没有中文；横屏句型两列；按钮在屏幕里
        await act(p, 'lesson', { w: '0' }); await W(p, 300);
        t = await modalText(p);
        check(!CJK.test(t) && /What you learn here/.test(t) && /After this lesson you can/.test(t), tag + ' 这一课学什么：没有中文', (t.match(/.{0,20}[぀-ヿ㐀-鿿].{0,20}/) || [])[0]);
        se = await scrollEnd(p, '#sheet .ls-pat', '#sheet .row [data-act=lsDone]');
        check(se.ok, tag + ' 这一课学什么：滚到底「Close」在屏幕里', se);
        await E(p, () => { document.getElementById('sheet').scrollTop = 0; });
        await shot(p, 'en-lesson-en-' + tag);
        await act(p, 'lsDone');
        // §8 求助的话（英语界面）
        await act(p, 'sosList'); await W(p, 300);
        t = await modalText(p);
        check(!CJK.test(t) && /Phrases for help/.test(t), tag + ' 求助的话：没有中文');
        await shot(p, 'en-help-en-' + tag);
        await act(p, 'close');
        await ctx.close();
      }
    }

    // ======================= 第二部分（英语课）：求助的话、新手路线、点词看意思、朗读慢一点 =======================
    if (want('p2')) {
      console.log('— 第二部分（英语课，中文界面）');
      // 新手路线、点词看意思在自动化浏览器里默认关着：这里打开（route / wordTap: true）；echo-talk-url 随便给一个连不上的地址，聊天页才打得开
      let { ctx, p } = await openGame(SAVE({ settings: { route: true, wordTap: true } }), PORT, '?x=1');
      await E(p, () => localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9'));
      await p.reload(); await homeUp(p);
      // ---------- §8 求助的话 ----------
      const H = await E(p, () => LESSONS_EN.help);
      await act(p, 'sosList'); await W(p, 300);
      const hp = await E(p, () => [...document.querySelectorAll('#sheet .hp-row')].map(r => ({ t: r.querySelector('.wd-s').textContent, m: (r.querySelector('.wd-m') || {}).textContent || '', use: (r.querySelector('.hp-use') || {}).textContent || '', say: !!r.querySelector('[data-act=hpSay]'), slow: !!r.querySelector('[data-act=hpSlow]') })));
      check(hp.length === H.length && H.length >= 8 && hp.every((r, k) => r.t === H[k].t && r.m === H[k].zh && r.use === H[k].use.zh && r.say && r.slow), '§8 求助的话：' + hp.length + ' 句（原文、意思、什么时候用、🔊、🐢）', hp.slice(0, 2));
      await shot(p, 'en-help-zh-port');
      await act(p, 'close');
      const npc = await E(p, () => TALK_NPCS.list[0].id);
      await act(p, 'talk_open', { npc }); await W(p, 900);
      check(await E(p, () => !!document.querySelector('#tk-ov #tk-sos')), '§8 聊天页的工具那一排有 🆘');
      await p.click('#tk-sos'); await W(p, 300);
      check(await E(p, () => !document.getElementById('modal').hidden && document.querySelectorAll('#sheet .hp-row').length > 0 && !!document.getElementById('tk-ov')), '§8 点 🆘：求助的话那张表盖在聊天页上面（不替他发出去，聊天页还在）');
      await shot(p, 'en-chat-sos-zh-port');
      await act(p, 'close');
      await p.reload(); await homeUp(p);
      // ---------- §9 新手路线 ----------
      await E(p, () => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); }); await W(p, 300);
      // 卡片（2026-11-22 收紧）：做完的收成一行「✅ 已完成 n 步」，没做的只列接下来 3 步，后面还有几步一行小字
      const rt = () => E(p, () => { const c = document.querySelector('#quests .rt-card'); return c ? { first: document.getElementById('quests').firstElementChild === c, steps: [...c.querySelectorAll('[data-act=rtGo]')].map(b => b.dataset.s), done: (c.querySelector('.rt-done') || {}).textContent || '', more: (c.querySelector('.rt-more') || {}).textContent || '', now: (c.querySelector('li.now [data-act=rtGo]') || { dataset: {} }).dataset.s || '', n: c.querySelector('.rt-h small').textContent } : null; });
      let r = await rt();
      check(!!r && r.first && r.steps.join() === 'lesson,cards,l14' && r.now === 'lesson' && /已完成 1 步/.test(r.done) && /后面还有 3 步/.test(r.more) && r.n === '1 / 7',
        '§9 新手路线：首页最上面一张卡片，英语课没有「发音入门」这一步；开始冒险的那一步做完了（收进「已完成 1 步」），只列接下来 3 步、后面还有 3 步', r);
      await shot(p, 'en-route-zh-port');
      await p.click('#quests [data-act=rtGo][data-s=lesson]'); await W(p, 300);
      check(await E(p, () => document.querySelectorAll('#sheet .ls-pat').length > 0), '§9 点「这一课学什么」那一步：打开第 1 岛的课前讲解');
      await act(p, 'lsDone'); await E(p, () => EchoGame.goHome('mon')); await W(p, 200);
      r = await rt(); check(!r.steps.includes('lesson') && /已完成 2 步/.test(r.done) && r.now === 'cards' && r.n === '2 / 7', '§9 看过以后那一步收进「已完成」，下一步亮着', r);
      await p.click('#quests [data-act=rtGo][data-s=l14]'); await W(p, 500);
      check(await E(p, () => !document.getElementById('quiz-home').hidden && !!document.querySelector('#w0 .node.goal[data-l="0"]')), '§9 点「第 1–4 关」：到闯关练习的第 1 岛，第 1 关亮一圈');
      await E(p, () => { const S = EchoGame.S; for (let l = 0; l < 7; l++) S.stars['0-' + l] = 2; S.scenes[0] = { watched: 1 }; S.seenCards[0] = 'x'; S.talk.log = [{ npc: 'x' }]; EchoGame.goHome('mon'); }); await W(p, 300);
      const nx = await E(p, () => { const b = document.querySelector('#quests .rt-next'); return b ? b.textContent : null; });
      check(!!nx && /下一课：第 2 岛/.test(nx) && !(await rt()), '§9 第 1 岛都做完：卡片收成一行「下一课：第 2 岛 ……」', nx);
      await E(p, () => { const S = EchoGame.S; S.stars['1-6'] = 2; S.stars['2-6'] = 1; EchoGame.goHome('mon'); }); await W(p, 300);
      check(await E(p, () => !document.querySelector('#quests .rt-next, #quests .rt-card')), '§9 第 3 岛通关以后不再显示');
      // ---------- §10 点一个词看意思 ----------
      const ptOf = (sel, word) => ptAt(p, sel, word), pop = () => popOf(p);
      await act(p, 'wordList', { w: '0' }); await W(p, 300);
      let pt = await ptOf('#sheet .wd-ex-t > span', 'morning');
      if (pt) { await p.mouse.click(pt.x, pt.y); await W(p, 300); }
      let pp = await pop();
      check(!!pt && !!pp && pp.w === 'good morning' && pp.m === '早上好', '§10 单词表的例句里点「morning」：弹出「good morning 早上好」（词组按最长的配）', pp);
      check(await inView(p, '#wd-pop') && await inView(p, '#wd-pop [data-act=wdSay]'), '§10 小卡和 🔊 在屏幕里');
      await shot(p, 'en-pop-zh-port');
      const hb = await p.locator('#sheet .wd-h').boundingBox();
      await p.mouse.click(hb.x + 4, hb.y + hb.height / 2); await W(p, 200);
      check(!(await pop()), '§10 点小卡外面：小卡收起来');
      pt = await ptOf('#sheet .wd-ex-t > span', 'Wang');
      if (pt) { await p.mouse.click(pt.x, pt.y); await W(p, 300); }
      check(!!pt && !(await pop()), '§10 点课程里没有的词（Wang）：不弹（不猜）');
      await act(p, 'close');
      await E(p, () => EchoGame.playQs([['sr_s', 0, 0]])); await W(p, 400);
      const q0 = await E(p, () => ({ t: EchoGame.P().q.target, idx: EchoGame.P().idx }));
      const w1 = (await E(p, () => WORLDS[0].words.map(x => x[0]))).find(w => new RegExp('\\b' + w + '\\b', 'i').test(q0.t));
      pt = w1 ? await ptOf('#st', w1.split(' ')[0]) : null;
      if (pt) { await p.mouse.click(pt.x, pt.y); await W(p, 300); }
      pp = await pop();
      check(!w1 || (!!pp && pp.w.toLowerCase() === w1.toLowerCase() && (await E(p, () => EchoGame.P().idx)) === q0.idx), '§10 闯关的跟读题里点「' + (w1 || '') + '」：弹小卡，题目没变', { pp, t: q0.t });
      await E(p, () => EchoGame.goHome('quiz')); await W(p, 200);
      // §10 「点一下」本来就有用的地方（2026-11-22 老板：「对话有点卡」——大地图对话框点在字上翻不了页、一直弹卡）：
      //   轻点照旧（翻页 / 聊天气泡看翻译），按住一个词约半秒才弹卡，松手那一下不翻页
      await act(p, 'wEnter');
      let inW = false;
      for (let i = 0; i < 40 && !(inW = await E(p, () => !!(window.EchoWorld && EchoWorld._debug().M) && !document.querySelector('#world').hidden)); i++) await W(p, 150);
      check(inW, '§10 进大地图');
      for (let i = 0; i < 30 && await E(p, () => !!EchoWorld._debug().dlg); i++) { await E(p, () => { const s = document.querySelector('#w-dlg [data-act=wPick]'); (s || document.querySelector('#world [data-act=wA]')).click(); }); await W(p, 150); }
      const dlgAt = () => E(p, () => { const d = EchoWorld._debug().dlg; return d ? d.i : -1; });
      const typedOut = async () => { for (let i = 0; i < 40 && await E(p, () => !!(EchoWorld._debug().dlg && EchoWorld._debug().dlg.typing)); i++) await W(p, 100); };
      const two = () => E(p, () => EchoWorld._debug().talk([{ who: 'Kai', en: 'Good morning! See you at school.', zh: '早上好！学校见。' }, { who: 'Kai', en: 'Bye!', zh: '再见！' }]));
      await two(); await W(p, 200); await typedOut();
      pt = await ptOf('#w-dlg .d-en', 'morning');
      if (pt) { await p.mouse.click(pt.x, pt.y); await W(p, 300); }
      check(!!pt && (await dlgAt()) === 1 && !(await pop()), '§10 大地图对话框：轻点字上的「morning」照旧翻到下一页，不弹卡', await dlgAt());
      for (let i = 0; i < 5 && (await dlgAt()) >= 0; i++) { await E(p, () => document.querySelector('#world [data-act=wA]').click()); await W(p, 200); }
      await two(); await W(p, 200); await typedOut();
      pt = await ptOf('#w-dlg .d-en', 'morning');
      if (pt) { await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await W(p, 700); await p.mouse.up(); await W(p, 300); }
      pp = await pop();
      check(!!pt && !!pp && pp.w === 'good morning' && (await dlgAt()) === 0, '§10 大地图对话框：按住「morning」弹「good morning」，松手不翻页', { pp, i: await dlgAt() });
      await shot(p, 'en-pop-dlg-zh-port');
      const nb = await p.locator('#w-dlg .d-name').boundingBox();
      await p.mouse.click(nb.x + 4, nb.y + nb.height / 2); await W(p, 300);
      check(!(await pop()) && (await dlgAt()) === 1, '§10 再点一下对话框：小卡收起、翻到下一页', await dlgAt());
      // 手指按住以后挪开（在滑）：不算按住
      for (let i = 0; i < 5 && (await dlgAt()) >= 0; i++) { await E(p, () => document.querySelector('#world [data-act=wA]').click()); await W(p, 200); }
      // 聊天气泡（点一下 = 看翻译）：轻点交给气泡自己，按住才弹卡、松手那一下不交给气泡
      await E(p, () => { const b = document.createElement('div'); b.className = 'tk-b npc'; b.id = 'tkb-test'; b.textContent = 'Good morning! Do you like school?'; b.style.cssText = 'position:fixed;left:20px;top:120px;z-index:90;background:#fff;font-size:20px;padding:8px'; window.__bub = 0; b.addEventListener('click', () => { window.__bub++; }); document.body.appendChild(b); });
      pt = await ptOf('#tkb-test', 'morning');
      await p.mouse.click(pt.x, pt.y); await W(p, 300);
      check((await E(p, () => window.__bub)) === 1 && !(await pop()), '§10 聊天气泡：轻点交给气泡（看翻译），不弹卡');
      await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await W(p, 700); await p.mouse.up(); await W(p, 300);
      pp = await pop();
      check(!!pp && pp.w === 'good morning' && (await E(p, () => window.__bub)) === 1, '§10 聊天气泡：按住弹卡，松手那一下不交给气泡', pp);
      await E(p, () => { const e = document.getElementById('wd-pop'); if (e) e.hidden = true; });
      await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await W(p, 150); await p.mouse.move(pt.x, pt.y + 40); await W(p, 600); await p.mouse.up(); await W(p, 200);
      check(!(await pop()), '§10 按下去以后手指挪开（在滑）：不弹卡');
      await E(p, () => document.getElementById('tkb-test').remove());
      await E(p, () => EchoGame.goHome('quiz')); await W(p, 300);
      // ---------- §11 朗读慢一点 ----------
      await act(p, 'settings'); await W(p, 300);
      check(await E(p, () => !!document.querySelector('#set-slow [data-act=setSlow][data-v="0"].on') && !!document.querySelector('#set-route')), '§11 设置里有「朗读速度：正常 / 慢」（默认正常）、「新手路线」');
      await p.click('#set-slow [data-act=setSlow][data-v="1"]'); await W(p, 200);
      check(await E(p, () => EchoGame.S.settings.slow === true), '§11 选「慢」：存 settings.slow = true');
      await act(p, 'close');
      await act(p, 'wordList', { w: '0' }); await W(p, 300);
      await E(p, () => { window.__rates.length = 0; });
      await p.click('#sheet .wd-list > .wd-row:first-child [data-act=wdSay]'); await W(p, 300);
      await p.click('#sheet .wd-list > .wd-row:first-child [data-act=wdSlow]'); await W(p, 300);
      const rates = await E(p, () => window.__rates.slice());
      // 🐢 是 0.6（2026-11-23 老板：「慢速，并不慢」——以前被夹成 0.75，和「慢」的 0.8 几乎一样）
      check(rates[0] === 0.8 && Math.abs(rates[1] - 0.6) < 0.001, '§11 「慢」：配音 0.8 倍速放；🐢 只这一次放慢到 0.6，明显比「慢」还慢', rates);
      await shot(p, 'en-list-slow-zh-port');
      await act(p, 'close');
      await ctx.close();
      // 零基础（第 0 级）默认是慢
      ({ ctx, p } = await openGame(SAVE({ place: { lang: 'en', lv: 0, auto: 0, adj: 0, know: 0, who: 'adult', at: T0 } }), PORT));
      await act(p, 'settings'); await W(p, 300);
      check(await E(p, () => !!document.querySelector('#set-slow [data-act=setSlow][data-v="1"].on')), '§11 零基础（第 0 级）默认是「慢」');
      await act(p, 'close');
      await ctx.close();
    }

    // ======================= 别的课 =======================
    for (const L of ['ja', 'zh', 'es'].filter(want)) {
      const c = C[L], ui = UI[L], NAME = NAMES[L].zh;
      console.log('— ' + NAME + '（界面 ' + ui + '）');
      const { ctx, p } = await openGame(SAVE({ settings: { ui } }), PORT, '?packs=' + encodeURIComponent('/packs'));
      await toCourse(p, L, { settings: { ui, tts: 'auto', cards: true, wordTap: true } });
      // ---------- 首页的卡片 → 发音入门 ----------
      await E(p, () => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); }); await W(p, 300);
      let pc = await E(p, () => { const e = document.querySelector('#quests .pr-card'); return e ? e.innerText : null; });
      check(!!pc && (ui === 'zh' ? /先学发音和文字（约 10 分钟）/ : /Learn the sounds and letters first/).test(pc), '全新开始（还没有星）：首页给一张「先学发音和文字（约 10 分钟）」', pc);
      await p.click('#quests .pr-card [data-act=primer]'); await W(p, 300);
      const J = PRIMER[L];
      let pr = await E(p, () => ({ tabs: [...document.querySelectorAll('#sheet .pr-tabs button')].map(b => b.textContent), cells: document.querySelectorAll('#sheet .pr-grid > *').length, empty: document.querySelectorAll('#sheet .pr-grid .pr-cell.empty').length, cols: getComputedStyle(document.querySelector('#sheet .pr-grid')).gridTemplateColumns.split(' ').length, rom: [...document.querySelectorAll('#sheet .pr-grid .pr-cell i')].map(i => i.textContent), seen: EchoGame.S.primerSeen }));
      check(pr.tabs.length === 2 + ((c.LESSONS && c.LESSONS.help && c.LESSONS.help.length) ? 1 : 0) && pr.cells === J.sections[0].items.length && pr.empty === J.sections[0].items.filter(x => x == null).length && pr.cols === J.sections[0].cols && pr.seen === T0,
        '发音入门：两段（标题按界面语言）、第一段的格子 ' + pr.cells + ' 个（空格子 ' + pr.empty + '）、' + pr.cols + ' 列；看过记 primerSeen', pr);
      check(JSON.stringify(pr.rom) === JSON.stringify(J.sections[0].items.filter(x => x && x.rom && x.rom !== x.t).map(x => x.rom)), '每格显示 ' + (L === 'ja' ? '假名 + 罗马字' : L === 'zh' ? '拼音 + 例字' : '字母 + 字母名') + '（和大字一样的那行不重复写）', pr.rom);
      await E(p, () => { window.__speak.length = 0; window.__keys.length = 0; });
      await p.click('#sheet .pr-grid .pr-cell:not(.empty) >> nth=0'); await W(p, 400);
      const it0 = J.sections[0].items[0], loc = { ja: 'ja-JP', zh: 'zh-CN', es: 'es-MX' }[L];
      let sp = await E(p, () => ({ speak: window.__speak.slice(), keys: window.__keys.slice(), ex: (document.querySelector('#pr-ex:not([hidden])') || {}).innerHTML || '' }));
      check(sp.speak.length === 1 && sp.speak[0].text === it0.say && sp.speak[0].lang === loc && sp.speak[0].rate === 0.8 && !sp.keys.length, '点一格：用手机自带的声音念「' + it0.say + '」（' + loc + (L === 'es' ? '，es-ES 也有时先挑 es-MX' : '') + '，rate 0.8），不放课程包', sp.speak);
      const ex0 = it0.ex[0];
      check(sp.ex.includes(ex0.pic) && (L === 'es' ? !sp.ex.includes('<ruby>') : /<ruby>/.test(sp.ex)) && (L !== 'ja' || sp.ex.includes('>' + JA.romaji(ex0.r) + '<')), '下面出例词：「' + ex0.t + '」' + (L === 'es' ? '（西语不标读音）' : '带读音') + (L === 'ja' ? '和罗马字 ' + JA.romaji(ex0.r) : ''), sp.ex.slice(0, 300));
      await E(p, () => { window.__keys.length = 0; window.__speak.length = 0; });
      await p.click('#pr-ex [data-act=prSayEx]'); await W(p, 300);
      sp = await E(p, () => ({ keys: window.__keys.slice(), speak: window.__speak.slice() }));
      check(sp.keys[0] === key(ex0.t) + '/f' && !sp.speak.length, '点例词的 🔊：放课程包里提前配好的那段（女声）', sp);
      check(!(await rubyClash(p)).length, '读音没有压到别的字', await rubyClash(p));
      await shot(p, L + '-primer-' + ui + '-port');
      // 这台设备没有这门语言的声音：退回 say()（课程包里有就放，没有就云端合成 → 本机）
      await E(p, () => { window.__voices = [{ name: 'Samantha', lang: 'en-US' }]; window.__speak.length = 0; window.__keys.length = 0; });
      await p.click('#sheet .pr-grid .pr-cell:not(.empty) >> nth=1'); await W(p, 400);
      const it1 = J.sections[0].items.filter(Boolean)[1];
      sp = await E(p, () => ({ keys: window.__keys.slice(), speak: window.__speak.slice() }));
      // （say() 自己最后那一步还会用开机时记下的本机声音——那是现成的那条路：rate 是设置里的语速，不是发音入门的 0.8）
      check(sp.keys.includes(key(it1.say) + '/f') && sp.speak.every(x => x.rate !== 0.8), '这台设备没有' + NAME + '的声音：退回 say()（先找课程包里的配音，再走现成的那条路）', sp);
      await E(p, () => { window.__voices = [{ name: 'Kyoko', lang: 'ja-JP' }, { name: 'Ting-Ting', lang: 'zh-CN' }, { name: 'Monica', lang: 'es-ES' }, { name: 'Paulina', lang: 'es-MX' }]; });
      await p.click('#sheet [data-act=prSec][data-s="1"].btn'); await W(p, 300);
      pr = await E(p, () => ({ rows: document.querySelectorAll('#sheet .pr-list .pr-row').length, note: (document.querySelector('#sheet .pr-row .pr-note') || {}).textContent || '', done: !!document.querySelector('#sheet .row [data-act=close].btn:not(.ghost)') }));
      const hasHelp = !!(c.LESSONS && c.LESSONS.help && c.LESSONS.help.length);
      check(pr.rows === J.sections[1].items.length && pr.note && pr.done === !hasHelp, '下一段（list）：一行一个、带说明；' + (hasHelp ? '后面还有「求助的话」那一段' : '最后一段的按钮是「✓ 学完了」'), pr);
      await shot(p, L + '-primer2-' + ui + '-port');
      // §8 发音入门的最后一段是「🆘 求助的话」（正式的 lessons.json）
      const HP = (c.LESSONS && c.LESSONS.help) || [];
      if (HP.length) {
        await act(p, 'prSec', { s: String(J.sections.length) }); await W(p, 300);
        const hr = await E(p, () => ({ tab: (document.querySelector('#sheet .pr-tabs button.on') || {}).textContent || '', rows: [...document.querySelectorAll('#sheet .hp-row')].map(r => ({ t: r.querySelector('.wd-s').innerHTML, r: (r.querySelector('.ls-r') || {}).textContent || '', rom: (r.querySelector('.wd-rom') || {}).textContent || '', m: (r.querySelector('.wd-m') || {}).textContent || '', use: (r.querySelector('.hp-use') || {}).textContent || '' })), done: !!document.querySelector('#sheet > .row [data-act=close].btn:not(.ghost)') }));
        check(/求助的话|Phrases for help/.test(hr.tab) && hr.rows.length === HP.length && hr.done, '§8 发音入门的最后一段：🆘 求助的话（' + hr.rows.length + ' 句），这一段的按钮是「✓ 学完了」', hr.tab);
        check(hr.rows.every((x, k) => x.use && (L === 'zh' ? x.r && (ui === 'zh' ? !x.m : x.m === HP[k].en) : x.m)), '§8 每句有意思（中文课：英语界面写 en、拼音一行）和「什么时候用」' + (L === 'ja' ? '；日语有罗马字' : ''), hr.rows.slice(0, 2));
        if (L === 'ja') check(hr.rows.every(x => x.rom), '§8 日语的求助的话有罗马字', hr.rows.map(x => x.rom));
        await E(p, () => { window.__keys.length = 0; });
        await p.click('#sheet .hp-row:first-child [data-act=hpSay]'); await W(p, 300);
        check((await E(p, () => window.__keys.slice()))[0] === key(HP[0].t) + '/f', '§8 点 🔊：放课程包里配好的那句（女声）');
        await shot(p, L + '-help-' + ui + '-port');
      }
      await act(p, 'close'); await W(p, 200);
      check(await E(p, () => !document.querySelector('#quests .pr-card')), '看过发音入门：首页的卡片不再出');
      await quiz(p);
      check(await E(p, () => !!document.querySelector('#map > .wd-bar [data-act=primer]') && !!document.querySelector('#map > .wd-bar [data-act=wordBook]')), '闯关练习页最上面：「📒 我的单词本」旁边「🔤 发音入门」');
      // ---------- 单词表 ----------
      await E(p, () => { EchoGame.S.book.view = 'isle'; EchoGame.goHome('quiz'); }); await W(p, 300);
      await p.click('#w0 [data-act=wordList]'); await W(p, 300);
      const w0 = c.WORLDS[0];
      let wl = await E(p, () => ({ rows: [...document.querySelectorAll('#sheet .wd-list:not(.wd-slist) > .wd-row')].map(r => ({ w: r.querySelector('.wd-w b').innerHTML, rom: (r.querySelector(':scope > .wd-main > .wd-rom') || {}).textContent || '', m: (r.querySelector(':scope > .wd-main > .wd-m') || {}).textContent || '' })), tog: !!document.querySelector('#sheet .wd-tog'), title: document.querySelector('#sheet .wd-ht h2').innerHTML }));
      const noRt = s => s.replace(/<rt>[^<]*<\/rt>/g, '').replace(/<[^>]+>/g, '');
      check(wl.rows.length === w0.words.length && wl.rows.every((r, i) => noRt(r.w) === w0.words[i][0]), '单词表：' + w0.words.length + ' 个词（' + NAME + '）', wl.rows.slice(0, 2));
      const kanji = w0.words.findIndex(x => /[㐀-鿿]/.test(x[0]));
      if (L === 'ja') {
        check(kanji < 0 || /<ruby>/.test(wl.rows[kanji].w), '日语：有汉字的词标读音（<ruby>）', kanji >= 0 ? wl.rows[kanji].w : '');
        // 罗马字按词分开写（去掉空格就是整个词的罗马字）
        check(wl.rows.every((r, i) => r.rom.replace(/ /g, '') === JA.romaji(w0.words[i][3].r).replace(/ /g, '')) && wl.tog, '日语：每个词多一行罗马字（' + wl.rows.slice(0, 3).map(r => r.rom).join(' / ') + '）；顶上有「罗马字」开关', wl.rows.map(r => r.rom));
        const oha = w0.words.findIndex(x => x[0] === 'おはようございます');
        if (oha >= 0) check(wl.rows[oha].rom === 'ohayou gozaimasu', '日语罗马字按词分开：おはようございます → ohayou gozaimasu', wl.rows[oha].rom);
        const exRom = await E(p, () => [...document.querySelectorAll('#sheet .wd-ex .wd-rom')].map(e => e.textContent));
        check(exRom.includes('tanaka sensei, konnichiwa.') || !w0.sents.some(s => s[0] === '田中先生、こんにちは。'), '例句的罗马字按词块分开：田中先生、こんにちは。→ tanaka sensei, konnichiwa.', exRom);
        await shot(p, 'ja-list-zh-port');
        // §10 日语：例句里点「先生」（词块是「田中先生、」，块查不到就按最长匹配课程里的词）
        const pt = await ptAt(p, '#sheet .wd-ex-t > span', '先生');
        if (pt) { await p.mouse.click(pt.x, pt.y); await W(p, 300); }
        const pp = await popOf(p), sw = w0.words.find(x => x[0] === '先生');
        check(!sw || (!!pp && pp.w.replace(/せんせい/, '') === '先生' && /<ruby>/.test(pp.h) && pp.m === sw[1]), '§10 日语例句里点「先生」：弹出「先生（せんせい）老师」', pp);
        if (pp) await shot(p, 'ja-pop-zh-port');
        await act(p, 'wdPopX');
        await p.click('#sheet [data-act=wdRoma][data-v="0"]'); await W(p, 250);
        const off = await E(p, () => ({ n: document.querySelectorAll('#sheet .wd-rom').length, s: EchoGame.S.settings.romaji }));
        await p.click('#sheet [data-act=wdRoma][data-v="1"]'); await W(p, 250);
        const on = await E(p, () => ({ n: document.querySelectorAll('#sheet .wd-rom').length, s: EchoGame.S.settings.romaji }));
        check(off.n === 0 && off.s === false && on.n >= w0.words.length && on.s === true, '罗马字开关：关了就不显示（存 settings.romaji = false），开了又有', { off, on });
      } else {
        check(L === 'zh' ? wl.rows.some(r => /<ruby>/.test(r.w)) && !wl.rows.some(r => r.rom) : !wl.rows.some(r => /<ruby>/.test(r.w) || r.rom), L === 'zh' ? '中文：词带拼音读音，没有罗马字' : '西语：没有读音、没有罗马字');
        check(!wl.tog, '只有日语有罗马字开关');
        await shot(p, L + '-list-' + ui + '-port');
      }
      check(wl.rows.every((r, i) => r.m === (ui === 'zh' && L !== 'zh' ? w0.words[i][1] : w0.words[i][3].en)), '意思按界面语言（' + ui + '）', wl.rows.slice(0, 2).map(r => r.m));
      check(/pl-c/.test(wl.title), '标题：这门课的写法大字 + 界面语言小字', wl.title);
      check(!(await rubyClash(p)).length, '读音没有压到别的字', await rubyClash(p));
      const se = await scrollEnd(p, '#sheet .wd-list:not(.wd-slist) > .wd-row', '#sheet .row [data-act=close]');
      check(se.ok, '滚到底：「关闭」在屏幕里', se);
      await act(p, 'close');
      // ---------- 单词卡 ----------
      await act(p, 'start', { w: '0', l: '0' }); await W(p, 500);
      // §7 这一课学什么（正式的 lessons.json）：句型、读音（日语有汉字时 / 中文拼音）、例句带读音和意思
      const LT = c.LESSONS && c.LESSONS.towns && c.LESSONS.towns['0'];
      if (LT) {
        const ls = await E(p, () => ({ pats: [...document.querySelectorAll('#sheet .ls-pat')].map(e => ({ p: e.querySelector('.ls-p').textContent, r: (e.querySelector('.ls-r') || {}).textContent || '', rom: (e.querySelector(':scope > .wd-rom') || {}).textContent || '' })),
          ex: [...document.querySelectorAll('#sheet .ls-ex')].map(e => ({ h: e.querySelector('.wd-ex-t > span').innerHTML, m: (e.querySelector(':scope > small') || {}).textContent || '' })), next: !!document.querySelector('#sheet [data-act=lsNext]'), txt: document.getElementById('sheet').innerText }));
        check(ls.next && ls.pats.length === LT.patterns.length && ls.pats.every((x, k) => x.p === LT.patterns[k].p.replace(/_{2,}/g, '___')),
          '§7 ' + NAME + '：第一次进第 1 关先出「这一课学什么」，' + ls.pats.length + ' 个句型', ls.pats);
        check(L === 'es' ? !ls.ex.some(e => /<ruby>/.test(e.h)) : ls.ex.some(e => /<ruby>/.test(e.h)), '§7 例句' + (L === 'es' ? '（西语）不标读音' : '标读音'), ls.ex.slice(0, 2));
        check(ls.ex.length && ls.ex.every(e => e.m), '§7 例句都有界面语言的意思', ls.ex.map(e => e.m));
        if (L === 'zh') check(ls.pats.every(x => x.r), '§7 中文的句型下面写拼音', ls.pats);
        if (L === 'ja') check(ls.pats.every(x => x.rom), '§7 日语的句型下面写罗马字', ls.pats.map(x => x.rom));
        check(!(await rubyClash(p)).length, '§7 读音没有压字', await rubyClash(p));
        await shot(p, L + '-lesson-' + ui + '-port');
        await E(p, () => { window.__keys.length = 0; });
        await p.click('#sheet [data-act=lsNext]'); await W(p, 600);
      } else await E(p, () => { window.__keys.length = 0; });
      const cd = await E(p, () => { const c = document.getElementById('wc'); return c ? { word: c.querySelector('.wc-word').innerHTML, rom: (c.querySelector('.wc-rom') || {}).textContent || '', keys: window.__keys.slice() } : null; });
      check(!!cd && noRt(cd.word) === w0.words[0][0] && (L === 'ja' ? cd.rom === JA.romaji(w0.words[0][3].r) : !cd.rom) && cd.keys.includes(key(w0.words[0][0]) + '/f'),
        '单词卡：' + w0.words[0][0] + (L === 'ja' ? '（罗马字 ' + cd.rom + '）' : '') + '，出现时放课程包里的配音（女声）', cd);
      await E(p, () => { window.__keys.length = 0; });
      await p.click('#sheet [data-act=wcSay]'); await W(p, 300);
      const k2 = await E(p, () => window.__keys.slice());
      check(k2[0] === key(w0.words[0][0]) + '/m' && k2[1] === key(w0.words[0][0]) + '/f', '🔊 先要男声，课程包里只有女声就放女声', k2);
      await shot(p, L + '-cards-' + ui + '-port');
      await p.setViewportSize(LAND); await W(p, 400);
      check(await inView(p, '#sheet [data-act=wcNext]') && await inView(p, '#sheet .wc-say') && await inView(p, '#sheet [data-act=wcSkip]'), '横屏单词卡：翻页、🔊、跳过都在屏幕里');
      check(!(await rubyClash(p)).length, '横屏单词卡：读音没有压字', await rubyClash(p));
      await shot(p, L + '-cards-' + ui + '-land');
      await act(p, 'wcSkip'); await W(p, 300);
      await E(p, () => EchoGame.goHome('quiz')); await W(p, 200);
      await p.click('#w0 [data-act=wordList]'); await W(p, 300);
      await shot(p, L + '-list-' + ui + '-land');
      await act(p, 'close');
      await act(p, 'primer'); await W(p, 300);
      check(await inView(p, '#sheet .row .btn:last-child'), '横屏发音入门：下面的按钮在屏幕里');
      await shot(p, L + '-primer-' + ui + '-land');
      await act(p, 'close');
      await p.setViewportSize(PORT); await W(p, 300);
      // ---------- 我的单词本：跟着这门课的存档走 ----------
      await E(p, () => { EchoGame.S.stars['0-0'] = 3; EchoGame.goHome('quiz'); }); await W(p, 300);
      const n = await E(p, () => document.querySelector('#map > .wd-bar [data-act=wordBook]').innerText);
      check(new RegExp(ui === 'zh' ? '学过 ' + w0.words.length + ' 个词' : w0.words.length + ' words learned').test(n), '单词本：这门课拿过星的小镇的 ' + w0.words.length + ' 个词', n);
      await p.click('#map [data-act=wordBook]'); await W(p, 300);
      if (L === 'ja') { await p.fill('#wb-q', JA.romaji(w0.words[1][3].r)); await W(p, 200); }
      const bk = await E(p, () => [...document.querySelectorAll('#wb-list .wd-row .wd-w b')].map(b => b.innerHTML));
      check(L !== 'ja' || (bk.length >= 1 && bk.some(h => noRt(h) === w0.words[1][0])), '日语单词本：用罗马字也找得到（' + (L === 'ja' ? JA.romaji(w0.words[1][3].r) : '') + '）', bk.slice(0, 3));
      await shot(p, L + '-book-' + ui + '-port');
      await act(p, 'close');
      const en = await E(p, () => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); return { seen: s.seenCards, primer: s.primerSeen }; });
      check(!Object.keys(en.seen || {}).length && !en.primer, '英语课的存档里没有这门课的单词卡、发音入门记录（每门课各自一份）', en);
      await ctx.close();
    }

    // ======================= 真的 primer.json =======================
    if (want('real')) {
      for (const L of Object.keys(REAL)) {
        const J = REAL[L].PRIMER, ui = UI[L];
        console.log('— 真的 tools/course/' + L + '/primer.json（' + J.sections.length + ' 段）');
        const { ctx, p } = await openGame(SAVE({ settings: { ui } }), PORT, '?packs=' + encodeURIComponent('/real'));
        await toCourse(p, L, { settings: { ui, tts: 'auto' } });
        await act(p, 'primer'); await W(p, 300);
        for (let k = 0; k < J.sections.length; k++) {
          const s = J.sections[k];
          await act(p, 'prSec', { s: String(k) }); await W(p, 250);
          const r = await E(p, () => ({ cells: document.querySelectorAll('#sheet .pr-grid > *').length, rows: document.querySelectorAll('#sheet .pr-list > .pr-row').length, hs: document.querySelector('#sheet .pr-sec h3').textContent, over: [...document.querySelectorAll('#sheet .pr-cell, #sheet .pr-row')].filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.innerText.replace(/\s+/g, ' ')).slice(0, 4) }));
          const n = s.layout === 'grid' ? r.cells : r.rows, want = s.layout === 'grid' ? s.items.length : s.items.filter(Boolean).length;
          check(n === want && !r.over.length, '第 ' + (k + 1) + ' 段「' + r.hs + '」（' + s.layout + '）：' + n + ' 个都画出来了、字没挤出格子', r);
          // 点第一个带例词的格子
          const j = s.items.findIndex(it => it && it.ex && it.ex.length);
          if (j >= 0) { await p.click('#sheet [data-act=prSay][data-i="' + j + '"]'); await W(p, 300); check(await E(p, () => !document.getElementById('pr-ex').hidden && document.querySelectorAll('#pr-ex .wd-row').length > 0), '  点「' + s.items[j].t + '」：下面出例词'); }
          const end = await E(p, () => { const sh = document.getElementById('sheet'); sh.scrollTop = sh.scrollHeight; const last = [...document.querySelectorAll('#sheet .pr-grid > *, #sheet .pr-list > *, #pr-ex:not([hidden])')].pop(), b = document.querySelector('#sheet > .row'); const lr = last.getBoundingClientRect(), br = b.getBoundingClientRect(); return { ok: lr.bottom <= br.top + 2 && br.bottom <= innerHeight + 1 && sh.scrollWidth <= sh.clientWidth + 1, lr: Math.round(lr.bottom), bt: Math.round(br.top) }; });
          check(end.ok, '  滚到底：最后一格看得见、下面的按钮在屏幕里、不横着滚', end);
          if (k <= 2) { await E(p, () => { document.getElementById('sheet').scrollTop = 0; }); await shot(p, L + '-primer-real-' + (k + 1) + '-port'); }
        }
        await p.setViewportSize(LAND); await W(p, 400);
        await act(p, 'prSec', { s: '0' }); await W(p, 300);
        check(await inView(p, '#sheet > .row .btn:last-child'), '横屏：下面的按钮在屏幕里');
        await shot(p, L + '-primer-real-1-land');
        await ctx.close();
      }
      if (!Object.keys(REAL).length) console.log('  （tools/course/<语言>/primer.json 还没有，跳过）');
    }
  } catch (e) { check(false, '出错：' + e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); }
  check(!errs.length, '没有报错', errs.slice(0, 5));
  await browser.close();
  web.close();
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
