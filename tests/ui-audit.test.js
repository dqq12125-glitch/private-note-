// 细节检查（tools/ui-audit/）挑一部分画面跑：横屏小手机、iPhone 横竖屏，中英文——
// 要紧的按钮够得着（在屏幕里、在安全区里、不用滚、没被盖住）、不同的层之间字不压字、字不被裁掉 / 不该省略的不省略。
// 老板 2026-11-20 在 iPhone 横屏上看第一座挑战馆的鹦鹉门：看不出答案、要往下滑才点得到话筒、HUD 的目标那行压在对话框上——这一类不能再出现。
// 用法：node tests/ui-audit.test.js（约 3–4 分钟）；截图（只截有问题的）在 tests/screenshots/ui-audit/test/
'use strict';
const path = require('path'), fs = require('fs');
const L = require('../tools/ui-audit/lib'), SC = require('../tools/ui-audit/screens'), RUN = require('../tools/ui-audit/run');
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) { fails++; if (more) console.log('    ' + (typeof more === 'string' ? more : JSON.stringify(more).slice(0, 1600))); } return ok; };

// 挑出来的画面（每一类至少一个）
const PICK = ['gym-i0G', 'dlg-answer-pic', 'dlg-answer-pic-long', 'dlg-speak-long', 'dlg-choice-many', 'dlg-plain-long', 'world-hud', 'world-hud-gym', 'world-menu',
  'battle-menu', 'battle-task-1', 'q-lw', 'q-sr_s', 'q-bt', 'place-q-vocab', 'wizard-device', 'settings', 'home-mon', 'npc-gift', 'acct-signin', 'chat-eval', 'rot-world', 'rot-battle'];
// 要查的种类：挡路的（含伸进安全区的按钮）+ 压在一起 + 裁掉（按钮太小、字伸进安全区、提示条只记下来，不算失败）
const FAIL_KINDS = ['stale-size', 'reach-off', 'reach-covered', 'scroll-trap', 'reach-unsafe', 'text-off', 'setup-failed', 'overlap', 'covered', 'clip', 'ellipsis'];
// 已知、这次不改的（写着原因）：画面 + 种类 + 选择器里的一段
// 第四项：只在这几种屏幕上算（正则，不写 = 都算）
const KNOWN = [
  // 竖屏首页是一整页往下滑：上面先是学习的卡片（能力检测、今日复习），「继续冒险」在怪兽卡片下面——先学再冒险是家长定的，排法要老板定（横屏已经放到上面了）
  ['home-mon', 'scroll-trap', '[data-act=wEnter]', /-p$/],
];
const known = (rec, q) => KNOWN.some(k => rec.screen.startsWith(k[0]) && q.k === k[1] && q.sel.includes(k[2]) && (!k[3] || k[3].test(rec.view)));

