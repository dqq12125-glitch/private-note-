// 回声岛 · 第 2–4 温馨家庭岛、校园岛、学科岛（地图、剧情、道馆机关）。写法见 ISLES.md
(function () {
  'use strict';
  const EM = window.EchoMaps, ST = window.EchoStory, L = ST.lib;

  // ======================================================================
  //  造型（配角和路人）
  // ======================================================================
  const LK = {
    farmer: { skin: '#e8b88f', hair: '#5d4037', style: 'short', eye: '#3a2a20', hat: 'straw', shirt: '#e53935', bottom: '#1565c0', shoes: '#6d4c41' },
    farmerF: { skin: '#ffdcc2', hair: '#8d5524', style: 'ponytail', eye: '#3a2a20', hat: 'straw', shirt: '#ffb74d', bottom: '#6d8b3a', skirt: true, shoes: '#6d4c41' },
    tim: { skin: '#ffe0c4', hair: '#8d5524', style: 'spiky', eye: '#2e6fa0', shirt: '#4fc3f7', bottom: '#6d4c41', shoes: '#e53935' },
    // 蒂姆的家人和长得像的人（听描述找人）
    mom2: { skin: '#ffdcc2', hair: '#4e342e', style: 'long', eye: '#5a3a26', shirt: '#e53935', bottom: '#c62828', skirt: true, shoes: '#6d4c41' },
    momB: { skin: '#ffdcc2', hair: '#4e342e', style: 'bob', eye: '#5a3a26', shirt: '#e53935', bottom: '#c62828', skirt: true, shoes: '#6d4c41' },
    momC: { skin: '#ffe1c8', hair: '#6d4c41', style: 'long', eye: '#3d5f96', shirt: '#42a5f5', bottom: '#1e88e5', skirt: true, shoes: '#ffffff' },
    dad2: { skin: '#f1c7a0', hair: '#3e2723', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#43a047', hatLogo: '#ffffff', shirt: '#ffffff', jacket: '#8d6e63', bottom: '#37474f', shoes: '#3e2723', glasses: true },
    dadB: { skin: '#f1c7a0', hair: '#212121', style: 'short', eye: '#3a2a20', shirt: '#ffe082', jacket: '#6d4c41', bottom: '#37474f', shoes: '#3e2723', glasses: true },
    dadC: { skin: '#e8b88f', hair: '#3e2723', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#43a047', hatLogo: '#ffffff', shirt: '#ff8a65', bottom: '#455a64', shoes: '#3e2723' },
    gran2: { skin: '#f6d5bd', hair: '#eeeeee', style: 'bun', eye: '#5a3a26', shirt: '#f48fb1', bottom: '#8e24aa', skirt: true, shoes: '#6d4c41' },
    granB: { skin: '#f6d5bd', hair: '#e0e0e0', style: 'bob', eye: '#5a3a26', shirt: '#90caf9', bottom: '#5c6bc0', skirt: true, shoes: '#6d4c41' },
    grandpa2: { skin: '#efc9a8', hair: '#e0e0e0', style: 'bald', eye: '#3a2a20', hat: 'straw', shirt: '#aed581', bottom: '#5d4037' },
    crow: { skin: '#f1d0b8', hair: '#e8c35a', style: 'spiky', eye: '#3a3a4a', hat: 'straw', shirt: '#8d6e63', jacket: '#e57373', bottom: '#5d4037', shoes: '#3e2723' },
    // 家族树迷宫里的人
    gGran: { skin: '#f6d5bd', hair: '#f5f5f5', style: 'bun', eye: '#5a3a26', shirt: '#b39ddb', bottom: '#5e35b1', skirt: true, glasses: true },
    gGranB: { skin: '#f6d5bd', hair: '#f5f5f5', style: 'bun', eye: '#5a3a26', shirt: '#80cbc4', bottom: '#00897b', skirt: true },
    gAunt: { skin: '#ffe0c8', hair: '#6d4c41', style: 'bun', eye: '#5a3a26', shirt: '#ffcc80', bottom: '#ef6c00', skirt: true, glasses: true },
    gDad: { skin: '#f1c7a0', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#212121', hatLogo: '#ffffff', shirt: '#ffffff', jacket: '#1e88e5', bottom: '#263238' },
    gUncle: { skin: '#e8b88f', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#212121', hatLogo: '#ffffff', shirt: '#ffffff', jacket: '#43a047', bottom: '#263238' },
    gBro: { skin: '#ffdcc2', hair: '#4e342e', style: 'spiky', eye: '#3a2a20', shirt: '#ffffff', jacket: '#1e88e5', bottom: '#455a64' },
    gSis: { skin: '#ffe0c4', hair: '#5d4037', style: 'pigtails', eye: '#6a3fa0', shirt: '#f48fb1', bottom: '#ec407a', skirt: true, shoes: '#ffffff' },
    gCousin: { skin: '#ffe0c4', hair: '#5d4037', style: 'pigtails', eye: '#6a3fa0', shirt: '#ffeb3b', bottom: '#fbc02d', skirt: true, shoes: '#ffffff' },
    gBigSis: { skin: '#ffe1c8', hair: '#5d4037', style: 'ponytail', eye: '#6a3fa0', shirt: '#f48fb1', bottom: '#ec407a', skirt: true, shoes: '#ffffff' },
    // 校园岛
    bell: { skin: '#ffe0c8', hair: '#6d4c41', style: 'bob', eye: '#3a2a20', shirt: '#ffffff', jacket: '#e57373', bottom: '#455a64', skirt: true, glasses: true, shoes: '#5d4037' },
    libr: { skin: '#ffe0c8', hair: '#bdbdbd', style: 'bun', eye: '#3a2a20', shirt: '#a5d6a7', coat: '#6d4c41', bottom: '#4e342e', skirt: true, glasses: true },
    coach: { skin: '#e0a878', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#1e88e5', shirt: '#ffeb3b', jacket: '#1e88e5', bottom: '#1e88e5', shoes: '#ffffff' },
    // 学科岛
    nova: { skin: '#ffe0c8', hair: '#f06292', style: 'ponytail', eye: '#6a1b9a', shirt: '#e1bee7', coat: '#ffffff', bottom: '#455a64', skirt: true, glasses: true },
    sailor: { skin: '#e8b88f', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#ffffff', hatLogo: '#1565c0', shirt: '#ffffff', jacket: '#1565c0', bottom: '#0d47a1' },
  };

  // ======================================================================
  //  第 2 岛 · 温馨家庭岛（farm：农田、篱笆、风车、小河、木屋茅草顶）
  // ======================================================================
  EM.define('t2', {
    kind: 'town', z: 2, name: '温馨家庭岛', en: 'Family Island', sub: '第 3 岛',
    rows: [
      '#################^^#################',
      '#TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTT#',
      '#TTTTTTTTTTTTTTTTnTTTTTTTTTTTTTTTTT#',
      '#T.T.T.T.T.TAAA..=...fffffffffffff.#',
      '#....o......AAA..=...fFF.F.EEE.FFf.#',
      '#T.T.T.T.T.TAaA..=...fFFZF.EEE.FFf.#',
      '#.....*..........=...fFF.F.EEE.FFf.#',
      '#T.T.T.T.T.T.=====...fFF.F...o.FFf.#',
      '#................=...ffffff.ffffff.#',
      '#................==================>',
      '#TT.............B=.................#',
      '#~~~~~=~~~~~~~~~~=~~~~~~~~~~~~~~~~~#',
      '#~~~~~=~~~~~~~~~~=~~~~~~~~~~~~~~~~~#',
      '#................=.................#',
      '#.GGGGG..........=..CCCC...MMMM....#',
      '#.GGGGG..........=..CCCC...MMMM....#',
      '#.GGGGG..........=..CcCC...MMmM....#',
      '#.GGgGG..........=...=.......=.....#',
      '#...=............=...=.......=.....#',
      '#...===========================....#',
      '#.............Z..=.................#',
      '#.HHHH...........=......JJJ........#',
      '#.HHHH..HHHH.....=......JJJ........#',
      '#.HhHH..HHHH.....=......JjJ........#',
      '#..=....HHhH.....=.......=.........#',
      '#..=......=......==================>',
      '#..===============..fffffff........#',
      '#................=..fFFFFFf..EEEE..#',
      '#~~~~~...........=..fFF.FFf..EEEE..#',
      '#~~o~~~..........=..fFFFFFf..EEEE..#',
      '#~~~~~~..........=..fff.fff........#',
      '#~~~~~...........=.................#',
      '#TT............B.=.......o.........#',
      '#TTT..FF.........=..........*....TT#',
      '#TTTT.FFF........=.............TTTT#',
      '#################vv#################',
    ],
    styles: { E: 'windmill' },
    markKinds: ['scarecrow', 'fountain'],
    marks: [
      [['A scarecrow in the field.', '田里的稻草人。'], ['It keeps the birds away.', '它能把鸟赶走。']],
      [['An old well. Tim\'s family meets here.', '一口老井。蒂姆一家常在这里碰头。']],
    ],
    signs: [
      ['Family Island. Family comes first!', '温馨家庭岛。家人最重要！'],
      ['North: Route 3. A small tree blocks the road.', '往北：3 号路。路口有一棵小树挡着。'],
    ],
    items: ['potion', 'superball', 'revive', 'antidote'],
    hiddenItems: ['superpotion', 'rope'],
    links: { s: 'r1', n: 'r2', e: ['r2e', 'r2e'] },
    people: [
      // 走丢的小男孩蒂姆（井边）
      { id: 'tim', x: 15, y: 21, face: 'down', name: 'Tim', g: 'm', look: LK.tim, role: 'story' },
      // 找到以后，家人来到井边
      { id: 'timMom', x: 14, y: 21, face: 'right', name: "Tim's Mom", g: 'f', look: LK.mom2, role: 'story', showIf: 'f2mom' },
      { id: 'timDad', x: 16, y: 21, face: 'left', name: "Tim's Dad", g: 'm', look: LK.dad2, role: 'story', showIf: 'f2dad' },
      { id: 'timGran', x: 15, y: 22, face: 'up', name: "Tim's Grandma", g: 'f', look: LK.gran2, role: 'story', showIf: 'f2gran' },
      // 听描述找人：对的人（找到后回到井边）和长得像的人
      { id: 'mom', fam: 'mom', real: true, x: 25, y: 18, face: 'down', name: 'Lady in Red', g: 'f', look: LK.mom2, role: 'story', hideIf: 'f2mom',
        say: [['Team Hush took the Family Crystal! I can\'t find my son!', '嘘声团偷走了家庭水晶！我找不到我儿子了！']] },
      { id: 'momB', fam: 'mom', x: 32, y: 21, face: 'left', name: 'Mrs Brown', g: 'f', look: LK.momB, role: 'story',
        no: ['Sorry, I\'m not his mom. I have short hair.', '抱歉，我不是他妈妈。我是短头发。'],
        say: [['I have two daughters. They are at school now.', '我有两个女儿，她们现在在学校。']], speak: 'I have two daughters.' },
      { id: 'momC', fam: 'mom', x: 7, y: 20, face: 'down', name: 'Mrs Green', g: 'f', look: LK.momC, role: 'story',
        no: ['No, I\'m not. Look, my dress is blue, not red.', '不，我不是。你看，我的裙子是蓝色的，不是红色的。'],
        say: [['This is my home. My family has five people.', '这是我家。我家有五口人。']], speak: 'My family has five people.' },
      { id: 'dad', fam: 'dad', real: true, x: 7, y: 29, face: 'left', name: 'Man with a Cap', g: 'm', look: LK.dad2, role: 'story', hideIf: 'f2dad',
        say: [['I was fishing, and my son ran away!', '我刚才在钓鱼，我儿子就跑不见了！']] },
      { id: 'dadB', fam: 'dad', x: 9, y: 16, face: 'down', name: 'Mr White', g: 'm', look: LK.dadB, role: 'story',
        no: ['No, I\'m not. I have glasses, but I don\'t have a cap.', '不，我不是。我戴眼镜，可是我没戴帽子。'],
        say: [['My father is a doctor. He works in the big city.', '我爸爸是一名医生，他在大城市工作。']], speak: 'My father is a doctor.' },
      { id: 'dadC', fam: 'dad', x: 23, y: 7, face: 'down', name: 'Farmer Sam', g: 'm', look: LK.dadC, role: 'story',
        no: ['No, I\'m not. I have a green cap, but no glasses.', '不，我不是。我戴绿帽子，可是不戴眼镜。'],
        say: [['I grow corn and carrots with my uncle.', '我和我叔叔一起种玉米和胡萝卜。']], speak: 'I work with my uncle.' },
      { id: 'gran', fam: 'gran', real: true, x: 22, y: 27, face: 'down', name: 'Old Lady', g: 'f', look: LK.gran2, role: 'story', hideIf: 'f2gran',
        say: [['These flowers are so pretty. Where is my grandson?', '这些花真好看。我的小孙子去哪儿了？']] },
      { id: 'granB', fam: 'gran', x: 13, y: 21, face: 'down', name: 'Granny May', g: 'f', look: LK.granB, role: 'story',
        no: ['No, dear. I have white hair, but I love cats, not flowers.', '不是哦，孩子。我头发是白的，可我喜欢猫，不喜欢花。'],
        say: [['These are my grandchildren in the photo.', '照片里这些是我的孙子孙女。']], speak: 'These are my grandchildren.' },
      { id: 'granC', fam: 'gran', x: 24, y: 28, face: 'left', name: 'Grandpa Joe', g: 'm', look: LK.grandpa2, role: 'story',
        no: ['Ha ha! I love flowers, but I\'m a grandpa, not a grandma!', '哈哈！我是喜欢花，可我是爷爷，不是奶奶！'],
        say: [['I love my garden. My grandson helps me every day.', '我爱我的花园。我孙子每天都来帮我。']], speak: 'I love my garden.' },
      // 风车田里「会动的稻草人」：其实是嘘声团员（找齐三位家人以后才出现）
      { id: 'crow', x: 31, y: 6, face: 'down', name: 'Scarecrow?', g: 'm', look: LK.crow, role: 'story', showIf: ['f2mom', 'f2dad', 'f2gran'], hideIf: 'ch2' },
      // 镇上的人
      { id: 'joe', x: 30, y: 10, face: 'left', name: 'Farmer Joe', g: 'm', look: LK.farmer, role: 'talk',
        say: [['Look at my windmill! My grandfather built it.', '看我的风车！是我爷爷建的。'], ['This is my family\'s farm.', '这是我们家的农场。']], speak: 'This is my family\'s farm.' },
      { id: 'quiz', x: 11, y: 13, face: 'down', role: 'quiz' },
      { id: 'kid', x: 29, y: 32, face: 'up', name: 'Little Lucy', g: 'f', look: 'kidF', role: 'talk',
        say: [['I have a little brother. He is a baby!', '我有一个弟弟，他还是个小宝宝！'], ['Do you have a brother?', '你有兄弟吗？']], speak: 'I have a little brother.' },
    ],
  });
  // 树医生的小木屋（送居合斩）
  EM.define('i2A', {
    kind: 'inside', z: 2, room: 'A', name: '树医生的小屋', en: "Tree Doctor's Hut", sub: '温馨家庭岛',
    rows: [
      'WWWWWWWWW',
      'Wkkp_pkkW',
      'W_______W',
      'W_YY____W',
      'W_YY____W',
      'Wp_____pW',
      'W___u___W',
      'WWWWeWWWW',
    ],
    links: { e: 't2' },
    people: [
      { id: 'doc0', x: 6, y: 3, face: 'down', name: 'Tree Doctor', g: 'm', look: 'treedoc', role: 'talk', hideIf: 'ch2',
        say: [['I\'m the Tree Doctor. I take care of the trees on this island.', '我是树医生，我照顾这座岛上的树。'], ['Team Hush took the Family Crystal. Everyone is sad.', '嘘声团偷走了家庭水晶，大家都很难过。'], ['Please help little Tim at the well first.', '请先去井边帮帮小蒂姆吧。']] },
      { id: 'doc', x: 6, y: 3, face: 'down', name: 'Tree Doctor', g: 'm', look: 'treedoc', role: 'talk', showIf: 'ch2',
        give: { item: 'hm_cut', flag: 'got_cut',
          say: [['You saved the Family Crystal! Thank you!', '你夺回了家庭水晶！谢谢你！'], ['Take this. It is the HM for Cut.', '这个送给你，它是「居合斩」的秘传学习器。']],
          after: [['A small tree blocks the road to Route 3.', '去 3 号路的路口有一棵小树挡着。'], ['With three badges, your monster can cut it.', '有了三枚徽章，你的怪兽就能把它砍掉。'], ['Beat Granny Turtle at the Gym first!', '先去道馆打败海龟奶奶吧！']] },
        say: [['Trees are like a family. They grow up together.', '树就像一家人，它们一起长大。'], ['Cut only the small trees on the road, OK?', '只砍路上的小树哦，好吗？']], speak: 'Trees are like a family.' },
    ],
  });

  // 道馆「家族树迷宫」：三间花盆迷宫，按描述找到奶奶、爸爸、妹妹，对应的机关门才开
  // 机关门从上往下编号：0 通馆主（妹妹），1 通第三间（爸爸），2 通第二间（奶奶）
  EM.define('i2G', { markKinds: ['statue', 'statue', 'photo', 'photo', 'photo'],
    kind: 'inside', z: 2, room: 'G', name: '温馨家庭岛道馆', en: 'Family Gym', sub: '家族树迷宫',
    rows: [
      'WWWWWWWWWWWWWWWWW',
      'WZ_____________ZW',
      'W_______________W',
      'W___uuuuuuuuu___W',
      'W_______________W',
      'WWWWWWWW|WWWWWWWW',
      'W______p___p____W',
      'W_pp_p_p_p_p_pp_W',
      'W____p_____p__Z_W',
      'W_pp___ppp___pp_W',
      'W_____p___p_____W',
      'WWWW|WWWWWWWWWWWW',
      'W_______p_______W',
      'W_ppp_p___p_ppp_W',
      'W_Z___p_p_p_____W',
      'W_pp_pp_p_pp_pp_W',
      'W_______p_______W',
      'WWWWWWWWWWWW|WWWW',
      'W_______________W',
      'W_pp_ppp_ppp_pp_W',
      'W_Z____p____p___W',
      'W__pp___p_pp__p_W',
      'W_______u_______W',
      'WWWWWWWWeWWWWWWWW',
    ],
    links: { e: 't2' },
    people: [
      { id: 'leader', role: 'leader', x: 8, y: 2, face: 'down', name: 'Granny Turtle', g: 'f', look: { skin: '#f6d5bd', hair: '#f5f5f5', style: 'bun', eye: '#2e7d32', shirt: '#a5d6a7', coat: '#2e7d32', bottom: '#1b5e20', skirt: true, glasses: true, shoes: '#5d4037' } },
      // 第一间：找奶奶（白头发、戴眼镜）
      { id: 'g1', fam: 'gran', ok: true, x: 14, y: 20, face: 'left', name: 'Lady A', g: 'f', look: LK.gGran, role: 'story' },
      { id: 'g1b', fam: 'gran', x: 4, y: 20, face: 'down', name: 'Lady B', g: 'f', look: LK.gGranB, role: 'story',
        no: ['No, I\'m not. I\'m Granny\'s best friend. Look, I don\'t have glasses!', '不，我不是。我是奶奶最好的朋友。你看，我没戴眼镜！'] },
      { id: 'g1c', x: 6, y: 18, face: 'down', name: 'Aunt Rosa', g: 'f', look: LK.gAunt, role: 'trainer', sight: 1, types: ['water', 'normal'], n: 2,
        lines: [['Are you looking for the grandma? I\'m the aunt! I have glasses, but my hair is brown!', '你在找奶奶吗？我是阿姨！我戴眼镜，可是我的头发是棕色的！']],
        win: ['The grandma has white hair, dear.', '奶奶的头发是白的哦。'], after: [['I\'m the aunt. My mother is the grandma!', '我是阿姨。我妈妈就是奶奶！']] },
      // 第二间：找爸爸（黑帽子、蓝外套）
      { id: 'g2', fam: 'dad', ok: true, x: 14, y: 14, face: 'left', name: 'Man A', g: 'm', look: LK.gDad, role: 'story' },
      { id: 'g2b', fam: 'dad', x: 1, y: 16, face: 'right', name: 'Boy B', g: 'm', look: LK.gBro, role: 'story',
        no: ['No, I\'m not the dad. I\'m the brother! I don\'t have a cap.', '不，我不是爸爸，我是哥哥！我没有帽子。'] },
      { id: 'g2c', x: 7, y: 13, face: 'down', name: 'Uncle Leo', g: 'm', look: LK.gUncle, role: 'trainer', sight: 1, types: ['ground', 'normal'], n: 2,
        lines: [['The dad? No, I\'m the uncle! My jacket is green!', '爸爸？不，我是叔叔！我的外套是绿色的！']],
        win: ['The dad has a blue jacket.', '爸爸穿蓝外套。'], after: [['I\'m the uncle. The dad is my brother.', '我是叔叔，爸爸是我哥哥。']] },
      // 第三间：找妹妹（两条小辫子、粉裙子）
      { id: 'g3', fam: 'sis', ok: true, x: 2, y: 6, face: 'down', name: 'Girl A', g: 'f', look: LK.gSis, role: 'story' },
      { id: 'g3b', fam: 'sis', x: 15, y: 10, face: 'left', name: 'Girl B', g: 'f', look: LK.gBigSis, role: 'story',
        no: ['No, I\'m the big sister. I have a ponytail, not pigtails!', '不，我是姐姐。我扎的是马尾，不是两条小辫子！'] },
      { id: 'g3c', x: 12, y: 8, face: 'left', name: 'Cousin Amy', g: 'f', look: LK.gCousin, role: 'trainer', sight: 1, types: ['fairy', 'normal'], n: 2, lv: 1,
        lines: [['I have pigtails too! But I\'m the cousin, and my dress is yellow!', '我也扎两条小辫子！可我是表妹，我的裙子是黄色的！']],
        win: ['The little sister has a pink dress.', '妹妹穿粉色的裙子。'], after: [['I\'m the cousin. My mom is the aunt.', '我是表妹，我妈妈是阿姨。']] },
    ],
  });

  // 农田环路（可选支线：果园、稻田、农夫训练师）
  EM.define('r2e', {
    kind: 'route', z: 2, name: '农田环路', en: 'Farm Loop', sub: '温馨家庭岛东边',
    rows: [
      '##############################',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTTTT#',
      '#TT.T.T.T.T.TT..,,,,,,,,,,oTT#',
      '#T.............,,,,,,,,,,,..T#',
      '<====.T.T.T.T.T,,,,,1,,,,,..T#',
      '#T..........,,,,,,,,,,,,,,..T#',
      '#TT.T.T.T.T.T..,,,,,,,,,,,..T#',
      '#T..*.........,,,,,,,,,,,,..T#',
      '#TTTTnTTTTTTT.....2......,..T#',
      '#T..o..TTTTTLLLLLLLLLLLLL...T#',
      '#T.....TTTTT.............==.T#',
      '#TTTTTTTTTTT..,,,,~,,,,,,.=.T#',
      '#TT,,,,,,TTT..,,,,~,,,,,,.=.T#',
      '#TT,,,,,,,.==============.=.T#',
      '#TT,,3,,,,.=..~~~~~~~~~~..=.T#',
      '#TT,,,,,,,.=..~~~~o~~~~~..=.T#',
      '#TTT......,=,,,,,,,,,,4,,,=.T#',
      '#T~~~~~...,=,,,,,,,,,,,,,,=.T#',
      '#T~~~~~~..,=..............=.T#',
      '#T.~~~....,=..TTTTTT..5...=.T#',
      '#T..*.....,=..TTTTTT......=.T#',
      '#TT.......,=..............=.T#',
      '#TT..,,,,.,================.T#',
      '#T...,,,,.,=.............B..T#',
      '<===========...FFFF..o......T#',
      '#TT......,,,,,,,,,...FF....TT#',
      '#TTT.....,,,,,,,,,,.......TTT#',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTTTT#',
      '##############################',
    ],
    signs: [['Farm Loop. Apples, rice and happy farmers!', '农田环路：苹果、稻田和快乐的农夫！']],
    items: ['superball', 'leafstone', 'superpotion', 'potion'],
    hiddenItems: ['revive', 'repel'],
    links: { w: ['t2', 't2'] },
    npc: {
      1: { role: 'trainer', name: 'Farmer Ben', look: LK.farmer, g: 'm', face: 'left', sight: 4, under: ',', types: ['grass', 'normal'], n: 2,
        lines: [['My family grows apples. Let\'s battle!', '我们家种苹果。来对战吧！']], win: ['Wow! You\'re as strong as my big brother!', '哇！你和我哥哥一样厉害！'], after: [['My brother and I pick apples every autumn.', '每年秋天我和哥哥一起摘苹果。']] },
      2: { role: 'trainer', name: 'Farmer Rose', look: LK.farmerF, g: 'f', face: 'down', sight: 3, types: ['grass', 'bug'], n: 2,
        lines: [['Who is he? Oh, he\'s my father. And I\'m a trainer!', '他是谁？哦，他是我爸爸。而我是训练师！']], win: ['My father will laugh at me!', '我爸爸要笑话我了！'], after: [['My father is a farmer. My mother is a teacher.', '我爸爸是农民，我妈妈是老师。']] },
      3: { role: 'trainer', name: 'Cousin Kim', look: 'kidF', g: 'f', face: 'right', sight: 4, under: ',', types: ['bug', 'normal'], n: 2, lv: 1,
        lines: [['My cousins and I play here every day!', '我和表兄弟姐妹们每天都在这里玩！']], win: ['I\'ll tell my cousins about you!', '我要告诉我的表兄弟姐妹们你有多厉害！'], after: [['Those are my cousins over there.', '那边那些是我的表兄弟姐妹。']] },
      4: { role: 'trainer', name: 'Uncle Bob', look: 'hiker', g: 'm', face: 'left', sight: 5, under: ',', types: ['water', 'grass'], n: 2, lv: 1,
        lines: [['I\'m Kim\'s uncle. Show me your monsters!', '我是小金的叔叔。给我看看你的怪兽！']], win: ['You are good! Is your father a trainer too?', '你真棒！你爸爸也是训练师吗？'], after: [['My brother has three children. I am their uncle.', '我哥哥有三个孩子，我是他们的叔叔。']] },
      5: { role: 'trainer', name: 'Aunt Mary', look: LK.farmerF, g: 'f', face: 'down', sight: 3, types: ['normal', 'flying'], n: 2, lv: 1,
        lines: [['How many people are there in your family?', '你家有几口人？'], ['Tell me after our battle!', '对战完再告诉我吧！']], win: ['There are four people in my family. And you beat us all!', '我家有四口人，你把我们都打败了！'], after: [['My sister is Kim\'s mother. I\'m Kim\'s aunt.', '我姐姐是小金的妈妈，我是小金的阿姨。']] },
    },
  });

  // 3 号路：t2 → t3，对手在路中间第二次对战
  EM.define('r2', {
    kind: 'route', z: 2, name: '3 号路', en: 'Route 3', sub: '温馨家庭岛 → 校园岛',
    rows: [
      '###########^^###########',
      '#TTTTTTTTTT..TTTTTTTTTT#',
      '#TT,,,,,TT.==.TT..o..TT#',
      '#TT,,*,,TT.==.TT.....TT#',
      '#TT,,,o,TTB==..........#',
      '#TT,,,,,TT.==....1....T#',
      '#TT,,,,,TT.==.........T#',
      '#TTTTnTTTT.==..TTTTTT.T#',
      '#T....,,,..==..TTTTTT.T#',
      '#T,,,,,,,..==....,,,,.T#',
      '#T,,,2,,,..==....,,,,.T#',
      '#T,,,,,,,..==..,,,,,,.T#',
      '#TTTTTT....==....,,,,.T#',
      '#TTTTTT....==..........#',
      '#TTTTTTTTf.==.fTTTTTTTT#',
      '#FF.FF.FFf.==.fT.T.T.T.#',
      '#FFFFFFFFf.==.f.T.T.T.T#',
      '#FF.FF.FFf.==.fT.T.T.T.#',
      '#FFFFFFFFf.==.f.T.T.T.T#',
      '#ffffffff..==..ffffffff#',
      '#~~~~~~....==........,,#',
      '#~~~~~~~3..==....,,,,,,#',
      '#~~~o~~~...==....,,,,,,#',
      '#~~~~~~....==.....,,,,,#',
      '#ffffffff..==..ffffff*,#',
      '#FFFFFFFFf.==.fFFFFFFTT#',
      '#FF.FF.FFf.==.fFF.FF.FF#',
      '#FFFFFFFFf.==.fFFFFFFFF#',
      '#TTTTTTTTf.==.fTTTTTTTT#',
      '#T,,,,,....==....,,,,,T#',
      '#T,,4,,....==....,,,,,T#',
      '#T,,,,,,...==...,,,,,,T#',
      '#TLLLLLLLL.==.LLLLLLLLT#',
      '#T.o.......==.........T#',
      '#TT........==....5....T#',
      '#TTT.....,,==,,......TT#',
      '#TTT..,,,,,==,,,,,..TTT#',
      '#~~~~~~~~~~==~~~~~~~~~~#',
      '#~~~~~~~~~~==~~~~~~~~~~#',
      '#..,,,,....==....,,,,..#',
      '#.,,,,,,...==...,,,,,,.#',
      '#.,,,,,,...==...,,,,,,.#',
      '#.......TT.==.TT.......#',
      '#..F...TTT.==.TTT...F..#',
      '#.FFF..TT..==..TT..FFF.#',
      '#..F....B..==......F..*#',
      '#TT........==........TT#',
      '#TTT.......==.......TTT#',
      '###########vv###########',
    ],
    signs: [
      ['Campus Island is just ahead!', '前面就是校园岛了！'],
      ['Route 3. North: Campus Island.', '3 号路。往北走是校园岛。'],
    ],
    items: ['superball', 'potion', 'waterstone', 'repel'],
    hiddenItems: ['superpotion', 'antidote', 'potion'],
    links: { n: 't3', s: 't2' },
    npc: {
      1: { role: 'trainer', name: 'Student Tony', look: 'student', g: 'm', face: 'left', sight: 4, types: ['normal', 'bug'], n: 2, lv: 1,
        lines: [['I\'m going to Campus Island. My school is there!', '我要去校园岛，我的学校在那里！']], win: ['I need to study more!', '我得多学习了！'], after: [['There is a big playground in our school.', '我们学校有一个大操场。']] },
      2: { role: 'trainer', name: 'Twin Ann', look: 'kidF', g: 'f', face: 'right', sight: 3, under: ',', types: ['grass', 'normal'], n: 2,
        lines: [['I have a twin sister. Can you find her?', '我有一个双胞胎妹妹。你能找到她吗？']], win: ['My sister is better than me!', '我妹妹比我厉害！'], after: [['My sister is on the other side of the river.', '我妹妹在河的另一边。']] },
      3: { role: 'trainer', name: 'Fisher Pete', look: 'fisher', g: 'm', face: 'right', sight: 4, types: ['water'], n: 2, lv: 1,
        lines: [['My son and I fish here every Sunday!', '我和我儿子每个星期天都在这里钓鱼！']], win: ['My son will laugh at me!', '我儿子要笑话我了！'], after: [['My son is twelve. He likes fishing too.', '我儿子十二岁，他也喜欢钓鱼。']] },
      4: { role: 'trainer', name: 'Twin Amy', look: 'kidF', g: 'f', face: 'right', sight: 4, under: ',', types: ['grass', 'normal'], n: 2,
        lines: [['I\'m Ann\'s twin sister! We look the same!', '我是安的双胞胎妹妹！我们长得一模一样！']], win: ['You beat both of us!', '你把我们俩都打败了！'], after: [['Ann is my sister. We are twelve.', '安是我姐姐，我们十二岁。']] },
      5: { role: 'trainer', name: 'Grandpa Tom', look: 'grandpa', g: 'm', face: 'left', sight: 4, types: ['normal', 'ground'], n: 2, lv: 2,
        lines: [['These are my grandchildren\'s monsters. Be careful!', '这些是我孙子孙女的怪兽。小心哦！']], win: ['Ho ho! You are a great trainer!', '呵呵！你是个了不起的训练师！'], after: [['I have five grandchildren. They all love monsters.', '我有五个孙子孙女，他们都喜欢怪兽。']] },
    },
  });

  // ======================================================================
  //  第 3 岛 · 校园岛（school：操场跑道、红砖教学楼、钟楼）
  // ======================================================================
  EM.define('t3', {
    kind: 'town', z: 3, name: '校园岛', en: 'Campus Island', sub: '第 4 岛',
    rows: [
      '######################################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RRRRRRRRRRRRRRRRRKRRRRRRRRRRRRRRRRRR#',
      '#TT.....o......TT==TT.............TTT#',
      '#T..FFFF........T==T...............TT#',
      '#T.AAAAAAAAA.....T==T..============..#',
      '#T.AAAAAAAAA.....T==T.=............=.#',
      '#T.AAAAAAAAA.....T==T.=.f........f.=.#',
      '#T.AAAAaAAAA..Z..T==T.=.f........f.=.#',
      '#T.....=..........==..=............=.#',
      '#T.....================............=.#',
      '#T...............T==T.=............=.#',
      '#T.CCCC..MMMM....T==T.=............=.#',
      '#T.CCCC..MMMM....T==T.=............=.#',
      '#T.CcCC..MmMM....T==T..============..#',
      '#T..=.....=.......==.................#',
      '<====================================#',
      '#T..=.............==.................#',
      '#T.........FFFF...==......GGGGG.....T#',
      '#T.........FFFF...==......GGGGG.....T#',
      '#T..HHHH...FFFF...==......GGGGG.....T#',
      '#T..HHHH..........==......GGgGG.....T#',
      '#T..HhHH..........==........=.......T#',
      '#T...=....HHHH....==........=.JJJ...T#',
      '#T...=====HHHH....==........=.JJJ...T#',
      '#T.......=HHhH....==..........JjJ...T#',
      '#T.......=..=.....==...........=....T#',
      '#T.......=========================..T#',
      '#T.FFF...~~~~.....==.......FFF....o.T#',
      '#T.......~~~~~....==...........*....T#',
      '#T.......~~~......==..............TTT#',
      '#TT...............==...............TT#',
      '#TTT.FF.........B.==..........FF..TTT#',
      '#TTTT.............==.............TTTT#',
      '##################vv##################',
    ],
    markKinds: ['bell'],
    marks: [[['The school bell. Ding-dong!', '学校的钟。叮咚！'], ['It rings at eight every morning.', '每天早上八点它就会响。']]],
    signs: [['Welcome to Campus Island! Welcome to my school!', '欢迎来到校园岛！欢迎来到我的学校！']],
    items: ['superpotion', 'superball'],
    hiddenItems: ['revive'],
    links: { s: 'r2', w: 'r3m', K: 'c3' },
    doors: { A: 'i3A' },
    people: [
      // 矿工：剧情做完才送碎岩（之前在洞口发愁）
      { id: 'miner0', x: 22, y: 4, face: 'left', name: 'Miner Max', g: 'm', look: 'miner', role: 'talk', hideIf: 'ch3',
        say: [['The tunnel to Subject Island is full of cracked rocks.', '去学科岛的隧道里全是裂开的大石头。'], ['I can\'t work with Team Hush in the school!', '嘘声团在学校里捣乱，我没法干活！']] },
      { id: 'miner', x: 22, y: 4, face: 'left', name: 'Miner Max', g: 'm', look: 'miner', role: 'talk', showIf: 'ch3',
        give: { item: 'hm_smash', flag: 'got_smash',
          say: [['You saved the school! You are a hero!', '你救了学校！你是个英雄！'], ['Take this. It is the HM for Rock Smash.', '这个送给你，它是「碎岩」的秘传学习器。']],
          after: [['With four badges, your monster can smash cracked rocks.', '有了四枚徽章，你的怪兽就能打碎有裂缝的岩石。'], ['The tunnel is right behind me. Good luck!', '隧道就在我身后。祝你好运！']] },
        say: [['Smash the cracked rocks in the tunnel, and go north!', '打碎隧道里的裂石，一直往北走！']], speak: 'Smash the rock!' },
      { id: 'kai', x: 28, y: 12, face: 'down', name: 'Kai', g: 'm', look: 'kai', role: 'story', hideIf: 'kai3' },
      { id: 'bell', x: 9, y: 10, face: 'down', name: 'Ms Bell', g: 'f', look: LK.bell, role: 'talk',
        say: [['I\'m Ms Bell, the English teacher.', '我是贝尔老师，教英语的。'], ['Our classroom is on the second floor.', '我们的教室在二楼。']], speak: 'Our classroom is on the second floor.' },
      { id: 'coach', x: 34, y: 16, face: 'left', name: 'Coach Lee', g: 'm', look: LK.coach, role: 'talk',
        say: [['The gym is across from the library.', '体育馆在图书馆对面。'], ['Run on the track every morning!', '每天早上都来跑道上跑步吧！']], speak: 'The gym is across from the library.' },
      { id: 'q3', x: 14, y: 17, face: 'down', role: 'quiz' },
      { id: 'st1', x: 22, y: 26, face: 'down', name: 'Student Lily', g: 'f', look: 'studentF', role: 'talk',
        say: [['There are forty desks in my classroom.', '我的教室里有四十张课桌。'], ['How many desks are there in your classroom?', '你的教室里有多少张课桌？']], speak: 'There are forty desks in my classroom.' },
    ],
  });

  // 校园岛教学楼 1 楼（剧情：问路找低语）
  EM.define('i3A', {
    kind: 'inside', z: 3, room: 'J', name: '教学楼 1 楼', en: 'School 1F', sub: '校园岛',
    rows: [
      'WWWWWWWWWWWWWWWWWWWWWWWWW',
      'Wkkkkkkk_W_YY__YY_W____kW',
      'W_______kW________W_P_Y_W',
      'W_YY_YY__W_YY__YY_W_____W',
      'W_YY_YY__W________W_QQQ_W',
      'W________W_YY__YY_W____pW',
      'WWWW_WWWWWWWWW_WWWWWW_WWW',
      'W_______________________W',
      'Wp_____________________%W',
      'W_______________________W',
      'WWWW_WWWWWW_WWWWWWW_WWWWW',
      'W_YY_YY_W_____W___P_P_P_W',
      'W_______W_____W_________W',
      'W_YY_YY_W_____W___P_P_P_W',
      'Wk______W_____W_________W',
      'W_______W_____W________pW',
      'WWWWWWWWWWWeWWWWWWWWWWWWW',
    ],
    over: [
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '...LI........DH......OF..',
      '.........................',
      '...Cl.....EN.......Pc....',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
    ],
    paint: {
      L: { c: '#ffe082', t: 'LIBRARY' }, I: { c: '#ffe082', t: '📚' },
      D: { c: '#ffccbc', t: 'DINING' }, H: { c: '#ffccbc', t: 'HALL' },
      O: { c: '#c5cae9', t: 'OFFICE' }, F: { c: '#c5cae9', t: '🗄️' },
      C: { c: '#c8e6c9', t: 'CLASS' }, l: { c: '#c8e6c9', t: '1A' },
      E: { c: '#fff9c4', t: 'EXIT' }, N: { c: '#fff9c4', t: '↓' },
      P: { c: '#b3e5fc', t: 'COMPUTER' }, c: { c: '#b3e5fc', t: '💻' },
    },
    links: { e: 't3', '%': 'i3A2' },
    people: [
      { id: 'amy', x: 9, y: 8, face: 'down', name: 'Student Amy', g: 'f', look: 'studentF', role: 'story' },
      { id: 'libr', x: 4, y: 2, face: 'down', name: 'Librarian Mrs Page', g: 'f', look: LK.libr, role: 'story' },
      { id: 'cook', x: 13, y: 2, face: 'down', name: 'Cook Dan', g: 'm', look: 'chef', role: 'talk',
        say: [['Welcome to the dining hall! Lunch is at twelve.', '欢迎来到食堂！十二点开饭。'], ['The library is next to the dining hall.', '图书馆就在食堂旁边。']], speak: 'The library is next to the dining hall.' },
      { id: 'head', x: 22, y: 3, face: 'down', name: 'Mr Grey', g: 'm', look: 'teacher', role: 'talk',
        say: [['This is the office. I\'m Mr Grey.', '这里是办公室。我是格雷老师。'], ['Is there a lab in your school?', '你的学校有实验室吗？'], ['Ours is on the second floor.', '我们的在二楼。']], speak: 'Is there a lab in your school?' },
      { id: 'st2', x: 5, y: 12, face: 'up', name: 'Student Ben', g: 'm', look: 'student', role: 'talk',
        say: [['This is Class 1A. I sit next to the window.', '这是 1A 班。我坐在窗户旁边。']], speak: 'This is my classroom.' },
      { id: 'st3', x: 20, y: 12, face: 'up', name: 'Student Joy', g: 'f', look: 'kidF', role: 'talk',
        say: [['This is the computer room. There are six computers.', '这是电脑室，这里有六台电脑。']], speak: 'There are six computers.' },
    ],
  });
  // 教学楼 2 楼：实验室、音乐教室、五班
  EM.define('i3A2', { markKinds: ['board'],
    kind: 'inside', z: 3, room: 'J', name: '教学楼 2 楼', en: 'School 2F', sub: '校园岛',
    rows: [
      'WWWWWWWWWWWWWWWWWWWWWWWWW',
      'W_Z_____W_P_P__YY_W_Y_Y_W',
      'W_______W_________W_____W',
      'W_Y_Y_Y_W_YY__P_P_W_Y_Y_W',
      'W_______W_________W_____W',
      'W_Y_Y_Y_W_________W_____W',
      'WWWW_WWWWWWWW_WWWWWWW_WWW',
      'W_______________________W',
      'Wp_____________________%W',
      'W_______________________W',
      'WWWWWWWWWWWWWWWWWWWWWWWWW',
    ],
    over: [
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '...C5........LA......MU..',
      '.........................',
      '.........................',
      '.........................',
    ],
    paint: {
      C: { c: '#c8e6c9', t: 'CLASS' }, 5: { c: '#c8e6c9', t: '5' },
      L: { c: '#b2ebf2', t: 'LAB' }, A: { c: '#b2ebf2', t: '🔬' },
      M: { c: '#f8bbd0', t: 'MUSIC' }, U: { c: '#f8bbd0', t: '🎵' },
    },
    links: { '%': 'i3A' },
    people: [
      { id: 'sam', x: 16, y: 8, face: 'left', name: 'Student Sam', g: 'm', look: 'student', role: 'story' },
      { id: 'mus', x: 21, y: 2, face: 'down', name: 'Music Teacher', g: 'f', look: 'studentF', role: 'talk',
        say: [['This is the music room. Let\'s sing!', '这是音乐教室。我们来唱歌吧！'], ['The lab is next to the music room.', '实验室就在音乐教室旁边。']], speak: 'The lab is next to the music room.' },
    ],
  });

  // 道馆「教室换座」：三间教室串起来，每间黑板一道题，答对这间的门开，答错回座位
  // 机关门从上往下编号：0 通校长室，1 通第三间，2 通第二间
  EM.define('i3G', { markKinds: ['board', 'board', 'board'],
    kind: 'inside', z: 3, room: 'G', name: '校园岛道馆', en: 'School Gym', sub: '教室换座',
    rows: [
      'WWWWWWWWWWWWWWW',
      'Wk___________kW',
      'W_____________W',
      'W_____uuu_____W',
      'W_____________W',
      'WWWWWWWWWWW|WWW',
      'W__Z__________W',
      'W_____________W',
      'W_Y_Y_Y_Y_Y___W',
      'W_____________W',
      'W_Y_Y_Y_Y_Y___W',
      'W_____________W',
      'WWW|WWWWWWWWWWW',
      'W__________Z__W',
      'W_____________W',
      'W___Y_Y_Y_Y_Y_W',
      'W_____________W',
      'W___Y_Y_Y_Y_Y_W',
      'W_____________W',
      'WWWWWWWWWWW|WWW',
      'W__Z__________W',
      'W_____________W',
      'W_Y_Y_Y_Y_Y___W',
      'W_____________W',
      'W_Y_Y_Y_Y_Y___W',
      'W______u______W',
      'WWWWWWWeWWWWWWW',
    ],
    links: { e: 't3' },
    people: [
      { id: 'leader', role: 'leader', x: 7, y: 2, face: 'down', name: 'Principal Owl', g: 'm', look: { skin: '#f1d0b8', hair: '#9e9e9e', style: 'short', eye: '#6d4c41', shirt: '#ffffff', coat: '#795548', bottom: '#4e342e', glasses: true, shoes: '#3e2723' } },
      { id: 's1', x: 12, y: 23, face: 'left', name: 'Student Nick', g: 'm', look: 'student', role: 'trainer', sight: 2, types: ['steel', 'normal'], n: 2,
        lines: [['No talking in class! Unless it\'s a battle!', '上课不许说话！除非是对战！']], win: ['Oh no, I\'ll be late for class!', '糟了，我上课要迟到了！'], after: [['The answer is on the blackboard. Listen carefully!', '题目在黑板上，仔细听！']] },
      { id: 's2', x: 1, y: 16, face: 'right', name: 'Student Rose', g: 'f', look: 'studentF', role: 'trainer', sight: 2, types: ['psychic', 'bug'], n: 2,
        lines: [['Our school has a big library. Do you like reading?', '我们学校有个大图书馆。你喜欢读书吗？']], win: ['You must read a lot!', '你一定读了很多书！'], after: [['The library is next to the dining hall.', '图书馆在食堂旁边。']] },
      { id: 's3', x: 12, y: 9, face: 'left', name: 'Monitor Jay', g: 'm', look: 'student', role: 'trainer', sight: 2, types: ['steel', 'psychic'], n: 2, lv: 1,
        lines: [['I\'m the class monitor. Sit down, please!', '我是班长。请坐好！']], win: ['OK, OK. You can go!', '好吧好吧，你可以过去了！'], after: [['The principal\'s office is behind this door.', '校长室就在这扇门后面。']] },
    ],
  });

  // 山道（可选：陡坡台阶、登山训练师，山顶有念灵）
  EM.define('r3m', {
    kind: 'route', z: 3, lv: 2, name: '书山小道', en: 'Book Mountain Path', sub: '校园岛西边',
    rows: [
      '############################',
      '#RRRRRRRRRRRRRRRRRRRRRRRRRR#',
      '#RR......Z....RRRRRRRRRRRRR#',
      '#RR..........,RRR..o....RRR#',
      '#RRR.......,,,RRR.......,RR#',
      '#RRRRRRR...,,,..........,,R#',
      '#RRRRRRRR...LLLLLLLRRR.,,,R#',
      '#RR*.,,RR.............,,,,R#',
      '#RR..,,RR...1.........RR..R#',
      '#RR..,,.......RRRRR...RR..R#',
      '#RRLLLLLLL....RRRRR...RR..R#',
      '#RR.......,,,,RRRRRLLLRR..R#',
      '#RR.......,,,,,.........2.R#',
      '#RRRRRR...,,,,,.........,,R#',
      '#RRRRRR....RRRRRRRRR....,,R#',
      '#RR,,,,....RRRRRRRRR.,,,,,R#',
      '#RR,,,,,..........RR.,,,,,R#',
      '#RR,,3,,..........LL.,,,,,R#',
      '#RR,,,,,..rr......RR......R#',
      '#RRRRLLLL...RRRRRRRR...o..R#',
      '#RR.........RRRRRRRR......R#',
      '#RR.....,,,,,,.......RR...R#',
      '#RR.....,,,,,,.......RR...R#',
      '#RRRR...,,,,,,...4...RR.*.R#',
      '#RRRR...,,,,,,.......RRLLLR#',
      '#RRRRRR...........RRRR....R#',
      '#RRRRRR...........RRRR....R#',
      '#RRRRRRRRRR...RRRRRR......R#',
      '#RRRRRRRRRR...RRRRRR..,,,,R#',
      '#TTTTTTTTT,,,,,TTTTT..,,,,T#',
      '#TTTTTTTT..,,,,,......,,,,,#',
      '#TTTTTTTT..,,o,,......,,,,,#',
      '#TTTTTTTTT...........B.....>',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTT#',
      '############################',
    ],
    markKinds: ['stone'],
    marks: [[['An old stone. It says: "Knowledge is power."', '一块古老的石碑，上面写着：“知识就是力量。”'], ['People say a monster that reads minds lives here.', '听说这里住着一只能读懂人心的怪兽。']]],
    signs: [['Book Mountain. Watch your step!', '书山小道。小心脚下！']],
    items: ['superpotion', 'moonstone', 'superball'],
    hiddenItems: ['revive', 'fullheal'],
    links: { e: 't3' },
    npc: {
      1: { role: 'trainer', name: 'Hiker Hank', look: 'hiker', g: 'm', face: 'right', sight: 4, types: ['rock', 'ground'], n: 2, lv: 1,
        lines: [['I climb this mountain after school every day!', '我每天放学后都来爬这座山！']], win: ['My legs are tired now!', '我的腿都累了！'], after: [['The top of the mountain is up there. It is very quiet.', '山顶就在上面，那里很安静。']] },
      2: { role: 'trainer', name: 'Club Leader Zoe', look: 'studentF', g: 'f', face: 'left', sight: 4, types: ['psychic', 'normal'], n: 2, lv: 1,
        lines: [['I\'m in the hiking club at school. Let\'s battle!', '我是学校登山社的。来对战吧！']], win: ['Our club needs a trainer like you!', '我们社团需要你这样的训练师！'], after: [['Our club meets in the gym on Friday.', '我们社团每周五在体育馆集合。']] },
      3: { role: 'trainer', name: 'Hiker Ivan', look: 'hiker', g: 'm', face: 'right', sight: 3, under: ',', types: ['rock', 'fight'], n: 2, lv: 2,
        lines: [['Where is the top? I\'m lost!', '山顶在哪儿？我迷路了！']], win: ['I will find my way. Bye!', '我自己会找到路的。再见！'], after: [['Jump down the ledges. It\'s faster!', '从台阶上跳下去，比较快！']] },
      4: { role: 'trainer', name: 'Student Leo', look: 'student', g: 'm', face: 'up', sight: 3, types: ['bug', 'grass'], n: 2, lv: 1,
        lines: [['I lost my map of the school. Did you see it?', '我把学校地图弄丢了。你看见了吗？']], win: ['Never mind the map!', '地图就算了吧！'], after: [['Our school has a big library.', '我们学校有一个大图书馆。']] },
    },
  });

  // 碎岩隧道：t3 → r3，主路被两块裂石挡住（碎岩，4 枚徽章）
  EM.define('c3', {
    kind: 'cave', cave: 'rock', dark: false, z: 3, lv: 2, name: '碎岩隧道', en: 'Rock Smash Tunnel', sub: '校园岛 → 学科岛',
    rows: [
      'XXXXXXXXXXXXXX^^XXXXXXXXXXXXXX',
      'XXXXXXXXXXXXX::::XXXXXXXXXXXXX',
      'XX:::o:XXXXX::::::XXXX::::*:XX',
      'XX::::::XXX:::r::::XX:::::::XX',
      'XXX::::::::::::::::::::XX:::XX',
      'XXXX::::XXXXX::1:::XXX::::XXXX',
      'XX*:::XXXXXXX:::::XXXX:::XXXXX',
      'XX:::XXXXXXXXX:::XXXXX::o:XXXX',
      'XXX::::XXXXXXX:::XXXXXX::XXXXX',
      'XXXX:::::XXXXX:::XXXXXXXXXXXXX',
      'XXXXXX:::::::::::XXXXXXXXXXXXX',
      'XXXXXXXXXXX:::::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXX:::XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXX::XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXbXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXX:XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXbXXXXXXXXXXXXXXX',
      'XXXXXXXXXX:::::::XXXXXXXXXXXXX',
      'XXX::::XXX::::::::XXXX::::::XX',
      'XX::o::::::::XX::::::::::::XXX',
      'XX::::XXXXXXXXX::2::XXXX:::XXX',
      'XXX::XXXXXXXXXX::::::XXXXbXXXX',
      'XXX::XXXXXX~~~~:::::::XX:::XXX',
      'XXX:::XXXX~~~~~~:::r::XX:o:XXX',
      'XXXX::XXXX~~~~~~::::::XXXXXXXX',
      'XXXX:::XXXX~~~~:::::::::XXXXXX',
      'XXXXX::::XXXXXX:::::XX:::XXXXX',
      'XXXXXX::::::::::::XXXX:3::XXXX',
      'XXXXXXXXXXXXX::::XXXXX::::*XXX',
      'XXXXXXXXXXXXX:::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXX::::XXXXXXXXXXXXXX',
      'XXXXXXXXXXXX:::XXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXeeXXXXXXXXXXXXXXX',
    ],
    items: ['superpotion', 'hardstone', 'revive', 'superball'],
    hiddenItems: ['rope', 'fullheal', 'superpotion'],
    links: { n: 'r3', e: 't3' },
    npc: {
      1: { role: 'trainer', name: 'Miner Gus', look: 'miner', g: 'm', face: 'down', sight: 3, types: ['rock', 'ground'], n: 2, lv: 1,
        lines: [['I dig here every day. Where is my map?', '我每天都在这里挖。我的地图去哪儿了？']], win: ['My map says: "The exit is north."', '我的地图上写着：“出口在北边。”'], after: [['The exit is north. Keep going!', '出口在北边，继续走！']] },
      2: { role: 'trainer', name: 'Miner Rita', look: 'miner', g: 'f', face: 'left', sight: 3, types: ['rock', 'steel'], n: 2, lv: 1,
        lines: [['This tunnel goes from the school to the lab!', '这条隧道从学校一直通到实验室！']], win: ['You are strong like a rock!', '你像石头一样坚强！'], after: [['Cracked rocks? Only Rock Smash can break them.', '裂开的岩石？只有碎岩才能打碎它们。']] },
      3: { role: 'trainer', name: 'Student Dan', look: 'student', g: 'm', face: 'left', sight: 3, types: ['bug', 'rock'], n: 2, lv: 1,
        lines: [['I\'m on a school trip! Our teacher is lost!', '我在春游！我们老师迷路了！']], win: ['Where is my teacher?', '我的老师在哪儿？'], after: [['My teacher is in the library, I think.', '我觉得我的老师在图书馆。']] },
    },
  });

  // 4 号路：c3 → t4
  EM.define('r3', {
    kind: 'route', z: 3, name: '4 号路', en: 'Route 4', sub: '校园岛 → 学科岛',
    rows: [
      '############^^############',
      '#TTTTTTTTTTT==TTTTTTTTTTT#',
      '#TT.....B...==.......,,,T#',
      '#T..,,,,....==......,,,,,#',
      '#T.,,,,,,...==.....,,1,,,#',
      '#T.,,,,,,...==......,,,,,#',
      '#TT..,,.....==...........#',
      '#TTTTTTTT...==...TTTTbTTT#',
      '#T.o..,,T...==...T.....o.#',
      '#T....,,T...==...T.......#',
      '#T*...,,n...==...TTTTTTTT#',
      '#TTTTTTTT...==...........#',
      '#~~~~~~~~...==....2......#',
      '#~~~~~~~~~..==..,,,,,,,,.#',
      '#~~~~o~~~~..==..,,,,,,,,.#',
      '#~~~~~~~~~..==..,,,,,,,,.#',
      '#~~~~~~~~...==...........#',
      '#TT.........==.......TTT.#',
      '#TT...3.....==......TTTT.#',
      '#T,,,,,,....==.......TT..#',
      '#T,,,,,,,...==..........*#',
      '#TLLLLLLLL..==..LLLLLLLLL#',
      '#T..........==...........#',
      '#TT..FF.....==....4......#',
      '#TT.FFFF....==..,,,,,,,,,#',
      '#T...FF.....==..,,,,,,,,,#',
      '#T,,,,,,....==..,,,,,,,,,#',
      '#T,,,,,,,...==...........#',
      '#T,,,,,,,,..==....TTTTTTT#',
      '#TT.........==...TT.....o#',
      '#TTT...5....==...TT......#',
      '#TTTT.......==...........#',
      '#TTTTT......==.....B....T#',
      '#TTTTTTTTTTT==TTTTTTTTTTT#',
      '############vv############',
    ],
    signs: [['Subject Island is just ahead!', '前面就是学科岛了！'], ['Route 4. South: Rock Smash Tunnel.', '4 号路。往南是碎岩隧道。']],
    items: ['potion', 'thunderstone', 'superball', 'superpotion'],
    hiddenItems: ['revive', 'repel'],
    links: { n: 't4', s: 'c3' },
    npc: {
      1: { role: 'trainer', name: 'Scientist Ray', look: 'scientist', g: 'm', face: 'left', sight: 4, under: ',', types: ['spark', 'steel'], n: 2, lv: 1,
        lines: [['I teach science on Subject Island. Science is fun!', '我在学科岛教科学。科学很有趣！']], win: ['That was a good experiment!', '这真是一次不错的实验！'], after: [['My favourite subject is science.', '我最喜欢的科目是科学。']] },
      2: { role: 'trainer', name: 'Student Mia', look: 'studentF', g: 'f', face: 'down', sight: 4, types: ['normal', 'psychic'], n: 2, lv: 1,
        lines: [['We have music on Wednesday. I can\'t wait!', '我们星期三有音乐课，我等不及了！']], win: ['I like music more than battles!', '比起对战，我更喜欢音乐！'], after: [['Why do I like music? Because it\'s relaxing.', '我为什么喜欢音乐？因为它让人放松。']] },
      3: { role: 'trainer', name: 'Artist Paul', look: LK.farmer, g: 'm', face: 'right', sight: 4, types: ['bug', 'fairy'], n: 2, lv: 1,
        lines: [['We have art on Friday. Let me draw your monster!', '我们周五有美术课。让我画画你的怪兽！']], win: ['What a beautiful battle!', '多美的一场对战！'], after: [['Art is my favourite subject.', '美术是我最喜欢的科目。']] },
      4: { role: 'trainer', name: 'Runner Kate', look: 'athlete', g: 'f', face: 'down', sight: 4, types: ['fight', 'normal'], n: 2, lv: 1,
        lines: [['I like PE best! Let\'s go!', '我最喜欢体育课！开始吧！']], win: ['You are faster than me!', '你比我还快！'], after: [['We have PE on Monday and Thursday.', '我们周一和周四有体育课。']] },
      5: { role: 'trainer', name: 'Teacher Wu', look: 'teacher', g: 'm', face: 'right', sight: 4, types: ['psychic', 'steel'], n: 2, lv: 2,
        lines: [['I think maths is difficult. But battles are easy!', '我觉得数学很难，可对战很简单！']], win: ['Hmm, battles are difficult too!', '嗯，对战也挺难的！'], after: [['How many subjects do you have? We have nine.', '你们有几门课？我们有九门。']] },
    },
  });

  // ======================================================================
  //  第 4 岛 · 学科岛（lab：整齐的园区、玻璃圆顶、实验楼、天文台）
  // ======================================================================
  EM.define('t4', {
    kind: 'town', z: 4, name: '学科岛', en: 'Subject Island', sub: '第 5 岛',
    rows: [
      '######################################',
      '#~~~~~~~~~~~~~~~#TTTTTTTTTTRRRRRRRRRR#',
      '#~~~~~~~~~~~~~~~TT...........RAAAAAR.#',
      '#~~~~~~~~~~~~~~~T....Z.......RAAAAAR.#',
      '#~~~~~~=~~~~~~~~T............RAAaAAR.#',
      '#~~~~~~=~~~~~~~~T...T.T.T.T..R..=..R.#',
      '#~~~~~~=~~~~~~~~T............R..=..R.#',
      '#SSSSSS=SSSSSSSST.........RRRR..=....#',
      '#SSSSSS=========================.....#',
      '#SSSSSSSSSS.......=.............Z..Z.#',
      '#T.T.T.T.T.T...AAAAAAA...T.T.T.......#',
      '#..............AAAAAAA...............#',
      '#T.T.T.T.T.T...AAAAAAA...T.T.T.......#',
      '#..............AAAaAAA......CCCC.MMMM#',
      '#...o.............=.........CCCC.MMMM#',
      '#T.T.T.T.T.T......=.........CcCC.MMmM#',
      '#.................=..........=.....=.#',
      '#.................==================.#',
      '#......GGGGG......=..................>',
      '#T.T...GGGGG......=...T.T.T.T.T.T....#',
      '#......GGGGG......=..................#',
      '#T.T...GGgGG......=...T.T.T.T.T.T....#',
      '#........=........=..................#',
      '#........==========..................#',
      '#T.T.T.T......=..........HHHH...T.T..#',
      '#.........HHHH=..........HHHH........#',
      '#T.T.T.T..HHHH=..........HhHH...T.T..#',
      '#.........HhHH=...........=..........#',
      '#...........=.=...........=........*.#',
      '#...........===============..........#',
      '#T.T.T.T.T.T..=....FFFFF.............#',
      '#.............=....FF.FF.....T.T.T.T.#',
      '#T.T.T.T.T.T..=....FFFFF.......o.....#',
      '#.............=......................#',
      '#TTTTTTTTTTTT.=.B...TTTTTTTTTTTTTTTTT#',
      '##################vv##################',
    ],
    markKinds: ['telescope', 'telescope', 'telescope'],
    marks: [
      [['A small telescope. You can see the sea.', '一架小望远镜，可以看到大海。']],
      [['A big satellite dish. It listens to the sky.', '一个大卫星天线，它在“听”天空的声音。']],
      [['Another satellite dish. It is pointing at the stars.', '另一个卫星天线，它对着星星。']],
    ],
    signs: [['Subject Island. Which subject do you like best?', '学科岛。你最喜欢哪一科？']],
    items: ['superpotion', 'thunderstone'],
    hiddenItems: ['revive'],
    links: { s: 'r3', e: 'r4' },
    doors: { A: 'i4A2', A2: 'i4A' },
    start: [7, 7],   // 渡轮从社团岛回来时站在码头上（盖尔船长旁边）
    people: [
      { id: 'gale', x: 7, y: 4, face: 'down', name: 'Captain Gale', g: 'm', look: 'gale', role: 'ferry', to: 't5', badge: 5, toName: '社团岛',
        say: [['Ahoy! I\'m Captain Gale. My ferry goes to Club Island.', '你好呀！我是盖尔船长，我的渡轮开往社团岛。'], ['You have five badges. Welcome aboard!', '你有五枚徽章了，欢迎上船！']],
        no: [['Ahoy! I\'m Captain Gale.', '你好呀！我是盖尔船长。'], ['My ferry goes to Club Island. But the sea is rough.', '我的渡轮开往社团岛，可是海上风浪很大。'], ['Come back with five badges. Then I can take you!', '等你有了五枚徽章再来，我就带你过去！']] },
      { id: 'nova', x: 19, y: 15, face: 'down', name: 'Assistant Nova', g: 'f', look: LK.nova, role: 'story', showIf: 'f4in', hideIf: 'ch4' },
      // 卫星天线旁的嘘声团（摆好书以后才出现）
      { id: 'g4a', x: 34, y: 10, face: 'down', name: 'Hush Grunt', g: 'f', look: L.P.LOOKS.gruntF, role: 'story', showIf: 'f4books', hideIf: 'ch4' },
      { id: 'g4b', x: 35, y: 11, face: 'left', name: 'Hush Grunt', g: 'm', look: L.P.LOOKS.grunt, role: 'story', showIf: 'f4books', hideIf: 'ch4' },
      { id: 'sail', x: 12, y: 8, face: 'down', name: 'Sailor Tim', g: 'm', look: LK.sailor, role: 'talk',
        say: [['The ferry goes to Club Island. It takes one hour.', '渡轮开往社团岛，要坐一个小时。'], ['We have geography on the ship every day!', '我们每天在船上上地理课！']], speak: 'Geography is interesting!' },
      { id: 'q4', x: 24, y: 22, face: 'down', role: 'quiz' },
      { id: 'kidL', x: 5, y: 17, face: 'right', name: 'Student Max', g: 'm', look: 'student', role: 'talk',
        say: [['I think maths is difficult.', '我觉得数学很难。'], ['But my maths teacher is very kind.', '可是我的数学老师很和蔼。']], speak: 'I think maths is difficult.' },
      { id: 'sci', x: 30, y: 27, face: 'left', name: 'Scientist Ivy', g: 'f', look: 'scientist', role: 'talk',
        say: [['History is interesting. Biology is interesting too!', '历史很有趣，生物也很有趣！'], ['Who is your English teacher?', '你的英语老师是谁？']], speak: 'History is interesting.' },
    ],
  });
  // 八爪博士的实验室（按课程表摆书）
  EM.define('i4A', {
    kind: 'inside', z: 4, room: '3', name: '八爪博士的实验室', en: "Doctor Octo's Lab", sub: '学科岛',
    rows: [
      'WWWWWWWWWWWWW',
      'WkkkkkkkkkkkW',
      'W___________W',
      'W_PP_____YY_W',
      'W___________W',
      'W_YY_____P__W',
      'W___________W',
      'Wp____u____pW',
      'W_____u_____W',
      'WWWWWWeWWWWWW',
    ],
    links: { e: 't4' },
    people: [
      { id: 'octo', x: 6, y: 3, face: 'down', name: 'Doctor Octo', g: 'm', look: 'octo', role: 'story', hideIf: 'ch4' },
      { id: 'labA', x: 9, y: 6, face: 'left', name: 'Assistant Nova', g: 'f', look: LK.nova, role: 'talk', showIf: 'ch4',
        say: [['Doctor Octo is waiting for you at the Gym!', '八爪博士在道馆等你！'], ['His favourite subject? All of them!', '他最喜欢哪一科？全都喜欢！']], speak: 'My favourite subject is science.' },
    ],
  });
  // 天文台：导师欧瑞讲传说
  EM.define('i4A2', { markKinds: ['telescope'],
    kind: 'inside', z: 4, room: '2', name: '天文台', en: 'Observatory', sub: '学科岛',
    rows: [
      'WWWWWWWWWWW',
      'Wk___Z___kW',
      'W_________W',
      'W_________W',
      'W_P_____P_W',
      'W_________W',
      'Wp__u_u__pW',
      'W____u____W',
      'WWWWWeWWWWW',
    ],
    links: { e: 't4' },
    people: [
      { id: 'orion', x: 5, y: 3, face: 'down', name: 'Orion', g: 'm', look: 'orion', role: 'story' },
    ],
  });

  // 道馆「课程表开关」：按广播念的课程顺序踩地上的学科开关，踩错全部复位、回起点
  // 机关门从上往下编号：0 通馆主（第二段），1 通第二段（第一段）
  const SUBJ = {
    m: ['Maths', '#ef5350', '数学'], e: ['English', '#42a5f5', '英语'], s: ['Science', '#26a69a', '科学'], u: ['Music', '#ab47bc', '音乐'],
    a: ['Art', '#ff7043', '美术'], p: ['PE', '#8d6e63', '体育'], c: ['Chinese', '#d81b60', '语文'], h: ['History', '#6d4c41', '历史'], g: ['Geography', '#1e88e5', '地理'],
  };
  const paint4 = {};
  Object.entries(SUBJ).forEach(([k, [t, c]]) => { paint4[k] = { c, t, tc: '#ffffff' }; paint4[k.toUpperCase()] = { c: '#fff176', t: '✓ ' + t, tc: '#2e7d32' }; });
  const OVER4 = [
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
    '..h...a...c...g..',
    '.................',
    '....g...p...h....',
    '.................',
    '..c...u...g...a..',
    '.................',
    '.................',
    '.................',
    '..m...e...s...u..',
    '.................',
    '....s...a...m....',
    '.................',
    '..e...p...u...c..',
    '.................',
    '....m.......e....',
    '.................',
    '.................',
    '.................',
  ];
  EM.define('i4G', {
    kind: 'inside', z: 4, room: 'G', name: '学科岛道馆', en: 'Subject Gym', sub: '课程表开关',
    rows: [
      'WWWWWWWWWWWWWWWWW',
      'Wk_____________kW',
      'W_______________W',
      'W____uuuuuuu____W',
      'WWWWWWWW|WWWWWWWW',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W______________ZW',
      'WWWWWWWW|WWWWWWWW',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______________W',
      'W_______u______ZW',
      'WWWWWWWWeWWWWWWWW',
    ],
    over: OVER4, paint: paint4,
    links: { e: 't4' },
    people: [
      { id: 'leader', role: 'leader', x: 8, y: 2, face: 'down', name: 'Doctor Octo', g: 'm', look: 'octo' },
      { id: 'octoNote', x: 8, y: 2, face: 'down', name: 'Gym Guide', g: 'f', look: 'scientist', role: 'talk', hideIf: 'ch4',
        say: [['Doctor Octo is not here. He is in his lab.', '八爪博士不在，他在自己的实验室里。'], ['Team Hush mixed up all his books!', '嘘声团把他的书全弄乱了！']] },
      { id: 'k1', x: 15, y: 16, face: 'left', name: 'Scientist Ann', g: 'f', look: 'scientist', role: 'trainer', sight: 2, types: ['spark', 'steel'], n: 2, lv: 1,
        lines: [['Science first? Or maths first? Listen to the timetable!', '先上科学？还是先上数学？听课程表！']], win: ['My experiment failed!', '我的实验失败了！'], after: [['When do you have science? We have it every day!', '你们什么时候上科学课？我们天天都上！']] },
      { id: 'k2', x: 1, y: 8, face: 'right', name: 'Student Lucy', g: 'f', look: 'studentF', role: 'trainer', sight: 2, types: ['psychic', 'normal'], n: 2, lv: 1,
        lines: [['I think history is interesting. What do you think?', '我觉得历史很有趣。你觉得呢？']], win: ['History is still interesting!', '历史还是很有趣！'], after: [['Why do you like art? Because it\'s fun!', '你为什么喜欢美术？因为它很好玩！']] },
      { id: 'k3', x: 15, y: 8, face: 'left', name: 'Teacher Chen', g: 'm', look: 'teacher', role: 'trainer', sight: 2, types: ['steel', 'psychic'], n: 2, lv: 2,
        lines: [['I teach geography. The world is big!', '我教地理。世界很大！']], win: ['You know a lot about the world!', '你懂的真多！'], after: [['We have nine subjects on this island.', '我们岛上一共有九门课。']] },
    ],
  });

  // 海岸路（可选：钓鱼、渔夫、看海、灯塔）
  EM.define('r4', {
    kind: 'route', z: 4, name: '海岸路', en: 'Seaside Path', sub: '学科岛东边',
    rows: [
      '############################',
      '#TTTTTTTTTTTTTSSSSS~~~~~~~~#',
      '#TT,,,,,TTTTSSSSSSS~~~~~~~~#',
      '#T,,,,,,,TTSSSEEESSS~~~~~~~#',
      '#T,,,1,,,.SSSSEEESSS~~~~~~~#',
      '#T,,,,,,..SSSSEEESSSS~~~~~~#',
      '#TT,,,,...SSSSSSSSSSSS~~~~~#',
      '#TT......SSSSrSSSS.oSS~~~~~#',
      '#TTTT....SSSSSSSSSSSSSS~~~~#',
      '#TT...,,,,SSSSSS2SSSSSS~~~~#',
      '#T...,,,,,,SSSSSSSSSSSSS~~~#',
      '#T...,,,,,,,SSSSSSSSSSSS~~~#',
      '#TT..,,,,,,,SSSrrSSSSSSS~~~#',
      '#TTT...,,,,SSSSSSSSSSSSSS~~#',
      '#TTT.....SSSSSSSSSSS3SSSS~~#',
      '#TT....SSSSSSSSSSSSSSSSSS~~#',
      '<======SSSSSSSSSSSSSSSSSS~~#',
      '#TT....SSSSS~~~~SSSSSSSSS~~#',
      '#TTT...SSSS~~~~~~SSSSSSS~~~#',
      '#TTT,,,SSSS~~o~~~SSSS*SSS~~#',
      '#TT,,,,,SSS~~~~~SSSSSSSS~~~#',
      '#TT,,4,,SSSSSSSSSSSSSSSS~~~#',
      '#TT,,,,,,SSSSSSSSSSSSSS~~~~#',
      '#TTT,,,,,,SSSSSSrSSSSS~~~~~#',
      '#TTTT,,,,SSSSSSSSSSSSS~~~~~#',
      '#TTTTT...SSSSSSSSSS.o~~~~~~#',
      '#TTTTTTB.SSSSSSSSSSS~~~~~~~#',
      '#TTTTTTTTSSSSSSSS~~~~~~~~~~#',
      '#TTTTTTTTTSSSSS~~~~~~~~~~~~#',
      '############################',
    ],
    styles: { E: 'lighthouse' },
    signs: [['Seaside Path. Look at the sea and the lighthouse!', '海岸路。看看大海和灯塔吧！']],
    items: ['superball', 'waterstone', 'superpotion'],
    hiddenItems: ['revive', 'fullheal'],
    links: { w: 't4' },
    start: [2, 16],
    npc: {
      1: { role: 'trainer', name: 'Birdwatcher Sue', look: 'ranger', g: 'f', face: 'right', sight: 4, under: ',', types: ['flying', 'normal'], n: 2, lv: 1,
        lines: [['We have biology on Tuesday. I study birds!', '我们星期二有生物课。我研究鸟！']], win: ['Biology is still my favourite!', '生物还是我最喜欢的科目！'], after: [['Birds fly south in winter. That\'s biology!', '冬天鸟儿往南飞。这就是生物学！']] },
      2: { role: 'trainer', name: 'Fisher Jack', look: 'fisher', g: 'm', face: 'down', sight: 3, types: ['water'], n: 3, lv: 1,
        lines: [['I don\'t like school. I like fishing!', '我不喜欢上学，我喜欢钓鱼！']], win: ['Maybe I should go to geography class...', '也许我该去上地理课了……'], after: [['Geography teaches you about the sea.', '地理课会教你关于大海的知识。']] },
      3: { role: 'trainer', name: 'Swimmer Nina', look: 'swimmerF', g: 'f', face: 'left', sight: 4, types: ['water', 'ice'], n: 2, lv: 1,
        lines: [['PE is my favourite subject. I swim every day!', '体育是我最喜欢的科目。我每天都游泳！']], win: ['You swim faster than me!', '你游得比我还快！'], after: [['When do you have PE? We have it on Monday.', '你们什么时候上体育课？我们周一上。']] },
      4: { role: 'trainer', name: 'Painter Leo', look: LK.farmer, g: 'm', face: 'right', sight: 4, under: ',', types: ['grass', 'bug'], n: 2, lv: 1,
        lines: [['I\'m painting the sea for my art class.', '我在为美术课画大海。']], win: ['My painting is ruined!', '我的画被弄坏了！'], after: [['Art is relaxing. That\'s why I like it.', '美术让人放松，所以我喜欢它。']] },
    },
  });

  // ======================================================================
  //  剧情小工具
  // ======================================================================
  const nar = (en, zh, x) => Object.assign({ who: '旁白', emo: '📣', en, zh }, x || {});
  const phone = (en, zh) => ({ who: '旁白', emo: '📞', en, zh });
  const say = n => L.sayer(n.name, n.look, n.g);
  const filter = (C, css) => { if (C.filter) C.filter(css); };

  // ======================================================================
  //  第 2 岛 · 温馨家庭岛：妈妈来电 → 走丢的蒂姆 → 听描述找家人 → 会动的稻草人 → 夺回家庭水晶
  // ======================================================================
  const FAM2 = {
    mom: { flag: 'f2mom', en: 'mom', zh: '妈妈', desc: ['My mom has long hair. She has a red dress.', '我妈妈留着长头发，穿一条红裙子。'],
      q: ['What does his mom look like?', '他妈妈长什么样？'], right: 'She has long hair and a red dress.', wrong: ['She has short hair and a red dress.', 'She has long hair and a blue dress.'] },
    dad: { flag: 'f2dad', en: 'dad', zh: '爸爸', desc: ['My dad is tall. He has glasses and a green cap.', '我爸爸个子高高的，戴着眼镜和一顶绿帽子。'],
      q: ['What does his dad have?', '他爸爸戴着什么？'], right: 'He has glasses and a green cap.', wrong: ['He has glasses and a red cap.', 'He has a green cap. No glasses.'] },
    gran: { flag: 'f2gran', en: 'grandma', zh: '奶奶', desc: ['My grandma has white hair. She loves flowers.', '我奶奶头发白白的，她特别喜欢花。'],
      q: ['What does his grandma love?', '他奶奶喜欢什么？'], right: 'She loves flowers.', wrong: ['She loves cats.', 'She loves music.'] },
  };
  const famLeft = C => Object.keys(FAM2).filter(k => !C.flag(FAM2[k].flag));
  function note2(C) {
    if (C.flag('ch2')) { C.note(C.E.S.mon.badges[2] ? null : '🌳 树医生在北边路口的小屋；道馆里海龟奶奶在等你'); return; }
    if (!C.flag('f2call')) return;
    if (!C.flag('f2tim')) { C.note('😢 井边有个小男孩在哭，去问问他'); return; }
    if (famLeft(C).length) C.note('🔎 帮蒂姆找家人：' + Object.keys(FAM2).map(k => (C.flag(FAM2[k].flag) ? '✅' : '⬜') + FAM2[k].zh).join(' '));
    else C.note('🌾 风车田里的稻草人在动？去看看！');
  }
  // 一上岛，妈妈打电话来
  async function momCall(C) {
    const M = L.mom;
    await C.wait(500);
    await C.talk([
      phone('Ring, ring! Mom is calling!', '叮铃铃！妈妈打电话来了！'),
      M('Hello, {name}! It\'s Mom. How are you?', '喂，{name}！我是妈妈。你好吗？'),
      L.ask(M, 'How are you, dear?', '你好吗，宝贝？（选一句回答妈妈，再说出来）', "I'm fine, thank you. And you?", ["I'm twelve.", "It's a phone."]),
      M("I'm fine, too. Are you on Family Island now?", '我也很好。你现在到温馨家庭岛了吗？'),
      M('Granny Turtle lives there. She loves big families.', '海龟奶奶住在那里，她最喜欢热热闹闹的一大家子了。'),
      M("Don't forget to eat breakfast every day!", '别忘了每天都要吃早饭！'),
      L.speak(C, 'OK, Mom. I love you!', '对妈妈说：好的妈妈，我爱你！'),
      M('I love you, too! Call me soon. Bye-bye!', '我也爱你！记得常给我打电话。拜拜！'),
      nar('Wait... you hear a little boy crying near the well.', '咦……你听到井边有个小男孩在哭。'),
    ]);
    C.set('f2call');
    note2(C);
  }
  // 走丢的小男孩蒂姆：说出家人的样子（先只听，再选出对的描述）
  async function timTalk(C, n) {
    const T = say(n);
    C.faceEach(n);
    if (C.flag('ch2')) {
      await C.talk([T('Thank you, {name}! This is my family!', '谢谢你，{name}！这是我的家人！'), L.speak(C, 'This is my family.', '跟蒂姆一起说：这是我的家人。'), T('My family is the best family in the world!', '我的家是世界上最好的家！')]);
      return;
    }
    if (!C.flag('f2tim')) {
      const pages = [
        T('Wah... I can\'t find my family!', '呜哇……我找不到我的家人了！'),
        T('Team Hush took the Family Crystal. Now I can\'t even say... m... m...', '嘘声团偷走了家庭水晶。现在我连……妈……妈……都说不出来了。'),
        nar('Help Tim! Say the family words for him.', '帮帮蒂姆！替他把家人的称呼说出来。'),
        L.speak(C, 'Mom, Dad and Grandma!', '大声说：Mom, Dad and Grandma!'),
        T('Yes! Mom, Dad and Grandma! Thank you!', '对！妈妈、爸爸和奶奶！谢谢你！'),
        T('We were at the well. Then Team Hush came, and everyone ran away!', '我们本来在井边，嘘声团一来，大家都跑散了！'),
        T('Listen. I will tell you what they look like.', '听好，我告诉你他们长什么样。'),
      ];
      Object.values(FAM2).forEach(f => {
        pages.push(T(f.desc[0], '（仔细听！他在说谁？长什么样？）', { hideEn: true }), L.ask(nar, f.q[0], f.q[1], f.right, f.wrong), T(f.desc[0], f.desc[1]));
      });
      pages.push(T('Please find them! Ask them: "Are you Tim\'s mom?"', '请帮我找到他们！问他们：“您是蒂姆的妈妈吗？”'), T('I will wait here by the well.', '我就在井边等着。'));
      await C.talk(pages);
      C.set('f2tim');
      note2(C);
      return;
    }
    const left = famLeft(C);
    if (left.length) { await C.talk([T('Did you find my family?', '你找到我的家人了吗？')].concat(left.map(k => T(FAM2[k].desc[0], FAM2[k].desc[1])))); return; }
    await C.talk([T('Look! That scarecrow in the windmill field is moving!', '快看！风车田里那个稻草人在动！'), T('Is it Team Hush?', '难道是嘘声团？')]);
  }
  // 问镇上的人：“您是蒂姆的妈妈吗？”
  async function famTalk(C, n) {
    const f = FAM2[n.fam], S = say(n);
    C.faceEach(n);
    const q = L.speak(C, 'Excuse me. Are you Tim\'s ' + f.en + '?', '有礼貌地问：请问您是蒂姆的' + f.zh + '吗？');
    if (!n.real) {
      await C.talk([q, S(n.no[0], n.no[1]), nar('Tim said: "' + f.desc[0] + '"', '蒂姆说过：“' + f.desc[1] + '”')]);
      return;
    }
    await C.talk([
      q,
      S('Yes, I am! Where is he? Is he OK?', '是的，就是我！他在哪儿？他还好吗？'),
      L.ask(S, 'Where is Tim now?', '蒂姆现在在哪儿？', "He's at the well.", ["He's at school.", "He's in the Gym."]),
      S('Thank you so much! I\'m going to him now!', '太谢谢你了！我这就去找他！'),
    ]);
    C.set(f.flag);
    if (!famLeft(C).length) await reunion(C);
    note2(C);
  }
  async function reunion(C) {
    const T = L.sayer('Tim', LK.tim, 'm'), D = L.sayer("Tim's Dad", LK.dad2, 'm'), G = L.sayer("Tim's Grandma", LK.gran2, 'f');
    await C.talk([
      nar("Tim's family is together again!", '蒂姆一家终于团聚了！', { onShow: () => { C.E.SFX.win(); C.E.confetti(100); } }),
      T('Mom! Dad! Grandma!', '妈妈！爸爸！奶奶！'),
      D('Thank you, young trainer!', '谢谢你，小训练师！'),
      G('Oh! Look at the windmill field. That scarecrow is moving!', '哎呀！看风车田，那个稻草人在动！'),
      D('That is not our scarecrow. It must be Team Hush!', '那不是我们家的稻草人，肯定是嘘声团！'),
    ]);
  }
  async function familyTalk(C, n) {
    const S = say(n);
    C.faceEach(n);
    const lines = {
      timMom: [['Thank you for finding Tim!', '谢谢你找到了蒂姆！'], ['Who is she? She\'s my mother, Tim\'s grandma.', '她是谁？她是我妈妈，也就是蒂姆的奶奶。']],
      timDad: [['My father is a doctor, and I\'m a farmer.', '我爸爸是医生，我是农民。'], ['Family is the most important thing.', '家人是最重要的。']],
      timGran: [['These are my grandchildren. Tim is the youngest.', '这些都是我的孙子孙女，蒂姆是最小的。'], ['I love flowers. Here, smell this one!', '我喜欢花。来，闻闻这朵！']],
    }[n.id];
    await C.talk(lines.map(([en, zh]) => S(en, zh)));
  }
  // 风车田里「会动的稻草人」
  async function crowTalk(C, n) {
    const S = say(n);
    C.faceEach(n);
    await C.talk([
      nar('It looks like a scarecrow... but it is shaking!', '看起来像个稻草人……可它在发抖！'),
      L.speak(C, "Hey! You're not a scarecrow!", '大声说：嘿！你根本不是稻草人！'),
      S('Shh! How did you know?!', '嘘！你怎么知道的？！'),
    ]);
    const res = await L.hushFight(C, n, 'grunt', {
      lines: [['I took the Family Crystal. Families talk too much!', '家庭水晶是我偷的。一家人话太多了！'], ['A quiet home is a good home!', '安安静静的家才是好家！']],
      types: ['poison', 'dark'], n: 2, win: ['Shh... Fine! Take your silly crystal!', '嘘……好吧！把你们的破水晶拿回去！'],
    });
    if (res !== 'win') return;
    await L.restoreCrystal(C, 2);
    await C.talk([nar('The Tree Doctor wants to see you. His hut is near the north road.', '树医生想见你。他的小屋在北边路口旁边。')]);
    note2(C);
  }

  // ---------- 道馆「家族树迷宫」 ----------
  const G2 = {
    gran: { gate: 2, start: [8, 22], en: 'grandma', zh: '奶奶', desc: ['The grandma has white hair and glasses.', '奶奶头发白白的，戴着眼镜。'],
      q: ['What does the grandma look like?', '奶奶长什么样？'], right: 'She has white hair and glasses.', wrong: ['She has brown hair and glasses.', 'She has white hair. No glasses.'] },
    dad: { gate: 1, start: [12, 16], en: 'dad', zh: '爸爸', desc: ['The dad has a black cap and a blue jacket.', '爸爸戴黑帽子，穿蓝外套。'],
      q: ['What does the dad wear?', '爸爸穿戴着什么？'], right: 'A black cap and a blue jacket.', wrong: ['A black cap and a green jacket.', 'A blue jacket. No cap.'] },
    sis: { gate: 0, start: [4, 10], en: 'little sister', zh: '妹妹', desc: ['The little sister has pigtails and a pink dress.', '妹妹扎着两条小辫子，穿粉色的裙子。'],
      q: ['What does the little sister look like?', '妹妹长什么样？'], right: 'She has pigtails and a pink dress.', wrong: ['She has a ponytail and a pink dress.', 'She has pigtails and a yellow dress.'] },
  };
  const ORDER2 = ['gran', 'dad', 'sis'];
  const PHOTO2 = { '2,20': 'gran', '2,14': 'dad', '14,8': 'sis' };
  const cur2 = C => ORDER2.find(k => !C.gateOpen(G2[k].gate));
  const turtle = C => { const n = C.npc(q => q.role === 'leader'); return L.sayer('Granny Turtle', n ? n.look : 'granny', 'f'); };
  const hint2 = (C, k) => { const T = turtle(C), f = G2[k]; return [T(f.desc[0], '（仔细听广播：要找的' + f.zh + '长什么样？）', { hideEn: true }), L.ask(T, f.q[0], f.q[1], f.right, f.wrong), T(f.desc[0], f.desc[1])]; };
  function note2g(C) {
    const k = cur2(C);
    C.note(k ? '🌳 家族树：' + ORDER2.map(q => (C.gateOpen(G2[q].gate) ? '✅' : q === k ? '👉' : '⬜') + G2[q].zh).join(' → ') + '<br><small>按 A 看墙上的全家福可以再听一遍</small>' : '🐢 家人都找齐了！去见海龟奶奶');
  }
  async function gym2Enter(C) {
    const k = cur2(C), T = turtle(C);
    if (k && !C.flag('g2hi')) {
      await C.talk([
        T('Welcome to my Family Tree, dear!', '欢迎来到我的家族树，孩子！'),
        T('Find my family: the grandma, the dad and the little sister.', '找到我的家人：奶奶、爸爸和妹妹。'),
        T('Ask them: "Are you the grandma?" If you ask the wrong one... back you go!', '问他们：“您是奶奶吗？”问错了人……就回到这间屋子的起点！'),
      ].concat(hint2(C, k)));
      C.set('g2hi');
    }
    note2g(C);
  }
  async function gym2Talk(C, n) {
    const S = say(n), f = G2[n.fam], T = turtle(C);
    C.faceEach(n);
    if (C.gateOpen(f.gate)) { await C.talk([S(n.ok ? 'Go on, dear! Granny is waiting.' : 'Good luck!', n.ok ? '去吧，孩子！奶奶在等你。' : '加油！')]); return; }
    const q = L.speak(C, 'Are you the ' + f.en + '?', '问一问：您是' + f.zh + '吗？');
    if (n.ok) {
      await C.talk([q, S('Yes, I am! You found me!', '是的，就是我！你找到我了！', { onShow: () => C.E.SFX.win() })]);
      C.openGate(f.gate, true);
      const k = cur2(C);
      await C.talk(k ? [T('Well done! The next door is open.', '真棒！下一扇门打开了。')].concat(hint2(C, k)) : [T('You found my whole family! Come and see me, dear.', '你把我的家人都找齐了！来见我吧，孩子。')]);
      note2g(C);
      return;
    }
    await C.talk([q, S(n.no[0], n.no[1]), nar('Wrong person! Back to the start of this room.', '找错人啦！回到这间屋子的起点。', { onShow: () => C.E.SFX.bad && C.E.SFX.bad() })]);
    C.teleport(f.start[0], f.start[1], 'up');
  }

  // ---------- 3 号路：对手第二次对战 ----------
  async function rival2(C) {
    const R = C.rivalInfo(), pl = C.pl, S = L.sayer(R.name, R.look, R.g);
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x, y: pl.y - 5, face: 'down' });
    await C.alert(r);
    await C.walk(r, 'down', 4, 160);
    C.faceEach(r);
    await C.talk([
      S('{name}! Wait for me!', '{name}！等等我！'),
      S('I called my mom and dad this morning. They say hi!', '我今天早上给爸爸妈妈打了电话，他们向你问好！'),
      L.ask(S, 'How many people are there in your family?', '你家有几口人？', 'There are four.', ["I'm twelve.", "It's my family."]),
      S('Cool! Now let\'s battle! I got stronger!', '酷！现在来对战吧！我变强了！'),
    ]);
    const res = await L.rivalFight(C, 2);
    if (res === 'win') await C.talk([S('Wow! Your monsters love you like a family!', '哇！你的怪兽像家人一样爱你！'), S('I\'m going to Campus Island. See you at school!', '我要去校园岛了，学校见！')]);
    else await C.talk([S('See you at school on Campus Island!', '校园岛的学校见！')]);
    C.set('rival2');
    await C.walk(r, 'up', 6, 140);
    C.remove(r);
  }

  ST.isle(2, {
    busy: ['The Family Crystal is gone, dear. I can\'t think about battles now.', '孩子，家庭水晶不见了，我现在没心思对战。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't2') return C.flag('f2call') ? () => note2(C) : () => momCall(C);
      if (id === 'i2G') return () => gym2Enter(C);
      return null;
    },
    step(C) {
      const pl = C.pl;
      if (C.map.id === 'r2' && !C.flag('rival2') && C.MG.anyAlive() && pl.x >= 10 && pl.x <= 13 && pl.y >= 19 && pl.y <= 27) return () => rival2(C);
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't2') {
        if (n.id === 'tim') return () => timTalk(C, n);
        if (n.id === 'crow') return () => crowTalk(C, n);
        if (n.id === 'timMom' || n.id === 'timDad' || n.id === 'timGran') return () => familyTalk(C, n);
        if (n.fam && C.flag('f2tim') && !C.flag('ch2') && !C.flag(FAM2[n.fam].flag)) return () => famTalk(C, n);
      }
      if (id === 'i2G' && n.fam) return () => gym2Talk(C, n);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 'i2G' && f.statue) {
        const k = PHOTO2[f.x + ',' + f.y];
        if (k) return () => C.talk([nar('A family photo. Granny wrote under it:', '一张全家福，奶奶在下面写着字：')].concat(hint2(C, k)));
        return () => C.talk([nar('A photo of Granny Turtle\'s big family. Everyone is smiling.', '海龟奶奶一大家子的合照，每个人都在笑。')]);
      }
      return null;
    },
  });

  // ======================================================================
  //  第 3 岛 · 校园岛：嘘声团要取消英语课 → 和对手一起在教学楼里问路找线索 → 五班堵住低语
  // ======================================================================
  function note3(C) {
    if (C.flag('ch3')) { C.note(C.map.id === 't3' && !C.E.S.mon.badges[3] ? '⛏️ 矿工在北边的隧道口；道馆在跑道南边' : null); return; }
    if (!C.flag('f3in')) return;
    if (C.map.id === 't3') { C.note('🏫 嘘声团在红砖教学楼里（有钟楼的那栋）'); return; }
    C.note(!C.flag('f3lib') ? '📝 找人问一问：图书馆在哪儿？' : !C.flag('f3lab') ? '📚 图书馆在食堂旁边，去问问图书管理员' : !C.flag('f3grunt') ? '🔬 实验室在二楼，音乐教室旁边（走廊尽头有楼梯）'
      : !C.flag('f3c5') ? '❓ 问问二楼的同学：五班在哪儿？' : '🏫 五班在实验室旁边，快去堵住低语！');
  }
  const rivalS = C => { const R = C.rivalInfo(); return L.sayer(R.name, R.look, R.g); };
  function spawnRival(C, x, y, face) {
    if (C.npc(n => n.id === 'rv3')) return null;
    const R = C.rivalInfo();
    return C.spawn({ id: 'rv3', look: R.look, name: R.name, g: R.g, x, y, face: face || 'down' });
  }
  async function intro3(C) {
    const pl = C.pl, R = C.rivalInfo(), RS = rivalS(C), B = L.sayer('Ms Bell', LK.bell, 'f');
    await C.wait(300);
    await C.talk([nar('Ding-dong! Ding-dong! The school bell is ringing.', '叮咚！叮咚！学校的钟声响了。')]);
    const t = C.spawn({ look: LK.bell, name: 'Ms Bell', g: 'f', x: pl.x - 1, y: pl.y - 4, face: 'down' });
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x + 1, y: pl.y - 4, face: 'down' });
    await C.alert(t);
    await Promise.all([C.walk(t, 'down', 3, 170), C.walk(r, 'down', 3, 170)]);
    C.facePlayer('up');
    await C.talk([
      B('Oh, hello! Are you a new student?', '哦，你好！你是新同学吗？'),
      B('Team Hush is in our school! They want to stop our English class!', '嘘声团闯进我们学校了！他们要取消我们的英语课！'),
      RS('{name}! I saw a woman in a purple coat. She ran into the school building!', '{name}！我看见一个穿紫色外套的女人，她跑进教学楼了！'),
      B('That is Whisper, a leader of Team Hush. She took our School Crystal!', '她是嘘声团的干部低语，她偷走了我们的校园水晶！'),
      L.ask(B, 'Can you help us?', '你能帮帮我们吗？', 'Yes, I can.', ['Yes, I am.', 'No, it isn\'t.']),
      B('Thank you! The school building is the big red one with the clock.', '谢谢你！教学楼就是那栋有钟楼的红砖大楼。'),
      RS("Let's find her together!", '我们一起去找她吧！'),
      L.speak(C, "Let's go to the school building!", '大声说：我们去教学楼吧！'),
    ]);
    C.remove(t); C.remove(r);
    C.set('f3in');
    note3(C);
  }
  // 教学楼 1 楼：对手在走廊等你；第一次进来发现低语留下的纸条
  async function school1(C) {
    note3(C);
    if (!C.flag('f3in') || C.flag('ch3')) return;
    const r = spawnRival(C, 14, 9, 'up');
    if (C.flag('f3note') || !r) return;
    const RS = rivalS(C);
    await C.talk([
      RS('{name}! Look, Whisper dropped a note!', '{name}！快看，低语掉了一张纸条！'),
      nar('The note says: "Meet me in the library. — W"', '纸条上写着：“图书馆见。——W”'),
      RS('The library? Where is the library? Let\'s ask someone.', '图书馆？图书馆在哪儿呢？我们找人问问吧。'),
    ]);
    C.set('f3note');
  }
  // 教学楼 2 楼：实验室里的团员、五班里的低语
  function school2(C) {
    note3(C);
    if (!C.flag('f3in') || C.flag('ch3')) return;
    if (C.flag('f3lab') && !C.flag('f3grunt') && !C.npc(n => n.id === 'g3')) C.spawn({ id: 'g3', look: L.P.LOOKS.grunt, name: 'Hush Grunt', g: 'm', x: 13, y: 2, face: 'down' });
    if (C.flag('f3c5')) spawnWhisper(C);
    else spawnRival(C, 20, 8, 'left');
  }
  function spawnWhisper(C) {
    if (!C.npc(n => n.id === 'wh3')) C.spawn({ id: 'wh3', look: L.P.LOOKS.whisper, name: 'Admin Whisper', g: 'f', x: 3, y: 2, face: 'up' });
    const r = C.npc(n => n.id === 'rv3');
    if (r) { r.x = 5; r.y = 4; r.face = 'up'; } else spawnRival(C, 5, 4, 'up');
  }
  async function amyTalk(C, n) {
    const A = say(n);
    C.faceEach(n);
    if (C.flag('f3in') && !C.flag('f3lib') && !C.flag('ch3')) {
      await C.talk([
        L.speak(C, 'Excuse me, where is the library?', '有礼貌地问：请问图书馆在哪儿？'),
        A("It's next to the dining hall.", '（仔细听她怎么说）', { hideEn: true }),
        L.ask(nar, 'Where is the library?', '图书馆在哪儿？', "It's next to the dining hall.", ["It's next to the office.", "It's on the second floor."]),
        A("Yes! It's next to the dining hall. Go up the hall and look for the sign.", '对！它在食堂旁边。沿着走廊往里走，看地上的牌子。'),
      ]);
      C.set('f3lib'); note3(C);
      return;
    }
    await C.talk([A('Welcome to my school!', '欢迎来到我的学校！'), A('There is a big playground in our school.', '我们学校有一个大操场。')]);
  }
  async function librTalk(C, n) {
    const S = say(n);
    C.faceEach(n);
    if (C.flag('f3lib') && !C.flag('f3lab') && !C.flag('ch3')) {
      await C.talk([
        S('Shh! This is a library. Please be quiet.', '嘘！这里是图书馆，请安静。'),
        S('A woman in a purple coat? Yes, she was here.', '穿紫色外套的女人？对，她来过。'),
        S('She took a map of the school and went to the lab.', '她拿走了一张学校地图，去实验室了。'),
        L.speak(C, 'Excuse me, where is the lab?', '问一问：请问实验室在哪儿？'),
        S("It's on the second floor, next to the music room.", '（仔细听）', { hideEn: true }),
        L.ask(nar, 'Where is the lab?', '实验室在哪儿？', "It's on the second floor.", ["It's next to the library.", "It's behind the gym."]),
        S('Right. Take the stairs at the end of the hall.', '对。走廊尽头有楼梯。'),
      ]);
      C.set('f3lab'); note3(C);
      return;
    }
    await C.talk([S('Shh! This is a library.', '嘘！这里是图书馆。'), S('We have many English books. Do you like reading?', '我们有很多英语书。你喜欢读书吗？')]);
  }
  async function grunt3Talk(C, n) {
    const res = await L.hushFight(C, n, 'grunt', {
      lines: [['Shh! This lab is ours now!', '嘘！这间实验室现在归我们了！'], ['No more English class! No more talking!', '不许上英语课！不许说话！']], types: ['poison', 'dark'], n: 2,
      win: ['Shh... Fine! Whisper is in Class Five. She is going to erase all the English lessons!', '嘘……好吧！低语在五班，她要把英语课的内容全擦掉！'],
    });
    if (res !== 'win') return;
    C.remove(n);
    C.set('f3grunt');
    const r = C.npc(q => q.id === 'rv3');
    if (r) await C.talk([rivalS(C)('Class Five? Where is it? Let\'s ask Sam in the hall!', '五班？在哪儿呢？我们问问走廊里的萨姆吧！')]);
    note3(C);
  }
  async function samTalk(C, n) {
    const S = say(n);
    C.faceEach(n);
    if (C.flag('f3grunt') && !C.flag('f3c5') && !C.flag('ch3')) {
      await C.talk([
        L.speak(C, 'Excuse me, where is Class Five?', '问一问：请问五班在哪儿？'),
        S("It's at the end of the hall, next to the lab.", '（仔细听）', { hideEn: true }),
        L.ask(nar, 'Where is Class Five?', '五班在哪儿？', "It's next to the lab.", ["It's next to the music room.", "It's on the first floor."]),
        S('Yes! Go left. A woman in a purple coat just went in. Hurry!', '对！往左走。刚才有个穿紫色外套的女人进去了。快！'),
      ]);
      C.set('f3c5');
      spawnWhisper(C);
      note3(C);
      return;
    }
    await C.talk([S('Our classroom is on the second floor.', '我们的教室在二楼。'), S('I like English class. The teacher is fun!', '我喜欢英语课，老师很有趣！')]);
  }
  async function whisperTalk(C, n) {
    const W = say(n), RS = rivalS(C);
    C.faceEach(n);
    await C.talk([
      W('Shh... You found me, little trainer.', '嘘……你找到我了，小训练师。'),
      W('English class is so noisy. I will erase every word on this blackboard.', '英语课太吵了。我要把黑板上的每个词都擦掉。'),
      RS('No way! We love English class!', '休想！我们最喜欢英语课了！'),
      L.speak(C, 'Give back the School Crystal!', '大声说：把校园水晶还回来！'),
    ]);
    const res = await L.hushFight(C, n, 'whisper', {
      lines: [["Shh... then let's see how loud you are.", '嘘……那就让我看看你有多大声。']], types: ['poison', 'dark', 'ghost'], n: 3,
      win: ["Shh... You're loud. Too loud.", '嘘……你太吵了，真的太吵了。'],
    });
    if (res !== 'win') return;
    await C.talk([W('Remember my name: Whisper. One day the Hush King will wake up...', '记住我的名字：低语。总有一天，寂静之王会醒来……'), W('...and the whole world will be quiet. Shh...', '……到时候整个世界都会安静下来。嘘……')]);
    C.remove(n);
    await L.restoreCrystal(C, 3);
    await C.talk([
      RS('We did it! English class is saved!', '我们成功了！英语课保住了！'),
      RS('Let\'s learn English together!', '我们一起学英语吧！'),
      RS('I heard a miner is waiting at the tunnel. See you, {name}!', '听说有个矿工在隧道口等着。回头见，{name}！'),
    ]);
    const r = C.npc(q => q.id === 'rv3');
    if (r) { await C.walk(r, 'down', 2, 150); C.remove(r); }
    C.note('⛏️ 矿工在北边的隧道口等你；道馆在跑道南边');
  }
  // 小凯来学校看你
  async function kaiTalk(C, n) {
    const K = L.sayer('Kai', 'kai', 'm');
    C.faceEach(n);
    let fight = false;
    await C.talk([
      K('{name}! Hi! It\'s me, Kai!', '{name}！嗨！是我，小凯！'),
      K('I came to see your school. It\'s so big!', '我来看看你的学校，好大呀！'),
      L.ask(K, 'Is there a library in your school?', '你们学校有图书馆吗？', 'Yes, there is.', ['Yes, it is.', 'Yes, I am.']),
      K('Cool! I\'m training hard, too. My monsters are getting stronger.', '真棒！我也在努力训练，我的怪兽越来越强了。'),
      K('Can we have a small battle? Just a little one...', '我们可以来一场小小的对战吗？就一小场……', { kind: 'choice', opts: [{ html: '⚔️ 好呀 Sure!', cls: 'sun' }, { html: '下次吧 Next time' }], pick: i => { fight = !i; return []; } }),
    ]);
    if (!fight) { await C.talk([K('OK! I\'ll wait here on the playground.', '好！我就在操场这儿等你。')]); return; }
    const res = await C.battle('trainer', { foes: [C.MG.newMon('seedlet', 9), C.MG.newMon('peeplet', 10)], trainer: { name: 'Kai', img: C.portrait(L.P.LOOKS.kai) }, noWhiteout: true });
    if (res === 'lose') C.MG.healAll();
    await C.talk([
      res === 'lose' ? K('I... I won? Really? Thank you for the battle!', '我……我赢了？真的吗？谢谢你陪我对战！') : K('Wow, you are so strong! I lost, but I learned a lot.', '哇，你好强！我输了，但是学到了好多。'),
      K('I\'m going to Clock Island next. See you there!', '我接下来要去作息岛，到时候见！'),
      L.speak(C, 'See you, Kai!', '跟小凯说再见：See you, Kai!'),
    ]);
    await C.walk(n, 'right', 3, 170);
    C.set('kai3');
  }

  // ---------- 道馆「教室换座」 ----------
  const BB3 = {
    '3,20': { gate: 2, seat: [7, 25], intro: [['Classroom 1. Listen to the teacher.', '第一间教室。听老师提问。']],
      q: ['Excuse me, where is the office?', '（听老师的问题，选出合适的回答，再大声说出来）'], right: "It's next to the hall.", wrong: ["You're welcome.", "It's nine o'clock."], x: { hideEn: true } },
    '11,13': { gate: 1, seat: [11, 18], intro: [['Classroom 2. Look at the picture on the blackboard.', '第二间教室。看黑板上的图。']],
      q: ["What's this room?", '这是什么教室？'], right: "It's a lab.", wrong: ["It's a library.", "It's a gym."], x: { pic: '🔬' } },
    '3,6': { gate: 0, seat: [3, 11], intro: [['Classroom 3. The blackboard says: "Our classroom is on the third floor."', '第三间教室。黑板上写着：“我们的教室在三楼。”']],
      q: ['Which floor is our classroom on?', '我们的教室在几楼？'], right: 'The third floor.', wrong: ['Room three.', "It's clean."] },
  };
  const board = (en, zh, x) => Object.assign({ who: 'Blackboard', emo: '🧑‍🏫', en, zh }, x || {});
  function note3g(C) {
    const n = [2, 1, 0].filter(g => C.gateOpen(g)).length;
    C.note(n < 3 ? '🧑‍🏫 教室换座：对着黑板按 A 答题，答对开门（' + n + '/3）' : '🦉 三间教室都过了！去见猫头鹰校长');
  }
  async function gym3Enter(C) {
    if (!C.flag('g3hi') && !C.gateOpen(0)) {
      const O = L.sayer('Principal Owl', (C.npc(q => q.role === 'leader') || {}).look || 'teacher', 'm');
      await C.talk([
        O('Welcome to my school! Take your seat, please.', '欢迎来到我的学校！请坐好。'),
        O('Each classroom has a question on the blackboard.', '每间教室的黑板上都有一道题。'),
        O('Answer it, and the door opens. A wrong answer? Back to your seat!', '答对了门就会开；答错了？回到座位上去！'),
      ]);
      C.set('g3hi');
    }
    note3g(C);
  }
  async function board3(C, b) {
    if (C.gateOpen(b.gate)) { await C.talk([board('The door is open. Go to the next classroom!', '门已经开了，去下一间教室吧！')]); return; }
    let ok = false;
    await C.talk(b.intro.map(([en, zh]) => board(en, zh)).concat([L.ask(board, b.q[0], b.q[1], b.right, b.wrong, Object.assign({
      pass: () => { ok = true; return [board('Correct! The door is open.', '答对了！门开了。')]; },
      fail: () => [board('Wrong answer! Please go back to your seat.', '答错了！请回到座位上。')],
    }, b.x || {}))]));
    if (ok) { C.openGate(b.gate, true); note3g(C); }
    else C.teleport(b.seat[0], b.seat[1], 'up');
  }

  ST.isle(3, {
    busy: ['Team Hush is in my school! No battles until the School Crystal is back!', '嘘声团闯进了我的学校！校园水晶回来之前不对战！'],
    enter(C) {
      const id = C.map.id;
      if (id === 't3') return C.flag('f3in') ? () => note3(C) : () => intro3(C);
      if (id === 'i3A') return () => school1(C);
      if (id === 'i3A2') return () => school2(C);
      if (id === 'i3G') return () => gym3Enter(C);
      if (id === 'r3m' && C.flag('ch3') && !C.flag('leg:mindra') && !C.npc(n => n.mon === 'mindra')) return () => { C.spawn({ mon: 'mindra', role: 'legend', x: 6, y: 3, face: 'down' }); };
      return null;
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 't3' && n.id === 'kai') return () => kaiTalk(C, n);
      if (id === 'i3A' && n.id === 'amy') return () => amyTalk(C, n);
      if (id === 'i3A' && n.id === 'libr') return () => librTalk(C, n);
      if (id === 'i3A' && n.id === 'rv3') return () => C.talk([rivalS(C)(C.flag('f3lib') ? 'The library is next to the dining hall. Let\'s go!' : 'Let\'s ask Amy. She is in the hall.', C.flag('f3lib') ? '图书馆在食堂旁边，走吧！' : '我们问问走廊里的艾米吧。')]);
      if (id === 'i3A2' && n.id === 'sam') return () => samTalk(C, n);
      if (id === 'i3A2' && n.id === 'g3') return () => grunt3Talk(C, n);
      if (id === 'i3A2' && n.id === 'wh3') return () => whisperTalk(C, n);
      if (id === 'i3A2' && n.id === 'rv3') return () => C.talk([rivalS(C)(C.flag('f3c5') ? 'Whisper is in Class Five! Talk to her!' : 'The lab is next to the music room!', C.flag('f3c5') ? '低语就在五班！去和她对峙！' : '实验室就在音乐教室旁边！')]);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 'i3G' && f.statue) { const b = BB3[f.x + ',' + f.y]; if (b) return () => board3(C, b); }
      if (C.map.id === 'i3A2' && f.statue) return () => C.talk([nar(C.flag('ch3') ? 'The blackboard says: "Let\'s learn English together!"' : 'The blackboard says: "English class today!"', C.flag('ch3') ? '黑板上写着：“我们一起学英语吧！”' : '黑板上写着：“今天有英语课！”')]);
      return null;
    },
  });

  // ======================================================================
  //  第 4 岛 · 学科岛：八爪博士的书乱了（按课程表摆书）→ 静音石 → 卫星天线夺回学科水晶；天文台欧瑞讲传说
  // ======================================================================
  const ICON = { m: '➗', e: '🔤', s: '🧪', u: '🎵', a: '🎨', p: '🏃', c: '🀄', h: '🏺', g: '🌏' };
  const BOOKS = ['m', 'e', 's', 'c', 'u', 'p'];
  const DAYS = [
    { en: 'On Monday we have maths, English and science.', zh: '星期一我们有数学、英语和科学。', list: ['m', 'e', 's'] },
    { en: 'On Tuesday we have Chinese, music and PE.', zh: '星期二我们有语文、音乐和体育。', list: ['c', 'u', 'p'] },
  ];
  const ORD = [['first', '第一'], ['second', '第二'], ['third', '第三']];
  function note4(C) {
    if (C.flag('ch4')) { C.note(!C.E.S.mon.badges[4] && C.map.kind !== 'inside' ? '🐙 八爪博士在道馆等你' : null); return; }
    if (!C.flag('f4in')) return;
    C.note(!C.flag('f4books') ? '🧪 去八爪博士的实验室（镇子中间的玻璃圆顶）' : '📡 嘘声团在东边的卫星天线旁');
  }
  async function intro4(C) {
    const pl = C.pl, N = L.sayer('Assistant Nova', LK.nova, 'f');
    const n = C.spawn({ look: LK.nova, name: 'Assistant Nova', g: 'f', x: pl.x, y: pl.y - 4, face: 'down' });
    await C.alert(n);
    await C.walk(n, 'down', 3, 150);
    C.faceEach(n);
    await C.talk([
      N('Oh! A trainer! Please help us!', '啊！是训练师！请帮帮我们！'),
      N("I'm Nova, Doctor Octo's assistant.", '我是诺娃，八爪博士的助手。'),
      N("Team Hush broke into Doctor Octo's lab. All his books are mixed up!", '嘘声团闯进了八爪博士的实验室，他的书全被弄乱了！'),
      N('And they took our Subject Crystal!', '他们还偷走了我们的学科水晶！'),
      L.ask(N, 'Can you help Doctor Octo?', '你能帮帮八爪博士吗？', 'Yes, I can.', ['Yes, I do.', "No, it isn't."]),
      N('Thank you! The lab is the big glass dome in the middle of the town.', '谢谢你！实验室就是镇子中间那座玻璃圆顶的大楼。'),
    ]);
    C.remove(n);
    C.set('f4in');
    note4(C);
  }
  // 听课程表，按顺序把书放回书架（选错了从头再听）
  async function bookRound(C, O, day) {
    for (let tries = 0; ; tries++) {
      await C.talk([O(day.en, '（仔细听课程表，记住顺序！' + (tries ? '再听一遍。' : '') + '）', { hideEn: true })]);
      let ok = true;
      for (let k = 0; k < day.list.length && ok; k++) {
        let got = null;
        await C.talk([O('Which book is ' + ORD[k][0] + '?', '哪一本书放在' + ORD[k][1] + '个？', {
          kind: 'choice', opts: BOOKS.map(b => ({ html: '<span class="bk" data-b="' + b + '">' + ICON[b] + ' ' + SUBJ[b][0] + '</span>' })), pick: i => { got = BOOKS[i]; return []; },
        })]);
        if (got === day.list[k]) { C.E.say(SUBJ[got][0]); C.E.toast('📗 ' + SUBJ[got][0] + ' ✓'); }
        else ok = false;
      }
      if (ok) { await C.talk([O(day.en, day.zh, { onShow: () => C.E.SFX.ok(2) })]); return; }
      await C.talk([O('Oops! That is not the right order. Listen again!', '哎呀，顺序不对。再听一遍！', { onShow: () => C.E.SFX.bad && C.E.SFX.bad() })]);
    }
  }
  async function octoTalk(C, n) {
    const O = say(n);
    C.faceEach(n);
    if (C.flag('f4books')) { await C.talk([O('Please stop Team Hush at the satellite dish!', '请去卫星天线那儿阻止嘘声团！')]); return; }
    await C.talk([
      O("Oh, hello! I'm Doctor Octo. I teach eight subjects at the same time!", '哦，你好！我是八爪博士，我能同时教八门课！'),
      O('But look at my bookshelf! Team Hush mixed up all my books!', '可是你看我的书架！嘘声团把我的书全弄乱了！'),
      O('I keep my books in the order of my timetable.', '我的书是按课程表的顺序摆的。'),
      O('Listen to the timetable, and put the books back in order. OK?', '听课程表，按顺序把书放回去，好吗？'),
    ]);
    for (const d of DAYS) await bookRound(C, O, d);
    await C.talk([
      O('Wonderful! My books are back in order!', '太好了！我的书都回到原位了！', { onShow: () => C.E.SFX.win() }),
      L.ask(O, "What's your favourite subject?", '你最喜欢哪一科？', 'I like PE best.', ["It's Monday.", 'My teacher is Mr Li.']),
      O('Ha ha! I like all of them!', '哈哈！我每一科都喜欢！'),
      O('Hmm? What is this grey stone behind my books?', '嗯？书后面这块灰色的石头是什么？'),
      nar('The room is suddenly very quiet. The stone is eating all the sounds!', '屋子里一下子变得特别安静——石头把声音都吸走了！', { onShow: () => filter(C, 'saturate(.3) brightness(.92)') }),
      O("It's a Hush Stone! Team Hush is collecting these stones.", '这是一块“静音石”！嘘声团在收集这种石头。', { onShow: () => filter(C, '') }),
      O('With many Hush Stones, a whole island can go quiet!', '静音石多了，整座岛都会变得鸦雀无声！'),
      O('Nova saw them at the big satellite dish in the east. Please stop them!', '诺娃看见他们在东边的大卫星天线那儿。请你去阻止他们！'),
    ]);
    C.set('f4books');
    note4(C);
  }
  // 卫星天线旁的两个团员：先大声说话打破静音石，再连打两场
  async function dishTalk(C, n) {
    const a = C.npc(q => q.id === 'g4a') || n, b = C.npc(q => q.id === 'g4b') || n, F = say(a);
    C.faceEach(n);
    if (!C.flag('f4g1')) {
      await C.talk([
        F('Shh! Look at all our Hush Stones!', '嘘！看看我们这么多的静音石！'),
        F('We put them on the satellite dish. Soon the whole island will be quiet!', '我们把它们放在卫星天线上，很快整座岛都会安静下来！'),
        nar('Your voice feels very small here...', '在这里，你的声音变得好小……', { onShow: () => filter(C, 'saturate(.3) brightness(.9)') }),
        nar('Speak loudly to break the silence!', '大声说话，打破这片寂静！'),
        L.speak(C, 'Give back the Subject Crystal!', '大声说：把学科水晶还回来！'),
        nar('Crack! The Hush Stones are breaking!', '咔嚓！静音石裂开了！', { onShow: () => { filter(C, ''); C.E.SFX.hit(); } }),
      ]);
      const r1 = await L.hushFight(C, a, 'gruntF', { lines: [['What?! Our stones! You will pay for this!', '什么？！我们的石头！你要付出代价！']], types: ['poison', 'dark'], n: 2 });
      if (r1 !== 'win') return;
      C.set('f4g1');
    }
    const r2 = await L.hushFight(C, b, 'grunt', {
      lines: [["My turn! Maths, English, science... they're all boring!", '轮到我了！数学、英语、科学……全都无聊透了！']], types: ['poison', 'dark'], n: 2, lv: 2,
      win: ['Shh... The crystal is yours. Run, run!', '嘘……水晶还你们。快跑，快跑！'],
    });
    if (r2 !== 'win') return;
    await L.restoreCrystal(C, 4);
    await C.talk([nar('Doctor Octo is waiting for you at the Gym!', '八爪博士在道馆等你！')]);
    note4(C);
  }
  // 天文台：导师欧瑞讲寂静之王、回声龙和十三颗水晶
  async function orionTalk(C, n) {
    const O = say(n);
    C.faceEach(n);
    if (C.flag('orion4')) { await C.talk([O('The stars remember every word we say.', '星星记得我们说过的每一句话。'), O('Find the crystals, {name}. And keep talking!', '去把水晶找回来吧，{name}。一直说下去！')]); return; }
    await C.talk([
      O("Oh, a visitor. Hello! I'm Orion. I study old words.", '哦，有客人。你好！我叫欧瑞，我研究古老的词语。'),
      O('Look at the stars with me. Let me tell you an old story.', '和我一起看看星星吧，我给你讲一个古老的故事。'),
      O('Long, long ago, the Hush King wanted a world with no words.', '很久很久以前，寂静之王想要一个没有语言的世界。'),
      O('He took every word from every island. The world went silent.', '他从每座岛上拿走了所有的词语，整个世界都沉默了。', { onShow: () => filter(C, 'grayscale(.8)') }),
      O('Then Echodrake, the dragon of voices, began to sing.', '这时，声音之龙——回声龙开始歌唱。', { onShow: () => filter(C, '') }),
      O('Its song woke up the words. People could talk and laugh again.', '它的歌声唤醒了词语，人们又能说话、又能欢笑了。'),
      O('The words were kept in thirteen crystals, one on each island.', '这些词语被收进了十三颗水晶，每座岛一颗。'),
      O('Team Hush is stealing the crystals. They want to wake the Hush King!', '嘘声团在偷水晶，他们想唤醒寂静之王！'),
      L.ask(O, 'What do you think of history?', '你觉得历史课怎么样？', "It's interesting.", ["It's on Friday.", 'I think so.']),
      O('Yes! History is full of stories. Take these for your journey.', '没错！历史里全是故事。这些拿着，路上用得到。', { onShow: () => { C.MG.addItem('superpotion', 2); C.MG.addItem('revive', 1); C.E.save(); C.E.SFX.win(); C.E.toast('🧪 超级药水 +2　✨ 复活药 +1', 'gold'); } }),
      L.speak(C, 'Thank you, Orion!', '对欧瑞说：谢谢你，欧瑞！'),
      O('We will meet again. The stars will guide you.', '我们还会再见的。星星会为你指路。'),
    ]);
    C.set('orion4');
  }

  // ---------- 道馆「课程表开关」 ----------
  const SEQ4 = [
    { gate: 1, y0: 13, y1: 22, start: [8, 22], list: ['m', 'e', 's', 'u'], en: 'First maths, then English, then science, then music.', zh: '先数学，再英语，然后科学，最后音乐。',
      q: ['Which subject is first?', '第一门是什么课？'], right: 'Maths is first.', wrong: ['Music is first.', 'Science is first.'] },
    { gate: 0, y0: 5, y1: 11, start: [8, 11], list: ['h', 'g', 'a', 'c'], en: 'First history, then geography, then art, then Chinese.', zh: '先历史，再地理，然后美术，最后语文。',
      q: ['Which subject is last?', '最后一门是什么课？'], right: 'Chinese is last.', wrong: ['History is last.', 'Art is last.'] },
  ];
  const prog4 = [0, 0];   // 每段已经按对了几个（离开道馆就清零）
  const stage4 = C => SEQ4.findIndex(s => !C.gateOpen(s.gate));
  const bc = (en, zh, x) => Object.assign({ who: 'Gym Speaker', emo: '📢', en, zh }, x || {});
  const cast4 = k => { const s = SEQ4[k]; return [bc(s.en, '（仔细听课程表！按顺序踩地上的学科开关）', { hideEn: true }), L.ask(bc, s.q[0], s.q[1], s.right, s.wrong), bc(s.en, s.zh)]; };
  // 某一段的开关恢复原样（done：解开过的段，把要踩的开关都点亮）
  function paintStage(C, k, done) {
    const s = SEQ4[k];
    for (let y = s.y0; y <= s.y1; y++) for (let x = 0; x < OVER4[y].length; x++) {
      const o = OVER4[y][x];
      if (o !== '.') C.setOver(x, y, done && s.list.includes(o) ? o.toUpperCase() : o);
    }
    prog4[k] = 0;
  }
  function note4g(C) {
    const k = stage4(C);
    if (k < 0) { C.note('🐙 两张课程表都对了！去见八爪博士'); return; }
    C.note('📅 按广播的顺序踩学科开关：第 ' + (k + 1) + ' 张课程表（' + prog4[k] + '/4）<br><small>对着墙角的喇叭按 A 可以再听一遍</small>');
  }
  async function gym4Enter(C) {
    SEQ4.forEach((s, k) => paintStage(C, k, C.gateOpen(s.gate)));
    C.refresh();
    const k = stage4(C);
    if (k >= 0) {
      const pre = C.flag('g4hi') ? [] : [bc('Welcome to the Timetable Gym!', '欢迎来到课程表道馆！'), bc('Listen to the timetable. Step on the subjects in the right order.', '听课程表，按正确的顺序踩地上的学科开关。'), bc('Wrong order? Everything goes back to the start!', '顺序错了？一切从头再来！')];
      C.set('g4hi');
      await C.talk(pre.concat(cast4(k)));
    }
    note4g(C);
  }
  async function step4(C, k, o) {
    const s = SEQ4[k], want = s.list[prog4[k]];
    if (o === want) {
      C.setOver(C.pl.x, C.pl.y, o.toUpperCase());
      C.refresh();
      prog4[k]++;
      C.E.say(SUBJ[o][0]);
      C.E.SFX.ok(1);
      note4g(C);
      if (prog4[k] < s.list.length) return;
      C.openGate(s.gate, true);
      const nx = stage4(C);
      await C.talk([bc('Well done! The door is open!', '太棒了！门开了！', { onShow: () => C.E.SFX.win() })].concat(nx >= 0 ? [bc('Here is the next timetable. Listen carefully!', '下一张课程表来了，仔细听！')].concat(cast4(nx)) : [bc('Doctor Octo is waiting for you!', '八爪博士在等你！')]));
      note4g(C);
      return;
    }
    await C.talk([bc('Beep! Wrong order! Back to the start.', '哔——顺序错了！回到起点。', { onShow: () => C.E.SFX.bad && C.E.SFX.bad() }), bc(s.en, '（再听一遍课程表）', { hideEn: true })]);
    paintStage(C, k, false);
    C.refresh();
    C.teleport(s.start[0], s.start[1], 'up');
    note4g(C);
  }

  ST.isle(4, {
    busy: ['My lab is a mess! I must fix my books first.', '我的实验室一团糟！我得先把书整理好。'],
    enter(C) {
      const id = C.map.id;
      if (id === 't4') return C.flag('f4in') ? () => note4(C) : () => intro4(C);
      if (id === 'i4G') return () => gym4Enter(C);
      if (id === 'i4A' || id === 'i4A2') return () => note4(C);
      return null;
    },
    step(C) {
      if (C.map.id !== 'i4G') return null;
      const pl = C.pl, o = C.over(pl.x, pl.y);
      if (!o || !SUBJ[o]) return null;   // 空地，或者已经点亮的开关（大写）
      const k = SEQ4.findIndex(s => pl.y >= s.y0 && pl.y <= s.y1);
      if (k < 0 || C.gateOpen(SEQ4[k].gate)) return null;
      return () => step4(C, k, o);
    },
    talk(C, n) {
      const id = C.map.id;
      if (id === 'i4A' && n.id === 'octo') return () => octoTalk(C, n);
      if (id === 'i4A2' && n.id === 'orion') return () => orionTalk(C, n);
      if (id === 't4' && (n.id === 'g4a' || n.id === 'g4b')) return () => dishTalk(C, n);
      if (id === 't4' && n.id === 'nova') return () => C.talk([say(n)(C.flag('f4books') ? 'Team Hush is at the satellite dish in the east!' : "Doctor Octo's lab is the glass dome. Please help him!", C.flag('f4books') ? '嘘声团在东边的卫星天线那儿！' : '八爪博士的实验室是那座玻璃圆顶，请帮帮他！')]);
      return null;
    },
    tile(C, f) {
      if (C.map.id === 'i4G' && f.statue) {
        const k = stage4(C);
        return () => C.talk(k >= 0 ? cast4(k) : [bc('The timetable is done. Good job!', '课程表都完成了，干得好！')]);
      }
      return null;
    },
    // 八爪博士在整理实验室时不在道馆
    hidden(C, n) {
      if (n.role === 'leader' && C.map.id === 'i4G') return !C.flag('ch4') && !C.E.S.mon.badges[4];
      return null;
    },
  });
})();
