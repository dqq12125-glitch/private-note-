// 回声岛 · iPhone 检查：浏览器能力探测 + localStorage 能放多少字。audit.js 调用；也可以单独跑：
//   node tools/ios/probe.js [webkit|chromium|both]        结果打印出来，并写进 tests/screenshots/ios/probe-<引擎>.json
// 注意：Playwright 在 Windows 上的 WebKit 不是 iPhone 的 Safari（没有麦克风、没有 MediaRecorder、解码器是 Windows 的、版本也比 iOS 18.4 新），
//       这里的结果只说明「这个 WebKit 内核」的行为，真机上要再跑一遍（把 PROBE 这段贴进 Safari 的网页检查器就行）。
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const L = require('./lib');

// 在页面里跑。要先有一次真的点击（放声音、开 AudioContext 要用户手势），所以由下面的 probe() 点一下按钮再调
async function PROBE(arg) {
  const out = {}, safe = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = 'ERR ' + (e && (e.name + ': ' + e.message)); } };
  const timeout = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
  const AC = window.AudioContext || window.webkitAudioContext;
  await safe('userAgent', () => navigator.userAgent);
  await safe('isSecureContext', () => window.isSecureContext);
  await safe('mediaDevices', () => !!navigator.mediaDevices);
  await safe('getUserMedia', () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  await safe('canPlayType', () => { const a = new Audio(), o = {}; ['audio/ogg; codecs="opus"', 'audio/ogg; codecs="vorbis"', 'audio/ogg', 'audio/webm; codecs="opus"', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mp4; codecs="opus"', 'audio/mpeg', 'audio/wav', 'audio/x-caf; codecs="opus"'].forEach(t => { o[t] = a.canPlayType(t); }); return o; });
  // 真的放一段打包的配音（Opus 放在 Ogg 里）：看 canplay / ended / error 哪个来
  await safe('audioPlayOgg', () => new Promise(res => {
    const a = new Audio(), ev = [], t0 = performance.now(); let done = false;
    const fin = why => { if (done) return; done = true; res({ url: arg.ogg, events: ev.join(' '), why, ms: Math.round(performance.now() - t0), duration: a.duration, readyState: a.readyState, networkState: a.networkState, error: a.error ? a.error.code + ' ' + (a.error.message || '') : null }); };
    ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'playing', 'ended', 'error', 'stalled', 'suspend', 'abort'].forEach(n => a.addEventListener(n, () => { ev.push(n); if (n === 'ended' || n === 'error') fin(n); }));
    a.src = arg.ogg; a.volume = 0.01;
    const q = a.play(); if (q && q.catch) q.then(() => ev.push('play()ok')).catch(e => { ev.push('play()rejected:' + e.name); });
    setTimeout(() => fin('timeout 9s'), 9000);
  }));
  await safe('decodeAudioDataOgg', async () => {
    if (!AC) return 'no AudioContext';
    const buf = await (await fetch(arg.notice)).arrayBuffer(), ctx = new AC(), bytes = buf.byteLength;
    try { const b = await Promise.race([new Promise((ok, no) => { const q = ctx.decodeAudioData(buf, ok, no); if (q && q.then) q.then(ok, no); }), timeout(8000, 'timeout 8s')]); return typeof b === 'string' ? b : { bytes, duration: +b.duration.toFixed(2), sampleRate: b.sampleRate, channels: b.numberOfChannels, ctxRate: ctx.sampleRate }; }
    finally { try { ctx.close(); } catch (e) { /* 忽略 */ } }
  });
  await safe('audioContext', () => { if (!AC) return 'none'; const c = new AC(), o = { unprefixed: !!window.AudioContext, webkit: !!window.webkitAudioContext, defaultRate: c.sampleRate, state: c.state, baseLatency: c.baseLatency, worklet: !!c.audioWorklet }; c.close(); return o; });
  await safe('audioContext16k', () => { let c; try { c = new AudioContext({ sampleRate: 16000 }); } catch (e) { return 'threw ' + e.name + ': ' + e.message; } const r = c.sampleRate, s = c.state; c.close(); return { sampleRate: r, state: s }; });
  // talk.js micOpen 的写法：Blob 网址装 AudioWorklet、建节点、往里送声音看有没有消息回来（这里用振荡器代替麦克风）
  await safe('audioWorkletBlob', async () => {
    const WORKLET = 'class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("tk-cap",P);';
    let ctx; try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await Promise.race([ctx.audioWorklet.addModule(url), timeout(6000).then(() => { throw new Error('addModule timeout 6s'); })]);
      const node = new AudioWorkletNode(ctx, 'tk-cap'); let n = 0, len = 0;
      node.port.onmessage = e => { n++; len = e.data.length; };
      const osc = ctx.createOscillator(); osc.connect(node); osc.start();
      if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), timeout(1500)]); } catch (e) { /* 忽略 */ } }
      await timeout(600);
      // 再试 getUserMedia 那一路要用的 createMediaStreamSource（用 createMediaStreamDestination 造一条流）
      let mss = 'n/a'; try { const d = ctx.createMediaStreamDestination(); ctx.createMediaStreamSource(d.stream); mss = 'ok'; } catch (e) { mss = 'ERR ' + e.name; }
      return { addModule: 'ok', rate: ctx.sampleRate, state: ctx.state, messages: n, frame: len, mediaStreamSource: mss };
    } finally { try { ctx.close(); } catch (e) { /* 忽略 */ } }
  });
  await safe('webgl2', () => {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2'); if (!gl) return { ok: false, webgl1: !!document.createElement('canvas').getContext('webgl') };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { ok: true, version: gl.getParameter(gl.VERSION), glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE), MAX_RENDERBUFFER_SIZE: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), MAX_SAMPLES: gl.getParameter(gl.MAX_SAMPLES), MAX_VERTEX_UNIFORM_VECTORS: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS), MAX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      highpFragFloat: gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision, extensions: gl.getSupportedExtensions() };
  });
  // 怪兽模型的贴图是 WebP：GLTFLoader 把它变成 blob: 网址，再 fetch + createImageBitmap（或者 <img>）读出来
  await safe('webpBlob', async () => {
    const blob = await (await fetch(arg.webp)).blob(), url = URL.createObjectURL(blob), o = { type: blob.type, bytes: blob.size };
    try { const b = await (await fetch(url)).blob(); o.fetchBlobUrl = b.size === blob.size ? 'ok' : 'size ' + b.size; } catch (e) { o.fetchBlobUrl = 'ERR ' + e.name + ': ' + e.message; }
    try { const bm = await createImageBitmap(blob); o.createImageBitmap = bm.width + 'x' + bm.height; } catch (e) { o.createImageBitmap = 'ERR ' + e.name + ': ' + e.message; }
    try { const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); o.createImageBitmapOpts = bm.width + 'x' + bm.height; } catch (e) { o.createImageBitmapOpts = 'ERR ' + e.name + ': ' + e.message; }
    o.img = await new Promise(r => { const im = new Image(); im.onload = () => r(im.naturalWidth + 'x' + im.naturalHeight); im.onerror = () => r('error'); im.src = url; setTimeout(() => r('timeout'), 4000); });
    return o;
  });
  await safe('css', () => { const o = {}; [['selector(:has(a))'], ['height', '100dvh'], ['height', '100svh'], ['color', 'color-mix(in srgb, red 50%, blue)'], ['backdrop-filter', 'blur(2px)'], ['-webkit-backdrop-filter', 'blur(2px)'], ['overscroll-behavior', 'contain'], ['touch-action', 'none'], ['touch-action', 'manipulation'],
    ['user-select', 'none'], ['-webkit-user-select', 'none'], ['-webkit-touch-callout', 'none'], ['aspect-ratio', '1 / 1'], ['inset', '0'], ['gap', '4px'], ['text-wrap', 'balance'], ['scrollbar-width', 'none'], ['scrollbar-gutter', 'stable'], ['selector(&)'], ['container-type', 'inline-size'], ['padding-top', 'env(safe-area-inset-top, 0px)'], ['padding-block', '1px 2px'], ['width', 'min(1px, 2px)']]
    .forEach(a => { o[a.join(': ')] = a.length === 1 ? CSS.supports(a[0]) : CSS.supports(a[0], a[1]); }); return o; });
  await safe('safeAreaEnv', () => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(d); const cs = getComputedStyle(d), r = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '); d.remove(); return r; });
  await safe('media', () => ({ hover: matchMedia('(hover: hover)').matches, coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches, anyHover: matchMedia('(any-hover: hover)').matches, portrait: matchMedia('(orientation: portrait)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, standalone: matchMedia('(display-mode: standalone)').matches }));
  await safe('speechSynthesis', () => ('speechSynthesis' in window) ? { ok: true, voices: speechSynthesis.getVoices().length } : false);
  await safe('SpeechRecognition', () => ({ std: typeof window.SpeechRecognition, webkit: typeof window.webkitSpeechRecognition }));
  await safe('MediaRecorder', () => typeof MediaRecorder === 'undefined' ? 'undefined' : Object.fromEntries(['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/ogg;codecs=opus', 'audio/wav'].map(t => [t, MediaRecorder.isTypeSupported(t)])));
  await safe('navigator', () => ({ vibrate: typeof navigator.vibrate, deviceMemory: navigator.deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency, connection: typeof navigator.connection, userAgentData: typeof navigator.userAgentData, onLine: navigator.onLine, maxTouchPoints: navigator.maxTouchPoints,
    wakeLock: typeof navigator.wakeLock, share: typeof navigator.share, clipboard: typeof navigator.clipboard, permissions: typeof navigator.permissions, standalone: navigator.standalone, language: navigator.language, platform: navigator.platform }));
  await safe('globals', () => ({ requestIdleCallback: typeof window.requestIdleCallback, performanceMemory: typeof (performance.memory), screenOrientation: typeof screen.orientation, orientationLock: typeof (screen.orientation && screen.orientation.lock), requestFullscreen: typeof document.documentElement.requestFullscreen, webkitRequestFullscreen: typeof document.documentElement.webkitRequestFullscreen,
    OffscreenCanvas: typeof window.OffscreenCanvas, createImageBitmap: typeof window.createImageBitmap, structuredClone: typeof window.structuredClone, PointerEvent: typeof window.PointerEvent, TouchEvent: typeof window.TouchEvent, ontouchstart: 'ontouchstart' in window, visualViewport: typeof window.visualViewport, ResizeObserver: typeof window.ResizeObserver,
    indexedDB: typeof window.indexedDB, WebAssembly: typeof window.WebAssembly, AudioWorkletNode: typeof window.AudioWorkletNode, WebSocket: typeof window.WebSocket, AbortSignalTimeout: typeof (window.AbortSignal && AbortSignal.timeout), IntlSegmenter: typeof (window.Intl && Intl.Segmenter), DOMException: typeof window.DOMException, CompressionStream: typeof window.CompressionStream }));
  await safe('js', () => { const t = s => { try { return !!new Function('return (' + s + ')')(); } catch (e) { return false; } };
    return { arrayAt: typeof [].at, findLast: typeof [].findLast, toSorted: typeof [].toSorted, arrayWith: typeof [].with, objectHasOwn: typeof Object.hasOwn, objectGroupBy: typeof Object.groupBy, promiseWithResolvers: typeof Promise.withResolvers, arrayFromAsync: typeof Array.fromAsync, setUnion: typeof Set.prototype.union, stringAt: typeof ''.at, replaceAll: typeof ''.replaceAll,
      lookbehind: t('/(?<=a)b/.test("ab")'), regexpVFlag: t('new RegExp("[\\\\p{L}--[a-z]]", "v").test("A")'), logicalAssign: t('(() => { let a = null; a ??= 1; return a === 1 })()'), classStaticBlock: t('(() => { class A { static x; static { A.x = 1; } } return A.x === 1 })()'), optionalChaining: t('(null)?.x === undefined') }; });
  await safe('wasmSimd', () => typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])));
  await safe('storageEstimate', async () => (navigator.storage && navigator.storage.estimate) ? await Promise.race([navigator.storage.estimate().then(e => ({ quota: e.quota, usage: e.usage })), timeout(4000, 'timeout 4s')]) : 'no navigator.storage.estimate');
  await safe('storagePersist', async () => (navigator.storage && navigator.storage.persisted) ? { persisted: await Promise.race([navigator.storage.persisted(), timeout(3000, 'timeout')]), persist: typeof navigator.storage.persist } : 'none');
  await safe('viewport', () => ({ inner: [innerWidth, innerHeight], dpr: devicePixelRatio, screen: [screen.width, screen.height], vv: window.visualViewport ? [visualViewport.width, visualViewport.height, visualViewport.scale] : null, docClient: [document.documentElement.clientWidth, document.documentElement.clientHeight] }));
  return out;
}

// 3D 画面到底建没建出来：大地图（精美档）和对战
async function gl3d(t) {
  const out = {};
  try {
    await t.reload(L.SAVE({ gfx: 'high' })); await t.enterWorld();
    out.world = await t.E(() => { const d = EchoWorld._debug(), R = d.R, i = R.info ? R.info() : null, c = document.querySelector('#w-view canvas.w-canvas'); return { kind: R.kind, look: R.look || '', gl: R.glState ? R.glState() : '', calls: i ? i.render.calls : 0, triangles: i ? i.render.triangles : 0, frame: i ? i.render.frame : 0, canvas: c ? [c.width, c.height] : null, tier: EchoWorld.gfxTier ? EchoWorld.gfxTier() : '', gfxAuto: EchoGame.S.settings.gfxAuto || '' }; });
  } catch (e) { out.world = 'ERR ' + String(e.message).split('\n')[0]; }
  try {
    await t.home('mon');
    await t.E(() => MonsterGame.battle('wild', 0, { onEnd() {}, hab: 'grass', foes: [MonsterGame.newMon('twigling', 3)] }));
    await t.until(() => t.E(() => !!document.querySelector('#b-panel [data-act=bMove]')), 200, 150);
    out.battle = await t.E(() => { const B3 = MonsterGame._b3 && MonsterGame._b3(), c = document.querySelector('#b-arena canvas.b3d'); let gi = null; try { gi = B3 && B3.glInfo ? B3.glInfo() : null; } catch (e) { gi = String(e); } let fx = null; try { fx = window.Battle3D && Battle3D.fxStats ? Battle3D.fxStats() : null; } catch (e) { fx = String(e); }
      return { Battle3D: !!window.Battle3D, is3d: !!B3, canvas: c ? [c.width, c.height] : null, gl: gi, warm: fx && fx.warm }; });
    await t.E(() => { const x = document.querySelector('[data-act=bFlee]'); if (x) x.click(); }); await t.W(600);
    await t.E(() => { const x = document.querySelector('#sheet [data-act=bEnd], #b-panel [data-act=bEnd]'); if (x) x.click(); EchoGame.closeModal(); EchoGame.goHome('mon'); });
  } catch (e) { out.battle = 'ERR ' + String(e.message).split('\n')[0]; }
  return out;
}

async function probe(browser, base, engine) {
  const t = await L.open(browser, base, { engine, orient: 'portrait', bridge: false });
  await t.load();
  // 先真的点一下（用户手势），在点击里开始探测
  await t.E(() => { const b = document.createElement('button'); b.id = '__probe'; b.textContent = 'probe'; b.style.cssText = 'position:fixed;left:40px;top:300px;width:200px;height:80px;z-index:99999'; document.body.appendChild(b); });
  const voice = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'assets', 'voice', 'index.json'), 'utf8'));
  const arg = { ogg: 'assets/voice/f/' + voice.f[0] + '.ogg', notice: 'assets/voice/zh/ai-notice.ogg', webp: 'assets/mon2d/emberpup.webp' };
  await t.E(([src, arg]) => { const f = new Function('return (' + src + ')')(); document.querySelector('#__probe').addEventListener('click', () => { window.__probeResult = f(arg); }, { once: true }); }, [PROBE.toString(), arg]);
  await t.p.locator('#__probe').tap();
  await t.p.waitForFunction(() => !!window.__probeResult, null, { timeout: 5000 });
  const res = await t.p.evaluate(() => window.__probeResult);
  await t.E(() => document.querySelector('#__probe').remove());
  res.engine = engine + ' ' + browser.version();
  res.gl3d = await gl3d(t);
  res.pageErrors = t.ev.bag;
  res.blockedExternal = [...new Set(t.blocked)];
  await t.ctx.close();
  return res;
}

