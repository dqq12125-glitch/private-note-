// 回声岛 · iPhone 检查：刘海 / 灵动岛 / 底部横条会挡住什么。
// iOS 的壳子把网页铺满整个屏幕，env(safe-area-inset-*) 第一次不是 0（安卓的壳子留了黑边，一直是 0）。
// 这里在 Chromium 里用 CDP 的 Emulation.setSafeAreaInsetsOverride 把它们设成 iPhone 的数（竖屏 上 59 下 34；横屏 左右 59 下 21），再把 audit.js 那条路线走一遍。
// （装的 Chromium 没有这个命令时：自动改成拦下 css / js，把 env(safe-area-inset-x, …) 直接换成像素值——结果里的 how 写着用的哪种）
// 用法：
//   node tools/ios/safearea.js                              竖屏 + 横屏，App 模式（假原生桥 + ECHO_IOS）+ 销售版向导
//   node tools/ios/safearea.js --orients landscape --modes web,app,sales
//   node tools/ios/safearea.js --static                     只做静态那一半（列 CSS 规则），不开浏览器
//   node tools/ios/safearea.js --report                     把上次的 safearea.json 重新打印一遍
// 结果：tests/screenshots/ios/safearea.json + 截图 safe-<方向>-<步骤>.png（半透明红色 = 不安全的地方：顶上的状态栏那一条和灵动岛 126×37、横屏左右两条（岛在左边）、底部横条 134×5）
// 每一步列出：碰到不安全区域的「能点的东西」和「字」（选择器、文字、位置、碰到哪一块、进去多少像素、有没有被岛 / 横条本身压住），
//   还有贴着边的固定条（position: fixed / sticky）背景没铺到边上、露出一条缝的。
// 静态那一半：style.css（和 JS 里拼的样式）里所有 position: fixed / sticky / absolute、写了 top / bottom / left / right / inset 却没有 env(safe-area-inset…) 的规则，
//   带 文件:行号；路线里真的出了问题的标「✗ 实测有问题」。
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib'), T = require('./tour');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] || ''); };
const has = k => process.argv.includes('--' + k);
const ORIENTS = arg('orients', 'portrait,landscape').split(','), MODES = arg('modes', 'app,sales').split(',');
const JSON_OUT = path.join(L.OUT, 'safearea.json');
const INSETS = { portrait: { top: 59, bottom: 34, left: 0, right: 0 }, landscape: { top: 0, left: 59, right: 59, bottom: 21 } };
const BRIDGE = { app: { key: 'sk-fake', net: 'offline', mic: 'granted', pin: '1234' }, sales: { edition: 'sales', pin: null, key: '', net: 'offline', mic: 'granted' } };
const read = f => fs.readFileSync(path.join(L.ROOT, f), 'utf8');

