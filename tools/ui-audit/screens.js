// 细节检查要走的画面。每个画面：{ id, grp, setup(t), primary: [要紧的按钮], ok: [允许省略号的字], outdoor: 新老画风都查,
//   cfg: 页面配置（bridge / query：和上一个画面不一样就另开一页），deep: 只在 --deep 或这几种屏幕上查（挑战馆、各岛的剧情，慢） }
// setup 把页面带到那个画面（失败就抛错，记成 setup-failed）。画面之间不互相依赖：每个 setup 自己 boot 存档（存档一样就只回首页）
'use strict';
const L = require('./lib');

// ---------- 要紧的按钮（够不着 / 要滚才看得到 = 卡住玩） ----------
const P_DLG = ['#w-mic', '#w-dlg .opt', '#w-dlg [data-act=wPick]', '#w-dlg [data-act=wSelfDone]', '#w-dlg #w-custom button', '#w-dlg [data-act=wAiSkip]:not([hidden])'];
const P_WORLD = ['#world .ab .ba', '#world .ab .bb', '#world .w-hud .x', '#world .w-menu', '#w-compass:not([hidden])', '#w-chat:not([hidden])'];
const P_SHEET = ['#sheet [data-act=close]', '#sheet .btn.wide', '#sheet [data-focus]'];
const P_PLAY = ['#mic', '#p-body .opt', '#fb-btn', '#lo-check', '#self [data-act=rate]', '#p-skip:not([hidden])', '#p-body [data-act=btOpt]', '#p-body [data-act=bossGo]'];
const P_BATTLE = ['#b-mic', '#b-panel [data-act=bMove]', '#b-panel [data-act=bDef]', '#b-panel .opt', '#b-panel [data-act=bEnd]', '#b-panel [data-act=bRate]', '#b-panel [data-act=bLOpt]', '#b-panel [data-act=bBack]', '#b-panel [data-act=bCatch]', '#b-panel [data-act=bFlee]'];
const P_PLACE = ['#place [data-act=plPick]', '#place [data-act=plMic]', '#place [data-act=plSay]', '#place [data-act=plStart]', '#place [data-act=plWhoNext]', '#place [data-act=plResume]', '#place [data-act=plFinish]', '#place [data-act=plIdk]', '#place [data-act=plPause]'];
const P_SU = ['#su-next', '#su-back', '#su-box [data-act=suPin]', '#su-consent'];
const P_TALK = ['#tk-mic', '#tk-ov [data-act=talk_end]', '#tk-ov [data-act=talk_help]', '#tk-ov [data-act=talk_close]', '.tk-eval [data-act=talk_close]'];
// 省略号允许的：大地图顶上 📍 目标那一行、地名（点开有全文 / 只是个名字）、聊天列表里的角色简介
const OK_ELL = ['#w-goal', '.w-zone b', '.w-zone small', '.tk-card small'];

