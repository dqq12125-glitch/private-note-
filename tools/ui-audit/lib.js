// 回声岛 · 细节检查（tools/ui-audit/）的公用工具：屏幕尺寸和安全区、开页面、在页面里跑的检查 AUDIT。只读，不改游戏。
//   · VIEWS         要查的屏幕（CSS 像素）和各自的安全区（刘海 / 灵动岛 / 底部横条；安卓 APK 的壳留了黑边，安全区是 0）
//   · serve(over)   本机小网站（复用 tools/ios/lib.js 的那一套规矩：只绑 127.0.0.1、不给看 android/ ios/ server/ 这些目录）；
//                   over = 一个目录：里面有的文件优先用它（「改之前」的对比：把 git 里 HEAD 的老文件放进去）
//   · open()        开一页：假原生桥（App 模式：AI 打分、话筒）、iPhone 的标记（html.echo-ios）、注入安全区（CDP 不行就改写 env()）、界面语言、新老画风
//   · AUDIT()       在页面里跑：要紧的按钮够不够得着（在屏幕里、在安全区里、不用滚、没被盖住）、不同的层之间字压字、字被裁掉 / 省略号、按钮太小、要滚才看得到的主要按钮
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const IL = require('../ios/lib');
const ROOT = IL.ROOT, FN = IL.FN;
const OUT = path.join(ROOT, 'tests', 'screenshots', 'ui-audit');

// 屏幕：iPhone 17 这一档、小 iPhone（SE / 8 这一档，没有刘海，竖屏上面是 20px 的状态栏）、REDMI Turbo 5 这一档（安卓）、平板
const VIEWS = {
  'ip17-p': { w: 402, h: 874, ins: { top: 62, bottom: 34, left: 0, right: 0 }, ios: true },
  'ip17-l': { w: 874, h: 402, ins: { top: 0, bottom: 21, left: 62, right: 62 }, ios: true },
  'se-p': { w: 375, h: 667, ins: { top: 20, bottom: 0, left: 0, right: 0 }, ios: true },
  'se-l': { w: 667, h: 375, ins: { top: 0, bottom: 0, left: 0, right: 0 }, ios: true },
  'redmi-p': { w: 460, h: 1002, ins: { top: 0, bottom: 0, left: 0, right: 0 }, ios: false },
  'redmi-l': { w: 1002, h: 460, ins: { top: 0, bottom: 0, left: 0, right: 0 }, ios: false },
  'tab-p': { w: 820, h: 1180, ins: { top: 24, bottom: 20, left: 0, right: 0 }, ios: true },
};

const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp',
  jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8' };
const DENY = /^[\\/](android|ios|server|node_modules|art|dl|cloud|\.git|\.claude)([\\/]|$)/i;
function serve(over) {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]);
      if (rel === '/__blank.html') { r.writeHead(200, { 'Content-Type': MIME.html, 'Cache-Control': 'no-store' }); return r.end('<!doctype html><meta charset="utf-8"><title>blank</title><body></body>'); }
      const sub = rel === '/' ? 'index.html' : rel.replace(/^[\\/]+/, '');
      let file = path.normalize(path.join(ROOT, sub));
      if (!file.startsWith(ROOT) || DENY.test(file.slice(ROOT.length))) { r.writeHead(404); return r.end(); }
      if (over) { const o = path.normalize(path.join(over, sub)); if (o.startsWith(over) && fs.existsSync(o)) file = o; }
      fs.readFile(file, (e, buf) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        r.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res({ close: () => s.close(), base: 'http://127.0.0.1:' + s.address().port }));
  });
}

// 测试存档（和 tools/ios/lib.js 的 SAVE 一样，外加界面语言、App 模式下口语 AI 打分）
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());
const ALL_CH = Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]));
function SAVE(o) {
  o = o || {};
  const s = IL.SAVE({ mode: o.mode || 'auto', gfx: o.gfx || '2d', tab: o.tab || 'mon' });
  s.settings.ui = o.lang || 'zh';
  s.settings.storyZh = 'always';
  s.stars = { '0-0': 3, '0-1': 2 };
  s.rev = { v: 1, items: { 'word:0:0': { k: 'word', w: 0, i: 0, b: 0, due: '2000-01-01', x: 1 }, 'sent:0:1': { k: 'sent', w: 0, i: 1, b: 2, due: TODAY, x: 0 }, 'dlg:0:2': { k: 'dlg', w: 0, i: 2, b: 1, due: TODAY, x: 0 } } };
  if (o.world) Object.assign(s.world, o.world);
  if (o.flags) Object.assign(s.world.flags, o.flags);
  if (o.badges) s.mon.badges = o.badges;
  if (o.bag) s.mon.bag = o.bag;
  if (o.extra) Object.assign(s, o.extra);
  return s;
}

