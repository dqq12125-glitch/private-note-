// 回声岛 · 玩久了页面上的东西会不会越攒越多（DOM 节点、事件监听、JS 内存）
// 照真的玩法来（不直接调切地图的函数，战斗画面也不开在底下）：
//   door    走进房子再走出来（真的门和地垫）            --door 100
//   route   小镇 ⇄ 道路（走到地图边上的出口）           --route 60
//   home    回首页再进大地图（地名横幅、「现在要做」提示）  --home 30
//   dlg     和人说话 / 对话框翻页                        --dlg 100
//   menu    冒险菜单、队伍、背包、手册、设置开了又关      --menu 40
//   battle  遇怪 → 逃跑 / 打赢 → 回到大地图               --battle 30
// 每一段前后都先让浏览器回收内存再数：节点（含已经从页面上拿掉、还没回收的）、页面上挂着的节点、事件监听、JS 内存；
// 还列出 window / document 上每种事件挂了几个监听（重复挂监听是最常见的漏法）。
// 用法：node tools/perf/leak.js [door,route,home,dlg,menu,battle] [--gfx high|2d] [--door 100] … [--why 1] [--root 1 --depth 30]
//   --why 1：哪一段节点涨了，就拍一张内存快照，打印「谁抓着这些已经不在页面上的节点」的引用链；--root 1 只看靠近根的那一段
// 写这种脚本要注意：p.$() / waitForSelector 会在浏览器里留元素句柄，句柄抓着的整棵节点树回收不了，量出来像游戏在漏（其实是脚本自己）
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const BS = require('./bigsave');
const argv = process.argv.slice(2), opt = { gfx: 'high', door: 100, route: 60, home: 30, dlg: 100, menu: 40, battle: 30, label: 'run' }, posi = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else posi.push(argv[i]); }
const WHAT = (posi[0] || 'door,route,home,dlg,menu,battle').split(',');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); } fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });

