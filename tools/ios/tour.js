// 回声岛 · iPhone 检查用的「固定路线」：把各个画面按同一个顺序走一遍。audit.js（WebKit 对 Chromium）和 safearea.js（刘海 / 底部横条）共用。
// tour(t, mode, step)：t 是 lib.open() 开的那一页；mode = 'web'（网页版，没有原生桥）或 'app'（装了假原生桥 + window.ECHO_IOS = 1）；
// step(名字, 备注) 由调用的脚本给：等画面停下来、截图、收集问题。每一步自己接住错误（记成 step-failed），后面的照样走。
// salesTour(t, step)：销售版的家长首次设置向导，走到第 ② 步设备检查（下一步能点就再看第 ③ 步）。
'use strict';
const L = require('./lib');

async function tour(t, mode, step) {
  const { p, E, W } = t, app = mode === 'app';
  const notes = t.notes = {};
  // App 里口语一律 AI 打分（存档里写 mode: 'auto'，和 tests/apk.test.js 一样）；网页版用录音自评
  const SV = o => L.SAVE(Object.assign({ mode: app ? 'auto' : 'self' }, o));
  const run = async (name, fn) => {
    t.ev.step = mode + '-' + name;
    try { await fn(); } catch (e) { notes[name + ':failed'] = String(e.message).split('\n')[0].slice(0, 200); await step(mode + '-' + name, { failed: notes[name + ':failed'] }).catch(() => {}); }
  };
  const S = name => step(mode + '-' + name);
  const visible = sel => E(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);

  // ---------- 1. 第一次打开（没有存档） ----------
  await run('boot-fresh', async () => {
    await E(() => localStorage.removeItem('echo-island-v1'));
    await t.load(); await W(900);
    notes.fresh = await E(() => ({ modal: !document.querySelector('#modal').hidden, sheet: (document.querySelector('#sheet').innerText || '').slice(0, 60), place: !!document.querySelector('#place, .pl-ov, [id^=pl-]') }));
    await S('boot-fresh');
  });

  // ---------- 2. 首页三个标签 ----------
  await run('home-mon', async () => { await t.reload(SV({ gfx: '2d' })); await t.home('mon'); await S('home-mon'); });
  await run('home-quiz', async () => { await t.tap('[data-act=tab][data-t=quiz]'); await S('home-quiz'); });
  await run('home-talk', async () => {
    notes.talkTab = await visible('[data-act=tab][data-t=talk]');
    if (notes.talkTab) await t.tap('[data-act=tab][data-t=talk]');
    await S('home-talk');
  });
  await run('talk-privacy', async () => { await t.tap('[data-act=talk_privacy]'); await p.waitForSelector('#sheet .tk-notice'); await S('talk-privacy'); await E(() => EchoGame.closeModal()); });
  await run('talk-chat', async () => {
    // 点开第一个岛民：连不上（网页版指到没人听的端口；假原生桥是没网），只看聊天界面的排版，不会真的去连 AI
    // App 模式：假原生桥临时改成「连得上但对面不说话」（只回一个 open），这样看得到带话筒的聊天界面，而不是「没连上」那一页
    if (app) await E(() => { const F = window.__fakeNative; if (F) { F.__net = F.net; F.net = 'ok'; F.onWsOpen = (id, url, cb) => cb(id, 'open', ''); } });
    await t.tap('[data-act=talk_open]'); await p.waitForSelector('#tk-ov', { timeout: 6000 }); await W(1500);
    notes.chat = await E(() => { const o = document.querySelector('#tk-ov'); return { mic: !!o.querySelector('.tk-mic'), text: (o.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }; });
    await S('talk-chat');
    await E(() => EchoTalk.endIfOpen()); await W(600);
    await E(() => { const o = document.querySelector('#tk-ov'); if (o) o.remove(); EchoGame.closeModal(); const F = window.__fakeNative; if (F && F.__net) { F.net = F.__net; F.onWsOpen = null; } });
  });

  // ---------- 3. 闯关练习 ----------
  await run('practice-level', async () => {
    await t.home('quiz'); await t.settle(200);
    await t.tap('.node.cur'); await p.waitForSelector('#sheet [data-act=start]'); await S('practice-level');
    await t.tap('#sheet [data-act=start]'); await p.waitForFunction(() => !document.querySelector('#play').hidden && window.EchoGame.P() && window.EchoGame.P().q); await W(700);
    notes.firstQ = await E(() => EchoGame.P().q.type);
    await S('practice-first');
  });
  const oneQ = async (name, q, answer) => {
    await run(name, async () => {
      await E(q => { EchoGame.closeModal(); EchoGame.playQs([q]); }, q); await W(900);
      await S(name);
      await answer();
      await W(500);
      notes[name] = await E(() => ({ fb: (document.querySelector('#fb-t') || {}).textContent || '', shown: !!document.querySelector('#fb.show'), hint: (document.querySelector('#mic-hint') || {}).textContent || '' }));
      await S(name + '-fb');
    });
  };
  const pickRight = () => E(() => { const P = EchoGame.P(), k = P.q.opts.findIndex(o => o.c); const b = document.querySelectorAll('#p-body .opt')[k]; b.scrollIntoView({ block: 'nearest' }); return k; }).then(k => t.tap('#p-body .opt >> nth=' + k));
  // 开口题：网页版 = 录音自评（点话筒录不了音就直接出打分按钮）；App = AI 打分（假原生桥没网 → 提示没网，连着 2 次以后出现「先跳过」）
  const speak = async () => {
    for (let i = 0; i < 3; i++) {
      if (await visible('#self [data-act=rate]')) break;
      if (await visible('#p-skip')) break;
      if (await visible('#self [data-act=selfReveal]')) { await t.tap('#self [data-act=selfReveal]'); await W(300); continue; }
      if (await visible('#sheet [data-act=micFix]')) { notes.micBlocked = (await E(() => document.querySelector('#sheet').innerText)).slice(0, 80); await E(() => EchoGame.closeModal()); break; }
      if (await visible('#mic')) { await t.tap('#mic'); await t.until(async () => (await visible('#self [data-act=rate]')) || (await visible('#p-skip')) || (await visible('#sheet [data-act=micFix]')) || /没网|额度|密钥|没听清|录好了|正在录音/.test(await E(() => (document.querySelector('#mic-hint') || {}).textContent || '')), 40, 200);
        if (/正在录音/.test(await E(() => (document.querySelector('#mic-hint') || {}).textContent || ''))) { await W(600); await t.tap('#mic'); await W(700); } }
      await W(400);
    }
    notes.speakUi = await E(() => ({ rate: !!document.querySelector('#self [data-act=rate]'), skip: !!(document.querySelector('#p-skip') && !document.querySelector('#p-skip').hidden), hint: (document.querySelector('#mic-hint') || {}).textContent || '', mode: (EchoGame.P() || {}).q ? 'q' : '' }));
    if (await visible('#self [data-act=rate]')) await t.tap('#self [data-act=rate][data-v="2"]');
    else if (await visible('#p-skip')) await t.tap('#p-skip');
  };
  await oneQ('q-listen-word', ['lw', 0, 0], pickRight);
  await oneQ('q-listen-sent', ['lm', 0, 0], pickRight);
  await oneQ('q-speak-word', ['sr_w', 0, 1], speak);
  await oneQ('q-speak-sent', ['sr_s', 0, 1], speak);
  await oneQ('q-order', ['lo', 0, 0], async () => { // 排词题：按正确顺序点词块，再点「检查」
    const n = await E(() => EchoGame.P().q.tokens.length);
    for (let i = 0; i < n; i++) { await t.tap('#lo-bank .tile[data-i="' + i + '"]'); await W(90); }
    await S('q-order-filled');
    await t.tap('#lo-check');
  });
  await oneQ('q-dialog', ['lr', 0, 0], pickRight);
  await run('result', async () => {
    await E(() => { EchoGame.closeModal(); EchoGame.playQs([['lw', 0, 2]]); }); await W(700);
    await pickRight(); await W(400); await t.tap('#fb-btn');
    await p.waitForFunction(() => !document.querySelector('#result').hidden, null, { timeout: 6000 }); await W(1900);
    notes.resultModal = await E(() => !document.querySelector('#modal').hidden);
    await S('result');
    await E(() => EchoGame.closeModal());
  });

  // ---------- 4. 首页的几个弹窗：设置、家长设置、密码键盘、从备份恢复、周报、怪兽手册 ----------
  await run('settings', async () => { await t.home('quiz'); await t.settle(200); await t.tap('.tools [data-act=settings]'); await p.waitForSelector('#sheet #set-parent'); await S('settings'); });
  await run('settings-parent', async () => {
    await t.tap('#set-parent > summary'); await W(300);
    notes.parentOpen = await E(() => document.querySelector('#set-parent').open);
    await E(() => document.querySelector('#set-parent').scrollIntoView({ block: 'start' })); await S('settings-parent');
    await E(() => { const b = document.querySelector('#sheet [data-act=bakRestore]'); b.scrollIntoView({ block: 'center' }); }); await S('settings-parent-end');
  });
  await run('pin-pad', async () => {
    await t.tap('#sheet [data-act=bakRestore]'); await p.waitForSelector('#sheet #pin-pad'); await S('pin-pad');
    for (const d of '1234') { await t.tap('#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(60); }
    await W(600);
    notes.afterPin = await E(() => ({ pad: !!document.querySelector('#pin-pad'), text: (document.querySelector('#sheet').innerText || '').replace(/\s+/g, ' ').slice(0, 80) }));
    await S('restore');
    await E(() => EchoGame.closeModal());
  });
  await run('report', async () => { await t.home('quiz'); await t.settle(200); await t.tap('.tools [data-act=report]'); await p.waitForSelector('#sheet .report'); await S('report'); await E(() => EchoGame.closeModal()); });
  await run('dex', async () => {
    await t.home('mon'); await t.settle(200); await t.tap('[data-act=mDex]'); await p.waitForSelector('#sheet [data-act=mDexOne]'); await W(500); await S('dex');
    const one = await E(() => { const b = document.querySelector('#sheet [data-act=mDexOne]:not([disabled])'); if (b) { b.scrollIntoView({ block: 'center' }); return true; } return false; });
    if (one) { await t.tap('#sheet [data-act=mDexOne]:not([disabled])'); await W(700); await S('dex-one'); }
    await E(() => EchoGame.closeModal());
  });
  await run('team', async () => { await t.home('mon'); await t.settle(200); await t.tap('[data-act=mTeam]'); await W(600); await S('team'); await E(() => EchoGame.closeModal()); });

  // ---------- 5. 大地图：2D 和 3D，键盘走、摇杆走、按 A 和人说话、菜单 ----------
  const world = async (tag, gfx) => {
    await run('world-' + tag, async () => {
      await t.reload(SV({ gfx })); await t.enterWorld();
      const d = await t.dbg();
      notes['world-' + tag] = Object.assign({ want: gfx }, d, await E(() => { const R = EchoWorld._debug().R, i = R.info ? R.info() : null, c = document.querySelector('#w-view canvas.w-canvas'); return { calls: i ? i.render.calls : 0, tris: i ? i.render.triangles : 0, canvas: c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null, tier: EchoWorld.gfxTier ? EchoWorld.gfxTier() : '' }; }));
      await S('world-' + tag);
    });
    await run('world-' + tag + '-keys', async () => {
      const a = await t.dbg(), dir = await t.freeDir(2);
      const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir || 'down'];
      for (let i = 0; i < 2; i++) { await p.keyboard.down(K); await W(60); await p.keyboard.up(K); await W(380); }
      await t.until(async () => !(await t.dbg()).moving, 20, 100);
      const b = await t.dbg();
      notes['world-' + tag + '-keys'] = { dir, from: [a.x, a.y], to: [b.x, b.y], moved: a.x !== b.x || a.y !== b.y };
      await S('world-' + tag + '-keys');
    });
    await run('world-' + tag + '-joy', async () => { notes['world-' + tag + '-joy'] = await joystick(t); await S('world-' + tag + '-joy'); });
    await run('world-' + tag + '-dialog', async () => {
      await t.closeDlg();
      const n = await t.faceNpc(); await t.settle(300);
      await E(() => { window.__ios.ev = []; window.__ios.log = true; });
      const how = await t.tap('#world .ab .ba');
      await t.until(async () => (await t.dbg()).dlg, 20, 100); await W(700);
      const ev = await E(() => { window.__ios.log = false; return window.__ios.ev.slice(0, 30); });
      notes['world-' + tag + '-dialog'] = { npc: n, tap: how, dlg: (await t.dbg()).dlg, events: ev.join(' ') };
      await S('world-' + tag + '-dialog');
      // 两根手指：左手按着摇杆，右手点 A（只有 Chromium 能真的模拟；见 multiTouch）
      await t.closeDlg();
      if (tag === '2d') notes.multiTouch = await multiTouch(t);
      await t.closeDlg();
    });
    await run('world-' + tag + '-menu', async () => {
      await t.closeDlg(); await t.tap('#world .ab .bb'); await p.waitForSelector('#sheet .w-menu-grid', { timeout: 5000 }); await W(300); await S('world-' + tag + '-menu');
      await E(() => EchoGame.closeModal());
    });
  };
  await world('2d', '2d');
  await run('world-pad', async () => { // 设置里换成方向键
    await t.reload(SV({ gfx: '2d', ctl: 'pad' })); await t.enterWorld(); await S('world-pad');
  });
  await world('3d', 'high');

  // ---------- 6. 野外对战：2D 画面和 3D 画面 ----------
  const battle = async (tag, gfx) => {
    await run('battle-' + tag, async () => {
      await t.reload(SV({ gfx })); await t.home('mon');
      await E(() => MonsterGame.battle('wild', 0, { onEnd() {}, hab: 'grass', foes: [MonsterGame.newMon('twigling', 3)] }));
      const up = await t.until(() => E(() => !!document.querySelector('#b-panel [data-act=bMove]')), 200, 150);   // 开场两句朗读念完菜单才出来
      await W(500);
      notes['battle-' + tag] = await E(() => { const B3 = MonsterGame._b3 && MonsterGame._b3(), c = document.querySelector('#b-arena canvas.b3d'); let gi = null; try { gi = B3 && B3.glInfo ? B3.glInfo() : null; } catch (e) { gi = String(e); }
        return { is3d: !!B3, canvas: c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null, gl: gi, moves: document.querySelectorAll('#b-panel [data-act=bMove]').length }; });
      notes['battle-' + tag].menuUp = up;
      await S('battle-' + tag + '-menu');
      await t.tap('#b-panel [data-act=bMove][data-i="0"]'); await W(900);
      notes['battle-' + tag].task = await E(() => ({ say: (document.querySelector('#b-say') || {}).textContent || '', mic: !!document.querySelector('#b-mic'), rate: !!document.querySelector('#b-panel [data-act=bRate]'), listen: !!document.querySelector('#b-panel .b-listen'), head: (document.querySelector('#b-panel .task-h') || {}).textContent || '' }));
      await S('battle-' + tag + '-task');
      // 出招：网页版自评「说得好」；App 里点话筒（没网 → 2 次以后改成听音选）
      if (notes['battle-' + tag].task.rate) await t.tap('#b-panel [data-act=bRate][data-v="2"]');
      else if (notes['battle-' + tag].task.mic) { for (let i = 0; i < 2; i++) { if (!(await visible('#b-mic'))) break; await t.tap('#b-mic'); await t.until(() => E(() => !!document.querySelector('#b-panel .b-listen') || /没网|额度|密钥|没听清/.test((document.querySelector('#b-hint') || {}).textContent || '') || !document.querySelector('#modal').hidden), 40, 200); await W(300); if (!(await E(() => document.querySelector('#modal').hidden))) { notes['battle-' + tag].modal = (await E(() => document.querySelector('#sheet').innerText)).slice(0, 80); await E(() => EchoGame.closeModal()); break; } }
        notes['battle-' + tag].after = await E(() => ({ hint: (document.querySelector('#b-hint') || {}).textContent || '', listen: !!document.querySelector('#b-panel .b-listen') }));
        if (notes['battle-' + tag].after.listen) { await S('battle-' + tag + '-listen'); await E(() => { const B = MonsterGame._b(), i = B.task.lopts.findIndex(o => o.c); document.querySelectorAll('#b-panel .b-listen .opt')[i].click(); }); } }
      await W(tag === '3d' ? 2600 : 1600);
      await S('battle-' + tag + '-attack');
      // 轮到对手：听力防御（点对的）；然后逃跑
      await t.until(() => E(() => !!document.querySelector('#b-panel [data-act=bDef], #b-panel [data-act=bMove], #b-panel [data-act=bEnd], #sheet [data-act=bEnd]')), 80, 150);
      if (await E(() => !!document.querySelector('#b-panel [data-act=bDef]'))) { await W(300); await S('battle-' + tag + '-defend'); }
      await E(() => { const x = document.querySelector('[data-act=bFlee]'); if (x) x.click(); }); await W(900);
      await S('battle-' + tag + '-end');
      await E(() => { const x = document.querySelector('#sheet [data-act=bEnd], #b-panel [data-act=bEnd]'); if (x) x.click(); EchoGame.closeModal(); }); await W(400);
    });
  };
  await battle('2d', '2d');
  await battle('3d', 'high');
  await t.home('mon').catch(() => {});
  return notes;
}

// 摇杆：在屏幕左半边按下、往能走的方向推、按住、松开。三种办法都试，记下各自动没动、引擎发了哪些事件
async function joystick(t) {
  const { p, E, W } = t, out = {};
  const zone = await E(() => { const r = document.querySelector('#w-joy').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, shown: r.width > 0 }; });
  out.zone = zone;
  if (!zone.shown) return out;
  const x = zone.x + zone.w * 0.5, y = zone.y + zone.h * 0.6;
  const V = { up: [0, -70], down: [0, 70], left: [-70, 0], right: [70, 0] };
  const pos = async () => { const d = await t.dbg(); return [d.x, d.y]; };
  const stop = () => t.until(async () => !(await t.dbg()).moving, 25, 100);
  const log = on => E(on => { if (on) { window.__ios.ev = []; window.__ios.log = true; return []; } window.__ios.log = false; return [...new Set(window.__ios.ev)]; }, on);
  // (a) Chromium：CDP 的真触摸（Input.dispatchTouchEvent）——浏览器自己把它变成 touch + pointer 事件
  if (t.engine === 'chromium') {
    const dir = await t.freeDir(2) || 'down', [dx, dy] = V[dir], a = await pos();
    const cdp = t.cdp || (t.cdp = await t.ctx.newCDPSession(p));
    await log(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5, id: 1 }] }); await W(30); }
    await W(650);
    const mid = await E(() => { const b = document.querySelector('.joy-base'); return { on: b.classList.contains('on'), left: b.style.left, top: b.style.top, knob: document.querySelector('.joy-knob').style.transform, scrollY: window.scrollY }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await stop(); const b = await pos();
    out.cdpTouch = { dir, from: a, to: b, moved: a[0] !== b[0] || a[1] !== b[1], mid, events: (await log(false)).join(' ') };
  }
  // (b) 两个引擎：页面里自己造的 PointerEvent（pointerType: touch，不是浏览器发的，isTrusted = false；setPointerCapture 会失败，游戏里接住了）
  {
    const dir = await t.freeDir(2) || 'down', [dx, dy] = V[dir], a = await pos();
    await log(true);
    await E(([x, y, dx, dy]) => new Promise(res => { const z = document.querySelector('#w-joy'); const mk = (type, cx, cy) => new PointerEvent(type, { pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true, composed: true });
      z.dispatchEvent(mk('pointerdown', x, y)); let i = 0; const iv = setInterval(() => { i++; const k = Math.min(1, i / 5); z.dispatchEvent(mk('pointermove', x + dx * k, y + dy * k)); if (i >= 16) { clearInterval(iv); z.dispatchEvent(mk('pointerup', x + dx, y + dy)); res(); } }, 50); }), [x, y, dx, dy]);
    await stop(); const b = await pos();
    out.synthPointer = { dir, from: a, to: b, moved: a[0] !== b[0] || a[1] !== b[1], events: (await log(false)).join(' ') };
  }
  // (c) 两个引擎：Playwright 的鼠标拖动（浏览器发的真事件，pointerType: mouse，能 setPointerCapture）
  {
    const dir = await t.freeDir(2) || 'down', [dx, dy] = V[dir], a = await pos();
    await log(true);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx, y + dy, { steps: 5 }); await W(750);
    const mid = await E(() => ({ on: document.querySelector('.joy-base').classList.contains('on'), knob: document.querySelector('.joy-knob').style.transform }));
    await p.mouse.up();
    await stop(); const b = await pos();
    out.mouseDrag = { dir, from: a, to: b, moved: a[0] !== b[0] || a[1] !== b[1], mid, events: (await log(false)).join(' ') };
  }
  return out;
}

