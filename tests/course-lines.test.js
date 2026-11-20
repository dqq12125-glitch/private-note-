// 别的课的台词翻译表（tools/course/SPEC.md §8、ENGINE.md §5；Playwright Chromium，约 2 分钟）：node tests/course-lines.test.js [--only=es,ja,zh]
// 课程包：真的课程源文件 + tests/course-lines-fixture.js 的台词翻译小样，经 tools/course/build.js 出 course.json（LINES / LINES_T / TERMS）。
// 每门语言（es、ja 中文界面；zh 英语界面）：
//   1 开场：渡轮上的旁白没翻 → 界面语言、没有 🔊；「哪张照片是你」（选择页）、「写上名字」（输入页，提示说的是拉丁字母、不说「英文名」）、
//     「念通行证」（说话任务：要说的是翻好的那句，带名字，按这门语言打分，意思里没有英语原句）、「做好了」——显示、朗读的都是这门语言，
//     下面一行是界面语言的意思；日语 / 中文标读音；选照片时念的「I'm a boy.」念的是译文
//   2 选伙伴的贝壳：问的话是译文（属性名用翻好的词）；对伙伴说的那句是译文，念对了选好伙伴
//   3 大地图：一页对话（带名字、「译」照「剧情中文」的设置收起来）、告示牌（意思里的「英语」换成这门语言）、说话任务（念对过、念错不过，分数和 Node 里一样）、
//     回声技能的指令、拿到 / 捡到道具（模板 + 词；西语阴性；英语的 a / an）、没翻的台词照过渡办法
//   4 对战：喊话「Look out! Here comes …!」「…, your turn!」念的是译文（配音的 key 是译文的）
//   5 画面上的名字：对战名牌、招式按钮、手册、背包、房子的招牌（三种画法）
//   6 第三批：「📍 现在要做」（HUD、冒险菜单）引着的原句是译文、名字按这门课的写法，没译文的换成「键.q」的说法；
//     地名（HUD、横幅、首页「飞去哪」、乘风的菜单）是这门课的地名 + 界面语言的小字；3 里另有台词意思里的英语、对手名字
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const FX = require(path.join(__dirname, 'course-lines-fixture.js'));
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const EL = require(path.join(ROOT, 'lang.js'));
require(path.join(ROOT, 'lang-es.js')); require(path.join(ROOT, 'lang-ja.js')); require(path.join(ROOT, 'lang-zh.js'));
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const LANGS = ['es', 'ja', 'zh'].filter(l => !ONLY.length || ONLY.includes(l));
const REAL = process.argv.includes('--real');

// ---------- 课程包：course.json（带翻译表）+ 一个小配音包 ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-lines-web-'));
const VER = '20261120.1';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
const NAMES = { en: { zh: '英语', en: 'English', self: 'English' }, es: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, ja: { zh: '日语', en: 'Japanese', self: '日本語' }, zh: { zh: '中文', en: 'Chinese', self: '中文' } };
const C = {}, TAB = {};
function pack(lang, course) {
  const dir = path.join(TMP, lang, VER); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  if (course) { const b = Buffer.from(JSON.stringify(course)); fs.writeFileSync(path.join(dir, 'course.json'), b); files.push({ name: 'course.json', kind: 'course', bytes: b.length, crc: PK.crcHex(new Uint8Array(b)) }); }
  const v = PK.packBundle([{ g: 'f', k: key('Hello!'), data: new Uint8Array(OGG) }]);
  fs.writeFileSync(path.join(dir, 'voice-000.bin'), v);
  files.push({ name: 'voice-000.bin', kind: 'voice', core: true, bytes: v.length, crc: PK.crcHex(v), n: 1 });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ fmt: 1, lang, ver: VER, voice: { fmt: 'ogg-opus', f: 'x', m: 'y', n: { f: 1, m: 0 } }, files }));
  return files.reduce((s, f) => s + f.bytes, 0);
}
const CAT = { fmt: 1, packs: {} };
{ const b = pack('en'); CAT.packs.en = { ver: VER, name: NAMES.en, bytes: b, core: b, course: false }; }
for (const l of ['es', 'ja', 'zh']) {
  // --real：用正式的翻译（tools/course/<语言>/lines.json）走一遍同样的画面；平时用小样（结果固定，正式翻译改了也不影响）
  C[l] = CB.build(l, { check: true, lines: REAL ? undefined : FX.write(l, TMP) }).course;
  TAB[l] = PK.lineTable(C[l]);
  const b = pack(l, C[l]);
  CAT.packs[l] = { ver: VER, name: NAMES[l], bytes: b, core: b, course: true };
}
const DEXN = (() => { const c = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'dex.js'), 'utf8'), c); return c.window.DEX; })();
const MONS = DEXN.all.map(s => s.en);
// Node 里同一句翻译的样子 / 分数（和游戏里同一个 lineFind、同一套 lang-*.js）
const tr = (l, en) => PK.lineFind(TAB[l], en, { isMon: v => MONS.includes(v) });
const T = (l, en, name) => { const x = tr(l, en); return x ? x.t.split('{name}').join(name || 'Coco') : null; };
// 画面上的名字（SPEC §8.1）：没翻的是英文；r 是读音
const TM = (l, c, en) => { const m = C[l].TERMS && C[l].TERMS[c], v = m && m[en]; return v == null ? { t: en, r: null } : typeof v === 'string' ? { t: v, r: null } : { t: v.t, r: v.r || null }; };
const nodeScore = (l, t, heard, x) => EL.get(l).score(t, heard, { entry: x ? Object.assign({ t }, x) : null, lex: null });

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const server = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  if (u === '/__blank') return send(200, '<!doctype html><title>blank</title>', MIME.html);   // 改存档用的空白页（同一个网站）
  if (u.startsWith('/packs/')) {
    const r = u.slice(7);
    if (r === 'catalog.json') return send(200, JSON.stringify(CAT), MIME.json);
    const file = path.join(TMP, r);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});

