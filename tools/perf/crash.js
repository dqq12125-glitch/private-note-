// 回声岛 · 找切地图崩溃：一张张切，每次记下内存，直到崩
// 用法：node tools/perf/crash.js [--gfx high] [--wait 450] [--rounds 6] [--gpu 1|0] [--maps t0,r0,...]
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const argv = process.argv.slice(2), opt = { gfx: 'high', wait: 450, rounds: 6, gpu: 1, dsf: 3 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const SAVE = gfx => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx, sfx: false, gate: false, music: 0 }, player: { gender: 'girl', name: 'Amy' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 30, xp: 0 }, { uid: 'm2', sp: 'tidalfin', lv: 30, xp: 0 }], team: ['m1', 'm2'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))), daily: {} },
});
const TOUR = opt.maps ? opt.maps.split(',').map(m => m.split('@')) : [['t0', 'start'], ['r0', 'from:t0'], ['i0C', 'mat'], ['i0G', 'mat'], ['c0', 'mat'], ['s7', 'from:t7'], ['u9', 'from:s9'], ['c10', 'from:t10'], ['d6a', 'from:t6'], ['t5', 'door:C'], ['t11', 'door:C'], ['t12', 'door:C']];
(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch({ args: +opt.gpu ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: +opt.dsf });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  let crashed = false; p.on('crash', () => { crashed = true; console.log('!! 页面崩了'); });
  p.on('pageerror', e => console.log('[err]', e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' || /context|lost|WebGL/i.test(m.text())) console.log('[console]', m.text().slice(0, 200)); });
  await p.goto(base + '/tools/perf/blank.html');
  await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), SAVE(opt.gfx));
  await p.goto(base + '/index.html');
  await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
  await p.click('[data-act=wEnter]'); await p.waitForTimeout(2500);
  const bro = await b.newBrowserCDPSession();
  const procMB = async () => { try { const r = await bro.send('SystemInfo.getProcessInfo'); return r.processInfo.map(x => x.type[0] + ':' + Math.round((x.privateMemory || x.cpuTime || 0) / 1048576)).join(' '); } catch (e) { return ''; } };
  let n = 0;
  outer: for (let round = 0; round < +opt.rounds; round++) for (const [id, how] of TOUR) {
    n++;
    try {
      await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how || 'start'), [id, how]);
      await p.waitForTimeout(+opt.wait);
      for (let i = 0; i < 30 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await p.waitForTimeout(100); }
      const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
      const st = await p.evaluate(() => { const d = EchoWorld._debug(); const i = d.R.info(); const cv = [...document.querySelectorAll('canvas')]; return { kind: d.R.kind, tier: d.R.tier, geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs ? i.programs.length : 0, canv: cv.length, px: Math.round(cv.reduce((a, c) => a + c.width * c.height, 0) / 1e6 * 10) / 10, busy: d.busy, gl: d.R.glState ? d.R.glState() : '' }; });
      console.log(`#${String(n).padStart(3)} ${id.padEnd(5)} JS ${(m.JSHeapUsedSize / 1048576).toFixed(1)}MB 节点 ${m.Nodes} 监听 ${m.JSEventListeners}  ${JSON.stringify(st)}  ${await procMB()}`);
    } catch (e) { console.log(`#${n} ${id} 出错：${e.message.split('\n')[0]}`); break outer; }
    if (crashed) break outer;
  }
  console.log(crashed ? '结果：崩了，在第 ' + n + ' 次' : '结果：没崩，切了 ' + n + ' 次');
  await b.close().catch(() => {}); s.close();
})().catch(e => { console.error(e.message); process.exit(1); });
