// 存档越玩越大以后还快不快、放不放得下（2026-11-15）：
// 1. 走路只记位置：存档小的时候（不到 6 万字）照老办法每一步整份存；存档大了，每走一步只往 KEY-pos 写一条很小的记录，不整份重写存档，
//    停下来 1 秒 / 换地图 / 开战前 / 回首页 / 切后台 才整份存（这里用 RT.walkFull = 0 让小存档也走这条路，测起来快）；
//    没来得及整份存就被关掉：下次打开还在走到的地方；存档被换过（从备份恢复、测试换存档）：位置记录不乱套、也不去盖别人刚写的存档
// 2. 「玩了 3 年」的大存档（tools/perf/bigsave.js）打得开；掌握了的聊天句子只留最近 200 条、「累计掌握」不少
// 3. 备份压着存（约六分之一）：轮换、坏档另存、用压过的备份恢复、「从备份恢复」、清空 / 恢复前另存
// 4. 存档空间快满之前先说：首页挂一条、弹窗请家长导出；再满就删最老的两份备份；真存不进去还是弹「存档存不进去了」
// 运行：node tests/save.test.js（大约 1 分钟）
const H = require('./helpers');
const BS = require('../tools/perf/bigsave');
const KEY = 'echo-island-v1';
(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  const E = (f, a) => p.evaluate(f, a);
  const ls = k => E(k => localStorage.getItem(k), k);
  const pos = () => E(k => { const w = JSON.parse(localStorage.getItem(k)).world; return w.map + ',' + w.x + ',' + w.y; }, KEY);
  const here = async () => { const d = await t.dbg(); return d.map + ',' + d.x + ',' + d.y; };
  // 一块空地（zs1，右上角有个洞口通 zs2）
  const defineMaps = () => E(() => {
    EchoMaps.define('zs1', { kind: 'route', z: 0, name: '存档测试场', en: 'Save Field', noGrass: true, rows: ['RRRRRRRRRRRR', 'R......%...R', 'R..........R', 'R..........R', 'R...@......R', 'RRRRRRRRRRRR'], links: { '%': ['zs2'] } });
    EchoMaps.define('zs2', { kind: 'cave', z: 0, name: '存档测试洞', rows: ['XXXXXXXX', 'X::::::X', 'X::%:::X', 'X::::::X', 'XXXXXXXX'], links: { '%': ['zs1'] } });
  });
  const SMALL = o => Object.assign({
    seenIntro: true, coins: 500, settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', pin: '1234' }, player: { gender: 'girl', name: 'Coco' },
    mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 40, xp: 0 }, { uid: 'u1', sp: 'flamewolf', lv: 40, xp: 0 }], team: ['u0', 'u1'], dex: {}, balls: 5, potions: 3, bag: {}, badges: {} },
    world: { v: 3, started: true, map: 'zs1', x: 4, y: 4, dir: 'up', repel: 9999, visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} },
  }, o || {});
  // 换一份存档重新打开（不进大地图）；extra = 另外要放的键
  const boot = async (save, extra) => {
    await E(([k, s, x]) => { Object.keys(localStorage).filter(q => q.startsWith(k)).forEach(q => localStorage.removeItem(q)); Object.entries(x || {}).forEach(([q, v]) => localStorage.setItem(q, v)); if (s != null) localStorage.setItem(k, typeof s === 'string' ? s : JSON.stringify(s)); }, [KEY, save, extra]);
    await p.reload(); await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await W(300);
  };
  // cheap = 小存档也只记位置（平时只有大存档才这样）
  const enter = async cheap => { await defineMaps(); await E(c => { EchoGame.T.RT.walkFull = c ? 0 : null; }, cheap !== false); await p.click('[data-act=wEnter]'); await W(900); };
  // 记下每一次往 localStorage 写了什么（KEY = 整份存档，KEY-pos = 位置记录）
  const hook = () => E(k => {
    if (window.__w) { window.__w.length = 0; return; }
    window.__w = []; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (q, v) { if (q === k || q === k + '-pos') window.__w.push([q === k ? 'full' : 'pos', Math.round(performance.now()), String(v).length]); return set.call(this, q, v); };
  }, KEY);
  const writes = () => E(() => window.__w.slice());
  const hide = on => E(on => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, on);
  const steps = async (key, ms) => { await p.keyboard.down(key); await W(ms); await p.keyboard.up(key); await t.settle(); };

  // ================= 0. 备份的压缩（不用浏览器：把 game.js 里的 lzPack / lzUnpack 取出来，拿随机的东西来回压）=================
  {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'game.js'), 'utf8');
    const { lzPack, lzUnpack } = new Function(src.slice(src.indexOf('const LZ_TAG'), src.indexOf('const bakMeta')) + '\nreturn { lzPack, lzUnpack };')();
    let seed = 20261115; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let x = seed; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const str = (len, alpha, base) => { let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(base + Math.floor(rnd() * alpha)); return s; };
    let bad = 0, packed = 0, n = 0;
    const rt = s => { const pk = lzPack(s); n++; if (pk !== s) packed++; if (lzUnpack(pk) !== s) bad++; return pk; };
    for (let k = 0; k < 250; k++) rt(str(1 + Math.floor(rnd() * 2500), 2 + Math.floor(rnd() * 60), 97).repeat(1 + Math.floor(rnd() * 30)));   // 有重复的短文
    for (let k = 0; k < 6; k++) { const s = str(150000 + k * 9973, 256, 0); rt(s + s.slice(0, 4000)); }   // 几乎压不动的：字典要清空好几次
    for (let k = 0; k < 6; k++) rt(str(40000, 3000, 0x4e00) + '😀🐲'.repeat(500) + str(3000, 26, 97).repeat(20));   // 中文、表情
    rt(''); rt('a'); rt('ab'); rt('a'.repeat(100000));
    check(bad === 0 && packed > 250, '备份的压缩：' + n + ' 份随机内容压了再解开，一字不差（其中 ' + packed + ' 份压小了，压不小的原样放）');
    const big = JSON.stringify(BS.build(1)), pk = lzPack(big);
    let miss = 0;
    for (let k = 0; k < 150; k++) { const i = 30 + Math.floor(rnd() * (pk.length - 30)); const m = k % 2 ? pk.slice(0, i) : pk.slice(0, i) + String.fromCharCode(32 + Math.floor(rnd() * 0x7fff)) + pk.slice(i + 1); if (m !== pk && lzUnpack(m) !== null) miss++; }
    check(pk.length < big.length / 4 && lzUnpack(pk) === big && miss === 0, '玩了 1 年的存档压到 ' + Math.round(pk.length / big.length * 100) + '%；压缩串被截断 / 改了一个字的 150 份全都认得出来（返回 null，不会读出一份错的存档）');
  }

  // ================= 1. 走路只记位置 =================
  // 小存档：和以前一样，每一步都整份存（localStorage 里一直是最新的）
  let a;
  await boot(SMALL()); await enter(false);
  await hook();
  await steps('ArrowRight', 500);
  let w0 = await writes();
  check((await here()) !== 'zs1,4,4' && (await pos()) === (await here()) && w0.filter(x => x[0] === 'full').length >= 2 && !w0.some(x => x[0] === 'pos'), '小存档：照老办法每一步整份存，走完一看存档里就是新位置', w0);
  await boot(SMALL()); await enter();
  check((await here()) === 'zs1,4,4' && (await pos()) === 'zs1,4,4', '进了测试场，存档里是进来的位置');
  await hook();
  await steps('ArrowRight', 700);
  let w = await writes(), at = await here();
  const lastPos = w.filter(x => x[0] === 'pos').pop();
  check(at !== 'zs1,4,4' && w.filter(x => x[0] === 'pos').length >= 3, '走了几步：每一步都往 KEY-pos 写了一条位置记录 ' + at, w);
  check(lastPos && lastPos[2] < 200 && !w.some(x => x[0] === 'full' && x[1] < lastPos[1] + 800), '走路的时候没有整份重写存档（位置记录不到 200 字）', w);
  check(await E(() => { const d = EchoWorld._debug(), w = EchoGame.S.world; return w.x === d.PL.x && w.y === d.PL.y; }), '内存里的存档已经是新位置');
  await W(1500);
  w = await writes();
  check(w.filter(x => x[0] === 'full').length === 1 && (await pos()) === at && (await ls(KEY + '-pos')) === null, '停下来 1 秒：整份存一次，存档里是新位置，位置记录删掉了', w);

  // 开战前先整份存好
  await hook();
  await steps('ArrowLeft', 200);
  at = await here();
  const before = await pos();
  await E(() => { window.__w.length = 0; EchoWorld._debug().battle('wild', { foes: [MonsterGame.newMon('twigling', 3)] }); });
  for (let i = 0; i < 40 && !(await p.isVisible('#battle')); i++) await W(50);
  w = await writes();
  check(before !== at && (await pos()) === at && w.filter(x => x[0] === 'full').length >= 1, '走了一步马上遇怪：战斗一开始就整份存好了 ' + JSON.stringify({ before, at, now: await pos() }));
  await W(600);
  await t.fight(); await W(600);
  check(!(await p.isVisible('#battle')) && (await here()) === at, '打完回到原地');

  // 切到后台 / 页面要关了：整份存好
  await W(1200); await hook();
  await steps('ArrowRight', 200); at = await here();
  await hide(true);
  check((await pos()) === at, '走了一步马上切到后台（visibilitychange → hidden）：整份存好', { at, now: await pos() });
  await hide(false);
  await W(300); await hook();
  await steps('ArrowLeft', 200); at = await here();
  await E(() => window.dispatchEvent(new Event('pagehide')));
  check((await pos()) === at, '走了一步马上关页面（pagehide）：整份存好');
  await steps('ArrowRight', 200); at = await here();
  await E(() => document.dispatchEvent(new Event('freeze')));
  check((await pos()) === at, '走了一步马上被系统冻住（freeze）：整份存好');

  // 回首页（✕、返回键）也先存
  await W(300);
  await steps('ArrowLeft', 200); at = await here();
  check(await E(() => window.EchoBack()) === true && await p.isVisible('#home') && (await pos()) === at, '走了一步马上按返回键回首页：整份存好');
  check(await E(() => window.EchoBack()) === false, '已经在首页再按返回键：交给 APK 退到后台');

  // 换地图：当场整份存
  await enter(); await t.tp(7, 2, 'up'); await hook();
  await p.keyboard.down('ArrowUp'); await W(120); await p.keyboard.up('ArrowUp');
  for (let i = 0; i < 30 && (await t.dbg()).map !== 'zs2'; i++) await W(100);
  await W(200);
  check((await t.dbg()).map === 'zs2' && /^zs2,/.test(await pos()), '进了洞口：存档里马上是新地图', await pos());

  // 没来得及整份存就被关掉（杀进程）：下次打开还在走到的地方
  await W(1300);
  await steps('ArrowRight', 400); at = await here();
  const snap = await E(k => ({ full: localStorage.getItem(k), pos: localStorage.getItem(k + '-pos') }), KEY);   // 这一刻 localStorage 里的样子
  check(!!snap.pos && JSON.parse(snap.full).world.x !== (await t.dbg()).x, '这时候存档里还是原来的位置，新位置只在位置记录里', snap.pos);
  await W(1400);
  await E(([k, s]) => { localStorage.setItem(k, s.full); localStorage.setItem(k + '-pos', s.pos); }, [KEY, snap]);   // 回到被杀掉那一刻
  await p.reload(); await W(500);
  check(await E(at => { const w = EchoGame.S.world; return w.map + ',' + w.x + ',' + w.y === at; }, at), '重新打开：位置是被关掉前走到的地方 ' + at);
  a = await E(() => ({ repel: EchoGame.S.world.repel, walk: EchoGame.S.mon.walk | 0 }));
  check(a.repel < JSON.parse(snap.full).world.repel && a.walk > (JSON.parse(snap.full).mon.walk | 0), '走路攒的数也跟上了（喷雾还剩几步、一共走了几步）', a);
  await enter();
  check((await here()) === at && (await pos()) === at && (await ls(KEY + '-pos')) === null, '进大地图就站在那里，存档也跟上了');

  // 存档被换过：旧的位置记录不能用到新存档上
  await W(1200);
  await steps('ArrowLeft', 200);
  const stale = await ls(KEY + '-pos');
  await E(([k, s, ps]) => { localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem(k + '-pos', ps); }, [KEY, SMALL({ world: Object.assign(SMALL().world, { x: 9, y: 3 }) }), stale]);
  await p.reload(); await W(500);
  check(!!stale && await E(() => EchoGame.S.world.x === 9 && EchoGame.S.world.y === 3) && (await ls(KEY + '-pos')) === null, '换了一份存档：按新存档的位置来，旧的位置记录扔掉');
  // 走了路、还没整份存的时候，外面改了 localStorage 里的存档：停下来那一下不去盖它
  await enter();
  await steps('ArrowLeft', 200);
  await E(k => { const s = JSON.parse(localStorage.getItem(k)); s.coins = 4321; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await W(1500);
  check(await E(k => JSON.parse(localStorage.getItem(k)).coins === 4321, KEY), '走路攒着没存的时候外面改了存档：顺手存的那一下不盖别人刚写的');
  check(await E(() => { EchoGame.flush(); return JSON.parse(localStorage.getItem('echo-island-v1')).coins; }) === 500, 'EchoGame.flush()：现在就整份存（测试直接读 localStorage 前用）');

  // ================= 2. 大存档 =================
  const BIG = BS.build(3, { gfx: '2d' });
  BIG.settings.pin = '1234';
  const mastered0 = Object.values(BIG.rev.items).filter(e => !e.due).length, free0 = Object.values(BIG.rev.items).filter(e => e.k === 'free' && !e.due).length;
  const BIGTXT = JSON.stringify(BIG);
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const t0 = Date.now();
  // 昨天的存档、昨天轮换过的备份（一份没压过的老备份）
  await boot(BIGTXT, { [KEY + '-bakmeta']: JSON.stringify({ day: yesterday, d1: '2026-11-01' }), [KEY + '-bak1']: BIGTXT });
  const bootMs = Date.now() - t0;
  a = await E(() => { const S = EchoGame.S, it = Object.values(S.rev.items); return { rev: it.length, open: it.filter(e => e.due).length, freeDone: it.filter(e => e.k === 'free' && !e.due).length, gone: S.rev.gone, box: S.mon.box.length, log: S.talk.log.length, weekly: S.weekly.length, home: !document.querySelector('#home').hidden }; });
  check(a.home && a.box === 246 && a.open === 3000 && a.log === 40 && a.weekly > 150, '玩了 3 年的大存档（' + BIGTXT.length + ' 字）打得开：' + bootMs + 'ms', a);
  check(free0 > 250 && a.freeDone === 200 && a.gone === free0 - 200, '掌握了的聊天句子只留最近 200 条（原来 ' + free0 + ' 条），删掉的记了数', a);
  await E(() => EchoGame.reportSheet()); await W(300);
  const rep = await p.textContent('#sheet');
  check(new RegExp('掌握[^0-9]{0,12}' + mastered0).test(rep.replace(/\s+/g, '')) || rep.includes(String(mastered0)), '周报的「累计掌握」没有少（' + mastered0 + '）', rep.slice(0, 300));
  await E(() => EchoGame.closeModal());
  // 大存档不用开关：走路自己就只记位置
  await p.click('[data-act=wEnter]'); await W(1200); await t.idle();
  await E(() => {   // 站到这张地图上最长的一段横路中间
    const d = EchoWorld._debug(), M = d.M, ok = (x, y) => { const c = M.grid[y] && M.grid[y][x]; return !!c && EchoMaps.WALK.includes(c) && c !== 'L' && !M.npcs.some(n => n.x === x && n.y === y) && !M.warps.some(q => q.x === x && q.y === y) && !(M.picks || []).some(q => q.x === x && q.y === y); };
    let best = null;
    for (let y = 0; y < M.grid.length; y++) for (let x = 0, s = -1; x <= M.grid[y].length; x++) { if (ok(x, y)) { if (s < 0) s = x; } else { if (s >= 0 && (!best || x - s > best.n)) best = { y, a: s, n: x - s }; s = -1; } }
    const x = best.a + Math.floor(best.n / 2);
    d.PL.x = d.PL.fx = d.FL.x = d.FL.fx = x; d.PL.y = d.PL.fy = d.FL.y = d.FL.fy = best.y; d.PL.moving = false;
  });
  await W(1200); await hook();
  const ms0 = await E(() => { const a = performance.now(); EchoGame.A.save(); return performance.now() - a; });
  await hook();
  const tw = Date.now();
  await steps('ArrowRight', 600);
  w = await writes();
  const lp = w.filter(x => x[0] === 'pos').pop();
  check(w.filter(x => x[0] === 'pos').length >= 2 && lp[2] < 200 && !w.some(x => x[0] === 'full' && x[1] < lp[1] + 800), '大存档（整份存一次 ' + Math.round(ms0) + 'ms）：走路只写位置记录，不整份存', w.slice(0, 8));
  await W(Math.max(0, 1500 - (Date.now() - tw - 600)));
  w = await writes();
  check(w.filter(x => x[0] === 'full').length === 1 && (await pos()) === (await here()), '停下来 1 秒：整份存一次', w.slice(-3));
  await E(() => EchoGame.goHome('mon')); await W(300);

  // ================= 3. 备份压着存 =================
  await E(() => EchoGame.A.save());   // 今天第一次保存
  a = await E(k => { const g = q => localStorage.getItem(q) || ''; return { b1: g(k + '-bak1').slice(0, 4), b1n: g(k + '-bak1').length, b2: g(k + '-bak2').slice(0, 4), b2n: g(k + '-bak2').length, main: g(k).length, same1: EchoGame.A.bakGet(k + '-bak1').length, meta: EchoGame.A.bakMeta(), use: EchoGame.A.usage() }; }, KEY);
  check(a.b1 === 'LZ1:' && a.b1n < BIGTXT.length / 4 && a.same1 === BIGTXT.length, '今天第一次保存：昨天的存档压着放进备份 1（' + a.b1n + ' 字，原来 ' + BIGTXT.length + '）', a);
  check(a.b2 === 'LZ1:' && a.b2n < BIGTXT.length / 4 && a.meta.d1 === yesterday && a.meta.d2 === '2026-11-01', '原来没压过的老备份挪到备份 2 时也压了', a);
  check(a.use < BS.QUOTA * .4, '存档 + 两份备份一共 ' + a.use + ' 字，占配额 ' + Math.round(a.use / BS.QUOTA * 100) + '%（不压要 ' + Math.round(BIGTXT.length * 3 / BS.QUOTA * 100) + '%）');
  check(await E(([k, txt]) => EchoGame.A.bakGet(k + '-bak2') === txt && EchoGame.A.unpack(EchoGame.A.pack(txt)) === txt, [KEY, BIGTXT]), '压过的备份解开和原文一字不差');
  check(await E(() => { const A = EchoGame.A; return A.unpack('{"a":1}') === '{"a":1}' && A.unpack('LZ1:zz:zz:0:') === null && A.unpack(A.pack('x'.repeat(30000)).slice(0, 40)) === null && A.pack('😀' + String.fromCharCode(0xD800) + 'y'.repeat(30000)).slice(0, 4) !== 'LZ1:'; }), '没压过的原样读；坏掉 / 截断的压缩串读不出来（返回 null）；压不了的原样放');

  // 大存档坏了：用压过的备份接着玩，坏的那份另存（也压着）
  const BROKEN = BIGTXT.slice(0, BIGTXT.length - 3000);
  await E(([k, b]) => localStorage.setItem(k, b), [KEY, BROKEN]);
  await p.reload(); await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden);
  for (let i = 0; i < 20 && !(await p.$('#sheet .big')); i++) await W(150);
  a = await E(([k, b]) => ({ sheet: document.querySelector('#sheet').textContent, box: EchoGame.S.mon.box.length, bad: EchoGame.A.unpack(localStorage.getItem(k + '-bad')) === b, badn: localStorage.getItem(k + '-bad').length, main: (localStorage.getItem(k) || '').length, metaBad: EchoGame.A.bakMeta().bad }), [KEY, BROKEN]);
  check(/存档读不出来了/.test(a.sheet) && a.box === 246 && a.main > 900000, '大存档坏了：用压过的备份恢复，接着玩', { sheet: a.sheet.slice(0, 80), box: a.box, main: a.main });
  check(a.bad && a.badn < BROKEN.length / 4 && !!a.metaBad, '坏的那份另存着（压过，解开和坏档一字不差），记了是哪天坏的', { bad: a.bad, n: a.badn });
  await p.click('#sheet [data-act=restoredOk]'); await W(200);

  // 「从备份恢复」：选一份压过的备份
  await E(() => { EchoGame.S.coins = 77; EchoGame.A.save(); EchoGame.A.settings(); }); await W(200);
  await E(() => document.querySelector('#sheet [data-act=bakRestore]').click()); await W(200);
  for (const d of '1234') await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]');
  await W(400);
  a = await E(() => [...document.querySelectorAll('#sheet [data-act=bakUse]')].map(x => x.dataset.src + x.dataset.k + ':' + x.textContent));
  check(a.filter(x => /^l/.test(x) && /🐾 246/.test(x)).length >= 2, '「从备份恢复」列出压过的备份（读得出是谁的、几只怪兽）', a);
  await p.click('#sheet [data-act=bakUse][data-src=l][data-k="1"]'); await W(200);
  await p.click('#sheet [data-act=bakGo]');
  await W(600); await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await W(600);
  a = await E(k => ({ coins: EchoGame.S.coins, box: EchoGame.S.mon.box.length, pre: (localStorage.getItem(k + '-pre') || '').slice(0, 4), preCoins: (JSON.parse(EchoGame.A.bakGet(k + '-pre') || '{}')).coins, restore: EchoGame.dayLog().restore, main: (localStorage.getItem(k) || '')[0] }), KEY);
  check(a.coins === BIG.coins && a.box === 246 && a.restore === 1 && a.main === '{', '恢复好了：重新打开就是备份的进度，存档本身还是原样的 JSON', a);
  check(a.pre === 'LZ1:' && a.preCoins === 77, '恢复前的进度另存着（压过，读得回来）', a);

  // ================= 4. 存档空间 =================
  a = await E(() => { const A = EchoGame.A, RT = EchoGame.T.RT; const s0 = A.storeCheck(); RT.lsQuota = Math.round(A.usage() / .85); const s1 = A.storeCheck(); return { s0, s1, bar: (document.querySelector('#home-bars [data-act=storeInfo]') || {}).textContent, errs: EchoErr.list().filter(x => /存档空间快满了/.test(x.m)).length }; });
  check(a.s0 && !a.s0.warn && a.s0.pct < 40, '平时：存档空间用了 ' + a.s0.pct + '%，不提示', a.s0);
  check(a.s1.warn && a.s1.pct >= 80 && /存档空间快满了（已用 8\d%）/.test(a.bar || '') && a.errs === 1, '用到 80% 以上（把配额改小来试）：首页挂一条「存档空间快满了」，出错记录里记一笔', a);
  await p.click('#home-bars [data-act=storeInfo]'); await W(200);
  a = await p.textContent('#sheet');
  check(/存档空间快满了/.test(a) && /导出存档/.test(a) && /现在还能正常存/.test(a) && !!(await p.$('#sheet [data-act=parentSet]')), '点开：现在还能存、请家长导出存档、能直接去家长设置', a.slice(0, 120));
  await p.click('#sheet [data-act=parentSet]'); await W(300);
  check(/存档空间已用 \d+%/.test(await p.textContent('#sheet')), '家长设置「存档备份」里写着用了百分之几');
  await E(() => EchoGame.closeModal());
  a = await E(k => { const A = EchoGame.A, RT = EchoGame.T.RT, has = q => !!localStorage.getItem(k + q); const b = { b1: has('-bak1'), b2: has('-bak2'), bad: has('-bad') }; RT.lsQuota = Math.round(A.usage() / .95); const s = A.storeCheck(); return { b, s, a: { b1: has('-bak1'), b2: has('-bak2'), b3: has('-bak3'), bad: has('-bad'), pre: has('-pre') } }; }, KEY);
  check(a.b.b1 && a.b.b2 && a.b.bad && a.a.b1 && !a.a.b2 && !a.a.b3 && !a.a.bad && a.a.pre, '用到 90% 以上：最老的两份备份和坏档删掉，最近一份备份和「恢复前」那份留着', a);
  await E(() => { EchoGame.T.RT.lsQuota = 0; EchoGame.A.storeCheck(); });
  check(!(await p.$('#home-bars [data-act=storeInfo]')), '空间够了：那一条收起来');
  // 真的存不进去：弹一次「存档存不进去了」（原来就有的）
  await E(k => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (q, v) { if (q === k) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, q, v); }; EchoGame.S.coins = 1; EchoGame.A.save(); }, KEY);
  await W(300);
  check(/存档存不进去了/.test(await p.textContent('#sheet')) && await E(k => JSON.parse(localStorage.getItem(k)).coins !== 1, KEY), '真的存不进去：弹窗「存档存不进去了」，请家长导出');
  await E(() => EchoGame.closeModal());

  await t.done();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