// 英语的存档（课程包模式里先有它）；别的课的存档：同样的设置，不进能力检测，冒险还没开始
const SAVE = () => ({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120,
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh' },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
});
const LSAVE = (l, o) => Object.assign({
  seenIntro: true, coins: 50, micCheck: 'x', course: l,
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: l === 'zh' ? 'en' : 'zh', track: 'level' },
  place: { lang: l, lv: 1, auto: 1, know: 1, who: 'adult', at: '2026-11-20' },
}, o);
const CJK = /[぀-ヿ㐀-鿿]/;

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://echo.localhost:' + server.address().port;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errs = [];
  const W = (p, ms) => p.waitForTimeout(ms);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'lines-' + name + '.png') });
  // 每次朗读都会先问课程包有没有这一句的配音（EchoPacks.hasClip(key)）：记下 key 就知道念的是哪句
  const spy = p => p.evaluate(() => { window.__keys = []; const h = EchoPacks.hasClip; EchoPacks.hasClip = (k, g) => { window.__keys.push(k); return h(k, g); }; });
  const keys = p => p.evaluate(() => window.__keys.slice());
  // 假的识别：每次从 __heard 里拿一句
  const fakeSR = p => p.evaluate(() => {
    window.__heard = [];
    EchoTalk.cloudSR = () => true;
    EchoTalk.listenOnce = async o => { const t = window.__heard.length ? window.__heard.shift() : ''; if (o.onState) o.onState(t); return { text: t, err: t ? null : 'no-speech', how: 'done' }; };
    EchoGame.S.settings.mode = 'auto';
  });
  const heard = (p, t) => p.evaluate(t => { window.__heard.push(t); }, t);
  const typed = async p => { for (let i = 0; i < 60; i++) { if (!(await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }))) return; await W(p, 80); } };
  const A = async p => { await typed(p); await p.evaluate(() => document.querySelector('#world [data-act=wA].ba').click()); await W(p, 260); };
  const until = async (p, sel, max = 25) => { for (let i = 0; i < max; i++) { if (await p.$(sel)) return true; await A(p); } return !!(await p.$(sel)); };
  // 现在这一页：正文、下面那行、🔊、读音、「译」按钮
  const dlgNow = p => p.evaluate(() => {
    const box = document.querySelector('#w-dlg'), en = box.querySelector('.d-en'), zh = box.querySelector('#d-zh'), d = EchoWorld._debug().dlg, pg = d && d.pages[d.i];
    return { en: en ? en.innerText.trim() : '', enHtml: en ? en.innerHTML : '', zh: zh ? zh.innerText.trim() : '', zhBtn: !!(zh && zh.tagName === 'BUTTON'), hear: !!box.querySelector('.d-hear'),
      say: (box.querySelector('#w-say') || {}).innerText || '', sayHtml: (box.querySelector('#w-say') || {}).innerHTML || '', mean: (box.querySelector('.say-zh') || {}).innerText || '',
      target: pg && pg.target, kind: pg && pg.kind, txt: box.innerText, name: (box.querySelector('.d-name') || {}).innerHTML || '' };
  });
  // 换一下存档再打开：先离开游戏的页面（它离开时会存一次），在同一个网站的空白页里改好存档（obj 的每一项浅合并进去），再打开游戏
  const relaunch = async (p, l, obj) => {
    const s = await p.evaluate(() => JSON.stringify(EchoGame.S));
    await p.goto(p.url().split('/index.html')[0] + '/__blank');
    await p.evaluate(([l, s, obj]) => { const o = JSON.parse(s); for (const k of Object.keys(obj)) o[k] = Object.assign(o[k] || {}, obj[k]); for (const k of Object.keys(localStorage)) if (k.startsWith('echo-island-v1@' + l + '-')) localStorage.removeItem(k); localStorage.setItem('echo-island-v1@' + l, JSON.stringify(o)); }, [l, s, obj]);
    await p.goto(p.url().replace('/__blank', '/index.html?packs=' + encodeURIComponent('/packs')));
    await homeUp(p);
  };
  // 去掉意思那几行（英语界面的意思就是英语原文）以后，页面上还有没有英语原句
  const enLeft = (d, re) => re.test(d.txt.split(d.zh).join('').split(d.mean || '\u0000').join(''));
  // 这句标不标读音：日语 / 中文、句子里有汉字（全是假名的日语不标）
  const rk = t => !!t && (CJK.test(t) && /[一-鿿]/.test(t));
  const noRt = s => s.replace(/<rt>[^<]*<\/rt>/g, '').replace(/<[^>]+>/g, '');

  try {
    for (const L of LANGS) {
      console.log('— ' + L + '（' + NAMES[L].zh + '，' + (L === 'zh' ? '英语界面' : '中文界面') + '）');
      const zhUi = L !== 'zh', rubyL = L !== 'es', NAME = zhUi ? NAMES[L].zh : NAMES[L].en;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(SAVE()));
      await ctx.addInitScript(() => { window.__fill = new Set(); const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { try { if (window.__fill.size < 8000) window.__fill.add(String(t)); } catch (e) { /* 记不下就算了 */ } return f.call(this, t, ...a); }; });
      const p = await ctx.newPage();
      p.setDefaultTimeout(9000);
      p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
      await p.goto(BASE + '/index.html?packs=' + encodeURIComponent('/packs'));
      await homeUp(p);
      await p.evaluate(l => EchoPacks.install(l), L);
      // 这门课的新存档：冒险还没开始（开场从渡轮开始）
      await p.evaluate(([l, s]) => { localStorage.setItem('echo-island-v1@' + l, s); localStorage.setItem('echo-course', l); }, [L, JSON.stringify(LSAVE(L))]);
      await p.reload(); await homeUp(p);
      const st = await p.evaluate(() => ({ course: EchoPacks.course(), lines: !!(EchoPacks.content() || {}).LINES }));
      check(st.course === L && st.lines, '这门课的 course.json 带着台词翻译表', st);
      await spy(p);

      // ---------- 1 开场 ----------
      await p.click('.new-game [data-act=wEnter]');
      await W(p, 900);
      await typed(p);
      let d = await dlgNow(p);
      const tFerry = T(L, 'A little ferry is sailing to Hello Island.');
      if (tFerry) check(d.hear && noRt(d.enHtml) === tFerry, '渡轮上的旁白（正式翻译里翻了）：正文是译文，有 🔊', d);
      else check(!d.hear && (zhUi ? d.en === '一艘小渡轮正开往你好岛。' : d.en === 'A little ferry is sailing to Hello Island.'), '没翻的旁白：界面语言那份，没有 🔊（过渡办法）', d);
      check(await until(p, '#w-dlg [data-act=wPick]'), '选照片那一页');
      d = await dlgNow(p);
      const tPhoto = T(L, 'Which photo is you?');
      check(noRt(d.enHtml) === tPhoto && d.hear && d.enHtml.includes('<ruby>') === rk(tPhoto) && d.zh === (zhUi ? '通行证上贴哪张照片？选一张像你的。' : 'Which photo is you?'),
        '「哪张照片是你」：正文是译文（' + tPhoto + '）' + (rubyL ? '，标了读音' : '') + '，有 🔊，下面是' + (zhUi ? '中文意思' : '英语原文'), d);
      const cards = await p.evaluate(() => [...document.querySelectorAll('#w-dlg .ch-card small')].map(e => e.textContent));
      check(!cards.length, '照片下面没有英文小字（Boy / Girl）', cards);
      check((await keys(p)).includes(key(tPhoto)), '这一页念的是译文（配音 key 是译文的）');
      await shot(p, L + '-photo');
      await p.click('#w-dlg [data-act=wPick][data-i="0"]');
      await W(p, 400);
      check((await keys(p)).includes(key(T(L, "I'm a boy."))), '选了男孩：念的「I\'m a boy.」是译文（' + T(L, "I'm a boy.") + '）');
      check(await until(p, '#w-dlg .nm'), '写名字那一页');
      d = await dlgNow(p);
      const ph = await p.evaluate(() => ({ ph: document.querySelector('#nm-in').placeholder, tip: document.querySelector('#nm-tip').textContent }));
      check(noRt(d.enHtml) === T(L, 'Now write your English name on it.') && !/英文名|English name/.test(d.zh) && (zhUi ? /拉丁字母/.test(ph.ph + ph.tip) : /Latin letters/.test(ph.ph + ph.tip)) && !/英文名|English name|English letters/.test(ph.ph + ph.tip),
        '写名字：正文是译文，意思和输入框都不说「英文名」，写明名字暂时用拉丁字母', { d, ph });
      await shot(p, L + '-name');
      await fakeSR(p);
      await p.fill('#nm-in', 'coco');
      await p.click('#nm-ok');
      await W(p, 300);
      check(await until(p, '#w-dlg #w-mic'), '念通行证（说话任务）');
      d = await dlgNow(p);
      const tPass = T(L, 'My name is {name}.'), xPass = tr(L, 'My name is {name}.');
      const xP = xPass.seg ? { seg: xPass.seg.map(s => s.split('{name}').join('Coco')), r: xPass.r.map(s => s.split('{name}').join('Coco')) } : null;
      check(d.target === tPass && noRt(d.sayHtml).replace(/\s+/g, '') === tPass.replace(/\s+/g, '') && d.sayHtml.includes('<ruby>') === (rubyL && /[一-鿿]/.test(tPass)) && noRt(d.enHtml) === T(L, 'Read your pass out loud: "My name is {name}."') &&
        !enLeft(d, /My name is/), '念通行证：要说的是译文（' + tPass + '），台词那一行也是译文，页面上没有英语原句', d);
      check(zhUi ? d.zh === '把通行证大声念出来：' + tPass : d.zh === 'Read your pass out loud: "My name is Coco."', '下面那行意思：' + (zhUi ? '中文（里面的英语原句换成了译文）' : '英语原文'), d.zh);
      await heard(p, tPass); await p.click('#w-mic'); await W(p, 1200);
      d = await dlgNow(p);
      check(!d.kind && noRt(d.enHtml) === T(L, 'Great! Your Island Pass is ready.'), '念对了译文就过关（' + Math.round(nodeScore(L, tPass, tPass, xP).score) + ' 分），下一页「做好了」也是译文', d);
      await shot(p, L + '-pass');
      // 一直按 A，直到在家里醒来、妈妈说完（剧情记下 mom）
      for (let i = 0; i < 40 && !(await p.evaluate(() => !!EchoGame.S.world.flags['s:mom'] && !EchoWorld._debug().dlg && !EchoWorld._debug().busy)); i++) { if (await p.evaluate(() => !!EchoWorld._debug().dlg)) await A(p); else await W(p, 200); }

      // ---------- 2 选伙伴的贝壳（出门遇到博士）----------
      // 开场完了在家里（妈妈说完话）：走出家门，博士走过来
      await p.evaluate(() => { const d = EchoWorld._debug(); const e = d.M.warps[0]; d.PL.x = d.PL.fx = e.x; d.PL.y = d.PL.fy = e.y - 1; d.FL.x = d.FL.fx = e.x; d.FL.y = d.FL.fy = e.y - 2; });
      await p.keyboard.press('ArrowDown'); await W(p, 1600);

      check(await until(p, '#w-scene.bag', 30), '三个贝壳（选伙伴画面）', await p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M && d.M.id, dlg: d.dlg && d.dlg.pages[d.dlg.i].en, busy: d.busy, home: !document.getElementById('home').hidden, world: !document.getElementById('world').hidden, flags: EchoGame.S.world.flags, sheet: (document.querySelector('#modal:not([hidden])') || {}).innerText }; }));
      await W(p, 400);
      let bag = await p.evaluate(() => ({ en: (document.querySelector('#bg-box .bg-en') || {}).innerHTML || '', zh: (document.querySelector('#bg-box .bg-zh') || {}).innerText || '' }));
      check(noRt(bag.en) === T(L, 'Which shell will you open?') && bag.en.includes('<ruby>') === rk(T(L, 'Which shell will you open?')) && /◀ ▶/.test(bag.zh), '「打开哪个贝壳」：译文，下面是操作说明', bag);
      await p.keyboard.press('Enter'); await W(p, 300);
      bag = await p.evaluate(() => ({ en: (document.querySelector('#bg-box .bg-en') || {}).innerHTML || '', zh: (document.querySelector('#bg-box .bg-zh') || {}).innerText || '', yes: !!document.querySelector('#bg-yes') }));
      const tAsk = T(L, 'Bubbly is a water monster. Will you take it?');
      check(noRt(bag.en) === tAsk && bag.yes && (zhUi ? /泡泡鱼/.test(bag.zh) : bag.zh === 'Bubbly is a water monster. Will you take it?'), '问要不要它：译文（' + tAsk + '，属性名用翻好的词），下面是意思', bag);
      check((await keys(p)).includes(key(tAsk)), '问的这句念的是译文');
      const yn = await p.evaluate(() => [document.querySelector('#bg-yes').innerText.trim(), document.querySelector('#bg-no').innerText.trim()]);
      const tYes = TM(L, 'ui', 'YES').t, tNo = TM(L, 'ui', 'NO').t;
      check(yn[0] === (zhUi ? '是 ' + tYes : tYes) && yn[1] === (zhUi ? '不 ' + tNo : tNo), '是 / 不 的按钮：' + (zhUi ? '中文 + ' : '') + NAME + '（' + yn.join(' / ') + '），不是 YES / NO', yn);
      await shot(p, L + '-bag');
      await p.click('#bg-yes', { force: true }); await W(p, 1500);
      check(await until(p, '#w-dlg #w-mic', 3), '对伙伴说那句（说话任务）');
      d = await dlgNow(p);
      const tPartner = T(L, 'Bubbly, be my partner!');
      const tBub = TM(L, 'monster', 'Bubbly').t;
      check(d.target === tPartner && !enLeft(d, /be my partner/) && (zhUi ? /做我的伙伴/.test(d.en) && d.en.includes(tBub) : d.en === 'Say it in ' + NAME + ':') && (zhUi ? !d.mean : d.mean === 'Bubbly, be my partner!'),
        '对伙伴说：要说的是译文（' + tPartner + '），上面是' + (zhUi ? '中文说明（怪兽名是' + tBub + '）' : '「Say it in …:」，下面是英语原文'), d);
      await heard(p, tPartner); await p.click('#w-mic'); await W(p, 1200);
      const got = await p.evaluate(() => EchoGame.S.mon.box.map(m => m.sp));
      check(got.includes('bubbly'), '念对了：伙伴选好了', got);
      // 练习赛：一开场博士派出啃啃鼠、自己的伙伴上场（对战喊话念的是译文）
      for (let i = 0; i < 12 && !(await p.isVisible('#battle')); i++) { if (await p.evaluate(() => !!EchoWorld._debug().dlg)) await A(p); else await W(p, 300); }
      await W(p, 3000);
      const k1 = await keys(p);
      check(k1.includes(key(T(L, "Let's battle! Nibbler, your turn!") || 'x')) || k1.includes(key(T(L, 'Bubbly, your turn!'))), '对战喊话念的是译文（' + T(L, 'Bubbly, your turn!') + '）');
      await p.evaluate(() => { if (window.MonsterGame && MonsterGame.stop) MonsterGame.stop(); });

      // ---------- 3 大地图 ----------
      await relaunch(p, L, { world: { started: true, map: 't0', x: -1, y: -1, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 } }, mon: { box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], balls: 10 }, player: { gender: 'girl', name: 'Coco' } });
      await p.click('[data-act=wEnter]'); await W(p, 1200);
      await spy(p); await fakeSR(p);
      await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; });
      const talk = pages => p.evaluate(pg => EchoWorld._debug().talk(pg), pages);
      // 一页对话（带名字）
      await talk([{ who: 'Mom', emo: '👩', g: 'f', en: 'Hello again, {name}! How is your monster?', zh: '又见面了，{name}！你的怪兽还好吗？' }]);
      await W(p, 200);
      d = await dlgNow(p);
      const tHi = T(L, 'Hello again, {name}! How is your monster?');
      check(noRt(d.enHtml) === tHi && d.hear && d.enHtml.includes('<ruby>') === rk(tHi) && d.zh === (zhUi ? '又见面了，Coco！你的怪兽还好吗？' : 'Hello again, Coco! How is your monster?') && (await keys(p)).includes(key(tHi)),
        '大地图的一页对话：译文（名字换好了：' + tHi + '），下面是' + (zhUi ? '中文' : '英语原文') + '，念的是译文', d);
      const tMom = TM(L, 'person', 'Mom');
      check(noRt(d.name) === tMom.t && d.name.includes('<ruby>') === !!(tMom.r && /[一-鿿]/.test(tMom.t)), '对话框上的名字牌：' + tMom.t + '（不是 Mom）' + (tMom.r && /[一-鿿]/.test(tMom.t) ? '，标了读音' : ''), d.name);
      await shot(p, L + '-world-talk');
      // 「剧情中文」点一下才显示：意思收成「译」
      await p.evaluate(() => { EchoGame.S.settings.storyZh = 'tap'; });
      await talk([{ who: 'Mom', look: { skin: '#ffdcc2', hair: '#4e342e', style: 'long', eye: '#5a3a26', shirt: '#e53935', bottom: '#c62828' }, g: 'f', en: 'Hello again, {name}! How is your monster?', zh: '又见面了，{name}！你的怪兽还好吗？' }]);
      await W(p, 200);
      d = await dlgNow(p);
      check(d.zhBtn && noRt(d.enHtml) === tHi, '「剧情中文：点一下才显示」：译文下面的意思收成「译」按钮（和英语课一样）', d);
      await p.evaluate(() => { EchoGame.S.settings.storyZh = 'auto'; });
      // 告示牌：意思里的「英语」换成这门语言
      await talk([{ who: '告示牌', emo: '🪧', en: 'Talk to everyone. They will teach you English!', zh: '和每个人说说话，他们会教你英语！' }]);
      await W(p, 200);
      d = await dlgNow(p);
      check(noRt(d.enHtml) === T(L, 'Talk to everyone. They will teach you English!') && d.zh === (zhUi ? '和每个人说说话，他们会教你' + NAMES[L].zh + '！' : 'Talk to everyone. They will teach you ' + NAMES[L].en + '!'),
        '告示牌：译文，意思里的「英语」换成了' + NAME, d);
      // 说话任务
      await p.evaluate(() => { EchoGame.S.settings.mode = 'auto'; });
      await talk([{ who: 'Prof', emo: '🧑‍🔬', en: 'Now, can you say this to me?', zh: '现在，你能对我说这句话吗？', kind: 'speak', target: 'Nice to meet you, Professor!' }]);
      await W(p, 200);
      d = await dlgNow(p);
      const tNice = T(L, 'Nice to meet you, Professor!'), xNice = tr(L, 'Nice to meet you, Professor!');
      check(d.target === tNice && noRt(d.enHtml) === T(L, 'Now, can you say this to me?') && d.sayHtml.includes('<ruby>') === rk(tNice) && !enLeft(d, /Nice to meet you/) && (zhUi || d.mean === 'Nice to meet you, Professor!'),
        '说话任务：要说的是译文（' + tNice + '），问的那句也是译文' + (zhUi ? '' : '，下面是英语原文'), d);
      const wrong = T(L, 'Which photo is you?');
      await heard(p, wrong); await p.click('#w-mic'); await W(p, 1200);
      const stillOpen = await p.evaluate(() => { const dd = EchoWorld._debug().dlg; return !!(dd && dd.pages[dd.i].kind === 'speak'); });
      const sW = nodeScore(L, tNice, wrong, xNice.seg ? { seg: xNice.seg, r: xNice.r } : null).score;
      check(stillOpen && sW < 60, '说成别的句子：不过（Node 里同样的打分 ' + sW + ' 分）', { stillOpen, sW });
      await heard(p, tNice); await p.click('#w-mic'); await W(p, 1200);
      check(await p.evaluate(() => !EchoWorld._debug().dlg), '念对了译文：说话任务过了');
      // 回声技能的指令（和 world.js useSkill 拼的一样的一页）
      await talk([{ who: '{name}', emo: '🧒', g: 'f', en: "Tidalfin, let's surf!", zh: '用「水路」：大声对 Tidalfin 说出来！', kind: 'speak', target: "Tidalfin, let's surf!", lkey: 'skill:surf' }]);
      await W(p, 200);
      d = await dlgNow(p);
      const tSurf = T(L, "Tidalfin, let's surf!");
      check(d.target === tSurf && (zhUi ? /用「水路」/.test(d.en) : d.mean === "Tidalfin, let's surf!") && !enLeft(d, /let's surf/), '回声技能的指令：要说的是译文（' + tSurf + '，怪兽名用翻好的词）', d);
      await heard(p, tSurf); await p.click('#w-mic'); await W(p, 1200);
      check(await p.evaluate(() => !EchoWorld._debug().dlg), '念对了指令：过了');
      // 拿到 / 捡到道具（模板 + 词）
      await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; });
      for (const [en, zh] of [['You got Potion!', '得到了药水！'], ['You found an Echo Ball!', '你捡到了回声球！'], ['You found a Big Potion!', '你捡到了大瓶药水！']]) {
        await talk([{ who: '旁白', emo: '✨', en, zh }]);
        await W(p, 200);
        d = await dlgNow(p);
        check(noRt(d.enHtml) === T(L, en) && d.hear && d.zh === (zhUi ? zh : en), '道具：「' + en + '」→ ' + T(L, en), d);
        await A(p);
      }
      // 没翻的台词：过渡办法
      await talk([{ who: 'Prof', emo: '🧑‍🔬', en: 'Hello there!', zh: '你好呀！' }]);
      await W(p, 200); await typed(p);
      d = await dlgNow(p);
      if (!REAL || !tr(L, 'Hello there!')) check(!d.hear && d.en === (zhUi ? '你好呀！' : 'Hello there!'), '没翻的台词：正文是界面语言那份，没有 🔊', d);
      await A(p);
      // 第三批：台词里的提示——中文意思里引着的英语原句换成译文；意思是讲英语的（half past six 就是六点半）不显示；对手的名字按这门课的名字牌
      const enAsk = 'Please ask the baker, the student and the mayor: "What time do you get up?"', tAsk6 = T(L, enAsk), q6 = PK.quotes(tAsk6 || '')[0];
      await talk([{ who: 'Tock', emo: '🕰️', en: enAsk, zh: '请你去问面包师、学生和镇长：“What time do you get up?”' }]);
      await W(p, 200); await typed(p);
      d = await dlgNow(p);
      check(!!q6 && noRt(d.enHtml) === tAsk6 && (zhUi ? d.zh === '请你去问面包师、学生和镇长：“' + q6 + '”' : d.zh === enAsk),
        '台词里的提示：' + (zhUi ? '中文意思里引着的英语原句换成了译文（“' + q6 + '”）' : '英语界面的意思是英语原文'), d);
      await A(p);
      const enHalf = 'Half past six means six thirty.';
      await talk([{ who: 'Tock', emo: '🕰️', en: enHalf, zh: 'half past six 就是六点半。' }]);
      await W(p, 200); await typed(p);
      d = await dlgNow(p);
      check(noRt(d.enHtml) === T(L, enHalf) && (zhUi ? d.zh === '' && !d.zhBtn : d.zh === enHalf),
        zhUi ? '意思是讲英语的（half past six 就是六点半）：不显示，也没有「译」——不拿英语当意思' : '英语界面：意思是英语原文', d);
      await A(p);
      const tLeo = TM(L, 'person', 'Leo').t, enRiv = '{rival} wants to be the English Champion!';
      await talk([{ who: 'Pip', emo: '🧒', en: enRiv, zh: '{rival} 想当英语冠军！' }]);
      await W(p, 200); await typed(p);
      d = await dlgNow(p);
      check(noRt(d.enHtml) === tr(L, enRiv).t.split('{rival}').join(tLeo) && (zhUi ? d.zh === tLeo + ' 想当' + NAMES[L].zh + '冠军！' : d.zh === 'Leo wants to be the ' + NAMES[L].en + ' Champion!'),
        '对手的名字（' + tLeo + '）：台词' + (zhUi ? '和中文意思' : '') + '里都按这门课的名字牌写', d);
      await A(p);
      // 学科岛的课程表：English 和 Chinese 是两门课——意思那一行把「英语 / English」换成在学的语言以后，两门课也不能变成同一个名字
      const subj = [];
      for (const [en, zh] of [['On Monday we have maths, English and science.', '星期一我们有数学、英语和科学。'], ['On Tuesday we have Chinese, music and PE.', '星期二我们有语文、音乐和体育。']]) {
        await talk([{ who: 'Teacher', emo: '🧑‍🏫', en, zh }]);
        await W(p, 200);
        subj.push(await dlgNow(p));
        await A(p);
      }
      check(noRt(subj[0].enHtml) === T(L, 'On Monday we have maths, English and science.') && (zhUi
        ? subj[0].zh === '星期一我们有数学、' + NAMES[L].zh + '和科学。' && subj[1].zh === '星期二我们有语文、音乐和体育。'
        : subj[0].zh === 'On Monday we have maths, ' + NAMES[L].en + ' and science.' && subj[1].zh === 'On Tuesday we have ' + (L === 'zh' ? 'Chinese (language arts)' : 'Chinese') + ', music and PE.'),
      '课程表上的两门课：意思里「英语」换成了' + NAME + '，另一门课（语文 / Chinese）没跟着变成同一个名字', subj.map(d => d.zh));
      // 回忆挑战馆的词牌：词牌写这门语言的词；配成一对的那页是这个词（下面是意思），不是「went = 去了」
      await p.evaluate(() => EchoWorld._debug().goMap('i12G', 'from:t12')); await W(p, 700);
      for (let i = 0; i < 10 && (await p.evaluate(() => !!EchoWorld._debug().dlg)); i++) await A(p);
      const face = await p.evaluate(() => EchoWorld._debug().M.def.paint.a.t);
      check(face === T(L, 'went'), '词牌上写的是' + NAME + '的词（' + face + '）', face);
      const stepOn = async (x, y) => {
        await p.evaluate(([x, y]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y - 1; d.PL.dir = 'down'; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y - 2; }, [x, y]);
        await p.keyboard.down('ArrowDown'); await W(p, 40); await p.keyboard.up('ArrowDown'); await W(p, 700);
      };
      await stepOn(2, 14);   // 第 1 对的词牌（went）
      d = await dlgNow(p);
      check(noRt(d.enHtml) === T(L, 'went') && d.hear, '翻开词牌：这一页是' + NAME + '的词，有 🔊', d);
      for (let i = 0; i < 4 && (await p.evaluate(() => !!EchoWorld._debug().dlg)); i++) await A(p);
      await stepOn(8, 14);   // 第 1 对的意思牌（去了）
      let pairPg = null;
      for (let i = 0; i < 6 && !pairPg; i++) { const x = await dlgNow(p); if (x.kind === 'speak' || /配对成功|^went$/.test(x.zh)) pairPg = x; else await A(p); }
      check(!!pairPg && noRt(pairPg.enHtml) === T(L, 'went') && (zhUi ? pairPg.zh === '配对成功！' + T(L, 'went') + ' 就是“去了”。' : pairPg.zh === 'went') && !/ = /.test(pairPg.txt),
        '配成一对：正文是这个词（' + T(L, 'went') + '），下面是' + (zhUi ? '「配对成功！… 就是“去了”。」' : '英文原词') + '，不是「went = 去了」', pairPg);
      if (pairPg && !pairPg.kind) await A(p);
      d = await dlgNow(p);
      check(d.kind === 'speak' && d.target === T(L, 'went'), '然后大声读这个词：要说的是' + NAME + '的词', d);
      for (let i = 0; i < 6 && (await p.evaluate(() => !!EchoWorld._debug().dlg)); i++) { if (await p.$('#w-dlg [data-act=wSelfDone]')) await p.click('#w-dlg [data-act=wSelfDone]'); else await A(p); await W(p, 200); }
      await p.evaluate(() => EchoWorld._debug().goMap('t0', 'door:C')); await W(p, 700);
      await shot(p, L + '-world');
      // ---------- 4 对战喊话 ----------
      await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; window.__keys = []; EchoWorld._debug().battle('wild', { lvBonus: 1 }); });
      await p.waitForSelector('#battle:not([hidden])', { timeout: 15000 });
      for (let k = 0; k < 40 && !(await p.$('#b-panel [data-act=bMove]')); k++) { const b = await p.$('#b-panel [data-act=bDef]'); if (b) await b.click().catch(() => {}); await W(p, 300); }
      const foe = await p.evaluate(() => { const b = MonsterGame._b(); const f = b && (b.foes ? b.foes[b.fi || 0] : b.foe); return f ? f.sp : null; });
      const foeEn = await p.evaluate(sp => window.DEX && DEX.byId && DEX.byId[sp] ? DEX.byId[sp].en : sp, foe);
      const plate = await p.evaluate(() => ({ me: (document.querySelector('.hpcard.me b') || {}).innerHTML || '', moves: [...document.querySelectorAll('#b-panel .move .mv-top b')].map(b => b.innerHTML), small: [...document.querySelectorAll('#b-panel .move small')].map(b => b.innerText) }));
      const tFin = TM(L, 'monster', 'Tidalfin'), wantMv = ['Bubble Shot', 'Body Bump', 'Sweet Rest'].map(m => TM(L, 'move', m));
      check(noRt(plate.me) === tFin.t && wantMv.every(m => plate.moves.some(h => noRt(h) === m.t)) && (L === 'es' || plate.moves.some(h => h.includes('<ruby>'))),
        '对战的名牌（' + tFin.t + '）和招式按钮（' + wantMv.map(m => m.t).join('、') + '）是' + NAME + '的写法' + (L === 'es' ? '' : '，招式标了读音'), plate);
      check(plate.small.some(x => x.includes(zhUi ? DEXN.MOVES.water[0][1] : 'Bubble Shot')), '招式按钮的小字：' + (zhUi ? '中文名（' + DEXN.MOVES.water[0][1] + '）' : '英语界面写英文原名（Bubble Shot）'), plate.small);
      const k2 = await keys(p), tLook = T(L, 'Look out! Here comes ' + foeEn + '!'), tTurn = T(L, 'Tidalfin, your turn!');
      check(!!tLook && k2.includes(key(tLook)) && k2.includes(key(tTurn)), '对战喊话：「Look out! Here comes ' + foeEn + '!」→ ' + tLook + '；「Tidalfin, your turn!」→ ' + tTurn, { foe, n: k2.length });
      await shot(p, L + '-battle');
      await p.evaluate(() => { if (window.MonsterGame && MonsterGame.stop) MonsterGame.stop(); });
      // ---------- 5 画面上的名字：手册、背包、房子的招牌 ----------
      await p.evaluate(() => { EchoGame.goHome(); EchoGame.S.mon.dex.tidalfin = 'caught'; document.body.insertAdjacentHTML('beforeend', '<button id="t-dex" data-act="mDexOne" data-sp="tidalfin" style="position:fixed;left:0;top:0;z-index:99999">dex</button>'); });
      await W(p, 400);
      await p.click('#t-dex', { force: true }); await W(p, 400);
      const dex = await p.evaluate(() => (document.querySelector('#modal h2') || {}).innerHTML || '');
      check(noRt(dex).includes(tFin.t) && (rk(tFin.t) ? dex.includes('<ruby>') : !/<ruby>/.test(dex)) && (zhUi ? dex.includes('潮汐鳍') : true), '手册那一页的标题：' + tFin.t + (rk(tFin.t) ? '（标了读音）' : '') + (zhUi ? '，后面是中文名' : ''), dex);
      await shot(p, L + '-dex');
      await p.evaluate(() => { EchoGame.closeModal(); MonsterGame.bagSheet(); }); await W(p, 400);
      const bagRow = await p.evaluate(() => { const r = [...document.querySelectorAll('#modal .ach')].find(x => /🧪/.test(x.innerText)); return r ? { b: r.querySelector('b').innerText, small: r.querySelector('small').innerHTML } : null; });
      const tPot = TM(L, 'item', 'Potion');
      check(!!bagRow && noRt(bagRow.small).includes(' · ' + tPot.t) && !/ · Potion/.test(noRt(bagRow.small)), '背包：药水那一行的小字是' + NAME + '的写法（' + tPot.t + '），不是 Potion', bagRow);
      await shot(p, L + '-bag-items');
      await p.evaluate(() => EchoGame.closeModal());
      // 招牌：2D（上面一直是 2D）、经典 3D、新画风，三种画法画的都是这门课的写法；挑战馆的英文招牌是 HALL（不再是 GYM）
      const signs = ['REST STOP', 'SHOP', 'CHALLENGE HALL'].map(e => { const t = TM(L, 'sign', e).t; return t === 'CHALLENGE HALL' ? 'HALL' : t; });
      const drawn = () => p.evaluate(() => [...window.__fill]);
      let fills = await drawn();
      check(signs.every(t => fills.includes(t)) && !fills.includes('GYM') && (signs[0] === 'REST STOP' || !fills.includes('REST STOP')), '2D 画法：房子的招牌是' + NAME + '的（' + signs.join(' / ') + '）', fills.filter(x => /[A-Z]{3}/.test(x)).slice(0, 10));
      for (const [look, gfx, tag] of [['std', 'mid', '经典 3D'], ['new', 'mid', '新画风']]) {
        await p.evaluate(lk => { localStorage.setItem('echo-look', lk); }, look);
        await relaunch(p, L, { settings: { gfx }, world: { started: true, map: 't0', x: -1, y: -1 } });
        await p.evaluate(() => { window.__fill = new Set(); });
        await p.click('[data-act=wEnter]'); await W(p, 3500);
        const info = await p.evaluate(() => { const R = EchoWorld._debug().R; return { using: R && R.using ? R.using() : (R ? 'std' : 'none') }; });
        fills = await drawn();
        check(signs.every(t => fills.includes(t)) && !fills.includes('GYM'), tag + '（' + info.using + '）：房子的招牌是' + NAME + '的', { info, fills: fills.filter(x => /[A-Za-z]{3}|[ぁ-ヿ一-鿿]/.test(x)).slice(0, 12) });
        await shot(p, L + '-signs-' + look);
        await p.evaluate(() => EchoGame.goHome());
      }
      await p.evaluate(() => localStorage.removeItem('echo-look'));
      // ---------- 6 「📍 现在要做」和地名（第三批）----------
      const FL0 = { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 };
      const goal = () => p.evaluate(() => ({ hud: (document.getElementById('w-goal') || {}).innerText || '', zname: (document.getElementById('w-zname') || {}).innerText || '', zsub: (document.getElementById('w-zsub') || {}).innerText || '' }));
      const shut = async () => { for (let i = 0; i < 8 && (await p.evaluate(() => !!EchoWorld._debug().dlg)); i++) await A(p); };
      // 6a 第 2 座岛「帮蒂姆找家人」：引着的原句从剧情台词的引号里拿到译文，名字按这门课的名字牌
      await relaunch(p, L, { settings: { gfx: '2d' }, world: { started: true, map: 't0', x: -1, y: -1, visited: { 0: 1, 1: 1, 2: 1 }, flags: Object.assign({ 's:f2call': 1, 's:f2tim': 1 }, FL0) }, mon: { badges: { 0: 1, 1: 1 } } });
      await p.click('[data-act=wEnter]'); await W(p, 1200); await shut();
      let g = await goal();
      const qTim = PK.quoteMap(TAB[L]).get("Are you Tim's mom?"), tTim = TM(L, 'person', 'Tim').t;
      check(!!qTim && g.hud.includes('"' + qTim + '"') && !/Are you|mom\?/.test(g.hud) && (zhUi ? g.hud.includes('帮蒂姆') && g.hud.includes(tTim) : g.hud.includes('Help ' + tTim + ' find')),
        'HUD 的「📍 现在要做」：引着的原句是译文（' + qTim + '），名字是' + NAME + '的写法（' + tTim + '）', g);
      await p.evaluate(() => document.querySelector('#world .w-menu').click()); await W(p, 300);
      const card = await p.evaluate(() => { const c = document.querySelector('#w-goal-full small'); return c ? c.innerText : ''; });
      check(!!card && g.hud === '📍 ' + card, '冒险菜单最上面的「📍 现在要做」：和 HUD 那一行一样', { card, hud: g.hud });
      await shot(p, L + '-goal');
      await p.evaluate(() => EchoGame.closeModal());
      // 地名：HUD、进地图的横幅、首页「飞去哪」、乘风的菜单——大字是这门课的地名（横幅、菜单标读音），小字是界面语言的名字
      const tIsle = TM(L, 'place', 'Hello Island'), uiIsle = zhUi ? '你好岛' : 'Hello Island';
      check(g.zname.includes(tIsle.t) && g.zsub === uiIsle, 'HUD 的地名：大字是' + NAME + '的地名（' + tIsle.t + '），小字是界面语言的名字（' + uiIsle + '）', g);
      const ban = await p.evaluate(() => { const b = document.getElementById('w-banner'); return { b: (b.querySelector('b') || {}).innerHTML || '', span: (b.querySelector('span') || {}).innerText || '' }; });
      check(noRt(ban.b) === tIsle.t && ban.span === uiIsle && ban.b.includes('<ruby>') === rk(tIsle.t), '进地图的横幅：大字是' + NAME + '的地名' + (rk(tIsle.t) ? '（标读音）' : '') + '，下面一行是界面语言的名字', ban);
      const flyHome = await p.evaluate(() => { const box = document.createElement('div'); box.innerHTML = MonsterGame.homeHTML(); const b = box.querySelector('.fly-list [data-z="0"]'); return b ? { b: (b.querySelector('.pl-c b') || {}).innerHTML || '', small: (b.querySelector('.pl-c small') || {}).innerText || '' } : null; });
      check(!!flyHome && noRt(flyHome.b) === tIsle.t && flyHome.small === uiIsle, '首页「飞去哪」：' + tIsle.t + ' + 小字 ' + uiIsle, flyHome);
      await p.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<button id="t-fly" data-act="wUseSkill" data-k="fly" style="position:fixed;left:0;top:0;z-index:99999">fly</button>'));
      await p.click('#t-fly', { force: true }); await W(p, 300);
      const flyW = await p.evaluate(() => { const b = document.querySelector('#modal .fly-list [data-z="0"]'); return b ? { b: (b.querySelector('.pl-c b') || {}).innerHTML || '', small: (b.querySelector('.pl-c small') || {}).innerText || '' } : null; });
      check(!!flyW && noRt(flyW.b) === tIsle.t && flyW.small === uiIsle && flyW.b.includes('<ruby>') === rk(tIsle.t), '乘风「飞到哪里？」：' + tIsle.t + ' + 小字 ' + uiIsle, flyW);
      await shot(p, L + '-fly');
      await p.evaluate(() => { EchoGame.closeModal(); const b = document.getElementById('t-fly'); if (b) b.remove(); });
      // 选伙伴没念准的提示：给的是要说的那一句，不是 be my partner!
      check(await p.evaluate(() => EchoI18n.t('b.st.retry', { w: '¡Sprouty, sé mi compañero!' })) === (zhUi ? '再试一次：' : 'Try again: ') + '¡Sprouty, sé mi compañero!', '选伙伴没念准：「再试一次」后面是要说的那一句（b.st.retry.c）');
      // 6b 第 3 座岛「找人问一问 "Where is the library?"」：小样里这句没翻 → 不引英语，换成「键.q」的说法（正式翻译里有就引译文）
      await p.evaluate(() => EchoGame.goHome());
      await relaunch(p, L, { world: { started: true, map: 't0', x: -1, y: -1, visited: { 0: 1, 1: 1, 2: 1, 3: 1 }, flags: Object.assign({ 's:f3in': 1, 's:f3note': 1 }, FL0) }, mon: { badges: { 0: 1, 1: 1, 2: 1 } } });
      await p.click('[data-act=wEnter]'); await W(p, 1200); await shut();
      g = await goal();
      const qLib = PK.quoteMap(TAB[L]).get('Where is the library?') || T(L, 'Where is the library?');
      if (qLib) check(g.hud.includes('"' + qLib + '"') && !/Where is/.test(g.hud), 'HUD：「Where is the library?」引的是译文（' + qLib + '）', g);
      else check(!/["“”]/.test(g.hud) && !/Where is|library\?/.test(g.hud) && (zhUi ? g.hud.includes('用' + NAMES[L].zh + '问一问图书馆在哪儿') : g.hud.includes('in ' + NAMES[L].en + ' where the library is')),
        'HUD：引着的原句没有译文 → 不引英语，换成「用' + NAME + '问一问」的说法（st.step.3.lib.q）', g);
      await shot(p, L + '-goal-q');
      await p.evaluate(() => EchoGame.goHome());
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
