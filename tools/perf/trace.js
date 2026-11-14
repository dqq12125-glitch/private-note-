// 回声岛 · 启动时浏览器在忙什么：录一段 timeline，按事件名汇总（算样式、排版、解析样式表、画、解码图片、字体……）
// 用法：node tools/perf/trace.js [--throttle 4] [--url index.html] [--top 25]
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const argv = process.argv.slice(2), opt = { throttle: 4, url: 'index.html', top: 25 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto(base + '/tools/perf/blank.html');
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx: 'high', sfx: false, gate: false, music: 0 }, player: { gender: 'girl', name: 'Amy' }, mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 30, xp: 0 }], team: ['m1'], dex: { emberpup: 'caught' } }, world: { v: 3, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} } })));
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
  const ev = [];
  cdp.on('Tracing.dataCollected', d => ev.push(...d.value));
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['devtools.timeline', 'blink.user_timing', 'loading', 'disabled-by-default-devtools.timeline'] }, transferMode: 'ReportEvents' });
  const t0 = Date.now();
  await p.goto(base + '/' + opt.url, { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelector('#tabs') && document.querySelector('#tabs').children.length > 0, null, { timeout: 60000 }).catch(() => {});
  const home = Date.now() - t0;
  await p.waitForTimeout(1500);
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); await done;
  // 只看主线程（事件最多的那个渲染线程）
  const byT = {}; ev.forEach(e => { if (e.ph === 'X' && e.dur) { const k = e.pid + ':' + e.tid; byT[k] = (byT[k] || 0) + 1; } });
  const hit = ev.find(e => e.name === 'EvaluateScript' || e.name === 'ParseHTML');
  const main = hit ? hit.pid + ':' + hit.tid : Object.entries(byT).sort((a, c) => c[1] - a[1])[0][0];
  const X = ev.filter(e => e.ph === 'X' && e.dur && e.pid + ':' + e.tid === main).sort((a, c) => a.ts - c.ts);
  // 自身时间：减掉嵌在里面的子事件
  const stack = [], self = {}, cnt = {}, detail = {};
  X.forEach(e => {
    while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
    if (stack.length) stack[stack.length - 1].child += e.dur;
    const it = { e, end: e.ts + e.dur, child: 0 }; stack.push(it);
    it.done = () => { const sf = (e.dur - it.child) / 1000; self[e.name] = (self[e.name] || 0) + sf; cnt[e.name] = (cnt[e.name] || 0) + 1; const a = e.args || {}, d = a.data || a.beginData || {}; const tag = d.url || d.styleSheetUrl || d.scriptName || (d.stackTrace && d.stackTrace[0] && d.stackTrace[0].url + ':' + d.stackTrace[0].lineNumber) || ''; if (tag && sf > 1) { const k = e.name + ' ' + String(tag).replace(base, '').slice(0, 80); detail[k] = (detail[k] || 0) + sf; } };
    it.done();
  });
  // 上面 done 时 child 还没加全，重算一遍：两趟
  Object.keys(self).forEach(k => { self[k] = 0; cnt[k] = 0; }); Object.keys(detail).forEach(k => { delete detail[k]; });
  const st2 = [], items = [];
  X.forEach(e => { while (st2.length && st2[st2.length - 1].end <= e.ts) st2.pop(); const it = { e, end: e.ts + e.dur, child: 0 }; if (st2.length) st2[st2.length - 1].child += e.dur; st2.push(it); items.push(it); });
  items.forEach(it => { const e = it.e, sf = Math.max(0, e.dur - it.child) / 1000; self[e.name] = (self[e.name] || 0) + sf; cnt[e.name] = (cnt[e.name] || 0) + 1; const a = e.args || {}, d = a.data || a.beginData || {}; const tag = d.url || d.styleSheetUrl || d.scriptName || (d.stackTrace && d.stackTrace[0] && (d.stackTrace[0].url || '') + ':' + d.stackTrace[0].lineNumber) || ''; if (sf > 2) { const k = e.name + (tag ? ' ' + String(tag).replace(base, '').slice(0, 90) : ''); detail[k] = (detail[k] || 0) + sf; } });
  console.log(`首页 ${home}ms（CPU÷${opt.throttle}）；主线程事件自身时间（ms）：`);
  Object.entries(self).sort((a, c) => c[1] - a[1]).slice(0, +opt.top).forEach(([k, v]) => console.log(String(Math.round(v)).padStart(6), String(cnt[k]).padStart(5) + ' 次', k));
  console.log('\n单项较大的：');
  Object.entries(detail).sort((a, c) => c[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(String(Math.round(v)).padStart(6), k));
  // 最长的几次排版 / 算样式，是谁触发的
  console.log('\n最长的排版 / 算样式：');
  items.filter(it => /^(Layout|UpdateLayoutTree|RecalculateStyles)$/.test(it.e.name)).sort((a, c) => c.e.dur - a.e.dur).slice(0, 8).forEach(it => { const d = (it.e.args.beginData || it.e.args.data || {}); const st = (d.stackTrace || [])[0]; console.log(String(Math.round(it.e.dur / 1000)).padStart(6), it.e.name, st ? (st.functionName + ' ' + (st.url || '').replace(base, '') + ':' + st.lineNumber) : '', it.e.args.elementCount || (d.dirtyObjects !== undefined ? '脏 ' + d.dirtyObjects + '/' + d.totalObjects : '')); });
  await b.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
