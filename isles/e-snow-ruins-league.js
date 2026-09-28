// 回声岛 · 第 11–12 天气岛、回忆岛、冠军之路、英语冠军赛大厅（地图、剧情、道馆机关）。写法见 ISLES.md
// 地图：t11 天气岛 / d11a d11b 气象塔 / i11W 气象台 / i11G 天气道馆 / r11 12 号路瀑布河
//       t12 回忆岛 / d12a d12b 回忆神殿 / i12G 回忆道馆 / v1 v2 v3 冠军之路 / vL 冠军高原 / vLC vLM / i12L 冠军赛大厅
(function () {
  'use strict';
  const EM = window.EchoMaps;

  // =====================================================================
  // 第 11 岛 · 天气岛（雪山、冰湖、雪松林、雪顶木屋、气象塔）
  // =====================================================================
  EM.define('t11', {
    kind: 'town', z: 11, name: '天气岛', en: 'Weather Island', sub: '第 12 岛', theme: 'snow',
    rows: [
      '#################^^#################',
      '#RRRRRRRRRRRRRRR.==.RRRRRRRRRRRRRRR#',
      '#RTT,,,,,TTRRRR..==..====..RAAAAARR#',
      '#RT,,,,,,,TRRR...==..RRR.=.RAAAAA*R#',
      '#RT,,,Z,,,.RR....==..RRR.=.RAAAAA.R#',
      '#R..,,,,,,......B==..RRR.=..AAAAA.R#',
      '#RR.........RRR..==.RRRR.===AAaAA.R#',
      '#RRRTT.....RRRRR.==.RRRRR.=====...R#',
      '#RRRRTT...RRRRRR.==.RRRRLLLLLLLLLLR#',
      '#TT.......TT.....==................#',
      '#..GGGGG..JJJJJ..==..CCCC..MMMM....#',
      '#..GGGGG..JJJJJ..==..CCCC..MMMM..o.#',
      '#..GGGGG..JJJJJ..==..CcCC..MmMM....#',
      '#..GGgGG..JJjJJ..==...=.....=......#',
      '#....=......=....==...=.....=......#',
      '#..===============================.#',
      '#T............Z..==..Z.............#',
      '#T.............B.==.....HHHH..HHHH.#',
      '#TIIIIIIIIIIII...==.....HHHH..HHHH.#',
      '#TIIrIIIIIIIII...==.....HhHH..HHhH.#',
      '#TIIIIIIIIrIII...==......=......=..#',
      '#TIIIIIIIIIIII...================..#',
      '#TIrIIIIIIIIII...==...ffffffff.....#',
      '#TIIIIIIIIIIII...==...f.Z..Z.f.....#',
      '#TIIIIIIrIIIII...==...f..*...f..T..#',
      '#TIIIIIIIIIIII...==...fff.ffff..TT.#',
      '#ToIIIIIIIIIIr...==..........TTT...#',
      '#TTTTTTTTTTTTT...==................#',
      '#T..TT.TT........==..TT..HHHH....TT#',
      '#T.EEE.TTT.......==..T...HHHH.T..TT#',
      '#T.EEE..TT..o....==......HHhH....TT#',
      '#T.TT...TT.T.....==..TTT...=.....TT#',
      '#TT..............=============..TTT#',
      '#TTT..Z.TT.......==.IIIr....*..TTTT#',
      '#TTTTTT....B.....==.IIII..TTTTTTTTT#',
      '#TTTTTT.TT..T....==......TTTTTTTTTT#',
      '#TTTTTTTTTT......==....TTTTTTTTTTTT#',
      '#################vv#################',
    ],
    links: { n: 'r11', s: 'r10' },
    doors: { A: 'd11a', J: 'i11W' },
    styles: { A: 'tower', J: 'dome' },
    signs: [
      ['North: Route 12, the Waterfall River.', '往北：12 号路，瀑布河。'],
      ["Weather Island. How's the weather today?", '天气岛。今天天气怎么样？'],
      ['South: Route 11. Take an umbrella with you!', '往南：11 号路。记得带上雨伞！'],
    ],
    marks: [
      ["A snowman. It says: \"It's snowy and cold!\"", '一个雪人。它好像在说：“又下雪又冷！”'],
      ['A weather telescope. You can see the clouds.', '一台气象望远镜，能看清天上的云。'],
      ["The sky is grey. \"It's cloudy and cold today.\"", '天空灰蒙蒙的。“今天多云，很冷。”'],
      ['A happy snowman. "I like snowy days!"', '一个开心的雪人：“我喜欢下雪天！”'],
      ['A snowman with an umbrella. "Take an umbrella with you."', '一个打着伞的雪人：“带上雨伞吧。”'],
      ['An old weather bell. When it rings, a storm is coming.', '一口旧的天气钟。钟一响，就是暴风雪要来了。'],
    ],
    markKinds: ['snowman', 'telescope', 'telescope', 'snowman', 'snowman', 'bell'],
    items: ['superball', 'icestone', 'superpotion'],
    hiddenItems: ['revive', 'fullheal', 'superball'],
    people: [
      // 塔门口的嘘声团员：先去气象台问清天气预报，再来打败他
      { id: 'hush11', role: 'story', x: 30, y: 7, look: 'grunt', name: 'Hush Grunt', g: 'm', face: 'down', hideIf: 'w11door' },
      { id: 'kid11', role: 'story', x: 20, y: 18, look: 'kid', name: 'Tim', g: 'm', face: 'left' },
      { id: 'granny11', role: 'story', x: 8, y: 9, look: 'granny', name: 'Granny Snow', g: 'f', face: 'down' },
      { id: 'skier11', role: 'talk', x: 15, y: 22, look: 'skier', name: 'Skier Lily', g: 'f', face: 'left',
        say: [['I love the ice lake! When you slide, you only stop at a rock or at the shore.', '我最爱冰湖了！在冰上滑的时候，只有撞到石头或者到了岸边才会停。'], ['There is something shiny on the far side. Can you get it?', '湖的另一边有个亮晶晶的东西，你拿得到吗？']], speak: 'Stop at the rock!' },
      { id: 'man11', role: 'talk', x: 31, y: 32, look: 'fisher', name: 'Mr. Frost', g: 'm', face: 'left',
        say: [["I'm reading the newspaper. It says: 'It's raining in Beijing.'", '我在看报纸。上面说：“北京正在下雨。”'], ["And here? It's snowing, of course!", '那这里呢？当然是在下雪啦！']], speak: "It's raining in Beijing." },
    ],
  });

  // 气象塔 1 楼：冰面大厅。先滑过冰面到上面的走廊，再用控制台打开楼梯前的机关门
  EM.define('d11a', {
    kind: 'inside', z: 11, name: '气象塔 1 楼', en: 'Weather Tower 1F', sub: '天气岛',
    pal: { floor: '#dfe7ec', floor2: '#cfdae1', wall: '#eef3f6', trim: '#546e7a', rug: '#90caf9', rock: '#9fb3c2' },
    rows: [
      'WWWWWWWWWWWWWWWWW',
      'W%_|___k_Z_k__p_W',
      'WWWW____________W',
      'WWWWWWW_WWWWWWWWW',
      'WIIrIIIIrIIIIIrIW',
      'WIIIIIIIrIIIrIIIW',
      'WIIIIIIIIIIIIIIIW',
      'WIrIIIIIIIIIIIIIW',
      'WIIIIIIIIIIrIIIrW',
      'WIIIIIIIIIIrrIIIW',
      'WIIIIIIIIrIIIIIIW',
      'WWWWWWWW_WWWWWWWW',
      'W_______u_______W',
      'Wp______u______pW',
      'WWWWWWWWeWWWWWWWW',
    ],
    links: { e: 't11', '%': 'd11b' },
    npc: {},
    people: [
      { id: 'g1', role: 'trainer', x: 4, y: 12, look: 'grunt', name: 'Hush Grunt', g: 'm', face: 'right', sight: 4, types: ['ice', 'dark'], n: 2, lv: 2,
        lines: [["Shh! Snow is quiet. Quiet is good!", '嘘！雪是安静的，安静就是好！']], win: ["My feet are cold...", '我的脚好冷……'], after: [['The machine is upstairs. But the door is locked!', '机器在楼上。不过楼梯的门是锁着的！']] },
      { id: 'g2', role: 'trainer', x: 12, y: 2, look: 'gruntF', name: 'Hush Grunt', g: 'f', face: 'left', sight: 6, types: ['ice', 'poison'], n: 2, lv: 2,
        lines: [["It's snowing, it's snowing! Nobody goes out!", '下雪啦下雪啦！谁都不许出门！']], win: ['Brr... You are strong.', '呜……你好强。'], after: [["The panel asks a weather question. Answer it, and the door opens.", '控制台会问一个天气问题。答对了门就开了。']] },
    ],
  });

  // 气象塔顶层：嘘声团的天气机（三个雕像），干部低语和闷雷
  EM.define('d11b', {
    kind: 'inside', z: 11, name: '气象塔顶层', en: 'Weather Tower Top', sub: '天气岛',
    pal: { floor: '#d9dee8', floor2: '#c7cedb', wall: '#e8ecf3', trim: '#5c6bc0', rug: '#7986cb' },
    rows: [
      'WWWWWWWWWWWWWWW',
      'Wt____ZZZ____tW',
      'W_____uuu_____W',
      'W____uuuuu____W',
      'Wk___u___u___kW',
      'W____u___u____W',
      'W____uuuuu____W',
      'Wp___________pW',
      'W_____________W',
      'W%____________W',
      'WWWWWWWWWWWWWWW',
    ],
    links: { '%': 'd11a' },
    people: [
      { id: 'whisper', role: 'story', x: 5, y: 3, look: 'whisper', name: 'Admin Whisper', g: 'f', face: 'down', hideIf: 'w11wh' },
      { id: 'rumble', role: 'story', x: 9, y: 3, look: 'rumble', name: 'Admin Rumble', g: 'm', face: 'down', hideIf: 'w11rb' },
    ],
  });

  // 气象台（圆顶的房子）：台长斯凯博士
  EM.define('i11W', {
    kind: 'inside', z: 11, name: '气象台', en: 'Weather Station', sub: '天气岛',
    pal: { floor: '#e3f2fd', floor2: '#d0e6f7', wall: '#f5fbff', trim: '#1e88e5', rug: '#90caf9' },
    rows: [
      'WWWWWWWWWWWWW',
      'WtPt__kk__tpW',
      'W___________W',
      'W_YY_____YY_W',
      'W_YY_____YY_W',
      'W___________W',
      'Wp____u____pW',
      'WWWWWWeWWWWWW',
    ],
    links: { e: 't11' },
    people: [
      { id: 'skye', role: 'story', x: 6, y: 2, look: 'weather', name: 'Dr. Skye', g: 'f', face: 'down' },
      { id: 'sci11', role: 'talk', x: 9, y: 5, look: 'scientist', name: 'Weather Man Ken', g: 'm', face: 'left',
        say: [['I watch the weather on the screens every day.', '我每天都盯着屏幕看天气。'], ["What's the weather like in Harbin? Cold! In Hainan? Hot!", '哈尔滨天气怎么样？冷！海南呢？热！']], speak: "What's the weather like in Harbin?" },
    ],
  });

  // 天气道馆：三个房间，听天气预报按顺序打开开关（晴 → 雨 → 风），每开一个就开一扇门；错了全部复位
  const G11_ROWS = [
    'WWWWWWWWWWWWWWW',
    'Wk____u1u____kW',
    'Wp____uuu____pW',
    'W______u______W',
    'WWWWWWW|WWWWWWW',
    'WZIIIIIIIIrIIZW',
    'WIIIIIIIIIIIIIW',
    'WIIIrIIIIIIIIIW',
    'WIIIIIIIIIIIIIW',
    'W_____I_I_____W',
    'WWWWWWW|WWWWWWW',
    'W_Z_________Z_W',
    'W_____________W',
    'WWWWWWW|WWWWWWW',
    'W_Z_________Z_W',
    'W_____________W',
    'W___Z_________W',
    'W_____________W',
    'Wp_____u_____pW',
    'WWWWWWWeWWWWWWW',
  ];
  // 开关旁边地上的天气牌（over 图层）
  const G11_LABEL = { '2,5': 'S', '12,5': 'W', '3,11': 'R', '11,11': 'N', '3,14': 'C', '11,14': 'U' };
  EM.define('i11G', {
    kind: 'inside', z: 11, room: 'G', name: '天气道馆', en: 'Weather Gym', sub: '天气岛',
    pal: { floor: '#e1ecf4', floor2: '#d2e1ec', wall: '#f4f9fc', trim: '#0277bd', rug: '#4fc3f7', rock: '#9fb3c2' },
    rows: G11_ROWS,
    over: G11_ROWS.map((r, y) => [...r].map((c, x) => G11_LABEL[x + ',' + y] || '.').join('')),
    paint: {
      U: { c: '#fff3c4', t: '☀️', tc: '#e65100' }, R: { c: '#d6ecff', t: '🌧️', tc: '#1565c0' }, W: { c: '#e0f7fa', t: '🌬️', tc: '#00838f' },
      N: { c: '#f5f5ff', t: '❄️', tc: '#5c6bc0' }, C: { c: '#eceff1', t: '☁️', tc: '#546e7a' }, S: { c: '#fff3c4', t: '☀️', tc: '#e65100' },
    },
    links: { e: 't11' },
    npc: {
      1: { role: 'leader' },
    },
    people: [
      { id: 'gt1', role: 'trainer', x: 11, y: 17, look: 'weather', name: 'Reporter Rita', g: 'f', face: 'left', sight: 4, types: ['water', 'flying'], n: 2, lv: 1,
        lines: [["Good evening! Here is the weather. It's windy in the gym!", '晚上好！现在播报天气：道馆里正在刮风！']], win: ['That was a storm of English!', '这真是一场英语风暴！'], after: [['Listen to the radio. The order is important!', '好好听收音机，顺序很重要！']] },
      { id: 'gt2', role: 'trainer', x: 11, y: 12, look: 'swimmer', name: 'Swimmer Joe', g: 'm', face: 'left', sight: 3, types: ['water', 'ice'], n: 2, lv: 2,
        lines: [["It's raining! I love rainy days!", '下雨啦！我最喜欢下雨天！']], win: ['I am all wet now!', '我全身都湿透了！'], after: [['Rainy comes after sunny. Remember?', '晴天后面是雨天，记得吗？']] },
      { id: 'gt3', role: 'trainer', x: 1, y: 9, look: 'skier', name: 'Skier Nora', g: 'f', face: 'right', sight: 4, types: ['ice', 'flying'], n: 3, lv: 2,
        lines: [["Slide, slide! It's cold, but I'm warm!", '滑呀滑！天很冷，但我很暖和！']], win: ['You slid past me!', '你从我身边滑过去了！'], after: [['On the ice, you only stop at a rock or a wall.', '在冰上，只有撞到石头或墙才会停下。']] },
    ],
  });

  // 12 号路 · 瀑布河：南边是雪原，中间一整道岩壁，只有攀瀑才能上去；北边是雾里的石头古迹和高山湖
  EM.define('r11', {
    kind: 'route', z: 11, name: '12 号路', en: 'Route 12 · Waterfall River', sub: '天气岛 → 回忆岛', theme: 'snow',
    rows: [
      '#############^^###############',
      '#TTTTTTTTTTT.==.TTTTTTTTTTTTT#',
      '#TT,,,,,TTT..==...TTTTT.o.TTT#',
      '#T,,,,,,,T..Z==Z...TTTTTnTTTT#',
      '#T,,,*,,,...R==R......,,,,.TT#',
      '#TT,,,,,....R==R..2...,,,,,.T#',
      '#TTT..TTT...R==R......,,,,,.T#',
      '#TTTTTTTT.....=.........,,..T#',
      '#TT~~~~~~~T...=...ZZZ.......T#',
      '#T~~~~~~~~~T..=..Z...Z..3...T#',
      '#~~~~~~~~~~~..=.....B.......T#',
      '#~~~SSS~~~~~~S=SSS.........TT#',
      '#~~~SoS~~~~~~~~~~~~SS....TTTT#',
      '#~~~SZS~~~~~~~~~~~~~~S...,,,T#',
      '#T~~~~~~~~~~1~~~~~~~~SS..,,,T#',
      '#TT~~~~~~~~~~~~~~~~~~~S..,,,T#',
      '#TTT~~~~~~~~~~~~~~~~~SS...TTT#',
      '#TTTT~~~~~~~~~~~~~~~SS..*..TT#',
      '#TTTTTT~~~~~~~~~~~SSS....TTTT#',
      '#TTTTTTTT~~~~~~~~SS...TTTTTTT#',
      '#TTTTTTTTTT~~~~~TTTTTTTTTTTTT#',
      '#RRRRRRRRRRR~~~RRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRR~~RRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRwwRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRwwRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRwwRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRwwRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRwwRRRRRRRRRRRRRR#',
      '#RRRRRRRRRR~~~~~~RRRRRRRRRRRR#',
      '#TTTTTTTT~~~~~~~~~~TTTTTTTTTT#',
      '#TTT,*,S~~~~~~~~~~~~S..o..TTT#',
      '#TTT,,,S~~~~~~~~~~~~S.....TTT#',
      '#TTTTTTTTT~~~~~~~~~TTTTTTTTTT#',
      '#TTTTTTTTT~~~~~~~SSSS,,,TTTTT#',
      '#TTTTTTTT~~~~~~SSS,,,,,,.TTTT#',
      '#TTTTTT~~~~~~SS.,,,,,,..4.TTT#',
      '#TTTT~~~~~~SS...,,,==.......T#',
      '#TT~~~~~~SS......B.==...,,,.T#',
      '#~~~~~~~SS..TTT....==...,,,,.#',
      '#~~~~~~SS...TTT....==...,,,,.#',
      '#~~~SSS.....,,,,...==..5.,,..#',
      '#TTT,,,,,,,,,,.....==.......T#',
      '#TT,,,,,,,,,,..6...==..,,,,,T#',
      '#T,,,,,,,,,,,......==..,,,,,T#',
      '#LLLLLLLLLLLLL.....==.LLLLLLL#',
      '#..........TTT.....==....TTTT#',
      '#.o.......TTT.,,,..==...,,,TT#',
      '#.......RRR..,,,,..==..,,,,.T#',
      '#.......RZR..,,,,..==...,,..T#',
      '#TbTT...RRR........==......TT#',
      '#o.TT.....,,,,.....==..,,,..T#',
      '#.*TT.......,,,....==.......T#',
      '#TTTT.......,,,....==..,,,,.T#',
      '#TT....,,,,,,......==..,,,,.T#',
      '#TTT..,,,,,,.......==..,,,.TT#',
      '#TTTT...,,,,......B==.....TTT#',
      '#TTTTT.............==...TTTTT#',
      '#TTTTTTT...........==..TTTTTT#',
      '#TTTTTTTTTT........==..TTTTTT#',
      '###################vv#########',
    ],
    links: { n: 't12', s: 't11' },
    signs: [
      ['Memory Island is just north. Can you see the old stones in the fog?', '回忆岛就在北边。看见雾里那些古老的石头了吗？'],
      ['The Waterfall River. Surf to the waterfall and climb it with Waterfall!', '瀑布河。冲浪到瀑布下面，用「攀瀑」爬上去！'],
      ["Route 12. It's cold here. Wear a warm coat!", '12 号路。这里很冷，穿上暖和的外套！'],
    ],
    marks: [
      ['An old stone gate: "Welcome, traveller. What did you see on your trip?"', '古老的石门：“欢迎你，旅行者。你在旅途中看到了什么？”'],
      ['An old stone gate: "Long ago, people came here to tell stories."', '古老的石门：“很久以前，人们来这里讲故事。”'],
      ['A stone: "I went to the sea."', '一块石头：“我去了大海。”'],
      ['A stone: "I saw a dragon."', '一块石头：“我看见了一条龙。”'],
      ['A stone: "I heard many voices."', '一块石头：“我听见了很多声音。”'],
      ['A stone: "We spoke together."', '一块石头：“我们一起说话。”'],
      ['A stone: "The dragon woke up!"', '一块石头：“龙醒过来了！”'],
      ['A stone on the island: "I found a treasure here!"', '小岛上的石头：“我在这里找到了宝物！”'],
      ['A snowman in the rocks. "Brr! How\'s the weather up there?"', '岩石中间的雪人：“呼……上面天气怎么样？”'],
    ],
    markKinds: ['stone', 'stone', 'stone', 'stone', 'stone', 'stone', 'stone', 'stone', 'snowman'],
    items: ['superpotion', 'revive', 'superball', 'icestone', 'fullheal'],
    hiddenItems: ['superball', 'revive', 'fullheal', 'superpotion'],
    npc: {
      1: { role: 'trainer', name: 'Swimmer Kate', look: 'swimmerF', g: 'f', face: 'left', sight: 4, under: '~', types: ['water', 'ice'], n: 2, lv: 1,
        lines: [["Brr! It's cold, but I love swimming!", '呼……好冷，但是我最爱游泳了！']], win: ['I need a hot drink...', '我得喝杯热饮……'], after: [['Surf to the waterfall. Then climb up!', '冲浪到瀑布下面，然后爬上去！']] },
      2: { role: 'trainer', name: 'Hiker Ben', look: 'hiker', g: 'm', face: 'down', sight: 4, types: ['rock', 'ground'], n: 2, lv: 1,
        lines: [['I climbed the waterfall yesterday!', '我昨天爬上了瀑布！']], win: ['You are a strong climber, too!', '你也是个厉害的攀登者！'], after: [['Memory Island is north. It is always foggy there.', '回忆岛在北边，那里总是有雾。']] },
      3: { role: 'trainer', name: 'Ranger Sue', look: 'ranger', g: 'f', face: 'left', sight: 3, types: ['grass', 'ghost'], n: 2, lv: 2,
        lines: [['These stones are very old. Did you read them?', '这些石头很古老。你读过上面的字吗？']], win: ['You read well, and you battle well!', '你读得好，打得也好！'], after: [['"Went", "saw", "spoke"... The stones talk about the past.', '“went、saw、spoke”……石头上说的都是过去的事。']] },
      4: { role: 'trainer', name: 'Skier Max', look: 'skier', g: 'm', face: 'left', sight: 4, types: ['ice', 'normal'], n: 2, lv: 1,
        lines: [["It's snowy and windy. Great weather for skiing!", '又下雪又刮风，最适合滑雪了！']], win: ['I fell in the snow!', '我摔进雪堆里了！'], after: [["What's the weather like? Cold, cold, cold!", '天气怎么样？冷、冷、冷！']] },
      5: { role: 'trainer', name: 'Fisher Tom', look: 'fisher', g: 'm', face: 'left', sight: 3, types: ['water'], n: 2, lv: 1,
        lines: [["It's cloudy today. The fish like cloudy days!", '今天多云，鱼儿喜欢多云的天气！']], win: ['My fish got away!', '我的鱼跑掉了！'], after: [['Take an umbrella. It may rain soon.', '带把伞吧，可能快下雨了。']] },
      6: { role: 'trainer', name: 'Skier Amy', look: 'skier', g: 'f', face: 'right', sight: 4, under: ',', types: ['ice', 'flying'], n: 2, lv: 1,
        lines: [["How's the weather in your town? Here, it's snowing!", '你们那边天气怎么样？这里在下雪！']], win: ['Snow in my boots!', '雪都灌进靴子里了！'], after: [["I'm going home to watch TV. It's too cold!", '我要回家看电视了，太冷了！']] },
    },
  });

  // =====================================================================
  // 第 12 岛 · 回忆岛（雾、古迹、石柱、石头神殿）
  // =====================================================================
  EM.define('t12', {
    kind: 'town', z: 12, name: '回忆岛', en: 'Memory Island', sub: '第 13 岛', theme: 'ruins',
    rows: [
      '####################################',
      '#TTRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRTT#',
      '#T,,RRRRRRRRRRRRRRRRRRRRRRRRRRRR.oT#',
      '#T,,,RRRRRRRRRRRRRKRRRRRRRRRRRRR.TT#',
      '#T,*,.r.....Z.....=.....Z.....rR.TT#',
      '#T,,,..r..........=.........r..RbRT#',
      '#TT...r...........=..........r....T#',
      '#T.==============================.T#',
      '#T...T..........B.=...........T...T#',
      '#T.GGGGG...CCCC...=...MMMM..HHHH..T#',
      '#T.GGGGG...CCCC...=...MMMM..HHHH.oT#',
      '#T.GGGGG...CcCC...=...MmMM..HhHH..T#',
      '#T.GGgGG....=.....=....=.....=....T#',
      '#T...=========================..r.T#',
      '#T,,,.......Z.....=.....Z....RRRRRR#',
      '#T,,,,............=.....r...RRRRRRR#',
      '#T,,,,............=================>',
      '#T,,,..........Z..=.........RRRRRRR#',
      '#TT...T.T.........=..........RRRRRR#',
      '#TT~~~~~~~~~~.....=.....,,,,,..TTTT#',
      '#T~~~~~~~~~~~~....=...HHHH..JJJJ.TT#',
      '#T~~~~~SS~~~~~~...=...HHHH..JJJJ..T#',
      '#T~~~~~So~~~~~~...=...HhHH..JjJJ..T#',
      '#T~~~~~~Z~~~~~....=....=.....=....T#',
      '#TT~~~~~~~~~~.....============....T#',
      '#TTT~~~~~~~~......=,,,,,,,...r....T#',
      '#TTTT~~~~~~.r.....=,,,,,,,..r.....T#',
      '#TTTTT~~~~.T......=.,,,,HHHH..T...T#',
      '#TTTTTT~~.*.......=.,,,,HHHH......T#',
      '#T.EEEE...r...r...=.....HhHH......T#',
      '#T.EEEE.Z...r.....=......=...o.T..T#',
      '#T.EEEE....LLLLLLL=LLLLLL=LLLL...TT#',
      '#T.TT.......B======......=...TT..TT#',
      '#TT..,,,,.T..==....Z..TT..,,,,..TTT#',
      '#TTT.,,,,....==..TTT....,,,,...TTTT#',
      '#############vv#####################',
    ],
    links: { s: 'r11', e: 'v1', K: 'd12a' },
    styles: { G: 'temple' },
    signs: [
      ['Memory Island. The Memory Temple is north.', '回忆岛。回忆神殿在北边。'],
      ['South: Route 12. East: Champion Road.', '往南：12 号路。往东：冠军之路。'],
    ],
    marks: [
      ['A stone guard: "I waited here for a thousand years."', '石头守卫：“我在这里等了一千年。”'],
      ['A stone guard: "Many people visited this temple long ago."', '石头守卫：“很久以前，很多人来参观过这座神殿。”'],
      ['An old stone: "We played here when we were young."', '一块古老的石头：“我们小时候在这里玩过。”'],
      ['An old stone: "The Hush King came from the sea."', '一块古老的石头：“寂静之王是从海里来的。”'],
      ['An old stone: "Yesterday it was foggy. Today it is foggy, too!"', '一块古老的石头：“昨天有雾，今天也有雾！”'],
      ['A stone in the pond: "I saw a big dragon in the sky."', '池塘里的石头：“我看见天上有一条大龙。”'],
      ['An old wall: "Last weekend, I visited my grandparents."', '一面旧墙：“上周末，我去看望了我的祖父母。”'],
      ['A stone: "Welcome to Memory Island. What did you do yesterday?"', '一块石头：“欢迎来到回忆岛。你昨天做了什么？”'],
    ],
    markKinds: ['statue', 'statue', 'stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    items: ['revive', 'superball', 'fullheal', 'superpotion'],
    hiddenItems: ['moonstone', 'revive'],
    people: [
      { id: 'guard12', role: 'guard', badge: 13, x: 31, y: 16, look: 'guard', name: 'Guard Leo', g: 'm', face: 'left',
        say: [['This is the Champion Road. Only trainers with thirteen badges can go.', '这里是冠军之路，只有 13 枚徽章的训练师才能通过。'], ['Win the badge of Memory Island first!', '先拿到回忆岛的徽章吧！']] },
      { id: 'orion', role: 'story', x: 18, y: 4, look: 'orion', name: 'Orion', g: 'm', face: 'down', hideIf: 'm12orion' },
      { id: 'orion2', role: 'story', x: 20, y: 5, look: 'orion', name: 'Orion', g: 'm', face: 'left', showIf: 'm12orion', hideIf: 'ch12' },
      { id: 'monk12', role: 'story', x: 27, y: 8, look: 'monk', name: 'Monk Ren', g: 'm', face: 'down' },
      { id: 'girl12', role: 'talk', x: 9, y: 18, look: 'kidF', name: 'Mei', g: 'f', face: 'right',
        say: [['Last night I had a dream. I saw a big dragon in the sky!', '昨晚我做了个梦，梦见天上有一条大龙！'], ['Did you see it, too?', '你也看见了吗？']], speak: 'I saw a dragon in the sky.' },
      { id: 'old12', role: 'talk', x: 21, y: 29, look: 'grandpa', name: 'Grandpa Tang', g: 'm', face: 'left',
        say: [['When I was young, I climbed the waterfall with my monster.', '我年轻的时候，和我的怪兽一起爬过那道瀑布。'], ['We took a lot of photos. It was great!', '我们拍了好多照片，棒极了！']], speak: 'We took a lot of photos.' },
    ],
  });

  // 回忆神殿 1 楼：刻着古代英语句子的石板，记忆之门要回答石板上的故事
  EM.define('d12a', {
    kind: 'cave', cave: 'temple', z: 12, name: '回忆神殿', en: 'Memory Temple', sub: '回忆岛', lv: 1, dungeon: true,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXX%XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXX:::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXX|XXXXXXXXXXXXXXX',
      'XXXXX::::XXZ:::ZXX::::::XXXXXX',
      'XXXX::::::X:::::X::::::::XXXXX',
      'XXX::o:::::::::::::r:::::::XXX',
      'XXX:::XXX:::::::::::XbXX:::XXX',
      'XXX:::XZX:::XXXXX:::XoXX:::XXX',
      'XXXX::XXX:::XXXXX:::XXXX::XXXX',
      'XXXXb:::::::XXXXX:::::::::XXXX',
      'XX:::::::::::::::::::XX:::XXXX',
      'XX:*::XX::Z:::::::Z::XX::::XXX',
      'XX::::XX:::::::::::::XX::::XXX',
      'XXXXXXXX:::XXXXXXX:::XXXXX:XXX',
      'XX::::XX:::XXXXXXX:::XX:::::XX',
      'XX::Z:::::::::::::::::::Z:::XX',
      'XX::::XX::::::::::::::XX::::XX',
      'XXXXXXXXXXX:::::::XXXXXXXXXXXX',
      'XXXXXXXXXXXXX:::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXeXXXXXXXXXXXXXXX',
    ],
    links: { e: 't12', '%': 'd12b' },
    marks: [
      ['Tablet 1: "Long ago, the Hush King ate all the sounds."', '石板一：“很久以前，寂静之王吞掉了所有的声音。”'],
      ['Tablet 2: "The world was very quiet. People were sad."', '石板二：“世界变得非常安静，人们很难过。”'],
      ['Tablet 3: "Then the people spoke together. They were loud and happy."', '石板三：“后来，人们一起大声说话，又响亮又快乐。”'],
      ['Tablet 4: "Echodrake heard them. It woke up and flew to the sea."', '石板四：“回声龙听见了，它醒过来，飞向了大海。”'],
      ['Tablet 5: "Echodrake closed the sea door with thirteen crystals."', '石板五：“回声龙用十三颗水晶关上了海底的门。”'],
      ['Tablet 6: "Remember! Words can make friends."', '石板六：“记住！话语能交到朋友。”'],
      ['Tablet 7: "We remembered the old words, and we were not afraid."', '石板七：“我们记住了古老的词语，就不再害怕了。”'],
    ],
    markKinds: ['stone', 'stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    items: ['superpotion', 'fullheal'],
    hiddenItems: ['revive'],
    people: [
      { id: 'tg1', role: 'trainer', x: 14, y: 16, look: 'grunt', name: 'Hush Grunt', g: 'm', face: 'down', sight: 3, types: ['dark', 'ghost'], n: 2, lv: 2,
        lines: [["Shh! Mr. Mute doesn't want visitors!", '嘘！默先生不想见客人！']], win: ['Shh... that was loud.', '嘘……你也太响了。'], after: [['Read the tablets. The door asks about them.', '读读石板吧。那扇门会问上面的事。']] },
      { id: 'tg2', role: 'trainer', x: 20, y: 11, look: 'gruntF', name: 'Hush Grunt', g: 'f', face: 'left', sight: 5, types: ['poison', 'dark'], n: 2, lv: 2,
        lines: [['I forgot all my words... and I was happy!', '我把话全忘了……我可开心了！']], win: ['Maybe words are not so bad...', '也许说话也没那么糟……'], after: [['I remember a word now: "sorry".', '我现在想起一个词了：“sorry”。']] },
      { id: 'tg3', role: 'trainer', x: 25, y: 13, look: 'grunt', name: 'Hush Grunt', g: 'm', face: 'up', sight: 4, types: ['dark', 'steel'], n: 3, lv: 2,
        lines: [["Yesterday I was a quiet boy. Today I'm a quiet man!", '昨天我是个安静的男孩，今天我是个安静的男人！']], win: ["I'm not quiet now. I'm sad!", '我现在不安静了，我难过！'], after: [['Go up. The boss is waiting at the sea door.', '上去吧，老大就在海底之门那里等着。']] },
    ],
  });

  // 神殿深处 · 封印之间：海底之门（水池）、十二颗水晶、默先生
  EM.define('d12b', {
    kind: 'cave', cave: 'temple', z: 12, name: '封印之间', en: 'The Sea Door', sub: '回忆神殿', lv: 1, dungeon: true,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXZXXXXXZXXXXXXX',
      'XXXXXZX:::~~~:::XZXXX',
      'XXXX:::::~~~~~:::::XX',
      'XXXZ::::~~~~~~~::::ZX',
      'XXX::::::~~~~~::::::X',
      'XXZ:::::::::::::::::X',
      'XXX:::::::::::::::Z:X',
      'XXX:::Z:::::::::::::X',
      'XXXX:::::::::::::::XX',
      'XXXXX::::::::::::XXXX',
      'XXXXXXX:::::::XXXXXXX',
      'XXXXXXXXX:%:XXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXX',
    ],
    links: { '%': 'd12a' },
    // 十二颗水晶摆在海底之门四周（这里放了九颗）
    marks: [
      ['The Color Crystal. Red, yellow, blue and green!', '颜色水晶。红、黄、蓝、绿！'],
      ['The Family Crystal. It feels warm, like a home.', '家庭水晶。暖暖的，像一个家。'],
      ['The School Crystal. You can hear a school bell inside.', '校园水晶。里面好像有上课铃声。'],
      ['The Subject Crystal. Math, English, science...', '学科水晶。数学、英语、科学……'],
      ['The Club Crystal. Somebody is singing inside!', '社团水晶。里面有人在唱歌！'],
      ['The Clock Crystal. Tick, tock, tick, tock.', '时钟水晶。滴答，滴答。'],
      ['The Party Crystal. Happy birthday!', '派对水晶。生日快乐！'],
      ['The Animal Crystal. It has a long tail and big ears.', '动物水晶。它有长长的尾巴和大耳朵。'],
      ["The Rule Crystal. Don't run! Be quiet in the library!", '规则水晶。不要跑！在图书馆要安静！'],
    ],
    markKinds: ['crystal', 'crystal', 'crystal', 'crystal', 'crystal', 'crystal', 'crystal', 'crystal', 'crystal', 'crystal'],
    people: [
      { id: 'mute', role: 'story', x: 10, y: 6, look: 'mute', name: 'Mr. Mute', g: 'm', face: 'down', hideIf: 'ch12' },
    ],
  });

  // 回忆道馆：翻牌配对（英文 ↔ 中文），配完一组，这组上面的机关墙就消失
  const G12_ROWS = [
    'WWWWWWWWWWWWW',
    'Wk____1____kW',
    'Wp_________pW',
    'W____uuu____W',
    'WWWWWW|WWWWWW',
    'W__Z_____Z__W',
    'W___________W',
    'W___________W',
    'WWWWWW|WWWWWW',
    'W___________W',
    'W___________W',
    'W___________W',
    'WWWWWW|WWWWWW',
    'W___________W',
    'W___________W',
    'W___________W',
    'Wp____u____pW',
    'W_____u_____W',
    'WWWWWWeWWWWWW',
  ];
  // 牌：三组（从下往上），每组 4 张 = 2 对；pair 是第几对，en 英文牌 / 中文牌
  const MEM_PAIRS = [['went', '去了', '🚶'], ['saw', '看见了', '👀'], ['ate', '吃了', '🍽️'], ['bought', '买了', '🛍️'], ['trip', '旅行', '🧳'], ['beach', '海滩', '🏖️']];
  const MEM_SECTIONS = [
    { y: 14, gate: 2, cards: [[0, 'en'], [1, 'zh'], [0, 'zh'], [1, 'en']] },
    { y: 10, gate: 1, cards: [[3, 'zh'], [2, 'en'], [3, 'en'], [2, 'zh']] },
    { y: 6, gate: 0, cards: [[4, 'en'], [5, 'en'], [5, 'zh'], [4, 'zh']] },
  ];
  const MEM_X = [2, 4, 8, 10];
  const MEM_CARDS = [];
  MEM_SECTIONS.forEach((s, si) => s.cards.forEach(([pair, side], k) => MEM_CARDS.push({ x: MEM_X[k], y: s.y, pair, side, sec: si, i: MEM_CARDS.length })));
  const G12_PAINT = { '?': { c: '#6a5acd', t: '?', tc: '#ffe082' } };
  MEM_CARDS.forEach(c => {
    const p = MEM_PAIRS[c.pair], t = c.side === 'en' ? p[0] : p[1];
    G12_PAINT['abcdefghijkl'[c.i]] = { c: '#fff8e1', t, tc: '#4e342e' };
    G12_PAINT['ABCDEFGHIJKL'[c.i]] = { c: '#b9f6ca', t, tc: '#1b5e20' };
  });
  EM.define('i12G', {
    kind: 'inside', z: 12, room: 'G', name: '回忆道馆', en: 'Memory Gym', sub: '回忆岛',
    pal: { floor: '#e6dccb', floor2: '#d9ccb6', wall: '#f3ecdf', trim: '#6d4c41', rug: '#8d6e63' },
    rows: G12_ROWS,
    over: G12_ROWS.map((r, y) => [...r].map((c, x) => MEM_CARDS.some(q => q.x === x && q.y === y) ? '?' : '.').join('')),
    paint: G12_PAINT,
    links: { e: 't12' },
    npc: { 1: { role: 'leader' } },
    people: [
      { id: 'mt1', role: 'trainer', x: 11, y: 15, look: 'student', name: 'Student Jack', g: 'm', face: 'left', sight: 3, types: ['psychic', 'normal'], n: 2, lv: 1,
        lines: [['I went to the beach last summer. Did you?', '去年夏天我去了海滩。你去了吗？']], win: ['I saw a strong trainer today!', '我今天看见了一个很强的训练师！'], after: [['Step on a card to turn it over. Find the pairs!', '踩在牌上就能翻开它。把一对对找出来！']] },
      { id: 'mt2', role: 'trainer', x: 1, y: 9, look: 'studentF', name: 'Student Anna', g: 'f', face: 'right', sight: 4, types: ['psychic', 'normal'], n: 2, lv: 2,
        lines: [['What did you do last weekend? I bought a new book!', '你上周末做了什么？我买了一本新书！']], win: ['I ate too much candy and lost!', '我糖吃多了，输了！'], after: [['"Ate" is the past of "eat". "Bought" is the past of "buy".', '“ate”是“eat”的过去式，“bought”是“buy”的过去式。']] },
      { id: 'mt3', role: 'trainer', x: 8, y: 7, look: 'monk', name: 'Monk Sen', g: 'm', face: 'left', sight: 2, types: ['ghost', 'dragon'], n: 3, lv: 2,
        lines: [['Remember your trip. Remember every word.', '记住你的旅程，记住每一个词。']], win: ['Your memory is very good.', '你的记性真好。'], after: [['The Memory Dragon is waiting. Tell it about your past!', '回忆巨龙在等你。跟它讲讲你的过去吧！']] },
    ],
  });

  // =====================================================================
  // 冠军之路：入口高地 v1 → 洞窟 1 楼 v2（漆黑，怪力 / 碎岩 / 地下湖）→ 洞窟 2 楼 v3（小凯）→ 冠军高原 vL
  // =====================================================================
  EM.define('v1', {
    kind: 'route', z: 12, name: '冠军之路', en: 'Champion Road', sub: '回忆岛 → 英语冠军赛', theme: 'clock', lv: 2,
    rows: [
      '##############################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRRRKRRRRRRR#',
      '#TT.,,,,.RRRRRRRR...Z=Z..o.RR#',
      '#T..,,,,..RRRRRR.....=......R#',
      '#T..,,,,.....RR....2.=..TT..R#',
      '#TT..........RR......=..TT..R#',
      '#RRRRRRLLLLLLRR..=====......R#',
      '#RRRR......,,,,..=..RRRRRLLLR#',
      '#TT.....B..,,,,..=..RRRRR...R#',
      '#T.......,,,,,,..=...,,,,...R#',
      '<=================...,,,,.3.R#',
      '<==.......,,,,,,..=..,,,,...R#',
      '#T.........,,,,,..=.........R#',
      '#TT....1..........=..RRRRRRRR#',
      '#RRRRLLLLLLRRRR...=..R.....*R#',
      '#R.......,,,,,R...=..R..RR..R#',
      '#R..o....,,,,,R..==..R..RR..R#',
      '#R.......,,,,,....=.....,,,.R#',
      '#RR.........*.....=.....,,,.R#',
      '#RRRRR..TT....TT..=...TT....R#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
    ],
    links: { w: 't12', K: 'v2' },
    signs: [['Champion Road. Only the strongest trainers go this way!', '冠军之路。只有最强的训练师才走这条路！']],
    marks: [
      ['A stone lion. "Speak clearly, and you will win."', '一座石狮子：“说得清楚，你就会赢。”'],
      ['A stone lion. "Thirteen islands, thirteen badges."', '一座石狮子：“十三座岛，十三枚徽章。”'],
    ],
    markKinds: ['statue', 'statue'],
    items: ['fullheal', 'revive'],
    hiddenItems: ['superpotion', 'superball'],
    npc: {
      1: { role: 'trainer', name: 'Ace Trainer Rosa', look: { skin: '#ffe0c8', hair: '#c62828', style: 'ponytail', eye: '#6a1b9a', shirt: '#ffffff', jacket: '#283593', bottom: '#1a237e', skirt: true, shoes: '#ffffff', bag: '#ffca28' }, g: 'f', face: 'right', sight: 5, types: ['fire', 'grass', 'water'], n: 3, lv: 3,
        lines: [["Hello! Nice to meet you! What's your name? Let's battle!", '你好！很高兴认识你！你叫什么名字？来对战吧！']], win: ['You remember the first words you learned!', '你还记得你学的第一句英语！'], after: [['On Hello Island, we all said "Hello!" first.', '在你好岛，我们每个人最先说的都是“Hello！”']] },
      2: { role: 'trainer', name: 'Ace Trainer Leo', look: { skin: '#f1c7a0', hair: '#1b1b1b', style: 'spiky', eye: '#3a2a20', shirt: '#ffffff', jacket: '#283593', bottom: '#1a237e', shoes: '#ffffff' }, g: 'm', face: 'down', sight: 4, types: ['spark', 'steel', 'flying'], n: 3, lv: 3,
        lines: [["I can swim, and I can sing. Can you beat me?", '我会游泳，也会唱歌。你能打败我吗？']], win: ['You can do it! You did it!', '你能做到！你真的做到了！'], after: [['Clubs, birthdays, animals... we learned so much.', '社团、生日、动物……我们学了好多。']] },
      3: { role: 'trainer', name: 'Veteran Gus', look: 'grandpa', g: 'm', face: 'left', sight: 3, types: ['rock', 'ground', 'fight'], n: 3, lv: 4,
        lines: [["It's seven o'clock. Time to battle!", '七点了，该对战了！']], win: ["Don't break the rules... and don't give up!", '不要破坏规则……也不要放弃！'], after: [['Eat well, keep fit, and speak English every day!', '好好吃饭，锻炼身体，每天说英语！']] },
    },
  });

  // 冠军之路洞窟 1 楼：漆黑（要闪光）。南边大厅 → 碎岩 → 怪力推石 → 冲浪过地下湖 → 北边迷宫 → 楼梯
  EM.define('v2', {
    kind: 'cave', cave: 'rock', z: 12, name: '冠军之路 洞窟 1 楼', en: 'Champion Road Cave 1F', sub: '冠军之路', dark: true, dungeon: true, lv: 3,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XX:::::XXX::::::::XXXXXXX:::::::XXXXX%XX',
      'XX:::::XXX::XXXX::XXXXXXX::XXXX4XXXXX:XX',
      'XX:::::b::::XXXX:::::::::::XX:::::::::XX',
      'XXXXXXXXXXX:XXXX:XXXXXX::XXXX:XXXXXXXXXX',
      'XX::::o:::::XXXX:XXXXXX::XXXX:::::::oXXX',
      'XX:XXXXXXXXXXXXX:::XXXX::::::::XXXX::XXX',
      'XX:XXX::::::::XX:X:XXXXXXXXXXXXXXXX::XXX',
      'XX:::::XXXXX::::::::::::3::XXXX::::::XXX',
      'XXXXXX:XXXXX:XXXXXXXXX::XX:XXXX:XXXXXXXX',
      'XX*:::::::XX:XXXXXXXXX::XX::::::XXXXXXXX',
      'XXXXXXXXX:XX::::::::::::XXXXXXX::::::XXX',
      'XXXX::::::XXXXXXXXXXX::::XXXXXXXXXXX:XXX',
      'XX::::::::::::::::::::::::::::::::::::XX',
      'XX~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~XX',
      'XX~~~~~~~~~~~~~~~~::o~~~~~~~~~~~~~~~~~XX',
      'XX~~~~~~~~~~~~~~~~:::~~~~~~~~~~~~~~~~~XX',
      'XX~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~XX',
      'XX::::::::2:::::::::::::::::::::::::::XX',
      'XXXXXX:XXXXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXXXXX:XXXXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXX::::::XXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXX:*::::XXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXX::::::XXXXXXXXXOXXXXXXXXXXXXXXXXOXXXX',
      'XXXXXX:XXXXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXXXXX:XXXXXXXXXXX:XXXXXXXXXXXXXXXX:XXXX',
      'XXXXXX:::::XXXXXXXbXXXXXXXXXXXXXXXX:XXXX',
      'XXXXXXXXXXXXXXXXX:::XXXXXXXXXXXXX::::XXX',
      'XX::o:XXXX:::::::::::::::::::::::XXX:XXX',
      'XX::::b:::::::::::1::::::::::::::XXX:XXX',
      'XX::::XXXX::::::::::::::::::::::::bb:XXX',
      'XXXXXXXXXX:::::::::::::::::::::::XXXXXXX',
      'XXXXXXXXXXXXXXXX:::::::XXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXeXXXXXXXXXXXXXXXXXXXX',
    ],
    links: { e: 'v1', '%': 'v3' },
    items: ['fullheal', 'revive', 'superpotion', 'superball', 'revive'],
    hiddenItems: ['moonstone', 'sunstone', 'fullheal'],
    npc: {
      1: { role: 'trainer', name: 'Black Belt Kenji', look: 'strong', g: 'm', face: 'left', sight: 4, types: ['fight', 'rock'], n: 3, lv: 4,
        lines: [["I get up at five o'clock and train every day!", '我每天五点起床训练！']], win: ['My daily plan needs more English!', '我的作息表里得加点英语了！'], after: [['Smash the cracked rocks. Push the big ones.', '有裂缝的石头打碎，大石头推开。']] },
      2: { role: 'trainer', name: 'Ace Trainer Mona', look: 'swimmerF', g: 'f', face: 'right', sight: 5, types: ['water', 'dragon', 'ice'], n: 3, lv: 4,
        lines: [["It's dark and cold here. How's the weather outside?", '这里又黑又冷。外面天气怎么样？']], win: ["You're as bright as the sun!", '你像太阳一样耀眼！'], after: [['Surf across the lake. The stairs are in the north.', '冲浪过湖，楼梯在北边。']] },
      3: { role: 'trainer', name: 'Psychic Rin', look: 'studentF', g: 'f', face: 'down', sight: 3, types: ['psychic', 'ghost'], n: 3, lv: 4,
        lines: [['I can see your past. You helped many people!', '我能看见你的过去。你帮助过很多人！']], win: ["I didn't see that coming!", '这个我可没算到！'], after: [['A giant made of iron sleeps in the west.', '西边睡着一个铁做的巨人。']] },
      4: { role: 'trainer', name: 'Ace Trainer Owen', look: 'athlete', g: 'm', face: 'down', sight: 1, types: ['steel', 'fire', 'normal'], n: 3, lv: 5,
        lines: [['My favourite subject is P.E. And English!', '我最喜欢的科目是体育，还有英语！']], win: ['You are the best student!', '你是最棒的学生！'], after: [['Go up the stairs. Someone is waiting for you.', '上楼去吧，有人在等你。']] },
    },
  });

  // 冠军之路洞窟 2 楼：有光从北边照进来；出口前小凯在等你
  EM.define('v3', {
    kind: 'cave', cave: 'rock', z: 12, name: '冠军之路 洞窟 2 楼', en: 'Champion Road Cave 2F', sub: '冠军之路', dark: false, dungeon: true, lv: 3,
    rows: [
      'XXXXXXXXXXXXXXXXX^^XXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXX::::XXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXX::::::XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXX::::XXXXXXXXXXXXXXXX',
      'XX:::::XXXXXXXXXX::XXXXXXXXXXX::o::X',
      'XX::o::XXXXXXXXXX::XXXXXXXXXXX:::::X',
      'XX:::::::::::XXXX::XXXX::::::::::::X',
      'XXXX:XXXXXXX:XXXX::XXXX:XXXXXXXXXXXX',
      'XXXX:XXXXXXX::::::::::::XXXXXXXXXXXX',
      'XX::::::::XXXXXXX::XXXXXXX:::::::XXX',
      'XX::XXXX::XXXXXXX::XXXXXXX:XXXXX:XXX',
      'XX::X*:X::::::::::::::::::::X::X:XXX',
      'XX::X::X::XXXXXXXXXXXXXXXX:XX::X:XXX',
      'XX::XbXX::X::::::::::::::X:XX::X:XXX',
      'XX::::::::X::XXXXXXXXXX::X:::::X:XXX',
      'XXXXXXXXX:X::X::::::::X::X:XXXXX:XXX',
      'XX:::::XX:X::X::XXXX::X::X:XXXXX:XXX',
      'XX:::::XX:X::X::X%XX::X::X:::::::XXX',
      'XX::o::XX::::::::::::::::XXXXXXX:XXX',
      'XX:::::XXXXXXXXXXX:XXXXXXXXXXXXX:XXX',
      'XXXX:XXXXXXXXXXXXX:XXXXXXXXXX::::::XX',
      'XXXX::::::::::::::::::::::::::XXX::XX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*::XX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ].map(r => r.slice(0, 36)),
    links: { n: 'vL', '%': 'v2' },
    items: ['revive', 'fullheal', 'superpotion'],
    hiddenItems: ['revive', 'sunstone'],
    npc: {
      1: { role: 'trainer', name: 'Ace Trainer Iris', look: 'athlete', g: 'f', face: 'right', sight: 4, types: ['grass', 'flying', 'normal'], n: 3, lv: 4,
        lines: [['My family came to see me! My mom, my dad and my sister!', '我的家人都来看我了！妈妈、爸爸还有妹妹！']], win: ['My family is still proud of me.', '我的家人还是为我骄傲。'], after: [['The exit is north. The light is so bright!', '出口在北边，外面的光好亮！']] },
      2: { role: 'trainer', name: 'Ace Trainer Sam', look: 'student', g: 'm', face: 'up', sight: 3, types: ['dark', 'bug', 'poison'], n: 3, lv: 4,
        lines: [["Where is the library? Just kidding! Let's battle!", '图书馆在哪里？开玩笑的！来对战吧！']], win: ['You know your way!', '你很会认路嘛！'], after: [['Some paths go nowhere. Try another way.', '有些路是死路，换条路试试。']] },
      3: { role: 'trainer', name: 'Veteran Ada', look: 'granny', g: 'f', face: 'left', sight: 4, types: ['dragon', 'ice', 'ghost'], n: 3, lv: 5,
        lines: [['Happy birthday? No, happy battle day!', '生日快乐？不，是对战快乐！']], win: ['What a gift! A great battle!', '真是一份好礼物——一场精彩的对战！'], after: [['A boy with green hair is waiting at the exit.', '一个绿头发的男孩在出口等着。']] },
    },
    people: [
      { id: 'kai', role: 'story', x: 17, y: 3, look: 'kai', name: 'Kai', g: 'm', face: 'down', hideIf: 'kai_final' },
    ],
  });

  // 冠军高原：英语冠军赛会场（体育场）、怪兽中心、商店
  EM.define('vL', {
    kind: 'route', noGrass: true, z: 12, name: '冠军高原', en: 'Champion Plateau', sub: '英语冠军赛', theme: 'lab',
    rows: [
      '##########################',
      '#TT....AAAAAAAAAAAA....TT#',
      '#T.....AAAAAAAAAAAA.....T#',
      '#T..Z..AAAAAAAAAAAA..Z..T#',
      '#T.....AAAAAAAAAAAA.....T#',
      '#T.....AAAAAaAAAAAA.....T#',
      '#TFF........=........FFTT#',
      '#TFF.......===.......FFTT#',
      '#T.......B.===..........T#',
      '#T..CCCC...===...MMMM...T#',
      '#T..CCCC....=....MMMM...T#',
      '#T..CcCC....=....MmMM...T#',
      '#T...=======Z=======....T#',
      '#T.........===..........T#',
      '#TT...FF....=....FF....TT#',
      '#TT..FFF....=....FFF...TT#',
      '#TTT........=.........TTT#',
      '#TTTT.......=........TTTT#',
      '#############vv###########',
    ],
    links: { s: 'v3' },
    doors: { A: 'i12L', C: 'vLC', M: 'vLM' },
    styles: { A: 'stadium' },
    signs: [['The English League. Four masters and the Champion are waiting!', '英语冠军赛。四位大师和冠军在里面等你！']],
    marks: [
      ['A golden trophy. "Speak, and be heard!"', '一座金奖杯：“开口说，就会被听见！”'],
      ['A golden trophy. "Every word is a step."', '一座金奖杯：“每一个词都是一步。”'],
      ['A fountain. The water sings in the wind.', '一座喷泉，水声在风里像在唱歌。'],
    ],
    markKinds: ['trophy', 'trophy', 'fountain'],
    people: [
      { id: 'fan12', role: 'talk', x: 20, y: 13, look: 'kid', name: 'Fan Toby', g: 'm', face: 'left',
        say: [['Wow! You came up the Champion Road! I watched the League on TV last year.', '哇！你是从冠军之路上来的！去年我在电视上看了冠军赛。'], ['The Champion was amazing. I want to be like her one day!', '冠军太厉害了，我以后也想像她一样！']], speak: 'I want to be the Champion!' },
    ],
  });
  EM.define('vLC', {
    kind: 'inside', z: 12, room: 'C', name: '冠军高原 · 怪兽中心', en: 'Monster Center', sub: '冠军高原',
    rows: ['WWWWWWWWWWW', 'Wk___1___kW', 'W__QQQQQ__W', 'W_________W', 'WP_______pW', 'W__uuuuu__W', 'Wp_uuuuu_YW', 'W____u____W', 'WWWWWeWWWWW'],
    links: { e: 'vL' }, npc: { 1: { role: 'nurse' } },
  });
  EM.define('vLM', {
    kind: 'inside', z: 12, room: 'M', name: '冠军高原 · 商店', en: 'Shop', sub: '冠军高原',
    rows: ['WWWWWWWWWWW', 'Wk_1_kkkkkW', 'WQQQQ_____W', 'W_________W', 'W__YY_YY__W', 'W__YY_YY__W', 'Wp_______pW', 'W____u____W', 'WWWWWeWWWWW'],
    links: { e: 'vL' }, npc: { 1: { role: 'clerk' } },
  });

  // 英语冠军赛大厅：北墙的出口通第一位大师的房间（i121–i125 用老模板）
  EM.define('i12L', {
    kind: 'inside', z: 12, room: 'L', name: '英语冠军赛 · 大厅', en: 'English League', sub: '冠军高原',
    rows: [
      'WWWWW^WWWWW',
      'W_1_____2_W',
      'WQQQ___QQQW',
      'W_________W',
      'WZ___u___ZW',
      'W____u____W',
      'Wp___u___pW',
      'W____u__3_W',
      'W____u____W',
      'WWWWWeWWWWW',
    ],
    links: { e: 'vL', n: 'i121' },
    npc: {
      1: { role: 'nurse' }, 2: { role: 'clerk' },
      3: { role: 'talk', name: 'Guide Emma', look: 'teacher', g: 'f', face: 'left',
        say: [['Welcome to the English League!', '欢迎来到英语冠军赛！'], ['Four Masters and the Champion are waiting. Each of them has a special rule.', '四位大师和冠军在等你，每个人都有自己的特别规则。'], ['After you win a room, the next door opens. Your progress is saved.', '赢下一个房间，下一扇门就会打开，进度会保存。'], ['Heal your team here, and buy what you need. Good luck!', '在这里恢复队伍、买好需要的东西。祝你好运！']], speak: 'I am ready for the English League!' },
    },
  });

  // ---------------------------------------------------------------------
  // 下面是剧情（地图检查只加载上面的地图，没有 EchoStory 就到此为止）
  // ---------------------------------------------------------------------
  const ST = window.EchoStory;
  if (!ST) return;
  const L = ST.lib, P = window.EchoPeople, nar = L.nar;
  const N = (en, zh, x) => Object.assign(nar(en, zh), x || {});   // 旁白（可以带任务）
  const STORM = 'brightness(.9) saturate(.5) contrast(.9) hue-rotate(-8deg)';   // 暴雪：画面灰蓝
  const FOG = 'brightness(1.05) saturate(.55) contrast(.78)';                     // 雾：画面发白
  // 滤镜换地图时引擎会清掉；但是对战输了被送回怪兽中心不经过换地图，所以走一步时再检查一次
  let filtered = false;
  const setFilter = (C, css) => { C.filter(css); filtered = !!css; };
  const unfilter = C => { if (filtered) setFilter(C, ''); return null; };

  // ---------- 小工具 ----------
  const free = (C, x, y) => EM.WALK.includes(C.tile(x, y)) && !C.npc(n => n.x === x && n.y === y) && !(C.pl.x === x && C.pl.y === y);
  // 让一个人从 1–4 格外走过来，站到主角面前；n._back 记着他从哪边来（走的时候原路回去）
  async function approach(C, spec) {
    const pl = C.pl;
    for (const [dx, dy, toMe, back] of [[0, -1, 'down', 'up'], [1, 0, 'left', 'right'], [-1, 0, 'right', 'left'], [0, 1, 'up', 'down']]) {
      let d = 0;
      while (d < 4 && free(C, pl.x + dx * (d + 1), pl.y + dy * (d + 1))) d++;
      if (!d) continue;
      const n = C.spawn(Object.assign({ x: pl.x + dx * d, y: pl.y + dy * d, face: toMe }, spec));
      n._back = back;
      await C.alert(n);
      if (d > 1) await C.walk(n, toMe, d - 1, 170);
      C.faceEach(n);
      return n;
    }
    const n = C.spawn(Object.assign({ x: pl.x, y: pl.y - 1, face: 'down' }, spec));
    C.faceEach(n);
    return n;
  }
  // 和嘘声团打：地图上的人造型写的是名字，lib 要造型对象，所以传一个带造型的替身
  function hush(C, n, key, o) {
    if (n) C.faceEach(n);
    const stand = n ? Object.assign({}, n, { look: typeof n.look === 'string' ? P.LOOKS[n.look] : n.look }) : null;
    return L.hushFight(C, stand, key, o);
  }
  async function leave(C, n, dir, steps) { if (!n) return; await C.walk(n, dir || n._back || 'up', steps || 4, 150); C.remove(n); }

  // =====================================================================
  // 第 11 岛 · 天气岛：Rain or Shine
  // 暴雪不停（村民问天气）→ 气象台斯凯博士：问收音机要天气预报 → 打败塔门口的团员 → 气象塔 1 楼冰面 + 控制台
  // → 塔顶连打低语、闷雷 → 按预报顺序关掉天气机 → 雪停了、夺回天气水晶 → 台长送攀瀑
  // =====================================================================
  const SKYE = L.sayer('Dr. Skye', 'weather', 'f');
  const RADIO = (en, zh, x) => Object.assign({ who: 'Radio', emo: '📻', en, zh }, x || {});
  const SEQ = ['sunny', 'rainy', 'windy'];
  const WX = { sunny: ['☀️', 'Sunny', '晴天'], rainy: ['🌧️', 'Rainy', '下雨'], windy: ['🌬️', 'Windy', '刮风'], snowy: ['❄️', 'Snowy', '下雪'], cloudy: ['☁️', 'Cloudy', '多云'] };

  async function snowIntro(C) {
    await C.talk([
      nar('Whoooosh! A big snowstorm is blowing.', '呼——！暴风雪刮得正猛。'),
      nar('It is very cold. There is nobody in the street.', '好冷啊，街上一个人也没有。'),
    ]);
    const V = L.sayer('Skier Sam', 'skier', 'm');
    const v = await approach(C, { look: P.LOOKS.skier, name: 'Skier Sam', g: 'm' });
    await C.talk([
      V('Brr! Hello! Are you a trainer? You came in this snow?', '呼……你好！你是训练师吗？这么大的雪你也来了？'),
      L.ask(V, "What's the weather like today?", '他问你今天天气怎么样。看看四周，选出正确的回答，再大声说出来。', "It's snowy and cold.", ["It's sunny and hot.", "I'm watching TV."],
        { fail: () => [V("Look around! It's snowy and cold.", '你看看四周！又下雪又冷呀。')] }),
      V("Yes, it's snowy and cold. It's snowing every day. It never stops!", '对，又下雪又冷。天天都在下雪，一直不停！'),
      V('Team Hush built a weather machine on top of the Weather Tower.', '嘘声团在气象塔顶上造了一台天气机。'),
      V('They want everyone to stay at home and be quiet.', '他们想让大家都待在家里，不出门、不说话。'),
      V('Dr. Skye at the Weather Station knows all about weather. Please go and see her!', '气象台的斯凯博士最懂天气了，快去找她吧！'),
      nar('The Weather Station is the round building with the glass roof.', '气象台就是那栋玻璃圆顶的房子。'),
    ]);
    C.set('w11in');
    await leave(C, v);
  }

  async function giveFalls(C) {
    await C.talk([
      SKYE('Please take this. It is the HM Waterfall.', '这个送给你，秘传学习器「攀瀑」。', { onShow: () => { if (!C.flag('got_falls')) { C.give('hm_falls'); C.set('got_falls'); } } }),
      SKYE('With twelve badges, a water monster can climb up a waterfall.', '有了 12 枚徽章，水系怪兽就能爬上瀑布。'),
      SKYE('The Waterfall River is north of town. Memory Island is above the waterfall.', '瀑布河就在镇子北边，瀑布上面就是回忆岛。'),
      L.speak(C, 'Thank you, Dr. Skye!', '向斯凯博士道谢'),
    ]);
  }

  async function skyeTalk(C, n) {
    C.faceEach(n);
    if (!C.flag('w11fc')) {
      await C.talk([
        SKYE("Oh! A visitor in this storm! I'm Dr. Skye. I study the weather.", '哎呀，这么大的风雪还有人来！我是斯凯博士，研究天气的。'),
        SKYE('The weather machine is on the top of the Weather Tower.', '天气机就在气象塔的顶上。'),
        SKYE('It has weather buttons. To turn it off, press them in the order of the real forecast.', '机器上有天气按钮。要关掉它，得按「真正的天气预报」的顺序去按。'),
        SKYE("Let's ask my radio for tomorrow's forecast. Can you ask it?", '我们问问收音机明天的天气预报吧。你来问好吗？'),
        L.speak(C, "What's the weather like tomorrow?", '对着收音机大声问：明天天气怎么样？'),
        RADIO('Good morning! Here is the weather report. Tomorrow will be sunny, then rainy, then windy.', '（仔细听收音机里的天气预报！点右上角的喇叭可以再听一遍）', { hideEn: true }),
        L.ask(SKYE, 'What did the radio say? What is the order?', '收音机说了什么？选出天气的顺序，再说出来。', 'Sunny, then rainy, then windy.', ['Rainy, then sunny, then windy.', 'Windy, then snowy, then sunny.'],
          { fail: () => [SKYE("Listen again. It's sunny, then rainy, then windy.", '再听一遍：先晴天，再下雨，然后刮风。')] }),
        SKYE('Right! Sunny, then rainy, then windy. Remember the order!', '对！先晴天，再下雨，然后刮风。记住这个顺序！'),
        SKYE('A Hush Grunt is standing at the tower door. Please be careful!', '塔门口站着一个嘘声团员，千万小心！'),
      ]);
      C.set('w11fc');
      return;
    }
    if (C.flag('ch11') && !C.flag('got_falls')) { await C.talk([SKYE('Thank you so much! The snow stopped, and the sun is out!', '太感谢你了！雪停了，太阳出来了！')]); await giveFalls(C); return; }
    if (!C.flag('ch11')) {
      await C.talk([SKYE('Remember the forecast: sunny, then rainy, then windy.', '记住天气预报：先晴天，再下雨，然后刮风。'), SKYE('The weather machine is on the top of the tower. Good luck!', '天气机在塔顶上。祝你好运！')]);
      return;
    }
    await C.talk([
      SKYE("Look at the sky! It's sunny and warm today.", '看看天空！今天晴朗又暖和。'),
      L.ask(SKYE, "How's the weather today?", '斯凯博士问你今天天气怎么样。', "It's sunny and warm.", ["It's snowing.", "I'm reading."]),
      SKYE('Climb the waterfall on Route 12. Memory Island is waiting for you.', '去爬 12 号路的瀑布吧，回忆岛在等你。'),
    ]);
  }

  async function doorGrunt(C, n) {
    const H = L.sayer('Hush Grunt', 'grunt', 'm');
    C.faceEach(n);
    if (!C.flag('w11fc')) {
      await C.talk([
        H('Shh! The tower is closed. Go home and stay inside!', '嘘！塔关门了。回家去，待在屋里！'),
        H('Nobody can stop the snow. Nobody knows the right order! Ha!', '谁也停不了这场雪，谁都不知道正确的顺序！哈！'),
        nar('The right order...? Maybe Dr. Skye at the Weather Station knows.', '正确的顺序……？也许气象台的斯凯博士知道。'),
      ]);
      return;
    }
    const res = await hush(C, n, 'grunt', {
      lines: [["What? You know the forecast? You can't go in!", '什么？你知道天气预报了？不许进去！']], types: ['ice', 'dark'], n: 2,
      win: ['Shh... Fine, go up. Whisper and Rumble are waiting at the top!', '嘘……好吧，上去吧。低语和闷雷在塔顶等着你！'],
    });
    if (res !== 'win') return;
    C.set('w11door');
    await C.walk(n, 'right', 1, 160);
    C.remove(n);
  }

  // 气象塔 1 楼的控制台：答对一个天气问题，楼梯前的门就开了
  async function towerPanel(C) {
    const PNL = (en, zh, x) => Object.assign({ who: 'Control Panel', emo: '🎛️', en, zh }, x || {});
    if (C.gateOpen(0)) { await C.talk([PNL('The door to the stairs is open.', '通往楼梯的门已经开了。')]); return; }
    let ok = false;
    await C.talk([
      PNL('Beep! Security question. Please answer in English.', '哔！安全问题，请用英语回答。'),
      L.ask(PNL, 'Is it cold there?', '控制台问：那里冷吗？看看窗外，选出正确的回答再说出来。', "Yes, it's snowing.", ['Yes, I am.', "It's my coat."],
        { pass: () => { ok = true; return []; }, fail: () => [PNL('Wrong answer. Look out of the window and try again!', '回答错了。看看窗外，再试一次！')] }),
    ]);
    if (!ok) return;
    C.openGate(0, true);
    await C.talk([PNL('Correct! The door is open.', '回答正确！门开了。')]);
  }

  // 塔顶：连打低语和闷雷，然后按预报的顺序关掉天气机
  async function towerTop(C) {
    const W = L.sayer('Admin Whisper', 'whisper', 'f'), Rb = L.sayer('Admin Rumble', 'rumble', 'm');
    const wh = C.npc(n => n.id === 'whisper'), rb = C.npc(n => n.id === 'rumble');
    if (!C.flag('w11wh')) {
      if (wh) await C.alert(wh);
      await C.talk([
        W('Shh... Welcome to the top of the tower, little trainer.', '嘘……欢迎来到塔顶，小训练师。'),
        W('Our weather machine uses the Weather Crystal. Snow, snow, all day long.', '我们的天气机用的是天气水晶。雪呀雪，下一整天。'),
        W('Nobody goes out. Nobody talks. Lovely, right?', '谁也不出门，谁也不说话。很美妙吧？'),
        Rb('Hah! Everyone is hiding at home!', '哈！大家都躲在家里啦！'),
      ]);
      const res = await hush(C, wh, 'whisper', { lines: [["Shh... Let's battle. Quietly.", '嘘……来对战吧，安安静静地。']], types: ['ice', 'ghost', 'dark'], n: 3, win: ['Shh... You are too loud for me.', '嘘……你对我来说太吵了。'] });
      if (res !== 'win') return;
      C.set('w11wh');
      if (wh) C.remove(wh);
    }
    if (!C.flag('w11rb')) {
      if (rb) await C.alert(rb);
      const res = await hush(C, rb, 'rumble', { lines: [["My turn! I don't talk, I fight!", '轮到我了！我不说话，我只对战！'], ['Rumble, rumble! Here comes the storm!', '轰隆隆！暴风雪来啦！']], types: ['ice', 'dark', 'steel'], n: 3, win: ['Cough, cough! My whistle...!', '咳咳！我的口哨……！'] });
      if (res !== 'win') return;
      C.set('w11rb');
      await C.talk([Rb("Grr! Whisper, let's go!", '可恶！低语，我们走！'), nar('Whisper and Rumble ran down the stairs.', '低语和闷雷顺着楼梯逃走了。')]);
      if (rb) C.remove(rb);
    }
    await weatherMachine(C);
  }

  const MACHINE = ['snowy', 'sunny', 'cloudy', 'rainy', 'windy'];
  async function weatherMachine(C) {
    const MA = (en, zh, x) => Object.assign({ who: 'Weather Machine', emo: '🎛️', en, zh }, x || {});
    let done = false;
    const btn = k => MA('Button ' + (k + 1) + ' of 3. Which weather?', '第 ' + (k + 1) + ' 个按钮：按天气预报的顺序，该按哪一个？', {
      kind: 'choice', opts: MACHINE.map(w => ({ html: WX[w][0] + ' ' + WX[w][1] })),
      pick: i => {
        const w = MACHINE[i];
        if (w === SEQ[k]) { C.E.SFX.ok(k + 1); if (k === 2) { done = true; return [MA(WX[w][1] + '! Beep!', WX[w][2] + '！哔！')]; } return [MA(WX[w][1] + '! Beep!', WX[w][2] + '！哔！'), btn(k + 1)]; }
        C.E.SFX.bad();
        return [MA('BZZZT! Wrong order! The machine starts again.', '滋滋——！顺序不对！机器重新开始。'), nar('Remember the radio: sunny, then rainy, then windy.', '想想收音机里的天气预报：先晴天，再下雨，然后刮风。'), btn(0)];
      },
    });
    await C.talk([
      nar('This is the weather machine. The Weather Crystal is inside!', '这就是天气机。天气水晶就在里面！'),
      MA('Beep. Snow mode is ON. Press three buttons to turn it off.', '哔。下雪模式开启中。按对三个按钮才能关掉。'),
      btn(0),
    ]);
    if (!done) return;
    await C.talk([
      L.speak(C, 'Sunny, then rainy, then windy!', '大声说出天气预报，把机器关掉！'),
      MA('Snow mode... OFF.', '下雪模式……关闭。', { onShow: () => C.E.SFX.win() }),
      nar('The machine stopped. The snow is stopping... The sun is coming out!', '机器停了。雪慢慢停了……太阳出来了！'),
    ]);
    await L.restoreCrystal(C, 11);
    // 台长跑上来道谢，送攀瀑
    const s = await approach(C, { look: P.LOOKS.weather, name: 'Dr. Skye', g: 'f' });
    await C.talk([SKYE('{name}! You did it! Look out of the window. The sky is blue!', '{name}！你做到了！看看窗外，天空是蓝的！')]);
    await giveFalls(C);
    await leave(C, s);
  }
  async function machineTile(C) {
    if (C.flag('ch11')) { await C.talk([nar('The weather machine is off. It is quiet and sunny now.', '天气机关掉了。现在外面安静又晴朗。')]); return; }
    if (C.flag('w11rb')) { await weatherMachine(C); return; }
    await towerTop(C);
  }

  // ---------- 天气道馆：听广播里的天气预报，按顺序打开开关 ----------
  const G11 = { '12,14': 'sunny', '2,14': 'cloudy', '2,11': 'rainy', '12,11': 'snowy', '1,5': 'sunny', '13,5': 'windy' };
  const G11_GATE = { sunny: 2, rainy: 1, windy: 0 };
  const g11k = C => C.gateOpen(2) ? (C.gateOpen(1) ? (C.gateOpen(0) ? 3 : 2) : 1) : 0;
  const g11note = C => C.note('📻 按天气预报的顺序打开天气开关 · 已打开 <b>' + g11k(C) + '/3</b>（听不清就去问收音机）');
  const broadcast = C => C.talk([
    { who: 'Gym Radio', emo: '📻', en: 'Ding dong! Here is the weather report for the Weather Gym.', zh: '叮咚！天气道馆的天气预报来了。' },
    { who: 'Gym Radio', emo: '📻', en: 'Sunny, then rainy, then windy.', zh: '（仔细听！只听不看。点右上角的喇叭可以再听一遍）', hideEn: true },
    nar('Turn on the weather switches in the same order. If you are wrong, everything starts again!', '按同样的顺序打开天气开关。按错了就全部重来！'),
  ]);
  async function g11Switch(C, f) {
    const key = f.x + ',' + f.y;
    if (key === '4,16') { await broadcast(C); g11note(C); return; }
    const w = G11[key];
    if (!w) return;
    const k = g11k(C), SW = (en, zh, x) => Object.assign({ who: 'Weather Switch', emo: WX[w][0], en, zh }, x || {});
    if (k >= 3) { await C.talk([SW('All the weather lights are on. Go and see the Gym Leader!', '天气灯全亮了，快去见馆主吧！')]); return; }
    if (G11_GATE[w] != null && C.gateOpen(G11_GATE[w]) && key !== '1,5') { await C.talk([SW('This switch is already on.', '这个开关已经打开了。')]); return; }
    let yes = false;
    await C.talk([SW('This is the ' + WX[w][1].toUpperCase() + ' switch. Turn it on?', '这是「' + WX[w][2] + '」开关（' + WX[w][1] + '）。要打开吗？', {
      kind: 'choice', opts: [{ html: WX[w][0] + ' Turn it on! 打开', cls: 'sun' }, { html: 'Not now 先不' }], pick: i => { yes = i === 0; return []; },
    })]);
    if (!yes) return;
    if (w === SEQ[k]) {
      C.openGate(G11_GATE[w], true);
      C.E.SFX.ok(k + 2);
      await C.talk([SW(WX[w][1] + '! The ' + w + ' light is on. A gate opened!', WX[w][2] + '！灯亮了，一扇门打开了！（' + (k + 1) + '/3）')]);
      if (k + 1 === 3) { C.set('g11solved'); C.note(null); await C.talk([nar('Sunny, then rainy, then windy. The way to the Gym Leader is open!', '晴、雨、风，顺序全对！通往馆主的路打开了！')]); }
      else g11note(C);
      return;
    }
    C.E.SFX.bad();
    C.closeGate('all');
    await C.talk([SW('BZZZT! That is not the order of the forecast!', '滋滋——！这不是天气预报的顺序！'), nar('All the switches turned off. Back to the start!', '所有开关都关掉了，回到起点！')]);
    C.teleport(7, 18, 'up');
    g11note(C);
  }

  // 天气岛的村民：雪停前后说的话不一样
  async function villager11(C, n) {
    C.faceEach(n);
    const S = L.sayer(n.name, n.look, n.g), sun = C.flag('ch11');
    if (n.id === 'kid11') {
      await C.talk(sun
        ? [S("The sun is out! It's sunny and warm. Let's make a snowman!", '太阳出来了！又晴朗又暖和，我们去堆雪人吧！'), L.speak(C, "Let's make a snowman!", '跟他一起说')]
        : [S("It's snowing all day. My mom says I can't play outside.", '雪下了一整天。妈妈说我不能出去玩。'), S("I'm watching TV at home. It's boring!", '我只能在家看电视，好无聊！'), L.speak(C, "I'm watching TV.", '跟他说一遍')]);
      return;
    }
    // granny11
    await C.talk(sun
      ? [S("Thank you, dear! It's sunny now. I'm going for a walk.", '谢谢你，孩子！现在出太阳了，我要出去散散步。'), L.speak(C, "It's sunny and warm.", '跟奶奶说一遍')]
      : [S('Oh, what a cold day! Come here, dear.', '哎呀，今天真冷！过来呀，孩子。'),
        L.ask(S, 'Is it cold outside?', '奶奶问你外面冷不冷。', "Yes, it's snowing.", ['Yes, I am.', "It's my coat."]),
        S("Yes. Take an umbrella with you, and wear a warm coat!", '是呀。带上雨伞，穿件暖和的外套！')]);
  }

  ST.isle(11, {
    busy: ['The snowstorm is too strong! I cannot battle now.', '暴风雪太大了！我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if ((id === 't11' || id === 'r11') && !C.flag('ch11')) setFilter(C, STORM);
      if (!C.flag('starter')) return null;
      if (id === 't11' && !C.flag('w11in')) return () => snowIntro(C);
      if (id === 'd11b' && C.flag('w11door') && !C.flag('ch11')) return () => towerTop(C);
      if (id === 'i11G' && !C.flag('g11solved') && g11k(C) < 3) return async () => { await broadcast(C); g11note(C); };
      return null;
    },
    talk(C, n) {
      if (n.id === 'hush11') return () => doorGrunt(C, n);
      if (n.id === 'skye') return () => skyeTalk(C, n);
      if ((n.id === 'whisper' || n.id === 'rumble') && !C.flag('ch11')) return () => towerTop(C);
      if (n.id === 'kid11' || n.id === 'granny11') return () => villager11(C, n);
      return null;
    },
    step(C) { const id = C.map.id; return id === 't11' || id === 'r11' ? null : unfilter(C); },
    tile(C, f) {
      const id = C.map.id;
      if (id === 'd11a' && f.statue) return () => towerPanel(C);
      if (id === 'd11a' && f.gate) return () => C.talk([nar('The door is locked. Use the control panel.', '门锁着。去控制台试试。')]);
      if (id === 'd11b' && f.statue) return () => machineTile(C);
      if (id === 'i11G' && f.statue) return () => g11Switch(C, f);
      return null;
    },
  });

  // =====================================================================
  // 第 12 岛 · 回忆岛：A Day to Remember（最终章）
  // 雾里碰到对手、比一场 → 神殿门口的导师欧瑞（用过去时回答）→ 神殿里读石板、回答记忆之门
  // → 封印之间打败默先生 → 大家轮流讲这一路的经历 → 13 座岛的声音唤醒回声龙 → 默先生说 "I'm sorry."
  // =====================================================================
  const ORI = L.sayer('Orion', 'orion', 'm');
  const rivalSay = C => { const R = C.rivalInfo(); return (en, zh, x) => Object.assign({ who: R.name, look: R.look, g: R.g, en, zh }, x || {}); };

  async function rivalScene(C) {
    await C.talk([nar('A thick fog covers the old island...', '浓浓的雾笼罩着这座古老的小岛……')]);
    const R = C.rivalInfo(), S = rivalSay(C);
    const r = await approach(C, { look: R.look, name: R.name, g: R.g });
    await C.talk([
      S('{name}! You climbed the waterfall! I knew you could do it.', '{name}！你爬上瀑布了！我就知道你能行。'),
      S('Listen. I saw Mr. Mute. He went into the Memory Temple with twelve crystals!', '听我说，我看见默先生了。他带着十二颗水晶进了回忆神殿！'),
      S('But first... do you remember our first battle?', '不过先等等……你还记得我们的第一场对战吗？'),
      L.ask(S, 'What did we do on Route 1?', '{rival} 问你：我们在 1 号路上做了什么？（用过去时回答）', 'We battled on Route 1.', ['We battle on Route 1.', 'It is Route 1.'],
        { fail: () => [S('We battled! "Battled" is the past of "battle".', '我们对战了！“battled”是“battle”的过去式。')] }),
      S("Yes! Let's have one more battle. Then we stop Team Hush together!", '对！我们再比一场，然后一起去阻止嘘声团！'),
    ]);
    const res = await L.rivalFight(C, 5);
    C.set('rival5');
    await C.talk([
      res === 'win' ? S("You're so strong now... I'm happy you are my rival.", '你现在好强……能当你的对手，我很开心。') : S("I won this time! But today we're a team.", '这次我赢了！不过今天我们是一队的。'),
      S("Orion is waiting at the temple door, north of town. Let's go!", '欧瑞在镇子北边的神殿门口等我们。走吧！'),
      L.speak(C, "Let's go together!", '对 {rival} 说：我们一起去吧！'),
    ]);
    await leave(C, r);
  }

  async function orionGate(C, n) {
    C.faceEach(n);
    await C.talk([
      ORI('{name}, you came. This is the Memory Temple.', '{name}，你来了。这里就是回忆神殿。'),
      ORI('Long ago, people told stories here. They used words about the past.', '很久以前，人们在这里讲故事，用的都是讲过去的词。'),
      ORI('Mr. Mute is inside. He wants to open the sea door and wake the Hush King.', '默先生就在里面。他想打开海底之门，唤醒寂静之王。'),
      ORI('This temple only opens for people who remember. So tell me...', '这座神殿只为记得过去的人打开。那么告诉我……'),
      L.ask(ORI, 'What did you do on Weather Island?', '欧瑞问你在天气岛做了什么。选出用过去时说的句子。', 'I stopped the snow machine.', ['I stop the snow machine.', 'It is snowy and cold.'],
        { fail: () => [ORI('We say "I stopped". "Stopped" is the past of "stop".', '要说 “I stopped”。“stopped” 是 “stop” 的过去式。')] }),
      ORI('Good. On this island, we talk about the past: went, saw, stopped, learned.', '很好。在这座岛上，我们讲的是过去：went、saw、stopped、learned。'),
      ORI('Read the old tablets inside. The Memory Door will ask about them.', '好好读里面的古老石板，记忆之门会问上面的内容。'),
      ORI('Go! {rival} and I will be right behind you.', '去吧！我和 {rival} 马上就跟上。'),
    ]);
    C.set('m12orion');
  }
  async function orionChat(C, n) {
    C.faceEach(n);
    await C.talk([ORI('The tablets tell an old story. Read all of them.', '石板上讲的是一个古老的故事，每一块都要读。'), ORI('Remember: long ago, people spoke together, and Echodrake woke up.', '记住：很久以前，人们一起说话，回声龙就醒了。')]);
  }

  // 记忆之门：回答石板上的故事（两道题都对才开）
  async function memoryDoor(C) {
    const DOOR = (en, zh, x) => Object.assign({ who: 'Memory Door', emo: '🚪', en, zh }, x || {});
    if (C.gateOpen(0)) return;
    let right = 0;
    const q = (en, zh, a, w) => L.ask(DOOR, en, zh, a, w, { pass: () => { right++; return []; }, fail: () => [DOOR('No... Read the tablets again.', '不对……再去读读石板吧。')] });
    await C.talk([
      DOOR('I am the Memory Door. Only people who remember can pass.', '我是记忆之门。只有记得过去的人才能通过。'),
      q('Long ago, what did the Hush King do?', '很久以前，寂静之王做了什么？', 'It ate all the sounds.', ['It eats all the sounds.', 'It was very happy.']),
      q('Then, what did the people do?', '后来，人们做了什么？', 'They spoke together.', ['They speak together.', 'They were quiet.']),
    ]);
    if (right < 2) return;
    C.openGate(0, true);
    await C.talk([DOOR('You remember well. You may pass.', '你记得很清楚。请过吧。')]);
  }

  // 封印之间：默先生 → 轮流讲经历 → 回声龙醒来 → "I'm sorry."
  async function sanctum(C) {
    const MU = L.sayer('Mr. Mute', 'mute', 'm'), R = C.rivalInfo(), RS = rivalSay(C);
    const mute = C.npc(n => n.id === 'mute');
    // 主角往前走几步，对手和欧瑞跟进来站在两边
    for (let i = 0; i < 3 && C.pl.y > 9 && free(C, C.pl.x, C.pl.y - 1); i++) await C.walkPlayer('up', 1);
    const pl = C.pl;
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x - 1, y: pl.y, face: 'up' });
    const o = C.spawn({ look: P.LOOKS.orion, name: 'Orion', g: 'm', x: pl.x + 1, y: pl.y, face: 'up' });
    C.facePlayer('up');
    if (!C.flag('m12mute')) {
      if (mute) await C.alert(mute);
      await C.talk([
        MU('...So you came. {name}. {rival}. And Orion.', '……你们来了。{name}，{rival}，还有欧瑞。'),
        MU('Look. Twelve crystals. When I drop them into the sea door, the seal will break.', '看，十二颗水晶。只要把它们丢进海底之门，封印就会破掉。'),
        MU('Then the Hush King will wake up and eat every sound in the world.', '然后寂静之王就会醒来，吃掉世界上所有的声音。'),
        MU('No more shouting. No more laughing at people. A quiet world is a kind world.', '再也没有吵闹，再也没有人嘲笑别人。安静的世界才是温柔的世界。'),
        ORI('Mute! Words can hurt people. But words can also help people!', '默！话语会伤人，可话语也能帮助人！'),
        RS("That's right! We came here to help!", '没错！我们是来帮忙的！'),
        MU('Then show me. Show me the power of your words.', '那就让我看看。让我看看你们话语的力量。'),
      ]);
      const res = await hush(C, mute, 'mute', { lines: [['...', '……']], types: ['dark', 'ghost', 'steel', 'poison'], n: 5, lv: 8, win: false });
      if (res !== 'win') return;
      C.set('m12mute');
    }
    await C.talk([
      MU('How... How can words be so strong?', '怎么……话语怎么会这么有力量？'),
      nar('Suddenly the water in the sea door starts to shake!', '突然，海底之门里的水剧烈地摇晃起来！'),
      nar('The crystals are losing their light...', '水晶的光越来越暗了……'),
      ORI('The seal is breaking! Echodrake wakes up when many people speak together.', '封印要破了！只要很多人一起说话，回声龙就会醒来。'),
      ORI('Tell your story! What did you do on your journey? Say it in the past!', '讲讲你的故事！这一路上你做了什么？用过去时说出来！'),
      L.speak(C, 'I met Professor Echo.', '讲讲你的旅程：我遇见了回声博士。'),
      RS('I battled with {name} on Route 1!', '我在 1 号路上和 {name} 对战过！'),
      L.speak(C, 'I helped the lost boy.', '我帮助了走丢的小男孩。'),
      ORI('I studied old words on many islands.', '我在很多岛上研究过古老的词语。'),
      L.speak(C, 'I learned a lot of English.', '我学会了很多英语。'),
      nar('Far away, many voices answer. The Gym Leaders, Mom, Professor Echo, Kai...', '远方传来许多声音在回应：各岛的馆主、妈妈、回声博士、小凯……'),
      nar('The people of thirteen islands are talking together!', '十三座岛的人们都在一起说话！'),
      ORI('Now, all together!', '现在，大家一起喊！'),
      L.speak(C, 'We remember! Echodrake, wake up!', '大家一起大声喊：我们记得！回声龙，醒来吧！'),
    ]);
    const d = C.spawn({ mon: 'echodrake', role: 'legend', x: 10, y: 4, face: 'down' });
    C.E.SFX.win(); C.E.confetti(160);
    await C.talk([
      { who: 'Echodrake', emo: '🐉', en: 'ROOOAAAR!', zh: '吼——！' },
      nar('The voices of thirteen islands woke up Echodrake!', '十三座岛的声音唤醒了回声龙！'),
      nar('Echodrake sang a loud, happy song. The crystals are shining again. The sea door is closed!', '回声龙唱起一支响亮又快乐的歌。水晶重新亮了起来，海底之门关上了！'),
      RS('We did it! We did it together!', '我们做到了！我们一起做到了！'),
      nar('Mr. Mute looks at the crystals. He is quiet for a long time.', '默先生看着水晶，很久很久都没有说话。'),
      MU('When I was a boy, I said a wrong word in class.', '我小时候，在课堂上说错了一个词。'),
      MU('Everybody laughed at me. So I stopped talking.', '全班都笑我。从那以后，我就不再说话了。'),
      MU('I thought: no words, no pain. A quiet world is a kind world.', '我以为：不说话，就不会受伤。安静的世界就是温柔的世界。'),
      L.ask(N, 'What do you want to say to Mr. Mute?', '你想对默先生说什么？选一句，大声说出来。', "It's OK. Everyone makes mistakes.", ['Be quiet!', "You're wrong. Go away!"],
        { fail: () => [ORI('Hmm. Maybe say something kind: "It\'s OK. Everyone makes mistakes."', '嗯……也许可以说句温暖的话：“没关系，每个人都会犯错。”')] }),
      MU('...Everyone makes mistakes...', '……每个人……都会犯错……'),
      MU("I... I'm sorry.", '我……对不起。', { onShow: () => C.E.SFX.win() }),
      nar('Mr. Mute spoke to people for the first time in many years.', '这是默先生很多年来第一次对别人开口说话。'),
      MU('Here are the twelve crystals. Please take them home to every island.', '这是十二颗水晶。请把它们送回每一座岛。'),
      MU('And... thank you for talking to me.', '还有……谢谢你们愿意跟我说话。'),
      ORI('Words can hurt, but kind words can heal. You showed him that, {name}.', '话语会伤人，但温暖的话能治愈人。{name}，是你让他明白了这一点。'),
    ]);
    if (mute) C.remove(mute);
    C.set('ch12');
    C.MG.addItem('superball', 3);
    C.E.toast('💠 超级球 +3（默先生还回来的谢礼）', 'gold');
    C.E.save();
    await C.walk(d, 'down', 2, 260);
    await C.talk([
      RS("I'll go to the Champion Road first. See you there. I'll be stronger!", '我先去冠军之路了。那里见，我会变得更强！'),
      ORI('Echodrake is looking at you. It wants to test your voice. Talk to it when you are ready.', '回声龙在看着你，它想试试你的声音。准备好了就去和它说话吧。'),
      ORI('And the Memory Gym is open now. The Memory Dragon is waiting.', '回忆道馆现在也开门了，回忆巨龙在等你。'),
    ]);
    await leave(C, r, 'down', 3);
    await leave(C, o, 'down', 3);
  }

  // ---------- 回忆道馆：翻牌配对 ----------
  let memFirst = null;
  const memChar = (c, up) => (up ? 'ABCDEFGHIJKL' : 'abcdefghijkl')[c.i];
  function memSync(C) { MEM_CARDS.forEach(c => C.setOver(c.x, c.y, C.flag('mem12:' + c.pair) ? memChar(c, true) : '?')); memFirst = null; }
  function memStep(C) {
    const c = MEM_CARDS.find(q => q.x === C.pl.x && q.y === C.pl.y);
    if (!c || C.over(c.x, c.y) !== '?') return null;
    return () => flipCard(C, c);
  }
  async function flipCard(C, c) {
    const p = MEM_PAIRS[c.pair], CARD = (en, zh, x) => Object.assign({ who: 'Memory Card', emo: '🃏', en, zh }, x || {});
    C.setOver(c.x, c.y, memChar(c)); C.refresh(); C.E.SFX.tap();
    await C.talk([c.side === 'en' ? CARD(p[0], p[2] + '（英文牌）') : CARD('', p[1] + ' ' + p[2] + '（中文牌）')]);
    if (!memFirst) { memFirst = c; return; }
    const a = memFirst;
    memFirst = null;
    if (a.pair === c.pair) {
      C.set('mem12:' + c.pair);
      C.setOver(a.x, a.y, memChar(a, true)); C.setOver(c.x, c.y, memChar(c, true)); C.refresh();
      C.E.SFX.ok(3);
      await C.talk([CARD(p[0] + ' = ' + p[1] + '. It\'s a pair!', '配对成功！' + p[0] + ' 就是“' + p[1] + '”。'), L.speak(C, p[0], '把这个词大声读一遍')]);
      const sec = MEM_SECTIONS[c.sec];
      if (sec.cards.every(([pi]) => C.flag('mem12:' + pi)) && !C.gateOpen(sec.gate)) {
        C.openGate(sec.gate, true);
        await C.talk([nar('Rumble... The stone wall above the cards is gone!', '轰隆隆……这组牌上面的石墙消失了！')]);
        if (sec.gate === 0) { C.note(null); await C.talk([nar('All the pairs are found! The way to the Gym Leader is open.', '所有的牌都配对了！通往馆主的路打开了。')]); }
      }
      return;
    }
    C.E.SFX.bad();
    await C.talk([CARD('Not a pair. The cards turn over again.', '不是一对，两张牌又翻回去了。')]);
    C.setOver(a.x, a.y, '?'); C.setOver(c.x, c.y, '?'); C.refresh();
  }
  const PILLARS = {
    '3,5': ['A stone pillar: "Yesterday I went to the farm. I saw many cows."', '石柱：“昨天我去了农场，看见了很多奶牛。”'],
    '9,5': ['A stone pillar: "Last weekend we went to the beach. It was fun!"', '石柱：“上周末我们去了海滩，真好玩！”'],
  };

  // ---------- 冠军之路：小凯的最后一战 ----------
  async function kaiBattle(C, k) {
    const K = L.sayer('Kai', 'kai', 'm'), MG = C.MG;
    await C.alert(k);
    C.faceEach(k);
    await C.talk([
      K('{name}! I knew you would come this way.', '{name}！我就知道你会走这条路。'),
      K('Do you remember Crayon Island? I was the shy boy. I could not even say hello.', '还记得彩色文具岛吗？我就是那个害羞的男孩，连“你好”都说不出口。'),
      K('You helped me catch my first monster. And you told me something.', '你帮我抓到了第一只怪兽，还对我说了一句话。'),
      L.ask(K, 'Do you remember? What did you say to me?', '小凯问你：还记得你当时对他说了什么吗？', 'I said, "Speak loudly!"', ['I say, "Speak loudly!"', 'I am Kai.'],
        { fail: () => [K('You said, "Speak loudly! Your monster will hear you."', '你说：“大声说！你的怪兽会听见的。”')] }),
      K('Yes! "Speak loudly. Your monster will hear you." I never forgot it.', '对！“大声说，你的怪兽会听见的。”我一直都记得。'),
      K('Now I speak loudly every day. My monsters and I got very strong.', '现在我每天都大声说话。我和我的怪兽都变得很强了。'),
      K('This is our last battle before the League. Please give me everything you have!', '这是冠军赛前我们最后一战。请拿出你全部的本事吧！'),
    ]);
    const lv = MG.zoneLv(12) + 6;
    const res = await C.battle('trainer', { foes: MG.teamOf(['grass', 'spark', 'flying', 'psychic', 'water', 'steel'], 6, lv, 'kai-final'), trainer: { name: 'Kai', img: C.portrait(P.LOOKS.kai) }, noWhiteout: true });
    if (res !== 'win') {
      MG.healAll();
      await C.talk([K("I won? Wow... But don't give up! Let me heal your team. Try again!", '我赢了？哇……不过别放弃！我帮你的队伍恢复一下，再来！')]);
      return;
    }
    await C.talk([
      K('...I lost. But I am not sad at all.', '……我输了。可我一点也不难过。'),
      K('When I met you, I was a boy with no friends and no voice.', '遇见你的时候，我是个没有朋友、也不敢出声的男孩。'),
      K('Now I have friends. I have monsters. And I have my voice.', '现在我有朋友，有怪兽，也有了自己的声音。'),
      K('Thank you, {name}. You changed my life.', '谢谢你，{name}。是你改变了我。'),
      L.ask(K, 'What do you want to say to Kai?', '你想对小凯说什么？', 'Thank you, Kai. You are my best friend.', ['I am the best trainer.', 'Goodbye forever.']),
      K('Best friends... I like that. Now go! Become the English Champion!', '最好的朋友……我喜欢这句话。去吧！去当英语冠军！'),
      K("I'll be cheering for you. Speak loudly!", '我会为你加油的。大声说出来！'),
      L.speak(C, 'I will do my best!', '对小凯说：我会全力以赴的！'),
    ]);
    C.set('kai_final');
    C.E.save();
    await C.walk(k, 'right', 1, 170);
    C.remove(k);
  }

  // 回忆岛的僧人：问你昨天做了什么
  async function monkTalk(C, n) {
    C.faceEach(n);
    const S = L.sayer(n.name, n.look, n.g);
    await C.talk([
      S('Welcome, traveller. On Memory Island, we remember every day.', '欢迎你，旅行者。在回忆岛，我们记住每一天。'),
      L.ask(S, 'What did you do yesterday?', '僧人问你昨天做了什么。选出用过去时说的句子。', 'I went to the museum.', ['I go to the museum.', 'It was yesterday.']),
      S('Good. Every day is a day to remember.', '很好。每一天都值得记住。'),
    ]);
  }

  ST.isle(12, {
    busy: ['Mr. Mute is at the Memory Temple! I cannot battle now.', '默先生就在回忆神殿里！我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't12' && !C.flag('ch12')) setFilter(C, FOG);
      if (!C.flag('starter')) return null;
      if (id === 't12' && !C.flag('rival5')) return () => rivalScene(C);
      if (id === 'd12b') {
        if (!C.flag('ch12')) return () => sanctum(C);
        if (!C.flag('leg:echodrake') && !C.npc(n => n.mon === 'echodrake')) return () => { C.spawn({ mon: 'echodrake', role: 'legend', x: 10, y: 6, face: 'down' }); };
      }
      if (id === 'v2' && !C.flag('leg:irongiant') && !C.npc(n => n.mon === 'irongiant')) return () => { C.spawn({ mon: 'irongiant', role: 'legend', x: 3, y: 3, face: 'down' }); };
      if (id === 'i12G') return () => { memSync(C); C.refresh(); if (!C.gateOpen(0)) C.note('🃏 踩在牌上翻开它：一张英文、一张中文，配成一对'); };
      return null;
    },
    step(C) {
      const id = C.map.id;
      if (id !== 't12') unfilter(C);
      if (id === 'i12G') return memStep(C);
      if (id === 'v3' && !C.flag('kai_final')) {
        const k = C.npc(n => n.id === 'kai');
        if (k && Math.abs(C.pl.x - k.x) <= 1 && C.pl.y > k.y && C.pl.y - k.y <= 3) return () => kaiBattle(C, k);
      }
      return null;
    },
    talk(C, n) {
      if (n.id === 'orion') return () => orionGate(C, n);
      if (n.id === 'orion2') return () => orionChat(C, n);
      if (n.id === 'mute' && !C.flag('ch12')) return () => sanctum(C);
      if (n.id === 'kai' && !C.flag('kai_final')) return () => kaiBattle(C, n);
      if (n.id === 'monk12') return () => monkTalk(C, n);
      return null;
    },
    tile(C, f) {
      const id = C.map.id;
      if (id === 'd12a' && f.gate) return () => memoryDoor(C);
      if (id === 'i12G' && f.statue && PILLARS[f.x + ',' + f.y]) return () => C.talk([nar(...PILLARS[f.x + ',' + f.y])]);
      return null;
    },
  });
})();
