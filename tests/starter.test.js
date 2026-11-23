// 一步一步学：单词小课（tools/course/STARTER.md，2026-11-24 老板：「完全没基础的情况下有点难学……可以让人真的从 0 开始学」）
//   node tests/starter.test.js            Playwright Chromium，约 1–2 分钟；自己起本机小网站（英语课，老模式）
// 查什么：
//   1 没开的存档：卡片上没有那一排，点第 1 关照旧直接开考
//   2 开着（settings.starter）：卡片上「🌱 一步一步学 ① ② ③ ④」（只能点下一节）；点第 1 关先问「先一步一步学」→ 先看「这一课学什么」→ 第 1 节小课
//   3 一节的步骤：每个词先教（教学卡，自动念）再认（第 1 个词两个里选）→ 听音选意思 → 看意思选词 → 跟读 → 小测；每个新词出现 5 次以上
//   4 规矩：没有红心；选错了不扣心、不记错题、过两题再问一次；跟读两次没读准就往下走、不记错题
//   5 学完一节：进度、这一节的词明天进每日复习、结算页；第 2 节开头复习上一节的词、不再弹「这一课学什么」
//   6 四节都学完：结算页「开始闯关」，第 1 关不再弹单词卡、不再问；13 个词的岛分成 3 + 3 + 3 + 4
//   7 「我学过了，直接闯关」：照常开考，这一课以后不再问
//   8 设置里的开关；新手路线里那一步换成「上小课」
//   9 英语界面这几个画面没有中文；横屏按钮在屏幕里
// 截图 tests/screenshots/starter-*.png
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const CJK = /[぀-ヿ㐀-鿿]/;
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TOMORROW = ymd(new Date(Date.now() + 864e5));
const PORT = { width: 390, height: 844 }, LAND = { width: 844, height: 390 };

