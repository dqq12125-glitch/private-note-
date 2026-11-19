// 回声岛 · 3D 小人（people3d.js）的对比图：真显卡的无头浏览器打开 tools/people3d.html 的拼图模式，一张张截下来
// 用法：
//   node tools/look/people-shots.js                       全部：front（全部造型正面，3D 旁边是 2D）、game（全部造型，游戏里那样从身后上方看：背面 + 侧面）、
//                                                         side（全部造型的侧面：朝左、朝右 × 平视、游戏镜头，旁边是 2D 的侧面）、turn（几个造型从正脸一点点转到侧脸）、
//                                                         walk（脚滑不滑：三种速度各走一个来回，地上的格子按速度退；男孩女孩四个朝向走一圈 8 帧）、
//                                                         states（走 / 跑 / 骑车 / 踏浪 / 说话 / 挥手，跳台阶从起跳到落地）、close（几个造型放大看）
//   node tools/look/people-shots.js front,game            只拍这几种
//   --only boy,girl,mom     只拍这几个造型          --detail low     省电的那一档（文件名带 -low）
//   --size 260              一格多高（默认 190；游戏里 2 倍屏上一个人大约 150–250 像素高）   --dsf 2   像素密度（默认 1）
//   --tag x                 文件名后面加 -x          --per 32         一张图放几个造型（默认 32）
// 图存在 tests/screenshots/look/people3d-*.png。改了 people3d.js 要重拍、看图。
const path = require('path'), fs = require('fs');
const L = require('./lib');

const argv = process.argv.slice(2), opt = { only: '', detail: 'high', size: 0, dsf: 1, tag: '', per: 32, outline: '1' };
const kinds = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) opt[a.slice(2)] = argv[++i]; else kinds.push(...a.split(',')); }
if (!kinds.length) kinds.push('front', 'game', 'side', 'turn', 'walk', 'states', 'close');
const CLOSE = 'boy,girl,leo,mia,mom,prof,nurse,guard,hiker,chef,whisper,gale';

(async () => {
  fs.mkdirSync(L.OUT, { recursive: true });
  const { s, base } = await L.serve(), b = await L.launch();
  const ctx = await b.newContext({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: +opt.dsf || 1 }), p = await ctx.newPage();
  let errs = 0;
  p.on('pageerror', e => { errs++; console.log('  [err]', e.message.slice(0, 400)); });
  p.on('console', m => { if (m.type() === 'error' || /WebGL|GL_|shader/i.test(m.text())) console.log('  [console]', m.text().slice(0, 600)); });
  const suffix = (opt.detail !== 'high' ? '-' + opt.detail : '') + (opt.tag ? '-' + opt.tag : '');
  for (const kind of kinds) {
    const q = new URLSearchParams({ sheet: kind, detail: opt.detail, outline: opt.outline });
    const only = opt.only || (kind === 'close' ? CLOSE : '');
    if (only) q.set('only', only);
    if (+opt.size) q.set('size', opt.size);
    const paged = kind === 'front' || kind === 'game' || kind === 'close' || kind === 'side';
    if (paged) q.set('per', kind === 'close' ? 4 : kind === 'side' ? 16 : opt.per);
    let pages = 1;
    for (let pg = 1; pg <= pages; pg++) {
      if (paged) q.set('page', pg);
      await p.goto(base + '/tools/people3d.html?' + q);
      await p.waitForFunction(() => window.P3D && P3D.ready, null, { timeout: 60000 });
      const info = await p.evaluate(() => ({ pages: P3D.pages, n: P3D.views.length, st: P3D.stats(), tris: P3D.views.map(v => v.inst.tris) }));
      pages = paged ? info.pages : 1;
      const file = path.join(L.OUT, 'people3d-' + kind + (pages > 1 ? '-' + pg : '') + suffix + '.png');
      await p.locator('#stage').screenshot({ path: file });
      const tr = info.tris;
      console.log(path.relative(L.ROOT, file) + '   ' + info.n + ' 个小窗，三角形 ' + (tr.length ? Math.min(...tr) + '–' + Math.max(...tr) : '-') + '，搭网格平均 ' + (info.st.ms / Math.max(1, info.st.built)).toFixed(2) + ' 毫秒 / 个');
    }
  }
  await b.close(); s.close();
  if (errs) { console.log('页面报错 ' + errs + ' 处'); process.exitCode = 1; }
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
