// 地图检查：每行一样长、没有未知地块、出入口都连得上、从每个入口都能走到所有出口/门/道具/人物
// 运行：node tests/maps.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'maps.js'), 'utf8'), ctx);
const MAPS = ctx.window.EchoMaps;
const KNOWN = '#T.,=~FBoSRrLf^vK@CcMmGgHhJjX:WuQPYkpdtZe_';
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
let fails = 0;
const bad = (id, msg) => { fails++; console.log('✗', id, msg); };

function reach(m, from, blockGuard) {
  const npc = new Set(m.npcs.filter(n => blockGuard || n.role !== 'guard').map(n => n.x + ',' + n.y));
  const t = (x, y) => (m.grid[y] && m.grid[y][x]) || '#';
  const ok = (x, y) => MAPS.WALK.includes(t(x, y)) && !npc.has(x + ',' + y);
  const seen = new Set([from.x + ',' + from.y]), q = [[from.x, from.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      let nx = x + dx, ny = y + dy;
      if (t(nx, ny) === 'L') { if (dy !== 1) continue; ny += 1; }
      if (!ok(nx, ny) || seen.has(nx + ',' + ny)) continue;
      seen.add(nx + ',' + ny); q.push([nx, ny]);
    }
  }
  return seen;
}
const has = (s, x, y) => s.has(x + ',' + y);
const near = (s, x, y) => DIRS.some(([dx, dy]) => has(s, x + dx, y + dy));

const ids = MAPS.all();
const incoming = {};
for (const id of ids) {
  const m = MAPS.get(id);
  if (!m) { bad(id, '生成失败'); continue; }
  m.grid.forEach((r, y) => { if (r.length !== m.W) bad(id, '第 ' + y + ' 行长度 ' + r.length + '，应为 ' + m.W); });
  m.grid.forEach((r, y) => r.forEach((c, x) => { if (!KNOWN.includes(c)) bad(id, '未知地块 ' + c + ' @' + x + ',' + y); }));
  for (const w of m.warps) {
    const tm = MAPS.get(w.to);
    if (!tm) { bad(id, '出口通向不存在的地图 ' + w.to); continue; }
    (incoming[w.to] = incoming[w.to] || new Set()).add(w.arrive);
  }
}
for (const id of ids) {
  const m = MAPS.get(id);
  const arrivals = [...(incoming[id] || [])];
  if (id === 't0') arrivals.push('start');
  if (!arrivals.length) bad(id, '没有任何入口能进来');
  for (const how of arrivals) {
    const p = how === 'start' ? m.start : MAPS.arrival(m, how);
    const c = m.grid[p.y] && m.grid[p.y][p.x];
    if (!MAPS.WALK.includes(c) || m.warps.some(w => w.x === p.x && w.y === p.y)) { bad(id, '到达点不能站 ' + how + ' @' + p.x + ',' + p.y + ' (' + c + ')'); continue; }
    if (m.npcs.some(n => n.x === p.x && n.y === p.y && !(n.role === 'guard' && how === 'north'))) bad(id, '到达点上站着人 ' + how); // 从北边回来时已经有徽章，守卫不在
    const R = reach(m, p, false);
    for (const w of m.warps) {
      const ch = m.grid[w.y][w.x], walk = MAPS.WALK.includes(ch);
      if (walk ? !has(R, w.x, w.y) : !has(R, w.x, w.y + 1)) bad(id, '从 ' + how + ' 走不到出口 ' + ch + ' @' + w.x + ',' + w.y);
    }
    for (const o of m.picks) if (!has(R, o.x, o.y)) bad(id, '从 ' + how + ' 捡不到道具 @' + o.x + ',' + o.y);
    for (const s of m.signs) if (!near(R, s.x, s.y)) bad(id, '告示牌走不到 @' + s.x + ',' + s.y);
    for (const n of m.npcs) {
      const counter = DIRS.some(([dx, dy]) => m.grid[n.y + dy] && m.grid[n.y + dy][n.x + dx] === 'Q' && has(R, n.x + dx * 2, n.y + dy * 2));
      if (!near(R, n.x, n.y) && !counter) bad(id, '人物 ' + n.role + ' 走不到 @' + n.x + ',' + n.y);
    }
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.grid[y][x] === 'P' && !near(R, x, y)) bad(id, '电脑走不到');
  }
  // 道路必须能从南往北走通（不能靠跳台阶）
  if (m.kind === 'route') {
    const R = reach(m, MAPS.arrival(m, 'south'), false), n = m.warps.find(w => w.to[0] === 't' && m.grid[w.y][w.x] === '^');
    if (!n || !has(R, n.x, n.y)) bad(id, '从南边走不到北出口');
    const R2 = reach(m, MAPS.arrival(m, 'north'), false), s = m.warps.find(w => m.grid[w.y][w.x] === 'v');
    if (!s || !has(R2, s.x, s.y)) bad(id, '从北边走不到南出口');
    if (!m.npcs.some(q => q.role === 'trainer')) bad(id, '道路上没有训练师');
    if (!m.grid.some(r => r.includes(','))) bad(id, '道路上没有草丛');
  }
  if (m.kind === 'town') {
    const g = m.npcs.find(n => n.role === 'guard');
    if (m.z < 12 && !g) bad(id, '没有守卫');
    if (g) {
      const R = reach(m, MAPS.arrival(m, m.z === 0 ? 'door:C' : 'south'), true);
      const north = m.warps.find(w => m.grid[w.y][w.x] === '^');
      if (north && has(R, north.x, north.y)) bad(id, '守卫没有挡住北出口');
    }
    ['C', 'M', 'G', 'H', 'J'].forEach(L => { if (!m.buildings[L]) bad(id, '缺少建筑 ' + L); });
  }
}
console.log('maps:', ids.length, '张；人物', ids.reduce((a, id) => a + MAPS.get(id).npcs.length, 0), '个；训练师', ids.reduce((a, id) => a + MAPS.get(id).npcs.filter(n => n.role === 'trainer').length, 0), '个');
if (fails) { console.log('FAIL', fails); process.exitCode = 1; } else console.log('PASS');
