// C 组（第 5–7 岛：社团岛、作息岛、生日派对岛）端到端测试
// 从进岛开始把三座岛的主线剧情各走一遍；三个道馆机关按正确解法走通（也故意错一次）；秘传学习器、守卫、大石头、冲浪、潜水、渡轮
// 运行：node tests/isle-c.test.js
const H = require('./helpers');

// 选项题（拨钟、生日日历）：按这一页的英文找对的选项（选项里有 data-v）
const ANS = {
  'When does the baker get up?': '5:00', 'When does the student get up?': '6:30', 'When does the mayor get up?': '7:00',
  "It's three o'clock.": '3:00', "It's half past six.": '6:30', "It's a quarter past four.": '4:15',
  'My birthday is on October 1st.': '10月1日', 'My birthday is on May 2nd.': '5月2日', "It's on June 12th. I make my own cake!": '6月12日',
};

(async () => {
  const t = await H.open();
  const { p, W } = t;
  setTimeout(() => { console.log('FAIL 超时（25 分钟）'); process.exit(1); }, 25 * 60 * 1000).unref();
  const flags = () => t.flags();
  const bag = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.bag || {});
  const badges = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges).length);
  const pick = async (pg, v) => { const k = pg.opts.findIndex(o => (o.html || '').includes('data-v="' + v + '"')); await t.task(k); };
  // 画面在切换（进战斗、换地图）时按钮会点不到：点不到就等下一轮
  const safe = async fn => { try { return await fn(); } catch (e) { await W(300); return true; } };
  const modal = () => t.modal();
  // 和 t.idle 一样，但选项题会选对的
  async function idle(max) {
    for (let i = 0; i < (max || 240); i++) {
      if (await modal()) continue;
      const s = await t.dbg();
      if (await p.isVisible('#battle')) { await t.fight(); continue; }
      if (!s.busy && !s.dlg) return;
      if (s.dlg) {
        const pg = await t.page();
        if (pg && pg.kind === 'choice' && ANS[pg.en]) { await safe(() => pick(pg, ANS[pg.en])); continue; }
        if (!(await safe(() => t.task()))) await safe(() => t.A());
      } else await W(150);
    }
  }
  // 一直按 A，直到出现选项题（返回这一页）
  async function untilChoice() {
    for (let i = 0; i < 40; i++) {
      if (await modal()) continue;
      if (await p.isVisible('#battle')) { await t.fight(); continue; }
      const pg = await t.page();
      if (pg && pg.kind === 'choice') return pg;
      if (!(await t.dbg()).dlg) { await W(150); continue; }
      if (!(await safe(() => t.task()))) await safe(() => t.A());
    }
    return null;
  }
  const by = (k, v) => new Function('n', 'return n.' + k + ' === ' + JSON.stringify(v));
  const talk = async (k, v) => { const ok = await t.talkTo(by(k, v)); await idle(); return ok; };
  const note = () => p.evaluate(() => { const n = document.getElementById('w-note'); return n && !n.hidden ? n.textContent : ''; });
  const gateOpen = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M._open.has(x + ',' + y), [x, y]);
  const over = (x, y) => p.evaluate(([x, y]) => { const m = EchoWorld._debug().M; return m.over[y][x]; }, [x, y]);
  const step = async (dir, n) => { await t.walk(dir, n || 1); await idle(); };
  const at = async () => { const s = await t.dbg(); return s.map + ' ' + s.x + ',' + s.y; };
  const dlgText = () => p.evaluate(() => { const d = document.querySelector('#w-dlg:not([hidden])'); return d ? d.textContent : ''; });

  // ======================= 第 5 岛 社团岛 =======================
  await t.save({ map: 't5', arrive: 'start', badges: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, team: [['tidalfin', 40], ['flamewolf', 40]], bag: {} });
  await idle();
  let f = await flags();
  t.check(f['s:c5intro'] === 1, '社团岛：主持人波波迎接，问 "What can you do?"');
  t.check(/社团贴纸 0\/3/.test(await note()), '提示条显示社团贴纸 0/3');
  await t.shot('c5-t5');
  // 没集齐贴纸时进大帐篷：不开演
  await t.go('i5A', 'mat'); await idle();
  f = await flags();
  t.check(!f['s:c5hush'] && !f['s:ch5'], '没集齐贴纸时，大帐篷里不开演');
  await t.go('t5', 'door:A'); await idle();
  for (const k of ['music', 'dance', 'art']) await talk('tag', k);
  f = await flags();
  t.check(f['s:c5club_music'] && f['s:c5club_dance'] && f['s:c5club_art'], '音乐社、舞蹈社、美术社：听问题选回答，拿到 3 张贴纸');
  // 从门走进大帐篷：才艺表演
  await t.tp(18, 6, 'up'); await t.walk('up'); await W(300);
  t.check((await t.dbg()).map === 'i5A', '走进才艺大帐篷');
  await W(1500); await t.shot('c5-show');
  await idle(400);
  f = await flags();
  t.check(f['s:c5hush'] === 1, '嘘声团弄坏音响：打败团员');
  t.check(f['s:ch5'] === 1, '清唱 → 全场鼓掌 → 夺回社团水晶（ch5）');
  // 大力士送怪力
  await t.go('t5', 'door:A'); await idle();
  await talk('name', 'Strongman Max');
  t.check((await bag()).hm_strength === 1, '大力士送了怪力秘传学习器');
  // 5 枚徽章：大石头推不动
  await t.go('r5', 'from:t5'); await idle();
  await t.tp(23, 11, 'right'); await t.A();
  t.check(/6 枚徽章/.test(await dlgText()), '沙丘道：只有 5 枚徽章，大石头推不动（要 6 枚）');
  await t.closeDlg(); await idle();
  // 道馆：音符地板
  await t.go('i5G', 'mat'); await idle();
  await step('up'); await step('up');
  t.check(/按顺序踩/.test(await note()), '音符道馆：走到起点，广播放了第 1 段音乐');
  await step('left'); await step('up');
  t.check(await at() === 'i5G 7,15', '踩错音符（🎸）回到起点：' + await at());
  await step('up'); await step('up');
  t.check(await gateOpen(7, 12), '第 1 段：鼓 → 钢琴，门打开了');
  await step('up'); await step('up');
  await step('left', 3); await step('up'); await step('up'); await step('right');
  t.check(await gateOpen(7, 8), '第 2 段：吉他 → 鼓 → 钢琴，门打开了');
  await t.shot('c5-gym');
  await step('right'); await step('up'); await step('up');
  await step('right', 4); await step('up'); await step('up'); await step('up'); await step('left');
  t.check(await gateOpen(7, 3), '第 3 段：Do → Mi → Sol → Do，最后的门打开了');
  f = await flags();
  t.check(f['gate:i5G:0'] && f['gate:i5G:6'], '解开的门存档记住');
  await t.talkTo(n => n.role === 'leader'); await idle(400);
  t.check(await badges() === 6, '打败火烈鸟乐手，拿到第 6 枚徽章');
  // 沙丘道：大石头谜题（推错了离开再回来会复位）
  await t.go('r5', 'from:t5'); await idle();
  await t.tp(23, 11, 'right'); await t.A(); await idle();
  await step('right', 4);
  let bo = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  t.check(bo.x === 28 && bo.y === 11, '一直往前推：大石头卡进窄峡谷 ' + JSON.stringify(bo));
  await t.go('t5', 'from:r5'); await idle();
  await t.go('r5', 'from:t5'); await idle();
  bo = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  t.check(bo.x === 24 && bo.y === 11, '离开再回来，大石头回到原位');
  await t.tp(23, 11, 'right'); await t.A(); await idle();
  await step('right', 3); await step('down'); await step('right'); await step('up');
  bo = await p.evaluate(() => EchoWorld._debug().M._bould[0]);
  t.check(bo.x === 27 && bo.y === 10, '把大石头推进小凹洞 ' + JSON.stringify(bo));
  await step('right', 5); await step('up', 4); await step('right');
  t.check(await at() === 'r5 33,7', '峡谷打通了，到了沙丘道东边：' + await at());
  await t.shot('c5-r5');

  // ======================= 第 6 岛 作息岛 =======================
  await t.go('t6', 'from:r5'); await idle();
  f = await flags();
  t.check(f['s:c6call'] === 1, '作息岛：妈妈打电话问几点睡觉，钟楼停了');
  // 登山管理员：6 枚徽章挡住钟山
  await t.tp(19, 8, 'up'); await t.walk('up');
  t.check(await at() === 't6 19,8', '登山管理员挡住钟山的窄路（6 枚徽章）');
  await t.A();
  t.check(/7 枚徽章/.test(await p.evaluate(() => EchoWorld._debug().dlg.pages.map(q => q.zh).join(' '))), '管理员说要 7 枚徽章');
  await t.closeDlg(); await idle();
  // 钟楼：团员
  await t.tp(18, 18, 'up'); await t.walk('up'); await W(300);
  t.check((await t.dbg()).map === 'i6A', '进了钟楼');
  await idle(300);
  f = await flags();
  t.check(f['s:c6grunt'] === 1, '钟楼里打败团员，管理员请你去问起床时间');
  await t.go('t6', 'door:A'); await idle();
  for (const k of ['baker', 'student', 'mayor']) await talk('tag', k);
  f = await flags();
  t.check(f['s:c6ask_baker'] && f['s:c6ask_student'] && f['s:c6ask_mayor'], '问了面包师、学生、镇长 "What time do you get up?"');
  await t.go('i6A', 'mat'); await idle();
  // 拨钟：先故意拨错一次
  await t.talkTo(by('id', 'keeper'));
  let pg = await untilChoice();
  t.check(pg && /baker/.test(pg.en), '拨钟：面包师几点起床？（选钟面）');
  await pick(pg, '7:00'); await idle();
  f = await flags();
  t.check(!f['s:ch6'] && !f['s:c6ask_baker'], '拨错了：要回去再问面包师');
  await t.go('t6', 'door:A'); await idle();
  await talk('tag', 'baker');
  await t.go('i6A', 'mat'); await idle();
  await talk('id', 'keeper');
  f = await flags();
  t.check(f['s:ch6'] === 1, '三个钟声都拨对了：钟楼修好，夺回时钟水晶（ch6）');
  // 小凯
  await t.go('t6', 'door:A'); await idle();
  await talk('tag', 'kai');
  t.check((await flags())['s:kai6'] === 1, '小凯在钟山脚下，和他对战了一场');
  await t.shot('c6-t6');
  // 道馆：时钟转门
  await t.go('i6G', 'mat'); await idle();
  await t.tp(10, 10, 'up'); await t.walk('up');
  t.check(await at() === 'i6G 10,10', '转门关着，过不去');
  await t.tp(2, 11, 'up'); await t.A();
  pg = await untilChoice();
  t.check(pg && pg.en === "It's three o'clock.", '第 1 座钟：广播 "It\'s three o\'clock."（只听）');
  await pick(pg, '9:00'); await idle();
  t.check(await at() === 'i6G 7,12' && !(await gateOpen(10, 9)), '拨错了：门转回原位，回到起点');
  await t.tp(2, 11, 'up'); await t.A(); await idle();
  t.check(await gateOpen(10, 9), '拨对 3:00：第 1 道转门打开');
  await t.tp(10, 10, 'up'); await step('up', 2);
  await t.tp(12, 8, 'up'); await t.A(); await idle();
  t.check(await gateOpen(4, 6) && !(await gateOpen(10, 9)), '拨对 6:30：门转了（后面的关上，前面的打开）');
  await t.tp(4, 7, 'up'); await step('up', 2);
  await t.tp(8, 5, 'up'); await t.A(); await idle();
  t.check(await gateOpen(7, 3), '拨对 4:15：通往馆主的门打开');
  await t.shot('c6-gym');
  await t.talkTo(n => n.role === 'leader'); await idle(400);
  t.check(await badges() === 7, '打败闹钟公鸡，拿到第 7 枚徽章');
  // 7 枚徽章：管理员让开，上钟山
  await t.go('t6', 'door:G'); await idle();
  await t.tp(19, 8, 'up'); await step('up', 5);
  t.check((await t.dbg()).map === 'd6a', '7 枚徽章：管理员让开，进了钟山');
  await t.shot('c6-d6a');
  // 钟山 1F 的怪力谜题（先把下面的石头推开）
  // 洞里会随机遇到野生怪兽打断推石头：没拿到就重新进洞（石头复位）再推一次
  for (let k = 0; k < 3 && !(await flags())['p:d6a:2:1']; k++) {
    if (k) { await t.go('t6', 'from:d6a'); await idle(); await t.go('d6a', 'from:t6'); await idle(); }
    await t.tp(4, 5, 'up'); await step('up');
    await t.p.keyboard.press('ArrowRight'); await W(200);
    await t.A(); await idle();
    await step('right');
    await t.tp(5, 5, 'up'); await step('up', 3); await step('left', 3); await step('up');
    await idle();
  }
  t.check(!!(await flags())['p:d6a:2:1'], '钟山 1F：推开两块大石头，拿到角落里的道具');
  // 山顶：闷雷和导师欧瑞
  await t.go('d6b', 'from:d6a'); await idle();
  await t.tp(16, 20, 'up'); await step('up');
  f = await flags();
  t.check(f['s:c6rumble'] === 1, '钟山山顶：和欧瑞一起阻止闷雷的静音机器');
  const lion = await p.evaluate(() => EchoWorld._debug().M.npcs.some(n => n.mon === 'flamelion'));
  t.check(lion, '火山口出现了神兽炎狮');
  await t.shot('c6-d6b');
  await talk('mon', 'flamelion');
  t.check((await flags())['s:leg:flamelion'] === 1, '和炎狮对战了');

  // ======================= 第 7 岛 生日派对岛 =======================
  await t.go('r6', 'from:d6b'); await idle();
  await t.shot('c7-r6');
  await t.go('t7', 'from:r6'); await idle();
  t.check((await flags())['s:c7intro'] === 1, '生日派对岛：对手说今天是他的生日，你说 "Happy birthday!"');
  // 生日日历：先故意写错一次
  await t.talkTo(by('tag', 'granny'));
  pg = await untilChoice();
  t.check(pg && pg.en === 'My birthday is on October 1st.', '问罗丝奶奶 "When is your birthday?"，她的回答只能听');
  await pick(pg, '10月11日'); await idle();
  t.check(!(await flags())['s:c7cal_granny'], '日期写错了，不算');
  for (const k of ['granny', 'amy', 'baker7']) await talk('tag', k);
  f = await flags();
  t.check(f['s:c7cal_granny'] && f['s:c7cal_amy'] && f['s:c7cal_baker7'], '生日日历写好了 3 个人的生日');
  await t.shot('c7-t7');
  await t.go('i7A', 'mat'); await W(1500); await t.shot('c7-party'); await idle(500);
  f = await flags();
  t.check(f['s:c7rumble'] === 1 && f['s:ch7'] === 1, '闷雷来抢蛋糕里的派对水晶，打败他（ch7）');
  t.check(f['s:rival3'] === 1, '唱生日祝福后和对手打了第 3 场（rival3）');
  await t.go('t7', 'door:A'); await idle();
  await talk('tag', 'dad');
  t.check((await bag()).hm_surf === 1 && (await flags())['s:got_surf'] === 1, '爸爸坐船回来，送了冲浪秘传学习器');
  // 道馆：礼物盒
  await t.go('i7G', 'mat'); await idle();
  t.check(/找生日礼物盒 0\/3/.test(await note()), '礼物盒道馆：广播念了一个生日');
  await t.tp(2, 4, 'down'); await step('down');
  t.check(await over(2, 5) === 'y', '踩错盒子（5 月 15 日）：跳出训练师，打完盒子空了');
  await t.tp(6, 4, 'down'); await step('down');
  await t.tp(2, 7, 'down'); await step('down');
  await t.shot('c7-gym');
  await t.tp(6, 7, 'down'); await step('down');
  t.check(await gateOpen(7, 3), '5 月 5 日、10 月 13 日、1 月 21 日三个盒子都对：门打开');
  await t.talkTo(n => n.role === 'leader'); await idle(400);
  t.check(await badges() === 8, '打败河豚派对王，拿到第 8 枚徽章');

  // ======================= 海路、潜水、渡轮 =======================
  // 7 枚徽章时过不了海
  await t.save({ map: 's7', arrive: 'from:t7', badges: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, team: [['tidalfin', 40], ['flamewolf', 40]], bag: { hm_surf: 1 }, flags: { c7intro: 1, ch7: 1 } });
  await idle();
  await t.tp(3, 16, 'right'); await t.A(); await t.walk('right');
  t.check(await at() === 's7 3,16' && !(await t.dbg()).surf, '8 号水路：7 枚徽章还不能冲浪，海路过不去');
  await t.save({ map: 's7', arrive: 'from:t7', badges: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }, team: [['tidalfin', 40], ['flamewolf', 40]], bag: { hm_surf: 1, hm_dive: 1 }, flags: { c7intro: 1, ch7: 1 } });
  await idle();
  await t.tp(3, 16, 'right'); await t.A(); await idle();
  t.check((await t.dbg()).surf, '8 枚徽章：冲浪下海');
  await t.shot('c7-s7');
  // 潜水：深水 → 海底花园 → 浮上来
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.surf = true; });
  await t.tp(30, 27, 'down'); await t.A(); await idle();
  t.check((await t.dbg()).map === 'u7', '在深水上潜水，到了海底花园');
  await t.shot('c7-u7');
  await t.A(); await W(300);
  await t.task(0); await W(900); await idle();
  t.check((await t.dbg()).map === 's7', '在光圈上浮上去，回到 8 号水路');
  // 往东出海 → 动物岛
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.surf = true; });
  await t.tp(41, 17, 'right'); await t.walk('right'); await t.walk('right'); await W(600); await idle();
  t.check((await t.dbg()).map === 't8', '8 号水路东边出去就是动物岛（t8）');
  // 渡轮：社团岛 ↔ 学科岛
  await t.go('t5', 'start'); await idle();
  await talk('role', 'ferry'); await W(2200); await idle();
  t.check((await t.dbg()).map === 't4', '盖尔船长的渡轮开回学科岛');
  const back = await p.evaluate(() => EchoWorld._debug().M.npcs.some(n => n.role === 'ferry' && n.to === 't5'));
  if (back) {
    await talk('to', 't5'); await W(2200); await idle();
    t.check(await at() === 't5 8,26', '学科岛的渡轮开到社团岛的栈桥上：' + await at());
  } else console.log('  （学科岛还没有开往社团岛的渡轮，跳过回程）');

  // ======================= 截图：2D 各张图 + 3D =======================
  const tour = [['t5', 'start'], ['r5', 'from:t5'], ['t6', 'from:r5'], ['d6a', 'from:t6'], ['d6b', 'from:d6a'], ['r6', 'from:d6b'], ['t7', 'from:r6'], ['s7', 'from:t7'], ['u7', 'from:s7'], ['i5A', 'mat'], ['i6A', 'mat'], ['i7A', 'mat']];
  for (const [id, how] of tour) { await t.go(id, how); await idle(); await W(300); await t.shot('c2d-' + id); }
  const all = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
  const done = { c5intro: 1, ch5: 1, c6call: 1, c6grunt: 1, ch6: 1, c6rumble: 1, c7intro: 1, c7rumble: 1, ch7: 1, rival3: 1 };
  for (const [id, how] of [['t5', 'start'], ['t6', 'from:r5'], ['t7', 'from:r6'], ['i5G', 'mat'], ['i6G', 'mat'], ['i7G', 'mat'], ['d6b', 'from:d6a'], ['s7', 'from:t7'], ['r5', 'from:t5'], ['u7', 'from:s7']]) {
    await t.save({ gfx: 'mid', map: id, arrive: how, badges: all, team: [['tidalfin', 40], ['flamewolf', 40]], flags: done });
    await idle(); await W(1800);
    await t.shot('c3d-' + id);
  }
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
