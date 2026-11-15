// 今日目击（sighting.js，2026-11-15 家长批准的玩法）：博士的告示板每天一条英文线索，读懂了去对的地图、对的地形才遇得到稀有怪兽。
// 0. 不开浏览器：能当目击地点的地图（没有小镇 / 室内 / 冠军赛的路 / 剧情的地方）、那种地形从入口走得到、能提前配音的句子
// 1. 目标怎么定：同一天同一份存档 → 同一个；60 天模拟（刚过第一条路 / 玩到一半 / 打通了）天天换、不出去得了的地图；
//    每一个可能的目标的三条线索都是真的（对着地图和怪兽数据查）；两个版本；销售版没有保留的怪兽；不出神兽
// 2. 首页卡片、冒险菜单里的告示板（竖屏、横屏截图）；「译」和剧情中文同一个设置、点一次记一次；🔊
// 3. 大地图：不对的地图 / 地形走很多步不出来；对的地图进去有提示、对的地形里第 4–8 步出来（不是第一步）、顶上写着今日目击；
//    逃跑 → 见过了、再走一阵还会出来；收服 → 今天结束、金币、累计和连续天数、成就；悄悄喷雾有效时不出来；传说怪兽在场时不抢戏；
//    洞穴地面 / 海面 / 海底的海草也各走一遍；第二天换新的、没收服的就走了；老存档没有新字段；大存档走路不整份存
// 运行：node tests/sighting.test.js（大约 2 分钟）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./helpers');
const ROOT = path.join(__dirname, '..');
const KEY = 'echo-island-v1';
let fails0 = 0;
const check0 = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails0++; return ok; };

// ================= 0. 不开浏览器 =================
function loadData(edition) {
  const ctx = { window: { ECHO_EDITION: edition }, console, setTimeout, clearTimeout };
  vm.createContext(ctx);
  ['dex.js', 'maps.js', 'people.js', 'story.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  [...html.matchAll(/<script src="(isles\/[^"]+)"/g)].forEach(m => vm.runInContext(fs.readFileSync(path.join(ROOT, m[1]), 'utf8'), ctx, { filename: m[1] }));
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sighting.js'), 'utf8'), ctx, { filename: 'sighting.js' });
  return ctx.window;
}
{
  const Wn = loadData('family'), SG = Wn.EchoSight, EM = Wn.EchoMaps;
  const ids = EM.all(), spots = ids.filter(id => SG.terrainOf(EM.get(id)));
  check0(spots.length >= 20 && spots.every(id => ['route', 'cave', 'under'].includes(EM.get(id).kind)), '能当目击地点的地图 ' + spots.length + ' 张，都是道路 / 洞穴 / 海路 / 海底：' + spots.join(' '));
  const never = ids.filter(id => { const m = EM.get(id); return m.kind === 'town' || m.kind === 'inside' || /^(v\d|vL|h8|d12)/.test(id); });
  check0(never.length > 80 && never.every(id => !SG.terrainOf(EM.get(id))) && !SG.terrainOf(EM.get('t5')) && !SG.terrainOf(EM.get('v1')) && !SG.terrainOf(EM.get('d12a')),
    '小镇（有草丛的也不算）、室内、挑战馆、勇气之路和冠军高原、嘘声团基地、回忆神殿都不当目击地点（' + never.length + ' 张）');
  // 那种地形从入口走得到（不用回声技能；海面和海底本来就要水路）
  const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const flood = (m, from, surf) => {
    const t = (x, y) => (m.grid[y] && m.grid[y][x]) || '#';
    const block = new Set(m.npcs.filter(n => n.role !== 'trainer' && !n.showIf && !n.hideIf).map(n => n.x + ',' + n.y));
    const ok = (x, y, dy) => { const c = t(x, y); if (block.has(x + ',' + y)) return false; if (EM.WALK.includes(c)) return true; return !!surf && ('~D'.includes(c) || (c === 'w' && dy > 0)); };
    const seen = new Set([from.x + ',' + from.y]), q = [[from.x, from.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        let nx = x + dx, ny = y + dy;
        if (t(nx, ny) === 'L') { if (dy !== 1) continue; ny += 1; }
        if (!ok(nx, ny, dy)) continue;
        while (t(nx, ny) === 'I' && ok(nx + dx, ny + dy, dy)) { nx += dx; ny += dy; }
        if (!seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); }
      }
    }
    return seen;
  };
  const few = [];
  spots.forEach(id => {
    const m = EM.get(id), ter = SG.terrainOf(m), want = { grass: ',', cave: ':', sea: '~D', weed: ',' }[ter], surf = ter === 'sea';
    const best = Math.max(...m.groups.map(g => { const p = EM.arrival(m, 'from:' + g.to + '@' + g.k); let n = 0; flood(m, p, surf || !!p.surf).forEach(k => { const [x, y] = k.split(',').map(Number); if (want.includes(m.grid[y][x])) n++; }); return n; }));
    if (best < 12) few.push(id + ':' + best);
  });
  check0(!few.length, '每个目击地点：那种地形从入口走得到 12 格以上' + (few.length ? '，不够的：' + few.join(' ') : ''));
  // 能提前配音的句子：两个版本都拼得出来，都是纯英文短句
  const lines = new Set(SG.lines().concat(loadData('sales').EchoSight.lines()));
  const odd = [...lines].filter(s => /[^\x20-\x7e]/.test(s) || s.length > 130 || !/^It /.test(s) || !/[.!]$/.test(s));
  check0(lines.size > 100 && lines.size < 400 && !odd.length, '线索模板一共能拼出 ' + lines.size + ' 句（给 tools/voice/collect.js 提前配音），都是纯英文短句' + (odd.length ? '；不对的：' + odd.slice(0, 3).join(' | ') : ''));
  const src = fs.readFileSync(path.join(ROOT, 'sighting.js'), 'utf8');
  check0(!/\bE\.save\(\)/.test(src.slice(src.indexOf('function onStep'), src.indexOf('function ended'))) && !/E\.save\(\)/.test(src.slice(src.indexOf('function roll'), src.indexOf('// ---------- 三条线索'))),
    '每走一步、每天定目标都不调整份存档的 save()（跟着 world.js 的 savePos 存）');
}