const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', txt: 'text/plain' };
const web = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});
// 测试存档：有进度（不进能力检测）、看过说明、口语自评、发音只用配音、不放音乐、自己学、单词卡关着；starter 另给
const SAVE = o => Object.assign({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120, homeTab: 'quiz',
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
  book: { at: 0, mix: 0.6, view: 'isle', vb: '' }, stars: {}, rev: { v: 1, items: {} },
}, o || {}, { settings: Object.assign({ tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh', cards: false }, (o && o.settings) || {}) });

(async () => {
  await new Promise(r => web.listen(0, '127.0.0.1', r));
  const BASE = 'http://echo.localhost:' + web.address().port;
  const browser = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  const W = (p, ms) => p.waitForTimeout(ms);
  const E = (p, f, a) => p.evaluate(f, a);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'starter-' + name + '.png') });
  const act = (p, a, extra) => E(p, ([a, extra]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra || {}); document.body.appendChild(b); b.click(); b.remove(); }, [a, extra || null]);
  const modalText = p => E(p, () => (document.getElementById('modal').hidden ? '' : document.getElementById('sheet').innerText));
  const inView = (p, sel) => E(p, sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0; }, sel);
  async function openGame(save, view) {
    const ctx = await browser.newContext({ viewport: view || PORT, deviceScaleFactor: 2 });
    await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; return /(^|\.)localhost$|^127\.0\.0\.1$/.test(h) ? r.continue() : r.abort(); });
    await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(save));
    await ctx.addInitScript(() => { window.__plays = []; const p0 = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push(decodeURIComponent(this.src)); return p0.call(this); }; });
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
    await p.goto(BASE + '/index.html');
    await homeUp(p);
    return { ctx, p };
  }
  const quiz = async p => { await E(p, () => { EchoGame.S.homeTab = 'quiz'; EchoGame.goHome('quiz'); }); await W(p, 300); };
  // 现在这一步
  const cur = p => E(p, () => {
    const P = EchoGame.P();
    return P && P.q && !document.getElementById('play').hidden ? { t: P.q.type, i: P.q.i, idx: P.idx, total: P.total, answered: !!P.answered, hearts: P.hearts, mini: P.mini ? P.mini.k : null, n: (P.q.opts || []).length, ok: (P.q.opts || []).findIndex(o => o.c), again: P.q.again || 0 } : null;
  });
  const steps = p => E(p, () => EchoGame.P().qs.map(q => q.type + ':' + q.i));
  const next = async p => { await p.click('#fb-btn'); await W(p, 120); };
  // 做完现在这一步（照着对的做）：教学卡点「记住了」；选择题点对的；跟读自评「说对了」
  async function doStep(p) {
    const c = await cur(p);
    if (!c) return null;
    if (c.t === 'tc') { await p.click('#tc-next'); await W(p, 120); return c; }
    if (c.t === 'sr_w') { await act(p, 'rate', { v: '2' }); await W(p, 80); await next(p); return c; }
    await p.click('#p-body .opt[data-i="' + c.ok + '"]'); await W(p, 80); await next(p);
    return c;
  }
  const onResult = p => E(p, () => !document.getElementById('result').hidden);
  // 做完这一节。结算页出来 1.7 秒后可能弹「升级了」：等它弹完、关掉（不然会盖在下一节上面）
  async function finishLesson(p) {
    for (let k = 0; k < 80 && !(await onResult(p)); k++) await doStep(p);
    await W(p, 1900);
    if (!(await E(p, () => document.getElementById('modal').hidden))) { await act(p, 'close'); await W(p, 150); }
  }

  try {
    // ======================= 1 没开的存档：一切照旧 =======================
    {
      const { ctx, p } = await openGame(SAVE());
      await quiz(p);
      check(await E(p, () => !document.querySelector('.mn-row')), '1 没开「一步一步学」：小镇卡片上没有那一排');
      await act(p, 'go', { w: '0', l: '0' }); await W(p, 400);
      const c = await cur(p);
      check(!!c && c.mini == null && c.total === 10 && /❤/.test(await E(p, () => document.getElementById('p-hearts').textContent)), '1 点第 1 关：照旧直接开考（10 题、有红心）', c);
      await ctx.close();
    }

    // ======================= 2–6 开着 =======================
    {
      const { ctx, p } = await openGame(SAVE({ settings: { starter: true } }));
      await quiz(p);
      let row = await E(p, () => { const r = document.querySelector('#w0 .mn-row'); return r ? { t: r.textContent, nodes: [...r.querySelectorAll('.mn-node')].map(b => b.className.replace('mn-node', '').trim() + (b.disabled ? '!' : '')) } : null; });
      check(!!row && /一步一步学/.test(row.t) && JSON.stringify(row.nodes) === JSON.stringify(['cur', 'lock!', 'lock!', 'lock!']), '2 开着：第 1 岛卡片上「🌱 一步一步学 ① ② ③ ④」，只有第 1 节能点（12 个词 = 4 节）', row);
      check(await E(p, () => !document.querySelector('.world.locked .mn-row')), '2 还没开的岛没有那一排');
      await shot(p, 'row-zh-port');
      // 点第 1 关 → 关卡详情 → 开始闯关 → 先问
      await p.click('#w0 .node[data-l="0"]'); await W(p, 300);
      await p.click('#sheet [data-act=start]'); await W(p, 300);
      let mt = await modalText(p);
      check(/先一步一步学/.test(mt) && /12 个新词/.test(mt) && /4 节小课/.test(mt) && /开始第 1 节小课/.test(mt) && /我学过了，直接闯关/.test(mt), '2 点第 1 关：先问「先一步一步学」（12 个新词、4 节小课；开始 / 我学过了）', mt);
      await shot(p, 'ask-zh-port');
      await p.click('#sheet [data-act=mini]'); await W(p, 300);
      mt = await modalText(p);
      check(/这一课学什么/.test(mt) && /开始第 1 节小课/.test(mt) && (await E(p, () => !!EchoGame.S.seenLesson[0])), '2 第一节之前先看「这一课学什么」，下一步是「开始第 1 节小课」', mt.slice(0, 200));
      await E(p, () => { window.__plays.length = 0; });
      await p.click('#sheet [data-act=lsNext]'); await W(p, 700);
      // ---------- 3 一节的步骤 ----------
      let c = await cur(p);
      const hearts = await E(p, () => document.getElementById('p-hearts').textContent);
      const w0 = await E(p, () => WORLDS[0].words.slice(0, 6).map(x => [x[0], x[1]]));
      const card = await E(p, () => { const e = document.querySelector('#p-body .tc-card'); return e ? e.innerText : ''; });
      check(!!c && c.mini === 0 && c.t === 'tc' && c.i === 0 && /🌱 1 \/ 4/.test(hearts) && !/❤/.test(hearts), '3 第 1 节小课：第一步是第 1 个词的教学卡；右上角「🌱 1 / 4」，没有红心', { c, hearts });
      check(card.includes(w0[0][0]) && card.includes(w0[0][1]) && (await E(p, () => window.__plays.length)) >= 1, '3 教学卡：词「' + w0[0][0] + '」、意思「' + w0[0][1] + '」，自动念一遍', { card, plays: await E(p, () => window.__plays.slice(-2)) });
      await shot(p, 'teach-zh-port');
      const st = await steps(p);
      const want = ['tc:0', 'lw:0', 'tc:1', 'lw:1', 'tc:2', 'lw:2'];
      const cnt = t => st.filter(s => s.startsWith(t + ':')).length, per = i => st.filter(s => s.endsWith(':' + i)).length;
      check(JSON.stringify(st.slice(0, 6)) === JSON.stringify(want) && cnt('lw') === 8 && cnt('mw') === 3 && cnt('sr_w') === 3 && st.length === 17 && JSON.stringify(st.slice(11, 14)) === JSON.stringify(['sr_w:0', 'sr_w:1', 'sr_w:2']) && st.every(s => +s.split(':')[1] < 3),
        '3 步骤：一个一个教、教完马上认（6 步）→ 听音选意思 → 看意思选词 3 → 跟读 3 → 小测 3，一共 17 步，只有这一节的 3 个词', st);
      check([0, 1, 2].every(i => per(i) >= 5), '3 每个新词在这一节里出现 5 次以上', [0, 1, 2].map(per));
      await doStep(p);   // 教学卡 → 记住了
      c = await cur(p);
      check(c.t === 'lw' && c.i === 0 && c.n === 2, '3 教完马上认：听音选意思，第 1 个词两个里选', c);
      await shot(p, 'two-zh-port');
      // ---------- 4 选错了：不扣心、不记错题、过两题再问 ----------
      const total0 = c.total, wrongs0 = await E(p, () => (EchoGame.dayLog().wrongs || 0));
      await p.click('#p-body .opt[data-i="' + (1 - c.ok) + '"]'); await W(p, 200);
      const fb = await E(p, () => ({ cls: document.getElementById('fb').className, t: document.getElementById('fb-t').textContent, d: document.getElementById('fb-d').textContent }));
      const after = await E(p, () => { const P = EchoGame.P(), S = EchoGame.S; return { hearts: P.hearts, total: P.total, rev: Object.keys(S.rev.items).length, wrongs: EchoGame.dayLog().wrongs || 0, at3: P.qs[P.idx + 3].type + ':' + P.qs[P.idx + 3].i + ':' + (P.qs[P.idx + 3].again || 0), hud: document.getElementById('p-hearts').textContent }; });
      check(/bad/.test(fb.cls) && /再认一认/.test(fb.t) && fb.d.includes(w0[0][0]) && after.hearts === 3 && /🌱 1 \/ 4/.test(after.hud), '4 选错了：亮出答案（「' + fb.t + '」），不扣心', { fb, after });
      check(after.total === total0 + 1 && after.at3 === 'lw:0:1' && after.rev === 0 && after.wrongs === wrongs0, '4 选错的那一题过两题再问一次（多了 1 步），不记错题、不进复习', after);
      await next(p);
      await doStep(p); await doStep(p);   // tc:1、lw:1
      c = await cur(p);
      check(c.t === 'lw' && c.i === 0 && c.again === 1, '4 过了两题：刚才选错的那个词又问了一次', c);
      await doStep(p);
      // 往下做到「看意思选词」
      for (let k = 0; k < 20 && (c = await cur(p)) && c.t !== 'mw'; k++) await doStep(p);
      const mw = await E(p, () => ({ cue: document.querySelector('#p-body .mw-cue').innerText, opts: [...document.querySelectorAll('#p-body .opt .o-t')].map(e => e.textContent), title: document.querySelector('#p-body .q-title').textContent }));
      check(c.t === 'mw' && c.n === 3 && /这是哪个词/.test(mw.title) && mw.cue.includes(w0[c.i][1]) && mw.opts.includes(w0[c.i][0]) && !mw.cue.includes(w0[c.i][0]), '4 看意思选词：题面是图和意思（「' + w0[c.i][1] + '」），三个词里选', mw);
      await shot(p, 'pick-zh-port');
      // 往下做到跟读：两次没读准就往下走，不记错题
      for (let k = 0; k < 20 && (c = await cur(p)) && c.t !== 'sr_w'; k++) await doStep(p);
      check(c.t === 'sr_w' && (await E(p, () => !document.querySelector('#st.mask') && document.getElementById('st').textContent.trim())) === w0[c.i][0], '4 跟读：看着全文读（不撤提示）', c);
      await shot(p, 'say-zh-port');
      await act(p, 'rate', { v: '0' }); await W(p, 150);
      const mid = await cur(p);
      await act(p, 'rate', { v: '0' }); await W(p, 200);
      const soft = await E(p, () => { const P = EchoGame.P(); return { answered: P.answered, fb: document.getElementById('fb').className, t: document.getElementById('fb-t').textContent, rev: Object.keys(EchoGame.S.rev.items).length, wrongs: EchoGame.dayLog().wrongs || 0 }; });
      check(!mid.answered && soft.answered && /show/.test(soft.fb) && !/bad/.test(soft.fb) && /没关系/.test(soft.t) && soft.rev === 0 && soft.wrongs === wrongs0, '4 跟读两次没读准：亮出答案往下走（「' + soft.t + '」），不记错题、不进复习', { mid, soft });
      await next(p);
      // ---------- 5 学完一节 ----------
      await finishLesson(p);
      const res = await E(p, () => { const S = EchoGame.S, r = document.getElementById('result'); return { text: r.innerText, rows: r.querySelectorAll('.mn-learned .mn-w').length, next: (r.querySelector('[data-act=mini][data-focus]') || { dataset: {} }).dataset.k, n: S.mini.n[0], rev: [0, 1, 2].map(i => S.rev.items['word:0:' + i]), nrev: Object.keys(S.rev.items).length, day: EchoGame.dayLog().mini }; });
      check(/学会了 3 个新词/.test(res.text) && /小课 1 \/ 4/.test(res.text) && res.rows === 3 && res.next === '1' && /下一节小课/.test(res.text), '5 学完一节：结算页「学会了 3 个新词」、列出这 3 个词、主按钮「下一节小课」', res.text.slice(0, 300));
      check(res.n === 1 && res.nrev === 3 && res.rev.every(e => e && e.b === 1 && e.due === TOMORROW && e.k === 'word') && res.day === 1, '5 进度记上了（1 节）；这 3 个词按「新学的」进每日复习：第 1 格、明天到期', res);
      await shot(p, 'result-zh-port');
      await quiz(p);
      row = await E(p, () => [...document.querySelectorAll('#w0 .mn-row .mn-node')].map(b => b.className.replace('mn-node', '').trim() + (b.disabled ? '!' : '') + '=' + b.textContent));
      check(JSON.stringify(row) === JSON.stringify(['done=✓', 'cur=2', 'lock!=3', 'lock!=4']), '5 回首页：第 1 节打勾、第 2 节亮着', row);
      await p.click('#w0 .mn-node.cur'); await W(p, 500);
      const st2 = await steps(p);
      c = await cur(p);
      check(c && c.mini === 1 && /^lw:[0-2]$/.test(st2[0]) && /^lw:[0-2]$/.test(st2[1]) && st2[2] === 'tc:3' && st2.length === 19 && (await E(p, () => document.getElementById('modal').hidden)), '5 第 2 节：开头先听上一节的两个词（热身），再教第 4 个词；不再弹「这一课学什么」', st2);
      const opts2 = await E(p, () => EchoGame.P().qs[3].opts.length);
      check(opts2 === 2, '5 第 2 节第 1 个新词：两个里选（另一个是上一节的词）', opts2);
      // ---------- 6 四节都学完 ----------
      await finishLesson(p);
      await p.click('#result [data-act=mini][data-focus]'); await W(p, 500);
      await finishLesson(p);
      await p.click('#result [data-act=mini][data-focus]'); await W(p, 500);
      await finishLesson(p);
      const fin = await E(p, () => { const S = EchoGame.S, r = document.getElementById('result'); return { text: r.innerText, go: !!r.querySelector('[data-act=go][data-l="0"][data-focus]'), n: S.mini.n[0], seen: !!S.seenCards[0], rev: Object.keys(S.rev.items).length }; });
      check(fin.n === 4 && fin.go && /开始闯关/.test(fin.text) && /小课 4 \/ 4/.test(fin.text) && fin.seen, '6 四节都学完：结算页主按钮「开始闯关」，记了 seenCards（第 1 关不再先弹单词卡）', fin);
      check(fin.rev === 10, '6 新学的词进复习照每天 10 条的名额（12 个词进了 10 个）', fin.rev);
      await shot(p, 'done-zh-port');
      await p.click('#result [data-act=go]'); await W(p, 500);
      c = await cur(p);
      check(!!c && c.mini == null && c.total === 10 && (await E(p, () => document.getElementById('modal').hidden)), '6 开始闯关：直接开考第 1 关（不再问、不弹单词卡）', c);
      await quiz(p);
      row = await E(p, () => document.querySelector('#w0 .mn-row').innerText);
      check(/学完了/.test(row), '6 卡片上那一排：四节都打勾，写着「学完了」', row);
      // 13 个词的岛：3 + 3 + 3 + 4
      const g13 = await E(p, () => { const S = EchoGame.S; for (let l = 0; l < 7; l++) S.stars['0-' + l] = 2; EchoGame.goHome('quiz'); return { words: WORLDS[1].words.length, nodes: document.querySelectorAll('#w1 .mn-row .mn-node').length }; });
      await act(p, 'mini', { w: '1', k: '0' }); await W(p, 300);
      if (!(await E(p, () => document.getElementById('modal').hidden))) { await p.click('#sheet [data-act=lsNext]'); await W(p, 400); }
      await E(p, () => { EchoGame.S.mini.n[1] = 3; }); await act(p, 'mini', { w: '1', k: '3' }); await W(p, 400);
      const last = await steps(p);
      check(g13.words === 13 && g13.nodes === 4 && last.filter(s => s.startsWith('tc:')).map(s => s.slice(3)).join() === '9,10,11,12', '6 13 个词的岛分成 4 节（3 + 3 + 3 + 4），最后一节教 4 个词', { g13, last });
      await ctx.close();
    }

    // ======================= 7 我学过了，直接闯关 =======================
    {
      const { ctx, p } = await openGame(SAVE({ settings: { starter: true } }));
      await quiz(p);
      await act(p, 'go', { w: '0', l: '0' }); await W(p, 300);
      check(/先一步一步学/.test(await modalText(p)), '7 开着：点第 1 关先问');
      await p.click('#sheet [data-act=miniSkip]'); await W(p, 500);
      let c = await cur(p);
      check(!!c && c.mini == null && c.total === 10 && (await E(p, () => EchoGame.S.mini.skip[0] === 1)), '7 「我学过了，直接闯关」：照常开考，记下这一课不再问', c);
      await quiz(p);
      await act(p, 'go', { w: '0', l: '0' }); await W(p, 400);
      c = await cur(p);
      check(!!c && c.mini == null && (await E(p, () => document.getElementById('modal').hidden)), '7 再点第 1 关：不再问');
      // ---------- 8 设置里的开关、新手路线 ----------
      await quiz(p);
      await act(p, 'settings'); await W(p, 300);
      check(await E(p, () => !!document.querySelector('#set-starter [data-act=setStarter][data-v="1"].on')), '8 设置里有「一步一步学」（现在是开）');
      await p.click('#set-starter [data-act=setStarter][data-v="0"]'); await W(p, 200);
      await act(p, 'close'); await quiz(p);
      check(await E(p, () => EchoGame.S.settings.starter === false && !document.querySelector('.mn-row')), '8 关了：卡片上那一排没有了');
      await ctx.close();
    }
    {
      const { ctx, p } = await openGame(SAVE({ settings: { starter: true, route: true } }));
      await E(p, () => EchoGame.goHome('mon')); await W(p, 300);
      const rt = await E(p, () => [...document.querySelectorAll('#quests .rt-steps button')].map(b => b.dataset.s + '|' + b.textContent));
      check(rt.some(s => /^mini\|/.test(s) && /上小课/.test(s)) && !rt.some(s => /^cards\|/.test(s)), '8 新手路线：「用单词卡认识这一课的词」换成「上小课」', rt);
      await p.click('#quests .rt-steps button[data-s=lesson]'); await W(p, 300); await act(p, 'lsDone'); await W(p, 200);
      await p.click('#quests .rt-steps button[data-s=mini]'); await W(p, 600);
      const c = await cur(p);
      check(!!c && c.mini === 0 && c.t === 'tc', '8 点「上小课」：开始第 1 节（看过「这一课学什么」的不再弹）', c);
      await ctx.close();
    }

    // ======================= 9 英语界面、横屏 =======================
    {
      const { ctx, p } = await openGame(SAVE({ settings: { starter: true, ui: 'en' } }));
      await quiz(p);
      const texts = [];
      const grab = async tag => texts.push([tag, await E(p, () => ((document.getElementById('modal').hidden ? '' : document.getElementById('sheet').innerText) + ' ' + (document.getElementById('play').hidden ? '' : document.getElementById('play').innerText) + ' ' + (document.getElementById('result').hidden ? '' : document.getElementById('result').innerText) + ' ' + ((document.querySelector('#w0 .mn-row') || {}).innerText || '')))]);
      await grab('row');
      await act(p, 'go', { w: '0', l: '0' }); await W(p, 300); await grab('ask');
      await p.click('#sheet [data-act=mini]'); await W(p, 300); await grab('lesson');
      await p.click('#sheet [data-act=lsNext]'); await W(p, 600); await grab('teach');
      await shot(p, 'teach-en-port');
      let c;
      const seen = new Set(['tc']);
      for (let k = 0; k < 80 && !(await onResult(p)); k++) {
        c = await cur(p);
        if (c && !seen.has(c.t)) { seen.add(c.t); await grab(c.t); if (c.t === 'mw') await shot(p, 'pick-en-port'); }
        if (c && c.t === 'lw' && !seen.has('wrong')) { seen.add('wrong'); await p.click('#p-body .opt[data-i="' + (c.ok ? 0 : 1) + '"]'); await W(p, 150); await grab('wrong'); await next(p); continue; }
        await doStep(p);
      }
      await grab('result');
      await shot(p, 'result-en-port');
      const bad = texts.filter(([, t]) => CJK.test(t));
      check(texts.length >= 8 && !bad.length && /Step by step/.test(texts[0][1]) && /You learned 3 new words/.test(texts[texts.length - 1][1]), '9 英语界面：那一排、问的那一页、教学卡、每种题、选错的提示、结算页都没有中文', bad.length ? bad.map(([tag, t]) => tag + ': ' + (t.match(/.{0,12}[぀-ヿ㐀-鿿].{0,12}/) || [''])[0]) : texts.map(x => x[0]));
      await ctx.close();
    }
    {
      const { ctx, p } = await openGame(SAVE({ settings: { starter: true }, seenLesson: { 0: 'x' } }), LAND);
      await quiz(p);
      await act(p, 'mini', { w: '0' }); await W(p, 700);
      let c = await cur(p);
      check(c && c.t === 'tc' && await inView(p, '#tc-next') && await inView(p, '#p-body .tc-card'), '9 横屏：教学卡和「记住了」都在屏幕里（不用滚）', c);
      await shot(p, 'teach-zh-land');
      await doStep(p);
      check(await inView(p, '#p-body .opt:last-child'), '9 横屏：听音选意思的选项在屏幕里');
      for (let k = 0; k < 20 && (c = await cur(p)) && c.t !== 'mw'; k++) await doStep(p);
      check(await inView(p, '#p-body .opt:last-child') && await inView(p, '#p-body .mw-cue'), '9 横屏：看意思选词的题面和选项都在屏幕里');
      await shot(p, 'pick-zh-land');
      await finishLesson(p);
      check(await inView(p, '#result [data-focus]'), '9 横屏：结算页的主按钮在屏幕里');
      await shot(p, 'result-zh-land');
      await ctx.close();
    }
    check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    check(false, '测试脚本出错：' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e));
  }
  await browser.close();
  web.close();
  console.log(fails ? '✗ ' + fails + ' 项没过' : '全部通过');
  process.exit(fails ? 1 : 0);
})();
