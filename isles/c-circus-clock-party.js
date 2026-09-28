// 回声岛 · 第 5–7 社团岛、作息岛、生日派对岛（地图、剧情、道馆机关）。写法见 ISLES.md
// 地图：t5 社团岛 → r5 沙丘道（怪力大石头）→ t6 作息岛 → d6a 钟山 1F → d6b 钟山山顶（7 枚徽章的守卫）→ r6 7 号路 → t7 生日派对岛 → s7 8 号水路（冲浪）→ t8
//       s7 的深水 → u7 海底花园（潜水，可选）
// 剧情：第 5 岛才艺表演（集社团贴纸、清唱）/ 第 6 岛钟楼停了（问起床时间、拨钟）+ 钟山山顶闷雷、炎狮 / 第 7 岛对手的生日派对（生日日历、闷雷抢蛋糕、对手第 3 战、爸爸送冲浪）
// 道馆：i5G 音符地板 / i6G 时钟转门 / i7G 礼物盒
(function () {
  'use strict';
  const EM = window.EchoMaps, ST = window.EchoStory, L = ST.lib, P = window.EchoPeople, LK = P.LOOKS;
  const S = L.sayer;
  const nar = (en, zh, emo) => ({ who: '旁白', emo: emo || '📣', en, zh });
  // 广播：只听不看英文
  const radio = (en, zh) => ({ who: '广播', emo: '📢', en, zh: zh || '（仔细听！点右上角的喇叭可以再听一遍）', hideEn: true });
  const openRow = (C, y, keep) => C.map.gates.filter(g => g.y === y).forEach(g => C.openGate(g.i, keep));
  const rowOpen = (C, y) => C.map.gates.some(g => g.y === y && C.gateOpen(g.i));

  // ======================================================================
  // 地图
  // ======================================================================

  // ---------- t5 社团岛：港口（渡轮）、才艺大帐篷、露天舞台、三个社团、沙滩 ----------
  EM.define('t5', {
    kind: 'town', z: 5, name: '社团岛', en: 'Club Island', sub: '第 6 岛', theme: 'circus',
    rows: [
      '####################################',
      '#TT..FF..Z....TT........TT.Z...FF.T#',
      '#T.HHHHH....==AAAAAAAAA==...JJJJJ.T#',
      '#..HHHHH....=.AAAAAAAAA.=...JJJJJ..#',
      '#..HHhHH.1..=.AAAAAAAAA.=..2JJjJJ.o#',
      '#....=......=.AAAAaAAAA.=.....=....#',
      '#.B..==========================,,,,#',
      '#.....=........8..=...........=,,,,#',
      '#TT...=..ffffff...=..........,=,,,,#',
      '#.CCCC=..fZZZZf...=..GGGGG....=,*,,#',
      '#.CCCC=..f....f...=..GGGGG....=,,,,#',
      '#.CCcC=..f.3..f...=..GGGGG....=,,,,#',
      '#...=.=..ff..ff...=..GGgGG....=....#',
      '#...===============================>',
      '#.MMMM=......FF...=..........,,,,.=>',
      '#.MMMM=..EEE.FF...=..........,,,,.=>',
      '#.MMmM=..EEE4.....=.......HHHH....T#',
      '#...=....EEE......=.......HHHH.r7.T#',
      '#...=====.........=.......HHhH.rrr.#',
      '#TT.....=...SSSSSS=SSSSSSSSS=......#',
      '#T......=...SSSSSS=SSSSSSSSS=......#',
      '#SSSSSSS=BSSSSSSSS=SSSSSSSSS=SSSSSS#',
      'R~~~~~SS=SSSSSSTSSSSSSSSTSSSSSSSSTT#',
      'R~~~~~~~=~~SSSSSSSSSS6SSSSSSSSS*SSS#',
      'R~~~~~~~=~~~SSSSSSSSSSSSSSSSSSSSSSS#',
      'R~~~~~~~=~~~~~SSSSSSSSSSSSSSSSo~~~~R',
      'R~~~~~==@5=~~~~~SSSSSSSSSSSS~~~~~~~R',
      'R~~So~~~~~~~~~~~~SSSSSSSSSSS~~~~~~~R',
      'R~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~R',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    npc: {
      1: { role: 'story', tag: 'music', name: 'Music Club Lily', look: 'studentF', g: 'f', face: 'down' },
      2: { role: 'story', tag: 'dance', name: 'Dance Club Rosa', look: 'kidF', g: 'f', face: 'left' },
      3: { role: 'talk', name: 'Juggler Pip', look: 'clown', g: 'm', face: 'down', say: [['I can juggle five balls! Look!', '我会同时抛五个球！看！'], ["But I can't sing. Can you?", '可是我不会唱歌。你会吗？']], speak: 'I can juggle five balls!' },
      4: { role: 'story', tag: 'art', name: 'Art Club Ken', look: 'kid', g: 'm', face: 'left' },
      5: { role: 'ferry', name: 'Captain Gale', look: 'gale', g: 'm', face: 'left', to: 't4', toName: '学科岛', say: [['Ahoy! My ferry goes back to Subject Island.', '啊嗬！我的渡轮开回学科岛。'], ['The sea is calm today. Hop on!', '今天海上风平浪静，上船吧！']] },
      6: { role: 'talk', name: 'Swim Club Coach', look: 'swimmer', g: 'm', face: 'down', say: [['I teach the swimming club.', '我是游泳社的教练。'], ['Can you swim? Swimming is fun in summer!', '你会游泳吗？夏天游泳可好玩了！']], speak: 'Yes, I can swim.' },
      7: { role: 'talk', name: 'Strongman Max', look: 'strong', g: 'm', face: 'left', showIf: 'ch5',
        give: { item: 'hm_strength', flag: 'got_strength',
          say: [['Hey! I saw your show. You and your friend can really sing!', '嘿！我看了你们的表演，你和你的朋友真能唱！'], ["I can't sing. But I can lift big rocks!", '我不会唱歌，可是我能举起大石头！'], ['Take this. Now your monsters can push rocks, too!', '这个送给你。你的怪兽也能推大石头了！']],
          after: [['You need six badges to use Strength.', '要有 6 枚徽章才能用「怪力」。'], ['On Dune Road, a big rock is in the way. Push it!', '沙丘道上有块大石头挡路，把它推开吧！']] },
        say: [['Strong body, strong voice!', '身体棒，声音也要响亮！'], ['Push the rock into a little hole. If it gets stuck, leave the road and come back!', '把石头推进小凹洞里。要是推错卡住了，离开这条路再回来，石头就会回到原位！']], speak: 'I can push big rocks!' },
      8: { role: 'talk', name: 'Chess Club Amy', look: 'studentF', g: 'f', face: 'down', say: [['Join our chess club! We play every Tuesday.', '加入我们的国际象棋社吧！我们每周二下棋。'], ["I can play chess, but I can't dance.", '我会下国际象棋，可是不会跳舞。']], speak: 'Join our chess club!' },
    },
    signs: [['Welcome to Club Island! Join a club and have fun!', '欢迎来到社团岛！加入一个社团，玩得开心！'], ['Ferry to Subject Island. Captain Gale is on the pier.', '开往学科岛的渡轮。盖尔船长在栈桥上。']],
    marks: [['Colorful balloons! Everyone can fly a balloon here.', '五颜六色的气球！'], ['A balloon for the Talent Show.', '才艺表演的气球。'],
      ['The Open-Air Stage. "We can sing and dance!"', '露天舞台。“我们会唱歌跳舞！”'], ['Balloons on the stage.', '舞台上的气球。'], ['A big red balloon.', '一个大红气球。'], ['Balloons for the clubs.', '社团的气球。']],
    items: ['superpotion', 'revive', 'waterstone'], hiddenItems: ['superball', 'fullheal'],
    links: { e: 'r5' },
  });

  // ---------- r5 沙丘道：沙地、遗迹、绿洲；一格宽的峡谷里有怪力大石头 ----------
  EM.define('r5', {
    kind: 'route', z: 5, name: '沙丘道', en: 'Dune Road', sub: '社团岛 → 作息岛', theme: 'circus',
    rows: [
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
      'RTSSSSS,,,,,SSSSSTRRRRRRRRRRRRRRRTSSBSSSSSSSSR',
      'RTSSSrr,,,,,SoSSSSRRRRRRRRRRRRRRRSSSSSSS,,,,SR',
      'RSSZSSS,,,,,SSSZSSRRRRRRRRRRRRRRRSSSSSSS,,,,S>',
      'RSSSSSSSSSSSSSSSSSRRRRRRRRRRRRRRRSSSSSSSSSSSS>',
      'RS,,,,SSSS1SrrSS*SRRRRRRRRRRRRRRRSSSSSoSSS5SS>',
      'RS,,,,SSSZSSSSSSSSRRRRRRRRRRRRRRRSSSSSSSSSSSSR',
      'RSSZSSSSSSSSS,,,,SRRRRRRRRRRRRRRSSSSSSSSSSSSSR',
      'RSSSSSrSSSSSS,,,,SRRRRRRRRRRRRRRSRS,,,,,SSSSSR',
      'RTSSSSSSSSSSSSSSSTRRRRRRRRRRRRRRSRS,,4,,SSSSSR',
      'RTTTSSSTTTTTTTTTTTRSSSRRRRRSRRRRSRS,,,,,SSSSSR',
      'RTTTSSSTS,,,,,,oTTRS3SSSOSSSSSSSSRSSSSSSSS*SSR',
      'RTTTSSSSS,,,,,,TTTRSSSRRRRSSRRRRRRTSSSSSSSSSTR',
      'RTTTSSSTTTTTTTTTTTRSSSRRRRRRRRRRRRLLLLLLLLLLLR',
      'RTTSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSR',
      'RTS,,,,,,,SSSSSSSS6SSSBSSSSSSSSSSSSSSSSSSSSSSR',
      'RSS,,,,,,,S2SSSSSSSSSSSS,,,,,,,,SrSSSSSSSSSSSR',
      'RSS,,,,,,,SSSSSSSSSSSSSS,,,,,,,,SSSSSSSSSSSSSR',
      'RSBSSSSSSSSSTTTTTTTTTSSS,,,,,,,,SSSSSSSSSSSSSR',
      '<SSSSSSSSSSSS~~~~~~~SSSSSSSSSS7SSSSSSSSSSSSSSR',
      '<SSSSSSSSSSSS~~~~~~~SSSSSSSSSSSSSSSS,,,,,,,SSR',
      '<SSSSSSSSSSSS~~~o~~~SSSSSSTTSSrSSSSS,,,,,,,SSR',
      'RSSSSSSSrSSSS~~~~~~~SSSSSSSSSSSSSSSS,,,,,,,SSR',
      'RSSSSSSSSSSSS~~~~~~~SSSSSSSSSSSSSSSS,,,,,,,SSR',
      'RSSSSSSSSSSSTTSSSSSTTS,,,,,,SSSSSSSSSSSRRRRRRR',
      'RSSSSSSSSSSSSSSSSSSSSS,,,,,,SSSSSSSSSSSRRRRRRR',
      'RSSSSSSSSSSSSSSSSSSSSS,,,,,,SS*SSSTTSSSSSbSSRR',
      'RTTTSSSSSTTSSSSSSSSSSS,,,,,,SSSSSSSTSSSRRRSoRR',
      'RTTTTSSSSSTTTSSSSSSSSSSSSSSSSSSSSSSSSSSRRRRRRR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    npc: {
      1: { role: 'trainer', name: 'Explorer Indy', look: 'hiker', g: 'm', face: 'down', sight: 3, types: ['rock', 'ground'], n: 2,
        lines: [['I can read the old words on these stones!', '我能读懂这些石头上的古老文字！'], ["Can you? No? Then let's battle!", '你能吗？不能？那就来对战吧！']], win: ["You can't read them, but you can battle!", '你不会读，可是你会对战！'], after: [['The stones say: "Speak, and the world will hear you."', '石头上写着：“开口说话，世界就会听见你。”']] },
      2: { role: 'trainer', name: 'Juggler Toby', look: 'clown', g: 'm', face: 'left', sight: 4, team: [['woolpuff', 0], ['cheerpuff', 1]],
        lines: [['I can juggle, and my monsters can dance!', '我会抛球，我的怪兽会跳舞！']], win: ['Oh no, I dropped all my balls!', '哎呀，球全掉了！'], after: [["I can't win, but I can juggle!", '我赢不了，可是我会抛球！']] },
      3: { role: 'trainer', name: 'Dancer Lina', look: { skin: '#ffe0c8', hair: '#6d4c41', style: 'bun', eye: '#6a3fa0', shirt: '#ff5e9c', shirt2: '#ffffff', bottom: '#ff80ab', skirt: true, shoes: '#ffffff' }, g: 'f', face: 'down', sight: 2, team: [['dancelion', 0], ['twirlflame', 0]],
        lines: [['Can you dance? My fire monsters can!', '你会跳舞吗？我的火系怪兽会！']], win: ['You can battle very well!', '你对战真厉害！'], after: [['The big rock is in the canyon. Can your monster push it?', '峡谷里有块大石头。你的怪兽推得动吗？']] },
      4: { role: 'trainer', name: 'Drummer Joe', look: 'athlete', g: 'm', face: 'left', sight: 3, under: ',', team: [['drumpaw', 0], ['thunderdrum', 1]],
        lines: [['Boom, boom! I can play the drums!', '咚咚！我会打鼓！']], win: ['My drums are quiet now...', '我的鼓没声音了……'], after: [["My brother can't play the drums. I can!", '我哥哥不会打鼓，我会！']] },
      5: { role: 'trainer', name: 'Singer May', look: 'girl', g: 'f', face: 'left', sight: 4, team: [['songlet', 0], ['songwing', 1]],
        lines: [['La la la! I want to join the music club!', '啦啦啦！我想加入音乐社！']], win: ['Your voice is so clear!', '你的声音好清楚！'], after: [['Clock Island is just to the east.', '往东走就是作息岛了。']] },
      6: { role: 'talk', name: 'Hiker Sandy', look: 'hiker', g: 'm', face: 'up', say: [['A big rock is in the canyon. A strong monster can push it.', '峡谷里有块大石头，力气大的怪兽能推开它。'], ['Push it into the little hole on the wide spot!', '把它推到宽一点的地方那个小凹洞里！'], ['If it gets stuck, go back to Club Island. The rock will go back, too.', '要是卡住了，就先回社团岛，石头也会回到原来的地方。']], speak: 'A strong monster can push it.' },
      7: { role: 'trainer', name: 'Camper Dan', look: 'kid', g: 'm', face: 'down', sight: 3, team: [['cactuskid', 0], ['mudcake', 0]],
        lines: [["I can't swim, but I can walk on the sand all day!", '我不会游泳，可是我能在沙地上走一整天！']], win: ['I need some water...', '我要喝口水……'], after: [['There is an item on the little island in the oasis.', '绿洲中间的小岛上有个道具。']] },
    },
    signs: [['Route 6: Dune Road. West: Club Island. East: Clock Island.', '6 号路：沙丘道。西：社团岛；东：作息岛。'], ['Danger! A big rock is in the canyon.', '注意！峡谷里有块大石头。'], ['Clock Island is just ahead!', '前面就是作息岛了！']],
    marks: [['An old standing stone. "Can you hear me?"', '古老的石柱。上面刻着：“你听得见我吗？”'], ['An old stone with a picture of a guitar.', '刻着吉他的古老石头。'], ['A broken old stone. It looks very old.', '一块断了的石头，看起来很古老。'], ['An old stone: "We can sing together."', '古老的石头：“我们可以一起唱歌。”']],
    markKinds: ['stone', 'stone', 'stone', 'stone'],
    items: ['superball', 'repel', 'superpotion', 'firestone', 'revive', 'leafstone'], hiddenItems: ['superpotion', 'fullheal', 'superball'],
    links: { w: 't5', e: 't6' },
  });

  // ---------- t6 作息岛：石板路、钟楼广场、北边冒烟的钟山 ----------
  EM.define('t6', {
    kind: 'town', z: 6, name: '作息岛', en: 'Clock Island', sub: '第 7 岛', theme: 'clock',
    rows: [
      '######################################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRKRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRR=RRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRR=RRRRRRRRRRRRRRRRR#',
      '#TTRRRRRRRRRTTTRRRR=RRRRTTTRRRRRRRRTT#',
      '#TTTRRRRRRRRTTTRRRR1RRRRTTTRRRRRRRTTT#',
      '#.o....,,,,.......R=R.......,,,,...*.#',
      '#.==============7=====2=============.#',
      '#.......=..........=B..............=.#',
      '#..CCCC.=...Z......=....Z....GGGGG.=.#',
      '#..CCCC.=....===========.....GGGGG.=.#',
      '#..CCcC.=....=F.AAAAA.F=..FF.GGGGG.=.#',
      '#....=========..AAAAA..=..FF.GGgGG.=.#',
      '#....=..=....=..AAAAA..=.......=...=.#',
      '#..MMMM.=....=..AAAAA..=============.#',
      '#T.MMMM.=.FF.=..AAaAA..=.............#',
      '#T.MMmM.=.FF.=....=....=......HHHH...#',
      '#....====....=F...=...F=......HHHH...#',
      '#....=..=..6.===========......HHhH..T#',
      '<==..=..=...Z.....=..5..Z.......=...T#',
      '<==================================..#',
      '<==..=............=..........=...TTT.#',
      '#.B..=............=..,,,,,...=...noT.#',
      '#..HHHH..EEEE.....=..,,,,,.JJJJ..TTT.#',
      '#..HHHH..EEEE.....=..,,,,,.JJJJ..TT..#',
      '#..HHhH3.EEEE.....=..,,,,,.JJjJ...T..#',
      '#....=......TT....=.......4..=.......#',
      '#....=========================.......#',
      '#~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~#',
      '#~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~#',
      '#..*.............................o...#',
      '######################################',
    ],
    npc: {
      1: { role: 'guard', badge: 7, name: 'Ranger Tom', look: 'ranger', g: 'm', say: [['Stop! Clock Mountain is a volcano. It is not safe.', '站住！钟山是座火山，很危险。'], ['Only trainers with seven badges can go up.', '只有 7 枚徽章的训练师才能上山。']] },
      2: { role: 'story', tag: 'kai', name: 'Kai', look: 'kai', g: 'm', face: 'left', showIf: 'ch6' },
      3: { role: 'story', tag: 'baker', name: 'Baker Bun', look: 'chef', g: 'm', face: 'left' },
      4: { role: 'story', tag: 'student', name: 'Student Lucy', look: 'studentF', g: 'f', face: 'down' },
      5: { role: 'story', tag: 'mayor', name: 'Mayor Tick', look: 'grandpa', g: 'm', face: 'down' },
      6: { role: 'talk', name: 'Mrs. Hands', look: 'granny', g: 'f', face: 'right', say: [['I always get up at six and have a cup of tea.', '我总是六点起床，先喝一杯茶。'], ['What time do you usually get up?', '你通常几点起床？']], speak: 'I usually get up at seven.' },
      7: { role: 'talk', name: 'Hiker Hal', look: 'hiker', g: 'm', face: 'down', say: [['Clock Mountain smokes every day at noon.', '钟山每天中午都会冒烟。'], ['Inside, there is lava. Do not swim in it!', '山里面有岩浆，可千万别下去游泳！']], speak: 'Clock Mountain is a volcano.' },
    },
    signs: [['Welcome to Clock Island! Be on time!', '欢迎来到作息岛！要守时哦！'], ['Clock Mountain. Seven badges only.', '钟山登山口。只有 7 枚徽章的训练师可以上山。']],
    marks: [['A street clock. It stopped at three o\'clock.', '街边的钟。它停在了三点。'], ['A street clock with a bird on top.', '顶上站着一只小鸟的街钟。'], ['A street clock. "Time is money!"', '街钟。上面写着：“时间就是金钱！”'], ['A street clock with big numbers.', '数字很大的街钟。']],
    items: ['superball', 'superpotion', 'revive'], hiddenItems: ['thunderstone', 'fullheal'],
    links: { w: 'r5', K: ['d6a'] },
  });

  // ---------- d6a 钟山 1F：熔岩洞，西、中、东三条路，怪力石头小谜题 ----------
  EM.define('d6a', {
    kind: 'cave', cave: 'lava', z: 6, name: '钟山 1F', en: 'Clock Mountain 1F', sub: '作息岛北边', lv: 2, dungeon: true,
    rows: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXo:::::XXXXX:%:::::XXX::::::::X',
      'XX::::::XXXXX:::::::XXX::::::::X',
      'XXXXXOXXXXXXX::::::::::::::::::X',
      'XXXX:O:XXXXXXXXXXXXXXXXXXXXXX:XX',
      'XXXX:::XXX::::::::2:::XX:::::::X',
      'XX:::::::X:r::::::::::XX:o:::::X',
      'XX:::::::X::rrrrrrrrr:XX:::::::X',
      'XX:::::::X::r~~~~~~~r:XX::3::::X',
      'XX:::1:::X::r~~~~~~~r::::::::::X',
      'XX:::::::X::r~~XXX~~r:XXr::::::X',
      'XX:::::::X::r~~XXX~~r:XX:::::::X',
      'XX:::::r::::r~~~~~~~r:XXXXX::XXX',
      'XX:::::::X::r~~~~~~~r:XXXXX::XXX',
      'XXX::XXXXX::rrrrrrrrr:XXXXX::XXX',
      'XXX::XXXXX:::::::::::*XXXXX::XXX',
      'XXX::XXXXX::::::::::::XXrrr:rrrX',
      'XXX::XXXXXXXXX:::XXXXXXr~~~:~~~X',
      'XXX::XXXXXXXXX:::XXXXXXr~~~:~~~X',
      'XXX::XXXXXXXXX:::XXXXXXr~~~:~~~X',
      'XXX::XXXXXXX:::::::XXXXrrrr:rrrX',
      'XXX::XXXXXXX:::::::XXXXXXXX::XXX',
      'X:::::::::::::::4::XXXXXXXX::XXX',
      'X::XXXXXXXXX:::::::XXXXXXXX::XXX',
      'X::XXXXXXXXX:::::::::::::::::XXX',
      'Xo:XXXXXXXXX:::::::XXXXXXXXXXXXX',
      'XXXXXXXXXXXX:::::::XXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXeXXXXXXXXXXXXXXXX',
    ],
    npc: {
      1: { role: 'trainer', name: 'Hiker Rocky', look: 'hiker', g: 'm', face: 'down', sight: 3, team: [['lavalet', 0], ['rockcandy', 1]],
        lines: [['I get up at five every day to climb this mountain!', '我每天五点起床爬这座山！']], win: ['Time for a break...', '该休息一下了……'], after: [["It's hot in here. Drink water every hour!", '这里很热，每个小时都要喝水！']] },
      2: { role: 'trainer', name: 'Scientist Ash', look: 'scientist', g: 'm', face: 'down', sight: 4, types: ['fire', 'steel'], n: 2,
        lines: [['I check the lava at nine o\'clock every morning.', '我每天早上九点检查岩浆。']], win: ['My notes say: you win!', '我的笔记写着：你赢了！'], after: [['The volcano is getting hotter. Something is wrong at the top!', '火山越来越热了。山顶一定出事了！']] },
      3: { role: 'trainer', name: 'Night Worker Mo', look: 'miner', g: 'm', face: 'left', sight: 3, team: [['magmaheart', 1], ['gearbeetle', 0]],
        lines: [['I work at night and sleep in the day. Good morning... or good night?', '我晚上工作白天睡觉。早上好……还是晚安？']], win: ['Zzz... I need to go to bed.', '呼……我得去睡觉了。'], after: [['I go to bed at eight in the morning!', '我早上八点才睡觉！']] },
      4: { role: 'talk', name: 'Hiker Pat', look: 'hiker', g: 'm', face: 'up', say: [['Two big rocks block a room in the west.', '西边有个小房间被两块大石头挡住了。'], ['Push the lower rock to the side first!', '先把下面那块推到旁边去！']], speak: 'Push the rock to the side.' },
    },
    items: ['superball', 'firestone', 'superpotion'], hiddenItems: ['revive'],
    links: { e: 't6', '%': ['d6b'] },
  });

  // ---------- d6b 钟山山顶：火山口，闷雷的地热机器；剧情后出现炎狮 ----------
  EM.define('d6b', {
    kind: 'route', z: 6, name: '钟山山顶', en: 'Clock Mountain Summit', sub: '作息岛北边', theme: 'clock', lv: 2,
    rows: [
      'RRRRRRRRRRRRRRR^^^RRRRRRRRRRRRRRRR',
      'RRRRTTTRRRRRRSSSSS,SRRRRRRRRRRRRRR',
      'RRRRRRRRRRRRRS,,SSSSRRRRRRRTTRRRRR',
      'RRRRRTTRRRRRRSSSSSSSRRRRRRRRRRRRRR',
      'RRRRSSSSSSSSSSSSSSSrSSSSSSSSSSRRRR',
      'RRRRSS1SSrSSSS,,,,,SSSSSrSSS*SRRRR',
      'RRRRSSSSSSSSSSrSSSSSSSSSSSSSSSRRRR',
      'RSSSSSSSSSRRRRRRRRRRRRRRSSSSSSSSSR',
      'RSSS,,,,SSRR~~~~~~~~~~RRSS,,,,SSSR',
      'RSSS,,,,SSRR~~~~~~~~~~RRSS,,,,SoSR',
      'RSSS,,,,SSRR~~~~~~~~~~RRSS,,,,SSSR',
      'RSSS,,,,SSRR~~~~~~~~~~RRSS,,,,SSSR',
      'RRRSSSSSSSRR~~~~~~~~~~RRSSSSSSSRRR',
      'RRRSSSSSSSRR~~~~~~~~~~RRSSSS2SSRRR',
      'RRRSSSrSSSRRRRSSZSSSRRRRSSSSSSSRRR',
      'RRRS,,,,SSSSSSSSSSSSSSSSSSSrSSSRRR',
      'RRRS,,,,SSSSrSSSSSSSSSSS,,,,,SSRRR',
      'RSSSSSSSSSSSSSSSSSSSSrSSSSSSSSSSSR',
      'RLLLLLLLLSSSSSSSSSSSSSSSSLLLLLLLLR',
      'RSSSSSSSSSrSSSSSSSSSSSSSSSSSSSSSSR',
      'RSoSSSSSSRRRRRSSSSSSRRRRRSSSSSSSSR',
      'RSS,,,,,SSSSSSSSSS3SSSrrSS,,,,,SSR',
      'RSS,,,,,SSSSSBSSSSSSSSSSSS,,,,,SSR',
      'RSS,,,,,SRRRRSSSSSSSSRRRRS,,,,,SSR',
      'RSSSSSSSSRRRRSSSSSSrSRRRRSSSSSSSSR',
      'RSSSSSSSSRRRRSSS%SSSSRRRRSSSSSSSSR',
      'RrrSSSSSSRRRRSSSSSSSSRRRRSSSSSSrrR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    npc: {
      1: { role: 'trainer', name: 'Hiker Summit', look: 'hiker', g: 'm', face: 'down', sight: 3, types: ['rock', 'fire'], n: 3,
        lines: [['I got up at four to see the sunrise from the top!', '我四点就起床，到山顶看日出！']], win: ['The sun is up, and I am down!', '太阳升起来了，我却输了！'], after: [['The view is great at six in the morning.', '早上六点，这里的风景最美。']] },
      2: { role: 'trainer', name: 'Camper Blaze', look: 'athlete', g: 'm', face: 'left', sight: 3, team: [['emberpup', 1], ['twirlflame', 1]],
        lines: [['My monsters and I train every afternoon!', '我和我的怪兽每天下午都训练！']], win: ['Too hot! I need a rest.', '太热了！我要休息一下。'], after: [['Go north, and you will see a candy beach.', '往北走，能看到糖果色的海滩。']] },
      3: { role: 'trainer', name: 'Early Bird Ella', look: 'studentF', g: 'f', face: 'up', sight: 3, types: ['flying', 'normal'], n: 2,
        lines: [['I always get up early. The early bird catches the worm!', '我总是早起。早起的鸟儿有虫吃！']], win: ['Maybe I should sleep more...', '也许我该多睡一会儿……'], after: [['I go to bed at nine every night.', '我每晚九点睡觉。']] },
    },
    signs: [['Clock Mountain Summit. Hot! Do not go near the lava.', '钟山山顶。很热！不要靠近岩浆。']],
    marks: [['A strange machine. It is very hot. A timer says 8:50.', '一台奇怪的机器，非常烫。计时器上显示 8:50。']],
    markKinds: ['light'],
    items: ['revive', 'firestone'], hiddenItems: ['superball'],
    links: { n: 'r6', '%': ['d6a'] },
  });

  // ---------- r6 7 号路：火山岩慢慢变成糖果色的海滩 ----------
  EM.define('r6', {
    kind: 'route', z: 6, name: '7 号路', en: 'Route 7', sub: '钟山 → 生日派对岛', theme: 'party',
    rows: [
      '#############^^^##############',
      '#TTSSSSSSSTTSS=SSSTTSSS~~~~~~#',
      '#SSSSSSSSSSSSS=BSSSSSSS~~~~~~#',
      '#SS,,,,,,SSSSS=SSSSSSoS~~~~~~#',
      '#SS,,,,,,SSSSS=SSSSSSSS~~~~~~#',
      '#SS,,,,,,SSTTS=SSSSSSSS~~~~~~#',
      '#SSSSSSSSSSTSS=SSSSSSSS~~~~~~#',
      '#TSSSSSS5SSSSS=,,,,,SSS~~~~~~#',
      '#SSSSSSSSSSSSS=,,,,,SSS~~So~~#',
      '#SSSSSSSSSSSSS=,,,,,SS4~~SS~~#',
      '#SFFFSSSSSSSSS=SSSSS====~~~~~#',
      '#SSSSSFFSSSSSS=SSSSSSSS~~~~~~#',
      '#SSSSSSSSSSSSS=SSSSSSSS~~~~~~#',
      '#TTT.TTTTTTTTT=TTTTTTTTT.TTTT#',
      '#...=...................=....#',
      '#...=...TTTTTTnTTTTTT...=...T#',
      '#.,,=,,.TTTTTT,TTTTTT...=....#',
      '#.,,=,,.TT,,,,,,,,,TT.,,=,,,.#',
      '#.,,=,,.TT,,,,,,,,,TT.,,=,,,.#',
      '#.,,=,,.TT,,,,,,,,,TT.,,=,,,.#',
      '#.,,=,,.TT,,o,,,,,,TT.,,=,,,.#',
      '#...=...TT,,,,,,,,,TT.,.=....#',
      '#...=3..TT,,,,,,*,,TT.,.=....#',
      '#TT.=...TT,,,,,,,,,TT...=....#',
      '#T..=...TT,,,,,,,,,TT...=~~~.#',
      '#...=...TTTTTTTTTTTTT...=~~~6#',
      '#...=...TTTTTTTTTTTTT...=~~~.#',
      '#...=...................=~~~.#',
      '#...=====================....#',
      '#RRRRRRRRRLLLL=LLLRRRRRRRRRRR#',
      '#SSSSSSSSSSSSS=SSSSSSSSSSSSSS#',
      '#SSSSSS,,,,,SS=SSSSSrrSSSSSSS#',
      '#SS*SSS,,,,,SS=SSSSSSSRRRRRRR#',
      '#RRRRRS,,,,,SS=SSS2SSSRRRRRRR#',
      '#RRRRRS,,,,,SS=SSSSSSSRRRRRRR#',
      '#RRRRRSSSSSSSS=SSSSSSSRRRRRRR#',
      '#RRRRRSLLLLLLS=SSSSSSSSSSSSoS#',
      '#SSSSSSSSSSSSS=SS,,,,,SSSSSSS#',
      '#S,,,,,,,SSSSS=SS,,,,,SSSSrrS#',
      '#S,,,,,,,1SSSS=SS,,,,,SSSSSSS#',
      '#S,,,,,,,rSSSS=SS,,,,,SSSSSSS#',
      '#S,,,,,,,SSSSS=SSSSSSSSSrSSSS#',
      '#SSSSSSSSSSSSB=SSSSSSSSSSSSSS#',
      '##############vv##############',
    ],
    npc: {
      1: { role: 'trainer', name: 'Hiker Glen', look: 'hiker', g: 'm', face: 'right', sight: 4, under: ',', types: ['rock', 'fire'], n: 2,
        lines: [['I climb down the mountain at three every afternoon.', '我每天下午三点下山。']], win: ['It is time to go home.', '该回家了。'], after: [['Jump down the steps. It is faster!', '从台阶跳下去，更快！']] },
      2: { role: 'trainer', name: 'Camper Tim', look: 'kid', g: 'm', face: 'left', sight: 3, types: ['bug', 'grass'], n: 2,
        lines: [['I get up at seven and go to bed at nine. Every day!', '我七点起床，九点睡觉，天天如此！']], win: ['It is my bedtime now...', '到我睡觉的时间了……'], after: [["Don't stay up late!", '别熬夜哦！']] },
      3: { role: 'trainer', name: 'Party Kid Nina', look: 'kidF', g: 'f', face: 'right', sight: 3, team: [['cakelet', 0], ['skyballoon', 1]],
        lines: [["I'm late for the party! It's already four o'clock!", '派对我要迟到了！已经四点了！']], win: ['Now I am really late!', '这下真的迟到了！'], after: [['The party is on Party Island, just to the north.', '派对就在北边的生日派对岛。']] },
      4: { role: 'trainer', name: 'Swimmer Kate', look: 'swimmerF', g: 'f', face: 'left', sight: 3, types: ['water'], n: 2,
        lines: [['I swim at six every morning!', '我每天早上六点游泳！']], win: ['I need to swim more!', '我得多游几圈！'], after: [['With Surf, you can go to the little island.', '学会冲浪，就能去那个小沙洲。']] },
      5: { role: 'trainer', name: 'Baker Bella', look: 'chef', g: 'f', face: 'down', sight: 3, team: [['creamcake', 1]],
        lines: [['I bake cakes from six to eleven every morning!', '我每天早上六点到十一点烤蛋糕！']], win: ['My cake is burning!', '我的蛋糕烤焦了！'], after: [['A birthday cake needs candles!', '生日蛋糕要插蜡烛！']] },
      6: { role: 'trainer', name: 'Fisher Finn', look: 'fisher', g: 'm', face: 'left', sight: 2, types: ['water', 'spark'], n: 2,
        lines: [['I fish from morning to night!', '我从早到晚都在钓鱼！']], win: ['The fish got away... and so did I.', '鱼跑了……我也输了。'], after: [['The best time to fish is five in the morning.', '钓鱼最好的时间是早上五点。']] },
    },
    signs: [['Route 7. North: Party Island.', '7 号路。往北是生日派对岛。'], ['Party Island is just ahead! Don\'t be late!', '前面就是生日派对岛！别迟到！']],
    items: ['superpotion', 'superball', 'leafstone', 'fullheal'], hiddenItems: ['revive', 'superball'],
    links: { s: 'd6b', n: 't7' },
  });

  // ---------- t7 生日派对岛：蛋糕房子、糖果海滩、港口（爸爸的船） ----------
  EM.define('t7', {
    kind: 'town', z: 7, name: '生日派对岛', en: 'Party Island', sub: '第 8 岛', theme: 'party',
    rows: [
      '######################################',
      '#TT.......TT.................TTSS~~~~~',
      '#T.............AAAAAAA...HHHHSSSS~~~~~',
      '#............Z.AAAAAAA.Z.HHHHSSSS~~~~~',
      '#..............AAAAAAA...HHhHSSSS~~~~~',
      '#..............AAAaAAA.....=.SSSS~So~~',
      '#.....=======================1=SS~~~~~',
      '#.....=.=B.....4..=..........SSSS~~~~~',
      '#..CCCC.=.........=..........SSSS~~~~~',
      '#..CCCC.=...=============....SSSS~~~~~',
      '#..CCcC.=...==FF.....FF==....STTSSSSS#',
      '#....=..=...==..T...T..==....SSSSSSSS>',
      '#....=========....Z....==============>',
      '#....=..=...==..T...T..==....SSBSSSSS>',
      '#..MMMM.=...==FF.....FF==....SSSSSSSS>',
      '#..MMMM.=...=============....SSSSSSSS#',
      '#..MMmM.=.........=...2......STSSSSSS#',
      '#....=..=..3......=......JJJJSSSS~~~~~',
      '#T...====.........=......JJJJSSSS~~~~~',
      '#T......=.GGGGG...=......JJjJSSSS~~~~~',
      '#.......=.GGGGG...=........=.SS==5==Z~',
      '#..HHHH.=.GGGGG...=........=.SSSS~~~~~',
      '#..HHHH.=.GGgGG...=........==SS6S~~~~~',
      '#..HHhH.=...=.....=.........=SSSS~~~~~',
      '#....========================SS~~~~~~~',
      '#.......=.........=..........SS~~~~~~~',
      '#.......=.FFFFF...=.,,,,,,,..SS~~~~~~~',
      '#,*,,,,.=.FFFFF...=.,,,,o,,..SS~~~~~~~',
      '#,,,,,,.=.FFFFF...=.,,,,,,,..SS~~~~~~~',
      '#,,,,,,..T.....TT.=.,,,,,,,..SS~~~~~~~',
      '#.................=..........SS~~~~~~~',
      '##################vv##################',
    ],
    npc: {
      1: { role: 'story', tag: 'granny', name: 'Granny Rose', look: 'granny', g: 'f', face: 'down' },
      2: { role: 'story', tag: 'amy', name: 'Amy', look: 'kidF', g: 'f', face: 'down' },
      3: { role: 'story', tag: 'baker7', name: 'Baker Sugar', look: 'chef', g: 'm', face: 'down' },
      4: { role: 'talk', name: 'Balloon Clown', look: 'clown', g: 'm', face: 'down', say: [['Happy birthday... to everyone! Take a balloon!', '祝大家……生日快乐！拿个气球吧！'], ['How old are you? I\'m thirty years old!', '你几岁了？我三十岁啦！']], speak: 'Happy birthday to you!' },
      5: { role: 'story', tag: 'dad', name: 'Dad', look: 'dad', g: 'm', face: 'left', showIf: 'rival3' },
      6: { role: 'talk', name: 'Fisher Joe', look: 'fisher', g: 'm', face: 'up', say: [['Animal Island is far to the east.', '动物岛在东边很远的地方。'], ['You need to surf across the sea.', '要冲浪才能过海。']], speak: 'Animal Island is to the east.' },
    },
    signs: [['Welcome to Party Island! Every day is somebody\'s birthday!', '欢迎来到生日派对岛！每天都是某个人的生日！'], ['The harbor. East: Sea Route 8.', '港口。往东是 8 号水路。']],
    marks: [['A big balloon. "Happy Birthday!"', '一个大气球，上面写着“生日快乐！”'], ['Balloons for the party!', '派对的气球！'], ['A giant gift box. What is inside?', '一个巨大的礼物盒。里面是什么呢？'], ["Dad's ship, the Sea Star.", '爸爸的船：海星号。']],
    markKinds: ['balloon', 'balloon', 'gift', 'boat'],
    items: ['superball', 'revive'], hiddenItems: ['moonstone'],
    links: { s: 'r6', e: 's7' },
  });

  // ---------- s7 8 号水路：大片的海、小岛、暗礁、深水（潜水） ----------
  EM.define('s7', {
    kind: 'route', z: 7, name: '8 号水路', en: 'Sea Route 8', sub: '生日派对岛 → 动物岛', theme: 'party', sea: true,
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~TSSSSST~RR~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~S,,,,SS~RR~~~R~~~~~~~~~~~RRRRR~~~~~~',
      '~~~~~~~~S,,,,SS~~~~~~~RR~~~~~~~~~RSoSR~~~~~~',
      '~~~~~~~~S,,,,SS~RR~~~~~~~~~~~~~~~RSSSR~~~~~~',
      '~~~~~~~~SS*SSSS~RR~~~~~~~~~~~~~~~RSRRR~~~~~~',
      '~~~~~~~~SSSSSoTTRR~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~RR~~~~~~~~RRR~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~RR~~~~~~~~RRR~~~~~~~~~~~~~~~',
      'RTTS~~~~~~~~~~~~~~~~~2~~~~RRR~~~~~~~~~~~~~~~',
      'RSBS~~~~~~~~~~~~~~~~~~~~~~RRR~~~~~~~R~~~~~~~',
      'RSSS~~R~~~~~~~~~~~~~~~~~~~RRR~~~~~~~~~~~~~~~',
      '<SSS~~~~~~~~~~~~~~~~~~~~~~RRR~~~~~~3~~~~~~R~',
      '<SSS~~~~~1~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~~~S>',
      '<SSS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~S>',
      'RSSS~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~~~~~~S>',
      'RSTS~~~~~~~~~~~~~TTSSSSSTT~~~~~RR~~~~~~~~~R~',
      'RTTS~~~~~~~~~~~~~SS,,,,,SS~~~~~RR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SS,,,,,S*~~~~~RR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SS,,,5,SS~~~~~RR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SS,,,,,SS~~~~~RR~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~SSSSoSSSS~~~~~~~~~~~~RR~~~~',
      '~~~~~~RRRRRRRR~~~S.SSSSSST~~~~~~~~~~~~RR~~~~',
      '~~~~~~RRRRRRRR~~~~~~~~~~~~~~~DDD~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~DDD~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~DDD~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~4~~~RR~~~~~~~~RR~~~~',
      '~~~~RR~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~RR~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    npc: {
      1: { role: 'trainer', name: 'Swimmer Tom', look: 'swimmer', g: 'm', face: 'right', sight: 1, under: '~', types: ['water'], n: 2,
        lines: [['My birthday is in July. I swim on my birthday!', '我的生日在七月，我过生日也游泳！']], win: ['Glub, glub...', '咕噜咕噜……'], after: [['When is your birthday?', '你的生日是什么时候？']] },
      2: { role: 'trainer', name: 'Swimmer Sally', look: 'swimmerF', g: 'f', face: 'down', sight: 1, under: '~', types: ['water', 'ice'], n: 2,
        lines: [["It's my birthday today! Let's battle!", '今天是我的生日！来对战吧！']], win: ['What a birthday present!', '真是一份特别的生日礼物！'], after: [['I got a new swimsuit for my birthday.', '我生日收到了一件新泳衣。']] },
      3: { role: 'trainer', name: 'Swimmer Ben', look: 'swimmer', g: 'm', face: 'left', sight: 1, under: '~', types: ['water', 'spark'], n: 2,
        lines: [['I am thirteen. How old are you?', '我十三岁了。你几岁了？']], win: ['You are strong for your age!', '你这个年纪就这么厉害！'], after: [['Animal Island is just to the east!', '往东就是动物岛了！']] },
      4: { role: 'trainer', name: 'Swimmer Joy', look: 'swimmerF', g: 'f', face: 'up', sight: 1, under: '~', types: ['water', 'poison'], n: 2,
        lines: [['The water is very deep over there. Can you dive?', '那边的水很深。你会潜水吗？']], win: ['You swim like a fish!', '你游得像条鱼！'], after: [['People say there is a garden under the sea.', '听说海底有一座花园。']] },
      5: { role: 'trainer', name: 'Fisher Sam', look: 'fisher', g: 'm', face: 'up', sight: 2, under: ',', types: ['water', 'bug'], n: 3,
        lines: [['I fish here every January. And every May, and every October!', '我每年一月都在这里钓鱼，五月、十月也来！']], win: ['That was a big fish!', '真是条大鱼！'], after: [['My birthday is in October. I want a new rod!', '我的生日在十月，我想要一根新钓竿！']] },
    },
    signs: [['Sea Route 8. East: Animal Island.', '8 号水路。往东是动物岛。']],
    items: ['superball', 'waterstone', 'revive'], hiddenItems: ['superball', 'fullheal'],
    oneWay: ['t8'],   // D 组的 t8 做好以前，对面还没有通回来的出口
    links: { w: 't7', e: 't8', D: ['u7'] },
  });

  // ---------- u7 海底花园：海草、珊瑚礁 ----------
  EM.define('u7', {
    kind: 'under', z: 7, arena: 'under', name: '海底花园', en: 'Sea Garden', sub: '8 号水路下面', lv: 3,
    rows: [
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRR',
      'RRRR......,,,,,,,,,.....RRRR',
      'RRRR......,,,,,,,,,.....RRRR',
      'RRRRR..RR.,,,,,,,,,.....RRRR',
      'RRRR...RR.,,,,,,,,,........R',
      'R......RR................o.R',
      'R......RR...RRRRRRRRR......R',
      'R.,,,,.RR...RRRRRRRRR..RR..R',
      'R.,,,,.RR...RR.........RR..R',
      'R.,,,,.RR...RR,,,,,..R.RR..R',
      'R.,*,,.RR...RR,,o,,....RR..R',
      'R.,,,,.RR.....,,,,,RR..RR..R',
      'R.,,,,.RR.....,,,,,RR......R',
      'R.,,,,....R........RR..RR,,R',
      'R...........RRRRRRRRR..RR,,R',
      'R......RR...RRRRRRRRR..RR,,R',
      'R......RR..............RR,,R',
      'R...U..RR.,,,,,,,,,,,..RR,,R',
      'R......RR.,,,,,,,,,,,..RR,,R',
      'RRR....RR.,,,,,,,,,,,....,,R',
      'RRR....RR............*.....R',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    ],
    people: [
      { x: 20, y: 5, role: 'trainer', name: 'Diver Dan', look: 'swimmer', g: 'm', face: 'left', sight: 3, types: ['water', 'poison'], n: 3,
        lines: [['I dive here on my birthday every year. It is on June 1st!', '我每年生日都来这里潜水。我的生日是 6 月 1 日！']], win: ['Bubbles, bubbles!', '咕嘟咕嘟！'], after: [['The coral here is older than my grandpa!', '这里的珊瑚比我爷爷的年纪还大！']] },
    ],
    items: ['superball', 'waterstone'], hiddenItems: ['revive', 'moonstone'],
    links: { U: ['s7'] },
  });

  // ---------- 室内：剧情建筑 ----------
  EM.define('i5A', { markKinds: ['speaker', 'speaker'],
    kind: 'inside', z: 5, room: 'L', name: '社团岛 · 才艺大帐篷', en: 'Talent Show Tent', sub: '第 6 岛', icon: '🎪',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_uuuuuuuuu_ZW',
      'W__uuuuuuuuu__W',
      'W__uuuuuuuuu__W',
      'W_____________W',
      'WY_YY_____YY_YW',
      'W_____________W',
      'WY_YY_____YY_YW',
      'W_____________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    people: [
      { id: 'mc', x: 9, y: 3, role: 'story', name: 'MC Bobo', look: 'clown', g: 'm', face: 'down' },
      { x: 2, y: 6, role: 'talk', name: 'Fan Tony', look: 'kid', g: 'm', face: 'up', say: [['I love the Talent Show! Can you play the piano?', '我最爱才艺表演了！你会弹钢琴吗？']], speak: 'I can play the piano.' },
      { x: 12, y: 6, role: 'talk', name: 'Fan Nora', look: 'studentF', g: 'f', face: 'up', say: [['My sister can sing very well.', '我姐姐唱歌唱得很好。']], speak: 'She can sing very well.' },
      { x: 9, y: 8, role: 'talk', name: 'Grandpa Joe', look: 'grandpa', g: 'm', face: 'up', say: [["I can't dance now, but I could dance when I was young!", '我现在跳不动了，可是年轻的时候可会跳了！']], speak: 'We can sing and dance together!' },
    ],
    links: { e: 't5' },
  });
  EM.define('i6A', { markKinds: ['clock', 'clock', 'clock', 'statue', 'statue'],
    kind: 'inside', z: 6, room: '1', name: '作息岛 · 钟楼', en: 'Clock Tower', sub: '第 7 岛', icon: '🕰️',
    rows: [
      'WWWWWWWWWWW',
      'Wk__ZZZ__kW',
      'W_________W',
      'W_Z_____Z_W',
      'W_________W',
      'W___YYY___W',
      'W_________W',
      'Wd_______pW',
      'W_________W',
      'Wp_______tW',
      'W____u____W',
      'WWWWWeWWWWW',
    ],
    people: [{ id: 'keeper', x: 8, y: 4, role: 'story', name: 'Keeper Tock', look: 'grandpa', g: 'm', face: 'left' }],
    links: { e: 't6' },
  });
  EM.define('i7A', { markKinds: ['gift'],
    kind: 'inside', z: 7, room: '5', name: '生日派对岛 · 蛋糕房子', en: 'Cake House', sub: '第 8 岛', icon: '🎂',
    rows: [
      'WWWWWWWWWWWWWWW',
      'Wp____uuu____pW',
      'W_Y__uuZuu__Y_W',
      'W_Y__uuuuu__Y_W',
      'W_____uuu_____W',
      'W_____________W',
      'WYY_________YYW',
      'W_____________W',
      'W_____________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    people: [
      { x: 3, y: 4, role: 'talk', name: 'Guest Lily', look: 'girl', g: 'f', face: 'right', say: [['This is a great party! Would you like some cake?', '这个派对真棒！你要来块蛋糕吗？']], speak: 'Yes, please.' },
      { x: 11, y: 4, role: 'talk', name: 'Guest Max', look: 'boy', g: 'm', face: 'left', say: [['My gift is a new ball. What is your gift?', '我的礼物是一个新球。你的礼物是什么？']], speak: 'This gift is for you.' },
      { x: 2, y: 8, role: 'talk', name: 'Guest Ann', look: 'granny', g: 'f', face: 'right', say: [['Let\'s sing "Happy Birthday" together!', '我们一起唱《生日快乐》吧！']], speak: 'Happy birthday to you!' },
    ],
    links: { e: 't7' },
  });

  // ---------- 道馆 ----------
  // i5G 音符地板：三段，每段听广播里的乐器 / 音符顺序，按顺序踩；踩错回这一段的起点
  EM.define('i5G', { markKinds: ['statue', 'statue', 'speaker', 'speaker', 'speaker'],
    kind: 'inside', z: 5, room: 'G', name: '社团岛 · 道馆', en: 'Music Gym', sub: '第 6 岛', icon: '🏟️',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W___________4_W',
      'WWWWWW|||WWWWWW',
      'W_____________W',
      'W_____________W',
      'W_____________W',
      'W_Z___________W',
      'WWWWWW|||WWWWWW',
      'W_____________W',
      'W_____________W',
      'W_Z_________3_W',
      'WWWWWW|||WWWWWW',
      'W_____________W',
      'W_____________W',
      'W_Z_________2_W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    over: [
      '...............',
      '...............',
      '...............',
      '...............',
      '.MSMDSMSMDSMDS.',
      '.SDMSDSDSSMDSM.',
      '.SMDMSMSMSDMSM.',
      '...............',
      '...............',
      '.dpgdpgdgpdgpd.',
      '.pdpgpdpdpdgdp.',
      '...............',
      '...............',
      '.gpggpgpggdgpg.',
      '.pdgpggdpggpgd.',
      '...............',
      '...............',
      '...............',
      '...............',
    ],
    paint: {
      d: { c: '#ef5350', t: '🥁' }, p: { c: '#42a5f5', t: '🎹' }, g: { c: '#ffca28', t: '🎸' },
      D: { c: '#ec407a', t: 'Do', tc: '#ffffff' }, M: { c: '#66bb6a', t: 'Mi', tc: '#ffffff' }, S: { c: '#7e57c2', t: 'Sol', tc: '#ffffff' },
    },
    npc: {
      1: { role: 'leader' },
      2: { role: 'trainer', name: 'Drummer Dan', look: 'athlete', g: 'm', face: 'left', sight: 3, team: [['drumpaw', 0], ['drumfrog', 0]],
        lines: [['Can you hear the drums? Boom, boom!', '你听见鼓声了吗？咚咚！']], win: ['My drums lost the beat!', '我的鼓乱了节奏！'], after: [['Listen first, then step!', '先听，再踩！']] },
      3: { role: 'trainer', name: 'Pianist Pam', look: 'studentF', g: 'f', face: 'left', sight: 2, types: ['normal', 'psychic'], n: 2,
        lines: [['I can play the piano with ten fingers!', '我能用十根手指弹钢琴！']], win: ['A wrong note!', '弹错了一个音！'], after: [['Guitar, drum, piano... remember the order!', '吉他、鼓、钢琴……记住顺序！']] },
      4: { role: 'trainer', name: 'Singer Sue', look: 'girl', g: 'f', face: 'left', sight: 3, team: [['songlet', 1], ['songhawk', 0]],
        lines: [['Do, mi, sol! Can you sing like me?', '哆、咪、嗦！你能像我这样唱吗？']], win: ['Your voice is louder than mine!', '你的声音比我还响亮！'], after: [['Flo can sing, dance and play the drums!', '火烈鸟乐手又会唱、又会跳、还会打鼓！']] },
    },
    links: { e: 't5' },
  });
  // i6G 时钟转门：三座钟，听广播报时，把钟拨到对的时间，转门跟着转；拨错了门转回原位
  EM.define('i6G', { markKinds: ['statue', 'statue', 'clock', 'clock', 'clock'],
    kind: 'inside', z: 6, room: 'G', name: '作息岛 · 道馆', en: 'Clock Gym', sub: '第 7 岛', icon: '🏟️',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W_____________W',
      'WWWWWWW|WWWWWWW',
      'W_______Z___3_W',
      'W_____________W',
      'WWWW|WWWWWWWWWW',
      'W___________Z_W',
      'W__2__________W',
      'WWWWWWWWWW|WWWW',
      'W_Z___________W',
      'W_____________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    npc: {
      1: { role: 'leader' },
      2: { role: 'trainer', name: 'Early Bird Emma', look: 'studentF', g: 'f', face: 'right', sight: 3, types: ['flying', 'steel'], n: 2,
        lines: [['I get up at five thirty every day!', '我每天五点半起床！']], win: ['I need more sleep...', '我需要多睡一会儿……'], after: [['Half past six means six thirty.', 'half past six 就是六点半。']] },
      3: { role: 'trainer', name: 'Night Owl Oscar', look: 'student', g: 'm', face: 'left', sight: 3, team: [['towerbell', 0], ['gearbeetle', 1]],
        lines: [['I go to bed at twelve. Too late, right?', '我十二点才睡觉。太晚了，对吧？']], win: ['Yawn... I should go to bed early.', '哈欠……我该早点睡。'], after: [['A quarter past four is four fifteen.', 'a quarter past four 就是四点十五分。']] },
    },
    links: { e: 't6' },
  });
  // i7G 礼物盒：广播说一个生日，踩写着这个日期的礼物盒；错的盒子里跳出训练师
  EM.define('i7G', { markKinds: ['statue', 'statue', 'speaker', 'speaker'],
    kind: 'inside', z: 7, room: 'G', name: '生日派对岛 · 道馆', en: 'Party Gym', sub: '第 8 岛', icon: '🏟️',
    rows: [
      'WWWWWWWWWWWWWWW',
      'WZ_____1_____ZW',
      'W_____________W',
      'WWWWWW|||WWWWWW',
      'W_____________W',
      'W_____________W',
      'W_____________W',
      'W_____________W',
      'W_____________W',
      'W_____________W',
      'WZ___________ZW',
      'W__2_______3__W',
      'W_____________W',
      'Wp___________pW',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    // 礼物盒占上下两格：上面一格写月份（小写字母），下面一格写日子（大写字母）
    over: [
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '..a.b.c.d.e.f..',
      '..A.B.C.D.E.F..',
      '...............',
      '..g.h.i.j.k.l..',
      '..G.H.I.J.K.L..',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
      '...............',
    ],
    paint: {
      a: { c: '#ff80ab', t: '5月', tc: '#ffffff' }, A: { c: '#ff80ab', t: '15日', tc: '#ffffff' },
      b: { c: '#4fc3f7', t: '3月', tc: '#ffffff' }, B: { c: '#4fc3f7', t: '5日', tc: '#ffffff' },
      c: { c: '#ffb74d', t: '5月', tc: '#ffffff' }, C: { c: '#ffb74d', t: '5日', tc: '#ffffff' },
      d: { c: '#81c784', t: '10月', tc: '#ffffff' }, D: { c: '#81c784', t: '3日', tc: '#ffffff' },
      e: { c: '#ba68c8', t: '1月', tc: '#ffffff' }, E: { c: '#ba68c8', t: '12日', tc: '#ffffff' },
      f: { c: '#ff8a65', t: '6月', tc: '#ffffff' }, F: { c: '#ff8a65', t: '21日', tc: '#ffffff' },
      g: { c: '#4fc3f7', t: '10月', tc: '#ffffff' }, G: { c: '#4fc3f7', t: '13日', tc: '#ffffff' },
      h: { c: '#ff80ab', t: '5月', tc: '#ffffff' }, H: { c: '#ff80ab', t: '25日', tc: '#ffffff' },
      i: { c: '#81c784', t: '1月', tc: '#ffffff' }, I: { c: '#81c784', t: '21日', tc: '#ffffff' },
      j: { c: '#ffb74d', t: '10月', tc: '#ffffff' }, J: { c: '#ffb74d', t: '30日', tc: '#ffffff' },
      k: { c: '#ff8a65', t: '3月', tc: '#ffffff' }, K: { c: '#ff8a65', t: '15日', tc: '#ffffff' },
      l: { c: '#ba68c8', t: '1月', tc: '#ffffff' }, L: { c: '#ba68c8', t: '1日', tc: '#ffffff' },
      x: { c: '#fff59d', t: '🎉' }, y: { c: '#e0e0e0', t: '💨' },
    },
    npc: {
      1: { role: 'leader' },
      2: { role: 'trainer', name: 'Party Girl Pat', look: 'kidF', g: 'f', face: 'up', sight: 2, team: [['cakelet', 0], ['creamcake', 0]],
        lines: [['My birthday is on May 2nd. When is yours?', '我的生日是 5 月 2 日。你的呢？']], win: ['Oh! My cake fell down!', '哎呀！我的蛋糕掉了！'], after: [['May fifth is 5月5日. Listen carefully!', 'May fifth 就是 5 月 5 日。仔细听！']] },
      3: { role: 'trainer', name: 'Balloon Boy Bob', look: 'kid', g: 'm', face: 'up', sight: 2, team: [['skyballoon', 0], ['cheerpuff', 1]],
        lines: [['I have thirteen balloons, one for every year!', '我有十三个气球，一岁一个！']], win: ['Pop! Pop! Pop!', '砰！砰！砰！'], after: [['Thirteen and thirty sound different. Listen for "-teen"!', 'thirteen 和 thirty 听起来不一样，注意听 “-teen”！']] },
    },
    links: { e: 't7' },
  });

  // ======================================================================
  // 剧情和机关
  // ======================================================================

  // ---------- 第 5 岛：才艺表演 ----------
  const CLUBS = {
    music: { who: ['Music Club Lily', 'studentF', 'f'], zh: '音乐社',
      hi: [['Hi! I\'m Lily from the music club.', '嗨！我是音乐社的莉莉。'], ['We sing and play the guitar every Friday.', '我们每周五唱歌、弹吉他。']],
      q: ['Can you sing?', 'Yes, I can.', ['Yes, I do.', 'Yes, it is.']], ok: ['Great! Here is a music club sticker.', '太好了！这是音乐社的贴纸。'],
      after: [['See you at the show! We can sing together!', '表演时见！我们可以一起唱！']] },
    dance: { who: ['Dance Club Rosa', 'kidF', 'f'], zh: '舞蹈社',
      hi: [['Hello! I\'m Rosa. I\'m in the dance club.', '你好！我是罗莎，我在舞蹈社。'], ['My monster can dance, too. Look! One, two, three!', '我的怪兽也会跳舞。看！一、二、三！']],
      q: ['Can your monster dance?', 'Yes, it can.', ['Yes, I am.', "No, it isn't."]], ok: ['Wow! Take a dance club sticker.', '哇！拿一张舞蹈社的贴纸吧。'],
      after: [["Let's dance at the show!", '表演的时候一起跳舞吧！']] },
    art: { who: ['Art Club Ken', 'kid', 'm'], zh: '美术社',
      hi: [['Hi! I\'m Ken. I can draw animals and flowers.', '嗨！我是肯。我会画动物和花。'], ['We have fun in the art club.', '我们在美术社玩得很开心。']],
      q: ['Do you want to join the art club?', 'Sure! I love drawing.', ["It's an art club.", "I'm Tom."]], ok: ['Welcome! Here is an art club sticker.', '欢迎！这是美术社的贴纸。'],
      after: [['I will draw a picture of your show!', '我要把你的表演画下来！']] },
  };
  const clubN = C => Object.keys(CLUBS).filter(k => C.flag('c5club_' + k)).length;
  const clubNote = C => C.note('🏷️ 社团贴纸 <b>' + clubN(C) + '/3</b>　' + Object.keys(CLUBS).map(k => CLUBS[k].zh + (C.flag('c5club_' + k) ? '✅' : '⬜')).join(' '));

  async function intro5(C) {
    const pl = C.pl, B = S('MC Bobo', 'clown', 'm');
    const mc = C.spawn({ look: LK.clown, name: 'MC Bobo', g: 'm', x: pl.x, y: pl.y - 3, face: 'down', id: 'bobo' });
    await C.alert(mc);
    await C.walk(mc, 'down', 2, 170);
    C.faceEach(mc);
    await C.talk([
      B('Hello! Welcome to Club Island!', '你好！欢迎来到社团岛！'),
      B("I'm Bobo, the host of the Talent Show.", '我是波波，才艺表演的主持人。'),
      B('Tonight, everyone can show what they can do!', '今晚，大家都可以秀一秀自己的本领！'),
      L.ask(B, 'What can you do?', '波波问你会做什么。选一个回答，再大声说出来。', 'I can sing.', ["I'm fine, thanks.", "It's a club."], {
        pass: () => [B('You can sing? Wonderful!', '你会唱歌？太棒了！')],
        fail: () => [B('Hmm? You can say: "I can sing."', '嗯？你可以说：“I can sing.”（我会唱歌。）')],
      }),
      B('To be in the show, you need three club stickers.', '想参加表演，要先集齐三个社团的贴纸。'),
      B('Visit the music club, the dance club and the art club.', '去找音乐社、舞蹈社和美术社的人。'),
      B('Then come to the big tent. See you there!', '然后到大帐篷来找我。一会儿见！'),
    ]);
    C.set('c5intro');
    await C.walk(mc, 'up', 4, 140);
    C.remove(mc);
    clubNote(C);
  }
  async function clubTalk(C, n, k) {
    const c = CLUBS[k], X = S(...c.who);
    C.faceEach(n);
    if (C.flag('c5club_' + k)) { await C.talk(c.after.map(([en, zh]) => X(en, zh))); return; }
    let ok = false;
    await C.talk(c.hi.map(([en, zh]) => X(en, zh)).concat([
      L.ask(X, c.q[0], '听一听，选出合适的回答，再大声说出来。', c.q[1], c.q[2], {
        pass: () => { ok = true; return [X(c.ok[0], c.ok[1])]; },
        fail: () => [X('Hmm, listen again. You can say: "' + c.q[1] + '"', '嗯……再听一遍。可以这样回答：“' + c.q[1] + '”')],
      }),
    ]));
    if (!ok) return;
    C.set('c5club_' + k);
    C.E.SFX.win();
    C.E.toast('🏷️ 得到了' + c.zh + '的贴纸！', 'gold');
    const got = clubN(C);
    clubNote(C);
    if (got >= 3) await C.talk([nar('You have three club stickers! Go to the big tent.', '三个社团贴纸都集齐了！去中间的大帐篷参加才艺表演吧。', '🏷️')]);
  }
  // 才艺表演：对手想合唱 → 嘘声团弄坏音响、抢走水晶 → 打败团员 → 清唱 → 全场鼓掌
  async function show5(C) {
    const R = C.rivalInfo(), RV = S(R.name, R.look, R.g), B = S('MC Bobo', 'clown', 'm');
    const mc = C.npc(n => n.id === 'mc');
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: 5, y: 3, face: 'down', id: 'rival5' });
    await C.walkPlayer('up', 5);
    if (!C.flag('c5hush')) {
      if (mc) C.faceEach(mc);
      await C.talk([
        B('Ladies and gentlemen! Welcome to the Talent Show!', '女士们、先生们！欢迎来到才艺表演！'),
        B('Our next singer is... {name}!', '下一位歌手是……{name}！'),
      ]);
      await C.alert(r);
      await C.walk(r, 'down', 1, 160);
      C.faceEach(r);
      await C.talk([
        RV('{name}! You are in the show, too? Let\'s sing together!', '{name}！你也来表演？我们一起唱吧！'),
        L.ask(RV, 'Can you sing, {name}?', '{rival} 问你会不会唱歌。', 'Yes, I can!', ["No, I don't.", 'Yes, it is.'], {
          pass: () => [RV('Me too! We can be a great team!', '我也会！我们会是很棒的组合！')],
          fail: () => [RV('Ha ha, just say "Yes, I can!"', '哈哈，就说 “Yes, I can!” 嘛！')],
        }),
        B('Music, please!', '音乐，起！'),
      ]);
      C.E.SFX.hit();
      const g1 = C.spawn({ look: LK.grunt, name: 'Hush Grunt', g: 'm', x: 2, y: 2, face: 'right' });
      const g2 = C.spawn({ look: LK.gruntF, name: 'Hush Grunt', g: 'f', x: 12, y: 2, face: 'left' });
      await C.talk([nar('BANG! The music stopped. Someone broke the speakers!', '砰！音乐停了，有人把音响弄坏了！', '💥')]);
      await C.alert(g1);
      const G1 = S('Hush Grunt', 'grunt', 'm'), G2 = S('Hush Grunt', 'gruntF', 'f');
      await C.talk([
        G1('Shh! No more noise on this island!', '嘘！这座岛上不许再吵了！'),
        G2('And the Club Crystal is ours now! Hee hee!', '社团水晶现在归我们了！嘻嘻！'),
        RV('Hey! Give it back! I will stop her. {name}, you stop him!', '喂！还回来！我去拦住她。{name}，你对付他！'),
      ]);
      await C.walk(r, 'right', 4, 140);
      await C.walk(g1, 'down', 2, 160);
      const res = await L.hushFight(C, g1, 'grunt', { lines: [['Singing is too loud! Shh!', '唱歌太吵了！嘘！']], types: ['dark', 'ghost'], n: 2 });
      if (res !== 'win') return;
      C.remove(g1); C.remove(g2);
      C.set('c5hush');
      await C.talk([nar('The grunts dropped the Club Crystal and ran away!', '团员们丢下社团水晶逃跑了！', '💨')]);
    }
    C.faceEach(r);
    await C.talk([
      B('Oh no... The speakers are still broken. No music, no show...', '哎呀……音响还是坏的。没有音乐，表演开不成了……'),
      RV("Wait! We don't need speakers. We can sing without music!", '等等！我们不需要音响，我们可以清唱！'),
      RV('Sing with me, {name}! Say every word loud and clear!', '跟我一起唱，{name}！每个词都要唱得响亮清楚！'),
      L.speak(C, 'I can sing, you can dance!', '唱第一句：我会唱歌，你会跳舞！'),
      RV('We can play the drums! Boom, boom, boom!', '我们会打鼓！咚、咚、咚！'),
      L.speak(C, 'Come on, everyone! Join the club!', '唱第二句：大家快来，加入社团吧！'),
      Object.assign(nar('Everyone is clapping and singing along!', '全场都在鼓掌，大家一起跟着唱！', '👏'), { onShow: () => { C.E.SFX.win(); C.E.confetti(160); } }),
    ]);
    await L.restoreCrystal(C, 5);
    await C.talk([
      B('What a show! You and {rival} are the stars tonight!', '多精彩的表演！你和 {rival} 是今晚的明星！'),
      RV('That was fun! I will go to Clock Island next. See you, {name}!', '真好玩！我接下来要去作息岛。回头见，{name}！'),
      B('Oh, the strongman on the beach wants to meet you. He saw your show!', '对了，沙滩边的大力士想见你，他看了你们的表演！'),
    ]);
    await C.walk(r, 'down', 6, 130);
    C.remove(r);
  }
  async function mc5(C, n) {
    const B = S('MC Bobo', 'clown', 'm');
    C.faceEach(n);
    if (C.flag('ch5')) { await C.talk([B('What a great show! Come back any time!', '多棒的表演！欢迎随时再来！'), B('Can you say it with me? "We can sing and dance together!"', '跟我说一遍：“We can sing and dance together!”'), L.speak(C, 'We can sing and dance together!', '我们可以一起唱歌跳舞！')]); return; }
    await C.talk([B('Get three club stickers, and you can be in the show!', '集齐三个社团贴纸，就能参加表演！'), B('Music, dance and art. Good luck!', '音乐社、舞蹈社、美术社。加油！')]);
  }
  function speaker5(C) {
    return () => C.talk([nar(C.flag('ch5') ? 'The speaker is playing happy music.' : C.flag('c5hush') ? 'The speaker is broken. Nothing comes out.' : 'A big speaker. It is ready for the show.', C.flag('ch5') ? '音响在放欢快的音乐。' : C.flag('c5hush') ? '音响坏了，一点声音都没有。' : '一个大音响，为表演准备好了。', '🔊')]);
  }

  // 道馆：音符地板
  const G5 = [
    { row: 15, band: [13, 14], gate: 12, seq: ['d', 'p'], en: 'Drum, piano!' },
    { row: 11, band: [9, 10], gate: 8, seq: ['g', 'd', 'p'], en: 'Guitar, drum, piano!' },
    { row: 7, band: [4, 6], gate: 3, seq: ['D', 'M', 'S', 'D'], en: 'Do, mi, sol, do!' },
  ];
  const NOTE5 = { d: ['Drum', '🥁'], p: ['Piano', '🎹'], g: ['Guitar', '🎸'], D: ['Do', 'Do'], M: ['Mi', 'Mi'], S: ['Sol', 'Sol'] };
  const g5 = { stage: -1, k: 0, heard: -1 };
  const note5 = (C, s) => C.note('🎵 按顺序踩：' + G5[s].seq.map((c, i) => i < g5.k ? '<b>' + NOTE5[c][1] + '</b>' : '❓').join(' → ') + '　<small>对着左边的喇叭按 A 再听一遍</small>');
  async function cast5(C, s) {
    g5.heard = s; g5.stage = s; g5.k = 0;
    await C.talk([
      nar(s === 0 ? 'Welcome to the Music Gym! Listen to the speaker, then step on the notes in order.' : 'Here comes the next song!', s === 0 ? '欢迎来到音乐道馆！仔细听广播，再按顺序踩地上的格子。踩错了就回到起点。' : '下一首歌来了！这一首更长。', '🎵'),
      radio(G5[s].en, '（仔细听！一共 ' + G5[s].seq.length + ' 个，按顺序踩）'),
    ]);
    note5(C, s);
  }
  async function wrong5(C, s, ch) {
    C.E.SFX.bad();
    g5.k = 0;
    await C.talk([nar('Oops! That is the ' + NOTE5[ch][0] + '. Back to the start!', '哎呀，那是 ' + NOTE5[ch][0] + '，踩错了！回到起点重新来。', '🎵')]);
    C.teleport(7, G5[s].row, 'up');
    await C.talk([radio(G5[s].en, '（再听一遍！按顺序踩）')]);
    note5(C, s);
  }
  async function done5(C, s) {
    openRow(C, G5[s].gate, true);
    C.E.confetti(90);
    C.note(null);
    await C.talk([nar(s < 2 ? 'Perfect! The gate is open.' : 'Bravo! All the gates are open. Go and meet Flo!', s < 2 ? '完美！门打开了。' : '太棒了！所有的门都开了，去挑战火烈鸟乐手吧！', '🎶')]);
  }
  function step5(C) {
    const x = C.pl.x, y = C.pl.y;
    const s = G5.findIndex(q => q.row === y);
    if (s >= 0) return !rowOpen(C, G5[s].gate) && g5.heard !== s ? () => cast5(C, s) : null;
    const b = G5.findIndex(q => y >= q.band[0] && y <= q.band[1]);
    if (b < 0 || rowOpen(C, G5[b].gate)) return null;
    const ch = C.over(x, y);
    if (!NOTE5[ch]) return null;
    if (g5.stage !== b) { g5.stage = b; g5.k = 0; }
    const q = G5[b];
    if (ch !== q.seq[g5.k]) return () => wrong5(C, b, ch);
    g5.k++;
    C.E.say(NOTE5[ch][0]);
    C.E.SFX.ok(1);
    note5(C, b);
    return g5.k >= q.seq.length ? () => done5(C, b) : null;
  }
  function tile5(C, f) {
    const s = f.x === 2 ? G5.findIndex(q => q.row === f.y) : -1;
    if (s < 0) return () => C.talk([nar('A golden music note statue.', '一座金色的音符雕像。', '🎵')]);
    if (rowOpen(C, G5[s].gate)) return () => C.talk([nar('The song is over. The gate is open.', '这一首已经唱完了，门开着。', '🔊')]);
    return () => C.talk([radio(G5[s].en, '（再听一遍！按顺序踩）')]).then(() => { g5.heard = s; note5(C, s); });
  }

  ST.isle(5, {
    busy: ['The Club Crystal is gone! No music, no fun. I cannot battle now.', '社团水晶不见了！没有音乐，一点都不好玩，我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't5') { if (!C.flag('c5intro')) return () => intro5(C); if (!C.flag('ch5') && clubN(C) < 3) return () => clubNote(C); return null; }
      if (id === 'i5A' && C.flag('c5intro') && clubN(C) >= 3 && !C.flag('ch5')) return () => show5(C);
      if (id === 'i5G') { g5.stage = -1; g5.k = 0; g5.heard = -1; }
      return null;
    },
    step(C) { return C.map.id === 'i5G' ? step5(C) : null; },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't5' && CLUBS[n.tag]) return () => clubTalk(C, n, n.tag);
      if (id === 'i5A' && n.id === 'mc') return () => mc5(C, n);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 'i5G' && f.statue) return tile5(C, f);
      if (C.map.id === 'i5A' && f.statue) return speaker5(C);
      return null;
    },
  });

  // ---------- 第 6 岛：钟楼停了 ----------
  const RISE = {
    baker: { who: ['Baker Bun', 'chef', 'm'], zh: '面包师', v: '5:00', en: "I get up at five o'clock every day.",
      hi: [['Good morning! Or is it good evening? My bread is late!', '早上好！还是晚上好？我的面包都做晚了！']], more: ['I make bread for the whole town before six!', '六点以前我要为全镇做好面包！'],
      lost: [['Zzz... Is it night? Is it morning? I don\'t know!', '呼……现在是晚上？还是早上？我也不知道！']] },
    student: { who: ['Student Lucy', 'studentF', 'f'], zh: '学生', v: '6:30', en: 'I usually get up at half past six.',
      hi: [['Hi! School starts at eight. But what time is it now?', '嗨！学校八点上课。可现在几点了？']], more: ['Then I have breakfast and go to school.', '然后我吃早饭、去上学。'],
      lost: [["It's time for dinner... or breakfast? I'm so confused!", '现在该吃晚饭……还是早饭？我都糊涂了！']] },
    mayor: { who: ['Mayor Tick', 'grandpa', 'm'], zh: '镇长', v: '7:00', en: "I always get up at seven o'clock.",
      hi: [['I am the mayor. I am never late!', '我是镇长，我从不迟到！']], more: ['Then I open the town hall at eight.', '然后八点打开镇政府的大门。'],
      lost: [['Our clock tower stopped! Please go to the tower!', '我们的钟楼停了！请快去钟楼看看！']] },
  };
  const askN = C => Object.keys(RISE).filter(k => C.flag('c6ask_' + k)).length;
  const askNote = C => C.note('⏰ 问起床时间 <b>' + askN(C) + '/3</b>　' + Object.keys(RISE).map(k => RISE[k].zh + (C.flag('c6ask_' + k) ? '✅' : '⬜')).join(' '));
  // 画一个小钟面（选项里用）
  function clockSVG(v) {
    const [h, mm] = v.split(':').map(Number), rad = d => (d - 90) * Math.PI / 180;
    const ha = rad(((h % 12) + mm / 60) * 30), ma = rad(mm * 6), f = n => n.toFixed(1);
    let ticks = '';
    for (let k = 0; k < 12; k++) { const t = rad(k * 30); ticks += '<circle cx="' + f(24 + Math.cos(t) * 18) + '" cy="' + f(24 + Math.sin(t) * 18) + '" r="' + (k % 3 ? 1.1 : 2) + '" fill="#37474f"/>'; }
    return '<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#fffdf5" stroke="#b8862b" stroke-width="3"/>' + ticks +
      '<line x1="24" y1="24" x2="' + f(24 + Math.cos(ha) * 10) + '" y2="' + f(24 + Math.sin(ha) * 10) + '" stroke="#37474f" stroke-width="3.6" stroke-linecap="round"/>' +
      '<line x1="24" y1="24" x2="' + f(24 + Math.cos(ma) * 16) + '" y2="' + f(24 + Math.sin(ma) * 16) + '" stroke="#e53935" stroke-width="2.2" stroke-linecap="round"/><circle cx="24" cy="24" r="2.6" fill="#37474f"/></svg>';
  }
  const clockCard = v => '<span class="c6clk" data-v="' + v + '" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">' + clockSVG(v) + '<b>' + v + '</b></span>';

  // 一上岛：妈妈打电话 → 发现大钟不走了
  async function call6(C) {
    await C.wait(300);
    C.E.SFX.tap();
    await C.talk([
      nar('Ring, ring! Mom is calling!', '📞 叮铃铃！妈妈打电话来了！', '📞'),
      L.mom("Hi, {name}! It's Mom. How are you?", '喂，{name}！我是妈妈。你还好吗？'),
      L.mom('Are you sleeping well on your trip?', '出门在外，睡得好吗？'),
      L.ask(L.mom, 'What time do you go to bed?', '妈妈问你几点睡觉。选一个回答，再大声说出来。', 'At half past nine.', ["It's Monday.", 'By bus.'], {
        pass: () => [L.mom('Good! Early to bed, early to rise!', '很好！早睡早起身体好！')],
        fail: () => [L.mom('Hmm? Tell me a time, like "At half past nine."', '嗯？要说一个时间，比如 “At half past nine.”（九点半。）')],
      }),
      L.mom("Don't forget to eat breakfast every day. Love you!", '别忘了每天吃早饭哦。妈妈爱你！'),
      nar('Wait... Listen. The big clock in the square is not ticking!', '等等……你听，广场上的大钟不走了！', '⏰'),
    ]);
    const pl = C.pl, T = S('Mr. Bell', 'teacher', 'm');
    const t = C.spawn({ look: LK.teacher, name: 'Mr. Bell', g: 'm', x: pl.x + 3, y: pl.y, face: 'left' });
    await C.alert(t);
    await C.walk(t, 'left', 2, 160);
    C.faceEach(t);
    await C.talk([
      T('Oh, a trainer! Help! Our clock tower stopped!', '啊，是训练师！救命！我们的钟楼停了！'),
      T('Nobody knows the time. The baker is sleeping at noon!', '谁都不知道现在几点。面包师大中午的还在睡觉！'),
      T('And the students are eating dinner at breakfast time!', '学生们在早饭时间吃晚饭！'),
      T('I saw Team Hush go into the clock tower. Please help us!', '我看见嘘声团进了钟楼。请你帮帮我们！'),
    ]);
    C.set('c6call');
    await C.walk(t, 'right', 4, 130);
    C.remove(t);
  }
  // 钟楼里：团员 → 钟楼管理员请你去问三个人几点起床
  async function tower6(C) {
    const k = C.npc(n => n.id === 'keeper'), K = S('Keeper Tock', 'grandpa', 'm'), G = S('Hush Grunt', 'gruntF', 'f');
    const g = C.spawn({ look: LK.gruntF, name: 'Hush Grunt', g: 'f', x: 5, y: 2, face: 'down' });
    await C.walkPlayer('up', 3);
    await C.alert(g);
    await C.walk(g, 'down', 2, 160);
    const res = await L.hushFight(C, g, 'gruntF', { lines: [['Shh! I stopped the clock. No time, no bells, no noise!', '嘘！钟是我弄停的。没有时间，没有钟声，也就没有吵闹！'], ['Nobody gets up, nobody talks. Perfect!', '谁都不起床，谁都不说话。完美！']], types: ['dark', 'steel'], n: 2, win: false });
    if (res !== 'win') return;
    await C.talk([G('Shh... fine! But I mixed up the bells. Nobody knows the right time now!', '嘘……算你赢！不过钟声已经被我弄乱了，现在谁都不知道正确的时间！')]);
    await C.walk(g, 'left', 3, 120);
    C.remove(g);
    C.set('c6grunt');
    if (k) C.faceEach(k);
    await C.talk([
      K('Thank you, young trainer! I am Tock, the clock keeper.', '谢谢你，小训练师！我叫托克，是钟楼的管理员。'),
      K('Every morning, the tower rings a bell to wake people up.', '每天早上，钟楼都会敲钟叫大家起床。'),
      K('The baker, the students and the mayor all get up at different times.', '面包师、学生和镇长起床的时间都不一样。'),
      K('But that grunt mixed up my bells, and I forgot the times!', '可是那个团员把钟声弄乱了，我连时间都忘了！'),
      K('Please ask them: "What time do you get up?"', '请你去问问他们：“What time do you get up?”（你几点起床？）'),
      K('Remember their answers. Then come back and set the big clock.', '记住他们的回答，再回来把大钟拨好。'),
    ]);
    askNote(C);
  }
  async function rise6(C, n, k) {
    const r = RISE[k], X = S(...r.who);
    C.faceEach(n);
    if (!C.flag('c6grunt')) { await C.talk(r.lost.map(([en, zh]) => X(en, zh))); return; }
    if (C.flag('ch6')) { await C.talk([X(r.en, '我' + ({ '5:00': '五点', '6:30': '六点半', '7:00': '七点' })[r.v] + '起床。钟楼好了，大家又能准时起床了！'), X('Thank you for fixing the clock!', '谢谢你修好了钟楼！')]); return; }
    await C.talk(r.hi.map(([en, zh]) => X(en, zh)).concat([
      L.speak(C, 'What time do you get up?', '问问' + r.zh + '：你几点起床？'),
      Object.assign(X(r.en, '（仔细听！' + r.zh + '几点起床？记住这个时间，点喇叭可以再听一遍）'), { hideEn: true }),
      X(r.more[0], r.more[1]),
    ]));
    C.set('c6ask_' + k);
    askNote(C);
    if (askN(C) >= 3) await C.talk([nar('You asked everyone! Go back to the clock tower and set the big clock.', '三个人都问过了！回钟楼把大钟拨好吧。', '⏰')]);
  }
  // 拨钟：每个人几点起床，选对了钟声就调好
  async function setClock6(C) {
    const K = S('Keeper Tock', 'grandpa', 'm'), vals = ['5:00', '6:30', '7:00'];
    await C.talk([K('You are back! Now, let\'s set the bells.', '你回来了！我们来调钟声吧。')]);
    for (const k of Object.keys(RISE)) {
      const r = RISE[k];
      let ok = false;
      await C.talk([Object.assign(K('When does the ' + ({ baker: 'baker', student: 'student', mayor: 'mayor' })[k] + ' get up?', r.zh + '几点起床？把钟拨到那个时间。'), {
        kind: 'choice', opts: vals.map(v => ({ html: clockCard(v) })), pick: i => { ok = vals[i] === r.v; return []; },
      })]);
      if (!ok) {
        C.E.SFX.bad();
        await C.talk([K("Hmm, that's not right. Go and ask again!", '嗯……好像不对。再去问问' + r.zh + '吧！')]);
        C.E.S.world.flags['s:c6ask_' + k] = 0;
        delete C.E.S.world.flags['s:c6ask_' + k];
        C.E.save();
        return;
      }
      C.E.SFX.ok(2);
      await C.talk([nar('Ding! The bell for the ' + k + ' is set.', '叮！' + r.zh + '的起床钟声调好了。', '🔔')]);
    }
    await C.talk([
      Object.assign(nar('Tick, tock! The clock tower is working again!', '滴答滴答！钟楼又走起来了！', '⏰'), { onShow: () => C.E.SFX.win() }),
      nar("Ding, dong! Ding, dong! It's seven o'clock!", '叮咚！叮咚！七点了！', '🔔'),
      K('Listen! People are getting up. The town is waking up!', '听！大家都起床了，小镇醒过来了！'),
      nar('Look! Something is shining in the gears... It is the Clock Crystal!', '看！齿轮里有东西在发光……是时钟水晶！', '💎'),
    ]);
    await L.restoreCrystal(C, 6);
    await C.talk([
      K('Thank you so much! Oh, and a boy with green hair was looking for you.', '太感谢你了！对了，有个绿头发的男孩在找你。'),
      K('He is at the foot of Clock Mountain.', '他就在钟山脚下。'),
    ]);
  }
  async function keeper6(C, n) {
    const K = S('Keeper Tock', 'grandpa', 'm');
    C.faceEach(n);
    if (C.flag('ch6')) { await C.talk([K('The clock is right on time. Tick, tock!', '钟走得准准的。滴答，滴答！'), K('Remember: early to bed, early to rise!', '记住：早睡早起！')]); return; }
    if (askN(C) >= 3) return setClock6(C);
    await C.talk([K('Please ask the baker, the student and the mayor: "What time do you get up?"', '请你去问面包师、学生和镇长：“What time do you get up?”'), K('Then come back and set the big clock.', '然后回来把大钟拨好。')]);
    askNote(C);
  }
  function tile6A(C, f) {
    if (f.y === 1 && !C.flag('ch6') && C.flag('c6grunt') && askN(C) >= 3) return () => setClock6(C);
    if (f.y === 1) return () => C.talk([nar(C.flag('ch6') ? 'The big clock is ticking. It is on time!' : 'The big clock has stopped.', C.flag('ch6') ? '大钟滴答滴答地走着，时间正好！' : '大钟停住了，一动也不动。', '🕰️')]);
    return () => C.talk([nar('Big gears. Click, clack!', '好大的齿轮。咔嗒，咔嗒！', '⚙️')]);
  }
  // 小凯：在钟山脚下等你，想和你比一场
  async function kai6(C, n) {
    const K = S('Kai', 'kai', 'm');
    C.faceEach(n);
    if (C.flag('kai6')) { await C.talk([K('I train every day now. I get up at six!', '我现在每天都训练，六点就起床！'), K('One day, I will climb Clock Mountain, too!', '总有一天，我也要爬上钟山！')]); return; }
    let go = false;
    await C.talk([
      K("{name}! It's me, Kai! Remember?", '{name}！是我，小凯！还记得我吗？'),
      K('I get up at six every day and train with my monsters.', '我每天六点起床，和怪兽们一起训练。'),
      K('I want to climb Clock Mountain, too. But I need seven badges...', '我也想爬钟山，可是要 7 枚徽章……'),
      L.ask(K, 'Can we have a battle? I want to see how strong I am now!', '小凯想和你比一场。你怎么回答？', "Sure! Let's battle!", ["No, I can't swim.", "It's seven o'clock."], {
        pass: () => { go = true; return []; },
        fail: () => [K('Ha ha, what? OK, maybe next time!', '哈哈，你说什么呀？好吧，下次再比！')],
      }),
    ]);
    if (!go) return;
    const res = await C.battle('trainer', { foes: C.MG.teamOf(['grass', 'bug', 'normal'], 3, C.MG.zoneLv(6) + 1, 'kai6'), trainer: { name: 'Kai', img: C.portrait(LK.kai) }, noWhiteout: true });
    if (res === 'lose') C.MG.healAll();
    await C.talk([
      K(res === 'win' ? 'Wow... You are still so strong!' : 'I won? I really won!', res === 'win' ? '哇……你还是这么厉害！' : '我赢了？我真的赢了！'),
      K('I will keep training. One day, I will be as strong as you!', '我会继续训练。总有一天，我会和你一样强！'),
    ]);
    C.set('kai6');
  }
  // 钟山山顶：闷雷的静音机器，导师欧瑞帮你；打赢以后炎狮出现
  async function rumble6(C) {
    const pl = C.pl, rb = C.npc(n => n.id === 'rumble6'), O = S('Orion', 'orion', 'm'), R = S('Admin Rumble', 'rumble', 'm');
    const o = C.spawn({ look: LK.orion, name: 'Orion', g: 'm', x: pl.x - 2, y: pl.y + 1, face: 'up', id: 'orion6' });
    await C.talk([O('{name}! Wait!', '{name}！等一下！')]);
    await C.walk(o, 'right', 1, 160);
    C.faceEach(o);
    await C.talk([
      O("It's me, Orion. I study old words and old legends.", '是我，欧瑞。我研究古老的词语和传说。'),
      O('Look over there. That is Rumble, a Team Hush admin!', '你看那边，那是嘘声团的干部——闷雷！'),
    ]);
    if (rb) { C.face(rb, 'down'); await C.alert(rb); }
    await C.talk([
      R('Ha ha! The heat of Clock Mountain is perfect!', '哈哈！钟山的热量正合适！'),
      R("My Silence Machine starts at nine o'clock. Then every island will be quiet!", '我的静音机九点整启动，到时候每座岛都会安静下来！'),
      Object.assign(O("Look at my watch. It's eight fifty now!", '（听欧瑞说现在几点）'), { hideEn: true }),
      L.ask(O, 'What time is it now?', '现在几点？选出来，再说一遍。', "It's eight fifty.", ["It's nine o'clock.", "It's eight fifteen."], {
        fail: () => [O("No, it's eight fifty! We have only ten minutes!", '不对，是八点五十！只剩十分钟了！')],
      }),
      O('We have ten minutes. Tell him to stop!', '只剩十分钟了。快叫他停下！'),
      L.speak(C, 'Stop, Rumble! Turn off the machine!', '对闷雷大喊：住手，闷雷！把机器关掉！'),
    ]);
    if (rb) await C.walk(rb, 'down', Math.max(0, pl.y - rb.y - 1), 150);
    const res = await L.hushFight(C, rb, 'rumble', { lines: [["I'm Rumble! I don't talk, I fight!", '我是闷雷！我不说话，我只对战！']], types: ['fire', 'dark', 'steel'], n: 3, win: false });
    if (res !== 'win') { C.remove(o); return; }
    C.set('c6rumble');
    await C.talk([R("Grr... My machine! Fine, I'm going!", '可恶……我的机器！好吧，我走！'), R('But this is not over. See you on Party Island!', '不过这事没完。生日派对岛见！')]);
    if (rb) { await C.walk(rb, 'right', 5, 110); C.remove(rb); }
    C.E.SFX.hit();
    await C.talk([
      nar('The mountain is shaking...', '山在摇晃……', '🌋'),
      O('The machine made the volcano angry. Look at the crater!', '那台机器惹火山生气了。快看火山口！'),
    ]);
    const lion = C.spawn({ mon: 'flamelion', role: 'legend', x: 18, y: 14, face: 'down' });
    await C.alert(lion);
    await C.talk([
      O("It's Flamelion, the lion of fire! It lives deep in this volcano.", '是炎狮，火之狮王！它住在火山深处。'),
      O('It wants to see your power. Talk to it when you are ready.', '它想看看你的力量。准备好了，就去和它说话。'),
      O('I must go now. The story of Echodrake is not over... See you again!', '我得走了。回声龙的故事还没有结束……后会有期！'),
    ]);
    await C.walk(o, 'down', 3, 130);
    C.remove(o);
  }

  // 道馆：时钟转门
  const CLK6 = [{ x: 2, y: 10 }, { x: 12, y: 7 }, { x: 8, y: 4 }];
  const R6 = [
    { en: "It's three o'clock.", v: '3:00', opts: ['9:00', '3:00', '12:15'] },
    { en: "It's half past six.", v: '6:30', opts: ['6:30', '7:30', '6:00'] },
    { en: "It's a quarter past four.", v: '4:15', opts: ['4:45', '5:15', '4:15'] },
  ];
  const g6 = { r: 0 };
  const note6 = C => C.note('🕰️ 拨钟 <b>' + g6.r + '/3</b>　<small>听广播报时，对着亮着的钟按 A</small>');
  async function round6(C, i) {
    const q = R6[i];
    let ok = false;
    await C.talk([
      { who: 'Rooster Rex', emo: '🐓', en: 'Cock-a-doodle-doo! Listen to the time!', zh: '喔喔喔！听好时间！' },
      Object.assign(radio(q.en, '（仔细听！把钟拨到这个时间）'), { kind: 'choice', opts: q.opts.map(v => ({ html: clockCard(v) })), pick: k => { ok = q.opts[k] === q.v; return []; } }),
    ]);
    if (!ok) {
      C.E.SFX.bad();
      g6.r = 0;
      C.closeGate('all');
      await C.talk([nar('Oh no! Wrong time! The gates turned back.', '哎呀，时间拨错了！门全都转回了原位，回到起点重新来。', '⚙️')]);
      C.teleport(7, 12, 'up');
      note6(C);
      return;
    }
    g6.r = i + 1;
    if (i === 0) C.openGate(2);
    else if (i === 1) { C.closeGate(2); C.openGate(1); }
    else C.openGate('all', true);
    note6(C);
    await C.talk([nar(i < 2 ? 'Tick, tock! The gates are turning...' : 'Ding, dong! All the gates are open! Go and meet Rex!', i < 2 ? '滴答滴答！机关门转动了……去找下一座钟。' : '叮咚！所有的门都打开了！去挑战闹钟公鸡吧！', '⚙️')]);
    if (i === 2) C.note(null);
  }
  function tile6G(C, f) {
    const i = CLK6.findIndex(c => c.x === f.x && c.y === f.y);
    if (i < 0) return () => C.talk([nar('A big golden clock. Tick, tock!', '一座金色的大钟。滴答，滴答！', '🕰️')]);
    if (C.gateOpen(0)) return () => C.talk([nar('The clock is ticking happily.', '钟在开心地走着。门都开着。', '🕰️')]);
    if (i < g6.r) return () => C.talk([nar('You already set this clock.', '这座钟已经拨好了。去找下一座钟！', '🕰️')]);
    if (i > g6.r) return () => C.talk([nar('This clock is not ticking yet.', '这座钟还没有动起来。先去拨前面那座钟。', '🕰️')]);
    return () => round6(C, i);
  }

  ST.isle(6, {
    busy: ["Cock-a-doodle... Nobody knows the time! I can't battle now!", '喔喔……谁都不知道现在几点！我现在没法对战！'],
    enter(C) {
      const id = C.map.id;
      if (id === 't6') { if (!C.flag('c6call')) return () => call6(C); if (C.flag('c6grunt') && !C.flag('ch6')) return () => askNote(C); return null; }
      if (id === 'i6A' && C.flag('c6call') && !C.flag('c6grunt')) return () => tower6(C);
      if (id === 'i6G') { g6.r = 0; if (!C.gateOpen(0)) return () => note6(C); return null; }
      if (id === 'd6b') {
        C.filter('sepia(.28) saturate(1.2)');
        if (!C.flag('c6rumble') && !C.npc(n => n.id === 'rumble6')) return () => { C.spawn({ look: LK.rumble, name: 'Admin Rumble', g: 'm', x: 16, y: 15, face: 'up', id: 'rumble6' }); };
        if (C.flag('c6rumble') && !C.flag('leg:flamelion') && !C.npc(n => n.mon === 'flamelion')) return () => { C.spawn({ mon: 'flamelion', role: 'legend', x: 18, y: 14, face: 'down' }); };
      }
      return null;
    },
    step(C) {
      const id = C.map.id;
      if (id === 'd6b' && !C.flag('c6rumble') && C.pl.y <= 19 && C.pl.x >= 9 && C.pl.x <= 24) return () => rumble6(C);
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't6' && RISE[n.tag]) return () => rise6(C, n, n.tag);
      if (id === 't6' && n.tag === 'kai') return () => kai6(C, n);
      if (id === 'i6A' && n.id === 'keeper') return () => keeper6(C, n);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 'i6G' && f.statue) return tile6G(C, f);
      if (C.map.id === 'i6A' && f.statue) return tile6A(C, f);
      return null;
    },
  });

  // ---------- 第 7 岛：对手的生日派对 ----------
  const BDAY = {
    granny: { who: ['Granny Rose', 'granny', 'f'], zh: '罗丝奶奶', en: 'My birthday is on October 1st.', v: '10月1日', opts: ['10月1日', '10月11日', '1月10日'],
      hi: [['Oh, hello, dear! Are you going to the party?', '哎呀，你好呀，孩子！你也去参加派对吗？']], more: ['I am eighty years old this year!', '我今年八十岁啦！'] },
    amy: { who: ['Amy', 'kidF', 'f'], zh: '艾米', en: 'My birthday is on May 2nd.', v: '5月2日', opts: ['5月12日', '5月2日', '3月2日'],
      hi: [['Hi! I made a card for the party!', '嗨！我给派对做了一张贺卡！']], more: ['I want a new bike for my birthday!', '我生日想要一辆新自行车！'] },
    baker7: { who: ['Baker Sugar', 'chef', 'm'], zh: '蛋糕师', en: "It's on June 12th. I make my own cake!", v: '6月12日', opts: ['6月20日', '7月12日', '6月12日'],
      hi: [['I made a big cake for the party. It has thirteen candles!', '我为派对做了个大蛋糕，插了十三根蜡烛！']], more: ['Would you like some cake later?', '等会儿要来块蛋糕吗？'] },
  };
  const calN = C => Object.keys(BDAY).filter(k => C.flag('c7cal_' + k)).length;
  const calNote = C => C.note('🗓️ 生日日历 <b>' + calN(C) + '/3</b>　' + Object.keys(BDAY).map(k => BDAY[k].zh + (C.flag('c7cal_' + k) ? '✅' : '⬜')).join(' '));

  async function intro7(C) {
    const R = C.rivalInfo(), RV = S(R.name, R.look, R.g), pl = C.pl;
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x, y: pl.y - 4, face: 'down', id: 'rival7' });
    await C.alert(r);
    await C.walk(r, 'down', 3, 150);
    C.faceEach(r);
    await C.talk([
      RV('{name}! You came to Party Island!', '{name}！你来生日派对岛啦！'),
      RV("Guess what? Today is my birthday! I'm thirteen today!", '你猜怎么着？今天是我的生日！我今天十三岁了！'),
      L.ask(RV, 'Today is my birthday!', '{rival} 今天过生日，你该说什么？', 'Happy birthday!', ['Me too!', "You're welcome."], {
        pass: () => [RV('Thank you!', '谢谢你！')],
        fail: () => [RV('Ha ha! You can say "Happy birthday!"', '哈哈！你可以说 “Happy birthday!”（生日快乐！）')],
      }),
      RV('We are having a party at the Cake House. Can you help me?', '我们在蛋糕房子开派对。你能帮我个忙吗？'),
      RV('I want to make a birthday calendar for my friends.', '我想给朋友们做一本生日日历。'),
      RV('Ask Granny Rose, Amy and the cake baker: "When is your birthday?"', '去问罗丝奶奶、艾米和蛋糕师：“When is your birthday?”（你的生日是什么时候？）'),
      RV('Then come to the party!', '问完就来参加派对吧！'),
    ]);
    C.set('c7intro');
    await C.walk(r, 'up', 6, 130);
    C.remove(r);
    calNote(C);
  }
  async function bday7(C, n, k) {
    const b = BDAY[k], X = S(...b.who);
    C.faceEach(n);
    if (!C.flag('c7intro')) { await C.talk(b.hi.map(([en, zh]) => X(en, zh))); return; }
    if (C.flag('c7cal_' + k)) { await C.talk([X(b.en, '我的生日是' + b.v + '。'), X(b.more[0], b.more[1])]); return; }
    let ok = false;
    await C.talk(b.hi.map(([en, zh]) => X(en, zh)).concat([
      L.speak(C, 'When is your birthday?', '问问' + b.zh + '：你的生日是什么时候？'),
      Object.assign(X(b.en, '（仔细听！' + b.zh + '的生日是哪天？选出来写在日历上。点喇叭可以再听）'), {
        hideEn: true, kind: 'choice', opts: b.opts.map(v => ({ html: '<span data-v="' + v + '">🗓️ ' + v + '</span>' })),
        pick: i => { ok = b.opts[i] === b.v; return ok ? [X("Yes! That's my birthday!", '对！那就是我的生日！'), X(b.more[0], b.more[1])] : [X('No, no! Ask me again and listen carefully.', '不对不对！再问我一次，仔细听。')]; },
      }),
    ]));
    if (!ok) return;
    C.set('c7cal_' + k);
    C.E.SFX.ok(3);
    calNote(C);
    if (calN(C) >= 3) await C.talk([nar('The birthday calendar is ready! Go to the Cake House.', '生日日历做好了！去蛋糕房子参加派对吧。', '🎂')]);
  }
  // 派对：闷雷来抢蛋糕里的派对水晶 → 夺回 → 唱生日歌 → 对手第 3 战 → 爸爸的船回来了
  async function party7(C) {
    const R = C.rivalInfo(), RV = S(R.name, R.look, R.g), RB = S('Admin Rumble', 'rumble', 'm');
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: 7, y: 4, face: 'down', id: 'rival7' });
    await C.walkPlayer('up', 4);
    C.faceEach(r);
    if (!C.flag('c7rumble')) {
      await C.talk([
        RV('{name}! Welcome to my party!', '{name}！欢迎来参加我的派对！'),
        RV('Thank you for the birthday calendar. It looks great!', '谢谢你的生日日历，真漂亮！'),
        RV("Now, let's light the candles on the cake!", '现在，我们来点蛋糕上的蜡烛吧！'),
      ]);
      C.E.SFX.hit();
      const rb = C.spawn({ look: LK.rumble, name: 'Admin Rumble', g: 'm', x: 7, y: 10, face: 'up', id: 'rumble7' });
      await C.talk([nar('CRASH! Someone ran into the party!', '哐当！有人冲进了派对！', '💥')]);
      C.facePlayer('down');
      await C.alert(rb);
      await C.walk(rb, 'up', 3, 150);
      await C.talk([
        RB('Ha! I told you. See you on Party Island!', '哈！我说过的——生日派对岛见！'),
        RB('The Party Crystal is inside that cake. Give it to me!', '派对水晶就藏在那个蛋糕里。交出来！'),
        RV('No way! This is my birthday cake!', '想都别想！这是我的生日蛋糕！'),
        L.speak(C, 'Go away, Rumble! This is our party!', '对闷雷说：走开，闷雷！这是我们的派对！'),
      ]);
      const res = await L.hushFight(C, rb, 'rumble', { lines: [['Birthdays are too noisy! No more songs!', '过生日太吵了！不许再唱歌！']], types: ['fire', 'dark', 'poison'], n: 3, lv: 4, win: false });
      if (res !== 'win') return;
      C.set('c7rumble');
      await C.talk([RB('Not again! The boss will be so angry...', '又输了！老大会气坏的……'), RB('Mr. Mute... I am sorry...', '默先生……对不起……')]);
      await C.walk(rb, 'down', 3, 120);
      C.remove(rb);
      await L.restoreCrystal(C, 7);
    }
    C.faceEach(r);
    await C.talk([
      RV("Thank you, {name}! Now it's a real party!", '谢谢你，{name}！现在才是真正的派对！'),
      Object.assign(nar('Everyone sings "Happy Birthday". Now it is your turn!', '大家一起唱《生日快乐》。轮到你祝福了！', '🎂'), { onShow: () => C.E.confetti(120) }),
      L.speak(C, 'Happy birthday, {rival}!', '祝 {rival} 生日快乐！'),
      RV("Thank you! Now I'll make a wish...", '谢谢！现在我要许个愿……'),
      RV('I wish... to have a battle with you! Right now!', '我的愿望是……和你对战一场！就现在！'),
    ]);
    const res = await L.rivalFight(C, 3);
    C.set('rival3');
    await C.talk([
      RV(res === 'win' ? 'You are so strong! Best birthday ever!' : 'Yay! A birthday win!', res === 'win' ? '你太强了！这是我过得最棒的生日！' : '耶！生日这天赢了！'),
      Object.assign(nar('Toot, toot! A big ship is coming into the harbor!', '呜——呜——！一艘大船开进了港口！', '⛴️'), { onShow: () => C.E.SFX.tap() }),
      RV("Look at the captain... {name}, isn't that your dad?!", '你看那个船长……{name}，那不是你爸爸吗？！'),
      RV("Go and see him! I'll save some cake for you.", '快去见他吧！我给你留一块蛋糕。'),
    ]);
    await C.walk(r, 'up', 1, 150);
    C.remove(r);
  }
  // 爸爸：远洋船长，第一次见面，送冲浪
  async function dad7(C, n) {
    const D = S('Dad', 'dad', 'm');
    C.faceEach(n);
    if (C.flag('got_surf')) {
      await C.talk([D('The sea is big, {name}. Be brave and have fun!', '大海很大，{name}。勇敢一点，玩得开心！'), D('With eight badges, you can surf east to Animal Island.', '有了 8 枚徽章，就能往东冲浪去动物岛。'), L.speak(C, "Let's surf!", '我们去冲浪吧！')]);
      return;
    }
    await C.talk([
      D('{name}? Is that you? Wow, you are so tall now!', '{name}？是你吗？哇，你长这么高了！'),
      D('I was at sea for a long, long time. I missed you so much!', '我在海上跑了好久好久的船，好想你！'),
      L.ask(D, 'How old are you now?', '爸爸问你现在几岁了。', "I'm thirteen.", ["I'm fine.", 'In May.'], {
        pass: () => [D('Thirteen! Time flies!', '十三岁了！时间过得真快！')],
        fail: () => [D('Ha ha! You can say "I\'m thirteen."', '哈哈！你可以说 “I\'m thirteen.”（我十三岁。）')],
      }),
      D('And you have so many badges. I am proud of you!', '你还拿了这么多徽章。爸爸真为你骄傲！'),
      D("I have a present for you. It's from the sea.", '我给你带了一份礼物，是从海上带回来的。'),
    ]);
    C.give('hm_surf', 1);
    C.set('got_surf');
    await C.talk([
      nar('You got the Surf HM from Dad!', '你从爸爸那里得到了「冲浪」秘传学习器！', '🌊'),
      D('With eight badges, your water monster can carry you on the sea.', '有了 8 枚徽章，你的水系怪兽就能载着你在海上走。'),
      D('Say it with me: "Let\'s surf!"', '跟我一起说：“Let\'s surf!”'),
      L.speak(C, "Let's surf!", '我们去冲浪吧！'),
      D('Animal Island is to the east. I will stay here at the harbor for a while. Good luck!', '动物岛在东边。我会在港口待一阵子。加油！'),
    ]);
  }

  // 道馆：礼物盒
  const BOX7 = { a: 'May 15th', b: 'March 5th', c: 'May 5th', d: 'October 3rd', e: 'January 12th', f: 'June 21st', g: 'October 13th', h: 'May 25th', i: 'January 21st', j: 'October 30th', k: 'March 15th', l: 'January 1st' };
  const R7 = [{ en: 'My birthday is May 5th.', box: 'c' }, { en: 'My birthday is October 13th.', box: 'g' }, { en: 'My birthday is January 21st.', box: 'i' }];
  const g7 = { r: 0 };
  const note7 = C => C.note('🎁 找生日礼物盒 <b>' + g7.r + '/3</b>　<small>踩上写着那天的盒子；对着墙边的喇叭按 A 再听一遍</small>');
  function reset7(C) {
    const d = C.map.def.over;
    let ch = false;
    d.forEach((row, y) => [...row].forEach((c, x) => { if (C.over(x, y) !== c) { C.setOver(x, y, c); ch = true; } }));
    if (ch) C.refresh();
  }
  async function cast7(C) {
    const PF = (en, zh) => ({ who: 'Puffy', emo: '🐡', en, zh });
    await C.talk([
      PF("Welcome to my Birthday Gym! It's party time!", '欢迎来到我的生日道馆！派对时间到！'),
      PF('Listen to my friends. Step on the gift box with their birthday on it!', '听我的朋友说自己的生日，踩上写着那天的礼物盒。开错了会跳出训练师哦！'),
      radio(R7[g7.r].en, '（仔细听：他的生日是几月几日？）'),
    ]);
    note7(C);
  }
  // 礼物盒占上下两格：踩到哪一格都算打开这个盒子
  const markBox = (C, x, y, ch, mark) => { const y0 = ch === ch.toLowerCase() ? y : y - 1; C.setOver(x, y0, mark); C.setOver(x, y0 + 1, mark); C.refresh(); };
  async function open7(C, ch) {
    const x = C.pl.x, y = C.pl.y, q = R7[g7.r], box = ch.toLowerCase();
    if (box === q.box) {
      markBox(C, x, y, ch, 'x'); C.E.SFX.win();
      g7.r++;
      note7(C);
      if (g7.r >= R7.length) {
        openRow(C, 3, true);
        C.E.confetti(140);
        C.note(null);
        await C.talk([nar('Surprise! This is the right box!', '惊喜！就是这个盒子！', '🎉'), nar('Three right boxes! The gate is open. Go and meet Puffy!', '三个盒子都找对了！门打开了，去挑战河豚派对王吧！', '🎁')]);
        return;
      }
      await C.talk([nar("Surprise! It's the right box! There is a party hat inside.", '惊喜！就是这个盒子！里面有一顶派对帽。', '🎉'), radio(R7[g7.r].en, '（下一位：仔细听，他的生日是几月几日？）')]);
      return;
    }
    markBox(C, x, y, ch, 'y'); C.E.SFX.hit();
    const t = C.spawn({ look: LK.clown, name: 'Party Clown', g: 'm', x: x + 1, y, face: 'left' }), PC = S('Party Clown', 'clown', 'm');
    C.faceEach(t);
    await C.talk([nar("POP! It's the wrong box! A trainer jumps out!", '砰！盒子开错了！里面跳出一个训练师！', '🎉'), PC('Surprise! My birthday is on ' + BOX7[box] + '. Let\'s battle!', '惊喜！我的生日是这个盒子上的日子。来对战吧！')]);
    const res = await C.battle('trainer', { foes: C.MG.teamOf(['normal', 'fire', 'water'], 1, C.MG.zoneLv(7) + 1, 'box7' + box), trainer: { name: 'Party Clown', img: C.portrait(LK.clown) } });
    C.remove(t);
    if (res !== 'win') return;
    await C.talk([PC('You win! Listen carefully and find the right box!', '你赢了！仔细听，找对的盒子！'), radio(q.en, '（再听一遍：生日是几月几日？）')]);
  }
  function step7(C) {
    if (rowOpen(C, 3)) return null;
    const ch = C.over(C.pl.x, C.pl.y);
    return ch && BOX7[ch.toLowerCase()] ? () => open7(C, ch) : null;
  }
  function tile7(C, f) {
    if (f.y === 10 && !rowOpen(C, 3)) return () => C.talk([radio(R7[g7.r].en, '（再听一遍：生日是几月几日？）')]).then(() => note7(C));
    return () => C.talk([nar('A big golden gift box statue.', '一座金色的礼物盒雕像。', '🎁')]);
  }

  ST.isle(7, {
    busy: ["The party can't start without the Party Crystal!", '没有派对水晶，派对开不起来！'],
    enter(C) {
      const id = C.map.id;
      if (id === 't7') { if (!C.flag('c7intro')) return () => intro7(C); if (!C.flag('c7rumble') && calN(C) < 3) return () => calNote(C); return null; }
      if (id === 'i7A' && calN(C) >= 3 && !C.flag('rival3')) return () => party7(C);
      if (id === 'i7G') { if (rowOpen(C, 3)) return null; g7.r = 0; return () => { reset7(C); return cast7(C); }; }
      return null;
    },
    step(C) { return C.map.id === 'i7G' ? step7(C) : null; },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't7' && BDAY[n.tag]) return () => bday7(C, n, n.tag);
      if (id === 't7' && n.tag === 'dad') return () => dad7(C, n);
      return null;
    },
    tile(C, f) { return C.map.id === 'i7G' && f.statue ? tile7(C, f) : null; },
  });
})();
