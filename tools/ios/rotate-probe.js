// 回声岛 · 转屏检查：大地图开着的时候把屏幕横过来 / 竖回去，看 3D 画布是不是还和画面那一层一样大、主角是不是还在画面该在的地方。
// 老板 2026-11-20 在 iPhone 上：竖屏主角跑到最右边、横屏只看得到天和屋顶（主角在屏幕下面外头）。
// 走几种路线：户外直接转；进屋（老渲染器）以后转、再出来；在首页转了再进大地图。每一步打印：
//   画面那一层的宽高、每张画布的样式宽高和显示没显示、现在谁在画、主角在画面上的位置（占宽 / 高的百分之几）
// 用法：node tools/ios/rotate-probe.js [--engines webkit,chromium]
'use strict';
const L = require('./lib');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] || ''); };
const ENGINES = arg('engines', 'webkit').split(',');
const PORT = { width: 402, height: 874 }, LAND = { width: 874, height: 402 };

(async () => {
  const srv = await L.serve();
  let bad = 0;
  for (const engine of ENGINES) {
    const browser = await L.launch(engine);
    const t = await L.open(browser, srv.base, { engine, orient: 'portrait', bridge: { net: 'offline' }, save: L.SAVE({ gfx: 'high' }) });
    const { p, E, W } = t;
    await t.load('?look=new');
    await p.setViewportSize(PORT);
    await t.enterWorld(); await W(2500);
    const snap = async what => {
      await W(1200);
      const r = await E(() => {
        const d = EchoWorld._debug(), R = d.R, v = document.getElementById('w-view');
        const cvs = [...v.querySelectorAll('canvas')].map(c => ({ w: Math.round(parseFloat(c.style.width) || 0), h: Math.round(parseFloat(c.style.height) || 0), shown: getComputedStyle(c).display !== 'none', bw: c.width, bh: c.height }));
        const pr = R && R.probe ? R.probe() : null;
        let ps = null;
        try { const c = v.querySelector('canvas.w-canvas') || v.querySelector('canvas'); if (pr && pr.playerScreen) ps = pr.playerScreen; } catch (e) { /* 没有就算了 */ }
        return { map: d.M.id, using: R && R.using ? R.using() : (R ? R.kind : ''), vw: v.clientWidth, vh: v.clientHeight, iw: innerWidth, ih: innerHeight, cvs, pitch: pr ? +(pr.pitch * 57.3).toFixed(1) : null, fov: pr ? pr.fov : null, ps };
      });
      const shown = r.cvs.filter(c => c.shown);
      const ok = shown.length >= 1 && shown.every(c => c.w === r.vw && c.h === r.vh);
      if (!ok) bad++;
      console.log((ok ? '  ok ' : '  BAD ') + engine + ' · ' + what + ' · ' + JSON.stringify(r));
      await p.screenshot({ path: require('path').join(L.OUT, 'rotate-' + engine + '-' + what.replace(/[^a-z0-9]+/gi, '-') + '.png') });
    };
    const rot = async vp => { await p.setViewportSize(vp); };
    await snap('1 outdoors portrait');
    await rot(LAND); await snap('2 outdoors to landscape');
    await rot(PORT); await snap('3 outdoors back to portrait');
    // 进屋（老渲染器接手），在屋里转屏，再出来
    await E(() => EchoWorld._debug().goMap('i0C', 'door')); await W(1500); await t.closeDlg();
    await snap('4 indoors portrait');
    await rot(LAND); await snap('5 indoors to landscape');
    await E(() => EchoWorld._debug().goMap('t0', 'door:C')); await W(1500); await t.closeDlg();
    await snap('6 out again in landscape');
    await rot(PORT); await snap('7 outdoors to portrait');
    await E(() => EchoWorld._debug().goMap('i0C', 'door')); await W(1500); await t.closeDlg();
    await rot(LAND); await W(600);
    await rot(PORT); await W(600);
    await E(() => EchoWorld._debug().goMap('t0', 'door:C')); await W(1500); await t.closeDlg();
    await snap('8 out again after two turns indoors');
    await p.context().close();
    await browser.close();
  }
  console.log(bad ? ('有 ' + bad + ' 步画布和画面不一样大') : '每一步画布都和画面一样大');
  process.exit(bad ? 1 : 0);
})();
