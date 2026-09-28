// 回声岛 · 第 0–1 岛：你好岛（海边小村）、彩色文具岛（糖果色小镇 + 涂鸦森林）
// 地图、剧情、道馆机关。写法见 ISLES.md
(function () {
  'use strict';
  const EM = window.EchoMaps, ST = window.EchoStory, L = ST.lib, P = window.EchoPeople;

  // ======================================================================
  // 第 0 岛 · 你好岛 Hello Island：白墙红瓦的海边小村，南边是沙滩、码头和灯塔
  // ======================================================================
  EM.define('t0', {
    kind: 'town', z: 0, name: '你好岛', en: 'Hello Island', sub: '第 1 岛 · 你的家',
    rows: [
      '##############^^##############',
      '#TTTTTTTTTTTTT==TTTTTTTTTTTTT#',
      '#TT.F..F..T..T2TT..T..F..F.TT#',
      '#.............=..............#',
      '#.HHHHH.....AAAAAAA....JJJJJ.#',
      '#.HHHHH.....AAAAAAA....JJJJJ.#',
      '#.HHhHH..F..AAAAAAA..F.JJjJJ.#',
      '#...=.......AAAaAAA......=...#',
      '#...=======================..#',
      '#............1.=..B..........#',
      '#.GGGGGGG..............CCCCC.#',
      '#.GGGGGGG....T.......T.CCCCC.#',
      '#.GGGGGGG..FF........F.CCCCC.#',
      '#.GGGgGGG..............CCcCC.#',
      '#....=...................=...#',
      '#....=====================...#',
      '#.3.......4...........MMMMM..#',
      '#........o............MMMMM..#',
      '#.FF..T...........5...MMmMMEE#',
      '#SSSSSSSSSSSSS=SSSSSSSSSSSSEE#',
      '#SSSS6SSSSSSSS=SSSSSSS*SSSSEE#',
      '~~~~SSSSSSSSSS=SSSSSSSSSS~~~~~',
      '~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~7=Z~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    styles: { E: 'lighthouse' },
    markKinds: ['boat'],
    marks: [[['A small white boat. Its name is "Hello".', '一艘白色的小船，船名叫「Hello」。'], ['Maybe one day it will take you across the sea.', '也许有一天，它会带你出海。']]],
    signs: [['Welcome to Hello Island! Say hello to everyone!', '欢迎来到你好岛！见到谁都要打招呼哦！']],
    items: ['potion'],
    hiddenItems: ['superball'],
    links: { n: 'r0' },
    start: [14, 9],
    // 开场：博士被野生怪兽追着绕圈的路线
    rescueLoop: [[9, 9], [10, 9], [11, 9], [12, 9], [12, 10], [12, 11], [11, 11], [10, 11], [9, 11], [9, 10]],
    npc: {
      1: { role: 'talk' },   // 回声博士（world.js / story.js 认 t0 的 1 号）
      2: { role: 'guard', badge: 1, name: 'Guard Hugo', look: 'guard', say: [['Hello! I am the island guard. You need the Hello Badge to go north.', '你好！我是岛上的守卫。要有「你好徽章」才能往北走。'], ['Visit the Gym and beat Captain Polly first!', '先去道馆打败鹦鹉船长吧！']] },
      3: { role: 'quiz' },
      4: { role: 'talk', name: 'Ms Rosa', look: 'granny', g: 'f', say: [['Good morning, dear! Nice to meet you!', '早上好，孩子！很高兴认识你！'], ['On this island, we always say hello.', '在这座岛上，我们见面总要打招呼。']], speak: 'Nice to meet you, too!' },
      5: { role: 'talk', name: 'Mr Costa', look: 'grandpa', say: [['Hello! How are you?', '你好！你好吗？'], ['I am fine, thank you. And you?', '我很好，谢谢。你呢？']], speak: "I'm fine, thank you." },
      6: { role: 'talk', name: 'Sam', look: 'kid', say: [['Hi! My name is Sam. What is your name?', '嗨！我叫 Sam。你叫什么名字？'], ['Wow, {name}! That is a cool name!', '哇，{name}！好酷的名字！']], speak: 'My name is {name}.' },
      7: { role: 'talk', name: 'Fisher Tom', look: 'fisher', under: '=', face: 'right',
        give: { item: 'rod', say: [['Good afternoon! Do you like fishing?', '下午好！你喜欢钓鱼吗？'], ['Here, take my old fishing rod. Face the water and press A!', '给，这根旧钓竿送你。对着水按 A 就能钓鱼！']], after: [['Listen carefully when a fish bites!', '鱼咬钩的时候要仔细听哦！']] },
        say: [['The sea is calm today. Good luck!', '今天海面很平静。祝你好运！']] },
    },
  });

  // 1 号路：草丛、池塘、一排台阶（往南跳是近路）、路边的小屋，东边岔路去海边悬崖
  EM.define('r0', {
    kind: 'route', z: 0, name: '1 号路', en: 'Route 1', sub: '你好岛 → 彩色文具岛',
    rows: [
      '###########^^###########',
      '#TTTT....T.==.T...TTTTT#',
      '#TT..,,,,..==....o..TTT#',
      '#T..,,,,,,.==.,,,,,..TT#',
      '#...,,,1,,.==.,,,,,,..T#',
      '#T..,,,,,,.==..,,,,,..T#',
      '#TT........==.......TTT#',
      '#TTTT~~~~..==....B..TTT#',
      '#TT~~~~~~..==.........T#',
      '#T~~~~~~~..==..2......T#',
      '#T~~~o~~~..==.........T#',
      '#TT~~~~~...==.,,,,,,.TT#',
      '#TTT~~~....==.,,,,,,..T#',
      '#LLLLLLLLLL==LLLLLLL..T#',
      '#...,,,,...==.......o.T#',
      '#T..,,,,...==..3......T#',
      '#TT.......===........TT#',
      '#TTTTTT....==......TTTT#',
      '#TTTHHHHH..==........TT#',
      '#TT.HHHHH..============>',
      '#TT.HHhHH..============>',
      '#TT...=....==.........T#',
      '#TTT..=======....FF..TT#',
      '#TT........==...FF,,,TT#',
      '#T..,,,,...==....,,,,.T#',
      '#T..,,,,4..==....,,,,.T#',
      '#TT.,,,,...==.....,,,.T#',
      '#TTT.......==........TT#',
      '#TTTT......==......TTTT#',
      '#TTTTT.....==.....TTTTT#',
      '#TTTTT.....==.....TTTTT#',
      '#TTTT......==......TTTT#',
      '#TT.,,,,...==...*....TT#',
      '#T..,,,,,..==..,,,,,..T#',
      '#T..,,,,,..==..,,5,,..T#',
      '#TT.,,,,...==..,,,,,.TT#',
      '#TTT.......==.......TTT#',
      '#TT...o....==....B...TT#',
      '#T..,,,,...==...,,,,..T#',
      '#T..,,,,...==...,,,,..T#',
      '#TT........==........TT#',
      '#TTTT......==......TTTT#',
      '#TTTTTTT...==...TTTTTTT#',
      '###########vv###########',
    ],
    links: { n: 't1', s: 't0', e: 'r0b' },
    doors: { H: 'r0h' },
    signs: [
      ['Route 1. North: Crayon Island. East: Seaside Cliff.', '1 号路。往北是彩色文具岛，往东是海边悬崖。'],
      ['Watch out! Wild monsters live in the tall grass.', '小心！草丛里住着野生怪兽。'],
    ],
    items: ['superpotion', 'potion', 'repel'],
    hiddenItems: ['superball'],
    npc: {
      1: { role: 'trainer', name: 'Youngster Tim', look: 'kid', face: 'right', sight: 4, under: ',', types: ['normal', 'bug'], n: 1, lines: [['Hello! I am Tim. Let us battle!', '你好！我叫 Tim，我们来对战吧！']], win: ['Goodbye! See you later!', '再见！回头见！'] },
      2: { role: 'trainer', name: 'Fisher Leo', look: 'fisher', face: 'left', sight: 4, types: ['water'], n: 2, lines: [['Good afternoon! My fish want to battle!', '下午好！我的鱼想对战！']], win: ['Oh no! Thank you for the battle.', '哎呀！谢谢你陪我对战。'] },
      3: { role: 'trainer', name: 'Lass Amy', look: 'kidF', g: 'f', face: 'left', sight: 4, types: ['normal', 'flying'], n: 1, lines: [['Hi! Nice to meet you! Now, battle!', '嗨！很高兴认识你！现在，对战吧！']], win: ['Nice to meet you, strong trainer!', '很高兴认识你，厉害的训练师！'] },
      4: { role: 'trainer', name: 'Bug Kid Ben', look: 'kid', face: 'right', sight: 3, under: ',', types: ['bug'], n: 2, lines: [['Good morning! Look at my bugs!', '早上好！看看我的虫子怪兽！']], win: ['Good night, my bugs...', '晚安，我的虫子们……'] },
      5: { role: 'trainer', name: 'Picnic Kate', look: 'studentF', g: 'f', face: 'left', sight: 4, under: ',', types: ['grass', 'normal'], n: 1, lines: [['Hello! What is your name? Mine is Kate!', '你好！你叫什么名字？我叫 Kate！']], win: ['Goodbye, and good luck!', '再见，祝你好运！'] },
    },
  });
  // 1 号路边的小屋：罗丝奶奶让你的怪兽休息
  EM.define('r0h', {
    kind: 'inside', z: 0, room: 'H', name: '路边小屋', en: 'Rest House', sub: '1 号路',
    rows: ['WWWWWWWWW', 'Wkk_t__pW', 'W_______W', 'W_YY_1__W', 'W_YY____W', 'Wp______W', 'W___u___W', 'WWWWeWWWW'],
    npc: { 1: { role: 'story', id: 'rest', name: 'Granny Rose', look: 'granny', g: 'f' } },
    links: { e: 'r0' },
  });

  // 海边悬崖：悬崖上的草地、往下跳的台阶、沙滩和浅海的小岛；悬崖上有回声洞
  EM.define('r0b', {
    kind: 'route', z: 0, name: '海边悬崖', en: 'Seaside Cliff', sub: '1 号路东边', lv: 1,
    rows: [
      '############################',
      '#TTTTRRRRRRRRRRRRRRRRRRRRTT#',
      '#TT..RRRRRRRRRKRRRRRRRRR.TT#',
      '#T....,,,.....=......,,,.TT#',
      '<....,,,,,..===....1.,,,,.T#',
      '<=====,,,,,===.....,,,,,..T#',
      '#T...,,,,.........B....,,.T#',
      '#TT......2......RRRR.....TT#',
      '#TTLLLLLLLLLLLLL.RRRRLLLL.T#',
      '#SSSSSSSSSSSSSSS.SSSSSSSSST#',
      '#SSS3SSSSSSSSoSSSSSSS*SSSSS#',
      '#SSSSSSS~~~~SSSSSSSSSS4SSSS#',
      '#~~SSSS~~~~~~~~SSSSSSS~~~~~#',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~5~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~SSS~~~~~~',
      '~~~~~~~~~~~~~~~~~~SSoSS~~~~~',
      '~~~~~~~~~~~~~~~~~~~SSS~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    links: { w: 'r0', K: ['c0'] },
    signs: [['Echo Cave. It is very dark inside!', '回声洞。里面非常黑！']],
    items: ['ball', 'waterstone'],
    hiddenItems: ['revive'],
    npc: {
      1: { role: 'trainer', name: 'Camper Dan', look: 'hiker', face: 'left', sight: 5, types: ['rock', 'ground'], n: 1, lines: [['Good morning! I love the sea. Do you?', '早上好！我喜欢大海，你呢？']], win: ['What a nice morning!', '多美好的早晨！'] },
      2: { role: 'trainer', name: 'Hiker Joe', look: 'hiker', face: 'down', sight: 3, types: ['rock'], n: 2, lines: [['Hello there! Rocks are my friends!', '你好呀！石头是我的朋友！']], win: ['Thank you. You are very strong!', '谢谢。你很强！'] },
      3: { role: 'trainer', name: 'Beach Girl Mia', look: 'swimmerF', g: 'f', face: 'right', sight: 4, types: ['water', 'normal'], n: 1, lines: [['Hi! Nice to meet you on the beach!', '嗨！很高兴在沙滩上认识你！']], win: ['See you tomorrow!', '明天见！'] },
      4: { role: 'trainer', name: 'Fisher Ray', look: 'fisher', face: 'left', sight: 5, types: ['water'], n: 2, lines: [['Good afternoon! The fish are biting today!', '下午好！今天鱼很爱咬钩！']], win: ['Good evening... time to go home.', '晚上好……该回家了。'] },
      5: { role: 'trainer', name: 'Swimmer Kate', look: 'swimmerF', g: 'f', face: 'right', sight: 4, under: '~', types: ['water'], n: 2, lv: 3, lines: [['Hello! Can you swim? I can!', '你好！你会游泳吗？我会！']], win: ['You swim very well!', '你游得真好！'] },
    },
  });

  // 回声洞：漆黑的洞穴，墙上刻着古老的字；深处被裂开的岩石封住，里面睡着岩石巨人
  EM.define('c0', {
    kind: 'cave', z: 0, cave: 'rock', dark: true, dungeon: true, lv: 2, name: '回声洞', en: 'Echo Cave', sub: '海边悬崖',
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XX::::::XXXXXXXXXXX:::::XX',
      'XX::::::::XXXXXXXXX::Z::XX',
      'X:::r::::::XXXXXXXX:::::XX',
      'X::::::::::XXXXXXXXXX:XXXX',
      'XXX:::1::::::XXXXXXXXbXXXX',
      'XXXXX::::::::::::::::::XXX',
      'X:::XX:::::XXX::::::::::XX',
      'X:o::X::::XXXXX:::XX::::XX',
      'X::::X:::XXXXXXX::XX:2::XX',
      'XX::::::XXXXXXXXX:XX::::XX',
      'XXX:::::XXXXXXXXX:::::::XX',
      'XXXXX:::::XXXXXX:::XXXXXXX',
      'XXXXXX::::::::::::XXXXXXXX',
      'XXX:::::::Z:::::::::::XXXX',
      'XX::::::::::::::::::o::XXX',
      'XX:::::XXXXX::::::XXXXXXXX',
      'XXX:::XXXXXXX::::::XXXXXXX',
      'XXXXXXXXXXXXX::::::XXXXXXX',
      'XXXXXXXXXXXXX:::::XXXXXXXX',
      'XXXXXXXXXXXXXXXeXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
    links: { e: 'r0b' },
    markKinds: ['stone', 'stone'],
    marks: [
      [['Old words are cut into the stone:', '石头上刻着古老的字：'], ['"Words have power. Speak, and the world will listen."', '「话语有力量。开口说话，世界就会倾听。」']],
      [['"Long ago, the Hush King ate every sound."', '「很久以前，寂静之王吞掉了所有的声音。」'], ['"People spoke together, and Echodrake woke up."', '「人们一起大声说话，回声龙醒了过来。」']],
    ],
    items: ['superpotion', 'rope'],
    hiddenItems: ['moonstone'],
    npc: {
      1: { role: 'trainer', name: 'Hiker Bob', look: 'hiker', face: 'down', sight: 3, types: ['rock', 'ground'], n: 2, lines: [['Hello! It is dark in here, right?', '你好！这里很黑，对吧？']], win: ['Good job! Watch your step!', '干得好！小心脚下！'] },
      2: { role: 'trainer', name: 'Camper Lily', look: 'kidF', g: 'f', face: 'left', sight: 3, types: ['dark', 'rock'], n: 2, lines: [['Good evening! Oh wait, is it evening? I cannot see the sky!', '晚上好！等等，现在是晚上吗？在这儿看不到天空！']], win: ['Good night! I mean... goodbye!', '晚安！我是说……再见！'] },
    },
    people: [
      { id: 'orion', role: 'story', name: 'Orion', look: 'orion', x: 11, y: 14, face: 'left' },
      { id: 'flashman', name: 'Hiker Max', look: 'miner', x: 17, y: 18, face: 'down',
        give: { item: 'hm_flash', say: [['Hello there! This cave is very dark.', '你好呀！这个洞里非常黑。'], ['Take this. It is an HM. It teaches a monster Flash.', '这个给你。它是秘传学习器，能教怪兽「闪光」。'], ['With two badges, a spark, psychic or fire monster can light up the cave!', '有两枚徽章，电系、超能系或火系的怪兽就能照亮洞穴！']], after: [['Say "light up the cave!" to your monster.', '对你的怪兽说「light up the cave!」']] },
        say: [['Say "light up the cave!" to your monster.', '对你的怪兽说「light up the cave!」']] },
    ],
  });

  // ---------- 你好岛的室内 ----------
  // 回声博士的研究所
  EM.define('i0A', {
    kind: 'inside', z: 0, room: 'A', name: '回声博士的研究所', en: 'Echo Lab', sub: '你好岛',
    rows: ['WWWWWWWWWWWWW', 'Wkkkk_P_kkkkW', 'W___________W', 'W_YY__1__YY_W', 'W_YY_____YY_W', 'W___________W', 'Wp_Q_____Q_pW', 'W_____2_____W', 'W_____u_____W', 'WWWWWWeWWWWWW'],
    links: { e: 't0' },
    npc: {
      1: { role: 'talk', name: 'Aide Nick', look: 'scientist', say: [['Hello! I help Professor Echo.', '你好！我是回声博士的助手。'], ['Monsters like clear words. Say their names loudly!', '怪兽喜欢清楚的话。大声叫它们的名字吧！'], ['Fire beats grass. Water beats fire. Grass beats water.', '火克草，水克火，草克水。']], speak: 'Water beats fire.' },
      2: { role: 'talk', name: 'Aide Lily', look: 'scientist', g: 'f', say: [['Good afternoon! The computer is over there.', '下午好！电脑在那边。'], ['You can keep your monsters in the box.', '你可以把怪兽存进箱子里。']] },
    },
  });
  // 对手的家
  EM.define('i0J', {
    kind: 'inside', z: 0, room: 'J', name: '{rival} 的家', en: "Rival's House", sub: '你好岛',
    rows: ['WWWWWWWWW', 'Wd__t_kkW', 'Wd______W', 'W__YY_1_W', 'W__YY___W', 'Wp____2_W', 'W___u___W', 'WWWWeWWWW'],
    links: { e: 't0' },
    npc: {
      1: { role: 'talk', name: 'Pip', look: 'kid', say: [['Hi! {rival} is not here. {rival} left early this morning.', '嗨！{rival} 不在家，一大早就出门了。'], ['{rival} wants to be the English Champion!', '{rival} 想当英语冠军！']] },
      2: { role: 'talk', name: 'Mr Park', look: 'grandpa', say: [['Good evening! Oh, it is still morning? Ha ha!', '晚上好！哦，现在还是早上？哈哈！'], ['My daughter is Professor Echo. She works too hard!', '回声博士是我的女儿。她工作太努力了！']] },
    },
  });

  // ---------- 道馆：问候之门（鹦鹉船长） ----------
  // 三道门各有一只鹦鹉守着；看窗外的天色（早上 / 下午 / 晚上），对它说对问候语门才开
  EM.define('i0G', {
    kind: 'inside', z: 0, room: 'G', name: '你好岛道馆', en: 'Hello Gym', sub: '馆主：鹦鹉船长',
    rows: [
      'WWWWWWWWWWWWW',
      'Wk____1____kW',
      'W___________W',
      'Wp____u____pW',
      'WWWWWZ|ZWWWWW',
      'W___________W',
      'W_______3___W',
      'W___________W',
      'WWWZ|ZWWWWWWW',
      'W___________W',
      'W__2________W',
      'W___________W',
      'WWWWWWWWZ|ZWW',
      'W___________W',
      'Wp_________pW',
      'W_____u_____W',
      'WWWWWWeWWWWWW',
    ],
    links: { e: 't0' },
    npc: {
      1: { role: 'leader' },
      2: { role: 'trainer', name: 'Sailor Jack', look: 'dad', face: 'right', sight: 4, types: ['flying', 'water'], n: 1, lines: [['Good afternoon, young trainer! Ahoy!', '下午好，小训练师！啊嗬！']], win: ['Good job! The captain is waiting.', '干得好！船长在等你。'] },
      3: { role: 'trainer', name: 'Sailor Nina', look: 'swimmerF', g: 'f', face: 'left', sight: 4, types: ['flying', 'normal'], n: 2, lines: [['Good evening! Do you know the right words?', '晚上好！你知道该说什么吗？']], win: ['You say hello very well!', '你打招呼打得真好！'] },
    },
  });
  // 门从下往上：早上 → 下午 → 晚上（机关门编号从上往下是 0、1、2）
  const GREET = [
    { gate: 0, pic: '🌇', time: '8:00 pm', en: 'Good evening!', zh: '晚上八点，太阳下山了。' },
    { gate: 1, pic: '☀️', time: '3:00 pm', en: 'Good afternoon!', zh: '下午三点，太阳很大。' },
    { gate: 2, pic: '🌅', time: '7:00 am', en: 'Good morning!', zh: '早上七点，太阳刚升起来。' },
  ];
  const GREET_OPTS = ['Good morning!', 'Good afternoon!', 'Good evening!', 'Good night!'];
  const parrot = (en, zh, x) => Object.assign({ who: 'Parrot', emo: '🦜', en, zh }, x || {});
  async function greetGate(C, g) {
    const E = C.E;
    if (C.gateOpen(g.gate)) return;
    let ok = false;
    await C.talk([
      parrot('Squawk! Look at the window. What time is it?', '嘎！看看窗外。现在是什么时候？（' + g.time + '）'),
      parrot('Squawk! Say the right greeting to open the gate!', '看窗外的天色，选出正确的问候语，再大声说出来！', {
        kind: 'answer', pic: g.pic, opts: GREET_OPTS.map(t => ({ t, c: t === g.en })).sort(() => Math.random() - .5),
        pass: () => { ok = true; return [parrot(g.en + ' Squawk!', '说对了！' + g.zh + '门开了！')]; },
        fail: () => [parrot('Squawk! Wrong greeting! Back to the door!', '嘎！说错啦！回到门口重来！')],
      }),
    ]);
    if (ok) { C.openGate(g.gate, true); E.SFX.win(); return; }
    E.SFX.bad();
    C.teleport(6, 15, 'up');
  }

  // ======================================================================
  // 第 1 岛 · 彩色文具岛 Crayon Island：糖果色的方块房子、铅笔一样的树
  // ======================================================================
  EM.define('t1', {
    kind: 'town', z: 1, name: '彩色文具岛', en: 'Crayon Island', sub: '第 2 岛',
    rows: [
      '###############^^###############',
      '#TTTTTTTTTTTTTT==TTTTTTTTTTTTTT#',
      '#TT.F.Z..F.....==....F..Z.F..TT#',
      '#T.............==.............T#',
      '#..AAAAAAA.....==.....GGGGGGG..#',
      '#..AAAAAAA.....==.....GGGGGGG..#',
      '#..AAAAAAA.....==.....GGGGGGG..#',
      '#..AAAaAAA.....==.....GGGgGGG..#',
      '#.....=........==........=.....#',
      '#.....====================.....#',
      '#.B.......F..F..F..F........3..#',
      '#...Z..........................#',
      '#..HHHHH..............CCCCC....#',
      '<..HHHHH..............CCCCC....#',
      '<==HHhHH..............CCCCC....#',
      '#.==.=................CCcCC....#',
      '#.....====================.....#',
      '#.4.......Z..........MMMMM.....#',
      '#..JJJJ..............MMMMM.....#',
      '#..JJJJ.....5........MMmMM.....#',
      '#..JjJJ........==......=.......#',
      '#...=..........==..............#',
      '#...=======================....#',
      '#TT.....F..EEE.==.EEE......F.TT#',
      '#T.........EEE.==.EEE...6.....T#',
      '#T..o......EEE.==.EEE.........T#',
      '#TT...*........==..........F.TT#',
      '#TTTF..........==.........FTTTT#',
      '#TTTTTTTTTTTTTT==TTTTTTTTTTTTTT#',
      '###############vv###############',
    ],
    links: { s: 'r0', n: 'f1', w: 'r1w' },
    marks: [
      [['A giant red crayon. It is taller than you!', '一支巨大的红色蜡笔，比你还高！']],
      [['A giant blue crayon.', '一支巨大的蓝色蜡笔。']],
      [['A giant yellow crayon.', '一支巨大的黄色蜡笔。']],
      [['A giant green crayon. Someone wrote "Keep tidy!" on it.', '一支巨大的绿色蜡笔，上面有人写着「保持整洁！」']],
    ],
    signs: [['Crayon Island. Keep your desk tidy!', '彩色文具岛：保持书桌整洁！']],
    items: ['superball'],
    hiddenItems: ['leafstone'],
    npc: {
      3: { role: 'quiz' },
      4: { role: 'talk', name: 'Ms Pen', look: 'teacher', g: 'f', say: [['Is this your pencil?', '这是你的铅笔吗？'], ['No, it is not. My pencil is yellow.', '不是。我的铅笔是黄色的。']], speak: 'My pencil is yellow.' },
      5: { role: 'talk', name: 'Rulers Rick', look: 'student', say: [['I have a ruler, two pens and an eraser.', '我有一把尺子、两支钢笔和一块橡皮。'], ['I keep them in my pencil box.', '我把它们放在铅笔盒里。']], speak: 'I keep them in my pencil box.' },
      6: { role: 'talk', name: 'Lucy', look: 'kidF', g: 'f', say: [['What colour is your bag?', '你的书包是什么颜色的？'], ['My bag is pink. I love pink!', '我的书包是粉色的。我最喜欢粉色！']], speak: 'My bag is pink.' },
    },
    people: [
      // 画家：剧情做完以后在镇上
      { id: 'painter', role: 'story', name: 'Painter Iris', look: 'chef', g: 'f', x: 6, y: 9, face: 'down', showIf: 'z1intro' },
    ],
  });
  // 蜡笔海滩：可选的海滩，沙堡、游泳的训练师、沙洲上的道具
  EM.define('r1w', {
    kind: 'route', z: 1, name: '蜡笔海滩', en: 'Crayon Beach', sub: '彩色文具岛西边',
    rows: [
      '##########################',
      '#TTT,,,,TTTT.....TTTTTTTT#',
      '#TT,,,,,,.....,,,...TTTTT#',
      '#T.,,1,,..F......,,,,.TTT#',
      '#T.......o.....F...,,,..T#',
      '#TT..B...........2.......>',
      '#T.....==================>',
      '#SSSSSSSSSSSSSSSSSSSSSSST#',
      '#SSSS3SSSSSSSSS*SSSSSSSST#',
      '#SSSSSSSSSZSSSSSSSSSS4SSS#',
      '#SS~~~SSSSSSSSSSSSS~~~SSS#',
      '~~~~~~~SSSSSSSSSSS~~~~~~~~',
      '~~~~~~~~~~SSSoSSS~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~5~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SS~~~~~~~',
      '~~~~~~~~~~~~~~~~S*SS~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    links: { e: 't1' },
    markKinds: ['crayon'],
    marks: [[['A sand castle! A child built it with a blue bucket.', '一座沙堡！是一个小朋友用蓝色小桶堆的。']]],
    signs: [['Crayon Beach. Keep the beach tidy!', '蜡笔海滩：保持沙滩整洁！']],
    items: ['potion', 'firestone'],
    hiddenItems: ['superpotion', 'revive'],
    npc: {
      1: { role: 'trainer', name: 'Artist Zoe', look: 'kidF', g: 'f', face: 'right', sight: 4, under: ',', types: ['bug', 'grass'], n: 2, lines: [['What colour is my monster? It is green!', '我的怪兽是什么颜色？是绿色！']], win: ['Green, yellow, red... so many colours!', '绿的、黄的、红的……好多颜色！'] },
      2: { role: 'trainer', name: 'Kite Boy Ken', look: 'kid', face: 'down', sight: 2, types: ['flying'], n: 1, lines: [['My kite is orange and blue!', '我的风筝是橙色和蓝色的！']], win: ['My kite flew away!', '我的风筝飞走了！'] },
      3: { role: 'trainer', name: 'Beach Boy Leo', look: 'swimmer', face: 'right', sight: 4, types: ['water', 'normal'], n: 2, lines: [['Is this your bucket? No? Then battle!', '这是你的小桶吗？不是？那就对战吧！']], win: ['I will find my bucket...', '我去找我的小桶……'] },
      4: { role: 'trainer', name: 'Fisher Pat', look: 'fisher', face: 'left', sight: 5, types: ['water'], n: 2, lines: [['My fishing rod is brown. What colour is yours?', '我的钓竿是棕色的。你的是什么颜色？']], win: ['Nice! You are good!', '不错！你很厉害！'] },
      5: { role: 'trainer', name: 'Swimmer Joy', look: 'swimmerF', g: 'f', face: 'right', sight: 4, under: '~', types: ['water'], n: 2, lv: 3, lines: [['I have a pink swim ring!', '我有一个粉色的游泳圈！']], win: ['Splash! You win!', '哗啦！你赢了！'] },
    },
  });
  // 涂鸦森林：铅笔树的迷宫。左边一条路往北，右边一条路有往南跳的台阶（近路），中间是死胡同
  EM.define('f1', {
    kind: 'route', z: 1, name: '涂鸦森林', en: 'Graffiti Woods', sub: '彩色文具岛北边', lv: 1,
    rows: [
      '##############^^##############',
      '#TTTTTTTTTTTTT==TTTTTTTTTTTTT#',
      '#TTTTTTTTTTTTT2TTTTTTTTTTTTTT#',
      '#TTTTTT.......=.......TTTTTTT#',
      '#TTTT.....,,,,...,,,,.....TTT#',
      '#TTT..F..,,,,.....,,,,..F.oTT#',
      '#TTT....Z.........Z......TTTT#',
      '#TTTTT.......==.......TTTTTTT#',
      '#TTTTTTTTTTTT..TTTTTTTTTTTTTT#',
      '#T,,,,.................,,,,,T#',
      '#T,,,,....TTT..TTTT....,,,,,T#',
      '#T...TTTTTTTT..TTTTTTTTT...TT#',
      '#T,,,TTTTTTTT..TTTTTTTTT,,,TT#',
      '#T,1,TTT............TTTT,,,TT#',
      '#T,,,TT..F....Z....F..TT,2,TT#',
      '#T,,,TT...o...........TT,,,TT#',
      '#T...TTTTTTTTTTTTTTTTTTT...TT#',
      '#T...TTTTTTTTTTTTTTTTTTTLLLTT#',
      '#T,,,........TTTTTTTTTTT,,,TT#',
      '#T,,,..3.....TTTTTTTTTTT,4,TT#',
      '#T...TTTTT.*.TTTTTTTTTTT...TT#',
      '#T...TTTTTTTTTTTTTTTTTTT...TT#',
      '#T,,,TTTTTTTTTTTTTTTTTTT,,,TT#',
      '#T,,,TTTTTTTTTTTTTTTTTTT,,,TT#',
      '#T...TTTTTTTTTTTTTTTTTTT...TT#',
      '#T......................,,,TT#',
      '#TT,,,,.......,.........,,,TT#',
      '#TTTTTTTTTTTT..TTTTTTTTTTTTTT#',
      '#TTTTTTTTTTTT..TTTTTTTTTTTTTT#',
      '#TTTTTT,,,,,....,,,,,,TTTTTTT#',
      '#TTTTT,,,,,,....,,,,,,,TTTTTT#',
      '#TTTT..,,,,,....,,,,,..F.TTTT#',
      '#TTTT.F..........B.......TTTT#',
      '#TTTTTT......==........TTTTTT#',
      '#TTTTTTTTT...==...TTTTTTTTTTT#',
      '#TTTTTTTTTT..==..TTTTTTTTTTTT#',
      '#TTTTTTTTTTT.==.TTTTTTTTTTTTT#',
      '#TTTTTTTTTTTT==TTTTTTTTTTTTTT#',
      '#TTTTTTTTTTTT==TTTTTTTTTTTTTT#',
      '#############vv###############',
    ],
    links: { s: 't1', n: 'r1' },
    marks: [
      [['Someone painted a smiling sun on this crayon.', '有人在这支蜡笔上画了一个笑脸太阳。']],
      [['Someone painted a rainbow on this crayon.', '有人在这支蜡笔上画了一道彩虹。']],
      [['A crayon with graffiti: "Shh!" It must be Team Hush!', '一支蜡笔上涂着「嘘！」——一定是嘘声团干的！']],
    ],
    signs: [["Graffiti Woods. Please don't paint on the trees!", '涂鸦森林：请不要在树上乱画！']],
    items: ['superball', 'potion'],
    hiddenItems: ['thunderstone'],
    npc: {
      1: { role: 'trainer', name: 'Bug Kid Tony', look: 'kid', face: 'down', sight: 3, under: ',', types: ['bug'], n: 2, lines: [['My bug is black and yellow. Cool, right?', '我的虫子是黑黄相间的。酷吧？']], win: ['Black and yellow... and beaten!', '黑黄相间的……被打败了！'] },
      2: { role: 'guard', badge: 2, name: 'Ranger Mo', look: 'ranger', say: [['Stop, please! The road north goes to Route 2.', '请停一下！往北是 2 号路。'], ['Only trainers with two badges can go. Beat the Crayon Gym first!', '只有两枚徽章的训练师才能过去。先去打赢彩色文具岛的道馆吧！']] },
      3: { role: 'trainer', name: 'Painter Sue', look: 'chef', g: 'f', face: 'left', sight: 2, types: ['normal', 'grass'], n: 2, lines: [['I lost my brushes! Are they blue?', '我的画笔丢了！是蓝色的吗？']], win: ['Oh, my brushes are in my bag!', '哦，画笔在我包里！'] },
      4: { role: 'trainer', name: 'Camper Rob', look: 'hiker', face: 'up', sight: 3, under: ',', types: ['grass', 'bug'], n: 2, lines: [['Is this your eraser? I found it here!', '这是你的橡皮吗？我在这儿捡到的！']], win: ['I will give it to the lost and found.', '我把它交给失物招领处。'] },
    },
  });
  // 2 号路：田野和池塘，往北就是温馨家庭岛
  EM.define('r1', {
    kind: 'route', z: 1, name: '2 号路', en: 'Route 2', sub: '彩色文具岛 → 温馨家庭岛',
    rows: [
      '###########^^###########',
      '#TTTTTTTTTT==TTTTTTTTTT#',
      '#TT....,,,,==,,,,....TT#',
      '#T..1.,,,,.==.,,,,.....#',
      '#T....,,,,.==.,,,,..o.T#',
      '#TT........==.......TTT#',
      '#TTTT~~~...==....2...TT#',
      '#TT~~~~~...==.........T#',
      '#T~~~~~~...==....,,,,.T#',
      '#T~~o~~~...==....,,,,.T#',
      '#TT~~~~....==....,,3,.T#',
      '#TTT......===.....,,,.T#',
      '#LLLLLLLLLL==LLLLLLLLTT#',
      '#....,,,,..==.....o...T#',
      '#T...,,,,..==..4......T#',
      '#TT........==........TT#',
      '#TTTTT.....==.....TTTTT#',
      '#TTTTTT....==....TTTTTT#',
      '#T,,,,,....==....,,,,,T#',
      '#T,,,,,....==....,,5,,T#',
      '#T,,,,,.B..==....,,,,,T#',
      '#TT........==........TT#',
      '#TTTT......==......TTTT#',
      '#TT..F.....==.....F..TT#',
      '#T..,,,,...==..*,,,,..T#',
      '#T..,,,,...==...,,,,..T#',
      '#TT......o.==........TT#',
      '#TTTTT.....==.....TTTTT#',
      '#TTTTTTT...==...TTTTTTT#',
      '###########vv###########',
    ],
    links: { s: 'f1', n: 't2' },
    signs: [['Route 2. North: Family Island.', '2 号路。往北是温馨家庭岛。']],
    items: ['potion', 'superpotion', 'repel', 'ball'],
    hiddenItems: ['superball'],
    npc: {
      1: { role: 'trainer', name: 'Student Ann', look: 'studentF', g: 'f', face: 'right', sight: 4, types: ['normal', 'psychic'], n: 2, lines: [['I have a new schoolbag. It is purple!', '我有一个新书包，是紫色的！']], win: ['Please keep your things tidy!', '请把你的东西收拾整齐！'] },
      2: { role: 'trainer', name: 'Fisher Gus', look: 'fisher', face: 'left', sight: 4, types: ['water'], n: 2, lines: [['What is this? It is a fish! What colour? Silver!', '这是什么？是一条鱼！什么颜色？银色！']], win: ['My fish swam away...', '我的鱼游走了……'] },
      3: { role: 'trainer', name: 'Bug Kid Ivy', look: 'kidF', g: 'f', face: 'left', sight: 5, under: ',', types: ['bug', 'grass'], n: 2, lines: [['Look! My bug has red and black spots!', '看！我的虫子有红黑色的斑点！']], win: ['My bug is tired now.', '我的虫子累了。'] },
      4: { role: 'trainer', name: 'Student Max', look: 'student', face: 'left', sight: 3, types: ['normal', 'fight'], n: 2, lines: [['Is that your pencil box? It is so tidy!', '那是你的铅笔盒吗？好整齐！']], win: ['I will clean my desk tonight.', '今晚我要把书桌收拾干净。'] },
      5: { role: 'trainer', name: 'Camper Nora', look: 'kidF', g: 'f', face: 'left', sight: 5, under: ',', types: ['grass', 'flying'], n: 2, lv: 1, lines: [['The next island is Family Island. My grandma lives there!', '下一座岛是温馨家庭岛，我奶奶住在那里！']], win: ['Say hello to my grandma!', '替我向奶奶问好！'] },
    },
  });

  // ---------- 彩色文具岛的室内 ----------
  // 画家的工作室
  EM.define('i1A', { markKinds: ['board', 'board'],
    kind: 'inside', z: 1, room: 'A', name: '画家的工作室', en: 'Art Studio', sub: '彩色文具岛',
    rows: ['WWWWWWWWWWWWW', 'Wkk_Y_Y_Y_kkW', 'W___________W', 'W_Z_______Z_W', 'W_____1_____W', 'Wp_YY___YY_pW', 'W___________W', 'W_____u_____W', 'WWWWWWeWWWWWW'],
    links: { e: 't1' },
    npc: { 1: { role: 'story', id: 'studio', name: 'Mr Brush', look: 'teacher' } },
  });
  // 小凯的舅舅家
  EM.define('i1H', {
    kind: 'inside', z: 1, room: 'H', name: '小凯的舅舅家', en: "Kai's Uncle's House", sub: '彩色文具岛',
    rows: ['WWWWWWWWW', 'Wkk_t__dW', 'W______dW', 'W_YY_1__W', 'W_YY__2_W', 'Wp______W', 'W___u___W', 'WWWWeWWWW'],
    links: { e: 't1' },
    npc: {
      1: { role: 'story', id: 'uncle', name: 'Uncle Wu', look: 'grandpa' },
      2: { role: 'story', id: 'kaihome', name: 'Kai', look: 'kai', showIf: 'z1kai' },
    },
  });

  // ---------- 道馆：彩色地板（彩虹蟹） ----------
  // 听广播：这一段只能踩什么颜色。踩错颜色就回到这一段的起点；走到这一段的尽头，前面的门就开了
  EM.define('i1G', {
    kind: 'inside', z: 1, room: 'G', name: '彩色文具岛道馆', en: 'Crayon Gym', sub: '馆主：彩虹蟹',
    rows: [
      'WWWWWWWWWWWWW',
      'Wp____1____pW',
      'W___________W',
      'WWWWWW|WWWWWW',
      'W___________W',
      'W___________W',
      'W___________W',
      'W___________W',
      'W__2________W',
      'WWWWWW|WWWWWW',
      'W___________W',
      'W___________W',
      'W___________W',
      'W___________W',
      'W________3__W',
      'WWWWWW|WWWWWW',
      'W___________W',
      'W___________W',
      'W___________W',
      'W___________W',
      'Wp____u____pW',
      'WWWWWWeWWWWWW',
    ],
    over: [
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '.rybgybrgbyr.',
      '.gyyybrgyrgb.',
      '.brgyrgyybrg.',
      '.............',
      '.............',
      '.............',
      '.rgyrgygbrgy.',
      '.yrgyrbbbgyr.',
      '.gyrgybrgyrg.',
      '.............',
      '.............',
      '.............',
      '.bgrrbgyrbyg.',
      '.gybrrbygbyg.',
      '.ybgbrrgbygb.',
      '.............',
      '.............',
    ],
    paint: { r: '#ef5350', y: '#ffd54f', b: '#42a5f5', g: '#66bb6a' },
    links: { e: 't1' },
    npc: {
      1: { role: 'leader' },
      2: { role: 'trainer', name: 'Artist Mia', look: 'kidF', g: 'f', face: 'right', sight: 3, types: ['rock', 'normal'], n: 2, lines: [['What colour is the sky? Blue! What colour is my monster? Grey like a rock!', '天空是什么颜色？蓝色！我的怪兽呢？像石头一样灰！']], win: ['You know your colours!', '你的颜色学得真好！'] },
      3: { role: 'trainer', name: 'Artist Leo', look: 'student', face: 'left', sight: 3, types: ['rock', 'bug'], n: 2, lines: [['Red, yellow, blue! Which one do you like?', '红、黄、蓝！你喜欢哪一个？']], win: ['I like your colour: gold, like a badge!', '我喜欢你的颜色：金色，像徽章一样！'] },
    },
  });
  // 三段彩色地板（从下往上）：要踩的颜色、这段的范围、走到哪一行开哪道门、踩错回哪里
  const ZONES = [
    { c: 'r', en: 'Walk on red!', name: 'Red', zh: '红色', dot: '🔴', y0: 17, y1: 19, land: 16, gate: 2, start: [6, 20] },
    { c: 'b', en: 'Walk on blue!', name: 'Blue', zh: '蓝色', dot: '🔵', y0: 11, y1: 13, land: 10, gate: 1, start: [6, 14] },
    { c: 'y', en: 'Walk on yellow!', name: 'Yellow', zh: '黄色', dot: '🟡', y0: 5, y1: 7, land: 4, gate: 0, start: [6, 8] },
  ];
  const COLOR_OPTS = ['Red', 'Blue', 'Yellow', 'Green'];
  const crab = (en, zh, x) => Object.assign({ who: 'Rainbow Crab', emo: '🦀', en, zh }, x || {});
  const zoneNow = C => ZONES.find(z => !C.gateOpen(z.gate));
  function showZone(C, z) { C.note(z ? '🎨 这一段只能踩：<b>' + z.dot + ' ' + z.name + '</b>（' + z.zh + '）' : '🦀 彩虹蟹在最里面等你！'); }
  async function announce(C, z) {
    await C.talk([{ who: '广播', emo: '📢', en: z.en, zh: '仔细听广播：这一段要踩什么颜色？选出来再大声说一遍。', hideEn: true, kind: 'answer', opts: COLOR_OPTS.map(t => ({ t, c: t === z.name })).sort(() => Math.random() - .5), fail: () => [crab('Listen again: ' + z.en, '再听一遍：' + z.en + '（' + z.zh + '）')] }]);
    showZone(C, z);
  }

  // ======================================================================
  // 剧情
  // ======================================================================
  const S = (who, look, g) => L.sayer(who, look, g);
  const kai = S('Kai', 'kai', 'm'), orion = S('Orion', 'orion', 'm'), painter = S('Painter Iris', 'chef', 'f');

  // 第 1 岛：到岛上发现颜色全没了
  async function crayonIntro(C) {
    const E = C.E, pl = C.pl;
    C.filter('grayscale(1)');
    await C.wait(400);
    const v = C.spawn({ look: P.LOOKS.chef, name: 'Painter Iris', g: 'f', x: pl.x + 1, y: pl.y - 2, face: 'down', id: 'painterRun' });
    await C.alert(v);
    await C.walk(v, 'down', 1, 200);
    C.faceEach(v);
    await C.talk([
      painter('Oh! A trainer! Look around you. What colour is my house?', '啊！是训练师！你看看周围。我的房子是什么颜色的？'),
      painter("It was pink! But now it's grey. Everything is grey!", '它本来是粉色的！可现在是灰色。所有东西都变灰了！'),
      painter('A man in a grey hoodie took our Color Crystal. He ran into the Graffiti Woods!', '一个穿灰色连帽衫的人偷走了我们的颜色水晶，跑进涂鸦森林了！'),
      painter('People are forgetting the colour words... Do you still remember them?', '大家都快忘了颜色怎么说了……你还记得吗？'),
      L.ask(painter, 'What colour is an apple?', '苹果是什么颜色的？选出回答，再大声说出来。🍎', "It's red.", ["It's blue.", "It's black."], { pic: '🍎' }),
      L.ask(painter, 'What colour is the sea?', '大海是什么颜色的？🌊', "It's blue.", ["It's pink.", "It's brown."], { pic: '🌊' }),
      painter('Yes! You remember! Please get our crystal back!', '对！你还记得！请把我们的水晶抢回来！'),
      painter('The Graffiti Woods are north of the town.', '涂鸦森林就在小镇北边。'),
    ]);
    C.set('z1intro');
    await C.walk(v, 'up', 3, 180);
    C.remove(v);
    E.save();
  }
  // 涂鸦森林：团员一看见你就往北跑
  async function woodsChase(C) {
    const pl = C.pl;
    const g = C.spawn({ look: P.LOOKS.grunt, name: 'Hush Grunt', x: pl.x, y: pl.y - 4, face: 'down' });
    await C.alert(g);
    await C.talk([{ who: 'Hush Grunt', look: P.LOOKS.grunt, en: "Shh! You can't catch me!", zh: '嘘！你抓不到我的！' }]);
    await C.walk(g, 'up', 3, 120);
    C.remove(g);
    C.set('z1chase');
  }
  // 小凯：腼腆的男孩想要第一只怪兽（仿绿宝石的小光）
  async function kaiCatch(C) {
    const E = C.E, MG = C.MG, pl = C.pl;
    const k = C.spawn({ look: P.LOOKS.kai, name: 'Kai', x: pl.x, y: pl.y + 3, face: 'up', id: 'kai' });
    await C.talk([{ who: '???', emo: '💬', en: 'W-wait... please wait!', zh: '等、等一下……请等一下！' }]);
    C.facePlayer('down');
    await C.walk(k, 'up', 2, 260);
    const K = (en, zh, x) => kai(en, zh, x);
    await C.talk([
      K('H-hi. I... I am Kai.', '你、你好。我……我叫小凯。'),
      K('I am staying with my uncle on this island. I am... not good at talking.', '我住在这座岛上的舅舅家。我……不太会说话。'),
      K('But I want a monster friend. Monsters listen to clear words, right?', '可是我想要一个怪兽朋友。怪兽喜欢听清楚的话，对吧？'),
      K('My uncle gave me an Echo Ball. Can you... come with me into the grass?', '舅舅给了我一个回声球。你能……陪我去草丛里吗？'),
    ]);
    const wild = C.spawn({ mon: 'owlet', x: k.x + 1, y: k.y - 1, face: 'left' });
    await C.alert(k);
    await C.talk([
      K('Oh! A monster! What do I say? What do I say?', '啊！一只怪兽！我该说什么？该说什么？'),
      L.speak(C, 'You can do it, Kai! Say it loudly!', '给小凯打气：大声说出来！'),
      K('O-okay! Go, Echo Ball!', '好、好的！去吧，回声球！', { onShow: () => { E.SFX.hit(); } }),
    ]);
    C.remove(wild);
    E.SFX.win(); E.toast('🔮 小凯收服了 Owlet！', 'gold');
    await C.talk([
      K('I did it! I caught Owlet! It came to me because I spoke clearly!', '我做到了！我收服了 Owlet！因为我说得很清楚，它才过来的！'),
      K('Thank you, {name}. I want to be strong, like you.', '谢谢你，{name}。我想变得像你一样强。'),
      K('I will go home and tell my uncle. See you!', '我要回家告诉舅舅。回头见！'),
    ]);
    C.set('z1kai');
    await C.walk(k, 'down', 4, 170);
    C.remove(k);
    E.save();
  }
  // 涂鸦森林深处：两个团员守着颜色水晶
  const WOODS_HUSH = [{ key: 'grunt', x: 13, y: 4 }, { key: 'gruntF', x: 15, y: 4 }];
  function spawnWoodsHush(C) {
    WOODS_HUSH.forEach((h, i) => {
      if (C.flag('z1h' + i) || C.npc(n => n.id === 'wh' + i)) return;
      const H = L.HUSH[h.key];
      C.spawn({ id: 'wh' + i, role: 'hush', look: P.LOOKS[H.look], name: H.name, g: H.g, x: h.x, y: h.y, face: 'down', k: i, key: h.key });
    });
  }
  async function woodsFight(C, n) {
    const lines = n.k === 0
      ? [["Shh! You followed me? This crystal is ours now!", '嘘！你跟过来了？这颗水晶现在是我们的了！'], ['Colours are too loud! Grey is quiet!', '颜色太吵了！灰色才安静！']]
      : [['Be quiet, kid! No more colour words!', '安静点，小鬼！不许再说颜色了！']];
    const res = await L.hushFight(C, n, n.key, { lines, types: ['poison', 'dark'], n: 2, lv: 1 });
    if (res !== 'win') return;
    C.set('z1h' + n.k);
    C.remove(n);
    if (!C.flag('z1h0') || !C.flag('z1h1')) { await C.talk([{ who: '旁白', emo: '💬', en: 'The other one still has the crystal!', zh: '水晶还在另一个团员手上！' }]); return; }
    await C.talk([{ who: 'Hush Grunt', look: P.LOOKS.gruntF, g: 'f', en: 'Shh... Fine! Take your noisy crystal!', zh: '嘘……好吧！拿走你们吵死人的水晶！' }]);
    await L.restoreCrystal(C, 1);
    await C.talk([{ who: '旁白', emo: '🌈', en: 'Colours are coming back to Crayon Island!', zh: '颜色回到彩色文具岛了！快回镇上看看吧！' }]);
  }
  // 回到镇上：颜色回来了，画家道谢
  async function painterThanks(C, n) {
    C.faceEach(n);
    if (!C.flag('z1thanks')) {
      await C.talk([
        painter('Look! My house is pink again! The sky is blue! Thank you, {name}!', '你看！我的房子又是粉色的了！天空是蓝色的！谢谢你，{name}！'),
        painter('Can you say it with me? "Red, yellow, blue and green!"', '和我一起说：「红、黄、蓝、绿！」'),
        L.speak(C, 'Red, yellow, blue and green!', '一起大声说！'),
        painter('Take these. Now go and see the Rainbow Crab at the Gym!', '这些送给你。现在去道馆找彩虹蟹吧！', { onShow: () => C.give('superpotion', 2) }),
      ]);
      C.set('z1thanks');
      return;
    }
    await C.talk([painter('Every colour is beautiful. Keep your world colourful!', '每种颜色都很美。让你的世界一直多彩吧！')]);
  }
  // 画家工作室：每天一道颜色题
  async function studio(C, n) {
    C.faceEach(n);
    const T = S('Mr Brush', 'teacher', 'm');
    const W = C.E.W[1].words.filter(w => w[2]);
    const it = W[new Date().getDate() % W.length];
    await C.talk([
      T('Welcome to my art studio! I paint every day.', '欢迎来到我的画室！我每天都画画。'),
      L.ask(T, 'Look at my picture. What is it?', '看看我的画。它用英语怎么说？（' + it[1] + '）', it[0], W.filter(w => w !== it).slice(0, 2).map(w => w[0]), { pic: it[2], pass: () => C.daily('studio1', () => C.give('potion', 1)) ? [T('Great! Here is a potion.', '答对了！送你一瓶药水。')] : [T('Great! Come back tomorrow.', '答对了！明天再来吧。')] }),
    ]);
  }
  // 小凯的舅舅
  async function uncle(C, n) {
    C.faceEach(n);
    const U = S('Uncle Wu', 'grandpa', 'm');
    if (C.flag('z1kai') && !C.flag('z1uncle')) {
      await C.talk([
        U('So you are {name}! Kai told me about you.', '你就是 {name} 吧！小凯跟我说起过你。'),
        U('Kai is shy. But today he spoke loudly! Thank you.', '小凯很害羞，可今天他大声说话了！谢谢你。'),
        U('Here, take these Super Balls.', '这些超级球送给你。', { onShow: () => C.give('superball', 3) }),
      ]);
      C.set('z1uncle');
      return;
    }
    await C.talk([U('This is my family photo. This is my sister, and this is Kai.', '这是我的全家福。这是我妹妹，这是小凯。')]);
  }
  async function kaiHome(C, n) {
    C.faceEach(n);
    await C.talk([kai('Owlet and I train every day. One day, I want to battle you!', '我和 Owlet 每天都在训练。总有一天，我要和你对战！')]);
  }
  // 路边小屋的奶奶：让怪兽休息，教你打招呼
  async function restHouse(C, n) {
    C.faceEach(n);
    const G = S('Granny Rose', 'granny', 'f');
    await C.talk([
      G('Hello, dear! You look tired. Sit down and have a rest.', '你好呀，孩子！你看起来累了。坐下来歇一歇吧。'),
      G('Your monsters are fine now.', '你的怪兽们都恢复精神了。', { onShow: () => { C.MG.healAll(); C.E.SFX.win(); C.E.toast('💖 怪兽们的体力都恢复了', 'gold'); } }),
      G('When you leave, what do you say?', '要走的时候，你会说什么？'),
      L.speak(C, 'Goodbye! See you next time!', '和奶奶道别：大声说出来'),
      G('Goodbye, dear! Come back anytime.', '再见，孩子！随时回来。'),
    ]);
  }
  // 回声洞里的导师欧瑞（仿绿宝石的大吾）
  async function orionCave(C, n) {
    C.faceEach(n);
    if (!C.flag('z0orion')) {
      await C.talk([
        orion('Oh? Hello. I did not hear you come in.', '哦？你好。我没听见你进来。'),
        orion('My name is Orion. I study old words. These words on the stone are very old.', '我叫欧瑞，研究古老的词语。这石头上的字非常古老。'),
        orion('They tell a story. Long ago, a giant monster ate every sound in the world.', '它们讲了一个故事：很久以前，一只巨兽吞掉了世界上所有的声音。'),
        orion('People called it the Hush King. Then everyone spoke together, and Echodrake woke up.', '人们叫它寂静之王。后来大家一起大声说话，回声龙醒了过来。'),
        orion('Some people want a quiet world again. Be careful on your journey, {name}.', '有些人又想要一个安静的世界。旅途中要小心，{name}。'),
        orion('Can you read the stone for me? Read it loudly.', '你能帮我把石头上的字念出来吗？大声念。'),
        L.speak(C, 'Words have power.', '大声念出石头上的字'),
        orion('Well done. Your voice is clear. We will meet again.', '很好。你的声音很清楚。我们还会再见的。', { onShow: () => C.give('superpotion', 1) }),
      ]);
      C.set('z0orion');
      return;
    }
    await C.talk([orion('The Hush King... I must learn more about it.', '寂静之王……我得再多了解一些。')]);
  }

  // ---------- 第 0 岛 ----------
  ST.isle(0, {
    enter(C) {
      const id = C.map.id;
      if (id === 'c0' && !C.flag('leg:rockgiant') && !C.npc(n => n.mon === 'rockgiant')) return () => { C.spawn({ mon: 'rockgiant', role: 'legend', x: 21, y: 3, face: 'down' }); };
      return null;
    },
    step(C) {
      const m = C.map, pl = C.pl;
      // 1 号路中间：第一次遇到对手
      if (m.id === 'r0' && C.flag('starter') && !C.flag('rival1') && C.MG.anyAlive() && (pl.x === 11 || pl.x === 12) && pl.y >= 29 && pl.y <= 31) return () => L.rival1(C);
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 'r0h' && n.id === 'rest') return () => restHouse(C, n);
      if (id === 'c0' && n.id === 'orion') return () => orionCave(C, n);
      if (n.role === 'legend') return () => L.legendMeet(C, n);
      return null;
    },
    tile(C, f) {
      if (C.map.id !== 'i0G') return null;
      if (f.gate) { const g = GREET.find(q => (C.map.gates[q.gate] || {}).x === f.x && (C.map.gates[q.gate] || {}).y === f.y); return g ? () => greetGate(C, g) : null; }
      return () => C.talk([parrot('Squawk! Hello! Hello! Talk to the gate!', '嘎！你好！你好！对着门说话！')]);
    },
  });

  // ---------- 第 1 岛 ----------
  ST.isle(1, {
    busy: ['Our Color Crystal is gone! Everything is grey. I cannot battle now.', '我们的颜色水晶不见了！到处都是灰色的，我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (!C.flag('starter')) return null;
      // 老存档：已经拿到这座岛的徽章，剧情就算做过了
      if (C.E.S.mon.badges[1] && !C.flag('ch1')) { C.set('ch1'); C.set('z1intro'); }
      if (id === 't1') {
        if (!C.flag('z1intro') && !C.flag('ch1')) return () => crayonIntro(C);
        if (!C.flag('ch1')) C.filter('grayscale(1)');
        return null;
      }
      if (id === 'f1' && C.flag('z1intro') && !C.flag('ch1')) {
        spawnWoodsHush(C);
        if (!C.flag('z1chase')) return () => woodsChase(C);
        return null;
      }
      if (id === 'i1G') { const z = zoneNow(C); return () => z ? announce(C, z) : C.note(null); }
      return null;
    },
    step(C) {
      const id = C.map.id, pl = C.pl;
      if (id === 'f1' && C.flag('z1intro') && !C.flag('z1kai') && pl.y >= 29 && pl.y <= 31) return () => kaiCatch(C);
      if (id === 'i1G') {
        const z = ZONES.find(q => pl.y >= q.y0 && pl.y <= q.y1), o = C.over(pl.x, pl.y);
        if (z && !C.gateOpen(z.gate) && 'rybg'.includes(o) && o && o !== z.c) {
          return async () => {
            C.E.SFX.bad();
            await C.talk([crab('Oops! ' + z.en, '踩错颜色啦！这一段只能踩' + z.zh + '。回到起点重来！')]);
            C.teleport(z.start[0], z.start[1], 'up');
          };
        }
        const done = ZONES.find(q => pl.y === q.land && !C.gateOpen(q.gate));
        if (done) {
          return async () => {
            C.openGate(done.gate, true);
            C.E.SFX.win();
            await C.talk([crab('Great! You walked on ' + done.name.toLowerCase() + '! The gate is open!', '太棒了！你只踩了' + done.zh + '！门开了！')]);
            const nx = zoneNow(C);
            if (nx) await announce(C, nx); else showZone(C, null);
          };
        }
      }
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (n.role === 'hush' && id === 'f1') return () => woodsFight(C, n);
      if (id === 't1' && n.id === 'painter') return () => painterThanks(C, n);
      if (id === 'i1A' && n.id === 'studio') return () => studio(C, n);
      if (id === 'i1H' && n.id === 'uncle') return () => uncle(C, n);
      if (id === 'i1H' && n.id === 'kaihome') return () => kaiHome(C, n);
      return null;
    },
    tile(C) {
      if (C.map.id === 'i1G') return () => C.talk([crab('Listen to the speaker. Walk only on that colour!', '听广播：只能踩广播说的那种颜色！')]);
      return null;
    },
  });
})();
