// 英语冠军赛：四位大师各有自己的规则（单词 / 听力 / 口语 / 对话），冠军每只怪兽换一种规则；打赢一间开一间；名人堂
// 运行：node tests/league.test.js
const H = require('./helpers');
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const all = {}; for (let i = 0; i < 13; i++) all[i] = 1;
  // 和人说话一直按 A，直到进入战斗；返回说过的英文
  const untilBattle = async () => { const said = []; for (let i = 0; i < 20 && !(await p.isVisible('#battle')); i++) { if ((await t.dbg()).dlg) { said.push(await t.en()); await t.A(); } else await W(200); } await p.waitForSelector('#battle:not([hidden])', { timeout: 8000 }); return said.join(' | '); };
  const toastSeen = async re => { for (let i = 0; i < 20; i++) { const tx = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join(' | ')); if (re.test(tx)) return true; await W(150); } return false; };
  await t.save({ map: 'i12L', badges: all, team: [['tidalfin', 90], ['flamewolf', 90], ['bubbly', 90]] });
  check((await t.dbg()).map === 'i12L', '在英语冠军赛大厅');
  await t.go('i121', 'from:i12L');
  check((await t.dbg()).map === 'i121', '进了第一位大师的房间');
  await t.talkTo(n => n.role === 'master');
  check(/small moves hit harder/.test(await untilBattle()), '智者先讲规则：小招伤害更高');
  check(await toastSeen(/单词大师/), '战斗里提示「单词大师的规则」');
  console.log('  master 1:', await t.fight());
  await t.idle();
  check((await t.flags())['s:lg1'] === 1, '打败第一位大师');
  await t.go('i122', 'from:i121');
  await t.talkTo(n => n.role === 'master'); await untilBattle();
  check(await toastSeen(/听力大师/), '露娜：防御只有 8 秒');
  console.log('  master 2:', await t.fight());
  await t.idle();
  // 对话大师：一上场就有 3 格能量
  await t.go('i124', 'from:i123');
  await t.talkTo(n => n.role === 'master'); await untilBattle();
  await W(1500);
  const energy = await p.evaluate(() => document.querySelectorAll('#b-energy .on').length);
  check(energy === 3, '利爪：一上场就有 3 格能量（' + energy + '）');
  console.log('  master 4:', await t.fight());
  await t.idle();
  // 冠军：换怪兽就换规则，最后进名人堂
  await t.go('i125', 'from:i124');
  console.log('  i125:', JSON.stringify(await t.dbg()), JSON.stringify(await t.npcs()));
  await t.shot('lg-champ');
  await t.talkTo(n => n.role === 'champion'); await untilBattle();
  check(await toastSeen(/单词大师/), '冠军第一只怪兽：单词规则');
  console.log('  champion:', await t.fight());
  let fame = false;
  for (let i = 0; i < 30 && !fame; i++) { fame = await p.isVisible('#w-scene.fame'); if (!fame) { if ((await t.dbg()).dlg) await t.A(); else await W(200); } }
  check(fame, '进了名人堂');
  await t.shot('lg-fame');
  await t.idle();
  check((await t.flags())['s:champion'] === 1, '成为英语冠军');
  // 听力大师的规则：对手先出手时，防御计时条只有 8 秒（用一只很弱的怪兽，让对手先动）
  await t.save({ map: 'i12L', badges: all, team: [['bubbly', 5]] });
  await p.evaluate(() => MonsterGame.battle('trainer', 12, { foes: [MonsterGame.newMon('tidalfin', 90)], trainer: { name: 'Luna' }, rules: { kind: 'listen' }, onEnd: () => {} }));
  let dur = '';
  for (let i = 0; i < 60 && !dur; i++) { await W(200); dur = await p.evaluate(() => { const b = document.getElementById('b-timer'); return b && /width 8s/.test(b.style.transition) ? b.style.transition : ''; }); if (!dur) { const mv = await p.$('[data-act=bMove]:not([disabled])'); if (mv) { try { await mv.click({ timeout: 1000 }); } catch (e) { /* 换掉了 */ } } const r = await p.$('#b-panel [data-act=bRate][data-v="2"]'); if (r && await r.isVisible()) { try { await r.click({ timeout: 1000 }); } catch (e) { /* 换掉了 */ } } } }
  check(!!dur, '听力大师的规则：防御计时条只有 8 秒（' + dur + '）');
  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
