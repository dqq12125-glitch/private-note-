// 回声岛 · 新画风转镜头的检查图：在几个固定的地方，镜头绕着主角转到 0° / 90° / 180° / 270° / 135° 各拍一张，拼成一行
// 用法：node tools/look/orbit.js [--gfx high] [--only t0-plaza,j8-path] [--yaw 0,90,180,270,135] [--tilt 0] [--land 1] [--tag 名字] [--isles 1 | --isles 3,8] [--at t5:18:13,t9:15:16:down]
//   --tilt：俯角比平常多多少度（负的 = 压低）；--land 1：横屏；--tag：文件名后面加 -<tag>；--isles：每座岛的固定机位；--at：随便指定地方
// 结果在 tests/screenshots/look/：orbit-<地方>.png（一行五张，下面写着朝哪边看、三角形 / draw call、主角露出来多少），单张在 orbit/ 里
// 角度：0 = 镜头在主角南边朝北看（平常的样子），90 = 镜头在东边朝西看，180 = 在北边朝南看，270 = 在西边朝东看（world3d-open.js 的 orbit）
// 改了新画风里和朝向有关的东西（房子、树、远景、遮挡）要重拍、每张都看：房子有没有缺面、地图外面有没有空着、主角有没有被挡住、头上的牌子朝不朝镜头
const fs = require('fs'), path = require('path');
const L = require('./lib');
const argv = process.argv.slice(2), opt = { gfx: 'high', only: '', yaw: '0,90,180,270,135', tilt: 0, land: 0, tag: '' };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
// [名字, 说明, 地图, x, y, 面朝]
const SPOTS = [
  ['t0-plaza', '你好岛 · 小镇中间', 't0', 12, 18, 'up'],
  ['t0-house', '你好岛 · 大房子后面', 't0', 14, 3, 'up'],
  ['t0-pier', '你好岛 · 码头', 't0', 14, 23, 'down'],
  ['r0-grass', '1 号路 · 草丛', 'r0', 6, 26, 'up'],
  ['r0-ledge', '1 号路 · 台阶下面', 'r0', 6, 15, 'up'],
  ['t7-plaza', '生日派对岛 · 喷泉广场', 't7', 18, 20, 'up'],
  ['j8-path', '丛林小径 · 林中路', 'j8', 14, 37, 'up'],
  ['j8-river', '丛林小径 · 河和瀑布', 'j8', 36, 16, 'up'],
  ['t12-lake', '回忆岛 · 湖和古迹', 't12', 16, 27, 'up'],
  ['t12-temple', '回忆岛 · 石头神殿', 't12', 6, 14, 'up'],
];
const FACE = { 0: '朝北看（平常）', 90: '朝西看', 180: '朝南看', 270: '朝东看' };
// --isles 1（或 --isles 3,8）：换成每座岛的固定机位（tools/look/isles.js，每座岛的前两个：多半是小镇），看每种房子、每种树从四面看过去的样子
if (opt.isles) { const ISL = require('./isles'), pick = String(opt.isles) === '1' || opt.isles === 'all' ? ISL : String(opt.isles).split(',').map(n => ISL.find(q => q.n === +n)).filter(Boolean); SPOTS.length = 0; pick.forEach(q => q.spots.slice(0, 2).forEach(sp => SPOTS.push(sp.slice(0, 6)))); }
// --at 地图:x:y[:面朝]（可以用逗号隔开写几个）：随便指定几个地方
if (opt.at) { SPOTS.length = 0; String(opt.at).split(',').forEach(s => { const [map, x, y, dir] = s.split(':'); SPOTS.push([map + '-' + x + '-' + y, map + ' (' + x + ', ' + y + ')', map, +x, +y, dir || 'up']); }); }

