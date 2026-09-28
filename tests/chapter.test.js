// 主线剧情测试：第 2 镇嘘声团（村民求助 → 两个团员 → 夺回水晶念句子）→ 道馆点亮三座雕像 → 馆主接受挑战；4 号路对手；英语冠军赛第一位大师
// 运行：node tests/chapter.test.js
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
  p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split(/\n/)[1]); });
  p.on('console', m => { if (m.type() === 'error') console.log('  [cerr]', m.text()); });
  await p.goto(PAGE);
  const save = (badges, flags) => p.evaluate(([badges, flags]) => localStorage.setItem('echo-island-v1', JSON.stringify({
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false }, player: { gender: 'girl', name: 'Coco' },
    mon: { v: 2, box: [{ uid: 'a', sp: 'tidalfin', lv: 70, xp: 0 }, { uid: 'b', sp: 'flamewolf', lv: 70, xp: 0 }], team: ['a', 'b'], dex: {}, balls: 5, potions: 9, bag: {}, badges },
    world: { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1, 1: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, flags) },
  })), [badges, flags]);
  const W = ms => p.waitForTimeout(ms);
  // 战斗面板会重画：点到已经被换掉的按钮就跳过，下一轮再找
  const tryClick = async el => { try { await el.click({ timeout: 2000 }); } catch (e) { /* 按钮被换掉了 */ } };
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dlg: !!d.dlg, busy: d.busy }; });
  const go = async (id, how) => { await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await W(400); };
  const tp = (x, y, dir) => p.evaluate(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y + 1; }, [x, y, dir]);
  const typed = async () => { for (let i = 0; i < 40; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) return; await W(80); } };
  const en = async () => { await typed(); return p.evaluate(() => { const e = document.querySelector('#w-dlg:not([hidden]) .d-en'); return e ? e.textContent : ''; }); };
  const A = async () => { await typed(); await p.click('#world [data-act=wA].ba'); await W(260); };
  const closeDlg = async () => { for (let i = 0; i < 14 && (await dbg()).dlg; i++) { if (await p.$('#w-dlg [data-act=wSelfDone], #w-dlg .opt')) return; await A(); } };
  // 等剧情播完：一边按 A 关对话，一边等 busy 变回 false
  const idle = async () => { for (let i = 0; i < 60; i++) { const s = await dbg(); if (!s.busy && !s.dlg) return; if (s.dlg && !(await p.$('#w-dlg [data-act=wSelfDone], #w-dlg .opt'))) await A(); else await W(150); } };
  const fight = async () => {
    for (let k = 0; k < 300; k++) {
      await W(200);
      if (await p.$('#b-panel [data-act=bEnd]')) { const r = (await p.textContent('#b-panel .b-result')).replace(/\s+/g, ' '); await p.click('#b-panel [data-act=bEnd]'); await W(700); return r; }
      const mv = await p.$('[data-act=bMove]:not([disabled])'); if (mv) { await tryClick(mv); continue; }
      const r = await p.$('#b-panel [data-act=bRate][data-v="2"]'); if (r && await r.isVisible()) { await tryClick(r); continue; }
      const d = await p.$('#b-panel [data-act=bDef]:not(.right):not(.wrong):not(.dim)'); if (d) { await tryClick(d); continue; }
      if (await p.$('#sheet [data-act=mForget]')) await p.click('#sheet [data-act=mForget][data-k="-1"]');
    }
    return 'timeout';
  };

  // ---------- 第 2 镇：嘘声团 ----------
  await save({ 0: 1 }, {}); await p.reload(); await W(400);
  await p.click('[data-act=wEnter]'); await W(900);
  await go('t1', 'south');
  await W(1500);
  check(/Team Hush took our Color Crystal/.test(await en()) || /help us/.test(await en()), '村民跑来求助：' + await en());
  await closeDlg();
  await W(300);
  const g = await p.evaluate(() => { const d = EchoWorld._debug(), b = d.M.buildings.G, n = d.M.npcs.find(q => q.role === 'hush'); return { door: b.door, n: n && { x: n.x, y: n.y, name: n.name } }; });
  check(g.n && g.n.x === g.door.x && g.n.y === g.door.y + 1, '嘘声团员挡在道馆门口 ' + JSON.stringify(g.n));
  await p.screenshot({ path: out + '/c1-hush.png' });
  for (let k = 0; k < 2; k++) {
    if (k) await idle();
    const n = await p.evaluate(() => { const q = EchoWorld._debug().M.npcs.find(x => x.role === 'hush'); return q && { x: q.x, y: q.y }; });
    await tp(n.x, n.y + 1, 'up'); await A(); await closeDlg();
    await p.waitForSelector('#battle:not([hidden])', { timeout: 8000 });
    console.log('  hush battle ' + (k + 1) + ':', await fight());
    await closeDlg();
  }
  check(await p.isVisible('#w-dlg [data-act=wSelfDone]') || /magic words|Colors/.test(await p.textContent('#w-dlg')), '夺回水晶：要念出句子');
  for (let i = 0; i < 6 && !(await p.$('#w-dlg [data-act=wSelfDone]')); i++) await A();
  check(/Colors, come back!/.test(await p.textContent('#w-dlg .say-text')), '要念 "Red, yellow, blue and green. Colors, come back!"');
  await p.click('#w-dlg [data-act=wSelfDone]'); await W(300);
  await closeDlg();
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).world.flags);
  check(st['s:ch1'] === 1, '第 2 镇的剧情完成');

  // ---------- 道馆：雕像 ----------
  const gd = await p.evaluate(() => EchoWorld._debug().M.buildings.G.door);
  await tp(gd.x, gd.y + 1, 'up'); await p.keyboard.press('ArrowUp'); await W(800);
  check((await dbg()).map === 'i1G', '进了道馆');
  await tp(6, 2, 'up'); await A();
  check(/Welcome to my Gym/.test(await en()), '馆主先欢迎你');
  await A();
  check(/Light up three statues/.test(await en()), '馆主：先点亮三座雕像');
  await closeDlg();
  for (const [x, y] of [[1, 1], [11, 1], [1, 9]]) {
    await tp(x, y + 1, 'up'); await A(); await typed();
    const q = await p.textContent('#w-dlg .d-en');
    const ans = await p.evaluate(q => { for (const w of window.WORLDS) { const d = w.dlgs.find(x => x[0] === q); if (d) return d[1]; } return null; }, q);
    const opts = await p.$$('#w-dlg .opt');
    for (const o of opts) if ((await o.textContent()).trim() === ans) { await o.click(); break; }
    await p.click('#w-dlg [data-act=wSelfDone]'); await W(300);
    await closeDlg();
  }
  st = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('echo-island-v1')).world.flags).filter(k => k.startsWith('s:g1:')).length);
  check(st === 3, '点亮了三座雕像');
  await tp(6, 2, 'up'); await A(); await closeDlg();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 8000 });
  check(/道馆馆主/.test(await p.textContent('#battle .th-title')), '馆主接受挑战');
  await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]'); await W(600);

  // ---------- 4 号路：对手 ----------
  await go('r3', 'south');
  for (let i = 0; i < 12 && !(await dbg()).busy; i++) { await p.keyboard.press('ArrowUp'); await W(260); }
  await W(1600);
  check(/badge too|battle again/.test(await en()), '4 号路对手又来了：' + await en());
  await closeDlg();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 8000 });
  const rv = (await p.$$('.balls span')).length;
  check(rv === 2, '对手这次带了 2 只怪兽');
  console.log('  rival battle:', await fight());
  await closeDlg(); await W(1500);

  // ---------- 英语冠军赛 ----------
  await p.evaluate(() => { document.querySelector('[data-act=wExit]').click(); });
  const all = {}; for (let i = 0; i < 13; i++) all[i] = 1;
  await save(all, { 's:ch1': 1 }); await p.reload(); await W(400);
  await p.click('[data-act=wEnter]'); await W(800);
  await go('t12', 'door:C');
  const gu = await p.evaluate(() => !EchoWorld._debug().M.npcs.some(n => n.role === 'guard'));
  check(await p.evaluate(() => EchoWorld._debug().M.warps.some(w => w.to === 'i12L')), '最后一镇北边通往英语冠军赛会场');
  await go('i12L', 'mat');
  await tp(5, 1, 'up'); await p.keyboard.press('ArrowUp'); await W(800);
  check((await dbg()).map === 'i121', '进了第一位大师的房间');
  await tp(4, 2, 'up'); await A();
  check(/master of words/.test(await en()), '大师：Master Sage');
  await closeDlg();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 8000 });
  console.log('  master battle:', await fight());
  await closeDlg(); await W(400);
  const open = await p.evaluate(() => !EchoWorld._debug().M.npcs.some(n => n.role === 'master' && document));
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).world.flags['s:lg1']);
  check(st === 1, '打败第一位大师');
  await tp(4, 1, 'up'); await p.keyboard.press('ArrowUp'); await W(800);
  check((await dbg()).map === 'i122', '大师让开了，走进下一个房间');
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