// 开一页。o：{ view, lang, look: 'new' | '', bridge: 假原生桥的选项（false = 网页版）, query }
async function open(browser, base, o) {
  const V = VIEWS[o.view];
  const vp = { width: V.w, height: V.h };
  const ctx = await browser.newContext({ viewport: vp, screen: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IL.IPHONE.userAgent, locale: o.lang === 'en' ? 'en-US' : 'zh-CN' });
  await ctx.route(u => /^https?:$/.test(u.protocol) && !u.href.startsWith(base + '/'), r => r.abort());
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000); p.setDefaultNavigationTimeout(45000);
  await p.addInitScript(IL.initScript, 'ws://127.0.0.1:9');
  if (o.bridge !== false) {
    await p.addInitScript(FN.install, Object.assign({ key: 'sk-fake', net: 'offline', mic: 'granted', pin: '1234', platform: V.ios ? 'ios' : 'android' }, o.bridge || {}));
    if (V.ios) await p.addInitScript(() => { window.ECHO_IOS = 1; const mark = () => { if (document.documentElement) document.documentElement.classList.add('echo-ios'); }; mark(); document.addEventListener('DOMContentLoaded', mark); });
  }
  // 另外的假东西（聊天用的假阿里云：bridge: false 时自己装 window.EchoNative）；iPhone 屏幕上照样加 html.echo-ios
  for (const f of o.init || []) await p.addInitScript(f);
  if (o.bridge === false && V.ios && o.init && o.init.length) await p.addInitScript(() => { window.ECHO_IOS = 1; const mark = () => { if (document.documentElement) document.documentElement.classList.add('echo-ios'); }; mark(); document.addEventListener('DOMContentLoaded', mark); });
  await p.addInitScript(IL.fakeMic);
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
  // 安全区：CDP 的 Emulation.setSafeAreaInsetsOverride（tools/ios/safearea.js 一样的办法）；不行就把 css / js 里的 env(safe-area-inset-x) 换成像素值
  const ins = V.ins;
  let how = 'cdp';
  const cdp = await ctx.newCDPSession(p);
  try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: ins.top, topMax: ins.top, left: ins.left, leftMax: ins.left, bottom: ins.bottom, bottomMax: ins.bottom, right: ins.right, rightMax: ins.right } }); }
  catch (e) {
    how = 'rewrite';
    await ctx.route(u => u.href.startsWith(base + '/') && /\.(css|js)(\?|$)/.test(u.pathname + u.search), async r => { const resp = await r.fetch(); let body = await resp.text(); body = body.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*)?\)/g, (m, k) => ins[k] + 'px'); r.fulfill({ response: resp, body }); });
  }
  const W = ms => p.waitForTimeout(ms), E = (f, a) => p.evaluate(f, a);
  await p.goto(base + '/__blank.html');
  let cur = null, curQ = null;
  const t = {
    ctx, p, W, E, cdp, errs, how, view: o.view, V, lang: o.lang, look: o.look || '', base,
    until: async (fn, max, gap) => { for (let i = 0; i < (max || 60); i++) { try { if (await fn()) return true; } catch (e) { /* 页面正在换 */ } await W(gap || 120); } return false; },
    async settle(ms) { await W(ms == null ? 350 : ms); await E(() => Promise.race([new Promise(r => setTimeout(r, 900)), Promise.all(document.getAnimations().filter(a => { try { return a.effect && a.effect.getComputedTiming().iterations !== Infinity; } catch (e) { return false; } }).map(a => a.finished.catch(() => {})))])).catch(() => {}); await E(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {}); },
    // 换存档打开（和上一次一样就不重开）；ls：额外的 localStorage
    async boot(save, query, ls, force) {
      const key = JSON.stringify([save, query || '', ls || null]);
      if (!force && !t.fresh && key === cur) { await t.reset(); return; }
      t.fresh = false;
      cur = key;
      const q = [(query || '').replace(/^\?/, ''), o.look ? 'look=' + o.look : ''].filter(Boolean).join('&');
      await p.goto(base + '/__blank.html');
      await E(([sv, ls]) => { localStorage.clear(); if (sv) localStorage.setItem('echo-island-v1', JSON.stringify(sv)); Object.entries(ls || {}).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9'); }, [save, ls || null]);
      await p.goto(base + '/index.html' + (q ? '?' + q : ''));
      curQ = q;
      await p.waitForFunction(() => !!window.EchoGame, null, { timeout: 45000 });
      await t.settle(500);
      await E(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove())).catch(() => {});
    },
    // 回到首页（关弹窗、退出大地图 / 对战 / 聊天）
    async reset() {
      await E(() => { try { if (window.EchoTalk && EchoTalk.endIfOpen) EchoTalk.endIfOpen(); } catch (e) {} const o = document.querySelector('#tk-ov'); if (o) o.remove(); const pl = document.querySelector('#place'); if (pl) pl.remove(); try { EchoGame.closeModal(); } catch (e) {} }).catch(() => {});
      await E(() => { const w = document.querySelector('#world'); if (w && !w.hidden) { const d = EchoWorld._debug(); if (d.dlg) { d.dlg.onDone = null; } } }).catch(() => {});
      await E(() => { try { EchoGame.goHome('mon'); } catch (e) {} window.scrollTo(0, 0); document.querySelectorAll('#toasts .toast').forEach(x => x.remove()); }).catch(() => {});
      await W(200);
    },
    home: tab => E(tab => { EchoGame.closeModal(); EchoGame.goHome(tab); window.scrollTo(0, 0); }, tab),
    act: (a, extra) => E(([a, extra]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, extra || {}); b.style.display = 'none'; document.body.appendChild(b); b.click(); b.remove(); }, [a, extra || null]),
    click: sel => E(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel),
    dbg: () => E(() => { const d = EchoWorld._debug(); return { map: d.M && d.M.id, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: !!d.busy, kind: d.R && d.R.kind }; }),
    async enterWorld() {
      await t.home('mon'); await W(150);
      await E(() => { const b = document.querySelector('[data-act=wEnter]'); if (b) b.click(); });
      await p.waitForFunction(() => { try { const d = EchoWorld._debug(); return !document.querySelector('#world').hidden && d.R && d.M && (d.R.kind === '2d' || !d.R.info || d.R.info().render.frame > 2); } catch (e) { return false; } }, null, { timeout: 60000 });
      await W(400); await t.closeDlg(); await t.settle(300);
    },
    // 换地图、关掉训练师的视线（不被拉去对战）
    async go(id, how) { await E(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await p.waitForFunction(id => EchoWorld._debug().M.id === id, id, { timeout: 20000 }).catch(() => {}); await E(() => EchoWorld._debug().M.npcs.forEach(n => { n.sight = 0; })).catch(() => {}); await W(500); },
    tp: (x, y, dir) => E(([x, y, dir]) => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir || d.PL.dir; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; }, [x, y, dir]),
    A: () => E(() => { const a = document.querySelector('#world [data-act=wA].ba'); if (a) a.click(); }),
    // 对话框开着就一页页点掉（要选的时候选最后一个；任务页：自评点「说完了」、AI 打分点「跳过」，都没有就关掉整段对话）
    async closeDlg(max) { for (let i = 0; i < (max || 40) && await E(() => !!EchoWorld._debug().dlg); i++) { await E(() => { const d = EchoWorld._debug(), pg = d.dlg && d.dlg.pages[d.dlg.i]; const pk = document.querySelectorAll('#w-dlg [data-act=wPick]'); if (pk.length) { pk[pk.length - 1].click(); return; } if (pg && pg.kind) { pg.kind = null; d.dlg.pages.length = d.dlg.i + 1; } const a = document.querySelector('#world [data-act=wA].ba'); if (a) a.click(); }); await W(120); } },
    // 一直按 A，直到对话出现任务（说 / 选 / 选项 / 自定义）或者对话结束；返回当前页的 kind
    async toTask(max) { for (let i = 0; i < (max || 25); i++) { const k = await E(() => { const d = EchoWorld._debug(); if (!d.dlg) return 'none'; const pg = d.dlg.pages[d.dlg.i]; if (d.dlg.typing) return 'typing'; return pg && pg.kind ? pg.kind : ''; }); if (k === 'none' || (k && k !== 'typing')) return k; await t.A(); await W(140); } return '?'; },
    // 在对话框里按 A 直到打完字
    async typed() { for (let i = 0; i < 60; i++) { const ty = await E(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }); if (!ty) return; await W(60); } },
    // 站到一个人面前（满足条件的第一个人）
    faceNpc: pred => E(src => { const d = EchoWorld._debug(), f = src ? new Function('n', 'return (' + src + ')(n)') : () => true; const ok = (x, y) => { const c = d.M.grid[y] && d.M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && !d.M.npcs.some(q => q.x === x && q.y === y); };
      for (const n of d.M.npcs) { if (!f(n)) continue; for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) if (ok(n.x + dx, n.y + dy)) { d.PL.x = d.PL.fx = n.x + dx; d.PL.y = d.PL.fy = n.y + dy; d.PL.dir = dir; d.PL.moving = false; d.FL.x = d.FL.fx = d.PL.x; d.FL.y = d.FL.fy = d.PL.y; return { id: n.id, role: n.role, name: n.name }; } } return null; }, pred ? pred.toString() : null),
    // 转屏，照 iPhone 的顺序：先发 resize 事件，过一会儿元素才变大小（安全区跟着换）
    async rotate(to) {
      const V2 = VIEWS[to], i2 = V2.ins;
      // 浏览器自己在改大小以后发的 resize 先拦下（iPhone 上就是只有排版前那一次），这样只看「量元素」的写法跟不跟得上
      await E(() => { if (!window.__blockRz) { window.__blockRz = e => { if (e.isTrusted) e.stopImmediatePropagation(); }; window.addEventListener('resize', window.__blockRz, true); }
        window.dispatchEvent(new Event('resize')); try { window.dispatchEvent(new Event('orientationchange')); } catch (e) { /* 没有这个事件 */ } });
      await W(60);
      try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: i2.top, topMax: i2.top, left: i2.left, leftMax: i2.left, bottom: i2.bottom, bottomMax: i2.bottom, right: i2.right, rightMax: i2.right } }); } catch (e) { /* 改写 env() 的办法转不了安全区 */ }
      await p.setViewportSize({ width: V2.w, height: V2.h });
      t.view = to; t.V = V2;
      await W(1100);
      await E(() => { if (window.__blockRz) { window.removeEventListener('resize', window.__blockRz, true); window.__blockRz = null; } });
    },
    clearToasts: () => E(() => document.querySelectorAll('#toasts .toast').forEach(x => x.remove())).catch(() => {}),
  };
  return t;
}