// ================= 浏览器里用的小工具（每次重新打开页面都装上） =================
const PAGE_TOOLS = () => {
  window.__rnd = Math.random;
  const hsl = hex => { const m = /^#?(..)(..)(..)$/.exec(hex), r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l]; };
  window.__SGT = {
    next(d) { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); },
    today() { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); },
    // 一个目标合不合规矩、三条线索是不是真的（这里另写一遍判断，不用 sighting.js 自己的表）；返回问题列表
    verify(t) {
      const bad = [], EM = EchoMaps, D = DEX, m = EM.get(t.map), sp = D.byId[t.sp], say = x => bad.push(t.map + '/' + t.sp + '：' + x);
      if (!m) { say('地图不存在'); return bad; }
      if (!['route', 'cave', 'under'].includes(m.kind) || /^(v\d|vL|h8|d12|t\d|i\d)/.test(m.id)) say('不该当目击地点 ' + m.kind);
      const flat = m.grid.map(r => r.join('')).join(''), sea = !!(m.def && m.def.sea);
      if (!flat.includes({ grass: ',', cave: ':', sea: '~', weed: ',' }[t.hab] || '?')) say('地图上没有这种地形 ' + t.hab);
      if ((t.hab === 'weed') !== (m.kind === 'under') || (t.hab === 'cave') !== (m.kind === 'cave') || (t.hab === 'sea') !== sea) say('地形和地图对不上 ' + t.hab + ' / ' + m.kind);
      if (!sp) { say('怪兽不存在'); return bad; }
      if (!D.list.includes(sp)) say('不在这个版本的手册里');
      if (sp.legend || sp.starter || sp.reserved || D.reserved(sp.id)) say('神兽 / 初始伙伴 / 保留的');
      if (!D.isBase(sp) || sp.r !== 1) say('不是第一大区的第一阶');
      const lv0 = MonsterGame.zoneLv(m.z) + (m.lvBonus || 0);
      if (!(t.lv >= lv0 + 1 && t.lv <= lv0 + 2)) say('等级 ' + t.lv + ' 和这张地图（' + lv0 + '–' + (lv0 + 2) + '）不一致');
      if (MonsterGame.wildTable(m.z, t.hab === 'grass' || t.hab === 'cave' ? t.hab : 'water').some(s => s.id === sp.id) && sp.rarity < 3) say('平时在这里就常见');
      const c = EchoSight.clues(t);
      if (c.length !== 3) { say('线索不是三条'); return bad; }
      const town = EM.get('t' + m.isle), isleName = [WORLDS[m.isle].name, (town.en || '').replace(/ (Island|City)$/, '')];
      c.forEach((x, i) => {
        if (!x.en || !x.zh || /[一-鿿]/.test(x.en) || !/[一-鿿]/.test(x.zh)) say('线索 ' + (i + 1) + ' 中英文不全');
        if ((m.name && x.zh.includes(m.name)) || (m.en && x.en.includes(m.en)) || x.en.includes(sp.en) || x.zh.includes(sp.zh) || x.zh.includes(isleName[0]) || (isleName[1] && x.en.includes(isleName[1] + ' Island'))) say('线索 ' + (i + 1) + ' 直接说出了名字：' + x.en);
      });
      // ① 哪座岛：小镇的树和房子（maps.js 的 THEMES），或者这座岛的话题单词（data.js）
      const th = EM.THEMES[EM.themeOf(m.isle)], e1 = c[0].en.toLowerCase();
      const TREE = { palm: 'palm', pencil: 'pencil', autumn: 'autumn', round: 'round', cypress: 'thin', pine: 'pine', lolli: 'lollipop', jungle: 'jungle', orchard: 'fruit', snowpine: 'snow', dead: 'no leaves' };
      const HOUSE = { med: 'red roofs', crayon: 'bright colours', farm: 'farm', brick: 'brick', dome: 'glass', tent: 'tents', tower: 'towers', cake: 'cakes', hut: 'tree houses', city: 'tall buildings', market: 'shops', chalet: 'snow on the roofs', temple: 'temples' };
      if (town.theme !== EM.themeOf(m.isle)) say('岛上小镇的风格和这座岛的不一样');
      if (c[0].k === 'look') { if (!e1.includes(TREE[th.tree]) || !e1.includes(HOUSE[th.house])) say('① 树 / 房子说得不对：' + c[0].en); }
      else if (c[0].k === 'topic') { if (WORLDS[m.isle].words.filter(w => e1.includes(w[0].toLowerCase())).length < 2) say('① 没用上这座岛的话题单词：' + c[0].en); }
      else say('① 没说是哪座岛');
      // ② 什么样的地方、从这座岛的小镇怎么走
      const e2 = c[1].en, s2 = e2.split('. ')[0], direct = town.groups.filter(g => g.to === m.id), DW = { '^': 'north', v: 'south', '<': 'west', '>': 'east' }, md = /Go (north|south|east|west) from the town\./.exec(e2);
      if (/under the sea/.test(s2) !== (m.kind === 'under') || /out at sea/.test(s2) !== sea || /cave|tunnel/.test(s2) !== (m.kind === 'cave')) say('② 地方的种类不对：' + e2);
      if (/dark/.test(s2) && !m.dark) say('② 说黑其实不黑');
      if (md) { if (!direct.some(g => DW[g.via] === md[1])) say('② 方向不对：' + e2); }
      else if (/The way in is in the town/.test(e2)) { if (!direct.some(g => !DW[g.via])) say('② 入口不在小镇里：' + e2); }
      else if (/dive down/.test(e2)) { if (m.kind !== 'under') say('② 不用潜下去：' + e2); }
      else if (/far from the town/.test(e2)) {
        if (direct.length) say('② 明明紧挨着小镇：' + e2);
        const nb = m.groups.map(g => EM.get(g.to)).filter(Boolean), f = e2.split('. ')[2] || '';
        if (/cave|tunnel/.test(f) && !nb.some(n => n.kind === 'cave')) say('② 旁边没有山洞：' + e2);
        if (/woods/.test(f) && !nb.some(n => /Woods/.test(n.en || ''))) say('② 旁边没有树林：' + e2);
        if (/mountain/.test(f) && !nb.some(n => /Mountain|Summit/.test(n.en || ''))) say('② 旁边没有山：' + e2);
        if (/cliff/.test(f) && !nb.some(n => /Cliff/.test(n.en || ''))) say('② 旁边没有悬崖：' + e2);
      } else say('② 没说怎么走：' + e2);
      // ③ 地形 + 怪兽的一样特点
      const e3 = c[2].en, TW = { grass: /tall grass/, cave: /hides in the cave/, sea: /on top of the water/, weed: /seaweed/ };
      Object.keys(TW).forEach(k => { if (TW[k].test(e3) !== (k === t.hab)) say('③ 地形说得不对：' + e3); });
      const BW = { quad: 'four legs', biped: 'two legs', bird: 'bird', fish: 'fish', serpent: 'snake', bug: 'bug', blob: 'ball', ghost: 'ghost', shell: 'shell', plant: 'plant', golem: 'giant', dragon: 'dragon' };
      const tr = c[2].trait, sz = sp.sz == null ? 1 : sp.sz;
      if (tr === 'type') { if (!e3.includes(' ' + D.TYPES[sp.types[0]].en + ' monster.') || !c[2].zh.includes(D.TYPES[sp.types[0]].zh + '系')) say('③ 属性不对：' + e3); }
      else if (tr === 'body') { if (!BW[sp.b] || !e3.includes(BW[sp.b])) say('③ 样子不对：' + e3 + '（' + sp.b + '）'); }
      else if (tr === 'size') { if (!(/very small/.test(e3) ? sz <= .8 : /is big/.test(e3) && sz >= 1.2)) say('③ 大小不对：' + e3 + '（' + sz + '）'); }
      else if (tr === 'colour') {
        const [h, s, l] = hsl(sp.c), col = c[2].v;
        const ok = { red: (h < 20 || h > 340) && s > .3, orange: h > 10 && h < 50 && s > .3, yellow: h > 40 && h < 70 && s > .3, green: h > 70 && h < 170 && s > .3, blue: h > 180 && h < 260 && s > .3, purple: h > 255 && h < 300 && s > .3,
          pink: ((h > 295 && h < 350) || ((h > 340 || h < 15) && l > .65)) && s > .3, brown: h > 5 && h < 50 && l < .5, white: l > .88, black: l < .2, grey: s < .15 }[col];
        if (t.shiny || !ok || !e3.includes('It is ' + col + '.')) say('③ 颜色不对：' + e3 + '（' + sp.c + (t.shiny ? '，稀有色' : '') + '）');
      } else say('③ 没说怪兽的特点');
      return bad;
    },
    // 从 start 起模拟 days 天：每天定目标（每三天收服一次），返回每天的目标和问题
    sim(S0, start, days) {
      const S = JSON.parse(JSON.stringify(S0)), out = [], bad = [];
      let d = start;
      for (let i = 0; i < days; i++) {
        const again = JSON.stringify(EchoSight.pick(S, d)) === JSON.stringify(EchoSight.pick(JSON.parse(JSON.stringify(S)), d));
        const sg = EchoSight.roll(S, d), t = { day: d, map: sg.map, hab: sg.hab, sp: sg.sp, lv: sg.lv, shiny: sg.shiny, cv: sg.cv.slice(), need: sg.need };
        if (!again) bad.push(d + ' 同一天同一份存档算出来不一样');
        if (!sg.map) bad.push(d + ' 没有目标');
        else {
          if (!EchoSight.reach(S).includes(sg.map)) bad.push(d + ' ' + sg.map + ' 不在去得了的地图里');
          if (!(sg.need >= 4 && sg.need <= 8)) bad.push(d + ' 步数 ' + sg.need);
          window.__SGT.verify(t).forEach(x => bad.push(d + ' ' + x));
          if (i % 3 === 0) S.mon.dex[sg.sp] = 'caught';
        }
        out.push(t);
        d = window.__SGT.next(d);
      }
      return { out, bad, reach: EchoSight.reach(S0) };
    },
  };
};

