// 别的语言的课里的「今日目击」（tools/course/TALK.md「第二轮」C；Playwright Chromium，约 2 分钟）：node tests/course-sight.test.js [--only=es,ja,zh,old] [--real]
// 课程包：真的课程源文件经 tools/course/build.js 出的 course.json，再塞进 tests/course-r2-fixture.js 的几条线索译文（LINES：键是线索的英语原文）。
// 今天的目标在存档里定死（1 号路草丛里的 Bookworm，线索用哪种说法也定死），免得跟着日期变。
//   es / ja / zh 每门语言各走一遍（西语、日语中文界面；中文课英语界面）：
//     1 首页卡片：三条线索显示的是这门课的译文（lineOf 查出来的整句；日语、中文标读音），没有英语原句；位置在「传说的线索」前面 / 小提示前面
//     2 「译」：先收着，点开是界面语言的意思（中文界面 = 线索自己的中文；英语界面 = 英语原文），点一次记一次；🔊 念的是译文（课程包里的配音）
//     3 冒险菜单那一行、告示板（竖屏、横屏截图 sight-<语言>-*.png）：写的是「{语言}线索」，没有「英文线索」
//     4 大地图：进对了地图的提示不夹英语；在草丛里走几步它出来（对战顶上写着今日目击）；跑掉的提示里怪兽名是这门课的写法；收服：金币、今天结束
//     5 线索意思里夹着英语的那条（「见到谁都说 hello」）：意思照线索自己的中文显示；原文说「English」的那条（学科岛）：译文是在学的这门语言，
//       下面那行意思也跟着换（上下两行说的是同一门语言）；有一条线索查不到译文：这一天整个不出（卡片、菜单、怪兽都没有）
//   old 老的课程包（LINES 里没有线索）：和以前一样不出——没有卡片、菜单里没有那一行、走进 1 号路不记 been、草丛里走不出来
// 英语课的今日目击在 tests/sighting.test.js（这里不重复）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const FX = require(path.join(__dirname, 'course-r2-fixture.js'));
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = s => !ONLY.length || ONLY.includes(s);
const LANGS = ['es', 'ja', 'zh'];
const NAMES = { en: { zh: '英语', en: 'English', self: 'English' }, es: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, ja: { zh: '日语', en: 'Japanese', self: '日本語' }, zh: { zh: '中文', en: 'Chinese', self: '中文' } };
const UI = { es: 'zh', ja: 'zh', zh: 'en' };
// 线索的中文意思（sighting.js 里那几句）
const ZH = { [FX.LOOK]: '它在一座岛上，那里有棕榈树和红屋顶的白房子。', [FX.TOPIC]: '它在一座岛上，那里的人见到谁都说 hello 和 good morning。', [FX.DIR]: '它在一条路上。从小镇往北走。', [FX.TYPE]: '它躲在高高的草丛里。它是虫系的怪兽。' };
// --real：线索用正式的翻译（tools/course/<语言>/sight.json，经 build.js 并进 LINES）走一遍同样的画面——每一句都有译文，「查不到译文」那几条不测；
// 平时用小样（结果固定，正式翻译改了也不影响）
const REAL = process.argv.includes('--real');
const C = {}, MONNAME = {};