// ---------- localStorage 能放多少字 ----------
// 换一个没用过的网址（另起一个端口 = 另一个源），不碰游戏的存档。三种内容：纯英文（ASCII）、纯中文、英文里夹一个中文字（存档就是这样的：JSON 里有中文）
function QUOTA() {
  const fits = (key, val) => { try { localStorage.setItem(key, val); return true; } catch (e) { window.__qerr = e.name + ' (code ' + e.code + ')'; return false; } };
  const mk = (kind, n) => kind === 'ascii' ? 'a'.repeat(n) : kind === 'zh' ? '岛'.repeat(n) : '岛' + 'a'.repeat(Math.max(0, n - 1));
  const out = {};
  for (const kind of ['ascii', 'zh', 'mixed']) {
    // (1) 只有一个键：值最长能到多少字（二分）
    localStorage.clear();
    let lo = 0, hi = 12 * 1024 * 1024;
    while (hi - lo > 512) { const mid = (lo + hi) >> 1; localStorage.clear(); if (fits('k', mk(kind, mid))) lo = mid; else hi = mid; }
    const single = lo;
    // (2) 很多个键，每个 25 万字，放到放不下为止，再用小块补满
    localStorage.clear();
    let total = 0, n = 0, size = 250000;
    while (size >= 256) { const key = 'k' + n; if (fits(key, mk(kind, size))) { total += size + key.length; n++; } else size >>= 1; }
    out[kind] = { singleValueChars: single, manyKeysChars: total, keys: n, error: window.__qerr || '' };
    localStorage.clear();
  }
  return out;
}
async function quota(browser, engine) {
  const srv = await new Promise(res => { const s = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end('<!doctype html><meta charset="utf-8"><title>quota</title>'); }).listen(0, '127.0.0.1', () => res(s)); });
  const ctx = await browser.newContext(), p = await ctx.newPage();
  try {
    await p.goto('http://127.0.0.1:' + srv.address().port + '/');
    const r = await p.evaluate(QUOTA);
    r.engine = engine + ' ' + browser.version();
    return r;
  } finally { await ctx.close(); srv.close(); }
}

module.exports = { probe, quota, PROBE, QUOTA };

if (require.main === module) (async () => {
  const which = (process.argv[2] || 'both') === 'both' ? ['webkit', 'chromium'] : [process.argv[2]];
  const { s, base } = await L.serve();
  for (const engine of which) {
    const b = await L.launch(engine);
    const r = { probe: await probe(b, base, engine), quota: await quota(b, engine) };
    fs.writeFileSync(path.join(L.OUT, 'probe-' + engine + '.json'), JSON.stringify(r, null, 1));
    console.log('=== ' + engine + ' ' + b.version() + '（Windows 上的 Playwright 内核，不是 iPhone Safari）===');
    console.log(JSON.stringify(r, null, 1));
    await b.close();
  }
  s.close();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
