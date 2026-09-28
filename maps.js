// 回声岛 · 地图数据：13 个小镇、12 条道路、3 个洞穴、房子内部，以及它们之间的出入口
(function () {
  'use strict';

  // ---------- 地块 ----------
  // 户外：# 边界树  T 树  . 草地  , 草丛(遇怪)  = 小路  ~ 水  F 花  B 告示牌  o 道具  S 沙地  R 岩壁  r 石头  L 台阶(只能往下跳)  f 栅栏
  //       ^ 北出口  v 南出口  K 洞口  @ 起点  1-9 人物
  //       建筑：C/c 怪兽中心/门  M/m 商店/门  G/g 道馆/门  H/h、J/j 民房/门
  // 洞穴：X 岩壁  : 洞穴地面(遇怪)  e 出口
  // 室内：W 墙  _ 地板  u 地毯  Q 柜台  P 电脑  Y 桌子  k 书架  p 盆栽  d 床  t 电视  Z 雕像  e 门口地垫
  const WALK = '.,=F^vo@S:_ue';
  const ENCOUNTER = { ',': 0.13, ':': 0.07 };

  // ---------- 小镇 ----------
  // 每个小镇：徽章守卫 2 在北边路口；1 是博士（第 1 镇）或村民；3 出题老师；4、5 村民
  const TOWNS = [
    [
      '#########^########',
      '#TT.....#2#.....T#',
      '#T.....F#=#F.....#',
      '#.HHHH...=...JJJ.#',
      '#.HHHH...=...JJJ.#',
      '#.HHhH...=...JjJ.#',
      '#...=....=....=..#',
      '#...======B====..#',
      '#........=.......#',
      '#.GGGGG..=..MMMM.#',
      '#.GGGGG..=..MMMM.#',
      '#.GGGGG..=..MMMM.#',
      '#.GGgGG..=..MMmM.#',
      '#...=....=....=..#',
      '#...======.====..#',
      '#~~~.....=....3..#',
      '#~~~~..4.=.......#',
      '#~~~.....=..CCCC.#',
      '#.o......=..CCCC.#',
      '#FF......=..CCcC.#',
      '#......5.=....=..#',
      '#.B......======..#',
      '#TT.....@=1....TT#',
      '#########v########',
    ],
    [
      '#########^########',
      '#T......#2#....TT#',
      '#.......#=#......#',
      '#.CCCC...=..~~~~.#',
      '#.CCCC...=.~~~~~.#',
      '#.CCcC...=..~~~~.#',
      '#...=....=...o...#',
      '#...======......F#',
      '#.B......=..JJJ.F#',
      '#........=..JJJ..#',
      '#.HHHH...=..JjJ..#',
      '#.HHHH...=...=.3.#',
      '#.HhHH...=====...#',
      '#..=.....=.......#',
      '#..=======..4....#',
      '#........=..MMMM.#',
      '#.GGGGG..=..MMMM.#',
      '#.GGGGG..=..MMMM.#',
      '#.GGGGG..=..MMmM.#',
      '#.GGgGG..=....=..#',
      '#...=....=====.5.#',
      '#FF.======.......#',
      '#TT.....@=1...TTT#',
      '#########v########',
    ],
    [
      '#########^########',
      '#TT.....#2#....TT#',
      '#T......#=#.....T#',
      '#.MMMM...=.GGGGG.#',
      '#.MMMM...=.GGGGG.#',
      '#.MMmM...=.GGGGG.#',
      '#...=....=.GGgGG.#',
      '#...======...=...#',
      '#........=====.F.#',
      '#~~~~~~~~==~~~~~~#',
      '#~~~~~~~~==~~~~~~#',
      '#..3.....==.....o#',
      '#.HHHH...=.......#',
      '#.HHHH...=..CCCC.#',
      '#.HHhH...=..CCCC.#',
      '#...=....=..CCcC.#',
      '#...======....=..#',
      '#.JJJ....=====.4.#',
      '#.JJJ....=.......#',
      '#.JjJ....=..FFF..#',
      '#..=.....=....5..#',
      '#.B=======......T#',
      '#TT.....@=1....TT#',
      '#########v########',
    ],
  ];
  const TOWN_NPC = { 1: { role: 'talk' }, 2: { role: 'guard' }, 3: { role: 'quiz' }, 4: { role: 'talk' }, 5: { role: 'talk' } };
  const TOWN_SIGNS = ['town', 'tip'];

  // ---------- 道路（由几段拼起来，每段中间 9、10 两列是路） ----------
  const SEG = {
    exitN: {
      rows: [
        '#########^^#########',
        '#TT......==......TT#',
        '#T..F....==....F..T#',
        '#.B......==........#',
        '#........==........#',
      ], signs: ['next'],
    },
    entryS: {
      rows: [
        '#........==........#',
        '#..,,,...==...B....#',
        '#.,,,,...==........#',
        '#TT......==......TT#',
        '#########vv#########',
      ], signs: ['route'],
    },
    grass: {
      rows: [
        '#........==........#',
        '#.,,,,,,.==..,,,,,.#',
        '#.,,,,,,.==..,,,,,.#',
        '#.,,,,,,.==..,,1,,.#',
        '#.,,,,,,.==..,,,,,.#',
        '#T.......==.......T#',
        '#TT...o..==......TT#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'left', sight: 5, under: ',' } },
    },
    pond: {
      rows: [
        '#........==........#',
        '#TT..~~~~==~~~~..TT#',
        '#T..~~~~~==~~~~~..T#',
        '#...~~~~~==~~~~~...#',
        '#.o..~~~~==~~~~....#',
        '#,,,..~~~==~~~..,,,#',
        '#,,,,....==..1.,,,,#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'left', sight: 3 } },
    },
    ledge: {
      rows: [
        '#........==........#',
        '#.,,,,...==...,,,,.#',
        '#.,,,,...==...,,,,.#',
        '#LLLLLLLL==LLLLLL..#',
        '#........==....o...#',
        '#TT..1...==.......T#',
        '#TTT.....==......TT#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'right', sight: 4 } },
    },
    alley: {
      rows: [
        '#........==........#',
        '#TTTTT...==...TTTTT#',
        '#TTTTT1..==...TTTTT#',
        '#TTTTT...==...TTTTT#',
        '#TTTTT...==..2TTTTT#',
        '#TTTTT...==...TTTTT#',
        '#TTTT....==....TTTT#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'right', sight: 3 }, 2: { role: 'trainer', face: 'left', sight: 3 } },
    },
    rocks: {
      rows: [
        '#........==........#',
        '#.RRR....==...RRRR.#',
        '#.RRR.,,,==,,,RRRR.#',
        '#..r..,,,==,,,..r..#',
        '#..1..,,,==,,,.....#',
        '#.RR..r..==..o..RR.#',
        '#.RR.....==.....RR.#',
        '#........==........#',
      ], npc: { 1: { role: 'hiker' } },
    },
    meadow: {
      rows: [
        '#........==........#',
        '#FF..TT..==..TT..FF#',
        '#F..TTTT.==.TTTT..F#',
        '#...TTTT.==.TTTT...#',
        '#.o..TT..==..TT....#',
        '#,,,,....==....,,1,#',
        '#,,,,,...==...,,,,,#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'left', sight: 7, under: ',' } },
    },
    cave: {
      rows: [
        '#........==........#',
        '#RRRRRR..==........#',
        '#RRRRRR..==..,,,,,.#',
        '#RRKRRR..==..,,,,,.#',
        '#..=.....==..,,,,,.#',
        '#..========........#',
        '#B.......==.....1..#',
        '#........==........#',
      ], npc: { 1: { role: 'trainer', face: 'left', sight: 6 } }, signs: ['cave'],
    },
  };
  const ROUTES = [
    ['grass', 'pond', 'ledge'],
    ['alley', 'grass', 'meadow'],
    ['rocks', 'cave', 'grass'],
    ['pond', 'alley', 'meadow', 'ledge'],
    ['grass', 'rocks', 'pond', 'alley'],
    ['meadow', 'ledge', 'grass', 'alley'],
    ['cave', 'pond', 'rocks', 'grass'],
    ['alley', 'meadow', 'ledge', 'pond'],
    ['rocks', 'grass', 'alley', 'meadow'],
    ['pond', 'cave', 'alley', 'grass'],
    ['ledge', 'rocks', 'meadow', 'alley'],
    ['grass', 'alley', 'pond', 'rocks'],
  ];

  // ---------- 洞穴 ----------
  const CAVES = [
    {
      route: 2, rows: [
        'XXXXXXXXXXXXXXXXXXXX',
        'XX:::::XXXXXX::::oXX',
        'X::::::::XXXX:::::XX',
        'X::r::::::XX::::::XX',
        'X::::XX:::::::XX:::X',
        'XX:::XX::1::::XX:::X',
        'XXo::XXX::::::XX::XX',
        'XXXX:XXX::~~::::::XX',
        'XX:::::::~~~~:::r:XX',
        'X::::::::~~~::::::XX',
        'X:::XXX:::::::XXX::X',
        'X:::XXX::::2::XXX::X',
        'XX::::::::::::::::XX',
        'XXX:::::::::::::XXXX',
        'XXXXXXXX::::XXXXXXXX',
        'XXXXXXXXXeXXXXXXXXXX',
      ], npc: { 1: { role: 'trainer', face: 'down', sight: 3 }, 2: { role: 'trainer', face: 'left', sight: 3 } },
    },
    {
      route: 6, rows: [
        'XXXXXXXXXXXXXXXXXXXX',
        'X:::o:XXXXXXXX:::::X',
        'X::::::XXXXXX:::::XX',
        'XX::r:::::::::::XXXX',
        'XXX::::XXXXX::::::XX',
        'X::::::XXXXX::1:::XX',
        'X::~~~::::::::::::XX',
        'X::~~~~:::XXX:::r::X',
        'X:::~~::::XXX::::::X',
        'XX::::::::XXX:::XXXX',
        'XXXX:::2::::::::XXXX',
        'XXXX::::::::::::o:XX',
        'XXXXXX::::::::XXXXXX',
        'XXXXXXXX::::XXXXXXXX',
        'XXXXXXXXX::XXXXXXXXX',
        'XXXXXXXXXeXXXXXXXXXX',
      ], npc: { 1: { role: 'trainer', face: 'down', sight: 3 }, 2: { role: 'trainer', face: 'right', sight: 4 } },
    },
  ];
  // 第三个洞穴用第一个洞穴镜像，道具位置不同
  CAVES.push({ route: 9, rows: CAVES[0].rows.map(r => r.replace('oXX', ':XX').replace('XXo::', 'XX:o:')), npc: CAVES[0].npc, mirror: true });

  // ---------- 室内 ----------
  const INSIDE = {
    C: {
      rows: [
        'WWWWWWWWWWW',
        'Wk___1___kW',
        'W__QQQQQ__W',
        'W_________W',
        'WP_______pW',
        'W__uuuuu__W',
        'Wp_uuuuu_YW',
        'W____u____W',
        'WWWWWeWWWWW',
      ], npc: { 1: { role: 'nurse' } },
    },
    M: {
      rows: [
        'WWWWWWWWWWW',
        'Wk_1_kkkkkW',
        'WQQQQ_____W',
        'W_________W',
        'W__YY_YY__W',
        'W__YY_YY__W',
        'Wp_______pW',
        'W____u____W',
        'WWWWWeWWWWW',
      ], npc: { 1: { role: 'clerk' } },
    },
    G: {
      rows: [
        'WWWWWWWWWWWWW',
        'WZ____1____ZW',
        'W___________W',
        'W_uuuuuuuuu_W',
        'W_u______3u_W',
        'W_u_______u_W',
        'W_u_______u_W',
        'W_uuuuuuuuu_W',
        'W__2________W',
        'WZ_________ZW',
        'W___________W',
        'W_____u_____W',
        'WWWWWWeWWWWWW',
      ], npc: { 1: { role: 'leader' }, 2: { role: 'trainer', face: 'right', sight: 3 }, 3: { role: 'trainer', face: 'left', sight: 3 } },
    },
    H: {
      rows: [
        'WWWWWWWWW',
        'Wkk_t__dW',
        'W______dW',
        'W_YY__1_W',
        'W_YY____W',
        'Wp______W',
        'W___u___W',
        'WWWWeWWWW',
      ], npc: { 1: { role: 'house' } },
    },
  };
  INSIDE.J = { rows: INSIDE.H.rows.map(r => [...r].reverse().join('')), npc: { 1: { role: 'gift' } } };

  // ---------- 配色 ----------
  const PALETTES = [
    { grass: '#8fd16a', speck: '#79bd57', tall: '#4fa83d', blade: '#2f7d2a', path: '#ecd9a8', pebble: '#d6be86', tree: '#2e7d32', treeHi: '#43a047', sand: '#f1e2b3', rock: '#a39b8b' },
    { grass: '#b5d86a', speck: '#9dc257', tall: '#7fa83a', blade: '#5b7f22', path: '#ead3a0', pebble: '#d3b77f', tree: '#c9772b', treeHi: '#e39a45', sand: '#efdcad', rock: '#b19a82' },
    { grass: '#7fd3a6', speck: '#68bd8f', tall: '#3fa77a', blade: '#237a55', path: '#e7dcc0', pebble: '#cbbd98', tree: '#1f7a5c', treeHi: '#2f9a74', sand: '#ece3c6', rock: '#95a39c' },
  ];
  const SNOW = { grass: '#eef4f8', speck: '#d9e6ee', tall: '#b9d7e3', blade: '#7fa9bb', path: '#d7dee4', pebble: '#bdc8d0', tree: '#46806a', treeHi: '#e8f3f7', sand: '#e6edf2', rock: '#9fb0bd', snow: true };
  const CAVE = { floor: '#8a7560', floor2: '#7a6653', wall: '#5b4a3d', wallTop: '#6f5b4b', water: '#3f86b8', dark: true };
  const INDOOR = {
    C: { floor: '#fbe9e7', floor2: '#f6d6d1', wall: '#fff3e8', trim: '#e8514a', rug: '#ff8a80' },
    M: { floor: '#e3f2fd', floor2: '#cfe6fb', wall: '#f5fbff', trim: '#3d8fe0', rug: '#64b5f6' },
    G: { floor: '#efe6d6', floor2: '#e2d6c1', wall: '#fbf1de', trim: '#8a6a4a', rug: '#ffca28' },
    H: { floor: '#e8c9a0', floor2: '#dcb98b', wall: '#fff6e6', trim: '#a0724a', rug: '#ef9a9a' },
  };
  INDOOR.J = { floor: '#d9c3a5', floor2: '#cbb190', wall: '#f3f7ec', trim: '#6d8b5a', rug: '#a5d6a7' };
  const palFor = z => z === 11 ? SNOW : PALETTES[z % PALETTES.length];

  // ---------- 生成 ----------
  const flip = r => [...r].reverse().join('');
  const flipFace = f => f === 'left' ? 'right' : f === 'right' ? 'left' : f;
  const cache = {};
  let TOWN_COUNT = 13;

  // 扫描地图：把人物、起点、告示牌、道具、建筑找出来
  function scan(m, spec) {
    const { grid } = m, signN = new Map();
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = grid[y][x];
      const seg = spec.segAt ? spec.segAt(y) : spec;
      if (/[1-9]/.test(c)) {
        const d = seg.npc[c];
        let face = d.face || 'down';
        if (seg.mirror) face = flipFace(face);
        m.npcs.push({ id: (seg.tag || '') + c, seed: m.npcs.length + (seg.seed || 0), role: d.role, x, y, face, home: face, sight: d.sight || 0 });
        grid[y][x] = d.under || (m.kind === 'cave' ? ':' : m.kind === 'inside' ? '_' : '.');
      } else if (c === '@') { m.start = { x, y }; grid[y][x] = '.'; }
      else if (c === 'B') { const k = signN.get(seg) || 0; signN.set(seg, k + 1); m.signs.push({ x, y, kind: (seg.signs || [])[k] || 'tip' }); }
      else if (c === 'o') m.picks.push({ x, y });
    }
    m.buildings = {};
    'CGMHJ'.split('').forEach(L => {
      let x0 = 99, y0 = 99, x1 = -1, y1 = -1, door = null;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = grid[y][x];
        if (c === L || c === L.toLowerCase()) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        if (c === L.toLowerCase()) door = { x, y };
      }
      if (door) m.buildings[L] = { x0, y0, x1, y1, door };
    });
  }

  function town(z) {
    const t = z % TOWNS.length, mirror = Math.floor(z / TOWNS.length) % 2 === 1;
    const m = { id: 't' + z, kind: 'town', z, pal: palFor(z), npcs: [], signs: [], picks: [] };
    const rows = (mirror ? TOWNS[t].map(flip) : TOWNS[t]).map(r => r
      .replace('v', z === 0 ? '#' : 'v')
      .replace('^', z === TOWN_COUNT - 1 ? '#' : '^'));
    m.grid = rows.map(r => [...r]); m.H = rows.length; m.W = rows[0].length;
    m.start = { x: 1, y: m.H - 2 };
    scan(m, { npc: TOWN_NPC, mirror, signs: TOWN_SIGNS, seed: z * 7 });
    // 第 1 镇没有南边的路，最后一镇没有北边的路：守卫也不需要了
    if (z === TOWN_COUNT - 1) m.npcs = m.npcs.filter(n => n.role !== 'guard');
    return m;
  }

  function route(z) {
    const names = ['exitN', ...ROUTES[z].slice().reverse(), 'entryS'];
    const m = { id: 'r' + z, kind: 'route', z, pal: palFor(z), npcs: [], signs: [], picks: [], cave: null };
    const rows = [], segs = [];
    names.forEach((nm, k) => {
      const s = SEG[nm], mirror = (z + k) % 2 === 1 && nm !== 'exitN' && nm !== 'entryS';
      segs.push({ y0: rows.length, y1: rows.length + s.rows.length, npc: s.npc || {}, signs: s.signs, mirror, tag: 's' + k + '-', seed: z * 11 + k * 3 });
      (mirror ? s.rows.map(flip) : s.rows).forEach(r => rows.push(r));
    });
    m.grid = rows.map(r => [...r]); m.H = rows.length; m.W = rows[0].length;
    m.start = { x: 9, y: m.H - 2 };
    scan(m, { segAt: y => segs.find(s => y >= s.y0 && y < s.y1) });
    const ci = CAVES.findIndex(c => c.route === z);
    if (ci >= 0) m.cave = ci;
    else for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.grid[y][x] === 'K') m.grid[y][x] = 'R';
    return m;
  }

  function cave(i) {
    const c = CAVES[i];
    const m = { id: 'c' + i, kind: 'cave', z: c.route, route: c.route, pal: CAVE, npcs: [], signs: [], picks: [], lvBonus: 2 };
    const rows = c.mirror ? c.rows.map(flip) : c.rows;
    m.grid = rows.map(r => [...r]); m.H = rows.length; m.W = rows[0].length;
    m.start = { x: 9, y: m.H - 2 };
    scan(m, { npc: c.npc, mirror: !!c.mirror, seed: 50 + i * 5 });
    return m;
  }

  function inside(z, L) {
    const t = INSIDE[L];
    const m = { id: 'i' + z + L, kind: 'inside', room: L, z, pal: INDOOR[L], npcs: [], signs: [], picks: [] };
    m.grid = t.rows.map(r => [...r]); m.H = t.rows.length; m.W = t.rows[0].length;
    m.start = { x: 1, y: 1 };
    scan(m, { npc: t.npc, mirror: false, seed: z * 3 });
    return m;
  }

  // ---------- 出入口 ----------
  // 每张地图算出：走到哪个格子会去哪张地图的哪个位置
  function linkWarps(m) {
    const w = [], at = (x, y, to, arrive) => w.push({ x, y, to, arrive });
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = m.grid[y][x];
      if (m.kind === 'town') {
        if (c === '^') at(x, y, 'r' + m.z, 'south');
        else if (c === 'v') at(x, y, 'r' + (m.z - 1), 'north');
        else if ('cmghj'.includes(c)) at(x, y, 'i' + m.z + c.toUpperCase(), 'mat');
      } else if (m.kind === 'route') {
        if (c === '^') at(x, y, 't' + (m.z + 1), 'south');
        else if (c === 'v') at(x, y, 't' + m.z, 'north');
        else if (c === 'K' && m.cave != null) at(x, y, 'c' + m.cave, 'mat');
      } else if (m.kind === 'cave') {
        if (c === 'e') at(x, y, 'r' + m.route, 'cave');
      } else if (m.kind === 'inside') {
        if (c === 'e') at(x, y, 't' + m.z, 'door:' + m.room);
      }
    }
    m.warps = w;
  }

  // 到达某张地图时站在哪里、面朝哪边
  function arrival(m, how) {
    const find = ch => { for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.grid[y][x] === ch) return { x, y }; return null; };
    let p = null;
    if (how === 'south') { const v = find('v'); if (v) p = { x: v.x, y: v.y - 1, dir: 'up' }; }
    else if (how === 'north') { const n = find('^'); if (n) p = { x: n.x, y: n.y + 1, dir: 'down' }; }
    else if (how === 'mat') { const e = find('e'); if (e) p = { x: e.x, y: e.y - 1, dir: 'up' }; }
    else if (how === 'cave') { const k = find('K'); if (k) p = { x: k.x, y: k.y + 1, dir: 'down' }; }
    else if (how === 'nurse') { const n = m.npcs.find(q => q.role === 'nurse'); if (n) p = { x: n.x, y: n.y + 2, dir: 'up' }; }
    else if (how && how.startsWith('door:')) { const b = m.buildings[how.slice(5)]; if (b) p = { x: b.door.x, y: b.door.y + 1, dir: 'down' }; }
    return p || { x: m.start.x, y: m.start.y, dir: 'up' };
  }

  function get(id) {
    if (cache[id]) return cache[id];
    const k = id[0], rest = id.slice(1);
    let m = null;
    if (k === 't') m = town(+rest);
    else if (k === 'r') m = route(+rest);
    else if (k === 'c') m = cave(+rest);
    else if (k === 'i') m = inside(+rest.slice(0, -1), rest.slice(-1));
    if (!m) return null;
    linkWarps(m);
    return (cache[id] = m);
  }

  function all() {
    const ids = [];
    for (let z = 0; z < TOWN_COUNT; z++) { ids.push('t' + z); 'CMGHJ'.split('').forEach(L => ids.push('i' + z + L)); if (z < TOWN_COUNT - 1) ids.push('r' + z); }
    CAVES.forEach((c, i) => ids.push('c' + i));
    return ids;
  }

  window.EchoMaps = {
    WALK, ENCOUNTER,
    setTownCount: n => { TOWN_COUNT = n; for (const k in cache) delete cache[k]; },
    get, all, arrival,
    caves: CAVES.map(c => c.route),
    palFor,
  };
})();
