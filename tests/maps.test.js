// 地图检查（不开浏览器）：
// 1. 每张图：每行一样长、没有未知地块、尺寸不超、出口通向的地图存在而且有通回来的出口、到达点能站人
// 2. 每张图：有了全部野外技能以后，从每个入口都能走到所有出口 / 人物 / 告示牌 / 道具 / 电脑
// 3. 整个世界：有 b 枚徽章（和那时能用的秘传技能）时，能走到第 b 岛的道馆，但去不了第 b+1 岛——主路真的被徽章或秘传技能卡住
// 运行：node tests/maps.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
['maps.js', 'people.js', 'story.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
// 各岛的地图文件（index.html 里 isles/ 开头的脚本，按顺序）
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 某个岛的文件写错了也接着检查别的岛
[...html.matchAll(/<script src="(isles\/[^"]+)"/g)].forEach(m => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, m[1]), 'utf8'), ctx, { filename: m[1] }); } catch (e) { console.log('✗', m[1], '加载出错：', e.message); process.exitCode = 1; } });
// 只检查某几座岛：ISLES=2,3,4 node tests/maps.test.js（别的岛还在施工时用；这时不检查整个世界的主路）
const ONLY = process.env.ISLES ? process.env.ISLES.split(',').map(Number) : null;
const MAPS = ctx.window.EchoMaps;
const KNOWN = '#T.,=~FBoSRrLf^v<>K@CcMmGgHhJjAaEX:WuQPYkpdtZe_nbOIDw%U|';
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
// 秘传技能：要几枚徽章才能用
const HM = { cut: 3, smash: 4, strength: 6, surf: 8, dive: 10, falls: 12 };
let fails = 0;
const bad = (id, msg) => { if (ONLY && id !== '主路' && !ONLY.includes((MAPS.get(id) || {}).isle)) return; fails++; if (fails < 80) console.log('✗', id, msg); };

// 在一张图里能走到哪些格子。S：{ surf, cut, smash, strength, falls, badges, all }（all：全部技能、机关门开着、守卫让开）
function reach(m, from, S) {
  const t = (x, y) => (m.grid[y] && m.grid[y][x]) || '#';
  const wet = new Set();
  m.warps.forEach(w => { if (!'^v<>'.includes(w.via)) return; const [dx, dy] = { '^': [0, 1], v: [0, -1], '<': [1, 0], '>': [-1, 0] }[w.via]; if ('~Dw'.includes(t(w.x + dx, w.y + dy))) wet.add(w.x + ',' + w.y); });
  const rocks = new Set((m.boulders || []).map(b => b.x + ',' + b.y));
  const block = new Set(m.npcs.filter(n => {
    if (n.role === 'trainer' || n.showIf || n.hideIf || n.role === 'master') return false;
    if (n.role === 'guard') return !(S.all || (n.badge != null ? S.badges >= n.badge : S.badges > m.z));
    return true;
  }).map(n => n.x + ',' + n.y));
  const water = (x, y) => '~D'.includes(t(x, y)) || wet.has(x + ',' + y);
  const ok = (x, y, dy) => {
    const c = t(x, y), k = x + ',' + y;
    if (block.has(k)) return false;
    if (wet.has(k)) return !!S.surf;
    if (rocks.has(k)) return !!S.strength;
    if (MAPS.WALK.includes(c)) return true;
    if (c === 'n') return !!S.cut;
    if (c === 'b') return !!S.smash;
    if (c === '|') return !!S.all;
    if (water(x, y)) return !!S.surf;
    if (c === 'w') return !!S.surf && (dy > 0 || (dy < 0 && !!S.falls));
    return false;
  };
  const start = from.x + ',' + from.y, seen = new Set([start]), q = [[from.x, from.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      let nx = x + dx, ny = y + dy;
      if (t(nx, ny) === 'L') { if (dy !== 1) continue; ny += 1; }
      if (t(nx, ny) === 'w' && dy === 0) continue;
      if (!ok(nx, ny, dy)) continue;
      // 冰面：一直滑到撞上东西
      while (t(nx, ny) === 'I' && ok(nx + dx, ny + dy, dy)) { nx += dx; ny += dy; }
      if (seen.has(nx + ',' + ny)) continue;
      seen.add(nx + ',' + ny); q.push([nx, ny]);
    }
  }
  return seen;
}
const has = (s, x, y) => s.has(x + ',' + y);
const near = (s, x, y) => DIRS.some(([dx, dy]) => has(s, x + dx, y + dy));
// 走得到这个出口吗：能踩上去的出口格要站上去；门、洞口要站在下面
const warpReached = (R, m, w) => MAPS.WALK.includes(m.grid[w.y][w.x]) ? has(R, w.x, w.y) : has(R, w.x, w.y + 1);

const ids = MAPS.all();
const incoming = {};
const ALL = { surf: 1, cut: 1, smash: 1, strength: 1, falls: 1, badges: 99, all: 1 };
for (const id of ids) {
  const m = MAPS.get(id);
  if (!m) { bad(id, '生成失败'); continue; }
  m.grid.forEach((r, y) => { if (r.length !== m.W) bad(id, '第 ' + y + ' 行长度 ' + r.length + '，应为 ' + m.W); });
  m.grid.forEach((r, y) => r.forEach((c, x) => { if (!KNOWN.includes(c)) bad(id, '未知地块 ' + c + ' @' + x + ',' + y); }));
  if (m.W > 48 || m.H > 80) bad(id, '地图太大 ' + m.W + '×' + m.H + '（最多 48×80，手机的贴图放不下）');
  if (m.over && (m.over.length !== m.H || m.over.some(r => r.length !== m.W))) bad(id, 'over 图层和地图大小不一样');
  for (const w of m.warps.concat(m.dives, m.surfaces)) {
    const tm = MAPS.get(w.to);
    if (!tm) { bad(id, '出口通向不存在的地图 ' + w.to + ' @' + w.x + ',' + w.y); continue; }
    if (!tm.groups.some(g => g.to === id) && !(m.def && (m.def.oneWay || []).includes(w.to))) bad(id, '出口通向 ' + w.to + '，但 ' + w.to + ' 没有通回来的出口');
    (incoming[w.to] = incoming[w.to] || new Set()).add(w.arrive);
  }
  m.npcs.forEach(n => { if (n.to) { if (!MAPS.get(n.to)) bad(id, '船通向不存在的地图 ' + n.to); else (incoming[n.to] = incoming[n.to] || new Set()).add(n.how || 'start'); } });
}
for (const id of ids) {
  const m = MAPS.get(id);
  const arrivals = [...(incoming[id] || [])];
  if (id === 't0') arrivals.push('start');
  if (!arrivals.length) bad(id, '没有任何入口能进来');
  for (const how of arrivals) {
    const p = how === 'start' ? m.start : MAPS.arrival(m, how);
    const c = m.grid[p.y] && m.grid[p.y][p.x];
    if (!(MAPS.WALK.includes(c) || '~D'.includes(c)) || m.warps.some(w => w.x === p.x && w.y === p.y)) { bad(id, '到达点不能站 ' + how + ' @' + p.x + ',' + p.y + ' (' + c + ')'); continue; }
    if (m.npcs.some(n => n.x === p.x && n.y === p.y && n.role !== 'guard' && n.role !== 'master' && !n.showIf && !n.hideIf)) bad(id, '到达点上站着人 ' + how);
    const R = reach(m, p, ALL);
    for (const w of m.warps) if (!warpReached(R, m, w)) bad(id, '从 ' + how + ' 走不到出口 ' + m.grid[w.y][w.x] + '→' + w.to + ' @' + w.x + ',' + w.y);
    for (const d of m.dives.concat(m.surfaces)) if (!has(R, d.x, d.y)) bad(id, '从 ' + how + ' 到不了潜水点/浮上点 @' + d.x + ',' + d.y);
    for (const o of m.picks.concat(m.hidden || [])) if (!has(R, o.x, o.y)) bad(id, '从 ' + how + ' 捡不到道具 @' + o.x + ',' + o.y);
    for (const s of m.signs) if (!near(R, s.x, s.y)) bad(id, '告示牌走不到 @' + s.x + ',' + s.y);
    for (const n of m.npcs) {
      const counter = DIRS.some(([dx, dy]) => m.grid[n.y + dy] && m.grid[n.y + dy][n.x + dx] === 'Q' && has(R, n.x + dx * 2, n.y + dy * 2));
      if (!near(R, n.x, n.y) && !counter && !n.far) bad(id, '人物 ' + n.role + (n.name ? ' ' + n.name : '') + ' 走不到 @' + n.x + ',' + n.y);
    }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.grid[y][x] === 'P' && !near(R, x, y)) bad(id, '电脑走不到');
  }
  if (m.kind === 'town') ['C', 'M', 'G'].forEach(L => { if (!m.buildings[L]) bad(id, '缺少建筑 ' + L); });
  if (m.kind === 'route' && !(m.def && m.def.noGrass) && !m.grid.some(r => r.includes(',') || r.includes('~'))) bad(id, '道路上没有草丛也没有水');
}

