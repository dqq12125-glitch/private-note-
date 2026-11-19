// 回声岛 · iPhone（WebKit）兼容性检查：同一条路线在 WebKit 和 Chromium 里各走一遍（Chromium 当基准，引擎特有的问题才显得出来）。
// 用法：
//   npx playwright install webkit                    （第一次；这台机器上默认 30 秒超时会失败，PowerShell 里先 $env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT='600000'）
//   node tools/ios/audit.js                          全部：两个引擎 × 竖屏 393×852 / 横屏 852×393 × 网页版 / 装了假原生桥的 App / 销售版向导，外加能力探测和 localStorage 配额
//   node tools/ios/audit.js --engines webkit --orients portrait --modes web      只跑一部分（逗号分开）
//   node tools/ios/audit.js --no-probe               不做能力探测和配额
//   node tools/ios/audit.js --report                 不开浏览器，只把上次的 audit.json 重新打印一遍
// 结果：tests/screenshots/ios/audit.json + 截图 <引擎>-<方向>-<步骤>.png（步骤名以 web- / app- / sales- 开头；截图按 CSS 像素存，--shots device 按 3 倍像素存）
// 每一步收集：没接住的错误（消息 + 第一行堆栈）、控制台 error / warning、失败或 4xx 的请求、没接住的 Promise、
//   排版问题（lib.js 的 SCAN：整页比屏幕宽、按钮出了屏幕或滚不到、小于 32×32 的可点区域、被 overflow 裁掉的字和内容、叠在一起的控件、被别的东西盖住的按钮）、
//   要紧元素的位置和大小（两个引擎之间差 4 像素以上的列出来）。
// 路线（tour.js）：第一次打开 → 首页三个标签 → 聊天页的家长须知和聊天界面 → 闯关（选关、听力、开口、排词、对话、结算）→ 设置 / 家长设置 / 密码键盘 / 从备份恢复 / 周报 / 手册 / 队伍
//   → 大地图 2D、方向键、3D（键盘走、摇杆走、点 A 和人说话、两指、菜单）→ 2D / 3D 对战（选招、看题、出招、防御、逃跑）→ 销售版向导到第 ② 步。
// 触摸能模拟到什么程度（要紧）：点击用 Playwright 的 touchscreen.tap（两个引擎都是浏览器发的真触摸）；拖动摇杆：Chromium 用 CDP 发真的触摸（含两指），
//   WebKit 没有这个接口，只能 ① 页面里造 PointerEvent（isTrusted = false）② 鼠标拖动（真事件，但 pointerType 是 mouse）。所以 WebKit 里「手指拖动时页面会不会跟着滚、
//   长按出不出菜单、两指同时按」验证不了，要在真 iPhone 上看。
// 不会真的连 AI：外面的网址全部挡掉，对话服务地址写成没人听的端口，App 模式的假原生桥是「没网」。
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib'), T = require('./tour'), P = require('./probe');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] || ''); };
const has = k => process.argv.includes('--' + k);
const ENGINES = arg('engines', 'webkit,chromium').split(','), ORIENTS = arg('orients', 'portrait,landscape').split(','), MODES = arg('modes', 'web,app,sales').split(',');
const SHOT_SCALE = arg('shots', 'css') === 'device' ? 'device' : 'css';
const JSON_OUT = path.join(L.OUT, arg('out', 'audit') + '.json');   // --out 名字：只跑一部分时写到别的文件，不盖掉完整的那份
// 检查工具自己弄出来的动静（对话服务指到了本机一个一连上就挂断的端口：连不上的那几行），不算游戏的问题；serve() 以后才知道端口号
let NOISE = /127\.0\.0\.1:9\b/;
const BRIDGE = { app: { key: 'sk-fake', net: 'offline', mic: 'granted', pin: '1234' }, sales: { edition: 'sales', pin: null, key: '', net: 'offline', mic: 'granted' } };