// ---------- 静态：列规则 ----------
function staticScan() {
  const html = read('index.html');
  const jsFiles = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]).filter(f => !/^vendor\//.test(f) && fs.existsSync(path.join(L.ROOT, f)));
  const lineAt = (t, i) => { let n = 1; for (let k = 0; k < i; k++) if (t.charCodeAt(k) === 10) n++; return n; };
  const css = [];
  const parse = (file, text) => {
    // 最里面一层的 {…}：选择器 + 声明；外面那层 @media 记下来
    const re = /([^{}]*)\{([^{}]*)\}/g; let m;
    while ((m = re.exec(text))) {
      const body = m[2], pos = (/(?:^|[;\s{'"])position\s*:\s*(fixed|sticky|absolute)/.exec(body) || [])[1] || '';
      const anchors = [...body.matchAll(/(?:^|[;\s{'"])(top|bottom|left|right|inset(?:-block|-inline)?(?:-start|-end)?)\s*:\s*([^;]+)/g)].map(a => a[1] + ': ' + a[2].trim().slice(0, 60));
      if (!pos && !anchors.length) continue;
      const selRaw = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), sel = selRaw.split(/[;}]/).pop().trim();
      if (!sel || /^@|^(from|to|\d+%)/.test(sel) || /^\d/.test(sel)) continue;   // @keyframes 的帧
      // 外面是不是横屏那块 @media
      let depth = 0, media = ''; for (let i = m.index; i >= 0 && !media; i--) { const c = text[i]; if (c === '}') depth++; else if (c === '{') { if (depth === 0) { const a = Math.max(text.lastIndexOf('}', i - 1), text.lastIndexOf('{', i - 1), text.lastIndexOf(';', i - 1)); const head = text.slice(a + 1, i).trim(); if (/^@media/.test(head)) media = head.replace(/\s+/g, ' ').slice(0, 70); break; } depth--; } }
      css.push({ at: file + ':' + lineAt(text, m.index + m[1].length - sel.length), sel: sel.replace(/\s+/g, ' ').slice(0, 140), pos, anchors, env: /env\(\s*safe-area-inset/.test(body), media });
    }
  };
  parse('style.css', read('style.css'));
  // JS 里拼出来的样式表（talk.js、setup.js、placement.js 等自己插 <style>）：一样按规则拆
  jsFiles.forEach(f => { const t = read(f); if (/position\s*:\s*(fixed|sticky|absolute)/.test(t)) { const before = css.length; parse(f, t); css.slice(before).forEach(r => { r.js = true; }); } });
  // JS 里的内联样式 / 全屏盖层：position:fixed、inset:0、100vh
  const inline = [];
  jsFiles.forEach(f => read(f).split('\n').forEach((line, i) => { const re = /position\s*:\s*fixed|inset\s*:\s*0|100d?vh|100vw/g; let m; while ((m = re.exec(line))) inline.push({ at: f + ':' + (i + 1), what: m[0], env: /env\(\s*safe-area-inset/.test(line.slice(Math.max(0, m.index - 300), m.index + 400)), s: line.slice(Math.max(0, m.index - 70), m.index + 90).trim() }); }));
  return { css, inline };
}

// ---------- 页面里：谁碰到了不安全区域 ----------
function SAFE(a) {
  const VW = innerWidth, VH = innerHeight, I = a.insets, P = a.portrait;
  const island = P ? [VW / 2 - 63, 11, VW / 2 + 63, 48] : [11, VH / 2 - 63, 48, VH / 2 + 63];
  const homebar = [VW / 2 - 67, VH - 13, VW / 2 + 67, VH - 8];
  const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  const txt = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const one = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (e.dataset && e.dataset.act ? '[data-act=' + e.dataset.act + ']' : '');
  const sel = el => { const p = el.parentElement; return (p && p !== document.body && !el.id ? one(p) + ' > ' : '') + one(el); };
  const shown = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; if (e !== el && e.tagName === 'DETAILS' && !e.open && !el.closest('summary')) return false; } return true; };
  const inside = (x, y) => x === y || x.contains(y) || y.contains(x);
  const onTop = (el, r) => { const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, VW), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, VH); if (x1 - x0 < 1 || y1 - y0 < 1) return false;
    for (const [fx, fy] of [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]]) { const h = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy); if (h && inside(el, h)) return true; } return false; };
  // 被祖先的 overflow 裁掉以后还露着的那一块（弹窗里滚出去的内容不算）
  const clipOf = (el, r) => { let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e), q = e.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (cs.overflowY !== 'visible') { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
      if (cs.position === 'fixed') break; }
    return { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 }; };
  const cross = (r, q) => Math.min(r.right, q[2]) - Math.max(r.left, q[0]) > 1 && Math.min(r.bottom, q[3]) - Math.max(r.top, q[1]) > 1;
  // 进了哪一块、多深
  const where = r => { const w = [];
    if (I.top && r.top < I.top - 1 && r.bottom > 1) w.push(['top', Math.round(Math.min(r.bottom, I.top) - Math.max(r.top, 0))]);
    if (I.bottom && r.bottom > VH - I.bottom + 1 && r.top < VH - 1) w.push(['bottom', Math.round(Math.min(r.bottom, VH) - Math.max(r.top, VH - I.bottom))]);
    if (I.left && r.left < I.left - 1 && r.right > 1) w.push(['left', Math.round(Math.min(r.right, I.left) - Math.max(r.left, 0))]);
    if (I.right && r.right > VW - I.right + 1 && r.left < VW - 1) w.push(['right', Math.round(Math.min(r.right, VW) - Math.max(r.left, VW - I.right))]);
    return w.filter(x => x[1] > 1); };
  // 它是被哪个定了位的祖先（或自己）放到那儿的；对上了静态表里的哪几条规则
  const anchor = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky' || p === 'absolute') return { e, p }; } return null; };
  const rulesOf = e => { const ids = []; a.rules.forEach((s, i) => { try { if (e.matches(s)) ids.push(i); } catch (er) { /* 选择器里有伪元素之类 */ } }); return ids; };
  const out = { vw: VW, vh: VH, scrollY: Math.round(window.scrollY), hits: [], bars: [] };
  const taken = [];
  const push = (kind, el, r) => { const w = where(r); if (!w.length) return false; const an = anchor(el);
    out.hits.push({ kind, sel: sel(el), text: txt(el), rect: R(r), where: w.map(x => x[0] + ' ' + x[1] + 'px').join(', '), island: cross(r, island), homebar: I.bottom ? cross(r, homebar) : false,
      anchor: an ? sel(an.e) + ' (' + an.p + ')' : '（跟着页面滚的内容）', flow: !an, rules: an ? rulesOf(an.e) : [] }); return true; };
  // 能点的
  document.querySelectorAll('button, a[href], input, select, textarea, summary, [data-act], [role=button], [data-dir]').forEach(el => {
    const r = clipOf(el, el.getBoundingClientRect()); if (r.width < 1 || r.height < 1 || !shown(el) || getComputedStyle(el).pointerEvents === 'none' || !onTop(el, r)) return;
    if (taken.some(t => t.contains(el))) return;
    if (push('tap', el, r)) taken.push(el);
  });
  // 字：有自己文字的元素，按文字实际占的地方算（不是整个盒子）
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), seen = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || seen.has(el) || el.closest('script, style, #__safe')) continue; seen.add(el);
    if (taken.some(t => t.contains(el))) continue;
    const rg = document.createRange(); rg.selectNodeContents(el); const r = clipOf(el, rg.getBoundingClientRect()); if (r.width < 1 || r.height < 1) continue;
    if (!where(r).length || !shown(el)) continue;
    // 点不穿的字（pointer-events: none，比如大地图顶上的地名）量不出「是不是在最上面」：只要没被整屏的那几层（弹窗、聊天、向导、能力检测）盖着就算看得见
    if (getComputedStyle(el).pointerEvents === 'none') { if (['#modal', '#tk-ov', '#setup', '#su-doc', '.pl'].some(q => { const o = document.querySelector(q); return o && !o.hidden && !o.contains(el) && getComputedStyle(o).display !== 'none'; })) continue; }
    else if (!onTop(el, r)) continue;
    push('text', el, r);
  }
  // 贴边的固定条：背景没铺到屏幕边上（露一条缝）。position: fixed / sticky、够宽（或够高）的才看
  document.querySelectorAll('body *').forEach(el => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'sticky') return; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || !shown(el) || r.bottom < 0 || r.top > VH) return;
    if (!onTop(el, r)) return;   // 被弹窗 / 向导盖在下面的不算
    if (cs.position === 'sticky') { let boxed = false; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (/auto|scroll/.test(getComputedStyle(e).overflowY)) boxed = true; if (boxed) return; }   // 粘在弹窗 / 滚动盒子里面的（「完成」按钮）不是贴屏幕边的条
    const wide = r.width >= VW * .6, tall = r.height >= VH * .6, gaps = [];
    if (wide && I.top && r.top > 2 && r.top <= I.top + 2) gaps.push('top ' + Math.round(r.top) + 'px');
    if (wide && I.bottom && VH - r.bottom > 2 && VH - r.bottom <= I.bottom + 2) gaps.push('bottom ' + Math.round(VH - r.bottom) + 'px');
    if (tall && I.left && r.left > 2 && r.left <= I.left + 2) gaps.push('left ' + Math.round(r.left) + 'px');
    if (tall && I.right && VW - r.right > 2 && VW - r.right <= I.right + 2) gaps.push('right ' + Math.round(VW - r.right) + 'px');
    if (gaps.length) out.bars.push({ sel: sel(el), pos: cs.position, rect: R(r), gap: gaps.join(', '), bg: cs.backgroundColor, rules: rulesOf(el).slice(0, 6) }); });
  // 量一下 env() 现在到底是多少
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(d);
  const cs = getComputedStyle(d); out.env = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(parseFloat); d.remove();
  return out;
}
// 截图前盖一层半透明的红：不安全的几条 + 灵动岛 + 底部横条
function OVERLAY(a) {
  const I = a.insets, P = a.portrait, VW = innerWidth, VH = innerHeight, o = document.createElement('div'); o.id = '__safe';
  o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const band = (css) => '<div style="position:absolute;background:rgba(255,0,60,.28);outline:1px dashed rgba(255,0,60,.9);' + css + '"></div>';
  let h = '';
  if (I.top) h += band('left:0;top:0;width:100%;height:' + I.top + 'px');
  if (I.bottom) h += band('left:0;bottom:0;width:100%;height:' + I.bottom + 'px');
  if (I.left) h += band('left:0;top:0;height:100%;width:' + I.left + 'px');
  if (I.right) h += band('right:0;top:0;height:100%;width:' + I.right + 'px');
  h += P ? '<div style="position:absolute;left:' + (VW / 2 - 63) + 'px;top:11px;width:126px;height:37px;border-radius:19px;background:#000"></div>' : '<div style="position:absolute;left:11px;top:' + (VH / 2 - 63) + 'px;width:37px;height:126px;border-radius:19px;background:#000"></div>';
  h += '<div style="position:absolute;left:' + (VW / 2 - 67) + 'px;top:' + (VH - 13) + 'px;width:134px;height:5px;border-radius:3px;background:#000"></div>';
  o.innerHTML = h; document.body.appendChild(o);
}