(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 920 }, deviceScaleFactor: opt.gfx === '2d' ? 1 : 3 });
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = [];
  p.on('pageerror', e => { errs.push(e.message.slice(0, 200)); console.log('[err]', e.message.slice(0, 200)); });
  await cdp.send('Performance.enable');
  const W = ms => p.waitForTimeout(ms);
  await p.goto(base + '/tools/perf/blank.html');
  const sv = BS.tiny(opt.gfx); sv.world.repel = 99999; sv.mon.balls = 50;
  await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), sv);
  await p.goto(base + '/index.html');
  await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
  await p.click('[data-act=wEnter]'); await W(4000);
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dlg: !!d.dlg, busy: d.busy, moving: d.PL.moving }; });
  const closeDlg = async () => { for (let i = 0; i < 40 && (await dbg()).dlg; i++) { await p.evaluate(() => { const a = document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA].ba'); if (a) a.click(); }); await W(110); } };
  const idle = async () => { for (let i = 0; i < 60; i++) { const d = await dbg(); if (d.dlg) { await closeDlg(); continue; } if (!d.busy && !d.moving) return; await W(100); } };
  const snap = async () => {
    await cdp.send('HeapProfiler.collectGarbage'); await W(120); await cdp.send('HeapProfiler.collectGarbage'); await W(120);
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const pg = await p.evaluate(() => { const d = EchoWorld._debug(), i = d.R && d.R.info ? d.R.info() : null; return { live: document.getElementsByTagName('*').length, canvas: document.querySelectorAll('canvas').length, toasts: document.querySelectorAll('#toasts > *').length, geo: i ? i.memory.geometries : 0, tex: i ? i.memory.textures : 0 }; });
    return { nodes: m.Nodes, live: pg.live, listeners: m.JSEventListeners, heapMB: Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10, canvas: pg.canvas, geo: pg.geo, tex: pg.tex };
  };
  // window / document 上每种事件挂了几个监听
  const globalListeners = async () => {
    const out = {};
    for (const expr of ['window', 'document', 'document.body']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      listeners.forEach(l => { const k = expr.replace('document.', '') + ':' + l.type; out[k] = (out[k] || 0) + 1; });
    }
    return out;
  };
  const diffL = (a, c) => Object.keys(c).filter(k => c[k] !== (a[k] || 0)).map(k => k + ' ' + (a[k] || 0) + '→' + c[k]).join('，') || '没变';
  // 已经不在页面上、却还被什么东西抓着没法回收的节点：按「整棵树的根」归类，看是哪一种在攒（最大的几种）
  const detached = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const proto = await cdp.send('Runtime.evaluate', { expression: 'Element.prototype' });
    const objs = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId });
    const r = await cdp.send('Runtime.callFunctionOn', { objectId: objs.objects.objectId, returnByValue: true, functionDeclaration: `function () {
      const roots = new Map();
      for (const el of this) { if (el.isConnected) continue; let r = el; while (r.parentNode) r = r.parentNode; if (r.nodeType !== 1) continue; roots.set(r, (roots.get(r) || 0) + 1); }
      const kinds = {};
      roots.forEach((n, r) => { const k = r.tagName.toLowerCase() + (r.id ? '#' + r.id : '') + (r.className && r.className.baseVal === undefined && r.className ? '.' + String(r.className).split(' ').join('.') : '') + (r.tagName === 'CANVAS' ? '[' + r.width + 'x' + r.height + ']' : ''); const o = kinds[k] || (kinds[k] = { trees: 0, nodes: 0, sample: '' }); o.trees++; o.nodes += n; if (!o.sample) o.sample = r.outerHTML.slice(0, 160); });
      return Object.entries(kinds).sort((a, b) => b[1].nodes - a[1].nodes).slice(0, 10).map(([k, o]) => ({ k, trees: o.trees, nodes: o.nodes, sample: o.sample }));
    }` });
    await cdp.send('Runtime.releaseObject', { objectId: objs.objects.objectId }).catch(() => {});
    return r.result.value || [];
  };
  // 谁抓着它们不放：拍一张内存快照，找出「已经不在页面上」的节点，从根一路走到它，打印最短的那条引用链（--why 1 才做，快照比较大）
  const retainers = async () => {
    const chunks = [];
    const on = e => chunks.push(e.chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
    const snap = JSON.parse(chunks.join('')), M = snap.snapshot.meta, NF = M.node_fields.length, EF = M.edge_fields.length;
    const nodes = snap.nodes, edges = snap.edges, strs = snap.strings, N = nodes.length / NF;
    const iName = M.node_fields.indexOf('name'), iEdges = M.node_fields.indexOf('edge_count'), iDet = M.node_fields.indexOf('detachedness'), iType = M.node_fields.indexOf('type');
    const eType = M.edge_fields.indexOf('type'), eName = M.edge_fields.indexOf('name_or_index'), eTo = M.edge_fields.indexOf('to_node'), ET = M.edge_types[0], weak = ET.indexOf('weak'), shortcut = ET.indexOf('shortcut');
    const first = new Uint32Array(N + 1); for (let i = 0, e = 0; i < N; i++) { first[i] = e; e += nodes[i * NF + iEdges]; first[i + 1] = e; }
    const par = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), q = new Uint32Array(N); let qh = 0, qt = 0; q[qt++] = 0; par[0] = 0;
    while (qh < qt) { const n = q[qh++]; for (let e = first[n]; e < first[n + 1]; e++) { const t = edges[e * EF + eType]; if (t === weak || t === shortcut) continue; const to = edges[e * EF + eTo] / NF; if (par[to] < 0) { par[to] = n; via[to] = e; q[qt++] = to; } } }
    const name = i => strs[nodes[i * NF + iName]], isDet = i => (iDet >= 0 ? nodes[i * NF + iDet] === 2 : /^Detached /.test(name(i)));
    const groups = {};
    for (let i = 0; i < N; i++) {
      if (!isDet(i) || par[i] < 0) continue;
      // 往上走到第一个不是「不在页面上的节点」的东西：它就是抓着这棵树的
      let n = i, hops = 0; while (n !== 0 && isDet(par[n]) && hops++ < 10000) n = par[n];
      const path = []; let c = n; for (let k = 0; k < (+opt.root ? 60 : (+opt.depth || 7)) && c !== 0; k++) { const e = via[c], et = ET[edges[e * EF + eType]], en = edges[e * EF + eName]; path.push((et === 'element' || et === 'hidden' ? '[' + en + ']' : '.' + strs[en]) + ' → ' + name(c).slice(0, 50)); c = par[c]; }
      // --root 1：只看靠近根的那一段（跳过前面一串页面节点），容易看出最后是谁抓着
      const cut = +opt.root ? path.findIndex(x => !/→ <|→ SVG|→ HTML/.test(x)) : 0;
      const key = path.slice(Math.max(0, cut - 1), (Math.max(0, cut - 1)) + (+opt.depth || 5)).join('  ⇐  ');
      const g = groups[key] || (groups[key] = { n: 0, top: name(n) }); g.n++;
    }
    return { total: Object.values(groups).reduce((a, g) => a + g.n, 0), groups: Object.entries(groups).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, g]) => ({ nodes: g.n, path: k })) };
  };
  const fmt = x => `节点 ${x.nodes}（页面上 ${x.live}） 监听 ${x.listeners} JS ${x.heapMB}MB 画布 ${x.canvas}` + (x.geo ? ` 几何 ${x.geo} 贴图 ${x.tex}` : '');
  const results = {};
  const phase = async (name, n, step, every) => {
    await idle(); await W(3300);   // 等提示条（3 秒）自己消掉
    const a = await snap(), la = await globalListeners(), rows = [a];
    console.log(`\n== ${name} × ${n} ==\n  开始   ${fmt(a)}`);
    let done = 0;
    for (let i = 1; i <= n; i++) {
      try { await step(i); done = i; } catch (e) { console.log('  第 ' + i + ' 次出错：' + e.message.split('\n')[0]); break; }
      if (i % every === 0 && i < n) { await idle(); await W(3300); const m = await snap(); rows.push(m); console.log(`  ${String(i).padStart(4)} 次 ${fmt(m)}`); }
    }
    await idle(); await W(3300);
    const z = await snap(), lz = await globalListeners(); rows.push(z);
    const per = k => ((z[k] - a[k]) / Math.max(1, done)).toFixed(2);
    console.log(`  结束   ${fmt(z)}\n  每次涨：节点 ${per('nodes')}，页面上的节点 ${per('live')}，监听 ${per('listeners')}，JS ${(((z.heapMB - a.heapMB) * 1024) / Math.max(1, done)).toFixed(1)}KB；window/document 上的监听：${diffL(la, lz)}`);
    results[name] = { n: done, start: a, end: z, rows, perNode: +per('nodes'), perListener: +per('listeners'), global: diffL(la, lz) };
    if (z.nodes - a.nodes > 60) {
      const d = await detached(); results[name].detached = d;
      if (d.length) console.log('  没回收的节点（已经不在页面上、脚本里还拿着的）最多的几种：');
      d.forEach(x => console.log(`    ${String(x.nodes).padStart(6)} 个节点 / ${String(x.trees).padStart(4)} 棵  ${x.k.slice(0, 60)}   ${x.sample.replace(/\s+/g, ' ').slice(0, 110)}`));
      if (+opt.why) {
        const r = await retainers(); results[name].retainers = r;
        console.log('  谁抓着它们（内存快照里 ' + r.total + ' 个不在页面上的节点，按引用链归类；从被抓的那个往根的方向写）：');
        r.groups.forEach(g => console.log(`    ${String(g.nodes).padStart(6)} 个  ${g.path}`));
      }
    }
  };
  // 找一个通到 target 的出口（target 以 * 结尾 = 前缀），站到它旁边，返回要按的方向键
  const toWarp = target => p.evaluate(target => {
    const d = EchoWorld._debug(), M = d.M, WK = EchoMaps.WALK;
    const ok = (x, y) => { const c = M.grid[y] && M.grid[y][x]; return !!c && WK.includes(c) && c !== 'L' && c !== 'I' && !M.npcs.some(n => n.x === x && n.y === y) && !M.warps.some(w => w.x === x && w.y === y); };
    for (const w of M.warps) {
      if (!(target.endsWith('*') ? w.to.startsWith(target.slice(0, -1)) : w.to === target)) continue;
      const c = M.grid[w.y] && M.grid[w.y][w.x], walk = !!c && WK.includes(c);
      const tries = walk ? [[0, 1, 'up', 'ArrowUp'], [0, -1, 'down', 'ArrowDown'], [1, 0, 'left', 'ArrowLeft'], [-1, 0, 'right', 'ArrowRight']] : [[0, 1, 'up', 'ArrowUp']];
      for (const [dx, dy, dir, key] of tries) if (ok(w.x + dx, w.y + dy)) { const x = w.x + dx, y = w.y + dy; d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; return { key, to: w.to }; }
    }
    return null;
  }, target);
  const warp = async target => {
    await idle();
    const from = (await dbg()).map, w = await toWarp(target);
    if (!w) throw new Error('在 ' + from + ' 找不到去 ' + target + ' 的出口');
    await p.keyboard.down(w.key); await W(140); await p.keyboard.up(w.key);
    for (let i = 0; i < 80 && (await dbg()).map === from; i++) await W(60);
    if ((await dbg()).map === from) throw new Error('从 ' + from + ' 走不到 ' + w.to);
    await idle();
  };
  // 点第一个看得见、能点的（在页面里点，不留元素句柄）
  const clickFirst = sels => p.evaluate(sels => { for (const s of sels) { const el = document.querySelector(s); if (el && !el.disabled && el.getClientRects().length) { el.click(); return s; } } return ''; }, sels);
  await idle();
  const home = (await dbg()).map;

  if (WHAT.includes('door')) await phase('进房子再出来（门 + 地垫）', +opt.door, async () => { await warp('i*'); await warp(home); }, 25);
  if (WHAT.includes('route')) await phase('小镇 ⇄ 道路', +opt.route, async () => { await warp('r*'); await warp(home); }, 20);
  if (WHAT.includes('home')) await phase('回首页再进大地图', +opt.home, async () => {
    await p.evaluate(() => document.querySelector('#world [data-act=wExit]').click()); await W(250);
    await p.click('[data-act=wEnter]'); await W(700); await idle();
  }, 10);
  if (WHAT.includes('dlg')) await phase('对话框（3 页）', +opt.dlg, async i => {
    await p.evaluate(i => EchoWorld._debug().talk([{ who: '旁白', emo: '💬', en: 'Hello there! This is line ' + i + '.', zh: '你好！这是第 ' + i + ' 句。' }, { who: 'Amy', emo: '🙂', en: 'Nice to meet you!', zh: '很高兴认识你！' }, { who: '旁白', emo: '📍', en: 'Go north.', zh: '往北走。' }]), i);
    await W(60); await closeDlg();
  }, 25);
  if (WHAT.includes('menu')) await phase('菜单 / 队伍 / 背包 / 手册 / 设置', +opt.menu, async () => {
    for (const act of ['mTeam', 'mBag', 'mDex', 'settings']) {
      await p.evaluate(() => document.querySelector('#world .w-menu').click()); await W(80);
      await p.evaluate(act => { const x = document.querySelector('#sheet [data-act=' + act + ']'); if (x) x.click(); }, act); await W(120);
      await p.evaluate(() => EchoGame.closeModal()); await W(40);
    }
    await p.evaluate(() => document.querySelector('#w-goal') && document.querySelector('#w-goal').click()); await W(60);
    await p.evaluate(() => EchoGame.closeModal());
  }, 10);
  if (WHAT.includes('battle')) await phase('遇怪 → 逃跑 → 回大地图（每 5 场打赢 1 场）', +opt.battle, async i => {
    await idle();
    await p.evaluate(() => { EchoWorld._debug().battle('wild', { foes: [MonsterGame.newMon('twigling', 3)] }); });
    // 注意：这里不用 p.$() / waitForSelector 拿元素——它们会在浏览器里留一个「元素句柄」，句柄抓着按钮，按钮连着整棵战斗画面的节点，
    // 画面换掉以后也回收不了，量出来就像游戏在漏（第一版就是这样误报的）。一律在页面里自己找、自己点
    await p.waitForFunction(() => !!document.querySelector('#b-panel [data-act=bMove]'), null, { timeout: 40000 });
    const shown = () => p.evaluate(() => !document.getElementById('battle').hidden);
    if (i % 5 === 0) {
      for (let k = 0; k < 200; k++) {
        await W(160);
        if (!(await shown())) break;
        if (await clickFirst(['#b-panel [data-act=bEnd]', '#sheet [data-act=bEnd]'])) { await W(600); continue; }
        await clickFirst(['[data-act=bMove]:not([disabled])', '#b-panel [data-act=bRate][data-v="2"]', '#b-panel [data-act=bDef]:not(.right):not(.wrong):not(.dim)', '#b-panel [data-act=bSelfDone]', '#sheet [data-act=mForget][data-k="-1"]', '#evo-ok:not([hidden])', '#sheet [data-act=close]']);
      }
    } else {
      await p.evaluate(() => document.querySelector('[data-act=bFlee]').click()); await W(300);
      for (let k = 0; k < 40 && await shown(); k++) { await clickFirst(['#sheet [data-act=bEnd]', '#b-panel [data-act=bEnd]']); await W(150); }
    }
    for (let k = 0; k < 40 && await p.evaluate(() => !document.getElementById('modal').hidden); k++) { await p.evaluate(() => { const x = document.querySelector('#sheet [data-act=close], #sheet [data-act=mForget][data-k="-1"], #evo-ok'); if (x) x.click(); else EchoGame.closeModal(); }); await W(150); }
    await W(300);
  }, 10);

  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'leak-' + opt.label + '.json'), JSON.stringify({ when: new Date().toISOString(), gfx: opt.gfx, results, errs }, null, 1));
  console.log('\n存到 tools/perf/out/leak-' + opt.label + '.json' + (errs.length ? '  页面报错 ' + errs.length + ' 条' : ''));
  await b.close(); s.close();
})().catch(e => { console.error(e); process.exit(1); });
