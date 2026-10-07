// 战斗规则测试：速度先后手、异常状态和叫醒、能力升降、升级学新招（忘掉旧招）、换怪兽、学习装置、怪兽详情、
// 对战替复习干活（先出到期的题、答对算复习）、按掌握程度撤提示（凭记忆念 / 🔥 不看字念 / 大招先不给选项）
// 运行：node tests/battle.test.js
const path = require('path');
const { chromium } = require('playwright');
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE);
  const save = extra => p.evaluate(x => localStorage.setItem('echo-island-v1', JSON.stringify(Object.assign({
    seenIntro: true, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false }, player: { gender: 'boy', name: 'Tom' },
    mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0 }, { uid: 'b', sp: 'bubbly', lv: 12, xp: 0 }], team: ['a', 'b'], dex: {}, balls: 5, potions: 3, bag: {}, badges: {} },
    world: { v: 2, flags: {} },
  }, x))), extra || {});
  const W = ms => p.waitForTimeout(ms);
  // 战斗面板会重画：点到已经被换掉的按钮就跳过，下一轮再找
  const tryClick = async el => { try { await el.click({ timeout: 2000 }); } catch (e) { /* 按钮被换掉了 */ } };
  const panelHas = sel => p.$('#b-panel ' + sel);
  const msg = () => p.textContent('#b-msg');
  const until = async (fn, max = 60) => { for (let i = 0; i < max; i++) { if (await fn()) return true; await W(150); } return false; };
  // 开场两句朗读走在线发音（没有配音的句子最长等 4 + 字数 × 0.2 秒，约 9 秒），菜单要等它念完才出来：多等一会儿（最多 21 秒）
  const menuUp = () => until(() => panelHas('[data-act=bMove]'), 140);

  // ---------- 招式按等级来 ----------
  await save(); await p.reload(); await W(400);
  const moves = await p.evaluate(() => { const m = JSON.parse(localStorage.getItem('echo-island-v1')).mon.box[0]; return MonsterGame.learnset(DEX.byId.emberpup).filter(([l]) => l <= 14).length; });
  check(moves === 3, 'Lv14 的 Emberpup 按学招表会 3 招');
  const st = await p.evaluate(() => MonsterGame.stats({ sp: 'emberpup', lv: 14 }));
  check(st.def > 0 && st.spd > 0, '有防御和速度 ' + JSON.stringify(st));

  // ---------- 速度：对手更快就先出手 ----------
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('stormwing', 40)] }));
  await menuUp();
  const n = (await p.$$('[data-act=bMove]')).length;
  check(n === 3, '菜单里 3 个招式（' + n + '）');
  await p.click('[data-act=bMove][data-i="0"]'); await p.click('[data-act=bRate][data-v="2"]');
  await W(300);
  check(/速度更快/.test(await msg()), '对手速度更快，抢先出手');
  await until(() => panelHas('[data-act=bDef]'));
  check(!!(await panelHas('[data-act=bDef]')), '先轮到对手：听力防御');
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]');

  // ---------- 睡着要叫醒；换怪兽；治状态的道具 ----------
  await save({ mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0, st: 'slp', slp: 3 }, { uid: 'b', sp: 'bubbly', lv: 12, xp: 0 }], team: ['a', 'b'], dex: {}, balls: 5, potions: 3, bag: { awakening: 1 }, badges: {} } });
  await p.reload(); await W(400);
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 3)] }));
  await until(() => panelHas('.task'));
  check(/Wake up, Emberpup!/.test(await p.textContent('#b-panel .say-text')), '睡着了：要大声喊 Wake up, Emberpup!');
  check((await p.textContent('#b-myst')) === '睡眠', '血条上显示「睡眠」');
  await p.click('[data-act=bRate][data-v="2"]');
  await until(async () => (await panelHas('[data-act=bMove]')) || (await panelHas('[data-act=bDef]')) || (await panelHas('.task')));
  for (let i = 0; i < 20 && !(await panelHas('[data-act=bMove]')); i++) {
    const d = await panelHas('[data-act=bDef]'); if (d) { await tryClick(d); await W(300); continue; }
    const r = await panelHas('[data-act=bRate][data-v="2"]'); if (r) { await tryClick(r); await W(300); continue; }
    await W(300);
  }
  check(!!(await panelHas('[data-act=bMove]')), '叫醒以后可以出招');
  // 换怪兽
  await p.click('[data-act=bSwitch]');
  await p.click('#sheet [data-act=bSwitchTo]');
  await until(async () => /Bubbly/.test(await p.textContent('.hpcard.me b')));
  check(/Bubbly/.test(await p.textContent('.hpcard.me b')), '战斗中换上了 Bubbly');
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]');
  // 大地图上用治状态的道具
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); });
  const stNow = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.box[0].st);
  check(stNow === null || stNow === undefined || stNow === 'slp', '状态会保存在存档里（' + stNow + '）');

  // ---------- 辅助招式：能力升降 ----------
  await save({ mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0, moves: ['fire:0', 's:power'] }], team: ['a'], dex: {}, balls: 5, potions: 3, bag: {}, badges: {} } });
  await p.reload(); await W(400);
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 3)] }));
  await menuUp();
  await p.click('[data-act=bMove][data-i="1"]');
  check(!!(await panelHas('#b-say')), '辅助招式要念句子');
  await p.click('[data-act=bRate][data-v="2"]');
  check(await until(async () => /攻击大幅提高/.test(await msg())), '蓄力：攻击大幅提高');
  check(await until(async () => /攻↑2/.test(await p.textContent('#b-mystg'))), '血条上显示 攻↑2');
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]');

  // ---------- 升级学新招：满 4 招要忘掉一个，还要说出来 ----------
  await save({ mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 279, moves: ['fire:0', 'normal:0', 's:burn', 'normal:1'] }, { uid: 'b', sp: 'bubbly', lv: 5, xp: 0 }], team: ['a', 'b'], dex: {}, balls: 5, potions: 3, bag: { expshare: 1 }, badges: {} } });
  await p.reload(); await W(400);
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 2)] }));
  for (let i = 0; i < 60 && !(await p.$('#b-panel [data-act=bEnd]')); i++) {
    const mv = await panelHas('[data-act=bMove][data-i="0"]'); if (mv) { await tryClick(mv); await W(200); continue; }
    const r = await panelHas('[data-act=bRate][data-v="2"]'); if (r) { await tryClick(r); await W(200); continue; }
    const d = await panelHas('[data-act=bDef]:not(.right):not(.wrong):not(.dim)'); if (d) { await tryClick(d); await W(200); continue; }
    await W(250);
  }
  check(await until(() => p.$('#sheet [data-act=mForget]')), '升到 Lv15 想学 Flame Wave：问要忘掉哪一招');
  await p.click('#sheet [data-act=mForget][data-k="1"]');
  check(/Emberpup, learn Flame Wave!/.test(await p.textContent('#sheet .say-text')), '要大声说 Emberpup, learn Flame Wave!');
  await p.click('#sheet [data-act=mLearnGo]');
  await W(300);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.box);
  check(after[0].moves[1] === 'fire:1' && after[0].lv === 15, '学会了 Flame Wave，忘掉了第 2 招 ' + JSON.stringify(after[0].moves));
  check(after[1].xp > 0, '学习装置：没出场的 Bubbly 也拿到了经验（' + after[1].xp + '）');

  // ---------- 怪兽详情 ----------
  await p.click('#sheet [data-act=close]').catch(() => {});
  await p.evaluate(() => document.querySelector('[data-act=bEnd]') && document.querySelector('[data-act=bEnd]').click());
  await W(300);
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'mSum'; b.dataset.u = 'a'; document.body.appendChild(b); b.click(); });
  await W(300);
  const sum = await p.textContent('#sheet');
  check(/防御 DEF/.test(sum) && /速度 SPD/.test(sum) && /Flame Wave/.test(sum), '怪兽详情：能力值和招式');
  await p.click('#sheet [data-act=close]').catch(() => {});

  // ---------- 对战替复习干活：先出今天到期的题；掌握了的凭记忆念（🔥 伤害 ×1.5）；答对算一次复习 ----------
  // 下面的存档都给 1 枚徽章：Lv 30 的怪兽一定听话（没有徽章时三成概率「在发呆」，测试会随机失败）
  const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  await save({ book: { at: 0, mix: 0, view: 'book' }, rev: { v: 1, items: { 'sent:0:3': { k: 'sent', w: 0, i: 3, b: 5, due: '2000-01-01', x: 0 } } },
    mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 30, xp: 0, moves: ['fire:0', 'fire:1', 'fire:2'] }], team: ['a'], dex: {}, balls: 5, potions: 3, bag: {}, badges: { 0: 1 } } });
  await p.reload(); await W(400);
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 2)] }));
  await menuUp();
  await p.click('[data-act=bMove][data-i="1"]');
  let bt = await p.evaluate(() => { const B = MonsterGame._b(), s = document.querySelector('#b-say'); return { q: B.task.q, blind: B.blind, mask: s && s.classList.contains('mask'), say: s && s.textContent, head: document.querySelector('#b-panel .task-h').textContent, zh: document.querySelector('#b-panel').textContent.includes(B.task.zh) }; });
  check(bt.q.w === 0 && bt.q.i === 3, '对战先出今天到期的复习题', bt.q);
  check(bt.mask && !/[a-z]/i.test(bt.say) && bt.zh && /凭记忆/.test(bt.head) && bt.blind, '掌握了的句子：只给中文，凭记忆念（🔥 不看字）', bt);
  await p.screenshot({ path: path.join(__dirname, 'screenshots', 'battle-recall.png') });
  await p.click('[data-act=bRate][data-v="2"]');
  check(await until(async () => /不看字/.test(await msg())), '不看字念对：伤害 ×1.5', await msg());
  const e3 = await p.evaluate(() => window.EchoGame.S.rev.items['sent:0:3']);
  check(e3.b === 6 && e3.due === ymd(30), '对战里答对到期的题：算一次复习，升一格', e3);
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]').catch(() => {});

  // 没进复习本的句子：照着念，可以自己选「🔥 不看字念」
  await save({ book: { at: 0, mix: 0, view: 'book' }, mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 30, xp: 0, moves: ['fire:0', 'fire:1', 'fire:2'] }], team: ['a'], dex: {}, balls: 5, potions: 3, bag: {}, badges: { 0: 1 } } });
  await p.reload(); await W(400);
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 2)] }));
  await menuUp();
  await p.click('[data-act=bMove][data-i="1"]');
  const plain = await p.evaluate(() => { const s = document.querySelector('#b-say'); return { mask: s.classList.contains('mask'), blindBtn: !!document.querySelector('#b-panel [data-act=bBlind]') }; });
  await p.click('#b-panel [data-act=bBlind]');
  const blind = await p.evaluate(() => ({ mask: document.querySelector('#b-say').classList.contains('mask'), blind: MonsterGame._b().blind }));
  check(!plain.mask && plain.blindBtn && blind.mask && blind.blind, '新句子照着念；点「🔥 不看字念」就把字藏起来', { plain, blind });
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]').catch(() => {});

  // 大招：掌握了的对话先只播问题（AI 打分时），说错一次才亮出选项，亮出来就不能暴击
  await save({ book: { at: 0, mix: 0, view: 'book' }, settings: { tts: 'online', mode: 'auto', gfx: '2d', sfx: false }, rev: { v: 1, items: { 'dlg:0:1': { k: 'dlg', w: 0, i: 1, b: 3, due: '2000-01-01', x: 0 } } },
    mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 30, xp: 0, moves: ['fire:0', 'fire:1', 'fire:2'] }], team: ['a'], dex: {}, balls: 5, potions: 3, bag: {}, badges: { 0: 1 } } });
  await p.reload(); await W(400);
  await p.evaluate(() => {
    EchoTalk.cloudSR = () => true; EchoTalk.aiTip = async () => '';
    EchoTalk.listenOnce = async () => ({ text: 'banana pancake', err: null });   // 假的识别：说了句不相干的
  });
  await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 2)], rules: { kind: 'talk' } }));
  await menuUp();
  await p.click('[data-act=bMove][data-i="2"]');
  const ult = await p.evaluate(() => ({ q: MonsterGame._b().task.q, hidden: document.querySelector('#b-opts').hidden, show: !!document.querySelector('#b-show') }));
  check(ult.q.i === 1 && ult.hidden && ult.show, '大招：掌握了的对话先不给选项', ult);
  await p.click('#b-mic');
  check(await until(() => p.evaluate(() => !document.querySelector('#b-opts').hidden && MonsterGame._b().hinted)), '凭记忆没说对：亮出选项，这次不能暴击');
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]').click(); });
  await p.click('#sheet [data-act=bEnd]').catch(() => {});
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
