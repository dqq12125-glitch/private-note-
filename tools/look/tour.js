// 回声岛 · 新画风把所有户外地图（小镇、道路）过一遍：每张进去拍一张、记 draw call / 三角形 / 报错，看别的岛「画不画得出来」
// 用法：node tools/look/tour.js [--gfx high] [--only t1,r1] [--look new|old]
// 截图在 tests/screenshots/look/tour/<地图>.png，最后拼一张总览 tour-all.png
const fs = require('fs'), path = require('path');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { gfx: 'high', only: '', look: 'new' };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];

(async () => {
  const dir = path.join(L.OUT, 'tour'); fs.mkdirSync(dir, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const fresh = async () => { const q = await L.open(browser, base, { look: opt.look === 'old' ? '' : 'new', gfx: opt.gfx, dsf: 1 }); await q.W(2500); return q; };
  let t = await fresh();
  let ids = await t.p.evaluate(() => EchoMaps.all().filter(id => { const m = EchoMaps.get(id); return m && (m.kind === 'town' || m.kind === 'route'); }));
  if (opt.only) ids = ids.filter(id => opt.only.split(',').includes(id));
  const rows = [];
  for (const id of ids) {
    let e0 = t.errs.length; const a = Date.now();
    await t.p.evaluate(id => { try { EchoWorld._debug().goMap(id, 'start'); } catch (e) { window.__tourErr = String(e && e.stack || e); } }, id);
    await t.W(900); await t.closeDlg(); await t.W(500);
    // 有的岛一进去就演剧情、开打：那一页不要了，换一页新的直接再进一次（剧情只在第一次触发的那种就过去了；还不行就照样拍下来）
    if (!(await t.p.evaluate(() => document.body.className.includes('scr-world')))) {
      await t.ctx.close(); t = await fresh(); e0 = 0;
      await t.p.evaluate(id => { try { EchoWorld._debug().goMap(id, 'start'); } catch (e) { window.__tourErr = String(e && e.stack || e); } }, id);
      await t.W(900);
    }
    const d = await t.dbg(), i = await t.info(), pr = await t.probe();
    const err = await t.p.evaluate(() => { const e = window.__tourErr || ''; window.__tourErr = ''; return e; });
    await t.shot(path.join(dir, id + '.png'));
    rows.push({ id, using: d.using || d.kind, calls: i.calls, tris: i.tris, tex: i.tex, step: pr ? pr.step : '', errs: t.errs.length - e0 + (err ? 1 : 0) });
    console.log(id.padEnd(6), String(d.using || d.kind).padEnd(5), 'calls', String(i.calls).padStart(3), 'tris', String(i.tris).padStart(7), 'tex', i.tex, pr ? 'step ' + (+pr.step).toFixed(2) : '', (Date.now() - a) + 'ms', err ? 'ERR ' + err.slice(0, 200) : t.errs.length > e0 ? 'ERR ' + t.errs[t.errs.length - 1].slice(0, 200) : '');
  }
  const pg = await (await browser.newContext({ viewport: { width: 1760, height: 900 } })).newPage();
  await pg.setContent('<body style="margin:0;background:#16202b;color:#fff;font:600 15px sans-serif"><div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px">' + rows.map(r => '<div><div>' + r.id + (r.errs ? ' ⚠' : '') + '</div><img width="168" src="' + base + '/tests/screenshots/look/tour/' + r.id + '.png?' + Date.now() + '"></div>').join('') + '</div>', { waitUntil: 'load' });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(L.OUT, 'tour-all.png'), fullPage: true });
  console.log('一共 ' + rows.length + ' 张，出错的 ' + rows.filter(r => r.errs).length + ' 张；最多三角形 ' + Math.max(...rows.map(r => r.tris)) + '；截图在 ' + dir);
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
