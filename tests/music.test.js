// 配乐测试：每个画面 / 地图 / 战斗放对的曲子，朗读时压低、麦克风在听时静音，胜利号角之后接结算音乐，设置里能关
// 运行：node tests/music.test.js（网址带 ?music：自动化测试里引擎默认不出声，要这个参数才打开）
const path = require('path');
const { chromium } = require('playwright');
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html') + '?music';
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(8000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // 假的语音识别：说的话在 window.__heard，听 800 毫秒
  await p.addInitScript(() => {
    const F = class { start() { setTimeout(() => { const t = window.__heard || ''; if (t && this.onresult) this.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }); if (this.onend) this.onend(); }, 800); } stop() {} };
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: F, configurable: true, writable: true });
    Object.defineProperty(window, 'SpeechRecognition', { value: F, configurable: true, writable: true });
  });
  await p.goto(PAGE);
  const save = extra => p.evaluate(x => localStorage.setItem('echo-island-v1', JSON.stringify(Object.assign({
    seenIntro: true, homeTab: 'mon', settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'mid' }, player: { gender: 'boy', name: 'Tom' },
    mon: { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 50, xp: 0 }], team: ['a'], dex: {}, balls: 5, potions: 3, bag: {}, badges: { 0: 1, 1: 1, 2: 1 } },   // 3 枚徽章：50 级也听话（不然 30% 会发呆）
    world: { v: 2, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 } },
  }, x))), extra || {});
  const W = ms => p.waitForTimeout(ms);
  const st = () => p.evaluate(() => window.EchoMusic.state());
  const until = async (fn, max = 60) => { for (let i = 0; i < max; i++) { if (await fn()) return true; await W(150); } return false; };
  const cur = async id => until(async () => (await st()).current === id);

  await save(); await p.reload(); await W(500);
  await p.mouse.click(5, 300);   // 第一次点屏幕：打开声音
  check(await p.evaluate(() => !!(window.EchoMusic && window.MusicCore && window.MUSIC && Object.keys(window.MUSIC.songs).length >= 20)), '引擎和曲库加载了（' + await p.evaluate(() => window.MUSIC ? Object.keys(window.MUSIC.songs).length : 0) + ' 首）');
  check(await cur('title'), '首页：主题曲 title');
  // 能力检测开着的时候不放背景音乐（听力题要听清，这个画面也进不了设置去关），关了接着放首页的
  await p.evaluate(() => window.EchoPlace.open('who'));
  check(await p.evaluate(() => window.EchoPlace.isOpen()) && await cur(null), '能力检测开着：背景音乐停了');
  for (let i = 0; i < 4 && await p.evaluate(() => window.EchoPlace.isOpen()); i++) { await p.evaluate(() => window.EchoPlace.back()); await W(200); }
  check(!(await p.evaluate(() => window.EchoPlace.isOpen())) && await cur('title'), '能力检测关了：首页的主题曲回来了');
  check((await st()).enabled, '带 ?music 时引擎是开着的');
  // 朗读时压低（首页没有自动朗读，不会互相干扰）
  const ducked = await p.evaluate(async () => { const pr = window.EchoGame.say('Hello! How are you today?'); await new Promise(r => setTimeout(r, 30)); const d = window.EchoMusic.state().duck; await pr; return [d, window.EchoMusic.state().duck]; });
  check(ducked[0] > 0 && ducked[1] === 0, '朗读的时候音乐压低，读完恢复 ' + JSON.stringify(ducked));

  // ---------- 闯关练习：学习音乐 ----------
  await p.click('[data-act=tab][data-t=quiz]'); await p.click('.node.cur'); await p.click('#sheet [data-act=start]');
  check(await cur('study'), '闯关练习：学习音乐 study');

  // ---------- 大地图：每类地图放对的曲子 ----------
  await save(); await p.reload(); await W(500); await p.mouse.click(5, 300);
  await p.click('.world-go'); await W(1200);
  check(await cur('town_a'), '第 0 岛小镇：town_a');
  const go = async (id, how, want, what) => { await p.evaluate(([i, h]) => window.EchoWorld._debug().goMap(i, h), [id, how]); await W(700); check(await cur(want), what + '：' + want + '（' + (await st()).current + '）'); };
  await go('r0', 'south', 'route', '1 号路');
  await go('i0C', 'door:C', 'center', '休息站');
  await go('i0G', null, 'gym', '挑战馆');
  await go('h8a', null, 'hush', '嘘声团基地');
  await go('s7', null, 'sea', '海路');
  await go('t11', 'door:C', 'town_d', '雪岛小镇');
  await go('v2', null, 'league', '勇气之路');
  await go('t0', 'door:C', 'town_a', '回到你好岛');

  // ---------- 战斗 ----------
  await p.evaluate(() => window.EchoWorld._debug().battle('wild', { foes: [MonsterGame.newMon('twigling', 2)] }));   // 走大地图的遇怪流程，打完回到地图
  check(await cur('battle_wild'), '野生战：battle_wild');
  // 麦克风在听：完全静音
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('echo-island-v1')); window.EchoGame.S.settings.mode = 'sr'; });
  // 挑一个攻击招式（辅助招式打不死对手）
  for (let i = 0; i < 4; i++) {
    await until(() => p.$('#b-panel [data-act=bMove][data-i="' + i + '"]:not([disabled])'), 20);
    if (!(await p.$('#b-panel [data-act=bMove][data-i="' + i + '"]:not([disabled])'))) continue;
    await p.click('[data-act=bMove][data-i="' + i + '"]');
    await until(() => p.$('#b-mic'));
    if (await p.evaluate(() => { const b = MonsterGame._b(); return !b.mv.sup && b.task.kind !== 'ult'; })) break;
    await p.click('#b-panel [data-act=bBack]');
  }
  const tgt = await p.evaluate(() => MonsterGame._b().task.target);
  await p.evaluate(t => { window.__heard = t; }, tgt);
  await p.click('#b-mic');
  await W(300);
  const held = (await st()).hold;
  await until(async () => (await st()).hold === 0, 40);
  check(held > 0 && (await st()).hold === 0, '麦克风在听的时候音乐静音（hold ' + held + '），听完恢复');
  // 打赢：号角 → 结算音乐
  await until(async () => (await p.$('#b-panel .b-result')) != null, 80);
  const okV = await cur('victory');
  if (!okV) console.log('  战斗状态', JSON.stringify(await p.evaluate(() => { const b = MonsterGame._b(); return { turn: b && b.turn, foeHp: b && b.foeHp, kind: b && b.task && b.task.kind, mv: b && b.mv && b.mv.id, tries: b && b.tries, msg: document.getElementById('b-msg').textContent, panel: document.getElementById('b-panel').innerText.slice(0, 160), heard: window.__heard }; })));
  check(okV, '打赢了：号角之后放结算音乐 victory（' + (await st()).current + '）');
  await p.evaluate(() => window.EchoGame.S.settings.mode = 'self');
  await p.click('#b-panel [data-act=bEnd]');
  check(await cur('town_a'), '回到大地图：接着放小镇音乐（' + (await st()).current + '）');
  await until(async () => !(await p.evaluate(() => window.EchoWorld._debug().busy)));

  await p.evaluate(() => MonsterGame.battle('trainer', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 2)], trainer: { name: 'Leo', img: '' } }));
  check(await cur('battle_trainer'), '训练师战：battle_trainer');
  await p.evaluate(() => { document.querySelector('[data-act=bFlee]') && document.querySelector('[data-act=bFlee]').click(); });
  await p.evaluate(() => MonsterGame.stop());
  await p.evaluate(() => MonsterGame.battle('leader', 0, { onEnd() {} }));
  check(await cur('battle_boss'), '岛主战：battle_boss');
  await p.evaluate(() => { MonsterGame.stop(); window.EchoGame.goHome('mon'); });
  check(await cur('title'), '回首页：主题曲');

  // ---------- 一次性的小音乐和离线渲染 ----------
  const jg = await p.evaluate(async () => { const t0 = performance.now(); await window.EchoMusic.jingle('item'); return performance.now() - t0; });
  check(jg > 500 && jg < 6000, '道具小音乐放完了才返回（' + Math.round(jg) + ' 毫秒）');
  const rnd = await p.evaluate(async () => { const buf = await window.EchoMusic.render('title', { seconds: 3, sampleRate: 22050 }); let pk = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); } return pk; });
  check(rnd > 0.02 && rnd < 1, '离线渲染主题曲：有声音、不爆音（峰值 ' + rnd.toFixed(3) + '）');

  // ---------- 引擎的竞态：小段音乐打断小段音乐、放到一半切到后台（完整的压力测试见引擎加固记录，这里只留最容易回归的） ----------
  const race = await p.evaluate(async () => {
    const E = window.EchoMusic, W = ms => new Promise(r => setTimeout(r, ms)), o = {};
    const s0 = E.state();
    o.playing = s0.playing;
    o.level = s0.level === ((window.MUSIC.songs[s0.playing] || {}).gain || 0);
    // 新的小段音乐打断还没放完的：旧的 Promise 马上完成，两个中间不把背景音乐拉起来，都放完接着放原来那首
    const t0 = performance.now();
    const a = E.jingle('badge').then(() => { o.a = performance.now() - t0; });
    await W(300);
    const b = E.jingle('item');
    o.mid = E.state();
    await a; await b;
    await W(500);
    o.after = E.state();
    // 小段音乐放到一半页面切到后台：Promise 马上完成、AudioContext 挂起；回来接着放背景音乐
    let hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
    const vis = h => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
    const t1 = performance.now();
    const c = E.jingle('badge');
    await W(200);
    vis(true);
    await c;
    o.hid = performance.now() - t1;
    await W(400);
    o.hidCtx = E.state().ctx;
    vis(false);
    await W(700);
    o.back = E.state();
    delete document.hidden;
    return o;
  });
  check(race.level, '背景音乐用上了这首的音量校正（levels.json → song.gain）');
  check(race.a < 600 && race.mid.jingle === 'item' && !race.mid.playing, '小段音乐打断小段音乐：旧的马上完成（' + Math.round(race.a) + ' 毫秒），中间没有背景音乐');
  check(race.after.playing === race.playing && !race.after.jingle, '都放完接着放原来的背景音乐（' + race.after.playing + '）');
  check(race.hid < 600 && race.hidCtx === 'suspended', '小段音乐放到一半切到后台：Promise 马上完成（' + Math.round(race.hid) + ' 毫秒），声音挂起（' + race.hidCtx + '）');
  check(race.back.ctx === 'running' && race.back.playing === race.playing, '回到前台：接着放背景音乐（' + race.back.ctx + '，' + race.back.playing + '）');

  // ---------- 设置：音乐关掉 ----------
  await p.evaluate(() => window.EchoGame.closeModal());   // 打完仗可能弹出「学新招」
  await p.click('[data-act=tab][data-t=quiz]');   // 设置在「闯关练习」页的工具栏里
  await p.click('[data-act=settings]');
  await p.click('#sheet [data-act=setMusic][data-v=off]');
  await W(300);
  check((await st()).volume === 0, '设置里把音乐关了：音量 0');
  check(JSON.parse(await p.evaluate(() => localStorage.getItem('echo-island-v1'))).settings.music === 'off', '存档记住了「音乐：关」');

  check(!errs.length, '没有报错 ' + errs.join(' | '));
  await b.close();
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