async function runOne(browser, base, engine, orient, mode) {
  const t = await L.open(browser, base, { engine, orient, bridge: mode === 'web' ? false : BRIDGE[mode], mic: mode !== 'web', save: mode === 'sales' ? null : undefined });
  const steps = {}, t0 = Date.now();
  const step = async (name, extra) => {
    await t.settle();
    const shot = engine + '-' + orient + '-' + name + '.png', rec = { shot };
    try { await t.p.screenshot({ path: path.join(L.OUT, shot), scale: SHOT_SCALE, timeout: 30000 }); } catch (e) { rec.shotErr = String(e.message).split('\n')[0]; }
    let sc; try { sc = await t.E(L.SCAN, { keys: L.KEYS }); } catch (e) { sc = { problems: [], rects: {}, err: String(e.message).split('\n')[0] }; }
    const page = await t.E(() => { const a = window.__ios || { errs: [], rej: [] }; return { errs: a.errs.splice(0), rej: a.rej.splice(0), scr: document.body.className, modal: !document.querySelector('#modal').hidden }; }).catch(() => ({ errs: [], rej: [] }));
    Object.assign(rec, { vw: sc.vw, vh: sc.vh, scrollW: sc.scrollW, scrollH: sc.scrollH, scanErr: sc.err, problems: sc.problems, rects: sc.rects, page }, extra ? { extra } : {});
    steps[name] = rec;
    process.stdout.write('  [' + engine + ' ' + orient + '] ' + name + (rec.shotErr ? ' ✗截图' : '') + (sc.problems.length ? '  排版 ' + sc.problems.length : '') + (page.errs.length + page.rej.length ? '  错误 ' + (page.errs.length + page.rej.length) : '') + (extra && extra.failed ? '  ✗ ' + extra.failed : '') + '\n');
  };
  let notes = {}, crash = '';
  try { notes = mode === 'sales' ? await T.salesTour(t, step) : await T.tour(t, mode, step); } catch (e) { crash = String(e.stack || e).slice(0, 600); }
  const errlog = await t.E(() => (window.EchoErr ? EchoErr.list().map(x => x.k + ': ' + x.m + (x.w ? ' @' + x.w : '')) : [])).catch(() => []);
  const bag = {}, noise = [];
  Object.entries(t.ev.bag).forEach(([k, b]) => { const c = b.console.filter(x => { if (NOISE.test(x.m)) { noise.push(x.m.slice(0, 80)); return false; } return true; }); if (b.pageerror.length || c.length || b.request.length) bag[k] = { pageerror: b.pageerror, console: c, request: b.request }; });
  const out = { engine, orient, mode, ms: Date.now() - t0, crash, steps, notes, events: bag, errlog, tapFallbacks: t.fallbacks, blockedExternal: [...new Set(t.blocked)], toolNoise: noise.length };
  await t.ctx.close();
  return out;
}

// 两个引擎之间比位置：同一方向、同一步、同一个元素，x / y / 宽 / 高差 4 像素以上
function compare(runs) {
  const diffs = [];
  const by = {}; runs.forEach(r => { by[r.engine + '/' + r.orient + '/' + r.mode] = r; });
  for (const r of runs.filter(r => r.engine === 'webkit')) {
    const c = by['chromium/' + r.orient + '/' + r.mode]; if (!c) continue;
    for (const name of Object.keys(r.steps)) {
      const a = c.steps[name], b = r.steps[name]; if (!a || !b) { diffs.push({ orient: r.orient, step: name, key: '(step)', note: a ? 'webkit 没走到' : 'chromium 没走到' }); continue; }
      const only = { chromium: [], webkit: [] };
      for (const k of Object.keys(a.rects)) { const x = a.rects[k], y = b.rects[k]; if (!y) { only.chromium.push(k); continue; }
        const d = [y[0] - x[0], y[1] - x[1], y[2] - x[2], y[3] - x[3]];
        if (d.some(v => Math.abs(v) > 4)) diffs.push({ orient: r.orient, step: name, key: k, chromium: x.slice(0, 4), webkit: y.slice(0, 4), d, size: Math.abs(d[2]) > 4 || Math.abs(d[3]) > 4, sameText: x[4] === y[4], text: (y[4] || '').slice(0, 24) }); }
      for (const k of Object.keys(b.rects)) if (!a.rects[k]) only.webkit.push(k);
      if (only.chromium.length || only.webkit.length) diffs.push({ orient: r.orient, step: name, key: '(only)', onlyChromium: only.chromium.slice(0, 12), onlyWebkit: only.webkit.slice(0, 12) });
      // 排版问题只在 WebKit 里有的，标出来
      const sig = q => q.k + '|' + q.sel + '|' + (q.with || '');
      const base = new Set(a.problems.map(sig));
      b.problems.forEach(q => { q.webkitOnly = !base.has(sig(q)); });
    }
  }
  return diffs;
}

