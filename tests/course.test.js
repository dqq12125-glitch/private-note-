// 别的语言的课（tools/course/ENGINE.md §7，Playwright Chromium，约 3–4 分钟）：node tests/course.test.js [--only=es,ja,zh,B,C,D]
// 课程内容：真的课程源文件（tools/course/<语言>/）经 tools/course/build.js 出的 course.json；配音是几段假的（借安装包里一段英语配音的字节），
// 自己起本机小网站：游戏文件 + /packs/（catalog：英语 + 西语 / 日语 / 中文，每门课 course.json + 一个配音包，都是 core）。
//   每门语言（es / ja / zh）各走一遍：
//   1 英语存档在课程包模式里 → 设置「📦 课程和语音包」那一行「学这门」→ 确认 → 下最要紧的那部分 → 重新打开：echo-course、新存档 echo-island-v1@<语言>
//     （设置抄过来、track 是 level、带 course），英语存档一个字没碰
//   2 全新的开始：不选语言了，直接「谁在学 / 学过多少」→ 不测、按学过多少定级（结果页写明检测题在做）→ 游戏说明
//   3 首页：课程单元（没有「适用于沪教版词汇」）、读音设置（日语、中文有，西语没有）、页脚说的是这门语言
//   4 每种题型：听音选义、听音选词、看图说、跟读、听句选意、排句子、听问选答、说出回答、Boss——
//     假识别结果按 EchoLang 打分（对、错、半对各一例：和 Node 里 lang-*.js 对同一个条目打出来的分一样），识别语言是这门语言；
//     日语 / 中文有 <ruby> 读音、西语没有；遮起来的提示不露答案
//   5 每日复习：答错的进了复习本，复习题是这门语言的
//   6 大地图：说话任务换成了这座岛课程里的句子（题面有意思），只给人看的台词是界面语言、没有 🔊，选回答的页换成课程里的对话；对战一回合（念咒语、听咒语选意思）
//   7 换回英语：英语存档（连备份）一个字没变，内容是英语的
//   B 这门课的 course.json 读不出来：停在「下载课程」那一页（存档不读、不写），下载好了重新打开就能学；「先学英语」
//   C 老模式（没有课程包地址）：echo-course 写着别的语言也照旧是英语
//   D 云端模式：手机自带的识别用不了时，口语题不连服务器的（还写死英语的）识别，按「AI 用不了」走：说清楚原因、「先跳过」、进复习欠着
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
require(path.join(ROOT, 'lang-es.js')); require(path.join(ROOT, 'lang-ja.js')); require(path.join(ROOT, 'lang-zh.js'));
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = s => !ONLY.length || ONLY.includes(s);
const LANGS = ['es', 'ja', 'zh'].filter(want);

// ---------- 课程包小样 ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-course-web-'));
const VER = '20261120.1';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
const C = {};
let viaBuilder = true;
function courseOf(lang) {
  // 用 tools/course/build.js（先过 check.js，不写文件）；check 没过就直接用它的 buildCourse，并在这里说一声
  // lines: false：这一套测的是没有台词翻译表时的过渡办法（ENGINE.md §5），正式的 lines.json 来了也不带；有翻译表的在 tests/course-lines.test.js
  try { return CB.build(lang, { check: true, lines: false }).course; } catch (e) { viaBuilder = false; console.log('  ⚠ ' + lang + '：tools/course/check.js 没过，用 buildCourse 直接转：' + String(e.message).split('\n')[0]); return CB.buildCourse(lang, { lines: false }); }
}
function pack(lang, texts, course) {
  const dir = path.join(TMP, lang, VER); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  if (course) {
    const b = Buffer.from(JSON.stringify(course));
    fs.writeFileSync(path.join(dir, 'course.json'), b);
    files.push({ name: 'course.json', kind: 'course', bytes: b.length, crc: PK.crcHex(new Uint8Array(b)) });
  }
  const seen = new Set(), items = [];
  texts.forEach(t => { const k = key(t); if (!seen.has(k)) { seen.add(k); items.push({ g: 'f', k, data: new Uint8Array(OGG) }); } });
  const v = PK.packBundle(items);
  fs.writeFileSync(path.join(dir, 'voice-000.bin'), v);
  files.push({ name: 'voice-000.bin', kind: 'voice', core: true, bytes: v.length, crc: PK.crcHex(v), n: items.length });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ fmt: 1, lang, ver: VER, voice: { fmt: 'ogg-opus', f: 'x', m: 'y', n: { f: items.length, m: 0 } }, files }));
  return { bytes: files.reduce((s, f) => s + f.bytes, 0), core: files.reduce((s, f) => s + f.bytes, 0), voiced: texts };
}
const NAMES = { en: { zh: '英语', en: 'English', self: 'English' }, es: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, ja: { zh: '日语', en: 'Japanese', self: '日本語' }, zh: { zh: '中文', en: 'Chinese', self: '中文' } };
const CAT = { fmt: 1, packs: {} };
{ const e = pack('en', ['Hello!']); CAT.packs.en = { ver: VER, name: NAMES.en, bytes: e.bytes, core: e.core, course: false }; }
for (const l of ['es', 'ja', 'zh']) {
  const c = C[l] = courseOf(l), w = c.WORLDS[0];
  const voiced = w.words.map(x => x[0]).concat(w.sents.map(x => x[0]), w.dlgs.flatMap(d => [d[0], d[1]]), c.SCENES[0].lines.map(x => x[1]));   // 第一座岛的都有「配音」
  const pk = pack(l, voiced, c);
  CAT.packs[l] = { ver: VER, name: NAMES[l], bytes: pk.bytes, core: pk.core, course: true, voiced };
}
console.log('  课程：' + LANGS.map(l => l + ' ' + C[l].WORLDS.length + ' 个小镇、' + C[l].BOOKS.list.reduce((s, b) => s + b.units.length, 0) + ' 个单元').join('；') + (viaBuilder ? '（tools/course/build.js）' : ''));

