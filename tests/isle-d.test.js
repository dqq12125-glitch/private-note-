// D 组（第 8–10 岛：动物岛、规则城、运动美食岛）端到端测试
// 三座岛的主线剧情各走一遍；三个道馆机关按正确解法走通（也故意错一次）；飞空、潜水学习器；海上巡逻 / 冰洞守卫；潜水到海底再浮上来到运动美食岛
// 运行：node tests/isle-d.test.js
const H = require('./helpers');

(async () => {
  const t = await H.open();
  const { p, W } = t;
  const flags = () => t.flags();
  const bag = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.bag || {});
  const badges = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('echo-island-v1')).mon.badges).length);
  // 战斗后可能弹出窗口（学新招式、进化）：关掉再继续
  async function modal() {
    for (let i = 0; i < 10; i++) {
      const open = await p.evaluate(() => !document.getElementById('modal').hidden);
      if (!open) return;
      const b = await p.$('#sheet [data-act=mEvoOk]:not([hidden]), #sheet [data-act=mForget][data-k="-1"], #sheet [data-act=close]');
      if (b) { try { await b.click({ timeout: 2000 }); } catch (e) { /* 换掉了 */ } }
      await W(400);
    }
  }
  const idle = async max => { await modal(); await t.idle(max || 400); await modal(); };
  let nf = 0;
  const ck = async (ok, what) => {
    if (!ok) { console.log('   ↳', JSON.stringify(await t.dbg()), await p.evaluate(() => { const m = document.getElementById('modal'); return m.hidden ? '' : document.getElementById('sheet').textContent.slice(0, 80); })); await t.shot('d-fail-' + (++nf)); }
    t.check(ok, what);
  };
  const by = (k, v) => new Function('n', 'return n.' + k + ' === ' + JSON.stringify(v));
  const talk = async (k, v) => { const ok = await t.talkTo(by(k, v)); await idle(); return ok; };
  const has = async id => (await t.npcs()).some(n => n.id === id);
  const note = () => p.evaluate(() => { const n = document.getElementById('w-note'); return n && !n.hidden ? n.textContent : ''; });
  const gateOpen = (x, y) => p.evaluate(([x, y]) => EchoWorld._debug().M._open.has(x + ',' + y), [x, y]);
  // 走一步（冰面上会一直滑）：等滑停了、剧情播完再走下一步
  async function settle() { let last = ''; for (let i = 0; i < 40; i++) { const s = await t.dbg(); const k = s.x + ',' + s.y + s.busy + s.dlg; const mv = await p.evaluate(() => EchoWorld._debug().PL.moving); if (k === last && !mv) return; last = k; await W(150); } }
  const step = async (dir, n) => { for (let i = 0; i < (n || 1); i++) { await t.walk(dir, 1); await settle(); await idle(); await settle(); } };
  const pos = async () => { const s = await t.dbg(); return s.map + ' ' + s.x + ',' + s.y; };
  const surf = on => p.evaluate(v => { EchoWorld._debug().PL.surf = v; }, on);
  const dbgD = k => p.evaluate(k => window.EchoIsleD[k](), k);
  // 回答题目时故意选错的那个
  async function answerWrong() {
    for (let i = 0; i < 30; i++) {
      const pg = await t.page();
      if (pg && pg.kind === 'answer') { const k = pg.opts.findIndex(o => !o.c); await p.click('#w-dlg .opt[data-i="' + k + '"]'); await W(1200); return true; }
      if (!(await t.dbg()).dlg) return false;
      await t.A();
    }
    return false;
  }
  // 等红绿灯：want = true 等绿灯（至少还剩 need 秒），false 等红灯
  async function waitLight(want, need) {
    for (let i = 0; i < 80; i++) { const l = await dbgD('light'); if (l.green === want && l.left >= (need || 1)) return true; await W(250); }
    return false;
  }
  const shot = async n => { await W(1200); await t.shot(n); };
  const B = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 1]));

  // ======================= 第 8 岛 动物岛 =======================
  await t.save({ map: 't8', arrive: 'door:C', badges: B(8), team: [['waveking', 50], ['flamewolf', 50]], bag: { hm_surf: 1 } });
  await idle();
  let f = await flags();
  await ck(f['s:a8in'] === 1, '动物岛：巡林员罗莎迎接，请你找走丢的怪兽（听描述）');
  await ck(await has('pk0') && await has('pk1') && await has('pk2'), '动物公园里出现三只怪兽');
  await t.tp(27, 18, 'up'); await W(600); await shot('d8-t8-park');
  await talk('id', 'pk1');
  await ck(!(await flags())['s:a8find'], '找错了（苔藓熊没有长尾巴）：不算');
  await talk('id', 'pk0');
  f = await flags();
  await ck(f['s:a8find'] === 1 && !(await has('pk0')), '找对了（小小的、长尾巴的啃啃鼠）：跟着你走');
  await t.tp(20, 24, 'up'); await W(500); await shot('d8-t8');

  // 9 号水路：8 枚徽章时海上巡逻员挡在窄水道里
  await t.go('s8', 'from:t8'); await idle();
  await t.tp(29, 13, 'right'); await surf(true); await t.walk('right', 1); await W(300);
  await ck((await t.dbg()).x === 29, '9 号水路：8 枚徽章时海上巡逻员挡住窄水道');
  await shot('d8-s8');

  // 丛林小径：云朵羊、奇怪的灌木
  await t.go('j8', 'from:t8'); await idle();
  await ck(await has('cloud'), '丛林里出现受惊的云朵羊');
  await talk('id', 'bush');
  await ck(!(await flags())['s:a8bush'], '没发现线索时，灌木只是灌木');
  await talk('id', 'cloud');
  await ck((await flags())['s:a8cloud'] === 1, '用英语描述云朵羊（It\'s white and fluffy）给巡林员听');
  await talk('id', 'bush');
  await ck((await flags())['s:a8bush'] === 1, '伪装成灌木的嘘声团团员：打败他，露出基地入口');
  await t.tp(18, 8, 'up'); await W(500); await shot('d8-j8');
  await t.walk('up', 3); await W(400);
  await ck((await t.dbg()).map === 'h8a', '走进灌木后面的洞口：嘘声团基地 1F');
  await idle();

  // 基地 1F：偷听口令、口令门、红色按钮
  await t.tp(9, 5, 'left'); await step('left');
  await ck((await flags())['s:a8over'] === 1, '基地 1F：偷听到团员说口令（只听不看）');
  await t.tp(3, 5, 'up'); await t.A();
  await answerWrong(); await idle();
  await ck(!(await gateOpen(3, 4)), '口令说错：门不开');
  await t.tp(3, 5, 'up'); await t.A(); await idle();
  await ck(await gateOpen(3, 4), '说对口令（Pandas eat bamboo.）：口令门打开');
  await t.tp(22, 11, 'right'); await t.A(); await idle();
  await ck(await gateOpen(25, 4), '按下红色按钮：仓库的门打开');
  await shot('d8-h8a');
  await t.tp(1, 2, 'up'); await t.walk('up', 1); await W(400); await idle();
  await ck((await t.dbg()).map === 'h8b', '走楼梯到基地 2F');
  await t.tp(14, 8, 'up'); await W(400); await shot('d8-h8b');

  // 基地 2F：打败低语，打开笼子，夺回动物水晶
  await talk('id', 'whisper');
  f = await flags();
  await ck(f['s:ch8'] === 1, '打败干部低语 → 笼子全开、放走怪兽 → 夺回动物水晶（ch8）');
  await ck(await gateOpen(14, 4), '关雷狮的大笼子也打开了');
  await talk('id', 'voltlion');
  await ck((await flags())['s:leg:voltlion'] === 1, '和神兽雷狮对战（收服或打败）');

  // 巡林站：小凯送飞空
  await t.go('i8A', 'mat'); await idle();
  await talk('id', 'kai2');
  await ck((await bag()).hm_fly === 1 && (await flags())['s:got_fly'] === 1, '小凯送了飞空秘传学习器');
  await shot('d8-i8A');

  // 道馆：脚印小路
  await t.go('i8G', 'mat'); await idle();
  await step('up', 2);
  let g8 = await dbgD('g8');
  await ck(g8.said[0], '脚印道馆：走到第一个路口，广播描述一种动物（只听不看）');
  await ck(/路口/.test(await note()), '提示条显示第几个路口');
  const COL = { e: 3, m: 7, g: 11, k: 3, t: 7, p: 11, z: 3, q: 7, l: 11 };
  const ORDER = [['e', 'm', 'g'], ['k', 't', 'p'], ['z', 'q', 'l']];
  const wrong0 = ORDER[0].find(a => a !== g8.ans[0]);
  await t.tp(COL[wrong0], 21, 'up'); await step('up');
  await ck(await pos() === 'i8G 7,22', '走错脚印：传送回第一个路口');
  await shot('d8-i8G');
  // 正确的走法：每个路口走到对的那一列，往上穿过三格脚印
  const JUN = [21, 16, 11];
  for (let k = 0; k < 3; k++) {
    const c = COL[g8.ans[k]];
    await t.tp(c, JUN[k], 'up');
    await step('up', 4);
    g8 = await dbgD('g8');
  }
  await ck(await gateOpen(7, 6), '三段脚印都走对：通往馆主的门打开');
  const b0 = await badges();
  await talk('role', 'leader');
  await ck(await badges() === b0 + 1, '打败鳄鱼巡查员，拿到第 9 枚徽章');
  // 解开以后再进来门还开着
  await t.go('t8', 'door:G'); await idle(); await t.go('i8G', 'mat'); await idle();
  await ck(await gateOpen(7, 6), '再进道馆：门一直开着');

  // ======================= 第 9 岛 规则城 =======================
  await t.go('s8', 'from:t8'); await idle();
  await t.tp(29, 13, 'right'); await surf(true); await t.walk('right', 1); await W(300);
  await ck((await t.dbg()).x === 30, '9 枚徽章：海上巡逻员让开了');
  await t.go('t9', 'from:s8'); await idle();
  f = await flags();
  await ck(f['s:a9in'] === 1, '规则城：李警官请你当一天小交警');
  await ck(await has('rb1') && await has('rb2') && await has('rb3'), '马路上出现三个不守规矩的人');
  await t.tp(18, 18, 'up'); await W(500); await shot('d9-t9');
  await talk('id', 'rb1');
  await t.talkTo(by('id', 'rb2')); await answerWrong(); await idle();
  await ck(!(await flags())['s:a9r2'], '提醒乱扔垃圾的人：说错了不算');
  await talk('id', 'rb2');
  await talk('id', 'rb3');
  f = await flags();
  await ck(f['s:a9r1'] && f['s:a9r2'] && f['s:a9r3'], '提醒了横穿马路、乱扔垃圾、红灯看手机的三个人');
  await ck(f['s:a9spyq'] === 1 && await has('sp2'), '警官在对讲机里给出线索，喷泉边出现四个游客');
  await talk('id', 'sp0');
  await ck(!(await flags())['s:a9spy'], '找错了人（没戴眼镜）：不算');
  await talk('id', 'sp2');
  f = await flags();
  await ck(f['s:a9spy'] === 1 && f['s:ch9'] === 1, '找到乔装的团员（红帽子、眼镜、背包）→ 打败他 → 夺回规则水晶（ch9）');
  await talk('id', 'orion2');
  await ck((await bag()).hm_dive === 1, '导师欧瑞读懂古代文字，送了潜水秘传学习器');
  await t.go('i9A', 'mat'); await idle();
  await talk('id', 'officer');
  await shot('d9-i9A');

  // 9 枚徽章：还不能潜水
  await t.go('s9', 'from:t9'); await idle();
  await t.tp(27, 8, 'down'); await surf(true); await t.A(); await W(300);
  await ck(/10/.test(await t.zh()), '只有 9 枚徽章：潜水要 10 枚徽章');
  await t.closeDlg();
  await ck((await t.dbg()).map === 's9', '潜不下去，还在 10 号水路');
  await shot('d9-s9');

  // 道馆：红绿灯
  await t.go('i9G', 'mat'); await idle();
  await ck(/light/.test(await note()), '红绿灯道馆：提示条显示现在是红灯还是绿灯');
  await t.tp(4, 14, 'up'); await step('up');
  await ck(await pos() === 'i9G 4,14', '不走斑马线直接上马路：被吹哨罚回起点');
  await waitLight(false, 2);
  await t.tp(7, 14, 'up'); await step('up');
  await ck(await pos() === 'i9G 4,14', '红灯时踩上斑马线：被吹哨罚回起点');
  await shot('d9-i9G');
  for (const y of [14, 11, 8]) {
    await waitLight(true, 4);
    await t.tp(7, y, 'up');
    await step('up', 3);
  }
  await ck(await gateOpen(7, 4), '绿灯时走斑马线过了三条马路：门打开');
  const b1 = await badges();
  await talk('role', 'leader');
  await ck(await badges() === b1 + 1, '打败鲨鱼纪律官，拿到第 10 枚徽章');
  await ck(!(await note()), '离开前红绿灯的提示条已经收起');

  // 潜水：10 号水路 → 海底隧道 → 11 号水路 → 运动美食岛
  await t.go('s9', 'from:t9'); await idle();
  await t.tp(27, 8, 'down'); await surf(true); await t.A(); await idle();
  await ck((await t.dbg()).map === 'u9', '10 枚徽章 + 潜水：从深水潜到海底隧道');
  await W(400); await shot('d9-u9');
  await t.tp(36, 21, 'down'); await t.A(); await idle(); await W(500);
  await ck((await t.dbg()).map === 's10', '从另一头的光圈浮上去：11 号水路（礁石环绕）');
  await ck((await t.dbg()).surf, '浮上来的时候在水上冲浪');
  await shot('d10-s10');
  await t.tp(14, 1, 'up'); await surf(false); await t.walk('up', 1); await W(500);

  // ======================= 第 10 岛 运动美食岛 =======================
  await ck((await t.dbg()).map === 't10', '往北走到运动美食岛');
  await idle();
  f = await flags();
  await ck(f['s:a10mom'] === 1, '一到岛上妈妈打电话：问今天吃了什么');
  await ck(await has('rival'), '对手在美食节吃坏了肚子');
  await shot('d10-t10');
  await talk('id', 'rival');
  f = await flags();
  await ck(f['s:a10food'] === 1, '帮对手选健康的食物（Some fruit and vegetables.）');
  await ck(f['s:rival4'] === 1, '接力赛 + 和对手对战（rival4）');
  await talk('id', 'h10a');
  await talk('id', 'h10b');
  f = await flags();
  await ck(f['s:ch10'] === 1, '集市上打败两个发垃圾食品的团员 → 夺回健康水晶（ch10）');
  // 冰洞守卫：10 枚徽章时挡住
  await t.tp(20, 6, 'up'); await t.walk('up', 1); await W(300);
  await ck((await t.dbg()).y === 6, '10 枚徽章：冰洞前的守卫挡住窄路');
  await t.closeDlg();

  // 道馆：冰面 + 健康食物
  await t.go('i10G', 'mat'); await idle();
  await ck(/0 \/ 3/.test(await note()), '冰面道馆：提示条显示健康食物 0/3');
  await t.tp(7, 13, 'up'); await step('up');
  await ck(await pos() === 'i10G 7,14' && await dbgD('g10') === 0, '滑到甜甜圈（垃圾食品）上：滑回起点');
  await shot('d10-i10G');
  await t.tp(6, 13, 'up'); await step('up'); await step('right');
  await ck(await dbgD('g10') === 1, '先往上滑到盆栽边，再往右滑：停在苹果上（1/3）');
  await step('down');
  await t.tp(2, 13, 'up'); await step('up'); await step('right');
  await ck(await dbgD('g10') === 2, '左边一列往上、再往右：停在香蕉上（2/3）');
  await step('down'); await step('right'); await step('down');
  await t.tp(10, 13, 'up'); await step('up'); await step('left');
  await ck(await dbgD('g10') === 3 && await gateOpen(7, 3), '往上再往左：停在西兰花上（3/3）→ 门打开');
  await step('down');
  await t.tp(8, 13, 'up'); await step('up'); await step('left'); await step('up', 2);
  const b2 = await badges();
  await talk('role', 'leader');
  await ck(await badges() === b2 + 1, '打败海狮教练，拿到第 11 枚徽章');

  // 冰洞：守卫让开，滑冰谜题，神兽冰晶巨人，雪原到天气岛
  await t.go('t10', 'door:G'); await idle();
  await t.tp(20, 6, 'up'); await t.walk('up', 2); await t.walk('up', 1); await W(500);
  await ck((await t.dbg()).map === 'c10', '11 枚徽章：守卫让开，走进冰洞');
  await idle();
  await step('up', 7);
  await ck(await pos() === 'c10 18,13', '冰洞：往上滑，被石头挡住停下');
  await step('left'); await step('up');
  await ck(await pos() === 'c10 8,7', '往左滑、再往上滑：到了冰洞北边');
  await shot('d10-c10');
  await t.tp(29, 4, 'up'); await talk('id', 'icegiant');
  await ck((await flags())['s:leg:icegiant'] === 1, '冰洞深处的神兽冰晶巨人');
  await t.tp(5, 1, 'up'); await t.walk('up', 1); await W(500); await idle();
  await ck((await t.dbg()).map === 'r10', '冰洞北口：雪原');
  await shot('d10-r10');
  await t.tp(14, 1, 'up'); await t.walk('up', 1); await W(500); await idle();
  await ck((await t.dbg()).map === 't11', '雪原北口通到天气岛（E 组）');

  // ======================= 3D 截图 =======================
  // 每张图开一个新的浏览器（软件渲染的 WebGL 很慢，连着刷新容易卡住），最多等 90 秒
  const fl = await flags();
  const shots = [['t8', 20, 24], ['j8', 18, 9], ['h8b', 14, 8], ['i8G', 7, 22], ['s8', 2, 12], ['t9', 18, 18], ['i9G', 7, 14], ['u9', 20, 13], ['t10', 26, 18], ['i10G', 7, 14], ['c10', 18, 13], ['r10', 14, 17]];
  for (const [map, x, y] of (process.env.SKIP3D ? [] : shots)) {
    const one = (async () => {
      const u = await H.open();
      await u.save({ map, x, y, gfx: 'mid', badges: B(11), flags: fl, team: [['waveking', 50], ['flamewolf', 50]], bag: { hm_surf: 1, hm_dive: 1, hm_fly: 1 } });
      await u.W(3500);
      const s = await u.dbg();
      await u.shot('d3-' + map);
      const errs = u.errs.length;
      await u.b.close();
      return s.map === map && !errs;
    })();
    const ok = await Promise.race([one, new Promise(r => setTimeout(() => r(false), 90000))]);
    await ck(ok, '3D 截图 ' + map);
  }
  await t.done();
})();