function report(res) {
  const line = s => console.log(s);
  line('\n================ iPhone（WebKit）检查结果 ================');
  line('时间 ' + res.meta.at + '   ' + Object.entries(res.meta.versions || {}).map(([k, v]) => k + ' ' + v).join('，') + '   （Windows 上的 Playwright 内核，不是 iPhone Safari）');
  for (const r of res.runs) {
    const names = Object.keys(r.steps), failed = names.filter(n => r.steps[n].extra && r.steps[n].extra.failed);
    line('\n── ' + r.engine + ' · ' + r.orient + ' · ' + r.mode + '：' + names.length + ' 步，' + Math.round(r.ms / 1000) + ' 秒' + (r.crash ? '  ✗ 中途崩了：' + r.crash.split('\n')[0] : ''));
    failed.forEach(n => line('   ✗ 这一步没走完 ' + n + '：' + r.steps[n].extra.failed));
    Object.entries(r.events).forEach(([k, b]) => { b.pageerror.forEach(e => line('   [pageerror] ' + k + '：' + e.m + '  ' + e.at)); b.console.forEach(e => line('   [console.' + e.t + '] ' + k + '：' + e.m.slice(0, 200))); b.request.forEach(e => line('   [请求失败] ' + k + '：' + e.u + '  ' + e.why)); });
    names.forEach(n => { const pg = r.steps[n].page || {}; (pg.errs || []).forEach(e => line('   [页面里 ' + e.k + '] ' + n + '：' + e.m + (e.at ? '  ' + e.at : ''))); (pg.rej || []).forEach(e => line('   [Promise] ' + n + '：' + e.slice(0, 200))); });
    if (r.errlog.length) line('   出错记录（EchoErr）：' + r.errlog.slice(0, 8).join(' ｜ '));
    if (r.tapFallbacks.length) r.tapFallbacks.forEach(f => line('   [点不到，改用 el.click()] ' + f.step + '  ' + f.sel + '  ' + f.why));
    if (r.blockedExternal.length) line('   挡掉的外面网址：' + r.blockedExternal.slice(0, 6).join('  '));
    // 排版问题：按种类数一数，再列出来（同一个元素在很多步里都有的只列第一次）
    const seen = new Set(); let n = 0;
    names.forEach(nm => r.steps[nm].problems.forEach(q => { const k = q.k + '|' + q.sel + '|' + (q.with || q.by || ''); if (seen.has(k)) return; seen.add(k); n++;
      line('   [' + q.k + (q.webkitOnly ? ' · 只有 WebKit' : '') + '] ' + nm + '  ' + q.sel + (q.text ? ' 「' + q.text.slice(0, 22) + '」' : '') + '  ' + JSON.stringify(q.rect) + (q.by != null ? '  多出/被盖 ' + q.by : '') + (q.with ? '  和 ' + q.with + ' ' + JSON.stringify(q.withRect) + ' 重叠 ' + q.area : '') + (q.clipper ? '  裁它的 ' + q.clipper : '') + (q.cut ? '  被裁的 ' + q.cut + '「' + (q.cutText || '').slice(0, 16) + '」' : '') + (q.ellipsis ? '  （省略号）' : '') + (q.link ? '  （文字链接）' : '') + '  → ' + r.steps[nm].shot); }));
    if (!n) line('   排版：没发现问题');
  }
  const d = res.diffs || [];
  line('\n── WebKit 和 Chromium 位置 / 大小差 4 像素以上：' + d.filter(x => x.d).length + ' 处（size = 宽高不一样；只是位置不一样的多半是上面某个东西高度不同带下来的）');
  const byStep = {}; d.forEach(x => { (byStep[x.orient + ' ' + x.step] = byStep[x.orient + ' ' + x.step] || []).push(x); });
  Object.entries(byStep).forEach(([k, list]) => { const sz = list.filter(x => x.d && x.size), pos = list.filter(x => x.d && !x.size), on = list.find(x => x.key === '(only)'), st = list.find(x => x.key === '(step)');
    line('   ' + k + '：大小 ' + sz.length + '，位置 ' + pos.length + (st ? '  ' + st.note : ''));
    sz.slice(0, 6).forEach(x => line('      ' + x.key + (x.text ? '「' + x.text + '」' : '') + '  chromium ' + JSON.stringify(x.chromium) + '  webkit ' + JSON.stringify(x.webkit) + (x.sameText ? '' : '  （字不一样）')));
    if (on) line('      只在 chromium：' + on.onlyChromium.join(' ') + '   只在 webkit：' + on.onlyWebkit.join(' ')); });
  if (res.probe) Object.entries(res.probe).forEach(([e, pr]) => { line('\n── 能力探测 · ' + e + '（完整的在 audit.json 的 probe 里）'); ['isSecureContext', 'mediaDevices', 'canPlayType', 'audioPlayOgg', 'decodeAudioDataOgg', 'audioContext', 'audioContext16k', 'audioWorkletBlob', 'speechSynthesis', 'MediaRecorder', 'storageEstimate', 'gl3d'].forEach(k => line('   ' + k + ': ' + JSON.stringify(pr[k]))); if (pr.webgl2) line('   webgl2: ' + JSON.stringify(Object.assign({}, pr.webgl2, { extensions: (pr.webgl2.extensions || []).length + ' 个' }))); });
  if (res.quota) Object.entries(res.quota).forEach(([e, q]) => line('── localStorage 配额 · ' + e + '：纯英文 ' + q.ascii.singleValueChars + ' 字，纯中文 ' + q.zh.singleValueChars + ' 字，英文里夹一个中文字 ' + q.mixed.singleValueChars + ' 字（game.js 的 LS_QUOTA = ' + 5 * 1024 * 1024 + '）'));
  line('\n结果：' + JSON_OUT);
}

