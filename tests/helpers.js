// 端到端测试的公用工具：开浏览器、写存档、传送、按 A、打完一场战斗……
// 用法：const H = require('./helpers'); const t = await H.open(); ... await t.done();
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');

async function open(o) {
  o = o || {};
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await (await b.newContext({ viewport: o.viewport || { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  let fails = 0;
  p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split(/\n/)[1]); });
  p.on('console', m => { if (m.type() === 'error') console.log('  [cerr]', m.text()); });
  await p.goto(PAGE);
  const W = ms => p.waitForTimeout(ms);
  const t = {
    p, b, W, out, errs,
    check(ok, what) { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; return ok; },
    // 写一个存档：队伍 team = [[编号, 等级], ...]；flags 是剧情进度（不用写 s: 前缀的也行）；bag 是背包
    async save(s) {
      s = Object.assign({ map: 't0', x: -1, y: -1, badges: {}, flags: {}, team: [['tidalfin', 60], ['flamewolf', 60]], bag: {}, visited: { 0: 1 } }, s);
      const flags = { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 };
      Object.entries(s.flags).forEach(([k, v]) => { flags[k.includes(':') ? k : 's:' + k] = v; });
      await p.evaluate(([s, flags]) => localStorage.setItem('echo-island-v1', JSON.stringify({
        seenIntro: true, coins: 500, settings: { tts: 'online', mode: 'self', gfx: s.gfx || '2d', sfx: false }, player: { gender: s.gender || 'girl', name: 'Coco' },
        mon: { v: 2, box: s.team.map(([sp, lv], i) => ({ uid: 'u' + i, sp, lv, xp: 0 })), team: s.team.map((_, i) => 'u' + i), dex: {}, balls: 10, potions: 10, bag: s.bag, badges: s.badges },
        world: { v: 3, started: true, map: s.map, x: s.x, y: s.y, dir: 'up', arrive: s.arrive || 'door:C', visited: s.visited, flags, daily: {} },
      })), [s, flags]);
      await p.reload(); await W(400);
      await p.click('[data-act=wEnter]'); await W(900);
    },
    dbg: () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: d.busy, surf: !!d.PL.surf }; }),
    flags: () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).world.flags),
    async go(id, how) { await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await W(500); },
    tp: (x, y, dir) => p.evaluate(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir || d.PL.dir; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; }, [x, y, dir]),
    async typed() { for (let i = 0; i < 50; i++) { const ty = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!ty) return; await W(80); } },
    async en() { await t.typed(); return p.evaluate(() => { const e = document.querySelector('#w-dlg:not([hidden]) .d-en'); return e ? e.textContent : ''; }); },
    async zh() { await t.typed(); return p.evaluate(() => { const e = document.querySelector('#w-dlg:not([hidden]) .d-zh'); return e ? e.textContent : ''; }); },
    // 当前这页对话的原文（包括只听不看的页）
    page: () => p.evaluate(() => { const d = EchoWorld._debug().dlg; const pg = d && d.pages[d.i]; return pg ? { en: pg.en, zh: pg.zh, kind: pg.kind, target: pg.target, opts: pg.opts && pg.opts.map(o => ({ t: o.t, c: !!o.c, html: o.html })) } : null; }),
    async A() { await t.typed(); await p.click('#world [data-act=wA].ba'); await W(260); },
    async key(k, n) { for (let i = 0; i < (n || 1); i++) { await p.keyboard.down(k); await W(40); await p.keyboard.up(k); await W(280); } },
    // 往某个方向走 n 步（等走完）
    async walk(dir, n) { const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]; for (let i = 0; i < (n || 1); i++) { await p.keyboard.down(K); await W(40); await p.keyboard.up(K); await W(260); for (let k = 0; k < 20 && (await t.dbg()).busy; k++) await W(100); await t.settle(); } },
    // 等主角停下来（冰面、瀑布会一直滑）
    async settle() { let last = ''; for (let k = 0; k < 40; k++) { const s = await p.evaluate(() => { const d = EchoWorld._debug(); return d.PL.moving + ',' + d.PL.x + ',' + d.PL.y; }); if (s === last && s.startsWith('false')) return; last = s; await W(120); } },
    // 一直按 A，直到出现任务（要说话、要选答案、要选选项）或者对话结束
    async closeDlg() { for (let i = 0; i < 30 && (await t.dbg()).dlg; i++) { if (await p.$('#w-dlg [data-act=wSelfDone], #w-dlg .opt, #w-dlg [data-act=wPick], #w-dlg #w-custom button')) return; await t.A(); } },
    // 等剧情播完：一边按 A 关对话，一边等 busy 变回 false；遇到任务就自动完成（说话：点「我说完了」；选答案：选对的；选项：选第一个）
    async idle(max) {
      for (let i = 0; i < (max || 120); i++) {
        const s = await t.dbg();
        if (await p.isVisible('#battle')) { await t.fight(); continue; }
        if (await t.modal()) continue;
        if (!s.busy && !s.dlg) return;
        if (s.dlg) { if (!(await t.task())) await t.A(); } else await W(150);
      }
    },
    // 战斗以后弹出来的窗口：学新招（不学了）、进化（等动画完点「太棒了」）；返回有没有处理
    async modal() {
      if (!(await p.isVisible('#modal'))) return false;
      for (const sel of ['#sheet [data-act=mForget][data-k="-1"]', '#evo-ok:not([hidden])', '#sheet [data-act=mLearnGo]', '#sheet [data-act=close]']) {
        const el = await p.$(sel);
        if (el && await el.isVisible()) { try { await el.click({ timeout: 1500 }); } catch (e) { /* 换掉了 */ } await W(300); return true; }
      }
      await W(300);
      return true;
    },
    // 完成当前的对话任务：返回有没有任务
    async task(pickIndex) {
      if (await p.$('#w-dlg [data-act=wSelfDone]')) { await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); return true; }
      const pg = await t.page();
      if (pg && pg.kind === 'answer') { const i = pg.opts.findIndex(o => o.c); await p.click('#w-dlg .opt[data-i="' + i + '"]'); await W(400); if (await p.$('#w-dlg [data-act=wSelfDone]')) { await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); } return true; }
      if (pg && pg.kind === 'choice') { await p.click('#w-dlg [data-act=wPick][data-i="' + (pickIndex || 0) + '"]'); await W(300); return true; }
      return false;
    },
    // 打完当前这场战斗：一直出招 / 防御 / 自评「说得好」
    async fight() {
      const tryClick = async el => { try { await el.click({ timeout: 2000 }); } catch (e) { /* 按钮被换掉了 */ } };
      for (let k = 0; k < 400; k++) {
        await W(180);
        if (!(await p.isVisible('#battle'))) return 'gone';
        if (await p.$('#b-panel [data-act=bEnd]')) { const r = (await p.textContent('#b-panel .b-result')).replace(/\s+/g, ' '); await p.click('#b-panel [data-act=bEnd]'); await W(700); return r; }
        const mv = (await p.$('[data-act=bMove]:not([disabled]):not(.sup)')) || (await p.$('[data-act=bMove]:not([disabled])')); if (mv) { await tryClick(mv); continue; }
        const r = await p.$('#b-panel [data-act=bRate][data-v="2"]'); if (r && await r.isVisible()) { await tryClick(r); continue; }
        const d = await p.$('#b-panel [data-act=bDef]:not(.right):not(.wrong):not(.dim)'); if (d) { await tryClick(d); continue; }
        if (await p.$('#sheet [data-act=mForget]')) await p.click('#sheet [data-act=mForget][data-k="-1"]');
        const sd = await p.$('#b-panel [data-act=bSelfDone], #sheet [data-act=bSelfDone]'); if (sd) { await tryClick(sd); continue; }
      }
      return 'timeout';
    },
    // 当前地图上的人
    npcs: () => p.evaluate(() => EchoWorld._debug().M.npcs.map(n => ({ id: n.id, role: n.role, name: n.name, x: n.x, y: n.y, mon: n.mon }))),
    // 走到某个人面前并和他说话（传送到他旁边一格能站的地方）
    async talkTo(pred) {
      const n = await p.evaluate(src => { const d = EchoWorld._debug(), f = new Function('n', 'return (' + src + ')(n)'); const n = d.M.npcs.find(q => f(q)); return n && { x: n.x, y: n.y }; }, pred.toString());
      if (!n) return false;
      const spots = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']];
      for (const [dx, dy, dir] of spots) {
        const ok = await p.evaluate(([x, y]) => { const d = EchoWorld._debug(), c = d.M.grid[y] && d.M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && !d.M.npcs.some(q => q.x === x && q.y === y); }, [n.x + dx, n.y + dy]);
        if (ok) { await t.tp(n.x + dx, n.y + dy, dir); await t.A(); return true; }
      }
      return false;
    },
    shot: name => p.screenshot({ path: path.join(out, name + '.png') }),
    async done() {
      t.check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
      console.log(fails ? 'FAIL ' + fails : 'PASS');
      if (fails) process.exitCode = 1;
      await b.close();
    },
  };
  return t;
}
module.exports = { open, PAGE };
