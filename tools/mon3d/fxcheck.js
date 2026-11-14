// 发布版模型在真的战斗画面里看一遍：用真显卡的无头浏览器打开 tools/fx.html，两只怪兽都换成会动的模型，
// 截待机、出招（中招）、受击、倒下几张图，记下控制台报错。压缩设置改了以后跑它，再人眼看截图（蒙皮坏了会炸出尖刺）。
// 用法：node tools/mon3d/fxcheck.js --pairs flamewolf:buzzbee,gemmy:thunderwing [--dir <代替 assets/mon3d 的目录>] [--out tools/mon3d/_vdiff/fx]
//        [--w 390 --h 300 --dpr 2]（战斗画面的大小和像素比）[--shiny]（我方用稀有色）
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const argv = process.argv.slice(2), opt = { out: 'tools/mon3d/_vdiff/fx', w: 390, h: 300, dpr: 2, type: 'fire', tier: 1 };
for (let i = 0; i < argv.length; i++) { const k = argv[i].slice(2); if (k === 'shiny') opt[k] = true; else opt[k] = argv[++i]; }
if (!opt.pairs) { console.log('用法：node tools/mon3d/fxcheck.js --pairs 我方:对手,我方:对手 [--dir 目录] [--out 目录]'); process.exit(2); }
const abs = p => path.isAbsolute(p) ? p : path.join(ROOT, p);
const DIR = opt.dir ? abs(opt.dir) : path.join(ROOT, 'assets', 'mon3d'), OUT = abs(opt.out);
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', woff2: 'font/woff2' };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    let file = path.join(ROOT, rel);
    const m = /^\/assets\/mon3d\/([^/]+\.glb)$/.exec(rel);
    if (m) file = path.join(DIR, m[1]);
    else if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    fs.readFile(file, (e, buf) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      r.end(buf);
    });
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  for (const pair of opt.pairs.split(',')) {
    const [me, foe] = pair.split(':');
    const ctx = await browser.newContext({ viewport: { width: Math.max(1000, +opt.w + 560), height: Math.max(700, +opt.h + 80) }, deviceScaleFactor: +opt.dpr });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /Battle3D|THREE|WebGL/.test(m.text()))) errs.push(m.type() + ': ' + m.text()); });
    p.on('requestfailed', q => errs.push('requestfailed: ' + q.url()));
    await p.goto(base + '/tools/fx.html?me=' + me + '&foe=' + foe + '&q=high&sfx=0&dpr=' + opt.dpr + '&w=' + opt.w + '&h=' + opt.h);
    await p.waitForFunction(() => document.body.dataset.ready === '1');
    // fx.html 一开始放的是程序拼的模型：把两只的模型下载好再重建一遍（游戏里是 monsters.js 的 prep() 做这件事）。
    // 程序模型自己的警告（和发布的模型无关）不算，从这里开始记
    errs.length = 0;
    const info = await p.evaluate(async ([a, b, shiny]) => {
      const A = DEX.byId[a], B = DEX.byId[b];
      if (!A || !B) return { err: '手册里没有 ' + (A ? b : a) };
      await Mon3D.preload([A, B]);
      const loaded = [Mon3D.isLoaded(A), Mon3D.isLoaded(B)];
      if (shiny) { const o = DEX.byId[a]; DEX.byId[a] = Object.assign({}, o, { shiny: true }); }
      FXT.setQuality('high');
      return { loaded, types: [A.types, B.types] };
    }, [me, foe, !!opt.shiny]);
    if (info.err || !info.loaded.every(Boolean)) { console.log('✗', pair, info.err || '模型没读到 ' + JSON.stringify(info.loaded)); bad++; await ctx.close(); continue; }
    const arena = p.locator('#b-arena');
    const snap = async tag => arena.screenshot({ path: path.join(OUT, me + '-' + foe + '-' + tag + '.png') });
    await wait(900); await snap('1idle');
    // 我方出一个中招：出招途中截两张，命中后对手受击
    const atk = p.evaluate(([ty, tier]) => FXT.play(ty, tier, { side: 'me' }).then(() => true), [opt.type, +opt.tier]);
    await wait(450); await snap('2attack');
    await atk; await wait(120); await snap('3hit');
    await p.evaluate(() => { const t0 = performance.now(); return new Promise(r => { (function w() { (FXT.B3.fxIdle() || performance.now() - t0 > 6000) ? r() : setTimeout(w, 50); })(); }); });
    // 对手出招（看它的出招动作），然后对手倒下
    const atk2 = p.evaluate(([ty]) => FXT.play(ty, 0, { side: 'foe' }).then(() => true), [info.types[1][0]]);
    await wait(350); await snap('4foe-attack');
    await atk2; await wait(400);
    await p.evaluate(() => { FXT.B3.faint('foe'); });
    await wait(700); await snap('5faint');
    await wait(900);
    const st = await p.evaluate(() => ({ gl: FXT.B3.glInfo(), mem: FXT.B3.fxStats().mem }));
    if (errs.length || st.gl.lost || st.gl.n) bad++;
    console.log((errs.length || st.gl.n ? '✗' : '✓'), pair, '报错 ' + errs.length, errs.slice(0, 3).join(' | '), '画面丢失 ' + st.gl.n);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(bad ? '有 ' + bad + ' 对出了问题' : '都没有报错；截图在 ' + OUT);
  if (bad) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