async function runOne(browser, base, orient, mode, st) {
  const insets = INSETS[orient];
  const t = await L.open(browser, base, { engine: 'chromium', orient, bridge: mode === 'web' ? false : BRIDGE[mode], mic: mode !== 'web', save: mode === 'sales' ? null : undefined });
  // ① CDP：让 env(safe-area-inset-*) 变成 iPhone 的数
  let how = 'cdp Emulation.setSafeAreaInsetsOverride';
  t.cdp = await t.ctx.newCDPSession(t.p);
  const full = { top: insets.top, topMax: insets.top, left: insets.left, leftMax: insets.left, bottom: insets.bottom, bottomMax: insets.bottom, right: insets.right, rightMax: insets.right };
  try { await t.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: full }); } catch (e) { how = 'cdp 不支持（' + String(e.message).split('\n')[0].slice(0, 80) + '）'; }
  const measure = () => t.E(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'; document.body.appendChild(d); const cs = getComputedStyle(d), v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(parseFloat); d.remove(); return v; });
  let got = await measure();
  if (got[0] !== insets.top || got[2] !== insets.bottom || got[3] !== insets.left) {
    // ② 不行就改文件：把 css / js 里的 env(safe-area-inset-x, …) 换成像素值
    how = '改写 css / js 里的 env()（CDP 没生效：量到 ' + got.join(',') + '）';
    await t.ctx.route(u => u.href.startsWith(base + '/') && /\.(css|js)(\?|$)/.test(u.pathname + u.search), async r => { const resp = await r.fetch(); let body = await resp.text(); body = body.replace(/env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,[^()]*)?\)/g, (m, k) => insets[k] + 'px'); r.fulfill({ response: resp, body }); });
  }
  const steps = {}, t0 = Date.now(), rules = st.css.filter(r => r.pos).map(r => r.sel);
  const step = async (name, extra) => {
    await t.settle();
    const shot = 'safe-' + orient + '-' + name + '.png', rec = { shot };
    let sc; try { sc = await t.E(SAFE, { insets, portrait: orient === 'portrait', rules }); } catch (e) { sc = { hits: [], bars: [], err: String(e.message).split('\n')[0] }; }
    try { await t.E(OVERLAY, { insets, portrait: orient === 'portrait' }); await t.p.screenshot({ path: path.join(L.OUT, shot), scale: 'css', timeout: 30000 }); } catch (e) { rec.shotErr = String(e.message).split('\n')[0]; }
    await t.E(() => { const o = document.getElementById('__safe'); if (o) o.remove(); }).catch(() => {});
    Object.assign(rec, sc, extra ? { extra } : {});
    steps[name] = rec;
    process.stdout.write('  [' + orient + '] ' + name + '  env ' + JSON.stringify(sc.env || '?') + (sc.hits.length ? '  碰到 ' + sc.hits.length : '') + (sc.bars.length ? '  露缝 ' + sc.bars.length : '') + (extra && extra.failed ? '  ✗ ' + extra.failed : '') + '\n');
  };
  let notes = {}, crash = '';
  try { notes = mode === 'sales' ? await T.salesTour(t, step) : await T.tour(t, mode, step); } catch (e) { crash = String(e.stack || e).slice(0, 600); }
  const out = { orient, mode, insets, how, ms: Date.now() - t0, crash, steps, notes, pageerrors: Object.values(t.ev.bag).flatMap(b => b.pageerror) };
  await t.ctx.close();
  return out;
}

