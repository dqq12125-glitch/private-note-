// 回声岛 · 存档越大会不会越卡：用很小的存档和「玩了 1 年 / 3 年」的大存档（bigsave.js）各量一遍
//   ① 打开游戏要多久、localStorage 一共占了多少字（存档 + 备份 + 其他）
//   ② 存一次要多久（JSON.stringify + localStorage.setItem），CPU 降速 4 倍
//   ③ 在第一座小镇来回走 10 秒：每一帧隔多久（超过 20ms / 33ms / 50ms 的帧数）、这 10 秒里往 localStorage 写了几次、一共写了多少毫秒
// 用法：node tools/perf/saveperf.js [--label before] [--saves tiny,1y,3y] [--throttle 4] [--gfx high] [--sec 10] [--full 1]
//   --full 1：让游戏照老办法每走一步都整份存一次（RT.walkFull 调到很大），和现在的做法在同一台机器、同一时刻对比
// 结果存 tools/perf/out/save-<label>.json
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const BS = require('./bigsave');
const argv = process.argv.slice(2), opt = { label: 'run', saves: 'tiny,1y,3y', throttle: 4, gfx: 'high', sec: 10 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); } fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const r1 = n => Math.round(n * 10) / 10, med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const SAVES = { tiny: () => BS.tiny(opt.gfx), '1y': () => BS.build(1, { gfx: opt.gfx }), '3y': () => BS.build(3, { gfx: opt.gfx }) };