// ---------- 课程包小样 ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-csight-'));
const VER = '20261121.2';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
function courseOf(lang) {
  try { return CB.build(lang, { check: true, lines: false }).course; } catch (e) { console.log('  ⚠ ' + lang + '：tools/course/check.js 没过，用 buildCourse 直接转：' + String(e.message).split('\n')[0]); return CB.buildCourse(lang, { lines: false }); }
}
function pack(name, lang, texts, course) {
  const dir = path.join(TMP, name, lang, VER); fs.mkdirSync(dir, { recursive: true });
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
// 两套课程包：packs（塞了线索译文的）、packs-old（原样：老的课程包）
const CAT = { fmt: 1, packs: {} }, CAT_OLD = { fmt: 1, packs: {} };
{ const b = pack('packs', 'en', ['Hello!']); CAT.packs.en = { ver: VER, name: NAMES.en, bytes: b, core: b, course: false }; const b2 = pack('packs-old', 'en', ['Hello!']); CAT_OLD.packs.en = { ver: VER, name: NAMES.en, bytes: b2, core: b2, course: false }; }
// 模板拼得出来的每一句线索（tools/course/sight-src.json）：正式的翻译并进 course.json 以后，这里先把它们从 LINES 里拿掉——
// 老的课程包一句都没有；测试的课程包只留小样里的那四句（才测得到「查不到译文」）
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'course', 'sight-src.json'), 'utf8')).lines;
for (const l of LANGS) {
  const base = courseOf(l), had = SRC.filter(en => base.LINES && base.LINES[en]).length;
  if (had) { console.log('  （' + l + '：course.json 里已经有 ' + had + ' 条线索的译文，测试里换成小样的四句）'); SRC.forEach(en => { delete base.LINES[en]; }); }
  if (l === 'es') { const b0 = pack('packs-old', l, ['Hola'], JSON.parse(JSON.stringify(base))); CAT_OLD.packs[l] = { ver: VER, name: NAMES[l], bytes: b0, core: b0, course: true }; }
  const c = C[l] = REAL ? CB.build(l, { check: true, lines: false, sight: path.join(ROOT, 'tools', 'course', l, 'sight.json') }).course : FX.apply(JSON.parse(JSON.stringify(base)), l, { sight: true });
  MONNAME[l] = FX.textOf(((c.TERMS || {}).monster || {}).Bookworm || 'Bookworm');
  const b = pack('packs', l, [FX.LOOK, FX.TOPIC, FX.DIR, FX.TYPE, FX.ENG, FX.SEA].map(en => FX.textOf(c.LINES[en] || '')).filter(Boolean), c);
  CAT.packs[l] = { ver: VER, name: NAMES[l], bytes: b, core: b, course: true };
}
if (REAL) console.log('  （--real：线索的译文是正式的 ' + LANGS.map(l => l + ' ' + SRC.filter(en => C[l].LINES[en]).length + '/' + SRC.length).join('、') + ' 句）');

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const web = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  const m = /^\/(packs|packs-old)\/(.*)$/.exec(u);
  if (m) {
    if (m[2] === 'catalog.json') return send(200, JSON.stringify(m[1] === 'packs' ? CAT : CAT_OLD), MIME.json);
    const file = path.join(TMP, m[1], m[2]);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});
const SAVE = () => ({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120,
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh' },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 12, xp: 0 }, { uid: 'u1', sp: 'cindercat', lv: 12, xp: 0 }], team: ['u0', 'u1'], dex: {}, balls: 20, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', arrive: 'door:C', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} },
});