// ---------- 在页面里跑的检查 ----------
// a = { ins: {top,bottom,left,right}, primary: [选择器], ellipsisOk: [选择器], tap: 最小边长, scope: 只看这一块里的字（可省） }
// 返回 { vw, vh, problems: [{ k, sev, sel, text, rect, ... }], stats }
function AUDIT(a) {
  const VW = innerWidth, VH = innerHeight, I = a.ins || { top: 0, bottom: 0, left: 0, right: 0 }, de = document.documentElement;
  const out = { vw: VW, vh: VH, problems: [], primary: 0 };
  const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  const txt = el => (el.getAttribute && el.getAttribute('aria-label') || el.innerText || el.value || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const one = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.dataset && e.dataset.act ? '[data-act=' + e.dataset.act + ']' : '');
  const sel = el => { if (!el || el.nodeType !== 1) return ''; const p = el.parentElement; return (p && p !== document.body && !el.id ? one(p) + ' > ' : '') + one(el); };
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; if (e !== el && e.tagName === 'DETAILS' && !e.open && !el.closest('summary')) return false; if (e.hidden) return false; } return true; };
  const inside = (x, y) => x === y || x.contains(y) || y.contains(x);
  const area = (r, q) => Math.max(0, Math.min(r.right, q.right) - Math.max(r.left, q.left)) * Math.max(0, Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top));
  const isect = (r, q) => ({ left: Math.max(r.left, q.left), top: Math.max(r.top, q.top), right: Math.min(r.right, q.right), bottom: Math.min(r.bottom, q.bottom) });
  const add = (k, sev, el, r, more) => { if (out.problems.length < 300) out.problems.push(Object.assign({ k, sev, sel: sel(el), text: txt(el), rect: r ? R(r) : null }, more || {})); };
  const matches = (el, list) => (list || []).some(s => { try { return el.matches(s) || !!el.closest(s); } catch (e) { return false; } });
  // 能滚的祖先（真的能滚：内容比盒子大）
  const scrollerOf = (el, axis) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e), ov = axis === 'x' ? cs.overflowX : cs.overflowY; if (/auto|scroll/.test(ov) && (axis === 'x' ? e.scrollWidth > e.clientWidth + 1 : e.scrollHeight > e.clientHeight + 1)) return e; } return null; };
  const pageScrolls = () => de.scrollHeight > VH + 2 && getComputedStyle(document.body).overflowY !== 'hidden' && getComputedStyle(de).overflowY !== 'hidden';
  const fixedRoot = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return e; return null; };
  // 被祖先 overflow 裁掉以后露着的那一块
  const clipOf = (el, r) => { let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let e = el.parentElement; e && e !== document.body && e !== de; e = e.parentElement) { const cs = getComputedStyle(e), q = e.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (cs.overflowY !== 'visible') { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
      if (cs.position === 'fixed') break; }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }; };
  // 被整屏的一层（弹窗的黑底、聊天、向导、能力检测、大地图）盖在下面的东西：看不见也点不到，字和按钮的检查都不算它
  const LAYERS = ['#modal', '#tk-ov', '#setup', '#su-doc', '#place', '#world'].map(s => document.querySelector(s)).filter(e => e && !e.hidden && getComputedStyle(e).display !== 'none');
  const zOf = e => +getComputedStyle(e).zIndex || 0;
  const buried = el => { const own = LAYERS.find(M => M.contains(el)), zo = own ? zOf(own) : 0; return LAYERS.some(L => L !== own && !L.contains(el) && zOf(L) > zo); };
  const unsafe = r => { const w = []; if (I.top && r.top < I.top - 1) w.push('top'); if (I.bottom && r.bottom > VH - I.bottom + 1) w.push('bottom'); if (I.left && r.left < I.left - 1) w.push('left'); if (I.right && r.right > VW - I.right + 1) w.push('right'); return w; };

  // ===== 1. 要紧的按钮：在屏幕里、在安全区里、不用滚、没被盖住 =====
  const prim = new Set();
  (a.primary || []).forEach(s => { let list = []; try { list = [...document.querySelectorAll(s)]; } catch (e) { /* 坏选择器 */ } list.forEach(el => prim.add(el)); });
  prim.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !shown(el) || el.disabled) return;
    if (el.closest('.fb:not(.show)')) return;   // 答完题才滑上来的反馈条，平时藏在屏幕下面
    out.primary++;
    const v = clipOf(el, r), sc = scrollerOf(el, 'y');
    const offY = r.top < -1 || r.bottom > VH + 1, offX = r.left < -1 || r.right > VW + 1;
    // 在能滚的盒子里，露出来的不到一半：要滚才看得到
    const hidden = v.height < r.height * 0.5 || v.width < r.width * 0.5;
    if (hidden && sc) { add('scroll-trap', 1, el, r, { by: Math.round(r.bottom - v.bottom), scroller: sel(sc) }); return; }
    if (offY && !fixedRoot(el) && pageScrolls()) { add('scroll-trap', 1, el, r, { by: Math.round(r.bottom - VH), scroller: 'page' }); return; }
    if (offY || offX || hidden) { add('reach-off', 0, el, r, { by: Math.round(Math.max(r.bottom - VH, -r.top, r.right - VW, -r.left)) }); return; }
    const u = unsafe(v); if (u.length) add('reach-unsafe', 2, el, v, { where: u.join(',') });
    const cx = Math.min(Math.max(v.left + v.width / 2, 0), VW - 1), cy = Math.min(Math.max(v.top + v.height / 2, 0), VH - 1), h = document.elementFromPoint(cx, cy);
    if (!h || !inside(el, h)) { if (h && h.closest('#fb')) return; add('reach-covered', 0, el, r, { by: h ? sel(h) : 'nothing' }); }   // 答完题弹上来的反馈条盖住选项是本意
  });

  // ===== 1b. 画布的大小跟没跟上（转屏以后：iPhone 上 resize 事件比排版早，只在事件里量一次就会留着横屏的宽度，2026-11-20 老板的截图）=====
  document.querySelectorAll('#w-view canvas, #b-arena canvas').forEach(c => {
    const r = c.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !shown(c) || buried(c)) return;
    const box = c.parentElement.getBoundingClientRect();
    const fitCss = Math.abs(r.width - box.width) <= 4 && Math.abs(r.height - box.height) <= 4;
    const asp = c.width && c.height ? Math.abs((c.width / c.height) / (r.width / r.height) - 1) : 0;
    if (!fitCss || asp > 0.06) add('stale-size', 0, c, r, { box: [Math.round(box.width), Math.round(box.height)], px: [c.width, c.height] });
  });

  // ===== 2. 能点的东西太小（看得见、在屏幕里、点得到的） =====
  const taps = new Set();
  document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary, [data-act], [role=button], [data-dir]').forEach(el => {
    if (el.disabled || taps.has(el)) return;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !shown(el)) return;
    const v = clipOf(el, r); if (v.width < 4 || v.height < 4 || v.right < 0 || v.left > VW || v.bottom < 0 || v.top > VH) return;
    if (getComputedStyle(el).pointerEvents === 'none' || buried(el)) return;
    const big = el.parentElement && el.parentElement.closest('button, label, [data-act], summary, a[href]');
    if (big) return;
    const h = document.elementFromPoint(Math.min(Math.max(v.left + v.width / 2, 0), VW - 1), Math.min(Math.max(v.top + v.height / 2, 0), VH - 1));
    if (!h || !inside(el, h)) return;
    taps.add(el);
    const m = Math.min(r.width, r.height);
    if (m < (a.tap || 40) - 0.5 && !(el.tagName === 'INPUT' && /checkbox|radio/.test(el.type) && el.closest('label'))) add('tap-small', m < 32 ? 3 : 4, el, r, { size: Math.round(r.width) + '×' + Math.round(r.height) });
  });

  // ===== 3. 字：被裁掉、省略号、出了屏幕 / 安全区 =====
  const texts = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), seenEl = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || seenEl.has(el) || el.closest('script, style, svg, #__audit, canvas, noscript')) continue;
    if (a.scope && !el.closest(a.scope)) continue;
    seenEl.add(el);
    if (!shown(el) || buried(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(el);
    // 只算这个元素自己的字（不算里面别的元素）：一个个文字节点的框拼起来
    let r = null; for (const c of el.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { const q = document.createRange(); q.selectNodeContents(c); const b = q.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue; r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }
    if (!r) continue;
    // 自己就是裁字的盒子（省略号、overflow: hidden）：字只算露在自己框里的那一截
    { const cs0 = getComputedStyle(el); if (cs0.overflowX !== 'visible' || cs0.overflowY !== 'visible') { const b = el.getBoundingClientRect(); r = { left: Math.max(r.left, b.left), top: Math.max(r.top, b.top), right: Math.min(r.right, b.right), bottom: Math.min(r.bottom, b.bottom) }; } }
    r.width = r.right - r.left; r.height = r.bottom - r.top;
    const v = clipOf(el, r);
    if (v.width < 1 || v.height < 1) continue;   // 整个滚出去了 / 被裁掉了（能滚的盒子里没露出来的字不算）
    if (v.bottom < 0 || v.top > VH || v.right < 0 || v.left > VW) continue;
    texts.push({ el, r, v });
    const cs = getComputedStyle(el);
    // 3a. 自己装不下：省略号 / 被藏起来的那截
    const ox = /hidden|clip/.test(cs.overflowX), oy = /hidden|clip/.test(cs.overflowY);
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    if ((ox && el.scrollWidth > el.clientWidth + 1) || (clamp && el.scrollHeight > el.clientHeight + 2) || (oy && !clamp && el.scrollHeight > el.clientHeight + 3)) {
      const ell = cs.textOverflow === 'ellipsis' || clamp;
      if (ell && matches(el, a.ellipsisOk)) { /* 允许省略的（目标那一行、地名） */ }
      else add(ell ? 'ellipsis' : 'clip', 2, el, r, { by: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight) });
      continue;
    }
    // 3b. 被不能滚的祖先裁掉一块（能滚的盒子里的不算：滚一下就看得到）
    if (v.width < r.width - 3 || v.height < r.height - 3) {
      let clipper = null; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e), q = e.getBoundingClientRect(); if ((/hidden|clip/.test(s.overflowX) && (q.left > r.left + 2 || q.right < r.right - 2)) || (/hidden|clip/.test(s.overflowY) && (q.top > r.top + 2 || q.bottom < r.bottom - 2))) { clipper = e; break; } if (/auto|scroll/.test(s.overflowY + s.overflowX)) break; if (s.position === 'fixed') break; }
      if (clipper && !matches(el, a.ellipsisOk)) add('clip', 2, el, r, { by: Math.round(Math.max(r.width - v.width, r.height - v.height)), clipper: sel(clipper) });
    }
    // 3c. 出了屏幕（固定的层里、滚不到的）
    if ((r.right > VW + 2 || r.left < -2) && !scrollerOf(el, 'x')) add('text-off', 1, el, r, { by: Math.round(Math.max(r.right - VW, -r.left)) });
    else if (r.bottom > VH + 2 && fixedRoot(el) && !scrollerOf(el, 'y')) add('text-off', 1, el, r, { by: Math.round(r.bottom - VH) });
  }

  // ===== 4. 不同的层之间压在一起：字压在别的框上、字被别的框盖住 =====
  // 「框」：定了位（absolute / fixed / sticky）、有底色或边框、不是铺满屏幕的那种（大地图画面、弹窗的黑底）；外加定了位的按钮（A / B、指北针）
  // 这一段要用 elementFromPoint 看「谁在上面」：先临时让 pointer-events: none 的东西也接得到点（HUD 上的地名就是 none）
  const st = document.createElement('style'); st.id = '__audit'; st.textContent = '* { pointer-events: auto !important; }'; document.head.appendChild(st);
  // 这一点上最上面「画出来」的东西：跳过空的透明层（特效层、摇杆区、转镜头的那一层……它们平时 pointer-events: none，上面临时打开了）
  const paints = e => { if (e.tagName === 'CANVAS' && getComputedStyle(e).position === 'fixed') return false;   // 铺满屏幕的特效画布（彩带）：透明的，平时不接手指
    if (/^(IMG|CANVAS|SVG|INPUT|TEXTAREA|SELECT|VIDEO)$/i.test(e.tagName)) return true; for (const c of e.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) return true;
    const cs = getComputedStyle(e), m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor), al = m ? (m[1].split(',').map(Number)[3] ?? 1) : 0;
    return al > 0.05 || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none'; };
  const topAt = (x, y) => { for (const e of document.elementsFromPoint(x, y)) { if (e.closest('#__audit_mark')) continue; if (paints(e)) return e; } return null; };
  try {
    const panels = [];
    document.querySelectorAll('body *').forEach(el => {
      if (el.closest('svg, #__audit')) return;
      const cs = getComputedStyle(el); if (!/absolute|fixed|sticky/.test(cs.position)) return;
      const r = el.getBoundingClientRect(); if (r.width < 16 || r.height < 16 || r.width * r.height >= VW * VH * 0.9 || !shown(el)) return;
      if (r.bottom < 0 || r.top > VH || r.right < 0 || r.left > VW) return;
      const bg = cs.backgroundColor, alpha = /rgba?\(([^)]+)\)/.test(bg) ? (bg.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number)[3] ?? 1) : 1;
      // 有底色、或者有边框 / 阴影的渐变（对话框、HUD 的渐变底不算框——HUD 压在别人上面由它的字来查；装饰用的光晕也不算）
      const painted = (alpha > 0.25 && bg !== 'transparent') || parseFloat(cs.borderTopWidth) >= 2 || (cs.backgroundImage !== 'none' && !/radial/.test(cs.backgroundImage) && cs.boxShadow !== 'none');
      if (!painted) return;
      panels.push({ el, r: clipOf(el, r), fixed: cs.position === 'fixed', sticky: cs.position === 'sticky' });
    });
    // 3d. 字伸进刘海 / 灵动岛 / 圆角（左右和上面；底部横条那一条只查能点的）。只算看得见的字：被弹窗的黑底、粘在顶上的栏盖住的不算
    texts.forEach(T => { const u = unsafe(T.v).filter(w => w !== 'bottom'); if (!u.length) return;
      const h = topAt(Math.min(Math.max((T.v.left + T.v.right) / 2, 0), VW - 1), Math.min(Math.max((T.v.top + T.v.bottom) / 2, 0), VH - 1));
      if (h && (T.el === h || T.el.contains(h))) add('text-unsafe', 3, T.el, T.v, { where: u.join(',') }); });
    const seenPair = new Set();
    texts.forEach(T => {
      panels.forEach(P => {
        if (inside(P.el, T.el)) return;   // 字在框里面（或者框在字的元素里面）
        const q = isect(T.v, P.r), w = q.right - q.left, h = q.bottom - q.top;
        if (w < 4 || h < 4 || w * h < 30) return;
        const cx = (q.left + q.right) / 2, cy = (q.top + q.bottom) / 2, hit = topAt(cx, cy);
        if (!hit) return;
        const kp = sel(T.el) + '|' + sel(P.el); if (seenPair.has(kp)) return;
        if (inside(P.el, hit) && !T.el.contains(hit)) {
          // 框在字上面：字被盖住。粘在滚动内容上面的顶栏、答完题弹上来的反馈条盖住下面的题目、点一个词弹出的小卡（#wd-pop，弹在点到的地方）是本意
          if (P.sticky || P.el.closest('#fb') || P.el.closest('#wd-pop')) return;
          // 字在一层铺满屏幕的东西下面（弹窗的黑底、聊天界面），被那一层里的框盖住：本来就看不见，不算
          let under = false; for (let e = hit; e && e !== document.body; e = e.parentElement) { const qq = e.getBoundingClientRect(), s = getComputedStyle(e); if ((s.position === 'fixed' || s.position === 'absolute') && qq.width * qq.height >= VW * VH * 0.9 && !e.contains(T.el)) { under = true; break; } }
          if (under) return;
          seenPair.add(kp);
          add(P.el.closest('.toast') ? 'toast' : 'covered', P.el.closest('.toast') ? 4 : 1, T.el, T.v, { by: sel(P.el), byText: txt(P.el).slice(0, 30), area: Math.round(w) + '×' + Math.round(h) });
        } else if ((T.el === hit || T.el.contains(hit)) && !P.sticky) {   // 粘在顶上的栏下面滚过去的内容（首页往下滚的那一下）不算
          // 字在一层铺满屏幕的东西里（向导、聊天、弹窗），框在那一层下面（首页的顶栏）：框本来就看不见，不算
          let over = false; for (let e = T.el; e && e !== document.body; e = e.parentElement) { const qq = e.getBoundingClientRect(), s = getComputedStyle(e); if ((s.position === 'fixed' || s.position === 'absolute') && qq.width * qq.height >= VW * VH * 0.9 && !e.contains(P.el)) { over = true; break; } }
          if (over) return;
          // 字在框上面：字压在别的框（对话框、按钮）上
          seenPair.add(kp);
          add(T.el.closest('.toast') ? 'toast' : 'overlap', T.el.closest('.toast') ? 4 : 1, T.el, T.v, { on: sel(P.el), onText: txt(P.el).slice(0, 30), area: Math.round(w) + '×' + Math.round(h) });
        }
      });
    });
  } finally { st.remove(); }
  return out;
}

// 截图上画出问题的框（红：够不着 / 要滚；橙：压在一起；紫：裁掉；灰：太小）
function MARK(probs) {
  const o = document.createElement('div'); o.id = '__audit_mark'; o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const col = { 'reach-off': '#e00', 'reach-covered': '#e00', 'scroll-trap': '#e00', 'reach-unsafe': '#f0a', overlap: '#f80', covered: '#f80', clip: '#80f', ellipsis: '#80f', 'text-off': '#e00', 'text-unsafe': '#f0a', 'tap-small': '#888', toast: '#aaa' };
  o.innerHTML = probs.filter(q => q.rect).map(q => '<div style="position:absolute;left:' + q.rect[0] + 'px;top:' + q.rect[1] + 'px;width:' + q.rect[2] + 'px;height:' + q.rect[3] + 'px;outline:2px solid ' + (col[q.k] || '#e00') + ';outline-offset:-1px"></div>').join('');
  document.body.appendChild(o);
}

module.exports = { ROOT, OUT, VIEWS, serve, open, SAVE, AUDIT, MARK, TODAY, ALL_CH, IL };