(async () => {
  if (has('report')) return report(JSON.parse(fs.readFileSync(JSON_OUT, 'utf8')));
  const { s, base, dead } = await L.serve();
  NOISE = new RegExp(dead.replace(/^ws:\/\//, '').replace(/\./g, '\\.') + '\\b|Failed to load resource: net::ERR_FAILED');   // 后一种是这里挡掉的外面网址（版本检查）
  const res = { meta: { at: new Date().toISOString(), viewport: L.VIEW, deviceScaleFactor: 3, userAgent: L.IPHONE.userAgent, versions: {}, note: 'Playwright 在 Windows 上的 WebKit / Chromium，不是 iPhone Safari' }, runs: [], diffs: [], probe: {}, quota: {} };
  await Promise.all(ENGINES.map(async engine => {
    const b = await L.launch(engine);
    res.meta.versions[engine] = b.version();
    for (const orient of ORIENTS) for (const mode of MODES) {
      console.log('▶ ' + engine + ' ' + orient + ' ' + mode);
      try { res.runs.push(await runOne(b, base, engine, orient, mode)); } catch (e) { res.runs.push({ engine, orient, mode, ms: 0, crash: String(e.stack || e).slice(0, 600), steps: {}, notes: {}, events: {}, errlog: [], tapFallbacks: [], blockedExternal: [] }); console.log('  ✗ ' + engine + ' ' + orient + ' ' + mode + ' 没跑成：' + String(e.message).split('\n')[0]); }
    }
    if (!has('no-probe')) {
      try { res.probe[engine] = await P.probe(b, base, engine); } catch (e) { res.probe[engine] = { error: String(e.message).split('\n')[0] }; }
      try { res.quota[engine] = await P.quota(b, engine); } catch (e) { res.quota[engine] = { error: String(e.message).split('\n')[0] }; }
    }
    await b.close();
  }));
  s.close();
  res.runs.sort((a, b) => (a.orient + a.mode + a.engine).localeCompare(b.orient + b.mode + b.engine));
  res.diffs = compare(res.runs);
  fs.writeFileSync(JSON_OUT, JSON.stringify(res, null, 1));
  report(res);
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