// ---------- 整个世界的主路 ----------
function world(b) {
  const S = { badges: b, surf: b >= HM.surf, cut: b >= HM.cut, smash: b >= HM.smash, strength: b >= HM.strength, dive: b >= HM.dive, falls: b >= HM.falls };
  const seen = new Set(), maps = new Set(), q = [];
  const enter = (id, how) => { const m = MAPS.get(id); if (!m) return; const p = how === 'start' ? m.start : MAPS.arrival(m, how); const k = id + '|' + p.x + ',' + p.y; if (seen.has(k)) return; seen.add(k); q.push([id, p]); };
  enter('t0', 'door:C');
  while (q.length) {
    const [id, p] = q.shift(), m = MAPS.get(id);
    maps.add(id);
    const R = reach(m, p, S);
    for (const w of m.warps) if (warpReached(R, m, w)) enter(w.to, w.arrive);
    if (S.dive) for (const d of m.dives) if (has(R, d.x, d.y)) enter(d.to, d.arrive);
    for (const d of m.surfaces) if (has(R, d.x, d.y)) enter(d.to, d.arrive);
    for (const n of m.npcs) if (n.role === 'ferry' && n.to && (n.badge == null || b >= n.badge) && near(R, n.x, n.y)) enter(n.to, n.how || 'start');
  }
  return maps;
}
const N = ONLY ? 0 : 13;
for (let b = 0; b < N; b++) {
  const W = world(b);
  if (!W.has('i' + b + 'G')) bad('主路', '有 ' + b + ' 枚徽章时走不到第 ' + (b + 1) + ' 岛的道馆');
  if (b < N - 1 && W.has('t' + (b + 1))) bad('主路', '只有 ' + b + ' 枚徽章就能走到第 ' + (b + 2) + ' 岛（没被卡住）');
  if (b < N - 1 && W.has('i12L')) bad('主路', '只有 ' + b + ' 枚徽章就能进英语冠军赛');
}
if (!ONLY && !world(13).has('i12L')) bad('主路', '13 枚徽章走不到英语冠军赛');

console.log('maps:', ids.length, '张；人物', ids.reduce((a, id) => a + MAPS.get(id).npcs.length, 0), '个；训练师', ids.reduce((a, id) => a + MAPS.get(id).npcs.filter(n => n.role === 'trainer').length, 0), '个');
if (fails) { console.log('FAIL', fails); process.exitCode = 1; } else console.log('PASS');
