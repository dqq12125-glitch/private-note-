// 野外技能（在测试专用的小地图上测，不依赖各岛的地图）：
// 秘传学习器 + 徽章才能用、居合斩、碎岩、怪力、冲浪、钓鱼、攀瀑（上下瀑布）、潜水和浮上来、冰面滑行、楼梯、闪光、飞空、自行车、藏起来的道具
// 运行：node tests/field.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const team = [['bubbly', 30], ['sprouty', 30], ['zappy', 30], ['songlet', 30]];
  // 测试场：左边是湖（瀑布通到上面的小湖、深水能潜水），右边有小树、裂石、大石头、冰面、楼梯
  const defineMaps = () => p.evaluate(() => {
    EchoMaps.define('zf1', {
      kind: 'route', z: 3, name: '测试场', en: 'Test Field', noGrass: true,
      rows: [
        'RRRRRRRRRRRRRRRRRRRR',
        'R~~~~~~~~RRRRRRRRRRR',
        'R~~~~~o~~R....%....R',
        'RRRRwwRRRR.........R',
        'R~~~ww~~~RRRRnRRRRRR',
        'R~~~~~~~~R.........R',
        'R~~~~~~~~R..b......R',
        'R~~DD~~~~R.........R',
        'R~~DD~~~~R..O......R',
        'R~~~~~~~~R.........R',
        'R........RIIIIIIII.R',
        'R...@...*..........R',
        'RRRRRRRRRRRRRRRRRRRR',
      ],
      items: ['superball'], hiddenItems: ['revive'],
      links: { '%': ['zf2'], D: ['zfu'] },
    });
    EchoMaps.define('zf2', { kind: 'cave', z: 3, name: '测试洞', rows: ['XXXXXXXXXX', 'X::::::::X', 'X::%:::::X', 'X::::::::X', 'XXXXXXXXXX'], links: { '%': ['zf1'] } });
    EchoMaps.define('zfu', { kind: 'under', z: 3, name: '测试海底', arena: 'under', rows: ['RRRRRRRRRR', 'R........R', 'R..U,,,..R', 'R..,,,,..R', 'RRRRRRRRRR'], links: { U: ['zf1'] } });
  });
  const enter = async (badges, bag) => {
    await p.evaluate(([team, badges, bag]) => localStorage.setItem('echo-island-v1', JSON.stringify({
      seenIntro: true, coins: 500, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false }, player: { gender: 'boy', name: 'Tom' },
      mon: { v: 2, box: team.map(([sp, lv], i) => ({ uid: 'u' + i, sp, lv, xp: 0 })), team: team.map((_, i) => 'u' + i), dex: {}, balls: 5, potions: 3, bag, badges },
      world: { v: 3, started: true, map: 'zf1', x: 4, y: 11, dir: 'up', repel: 9999, visited: { 0: 1, 1: 1, 2: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} },
    })), [team, badges, bag]);
    await p.reload(); await W(400);
    await defineMaps();
    await p.click('[data-act=wEnter]'); await W(900);
  };
  const say = async () => { await p.waitForSelector('#w-dlg [data-act=wSelfDone]'); await p.click('#w-dlg [data-act=wSelfDone]'); await W(300); await t.closeDlg(); };
  const cleared = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M._cleared.has(x + ',' + y), [x, y]);
  const zh = async () => { await t.typed(); return p.textContent('#w-dlg .d-zh'); };
  const B8 = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 };

  // ---------- 没有学习器 / 徽章不够 ----------
  await enter({}, {});
  check((await t.dbg()).map === 'zf1', '进了测试场');
  await t.tp(13, 5, 'up'); await t.A();
  check(/秘传学习器/.test(await zh()), '没有学习器：提示要先拿到秘传学习器');
  await t.closeDlg();
  await enter({ 0: 1 }, { hm_cut: 1 });
  await t.tp(13, 5, 'up'); await t.A();
  check(/3 枚徽章/.test(await zh()), '有学习器但徽章不够：提示要 3 枚徽章');
  await t.closeDlg();

  // ---------- 全部技能 ----------
  await enter(B8, { hm_cut: 1, hm_smash: 1, hm_strength: 1, hm_surf: 1, hm_fly: 1, hm_dive: 1, hm_falls: 1, hm_flash: 1, rod: 1, bike: 1, dowsing: 1 });
  // 居合斩
  await t.tp(13, 5, 'up'); await t.A();
  check(/cut the tree/.test(await p.textContent('#w-dlg .say-text')), '居合斩：要说 "Sprouty, cut the tree!"');
  await say();
  check(await cleared(13, 4), '小树被砍掉了');
  await t.walk('up');
  check((await t.dbg()).y === 4, '可以走过去了');
  // 楼梯：踩上去就到另一张图，踩回来回到楼梯旁边
  await t.tp(14, 3, 'up'); await t.walk('up'); await W(500);
  check((await t.dbg()).map === 'zf2', '走上楼梯到了洞穴');
  // 闪光
  await p.click('.w-menu'); await p.click('#sheet [data-act=wSkills]');
  await p.click('#sheet [data-act=wUseSkill][data-k=flash]');
  check(/light up the cave/.test(await p.textContent('#w-dlg .say-text')), '闪光：要说 "Zappy, light up the cave!"');
  await say();
  check(await p.evaluate(() => EchoWorld._debug().M._flash), '洞穴被照亮了');
  const st = await p.evaluate(() => { const m = EchoWorld._debug().M; const w = m.warps[0]; return w; });
  await t.tp(st.x, st.y + 1, 'up'); await t.walk('up'); await W(500);
  let s = await t.dbg();
  check(s.map === 'zf1' && Math.abs(s.x - 14) + Math.abs(s.y - 2) === 1, '走楼梯回来，站在楼梯旁边 ' + JSON.stringify(s));
  // 碎岩
  await t.tp(12, 7, 'up'); await t.A();
  check(/smash the rock/.test(await p.textContent('#w-dlg .say-text')), '碎岩：要说 "... smash the rock!"');
  await say();
  check(await cleared(12, 6), '岩石碎了');
  // 怪力
  await t.tp(12, 9, 'up'); await t.A();
  check(/push the rock/.test(await p.textContent('#w-dlg .say-text')), '怪力：要说 "... push the rock!"');
  await say();
  await t.walk('up'); await W(200);
  const bo = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  check(bo.y === 7 && (await t.dbg()).y === 8, '大石头被推开了一格，主角跟上 ' + JSON.stringify(bo));
  // 冰面：一直滑到撞墙
  await t.tp(18, 10, 'left'); await t.walk('left'); await W(1500);
  s = await t.dbg();
  check(s.x === 10 && s.y === 10, '在冰面上一直滑到头 ' + JSON.stringify(s));
  // 藏起来的道具 + 寻宝器
  await t.tp(8, 10, 'down'); await t.A(); await t.typed();
  check(/hidden/.test(await p.textContent('#w-dlg .d-en')), '对着它按 A 找到了藏起来的道具');
  await t.closeDlg();
  // 钓鱼
  await t.tp(6, 10, 'up'); await t.A();
  check(await p.isVisible('#w-dlg [data-act=wPick]'), '面对水：选冲浪还是钓鱼');
  await p.click('#w-dlg [data-act=wPick][data-i="1"]');
  await p.waitForSelector('#fish-opts .opt', { timeout: 8000 });
  check(true, '钓鱼：浮标动了，出现三个意思');
  await p.click('#fish-opts .opt'); await W(1200);
  const hooked = /钓上来了/.test(await p.textContent('#w-dlg .d-zh'));
  await t.A();
  if (hooked) { await p.waitForSelector('#battle:not([hidden])', { timeout: 6000 }); await W(2500); await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]'); await W(600); }
  // 冲浪
  await t.tp(4, 10, 'up'); await t.A();
  await p.click('#w-dlg [data-act=wPick][data-i="0"]');
  check(/let's surf/.test(await p.textContent('#w-dlg .say-text')), '冲浪：要说 "Bubbly, let\'s surf!"');
  await say(); await W(300);
  s = await t.dbg();
  check(s.surf && s.y === 9, '在水上冲浪');
  await t.shot('f2-surf');
  // 攀瀑：往上爬，爬到上面的小湖；再顺着瀑布冲下来
  await t.walk('up', 4);
  s = await t.dbg();
  check(s.y === 5, '冲浪到瀑布下面 ' + JSON.stringify(s));
  await t.walk('up');
  check(/climb the waterfall/.test(await p.textContent('#w-dlg .say-text')), '攀瀑：要说 "... climb the waterfall!"');
  await say(); await W(1500);
  s = await t.dbg();
  check(s.y === 2 && s.surf, '爬上了瀑布，到了上面的小湖 ' + JSON.stringify(s));
  await t.walk('down'); await W(1200);
  s = await t.dbg();
  check(s.y >= 5 && s.surf, '顺着瀑布冲下来 ' + JSON.stringify(s));
  // 潜水：冲浪到深水上按 A
  await t.tp(4, 7, 'up'); await p.evaluate(() => { EchoWorld._debug().PL.surf = true; });
  await t.A();
  check(/dive down/.test(await p.textContent('#w-dlg .say-text')), '潜水：要说 "... dive down!"');
  await say(); await W(700);
  s = await t.dbg();
  check(s.map === 'zfu', '潜到了海底');
  await t.shot('f3-under');
  await t.tp(3, 2, 'down'); await t.A(); await t.task(0); await W(900);
  s = await t.dbg();
  check(s.map === 'zf1' && s.surf, '从光圈浮上来，回到水面上 ' + JSON.stringify(s));
  // 上岸
  await t.tp(4, 9, 'down'); await p.evaluate(() => { EchoWorld._debug().PL.surf = true; });
  await t.walk('down');
  check(!(await t.dbg()).surf, '走上岸就不冲浪了');
  // 自行车
  await p.click('#w-bike');
  await p.keyboard.press('ArrowRight'); await W(30);
  check(await p.evaluate(() => EchoWorld._debug().PL.dur === 95), '骑车一步只要 95 毫秒');
  await W(300); await p.click('#w-bike');
  // 飞空
  await p.click('.w-menu'); await p.click('#sheet [data-act=wSkills]');
  await p.click('#sheet [data-act=wUseSkill][data-k=fly]');
  await p.click('#sheet [data-act=wFlyTo][data-z="1"]');
  await say(); await W(900);
  check((await t.dbg()).map === 't1', '飞空：飞到了彩色文具岛');
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
