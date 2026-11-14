// 怪兽模型对比：把两个目录里同名的 glb（A = 参照，一般是现在发布的；B = 候选）在真显卡的无头浏览器里
// 用游戏自己的材质各画一遍（tools/mon3d/vdiff.html：3 个角度 × 待机/出招/倒下 + 走路、受击），算轮廓重合度和像素差，
// 把差别最大的几只存成并排的对比图（A | B | 差别热力图）给人看。改 publish.js 的压缩设置前后用它核对。
// 用法：
//   node tools/mon3d/vdiff.js --a assets/mon3d --b <候选目录> [--ids flamewolf,buzzbee | --sample 文件.json] [--label 名字]
//        [--out tools/mon3d/_vdiff] [--size 480] [--sheets 6] [--sheet-ids a,b] [--views front:idle,me:attack] [--zoom] [--shiny] [--jobs 2]
//        （--sheets 最差的几只出图；--sheet-ids 指定的也出图；--views 图里放哪几个角度:姿势，不写就放差别最大的 3 个；--shiny 用稀有色画）
//   node tools/mon3d/vdiff.js --a <目录> --b <目录> --loadtime [--ids …] [--throttle 4] [--runs 3]     量加载时间（下载到画出第一帧）
// 不写 --ids / --sample 就比 B 目录里全部。结果：<out>/<label>.json + <out>/<label>-<id>.png
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));

