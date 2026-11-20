// 课程包：浏览器里的那一半（tools/pack/SPEC.md §7，Playwright Chromium，约 1–2 分钟）：node tests/packs.test.js
// 自己起一个本机小网站：游戏文件 + /packs/（tools/pack/build.js --only 生成的小样，放在临时文件夹），能让某个文件 500、下坏一次、下到一半停住。
//   A 老模式（没有课程包地址）：完全不走这些代码——不开 echo-packs 数据库、不连 /packs/、照旧读 assets/voice、首页和设置里没有课程包的东西
//   B 装：首页那一条写着多大 → 点一下 → 一个个文件下完、进度、条消失；say() 真的放了课程包里的那段（blob:，和原来的 .ogg 一字不差）；
//     没装的句子照旧走兜底（[voice-miss]）；设置里那一页；英语界面没有中文；重新打开还在、不重下
//   C core 好了就能放：后面的还在下时 core 的句子已经能放、后面的还不能；下到一半关掉页面（杀进程）→ 再打开自己接着下，下完的不重下
//   D 暂停：暂停以后重新打开不自己接着下；点「接着下」下完
//   E crc 坏了：这个文件重下；一直连不上：重试 3 次以后停下、首页说清楚，「再试一次」下完
//   F 删掉：孩子模式要家长密码；「自己学」确认以后删干净（数据库里一段都不剩），朗读回到兜底
//   G 空间不够：不下，说还差多少
//   H IndexedDB 打不开：store = 'none'，首页说一句，朗读照兜底走，不报错
//   I 全新的开始：能力检测「选语言」之后是「下载课程」页，core 下完才能「继续」，然后到「谁在学」；IndexedDB 打不开时能「先不下，继续」
//   J 有新版本：只提示、不自己更新；点了才更新，下齐了换上新版本、删掉旧版本多出来的段
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'tools', 'pack', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const CJK = /[　-〿㐀-䶿一-鿿＀-￯]/;
// --only=BC 只跑这几段
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).toUpperCase();
const want = s => !ONLY || ONLY.includes(s);

