// 端到端测试：选初始怪兽 → 进世界 → 对话 → 训练师 → 草丛遇怪 → 怪兽中心 → 商店 → 守卫 → 下一镇
// 运行：npm test（需要先 npm install && npx playwright install chromium）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false })).newPage();
  p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self' } })));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=mStarter][data-sp=bubbly]'); await p.click('[data-act=mStarterGo]'); await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/w0-home.png' });
  await p.click('[data-act=wEnter]');
  await p.waitForTimeout(2300);
  await p.screenshot({ path: out + '/w1-enter.png' }); await p.waitForTimeout(1200); await p.screenshot({ path: out + '/w1b-intro.png' });
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { z: d.Z.z, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: d.busy }; });
  const A = async () => { for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) break; await p.waitForTimeout(100); } await p.click('#world [data-act=wA].ba'); await p.waitForTimeout(250); };
  const step = async (key, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.down(key); await p.waitForTimeout(40); await p.keyboard.up(key); await p.waitForTimeout(260); } };
  for (let i = 0; i < 3; i++) await A();
  console.log('after intro', JSON.stringify(await dbg()));
  await step('ArrowUp', 2); await step('ArrowRight', 5);
  console.log('near professor', JSON.stringify(await dbg()));
  await p.screenshot({ path: out + '/w2-walk.png' });
  await A();
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/w3-talk.png' });
  for (let i = 0; i < 4; i++) await A();
  await p.screenshot({ path: out + '/w4-speak.png' });
  await p.click('#w-dlg [data-act=wSelfDone]'); await p.waitForTimeout(300);
  console.log('reward page:', await p.textContent('#w-dlg .d-zh'));
  await A();
  console.log('coins', await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).coins));

  // 训练师：传送到训练师旁边再走一步
  await p.evaluate(() => { const d = EchoWorld._debug(); const t = d.Z.npcs.find(n => n.id === '4'); d.PL.x = d.PL.fx = t.x + 2; d.PL.y = d.PL.fy = t.y; d.FL.x = d.FL.fx = t.x + 3; d.FL.y = d.FL.fy = t.y; });
  await step('ArrowLeft', 1);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/w5-trainer.png' });
  await A();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 5000 });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/w6-battle.png' });
  async function fight() {
    for (let k = 0; k < 150; k++) {
      await p.waitForTimeout(250);
      if (await p.$('#b-panel [data-act=bEnd]')) return await p.textContent('#b-panel .b-result');
      const moves = await p.$$('[data-act=bMove]:not([disabled])');
      if (moves.length) { await moves[moves.length - 1].click(); continue; }
      const opt = await p.$('#b-panel .opt[data-act=bOpt]:not(.right):not(.wrong):not(.dim)');
      if (opt && await p.$('#b-rate[hidden]')) { await opt.click(); continue; }
      const rate = await p.$('#b-panel [data-act=bRate][data-v="2"]');
      if (rate && await rate.isVisible()) { await rate.click(); continue; }
      const def = await p.$('#b-panel [data-act=bDef]:not(.right):not(.wrong):not(.dim)');
      if (def) { await def.click(); continue; }
    }
    return 'timeout';
  }
  console.log('trainer battle:', (await fight()).replace(/\s+/g, ' '));
  await p.click('#b-panel [data-act=bEnd]');
  await p.waitForTimeout(600);
  console.log('back in world:', await p.isVisible('#world'), 'dialog:', await p.textContent('#w-dlg .d-en').catch(() => '-'));
  await A();
  // 草丛遇怪
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = 2; d.PL.y = d.PL.fy = 3; d.FL.x = d.FL.fx = 2; d.FL.y = d.FL.fy = 4; });
  let met = false;
  for (let i = 0; i < 60 && !met; i++) { await step(i % 2 ? 'ArrowLeft' : 'ArrowRight'); met = await p.isVisible('#battle'); if (!met) { const s = await dbg(); if (s.busy) { await p.waitForTimeout(900); met = await p.isVisible('#battle'); } } }
  console.log('wild encounter:', met);
  if (met) {
    await p.waitForTimeout(2500);
    await p.screenshot({ path: out + '/w7-wild.png' });
    await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]');
    await p.waitForTimeout(500);
    console.log('fled, world visible:', await p.isVisible('#world'));
  }
  // 怪兽中心
  await p.evaluate(() => { const d = EchoWorld._debug(); const c = d.Z.buildings.C.door; d.PL.x = d.PL.fx = c.x; d.PL.y = d.PL.fy = c.y + 1; d.FL.x = d.FL.fx = c.x; d.FL.y = d.FL.fy = c.y + 2; });
  await step('ArrowUp');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/w8-center.png' });
  for (let i = 0; i < 3; i++) await A();
  // 商店
  await p.evaluate(() => { const d = EchoWorld._debug(); const c = d.Z.buildings.M.door; d.PL.x = d.PL.fx = c.x; d.PL.y = d.PL.fy = c.y + 1; d.FL.x = d.FL.fx = c.x; d.FL.y = d.FL.fy = c.y + 2; });
  await step('ArrowUp');
  await p.waitForTimeout(300);
  console.log('shop open:', await p.isVisible('#modal'));
  await p.click('#sheet [data-act=wBuy][data-i="1"]');
  await p.click('#sheet [data-act=close]');
  // 守卫 + 去下一镇
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = 9; d.PL.y = d.PL.fy = 3; d.FL.x = d.FL.fx = 9; d.FL.y = d.FL.fy = 4; d.PL.dir = 'up'; });
  await step('ArrowUp');
  console.log('before badge pos', JSON.stringify(await dbg()));
  await A(); console.log('guard says:', await p.textContent('#w-dlg .d-zh').catch(() => '-')); await A(); await A();
  // 给徽章：直接改内存中的存档
  await p.evaluate(() => { document.querySelector('[data-act=wExit]').click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); s.mon.badges = { 0: 1 }; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]'); await p.waitForTimeout(500);
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = 9; d.PL.y = d.PL.fy = 2; d.FL.x = d.FL.fx = 9; d.FL.y = d.FL.fy = 3; });
  await step('ArrowUp', 2);
  await p.waitForTimeout(900);
  console.log('after exit:', JSON.stringify(await dbg()));
  await p.screenshot({ path: out + '/w9-zone2.png' });
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));
  console.log('state:', JSON.stringify({ world: { z: st.world.z, visited: st.world.visited, flags: st.world.flags }, potions: st.mon.potions, balls: st.mon.balls, team: st.mon.box.map(m => m.sp + ' lv' + m.lv + ' hp' + m.hp) }));
  console.log('errors:', errs.length ? errs : 'none');
  if (errs.length || st.world.z !== 1) { console.log('FAIL'); process.exitCode = 1; } else console.log('PASS');
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
