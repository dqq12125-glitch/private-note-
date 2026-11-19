// 回声岛 · iPhone（WebKit）兼容性检查的公用工具（tools/ios/*.js 共用）。只读，不改游戏。
//   · serve()      起一个只绑 127.0.0.1 的小网站（file:// 读不了模型和配音）；支持 Range（Safari 放 <audio> 要用）
//   · launch()     开 WebKit 或 Chromium（Playwright）
//   · open()       开一页：iPhone 15 的尺寸、3 倍屏、触屏；可选装假的原生桥（tests/fake-native.js）+ window.ECHO_IOS = 1
//   · SAVE()       测试存档；tour()  按固定顺序把各个画面走一遍，每一步交给 onStep(名字) 去截图、收集问题
//   · SCAN         在页面里跑的排版检查（超出屏幕、太小的按钮、被裁掉的字、互相盖住的控件、各个要紧元素的位置）
// 安全：外面的网址一律挡掉；对话服务地址固定写成本机一个一连上就挂断的端口，不会真的去连中转服务或阿里云
'use strict';
const http = require('http'), net = require('net'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const PW = require(path.join(ROOT, 'node_modules', 'playwright'));
const FN = require(path.join(ROOT, 'tests', 'fake-native.js'));
const OUT = path.join(ROOT, 'tests', 'screenshots', 'ios');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp',
  jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8' };
// 这些目录不给看（密钥、签名配置、中转服务都在里面）
const DENY = /^[\\/](android|ios|server|node_modules|art|dl|\.git|\.claude)([\\/]|$)/i;

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]);
      // 空白页：先在同一个网址下写好存档，再打开游戏
      if (rel === '/__blank.html') { r.writeHead(200, { 'Content-Type': MIME.html, 'Cache-Control': 'no-store' }); return r.end('<!doctype html><meta charset="utf-8"><title>blank</title><body></body>'); }
      const file = path.normalize(path.join(ROOT, rel === '/' ? 'index.html' : rel));
      if (!file.startsWith(ROOT) || DENY.test(file.slice(ROOT.length))) { r.writeHead(404); return r.end(); }
      fs.stat(file, (e, st) => {
        if (e || !st.isFile()) { r.writeHead(404); return r.end(); }
        const head = { 'Content-Type': MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
        const m = /^bytes=(\d*)-(\d*)$/.exec(q.headers.range || '');
        if (m && (m[1] || m[2])) {
          let a = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
          if (a > b || a >= st.size) { r.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return r.end(); }
          head['Content-Range'] = 'bytes ' + a + '-' + b + '/' + st.size; head['Content-Length'] = b - a + 1;
          r.writeHead(206, head); return fs.createReadStream(file, { start: a, end: b }).pipe(r);
        }
        head['Content-Length'] = st.size;
        r.writeHead(200, head); fs.createReadStream(file).pipe(r);
      });
    }).listen(0, '127.0.0.1', () => {
      // 「对话服务」指到这里：一连上就挂断（两个引擎里都只是普通的连不上）。不用端口 9：WebKit 把它当受限端口，new WebSocket 会直接抛错
      const dead = net.createServer(sock => sock.destroy()).listen(0, '127.0.0.1', () => {
        DEAD = 'ws://127.0.0.1:' + dead.address().port;
        res({ s: { close() { s.close(); dead.close(); } }, port: s.address().port, base: 'http://127.0.0.1:' + s.address().port, dead: DEAD });
      });
    });
  });
}
let DEAD = 'ws://127.0.0.1:9';

// engine: 'webkit' | 'chromium'。Chromium 默认用真显卡（和 tools/look 一样）；IOS_SWGL=1 改用软件渲染
function launch(engine) {
  if (engine === 'webkit') return PW.webkit.launch();
  const gl = process.env.IOS_SWGL ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'];
  return PW.chromium.launch({ args: gl.concat(['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb']) });
}

const IPHONE = PW.devices['iPhone 15'];
const VIEW = { portrait: { width: 393, height: 852 }, landscape: { width: 852, height: 393 } };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());

