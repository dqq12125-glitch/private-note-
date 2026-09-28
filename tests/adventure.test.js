// 端到端测试：选初始怪兽 → 第 1 镇（博士）→ 怪兽中心（护士、电脑）→ 商店 → 守卫 → 拿徽章 → 1 号路（台阶、训练师、草丛）→ 第 2 镇
// 用 2D 流畅模式跑（快、不依赖显卡）；3D 画面由 render3d.test.js 检查
// 运行：npm test（需要先 npm install && npx playwright install chromium）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false })).newPage();
  p.setDefaultTimeout(5000);
  const tryClick = async el => { try { await el.click({ timeout: 2000 }); } catch (e) { /* 按钮被换掉了 */ } };
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE);
  // 从开场剧情已经看完的存档开始（开场剧情由 story.test.js 测）
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false }, player: { gender: 'boy', name: 'Tom' },
    mon: { v: 2, box: [{ uid: 'm1', sp: 'bubbly', lv: 5, xp: 0 }], team: ['m1'], dex: { bubbly: 'caught' } },
    world: { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:ch1': 1 } },
  })));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]');
  await p.waitForTimeout(1500);
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: d.busy }; });
  const A = async () => { for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) break; await p.waitForTimeout(100); } await p.click('#world [data-act=wA].ba'); await p.waitForTimeout(250); };
  const step = async (key, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.down(key); await p.waitForTimeout(40); await p.keyboard.up(key); await p.waitForTimeout(300); } };
  const tp = (x, y, dir) => p.evaluate(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir || d.PL.dir; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y + 1; }, [x, y, dir]);
  const waitMap = async id => { for (let i = 0; i < 30; i++) { const s = await dbg(); if (s.map === id && !s.busy) return true; await p.waitForTimeout(100); } return false; };
  const typed = async () => { for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) return; await p.waitForTimeout(100); } };
  const closeDlg = async () => { for (let i = 0; i < 12 && (await dbg()).dlg; i++) await A(); };

  // ---------- 第 1 镇：博士 ----------
  let s = await dbg();
  check(s.map === 't0' && !s.dlg, '在第 1 镇 ' + JSON.stringify(s));
  await p.screenshot({ path: out + '/w1-town.png' });
  await step('ArrowRight');
  await A();
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/w2-prof.png' });
  for (let i = 0; i < 5; i++) await A();
  await p.waitForSelector('#w-dlg [data-act=wSelfDone]');
  await p.click('#w-dlg [data-act=wSelfDone]'); await p.waitForTimeout(300);
  check(/10 个金币/.test(await p.textContent('#w-dlg .d-zh')), '博士的口语任务给金币');
  await closeDlg();

  // ---------- 怪兽中心：进门、护士、电脑 ----------
  const door = await p.evaluate(() => EchoWorld._debug().M.buildings.C.door);
  await tp(door.x, door.y + 1, 'up');
  await step('ArrowUp');
  check(await waitMap('i0C'), '进入怪兽中心');
  await p.waitForTimeout(300);
  await step('ArrowUp', 4);
  await A(); await typed();
  check(/Monster Center/.test(await p.textContent('#w-dlg .d-en')), '和护士说话');
  await closeDlg();
  await p.screenshot({ path: out + '/w3-center.png' });
  await step('ArrowLeft', 3); await step('ArrowDown'); await step('ArrowLeft');
  await A();
  check(await p.isVisible('#sheet .pc-h'), '电脑打开怪兽箱子');
  await p.screenshot({ path: out + '/w4-pc.png' });
  await p.click('#sheet [data-act=close]');
  await tp(5, 7, 'down');
  await step('ArrowDown');
  check(await waitMap('t0'), '从怪兽中心出来回到小镇');
  s = await dbg();
  check(s.x === door.x && s.y === door.y + 1, '站在怪兽中心门口');

  // ---------- 商店 ----------
  const shop = await p.evaluate(() => EchoWorld._debug().M.buildings.M.door);
  await tp(shop.x, shop.y + 1, 'up');
  await step('ArrowUp');
  check(await waitMap('i0M'), '进入商店');
  await tp(3, 3, 'up');
  await A();
  check(await p.isVisible('#sheet [data-act=wBuy]'), '店员打开商店');
  const coins0 = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).coins);
  await p.click('#sheet [data-act=wBuy][data-i="1"]');
  const st0 = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));
  check(st0.coins === coins0 - 20 && st0.mon.potions === 3, '买了一瓶药水');
  await p.click('#sheet [data-act=close]');
  await tp(5, 7, 'down'); await step('ArrowDown'); await waitMap('t0');

  // ---------- 守卫 ----------
  const g = await p.evaluate(() => { const n = EchoWorld._debug().M.npcs.find(q => q.role === 'guard'); return { x: n.x, y: n.y }; });
  await tp(g.x, g.y + 1, 'up');
  await step('ArrowUp');
  s = await dbg();
  check(s.y === g.y + 1, '守卫挡住北边');
  await A();
  check(/徽章/.test(await p.textContent('#w-dlg .d-zh')), '守卫要徽章');
  await closeDlg();

  // ---------- 拿到徽章，走上 1 号路 ----------
  await p.evaluate(() => { document.querySelector('[data-act=wExit]').click(); });
  await p.waitForTimeout(300);
  const saved = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); s.mon.badges = { 0: 1 }; localStorage.setItem('echo-island-v1', JSON.stringify(s)); return s.world; });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]'); await p.waitForTimeout(600);
  s = await dbg();
  check(s.map === saved.map && s.x === saved.x && s.y === saved.y, '重新进入时回到存档的位置 ' + JSON.stringify(s));
  await tp(g.x, g.y + 1, 'up');
  await step('ArrowUp', 2);
  check(await waitMap('r0'), '走到 1 号路');
  await p.waitForTimeout(2800);
  await p.screenshot({ path: out + '/w5-route.png' });

  // 台阶：往下能跳，往上跳不上去
  const L = await p.evaluate(() => { const m = EchoWorld._debug().M; for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) if (m.grid[y][x] === 'L' && m.grid[y - 1][x] === '.' && m.grid[y + 1][x] === '.' && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 5)) return { x, y }; return null; });
  await tp(L.x, L.y - 1, 'down');
  await step('ArrowDown'); await p.waitForTimeout(200);
  s = await dbg();
  check(s.y === L.y + 1, '从台阶上往下跳了两格');
  await step('ArrowUp');
  s = await dbg();
  check(s.y === L.y + 1, '台阶爬不上去');

  // 训练师：站到他看得见的地方
  const tr = await p.evaluate(() => { const d = EchoWorld._debug(), n = d.M.npcs.find(q => q.role === 'trainer' && (q.face === 'left' || q.face === 'right')); return { x: n.x, y: n.y, face: n.face }; });
  const sx = tr.face === 'left' ? tr.x - 3 : tr.x + 3;
  await tp(sx, tr.y + 1, 'up');
  await step('ArrowUp');
  await p.waitForTimeout(1600);
  await p.screenshot({ path: out + '/w6-trainer.png' });
  await A();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 5000 });
  check(true, '训练师发现主角并开始对战');
  async function fight() {
    for (let k = 0; k < 200; k++) {
      await p.waitForTimeout(250);
      if (await p.$('#b-panel [data-act=bEnd]')) return await p.textContent('#b-panel .b-result');
      const moves = await p.$$('[data-act=bMove]:not([disabled])');
      if (moves.length) { await tryClick(moves[moves.length - 1]); continue; }
      const opt = await p.$('#b-panel .opt[data-act=bOpt]:not(.right):not(.wrong):not(.dim)');
      if (opt && await p.$('#b-rate[hidden]')) { await tryClick(opt); continue; }
      const rate = await p.$('#b-panel [data-act=bRate][data-v="2"]');
      if (rate && await rate.isVisible()) { await tryClick(rate); continue; }
      const def = await p.$('#b-panel [data-act=bDef]:not(.right):not(.wrong):not(.dim)');
      if (def) { await tryClick(def); continue; }
    }
    return 'timeout';
  }
  const res = (await fight()).replace(/\s+/g, ' ');
  console.log('  trainer battle:', res);
  await p.click('#b-panel [data-act=bEnd]');
  await p.waitForTimeout(600);
  check(await p.isVisible('#world'), '打完回到大地图');
  await closeDlg();

  // 草丛遇怪 + 战斗里的背包
  const grass = await p.evaluate(() => { const m = EchoWorld._debug().M; for (let y = m.H - 8; y > 1; y--) for (let x = 1; x < m.W - 2; x++) if (m.grid[y][x] === ',' && m.grid[y][x + 1] === ',' && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 7)) return { x, y }; return null; });
  await p.evaluate(() => MonsterGame.healAll());
  await tp(grass.x, grass.y, 'right');
  let met = false;
  for (let i = 0; i < 80 && !met; i++) { await step(i % 2 ? 'ArrowLeft' : 'ArrowRight'); met = await p.isVisible('#battle'); if (!met && (await dbg()).busy) { await p.waitForTimeout(900); met = await p.isVisible('#battle'); } }
  check(met, '草丛里遇到野生怪兽');
  if (met) {
    await p.waitForTimeout(2600);
    await p.screenshot({ path: out + '/w7-wild.png' });
    await p.click('[data-act=bBag]');
    check(await p.isVisible('#sheet [data-act=bUse]'), '战斗里能打开背包');
    await p.click('#sheet [data-act=close]');
    await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]');
    await p.waitForTimeout(500);
    check(await p.isVisible('#world'), '逃跑后回到大地图');
  }

  // 走到路的北头，进第 2 镇
  const exitN = await p.evaluate(() => { const m = EchoWorld._debug().M; const w = m.warps.find(q => q.to === 't1'); return { x: w.x, y: w.y }; });
  await tp(exitN.x, exitN.y + 2, 'up');
  await step('ArrowUp', 2);
  check(await waitMap('t1'), '走到第 2 镇');
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/w8-town2.png' });

  // 背包：在大地图上给怪兽用药水
  await p.evaluate(() => { const s = MonsterGame; });
  await p.click('.w-menu'); await p.click('#sheet [data-act=mBag]');
  check(await p.isVisible('#sheet [data-act=mUse][data-id=potion]'), '菜单里能打开背包');
  await p.click('#sheet [data-act=close]');

  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));
  console.log('  state:', JSON.stringify({ world: { map: st.world.map, v: st.world.v, visited: st.world.visited, flags: st.world.flags }, potions: st.mon.potions, balls: st.mon.balls, team: st.mon.team.length }));
  check(st.world.map === 't1' && st.world.visited[1], '存档记住了第 2 镇');
  check(!errs.length, '页面没有报错' + (errs.length ? '：' + errs.join(' | ') : ''));

  // ---------- 老存档迁移：只有 13 个小镇、队伍 3 只 ----------
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('echo-island-v1'));
    delete s.world.v; delete s.world.map; s.world.z = 2; s.world.x = 5; s.world.y = 5;
    delete s.mon.v; delete s.mon.bag;
    const mk = (sp, lv) => ({ uid: 'x' + sp, sp, lv, xp: 0 });
    s.mon.box = [s.mon.box[0], mk('zappy', 6), mk('drizzle', 7), mk('mossbear', 8)];
    s.mon.team = [s.mon.box[0].uid];
    s.mon.badges = { 0: 1, 1: 1 };
    localStorage.setItem('echo-island-v1', JSON.stringify(s));
  });
  await p.reload(); await p.waitForTimeout(500);
  await p.click('[data-act=wEnter]'); await p.waitForTimeout(700);
  s = await dbg();
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));
  check(s.map === 't2' && st2.world.v === 2, '老存档：回到第 3 镇怪兽中心门口 ' + JSON.stringify(s));
  check(st2.mon.team.length === 4 && Object.keys(st2.mon.badges).length === 2, '老存档：怪兽和徽章都在，队伍补到 4 只');
  check(!errs.length, '迁移后没有报错' + (errs.length ? '：' + errs.join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
