// B 组（第 2–4 岛：温馨家庭岛、校园岛、学科岛）端到端测试：
// 三座岛的主线剧情各走一遍、三个道馆机关按正确解法走通（再故意错一次看会不会回起点）、秘传学习器、卡点、渡轮；最后截图（2D + 3D）
// 运行：node tests/isle-b.test.js
const H = require('./helpers');

(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const flags = () => t.flags();
  const bag = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.bag);
  const badges = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges).length);
  const gateOpen = i => p.evaluate(i => { const d = EchoWorld._debug(), g = d.M.gates[i]; return !!g && d.M._open.has(g.x + ',' + g.y); }, i);
  const npc = id => p.evaluate(id => { const n = EchoWorld._debug().M.npcs.find(q => q.id === id); return n ? { x: n.x, y: n.y } : null; }, id);
  const tileAt = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M.grid[y][x], [x, y]);
  const noteText = () => p.evaluate(() => { const n = document.getElementById('w-note'); return n && !n.hidden ? n.textContent : ''; });
  const talk = async id => { const ok = await t.talkTo(new Function('n', 'return n.id === ' + JSON.stringify(id))); await t.idle(200); return ok; };
  const at = async (x, y) => { const s = await t.dbg(); return s.x === x && s.y === y; };
  // 走一步（用方向键，会触发 step 钩子）
  // 存档后喷上驱怪喷雾，走路时不会遇到野生怪兽（测试不依赖随机）
  const save = async (o, who) => { who = who || t; await who.save(o); await who.p.evaluate(() => { const S = JSON.parse(localStorage.getItem('echo-island-v1')); S.world.repel = 99999; localStorage.setItem('echo-island-v1', JSON.stringify(S)); }); await who.p.reload(); await who.W(400); await who.p.click('[data-act=wEnter]'); await who.W(900); };
  const stepTo = async (x, y, dir) => { await t.tp(x, y, dir); await W(120); await t.walk(dir, 1); await t.idle(); };

  // FROM=4 node tests/isle-b.test.js：直接从第 4 岛开始（调试用）
  const FROM = +(process.env.FROM || 2);
  if (FROM < 4) {
  // ================= 第 2 岛 · 温馨家庭岛 =================
  console.log('--- 第 2 岛 温馨家庭岛 ---');
  await save({ map: 't2', arrive: 'from:r1', badges: { 0: 1, 1: 1 }, team: [['tidalfin', 60], ['flamewolf', 60], ['bigtooth', 40]] });
  await W(800);
  check(/Mom is calling/.test((await t.page() || {}).en || ''), '一上岛妈妈就打电话来');
  await t.idle();
  check((await flags())['s:f2call'], '妈妈的电话打完了');
  check(/小男孩/.test(await noteText()), '提示条：井边有个小男孩');
  await t.shot('b-t2-arrive');
  await talk('tim');
  let f = await flags();
  check(f['s:f2tim'], '蒂姆描述了他的家人（先听后选）');
  check(/找家人/.test(await noteText()), '提示条：帮蒂姆找家人');
  await talk('momB');
  check(!(await flags())['s:f2mom'], '问错了人（短头发）不算找到');
  await talk('mom');
  check((await flags())['s:f2mom'], '找到妈妈（长头发、红裙子）');
  await talk('dadB');
  await talk('dad');
  check((await flags())['s:f2dad'], '找到爸爸（眼镜、绿帽子）');
  await talk('granC');
  await talk('gran');
  f = await flags();
  check(f['s:f2gran'], '找到奶奶（白头发、在花园里）');
  check(!!(await npc('crow')) && /稻草人/.test(await noteText()), '三位家人都找到了，风车田里出现会动的稻草人');
  await t.shot('b-t2-family');
  await talk('crow');
  f = await flags();
  check(f['s:ch2'], '打败稻草人（嘘声团员），夺回家庭水晶 s:ch2');
  // 居合斩卡点：没有学习器、徽章不够时小树砍不掉
  await t.tp(17, 3, 'up'); await t.A(); await t.closeDlg(); await t.walk('up', 1);
  check(await at(17, 3) && (await tileAt(17, 2)) === 'n', '没有居合斩：北边路口的小树挡住去 3 号路');
  await t.go('i2A', 'from:t2');
  await talk('doc');
  check((await bag()).hm_cut > 0 && (await flags())['s:got_cut'], '树医生送了居合斩学习器');
  // 道馆：家族树迷宫
  await t.go('i2G', 'from:t2');
  await t.idle();
  check((await flags())['s:g2hi'] && /家族树/.test(await noteText()), '进道馆：广播描述要找的人，提示条显示家族树');
  await t.shot('b-i2G-maze');
  await talk('g1b');
  check(await at(8, 22) && !(await gateOpen(2)), '找错人（没戴眼镜的奶奶）被送回第一间的起点');
  await talk('g1');
  check(await gateOpen(2), '找对奶奶（白头发、戴眼镜）→ 第一扇门开');
  await talk('g2c');
  check((await flags())['t:i2G:g2c'], '找错人（绿外套的叔叔）要对战');
  await talk('g2');
  check(await gateOpen(1), '找对爸爸（黑帽子、蓝外套）→ 第二扇门开');
  await talk('g3b');
  check(await at(4, 10) && !(await gateOpen(0)), '找错人（马尾的姐姐）被送回第三间的起点');
  await talk('g3');
  check(await gateOpen(0), '找对妹妹（两条小辫子、粉裙子）→ 通馆主的门开');
  await talk('leader');
  check((await badges()) === 3, '打败海龟奶奶，拿到第 3 枚徽章');
  // 再进一次道馆，门一直开着
  await t.go('t2', 'door:G'); await t.go('i2G', 'from:t2'); await t.idle();
  check(await gateOpen(0) && await gateOpen(1) && await gateOpen(2), '解开过的机关门再来时还开着');
  // 砍树去 3 号路
  await t.go('t2', { x: 17, y: 3, dir: 'up' }); await t.idle();
  await t.A(); await t.idle();
  await t.walk('up', 3); await t.idle();
  check((await t.dbg()).map === 'r2', '用居合斩砍掉小树，走到 3 号路');
  await t.shot('b-r2');
  await t.tp(11, 29, 'up'); await t.walk('up', 2); await t.idle();
  check((await flags())['s:rival2'], '3 号路中间对手跑过来，第二次对战 s:rival2');

  // ================= 第 3 岛 · 校园岛 =================
  console.log('--- 第 3 岛 校园岛 ---');
  await t.go('t3', 'from:r2'); await t.idle();
  check((await flags())['s:f3in'], '上岛：钟声、贝尔老师和对手，嘘声团要取消英语课');
  await t.shot('b-t3');
  await talk('kai');
  check((await flags())['s:kai3'], '小凯来学校看你，打了一场小对战');
  await t.go('i3A', 'from:t3'); await t.idle();
  check((await flags())['s:f3note'] && !!(await npc('rv3')), '教学楼 1 楼：对手在走廊，发现低语的纸条');
  await t.shot('b-i3A');
  await talk('libr');
  check(!(await flags())['s:f3lab'], '还没问路时图书管理员只让你安静');
  await talk('amy');
  check((await flags())['s:f3lib'], '问路：Where is the library? → 在食堂旁边');
  await talk('libr');
  check((await flags())['s:f3lab'], '图书管理员：低语去了实验室（二楼）');
  await t.go('i3A2', 'from:i3A'); await t.idle();
  check(!!(await npc('g3')), '二楼实验室里有嘘声团员');
  await talk('g3');
  check((await flags())['s:f3grunt'], '打败实验室里的团员');
  await talk('sam');
  check((await flags())['s:f3c5'] && !!(await npc('wh3')), '问路：Where is Class Five? → 五班里出现低语');
  await t.shot('b-i3A2-whisper');
  await talk('wh3');
  check((await flags())['s:ch3'], '五班堵住干部低语，夺回校园水晶 s:ch3');
  await t.go('t3', { x: 22, y: 5, dir: 'up' }); await t.idle();
  await talk('miner');
  check((await bag()).hm_smash > 0, '矿工送了碎岩学习器');
  // 碎岩卡点：3 枚徽章不能碎岩
  await t.go('c3', 'from:t3'); await t.idle();
  await t.tp(14, 17, 'up'); await t.A(); await t.closeDlg(); await t.walk('up', 1);
  check(await at(14, 17) && (await tileAt(14, 16)) === 'b', '只有 3 枚徽章：隧道里的裂石挡住主路');
  // 山道：剧情做完，山顶出现念灵
  await t.go('r3m', 'from:t3'); await t.idle();
  check(await p.evaluate(() => EchoWorld._debug().M.npcs.some(n => n.mon === 'mindra')), '山道山顶出现神兽念灵');
  // 道馆：教室换座
  await t.go('i3G', 'from:t3'); await t.idle();
  check((await flags())['s:g3hi'], '进道馆：猫头鹰校长讲规则');
  await t.shot('b-i3G');
  // 故意答错一次
  await t.tp(3, 21, 'up'); await t.A();
  for (let i = 0; i < 10; i++) {
    const pg = await t.page();
    if (pg && pg.kind === 'answer') { const k = pg.opts.findIndex(o => !o.c); await p.click('#w-dlg .opt[data-i="' + k + '"]'); await W(1300); break; }
    await t.A();
  }
  await t.idle();
  check(await at(7, 25) && !(await gateOpen(2)), '黑板题答错：被请回座位（这间的起点）');
  await t.tp(3, 21, 'up'); await t.A(); await t.idle();
  check(await gateOpen(2), '第一间黑板（听力：Where is the office?）答对 → 门开');
  await talk('s2');
  await t.tp(11, 14, 'up'); await t.A(); await t.idle();
  check(await gateOpen(1), '第二间黑板（看图：实验室）答对 → 门开');
  await t.tp(3, 7, 'up'); await t.A(); await t.idle();
  check(await gateOpen(0), '第三间黑板（几楼）答对 → 校长室的门开');
  await talk('leader');
  check((await badges()) === 4, '打败猫头鹰校长，拿到第 4 枚徽章');
  // 碎岩穿过隧道
  await t.go('c3', 'from:t3'); await t.idle();
  await t.tp(14, 17, 'up'); await t.A(); await t.idle(); await t.walk('up', 2);
  await t.A(); await t.idle(); await t.walk('up', 3);
  check((await t.dbg()).y <= 13, '用碎岩打碎两块裂石，穿过隧道');
  await t.shot('b-c3');
  await t.go('r3', 'from:c3'); await t.idle();
  await t.shot('b-r3');

  }
  if (FROM === 4) await save({ map: 't4', arrive: 'from:r3', badges: { 0: 1, 1: 1, 2: 1, 3: 1 }, team: [['tidalfin', 60], ['flamewolf', 60], ['bigtooth', 40]], bag: { hm_cut: 1, hm_smash: 1 }, flags: { ch2: 1, ch3: 1, rival2: 1 } });
  // ================= 第 4 岛 · 学科岛 =================
  console.log('--- 第 4 岛 学科岛 ---');
  await t.go('t4', 'from:r3'); await t.idle();
  check((await flags())['s:f4in'], '上岛：助手诺娃求助，八爪博士的实验室被翻乱');
  await t.shot('b-t4');
  // 渡轮：没有 5 枚徽章不开
  await talk('gale');
  check((await t.dbg()).map === 't4', '只有 4 枚徽章：盖尔船长的渡轮不开');
  // 实验室：按课程表摆书（第一次故意选错，要重听一遍）
  await t.go('i4A', 'from:t4'); await t.idle();
  await t.talkTo(n => n.id === 'octo');
  const want = ['u', 'm', 'e', 's', 'c', 'u', 'p'];   // 第一个故意选错（音乐），重来以后按顺序
  let picked = 0, restarted = false;
  for (let i = 0; i < 200; i++) {
    const s = await t.dbg();
    if (await p.isVisible('#battle')) { await t.fight(); continue; }
    if (!s.busy && !s.dlg) break;
    const pg = s.dlg && await t.page();
    if (pg && pg.kind === 'choice') {
      const k = pg.opts.findIndex(o => o.html.includes('data-b="' + want[picked] + '"'));
      await t.task(k); picked++; continue;
    }
    if (pg && /Listen again/.test(pg.en || '')) restarted = true;
    if (s.dlg) { if (!(await t.task())) await t.A(); } else await W(150);
  }
  check(restarted, '摆错书：博士说顺序不对，重听课程表');
  check((await flags())['s:f4books'], '按课程表（周一、周二）把书摆回书架，发现静音石');
  await t.go('t4', { x: 34, y: 12, dir: 'up' }); await t.idle();
  check(!!(await npc('g4a')) && !!(await npc('g4b')), '卫星天线旁出现两个嘘声团员');
  await t.shot('b-t4-dish');
  await talk('g4a');
  check((await flags())['s:ch4'], '大声说话打破静音石，连打两个团员，夺回学科水晶 s:ch4');
  await t.go('i4A2', 'from:t4'); await t.idle();
  const sp0 = (await bag()).superpotion || 0;
  await talk('orion');
  check((await flags())['s:orion4'] && (await bag()).superpotion >= sp0 + 2, '天文台：导师欧瑞讲寂静之王和回声龙的传说，送了药');
  await t.shot('b-i4A2');
  // 道馆：课程表开关
  await t.go('i4G', 'from:t4'); await t.idle();
  check((await flags())['s:g4hi'] && /课程表/.test(await noteText()), '进道馆：广播念课程表');
  await t.shot('b-i4G');
  await stepTo(6, 15, 'up');   // 第一个就踩错（英语）
  check(await at(8, 22) && (await p.evaluate(() => EchoWorld._debug().M.over[14][2])) === 'm', '踩错顺序：开关复位，回到起点');
  for (const [x, y] of [[2, 15], [6, 15], [10, 15], [14, 15]]) await stepTo(x, y, 'up');
  check(await gateOpen(1), '第一张课程表：数学 → 英语 → 科学 → 音乐，门开');
  for (const [x, y] of [[2, 7], [14, 7], [6, 7], [10, 7]]) await stepTo(x, y, 'up');
  check(await gateOpen(0), '第二张课程表：历史 → 地理 → 美术 → 语文，门开');
  await t.shot('b-i4G-done');
  await talk('leader');
  check((await badges()) === 5, '打败八爪博士，拿到第 5 枚徽章');
  await t.go('t4', 'door:A'); await t.idle();
  await talk('gale');
  await W(2000);
  check((await t.dbg()).map === 't5', '有 5 枚徽章：坐盖尔船长的渡轮去社团岛');
  await t.done();

  // ================= 截图（3D） =================
  console.log('--- 3D 截图 ---');
  const u = await H.open();
  const shots = [['t2', 'from:r1', 'b3d-t2'], ['t2', { x: 26, y: 10, dir: 'up' }, 'b3d-t2-windmill'], ['i2G', 'from:t2', 'b3d-i2G'], ['t3', 'from:r2', 'b3d-t3'], ['t3', { x: 10, y: 11, dir: 'up' }, 'b3d-t3-school'], ['i3G', 'from:t3', 'b3d-i3G'],
    ['t4', 'from:r3', 'b3d-t4'], ['t4', { x: 19, y: 16, dir: 'up' }, 'b3d-t4-lab'], ['i4G', 'from:t4', 'b3d-i4G'], ['r2e', 'from:t2', 'b3d-r2e'], ['c3', 'from:t3', 'b3d-c3'], ['r4', 'from:t4', 'b3d-r4']];
  const all = { 's:f2call': 1, 's:f2tim': 1, 's:f2mom': 1, 's:f2dad': 1, 's:f2gran': 1, 's:ch2': 1, 's:g2hi': 1, 's:f3in': 1, 's:ch3': 1, 's:g3hi': 1, 's:f4in': 1, 's:f4books': 1, 's:g4hi': 1, 's:rival2': 1 };
  await save({ map: 't2', arrive: 'from:r1', gfx: 'mid', badges: { 0: 1, 1: 1 }, flags: all }, u);
  for (const [id, how, name] of shots) {
    await u.go(id, how); await u.idle(); await u.W(1500);
    await u.shot(name);
  }
  u.check(true, '3D 截图：' + shots.map(s => s[2]).join(' '));
  await u.done();
})();