// 测试存档：开场剧情都过了、学习锁关着（冒险也就不限时）、没有声音、口语用录音自评（mode: 'auto' = AI 打分，App 模式用）、网页版的家长密码 1234
function SAVE(o) {
  o = o || {};
  return {
    seenIntro: true, coins: 500, micCheck: TODAY, homeTab: o.tab || 'mon',
    settings: { tts: 'online', mode: o.mode || 'self', gfx: o.gfx || '2d', sfx: false, gate: false, music: 'off', pin: '1234', ctl: o.ctl || 'joy' },
    player: { gender: 'girl', name: 'Coco' },
    mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 14, xp: 0 }, { uid: 'm2', sp: 'bubbly', lv: 12, xp: 0 }], team: ['m1', 'm2'], dex: { emberpup: 'caught', bubbly: 'caught', twigling: 'seen' }, balls: 10, potions: 10, bag: {}, badges: {} },
    world: { v: 3, started: true, map: 't0', x: 14, y: 9, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, daily: {}, repel: 99999 },
    book: { view: 'isle', at: 0, mix: 0 }, rev: { v: 1, items: {} },
  };
}

// 每一页最先跑的脚本：对话服务地址指到没人听的端口；记下没接住的错误、Promise 失败、资源加载失败；记最近的触摸 / 指针 / 点击事件（看引擎到底发了什么）
function initScript(dead) {
  try { localStorage.setItem('echo-talk-url', dead); } catch (e) { /* about:blank 上没有 localStorage */ }
  const A = window.__ios = { errs: [], rej: [], ev: [], log: false };
  window.addEventListener('error', e => {
    const t = e.target;
    if (t && t !== window && t.tagName) A.errs.push({ k: 'resource', m: t.tagName + ' ' + (t.currentSrc || t.src || t.href || '') });
    else A.errs.push({ k: 'error', m: String(e.message || e), at: (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno });
  }, true);
  window.addEventListener('unhandledrejection', e => { const r = e.reason; A.rej.push(String((r && (r.stack || r.message)) || r).slice(0, 400)); });
  ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'click', 'gotpointercapture', 'lostpointercapture'].forEach(n =>
    window.addEventListener(n, e => { if (A.log && A.ev.length < 400) A.ev.push(n + (e.pointerType ? ':' + e.pointerType : '') + (e.isPrimary === false ? ':2nd' : '') + (e.isTrusted ? '' : ':synth')); }, true));
}
// 假麦克风（和 tests/apk.test.js 一样）：一个一直响的 320Hz，口语识别的录音链路（AudioContext + AudioWorklet）就能真的跑起来
function fakeMic() {
  const md = navigator.mediaDevices; if (!md) return;
  md.getUserMedia = async () => {
    const C = window.AudioContext || window.webkitAudioContext, ac = new C(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = 0.2; osc.connect(g); g.connect(dest); osc.start();
    return dest.stream;
  };
}

// 开一页。o：{ engine, orient, bridge: false | {假原生桥的选项}, query, save, ls: {额外的 localStorage}, mic: 装不装假麦克风 }
async function open(browser, base, o) {
  const vp = VIEW[o.orient] || VIEW.portrait;
  const ctx = await browser.newContext({ viewport: vp, screen: vp, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: IPHONE.userAgent, locale: 'zh-CN' });
  const blocked = [];
  // 外面的网址一律挡掉（在线发音、版本检查、中转服务的 http 接口……）
  // （只挡 http / https：blob:、data: 是页面自己的东西，WebKit 里它们也会经过这里，挡了模型贴图就读不出来）
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(base + '/'), r => { blocked.push(r.request().url().slice(0, 120)); r.abort(); });
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000); p.setDefaultNavigationTimeout(45000);
  await p.addInitScript(initScript, DEAD);
  // App 模式：假原生桥 + 和 ios/App/Resources/echo-native.js 一样的两个标记（window.ECHO_IOS、<html class="echo-ios">，style.css 末尾的 iPhone 专用几条认它）
  if (o.bridge) {
    await p.addInitScript(FN.install, o.bridge);
    await p.addInitScript(() => { window.ECHO_IOS = 1; const mark = () => { if (document.documentElement) document.documentElement.classList.add('echo-ios'); }; mark(); document.addEventListener('DOMContentLoaded', mark); });
  }
  if (o.mic) await p.addInitScript(fakeMic);
  // 问题按「现在是哪一步」归堆
  const ev = { step: 'boot', bag: {} };
  const push = (k, v) => { const b = ev.bag[ev.step] = ev.bag[ev.step] || { pageerror: [], console: [], request: [] }; if (b[k].length < 40) b[k].push(v); };
  p.on('pageerror', e => push('pageerror', { m: String(e.message).slice(0, 300), at: String((e.stack || '').split('\n').find(l => /:\d+/.test(l)) || '').trim().slice(0, 200) }));
  p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') push('console', { t, m: m.text().slice(0, 300) }); });
  p.on('requestfailed', r => { const u = r.url(); if (u.startsWith(base + '/')) push('request', { u: u.slice(base.length), why: (r.failure() || {}).errorText || 'failed' }); });
  p.on('response', r => { const u = r.url(); if (r.status() >= 400 && u.startsWith(base + '/')) push('request', { u: u.slice(base.length), why: 'HTTP ' + r.status() }); });
  const W = ms => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto(base + '/__blank.html');
  await E(([sv, ls]) => { if (sv) localStorage.setItem('echo-island-v1', JSON.stringify(sv)); Object.entries(ls || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }, [o.save === undefined ? SAVE() : o.save, o.ls]);
  const t = {
    ctx, p, W, E, ev, blocked, base, engine: o.engine, orient: o.orient, vp,
    until: async (fn, max, gap) => { for (let i = 0; i < (max || 60); i++) { try { if (await fn()) return true; } catch (e) { /* 页面正在换 */ } await W(gap || 150); } return false; },
    // 等画面停下来：等一小会儿 + 两帧
    async settle(ms) { await W(ms == null ? 450 : ms); await E(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {}); },
    async load(query) {
      await p.goto(base + '/index.html' + (query || ''));
      await p.waitForFunction(() => !!window.EchoGame, null, { timeout: 45000 });
      await t.settle(600);
    },
    // 换存档重新打开
    async reload(sv, query) { await E(s => localStorage.setItem('echo-island-v1', JSON.stringify(s)), sv); await t.load(query); },
    home: tab => E(tab => { EchoGame.closeModal(); EchoGame.goHome(tab); window.scrollTo(0, 0); }, tab),
    // 真的用手指点一下（Playwright 的 touchscreen.tap：两个引擎都发真的触摸事件）；点不到（被盖住、在屏幕外）就退回 el.click() 并记下来
    async tap(sel, opt) {
      const el = p.locator(sel).first();
      try { await el.scrollIntoViewIfNeeded({ timeout: 3000 }); await el.tap({ timeout: (opt && opt.timeout) || 4000 }); return 'tap'; }
      catch (e) { const ok = await el.evaluate(x => { x.click(); return true; }, null, { timeout: 2000 }).catch(() => false); t.fallbacks.push({ step: ev.step, sel, why: String(e.message).split('\n').slice(0, 2).join(' ').slice(0, 200), clicked: ok }); return ok ? 'click' : 'none'; }
    },
    fallbacks: [],
    dbg: () => E(() => { const d = EchoWorld._debug(); return { map: d.M && d.M.id, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: !!d.busy, moving: !!d.PL.moving, kind: d.R && d.R.kind, look: (d.R && d.R.look) || '' }; }),
    // 对话框开着就点掉（要选的时候选最后一个：「以后再说」，不去开 AI 聊天）
    async closeDlg() { for (let i = 0; i < 40 && await E(() => !!EchoWorld._debug().dlg); i++) { await E(() => { const pk = document.querySelectorAll('#w-dlg [data-act=wPick]'); const a = pk.length ? pk[pk.length - 1] : document.querySelector('#w-dlg [data-act=wSkip]:not([hidden])') || document.querySelector('#w-dlg [data-act=wSelfDone]') || document.querySelector('#world [data-act=wA].ba'); if (a) a.click(); }); await W(140); } },
    async enterWorld() {
      await t.home('mon'); await t.settle(250);
      await t.tap('[data-act=wEnter]');
      await p.waitForFunction(() => { try { const d = EchoWorld._debug(); return !document.querySelector('#world').hidden && d.R && d.M && (d.R.kind === '2d' || !d.R.info || d.R.info().render.frame > 2); } catch (e) { return false; } }, null, { timeout: 60000 });
      await W(500); await t.closeDlg(); await t.settle(500);
    },
    tp: (x, y, dir) => E(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir || d.PL.dir; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; }, [x, y, dir]),
    // 主角周围哪个方向能连着走 n 格
    freeDir: n => E(n => { const d = EchoWorld._debug(), D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }; const ok = (x, y) => { const c = d.M.grid[y] && d.M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && !d.M.npcs.some(q => q.x === x && q.y === y); };
      for (const k of ['down', 'left', 'right', 'up']) { let all = true; for (let i = 1; i <= n; i++) if (!ok(d.PL.x + D[k][0] * i, d.PL.y + D[k][1] * i)) all = false; if (all) return k; } return null; }, n),
    // 站到一个人面前（他旁边能站的格子），面朝他
    faceNpc: () => E(() => { const d = EchoWorld._debug(); const ok = (x, y) => { const c = d.M.grid[y] && d.M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && !d.M.npcs.some(q => q.x === x && q.y === y); };
      for (const n of d.M.npcs) for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) if (ok(n.x + dx, n.y + dy)) { d.PL.x = d.PL.fx = n.x + dx; d.PL.y = d.PL.fy = n.y + dy; d.PL.dir = dir; d.PL.moving = false; d.FL.x = d.FL.fx = d.PL.x; d.FL.y = d.FL.fy = d.PL.y; return { id: n.id, role: n.role, name: n.name }; } return null; }),
  };
  return t;
}

