// 第一座挑战馆的鹦鹉门（老板 2026-11-20 的截图）改之前 / 改之后对比：iPhone 17 横屏、竖屏 × 中文、英语界面，三道门的答题页各拍一张（不画框）。
// 用法：node tools/ui-audit/parrot.js [--base HEAD]   结果：tests/screenshots/ui-audit/parrot/<before|after>-<屏幕>-<语言>-<门>.png
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib'), RUN = require('./run');
const argv = process.argv.slice(2), bi = argv.indexOf('--base'), base = bi < 0 ? '' : (argv[bi + 1] || 'HEAD');
const OUT = path.join(L.OUT, 'parrot'); fs.mkdirSync(OUT, { recursive: true });
const GATES = [[6, 15, 'morning'], [4, 9, 'afternoon'], [9, 5, 'evening']];   // 站在门下面一格，面朝门（门从下往上：早上 → 下午 → 晚上）

(async () => {
  const over = base ? RUN.baseDir(base).dir : null, tag = base ? 'before' : 'after';
  const srv = await L.serve(over), browser = await L.IL.launch('chromium');
  for (const view of ['ip17-l', 'ip17-p']) for (const lang of ['zh', 'en']) {
    const t = await L.open(browser, srv.base, { view, lang, bridge: {} });
    for (const [x, y, name] of GATES) {
      await t.boot(L.SAVE({ lang, world: { map: 'i0G', x, y, dir: 'up' } }), '', null, true);
      await t.enterWorld();
      await t.E(() => EchoWorld._debug().M.npcs.forEach(n => { n.sight = 0; }));
      // 门在 (x, y-1)：站在下面一格（老的门位置：第 12、8、4 行的 |）
      const g = await t.E(() => { const M = EchoWorld._debug().M; return M.gates.map(q => [q.x, q.y]); });
      const gate = g.sort((a, b) => b[1] - a[1])[GATES.findIndex(q => q[2] === name)];
      await t.tp(gate[0], gate[1] + 1, 'up'); await t.A(); await t.W(300);
      await t.toTask(10); await t.typed(); await t.settle(400);
      const file = path.join(OUT, tag + '-' + view + '-' + lang + '-' + name + '.png');
      await t.p.screenshot({ path: file });
      console.log(file);
    }
    await t.ctx.close();
  }
  await browser.close(); srv.close();
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
