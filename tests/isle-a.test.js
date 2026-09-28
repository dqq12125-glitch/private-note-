// 第 0–1 岛：你好岛道馆（问候之门）、1 号路对手、回声洞（欧瑞、闪光）、彩色文具岛（颜色被偷、涂鸦森林、小凯、彩色地板道馆）
// 运行：node tests/isle-a.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const gateOpen = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M.tile ? null : null, [x, y]).then(() => p.evaluate(([x, y]) => { const d = EchoWorld._debug(); return !!(d.M._open && d.M._open.has(x + ',' + y)); }, [x, y]));
  // 走一步；路上被训练师看到就把对战打完
  const step = async (dir, n) => { for (let i = 0; i < (n || 1); i++) { await t.walk(dir); await t.idle(); } };

  // ---------- 你好岛道馆：问候之门 ----------
  await t.save({ map: 't0', x: 14, y: 9, team: [['tidalfin', 40], ['flamewolf', 40]] });
  await t.shot('a01-t0');
  let s = await t.dbg();
  check(s.map === 't0', '在你好岛');
  // 守卫挡住北边
  await t.tp(14, 3, 'up'); await t.walk('up');
  check((await t.dbg()).y === 3, '守卫挡住北边（没有徽章）');
  await t.go('i0G', 'from:t0');
  check((await t.dbg()).map === 'i0G', '进了你好岛道馆');
  await t.shot('a02-gym0');
  // 第一道门（早上）：答对开门
  await t.tp(9, 13, 'up'); await t.A(); await t.closeDlg();
  let pg = await t.page();
  check(pg && pg.kind === 'answer' && pg.opts.find(o => o.c).t === 'Good morning!', '第一道门要说 Good morning!');
  await t.task(); await t.idle();
  check(await gateOpen(9, 12), '早上的门开了');
  // 第二道门（下午）：故意答错，回到门口
  await t.tp(4, 9, 'up'); await t.A(); await t.closeDlg();
  pg = await t.page();
  const wrong = pg.opts.findIndex(o => !o.c);
  await p.click('#w-dlg .opt[data-i="' + wrong + '"]'); await W(1200);
  await t.idle();
  s = await t.dbg();
  check(s.x === 6 && s.y === 15, '答错了被送回门口 ' + JSON.stringify(s));
  await t.tp(4, 9, 'up'); await t.A(); await t.task(); await t.idle();
  check(await gateOpen(4, 8), '下午的门开了');
  await t.tp(6, 5, 'up'); await t.A(); await t.task(); await t.idle();
  check(await gateOpen(6, 4), '晚上的门开了');
  await t.tp(6, 2, 'up'); await t.A(); await t.idle();
  const badges = (await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges));
  check(badges[0], '打赢鹦鹉船长，拿到第 1 枚徽章');
  // 门记住了：出去再进来还开着
  await t.go('t0', 'from:i0G'); await t.go('i0G', 'from:t0');
  check(await gateOpen(6, 4), '再进道馆，门还开着');

  // ---------- 1 号路：对手 ----------
  await t.save({ map: 't0', x: 14, y: 9, badges: { 0: 1 }, flags: { rival1: 0 }, team: [['tidalfin', 40]] });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); delete s.world.flags['s:rival1']; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
  await p.reload(); await W(400); await p.click('[data-act=wEnter]'); await W(900);
  await t.go('r0', 'from:t0');
  await t.shot('a03-r0');
  await t.tp(11, 33, 'up');
  for (let i = 0; i < 5 && !(await t.dbg()).busy; i++) await t.walk('up');
  await W(1200);
  check(/You must be Coco/.test(await t.en()), '1 号路对手跑过来：' + await t.en());
  await t.idle();
  check((await t.flags())['s:rival1'] === 1, '对手剧情做完');

  // ---------- 海边悬崖 → 回声洞 ----------
  await t.go('r0b', 'from:r0');
  check((await t.dbg()).map === 'r0b', '从 1 号路往东到海边悬崖');
  await t.shot('a04-r0b');
  await t.go('c0', 'from:r0b');
  check((await t.dbg()).map === 'c0', '进了回声洞');
  await t.talkTo(n => n.id === 'flashman'); await t.idle();
  const bag = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.bag);
  check(bag.hm_flash === 1, '登山家送了闪光的秘传学习器');
  await t.talkTo(n => n.id === 'orion'); await t.idle();
  check((await t.flags())['s:z0orion'] === 1, '在回声洞认识了导师欧瑞');
  await t.shot('a05-c0');

  // ---------- 彩色文具岛：颜色被偷 ----------
  await t.save({ map: 'r0', x: 11, y: 2, badges: { 0: 1 }, team: [['tidalfin', 40], ['flamewolf', 40]] });
  await t.go('t1', 'from:r0'); await W(1500);
  check(/What colour is my house/.test(await t.en()), '画家跑来：颜色都没了');
  const grey = await p.evaluate(() => [...document.querySelectorAll('#w-view canvas')].some(c => /grayscale/.test(c.style.filter)));
  check(grey, '整座岛变成灰色');
  await t.shot('a06-t1-grey');
  await t.idle();
  check((await t.flags())['s:z1intro'] === 1, '画家的剧情做完');
  // 涂鸦森林：团员逃跑、小凯、夺回水晶
  await t.go('f1', 'from:t1'); await W(1200);
  check(/can't catch me/.test(await t.en()), '团员看见你就跑');
  await t.idle();
  await t.tp(13, 32, 'up');
  for (let i = 0; i < 4 && !(await t.dbg()).busy; i++) await t.walk('up');
  await W(1000);
  check(/wait/i.test(await t.en()), '小凯追上来');
  await t.idle();
  check((await t.flags())['s:z1kai'] === 1, '帮小凯收服了第一只怪兽');
  await t.talkTo(n => n.id === 'wh0'); await t.idle();
  await t.talkTo(n => n.id === 'wh1'); await t.idle();
  check((await t.flags())['s:ch1'] === 1, '打败两个团员，夺回颜色水晶');
  // 北边的巡林员：只有 1 枚徽章过不去
  await t.tp(14, 3, 'up'); await t.walk('up');
  check((await t.dbg()).y === 3, '森林北边的巡林员挡路（1 枚徽章）');
  await t.shot('a07-f1');
  await t.go('t1', 'from:f1');
  const grey2 = await p.evaluate(() => [...document.querySelectorAll('#w-view canvas')].some(c => /grayscale/.test(c.style.filter)));
  check(!grey2, '颜色回来了');
  await t.talkTo(n => n.id === 'painter'); await t.idle();
  check((await t.flags())['s:z1thanks'] === 1, '画家道谢');
  await t.shot('a08-t1');

  // ---------- 彩色文具岛道馆：彩色地板 ----------
  await t.go('i1G', 'from:t1'); await W(800);
  pg = await t.page();
  check(pg && pg.kind === 'answer' && pg.en === 'Walk on red!', '广播：Walk on red!（只听不看）');
  await t.idle();
  check(await p.isVisible('#w-note'), '提示条显示要踩的颜色');
  await t.shot('a09-gym1');
  // 故意踩错
  await step('right'); await step('up');
  s = await t.dbg();
  check(s.x === 6 && s.y === 20, '踩错颜色回起点 ' + JSON.stringify(s));
  await t.tp(6, 20, 'up');
  for (const d of ['up', 'left', 'up', 'left', 'up', 'up']) await step(d);
  check(await gateOpen(6, 15), '红色这段走完，门开了');
  await step('right', 2); await step('up', 2);
  for (const d of ['up', 'up', 'right', 'right', 'up', 'up']) await step(d);
  check(await gateOpen(6, 9), '蓝色这段走完，门开了');
  s = await t.dbg();
  await step('left', s.x - 6); await step('up', 2);
  s = await t.dbg();
  await step('left', s.x - 4);
  for (const d of ['up', 'up', 'left', 'left', 'up', 'up']) await step(d);
  check(await gateOpen(6, 3), '黄色这段走完，通往馆主的门开了');
  await step('right', 4); await step('up', 2);
  await t.A(); await t.idle();
  const b2 = (await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges));
  check(b2[1], '打赢彩虹蟹，拿到第 2 枚徽章');

  // ---------- 3D 截图 ----------
  const tour = [['t0', 'from:r0', 'a10-t0-3d'], ['r0', 'from:t0', 'a11-r0-3d'], ['t1', 'from:r0', 'a12-t1-3d'], ['f1', 'from:t1', 'a13-f1-3d'], ['r1w', 'from:t1', 'a14-r1w-3d'], ['r1', 'from:f1', 'a15-r1-3d'], ['i1G', 'from:t1', 'a16-gym1-3d'], ['c0', 'from:r0b', 'a17-c0-3d']];
  await t.save({ map: 't0', x: 14, y: 9, badges: { 0: 1, 1: 1 }, gfx: 'mid', flags: { ch1: 1, z1intro: 1, z1chase: 1, z1kai: 1, z1thanks: 1 } });
  for (const [id, how, name] of tour) { await t.go(id, how); await W(1200); await t.idle(); await t.shot(name); }
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
