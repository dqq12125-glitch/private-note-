// 开场剧情测试：博士介绍 → 选女孩 → 起名字 → 妈妈 → 出门看到博士被追 → 从包里选伙伴 → 第一场战斗 → 博士道谢 → 1 号路遇到对手
// 最后测老存档：已经有怪兽但没名字的，会补问一次名字
// 运行：node tests/story.test.js
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
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split(/\n/).slice(1, 4).join(' ')));
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false } })));
  await p.reload(); await p.waitForTimeout(400);
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dlg: !!d.dlg, busy: d.busy }; });
  const en = () => p.evaluate(() => { const e = document.querySelector('#w-dlg:not([hidden]) .d-en'); return e ? e.textContent : ''; });
  const typed = async () => { for (let i = 0; i < 50; i++) { const t = await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!t) return; await p.waitForTimeout(80); } };
  const A = async () => { await typed(); await p.click('#world [data-act=wA].ba'); await p.waitForTimeout(260); };
  // 一直按 A，直到出现 sel（选项、输入框、说话按钮……）
  const until = async (sel, max = 20) => { for (let i = 0; i < max; i++) { if (await p.$(sel)) return true; await A(); } return !!(await p.$(sel)); };
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));

  check(await p.isVisible('.new-game [data-act=wEnter]'), '首页显示「新的冒险」');
  await p.click('.new-game [data-act=wEnter]');
  await p.waitForTimeout(900);
  check(await p.isVisible('#w-scene.intro'), '开场：博士介绍的画面');
  await typed();
  await p.screenshot({ path: out + '/s1-intro.png' });
  check(await until('#w-dlg [data-act=wPick]'), '问男孩还是女孩');
  await p.screenshot({ path: out + '/s2-gender.png' });
  await p.click('#w-dlg [data-act=wPick][data-i="1"]');
  await p.waitForTimeout(400);
  check(await until('#w-dlg .nm'), '问名字');
  await p.screenshot({ path: out + '/s3-name.png' });
  await p.fill('#nm-in', 'coco');
  await p.click('#nm-ok');
  await p.waitForTimeout(300);
  check((await store()).player.name === 'Coco' && (await store()).player.gender === 'girl', '存下了女孩和名字 Coco');
  check(await until('#w-dlg [data-act=wSelfDone]'), '跟着说 My name is Coco');
  check(/My name is Coco/.test(await p.textContent('#w-dlg .say-text')), '台词里换成了名字');
  await p.click('#w-dlg [data-act=wSelfDone]');
  // 妈妈
  for (let i = 0; i < 14; i++) { await typed(); if (/Good morning/.test(await en())) break; await A(); }
  let s = await dbg();
  check(s.map === 'i0H' && /Good morning, Coco/.test(await en()), '在家醒来，妈妈叫名字 ' + s.map + ' ' + await en());
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/s4-mom.png' });
  for (let i = 0; i < 6 && (await dbg()).dlg; i++) await A();
  await p.waitForTimeout(300);
  // 走出家门
  await p.evaluate(() => { const d = EchoWorld._debug(); const e = d.M.warps[0]; d.PL.x = d.PL.fx = e.x; d.PL.y = d.PL.fy = e.y - 1; d.FL.x = d.FL.fx = e.x; d.FL.y = d.FL.fy = e.y - 2; });
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(1600);
  s = await dbg();
  check(s.map === 't0', '出门来到你好岛');
  check(/Help/.test(await en()), '听到博士喊救命');
  const chasers = await p.evaluate(() => EchoWorld._debug().M.npcs.filter(n => n.temp).map(n => n.mon || n.name));
  check(chasers.includes('zappy') && chasers.includes('Professor Echo'), '博士和野生怪兽出现 ' + JSON.stringify(chasers));
  await p.screenshot({ path: out + '/s5-chase.png' });
  check(await until('#w-scene.bag'), '打开博士的包（选伙伴画面）');
  await p.waitForTimeout(500);
  await p.screenshot({ path: out + '/s6-bag.png' });
  const mid = await p.textContent('#bg-prev b');
  await p.keyboard.press('ArrowRight');
  const right = await p.textContent('#bg-prev b');
  check(mid === 'Bubbly' && right === 'Sprouty', '左右键换球（' + mid + ' → ' + right + '）');
  await p.waitForTimeout(400);
  const off = await p.evaluate(() => { const h = document.getElementById('bg-hand').getBoundingClientRect(), b = document.querySelector('.bg-ball.on').getBoundingClientRect(); return Math.round((h.left + h.width / 2) - (b.left + b.width / 2)); });
  check(Math.abs(off) < 12, '手指指着选中的球（偏 ' + off + 'px）');
  await p.keyboard.press('Enter');
  check(/Do you choose Sprouty, the grass monster\?/.test(await p.textContent('#bg-box')), '问要不要选 Sprouty');
  await p.screenshot({ path: out + '/s7-ask.png' });
  await p.keyboard.press('Escape');
  check(!(await p.$('#bg-yes')), 'B 键取消');
  await p.click('.bg-ball[data-k="0"]');
  await p.click('.bg-ball[data-k="0"]');
  await p.click('#bg-yes');
  await p.waitForTimeout(1400);
  check(await until('#w-dlg [data-act=wSelfDone]', 3), '对伙伴说 I choose you');
  check(/Emberpup, I choose you!/.test(await p.textContent('#w-dlg .say-text')), '选的是 Emberpup');
  await p.click('#w-dlg [data-act=wSelfDone]');
  await p.waitForSelector('#battle:not([hidden])', { timeout: 6000 });
  check(!(await p.$('[data-act=bCatch]')), '第一场战斗不能收服');
  const fight = async () => {
    for (let k = 0; k < 200; k++) {
      await p.waitForTimeout(250);
      if (await p.$('#b-panel [data-act=bEnd]')) return (await p.textContent('#b-panel .b-result')).replace(/\s+/g, ' ');
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
  };
  console.log('  first battle:', await fight());
  await p.click('#b-panel [data-act=bEnd]');
  await p.waitForTimeout(900);
  check(/Coco/.test(await en()), '博士道谢：' + await en());
  for (let i = 0; i < 12 && (await dbg()).dlg; i++) await A();
  await p.waitForTimeout(400);
  let st = await store();
  check(st.world.flags['s:starter'] && st.mon.box[0].sp === 'emberpup' && st.mon.potions >= 4, '拿到伙伴和药水，剧情记下了');
  check(await p.evaluate(() => { const d = EchoWorld._debug(); return !!d.M.npcs.find(n => n.id === '1' && n.role === 'talk') && !d.M.npcs.some(n => n.temp); }), '博士回到镇上原来的位置');
  s = await dbg();
  check(!s.busy && !s.dlg, '剧情结束，可以自由走动');

  // ---------- 1 号路遇到对手 ----------
  await p.evaluate(() => EchoWorld._debug().goMap('r0', 'south'));
  await p.waitForTimeout(400);
  for (let i = 0; i < 10 && !(await dbg()).busy; i++) { await p.keyboard.press('ArrowUp'); await p.waitForTimeout(260); }
  await p.waitForTimeout(1800);
  await typed();
  check(/Coco/.test(await en()), '对手跑过来打招呼：' + await en());
  const rv = await p.evaluate(() => { const n = EchoWorld._debug().M.npcs.find(q => q.temp); return n && n.name; });
  check(rv === 'Leo', '选女孩，对手是 Leo');
  await p.screenshot({ path: out + '/s8-rival.png' });
  for (let i = 0; i < 6 && !(await p.isVisible('#battle')); i++) await A();
  await p.waitForSelector('#battle:not([hidden])', { timeout: 6000 });
  const foe = await p.textContent('.hpcard.foe b');
  check(foe === 'Bubbly', '对手的怪兽克制火系（' + foe + '）');
  console.log('  rival battle:', await fight());
  await p.click('#b-panel [data-act=bEnd]');
  await p.waitForTimeout(900);
  for (let i = 0; i < 6 && (await dbg()).dlg; i++) await A();
  await p.waitForTimeout(1500);
  st = await store();
  check(st.world.flags['s:rival1'] && !(await dbg()).busy, '对手剧情结束');

  // ---------- 老存档：有怪兽，没名字 ----------
  await p.evaluate(() => { document.querySelector('[data-act=wExit]').click(); });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); delete s.player; s.world.flags = {}; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=wEnter]');
  await p.waitForTimeout(900);
  check(await until('#w-dlg [data-act=wPick]'), '老存档：补问男孩还是女孩');
  await p.click('#w-dlg [data-act=wPick][data-i="0"]');
  check(await until('#w-dlg .nm'), '老存档：补问名字');
  await p.click('#w-dlg .nm[data-n=Tom]');
  check(await until('#w-dlg [data-act=wSelfDone]'), '老存档：说 My name is Tom');
  await p.click('#w-dlg [data-act=wSelfDone]');
  for (let i = 0; i < 6 && (await dbg()).dlg; i++) await A();
  await p.waitForTimeout(900);
  st = await store();
  check(st.player.name === 'Tom' && st.world.flags['s:starter'] && !(await dbg()).busy, '老存档：补完名字继续玩');
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
