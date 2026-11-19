// 回声岛 · 新老画风对比截图：在同样几个固定的地方，老画风、新画风各拍一张，再拼成左右对比的图
// 用法：node tools/look/shots.js [new|old|both] [--gfx high] [--only t0-plaza,r0-grass] [--tag r3]
//   new / old / both：拍哪种（默认 both）；none：不拍，只用现成的截图重新拼对比图；--only 只拍这几个地方；--tag 给这一轮起个名字（文件名后面加 -<tag>，方便一轮轮留着比）
// 结果在 tests/screenshots/look/：<地方>-old.png / <地方>-new.png（840×1840，手机竖屏 2 倍）、sheet-<地方>.png（左老右新）、sheet-all.png（全部缩小排在一张上）
// 真显卡的无头浏览器（--use-angle=d3d11），页面走本机小网站（这样怪兽的模型读得到）
const fs = require('fs'), path = require('path');
const L = require('./lib');

const argv = process.argv.slice(2), opt = { gfx: 'high', only: '', tag: '' }, pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else pos.push(argv[i]); }
const WHICH = pos[0] || 'both';
const PORT = { width: 420, height: 920 }, LAND = { width: 920, height: 420 };
// 固定的几个地方：[名字, 说明, 地图, x, y, 面朝, 横屏?, 到了以后做什么（'talk' = 按 A 和面前的人说话）]
const SPOTS = [
  ['t0-arrive', '第一座小镇 · 刚到', 't0', 14, 9, 'up'],
  ['t0-plaza', '小镇中间 · 有人', 't0', 12, 18, 'up'],
  ['t0-quest', '有委托的人（头上金色的 ?）', 't0', 10, 18, 'up'],
  ['t0-side', '跟着走的怪兽（侧面）', 't0', 16, 15, 'right'],
  ['t0-talk', '和人说话（对话框开着）', 't0', 10, 17, 'up', false, 'talk'],
  ['t0-water', '码头 · 水边', 't0', 14, 23, 'left'],
  ['t0-beach', '沙滩', 't0', 9, 20, 'up'],
  ['t0-exit', '小镇北口 · 去 1 号路', 't0', 15, 3, 'up'],
  ['r0-south', '1 号路 · 刚出小镇', 'r0', 11, 41, 'up'],
  ['r0-grass', '1 号路 · 草丛（旁边站着训练师）', 'r0', 6, 26, 'up'],
  ['r0-ledge', '1 号路 · 台阶下面', 'r0', 6, 15, 'up'],
  ['r0-ledge-top', '1 号路 · 台阶上面、池塘边', 'r0', 9, 12, 'down'],
  ['r0-house', '1 号路 · 路边小屋', 'r0', 6, 22, 'up'],
  ['t0-plaza-land', '小镇中间（横屏）', 't0', 12, 18, 'up', true],
  ['r0-grass-land', '1 号路 · 草丛（横屏）', 'r0', 6, 34, 'up', true],
];

(async () => {
  fs.mkdirSync(L.OUT, { recursive: true });
  const { s, base } = await L.serve(), browser = await L.launch();
  const spots = SPOTS.filter(q => !opt.only || opt.only.split(',').includes(q[0])), tag = opt.tag ? '-' + opt.tag : '';
  for (const look of ['old', 'new']) {
    if (WHICH !== 'both' && WHICH !== look) continue;
    for (const land of [false, true]) {
      const list = spots.filter(q => !!q[6] === land);
      if (!list.length) continue;
      const t = await L.open(browser, base, { look: look === 'new' ? 'new' : '', gfx: opt.gfx, vp: land ? LAND : PORT });
      await t.W(6500);   // 等地名横幅和「现在要做」的提示收起来、怪兽的模型下载好
      let cur = 't0';
      for (const [name, , map, x, y, dir, , act] of list) {
        if (map !== cur) { await t.go(map, map === 'r0' ? 'from:t0' : 'door:C'); cur = map; await t.W(3200); }
        await t.tp(x, y, dir);
        // 镇上的人平时会东张西望（world.js 每隔几秒随机转一下）：拍照时让大家都朝着镜头站好、先别转，不然每次拍出来不一样，还常常只拍到后脑勺
        await t.p.evaluate(() => { const d = EchoWorld._debug(); d.M.npcs.forEach(n => { n.face = 'down'; n.nextTurn = performance.now() + 120000; }); });
        await t.W(1600);
        await t.closeDlg();
        if (act === 'talk') { await t.p.evaluate(() => document.querySelector('#world [data-act=wA].ba').click()); await t.W(1500); }
        await t.shot(path.join(L.OUT, name + '-' + look + tag + '.png'));
        if (act === 'talk') await t.closeDlg();
        const d = await t.dbg(), i = await t.info();
        console.log(look.padEnd(4), name.padEnd(16), JSON.stringify(d.using || d.kind), 'calls', i.calls, 'tris', i.tris, 'tex', i.tex, 'geo', i.geo, 'prog', i.prog);
      }
      if (t.errs.length) console.log('  报错：', t.errs.slice(0, 3).join(' | '));
      await t.ctx.close();
    }
  }
  // 拼对比图：每个地方一张（左老右新），再加一张总览
  const pg = await (await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const has = f => fs.existsSync(path.join(L.OUT, f));
  const css = 'body{margin:0;background:#16202b;font:600 26px "Microsoft YaHei",sans-serif;color:#fff}.row{display:flex;gap:16px;padding:10px 16px 16px}.c img{display:block}.c b{display:block;padding:0 4px 8px;font-size:22px;color:#ffd76a}h2{margin:0;padding:14px 18px 0;font-size:28px}';
  for (const [name, zh, , , , , land] of spots) {
    if (!has(name + '-old' + tag + '.png') || !has(name + '-new' + tag + '.png')) continue;
    const w = land ? 920 : 630, html = '<style>' + css + '</style><h2>' + zh + '</h2><div class="row" style="' + (land ? 'flex-direction:column' : '') + '">' + ['old', 'new'].map(k => '<div class="c"><b>' + (k === 'old' ? '现在的样子' : '新画风') + '</b><img width="' + w + '" src="' + base + '/tests/screenshots/look/' + name + '-' + k + tag + '.png?' + Date.now() + '"></div>').join('') + '</div>';
    await pg.setViewportSize(land ? { width: 952, height: 1040 } : { width: 1308, height: 1500 });
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(L.OUT, 'sheet-' + name + tag + '.png'), fullPage: true });
  }
  const pairs = spots.filter(q => has(q[0] + '-old' + tag + '.png') && has(q[0] + '-new' + tag + '.png'));
  if (pairs.length > 1) {
    const cell = q => '<div style="padding:10px"><div style="font-size:18px;margin-bottom:6px">' + q[1] + '</div><div style="display:flex;gap:6px">' + ['old', 'new'].map(k => '<img width="' + (q[6] ? 400 : 200) + '" src="' + base + '/tests/screenshots/look/' + q[0] + '-' + k + tag + '.png?' + Date.now() + '">').join('') + '</div></div>';
    await pg.setViewportSize({ width: 1720, height: 900 });
    await pg.setContent('<style>' + css + '</style><h2>回声岛 · 现在的样子（左） / 新画风（右）</h2><div style="display:flex;flex-wrap:wrap;padding:8px">' + pairs.map(cell).join('') + '</div>', { waitUntil: 'load' });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(L.OUT, 'sheet-all' + tag + '.png'), fullPage: true });
  }
  await browser.close(); s.close();
  console.log('存在 ' + L.OUT);
})().catch(e => { console.error(e); process.exit(1); });