(async () => {
  const t = await H.open();
  const { p, W, check } = t;
  await p.addInitScript(PAGE_TOOLS);
  await p.reload(); await p.waitForFunction(() => window.__SGT);
  // sighting.js 给大地图的几个钩子出了错只往控制台记一笔（不让走路跟着坏）：这里收着，最后查一遍
  const cerr = [];
  p.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  const E = (f, a) => p.evaluate(f, a);
  const all = n => { const o = {}; for (let i = 0; i < n; i++) o[i] = 1; return o; };
  const SAVE = o => {
    o = o || {};
    const team = o.team || [['tidalfin', 30], ['cindercat', 30]];
    return {
      seenIntro: true, coins: 500, settings: Object.assign({ tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off' }, o.settings), player: { gender: 'girl', name: o.name || 'Coco' },
      mon: { v: 2, box: team.map(([sp, lv], i) => ({ uid: 'u' + i, sp, lv, xp: 0 })), team: team.map((_, i) => 'u' + i), dex: o.dex || {}, balls: 20, potions: 10, bag: o.bag || {}, badges: o.badges || {} },
      world: Object.assign({ v: 3, started: true, map: o.map || 't0', x: -1, y: -1, dir: 'up', arrive: 'door:C', visited: o.visited || { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} }, o.world),
    };
  };
  // 换一份存档重新打开（停在首页）；extra = 另外要放的键（比如销售版）
  const boot = async (save, extra) => {
    await E(([k, s, x]) => { Object.keys(localStorage).filter(q => q.startsWith(k) || q === 'echo-edition').forEach(q => localStorage.removeItem(q)); Object.entries(x || {}).forEach(([q, v]) => localStorage.setItem(q, v)); localStorage.setItem(k, JSON.stringify(s)); }, [KEY, save, extra]);
    await p.reload(); await p.waitForFunction(() => window.EchoGame && window.EchoSight && window.__SGT); await W(400);
  };
  const st = () => E(() => { const s = EchoSight.state(); return { st: s.st, sg: JSON.parse(JSON.stringify(s.sg || null)), clues: s.clues, total: s.total, streak: s.streak, sp: s.sp && s.sp.en }; });
  const sight = () => E(() => JSON.parse(JSON.stringify(EchoGame.S.world.sight)));
  const setSight = o => E(o => { Object.assign(EchoGame.S.world.sight, o); }, o);
  const toasts = () => E(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join(' | '));
  const TODAY = await E(() => window.__SGT.today());

  // ================= 1. 目标怎么定 =================
  const BEEN_MID = { r0: 1, r0b: 1, c0: 1, f1: 1, r1: 1, r1w: 1, r2: 1, r2e: 1, c3: 1, r3: 1, r4: 1, r5: 1 };
  const SV = {
    a: SAVE({ visited: { 0: 1 }, world: { been: { r0: 1 } } }),                                                      // 刚过第一条路
    b: SAVE({ visited: all(6), badges: all(5), bag: { hm_cut: 1, hm_smash: 1, hm_flash: 1 }, world: { been: BEEN_MID } }),   // 玩到一半（第 6 岛）
    c: SAVE({ visited: all(13), badges: all(13), bag: { hm_cut: 1, hm_smash: 1, hm_strength: 1, hm_surf: 1, hm_dive: 1, hm_falls: 1, hm_fly: 1 } }),   // 打通了（been 进页面以后填）
  };
  const simAll = async label => {
    const spots = await E(() => EchoMaps.all().filter(id => EchoSight.terrainOf(EchoMaps.get(id))));
    SV.c.world.been = {}; spots.forEach(id => { SV.c.world.been[id] = 1; });
    for (const [k, name] of [['a', '刚过第一条路'], ['b', '玩到一半'], ['c', '打通了']]) {
      const r = await E(([S, d]) => window.__SGT.sim(S, d, 60), [SV[k], '2026-11-15']);
      const maps = new Set(r.out.map(x => x.map)), mons = new Set(r.out.map(x => x.sp));
      const rep = r.out.filter((x, i) => i && ((r.reach.length > 1 && x.map === r.out[i - 1].map) || x.sp === r.out[i - 1].sp)).length;
      check(!r.bad.length, label + ' · ' + name + '：60 天每天的目标都合规矩、三条线索都是真的、同一天算两遍一样' + (r.bad.length ? '：' + r.bad.slice(0, 4).join('；') : ''));
      check(mons.size >= (k === 'a' ? 15 : 25) && maps.size >= Math.min(r.reach.length, k === 'a' ? 1 : 8) && rep === 0 && [...maps].every(id => r.reach.includes(id)),
        label + ' · ' + name + '：60 天换了 ' + mons.size + ' 种怪兽、' + maps.size + ' 张地图（去得了的 ' + r.reach.length + ' 张），没有连着两天一样的');
      if (k === 'b') check(!r.reach.some(id => /^(s|u)\d/.test(id)) && r.reach.length === Object.keys(BEEN_MID).length, '没有水路的时候不会让孩子去海上、海底：' + r.reach.join(' '));
      if (k === 'c') check(r.reach.length === spots.length && r.reach.some(id => /^u\d/.test(id)) && r.reach.some(id => /^s\d/.test(id)), '打通了：' + r.reach.length + ' 个目击地点全都可能（包括海路和海底）');
    }
    // 每一个可能的目标（每张地图 × 每只候选 × 每种说法 × 稀有色）都查一遍
    const full = await E(() => {
      const S = { player: { name: 'x' }, mon: { box: [{ uid: 'u' }], dex: {}, bag: {}, badges: {} }, world: {} }, bad = [];
      let n = 0, pool = 0;
      const mons = new Set();
      EchoMaps.all().forEach(id => {
        const m = EchoMaps.get(id), hab = EchoSight.terrainOf(m);
        if (!hab) return;
        const cs = EchoSight.cands(m, S);
        if (cs.length < 8) bad.push(id + ' 候选只有 ' + cs.length + ' 只');
        pool += cs.length;
        cs.forEach(sp => { mons.add(sp.id); [0, 1].forEach(a => [0, 1, 2, 3].forEach(b => [false, true].forEach(shiny => { n++; window.__SGT.verify({ map: id, hab, sp: sp.id, lv: MonsterGame.zoneLv(m.z) + (m.lvBonus || 0) + 1, shiny, cv: [a, b] }).forEach(x => bad.push(x)); }))); });
      });
      return { n, pool, mons: mons.size, bad: [...new Set(bad)], sales: DEX.sales, reserved: [...mons].filter(id => DEX.reserved(id)), legends: [...mons].filter(id => DEX.byId[id].legend), list: DEX.list.length };
    });
    check(!full.bad.length && full.n > 3000, label + '：每张地图 × 每只候选 × 每种说法一共 ' + full.n + ' 组线索，全是真的（' + full.mons + ' 种怪兽会被目击）' + (full.bad.length ? '：' + full.bad.slice(0, 5).join('；') : ''));
    check(!full.reserved.length && !full.legends.length, label + '：候选里没有保留的怪兽、没有神兽（手册 ' + full.list + ' 只）');
    return full;
  };
  await boot(SV.a);
  check(await E(() => !DEX.sales), '家庭版');
  await simAll('家庭版');
  // 存档不一样（名字不一样）→ 目标不一样；同一份存档、不同的日子 → 不一样；稀有色大约 1/8
  const mix = await E(([S, d]) => {
    const S2 = JSON.parse(JSON.stringify(S)); S2.player.name = 'Tom';
    const a = window.__SGT.sim(S, d, 300).out, b = window.__SGT.sim(S2, d, 300).out;
    return { same: a.filter((x, i) => x.map === b[i].map && x.sp === b[i].sp).length, shiny: a.filter(x => x.shiny).length + b.filter(x => x.shiny).length, need: [...new Set(a.map(x => x.need))].sort().join(',') };
  }, [SV.c, '2026-11-15']);
  check(mix.same < 30 && mix.shiny >= 45 && mix.shiny <= 110 && mix.need === '4,5,6,7,8', '两份存档 300 天里只有 ' + mix.same + ' 天撞上同一个目标；稀有色 ' + mix.shiny + ' / 600（定的是 1/8）；第几步出来：' + mix.need);
  // 只到过第一个小镇：没有目标；去不了的地方不算（没有水路、小镇、冠军赛的路）
  const none = await E(([S]) => {
    const A = JSON.parse(JSON.stringify(S)); A.world.been = {};
    const B = JSON.parse(JSON.stringify(S)); B.world.been = { s7: 1, u7: 1, t5: 1, v1: 1, d12a: 1, i0C: 1, zz9: 1 };
    return { a: EchoSight.pick(A, '2026-11-15'), ra: EchoSight.reach(A), rb: EchoSight.reach(B), b: EchoSight.pick(B, '2026-11-15') };
  }, [SV.a]);
  check(none.a === null && !none.ra.length && none.b === null && !none.rb.length, '只到过第一个小镇 → 没有目标；没有水路的海路 / 海底、小镇、勇气之路、神殿、室内、不存在的地图都不算去得了');

  // 销售版：没有保留的怪兽
  await boot(SV.a, { 'echo-edition': 'sales' });
  check(await E(() => DEX.sales), '销售版');
  const fs2 = await simAll('销售版');
  check(fs2.sales && fs2.list < 386, '销售版的手册里没有保留的怪兽（' + fs2.list + ' 只），目击的 ' + fs2.mons + ' 种都在这本手册里');

  // ================= 2. 首页卡片、告示板、「译」、🔊 =================
  // 老存档：没有 been / sight 这些新字段，只去过第一个小镇 → 打得开，卡片是「走出小镇以后再来」
  await boot(SAVE({ visited: { 0: 1 } }));
  let a = await E(() => ({ sight: EchoGame.S.world.sight, been: EchoGame.S.world.been, card: (document.querySelector('#home .sight') || {}).textContent || '', cls: (document.querySelector('#home .sight') || {}).className || '' }));
  check(a.sight && a.sight.map === '' && a.sight.total === 0 && a.been && !Object.keys(a.been).length && /none/.test(a.cls) && /走出小镇/.test(a.card) && /今日目击/.test(a.card), '老存档（没有新字段、只到过第一个小镇）：打得开，卡片说走出小镇以后告示板才有消息');
  await p.locator('#home .sight').scrollIntoViewIfNeeded(); await W(200);
  await t.shot('sight-home-none');
  // 走到 1 号路上再回首页：有目标了
  await p.click('[data-act=wEnter]'); await W(900);
  await t.go('r0', 'from:t0');
  check((await E(() => EchoGame.S.world.been)).r0 === 1 && !(await E(() => EchoGame.S.world.been)).t0, '进了 1 号路：记进 world.been（小镇不记）');
  await E(() => EchoGame.goHome('mon')); await W(400);
  a = await st();
  check(a.st === 'new' && a.sg.map === 'r0' && a.sg.day === TODAY && a.clues.length === 3, '回到首页：告示板贴出了今天的目标（只有 1 号路去得了）' + JSON.stringify(a.clues.map(c => c.en)));
  check(!(await E(() => window.__SGT.verify(EchoGame.S.world.sight))).length, '这个目标合规矩、线索是真的');

  // 老存档（玩到第 5 岛、没有 been）：按去过的小镇推出走过的路；没存就重新打开，还是同一个目标
  await boot(SAVE({ visited: all(5), badges: all(4), bag: { hm_cut: 1, hm_smash: 1 } }));
  a = await st();
  const firstPick = JSON.stringify([a.sg.map, a.sg.sp, a.sg.lv, a.sg.shiny, a.sg.cv, a.sg.need]);
  const inferred = await E(() => EchoSight.reach(EchoGame.S));
  check(a.st === 'new' && inferred.join(' ') === 'c3 f1 r0 r1 r2 r3' && inferred.includes(a.sg.map), '老存档（去过 5 座岛、没有记录）：从走过的主路里挑 ' + inferred.join(' ') + ' → ' + a.sg.map + ' / ' + a.sp);
  // 假装定了目标以后还没来得及存档就关掉了：把存档里的 sight 拿掉再重新打开
  await E(k => { const s = JSON.parse(localStorage.getItem(k)); delete s.world.sight; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await p.reload(); await p.waitForFunction(() => window.EchoGame && window.EchoSight && window.__SGT); await W(400);
  a = await st();
  check(JSON.stringify([a.sg.map, a.sg.sp, a.sg.lv, a.sg.shiny, a.sg.cv, a.sg.need]) === firstPick, '没存上就重新打开：算出来还是同一个目标（不会刷新就换）');

  // 首页卡片（竖屏）
  const card = () => E(() => { const c = document.querySelector('#home .sight'); return c ? { txt: c.textContent, en: [...c.querySelectorAll('.sg-en')].map(e => e.textContent), zhBtn: c.querySelectorAll('button.sg-zh').length, zhTxt: [...c.querySelectorAll('span.sg-zh')].map(e => e.textContent), spk: [...c.querySelectorAll('[data-act=sayText]')].map(b => b.dataset.t), chip: (c.querySelector('.lvchip') || {}).textContent || '', h: Math.round(c.getBoundingClientRect().height) } : null; });
  let c = await card();
  check(c && c.en.length === 3 && c.en.join('|') === a.clues.map(x => x.en).join('|') && /今日目击/.test(c.txt) && /Today's Sighting/.test(c.txt) && c.chip === '还没找到', '首页卡片：三条英文线索、状态「还没找到」（高 ' + (c && c.h) + 'px）');
  const mapNames = await E(() => { const m = EchoMaps.get(EchoGame.S.world.sight.map), sp = DEX.byId[EchoGame.S.world.sight.sp]; return [m.name, m.en, sp.en, sp.zh]; });
  check(mapNames.every(n => !c.txt.includes(n)), '卡片上不写地图名字、也不写是哪只怪兽');
  check(c.zhBtn === 3 && !c.zhTxt.length && c.spk.join('|') === c.en.join('|'), '中文先收成「译」（自动档也收）；每条有 🔊，念的就是那句英文');
  await p.locator('#home .sight').scrollIntoViewIfNeeded(); await W(200);
  await t.shot('sight-home-card');
  // 🔊：真的念了这句（测试里没有配音，game.js 会打一行 voice-miss）
  const said = [];
  p.on('console', m => { const x = m.text(); if (x.startsWith('[voice-miss]')) said.push(x); });
  await p.click('#home .sight [data-act=sayText] >> nth=1'); await W(400);
  check(said.some(x => x.includes(a.clues[1].en)), '点 🔊：朗读第 2 条线索');
  // 点「译」：显示中文、记一次 zhTaps、今天这条一直开着
  const taps0 = await E(() => (EchoGame.dayLog().zhTaps || 0));
  await p.click('#home .sight button.sg-zh[data-i="1"]'); await W(200);
  c = await card();
  check(c.zhBtn === 2 && c.zhTxt.join('') === a.clues[1].zh && (await E(() => EchoGame.dayLog().zhTaps)) === taps0 + 1 && (await sight()).zh === 2, '点第 2 条的「译」：显示中文「' + c.zhTxt.join('') + '」，记一次看中文（周报里的 zhTaps）');
  await E(() => EchoGame.goHome('mon')); await W(300);
  c = await card();
  check(c.zhBtn === 2 && c.zhTxt.length === 1 && JSON.parse(await E(k => localStorage.getItem(k), KEY)).world.sight.zh === 2, '重画首页：点过的那条还开着，也存进了存档');
  // 告示板（「怎么找？」）
  await p.click('#home .sight [data-act=sgOpen]'); await W(300);
  let sh = await E(() => ({ txt: document.querySelector('#sheet').textContent, en: [...document.querySelectorAll('#sheet .sg-en')].map(e => e.textContent), zhBtn: document.querySelectorAll('#sheet button.sg-zh').length }));
  check(/今日目击/.test(sh.txt) && sh.en.length === 3 && sh.zhBtn === 2 && /地图上没有记号/.test(sh.txt) && /金币 \+30/.test(sh.txt) && /不点「译」再 \+20/.test(sh.txt) && /明天会换一只/.test(sh.txt) && mapNames.every(n => !sh.txt.includes(n)), '告示板：三条线索、怎么找、奖励，没有地图名字');
  await t.shot('sight-sheet');
  await p.click('#sheet [data-act=close]'); await W(200);
  // 剧情中文设成「总是显示」：直接给中文，没有「多 20」那一条
  await E(() => { EchoGame.S.settings.storyZh = 'always'; EchoGame.goHome('mon'); }); await W(300);
  c = await card();
  check(c.zhBtn === 0 && c.zhTxt.length === 3, '剧情中文 = 总是显示：三条都直接带中文');
  await p.click('#home .sight [data-act=sgOpen]'); await W(300);
  check(!/不点「译」/.test(await p.textContent('#sheet')), '这时候不提「不点译多给金币」');
  await p.click('#sheet [data-act=close]'); await W(200);
  await E(() => { EchoGame.S.settings.storyZh = 'tap'; EchoGame.goHome('mon'); }); await W(300);
  c = await card();
  check(c.zhBtn === 2, '剧情中文 = 点一下才显示：收成「译」');
  await E(() => { delete EchoGame.S.settings.storyZh; });

  // ================= 3. 大地图 =================
  let quiet = false;
  const noRandom = on => { quiet = on; return E(on => { Math.random = on ? () => .99 : window.__rnd; }, on); };   // 不掷出普通的遇怪（13% 一步），免得分不清
  // 一对左右相邻的格子（都是 ch 里的地块），离人远一点（训练师看不到）
  const pair = ch => E(ch => { const m = EchoWorld._debug().M; for (let y = m.H - 3; y > 1; y--) for (let x = 1; x < m.W - 2; x++) if (ch.includes(m.grid[y][x]) && ch.includes(m.grid[y][x + 1]) && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 8) && !m.warps.some(w => Math.abs(w.x - x) + Math.abs(w.y - y) < 3)) return { x, y }; return null; }, ch);
  let base = null;   // 现在来回走的那对格子里左边那一格
  // 在一对格子上来回走 n 步；出了战斗就停，返回走到第几步出的（没出 = 0）
  // （按真的迈出去的步数算：机器忙的时候个别按键没走成，就不算、再按一次）
  const pace = async n => {
    for (let real = 0, tries = 0; real < n && tries < n * 3; tries++) {
      const x = (await t.dbg()).x;
      await t.walk(x === base.x ? 'right' : 'left', 1);
      if ((await t.dbg()).x !== x) real++;
      if (await p.isVisible('#battle')) return real;
    }
    return 0;
  };
  const stand = async ch => { base = await pair(ch); await t.tp(base.x, base.y, 'right'); await E(() => { EchoSight._run.prev = false; }); return base; };
  const battleInfo = () => E(() => { const b = MonsterGame._b(); return b ? { title: document.querySelector('#battle .th-title b').textContent, sub: document.querySelector('#battle .th-title small').textContent, sp: b.foes[0].sp, lv: b.foes[0].lv, shiny: !!b.foes[0].shiny, kind: b.kind, n: b.foes.length } : null; });
  const ready = () => p.waitForSelector('#b-panel [data-act=bBag]', { state: 'visible', timeout: 20000 });
  const flee = async () => { await ready(); await W(200); await p.click('[data-act=bFlee]'); await p.click('#sheet [data-act=bEnd]'); await W(700); };
  // 收服：把对手打到只剩 1 点体力、念咒语打「很准」、收服一定成功；回到大地图以后关掉起名字的窗口。返回点「继续冒险」那一下前后的金币
  const catchIt = async () => {
    await ready(); await W(200);
    await E(() => { MonsterGame._b().foeHp = 1; Math.random = () => 0; const b = document.querySelector('#b-panel [data-act=bCatch]'); b.disabled = false; b.click(); });
    await p.waitForSelector('#b-panel [data-act=bRate][data-v="2"]', { state: 'visible', timeout: 8000 });
    await p.click('#b-panel [data-act=bRate][data-v="2"]');
    await p.waitForSelector('#b-panel [data-act=bEnd]', { state: 'visible', timeout: 30000 });
    const res = (await p.textContent('#b-panel .b-result')).replace(/\s+/g, ' ');
    await W(1500);   // 结算画面上的成就（第一个伙伴……）先发完，下面量的才只是目击的奖励
    const coins = await E(() => { const b = EchoGame.S.coins; document.querySelector('#b-panel [data-act=bEnd]').click(); return [b, EchoGame.S.coins]; });
    await noRandom(quiet);
    await W(900);
    for (let i = 0; i < 6 && await p.isVisible('#modal'); i++) { const sk = await p.$('#sheet [data-act=mNickSkip]'); if (sk) await sk.click(); else if (!(await t.modal())) break; await W(400); }
    return { res, coins };
  };

  await boot(SAVE({ visited: { 0: 1, 1: 1 }, badges: { 0: 1 }, team: [['tidalfin', 12], ['cindercat', 12]], world: { been: { r0: 1, f1: 1 } } }));
  // 把今天的目标定成：1 号路、草丛里、Shuttlebird、第 5 步出来（免得测试跟着日期变）
  const TARGET = { map: 'r0', hab: 'grass', sp: 'shuttlebird', lv: 4, shiny: false, cv: [0, 0], st: '', steps: 0, need: 5, met: 0, zh: 0 };
  await setSight(TARGET);
  check((await st()).st === 'new' && !(await E(() => window.__SGT.verify(EchoGame.S.world.sight))).length, '测试用的目标：1 号路草丛里的 Shuttlebird（平时 1 号路没有它）');
  await p.click('[data-act=wEnter]'); await W(900);
  await noRandom(true);
  // 冒险菜单里有「今日目击」
  await E(() => document.querySelector('#world [data-act=wB]').click()); await W(300);
  check(/今日目击/.test(await p.textContent('#sheet [data-act=sgOpen]')) && /3 条英文线索 · 还没找到/.test(await p.textContent('#sheet [data-act=sgOpen]')), '冒险菜单里有「🔎 今日目击」一行，写着现在的状态');
  await t.shot('sight-menu');
  await p.click('#sheet [data-act=sgOpen]'); await W(300);
  sh = await E(() => ({ txt: document.querySelector('#sheet').textContent, en: [...document.querySelectorAll('#sheet .sg-en')].map(e => e.textContent) }));
  check(sh.en.length === 3 && /road/.test(sh.en[1]) && /tall grass/.test(sh.en[2]) && !/1 号路|Route 1|Shuttlebird/.test(sh.txt), '在大地图里打开告示板：' + sh.en.join(' / '));
  await t.shot('sight-menu-sheet');
  await p.click('#sheet [data-act=close]'); await W(200);

  // 不对的地图：涂鸦森林的草丛里走 16 步，不出来
  await t.go('f1', 'from:t1'); await W(1200);
  check(!/rare/.test(await toasts()), '进了别的地图：没有提示');
  await stand(',');
  let n = await pace(16);
  check(n === 0 && (await sight()).steps === 0, '不对的地图（涂鸦森林）的草丛里走 16 步：不出来，步数也不算');
  // 对的地图：进去有一句中英文提示
  await t.go('r0', 'from:t0'); await W(1300);
  let ts = await toasts();
  check(/Something rare is close!/.test(ts) && /这附近有稀有怪兽的气息/.test(ts), '进了对的地图：提示「' + ts + '」');
  await t.shot('sight-note');
  // 对的地图、不对的地形（路上、空地）：走 16 步不出来
  await stand('.=');
  n = await pace(16);
  check(n === 0 && (await sight()).steps === 0, '对的地图但不在草丛里走 16 步：不出来');
  // 对的地形：第 1–3 步不出来，第 5 步出来
  await stand(',');
  n = await pace(3);
  check(n === 0 && (await sight()).steps === 3, '草丛里走 3 步：还没出来（不会第一步就出来）');
  n = await pace(6);
  let b = await battleInfo();
  check(n === 2 && b && b.kind === 'wild' && b.n === 1 && b.sp === 'shuttlebird' && b.lv === 4, '第 5 步：稀有怪兽出来了 ' + JSON.stringify(b));
  check(b && b.title === '🔎 今日目击' && /Today's Sighting/.test(b.sub), '对战顶上写着「' + (b && b.title) + ' · ' + (b && b.sub) + '」');
  await ready();
  await t.shot('sight-battle');
  // 逃跑：见过了，再走一阵还会出来
  await flee();
  let s = await sight();
  check(await p.isVisible('#world') && s.st === 'seen' && s.met === 1 && s.steps === 0 && s.need >= 10 && s.need <= 16, '逃跑以后：状态是「见过了」，要再走 ' + s.need + ' 步');
  check(/还在这附近/.test(await toasts()), '提示它还在这附近');
  check((await E(() => EchoGame.S.mon.dex.shuttlebird)) === 'seen', '手册里记成见过');
  await E(() => EchoGame.goHome('mon')); await W(400);
  c = await card();
  check(c && c.chip === '👀 见过了，还没收服' && c.en.length === 3, '首页卡片：见过了，还没收服');
  await p.click('[data-act=wEnter]'); await W(900);
  await stand(',');
  n = await pace(s.need - 1);
  check(n === 0, '再走 ' + (s.need - 1) + ' 步：还没出来');
  n = await pace(3);
  b = await battleInfo();
  check(n === 1 && b && b.sp === 'shuttlebird' && b.title === '🔎 今日目击', '第 ' + s.need + ' 步：它又出来了');
  // 收服
  const before = await E(() => ({ total: EchoGame.S.world.sight.total, ach: !!EchoGame.S.ach.sight1 }));
  let got = await catchIt();
  s = await sight();
  check(/收服成功/.test(got.res) && s.st === 'caught' && s.total === before.total + 1 && s.streak === 1 && s.last === TODAY, '收服了：今天的目击结束，累计 ' + s.total + ' 只、连续 ' + s.streak + ' 天');
  check(got.coins[1] - got.coins[0] === 50, '金币 +30，三条线索都没点「译」再 +20（一共 +' + (got.coins[1] - got.coins[0]) + '）');
  check((await E(() => EchoGame.S.mon.dex.shuttlebird)) === 'caught' && (await E(() => EchoGame.S.mon.box.some(m => m.sp === 'shuttlebird'))), '手册照常点亮，怪兽进了队伍');
  await W(1800);
  check(!before.ach && (await E(() => !!EchoGame.S.ach.sight1)) && !(await E(() => !!EchoGame.S.ach.sight7)), '成就「好眼力」到手（7 只的还没有）');
  await stand(',');
  n = await pace(18);
  check(n === 0, '收服以后在草丛里再走 18 步：不再出来');
  await E(() => EchoGame.goHome('mon')); await W(400);
  c = await card();
  a = await E(() => { const e = document.querySelector('#home .sight'); return { cls: e.className, h: Math.round(e.getBoundingClientRect().height) }; });
  check(/done/.test(a.cls) && /已收服/.test(c.txt) && /Shuttlebird/.test(c.txt) && /⭐ 1 只/.test(c.txt) && c.en.length === 0 && a.h < 70, '首页卡片收成一行（高 ' + a.h + 'px）：' + c.txt.replace(/\s+/g, ' '));
  await p.locator('#home .sight').scrollIntoViewIfNeeded(); await W(200);
  await t.shot('sight-home-done');

  // 第二天：换一个新的；昨天收服过 → 今天再收服就是连续 2 天
  const YDAY = await E(d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }, TODAY);
  await setSight({ day: YDAY, last: YDAY });
  await E(() => EchoGame.goHome('mon')); await W(400);
  a = await st();
  check(a.st === 'new' && a.sg.day === TODAY && a.sg.pm === 'r0' && a.sg.ps === 'shuttlebird' && a.sg.map === 'f1' && a.sg.sp !== 'shuttlebird' && a.sg.steps === 0 && a.sg.zh === 0 && a.total === 1 && a.streak === 1,
    '过了一天：新的目标（不在昨天那张地图、不是昨天那只）' + a.sg.map + ' / ' + a.sp + '，累计还在');
  await setSight(Object.assign({}, TARGET, { sp: 'kickball', need: 4, zh: 1 }));   // 今天点过一次「译」
  await p.click('[data-act=wEnter]'); await W(900);
  await noRandom(true);
  await t.go('r0', 'from:t0'); await W(300);
  await stand(',');
  n = await pace(6);
  check(n === 4, '第二天的目标：第 4 步出来');
  got = await catchIt();
  s = await sight();
  check(s.st === 'caught' && s.total === 2 && s.streak === 2 && got.coins[1] - got.coins[0] === 30, '连着两天收服：连续 2 天、累计 2 只；点过「译」只有 +30（+' + (got.coins[1] - got.coins[0]) + '）');
  check(/连续 2 天/.test(await toasts()), '提示里写着连续 2 天');
  // 隔了几天没收服：连续天数断了；没收服的那只第二天就走了
  const OLD = await E(d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - 4); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }, TODAY);
  await setSight({ day: YDAY, st: 'seen', met: 2, sp: 'owlet', map: 'r0', last: OLD, streak: 5 });
  a = await st();
  check(a.st === 'new' && a.sg.sp !== 'owlet' && a.sg.met === 0 && a.streak === 0 && a.total === 2, '昨天见过没收服的那只走了，今天是新的；隔了几天没收服，连续天数从头算');

  // 悄悄喷雾有效的时候不出来（步数照算），喷雾一过就出来
  await setSight(Object.assign({}, TARGET, { need: 4 }));
  await E(() => { EchoGame.S.world.repel = 8; });
  await t.go('r0', 'from:t0'); await W(1300);
  check(/悄悄喷雾还有效/.test(await toasts()), '进地图的提示里说了喷雾还有效');
  await stand(',');
  n = await pace(7);
  s = await sight();
  check(n === 0 && s.steps === 4 && s.st === '', '悄悄喷雾有效：草丛里走 7 步不出来（步数算到 4 就等着）');
  n = await pace(4);
  check(n === 1 || n === 2, '喷雾一过（第 8 步用完）：它出来了（又走了 ' + n + ' 步）');
  await flee();
  // 传说怪兽正在这张地图上等着：不抢戏
  await setSight(Object.assign({}, TARGET, { need: 4 }));
  await E(() => { EchoWorld._debug().M.npcs.push({ id: 'tmpL', role: 'mlegend', mon: 'wishstar', x: 1, y: 1, face: 'down', home: 'down', seed: 0, sight: 0, temp: true }); });
  await stand(',');
  n = await pace(7);
  check(n === 0, '传说怪兽在这张地图上的时候：目击的怪兽不出来');
  await E(() => { const M = EchoWorld._debug().M; M.npcs = M.npcs.filter(q => q.id !== 'tmpL'); });
  n = await pace(3);
  check(n >= 1 && n <= 2, '传说怪兽走了：它才出来');
  await flee();
  // 别的地形也走一遍：洞穴地面、海面（要在水上）、海底的海草；同一张图上不对的地形不出来
  for (const [id, from, hab, sp, ch, off, what] of [['c3', 't3', 'cave', 'scalepup', ':', '', '裂石隧道的洞穴地面'], ['s7', 't7', 'sea', 'swordfish', '~', ',', '8 号水路的海面'], ['u7', 's7', 'weed', 'seadragon', ',', '.', '海底花园的海草']]) {
    await setSight(Object.assign({}, TARGET, { map: id, hab, sp, need: 4 }));
    await t.go(id, 'from:' + from); await t.idle(); await W(300);
    await E(() => { EchoWorld._debug().PL.surf = false; });
    let miss = 0;
    if (off) { await stand(off); miss = await pace(8); }
    const stepsOff = (await sight()).steps;
    if (hab === 'sea') await E(() => { EchoWorld._debug().PL.surf = true; });
    await stand(ch);
    n = await pace(6);
    b = await battleInfo();
    check(miss === 0 && stepsOff === 0 && n === 4 && b && b.sp === sp && b.title === '🔎 今日目击', what + '：第 4 步出来' + (off ? '（同一张图上' + (hab === 'sea' ? '小岛的草丛里' : '沙地上') + '走 8 步不出来）' : '') + ' ' + JSON.stringify({ miss, stepsOff, n, sp: b && b.sp }));
    if (b) await flee();
    await E(() => { EchoWorld._debug().PL.surf = false; });
  }
  // 人在大地图里过了零点：昨天那只不出来了，换成今天的
  await t.go('r0', 'from:t0'); await W(300);
  await setSight(Object.assign({}, TARGET, { day: YDAY, need: 4, steps: 3 }));
  await stand(',');
  n = await pace(2);
  s = await sight();
  check(n === 0 && s.day === TODAY && s.pm === 'r0' && s.ps === 'shuttlebird' && s.st === '', '在大地图里过了零点：昨天那只不出来，告示板换成今天的（' + s.map + ' / ' + s.sp + '）');

  // 大存档：走路只记位置（world.js 的 savePos → E.savePos），目击的步数只在内存里加，不整份存
  await setSight(Object.assign({}, TARGET, { need: 99, steps: 0 }));
  await E(() => EchoGame.flush());
  await W(1200);
  await E(k => {
    EchoGame.T.RT.walkFull = 0;
    window.__w = []; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (q, v) { if (q === k || q === k + '-pos') window.__w.push([q === k ? 'full' : 'pos', Math.round(performance.now())]); return set.call(this, q, v); };
  }, KEY);
  await stand(',');
  await E(() => { window.__w.length = 0; });
  for (let i = 0; i < 6; i++) { await p.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await W(60); await p.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await W(230); }
  let w = await E(() => window.__w.slice());
  s = await sight();
  const lastPos = w.filter(x => x[0] === 'pos').pop();
  check(s.steps >= 3 && w.filter(x => x[0] === 'pos').length >= 3 && lastPos && !w.some(x => x[0] === 'full' && x[1] < lastPos[1] + 700), '大存档那条路：在对的草丛里走了 ' + s.steps + ' 步，每步只写一条位置记录，没有整份重写存档 ' + JSON.stringify(w.map(x => x[0])));
  await W(1500);
  w = await E(() => window.__w.slice());
  check(w.filter(x => x[0] === 'full').length === 1 && JSON.parse(await E(k => localStorage.getItem(k), KEY)).world.sight.steps === s.steps, '停下来 1 秒整份存一次，步数跟着存进去了');
  await E(() => { EchoGame.T.RT.walkFull = null; });
  await noRandom(false);
  check(!cerr.length, '控制台里没有报错' + (cerr.length ? '：' + cerr.slice(0, 3).join(' | ') : ''));

  await t.done();

  // ================= 横屏截图 =================
  const L = await H.open({ viewport: { width: 844, height: 390 } });
  await L.p.addInitScript(PAGE_TOOLS);
  await L.p.evaluate(([k, s]) => { localStorage.setItem(k, JSON.stringify(s)); }, [KEY, SAVE({ visited: all(5), badges: all(4), bag: { hm_cut: 1, hm_smash: 1 } })]);
  await L.p.reload(); await L.p.waitForFunction(() => window.EchoGame && window.EchoSight); await L.W(500);
  const lc = await L.p.evaluate(() => { const c = document.querySelector('#home .sight'); if (!c) return null; const r = c.getBoundingClientRect(); return { n: c.querySelectorAll('.sg-en').length, w: Math.round(r.width), over: [...c.querySelectorAll('.sg-clue')].some(e => e.getBoundingClientRect().right > r.right + 1) }; });
  L.check(lc && lc.n === 3 && !lc.over, '横屏首页：卡片在，三条线索没有超出卡片 ' + JSON.stringify(lc));
  await L.p.locator('#home .sight').scrollIntoViewIfNeeded(); await L.W(200);
  await L.shot('sight-home-card-land');
  await L.p.click('[data-act=wEnter]'); await L.W(900);
  await L.p.evaluate(() => document.querySelector('#world [data-act=wB]').click()); await L.W(300);
  L.check(!!(await L.p.$('#sheet [data-act=sgOpen]')), '横屏冒险菜单里有「今日目击」');
  await L.shot('sight-menu-land');
  await L.p.click('#sheet [data-act=sgOpen]'); await L.W(300);
  const ls = await L.p.evaluate(() => { const s = document.querySelector('#sheet'), r = s.getBoundingClientRect(); return { n: s.querySelectorAll('.sg-en').length, fits: r.right <= innerWidth + 1 && r.left >= -1, btn: !!s.querySelector('[data-act=close]') }; });
  L.check(ls.n === 3 && ls.fits && ls.btn, '横屏告示板：三条线索、放得下 ' + JSON.stringify(ls));
  await L.shot('sight-sheet-land');
  await L.done();
  if (fails0) { console.log('FAIL（不开浏览器的部分）' + fails0); process.exitCode = 1; }
})();