(async () => {
  const { s, base } = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const out = { label: opt.label, when: new Date().toISOString(), throttle: +opt.throttle, gfx: opt.gfx, rows: {} };
  for (const name of opt.saves.split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: 3 });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await cdp.send('Performance.enable');
    await p.goto(base + '/tools/perf/blank.html');
    const sv = SAVES[name]();
    await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), sv);
    const t0 = Date.now();
    await p.goto(base + '/index.html');
    await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
    const row = { homeMs: Date.now() - t0 };
    await p.click('[data-act=wEnter]'); await p.waitForTimeout(3000);
    for (let i = 0; i < 30 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await p.waitForTimeout(120); }
    // 让游戏自己存一次，再量 localStorage 里每个键占多少
    await p.evaluate(() => EchoGame.A.save());
    row.ls = await p.evaluate(() => { const o = {}; let t = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), n = k.length + localStorage.getItem(k).length; o[k] = n; t += n; } o.total = t; return o; });
    row.saveChars = await p.evaluate(() => JSON.stringify(EchoGame.S).length);
    row.parts = BS.sizes(await p.evaluate(() => EchoGame.S));   // 游戏读进来、整理过以后每一部分多少字
    row.rev = await p.evaluate(() => Object.keys(EchoGame.S.rev.items).length);
    row.box = await p.evaluate(() => EchoGame.S.mon.box.length);
    if (+opt.full) await p.evaluate(() => { EchoGame.T.RT.walkFull = 1e12; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
    // ---- 存一次要多久 ----
    const tm = await p.evaluate(() => {
      const a = [], b = [], c = [];
      for (let i = 0; i < 15; i++) { let t = performance.now(); EchoGame.A.save(); a.push(performance.now() - t); t = performance.now(); const txt = JSON.stringify(EchoGame.S); b.push(performance.now() - t); t = performance.now(); localStorage.setItem('__perf', txt); c.push(performance.now() - t); }
      localStorage.removeItem('__perf');
      return { save: a, str: b, set: c };
    });
    row.saveMs = { med: r1(med(tm.save)), max: r1(Math.max(...tm.save)), stringify: r1(med(tm.str)), setItem: r1(med(tm.set)) };
    // ---- 走 10 秒 ----
    // 找这张地图上最长的一段能来回走的横路，站到中间
    const seg = await p.evaluate(() => {
      const d = EchoWorld._debug(), M = d.M, ok = (x, y) => { const c = M.grid[y] && M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && !'L'.includes(c) && !M.npcs.some(n => n.x === x && n.y === y) && !M.warps.some(w => w.x === x && w.y === y) && !(M.picks || []).some(q => q.x === x && q.y === y); };
      let best = null;
      for (let y = 0; y < M.grid.length; y++) for (let x = 0, a = -1; x <= M.grid[y].length; x++) { if (ok(x, y)) { if (a < 0) a = x; } else { if (a >= 0 && (!best || x - a > best.n)) best = { y, a, b: x - 1, n: x - a }; a = -1; } }
      const x = Math.floor((best.a + best.b) / 2);
      d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = best.y; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = best.y;
      return best;
    });
    await p.evaluate(() => {
      window.__fr = []; window.__steps = 0; window.__ls = { n: 0, ms: 0, chars: 0, max: 0 };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { const t = performance.now(); const r = set.call(this, k, v); const ms = performance.now() - t; const L = window.__ls; L.n++; L.ms += ms; L.chars += String(v).length; if (ms > L.max) L.max = ms; return r; };
      let last = performance.now(), lx = -1, ly = -1;
      const f = now => { window.__fr.push(now - last); last = now; const P = EchoWorld._debug().PL; if (P.x !== lx || P.y !== ly) { window.__steps++; lx = P.x; ly = P.y; } requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    await p.waitForTimeout(500);
    await p.evaluate(() => { window.__fr.length = 0; window.__steps = 0; Object.assign(window.__ls, { n: 0, ms: 0, chars: 0, max: 0 }); });
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])), a = Date.now();
    const half = Math.max(1, Math.floor(seg.n / 2) - 1), legMs = Math.min(2500, half * 170);
    for (let k = 0; Date.now() - a < opt.sec * 1000; k++) { const key = k % 2 ? 'ArrowLeft' : 'ArrowRight'; await p.keyboard.down(key); await p.waitForTimeout(k === 0 ? legMs : legMs * 2); await p.keyboard.up(key); }
    const sec = (Date.now() - a) / 1000, m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const w = await p.evaluate(() => ({ fr: window.__fr.slice(), steps: window.__steps, ls: window.__ls, dlg: !!EchoWorld._debug().dlg, battle: !document.getElementById('battle').hidden }));
    row.walk = { sec: r1(sec), frames: w.fr.length, fps: r1(w.fr.length / sec), steps: w.steps, over20: w.fr.filter(x => x > 20).length, over33: w.fr.filter(x => x > 33.4).length, over50: w.fr.filter(x => x > 50).length,
      maxMs: r1(Math.max(0, ...w.fr)), p95: r1(w.fr.slice().sort((x, y) => x - y)[Math.floor(w.fr.length * .95)] || 0), busyPct: Math.round((m1.TaskDuration - m0.TaskDuration) / sec * 100),
      lsWrites: w.ls.n, lsMs: r1(w.ls.ms), lsMaxMs: r1(w.ls.max), lsChars: w.ls.chars, interrupted: w.dlg || w.battle };
    row.errs = errs.slice(0, 3);
    out.rows[name] = row;
    await ctx.close();
    console.log(`\n== ${name}：存档 ${fmt(row.saveChars)} 字（复习本 ${row.rev} 条，怪兽 ${row.box} 只）==`);
    console.log(`  打开到首页 ${row.homeMs}ms；localStorage 一共 ${fmt(row.ls.total)} 字（${(row.ls.total / BS.QUOTA * 100).toFixed(1)}% 配额）：` + Object.entries(row.ls).filter(([k]) => k !== 'total').map(([k, n]) => k.replace('echo-island-v1', 'KEY') + ' ' + fmt(n)).join(' · '));
    console.log('  最大的几部分：' + Object.entries(row.parts).filter(([k]) => !k.includes('.') && !k.startsWith('#') && k !== 'total').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k + ' ' + fmt(n)).join(' · ') + '；复习本里聊天句子 ' + fmt(row.parts['rev.items 聊天句子（没上限）'] || 0) + ' 字');
    console.log(`  存一次（CPU ÷${opt.throttle}）：${row.saveMs.med}ms（最长 ${row.saveMs.max}）= stringify ${row.saveMs.stringify} + setItem ${row.saveMs.setItem}`);
    const k = row.walk;
    console.log(`  走 ${k.sec} 秒（${k.steps} 步，每秒 ${k.fps} 帧，主线程 ${k.busyPct}%）：超 20ms ${k.over20} 帧 · 超 33ms ${k.over33} 帧 · 超 50ms ${k.over50} 帧 / ${k.frames}，最长 ${k.maxMs}ms，95% 的帧 ≤ ${k.p95}ms；写 localStorage ${k.lsWrites} 次共 ${k.lsMs}ms（最长一次 ${k.lsMaxMs}ms，${fmt(k.lsChars)} 字）${k.interrupted ? '  ⚠ 中途出了对话/战斗' : ''}${row.errs.length ? '  报错 ' + JSON.stringify(row.errs) : ''}`);
  }
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'save-' + opt.label + '.json'), JSON.stringify(out, null, 1));
  console.log('\n存到 tools/perf/out/save-' + opt.label + '.json');
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
