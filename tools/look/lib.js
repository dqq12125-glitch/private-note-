// 回声岛 · 新老画风对比用的公用工具（tools/look/*.js 共用）：起一个小网站、开真显卡的无头浏览器、写存档、进大地图、传送到固定的地方
// 只读，不改游戏。老画风 = 平常的网址；新画风 = 网址带 ?look=new（见 world3d-open.js）
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const OUT = path.join(ROOT, 'tests', 'screenshots', 'look');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', glb: 'model/gltf-binary', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8', svg: 'image/svg+xml' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]);
      const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      fs.readFile(file, (e, buf) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        r.end(buf);
      });
    }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port }));
  });
}
// 真显卡（和 tools/perf 一样的参数）；gpu: false 时用软件渲染
const launch = (o) => chromium.launch({ args: (o && o.gpu === false ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']).concat(['--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb']) });

// 存档：刚拿到第一只怪兽（火苗狗跟在后面）、开场剧情都过了、学习锁关着、没有声音
const SAVE = (gfx, o) => Object.assign({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx: gfx || 'high', sfx: false, gate: false, music: 'off' }, player: { gender: (o && o.gender) || 'boy', name: 'Leo' },
  mon: { v: 2, box: [{ uid: 'm1', sp: (o && o.lead) || 'emberpup', lv: 12, xp: 0, shiny: !!(o && o.shiny) }], team: ['m1'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: (o && o.badges) || {} },
  world: { v: 3, started: true, map: 't0', x: 14, y: 9, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1, qtip: 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))), daily: {}, repel: 99999 },
});

// 开一个页面进大地图。o：{ look: 'new' | '', gfx, vp: {width, height}, dsf, video: {dir, size}, save: {...} }
async function open(browser, base, o) {
  o = o || {};
  const ctxOpt = { viewport: o.vp || { width: 420, height: 920 }, deviceScaleFactor: o.dsf || 2 };
  if (o.video) ctxOpt.recordVideo = o.video;
  const ctx = await browser.newContext(ctxOpt), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message.slice(0, 300)); });
  let nCon = 0;
  p.on('console', mm => { if ((mm.type() === 'error' || /WebGL|GL_|shader/i.test(mm.text())) && !/useProgram/.test(mm.text()) && nCon++ < 12) console.log('  [console]', mm.text().slice(0, 1200)); });
  await p.goto(base + '/tools/perf/blank.html');
  await p.evaluate(sv => localStorage.setItem('echo-island-v1', JSON.stringify(sv)), SAVE(o.gfx, o.save));
  await p.goto(base + '/index.html' + (o.look ? '?look=' + o.look : ''));
  await p.waitForSelector('[data-act=wEnter]', { timeout: 60000 });
  await p.click('[data-act=wEnter]');
  await p.waitForFunction(() => { try { const d = EchoWorld._debug(); return d.R && d.M && d.R.info && d.R.info().render.frame > 2; } catch (e) { return false; } }, null, { timeout: 60000 });
  const W = ms => p.waitForTimeout(ms);
  const t = {
    ctx, p, W, errs,
    dbg: () => p.evaluate(() => { const d = EchoWorld._debug(); return { map: d.M.id, x: d.PL.x, y: d.PL.y, dir: d.PL.dir, dlg: !!d.dlg, busy: d.busy, moving: d.PL.moving, kind: d.R.kind, look: d.R.look || '', using: d.R.using ? d.R.using() : '' }; }),
    // 对话框开着就点掉（进地图时可能触发剧情）。要选的时候选最后一个（委托的「以后再说」——第一个是「用英语帮 TA」，会去开 AI 聊天，这里不碰）
    async closeDlg() { for (let i = 0; i < 40 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) { await p.evaluate(() => { const picks = document.querySelectorAll('#w-dlg [data-act=wPick]'); const a = picks.length ? picks[picks.length - 1] : document.querySelector('#w-dlg [data-act=wSkip]') || document.querySelector('#world [data-act=wA].ba') || document.querySelector('#world [data-act=wA]'); if (a) a.click(); }); await W(140); } },
    async go(id, how) { await p.evaluate(([id, how]) => EchoWorld._debug().goMap(id, how), [id, how]); await p.waitForFunction(id => EchoWorld._debug().M.id === id, id, { timeout: 20000 }).catch(() => {}); await W(600); await t.closeDlg(); },
    // 直接站到 (x, y)、面朝 dir；跟着的怪兽站在身后一格
    tp: (x, y, dir) => p.evaluate(([x, y, dir]) => {
      const d = EchoWorld._debug(), D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir || 'up'];
      d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir || 'up'; d.PL.moving = false;
      const bx = x - D[0], by = y - D[1], c = d.M.grid[by] && d.M.grid[by][bx], ok = c && EchoMaps.WALK.includes(c) && !d.M.npcs.some(n => n.x === bx && n.y === by);
      d.FL.x = d.FL.fx = ok ? bx : x; d.FL.y = d.FL.fy = ok ? by : y;
    }, [x, y, dir]),
    // 按住方向键走 ms 毫秒
    async hold(dir, ms) { const K = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]; await p.keyboard.down(K); await W(ms); await p.keyboard.up(K); },
    info: () => p.evaluate(() => { const r = EchoWorld._debug().R, i = r.info(); return { calls: i.render.calls, tris: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures, prog: i.programs ? i.programs.length : 0 }; }),
    probe: () => p.evaluate(() => { const r = EchoWorld._debug().R; return r.probe ? r.probe() : null; }),
    shot: file => p.screenshot({ path: file }),
  };
  return t;
}

module.exports = { ROOT, OUT, serve, launch, open, SAVE, chromium };
