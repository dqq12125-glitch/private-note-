// 回声岛 · 不该干活的时候有没有在干活：每个画面停着不动 10 秒，量主线程忙了百分之几（CPU 降速 4 倍）
//   首页 · 闯关的一道题 · 聊天页（没连上）· 大地图站着 · 大地图开着对话框 · 对战等出招
//   切到后台（大地图 / 对战 / 放着音乐）：还有没有在画、定时器一秒跑几次、AudioContext 挂起了没有
// 无头浏览器里页面没法真的「隐藏」，这里照浏览器的做法模拟：document.hidden = true + visibilitychange 事件 + requestAnimationFrame 不再回调
// （定时器照常跑——安卓 WebView 切到后台就是这样：不画了，但 setInterval 还在）
// 用法：node tools/perf/idle.js [--label run] [--throttle 4] [--gfx high] [--sec 10]
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const BS = require('./bigsave');
const argv = process.argv.slice(2), opt = { label: 'run', throttle: 4, gfx: 'high', sec: 10 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); } fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });

// 页面一开始就装上：数 requestAnimationFrame / 定时器回调了几次、记下每个 AudioContext；__hide(true) 模拟切到后台
function probe() {
  const C = window.__cnt = { raf: 0, timer: 0, hidden: false, acs: [] };
  const raf = window.requestAnimationFrame.bind(window), held = [];
  window.requestAnimationFrame = f => { if (C.hidden) { held.push(f); return 0; } return raf(t => { C.raf++; f(t); }); };
  const si = window.setInterval.bind(window), st = window.setTimeout.bind(window);
  window.setInterval = (f, ms, ...a) => si(typeof f === 'function' ? (...x) => { C.timer++; return f(...x); } : f, ms, ...a);
  window.setTimeout = (f, ms, ...a) => st(typeof f === 'function' ? (...x) => { C.timer++; return f(...x); } : f, ms, ...a);
  for (const k of ['AudioContext', 'webkitAudioContext']) { const A = window[k]; if (!A) continue; window[k] = function (...a) { const c = new A(...a); C.acs.push(c); return c; }; window[k].prototype = A.prototype; }
  window.__hide = on => {
    C.hidden = on;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
    if (!on) held.splice(0).forEach(f => window.requestAnimationFrame(f));
  };
}

