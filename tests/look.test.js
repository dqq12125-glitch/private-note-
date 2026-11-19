// 新画风的大地图（world3d-open.js，网址带 ?look=new 才打开）：
//   · 不带开关：一切照旧——还是老的 3D 渲染器，新渲染器一行都不跑
//   · 带开关：第一座小镇和 1 号路用新渲染器画得出来；主角、跟着走的怪兽、人物、道具、提示都贴着地面；委托的「?」、训练师的「!」、按 A 的提示都在；
//     地形只跟着地图数据走（台阶是真的坎、能走的格子之间没有陡坡、水比岸低）；来回切地图显存不涨；进屋交回老渲染器、出来再换回来；
//     房子挡在镜头前会淡出去；画面丢了能重建；没有 WebGL2 退回 2D；怪兽模型读不到就用纸片图标；三档画质都能画
//   · 人物：people3d.js 装着就是 3D 小人（主角、镇上每个人），没装、或者它说这个造型不行，就还是纸片；头上的「?」「!」「A」在头顶上面；
//     剧情换造型、把人藏起来都跟着变；来回切地图小人不越攒越多；镇上站满人时 draw call 和三角形还在预算里
//   · 整个世界（第 8 节）：所有户外地图都是新画风（包括地上画着斑马线的规则城）、省电档在预算里、没有报错；每座岛的树、房子、天气、远景是它自己的；
//     瀑布真的从高处冲下来、冰面和岩浆单独画；最重的几张图镜头转到四面都在预算里
//   · 转镜头（第 9 节，只有新画风的户外地图有）：不转的时候和原来一样；Q / E 键、右半边屏幕拖（真的触摸事件）、上下拖调俯角；
//     摇杆 / 方向键 / 键盘的「上」朝镜头看过去的方向走（0° / 90° / 180° / 270°，停在 45° 不来回跳）；双击回到主角身后、点指北针回正北；
//     不和 A / B 键、摇杆抢手指；对话框开着、进了屋、老画风、2D 都不能转；四面转过去主角都不被房子和树挡住、头上的牌子朝着镜头；
//     转着镜头换地图显存不涨、角度留着
// 运行：node tests/look.test.js（自己起一个本机小网站，这样怪兽的模型读得到；无头浏览器用软件渲染，慢，所以大多数检查用标准档）
//   node tests/look.test.js --only=orbit 只跑第 9 节（转镜头，约 3 分钟）
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
// 各岛的主线都做完了（第 8 节逛遍整个世界用：进地图不演剧情、不被对手拦住）
const ALLDONE = Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]).concat(['rival2', 'rival3', 'rival4', 'rival5', 'kai_final', 'w11in', 'z1intro', 'z1kai', 'f3in', 'f4in', 'c5intro', 'c7intro', 'a9in', 'f2call', 'c6call'].map(k => ['s:' + k, 1])));
const SAVE = (gfx, extra) => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx, sfx: false, gate: false, music: 'off' }, player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 12, xp: 0 }], team: ['m1'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 14, y: 9, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, (extra && extra.flags) || {}), daily: {}, repel: 99999 },
});