(async () => {
  const t0 = Date.now();
  const outDir = path.join(L.OUT, 'test'); fs.mkdirSync(outDir, { recursive: true });
  const all = SC.screens().filter(s => PICK.includes(s.id));
  check(all.length === PICK.length, '挑的画面都在 screens.js 里（' + all.length + '/' + PICK.length + '）', PICK.filter(id => !all.some(s => s.id === id)));
  const srv = await L.serve(null), browser = await L.IL.launch('chromium');
  const combos = [['ip17-l', 'en'], ['ip17-l', 'zh'], ['se-l', 'en'], ['ip17-p', 'zh'], ['se-p', 'en']];
  const recs = [];
  // 老板平常玩的是公开版、横屏、新画风：户外的画面另外用新画风查一遍（HUD、右上角指北针、对话框盖在 3D 画面上）
  const NEW = SC.screens().filter(s => ['world-hud', 'world-compass', 'world-menu', 'dlg-answer-pic', 'dlg-choice-many', 'dlg-plain-long', 'rot-world'].includes(s.id));
  await Promise.all(combos.map(async ([view, lang]) => {
    const list = all.filter(s => (!s.deep || ['ip17-l', 'se-l', 'ip17-p'].includes(view)) && (!s.views || s.views.includes(view)));
    const r = await RUN.runCombo(browser, srv.base, { view, lang, look: '' }, list, outDir, 'bad', () => {});
    recs.push(...r.recs);
  }).concat([['ip17-l', 'en'], ['ip17-l', 'zh']].map(async ([view, lang]) => {
    const r = await RUN.runCombo(browser, srv.base, { view, lang, look: 'new' }, NEW, outDir, 'bad', () => {});
    recs.push(...r.recs.map(x => Object.assign(x, { view: view + '-new' })));
  })));
  // 鹦鹉门的答题页（英语界面）：图下面写着钟点、英文那句也念出钟点、HUD 让开了
  {
    const t = await L.open(browser, srv.base, { view: 'ip17-l', lang: 'en', bridge: {} });
    await t.boot(L.SAVE({ lang: 'en', world: { map: 'i0G', x: 9, y: 13, dir: 'up' } }));
    await t.enterWorld();
    await t.E(() => EchoWorld._debug().M.npcs.forEach(n => { n.sight = 0; }));
    await t.tp(9, 13, 'up'); await t.A(); await t.W(300);
    const k = await t.toTask(10); await t.typed(); await t.W(300);
    const g = await t.E(() => ({ cap: (document.querySelector('#w-dlg .d-cap') || {}).textContent || '', en: (document.querySelector('#w-dlg .d-en') || {}).textContent || '', pic: (document.querySelector('#w-dlg .say-emoji') || {}).textContent || '',
      hud: getComputedStyle(document.querySelector('#world .w-hud')).opacity, mic: (() => { const m = document.querySelector('#w-mic'); if (!m) return null; const r = m.getBoundingClientRect(); return r.bottom <= innerHeight - 21 && r.top >= 0; })() }));
    check(k === 'answer' && g.cap === '7:00 am' && /seven a\.m\./.test(g.en) && /🌅/.test(g.pic), '鹦鹉门（英语界面）：答题页图下写着「7:00 am」，英文那句念出钟点', Object.assign({ k }, g));
    check(+g.hud === 0 && g.mic === true, '鹦鹉门（横屏）：HUD 让开了，话筒在屏幕里、不在底部横条上', g);
    await t.ctx.close();
  }
  // 「📍 现在要做」能点（2026-11-20 老板：「现在要做点了可以直接跳到要做的事情那里」）
  {
    const t = await L.open(browser, srv.base, { view: 'ip17-l', lang: 'en', bridge: {} });
    // ① 课本门槛：冒险菜单的卡片写着去哪；点了离开大地图，到那个单元、BOSS 关（还没解锁就是第一关没拿星的）亮着
    await t.boot(L.SAVE({ lang: 'en', world: { map: 't0', x: 14, y: 9 } }), '', null, true); await t.enterWorld();
    const o = await t.E(() => EchoWorld.objective());
    const before = await t.E(() => JSON.stringify({ g: EchoGame.gate(), st: EchoGame.S.stars }));
    await t.act('wMenu'); await t.W(400);
    const lab = await t.E(() => (document.querySelector('#w-goal-full .goal-go') || {}).textContent || '');
    check(o && o.go === 'unit' && o.wi >= 13 && /Practice: 7A Unit 1/.test(lab), '现在要做（课本门槛）：卡片上写着点了去哪', { o, lab });
    await t.click('#w-goal-full'); await t.W(900);
    const a = await t.E(wi => { const n = document.querySelector('#w' + wi + ' .node.goal'); return { world: document.querySelector('#world').hidden, quiz: !document.querySelector('#quiz-home').hidden, li: n ? +n.dataset.l : -1, bossOpen: !!document.querySelector('#w' + wi + ' .node[data-l="6"]:not([disabled])'), adv: EchoWorld._debug().adv.on, saved: JSON.parse(localStorage.getItem('echo-island-v1')).world.map }; }, o.wi);
    check(a.world && a.quiz && a.li === (a.bossOpen ? 6 : 0) && !a.adv && a.saved === 't0', '点了：离开大地图（冒险计时停了、存档还在 t0），闯关练习里那个单元的' + (a.bossOpen ? ' BOSS 关' : '第一关') + '亮着', a);
    check(before === await t.E(() => JSON.stringify({ g: EchoGame.gate(), st: EchoGame.S.stars })), '点了不改学习锁、不改星星');
    // 首页「继续冒险」下面那行 📍 也有「去闯关练习」
    await t.home('mon'); await t.W(300);
    check(await t.click('#mon-go .obj-go'), '首页 📍 那行有「去闯关练习」（2026-11-23 起「继续冒险」和这行在最上面的 #mon-go）');
    await t.W(600);
    check(await t.E(() => !document.querySelector('#quiz-home').hidden && !!document.querySelector('.node.goal')), '首页点了也到那个单元');
    // ② HUD 上的 📍 那行：课本门槛时点了也直接去
    await t.boot(L.SAVE({ lang: 'en', world: { map: 't0', x: 14, y: 9 } }), '', null, true); await t.enterWorld();
    await t.click('#w-goal'); await t.W(900);
    check(await t.E(() => document.querySelector('#world').hidden && !!document.querySelector('.node.goal')), 'HUD 的 📍 那行（课本门槛）：点了直接到那个单元');
    // ③ 目标在地图上（课本门槛都过了，去挑战馆）：不传送，关上菜单、左上角那行亮几下
    const stars = { '13-6': 3, '14-6': 3 };   // 第一座挑战馆的课本门槛：七上前两个单元的 BOSS（不打满七上：那样博士会打电话来送神兽）
    await t.boot(L.SAVE({ lang: 'en', world: { map: 't0', x: 14, y: 9 }, extra: { stars } }), '', null, true); await t.enterWorld();
    await t.closeDlg();
    const o2 = await t.E(() => EchoWorld.objective()), pos = await t.dbg();
    await t.act('wMenu'); await t.W(300);
    const lab2 = await t.E(() => (document.querySelector('#w-goal-full .goal-go') || {}).textContent || '');
    await t.click('#w-goal-full'); await t.W(300);
    const b = await t.E(() => ({ modal: !document.querySelector('#modal').hidden, world: !document.querySelector('#world').hidden, flash: document.querySelector('#w-goal').classList.contains('flash') }));
    const pos2 = await t.dbg();
    check(o2 && !o2.go && /map/.test(lab2) && !b.modal && b.world && b.flash && pos2.map === pos.map && pos2.x === pos.x && pos2.y === pos.y, '现在要做（在地图上）：关上菜单、目标那行亮了，人没有被传送', { o2, lab2, b });
    await t.ctx.close();
  }
  await browser.close(); srv.close();
  for (const [view, lang] of combos.concat([['ip17-l-new', 'en'], ['ip17-l-new', 'zh']])) {
    const mine = recs.filter(r => r.view === view && r.lang === lang);
    const bad = mine.flatMap(r => r.problems.filter(q => FAIL_KINDS.includes(q.k) && !known(r, q)).map(q => r.screen + ' [' + q.k + '] ' + q.sel + ' 「' + (q.text || '').slice(0, 30) + '」' + (q.by ? ' by ' + q.by : '') + (q.on ? ' on ' + q.on : '')));
    check(!bad.length, view + ' · ' + lang + '：' + mine.length + ' 个画面，要紧的按钮都够得着、字不压字、不被裁掉', bad.slice(0, 20).join('\n    '));
  }
  // 鹦鹉门：答题页自己带着钟点（英语界面也看得到），话筒不用滚就点得到
  const gate = recs.filter(r => /^gym-i0G:gate-.*answer$/.test(r.screen));
  check(gate.length >= 3 * combos.filter(c => ['ip17-l', 'se-l', 'ip17-p'].includes(c[0])).length, '鹦鹉门：三道门的答题页都量到了（' + gate.length + '）');
  check(gate.every(r => r.primary >= 5), '鹦鹉门：每一页都有话筒和四个选项', gate.map(r => r.view + r.lang + ':' + r.primary));
  console.log('用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + ' 秒');
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
})().catch(e => { console.log('✗ 出错：' + e.stack); console.log('FAIL'); process.exitCode = 1; });