// 两根手指：左手按住摇杆（不推），右手点 A —— 面前有人就该出对话框。只有 Chromium 的 CDP 能发真的多点触摸；WebKit 只能在页面里造一个「不是第一根手指」的 pointerup
async function multiTouch(t) {
  const { p, E, W } = t, out = {};
  const n = await t.faceNpc(); if (!n) return { skipped: 'no npc' };
  await t.settle(200);
  const g = await E(() => { const z = document.querySelector('#w-joy').getBoundingClientRect(), a = document.querySelector('#world .ab .ba').getBoundingClientRect(); return { jx: z.left + z.width / 2, jy: z.top + z.height * .6, ax: a.left + a.width / 2, ay: a.top + a.height / 2 }; });
  if (t.engine === 'chromium') {
    const cdp = t.cdp || (t.cdp = await t.ctx.newCDPSession(p));
    await E(() => { window.__ios.ev = []; window.__ios.log = true; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.jx, y: g.jy, id: 1 }] }); await W(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.jx, y: g.jy, id: 1 }, { x: g.ax, y: g.ay, id: 2 }] }); await W(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.ax, y: g.ay, id: 2 }] }); await W(500);   // 只抬起第二根手指（touchEnd 里列的是要抬起的那几根；空的 = 全部抬起）
    out.cdp = { dlg: (await t.dbg()).dlg, events: (await E(() => { window.__ios.log = false; return window.__ios.ev.slice(0, 40); })).join(' ') };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await W(200);
    await t.closeDlg(); await t.faceNpc(); await t.settle(200);
    // 反过来：先按住 A（第一根手指），再按摇杆，然后松开 A —— A 是「第一根手指」，游戏等浏览器发 click；两根手指同时在屏幕上时浏览器不一定发
    await E(() => { window.__ios.ev = []; window.__ios.log = true; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.ax, y: g.ay, id: 1 }] }); await W(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g.ax, y: g.ay, id: 1 }, { x: g.jx, y: g.jy, id: 2 }] }); await W(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: g.ax, y: g.ay, id: 1 }] }); await W(500);   // A 那根手指抬起，摇杆还按着
    out.cdpAFirst = { dlg: (await t.dbg()).dlg, events: (await E(() => { window.__ios.log = false; return window.__ios.ev.slice(0, 40); })).join(' ') };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await W(200);
    await t.closeDlg(); await t.faceNpc(); await t.settle(200);
  }
  await E(g => { const b = document.querySelector('#world .ab .ba'); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 42, pointerType: 'touch', isPrimary: false, clientX: g.ax, clientY: g.ay, bubbles: true, cancelable: true })); }, g);
  await W(500);
  out.synth = { dlg: (await t.dbg()).dlg };
  return out;
}

