// 回声岛 · 支线委托（家长 2026-11-15：「把 AI 聊天做进冒险里」）。游戏（world.js / talk.js）、中转服务（server/relay.js）、APK 共用这一份。
// 岛上的人有委托，要走过去用英语和 TA 聊出结果才算完成（问出失主是谁、帮店主点货、说服守门人……），完成了给稀有道具、送怪兽蛋。
// 孩子的手机只把委托的 id 发给中转服务：人设、目标、小步骤都由服务器按 id 从这份文件里读（talk-core.js 的 questNpc()），孩子改不了；
// APK 直连时用的是打包进去的同一份。安全规则照旧由 talk-core.js 的 instructions() 加在每个人设后面。
//
// 每条委托：
//   id      存档里的键（world.flags['q:' + id] = 完成时的星数 1–3），定了就不要改
//   z       第几岛（0–12）；map / npc：谁给的（地图 id + 那张图上这个人的 id，都是本来就站在镇上的人）
//   who / g / kid：这个人的英文名、性别、是不是小孩（和地图上一样，tests/quests.test.js 会核对；音色按这个挑）
//   place   这座岛的英文名（人设里用）；role：这个人是做什么的（人设里用）
//   zh / en 委托的名字
//   ask     按 A 时 TA 在对话框里说的请求，[英文, 中文] 一页一句（固定台词，tools/voice/collect.js 会收去配音）
//   note    可选：一页旁白 [英文, 中文]，交代孩子「手上有的信息」（清单、看到的东西、天气预报）
//   persona 聊天时的人设和 TA 知道的事（英文）；opener 开场白；goal / goalZh 聊天目标
//   steps   孩子要说到的小步骤 [中文, 示范英文]：前 4 座岛 3 步，后面最多 4 步；都是「孩子要说的话」（问 / 告诉 / 建议 / 说服）
//   words   建议用的词 [英文, 中文]
//   need    前提：{ badges: 要几枚徽章, quest: 要先完成哪条委托 }，不写就是到了这座岛就能接
//   reward  奖励（都是现成的东西）：{ coins: 金币, items: [[道具 id, 个数], …], egg: 怪兽 id（给一个蛋）, shiny: true 蛋孵出来是稀有色 }
//   thanks  完成后回到地图上 TA 说的感谢 [英文, 中文]；bye：以后再找 TA 时先说的一句
//
// 写委托的规矩：
//   - 只做游戏里的任务：不问、也不引孩子说真名、学校、住址、年龄、家里的事（人设里写的家人、名字都是游戏角色自己的）
//   - 委托人是做任务的游戏角色，不当「一辈子的朋友」、不做情感陪伴
//   - 示范句用七年级学过的词；前 6 座岛句子短，后面的可以长一点
(function (root) {
  'use strict';
  const QUESTS = [
    // ---------------- 第 1 岛 · 你好岛（问候、名字；七上 Unit 1 特殊疑问句）----------------
    {
      id: 'q0-cap', z: 0, map: 't0', npc: '4', who: 'Ms Rosa', g: 'f', kid: false, place: 'Hello Island', role: 'a kind old lady who lives near the beach',
      zh: '帽子是谁的', en: 'Whose Cap Is It?',
      ask: [
        ['Oh dear! Somebody left a blue cap on the beach.', '哎呀！有人把一顶蓝帽子落在沙滩上了。'],
        ['I know the owner, but my legs are tired today.', '我知道失主是谁，可是我今天腿脚不方便。'],
        ['Can you take it back for me? Ask me about the owner!', '你能帮我送回去吗？问问我失主是谁吧！'],
      ],
      persona: 'You found a blue cap on the beach this morning. You know the owner: a boy called Ben. He has short black hair and wears a green T-shirt, and he is fishing at the dock with Fisher Tom right now. You want the student to take the cap back to Ben, so the student must ask you about him. Do not tell these facts until the student asks for them. Answer one question at a time in one short sentence.',
      opener: 'Thank you, dear! So, what do you want to know about the owner?',
      goal: "Find out who lost the blue cap: ask Ms Rosa the owner's name, what he looks like, and where he is now.",
      goalZh: '问出蓝帽子的失主是谁：他叫什么、长什么样、现在在哪里。',
      steps: [['问失主叫什么名字', 'What is his name?'], ['问失主长什么样', 'What does he look like?'], ['问失主现在在哪里', 'Where is he now?']],
      words: [['Whose', '谁的'], ['cap', '帽子'], ['name', '名字'], ['look like', '看起来像'], ['Where', '在哪里'], ['Thank you', '谢谢']],
      reward: { coins: 50, items: [['superball', 2]] },
      thanks: [['You found Ben! He is so happy to have his cap back.', '你找到 Ben 了！帽子回来了，他可高兴了。'], ['Thank you for your help. Please take these!', '谢谢你帮忙。这些请收下！']],
      bye: ['Hello again, dear! Ben wears his cap every day now.', '又见面啦，孩子！Ben 现在天天戴着那顶帽子。'],
    },
    {
      id: 'q0-visitor', z: 0, map: 't0', npc: '5', who: 'Mr Costa', g: 'm', kid: false, place: 'Hello Island', role: 'the old island greeter',
      zh: '接待新来的客人', en: 'Welcome the Visitor',
      ask: [
        ['Hello, hello! A visitor is coming on the afternoon boat.', '你好你好！下午的船上要来一位客人。'],
        ['I am the island greeter, but I always forget my lines!', '我是岛上的迎宾员，可我老是忘词！'],
        ["Let's practise. I will be the visitor, and you will be the greeter.", '我们来练一练：我扮客人，你来当迎宾员。'],
      ],
      persona: 'You are old and forgetful, so you asked the student to show you how to greet a visitor. In this chat you PLAY the visitor: a ship cook called Finn from Crayon Island, who has just arrived on the afternoon boat. Stay in the role of Finn until the student has greeted you, asked your name and asked where you are from. Only answer what the student asks. If the student forgets a step, give a hint in the role, for example: "Don\'t you want to know my name?" At the end, stop playing Finn and say as Mr Costa: "Now I remember how to do it!"',
      opener: 'OK, I am the visitor now. Ahem! Oh, what a pretty island! Is anybody here?',
      goal: 'Be the island greeter: greet the visitor and welcome him to Hello Island, ask his name, and ask where he is from.',
      goalZh: '当一回迎宾员：向客人问好、欢迎他，问他叫什么、从哪里来。',
      steps: [['用「下午好」问好，欢迎他来你好岛', 'Good afternoon! Welcome to Hello Island!'], ['问他叫什么名字', "What's your name?"], ['问他从哪里来', 'Where are you from?']],
      words: [['Good afternoon', '下午好'], ['Welcome to', '欢迎来到'], ["What's your name", '你叫什么名字'], ['Where are you from', '你从哪里来'], ['Nice to meet you', '很高兴认识你']],
      need: { quest: 'q0-cap' },
      reward: { egg: 'cloudsheep' },
      thanks: [['Now I remember every line. You are a great greeter!', '现在我每句都记住了。你真是个好迎宾员！'], ['A sailor gave me this egg, but I am too old to look after it. It is yours!', '有位水手送了我这个蛋，可我年纪大了照顾不了。送给你吧！']],
      bye: ['Good afternoon! See? I remember my lines now.', '下午好！瞧，我现在记得住词了。'],
    },

    // ---------------- 第 2 岛 · 彩色文具岛（文具、颜色、数字）----------------
    {
      id: 'q1-bag', z: 1, map: 't1', npc: '6', who: 'Lucy', g: 'f', kid: true, place: 'Crayon Island', role: 'a little girl who loves pink',
      zh: '找回 Lucy 的书包', en: "Lucy's Lost Schoolbag",
      ask: [
        ["Oh no! I can't find my schoolbag!", '糟了！我的书包不见了！'],
        ['There are three bags at the lost and found, but I am too shy to ask.', '失物招领处有三个书包，可我不好意思去问。'],
        ['Can you go for me? Ask me what my bag looks like!', '你能替我去吗？先问问我的书包长什么样吧！'],
      ],
      persona: 'You lost your schoolbag today. Your bag is pink, there is a yellow star on it, and inside there are two books, a ruler and a red pencil box. The student will go to the lost and found for you, so they must ask you what your bag looks like. Do not tell these facts until the student asks. Answer one question at a time.',
      opener: 'Thank you! What do you want to know about my bag?',
      goal: "Find out what Lucy's schoolbag looks like: ask what colour it is, what is in it, and what is on it.",
      goalZh: '问清楚 Lucy 的书包长什么样：什么颜色、里面有什么、上面有什么。',
      steps: [['问书包是什么颜色的', 'What colour is your bag?'], ['问书包里有什么', 'What is in your bag?'], ['问书包上面有什么', 'What is on your bag?']],
      words: [['What colour', '什么颜色'], ['schoolbag', '书包'], ['in your bag', '在你的书包里'], ['on your bag', '在你的书包上'], ['pencil box', '铅笔盒'], ['star', '星星']],
      reward: { items: [['leafstone', 1]] },
      thanks: [['My pink bag with the yellow star! You found it!', '有黄星星的粉色书包！你帮我找到了！'], ['This was in my bag. I think it is for monsters. Take it!', '这个本来在我书包里，好像是给怪兽用的。送给你！']],
      bye: ['Hi! I keep my bag with me all the time now.', '嗨！我现在书包一刻都不离身了。'],
    },
    {
      id: 'q1-stock', z: 1, map: 't1', npc: '4', who: 'Ms Pen', g: 'f', kid: false, place: 'Crayon Island', role: 'the lady who looks after the stationery store',
      zh: '帮 Ms Pen 点货', en: 'Count the Stock',
      ask: [
        ['Hello! New boxes came to the stationery store today.', '你好！文具店今天到了几箱新货。'],
        ["But I can't find my glasses, so I can't read the list.", '可是我找不到眼镜，看不清货单。'],
        ['Here is the list. Please read it to me in English!', '货单给你，请用英语念给我听！'],
      ],
      note: ['The list says: red pencils, twelve. Blue rulers, eight. Yellow erasers, none.', '货单上写着：红铅笔 12 支，蓝尺子 8 把，黄橡皮没有了。'],
      persona: 'New boxes came to your stationery store today, but you cannot find your glasses, so you asked the student to read the stock list to you. The list says: twelve red pencils, eight blue rulers, and no yellow erasers. Never say these numbers before the student does. Ask about one thing at a time: first the red pencils, then the blue rulers, then the yellow erasers. Repeat each answer back to check it. If a number is different from the list, kindly ask the student to look at the list again.',
      opener: 'Thank you for helping! First, how many red pencils are there?',
      goal: 'Read the stock list to Ms Pen: say how many red pencils and blue rulers there are, and tell her that there are no yellow erasers.',
      goalZh: '把货单念给 Ms Pen 听：红铅笔 12 支、蓝尺子 8 把、黄橡皮没有了。',
      steps: [['告诉 TA 红铅笔有 12 支', 'There are twelve red pencils.'], ['告诉 TA 蓝尺子有 8 把', 'There are eight blue rulers.'], ['告诉 TA 没有黄橡皮了', 'There are no yellow erasers.']],
      words: [['There are', '有（几个）'], ['twelve', '十二'], ['eight', '八'], ['pencils', '铅笔'], ['rulers', '尺子'], ['erasers', '橡皮'], ['How many', '多少个']],
      need: { badges: 2 },
      reward: { items: [['superball', 3], ['superpotion', 2]] },
      thanks: [['Pencils, rulers and erasers. Now I know what is in every box!', '铅笔、尺子、橡皮——现在每个箱子里有什么我都清楚了！'], ['You have sharp eyes and a clear voice. These are for you.', '你眼睛尖，声音也清楚。这些送给你。']],
      bye: ['Hello! I found my glasses. They were on my head!', '你好！我的眼镜找到了，原来就架在头上！'],
    },

    // ---------------- 第 3 岛 · 温馨家庭岛（家人；七上 Unit 4 There be）----------------
    {
      id: 'q2-photo', z: 2, map: 't2', npc: 'kid', who: 'Little Lucy', g: 'f', kid: true, place: 'Family Island', role: 'a little girl who lives on the farm',
      zh: '照片里都是谁', en: 'Who Is in the Photo?',
      ask: [
        ['Look! This is a photo of my family.', '看！这是我们家的照片。'],
        ["I want to write everyone's name under it, but I can't write yet.", '我想在下面写上每个人是谁，可我还不会写字。'],
        ['Can you write for me? Ask me who they are!', '你能帮我写吗？问问我他们都是谁吧！'],
      ],
      persona: 'You are a little girl with a photo of your family. There are four people in the photo: the tall man with a cap is your father, the woman with long hair is your mother, the baby is your little brother Bobo, and the girl in the yellow dress is you. The student will write the names under the photo for you, so they must ask who each person is. Do not tell who they are until the student asks. Answer one question at a time. Talk only about the people in your photo.',
      opener: 'Here is my photo! Who do you want to know about first?',
      goal: "Find out who is in Lucy's family photo: ask how many people there are, who the tall man is, and who the baby is.",
      goalZh: '问清楚照片里都是谁：一共几个人、高个子男人是谁、小宝宝是谁。',
      steps: [['问照片里有几个人', 'How many people are there in the photo?'], ['问高个子的男人是谁', 'Who is the tall man?'], ['问小宝宝是谁', 'Who is the baby?']],
      words: [['How many people', '多少人'], ['Who is', '……是谁'], ['tall', '高的'], ['father', '爸爸'], ['mother', '妈妈'], ['brother', '兄弟'], ['photo', '照片']],
      reward: { items: [['moonstone', 1]] },
      thanks: [['Father, Mother, Bobo and me. Now everyone has a name!', '爸爸、妈妈、Bobo 和我。现在每个人都写上啦！'], ['I found this shiny thing in the garden. It is for you!', '这是我在花园里捡到的亮晶晶的东西，送给你！']],
      bye: ['Hi! My photo is on the wall now. Everyone can read it.', '嗨！我的照片挂到墙上了，大家都看得懂。'],
    },
    {
      id: 'q2-farm', z: 2, map: 't2', npc: 'joe', who: 'Farmer Joe', g: 'm', kid: false, place: 'Family Island', role: 'a farmer with a windmill',
      zh: '农场的动物在哪里', en: 'Where Are the Farm Animals?',
      ask: [
        ['Oh no! The gate was open, and my animals ran away!', '糟了！栅栏门没关，我的动物都跑出去了！'],
        ['You walked around the island. You saw them, right?', '你在岛上走了一圈，看到它们了吧？'],
        ['Tell me where they are, and I will bring them home!', '告诉我它们在哪儿，我去把它们带回来！'],
      ],
      note: ['You remember: three ducks by the river, and a cow next to the windmill.', '你想起来了：河边有三只鸭子，风车旁边有一头牛。'],
      persona: 'Your farm gate was open and your animals ran away: three ducks, one cow and one little pig. The student saw some of them on the island. You do not know where the animals are. Ask the student about one kind at a time: first the ducks, then the cow. When the student has told you about both, wait for the student to ask which animal is still missing; then say it is your little pig, and remember that the pig always sleeps under the apple tree.',
      opener: 'Thank you! First, my ducks. Where are they?',
      goal: 'Help Farmer Joe find his animals: tell him where the ducks and the cow are, and ask which animal is still missing.',
      goalZh: '帮 Farmer Joe 找动物：告诉他鸭子和牛在哪里，再问问还少了哪只。',
      steps: [['告诉 TA 河边有三只鸭子', 'There are three ducks by the river.'], ['告诉 TA 风车旁边有一头牛', 'There is a cow next to the windmill.'], ['问 TA 还少了哪只动物', 'Which animal is still missing?']],
      words: [['There is', '有（一个）'], ['There are', '有（几个）'], ['ducks', '鸭子'], ['cow', '奶牛'], ['by the river', '在河边'], ['next to', '在……旁边'], ['windmill', '风车'], ['missing', '不见了的']],
      need: { quest: 'q2-photo' },
      reward: { coins: 80, items: [['revive', 2]] },
      thanks: [['Three ducks, one cow and my little pig. Everyone is home!', '三只鸭子、一头牛，还有我的小猪，全都回家了！'], ['These fruits are from my farm. They make tired monsters strong again.', '这是我农场里的果子，累倒的怪兽吃了就有力气。']],
      bye: ['Hello! The gate is closed today. I checked it three times!', '你好！今天栅栏门关好了，我检查了三遍！'],
    },

    // ---------------- 第 4 岛 · 校园岛（学校里的地方、方位；七上 Unit 5 will / be going to）----------------
    {
      id: 'q3-way', z: 3, map: 't3', npc: 'st1', who: 'Student Lily', g: 'f', kid: true, place: 'Campus Island', role: 'a student at the island school',
      zh: '帮 Lily 画学校地图', en: 'Draw the School Map',
      ask: [
        ["Hi! I'm drawing a school map for the new students.", '嗨！我在给新同学画一张学校地图。'],
        ['But I always mix up the places. Where is everything?', '可我老是把地方记混。每个地方都在哪儿呀？'],
        ['You walk around a lot. Please tell me where they are!', '你到处都走过，请告诉我它们在哪儿吧！'],
      ],
      note: ['You remember: the library is across from the gym. The English classroom is on the second floor. The dining hall is next to the library.', '你想起来了：图书馆在体育馆对面，英语教室在二楼，食堂在图书馆旁边。'],
      persona: 'You are drawing a map of the school for new students, but you always mix up the places. Ask the student where three places are, one at a time: the library, the English classroom, and the dining hall. You are not sure where they are. The right answers are: the library is across from the gym; the English classroom is on the second floor; the dining hall is next to the library. If the student says something different, say you are not sure and ask them to think again. Repeat each answer as you draw it on your map.',
      opener: 'Great! First, where is the library?',
      goal: 'Help Lily draw the school map: tell her where the library, the English classroom and the dining hall are.',
      goalZh: '帮 Lily 画学校地图：告诉她图书馆、英语教室、食堂各在哪里。',
      steps: [['告诉 TA 图书馆在体育馆对面', 'The library is across from the gym.'], ['告诉 TA 英语教室在二楼', 'The English classroom is on the second floor.'], ['告诉 TA 食堂在图书馆旁边', 'The dining hall is next to the library.']],
      words: [['library', '图书馆'], ['gym', '体育馆'], ['dining hall', '食堂'], ['classroom', '教室'], ['across from', '在……对面'], ['next to', '在……旁边'], ['on the second floor', '在二楼']],
      reward: { items: [['superball', 3], ['fullheal', 1]] },
      thanks: [['My map is finished! The new students will not get lost.', '地图画好了！新同学不会迷路啦。'], ['Here, these are from the school shop. Thank you!', '给，这些是学校小卖部的东西。谢谢你！']],
      bye: ['Hi! Everyone uses my map now. It is on the school gate.', '嗨！现在大家都在用我的地图，就贴在校门口。'],
    },
    {
      id: 'q3-fair', z: 3, map: 't3', npc: 'coach', who: 'Coach Lee', g: 'm', kid: false, place: 'Campus Island', role: 'the PE teacher at the island school',
      zh: '安排运动会', en: 'Plan the Sports Day',
      ask: [
        ['Hey! Our school sports day is next week.', '嘿！下周就是学校运动会了。'],
        ["I must tell everyone the plan, but I haven't made it yet!", '我得把安排告诉大家，可我还没定好呢！'],
        ['You are a good trainer. Help me plan it!', '你是个好训练师，帮我定一定吧！'],
      ],
      persona: 'The school sports day is next week and you have not made the plan yet, so you asked the student to plan it with you. Ask three things, one at a time, and write each answer on your clipboard: what day and what time it will start, where everyone will meet, and what everyone will bring. Any sensible answer is fine; the student decides. Repeat the whole plan back at the end.',
      opener: 'Thanks! First, what day and what time will the sports day start?',
      goal: 'Plan the school sports day with Coach Lee: say when it will start, where everyone will meet, and what everyone will bring.',
      goalZh: '和 Coach Lee 一起定运动会：哪天几点开始、在哪里集合、大家带什么。',
      steps: [['说运动会哪天、几点开始', 'It will start at nine on Friday.'], ['说在哪里集合', 'We are going to meet at the playground.'], ['说大家要带什么', 'Everyone will bring water and a hat.']],
      words: [['will start', '将要开始'], ['on Friday', '在星期五'], ['at nine', '在九点'], ['be going to', '打算'], ['meet', '集合'], ['playground', '操场'], ['bring', '带来']],
      need: { badges: 4 },
      reward: { egg: 'schoolbell' },
      thanks: [['The plan is on the notice board now. Everyone is excited!', '安排已经贴到公告栏上了，大家都很期待！'], ['This egg was in the PE room. I think it likes you. Take good care of it!', '这个蛋是在体育器材室发现的，它好像喜欢你。好好照顾它！']],
      bye: ["Hey! Don't be late for the sports day!", '嘿！运动会可别迟到！'],
    },

    // ---------------- 第 5 岛 · 学科岛（科目、为什么；说服）----------------
    {
      id: 'q4-maths', z: 4, map: 't4', npc: 'kidL', who: 'Student Max', g: 'm', kid: true, place: 'Subject Island', role: 'a student who thinks maths is difficult',
      zh: '劝 Max 回数学社', en: 'Cheer Max Up About Maths',
      ask: [
        ['I got a bad mark in maths again.', '我数学又没考好。'],
        ["Maths is too difficult. I don't want to go to the maths club any more.", '数学太难了，我不想再去数学社了。'],
        ['Do you really think I should go? Tell me why.', '你真觉得我该去吗？说说为什么。'],
      ],
      persona: 'You think maths is difficult and boring. You got a bad mark and you want to stop going to the maths club. The student will try to change your mind. At first you say no. Change your mind only after the student has asked why you do not like maths, given you two different reasons why maths is useful or fun, and offered to study with you. After each reason, answer with a small doubt, for example: "Hmm, maybe. But is it fun?" Then agree happily to go back to the maths club.',
      opener: "Hmm... I don't want to go. Maths is not for me.",
      goal: "Persuade Max to go back to the maths club: ask why he doesn't like maths, give him two reasons why maths is useful or fun, and offer to study together.",
      goalZh: '说服 Max 回数学社：问他为什么不喜欢数学，说出两个数学有用或有趣的理由，再约他一起学。',
      steps: [['问 TA 为什么不喜欢数学', "Why don't you like maths?"], ['说一个数学有用或有趣的理由', 'Maths is useful when you go shopping.'], ['再说一个理由', 'Maths games are fun, too.'], ['约 TA 一起学', "Let's do our maths homework together."]],
      words: [['Why', '为什么'], ['because', '因为'], ['useful', '有用的'], ['interesting', '有趣的'], ['difficult', '难的'], ['together', '一起'], ["Let's", '我们……吧']],
      reward: { coins: 100, items: [['thunderstone', 1]] },
      thanks: [['I went to the maths club, and it was fun this time!', '我去数学社了，这次还挺有意思的！'], ['You gave me good reasons. This is my thank-you gift.', '你说的理由很有道理。这是我的谢礼。']],
      bye: ['Hi! I got a better mark in maths this week!', '嗨！我这周数学考得好多了！'],
    },

    // ---------------- 第 6 岛 · 社团岛（can / can't）----------------
    {
      id: 'q5-club', z: 5, map: 't5', npc: '8', who: 'Chess Club Amy', g: 'f', kid: true, place: 'Club Island', role: 'a student in the chess club',
      zh: '帮 Amy 再选一个社团', en: 'Find a Club for Amy',
      ask: [
        ['Hi! I love the chess club, but I want to join one more club.', '嗨！我喜欢国际象棋社，可我还想再参加一个社团。'],
        ["There are so many clubs here. I can't choose!", '这里的社团太多了，我挑花眼了！'],
        ['Ask me some questions, and tell me which club is best for me.', '问我几个问题，再告诉我哪个社团最适合我。'],
      ],
      persona: 'You are in the chess club, and you want to join one more club on Club Island, but you cannot choose. The other clubs are: the music club (Monday, everyone must sing), the art club (Wednesday), the dance club (Friday) and the swimming club (Saturday). Facts about you: you can play chess and you can draw, but you cannot dance and you cannot swim; you like quiet places and you like making pictures; you are free only on Wednesday and Saturday. Do not tell these facts until the student asks. Answer one question at a time. When the student tells you which club to join and gives a reason, accept any club that fits the facts about you (the art club fits best) and thank them. If the club does not fit, for example the dance club because you cannot dance, say why and ask them to choose again.',
      opener: 'OK! Ask me anything. What do you want to know about me?',
      goal: 'Help Amy choose a club: ask what she can do, what she likes and when she is free, then tell her which club to join and why.',
      goalZh: '帮 Amy 选社团：问她会什么、喜欢什么、哪天有空，再告诉她该进哪个社团、为什么。',
      steps: [['问 TA 会做什么', 'What can you do?'], ['问 TA 喜欢做什么', 'What do you like doing?'], ['问 TA 哪天有空', 'When are you free?'], ['推荐一个社团，并说出理由', 'You can join the art club, because you can draw.']],
      words: [['can', '会；能'], ["can't", '不会'], ['club', '社团'], ['join', '加入'], ['free', '有空的'], ['draw', '画画'], ['because', '因为']],
      reward: { items: [['waterstone', 1], ['superball', 3]] },
      thanks: [['I joined the club, and I drew a picture of my chess set!', '我进了社团，还画了一幅我的国际象棋！'], ['You asked very good questions. Here, this is for you!', '你问的问题真好。给，这个送你！']],
      bye: ['Hi! Come and see my pictures at the club show!', '嗨！来社团展上看我的画吧！'],
    },

    // ---------------- 第 7 岛 · 作息岛（一天的安排、时间）----------------
    {
      id: 'q6-tea', z: 6, map: 't6', npc: '6', who: 'Mrs. Hands', g: 'f', kid: false, place: 'Clock Island', role: 'an old lady who is never late',
      zh: '帮 Mrs. Hands 约下午茶', en: 'Tea Time with the Mayor',
      ask: [
        ['Oh, hello! Mayor Tick wants to come for tea today.', '哦，你好！Tick 镇长今天想来我家喝茶。'],
        ['But my day is very full. When can he come?', '可我一天排得满满的，他什么时候来好呢？'],
        ['Ask me about my day, and find a good time for us!', '问问我一天都做什么，帮我们找个合适的时间吧！'],
      ],
      persona: 'Mayor Tick wants to come for tea today, and you asked the student to find a good time. Your day: you get up at six and have a cup of tea; from eight to eleven in the morning you work in your garden; you have lunch at twelve; you take a nap from one to three; you are free from three to five in the afternoon; you cook dinner at half past five. Do not tell your whole day at once: answer only what the student asks, one thing at a time. When the student suggests a time for tea, say yes only if it is between three and five in the afternoon; if not, say what you are doing at that time and ask for another time.',
      opener: 'Thank you, dear. What do you want to know about my day?',
      goal: 'Find a good time for tea: ask Mrs. Hands what she does in the morning, what time she has lunch, and when she is free in the afternoon, then suggest a time.',
      goalZh: '帮 Mrs. Hands 找出喝茶的时间：问她上午做什么、几点吃午饭、下午什么时候有空，再约一个时间。',
      steps: [['问 TA 上午做什么', 'What do you do in the morning?'], ['问 TA 几点吃午饭', 'What time do you have lunch?'], ['问 TA 下午什么时候有空', 'When are you free in the afternoon?'], ['约一个喝茶的时间', "Let's have tea at four o'clock."]],
      words: [['What time', '几点'], ['in the morning', '在上午'], ['in the afternoon', '在下午'], ['have lunch', '吃午饭'], ['free', '有空的'], ["o'clock", '……点钟'], ['usually', '通常']],
      reward: { items: [['sunstone', 1], ['fullheal', 2]] },
      thanks: [['The mayor came at the right time, and we had a lovely tea.', '镇长来的时间刚刚好，我们喝了一顿很棒的下午茶。'], ['You are good with time, dear. Please take these.', '你真会安排时间，孩子。这些请收下。']],
      bye: ['Hello, dear! It is tea time. I am never late now.', '你好呀，孩子！到喝茶的时间了，我现在从不迟到。'],
    },

    // ---------------- 第 8 岛 · 生日派对岛（日期、食物、礼物）----------------
    {
      id: 'q7-party', z: 7, map: 't7', npc: '4', who: 'Balloon Clown', g: 'm', kid: false, place: 'Party Island', role: 'a clown who makes balloons for birthday parties',
      zh: '给 Pop 办生日派对', en: 'A Birthday Party for Pop',
      ask: [
        ['Psst! My little monster Pop has a birthday soon.', '嘘！我的小怪兽 Pop 快过生日了。'],
        ['I want to give it a surprise party, but I am bad at plans.', '我想给它办个惊喜派对，可我最不会做计划了。'],
        ['You are good at this. Help me plan the party!', '你最在行了，帮我一起策划吧！'],
      ],
      persona: 'Your little monster Pop has a birthday on May 5th and you want to give it a surprise party. You are bad at plans, so you asked the student to plan it with you. First let the student ask when the birthday is. Then ask the student, one thing at a time: what food to have, what gift to give Pop, and what time the party will start. Any sensible answer is fine; the student decides. Pop loves noodles and red things; say that only if the student asks what Pop likes. Repeat the whole plan back at the end.',
      opener: 'Shh! It is a secret. So, what do you want to know first?',
      goal: 'Plan a surprise birthday party for Pop: ask when its birthday is, then say what food to have, what gift to give, and what time the party will start.',
      goalZh: '给 Pop 策划惊喜生日派对：问清生日是哪天，再定吃什么、送什么礼物、几点开始。',
      steps: [['问 Pop 的生日是哪一天', "When is Pop's birthday?"], ['说派对上吃什么', "Let's have a cake and some noodles."], ['说送什么礼物', 'We can give Pop a red balloon.'], ['说派对几点开始', "The party can start at three o'clock."]],
      words: [['When', '什么时候'], ['birthday', '生日'], ['May', '五月'], ['cake', '蛋糕'], ['noodles', '面条'], ['gift', '礼物'], ['balloon', '气球'], ['party', '派对']],
      reward: { coins: 120, items: [['superball', 5], ['revive', 2]] },
      thanks: [['Surprise! Pop loved the party. It danced all afternoon!', '惊喜成功！Pop 可喜欢这个派对了，跳了一下午的舞！'], ['A good planner gets a party bag. Here you are!', '策划高手也有一份派对礼包。给你！']],
      bye: ['Happy birthday... oh, it is you! Pop says hello!', '生日快乐……哦，是你呀！Pop 向你问好！'],
    },

    // ---------------- 第 9 岛 · 动物岛（描述动物；七下 Unit 3 现在进行时、Unit 4 方位）----------------
    {
      id: 'q8-missing', z: 8, map: 't8', npc: '1', who: 'Zookeeper Tom', g: 'm', kid: false, place: 'Animal Island', role: 'the keeper of the Animal Park',
      zh: '走丢的小怪兽', en: 'The Missing Monster',
      ask: [
        ['Hello! A little monster ran out of the Animal Park this morning.', '你好！今天早上有只小怪兽从动物公园跑出去了。'],
        ['You came along the river road. Did you see it?', '你是从河边那条路过来的，看见它了吗？'],
        ['We have many monsters here. Tell me about it, and I will know which one it is!', '我们这儿怪兽很多。给我讲讲它的样子，我就知道是哪一只了！'],
      ],
      note: ['You remember: a small grey monster with a black mask on its face. It was eating food from a bin behind the tree house.', '你想起来了：树屋后面有一只灰色的小怪兽，脸上像戴着黑面罩，正在翻垃圾桶找吃的。'],
      persona: 'A little monster ran out of the Animal Park this morning and you must find out which one it is. The student saw it. You do not know the answers. Ask the student, one thing at a time: how big it is and what colour it is, what it looks like, what it is doing, and where it is. The missing monster is a Nightpaw: small and grey, with a black mask on its face; it likes taking food from bins. When the student has described it, say happily: "Ah! That is our Nightpaw!" and thank them.',
      opener: 'Thanks for helping! First, how big is it, and what colour is it?',
      goal: 'Describe the missing monster to Zookeeper Tom: say how big it is and its colour, what it looks like, what it is doing, and where it is.',
      goalZh: '把你看到的小怪兽讲给管理员听：多大、什么颜色，长什么样，正在做什么，在哪里。',
      steps: [['说它多大、什么颜色', 'It is small and grey.'], ['说它长什么样', 'It has a black mask on its face.'], ['说它正在做什么', 'It is eating food from a bin.'], ['说它在哪里', 'It is behind the tree house.']],
      words: [['small', '小的'], ['grey', '灰色的'], ['mask', '面罩'], ['It has', '它有'], ['is eating', '正在吃'], ['bin', '垃圾桶'], ['behind', '在……后面'], ['tree house', '树屋']],
      reward: { egg: 'nightpaw', items: [['superball', 2]] },
      thanks: [['We found it behind the tree house. It is safe now!', '我们在树屋后面找到它了，现在它很安全！'], ['It left an egg in its bed. A good trainer should have it. Take it!', '它在窝里留下了一个蛋，应该交给一位好训练师。你带走吧！']],
      bye: ['Hello! Our Nightpaw is sleeping now. Shh!', '你好！我们的夜爪狸正在睡觉呢。嘘！'],
    },

    // ---------------- 第 10 岛 · 规则城（规则、礼貌地请求；说服守门人）----------------
    {
      id: 'q9-guard', z: 9, map: 't9', npc: '1', who: 'Officer Kim', g: 'f', kid: false, place: 'Rule City', role: 'a police officer who guards the gate of the City Garden',
      zh: '说服守门的 Officer Kim', en: 'Ask Officer Kim Politely',
      ask: [
        ["Stop, please! The City Garden closes at five o'clock.", '请留步！城市花园五点就关门了。'],
        ["What? Your monster's ball is in the garden?", '什么？你的怪兽把球落在花园里了？'],
        ['Rules are rules. But if you ask politely and give me good reasons, I will think about it.', '规矩就是规矩。不过，你要是有礼貌地问，再说出好理由，我可以考虑考虑。'],
      ],
      persona: 'The City Garden closed at five o\'clock and the rule is: no visitors after five. The student\'s monster left its ball inside and the student wants to go in. You are strict but fair. Do not open the gate at first. Open it only after the student has done all of these: asked politely with "May I" or "Could I" and "please"; given two different reasons; and promised to follow the rules inside (for example to be quiet, not to run, or to come back quickly). After each thing the student says, answer in one short sentence and ask for the next thing, for example: "That is one reason. Do you have another one?" If the student is rude or just says "open the gate", kindly remind them to ask politely. When everything is done, open the gate and say: "You may go in for five minutes."',
      opener: 'Good evening. The garden is closed. What can I do for you?',
      goal: 'Persuade Officer Kim to let you into the City Garden: ask politely, give two reasons, and promise to follow the rules.',
      goalZh: '说服 Officer Kim 让你进花园：礼貌地请求，说出两个理由，再保证守规矩。',
      steps: [['礼貌地请求进花园', 'Excuse me, may I go into the garden, please?'], ['说第一个理由', "My monster's ball is in there."], ['再说一个理由', 'It will only take two minutes.'], ['保证守规矩', "I will be quiet, and I won't run."]],
      words: [['Excuse me', '打扰一下'], ['May I', '我可以……吗'], ['please', '请'], ['because', '因为'], ['only', '只'], ['I will', '我会'], ["I won't", '我不会'], ['rules', '规则']],
      reward: { items: [['icestone', 1], ['superpotion', 3]] },
      thanks: [['You were polite, and you kept every rule. Well done!', '你很有礼貌，规矩也都遵守了。做得好！'], ['Polite words open many doors. This is a gift from the city.', '有礼貌，走到哪儿门都会为你开。这是市里送你的礼物。']],
      bye: ['Good day! Remember: ask politely, and people will listen.', '你好！记住：有礼貌地说，别人才愿意听。'],
    },

    // ---------------- 第 11 岛 · 运动美食岛（点餐、数量、价钱）----------------
    {
      id: 'q10-order', z: 10, map: 't10', npc: '1', who: 'Chef Mei', g: 'f', kid: false, place: 'Sports Island', role: 'a chef with a busy food stall at the food festival',
      zh: '替运动队点午饭', en: 'Order Lunch for the Team',
      ask: [
        ['Welcome to my food stall! It is very busy today.', '欢迎光临我的小吃摊！今天可真忙。'],
        ["Coach Tom's team is hungry, but they are still running.", 'Coach Tom 的队员们都饿了，可他们还在跑步。'],
        ['You can order for them. What would the team like?', '你来替他们点吧。运动队想吃点什么？'],
      ],
      note: ["The team's note says: three bowls of beef noodles and two glasses of orange juice.", '运动队的纸条上写着：三碗牛肉面、两杯橙汁。'],
      persona: 'You run a busy food stall at the food festival. The student is ordering lunch for Coach Tom\'s sports team. You do not know the order until the student tells you. Take the order: ask what food they would like and how many, then what drinks. Prices: a bowl of beef noodles is twelve coins and a glass of orange juice is five coins, so three bowls and two glasses are forty-six coins. Tell the price only when the student asks how much it is. The food will be ready in ten minutes; say that only when the student asks when it will be ready. Repeat the order back to check it.',
      opener: 'Hello! What would the team like to eat?',
      goal: 'Order lunch for the sports team: order three bowls of beef noodles and two glasses of orange juice, ask how much it is, and ask when it will be ready.',
      goalZh: '替运动队点午饭：三碗牛肉面、两杯橙汁，问一共多少钱，再问什么时候做好。',
      steps: [['点三碗牛肉面', "We'd like three bowls of beef noodles, please."], ['再点两杯橙汁', 'And two glasses of orange juice, please.'], ['问一共多少钱', 'How much is it?'], ['问什么时候能做好', 'When will it be ready?']],
      words: [["We'd like", '我们想要'], ['bowls of', '……碗'], ['beef noodles', '牛肉面'], ['glasses of', '……杯'], ['orange juice', '橙汁'], ['How much', '多少钱'], ['ready', '准备好的']],
      reward: { items: [['firestone', 1], ['revive', 3]] },
      thanks: [['The team ate everything. They say thank you!', '运动队把饭吃得干干净净，他们说谢谢你！'], ['A good helper gets a gift from the chef. Enjoy!', '好帮手有厨师的礼物。请收下！']],
      bye: ['Hello! Are you hungry? My noodles are the best on the island!', '你好！饿了吗？我的面条可是全岛最好吃的！'],
    },

    // ---------------- 第 12 岛 · 天气岛（天气、建议；七下 Unit 7 祈使句）----------------
    {
      id: 'q11-ski', z: 11, map: 't11', npc: 'skier11', who: 'Skier Lily', g: 'f', kid: false, place: 'Weather Island', role: 'a skier who loves the ice lake',
      zh: '给 Lily 的滑雪建议', en: "Lily's Ski Trip",
      ask: [
        ['Hi! I want to go skiing on Snow Mountain tomorrow.', '嗨！我明天想去雪山滑雪。'],
        ['But the weather changes so fast here. Is it safe?', '可这里的天气说变就变。安全吗？'],
        ['You saw the weather report at the station. What should I do?', '你在气象台看过天气预报了。我该怎么办？'],
      ],
      note: ['The weather report says: sunny tomorrow morning, heavy snow in the afternoon.', '天气预报说：明天上午晴，下午有大雪。'],
      persona: 'You want to go skiing on Snow Mountain tomorrow, but you do not know what the weather will be like. The student read the weather report. Ask the student about the weather first, then ask for advice, one thing at a time: when you should go, what you should take, and what you should not do. Listen to the advice and repeat it back. The report says: sunny in the morning, heavy snow in the afternoon; never say this before the student does. If the student tells you to ski in the afternoon, ask: "But is it safe in heavy snow?"',
      opener: 'Thanks! So, what will the weather be like tomorrow?',
      goal: "Help Lily plan a safe ski trip: tell her tomorrow's weather, when to go, what to take, and what not to do.",
      goalZh: '帮 Lily 安排一次安全的滑雪：告诉她明天的天气，建议什么时候去、带什么、别做什么。',
      steps: [['告诉 TA 明天上午晴、下午有大雪', 'It will be sunny in the morning, but it will snow heavily in the afternoon.'], ['建议 TA 上午去滑雪', 'Go skiing in the morning.'], ['提醒 TA 带什么', 'Take a warm coat and gloves.'], ['提醒 TA 别做什么', "Don't stay on the mountain after lunch."]],
      words: [['sunny', '晴朗的'], ['snow heavily', '下大雪'], ['in the morning', '在上午'], ['Go skiing', '去滑雪'], ['Take', '带上'], ["Don't", '不要'], ['warm coat', '暖和的外套'], ['gloves', '手套']],
      reward: { egg: 'frostdeer', items: [['superball', 3]] },
      thanks: [['I skied in the morning sun and came home before the snow. Perfect!', '我趁上午出太阳滑了雪，下雪前就回家了。太完美了！'], ['I found this egg near the ice lake. It needs a good trainer like you.', '这个蛋是我在冰湖边发现的，它需要一位像你这样的好训练师。']],
      bye: ['Hi! I always check the weather report before I ski now.', '嗨！我现在滑雪前都先看天气预报。'],
    },

    // ---------------- 第 13 岛 · 回忆岛（一般过去时；复述一件事）----------------
    {
      id: 'q12-album', z: 12, map: 't12', npc: 'old12', who: 'Grandpa Tang', g: 'm', kid: false, place: 'Memory Island', role: 'an old man with an old photo album',
      zh: '帮 Grandpa Tang 找回回忆', en: "Grandpa Tang's Photo Album",
      ask: [
        ['Hello, young trainer. This is my old photo album.', '你好，小训练师。这是我的旧相册。'],
        ['The fog on this island takes memories away. I am forgetting my best trip.', '这座岛的雾会把回忆带走。我最棒的那次旅行，我快要记不清了。'],
        ['Ask me about it, slowly. Maybe your questions will bring it back.', '慢慢问我吧，也许你的问题能帮我把它想起来。'],
      ],
      persona: 'The fog on Memory Island makes you forget things, and you asked the student to help you remember your best trip by asking questions. The memory: when you were young, you went to the Waterfall River with your monster partner, a little dragon; you climbed the waterfall; at the top you saw a rainbow and a sleeping dragon; you took a lot of photos; it was a great day. You remember each part only when the student asks about it, so answer one question at a time, slowly, in the past tense. When the student has asked where you went, who you went with and what you saw, ask the student to tell the whole story back to you so that you will not forget it again. Gently help with past tense verbs if needed (go - went, see - saw, take - took).',
      opener: 'Hmm... a trip... a long time ago. What do you want to ask me?',
      goal: 'Help Grandpa Tang remember his best trip: ask where he went, who he went with and what he saw, then tell the story back to him in two sentences.',
      goalZh: '帮 Grandpa Tang 想起最棒的旅行：问他去了哪里、和谁去的、看到了什么，再用两句话把故事讲给他听。',
      steps: [['问 TA 那次去了哪里', 'Where did you go on that trip?'], ['问 TA 和谁一起去的', 'Who did you go with?'], ['问 TA 看到了什么', 'What did you see there?'], ['用两句话把故事讲一遍', 'You went to the waterfall with your monster. You saw a rainbow and took photos.']],
      words: [['Where did you go', '你去了哪里'], ['Who', '谁'], ['went', '去了（go 的过去式）'], ['saw', '看见了（see 的过去式）'], ['took photos', '拍了照片'], ['waterfall', '瀑布'], ['rainbow', '彩虹'], ['trip', '旅行']],
      need: { badges: 12 },
      reward: { coins: 300, egg: 'scalepup', shiny: true },
      thanks: [['Now I remember it all: the waterfall, the rainbow, my little dragon.', '现在我全想起来了：瀑布、彩虹，还有我的小龙。'], ['My old partner left this egg for a brave trainer. I think it shines for you.', '我的老伙伴留下了这个蛋，要送给一位勇敢的训练师。我看它是在为你发光。']],
      bye: ['Hello again. Thanks to you, I tell my story to the children every day.', '又见面了。多亏了你，我现在每天都给孩子们讲这个故事。'],
    },
  ];
  const api = { list: QUESTS, byId: Object.fromEntries(QUESTS.map(q => [q.id, q])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QUESTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
