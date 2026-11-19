// 新画风的大地图（world3d-open.js，网址带 ?look=new 才打开）：
//   · 不带开关：一切照旧——还是老的 3D 渲染器，新渲染器一行都不跑
//   · 带开关：第一座小镇和 1 号路用新渲染器画得出来；主角、跟着走的怪兽、人物、道具、提示都贴着地面；委托的「?」、训练师的「!」、按 A 的提示都在；
//     地形只跟着地图数据走（台阶是真的坎、能走的格子之间没有陡坡、水比岸低）；来回切地图显存不涨；进屋交回老渲染器、出来再换回来；
//     房子挡在镜头前会淡出去；画面丢了能重建；没有 WebGL2 退回 2D；怪兽模型读不到就用纸片图标；三档画质都能画
// 运行：node tests/look.test.js（自己起一个本机小网站，这样怪兽的模型读得到；无头浏览器用软件渲染，慢，所以大多数检查用标准档）
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', ogg: 'audio/ogg', woff2: 'font/woff2' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); } fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const opts = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; return ok; };
const SAVE = gfx => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx, sfx: false, gate: false, music: 'off' }, player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 12, xp: 0 }], team: ['m1'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 14, y: 9, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, daily: {}, repel: 99999 },
});

(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch(opts);
  const allErrs = [];
  // 开一页进大地图。url：网址后面带的参数；before：进页面之前在浏览器里做的手脚
  async function open(query, gfx, o) {
    o = o || {};
    const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 } }), p = await ctx.newPage(), errs = [];
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => { errs.push(e.message); allErrs.push(e.message); console.log('  [err]', e.message.slice(0, 200)); });
    if (o.init) await ctx.addInitScript(o.init);
    if (o.block) await ctx.route(o.block, r => r.abort());
    await p.goto((o.file ? 'file://' + path.join(ROOT, 'index.html') : base + '/index.html') + (query || ''));
    await p.evaluate(([sv, ls]) => { localStorage.setItem('echo-island-v1', JSON.stringify(sv)); if (ls) localStorage.setItem('echo-look', ls); else localStorage.removeItem('echo-look'); }, [SAVE(gfx), o.ls || '']);
    await p.reload();
    await p.waitForSelector('[data-act=wEnter]');
    await p.click('[data-act=wEnter]');
    await p.waitForFunction(() => { try { const d = EchoWorld._debug(); return d.R && d.M && (d.R.kind === '2d' || d.R.info().render.frame > 1); } catch (e) { return false; } }, null, { timeout: 60000 });
    const W = ms => p.waitForTimeout(ms), E = (fn, a) => p.evaluate(fn, a);
    const t = {
      ctx, p, W, E, errs,
      st: () => E(() => { const d = EchoWorld._debug(), R = d.R, i = R.info ? R.info() : null; return { kind: R.kind, look: R.look || '', using: R.using ? R.using() : '', map: d.M.id, calls: i ? i.render.calls : 0, tris: i ? i.render.triangles : 0, mem: i ? i.memory.geometries + i.memory.textures : 0, prog: i && i.programs ? i.programs.length : 0, frame: i ? i.render.frame : 0, canv: document.querySelectorAll('#w-view canvas.w-canvas').length, marks: R.marks ? R.marks() : -1 }; }),
      async closeDlg() { for (let i = 0; i < 40 && await E(() => !!EchoWorld._debug().dlg); i++) { await E(() => { const pk = document.querySelectorAll('#w-dlg [data-act=wPick]'); const a = pk.length ? pk[pk.length - 1] : document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA].ba'); if (a) a.click(); }); await W(120); } },   // 要选的时候选最后一个（「以后再说」），不去开聊天
      async go(id, how) { await E(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await p.waitForFunction(id => EchoWorld._debug().M.id === id, id); await W(700); await t.closeDlg(); await t.frames(2); },
      tp: (x, y, dir) => E(([x, y, dir]) => { const d = EchoWorld._debug(), D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]; d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir; d.PL.moving = false; d.FL.x = d.FL.fx = x - D[0]; d.FL.y = d.FL.fy = y - D[1]; }, [x, y, dir]),
      // 等再画 n 帧（软件渲染一帧可能要零点几秒）
      async frames(n) { const f0 = (await t.st()).frame; await p.waitForFunction(([f0, n]) => { const R = EchoWorld._debug().R; return R.kind === '2d' || R.info().render.frame >= f0 + n; }, [f0, n], { timeout: 60000 }).catch(() => {}); },
      probe: () => E(() => { const R = EchoWorld._debug().R; return R.probe ? R.probe() : null; }),
    };
    return t;
  }
  const near = (a, bb, eps) => Math.abs(a - bb) <= (eps || .02);

  // ---------- 1. 不带开关：一切照旧 ----------
  let t = await open('', 'mid', { file: true });
  let st = await t.st();
  check(st.kind === '3d' && !st.look && !st.using && st.canv === 1, '不带开关：还是老的 3D 渲染器，只有一张画布 ' + JSON.stringify({ kind: st.kind, look: st.look, canv: st.canv }));
  check(await t.E(() => !!window.EchoWorldOpen && EchoWorldOpen.on === false && typeof EchoWorldOpen.create === 'function'), '新渲染器的文件装进来了，但是没打开');
  check(await t.E(() => !EchoWorld._debug().R.probe && !EchoWorld._debug().R.using), '老渲染器身上没有新渲染器的东西');
  await t.go('r0', 'from:t0'); st = await t.st();
  check(st.kind === '3d' && !st.look && st.calls > 3, '不带开关：1 号路也是老渲染器画的');
  check(!t.errs.length, '不带开关：没有报错');
  await t.ctx.close();

  // ---------- 2. 带开关：第一座小镇 ----------
  t = await open('?look=new', 'mid');
  st = await t.st();
  check(st.kind === '3d' && st.look === 'new' && st.using === 'open', '带开关：小镇用新渲染器（' + st.using + '）');
  check(st.calls > 8 && st.tris > 20000, '小镇画出来了 ' + JSON.stringify({ calls: st.calls, tris: st.tris }));
  check(st.calls < 150 && st.tris < 400000, '标准档 draw call 和三角形没有失控');
  await t.p.screenshot({ path: out + '/look-t0.png' });
  // 跟着走的怪兽：模型下载好就换上模型（本机小网站读得到）
  await t.tp(14, 14, 'up');
  await t.p.waitForFunction(() => { const pr = EchoWorld._debug().R.probe(); return pr && pr.model; }, null, { timeout: 30000 }).catch(() => {});
  let pr = await t.probe();
  check(pr.model === true && pr.icon === false, '跟着走的怪兽用的是会动的模型');
  // 都贴着地面
  const onGround = await t.E(() => {
    const R = EchoWorld._debug().R, pr = R.probe(), bad = [];
    const chk = (name, p, lift) => { const g = pr.at(p[0], p[2]); if (!(Math.abs(p[1] - g) <= (lift || .02))) bad.push(name + ' ' + p.map(v => v.toFixed(2)).join(',') + ' 地面 ' + g.toFixed(2)); };
    chk('主角', pr.player); if (pr.follower) chk('怪兽', pr.follower);
    pr.people.forEach((q, i) => chk('人' + i, q)); pr.picks.forEach((q, i) => chk('道具' + i, q, .12));
    return { bad, people: pr.people.length, picks: pr.picks.length, follower: !!pr.follower };
  });
  check(onGround.bad.length === 0 && onGround.people >= 6 && onGround.follower, '主角、怪兽、' + onGround.people + ' 个人、' + onGround.picks + ' 个道具都贴着地面' + (onGround.bad.length ? '：' + onGround.bad.join(' | ') : ''));
  // 沙滩往海里低下去、码头上的人站在木板上（比水面高）、水比岸低
  const sea = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return { grass: pr.at(14.5, 14.5), sand: pr.at(9.5, 21.5), pier: pr.at(13.5, 23.5), sea: pr.sea, bed: pr.ground(5.5, 24.5) }; });
  check(sea.sand < sea.grass - .1 && sea.sand > sea.sea && sea.pier > sea.sea + .1 && sea.bed < sea.sea - .2, '沙滩比草地低、比水面高；码头在水面上；水底比水面低 ' + JSON.stringify(sea, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
  // 委托的「?」、按 A 的提示
  check((await t.st()).marks >= 1, '有委托的人头上有「?」（' + (await t.st()).marks + ' 个）');
  await t.tp(10, 17, 'up'); await t.frames(3);
  pr = await t.probe();
  const hintOk = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return !!pr.hint && Math.abs(pr.hint[0] - 10.5) < .01 && Math.abs(pr.hint[2] - 16.5) < .01 && pr.hint[1] > pr.at(10.5, 16.5) + 1.2; });
  check(hintOk, '面对着人：头顶上有按 A 的提示');
  // 训练师的「!」（直接给一个人挂上，看画不画）
  await t.E(() => { const n = EchoWorld._debug().M.npcs[1]; n.alert = performance.now() + 8000; });
  await t.frames(2);
  check((await t.probe()).alerts >= 1, '「!」画出来了');
  // 面朝北和人说话：镜头抬高（不然主角把对面的人挡住）
  await t.W(800); await t.frames(12);
  check((await t.probe()).pitch > .5, '面朝北对着人：镜头抬高了（俯角 ' + Math.round((await t.probe()).pitch * 57.3) + '°）');
  // 镜头：在主角南边上方、朝北看，俯角比老版小得多（看得到地平线）。镜头是慢半拍跟过来的，多等几帧
  await t.tp(14, 14, 'up'); await t.W(1200); await t.frames(16);
  pr = await t.probe();
  check(pr.cam[2] > pr.player[2] + 5 && pr.cam[1] > pr.player[1] + 2.5 && pr.pitch > .15 && pr.pitch < .5, '镜头在主角身后上方，俯角 ' + Math.round(pr.pitch * 57.3) + '°（老版约 50°） ' + JSON.stringify({ cam: pr.cam.map(v => +v.toFixed(1)), player: pr.player.map(v => +v.toFixed(1)) }));
  // 房子挡在镜头和主角中间：淡出去；走开又回来
  await t.tp(14, 3, 'up'); await t.W(900); await t.frames(3);
  const f1 = (await t.probe()).faded;
  await t.tp(14, 14, 'up'); await t.W(900); await t.frames(3);
  const f2 = (await t.probe()).faded;
  check(f1 >= 1 && f2 === 0, '站到大房子后面，房子淡出去（' + f1 + ' 栋）；走开以后恢复');

  // ---------- 3. 1 号路：台阶是真的坎，能走的地方没有陡坡 ----------
  await t.go('r0', 'from:t0'); st = await t.st();
  check(st.using === 'open' && st.calls > 8 && st.tris > 20000, '1 号路也是新渲染器画的 ' + JSON.stringify({ calls: st.calls, tris: st.tris }));
  await t.p.screenshot({ path: out + '/look-r0.png' });
  const relief = await t.E(() => {
    const d = EchoWorld._debug(), m = d.M, pr = d.R.probe(), W = EchoMaps.WALK, at = (x, y) => pr.at(x + .5, y + .5);
    let steep = 0, drop = 9, wet = 0, n = 0;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = m.grid[y][x];
      if (c === 'L' && y > 0 && y < m.H - 1 && W.includes(m.grid[y - 1][x]) && W.includes(m.grid[y + 1][x])) drop = Math.min(drop, at(x, y - 1) - at(x, y + 1));
      if (!W.includes(c)) continue;
      n++;
      if (!isFinite(at(x, y))) steep = 99;
      [[1, 0], [0, 1]].forEach(([dx, dy]) => { const q = m.grid[y + dy] && m.grid[y + dy][x + dx]; if (q && W.includes(q)) steep = Math.max(steep, Math.abs(at(x, y) - at(x + dx, y + dy))); });
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const q = m.grid[y + dy] && m.grid[y + dy][x + dx]; if (q === '~' && pr.ground(x + dx + .5, y + dy + .5) > at(x, y) - .05) wet++; });
    }
    return { steep, drop, wet, n, step: pr.step };
  });
  check(relief.step > .2 && relief.drop > .25, '台阶：上面那格比下面那格高（最少高 ' + relief.drop.toFixed(2) + '）');
  check(relief.steep < .32, '能走的格子之间没有陡坡（最陡 ' + relief.steep.toFixed(2) + ' / 格，' + relief.n + ' 格）');
  check(relief.wet === 0, '水底都比旁边能走的地低');
  // 往下跳台阶：落点比起点低，跳的过程里人一直在地面上方
  await t.tp(8, 12, 'down'); await t.frames(2);
  const y0 = (await t.probe()).player[1];
  await t.p.keyboard.down('ArrowDown'); await t.W(60); await t.p.keyboard.up('ArrowDown');
  let lowest = 9;
  for (let i = 0; i < 25; i++) { const q = await t.E(() => { const d = EchoWorld._debug(), pr = d.R.probe(); return { y: d.PL.y, moving: d.PL.moving, gap: pr.player[1] + pr.hop - pr.at(pr.player[0], pr.player[2]) }; }); lowest = Math.min(lowest, q.gap); if (!q.moving && q.y === 14) break; await t.W(60); }
  await t.frames(2);
  const land = await t.E(() => ({ y: EchoWorld._debug().PL.y, py: EchoWorld._debug().R.probe().player[1] }));
  check(land.y === 14 && land.py < y0 - .25 && lowest > -.03, '跳下台阶：落在下面那一层（' + y0.toFixed(2) + ' → ' + land.py.toFixed(2) + '），中途没有钻进地里');
  // 走几步：主角、怪兽还贴着地面
  await t.tp(12, 30, 'up');
  await t.p.keyboard.down('ArrowUp'); await t.W(1500); await t.p.keyboard.up('ArrowUp'); await t.W(500); await t.frames(2);
  const walked = await t.E(() => { const d = EchoWorld._debug(), pr = d.R.probe(); return { y: d.PL.y, gp: Math.abs(pr.player[1] - pr.at(pr.player[0], pr.player[2])), gf: pr.follower ? Math.abs(pr.follower[1] - pr.at(pr.follower[0], pr.follower[2])) : 0 }; });
  check(walked.y < 30 && walked.gp < .02 && walked.gf < .02, '走了 ' + (30 - walked.y) + ' 步，主角和怪兽都贴着地面');

  // ---------- 4. 来回切地图：显存不涨；进屋交回老渲染器 ----------
  const memOf = async id => { await t.go(id, id === 'r0' ? 'from:t0' : 'from:r0'); await t.frames(3); const q = await t.st(); return { mem: q.mem, prog: q.prog, using: q.using }; };
  const a0 = await memOf('t0'), a1 = await memOf('r0');
  for (let k = 0; k < 2; k++) { await memOf('t0'); await memOf('r0'); }
  const b0 = await memOf('t0'), b1 = await memOf('r0');
  check(b0.mem <= a0.mem + 2 && b1.mem <= a1.mem + 2 && b1.prog <= a1.prog + 1, '小镇 ⇄ 1 号路来回 3 趟，显存里的东西没有变多 ' + JSON.stringify([a0, a1, b0, b1].map(q => q.mem + '/' + q.prog)));
  await t.go('t0', 'from:r0');
  const m0 = (await t.st()).mem;
  await t.go('i0C', 'mat'); st = await t.st();
  check(st.using === 'std' && st.calls > 3, '进休息站：交给老渲染器画（' + st.using + '）');
  check(await t.E(() => { const cs = [...document.querySelectorAll('#w-view canvas.w-canvas')]; return cs.length === 2 && cs.filter(c => c.style.display !== 'none').length === 1; }), '两张画布只显示一张');
  await t.p.screenshot({ path: out + '/look-i0C.png' });
  await t.go('c0', 'mat'); check((await t.st()).using === 'std', '洞穴也是老渲染器');
  await t.go('t0', 'door:C'); st = await t.st();
  check(st.using === 'open' && st.mem <= m0 + 2, '出来换回新渲染器，显存没变多（' + m0 + ' → ' + st.mem + '）');
  for (let k = 0; k < 2; k++) { await t.go('i0C', 'mat'); await t.go('t0', 'door:C'); }
  check((await t.st()).mem <= m0 + 2, '进出房子 3 趟，新渲染器这边显存没变多');
  check(await t.E(() => document.querySelectorAll('#w-view canvas').length === 2), '画布还是两张（没有越建越多）');

  // ---------- 5. 画面丢了：重建以后还是新渲染器 ----------
  await t.E(() => { window.__R0 = EchoWorld._debug().R; const c = [...document.querySelectorAll('#w-view canvas.w-canvas')].find(c => c.style.display !== 'none'); c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(); });
  await t.p.waitForFunction(() => EchoWorld._debug().R !== window.__R0, null, { timeout: 15000 }).catch(() => {});
  await t.frames(2);
  st = await t.st();
  check(await t.E(() => EchoWorld._debug().R !== window.__R0) && st.using === 'open' && st.calls > 8 && await t.E(() => EchoWorld._debug().R.glState() === 'ok'), '画面丢了以后重建，还是新渲染器，画得出来');
  check(!t.errs.length, '带开关走这一圈没有报错' + (t.errs.length ? '：' + t.errs.slice(0, 2).join(' | ') : ''));
  await t.ctx.close();

  // ---------- 6. 三档画质；用 localStorage 打开；横屏 ----------
  for (const gfx of ['high', 'low']) {
    t = await open(gfx === 'low' ? '' : '?look=new', gfx, { ls: gfx === 'low' ? 'new' : '', vp: gfx === 'low' ? { width: 844, height: 390 } : null });
    await t.frames(2); st = await t.st();
    check(st.using === 'open' && st.calls > 5 && st.tris > 10000, (gfx === 'high' ? '精美档' : '省电档（localStorage 打开、横屏）') + '画得出来 ' + JSON.stringify({ calls: st.calls, tris: st.tris }));
    if (gfx === 'low') { pr = await t.probe(); check(pr.fov < 50 && pr.cam[2] > pr.player[2] + 4, '横屏：视角窄一些（' + Math.round(pr.fov) + '°），镜头还在身后'); }
    await t.p.screenshot({ path: out + '/look-t0-' + gfx + '.png' });
    check(!t.errs.length, (gfx === 'high' ? '精美档' : '省电档') + '没有报错');
    await t.ctx.close();
  }

  // ---------- 7. 退路：怪兽模型读不到 → 纸片图标；没有 WebGL2 → 2D ----------
  t = await open('?look=new', 'mid', { block: '**/assets/mon3d/**' });
  await t.tp(14, 14, 'up'); await t.W(1500); await t.frames(3);
  pr = await t.probe();
  check(pr.model === false && pr.icon === true && !!pr.follower && near(pr.follower[1], await t.E(() => { const q = EchoWorld._debug().R.probe(); return q.at(q.follower[0], q.follower[2]); })), '模型读不到：跟着走的怪兽用纸片图标，也贴着地面');
  check(!t.errs.length, '模型读不到：没有报错');
  // 老渲染器万一建不出来：进屋也不能黑屏、不能报错（新渲染器硬着头皮画）
  await t.E(() => { EchoWorld3D.create = () => null; });
  await t.go('i0C', 'mat'); st = await t.st();
  check(st.using === 'open' && st.calls > 3 && !t.errs.length, '老渲染器建不出来时进屋：新渲染器接着画，没有报错');
  await t.ctx.close();
  t = await open('?look=new', 'mid', { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k) { return /webgl/i.test(k) ? null : g.apply(this, arguments); }; } });
  st = await t.st();
  check(st.kind === '2d' && st.canv === 1, '没有 WebGL：退回 2D 流畅模式，没有留下多余的画布（' + st.kind + '）');
  await t.go('r0', 'from:t0');
  check((await t.st()).kind === '2d' && !t.errs.length, '2D 模式照样能切地图，没有报错');
  await t.ctx.close();

  check(!allErrs.length, '全程没有报错' + (allErrs.length ? '：' + allErrs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close(); s.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
