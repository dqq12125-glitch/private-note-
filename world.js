// 回声岛 · 大地图冒险：小镇、道路、洞穴、房子内部；走路、跳台阶、草丛遇怪、训练师、怪兽中心/电脑、商店、道馆、英语对话
// 画面由渲染器负责：world3d.js 的 2.5D 画面，或者本文件里的 2D「流畅模式」
(function () {
  'use strict';

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const STEP_MS = 170, JUMP_MS = 300, BIKE_MS = 95;
  const TRAINER_NAMES = ['Jack', 'Amy', 'Ben', 'Kate', 'Sam', 'Lucy', 'Mike', 'Anna', 'Leo', 'Mia', 'Max', 'Emma', 'Tony', 'Nora', 'Owen', 'Ruby', 'Dan', 'Ivy'];
  const PICKS = ['ball', 'potion', 'repel', 'superball', 'superpotion', 'revive', 'leafstone', 'firestone', 'waterstone', 'thunderstone', 'moonstone'];

  let E = null, MG = null, EM = null;
  let M = null;           // 当前地图
  let R = null;           // 当前渲染器
  let raf = 0, running = false, lastNow = 0;
  const PL = { x: 0, y: 0, fx: 0, fy: 0, dir: 'up', moving: false, t0: 0, dur: STEP_MS, jump: false };
  const FL = { x: 0, y: 0, fx: 0, fy: 0 };
  let held = null, dlg = null, busy = false, wipeT = 0;
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const WS = () => E.S.world;
  const hasBadge = z => !!E.S.mon.badges[z] || E.S.settings.unlockAll;

  // ---------- 存档迁移：旧版只有 13 个小镇，没有道路和房子 ----------
  function migrate() {
    const ws = WS();
    if (ws.v === 2) {
      // v3：地图全部重做 + 秘传学习器。老存档站在已经不存在的地图上就回到当前小镇的怪兽中心；按徽章数补发学习器
      ws.v = 3;
      if (!EM.all().includes(ws.map)) { ws.map = 't' + Math.max(0, Math.min(E.W.length - 1, ws.z || 0)); ws.x = -1; ws.y = -1; ws.arrive = 'door:C'; }
      const nb = Object.keys(E.S.mon.badges).length;
      Object.entries(SKILLS).forEach(([k, S]) => { if (nb >= S.badge && !MG.itemCount(S.hm)) MG.addItem(S.hm, 1); });
      E.save();
      return;
    }
    if (ws.v === 3) return;
    const z = Math.max(0, Math.min(E.W.length - 1, ws.z || 0));
    ws.v = 3;
    ws.map = 't' + z;
    ws.x = -1; ws.y = -1;
    ws.arrive = 'door:C';
    ws.flags = {};
    ws.center = null;
    ws.repel = 0;
    E.save();
  }

  // ---------- 地图查询 ----------
  const rawTile = (x, y) => (M.grid[y] && M.grid[y][x]) || (M.kind === 'inside' ? 'W' : M.kind === 'cave' ? 'X' : M.kind === 'under' ? 'R' : '#');
  const boulderAt = (x, y) => (M._bould || []).find(b => b.x === x && b.y === y);
  const floorCh = () => M.kind === 'cave' ? ':' : M.kind === 'inside' ? '_' : '.';
  const tile = (x, y) => {
    const k = x + ',' + y;
    if (M._cleared && M._cleared.has(k)) return floorCh();
    if (M._open && M._open.has(k)) return floorCh();
    if (boulderAt(x, y)) return 'O';
    return rawTile(x, y);
  };
  const WATER = '~Dw';
  const isWater = (x, y) => WATER.includes(tile(x, y)) || (M._wet && M._wet.has(x + ',' + y));
  const nBadges = () => Object.keys(E.S.mon.badges).length;
  const guardGone = n => n.badge != null ? nBadges() >= n.badge || E.S.settings.unlockAll : hasBadge(M.z);
  const flagOK = n => (!n.showIf || [].concat(n.showIf).every(k => WS().flags['s:' + k])) && (!n.hideIf || ![].concat(n.hideIf).some(k => WS().flags['s:' + k]));
  const npcVisible = n => !(n.role === 'guard' && guardGone(n)) && flagOK(n) && !(window.EchoStory && EchoStory.hidden(SC, n));
  const npcAt = (x, y) => M.npcs.find(n => n.x === x && n.y === y && npcVisible(n));
  const pickKey = p => 'p:' + M.id + ':' + p.x + ':' + p.y;
  const pickAt = (x, y) => M.picks.find(p => p.x === x && p.y === y && !WS().flags[pickKey(p)]);
  const pickType = p => p.item || PICKS[(p.x * 7 + p.y * 3 + M.z) % (M.z < 2 ? 2 : M.z < 4 ? 3 : M.z < 6 ? 4 : M.z < 8 ? 6 : PICKS.length)];
  // 水边的出口格（出口外面是水）：要冲浪才能走
  const walkable = (x, y) => (PL.surf ? (isWater(x, y) && tile(x, y) !== 'w') || EM.WALK.includes(tile(x, y)) : EM.WALK.includes(tile(x, y)) && !(M._wet && M._wet.has(x + ',' + y))) && !npcAt(x, y);
  const hiddenKey = h => 'h:' + M.id + ':' + h.x + ':' + h.y;
  const hiddenAt = (x, y) => (M.hidden || []).find(h => h.x === x && h.y === y && !WS().flags[hiddenKey(h)]);
  const warpAt = (x, y) => M.warps.find(w => w.x === x && w.y === y);
  const signAt = (x, y) => M.signs.find(s => s.x === x && s.y === y);
  const trainerKey = n => 't:' + M.id + ':' + n.id;
  const beaten = n => !!WS().flags[trainerKey(n)];
  const faceTo = (a, b) => Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? (b.x > a.x ? 'right' : 'left') : (b.y > a.y ? 'down' : 'up');

  // 地图名字
  function placeName(m) {
    m = m || M;
    const w = E.W[m.z];
    if (m.name) return { icon: m.icon || { town: w.icon, route: '🛤️', cave: '🕳️', under: '🌊', inside: '🏠' }[m.kind] || '📍', name: m.name, en: m.en || m.name, sub: m.sub || (m.kind === 'town' ? '第 ' + (m.z + 1) + ' 岛' : w.name) };
    if (m.kind === 'town') return { icon: w.icon, name: w.name, en: w.en.replace(/[!?]/g, '') + ' Town', sub: '第 ' + (m.z + 1) + ' 镇' };
    if (m.kind === 'route') return { icon: '🛤️', name: (m.z + 1) + ' 号路', en: 'Route ' + (m.z + 1), sub: w.name + ' → ' + E.W[m.z + 1].name };
    if (m.kind === 'cave') return { icon: '🕳️', name: '回声洞 ' + (EM.caves.indexOf(m.route) + 1), en: 'Echo Cave', sub: (m.route + 1) + ' 号路旁边' };
    const room = { C: ['🏥', '怪兽中心', 'Monster Center'], M: ['🏪', '商店', 'Shop'], G: ['🏟️', '道馆', 'Gym'], H: ['🏠', '民居', 'House'], J: ['🏠', '民居', 'House'], L: ['🏆', '英语冠军赛会场', 'English League'], 1: ['🏆', '第一位大师', 'Master 1'], 2: ['🏆', '第二位大师', 'Master 2'], 3: ['🏆', '第三位大师', 'Master 3'], 4: ['🏆', '第四位大师', 'Master 4'], 5: ['👑', '冠军的房间', 'Champion'] }[m.room];
    return { icon: room[0], name: w.name + ' · ' + room[1], en: room[2], sub: '第 ' + (m.z + 1) + ' 镇' };
  }

  // ---------- 人物造型 ----------
  function trainerInfo(n) {
    const k = (M.z * 5 + n.seed) % TRAINER_NAMES.length;
    if (n.look) { const l = typeof n.look === 'string' ? LOOKS[n.look] : n.look; return { name: n.name || TRAINER_NAMES[k], g: n.g || 'm', look: l || HIKER_LOOK }; }
    if (M.kind === 'cave') return { name: 'Hiker ' + TRAINER_NAMES[k], g: 'm', look: HIKER_LOOK };
    if (M.kind === 'inside') return { name: TRAINER_NAMES[k], g: n.seed % 2 ? 'f' : 'm', look: Object.assign({}, TRAINER_LOOKS[n.seed % TRAINER_LOOKS.length][1], { shirt: E.W[M.z].color }) };
    const e = TRAINER_LOOKS[(M.z + n.seed) % TRAINER_LOOKS.length];
    return { name: TRAINER_NAMES[k], g: e[0], look: e[1] };
  }
  function npcLook(n) {
    if (n.look && n.role !== 'trainer') return { name: n.name || 'Friend', g: n.g || 'm', look: typeof n.look === 'string' ? LOOKS[n.look] || LOOKS.hiker : n.look };
    const o = window.EchoStory && EchoStory.look(SC, n);
    if (o) return o;
    if (n.role === 'guard') return { name: 'Guard', g: 'm', look: LOOKS.guard };
    if (n.role === 'talk' && M.kind === 'town' && M.z === 0 && n.id === '1') return { name: 'Professor Echo', g: 'f', look: LOOKS.prof };
    if (n.role === 'quiz') return { name: 'Mr Wise', g: 'm', look: LOOKS.teacher };
    if (n.role === 'trainer') return trainerInfo(n);
    if (n.role === 'nurse') return { name: 'Nurse Amy', g: 'f', look: LOOKS.nurse };
    if (n.role === 'clerk') return { name: 'Clerk Tom', g: 'm', look: LOOKS.clerk };
    if (n.role === 'hiker') return { name: 'Hiker Bob', g: 'm', look: HIKER_LOOK };
    if (n.role === 'leader') { const b = E.W[M.z].boss; return { name: b.name, g: 'm', look: Object.assign({}, LOOKS.leader, { shirt: E.W[M.z].color }), emo: b.emoji }; }
    const v = VILLAGER_LOOKS[(M.z * 3 + n.seed) % VILLAGER_LOOKS.length];
    return { name: v[0], g: v[1], look: v[2] };
  }

  // ---------- 进入 / 切换地图 ----------
  function savePos() {
    const ws = WS();
    ws.map = M.id; ws.z = M.z; ws.x = PL.x; ws.y = PL.y; ws.dir = PL.dir; ws.arrive = null;
    E.save();
  }
  function loadMap(id, how) {
    M = EM.get(id) || EM.get('t0');
    const vw = $('w-view');
    if (vw) { vw.querySelectorAll('canvas').forEach(c => { c.style.filter = ''; }); const nt = $('w-note'); if (nt) nt.hidden = true; }
    M.npcs = M.npcs.filter(n => !n.temp);
    // 每次进地图：砍掉的树、碎掉的石头会长回来，大石头回到原位；怪力、闪光要重新用
    M._cleared = new Set(); M._bould = (M.boulders || []).map(b => ({ x: b.x, y: b.y, rx: b.x, ry: b.y })); M._strength = false; M._flash = false;
    // 机关门：解开过的（存档里记着）一直开着
    M._open = new Set((M.gates || []).filter(g => WS().flags['gate:' + M.id + ':' + g.i]).map(g => g.x + ',' + g.y));
    // 水边的出口格
    M._wet = new Set();
    (M.warps || []).forEach(w => { if (!'^v<>'.includes(w.via)) return; const [dx, dy] = { '^': [0, 1], v: [0, -1], '<': [1, 0], '>': [-1, 0] }[w.via]; if (WATER.includes(rawTile(w.x + dx, w.y + dy))) M._wet.add(w.x + ',' + w.y); });
    const wasSurf = PL.surf;
    PL.surf = false;
    if (M.kind === 'inside' || M.kind === 'under') PL.bike = false;
    const ws = WS();
    if (M.kind === 'town') ws.visited[M.z] = 1;
    let p = how && typeof how === 'object' ? how : EM.arrival(M, how === 'start' ? null : how);
    if (p.surf || (wasSurf && isWater(p.x, p.y)) || (M._wet.size && isWater(p.x, p.y))) PL.surf = true;
    // 到达点被人挡住（比如守卫）时往旁边让一让
    if ((!EM.WALK.includes(tile(p.x, p.y)) && !(PL.surf && isWater(p.x, p.y))) || npcAt(p.x, p.y)) {
      const alt = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, dir: p.dir })).find(q => walkable(q.x, q.y) && !warpAt(q.x, q.y));
      p = alt || EM.arrival(M, null);
    }
    M.npcs.forEach(n => { n.face = n.home; n.alert = 0; if (n.ox != null) { n.x = n.ox; n.y = n.oy; } n.ox = n.x; n.oy = n.y; });
    PL.x = PL.fx = p.x; PL.y = PL.fy = p.y; PL.dir = p.dir || 'up'; PL.moving = false; PL.jump = false;
    const [dx, dy] = DIRS[PL.dir];
    const bx = p.x - dx, by = p.y - dy, ok = EM.WALK.includes(tile(bx, by)) && !warpAt(bx, by);
    FL.x = FL.fx = ok ? bx : p.x;
    FL.y = FL.fy = ok ? by : p.y;
    if (R) R.load(M, api3d);
    savePos();
    hud();
    // 逃生绳回到最后一次待过的户外地图
    if ((M.kind === 'town' || M.kind === 'route') && !PL.surf) ws.lastOut = { map: M.id, x: PL.x, y: PL.y, dir: PL.dir };
  }
  function enter(z, how) {
    E.primeTTS(); E.ac();
    E.closeModal();
    E.show('world');
    ensureDom();
    migrate();
    const ws = WS();
    ensureRenderer();
    // 还没有怪兽：新游戏，从开场剧情开始（在自己家里醒来）
    const fresh = !E.S.mon.box.length;
    if (fresh) {
      Object.keys(ws.flags).forEach(k => { if (k.startsWith('s:')) delete ws.flags[k]; });
      loadMap('i0H', { x: 6, y: 2, dir: 'down' });
    } else if (how === 'resume' && ws.started && ws.map) loadMap(ws.map, ws.x >= 0 ? { x: ws.x, y: ws.y, dir: ws.dir } : ws.arrive || 'door:C');
    else if (how === 'fly') loadMap('t' + z, 'door:C');
    else loadMap('t0', 'door:C');
    ws.started = true; ws.introDone = true;
    E.save();
    resize();
    startLoop();
    if (!fresh) banner();
    story('enter', 'begin');
  }
  async function goMap(id, how) {
    busy = true;
    held = null;
    const v = $('w-view'); v.classList.add('fade');
    E.SFX.tap();
    await sleep(300);
    const prevKind = M.kind;
    const nt = $('w-note'); if (nt) nt.hidden = true;
    v.querySelectorAll('canvas').forEach(c => { c.style.filter = ''; });
    loadMap(id, how);
    await sleep(60);
    v.classList.remove('fade');
    if (M.kind !== 'inside' && !(prevKind === 'inside' && M.kind === 'town')) banner();
    busy = false;
    story('enter', how);
  }
  function banner() {
    const b = $('w-banner'), p = placeName();
    b.innerHTML = '<small>' + p.sub + (M.kind === 'town' && E.S.mon.badges[M.z] ? ' · 🏅' : '') + '</small><b>' + p.name + '</b><span>' + E.esc(p.en) + '</span>';
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 2600);
    E.say(M.kind === 'town' ? 'Welcome to ' + p.en + '!' : p.en);
  }
  function hud() {
    const p = placeName();
    $('w-zname').textContent = p.icon + ' ' + p.name;
    $('w-zsub').textContent = M.kind === 'route' || M.kind === 'cave' || M.kind === 'under' ? '野外 Lv ' + (MG.zoneLv(M.z) + (M.lvBonus || 0)) + '–' + (MG.zoneLv(M.z) + (M.lvBonus || 0) + 2) : p.sub;
    $('w-badges').textContent = '🏅 ' + Object.keys(E.S.mon.badges).length;
    $('w-balls').textContent = '🔮 ' + E.S.mon.balls;
    const bk = $('w-bike');
    if (bk) { bk.hidden = !(MG.itemCount('bike') > 0) || M.kind === 'inside' || M.kind === 'under'; bk.classList.toggle('on', !!PL.bike); }
  }

  // ---------- 移动 ----------
  function tryMove(dir) {
    if (PL.moving || dlg || busy || !$('modal').hidden) return;
    PL.dir = dir;
    const [dx, dy] = DIRS[dir], nx = PL.x + dx, ny = PL.y + dy, t = tile(nx, ny);
    const w = warpAt(nx, ny);
    if (w && !EM.WALK.includes(t)) { if (dir === 'up') goMap(w.to, w.arrive); return; }   // 门、洞口
    // 瀑布：冲浪时往上要用「攀瀑」，往下会顺着水冲下去；左右水流太急过不去
    if (t === 'w') {
      if (!PL.surf) return;
      if (dir === 'down') { step(nx, ny, STEP_MS * .7, false); return; }
      if (dir !== 'up') return;
      if (skillReady('falls')) useSkill('falls', () => climbFalls());
      else talk([{ who: '旁白', emo: '🌊', en: 'The waterfall is too strong!', zh: '瀑布的水太急了，爬不上去。' + (skillOpen('falls') ? '队伍里要有水系或龙系的怪兽。' : '') }]);
      return;
    }
    // 台阶：只能往下跳，一下跳两格
    if (t === 'L') {
      if (dir !== 'down' || !walkable(nx, ny + 1)) return;
      step(nx, ny + 1, JUMP_MS, true);
      E.SFX.tap();
      return;
    }
    // 怪力：推着大石头往前走一格
    if (t === 'O' && M._strength) {
      const bx = nx + dx, by = ny + dy, b = boulderAt(nx, ny);
      if (b && EM.WALK.includes(tile(bx, by)) && !npcAt(bx, by) && !warpAt(bx, by) && !(bx === FL.x && by === FL.y)) { b.x = bx; b.y = by; E.SFX.tap(); step(nx, ny, STEP_MS * 1.6, false); }
      return;
    }
    if (!walkable(nx, ny)) return;
    // 冲浪中走上岸就下来
    if (PL.surf && !isWater(nx, ny)) { PL.surf = false; E.toast('🏖️ 上岸了'); }
    step(nx, ny, PL.bike && !PL.surf ? BIKE_MS : STEP_MS, false);
  }
  function step(nx, ny, dur, jump) {
    FL.fx = FL.x; FL.fy = FL.y; FL.x = PL.x; FL.y = PL.y;
    PL.fx = PL.x; PL.fy = PL.y; PL.x = nx; PL.y = ny;
    PL.moving = true; PL.jump = jump; PL.dur = dur; PL.t0 = performance.now();
  }
  // 攀瀑：一直往上爬到瀑布顶上
  async function climbFalls() {
    busy = true;
    E.SFX.hit();
    PL.x = PL.x; PL.dir = 'up';
    while (tile(PL.x, PL.y - 1) === 'w' || (tile(PL.x, PL.y) === 'w' && isWater(PL.x, PL.y - 1))) {
      PL.scripted = true;
      step(PL.x, PL.y - 1, STEP_MS * 1.2, false);
      await sleep(STEP_MS * 1.2 + 30);
      if (tile(PL.x, PL.y) !== 'w') break;
    }
    await sleep(40);
    PL.scripted = false; PL.moving = false; PL.fx = PL.x; PL.fy = PL.y;
    busy = false;
    savePos();
  }
  function onStep() {
    if (PL.scripted) return;
    const t = tile(PL.x, PL.y), ws = WS();
    savePos();
    const w = warpAt(PL.x, PL.y);
    if (w) { goMap(w.to, w.arrive); return; }
    // 冰面：一直滑，撞到东西才停；瀑布往下冲
    if (t === 'I' || (t === 'w' && PL.dir === 'down')) {
      const [dx, dy] = DIRS[PL.dir], nx = PL.x + dx, ny = PL.y + dy;
      if (walkable(nx, ny) || (t === 'w' && PL.surf && isWater(nx, ny) && !npcAt(nx, ny))) {
        if (PL.surf && !isWater(nx, ny)) PL.surf = false;
        step(nx, ny, t === 'I' ? STEP_MS * .6 : STEP_MS * .7, false); PL.slide = true; return;
      }
    }
    const slid = PL.slide; PL.slide = false;
    const p = pickAt(PL.x, PL.y);
    if (p) { pickup(p); return; }
    if (story('step')) return;
    const tr = spotTrainer();
    if (tr) { trainerSpotted(tr); return; }
    const ev = MG.stepHook && MG.stepHook();
    if (ev && ev.hatch) { hatchScene(ev); return; }
    if (ws.repel > 0) { ws.repel--; if (!ws.repel) E.toast('🧴 驱怪喷雾的效果消失了'); }
    const rate = slid ? 0 : PL.surf && isWater(PL.x, PL.y) ? .08 : EM.ENCOUNTER[t];
    if (rate && !(ws.repel > 0) && Math.random() < rate && MG.anyAlive()) encounter();
  }
  // 蛋孵出来了
  function hatchScene(ev) {
    const sp = MG.species(ev.sp), line = 'Hello, ' + sp.en + '! Welcome to the world!';
    talk([
      { who: '旁白', emo: '🥚', en: 'Oh? The egg is moving!', zh: '咦？蛋在动！' },
      { who: '旁白', emo: '🐣', en: 'Crack! A baby ' + sp.en + ' came out!', zh: '咔嚓！孵出了一只小 ' + sp.en + '（' + sp.zh + '）！', onShow: () => { const mon = MG.hatch(ev.hatch); E.SFX.win(); E.confetti(140); if (mon && mon.shiny) E.toast('✨ 是异色的！', 'gold'); hud(); } },
      { who: '{name}', look: playerLook(), g: E.S.player && E.S.player.gender === 'girl' ? 'f' : 'm', en: line, zh: '对刚出生的小怪兽打个招呼：', kind: 'speak', target: line },
    ], () => setTimeout(() => MG.nickSheet(ev.hatch, 'queue'), 200));
  }
  function spotTrainer() {
    for (const n of M.npcs) {
      if (n.role !== 'trainer' || beaten(n)) continue;
      if (Math.abs(n.x - PL.x) + Math.abs(n.y - PL.y) === 1 && n.face === faceTo(n, PL)) return n;
      const [dx, dy] = DIRS[n.face];
      for (let d = 1; d <= n.sight; d++) {
        const cx = n.x + dx * d, cy = n.y + dy * d;
        if (cx === PL.x && cy === PL.y) return n;
        if (!(EM.WALK.includes(tile(cx, cy)) || isWater(cx, cy)) || npcAt(cx, cy)) break;
      }
    }
    return null;
  }
  async function trainerSpotted(n) {
    busy = true;
    n.alert = performance.now();
    E.SFX.tap(); setTimeout(() => E.SFX.tap(), 120);
    await sleep(750);
    while (Math.abs(n.x - PL.x) + Math.abs(n.y - PL.y) > 1) {
      n.face = faceTo(n, PL);
      const [dx, dy] = DIRS[n.face];
      if (!(EM.WALK.includes(tile(n.x + dx, n.y + dy)) || isWater(n.x + dx, n.y + dy)) || (n.x + dx === FL.x && n.y + dy === FL.y && !(n.x + dx === PL.x && n.y + dy === PL.y))) break;
      n.x += dx; n.y += dy;
      await sleep(180);
    }
    n.face = faceTo(n, PL);
    PL.dir = faceTo(PL, n);
    busy = false;
    trainerTalk(n);
  }

  // ---------- 对话框 ----------
  // 台词里的 {name} {rival} 换成主角和对手的名字
  const pname = () => (E.S.player && E.S.player.name) || 'Trainer';
  const rivalInfo = () => (E.S.player && E.S.player.gender === 'girl') ? { name: 'Leo', g: 'm', look: LOOKS.leo } : { name: 'Mia', g: 'f', look: LOOKS.mia };
  const fill = v => typeof v === 'string' ? v.split('{name}').join(pname()).split('{rival}').join(rivalInfo().name) : v;
  function talk(pages, onDone) {
    pages.forEach(p => ['en', 'zh', 'target', 'who'].forEach(k => { p[k] = fill(p[k]); }));
    dlg = { pages, i: 0, onDone, tries: 0 }; showPage();
  }
  const page = () => dlg && dlg.pages[dlg.i];
  function showPage() {
    const pg = page(), box = $('w-dlg');
    if (!pg) { closeDlg(); return; }
    dlg.tries = 0; dlg.picked = false;
    const sr = E.speakMode() === 'sr', esc = E.esc, typing = !pg.kind && !!pg.en && !pg.hideEn;
    clearInterval(dlg.tw);
    const face = pg.look ? '<img class="d-face" src="' + portrait(pg.look) + '" alt="">' : '<span class="d-face emo">' + (pg.emo || '💬') + '</span>';
    let body = '<div class="d-name">' + esc(pg.who || '') + '</div><button class="spk mini d-hear" data-act="wHear" aria-label="再听一遍">' + E.SPK + '</button>' +
      '<div class="d-row">' + face + '<div class="d-text">' +
      (pg.en ? '<div class="d-en' + (pg.hideEn ? ' hid' : '') + '" id="d-en">' + (pg.hideEn ? '🔊 仔细听！（点右上角的喇叭再听一遍）' : typing ? '' : esc(pg.en)) + '</div>' : '') +
      (pg.zh ? '<div class="d-zh' + (typing ? ' wait' : '') + '" id="d-zh">' + esc(pg.zh) + '</div>' : '') + '</div></div>';
    if (pg.kind === 'speak') {
      body += '<div class="d-task"><div class="say-text" id="w-say">' + E.wordsHTML(pg.target) + '</div>' +
        (sr ? '<button class="mic" id="w-mic" data-act="wMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="w-hint">点麦克风，大声说出来</div><div class="heard" id="w-heard"></div>'
          : '<div class="mic-hint" id="w-hint">大声说出来，说完点「我说完了」</div><button class="btn leaf" data-act="wSelfDone">🎤 我说完了</button>') +
        '<button class="link" data-act="wSkip">先跳过</button></div>';
    } else if (pg.kind === 'answer') {
      body += '<div class="d-task">' + (pg.pic ? '<div class="say-emoji">' + pg.pic + '</div>' : '') + '<div class="opts list">' + pg.opts.map((o, k) => '<button class="opt en" data-act="wOpt" data-i="' + k + '"><span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div>' +
        (sr ? '<small class="tip">选一句正确的回答，<b>大声说出来</b>（点选项可以先听）</small><button class="mic" id="w-mic" data-act="wMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="w-hint"></div><div class="heard" id="w-heard"></div>'
          : '<small class="tip" id="w-hint">点出正确的回答，再大声说一遍</small>') +
        '<button class="link" data-act="wSkip">先跳过</button></div>';
    } else if (pg.kind === 'choice') {
      body += '<div class="d-task"><div class="d-choice">' + pg.opts.map((o, k) => '<button class="btn ' + (o.cls || 'ghost') + '" data-act="wPick" data-i="' + k + '">' + o.html + '</button>').join('') + '</div></div>';
    } else if (pg.kind === 'custom') body += '<div class="d-task" id="w-custom">' + pg.html + '</div>';
    else body += '<span class="d-next">▼</span>';
    box.innerHTML = body;
    if (pg.kind === 'custom' && pg.mount) pg.mount($('w-custom'), extra => { if (page() !== pg) return; insertPages(extra); pg.kind = null; nextPage(); });
    box.classList.toggle('task', !!pg.kind);
    box.hidden = false;
    if (typing) {
      // 英文一个字一个字打出来，按 A 可以直接显示全部
      let i = 0;
      dlg.typing = true;
      const el = $('d-en'), d = dlg;
      d.tw = setInterval(() => {
        i += 1;
        if (el) el.textContent = pg.en.slice(0, i);
        if (i >= pg.en.length) finishType(d);
      }, 26);
    }
    if (pg.onShow) pg.onShow();
    if (pg.en) E.say(pg.en, undefined, pg.g);
  }
  function finishType(d) {
    d = d || dlg;
    if (!d || !d.typing) return;
    clearInterval(d.tw); d.typing = false;
    const pg = d.pages[d.i], el = $('d-en'), zh = $('d-zh');
    if (el && pg) el.textContent = pg.en;
    if (zh) zh.classList.remove('wait');
  }
  function nextPage() {
    const pg = page();
    if (dlg && dlg.typing) { finishType(); return; }
    if (!pg || pg.kind) return;
    dlg.i++;
    if (dlg.i >= dlg.pages.length) closeDlg(); else showPage();
  }
  function closeDlg() {
    const d = dlg;
    if (d) clearInterval(d.tw);
    dlg = null;
    $('w-dlg').hidden = true;
    E.stopListening();
    if (d && d.onDone) d.onDone();
  }
  function insertPages(extra) { if (extra && extra.length) dlg.pages.splice(dlg.i + 1, 0, ...extra); }
  function passTask(score) {
    const pg = page();
    E.S.stats.spoken++; E.qProg('spoken', 1);
    if (score >= 85) { E.S.stats.perfect++; E.qProg('perfect', 1); }
    E.SFX.ok(3);
    insertPages(pg.pass ? pg.pass(score) : null);
    E.save();
    pg.kind = null;
    nextPage();
  }
  function failTask() {
    const pg = page();
    if (pg.q) E.addWrong(pg.q);
    insertPages(pg.fail ? pg.fail() : null);
    pg.kind = null;
    nextPage();
  }
  async function dlgMic() {
    const pg = page();
    if (!pg || !pg.kind) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const m = $('w-mic'), d = dlg;
    m.classList.add('on'); m.innerHTML = E.STOP;
    $('w-hint').textContent = '正在听……';
    const res = await E.recognize(x => { const h = $('w-heard'); if (h) h.textContent = x; });
    if (dlg !== d || page() !== pg) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) {
      E.RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') E.RT.noRec = true;
      E.toast('这里用不了语音识别，改成自己说、自己确认');
      showPage();
      return;
    }
    if (!res.alts.length) { $('w-hint').textContent = '没听清，大声一点再试一次'; return; }
    if (pg.kind === 'speak') {
      const r = E.bestScore(pg.target, res.alts);
      $('w-heard').textContent = '我听到：“' + r.heard + '”';
      document.querySelectorAll('#w-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
      if (r.score >= 55) { $('w-hint').innerHTML = '<b>' + r.score + ' 分</b> 说得好！'; setTimeout(() => { if (page() === pg) passTask(r.score); }, 700); }
      else { d.tries++; $('w-hint').textContent = r.score + ' 分，红色的词再读准一点' + (d.tries >= 2 ? '，也可以先跳过' : ''); }
    } else {
      const sc = pg.opts.map(o => E.bestScore(o.t, res.alts));
      let bi = 0; sc.forEach((s, k) => { if (s.score > sc[bi].score) bi = k; });
      $('w-heard').textContent = '我听到：“' + sc[bi].heard + '”';
      if (pg.opts[bi].c && sc[bi].score >= 45) { markOpts(bi); setTimeout(() => { if (page() === pg) passTask(sc[bi].score); }, 700); }
      else if (!pg.opts[bi].c && sc[bi].score >= 60) { markOpts(pg.opts.findIndex(o => o.c), bi); setTimeout(() => { if (page() === pg) failTask(); }, 900); }
      else { d.tries++; $('w-hint').textContent = '没对上任何一个回答，再说一次' + (d.tries >= 2 ? '，也可以先跳过' : ''); }
    }
  }
  function markOpts(ri, wi) { document.querySelectorAll('#w-dlg .opt').forEach((b, k) => b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim')); }
  function onOpt(i) {
    const pg = page();
    if (!pg || pg.kind !== 'answer') return;
    if (E.speakMode() === 'sr') { E.say(pg.opts[i].t); return; }
    if (dlg.picked) return;
    dlg.picked = true;
    if (pg.opts[i].c) {
      markOpts(i);
      E.say(pg.opts[i].t);
      $('w-hint').innerHTML = '选对了！大声说一遍，然后点 <button class="btn small leaf" data-act="wSelfDone">🎤 我说完了</button>';
    } else { markOpts(pg.opts.findIndex(o => o.c), i); setTimeout(() => { if (page() === pg) failTask(); }, 900); }
  }

  // ---------- 人物 / 告示牌 / 建筑 ----------
  const today = () => E.dayStr();
  const dailyDone = k => WS().daily[k] === today();
  const markDaily = k => { WS().daily[k] = today(); };
  // 面前一格（隔着柜台就再往前一格）有什么可以互动
  function facing() {
    const [dx, dy] = DIRS[PL.dir], tx = PL.x + dx, ty = PL.y + dy, t = tile(tx, ty);
    const n = npcAt(tx, ty) || (t === 'Q' ? npcAt(tx + dx, ty + dy) : null);
    if (n) return { n };
    if (tx === FL.x && ty === FL.y && !(FL.x === PL.x && FL.y === PL.y) && !PL.surf && MG.lead && MG.lead()) return { follower: true };
    const s = signAt(tx, ty);
    if (s) return { s };
    if (t === 'P') return { pc: true };
    if (t === 'n' || t === 'b' || t === 'O') return { obst: t, x: tx, y: ty };
    if (t === 'Z') return { statue: true, x: tx, y: ty };
    if (t === '|') return { gate: true, x: tx, y: ty };
    if ((t === '~' || t === 'D') && !PL.surf && (skillReady('surf') || MG.itemCount('rod') > 0)) return { water: true, x: tx, y: ty };
    if (t === 'w' && !PL.surf) return { falls: true, quiet: true };
    const hid = hiddenAt(tx, ty);
    if (hid) return { hidden: hid, quiet: true };
    const w = warpAt(tx, ty);
    if (w && !EM.WALK.includes(t) && PL.dir === 'up') return { w };
    return null;
  }
  function interact() {
    if (dlg) { nextPage(); return; }
    if (busy || PL.moving || !$('modal').hidden) return;
    const f = facing();
    if (!f || f.falls) {
      // 站在深水上：潜下去；在海底的光圈上：浮上去
      const here = tile(PL.x, PL.y);
      if (PL.surf && here === 'D') { const d = M.dives.find(q => q.x === PL.x && q.y === PL.y); if (d) useSkill('dive', () => goMap(d.to, d.arrive)); else talk([{ who: '旁白', emo: '🌊', en: 'The sea is very deep here.', zh: '这里的海很深。' }]); return; }
      if (here === 'U') { const u = M.surfaces.find(q => q.x === PL.x && q.y === PL.y); if (u) { talk([{ who: '旁白', emo: '🫧', en: 'Light is shining from above. Swim up?', zh: '上面有光照下来。要浮上去吗？', kind: 'choice', opts: [{ html: '🫧 浮上去 Swim up', cls: 'sun' }, { html: '先不' }], pick: i => { if (!i) setTimeout(() => goMap(u.to, u.arrive), 60); return []; } }]); } return; }
      if (f && f.falls) talk([{ who: '旁白', emo: '🌊', en: 'It is a big waterfall.', zh: '一道大瀑布。要先冲浪到瀑布下面。' }]);
      return;
    }
    if (f.n) { f.n.face = faceTo(f.n, PL); if (!story('talk', f.n)) npcTalk(f.n); }
    else if (f.s) signTalk(f.s);
    else if (f.follower) { E.SFX.tap(); MG.talkSheet(MG.lead().uid); }
    else if (f.pc) { E.SFX.tap(); E.say('Welcome to the monster box!'); MG.pcSheet(); }
    else if (f.statue) { if (!story('tile', f)) markTalk(f); }
    else if (f.gate) { if (!story('tile', f)) talk([{ who: '旁白', emo: '🚧', en: 'The gate is closed.', zh: '机关门关着。' }]); }
    else if (f.obst) obstacle(f);
    else if (f.water) waterMenu(f);
    else if (f.hidden) foundHidden(f.hidden);
    else if (f.w) goMap(f.w.to, f.w.arrive);
  }
  function markTalk(f) {
    const zs = []; for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.grid[y][x] === 'Z') zs.push(x + ',' + y);
    const mk = (M.def && M.def.marks || [])[zs.indexOf(f.x + ',' + f.y)];
    if (mk) talk((Array.isArray(mk[0]) ? mk : [mk]).map(([en, zh]) => ({ who: '旁白', emo: '🗿', en, zh })));
    else talk([{ who: '旁白', emo: '🗿', en: 'It is a big statue.', zh: '一座高大的雕像。' }]);
  }
  function signTalk(s) {
    if (s.en) { talk([].concat(s.more ? [[s.en, s.zh]].concat(s.more) : [[s.en, s.zh]]).map(([en, zh]) => ({ who: '告示牌', emo: '🪧', en, zh }))); return; }
    const w = E.W[M.z], nx = E.W[M.z + 1], town = w.en.replace(/[!?]/g, '') + ' Town', next = nx ? nx.en.replace(/[!?]/g, '') + ' Town' : '';
    const S = (en, zh) => ({ who: '告示牌', emo: '🪧', en, zh });
    const pages = {
      town: [S('Welcome to ' + town + '!', '欢迎来到' + w.name + '！')],
      tip: [S('Talk to everyone. They will teach you English!', '和每个人说说话，他们会教你英语！')],
      route: [S('Route ' + (M.z + 1) + '. North: ' + next + '.', (M.z + 1) + ' 号路。往北走是' + (nx ? nx.name : '') + '。'), S('Watch out! Wild monsters live in the tall grass.', '小心！草丛里住着野生怪兽。')],
      next: [S(next + ' is just ahead!', '前面就是' + (nx ? nx.name : '') + '了！')],
      cave: [S('Echo Cave. It is dark inside!', '回声洞。里面很黑，怪兽也更强！')],
    }[s.kind] || [S('Hello!', '你好！')];
    talk(pages);
  }
  function npcTalk(n) {
    const w = E.W[M.z], info = npcLook(n), g = info.g, name = info.name, z = M.z, dk = 'd:' + M.id + ':' + n.id;
    const P = (en, zh, extra) => Object.assign({ who: name, look: info.look, g, en, zh }, extra || {});
    const coins = (k, en, zh) => dailyDone(k) ? [P('Good job!', '说得真好！')] : (markDaily(k), E.S.coins += 10, E.renderTop(), [P(en, zh, { onShow: () => { E.SFX.coin(); E.toast('💰 金币 +10', 'gold'); } })]);
    const lines = arr => arr.map(q => Array.isArray(q) ? P(q[0], q[1]) : P(q.en, q.zh, q));
    if (n.give && !WS().flags['g:' + M.id + ':' + n.id]) {
      // 一次性送东西（秘传学习器、道具）
      const it = MG.ITEMS[n.give.item];
      talk(lines(n.give.say || [['Take this!', '这个送给你！']]).concat([
        P('You got ' + (it ? it.en : n.give.item) + '!', '得到了' + (it ? it.zh : n.give.item) + (n.give.n > 1 ? ' ×' + n.give.n : '') + '！', { onShow: () => { WS().flags['g:' + M.id + ':' + n.id] = 1; MG.addItem(n.give.item, n.give.n || 1); if (n.give.flag) WS().flags['s:' + n.give.flag] = 1; E.save(); hud(); E.SFX.win(); E.toast((it ? it.icon + ' ' + it.zh : n.give.item) + ' +' + (n.give.n || 1), 'gold'); } }),
      ]).concat(lines(n.give.after || [])));
      return;
    }
    if (n.role === 'daycare') {
      const gk = 'g:daygift';
      if (!WS().flags[gk]) {
        talk([P('Hello, dear! We are the daycare. We look after monsters.', '你好呀，孩子！我们开养育屋，帮大家照顾怪兽。'), P('Leave two monsters with us. If they get along, you may find an egg!', '把两只怪兽寄养在这里。它们相处得好的话，说不定会有蛋哦！'),
          P('Oh! This egg was in our garden this morning. Take it, please!', '哦！今天早上花园里出现了一个蛋，你带走吧！', { onShow: () => { WS().flags[gk] = 1; MG.giveEgg(n.egg || 'moonbunny'); E.save(); E.SFX.win(); E.toast('🥚 得到了一个蛋！放在队伍里走路就会孵出来', 'gold'); } }),
          P('Walk with it, and it will hatch.', '带着它多走走路，它就会孵出来。')], () => MG.daycareSheet());
      } else { E.say('Welcome back!', undefined, 'f'); MG.daycareSheet(); }
      return;
    }
    if (n.role === 'guard') {
      talk(n.say ? lines(n.say) : [P("Stop! You can't go north without this town's badge.", '站住！没有本镇的徽章不能往北走。'), P('Beat the gym leader first!', '先去道馆打败馆主吧！')]);
    } else if (n.role === 'ferry') {
      // 渡轮 / 船：带你去别的岛
      const ok = (n.badge == null || nBadges() >= n.badge) && (!n.need || WS().flags['s:' + n.need]);
      if (!ok) { talk(lines(n.no || [['Sorry, the boat is not ready yet.', '抱歉，船还不能开。']])); return; }
      talk(lines(n.say || [['All aboard! Do you want to go?', '上船啦！要出发吗？']]).concat([P(n.ask || 'Where do you want to go?', '要坐船去' + (n.toName || '对面的岛') + '吗？', { kind: 'choice', opts: [{ html: '⛴️ ' + (n.toName || '出发') + ' Let\'s go!', cls: 'sun' }, { html: '先不 Not now' }], pick: i => { if (!i) setTimeout(() => sail(n), 80); return []; } })]));
    } else if (n.say && n.role !== 'trainer') {
      const pg = lines(n.say);
      if (n.speak) pg.push(P('Can you say it?', '你能跟我说一遍吗？', { kind: 'speak', target: n.speak, pass: () => coins(dk, 'Good job! Here are 10 coins.', '说得真好！送你 10 个金币。') }));
      talk(pg);
    } else if (n.role === 'trainer') {
      if (beaten(n)) talk(n.after ? lines(n.after) : [P('You are really strong! Let me train more.', '你真厉害！我要再多练练。')]);
      else trainerTalk(n);
    } else if (n.role === 'nurse') {
      talk([
        P('Welcome to the Monster Center!', '欢迎来到怪兽中心！'),
        P('Let me heal your monsters.', '我来帮你的怪兽恢复体力。', { onShow: () => { MG.healAll(); WS().center = { map: M.id }; E.SFX.win(); E.save(); } }),
        P('Your monsters are fully healed. Good luck!', '怪兽们都恢复精神了，加油！'),
        P('You can use the computer to change your team.', '旁边的电脑可以把怪兽存进箱子、换队伍。'),
      ]);
    } else if (n.role === 'clerk') {
      E.say('Welcome! What would you like?', undefined, 'm');
      shopSheet();
    } else if (n.role === 'leader') {
      const b = w.boss, had = !!E.S.mon.badges[z];
      talk([P(b.hello, had ? '又来挑战我了？好，再比一场！' : '我是' + b.name + '！想拿本镇的徽章，就先打败我！', { emo: b.emoji })], () => battle('leader', {
        after: res => {
          if (res === 'win' && !had) talk([P('You beat me! Here is my badge.', '你赢了！这枚徽章给你。'), P('The road to the north is open now.', '现在北边的路已经为你打开了！')]);
        },
      }));
    } else if (n.role === 'quiz') {
      const k = Math.floor(Math.random() * w.dlgs.length), it = w.dlgs[k];
      const opts = [{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))].sort(() => Math.random() - .5);
      talk([
        P('Hello! Can you answer my question?', '你好！你能回答我的问题吗？' + (dailyDone(dk) ? '' : '答对了今天有礼物哦。')),
        P(it[0], '听一听，选出合适的回答，然后说出来。', {
          kind: 'answer', opts, q: { kind: 'dlg', w: z, i: k },
          pass: () => {
            if (dailyDone(dk)) return [P('Great answer! See you tomorrow.', '回答得真好！明天再来吧。')];
            markDaily(dk); E.S.mon.balls += 1; hud();
            return [P('Perfect! Here is an Echo Ball for you.', '太棒了！送你一个回声球。', { onShow: () => { E.SFX.coin(); E.toast('🔮 回声球 +1', 'gold'); } })];
          },
          fail: () => [P('Hmm, not quite. You can say: "' + it[1] + '"', '差一点。可以这样回答：“' + it[1] + '”')],
        }),
      ]);
    } else if (n.role === 'gift') {
      // 看图说单词，答对每天送一瓶药水
      const k = (n.seed + new Date().getDate()) % w.words.length, it = w.words[k];
      const others = w.words.filter((x, j) => j !== k).sort(() => Math.random() - .5).slice(0, 2);
      const opts = [{ c: true, t: it[0] }, ...others.map(o => ({ t: o[0] }))].sort(() => Math.random() - .5);
      talk([
        P('Hi! What is this in English?', '你好！这个用英语怎么说？（' + it[1] + '）', {
          kind: 'answer', opts, pic: it[2], q: { kind: 'word', w: z, i: k },
          pass: () => {
            if (dailyDone(dk)) return [P('Yes! You know it well.', '对！你记得真牢。')];
            markDaily(dk); MG.addItem('potion', 1);
            return [P('Right! Take this potion.', '答对了！这瓶药水送给你。', { onShow: () => { E.SFX.coin(); E.toast('🧪 药水 +1', 'gold'); } })];
          },
          fail: () => [P('It is "' + it[0] + '". Say it again next time!', '它叫 “' + it[0] + '”。下次再来说说看！')],
        }),
      ]);
    } else if (n.role === 'hiker') {
      const tips = [
        ['You can jump down a ledge, but you cannot climb up.', '台阶只能往下跳，不能往上爬哦。'],
        ['Use a repel, and weak monsters will stay away.', '用驱怪喷雾，草丛里的怪兽就不会来打扰你。'],
        ['Caves are dark. The monsters there are stronger.', '洞穴里很黑，里面的怪兽更强。'],
        ['Your team can have six monsters.', '你的队伍最多可以带六只怪兽。'],
      ];
      const t = tips[(M.z + n.seed) % tips.length];
      talk([P('Hello, young trainer!', '你好呀，小训练师！'), P(t[0], t[1]), P('Can you say it?', '你能跟我说一遍吗？', { kind: 'speak', target: t[0], pass: () => coins(dk, 'Well done! Here are 10 coins.', '说得真好！送你 10 个金币。') })]);
    } else if (M.kind === 'town' && z === 0 && n.id === '1') {
      talk([
        P('Hello again, {name}! How is your monster?', '又见面了，{name}！你的怪兽还好吗？'),
        P('Monsters on these islands understand English.', '这些岛上的怪兽都听得懂英语。'),
        P('Speak clearly, and your monsters will be strong!', '英语说得越清楚，你的怪兽就越强！'),
        P('Wild monsters live in the tall grass on the road north.', '北边的路上有草丛，里面住着野生怪兽。'),
        P('Beat the gym leader, and the guard will let you go north.', '打败道馆馆主，守卫就会让你往北走。'),
        P('Now, can you say this to me?', '现在，你能对我说这句话吗？', {
          kind: 'speak', target: 'Nice to meet you, Professor!',
          pass: () => coins(dk, 'Very good! Here are 10 coins.', '说得很好！送你 10 个金币。'),
        }),
      ]);
    } else {
      const s1 = w.sents[(n.seed + z) % w.sents.length], s2 = w.sents[(n.seed + z + 3) % w.sents.length];
      talk([
        P('Hi there!', '你好呀！'),
        P(s1[0], s1[1]),
        P(s2[0], s2[1]),
        P('Can you say it?', '你能跟我说一遍吗？', {
          kind: 'speak', target: s2[0], q: { kind: 'sent', w: z, i: w.sents.indexOf(s2) },
          pass: () => coins(dk, 'Good job! Here are 10 coins.', '说得真好！送你 10 个金币。'),
        }),
      ]);
    }
  }
  async function sail(n) {
    busy = true;
    const v = $('w-view'); v.classList.add('fade');
    E.SFX.tap();
    await sleep(500);
    E.toast('⛴️ 船开了……', 'gold');
    await sleep(900);
    busy = false;
    v.classList.remove('fade');
    goMap(n.to, n.how || null);
  }
  function trainerTalk(n) {
    const t = trainerInfo(n), z = M.z, lv = MG.zoneLv(z) + (M.lvBonus || 0);
    const lines = [["Hi! I'm " + t.name + ". Let's have a monster battle!", '你好！我是 ' + t.name + '，我们来一场怪兽对战吧！'],
      ['Our eyes met! Now we must battle!', '我们的眼神对上了！那就来对战吧！'],
      ['I trained here every day. Are you ready?', '我每天都在这里训练。你准备好了吗？']];
    const ln = n.lines || [lines[n.seed % lines.length]];
    talk(ln.map(q => ({ who: t.name, look: t.look, g: t.g, en: q[0], zh: q[1] })), () => {
      const two = n.seed % 2 === 1 && M.kind !== 'inside', k = n.n || (two ? 2 : 1), tl = lv + (n.lv || 0) + (k > 1 ? 0 : 1);
      battle('trainer', {
        foes: n.team ? n.team.map(([sp, l]) => MG.newMon(MG.grown(sp, tl + (l || 0)), tl + (l || 0))) : n.types ? MG.teamOf(n.types, k, tl, M.id + n.id) : MG.trainerFoes(z, n.seed, k, tl),
        trainer: { name: t.name, img: portrait(t.look) },
        after: res => {
          // 走过来对战的训练师打完回到原来的位置，不会堵住路
          if (n.ox != null && (n.x !== n.ox || n.y !== n.oy)) { n.x = n.ox; n.y = n.oy; n.face = n.home; }
          if (res === 'win') { WS().flags[trainerKey(n)] = 1; E.save(); talk([{ who: t.name, look: t.look, g: t.g, en: (n.win || ['Wow, you are really strong!'])[0], zh: (n.win || [0, '哇，你真的很厉害！'])[1] }]); }
        },
      });
    });
  }
  function pickup(p) {
    WS().flags[pickKey(p)] = 1;
    const id = pickType(p), it = MG.ITEMS[id];
    MG.addItem(id, 1);
    E.save(); hud(); E.SFX.coin();
    talk([{ who: '旁白', emo: it.icon, en: 'You found ' + (/^[aeiou]/i.test(it.en) ? 'an ' : 'a ') + it.en + '!', zh: '你捡到了' + it.zh + '！' }]);
  }
  // 商店：越往后的小镇卖的东西越多
  function shopStock() {
    const z = M.z, list = [['ball', 3], ['potion', 1]];
    if (z >= 1) list.push(['repel', 1], ['antidote', 1], ['paraheal', 1], ['awakening', 1]);
    if (z >= 2) list.push(['burnheal', 1], ['iceheal', 1]);
    if (z >= 5) list.push(['fullheal', 1]);
    if (z >= 2) list.push(['superball', 1], ['rope', 1]);
    if (z >= 3) list.push(['superpotion', 1]);
    if (z >= 4) list.push(['revive', 1]);
    if (z >= 5) list.push(['leafstone', 1], ['firestone', 1], ['waterstone', 1], ['thunderstone', 1]);
    if (z >= 8) list.push(['moonstone', 1], ['sunstone', 1], ['icestone', 1]);
    list.push(['rod', 1]);
    if (z >= 1) list.push(['bike', 1]);
    if (z >= 2) list.push(['dowsing', 1]);
    return list;
  }
  function shopSheet() {
    E.openModal('<div class="big">🏪</div><h2>小镇商店</h2><p>你有 <b>' + E.S.coins + '</b> 金币</p>' +
      shopStock().map(([id, n], i) => {
        const it = MG.ITEMS[id], price = it.price * n, owned = it.key && MG.itemCount(id) > 0;
        return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + it.zh + (n > 1 ? ' ×' + n : '') + '</b><small>' + it.desc + ' · ' + it.en + (it.key ? '' : ' · 有 ' + MG.itemCount(id)) + '</small></div>' +
          '<button class="btn small sun" data-act="wBuy" data-i="' + i + '"' + (owned || E.S.coins < price ? ' disabled' : '') + '>' + (owned ? '已有' : price + ' 金币') + '</button></div>';
      }).join('') +
      '<button class="btn ghost wide" data-act="close">Thank you! 谢谢</button>');
  }

  // ---------- 野外技能：拿到徽章解锁，队伍里要有合适属性的怪兽，用的时候要对它说英语指令 ----------
  // 仿绿宝石：秘传学习器（hm）是剧情里的人送的，还要有足够的徽章才能在野外用
  const SKILLS = {
    cut: { zh: '居合斩', en: 'Cut', icon: '🌿', badge: 3, hm: 'hm_cut', types: ['grass', 'bug', 'steel', 'normal', 'fight', 'dark', 'dragon', 'ground'], say: n => n + ', cut the tree!', what: '砍掉挡路的小树', who: '温馨家庭岛的树医生' },
    flash: { zh: '闪光', en: 'Flash', icon: '💡', badge: 2, hm: 'hm_flash', types: ['spark', 'psychic', 'fire'], say: n => n + ', light up the cave!', what: '照亮漆黑的洞穴', who: '回声洞里的登山家' },
    smash: { zh: '碎岩', en: 'Rock Smash', icon: '🪨', badge: 4, hm: 'hm_smash', types: ['fight', 'rock', 'ground', 'steel', 'normal', 'dragon'], say: n => n + ', smash the rock!', what: '打碎有裂缝的岩石', who: '校园岛的矿工' },
    strength: { zh: '怪力', en: 'Strength', icon: '💪', badge: 6, hm: 'hm_strength', types: ['fight', 'rock', 'ground', 'normal', 'steel', 'dragon', 'water'], say: n => n + ', push the rock!', what: '推动大石头', who: '社团岛的大力士' },
    surf: { zh: '冲浪', en: 'Surf', icon: '🌊', badge: 8, hm: 'hm_surf', types: ['water', 'ice', 'dragon'], say: n => n + ", let's surf!", what: '在水上前进', who: '爸爸（生日派对岛）' },
    fly: { zh: '飞空', en: 'Fly', icon: '🕊️', badge: 9, hm: 'hm_fly', types: ['flying', 'dragon'], say: n => n + ', fly me there!', what: '飞回去过的小岛', who: '小凯（动物岛）' },
    dive: { zh: '潜水', en: 'Dive', icon: '🤿', badge: 10, hm: 'hm_dive', types: ['water', 'dragon'], say: n => n + ', dive down!', what: '在深水（深蓝色）上潜到海底', who: '导师欧瑞（规则城）' },
    falls: { zh: '攀瀑', en: 'Waterfall', icon: '🏞️', badge: 12, hm: 'hm_falls', types: ['water', 'dragon'], say: n => n + ', climb the waterfall!', what: '冲浪时爬上瀑布', who: '天气岛的气象台台长' },
  };
  const skillMon = k => E.S.mon.team.map(u => E.S.mon.box.find(m => m.uid === u)).filter(m => m && !m.egg).find(m => MG.species(m.sp).types.some(t => SKILLS[k].types.includes(t)));
  const hasHM = k => E.S.settings.unlockAll || MG.itemCount(SKILLS[k].hm) > 0;
  const skillOpen = k => E.S.settings.unlockAll || (hasHM(k) && nBadges() >= SKILLS[k].badge);
  const skillReady = k => skillOpen(k) && !!skillMon(k);
  // 用技能：说对指令才会生效
  function useSkill(k, then) {
    const S = SKILLS[k], nar = (en, zh) => ({ who: '旁白', emo: S.icon, en, zh });
    if (!hasHM(k)) { talk([nar('Maybe a monster could help here...', '也许怪兽能帮上忙……（要先拿到「' + S.zh + '」的秘传学习器）')]); return; }
    if (!skillOpen(k)) { talk([nar('You need more badges to use ' + S.en + '.', '要用「' + S.zh + '」' + S.what + '，需要 ' + S.badge + ' 枚徽章。')]); return; }
    const mon = skillMon(k);
    if (!mon) { talk([nar('None of your monsters can use ' + S.en + '.', '队伍里要有' + S.types.map(t => DEX.TYPES[t].zh).join('、') + '系的怪兽，才能用「' + S.zh + '」。')]); return; }
    const name = MG.nm(mon);
    talk([{ who: '{name}', look: playerLook(), g: E.S.player && E.S.player.gender === 'girl' ? 'f' : 'm', en: S.say(name), zh: '用「' + S.zh + '」：大声对 ' + name + ' 说出来！', kind: 'speak', target: S.say(name), pass: () => { E.S.stats.spoken = (E.S.stats.spoken || 0); then(mon); return []; } }]);
  }
  function obstacle(f) {
    if (f.obst === 'n') useSkill('cut', mon => { M._cleared.add(f.x + ',' + f.y); E.SFX.hit(); E.toast('🌿 ' + MG.species(mon.sp).en + ' 砍掉了小树！', 'gold'); if (R && R.fx) R.fx('cut', f.x, f.y); });
    else if (f.obst === 'b') useSkill('smash', mon => { M._cleared.add(f.x + ',' + f.y); E.SFX.hit(); E.toast('🪨 ' + MG.species(mon.sp).en + ' 打碎了岩石！', 'gold'); if (R && R.fx) R.fx('smash', f.x, f.y); });
    else if (f.obst === 'O') {
      if (M._strength) { talk([{ who: '旁白', emo: '💪', en: 'Walk into the rock to push it.', zh: '朝大石头走过去，就能把它推开。' }]); return; }
      useSkill('strength', mon => { M._strength = true; E.toast('💪 ' + MG.species(mon.sp).en + ' 可以推动大石头了！', 'gold'); });
    }
  }
  // 面对水：冲浪或者钓鱼
  function waterMenu(f) {
    const canSurf = skillReady('surf'), rod = MG.itemCount('rod') > 0;
    const surf = () => useSkill('surf', () => { PL.surf = true; PL.bike = false; step(f.x, f.y, STEP_MS, false); hud(); });
    if (canSurf && rod) talk([{ who: '旁白', emo: '🌊', en: 'The water is calm. What do you want to do?', zh: '水面很平静。要做什么？', kind: 'choice', opts: [{ html: '🌊 冲浪', cls: 'sun' }, { html: '🎣 钓鱼' }], pick: i => { setTimeout(i ? fish : surf, 50); return []; } }]);
    else if (canSurf) surf();
    else if (rod) fish();
  }
  // 钓鱼：等浮标动了，听鱼说的英语，选出意思才能拉上来
  function fish() {
    const w = E.W[M.z], k = Math.floor(Math.random() * w.words.length), it = w.words[k];
    const others = w.words.filter((x, j) => j !== k && x[1] !== it[1]).sort(() => Math.random() - .5).slice(0, 2);
    const opts = [{ c: true, t: it[1], e: it[2] }, ...others.map(o => ({ t: o[1], e: o[2] }))].sort(() => Math.random() - .5);
    let hooked = false;
    talk([{
      who: '旁白', emo: '🎣', en: 'You cast your line...', zh: '甩出鱼线……', kind: 'custom',
      html: '<div class="fish"><div class="fish-water"><span class="bobber" id="fish-bob"></span></div><p class="fish-q" id="fish-q">静静等着，浮标一动就注意听！</p><div class="opts" id="fish-opts"></div><div class="b-timer" id="fish-bar" hidden><i id="fish-t"></i></div></div>',
      mount: (el, done) => {
        const wait = 1400 + Math.random() * 2600;
        setTimeout(() => {
          const bob = document.getElementById('fish-bob'); if (!bob) return;
          bob.classList.add('bite'); E.SFX.tap();
          document.getElementById('fish-q').innerHTML = '<b>咬钩了！</b>它说了一个词，是什么意思？';
          E.say(it[0]);
          const box = document.getElementById('fish-opts');
          box.innerHTML = opts.map((o, i) => '<button class="opt" data-i="' + i + '"><span class="o-e">' + o.e + '</span><span class="o-t">' + E.esc(o.t) + '</span></button>').join('') + '<button class="spk mini" id="fish-hear" aria-label="再听一遍">' + E.SPK + '</button>';
          const bar = document.getElementById('fish-bar'), t = document.getElementById('fish-t');
          bar.hidden = false; t.style.transition = 'none'; t.style.width = '100%'; void t.offsetWidth; t.style.transition = 'width 7s linear'; t.style.width = '0%';
          const timer = setTimeout(() => finish(-1), 7000);
          const finish = i => {
            clearTimeout(timer);
            const ok = i >= 0 && opts[i].c;
            box.querySelectorAll('.opt').forEach((b, j) => b.classList.add(opts[j].c ? 'right' : j === i ? 'wrong' : 'dim'));
            hooked = ok;
            if (ok) { E.SFX.ok(2); E.S.stats.listen = (E.S.stats.listen || 0) + 1; E.qProg('listen', 1); } else { E.SFX.bad(); E.addWrong({ kind: 'word', w: M.z, i: k }); }
            setTimeout(() => done([{ who: '旁白', emo: ok ? '🐟' : '💨', en: ok ? 'You hooked a monster!' : 'It got away...', zh: ok ? '钓上来了！是一只怪兽！' : '鱼跑掉了……它说的是 ' + it[0] + ' = ' + it[1] }]), 700);
          };
          box.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('#fish-hear')) { E.say(it[0], .8); return; } const b = e.target.closest('.opt'); if (b && !b.classList.contains('dim') && !b.classList.contains('right')) finish(+b.dataset.i); });
        }, wait);
      },
    }], () => { if (hooked && MG.anyAlive()) battle('wild', { hab: 'water', lvBonus: (M.lvBonus || 0) + 1 }); });
  }
  // 藏起来的道具：对着它按 A 才能找到；有寻宝器会一闪一闪
  const HIDDEN_PICKS = ['superpotion', 'superball', 'revive', 'fullheal', 'leafstone', 'firestone', 'waterstone', 'thunderstone', 'moonstone', 'sunstone', 'icestone', 'superball'];
  function foundHidden(h) {
    WS().flags[hiddenKey(h)] = 1;
    const id = h.item || HIDDEN_PICKS[(h.x * 5 + h.y * 11 + M.z * 3) % (M.z < 4 ? 4 : HIDDEN_PICKS.length)], it = MG.ITEMS[id];
    MG.addItem(id, 1);
    E.save(); E.SFX.coin();
    talk([{ who: '旁白', emo: '✨', en: 'You found a hidden ' + it.en + '!', zh: '你发现了藏起来的' + it.zh + '！' }]);
  }
  function skillsSheet() {
    E.openModal('<h2>🌟 野外技能</h2><p>先从剧情里的人手上拿到秘传学习器，再拿够徽章才能用。队伍里要有合适属性的怪兽，用的时候要大声对它说英语指令。</p>' +
      Object.entries(SKILLS).map(([k, S]) => {
        const open = skillOpen(k), mon = skillMon(k);
        if (!hasHM(k)) return '<div class="ach locked"><span class="ae">' + S.icon + '</span><div style="flex:1"><b>' + S.zh + ' ' + S.en + '</b><small>' + S.what + ' · 还没拿到秘传学习器（' + S.who + '）</small></div><span class="lvchip">🔒</span></div>';
        const btn = k === 'flash' ? '<button class="btn small sun" data-act="wUseSkill" data-k="flash"' + (open && mon && M.dark && !M._flash ? '' : ' disabled') + '>用</button>'
          : k === 'fly' ? '<button class="btn small sun" data-act="wUseSkill" data-k="fly"' + (open && mon && M.kind !== 'inside' ? '' : ' disabled') + '>用</button>'
            : k === 'dive' ? '<small class="tip">冲浪到深水上按 A</small>' : k === 'falls' ? '<small class="tip">冲浪时往瀑布上走</small>' : '<small class="tip">对着障碍按 A</small>';
        return '<div class="ach' + (open ? '' : ' locked') + '"><span class="ae">' + S.icon + '</span><div style="flex:1"><b>' + S.zh + ' ' + S.en + '</b><small>' + S.what + ' · ' + (open ? (mon ? '由 ' + MG.species(mon.sp).en + ' 来用' : '需要 ' + S.types.slice(0, 3).map(t => DEX.TYPES[t].zh).join('/') + ' 系怪兽') : '需要 ' + S.badge + ' 枚徽章') + '</small></div>' + (open ? btn : '<span class="lvchip">🔒</span>') + '</div>';
      }).join('') + '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function flyTo(z) {
    E.closeModal();
    goMap('t' + z, 'door:C');
  }

  // ---------- 战斗 ----------
  function encounter() { battle('wild', { lvBonus: M.lvBonus || 0, hab: PL.surf || M.kind === 'under' ? 'water' : M.hab || (M.kind === 'cave' ? 'cave' : 'grass') }); }
  async function battle(kind, o) {
    busy = true;
    held = null;
    const wp = $('w-wipe'); wp.classList.remove('on'); void wp.offsetWidth; wp.classList.add('on');
    E.SFX.hit();
    await sleep(820);
    stopLoop();
    const ok = MG.battle(kind, M.z, {
      foes: o.foes, trainer: o.trainer, lvBonus: o.lvBonus, noCatch: o.noCatch, hab: o.hab || M.hab || (M.kind === 'cave' ? 'cave' : 'grass'), arena: M.arena || M.theme, rules: o.rules,
      onEnd: res => {
        E.show('world');
        wp.classList.remove('on');
        resize(); hud();
        startLoop();
        busy = false;
        if (res === 'lose' && !o.noWhiteout) { whiteout(); if (o.after && o.fromStory) o.after('lose'); }
        else if (o.after) o.after(res);
      },
    });
    if (!ok) { wp.classList.remove('on'); startLoop(); busy = false; if (o.after) o.after('none'); }
  }
  function whiteout() {
    MG.healAll();
    const c = WS().center;
    loadMap(c && c.map && EM.get(c.map) ? c.map : EM.get('i' + M.z + 'C') ? 'i' + M.z + 'C' : 'i0C', 'nurse');
    talk([
      { who: '旁白', emo: '💤', en: 'Your monsters are tired. You hurried to the Monster Center.', zh: '你的怪兽都累倒了……你赶快跑回了怪兽中心。' },
      { who: 'Nurse Amy', look: LOOKS.nurse, g: 'f', en: "Your monsters are healed now. Don't give up!", zh: '怪兽们已经恢复了，别灰心，再去试试吧！' },
    ]);
  }

  // ---------- 剧情（脚本在 story.js） ----------
  let overlay = null;   // 剧情里的全屏画面（比如选伙伴）接管方向键和 A/B 键
  // hook：enter 进地图 / step 走了一步 / talk 和人说话。story.js 返回一段剧情（async 函数）就播放它
  function story(hook, arg) {
    const ST = window.EchoStory, scene = ST && ST[hook] && ST[hook](SC, arg);
    if (!scene) return false;
    busy = true; held = null;
    Promise.resolve().then(scene).catch(e => console.error(e)).then(() => { busy = false; overlay = null; PL.scripted = false; hud(); });
    return true;
  }
  const SC = {
    get E() { return E; }, get MG() { return MG; }, get map() { return M; }, pl: PL, fl: FL, get LOOKS() { return LOOKS; }, pname, rivalInfo, portrait: l => portrait(l), plook: () => playerLook(),
    flag: k => !!WS().flags['s:' + k],
    set: k => { WS().flags['s:' + k] = 1; E.save(); },
    talk: pages => new Promise(r => talk(pages, r)),
    wait: sleep,
    npc: pred => M.npcs.find(pred),
    // 临时人物：离开地图就消失。look/name 自定义造型；mon 是怪兽编号（画成怪兽）
    spawn: spec => { const n = Object.assign({ id: 'tmp' + Math.random().toString(36).slice(2, 7), face: 'down', seed: 0, sight: 0, role: 'story', temp: true }, spec); n.home = n.face; M.npcs.push(n); return n; },
    remove: n => { M.npcs = M.npcs.filter(q => q !== n); },
    walk: async (n, dir, steps, ms) => { const [dx, dy] = DIRS[dir]; for (let i = 0; i < steps; i++) { n.face = dir; n.x += dx; n.y += dy; await sleep(ms || 200); } },
    walkPlayer: async (dir, steps) => {
      PL.scripted = true;
      const [dx, dy] = DIRS[dir];
      for (let i = 0; i < steps; i++) { PL.dir = dir; step(PL.x + dx, PL.y + dy, STEP_MS, false); await sleep(STEP_MS + 30); }
      PL.scripted = false;
    },
    face: (n, dir) => { n.face = dir; },
    facePlayer: dir => { PL.dir = dir; },
    faceEach: n => { n.face = faceTo(n, PL); PL.dir = faceTo(PL, n); },
    alert: async n => { n.alert = performance.now(); E.SFX.tap(); await sleep(800); },
    battle: (kind, o) => new Promise(res => battle(kind, Object.assign({}, o, { fromStory: true, after: r => { busy = true; res(r); } }))),
    scene: () => $('w-scene'),
    setOverlay: fn => { overlay = fn; },
    // 画面上方的小提示条（道馆机关用：现在要踩什么颜色、红灯绿灯……）
    // 整个画面加滤镜（颜色被偷走的岛：grayscale(1)）；换地图会自动清掉
    filter: css => { $('w-view').querySelectorAll('canvas').forEach(c => { c.style.filter = css || ''; }); },
    note: html => { const n = $('w-note'); if (!n) return; if (!html) { n.hidden = true; return; } n.innerHTML = html; n.hidden = false; },
    setOver: (x, y, ch) => { if (M.over && M.over[y]) M.over[y][x] = ch; },
    over: (x, y) => (M.over && M.over[y] && M.over[y][x]) || '',
    goMap: (id, how) => goMap(id, how),
    hud: () => hud(),
    // 机关门：open(i 或 'all', keep 存档记住)；closed(i)
    openGate: (i, keep) => { (M.gates || []).forEach(g => { if (i === 'all' || g.i === i) { M._open.add(g.x + ',' + g.y); if (keep) WS().flags['gate:' + M.id + ':' + g.i] = 1; } }); E.SFX.ok(2); E.save(); },
    closeGate: i => { (M.gates || []).forEach(g => { if (i === 'all' || g.i === i) { M._open.delete(g.x + ',' + g.y); delete WS().flags['gate:' + M.id + ':' + g.i]; } }); E.save(); },
    gateOpen: i => { const g = (M.gates || [])[i]; return !!g && M._open.has(g.x + ',' + g.y); },
    teleport: (x, y, dir) => { PL.x = PL.fx = x; PL.y = PL.fy = y; PL.moving = false; if (dir) PL.dir = dir; FL.x = FL.fx = x; FL.y = FL.fy = y; savePos(); },
    refresh: () => { if (R) R.load(M, api3d); },
    tile: (x, y) => tile(x, y),
    skillReady: k => skillReady(k),
    hasHM: k => hasHM(k),
    give: (item, n) => { MG.addItem(item, n || 1); E.save(); hud(); const it = MG.ITEMS[item]; E.SFX.win(); E.toast((it ? it.icon + ' ' + it.zh : item) + ' +' + (n || 1), 'gold'); },
    badges: () => nBadges(),
    daily: (k, fn) => { if (dailyDone(k)) return false; markDaily(k); fn && fn(); E.save(); return true; },
    flags: () => WS().flags,
    say: (t, g) => E.say(t, undefined, g),
  };

  // ---------- 渲染器 ----------
  // 画质：auto 自动 / high 精美 / mid 标准 / low 省电 / 2d 流畅模式
  function gfxTier() {
    const st = E.S.settings, g = st.gfx || 'auto';
    if (g !== 'auto') return g;
    return st.gfxAuto || 'mid';
  }
  function ensureRenderer() {
    const tier = gfxTier();
    if (R && R.tier === tier) return;
    if (R) { R.destroy(); R = null; }
    const view = $('w-view');
    if (tier !== '2d' && window.EchoWorld3D) {
      try { R = EchoWorld3D.create(view, tier, ART); } catch (e) { R = null; }
      if (!R) { E.toast('这台设备不支持 3D，已切换成流畅模式'); }
    }
    if (!R) R = create2D(view);
    R.tier = R.kind === '2d' ? '2d' : tier;
    perf.n = 0; perf.sum = 0; perf.t0 = 0;
  }
  // 自动画质：进地图后量 3 秒帧率，太慢就降一档
  // 超过 250ms 的帧（页面在后台、被系统限流、正在切地图）不算；有效帧太少就过一会儿重新量
  const perf = { n: 0, sum: 0, t0: 0 };
  function autoTune(now, dt) {
    const st = E.S.settings;
    if ((st.gfx || 'auto') !== 'auto' || !R || R.kind === '2d' || busy || dlg || document.hidden) return;
    if (!perf.t0) { perf.t0 = now; return; }
    // 偶尔一帧很慢（切到后台、切地图）不算；可是一直很慢（连续 12 帧都超过 250ms）就是设备太慢
    if (dt > 250) { perf.slow = (perf.slow || 0) + 1; if (perf.slow < 12 || now - perf.t0 < 1200) return; perf.n = 20; perf.sum = 20 * dt; perf.slow = 0; }
    else { perf.slow = 0; if (now - perf.t0 < 1200) return; }
    perf.n++; perf.sum += dt;
    if (perf.n < 150 && now - perf.t0 < 4500) return;
    if (perf.n < 20) { perf.n = 0; perf.sum = 0; perf.t0 = now; return; }
    const avg = perf.sum / perf.n;
    perf.n = 0; perf.sum = 0; perf.t0 = now + 1e9;
    // 精美 > 20ms（不到 50 帧）降到标准；标准 > 24ms（不到 42 帧）降到省电；省电 > 45ms（不到 22 帧）才换 2D
    const cur = R.tier, next = cur === 'high' ? (avg > 20 ? 'mid' : null) : cur === 'mid' ? (avg > 24 ? 'low' : null) : (avg > 45 ? '2d' : null);
    if (!next) { st.gfxAuto = cur; E.save(); return; }
    st.gfxAuto = next; E.save();
    ensureRenderer(); R.load(M, api3d); resize();
    if (next === '2d') E.toast('这台手机跑 3D 有点吃力，已切换成流畅模式（可以在设置里改）');
  }
  function resize() { if (R) R.resize(); }
  function startLoop() { if (running) return; running = true; lastNow = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; cancelAnimationFrame(raf); held = null; }
  function frame(now) {
    if (!running) return;
    const dt = lastNow ? now - lastNow : 16; lastNow = now;
    if (PL.moving && now - PL.t0 >= PL.dur) { PL.moving = false; PL.jump = false; PL.fx = PL.x; PL.fy = PL.y; FL.fx = FL.x; FL.fy = FL.y; onStep(); }
    if (!PL.moving && held && !dlg && !busy) tryMove(held);
    // 镇上的人会时不时转头看看四周
    M.npcs.forEach(n => {
      if (n.temp || n.role === 'trainer' || n.role === 'guard' || n.role === 'nurse' || n.role === 'clerk' || n.role === 'leader') return;
      if (!n.nextTurn) n.nextTurn = now + 1500 + Math.random() * 3000;
      if (now > n.nextTurn && !dlg) { n.face = ['up', 'down', 'left', 'right', 'down'][Math.floor(Math.random() * 5)]; n.nextTurn = now + 2000 + Math.random() * 3500; }
    });
    R.draw(now, view(now));
    autoTune(now, dt);
    raf = requestAnimationFrame(frame);
  }
  // 给渲染器的一帧画面信息
  function view(now) {
    const prog = PL.moving ? Math.min(1, (now - PL.t0) / PL.dur) : 1;
    const hop = PL.jump ? Math.sin(prog * Math.PI) * .55 : 0;
    const f = !dlg && !PL.moving && !busy ? facing() : null;
    let hint = null;
    if (f) {
      const [dx, dy] = DIRS[PL.dir];
      if (!f.quiet) hint = f.n ? { x: f.n.x, y: f.n.y } : { x: PL.x + dx, y: PL.y + dy };
    }
    const lead = MG.leadSpecies();
    return {
      now, map: M, plook: playerLook(),
      px: PL.fx + (PL.x - PL.fx) * prog, py: PL.fy + (PL.y - PL.fy) * prog, hop, pdir: PL.dir, pmoving: PL.moving,
      fx: FL.fx + (FL.x - FL.fx) * prog, fy: FL.fy + (FL.y - FL.fy) * prog, fhop: Math.abs(FL.y - FL.fy) + Math.abs(FL.x - FL.fx) > 1 ? Math.sin(prog * Math.PI) * .5 : 0,
      showF: !(FL.x === PL.x && FL.y === PL.y) && !!lead, lead,
      inGrass: !PL.moving && tile(PL.x, PL.y) === ',', fInGrass: !PL.moving && tile(FL.x, FL.y) === ',',
      npcs: M.npcs.filter(npcVisible).map(n => ({ n, look: n.mon ? null : npcLook(n).look, mon: n.mon ? MG.species(n.mon) : null, x: n.x, y: n.y, face: n.face, alert: n.alert && now - n.alert < 1100 })),
      picks: M.picks.filter(p => !WS().flags[pickKey(p)]),
      hint,
      obst: [...(M._bould || []).map((b, i) => ({ k: 'O', id: 'O' + i, x: b.x, y: b.y }))],
      cleared: M._cleared, surf: !!PL.surf, bike: !!PL.bike && !PL.surf, flash: M.dark ? !!M._flash : true, dark: !!M.dark,
      open: M._open,
      sparkles: MG.itemCount('dowsing') > 0 && E.S.mon.dowseOn !== false ? (M.hidden || []).filter(h => !WS().flags[hiddenKey(h)]) : [],
    };
  }

  // ---------- 小工具（2D 和 3D 共用） ----------
  function hsh(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s | 0) * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  }
  function rr(g, x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b);
    g.lineTo(x + w, y + h - c); g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d);
    g.lineTo(x, y + a); g.quadraticCurveTo(x, y, x + a, y); g.closePath();
  }
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); };
  const OUT = 'rgba(32,38,50,.78)';

  // 地面图层：草地、小路、沙地、水、花、洞穴地面、室内地板。3D 模式下树、房子、草丛、岩石另外用模型
  // 道馆机关的地板：m.over 图层里的字符 → def.paint 里的颜色和字
  function paintOver(g, m, T) {
    if (!m.over || !m.def || !m.def.paint) return;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const ch = m.over[y] && m.over[y][x], d = ch && m.def.paint[ch];
      if (!d) continue;
      const o = typeof d === 'string' ? { c: d } : d, sx = x * T, sy = y * T;
      if (o.c) { g.fillStyle = shade(o.c, .8); rr(g, sx + T * .04, sy + T * .04, T * .92, T * .92, T * .14); g.fill(); g.fillStyle = o.c; rr(g, sx + T * .09, sy + T * .07, T * .82, T * .8, T * .12); g.fill(); }
      if (o.t) { g.fillStyle = o.tc || '#2b2b3a'; g.font = '800 ' + Math.round(T * (o.t.length > 6 ? .2 : o.t.length > 3 ? .28 : .38)) + 'px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.t, sx + T / 2, sy + T * .5); }
    }
  }
  function paintGround(g, m, T, for3d) {
    const t = (x, y) => { const c = (m.grid[y] && m.grid[y][x]) || ''; return (c === 'o' || c === 'r') && m.paintAs ? m.paintAs[x + ',' + y] || c : c; };
    const is = set => (x, y) => set.includes(t(x, y));
    const p = m.pal, sd = m.z * 31 + m.id.length;
    const blob = (x, y, same, inset, color, R) => {
      const sx = x * T, sy = y * T;
      const up = same(x, y - 1), dn = same(x, y + 1), lf = same(x - 1, y), rt = same(x + 1, y);
      const r = R == null ? T * .38 : R;
      const x0 = sx + (lf ? 0 : inset), y0 = sy + (up ? 0 : inset), x1 = sx + T - (rt ? 0 : inset), y1 = sy + T - (dn ? 0 : inset);
      g.fillStyle = color;
      rr(g, x0, y0, x1 - x0 + (rt ? .6 : 0), y1 - y0 + (dn ? .6 : 0), [!up && !lf ? r : 0, !up && !rt ? r : 0, !dn && !rt ? r : 0, !dn && !lf ? r : 0]);
      g.fill();
    };
    if (m.kind === 'inside') {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const sx = x * T, sy = y * T;
        g.fillStyle = (x + y) % 2 ? p.floor : p.floor2; g.fillRect(sx, sy, T + .5, T + .5);
        if (m.room === 'H' || m.room === 'J') { g.fillStyle = shade(p.floor, .9); g.fillRect(sx, sy + T - 2, T, 2); }
      }
      const rug = is('ue');
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (t(x, y) === 'u') { blob(x, y, rug, T * .06, shade(p.rug, .85), T * .2); blob(x, y, rug, T * .14, p.rug, T * .16); }
        if (t(x, y) === 'e') { g.fillStyle = '#c62828'; rr(g, x * T + T * .08, y * T + T * .1, T * .84, T * .6, T * .1); g.fill(); g.fillStyle = '#ffcdd2'; g.fillRect(x * T + T * .2, y * T + T * .36, T * .6, T * .06); }
        else if (t(x, y) === 'I') { g.fillStyle = '#d6f1fb'; g.fillRect(x * T, y * T, T + .5, T + .5); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = T * .05; g.beginPath(); g.moveTo(x * T + T * .2, y * T + T * .7); g.lineTo(x * T + T * .45, y * T + T * .35); g.stroke(); }
        else if (t(x, y) === '%') stairs(g, x, y, T, p.trim || '#8d6e63');
        else if (t(x, y) === '^') { g.fillStyle = shade(p.rug || '#ffca28', .9); rr(g, x * T + T * .1, y * T + T * .1, T * .8, T * .8, T * .1); g.fill(); }
      }
      paintOver(g, m, T);
      return;
    }
    if (m.kind === 'cave') {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const sx = x * T, sy = y * T, r = hsh(x, y, sd);
        g.fillStyle = r < .5 ? p.floor : p.floor2; g.fillRect(sx, sy, T + .6, T + .6);
        if (r > .72) { g.fillStyle = shade(p.floor, .8); circ(g, sx + T * (.2 + hsh(y, x, sd) * .6), sy + T * (.3 + r * .4), T * .06); g.fill(); }
      }
      const wet = is('~');
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (t(x, y) === '~') { blob(x, y, wet, 0, shade(p.floor, .7)); blob(x, y, wet, T * .12, for3d ? '#2a5f86' : p.water, T * .3); }
        if (t(x, y) === 'e') { g.fillStyle = 'rgba(255,240,200,.55)'; rr(g, x * T + T * .1, y * T + T * .1, T * .8, T * .8, T * .2); g.fill(); }
        else if (t(x, y) === 'I') { g.fillStyle = '#cdeefa'; g.fillRect(x * T, y * T, T + .6, T + .6); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = T * .05; g.beginPath(); g.moveTo(x * T + T * .2, y * T + T * .7); g.lineTo(x * T + T * .45, y * T + T * .35); g.moveTo(x * T + T * .55, y * T + T * .8); g.lineTo(x * T + T * .75, y * T + T * .5); g.stroke(); }
        else if (t(x, y) === '%') stairs(g, x, y, T, p.wallTop || '#8a7260');
      }
      paintOver(g, m, T);
      return;
    }
    // 户外
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const sx = x * T, sy = y * T, r = hsh(x, y, sd);
      g.fillStyle = r < .5 ? p.grass : shade(p.grass, .975);
      g.fillRect(sx, sy, T + .6, T + .6);
      if (r > .7) {
        g.strokeStyle = p.speck; g.lineWidth = Math.max(1.2, T * .035); g.lineCap = 'round';
        const tx = sx + T * (.2 + hsh(y, x, sd) * .6), ty = sy + T * (.35 + r * .35);
        g.beginPath(); g.moveTo(tx - T * .06, ty); g.lineTo(tx - T * .09, ty - T * .09); g.moveTo(tx, ty); g.lineTo(tx, ty - T * .12); g.moveTo(tx + T * .06, ty); g.lineTo(tx + T * .09, ty - T * .09); g.stroke();
      } else if (r < .06) {
        const fx = sx + T * .5, fy = sy + T * .5;
        g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { circ(g, fx + Math.cos(k * 1.26) * T * .045, fy + Math.sin(k * 1.26) * T * .045, T * .035); g.fill(); }
        g.fillStyle = '#ffc93c'; circ(g, fx, fy, T * .03); g.fill();
      }
    }
    // 出口格外面是水的话画成水
    const wetEdge = (x, y) => { const c = t(x, y), d = { '^': [0, 1], v: [0, -1], '<': [1, 0], '>': [-1, 0] }[c]; return d && '~Dw'.includes(t(x + d[0], y + d[1])); };
    const isPath = (x, y) => '=^v<>'.includes(t(x, y)) && t(x, y) !== '' && !wetEdge(x, y), isWater = (x, y) => ('~Dw'.includes(t(x, y)) && t(x, y) !== '') || wetEdge(x, y), isSand = is('SU'), isTall = is(',');
    const isIce = is('I');
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = t(x, y);
      if (isPath(x, y)) {
        blob(x, y, isPath, 0, shade(p.path, .86));
        blob(x, y, isPath, T * .07, p.path, T * .32);
        if (hsh(x, y, sd) > .6) { g.fillStyle = p.pebble; circ(g, x * T + T * (.25 + hsh(y, x, sd) * .5), y * T + T * (.3 + hsh(x + 3, y, sd) * .4), T * .045); g.fill(); }
      } else if (isSand(x, y)) blob(x, y, isSand, T * .04, p.sand, T * .3);
      else if (isWater(x, y)) {
        blob(x, y, isWater, 0, for3d ? shade(p.sand, .92) : '#e9f8fc');
        blob(x, y, isWater, T * .1, for3d ? '#3f9fcf' : '#6fcdf0', T * .32);
        blob(x, y, isWater, T * .22, for3d ? '#2f86b8' : '#4ab6e6', T * .24);
        if (c === 'D') { g.fillStyle = for3d ? 'rgba(10,40,90,.5)' : '#1f6fa8'; rr(g, x * T + T * .06, y * T + T * .06, T * .88, T * .88, T * .3); g.fill(); }
        if (c === 'w' && !for3d) { g.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 3; k++) g.fillRect(x * T + T * (.2 + k * .25), y * T, T * .08, T); }
      } else if (isIce(x, y)) {
        blob(x, y, isIce, 0, '#bfe6f5', T * .1);
        g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = T * .05; g.beginPath(); g.moveTo(x * T + T * .2, y * T + T * .7); g.lineTo(x * T + T * .45, y * T + T * .35); g.stroke();
      } else if (c === '%') stairs(g, x, y, T, p.rock || '#a39b8b');
      else if (isTall(x, y) && for3d) blob(x, y, isTall, T * .02, shade(p.tall, .95), T * .3);
      else if (c === 'F') {
        const sx = x * T, sy = y * T;
        [['#ff6b9d', .28, .38], ['#ffd54f', .7, .3], ['#ffffff', .5, .72], ['#b388ff', .82, .78]].forEach(([col, fx, fy]) => {
          const cx = sx + T * fx, cy = sy + T * fy;
          g.strokeStyle = '#4c8f3a'; g.lineWidth = Math.max(1, T * .03); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + T * .12); g.stroke();
          g.fillStyle = col; for (let k = 0; k < 5; k++) { circ(g, cx + Math.cos(k * 1.26) * T * .05, cy + Math.sin(k * 1.26) * T * .05, T * .045); g.fill(); }
          g.fillStyle = '#f9a825'; circ(g, cx, cy, T * .035); g.fill();
        });
      }
      // 出口箭头
      if ('^v<>'.includes(c) && !wetEdge(x, y)) {
        g.fillStyle = 'rgba(18,48,74,.28)';
        const cx = x * T + T / 2, cy = y * T + T / 2, [ax, ay] = { '^': [0, -1], v: [0, 1], '<': [-1, 0], '>': [1, 0] }[c];
        g.beginPath(); g.moveTo(cx - ax * T * .1 - ay * T * .18, cy - ay * T * .1 - ax * T * .18); g.lineTo(cx - ax * T * .1 + ay * T * .18, cy - ay * T * .1 + ax * T * .18); g.lineTo(cx + ax * T * .14, cy + ay * T * .14); g.fill();
      }
      if (c === 'U') { const gr = g.createRadialGradient(x * T + T / 2, y * T + T / 2, 0, x * T + T / 2, y * T + T / 2, T * .5); gr.addColorStop(0, 'rgba(230,252,255,.95)'); gr.addColorStop(1, 'rgba(230,252,255,0)'); g.fillStyle = gr; g.fillRect(x * T, y * T, T, T); }
      // 房子、树、岩石底下的地面稍暗一点，3D 模型的影子更自然
      if (for3d && '#TRrCGMHJAEKX'.includes(c)) { g.fillStyle = 'rgba(20,50,20,.10)'; g.fillRect(x * T, y * T, T + .6, T + .6); }
    }
    paintOver(g, m, T);
  }
  function stairs(g, x, y, T, col) {
    for (let k = 0; k < 3; k++) { g.fillStyle = shade(col, .8 + k * .12); g.fillRect(x * T + T * .1, y * T + T * (.1 + k * .27), T * .8, T * .24); }
  }

  // ---------- 人物（画法在 people.js） ----------
  const PPL = window.EchoPeople;
  const LOOKS = PPL.LOOKS, drawPerson = PPL.drawPerson, portrait = PPL.portrait;
  const HIKER_LOOK = LOOKS.hiker;
  const VILLAGER_LOOKS = PPL.VILLAGERS, TRAINER_LOOKS = PPL.TRAINERS;
  // 主角的样子跟开场选的男孩 / 女孩走
  const playerLook = () => (E.S.player && E.S.player.gender === 'girl') ? LOOKS.girl : LOOKS.boy;
  const imgCache = {};
  function monImg(sp) {
    if (!imgCache[sp.id]) {
      const im = new Image(), url = window.Mon3D ? Mon3D.snapshot(sp, 192) : '';
      im.src = url || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Cartoon.monster2d(sp).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
      imgCache[sp.id] = im;
    }
    return imgCache[sp.id];
  }
  // 地上的道具球
  function drawItemBall(g, cx, cy, R) {
    g.lineWidth = Math.max(1.2, R * .2); g.strokeStyle = OUT;
    g.fillStyle = '#8e6cef'; circ(g, cx, cy, R); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI); g.fill();
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.stroke(); circ(g, cx, cy, R); g.stroke();
    g.fillStyle = '#ffffff'; circ(g, cx, cy, R * .32); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; circ(g, cx - R * .45, cy - R * .45, R * .18); g.fill();
  }

  // ---------- 2D 流畅模式 ----------
  function create2D(view) {
    const cv = document.createElement('canvas');
    cv.className = 'w-canvas';
    view.prepend(cv);
    const ctx = cv.getContext('2d');
    let T = 40, VW = 0, VH = 0, SC = null, key = '', m = null;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      VW = view.clientWidth; VH = view.clientHeight;
      const cols = m && m.kind === 'inside' ? Math.min(m.W, 11) : 9;
      T = Math.max(28, Math.floor(VW / cols));
      cv.width = VW * dpr; cv.height = VH * dpr;
      cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      key = '';
    }
    function build() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      SC = document.createElement('canvas');
      SC.width = Math.ceil(m.W * T * dpr); SC.height = Math.ceil(m.H * T * dpr);
      const g = SC.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineJoin = 'round'; g.lineCap = 'round';
      paintGround(g, m, T, false);
      const t = (x, y) => (m.grid[y] && m.grid[y][x]) || '';
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = t(x, y);
        if (c === ',') tallGrass(g, x, y);
        else if (c === 'B') sign(g, x, y);
        else if (c === 'L') ledge(g, x, y);
        else if (c === 'f') fence(g, x, y);
      }
      Object.entries(m.buildings).forEach(([L, b]) => building(g, b.L || L, b));
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = t(x, y);
        if (c === 'R' || c === 'X') rockWall(g, x, y, c);
        else if (c === 'K') caveMouth(g, x, y);
        else if (c === 'r') boulder(g, x, y);
        else if ('WQPYkpdt'.includes(c) || (c === 'Z' && m.kind === 'inside')) furniture(g, x, y, c);
        else if (c === 'Z') landmark(g, x, y);
      }
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if ('#T'.includes(t(x, y))) tree(g, x, y);
      key = m.id + ':' + T;
    }
    const pal = () => m.pal;
    function leaf(g, bx, by, h, w, lean, col) {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * .2 + lean * .4, by - h * .55, bx + lean, by - h); g.quadraticCurveTo(bx + w * .3 + lean * .3, by - h * .5, bx + w, by); g.closePath(); g.fill();
    }
    function clump(g, bx, by, h) {
      const p = pal();
      leaf(g, bx - T * .07, by, h * .8, T * .07, -T * .1, p.blade);
      leaf(g, bx + T * .07, by, h * .85, T * .07, T * .1, p.blade);
      leaf(g, bx, by, h, T * .08, 0, shade(p.tall, 1.12));
    }
    function tallGrass(g, x, y) {
      const p = pal(), sx = x * T, sy = y * T;
      g.fillStyle = p.tall; rr(g, sx + T * .04, sy + T * .04, T * .92, T * .92, T * .3); g.fill();
      [[.27, .42], [.73, .42], [.5, .7], [.22, .97], [.78, .97]].forEach(([fx, fy]) => clump(g, sx + T * fx, sy + T * fy, T * .34));
    }
    function sign(g, x, y) {
      const sx = x * T, sy = y * T;
      g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, sx + T / 2, sy + T * .88, T * .3, T * .08); g.fill();
      g.fillStyle = '#8a5a33'; g.fillRect(sx + T * .3, sy + T * .45, T * .08, T * .42); g.fillRect(sx + T * .62, sy + T * .45, T * .08, T * .42);
      g.fillStyle = '#d7a86e'; rr(g, sx + T * .14, sy + T * .16, T * .72, T * .4, T * .06); g.fill();
      g.strokeStyle = OUT; g.lineWidth = Math.max(1.2, T * .035); g.stroke();
      g.fillStyle = '#8a5a33'; g.fillRect(sx + T * .24, sy + T * .27, T * .52, T * .04); g.fillRect(sx + T * .24, sy + T * .36, T * .4, T * .04); g.fillRect(sx + T * .24, sy + T * .45, T * .46, T * .04);
    }
    function ledge(g, x, y) {
      const sx = x * T, sy = y * T, p = pal();
      g.fillStyle = shade(p.grass, .8); rr(g, sx - .5, sy + T * .45, T + 1, T * .3, [0, 0, T * .12, T * .12]); g.fill();
      g.fillStyle = shade(p.grass, .62); g.fillRect(sx - .5, sy + T * .66, T + 1, T * .1);
    }
    function fence(g, x, y) {
      const sx = x * T, sy = y * T;
      g.fillStyle = '#c89a66'; g.fillRect(sx, sy + T * .45, T, T * .1); g.fillRect(sx, sy + T * .65, T, T * .1);
      g.fillStyle = '#a87a4a'; [.15, .75].forEach(f => { rr(g, sx + T * f, sy + T * .3, T * .12, T * .6, T * .03); g.fill(); });
    }
    function rockWall(g, x, y, c) {
      const sx = x * T, sy = y * T, cave = c === 'X', col = cave ? pal().wall : pal().rock;
      const open = (dx, dy) => { const n = t2(x + dx, y + dy); return n && n !== c && n !== 'K'; };
      g.fillStyle = shade(col, .72); g.fillRect(sx, sy, T + .6, T + .6);
      g.fillStyle = col; rr(g, sx + (open(-1, 0) ? T * .06 : 0), sy + (open(0, -1) ? T * .06 : 0), T - (open(-1, 0) ? T * .06 : 0) - (open(1, 0) ? T * .06 : 0) + .6, T * .72, T * .14); g.fill();
      g.fillStyle = shade(col, 1.15); circ(g, sx + T * (.3 + hsh(x, y, 3) * .4), sy + T * (.25 + hsh(y, x, 3) * .25), T * .08); g.fill();
      if (open(0, 1)) { g.fillStyle = shade(col, .55); g.fillRect(sx, sy + T * .78, T + .6, T * .22); }
    }
    const t2 = (x, y) => (m.grid[y] && m.grid[y][x]) || '';
    function caveMouth(g, x, y) {
      rockWall(g, x, y, 'R');
      const sx = x * T, sy = y * T;
      g.fillStyle = '#1b1411'; rr(g, sx + T * .14, sy + T * .28, T * .72, T * .72, [T * .36, T * .36, 0, 0]); g.fill();
    }
    function boulder(g, x, y) {
      const sx = x * T, sy = y * T, col = (m.kind === 'cave' ? pal().wallTop : pal().rock) || pal().wallTop || pal().trim || '#9e9e9e';
      g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, sx + T / 2, sy + T * .82, T * .38, T * .12); g.fill();
      g.fillStyle = col; ell(g, sx + T / 2, sy + T * .55, T * .38, T * .32); g.fill(); g.strokeStyle = OUT; g.lineWidth = Math.max(1.2, T * .035); g.stroke();
      g.fillStyle = shade(col, 1.2); ell(g, sx + T * .4, sy + T * .45, T * .12, T * .08); g.fill();
    }
    function furniture(g, x, y, c) {
      const sx = x * T, sy = y * T, p = pal();
      g.lineWidth = Math.max(1.2, T * .035); g.strokeStyle = OUT;
      if (c === 'W') {
        const below = t2(x, y + 1), front = below && below !== 'W' && below !== 'e';
        g.fillStyle = shade(p.wall, .82); g.fillRect(sx, sy, T + .6, T + .6);
        if (y === 0 || !front) { g.fillStyle = shade(p.wall, .7); g.fillRect(sx, sy, T + .6, T + .6); }
        if (front) { g.fillStyle = p.wall; g.fillRect(sx, sy + T * .1, T + .6, T * .9); g.fillStyle = p.trim; g.fillRect(sx, sy + T * .78, T + .6, T * .12); }
        return;
      }
      g.fillStyle = 'rgba(0,0,0,.14)'; ell(g, sx + T / 2, sy + T * .9, T * .42, T * .1); g.fill();
      if (c === 'Q') { g.fillStyle = '#b77a4a'; rr(g, sx - .3, sy + T * .2, T + .6, T * .7, 0); g.fill(); g.fillStyle = '#e0a370'; g.fillRect(sx - .3, sy + T * .2, T + .6, T * .16); }
      else if (c === 'P') { g.fillStyle = '#90a4ae'; rr(g, sx + T * .1, sy + T * .45, T * .8, T * .45, T * .06); g.fill(); g.stroke(); g.fillStyle = '#263238'; rr(g, sx + T * .16, sy + T * .08, T * .68, T * .42, T * .06); g.fill(); g.stroke(); g.fillStyle = '#4fc3f7'; g.fillRect(sx + T * .22, sy + T * .14, T * .56, T * .3); }
      else if (c === 'Y') { g.fillStyle = '#c28e5c'; rr(g, sx + T * .06, sy + T * .2, T * .88, T * .56, T * .1); g.fill(); g.stroke(); g.fillStyle = '#fff3e0'; circ(g, sx + T * .5, sy + T * .46, T * .12); g.fill(); }
      else if (c === 'k') { g.fillStyle = '#8d6e63'; rr(g, sx + T * .06, sy - T * .1, T * .88, T * .98, T * .06); g.fill(); g.stroke(); ['#e57373', '#64b5f6', '#81c784', '#ffd54f'].forEach((b, i) => { g.fillStyle = b; g.fillRect(sx + T * (.14 + i * .18), sy + T * .08, T * .14, T * .3); g.fillRect(sx + T * (.14 + ((i + 2) % 4) * .18), sy + T * .48, T * .14, T * .3); }); }
      else if (c === 'p') { g.fillStyle = '#a1887f'; rr(g, sx + T * .3, sy + T * .55, T * .4, T * .35, T * .06); g.fill(); g.stroke(); g.fillStyle = '#43a047'; circ(g, sx + T * .5, sy + T * .38, T * .26); g.fill(); g.stroke(); }
      else if (c === 'd') { g.fillStyle = '#90caf9'; rr(g, sx + T * .06, sy + T * .02, T * .88, T * .94, T * .1); g.fill(); g.stroke(); g.fillStyle = '#ffffff'; rr(g, sx + T * .16, sy + T * .08, T * .68, T * .24, T * .08); g.fill(); }
      else if (c === 't') { g.fillStyle = '#37474f'; rr(g, sx + T * .1, sy + T * .2, T * .8, T * .55, T * .06); g.fill(); g.stroke(); g.fillStyle = '#80deea'; g.fillRect(sx + T * .18, sy + T * .27, T * .64, T * .4); }
      else if (c === 'Z') { g.fillStyle = '#b0bec5'; rr(g, sx + T * .2, sy + T * .55, T * .6, T * .35, T * .05); g.fill(); g.stroke(); g.fillStyle = '#ffc53d'; circ(g, sx + T * .5, sy + T * .35, T * .22); g.fill(); g.stroke(); }
    }
    // 户外地标：按岛的风格画个简单的样子
    function landmark(g, x, y) {
      const sx = x * T, sy = y * T, th = m.theme;
      g.lineWidth = Math.max(1.2, T * .035); g.strokeStyle = OUT;
      g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, sx + T / 2, sy + T * .88, T * .34, T * .1); g.fill();
      const col = { hello: '#546e7a', crayon: '#ef5350', farm: '#e8c35a', school: '#ffca28', lab: '#eceff1', circus: '#e53935', clock: '#37474f', party: '#ff80ab', jungle: '#8d6e63', city: '#263238', sports: '#ffca28', snow: '#ffffff', ruins: '#8f8a80' }[th] || '#b0bec5';
      if (th === 'clock') { g.fillStyle = '#37474f'; g.fillRect(sx + T * .45, sy + T * .3, T * .1, T * .58); g.fillStyle = '#fffdf5'; circ(g, sx + T / 2, sy + T * .28, T * .24); g.fill(); g.stroke(); g.beginPath(); g.moveTo(sx + T / 2, sy + T * .28); g.lineTo(sx + T / 2, sy + T * .12); g.moveTo(sx + T / 2, sy + T * .28); g.lineTo(sx + T * .62, sy + T * .32); g.stroke(); return; }
      if (th === 'snow') { g.fillStyle = '#fff'; circ(g, sx + T / 2, sy + T * .66, T * .24); g.fill(); g.stroke(); circ(g, sx + T / 2, sy + T * .32, T * .17); g.fill(); g.stroke(); g.fillStyle = '#ff7043'; g.fillRect(sx + T * .5, sy + T * .31, T * .12, T * .04); return; }
      g.fillStyle = shade(col, .8); rr(g, sx + T * .25, sy + T * .15, T * .5, T * .72, T * .1); g.fill(); g.stroke();
      g.fillStyle = col; rr(g, sx + T * .3, sy + T * .2, T * .4, T * .4, T * .1); g.fill();
    }
    function tree(g, x, y) {
      const p = pal(), sx = x * T, sy = y * T, r = hsh(x, y, 1), border = t2(x, y) === '#';
      const style = (EM.THEMES[m.theme] || {}).tree;
      if (style === 'palm' || style === 'pine' || style === 'snowpine' || style === 'pencil' || style === 'lolli' || style === 'cypress') {
        const cx = sx + T / 2, by = sy + T * .9;
        g.fillStyle = 'rgba(0,0,0,.16)'; ell(g, cx, by, T * .3, T * .09); g.fill();
        if (style === 'palm') { g.strokeStyle = '#a8793f'; g.lineWidth = T * .1; g.beginPath(); g.moveTo(cx, by); g.quadraticCurveTo(cx + T * .1, sy + T * .5, cx + T * .02, sy + T * .22); g.stroke(); g.fillStyle = p.tree; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; ell(g, cx + Math.cos(a) * T * .22, sy + T * .22 + Math.sin(a) * T * .1, T * .24, T * .08); g.fill(); } g.fillStyle = p.treeHi; circ(g, cx, sy + T * .2, T * .1); g.fill(); return; }
        if (style === 'pencil') { const cols = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc']; g.fillStyle = cols[Math.floor(r * cols.length)]; g.fillRect(cx - T * .16, sy + T * .3, T * .32, T * .58); g.fillStyle = '#f5d7a1'; g.beginPath(); g.moveTo(cx - T * .16, sy + T * .3); g.lineTo(cx + T * .16, sy + T * .3); g.lineTo(cx, sy + T * .02); g.fill(); g.fillStyle = '#37474f'; g.beginPath(); g.moveTo(cx - T * .05, sy + T * .1); g.lineTo(cx + T * .05, sy + T * .1); g.lineTo(cx, sy + T * .02); g.fill(); return; }
        if (style === 'lolli') { g.fillStyle = '#fffdf5'; g.fillRect(cx - T * .03, sy + T * .4, T * .06, T * .5); const cols = ['#ff80ab', '#ffd54f', '#80deea', '#b39ddb']; g.fillStyle = cols[Math.floor(r * cols.length)]; circ(g, cx, sy + T * .32, T * .28); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = T * .05; circ(g, cx, sy + T * .32, T * .15); g.stroke(); return; }
        g.fillStyle = '#6d4121'; g.fillRect(cx - T * .05, sy + T * .7, T * .1, T * .2);
        const tiers = style === 'cypress' ? [[.2, .75, .02]] : [[.42, .78, .3], [.34, .56, .12], [.24, .36, -.04]];
        tiers.forEach(([w, yb, yt]) => { g.fillStyle = p.tree; g.beginPath(); g.moveTo(cx - T * w, sy + T * yb); g.lineTo(cx + T * w, sy + T * yb); g.lineTo(cx, sy + T * yt); g.fill(); if (style === 'snowpine') { g.fillStyle = '#f4f9fb'; g.beginPath(); g.moveTo(cx - T * w * .4, sy + T * (yt + (yb - yt) * .4)); g.lineTo(cx + T * w * .4, sy + T * (yt + (yb - yt) * .4)); g.lineTo(cx, sy + T * yt); g.fill(); } });
        return;
      }
      const cx = sx + T / 2 + (border ? (r - .5) * T * .14 : 0), cy = sy + T * (border ? .42 : .4);
      const R = T * (border ? .52 : .44);
      g.fillStyle = 'rgba(0,0,0,.16)'; ell(g, cx, sy + T * .9, R * .8, T * .11); g.fill();
      g.fillStyle = '#6d4121'; rr(g, cx - T * .07, sy + T * .52, T * .14, T * .36, T * .03); g.fill();
      g.fillStyle = shade(p.tree, .72); circ(g, cx, cy + T * .07, R); g.fill();
      g.fillStyle = p.tree; circ(g, cx, cy, R * .93); g.fill();
      g.fillStyle = shade(p.tree, 1.12); circ(g, cx - R * .18, cy - R * .12, R * .62); g.fill();
      g.fillStyle = p.treeHi; circ(g, cx - R * .36, cy - R * .36, R * .28); g.fill();
    }
    function building(g, L, b) {
      L = b.L || L;
      const x = b.x0 * T, y = b.y0 * T, w = (b.x1 - b.x0 + 1) * T, h = (b.y1 - b.y0 + 1) * T, house = L !== 'C' && L !== 'M' && L !== 'G';
      const TH = EM.THEMES[m.theme] || {}, style = b.style || (L === 'C' || L === 'M' ? 'std' : TH.house || 'std'), P = m.pal;
      const roofC = L === 'C' || L === 'M' ? BUILD_COLORS(L, m) : style === 'std' ? BUILD_COLORS(L, m) : ({ med: '#d9643a', crayon: '#f5d7a1', farm: '#e8c35a', brick: '#6d4c41', dome: '#8fd3f4', tent: '#e53935', tower: '#4f9e8a', cake: '#ff8fb1', hut: '#4c8f3a', city: '#546e7a', market: '#ff7043', chalet: '#f4f8fb', temple: '#a39a84' }[style] || P.roof || BUILD_COLORS(L, m));
      const wallC = L === 'C' ? '#fff6ea' : L === 'M' ? '#f2f8ff' : ({ farm: '#c9955e', brick: '#b5543c', tower: '#cfc6b6', hut: '#a0703c', city: '#b0bec5', chalet: '#8d6e63', temple: '#c9bfa8', cake: '#fff4e0', crayon: ['#ffd1dc', '#c8e6ff', '#fff3b0', '#d4f5c9'][Math.floor(hsh(b.x0, b.y0, 3) * 4)] }[style] || (house ? '#fff8ec' : '#fbf1de'));
      const lw = Math.max(1.4, T * .04), rh = h * .5;
      g.lineWidth = lw; g.strokeStyle = OUT;
      g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, x + T * .15, y + h - T * .1, w - T * .1, T * .22, T * .1); g.fill();
      g.fillStyle = wallC; rr(g, x + T * .12, y + rh * .75, w - T * .24, h - rh * .75, T * .06); g.fill(); g.stroke();
      g.fillStyle = shade(wallC, .86); g.fillRect(x + T * .12 + lw / 2, y + h - T * .2, w - T * .24 - lw, T * .2 - lw / 2);
      g.fillStyle = roofC;
      if (style === 'brick' || style === 'city' || style === 'market' || style === 'temple') { rr(g, x, y + T * .1, w, rh, T * .06); g.fill(); g.stroke(); }
      else if (style === 'dome' || style === 'cake') { g.beginPath(); g.ellipse(x + w / 2, y + rh, w / 2, rh * .95, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); if (style === 'cake') { g.fillStyle = '#e53935'; circ(g, x + w / 2, y + T * .1, T * .12); g.fill(); } }
      else if (style === 'tent' || style === 'crayon' || style === 'tower') { g.beginPath(); g.moveTo(x - T * .06, y + rh); g.lineTo(x + w / 2, y - T * .3); g.lineTo(x + w + T * .06, y + rh); g.closePath(); g.fill(); g.stroke(); if (style === 'crayon') { g.fillStyle = '#37474f'; g.beginPath(); g.moveTo(x + w / 2 - T * .12, y - T * .05); g.lineTo(x + w / 2 + T * .12, y - T * .05); g.lineTo(x + w / 2, y - T * .3); g.fill(); } if (style === 'tent') { g.strokeStyle = '#ffffff'; g.lineWidth = T * .08; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + w * k / 4, y + rh); g.lineTo(x + w / 2, y - T * .25); g.stroke(); } } }
      else {
        g.beginPath(); g.moveTo(x - T * .06, y + rh); g.lineTo(x + T * .34, y + T * .06); g.lineTo(x + w - T * .34, y + T * .06); g.lineTo(x + w + T * .06, y + rh); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = shade(roofC, .8); g.lineWidth = Math.max(1, T * .03);
        for (let k = 1; k < 4; k++) { const yy = y + T * .06 + (rh - T * .06) * k / 4, inset = T * .34 * (1 - k / 4); g.beginPath(); g.moveTo(x + inset, yy); g.lineTo(x + w - inset, yy); g.stroke(); }
      }
      g.lineWidth = lw; g.strokeStyle = OUT;
      if (!house) {
        const label = L === 'C' ? 'CENTER' : L === 'M' ? 'SHOP' : 'GYM';
        g.font = '800 ' + Math.round(T * .3) + 'px "Baloo 2", Nunito, "PingFang SC", sans-serif';
        const tw = g.measureText(label).width, pw = tw + T * .5, ph = T * .44, px = x + w / 2 - pw / 2, py = y + rh * .52 - ph / 2;
        g.fillStyle = '#ffffff'; rr(g, px, py, pw, ph, ph / 2); g.fill(); g.strokeStyle = shade(roofC, .7); g.stroke();
        g.fillStyle = roofC; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, py + ph / 2 + 1);
        g.strokeStyle = OUT;
      } else if (style === 'std' || style === 'med' || style === 'farm' || style === 'chalet') { g.fillStyle = shade(roofC, .7); g.fillRect(x + w - T * .9, y - T * .05, T * .22, T * .35); g.strokeRect(x + w - T * .9, y - T * .05, T * .22, T * .35); }
      const wy = y + rh + (h - rh) * .28, ww = T * .5, wh = T * .4;
      [x + w * .14, x + w * .86 - ww].forEach(wx => {
        if (b.door && Math.abs(wx + ww / 2 - (b.door.x * T + T / 2)) < T * .6) return;
        g.fillStyle = '#8fd3f4'; rr(g, wx, wy, ww, wh, T * .05); g.fill(); g.stroke();
      });
      if (!b.door) return;
      const dx = b.door.x * T, dy = b.door.y * T;
      g.fillStyle = '#6b4a36'; rr(g, dx + T * .2, dy + T * .3, T * .6, T * .7, [T * .12, T * .12, 0, 0]); g.fill(); g.stroke();
      g.fillStyle = L === 'C' ? '#c9ecff' : '#8d6e63'; rr(g, dx + T * .27, dy + T * .37, T * .46, T * .56, [T * .08, T * .08, 0, 0]); g.fill();
      g.fillStyle = '#ffd54f'; circ(g, dx + T * .64, dy + T * .68, T * .04); g.fill();
    }
    function draw(now, V) {
      if (key !== m.id + ':' + T) build();
      const px = V.px * T, py = (V.py) * T;
      const mw = m.W * T, mh = m.H * T;
      const camX = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, px + T / 2 - VW / 2));
      const camY = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, py + T / 2 - VH / 2));
      ctx.fillStyle = m.kind === 'inside' ? '#1a1410' : m.kind === 'cave' ? '#1b1411' : m.kind === 'under' ? '#123c4a' : shade(m.pal.tree, .7); ctx.fillRect(0, 0, VW, VH);
      ctx.drawImage(SC, -camX, -camY, mw, mh);
      // 水面闪光
      const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(m.W - 1, Math.ceil((camX + VW) / T));
      const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(m.H - 1, Math.ceil((camY + VH) / T));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (t2(x, y) !== '~') continue;
        const tt = (now / 1400 + hsh(x, y, 2)) % 1, a = Math.sin(tt * Math.PI);
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * .8).toFixed(2) + ')'; ctx.lineWidth = Math.max(1.5, T * .045); ctx.lineCap = 'round';
        const sx = x * T - camX + T * (.25 + hsh(y, x, 2) * .4), sy = y * T - camY + T * (.35 + hsh(x + 1, y, 2) * .35);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + T * .1, sy - T * .06, sx + T * .2, sy); ctx.stroke();
      }
      const ents = [];
      V.picks.forEach(p => ents.push({ y: p.y, f: () => {
        const cx = p.x * T - camX + T / 2, cy = p.y * T - camY + T * .55 + Math.sin(now / 320 + p.x) * T * .04;
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, cx, p.y * T - camY + T * .86, T * .16, T * .05); ctx.fill();
        drawItemBall(ctx, cx, cy, T * .16);
      } }));
      V.npcs.forEach(q => ents.push({ y: q.y, f: () => {
        const sx = q.x * T - camX, sy = q.y * T - camY;
        if (q.mon) monster2d(q.mon, sx, sy - Math.abs(Math.sin(now / 110)) * T * .1);
        else person2d(q.look, q.face, 0, sx + T / 2, sy + T * .9);
        if (q.alert) bubble(sx + T / 2, sy - T * .45, '!', '#e53935');
      } }));
      // 野外技能的障碍：小树、裂开的岩石、大石头
      obstTiles.forEach(o => { if (!V.cleared || !V.cleared.has(o.x + ',' + o.y)) ents.push({ y: o.y, f: () => obst2d(o.k, o.x * T - camX, o.y * T - camY) }); });
      V.obst.forEach(o => ents.push({ y: o.y, f: () => obst2d('O', o.x * T - camX, o.y * T - camY) }));
      (m.gates || []).forEach(q => { if (!V.open || !V.open.has(q.x + ',' + q.y)) ents.push({ y: q.y, f: () => gate2d(q.x * T - camX, q.y * T - camY) }); });
      const fx = V.fx * T - camX, fy = V.fy * T - camY;
      if (V.showF && !V.surf) ents.push({ y: V.fy, f: () => follower(fx, fy - V.fhop * T, now, V) });
      ents.push({ y: V.py + .01, f: () => {
        const cx = px - camX + T / 2, fyy = py - camY + T * .9 - V.hop * T;
        if (V.surf) {
          // 冲浪：坐在自己的怪兽背上
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ell(ctx, cx, fyy + T * .02, T * .5, T * .16); ctx.fill();
          if (V.lead) { const im = monImg(V.lead); if (im.complete && im.naturalWidth) ctx.drawImage(im, cx - T * .55, fyy - T * .78 + Math.sin(now / 300) * 2, T * 1.1, T * 1.1); }
          person2d(V.plook, V.pdir, 0, cx, fyy - T * .3);
          return;
        }
        if (V.bike) { ctx.strokeStyle = '#37474f'; ctx.lineWidth = Math.max(2, T * .06); const side = V.pdir === 'left' || V.pdir === 'right'; [-1, 1].forEach(k => { circ(ctx, cx + (side ? k * T * .24 : 0), fyy - T * .1 + (side ? 0 : k * T * .08), T * .16); ctx.stroke(); }); }
        person2d(V.plook, V.pdir, V.pmoving && !V.bike ? 1 + (Math.floor(now / 85) % 2) : 0, cx, fyy - (V.bike ? T * .12 : 0));
      } });
      // 寻宝器：藏起来的道具一闪一闪
      V.sparkles.forEach(h => {
        const a = (Math.sin(now / 260 + h.x * 3 + h.y) + 1) / 2;
        ctx.fillStyle = 'rgba(255,245,160,' + (.35 + a * .6).toFixed(2) + ')';
        const sx = h.x * T - camX + T / 2, sy = h.y * T - camY + T / 2, r = T * (.1 + a * .12);
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4, rr2 = k % 2 ? r * .35 : r; ctx.lineTo(sx + Math.cos(an) * rr2, sy + Math.sin(an) * rr2); } ctx.fill();
      });
      ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
      // 站在草丛里时，草盖住腿
      [[V.inGrass, px - camX, py - camY], [V.fInGrass && V.showF, fx, fy]].forEach(([on, sx, sy]) => {
        if (!on) return;
        [[.25, .98], [.5, 1.02], [.75, .98]].forEach(([ax, ay]) => clump(ctx, sx + T * ax, sy + T * ay, T * .3));
      });
      if (V.hint) bubble(V.hint.x * T - camX + T / 2, V.hint.y * T - camY - T * .2 + Math.sin(now / 220) * 3, 'A', '#e53935', true);
      if (m.kind === 'under') { ctx.fillStyle = 'rgba(20,90,120,.28)'; ctx.fillRect(0, 0, VW, VH); }
      if (m.dark) {
        const cx = px - camX + T / 2, cy = py - camY + T / 2;
        const gr = V.flash ? ctx.createRadialGradient(cx, cy, T * 2.5, cx, cy, T * 7) : ctx.createRadialGradient(cx, cy, T * .8, cx, cy, T * 2.6);
        gr.addColorStop(0, 'rgba(10,6,4,0)'); gr.addColorStop(1, V.flash ? 'rgba(10,6,4,.5)' : 'rgba(6,4,2,.94)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
      }
    }
    // 人物从动作图集里取一帧来画（比每帧重新画快很多）
    function person2d(look, dir, frame, cx, fy) {
      const S = Math.round(T / .7), dpr = Math.min(2, window.devicePixelRatio || 1), A = PPL.atlas(look, Math.round(S * dpr)), cs = A.width / 4;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, cx, fy, T * .27, T * .08); ctx.fill();
      ctx.drawImage(A, ({ down: 0, left: 1, right: 2, up: 3 })[dir] * cs, frame * cs, cs, cs, cx - S / 2, fy - S * .96, S, S);
    }
    let obstTiles = [];
    function obst2d(k, sx, sy) {
      ctx.lineWidth = Math.max(1.4, T * .04); ctx.strokeStyle = OUT;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, sx + T / 2, sy + T * .86, T * .34, T * .1); ctx.fill();
      if (k === 'n') {
        ctx.fillStyle = '#6d4121'; ctx.fillRect(sx + T * .45, sy + T * .55, T * .1, T * .3);
        ctx.fillStyle = '#7bc043'; circ(ctx, sx + T / 2, sy + T * .45, T * .3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#3f7d20'; ctx.beginPath(); ctx.moveTo(sx + T * .35, sy + T * .4); ctx.lineTo(sx + T * .65, sy + T * .5); ctx.stroke();
      } else if (k === 'b') {
        ctx.fillStyle = '#b8a58a'; ell(ctx, sx + T / 2, sy + T * .55, T * .38, T * .32); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#5d4a3a'; ctx.beginPath(); ctx.moveTo(sx + T * .4, sy + T * .3); ctx.lineTo(sx + T * .52, sy + T * .52); ctx.lineTo(sx + T * .44, sy + T * .7); ctx.moveTo(sx + T * .52, sy + T * .52); ctx.lineTo(sx + T * .68, sy + T * .6); ctx.stroke();
      } else {
        ctx.fillStyle = '#9e9e9e'; circ(ctx, sx + T / 2, sy + T * .5, T * .42); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#bdbdbd'; circ(ctx, sx + T * .4, sy + T * .38, T * .14); ctx.fill();
      }
    }
    function gate2d(sx, sy) {
      ctx.lineWidth = Math.max(1.4, T * .04); ctx.strokeStyle = OUT;
      ctx.fillStyle = '#5d4037'; rr(ctx, sx + T * .05, sy + T * .05, T * .9, T * .14, T * .05); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff7043'; [.2, .45, .7].forEach(f => { rr(ctx, sx + T * f, sy + T * .15, T * .1, T * .75, T * .04); ctx.fill(); ctx.stroke(); });
    }
    function bubble(bx, by, ch, col, round) {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; circ(ctx, bx + 1, by + 2, T * .22); ctx.fill();
      ctx.fillStyle = '#ffffff';
      if (round) circ(ctx, bx, by, T * .22); else rr(ctx, bx - T * .17, by - T * .22, T * .34, T * .4, T * .08);
      ctx.fill();
      ctx.strokeStyle = round ? col : OUT; ctx.lineWidth = round ? 2.5 : 2; ctx.stroke();
      ctx.fillStyle = col; ctx.font = '900 ' + Math.round(T * .28) + 'px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, bx, by + 1);
    }
    function monster2d(sp, sx, sy) {
      const im = monImg(sp);
      if (!im.complete || !im.naturalWidth) return;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, sx + T / 2, sy + T * .86, T * .26, T * .08); ctx.fill();
      ctx.drawImage(im, sx - T * .05, sy - T * .2, T * 1.1, T * 1.1);
    }
    function follower(sx, sy, now, V) {
      if (!window.Cartoon) return;
      const im = monImg(V.lead);
      if (!im.complete || !im.naturalWidth) return;
      const hop = V.pmoving ? Math.abs(Math.sin(now / 90)) * T * .08 : Math.sin(now / 600) * T * .02;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, sx + T / 2, sy + T * .86, T * .26, T * .08); ctx.fill();
      ctx.drawImage(im, sx - T * .05, sy - T * .2 - hop, T * 1.1, T * 1.1);
    }
    return {
      kind: '2d',
      load(map) {
        m = map; resize();
        obstTiles = [];
        for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { const c = m.grid[y][x]; if (c === 'n' || c === 'b') obstTiles.push({ k: c, x, y }); }
      },
      resize,
      draw,
      destroy() { cv.remove(); },
    };
  }
  // 屋顶颜色：怪兽中心红、商店蓝、道馆用小镇主题色、民居暖色
  function BUILD_COLORS(L, m) {
    if (L === 'C') return '#e8514a';
    if (L === 'M') return '#3d8fe0';
    if (L === 'G') return E.W[m.z].color;
    return ['#8d6e63', '#5c9ead', '#c0785a', '#7e8f4e'][(m.z + (L === 'J' ? 1 : 0)) % 4];
  }

  // ---------- 画面框架 ----------
  function ensureDom() {
    if ($('w-view')) return;
    const sec = $('world');
    sec.innerHTML =
      '<div class="w-hud"><button class="x" data-act="wExit" aria-label="回首页">✕</button><div class="w-zone"><b id="w-zname"></b><small id="w-zsub"></small></div>' +
      '<span class="chip" id="w-badges"></span><span class="chip" id="w-balls"></span><button class="w-bike" id="w-bike" data-act="wBike" aria-label="骑车" hidden>🚲</button><button class="w-menu" data-act="wMenu" aria-label="菜单">☰</button></div>' +
      '<div class="w-view" id="w-view"><div class="w-note" id="w-note" hidden></div><div class="w-scene" id="w-scene" hidden></div><div class="w-banner" id="w-banner" hidden></div><div class="w-wipe" id="w-wipe"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="w-dlg" id="w-dlg" data-act="wA" hidden></div></div>' +
      '<div class="w-ctrl"><div class="dpad" id="w-dpad">' +
      ['up', 'left', 'right', 'down'].map(d => '<button class="dp dp-' + d + '" data-dir="' + d + '" aria-label="' + { up: '上', left: '左', right: '右', down: '下' }[d] + '">' + { up: '▲', left: '◀', right: '▶', down: '▼' }[d] + '</button>').join('') +
      '</div><div class="ab"><button class="bb" data-act="wB">B<small>菜单</small></button><button class="ba" data-act="wA">A<small>对话</small></button></div></div>';
    const dp = $('w-dpad');
    const down = e => { const b = e.target.closest('[data-dir]'); if (!b) return; e.preventDefault(); if (overlay) { overlay(b.dataset.dir); return; } held = b.dataset.dir; b.classList.add('on'); tryMove(held); };
    const up = () => { held = null; dp.querySelectorAll('.on').forEach(b => b.classList.remove('on')); };
    dp.addEventListener('pointerdown', down);
    dp.addEventListener('pointerup', up);
    dp.addEventListener('pointercancel', up);
    dp.addEventListener('pointerleave', up);
    dp.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { if (running) resize(); });
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    document.addEventListener('keydown', e => {
      if (!running || !$('modal').hidden || (e.target && e.target.tagName === 'INPUT')) return;
      if (overlay && (KEYS[e.key] || e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Escape' || e.key === 'x')) {
        e.preventDefault();
        overlay(KEYS[e.key] || (e.key === 'Escape' || e.key === 'x' ? 'B' : 'A'));
        return;
      }
      if (KEYS[e.key]) { e.preventDefault(); held = KEYS[e.key]; tryMove(held); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') { e.preventDefault(); interact(); }
      else if (e.key === 'Escape' || e.key === 'x') { e.preventDefault(); bButton(); }
    });
    document.addEventListener('keyup', e => { if (KEYS[e.key] === held) held = null; });
  }

  // ---------- 菜单 ----------
  function bButton() {
    if (dlg) { const pg = page(); if (!pg.kind) nextPage(); return; }
    menuSheet();
  }
  function menuSheet() {
    const m = E.S.mon;
    E.openModal('<h2>冒险菜单</h2><p>🏅 徽章 ' + Object.keys(m.badges).length + ' / ' + E.W.length + ' · 💰 ' + E.S.coins + (WS().repel > 0 ? ' · 🧴 还剩 ' + WS().repel + ' 步' : '') + '</p>' +
      '<div class="w-menu-grid"><button class="btn ghost" data-act="mTeam">🐾 我的队伍</button><button class="btn ghost" data-act="mBag">🎒 背包</button><button class="btn ghost" data-act="mDex">📖 图鉴</button><button class="btn ghost" data-act="wSkills">🌟 野外技能</button>' +
      '<button class="btn ghost" data-act="wHelp">❓ 怎么玩</button><button class="btn ghost" data-act="settings">⚙️ 设置</button><button class="btn ghost" data-act="wExit">🏠 回首页</button></div>' +
      '<button class="btn wide" data-act="close">继续冒险</button>');
  }
  function helpSheet() {
    E.openModal('<h2>怎么玩</h2><p>◀▲▼▶ 走路，<b>A</b> 和面前的人说话、看告示牌、进门；<b>B</b> 打开菜单。电脑上可以用方向键 / WASD、空格键。</p>' +
      '<p>🛤️ 小镇北边是道路，走进深色草丛会遇到野生怪兽。<br>🧑‍🎤 训练师看到你就会过来挑战。<br>⤵️ 台阶只能往下跳。<br>🕳️ 有的路旁边有洞穴，里面怪兽更强。<br>🏥 怪兽中心：找护士恢复体力，用电脑换队伍（最多 6 只）。<br>🏪 商店：买回声球、药水等道具。<br>🏟️ 道馆：打败馆主拿徽章，守卫就会让你去下一段路。<br>🌟 野外技能：拿到徽章后，对着小树、裂开的岩石、大石头、水按 A，大声说出指令就能用（菜单 → 野外技能）。<br>🎣 有钓竿就能对着水钓鱼；🚲 有自行车就点右上角的车骑上。<br>✨ 地上有些道具藏起来了，对着它按 A 才找得到。<br>💖 转身面对跟着你的怪兽按 A，每天用英语和它说一句话，它会越来越喜欢你。<br>🥚 温馨家庭岛的养育屋可以寄养怪兽、领蛋；蛋放在队伍里走路就会孵出来。</p>' +
      '<button class="btn wide" data-act="close">知道了</button>');
  }

  // ---------- 对外 ----------
  const actions = {
    wEnter: () => enter(0, 'resume'),
    wFly: t => enter(+t.dataset.z, 'fly'),
    wExit: () => { E.closeModal(); E.goHome('mon'); },
    wA: () => overlay ? overlay('A') : interact(),
    wB: () => overlay ? overlay('B') : bButton(),
    wPick: t => { const pg = page(); if (!pg || pg.kind !== 'choice') return; const extra = pg.pick(+t.dataset.i); insertPages(extra); pg.kind = null; nextPage(); },
    wMenu: () => menuSheet(),
    wHelp: () => helpSheet(),
    wSkills: () => skillsSheet(),
    wBike: () => { if (M.kind === 'inside' || M.kind === 'under' || PL.surf) return; PL.bike = !PL.bike; E.SFX.tap(); E.toast(PL.bike ? '🚲 骑上自行车了' : '🚶 下车走路'); hud(); },
    wUseSkill: t => {
      const k = t.dataset.k;
      E.closeModal();
      if (k === 'flash') useSkill('flash', () => { M._flash = true; E.toast('💡 洞穴被照亮了！', 'gold'); });
      else if (k === 'fly') {
        const v = Object.keys(WS().visited || {}).map(Number).sort((a, b) => a - b);
        E.openModal('<h2>🕊️ 飞到哪里？</h2><div class="fly-list">' + v.map(z => '<button class="btn small ghost" data-act="wFlyTo" data-z="' + z + '">' + E.W[z].icon + ' ' + E.W[z].name + '</button>').join('') + '</div><button class="btn ghost wide" data-act="close">取消</button>');
      }
    },
    wFlyTo: t => { const z = +t.dataset.z; E.closeModal(); useSkill('fly', () => flyTo(z)); },
    wHear: () => { const pg = page(); if (pg) E.say(pg.kind === 'speak' ? pg.target : pg.en, 0.8, pg.g); },
    wMic: () => dlgMic(),
    wSelfDone: () => { const pg = page(); if (pg && pg.kind) passTask(70); },
    wSkip: () => { const pg = page(); if (pg && pg.kind) failTask(); },
    wOpt: t => onOpt(+t.dataset.i),
    wBuy: t => {
      const [id, n] = shopStock()[+t.dataset.i] || [], it = MG.ITEMS[id];
      if (!it) return;
      const price = it.price * n;
      if (E.S.coins < price || (it.key && MG.itemCount(id) > 0)) return;
      E.S.coins -= price;
      MG.addItem(id, n);
      E.save(); E.SFX.coin(); E.renderTop(); hud();
      E.say('Here you are. ' + (n > 1 ? n + ' ' + it.en + 's' : (/^[aeiou]/i.test(it.en) ? 'An ' : 'A ') + it.en) + '.', undefined, 'm');
      shopSheet();
    },
  };
  // 背包里用道具时，world 负责驱怪喷雾和逃生绳
  const fieldHooks = {
    inWorld: () => running && !!M,
    repel: () => { WS().repel = 100; E.save(); E.toast('🧴 接下来 100 步不会遇到野生怪兽'); },
    canRope: () => running && M && (M.kind === 'cave' || M.kind === 'under' || (M.def && M.def.dungeon)) && !!(WS().lastOut && WS().lastOut.map),
    rope: () => { E.closeModal(); const o = WS().lastOut; goMap(o.map, o.x != null ? { x: o.x, y: o.y, dir: o.dir || 'down' } : null); },
    bike: () => { E.closeModal(); if (running && M) actions.wBike(); },
  };
  const api3d = { tile: (x, y) => tile(x, y) };
  const ART = { drawPerson, portrait, atlas: PPL.atlas, paintGround, shade, hsh, rr, circ, ell, OUT, LOOKS, monImg, drawItemBall, buildColor: BUILD_COLORS };
  window.EchoWorld = {
    init(api, mg) { E = api; MG = mg; EM = window.EchoMaps; EM.setTownCount(E.W.length); MG.setFieldHooks && MG.setFieldHooks(fieldHooks); return actions; },
    fresh: () => ({ started: false, map: 't0', z: 0, x: -1, y: -1, dir: 'up', arrive: null, visited: {}, flags: {}, daily: {}, center: null, introDone: false, repel: 0 }),
    stop: () => { stopLoop(); if (dlg) { clearInterval(dlg.tw); dlg = null; const d = $('w-dlg'); if (d) d.hidden = true; } busy = false; },
    // 设置里改了画质
    setGfx: () => { if (!M || !$('w-view')) return; ensureRenderer(); R.load(M, api3d); resize(); },
    placeLabel: () => { const ws = E.S.world; if (!ws.started || !ws.map || !window.EchoMaps) return null; const m = EchoMaps.get(ws.map); return m ? placeName(m) : null; },
    _debug: () => ({ M, PL, FL, dlg, busy, R, perf, goMap: (id, how) => goMap(id, how) }),
    _art: ART,
  };
})();
