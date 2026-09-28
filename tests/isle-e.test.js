// 第 11–12 岛 + 冠军之路：天气岛（暴雪、气象台、气象塔冰面、塔顶天气机、攀瀑）、天气开关道馆、12 号路瀑布、
// 回忆岛（对手、欧瑞、记忆之门、默先生、回声龙）、回忆牌道馆、守卫、冠军之路（钢铁巨人、小凯）、冠军高原、冠军赛大厅
// 运行：node tests/isle-e.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const B = n => { const b = {}; for (let i = 0; i < n; i++) b[i] = 1; return b; };
  const BAG = { hm_surf: 1, hm_strength: 1, hm_smash: 1, hm_flash: 1, hm_cut: 1 };
  const flags = () => t.flags();
  const gateOpen = i => p.evaluate(i => { const d = EchoWorld._debug(), g = d.M.gates[i]; return !!g && d.M._open.has(g.x + ',' + g.y); }, i);
  const over = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M.over[y][x], [x, y]);
  const npc = pred => p.evaluate(src => { const f = new Function('n', 'return (' + src + ')(n)'); const n = EchoWorld._debug().M.npcs.find(q => f(q)); return n ? { id: n.id, x: n.x, y: n.y } : null; }, pred.toString());
  // 等主角停下来（冰面上会一直滑）
  const settle = async () => { for (let i = 0; i < 40; i++) { if (!(await p.evaluate(() => EchoWorld._debug().PL.moving))) { await W(90); if (!(await p.evaluate(() => EchoWorld._debug().PL.moving))) return; } await W(80); } };
  // 和 t.idle 一样，但是遇到选项页时用 choose(页) 决定点哪个
  const run = async choose => {
    for (let i = 0; i < 300; i++) {
      const s = await t.dbg();
      if (i && i % 60 === 0) { console.log('  (还在等剧情 ' + i + ') ' + JSON.stringify(s) + ' ' + JSON.stringify(await t.page())); await t.shot('_stuck').catch(() => {}); }
      if (await p.isVisible('#evo-ok')) { await p.click('#evo-ok'); await W(400); continue; }   // 怪兽进化了
      if (await p.isVisible('#battle')) { await t.fight(); continue; }
      if (!s.busy && !s.dlg) return;
      if (!s.dlg) { await W(150); continue; }
      const pg = await t.page();
      if (pg && pg.kind === 'choice' && choose) { const k = choose(pg); if (k != null) { await p.click('#w-dlg [data-act=wPick][data-i="' + k + '"]'); await W(300); continue; } }
      try { if (!(await t.task())) await t.A(); } catch (e) { await W(300); }   // 画面正在切到战斗：按钮一时点不到
    }
  };
  const idle = () => run(null);
  // 截图：机器忙的时候偶尔截不到，重试几次
  // 走一步；路上被训练师看到、剧情开始，就把它们播完
  const step = async (dir, n) => { for (let i = 0; i < (n || 1); i++) { if (process.env.TRACE) console.log('  step', dir, JSON.stringify(await t.dbg())); await t.walk(dir); if (process.env.TRACE) console.log('   walked'); await settle(); if (process.env.TRACE) console.log('   settled'); await idle(); await settle(); } };
  const shot = async name => { for (let i = 0; i < 4; i++) { try { await t.shot(name); return; } catch (e) { await W(800); } } console.log('  (截图失败 ' + name + ')'); };

  // =====================================================================
  // 第 11 岛：天气岛
  // =====================================================================
  await t.save({ map: 't11', arrive: 'from:r10', badges: B(11), bag: BAG, visited: { 0: 1, 11: 1 } });
  let s = await t.dbg();
  check(s.map === 't11', '到了天气岛 ' + JSON.stringify(s));
  await W(1200);
  check(/snowstorm/.test(await t.en()), '暴风雪开场：' + await t.en());
  const filt = await p.evaluate(() => document.querySelector('#w-view canvas').style.filter);
  check(/saturate/.test(filt), '暴雪：画面加了灰蓝滤镜 ' + filt);
  await idle();
  check((await flags())['s:w11in'] === 1, '村民问天气（answer 任务）→ 去找气象台');
  await shot('e01-t11-2d');

  // 塔门口的团员：还没问天气预报时不打
  await t.talkTo(n => n.id === 'hush11');
  check(/tower is closed/.test(await t.en()), '塔门口的团员不让进：' + await t.en());
  await idle();
  check(!(await flags())['s:w11door'], '还没问天气预报，不能打他');

  // 气象台：问收音机、听天气预报
  await t.go('i11W', 'from:t11');
  check((await t.dbg()).map === 'i11W', '进了气象台');
  await t.talkTo(n => n.id === 'skye');
  let sawRadio = false, sawSpeak = false;
  for (let i = 0; i < 40 && (await t.dbg()).dlg; i++) {
    const pg = await t.page();
    if (pg && pg.en && /weather report/.test(pg.en)) sawRadio = true;
    if (pg && pg.kind === 'speak' && /tomorrow/.test(pg.target)) sawSpeak = true;
    if (!(await t.task())) await t.A();
  }
  await idle();
  check(sawSpeak, '对收音机说 "What\'s the weather like tomorrow?"');
  check(sawRadio, '收音机播天气预报（只听不看）');
  check((await flags())['s:w11fc'] === 1, '拿到天气预报');
  await shot('e02-i11W');

  // 打败塔门口的团员
  await t.go('t11', 'from:i11W');
  await t.talkTo(n => n.id === 'hush11');
  await idle();
  check((await flags())['s:w11door'] === 1, '打败塔门口的团员');

  // 气象塔 1 楼：滑冰上到走廊（中途会被两个团员看到），控制台开门
  await t.go('d11a', 'from:t11');
  s = await t.dbg();
  check(s.map === 'd11a' && s.x === 8 && s.y === 13, '进了气象塔 ' + JSON.stringify(s));
  await shot('e03-d11a');
  await step('up'); await step('up');
  await step('up');
  s = await t.dbg();
  check(s.x === 8 && s.y === 6, '冰面：往上滑，撞到石头停下 ' + JSON.stringify(s));
  for (const d of ['right', 'down', 'left', 'up', 'right', 'up', 'up']) await step(d);
  s = await t.dbg();
  check(s.x === 7 && s.y === 2, '按正确路线滑到了上面的走廊 ' + JSON.stringify(s));
  await t.tp(4, 1, 'left'); await t.walk('left');
  check((await t.dbg()).x === 4, '楼梯前的机关门关着');
  await t.tp(9, 2, 'up'); await t.A(); await idle();
  check(await gateOpen(0), '控制台答对天气问题，楼梯的门开了');
  await t.tp(4, 1, 'left');
  await t.walk('left'); await t.walk('left'); await t.walk('left');
  await W(600);

  // 塔顶：低语、闷雷连打，然后按天气预报的顺序关掉天气机（先故意按错一次）
  s = await t.dbg();
  check(s.map === 'd11b', '上了塔顶 ' + JSON.stringify(s));
  await shot('e04-d11b');
  const order = ['Rainy', 'Sunny', 'Rainy', 'Windy'];
  let machineSeen = 0, wrongSeen = false;
  await run(pg => {
    if (!/^Button/.test(pg.en || '')) return null;
    machineSeen++;
    const want = order.shift();
    return pg.opts.findIndex(o => o.html.includes(want));
  });
  await W(300);
  let f = await flags();
  check(f['s:w11wh'] === 1 && f['s:w11rb'] === 1, '打败干部低语和闷雷');
  check(machineSeen === 4, '天气机：按错一次从头来，再按 晴 → 雨 → 风（按了 ' + machineSeen + ' 次按钮）');
  check(f['s:ch11'] === 1, '雪停了，夺回天气水晶（s:ch11）');
  check(f['s:got_falls'] === 1 && (await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.bag.hm_falls)) >= 1, '气象台台长送了攀瀑');

  // 12 号路：只有 11 枚徽章时爬不上瀑布
  await t.go('r11', 'from:t11');
  await shot('e05-r11-south');
  await t.tp(13, 28, 'up');
  await p.evaluate(() => { EchoWorld._debug().PL.surf = true; });
  await t.walk('up'); await W(300);
  check(/too strong|more badges/.test(await t.en()), '11 枚徽章：爬不上瀑布 ' + await t.en());
  await idle();

  // 天气道馆：先按错一次（多云），全部复位回起点；再按 晴 → 雨 → 风
  await t.go('i11G', 'from:t11');
  check((await t.dbg()).map === 'i11G', '进了天气道馆');
  let heardGym = false;
  for (let i = 0; i < 12 && (await t.dbg()).dlg; i++) { const pg = await t.page(); if (pg && /Sunny, then rainy, then windy/.test(pg.en || '')) heardGym = true; await t.A(); }
  await idle();
  check(heardGym, '道馆广播天气预报（只听不看）');
  check(await p.isVisible('#w-note'), '上方提示条：已打开 0/3');
  await shot('e06-i11G-2d');
  await t.tp(3, 14, 'left'); await t.A(); await idle();
  check(!(await gateOpen(2)), '按了「多云」：顺序错了，门没开');
  s = await t.dbg();
  check(s.x === 7 && s.y === 18, '按错了被送回起点 ' + JSON.stringify(s));
  await t.tp(11, 14, 'right'); await t.A(); await idle();
  check(await gateOpen(2), '晴天开关 → 第一扇门开了');
  await t.tp(7, 14, 'up'); await step('up'); await step('up');
  await t.tp(3, 11, 'left'); await t.A(); await idle();
  check(await gateOpen(1), '雨天开关 → 第二扇门开了');
  await t.tp(7, 11, 'up'); await step('up'); await step('up'); await step('up');
  s = await t.dbg();
  check(s.x === 7 && s.y === 5, '冰面：一直滑到关着的第三扇门前面 ' + JSON.stringify(s));
  await step('right'); await step('down'); await step('right', 3); await step('up');
  s = await t.dbg();
  check(s.x === 12 && s.y === 5, '滑到刮风开关旁边 ' + JSON.stringify(s));
  await t.key('ArrowRight'); await t.A(); await idle();
  check(await gateOpen(0), '刮风开关 → 第三扇门开了');
  check((await flags())['s:g11solved'] === 1, '天气开关全部按对');
  await step('down'); await step('left', 4); await step('up'); await step('up'); await step('up');
  s = await t.dbg();
  check(s.y === 2, '滑冰回到中间，穿过第三扇门走到馆主面前 ' + JSON.stringify(s));
  // 出去再进来，门还开着
  await t.go('t11', 'from:i11G'); await t.go('i11G', 'from:t11'); await idle();
  check(await gateOpen(0) && await gateOpen(2), '再进道馆，门还开着');
  await t.tp(7, 2, 'up'); await t.A(); await idle();
  let bg = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges);
  check(bg[11], '打赢天气鲸，拿到第 12 枚徽章');

  // 12 枚徽章 + 攀瀑：爬上瀑布
  await t.go('r11', 'from:t11');
  await t.tp(13, 28, 'up');
  await p.evaluate(() => { EchoWorld._debug().PL.surf = true; });
  await t.walk('up'); await idle(); await W(1500);
  s = await t.dbg();
  check(s.y <= 22 && s.surf, '用攀瀑爬上了瀑布 ' + JSON.stringify(s));
  await shot('e07-r11-falls');

  // =====================================================================
  // 第 12 岛：回忆岛
  // =====================================================================
  const F11 = { w11in: 1, w11fc: 1, w11door: 1, w11wh: 1, w11rb: 1, ch11: 1, got_falls: 1, g11solved: 1 };
  await t.save({ map: 't12', arrive: 'from:r11', badges: B(12), bag: Object.assign({ hm_falls: 1 }, BAG), flags: Object.assign({}, F11, { 't:d12a:tg2': 1, 't:d12a:tg3': 1 }), visited: { 0: 1, 12: 1 } });
  await W(1000);
  check(/fog/.test(await t.en()), '雾里的回忆岛：' + await t.en());
  await idle();
  f = await flags();
  check(f['s:rival5'] === 1, '对手 {rival} 在回忆岛和你比了第五场');
  await shot('e08-t12-2d');
  // 守卫：12 枚徽章过不去冠军之路
  await t.tp(29, 16, 'right'); await t.walk('right'); await t.walk('right');
  s = await t.dbg();
  check(s.x === 30 && s.map === 't12', '守卫挡住冠军之路（12 枚徽章）' + JSON.stringify(s));
  await idle();
  // 神殿门口的欧瑞
  await t.talkTo(n => n.id === 'orion');
  await idle();
  check((await flags())['s:m12orion'] === 1, '导师欧瑞：用过去时回答，放你进神殿');
  await t.tp(18, 4, 'up'); await t.walk('up'); await W(500);
  s = await t.dbg();
  check(s.map === 'd12a', '进了回忆神殿 ' + JSON.stringify(s));
  await idle();
  await shot('e09-d12a');
  // 记忆之门：先答错一次，门不开；再全答对
  await t.tp(14, 4, 'up'); await t.A(); await t.closeDlg();
  let pg = await t.page();
  check(pg && pg.kind === 'answer' && /Hush King/.test(pg.en), '记忆之门问石板上的故事：' + (pg && pg.en));
  const wrong = pg.opts.findIndex(o => !o.c);
  await p.click('#w-dlg .opt[data-i="' + wrong + '"]'); await W(1200);
  await idle();
  check(!(await gateOpen(0)), '答错了，记忆之门不开');
  await t.tp(14, 4, 'up'); await t.A(); await idle();
  check(await gateOpen(0), '两道题都答对，记忆之门开了');
  await t.walk('up'); await t.walk('up'); await t.walk('up'); await W(600);
  s = await t.dbg();
  check(s.map === 'd12b', '到了封印之间 ' + JSON.stringify(s));
  await run(null);
  f = await flags();
  check(f['s:m12mute'] === 1, '打败默先生');
  check(f['s:ch12'] === 1, '唤醒回声龙，收回水晶（s:ch12）');
  const ech = await npc(n => n.mon === 'echodrake');
  check(!!ech && ech.x === 10 && ech.y === 6, '回声龙落在封印之间 ' + JSON.stringify(ech));
  await shot('e10-d12b-echodrake');
  await t.talkTo(n => n.mon === 'echodrake'); await idle();
  f = await flags();
  check(f['s:leg:echodrake'] === 1, '和回声龙对战（打倒或收服）');

  // 回忆道馆：先翻错一对（翻回去），再把三组都配对
  await t.go('i12G', 'from:t12'); await idle();
  check(await p.isVisible('#w-note'), '上方提示条：踩牌配对');
  await shot('e11-i12G-2d');
  const flip = async (x, y, from) => { const [dx, dy, dir] = { up: [0, 1, 'up'], down: [0, -1, 'down'] }[from]; await t.tp(x + dx, y + dy, dir); await t.walk(dir); await idle(); };
  await flip(2, 14, 'down');
  check(await over(2, 14) === 'a', '翻开第一张牌：went');
  await flip(4, 14, 'down');
  check(await over(2, 14) === '?' && await over(4, 14) === '?', '"went" 和 "看见了" 不是一对：两张都翻回去');
  await flip(2, 14, 'down'); await flip(8, 14, 'down');
  check(await over(2, 14) === 'A' && await over(8, 14) === 'C', '"went" = "去了" 配对成功');
  await flip(10, 14, 'down'); await flip(4, 14, 'down');
  check(await gateOpen(2), '第一组两对都配好，石墙消失');
  await shot('e12-i12G-pairs');
  await flip(4, 10, 'up'); await flip(10, 10, 'up'); await flip(2, 10, 'up'); await flip(8, 10, 'up');
  check(await gateOpen(1), '第二组配好，第二道墙消失');
  await flip(2, 6, 'down'); await flip(10, 6, 'down'); await flip(4, 6, 'down'); await flip(8, 6, 'down');
  check(await gateOpen(0), '第三组配好，通往馆主的墙消失');
  await t.go('t12', 'from:i12G'); await t.go('i12G', 'from:t12'); await idle();
  check(await over(8, 6) === 'K' && await gateOpen(0), '再进道馆，配好的牌和门都还在');
  await t.tp(6, 2, 'up'); await t.A(); await idle();
  bg = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges);
  check(bg[12], '打赢回忆巨龙，拿到第 13 枚徽章');

  // =====================================================================
  // 冠军之路 → 冠军高原 → 冠军赛大厅
  // =====================================================================
  await t.go('t12', 'from:i12G');
  await t.tp(29, 16, 'right'); await t.walk('right'); await t.walk('right');
  check((await t.dbg()).x === 31, '13 枚徽章：守卫让开了');
  await t.go('v1', 'from:t12');
  check((await t.dbg()).map === 'v1', '到了冠军之路入口');
  await shot('e13-v1');
  await t.go('v2', 'from:v1');
  s = await t.dbg();
  check(s.map === 'v2', '进了冠军之路洞窟（漆黑）');
  check(await p.evaluate(() => EchoWorld._debug().M.dark), '洞窟是黑的，要用闪光');
  const ig = await npc(n => n.mon === 'irongiant');
  check(!!ig, '洞窟深处有钢铁巨人 ' + JSON.stringify(ig));
  await shot('e14-v2-dark');
  // 怪力：推开挡路的大石头
  await t.tp(18, 28, 'up'); await t.A(); await idle();
  await step('up', 3);
  s = await t.dbg();
  check(s.y === 25, '碎岩打碎了挡路的岩石 ' + JSON.stringify(s));
  await t.A(); await idle();
  await step('up', 2);
  s = await t.dbg();
  const bo = await p.evaluate(() => EchoWorld._debug().M._bould.map(b => b.x + ',' + b.y));
  check(s.y === 23 && bo.includes('18,22'), '怪力推着大石头往北走 ' + JSON.stringify(s) + ' ' + bo);
  await t.go('v3', 'from:v2');
  check((await t.dbg()).map === 'v3', '上了洞窟 2 楼');
  await t.tp(17, 8, 'up');
  await t.walk('up'); await t.walk('up'); await W(900);
  check(/I knew you would come/.test(await t.en()), '小凯在出口前等你：' + await t.en());
  await idle();
  check((await flags())['s:kai_final'] === 1, '和小凯的最后一战');
  await shot('e15-v3');
  await t.tp(17, 1, 'up'); await t.walk('up'); await W(600);
  s = await t.dbg();
  check(s.map === 'vL', '走出洞窟，到了冠军高原 ' + JSON.stringify(s));
  await shot('e16-vL-2d');
  await t.tp(12, 6, 'up'); await t.walk('up'); await W(600);
  check((await t.dbg()).map === 'i12L', '进了英语冠军赛大厅');
  await shot('e17-i12L');
  await t.tp(5, 1, 'up'); await t.walk('up'); await W(600);
  check((await t.dbg()).map === 'i121', '大厅北边通第一位大师的房间');
  await t.go('i12L', 'from:i121');
  await t.go('vL', 'from:i12L');
  await t.go('vLC', 'from:vL'); await t.talkTo(n => n.role === 'nurse'); await idle();
  await t.go('vL', 'from:vLC');
  check((await t.dbg()).map === 'vL', '冠军高原的怪兽中心出来还在高原上');

  // =====================================================================
  // 3D 截图
  // =====================================================================
  const FALL = Object.assign({}, F11, { rival5: 1, m12orion: 1, m12mute: 1, ch12: 1, 'leg:echodrake': 1, kai_final: 1 });
  const shot3d = async (map, arrive, name, tp) => {
    await t.save({ map, arrive, gfx: 'mid', badges: B(13), bag: Object.assign({ hm_falls: 1 }, BAG), flags: FALL, visited: { 0: 1, 11: 1, 12: 1 } });
    await idle();
    if (tp) await t.tp(...tp);
    await W(1500);
    await shot(name);
  };
  await shot3d('t11', 'from:r10', 'e20-t11-3d', [18, 16, 'up']);
  await shot3d('t11', 'door:A', 'e21-t11-tower-3d');
  await shot3d('i11G', 'from:t11', 'e22-i11G-3d', [7, 11, 'up']);
  await shot3d('d11a', 'from:t11', 'e23-d11a-3d', [8, 8, 'up']);
  await shot3d('r11', 'from:t12', 'e24-r11-3d', [13, 20, 'down']);
  await shot3d('t12', 'from:r11', 'e25-t12-3d', [18, 8, 'up']);
  await shot3d('d12a', 'from:t12', 'e26-d12a-3d', [14, 11, 'up']);
  await shot3d('i12G', 'from:t12', 'e27-i12G-3d', [6, 11, 'up']);
  await shot3d('v2', 'from:v1', 'e28-v2-3d', [18, 19, 'up']);
  await shot3d('vL', 'from:v3', 'e29-vL-3d', [12, 9, 'up']);
  await shot3d('v1', 'from:t12', 'e30-v1-3d', [17, 9, 'up']);

  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0], (e.stack || '').split('\n').filter(l => /isle-e|helpers/.test(l)).slice(0, 4).join(' / ')); process.exit(1); });