function report(res) {
  const P = s => console.log(s), css = res.static.css;
  P('\n================ 安全区域（刘海 / 灵动岛 / 底部横条）================');
  const proved = {};   // 规则编号 → 出问题的步骤
  const fixedIdx = css.map((r, i) => r.pos ? i : -1).filter(i => i >= 0);
  for (const r of res.runs || []) {
    P('\n── ' + r.orient + ' · ' + r.mode + '   insets ' + JSON.stringify(r.insets) + '   办法：' + r.how + (r.crash ? '   ✗ ' + r.crash.split('\n')[0] : ''));
    const uniq = {};
    Object.entries(r.steps).forEach(([name, s]) => { (s.hits || []).forEach(h => { const k = h.kind + '|' + h.sel + '|' + h.where.replace(/ \d+px/g, ''); const u = uniq[k] = uniq[k] || Object.assign({ steps: [] }, h); u.steps.push(name); if (parseInt(h.where.split(' ')[1]) > parseInt(u.where.split(' ')[1])) Object.assign(u, h, { steps: u.steps });
      (h.rules || []).forEach(i => { const gi = fixedIdx[i]; if (gi == null) return; (proved[gi] = proved[gi] || new Set()).add(r.orient + ':' + name); }); });
      (s.bars || []).forEach(b => { const k = 'bar|' + b.sel + '|' + b.gap.replace(/ \d+px/g, ''); const u = uniq[k] = uniq[k] || Object.assign({ steps: [], kind: 'bar' }, b); u.steps.push(name); }); });
    const list = Object.values(uniq);
    const sev = h => (h.island ? 0 : h.homebar ? 1 : h.kind === 'tap' ? 2 : h.kind === 'bar' ? 3 : 4) + (h.flow ? 10 : 0);
    list.sort((x, y) => sev(x) - sev(y));
    if (!list.length) P('   没有东西碰到不安全区域');
    list.forEach(h => { if (h.kind === 'bar') P('   [露缝] ' + h.sel + ' (' + h.pos + ')  ' + JSON.stringify(h.rect) + '  缝 ' + h.gap + '  背景 ' + h.bg + '  步骤 ' + h.steps.slice(0, 4).join(',') + (h.steps.length > 4 ? ' 等 ' + h.steps.length + ' 步' : '') + '  → safe-' + r.orient + '-' + h.steps[0] + '.png');
      else P('   [' + (h.kind === 'tap' ? '能点' : '字') + (h.island ? ' · 被岛压住' : '') + (h.homebar ? ' · 压在横条上' : '') + (h.flow ? ' · 跟着页面滚' : '') + '] ' + h.sel + (h.text ? ' 「' + h.text.slice(0, 20) + '」' : '') + '  ' + JSON.stringify(h.rect) + '  进 ' + h.where + '  定位祖先 ' + h.anchor + '  步骤 ' + h.steps.slice(0, 3).join(',') + (h.steps.length > 3 ? ' 等 ' + h.steps.length + ' 步' : '') + '  → safe-' + r.orient + '-' + h.steps[0] + '.png'); });
  }
  P('\n── 静态：position 是 fixed / sticky / absolute、写了 top/bottom/left/right/inset 却没有 env(safe-area-inset…) 的规则（✗ = 路线里真的有东西因为它碰到了不安全区域）');
  const noEnv = css.map((r, i) => Object.assign({ i }, r)).filter(r => r.pos && r.anchors.length && !r.env);
  const tag = r => proved[r.i] ? '✗ 实测有问题（' + [...proved[r.i]].slice(0, 3).join(', ') + (proved[r.i].size > 3 ? ' 等 ' + proved[r.i].size + ' 步' : '') + '）' : '';
  ['fixed', 'sticky'].forEach(k => { P('  · ' + k + '：'); noEnv.filter(r => r.pos === k).forEach(r => P('     ' + r.at + '  ' + r.sel + '  { ' + r.anchors.join('; ') + ' }' + (r.media ? '  [' + r.media + ']' : '') + '  ' + tag(r))); });
  const abs = noEnv.filter(r => r.pos === 'absolute');
  P('  · absolute：共 ' + abs.length + ' 条（全部在 safearea.json 的 static.css 里）；实测有问题的：');
  abs.filter(r => proved[r.i]).forEach(r => P('     ' + r.at + '  ' + r.sel + '  { ' + r.anchors.join('; ') + ' }' + (r.media ? '  [' + r.media + ']' : '') + '  ' + tag(r)));
  P('  · 有 env() 的定位规则 ' + css.filter(r => r.pos && r.env).length + ' 条；其中实测还是碰到的：');
  css.map((r, i) => Object.assign({ i }, r)).filter(r => r.pos && r.env && proved[r.i]).forEach(r => P('     ' + r.at + '  ' + r.sel + '  ' + tag(r)));
  P('\n── 静态：JS 里的内联样式 / 全屏盖层（position:fixed、inset:0、100vh）共 ' + res.static.inline.length + ' 处');
  res.static.inline.forEach(x => P('     ' + x.at + '  ' + x.what + (x.env ? '  （同一段里有 env()）' : '  （没有 env()）') + '  ' + x.s.slice(0, 120)));
  P('\n结果：' + JSON_OUT);
}

(async () => {
  if (has('report')) return report(JSON.parse(fs.readFileSync(JSON_OUT, 'utf8')));
  const st = staticScan();
  const res = { meta: { at: new Date().toISOString(), viewport: L.VIEW, note: 'Chromium + 模拟的 safe-area-inset；岛和横条的位置是照 iPhone 15 画的示意' }, insets: INSETS, runs: [], static: st };
  if (!has('static')) {
    const { s, base } = await L.serve();
    const b = await L.launch('chromium');
    res.meta.chromium = b.version();
    for (const orient of ORIENTS) for (const mode of MODES) { console.log('▶ ' + orient + ' ' + mode); try { res.runs.push(await runOne(b, base, orient, mode, st)); } catch (e) { res.runs.push({ orient, mode, insets: INSETS[orient], how: '', crash: String(e.stack || e).slice(0, 500), steps: {} }); console.log('  ✗ 没跑成：' + String(e.message).split('\n')[0]); } }
    await b.close(); s.close();
  }
  fs.writeFileSync(JSON_OUT, JSON.stringify(res, null, 1));
  report(res);
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
