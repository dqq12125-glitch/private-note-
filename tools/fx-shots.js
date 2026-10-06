// 回声岛 · 技能特效截图检查（FX_SPEC §8）：无头浏览器里打开 tools/fx.html 放招，按时间均匀截 12 帧，拼成 4×3 的接触印样图
// 存到 tests/screenshots/fx/<type>-<tier>.png（辅助招式 <type>-s.png、工具演示 demo-<名字>.png；画质不是 high 时文件名后面加 -mid / -low），
// 并打印：总时长（到特效全部淡完）、命中时刻、最多同时粒子数、闪屏次数（限频跳过的另算）、显存对象数（几何体 / 贴图，放招前 → 后）、着色器程序数。
//
// 用法：
//   node tools/fx-shots.js fire 2                 一招（tier 0 小招 / 1 中招 / 2 大招 / s 辅助招式 / all 三档）
//   node tools/fx-shots.js all                    全部 51 招（17 属性 × 3 档）
//   node tools/fx-shots.js fire,water all --q mid 几个属性、中画质
//   node tools/fx-shots.js demo lightning         kit 工具演示（demo all 全部）
//   node tools/fx-shots.js --leak [60]            泄漏检查：先把 51 招各放一遍填满缓存，再连放 60 招，比较 renderer.info.memory
// 其他参数：--q high|mid|low（默认 high）、--side foe（对手出招）、--me emberpup --foe bubbly、--w 390 --h 300、--step 40（截图间隔，毫秒）
//
// 用 Playwright 的假时钟：每次往前拨 step 毫秒、画几帧、截一张，所以软件渲染再慢，截到的时刻和时长也是准的（特效都按时间算）。
// 注意：CSS 动画 / 过渡不归假时钟管（是浏览器合成器按真实时间跑的），DOM 过场的截图时刻会对不上，要用 JS 按时间驱动才截得准
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const OUT = path.join(ROOT, 'tests', 'screenshots', 'fx');
const ORDER = ['normal', 'fire', 'water', 'grass', 'spark', 'ice', 'fight', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
const DEMOS = ['energyBeam', 'lightning', 'flame', 'shockwave', 'impactStar', 'decal', 'trail', 'aura', 'groundCircle', 'light', 'particles', 'flash', 'slowmo'];

// ---------- 参数 ----------
const argv = process.argv.slice(2), pos = [], opt = { q: 'high', side: 'me', me: '', foe: '', w: 390, h: 300, step: 40, frames: 12, leak: 0 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--leak') { opt.leak = /^\d+$/.test(argv[i + 1] || '') ? +argv[++i] : 60; continue; }
  if (a.startsWith('--')) { const k = a.slice(2); opt[k] = argv[++i]; continue; }
  pos.push(a);
}
['w', 'h', 'step', 'frames'].forEach(k => { opt[k] = +opt[k]; });
if (!['high', 'mid', 'low'].includes(opt.q)) { console.log('画质只能是 high / mid / low'); process.exit(1); }
if (!opt.leak && !pos.length) { console.log('用法：node tools/fx-shots.js <type|all|demo> [tier|all|s] [--q high|mid|low] [--side foe] [--leak [60]]'); process.exit(1); }
// 要放的招：[{ type, tier, support, demo }]
const jobs = [];
if (!opt.leak) {
  if (pos[0] === 'demo') (pos[1] && pos[1] !== 'all' ? pos[1].split(',') : DEMOS).forEach(n => jobs.push({ demo: n }));
  else {
    const types = pos[0] === 'all' ? ORDER : pos[0].split(',');
    const tiers = !pos[1] ? (pos[0] === 'all' ? ['0', '1', '2'] : ['0']) : pos[1] === 'all' ? ['0', '1', '2'] : pos[1].split(',');
    types.forEach(t => { if (!ORDER.includes(t)) { console.log('没有这个属性：' + t); process.exit(1); } tiers.forEach(k => jobs.push(k === 's' ? { type: t, tier: 0, support: true } : { type: t, tier: +k })); });
  }
}

(async () => {
  const launch = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: Math.max(900, opt.w + 560), height: Math.max(700, opt.h + 400) }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  const qs = new URLSearchParams({ q: opt.q, side: opt.side, w: opt.w, h: opt.h, sfx: '0' });
  if (opt.me) qs.set('me', opt.me);
  if (opt.foe) qs.set('foe', opt.foe);
  await page.clock.install();
  await page.goto('file:///' + path.join(ROOT, 'tools', 'fx.html').replace(/\\/g, '/') + '?' + qs);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
  // 停住时钟：之后只有我们往前拨，时间才会走
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 50);
  await page.clock.runFor(300);   // 先画几帧
  const arena = await page.$('#b-arena');

  // 放一招：每 step 毫秒截一张（shots 为 false 时不截，泄漏检查用），直到特效全部淡完（最多 9 秒）
  async function run(job, shots) {
    await page.evaluate(j => {
      window.__fx = null; window.__fxErr = null;
      (j.demo ? FXT.demo(j.demo) : FXT.play(j.type, j.tier, { support: j.support })).then(r => { window.__fx = r; }, e => { window.__fxErr = String(e && e.stack || e); });
    }, job);
    const frames = [], step = shots ? opt.step : 100;
    let t = 0, impact = null, st = null;
    while (t < 9000) {
      await page.clock.runFor(step); t += step;
      const s = await page.evaluate(() => ({ r: window.__fx && { impact: window.__fx.impact, mem0: window.__fx.mem0 }, err: window.__fxErr, st: FXT.state() }));
      if (s.err) throw new Error(s.err);
      if (shots) frames.push({ t, buf: await arena.screenshot() });
      if (s.r && impact == null) impact = s.r;
      st = s.st;
      if (impact && st.idle) break;
    }
    return { t, impact: impact ? Math.round(impact.impact) : null, mem0: impact ? impact.mem0 : null, st, frames };
  }
  const name = j => j.demo ? 'demo-' + j.demo : j.type + '-' + (j.support ? 's' : j.tier);
  const label = j => j.demo ? 'kit.' + j.demo : j.type + ' ' + (j.support ? '辅助招式' : ['小招', '中招', '大招'][j.tier]);
  const memStr = (a, b) => a ? 'geo ' + a.geometries + '→' + b.geometries + ' tex ' + a.textures + '→' + b.textures : '';

  if (opt.leak) {
    // ---------- 泄漏检查 ----------
    const all = [];
    ORDER.forEach(t => [0, 1, 2].forEach(k => all.push({ type: t, tier: k })));
    const mem = () => page.evaluate(() => { const s = FXT.state(); return { geometries: s.mem.geometries, textures: s.mem.textures, programs: s.programs }; });
    const m0 = await mem();
    console.log('开始：' + JSON.stringify(m0) + '（画质 ' + opt.q + '）');
    for (const j of all) await run(j, false);
    for (const t of ORDER) await run({ type: t, tier: 0, support: true }, false);
    const m1 = await mem();
    console.log('51 招 + 17 个辅助招式各放一遍（缓存填满）：' + JSON.stringify(m1));
    for (let i = 0; i < opt.leak; i++) {
      await run(all[(i * 7) % all.length], false);
      if ((i + 1) % 20 === 0) console.log('  连放 ' + (i + 1) + ' 招：' + JSON.stringify(await mem()));
    }
    const m2 = await mem();
    const ok = m2.geometries <= m1.geometries + 3 && m2.textures <= m1.textures + 1;
    console.log('再连放 ' + opt.leak + ' 招：' + JSON.stringify(m2));
    console.log((ok ? 'PASS' : 'FAIL') + ' 泄漏检查：几何体 ' + m1.geometries + '→' + m2.geometries + '，贴图 ' + m1.textures + '→' + m2.textures + '（比最开始多出来的是共用缓存：几何体 +' + (m2.geometries - m0.geometries) + '、贴图 +' + (m2.textures - m0.textures) + '）');
    if (!ok) process.exitCode = 1;
  } else {
    // ---------- 接触印样图 ----------
    fs.mkdirSync(OUT, { recursive: true });
    const cmp = await browser.newPage({ deviceScaleFactor: 1 });   // 拼图用的页面（另一个上下文，没有假时钟）
    await cmp.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    for (const j of jobs) {
      if (j.demo && !DEMOS.includes(j.demo)) { console.log('没有这个演示：' + j.demo + '（有 ' + DEMOS.join(' ') + '）'); continue; }
      const r = await run(j, true);
      const total = r.t, n = Math.min(opt.frames, r.frames.length), pick = [];
      // 从第一帧到淡完，均匀取 n 帧；标出命中那一帧
      for (let i = 0; i < n; i++) { const want = r.frames[0].t + (total - r.frames[0].t) * i / Math.max(1, n - 1); let best = r.frames[0]; r.frames.forEach(f => { if (Math.abs(f.t - want) < Math.abs(best.t - want)) best = f; }); pick.push(best); }
      const hitF = r.impact != null && !j.demo ? r.frames.find(f => f.t >= r.impact) : null;
      const mv = j.demo ? '' : await page.evaluate(([t, k, s]) => s ? DEX.TYPES[t].zh + '系辅助招式' : DEX.MOVES[t][k][0] + ' ' + DEX.MOVES[t][k][1], [j.type, j.tier, !!j.support]);
      const cap = j.demo ? 0 : j.support ? 1200 : [1000, 1600, 2800][j.tier];
      const info = '命中 ' + (j.demo ? '—' : r.impact + ' ms（上限 ' + cap + '）') + ' · 淡完 ' + total + ' ms · 粒子峰值 ' + r.st.peak + ' · 闪屏 ' + r.st.flashes + (r.st.flashSkipped ? '（限频跳过 ' + r.st.flashSkipped + '）' : '') + ' · ' + memStr(r.mem0, r.st.mem) + ' · 着色器 ' + r.st.programs + (r.st.over ? ' · 出招超时 ' + r.st.over : '');
      const title = label(j) + (mv ? ' · ' + mv : '') + ' · ' + opt.q + (opt.side === 'foe' ? ' · 对手出招' : '');
      const png = await cmp.evaluate(async ({ imgs, labels, marks, title, info, w, h }) => {
        const cols = 4, rows = Math.ceil(imgs.length / cols), pad = 6, head = 48, lab = 18;
        const c = document.createElement('canvas'); c.width = cols * (w + pad) + pad; c.height = head + rows * (h + lab + pad) + pad;
        const g = c.getContext('2d');
        g.fillStyle = '#1d232b'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#ffffff'; g.font = 'bold 17px "Microsoft YaHei", sans-serif'; g.fillText(title, pad, 22);
        g.fillStyle = '#c8d2dc'; g.font = '13px "Microsoft YaHei", sans-serif'; g.fillText(info, pad, 41);
        for (let i = 0; i < imgs.length; i++) {
          const im = new Image(); im.src = 'data:image/png;base64,' + imgs[i]; await im.decode();
          const x = pad + (i % cols) * (w + pad), y = head + Math.floor(i / cols) * (h + lab + pad);
          g.drawImage(im, x, y + lab, w, h);
          g.fillStyle = marks[i] ? '#ffcf40' : '#9fb0c0'; g.font = (marks[i] ? 'bold ' : '') + '12px "Microsoft YaHei", sans-serif'; g.fillText(labels[i], x + 2, y + 13);
          if (marks[i]) { g.strokeStyle = '#ffcf40'; g.lineWidth = 3; g.strokeRect(x - 1, y + lab - 1, w + 2, h + 2); }
        }
        return c.toDataURL('image/png');
      }, { imgs: pick.map(f => f.buf.toString('base64')), labels: pick.map(f => 't=' + f.t + 'ms' + (hitF && f === hitF ? ' 命中' : '')), marks: pick.map(f => !!(hitF && f === hitF)), title, info, w: opt.w + 6, h: opt.h + 6 });
      const file = path.join(OUT, name(j) + (opt.q === 'high' ? '' : '-' + opt.q) + (opt.side === 'foe' ? '-foe' : '') + '.png');
      fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
      console.log(name(j).padEnd(14) + ' ' + (mv || '').padEnd(24) + ' 命中 ' + String(j.demo ? '-' : r.impact).padStart(5) + 'ms  淡完 ' + String(total).padStart(5) + 'ms  粒子峰值 ' + String(r.st.peak).padStart(4) + '  闪屏 ' + r.st.flashes + (r.st.flashSkipped ? '(+' + r.st.flashSkipped + '跳过)' : '') + '  ' + memStr(r.mem0, r.st.mem) + '  着色器 ' + r.st.programs + (!j.demo && r.impact > cap ? '  ⚠ 超过时长上限 ' + cap + 'ms' : '') + '  → ' + path.relative(ROOT, file));
    }
  }
  if (errs.length) { console.log('浏览器里有 ' + errs.length + ' 条报错 / 警告：'); [...new Set(errs)].slice(0, 12).forEach(e => console.log('  ' + e)); process.exitCode = 1; } else console.log('没有报错');
  await browser.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
