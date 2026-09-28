// 野外技能测试：居合斩、碎岩、怪力推石头、冲浪（下水、上岸）、钓鱼、闪光、飞空、自行车、藏起来的道具、寻宝器、没徽章时的提示
// 运行：node tests/field.test.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE);
  const team = [['a', 'bubbly', 30], ['b', 'sprouty', 30], ['c', 'zappy', 30], ['d', 'songlet', 30]];
  const save = (badges, bag) => p.evaluate(([team, badges, bag]) => localStorage.setItem('echo-island-v1', JSON.stringify({
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false }, player: { gender: 'boy', name: 'Tom' },
    mon: { v: 2, box: team.map(([uid, sp, lv]) => ({ uid, sp, lv, xp: 0 })), team: team.map(t => t[0]), dex: {}, balls: 5, potions: 3, bag, badges },
    world: { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1, 1: 1, 2: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 } },
  })), [team, badges, bag]);
  const W = ms => p.waitForTimeout(ms);
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dlg: !!d.dlg, busy: d.busy }; });
  const go = async (id, how) => { await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await W(300); };
  const tp = (x, y, dir) => p.evaluate(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y + (dir === 'up' ? 1 : -1); }, [x, y, dir]);
  const typed = async () => { for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) return; await W(80); } };
  const A = async () => { await typed(); await p.click('#world [data-act=wA].ba'); await W(250); };
  const closeDlg = async () => { for (let i = 0; i < 10 && (await dbg()).dlg; i++) { if (await p.$('#w-dlg [data-act=wSelfDone], #w-dlg [data-act=wPick], #w-dlg #w-custom .opt')) break; await A(); } };
  const say = async () => { await p.waitForSelector('#w-dlg [data-act=wSelfDone]'); await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); await closeDlg(); };
  const tileAt = (x, y) => p.evaluate(([x, y]) => { const d = EchoWorld._debug(); return d.M.grid[y][x]; }, [x, y]);
  const find = ch => p.evaluate(ch => { const m = EchoWorld._debug().M; for (let y = 1; y < m.H - 1; y++) for (let x = 1; x < m.W - 1; x++) if (m.grid[y][x] === ch && '.,=:'.includes(m.grid[y + 1][x])) return { x, y }; return null; }, ch);

  // ---------- 没有徽章：提示要几枚徽章 ----------
  await save({}, {}); await p.reload(); await W(400);
  await p.click('[data-act=wEnter]'); await W(900);
  await go('r1', 'south');
  let n = await find('n');
  await tp(n.x, n.y + 1, 'up'); await A();
  check(/徽章/.test(await p.textContent('#w-dlg .d-zh')), '没有徽章时：提示居合斩要几枚徽章');
  await closeDlg();

  // ---------- 6 枚徽章，全部技能 ----------
  await p.evaluate(() => { document.querySelector('[data-act=wExit]').click(); });
  await save({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, { rod: 1, bike: 1, dowsing: 1 }); await p.reload(); await W(400);
  await p.click('[data-act=wEnter]'); await W(900);
  // 居合斩
  await go('r1', 'south');
  n = await find('n');
  await tp(n.x, n.y + 1, 'up'); await A();
  check(/cut the tree/.test(await p.textContent('#w-dlg .say-text')), '居合斩：要说 "Sprouty, cut the tree!"');
  await say();
  check(await p.evaluate(([x, y]) => EchoWorld._debug().M._cleared.has(x + ',' + y), [n.x, n.y]), '小树被砍掉了');
  await p.keyboard.press('ArrowUp'); await W(300);
  check((await dbg()).y === n.y, '可以走过去了');
  // 碎岩
  await go('r2', 'south');
  const rb = await find('b');
  await tp(rb.x, rb.y + 1, 'up'); await A();
  check(/smash the rock/.test(await p.textContent('#w-dlg .say-text')), '碎岩：要说 "... smash the rock!"');
  await say();
  check(await p.evaluate(([x, y]) => EchoWorld._debug().M._cleared.has(x + ',' + y), [rb.x, rb.y]), '岩石碎了');
  // 怪力
  await go('r3', 'south');
  const bo = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  await tp(bo.x, bo.y + 1, 'up'); await A();
  check(/push the rock/.test(await p.textContent('#w-dlg .say-text')), '怪力：要说 "... push the rock!"');
  await say();
  await p.keyboard.press('ArrowUp'); await W(450);
  const bo2 = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  check(bo2.y === bo.y - 1 && (await dbg()).y === bo.y, '大石头被推开了一格，主角跟上 ' + JSON.stringify(bo2));
  await p.screenshot({ path: out + '/f1-boulder.png' });
  // 冲浪 + 钓鱼
  await go('r4', 'south');
  const shore = await p.evaluate(() => { const m = EchoWorld._debug().M; for (let y = m.H - 2; y > 1; y--) for (let x = 1; x < m.W - 1; x++) if (m.grid[y][x] === '~' && m.grid[y + 1][x] === '.' && m.grid[y - 1][x] === '~') return { x, y }; return null; });
  await tp(shore.x, shore.y + 1, 'up'); await A();
  check(await p.isVisible('#w-dlg [data-act=wPick]'), '面对水：选冲浪还是钓鱼');
  await p.click('#w-dlg [data-act=wPick][data-i="1"]');
  await p.waitForSelector('#fish-opts .opt', { timeout: 8000 });
  check(true, '钓鱼：浮标动了，出现三个意思');
  await p.click('#fish-opts .opt');
  await W(1200);
  const hooked = /钓上来了/.test(await p.textContent('#w-dlg .d-zh'));
  check(hooked || /跑掉了/.test(await p.textContent('#w-dlg .d-zh')), '钓鱼有结果（' + (hooked ? '钓上来了' : '跑掉了') + '）');
  await A();
  if (hooked) { await p.waitForSelector('#battle:not([hidden])', { timeout: 6000 }); check(true, '钓上来的怪兽进入战斗'); await W(2500); await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]'); await W(600); }
  await tp(shore.x, shore.y + 1, 'up'); await A();
  await p.click('#w-dlg [data-act=wPick][data-i="0"]');
  check(/let's surf/.test(await p.textContent('#w-dlg .say-text')), '冲浪：要说 "Bubbly, let\'s surf!"');
  await say(); await W(300);
  let st = await p.evaluate(() => { const d = EchoWorld._debug(); return { surf: d.PL.surf, t: d.M.grid[d.PL.y][d.PL.x] }; });
  check(st.surf && st.t === '~', '在水上冲浪');
  await p.keyboard.press('ArrowUp'); await W(300);
  check((await p.evaluate(() => EchoWorld._debug().PL.surf)), '冲浪时能在水上走');
  await p.screenshot({ path: out + '/f2-surf.png' });
  await p.keyboard.press('ArrowDown'); await W(300); await p.keyboard.press('ArrowDown'); await W(300);
  check(!(await p.evaluate(() => EchoWorld._debug().PL.surf)), '走上岸就不冲浪了');
  // 自行车
  await p.click('#w-bike');
  await p.keyboard.press('ArrowLeft'); await W(30);
  check(await p.evaluate(() => { const d = EchoWorld._debug(); return d.PL.dur === 95; }), '骑车一步只要 95 毫秒');
  await W(300);
  await p.click('#w-bike');
  // 藏起来的道具 + 寻宝器
  await go('t0', 'door:C');
  const h = await p.evaluate(() => EchoWorld._debug().M.hidden[0]);
  check(!!h, '第 1 镇有藏起来的道具');
  await tp(h.x, h.y + 1, 'up'); await A(); await typed();
  check(/hidden/.test(await p.textContent('#w-dlg .d-en')), '对着它按 A 找到了藏起来的道具');
  await closeDlg();
  // 闪光
  await go('c0', 'mat');
  await p.click('.w-menu'); await p.click('#sheet [data-act=wSkills]');
  await p.click('#sheet [data-act=wUseSkill][data-k=flash]');
  check(/light up the cave/.test(await p.textContent('#w-dlg .say-text')), '闪光：要说 "Zappy, light up the cave!"');
  await say();
  check(await p.evaluate(() => EchoWorld._debug().M._flash), '洞穴被照亮了');
  // 飞空
  await go('r0', 'north');
  await p.click('.w-menu'); await p.click('#sheet [data-act=wSkills]');
  await p.click('#sheet [data-act=wUseSkill][data-k=fly]');
  await p.click('#sheet [data-act=wFlyTo][data-z="2"]');
  await say(); await W(700);
  check((await dbg()).map === 't2', '飞空：飞到了第 3 镇');
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
