// 回声岛 · 新画风转镜头以后主角有没有被挡住：把地图上每隔 step 格能站的地方都站一下，镜头转到四面，
// 读 R.probe().seen()（主角的头和胸口露在外面的比例：房子淡出去、树上开圆窗、镜头抬高以后应该接近 1），列出露得最少的地方，把最差的几处截图存下来
// 用法：node tools/look/occlude.js [--maps t0,r0,j8] [--step 3] [--yaw 0,90,180,270] [--gfx mid] [--worst 6] [--tilt 0] [--below 0.7]
//   --tilt：俯角比平常多多少度（负的 = 压低，最容易被挡）；--below：露出比例低于这个数的算「被挡住」
// 截图在 tests/screenshots/look/orbit/occ-<地图>-<x>-<y>-<角度>.png。要有后期（精美 / 标准档）才读得到深度图
const path = require('path'), fs = require('fs');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { maps: 't0,r0', step: 3, yaw: '0,90,180,270', gfx: 'mid', worst: 6, tilt: 0, below: .7 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];

(async () => {
  const dir1 = path.join(L.OUT, 'orbit'); fs.mkdirSync(dir1, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const t = await L.open(browser, base, { look: 'new', gfx: opt.gfx, vp: { width: 420, height: 920 }, dsf: 1, save: { badges: Object.fromEntries([...Array(13).keys()].map(i => [i, 1])) } });
  await t.W(5000);
  const yaws = String(opt.yaw).split(',').map(Number), step = Math.max(1, +opt.step);
  for (const map of String(opt.maps).split(',')) {
    await t.go(map, map === 'r0' ? 'from:t0' : 'start'); await t.W(2500);
    for (let k = 0; k < 20 && !(await t.p.evaluate(() => document.body.className.includes('scr-world') && !EchoWorld._debug().busy)); k++) { await t.closeDlg(); await t.W(500); }
    await t.p.evaluate(() => { const d = EchoWorld._debug(); d.M.npcs.forEach(n => { n.face = 'down'; n.nextTurn = performance.now() + 3600000; }); });
    const spots = await t.p.evaluate(step => { const d = EchoWorld._debug(), m = d.M, out = []; for (let y = 1; y < m.H - 1; y += step) for (let x = 1; x < m.W - 1; x += step) { const c = m.grid[y][x]; if (EchoMaps.WALK.includes(c) && !'^v<>'.includes(c) && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) <= 1)) out.push([x, y]); } return out; }, step);
    const rows = [];
    for (const yaw of yaws) {
      await t.p.evaluate(([a, tl]) => EchoWorld._debug().R.orbit('set', a * Math.PI / 180, tl * Math.PI / 180), [yaw, +opt.tilt]);
      for (const [x, y] of spots) {
        await t.p.evaluate(([x, y]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = d.FL.x = d.FL.fx = x; d.PL.y = d.PL.fy = d.FL.y = d.FL.fy = y; d.PL.dir = 'down'; d.PL.moving = false; }, [x, y]);
        await t.W(850);
        const q = await t.p.evaluate(() => { const p = EchoWorld._debug().R.probe(); return { seen: p.seen(), faded: p.faded, pitch: p.pitch }; });
        if (q.seen == null) { console.log('读不到深度图（省电档没有后期）：换 --gfx mid'); await browser.close(); s.close(); return; }
        rows.push({ x, y, yaw, seen: +q.seen.toFixed(2), faded: q.faded, pitch: Math.round(q.pitch * 57.3) });
      }
    }
    rows.sort((a, b) => a.seen - b.seen);
    const bad = rows.filter(r => r.seen < +opt.below);
    console.log(map + '：' + spots.length + ' 个地方 × ' + yaws.length + ' 个角度，露出不到 ' + Math.round(+opt.below * 100) + '% 的有 ' + bad.length + ' 处；平均 ' + (rows.reduce((a, r) => a + r.seen, 0) / Math.max(1, rows.length)).toFixed(3));
    rows.slice(0, 14).forEach(r => console.log('   ' + JSON.stringify(r)));
    // 最差的几处：回去再站一下、截图
    for (const r of rows.slice(0, +opt.worst)) {
      if (r.seen >= +opt.below) break;
      await t.p.evaluate(([a, tl]) => EchoWorld._debug().R.orbit('set', a * Math.PI / 180, tl * Math.PI / 180), [r.yaw, +opt.tilt]);
      await t.p.evaluate(([x, y]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = d.FL.x = d.FL.fx = x; d.PL.y = d.PL.fy = d.FL.y = d.FL.fy = y; d.PL.dir = 'down'; d.PL.moving = false; }, [r.x, r.y]);
      await t.W(1200);
      await t.shot(path.join(dir1, 'occ-' + map + '-' + r.x + '-' + r.y + '-' + r.yaw + '.png'));
    }
    await t.p.evaluate(() => EchoWorld._debug().R.orbit('set', 0, 0));
  }
  if (t.errs.length) console.log('  报错：', t.errs.slice(0, 3).join(' | '));
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
