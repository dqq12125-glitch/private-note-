// 回声岛 · 地图引擎：地块、各岛风格、地图登记表、出入口连接、到达点
// 手画的地图在 isles/*.js 里用 EchoMaps.define(id, def) 登记；没登记的地图用这里的老模板生成（小镇 / 道路 / 洞穴 / 房子）
(function () {
  'use strict';

  // ---------- 地块 ----------
  // 户外：# 边界树  T 树  . 草地  , 草丛(遇怪)  = 小路  ~ 水(冲浪)  D 深水(可以潜水)  w 瀑布(攀瀑往上)  F 花  B 告示牌  o 道具  * 藏起来的道具
  //       S 沙地  R 岩壁  r 石头  L 台阶(只能往下跳)  f 栅栏  Z 地标(雕像、钟、图腾……按 A 看)  I 冰面(会一直滑)
  //       野外技能障碍：n 小树(居合斩)  b 裂开的岩石(碎岩)  O 大石头(怪力推)
  //       出口：^ 北  v 南  < 西  > 东（在地图边上，连在一起的算一个出口）  K 洞口  % 楼梯/梯子  @ 起点  1-9 人物
  //       建筑：C/c 怪兽中心/门  M/m 商店  G/g 道馆  H/h、J/j、A/a 民房或剧情建筑（同一个字母可以有好几栋）  E 只能看不能进的房子
  // 洞穴：X 岩壁  : 洞穴地面(遇怪)  e 出口地垫
  // 海底：. 沙  , 海草(遇怪)  R 礁石  U 浮上去的光圈
  // 室内：W 墙  _ 地板  u 地毯  Q 柜台  P 电脑  Y 桌子  k 书架  p 盆栽  d 床  t 电视  Z 雕像  e 门口地垫  | 机关门(解开机关才打开)
  const WALK = '.,=F^v<>o@S:_ueI%U';
  const ENCOUNTER = { ',': 0.13, ':': 0.07 };
  const OBST = 'nbO';
  const EDGE = { '^': 'n', v: 's', '<': 'w', '>': 'e' };
  const BUILD = 'CMGHJAE';
  const LAND = { '^': [0, 1, 'down'], v: [0, -1, 'up'], '<': [1, 0, 'right'], '>': [-1, 0, 'left'] };

  // ---------- 各岛风格：地面配色、树、房子 ----------
  // tree：round 圆树 / palm 棕榈 / pencil 铅笔 / autumn 秋天的树 / cypress 细高柏树 / lolli 棒棒糖 / pine 松树 / jungle 大叶热带树 / orchard 果树 / snowpine 雪松 / dead 雾里的枯树
  // house：med 白墙红瓦 / crayon 糖果色方块 + 铅笔尖屋顶 / farm 木屋茅草顶 / brick 红砖平顶 / dome 玻璃圆顶 / tent 条纹帐篷 / tower 石塔铜顶 / cake 蛋糕圆房子 / hut 高脚树屋 / city 高楼 / market 遮阳棚小店 / chalet 雪顶木屋 / temple 石头神殿
  const THEMES = {
    hello: { tree: 'palm', house: 'med', pal: { grass: '#9ad66e', speck: '#84c35a', tall: '#55ab40', blade: '#2f7d2a', path: '#f1dfb2', pebble: '#dcc58f', tree: '#3f9a4a', treeHi: '#6cc15a', sand: '#f7e8bb', rock: '#c7b299', wall: '#fbf7ef', roof: '#d9643a', trim: '#2f7fc1' } },
    crayon: { tree: 'pencil', house: 'crayon', pal: { grass: '#a9e27b', speck: '#92cc63', tall: '#5fb84a', blade: '#35862e', path: '#ffe3b3', pebble: '#f7b9c9', tree: '#4caf50', treeHi: '#81d46a', sand: '#fff0c4', rock: '#b9a8d6', wall: '#ffffff', roof: '#f06292', trim: '#42a5f5' } },
    farm: { tree: 'autumn', house: 'farm', pal: { grass: '#b5d86a', speck: '#9dc257', tall: '#7fa83a', blade: '#5b7f22', path: '#e3c48f', pebble: '#caa76c', tree: '#c9772b', treeHi: '#e8a24c', sand: '#efdcad', rock: '#b19a82', wall: '#c9955e', roof: '#e8c35a', trim: '#7a4a28' } },
    school: { tree: 'round', house: 'brick', pal: { grass: '#86d17a', speck: '#6fbd63', tall: '#45a23e', blade: '#2b7a2a', path: '#dcd6ca', pebble: '#c2b9a8', tree: '#2e7d32', treeHi: '#4caf50', sand: '#ede3c9', rock: '#a39b8b', wall: '#b5543c', roof: '#6d4c41', trim: '#f5f0e6' } },
    lab: { tree: 'cypress', house: 'dome', pal: { grass: '#8fd8b0', speck: '#76c49a', tall: '#3fa77a', blade: '#237a55', path: '#e9eef2', pebble: '#cdd6dc', tree: '#1f7a5c', treeHi: '#39a07c', sand: '#ece3c6', rock: '#9fb4c0', wall: '#f6fafc', roof: '#8fd3f4', trim: '#5c6bc0' } },
    circus: { tree: 'palm', house: 'tent', pal: { grass: '#a3d35f', speck: '#8cbd4d', tall: '#6aa436', blade: '#4a7f1f', path: '#f5d8a0', pebble: '#e0bb78', tree: '#4f9a3a', treeHi: '#79c04f', sand: '#f3d38a', rock: '#c9a070', wall: '#fff6e0', roof: '#e53935', trim: '#ffca28' } },
    clock: { tree: 'pine', house: 'tower', pal: { grass: '#8fbf6a', speck: '#79a957', tall: '#4f8f3a', blade: '#2f6a23', path: '#bdb6aa', pebble: '#9d968a', tree: '#3b6b3a', treeHi: '#5b8f4a', sand: '#d9cdb5', rock: '#7d6e62', wall: '#cfc6b6', roof: '#4f9e8a', trim: '#b8862b' } },
    party: { tree: 'lolli', house: 'cake', pal: { grass: '#b8e986', speck: '#a2d672', tall: '#70bd4f', blade: '#4a932e', path: '#ffd6e2', pebble: '#ffb3c9', tree: '#ff80ab', treeHi: '#ffc1d9', sand: '#fff0c9', rock: '#d7b8e0', wall: '#fff4e0', roof: '#ff8fb1', trim: '#8d5a3b' } },
    jungle: { tree: 'jungle', house: 'hut', pal: { grass: '#5fbf4a', speck: '#4eaa3b', tall: '#2e8b2e', blade: '#1b5e20', path: '#c9a36a', pebble: '#a88550', tree: '#1f6f2f', treeHi: '#3d9a3a', sand: '#e3cf9a', rock: '#8a7a5a', wall: '#a0703c', roof: '#4c8f3a', trim: '#6d4121' } },
    city: { tree: 'round', house: 'city', pal: { grass: '#8ccf7e', speck: '#76ba68', tall: '#4fa446', blade: '#2f7d2a', path: '#a7afb8', pebble: '#8c949c', tree: '#2e7d32', treeHi: '#4caf50', sand: '#dfe3e6', rock: '#8e9aa4', wall: '#b0bec5', roof: '#546e7a', trim: '#ffca28' } },
    sports: { tree: 'orchard', house: 'market', pal: { grass: '#7fd35a', speck: '#69be47', tall: '#46a332', blade: '#2a7a1f', path: '#e6d2a4', pebble: '#cdb680', tree: '#3f8f3a', treeHi: '#65b555', sand: '#f1e2b3', rock: '#b39b82', wall: '#ffffff', roof: '#ff7043', trim: '#1e88e5' } },
    snow: { tree: 'snowpine', house: 'chalet', pal: { grass: '#eef4f8', speck: '#d9e6ee', tall: '#b9d7e3', blade: '#7fa9bb', path: '#d7dee4', pebble: '#bdc8d0', tree: '#46806a', treeHi: '#e8f3f7', sand: '#e6edf2', rock: '#9fb0bd', wall: '#8d6e63', roof: '#f4f8fb', trim: '#c62828', snow: true } },
    ruins: { tree: 'dead', house: 'temple', pal: { grass: '#9cb39a', speck: '#88a086', tall: '#5f8a64', blade: '#3d6a45', path: '#cfc6b3', pebble: '#b3a992', tree: '#5f7f6a', treeHi: '#7f9f88', sand: '#ddd3bb', rock: '#8f8a80', wall: '#c9bfa8', roof: '#8a8374', trim: '#6d8b5a', fog: true } },
  };
  const ISLE_THEME = ['hello', 'crayon', 'farm', 'school', 'lab', 'circus', 'clock', 'party', 'jungle', 'city', 'sports', 'snow', 'ruins'];
  const themeOf = z => ISLE_THEME[((z % 13) + 13) % 13];
  const palFor = z => THEMES[themeOf(z)].pal;
  const CAVE = { floor: '#8a7560', floor2: '#7a6653', wall: '#5b4a3d', wallTop: '#6f5b4b', water: '#3f86b8', rock: '#8a7260', dark: true };
  const CAVES_PAL = {
    rock: CAVE,
    ice: { floor: '#b9d4e3', floor2: '#a7c6d8', wall: '#6f93aa', wallTop: '#9fc1d4', water: '#3f86b8', rock: '#7fa3b8', dark: false },
    lava: { floor: '#6b4f45', floor2: '#5c433a', wall: '#3e2c28', wallTop: '#553b33', water: '#e0662f', rock: '#5a3f36', dark: false },
    base: { floor: '#9aa1ad', floor2: '#8b929e', wall: '#4b5160', wallTop: '#626a7a', water: '#3f86b8', rock: '#555b69', dark: false },
    temple: { floor: '#c9bfa8', floor2: '#bcb29a', wall: '#7d7566', wallTop: '#968d7c', water: '#5a8fb0', rock: '#8a8374', dark: false },
  };
  const UNDER = { grass: '#d8c79a', speck: '#c8b684', tall: '#3f8f7a', blade: '#1f6b5a', path: '#e3d5a8', pebble: '#c9b98a', tree: '#2c7a6a', treeHi: '#4fa08a', sand: '#e0cfa0', rock: '#5f7f86', under: true };

  // ---------- 地图登记表 ----------
  const DATA = {};           // 手画的地图
  const RETIRED = new Set(); // 被手画地图取代、不再使用的老模板地图
  const cache = {};
  let TOWN_COUNT = 13;
  function define(id, def) { DATA[id] = def; delete cache[id]; }

  // ---------- 老模板：小镇 ----------
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
      '#.GGGGG..=..MMMM.#',
      '#.GGgGG..=..MMmM.#',
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

  // ---------- 老模板：道路（由几段拼起来，每段中间 9、10 两列是路） ----------
  const SEG = {
    exitN: { rows: ['#########^^#########', '#TT......==......TT#', '#T..F....==....F..T#', '#.B......==........#', '#........==........#'], signs: ['next'] },
    entryS: { rows: ['#........==........#', '#..,,,...==...B....#', '#.,,,,...==........#', '#TT......==......TT#', '#########vv#########'], signs: ['route'] },
    grass: { rows: ['#........==........#', '#.,,,,,,.==..,,,,,.#', '#.,,,,,,.==..,,,,,.#', '#.,,,,,,.==..,,1,,.#', '#.,,,,,,.==..,,,,,.#', '#T.......==.......T#', '#TT...o..==......TT#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'left', sight: 5, under: ',' } } },
    pond: { rows: ['#........==........#', '#TT..~~~~==~~~~..TT#', '#T..~~~~~==~~~~~..T#', '#...~~~~~==~~~~~...#', '#.o..~~~~==~~~~....#', '#,,,..~~~==~~~..,,,#', '#,,,,....==..1.,,,,#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'left', sight: 3 } } },
    ledge: { rows: ['#........==........#', '#.,,,,...==...,,,,.#', '#.,,,,...==...,,,,.#', '#LLLLLLLL==LLLLLL..#', '#........==....o...#', '#TT..1...==.......T#', '#TTT.....==......TT#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'right', sight: 4 } } },
    alley: { rows: ['#........==........#', '#TTTTT...==...TTTTT#', '#TTTTT1..==...TTTTT#', '#TTTTT...==...TTTTT#', '#TTTTT...==..2TTTTT#', '#TTTTT...==...TTTTT#', '#TTTT....==....TTTT#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'right', sight: 3 }, 2: { role: 'trainer', face: 'left', sight: 3 } } },
    rocks: { rows: ['#........==........#', '#.RRR....==...RRRR.#', '#.RRR.,,,==,,,RRRR.#', '#..r..,,,==,,,..r..#', '#..1..,,,==,,,.....#', '#.RR..r..==..o..RR.#', '#.RR.....==.....RR.#', '#........==........#'], npc: { 1: { role: 'hiker' } } },
    meadow: { rows: ['#........==........#', '#FF..TT..==..TT..FF#', '#F..TTTT.==.TTTT..F#', '#...TTTT.==.TTTT...#', '#.o..TT..==..TT....#', '#,,,,....==....,,1,#', '#,,,,,...==...,,,,,#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'left', sight: 7, under: ',' } } },
    grove: { rows: ['#........==........#', '#TTTTTT..==........#', '#T,,o,T..==..,,,,..#', '#T,,,,T..==..,,,,..#', '#T,,,,T..==........#', '#TTnTTT..==...*....#', '#........==........#', '#........==........#'] },
    lake: { rows: ['#........==........#', '#..~~~~~.==.~~~~~~.#', '#.~~~~~~.==.~~o~~~.#', '#.~~~~~~.==.~~~~~~.#', '#..~~~~..==..~~~~..#', '#.......,==,.......#', '#.*.....,==,.....,.#', '#........==........#'] },
    rubble: { rows: ['#........==........#', '#RRRRRRR.==.RRRRRRR#', '#RR.o.RR.==.RR,,,RR#', '#RR...RR.==.RR,,,RR#', '#RRRbRRR.==.RRRbRRR#', '#........==........#', '#..r..*..==....r...#', '#........==........#'] },
    boulder: { rows: ['#........==........#', '#TTTTTTT.==.TTTTTTT#', '#T.o...T.==.T.,,,.T#', '#T.....T.==.T.,,,.T#', '#TTTOTTT.==.TTTTOTT#', '#........==........#', '#...*....==........#', '#........==........#'] },
    cave: { rows: ['#........==........#', '#RRRRRR..==........#', '#RRRRRR..==..,,,,,.#', '#RRKRRR..==..,,,,,.#', '#..=.....==..,,,,,.#', '#..========........#', '#B.......==.....1..#', '#........==........#'], npc: { 1: { role: 'trainer', face: 'left', sight: 6 } }, signs: ['cave'] },
  };
  const ROUTES = [
    ['grass', 'pond', 'ledge'],
    ['grove', 'alley', 'grass', 'meadow'],
    ['rubble', 'rocks', 'cave', 'grass'],
    ['boulder', 'pond', 'alley', 'meadow', 'ledge'],
    ['lake', 'grass', 'rocks', 'pond', 'alley'],
    ['grove', 'meadow', 'ledge', 'grass', 'alley'],
    ['lake', 'cave', 'pond', 'rocks', 'grass'],
    ['rubble', 'alley', 'meadow', 'ledge', 'pond'],
    ['boulder', 'rocks', 'grass', 'alley', 'meadow'],
    ['lake', 'pond', 'cave', 'alley', 'grass'],
    ['grove', 'ledge', 'rocks', 'meadow', 'alley'],
    ['rubble', 'grass', 'alley', 'pond', 'rocks'],
  ];

  // ---------- 老模板：洞穴 ----------
  const CAVES = [
    {
      route: 2, rows: [
        'XXXXXXXXXXXXXXXXXXXX', 'XX:::::XXXXXX::::oXX', 'X::::::::XXXX:::::XX', 'X::r::::::XX::::::XX', 'X::::XX:::::::XX:::X', 'XX:::XX::1::::XX:::X', 'XXo::XXX::::::XX::XX', 'XXXX:XXX::~~::::::XX',
        'XX:::::::~~~~:::r:XX', 'X::::::::~~~::::::XX', 'X:::XXX:::::::XXX::X', 'X:::XXX::::2::XXX::X', 'XX::::::::::::::::XX', 'XXX:::::::::::::XXXX', 'XXXXXXXX::::XXXXXXXX', 'XXXXXXXXXeXXXXXXXXXX',
      ], npc: { 1: { role: 'trainer', face: 'down', sight: 3 }, 2: { role: 'trainer', face: 'left', sight: 3 } },
    },
    {
      route: 6, rows: [
        'XXXXXXXXXXXXXXXXXXXX', 'X:::o:XXXXXXXX:::::X', 'X::::::XXXXXX:::::XX', 'XX::r:::::::::::XXXX', 'XXX::::XXXXX::::::XX', 'X::::::XXXXX::1:::XX', 'X::~~~::::::::::::XX', 'X::~~~~:::XXX:::r::X',
        'X:::~~::::XXX::::::X', 'XX::::::::XXX:::XXXX', 'XXXX:::2::::::::XXXX', 'XXXX::::::::::::o:XX', 'XXXXXX::::::::XXXXXX', 'XXXXXXXX::::XXXXXXXX', 'XXXXXXXXX::XXXXXXXXX', 'XXXXXXXXXeXXXXXXXXXX',
      ], npc: { 1: { role: 'trainer', face: 'down', sight: 3 }, 2: { role: 'trainer', face: 'right', sight: 4 } },
    },
  ];
  CAVES.push({ route: 9, rows: CAVES[0].rows.map(r => r.replace('oXX', ':XX').replace('XXo::', 'XX:o:')), npc: CAVES[0].npc, mirror: true });

  // ---------- 老模板：室内 ----------
  const INSIDE = {
    C: { rows: ['WWWWWWWWWWW', 'Wk___1___kW', 'W__QQQQQ__W', 'W_________W', 'WP_______pW', 'W__uuuuu__W', 'Wp_uuuuu_YW', 'W____u____W', 'WWWWWeWWWWW'], npc: { 1: { role: 'nurse' } } },
    M: { rows: ['WWWWWWWWWWW', 'Wk_1_kkkkkW', 'WQQQQ_____W', 'W_________W', 'W__YY_YY__W', 'W__YY_YY__W', 'Wp_______pW', 'W____u____W', 'WWWWWeWWWWW'], npc: { 1: { role: 'clerk' } } },
    G: {
      rows: ['WWWWWWWWWWWWW', 'WZ____1____ZW', 'W___________W', 'W_uuuuuuuuu_W', 'W_u______3u_W', 'W_u_______u_W', 'W_u_______u_W', 'W_uuuuuuuuu_W', 'W__2________W', 'WZ_________ZW', 'W___________W', 'W_____u_____W', 'WWWWWWeWWWWWW'],
      npc: { 1: { role: 'leader' }, 2: { role: 'trainer', face: 'right', sight: 3 }, 3: { role: 'trainer', face: 'left', sight: 3 } },
    },
    H: { rows: ['WWWWWWWWW', 'Wkk_t__dW', 'W______dW', 'W_YY__1_W', 'W_YY____W', 'Wp______W', 'W___u___W', 'WWWWeWWWW'], npc: { 1: { role: 'house' } } },
  };
  INSIDE.J = { rows: INSIDE.H.rows.map(r => [...r].reverse().join('')), npc: { 1: { role: 'gift' } } };
  INSIDE.A = { rows: INSIDE.H.rows, npc: { 1: { role: 'talk' } } };
  // 英语冠军赛会场：大厅 L → 四位大师 1–4 → 冠军 5，一间通一间
  INSIDE.L = { rows: ['WWWWW^WWWWW', 'W_1_____2_W', 'WQQQ___QQQW', 'W_________W', 'Wp_______pW', 'W___uuu___W', 'W_________W', 'WWWWWeWWWWW'], npc: { 1: { role: 'nurse' }, 2: { role: 'clerk' } } };
  const MASTER_ROOM = ['WWWW^WWWW', 'W___1___W', 'WZ_____ZW', 'W_uuuuu_W', 'W_u___u_W', 'W_uuuuu_W', 'W_______W', 'WWWWeWWWW'];
  ['1', '2', '3', '4'].forEach(k => { INSIDE[k] = { rows: MASTER_ROOM, npc: { 1: { role: 'master' } } }; });
  INSIDE['5'] = { rows: ['WWWWWWWWW', 'WZ__1__ZW', 'W_______W', 'W_uuuuu_W', 'W_u___u_W', 'W_uuuuu_W', 'W_______W', 'WWWWeWWWW'], npc: { 1: { role: 'champion' } } };
  const LEAGUE = ['L', '1', '2', '3', '4', '5'];
  const INDOOR = {
    C: { floor: '#fbe9e7', floor2: '#f6d6d1', wall: '#fff3e8', trim: '#e8514a', rug: '#ff8a80' },
    M: { floor: '#e3f2fd', floor2: '#cfe6fb', wall: '#f5fbff', trim: '#3d8fe0', rug: '#64b5f6' },
    G: { floor: '#efe6d6', floor2: '#e2d6c1', wall: '#fbf1de', trim: '#8a6a4a', rug: '#ffca28' },
    H: { floor: '#e8c9a0', floor2: '#dcb98b', wall: '#fff6e6', trim: '#a0724a', rug: '#ef9a9a' },
  };
  INDOOR.J = { floor: '#d9c3a5', floor2: '#cbb190', wall: '#f3f7ec', trim: '#6d8b5a', rug: '#a5d6a7' };
  INDOOR.A = { floor: '#e6d9c3', floor2: '#d8c8ae', wall: '#fdf8ef', trim: '#8d6e63', rug: '#90caf9' };
  INDOOR.L = { floor: '#ede7f6', floor2: '#d1c4e9', wall: '#f3e5f5', trim: '#7e57c2', rug: '#ffd54f' };
  INDOOR['1'] = { floor: '#cfd8dc', floor2: '#b0bec5', wall: '#eceff1', trim: '#546e7a', rug: '#90a4ae' };
  INDOOR['2'] = { floor: '#4a3b6b', floor2: '#3d2f5c', wall: '#5e4a86', trim: '#b388ff', rug: '#7e57c2' };
  INDOOR['3'] = { floor: '#e1f5fe', floor2: '#b3e5fc', wall: '#ffffff', trim: '#4fc3f7', rug: '#81d4fa' };
  INDOOR['4'] = { floor: '#8d6e63', floor2: '#795548', wall: '#d7ccc8', trim: '#ff7043', rug: '#ffab40' };
  INDOOR['5'] = { floor: '#fff8e1', floor2: '#ffecb3', wall: '#fffde7', trim: '#ffb300', rug: '#26a69a' };

  // ---------- 扫描：人物、起点、告示牌、道具、建筑 ----------
  const flip = r => [...r].reverse().join('');
  const flipFace = f => f === 'left' ? 'right' : f === 'right' ? 'left' : f;
  const floorOf = m => m.kind === 'cave' ? ':' : m.kind === 'inside' ? '_' : '.';
  // 人、道具、起点底下画什么地面：看四周最多的是沙地、小路还是草地
  function nbChar(m, x, y, grass) {
    const cnt = {};
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const c = m.grid[y + dy] && m.grid[y + dy][x + dx]; if (c && ('S.=:_' + (grass ? ',' : '') + (grass === 'water' ? '~' : '')).includes(c)) cnt[c] = (cnt[c] || 0) + 1; });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return best || floorOf(m);
  }
  function scan(m, spec) {
    const { grid } = m, signN = new Map();
    m.paintAs = {};
    m.hidden = m.hidden || []; m.boulders = m.boulders || []; m.gates = m.gates || [];
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = grid[y][x];
      const seg = spec.segAt ? spec.segAt(y) : spec;
      if (/[1-9]/.test(c)) {
        const d = (seg.npc || {})[c];
        if (!d) { grid[y][x] = floorOf(m); continue; }
        let face = d.face || 'down';
        if (seg.mirror) face = flipFace(face);
        m.npcs.push(Object.assign({}, d, { id: d.id || (seg.tag || '') + c, seed: m.npcs.length + (seg.seed || 0), role: d.role || 'talk', x, y, face, home: face, sight: d.sight || 0 }));
        grid[y][x] = d.under || nbChar(m, x, y, false);
      } else if (c === '@') { m.start = { x, y }; grid[y][x] = nbChar(m, x, y, false); }
      else if (c === 'B') { const k = signN.get(seg) || 0; signN.set(seg, k + 1); const s = (seg.signs || [])[k]; m.signs.push(Object.assign({ x, y }, typeof s === 'string' || !s ? { kind: s || 'tip' } : Array.isArray(s) ? { en: s[0], zh: s[1] } : s)); }
      else if (c === 'o') { m.picks.push({ x, y, item: (spec.items || [])[m.picks.length] }); m.paintAs[x + ',' + y] = nbChar(m, x, y, true); }
      else if (c === '*') { m.hidden.push({ x, y, item: (spec.hiddenItems || [])[m.hidden.length] }); grid[y][x] = nbChar(m, x, y, true); }
      else if (c === 'r') m.paintAs[x + ',' + y] = nbChar(m, x, y, 'water');
      else if (c === 'O') { m.boulders.push({ x, y }); grid[y][x] = nbChar(m, x, y, false); }
      else if (c === '|') m.gates.push({ x, y, i: m.gates.length });
    }
    // 小镇和洞穴里再藏一个道具：挑一块四周都空的地面（手画的地图不自动藏）
    if (spec.autoHide && (m.kind === 'town' || m.kind === 'cave') && !m.hidden.length) {
      const floor = m.kind === 'cave' ? ':' : '.', ok = [];
      for (let y = 2; y < m.H - 2; y++) for (let x = 2; x < m.W - 2; x++) {
        let good = true;
        for (let dy = -1; dy <= 1 && good; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[y + dy][x + dx] !== floor) { good = false; break; }
        if (good && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 3)) ok.push({ x, y });
      }
      if (ok.length) m.hidden.push(ok[(m.id.length * 7 + (m.z || 0) * 13) % ok.length]);
    }
    // 建筑：同一个字母连在一起的算一栋，门是小写字母；同字母的第 2 栋叫 H2、第 3 栋 H3……
    m.buildings = {};
    if (m.kind === 'inside') return;
    const seen = new Set();
    BUILD.split('').forEach(L => {
      const lo = L.toLowerCase(), isB = c => c === L || (L !== 'E' && c === lo);
      let k = 0;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (!isB(grid[y][x]) || seen.has(x + ',' + y)) continue;
        let x0 = x, y0 = y, x1 = x, y1 = y, door = null;
        const q = [[x, y]]; seen.add(x + ',' + y);
        while (q.length) {
          const [cx, cy] = q.pop();
          x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
          if (grid[cy][cx] === lo && L !== 'E') door = { x: cx, y: cy };
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (grid[ny] && isB(grid[ny][nx]) && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } });
        }
        const key = L + (k ? k + 1 : '');
        k++;
        m.buildings[key] = { L, key, x0, y0, x1, y1, door, style: (spec.styles || {})[key] };
      }
    });
  }

  // ---------- 出入口 ----------
  // 每张地图的出口分成一组组（地图边上连在一起的出口格、洞口、门、楼梯、地垫、潜水点），每组通向一张地图。
  // 走进一组出口，到了对面地图就站在「通回来的那一组」旁边（from:来的地图@第几组:偏移）
  function pick(v, i) { return Array.isArray(v) ? v[i] : i === 0 ? v : undefined; }
  function link(m, L, doors) {
    L = L || {};
    const groups = [], H = m.H, W = m.W, g = (x, y) => m.grid[y] && m.grid[y][x];
    // 地图边上的出口
    const edge = (ch, cells) => {
      let run = null, i = 0;
      cells.forEach(([x, y]) => {
        if (g(x, y) === ch) { if (!run) { run = { via: ch, tiles: [] }; groups.push(run); run.to = pick(L[EDGE[ch]], i++); } run.tiles.push({ x, y }); }
        else run = null;
      });
    };
    const row = y => Array.from({ length: W }, (_, x) => [x, y]), col = x => Array.from({ length: H }, (_, y) => [x, y]);
    edge('^', row(0)); edge('v', row(H - 1)); edge('<', col(0)); edge('>', col(W - 1));
    // 格子出口：按从上到下、从左到右的顺序对应 links 里的第几个
    const count = {};
    const cellGroup = (ch, key, joined) => {
      const seen = new Set();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (g(x, y) !== ch || seen.has(x + ',' + y)) continue;
        const tiles = [];
        if (joined) { const q = [[x, y]]; seen.add(x + ',' + y); while (q.length) { const [cx, cy] = q.pop(); tiles.push({ x: cx, y: cy }); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (g(nx, ny) === ch && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } }); } }
        else tiles.push({ x, y });
        tiles.sort((a, b) => a.y - b.y || a.x - b.x);
        const i = count[key] = (count[key] || 0);
        count[key]++;
        groups.push({ via: ch, tiles, to: pick(L[key], i) });
      }
    };
    cellGroup('K', 'K'); cellGroup('%', '%'); cellGroup('e', 'e', true); cellGroup('D', 'D', true); cellGroup('U', 'U', true);
    // 房子的门
    Object.values(m.buildings).forEach(b => {
      if (!b.door) return;
      groups.push({ via: 'door', key: b.key, tiles: [b.door], to: (doors && doors[b.key]) || (L.doors && L.doors[b.key]) || 'i' + m.z + b.key });
    });
    // 同一张目标地图有好几组出口时，编号 @0 @1……
    const nth = {};
    groups.forEach(gr => { if (!gr.to) return; gr.k = nth[gr.to] = nth[gr.to] == null ? 0 : nth[gr.to] + 1; });
    m.groups = groups.filter(gr => gr.to);
    m.warps = []; m.dives = []; m.surfaces = [];
    m.groups.forEach(gr => gr.tiles.forEach((t, off) => {
      const w = { x: t.x, y: t.y, to: gr.to, via: gr.via, arrive: 'from:' + m.id + '@' + gr.k + ':' + off };
      if (gr.via === 'D') m.dives.push(w); else if (gr.via === 'U') m.surfaces.push(w); else m.warps.push(w);
    }));
  }

  // 到达某张地图时站在哪里、面朝哪边（surf：落在水上）
  function landing(m, gr, off) {
    const t = gr.tiles[Math.max(0, Math.min(gr.tiles.length - 1, off | 0))];
    const ok = (x, y) => WALK.includes((m.grid[y] || [])[x]) && !m.warps.some(w => w.x === x && w.y === y);
    if (LAND[gr.via]) { const [dx, dy, dir] = LAND[gr.via]; return { x: t.x + dx, y: t.y + dy, dir }; }
    if (gr.via === 'K' || gr.via === 'door') return { x: t.x, y: t.y + 1, dir: 'down' };
    if (gr.via === 'e') return { x: t.x, y: t.y - 1, dir: 'up' };
    if (gr.via === 'D') return { x: t.x, y: t.y, dir: 'down', surf: true };
    if (gr.via === 'U') return { x: t.x, y: t.y, dir: 'down' };
    // 楼梯：站到旁边能走的格子上
    for (const [dx, dy, dir] of [[0, 1, 'down'], [1, 0, 'right'], [-1, 0, 'left'], [0, -1, 'up']]) if (ok(t.x + dx, t.y + dy)) return { x: t.x + dx, y: t.y + dy, dir };
    return { x: t.x, y: t.y + 1, dir: 'down' };
  }
  function arrival(m, how) {
    const byVia = v => m.groups.find(gr => gr.via === v);
    let gr = null, off = 0;
    if (how && how.startsWith('from:')) {
      const mt = /^from:(.+?)(?:@(\d+))?(?::(\d+))?$/.exec(how);
      if (mt) { const list = m.groups.filter(q => q.to === mt[1]); gr = list[+(mt[2] || 0)] || list[0]; off = +(mt[3] || 0); }
    }
    else if (how === 'south') gr = byVia('v');
    else if (how === 'north') gr = byVia('^');
    else if (how === 'west') gr = byVia('<');
    else if (how === 'east') gr = byVia('>');
    else if (how === 'mat') gr = byVia('e');
    else if (how === 'cave') gr = byVia('K');
    else if (how === 'nurse') { const n = m.npcs.find(q => q.role === 'nurse'); if (n) return { x: n.x, y: n.y + 2, dir: 'up' }; }
    else if (how && how.startsWith('door:')) { const b = m.buildings[how.slice(5)]; if (b && b.door) return { x: b.door.x, y: b.door.y + 1, dir: 'down' }; }
    if (gr) return landing(m, gr, off);
    return { x: m.start.x, y: m.start.y, dir: 'up' };
  }

  // ---------- 生成 ----------
  function blank(id, kind, z, pal) { return { id, kind, z, isle: z, pal, theme: themeOf(z), npcs: [], signs: [], picks: [] }; }
  function setGrid(m, rows) { m.grid = rows.map(r => [...r]); m.H = rows.length; m.W = rows[0].length; m.start = { x: 1, y: m.H - 2 }; }

  function town(z) {
    const t = z % TOWNS.length, mirror = Math.floor(z / TOWNS.length) % 2 === 1;
    const m = blank('t' + z, 'town', z, palFor(z));
    setGrid(m, (mirror ? TOWNS[t].map(flip) : TOWNS[t]).map(r => r.replace('v', z === 0 ? '#' : 'v')));
    scan(m, { npc: TOWN_NPC, mirror, signs: TOWN_SIGNS, seed: z * 7, autoHide: true });
    m.npcs.forEach(n => { if (n.role === 'guard') n.badge = z + 1; });
    link(m, { n: z === TOWN_COUNT - 1 ? 'i' + z + 'L' : 'r' + z, s: 'r' + (z - 1) });
    return m;
  }
  function route(z) {
    const names = ['exitN', ...ROUTES[z].slice().reverse(), 'entryS'];
    const m = blank('r' + z, 'route', z, palFor(z));
    const rows = [], segs = [];
    names.forEach((nm, k) => {
      const s = SEG[nm], mirror = (z + k) % 2 === 1 && nm !== 'exitN' && nm !== 'entryS';
      segs.push({ y0: rows.length, y1: rows.length + s.rows.length, npc: s.npc || {}, signs: s.signs, mirror, tag: 's' + k + '-', seed: z * 11 + k * 3 });
      (mirror ? s.rows.map(flip) : s.rows).forEach(r => rows.push(r));
    });
    setGrid(m, rows);
    m.start = { x: 9, y: m.H - 2 };
    scan(m, { segAt: y => segs.find(s => y >= s.y0 && y < s.y1) });
    // 老模板的洞穴已经被手画的地图取代时，洞口就封上
    const ci = CAVES.findIndex((c, i) => c.route === z && !DATA['c' + i]);
    if (ci >= 0) m.cave = ci;
    else for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (m.grid[y][x] === 'K') m.grid[y][x] = 'R';
    link(m, { n: 't' + (z + 1), s: 't' + z, K: ci >= 0 ? 'c' + ci : null });
    return m;
  }
  function cave(i) {
    const c = CAVES[i];
    const m = blank('c' + i, 'cave', c.route, CAVE);
    m.route = c.route; m.lvBonus = 2; m.dark = true;
    setGrid(m, c.mirror ? c.rows.map(flip) : c.rows);
    m.start = { x: 9, y: m.H - 2 };
    scan(m, { npc: c.npc, mirror: !!c.mirror, seed: 50 + i * 5, autoHide: true });
    link(m, { e: 'r' + c.route });
    return m;
  }
  function inside(z, L, key) {
    const t = INSIDE[L] || INSIDE.H;
    const m = blank('i' + z + key, 'inside', z, INDOOR[L] || INDOOR.H);
    m.room = key;
    setGrid(m, t.rows);
    m.start = { x: 1, y: 1 };
    scan(m, { npc: t.npc, seed: z * 3 });
    const li = LEAGUE.indexOf(key);
    if (li >= 0) link(m, { e: li ? 'i' + z + LEAGUE[li - 1] : 't' + z, n: li < LEAGUE.length - 1 ? 'i' + z + LEAGUE[li + 1] : null });
    else link(m, { e: 't' + z });
    return m;
  }

  // 手画的地图
  function build(id, def) {
    const kind = def.kind || 'route', z = def.z | 0;
    const theme = def.theme || themeOf(def.isle != null ? def.isle : z);
    const pal = def.pal || (kind === 'inside' ? INDOOR[def.room || 'H'] || INDOOR.H : kind === 'cave' ? CAVES_PAL[def.cave || 'rock'] : kind === 'under' ? UNDER : THEMES[theme].pal);
    const m = { id, kind, z, isle: def.isle != null ? def.isle : z, def, theme, pal, npcs: [], signs: [], picks: [],
      name: def.name, en: def.en, sub: def.sub, icon: def.icon, lvBonus: def.lv || 0, room: def.room || null,
      dark: def.dark != null ? def.dark : kind === 'cave' && (def.cave || 'rock') === 'rock', hab: def.hab, arena: def.arena };
    setGrid(m, def.rows);
    if (def.start) m.start = { x: def.start[0], y: def.start[1] };
    scan(m, { npc: def.npc || {}, signs: def.signs, items: def.items, hiddenItems: def.hiddenItems, styles: def.styles, seed: z * 17 + id.length });
    (def.people || []).forEach((p, i) => { const face = p.face || 'down'; m.npcs.push(Object.assign({}, p, { id: p.id || 'p' + i, seed: m.npcs.length, role: p.role || 'talk', face, home: face, sight: p.sight || 0 })); });
    if (def.over) m.over = def.over.map(r => [...r]);
    link(m, def.links, def.doors);
    return m;
  }

  function get(id) {
    if (cache[id]) return cache[id];
    let m = null;
    if (DATA[id]) m = build(id, DATA[id]);
    else {
      const k = id[0], rest = id.slice(1);
      if (k === 't') m = town(+rest);
      else if (k === 'r' && /^\d+$/.test(rest)) m = route(+rest);
      else if (k === 'c' && /^\d+$/.test(rest)) m = cave(+rest);
      else if (k === 'i') {
        const a = /^(\d+)([A-Z])(\d+)$/.exec(rest);
        if (a) m = inside(+a[1], a[2], a[2] + a[3]);
        else if (/^\d+[A-Z1-5]$/.test(rest)) m = inside(+rest.slice(0, -1), rest.slice(-1), rest.slice(-1));
      }
      if (m && isNaN(m.z)) m = null;
    }
    if (!m) return null;
    return (cache[id] = m);
  }

  // 全部地图：从第 1 镇出发顺着出入口能走到的所有地图（加上登记过的）
  function all() {
    const ids = new Set(), q = ['t0'];
    for (let z = 0; z < TOWN_COUNT; z++) q.push('t' + z);
    Object.keys(DATA).forEach(id => q.push(id));
    while (q.length) {
      const id = q.shift();
      if (ids.has(id) || RETIRED.has(id)) continue;
      const m = get(id);
      if (!m) continue;
      ids.add(id);
      m.groups.forEach(g => q.push(g.to));
      m.npcs.forEach(n => { if (n.to) q.push(n.to); });
    }
    return [...ids];
  }

  window.EchoMaps = {
    WALK, ENCOUNTER, OBST, THEMES, ISLE_THEME, CAVES_PAL,
    setTownCount: n => { TOWN_COUNT = n; for (const k in cache) delete cache[k]; },
    define, retire: ids => ids.forEach(id => { RETIRED.add(id); delete cache[id]; }), defined: id => !!DATA[id],
    get, all, arrival,
    caves: CAVES.map(c => c.route),
    palFor, themeOf,
    reset: () => { for (const k in cache) delete cache[k]; },
  };
})();