// Node 里同一个条目的分数（和 tests/lang.test.js 用的是同一套 lang-*.js）
const entriesOf = c => {
  const out = [], x = it => (it[it.length - 1] && typeof it[it.length - 1] === 'object' && !Array.isArray(it[it.length - 1]) ? it[it.length - 1] : {});
  c.WORLDS.concat(c.BOOKS.list.flatMap(b => b.units)).forEach(w => {
    w.words.forEach(it => out.push(Object.assign({ t: it[0], zh: it[1] }, x(it))));
    w.sents.forEach(it => out.push(Object.assign({ t: it[0], zh: it[1] }, x(it))));
    w.dlgs.forEach(it => { const g = x(it); out.push(Object.assign({ t: it[0] }, g.q)); out.push(Object.assign({ t: it[1] }, g.a)); it[2].forEach((t, k) => out.push(Object.assign({ t }, (g.wrong || [])[k]))); });
  });
  return out;
};
const NODE = {};
for (const l of LANGS) { const es = entriesOf(C[l]); NODE[l] = { mod: EL.get(l), lex: EL.lexicon(l, es), byT: new Map(es.map(e => [e.t, e])) }; }
const nodeScore = (l, t, h) => { const N = NODE[l]; return N.mod.score(t, h, { entry: N.byT.get(t) || null, lex: N.lex }); };
// 半对的一例：去掉一块（或者两块）以后分数在 60–84 的
function halfOf(l, t) {
  const N = NODE[l], e = N.byT.get(t), ps = N.mod.pieces(t, e), join = a => a.join(N.mod.script === 'latin' ? ' ' : '');
  for (let i = ps.length - 1; i >= 0; i--) { const h = join(ps.filter((_, k) => k !== i)); const r = nodeScore(l, t, h); if (r.score >= 60 && r.score < 85) return h; }
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const h = join(ps.filter((_, k) => k !== i && k !== j)); const r = nodeScore(l, t, h); if (r.score >= 60 && r.score < 85) return h; }
  return null;
}

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const SRV = { hits: {}, gone: new Set() };
const server = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  SRV.hits[u] = (SRV.hits[u] || 0) + 1;
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(body); };
  if (u.startsWith('/packs/')) {
    const r = u.slice(7);
    if (r === 'catalog.json') return send(200, JSON.stringify(CAT), MIME.json);
    const file = path.join(TMP, r);
    if (!file.startsWith(TMP) || !fs.existsSync(file) || SRV.gone.has(r)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});