(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch(opts);
  const allErrs = [];
  // 开一页进大地图。url：网址后面带的参数；before：进页面之前在浏览器里做的手脚
  async function open(query, gfx, o) {
    o = o || {};
    const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, hasTouch: !!o.touch }), p = await ctx.newPage(), errs = [];
    p.setDefaultTimeout(20000);
    p.on('pageerror', e => { errs.push(e.message); allErrs.push(e.message); console.log('  [err]', e.message.slice(0, 200)); });
    if (o.init) await ctx.addInitScript(o.init);
    if (o.block) await ctx.route(o.block, r => r.abort());
    await p.goto((o.file ? 'file://' + path.join(ROOT, 'index.html') : base + '/index.html') + (query || ''));
    await p.evaluate(([sv, ls]) => { localStorage.setItem('echo-island-v1', JSON.stringify(sv)); if (ls) localStorage.setItem('echo-look', ls); else localStorage.removeItem('echo-look'); }, [SAVE(gfx, o.save), o.ls || '']);
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
  const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
  let t, st, pr;
  // 来回切地图用：到这张图，记显存里的东西有多少
  const memOf = async id => { await t.go(id, id === 'r0' ? 'from:t0' : 'from:r0'); await t.frames(3); const q = await t.st(); return { mem: q.mem, prog: q.prog, using: q.using }; };
  if (ONLY !== 'orbit') {

  // ---------- 1. 不带开关：一切照旧 ----------
  t = await open('', 'mid', { file: true });
  st = await t.st();
  check(st.kind === '3d' && !st.look && !st.using && st.canv === 1, '不带开关：还是老的 3D 渲染器，只有一张画布 ' + JSON.stringify({ kind: st.kind, look: st.look, canv: st.canv }));
  check(await t.E(() => !!window.EchoWorldOpen && EchoWorldOpen.on === false && typeof EchoWorldOpen.create === 'function'), '新渲染器的文件装进来了，但是没打开');
  check(await t.E(() => !EchoWorld._debug().R.probe && !EchoWorld._debug().R.using), '老渲染器身上没有新渲染器的东西');
  await t.go('r0', 'from:t0'); st = await t.st();
  check(st.kind === '3d' && !st.look && st.calls > 3, '不带开关：1 号路也是老渲染器画的');
  // 老画风不能转镜头：按 Q 没反应，右半边屏幕不接手指，没有指北针，「上」还是往北走
  await t.tp(12, 30, 'down'); await t.p.keyboard.press('q'); await t.p.keyboard.press('e');
  await t.p.keyboard.down('ArrowUp'); await t.W(60); await t.p.keyboard.up('ArrowUp'); await t.W(600);
  { const q = await t.E(() => { const d = EchoWorld._debug(), c = document.getElementById('w-compass'), z = document.getElementById('w-orb'); return { api: !!d.R.orbit || !!d.R.quarter, cls: document.getElementById('world').classList.contains('cam-on'), compass: !!c && !c.hidden, zone: !!z && getComputedStyle(z).display !== 'none', dir: d.PL.dir, y: d.PL.y }; });
    check(!q.api && !q.cls && !q.compass && !q.zone && q.dir === 'up' && q.y === 29, '老画风不能转镜头：没有指北针，右半边屏幕不接手指，按「上」还是往北走 ' + JSON.stringify(q)); }
  check(!t.errs.length, '不带开关：没有报错');
  await t.ctx.close();

  // ---------- 2. 带开关：第一座小镇 ----------
  t = await open('?look=new', 'mid');
  st = await t.st();
  check(st.kind === '3d' && st.look === 'new' && st.using === 'open', '带开关：小镇用新渲染器（' + st.using + '）');
  check(st.calls > 8 && st.tris > 20000, '小镇画出来了 ' + JSON.stringify({ calls: st.calls, tris: st.tris }));
  check(st.calls < 120 && st.tris < 360000, '标准档、镇上站满人：draw call 和三角形在预算里（' + st.calls + ' 次、' + st.tris + ' 个）');
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
  // 人物是 3D 小人：主角和镇上每个人都是，没有纸片；活着的小人正好是画着的这些（没有多出来的）
  check(pr.p3.on && pr.p3.player && pr.p3.people >= 6 && pr.p3.paper === 0 && pr.p3.live === pr.p3.people + 1, '主角和镇上 ' + pr.p3.people + ' 个人都是 3D 小人，没有纸片 ' + JSON.stringify(pr.p3));
  check(pr.heads.length >= 6 && pr.heads.every(h => h.top > .95 && h.top < 1.7), '每个人的头顶高度像样（' + pr.heads.map(h => h.top.toFixed(2)).join(' ') + '）');
  // 站到镇子南头往北看（大半个镇子和镇上的人都在画面里）：draw call 和三角形还在预算里
  await t.tp(12, 19, 'up'); await t.W(900); await t.frames(4); st = await t.st();
  check(st.calls > 30 && st.calls < 120 && st.tris < 360000, '标准档、整个镇子连人都在画面里：' + st.calls + ' 次 draw call、' + st.tris + ' 个三角形，在预算里');
  await t.tp(14, 14, 'up'); await t.frames(3);
  // 剧情换造型 / 把人藏起来：换了造型的还是 3D 小人（旧的收掉了），藏起来的不画，放回来又在
  {
    const p0 = pr.p3;
    await t.E(() => { const d = EchoWorld._debug(), n = d.M.npcs.find(q => q.role === 'talk' && typeof q.look === 'string'); window.__sw = { n, look: n.look, hid: EchoStory.hidden }; n.look = 'hiker'; });
    await t.frames(3); const p1 = (await t.probe()).p3;
    await t.E(() => { const w = window.__sw; EchoStory.hidden = (SC, q) => q === w.n || w.hid(SC, q); });
    await t.frames(3); const p2 = (await t.probe()).p3;
    await t.E(() => { const w = window.__sw; EchoStory.hidden = w.hid; w.n.look = w.look; });
    await t.frames(3); const p3 = (await t.probe()).p3;
    check(p1.people === p0.people && p1.live === p0.live && p2.people === p0.people - 1 && p3.people === p0.people && p3.live === p0.live && p3.paper === 0, '换造型、藏起来、放回来：小人跟着变，没有多出来的 ' + JSON.stringify([p0, p1, p2, p3].map(q => q.people + '/' + q.live)));
  }
  // 沙滩往海里低下去、码头上的人站在木板上（比水面高）、水比岸低
  const sea = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return { grass: pr.at(14.5, 14.5), sand: pr.at(9.5, 21.5), pier: pr.at(13.5, 23.5), sea: pr.sea, bed: pr.ground(5.5, 24.5) }; });
  check(sea.sand < sea.grass - .1 && sea.sand > sea.sea && sea.pier > sea.sea + .1 && sea.bed < sea.sea - .2, '沙滩比草地低、比水面高；码头在水面上；水底比水面低 ' + JSON.stringify(sea, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
  // 委托的「?」、按 A 的提示
  check((await t.st()).marks >= 1, '有委托的人头上有「?」（' + (await t.st()).marks + ' 个）');
  await t.tp(10, 17, 'up'); await t.frames(3);
  pr = await t.probe();
  const hintOk = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return !!pr.hint && Math.abs(pr.hint[0] - 10.5) < .01 && Math.abs(pr.hint[2] - 16.5) < .01 && pr.hint[1] > pr.at(10.5, 16.5) + 1.2; });
  check(hintOk, '面对着人：头顶上有按 A 的提示');
  // 头上的牌子都在头顶上面一点（3D 小人有高有矮、有帽子，牌子跟着头顶走）
  const hd = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return { marks: pr.heads.filter(h => h.quest != null).map(h => ({ top: h.top, y: h.quest })), hint: pr.hintTop - pr.at(10.5, 16.5) }; });
  check(hd.marks.length >= 1 && hd.marks.every(q => q.y > q.top + .25 && q.y < q.top + 1.3) && hd.hint > hd.marks[0].top + .25, '「?」在头顶上面（头顶 ' + hd.marks.map(q => q.top.toFixed(2)).join(' ') + '，牌子 ' + hd.marks.map(q => q.y.toFixed(2)).join(' ') + '），「A」也在头顶上面');
  // 训练师的「!」（直接给一个人挂上，看画不画）
  await t.E(() => { const n = EchoWorld._debug().M.npcs[1]; n.alert = performance.now() + 8000; });
  await t.frames(2);
  pr = await t.probe();
  check(pr.alerts >= 1 && pr.heads.filter(h => h.alert != null).every(h => h.alert > h.top + .25 && h.alert < h.top + 1.3), '「!」画出来了，在头顶上面');
  // 面朝北和人说话：镜头抬高（不然主角把对面的人挡住）
  await t.W(800); await t.frames(12);
  check((await t.probe()).pitch > .5, '面朝北对着人：镜头抬高了（俯角 ' + Math.round((await t.probe()).pitch * 57.3) + '°）');
  // 和 3D 小人说话（对话框开着）：镜头绕到主角右后方一点（不然 TA 的脸被主角的头挡住）；说完转回正北
  await t.E(() => document.querySelector('#world [data-act=wA].ba').click());
  await t.p.waitForFunction(() => !!EchoWorld._debug().dlg, null, { timeout: 8000 }).catch(() => {});
  await t.W(900); await t.frames(10);
  const yaw1 = (await t.probe()).yaw;
  await t.closeDlg(); await t.W(900); await t.frames(10);
  const yaw2 = (await t.probe()).yaw;
  check(yaw1 > .2 && yaw1 < .6 && Math.abs(yaw2) < .05, '说话时镜头绕到旁边（' + Math.round(yaw1 * 57.3) + '°），说完转回正北（' + Math.round(yaw2 * 57.3) + '°）');
  // 镜头：在主角南边上方、朝北看，俯角比老版小得多（看得到地平线）。镜头是慢半拍跟过来的，多等几帧
  await t.tp(14, 14, 'up'); await t.W(1200); await t.frames(16);
  pr = await t.probe();
  check(pr.cam[2] > pr.player[2] + 5 && pr.cam[1] > pr.player[1] + 2.5 && pr.pitch > .15 && pr.pitch < .5, '镜头在主角身后上方，俯角 ' + Math.round(pr.pitch * 57.3) + '°（老版约 50°） ' + JSON.stringify({ cam: pr.cam.map(v => +v.toFixed(1)), player: pr.player.map(v => +v.toFixed(1)) }));
  // 草按远近分块：近处那几块用细的零件，远处用省的，再远的簇不画
  const g2 = pr.grass;
  check(g2.chunks >= 4 && g2.near >= 1 && g2.near < g2.chunks && g2.drawn > 200 && g2.drawn < g2.all, '草分成 ' + g2.chunks + ' 块，近处 ' + g2.near + ' 块用细的；现在画着 ' + g2.drawn + ' / ' + g2.all + ' 簇（远处的没画）');
  // 地图外面：北口外面是一条山谷，过了垭口落进海里（从镇上能看到海），两边各有一座山
  const vista = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return { near: pr.outer(14.5, -8), far: pr.outer(14.5, -42), l: pr.outer(5, -12), r: pr.outer(25, -12), sea: pr.sea }; });
  check(vista.near.val > .6 && vista.near.h > 0 && vista.far.h < vista.sea && vista.l.hill > .6 && vista.r.hill > .6 && vista.l.h > 1.5 && vista.r.h > 1.5, '北口外面是山谷，过了垭口落进海里（' + vista.far.h.toFixed(1) + '），两边是山（' + vista.l.h.toFixed(1) + ' / ' + vista.r.h.toFixed(1) + '）');
  check(typeof pr.line === 'boolean' && pr.buildMs > 0 && pr.buildMs < 20000, '描边用的深度图试过了（' + (pr.line ? '能用' : '不能用，不描边') + '）；这张地图建了 ' + pr.buildMs + ' 毫秒');
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
  const a0 = await memOf('t0'), a1 = await memOf('r0');
  for (let k = 0; k < 2; k++) { await memOf('t0'); await memOf('r0'); }
  const b0 = await memOf('t0'), b1 = await memOf('r0');
  check(b0.mem <= a0.mem + 2 && b1.mem <= a1.mem + 2 && b1.prog <= a1.prog + 1, '小镇 ⇄ 1 号路来回 3 趟，显存里的东西没有变多 ' + JSON.stringify([a0, a1, b0, b1].map(q => q.mem + '/' + q.prog)));
  // 来回切了这么多趟：活着的 3D 小人还是只有这张地图上画着的这些，共用的网格没有越攒越多
  { const q = await t.E(() => ({ p3: EchoWorld._debug().R.probe().p3, st: EchoPeople3D.stats() })); check(q.p3.live === q.p3.people + 1 && q.p3.paper === 0 && q.st.geos <= 48, '来回切地图：小人没有越攒越多 ' + JSON.stringify({ live: q.p3.live, people: q.p3.people, geos: q.st.geos, faces: q.st.faces })); }
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
  const tierTris = {};
  for (const gfx of ['high', 'low']) {
    t = await open(gfx === 'low' ? '' : '?look=new', gfx, { ls: gfx === 'low' ? 'new' : '', vp: gfx === 'low' ? { width: 844, height: 390 } : null });
    await t.frames(2); st = await t.st();
    tierTris[gfx] = st.tris;
    check(st.using === 'open' && st.calls > 5 && st.tris > 10000, (gfx === 'high' ? '精美档' : '省电档（localStorage 打开、横屏）') + '画得出来 ' + JSON.stringify({ calls: st.calls, tris: st.tris }));
    { const q = (await t.probe()).p3; check(q.player && q.people >= 6 && q.paper === 0 && st.calls < 140, (gfx === 'high' ? '精美档' : '省电档') + '：人物也是 3D 小人（' + q.people + ' 个），draw call ' + st.calls + ' 次'); }
    if (gfx === 'low') { pr = await t.probe(); check(pr.fov < 50 && pr.cam[2] > pr.player[2] + 4, '横屏：视角窄一些（' + Math.round(pr.fov) + '°），镜头还在身后'); }
    await t.p.screenshot({ path: out + '/look-t0-' + gfx + '.png' });
    check(!t.errs.length, (gfx === 'high' ? '精美档' : '省电档') + '没有报错');
    await t.ctx.close();
  }
  // 三档要差得开（自动降档才有用）：精美档的三角形是省电档的好几倍，省电档不能太重
  check(tierTris.high > tierTris.low * 3 && tierTris.low < 200000 && tierTris.high < 1300000, '精美档比省电档细得多（' + tierTris.high + ' / ' + tierTris.low + ' 个三角形）');

  // ---------- 6½. 3D 小人用不了的时候还是纸片：文件没装进来 / 这个造型它说不行 ----------
  t = await open('?look=new', 'mid', { block: '**/people3d.js' });
  await t.tp(14, 14, 'up'); await t.frames(3); pr = await t.probe();
  check(pr.p3.on === false && pr.p3.player === false && pr.p3.people === 0 && pr.p3.paper >= 6 && (await t.st()).marks >= 1, 'people3d.js 没装进来：主角和 ' + pr.p3.paper + ' 个人都是纸片，「?」还在');
  check(pr.heads.filter(h => h.quest != null).every(h => h.top === 1.2 && h.quest > 1.45), '纸片人头上的牌子还在老地方');
  // 纸片人一直正对镜头：镜头转到东边（90°），主角和每个人的纸片都跟着转过去；转回来又朝南
  check(pr.facing.player === 0 && pr.facing.people.length >= 6 && pr.facing.people.every(r => r === 0), '镜头不转：纸片都朝南立着');
  await t.E(() => EchoWorld._debug().R.orbit('set', Math.PI / 2)); await t.frames(3); pr = await t.probe();
  check(near(pr.facing.player, Math.PI / 2, .001) && pr.facing.people.every(r => near(r, Math.PI / 2, .001)) && pr.facing.marks.length >= 1 && pr.facing.marks.every(r => near(r, Math.PI / 2, .001)), '镜头转到东边：主角、' + pr.facing.people.length + ' 个纸片人和头上的牌子都转过去正对镜头');
  await t.E(() => EchoWorld._debug().R.orbit('set', 0)); await t.frames(2);
  check(!t.errs.length, '没有 3D 小人：没有报错');
  await t.ctx.close();
  t = await open('?look=new', 'mid', { init: () => { let v; Object.defineProperty(window, 'EchoPeople3D', { configurable: true, get: () => v, set: x => { v = x; if (x) x.has = () => false; } }); } });
  await t.tp(14, 14, 'up'); await t.frames(3); pr = await t.probe();
  check(pr.p3.on === true && pr.p3.player === false && pr.p3.people === 0 && pr.p3.paper >= 6 && pr.p3.live === 0, '3D 小人说这个造型不行（has() 是 false）：还是纸片，一个小人也没建');
  check(!t.errs.length, 'has() 是 false：没有报错');
  await t.ctx.close();

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
  await t.p.keyboard.press('q'); await t.W(200);
  check(await t.E(() => { const d = EchoWorld._debug(), c = document.getElementById('w-compass'); return !d.R.orbit && !document.getElementById('world').classList.contains('cam-on') && c.hidden; }), '2D 模式不能转镜头，没有指北针');
  await t.go('r0', 'from:t0');
  check((await t.st()).kind === '2d' && !t.errs.length, '2D 模式照样能切地图，没有报错');
  await t.ctx.close();

  // ---------- 8. 整个世界：每张户外地图都用新画风画得出来、在预算里、没有报错；每座岛像它自己 ----------
  // 用省电档（软件渲染快一些）把所有小镇、道路、海路过一遍；存档里各岛的主线都做完了（进地图不演剧情、不开打）
  {
    const LOW = { tris: 170000, calls: 120 };   // 省电档：画面里约十二万个三角形，留一点余量
    t = await open('?look=new', 'low', { save: { flags: ALLDONE } });
    const ids = await t.E(() => EchoMaps.all().filter(id => { const m = EchoMaps.get(id); return m && (m.kind === 'town' || m.kind === 'route'); }));
    const looks = {}, bad = [], over = [];
    for (const id of ids) {
      const e0 = t.errs.length;
      await t.E(id => EchoWorld._debug().goMap(id, 'start'), id);
      await t.p.waitForFunction(id => EchoWorld._debug().M.id === id, id).catch(() => {});
      await t.W(300); await t.closeDlg(); await t.frames(2);
      const q = await t.st(), pr = await t.probe();
      looks[id] = pr && pr.look;
      if (q.using !== 'open' || q.calls < 3 || q.tris < 3000 || t.errs.length > e0) bad.push(id + ' ' + JSON.stringify({ using: q.using, calls: q.calls, tris: q.tris, errs: t.errs.length - e0 }));
      if (q.tris > LOW.tris || q.calls > LOW.calls) over.push(id + ' ' + q.tris + '/' + q.calls);
    }
    check(ids.length >= 30 && !bad.length, '全部 ' + ids.length + ' 张户外地图都用新画风画出来了，没有报错' + (bad.length ? '：' + bad.join(' | ') : ''));
    check(!over.length, '省电档：每张图站在起点时画面里的三角形和 draw call 都在预算里' + (over.length ? '：' + over.join(' | ') : ''));
    // 最重的几张图：镜头转到四面（朝北 / 朝西 / 朝南 / 朝东看）也都在预算里；地图外面四面都有东西（南边外面也种了树，另外三面的海上有岛）
    {
      const overY = [], worst = { tris: 0, calls: 0 }, ring = [], south = [];
      for (const id of ['j8', 't4', 't10', 't12', 'r2', 'r11']) {
        await t.go(id, 'start');
        for (const a of [0, 90, 180, 270]) {
          await t.E(a => EchoWorld._debug().R.orbit('set', a * Math.PI / 180), a); await t.W(250); await t.frames(3);
          const q = await t.st();
          if (q.tris > worst.tris) { worst.tris = q.tris; worst.at = id + '@' + a + '°'; } worst.calls = Math.max(worst.calls, q.calls);
          if (q.tris > LOW.tris || q.calls > LOW.calls || q.tris < 3000) overY.push(id + '@' + a + '° ' + q.tris + '/' + q.calls);
        }
        // 南边外面是陆地（不是海、不是出口外面的山谷）的地方应该种了树（名字带 _ 的那几种）
        const lk = (await t.probe()).look, land = await t.E(() => { const d = EchoWorld._debug(), pr = d.R.probe(); let n = 0; for (let u = .1; u < 1; u += .1) { const o = pr.outer(d.M.W * u, d.M.H + 16); if (o.land > .9 && o.val < .3 && o.h > pr.sea + .5) n++; } return n; });
        if (!(lk.far.ring >= 6) || (land >= 4 && !Object.keys(lk.trees).some(k => k[0] === '_'))) ring.push(id + ' ' + JSON.stringify({ ring: lk.far.ring, land, trees: Object.keys(lk.trees) }));
        south.push(id + ':' + land + (Object.keys(lk.trees).some(k => k[0] === '_') ? '树' : '—'));
        await t.E(() => EchoWorld._debug().R.orbit('set', 0));
      }
      check(!overY.length, '省电档：最重的 6 张图镜头转到四面都在预算里（最多 ' + worst.tris + ' 个三角形 @ ' + worst.at + '、' + worst.calls + ' 次 draw call）' + (overY.length ? '：' + overY.join(' | ') : ''));
      check(!ring.length && south.filter(q => q.endsWith('树')).length >= 3, '地图外面四面都有东西：东、南、西三面的海上各有小岛，南边外面是陆地的种了树（' + south.join(' ') + '）' + (ring.length ? '：' + ring.join(' | ') : ''));
      check(!t.errs.length, '转着镜头逛最重的几张图没有报错');
    }
    check(looks.t9 && looks.t9.over, '规则城（地上画着斑马线）也是新画风画的');
    // 每座岛：树是这座岛的树、房子是这座岛的房子、天气和远景各不一样
    const TH = await t.E(() => { const out = {}; for (let z = 0; z < 13; z++) { const m = EchoMaps.get('t' + z); out[z] = { theme: m.theme, tree: EchoMaps.THEMES[m.theme].tree, house: EchoMaps.THEMES[m.theme].house }; } return out; });
    const wrong = [];
    for (let z = 0; z < 13; z++) {
      const lk = looks['t' + z] || {}, th = TH[z];
      if (lk.tree !== th.tree) wrong.push('t' + z + ' 树 ' + lk.tree + '≠' + th.tree);
      if (!(lk.houses || []).includes(th.house)) wrong.push('t' + z + ' 房子里没有 ' + th.house + '（' + (lk.houses || []).join(',') + '）');
      if (!lk.trees || !Object.keys(lk.trees).length) wrong.push('t' + z + ' 没有树');
    }
    check(!wrong.length, '13 座小镇：树和房子都是这座岛自己的样子' + (wrong.length ? '：' + wrong.join(' | ') : ''));
    const owns = new Set([...Array(13).keys()].map(z => (looks['t' + z] || {}).far && looks['t' + z].far.own)), norths = new Set([...Array(13).keys()].map(z => (looks['t' + z] || {}).far && looks['t' + z].far.north));
    check(owns.size >= 12 && norths.size >= 12, '13 座小镇望出去的远景各不一样（本岛的地标 ' + owns.size + ' 种、正北的邻居 ' + norths.size + ' 种）');
    const L = id => looks[id] || {};
    check(L('t11').life === 'snow' && L('t2').life === 'leaf' && L('t7').life === 'confetti' && L('t1').life === 'shaving' && L('t0').life === 'petal', '空气里飘的东西跟着岛：天气岛下雪、家庭岛落叶、派对岛彩纸屑、文具岛铅笔屑、你好岛花瓣');
    check(L('t9').path === 'asphalt' && L('t9').sand === 'paving' && L('t6').path === 'stone' && L('r5').sand === 'dune' && L('t11').path === 'snow', '路和沙地跟着地貌：规则城柏油路和人行道、作息岛石板路、沙丘道的沙丘、天气岛的雪路');
    check(L('t1').trees && Object.keys(L('t1').trees).some(k => k.startsWith('bush')) && L('j8').trees && Object.keys(L('j8').trees).some(k => k.startsWith('side')), '文具岛有蜡笔花丛、丛林里混着棕榈');
    check((L('r11').falls || []).some(d => d > 1) && (L('j8').falls || []).some(d => d > .5) && (L('s8').falls || []).some(d => d > .5), '瀑布是真的从高处冲下来（12 号路、丛林小径、9 号水路）：' + JSON.stringify([L('r11').falls, L('j8').falls, L('s8').falls]));
    check(L('t11').ice && L('r10').ice && !L('t0').ice, '冰面单独画（天气岛、雪原）');
    check(L('d6b').lava && !L('t6').lava, '钟山山顶的火山口画成岩浆');
    // 瀑布那几格：逆流往上爬的时候人站在一级一级的水面上（上面比下面高）
    await t.go('r11', 'start');
    const wf = await t.E(() => { const pr = EchoWorld._debug().R.probe(); return { top: pr.at(12.5, 22.5), mid: pr.at(12.5, 25.5), low: pr.at(12.5, 29.5) }; });
    check(wf.top > wf.mid + .4 && wf.mid > wf.low + .4, '瀑布从上往下一级比一级低 ' + JSON.stringify(wf, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
    check(!t.errs.length, '走遍整个世界没有报错' + (t.errs.length ? '：' + t.errs.slice(0, 2).join(' | ') : ''));
    await t.ctx.close();
  }

  }

  // ---------- 9. 转镜头（新画风的户外地图才有）----------
  {
    t = await open('?look=new', 'mid', { touch: true });
    const cdp = await t.ctx.newCDPSession(t.p);
    // 真的触摸事件（CDP 发的）。事件自己带着时间（tc，秒）：软件渲染慢，两次调用之间真的隔了多久说不准，「点了多久」「两下隔了多久」world.js 是按事件的时间算的；gap = 离上一个事件多少毫秒
    let tc = Date.now() / 1000;
    const touch = (type, pts, gap) => { tc += (gap == null ? 16 : gap) / 1000; return cdp.send('Input.dispatchTouchEvent', { type, timestamp: tc, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id || 1 })) }); };
    // 一根手指从 (x, y) 拖 (dx, dy)：分 n 步，到了以后停 0.3 秒再抬手（不然浏览器当成「甩」了一下，紧接着的轻点会被它吃掉）
    const drag = async (x, y, dx, dy, n) => { await touch('touchStart', [[x, y]], 400); for (let k = 1; k <= n; k++) await touch('touchMove', [[x + dx * k / n, y + dy * k / n]], 40); await touch('touchMove', [[x + dx, y + dy]], 300); await touch('touchEnd', [], 40); };
    const cam = () => t.E(() => { const R = EchoWorld._debug().R, o = R.orbit && R.orbit(), c = document.getElementById('w-compass'), z = document.getElementById('w-orb'); return { on: !!o, yaw: o ? o.yaw : 0, to: o ? o.to : 0, tilt: o ? o.tilt : 0, q: R.quarter ? R.quarter() : 0, cls: document.getElementById('world').classList.contains('cam-on'), zone: getComputedStyle(z).display !== 'none' && z.offsetParent !== null, compass: !c.hidden && c.offsetParent !== null, needle: c.firstChild.style.transform }; });
    const D = r => Math.round(r * 180 / Math.PI), set = (deg, tilt) => t.E(([a, b]) => { EchoWorld._debug().R.orbit('set', a * Math.PI / 180, b); }, [deg, tilt || 0]);
    // 等镜头转到位（按键 / 回正是慢慢转过去的），再多等一会儿让俯角、房子的淡出也跟上
    const settle = async () => { await t.p.waitForFunction(() => { const o = EchoWorld._debug().R.orbit(); return !o || o.yaw === o.to; }, null, { timeout: 30000 }).catch(() => {}); await t.W(900); await t.frames(10); };
    const K = 5.2 / 390;   // 竖屏 390 宽：拖一个像素转多少弧度（world3d-open.js 的 orbit）
    // 9.1 不转的时候和原来一样
    await t.tp(14, 14, 'up'); await t.W(900); await t.frames(6);
    let c = await cam(); pr = await t.probe();
    check(c.on && c.cls && c.zone && c.yaw === 0 && c.q === 0 && !c.compass && pr.orb === 0 && pr.tilt === 0 && Math.abs(pr.yaw) < .01 && pr.cam[2] > pr.player[2] + 5 && Math.abs(pr.cam[0] - pr.player[0]) < .5, '不转的时候：镜头还在主角南边朝北看，没有指北针；右半边屏幕等着手指');
    check(pr.glow && near(pr.glow[0], .08, 1e-6) && near(pr.glow[1], 1.06, 1e-6) && pr.glow[2] === 1, '朝北看：太阳那片暖光还在左上角（' + JSON.stringify(pr.glow) + '）');
    const hole0 = pr.hole, pitch0 = pr.pitch;
    // 9.2 Q / E 键一次转 45°；摇杆的「上」过了半才换边，转回来也不马上换回去
    await t.p.keyboard.press('q'); c = await cam();
    check(D(c.to) === 45 && c.q === 0, '按 Q：镜头往左转到 45°，「上」还是北');
    await settle(); c = await cam(); pr = await t.probe();
    check(near(c.yaw, Math.PI / 4, .005) && near(pr.yaw, Math.PI / 4, .02) && pr.cam[0] > pr.player[0] + 3 && pr.cam[2] > pr.player[2] + 3 && c.compass && /rotate\(45/.test(c.needle), '转过去了：镜头在主角东南，指北针亮出来、红尖转了 45°（' + c.needle + '）');
    const stepOnce = async act => {
      await t.tp(14, 14, 'down'); await t.W(80); await act();
      for (let i = 0; i < 40 && await t.E(() => EchoWorld._debug().PL.moving); i++) await t.W(50);
      return t.E(() => { const d = EchoWorld._debug(); return d.PL.dir + ' ' + Math.sign(d.PL.x - 14) + ',' + Math.sign(d.PL.y - 14); });   // 朝哪边、往哪边走了（软件渲染慢，按一下可能走出两三格，只看方向）
    };
    const key = k => async () => { await t.p.keyboard.down(k); await t.W(60); await t.p.keyboard.up(k); };
    const m45a = await stepOnce(key('ArrowUp'));
    await t.p.keyboard.press('q'); c = await cam();
    check(D(c.to) === 90 && c.q === 1, '再按 Q：转到 90°（镜头在东边朝西看），「上」换成西');
    await t.p.keyboard.press('e'); c = await cam();
    const m45b = await stepOnce(key('ArrowUp'));
    check(D(c.to) === 45 && c.q === 1 && m45a === 'up 0,-1' && m45b === 'left -1,0', '停在 45°：从北边转过来的时候按「上」往北走（' + m45a + '），从西边转回来的时候往西走（' + m45b + '）——不来回跳');
    await t.p.keyboard.press('e'); await settle(); c = await cam();
    check(c.yaw === 0 && c.q === 0 && !c.compass, '再按 E 回到正北：指北针收起来');
    // 9.3 「上」朝镜头看过去的方向走：键盘、摇杆、方向键都一样
    const mv = {};
    for (const a of [0, 90, 180, 270]) { await set(a); mv[a] = await stepOnce(key('ArrowUp')); }
    check(mv[0] === 'up 0,-1' && mv[90] === 'left -1,0' && mv[180] === 'down 0,1' && mv[270] === 'right 1,0', '键盘「上」：朝北看往北、朝西看往西、朝南看往南、朝东看往东 ' + JSON.stringify(mv));
    await set(90);
    const kR = await stepOnce(key('ArrowRight')), kD = await stepOnce(key('s'));
    const joy = (dx, dy) => async () => { await t.p.mouse.move(80, 650); await t.p.mouse.down(); await t.p.mouse.move(80 + dx, 650 + dy, { steps: 3 }); await t.W(90); await t.p.mouse.up(); };
    const jU = await stepOnce(joy(0, -50)), jL = await stepOnce(joy(-50, 0));
    const pad = dir => async () => { await t.E(dir => document.querySelector('#w-dpad [data-dir=' + dir + ']').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), dir); await t.W(60); await t.E(() => document.getElementById('w-dpad').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); };
    const pU = await stepOnce(pad('up')), pR = await stepOnce(pad('right'));
    check(kR === 'up 0,-1' && kD === 'right 1,0' && jU === 'left -1,0' && jL === 'down 0,1' && pU === 'left -1,0' && pR === 'up 0,-1', '镜头在东边（90°）：键盘右 = 北、S = 东；摇杆上 = 西、左 = 南；方向键上 = 西、右 = 北 ' + JSON.stringify({ kR, kD, jU, jL, pU, pR }));
    await set(0);
    check(await stepOnce(joy(0, -50)) === 'up 0,-1' && await stepOnce(pad('left')) === 'left -1,0', '转回正北：摇杆和方向键和原来一样');
    // 9.4 右半边屏幕拖（真的触摸）：拖多少转多少，松手就停；上下拖调俯角，主角在画面上的位置不变
    await t.tp(14, 14, 'up'); await t.frames(2);
    await drag(300, 420, -100, 0, 5);
    c = await cam();
    check(near(c.yaw, 100 * K, .01) && c.to === c.yaw, '右半边屏幕往左拖 100 像素：镜头当场往左转了 ' + D(c.yaw) + '°（应该是 ' + D(100 * K) + '°）');
    await t.frames(4); { const c2 = await cam(); check(c2.yaw === c.yaw && c2.compass, '松手就停（没有惯性），指北针亮着'); }
    await drag(300, 420, 100, 0, 5);
    c = await cam();
    check(Math.abs(c.yaw) < .001, '往右拖回 100 像素：回到原来的方向');
    // 电脑上：按住右键在画面上哪里拖都行（在左半边拖，摇杆也不动）
    await t.tp(14, 14, 'down'); await t.W(80);
    await t.p.mouse.move(100, 400); await t.p.mouse.down({ button: 'right' }); await t.p.mouse.move(40, 400, { steps: 4 }); await t.p.mouse.up({ button: 'right' });
    c = await cam();
    check(near(c.yaw, 60 * K, .02) && await t.E(() => { const d = EchoWorld._debug(); return d.PL.x === 14 && d.PL.y === 14 && !d.PL.moving; }), '按住鼠标右键拖 60 像素（在左半边也行）：镜头转了 ' + D(c.yaw) + '°，摇杆没动');
    await set(0); await t.tp(14, 14, 'up'); await t.frames(2);
    await drag(300, 300, 0, 120, 6);
    await settle(); pr = await t.probe();
    const pHi = pr.pitch, holeHi = pr.hole;
    await drag(300, 600, 0, -240, 12);
    await settle(); pr = await t.probe();
    check(pHi > .74 && pHi < .82 && pr.pitch > .19 && pr.pitch < .25 && pitch0 > .28 && pitch0 < .4, '上下拖：俯角最高约 45°（' + D(pHi) + '°）、最低约 12°（' + D(pr.pitch) + '°），平常 ' + D(pitch0) + '°');
    // 镜头对准的是主角前面一点的地方，所以俯角一变主角在画面上会挪一点点，但不到半个身子
    check(Math.abs(holeHi[1] - hole0[1]) < hole0[2] * .5 && Math.abs(pr.hole[1] - hole0[1]) < hole0[2] * .5 && Math.abs(pr.hole[0] - hole0[0]) < hole0[2] * .25 && Math.abs(holeHi[0] - hole0[0]) < hole0[2] * .25, '俯角变了，主角还在画面上原来的地方（上下挪了 ' + Math.round(holeHi[1] - hole0[1]) + ' / ' + Math.round(pr.hole[1] - hole0[1]) + ' 个像素，主角约 ' + Math.round(hole0[2] / .86) + ' 个像素高）');
    // 9.5 双击回到主角身后；点指北针回正北
    await set(0); await t.tp(14, 14, 'left'); await t.frames(2);
    await touch('touchStart', [[300, 400]], 1000); await touch('touchEnd', [], 60); await t.W(250);
    c = await cam();
    check(c.yaw === 0 && c.to === 0, '点一下：什么也不变');
    await touch('touchStart', [[300, 400]], 900); await touch('touchEnd', [], 60);
    c = await cam();
    check(c.yaw === 0 && c.to === 0, '隔了快一秒再点一下：不算双击');
    await touch('touchStart', [[300, 400]], 900); await touch('touchEnd', [], 60); await touch('touchStart', [[304, 402]], 110); await touch('touchEnd', [], 60);
    c = await cam();
    check(D(c.to) === 90, '主角面朝西，双击（两下隔 0.17 秒）：镜头转到主角身后（在东边朝西看，' + D(c.to) + '°）');
    await settle(); pr = await t.probe(); c = await cam();
    check(pr.cam[0] > pr.player[0] + 5 && Math.abs(pr.cam[2] - pr.player[2]) < 1.2 && c.compass && pr.tilt === 0, '转过去了，俯角回到平常');
    { const bb = await t.p.locator('#w-compass').boundingBox().catch(() => null); check(bb && bb.x + bb.width <= 390 && bb.y > 60 && bb.width >= 40, '指北针在右上角、够手指点 ' + JSON.stringify(bb)); if (bb) await t.p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    c = await cam();
    check(c.to === 0, '点指北针：镜头转回正北');
    await settle(); c = await cam();
    check(c.yaw === 0 && !c.compass && c.q === 0, '转回来了，指北针收起来');
    // 头上的牌子、按 A 的提示都朝着镜头
    await set(90); await t.tp(10, 17, 'up'); await t.frames(4); pr = await t.probe();
    check(pr.facing.marks.length >= 1 && pr.facing.marks.every(r => near(r, Math.PI / 2, .001)) && pr.hint && near(pr.facing.hint, Math.PI / 2, .001) && pr.facing.picks.every(r => near(r, Math.PI / 2, .001)), '镜头在东边：「?」、按 A 的提示、地上的道具都转过去朝着镜头');
    // 9.6 不和 A 键抢手指；对话框开着不能转
    await set(0); await t.frames(2);
    { const bb = await t.p.locator('#world .ab .ba').boundingBox(), ax = bb.x + bb.width / 2, ay = bb.y + bb.height / 2;
      await drag(ax, ay, -80, 0, 4);
      c = await cam();
      check(c.yaw === 0 && !(await t.E(() => !!EchoWorld._debug().dlg)), '从 A 键上开始拖：不转镜头');
      await t.W(400); await t.p.touchscreen.tap(ax, ay); }
    await t.p.waitForFunction(() => !!EchoWorld._debug().dlg, null, { timeout: 8000 }).catch(() => {});
    check(await t.E(() => !!EchoWorld._debug().dlg), '点 A 键（在右半边屏幕里）：照样和面前的人说话');
    await t.p.keyboard.press('q');
    await drag(300, 300, -80, 0, 4);
    c = await cam();
    check(c.to === 0 && !c.zone, '对话框开着：按 Q、拖右半边屏幕都不转（接手指的那一层收起来了）');
    await t.closeDlg(); await t.W(900); await t.frames(8);
    c = await cam();
    check(c.zone && Math.abs((await t.probe()).yaw) < .05, '说完话：又能转了，镜头还朝北');
    // 左手推着摇杆走，右手同时转镜头
    await t.tp(14, 14, 'down'); await t.W(80);
    await touch('touchStart', [[80, 650, 1]], 400); await touch('touchMove', [[80, 625, 1]], 40); await touch('touchMove', [[80, 600, 1]], 40);
    await touch('touchStart', [[80, 600, 1], [300, 400, 2]], 200); for (let k = 1; k <= 3; k++) await touch('touchMove', [[80, 600, 1], [300 - k * 20, 400, 2]], 40);
    // 软件渲染慢的时候，手指挪的这几下要等下一帧才交给页面：等镜头真的转到了再看
    await t.p.waitForFunction(k => Math.abs(EchoWorld._debug().R.orbit().yaw - k) < .02, 60 * K, { timeout: 15000 }).catch(() => {});
    await t.W(300);
    c = await cam();
    const walk2 = await t.E(() => { const d = EchoWorld._debug(); return { y: d.PL.y, dir: d.PL.dir }; });
    await touch('touchMove', [[80, 600, 1], [240, 400, 2]], 300); await touch('touchEnd', [], 40);
    check(near(c.yaw, 60 * K, .01) && walk2.dir === 'up' && walk2.y < 14, '左手推着摇杆往前走，右手同时转镜头：镜头转了 ' + D(c.yaw) + '°，人还在走 ' + JSON.stringify(walk2));
    for (let i = 0; i < 40 && await t.E(() => EchoWorld._debug().PL.moving); i++) await t.W(50);
    // 9.7 四面转过去主角都不被挡住：房子淡出去、树上开圆窗（seen：主角的头和胸口露在外面的比例；深度图读不了时是 null，只看房子淡没淡）
    const occ = async (x, y, deg) => {
      await set(deg); await t.tp(x, y, 'up'); await t.E(() => { const d = EchoWorld._debug(); d.FL.x = d.FL.fx = d.PL.x; d.FL.y = d.FL.fy = d.PL.y; });
      await t.W(1000); await t.frames(8);
      return t.E(() => { const p = EchoWorld._debug().R.probe(); return { seen: p.seen(), faded: p.faded }; });
    };
    const hs = [], ts = [];
    for (const [x, y, a] of [[14, 3, 0], [11, 5, 90], [14, 8, 180], [19, 5, 270]]) hs.push(Object.assign({ a }, await occ(x, y, a)));
    check(hs.every(q => q.faded >= 1 && (q.seen == null || q.seen > .9)), '大房子挡在镜头和主角中间（镜头在南 / 东 / 北 / 西）：四面都淡出去了，主角露在外面 ' + JSON.stringify(hs));
    for (const [x, y, a] of [[13, 10, 0], [12, 2, 90], [11, 2, 180], [11, 2, 270]]) ts.push(Object.assign({ a }, await occ(x, y, a)));
    check(ts.every(q => q.seen == null || q.seen > .85), '树挡在镜头和主角中间：四面都开了圆窗，主角露在外面 ' + JSON.stringify(ts));
    { const q = await occ(14, 14, 0); check(q.faded === 0, '走开以后房子都恢复了'); }
    // 太阳转到镜头背后：那片暖光没有了
    await set(180); await t.frames(3); pr = await t.probe();
    check(pr.glow && pr.glow[2] === 0, '朝南看（太阳在背后）：没有那片暖光');
    // 9.8 预算：镇子南头、北头，镜头转到四面
    { const over = [];
      for (const [x, y] of [[12, 19], [14, 3]]) for (const a of [0, 90, 180, 270]) { await set(a); await t.tp(x, y, 'up'); await t.W(900); await t.frames(4); const q = await t.st(); if (!(q.calls < 120 && q.tris < 360000 && q.tris > 20000)) over.push(x + ',' + y + '@' + a + '° ' + q.tris + '/' + q.calls); }
      check(!over.length, '标准档：镜头转到四面，draw call 和三角形都在预算里' + (over.length ? '：' + over.join(' | ') : '')); }
    // 9.9 转着镜头换地图：角度留着、显存不涨；进屋不能转（摇杆照原样），出来接着是原来的角度
    await set(135); await t.tp(14, 14, 'up');
    const r0m = await memOf('t0'), r1m = await memOf('r0');
    for (let k = 0; k < 2; k++) { await memOf('t0'); await memOf('r0'); }
    const r2m = await memOf('t0'), r3m = await memOf('r0');
    c = await cam();
    check(r2m.mem <= r0m.mem + 2 && r3m.mem <= r1m.mem + 2 && r3m.prog <= r1m.prog + 1 && D(c.to) === 135 && c.q === 2, '转到 135° 再来回切 3 趟地图：角度留着，显存里的东西没有变多 ' + JSON.stringify([r0m, r1m, r2m, r3m].map(q => q.mem + '/' + q.prog)));
    await t.go('t0', 'from:r0'); await t.go('i0C', 'mat');
    c = await cam();
    await t.p.keyboard.press('q');
    const inUp = await t.E(() => { const d = EchoWorld._debug(); return { x: d.PL.x, y: d.PL.y }; });
    await t.p.keyboard.down('ArrowUp'); await t.W(60); await t.p.keyboard.up('ArrowUp'); await t.W(700);
    const inUp2 = await t.E(() => { const d = EchoWorld._debug(); return { x: d.PL.x, y: d.PL.y, dir: d.PL.dir }; });
    check(!c.on && c.q === 0 && !c.cls && !c.zone && !c.compass && inUp2.dir === 'up' && inUp2.x === inUp.x && inUp2.y <= inUp.y, '进屋（老渲染器）：不能转，没有指北针，按「上」还是往北 ' + JSON.stringify(inUp2));
    await t.go('t0', 'door:C'); await t.frames(3);
    c = await cam();
    check(c.on && D(c.to) === 135 && c.compass, '出来：还是进屋之前的角度（' + D(c.to) + '°），指北针亮着');
    check(!t.errs.length, '转镜头这一圈没有报错' + (t.errs.length ? '：' + t.errs.slice(0, 2).join(' | ') : ''));
    await t.ctx.close();
  }

  check(!allErrs.length, '全程没有报错' + (allErrs.length ? '：' + allErrs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close(); s.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
