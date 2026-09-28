// 回声岛 · 第 8–10 动物岛、规则城、运动美食岛（地图、剧情、道馆机关）。写法见 ISLES.md
// 第 8 岛 t8 动物岛 → j8 丛林小径 → h8a / h8b 嘘声团基地；s8 9 号水路（海上巡逻，9 枚徽章）
// 第 9 岛 t9 规则城（当一天小交警）→ s9 10 号水路 → 潜水 u9 海底隧道 → s10 11 号水路
// 第 10 岛 t10 运动美食岛（妈妈电话、对手接力赛、嘘声团垃圾食品）→ c10 冰洞（11 枚徽章）→ r10 雪原 → t11
(function () {
  'use strict';
  const EM = window.EchoMaps, ST = window.EchoStory, L = ST.lib, P = window.EchoPeople, LK = P.LOOKS;
  const WALK = EM.WALK;

  // ---------- 小工具 ----------
  // 训练师：名字、造型、朝向、视线、属性、开战台词、输了说的话、打完以后说的话
  const TR = (name, look, g, face, sight, types, line, win, after, x) => Object.assign({ role: 'trainer', name, look, g, face, sight, types, n: 2, lines: [line], win, after: [after] }, x || {});
  const nar = (en, zh, x) => Object.assign({ who: '旁白', emo: '📣', en, zh }, x || {});
  const radio = (who, en, zh, x) => Object.assign({ who: who + ' 📻', emo: '📻', en, zh }, x || {});
  // 在主角旁边找一格能站人的地方（剧情里临时人物出场用）
  function spot(C, prefer) {
    const ring = [[0, -2], [2, 0], [-2, 0], [0, 2], [1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [-1, 0], [0, 1]];
    for (const [dx, dy] of (prefer || []).concat(ring)) {
      const x = C.pl.x + dx, y = C.pl.y + dy;
      if (WALK.includes(C.tile(x, y)) && !C.npc(n => n.x === x && n.y === y)) return { x, y };
    }
    return { x: C.pl.x, y: C.pl.y - 1 };
  }
  const faceOf = (a, b) => Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? (b.x > a.x ? 'right' : 'left') : (b.y > a.y ? 'down' : 'up');
  // 听一句话、选对的回答：返回有没有选对
  async function quiz(C, S, en, zh, right, wrong, x) {
    let ok = false;
    await C.talk([L.ask(S, en, zh, right, wrong, Object.assign({ pass: () => { ok = true; return []; } }, x || {}))]);
    return ok;
  }
  // 测试用：看道馆机关的状态（红绿灯、脚印路口的答案）
  const DBG = window.EchoIsleD = {};

  // =====================================================================
  // 第 8 岛 动物岛 · Animal Friends
  // 巡林员罗莎请你找跑散的怪兽（听描述找对的那只）→ 丛林里看到云朵羊，用英语描述给她听
  // → 伪装成灌木的团员 → 基地 1F 偷听口令、开机关门 → 2F 打败低语、打开笼子、放走怪兽 → 小凯送飞空
  // =====================================================================
  const RANGER = { name: 'Ranger Rosa', g: 'f', look: Object.assign({}, LK.ranger, { style: 'ponytail', hair: '#6d4c41', eye: '#2e6fa0' }) };
  const KAI = { name: 'Kai', g: 'm', look: LK.kai };
  const BUSH = Object.assign({}, LK.grunt, { hat: 'straw', hatC: '#2e7d32', shirt: '#66bb6a', jacket: '#2e7d32', bottom: '#1b5e20', shoes: '#33691e' });
  const rosa = L.sayer(RANGER.name, RANGER.look, 'f');
  const kai = L.sayer('Kai', 'kai', 'm');
  const GRUNT_TYPES = ['poison', 'dark', 'bug'];

  EM.define('t8', {
    kind: 'town', z: 8, name: '动物岛', en: 'Animal Island', sub: '第 9 岛',
    rows: [
      '#############^^#####~~#############^^###',
      '#TTTTTTTTTT..==..TTT~~TTT..........==TT#',
      '#T.......F...==.TTT.~~T....GGGGGGG.==.T#',
      '#.AAAAAAA.Z..==..T..~~.....GGGGGGG.==..#',
      '#.AAAAAAA....==.....~~HHH..GGGGGGG.==F.#',
      '#.AAAAAAA.B..==..F..~~HHH..GGGGGGG.==..#',
      '#.AAAaAAA....==.....~~HhH..GGGgGGG.==..#',
      '#....=.......==.....~~.=......=....==..#',
      '#....================================..#',
      '#TT...F..T...==..TT.~~..F........F....o#',
      '#TTT.....TT..==.TTT.~~....Z....F.......#',
      '#TTTTTTTTTTTT==TTTTT~~TLLLLLLLLLLLTTTTT#',
      'R~~~~~~~~~~~~==~~~~~~~.................#',
      'R~~~~~~~~~~~~==~~~~~~~..F.......B......#',
      'R~~~~~SSCCCC.==.MMMM...fffffffffffff...#',
      'R~~~~~SSCCCC.==.MMMM...fFF..T...TFFf...#',
      'R~~~~~SSCCCC1==.MMMM...fF........*.f...#',
      'R~~~~~SSCCcC.==.MmMM...f.....Z.....f...#',
      'R~~~~~SS===============f...........f...#',
      'R~~~~~SS.....==........fT.........Tf...#',
      'R~So~~SSHHHH.==.HHHH...fF....T....Ff...#',
      'R~*S~~SSHHHH.==.HHHH...fFF.......FFf...#',
      'R~~~~~SSHHHH.==.HHHH...ffffff.ffffff...#',
      'R~~~~~SSHhHH.==.HHhH.......3B..........#',
      'R~~~~~SS===============================#',
      'R~~~~~SS..T...........FF.........SSSSSS#',
      'R~~~~~SS.JJJJ.......TT.......F...SSSSSS>',
      'R~~~~~SS.JJJJ.......T....B.......SSSSSS>',
      'R~~~~~SS.JJJJ....................SSS4SS#',
      'R~~~~~SS.JjJJ.........FF.........SSSSSS#',
      '<=====SS..=......................SSSSSS#',
      'R~~~~~2S..=....TT..........SSSSSS~~~~~~#',
      'R~~~~~SS..========.........SS~~~~~~SSS~#',
      'R~~~~~SS.5.....F.....TT....S~~~~~~~SoS~#',
      'R~~~~~SS...................SS~~~~~~SSS~#',
      '########################################',
    ],
    npc: {
      1: { role: 'talk', name: 'Zookeeper Tom', look: 'ranger', g: 'm', face: 'right', say: [['Pandas eat bamboo every day.', '熊猫每天都吃竹子。'], ['They eat for twelve hours a day!', '它们一天要吃十二个小时！']], speak: 'Pandas eat bamboo.' },
      2: { role: 'talk', name: 'Fisher Bob', look: 'fisher', g: 'm', face: 'left', say: [['Look at the sea! Sometimes I see dolphins.', '看那片海！有时候能看到海豚。'], ['Dolphins can swim very fast.', '海豚能游得非常快。']], speak: 'Dolphins can swim very fast.' },
      3: { role: 'talk', name: 'Little Amy', look: 'kidF', g: 'f', face: 'down', say: [['I love koalas! Why do I like them?', '我最喜欢考拉！为什么呢？'], ["Because they're very cute!", '因为它们非常可爱！']], speak: "Because they're very cute." },
      4: { role: 'talk', name: 'Explorer Max', look: 'hiker', g: 'm', face: 'left', say: [['Route 9 is east of here. It is on the sea.', '9 号水路在东边，是一条海路。'], ['The Sea Patrol only lets strong trainers pass. You need nine badges.', '海上巡逻员只让厉害的训练师过去，要有 9 枚徽章。']], speak: 'Route 9 is on the sea.' },
      5: { role: 'talk', name: 'Granny Wu', look: 'granny', g: 'f', face: 'up', say: [['Where are lions from?', '狮子来自哪里？'], ["They're from Africa. Lions are strong, but they are also in danger.", '它们来自非洲。狮子很强壮，可它们也有危险。']], speak: "They're from Africa." },
    },
    signs: [
      ['Ranger Station. We help wild animals.', '巡林站：我们帮助野生动物。'],
      ['Welcome to Animal Island! We must save the animals.', '欢迎来到动物岛！我们必须保护动物。'],
      ['Animal Park. Please be kind to the animals.', '动物公园：请善待动物。'],
      ['East: Route 9 (sea road). North: Jungle Path.', '往东：9 号水路（海路）。往北：丛林小径。'],
    ],
    marks: [
      [['A tall totem. There is an elephant, a monkey and a tiger on it.', '一根高高的图腾柱，上面刻着大象、猴子和老虎。']],
      [['A totem with a big giraffe on the top.', '顶上刻着一只大长颈鹿的图腾柱。']],
      [['"Animals are our friends." — Animal Park', '“动物是我们的朋友。”——动物公园']],
    ],
    items: ['superpotion', 'superball', 'revive'],
    hiddenItems: ['leafstone', 'superball'],
    links: { n: ['j8', 'j8'], w: 's7', e: 's8' },
  });

  EM.define('j8', {
    kind: 'route', z: 8, name: '丛林小径', en: 'Jungle Path', sub: '动物岛北边',
    rows: [
      '########################################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRR~~~~~~SSRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRR~~~~~~SoRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRR~~~~~~*SRR#',
      '#RRRRRRRRRRRRRRRRRKRRRRRRRRRRRR~~~~RRRR#',
      '#TTo,,,TTTTTTTTTTT.TTTTTTTTRRRRRwwRRRRR#',
      '#T,,,,,T............T,,,,,TRRRRRwwRRRRR#',
      '#T,,,,,T.TTTTTTTT...T,,,,,TTT~~~~~~~~TT#',
      '#T,,,,,T..*TTTTTT...T,,,,,TTT~~~~~~~~.T#',
      '#T,,,,,T.TTTTTTTTTTTT,,,,,TTT~~~~~~~~.T#',
      '#T,,,,,T.TTTTTTTTTTTT,,,,,TTTTTT~~T,,.T#',
      '#T.......................TTTTTTT~~T,,.T#',
      '#TTTTTTTT,,,,,,TTTLTTTTT.TTTTTTT~~T,o.T#',
      '#TTTTTTTT,,,,*,TTT.TTTTT.TTTTTTT~~T,,.T#',
      '#TTTTTTTT,,,,,,TTT.TTTTT.TTTTTTT~~TT,.T#',
      '#T.......................TTTTTTT~~TT,.T#',
      '#T.TTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~TTT.T#',
      '#T.TTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~TTT.T#',
      '#T....,,,,,,,,,,.....,,,,,,,.,,,~~,,,.T#',
      '#~~~~=~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~#',
      '#~~~~=~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~#',
      '#TTTT.TTTTTTTTTTTTTT~~TTTTTT.TTTTTTTToT#',
      '#T.............TTTTT~~TTTTTT.TTTTTT...T#',
      '#T.TTTTTTTTTT..TTTTT~~T..............TT#',
      '#T.T,,,,,,o,T..T,,,T~~T,,,,,,,,,,,T..TT#',
      '#T.T,,,,,,,,....,,,T~~T,,,,*,,,,,,T..TT#',
      '#T..,,,,,,,,T..T,,,T~~T,,,,,,,,,,,...TT#',
      '#T.T,,,,,,,,T..T,,,T~~T,,,,,,,,,,,T..TT#',
      '#T.TTTTTTTTTT..TTTTT~~TTTTTT.TTTTTT..TT#',
      '#T.TTTTTTTTTT.......==...............TT#',
      '#T.T,,,,,,,,T..T.TTT~~T.TTTTTTTTTTT..TT#',
      '#T.T,,,,,,,,...T*TTT~~T.,,,,,,,,,,T..TT#',
      '#T.T,,,,,,,,T..TTTTT~~T.,,,,,,,,,,T..TT#',
      '#T..,,,,,,,,T..TTTTT~~T.,,,,,,,,,,...TT#',
      '#T.TTTTTTTTTT..TTTTT~~T.,,,,,,,,,,T..TT#',
      '#TLTTTTTTTTTT..TTTTT~~T.TTTTTTTTTTT..TT#',
      '#T.............TTTTT~~T..............TT#',
      '#TTTTTnTTTTTT..TTTTT~~TLLLLLLLTTTTT..TT#',
      '#TTTT...oTTTT..TTTTT~~T.......Tn.oT..TT#',
      '#TTTTTTTTTT....,,,TT~~T,,,,,,,..TTT..TT#',
      '#TTTTTTTTTT,...,,,TT~~T,,,,,,,.TTTT..TT#',
      '#TTTTTTTTTT,,..,,,TT~~T..............TT#',
      '#TTTTTTTTTTTT..TTTTT~~TTTTTTTTTTTTT..TT#',
      '#TTTTTTTTTTTT..TTTTT~~TTTTTTTTTTTTT..TT#',
      '#############vv#####~~#############vv###',
    ],
    people: [
      TR('Ranger Jo', 'ranger', 'm', 'down', 3, ['bug', 'grass'], ['I protect the jungle. Show me your monsters!', '我保护这片丛林。让我看看你的怪兽！'], ["You're strong! Please be kind to the animals.", '你真厉害！请善待动物。'], ['Elephants are smart animals.', '大象是聪明的动物。'], { x: 23, y: 9, under: ',' }),
      TR('Bug Fan Ben', 'kid', 'm', 'right', 3, ['bug'], ['I catch bugs in the jungle every day!', '我每天都在丛林里抓虫子！'], ['My bugs lost...', '我的虫子输了……'], ['Monkeys like bananas. Bugs like leaves!', '猴子喜欢香蕉，虫子喜欢树叶！'], { x: 4, y: 9, under: ',' }),
      TR('Explorer Lin', 'hiker', 'f', 'down', 2, ['grass', 'ground'], ["Let's see the pandas first... Oh, a battle!", '我们先去看熊猫吧……哦，要对战了！'], ['You are a good explorer!', '你是个好探险家！'], ['Pandas are black and white.', '熊猫是黑白相间的。'], { x: 11, y: 14, under: ',' }),
      TR('Ranger Sue', RANGER.look, 'f', 'right', 3, ['grass', 'flying'], ['Why do you like tigers? Because they are strong. Like me!', '你为什么喜欢老虎？因为它们很强壮。就像我！'], ['Wow, your monsters are strong too!', '哇，你的怪兽也很强壮！'], ['Tigers are from Asia.', '老虎来自亚洲。'], { x: 6, y: 27, under: ',' }),
      TR('Zoo Fan Tim', 'student', 'm', 'down', 3, ['normal', 'flying'], ['Where are koalas from? Answer with a battle!', '考拉来自哪里？用对战回答我！'], ["They're from Australia! I know now.", '它们来自澳大利亚！我知道了。'], ['Koalas sleep in trees.', '考拉睡在树上。'], { x: 28, y: 26, under: ',' }),
      TR('Animal Doctor Kim', 'scientist', 'f', 'up', 3, ['water', 'bug'], ['I help sick animals. My monsters help me!', '我给生病的动物看病，我的怪兽是我的帮手！'], ['Your monsters look very healthy.', '你的怪兽看起来非常健康。'], ['We must save the animals.', '我们必须保护动物。'], { x: 28, y: 34, under: ',' }),
      // 伪装成灌木的嘘声团团员，挡住基地的入口
      { id: 'bush', role: 'story', name: 'A Strange Bush', look: BUSH, g: 'm', x: 18, y: 6, face: 'down', hideIf: 'a8bush' },
    ],
    items: ['superball', 'potion', 'superpotion', 'revive', 'superball', 'thunderstone', 'fullheal'],
    hiddenItems: ['superpotion', 'leafstone', 'superball', 'revive', 'moonstone'],
    links: { s: ['t8', 't8'], K: ['h8a'] },
  });

  EM.define('h8a', {
    kind: 'cave', cave: 'base', z: 8, dungeon: true, lv: 2, name: '嘘声团基地 1F', en: 'Hush Base 1F', sub: '丛林深处',
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'X%____XXXXXXXXXXXXXXXXo_____oX',
      'X_____XXXXXXXXXXXXXXXX___*___X',
      'X_____XXXX______XXXXXX_______X',
      'XXX|XXXXXX__2___XXXXXXXXX|XXXX',
      'X____________________________X',
      'X_XXXXXXX_XXXXXXXX_XXXXXXXXX_X',
      'X_X_____X_X______X_X_______X_X',
      'X_X_ff__X_X_ff___X_X__1____X_X',
      'X_X_____X____________XXXXX_X_X',
      'X_XXXX__XXXXXXXX_XXXXX___X___X',
      'X______3_______X_X_____Z_X_X_X',
      'XXXXXXXX_XXXXX_X_X_XXXXXXX_X_X',
      'X________X___X___X_____4___X_X',
      'X_XXXXXX_X_X_XXXXXXXXXXXXXXX_X',
      'X________X_X________________oX',
      'XXXXXXXXXXXXXXXX_XXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXX___XXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXeXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
    npc: {
      1: TR('Hush Grunt', 'grunt', 'm', 'down', 3, GRUNT_TYPES, ['Shh! Animals are noisy. We put them in cages!', '嘘！动物太吵了，我们把它们关进笼子！'], ['Shh... You win.', '嘘……你赢了。'], ['The boss is upstairs. Shh!', '老大在楼上。嘘！']),
      2: TR('Hush Grunt', 'gruntF', 'f', 'down', 2, GRUNT_TYPES, ['How did you find our base?', '你是怎么找到我们基地的？'], ['Shh... Nobody can pass the locked door anyway!', '嘘……反正没人能通过那扇锁着的门！'], ['Only we know the password. Shh!', '只有我们知道口令。嘘！']),
      3: TR('Hush Grunt', 'grunt', 'm', 'right', 4, GRUNT_TYPES, ['Quiet, kid! Monsters in cages are quiet monsters.', '安静，小孩！关在笼子里的怪兽才安静。'], ['Shh... not so loud!', '嘘……别那么大声！'], ['I forgot the password again...', '我又把口令忘了……']),
      4: TR('Hush Grunt', 'gruntF', 'f', 'left', 4, GRUNT_TYPES, ['The storage room is ours! Go away!', '仓库是我们的！走开！'], ['Shh... there is a red button somewhere...', '嘘……某个地方有个红色按钮……'], ['Don\'t push the red button!', '别按那个红色按钮！']),
    },
    marks: [[['A machine with a big red button.', '一台机器，上面有个大大的红色按钮。']]],
    markKinds: ['statue'],
    items: ['superball', 'revive', 'fullheal'],
    hiddenItems: ['superpotion'],
    links: { e: 'j8', '%': ['h8b'] },
  });

  EM.define('h8b', {
    kind: 'cave', cave: 'base', z: 8, dungeon: true, lv: 2, name: '嘘声团基地 2F', en: 'Hush Base 2F', sub: '丛林深处',
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXffffffffffXXXXXXXXXX',
      'XffffXXXXXf________fXXXXXffffX',
      'Xf__fXXXXXf________fXXXXXf__fX',
      'Xf__|_____ffff||ffff_____|__fX',
      'Xffff____________________ffffX',
      'Xf__|____________________|__fX',
      'Xf__f____________________f__fX',
      'Xffff____________________ffffX',
      'XXXXXXX___XXXXXXXXXX___XXXXXXX',
      'XXXXXXX___XXXXXXXXXX___XXXXXXX',
      'X%_____________2__________o__X',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
    npc: {
      2: TR('Hush Grunt', 'grunt', 'm', 'left', 4, GRUNT_TYPES, ['You got past the password? Impossible!', '你居然过了口令门？不可能！'], ['Shh... Admin Whisper will stop you.', '嘘……低语大人会阻止你的。'], ['Admin Whisper is in the cage room.', '低语大人在关笼子的房间里。']),
    },
    people: [
      { id: 'whisper', role: 'story', name: 'Admin Whisper', look: LK.whisper, g: 'f', x: 13, y: 7, face: 'down', hideIf: 'ch8' },
      { id: 'cage1', role: 'story', mon: 'peeplet', x: 2, y: 3, face: 'right', hideIf: 'ch8' },
      { id: 'cage2', role: 'story', mon: 'mossbear', x: 3, y: 7, face: 'right', hideIf: 'ch8' },
      { id: 'cage3', role: 'story', mon: 'junglefrog', x: 27, y: 3, face: 'left', hideIf: 'ch8' },
      { id: 'cage4', role: 'story', mon: 'nightkit', x: 26, y: 7, face: 'left', hideIf: 'ch8' },
      { id: 'voltlion', role: 'legend', mon: 'voltlion', x: 14, y: 2, face: 'down', hideIf: 'leg:voltlion' },
    ],
    items: ['superball'],
    links: { '%': ['h8a'] },
  });

  EM.define('i8A', {
    kind: 'inside', z: 8, room: 'J', name: '动物岛 · 巡林站', en: 'Ranger Station', sub: '第 9 岛',
    rows: [
      'WWWWWWWWWWWWW',
      'Wkk___t___kkW',
      'W___________W',
      'W_YY_____YY_W',
      'W_YY_____YY_W',
      'Wp_________pW',
      'W___uuuuu___W',
      'W___uuuuu___W',
      'Wp____u____pW',
      'WWWWWWeWWWWWW',
    ],
    people: [
      { id: 'ranger', role: 'story', name: RANGER.name, look: RANGER.look, g: 'f', x: 6, y: 2, face: 'down' },
      { id: 'kai1', role: 'story', name: 'Kai', look: 'kai', g: 'm', x: 2, y: 6, face: 'right', hideIf: 'ch8' },
      { id: 'kai2', role: 'story', name: 'Kai', look: 'kai', g: 'm', x: 2, y: 6, face: 'right', showIf: 'ch8' },
      { id: 'pet1', role: 'story', mon: 'nibbler', x: 9, y: 6, face: 'left', showIf: 'a8find' },
      { id: 'pet2', role: 'story', mon: 'cloudsheep', x: 10, y: 7, face: 'left', showIf: 'a8cloud' },
    ],
    links: { e: 't8' },
  });

  // 道馆：脚印小路。每个路口广播描述一种动物，跟着它的脚印走；走错传送回路口
  const PAW = {
    e: ['🐘', '#d7ccc8', 'elephant', 'It has a long nose and big ears.', '它有长长的鼻子和大大的耳朵。'],
    m: ['🐒', '#ffe0b2', 'monkey', 'It has a long tail. It likes bananas and climbing trees.', '它有长尾巴，喜欢香蕉和爬树。'],
    g: ['🦒', '#fff59d', 'giraffe', 'It has a very long neck. It is very tall.', '它的脖子很长很长，个子非常高。'],
    k: ['🐨', '#cfd8dc', 'koala', "It's from Australia. It sleeps in trees all day.", '它来自澳大利亚，整天在树上睡觉。'],
    t: ['🐯', '#ffcc80', 'tiger', "It's orange with black stripes. It's very strong.", '它是橙色的，有黑色条纹，非常强壮。'],
    p: ['🐼', '#eeeeee', 'panda', "It's black and white. It eats bamboo.", '它是黑白相间的，吃竹子。'],
    z: ['🦓', '#e0e0e0', 'zebra', "It looks like a horse. It's black and white.", '它长得像马，身上黑白相间。'],
    q: ['🐧', '#b3e5fc', 'penguin', "It can't fly, but it can swim. It lives in a cold place.", '它不会飞，但是会游泳，住在寒冷的地方。'],
    l: ['🦁', '#ffe082', 'lion', "It's from Africa. It's the king of animals.", '它来自非洲，是百兽之王。'],
  };
  const PAWS8 = [['e', 'm', 'g'], ['k', 't', 'p'], ['z', 'q', 'l']];   // 三个路口，每个路口三条小路（从左到右）
  const PAW_COL = [3, 7, 11], JUNCTION = [22, 17, 12];   // 每个路口两行高（训练师走过来也挡不住路），罚回下面那一行
  EM.define('i8G', { markKinds: ['statue', 'statue', 'speaker', 'speaker', 'speaker'],
    kind: 'inside', z: 8, room: 'G',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W_____________W',
      'Wp___uuuuu___pW',
      'W____u___u____W',
      'W____uuuuu____W',
      'WWWWWWW|WWWWWWW',
      'W_____________W',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'W____________4W',
      'WZ____________W',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'W____________3W',
      'WZ____________W',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'WWW_WWW_WWW_WWW',
      'W____________2W',
      'WZ____________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    over: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...z...q...l...',
      '...z...q...l...',
      '...z...q...l...',
      '...............',
      '...............',
      '...k...t...p...',
      '...k...t...p...',
      '...k...t...p...',
      '...............',
      '...............',
      '...e...m...g...',
      '...e...m...g...',
      '...e...m...g...',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
    ],
    paint: Object.fromEntries(Object.entries(PAW).map(([k, v]) => [k, { c: v[1], t: v[0] }])),
    npc: {
      1: { role: 'leader' },
      2: TR('Keeper Nia', 'ranger', 'f', 'left', 4, ['water', 'ground'], ['Snap snap! Croc taught me everything.', '咔嚓咔嚓！鳄鱼巡查员教会了我一切。'], ['Your ears are good!', '你的耳朵真灵！'], ['Listen to the speaker. Then follow the paw prints.', '听广播，再跟着脚印走。']),
      3: TR('Keeper Sam', 'ranger', 'm', 'left', 4, ['grass', 'water'], ['What do pandas eat? They eat bamboo!', '熊猫吃什么？它们吃竹子！'], ['You know animals well!', '你很了解动物！'], ['Pandas eat bamboo. Koalas eat leaves.', '熊猫吃竹子，考拉吃树叶。']),
      4: TR('Keeper Joy', 'kidF', 'f', 'left', 4, ['normal', 'water'], ['Are giraffes tall? Yes, they are!', '长颈鹿高吗？是的，很高！'], ['You win! You can go on.', '你赢了！可以往前走了。'], ['The first path is easy. The last one is hard!', '第一段路很简单，最后一段很难！']),
    },
    marks: [[['A crocodile statue. "Snap snap!"', '一座鳄鱼雕像：“咔嚓咔嚓！”']], [['A crocodile statue. "Snap snap!"', '一座鳄鱼雕像：“咔嚓咔嚓！”']], [['A speaker. Press A to hear it again.', '一个广播喇叭。']], [['A speaker.', '一个广播喇叭。']], [['A speaker.', '一个广播喇叭。']]],
    links: { e: 't8' },
  });

  EM.define('s8', {
    kind: 'route', z: 8, sea: true, name: '9 号水路', en: 'Route 9', sub: '动物岛 → 规则城',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR~~RRRRRR~~~~',
      '~~~~~~RSSR~~~~~~~~~~~~~~~~~~RRR~~~RSo~~R~~~~',
      '~~~~~SSoSS~~~~~~~~~~~~~~~~~RRR~~~~RS*~~R~~~~',
      '~~~~~SSSS~~~~~~~~~~~~~~~~~~~~RR~~~RRR~~R~~~~',
      '~~~~~~SS~~~~~~~~~~~~~~1~~~~~~~RRRRRRRwwR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~RRRwwR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~~~~~~~~',
      '~~~~~~2~~~~~~~~~~~~~~~~~~~~~~RRRR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~SSS~~RRRR~~~~~~~~~~~',
      'RSBS~~~~~~~~~~~~~~~~~~~~S3S~RR~~~~~~~~~~SBSR',
      'RSSS~~~~~~~~~~~~~~~~~~~~~~~~RRR~~~~~~~~~SSSR',
      '<SSS~~~~~~~~~~~~~~~~~~~~~~~~RRRRR~~~~~~~SSS>',
      '<SSS~~~~~~~~~~~~~~~~~~~~~~~~~~4~~~~~~~~~SSS>',
      'RSSS~~~~~~~~~~~~~~~~~~~~~~~~RRRRR~~~~~~~SSSR',
      'RSS~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~~~~~SSSR',
      'RS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~~~~SSSR',
      '~~~~~~~~~~~~~~5~~~~~~~~~~~~~~~~RRR~~6~~~~~~~',
      '~~~~~~~~~~~~~~~~RSSSR~~~~~~~~RRRR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~SS*SS~~~~~~~~RR~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SSS~~~~~~~~RR~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRRR~~~RR~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR~~SSo~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRRR~~~~~~~~~~~',
    ],
    npc: {
      1: TR('Swimmer Kate', 'swimmerF', 'f', 'down', 4, ['water'], ['Dolphins can swim very fast. So can I!', '海豚游得很快，我也是！'], ['You swim faster than me!', '你比我游得还快！'], ['I want to swim with dolphins one day.', '有一天我想和海豚一起游泳。'], { under: '~' }),
      2: TR('Swimmer Leo', 'swimmer', 'm', 'right', 4, ['water', 'ice'], ['Penguins can swim, too. Did you know?', '企鹅也会游泳，你知道吗？'], ['Brr... I lost!', '呜……我输了！'], ["Penguins can't fly, but they can swim.", '企鹅不会飞，但是会游泳。'], { under: '~' }),
      3: TR('Fisher Joe', 'fisher', 'm', 'down', 3, ['water'], ['I caught a big fish today! Want to battle?', '我今天钓到一条大鱼！要对战吗？'], ['The big one got away...', '大家伙跑掉了……'], ['Fish live in the sea. Monkeys live in trees.', '鱼住在海里，猴子住在树上。']),
      4: { role: 'guard', badge: 9, name: 'Sea Patrol Sam', look: 'swimmer', g: 'm', face: 'left', under: '~', say: [['Stop! This is the Sea Patrol.', '停一下！这里是海上巡逻队。'], ['The sea to Rule City is dangerous. Only trainers with nine badges can go.', '去规则城的海路很危险，只有 9 枚徽章的训练师才能过去。'], ['Win the badge on Animal Island first!', '先去赢下动物岛的徽章吧！']] },
      5: TR('Swimmer Nora', 'swimmerF', 'f', 'up', 4, ['water', 'flying'], ['Do you like dolphins? I love them!', '你喜欢海豚吗？我超爱它们！'], ["You're a strong swimmer!", '你游泳真厉害！'], ['Dolphins are smart and cute.', '海豚又聪明又可爱。'], { under: '~' }),
      6: TR('Swimmer Owen', 'swimmer', 'm', 'left', 4, ['water', 'spark'], ['Rule City is just ahead. Its rules are strict!', '前面就是规则城，那里的规矩很严！'], ['OK, OK, you can go!', '好啦好啦，你过去吧！'], ["Don't swim too far from the island.", '别游得离岛太远。'], { under: '~' }),
    },
    signs: [
      ['Route 9 (sea). West: Animal Island.', '9 号水路（海上）。往西：动物岛。'],
      ['Route 9 (sea). East: Rule City.', '9 号水路（海上）。往东：规则城。'],
    ],
    items: ['superpotion', 'waterstone', 'revive'],
    hiddenItems: ['fullheal', 'superball'],
    links: { w: 't8', e: 't9' },
  });

  // ---------- 第 8 岛剧情 ----------
  const PARK = [['nibbler', 26, 16], ['mossbear', 31, 19], ['peeplet', 27, 20]];
  const PARK_WRONG = {
    mossbear: ["This monster is big. It has leaves on its back, but it doesn't have a long tail.", '这只怪兽很大，背上长着叶子，可是没有长尾巴。'],
    peeplet: ["This monster is a bird. It has wings, but it doesn't have a long tail.", '这只怪兽是只鸟，有翅膀，可是没有长尾巴。'],
  };
  const LOST = ["It's small and it has a long tail. It has long whiskers, too.", '（仔细听描述！）'];
  function spawnPark(C) { PARK.forEach(([mon, x, y], i) => { if (!C.npc(n => n.id === 'pk' + i)) C.spawn({ id: 'pk' + i, mon, x, y, face: i ? 'left' : 'down' }); }); }

  async function intro8(C) {
    const p = spot(C, [[2, -1], [-2, -1], [1, -2]]);
    const r = C.spawn({ id: 'rosaT', look: RANGER.look, name: RANGER.name, g: 'f', x: p.x, y: p.y, face: faceOf(p, C.pl) });
    await C.alert(r);
    C.faceEach(r);
    await C.talk([
      rosa('Hello! Are you a trainer? I am Rosa, a ranger on Animal Island.', '你好！你是训练师吗？我是罗莎，动物岛的巡林员。'),
      rosa('Team Hush is catching wild monsters and putting them in cages!', '嘘声团在抓野生怪兽，把它们关进笼子！'),
      rosa('Some monsters ran away from them. One of them is hiding in our Animal Park.', '有几只怪兽从他们那里逃了出来，其中一只躲进了我们的动物公园。'),
      rosa('Can you find it for me? Listen carefully.', '你能帮我找到它吗？仔细听。'),
      rosa(LOST[0], '仔细听描述，去公园（东边围着栅栏的地方）里找到对的那只怪兽。'),
      L.speak(C, 'OK! I will find it!', '对罗莎说：好的！我会找到它的！'),
      rosa('Thank you! I will wait at the Ranger Station.', '谢谢你！我在巡林站等你。'),
    ]);
    C.set('a8in');
    C.remove(r);
    spawnPark(C);
  }
  async function parkMon(C, n) {
    const mon = n.mon;
    C.faceEach(n);
    if (mon !== 'nibbler') {
      await C.talk([nar(...PARK_WRONG[mon]), rosa('Listen again: ' + LOST[0], '再听一遍罗莎的描述：它很小，有一条长尾巴，还有长长的胡须。', { who: RANGER.name + ' 📻' })]);
      return;
    }
    await C.talk([
      nar("It's small and it has a long tail. This is the one!", '它很小，有一条长尾巴——就是它！'),
      L.speak(C, "Don't be afraid. Come with me!", '温柔地对它说：别怕，跟我来！'),
      nar('Nibbler squeaks happily and follows you.', '啃啃鼠开心地吱吱叫，跟在你后面。'),
      radio(RANGER.name, 'You found Nibbler! Thank you!', '你找到啃啃鼠了！谢谢你！'),
      radio(RANGER.name, 'The other monsters ran into the jungle, north of town.', '其他怪兽跑进了镇子北边的丛林。'),
      radio(RANGER.name, "Team Hush's base is somewhere in that jungle. Please be careful!", '嘘声团的基地就藏在那片丛林里。千万小心！'),
    ]);
    C.set('a8find');
    ['pk0', 'pk1', 'pk2'].forEach(id => { const q = C.npc(m => m.id === id); if (q) C.remove(q); });
  }
  async function cloudMon(C, n) {
    C.faceEach(n);
    await C.talk([nar('A monster is shaking in the grass. It looks scared.', '一只怪兽在草丛里发抖，看起来很害怕。')]);
    const ok = await quiz(C, (en, zh, x) => radio(RANGER.name, en, zh, x), 'Did you find another monster? What does it look like?', '罗莎在对讲机里问你：它长什么样？看一看，选出正确的描述，再说出来。',
      "It's white and fluffy, like a cloud.", ["It's small and it has a long tail.", "It's orange with black stripes."]);
    if (!ok) { await C.talk([radio(RANGER.name, 'Hmm... Look at it again, please.', '嗯……请再仔细看看它。')]); return; }
    await C.talk([
      radio(RANGER.name, "White and fluffy... That's Cloudsheep! Thank you, {name}!", '白白的、毛茸茸的……是云朵羊！谢谢你，{name}！'),
      nar('Cloudsheep says "Baa!" and looks at a strange bush near the rocks.', '云朵羊“咩”了一声，一直盯着岩壁旁边一丛奇怪的灌木。'),
      radio(RANGER.name, 'A strange bush? Maybe Team Hush is hiding there!', '奇怪的灌木？说不定嘘声团就躲在那里！'),
      nar('Cloudsheep runs back to the Ranger Station.', '云朵羊跑回巡林站去了。'),
    ]);
    C.set('a8cloud');
    await C.walk(n, 'down', 2, 140);
    C.remove(n);
  }
  async function bushTalk(C, n) {
    if (!C.flag('a8cloud')) { await C.talk([nar("It's just a bush... Did it move?", '只是一丛灌木……它是不是动了一下？')]); return; }
    C.faceEach(n);
    await C.talk([
      nar('The bush is shaking!', '灌木在发抖！'),
      L.speak(C, 'Who are you? Come out!', '大声说：你是谁？出来！'),
      { who: 'A Strange Bush', look: BUSH, g: 'm', en: "Shh! I'm a bush! Bushes can't talk!", zh: '嘘！我是一丛灌木！灌木不会说话！' },
    ]);
    const res = await L.hushFight(C, n, 'grunt', { types: ['poison', 'grass'], lines: [["Oh no, you found me! I'm a Hush Grunt. Our base is right here!", '糟了，被你发现了！我是嘘声团团员，我们的基地就在这里！']] });
    if (res !== 'win') return;
    C.set('a8bush');
    await C.talk([nar('The grunt ran into the base. There is a cave door behind the bush!', '团员逃进了基地。灌木后面有一扇洞门！')]);
  }
  // 基地 1F：两个团员在锁着的楼梯间里说口令，被你听到了
  async function overhear(C) {
    C.set('a8over');
    const a = C.spawn({ id: 'gA', look: LK.grunt, name: 'Hush Grunt', g: 'm', x: 2, y: 2, face: 'right' });
    const b = C.spawn({ id: 'gB', look: LK.gruntF, name: 'Hush Grunt', g: 'f', x: 4, y: 2, face: 'left' });
    const A = L.sayer('Hush Grunt', 'grunt', 'm'), B = L.sayer('Hush Grunt', 'gruntF', 'f');
    await C.talk([
      nar('You hear two voices behind the locked door...', '锁着的门后面传来两个人说话的声音……'),
      A("Hey, what's the password for this door again?", '喂，这扇门的口令是什么来着？'),
      B('Shh! Not so loud! The password is...', '嘘！小声点！口令是……'),
      B('Pandas eat bamboo.', '（仔细听！她说的口令是什么？）', { hideEn: true }),
      A('Pandas eat bamboo. OK, I will remember it!', '熊猫吃竹子。好，我记住了！'),
    ]);
    await Promise.all([C.walk(a, 'up', 1, 200), C.walk(b, 'up', 1, 200)]);
    C.remove(a); C.remove(b);
    C.note('🔒 口令门：走到门前按 A，说出口令');
  }
  async function passwordGate(C) {
    const door = (en, zh, x) => Object.assign({ who: '口令门', emo: '🔒', en, zh }, x || {});
    const ok = await quiz(C, door, 'Password, please!', '门在问口令。选出你听到的那句话，再大声说出来。', 'Pandas eat bamboo.', ['Pandas are black and white.', 'Koalas eat leaves.']);
    if (!ok) { await C.talk([door('Wrong password! Beep beep!', '口令不对！哔哔！')]); return; }
    C.openGate(0, true);
    C.set('a8pw');
    C.note(null);
    await C.talk([door('Password OK. The door is open.', '口令正确，门开了。')]);
  }
  async function redButton(C) {
    if (C.gateOpen(1)) { await C.talk([nar('The button is already pushed.', '按钮已经按下去了。')]); return; }
    let push = false;
    await C.talk([nar('A machine with a big red button. Push it?', '一台机器，上面有个大大的红色按钮。要按吗？', { kind: 'choice', opts: [{ html: '🔴 按下去 Push it!', cls: 'sun' }, { html: '先不 Not now' }], pick: i => { push = !i; return []; } })]);
    if (!push) return;
    C.openGate(1, true);
    await C.talk([nar('Click! The door of the storage room opened.', '咔嗒！仓库的门打开了。')]);
  }
  async function whisperFight(C, n) {
    const W = L.sayer('Admin Whisper', 'whisper', 'f');
    C.faceEach(n);
    await C.talk([
      W('Shh... Who let you in, little trainer?', '嘘……谁让你进来的，小训练师？'),
      W('These monsters are ours now. Nobody can hear them in here.', '这些怪兽现在是我们的了。在这里，没人听得见它们的叫声。'),
      L.speak(C, 'Let the animals go!', '大声说：放了这些动物！'),
    ]);
    const res = await L.hushFight(C, n, 'whisper', { types: ['poison', 'dark', 'bug'], lines: [['Shh... Then show me how strong your voice is.', '嘘……那就让我看看你的声音有多强。']], win: ['My cages... Fine. Take your little friends.', '我的笼子……算了，把你的小朋友们带走吧。'] });
    if (res !== 'win') return;
    await C.walk(n, 'down', 3, 180);
    C.remove(n);
    C.openGate('all', true);
    await C.talk([nar('Click, click, click! All the cages are open!', '咔嗒、咔嗒、咔嗒！所有的笼子都打开了！')]);
    ['cage1', 'cage2', 'cage3', 'cage4'].forEach(id => { const m = C.npc(q => q.id === id); if (m) { m.face = 'down'; } });
    await C.talk([L.speak(C, 'You are free now! Go home!', '对怪兽们说：你们自由了！回家吧！')]);
    ['cage1', 'cage2', 'cage3', 'cage4'].forEach(id => { const m = C.npc(q => q.id === id); if (m) C.remove(m); });
    await L.restoreCrystal(C, 8);
    await C.talk([
      nar('The big cage is open, too. Voltlion is looking at you!', '最大的笼子也打开了。雷狮正盯着你！'),
      nar('Kai is waiting for you at the Ranger Station.', '小凯在巡林站等你。'),
    ]);
  }
  async function rangerTalk(C, n) {
    C.faceEach(n);
    if (!C.flag('a8find')) await C.talk([rosa('Please find the lost monster in the Animal Park.', '请去动物公园找到走丢的那只怪兽。'), rosa(LOST[0], '再听一遍描述。')]);
    else if (!C.flag('ch8')) await C.talk([rosa("Team Hush's base is deep in the jungle, north of town.", '嘘声团的基地在镇子北边的丛林深处。'), rosa('Please be careful. The animals need you!', '千万小心，动物们需要你！')]);
    else await C.talk([rosa('Thank you, {name}! All the monsters are free now.', '谢谢你，{name}！所有的怪兽都自由了。'), rosa('We must save the animals. Can you say it with me?', '我们必须保护动物。你能和我一起说吗？'), L.speak(C, 'We must save the animals.', '一起说：我们必须保护动物。')]);
  }
  async function kaiTalk(C, n) {
    C.faceEach(n);
    if (n.id === 'kai1') {
      await C.talk([
        kai('H-hi, {name}... It\'s me, Kai.', '你、你好，{name}……是我，小凯。'),
        kai("I'm helping Rosa look after the monsters here.", '我在这里帮罗莎照顾怪兽。'),
        kai('My bird monster is learning to fly. We practice every day!', '我的鸟怪兽在学飞，我们每天都在练习！'),
        kai('Please save the monsters in the jungle. I believe in you!', '请你去救丛林里的怪兽吧，我相信你！'),
      ]);
      return;
    }
    if (C.flag('got_fly')) { await C.talk([kai("I'm training every day. One day, I want to battle you!", '我每天都在训练。总有一天，我要和你对战！')]); return; }
    await C.talk([
      kai('{name}! You did it! The monsters are free!', '{name}！你做到了！怪兽们都自由了！'),
      kai('Look! My bird monster can fly now. It flew all the way here!', '你看！我的鸟怪兽会飞了，它一路飞到了这里！'),
      kai('I want you to have this. It is the Fly HM.', '这个送给你，是「飞空」的秘传学习器。', { onShow: () => { C.give('hm_fly', 1); C.set('got_fly'); } }),
      kai('With nine badges, a flying monster can fly you to any town you visited.', '有了 9 枚徽章，会飞的怪兽就能带你飞到去过的任何一个镇子。'),
      L.speak(C, "Thank you, Kai! You're a great friend.", '对小凯说：谢谢你，小凯！你是我的好朋友。'),
      kai("Hee hee... I'll get stronger, too. See you, {name}!", '嘿嘿……我也会变得更强的。再见，{name}！'),
    ]);
  }

  // 道馆：脚印小路
  const G8 = { ans: [0, 0, 0], said: [false, false, false] };
  DBG.g8 = () => ({ ans: G8.ans.map((a, k) => PAWS8[k][a]), cols: PAW_COL, said: G8.said.slice() });
  function g8Reset() { G8.ans = PAWS8.map(() => Math.floor(Math.random() * 3)); G8.said = [false, false, false]; }
  async function g8Say(C, k) {
    G8.said[k] = true;
    const a = PAW[PAWS8[k][G8.ans[k]]];
    C.note('🐾 第 ' + (k + 1) + ' / 3 个路口：听广播，跟着对的脚印走');
    await C.talk([
      { who: '📢 广播', emo: '📢', en: k ? 'Next path! Listen again.' : 'Welcome to the Paw Print Path!', zh: k ? '下一个路口！再仔细听。' : '欢迎来到脚印小路！' },
      { who: '📢 广播', emo: '📢', en: a[3], zh: '仔细听：说的是哪种动物？跟着它的脚印走！（点右上角的喇叭可以再听一遍，也可以对着喇叭按 A）', hideEn: true },
    ]);
  }
  async function g8Wrong(C, k, ch) {
    const a = PAW[PAWS8[k][G8.ans[k]]], w = PAW[ch];
    C.E.SFX.bad && C.E.SFX.bad();
    await C.talk([nar('Oops! These are ' + w[2] + ' prints. Back to the start!', '哎呀！这是' + w[0] + '的脚印，走错了。回到路口重新来！')]);
    C.teleport(7, JUNCTION[k], 'up');
    await C.talk([{ who: '📢 广播', emo: '📢', en: a[3], zh: '再听一遍，跟着对的脚印走！', hideEn: true }]);
  }
  function g8Step(C) {
    if (C.gateOpen(0)) return null;
    const { x, y } = C.pl, ch = C.over(x, y);
    if ((y === 21 || y === 22) && !G8.said[0]) return () => g8Say(C, 0);
    if (PAW[ch]) {
      const k = y >= 18 ? 0 : y >= 13 ? 1 : 2;
      if (PAWS8[k][G8.ans[k]] !== ch) return () => g8Wrong(C, k, ch);
      return null;
    }
    if ((y === 16 || y === 17) && G8.said[0] && !G8.said[1]) return () => g8Say(C, 1);
    if ((y === 11 || y === 12) && G8.said[1] && !G8.said[2]) return () => g8Say(C, 2);
    if (y === 7) return async () => { C.openGate(0, true); C.note(null); C.E.SFX.win(); await C.talk([nar('You followed all the right paw prints! The gate to Croc is open.', '三段脚印都走对了！通往鳄鱼巡查员的门打开了。')]); };
    return null;
  }
  async function g8Speaker(C, f) {
    const k = f.y === 22 ? 0 : f.y === 17 ? 1 : f.y === 12 ? 2 : -1;
    if (k < 0) return false;
    if (C.gateOpen(0)) { await C.talk([nar('The speaker is quiet now.', '广播已经安静了。')]); return true; }
    await C.talk([{ who: '📢 广播', emo: '📢', en: PAW[PAWS8[k][G8.ans[k]]][3], zh: '再听一遍：说的是哪种动物？', hideEn: true }]);
    return true;
  }

  ST.isle(8, {
    busy: ['Some wild monsters are still in cages! I cannot battle now.', '还有野生怪兽被关在笼子里！我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't8') {
        if (!C.flag('a8in') && !C.E.S.mon.badges[8]) return () => intro8(C);
        if (C.flag('a8in') && !C.flag('a8find') && !C.npc(n => n.id === 'pk0')) return () => spawnPark(C);
      }
      if (id === 'j8' && C.flag('a8find') && !C.flag('a8cloud') && !C.npc(n => n.id === 'cloud')) return () => { C.spawn({ id: 'cloud', mon: 'cloudsheep', x: 25, y: 7, face: 'down' }); };
      if (id === 'h8a' && !C.gateOpen(0)) return () => { C.note(C.flag('a8over') ? '🔒 口令门：走到门前按 A，说出口令' : null); };
      if (id === 'i8G') { g8Reset(); if (!C.gateOpen(0)) return () => { C.note('🐾 往前走，听广播'); }; }
      return null;
    },
    step(C) {
      const id = C.map.id;
      if (id === 'i8G') return g8Step(C);
      if (id === 'h8a' && !C.flag('a8over') && !C.gateOpen(0) && C.pl.y === 5 && C.pl.x <= 8) return () => overhear(C);
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't8' && /^pk\d$/.test(n.id)) return () => parkMon(C, n);
      if (id === 'j8' && n.id === 'cloud') return () => cloudMon(C, n);
      if (id === 'j8' && n.id === 'bush') return () => bushTalk(C, n);
      if (id === 'h8b' && n.id === 'whisper') return () => whisperFight(C, n);
      if (id === 'h8b' && /^cage/.test(n.id)) return () => C.talk([nar('The monster is scared in the cage. You need the key...', '怪兽在笼子里瑟瑟发抖。要找到开笼子的办法……')]);
      if (id === 'i8A' && n.id === 'ranger') return () => rangerTalk(C, n);
      if (id === 'i8A' && /^kai/.test(n.id)) return () => kaiTalk(C, n);
      if (id === 'i8A' && /^pet/.test(n.id)) return () => C.talk([nar(n.mon === 'nibbler' ? 'Nibbler squeaks happily. "Squeak!"' : 'Cloudsheep is sleeping. "Baa... zzz..."', n.mon === 'nibbler' ? '啃啃鼠开心地吱吱叫。' : '云朵羊睡着了。“咩……呼……”')]);
      return null;
    },
    tile(C, f) {
      const id = C.map.id;
      if (id === 'h8a' && f.gate && f.x === 3) return () => passwordGate(C);
      if (id === 'h8a' && f.gate) return () => C.talk([nar('The storage room is locked. Maybe there is a switch somewhere.', '仓库锁着。也许哪里有个开关。')]);
      if (id === 'h8a' && f.statue) return () => redButton(C);
      if (id === 'i8G' && f.statue && f.x === 1 && f.y > 1) return async () => { await g8Speaker(C, f); };
      return null;
    },
  });

  // =====================================================================
  // 第 9 岛 规则城 · No Rules, No Order
  // 警察局请你当一天小交警：提醒三个不守规矩的人（说英语）→ 听线索找出乔装的团员 → 夺回规则水晶
  // → 海边的导师欧瑞送潜水，告诉你运动美食岛只能从海底过去
  // =====================================================================
  const OFFICER = { name: 'Officer Lee', look: 'police', g: 'm' };
  const lee = L.sayer('Officer Lee', 'police', 'm');
  const orion = L.sayer('Orion', 'orion', 'm');
  // 乔装的团员：红帽子 + 眼镜 + 包；另外三个人各差一样
  const SUSPECTS = [
    { name: 'Tourist', look: { skin: '#f1d0b8', hair: '#4a4a55', style: 'short', eye: '#3a3a4a', hat: 'cap', hatC: '#e53935', hatLogo: '#ffffff', shirt: '#90caf9', bottom: '#455a64', shoes: '#22252c', bag: '#795548' }, x: 20, y: 23, spy: false, miss: ["He doesn't have glasses.", '他没戴眼镜。'] },
    { name: 'Tourist', look: { skin: '#ffdcc2', hair: '#3e2723', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#1e88e5', hatLogo: '#ffffff', shirt: '#fff59d', bottom: '#5d4037', glasses: true, bag: '#8d6e63' }, x: 16, y: 19, spy: false, miss: ['His cap is blue, not red.', '他的帽子是蓝色的，不是红色的。'] },
    { name: 'Tourist', look: { skin: '#f6d5c0', hair: '#5a4a6a', style: 'short', eye: '#3a3a4a', hat: 'cap', hatC: '#e53935', hatLogo: '#ffffff', shirt: '#a5d6a7', bottom: '#37474f', glasses: true, shoes: '#22252c', bag: '#6d4c41' }, x: 16, y: 23, spy: true },
    { name: 'Tourist', look: { skin: '#e8b88f', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#e53935', hatLogo: '#ffffff', shirt: '#ffcc80', bottom: '#263238', glasses: true }, x: 20, y: 19, spy: false, miss: ["He doesn't have a bag.", '他没有背包。'] },
  ];
  const CLUES = 'He is wearing a red cap. He has glasses. He has a bag on his back.';
  // 不守规矩的人：跑着横穿马路、乱扔垃圾、红灯看手机过马路
  const BREAKERS = [
    { id: 'rb1', flag: 'a9r1', name: 'Running Rick', look: 'kid', g: 'm', x: 9, y: 15, face: 'right' },
    { id: 'rb2', flag: 'a9r2', name: 'Messy Mia', look: 'studentF', g: 'f', x: 20, y: 26, face: 'down' },
    { id: 'rb3', flag: 'a9r3', name: 'Busy Ben', look: 'student', g: 'm', x: 13, y: 21, face: 'left' },
  ];

  EM.define('t9', {
    kind: 'town', z: 9, name: '规则城', en: 'Rule City', sub: '第 10 岛',
    rows: [
      '###############################~~~~~~~~~',
      '~~~TT..F.TTT...o..TT.F...TT..FTS~~~~~~~~',
      '~~~..F....T.....F........F.....S~~~~~~~~',
      '~~~============================S~~~~~~~~',
      '~~~============================S~~~~~~~~',
      '~~~==SSSSSSSS==SSSSSSSS==SSSSSSS~~~~~~~~',
      '~~~==SAAAAAAS==SGGGGGGS==SEEEESSSS~~~~~~',
      '~~~==SAAAAAAS==SGGGGGGS==SEEEESSSZ~~~~~~',
      '~~~==SAAAAAAS==SGGGGGGS==SEEEESSSS~~~~~~',
      '~~~==SAAAAAAS==SGGGGGGS==SEEEESSSS~~~~~~',
      '~~~==SAAaAAAS==SGGGGGGS==SEEEESSS~~~~~~~',
      '~~~==SSSSSSSS==SGGgGGGS==SSSSSSS~~~~~~~~',
      '~~~==S1TF.TFS==SSSSSSSS==S2TT.SS~~~~~~~~',
      '~~~==S.TF.TFS==SB....FS==S.TT.SS~~~~~~~~',
      'RSB==SSSSSSSS==SSSSSSSZ==SSSSSSS~~~~~~~~',
      '<SS============================S~~~~~~~~',
      '<SS============================S~~~~~~~~',
      'RSS==SSSSSSSZ==SSSSSSSS==SSSSSSS~~~~~~~~',
      '~~~==CCCCMMMM==S.T..T.S==SHHHHSS~~~~~~~~',
      '~~~==CCCCMMMM==S......S==SHHHHSS~~~~~~~~',
      '~~~==CCCCMMMM==SF....FS==SHHHHSS=======>',
      '~~~==CcCCMmMM==S..Z...S==SHhHHSS=======>',
      '~~~==SSSSSSSS==SF....FS==SSSSSSS~~~~~~~~',
      '~~~==S.F..T.S==S......S==S.*..SS~~~~~~~~',
      '~~~==S.F..T.S==S.T..T.S==SB..4SS~~~~~~~~',
      '~~~==SSSSSSSS==SSSSSSSS==SSSSSSS~~~~~~~~',
      '~~~============================S~~~~~~~~',
      '~~~============================S~~~~~~~~',
      '~~~==SSSSSSSS==SSSSSSSS==SSSSSSS~~~~~~~~',
      '~~~==SHHHHT.S==SJJJJ.oS==SEEEESS~~~~~~~~',
      '~~~==SHHHHT.S==SJJJJ..S==SEEEESS~~~~~~~~',
      '~~~==SHhHHT.S==SJjJJ..S==SEEEESS~~~~~~~~',
      '~~~==S....3.S==S......S==SSSSSSS~~~~~~~~',
      '###############################~~~~~~~~~',
    ],
    over: [
      '........................................',
      '........................................',
      '........................................',
      '..................zz....................',
      '..................zz....................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '...zz...................................',
      '...zz...................................',
      '........................................',
      '.......................zz...............',
      '.......................zz...............',
      '........................................',
      '..................zz....................',
      '..................zz....................',
      '........................................',
      '........................................',
      '........................................',
      '.............zz.........................',
      '.............zz.........................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '.......zz.........zz....................',
      '.......zz.........zz....................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
    ],
    paint: { z: '#fafafa' },
    npc: {
      1: { role: 'talk', name: 'Officer Kim', look: 'police', g: 'f', face: 'down', say: [['Welcome to Rule City. No rules, no order!', '欢迎来到规则城。没有规矩，不成方圆！'], ['Walk on the zebra crossing. Wait for the green light.', '走斑马线，等绿灯。']], speak: 'No rules, no order.' },
      2: { role: 'talk', name: 'Mr. Grey', look: 'grandpa', g: 'm', face: 'down', say: [['In our city, we must keep quiet in the library.', '在我们城里，图书馆里必须保持安静。'], ['And we can\'t eat in the classroom!', '而且不能在教室里吃东西！']], speak: 'Keep quiet in the library.' },
      3: { role: 'talk', name: 'Student Lily', look: 'studentF', g: 'f', face: 'up', say: [['We must wear a uniform at school.', '我们上学必须穿校服。'], ["Don't be late for class!", '上课不要迟到！']], speak: 'We must wear a uniform.' },
      4: { role: 'talk', name: 'Mrs. Park', look: 'mom', g: 'f', face: 'left', say: [['Do you have to clean your room at home?', '你在家要打扫房间吗？'], ['I have to wash the dishes every day.', '我每天都要洗碗。']], speak: 'I have to wash the dishes.' },
    },
    people: [
      { id: 'orion1', role: 'story', name: 'Orion', look: 'orion', g: 'm', x: 32, y: 9, face: 'up', hideIf: 'ch9' },
      { id: 'orion2', role: 'story', name: 'Orion', look: 'orion', g: 'm', x: 32, y: 9, face: 'up', showIf: 'ch9' },
    ],
    signs: [
      ['Rule City Gym. Leader: Sharky.', '规则城道馆。馆主：鲨鱼纪律官。'],
      ['Welcome to Rule City! Walk on the zebra crossing.', '欢迎来到规则城！过马路请走斑马线。'],
      ["City rules: Don't throw rubbish. Don't run across the road.", '城市守则：不要乱扔垃圾，不要横穿马路。'],
    ],
    marks: [
      [['An old stone. There are ancient letters on it.', '一块古老的石头，上面刻着古代的文字。']],
      [['A traffic light. Red means stop. Green means go.', '红绿灯：红灯停，绿灯行。']],
      [['A traffic light. Red means stop. Green means go.', '红绿灯：红灯停，绿灯行。']],
      [['A fountain. "Keep the city clean."', '一座喷泉。“保持城市清洁。”']],
    ],
    markKinds: ['stone', 'light', 'light', 'fountain'],
    items: ['superball', 'revive'],
    hiddenItems: ['sunstone'],
    doors: { A: 'i9A' },
    links: { w: 's8', e: 's9' },
  });

  EM.define('i9A', {
    kind: 'inside', z: 9, room: 'A', name: '规则城 · 警察局', en: 'Police Station', sub: '第 10 岛',
    rows: [
      'WWWWWWWWWWWWW',
      'Wkkt_____tkkW',
      'W___________W',
      'WQQQQ___QQQQW',
      'W___________W',
      'WY_Y___2_Y_YW',
      'Wp_________pW',
      'W____uuu____W',
      'WWWWWWeWWWWWW',
    ],
    npc: { 2: { role: 'talk', name: 'Officer Jay', look: 'police', g: 'm', face: 'down', say: [['We have to wear our uniforms every day.', '我们每天都必须穿制服。'], ["Don't be late for work, too!", '上班也不能迟到！']], speak: "Don't be late." } },
    people: [{ id: 'officer', role: 'story', name: 'Officer Lee', look: 'police', g: 'm', x: 6, y: 2, face: 'down' }],
    links: { e: 't9' },
  });

  // 道馆：红绿灯。9 秒一轮：绿灯 5 秒、红灯 4 秒（按时间算，和帧率无关）
  const LIGHT_MS = 9000, GREEN_MS = 5000;
  const lightNow = () => { const t = Date.now() % LIGHT_MS; return t < GREEN_MS ? { green: true, left: Math.ceil((GREEN_MS - t) / 1000) } : { green: false, left: Math.ceil((LIGHT_MS - t) / 1000) }; };
  DBG.light = lightNow;
  EM.define('i9G', {
    kind: 'inside', z: 9, room: 'G',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W_____________W',
      'Wp____u_u____pW',
      'WWWWWWW|WWWWWWW',
      'W_B___________W',
      'W_____________W',
      'W_____________W',
      'W__________2__W',
      'W_____________W',
      'W_____________W',
      'W_B_______3___W',
      'W_____________W',
      'W_____________W',
      'W_B___________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    over: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '.rrrrrzzzrrrrr.',
      '.rrrrrzzzrrrrr.',
      '...............',
      '.rrrrrzzzrrrrr.',
      '.rrrrrzzzrrrrr.',
      '...............',
      '.rrrrrzzzrrrrr.',
      '.rrrrrzzzrrrrr.',
      '...............',
      '...............',
      '...............',
      '...............',
    ],
    paint: { r: '#546e7a', z: '#fafafa' },
    npc: {
      1: { role: 'leader' },
      2: TR('Officer Tina', 'police', 'f', 'left', 3, ['water', 'dark'], ['Stop! You must wait for the green light!', '站住！你必须等绿灯！'], ['OK, you know the rules.', '好吧，你懂规矩。'], ['Red means stop. Green means go.', '红灯停，绿灯行。']),
      3: TR('Cadet Max', 'police', 'm', 'left', 3, ['steel', 'water'], ["Don't run in the hallways! Let's battle!", '不要在走廊里奔跑！来对战吧！'], ['You follow the rules well!', '你很守规矩！'], ['Rules keep us safe.', '规则保护我们的安全。']),
    },
    signs: [
      ["Don't run across the road!", '不要横穿马路！'],
      ['You must wait for the green light.', '你必须等绿灯。'],
      ["Don't walk on the road. Use the zebra crossing.", '不要走在马路上，请走斑马线。'],
    ],
    marks: [[['A shark statue. "Rules first!"', '一座鲨鱼雕像：“规则第一！”']], [['A shark statue. "Rules first!"', '一座鲨鱼雕像：“规则第一！”']]],
    links: { e: 't9' },
  });
  let g9Timer = 0;
  function g9Note(C) {
    const l = lightNow();
    C.note(l.green ? '🚦 <b>🟢 Green light — Walk!</b> 绿灯，可以走斑马线（还剩 ' + l.left + ' 秒）' : '🚦 <b>🔴 Red light — Stop!</b> 红灯，请在人行道上等（' + l.left + ' 秒后变绿）');
  }
  function g9Start(C) {
    clearInterval(g9Timer);
    g9Timer = setInterval(() => {
      if (C.map.id !== 'i9G' || C.gateOpen(0)) { clearInterval(g9Timer); g9Timer = 0; if (C.map.id === 'i9G') C.note(null); return; }
      g9Note(C);
    }, 250);
    g9Note(C);
  }
  // 罚回这一段路的起点
  const G9_START = y => y >= 12 ? [4, 14] : y >= 9 ? [4, 11] : [4, 8];
  async function g9Whistle(C, why) {
    const [x, y] = G9_START(C.pl.y);
    C.E.SFX.bad && C.E.SFX.bad();
    await C.talk([why === 'road'
      ? { who: 'Traffic Officer', emo: '🚨', en: "Tweet! Don't walk on the road! Use the zebra crossing.", zh: '哔——！不要走在马路上！请走斑马线。' }
      : { who: 'Traffic Officer', emo: '🚨', en: 'Tweet! Stop! The light is red. You must wait for the green light.', zh: '哔——！站住！现在是红灯，你必须等绿灯。' }]);
    C.teleport(x, y, 'up');
  }
  function g9Step(C) {
    if (C.gateOpen(0)) return null;
    const { x, y } = C.pl, ch = C.over(x, y);
    if (ch === 'r') return () => g9Whistle(C, 'road');
    if (ch === 'z' && !lightNow().green) return () => g9Whistle(C, 'red');
    if (y === 5) return async () => { C.openGate(0, true); clearInterval(g9Timer); C.note(null); C.E.SFX.win(); await C.talk([nar('You crossed all the roads safely! The gate to Sharky is open.', '你安全地过了所有马路！通往鲨鱼纪律官的门打开了。')]); };
    return null;
  }

  EM.define('s9', {
    kind: 'route', z: 9, sea: true, name: '10 号水路', en: 'Route 10', sub: '规则城 → 海底隧道',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~RSSR~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~SoSS~~~~~~~~~~~~~~1~~~~~~~~~~~RRR',
      '~~~~SS~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~RR~~~~~~~~~~~RRR',
      '~~~~~~~~~~2~~~~~~~~RRRR~~~DDDD~~~RRR',
      '~~~~~~~~~~~~~~~~~~~RRRR~~DDDDDD~~RRR',
      '~~~~~~~~~~~~~~~~~~~~RR~~DDDDDD~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~DDDD~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~SSS~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~SS*SS~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~SSS~~~~~~~~~~~~~~3~~~~~~~~~RRR',
      'RSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      'RSSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '<SSB~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '<SSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      'RSSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      'RSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~4~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~RSSR~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~SoSS~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~SS~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~RR~~~~~~~~~~5~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSS~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~SoS~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~SSS~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RRR',
    ],
    npc: {
      1: TR('Swimmer Amy', 'swimmerF', 'f', 'down', 4, ['water'], ["Don't swim alone! Let's battle together!", '不要一个人游泳！我们一起对战吧！'], ['You are a good swimmer.', '你游得真好。'], ['We must wear a life jacket on a boat.', '坐船时必须穿救生衣。'], { under: '~' }),
      2: TR('Swimmer Dan', 'swimmer', 'm', 'right', 4, ['water', 'poison'], ['The sea is deep here. Be careful!', '这里的海很深，小心！'], ['Glub glub... I lost.', '咕噜咕噜……我输了。'], ['Dark blue water is very deep.', '深蓝色的海水非常深。'], { under: '~' }),
      3: TR('Swimmer Ruby', 'swimmerF', 'f', 'left', 4, ['water', 'ice'], ['Rule number one: have fun!', '第一条规则：玩得开心！'], ['Rule number two: lose with a smile!', '第二条规则：输了也要笑！'], ["Don't forget to warm up before you swim.", '游泳前别忘了热身。'], { under: '~' }),
      4: TR('Swimmer Ivy', 'swimmerF', 'f', 'up', 4, ['water', 'flying'], ['Sports Island is behind the reefs. You can\'t swim there!', '运动美食岛在礁石后面，游不过去的！'], ['Maybe you can go under the sea...', '也许你可以从海底过去……'], ['People say there is a tunnel under the sea.', '听说海底有一条隧道。'], { under: '~' }),
      5: TR('Swimmer Tony', 'swimmer', 'm', 'right', 4, ['water', 'fight'], ['I swim here three times a week!', '我每周来这儿游三次！'], ['I need more practice.', '我还得多练练。'], ['Exercise every day and you will be strong.', '每天锻炼，你就会变强。'], { under: '~' }),
    },
    signs: [['Route 10. Sports Island is behind the reefs. Only divers can get there.', '10 号水路。运动美食岛在礁石后面，只有会潜水的人才能到达。']],
    items: ['superpotion', 'icestone', 'revive'],
    hiddenItems: ['fullheal'],
    links: { w: 't9', D: ['u9'] },
  });

  EM.define('u9', {
    kind: 'under', z: 9, arena: 'under', name: '海底隧道', en: 'Undersea Tunnel', sub: '10 号水路的海底',
    rows: [
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
      'RR....,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
      'RRU...,,,,,,..RRRRRRRRRR...o..RRRRRRRRRR',
      'RR.....,,,,,...RRRRRRRR..,,,,..RRRRRRRRR',
      'RRRR....RR,,,....RRRRR..,,,,,,..RRRRRRRR',
      'RRRRR...RRRR,,,.....1...,,RR,,,...RRRRRR',
      'RRRRRR,,RRRRRR,,,.........RRRR,,,..RRRRR',
      'RRRRR,,,,RRRRRRR,,,,RRRR...RR..,,...RRRR',
      'RRRR,,*,,,RRRRRRRR,,RRRRR.......,,,,.RRR',
      'RRRR,,,,,,,RRRRRRRRRRRRRRR..RR....,,..RR',
      'RRRRR,,,,,,,,RRRRRRRRRRRRRR.RRRR...,..RR',
      'RRRRRRR,,,,,,,,,RRRRRRRRRRR.RRRRRR....RR',
      'RRRRRRRRR,,,,,,,,..RRRRRRR...RRRRRR..RRR',
      'RRRRRRRRRRRR,,,,,,....RRR..,,,RRRRR..RRR',
      'RRRRRRRRRRRRRR,,,,,,......,,,,,RRRR..RRR',
      'RRRRRRRRRRRRRRRR..,,,..2...,,,,.RRR..RRR',
      'RRRRRRRRRRRRRRRRRR........RR,,,..R...RRR',
      'RRRRRRRRRRRRRRRRRRRR...o..RRRR,,.....RRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,...RRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,,..RRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,,..RRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR,.URRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..RRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    npc: {
      1: TR('Diver Sam', 'swimmer', 'm', 'down', 3, ['water'], ['Blub! I found an old road under the sea!', '咕噜！我在海底发现了一条古老的路！'], ['Blub blub... you win.', '咕噜咕噜……你赢了。'], ['The light at the end goes up to Sports Island.', '尽头的光圈可以浮上去，那边就是运动美食岛。']),
      2: TR('Diver Mei', 'swimmerF', 'f', 'left', 3, ['water', 'rock'], ['Shh... the sea is so quiet down here.', '嘘……海底好安静。'], ['Your monsters are strong even under the sea!', '你的怪兽在海底也这么强！'], ['Seaweed is where wild monsters hide.', '野生怪兽喜欢躲在海草里。']),
    },
    items: ['superball', 'waterstone'],
    hiddenItems: ['revive'],
    links: { U: ['s9', 's10'] },
  });

  async function intro9(C) {
    const p = spot(C, [[2, 0], [2, -1], [0, -2]]);
    const o = C.spawn({ id: 'leeT', look: LK.police, name: OFFICER.name, g: 'm', x: p.x, y: p.y, face: faceOf(p, C.pl) });
    await C.alert(o);
    C.faceEach(o);
    await C.talk([
      lee('Hey! You there! Are you a trainer?', '嘿！那边的！你是训练师吗？'),
      lee("I'm Officer Lee. Team Hush is breaking all the rules in our city!", '我是李警官。嘘声团在我们城里乱闯红灯、乱扔垃圾，什么规矩都不守！'),
      lee('Now other people are breaking the rules, too. The Rule Crystal is gone!', '现在别人也跟着不守规矩了——规则水晶不见了！'),
      lee('Can you be a Junior Traffic Officer for one day?', '你能当一天小交警吗？'),
      L.speak(C, 'Yes! I can help!', '回答李警官：好的！我能帮忙！'),
      lee('Great! Here is your whistle. 🎖️', '太好了！这是你的哨子。🎖️', { onShow: () => { C.E.SFX.win(); C.E.toast('🎖️ 你成了小交警！', 'gold'); } }),
      lee('Find three people who are breaking the rules. Tell them the rules in English!', '找到三个不守规矩的人，用英语告诉他们规则！'),
      lee('Look on the roads. Our Police Station is the big building in the north-west.', '去马路上找找。我们的警察局是西北边那栋大楼。'),
    ]);
    C.set('a9in');
    await C.walk(o, 'up', 1, 160);
    C.remove(o);
    spawn9(C);
  }
  function spawn9(C) {
    if (!C.flag('a9in') || C.flag('ch9') || C.E.S.mon.badges[9]) return;
    BREAKERS.forEach(b => { if (!C.flag(b.flag) && !C.npc(n => n.id === b.id)) C.spawn({ id: b.id, look: LK[b.look], name: b.name, g: b.g, x: b.x, y: b.y, face: b.face }); });
    if (C.flag('a9spyq') && !C.flag('a9spy')) SUSPECTS.forEach((s, i) => { if (!C.npc(n => n.id === 'sp' + i)) C.spawn({ id: 'sp' + i, look: s.look, name: s.name, g: 'm', x: s.x, y: s.y, face: faceOf(s, { x: 18, y: 21 }) }); });
  }
  async function breakerTalk(C, n) {
    const b = BREAKERS.find(q => q.id === n.id), S = L.sayer(b.name, b.look, b.g);
    C.faceEach(n);
    if (b.id === 'rb1') {
      await C.talk([
        nar('A boy is running across the road! There are cars coming!', '一个男孩正跑着横穿马路！车子开过来了！'),
        S("Hey! I'm in a hurry! I'm late for school!", '嘿！我赶时间！我上学要迟到了！'),
        L.speak(C, "Don't run across the road!", '吹哨提醒他：不要横穿马路！'),
        S("Oh... you're right. Sorry! I will use the zebra crossing.", '哦……你说得对。对不起！我会走斑马线的。'),
      ]);
    } else if (b.id === 'rb2') {
      await C.talk([S("I finished my juice. I'll just drop the bottle here. It's OK, right?", '我果汁喝完了，瓶子就扔这儿吧。没关系的吧？')]);
      const ok = await quiz(C, S, 'What do you say to her?', '她要乱扔垃圾。选出你该对她说的话，再大声说出来。', "Don't throw rubbish! Put it in the bin.", ['Nice to meet you.', 'Yes, you can.']);
      if (!ok) { await C.talk([nar('Hmm, that is not right. Try again!', '嗯，这样说不对。再试一次！')]); return; }
      await C.talk([S("OK, OK... Sorry! I'll put it in the bin.", '好啦好啦……对不起！我把它扔进垃圾桶。')]);
    } else {
      await C.talk([
        nar('The light is red, but a man is walking and looking at his phone!', '红灯亮着，一个男人却一边看手机一边过马路！'),
        S('La la la... My phone is so interesting...', '啦啦啦……手机真好玩……'),
        L.speak(C, 'You must wait for the green light!', '提醒他：你必须等绿灯！'),
        S("Oh! It's red! You're right. I must wait. Thank you!", '哎呀！是红灯！你说得对，我必须等。谢谢你！'),
      ]);
    }
    C.set(b.flag);
    C.E.SFX.ok && C.E.SFX.ok(2);
    await C.walk(n, n.face === 'up' ? 'down' : 'up', 1, 160);
    C.remove(n);
    const left = BREAKERS.filter(q => !C.flag(q.flag)).length;
    if (left) { await C.talk([radio(OFFICER.name, 'Good job, Junior Officer! ' + left + ' more to go.', '干得好，小交警！还剩 ' + left + ' 个。')]); return; }
    await C.talk([
      radio(OFFICER.name, 'Great job, {name}! Everyone follows the rules again.', '太棒了，{name}！大家又开始守规矩了。'),
      radio(OFFICER.name, 'But wait... A Hush Grunt is hiding near the fountain. He looks like a normal tourist!', '等等……有个嘘声团团员躲在喷泉旁边，他打扮得像个普通游客！'),
      radio(OFFICER.name, 'Listen to the clues. ' + CLUES, '仔细听线索，找出那个人！'),
      radio(OFFICER.name, CLUES, '再听一遍：他戴着什么？有什么？', { hideEn: true }),
    ]);
    C.set('a9spyq');
    spawn9(C);
  }
  async function suspectTalk(C, n) {
    const s = SUSPECTS[+n.id.slice(2)], S = L.sayer(s.name, s.look, 'm');
    C.faceEach(n);
    if (!s.spy) {
      await C.talk([S("Me? I'm just visiting the city!", '我？我只是来城里玩的！'), nar(s.miss[0] + ' Listen to the clues again.', s.miss[1] + '再想想线索：红帽子、眼镜、背包。')]);
      return;
    }
    await C.talk([
      nar('Red cap, glasses and a bag... It\'s him!', '红帽子、眼镜、背包……就是他！'),
      L.speak(C, 'You are a Hush Grunt! Stop!', '大声说：你就是嘘声团团员！站住！'),
      S('Shh! How did you know?!', '嘘！你怎么知道的？！'),
    ]);
    const res = await L.hushFight(C, n, 'grunt', { types: ['dark', 'poison', 'steel'], n: 3, lines: [['Rules are boring! Red lights, green lights... Shh!', '规矩真无聊！红灯、绿灯……嘘！']] });
    if (res !== 'win') return;
    C.set('a9spy');
    ['sp0', 'sp1', 'sp2', 'sp3'].forEach(id => { const q = C.npc(m => m.id === id); if (q) C.remove(q); });
    await L.restoreCrystal(C, 9);
    await C.talk([radio(OFFICER.name, "Thank you, Junior Officer! Oh, a man at the seaside wants to see you. He's reading an old stone.", '谢谢你，小交警！对了，海边有个人想见你，他在研究一块古老的石头。')]);
  }
  async function orionTalk(C, n) {
    C.faceEach(n);
    if (n.id === 'orion1') {
      await C.talk([
        orion('Hello, {name}. Do you remember me? I am Orion.', '你好，{name}。还记得我吗？我是欧瑞。'),
        orion('I am reading the ancient letters on this stone.', '我在研究这块石头上的古代文字。'),
        orion('But the city is too noisy with Team Hush. Please help Officer Lee first.', '可是嘘声团把城里弄得太吵了。请先去帮帮李警官吧。'),
      ]);
      return;
    }
    if (C.flag('got_dive')) { await C.talk([orion('Dark blue water means deep water. Surf on it and press A to dive.', '深蓝色的海水就是深水。冲浪到上面，按 A 就能潜下去。'), orion('The road under the sea goes to Sports Island.', '海底的路通往运动美食岛。')]); return; }
    await C.talk([
      orion('Thank you, {name}. The city has order again. Now I can read the stone.', '谢谢你，{name}。城里又恢复秩序了，我终于能读这块石头了。'),
      orion('It says: "Under the sea there is a road. It goes to the island of sports and food."', '上面写着：“海底有一条路，通往运动与美食之岛。”'),
    ]);
    const ok = await quiz(C, orion, 'Where does the road under the sea go?', '欧瑞问你：海底的路通往哪里？选出正确的回答，再说出来。', 'It goes to Sports Island.', ['It goes to Animal Island.', 'It goes to the Police Station.']);
    if (!ok) { await C.talk([orion('Listen again: the island of sports and food. That is Sports Island!', '再听一遍：运动与美食之岛——就是运动美食岛！')]); }
    await C.talk([
      orion('Yes. Sports Island has reefs all around it. Boats and surfers cannot get there.', '没错。运动美食岛四周都是礁石，船和冲浪都过不去。'),
      orion('You can only go under the sea. Take this. It is the Dive HM.', '只能从海底过去。这个给你，是「潜水」的秘传学习器。', { onShow: () => { C.give('hm_dive', 1); C.set('got_dive'); } }),
      orion('Win the badge here, and your water monster can dive into deep water.', '赢下这里的徽章，你的水系怪兽就能潜进深水。'),
      orion('Find the dark blue water on Route 10, east of the city. Then dive!', '去城东的 10 号水路找深蓝色的水，潜下去！'),
      L.speak(C, 'Thank you, Orion!', '对欧瑞说：谢谢你，欧瑞！'),
    ]);
  }
  async function officerTalk(C, n) {
    C.faceEach(n);
    if (C.flag('ch9')) { await C.talk([lee('Thank you, Junior Officer! Our city has order again.', '谢谢你，小交警！我们的城市又恢复秩序了。'), L.speak(C, 'No rules, no order.', '一起说：没有规矩，不成方圆。')]); return; }
    if (C.flag('a9spyq')) { await C.talk([lee('The spy is near the fountain. Listen: ' + CLUES, '间谍就在喷泉旁边。仔细听线索：'), lee(CLUES, '（他戴着什么？有什么？）', { hideEn: true })]); return; }
    await C.talk([lee('Find the people who are breaking the rules. They are on the roads!', '去找那些不守规矩的人，他们就在马路上！'), lee('Tell them the rules in English. You can do it!', '用英语告诉他们规则。你能行的！')]);
  }

  ST.isle(9, {
    busy: ['Team Hush broke all the rules in my city! I cannot battle now.', '嘘声团把城里的规矩全破坏了！我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't9') {
        if (!C.flag('a9in') && !C.E.S.mon.badges[9]) return () => intro9(C);
        if (C.flag('a9in') && !C.flag('ch9') && !C.E.S.mon.badges[9]) return () => spawn9(C);
      }
      if (id === 'i9G' && !C.gateOpen(0)) return async () => {
        g9Start(C);
        await C.talk([nar('Welcome to the Traffic Gym! Cross three roads to reach Sharky.', '欢迎来到红绿灯道馆！穿过三条马路才能见到鲨鱼纪律官。'), nar('Walk on the zebra crossing, and only when the light is green!', '只能走斑马线，而且只有绿灯才能走！')]);
      };
      return null;
    },
    step(C) { return C.map.id === 'i9G' ? g9Step(C) : null; },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't9' && /^rb\d$/.test(n.id)) return () => breakerTalk(C, n);
      if (id === 't9' && /^sp\d$/.test(n.id)) return () => suspectTalk(C, n);
      if (id === 't9' && /^orion/.test(n.id)) return () => orionTalk(C, n);
      if (id === 'i9A' && n.id === 'officer') return () => officerTalk(C, n);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 't9' && f.statue && f.x === 33) return () => C.talk([nar('An old stone with ancient letters.', '一块刻着古代文字的石头。'), nar(C.flag('got_dive') ? '"Under the sea there is a road."' : 'You cannot read the letters.', C.flag('got_dive') ? '“海底有一条路。”' : '你看不懂上面的字。')]);
      return null;
    },
  });

  // =====================================================================
  // 第 10 岛 运动美食岛 · Keep Fit, Eat Well
  // 一到岛上妈妈打电话 → 对手吃太多零食肚子疼，帮他选健康食物 → 接力赛 + 对战
  // → 嘘声团在集市发垃圾食品，打败两个团员夺回健康水晶；北边冰洞守卫要 11 枚徽章
  // =====================================================================
  const chef = L.sayer('Chef Mei', 'chef', 'f');
  const coach = L.sayer('Coach Tom', 'athlete', 'm');
  EM.define('s10', {
    kind: 'route', z: 10, sea: true, name: '11 号水路', en: 'Route 11', sub: '礁石环绕的海',
    rows: [
      'RRRRRRRRRRRRRR^^RRRRRRRRRRRRRR',
      'RRRRRRRRRRRSSSSSSSSRRRRRRRRRRR',
      'RRRRRRRR~~~~SSBSS~~~~~RRRRRRRR',
      'RRRRRR~~~~~~~SS~~~~~~~~~RRRRRR',
      'RRRR~~~~~~~~~~~~~~~~~~~~~~RRRR',
      'RRR~~~~1~~~~~~~~~~~~~2~~~~~RRR',
      'RR~~~~~~~~~RR~~~~~~~~~~~~~~~RR',
      'RR~~SSS~~~~RR~~~~~~~~~SSS~~~RR',
      'R~~~SoS~~~~~~~~~~~~~~~S*S~~~~R',
      'R~~~SSS~~~~~~~~~~~~~~~SSS~~~~R',
      'R~~~~~~~~~~~3~~~~~~~~~~~~~~~~R',
      'R~~~~~~~~~~~~~~~~~~~~~~~~~~~~R',
      'RR~~~~~~~~~~DDDDDD~~~~~~~~~~RR',
      'RR~~~~~~~~~DDDDDDDD~~~~~~~~~RR',
      'RR~~~~~~~~~DDDDDDDD~~~~4~~~~RR',
      'RRR~~~~~~~~~DDDDDD~~~~~~~~~RRR',
      'RRR~~~RR~~~~~~~~~~~~~RR~~~~RRR',
      'RRR~~~~~~~~~~~~~~~~~~~~~~~~RRR',
      'RR~~~~~~5~~~~~~~~~~~~~~~~~~~RR',
      'RR~~~~~~~~~~~~~~~~~~~~~~~~~~RR',
      'RRRR~~~~RR~~~~~~~~~~~~~~RRRRRR',
      'RRRRR~~~~~~~SSSS~~~~~~~~~RRRRR',
      'RRRRR~~~~~~~SoSS~~~~~~~~~RRRRR',
      'RRRRRR~~~~~~SSS~~~~~~~~~RRRRRR',
      'RRRRRRR~~~~~~~~~~~~~~~~RRRRRRR',
      'RRRRRRRRR~~~~~~~~~~~~RRRRRRRRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    npc: {
      1: TR('Swimmer Zoe', 'swimmerF', 'f', 'down', 4, ['water'], ['I swim every morning. How often do you exercise?', '我每天早上都游泳。你多久锻炼一次？'], ['You must exercise a lot!', '你一定经常锻炼！'], ['I exercise three times a week.', '我每周锻炼三次。'], { under: '~' }),
      2: TR('Swimmer Jack', 'swimmer', 'm', 'left', 4, ['water', 'fight'], ["After this battle, let's have some dumplings!", '打完这场，我们去吃饺子吧！'], ["I'm hungry now...", '我现在饿了……'], ["I'd like some dumplings, please.", '请给我来些饺子。'], { under: '~' }),
      3: TR('Swimmer Rose', 'swimmerF', 'f', 'right', 4, ['water', 'grass'], ['Fruit gives me energy for swimming!', '水果给我游泳的力气！'], ['I need another banana...', '我还需要一根香蕉……'], ['Eat more vegetables and fruit.', '多吃蔬菜和水果。'], { under: '~' }),
      4: TR('Swimmer Hank', 'swimmer', 'm', 'left', 4, ['water', 'ice'], ["Welcome to the reef sea! Sports Island is north.", '欢迎来到礁石海！运动美食岛就在北边。'], ['Good race!', '比得好！'], ['Drink milk every day.', '每天喝牛奶。'], { under: '~' }),
      5: TR('Swimmer Lucy', 'swimmerF', 'f', 'up', 4, ['water', 'spark'], ['Ready, steady, go!', '预备——开始！'], ['You are fast!', '你真快！'], ["Let's play ping-pong on the island later!", '等会儿去岛上打乒乓球吧！'], { under: '~' }),
    },
    signs: [['North: Sports Island. Keep fit, eat well!', '往北：运动美食岛。锻炼身体，好好吃饭！']],
    items: ['superpotion', 'revive'],
    hiddenItems: ['sunstone'],
    links: { n: 't10', D: ['u9'] },
  });

  EM.define('t10', {
    kind: 'town', z: 10, name: '运动美食岛', en: 'Sports Island', sub: '第 11 岛',
    rows: [
      '########################################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#TTTTTTTTRRRRRRRRRRRKRRRRRRRRRRTTTTTTTT#',
      '#TT.o....TTTTTTTTTTR=RTTTTTTTTT...F..TT#',
      '#T.......F.TTTTTTTTR9RTTTTTTTTT.F....oT#',
      '#T.F........FF.....R=R.....F.......F..T#',
      '#.====================================.#',
      '#...B..............................F...#',
      '#............CCCC....==============....#',
      '#..GGGGGGGGG.CCCC...================...#',
      '#..GGGGGGGGG.CCCC..==..............==..#',
      '#..GGGGGGGGG.CCcC..==..FF......FF..==..#',
      '#..GGGGGGGGG.......==..............==2.#',
      '#..GGGGGGGGG.MMMM..==......Z.......==..#',
      '#..GGGGgGGGG.MMMM..==..............==..#',
      '#......=.....MMMM..==..FF......FF..==..#',
      '#......=.....MmMM..==..............==..#',
      '#..B...=.......=....================...#',
      '#......=.......=.....==============....#',
      '#======================================#',
      '#..F....FF.......F.........F.......FF..#',
      '#..HHHH..HHHH..JJJJ..HHHH..EEEE..EEEE..#',
      '#..HHHH..HHHH..JJJJ..HHHH..EEEE..EEEE..#',
      '#..HhHH..HhHH..JjJJ..HhHH..EEEE..EEEE..#',
      '#.====================================.#',
      '#..........1...........................#',
      '#.......B..............................#',
      '#......................................#',
      '#.T.T.T.T.T.T.T.T......................#',
      '#........4.............................#',
      '#.T.T.T.ToT.T.T.T......................#',
      '#.....................FF.........FF....#',
      '#.T.T.T*T.T.T.T.T......................#',
      '#SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS#',
      '#SSSSSSSSSSSSSSSSSSSSSSSS3SSSSSSSSSSSSS#',
      '~~~SSSSSSSSSSSSSSSSSSSSSSSSSSS*SSSSSS~~~',
      '~~~~~~~~SSSSSSSSSSSSSSSSSSSSSSSS~~~~~~~~',
      '~~~~~~~~~~~~~~~SSSSSSSSSS~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~vv~~~~~~~~~~~~~~~~~~~',
    ],
    npc: {
      9: { role: 'guard', badge: 11, name: 'Ranger Frost', look: 'skier', g: 'm', face: 'down', say: [['Stop! The Ice Cave is very cold and slippery.', '站住！冰洞里又冷又滑。'], ['Only trainers with eleven badges can go in.', '只有 11 枚徽章的训练师才能进去。'], ['Win the badge from Coach Seal first!', '先去赢下海狮教练的徽章吧！']] },
      1: { role: 'talk', name: 'Chef Mei', look: 'chef', g: 'f', face: 'down', say: [['What would you like to eat?', '你想吃点什么？'], ["I'd like some beef noodles, please. That's my favourite!", '请给我来些牛肉面——我最喜欢吃！']], speak: "I'd like some beef noodles, please." },
      2: { role: 'talk', name: 'Coach Tom', look: 'athlete', g: 'm', face: 'left', say: [['How often do you exercise?', '你多久锻炼一次？'], ['I exercise every day! Running is good for you.', '我每天都锻炼！跑步对身体好。']], speak: 'I exercise three times a week.' },
      3: { role: 'talk', name: 'Little Sam', look: 'kid', g: 'm', face: 'up', say: [["Let's play basketball after school!", '放学后我们打篮球吧！'], ['Or football! I like all sports.', '或者踢足球！我什么运动都喜欢。']], speak: "Let's play basketball after school." },
      4: { role: 'talk', name: 'Grandpa Joe', look: 'grandpa', g: 'm', face: 'down', say: [['These fruit trees are my friends.', '这些果树是我的朋友。'], ['An apple a day keeps the doctor away!', '一天一苹果，医生远离我！']], speak: 'Eat more vegetables and fruit.' },
    },
    people: [
      { id: 'h10a', role: 'story', name: 'Hush Grunt', look: LK.grunt, g: 'm', x: 28, y: 26, face: 'down', showIf: 'rival4', hideIf: ['ch10', 'a10h1'] },
      { id: 'h10b', role: 'story', name: 'Hush Grunt', look: LK.gruntF, g: 'f', x: 33, y: 26, face: 'down', showIf: 'rival4', hideIf: ['ch10', 'a10h2'] },
      { id: 'lazy1', role: 'story', name: 'Sleepy Tom', look: 'student', g: 'm', x: 22, y: 30, face: 'down', showIf: 'rival4', hideIf: 'ch10' },
      { id: 'lazy2', role: 'story', name: 'Sleepy Ann', look: 'studentF', g: 'f', x: 26, y: 31, face: 'left', showIf: 'rival4', hideIf: 'ch10' },
    ],
    signs: [
      ['Welcome to Sports Island! Keep fit, eat well.', '欢迎来到运动美食岛！锻炼身体，好好吃饭。'],
      ['Sports Island Stadium (Gym). Leader: Coach Seal.', '运动美食岛体育场（道馆）。馆主：海狮教练。'],
      ['Food Festival! Try our dumplings and noodles.', '美食节！快来尝尝饺子和面条。'],
    ],
    marks: [[['The Sports Day trophy. "Healthy body, happy mind!"', '运动会的奖杯：“身体健康，心情快乐！”']]],
    items: ['superpotion', 'revive', 'fullheal'],
    hiddenItems: ['superball', 'icestone'],
    styles: { G: 'stadium' },
    links: { s: 's10', K: ['c10'] },
  });

  // 道馆：冰面滑行 + 健康食物。滑到停下时脚下是健康食物就收集，是垃圾食品就滑回起点；集齐 3 个门开
  const FOOD = { a: ['🍎', 'apple', true], b: ['🥦', 'broccoli', true], c: ['🍌', 'banana', true], x: ['🍟', 'chips', false], y: ['🍩', 'donut', false], z: ['🍭', 'candy', false], h: ['🍔', 'hamburger', false] };
  EM.define('i10G', {
    kind: 'inside', z: 10, room: 'G',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W_____________W',
      'WWWWWWW|WWWWWWW',
      'WIIIIIpIIIIIIIW',
      'WIIIIIIIIIpIIIW',
      'WIpIIIIIIIIIIIW',
      'WIIIIpIIIIIIIpW',
      'WIIIIIIIIIIIIIW',
      'WIIIIIIpIIIIIIW',
      'WpIIIIIIIIIIpIW',
      'WIIIpIIIIIIIIIW',
      'WIIIIIIIIIIIIIW',
      'W2___________3W',
      'W_____________W',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    over: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '.h.......a.....',
      '...b...........',
      '....c..........',
      '.....x.......z.',
      '...............',
      '.......y.......',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
    ],
    paint: Object.fromEntries(Object.entries(FOOD).map(([k, v]) => [k, { c: v[2] ? '#c8e6c9' : '#ffcdd2', t: v[0] }])),
    npc: {
      1: { role: 'leader' },
      2: TR('Athlete Kim', 'athlete', 'f', 'right', 3, ['water', 'ice'], ['Slide, stop, eat healthy food! Easy, right?', '滑、停、吃健康食物！很简单，对吧？'], ['You have good balance!', '你的平衡感真好！'], ['Stop on the apple, not the chips!', '要停在苹果上，别停在薯条上！']),
      3: TR('Athlete Bo', 'athlete', 'm', 'left', 3, ['fight', 'ice'], ['I eat vegetables every day. That is why I am strong!', '我每天都吃蔬菜，所以我这么强壮！'], ['I need more broccoli...', '我得多吃点西兰花……'], ['Hamburgers are not healthy.', '汉堡不健康。']),
    },
    marks: [[['A sea lion statue holding a ball.', '一座顶着球的海狮雕像。']], [['A sea lion statue holding a ball.', '一座顶着球的海狮雕像。']]],
    links: { e: 't10' },
  });
  let g10n = 0;
  DBG.g10 = () => g10n;
  function g10Reset(C) {
    const def = C.map.def;
    def.over.forEach((r, y) => [...r].forEach((c, x) => C.setOver(x, y, c)));
    g10n = 0;
    C.refresh();
  }
  const g10Note = C => C.note('🧊 滑到健康食物上停下来：<b>' + '🍎🥦🍌'.slice(0, 0) + g10n + ' / 3</b>（停在垃圾食品上会滑回起点）');
  function g10Step(C) {
    if (C.gateOpen(0)) return null;
    const { x, y } = C.pl, f = FOOD[C.over(x, y)];
    if (!f) return null;
    if (!f[2]) return async () => {
      C.E.SFX.bad && C.E.SFX.bad();
      await C.talk([nar('Oh no! ' + f[0] + ' ' + f[1][0].toUpperCase() + f[1].slice(1) + ' is junk food! Back to the start!', '哎呀！' + f[0] + ' 是垃圾食品！滑回起点重新来！')]);
      C.teleport(7, 14, 'up');
    };
    return async () => {
      C.setOver(x, y, '.');
      C.refresh();
      g10n++;
      C.E.SFX.coin && C.E.SFX.coin();
      g10Note(C);
      await C.talk([nar('Yummy! ' + f[0] + ' The ' + f[1] + ' is healthy food! (' + g10n + '/3)', '好吃！' + f[0] + ' 是健康食物！（' + g10n + '/3）')]);
      if (g10n >= 3) { C.openGate(0, true); C.note(null); C.E.SFX.win(); await C.talk([nar('You ate three healthy foods! The gate to Coach Seal is open.', '你吃到了三种健康食物！通往海狮教练的门打开了。')]); }
    };
  }

  EM.define('c10', {
    kind: 'cave', cave: 'ice', z: 10, dungeon: true, lv: 2, name: '冰洞', en: 'Ice Cave', sub: '运动美食岛北边',
    rows: [
      'XXXXX^^XXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXX::::::::::XXXXXXXXXXXXX::::::XXXX',
      'XX:::::::::::::XXXXXXXXXX::::::::XXX',
      'XX:::r:::1:::::XXXXXXXXXX::::::::XXX',
      'XX::::::::::o::XXXXXXXXXX:::*::::XXX',
      'XXX:::::::XXXXXXXXXXXXXXXX::::::XXXX',
      'XXXXXXX::XXXXXXXXXXXXXXXXXX:::::XXXX',
      'XXXXXXXX:XXXXXXXXXXXXXXXXXXXX:XXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIrIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIrIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIrIIIIIIIIIIIIXXXXX',
      'XXXXXXIrIIIIIIIIIIIIIIIIIIIIIIrXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIrIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIrIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIIIIIIIIIIIIIXXXXX',
      'XXXXXXIIIIIIIIIIIIIrIIIIIIIIIIIXXXXX',
      'XXXXXXXXXXXXXXXXXX:XXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXX:::::::::::XXXXXXXXXXXX',
      'XXXXXXXXXXXX:::::::::::::XXXXXXXXXXX',
      'XXXXXXXXXXX::::2::::::::::XXXXXXXXXX',
      'XXXXXXXXXXX:::::::::::::o:XXXXXXXXXX',
      'XXXXXXXXXXXX:::::::::::::XXXXXXXXXXX',
      'XXXXXXXXXXXXXXX:::::::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXeXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    ],
    npc: {
      1: TR('Skier Lena', 'skier', 'f', 'down', 3, ['ice'], ['This ice is perfect for skiing!', '这冰面最适合滑雪了！'], ['I slipped...', '我滑倒了……'], ['Think before you slide!', '滑之前先想好路线！']),
      2: TR('Hiker Pete', 'hiker', 'm', 'right', 4, ['ice', 'rock'], ['Brr! It is cold in here. A battle will warm us up!', '呜，这里好冷！打一场就暖和了！'], ['I feel warm now. Thanks!', '现在暖和了，谢谢！'], ['Slide up, then left, then up. That is how I got out!', '往上滑，再往左，再往上——我就是这样出去的！']),
    },
    people: [{ id: 'icegiant', role: 'legend', mon: 'icegiant', x: 29, y: 3, face: 'down', hideIf: 'leg:icegiant' }],
    items: ['icestone', 'superpotion'],
    hiddenItems: ['revive'],
    links: { e: 't10', n: 'r10' },
  });

  EM.define('r10', {
    kind: 'route', z: 10, theme: 'snow', name: '雪原', en: 'Snowfield', sub: '冰洞 → 天气岛',
    rows: [
      '##############^^##############',
      '#TTT,,,,,,....==....,,,,,,TTT#',
      '#TT,,,,,,,....==....,,,,,,,TT#',
      '#T,,,,1,,,....==....,,,,,,,,T#',
      '#T,,,,,,,,....==....,,,2,,,,T#',
      '#TTTTRRRRR....==....RRRRRTTTT#',
      '#T.o.RRRRR.B..==....RRRRR...T#',
      '#T...RRRRR....==....RRRRR.*.T#',
      '#.....IIIIIIIIIIIIIIIIIII....#',
      '#.....IIIIIIIrIIIIIIIIIII....#',
      '#.....IIIIIIIIIIIIIIIIrII....#',
      '#.....IIIIIIIIIIoIIIIIIII....#',
      '#.....IIIIIrIIIIIIIIIIIII....#',
      '#.....IIIIIIIIIIIIIIIIIII....#',
      '#.....IIIIIIIIIIIIIIIIIII....#',
      '#TT........................TT#',
      '#TTTTLLLLLLTTTTTTTTTTTTT...TT#',
      '#T..........................T#',
      '#T,,,,,,,,,TTT==TTT,,,,,,,,,T#',
      '#T,,,,,3,,,TTT==TTT,,,,,,,,,T#',
      '#T,,,,,,,,,TTT==TTT,,,,,4,,,T#',
      '#T,,,,,,,,,...==...,,,,,,,,,T#',
      '#TTTTTTTTT....==....TTTTTTTTT#',
      '#TT,,,,,TT....==....TT,,,,,TT#',
      '#TT,,o,,TT....==....TT,,,,,TT#',
      '#TT,,,,,......==......,,,,,TT#',
      '#TTTTTTTTT....==....TTTTTTTTT#',
      '#T............==............T#',
      '#T.TTTTTTTTTTT==TTTTTTTTTTT.T#',
      '#T.T,,,,,,,,,,==,,,,,,,,,,T.T#',
      '#T.T,,,,,,,,,,==,,,,,,,,,,T.T#',
      '#T.TTTTTTTTTTT==TTTTTTTTTTT.T#',
      '#T............==............T#',
      '##############vv##############',
    ],
    npc: {
      1: TR('Skier Anna', 'skier', 'f', 'right', 4, ['ice'], ['I ski here every weekend!', '我每个周末都来这里滑雪！'], ['You are faster than the wind!', '你比风还快！'], ['Skiing is great exercise.', '滑雪是很好的锻炼。'], { under: ',' }),
      2: TR('Skier Bill', 'skier', 'm', 'down', 3, ['ice', 'normal'], ['Hot soup and dumplings after skiing. Yum!', '滑完雪喝热汤吃饺子，好香！'], ['Time for soup...', '该去喝汤了……'], ['Weather Island is north of here.', '天气岛就在北边。'], { under: ',' }),
      3: TR('Skier Nina', 'skier', 'f', 'right', 4, ['ice', 'flying'], ['Warm up first, then play!', '先热身，再玩！'], ['I should warm up more.', '我应该多热热身。'], ['Always warm up before sports.', '运动前一定要热身。'], { under: ',' }),
      4: TR('Skier Ken', 'skier', 'm', 'left', 4, ['ice', 'fight'], ['Snowballs are my favourite food! Just kidding!', '雪球是我最爱的食物！开玩笑的！'], ['Brr... I lost.', '呜……我输了。'], ["Don't eat snow. Drink warm milk!", '别吃雪，喝热牛奶！'], { under: ',' }),
    },
    signs: [['Snowfield. North: Weather Island. The frozen lake is slippery!', '雪原。往北：天气岛。结冰的湖面很滑！']],
    items: ['superpotion', 'icestone', 'revive'],
    hiddenItems: ['fullheal'],
    links: { s: 'c10', n: 't11' },
  });

  // ---------- 第 10 岛剧情 ----------
  async function momCall(C) {
    await C.talk([{ who: '旁白', emo: '📞', en: 'Ring ring! Mom is calling!', zh: '叮铃铃！妈妈打来电话了！', onShow: () => C.E.SFX.tap && C.E.SFX.tap() }]);
    await C.talk([
      L.mom('Hi, {name}! It\'s Mom. Are you on Sports Island now?', '喂，{name}！是妈妈。你现在到运动美食岛了吗？'),
      L.mom('I heard there is a Sports Day and a Food Festival there!', '听说那里正在开运动会和美食节！'),
    ]);
    const ok = await quiz(C, L.mom, 'What did you eat today?', '妈妈问你今天吃了什么。选出合适的回答，再说出来。', 'I had some fruit and vegetables.', ["I'm fine, thank you.", 'Yes, I did.']);
    await C.talk([
      ok ? L.mom('Good! Fruit and vegetables are healthy.', '真棒！水果和蔬菜都很健康。') : L.mom('Hmm? I asked what you ate! You can say: I had some fruit and vegetables.', '嗯？妈妈问的是你吃了什么！可以说：我吃了一些水果和蔬菜。'),
      L.mom('Eat well and keep fit, OK? And say hi to {rival} for me. Bye!', '好好吃饭，好好锻炼，知道吗？替我向 {rival} 问好。拜拜！'),
    ]);
    C.set('a10mom');
    spawn10(C);
  }
  function spawn10(C) {
    if (C.flag('a10mom') && !C.flag('rival4') && !C.npc(n => n.id === 'rival')) { const R = C.rivalInfo(); C.spawn({ id: 'rival', look: R.look, name: R.name, g: R.g, x: 18, y: 26, face: 'down' }); }
  }
  async function rivalTalk(C, n) {
    const R = C.rivalInfo(), S = L.sayer(R.name, R.look, R.g);
    C.faceEach(n);
    if (!C.flag('a10food')) {
      await C.talk([
        S('Oh, {name}... Ouch... My tummy hurts...', '哦，{name}……哎哟……我肚子好疼……'),
        S('I ate ten hamburgers and five ice creams at the Food Festival...', '我在美食节吃了十个汉堡和五个冰淇淋……'),
        chef('Oh dear! {rival} needs some healthy food. {name}, can you help?', '天哪！{rival} 需要吃点健康的东西。{name}，你能帮帮忙吗？'),
      ]);
      const ok = await quiz(C, S, 'What should I eat?', '{rival} 问你该吃什么。选出健康的建议，再说出来。', 'Some fruit and vegetables.', ['More hamburgers and ice cream.', 'Some chips and cola.']);
      if (!ok) { await C.talk([chef('No, no! Junk food makes it worse. Think again!', '不行不行！垃圾食品只会更难受。再想想！')]); return; }
      await C.talk([
        S('OK... I will eat an apple and some vegetables.', '好吧……我吃个苹果和一些蔬菜。'),
        nar('A little later...', '过了一会儿……'),
        S('Wow! I feel much better now! Thank you, {name}!', '哇！我感觉好多了！谢谢你，{name}！'),
      ]);
      C.set('a10food');
    }
    await C.talk([
      S("Now I'm full of energy! Let's have a relay race on the track!", '现在我浑身是劲！我们去跑道上比接力赛吧！'),
      coach('A race? Great! Go to the start line!', '赛跑？太好了！到起跑线上来！'),
    ]);
    // 接力赛：两个人从跑道北边的直道一起跑
    C.teleport(21, 10, 'right');
    n.x = 21; n.y = 9; n.face = 'right';
    await C.wait(200);
    await C.talk([coach('On your marks... Say the magic words to start!', '各就各位……大声喊口令开始比赛！'), L.speak(C, 'Ready, steady, go!', '大声喊：预备——开始！')]);
    await Promise.all([C.walkPlayer('right', 13), C.walk(n, 'right', 13, 175)]);
    const good = await quiz(C, coach, 'Pass the baton! Answer me first: How often do you exercise?', '交接力棒啦！教练问你多久锻炼一次，选出合适的回答再说出来。', 'I exercise three times a week.', ['For two hours.', 'On the playground.']);
    await C.talk([good ? nar('You passed the baton perfectly! You win the race!', '你完美地交出了接力棒！你赢了这场比赛！', { onShow: () => { C.E.SFX.win(); C.E.confetti(120); } }) : nar('Oops, you dropped the baton! {rival} wins the race.', '哎呀，接力棒掉了！{rival} 赢了这场比赛。'),
      S(good ? 'You are so fast! OK, but a monster battle is different!' : 'I won the race! Now, a monster battle!', good ? '你跑得真快！不过怪兽对战可不一样！' : '我赢了赛跑！现在来一场怪兽对战吧！')]);
    const res = await L.rivalFight(C, 4);
    C.set('rival4');
    await C.talk([
      S(res === 'win' ? 'You beat me again! You really are strong.' : 'That was a great battle!', res === 'win' ? '又输给你了！你真的很强。' : '这场对战真精彩！'),
      S('Oh no, look! Team Hush is at the market! They are giving away free junk food!', '哎呀，你看！嘘声团在集市上免费发垃圾食品！'),
      S('Everyone is eating chips and lying on the grass. Nobody wants to move!', '大家都在吃薯条、躺在草地上，谁都不想动了！'),
      S("I'll tell Coach Seal. Please stop them, {name}!", '我去告诉海狮教练。{name}，快去阻止他们！'),
    ]);
    await C.walk(n, 'down', 2, 150);
    C.remove(n);
  }
  async function hush10(C, n) {
    const g = n.id === 'h10a', S = L.sayer('Hush Grunt', g ? 'grunt' : 'gruntF', g ? 'm' : 'f');
    C.faceEach(n);
    if (g) {
      await C.talk([
        S('Free hamburgers! Free chips! Eat and sleep. Don\'t move!', '免费汉堡！免费薯条！吃完就睡，别动！'),
        L.speak(C, 'Hamburgers are not healthy!', '大声说：汉堡不健康！'),
        S('Who cares? Healthy food is boring! Shh!', '谁在乎？健康食物最无聊了！嘘！'),
      ]);
    } else {
      await C.talk([S('You want the Health Crystal? Then answer me!', '你想要健康水晶？那先回答我！')]);
      const ok = await quiz(C, S, 'Is ice cream healthy?', '她问你冰淇淋健不健康。选出合适的回答，再说出来。', 'No, not really.', ['Yes, please.', "No, I don't."]);
      await C.talk([S(ok ? 'Hmph! You know too much!' : 'Ha! You don\'t even know! Battle!', ok ? '哼！你懂得太多了！' : '哈！你连这都不知道！来对战吧！')]);
    }
    const res = await L.hushFight(C, n, g ? 'grunt' : 'gruntF', { types: ['poison', 'dark', 'normal'], lines: [[g ? 'Eat junk food and stay in bed forever!' : 'Shh... A quiet, lazy island is a happy island!', g ? '吃垃圾食品，永远躺在床上吧！' : '嘘……安静又懒洋洋的岛才快乐！']] });
    if (res !== 'win') return;
    C.set(g ? 'a10h1' : 'a10h2');
    C.remove(n);
    if (!(C.flag('a10h1') && C.flag('a10h2'))) { await C.talk([nar('One more Hush Grunt is at the market!', '集市上还有一个嘘声团团员！')]); return; }
    await L.restoreCrystal(C, 10);
    await C.talk([nar('Everyone stands up and starts to exercise!', '大家都站了起来，开始锻炼身体！')]);
  }
  async function lazyTalk(C, n) {
    C.faceEach(n);
    const S = L.sayer(n.name, n.id === 'lazy1' ? 'student' : 'studentF', n.id === 'lazy1' ? 'm' : 'f');
    await C.talk([S("I don't want to move... Chips are so yummy...", '我不想动……薯条真好吃……'), L.speak(C, 'Eat more vegetables and fruit!', '劝劝他：多吃蔬菜和水果！'), S('Maybe... after I stop those Hush people...', '也许吧……等你赶走那些嘘声团的人……')]);
  }

  ST.isle(10, {
    busy: ['Team Hush is making everyone eat junk food! I cannot battle now.', '嘘声团让大家都去吃垃圾食品！我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't10' && !C.E.S.mon.badges[10]) {
        if (!C.flag('a10mom')) return () => momCall(C);
        if (!C.flag('rival4') && !C.npc(n => n.id === 'rival')) return () => spawn10(C);
      }
      if (id === 'i10G' && !C.gateOpen(0)) return () => { g10Reset(C); g10Note(C); };
      return null;
    },
    step(C) { return C.map.id === 'i10G' ? g10Step(C) : null; },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't10' && n.id === 'rival') return () => rivalTalk(C, n);
      if (id === 't10' && /^h10/.test(n.id)) return () => hush10(C, n);
      if (id === 't10' && /^lazy/.test(n.id)) return () => lazyTalk(C, n);
      return null;
    },
  });
})();