(async () => {
  const dir1 = path.join(L.OUT, 'orbit'); fs.mkdirSync(dir1, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const spots = SPOTS.filter(q => !opt.only || opt.only.split(',').includes(q[0])), yaws = String(opt.yaw).split(',').map(Number), tag = opt.tag ? '-' + opt.tag : '';
  const vp = +opt.land ? { width: 920, height: 420 } : { width: 420, height: 920 };
  const t = await L.open(browser, base, { look: 'new', gfx: opt.gfx, vp, save: { badges: Object.fromEntries([...Array(13).keys()].map(i => [i, 1])) } });
  await t.W(6000);
  let cur = 't0';
  const notes = {};
  for (const [name, , map, x, y, dir] of spots) {
    if (map !== cur) {
      await t.go(map, map === 'r0' ? 'from:t0' : 'start'); cur = map; await t.W(3000);
      // 有的地图一进去就演剧情、开打：等它演完、把对话点掉
      for (let k = 0; k < 20 && !(await t.p.evaluate(() => document.body.className.includes('scr-world') && !EchoWorld._debug().busy)); k++) { await t.closeDlg(); await t.W(500); }
    }
    await t.tp(x, y, dir);
    await t.p.evaluate(() => { const d = EchoWorld._debug(); d.M.npcs.forEach(n => { n.face = 'down'; n.nextTurn = performance.now() + 600000; }); });
    notes[name] = [];
    for (const yaw of yaws) {
      await t.p.evaluate(([a, tl]) => EchoWorld._debug().R.orbit('set', a * Math.PI / 180, tl * Math.PI / 180), [yaw, +opt.tilt]);
      await t.W(1500); await t.closeDlg();
      let i = null; for (let k = 0; k < 3; k++) { const q = await t.info(); if (!i || q.tris < i.tris) i = q; await t.W(100); }
      const pr = await t.p.evaluate(() => { const p = EchoWorld._debug().R.probe(); return { seen: p.seen(), faded: p.faded, pitch: p.pitch, q: p.q }; });
      await t.shot(path.join(dir1, name + '-' + yaw + tag + '.png'));
      const note = { yaw, tris: i.tris, calls: i.calls, seen: pr.seen == null ? null : +pr.seen.toFixed(2), faded: pr.faded, pitch: Math.round(pr.pitch * 57.3), q: pr.q };
      notes[name].push(note);
      console.log(name.padEnd(12), JSON.stringify(note));
    }
    await t.p.evaluate(() => EchoWorld._debug().R.orbit('set', 0, 0));
  }
  if (t.errs.length) console.log('  报错：', t.errs.slice(0, 3).join(' | '));
  await t.ctx.close();
  // 拼图：每个地方一行
  const pg = await (await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const css = 'body{margin:0;background:#16202b;font:600 20px "Microsoft YaHei",sans-serif;color:#fff}h2{margin:0;padding:12px 16px 4px;font-size:24px}.row{display:flex;gap:10px;padding:8px 14px 14px}.c{flex:none}.c b{display:block;padding:0 2px 4px;color:#ffd76a}.c small{display:block;padding:4px 2px 0;font-size:13px;line-height:1.5;color:#b9cad6}.c img{display:block}';
  for (const [name, zh] of spots) {
    const w = +opt.land ? 600 : 300;
    const cells = notes[name].map(n => '<div class="c" style="width:' + w + 'px"><b>' + n.yaw + '° ' + (FACE[n.yaw] || '') + '</b><img width="' + w + '" src="' + base + '/tests/screenshots/look/orbit/' + name + '-' + n.yaw + tag + '.png?' + Date.now() + '"><small>' + n.tris + ' 个三角形 · ' + n.calls + ' 次<br>主角露出 ' + (n.seen == null ? '—' : Math.round(n.seen * 100) + '%') + (n.faded ? ' · 淡出 ' + n.faded + ' 栋房子' : '') + '</small></div>').join('');
    await pg.setViewportSize({ width: +opt.land ? 1260 : 1590, height: 800 });
    await pg.setContent('<style>' + css + '</style><h2>' + zh + ' — 镜头绕着主角转' + (+opt.tilt ? '（俯角 ' + (+opt.tilt > 0 ? '+' : '') + opt.tilt + '°）' : '') + '</h2><div class="row">' + cells + '</div>', { waitUntil: 'load' });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(L.OUT, 'orbit-' + name + tag + '.png'), fullPage: true });
  }
  await browser.close(); s.close();
  console.log('存在 ' + L.OUT);
})().catch(e => { console.error(e); process.exit(1); });