// 聊天用的假阿里云（和 tests/i18n.test.js 的 TALK_FAKE 一样：实时语音、评语都是假的，不连真的 AI）
const TALK_FAKE = () => {
  const fk = window.__fk = { key: true, sent: [], said: [], n: 0, evalResp: null, stepsResp: [], reply: 'OK! Tell me more about it.' };
  const cb = (id, t, d, ms) => setTimeout(() => window.__echoNative && window.__echoNative(id, t, d), ms || 5);
  const chat = o => ({ choices: [{ message: { content: o } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
  window.EchoNative = {
    hasKey: () => !!fk.key, setKey() {}, setOrientation() {},
    wsOpen(id) { cb(id, 'open', '', 20); },
    wsSend(id, text) {
      const m = JSON.parse(text); fk.sent.push(m.type);
      if (m.type === 'input_audio_buffer.commit') { const it = 'it' + (++fk.n); cb(id, 'message', JSON.stringify({ type: 'input_audio_buffer.committed', item_id: it })); cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: it, transcript: fk.said.shift() || 'hello' })); }
      if (m.type === 'response.create') { const rid = 'r' + (++fk.n), pcm = btoa(String.fromCharCode.apply(null, new Uint8Array(2400))); cb(id, 'message', JSON.stringify({ type: 'response.audio.delta', delta: pcm })); cb(id, 'message', JSON.stringify({ type: 'response.audio_transcript.delta', delta: fk.reply })); cb(id, 'message', JSON.stringify({ type: 'response.done', response: { id: rid, usage: { input_tokens: 100, output_tokens: 50 } } })); }
    },
    wsClose() {},
    post(id, url, body) {
      let b = {}; try { b = JSON.parse(body); } catch (e) { /* 不是 JSON */ }
      const sys = (b.messages && b.messages[0] && b.messages[0].content) || '';
      if (/打勾|check off/i.test(sys)) return cb(id, 'ok', JSON.stringify(chat(JSON.stringify({ done: fk.stepsResp.map(x => x + 1) }))), 15);
      if (/打分|feedback on a spoken English conversation/.test(sys)) return cb(id, 'ok', JSON.stringify(chat(JSON.stringify(fk.evalResp || { steps: [true, true, true], done: true, stars: 3, praise: 'Great talking with you! You asked clear questions.', tips: [{ said: 'It cool in October', better: 'It is cool in October.', note: 'Don\'t forget "is".' }], memory: [], concern: false, concernWhy: '' }))), 30);
      cb(id, 'fail', '{"code":"NotInTest"}');
    },
  };
};
const IOS_MARK = () => { window.ECHO_IOS = 1; const mark = () => { if (document.documentElement) document.documentElement.classList.add('echo-ios'); }; mark(); document.addEventListener('DOMContentLoaded', mark); };

const SV = (t, o) => L.SAVE(Object.assign({ lang: t.lang }, o || {}));
// 进大地图：存档里的地图和位置
const worldSave = (t, o) => SV(t, Object.assign({ gfx: t.look ? 'low' : '2d', world: {} }, o || {}));
async function inWorld(t, o) { await t.boot(worldSave(t, o)); await t.enterWorld(); await t.clearToasts(); }
// 放一段对话，停在第 i 页（任务页：等打字打完）
async function talkPages(t, pages, at) {
  await t.E(pages => EchoWorld._debug().talk(pages.map(p => Object.assign({}, p, p.look === 'mom' ? { look: EchoPeople.LOOKS.mom } : {}, p.kind === 'choice' ? { pick: () => [] } : {}))), pages);
  for (let i = 0; i < (at || 0); i++) { await t.typed(); await t.A(); await t.W(120); }
  await t.typed();
}
const LONG_EN = 'Squawk! It is three p.m. now. Look at the big sun over the beach and say the right greeting to open the gate!';

// 能力检测：一路点「不知道」，每换一种题停下来
async function placeTo(t, skill) {
  await t.boot(SV(t), '', null, true);   // 每次重开：上一次没做完的检测会停在「接着做」
  await t.E(() => window.EchoPlace.open('who')); await t.W(300);
  await t.click('#place [data-act=plWho][data-v=teen]'); await t.W(80);
  await t.click('#place [data-act=plKnow][data-v="1"]'); await t.W(80);
  await t.click('#place [data-act=plWhoNext]'); await t.W(250);
  if (skill === 'ready') return;
  await t.click('#place [data-act=plStart]'); await t.W(600);
  for (let i = 0; i < 140; i++) {
    const u = await t.E(() => { const u = window.EchoPlace._ui(); return u ? { step: u.step, skill: u.item && u.item.skill, busy: !!u.busy, locked: !!u.locked } : null; });
    if (!u) throw new Error('能力检测关掉了');
    if (skill === 'result' && u.step === 'result') return;
    if (u.step === 'q' && u.skill === skill) { await t.W(400); return; }
    if (u.step === 'q' && u.skill === 'speak') await t.click('#place [data-act=plSpeakSkip]');
    else if (u.step === 'q') await t.click('#place [data-act=plIdk]');
    await t.W(380);
  }
  throw new Error('没走到 ' + skill + '：' + JSON.stringify(await t.E(() => { const u = window.EchoPlace._ui(); return u && { step: u.step, skill: u.item && u.item.skill, busy: u.busy, locked: u.locked, playing: u.playing }; })));
}

// 闯关练习：直接给一道题（EchoGame.playQs）
const oneQ = (id, q, after) => ({ id, grp: 'practice', primary: P_PLAY, async setup(t) {
  await t.boot(SV(t, { tab: 'quiz' }));
  await t.E(q => { EchoGame.closeModal(); EchoGame.playQs([q]); }, q); await t.W(800);
  if (after) await after(t);
} });

// 挑战馆和各岛：地图上所有的雕像 / 机关门 / 剧情人物，站到前面按 A，停在第一页任务（或者第一页对话）
const GYMS = [['i0G', 0], ['i1G', 1], ['i2G', 2], ['i3G', 3], ['i4G', 4], ['i5G', 5], ['i6G', 6], ['i7G', 7], ['i8G', 8], ['i9G', 9], ['i10G', 10], ['i11G', 11], ['i12G', 12]];
const gymSave = (t, z) => worldSave(t, { gfx: '2d', badges: Object.fromEntries([...Array(z).keys()].map(i => [i, 1])), world: { map: 'i' + z + 'G', x: -1, y: -1, arrive: null, visited: Object.fromEntries([...Array(z + 1).keys()].map(i => [i, 1])), flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, L.ALL_CH) }, extra: { stars: Object.fromEntries([...Array(60).keys()].map(i => ['' + i + '-6', 3])) } });
// 一张地图上能对着按 A 的东西：Z 雕像、| 机关门、剧情人物 / 出题人
const spotsOf = t => t.E(() => {
  const d = EchoWorld._debug(), M = d.M, out = [], W = EchoMaps.WALK;
  const ok = (x, y) => { const c = M.grid[y] && M.grid[y][x]; return !!c && W.includes(c) && !M.npcs.some(n => n.x === x && n.y === y); };
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) { const c = M.grid[y][x]; if (c !== 'Z' && c !== '|') continue; for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) if (ok(x + dx, y + dy)) { out.push({ k: c === 'Z' ? 'statue' : 'gate', x: x + dx, y: y + dy, dir }); break; } }
  M.npcs.forEach(n => { if (!/^(story|quiz|gift|talk)$/.test(n.role) || n.mon) return; for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) if (ok(n.x + dx, n.y + dy)) { out.push({ k: 'npc:' + n.role + ':' + (n.name || n.id), x: n.x + dx, y: n.y + dy, dir }); break; } });
  return out;
});