// ---------- 在页面里跑的排版检查 ----------
// 返回 { vw, vh, scrollW, problems: [{ k 种类, sel, text, rect, ... }], rects: { 键: [x, y, w, h, 文字] } }
function SCAN(arg) {
  const VW = innerWidth, VH = innerHeight, de = document.documentElement, out = { vw: VW, vh: VH, scrollW: de.scrollWidth, scrollH: de.scrollHeight, problems: [], rects: {} };
  const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  const txt = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const sel = el => { if (!el || el.nodeType !== 1) return ''; const one = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (e.dataset && e.dataset.act ? '[data-act=' + e.dataset.act + ']' : ''); const p = el.parentElement; return (p && p !== document.body && !el.id ? one(p) + ' > ' : '') + one(el); };
  const key = el => { const d = el.dataset || {}; return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (d.act ? '[' + d.act + ']' : '') + ['t', 'm', 'v', 'k', 'i', 'w', 'l', 'npc', 'sp', 'dir', 'doc', 'b', 'p', 'u'].map(k => d[k] != null ? '{' + k + '=' + d[k] + '}' : '').join('') + (!el.id && !d.act && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''); };
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; if (e !== el && e.tagName === 'DETAILS' && !e.open && !el.closest('summary')) return false; } return true; };
  const inside = (a, b) => a === b || a.contains(b) || b.contains(a);
  // 点得到吗：在元素（和屏幕相交的那块）里取 5 个点，看最上面的是不是它自己 / 它里面的东西
  const hits = (el, r) => { const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, VW), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, VH); if (x1 - x0 < 1 || y1 - y0 < 1) return { n: 0, off: true, cover: null };
    let n = 0, cover = null; for (const [fx, fy] of [[.5, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]]) { const h = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy); if (h && inside(el, h)) n++; else if (h && !cover) cover = h; } return { n, off: false, cover }; };
  // 在能滚的盒子（弹窗、对战的招式栏……）里：只算露在盒子里的那一块；整个滚出去了的不看
  const viewOf = (el, r) => { let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let e = el.parentElement; e && e !== document.body && e !== de; e = e.parentElement) { const cs = getComputedStyle(e), q = e.getBoundingClientRect();
      if (/auto|scroll/.test(cs.overflowX)) { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (/auto|scroll/.test(cs.overflowY)) { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
      if (cs.position === 'fixed') break; }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }; };
  const scrollerOf = (el, axis) => { for (let e = el.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e), o = axis === 'x' ? cs.overflowX : cs.overflowY; if ((o === 'auto' || o === 'scroll') && (axis === 'x' ? e.scrollWidth > e.clientWidth + 1 : e.scrollHeight > e.clientHeight + 1)) return e; if (cs.position === 'fixed') break; } return null; };
  const pageScrollsY = de.scrollHeight > VH + 1 && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(de).overflowY !== 'hidden';
  const inFixed = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
  // 在一层固定的画面里（大地图、聊天、弹窗……），而且那一层自己在屏幕上（收在屏幕外面的提示条不算）
  const fixedOn = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') { const q = e.getBoundingClientRect(); return q.bottom > 0 && q.top < VH && q.right > 0 && q.left < VW; } return false; };
  const add = (k, el, r, more) => { if (out.problems.length < 400) out.problems.push(Object.assign({ k, sel: sel(el), text: txt(el), rect: R(r) }, more || {})); };

  // 1. 整页横向超出
  if (de.scrollWidth > VW + 1 || document.body.scrollWidth > VW + 1) out.problems.push({ k: 'page-wider', sel: 'html', text: '', rect: [0, 0, de.scrollWidth, 0], by: Math.max(de.scrollWidth, document.body.scrollWidth) - VW });

  // 2. 能点的东西
  const seen = {}, tapList = [];
  document.querySelectorAll('button, a[href], input, select, textarea, summary, [data-act], [role=button], [data-dir]').forEach(el => {
    if (el.disabled && el.tagName !== 'BUTTON') return;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !shown(el)) return;
    const pe = getComputedStyle(el).pointerEvents === 'none';
    const v = viewOf(el, r); if (v.width < 1 || v.height < 1) return;
    const h = hits(el, v);
    const k0 = key(el); seen[k0] = (seen[k0] || 0) + 1; const k = k0 + (seen[k0] > 1 ? '~' + seen[k0] : '');
    if (h.off) { // 整个在屏幕外：页面能滚到的不算；滚不到的（固定画面、横屏一屏高）才是问题
      if (r.bottom > 0 && r.top < VH && (r.right <= 0 || r.left >= VW) && !scrollerOf(el, 'x')) add('offscreen-x', el, r, { by: r.right <= 0 ? Math.round(-r.left) : Math.round(r.right - VW) });
      else if (r.top >= VH && !scrollerOf(el, 'y') && fixedOn(el)) add('unreachable-y', el, r, { by: Math.round(r.bottom - VH) });
      return;
    }
    if (pe) return;
    if (!h.n) { // 在屏幕里但 5 个点都点不到：被别的东西盖住了。盖它的是铺满大半个屏幕的一层（弹窗、聊天、向导）就不算
      const c = h.cover, cr = c && c.getBoundingClientRect(); let layer = false;
      for (let e = c; e && e !== document.body; e = e.parentElement) { const q = e.getBoundingClientRect(), cs = getComputedStyle(e); if ((cs.position === 'fixed' || cs.position === 'absolute') && q.width * q.height > VW * VH * .6) { layer = true; break; } }
      let bar = false; for (let e = c; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'sticky') bar = true;   // 页面滚上去、钻到顶栏下面的不算
      if (c && c.closest('#fb')) bar = true;   // 答完题弹上来的那条（盖住下面的题目是本意）
      if (c && !layer && !bar) add('covered', el, r, { by: sel(c), coverRect: cr ? R(cr) : null });
      return;
    }
    out.rects[k] = R(r).concat([txt(el)]);
    tapList.push({ el, r, k });
    // 2a. 一部分在屏幕外（横向）
    if (r.left < -1 || r.right > VW + 1) { const sc = scrollerOf(el, 'x'); add(sc ? 'offscreen-x-scroller' : 'offscreen-x', el, r, { by: Math.round(Math.max(-r.left, r.right - VW)), scroller: sc ? sel(sc) : '' }); }
    // 2b. 一部分在屏幕下面 / 上面而且滚不到
    if ((r.bottom > VH + 1 || r.top < -1) && !scrollerOf(el, 'y') && fixedOn(el)) add('cut-y', el, r, { by: Math.round(Math.max(-r.top, r.bottom - VH)) });
    // 2c. 太小（小于 32×32）：包在更大的能点的东西里面的不算
    const big = el.parentElement && el.parentElement.closest('button, label, [data-act], summary');
    if ((r.width < 32 || r.height < 32) && !big && !(el.tagName === 'INPUT' && el.closest('label'))) add('small', el, r, { link: /\blink\b/.test(el.className || '') || el.tagName === 'A' });
    // 2c'. iPhone 特有的两样（在 Windows 的 WebKit 里看不出来，只能按规则查）：
    //   · 输入框字号小于 16px：一聚焦 iOS 就把整页放大；
    //   · 不是按钮 / 链接 / 输入框却要响应点击（带 data-act）的元素没有 cursor: pointer：点击是在 document 上统一接的，iPhone 上这种元素不发 click
    const cs0 = getComputedStyle(el);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|range|file|button|submit|color)$/.test(el.type || '') && parseFloat(cs0.fontSize) < 16) add('input-zoom', el, r, { fontSize: cs0.fontSize });
    if (!/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY)$/.test(el.tagName) && !el.closest('button, a[href], label, summary') && cs0.cursor !== 'pointer') add('ios-click', el, r, { cursor: cs0.cursor });
    // 2d. 被不能滚的祖先裁掉一块
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && e !== el.parentElement) break;
      const q = e.getBoundingClientRect(), cx = /hidden|clip/.test(cs.overflowX), cy = /hidden|clip/.test(cs.overflowY);
      const dx = cx ? Math.max(q.left - r.left, r.right - q.right) : 0, dy = cy ? Math.max(q.top - r.top, r.bottom - q.bottom) : 0;
      if (dx > 2 || dy > 2) { add('clipped', el, r, { by: Math.round(Math.max(dx, dy)), axis: dx > dy ? 'x' : 'y', clipper: sel(e) }); break; } }
  });
  // 2e. 两个能点的东西叠在一起（谁也不在谁里面），重叠超过 6×6
  const stuck = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'sticky') return true; return false; };   // 粘在边上的按钮（弹窗底下的「完成」）盖住滚动的内容是本意
  for (let i = 0; i < tapList.length; i++) for (let j = i + 1; j < tapList.length; j++) { const a = tapList[i], b = tapList[j]; if (inside(a.el, b.el) || stuck(a.el) || stuck(b.el)) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 6 && h > 6 && out.problems.length < 400) out.problems.push({ k: 'overlap', sel: sel(a.el), text: txt(a.el), rect: R(a.r), with: sel(b.el), withText: txt(b.el), withRect: R(b.r), area: Math.round(w) + '×' + Math.round(h) }); }

  // 3. 被裁掉的内容：overflow 藏起来的盒子里装不下（横向：字被裁；纵向：下面的东西看不到）
  document.querySelectorAll('body *').forEach(el => {
    if (el.children.length > 60 || el.tagName === 'CANVAS' || el.tagName === 'SVG' || el.closest('svg')) return;
    const cs = getComputedStyle(el), ox = /hidden|clip/.test(cs.overflowX), oy = /hidden|clip/.test(cs.overflowY);
    if (!ox && !oy) return;
    const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
    if (!(ox && dx > 1) && !(oy && dy > 3)) return;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > VH || r.right < 0 || r.left > VW || !shown(el)) return;
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (!t) return;
    const h = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), VW - 1), Math.min(Math.max(r.top + r.height / 2, 0), VH - 1));
    if (!h || !(inside(el, h))) return;   // 自己被别的一层盖着（弹窗后面的首页）
    if (ox && dx > 1) add('text-clip-x', el, r, { by: dx, ellipsis: cs.textOverflow === 'ellipsis', nowrap: cs.whiteSpace === 'nowrap' });
    if (oy && dy > 3) { // 找出第一个被裁在下面的有字 / 能点的东西
      let cut = null; el.querySelectorAll('button, [data-act], p, b, small, span, li, h2, h3, label, div').forEach(c => { if (cut) return; const q = c.getBoundingClientRect(); if (q.height > 0 && q.bottom > r.bottom + 2 && (c.innerText || '').trim() && getComputedStyle(c).position !== 'absolute') cut = c; });
      if (cut) add('content-clip-y', el, r, { by: dy, cut: sel(cut), cutText: txt(cut), fixed: inFixed(el) }); }
  });

  // 4. 要紧的元素在哪里（两个引擎之间比）
  (arg && arg.keys || []).forEach(s => { const el = document.querySelector(s); if (!el) return; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !shown(el)) return; out.rects['@' + s] = R(r).concat(['']); });
  return out;
}
// 两个引擎之间要比位置的元素
const KEYS = ['#topbar', '#tabs', '#quests', '#mon-home', '#quiz-home', '#talk-home', '.tools', '#map', '.p-top', '#p-body', '#fb', '#result', '.b-hud', '#b-arena', '#b-panel', '#b-msg', '.w-hud', '#w-view', '#w-view canvas.w-canvas',
  '#w-joy', '.joy-base', '#world .ab', '#w-dlg', '#sheet', '#pin-pad', '.tk-box', '.tk-mic', '#su-box', '.su-tabs', 'canvas.b3d', '.gate-card', '.tk-home', '.tk-list', '.report', '.dex-grid'];

module.exports = { ROOT, OUT, PW, FN, serve, launch, open, SAVE, SCAN, KEYS, VIEW, IPHONE, TODAY, initScript, fakeMic };