(async () => {
  const { s, base } = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const out = { label: opt.label, when: new Date().toISOString(), throttle: +opt.throttle, rows: {} };
  const open = async (query, music) => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: 3 });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await cdp.send('Performance.enable');
    await p.addInitScript(probe);
    await p.goto(base + '/tools/perf/blank.html');
    const sv = BS.tiny(opt.gfx); sv.settings.music = music || 'off'; sv.homeTab = 'mon';
    await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), sv);
    await p.goto(base + '/index.html' + (query || ''));
    await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
    await p.waitForTimeout(1500);
    return { ctx, p, cdp, errs };
  };
  const metrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const measure = async (t, name) => {
    await t.cdp.send('Emulation.setCPUThrottlingRate', { rate: +opt.throttle });
    await t.p.waitForTimeout(1500);
    const c0 = await t.p.evaluate(() => ({ raf: __cnt.raf, timer: __cnt.timer })), m0 = await metrics(t.cdp), a = Date.now();
    await t.p.waitForTimeout(opt.sec * 1000);
    const sec = (Date.now() - a) / 1000, m1 = await metrics(t.cdp);
    const c1 = await t.p.evaluate(() => ({ raf: __cnt.raf, timer: __cnt.timer, acs: __cnt.acs.map(c => c.state), music: window.EchoMusic && EchoMusic.state ? (s => (s.enabled ? { ctx: s.ctx, playing: s.playing, voices: s.voices } : null))(EchoMusic.state()) : null }));
    await t.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const r = { busyPct: +((m1.TaskDuration - m0.TaskDuration) / sec * 100).toFixed(1), scriptPct: +((m1.ScriptDuration - m0.ScriptDuration) / sec * 100).toFixed(1), layoutPct: +((m1.LayoutDuration + m1.RecalcStyleDuration - m0.LayoutDuration - m0.RecalcStyleDuration) / sec * 100).toFixed(1),
      rafPerSec: +((c1.raf - c0.raf) / sec).toFixed(1), timersPerSec: +((c1.timer - c0.timer) / sec).toFixed(1), audio: c1.acs.join(',') || '-', music: c1.music, errs: t.errs.slice(0, 2) };
    out.rows[name] = r;
    console.log(`  ${name.padEnd(22)} 主线程 ${String(r.busyPct).padStart(5)}%（脚本 ${r.scriptPct}%，排版 ${r.layoutPct}%）  每秒画 ${String(r.rafPerSec).padStart(5)} 次  定时器每秒 ${String(r.timersPerSec).padStart(5)} 次  AudioContext：${r.audio}${r.music ? '  音乐 ' + JSON.stringify(r.music) : ''}${r.errs.length ? '  报错 ' + JSON.stringify(r.errs) : ''}`);
    return r;
  };
  const closeDlg = async p => { for (let i = 0; i < 30 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await p.waitForTimeout(120); } };
  const battle = async p => { await p.evaluate(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 5)] })); await p.waitForSelector('#b-panel [data-act=bMove]', { timeout: 40000 }).catch(() => {}); await p.waitForTimeout(1500); };

  console.log('== 停着不动 ' + opt.sec + ' 秒（CPU ÷' + opt.throttle + '，画质 ' + opt.gfx + '）==');
  let t = await open();
  await measure(t, '首页');
  await t.p.click('[data-act=tab][data-t=talk]').catch(() => {}); await t.p.waitForTimeout(800);
  await measure(t, '聊天页（没连上）');
  await t.p.evaluate(() => { EchoGame.goHome('mon'); EchoGame.playQs([['lw', 0, 0], ['lw', 0, 1], ['lm', 0, 0]]); }); await t.p.waitForTimeout(1500);
  await measure(t, '闯关的一道题');
  await t.p.evaluate(() => EchoGame.goHome('mon')); await t.p.waitForTimeout(500);
  await t.p.click('[data-act=wEnter]'); await t.p.waitForTimeout(4500); await closeDlg(t.p);
  await measure(t, '大地图站着');
  await t.p.evaluate(() => EchoWorld._debug().talk([{ who: '旁白', emo: '💬', en: 'Hello there! Nice to meet you.', zh: '你好！很高兴认识你。' }])); await t.p.waitForTimeout(2500);
  await measure(t, '大地图开着对话框');
  await closeDlg(t.p);
  await t.p.evaluate(() => __hide(true));
  await measure(t, '切到后台 · 大地图');
  await t.p.evaluate(() => __hide(false)); await t.p.waitForTimeout(500);
  await t.p.evaluate(() => EchoGame.goHome('mon')); await battle(t.p);
  await measure(t, '对战等出招');
  await t.p.evaluate(() => __hide(true));
  await measure(t, '切到后台 · 对战');
  await t.ctx.close();
  // 放着音乐
  t = await open('?music', 'mid');
  await t.p.mouse.click(210, 500).catch(() => {}); await t.p.waitForTimeout(600);
  await t.p.click('[data-act=wEnter]'); await t.p.waitForTimeout(4500); await closeDlg(t.p);
  await measure(t, '大地图站着 · 有音乐');
  await t.p.evaluate(() => __hide(true));
  await measure(t, '切到后台 · 有音乐');
  await t.p.evaluate(() => __hide(false)); await t.p.waitForTimeout(800);
  await t.p.evaluate(() => EchoGame.goHome('mon')); await t.p.waitForTimeout(1500);
  await measure(t, '首页 · 有音乐');
  await t.ctx.close();

  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'idle-' + opt.label + '.json'), JSON.stringify(out, null, 1));
  console.log('\n存到 tools/perf/out/idle-' + opt.label + '.json');
  await browser.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