// 销售版：家长首次设置向导（假原生桥 edition: 'sales', pin: null, key: ''），至少走到第 ② 步设备检查
async function salesTour(t, step) {
  const { p, E, W } = t, notes = t.notes = {};
  const run = async (name, fn) => { t.ev.step = 'sales-' + name; try { await fn(); } catch (e) { notes[name + ':failed'] = String(e.message).split('\n')[0].slice(0, 200); await step('sales-' + name, { failed: notes[name + ':failed'] }).catch(() => {}); } };
  await run('wizard-1', async () => {
    await E(() => localStorage.removeItem('echo-island-v1'));
    await t.load('?edition=sales');
    await p.waitForSelector('#setup', { timeout: 8000 }); await W(500);
    notes.w1 = await E(() => ({ sales: !!(window.DEX && DEX.sales), step: (document.querySelector('#su-box .su-step') || { dataset: {} }).dataset.step, tabs: document.querySelectorAll('.su-tabs li').length, nextDisabled: document.querySelector('#su-next').disabled }));
    await step('sales-wizard-1');
    await E(() => document.querySelector('#su-box').scrollTo(0, 99999)); await step('sales-wizard-1-end');
  });
  await run('wizard-doc', async () => { await t.tap('[data-act=suDoc][data-doc=privacy]'); await p.waitForSelector('#su-doc iframe', { timeout: 5000 }); await W(900); await step('sales-wizard-doc'); await t.tap('[data-act=suDocClose]'); await W(200); });
  await run('wizard-2', async () => {
    await t.tap('#su-consent'); await W(200);
    notes.consent = await E(() => ({ checked: document.querySelector('#su-consent').checked, nextDisabled: document.querySelector('#su-next').disabled }));
    await t.tap('#su-next'); await W(300);
    await t.until(() => E(() => !!document.querySelector('#su-verdict')), 60, 200);
    notes.w2 = await E(() => ({ step: (document.querySelector('#su-box .su-step') || { dataset: {} }).dataset.step, rows: Object.fromEntries([...document.querySelectorAll('.su-dev li[data-k]')].map(li => [li.dataset.k, li.className + ' | ' + li.innerText.replace(/\s+/g, ' ').slice(0, 70)])), verdict: (document.querySelector('#su-verdict') || {}).innerText || '', nextDisabled: document.querySelector('#su-next').disabled }));
    await step('sales-wizard-2');
    await E(() => document.querySelector('#su-box').scrollTo(0, 99999)); await step('sales-wizard-2-end');
  });
  await run('wizard-3', async () => {
    if (await E(() => document.querySelector('#su-next').disabled)) { notes.w3 = 'next disabled'; return; }
    await t.tap('#su-next'); await W(500);
    notes.w3 = await E(() => ({ step: (document.querySelector('#su-box .su-step') || { dataset: {} }).dataset.step, pad: !!document.querySelector('#su-box .pin-pad, #su-box [data-act=suPinKey], #su-box [data-act=pinKey]') }));
    await step('sales-wizard-3');
  });
  return notes;
}

module.exports = { tour, salesTour, joystick, multiTouch };
