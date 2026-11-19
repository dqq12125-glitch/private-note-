// 回声岛 · 新画风的一段走路录像（竖屏 720×1560，二十几秒）：从小镇的码头出发，穿过小镇（房子、人），出北口上 1 号路，穿过草丛走到路边小屋，再回到大路上
// 用法：node tools/look/video.js [--look new|old] [--gfx high] [--mode step|record] [--fps 30] [--out walk-new.mp4] [--crf 21]
//   --mode step（默认）：把页面的时钟接管过来，一帧一帧往前走（每帧 1/30 秒），每走一帧截一张手机 2 倍屏的图（720×1560），最后交给 ffmpeg 拼。
//       画面是原样的清晰度，每一帧间隔一样，不受这台电脑当时忙不忙的影响
//   --mode record：Playwright 自带的 recordVideo。它录的是 CSS 像素（360×780）再放大，码率也只有 1 Mbps，草一动就糊，只留着对照
// 真显卡的无头浏览器；最后用 ffmpeg 转成 H.264 的 MP4（yuv420p、faststart，微信里能直接播），放在 tests/screenshots/look/。要求 PATH 里有 ffmpeg
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { look: 'new', gfx: 'high', mode: 'step', out: '', crf: 21, fps: 30 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const OUT = path.join(L.OUT, opt.out || 'walk-' + opt.look + '.mp4'), TMP = path.join(L.OUT, '_video');
const VP = { width: 360, height: 780 }, FPS = +opt.fps || 30;   // × 2 倍 = 720×1560
// 路线：[等几秒] / [走到 x, y] / [等换到哪张地图]
const ROUTE = [
  ['wait', 3],                                                     // 码头上站一会儿：海、小船、沙滩
  ['walk', 14, 15], ['wait', .25],                                 // 沿着沙滩上的小路进镇
  ['walk', 11, 15], ['walk', 11, 8], ['wait', .6],                 // 从挑战馆旁边穿过去，路过花丛、有委托的奶奶、博士
  ['walk', 10, 8], ['walk', 10, 3], ['wait', .2],
  ['walk', 14, 3], ['walk', 14, 1], ['walk', 15, 1], ['walk', 15, 0],   // 绕到大房子后面，出北口
  ['map', 'r0'], ['wait', 1.4],
  ['walk', 12, 36], ['walk', 6, 36],                               // 1 号路：离开大路
  ['walk', 6, 21], ['wait', 1.5],                                   // 穿过两片草丛，走到路边小屋门口
  ['walk', 6, 22], ['walk', 12, 22], ['walk', 12, 17],             // 回到大路上，往北走到台阶和池塘前面
  ['wait', 3.2],
];

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const step = opt.mode !== 'record';
  // 存档：有第一枚徽章（北口的守卫让开了），其余和截图用的一样
  const ctx = await browser.newContext(Object.assign({ viewport: VP, deviceScaleFactor: 2 }, step ? {} : { recordVideo: { dir: TMP, size: { width: VP.width * 2, height: VP.height * 2 } } }));
  const p = await ctx.newPage(), errs = [], T0 = Date.now();
  p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message.slice(0, 300)); });
  if (step) { await p.clock.install(); await p.clock.pauseAt(Date.now() + 1000); }   // 停住：之后只有下面的 tick 推它才走
  // 时钟被接管以后，页面里的时间要我们推着走：tick 往前推 ms 毫秒（真的也等一小会儿，让下载、解码这些真的在做的事有时间做完）
  const tick = async (ms, real) => { if (step) { await p.clock.runFor(ms); if (real) await p.waitForTimeout(real); } else await p.waitForTimeout(ms); };
  const until = async (fn, arg, maxMs) => { for (let t = 0; t < (maxMs || 30000); t += 100) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await tick(100, 15); } return false; };
  await p.goto(base + '/tools/perf/blank.html');
  await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), L.SAVE(opt.gfx, { badges: { 0: 1 } }));
  await p.goto(base + '/index.html' + (opt.look === 'new' ? '?look=new' : ''));
  await until(() => !!document.querySelector('[data-act=wEnter]'));
  await p.click('[data-act=wEnter]');
  await until(() => { const d = EchoWorld._debug(); return d.R && d.M && d.R.info && d.R.info().render.frame > 2; });
  for (let i = 0; i < 70; i++) await tick(100, 25);   // 地名横幅、「现在要做」的提示收起来，怪兽的模型下载好
  const dbg = () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, moving: d.PL.moving, dlg: !!d.dlg, using: d.R.using ? d.R.using() : d.R.kind }; });
  await p.evaluate(() => { const d = EchoWorld._debug(); d.PL.x = d.PL.fx = 14; d.PL.y = d.PL.fy = 23; d.PL.dir = 'up'; d.FL.x = d.FL.fx = 14; d.FL.y = d.FL.fy = 23; });
  for (let i = 0; i < 12; i++) await tick(100, 10);
  // ---- 开始录 ----
  let n = 0;
  const t1 = Date.now();
  const frame = async () => { await tick(1000 / FPS); if (step) await p.screenshot({ path: path.join(TMP, 'f' + String(n++).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 96 }); };
  for (const a of ROUTE) {
    if (a[0] === 'wait') { for (let i = 0; i < Math.round(a[1] * FPS); i++) await frame(); continue; }
    if (a[0] === 'map') { for (let i = 0; i < FPS * 8 && (await dbg()).map !== a[1]; i++) await frame(); continue; }
    // 走到 (x, y)：按住方向键，主角一迈向最后一格就松手（正好停在那一格）
    const d0 = await dbg(), dir = a[1] < d0.x ? 'ArrowLeft' : a[1] > d0.x ? 'ArrowRight' : a[2] < d0.y ? 'ArrowUp' : 'ArrowDown';
    await p.keyboard.down(dir);
    for (let i = 0; i < FPS * 12; i++) { await frame(); const d = await dbg(); if (d.map !== d0.map || (d.x === a[1] && d.y === a[2])) break; }
    await p.keyboard.up(dir);
    for (let i = 0; i < FPS && (await dbg()).moving; i++) await frame();
  }
  const t2 = Date.now(), d = await dbg();
  console.log('走完了：', JSON.stringify(d), step ? n + ' 帧 = ' + (n / FPS).toFixed(1) + ' 秒（录了 ' + ((t2 - t1) / 1000).toFixed(0) + ' 秒）' : ((t2 - t1) / 1000).toFixed(1) + ' 秒', errs.length ? '报错 ' + errs.slice(0, 2).join(' | ') : '');
  // ---- 转成 MP4 ----
  let args;
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf), '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT];
  if (step) { await ctx.close(); args = ['-y', '-framerate', String(FPS), '-i', path.join(TMP, 'f%05d.jpg'), '-vf', 'scale=720:1560:flags=lanczos:in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv'].concat(enc); }   // 截图是全范围的 JPEG，转成电视范围的 yuv420p（手机上的播放器都认）
  else { const vid = p.video(); await ctx.close(); args = ['-y', '-ss', ((t1 - T0) / 1000 - .2).toFixed(2), '-t', ((t2 - t1) / 1000).toFixed(2), '-i', await vid.path(), '-vf', 'crop=iw/2:ih/2:0:0,scale=720:1560:flags=lanczos'].concat(enc); }
  await browser.close(); s.close();
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error('ffmpeg 没成功：', (r.stderr || r.error || '').toString().slice(-600)); process.exit(1); }
  const pr = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', OUT], { encoding: 'utf8' });
  console.log(OUT + '  ' + (+pr.stdout).toFixed(1) + ' 秒  ' + (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
  if (opt.keep !== '1') fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