const argv = process.argv.slice(2), opt = { a: 'assets/mon3d', out: 'tools/mon3d/_vdiff', size: 480, sheets: 6, label: 'run', jobs: 2, throttle: 4, runs: 3 };
for (let i = 0; i < argv.length; i++) { const k = argv[i].slice(2); if (['zoom', 'shiny', 'loadtime', 'quiet'].includes(k)) opt[k] = true; else opt[k] = argv[++i]; }
if (!opt.b) { console.log('用法：node tools/mon3d/vdiff.js --a assets/mon3d --b <候选目录> [--ids a,b] [--label 名字]（详见文件开头）'); process.exit(2); }
const abs = p => path.isAbsolute(p) ? p : path.join(ROOT, p);
const DIR = { a: abs(opt.a), b: abs(opt.b) }, OUT = abs(opt.out);
const glbs = d => fs.readdirSync(d).filter(f => f.endsWith('.glb') && !f.includes('.tmp.')).map(f => f.slice(0, -4));
let ids = opt.ids ? opt.ids.split(',') : opt.sample ? JSON.parse(fs.readFileSync(abs(opt.sample), 'utf8')) : glbs(DIR.b);
ids = ids.filter(id => fs.existsSync(path.join(DIR.a, id + '.glb')) && fs.existsSync(path.join(DIR.b, id + '.glb')));
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', png: 'image/png' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]);
      let file = path.join(ROOT, rel);
      // 索引：每只怪兽有 ~a、~b 两份；2D 图标一张都不给（全用模型）
      if (rel === '/assets/mon3d/index.json') { r.writeHead(200, { 'Content-Type': MIME.json }); return r.end(JSON.stringify(ids.flatMap(id => [id + '~a', id + '~b']))); }
      if (rel === '/assets/mon2d/index.json') { r.writeHead(200, { 'Content-Type': MIME.json }); return r.end('[]'); }
      const m = /^\/assets\/mon3d\/(.+)~([ab])\.glb$/.exec(rel);
      if (m) file = path.join(DIR[m[2]], m[1] + '.glb');
      else if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(file, (e, buf) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        r.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port }));
  });
}
const savePng = (file, dataUrl) => { if (dataUrl) fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64')); };
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { s, base } = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 700 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(base + '/tools/mon3d/vdiff.html?size=' + opt.size);
    await p.waitForFunction(() => window.VD);
    return { ctx, p, errs };
  };

  // ---------- 加载时间 ----------
  if (opt.loadtime) {
    const rows = {};
    for (let run = 0; run < +opt.runs; run++) {
      for (const which of ['a', 'b']) {
        const t = await open();
        const cdp = await t.ctx.newCDPSession(t.p);
        // 先不降速读一只别的，把解码器、着色器准备好（不算在里面）
        await t.p.evaluate(([id, w]) => VD.loadTime(id, w), [ids[ids.length - 1], which === 'a' ? 'b' : 'a']);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
        for (const id of ids) {
          const r = await t.p.evaluate(([i, w]) => VD.loadTime(i, w), [id, which]);
          if (r) ((rows[id] = rows[id] || { a: [], b: [], af: [], bf: [] })[which].push(r.total), rows[id][which + 'f'].push(r.first));
        }
        await t.ctx.close();
      }
    }
    const out = ids.map(id => ({ id, a: +med(rows[id].a).toFixed(1), b: +med(rows[id].b).toFixed(1), aFirst: +med(rows[id].af).toFixed(1), bFirst: +med(rows[id].bf).toFixed(1), aKB: Math.round(fs.statSync(path.join(DIR.a, id + '.glb')).size / 1024), bKB: Math.round(fs.statSync(path.join(DIR.b, id + '.glb')).size / 1024) }));
    const avg = k => out.reduce((x, r) => x + r[k], 0) / out.length;
    console.log('加载时间（CPU 降速 ' + opt.throttle + ' 倍，每只 ' + opt.runs + ' 次取中间值，毫秒：下载到画出第一帧）');
    out.forEach(r => console.log('  ' + r.id.padEnd(14), 'A', String(r.a).padStart(6), '(' + r.aKB + 'KB)', ' B', String(r.b).padStart(6), '(' + r.bKB + 'KB)'));
    console.log('  平均 A ' + avg('a').toFixed(1) + ' ms → B ' + avg('b').toFixed(1) + ' ms（' + ((avg('b') / avg('a') - 1) * 100).toFixed(0) + '%）；其中建模型 + 第一帧 A ' + avg('aFirst').toFixed(1) + ' → B ' + avg('bFirst').toFixed(1));
    fs.writeFileSync(path.join(OUT, opt.label + '-loadtime.json'), JSON.stringify({ throttle: +opt.throttle, runs: +opt.runs, rows: out }, null, 1));
    await browser.close(); s.close();
    return;
  }

  // ---------- 画面对比 ----------
  const res = [], allErrs = [];
  const queue = ids.slice();
  const want = new Set((opt['sheet-ids'] || '').split(',').filter(Boolean));
  const pending = [];   // 留在页面里等出图的 { id, page }
  await Promise.all([...Array(Math.max(1, Math.min(4, +opt.jobs)))].map(async () => {
    const t = await open();
    let id;
    while ((id = queue.shift())) {
      const r = await t.p.evaluate(([i, sh]) => VD.compare(i, { shiny: sh }), [id, !!opt.shiny]).catch(e => ({ id, err: String(e.message || e) }));
      if (r.views) {
        const W = k => Math.max(...r.views.map(v => v[k])), L = k => Math.min(...r.views.map(v => v[k]));
        r.worst = { iou: L('iou'), mad: W('mad'), p99: W('p99'), blk: W('blk'), ssim: L('ssim') };
        r.mean = { iou: r.views.reduce((x, v) => x + v.iou, 0) / r.views.length, mad: r.views.reduce((x, v) => x + v.mad, 0) / r.views.length, ssim: r.views.reduce((x, v) => x + v.ssim, 0) / r.views.length };
      }
      r.aKB = +(fs.statSync(path.join(DIR.a, id + '.glb')).size / 1024).toFixed(1); r.bKB = +(fs.statSync(path.join(DIR.b, id + '.glb')).size / 1024).toFixed(1);
      res.push(r);
      pending.push({ id, t });
      // 页面里只留最近的几只（每只 11 个角度的像素，占内存），留着的里面挑最差的出图
      if (pending.filter(x => x.t === t).length > 40) {
        const mine = pending.filter(x => x.t === t), keep = new Set(mine.map(x => res.find(q => q.id === x.id)).filter(q => q.worst).sort((x, y) => y.worst.blk - x.worst.blk).slice(0, +opt.sheets + 4).map(q => q.id));
        for (const x of mine) if (!keep.has(x.id) && !want.has(x.id)) { await t.p.evaluate(i => VD.forget(i), x.id); pending.splice(pending.indexOf(x), 1); }
      }
      if (t.errs.length) { allErrs.push(...t.errs.splice(0).map(e => id + ': ' + e)); }
    }
  }));
  const ok = res.filter(r => r.worst), bad = res.filter(r => !r.worst);
  ok.sort((x, y) => y.worst.blk - x.worst.blk);
  // 出图：最差小块最大的 N 只 + 轮廓最不重合的 2 只 + 指定的
  const pick = new Set([...ok.slice(0, +opt.sheets).map(r => r.id), ...ok.slice().sort((x, y) => x.worst.iou - y.worst.iou).slice(0, 2).map(r => r.id), ...want]);
  for (const id of pick) {
    const x = pending.find(q => q.id === id); if (!x) continue;
    savePng(path.join(OUT, opt.label + '-' + id + '.png'), await x.t.p.evaluate(([i, pk]) => VD.sheet(i, 3, pk), [id, opt.views ? opt.views.split(',') : null]));
    if (opt.zoom) savePng(path.join(OUT, opt.label + '-' + id + '-zoom.png'), await x.t.p.evaluate(i => VD.zoom(i), id));
  }
  const sumA = ok.reduce((x, r) => x + r.aKB, 0), sumB = ok.reduce((x, r) => x + r.bKB, 0);
  const avg = f => ok.reduce((x, r) => x + f(r), 0) / (ok.length || 1);
  const summary = {
    label: opt.label, n: ok.length, size: +opt.size, aKB: +(sumA / ok.length).toFixed(1), bKB: +(sumB / ok.length).toFixed(1), saved: +((1 - sumB / sumA) * 100).toFixed(1),
    worst: { iou: Math.min(...ok.map(r => r.worst.iou)), mad: Math.max(...ok.map(r => r.worst.mad)), p99: Math.max(...ok.map(r => r.worst.p99)), blk: Math.max(...ok.map(r => r.worst.blk)), ssim: Math.min(...ok.map(r => r.worst.ssim)) },
    mean: { iou: +avg(r => r.mean.iou).toFixed(4), mad: +avg(r => r.mean.mad).toFixed(3), ssim: +avg(r => r.mean.ssim).toFixed(4), blk: +avg(r => r.worst.blk).toFixed(2), p99: +avg(r => r.worst.p99).toFixed(2) },
    tris: [Math.round(avg(r => r.a.tris)), Math.round(avg(r => r.b.tris))], verts: [Math.round(avg(r => r.a.verts)), Math.round(avg(r => r.b.verts))], tracks: [Math.round(avg(r => r.a.tracks)), Math.round(avg(r => r.b.tracks))],
    // 动作、骨骼有没有对不上的
    mismatch: ok.filter(r => r.a.clips !== r.b.clips || r.a.bones !== r.b.bones || r.a.dur.some((d, i) => Math.abs(d - r.b.dur[i]) > .002)).map(r => r.id),
    failed: bad.map(r => r.id + ': ' + r.err), errors: allErrs.slice(0, 20),
  };
  fs.writeFileSync(path.join(OUT, opt.label + '.json'), JSON.stringify({ summary, rows: ok.map(r => ({ id: r.id, aKB: r.aKB, bKB: r.bKB, a: r.a, b: r.b, worst: r.worst, mean: r.mean, views: r.views })) }));
  if (!opt.quiet) {
    console.log('id'.padEnd(14), ' A KB  B KB  三角形   IoU最低 平均差 p99   小块  SSIM   最差的角度');
    for (const r of ok.slice(0, 12)) { const w = r.views.slice().sort((x, y) => y.blk - x.blk)[0]; console.log(r.id.padEnd(14), String(Math.round(r.aKB)).padStart(5), String(Math.round(r.bKB)).padStart(5), String(r.b.tris).padStart(6), '  ', r.worst.iou.toFixed(3), r.worst.mad.toFixed(2).padStart(6), r.worst.p99.toFixed(1).padStart(5), r.worst.blk.toFixed(1).padStart(5), r.worst.ssim.toFixed(3), ' ', w.ang + '/' + w.pose); }
  }
  console.log(JSON.stringify(summary));
  await browser.close(); s.close();
  if (bad.length || summary.mismatch.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
