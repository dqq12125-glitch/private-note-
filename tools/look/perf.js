// 回声岛 · 新老画风的性能对比：在第一座小镇和 1 号路上走路，量一帧画面的 CPU 时间、超过 33 毫秒的帧、draw call、三角形、显存里的东西
// 用法：node tools/look/perf.js [new|old|both] [--gfx high,mid,low] [--throttle 4] [--sec 8] [--leak 1]
//   真显卡的无头浏览器（--use-angle=d3d11），CPU 降速 4 倍模拟手机（和 tools/perf/profile.js 一样的量法）
//   --leak 1：再来回切 6 次地图（小镇 ⇄ 1 号路 ⇄ 屋里），每次记显存里的几何体 / 贴图 / 着色器个数，看涨不涨
// 结果打印成表，同时存 tools/perf/out/look-<时间>.json
const fs = require('fs'), path = require('path');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { gfx: 'high', throttle: 4, sec: 8, leak: 0 }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
const WHICH = pos[0] || 'both', r1 = n => Math.round(n * 10) / 10;

(async () => {
  const { s, base } = await L.serve(), browser = await L.launch(), rows = [], leak = {};
  for (const gfx of String(opt.gfx).split(',')) for (const look of ['old', 'new']) {
    if (WHICH !== 'both' && WHICH !== look) continue;
    const t = await L.open(browser, base, { look: look === 'new' ? 'new' : '', gfx, dsf: 3 });
    const cdp = await t.ctx.newCDPSession(t.p);
    await t.W(5000);
    // 把 R.draw 包一层记每次画的 CPU 时间；另外记每两帧之间隔了多久
    await t.p.evaluate(() => {
      window.__pf = { n: 0, sum: 0, max: 0, over12: 0, gaps: [], last: 0 };
      window.__pfHook = () => { const R = EchoWorld._debug().R; if (!R || R.__pf) return; const d = R.draw; R.__pf = 1; R.draw = function () { const a = performance.now(); const v = d.apply(this, arguments); const ms = performance.now() - a, P = window.__pf; P.n++; P.sum += ms; if (ms > P.max) P.max = ms; if (ms > 12) P.over12++; if (P.last) P.gaps.push(a - P.last); P.last = a; return v; }; };
      window.__pfHook();
    });
    const sample = async (name, act) => {
      await t.p.evaluate(() => { window.__pfHook(); Object.assign(window.__pf, { n: 0, sum: 0, max: 0, over12: 0, gaps: [], last: 0 }); });
      const a = Date.now(); await act(); const sec = (Date.now() - a) / 1000;
      const r = await t.p.evaluate(() => { const P = window.__pf, g = P.gaps.slice().sort((x, y) => x - y); return { n: P.n, avg: P.sum / Math.max(1, P.n), max: P.max, over12: P.over12, over33: g.filter(x => x > 33.4).length, over50: g.filter(x => x > 50).length, p99: g[Math.floor(g.length * .99)] || 0, gapMax: g[g.length - 1] || 0 }; });
      const i = await t.info();
      const row = { gfx, look, where: name, fps: r1(r.n / sec), drawMs: r1(r.avg), drawMax: r1(r.max), over12: r.over12, gapOver33: r.over33, gapOver50: r.over50, gapP99: r1(r.p99), gapMax: r1(r.gapMax), calls: i.calls, tris: i.tris, tex: i.tex, geo: i.geo, prog: i.prog };
      rows.push(row);
      console.log(JSON.stringify(row));
    };
    const walk = async seq => { for (const [dir, ms] of seq) await t.hold(dir, ms); };
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
    const sec = +opt.sec * 1000 / 4;
    // 小镇：在中间的草地上绕一圈；1 号路：沿着小路右边那一列往北走再走回来（不进草丛、不进训练师的视线）
    await t.tp(14, 14, 'up'); await t.W(1500);
    await sample('t0 走路', () => walk([['left', sec], ['down', sec / 2], ['right', sec], ['up', sec / 2], ['right', sec / 2], ['left', sec / 2]]));
    await sample('t0 站着', () => t.W(3000));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await t.go('r0', 'from:t0'); await t.tp(12, 41, 'up'); await t.W(2500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
    await t.W(1500);
    await sample('r0 走路', () => walk([['up', sec * 1.6], ['down', sec * 1.6]]));
    await sample('r0 站着', () => t.W(3000));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    if (+opt.leak) {
      const mem = [];
      for (let k = 0; k < 6; k++) {
        for (const [id, how] of [['t0', 'from:r0'], ['i0C', 'mat'], ['t0', 'door:C'], ['r0', 'from:t0']]) { await t.go(id, how); await t.W(700); if (id !== 'i0C') mem.push(id + ' ' + JSON.stringify(await t.info())); }
      }
      leak[gfx + ' ' + look] = mem;
      console.log('来回切地图（' + gfx + ' ' + look + '）：'); mem.forEach(x => console.log('   ' + x));
    }
    if (t.errs.length) console.log('  报错：', t.errs.slice(0, 3).join(' | '));
    await t.ctx.close();
  }
  console.log('\n画质  画风  哪里         帧/秒  一帧CPU(ms) 最长  >12ms  帧间隔>33ms  >50ms  p99   draw call  三角形   贴图 几何体 着色器');
  rows.forEach(r => console.log([r.gfx.padEnd(5), r.look.padEnd(4), r.where.padEnd(8), String(r.fps).padStart(6), String(r.drawMs).padStart(9), String(r.drawMax).padStart(7), String(r.over12).padStart(5), String(r.gapOver33).padStart(9), String(r.gapOver50).padStart(8), String(r.gapP99).padStart(6), String(r.calls).padStart(8), String(r.tris).padStart(9), String(r.tex).padStart(5), String(r.geo).padStart(5), String(r.prog).padStart(5)].join(' ')));
  const dir = path.join(L.ROOT, 'tools', 'perf', 'out'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'look-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify({ opt, rows, leak }, null, 1));
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
