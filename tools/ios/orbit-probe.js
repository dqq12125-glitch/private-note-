// 回声岛 · iPhone 检查：转镜头在 WebKit 里手指接不接得住。
// 老板 2026-11-20 在 iPhone 上说「还是转不了」——这里不用键盘、不直接调 R.orbit，只看「手指落在右半边屏幕时，最上面那一层是谁」，
// 再对着那一层发指针事件拖一段，看镜头的角度变没变。竖屏、横屏、摇杆 / 方向键两种操作各看一遍，新画风用设置里的开关打开（和老板的做法一样）。
// 用法：node tools/ios/orbit-probe.js [--engines webkit,chromium]
'use strict';
const path = require('path');
const L = require('./lib');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] || ''); };
const ENGINES = arg('engines', 'webkit,chromium').split(',');

(async () => {
  const srv = await L.serve();
  for (const engine of ENGINES) {
    const browser = await L.launch(engine);
    for (const orient of ['portrait', 'landscape']) for (const ctl of ['joy', 'pad']) {
      let t = null;
      try {
        const save = L.SAVE({ gfx: 'high' });
        t = await L.open(browser, srv.base, { engine, orient, bridge: { net: 'offline' }, save });
        await t.load('');   // 不带 ?look=new：和手机上一样，靠设置里的开关
        const sw = await t.E(c => {
          const S = EchoGame.S; S.settings.ctl = c; EchoGame.save && EchoGame.save();
          try { localStorage.setItem('echo-look', 'new'); } catch (e) { return 'ls:' + e.message; }
          return { hasOpen: !!window.EchoWorldOpen, on: !!(window.EchoWorldOpen && EchoWorldOpen.on), ios: !!window.ECHO_IOS, cls: document.documentElement.className };
        }, ctl);
        await t.load('');   // 重新打开：开关是启动时读的
        const on2 = await t.E(() => ({ on: !!(window.EchoWorldOpen && EchoWorldOpen.on), gfx: EchoGame.S.settings.gfx, ctl: EchoGame.S.settings.ctl }));
        await t.enterWorld();
        await t.W(2500);
        const r = await t.E(async () => {
          const d = EchoWorld._debug(), R = d.R, W = innerWidth, H = innerHeight;
          const at = (fx, fy) => { const e = document.elementFromPoint(W * fx, H * fy); return e ? (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ').join('.') + '<' + e.tagName.toLowerCase() + '>' : null; };
          const out = { using: R && R.using ? R.using() : '?', orbit: R && R.orbit ? R.orbit() : null, camOn: document.getElementById('world').classList.contains('cam-on'),
            zone: (() => { const z = document.getElementById('w-orb'); if (!z) return null; const b = z.getBoundingClientRect(), cs = getComputedStyle(z); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), display: cs.display, pe: cs.pointerEvents, z: cs.zIndex, ta: cs.touchAction }; })(),
            hit: { mid: at(.75, .45), upper: at(.8, .3), lower: at(.7, .6), left: at(.25, .6) } };
          // 对着右半边中间那一点最上面的元素，发一串指针事件（和手指拖一样的顺序）
          const x0 = W * .75, y0 = H * .45, el = document.elementFromPoint(x0, y0);
          const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
          const before = R && R.orbit && R.orbit() ? R.orbit().yaw : null;
          ev('pointerdown', x0, y0);
          for (let i = 1; i <= 10; i++) { ev('pointermove', x0 - i * 12, y0); await new Promise(r => setTimeout(r, 16)); }
          ev('pointerup', x0 - 120, y0);
          await new Promise(r => setTimeout(r, 300));
          out.yawBefore = before; out.yawAfter = R && R.orbit && R.orbit() ? R.orbit().yaw : null;
          out.compass = (() => { const c = document.getElementById('w-compass'); return c ? !c.hidden : null; })();
          return out;
        });
        console.log(engine, orient, ctl, JSON.stringify({ sw, on2, r }));
        await t.p.screenshot({ path: path.join(L.OUT, 'orbit-probe-' + engine + '-' + orient + '-' + ctl + '.png') });
      } catch (e) { console.log(engine, orient, ctl, 'ERR', String(e.message).slice(0, 300)); }
      finally { if (t) await t.p.context().close().catch(() => {}); }
    }
    await browser.close();
  }
  srv.close && srv.close();
  process.exit(0);
})();
