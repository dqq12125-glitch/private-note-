// 3D 画面检查：能建出 3D 渲染器、每类地图都能画出来、没有报错；自动画质在慢设备上会降档
// 运行：node tests/render3d.test.js（无头浏览器用软件渲染，比手机慢很多，所以正好能测到自动降档）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const opts = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(opts);
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(8000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: 'mid', sfx: false }, player: { gender: 'girl', name: 'Amy' },
    mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 5, xp: 0 }], team: ['m1'], dex: { emberpup: 'caught' } },
    world: { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 } },
  })));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]');
  await p.waitForTimeout(1500);
  const kind = await p.evaluate(() => EchoWorld._debug().R.kind);
  check(kind === '3d', '建出了 3D 渲染器（' + kind + '）');
  const tour = [['t0', 'start'], ['r0', 'south'], ['i0C', 'mat'], ['i0G', 'mat'], ['i0H', 'mat'], ['c0', 'mat'], ['r2', 'cave'], ['t11', 'door:C'], ['t2', 'door:C']];
  for (const [id, how] of tour) {
    await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]);
    await p.waitForTimeout(900);
    const info = await p.evaluate(() => { const r = EchoWorld._debug().R; const i = r.info(); return { calls: i.render.calls, tris: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures }; });
    check(info.calls > 3 && info.tris > 100, id + ' 画出来了 ' + JSON.stringify(info));
    await p.screenshot({ path: out + '/3d-' + id + '.png' });
  }
  // 来回切几次地图，显存里的几何体和贴图不应该越来越多
  const mem = [];
  for (let k = 0; k < 3; k++) {
    await p.evaluate(() => EchoWorld._debug().goMap('r0', 'south')); await p.waitForTimeout(300);
    await p.evaluate(() => EchoWorld._debug().goMap('t0', 'door:C')); await p.waitForTimeout(300);
    mem.push(await p.evaluate(() => { const i = EchoWorld._debug().R.info().memory; return i.geometries + i.textures; }));
  }
  check(mem[2] <= mem[0] + 2, '切换地图没有泄漏 ' + JSON.stringify(mem));
  // 设置里切成 2D，再切回 3D
  await p.evaluate(() => { const s = document.querySelector('[data-act=settings]'); });
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('echo-island-v1')); });
  await p.click('.w-menu'); await p.click('#sheet [data-act=settings]');
  await p.click('#sheet [data-act=setGfx][data-m="2d"]');
  check(await p.evaluate(() => EchoWorld._debug().R.kind) === '2d', '设置里切到 2D 流畅模式');
  await p.click('#sheet [data-act=setGfx][data-m=auto]');
  await p.click('#sheet [data-act=close]');
  check(await p.evaluate(() => EchoWorld._debug().R.kind) === '3d', '切回自动（3D）');
  // 自动画质：软件渲染很慢，量完帧率应该降档
  await p.waitForTimeout(9000);
  const tier = await p.evaluate(() => ({ tier: EchoWorld._debug().R.tier, auto: JSON.parse(localStorage.getItem('echo-island-v1')).settings.gfxAuto }));
  check(tier.auto && tier.auto !== 'mid', '慢设备上自动降档 ' + JSON.stringify(tier));
  // 3D 战斗：出场、放招特效、截图
  await p.evaluate(() => { EchoWorld.stop(); MonsterGame.battle('wild', 0, { onEnd() {}, hab: 'grass' }); });
  await p.waitForTimeout(3500);
  check(await p.$('#b-arena.is3d canvas.b3d') !== null, '3D 战斗画面');
  const nMoves = (await p.$$('[data-act=bMove]')).length;
  check(nMoves >= 2 && nMoves <= 4, '招式按钮 ' + nMoves + ' 个（按等级学会的）');
  await p.click('[data-act=bMove][data-i="0"]');
  await p.click('[data-act=bRate][data-v="2"]');
  await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/3d-battle-fx.png' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '/3d-battle.png' });
  await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]');
  await p.waitForTimeout(500);
  check(!(await p.$('canvas.b3d')), '战斗结束后 3D 战斗画面释放了');
  // 图鉴：386 只，翻页
  const total = await p.evaluate(() => DEX.total);
  check(total === 386, '图鉴 386 只');
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
