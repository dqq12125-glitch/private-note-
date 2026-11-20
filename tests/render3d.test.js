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
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: 'mid', sfx: false, gate: false }, player: { gender: 'girl', name: 'Amy' },
    mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 5, xp: 0 }], team: ['m1'], dex: { emberpup: 'caught' } },
    world: { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))) },
  })));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]');
  await p.waitForTimeout(1500);
  const kind = await p.evaluate(() => EchoWorld._debug().R.kind);
  check(kind === '3d', '建出了 3D 渲染器（' + kind + '）');
  // 每种地图都画一遍：小镇、道路、室内、挑战馆、漆黑的洞穴、海路、海底、冰洞、火山、基地、雪岛、古迹
  const tour = [['t0', 'start'], ['r0', 'from:t0'], ['i0C', 'mat'], ['i0G', 'mat'], ['i0H', 'mat'], ['c0', 'mat'], ['s7', 'from:t7'], ['u9', 'from:s9'], ['c10', 'from:t10'], ['d6a', 'from:t6'], ['h8a', 'from:j8'], ['t11', 'door:C'], ['t12', 'door:C'], ['t2', 'door:C']];
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
  // 转屏：画面那一层的大小变了、但没有（或者先于它）resize 事件——iPhone 上转屏时事件来得比排版早，以前画布会按旧的宽定住，主角跑到屏幕边上
  const fitOf = () => p.evaluate(() => { const v = document.getElementById('w-view'), c = v.querySelector('canvas'); return { vw: v.clientWidth, vh: v.clientHeight, cw: Math.round(parseFloat(c.style.width)), ch: Math.round(parseFloat(c.style.height)) }; });
  await p.evaluate(() => { const v = document.getElementById('w-view'); v.dataset.css = v.style.cssText; v.style.right = 'auto'; v.style.width = '300px'; });
  await p.waitForTimeout(400);
  const fit1 = await fitOf();
  check(fit1.vw === 300 && fit1.cw === 300 && fit1.ch === fit1.vh, '画面那一层自己变窄了（没有 resize 事件）：画布跟着重算 ' + JSON.stringify(fit1));
  await p.evaluate(() => { const v = document.getElementById('w-view'); v.style.cssText = v.dataset.css || ''; });
  await p.waitForTimeout(400);
  const fit2 = await fitOf();
  check(fit2.cw === fit2.vw && fit2.vw > 300, '变回来：画布也回来了 ' + JSON.stringify(fit2));
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
  // 巡游时触发的剧情对话先点完（对话开着时不量帧率）
  for (let i = 0; i < 40 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { if (await p.$('#w-dlg [data-act=wSkip]')) await p.click('#w-dlg [data-act=wSkip]').catch(() => {}); else if (await p.$('#w-dlg [data-act=wPick]')) await p.click('#w-dlg [data-act=wPick]').catch(() => {}); else await p.evaluate(() => document.querySelector('#world [data-act=wA].ba').click()).catch(() => {}); await p.waitForTimeout(200); }
  await p.waitForTimeout(9000);
  const tier = await p.evaluate(() => ({ tier: EchoWorld._debug().R.tier, auto: JSON.parse(localStorage.getItem('echo-island-v1')).settings.gfxAuto, perf: EchoWorld._debug().perf, busy: EchoWorld._debug().busy, dlg: !!EchoWorld._debug().dlg, map: EchoWorld._debug().M.id, pg: (d => d && d.pages[d.i] && (d.pages[d.i].en + '|' + d.pages[d.i].kind))(EchoWorld._debug().dlg), gfx: JSON.parse(localStorage.getItem('echo-island-v1')).settings.gfx }));
  check(tier.auto && tier.auto !== 'mid', '慢设备上自动降档 ' + JSON.stringify(tier));
  // 3D 战斗：出场、放招特效、截图
  await p.evaluate(() => { EchoWorld.stop(); MonsterGame.battle('wild', 0, { onEnd() {}, hab: 'grass' }); });
  await p.waitForTimeout(3500);
  // 开场两句朗读走在线发音（网络慢时一句最长等好几秒），招式菜单要等它念完才出来：最多再等 18 秒
  for (let i = 0; i < 120 && !(await p.$('#b-panel [data-act=bMove]')); i++) await p.waitForTimeout(150);
  check(await p.$('#b-arena.is3d canvas.b3d') !== null, '3D 战斗画面');
  const nMoves = (await p.$$('[data-act=bMove]')).length;
  check(nMoves >= 2 && nMoves <= 4, '招式按钮 ' + nMoves + ' 个（按等级学会的）');
  await p.click('[data-act=bMove][data-i="0"]');
  await p.click('[data-act=bRate][data-v="2"]');
  await p.waitForTimeout(900);
  await p.screenshot({ path: out + '/3d-battle-fx.png' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '/3d-battle.png' });
  // 小招可能一下就把 Lv5 的野生怪兽打倒了（战斗自己结束了，没有逃跑按钮）：能逃就逃，有结束按钮就点
  await p.click('[data-act=bFlee]', { timeout: 3000 }).catch(() => {});
  const end = await p.waitForSelector('#sheet [data-act=bEnd]', { timeout: 3000 }).catch(() => null);
  if (end) await end.click();
  await p.waitForTimeout(500);
  check(!(await p.$('canvas.b3d')), '战斗结束后 3D 战斗画面释放了');
  // 手册：总数不算保留的那几只（tests/dex-edition.test.js 细查），翻页
  const dx = await p.evaluate(() => ({ total: DEX.total, main: DEX.main.length }));
  check(dx.total === dx.main && dx.total !== 386, '手册 ' + dx.total + ' 只（不是 386）');
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