function screens() {
  const S = [];
  const add = s => S.push(s);

  // ================= 首页 =================
  add({ id: 'home-mon', grp: 'home', primary: ['[data-act=wEnter]', '#tabs [data-act=tab]'], async setup(t) { await t.boot(SV(t)); await t.home('mon'); } });
  add({ id: 'home-quiz', grp: 'home', primary: ['.node.cur'], async setup(t) { await t.boot(SV(t)); await t.home('quiz'); await t.W(1300); } });   // 等它滚到「开始」那一关
  add({ id: 'home-talk', grp: 'home', primary: ['#tabs [data-act=tab]'], async setup(t) { await t.boot(SV(t)); await t.home('talk'); } });
  add({ id: 'home-bars', grp: 'home', cfg: { bridge: { key: '' } }, primary: ['#home-bars button', '[data-act=wEnter]'], async setup(t) { await t.boot(SV(t, { extra: { upd: { code: 999999, name: 'new' } } })); await t.home('mon'); await t.W(300); } });
  add({ id: 'home-level-node', grp: 'home', primary: P_SHEET.concat(['#sheet [data-act=start]']), async setup(t) { await t.boot(SV(t)); await t.home('quiz'); await t.W(150); await t.click('.node.cur'); await t.W(400); } });
  add({ id: 'settings', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.home('quiz'); await t.act('settings'); await t.W(400); } });
  add({ id: 'settings-parent', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.home('quiz'); await t.act('settings'); await t.W(300); await t.E(() => { const d = document.querySelector('#set-parent'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }); await t.W(300); } });
  add({ id: 'pin-pad', grp: 'home', primary: ['#sheet [data-act=pinKey]', '#sheet [data-act=pinDel]'], async setup(t) { await t.boot(SV(t)); await t.home('quiz'); await t.act('settings'); await t.W(300); await t.E(() => { const d = document.querySelector('#set-parent'); if (d) d.open = true; const b = document.querySelector('#sheet [data-act=bakRestore]'); if (b) b.click(); }); await t.W(400); } });
  add({ id: 'report', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('report'); await t.W(400); } });
  // 2026-11-22 零基础学习路线（tools/course/WORDS.md）：单词表、单词卡、我的单词本、这一课学什么、求助的话、新手路线、点词弹出的小卡
  add({ id: 'words-list', grp: 'words', primary: P_SHEET.concat(['#sheet [data-act=wcOpen]']), async setup(t) { await t.boot(SV(t)); await t.act('wordList', { w: '0' }); await t.W(400); } });
  add({ id: 'words-cards', grp: 'words', primary: ['#sheet [data-act=wcNext]', '#sheet [data-act=wcSkip]', '#sheet [data-act=wcSay]', '#sheet [data-act=wcEnd]'], async setup(t) { await t.boot(SV(t)); await t.act('wcOpen', { w: '0' }); await t.W(400); } });
  add({ id: 'words-book', grp: 'words', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('wordBook'); await t.W(400); } });
  add({ id: 'words-lesson', grp: 'words', primary: P_SHEET.concat(['#sheet [data-act=lsDone]']), async setup(t) { await t.boot(SV(t)); await t.act('lesson', { w: '0' }); await t.W(400); } });
  add({ id: 'words-help', grp: 'words', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('sosList'); await t.W(400); } });
  add({ id: 'words-route', grp: 'words', primary: ['#quests [data-act=rtGo]', '[data-act=wEnter]'], async setup(t) { await t.boot(SV(t)); await t.E(() => { EchoGame.S.settings.route = true; EchoGame.goHome('mon'); }); await t.W(500); } });
  add({ id: 'words-pop', grp: 'words', primary: ['#wd-pop [data-act=wdPopX]'], async setup(t) {
    await t.boot(SV(t)); await t.E(() => { EchoGame.S.settings.wordTap = true; }); await t.act('wordList', { w: '0' }); await t.W(400);
    const pt = await t.E(() => { const s = document.querySelector('#sheet .wd-ex-t > span'); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = document.createRange(); r.selectNodeContents(s); const b = r.getClientRects()[0]; return b && { x: b.left + 6, y: b.top + b.height / 2 }; });
    if (!pt) throw new Error('单词表里没有例句');
    await t.p.mouse.click(pt.x, pt.y); await t.W(400);
    if (!(await t.E(() => { const e = document.getElementById('wd-pop'); return !!e && !e.hidden; }))) throw new Error('点例句的第一个词没有弹出小卡');
  } });
  add({ id: 'home-dex', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('mDex'); await t.W(600); } });
  add({ id: 'home-team', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('mTeam'); await t.W(500); } });
  add({ id: 'mon-summary', grp: 'home', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.act('mSum', { u: 'm1' }); await t.W(500); } });
  add({ id: 'mon-nick', grp: 'battle', primary: ['#sheet [data-act=mNickPick]', '#sheet [data-act=mNickSkip]', '#sheet [data-act=mNickOwn]'], async setup(t) { await t.boot(SV(t)); await t.E(() => MonsterGame.nickSheet('m1', 'sum')); await t.W(500); } });
  add({ id: 'mon-talk', grp: 'home', primary: ['#sheet [data-act=mTalkMic]', '#sheet [data-act=mTalkGo]', '#sheet [data-act=mTalkBack]'], async setup(t) { await t.boot(SV(t)); await t.E(() => MonsterGame.talkSheet('m1', 'sum')); await t.W(500); } });

  // ================= 能力检测 =================
  add({ id: 'place-card', grp: 'place', primary: ['#place-card [data-act=plOpen]'], async setup(t) { await t.boot(SV(t)); await t.home('mon'); await t.E(() => { const c = document.querySelector('#place-card'); if (c) c.scrollIntoView({ block: 'center' }); }); } });
  add({ id: 'place-who', grp: 'place', primary: P_PLACE.concat(['#place [data-act=plWho]']), async setup(t) { await t.boot(SV(t)); await t.E(() => window.EchoPlace.open('who')); await t.W(400); } });
  add({ id: 'place-ready', grp: 'place', primary: P_PLACE, async setup(t) { await placeTo(t, 'ready'); } });
  for (const k of ['vocab', 'listen', 'read', 'speak']) add({ id: 'place-q-' + k, grp: 'place', primary: P_PLACE, async setup(t) { await placeTo(t, k); } });
  add({ id: 'place-pause', grp: 'place', primary: ['#place [data-act=plResume]', '#place [data-act=plExit]', '#place [data-act=plRestart]'], async setup(t) { await placeTo(t, 'vocab'); await t.click('#place [data-act=plPause]'); await t.W(400); } });
  add({ id: 'place-result', grp: 'place', primary: ['#place [data-act=plFinish]'], async setup(t) { await placeTo(t, 'result'); await t.W(400); } });

  // ================= 首次设置向导（销售版：家长密码 + 密钥；云端模式：AI 和账号） =================
  const SALES = { bridge: { edition: 'sales', pin: null, key: '', net: 'ok', mic: 'granted' }, query: 'edition=sales' };
  const suTo = async (t, step, cloud) => {
    await t.boot(null, cloud ? 'edition=sales&cloud=http%3A%2F%2F127.0.0.1%3A9' : 'edition=sales', null);
    await t.until(() => t.E(() => !!document.querySelector('#setup')), 60, 150);
    await t.click('[data-act=suUi][data-l=' + t.lang + ']'); await t.W(250);
    if (step === 'welcome') return;
    await t.click('#su-consent'); await t.W(120); await t.click('#su-next'); await t.W(300);
    await t.until(() => t.E(() => !!document.querySelector('#su-verdict')), 60, 150);
    if (step === 'device') return;
    await t.click('#su-next'); await t.W(350);
    if (step === 'pin') return;
    for (let n = 0; n < 2; n++) { for (const d of '3691') await t.click('#su-box [data-act=suPin][data-k="' + d + '"]'); await t.W(350); }
    await t.click('#su-next'); await t.W(350);
    if (step === 'key') return;
    await t.click('#su-box [data-act=suKeySkip]'); await t.W(300);
    if (await t.E(() => (document.querySelector('#su-box .su-step') || {}).dataset.step === 'key')) { await t.click('#su-next'); await t.W(300); }
    await t.E(() => { const i = document.querySelector('#su-nick'); if (i) { i.value = 'Kevin'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); await t.W(150);
    if (step === 'nick') return;
    await t.click('#su-next'); await t.W(350);
    if (step === 'mons') return;
    for (let k = 0; k < 3; k++) { await t.E(k => { const b = document.querySelectorAll('#su-box [data-act=suMon]')[k]; if (b) b.click(); }, k); await t.W(100); }
    await t.click('#su-next'); await t.W(350);
    if (step === 'fam') return;
    await t.click('#su-next'); await t.W(400);
  };
  for (const st of ['welcome', 'device', 'pin', 'key', 'nick', 'mons', 'fam', 'done']) add({ id: 'wizard-' + st, grp: 'wizard', cfg: SALES, primary: P_SU, async setup(t) { await suTo(t, st); } });
  add({ id: 'wizard-cloud-welcome', grp: 'wizard', cfg: SALES, primary: P_SU, async setup(t) { await suTo(t, 'welcome', true); } });
  add({ id: 'wizard-cloud-ai', grp: 'wizard', cfg: SALES, primary: P_SU.concat(['#su-box [data-act=ac_signin]']), async setup(t) { await suTo(t, 'key', true); } });

  // ================= 闯关练习：每种题、反馈条、结算 =================
  add(oneQ('q-lw', ['lw', 0, 0]));
  add(oneQ('q-ls', ['ls', 0, 0]));
  add(oneQ('q-lm', ['lm', 0, 0]));
  add(oneQ('q-lr', ['lr', 0, 0]));
  add(oneQ('q-lo', ['lo', 0, 0]));
  add(oneQ('q-sr_w', ['sr_w', 0, 1]));
  add(oneQ('q-sr_s', ['sr_s', 0, 1]));
  add(oneQ('q-sr_d', ['sr_d', 0, 1]));
  add(oneQ('q-sp', ['sp', 0, 2]));
  add(oneQ('q-bt', ['bt', 0, 0]));
  add(oneQ('q-book-lw', ['lw', 13, 3]));
  add(oneQ('q-lw-fb', ['lw', 0, 2], async t => { await t.E(() => { const P = EchoGame.P(), k = P.q.opts.findIndex(o => o.c); document.querySelectorAll('#p-body .opt')[k].click(); }); await t.W(600); }));
  add(oneQ('q-lw-wrong', ['lw', 0, 2], async t => { await t.E(() => { const P = EchoGame.P(), k = P.q.opts.findIndex(o => !o.c); document.querySelectorAll('#p-body .opt')[k].click(); }); await t.W(600); }));
  add({ id: 'practice-result', grp: 'practice', primary: ['#result [data-act]'], async setup(t) {
    await t.boot(SV(t, { tab: 'quiz' }));
    await t.E(() => { EchoGame.closeModal(); EchoGame.playQs([['lw', 0, 2]]); }); await t.W(700);
    await t.E(() => { const P = EchoGame.P(), k = P.q.opts.findIndex(o => o.c); document.querySelectorAll('#p-body .opt')[k].click(); }); await t.W(500);
    await t.click('#fb-btn'); await t.until(() => t.E(() => !document.querySelector('#result').hidden), 40, 150); await t.W(2000);
    await t.E(() => EchoGame.closeModal()); await t.W(300);
  } });
  add({ id: 'review', grp: 'practice', primary: P_PLAY, async setup(t) { await t.boot(SV(t)); await t.act('startReview'); await t.W(900); } });

  // ================= 大地图：HUD、菜单、各个弹窗（新老画风都查） =================
  const W0 = { world: { map: 't0', x: 14, y: 9 } };
  add({ id: 'world-hud', grp: 'world', outdoor: true, primary: P_WORLD, async setup(t) { await inWorld(t, W0); } });
  add({ id: 'world-hud-pad', grp: 'world', primary: P_WORLD.concat(['#world .dpad .dp']), async setup(t) { await t.boot(worldSave(t, Object.assign({ extra: { settings: Object.assign(SV(t).settings, { ctl: 'pad', gfx: '2d' }) } }, W0))); await t.enterWorld(); } });
  add({ id: 'world-hud-route', grp: 'world', outdoor: true, primary: P_WORLD, async setup(t) { await inWorld(t, { world: { map: 'r0', x: -1, y: -1, arrive: 'from:t0' } }); } });
  add({ id: 'world-hud-gym', grp: 'world', primary: P_WORLD, async setup(t) { await inWorld(t, { world: { map: 'i0G', x: 6, y: 15, dir: 'up' } }); } });
  add({ id: 'world-compass', grp: 'world', outdoor: 'new', primary: P_WORLD, async setup(t) { await inWorld(t, W0); await t.E(() => { const R = EchoWorld._debug().R; if (R.orbit) R.orbit('set', 120); }); await t.W(600); } });
  add({ id: 'world-menu', grp: 'world', outdoor: true, primary: P_SHEET.concat(['#sheet .w-menu-grid .btn']), async setup(t) { await inWorld(t, W0); await t.act('wMenu'); await t.W(400); } });
  for (const [id, a] of [['team', 'mTeam'], ['bag', 'mBag'], ['dex', 'mDex'], ['skills', 'wSkills'], ['quests', 'wQuests'], ['sighting', 'sgOpen'], ['help', 'wHelp']]) add({ id: 'world-' + id, grp: 'world', primary: P_SHEET, async setup(t) { await inWorld(t, Object.assign({ extra: { world: Object.assign({}, worldSave(t).world, W0.world, { been: { r0: 1 } }) } }, W0)); await t.act('wMenu'); await t.W(250); await t.act(a); await t.W(500); } });
  add({ id: 'world-pc', grp: 'world', primary: P_SHEET, async setup(t) { await inWorld(t, W0); await t.E(() => MonsterGame.pcSheet()); await t.W(500); } });

  // ================= 对话：每种页 =================
  const nar = (en, zh, x) => Object.assign({ who: '旁白', emo: '💬', en, zh }, x || {});
  const mom = (en, zh, x) => Object.assign({ who: 'Mom', look: 'mom', g: 'f', en, zh }, x || {});
  const parrot = (en, zh, x) => Object.assign({ who: 'Parrot', emo: '🦜', en, zh }, x || {});
  const GREETS = ['Good morning!', 'Good afternoon!', 'Good evening!', 'Good night!'];
  const dlgScreen = (id, pages, at, extra) => add(Object.assign({ id: 'dlg-' + id, grp: 'dialogue', outdoor: true, primary: P_DLG, async setup(t) { await inWorld(t, W0); await talkPages(t, pages, at); } }, extra || {}));
  dlgScreen('plain', [mom('Good morning, {name}! Did you sleep well? Breakfast is on the table.', '早上好！睡得好吗？早饭在桌上。')]);
  dlgScreen('plain-long', [mom('Remember: wild monsters live in the tall grass. Talk to them in English, and they will listen to you. Be kind, and come home before dinner!', '记住：野生怪兽住在高高的草丛里。用英语和它们说话，它们就会听你的。要友善，晚饭前回家！')]);
  dlgScreen('nar', [nar('A cool wind blows from the sea. You can hear the waves.', '海上吹来一阵凉风。你听见了海浪的声音。')]);
  dlgScreen('hideEn', [nar('Listen to the radio!', '听广播！', { hideEn: true })]);
  dlgScreen('speak', [mom('Can you say it to me?', '你能对我说一遍吗？', { kind: 'speak', target: 'Nice to meet you!' })]);
  dlgScreen('speak-long', [mom('Say it loudly so the monster can hear you!', '大声说，让怪兽听见！', { kind: 'speak', target: 'Speak loudly, Kai! Your monster will hear you.' })]);
  dlgScreen('answer', [mom('How are you today?', '你今天好吗？听一听，选出合适的回答，然后说出来。', { kind: 'answer', opts: [{ t: "I'm fine, thank you.", c: true }, { t: 'I am ten.' }, { t: 'It is red.' }] })]);
  dlgScreen('answer-pic', [parrot('Squawk! It is three p.m. now. Say the right greeting!', '嘎！现在是下午三点，太阳很大。选出正确的问候语，再大声说出来！', { kind: 'answer', pic: '☀️🏖️', cap: '3:00 pm', opts: GREETS.map((t, i) => ({ t, c: i === 1 })) })]);
  dlgScreen('answer-pic-long', [parrot(LONG_EN, '嘎！现在是下午三点，太阳很大。看看窗外，选出正确的问候语，再大声说出来！', { kind: 'answer', pic: '☀️🏖️', cap: '3:00 pm', opts: GREETS.map((t, i) => ({ t, c: i === 1 })) })]);
  dlgScreen('choice', [nar('The water is calm. What do you want to do?', '水面很平静。要做什么？', { kind: 'choice', opts: [{ html: '🌊 Surf', cls: 'sun' }, { html: '🎣 Fish' }, { html: 'Not now' }] })]);
  dlgScreen('choice-many', [nar('Which club do you want to see?', '你想看哪个社团？', { kind: 'choice', opts: ['🎨 Art club', '🎵 Music club', '⚽ Football club', '♟️ Chess club', '🤖 Robot club', '📚 Book club'].map(h => ({ html: h })) })]);
  dlgScreen('zh-button', [Object.assign(mom('The circus is in town today. Do you want to see the clowns?', '今天马戏团来镇上了。你想去看小丑吗？'), { zhFold: 1 })], 0, { async setup(t) { await inWorld(t, { extra: { settings: Object.assign(SV(t).settings, { storyZh: 'tap', gfx: t.look ? 'low' : '2d' }) }, world: W0.world }); await talkPages(t, [mom('The circus is in town today. Do you want to see the clowns?', '今天马戏团来镇上了。你想去看小丑吗？')]); } });
  // 名字（开场剧情的取名页）、渡轮、休息站、商店、告示牌、村民出题 / 看图说单词
  add({ id: 'dlg-intro', grp: 'dialogue', multi: true, primary: ['#w-dlg [data-act=wPick]', '#w-dlg input', '#w-dlg button.nm', '#nm-ok'], async setup(t, shot) {
    // 开场：渡轮上选照片、写名字（新存档，开场剧情还没演）
    const s = worldSave(t, { world: { map: 't0', x: 14, y: 9 } }); s.player = { gender: 'girl', name: '' }; s.world.flags = { qtip: 1 }; s.mon.box = []; s.mon.team = [];
    await t.boot(s); await t.E(() => { const b = document.querySelector('[data-act=wEnter]'); if (b) b.click(); }); await t.W(1500);
    let photo = false;
    for (let i = 0; i < 40; i++) {
      const st = await t.E(() => ({ input: !!document.querySelector('#w-dlg #nm-in'), pick: !!document.querySelector('#w-dlg [data-act=wPick]'), dlg: !!EchoWorld._debug().dlg }));
      if (st.input) { await t.typed(); await shot('name'); return; }
      if (st.pick) { if (!photo) { photo = true; await t.typed(); await shot('photo'); } await t.click('#w-dlg [data-act=wPick]'); }
      else if (st.dlg) { await t.typed(); await t.A(); }
      await t.W(300);
    }
    throw new Error('没走到取名页');
  } });
  const npcScreen = (id, map, pred, at, extra) => add(Object.assign({ id, grp: 'npc', primary: P_DLG.concat(P_SHEET), async setup(t) {
    await inWorld(t, { world: { map, x: -1, y: -1, arrive: /^i\d+[CM]$/.test(map) ? 'door:C' : null }, badges: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 }, flags: L.ALL_CH });
    const n = await t.faceNpc(pred); if (!n) throw new Error('找不到 ' + id);
    await t.A(); await t.W(400);
    for (let i = 0; i < (at || 0); i++) { await t.typed(); await t.A(); await t.W(200); }
    await t.typed();
  } }, extra || {}));
  npcScreen('npc-nurse', 'i0C', n => n.role === 'nurse');
  npcScreen('npc-shop', 'i0M', n => n.role === 'clerk');
  npcScreen('npc-quiz', 't0', n => n.role === 'quiz', 1);
  npcScreen('npc-gift', 'i1J', n => n.role === 'gift');
  npcScreen('npc-ferry', 't4', n => n.role === 'ferry', 6);
  add({ id: 'npc-sign', grp: 'npc', primary: P_DLG, async setup(t) { await inWorld(t, W0); const ok = await t.E(() => { const d = EchoWorld._debug(), M = d.M; for (let y = 1; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.grid[y - 1][x] === 'B' && EchoMaps.WALK.includes(M.grid[y][x])) { d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = 'up'; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; return true; } return false; }); if (!ok) throw new Error('没有告示牌'); await t.A(); await t.W(400); await t.typed(); } });
  add({ id: 'npc-fish', grp: 'npc', primary: P_DLG, async setup(t) {
    await inWorld(t, { world: { map: 't0', x: 14, y: 9 }, bag: { rod: 1 } });
    const ok = await t.E(() => { const d = EchoWorld._debug(), M = d.M; for (let y = 1; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.grid[y - 1][x] === '~' && EchoMaps.WALK.includes(M.grid[y][x]) && M.grid[y][x] !== '~') { d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = 'up'; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; return true; } return false; });
    if (!ok) throw new Error('没有水边');
    await t.A(); await t.W(500); await t.typed();
    for (let i = 0; i < 12; i++) { if (await t.E(() => !!document.querySelector('#w-dlg .fish .opt, #w-dlg .fish button'))) return; const pk = await t.E(() => { const b = document.querySelector('#w-dlg [data-act=wPick]'); if (b) { b.click(); return true; } return false; }); if (!pk) await t.A(); await t.W(700); }
  } });

  // ================= 对战 =================
  const battleStart = async (t, o) => {
    await t.boot(SV(t, { gfx: '2d' })); await t.home('mon');
    await t.E(o => MonsterGame.battle(o.kind || 'wild', 0, Object.assign({ onEnd() {}, hab: 'grass', foes: [MonsterGame.newMon(o.foe || 'twigling', o.lv || 3)] }, o.opts || {})), o || {});
    if (!(await t.until(() => t.E(() => !!document.querySelector('#b-panel [data-act=bMove]')), 120, 150))) throw new Error('招式菜单没出来');
    await t.W(300);
  };
  add({ id: 'battle-menu', grp: 'battle', primary: P_BATTLE, async setup(t) { await battleStart(t); } });
  for (let i = 0; i < 4; i++) add({ id: 'battle-task-' + i, grp: 'battle', primary: P_BATTLE, async setup(t) { await battleStart(t); await t.E(i => { const b = document.querySelectorAll('#b-panel [data-act=bMove]')[i]; if (b) b.click(); }, i); await t.W(900); } });
  add({ id: 'battle-task-listen', grp: 'battle', primary: P_BATTLE, async setup(t) { await battleStart(t); await t.E(() => { const B = MonsterGame._b(); B.forceListen = true; }); await t.E(() => { document.querySelector('#b-panel [data-act=bMove]').click(); }); await t.W(600);
    // 没网：点两次话筒以后改成听音选
    for (let k = 0; k < 2; k++) { if (await t.E(() => !!document.querySelector('#b-panel .b-listen'))) break; await t.click('#b-mic'); await t.until(() => t.E(() => !!document.querySelector('#b-panel .b-listen') || /./.test((document.querySelector('#b-hint') || {}).textContent || '')), 30, 150); await t.W(300); }
  } });
  add({ id: 'battle-defend', grp: 'battle', primary: P_BATTLE, async setup(t) { await battleStart(t, { foe: 'twigling', lv: 30 }); await t.E(() => { const B = MonsterGame._b(); B.fast = 1; }); await t.E(() => document.querySelector('#b-panel [data-act=bMove]').click()); await t.W(500);
    for (let k = 0; k < 40; k++) { const st = await t.E(() => ({ def: !!document.querySelector('#b-panel [data-act=bDef]'), rate: !!document.querySelector('#b-panel [data-act=bRate]'), mic: !!document.querySelector('#b-mic'), lopt: !!document.querySelector('#b-panel .b-listen .opt') })); if (st.def) return; if (st.lopt) await t.E(() => { const B = MonsterGame._b(), i = B.task.lopts.findIndex(o => o.c); document.querySelectorAll('#b-panel .b-listen .opt')[i].click(); }); else if (st.mic) await t.click('#b-mic'); await t.W(400); }
    throw new Error('没轮到防守');
  } });
  add({ id: 'battle-bag', grp: 'battle', primary: P_SHEET.concat(['#sheet [data-act=bUse]']), async setup(t) { await battleStart(t); await t.act('bBag'); await t.W(400); } });
  add({ id: 'battle-switch', grp: 'battle', primary: P_SHEET.concat(['#sheet [data-act=bSwitchTo]']), async setup(t) { await battleStart(t); await t.act('bSwitch'); await t.W(400); } });
  add({ id: 'battle-catch', grp: 'battle', primary: ['#sheet [data-act=bCatch]', '#sheet [data-act=close]'], async setup(t) { await battleStart(t); await t.E(() => { EchoGame.S.mon.bag.superball = 2; }); await t.act('bCatch'); await t.W(500); } });
  add({ id: 'battle-catch-spell', grp: 'battle', primary: P_BATTLE, async setup(t) { await battleStart(t); await t.act('bCatch'); await t.W(400); await t.E(() => { const b = document.querySelector('#sheet [data-act=bCatch][data-ball=ball]'); if (b) b.click(); }); await t.W(800); } });
  add({ id: 'battle-flee', grp: 'battle', primary: ['#sheet button'], async setup(t) { await battleStart(t); await t.act('bFlee'); await t.W(400); } });
  add({ id: 'battle-trainer', grp: 'battle', primary: P_BATTLE, async setup(t) { await t.boot(SV(t, { gfx: '2d' })); await t.home('mon'); await t.E(() => MonsterGame.battle('leader', 0, { onEnd() {} })); if (!(await t.until(() => t.E(() => !!document.querySelector('#b-panel [data-act=bMove]')), 120, 150))) throw new Error('岛主对战没出来'); await t.W(300); } });
  add({ id: 'battle-result', grp: 'battle', primary: P_BATTLE.concat(['#sheet [data-act=bEnd]']), async setup(t) { await battleStart(t, { foe: 'twigling', lv: 2 }); await t.E(() => { const B = MonsterGame._b(); B.foeHp = 1; }); await t.E(() => document.querySelector('#b-panel [data-act=bMove]').click()); await t.W(500);
    for (let k = 0; k < 40; k++) { if (await t.E(() => !!document.querySelector('#b-panel [data-act=bEnd], #sheet [data-act=bEnd]'))) { await t.W(600); return; } const st = await t.E(() => ({ lopt: !!document.querySelector('#b-panel .b-listen .opt'), mic: !!document.querySelector('#b-mic'), def: !!document.querySelector('#b-panel [data-act=bDef]'), mv: !!document.querySelector('#b-panel [data-act=bMove]') })); if (st.lopt) await t.E(() => { const B = MonsterGame._b(), i = B.task.lopts.findIndex(o => o.c); document.querySelectorAll('#b-panel .b-listen .opt')[i].click(); }); else if (st.mic) await t.click('#b-mic'); else if (st.def) await t.click('#b-panel [data-act=bDef]'); else if (st.mv) await t.E(() => { MonsterGame._b().foeHp = 1; document.querySelector('#b-panel [data-act=bMove]').click(); }); await t.W(500); }
    throw new Error('没打完');
  } });
  add({ id: 'battle-learn', grp: 'battle', primary: ['#sheet [data-act=mForget]', '#sheet [data-act=mLearnGo]', '#sheet [data-act=mLearnMic]'], async setup(t) { await t.boot(SV(t)); await t.E(() => { const m = EchoGame.S.mon, mon = m.box[0], ls = MonsterGame.learnset(MonsterGame.species(mon.sp)).map(x => x[1]).filter(id => !mon.moves.includes(id)); m.pendingLearn = [{ u: mon.uid, id: ls[0] || 'normal1' }]; MonsterGame.afterHome(); }); await t.W(900); } });
  add({ id: 'battle-learn-say', grp: 'battle', primary: ['#sheet [data-act=mLearnMic]', '#sheet [data-act=mLearnGo]', '#sheet button'], async setup(t) { await t.boot(SV(t)); await t.E(() => { const m = EchoGame.S.mon, mon = m.box[0], ls = MonsterGame.learnset(MonsterGame.species(mon.sp)).map(x => x[1]).filter(id => !mon.moves.includes(id)); m.pendingLearn = [{ u: mon.uid, id: ls[0] || 'normal1' }]; MonsterGame.afterHome(); }); await t.W(900); await t.E(() => { const b = document.querySelector('#sheet [data-act=mForget][data-k="0"]'); if (b) b.click(); }); await t.W(600); } });
  add({ id: 'battle-evolve', grp: 'battle', primary: ['#evo-ok:not([hidden])', '#sheet button'], async setup(t) { await t.boot(SV(t)); await t.E(() => { const m = EchoGame.S.mon; m.box[0].lv = 60; m.pendingEvo = ['m1']; MonsterGame.afterHome(); }); await t.W(5500); } });

  // ================= 和岛民聊天（假的阿里云）、委托 =================
  const TALK = { bridge: false, init: [TALK_FAKE], ios: true };
  const chatOpen = async t => { await t.boot(SV(t, { tab: 'talk' })); await t.home('talk'); await t.W(200); await t.E(() => { const c = document.querySelector('#talk-home .tk-card.now') || document.querySelector('#talk-home .tk-card'); if (c) c.click(); }); if (!(await t.until(() => t.E(() => !!document.querySelector('#tk-mic:not([disabled])')), 60, 150))) throw new Error('聊天没打开'); await t.W(500); };
  const say = async (t, line) => { await t.E(l => window.__fk.said.push(l), line); const n0 = await t.E(() => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length); await t.p.locator('#tk-mic').dispatchEvent('pointerdown'); await t.W(650); await t.p.locator('#tk-mic').dispatchEvent('pointerup'); await t.p.waitForFunction(n => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length > n, n0, { timeout: 4000 }).catch(() => {}); await t.W(200); };
  add({ id: 'chat', grp: 'chat', cfg: TALK, primary: P_TALK, async setup(t) { await chatOpen(t); } });
  add({ id: 'chat-talked', grp: 'chat', cfg: TALK, primary: P_TALK, async setup(t) { await chatOpen(t); for (const l of ['I like the park because it is quiet.', 'We can fly kites there on Sunday.']) await say(t, l); } });
  add({ id: 'chat-help', grp: 'chat', cfg: TALK, primary: P_TALK, async setup(t) { await chatOpen(t); await t.click('#tk-ov [data-act=talk_help]'); await t.W(800); } });
  add({ id: 'chat-step', grp: 'chat', cfg: TALK, primary: P_TALK, async setup(t) { await chatOpen(t); await t.click('#tk-ov [data-act=talk_step]'); await t.W(500); } });
  add({ id: 'chat-eval', grp: 'chat', cfg: TALK, primary: P_TALK, async setup(t) { await chatOpen(t); for (const l of ['I like the park because it is quiet.', 'We can fly kites there on Sunday.', 'It is sunny and warm today.']) await say(t, l); await t.click('#tk-ov [data-act=talk_end]'); if (!(await t.until(() => t.E(() => !!document.querySelector('.tk-eval')), 60, 150))) throw new Error('评语页没出来'); await t.W(600); } });
  add({ id: 'chat-privacy', grp: 'chat', primary: P_SHEET, async setup(t) { await t.boot(SV(t)); await t.home('talk'); await t.W(200); await t.act('talk_privacy'); await t.W(400); } });
  add({ id: 'quest-ask', grp: 'chat', primary: P_DLG, async setup(t) { await inWorld(t, { world: { map: 't0', x: 14, y: 9 } }); const n = await t.faceNpc(n => /Rosa/.test(n.name || '')); if (!n) throw new Error('找不到 Ms Rosa'); await t.A(); await t.W(300); for (let i = 0; i < 8 && !(await t.E(() => !!document.querySelector('#w-dlg [data-act=wPick]'))); i++) { await t.typed(); await t.A(); await t.W(200); } } });

  // ================= 云端模式：登录、会员、额度、家长同意、举报、删号 =================
  const CLOUD = { bridge: { platform: 'ios', key: '' }, query: 'cloud=http%3A%2F%2F127.0.0.1%3A9' };
  const ME = (o) => Object.assign({ id: 'u_test', email: 'kid@example.com', apple: false, ageGroup: 'teen', ui: 'zh', level: 2, tzOffsetMin: 600, iapToken: '3f1d2c4e-0000-0000-0000-000000000000', createdAt: '2026-11-19T13:00:00.000Z',
    consent: { required: false, state: 'none', parentEmail: null, requestedAt: null, grantedAt: null }, features: { talk: true, place: true, steps: true }, plan: 'free',
    subscription: { state: 'none', plan: null, productId: null, expiresAt: null, graceUntil: null, environment: null },
    quota: { day: L.TODAY, tzOffsetMin: 600, resetsAt: new Date(Date.now() + 864e5).toISOString(), talk: { limitSec: 300, usedSec: 300, leftSec: 0 }, asr: { limit: 400, used: 0, left: 400 }, other: { limit: 300, used: 0, left: 300 } } }, o || {});
  const signedLS = me => ({ 'echo-cloud-token': 'tok_test', 'echo-cloud-me': JSON.stringify(me) });
  const cloudScreen = (id, fn, ls, prim) => add({ id: 'acct-' + id, grp: 'account', cfg: CLOUD, primary: (prim || []).concat(P_SHEET, ['#sheet .btn', '#sheet [data-act^=ac_]']), async setup(t) { await t.boot(SV(t), CLOUD.query, ls || null); await t.W(300); await t.E(fn); await t.W(500); } });
  cloudScreen('signin', () => EchoAccount.signInSheet());
  cloudScreen('age', () => { const b = document.createElement('button'); b.dataset.act = 'ac_agepick'; document.body.appendChild(b); b.click(); b.remove(); }, signedLS(ME({ ageGroup: null })));
  cloudScreen('consent', () => { const b = document.createElement('button'); b.dataset.act = 'ac_consent_again'; document.body.appendChild(b); b.click(); b.remove(); }, signedLS(ME({ ageGroup: 'child', consent: { required: true, state: 'pending', parentEmail: 'p***@example.com', requestedAt: '2026-11-19T13:05:00.000Z', grantedAt: null } })));
  cloudScreen('member', () => EchoAccount.memberSheet(), signedLS(ME()));
  cloudScreen('account', () => EchoAccount.accountSheet(true), signedLS(ME()));
  cloudScreen('quota', () => { try { EchoAccount.noteQuota && EchoAccount.noteQuota({ talk: 0 }); } catch (e) {} const b = document.createElement('button'); b.dataset.act = 'ac_member'; document.body.appendChild(b); b.click(); b.remove(); }, signedLS(ME()));
  cloudScreen('report', () => EchoAccount.reportSheet({ what: 'chat', text: 'Hello! I am Captain Polly. What is your favourite colour?', npc: 'captain' }), signedLS(ME()));
  cloudScreen('delete', () => { const b = document.createElement('button'); b.dataset.act = 'ac_delete_next'; document.body.appendChild(b); b.click(); b.remove(); }, signedLS(ME()));

  // ================= 转屏（2026-11-20：老板的竖屏截图里画面只剩左半边——iPhone 上 resize 事件比排版早）：横 → 竖 → 横，每次转完都查 =================
  // 只在 ip17-l 上走（从横屏开始）；画布大小跟不上记成 stale-size
  const ROT = [['world', t => inWorld(t, W0)], ['world-dlg', async t => { await inWorld(t, W0); await talkPages(t, [parrot('Squawk! It is three p.m. now. Say the right greeting!', '嘎！现在是下午三点。', { kind: 'answer', pic: '☀️🏖️', cap: '3:00 pm', opts: GREETS.map((x, i) => ({ t: x, c: i === 1 })) })]); }],
    ['world-gym', t => inWorld(t, { world: { map: 'i0G', x: 6, y: 15, dir: 'up' } })], ['battle', t => battleStart(t)], ['place', t => placeTo(t, 'vocab')], ['wizard', t => suTo(t, 'device')],
    ['settings', async t => { await t.boot(SV(t)); await t.home('quiz'); await t.act('settings'); await t.W(400); }], ['chat', t => chatOpen(t)], ['menu', async t => { await inWorld(t, W0); await t.act('wMenu'); await t.W(400); }]];
  const ROT_CFG = { wizard: SALES, chat: TALK };
  const ROT_P = { world: P_WORLD, 'world-dlg': P_DLG, 'world-gym': P_WORLD, battle: P_BATTLE, place: P_PLACE, wizard: P_SU, settings: P_SHEET, chat: P_TALK, menu: P_SHEET };
  for (const [id, go] of ROT) add({ id: 'rot-' + id, grp: 'rotate', views: ['ip17-l'], outdoor: id === 'world' || id === 'world-dlg' ? true : undefined, multi: true, cfg: ROT_CFG[id], primary: ROT_P[id],
    // t.fresh：重新打开，别带着前面画面留下的弹窗（学新招）
    async setup(t, shot) { t.fresh = true; await go(t); await shot('land'); await t.rotate('ip17-p'); await shot('to-port'); await t.rotate('ip17-l'); await shot('back-land'); } });

  // ================= 挑战馆：每个馆的雕像 / 机关门 / 剧情人物按 A 出来的第一页任务（慢：默认只在两种横屏 + iPhone 竖屏查） =================
  for (const [map, z] of GYMS) add({ id: 'gym-' + map, grp: 'gym', deep: true, multi: true, primary: P_DLG, async setup(t, shot) {
    await t.boot(gymSave(t, z)); await t.enterWorld();
    await t.E(() => EchoWorld._debug().M.npcs.forEach(n => { n.sight = 0; }));   // 训练师别把人拉去对战
    await shot('hud');
    const spots = await spotsOf(t);
    let n = 0;
    for (const s of spots) {
      if (n >= 6) break;
      await t.closeDlg(); await t.E(() => { const d = EchoWorld._debug(); d.busy = false; });
      await t.tp(s.x, s.y, s.dir); await t.W(120); await t.A(); await t.W(350);
      if (!(await t.E(() => !!EchoWorld._debug().dlg))) continue;
      const k = await t.toTask(12);
      if (k === 'none' || k === '?') continue;
      n++; await t.typed(); await shot(s.k.replace(/[^a-z0-9]+/gi, '-') + '-' + s.x + '-' + s.y + (k ? '-' + k : ''));
    }
    await t.closeDlg();
  } });
  // ================= 各岛的剧情（小镇：本岛主线还没做，进镇子会演的剧情、剧情人物、地标按 A 出来的任务页；慢：和挑战馆一样只在三种屏幕上查） =================
  for (let z = 0; z < 13; z++) add({ id: 'isle-t' + z, grp: 'isle', deep: true, multi: true, primary: P_DLG, async setup(t, shot) {
    const flags = Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, Object.fromEntries([...Array(z).keys()].map(i => ['s:ch' + i, 1])));
    const s = worldSave(t, { gfx: '2d', badges: Object.fromEntries([...Array(z).keys()].map(i => [i, 1])), world: { map: 't' + z, x: -1, y: -1, arrive: null, visited: Object.fromEntries([...Array(z + 1).keys()].map(i => [i, 1])), flags } });
    s.world.flags = flags;
    await t.boot(s); await t.E(() => { const b = document.querySelector('[data-act=wEnter]'); if (b) b.click(); });
    await t.until(() => t.E(() => { try { return !document.querySelector('#world').hidden && !!EchoWorld._debug().M; } catch (e) { return false; } }), 80, 150);
    await t.W(1200);
    let n = 0;
    const grab = async tag => { for (let k = 0; k < 6 && n < 6; k++) { const kind = await t.toTask(14); if (kind === 'none' || kind === '?') return; if (await t.E(() => !document.querySelector('#battle').hidden)) return; n++; await t.typed(); await shot(tag + '-' + kind + '-' + k); await t.E(() => { const d = EchoWorld._debug(), pg = d.dlg && d.dlg.pages[d.dlg.i]; if (pg && pg.kind) { pg.kind = null; d.dlg.pages.length = d.dlg.i + 1; } }); await t.A(); await t.W(200); } };
    await grab('enter');
    await t.closeDlg();
    for (const sp of await spotsOf(t)) {
      if (n >= 6 || !/^npc:story/.test(sp.k)) continue;
      await t.E(() => { const d = EchoWorld._debug(); d.busy = false; d.M.npcs.forEach(q => { q.sight = 0; }); });
      if (await t.E(() => !document.querySelector('#battle').hidden)) await t.E(() => MonsterGame.stop());
      await t.tp(sp.x, sp.y, sp.dir); await t.A(); await t.W(350);
      await grab(sp.k.replace(/[^a-z0-9]+/gi, '-').slice(0, 24));
      await t.closeDlg();
    }
  } });
  return S;
}

module.exports = { screens, OK_ELL, TALK_FAKE, IOS_MARK, P_DLG, P_WORLD, P_SHEET };