// ---------- 小样：v1 = 前 30 句，v2 = 前 28 句（更新时少了两句，要删掉） ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-packs-web-'));
const V1 = '20261120.1', V2 = '20261120.2';
const bargs = (ver, only) => B.args(['--lang', 'en', '--ver', ver, '--only', String(only), '--bundle', '40000', '--core', '60000', '--out', TMP, '--quiet']);
B.build(bargs(V1, 30));
B.catalog(B.args(['--catalog', '--out', TMP]));
const CAT1 = fs.readFileSync(path.join(TMP, 'catalog.json'), 'utf8');
B.build(bargs(V2, 28));
B.catalog(B.args(['--catalog', '--out', TMP]));
const CAT2 = fs.readFileSync(path.join(TMP, 'catalog.json'), 'utf8');
const man = v => JSON.parse(fs.readFileSync(path.join(TMP, 'en', v, 'manifest.json'), 'utf8'));
const M1 = man(V1), M2 = man(V2);
const itemsOf = (v, f) => PK.readBundle(fs.readFileSync(path.join(TMP, 'en', v, f.name))).items;
const TEXT = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'voice', 'lines.json'), 'utf8')).map(e => [key(e.t), e.t]));
const core1 = M1.files.filter(f => f.core), late1 = M1.files.filter(f => !f.core);
const coreItem = itemsOf(V1, core1[0]).find(it => it[0] === 'f'), lateItem = itemsOf(V1, late1[late1.length - 1]).find(it => it[0] === 'f');
const CORE_T = TEXT.get(coreItem[1]), LATE_T = TEXT.get(lateItem[1]);
const ALL1 = M1.files.flatMap(f => itemsOf(V1, f)), ALL2 = M2.files.flatMap(f => itemsOf(V2, f));
const GONE = ALL1.filter(a => !ALL2.some(b => a[0] === b[0] && a[1] === b[1]));
const rel = (v, f) => 'en/' + v + '/' + (f.name || f);
console.log('  小样：v1 ' + M1.files.length + ' 个包（core ' + core1.length + '）' + ALL1.length + ' 段；v2 ' + ALL2.length + ' 段，少了 ' + GONE.length + ' 段');

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const SRV = { hits: {}, fail: {}, corrupt: {}, hold: {}, held: [], cat: CAT1 };
const server = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  SRV.hits[u] = (SRV.hits[u] || 0) + 1;
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(body); };
  if (u.startsWith('/packs/')) {
    const r = u.slice(7);
    if (SRV.fail[r] > 0) { SRV.fail[r]--; return send(500, ''); }
    if (r === 'catalog.json') return send(200, SRV.cat, MIME.json);
    const file = path.join(TMP, r);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    let body = fs.readFileSync(file);
    if (SRV.corrupt[r] > 0) { SRV.corrupt[r]--; body = Buffer.from(body); body[body.length >> 1] ^= 0xff; }
    if (SRV.hold[r] > 0) {   // 先发一半，剩下的等放行（release）
      SRV.hold[r]--;
      res.writeHead(200, { 'Content-Type': MIME.bin, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
      res.write(body.subarray(0, body.length >> 1));
      SRV.held.push(() => { try { res.end(body.subarray(body.length >> 1)); } catch (e) { /* 页面已经关了 */ } });
      return;
    }
    return send(200, body, MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});
const release = () => { const h = SRV.held.splice(0); h.forEach(f => f()); };
const hits = r => SRV.hits['/packs/' + r] || 0;
const resetSrv = () => { SRV.hits = {}; SRV.fail = {}; SRV.corrupt = {}; SRV.hold = {}; release(); SRV.cat = CAT1; };

// 测试存档：有进度（不进能力检测）、看过说明、口语自评、发音只用配音（没有阿里云、没有本机声音）、不放音乐
const SAVE = learner => ({
  seenIntro: true, coins: 500, micCheck: 'x',
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  // echo.localhost（Chromium 认 *.localhost 是本机）：不是 localhost / 127.0.0.1，talk.js 就不去猜本机 8787 的中转服务——
  // 没装的句子不会去请阿里云现场合成（不花钱），照兜底走到 [voice-miss]。课程包地址用同一个网站里的路径 /packs
  const BASE = 'http://echo.localhost:' + server.address().port, PACKS = '/packs';
  const browser = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  async function newCtx(o) {
    o = o || {};
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    if (o.save !== false) await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(SAVE(o.learner || 'open')));
    if (o.init) await ctx.addInitScript(o.init);
    // 放了哪一段：记下 play() 时的地址和成没成
    await ctx.addInitScript(() => {
      window.__plays = [];
      const p0 = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { const r = p0.call(this), it = { src: this.src, ok: null }; window.__plays.push(it); if (r && r.then) r.then(() => { it.ok = true; }, e => { it.ok = String(e && e.name); }); return r; };
    });
    return ctx;
  }
  async function openPage(ctx, query, o) {
    o = o || {};
    const p = await ctx.newPage();
    p.setDefaultTimeout(8000);
    p.logs = [];
    p.on('console', m => p.logs.push(m.text()));
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message); });
    await p.goto(BASE + '/index.html' + (query || ''));
    if (o.home !== false) await p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 20000 });
    return p;
  }
  const info = p => p.evaluate(() => EchoPacks.info('en'));
  const waitState = (p, st, ms) => p.waitForFunction(s => EchoPacks.info('en').state === s && !EchoPacks.info('en').busy, st, { timeout: ms || 20000 }).then(() => true, () => false);
  const idbCount = p => p.evaluate(() => new Promise(res => {
    const r = indexedDB.open('echo-packs');
    r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('clip')) { d.close(); return res(-1); } const c = d.transaction('clip').objectStore('clip').count(IDBKeyRange.bound('en/', 'en/' + String.fromCharCode(0xffff))); c.onsuccess = () => { d.close(); res(c.result); }; };
    r.onerror = () => res(-2);
  }));
  // say() 以后放的是不是课程包里那段：blob: 地址，内容和原来的 .ogg 一字不差
  const sayIt = (p, text, g) => p.evaluate(async ([t, g]) => {
    const n = window.__plays.length;
    await Promise.race([EchoGame.say(t, 1, g), new Promise(r => setTimeout(r, 6000))]);
    const it = window.__plays[n] || null;
    let same = null;
    if (it && it.src.startsWith('blob:')) {
      try {
        const a = new Uint8Array(await (await fetch(it.src)).arrayBuffer());
        const b = new Uint8Array(await (await fetch('/assets/voice/' + (g || 'f') + '/' + window.__key + '.ogg')).arrayBuffer());
        same = a.length === b.length && a.every((x, i) => x === b[i]);
      } catch (e) { same = 'err ' + e.message; }
    }
    return { src: it ? it.src : '', ok: it ? it.ok : null, same };
  }, [text, g || 'f']);
  const sayKey = async (p, text, k, g) => { await p.evaluate(k => { window.__key = k; }, k); return sayIt(p, text, g); };
  const missed = (p, text) => p.logs.some(l => l.startsWith('[voice-miss]') && l.includes(JSON.stringify(text).slice(1, -1)));
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'packs-' + name + '.png') });

  try {
    // ================= A 老模式 =================
    console.log('— A 老模式（没有课程包地址）');
    if (want('A')) {
      resetSrv();
      const ctx = await newCtx(), p = await openPage(ctx, '');
      await p.waitForTimeout(600);
      const a = await p.evaluate(async () => ({
        on: EchoPacks.on, store: EchoPacks.store, base: EchoPacks.base, dbs: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : null,
        bar: !!document.querySelector('#pk-bar'), acts: !!document.querySelector('[data-act^=pk]'), ready: await Promise.race([EchoPacks.ready().then(() => 'now'), new Promise(r => setTimeout(() => r('late'), 50))]),
      }));
      check(a.on === false && a.store === '' && a.base === '' && a.ready === 'now', '老模式：EchoPacks.on 是 false，ready() 立刻好，数据库没打开', a);
      check(Array.isArray(a.dbs) && !a.dbs.includes('echo-packs'), '老模式：没有建 echo-packs 数据库', a.dbs);
      check(!Object.keys(SRV.hits).some(u => u.startsWith('/packs/')) && SRV.hits['/assets/voice/index.json'] >= 1, '老模式：一次都没连 /packs/，照旧读 assets/voice/index.json');
      await p.waitForFunction(() => true);
      const r = await sayKey(p, CORE_T, coreItem[1]);
      check(r.src.endsWith('/assets/voice/f/' + coreItem[1] + '.ogg'), '老模式：say() 放的还是安装包里的 assets/voice/f/<key>.ogg', r);
      check(!a.bar && !a.acts, '老模式：首页没有课程包那一条');
      await p.evaluate(() => EchoGame.T.settings());
      check(!(await p.$('#set-packs')) && !(await p.$('[data-act=pkSet]')), '老模式：设置里没有「📦 课程和语音包」');
      await ctx.close();
    }

    // ================= B 装 =================
    console.log('— B 装、放、重新打开');
    if (want('B')) {
      resetSrv();
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      const s0 = await p.evaluate(() => ({ on: EchoPacks.on, base: EchoPacks.base, store: EchoPacks.store, st: EchoPacks.state('en'), course: EchoPacks.course(), ls: localStorage.getItem('echo-packs-url') }));
      check(s0.on && s0.base === PACKS && s0.store === 'idb' && s0.st === 'none' && s0.course === 'en' && s0.ls === PACKS, '?packs=<地址>：课程包模式，地址记进 localStorage，数据库打开了，英语还没装', s0);
      const sv = await p.evaluate(() => ({ coins: EchoGame.S.coins, seen: EchoGame.S.seenIntro, ls: JSON.parse(localStorage.getItem('echo-island-v1')).coins, place: !!document.querySelector('#place') }));
      check(sv.coins === 500 && sv.seen === true && sv.ls === 500 && !sv.place, '等 ready() 的时候存档没被空白的盖掉（读到的是测试存档，没进能力检测）', sv);
      const mb = M1.files.reduce((s, f) => s + f.bytes, 0) / 1048576;
      await p.waitForFunction(() => /MB/.test((document.querySelector('#pk-bar') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
      const bar = await p.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/下载英语语音包（0\.\d MB）/.test(bar) && mb > 0, '首页一条：「📦 下载英语语音包（x MB）」（还没点不下载）', bar);
      check(!Object.keys(SRV.hits).some(u => /\.bin$/.test(u)), '没点之前一个配音包都没下（第一次下载要人点一下）');
      await shot(p, 'home-bar');
      await p.evaluate(() => { window.__pkp = []; EchoPacks.on_('progress', d => window.__pkp.push([d.done, d.bytes])); });
      await p.click('#pk-bar');
      const full = await waitState(p, 'full');
      const i = await info(p);
      check(full && i.done === i.bytes && i.bytes === M1.files.reduce((s, f) => s + f.bytes, 0) && i.ver === V1 && !i.err, '点一下：全部下完（' + M1.files.length + ' 个包）', i);
      check(M1.files.every(f => hits(rel(V1, f)) === 1) && hits(rel(V1, 'manifest.json')) === 1, '每个包只下了一次，manifest 一次', M1.files.map(f => hits(rel(V1, f))));
      const pr = await p.evaluate(() => window.__pkp);
      check(pr.length >= M1.files.length && pr[pr.length - 1][0] === pr[pr.length - 1][1], '有下载进度（' + pr.length + ' 次），最后到 100%');
      const has = await p.evaluate(all => all.map(([g, k]) => EchoPacks.hasClip(k, g)), ALL1);
      check(has.every(Boolean), 'hasClip：小样里的 ' + ALL1.length + ' 段都装好了');
      check(await idbCount(p) === ALL1.length, '数据库里一段一条（' + ALL1.length + ' 条）');
      await p.waitForTimeout(300);
      check(!(await p.$('#pk-bar')), '装好了：首页那一条没了（不占地方）');
      const r = await sayKey(p, CORE_T, coreItem[1]);
      check(r.src.startsWith('blob:') && r.same === true && r.ok === true, 'say() 真的放了课程包里的那段（blob: 地址，和原来的 .ogg 一字不差，play() 成功）', r);
      check(!missed(p, CORE_T), '这句不算漏配音');
      const other = 'This line is not in the small test pack.';
      const r2 = await sayIt(p, other);
      check(!r2.src.startsWith('blob:') && missed(p, other), '小样里没有的句子：照旧走兜底（[voice-miss] 记下来）', r2);
      // 设置里的那一页
      await p.evaluate(() => EchoGame.T.settings());
      const row = await p.evaluate(() => (document.querySelector('#set-packs') || {}).textContent || '');
      check(/课程和语音包/.test(row) && /英语/.test(row) && /已装好/.test(row), '设置里「📦 课程和语音包」：英语 · 已装好', row);
      await p.click('[data-act=pkSet]');
      const sh = await p.evaluate(() => (document.querySelector('#pk-sheet') || {}).textContent || '');
      check(/现在学：英语/.test(sh) && /已装好/.test(sh) && /删除/.test(sh) && /一共占了/.test(sh), '「📦 课程和语音包」那一页：现在学的语言、状态、大小、删除、占了多少', sh);
      await shot(p, 'sheet-zh');
      await p.click('#pk-sheet [data-act=setBack]');
      check(!!(await p.$('#set-packs')), '「完成」回到设置');
      await p.evaluate(() => { EchoGame.S.settings.ui = 'en'; EchoI18n.set('en'); EchoPacks.sheet(); });
      const en = await p.evaluate(() => document.querySelector('#pk-sheet').innerText);
      check(!CJK.test(en) && /Installed/.test(en) && /Learning now: English/.test(en), '英语界面：那一页没有中文', en);
      await shot(p, 'sheet-en');
      await p.evaluate(() => { EchoGame.S.settings.ui = 'zh'; EchoI18n.set('zh'); EchoGame.closeModal(); });
      // 重新打开（同一个浏览器）：还在，不重下
      await p.close();
      const p2 = await openPage(ctx, '');
      const s2 = await p2.evaluate(() => ({ on: EchoPacks.on, st: EchoPacks.state('en') }));
      const has2 = await p2.evaluate(k => EchoPacks.hasClip(k, 'f'), coreItem[1]);
      await p2.waitForTimeout(500);
      check(s2.on && s2.st === 'full' && has2 && M1.files.every(f => hits(rel(V1, f)) === 1), '重新打开（网址不带 ?packs）：还是课程包模式、已装好、一个包都没重下', s2);
      const r3 = await sayKey(p2, CORE_T, coreItem[1]);
      check(r3.src.startsWith('blob:') && r3.same === true, '重新打开以后 say() 照样放课程包里的', r3);
      await ctx.close();
    }

    // ================= C core 好了就能放、杀进程以后接着下 =================
    console.log('— C core 好了就能放、关掉页面以后接着下');
    if (want('C')) {
      resetSrv();
      const heldFile = late1[late1.length - 1];
      SRV.hold[rel(V1, heldFile)] = 1;
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.evaluate(() => { EchoPacks.install('en'); });   // 不等它（停在最后一个包）
      const coreOk = await p.waitForFunction(() => EchoPacks.state('en') === 'core', null, { timeout: 15000 }).then(() => true, () => false);
      await p.waitForFunction(() => EchoPacks.info('en').busy, null, { timeout: 3000 }).catch(() => {});
      const st = await p.evaluate(([c, l]) => ({ c: EchoPacks.hasClip(c, 'f'), l: EchoPacks.hasClip(l, 'f'), i: EchoPacks.info('en') }), [coreItem[1], lateItem[1]]);
      check(coreOk && st.c && !st.l && st.i.busy && st.i.coreDone === st.i.core, 'core 下完：core 的句子已经装好，最后那个包还在下', st);
      const r = await sayKey(p, CORE_T, coreItem[1]);
      check(r.src.startsWith('blob:') && r.same === true, 'core 好了就能放：say() 放的是课程包里的', r);
      const r2 = await sayIt(p, LATE_T);
      check(!r2.src.startsWith('blob:') && missed(p, LATE_T), '还没下到的句子：照兜底走', r2);
      await p.waitForTimeout(300);
      const barTxt = await p.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/正在下载英语语音包 \d+%/.test(barTxt), '首页那一条显示下载进度', barTxt);
      await shot(p, 'downloading');
      await p.close();   // 杀进程
      release();
      const before = M1.files.map(f => hits(rel(V1, f)));
      const p2 = await openPage(ctx, '');
      const full = await waitState(p2, 'full');
      const after = M1.files.map(f => hits(rel(V1, f)));
      check(full && M1.files.every((f, i) => f === heldFile ? after[i] === before[i] + 1 : after[i] === before[i] && after[i] === 1),
        '再打开：自己接着下，只重下没做完的那个包，下完的不重下', { before, after });
      check(hits(rel(V1, 'manifest.json')) === 1, '接着下用记下的文件表，不再要 manifest');
      check(await p2.evaluate(l => EchoPacks.hasClip(l, 'f'), lateItem[1]) && await idbCount(p2) === ALL1.length, '接着下完：后面的句子也装好了，数据库里一段不多一段不少');
      await ctx.close();
    }

    // ================= D 暂停 =================
    console.log('— D 暂停');
    if (want('D')) {
      resetSrv();
      const heldFile = late1[0];
      SRV.hold[rel(V1, heldFile)] = 1;
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.waitForFunction(() => /MB/.test((document.querySelector('#pk-bar') || {}).textContent || ''), null, { timeout: 8000 });
      await p.click('#pk-bar');
      await p.waitForFunction(() => EchoPacks.state('en') === 'core', null, { timeout: 15000 });
      await p.waitForTimeout(300);
      await p.click('#pk-bar');   // 正在下：点了打开那一页
      await p.waitForSelector('#pk-sheet [data-act=pkPause]');
      await shot(p, 'sheet-busy');
      await p.click('#pk-sheet [data-act=pkPause]');
      const paused = await p.waitForFunction(() => EchoPacks.info('en').paused && !EchoPacks.info('en').busy, null, { timeout: 5000 }).then(() => true, () => false);
      check(paused, '暂停：停下来了');
      // 按钮那一下的「记下来」是异步写进数据库的：再叫一次 pause() 等它写完（一样的结果），免得马上关页面时还没写进去
      check(await p.evaluate(() => EchoPacks.pause('en')) === true, '暂停记进数据库了');
      release();
      await p.close();
      const n0 = M1.files.map(f => hits(rel(V1, f)));
      const p2 = await openPage(ctx, '');
      await p2.waitForTimeout(1200);
      const i2 = await info(p2);
      check(i2.paused && i2.state !== 'full' && !i2.busy && JSON.stringify(M1.files.map(f => hits(rel(V1, f)))) === JSON.stringify(n0), '暂停以后重新打开：不自己接着下', i2);
      const bar = await p2.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/暂停了/.test(bar), '首页那一条：暂停了（x%）', bar);
      await p2.click('#pk-bar');   // 暂停了：点一下接着下
      check(await waitState(p2, 'full'), '点「接着下」：下完');
      await ctx.close();
    }

    // ================= E crc 坏了重下、一直连不上 =================
    console.log('— E crc 坏了、连不上');
    if (want('E')) {
      resetSrv();
      const bad = late1[0];
      SRV.corrupt[rel(V1, bad)] = 1;
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.evaluate(() => EchoPacks._.RETRY.splice(0, 3, 50, 100, 150));
      await p.evaluate(() => EchoPacks.install('en'));
      const full = await waitState(p, 'full');
      const it = itemsOf(V1, bad).find(x => x[0] === 'f');
      const r = it ? await sayKey(p, TEXT.get(it[1]), it[1]) : { same: true };
      check(full && hits(rel(V1, bad)) === 2 && M1.files.every(f => f === bad || hits(rel(V1, f)) === 1) && r.same === true, 'crc 对不上：这个包重下了一次，装进去的是好的', { hits: hits(rel(V1, bad)), r });
      await ctx.close();
    }
    if (want('E')) {
      resetSrv();
      const bad = late1[late1.length - 1];
      SRV.fail[rel(V1, bad)] = 99;
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.evaluate(() => EchoPacks._.RETRY.splice(0, 3, 50, 100, 150));
      const ok = await p.evaluate(() => EchoPacks.install('en'));
      const i = await info(p);
      check(ok === false && i.err && i.err.code === 'net' && i.state === 'core' && !i.busy && hits(rel(V1, bad)) === 4, '一直连不上：试了 1 + 3 次就停下，记下「没网」，core 照样能用', { i, n: hits(rel(V1, bad)) });
      await p.waitForTimeout(200);
      const bar = await p.evaluate(() => { const b = document.querySelector('#pk-bar'); return b ? { t: b.textContent, warn: b.classList.contains('warn') } : null; });
      check(!!bar && bar.warn && /没下完/.test(bar.t) && /联网/.test(bar.t) && /再试一次/.test(bar.t), '首页那一条说清楚：没下完、联网以后再试', bar);
      await shot(p, 'error');
      SRV.fail = {};
      await p.click('#pk-bar');
      check(await waitState(p, 'full'), '「再试一次」：下完');
      await ctx.close();
    }

    // ================= F 删掉 =================
    console.log('— F 删掉');
    if (want('F')) {
      resetSrv();
      const ctx = await newCtx({ learner: 'kid' }), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.evaluate(() => EchoPacks.install('en'));
      check(await waitState(p, 'full'), '先装好');
      await p.evaluate(() => EchoGame.T.settings());
      await p.click('[data-act=pkSet]');
      await p.click('#pk-sheet [data-act=pkDel]');
      await p.waitForTimeout(300);
      const pin = await p.evaluate(() => !!document.querySelector('#pin-pad') && !document.querySelector('[data-act=pkDelGo]'));
      check(pin && await p.evaluate(() => EchoPacks.state('en')) === 'full', '孩子模式：删除要家长密码（弹出数字键盘，还没删）');
      await p.evaluate(() => { EchoGame.closeModal(); EchoGame.S.settings.learner = 'open'; });
      await p.evaluate(() => EchoGame.T.settings());
      await p.click('[data-act=pkSet]');
      await p.click('#pk-sheet [data-act=pkDel]');
      await p.waitForSelector('[data-act=pkDelGo]');
      await shot(p, 'delete-ask');
      await p.click('[data-act=pkDelGo]');
      const gone = await p.waitForFunction(() => EchoPacks.state('en') === 'none' && !EchoPacks.info('en').busy, null, { timeout: 8000 }).then(() => true, () => false);
      const n = await idbCount(p);
      const meta = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('echo-packs'); r.onsuccess = () => { const d = r.result, q = d.transaction('meta').objectStore('meta').get('en'); q.onsuccess = () => { d.close(); res(q.result === undefined); }; }; }));
      check(gone && n === 0 && meta && !(await p.evaluate(k => EchoPacks.hasClip(k, 'f'), coreItem[1])), '「自己学」：确认以后删干净（数据库里英语一段都不剩、meta 也没了）', { n, meta });
      const r = await sayKey(p, CORE_T, coreItem[1]);
      check(!r.src.startsWith('blob:') && missed(p, CORE_T), '删掉以后朗读回到兜底', r);
      await p.evaluate(() => EchoGame.closeModal());
      await p.waitForTimeout(200);
      check(/下载英语语音包/.test(await p.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '')), '首页那一条又回来了（下载）');
      await ctx.close();
    }

    // ================= G 空间不够 =================
    console.log('— G 空间不够');
    if (want('G')) {
      resetSrv();
      const ctx = await newCtx({ init: () => { Object.defineProperty(StorageManager.prototype, 'estimate', { configurable: true, value: () => Promise.resolve({ quota: 20000, usage: 5000 }) }); } });
      const p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      const ok = await p.evaluate(() => EchoPacks.install('en'));
      const i = await info(p);
      const need = Math.round(M1.files.reduce((s, f) => s + f.bytes, 0) * 1.2);
      check(ok === false && i.err && i.err.code === 'space' && i.err.free === 15000 && i.err.need === need && !Object.keys(SRV.hits).some(u => /\.bin$/.test(u)), '空间不够：一个包都不下，记下要多少、有多少', i.err);
      await p.waitForTimeout(200);
      const bar = await p.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/空间不够：还差 0\.\d MB/.test(bar), '首页那一条说还差多少', bar);
      await ctx.close();
    }

    // ================= H IndexedDB 打不开 =================
    console.log('— H IndexedDB 打不开');
    if (want('H')) {
      resetSrv();
      const ctx = await newCtx({ init: () => { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return { open() { throw new DOMException('blocked for the test', 'InvalidStateError'); } }; } }); } });
      const p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      const s = await p.evaluate(() => ({ store: EchoPacks.store, st: EchoPacks.state('en') }));
      check(s.store === 'none' && s.st === 'none', 'IndexedDB 打不开：EchoPacks.store 是 none，游戏照样开起来', s);
      await p.waitForTimeout(200);
      const bar = await p.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/存不了语音包/.test(bar), '首页说一句：这台设备存不了语音包', bar);
      const r = await sayIt(p, CORE_T);
      check(!r.src.startsWith('blob:') && missed(p, CORE_T), '朗读照兜底走', r);
      const ok = await p.evaluate(() => EchoPacks.install('en'));
      check(ok === false && (await info(p)).err.code === 'store' && !Object.keys(SRV.hits).some(u => /\.bin$/.test(u)), 'install() 不下，记下 store');
      await p.evaluate(() => EchoGame.T.settings());
      check(/存不了语音包/.test(await p.evaluate(() => document.querySelector('#set-packs').textContent)), '设置里那一行也说清楚');
      await ctx.close();
    }

    // ================= I 全新的开始 =================
    console.log('— I 全新的开始：选语言之后的「下载课程」页');
    if (want('I')) {
      resetSrv();
      const ctx = await newCtx({ save: false }), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS), { home: false });
      await p.waitForSelector('#pl-box[data-step=lang]', { timeout: 20000 });
      await p.click('[data-act=plGo][data-to=who]');
      await p.waitForSelector('#pl-box[data-step=pack] #pk-first');
      await p.waitForSelector('#pl-box [data-act=pkFirstGet]:not([disabled])');
      const t0 = await p.evaluate(() => document.querySelector('#pl-box').innerText);
      check(/下载英语课程/.test(t0) && /MB/.test(t0) && !(await p.$('[data-act=pkFirstGo]:not([disabled])')), '选了语言 →「下载英语课程」：写着多大，还没下时不能「继续」', t0);
      await shot(p, 'first-0');
      SRV.hold[rel(V1, late1[0])] = 1;
      await p.click('[data-act=pkFirstGet]');
      await p.waitForSelector('#pl-box [data-act=pkFirstGo]:not([disabled])', { timeout: 15000 });
      const t1 = await p.evaluate(() => ({ t: document.querySelector('#pl-box').innerText, st: EchoPacks.state('en'), busy: EchoPacks.info('en').busy }));
      check(t1.st === 'core' && t1.busy && /可以开始了/.test(t1.t), 'core 下完就能「继续」，其余在后台下', t1);
      await shot(p, 'first-1');
      await p.click('[data-act=pkFirstGo]');
      await p.waitForSelector('#pl-box[data-step=who]');
      check(true, '「继续」→ 谁在学');
      release();
      check(await waitState(p, 'full'), '后台接着下完');
      await p.click('#pl-box [data-act=plGo][data-to=lang]');
      await p.waitForSelector('#pl-box[data-step=lang]');
      await p.click('[data-act=plGo][data-to=who]');
      await p.waitForSelector('#pl-box[data-step=who]');
      check(true, '已经装好了：选语言以后直接到「谁在学」（没有下载页）');
      await ctx.close();
    }
    if (want('I')) {
      resetSrv();
      const ctx = await newCtx({ save: false, init: () => { Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return { open() { throw new Error('no'); } }; } }); } });
      const p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS), { home: false });
      await p.waitForSelector('#pl-box[data-step=lang]', { timeout: 20000 });
      await p.click('[data-act=plGo][data-to=who]');
      await p.waitForSelector('#pk-first [data-act], #pl-box [data-act=pkFirstSkip]');
      const t = await p.evaluate(() => document.querySelector('#pl-box').innerText);
      check(/存不了语音包/.test(t) && !!(await p.$('[data-act=pkFirstSkip]')), 'IndexedDB 打不开：下载页说清楚，能「先不下，继续」', t);
      await p.click('[data-act=pkFirstSkip]');
      await p.waitForSelector('#pl-box[data-step=who]');
      check(true, '「先不下，继续」→ 谁在学');
      await ctx.close();
    }
    if (want('I')) {
      resetSrv();
      const ctx = await newCtx({ save: false }), p = await openPage(ctx, '', { home: false });
      await p.waitForSelector('#pl-box[data-step=lang]', { timeout: 20000 });
      await p.click('[data-act=plGo][data-to=who]');
      await p.waitForSelector('#pl-box[data-step=who]');
      check(!(await p.$('#pk-first')), '老模式的全新开始：选语言以后照旧直接到「谁在学」');
      await ctx.close();
    }

    // ================= J 有新版本 =================
    console.log('— J 有新版本');
    if (want('J')) {
      resetSrv();
      const ctx = await newCtx(), p = await openPage(ctx, '?packs=' + encodeURIComponent(PACKS));
      await p.evaluate(() => EchoPacks.install('en'));
      check(await waitState(p, 'full') && (await info(p)).ver === V1, '先装好 v1');
      SRV.cat = CAT2;
      await p.close();
      const p2 = await openPage(ctx, '');
      await p2.waitForFunction(() => EchoPacks.info('en').update, null, { timeout: 8000 }).catch(() => {});
      await p2.waitForTimeout(800);
      const i = await info(p2);
      check(i.update && i.ver === V1 && i.state === 'full' && !i.busy && !M2.files.some(f => hits(rel(V2, f))), '目录里有新版本：info().update，只提示、不自己更新', i);
      const bar = await p2.evaluate(() => (document.querySelector('#pk-bar') || {}).textContent || '');
      check(/有新版本/.test(bar), '首页那一条：有新版本', bar);
      await p2.click('#pk-bar');
      await p2.waitForSelector('#pk-sheet [data-act=pkGet]');
      check(/更新/.test(await p2.evaluate(() => document.querySelector('#pk-sheet [data-act=pkGet]').textContent)), '那一页有「更新」按钮');
      await p2.click('#pk-sheet [data-act=pkGet]');
      const done = await p2.waitForFunction(v => EchoPacks.info('en').ver === v && EchoPacks.state('en') === 'full' && !EchoPacks.info('en').busy, V2, { timeout: 20000 }).then(() => true, () => false);
      const has = await p2.evaluate(([gone, keep]) => ({ gone: gone.map(([g, k]) => EchoPacks.hasClip(k, g)), keep: keep.map(([g, k]) => EchoPacks.hasClip(k, g)) }), [GONE, ALL2]);
      check(done && has.gone.every(x => !x) && has.keep.every(Boolean) && await idbCount(p2) === ALL2.length, '点了更新：新版本下齐了换上，旧版本多出来的 ' + GONE.length + ' 段删掉了', has);
      check(!(await info(p2)).update, '更新完：不再提示');
      await ctx.close();
    }
    // ================= K 数据库开得慢 =================
    console.log('— K IndexedDB 开得慢（1.5 秒）：等的时候首页藏着、不存档');
    if (want('K')) {
      resetSrv();
      const ctx = await newCtx({ init: () => {
        const o0 = IDBFactory.prototype.open;
        IDBFactory.prototype.open = function () {
          const r = o0.apply(this, arguments);
          let h = null;
          Object.defineProperty(r, 'onsuccess', { configurable: true, get() { return h; }, set(f) { h = f; } });
          r.addEventListener('success', e => setTimeout(() => { if (h) h.call(r, e); }, 1500));
          return r;
        };
      } });
      const p = await ctx.newPage();
      p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message); });
      await p.goto(BASE + '/index.html?packs=' + encodeURIComponent(PACKS));
      await p.waitForTimeout(700);
      const mid = await p.evaluate(() => ({ home: !document.getElementById('home').hidden, ls: JSON.parse(localStorage.getItem('echo-island-v1')).coins }));
      await p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 20000 });
      const end = await p.evaluate(() => ({ coins: EchoGame.S.coins, seen: EchoGame.S.seenIntro, ls: JSON.parse(localStorage.getItem('echo-island-v1')).coins, store: EchoPacks.store }));
      check(!mid.home && mid.ls === 500, '还在等数据库：首页藏着，存档没被动过', mid);
      check(end.coins === 500 && end.seen && end.ls === 500 && end.store === 'idb', '数据库开好以后：读的是原来的存档，首页出来了', end);
      await ctx.close();
    }
  } catch (e) {
    check(false, '跑到一半出错：' + (e && e.stack || e));
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  check(!errs.length, '页面上没有没接住的错误', errs.slice(0, 5));
  console.log(fails ? '\n✗ ' + fails + ' 项没过' : '\n全部通过');
  process.exit(fails ? 1 : 0);
})();
