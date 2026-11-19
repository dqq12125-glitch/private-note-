// 回声岛 · 新画风调的时候随手拍几张（只拍新画风，不拼对比图）：
//   node tools/look/snap.js r3m:16,12:up t6:18,20 [--tag a] [--gfx high] [--look new|old] [--land 1]
// 每个参数是 地图:x,y[:面朝]；截图在 tests/screenshots/look/snap/<地图>-<x>-<y>[-tag].png，同时打印 draw call / 三角形 / 报错
const fs = require('fs'), path = require('path');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { gfx: 'high', tag: '', look: 'new', land: '', stats: '' }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }

(async () => {
  const dir = path.join(L.OUT, 'snap'); fs.mkdirSync(dir, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const vp = opt.land ? { width: 920, height: 420 } : { width: 420, height: 920 };
  const fresh = async () => { const q = await L.open(browser, base, { look: opt.look === 'old' ? '' : 'new', gfx: opt.gfx, vp }); await q.W(3500); return q; };
  let t = await fresh(), cur = '';
  for (const a of pos) {
    const [map, xy, face] = a.split(':'), [x, y] = xy.split(',').map(Number);
    if (map !== cur) {
      await t.go(map, 'start'); cur = map; await t.W(1500);
      if (!(await t.p.evaluate(() => document.body.className.includes('scr-world')))) { await t.ctx.close(); t = await fresh(); await t.go(map, 'start'); await t.W(1500); }
    }
    await t.tp(x, y, face || "up");
    await t.p.evaluate(() => { const d = EchoWorld._debug(); d.M.npcs.forEach(n => { n.face = 'down'; n.nextTurn = performance.now() + 120000; }); });
    await t.W(1400); await t.closeDlg();
    const f = path.join(dir, map + '-' + x + '-' + y + (opt.tag ? '-' + opt.tag : '') + '.png');
    await t.shot(f);
    const i = await t.info(), pr = await t.probe(), st = opt.stats ? await t.p.evaluate(() => { const R = EchoWorld._debug().R; return R.statsOpen ? R.statsOpen() : null; }) : null;
    if (st) console.log('   ', st.slice(0, 8).map(r => r[2] + ' ' + r[0] + '/' + r[1]).join('  '));
    console.log(a.padEnd(18), 'calls', i.calls, 'tris', i.tris, pr ? 'build ' + pr.buildMs + 'ms tex ' + pr.texMB + 'MB' : '', t.errs.length ? 'ERR ' + t.errs.slice(-1)[0].slice(0, 200) : '', '→', path.relative(L.ROOT, f));
  }
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
