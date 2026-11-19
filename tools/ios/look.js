// 回声岛 · iPhone 检查：新画风（?look=new，world3d-open.js + people3d.js 的 3D 小人）在 WebKit 里画不画得出来、一帧多少毫秒。
// 用法：node tools/ios/look.js [--engines webkit,chromium] [--orients portrait,landscape] [--sec 4]
// 做法：和 tools/ios/audit.js 同一套（lib.js）：iPhone 15 的尺寸、3 倍屏、装假原生桥当成 App（ECHO_APP / ECHO_IOS），存档画质「精美」，
//   打开 index.html?look=new → 进大地图（第一座小镇 t0）→ 站着量 3 秒、按方向键走 sec 秒 → 去 1 号路 r0 再量一遍 → 截图。
//   量的：R.using()（'open' = 新画风真的在画，'std' = 退回老的 3D）、R.draw 每次花的 CPU 时间（平均 / 最长 / 超过 12ms 的次数）、
//   两帧之间的间隔（超过 33ms 的次数、p99）、draw call、三角形、3D 小人（p3：主角和村民是不是 3D 的）、报错。
// 注意：这是 Windows 上 Playwright 的 WebKit（桌面显卡、不降速），不是 iPhone：能说明「WebKit 的着色器编得过、画得出来、没有报错」，
//   一帧的毫秒数只能和同一台电脑上的 Chromium 比，不能当成手机上的数（手机上要在真机的 Safari 网页检查器里看）。
// 结果：tests/screenshots/ios/look.json + 截图 look-<引擎>-<方向>-<地方>.png
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] || ''); };
const ENGINES = arg('engines', 'webkit,chromium').split(','), ORIENTS = arg('orients', 'portrait,landscape').split(',');
const SEC = +arg('sec', '4') * 1000;
const r1 = v => Math.round(v * 10) / 10;

async function measure(t, label) {
  const { p, E, W } = t;
  await E(() => {
    window.__pf = { n: 0, sum: 0, max: 0, over12: 0, gaps: [], last: 0 };
    const R = EchoWorld._debug().R;
    if (R && !R.__pf) {
      const d = R.draw; R.__pf = 1;
      R.draw = function () { const a = performance.now(); const v = d.apply(this, arguments); const ms = performance.now() - a, P = window.__pf; P.n++; P.sum += ms; if (ms > P.max) P.max = ms; if (ms > 12) P.over12++; if (P.last) P.gaps.push(a - P.last); P.last = a; return v; };
    }
  });
  const take = async (what, act) => {
    await E(() => Object.assign(window.__pf, { n: 0, sum: 0, max: 0, over12: 0, gaps: [], last: 0 }));
    const a = Date.now(); await act(); const sec = (Date.now() - a) / 1000;
    const r = await E(() => { const P = window.__pf, g = P.gaps.slice().sort((x, y) => x - y); return { n: P.n, avg: P.sum / Math.max(1, P.n), max: P.max, over12: P.over12, over33: g.filter(x => x > 33.4).length, p99: g[Math.floor(g.length * .99)] || 0 }; });
    const info = await E(() => { const R = EchoWorld._debug().R, i = R.info ? R.info() : null, pr = R.probe ? R.probe() : null;
      return { using: R.using ? R.using() : R.kind, calls: i ? i.render.calls : 0, tris: i ? i.render.triangles : 0, p3: pr && pr.p3 ? pr.p3 : null, gl: R.glState ? R.glState() : '' }; });
    return Object.assign({ where: label + ' ' + what, fps: r1(r.n / sec), drawMs: r1(r.avg), drawMax: r1(r.max), over12: r.over12, gapOver33: r.over33, gapP99: r1(r.p99) }, info);
  };
  const hold = async (k, ms) => { await p.keyboard.down(k); await W(ms); await p.keyboard.up(k); };
  const rows = [];
  rows.push(await take('站着', () => W(3000)));
  rows.push(await take('走路', async () => { const dir = await t.freeDir(3); const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir || 'down'];
    const back = { ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' }[K];
    await hold(K, SEC / 2); await hold(back, SEC / 2); }));
  return rows;
}

(async () => {
  const srv = await L.serve();
  const out = { at: new Date().toISOString(), runs: [] };
  for (const engine of ENGINES) {
    const browser = await L.launch(engine);
    for (const orient of ORIENTS) {
      const run = { engine, orient, version: browser.version(), rows: [], errors: [], notes: {} };
      out.runs.push(run);
      let t = null;
      try {
        t = await L.open(browser, srv.base, { engine, orient, bridge: { net: 'offline' }, save: L.SAVE({ gfx: 'high' }) });
        await t.load('?look=new');
        run.notes.flag = await t.E(() => ({ on: !!(window.EchoWorldOpen && EchoWorldOpen.on), people3d: !!window.EchoPeople3D }));
        await t.enterWorld();
        await t.W(2500);
        run.notes.t0 = await t.dbg();
        run.rows.push(...await measure(t, 't0'));
        await t.p.screenshot({ path: path.join(L.OUT, 'look-' + engine + '-' + orient + '-t0.png') });
        await t.E(() => EchoWorld._debug().goMap('r0', 'from:t0'));
        await t.p.waitForFunction(() => EchoWorld._debug().M.id === 'r0', null, { timeout: 20000 }).catch(() => {});
        await t.W(1500); await t.closeDlg(); await t.W(1500);
        run.notes.r0 = await t.dbg();
        run.rows.push(...await measure(t, 'r0'));
        await t.p.screenshot({ path: path.join(L.OUT, 'look-' + engine + '-' + orient + '-r0.png') });
      } catch (e) {
        run.errors.push('step failed: ' + String(e.message).split('\n')[0].slice(0, 200));
      }
      if (t) {
        for (const [step, b] of Object.entries(t.ev.bag)) {
          b.pageerror.forEach(x => run.errors.push(step + ' pageerror: ' + x.m));
          b.console.filter(x => x.t === 'error').forEach(x => run.errors.push(step + ' console: ' + x.m));
        }
        const rej = await t.E(() => (window.__ios ? window.__ios.rej.concat(window.__ios.errs.map(e => e.k + ' ' + e.m)) : [])).catch(() => []);
        rej.forEach(x => run.errors.push('page: ' + x));
        await t.ctx.close();
      }
      console.log('\n── ' + engine + ' ' + browser.version() + ' · ' + orient + '  新画风开着：' + JSON.stringify(run.notes.flag));
      for (const r of run.rows) console.log('   ' + r.where.padEnd(10) + ' using=' + r.using + '  帧/秒 ' + r.fps + '  一帧CPU ' + r.drawMs + 'ms（最长 ' + r.drawMax + '，>12ms ' + r.over12 + ' 次）  间隔>33ms ' + r.gapOver33 + '  p99 ' + r.gapP99 + 'ms  draw call ' + r.calls + '  三角形 ' + r.tris + '  3D 小人 ' + JSON.stringify(r.p3));
      console.log('   报错 ' + run.errors.length + (run.errors.length ? '：\n      ' + run.errors.slice(0, 8).join('\n      ') : ''));
    }
    await browser.close();
  }
  srv.s.close();
  fs.writeFileSync(path.join(L.OUT, 'look.json'), JSON.stringify(out, null, 1));
  console.log('\n结果：' + path.join(L.OUT, 'look.json'));
})().catch(e => { console.error(e); process.exit(1); });