(async () => {
  await new Promise(r => web.listen(0, '127.0.0.1', r));
  const BASE = 'http://echo.localhost:' + web.address().port;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errs = [], cerr = [];
  const W = (p, ms) => p.waitForTimeout(ms);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'sight-' + name + '.png') });
  async function openGame(packs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; return /(^|\.)localhost$|^127\.0\.0\.1$/.test(h) ? r.continue() : r.abort(); });
    await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); window.__rnd = Math.random; }, JSON.stringify(SAVE()));
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) cerr.push(m.text()); });
    await p.goto(BASE + '/index.html?packs=' + encodeURIComponent('/' + packs));
    await homeUp(p);
    return { ctx, p };
  }
  // 换到 L 这门课：装课程包、写这门课的存档（去过 1 号路；sight 给了就把今天的目标定死）、重新打开
  async function toCourse(p, L, sight, more) {
    await p.evaluate(l => EchoPacks.install(l), L);
    await p.evaluate(([l, ui, sight, more]) => {
      const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: l, rev: undefined, stars: {}, talk: undefined, quests: undefined, log: undefined, place: { lang: l, lv: 1, auto: 1, talk: 1, adj: 0, know: 1, who: 'adult', at: '2026-11-20' } });
      Object.assign(s.settings, { track: 'level', ui }, more || null);
      s.world.been = { r0: 1 };
      if (sight) s.world.sight = Object.assign({ day: today, map: 'r0', hab: 'grass', sp: 'bookworm', lv: 4, shiny: false, cv: [0, 0], st: '', steps: 0, need: 5, met: 0, zh: 0, pm: '', ps: '', total: 0, streak: 0, last: '' }, sight);
      localStorage.setItem('echo-island-v1@' + l, JSON.stringify(s)); localStorage.setItem('echo-course', l);
    }, [L, UI[L], sight, more || null]);
    await p.reload(); await homeUp(p);
  }
  const E = (p, f, a) => p.evaluate(f, a);
  const monTab = async p => { await E(p, () => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); }); await W(p, 250); };
  const noRt = s => s.replace(/<rt>[^<]*<\/rt>/g, '').replace(/<[^>]+>/g, '');
  // 首页卡片现在的样子
  const card = p => E(p, () => {
    const c = document.querySelector('#mon-home .sight');
    if (!c) return null;
    const nx = c.nextElementSibling;
    return { txt: c.innerText, html: [...c.querySelectorAll('.sg-en')].map(e => e.innerHTML), zhBtn: c.querySelectorAll('button.sg-zh').length, zhTxt: [...c.querySelectorAll('span.sg-zh')].map(e => e.textContent),
      spk: [...c.querySelectorAll('[data-act=sayText]')].map(b => b.dataset.t), chip: (c.querySelector('.lvchip') || {}).textContent || '', next: nx ? nx.className + '|' + nx.tagName : '', n: document.querySelectorAll('#mon-home .sight').length,
      aria: (c.querySelector('button.sg-zh') || { getAttribute: () => '' }).getAttribute('aria-label') };
  });
  const spy = p => E(p, () => { window.__keys = []; const h = EchoPacks.hasClip; EchoPacks.hasClip = (k, g) => { window.__keys.push(k); return h(k, g); }; });
  const toasts = p => E(p, () => [...document.querySelectorAll('.toast')].map(e => e.textContent).join(' | '));
  const dbg = p => E(p, () => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, busy: d.busy, dlg: !!d.dlg }; });
  const settle = async p => { let last = ''; for (let k = 0; k < 40; k++) { const s = await E(p, () => { const d = EchoWorld._debug(); return d.PL.moving + ',' + d.PL.x + ',' + d.PL.y; }); if (s === last && s.startsWith('false')) return; last = s; await W(p, 120); } };
  const walk = async (p, dir) => { const K = { left: 'ArrowLeft', right: 'ArrowRight' }[dir]; await p.keyboard.down(K); await W(p, 40); await p.keyboard.up(K); await W(p, 260); for (let k = 0; k < 20 && (await dbg(p)).busy; k++) await W(p, 100); await settle(p); };
  // 找一对左右相邻的草丛格子，站上去；来回走 n 步，出了对战就停（返回第几步出的，没出 = 0）
  const stand = p => E(p, () => {
    const d = EchoWorld._debug(), m = d.M;
    for (let y = m.H - 3; y > 1; y--) for (let x = 1; x < m.W - 2; x++) if (m.grid[y][x] === ',' && m.grid[y][x + 1] === ',' && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 8) && !m.warps.some(w => Math.abs(w.x - x) + Math.abs(w.y - y) < 3)) {
      d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = 'right'; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; EchoSight._run.prev = false; return { x, y };
    }
    return null;
  });
  const pace = async (p, base, n) => {
    for (let real = 0, tries = 0; real < n && tries < n * 3; tries++) {
      const x = (await dbg(p)).x;
      await walk(p, x === base.x ? 'right' : 'left');
      if ((await dbg(p)).x !== x) real++;
      if (await p.isVisible('#battle')) return real;
    }
    return 0;
  };
  const sightNow = p => E(p, () => { const s = EchoSight.state(); return { on: EchoSight.on(), st: s.st, clues: (s.clues || []).map(c => ({ en: c.en, t: c.t, mean: c.mean })), sg: JSON.parse(JSON.stringify(EchoGame.S.world.sight || null)), been: Object.keys(EchoGame.S.world.been || {}) }; });

  try {
    for (const L of LANGS.filter(want)) {
      const ui = UI[L], zhUi = ui === 'zh', NAME = NAMES[L][ui], T = en => FX.textOf(C[L].LINES[en] || ''), rubyL = L !== 'es';
      console.log('— ' + L + '（' + NAMES[L].zh + '，界面 ' + ui + '）');
      const { ctx, p } = await openGame('packs');
      await toCourse(p, L, {});
      const s0 = await sightNow(p);
      check(s0.on && s0.st === 'new' && s0.clues.length === 3 && s0.clues[0].t === T(FX.LOOK) && s0.clues[1].t === T(FX.DIR) && s0.clues[2].t === T(FX.TYPE) && s0.clues.every(c => !!c.en && !!c.mean),
        '这门课有线索的译文：今日目击开着，三条线索是 lineOf(英语原文) 查出来的整句', s0);

      // ---------- 1 首页卡片 ----------
      await monTab(p);
      await spy(p);
      let c = await card(p);
      check(!!c && c.n === 1 && c.html.length === 3 && [FX.LOOK, FX.DIR, FX.TYPE].every((en, k) => noRt(c.html[k]) === T(en)), '首页卡片：三条线索显示的是' + NAMES[L].zh + '的译文', c && c.html.map(noRt));
      if (c) {
        check(!/It is on|It hides|Go north|tall grass/.test(c.txt) && (!zhUi || !/English|英文|英语/.test(c.txt)), '卡片上没有英语原句' + (zhUi ? '，也不写「英文」' : ''), c.txt);
        check(rubyL ? c.html.every(h => /<ruby>.+<rt>.+<\/rt><\/ruby>/.test(h)) : !c.html.some(h => h.includes('<ruby>')), rubyL ? NAMES[L].zh + '：线索标了读音（<ruby>）' : '西语：线索不标读音', c.html[1]);
        check(/legends|^tip\|P$/.test(c.next), '卡片的位置和英语课一样：在「传说的线索」前面（没有那张卡片时在小提示前面）', c.next);
        // ---------- 2 「译」和 🔊 ----------
        check(c.zhBtn === 3 && c.zhTxt.length === 0 && (zhUi ? c.aria === '看意思' : /meaning/i.test(c.aria)), '三条的意思都先收成「译」（读懂这门语言才是玩法）', { n: c.zhBtn, aria: c.aria });
        check(JSON.stringify(c.spk) === JSON.stringify([T(FX.LOOK), T(FX.DIR), T(FX.TYPE)]), '🔊 念的是译文', c.spk);
        await p.click('#mon-home .sight [data-act=sayText] >> nth=1'); await W(p, 500);
        const ks = await E(p, () => window.__keys.slice());
        check(ks.includes(key(T(FX.DIR))) && !ks.includes(key(FX.DIR)), '点第 2 条的 🔊：放的是课程包里这句译文的配音（key 是译文的）', ks.slice(-4));
        const taps0 = await E(p, () => EchoGame.dayLog().zhTaps || 0);
        await p.click('#mon-home .sight button.sg-zh >> nth=0'); await W(p, 250);
        c = await card(p);
        const exp0 = zhUi ? ZH[FX.LOOK] : FX.LOOK;
        check(c.zhBtn === 2 && c.zhTxt[0] === exp0 && (await E(p, () => EchoGame.dayLog().zhTaps || 0)) === taps0 + 1 && (await E(p, () => EchoGame.S.world.sight.zh)) === 1,
          '点第 1 条的「译」：' + (zhUi ? '线索自己的中文意思' : '英语界面给英语原文') + '（' + exp0 + '），记一次', c.zhTxt);
        await E(p, () => document.querySelector('#mon-home .sight').scrollIntoView({ block: 'center' })); await W(p, 150);
        await shot(p, L + '-home');
        await p.setViewportSize({ width: 844, height: 390 }); await W(p, 350);
        await E(p, () => document.querySelector('#mon-home .sight').scrollIntoView({ block: 'center' })); await W(p, 150);
        await shot(p, L + '-home-land');
        await E(p, () => window.scrollTo(0, 0));
        await p.setViewportSize({ width: 390, height: 844 }); await W(p, 250);
      }

      // ---------- 3 冒险菜单那一行、告示板 ----------
      await p.click('[data-act=wEnter]'); await W(p, 1300);
      await E(p, () => { Math.random = () => .99; });   // 不掷出普通的遇怪
      await E(p, () => document.querySelector('#world [data-act=wB]').click()); await W(p, 300);
      const row = await p.textContent('#sheet [data-act=sgOpen]').catch(() => '');
      check(zhUi ? row.includes('3 条' + NAME + '线索 · 还没找到') && !/英文/.test(row) : row.includes('3 ' + NAME + ' clues') && !/English/.test(row), '冒险菜单里有「今日目击」一行：写的是「' + NAME + '线索」', row);
      await p.click('#sheet [data-act=sgOpen]'); await W(p, 300);
      const sh = await E(p, () => ({ txt: document.querySelector('#sheet').innerText, en: [...document.querySelectorAll('#sheet .sg-en')].map(e => { const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(x => x.remove()); return c.textContent; }), zhTxt: [...document.querySelectorAll('#sheet span.sg-zh')].map(e => e.textContent), zhBtn: document.querySelectorAll('#sheet button.sg-zh').length }));
      check(sh.en.length === 3 && sh.en[0] === T(FX.LOOK) && sh.en[2] === T(FX.TYPE) && sh.zhBtn === 2 && sh.zhTxt.length === 1 && !/Route 1|1 号路|Bookworm|It is on|It hides/.test(sh.txt.split(sh.zhTxt[0] || '\u0000').join('')),
        '告示板：三条译文（点过「译」的那条开着），不写地图名、怪兽名、英语原句', sh);
      check(zhUi ? sh.txt.includes('读懂三条' + NAME + '线索') && !/英文线索|Today's Sighting/.test(sh.txt) && /不点「译」再 \+20/.test(sh.txt) : sh.txt.includes('three ' + NAME + ' clues') && !/English clues/.test(sh.txt) && /\+20 more/.test(sh.txt),
        '告示板的说明：读懂三条' + NAME + '线索；收服 +30，三条都不点「译」再 +20', sh.txt.slice(0, 260));
      await shot(p, L + '-sheet');
      await p.setViewportSize({ width: 844, height: 390 }); await W(p, 350);
      await shot(p, L + '-sheet-land');
      await p.setViewportSize({ width: 390, height: 844 }); await W(p, 250);
      await p.click('#sheet [data-act=close]'); await W(p, 200);

      // ---------- 4 大地图：提示、出来、跑掉、收服 ----------
      await E(p, () => EchoWorld._debug().goMap('r0', 'from:t0')); await W(p, 1500);
      const ts = await toasts(p);
      check((zhUi ? /这附近有稀有怪兽的气息/.test(ts) && !/Something rare/.test(ts) : /Something rare is close!/.test(ts) && !/[一-鿿]/.test(ts.split('|').filter(x => /rare/.test(x)).join(''))), '进了目击的地图：提示只写界面语言那一句（这句没有译文，不夹英语）', ts);
      const base = await stand(p);
      const n = base ? await pace(p, base, 9) : 0;
      const bi = n ? await E(p, () => { const b = MonsterGame._b(); return b ? { title: document.querySelector('#battle .th-title b').textContent, sub: document.querySelector('#battle .th-title small').textContent, sp: b.foes[0].sp, lv: b.foes[0].lv } : null; }) : null;
      check(n === 5 && !!bi && bi.sp === 'bookworm' && bi.lv === 4 && (zhUi ? /今日目击/.test(bi.title) && bi.sub === '稀有怪兽' : /Today's Sighting/.test(bi.title)), '在草丛里走到第 5 步它出来：对战顶上写着今日目击' + (zhUi ? '（小字不夹英语）' : ''), { n, bi });
      if (bi) {
        await shot(p, L + '-battle');
        await p.waitForSelector('#b-panel [data-act=bBag]', { state: 'visible', timeout: 20000 }); await W(p, 200);
        await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]'); await W(p, 800);
        const t2 = await toasts(p), s2 = await sightNow(p);
        check(s2.sg.st === 'seen' && t2.includes(MONNAME[L]) && (MONNAME[L] === 'Bookworm' || !/Bookworm/.test(t2)), '跑掉：见过了，提示里怪兽的名字是这门课的写法（' + MONNAME[L] + '）', t2);
        // 再走一阵它又出来 → 收服
        await E(p, () => { EchoGame.S.world.sight.need = 3; EchoGame.S.world.sight.steps = 0; });
        const b2 = await stand(p), n2 = b2 ? await pace(p, b2, 6) : 0;
        if (check(n2 > 0, '跑掉以后再走几步它又出来', n2)) {
          await p.waitForSelector('#b-panel [data-act=bBag]', { state: 'visible', timeout: 20000 }); await W(p, 200);
          await E(p, () => { MonsterGame._b().foeHp = 1; Math.random = () => 0; const b = document.querySelector('#b-panel [data-act=bCatch]'); b.disabled = false; b.click(); });
          const rate = await p.waitForSelector('#b-panel [data-act=bRate][data-v="2"]', { state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
          if (rate) await p.click('#b-panel [data-act=bRate][data-v="2"]');
          const done = await p.waitForSelector('#b-panel [data-act=bEnd]', { state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
          await W(p, 1500);
          const coins = done ? await E(p, () => { const b = EchoGame.S.coins; document.querySelector('#b-panel [data-act=bEnd]').click(); return [b, EchoGame.S.coins]; }) : [0, 0];
          await E(p, () => { Math.random = () => .99; });
          await W(p, 900);
          const t3 = await toasts(p), s3 = await sightNow(p);
          // 点过一条「译」：只有收服的 30（没有「没看意思」的 20）
          check(done && s3.sg.st === 'caught' && s3.sg.total === 1 && coins[1] - coins[0] === 30 && t3.includes(MONNAME[L]) && (zhUi ? /今日目击：收服了/.test(t3) : /you caught/.test(t3)), '收服：今天的目击结束，金币 +30（点过「译」，没有另外的 20），提示里是这门课的名字', { coins, t3, st: s3.sg.st });
          for (let i = 0; i < 6 && await p.isVisible('#modal'); i++) { const sk = await p.$('#sheet [data-act=mNickSkip]'); if (sk) await sk.click(); else { const cl = await p.$('#sheet [data-act=close]'); if (cl) await cl.click(); else break; } await W(p, 400); }
          await E(p, () => { EchoGame.closeModal(); EchoGame.goHome('mon'); }); await W(p, 400);
          c = await card(p);
          check(!!c && /done/.test(await E(p, () => document.querySelector('#mon-home .sight').className)) && c.txt.includes(MONNAME[L]), '回首页：卡片收成一行「已收服」', c && c.txt);
        }
      }

      // ---------- 5 意思里夹着英语的那条；有一条查不到译文 ----------
      await E(p, () => { EchoGame.closeModal(); EchoGame.goHome('mon'); Object.assign(EchoGame.S.world.sight, { st: '', cv: [1, 0], zh: 0, steps: 0, need: 5 }); EchoGame.goHome('mon'); }); await W(p, 300);
      const s5 = await sightNow(p);
      const exp5 = zhUi ? ZH[FX.TOPIC] : FX.TOPIC;
      // （--real：译者可以给这句另写意思，只看有没有）
      check(s5.st === 'new' && s5.clues[0].t === T(FX.TOPIC) && (REAL ? !!s5.clues[0].mean : s5.clues[0].mean === exp5), '换一种说法（「那里的人见到谁都说……」）：译文照查；意思是' + (zhUi ? '线索自己的中文（里面夹着英语也照它的原样）' : '英语原文'), s5.clues[0]);
      // 原文说到「English」的那条（学科岛：People there love English, maths and science.）：译文里是在学的这门语言，
      // 下面那行意思走和台词一样的那条路（lineOf 的 courseWord）——上下两行说的是同一门语言，不是一行西班牙语、一行「英语」
      await E(p, () => { EchoGame.S.world.been.r4 = 1; Object.assign(EchoGame.S.world.sight, { map: 'r4', cv: [1, 0], zh: 0 }); EchoGame.goHome('mon'); }); await W(p, 300);
      const s7 = await sightNow(p), c7 = s7.clues[0] || {};
      const own7 = { es: 'español', ja: '日本語', zh: '中文' }[L], exp7 = zhUi ? '它在一座岛上，那里的人最喜欢' + NAMES[L].zh + '、数学和科学。' : 'It is on an island. People there love ' + NAMES[L].en + ', maths and science.';
      check(s7.st === 'new' && c7.t === T(FX.ENG) && c7.t.includes(own7) && c7.mean === exp7 && !/英语|English/.test(c7.mean), '原文说「English」的那条线索：译文说的是' + own7 + '，下面那行意思也是「' + NAME + '」（' + exp7 + '）', c7);
      await p.click('#mon-home .sight button.sg-zh >> nth=0').catch(() => {}); await W(p, 250);
      c = await card(p);
      check(!!c && c.zhTxt[0] === exp7 && noRt(c.html[0]) === T(FX.ENG), '……首页卡片上点开「译」看到的就是这一句', c && c.zhTxt);
      if (REAL) { await ctx.close(); continue; }   // 正式的翻译每一句都有：下面「查不到译文」的不测
      await E(p, () => { Object.assign(EchoGame.S.world.sight, { map: 'r0', cv: [0, 2], zh: 0 }); EchoGame.goHome('mon'); }); await W(p, 300);   // 回到 1 号路，第 3 条换成「它是绿色的」：小样里没翻
      const s6 = await sightNow(p);
      c = await card(p);
      check(s6.on && s6.st === 'off' && s6.clues.length === 0 && c === null, '今天有一条线索查不到译文：这一天按「没有目击」算——首页没有卡片（不显示半英半译）', { st: s6.st, card: c });
      await p.click('[data-act=wEnter]'); await W(p, 1200);
      await E(p, () => { Math.random = () => .99; });
      await E(p, () => document.querySelector('#world [data-act=wB]').click()); await W(p, 300);
      check(!(await p.$('#sheet [data-act=sgOpen]')) && !!(await p.$('#sheet [data-act=wQuests]')), '……冒险菜单里也没有那一行');
      await E(p, () => EchoGame.closeModal());
      await E(p, () => EchoWorld._debug().goMap('r0', 'from:t0')); await W(p, 1500);
      const b6 = await stand(p), n6 = b6 ? await pace(p, b6, 9) : -1;
      check(n6 === 0 && !/rare|稀有怪兽的气息/.test(await toasts(p)) && (await sightNow(p)).sg.steps === 0, '……进那张地图没有提示，草丛里走 9 步它不出来', n6);
      await ctx.close();
    }

    // ================= old 老的课程包：和以前一样不出 =================
    if (want('old')) {
      console.log('— old 老的课程包（LINES 里没有线索的译文）');
      const { ctx, p } = await openGame('packs-old');
      await p.evaluate(l => EchoPacks.install(l), 'es');
      await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('echo-island-v1'));
        Object.assign(s, { course: 'es', rev: undefined, stars: {}, talk: undefined, quests: undefined, log: undefined, place: { lang: 'es', lv: 1, auto: 1, talk: 1, adj: 0, know: 1, who: 'adult', at: '2026-11-20' } });
        Object.assign(s.settings, { track: 'level', ui: 'zh' });
        localStorage.setItem('echo-island-v1@es', JSON.stringify(s)); localStorage.setItem('echo-course', 'es');
      });
      await p.reload(); await homeUp(p);
      await monTab(p);
      const o = await E(p, () => ({ on: EchoSight.on(), st: EchoSight.state().st, card: !!document.querySelector('#mon-home .sight'), sight: JSON.stringify(EchoGame.S.world.sight || null) }));
      check(o.on === false && o.st === 'off' && !o.card, '老的课程包：今日目击照旧不出（首页没有卡片）', o);
      await p.click('[data-act=wEnter]'); await W(p, 1200);
      await E(p, () => { Math.random = () => .99; });
      await E(p, () => document.querySelector('#world [data-act=wB]').click()); await W(p, 300);
      check(!(await p.$('#sheet [data-act=sgOpen]')), '老的课程包：冒险菜单里没有「今日目击」那一行');
      await E(p, () => EchoGame.closeModal());
      await E(p, () => EchoWorld._debug().goMap('r0', 'from:t0')); await W(p, 1300);
      const b = await stand(p), n = b ? await pace(p, b, 9) : -1;
      const o2 = await E(p, () => ({ been: Object.keys(EchoGame.S.world.been || {}), sight: JSON.stringify(EchoGame.S.world.sight || null), map: EchoWorld._debug().M.id }));
      check(n === 0 && o2.map === 'r0' && !o2.been.length && o2.sight === o.sight, '老的课程包：走进 1 号路不记 been、不定目标，草丛里走 9 步什么都不出来（存档里的 sight 一个字没变）', o2);
      await ctx.close();
    }
  } catch (e) {
    console.log('✗ 出错：' + (e && e.stack || e));
    fails++;
  }
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  check(!cerr.length, '控制台没有错误' + (cerr.length ? '：' + cerr.slice(0, 3).join(' | ') : ''));
  await browser.close();
  web.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 临时文件夹 */ }
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
