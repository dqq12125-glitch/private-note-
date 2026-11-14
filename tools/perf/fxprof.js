// 回声岛 · 战斗特效找卡顿：在 tools/fx.html 里一招一招地放，同时录 Chrome 的 trace（主线程每个任务多长、里面是脚本 / 算样式 / 排版 / 画 / 解码图片 / 垃圾回收，
// 外加 CPU 采样），把超过 --min 毫秒的任务列出来：这个任务里各类事情各占多少、哪些函数最费时间、着色器程序 / 几何体 / 贴图多了几个。
// 用法：node tools/perf/fxprof.js normal-2 grass-2          几招（属性-档，档 0 小招 / 1 中招 / 2 大招 / s 辅助招式）
//       node tools/perf/fxprof.js all                        17 属性 × 小招 / 大招（和 profile.js battle 一样的顺序）
//       node tools/perf/fxprof.js idle --sec 4               站着不动：按函数汇总
//       node tools/perf/fxprof.js sum grass-2 dragon-2       这几招合起来按函数汇总（看放招时每帧的固定开销）
// 参数：--gfx high|mid|low  --throttle 4  --sfx 0|1  --min 33  --top 8  --dpr 2  --warm 2500（开场等多久再开始）  --rig 1（用发布的会动的模型）
//       --repeat 1（每招放几遍，看第二遍还卡不卡）  --quiet（不列每个长任务，只要汇总）  --me id --foe id
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const argv = process.argv.slice(2), opt = { gfx: 'high', throttle: 4, sfx: '0', min: 33, top: 8, dpr: 2, warm: 2500, repeat: 1, sec: 4, me: '', foe: '', quiet: false }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--quiet') opt.quiet = true; else if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
const TYPES = ['normal', 'fire', 'water', 'grass', 'spark', 'ice', 'fight', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
let jobs = pos.length ? pos.slice() : ['all'];
const SUM = jobs[0] === 'sum'; if (SUM) jobs.shift();
if (!jobs.length || jobs[0] === 'all') { jobs = []; TYPES.forEach(t => [0, 2].forEach(k => jobs.push(t + '-' + k))); }
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const r1 = n => Math.round(n * 10) / 10;
const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.cpu_profiler.hires', 'blink.user_timing', '__metadata'];

(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  p.on('pageerror', e => console.log('[err]', e.message));
  p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('[' + m.type() + ']', m.text().slice(0, 200)); });
  const qs = new URLSearchParams({ q: opt.gfx, dpr: opt.dpr, sfx: opt.sfx, w: 420, h: 420 });
  if (opt.me) qs.set('me', opt.me);
  if (opt.foe) qs.set('foe', opt.foe);
  if (opt.rig) qs.set('rig', opt.rig);   // --rig 1：用发布的会动的模型（和游戏里一样）；不加是程序拼的模型
  await p.goto(base + '/tools/fx.html?' + qs);
  await p.waitForFunction(() => window.FXT && window.B3, null, { timeout: 60000 });
  if (opt.sfx === '1') await p.mouse.click(600, 800);   // 点一下页面：没点过不让出声
  await p.waitForTimeout(+opt.warm);
  await p.waitForFunction(() => !B3.fxStats().warm, null, { timeout: 30000 }).catch(() => console.log('开场预热 30 秒还没做完'));
  // 每帧记：间隔、着色器程序数、几何体数、贴图数、特效物件数、粒子数
  await p.evaluate(() => {
    window.__fr = []; let last = performance.now();
    const f = now => { const s = B3.fxStats(); if (window.__frSkip) window.__frSkip = 0; else window.__fr.push([now - last, s.programs, s.mem.geometries, s.mem.textures, s.fx, s.parts]); last = now; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
  const fnKey = cf => (cf.functionName || '(anonymous)') + ' ' + (cf.url || '').split('/').pop().split('?')[0] + ':' + ((cf.lineNumber || 0) + 1) + (/three\.min/.test(cf.url || '') ? ':' + cf.columnNumber : '');
  // 录一段 trace，返回 { 每帧记录, 主线程的任务, 采样 }
  const record = async act => {
    await p.evaluate(() => { window.__fr.length = 0; });
    await b.startTracing(p, { categories: CATS });
    await p.waitForTimeout(250);
    await p.evaluate(() => { window.__fr.length = 0; window.__frSkip = 1; performance.mark('fx-begin'); });   // 开始录的那一帧不算（录制本身会卡一下）
    const t0 = Date.now();
    const ret = await act();
    const sec = (Date.now() - t0) / 1000;
    const fr = await p.evaluate(() => { performance.mark('fx-end'); return window.__fr.slice(); });
    const ev = JSON.parse((await b.stopTracing()).toString()).traceEvents;
    // 主线程：有 FireAnimationFrame 最多的那个线程
    const cnt = {}; ev.forEach(e => { if (e.name === 'FireAnimationFrame') { const k = e.pid + ':' + e.tid; cnt[k] = (cnt[k] || 0) + 1; } });
    const mainK = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0] || '';
    const on = e => e.pid + ':' + e.tid === mainK;
    const mk = n => { const e = ev.find(x => x.name === n && x.cat && x.cat.includes('blink.user_timing')); return e ? e.ts : null; };
    const tA = mk('fx-begin') || 0, tB = mk('fx-end') || Infinity;
    const X = ev.filter(e => on(e) && e.ph === 'X' && e.dur != null && e.ts >= tA && e.ts <= tB).sort((a, c) => a.ts - c.ts || c.dur - a.dur);
    const tasks = X.filter(e => e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask');
    // 采样：ProfileChunk 里的节点和时间
    const nodes = {}, samples = [];
    const starts = {};
    ev.forEach(e => { if (e.name === 'Profile' && e.args && e.args.data) starts[e.id] = e.args.data.startTime; });
    const cur = {};
    ev.filter(e => e.name === 'ProfileChunk').sort((a, c) => a.ts - c.ts).forEach(e => {
      const d = e.args.data, cp = d.cpuProfile || {};
      (cp.nodes || []).forEach(n => { nodes[e.id + ':' + n.id] = { cf: n.callFrame, parent: n.parent != null ? e.id + ':' + n.parent : null }; });
      let t = cur[e.id] != null ? cur[e.id] : (starts[e.id] || e.ts);
      (cp.samples || []).forEach((id, i) => { t += (d.timeDeltas || [])[i] || 0; samples.push({ t, id: e.id + ':' + id, d: (d.timeDeltas || [])[i] || 0 }); });
      cur[e.id] = t;
    });
    samples.sort((a, c) => a.t - c.t);
    return { ret, sec, fr, X, tasks, nodes, samples, tA, tB };
  };
  // 一个时间窗里：各类事情的自身时间（按 trace 事件名）、JS 函数的自身 / 含子时间
  const SKIP = /^(RunTask|ThreadControllerImpl::RunTask|ThreadController::Task|SimpleWatcher::OnHandleReady|Receive mojo message|Closure|PageAnimator::serviceScriptedAnimations|Animation|v8\.callFunction|V8\.DeoptimizeCode|ProfileCall)$/;
  function breakdown(r, a, c) {
    const kinds = {}, stack = [];
    r.X.forEach(e => {
      if (e.ts + e.dur <= a || e.ts >= c) return;
      while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
      const d = Math.min(e.ts + e.dur, c) - Math.max(e.ts, a);
      const par = stack[stack.length - 1];
      if (par) kinds[par.name] = (kinds[par.name] || 0) - d;
      kinds[e.name] = (kinds[e.name] || 0) + d;
      stack.push({ name: e.name, end: e.ts + e.dur });
    });
    const self = {}, tot = {};
    r.samples.forEach(sm => {
      if (sm.t < a || sm.t > c) return;
      const n = r.nodes[sm.id]; if (!n) return;
      const nm = n.cf.functionName;
      if (nm === '(idle)' || nm === '(root)') return;
      const k = fnKey(n.cf); self[k] = (self[k] || 0) + sm.d;
      const seen = new Set(); for (let x = sm.id; x && r.nodes[x]; x = r.nodes[x].parent) { const kk = fnKey(r.nodes[x].cf); if (seen.has(kk)) continue; seen.add(kk); tot[kk] = (tot[kk] || 0) + sm.d; }
    });
    return { kinds, self, tot };
  }
  const top = (o, n, skip) => Object.entries(o).filter(([k, v]) => v > 0 && !(skip && skip.test(k))).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => r1(v / 1000) + 'ms ' + k).join(' | ');
  const table = (bd, sec, n) => {
    const ms = v => String(Math.round(v / 1000)).padStart(6) + 'ms', pc = v => String(r1(v / (sec * 10000))).padStart(5) + '%';
    console.log('-- 各类事情（trace 事件自身时间）--');
    Object.entries(bd.kinds).filter(([k, v]) => v > 500 && !SKIP.test(k)).sort((x, y) => y[1] - x[1]).slice(0, 16).forEach(([k, v]) => console.log(pc(v), ms(v), k));
    console.log('-- 函数自身时间 --');
    Object.entries(bd.self).sort((x, y) => y[1] - x[1]).slice(0, n).forEach(([k, v]) => console.log(pc(v), ms(v), k));
    console.log('-- 函数含子调用 --');
    Object.entries(bd.tot).filter(([k]) => !/^\((root|program)\)/.test(k)).sort((x, y) => y[1] - x[1]).slice(0, n).forEach(([k, v]) => console.log(pc(v), ms(v), k));
  };
  const add = (to, from) => { Object.entries(from).forEach(([k, v]) => { to[k] = (to[k] || 0) + v; }); };
  if (jobs[0] === 'idle') {
    const r = await record(() => p.waitForTimeout(+opt.sec * 1000));
    const busy = r.tasks.reduce((x, e) => x + e.dur, 0);
    console.log(`站着不动 ${opt.gfx} CPU÷${opt.throttle}：${r.sec.toFixed(1)}s 里主线程忙 ${r1(busy / (r.sec * 10000))}%，${r.fr.length} 帧`);
    table(breakdown(r, r.tA, r.tB), r.sec, 45);
  } else {
    const sum = { frames: 0, o33: 0, o50: 0, max: 0 }, all = { kinds: {}, self: {}, tot: {} }; let aSec = 0;
    for (const job of jobs) for (let rep = 0; rep < +opt.repeat; rep++) {
      const [type, tk] = job.split('-');
      const r = await record(() => p.evaluate(([type, tk]) => FXT.run(type, tk === 's' ? 0 : +tk, { support: tk === 's' }), [type, tk]));
      const dts = r.fr.map(x => x[0]), o33 = dts.filter(x => x > 33.4).length, o50 = dts.filter(x => x > 50).length, mx = Math.max(0, ...dts);
      sum.frames += dts.length; sum.o33 += o33; sum.o50 += o50; sum.max = Math.max(sum.max, mx);
      const busy = r.tasks.reduce((x, e) => x + e.dur, 0);
      console.log(`\n== ${job}${rep ? ' (第 ' + (rep + 1) + ' 遍)' : ''}：${dts.length} 帧，最长 ${r1(mx)}ms，超 33ms ${o33}，超 50ms ${o50}，主线程忙 ${r1(busy / (r.sec * 10000))}%；命中 ${r.ret.impact}ms 淡完 ${r.ret.total}ms 粒子峰值 ${r.ret.peak} 程序 ${r.ret.programs}`);
      if (SUM || opt.quiet) { const bd = breakdown(r, r.tA, r.tB); add(all.kinds, bd.kinds); add(all.self, bd.self); add(all.tot, bd.tot); aSec += r.sec; }
      if (SUM) continue;
      // 长帧：第几毫秒、多长、这一帧里程序 / 几何体 / 贴图 / 特效 / 粒子变了多少
      let tt = 0;
      if (!opt.quiet) r.fr.forEach((f, i) => { tt += f[0]; if (f[0] > 50) { const q = r.fr[i - 1] || f; console.log(`   帧 @${Math.round(tt)}ms ${r1(f[0])}ms  程序 ${q[1]}→${f[1]} 几何 ${q[2]}→${f[2]} 贴图 ${q[3]}→${f[3]} 特效 ${q[4]}→${f[4]} 粒子 ${q[5]}→${f[5]}`); } });
      // 长任务
      r.tasks.filter(e => e.dur > +opt.min * 1000).sort((x, y) => y.dur - x.dur).slice(0, opt.quiet ? 2 : 6).forEach(e => {
        const bd = breakdown(r, e.ts, e.ts + e.dur);
        console.log(`   任务 @${Math.round((e.ts - r.tA) / 1000)}ms 长 ${r1(e.dur / 1000)}ms`);
        console.log('      分类：' + top(bd.kinds, 8, SKIP));
        console.log('      自身：' + top(bd.self, +opt.top));
        console.log('      含子：' + top(bd.tot, +opt.top, /^\((root|program)\)|^frame battle3d/));
      });
      await p.waitForTimeout(200);
    }
    console.log(`\n合计 ${jobs.length * +opt.repeat} 招：${sum.frames} 帧，超 33ms ${sum.o33}（${r1(sum.o33 / sum.frames * 100)}%），超 50ms ${sum.o50}，最长 ${r1(sum.max)}ms`);
    if (SUM || opt.quiet) table(all, aSec, 50);
  }
  await b.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