// 英语的测试存档：有进度（不进能力检测）、看过说明、口语自评、发音只用配音、不放音乐、自己学（不要家长密码）
const SAVE = () => ({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120,
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh' },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
});
const CJK = /[぀-ヿ㐀-鿿]/;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://echo.localhost:' + server.address().port, PACKS = '/packs';
  const browser = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  async function newCtx(save) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (save !== false) await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(SAVE()));
    // 每次打开页面（游戏的脚本跑之前）记下英语存档那几个键的原文：换回英语时比
    await ctx.addInitScript(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^echo-island-v1(-|$)/.test(k)) o[k] = localStorage.getItem(k); }
      window.__enAtLoad = o;
      window.__plays = [];
      const p0 = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { const r = p0.call(this), it = { src: this.src, ok: null }; window.__plays.push(it); if (r && r.then) r.then(() => { it.ok = true; }, e => { it.ok = String(e && e.name); }); return r; };
    });
    return ctx;
  }
  async function openPage(ctx, query) {
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.logs = [];
    p.on('console', m => p.logs.push(m.text()));
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
    await p.goto(BASE + '/index.html' + (query || ''));
    return p;
  }
  const W = (p, ms) => p.waitForTimeout(ms);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'course-' + name + '.png') });
  const enKeys = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^echo-island-v1(-|$)/.test(k)) o[k] = localStorage.getItem(k); } return o; });
  const same = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
  // 假的识别：game.js 用 AI 打分（sr），每次识别从 __heard 里拿一句；记下 listenOnce 收到的语言
  const fakeSR = p => p.evaluate(() => {
    window.__heard = []; window.__asr = [];
    EchoTalk.cloudSR = () => true;
    EchoTalk.listenOnce = async o => { window.__asr.push({ lang: o.lang || null, short: o.short, head: typeof o.head, count: typeof o.count }); const t = window.__heard.length ? window.__heard.shift() : ''; if (o.onState) o.onState(t); return { text: t, err: t ? null : 'no-speech', how: 'done' }; };
    EchoGame.S.settings.mode = 'auto';
  });
  const say = (p, t) => p.evaluate(t => { window.__heard.push(t); }, t);
  const mic = async (p, sel) => { await p.click(sel || '#mic'); await W(p, 350); };
  const fbOk = p => p.evaluate(() => { const f = document.getElementById('fb'); return f.classList.contains('show') ? (f.classList.contains('ok') ? 'ok' : f.classList.contains('bad') ? 'bad' : 'skip') : ''; });
  const next = async p => { if (await p.isVisible('#fb-btn')) { await p.click('#fb-btn'); await W(p, 300); } };

  try {
    for (const L of LANGS) {
      console.log('— ' + L + '（' + NAMES[L].zh + '）');
      const c = C[L], NAME = NAMES[L].zh;
      const ctx = await newCtx();
      let p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await homeUp(p);
      // ---------- 1 换课 ----------
      const en0 = await p.evaluate(() => ({ course: EchoPacks.course(), w0: WORLDS[0].words[0][0], key: Object.keys(localStorage).filter(k => k.startsWith('echo-island-v1@')) }));
      check(en0.course === 'en' && en0.w0 === 'hello' && !en0.key.length, '英语课：课程包模式下照旧是英语的内容，没有别的课的存档', en0);
      await p.evaluate(() => EchoGame.T.settings());
      await p.click('[data-act=pkSet]');
      await p.waitForFunction(l => !!document.querySelector('#pk-sheet [data-act=pkLearn][data-l="' + l + '"]'), L, { timeout: 8000 }).catch(() => {});
      const rowsOf = () => p.evaluate(() => [...document.querySelectorAll('#pk-sheet .pk-row')].map(r => r.dataset.l + ':' + !!r.querySelector('[data-act=pkLearn]')));
      let rows = await rowsOf();
      if (L === 'zh') {
        // 中文课：中文界面里不列；换成英语界面才有
        check(!rows.some(r => r.startsWith('zh:')) && rows.includes('es:true'), '中文界面里不列中文课（别的课照样列）', rows);
        await p.evaluate(() => { EchoGame.S.settings.ui = 'en'; EchoI18n.set('en'); EchoGame.T.settings(); });
        await p.click('[data-act=pkSet]');
        await p.waitForSelector('#pk-sheet [data-act=pkLearn][data-l="zh"]');
        rows = await rowsOf();
      }
      check(rows.includes(L + ':true') && rows.includes('en:false'), '「📦 课程和语音包」：' + NAME + '有「学这门」，现在学的英语没有', rows);
      await p.click('#pk-sheet [data-act=pkLearn][data-l="' + L + '"]');
      await p.waitForSelector('[data-act=pkLearnGo]');
      await shot(p, L + '-learn');
      await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.click('[data-act=pkLearnGo]')]);
      // ---------- 2 全新的开始 ----------
      await p.waitForFunction(() => !!document.querySelector('#pl-box[data-step=who]'), null, { timeout: 25000 });
      const s1 = await p.evaluate(l => {
        const raw = localStorage.getItem('echo-island-v1@' + l), o = JSON.parse(raw || '{}');
        return { course: EchoPacks.course(), lang: EchoPlace._ui() && EchoGame.S.place.lang, key: !!raw, oc: o.course, track: o.settings && o.settings.track, ui: o.settings && o.settings.ui, learner: o.settings && o.settings.learner, voice: o.settings && o.settings.voice, coins: o.coins, w0: WORLDS[0].words[0][0], fresh: !o.world || !o.world.started };
      }, L);
      check(s1.course === L && s1.key && s1.oc === L && s1.track === 'level' && s1.learner === 'open' && s1.ui === (L === 'zh' ? 'en' : 'zh') && s1.coins === 50 && s1.fresh,
        '学这门 → 下好重新打开：新存档 echo-island-v1@' + L + '（设置抄过来、track = level、带 course、金币和进度从头开始）', s1);
      check(s1.w0 === c.WORLDS[0].words[0][0], '内容换成了课程包里的 course.json（第一个词：' + c.WORLDS[0].words[0][0] + '）', s1.w0);
      // 换走的时候英语存档先存好了一次（courseGo）：这一刻的原文记下来，换回英语时比
      const enLeft = await p.evaluate(() => window.__enAtLoad);
      check(Object.keys(enLeft).includes('echo-island-v1') && JSON.parse(enLeft['echo-island-v1']).coins === 500 && !JSON.parse(enLeft['echo-island-v1']).course, '换走的时候英语存档在、还是英语的（没有 course）', Object.keys(enLeft));
      const pick = async (sel) => { await p.click(sel); await W(p, 150); };
      await pick('[data-act=plWho][data-v=adult]'); await pick('[data-act=plKnow][data-v="1"]');
      await shot(p, L + '-who');
      await pick('#pl-next');
      await p.waitForFunction(() => !!document.querySelector('#pl-box[data-step=result]'), null, { timeout: 8000 });
      const res = await p.evaluate(() => ({ txt: document.querySelector('#pl-box').innerText, lv: EchoGame.S.place.lv, track: EchoGame.S.settings.track, at: EchoGame.S.place.at, plv: EchoGame.lv.level() }));
      check(res.lv === 1 && res.plv === 1 && res.track === 'level' && /检测题还在做|level check for/i.test(res.txt), '不测：按「学过多少」定在第 1 级，结果页写明检测题在做', res);
      await shot(p, L + '-result');
      await pick('[data-act=plFinish]');
      await p.waitForSelector('[data-act=introGo]');
      const intro = await p.evaluate(() => document.querySelector('#sheet').innerText);
      check(!/沪教版|Hujiao|用英语念咒语|in English to attack/.test(intro) && new RegExp(L === 'zh' ? 'Chinese' : NAME).test(intro), '游戏说明说的是' + NAME + '，没有课本、没有「用英语念咒语」', intro.slice(0, 200));
      await pick('[data-act=introGo]');
      // ---------- 3 首页 ----------
      await p.evaluate(() => { EchoGame.S.homeTab = 'quiz'; EchoGame.goHome('quiz'); });
      await W(p, 300);
      const home = await p.evaluate(() => ({ head: (document.querySelector('.book-head') || {}).innerText || '', foot: document.querySelector('#home .foot').textContent, tabs: document.querySelector('#tabs').innerText }));
      check(!/沪教版|Hujiao|按日期猜|guessed/.test(home.head) && /课程单元|Course units/.test(home.head), '闯关页：「课程单元」，没有「适用于沪教版词汇」「按日期猜的」', home.head.slice(0, 160));
      check(!/英语|English/.test(home.foot), '页脚说的是这门语言', home.foot);
      await p.evaluate(() => EchoGame.T.settings());
      const ruby = await p.evaluate(() => !!document.querySelector('#set-ruby'));
      check(ruby === (L !== 'es'), (L === 'es' ? '西语没有「读音」设置' : '设置里有「读音：显示 / 不显示」'), ruby);
      await p.evaluate(() => EchoGame.closeModal());
      await shot(p, L + '-home');

      // ---------- 4 每种题型 ----------
      await fakeSR(p);
      const NB = c.WORLDS.length, w0 = c.WORLDS[0];
      // 日语：挑一个有汉字的词（标得出读音）
      const wi = L === 'ja' ? Math.max(0, w0.words.findIndex(x => /[一-鿿]/.test(x[0]))) : 0;
      const si = L === 'ja' ? Math.max(0, w0.sents.findIndex(x => /[一-鿿]/.test(x[0]))) : 0;
      // 听音选义故意答错：用另一个词（后面几题答对了同一个词，今天到期的复习就被冒险里答对的算掉了）
      const wj = (wi + 2) % w0.words.length;
      // 说出回答：挑一段找得到「半对」例子的对话（第一座岛没有就用第一个单元）
      let dw = 0, di = w0.dlgs.findIndex(d => halfOf(L, d[1]));
      if (di < 0) { dw = NB; di = c.BOOKS.list[0].units[0].dlgs.findIndex(d => halfOf(L, d[1])); }
      const qs = [['lw', 0, wj], ['ls', 0, wi], ['sp', 0, wi], ['sr_w', 0, wi], ['lm', 0, si], ['lo', 0, si], ['lr', 0, 0], ['sr_d', dw, Math.max(0, di)], ['sr_s', 0, si], ['bt', NB, 0]];
      await p.evaluate(list => EchoGame.playQs(list), qs);
      await W(p, 500);
      const cur = () => p.evaluate(() => { const q = EchoGame.P().q; return { type: q.type, target: q.target || null, en: q.en, prompt: q.prompt || null, opts: (q.opts || []).map(o => ({ t: o.t, c: !!o.c })), tokens: q.tokens || null }; });
      const html = () => p.evaluate(() => document.querySelector('#p-body').innerHTML);
      const text = () => p.evaluate(() => document.querySelector('#p-body').innerText);
      const hasRuby = async () => (await html()).includes('<ruby>');
      // lw 听音选义：选项是意思（中文界面是中文，英语界面是英文）
      let q = await cur();
      const w = w0.words[wi], wW = w0.words[wj], mean = L === 'zh' ? wW[wW.length - 1].en : wW[1];
      check(q.type === 'lw' && q.opts.some(o => o.c && o.t === mean), '听音选义：选项是意思（' + mean + '）', q);
      const plays = await p.evaluate(() => window.__plays.map(x => x.src));
      check(plays.some(s => s.startsWith('blob:')), '题目的读音放的是课程包里的配音（blob:）', plays);
      // 答错一题：进复习
      const wrongI = q.opts.findIndex(o => !o.c);
      await p.click('#p-body .opt[data-i="' + wrongI + '"]'); await W(p, 300);
      check(await fbOk(p) === 'bad', '听音选义：选错了算错');
      await next(p);
      // ls 听音选词：选项是这门语言的原文；日语 / 中文标读音
      q = await cur();
      check(q.type === 'ls' && q.opts.some(o => o.c && o.t === w[0]), '听音选词：选项是' + NAME + '原文', q);
      check((await hasRuby()) === (L !== 'es'), (L === 'es' ? '西语的选项不标读音' : '选项标了读音（<ruby>）'));
      await p.click('#p-body .opt[data-i="' + q.opts.findIndex(o => o.c) + '"]'); await W(p, 250);
      check(await fbOk(p) === 'ok', '听音选词：选对了');
      await next(p);
      // sp 看图说：提示遮住了、不露答案
      q = await cur();
      const spTxt = await p.evaluate(() => document.querySelector('#st').textContent);
      check(q.type === 'sp' && !spTxt.includes(w[0]) && spTxt.length > 0, '看图说：遮起来的提示不露答案（' + spTxt + '）', spTxt);
      await say(p, w[0]); await mic(p);
      check(await fbOk(p) === 'ok', '看图说：念对了过关');
      await next(p);
      // sr_w 跟读：逐块标色，日语 / 中文有读音
      q = await cur();
      check(q.type === 'sr_w' && (await hasRuby()) === (L !== 'es'), '跟读单词：' + (L === 'es' ? '没有读音' : '原文标了读音'));
      await say(p, w[0]); await mic(p);
      const sw = await p.evaluate(() => +(document.querySelector('#score b') || {}).textContent);
      check(await fbOk(p) === 'ok' && sw === nodeScore(L, w[0], w[0]).score, '跟读单词：' + sw + ' 分（Node 里同一个条目也是 ' + nodeScore(L, w[0], w[0]).score + '）');
      await next(p);
      // lm 听句选意
      q = await cur();
      check(q.type === 'lm' && q.opts.length === 4, '听句选意：4 个选项', q);
      await p.click('#p-body .opt[data-i="' + q.opts.findIndex(o => o.c) + '"]'); await W(p, 250);
      check(await fbOk(p) === 'ok', '听句选意：选对了');
      await next(p);
      // lo 排句子：块是 LANG.tiles（日语、中文按 seg）
      q = await cur();
      const tiles = NODE[L].mod.tiles(q.en, NODE[L].byT.get(q.en));
      check(q.type === 'lo' && JSON.stringify(q.tokens) === JSON.stringify(tiles), '排句子：块是 ' + JSON.stringify(tiles), q.tokens);
      for (let k = 0; k < q.tokens.length; k++) { const order = await p.evaluate(() => EchoGame.P().q.bank); const want = order.findIndex(i => i === k); await p.click('#lo-bank .tile[data-i="' + k + '"]'); void want; }
      await p.click('#lo-check'); await W(p, 250);
      check(await fbOk(p) === 'ok', '排句子：按顺序点对了');
      await next(p);
      // lr 听问选答
      q = await cur();
      check(q.type === 'lr' && q.opts.some(o => o.c && o.t === w0.dlgs[0][1]), '听问选答：选项是课程里的回答', q);
      // 意思（2026-11-24 老板：「是不是写一下翻译比较好，我是纯初学者」）：答之前藏着、有「看意思」可以点；答完问句和每个选项下面都亮出来，下面那一条里也有
      const lrMean = () => p.evaluate(() => {
        const vis = e => !!e && !e.hidden && e.getClientRects().length > 0, P = EchoGame.P(), mOf = t => { const e = EchoGame.entryOf(t); return e ? [e.zh || '', e.en || ''] : ['', '']; };
        return { qm: vis(document.querySelector('#p-body .q-m')), qmT: (document.querySelector('#p-body .q-m') || {}).textContent || '', om: [...document.querySelectorAll('#p-body .opt .o-m')].map(e => (vis(e) ? e.textContent : '')),
          btn: !!document.querySelector('#p-body [data-act=revealMean]'), fb: (document.querySelector('#fb-d .fb-mean') || {}).textContent || '', want: { q: mOf(P.q.prompt), a: mOf(P.q.en), opts: P.q.opts.map(o => mOf(o.t)) } };
      });
      const lr0 = await lrMean();
      check(lr0.btn && !lr0.qm && lr0.om.length === q.opts.length && lr0.om.every(t => !t), '听问选答：答之前不显示意思，有「看意思」可以点', lr0);
      // 横着拿手机答这一题（老板的截图就是横屏）：答完选对的那一项多了一行意思，不能被下面那一条盖住
      const vpLr = p.viewportSize(); await p.setViewportSize({ width: 844, height: 390 }); await W(p, 400);
      await p.click('#p-body .opt[data-i="' + q.opts.findIndex(o => o.c) + '"]'); await W(p, 900);
      check(await fbOk(p) === 'ok', '听问选答：选对了');
      const land = await p.evaluate(() => { const b = document.querySelector('#fb-btn').getBoundingClientRect(), r = document.querySelector('#p-body .opt.right').getBoundingClientRect(), f = document.getElementById('fb').getBoundingClientRect(), top = (document.querySelector('#play .p-top') || document.body).getBoundingClientRect(); return { ok: b.bottom <= innerHeight + 1 && r.top >= top.bottom - 2 && r.bottom <= f.top + 2, rTop: Math.round(r.top), rBot: Math.round(r.bottom), fbTop: Math.round(f.top), head: Math.round(top.bottom) }; });
      check(land.ok, '听问选答（横屏）：答完，选对的那一项（带着意思）没被下面那一条盖住，「继续」在屏幕里', land);
      await shot(p, L + '-lr-mean-land');
      await p.setViewportSize(vpLr); await W(p, 400);
      const lr1 = await lrMean();
      check(lr1.qm && lr1.want.q.includes(lr1.qmT) && !!lr1.qmT && lr1.om.every((t, k) => !!t && lr1.want.opts[k].includes(t)) && lr1.want.q.some(m => m && lr1.fb.includes(m)) && lr1.want.a.some(m => m && lr1.fb.includes(m)),
        '听问选答：答完，问句下面、每个选项下面、下面那一条里都有界面语言的意思（' + lr1.qmT + ' → ' + lr1.fb + '）', lr1);
      await shot(p, L + '-lr-mean');
      await next(p);
      // sr_d 说出回答：错（另一句）、半对、对——分数和 Node 里一样
      q = await cur();
      const T = q.target, other = (dw ? c.BOOKS.list[0].units[0] : w0).dlgs.map(d => d[1]).find(x => x !== T), half = halfOf(L, T);
      await say(p, other); await mic(p);
      const sWrong = await p.evaluate(() => +(document.querySelector('#score b') || {}).textContent);
      check(sWrong === nodeScore(L, T, other).score && sWrong < 60 && !(await fbOk(p)), '说出回答：说成另一句 → ' + sWrong + ' 分，不过关（Node：' + nodeScore(L, T, other).score + '）');
      if (half) {
        await say(p, half); await mic(p);
        const sHalf = await p.evaluate(() => +(document.querySelector('#score b') || {}).textContent);
        check(sHalf === nodeScore(L, T, half).score && sHalf >= 60 && sHalf < 85 && (await fbOk(p)) === 'ok', '说出回答：半对（' + half + '）→ ' + sHalf + ' 分，过关、不是 Perfect（Node：' + nodeScore(L, T, half).score + '）');
        await next(p);
      } else { check(false, '说出回答：找不到半对的例子（' + T + '）'); await say(p, T); await mic(p); await next(p); }
      // sr_s 跟读句子：全对
      q = await cur();
      await say(p, q.target); await mic(p);
      const sOk = await p.evaluate(() => ({ s: +(document.querySelector('#score b') || {}).textContent, ok: [...document.querySelectorAll('#st .w')].every(x => x.classList.contains('ok')), n: document.querySelectorAll('#st .w').length }));
      check(q.type === 'sr_s' && sOk.s === 100 && sOk.ok && sOk.n === NODE[L].mod.pieces(q.target, NODE[L].byT.get(q.target)).length && (await fbOk(p)) === 'ok', '跟读句子：全对 100 分，每块都标绿（' + sOk.n + ' 块）', sOk);
      check((await hasRuby()) === (L !== 'es'), (L === 'es' ? '西语句子没有读音' : '句子按词块标了读音'));
      await next(p);
      // bt Boss：说出正确的回答
      q = await cur();
      check(q.type === 'bt' && q.opts.length === 3, 'Boss：3 个回答', q);
      await say(p, q.opts.find(o => o.c).t); await mic(p);
      await W(p, 400);
      check(await fbOk(p) === 'ok', 'Boss：说对了攻击');
      const asr = await p.evaluate(() => window.__asr);
      check(asr.length >= 5 && asr.every(a => a.lang && a.lang.cloud === L && a.lang.apple === NODE[L].mod.asr.apple && a.head === 'function' && a.count === 'function'), '识别用的是' + NAME + '（云端 ' + L + '、本机 ' + NODE[L].mod.asr.apple + '），数词交给 LANG', asr.slice(0, 2));
      await shot(p, L + '-practice');
      await p.evaluate(() => EchoGame.goHome('quiz'));
      // ---------- 5 每日复习 ----------
      const due = await p.evaluate(() => EchoGame.dueList().map(([k]) => k));
      check(due.includes('word:0:' + wj), '答错的题进了每日复习（word:0:' + wj + '）', due);
      await p.evaluate(() => document.querySelector('[data-act=review]') && document.querySelector('[data-act=review]').click());
      await W(p, 300);
      await p.click('#sheet [data-act=startReview]'); await W(p, 500);
      const rv = await p.evaluate(() => { const P = EchoGame.P(); return P ? { review: P.review, type: P.q.type, en: P.q.en, body: document.querySelector('#p-body').innerText } : null; });
      check(rv && rv.review && rv.en === wW[0], '每日复习：出的是这门语言的那道题（' + wW[0] + '）', rv);
      await p.evaluate(() => EchoGame.goHome('quiz'));
      // ---------- 6 大地图 ----------
      await p.evaluate(() => { const S = EchoGame.S; Object.assign(S.settings, { gfx: '2d', mode: 'self' }); S.homeTab = 'mon'; S.world.started = true; S.world.flags = Object.assign(S.world.flags || {}, { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }); S.world.map = 't0'; S.world.x = -1; S.world.y = -1; S.mon.box = [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }]; S.mon.team = ['u0']; S.mon.balls = 10; EchoGame.flush(); });
      await p.evaluate(() => { localStorage.setItem('echo-island-v1@' + EchoPacks.course(), JSON.stringify(EchoGame.S)); });
      await p.reload(); await homeUp(p);
      await p.click('[data-act=wEnter]'); await W(p, 1200);
      await fakeSR(p);
      // 写死的英语说话任务 → 这座岛课程里的一句
      await p.evaluate(() => EchoWorld._debug().talk([{ who: 'Prof', emo: '🧑‍🔬', en: 'Hello there!', zh: '你好呀！' }, { who: 'Prof', emo: '🧑‍🔬', en: 'Now, can you say this to me?', zh: '现在，你能对我说这句话吗？', kind: 'speak', target: 'Nice to meet you, Professor!' }]));
      await W(p, 300);
      const pg1 = await p.evaluate(() => { const d = EchoWorld._debug().dlg, pg = d.pages[d.i]; return { en: pg.en, ui: pg.ui, plain: pg.plain, hear: !!document.querySelector('#w-dlg .d-hear'), txt: document.querySelector('#w-dlg').innerText }; });
      check(pg1.plain && pg1.en === (L === 'zh' ? 'Hello there!' : '你好呀！') && !pg1.hear, '只给人看的台词：正文是界面语言那份（' + pg1.en + '），没有 🔊、没有「译」', pg1);
      await p.waitForFunction(() => { const d = EchoWorld._debug().dlg; return d && !d.typing; });   // 台词一个字一个字打完了再按 A
      await p.evaluate(() => document.querySelector('#world [data-act=wA].ba').click()); await W(p, 300);
      const pg2 = await p.evaluate(() => { const d = EchoWorld._debug().dlg, pg = d.pages[d.i]; return { kind: pg.kind, target: pg.target, q: pg.q, mean: pg.mean, txt: document.querySelector('#w-dlg').innerText, ruby: document.querySelector('#w-say').innerHTML.includes('<ruby>') }; });
      const sents0 = w0.sents.map(s => s[0]);
      check(pg2.kind === 'speak' && sents0.includes(pg2.target) && pg2.q && pg2.q.kind === 'sent' && pg2.q.w === 0 && !!pg2.mean && pg2.txt.includes(pg2.mean), '大地图的说话任务：换成了这座岛课程里的一句（' + pg2.target + '），题面有意思', pg2);
      check(!/Nice to meet you/.test(pg2.txt), '说话任务里没有英语原句', pg2.txt);
      check(pg2.ruby === (L !== 'es'), '说话任务的句子' + (L === 'es' ? '不标读音' : '标了读音'));
      await shot(p, L + '-world-speak');
      await p.evaluate(() => EchoWorld._debug().talk([{ who: 'Prof', emo: '🧑‍🔬', en: 'Nice to meet you, Professor!', zh: '对博士说：很高兴认识你！', kind: 'speak', target: 'Nice to meet you, Professor!' }]));
      const again = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return d.pages[d.i].target; });
      check(again === pg2.target, '同一句英语原文每次换成同一句（按哈希固定挑）', [again, pg2.target]);
      await p.evaluate(() => { EchoGame.S.settings.mode = 'auto'; });
      await p.evaluate(() => EchoWorld._debug().talk([{ who: 'Prof', emo: '🧑‍🔬', en: 'Now, can you say this to me?', zh: '现在，你能对我说这句话吗？', kind: 'speak', target: 'Nice to meet you, Professor!' }]));
      await W(p, 200);
      const tgt = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return d.pages[d.i].target; });
      await say(p, tgt); await p.click('#w-mic'); await W(p, 1200);
      const done = await p.evaluate(() => !EchoWorld._debug().dlg);
      check(done, '大地图的说话任务：念对了这句' + NAME + '就过了');
      // 选回答的页：写死的英语选项 → 课程里的一段对话
      await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; EchoWorld._debug().talk([{ who: 'Kid', emo: '🧒', en: 'Do you like apples?', zh: '你喜欢苹果吗？', kind: 'answer', opts: [{ c: true, t: 'Yes, I do.' }, { t: 'No, it is a pen.' }, { t: 'I am twelve.' }] }]); });
      await W(p, 300);
      const pg3 = await p.evaluate(() => { const d = EchoWorld._debug().dlg, pg = d.pages[d.i]; return { en: pg.en, opts: pg.opts.map(o => o.t), q: pg.q, txt: document.querySelector('#w-dlg').innerText }; });
      const dl = w0.dlgs.map(d => d[0]);
      check(dl.includes(pg3.en) && pg3.q && pg3.q.kind === 'dlg' && pg3.opts.length === 3 && !/apples|Yes, I do/.test(pg3.txt), '选回答的页：换成了课程里的一段对话（' + pg3.en + '）', pg3);
      await p.evaluate(() => { const d = EchoWorld._debug().dlg; const i = d.pages[d.i].opts.findIndex(o => o.c); document.querySelector('#w-dlg .opt[data-i="' + i + '"]').click(); });
      await W(p, 300);
      if (await p.$('#w-dlg [data-act=wSelfDone]')) { await p.click('#w-dlg [data-act=wSelfDone]'); await W(p, 300); }
      // 对战一回合
      await p.evaluate(() => { while (EchoWorld._debug().dlg) document.querySelector('#world [data-act=wA].ba').click(); });
      // 第 1 级有三成招式换成「听一听、点出来」（levels.js 的 kinds）：这一回合要测开口念，先调到第 2 级
      await p.evaluate(() => { EchoGame.S.place.lv = 2; EchoGame.S.settings.mode = 'auto'; EchoWorld._debug().battle('wild', { lvBonus: 12 }); });
      // 对手可能先出手：先把它的听力题点掉，等到自己的回合
      for (let k = 0; k < 80 && !(await p.$('#b-panel [data-act=bMove]')); k++) { const d = await p.$('#b-panel [data-act=bDef]'); if (d) await d.click().catch(() => {}); await W(p, 400); }
      await fakeSR(p);
      await p.evaluate(() => { EchoGame.S.settings.mode = 'auto'; });
      // 单词招式（第一个，tier 0）
      await p.click('#b-panel [data-act=bMove][data-i="0"]'); await W(p, 300);
      const bt = await p.evaluate(() => ({ mask: (document.querySelector('#b-say') || {}).textContent || '', zh: [...document.querySelectorAll('#b-panel .say-zh')].map(e => e.textContent), head: (document.querySelector('#b-panel .task-h') || {}).innerText || '' }));
      const task = await p.evaluate(() => { const t = MonsterGame._b().task; return { kind: t.kind, target: t.target, mean: t.mean }; });
      const hit = task.target, allWords = c.WORLDS.concat(c.BOOKS.list.flatMap(b => b.units)).flatMap(x => x.words.map(y => y[0]));
      check(task.kind === 'word' && allWords.includes(hit) && bt.mask === NODE[L].mod.cue(hit, 2, NODE[L].byT.get(hit)) && !bt.mask.includes(hit) && !/英语|English/.test(bt.head),
        '对战念咒语：课程里的词（' + hit + '），遮起来的提示是 lang-*.js 的样子（' + bt.mask + '），说明里没有「英语」', { bt, task });
      check(!!task.mean && bt.zh.includes(task.mean), '对战念咒语：下面有它的意思（' + task.mean + '）', bt.zh);
      await say(p, hit || ''); await p.click('#b-mic');
      // 对手出招：听咒语选意思（它的咒语是这门课的词 / 句子，选项是意思）
      for (let k = 0; k < 60 && !(await p.$('#b-panel [data-act=bDef]')); k++) await W(p, 300);
      const def = await p.evaluate(() => { const d = MonsterGame._b() && MonsterGame._b().def; return { opts: [...document.querySelectorAll('#b-panel [data-act=bDef] .o-t')].map(b => b.innerText.trim()), spell: d && d.spell, ans: d && d.ans }; });
      const allText = new Set(c.WORLDS.concat(c.BOOKS.list.flatMap(b => b.units)).flatMap(x => x.words.map(y => y[0]).concat(x.sents.map(y => y[0]))));
      // 选项是意思：中文界面（es / ja）是中文，英语界面（学中文）是英文
      const okOpt = o => (L === 'zh' ? /^[\x20-\x7e’]+$/.test(o) : CJK.test(o));
      check(def.opts.length >= 2 && allText.has(def.spell) && def.opts.every(okOpt), '对战一回合：念对了出招；对手念的咒语是这门课的（' + def.spell + '），选项是意思', def);
      await shot(p, L + '-battle');
      await p.evaluate(() => { const b = document.querySelector('#b-panel [data-act=bDef]'); if (b) b.click(); });
      await W(p, 1500);
      // ---------- 7 换回英语 ----------
      await p.evaluate(() => { if (window.MonsterGame && MonsterGame.stop) MonsterGame.stop(); EchoGame.goHome(); });
      await W(p, 300);
      const langSave = await p.evaluate(l => localStorage.getItem('echo-island-v1@' + l), L);
      await p.evaluate(() => EchoGame.T.settings());
      await p.click('[data-act=pkSet]');
      await p.waitForSelector('#pk-sheet [data-act=pkLearn][data-l="en"]');
      await p.click('#pk-sheet [data-act=pkLearn][data-l="en"]');
      await p.waitForSelector('[data-act=pkLearnGo]');
      await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.click('[data-act=pkLearnGo]')]);
      await homeUp(p);
      const back = await p.evaluate(() => ({ at: window.__enAtLoad, course: EchoPacks.course(), w0: WORLDS[0].words[0][0], c: EchoGame.S.course, coins: EchoGame.S.coins, foot: document.querySelector('#home .foot').textContent }));
      check(same(enLeft, back.at), '换回英语：英语存档（连备份、位置）和换走的时候一个字没变');
      check(back.course === 'en' && back.w0 === 'hello' && back.c === undefined && back.coins === 500, '换回英语：英语的内容、英语的存档（没有 course）', back);
      const ls2 = await p.evaluate(l => localStorage.getItem('echo-island-v1@' + l), L);
      check(!!langSave && JSON.parse(ls2).course === L, NAME + '的存档还在，等下次换回来');
      await ctx.close();
    }

    // ================= B 这门课的内容读不出来 =================
    if (want('B')) {
      console.log('— B 这门课的内容读不出来');
      const L = LANGS[0] || 'es';
      const ctx = await newCtx();
      await ctx.addInitScript(l => { if (!sessionStorage.getItem('b-once')) { sessionStorage.setItem('b-once', '1'); localStorage.setItem('echo-course', l); localStorage.setItem('echo-packs-url', '/packs'); } }, L);
      const p = await openPage(ctx, '');
      await p.waitForSelector('#pk-miss', { timeout: 25000 });
      const m = await p.evaluate(l => ({ home: document.getElementById('home').hidden, txt: document.querySelector('#pk-miss').innerText, key: localStorage.getItem('echo-island-v1@' + l), pre: !!(window.EchoGame && EchoGame.S && EchoGame.S.coins === 50) }), L);
      check(m.home && /下载|Download/.test(m.txt) && m.key === null, '课程内容读不出来：停在「下载课程」那一页，首页藏着，这门课的存档没写', m);
      await shot(p, 'missing');
      await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.click('[data-act=pkMissGet]')]);
      await p.waitForFunction(() => !!document.querySelector('#pl-box') || (window.EchoGame && EchoGame.S && !document.getElementById('home').hidden), null, { timeout: 25000 });
      const m2 = await p.evaluate(() => ({ course: EchoPacks.course(), w0: WORLDS[0].words[0][0], content: !!EchoPacks.content() }));
      check(m2.course === L && m2.w0 === C[L].WORLDS[0].words[0][0] && m2.content, '下载好重新打开：这门课的内容读出来了，能学了', m2);
      // 删掉这门课的包 → 读不出来 →「先学英语」
      await p.evaluate(l => EchoPacks.remove(l), L);
      await p.reload();
      await p.waitForSelector('#pk-miss', { timeout: 25000 });
      await Promise.all([p.waitForNavigation({ timeout: 20000 }), p.click('[data-act=pkMissEn]')]);
      await homeUp(p);
      const m3 = await p.evaluate(() => ({ course: EchoPacks.course(), w0: WORLDS[0].words[0][0], coins: EchoGame.S.coins }));
      check(m3.course === 'en' && m3.w0 === 'hello' && m3.coins === 500, '「先学英语」：回到英语课、英语存档', m3);
      await ctx.close();
    }

    // ================= D 云端模式：服务器的识别还写死英语（ENGINE.md §6）=================
    // 别的课在云端模式里、手机自带的识别用不了（这里是电脑上的浏览器）：口语题不去连服务器，按「AI 用不了」走——提示说清楚、出「先跳过」，跳过的进复习
    if (want('D')) {
      console.log('— D 云端模式里的口语题');
      const L = LANGS[0] || 'es', ctx = await newCtx();
      await ctx.addInitScript(() => { window.ECHO_CLOUD_URL = 'http://127.0.0.1:9'; });
      let p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await homeUp(p);
      await p.evaluate(l => EchoPacks.install(l), L);
      await p.evaluate(l => {
        const s = JSON.parse(localStorage.getItem('echo-island-v1'));
        Object.assign(s, { course: l, rev: undefined, stars: {}, place: { lang: l, lv: 1, auto: 1, know: 1, who: 'adult', at: '2026-11-20' } });
        s.settings.track = 'level'; s.settings.mode = 'auto';
        localStorage.setItem('echo-island-v1@' + l, JSON.stringify(s)); localStorage.setItem('echo-course', l);
      }, L);
      await p.reload(); await homeUp(p);
      await p.evaluate(() => EchoGame.playQs([['sr_w', 0, 0]]));
      await W(p, 400);
      const before = await p.evaluate(() => ({ cloud: EchoCloud.on, course: EchoPacks.course(), skip: !document.querySelector('#p-skip').hidden }));
      await p.click('#mic'); await W(p, 500);
      const d = await p.evaluate(() => ({ hint: document.querySelector('#mic-hint').textContent, skip: !document.querySelector('#p-skip').hidden, asr: (EchoGame.T.RT.aiFails || 0) }));
      check(before.cloud && before.course === L && before.skip && d.skip && /手机自带的识别|own speech recognition/.test(d.hint), '云端模式 + 本机识别用不了：口语题一开始就有「先跳过」，点话筒说清楚原因（不去连服务器的英语识别）', { before, d });
      await p.click('#p-skip'); await W(p, 300);
      const owe = await p.evaluate(() => { const e = EchoGame.S.rev.items['word:0:0']; return e && e.owe; });
      check(owe === 1, '先跳过的这题进了复习、欠着（联网 / 有本机识别以后要补说）', owe);
      await ctx.close();
    }

    // ================= C 老模式 =================
    if (want('C')) {
      console.log('— C 老模式（没有课程包地址）');
      const ctx = await newCtx();
      await ctx.addInitScript(() => { localStorage.setItem('echo-course', 'ja'); });
      const p = await openPage(ctx, '');
      await homeUp(p);
      const o = await p.evaluate(() => ({ on: EchoPacks.on, w0: WORLDS[0].words[0][0], keys: Object.keys(localStorage).filter(k => k.includes('@')), c: EchoGame.S.course }));
      check(!o.on && o.w0 === 'hello' && !o.keys.length && o.c === undefined, '老模式：localStorage 写着 ja 也照旧是英语（内容、存档）', o);
      await ctx.close();
    }
  } catch (e) {
    console.log('✗ 出错：' + (e && e.stack || e));
    fails++;
  }
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 临时文件夹 */ }
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
