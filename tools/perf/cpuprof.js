// 回声岛 · 找热点：录一段 CPU 采样，按函数汇总「自身时间」和「含子调用时间」
// 用法：node tools/perf/cpuprof.js walk|idle|battle|home [--map t0] [--gfx high] [--sec 5] [--throttle 4] [--top 30]
//   walk   在地图上来回走      idle  站着不动      home  首页来回切三个标签      battle  打一场野生战斗（自评模式）
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const argv = process.argv.slice(2), opt = { map: 't0', gfx: 'high', sec: 5, throttle: 4, top: 30, how: 'start' }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
const MODE = pos[0] || 'walk';
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const SAVE = gfx => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx, sfx: false, gate: false, music: 0 }, player: { gender: 'girl', name: 'Amy' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 30, xp: 0 }, { uid: 'm2', sp: 'tidalfin', lv: 30, xp: 0 }], team: ['m1', 'm2'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))), daily: {} },
});
(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto(base + '/tools/perf/blank.html');
  await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), SAVE(opt.gfx));
  await p.goto(base + '/index.html');
  await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
  if (MODE !== 'home') {
    await p.click('[data-act=wEnter]'); await p.waitForTimeout(2500);
    if (opt.map !== 't0') { await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [opt.map, opt.how]); await p.waitForTimeout(1500); }
    for (let i = 0; i < 30 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await p.waitForTimeout(120); }
  }
  if (opt.tour) {   // 先把几类地图转一圈再回来（看转过以后会不会变慢）
    for (const [id, how] of [['r0', 'from:t0'], ['i0C', 'mat'], ['i0G', 'mat'], ['c0', 'mat'], ['s7', 'from:t7'], ['u9', 'from:s9'], ['c10', 'from:t10'], ['d6a', 'from:t6'], ['t5', 'door:C'], ['t11', 'door:C'], ['t12', 'door:C'], [opt.map, opt.how]]) {
      await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await p.waitForTimeout(1200);
      for (let i = 0; i < 30 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await p.waitForTimeout(120); }
    }
    console.log('转完一圈：', JSON.stringify(await p.evaluate(() => { const d = EchoWorld._debug(); const i = d.R.info(); return { map: d.M.id, busy: d.busy, dlg: !!d.dlg, x: d.PL.x, y: d.PL.y, geo: i.memory.geometries, tex: i.memory.textures }; })));
  }
  if (MODE === 'battle') { await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('voltlion', 28)] })); await p.waitForTimeout(3500); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
  await cdp.send('Performance.enable');
  const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const m0 = await met();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  const t0 = Date.now(), ms = +opt.sec * 1000;
  if (MODE === 'walk') { const ks = ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']; for (let i = 0; Date.now() - t0 < ms; i++) { const k = ks[i % 4]; await p.keyboard.down(k); await p.waitForTimeout(900); await p.keyboard.up(k); } }
  else if (MODE === 'home') { for (let i = 0; Date.now() - t0 < ms; i++) { const tabs = await p.$$('#tabs > *'); if (tabs.length) await tabs[i % tabs.length].click().catch(() => {}); await p.waitForTimeout(500); } }
  else if (MODE === 'battle') { for (; Date.now() - t0 < ms;) { for (const sel of ['#battle [data-act=bFight]', '#battle [data-act=bMove]', '#battle [data-act=bSelfOk]', '#battle [data-act=bSelfDone]', '#battle .opt', '#battle [data-act=bNext]']) { const e = await p.$(sel); if (e && await e.isVisible()) { await e.click().catch(() => {}); break; } } await p.waitForTimeout(350); } }
  else await p.waitForTimeout(ms);
  const prof = (await cdp.send('Profiler.stop')).profile;
  const sec = (Date.now() - t0) / 1000;
  const m1 = await met();
  const d = k => Math.round((m1[k] - m0[k]) * 1000);
  console.log(`
浏览器自己记的（毫秒 / ${sec.toFixed(1)}s）：脚本 ${d('ScriptDuration')}  算样式 ${d('RecalcStyleDuration')}（${m1.RecalcStyleCount - m0.RecalcStyleCount} 次）  排版 ${d('LayoutDuration')}（${m1.LayoutCount - m0.LayoutCount} 次）  任务合计 ${d('TaskDuration')}  节点 ${m1.Nodes}  JS 内存 ${(m1.JSHeapUsedSize / 1048576).toFixed(1)}MB`);
  const byId = {}; prof.nodes.forEach(n => { byId[n.id] = n; n.self = 0; });
  prof.samples.forEach((id, i) => { byId[id].self += (prof.timeDeltas[i] || 0) / 1000; });
  const parent = {}; prof.nodes.forEach(n => (n.children || []).forEach(c => { parent[c] = n.id; }));
  const key = n => (n.callFrame.functionName || '(anonymous)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + (n.callFrame.lineNumber + 1);
  const self = {}, total = {};
  prof.nodes.forEach(n => {
    if (!n.self) return;
    const k = key(n); self[k] = (self[k] || 0) + n.self;
    const seen = new Set(); for (let id = n.id; id; id = parent[id]) { const kk = key(byId[id]); if (seen.has(kk)) continue; seen.add(kk); total[kk] = (total[kk] || 0) + n.self; }
  });
  const all = Object.values(self).reduce((a, x) => a + x, 0), idle = (self['(idle) :0'] || 0);
  const pct = ms => (ms / (sec * 10)).toFixed(1).padStart(5) + '%';
  console.log(`\n${MODE} ${opt.map} ${opt.gfx}  ${sec.toFixed(1)}s  CPU÷${opt.throttle}  主线程忙 ${pct(all - idle)}`);
  console.log('\n-- 自身时间 --');
  Object.entries(self).filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, +opt.top).forEach(([k, v]) => console.log(pct(v), Math.round(v) + 'ms', k));
  console.log('\n-- 含子调用 --');
  Object.entries(total).filter(([k]) => !/^\((idle|root|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +opt.top).forEach(([k, v]) => console.log(pct(v), Math.round(v) + 'ms', k));
  await b.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
