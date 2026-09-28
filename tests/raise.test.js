// 养成收集：养育屋送蛋、寄养两只出蛋、走路孵蛋、起英文昵称、每天和怪兽说话（亲密度）、面对跟着走的怪兽说话、异色、电脑分箱子、图鉴出没地点
// 运行：node tests/raise.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon);
  // 存档里 E.S 的内容要等游戏存盘；直接读 localStorage 前先让游戏存一次
  const save = () => p.evaluate(() => { const b = document.querySelector('[data-act=wA]'); return !!b; });
  await t.save({ map: 't2', x: 28, y: 27, badges: { 0: 1, 1: 1, 2: 1 }, team: [['tidalfin', 30], ['bubbly', 30], ['flamewolf', 30]], flags: { ch1: 1, ch2: 1 } });
  await t.idle();
  // ---------- 养育屋：第一次见面送一个蛋 ----------
  await t.tp(28, 27, 'up'); await t.A();
  for (let i = 0; i < 12 && !(await p.isVisible('#modal')); i++) { if ((await t.dbg()).dlg) await t.A(); else await W(200); }
  check(await p.isVisible('#sheet [data-act=mDayLeave]'), '养育屋：打开寄养的窗口');
  let m = await st();
  check(m.box.some(x => x.egg && x.sp === 'moonbunny') && m.team.length === 4, '奶奶送了一个蛋，放进了队伍');
  // 寄养两只水系的
  const uids = m.team.slice(0, 2);
  for (const u of uids) { await p.click('#sheet [data-act=mDayLeave][data-u="' + u + '"]'); await W(300); }
  m = await st();
  check(m.day.mons.length === 2 && m.team.length === 2, '寄养了两只怪兽（队伍里剩下火系的和蛋）');
  check(/相处得很好/.test(await p.textContent('#sheet')), '两只都是水系：相处得很好');
  await p.click('#sheet [data-act=close]');
  // 走 180 步：出蛋
  await p.evaluate(() => { for (let i = 0; i < 180; i++) MonsterGame.stepHook(); });
  await p.evaluate(() => MonsterGame.daycareSheet()); await W(200);
  check(await p.isVisible('#sheet [data-act=mDayEgg]'), '走了一段路，养育屋里有蛋了');
  await p.click('#sheet [data-act=mDayEgg]'); await W(300);
  // 领回一只：长了等级
  await p.click('#sheet [data-act=mDayTake][data-i="0"]'); await W(300);
  m = await st();
  check(m.box.filter(x => x.egg).length === 2, '收下了第二个蛋');
  check(m.box.some(x => x.sp === 'tidalfin' && x.lv === 31), '领回来的怪兽长了 1 级（走了 180 步）');
  await p.click('#sheet [data-act=close]');
  // ---------- 孵蛋：走路，快孵出来时再走一步 ----------
  await p.evaluate(() => { for (let i = 0; i < 2000; i++) { const e = MonsterGame.stepHook(); if (e && e.hatch) break; } });
  await t.tp(27, 28, 'down'); await t.walk('down'); await W(600);
  check(/The egg is moving/.test(await t.en()), '蛋在动！');
  for (let i = 0; i < 20 && !(await p.isVisible('#sheet [data-act=mNickPick]')); i++) { if (await p.$('#w-dlg [data-act=wSelfDone]')) { await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); } else if ((await t.dbg()).dlg) await t.A(); else await W(200); }
  check(await p.isVisible('#sheet [data-act=mNickPick]'), '孵出来以后问要不要起英文名字');
  await t.shot('r1-nick');
  const pickName = await p.textContent('#sheet [data-act=mNickPick]');
  await p.click('#sheet [data-act=mNickPick]'); await W(300);
  check(/Your name is/.test(await p.textContent('#nick-say')), '起名字要说 "Your name is ...!"');
  await p.click('#sheet [data-act=mNickGo]'); await W(500);
  m = await st();
  const baby = m.box.find(x => x.nick === pickName.trim());
  check(!!baby && !baby.egg && baby.lv === 5 && m.dex[baby.sp] === 'caught', '孵出了 5 级的小怪兽，名字叫 ' + pickName.trim());
  // ---------- 每天和怪兽说话 ----------
  await p.evaluate(u => MonsterGame.talkSheet(u), baby.uid); await W(300);
  check(await p.isVisible('#talk-say'), '和它说说话：要念一句英语');
  const fr0 = baby.fr;
  await p.click('#sheet [data-act=mTalkGo]'); await W(300);
  m = await st();
  check(m.box.find(x => x.uid === baby.uid).fr === fr0 + 12, '亲密度 +12');
  await p.click('#sheet [data-act=close]');
  await p.evaluate(u => MonsterGame.talkSheet(u), baby.uid); await W(300);
  check(/今天已经聊过了/.test(await p.textContent('#sheet')), '一天只能聊一次');
  await p.click('#sheet [data-act=close]');
  // 面对跟着走的怪兽按 A
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = 27; d.PL.y = d.PL.fy = 28; d.PL.dir = 'down'; d.FL.x = d.FL.fx = 27; d.FL.y = d.FL.fy = 29; });
  await t.A(); await W(300);
  check(await p.isVisible('#sheet .frh'), '面对跟着走的怪兽按 A：和它说话');
  await t.shot('r2-talk');
  await p.click('#sheet [data-act=close]').catch(() => {});
  if (await p.isVisible('#modal')) await p.click('#sheet [data-act=mTalkBack], #sheet [data-act=close]');
  // ---------- 异色 ----------
  const sh = await p.evaluate(() => { const a = MonsterGame.species('bubbly'), b = MonsterGame.spOf({ sp: 'bubbly', shiny: true }); return { a: a.c, b: b.c, id: b.id }; });
  check(sh.a !== sh.b && sh.id === 'bubbly_shiny', '异色换了一套颜色 ' + JSON.stringify(sh));
  await p.evaluate(() => { window.__forceShiny = true; MonsterGame.battle('wild', 2, { onEnd: () => {} }); });
  await W(2500);
  check(/✨/.test(await p.textContent('#battle .hpcard.foe')), '战斗里：异色的野生怪兽名字前有 ✨');
  await t.shot('r3-shiny');
  await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]').catch(() => {}); await W(600);
  await p.evaluate(() => { window.__forceShiny = false; });
  // ---------- 电脑分箱子 ----------
  await p.evaluate(() => MonsterGame.pcSheet()); await W(200);
  check(await p.$$eval('#sheet .pc-tabs .btn', b => b.length) === 8, '电脑有 8 个箱子');
  const bench = (await st()).team.find(u => u !== baby.uid);
  await p.click('#sheet [data-act=mBench][data-u="' + bench + '"]'); await W(200);
  await p.click('#sheet [data-act=mMoveAsk][data-u="' + bench + '"]'); await W(200);
  await p.click('#sheet [data-act=mMoveTo][data-b="2"]'); await W(200);
  await p.click('#sheet [data-act=mBox][data-b="2"]'); await W(200);
  check(await p.isVisible('#sheet [data-act=mJoin][data-u="' + bench + '"]'), '把一只怪兽搬到了箱子 3');
  await t.shot('r4-pc');
  await p.click('#sheet [data-act=close]');
  // ---------- 图鉴：出没地点 ----------
  const hab = await p.evaluate(() => { const L = DEX.list.filter(s => s.no <= 151).map(s => [s.id, MonsterGame.habitats(s.id)]).filter(x => x[1].length); return { n: L.length, one: L[0] }; });
  check(hab.n > 20, '图鉴里 ' + hab.n + ' 种怪兽标出了出没地点，比如 ' + JSON.stringify(hab.one).slice(0, 80));
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
