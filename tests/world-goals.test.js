// 大地图的几样新规矩（2026-10-07 家长定的改进清单）：
// #14 目标提示「现在该去哪、做什么」；#10 道馆跟着课本单元 BOSS 开、打通以后馆主重赛、四只学习里程碑神兽、每日宝箱开冒险道具、第一大区图鉴；
// #17 剧情中文（自动 / 点一下才显示 / 总是显示）；#5 在大地图里过了零点要先回去学习；#4「全部关卡直接开放」不再打开大地图（调试用 ?debug）
// 运行：node tests/world-goals.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const all = {}; for (let i = 0; i < 13; i++) all[i] = 1;
  // 课本前 n 个单元的 BOSS 关算打过了（直接改内存里的存档，再写回 localStorage）
  const units = n => p.evaluate(n => { const S = EchoGame.S; for (let i = 0; i < n; i++) S.stars[(13 + i) + '-6'] = 1; localStorage.setItem('echo-island-v1', JSON.stringify(S)); }, n);
  const goal = () => p.evaluate(() => { const g = document.getElementById('w-goal'); return g && !g.hidden ? g.textContent : ''; });
  const toasts = () => p.evaluate(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join(' | '));
  const S = f => p.evaluate(f);

  // ---------- #14 目标提示 + #10 道馆的课本门槛 ----------
  await t.save({ map: 't0', x: 14, y: 9 });
  let g = await goal();
  check(/Captain Polly/.test(g) && /七上 Unit 1/.test(g) && /0\/2/.test(g), '你好岛：先过课本 BOSS 才能挑战鹦鹉船长 ' + g);
  let seen = '';
  for (let i = 0; i < 16 && !/现在要做/.test(seen); i++) { await W(250); seen = await toasts(); }
  check(/📍 现在要做/.test(seen), '进大地图弹出「现在要做」');
  let need = await S(() => EchoWorld.nextGymNeed());
  check(need && need.z === 0 && need.need === 2 && need.done === 0 && !need.ok && need.unitLabel === '七上 Unit 1' && need.target === '七上 Unit 2', '首页用的 nextGymNeed：' + JSON.stringify(need));
  // 首页：「继续冒险」下面写现在要做、「下一枚徽章」还差哪个单元的 BOSS、「传说的线索」
  await p.evaluate(() => EchoGame.goHome('mon')); await W(400);
  const hm = await p.evaluate(() => ({ obj: (document.querySelector('#home .obj') || {}).textContent || '', gym: (document.querySelector('#home .gym-need') || {}).textContent || '',
    leg: document.querySelectorAll('#home .legends li').length, btn: !!document.querySelector('#home .gym-need [data-act=tab][data-t=quiz]') }));
  check(/📍/.test(hm.obj) && /Captain Polly/.test(hm.obj) && /七上 Unit 1/.test(hm.gym) && /0\/2/.test(hm.gym) && hm.btn && hm.leg === 4, '首页：现在要做、下一枚徽章还差哪个 BOSS、传说的线索 ' + JSON.stringify(hm));
  await t.shot('wg-home-cards');
  await p.click('[data-act=wEnter]'); await W(900);
  // 馆主不接受挑战
  await t.go('i0G', 'from:t0');
  await t.tp(6, 2, 'up'); await t.A(); await t.A();
  check(/Come back after you beat Unit 2!/.test(await t.en()), '鹦鹉船长：Come back after you beat Unit 2!');
  check(/闯关练习/.test(await t.zh()), '中文说清楚要去闯关练习打 BOSS');
  await t.idle();
  check(!(await p.isVisible('#battle')), '课本 BOSS 没过：不开打');
  // 过了 2 个单元：可以挑战了
  await units(2);
  need = await S(() => EchoWorld.nextGymNeed());
  check(need.ok && need.done === 2 && need.unitLabel === '', '过了 2 个单元的 BOSS：门槛满足');
  await t.tp(6, 2, 'up'); await t.A();
  for (let i = 0; i < 10 && !(await p.isVisible('#battle')); i++) { if ((await t.dbg()).dlg) await t.A(); else await W(200); }
  check(await p.isVisible('#battle'), '课本 BOSS 过了：馆主开打');
  console.log('  leader:', await t.fight());
  await t.idle();
  check((await S(() => EchoGame.S.mon.badges))[0], '拿到你好徽章');
  g = await goal();
  check(/1 号路/.test(g) && /彩色文具岛/.test(g), '拿到徽章后：去 1 号路 → 彩色文具岛 ' + g);
  need = await S(() => EchoWorld.nextGymNeed());
  check(need.z === 1 && need.need === 3 && need.done === 2 && need.unitLabel === '七上 Unit 3', '第 2 个馆主要 3 个单元 ' + JSON.stringify(need));
  // 冒险菜单最上面「📍 现在要做」，点地名下面那行也能打开
  await p.click('#w-goal'); await W(300);
  check(/现在要做/.test(await p.textContent('#modal')), '点 📍 打开冒险菜单，最上面是现在要做');
  await p.click('#modal [data-act=close]'); await W(200);
  // 各岛的剧情进度
  await t.save({ map: 't2', x: -1, y: -1, arrive: 'door:C', badges: { 0: 1, 1: 1 }, visited: { 0: 1, 1: 1, 2: 1 }, flags: { ch1: 1, f2call: 1 } });
  await t.idle();
  check(/井边/.test(await goal()), '家庭岛：去井边问哭的小男孩 ' + await goal());
  await t.save({ map: 't2', x: -1, y: -1, arrive: 'door:C', badges: { 0: 1, 1: 1 }, visited: { 0: 1, 1: 1, 2: 1 }, flags: { ch1: 1, f2call: 1, f2tim: 1, f2mom: 1 } });
  await t.idle();
  check(/还差爸爸、奶奶/.test(await goal()), '家庭岛：找家人，还差爸爸、奶奶 ' + await goal());
  const obj = await S(() => EchoWorld.objective());
  check(obj && obj.z === 2, '首页用的 objective()：' + JSON.stringify(obj));

  // ---------- #17 剧情中文 ----------
  // 第 1 岛（自动）：中文一直显示
  await t.save({ map: 't0', x: 14, y: 9, badges: { 0: 1 } });
  await t.talkTo(n => n.name === 'Sam');
  await t.typed();
  check(await p.evaluate(() => { const z = document.querySelector('#w-dlg .d-zh'); return !!z && z.tagName === 'DIV' && z.textContent.length > 3; }), '你好岛（自动）：中文直接显示');
  await t.idle();
  // 第 6 岛（自动）：人说的话先只给英文，点「译」才显示，并记进当天的学习记录
  await t.save({ map: 't5', x: -1, y: -1, arrive: 'door:C', badges: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, visited: { 0: 1, 5: 1 }, flags: { ch5: 1, c5intro: 1 } });
  await t.idle();
  await t.talkTo(n => n.name === 'Juggler Pip');
  await t.typed();
  check(await p.evaluate(() => { const z = document.getElementById('d-zh'); return !!z && z.tagName === 'BUTTON' && z.textContent === '译'; }), '社团岛（自动）：中文收成「译」按钮');
  await t.shot('wg-zh-fold');
  const taps0 = await S(() => EchoGame.dayLog().zhTaps || 0);
  await p.click('#d-zh'); await W(200);
  check(await p.evaluate(() => { const z = document.getElementById('d-zh'); return !!z && z.tagName === 'DIV' && /抛五个球/.test(z.textContent); }), '点「译」显示中文');
  check((await S(() => EchoGame.dayLog().zhTaps)) === taps0 + 1, '点「译」记进当天的学习记录（zhTaps）');
  check((await t.dbg()).dlg, '点「译」不会翻到下一页');
  await t.closeDlg();
  check(/跟我说一遍|说一遍/.test(await t.zh()), '要说话的任务页：中文照常显示');
  await t.idle();
  // 总是显示 / 点一下才显示（设置按钮在 EchoWorld.storyZhHTML() 里，由 wZhMode 处理）
  // 改宽松要家长密码（game.js 包了一层 parentOk，网页版用 S.settings.pin）
  await p.evaluate(() => { EchoGame.S.settings.pin = '1357'; document.body.insertAdjacentHTML('beforeend', '<div id="zh-set" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff">' + EchoWorld.storyZhHTML() + '</div>'); });
  await p.evaluate(() => document.querySelector('#zh-set [data-m=always]').click()); await W(200);
  check(await p.isVisible('#pin-pad') && (await S(() => EchoGame.S.settings.storyZh || 'auto')) === 'auto', '设置「总是显示」：先要家长密码');
  for (const d of '1357') await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]');
  await W(400);
  check((await S(() => EchoGame.S.settings.storyZh)) === 'always' && await p.evaluate(() => document.querySelector('#sheet [data-act=wZhMode][data-m=always]').classList.contains('on')), '输对密码：设置「总是显示」');
  await p.evaluate(() => { document.getElementById('zh-set').remove(); EchoGame.closeModal(); });
  await t.talkTo(n => n.name === 'Juggler Pip'); await t.typed();
  check(await p.evaluate(() => { const z = document.getElementById('d-zh'); return !!z && z.tagName === 'DIV'; }), '总是显示：社团岛也直接显示中文');
  await t.idle();
  await p.evaluate(() => { EchoGame.S.settings.storyZh = 'tap'; });
  await t.go('t0', 'door:C');
  await t.talkTo(n => n.name === 'Sam'); await t.typed();
  check(await p.evaluate(() => { const z = document.getElementById('d-zh'); return !!z && z.tagName === 'BUTTON'; }), '点一下才显示：你好岛也收起来');
  await t.idle();
  await p.evaluate(() => { EchoGame.S.mon.badges = {}; });   // 没有徽章：守卫站出来挡路
  await t.talkTo(n => n.role === 'guard'); await t.typed();
  check(await p.evaluate(() => { const z = document.getElementById('d-zh'); return !!z && z.tagName === 'DIV'; }), '守卫说的规则（要几枚徽章）：中文一直显示');
  await t.idle();
  await p.evaluate(() => { EchoGame.S.settings.storyZh = 'auto'; });

  // ---------- #10 打通以后：馆主重赛（等级 +15、出题换成课本最近学的单元、每天第一次赢送进化石） ----------
  await t.save({ map: 'i0G', x: 6, y: 2, badges: all, flags: { champion: 1 }, visited: { 0: 1 } });
  check(/英语冠军/.test(await goal()), '打通以后的目标：重赛、传说的线索 ' + await goal());
  const stones0 = await S(() => Object.keys(DEX.STONES).reduce((a, k) => a + MonsterGame.itemCount(k), 0));
  await t.tp(6, 2, 'up'); await t.A();
  check(/Welcome back, Champion/.test(await t.en()), '馆主：冠军回来了，我变强了');
  for (let i = 0; i < 10 && !(await p.isVisible('#battle')); i++) { if ((await t.dbg()).dlg) await t.A(); else await W(200); }
  const rb = await p.evaluate(() => { const b = MonsterGame._b(); return { n: b.foes.length, lv: b.foes[0].lv, recent: EchoWorld._debug().recentSrc() }; });
  check(rb.lv >= MonsterGame_zone(0) + 15 && rb.n === 3, '重赛的馆主更强：' + JSON.stringify(rb));
  check(rb.recent, '重赛时出题换成课本最近学的单元');
  console.log('  rematch:', await t.fight());
  await t.idle();
  check(!(await p.evaluate(() => EchoWorld._debug().recentSrc())), '打完换回原来的出题');
  const stones1 = await S(() => Object.keys(DEX.STONES).reduce((a, k) => a + MonsterGame.itemCount(k), 0));
  check(stones1 === stones0 + 1, '今天第一次重赛赢了：送一块进化石');

  // ---------- #10 传说的线索：七上 8 个单元 BOSS 全过 → 霜羽鸟飞来 ----------
  await t.save({ map: 't0', x: 14, y: 9, badges: { 0: 1 }, team: [['tidalfin', 90], ['flamewolf', 90]] });
  let clues = await S(() => EchoWorld.legendClues());
  check(clues.length === 4 && clues.every(c => !c.done) && clues[0].id === 'frostwing' && clues[0].need === 8, '四只神兽的线索：都还没达成 ' + JSON.stringify(clues.map(c => c.id + ' ' + c.have + '/' + c.need)));
  // 聊天目标次数按天累加（日志只留 45 天，累加进 world.mile 就不会丢）
  await p.evaluate(() => { const S = EchoGame.S; S.log['2026-01-02'] = { talk: 20, recall: 100 }; S.log['2026-01-03'] = { talk: 5 }; });
  clues = await S(() => EchoWorld.legendClues());
  check(clues[1].have === 25 && clues[3].have === 100, '聊天完成 25 次、不看字说对 100 句（从每天的日志累加）');
  await p.evaluate(() => { const S = EchoGame.S; delete S.log['2026-01-02']; delete S.log['2026-01-03']; });
  clues = await S(() => EchoWorld.legendClues());
  check(clues[1].have === 25, '日志删掉以后累计数还在');
  await units(8);
  clues = await S(() => EchoWorld.legendClues());
  check(clues[0].done && clues[0].have === 8, '七上 8 个单元的 BOSS 全过：霜羽鸟达成');
  await t.go('r0', 'from:t0'); await W(1500);
  let heard = '';
  for (let i = 0; i < 20 && !/landed/.test(heard); i++) { const pg = await t.page(); heard += pg ? pg.en + ' ' : ''; if (/landed/.test(heard)) break; if ((await t.dbg()).dlg) await t.A(); else await W(200); }
  check(/Frostwing/.test(heard) && /calling/.test(heard), '一走到户外，博士打电话：霜羽鸟来了');
  check((await t.npcs()).some(n => n.mon === 'frostwing'), '霜羽鸟落在主角旁边');
  await t.typed(); await t.shot('wg-frostwing');
  await t.idle(160);
  const fl = await t.flags();
  check(fl['s:mlseen:frostwing'] === 1 && (fl['s:mlday:frostwing'] || fl['s:leg:frostwing']), '和霜羽鸟打了一场（打倒了明天再来 / 收服了）');
  await t.go('t0', 'from:r0'); await t.go('r0', 'from:t0'); await W(800);
  check(!(await t.npcs()).some(n => n.mon === 'frostwing') || fl['s:leg:frostwing'], '同一天不会再飞来');

  // ---------- #10 每日宝箱、第一大区图鉴 ----------
  const bag0 = await S(() => MonsterGame.itemCount(Object.keys(DEX.STONES)[0]));
  const st = await S(() => EchoWorld.chestPrize(0.01));
  check(st && st.kind === 'stone' && /进化石/.test(st.html) && (await S(() => MonsterGame.itemCount(Object.keys(DEX.STONES)[0]))) === bag0 + 1, '宝箱开出进化石 ' + (st && st.prize));
  const box0 = await S(() => EchoGame.S.mon.box.length);
  const eg = await S(() => EchoWorld.chestPrize(0.6));
  check(eg && eg.kind === 'egg' && (await S(() => EchoGame.S.mon.box.length)) === box0 + 1, '宝箱开出怪兽蛋');
  const sh = await S(() => EchoWorld.chestPrize(0.85));
  check(sh && sh.kind === 'shinyEgg' && (await S(() => EchoGame.S.mon.box.slice(-1)[0])).shiny, '宝箱开出异色蛋（孵出来是异色）');
  check((await S(() => EchoWorld.chestPrize(0.95))) === null, '有时开出原来的奖品（金币、宠物）');
  const dr = await S(() => EchoWorld.dexRegion());
  check(dr.total === 151 && dr.caught >= 0, '第一大区图鉴 151 种（' + dr.caught + ' 种已收服）');

  // ---------- #5 在大地图里过了零点：等对话结束再提示回首页 ----------
  await t.save({ map: 't0', x: 14, y: 9, badges: { 0: 1 } });
  await t.talkTo(n => n.name === 'Ms Rosa');
  // 学习锁打开、手机日期被改过（锁住），再假装进来时是昨天
  await p.evaluate(() => { const S = EchoGame.S; S.settings.gate = true; S.maxDay = '2099-12-31'; EchoWorld._debug().fakeDay('2000-01-01'); });
  await W(4500);
  const pg = await t.page();
  check(pg && !/new day/.test(pg.en || ''), '正在说话时不打断（' + (pg && pg.en) + '）');
  let kick = false;
  for (let i = 0; i < 30 && !kick; i++) { const q = await t.page(); if (q && /new day/i.test(q.en || '')) { kick = true; break; } if (!(await t.task())) { if ((await t.dbg()).dlg) await t.A(); else await W(400); } }
  check(kick, '对话结束后：新的一天！先完成今天的小任务');
  check(/新的一天/.test(await t.zh()), '中文：新的一天！先完成今天的小任务');
  await t.A(); await W(600);
  check(await p.isVisible('#home'), '回到首页');
  // 切回前台时学习锁是关着的：也回首页
  await p.evaluate(() => { const S = EchoGame.S; S.settings.gate = false; });
  await p.click('[data-act=wEnter]'); await W(1200);
  await p.evaluate(() => { EchoGame.S.settings.gate = true; document.dispatchEvent(new Event('visibilitychange')); });
  await W(600);
  check(/study first/i.test((await t.page() || {}).en || ''), '切回前台学习锁关着：先去学习');
  await t.A(); await W(600);
  check(await p.isVisible('#home'), '回到首页');
  await p.evaluate(() => { const S = EchoGame.S; S.settings.gate = false; delete S.maxDay; localStorage.setItem('echo-island-v1', JSON.stringify(S)); });

  // ---------- #4「全部关卡直接开放」不再打开大地图；?debug 才全开 ----------
  await t.save({ map: 't0', x: 14, y: 9 });
  await p.evaluate(() => { EchoGame.S.settings.unlockAll = true; });
  const ua = await S(() => { const d = EchoWorld._debug(); return { b: d.hasBadge(3), cut: d.skillOpen('cut'), gym: EchoWorld.nextGymNeed().ok }; });
  check(!ua.b && !ua.cut && !ua.gym, '全部关卡直接开放：大地图的徽章、秘传技能、道馆门槛都不跟着开 ' + JSON.stringify(ua));
  await p.goto(H.PAGE + '?debug'); await W(300);
  await t.save({ map: 't0', x: 14, y: 9 });
  const dbg = await S(() => { const d = EchoWorld._debug(); return { on: d.debug, b: d.hasBadge(3), cut: d.skillOpen('cut'), gym: EchoWorld.nextGymNeed().ok }; });
  check(dbg.on && dbg.b && dbg.cut && dbg.gym, '?debug：徽章、秘传技能、道馆门槛全开 ' + JSON.stringify(dbg));
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
function MonsterGame_zone(z) { return 2 + z * 2; }
