// 回声岛 · 性能测量（优化前后各跑一遍，对比数字）
// 用真显卡的无头浏览器（--use-angle=d3d11），CPU 降速 4 倍模拟手机，量：
//   start   冷启动：到首页能点要多久、主线程忙了多久、哪个脚本最费时间、JS 内存
//   world   大地图：每类地图一帧要多少毫秒（R.draw 的 CPU 时间）、每秒画几帧、draw call、三角形、显存对象
//   battle  技能特效：每招放的时候最长的一帧、超过 33ms 的帧数、粒子峰值
//   mem     内存：来回切地图、连放特效以后 JS 内存和显存对象涨不涨
// 用法：node tools/perf/profile.js [start,world,battle,mem] [--label base] [--throttle 4] [--gfx high,mid]
// 结果存 tools/perf/out/<label>.json，同时打印一份摘要。不改游戏，只读。
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));

const argv = process.argv.slice(2), opt = { label: 'run', throttle: 4, gfx: 'high,mid' }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
const WHAT = (pos[0] || 'start,world,battle,mem').split(',');
const THROTTLE = +opt.throttle || 1;
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8', svg: 'image/svg+xml' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]);
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(file, (e, buf) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        r.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port }));
  });
}

const SAVE = gfx => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx, sfx: false, gate: false, music: 0 }, player: { gender: 'girl', name: 'Amy' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 30, xp: 0 }, { uid: 'm2', sp: 'tidalfin', lv: 30, xp: 0 }], team: ['m1', 'm2'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))), daily: {} },
});
const TOUR = [['t0', 'start'], ['r0', 'from:t0'], ['i0C', 'mat'], ['i0G', 'mat'], ['c0', 'mat'], ['s7', 'from:t7'], ['u9', 'from:s9'], ['c10', 'from:t10'], ['d6a', 'from:t6'], ['t5', 'door:C'], ['t11', 'door:C'], ['t12', 'door:C']];
const TYPES = ['normal', 'fire', 'water', 'grass', 'spark', 'ice', 'fight', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
const r1 = n => Math.round(n * 10) / 10;

(async () => {
  const { s, base } = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
  const out = { label: opt.label, when: new Date().toISOString(), throttle: THROTTLE };
  const newPage = async (vp, dsf) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 420, height: 920 }, deviceScaleFactor: dsf || 3 });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Performance.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const gc = async () => { await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(150); };
    return { ctx, p, cdp, errs, metrics, gc };
  };
  out.gpu = await (async () => { const t = await newPage(); const r = await t.p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; }); await t.ctx.close(); return r; })();

  // ---------- 冷启动 ----------
  if (WHAT.includes('start')) {
    const runs = [];
    for (let k = 0; k < 3; k++) {
      const t = await newPage();
      await t.p.goto(base + '/tools/perf/blank.html').catch(() => {});
      await t.p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), SAVE('high')).catch(() => {});
      await t.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const bytes = {}; let total = 0;
      t.cdp.on('Network.loadingFinished', e => { total += e.encodedDataLength; });
      t.cdp.on('Network.responseReceived', e => { bytes[e.requestId] = e.response.url; });
      if (k === 0) await t.cdp.send('Profiler.enable'), await t.cdp.send('Profiler.start');
      const t0 = Date.now();
      await t.p.goto(base + '/index.html', { waitUntil: 'commit' });
      await t.p.waitForFunction(() => document.querySelector('#tabs') && document.querySelector('#tabs').children.length > 0 && document.querySelector('[data-act=wEnter], #mon-home *'), null, { timeout: 60000 });
      const home = Date.now() - t0;
      const nav = await t.p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, res: performance.getEntriesByType('resource').length }; });
      const m = await t.metrics();
      const run = { homeMs: home, dclMs: Math.round(nav.dcl), requests: nav.res, kb: Math.round(total / 1024), scriptMs: Math.round(m.ScriptDuration * 1000), layoutMs: Math.round((m.LayoutDuration + m.RecalcStyleDuration) * 1000), taskMs: Math.round(m.TaskDuration * 1000), heapMB: r1(m.JSHeapUsedSize / 1048576), nodes: m.Nodes };
      if (k === 0) {
        const prof = (await t.cdp.send('Profiler.stop')).profile;
        const dt = prof.timeDeltas, self = {}; const byId = {}; prof.nodes.forEach(n => { byId[n.id] = n; });
        prof.samples.forEach((id, i) => { const n = byId[id]; const u = (n.callFrame.url || '').replace(base, '') || '(' + n.callFrame.functionName + ')'; self[u] = (self[u] || 0) + (dt[i] || 0) / 1000; });
        run.byScript = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([u, ms]) => [u, Math.round(ms)]);
      }
      // 进大地图要多久（点「继续冒险」到第一帧画出来）
      const t1 = Date.now();
      await t.p.click('[data-act=wEnter]');
      await t.p.waitForFunction(() => { try { const d = EchoWorld._debug(); return d.R && d.R.kind && d.M && d.R.info && d.R.info().render.frame > 2; } catch (e) { return false; } }, null, { timeout: 60000 }).catch(() => {});
      run.enterWorldMs = Date.now() - t1;
      run.errs = t.errs.slice(0, 3);
      runs.push(run);
      await t.ctx.close();
    }
    out.start = runs;
    console.log('\n== 冷启动（CPU ÷' + THROTTLE + '）==');
    runs.forEach((r, i) => console.log(`  #${i + 1} 首页 ${r.homeMs}ms  DCL ${r.dclMs}ms  脚本 ${r.scriptMs}ms  排版 ${r.layoutMs}ms  请求 ${r.requests} 个 ${r.kb}KB  内存 ${r.heapMB}MB  节点 ${r.nodes}  进大地图 ${r.enterWorldMs}ms`));
    console.log('  最费时间的脚本（自身时间，ms）：', runs[0].byScript.map(x => x[0].split('/').pop() + ' ' + x[1]).join(' · '));
  }

  // ---------- 大地图 ----------
  const enterWorld = async (t, gfx) => {
    await t.p.goto(base + '/tools/perf/blank.html').catch(() => {});
    await t.p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), SAVE(gfx));
    await t.p.goto(base + '/index.html');
    await t.p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
    await t.p.click('[data-act=wEnter]');
    await t.p.waitForTimeout(2500);
    // 把 R.draw 包一层：记每次画的 CPU 时间
    await t.p.evaluate(() => {
      window.__pf = { n: 0, sum: 0, max: 0, long: 0 };
      const hook = () => { const R = EchoWorld._debug().R; if (!R || R.__pf) return; const d = R.draw; R.__pf = 1; R.draw = function () { const a = performance.now(); const v = d.apply(this, arguments); const ms = performance.now() - a; const P = window.__pf; P.n++; P.sum += ms; if (ms > P.max) P.max = ms; if (ms > 16.7) P.long++; return v; }; };
      hook(); window.__pfHook = hook;
    });
  };
  const closeDlg = async t => { for (let i = 0; i < 40 && await t.p.evaluate(() => !!EchoWorld._debug().dlg); i++) { const sk = await t.p.$('#w-dlg [data-act=wSkip]'); if (sk) await sk.click().catch(() => {}); else await t.p.evaluate(() => { const a = document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await t.p.waitForTimeout(120); } };
  const sample = async (t, ms, act) => {
    await t.p.evaluate(() => { window.__pfHook(); Object.assign(window.__pf, { n: 0, sum: 0, max: 0, long: 0 }); });
    const m0 = await t.metrics(), a = Date.now();
    if (act) await act(); else await t.p.waitForTimeout(ms);
    const sec = (Date.now() - a) / 1000, m1 = await t.metrics();
    const pf = await t.p.evaluate(() => { const i = EchoWorld._debug().R.info ? EchoWorld._debug().R.info() : null; return { pf: window.__pf, calls: i && i.render.calls, tris: i && i.render.triangles, geo: i && i.memory.geometries, tex: i && i.memory.textures, prog: i && i.programs ? i.programs.length : 0 }; });
    return { fps: r1(pf.pf.n / sec), drawMs: r1(pf.pf.sum / Math.max(1, pf.pf.n)), maxMs: r1(pf.pf.max), over16: pf.pf.long, busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / sec * 100), calls: pf.calls, tris: pf.tris, geo: pf.geo, tex: pf.tex, prog: pf.prog };
  };
  if (WHAT.includes('world')) {
    out.world = {};
    for (const gfx of opt.gfx.split(',')) {
      const t = await newPage();
      await enterWorld(t, gfx);
      await t.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const rows = {};
      // 走路：刚进第一座小镇就来回走 4 秒（要在转地图之前量：转到后面几座岛会触发剧情 / 战斗，那时候量到的就不是走路了）
      rows['t0 走路'] = await sample(t, 0, async () => { for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) { await t.p.keyboard.down(k); await t.p.waitForTimeout(1000); await t.p.keyboard.up(k); } });
      for (const [id, how] of TOUR) {
        const a = Date.now();
        await t.p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]);
        await t.p.waitForFunction(id => EchoWorld._debug().M.id === id, id, { timeout: 20000 }).catch(() => {});
        const loadMs = Date.now() - a;
        await t.p.waitForTimeout(1200); await closeDlg(t);
        rows[id] = Object.assign({ loadMs }, await sample(t, 2500));
      }
      rows.heapMB = r1((await t.metrics()).JSHeapUsedSize / 1048576);
      rows.errs = t.errs.slice(0, 3);
      out.world[gfx] = rows;
      await t.ctx.close();
      console.log('\n== 大地图 · 画质 ' + gfx + '（CPU ÷' + THROTTLE + '）==');
      Object.entries(rows).forEach(([k, v]) => { if (v && v.fps !== undefined) console.log(`  ${k.padEnd(8)} 每秒 ${String(v.fps).padStart(5)} 帧  一帧 ${String(v.drawMs).padStart(5)}ms（最长 ${v.maxMs}，超 16.7ms ${v.over16} 次） 主线程 ${v.busyPct}%  draw ${v.calls}  三角形 ${v.tris}  几何 ${v.geo} 贴图 ${v.tex} 程序 ${v.prog}${v.loadMs ? '  切图 ' + v.loadMs + 'ms' : ''}`); });
      console.log('  JS 内存 ' + rows.heapMB + 'MB', rows.errs.length ? ' 报错 ' + JSON.stringify(rows.errs) : '');
    }
  }

  // ---------- 技能特效 ----------
  if (WHAT.includes('battle')) {
    out.battle = {};
    for (const q of opt.gfx.split(',')) {
      const t = await newPage({ width: 420, height: 920 }, 1);
      await t.p.goto(base + '/tools/fx.html?q=' + q + '&dpr=2&sfx=0&w=420&h=420');
      await t.p.waitForFunction(() => window.FXT && window.B3, null, { timeout: 60000 });
      await t.p.waitForTimeout(2500);
      await t.p.evaluate(() => { window.__fr = []; let last = performance.now(); const f = now => { window.__fr.push(now - last); last = now; requestAnimationFrame(f); }; requestAnimationFrame(f); });
      await t.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const rows = {};
      // 先量站着不动
      { await t.p.evaluate(() => { window.__fr.length = 0; }); const m0 = await t.metrics(); await t.p.waitForTimeout(2000); const m1 = await t.metrics(); const fr = await t.p.evaluate(() => window.__fr.slice()); rows.idle = { busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / 2 * 100), fps: r1(fr.length / 2), mem: await t.p.evaluate(() => B3.fxStats().mem) }; }
      for (const type of TYPES) for (const tier of [0, 2]) {
        await t.p.evaluate(() => { window.__fr.length = 0; });
        const m0 = await t.metrics(), a = Date.now();
        const st = await t.p.evaluate(([type, tier]) => FXT.run(type, tier), [type, tier]).catch(e => ({ err: e.message.split('\n')[0] }));
        const sec = (Date.now() - a) / 1000, m1 = await t.metrics();
        const fr = await t.p.evaluate(() => window.__fr.slice());
        rows[type + '-' + tier] = { ms: st.total, peak: st.peak, maxFrame: r1(Math.max(0, ...fr)), over33: fr.filter(x => x > 33.4).length, over50: fr.filter(x => x > 50).length, frames: fr.length, busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / sec * 100), err: st.err };
        await t.p.waitForTimeout(200);
      }
      rows.memEnd = await t.p.evaluate(() => { const s = B3.fxStats(); return Object.assign({ programs: s.programs }, s.mem); });
      rows.heapMB = r1((await t.metrics()).JSHeapUsedSize / 1048576);
      rows.errs = t.errs.slice(0, 3);
      out.battle[q] = rows;
      await t.ctx.close();
      console.log('\n== 技能特效 · 画质 ' + q + '（CPU ÷' + THROTTLE + '）==');
      console.log(`  站着不动：主线程 ${rows.idle.busyPct}%  每秒 ${rows.idle.fps} 帧  显存 ${JSON.stringify(rows.idle.mem)}`);
      const list = Object.entries(rows).filter(([k, v]) => v && v.maxFrame !== undefined);
      list.sort((a, b) => b[1].maxFrame - a[1].maxFrame).slice(0, 12).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} 最长一帧 ${String(v.maxFrame).padStart(6)}ms  超 33ms ${String(v.over33).padStart(3)} 帧  超 50ms ${String(v.over50).padStart(3)} 帧 / ${v.frames}  主线程 ${v.busyPct}%  粒子峰值 ${v.peak}${v.err ? '  出错 ' + v.err : ''}`));
      const tot = list.reduce((s, [, v]) => ({ f: s.f + v.frames, a: s.a + v.over33, b: s.b + v.over50 }), { f: 0, a: 0, b: 0 });
      console.log(`  合计 ${list.length} 招：${tot.f} 帧里超 33ms 的 ${tot.a} 帧（${r1(tot.a / tot.f * 100)}%），超 50ms 的 ${tot.b} 帧；放完显存 ${JSON.stringify(rows.memEnd)}，JS 内存 ${rows.heapMB}MB`);
    }
  }

  // ---------- 内存 ----------
  if (WHAT.includes('mem')) {
    const t = await newPage();
    await enterWorld(t, 'high');
    const snap = async () => { await t.gc(); const m = await t.metrics(); const i = await t.p.evaluate(() => { const i = EchoWorld._debug().R.info(); return { geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs ? i.programs.length : 0 }; }); return { heapMB: r1(m.JSHeapUsedSize / 1048576), nodes: m.Nodes, listeners: m.JSEventListeners, geo: i.geo, tex: i.tex, prog: i.prog }; };
    const rows = [];
    for (let round = 0; round < 4; round++) {
      for (const [id, how] of TOUR.slice(0, 9)) { await t.p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await t.p.waitForTimeout(450); await closeDlg(t); }   // 只转前 9 张：后面几座岛进去会触发剧情战斗，战斗开着再硬切地图会把页面搞崩（正常玩碰不到）；真要查漏用 leak.js
      await t.p.evaluate(() => EchoWorld._debug().goMap('t0', 'start')); await t.p.waitForTimeout(700); await closeDlg(t);
      rows.push(await snap());
    }
    out.mem = { rounds: rows, errs: t.errs.slice(0, 3) };
    await t.ctx.close();
    console.log('\n== 内存（把 12 张地图转 4 圈，每圈结束回第一座小镇）==');
    rows.forEach((r, i) => console.log(`  第 ${i + 1} 圈后：JS ${r.heapMB}MB  节点 ${r.nodes}  监听 ${r.listeners}  几何 ${r.geo}  贴图 ${r.tex}  程序 ${r.prog}`));
  }

  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', opt.label + '.json'), JSON.stringify(out, null, 1));
  console.log('\n存到 tools/perf/out/' + opt.label + '.json');
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
