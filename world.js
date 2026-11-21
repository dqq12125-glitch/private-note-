// 回声岛 · 大地图冒险：小镇、道路、洞穴、房子内部；走路、跳台阶、草丛遇怪、训练师、休息站/电脑、商店、挑战馆、英语对话
// 画面由渲染器负责：world3d.js 的 2.5D 画面，或者本文件里的 2D「流畅模式」
(function () {
  'use strict';

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const STEP_MS = 170, JUMP_MS = 300, BIKE_MS = 95;
  const TRAINER_NAMES = ['Jack', 'Amy', 'Ben', 'Kate', 'Sam', 'Lucy', 'Mike', 'Anna', 'Leo', 'Mia', 'Max', 'Emma', 'Tony', 'Nora', 'Owen', 'Ruby', 'Dan', 'Ivy'];
  const PICKS = ['ball', 'potion', 'repel', 'superball', 'superpotion', 'revive', 'leafstone', 'firestone', 'waterstone', 'thunderstone', 'moonstone'];

  // ---------- 界面文字（i18n.js 字表；键前缀 w.） ----------
  // 2026-11-19 搬进来（游戏给所有人用，界面要有英文）。中文和原来一字不差；英文给学英语的人看，写得短、写得浅。
  // 台词（人、告示牌说的英文 + 中文意思）是内容，不在这里：P / S / nar 的第二个参数、coins 的第三个参数、页面的 zh 字段
  // @i18n-content-calls P:1 S:1 nar:1 coins:2
  const I18N = window.EchoI18n;
  const tx = (k, p) => (I18N ? I18N.t(k, p) : k), hx = (k, p) => (I18N ? I18N.h(k, p) : k);
  // 数据里有 zh / en 两个名字的（道具、属性、委托、技能）：按界面语言取
  const L = o => (I18N ? I18N.label(o) : (o && o.zh) || '');
  // 内容的中文意思（台词、怪兽的中文名……）：中文界面给中文，英语界面给 null（不显示）
  const gloss = o => (I18N ? I18N.gloss(o) : (o && o.zh) || null);
  // 界面语言就是要学的语言（英语界面）：「中文 + 英文」并排的地方只留一个
  const sameLang = () => !!I18N && I18N.gloss({ [I18N.lang()]: 1 }) == null;
  // 内容（台词、线索）现在只有中文意思：别的界面语言没有可显示的翻译，「剧情中文」这个设置就不出现
  const CONTENT_GLOSS = ['zh'];
  if (I18N) I18N.add({
    zh: {
      'w.who.nar': '旁白', 'w.who.sign': '告示牌', 'w.who.statue': '雕像',
      'w.place.isle': '第 {n} 岛', 'w.place.town': '第 {n} 镇', 'w.place.route': '{n} 号路', 'w.place.cave': '回声洞 {n}', 'w.place.cave.sub': '{n} 号路旁边',
      'w.room.C': '休息站', 'w.room.M': '商店', 'w.room.G': '挑战馆', 'w.room.H': '民居', 'w.room.J': '民居', 'w.room.L': '英语冠军赛会场',
      'w.room.1': '第一位擂主', 'w.room.2': '第二位擂主', 'w.room.3': '第三位擂主', 'w.room.4': '第四位擂主', 'w.room.5': '冠军的房间',
      'w.hud.wild': '野外 Lv {a}–{b}', 'w.hud.home': '回首页', 'w.hud.goal': '现在要做什么', 'w.hud.bike': '骑车', 'w.hud.menu': '菜单',
      'w.pad.up': '上', 'w.pad.left': '左', 'w.pad.right': '右', 'w.pad.down': '下', 'w.hud.chat': '英语聊天', 'w.hud.a': '对话',
      // 别的语言的课（tools/course/ENGINE.md）：写着「英语」的几句换成这门语言（i18n.js 的 variant）；剧情里换掉的说话任务、选回答的说明
      'w.hud.chat.c': '{lang}聊天', 'w.lang.say': '用{lang}说出来：', 'w.lang.ans': '听一听，选出合适的回答，用{lang}说出来。', 'w.lang.pic': '这个用{lang}怎么说？选出来，再说出来。',
      'w.sk.intro.c': '一共四种回声技能。先从剧情里的人手上拿到回声贝，再拿够徽章才能用；后面拿到的回声贝会让技能升一级。队伍里要有合适属性的怪兽，用的时候要大声对它说一句{lang}。',
      'w.hud.north': '指北针：红尖指着北边，点一下转回正北', 'w.help.cam': '🧭 新画风的户外：在右半边屏幕上拖动可以转视角（转一整圈都行），双击回到自己身后；转了以后右上角有指北针，点一下转回正北。电脑上按住右键拖，或者按 Q / E。',
      'w.goal.toast': '📍 现在要做：{t}',
      'w.q.tip': '📋 新玩法「委托」：头上有金色 ? 的人有事请你帮忙——走过去按 A，用英语帮 TA，有稀有奖励！',
      'w.kick.day': '🌅 新的一天！先完成今天的小任务', 'w.kick.gate': '📚 先完成今天的小任务，再来冒险吧',
      'w.shore': '🏖️ 上岸了', 'w.spray.off': '🧴 悄悄喷雾的效果消失了', 'w.spray.on': '🧴 接下来 100 步不会遇到野生怪兽', 'w.hatch.shiny': '✨ 是稀有色的！',
      'w.aiskip': '📶 先跳过（已放进复习，联网后要补说）', 'w.skip': '先跳过',
      'w.dlg.hear': '再听一遍', 'w.dlg.listen': '🔊 仔细听！（点右上角的喇叭再听一遍）', 'w.dlg.zh.aria': '看中文', 'w.dlg.zh.btn': '译',
      'w.mic.aria': '开始说话', 'w.mic.down': '📶 AI 打分暂时用不了：可以先跳过，联网以后在复习里补说', 'w.mic.tap': '点麦克风，大声说出来',
      'w.self.hint': '大声说出来，说完点「我说完了」', 'w.self.done': '🎤 我说完了',
      'w.ans.down': '📶 AI 打分暂时用不了：<b>直接点出正确的回答</b>（这句已放进复习，联网后要补说）',
      'w.ans.sr': '选一句正确的回答，<b>大声说出来</b>（点选项可以先听）', 'w.ans.self': '点出正确的回答，再大声说一遍',
      'w.ans.ok': '选对了！大声说一遍，然后点 <button class="btn small leaf" data-act="wSelfDone">🎤 我说完了</button>',
      'w.ans.nomatch': '没对上任何一个回答，再说一次',
      'w.listening': '正在听……', 'w.sr.broken': '这里用不了语音识别，改成自己说、自己确认', 'w.sr.unheard': '没听清，大声一点再试一次',
      'w.try.skip': '{msg}，实在不行可以先跳过', 'w.heard': '我听到：“{t}”', 'w.score.ok': '<b>{n} 分</b> 说得好！', 'w.score.low': '{n} 分，红色的词再读准一点',
      // 别的课（.c）：按钮上的英语词换成这门语言的（{w}，台词翻译表的 terms.ui）
      'w.up.go.c': '🫧 浮上去 {w}', 'w.ferry.go.c': '⛴️ {to} {w}', 'w.ferry.go0.c': '⛴️ 出发 {w}', 'w.ferry.no.c': '先不 {w}', 'w.shop.bye.c': '{w} 谢谢',
      'w.up.go': '🫧 浮上去 Swim up', 'w.no': '先不', 'w.ferry.go': '⛴️ {to} Let\'s go!', 'w.ferry.go0': '⛴️ 出发 Let\'s go!', 'w.ferry.no': '先不 Not now',
      'w.coins': '💰 金币 +{n}', 'w.egg.got': '🥚 得到了一个蛋！放在队伍里走路就会孵出来', 'w.ball1': '🔮 回声球 +1', 'w.potion1': '🧪 药水 +1',
      'w.q.lock.pre': '先完成委托「{name}」', 'w.q.lock.badges': '要有 {n} 枚徽章（现在 {m} 枚）',
      'w.q.rw.egg': '🥚 怪兽蛋', 'w.q.rw.shiny': '✨🥚 闪闪发光的怪兽蛋', 'w.q.rw.coins': '💰 金币 {n}', 'w.sep': '、',
      'w.q.noai': 'AI 聊天还没开通，请告诉家长', 'w.q.aidown': 'AI 现在用不了，请告诉家长',
      'w.q.who': '📋 委托：{name}', 'w.q.why': '{t}。', 'w.q.ask': '{goal} 🎁 奖励：{rw}。', 'w.q.bonus': '⏱️ 完成委托还能多玩 10 分钟。',
      'w.q.retry': '🔄 再试一次', 'w.q.help': '🗣️ 用英语帮 TA', 'w.q.later': '以后再说',
      'w.q.done.toast': '📋 委托「{name}」完成了！奖励：{rw}', 'w.q.kept': '📋 委托「{name}」还留着，随时可以再来找 {who}',
      'w.q.done': '📋 委托完成 {stars} · {rw}', 'w.q.more': '⏱️ 完成委托：今天能多冒险 {n} 分钟',
      'w.q.find': ' · 找 {who}', 'w.q.here': '（就在这个镇上）', 'w.q.town': '（在镇上）',
      'w.q.st.done': '已完成 · ', 'w.q.st.lock': '🔒 {why} · ', 'w.q.st.open': '走过去按 A，用英语帮 TA · ',
      'w.q.title': '📋 委托',
      'w.q.intro': '岛上的人有事请你帮忙：走到头上有金色 <b style="color:#b36b00">?</b> 的人面前按 A，再用英语和 TA 聊出结果。完成了有稀有道具，有的还送怪兽蛋！',
      'w.q.count': '已完成 {a} / {b}', 'w.q.none': '这里还没有委托。', 'w.q.unseen': '还有 {n} 条委托在你没去过的岛上。', 'w.menu.back': '返回菜单',
      'w.sail': '⛴️ 船开了……',
      'w.shop.title': '小镇商店', 'w.shop.coins': '你有 <b>{n}</b> 金币', 'w.shop.have': ' · 有 {n}', 'w.shop.owned': '已有', 'w.shop.price': '{n} 金币', 'w.shop.bye': 'Thank you! 谢谢',
      'w.sk.cut.what': '砍掉挡路的小树', 'w.sk.cut.who': '温馨家庭岛的树医生',
      'w.sk.flash.what': '照亮漆黑的洞穴', 'w.sk.flash.who': '回声洞里的登山家',
      'w.sk.smash.what': '打碎有裂缝的岩石', 'w.sk.smash.who': '校园岛的矿工',
      'w.sk.strength.what': '推动大石头', 'w.sk.strength.who': '社团岛的大力士',
      'w.sk.surf.what': '在水上前进', 'w.sk.surf.who': '爸爸（生日派对岛）',
      'w.sk.fly.what': '飞回去过的小岛', 'w.sk.fly.who': '小凯（动物岛）',
      'w.sk.dive.what': '在深水（深蓝色）上潜到海底', 'w.sk.dive.who': '导师欧瑞（规则城）',
      'w.sk.falls.what': '在水上时爬上瀑布', 'w.sk.falls.who': '天气岛的气象台台长',
      'w.sk.title': '🌟 回声技能',
      'w.sk.intro': '一共四种回声技能。先从剧情里的人手上拿到回声贝，再拿够徽章才能用；后面拿到的回声贝会让技能升一级。队伍里要有合适属性的怪兽，用的时候要大声对它说英语指令。',
      'w.sk.lv': '（已到 {a} / {b} 级）', 'w.sk.noshell': ' · 还没拿到回声贝（{who}）', 'w.sk.use': '用',
      'w.sk.tip.dive': '在水上走到深水上按 A', 'w.sk.tip.falls': '在水上时往瀑布上走', 'w.sk.tip.obst': '对着障碍按 A',
      'w.sk.by': '由 {name} 来用', 'w.sk.needtype': '需要 {types} 系怪兽', 'w.sk.needbadge': '需要 {n} 枚徽章',
      'w.sk.cut.done': '🌿 {name} 砍掉了小树！', 'w.sk.smash.done': '🪨 {name} 打碎了岩石！', 'w.sk.push.ok': '💪 {name} 可以推动大石头了！',
      'w.water.surf': '🌊 水路', 'w.water.fish': '🎣 钓鱼',
      'w.fish.wait': '静静等着，浮标一动就注意听！', 'w.fish.bite': '<b>咬钩了！</b>它说了一个词，是什么意思？',
      'w.gfx.no3d': '这台设备不支持 3D，已切换成流畅模式', 'w.gfx.slow': '这台手机跑 3D 有点吃力，已切换成流畅模式（可以在设置里改）',
      'w.err.gl': '大地图 3D 画面丢了（{why}），已重建', 'w.err.reload': '重建后载入地图出错：{msg}',
      'w.err.load': '大地图的画面载入出错：{msg}', 'w.err.draw': '大地图的画面画不出来：{msg}',
      'w.err.fall1': '新画风连着两次没画成，这一次先用经典画面', 'w.err.fall2': '3D 画面连着两次没画成，这一次先用流畅模式',
      'w.gfx.fall1': '新画风出了点问题，先换成经典画面', 'w.gfx.fall2': '3D 画面出了点问题，先换成流畅模式',
      'w.menu.title': '冒险菜单', 'w.menu.goal': '现在要做', 'w.goal.go.unit': '▶ 点这里去闯关练习：{u}', 'w.goal.go.map': '▶ 点这里回到地图，照左上角的 📍 走', 'w.goal.go.home': '去闯关练习：{u} ›', 'w.menu.badges': '🏅 徽章 {a} / {b}', 'w.menu.spray': ' · 🧴 还剩 {n} 步',
      'w.menu.team': '🐾 我的队伍', 'w.menu.bag': '🎒 背包', 'w.menu.dex': '📖 手册', 'w.menu.skills': '🌟 回声技能', 'w.menu.quests': '📋 委托',
      'w.menu.help': '❓ 怎么玩', 'w.menu.settings': '⚙️ 设置', 'w.menu.home': '🏠 回首页', 'w.menu.go': '继续冒险',
      'w.help.title': '怎么玩', 'w.help.pad': '◀▲▼▶ 左下角方向键走路', 'w.help.joy': '🕹️ 左半边屏幕按住拖动走路（设置里可以换成方向键）',
      'w.help.p1': '{how}，<b>A</b> 和面前的人说话、看告示牌、进门；<b>B</b> 打开菜单。电脑上可以用方向键 / WASD、空格键。',
      'w.help.p2': '🛤️ 小镇北边是道路，走进深色草丛会遇到野生怪兽。<br>🧑‍🎤 训练师看到你就会过来挑战。<br>⤵️ 台阶只能往下跳。<br>🕳️ 有的路旁边有洞穴，里面怪兽更强。<br>🏥 休息站：找护士恢复体力，用电脑换队伍（最多 6 只）。<br>🏪 商店：买回声球、药水等道具。<br>🏟️ 挑战馆：打败岛主拿徽章，守卫就会让你去下一段路。<br>🌟 回声技能：拿到徽章后，对着小树、裂开的岩石、大石头、水按 A，大声说出指令就能用（菜单 → 回声技能）。<br>🎣 有钓竿就能对着水钓鱼；🚲 有自行车就点右上角的车骑上。<br>✨ 地上有些道具藏起来了，对着它按 A 才找得到。<br>💖 转身面对跟着你的怪兽按 A，每天用英语和它说一句话，它会越来越喜欢你。<br>🥚 温馨家庭岛的怪兽幼儿园可以寄养怪兽、领蛋；蛋放在队伍里走路就会孵出来。',
      'w.ok': '知道了', 'w.close': '关闭', 'w.cancel': '取消',
      'w.bike.on': '🚲 骑上自行车了', 'w.bike.off': '🚶 下车走路', 'w.flash.ok': '💡 洞穴被照亮了！', 'w.fly.title': '🕊️ 飞到哪里？',
      'w.chest.stone': '开出进化曲：{name}！', 'w.chest.stone.en': '{en}。', 'w.chest.stone.p': '在背包里放给能进化的怪兽听，它就会进化。',
      'w.chest.shiny': '<h2>开出一个闪闪发光的蛋！</h2><p>孵出来的会是<b>稀有色</b>的怪兽！放在队伍里多走路就会孵出来。</p>',
      'w.chest.egg': '<h2>开出一个怪兽蛋！</h2><p>里面是谁呢？放在队伍里多走路就会孵出来（队伍满了就在电脑箱子里）。</p>',
      'w.zh.label': '📖 剧情中文', 'w.zh.auto': '自动', 'w.zh.tap': '点一下才显示', 'w.zh.always': '总是显示',
      'w.zh.note': '自动：前 4 座岛总是显示中文；从第 5 座岛起，人物说的话先只给英文，听不懂再点「译」（周报里能看到点了几次）。任务说明、机关规则一直有中文。',
    },
    en: {
      'w.who.nar': 'Narrator', 'w.who.sign': 'Sign', 'w.who.statue': 'Statue',
      'w.place.isle': 'Island {n}', 'w.place.town': 'Island {n}', 'w.place.route': 'Route {n}', 'w.place.cave': 'Echo Cave {n}', 'w.place.cave.sub': 'Next to Route {n}',
      'w.room.C': 'Rest Stop', 'w.room.M': 'Shop', 'w.room.G': 'Challenge Hall', 'w.room.H': 'House', 'w.room.J': 'House', 'w.room.L': 'English Championship',
      'w.room.1': 'First Master', 'w.room.2': 'Second Master', 'w.room.3': 'Third Master', 'w.room.4': 'Fourth Master', 'w.room.5': 'Champion\'s Room',
      'w.hud.wild': 'Wild Lv {a}–{b}', 'w.hud.home': 'Home', 'w.hud.goal': 'What to do now', 'w.hud.bike': 'Ride the bike', 'w.hud.menu': 'Menu',
      'w.pad.up': 'Up', 'w.pad.left': 'Left', 'w.pad.right': 'Right', 'w.pad.down': 'Down', 'w.hud.chat': 'Chat', 'w.hud.a': 'Talk',
      'w.hud.chat.c': '{lang} chat', 'w.lang.say': 'Say it in {lang}:', 'w.lang.ans': 'Listen, choose the right answer, and say it in {lang}.', 'w.lang.pic': 'How do you say this in {lang}? Choose it, then say it.',
      'w.sk.intro.c': 'There are four Echo Skills. First get an Echo Shell from someone in the story, then win enough badges to use it. Later Echo Shells make a skill one level stronger. You need a monster of the right type in your team, and you say a {lang} sentence to it aloud.',
      'w.hud.north': 'Compass: the red tip points north. Tap to face north again', 'w.help.cam': '🧭 Outdoors in the new look: drag on the right half of the screen to turn the view (all the way round), and double-tap to get back behind yourself. Once you have turned, a compass shows at the top right: tap it to face north again. On a computer, drag with the right mouse button or press Q / E.',
      'w.goal.toast': '📍 What to do now: {t}',
      'w.q.tip': '📋 New: requests! People with a gold ? over their heads need your help. Walk up, press A and help them in English. You can get rare rewards!',
      'w.kick.day': '🌅 It\'s a new day! Finish today\'s tasks first', 'w.kick.gate': '📚 Finish today\'s tasks first, then come back for adventure',
      'w.shore': '🏖️ Back on land', 'w.spray.off': '🧴 The Quiet Spray has worn off', 'w.spray.on': '🧴 No wild monsters for the next 100 steps', 'w.hatch.shiny': '✨ It has a rare colour!',
      'w.aiskip': '📶 Skip for now (saved to review: say it later when you are online)', 'w.skip': 'Skip for now',
      'w.dlg.hear': 'Listen again', 'w.dlg.listen': '🔊 Listen carefully! (Tap the speaker at the top right to hear it again)', 'w.dlg.zh.aria': 'Show the meaning', 'w.dlg.zh.btn': 'Meaning',
      'w.mic.aria': 'Start speaking', 'w.mic.down': '📶 AI scoring is not working right now. You can skip for now and say it in review when you are online', 'w.mic.tap': 'Tap the mic and say it aloud',
      'w.self.hint': 'Say it aloud, then tap "I said it"', 'w.self.done': '🎤 I said it',
      'w.ans.down': '📶 AI scoring is not working right now: <b>just tap the right answer</b> (this line is saved to review: say it later when you are online)',
      'w.ans.sr': 'Choose the right answer and <b>say it aloud</b> (tap an answer to hear it first)', 'w.ans.self': 'Tap the right answer, then say it aloud',
      'w.ans.ok': 'Right! Say it aloud, then tap <button class="btn small leaf" data-act="wSelfDone">🎤 I said it</button>',
      'w.ans.nomatch': 'That did not match any answer. Say it again',
      'w.listening': 'Listening…', 'w.sr.broken': 'Speech recognition does not work here. Say it yourself and tap when you are done', 'w.sr.unheard': 'I didn\'t catch that. Say it louder and try again',
      'w.try.skip': '{msg}. If it still does not work, you can skip for now', 'w.heard': 'I heard: "{t}"', 'w.score.ok': '<b>{n} points</b> Well said!', 'w.score.low': '{n} points. Say the red words more clearly',
      'w.up.go.c': '🫧 {w}', 'w.ferry.go.c': '⛴️ {to} · {w}', 'w.ferry.go0.c': '⛴️ {w}', 'w.ferry.no.c': '{w}', 'w.shop.bye.c': '{w}',
      'w.up.go': '🫧 Swim up', 'w.no': 'Not now', 'w.ferry.go': '⛴️ Let\'s go to {to}!', 'w.ferry.go0': '⛴️ Let\'s go!', 'w.ferry.no': 'Not now',
      'w.coins': '💰 +{n} coins', 'w.egg.got': '🥚 You got an egg! Keep it in your team and walk, and it will hatch', 'w.ball1': '🔮 Echo Ball +1', 'w.potion1': '🧪 Potion +1',
      'w.q.lock.pre': 'Finish the request "{name}" first', 'w.q.lock.badges': { one: 'You need {n} badge (you have {m})', other: 'You need {n} badges (you have {m})' },
      'w.q.rw.egg': '🥚 monster egg', 'w.q.rw.shiny': '✨🥚 shining monster egg', 'w.q.rw.coins': '💰 {n} coins', 'w.sep': ', ',
      'w.q.noai': 'AI chat is not set up yet. Please ask a parent or check Settings', 'w.q.aidown': 'AI is not working right now. Please ask a parent or check Settings',
      'w.q.who': '📋 Request: {name}', 'w.q.why': '{t}. ', 'w.q.ask': '{goal} 🎁 Reward: {rw}. ', 'w.q.bonus': '⏱️ Finish it to get 10 more minutes of adventure.',
      'w.q.retry': '🔄 Try again', 'w.q.help': '🗣️ Help in English', 'w.q.later': 'Maybe later',
      'w.q.done.toast': '📋 Request "{name}" done! Reward: {rw}', 'w.q.kept': '📋 The request "{name}" is still open. Come back to {who} any time',
      'w.q.done': '📋 Request done {stars} · {rw}', 'w.q.more': { one: '⏱️ Request done: {n} more minute of adventure today', other: '⏱️ Request done: {n} more minutes of adventure today' },
      'w.q.find': ' · Find {who}', 'w.q.here': ' (in this town)', 'w.q.town': ' (in town)',
      'w.q.st.done': 'Done · ', 'w.q.st.lock': '🔒 {why} · ', 'w.q.st.open': 'Walk up, press A and help in English · ',
      'w.q.title': '📋 Requests',
      'w.q.intro': 'People on the islands need your help. Walk up to someone with a gold <b style="color:#b36b00">?</b> over their head, press A and talk it through in English. You get rare items, and sometimes a monster egg!',
      'w.q.count': 'Done: {a} / {b}', 'w.q.none': 'No requests here yet.', 'w.q.unseen': { one: '{n} more request is on islands you have not visited.', other: '{n} more requests are on islands you have not visited.' }, 'w.menu.back': 'Back to menu',
      'w.sail': '⛴️ The boat is leaving…',
      'w.shop.title': 'Town Shop', 'w.shop.coins': 'You have <b>{n}</b> coins', 'w.shop.have': ' · You have {n}', 'w.shop.owned': 'Owned', 'w.shop.price': '{n} coins', 'w.shop.bye': 'Thank you!',
      'w.sk.cut.what': 'Cut down small trees in the way', 'w.sk.cut.who': 'the Tree Doctor on Family Island',
      'w.sk.flash.what': 'Light up dark caves', 'w.sk.flash.who': 'the hiker in Echo Cave',
      'w.sk.smash.what': 'Break rocks with cracks', 'w.sk.smash.who': 'the Miner on Campus Island',
      'w.sk.strength.what': 'Push big rocks', 'w.sk.strength.who': 'the Strongman on Club Island',
      'w.sk.surf.what': 'Travel on water', 'w.sk.surf.who': 'Dad (Party Island)',
      'w.sk.fly.what': 'Fly back to islands you have visited', 'w.sk.fly.who': 'Kai (Animal Island)',
      'w.sk.dive.what': 'Dive to the sea floor from deep (dark blue) water', 'w.sk.dive.who': 'Orion (Rule City)',
      'w.sk.falls.what': 'Climb up waterfalls while on water', 'w.sk.falls.who': 'the head of the Weather Station on Weather Island',
      'w.sk.title': '🌟 Echo Skills',
      'w.sk.intro': 'There are four Echo Skills. First get an Echo Shell from someone in the story, then win enough badges to use it. Later Echo Shells make a skill one level stronger. You need a monster of the right type in your team, and you say the English command to it aloud.',
      'w.sk.lv': ' (level {a} / {b})', 'w.sk.noshell': ' · No Echo Shell yet ({who})', 'w.sk.use': 'Use',
      'w.sk.tip.dive': 'On deep water, press A', 'w.sk.tip.falls': 'Swim up the waterfall', 'w.sk.tip.obst': 'Face it, press A',
      'w.sk.by': '{name} can use it', 'w.sk.needtype': 'Needs a {types} monster', 'w.sk.needbadge': { one: 'Needs {n} badge', other: 'Needs {n} badges' },
      'w.sk.cut.done': '🌿 {name} cut down the tree!', 'w.sk.smash.done': '🪨 {name} broke the rock!', 'w.sk.push.ok': '💪 {name} can push big rocks now!',
      'w.water.surf': '🌊 Water Way', 'w.water.fish': '🎣 Fish',
      'w.fish.wait': 'Wait quietly. When the float moves, listen!', 'w.fish.bite': '<b>A bite!</b> It said a word. Which one did you hear?',
      'w.gfx.no3d': 'This device cannot show 3D. Switched to Smooth mode (2D)', 'w.gfx.slow': '3D is too slow on this phone. Switched to Smooth mode (2D). You can change this in Settings',
      'w.err.gl': 'The 3D map view was lost ({why}) and has been rebuilt', 'w.err.reload': 'Error loading the map after the rebuild: {msg}',
      'w.err.load': 'Error loading the map view: {msg}', 'w.err.draw': 'The map view could not be drawn: {msg}',
      'w.err.fall1': 'The new look failed twice in a row. Using the classic look for now', 'w.err.fall2': 'The 3D view failed twice in a row. Using Smooth mode (2D) for now',
      'w.gfx.fall1': 'The new look had a problem. Switched to the classic look for now', 'w.gfx.fall2': 'The 3D view had a problem. Switched to Smooth mode (2D) for now',
      'w.menu.title': 'Adventure Menu', 'w.menu.goal': 'What to do now', 'w.goal.go.unit': '▶ Tap to go to Practice: {u}', 'w.goal.go.map': '▶ Tap to go back to the map and follow the 📍 at the top left', 'w.goal.go.home': 'Go to Practice: {u} ›', 'w.menu.badges': '🏅 Badges {a} / {b}', 'w.menu.spray': { one: ' · 🧴 {n} step left', other: ' · 🧴 {n} steps left' },
      'w.menu.team': '🐾 My Team', 'w.menu.bag': '🎒 Bag', 'w.menu.dex': '📖 Monsters', 'w.menu.skills': '🌟 Skills', 'w.menu.quests': '📋 Requests',
      'w.menu.help': '❓ Help', 'w.menu.settings': '⚙️ Settings', 'w.menu.home': '🏠 Home', 'w.menu.go': 'Keep exploring',
      'w.help.title': 'How to play', 'w.help.pad': '◀▲▼▶ Walk with the arrow pad at the bottom left', 'w.help.joy': '🕹️ Walk by holding and dragging on the left half of the screen (you can switch to arrow keys in Settings)',
      'w.help.p1': '{how}. <b>A</b>: talk to people, read signs and go through doors. <b>B</b>: open the menu. On a computer, use the arrow keys / WASD and the space bar.',
      'w.help.p2': '🛤️ Roads are north of each town. Walk into dark grass to meet wild monsters.<br>🧑‍🎤 Trainers come to battle you when they see you.<br>⤵️ You can only jump down ledges, not climb up.<br>🕳️ Some roads have caves. The monsters inside are stronger.<br>🏥 Rest Stop: Amy heals your monsters, and the computer changes your team (up to 6).<br>🏪 Shop: buy Echo Balls, potions and other items.<br>🏟️ Challenge Hall: beat the Isle Master to win a badge. Then the guard lets you go on.<br>🌟 Echo Skills: after you win the badges, face a small tree, a cracked rock, a big rock or water, press A and say the command aloud (Menu → Echo Skills).<br>🎣 With a Fishing Rod, you can fish in the water. 🚲 With a Bike, tap the bike at the top right to ride.<br>✨ Some items are hidden on the ground. Face the spot and press A to find them.<br>💖 Turn to the monster that follows you and press A. Say one English sentence to it every day, and it will like you more and more.<br>🥚 At the Monster Daycare in We\'re Family Town you can leave monsters and get eggs. Keep an egg in your team and walk, and it will hatch.',
      'w.ok': 'Got it', 'w.close': 'Close', 'w.cancel': 'Cancel',
      'w.bike.on': '🚲 You are riding your bike', 'w.bike.off': '🚶 You got off your bike', 'w.flash.ok': '💡 The cave is lit up!', 'w.fly.title': '🕊️ Where do you want to fly?',
      'w.chest.stone': 'You got a growth song: {name}!', 'w.chest.stone.en': '{en}. ', 'w.chest.stone.p': 'Play it from your Bag to a monster that can grow, and it will grow up.',
      'w.chest.shiny': '<h2>You got a shining egg!</h2><p>The monster inside will have a <b>rare colour</b>! Keep it in your team and walk a lot, and it will hatch.</p>',
      'w.chest.egg': '<h2>You got a monster egg!</h2><p>Who is inside? Keep it in your team and walk a lot, and it will hatch. (If your team is full, it goes to the Monster Box.)</p>',
      'w.zh.label': '📖 Story translation', 'w.zh.auto': 'Auto', 'w.zh.tap': 'Tap to show', 'w.zh.always': 'Always',
      'w.zh.note': 'Auto: on the first 4 islands the translation is always shown. From island 5, people\'s lines are in English first; tap the translate button if you need it (the weekly report shows how often). Task notes and puzzle rules always have the translation.',
    },
  });
  // 说话的人：剧情脚本（isles/*.js）里还写着中文的「旁白 / 告示牌 / 雕像」，显示时换成界面语言
  const WHO_KEYS = ['w.who.nar', 'w.who.sign', 'w.who.statue'];
  const whoLabel = w => { if (I18N && w) for (const k of WHO_KEYS) if (w === I18N.t(k, null, 'zh')) return tx(k); return w || ''; };
  // 别的课：画面上的名字按这门课的写法（台词翻译表的词，tools/course/SPEC.md §8.1；没翻的照英文）。T_ 文字、TH_ 带读音的 HTML、uiW 按钮上的英语词。英语课原样
  const T_ = (c, en) => (E && E.lang && E.termOf ? E.termOf(c, en) : en);
  const TH_ = (c, en) => (E && E.lang && E.termHTML ? E.termHTML(c, en) : E.esc(en));
  const uiW = en => T_('ui', en);
  // 房子门上的招牌（2D、老 3D、新画风三种画法都问这里）：休息站 REST STOP、商店 SHOP、挑战馆 HALL（Challenge Hall 的招牌，不叫 GYM）。
  // 别的课用台词翻译表的 sign（挑战馆那条的英文写成 CHALLENGE HALL，和学校地板上的 HALL「走廊」分开）
  function signLabel(L) {
    if (L === 'C') return T_('sign', 'REST STOP');
    if (L === 'M') return T_('sign', 'SHOP');
    const t = T_('sign', 'CHALLENGE HALL');
    return t === 'CHALLENGE HALL' ? 'HALL' : t;
  }
  // 小镇 / 岛主的名字：中文界面用中文名；别的语言用英文（小镇 = 这座岛小镇地图的英文名 Crayon Island……，和剧情台词里说的一样；
  // 地图没写英文名才用 data.js 的 en 去掉标点 + Town。岛主的英文名在他的开场白里：I'm Captain Polly.）
  const townName = w => { const z = E && E.W ? E.W.indexOf(w) : -1, m = z >= 0 && EM ? EM.get('t' + z) : null; return L({ zh: w.name, en: (m && m.en) || w.en.replace(/[!?]/g, '') + ' Town' }); };
  // 别的课：地名这门课怎么写（台词翻译表的 terms.place）；英语课、没翻（或和英文一样）：null
  const placeC = en => { if (!E || !E.lang || !en) return null; const t = T_('place', en); return t && t !== en ? t : null; };
  // 别的课的地名牌：这门课的地名做大字（日语 / 中文标读音），界面语言的名字做小字（和英语课「英文 + 中文」一样的排法）。没翻：null
  const placeTag = (en, ui) => (placeC(en) ? '<span class="pl-c"><b>' + TH_('place', en) + '</b><small>' + E.esc(ui) + '</small></span>' : null);
  // 第 z 座岛（小镇地图）的地名牌：飞行菜单、首页「飞去哪」
  const townTag = z => { const m = EM && E && E.W[z] ? EM.get('t' + z) : null; return m && m.en ? placeTag(m.en, townName(E.W[z])) : null; };
  // 岛主的名字（英文名在别的课里换成这门课名字牌的写法，T_）
  const bossName = b => L({ zh: b.name, en: T_('person', b.en || (/\bI(?:'m| am) ((?:the )?[A-Z][\w-]*(?: [A-Z][\w-]*)*)/.exec(b.hello || '') || [])[1]) });
  // 渡轮去哪：岛上的人物数据（isles/*.js）只写了中文的 toName，英语界面用目的地地图的英文名
  const ferryTo = n => { const m = n.to && EM.get(n.to); return L({ zh: n.toName, en: m ? placeName(m).en : undefined }); };

  let E = null, MG = null, EM = null;
  let M = null;           // 当前地图
  let R = null;           // 当前渲染器
  let raf = 0, running = false, lastNow = 0;
  const PL = { x: 0, y: 0, fx: 0, fy: 0, dir: 'up', moving: false, t0: 0, dur: STEP_MS, jump: false };
  const FL = { x: 0, y: 0, fx: 0, fy: 0 };
  let held = null, dlg = null, busy = false, wipeT = 0;
  const $ = id => document.getElementById(id);
  // 新画风的户外地图可以转镜头（world3d-open.js 的 orbit）：摇杆 / 方向键 / 键盘按的「上」是朝镜头看过去的方向走。
  // 渲染器说镜头转了几个 90°（quarter()，别的渲染器没有这个函数 = 0），按的方向就在 CAMROT 里往后挪几格；held 里存的一直是按的那个方向。
  // qLatch：换地图的那一下要是键盘还按着（按键自己会重复），到松手之前都照换地图之前的算——不然进门以后镜头回了正北，同一个键变成往回走，又走出门去
  const CAMROT = ['up', 'left', 'down', 'right'];
  let qLatch = null;
  const camQ = () => (qLatch != null ? qLatch : R && R.quarter ? R.quarter() : 0);
  const camDir = d => { const q = camQ(), i = CAMROT.indexOf(d); return q && i >= 0 ? CAMROT[(i + q) % 4] : d; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const WS = () => E.S.world;
  // 调试入口：网址带 ?debug 时，徽章、守卫、回声技能、挑战馆的课本门槛都当作已经有了（家长 / 开发者测试用）。
  // 设置里的「全部关卡直接开放」只管闯关练习，不再影响大地图（家长 2026-10-07）
  const DEBUG = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search);
  const hasBadge = z => !!E.S.mon.badges[z] || DEBUG;

  // ---------- 存档迁移：旧版只有 13 个小镇，没有道路和房子 ----------
  function migrate() {
    const ws = WS();
    if (ws.v === 2) {
      // v3：地图全部重做 + 回声贝。老存档站在已经不存在的地图上就回到当前小镇的休息站；按徽章数补发回声贝
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
  const guardGone = n => n.badge != null ? nBadges() >= n.badge || DEBUG : hasBadge(M.z);
  const flagOK = n => (!n.showIf || [].concat(n.showIf).every(k => WS().flags['s:' + k])) && (!n.hideIf || ![].concat(n.hideIf).some(k => WS().flags['s:' + k]));
  const npcVisible = n => !(n.role === 'guard' && guardGone(n)) && flagOK(n) && !(window.EchoStory && EchoStory.hidden(SC, n));
  const npcAt = (x, y) => M.npcs.find(n => n.x === x && n.y === y && npcVisible(n));
  const pickKey = p => 'p:' + M.id + ':' + p.x + ':' + p.y;
  const pickAt = (x, y) => M.picks.find(p => p.x === x && p.y === y && !WS().flags[pickKey(p)]);
  const pickType = p => p.item || PICKS[(p.x * 7 + p.y * 3 + M.z) % (M.z < 2 ? 2 : M.z < 4 ? 3 : M.z < 6 ? 4 : M.z < 8 ? 6 : PICKS.length)];
  // 水边的出口格（出口外面是水）：要踏浪才能走
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
    // name / sub 按界面语言（地图自己写的中文名、副标题在 isles/*.js 里，英语界面用它的英文名、通用的副标题）；en 是英文地名（横幅、朗读用）
    const isle = () => tx('w.place.isle', { n: m.z + 1 });
    // 别的课：地图名里的 {rival}（「{rival} 的家」）换成对手的名字（这门课名字牌的写法）。
    // 英语课这里没动：中文界面的 HUD 一直显示「{rival} 的家」（老问题，2026-11-21 第三批扫查时发现，要不要改等定）
    const nmC = s => (E.lang && typeof s === 'string' ? s.split('{rival}').join(T_('person', rivalInfo().name)) : s);
    if (m.name) return { icon: m.icon || { town: w.icon, route: '🛤️', cave: '🕳️', under: '🌊', inside: '🏠' }[m.kind] || '📍', name: nmC(L({ zh: m.name, en: m.en })), en: m.en || m.name, sub: m.sub ? L({ zh: m.sub, en: m.kind === 'town' ? isle() : townName(w) }) : (m.kind === 'town' ? isle() : townName(w)) };
    if (m.kind === 'town') return { icon: w.icon, name: townName(w), en: w.en.replace(/[!?]/g, '') + ' Town', sub: tx('w.place.town', { n: m.z + 1 }) };
    if (m.kind === 'route') return { icon: '🛤️', name: tx('w.place.route', { n: m.z + 1 }), en: 'Route ' + (m.z + 1), sub: townName(w) + ' → ' + townName(E.W[m.z + 1]) };
    if (m.kind === 'cave') return { icon: '🕳️', name: tx('w.place.cave', { n: EM.caves.indexOf(m.route) + 1 }), en: 'Echo Cave', sub: tx('w.place.cave.sub', { n: m.route + 1 }) };
    const room = { C: ['🏥', 'Rest Stop'], M: ['🏪', 'Shop'], G: ['🏟️', 'Challenge Hall'], H: ['🏠', 'House'], J: ['🏠', 'House'], L: ['🏆', 'English Cup'], 1: ['🏆', 'Master 1'], 2: ['🏆', 'Master 2'], 3: ['🏆', 'Master 3'], 4: ['🏆', 'Master 4'], 5: ['👑', 'Champion'] }[m.room];
    return { icon: room[0], name: townName(w) + ' · ' + tx('w.room.' + m.room), en: room[1], sub: tx('w.place.town', { n: m.z + 1 }) };
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
    if (n.role === 'nurse') return { name: 'Amy', g: 'f', look: LOOKS.nurse };   // 休息站的站长（角色名 nurse 是老的叫法，只在代码里）
    if (n.role === 'clerk') return { name: 'Clerk Tom', g: 'm', look: LOOKS.clerk };
    if (n.role === 'hiker') return { name: 'Hiker Bob', g: 'm', look: HIKER_LOOK };
    if (n.role === 'leader') { const b = E.W[M.z].boss; return { name: bossName(b), g: 'm', look: Object.assign({}, LOOKS.leader, { shirt: E.W[M.z].color }), emo: b.emoji }; }
    const v = VILLAGER_LOOKS[(M.z * 3 + n.seed) % VILLAGER_LOOKS.length];
    return { name: v[0], g: v[1], look: v[2] };
  }

  // ---------- 进入 / 切换地图 ----------
  // 记下主角在哪。走一步只记位置（E.savePos：很小的一条，不把整份存档重写一遍——存档大了以后那样会一步一卡）；
  // 整份存档等停下来、开战、回首页、切后台时再存（game.js 的 flushWalk）。full：换地图这种少见的时候当场整份存
  function savePos(full) {
    const ws = WS();
    ws.map = M.id; ws.z = M.z; ws.x = PL.x; ws.y = PL.y; ws.dir = PL.dir; ws.arrive = null;
    if (full || !E.savePos) E.save(); else E.savePos();
  }
  function loadMap(id, how) {
    M = EM.get(id) || EM.get('t0');
    const vw = $('w-view');
    if (vw) { vw.querySelectorAll('canvas').forEach(c => { c.style.filter = ''; }); const nt = $('w-note'); if (nt) nt.hidden = true; }
    M.npcs = M.npcs.filter(n => !n.temp);
    // 每次进地图：砍掉的树、碎掉的石头会长回来，大石头回到原位；大力推、点灯要重新用
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
    if (R) loadR();
    // 回程绳回到最后一次待过的户外地图（先记好，下面整份存的时候一起存上）
    if ((M.kind === 'town' || M.kind === 'route') && !PL.surf) ws.lastOut = { map: M.id, x: PL.x, y: PL.y, dir: PL.dir };
    // 今日目击（sighting.js）：进过的野外地图记下来（跟着下面这次存档一起存）；这张图是今天的目击地点就提示一句
    if (sightOn()) EchoSight.onMap(M);
    savePos(true);
    hud();
    E.music(mapMusic());
  }
  // 这张地图的背景音乐：小镇按岛分 4 首、道路前后两首、踏浪和海底放海的、洞穴（嘘声团基地放反派的）、挑战馆、室内、勇气之路
  function mapMusic() {
    const k = M.kind, z = M.isle != null ? M.isle : M.z, id = M.id;
    if (/^(v\d|vL|i12L|i12[1-5]$)/.test(id)) return 'league';
    if (PL.surf || k === 'under' || /^s\d/.test(id)) return 'sea';
    if (k === 'town') return z <= 4 ? 'town_a' : z <= 7 ? 'town_b' : z <= 10 ? 'town_c' : 'town_d';
    if (k === 'cave') return M.def && M.def.cave === 'base' ? 'hush' : 'cave';
    if (k === 'inside') return M.room === 'G' ? 'gym' : 'center';
    return z <= 5 ? 'route' : 'route2';
  }
  function enter(z, how) {
    E.primeTTS(); E.ac();
    if (MG.preloadTeam) MG.preloadTeam();   // 队伍的 3D 模型先在后台下载，开战时就不用等
    E.closeModal();
    E.show('world');
    ensureDom();
    migrate();
    const ws = WS();
    // 上次画不出来退到了经典 3D / 流畅模式（见 rebuildGL）：隔了一阵再从首页进来，从头试一次原来的画面
    if (GL.ban && performance.now() - GL.banT > GL_BAN_MS) { GL.ban = 0; GL.fails = 0; }
    ensureRenderer();
    // 还没有怪兽：新游戏，从开场剧情开始（在自己家里醒来）
    const fresh = !E.S.mon.box.length;
    adv.on = true; adv.day = E.dayStr ? E.dayStr() : ''; adv.gated = !fresh; adv.want = '';
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
    // 地名横幅收起以后，弹 3 秒「现在要做什么」（隔一天回来也知道主线该去哪）
    // 对话 / 剧情开着时不弹（2026-11-20 细节检查：横屏里这条提示压在答题框和喇叭上；目标在 HUD 和冒险菜单里都看得到）
    if (!fresh) setTimeout(() => { if (!running || !adv.on || dlg || busy || !$('modal').hidden) return; const o = objective(); if (o) E.toast(tx('w.goal.toast', { t: o.zh })); }, 2700);
    // 支线委托：第一次有委托可以接的时候提醒一次（以后看头上的「?」和菜单里的「📋 委托」）
    if (!fresh && !ws.flags.qtip) setTimeout(() => {
      if (!running || !adv.on || WS().flags.qtip || !questRows().some(r => r.seen && r.state === 'open')) return;
      WS().flags.qtip = 1; E.save();
      E.toast(tx('w.q.tip'), 'gold');
    }, 6500);
  }

  // ---------- 学习锁：人在大地图里过了零点（或者切回前台时学习锁是关着的），等当前的对话 / 战斗结束，提示回首页先学习 ----------
  // gated：进来时是过了学习锁的（新游戏第一次进来不锁，那一次只在过了零点时才赶回去）
  const adv = { on: false, day: '', gated: false, want: '' };
  const gateShut = () => !!(E && E.gate && E.S.settings.gate !== false && (E.S.mon.box || []).length && !E.gate().open);
  function kickCheck(front) {
    if (!adv.on || adv.want || !E) return;
    const t = E.dayStr ? E.dayStr() : '', nd = !!adv.day && !!t && t !== adv.day;
    if (nd) adv.day = t;
    if ((nd || (front && adv.gated)) && gateShut()) adv.want = nd ? 'day' : 'gate';
  }
  function kickTry() {
    if (!adv.want || !adv.on || !running || dlg || busy || overlay || PL.moving || !$('modal').hidden) return;
    const day = adv.want === 'day';
    adv.want = '';
    held = null;
    talk([{ who: tx('w.who.nar'), emo: '🌅', en: day ? "It's a new day! Let's study first." : "Let's study first!", zh: day ? '新的一天！先完成今天的小任务' : '先完成今天的小任务，再来冒险吧', zhKeep: true }], () => {
      adv.on = false;
      E.closeModal();
      E.goHome('mon');
      E.toast(tx(day ? 'w.kick.day' : 'w.kick.gate'));
    });
  }
  setInterval(() => { kickCheck(false); kickTry(); }, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { kickCheck(true); kickTry(); } });
  async function goMap(id, how) {
    busy = true;
    qLatch = camQ();
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
    // 别的课：大字是这门语言的地名（台词翻译表的地名，SPEC §8，标读音），下面那行是界面语言的名字；没翻的照旧（界面语言 + 英文地名）。
    // 念的「Welcome to …!」say() 自己会换
    const pl = E.lang && E.lineOf ? E.lineOf(p.en) : null;
    // 英语界面：名字已经是英文的，下面那行英文地名一样就不重复
    b.innerHTML = '<small>' + E.esc(p.sub) + (M.kind === 'town' && E.S.mon.badges[M.z] ? ' · 🏅' : '') + '</small>' + (pl ? '<b>' + E.ruby(pl.t) + '</b><span>' + E.esc(p.name) + '</span>' : '<b>' + E.esc(p.name) + '</b>' + (sameLang() && p.en === p.name ? '' : '<span>' + E.esc(p.en) + '</span>'));
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 2600);
    E.say(M.kind === 'town' ? 'Welcome to ' + p.en + '!' : p.en);
  }
  function hud() {
    const p = placeName();
    // 别的课：地名这门课有写法的，大字写它，小字是界面语言的名字（野外再接上怪兽等级）
    const pc = placeC(p.en), wild = M.kind === 'route' || M.kind === 'cave' || M.kind === 'under' ? tx('w.hud.wild', { a: MG.zoneLv(M.z) + (M.lvBonus || 0), b: MG.zoneLv(M.z) + (M.lvBonus || 0) + 2 }) : null;
    $('w-zname').textContent = p.icon + ' ' + (pc || p.name);
    $('w-zsub').textContent = pc ? p.name + (wild ? ' · ' + wild : '') : wild || p.sub;
    relabel();
    $('w-badges').textContent = '🏅 ' + Object.keys(E.S.mon.badges).length;
    // 回声球个数：前面画一只小海螺（Cartoon.shell，和战斗里扔的是同一个样子）
    $('w-balls').innerHTML = (window.Cartoon && Cartoon.shell ? '<span style="display:block;width:18px;height:18px">' + Cartoon.shell().replace('<svg ', '<svg width="100%" height="100%" ') + '</span>' : '') + E.S.mon.balls;
    const bk = $('w-bike');
    if (bk) { bk.hidden = !(MG.itemCount('bike') > 0) || M.kind === 'inside' || M.kind === 'under'; bk.classList.toggle('on', !!PL.bike); }
    goalLine();
  }
  // 设置里换了界面语言：HUD 和按键上的字（ensureDom 只建一次）跟着换
  let hudLang = null;
  function relabel() {
    const l = I18N ? I18N.lang() : 'zh';
    if (hudLang === null || l === hudLang) return;
    hudLang = l;
    const set = (sel, k, small) => { const el = document.querySelector(sel); if (!el) return; if (small) { const s = el.querySelector('small'); if (s) s.textContent = tx(k); } else el.setAttribute('aria-label', tx(k)); };
    set('.w-hud .x', 'w.hud.home'); set('#w-goal', 'w.hud.goal'); set('#w-bike', 'w.hud.bike'); set('.w-hud .w-menu', 'w.hud.menu');
    ['up', 'left', 'right', 'down'].forEach(d => set('#w-dpad .dp-' + d, 'w.pad.' + d));
    set('#w-chat', 'w.hud.chat', 1); set('#w-ctrl .bb', 'w.hud.menu', 1); set('#w-ctrl .ba', 'w.hud.a', 1); set('#w-compass', 'w.hud.north');
  }
  // ---------- 现在该去哪、做什么（目标在 story.js 的 objective()，按剧情进度和徽章数算）----------
  function objective() {
    try { return window.EchoStory && EchoStory.objective ? EchoStory.objective(SC) : null; } catch (e) { console.error(e); return null; }
  }
  // 地图左上角地名下面的一行「📍 …」：要先学课本时点一下直接去那个单元，别的时候打开冒险菜单看完整的目标
  // 「现在要做」点了去哪（2026-11-20 老板：「现在要做点了可以直接跳到要做的事情那里」）：
  //   go === 'unit'（挑战馆的课本门槛）：和「回首页」走同一条路离开大地图（E.goUnit → goHome：存档、冒险计时照旧），打开那个单元、亮出 BOSS 关；
  //   别的（去哪座岛、找谁、进挑战馆）：不传送——冒险菜单里点了就关上菜单，左上角那行目标亮几下（指向出口的箭头还没做）
  // 单元号（英语课「Unit 3」；别的课按界面语言，game.js 的 unitNo）
  const unitNo = n => (E && E.unitNo ? E.unitNo(n) : 'Unit ' + n);
  const goalUnit = o => { const u = o && o.go === 'unit' && (E.WX || [])[o.wi]; return u ? (u.bshort ? u.bshort + ' ' : '') + unitNo(u.n) : ''; };
  const goalGoLabel = o => (goalUnit(o) ? hx('w.goal.go.unit', { u: goalUnit(o) }) : hx('w.goal.go.map'));
  function goalGo(from) {
    const o = objective();
    if (o && goalUnit(o) && E.goUnit) { E.closeModal(); E.goUnit(o.wi); return; }
    if (from === 'hud') { menuSheet(); return; }
    E.closeModal();
    const g = $('w-goal'); if (g && !g.hidden) { g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash'); }
  }
  function goalLine() {
    const g = $('w-goal'); if (!g) return;
    const o = objective();
    g.hidden = !o;
    g.textContent = o ? '📍 ' + o.zh : '';
  }

  // ---------- 移动 ----------
  function tryMove(dir) {
    if (PL.moving || dlg || busy || !$('modal').hidden) return;
    PL.dir = dir;
    const [dx, dy] = DIRS[dir], nx = PL.x + dx, ny = PL.y + dy, t = tile(nx, ny);
    const w = warpAt(nx, ny);
    if (w && !EM.WALK.includes(t)) { if (dir === 'up') goMap(w.to, w.arrive); return; }   // 门、洞口
    // 瀑布：踏浪时往上要用「逆流」，往下会顺着水冲下去；左右水流太急过不去
    if (t === 'w') {
      if (!PL.surf) return;
      if (dir === 'down') { step(nx, ny, STEP_MS * .7, false); return; }
      if (dir !== 'up') return;
      if (skillReady('falls')) useSkill('falls', () => climbFalls());
      else talk([{ who: tx('w.who.nar'), emo: '🌊', en: 'The waterfall is too strong!', zh: '瀑布的水太急了，爬不上去。' + (skillOpen('falls') ? '队伍里要有水系或龙系的怪兽。' : '') }]);
      return;
    }
    // 台阶：只能往下跳，一下跳两格
    if (t === 'L') {
      if (dir !== 'down' || !walkable(nx, ny + 1)) return;
      step(nx, ny + 1, JUMP_MS, true);
      E.SFX.tap();
      return;
    }
    // 大力推：推着大石头往前走一格
    if (t === 'O' && M._strength) {
      const bx = nx + dx, by = ny + dy, b = boulderAt(nx, ny);
      if (b && EM.WALK.includes(tile(bx, by)) && !npcAt(bx, by) && !warpAt(bx, by) && !(bx === FL.x && by === FL.y)) { b.x = bx; b.y = by; E.SFX.tap(); step(nx, ny, STEP_MS * 1.6, false); }
      return;
    }
    if (!walkable(nx, ny)) return;
    // 踏浪中走上岸就下来
    if (PL.surf && !isWater(nx, ny)) { PL.surf = false; E.toast(tx('w.shore')); E.music(mapMusic()); }
    step(nx, ny, PL.bike && !PL.surf ? BIKE_MS : STEP_MS, false);
  }
  function step(nx, ny, dur, jump) {
    if (E.walkTouch) E.walkTouch();   // 还在走：整份存档等真的停下来再存（game.js 的 savePos）
    FL.fx = FL.x; FL.fy = FL.y; FL.x = PL.x; FL.y = PL.y;
    PL.fx = PL.x; PL.fy = PL.y; PL.x = nx; PL.y = ny;
    PL.moving = true; PL.jump = jump; PL.dur = dur; PL.t0 = performance.now();
  }
  // 逆流：一直往上爬到瀑布顶上
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
    if (ws.repel > 0) { ws.repel--; if (!ws.repel) E.toast(tx('w.spray.off')); }
    const rate = slid ? 0 : PL.surf && isWater(PL.x, PL.y) ? .08 : EM.ENCOUNTER[t];
    // 今日目击（sighting.js）：在线索说的那张地图、那种地形里走够了步数，那只稀有怪兽一定出来——这一步就不再掷普通的遇怪
    if (sightOn() && EchoSight.onStep({ map: M, hab: rate ? wildHab() : '', surf: !!PL.surf, spray: ws.repel > 0, idle: !dlg && !busy && !overlay })) return;
    if (rate && !(ws.repel > 0) && Math.random() < rate && MG.anyAlive()) encounter();
  }
  // 蛋孵出来了
  function hatchScene(ev) {
    const sp = MG.species(ev.sp), line = 'Hello, ' + sp.en + '! Welcome to the world!';
    talk([
      { who: tx('w.who.nar'), emo: '🥚', en: 'Look! The egg is shaking!', zh: '看！蛋在晃！' },
      { who: tx('w.who.nar'), emo: '🐣', en: 'Crack! A baby ' + sp.en + ' came out!', zh: '咔嚓！孵出了一只小 ' + sp.en + '（' + sp.zh + '）！', onShow: () => { const mon = MG.hatch(ev.hatch); E.SFX.win(); E.confetti(140); if (mon && mon.shiny) E.toast(tx('w.hatch.shiny'), 'gold'); hud(); } },
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

  // 看图说单词：两个词只靠图分不开（同一个图、一个词包着另一个、同一组时间 / 饭 / 家里人 / 生日的词）
  const PIC_GROUPS = [/^good (morning|afternoon|evening|night)$/, /^(breakfast|lunch|dinner)$/, /^(get up|go to bed)$/, /^(birthday|cake|party)$/,
    /^(father|mother|grandfather|grandmother|brother|sister|uncle|aunt|cousin|family|dad|mum|mom|parents?)$/, /^(friend|classmate|student)$/, /^(hello|goodbye|bye|hi)$/];
  function picClash(a, b) {
    const x = String(a[0]).toLowerCase(), y = String(b[0]).toLowerCase();
    return a[2] === b[2] || x.includes(y) || y.includes(x) || PIC_GROUPS.some(g => g.test(x) && g.test(y));
  }

  // ---------- 对话框 ----------
  // 台词里的 {name} {rival} 换成主角和对手的名字
  const pname = () => (E.S.player && E.S.player.name) || 'Trainer';
  const rivalInfo = () => (E.S.player && E.S.player.gender === 'girl') ? { name: 'Leo', g: 'm', look: LOOKS.leo } : { name: 'Mia', g: 'f', look: LOOKS.mia };
  const fill = v => typeof v === 'string' ? v.split('{name}').join(pname()).split('{rival}').join(rivalInfo().name) : v;
  function talk(pages, onDone) {
    // 别的课：先记下还没换名字的英语原文（台词翻译表按原文找，tools/course/SPEC.md §8）
    if (E.lang) pages.forEach(p => { if (p.en0 === undefined) { p.en0 = p.en; p.target0 = p.target; } });
    pages.forEach(p => ['en', 'zh', 'ui', 'target', 'who'].forEach(k => { p[k] = fill(p[k]); }));
    if (E.lang) pages.forEach(langPage);
    dlg = { pages, i: 0, onDone, tries: 0 }; showPage();
  }
  // ---------- 别的语言的课：代码里写死的英语台词（tools/course/ENGINE.md §5）----------
  // 有台词翻译表（E.lineOf，tools/course/SPEC.md §8）的：
  // · 台词显示、朗读翻好的那句（日语 / 中文标读音），下面一行是界面语言的意思（中文界面 = 原来的中文，英语界面 = 英语原文；
  //   「译」照「剧情中文」的设置收起来，和英语课一样）；
  // · 要开口说的（speak）：要说的那句换成翻好的，按这门语言打分；台词那一行就是要说的那句时（技能指令、选伙伴），上面换成界面语言的说明；
  // · 要选的（answer）：选项都有翻好的才换（问句也换），不然整页走下面的过渡办法。
  // 没翻的（ENGINE.md §5 过渡办法）：
  // · 只是给人看的台词：正文换成界面语言那份（中文界面 = 原来的中文意思；英语界面 = 英语原文），没有「译」、不朗读；
  //   说到「英语」的换成在学的语言（E.courseWord）；正文本来就是课程内容的（村民念的课程句子）：照旧显示原文，下面一行是它的意思
  // · 要开口说的（speak）、要选的（answer）：不是课程内容的，换成这座岛课程里的一句 / 一段对话（E.learnLine：按英语原文的哈希固定挑），
  //   题面给它的意思；进复习本用课程里的编号（pg.q）。英语课不走这里
  const langIsle = () => (M ? (M.isle != null ? M.isle : M.z) : 0) | 0;
  // 今日目击：线索是英语拼的，别的课先不出（ENGINE.md §4）
  const sightOn = () => !!window.EchoSight && !(E && E.lang);
  const langName = () => tx('pk.name.' + E.course);
  const cw = (s, zhUi) => (E.courseWord ? E.courseWord(s, zhUi ? 'zh' : 'en') : s);
  function langPage(pg) {
    if (!pg || pg.lang) return;
    pg.lang = true;
    const zhUi = !I18N || I18N.lang() === 'zh', uiText = cw(zhUi ? pg.zh || pg.en : pg.en || pg.zh, zhUi);
    const en0 = pg.en0 !== undefined ? pg.en0 : pg.en, t0 = pg.target0 !== undefined ? pg.target0 : pg.target;
    const tl = (en, x) => (E.lineOf && en ? E.lineOf(en, Object.assign({ fill }, x)) : null);
    // 台词这一行：课程内容（原文 + 意思）或者翻好的（译文 + 意思）→ true；都不是 → false
    const main = swap => {
      if (!pg.en) return false;
      if (E.entryOf(pg.en)) { pg.ui = E.meanText(pg.en) || ''; return true; }
      const ln = tl(en0, { zh: pg.zh, swap });
      if (!ln) return false;
      pg.en = ln.t; pg.gl = ln.mean || null; pg.tl = true;
      return true;
    };
    const plain = () => { pg.en = uiText; pg.ui = ''; pg.hideEn = false; pg.plain = true; };
    if (pg.kind === 'choice' || pg.kind === 'custom') { if (pg.en && !main()) plain(); return; }
    if (pg.kind === 'speak') {
      const same = en0 === t0;   // 台词那一行就是要说的那句（技能指令、选伙伴、孵蛋）
      if (!E.entryOf(pg.target)) {
        const ln = tl(t0);
        if (ln) {
          const enT = pg.target;
          pg.target = ln.t; pg.tl = true;
          // 要说的那句下面的意思：英语界面是英语原文；中文界面这一页的中文（说明里带着意思）在上面那一行
          pg.mean = zhUi ? null : ln.mean;
          // 说明这一行是界面语言（🔊 念的是要说的那句，wHear）
          // 中文界面用这一页的中文：夹着的英语换成译文、名字换成这门课的写法（「对它大声说：Bubbly，做我的伙伴吧！」的怪兽名，E.glossText）；
          // 换不干净（还剩英语单词）就用「用…说：」
          if (same || !main([[enT, ln.t]])) {
            const zs = zhUi && pg.zh ? (E.glossText ? E.glossText(pg.zh, [[enT, ln.t]]) : pg.zh.split(enT).join(ln.t)) : null;
            pg.en = zs ? cw(zs, true) : tx('w.lang.say', { lang: langName() }); pg.ui = '';
          }
          pg.hideEn = false;
          return;
        }
        const lk = E.learnLine(pg.lkey || pg.target, langIsle(), 'sent');
        if (lk) { pg.target = lk.t; pg.mean = lk.mean; if (lk.q) pg.q = lk.q; pg.en = tx('w.lang.say', { lang: langName() }); pg.ui = ''; pg.hideEn = false; return; }
      }
      pg.mean = E.meanText(pg.target);
      pg.en = uiText && uiText !== pg.target ? uiText : tx('w.lang.say', { lang: langName() }); pg.ui = ''; pg.hideEn = false;
      return;
    }
    if (pg.kind === 'answer') {
      if (!(pg.opts || []).every(o => E.entryOf(o.t))) {
        // 选项都翻好了：换成译文（问句有翻好的也换）
        const tr = (pg.opts || []).map(o => tl(o.t));
        if (tr.length && tr.every(Boolean)) {
          pg.opts.forEach((o, k) => { o.t = tr[k].t; });
          if (!main()) { pg.ui = tx('w.lang.ans', { lang: langName() }); pg.en = ''; }
          pg.hideEn = false;
          return;
        }
        const d = E.learnLine(pg.lkey || (pg.opts.find(o => o.c) || {}).t || pg.en, langIsle(), 'dlg');
        if (d) { pg.en = d.q; pg.opts = [{ c: true, t: d.a }].concat(d.wrong.map(t => ({ t }))).sort(() => Math.random() - 0.5); pg.q = d.rq; pg.pic = null; pg.cap = null; pg.ui = d.mean || tx('w.lang.ans', { lang: langName() }); pg.hideEn = false; return; }
      }
      // 选项是课程内容（村民出题、看图选词）：问句是课程内容或者翻好了就照旧（下面一行是意思）；不是（写死的英语 / 中文问法）就换成一句说明
      const how = pg.pic ? 'w.lang.pic' : 'w.lang.ans';
      if (!E.entryOf(pg.en) && main()) { pg.hideEn = false; return; }
      pg.ui = E.entryOf(pg.en) ? (E.meanText(pg.en) || tx(how, { lang: langName() })) : tx(how, { lang: langName() });
      if (!E.entryOf(pg.en)) pg.en = '';
      pg.hideEn = false;
      return;
    }
    if (!pg.en) return;
    if (!main()) plain();
  }
  const page = () => dlg && dlg.pages[dlg.i];
  // 剧情中文（家长 2026-10-07）：S.settings.storyZh = always 总是显示 / tap 点一下才显示 / auto 自动（默认）。
  // 自动：第 1–4 座岛总是显示；从第 5 座岛起，人说的普通台词先只给英文，中文收成「译」按钮。
  // 一直显示中文的：任务页（说 / 选）、只听不看的页、旁白和机关（没有人物头像的页）、挑战馆里（机关规则）、标了 zhKeep 的页
  // 2026-11-19（界面语言）：英文下面那行是 zhLine(pg)——台词的意思用 gloss（中文界面给 zh，英语界面没有，这一行和「译」都不出）；
  // 页面带 ui 的（委托的说明、奖励这种界面文字，已经是界面语言）照样显示，不收起来。
  // 别的课里翻好的台词（langPage 的 pg.gl）：下面那行是 pg.gl（界面语言的意思，英语界面也有），照样按设置收成「译」
  const glOf = pg => (pg.gl !== undefined ? pg.gl : gloss(pg));
  const zhLine = pg => (pg.ui != null ? pg.ui : glOf(pg));
  const zhMode = () => { const m = E.S.settings.storyZh; return m === 'always' || m === 'tap' ? m : 'auto'; };
  function zhFolded(pg) {
    const m = zhMode();
    if (m === 'always' || pg.ui != null || !glOf(pg) || !pg.en || pg.kind || pg.hideEn || pg.zhKeep || !pg.look) return false;
    if (M && M.kind === 'inside' && M.room === 'G') return false;
    if (m === 'tap') return true;
    return (M ? (M.isle != null ? M.isle : M.z) : 0) >= 4;
  }
  function showZh() {
    const pg = page(), b = $('d-zh');
    if (!pg || !b || b.tagName !== 'BUTTON') return;
    finishType();
    b.outerHTML = '<div class="d-zh" id="d-zh">' + E.esc(zhLine(pg)) + '</div>';
    const L = E.dayLog && E.dayLog();
    if (L) L.zhTaps = (L.zhTaps || 0) + 1;
    E.save();
  }
  function showPage() {
    const pg = page(), box = $('w-dlg');
    if (!pg) { closeDlg(); return; }
    dlg.tries = 0; dlg.picked = false;
    // 别的课：课程内容的那句话不一个字一个字打出来（要整句标读音）；rb 显示要学的那句话（标读音，英语课就是 esc）
    const sr = E.speakMode() === 'sr', esc = E.esc, typing = !pg.kind && !!pg.en && !pg.hideEn && !(E.lang && E.entryOf(pg.en)), rb = t => (E.lang ? E.ruby(t) : esc(t));
    // AI 打分用不了（没网 / 额度 / 没密钥，game.js 的 aiDown，评估第 3 条）：说话任务给「先跳过（已放进复习，联网后要补说）」，
    // 选回答的任务改成直接点出正确的回答（还是要听懂）
    const down = sr && (pg.kind === 'speak' || pg.kind === 'answer') && !!(E.aiDown && E.aiDown());
    dlg.aiTap = down && pg.kind === 'answer';
    // 「先跳过（已放进复习……）」和 game.js 的 SKIP_TXT 是同一句（字表里一份；game.js 搬字表时用同一个说法）
    const aiSkip = '<button class="link ai-skip" data-act="wAiSkip" id="w-aiskip"' + (down && pg.kind === 'speak' ? '' : ' hidden') + '>' + hx('w.aiskip') + '</button>';
    clearInterval(dlg.tw);
    const face = pg.look ? '<img class="d-face" src="' + portrait(pg.look) + '" alt="">' : '<span class="d-face emo">' + (pg.emo || '💬') + '</span>';
    const zl = zhLine(pg);
    // 别的课里只给人看的台词（pg.plain，界面语言写的）：没有 🔊（不朗读）
    let body = '<div class="d-name">' + (E.lang ? TH_('person', whoLabel(pg.who)) : esc(whoLabel(pg.who))) + '</div>' + (pg.plain ? '' : '<button class="spk mini d-hear" data-act="wHear" aria-label="' + hx('w.dlg.hear') + '">' + E.SPK + '</button>') +
      '<div class="d-row">' + face + '<div class="d-text">' +
      (pg.en ? '<div class="d-en' + (pg.hideEn ? ' hid' : '') + '" id="d-en">' + (pg.hideEn ? hx('w.dlg.listen') : typing ? '' : rb(pg.en)) + '</div>' : '') +
      (!zl ? '' : zhFolded(pg)
        // 中文先收起来：点「译」才显示（每点一次记进当天的学习记录，周报里能看到越来越少）
        ? '<button class="d-zh' + (typing ? ' wait' : '') + '" id="d-zh" data-act="wZh" aria-label="' + hx('w.dlg.zh.aria') + '" style="display:block;margin:4px 0 0 auto;padding:2px 14px;border:2px solid #1f8a9e;border-radius:999px;background:#e8f7f9;color:#16707f;font:inherit;font-size:15px;font-weight:800;cursor:pointer">' + hx('w.dlg.zh.btn') + '</button>'
        : '<div class="d-zh' + (typing ? ' wait' : '') + '" id="d-zh">' + esc(zl) + '</div>') + '</div></div>';
    // 任务页（2026-11-20 老板在 iPhone 横屏上看鹦鹉门：「根本看不出来」「还要往下滑才能说」）：
    // 图片和它的说明（pg.cap，比如钟点「3:00 pm」）在一块 .d-pic 里，话筒、提示、听到的话在一块 .d-act 里——
    // 竖屏这两块 display: contents，和以前一样一列排；横屏 style.css 把 图片 | 选项 | 话筒 排成一行，不用往下滑就看得见话筒
    const picHTML = pg.pic ? '<div class="d-pic"><div class="say-emoji">' + pg.pic + '</div>' + (pg.cap ? '<b class="d-cap">' + esc(pg.cap) + '</b>' : '') + '</div>' : '';
    if (pg.kind === 'speak') {
      body += '<div class="d-task' + (pg.pic ? ' has-pic' : '') + '">' + picHTML + '<div class="say-text" id="w-say">' + E.wordsHTML(pg.target) + '</div>' + (pg.mean ? '<div class="say-zh">' + esc(pg.mean) + '</div>' : '') + '<div class="d-act">' +
        (sr ? '<button class="mic" id="w-mic" data-act="wMic" aria-label="' + hx('w.mic.aria') + '">' + E.MIC + '</button><div class="mic-hint" id="w-hint">' + hx(down ? 'w.mic.down' : 'w.mic.tap') + '</div><div class="heard" id="w-heard"></div>'
          : '<div class="mic-hint" id="w-hint">' + hx('w.self.hint') + '</div><button class="btn leaf" data-act="wSelfDone">' + hx('w.self.done') + '</button>') +
        '<button class="link" data-act="wSkip" id="w-skip"' + (sr ? ' hidden' : '') + '>' + hx('w.skip') + '</button>' + (sr ? aiSkip : '') + '</div></div>';
    } else if (pg.kind === 'answer') {
      body += '<div class="d-task' + (pg.pic ? ' has-pic' : '') + '">' + picHTML + '<div class="opts list" data-n="' + pg.opts.length + '">' + pg.opts.map((o, k) => '<button class="opt en" data-act="wOpt" data-i="' + k + '"><span class="o-t">' + rb(o.t) + '</span></button>').join('') + '</div><div class="d-act">' +
        (dlg.aiTap ? '<small class="tip" id="w-hint">' + hx('w.ans.down') + '</small>'
          : sr ? '<small class="tip">' + hx('w.ans.sr') + '</small><button class="mic" id="w-mic" data-act="wMic" aria-label="' + hx('w.mic.aria') + '">' + E.MIC + '</button><div class="mic-hint" id="w-hint"></div><div class="heard" id="w-heard"></div>'
          : '<small class="tip" id="w-hint">' + hx('w.ans.self') + '</small>') +
        '<button class="link" data-act="wSkip" id="w-skip"' + (sr ? ' hidden' : '') + '>' + hx('w.skip') + '</button></div></div>';
    } else if (pg.kind === 'choice') {
      body += '<div class="d-task"><div class="d-choice">' + pg.opts.map((o, k) => '<button class="btn ' + (o.cls || 'ghost') + '" data-act="wPick" data-i="' + k + '">' + o.html + '</button>').join('') + '</div></div>';
    } else if (pg.kind === 'custom') body += '<div class="d-task" id="w-custom">' + pg.html + '</div>';
    else body += '<span class="d-next">▼</span>';
    box.innerHTML = body;
    if (pg.kind === 'custom' && pg.mount) pg.mount($('w-custom'), extra => { if (page() !== pg) return; insertPages(extra); pg.kind = null; nextPage(); });
    box.classList.toggle('task', !!pg.kind);
    box.hidden = false;
    box.scrollTop = 0;
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
  function insertPages(extra) { if (extra && extra.length) { if (E.lang) extra.forEach(langPage); dlg.pages.splice(dlg.i + 1, 0, ...extra); } }
  function passTask(score) {
    const pg = page();
    E.S.stats.spoken++; E.qProg('spoken', 1);
    if (score >= 85) { E.S.stats.perfect++; E.qProg('perfect', 1); }
    if (pg.q && E.revRight) E.revRight(pg.q);
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
    $('w-hint').textContent = tx('w.listening');
    const res = await E.recognize(x => { const h = $('w-heard'); if (h) h.textContent = x; }, pg.kind === 'speak' ? [pg.target] : (pg.opts || []).map(o => o.t));
    if (dlg !== d || page() !== pg) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) {
      E.RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') E.RT.noRec = true;
      E.toast(tx('w.sr.broken'));
      showPage();
      return;
    }
    if (!res.alts.length) {
      // 没听清算一次尝试（3 次以后可以先跳过）；没网 / 额度 / 没密钥说清原因，AI 连着用不了（aiDown）就给「先跳过」/ 改成点选
      // （failHint 是 game.js 的，搬字表要等第二批）
      const h = $('w-hint'), msg = E.failHint ? E.failHint(res) : tx('w.sr.unheard');
      if (res.fail === 'unheard' || !E.failHint) {
        d.tries++;
        h.textContent = d.tries >= 3 ? tx('w.try.skip', { msg }) : msg;
        if (d.tries >= 3) { const sk = $('w-skip'); if (sk) sk.hidden = false; }
        return;
      }
      if (msg) h.textContent = msg;
      if (E.aiDown && E.aiDown()) {
        if (pg.kind === 'speak') { const sk = $('w-aiskip'); if (sk) sk.hidden = false; }
        else { dlg.aiTap = true; h.innerHTML = hx('w.ans.down'); const mc = $('w-mic'); if (mc) mc.style.display = 'none'; }
      }
      return;
    }
    if (pg.kind === 'speak') {
      const r = E.bestScore(pg.target, res.alts);
      $('w-heard').textContent = tx('w.heard', { t: r.heard });
      if (r.score < 90 && E.aiTip) E.aiTip(pg.target, r.heard, $('w-heard'));
      document.querySelectorAll('#w-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
      if (r.score >= 55) { $('w-hint').innerHTML = hx('w.score.ok', { n: r.score }); setTimeout(() => { if (page() === pg) passTask(r.score); }, 700); }
      else { d.tries++; const lo = tx('w.score.low', { n: r.score }); $('w-hint').textContent = d.tries >= 3 ? tx('w.try.skip', { msg: lo }) : lo; if (d.tries >= 3) { const sk = $('w-skip'); if (sk) sk.hidden = false; } }
    } else {
      const sc = pg.opts.map(o => E.bestScore(o.t, res.alts));
      let bi = 0; sc.forEach((s, k) => { if (s.score > sc[bi].score) bi = k; });
      $('w-heard').textContent = tx('w.heard', { t: sc[bi].heard });
      if (pg.opts[bi].c && sc[bi].score >= 45) { markOpts(bi); setTimeout(() => { if (page() === pg) passTask(sc[bi].score); }, 700); }
      else if (!pg.opts[bi].c && sc[bi].score >= 60) { markOpts(pg.opts.findIndex(o => o.c), bi); setTimeout(() => { if (page() === pg) failTask(); }, 900); }
      else { d.tries++; const nm = tx('w.ans.nomatch'); $('w-hint').textContent = d.tries >= 3 ? tx('w.try.skip', { msg: nm }) : nm; if (d.tries >= 3) { const sk = $('w-skip'); if (sk) sk.hidden = false; } }
    }
  }
  function markOpts(ri, wi) { document.querySelectorAll('#w-dlg .opt').forEach((b, k) => b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim')); }
  // AI 打分用不了时的出路（评估第 3 条）：这句放进复习（联网后要补说），剧情照常往下走（说话任务算「先跳过」，选回答的按点对没点对算）
  // ok：false = 点错了（按答错算）；不给 = 先跳过
  function aiSkipTask(ok) {
    const pg = page(); if (!pg || !pg.kind) return;
    const right = pg.kind === 'answer' ? (pg.opts.find(o => o.c) || {}).t : pg.target;
    // 没有编号的句子（剧情台词）：中文取「：」后面那截（像「大声说：我们去踏浪吧！」），不是中文就不要；选回答的页面中文是问题的意思，不用
    const zh = pg.kind === 'speak' ? String(pg.zh || '').split('：').pop() : '';
    if (E.revLater) E.revLater(pg.q || (right ? { en: right, zh: /[一-鿿]/.test(zh) ? zh : '' } : null));
    const L = E.dayLog && E.dayLog(); if (L) L.aiSkip = (L.aiSkip || 0) + 1;
    if (ok === false) { failTask(); return; }
    insertPages(pg.pass ? pg.pass(0) : null);
    E.save();
    pg.kind = null;
    nextPage();
  }
  function onOpt(i) {
    const pg = page();
    if (!pg || pg.kind !== 'answer') return;
    if (dlg.aiTap) {   // AI 用不了：直接点出正确的回答
      if (dlg.picked) return;
      dlg.picked = true;
      const ok = !!pg.opts[i].c;
      markOpts(ok ? i : pg.opts.findIndex(o => o.c), ok ? undefined : i);
      if (ok) E.say(pg.opts[i].t);
      setTimeout(() => { if (page() === pg) aiSkipTask(ok ? undefined : false); }, ok ? 900 : 1000);
      return;
    }
    if (E.speakMode() === 'sr') { E.say(pg.opts[i].t); return; }
    if (dlg.picked) return;
    dlg.picked = true;
    if (pg.opts[i].c) {
      markOpts(i);
      E.say(pg.opts[i].t);
      $('w-hint').innerHTML = hx('w.ans.ok');
      // 对话框放不下时（横屏、长句子），让刚出来的「我说完了」露出来
      const box = $('w-dlg'), hr = $('w-hint').getBoundingClientRect(), br = box.getBoundingClientRect();
      if (hr.bottom > br.bottom - 6) box.scrollTop += hr.bottom - br.bottom + 12;
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
      if (PL.surf && here === 'D') { const d = M.dives.find(q => q.x === PL.x && q.y === PL.y); if (d) useSkill('dive', () => goMap(d.to, d.arrive)); else talk([{ who: tx('w.who.nar'), emo: '🌊', en: 'The sea is very deep here.', zh: '这里的海很深。' }]); return; }
      if (here === 'U') { const u = M.surfaces.find(q => q.x === PL.x && q.y === PL.y); if (u) { talk([{ who: tx('w.who.nar'), emo: '🫧', en: 'Light is shining from above. Swim up?', zh: '上面有光照下来。要浮上去吗？', kind: 'choice', opts: [{ html: hx('w.up.go', { w: uiW('Swim up') }), cls: 'sun' }, { html: hx('w.no') }], pick: i => { if (!i) setTimeout(() => goMap(u.to, u.arrive), 60); return []; } }]); } return; }
      if (f && f.falls) talk([{ who: tx('w.who.nar'), emo: '🌊', en: 'It is a big waterfall.', zh: '一道大瀑布。要先踏浪到瀑布下面。' }]);
      return;
    }
    if (f.n) { f.n.face = faceTo(f.n, PL); if (!story('talk', f.n) && !questTalk(f.n)) npcTalk(f.n); }   // 剧情优先，其次是 TA 身上的委托，再是平常的话
    else if (f.s) signTalk(f.s);
    else if (f.follower) { E.SFX.tap(); MG.talkSheet(MG.lead().uid); }
    else if (f.pc) { E.SFX.tap(); E.say('Welcome to the monster box!'); MG.pcSheet(); }
    else if (f.statue) { if (!story('tile', f)) markTalk(f); }
    else if (f.gate) { if (!story('tile', f)) talk([{ who: tx('w.who.nar'), emo: '🚧', en: 'The gate is closed.', zh: '机关门关着。' }]); }
    else if (f.obst) obstacle(f);
    else if (f.water) waterMenu(f);
    else if (f.hidden) foundHidden(f.hidden);
    else if (f.w) goMap(f.w.to, f.w.arrive);
  }
  function markTalk(f) {
    const zs = []; for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.grid[y][x] === 'Z') zs.push(x + ',' + y);
    const mk = (M.def && M.def.marks || [])[zs.indexOf(f.x + ',' + f.y)];
    if (mk) talk((Array.isArray(mk[0]) ? mk : [mk]).map(([en, zh]) => ({ who: tx('w.who.nar'), emo: '🗿', en, zh })));
    else talk([{ who: tx('w.who.nar'), emo: '🗿', en: 'It is a big statue.', zh: '一座高大的雕像。' }]);
  }
  function signTalk(s) {
    if (s.en) { talk([].concat(s.more ? [[s.en, s.zh]].concat(s.more) : [[s.en, s.zh]]).map(([en, zh]) => ({ who: tx('w.who.sign'), emo: '🪧', en, zh }))); return; }
    // 别的语言的课：w.en 是那门语言的岛名，告示牌（英语界面显示英语原文）用小镇地图的英文名
    const tn = (x, z) => (E.lang ? ((EM.get('t' + z) || {}).en || '') : x.en.replace(/[!?]/g, '') + ' Town');
    const w = E.W[M.z], nx = E.W[M.z + 1], town = tn(w, M.z), next = nx ? tn(nx, M.z + 1) : '';
    const S = (en, zh) => ({ who: tx('w.who.sign'), emo: '🪧', en, zh });
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
    const coins = (k, en, zh) => dailyDone(k) ? [P('Good job!', '说得真好！')] : (markDaily(k), E.S.coins += 10, E.renderTop(), [P(en, zh, { onShow: () => { E.SFX.coin(); E.toast(tx('w.coins', { n: 10 }), 'gold'); } })]);
    const lines = arr => arr.map(q => Array.isArray(q) ? P(q[0], q[1]) : P(q.en, q.zh, q));
    if (n.give && !WS().flags['g:' + M.id + ':' + n.id]) {
      // 一次性送东西（回声贝、道具）
      const it = MG.ITEMS[n.give.item];
      talk(lines(n.give.say || [['Take this!', '这个送给你！']]).concat([
        P('You got ' + (it ? it.en : n.give.item) + '!', '得到了' + (it ? it.zh : n.give.item) + (n.give.n > 1 ? ' ×' + n.give.n : '') + '！', { onShow: () => { WS().flags['g:' + M.id + ':' + n.id] = 1; MG.addItem(n.give.item, n.give.n || 1); if (n.give.flag) WS().flags['s:' + n.give.flag] = 1; E.save(); hud(); E.SFX.win(); E.toast((it ? it.icon + ' ' + L(it) : n.give.item) + ' +' + (n.give.n || 1), 'gold'); } }),
      ]).concat(lines(n.give.after || [])));
      return;
    }
    if (n.role === 'daycare') {
      const gk = 'g:daygift';
      if (!WS().flags[gk]) {
        talk([P('Hello, dear! We are the daycare. We look after monsters.', '你好呀，孩子！我们开怪兽幼儿园，帮大家照顾怪兽。'), P('Leave two monsters with us. If they get along, you may find an egg!', '把两只怪兽寄养在这里。它们相处得好的话，说不定会有蛋哦！'),
          P('Oh! This egg was in our garden this morning. Take it, please!', '哦！今天早上花园里出现了一个蛋，你带走吧！', { onShow: () => { WS().flags[gk] = 1; MG.giveEgg(n.egg || 'moonbunny'); E.save(); E.SFX.win(); E.toast(tx('w.egg.got'), 'gold'); } }),
          P('Walk with it, and it will hatch.', '带着它多走走路，它就会孵出来。')], () => MG.daycareSheet());
      } else { E.say('Welcome back!', undefined, 'f'); MG.daycareSheet(); }
      return;
    }
    // 守卫、渡轮不开时说的是「要几枚徽章」这种规则：中文一直显示
    const keep = pgs => pgs.map(q => Object.assign(q, { zhKeep: true }));
    if (n.role === 'guard') {
      talk(keep(n.say ? lines(n.say) : [P("Stop! You can't go north without this town's badge.", '站住！没有本镇的徽章不能往北走。'), P('Beat the Isle Master first!', '先去挑战馆打败岛主吧！')]));
    } else if (n.role === 'ferry') {
      // 渡轮 / 船：带你去别的岛
      const ok = (n.badge == null || nBadges() >= n.badge) && (!n.need || WS().flags['s:' + n.need]);
      if (!ok) { talk(keep(lines(n.no || [['Sorry, the boat is not ready yet.', '抱歉，船还不能开。']]))); return; }
      // @i18n-content 「要坐船去……吗？」是这一页台词的中文意思（括号里的「对面的岛」也是）
      talk(lines(n.say || [['All aboard! Do you want to go?', '上船啦！要出发吗？']]).concat([P(n.ask || 'Where do you want to go?', '要坐船去' + (n.toName || '对面的岛') + '吗？', { kind: 'choice', opts: [{ html: n.toName ? hx('w.ferry.go', { to: ferryTo(n), w: uiW("Let's go!") }) : hx('w.ferry.go0', { w: uiW("Let's go!") }), cls: 'sun' }, { html: hx('w.ferry.no', { w: uiW('Not now') }) }], pick: i => { if (!i) setTimeout(() => sail(n), 80); return []; } })]));
      // @i18n-content-end
    } else if (n.say && n.role !== 'trainer') {
      const pg = lines(n.say);
      if (n.speak) pg.push(P('Can you say it?', '你能跟我说一遍吗？', { kind: 'speak', target: n.speak, pass: () => coins(dk, 'Good job! Here are 10 coins.', '说得真好！送你 10 个金币。') }));
      talk(pg);
    } else if (n.role === 'trainer') {
      if (beaten(n)) talk(n.after ? lines(n.after) : [P('You are really strong! Let me train more.', '你真厉害！我要再多练练。')]);
      else trainerTalk(n);
    } else if (n.role === 'nurse') {
      talk([
        P('Hi! This is the Rest Stop. Are your monsters tired?', '你好！这里是休息站。你的怪兽累了吗？'),
        P('Let them take a short nap and drink some warm milk.', '让它们睡个小觉、喝点热牛奶吧。', { onShow: () => { MG.healAll(); WS().center = { map: M.id }; E.jingle('heal', E.SFX.win); E.save(); } }),
        P('Ding! They are full of energy again. Have fun!', '叮！它们又精神满满啦，去玩吧！'),
        P('You can use the computer to change your team.', '旁边的电脑可以把怪兽存进箱子、换队伍。'),
      ]);
    } else if (n.role === 'clerk') {
      E.say('Welcome! What would you like?', undefined, 'm');
      shopSheet();
    } else if (n.role === 'leader') {
      const b = w.boss, had = !!E.S.mon.badges[z], g = had ? null : gymNeed(z);
      // 挑战馆跟着课本进度开：前几个课本单元的 BOSS 关没过，岛主不接受挑战
      if (g && !g.ok) {
        // @i18n-content 拼的是下面那页台词的中文意思（中文界面才显示）
        const miss = g.missing.length > 3 ? g.missing.slice(0, 3).join('、') + ' 等 ' + g.missing.length + ' 个单元' : g.missing.join('、');
        talk([P(b.hello, '我是' + b.name + '！', { emo: b.emoji }),
          P('Come back after you beat Unit ' + g.unitN + '!', '先去「📚 闯关练习」打败课本 ' + miss + ' 的 BOSS 关，再来挑战我！（课本 BOSS ' + g.done + '/' + g.need + '）', { emo: b.emoji, zhKeep: true })]);
        // @i18n-content-end
        return;
      }
      // 打通冠军赛以后：岛主重赛，等级 +15，题目换成最近学的课本单元
      const re = had && !!WS().flags['s:champion'];
      // @i18n-content 岛主开场白的中文意思
      const hi = re ? '冠军回来啦？我也变强了！这次考你最近学的课本单元。' : had ? '又来挑战我了？好，再比一场！' : '我是' + b.name + '！想拿本镇的徽章，就先打败我！';
      // @i18n-content-end
      talk([P(re ? "Welcome back, Champion! I'm much stronger now!" : b.hello, hi, { emo: b.emoji })], () => battle('leader', {
        foes: re ? rematchFoes(z) : undefined, recent: re,
        after: res => {
          if (res === 'win' && !had) talk([P('You beat me! Here is my badge.', '你赢了！这枚徽章给你。'), P('The road to the north is open now.', '现在北边的路已经为你打开了！')]);
          else if (res === 'win' && re) {
            // 每位岛主每天第一次重赛赢了送一首进化曲
            if (dailyDone('rm' + z)) { talk([P('What a battle! Come back tomorrow!', '好精彩的对战！明天再来吧！', { emo: b.emoji })]); return; }
            markDaily('rm' + z);
            const ids = Object.keys((window.DEX && DEX.STONES) || {}), id = ids[(z + new Date().getDate()) % Math.max(1, ids.length)], it = MG.ITEMS[id];
            talk([P('You are a true Champion! Take this.', '你真是名副其实的冠军！这个送给你。', { emo: b.emoji, onShow: () => { if (it) { MG.addItem(id, 1); E.save(); E.jingle('item', E.SFX.win); E.toast(it.icon + ' ' + L(it) + ' +1', 'gold'); } } })]);
          }
        },
      }));
    } else if (n.role === 'quiz') {
      const sr = E.src ? E.src(z) : { w: z, d: w }, k = Math.floor(Math.random() * sr.d.dlgs.length), it = sr.d.dlgs[k];   // 有几成换成课本正在学的单元
      const opts = [{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))].sort(() => Math.random() - .5);
      // @i18n-content 第一页台词的中文意思（括号里那半句也是）
      talk([
        P('Hello! Can you answer my question?', '你好！你能回答我的问题吗？' + (dailyDone(dk) ? '' : '答对了今天有礼物哦。')),
        // @i18n-content-end
        P(it[0], '听一听，选出合适的回答，然后说出来。', {
          kind: 'answer', opts, q: { kind: 'dlg', w: sr.w, i: k },
          pass: () => {
            if (dailyDone(dk)) return [P('Great answer! See you tomorrow.', '回答得真好！明天再来吧。')];
            markDaily(dk); E.S.mon.balls += 1; hud();
            return [P('Perfect! Here is an Echo Ball for you.', '太棒了！送你一个回声球。', { onShow: () => { E.SFX.coin(); E.toast(tx('w.ball1'), 'gold'); } })];
          },
          fail: () => [P('Hmm, not quite. You can say: "' + it[1] + '"', '差一点。可以这样回答：“' + it[1] + '”')],
        }),
      ]);
    } else if (n.role === 'gift') {
      // 看图说单词，答对每天送一瓶药水
      const sr = E.src ? E.src(z) : { w: z, d: w }, L = sr.d.words, k = (n.seed + new Date().getDate()) % L.length, it = L[k];
      // 错的选项不能也对得上这张图（2026-11-20 细节检查：英语界面只有图，没有中文意思）：同一个图、一个词包着另一个（focus / focus on）、
      // 同一组只靠图分不开的词（早上好 / 下午好 / 晚上好、三顿饭、家里人、起床 / 睡觉、生日 / 蛋糕 / 派对）都不当错的选项
      const others = L.filter((x, j) => j !== k && !picClash(x, it)).sort(() => Math.random() - .5).slice(0, 2);
      const opts = [{ c: true, t: it[0] }, ...others.map(o => ({ t: o[0] }))].sort(() => Math.random() - .5);
      talk([
        P('Hi! What is this in English?', '你好！这个用英语怎么说？（' + it[1] + '）', {
          kind: 'answer', opts, pic: it[2], q: { kind: 'word', w: sr.w, i: k },
          pass: () => {
            if (dailyDone(dk)) return [P('Yes! You know it well.', '对！你记得真牢。')];
            markDaily(dk); MG.addItem('potion', 1);
            return [P('Right! Take this potion.', '答对了！这瓶药水送给你。', { onShow: () => { E.SFX.coin(); E.toast(tx('w.potion1'), 'gold'); } })];
          },
          fail: () => [P('It is "' + it[0] + '". Say it again next time!', '它叫 “' + it[0] + '”。下次再来说说看！')],
        }),
      ]);
    } else if (n.role === 'hiker') {
      const tips = [
        ['You can jump down a ledge, but you cannot climb up.', '台阶只能往下跳，不能往上爬哦。'],
        ['Use a Quiet Spray, and wild monsters will not hear you.', '用悄悄喷雾，草丛里的怪兽就听不见你，不会来打扰你。'],
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
        P('Beat the Isle Master, and the guard will let you go north.', '打败岛主，守卫就会让你往北走。'),
        P('Now, can you say this to me?', '现在，你能对我说这句话吗？', {
          kind: 'speak', target: 'Nice to meet you, Professor!',
          pass: () => coins(dk, 'Very good! Here are 10 coins.', '说得很好！送你 10 个金币。'),
        }),
      ]);
    } else {
      const sr = E.src ? E.src(z) : { w: z, d: w }, L = sr.d.sents, s1 = L[(n.seed + z) % L.length], s2 = L[(n.seed + z + 3) % L.length];
      talk([
        P('Hi there!', '你好呀！'),
        P(s1[0], s1[1]),
        P(s2[0], s2[1]),
        P('Can you say it?', '你能跟我说一遍吗？', {
          kind: 'speak', target: s2[0], q: { kind: 'sent', w: sr.w, i: L.indexOf(s2) },
          pass: () => coins(dk, 'Good job! Here are 10 coins.', '说得真好！送你 10 个金币。'),
        }),
      ]);
    }
  }
  // ---------- 支线委托（quests.js，家长 2026-11-15：「把 AI 聊天做进冒险里」）----------
  // 镇上的人有委托：走过去按 A → TA 说完请求 →「🗣️ 用英语帮 TA」→ 和 TA 用英语聊（talk.js 的 openQuest，人设和小步骤按委托 id 读 quests.js）
  // → 聊天目标完成了，回到地图上 TA 道谢、给奖励。完成的记在 world.flags['q:' + id] = 星数（1–3）。
  // 委托不挡主线；没完成随时能再来，什么都不丢；AI 聊不了时照样听 TA 说完请求，再用一句话告诉孩子为什么现在做不了。
  // 别的语言的课：委托要和岛民 AI 聊天，这门语言的还没有——委托一条都不出（头上没有「?」，ENGINE.md §4）
  const QL = () => (window.QUESTS && !(E && E.lang) && QUESTS.list) || [];
  const questDone = q => WS().flags['q:' + q.id] | 0;
  // 这个人身上的委托（人物是跟着地图存的，查一次记在身上）
  const questOf = n => { if (n._q === undefined) n._q = QL().find(q => q.map === M.id && String(q.npc) === String(n.id)) || null; return n._q; };
  // 现在还不能接的原因（能接返回 ''）：要先完成另一条委托 / 徽章不够
  function questLock(q) {
    const nd = q.need || {}, pre = nd.quest && QUESTS.byId[nd.quest];
    if (pre && !questDone(pre)) return tx('w.q.lock.pre', { name: L(pre) });
    if (nd.badges && nBadges() < nd.badges && !DEBUG) return tx('w.q.lock.badges', { n: nd.badges, m: nBadges() });
    return '';
  }
  const questOpen = q => !!q && !questDone(q) && !questLock(q);
  // 奖励写成一行字（对话框、委托本、完成时的提示都用）
  function questReward(q) {
    const r = q.reward || {}, out = [];
    if (r.egg) out.push(tx(r.shiny ? 'w.q.rw.shiny' : 'w.q.rw.egg'));
    (r.items || []).forEach(([id, k]) => { const it = MG.ITEMS[id]; if (it) out.push(it.icon + ' ' + L(it) + (k > 1 ? ' ×' + k : '')); });
    if (r.coins) out.push(tx('w.q.rw.coins', { n: r.coins }));
    return out.join(tx('w.sep'));
  }
  // AI 聊天现在用不了的原因（能聊返回 null）：msg 是给孩子看的一句话（和聊天界面、首页学习锁说的一样；talk.js 给的原因还是中文，第二批搬）；
  // retry：密钥 / 额度这种家长处理完马上就能聊的，给一个「再试一次」
  function questBlock() {
    const T = window.EchoTalk;
    if (!T || !T.openQuest || !T.blocked) return { msg: tx('w.q.noai') };
    const b = T.blocked();
    if (b) return { msg: b.replace(/[。！!]+$/, '') };
    const kb = E.chatKeyBad ? E.chatKeyBad() : '';
    if (kb) return { msg: T.errText(kb) || tx('w.q.aidown'), retry: true };
    return null;
  }
  // 完成委托还能不能再换 10 分钟冒险时间（冒险限时开着、今天「多学换时间」还没到上限）
  const questBonus = () => { const b = E.advBonus ? E.advBonus() : null; return b && b.on ? b : null; };
  let questBonus0 = 0;            // 开聊前今天已经换了几分钟（聊完比一下，多了就告诉孩子）
  const questOwe = new Set();     // 做完了、奖励也给了，但感谢的话还没当面说的委托（评语是后来才到的；不存档，丢了也不要紧）
  const questTold = new Set();    // 这次打开游戏已经说过「现在做不了，因为……」的（委托 id + 原因）：再按 A 就不重复了，说 TA 平常的话
  // 固定台词写成「英文, 中文」一对（tools/voice/collect.js 按这个样子收去配音）
  const Q_RETRY = ["That's OK. Come back and try again any time!", '没关系，随时可以再来试一次！'];
  const Q_LATER = ['Not now. Please come back later.', '这个委托先留着，随时可以回来。'];
  function questTalk(n) {
    const q = n.mon ? null : questOf(n);
    if (!q) return false;
    const info = npcLook(n), P = (en, zh) => ({ who: info.name, look: info.look, g: info.g, en, zh });
    if (questDone(q)) {
      if (questOwe.has(q.id)) { questThanks(n, q); return true; }
      talk([P(q.bye[0], q.bye[1])], () => npcTalk(n));   // 做完以后：先说一句近况，再接 TA 平常的话
      return true;
    }
    if (questLock(q)) return false;   // 还不能接：TA 只说平常的话（委托本里写着为什么）
    const why = questBlock(), told = q.id + ':' + (why ? why.msg : '');
    // AI 聊不了（没开通 / 没网 / 时间用完）：第一次照样听 TA 说完请求、告诉孩子为什么现在做不了；同一个原因再按 A 就是 TA 平常的话
    // （没有 AI 的孩子照样能和这些人说话、做每天的跟读），等能聊了又回到委托
    if (why && !why.retry && questTold.has(told)) return false;
    const pages = q.ask.map(a => P(a[0], a[1]));
    if (q.note) pages.push({ who: tx('w.who.nar'), emo: '📝', en: q.note[0], zh: q.note[1] });
    // 这两页英文下面那行是界面文字（为什么现在做不了、目标、奖励），用 ui（界面语言），不是台词的翻译：英语界面也要显示
    if (why && !why.retry) { questTold.add(told); pages.push({ who: tx('w.q.who', { name: L(q) }), emo: '📋', en: Q_LATER[0], ui: tx('w.q.why', { t: why.msg }) + (gloss({ zh: Q_LATER[1] }) || '') }); }
    else {
      const bonus = questBonus();
      pages.push({
        who: tx('w.q.who', { name: L(q) }), emo: '📋', en: q.en,
        ui: (why ? tx('w.q.why', { t: why.msg }) : '') + tx('w.q.ask', { goal: L({ zh: q.goalZh, en: q.goal }), rw: questReward(q) }) + (bonus && bonus.bonus < bonus.max ? tx('w.q.bonus') : ''),
        // 按钮上的字小一号、不换行：竖屏两个按钮并排时「🗣️ 用英语帮 TA」正好一行
        kind: 'choice', opts: [{ html: '<span style="font-size:16px;white-space:nowrap">' + hx(why ? 'w.q.retry' : 'w.q.help') + '</span>', cls: 'sun' }, { html: '<span style="font-size:16px;white-space:nowrap">' + hx('w.q.later') + '</span>' }],
        pick: i => { if (!i) setTimeout(() => questChat(n, q), 60); return []; },
      });
    }
    talk(pages);
    return true;
  }
  function questChat(n, q) {
    if (dlg || busy || overlay || !window.EchoTalk || !EchoTalk.openQuest) return;
    const b = questBonus();
    questBonus0 = b ? b.bonus : 0;
    held = null;
    EchoTalk.openQuest(q.id, npcLook(n).look, r => questResult(n, q, r));
  }
  // 聊天有结果了（talk.js 关掉聊天界面时调；评语在后台才到的，到了再调一次）
  function questResult(n, q, r) {
    if (!E || !E.S) return;
    const fresh = !!(r && r.done) && !questDone(q);
    if (fresh) questGrant(q, Math.max(1, Math.min(3, (r.stars | 0) || 1)));
    // 人还站在 TA 跟前、手上没别的事：TA 当面说。不然（人已经走开了、在对战、回首页了）只弹一句，感谢的话留到下次找 TA 时说
    const here = running && adv.on && M && M.id === q.map && !dlg && !busy && !overlay && !PL.moving && $('modal').hidden && !$('world').hidden &&
      !(window.EchoTalk && EchoTalk.isOpen && EchoTalk.isOpen()) && Math.abs(n.x - PL.x) + Math.abs(n.y - PL.y) <= 2;
    if (questDone(q)) {
      if (!questOwe.has(q.id)) return;
      if (here) questThanks(n, q);
      else if (fresh) { E.jingle('item', E.SFX.win); E.toast(tx('w.q.done.toast', { name: L(q), rw: questReward(q) }), 'gold'); }
      return;
    }
    const info = npcLook(n);
    if (here) talk([{ who: info.name, look: info.look, g: info.g, en: Q_RETRY[0], zh: Q_RETRY[1], zhKeep: true }]);
    else E.toast(tx('w.q.kept', { name: L(q), who: info.name }));
  }
  // 完成：先把结果和奖励都存好（不等对话框，半路退出也不会丢），再去演道谢
  function questGrant(q, stars) {
    const r = q.reward || {}, L = E.dayLog && E.dayLog();
    WS().flags['q:' + q.id] = stars;
    if (r.coins) E.S.coins += r.coins;
    (r.items || []).forEach(([id, k]) => { if (MG.ITEMS[id]) MG.addItem(id, k || 1); });
    if (r.egg) {
      // 只送这个版本里有的怪兽（销售版没有保留的那些；tests/quests.test.js 查过都在）。万一没有，换成金回声球
      const ok = ((window.DEX && DEX.list) || []).some(s => s.id === r.egg), egg = ok ? MG.giveEgg(r.egg) : null;
      if (egg && r.shiny) egg.shiny = true;
      if (!egg) MG.addItem('superball', 5);
    }
    if (L) L.quests = (L.quests || 0) + 1;   // 今天完成了几条委托（game.js 的 bonusMin：每条换 10 分钟冒险时间）
    questOwe.add(q.id);
    E.save(); E.renderTop(); if (running) hud();
  }
  function questThanks(n, q) {
    questOwe.delete(q.id);
    const info = npcLook(n), P = (en, zh, extra) => Object.assign({ who: info.name, look: info.look, g: info.g, en, zh }, extra || {});
    const r = q.reward || {}, stars = questDone(q), got = [];
    if (r.egg) got.push(r.shiny ? P('You got a shining monster egg!', '得到了一个闪闪发光的怪兽蛋！孵出来会是稀有色的，放在队伍里多走路就会孵出来。') : P('You got a monster egg!', '得到了一个怪兽蛋！放在队伍里多走路就会孵出来（队伍满了就在电脑箱子里）。'));
    (r.items || []).forEach(([id, k]) => { const it = MG.ITEMS[id]; if (it) got.push(P('You got ' + it.en + '!', '得到了' + it.zh + (k > 1 ? ' ×' + k : '') + '！')); });
    if (!got.length) got.push(P('Here you are!', '给你！'));
    got.forEach(g => { g.zhKeep = true; });
    got[0].onShow = () => { E.jingle('item', E.SFX.win); E.toast(tx('w.q.done', { stars: '★'.repeat(stars), rw: questReward(q) }), 'gold'); if (E.confetti) E.confetti(60); };
    const b = questBonus(), more = b ? b.bonus - questBonus0 : 0;
    talk(q.thanks.map(a => P(a[0], a[1])).concat(got), () => { if (more > 0) E.toast(tx('w.q.more', { n: more })); });
  }
  // 委托本（冒险菜单里的「📋 委托」）：去过的岛上的委托——能接的、做完的（几颗星）、还不能接的（为什么）、找谁
  function questRows() {
    const vis = WS().visited || {};
    return QL().map(q => { const stars = questDone(q), lock = stars ? '' : questLock(q); return { q, seen: !!vis[q.z], stars, lock, state: stars ? 'done' : lock ? 'locked' : 'open' }; });
  }
  function questSheet() {
    const esc = E.esc, rows = questRows(), seen = rows.filter(r => r.seen), b = questBonus();
    const row = r => {
      const q = r.q, w = E.W[q.z];
      return '<div class="ach' + (r.state === 'locked' ? ' no' : '') + '" data-q="' + q.id + '" data-st="' + r.state + '"><span class="ae">' + (r.state === 'done' ? '✅' : r.state === 'locked' ? '🔒' : QMARK) + '</span><div style="flex:1;min-width:0">' +
        '<b>' + esc(L(q)) + (r.stars ? ' <span style="color:#f5a623">' + '★'.repeat(r.stars) + '</span>' : '') + '</b>' +
        '<small style="display:block">' + w.icon + ' ' + esc(townName(w)) + hx('w.q.find', { who: q.who }) + hx(M && M.id === q.map ? 'w.q.here' : 'w.q.town') + '</small>' +
        '<small style="display:block">' + (r.state === 'done' ? hx('w.q.st.done') : r.state === 'locked' ? hx('w.q.st.lock', { why: r.lock }) : hx('w.q.st.open')) + '🎁 ' + esc(questReward(q)) + '</small></div></div>';
    };
    // 能接的：和地图上头顶的牌子一个样（金色圆牌子上一个「?」）
    const QMARK = '<i style="display:inline-block;width:30px;height:30px;line-height:28px;border-radius:50%;background:#ffc233;border:2px solid #6d4300;color:#6d4300;font:900 20px/28px \'Baloo 2\',Nunito,sans-serif;font-style:normal">?</i>';
    const order = { open: 0, locked: 1, done: 2 };
    E.openModal('<h2>' + hx('w.q.title') + '</h2><p>' + hx('w.q.intro') +
      (b && b.bonus < b.max ? '<br>' + hx('w.q.bonus') : '') + '</p>' +
      '<p id="q-count">' + hx('w.q.count', { a: rows.filter(r => r.stars).length, b: rows.length }) + '</p>' +
      (seen.length ? seen.slice().sort((a, c) => order[a.state] - order[c.state] || a.q.z - c.q.z).map(row).join('') : '<p>' + hx('w.q.none') + '</p>') +
      (rows.length > seen.length ? '<p class="tip">' + hx('w.q.unseen', { n: rows.length - seen.length }) + '</p>' : '') +
      '<button class="btn wide" data-act="wMenu">' + hx('w.menu.back') + '</button>');
  }
  async function sail(n) {
    busy = true;
    const v = $('w-view'); v.classList.add('fade');
    E.SFX.tap();
    await sleep(500);
    E.toast(tx('w.sail'), 'gold');
    await sleep(900);
    busy = false;
    v.classList.remove('fade');
    goMap(n.to, n.how || null);
  }
  function trainerTalk(n) {
    const t = trainerInfo(n), z = M.z, lv = MG.zoneLv(z) + (M.lvBonus || 0);
    // @i18n-content 训练师的开场白：[英文, 中文意思]
    const lines = [["Hi! I'm " + t.name + ". Let's have a monster battle!", '你好！我是 ' + t.name + '，我们来一场怪兽对战吧！'],
      ['Our eyes met! Now we must battle!', '我们的眼神对上了！那就来对战吧！'],
      ['I trained here every day. Are you ready?', '我每天都在这里训练。你准备好了吗？']];
    // @i18n-content-end
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
    talk([{ who: tx('w.who.nar'), emo: it.icon, en: 'You found ' + (/^[aeiou]/i.test(it.en) ? 'an ' : 'a ') + it.en + '!', zh: '你捡到了' + it.zh + '！' }]);
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
    E.openModal('<div class="big">🏪</div><h2>' + hx('w.shop.title') + '</h2><p>' + hx('w.shop.coins', { n: E.S.coins }) + '</p>' +
      shopStock().map(([id, n], i) => {
        const it = MG.ITEMS[id], price = it.price * n, owned = it.key && MG.itemCount(id) > 0;
        // 中文界面：名字是中文，小字里带上英文名；英语界面名字已经是英文，不重复
        return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + L(it) + (n > 1 ? ' ×' + n : '') + '</b><small>' + it.desc + (gloss(it) || E.lang ? (L(it) !== T_('item', it.en) ? ' · ' + TH_('item', it.en) : '') : '') + (it.key ? '' : hx('w.shop.have', { n: MG.itemCount(id) })) + '</small></div>' +
          '<button class="btn small sun" data-act="wBuy" data-i="' + i + '"' + (owned || E.S.coins < price ? ' disabled' : '') + '>' + (owned ? hx('w.shop.owned') : hx('w.shop.price', { n: price })) + '</button></div>';
      }).join('') +
      '<button class="btn ghost wide" data-act="close">' + hx('w.shop.bye', { w: uiW('Thank you!') }) + '</button>');
  }

  // ---------- 挑战馆跟着课本进度开（家长 2026-10-07）：第 z 个岛主要先打败前 ceil((z+1)×16/13) 个课本单元的 BOSS 关 ----------
  // 第 1 个岛主要 2 个单元，第 13 个要 16 个（七上 + 七下），冠军赛大约落在初一下学期末
  const unitsFor = z => Math.ceil((z + 1) * 16 / 13);
  function gymNeed(z) {
    // 按能力走的学习者（game.js 的 unitSpan，2026-11-19）：门槛从他的起点单元数起（前面的已免修），只数开放的单元；
    // 按课本走是 { from: 0, end: 全部单元 }，和以前一样
    const NB = E.W.length, units = (E.WX || []).slice(NB), sp = E.unitSpan ? E.unitSpan() : { from: 0, end: units.length };
    // 别的语言的课：单元没那么多（现在一册 8 个），门槛按现有的单元数摊到 13 座岛上，要求的不超过现有的（ENGINE.md §4）
    const avail = Math.min(sp.end, units.length) - Math.max(0, Math.min(sp.from | 0, units.length));
    const want = E.lang ? Math.ceil((z + 1) * Math.min(16, Math.max(0, avail)) / 13) : unitsFor(z);
    const from = Math.max(0, Math.min(sp.from | 0, units.length)), need = Math.max(0, Math.min(want, Math.min(sp.end, units.length) - from));
    const lab = i => { const u = units[i]; return u ? (u.bshort ? u.bshort + ' ' : '') + unitNo(u.n) : ''; };
    const miss = [];
    for (let i = from; i < from + need; i++) if (!((E.S.stars || {})[(NB + i) + '-6'] > 0)) miss.push(i);
    const ok = DEBUG || !miss.length;
    return { z, need, done: need - miss.length, ok, unitLabel: ok ? '' : lab(miss[0]), target: need ? lab(from + need - 1) : '', unitN: need ? units[from + need - 1].n : 0, missing: ok ? [] : miss.map(lab), wi: ok ? -1 : NB + miss[0] };   // wi：第一个没打败 BOSS 的单元（📍 点了直接去那里）
  }
  // 下一枚要拿的徽章是第几座岛的（13 枚都有了返回 -1）
  const nextGymZ = () => { for (let z = 0; z < E.W.length; z++) if (!E.S.mon.badges[z]) return z; return -1; };
  // 重赛的岛主：本馆属性，比原来多一只，等级 +15（属性表和 monsters.js 的 GYM 一样）
  const GYM_TYPES = ['flying', 'rock', 'grass', 'psychic', 'steel', 'spark', 'fire', 'poison', 'ground', 'dark', 'ice', 'water', 'dragon'];
  const rematchFoes = z => MG.teamOf([GYM_TYPES[z % GYM_TYPES.length]], 3 + Math.floor(z / 4), MG.zoneLv(z) + 2 + 15, 'rematch' + z);
  // 重赛出题：全部换成课本最近学的单元（正在学的这一个和前两个）。战斗期间临时换掉 E.src，打完（或回首页）换回来
  let srcBak = null;
  function useRecentSrc(on) {
    if (on && !srcBak && E.src) {
      srcBak = E.src;
      const orig = srcBak;
      E.src = z => {
        const cur = E.curIdx ? E.curIdx() : -1, NB = E.W.length;
        if (cur < 0 || !E.WX || !E.WX[NB + cur]) return orig(z);
        const i = Math.max(0, cur - Math.floor(Math.random() * Math.min(cur + 1, 3)));
        return { w: NB + i, d: E.WX[NB + i] };
      };
    } else if (!on && srcBak) { E.src = srcBak; srcBak = null; }
  }

  // ---------- 回声技能：拿到徽章解锁，队伍里要有合适属性的怪兽，用的时候要对它说英语指令 ----------
  // 回声贝（id 是 hm_*）是剧情里的人送的，还要有足够的徽章才能在野外用；技能名和 monsters.js 的回声贝一致
  // 一共四种回声技能（GROUPS）：开路、点灯、水路、乘风；开路和水路各有 1–3 级，每一级对应下面的一项（键名是老的，存档兼容）
  const SKILLS = {
    cut: { zh: '开路', en: 'Clear Way', icon: '🌿', badge: 3, hm: 'hm_cut', types: ['grass', 'bug', 'steel', 'normal', 'fight', 'dark', 'dragon', 'ground'], say: n => n + ', cut the tree!', get what() { return tx('w.sk.cut.what'); }, get who() { return tx('w.sk.cut.who'); } },
    flash: { zh: '点灯', en: 'Light Up', icon: '💡', badge: 2, hm: 'hm_flash', types: ['spark', 'psychic', 'fire'], say: n => n + ', light up the cave!', get what() { return tx('w.sk.flash.what'); }, get who() { return tx('w.sk.flash.who'); } },
    smash: { zh: '开路 2 级', en: 'Clear Way 2', icon: '🪨', badge: 4, hm: 'hm_smash', types: ['fight', 'rock', 'ground', 'steel', 'normal', 'dragon'], say: n => n + ', smash the rock!', get what() { return tx('w.sk.smash.what'); }, get who() { return tx('w.sk.smash.who'); } },
    strength: { zh: '开路 3 级', en: 'Clear Way 3', icon: '💪', badge: 6, hm: 'hm_strength', types: ['fight', 'rock', 'ground', 'normal', 'steel', 'dragon', 'water'], say: n => n + ', push the rock!', get what() { return tx('w.sk.strength.what'); }, get who() { return tx('w.sk.strength.who'); } },
    surf: { zh: '水路', en: 'Water Way', icon: '🌊', badge: 8, hm: 'hm_surf', types: ['water', 'ice', 'dragon'], say: n => n + ", let's surf!", get what() { return tx('w.sk.surf.what'); }, get who() { return tx('w.sk.surf.who'); } },
    fly: { zh: '乘风', en: 'Sky Ride', icon: '🕊️', badge: 9, hm: 'hm_fly', types: ['flying', 'dragon'], say: n => n + ', fly me there!', get what() { return tx('w.sk.fly.what'); }, get who() { return tx('w.sk.fly.who'); } },
    dive: { zh: '水路 2 级', en: 'Water Way 2', icon: '🤿', badge: 10, hm: 'hm_dive', types: ['water', 'dragon'], say: n => n + ', dive down!', get what() { return tx('w.sk.dive.what'); }, get who() { return tx('w.sk.dive.who'); } },
    falls: { zh: '水路 3 级', en: 'Water Way 3', icon: '🏞️', badge: 12, hm: 'hm_falls', types: ['water', 'dragon'], say: n => n + ', climb the waterfall!', get what() { return tx('w.sk.falls.what'); }, get who() { return tx('w.sk.falls.who'); } },
  };
  const GROUPS = [
    { zh: '开路', en: 'Clear Way', icon: '🌿', lv: ['cut', 'smash', 'strength'] },
    { zh: '点灯', en: 'Light Up', icon: '💡', lv: ['flash'] },
    { zh: '水路', en: 'Water Way', icon: '🌊', lv: ['surf', 'dive', 'falls'] },
    { zh: '乘风', en: 'Sky Ride', icon: '🕊️', lv: ['fly'] },
  ];
  const skillMon = k => E.S.mon.team.map(u => E.S.mon.box.find(m => m.uid === u)).filter(m => m && !m.egg).find(m => MG.species(m.sp).types.some(t => SKILLS[k].types.includes(t)));
  const hasHM = k => DEBUG || MG.itemCount(SKILLS[k].hm) > 0;
  const skillOpen = k => DEBUG || (hasHM(k) && nBadges() >= SKILLS[k].badge);
  const skillReady = k => skillOpen(k) && !!skillMon(k);
  // 用技能：说对指令才会生效
  function useSkill(k, then) {
    const S = SKILLS[k], nar = (en, zh) => ({ who: tx('w.who.nar'), emo: S.icon, en, zh });
    if (!hasHM(k)) { talk([nar('Maybe a monster could help here...', '也许怪兽能帮上忙……（要先拿到「' + S.zh + '」的回声贝）')]); return; }
    if (!skillOpen(k)) { talk([nar('You need more badges to use ' + S.en + '.', '要用「' + S.zh + '」' + S.what + '，需要 ' + S.badge + ' 枚徽章。')]); return; }
    const mon = skillMon(k);
    // @i18n-content 这一页的中文意思（属性名用顿号连起来）
    if (!mon) { talk([nar('None of your monsters can use ' + S.en + '.', '队伍里要有' + S.types.map(t => DEX.TYPES[t].zh).join('、') + '系的怪兽，才能用「' + S.zh + '」。')]); return; }
    // @i18n-content-end
    const name = MG.nm(mon);
    talk([{ who: '{name}', look: playerLook(), g: E.S.player && E.S.player.gender === 'girl' ? 'f' : 'm', en: S.say(name), zh: '用「' + S.zh + '」：大声对 ' + name + ' 说出来！', kind: 'speak', target: S.say(name), lkey: 'skill:' + k, pass: () => { E.S.stats.spoken = (E.S.stats.spoken || 0); then(mon); return []; } }]);
  }
  function obstacle(f) {
    if (f.obst === 'n') useSkill('cut', mon => { M._cleared.add(f.x + ',' + f.y); E.SFX.hit(); E.toast(tx('w.sk.cut.done', { name: T_('monster', MG.species(mon.sp).en) }), 'gold'); if (R && R.fx) R.fx('cut', f.x, f.y); });
    else if (f.obst === 'b') useSkill('smash', mon => { M._cleared.add(f.x + ',' + f.y); E.SFX.hit(); E.toast(tx('w.sk.smash.done', { name: T_('monster', MG.species(mon.sp).en) }), 'gold'); if (R && R.fx) R.fx('smash', f.x, f.y); });
    else if (f.obst === 'O') {
      if (M._strength) { talk([{ who: tx('w.who.nar'), emo: '💪', en: 'Walk into the rock to push it.', zh: '朝大石头走过去，就能把它推开。' }]); return; }
      useSkill('strength', mon => { M._strength = true; E.toast(tx('w.sk.push.ok', { name: T_('monster', MG.species(mon.sp).en) }), 'gold'); });
    }
  }
  // 面对水：踏浪或者钓鱼
  function waterMenu(f) {
    const canSurf = skillReady('surf'), rod = MG.itemCount('rod') > 0;
    const surf = () => useSkill('surf', () => { PL.surf = true; PL.bike = false; step(f.x, f.y, STEP_MS, false); hud(); E.music(mapMusic()); });
    if (canSurf && rod) talk([{ who: tx('w.who.nar'), emo: '🌊', en: 'The water is calm. What do you want to do?', zh: '水面很平静。要做什么？', kind: 'choice', opts: [{ html: hx('w.water.surf'), cls: 'sun' }, { html: hx('w.water.fish') }], pick: i => { setTimeout(i ? fish : surf, 50); return []; } }]);
    else if (canSurf) surf();
    else if (rod) fish();
  }
  // 钓鱼：等浮标动了，听鱼说的英语，选出意思才能拉上来
  function fish() {
    const sr = E.src ? E.src(M.z) : { w: M.z, d: E.W[M.z] }, w = sr.d, k = Math.floor(Math.random() * w.words.length), it = w.words[k];
    // 别的课：按界面语言里的意思去重（中文课的第 1 格是空的）
    const others = w.words.filter((x, j) => j !== k && (E.lang ? x[0] !== it[0] && E.meanOf(x) !== E.meanOf(it) : x[1] !== it[1])).sort(() => Math.random() - .5).slice(0, 2);
    const opts = [{ c: true, t: it[1], e: it[2], w: it[0] }, ...others.map(o => ({ t: o[1], e: o[2], w: o[0] }))].sort(() => Math.random() - .5);
    // 选项：中文界面是「图 + 中文意思」（听英文选意思）；英语界面没有可用的意思，换成「图 + 英文词」（听出是哪个词）
    const optTxt = o => (gloss({ zh: o.t }) != null ? o.t : o.w);
    let hooked = false;
    talk([{
      who: tx('w.who.nar'), emo: '🎣', en: 'You cast your line...', zh: '甩出鱼线……', kind: 'custom',
      html: '<div class="fish"><div class="fish-water"><span class="bobber" id="fish-bob"></span></div><p class="fish-q" id="fish-q">' + hx('w.fish.wait') + '</p><div class="opts" id="fish-opts"></div><div class="b-timer" id="fish-bar" hidden><i id="fish-t"></i></div></div>',
      mount: (el, done) => {
        const wait = 1400 + Math.random() * 2600;
        setTimeout(() => {
          const bob = document.getElementById('fish-bob'); if (!bob) return;
          bob.classList.add('bite'); E.SFX.tap();
          document.getElementById('fish-q').innerHTML = hx('w.fish.bite');
          E.say(it[0]);
          const box = document.getElementById('fish-opts');
          box.innerHTML = opts.map((o, i) => '<button class="opt" data-i="' + i + '"><span class="o-e">' + o.e + '</span><span class="o-t">' + E.esc(optTxt(o)) + '</span></button>').join('') + '<button class="spk mini" id="fish-hear" aria-label="' + hx('w.dlg.hear') + '">' + E.SPK + '</button>';
          const bar = document.getElementById('fish-bar'), t = document.getElementById('fish-t');
          bar.hidden = false; t.style.transition = 'none'; t.style.width = '100%'; void t.offsetWidth; t.style.transition = 'width 7s linear'; t.style.width = '0%';
          const timer = setTimeout(() => finish(-1), 7000);
          const finish = i => {
            clearTimeout(timer);
            const ok = i >= 0 && opts[i].c;
            box.querySelectorAll('.opt').forEach((b, j) => b.classList.add(opts[j].c ? 'right' : j === i ? 'wrong' : 'dim'));
            hooked = ok;
            if (ok) { E.SFX.ok(2); E.S.stats.listen = (E.S.stats.listen || 0) + 1; E.qProg('listen', 1); } else { E.SFX.bad(); E.addWrong({ kind: 'word', w: sr.w, i: k }); }
            setTimeout(() => done([{ who: tx('w.who.nar'), emo: ok ? '🐟' : '💨', en: ok ? 'You hooked a monster!' : 'It got away...', zh: ok ? '钓上来了！是一只怪兽！' : '鱼跑掉了……它说的是 ' + it[0] + ' = ' + it[1] }]), 700);
          };
          box.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('#fish-hear')) { E.say(it[0], .8); return; } const b = e.target.closest('.opt'); if (b && !b.classList.contains('dim') && !b.classList.contains('right')) finish(+b.dataset.i); });
        }, wait);
      },
    }], () => { if (hooked && MG.anyAlive()) battle('wild', { hab: 'water', lvBonus: (M.lvBonus || 0) + 1 }); });
  }
  // 藏起来的道具：对着它按 A 才能找到；有回声探测器会一闪一闪
  const HIDDEN_PICKS = ['superpotion', 'superball', 'revive', 'fullheal', 'leafstone', 'firestone', 'waterstone', 'thunderstone', 'moonstone', 'sunstone', 'icestone', 'superball'];
  function foundHidden(h) {
    WS().flags[hiddenKey(h)] = 1;
    const id = h.item || HIDDEN_PICKS[(h.x * 5 + h.y * 11 + M.z * 3) % (M.z < 4 ? 4 : HIDDEN_PICKS.length)], it = MG.ITEMS[id];
    MG.addItem(id, 1);
    E.save(); E.SFX.coin();
    talk([{ who: tx('w.who.nar'), emo: '✨', en: 'You found a hidden ' + it.en + '!', zh: '你发现了藏起来的' + it.zh + '！' }]);
  }
  function skillsSheet() {
    // 四种技能各一行标题，下面列出每一级（开路、水路有 3 级）
    // 技能名：中文界面「开路 Clear Way」两种都写；英语界面只写英文
    const nm2 = o => (gloss(o) ? gloss(o) + ' ' : '') + (E.lang ? TH_('skill', o.en) : o.en);
    E.openModal('<h2>' + hx('w.sk.title') + '</h2><p>' + hx('w.sk.intro') + '</p>' +
      GROUPS.map(G => '<h3 class="pc-h">' + G.icon + ' ' + nm2(G) + (G.lv.length > 1 ? '<small>' + hx('w.sk.lv', { a: G.lv.filter(hasHM).length, b: G.lv.length }) + '</small>' : '') + '</h3>' + G.lv.map(k => {
        const S = SKILLS[k];
        const open = skillOpen(k), mon = skillMon(k);
        if (!hasHM(k)) return '<div class="ach locked"><span class="ae">' + S.icon + '</span><div style="flex:1"><b>' + nm2(S) + '</b><small>' + S.what + hx('w.sk.noshell', { who: S.who }) + '</small></div><span class="lvchip">🔒</span></div>';
        const btn = k === 'flash' ? '<button class="btn small sun" data-act="wUseSkill" data-k="flash"' + (open && mon && M.dark && !M._flash ? '' : ' disabled') + '>' + hx('w.sk.use') + '</button>'
          : k === 'fly' ? '<button class="btn small sun" data-act="wUseSkill" data-k="fly"' + (open && mon && M.kind !== 'inside' ? '' : ' disabled') + '>' + hx('w.sk.use') + '</button>'
            : '<small class="tip">' + hx(k === 'dive' ? 'w.sk.tip.dive' : k === 'falls' ? 'w.sk.tip.falls' : 'w.sk.tip.obst') + '</small>';
        return '<div class="ach' + (open ? '' : ' locked') + '"><span class="ae">' + S.icon + '</span><div style="flex:1"><b>' + nm2(S) + '</b><small>' + S.what + ' · ' + (open ? (mon ? hx('w.sk.by', { name: T_('monster', MG.species(mon.sp).en) }) : hx('w.sk.needtype', { types: S.types.slice(0, 3).map(t => L(DEX.TYPES[t])).join('/') })) : hx('w.sk.needbadge', { n: S.badge })) + '</small></div>' + (open ? btn : '<span class="lvchip">🔒</span>') + '</div>';
      }).join('')).join('') + '<button class="btn ghost wide" data-act="close">' + hx('w.close') + '</button>');
  }
  function flyTo(z) {
    E.closeModal();
    goMap('t' + z, 'door:C');
  }

  // ---------- 战斗 ----------
  // 现在脚下遇到的野生怪兽算哪种栖息地：水上、海底是 water，洞穴是 cave，其余是 grass（地图可以用 hab 另外指定）
  const wildHab = () => (PL.surf || M.kind === 'under' ? 'water' : M.hab || (M.kind === 'cave' ? 'cave' : 'grass'));
  function encounter() { battle('wild', { lvBonus: M.lvBonus || 0, hab: wildHab() }); }
  async function battle(kind, o) {
    busy = true;
    held = null;
    // （走路攒下的位置、步数不用在这里另存：MG.battle 一开战就整份存一次；万一没打成，离开大地图时 game.js 的 show() 也会存）
    const wp = $('w-wipe'); wp.classList.remove('on'); void wp.offsetWidth; wp.classList.add('on');
    E.SFX.hit();
    await sleep(820);
    stopLoop();
    useRecentSrc(!!o.recent);
    const ok = MG.battle(kind, M.z, {
      foes: o.foes, trainer: o.trainer, lvBonus: o.lvBonus, noCatch: o.noCatch, hab: o.hab || M.hab || (M.kind === 'cave' ? 'cave' : 'grass'), arena: M.arena || M.theme, rules: o.rules, tag: o.tag,
      onEnd: res => {
        useRecentSrc(false);
        E.show('world');
        wp.classList.remove('on');
        resize(); hud();
        startLoop();
        busy = false;
        if (res === 'lose' && !o.noWhiteout) { whiteout(); if (o.after && o.fromStory) o.after('lose'); }
        else if (o.after) o.after(res);
      },
    });
    if (!ok) { useRecentSrc(false); wp.classList.remove('on'); startLoop(); busy = false; if (o.after) o.after('none'); }
  }
  function whiteout() {
    MG.healAll();
    const c = WS().center;
    loadMap(c && c.map && EM.get(c.map) ? c.map : EM.get('i' + M.z + 'C') ? 'i' + M.z + 'C' : 'i0C', 'nurse');
    talk([
      { who: tx('w.who.nar'), emo: '💤', en: 'Your monsters are tired. You hurried to the Rest Stop.', zh: '你的怪兽都累倒了……你赶快跑回了休息站。' },
      { who: 'Amy', look: LOOKS.nurse, g: 'f', en: "Your monsters are full of energy again. Don't give up!", zh: '怪兽们又精神满满了，别灰心，再去试试吧！' },
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
    // 画面上方的小提示条（挑战馆机关用：现在要踩什么颜色、红灯绿灯……）
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
    refresh: () => { if (R) loadR(); },
    tile: (x, y) => tile(x, y),
    skillReady: k => skillReady(k),
    hasHM: k => hasHM(k),
    give: (item, n) => { MG.addItem(item, n || 1); E.save(); hud(); const it = MG.ITEMS[item]; E.jingle('item', E.SFX.win); E.toast((it ? it.icon + ' ' + L(it) : item) + ' +' + (n || 1), 'gold'); },
    badges: () => nBadges(),
    // 第 z 个挑战馆的课本门槛：{ ok, need, done, unitLabel（下一个要打的单元）, target, missing }
    gymNeed: z => gymNeed(z),
    daily: (k, fn) => { if (dailyDone(k)) return false; markDaily(k); fn && fn(); E.save(); return true; },
    flags: () => WS().flags,
    say: (t, g) => E.say(t, undefined, g),
  };

  // ---------- 渲染器 ----------
  // 画质：auto 自动 / high 精美 / mid 标准 / low 省电 / 2d 流畅模式
  function gfxTier() {
    const st = E.S.settings, g = st.gfx || 'auto';
    if (g !== 'auto') return g;
    return st.gfxAuto || (strongDevice() ? 'high' : 'mid');
  }
  // 好手机（APK 里、8GB 以上内存、或 8 核以上 + WebGL2）自动档直接从「精美」开始；跑不动 autoTune 照样会往下降
  // 显卡是软件模拟的（SwiftShader、llvmpipe，比如显卡被浏览器拉黑）就不算好手机
  let strong = null;
  function strongDevice() {
    if (strong !== null) return strong;
    strong = false;
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2');
      if (!gl) return strong;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      if (/swiftshader|llvmpipe|softpipe|software/i.test(name)) return strong;
      const n = navigator;
      strong = !!window.ECHO_APP || (n.deviceMemory || 0) >= 8 || (n.hardwareConcurrency || 0) >= 8;
    } catch (e) { strong = false; }
    return strong;
  }
  // 画面丢了 / 画不出来以后怎么恢复（rebuildGL、frame 用）。ban：现在最多用到哪一种渲染器（0 新画风也行 / 1 只用经典 3D / 2 只用 2D），banT 什么时候退下来的；
  // fails：同一种连着几次「建好了却没画成」；born / good：现在这个渲染器什么时候建的、好好画了几帧；strikes：draw 连着抛了几帧异常；
  // bad：已经知道它坏了，下一帧重建（'draw' 连着画不出来 / 'load' 载入地图出错 / 'resize' / 'stuck' 帧数不动）；lostT：从什么时候开始等它恢复；
  // awayT：上一次「没在画大地图」是什么时候——页面切到后台 / 回到前台，或者大地图的循环停下来（开战、回首页，见 stopLoop）；
  // w*：每秒一次的体检（glWatch）；logM / logT、errM / errT：出错记录限频
  const GL = { ban: 0, banT: 0, fails: 0, born: 0, good: 0, strikes: 0, bad: '', lostT: 0, awayT: -1, wT: 0, wN: 0, wF: -1, wStuck: 0, logM: '', logT: 0, errM: '', errT: 0 };
  document.addEventListener('visibilitychange', () => { GL.awayT = performance.now(); });
  const GL_OK_FRAMES = 60, GL_OK_MS = 8000;   // 一个渲染器画了这么多帧、活了这么久才算「它是行的」（之后再丢不算它不行，原地重建）
  const GL_BAN_MS = 300000;                   // 退下来以后至少过这么久，下次从首页进大地图才再试原来的画面
  const DRAW_STRIKES = 3;                     // draw 连着这么多帧抛异常（画面又不算丢了）就重建
  // 没建成、或者拆到一半出了错的渲染器可能把画布留在页面上：画布是一张叠一张的，留下的死画布会盖住后面新建的那张。
  // 建新的之前、每次没建成之后都扫一遍（这时候页面上不该有任何一张大地图画布）
  function dropCanvases(view) {
    view.querySelectorAll('canvas.w-canvas').forEach(c => {
      try { const g = c.getContext('webgl2'), x = g && g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* 忽略 */ }
      c.remove();
    });
  }
  function ensureRenderer() {
    const tier = gfxTier();
    if (R && R.tier === tier && R.ban === GL.ban) return;
    const view = $('w-view');
    if (R) { try { R.destroy(); } catch (e) { /* 丢了的画面释放不干净也没关系 */ } R = null; }
    dropCanvases(view);
    if (tier !== '2d' && window.EchoWorld3D && GL.ban < 2) {
      // 新画风的样品（网址带 ?look=new 才打开，见 world3d-open.js）：户外地图换成新渲染器，它自己会把室内 / 洞穴交回 world3d.js；建不出来就照旧
      if (window.EchoWorldOpen && EchoWorldOpen.on && GL.ban < 1) { try { R = EchoWorldOpen.create(view, tier, ART); } catch (e) { R = null; } if (!R) dropCanvases(view); }
      if (!R) { try { R = EchoWorld3D.create(view, tier, ART); } catch (e) { R = null; } if (!R) dropCanvases(view); }
      if (!R) { E.toast(tx('w.gfx.no3d')); }
    }
    if (!R) R = create2D(view);
    R.tier = R.kind === '2d' ? '2d' : tier;
    R.ban = GL.ban;
    perf.n = 0; perf.sum = 0; perf.t0 = 0;
    GL.born = performance.now(); GL.good = 0; GL.strikes = 0; GL.bad = ''; GL.lostT = 0; GL.wT = 0; GL.wN = 0; GL.wF = -1; GL.wStuck = 0;
  }
  // 载入地图的画面。出了错（多半是画面刚丢）不让它把进大地图、换地图那一串带崩：记一笔，下一帧 frame() 重建
  function loadR(key) {
    try { R.load(M, api3d); return true; } catch (e) {
      if (window.EchoErr) EchoErr.log('gl', tx(key || 'w.err.load', { msg: (e && e.message) || String(e) }), glSrc());
      if (R.kind !== '2d' && !GL.bad) GL.bad = 'load';
      return false;
    }
  }
  const glSrc = () => (R && R.look === 'new' ? 'world3d-open' : R && R.kind === '2d' ? 'world2d' : 'world3d');
  // 自动画质：进地图后量 3 秒帧率，太慢就降一档；之后每 30 秒再量一次（玩久了手机发烫降频，也能降下来，评估第 15 条）
  // 量的那几秒不按「站着不动 30 帧」限速（见 frame）。超过 250ms 的帧（页面在后台、被系统限流、正在切地图）不算；有效帧太少就过一会儿重新量
  const perf = { n: 0, sum: 0, t0: 0, on: true, checks: 0 };
  const TUNE_EVERY = 30000;
  function autoTune(now, dt) {
    const st = E.S.settings;
    if ((st.gfx || 'auto') !== 'auto' || !R || R.kind === '2d' || busy || dlg || document.hidden) return;
    if (!perf.t0) { perf.t0 = now; perf.on = true; return; }
    if (now < perf.t0) { perf.on = false; return; }   // 还没到下一次量的时候
    perf.on = true;
    // 偶尔一帧很慢（切到后台、切地图）不算；可是一直很慢（连续 12 帧都超过 250ms）就是设备太慢
    if (dt > 250) { perf.slow = (perf.slow || 0) + 1; if (perf.slow < 12 || now - perf.t0 < 1200) return; perf.n = 20; perf.sum = 20 * dt; perf.slow = 0; }
    else { perf.slow = 0; if (now - perf.t0 < 1200) return; }
    perf.n++; perf.sum += dt;
    if (perf.n < 150 && now - perf.t0 < 4500) return;
    if (perf.n < 20) { perf.n = 0; perf.sum = 0; perf.t0 = now; return; }
    const avg = perf.sum / perf.n;
    perf.n = 0; perf.sum = 0; perf.t0 = now + TUNE_EVERY; perf.on = false; perf.checks++; perf.last = Math.round(avg);
    // 精美 > 20ms（不到 50 帧）降到标准；标准 > 24ms（不到 42 帧）降到省电；省电 > 45ms（不到 22 帧）才换 2D
    const cur = R.tier, next = cur === 'high' ? (avg > 20 ? 'mid' : null) : cur === 'mid' ? (avg > 24 ? 'low' : null) : (avg > 45 ? '2d' : null);
    if (!next) { st.gfxAuto = cur; E.save(); return; }
    st.gfxAuto = next; E.save();
    ensureRenderer(); loadR(); resize();
    if (next === '2d') E.toast(tx('w.gfx.slow'));
  }
  // 画布按画面那一层（#w-view）的大小排。排完记下当时量到的宽高；frame() 每画一帧之前再量一次（fitCheck），不一样就重排——
  // 手机转屏时系统的 resize 事件、ResizeObserver 和版面排好谁先谁后靠不住（2026-11-20 老板的 iPhone：竖屏主角在屏幕最右边、
  // 横屏只看得到天和屋顶），自己每帧核对最稳：量一次宽高很便宜，大小没变什么都不做
  const fitted = { w: 0, h: 0 };
  function resize() {
    if (R) { try { R.resize(); } catch (e) { if (R.kind !== '2d' && !GL.bad) GL.bad = 'resize'; } }   // 排不了（画面坏了）：下一帧重建
    const v = $('w-view'); if (v) { fitted.w = v.clientWidth; fitted.h = v.clientHeight; }
  }
  function fitCheck() { const v = $('w-view'); if (!v) return; const w = v.clientWidth, h = v.clientHeight; if (w > 0 && h > 0 && (w !== fitted.w || h !== fitted.h)) resize(); }
  // ---------- 画面丢了 / 画不出来以后的恢复（评估第 15 条）----------
  // 2026-11-20 iPhone 模拟器里：新画风的画面一建好就丢了，three 编译着色器抛 TypeError，从 draw 里冒出来把 frame() 的循环带停，画面永远卡在一张死画布上。
  // 现在 frame() 这一帧里出什么错都照样约下一帧，下面三道保险哪一道发现了都走 rebuildGL：
  //   ① 渲染器的 glState()：收到了「画面丢了」的事件（world3d.js / world3d-open.js）——等它恢复，恢复了、或者等不到，就重建；
  //   ② draw / load / resize 抛了异常：画面其实已经丢了（事件晚一拍才到）渲染器自己会记成丢了，回到 ①；不算丢了、可是 draw 连着 DRAW_STRIKES 帧都抛，也重建；
  //   ③ 每秒一次的体检 glWatch：直接问一次画面丢没丢（事件万一没来），再看 three 的帧数——一直在调 draw、帧数却 3 秒没动，也重建。
  // 重建了还不行就往下退：新画风 → 经典 3D → 2D 流畅模式（GL.ban）。一个渲染器从建好到出事没有好好画过（不到 GL_OK_FRAMES 帧 / GL_OK_MS）算一次「没画成」，
  // 同一种连着两次没画成就退一种。不算的两种，都是原地重建：好好画过一阵再丢的；这个渲染器在的时候页面切到过后台、或者大地图停下来过的
  // （切去微信再回来、打了一场对战回来：画面是在没画大地图的时候丢的，不是它画不了，GL.awayT）。
  // 退下来以后这一次就一直用它：过了 GL_BAN_MS 再从首页进大地图（enter）、或者在设置里改了画质 / 画面风格（setGfx），才从头再试。
  // 镜头转到哪了（新画风）跟着带到新的渲染器里；退到经典 3D / 2D 就是朝正北，摇杆的方向跟着渲染器走（camQ），和画面一致。
  function rebuildGL(why) {
    const now = performance.now(), src = glSrc(), view = $('w-view');
    const L = E.dayLog && E.dayLog(); if (L) L.glLost = (L.glLost || 0) + 1;
    if (window.EchoErr) EchoErr.log('gl', tx('w.err.gl', { why }), src);
    if (GL.good >= GL_OK_FRAMES && now - GL.born >= GL_OK_MS) GL.fails = 0;
    else if (GL.awayT < GL.born && ++GL.fails >= 2 && R.kind !== '2d') {
      GL.fails = 0; GL.ban = R.look === 'new' ? 1 : 2; GL.banT = now;
      if (window.EchoErr) EchoErr.log('gl', tx('w.err.fall' + GL.ban), src);
      E.toast(tx('w.gfx.fall' + GL.ban));
    }
    let cam = null, filter = '';
    try { cam = R.camState ? R.camState() : null; } catch (e) { cam = null; }
    try { const c = view.querySelector('canvas.w-canvas'); filter = (c && c.style.filter) || ''; } catch (e) { filter = ''; }   // 剧情给画面加的滤镜（SC.filter）也带过去
    try { R.destroy(); } catch (e) { /* 丢了的画面释放不干净也没关系 */ }
    R = null;
    try { ensureRenderer(); } catch (e) { loopErr(e); }
    if (!R) { R = create2D(view); R.tier = '2d'; R.ban = GL.ban; }   // 万一连建都没建成：不能没有渲染器，先用 2D 顶上
    if (cam && R.camState) { try { R.camState(cam); } catch (e) { /* 留不住就是正北 */ } }
    loadR('w.err.reload');
    resize();
    if (filter) view.querySelectorAll('canvas').forEach(c => { c.style.filter = filter; });
  }
  // ① 的等法：刚丢的时候等它恢复，最多 2.5 秒（渲染器自己算，到时候它说 'dead'）；这个渲染器从建好还没好好画过一帧的话只等 1.5 秒——多半是现在画不了，早点换
  // （不再短：浏览器自己会隔 1 秒左右再试着恢复一次，给它留一次机会）
  function glNow(now) {
    const gs = R.glState();
    if (gs !== 'lost') { GL.lostT = 0; return gs; }
    if (!GL.lostT) GL.lostT = now;
    return !GL.good && now - GL.lostT > 1500 ? 'dead' : 'lost';
  }
  // ② draw 抛了异常（渲染器自己没接住的那种：画面不算丢了）。记一笔——同一句话 30 秒里只记一次，每帧都抛也不刷屏；2D 没有可以再退的，只记
  function drawFail(e) {
    const msg = tx('w.err.draw', { msg: (e && e.message) || String(e) }), now = performance.now();
    if (msg !== GL.logM || now - GL.logT > 30000) { GL.logM = msg; GL.logT = now; if (window.EchoErr) EchoErr.log('gl', msg, glSrc()); }
    if (++GL.strikes >= DRAW_STRIKES && R.kind !== '2d' && !GL.bad) GL.bad = 'draw';
  }
  // ③ 每秒一次的体检（每帧只加一个数；一秒到了才真的查）
  function glWatch(now) {
    GL.wN++;
    if (now - GL.wT < 1000) return;
    const n = GL.wN; GL.wT = now; GL.wN = 0;
    if (R.kind === '2d') return;
    if (R.glCheck) R.glCheck();   // 画面其实丢了：渲染器记上，下一帧 glState() 就不是 'ok' 了
    let f = -1;
    try { f = R.info().render.frame; } catch (e) { f = -1; }
    if (f >= 0 && f === GL.wF && n >= 3) { if (++GL.wStuck >= 3 && !GL.bad) GL.bad = 'stuck'; } else GL.wStuck = 0;
    GL.wF = f;
  }
  // 这一帧的逻辑（走路、剧情触发、量帧率……）抛了异常：循环照样往下跑；错误照原样当「没接住的错误」报出去（出错记录、测试都看得到），同一句 5 秒里只报一次
  function loopErr(e) {
    const m = String((e && e.message) || e), now = performance.now();
    if (m === GL.errM && now - GL.errT < 5000) return;
    GL.errM = m; GL.errT = now;
    setTimeout(() => { throw e; }, 0);
  }
  let nextDraw = 0;
  function startLoop() { if (running) return; running = true; lastNow = 0; nextDraw = 0; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; cancelAnimationFrame(raf); held = null; GL.awayT = performance.now(); }
  function frame(now) {
    if (!running) return;
    try { tick(now); } catch (e) { loopErr(e); }
    raf = requestAnimationFrame(frame);   // 不管这一帧出了什么事，下一帧照样约好：循环一停，画面就永远定在那里了
  }
  function tick(now) {
    if (PL.moving && now - PL.t0 >= PL.dur) { PL.moving = false; PL.jump = false; PL.fx = PL.x; PL.fy = PL.y; FL.fx = FL.x; FL.fy = FL.y; onStep(); }
    if (!PL.moving && held && !dlg && !busy) tryMove(camDir(held));
    // 镇上的人会时不时转头看看四周
    M.npcs.forEach(n => {
      if (n.temp || n.role === 'trainer' || n.role === 'guard' || n.role === 'nurse' || n.role === 'clerk' || n.role === 'leader') return;
      if (!n.nextTurn) n.nextTurn = now + 1500 + Math.random() * 3000;
      if (now > n.nextTurn && !dlg) { n.face = ['up', 'down', 'left', 'right', 'down'][Math.floor(Math.random() * 5)]; n.nextTurn = now + 2000 + Math.random() * 3500; }
    });
    // 3D 画面丢了（webglcontextlost：切去微信再回来、系统收回显存）：先不画；恢复了、或者 2.5 秒还没恢复，就整个重建，不留黑屏（评估第 15 条）。
    // 已经知道它坏了（GL.bad：连着画不出来、载入出错、帧数不动）也在这里重建——见上面「恢复」那一段
    if (GL.bad || R.glState) {
      const gs = GL.bad || glNow(now);
      if (gs === 'lost') return;
      if (gs !== 'ok') rebuildGL(gs);
    }
    // 所有画质每秒最多画 60 次：120Hz 的屏幕每秒画 120 次只会更烫更费电，看不出区别；
    // 主角站着不动（没在走、没按方向、没在演剧情）时每秒 30 次（评估第 15 条）。自动画质正在量帧率的那几秒照常 60 次。
    // 走路、动画都按时间算，上面的走路判定每一帧照样跑，只是不重画
    const tuning = perf.on && (E.S.settings.gfx || 'auto') === 'auto' && R.kind !== '2d';
    // 镜头正在转（手指在拖、按键 / 回正还没转到位）：站着不动也按每秒 60 次画，转起来才跟手；停下 0.3 秒以后回到 30 次
    const co = R.orbit ? R.orbit() : null;
    if (co && (co.yaw !== camUi.y0 || co.tilt !== camUi.t0 || co.to !== co.yaw)) { camUi.y0 = co.yaw; camUi.t0 = co.tilt; camUi.until = now + 300; nextDraw = Math.min(nextDraw, lastNow + 1000 / 60); }
    const gap = 1000 / (!PL.moving && !held && !busy && !tuning && now >= camUi.until ? 30 : 60);
    if (now < nextDraw - 2) return;
    nextDraw = Math.max(nextDraw + gap, now + gap - 6);
    const dt = lastNow ? now - lastNow : 16; lastNow = now;
    fitCheck();
    const V = view(now);
    // 画这一帧。抛了异常不往外冒（见 drawFail）；画成了就把「连着几帧画不出来」清掉、记一帧好的
    // （头一帧好的要再问一次渲染器：画到一半发现画面其实丢了的那种不算——「从建好就没画成过」的只等 1.5 秒，见 glNow）
    try { R.draw(now, V); GL.strikes = 0; if (GL.good || !R.glState || R.glState() === 'ok') GL.good++; } catch (e) { drawFail(e); }
    glWatch(now);
    camHud();
    autoTune(now, dt);
  }
  // ---------- 和面前的人用英语自由聊天（talk.js + AI 语音）：原来的剧情对话不动，另加一个按钮 ----------
  let chatNpc = null;
  // 操作方式：joy 摇杆（默认）/ pad 方向键（设置里改）
  function ctlMode() {
    const w = $('world'); if (!w) return;
    const m = E.S.settings.ctl === 'pad' ? 'pad' : 'joy';
    w.classList.toggle('ctl-joy', m === 'joy'); w.classList.toggle('ctl-pad', m === 'pad');
  }
  // ---------- 转镜头（只有新画风的户外地图有，见 world3d-open.js 的 orbit）----------
  // 现在能不能转：渲染器会转、这张图是它画的，而且没有对话、剧情、弹窗开着
  const orbOK = () => !!(R && R.orbit && R.orbit()) && !dlg && !busy && !overlay && $('modal').hidden;
  // 每帧：这张图能转的时候右半边屏幕才接手指（#world.cam-on）；镜头不朝正北就亮出指北针，里面那一层跟着转，红尖一直指着北
  const camUi = { on: null, yaw: null, y0: 0, t0: 0, until: 0 };   // y0 / t0 / until：上一次看到镜头转到哪、俯角多少，转着的时候画面要画得勤（见 frame）
  function camHud() {
    const o = R && R.orbit ? R.orbit() : null, on = !!o, el = $('w-compass');
    if (on !== camUi.on) { camUi.on = on; $('world').classList.toggle('cam-on', on); }
    if (!el) return;
    const yaw = on && Math.abs(o.yaw) > .02 ? o.yaw : null;
    if (yaw === camUi.yaw) return;
    camUi.yaw = yaw;
    el.hidden = yaw === null;
    if (yaw === null) return;
    // 里面那一层（指针和 N）转过去；N 自己再转回来，一直是正着的（不然转到 90° 的 N 看着像 Z）
    const deg = (yaw * 180 / Math.PI).toFixed(1), ring = el.firstChild;
    ring.style.transform = 'rotate(' + deg + 'deg)';
    ring.firstChild.style.transform = 'rotate(' + -deg + 'deg)';
  }
  function chatBtn(n) {
    if (n === chatNpc) return;
    chatNpc = n;
    const b = $('w-chat'); if (b) b.hidden = !n;
  }
  const ROLE_EN = { talk: 'a friendly villager', guard: 'the island guard', nurse: 'Amy, who runs the Rest Stop', clerk: 'the shop clerk', trainer: 'a young monster trainer', leader: 'the Isle Master', quiz: 'the quiz teacher', ferry: 'a ferry captain', hiker: 'a hiker who loves mountains', daycare: 'the owner of the monster daycare', gift: 'a kind villager', story: 'a person you meet on your journey' };
  function chatWith(n) {
    if (!n || !window.EchoTalk) return;
    const info = npcLook(n), w = E.W[M.z] || E.W[0];
    // 这个人原来说过的话（让 AI 说话的口气和内容跟他一致）；通用村民就用这座岛的句子
    // 别的课（tools/course/TALK.md §4）：他说过的话是代码里的英语，换成台词翻译表里这门语言的那一句（没翻的不带）；名字用这门课的写法；
    // 岛名（w.en 是这门语言的岛名）用小镇地图的英文名——人设是英文写的。说哪门语言由 talk.js 加在后面（lang）
    const cl = !!E.lang;
    const own0 = (n.say || n.no || []).filter(q => Array.isArray(q) && typeof q[0] === 'string');
    const own = cl ? own0.map(q => ((E.lineOf && E.lineOf(q[0])) || {}).t || '').filter(Boolean) : own0.map(q => fill(q[0]));
    const lines = (own.length ? own : w.sents.slice(0, 3).map(q => q[0])).slice(0, 5);
    const kid = /kid|student/i.test(typeof n.look === 'string' ? n.look : '') || /kid/i.test(JSON.stringify(info.look || {}).slice(0, 80));
    EchoTalk.openPerson({
      name: cl ? T_('person', fill(info.name || 'Friend')) : fill(info.name || 'Friend'), g: info.g === 'f' ? 'f' : 'm', kid, lookObj: info.look,
      role: ROLE_EN[n.role] || ROLE_EN.talk, island: cl ? ((EM.get('t' + M.z) || {}).en || 'Echo Island') : w.en.replace(/[!?]/g, '') + ' Island', islandZh: w.name,
      place: M.kind === 'inside' ? 'inside a house' : M.kind === 'town' ? 'in the town' : M.kind === 'route' ? 'on the road' : 'outdoors',
      // 聊天时建议用的词：一半是这座岛的，一半是课本正在学的单元（孩子在课上刚学的词，正好在聊天里用上）
      lines, words: [...w.words.slice(0, 4), ...((E.curUnit && E.curUnit()) || w).words.filter(q => q[0].split(' ').length <= 3).sort(() => Math.random() - .5).slice(0, 4)].map(q => q[0]),
    });
  }
  // 给渲染器的一帧画面信息
  function view(now) {
    const prog = PL.moving ? Math.min(1, (now - PL.t0) / PL.dur) : 1;
    const hop = PL.jump ? Math.sin(prog * Math.PI) * .55 : 0;
    const f = !dlg && !PL.moving && !busy ? facing() : null;
    let hint = null;
    chatBtn(f && f.n && !f.n.mon && window.EchoTalk && EchoTalk.relayUrl() ? f.n : null);
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
      // quest：这个人身上有现在能接的委托（头上画一个「?」）
      npcs: M.npcs.filter(npcVisible).map(n => ({ n, look: n.mon ? null : npcLook(n).look, mon: n.mon ? MG.species(n.mon) : null, x: n.x, y: n.y, face: n.face, alert: n.alert && now - n.alert < 1100, quest: !n.mon && !n.temp && questOpen(questOf(n)) })),
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
  // 挑战馆机关的地板：m.over 图层里的字符 → def.paint 里的颜色和字
  function paintOver(g, m, T) {
    if (!m.over || !m.def || !m.def.paint) return;
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const ch = m.over[y] && m.over[y][x], d = ch && m.def.paint[ch];
      if (!d) continue;
      const o = typeof d === 'string' ? { c: d } : d, sx = x * T, sy = y * T;
      if (o.c) { g.fillStyle = shade(o.c, .8); rr(g, sx + T * .04, sy + T * .04, T * .92, T * .92, T * .14); g.fill(); g.fillStyle = o.c; rr(g, sx + T * .09, sy + T * .07, T * .82, T * .8, T * .12); g.fill(); }
      if (o.t) { const ot = T_('sign', o.t); g.fillStyle = o.tc || '#2b2b3a'; g.font = '800 ' + Math.round(T * (ot.length > 6 ? .2 : ot.length > 3 ? .28 : .38)) + 'px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ot, sx + T / 2, sy + T * .5); }
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
  // 怪兽图：Mon3D 的图标（发布的 2D 图标或 3D 截图）；图标索引读完、稀有色图标转好色时（mon3d-ready）重新取一次地址
  const imgCache = {};
  let imgVer = 0;
  window.addEventListener('mon3d-ready', () => { imgVer++; });
  function monImg(sp) {
    const c = imgCache[sp.id];
    if (c && c._v === imgVer) return c;
    const url = window.Mon3D ? Mon3D.snapshot(sp, 192) : '';
    if (c && c._url === url) { c._v = imgVer; return c; }
    const im = new Image();
    im._url = url; im._v = imgVer;
    im.src = url || 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Cartoon.monster2d(sp).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
    imgCache[sp.id] = im;
    return im;
  }
  // 地上的道具：系着黄丝带的小礼物盒（R 和原来一样是「半径」，盒子大约 2R 宽）
  function drawPickup(g, cx, cy, R) {
    const w = R * 1.8, h = R * 1.35, x = cx - w / 2, y = cy - h / 2 + R * .32, lw = Math.max(1.2, R * .16);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = OUT;
    // 盒身、盒盖
    g.fillStyle = '#8e6cef'; rr(g, x, y, w, h, R * .16); g.fill(); g.stroke();
    g.fillStyle = 'rgba(40,20,90,.18)'; g.fillRect(x + lw / 2, y + h * .62, w - lw, h * .38 - lw / 2);
    g.fillStyle = '#a98bff'; rr(g, x - R * .12, y - R * .34, w + R * .24, R * .46, R * .12); g.fill(); g.stroke();
    // 丝带：竖着一条
    g.fillStyle = '#ffd54f'; g.fillRect(cx - R * .16, y - R * .34 + lw / 2, R * .32, h + R * .34 - lw);
    g.strokeStyle = '#c99a1c'; g.lineWidth = lw * .5; g.strokeRect(cx - R * .16, y - R * .34 + lw / 2, R * .32, h + R * .34 - lw);
    // 蝴蝶结
    g.lineWidth = lw * .8; g.strokeStyle = OUT; g.fillStyle = '#ffd54f';
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx, y - R * .36); g.quadraticCurveTo(cx + s * R * .78, y - R * 1.02, cx + s * R * .62, y - R * .34); g.closePath(); g.fill(); g.stroke(); });
    circ(g, cx, y - R * .38, R * .16); g.fill(); g.stroke();
    // 高光
    g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, x + R * .16, y + R * .14, R * .22, h * .5, R * .1); g.fill();
    g.restore();
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
      const inside = m && m.kind === 'inside', cols = inside ? Math.min(m.W, 11) : 9;
      // 竖屏按宽度放 9 格；横屏按高度放 9 行（屋里整间放得下），不然格子太大、看不到周围
      T = Math.max(28, Math.floor(VW > VH ? (inside ? Math.min(VW / cols, VH / (m.H + 1)) : VH / 9) : VW / cols));
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
      // 休息站屋顶正中挂一只金色的小铃铛（回声站的记号）
      if (L === 'C') {
        const bx = x + w / 2, by = y + T * .02;
        g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(bx - T * .2, by + T * .02); g.quadraticCurveTo(bx - T * .16, by - T * .3, bx, by - T * .3); g.quadraticCurveTo(bx + T * .16, by - T * .3, bx + T * .2, by + T * .02); g.closePath(); g.fill(); g.stroke();
        circ(g, bx, by + T * .06, T * .06); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, bx - T * .07, by - T * .14, T * .03, T * .07); g.fill();
      }
      if (!house) {
        const label = signLabel(L);
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
      // 水面一闪一闪
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
        drawPickup(ctx, cx, cy, T * .16);
      } }));
      V.npcs.forEach(q => ents.push({ y: q.y, f: () => {
        const sx = q.x * T - camX, sy = q.y * T - camY;
        if (q.mon) monster2d(q.mon, sx, sy - Math.abs(Math.sin(now / 110)) * T * .1);
        else person2d(q.look, q.face, 0, sx + T / 2, sy + T * .9);
        if (q.alert) bubble(sx + T / 2, sy - T * .45, '!', '#e53935');
        else if (q.quest) questMark(sx + T / 2, sy - T * .8 + Math.sin(now / 260 + q.x) * T * .04);   // 有委托：比「A」提示再高一点，两个不打架
      } }));
      // 回声技能的障碍：小树、裂开的岩石、大石头
      obstTiles.forEach(o => { if (!V.cleared || !V.cleared.has(o.x + ',' + o.y)) ents.push({ y: o.y, f: () => obst2d(o.k, o.x * T - camX, o.y * T - camY) }); });
      V.obst.forEach(o => ents.push({ y: o.y, f: () => obst2d('O', o.x * T - camX, o.y * T - camY) }));
      (m.gates || []).forEach(q => { if (!V.open || !V.open.has(q.x + ',' + q.y)) ents.push({ y: q.y, f: () => gate2d(q.x * T - camX, q.y * T - camY) }); });
      const fx = V.fx * T - camX, fy = V.fy * T - camY;
      if (V.showF && !V.surf) ents.push({ y: V.fy, f: () => follower(fx, fy - V.fhop * T, now, V) });
      ents.push({ y: V.py + .01, f: () => {
        const cx = px - camX + T / 2, fyy = py - camY + T * .9 - V.hop * T;
        if (V.surf) {
          // 踏浪：坐在自己的怪兽背上
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ell(ctx, cx, fyy + T * .02, T * .5, T * .16); ctx.fill();
          if (V.lead) { const im = monImg(V.lead); if (im.complete && im.naturalWidth) ctx.drawImage(im, cx - T * .55, fyy - T * .78 + Math.sin(now / 300) * 2, T * 1.1, T * 1.1); }
          person2d(V.plook, V.pdir, 0, cx, fyy - T * .3);
          return;
        }
        if (V.bike) { ctx.strokeStyle = '#37474f'; ctx.lineWidth = Math.max(2, T * .06); const side = V.pdir === 'left' || V.pdir === 'right'; [-1, 1].forEach(k => { circ(ctx, cx + (side ? k * T * .24 : 0), fyy - T * .1 + (side ? 0 : k * T * .08), T * .16); ctx.stroke(); }); }
        person2d(V.plook, V.pdir, V.pmoving && !V.bike ? 1 + (Math.floor(now / 85) % 2) : 0, cx, fyy - (V.bike ? T * .12 : 0));
      } });
      // 回声探测器：藏起来的道具一闪一闪
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
    // 委托的记号：金色的圆牌子上一个「?」（和训练师的红色「!」、按 A 的红圈分得开）
    function questMark(bx, by) {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; circ(ctx, bx + 1, by + 2, T * .2); ctx.fill();
      ctx.fillStyle = '#ffc233'; circ(ctx, bx, by, T * .2); ctx.fill();
      ctx.strokeStyle = '#6d4300'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#6d4300'; ctx.font = '900 ' + Math.round(T * .28) + 'px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', bx, by + 1);
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
  // 屋顶颜色：休息站（回声站）青绿、商店琥珀黄、挑战馆用小镇主题色、民居暖色
  function BUILD_COLORS(L, m) {
    if (L === 'C') return '#1fa496';
    if (L === 'M') return '#f29b2b';
    if (L === 'G') return E.W[m.z].color;
    return ['#8d6e63', '#5c9ead', '#c0785a', '#7e8f4e'][(m.z + (L === 'J' ? 1 : 0)) % 4];
  }

  // ---------- 画面框架 ----------
  function ensureDom() {
    if ($('w-view')) return;
    const sec = $('world');
    // 📍 目标那一行：字还是一行小字，上下各多 12px 能点的地方（padding + 负 margin），点得到又不把 HUD 撑高（2026-11-20 细节检查：原来只有 16px 高）
    sec.innerHTML =
      '<div class="w-hud"><button class="x" data-act="wExit" aria-label="' + hx('w.hud.home') + '">✕</button><div class="w-zone"><b id="w-zname"></b><small id="w-zsub"></small>' +
      '<button id="w-goal" data-act="wGoal" aria-label="' + hx('w.hud.goal') + '" style="display:block;max-width:100%;margin:-11px 0 -12px;padding:12px 0;border:0;background:none;color:#ffe08a;font:inherit;font-size:12px;font-weight:800;line-height:1.3;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;pointer-events:auto;text-shadow:0 1px 3px rgba(0,0,0,.55)" hidden></button></div>' +
      '<span class="chip" id="w-badges"></span><span class="chip" id="w-balls"></span><button class="w-bike" id="w-bike" data-act="wBike" aria-label="' + hx('w.hud.bike') + '" hidden>🚲</button><button class="w-menu" data-act="wMenu" aria-label="' + hx('w.hud.menu') + '">☰</button></div>' +
      '<div class="w-view" id="w-view"><div class="w-note" id="w-note" hidden></div><div class="w-scene" id="w-scene" hidden></div><div class="w-banner" id="w-banner" hidden></div><div class="w-wipe" id="w-wipe"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="w-dlg" id="w-dlg" data-act="wA" hidden></div></div>' +
      // 操作：浮在画面上——左边摇杆（手指按哪里就从哪里推），右边 A / B / 英语聊天（像手机上的动作游戏）；设置里可以换回方向键
      '<div class="w-ctrl" id="w-ctrl"><div class="joy-zone" id="w-joy"><div class="joy-base"><i class="joy-knob"></i></div></div><div class="dpad" id="w-dpad">' +
      ['up', 'left', 'right', 'down'].map(d => '<button class="dp dp-' + d + '" data-dir="' + d + '" aria-label="' + hx('w.pad.' + d) + '">' + { up: '▲', left: '◀', right: '▶', down: '▼' }[d] + '</button>').join('') +
      // 新画风的户外地图：右半边屏幕（不是按钮的地方）拖动转镜头；转了以后右上角亮出指北针（红尖指北，点一下回正北）。别的时候这两样都不显示
      '</div><div class="cam-zone" id="w-orb"></div><div class="ab"><button class="w-chat" id="w-chat" data-act="wChat" hidden>🗣️<small>' + hx('w.hud.chat') + '</small></button><button class="bb" data-act="wB">B<small>' + hx('w.hud.menu') + '</small></button><button class="ba" data-act="wA">A<small>' + hx('w.hud.a') + '</small></button></div>' +
      '<button class="w-compass" id="w-compass" data-act="wNorth" aria-label="' + hx('w.hud.north') + '" hidden><i><b>N</b></i></button></div>';
    hudLang = I18N ? I18N.lang() : 'zh';
    ctlMode();
    // 摇杆：按下的地方就是摇杆中心，往哪边推得多就往哪边走（格子地图只有上下左右），松手就停
    const jz = $('w-joy'), jb = jz.querySelector('.joy-base'), jk = jz.querySelector('.joy-knob');
    const J = { id: null, x: 0, y: 0, dir: null };
    jz.addEventListener('pointerdown', e => {
      if (J.id !== null) return;
      e.preventDefault(); J.id = e.pointerId; J.dir = null;
      try { jz.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
      const r = jz.getBoundingClientRect(); J.x = e.clientX; J.y = e.clientY;
      jb.style.left = (e.clientX - r.left) + 'px'; jb.style.top = (e.clientY - r.top) + 'px'; jb.classList.add('on');
    });
    jz.addEventListener('pointermove', e => {
      if (e.pointerId !== J.id) return;
      let dx = e.clientX - J.x, dy = e.clientY - J.y; const d = Math.hypot(dx, dy), R = 46;
      if (d > R) { dx *= R / d; dy *= R / d; }
      jk.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      // 死区 14px；已经在走的方向要明显偏过去才换（斜着推的时候不来回抖）
      let dir = null;
      if (d >= 14) {
        const h = Math.abs(dx) > Math.abs(dy) * (J.dir === 'up' || J.dir === 'down' ? 1.25 : J.dir ? .8 : 1);
        dir = h ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
      if (dir === J.dir) return;
      J.dir = dir;
      if (overlay) { if (dir) overlay(dir); return; }
      qLatch = null;
      held = dir; if (dir) tryMove(camDir(dir));
    });
    const jEnd = e => {
      if (e.pointerId !== J.id) return;
      J.id = null; J.dir = null; held = null;
      jb.classList.remove('on'); jb.style.left = ''; jb.style.top = ''; jk.style.transform = '';
    };
    jz.addEventListener('pointerup', jEnd);
    jz.addEventListener('pointercancel', jEnd);
    jz.addEventListener('lostpointercapture', jEnd);   // 走着走着弹出对话框（操作藏起来了），手指抬起时也要放开摇杆
    jz.addEventListener('contextmenu', e => e.preventDefault());
    // 转镜头：右半边屏幕（按钮以外的地方）一根手指拖——拖多少转多少，松手就停，没有惯性；轻点两下回到自己身后。
    // 电脑上按住右键在画面上哪里拖都行。对话框、剧情、弹窗开着的时候不能转（orbOK）；左手推着摇杆的时候右手照样能转
    const oz = $('w-orb'), O = { id: null, x: 0, y: 0, moved: 0, t0: 0, tapT: 0, tapX: 0, tapY: 0 };
    const oStart = e => {
      O.id = e.pointerId; O.x = e.clientX; O.y = e.clientY; O.moved = 0; O.t0 = e.timeStamp;   // 用事件自己的时间：画面卡一下的时候「点了多久」「隔了多久」也算得准
      try { oz.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
    };
    oz.addEventListener('pointerdown', e => { if (O.id !== null || !orbOK()) return; e.preventDefault(); oStart(e); });
    oz.addEventListener('pointermove', e => {
      if (e.pointerId !== O.id) return;
      const dx = e.clientX - O.x, dy = e.clientY - O.y;
      O.x = e.clientX; O.y = e.clientY; O.moved += Math.abs(dx) + Math.abs(dy);
      if (O.moved > 6 && orbOK()) R.orbit('drag', dx, dy);   // 头几个像素不算：轻点的时候手指总会滑一点
    });
    const oEnd = e => {
      if (e.pointerId !== O.id) return;
      O.id = null;
      const now = e.timeStamp;
      if (e.type !== 'pointerup' || O.moved > 10 || now - O.t0 > 320) return;
      // 轻点了一下：0.38 秒里在差不多同一个地方又点一下 = 双击
      if (now - O.tapT < 380 && Math.hypot(e.clientX - O.tapX, e.clientY - O.tapY) < 44) { O.tapT = 0; if (orbOK()) R.orbit('behind'); }
      else { O.tapT = now; O.tapX = e.clientX; O.tapY = e.clientY; }
    };
    oz.addEventListener('pointerup', oEnd);
    oz.addEventListener('pointercancel', oEnd);
    oz.addEventListener('lostpointercapture', oEnd);
    oz.addEventListener('contextmenu', e => e.preventDefault());
    sec.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 2 || O.id !== null || !orbOK() || !e.target.closest('#w-ctrl, #w-view') || e.target.closest('button')) return;
      e.preventDefault(); e.stopPropagation(); oStart(e);
    }, true);
    sec.addEventListener('contextmenu', e => { if (camUi.on && e.target.closest('#w-ctrl, #w-view')) e.preventDefault(); });
    // 对话框里的输入框（起名字）：弹出软键盘后屏幕只剩一小条，把输入框滚到对话框里看得见的地方
    const dlgBox = $('w-dlg');
    dlgBox.addEventListener('focusin', e => {
      if (e.target.tagName !== 'INPUT') return;
      setTimeout(() => {
        const r = e.target.getBoundingClientRect(), b = dlgBox.getBoundingClientRect();
        if (r.bottom > b.bottom - 4) dlgBox.scrollTop += r.bottom - b.bottom + 12;
        else if (r.top < b.top + 4) dlgBox.scrollTop -= b.top - r.top + 12;
      }, 300);
    });
    // 左手按着摇杆时右手点 A / B / 英语聊天：这是「第二根手指」，浏览器不给它发 click，这里自己补一个；
    // 万一浏览器又发了真的 click，0.5 秒内同一个按钮的就不算，免得按一下触发两次
    const ab = $('w-ctrl');   // A / B / 英语聊天，还有指北针
    let synth = false, fired = null;
    ab.addEventListener('pointerup', e => {
      if (e.isPrimary) return;
      const b = e.target.closest('button[data-act]');
      if (!b || b.hidden || !ab.contains(b)) return;
      fired = { b, t: performance.now() };
      synth = true; try { b.click(); } finally { synth = false; }
    });
    ab.addEventListener('click', e => {
      if (synth || !fired) return;
      if (e.target.closest('button') === fired.b && performance.now() - fired.t < 500) { e.stopPropagation(); e.preventDefault(); }
      fired = null;
    }, true);
    const dp = $('w-dpad');
    const down = e => { const b = e.target.closest('[data-dir]'); if (!b) return; e.preventDefault(); if (overlay) { overlay(b.dataset.dir); return; } qLatch = null; held = b.dataset.dir; b.classList.add('on'); tryMove(camDir(held)); };
    const up = () => { held = null; dp.querySelectorAll('.on').forEach(b => b.classList.remove('on')); };
    dp.addEventListener('pointerdown', down);
    dp.addEventListener('pointerup', up);
    dp.addEventListener('pointercancel', up);
    dp.addEventListener('pointerleave', up);
    dp.addEventListener('contextmenu', e => e.preventDefault());
    // 手机转屏：iPhone 上 resize 事件来的时候版面还没排完（#w-view 的宽还是转之前的），只量这一次的话画布就按错的大小定住了——
    // 2026-11-20 老板的截图：竖屏，主角跑到屏幕最右边（画布还是横屏的 750 宽）。所以：画面那一层自己变了大小就重算（ResizeObserver），
    // 转屏以后隔一会儿再对两次（没有 ResizeObserver 的老浏览器靠这个）
    const reFit = () => { if (running) resize(); };
    window.addEventListener('resize', () => { reFit(); setTimeout(reFit, 250); setTimeout(reFit, 700); });
    window.addEventListener('orientationchange', () => { setTimeout(reFit, 250); setTimeout(reFit, 700); });
    try { const v = $('w-view'); if (v && window.ResizeObserver) new ResizeObserver(reFit).observe(v); } catch (e) { /* 忽略 */ }
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    document.addEventListener('keydown', e => {
      if (!running || !$('modal').hidden || (e.target && e.target.tagName === 'INPUT') || $('tk-ov')) return;   // 正在和岛民聊天（空格是按住说话）：不动地图上的人
      if (overlay && (KEYS[e.key] || e.key === ' ' || e.key === 'Enter' || e.key === 'z' || e.key === 'Escape' || e.key === 'x')) {
        e.preventDefault();
        overlay(KEYS[e.key] || (e.key === 'Escape' || e.key === 'x' ? 'B' : 'A'));
        return;
      }
      if (KEYS[e.key]) { e.preventDefault(); if (!e.repeat) qLatch = null; held = KEYS[e.key]; tryMove(camDir(held)); }
      else if (/^[qe]$/i.test(e.key)) { if (orbOK()) { e.preventDefault(); R.orbit('step', /q/i.test(e.key) ? 1 : -1); } }   // Q / E：镜头往左 / 往右转到下一个 45°
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
    const m = E.S.mon, o = objective();
    const qn = questRows().filter(r => r.seen && r.state === 'open').length;   // 去过的岛上现在能接的委托有几条
    E.openModal('<h2>' + hx('w.menu.title') + '</h2>' +
      // 「现在要做」能点（2026-11-20 老板）：要先学课本 → 直接去那个单元；别的在地图上 → 关上菜单、左上角那行亮一下（不传送）
      (o ? '<div class="ach" id="w-goal-full" data-act="wGoalGo" role="button" tabindex="0" style="cursor:pointer"><span class="ae">📍</span><div style="flex:1"><b>' + hx('w.menu.goal') + '</b><small>' + E.esc(o.zh) + '</small><small class="goal-go">' + goalGoLabel(o) + '</small></div><span style="color:var(--ink-3);font-weight:800">›</span></div>' : '') +
      (sightOn() ? EchoSight.menuRow() : '') +   // 今日目击（sighting.js）：「现在要做」下面的一行，点开是告示板
      '<p>' + hx('w.menu.badges', { a: Object.keys(m.badges).length, b: E.W.length }) + ' · 💰 ' + E.S.coins + (WS().repel > 0 ? hx('w.menu.spray', { n: WS().repel }) : '') + '</p>' +
      '<div class="w-menu-grid"><button class="btn ghost" data-act="mTeam">' + hx('w.menu.team') + '</button><button class="btn ghost" data-act="mBag">' + hx('w.menu.bag') + '</button><button class="btn ghost" data-act="mDex">' + hx('w.menu.dex') + '</button><button class="btn ghost" data-act="wSkills">' + hx('w.menu.skills') + '</button><button class="btn ghost" data-act="wQuests">' + hx('w.menu.quests') + (qn ? ' <b style="color:#b36b00">' + qn + '</b>' : '') + '</button>' +
      '<button class="btn ghost" data-act="wHelp">' + hx('w.menu.help') + '</button><button class="btn ghost" data-act="settings">' + hx('w.menu.settings') + '</button><button class="btn ghost" data-act="wExit">' + hx('w.menu.home') + '</button></div>' +
      '<button class="btn wide" data-act="close">' + hx('w.menu.go') + '</button>');
  }
  function helpSheet() {
    E.openModal('<h2>' + hx('w.help.title') + '</h2><p>' + hx('w.help.p1', { how: tx(E.S.settings.ctl === 'pad' ? 'w.help.pad' : 'w.help.joy') }) + '</p>' +
      (R && R.orbit ? '<p>' + hx('w.help.cam') + '</p>' : '') +
      '<p>' + hx('w.help.p2') + '</p>' +
      '<button class="btn wide" data-act="close">' + hx('w.ok') + '</button>');
  }

  // ---------- 对外 ----------
  const actions = {
    // 学习锁没开：不让进（第一次开始冒险、还没有怪兽的时候不锁）
    wEnter: () => { if (E.gate && (E.S.mon && E.S.mon.box || []).length && !E.gate().open) { E.gateBlock(); return; } enter(0, 'resume'); },
    wFly: t => { if (E.gate && (E.S.mon && E.S.mon.box || []).length && !E.gate().open) { E.gateBlock(); return; } enter(+t.dataset.z, 'fly'); },
    wExit: () => { E.closeModal(); E.goHome('mon'); },
    wA: () => overlay ? overlay('A') : interact(),
    wChat: () => { if (!overlay && !dlg && !busy && chatNpc) { chatNpc.face = faceTo(chatNpc, PL); chatWith(chatNpc); } },
    wNorth: () => { if (orbOK()) { R.orbit('north'); E.SFX.tap(); } },   // 指北针：镜头转回正北
    wB: () => overlay ? overlay('B') : bButton(),
    wPick: t => { const pg = page(); if (!pg || pg.kind !== 'choice') return; const extra = pg.pick(+t.dataset.i); insertPages(extra); pg.kind = null; nextPage(); },
    wMenu: () => menuSheet(),
    wGoal: () => { if (!dlg && !overlay && !busy) goalGo('hud'); },
    wGoalGo: () => { if (!dlg && !overlay && !busy) goalGo('menu'); },
    wGoalHome: t => { if (E.goUnit) E.goUnit(+t.dataset.w); },   // 首页「继续冒险」下面那行 📍 的「去闯关练习」
    wZh: () => showZh(),
    // 剧情中文的设置按钮（EchoWorld.storyZhHTML() 给设置页用）：就地换高亮，不用重画整个设置页
    wZhMode: t => {
      const v = t.dataset.m;
      if (!['always', 'tap', 'auto'].includes(v)) return;
      E.S.settings.storyZh = v; E.save(); E.SFX.tap();
      const seg = t.closest('.seg'); if (seg) seg.querySelectorAll('[data-act=wZhMode]').forEach(b => b.classList.toggle('on', b === t));
    },
    wHelp: () => helpSheet(),
    wSkills: () => skillsSheet(),
    wQuests: () => questSheet(),
    wBike: () => { if (M.kind === 'inside' || M.kind === 'under' || PL.surf) return; PL.bike = !PL.bike; E.SFX.tap(); E.toast(tx(PL.bike ? 'w.bike.on' : 'w.bike.off')); hud(); },
    wUseSkill: t => {
      const k = t.dataset.k;
      E.closeModal();
      if (k === 'flash') useSkill('flash', () => { M._flash = true; E.toast(tx('w.flash.ok'), 'gold'); });
      else if (k === 'fly') {
        const v = Object.keys(WS().visited || {}).map(Number).sort((a, b) => a - b);
        E.openModal('<h2>' + hx('w.fly.title') + '</h2><div class="fly-list">' + v.map(z => '<button class="btn small ghost" data-act="wFlyTo" data-z="' + z + '">' + E.W[z].icon + ' ' + (townTag(z) || E.esc(townName(E.W[z]))) + '</button>').join('') + '</div><button class="btn ghost wide" data-act="close">' + hx('w.cancel') + '</button>');
      }
    },
    wFlyTo: t => { const z = +t.dataset.z; E.closeModal(); useSkill('fly', () => flyTo(z)); },
    wHear: () => { const pg = page(); if (pg) E.say(pg.kind === 'speak' ? pg.target : pg.en, 0.8, pg.g); },
    wMic: () => dlgMic(),
    wSelfDone: () => { const pg = page(); if (pg && pg.kind) passTask(70); },
    wSkip: () => { const pg = page(); if (pg && pg.kind) failTask(); },
    wAiSkip: () => { const pg = page(); if (pg && pg.kind) { E.stopListening(); aiSkipTask(); } },
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
  // 背包里用道具时，world 负责悄悄喷雾和回程绳
  const fieldHooks = {
    inWorld: () => running && !!M,
    repel: () => { WS().repel = 100; E.save(); E.toast(tx('w.spray.on')); },
    canRope: () => running && M && (M.kind === 'cave' || M.kind === 'under' || (M.def && M.def.dungeon)) && !!(WS().lastOut && WS().lastOut.map),
    rope: () => { E.closeModal(); const o = WS().lastOut; goMap(o.map, o.x != null ? { x: o.x, y: o.y, dir: o.dir || 'down' } : null); },
    bike: () => { E.closeModal(); if (running && M) actions.wBike(); },
  };
  // ---------- 每日宝箱开出冒险用的东西（家长 2026-10-07：进化曲、蛋、稀有色蛋；emoji 宠物退到次要）----------
  // r：0–1 的随机数（测试时传固定值）。没有怪兽（还没选伙伴）时返回 null，让 game.js 用原来的奖品
  function chestPrize(r) {
    if (!E || !(E.S.mon.box || []).length) return null;
    r = r == null ? Math.random() : r;
    const D = window.DEX || {};
    if (r < .5) {
      const ids = Object.keys(D.STONES || {}); if (!ids.length) return null;
      const id = ids[Math.floor(r / .5 * ids.length) % ids.length], it = MG.ITEMS[id];
      MG.addItem(id, 1); E.save();
      // 中文界面在说明前面带上英文名；英语界面标题里已经是英文名
      return { prize: it.icon, kind: 'stone', id, html: '<h2>' + hx('w.chest.stone', { name: L(it) }) + '</h2><p>' + (gloss(it) ? hx('w.chest.stone.en', { en: T_('item', it.en) }) : '') + hx('w.chest.stone.p') + '</p>' };
    }
    if (r < .9) {
      // 蛋：第一大区（dex.js 的 inRegion1）的幼年怪兽，优先手册里还没收服的（初始怪兽也会出，这样第一大区都能集齐）
      const base = (D.list || []).filter(s => D.inRegion1(s) && !s.legend && D.isBase(s));
      if (!base.length) return null;
      const dex = E.S.mon.dex || {}, fresh = base.filter(s => dex[s.id] !== 'caught');
      const pool = fresh.length && Math.random() < .75 ? fresh : base, sp = pool[Math.floor(Math.random() * pool.length)];
      const shiny = r >= .8, egg = MG.giveEgg(sp.id);
      if (shiny && egg) egg.shiny = true;   // 孵出来就是稀有色的
      E.save();
      return shiny ? { prize: '🥚✨', kind: 'shinyEgg', id: sp.id, html: hx('w.chest.shiny') }
        : { prize: '🥚', kind: 'egg', id: sp.id, html: hx('w.chest.egg') };
    }
    return null;
  }
  // 第一大区的手册收服了几种：成就「怪兽大师」用（只数有编号的，家庭版的番外不算）
  function dexRegion(s) {
    s = s || (E && E.S);
    const list = ((window.DEX && DEX.main) || []).filter(q => DEX.inRegion1(q)), dex = (s && s.mon && s.mon.dex) || {};
    return { caught: list.filter(q => dex[q.id] === 'caught').length, total: list.length };
  }
  // 「剧情中文」设置（给 game.js 的设置页，建议放进「🔒 家长设置」）：按钮由 world 的 wZhMode 处理
  // 只在内容有这门界面语言的意思时出现（现在只有中文）：英语界面学英语，台词本身就是英文，没有可以收起来的翻译，这一行没有意义
  function storyZhHTML() {
    if (I18N && !CONTENT_GLOSS.includes(I18N.lang())) return '';
    const cur = E ? zhMode() : 'auto';
    return '<div class="set"><label>' + hx('w.zh.label') + '</label><div class="seg">' +
      ['auto', 'tap', 'always'].map(m => '<button class="' + (cur === m ? 'on' : '') + '" data-act="wZhMode" data-m="' + m + '">' + hx('w.zh.' + m) + '</button>').join('') +
      '</div><small>' + hx('w.zh.note') + '</small></div>';
  }
  const api3d = { tile: (x, y) => tile(x, y) };
  const ART = { drawPerson, portrait, atlas: PPL.atlas, paintGround, shade, hsh, rr, circ, ell, OUT, LOOKS, monImg, drawPickup, buildColor: BUILD_COLORS };
  window.EchoWorld = {
    music: () => (M ? mapMusic() : ''),   // 当前地图的背景音乐（game.js 回到大地图时问）
    init(api, mg) { E = api; MG = mg; EM = window.EchoMaps; EM.setTownCount(E.W.length); MG.setFieldHooks && MG.setFieldHooks(fieldHooks);
      // 今日目击（sighting.js）：它的按钮并进来；给它几个钩子（开一场野外对战、现在在哪张地图、大地图在不在跑、悄悄喷雾还有没有效）
      if (window.EchoSight) Object.assign(actions, EchoSight.init(api, mg, { battle: o => battle('wild', o), map: () => M, running: () => running, spray: () => WS().repel > 0 }));
      return actions; },
    // mile：学习里程碑（传说的线索）累计的数，见 story.js 的 mile()
    fresh: () => ({ started: false, map: 't0', z: 0, x: -1, y: -1, dir: 'up', arrive: null, visited: {}, flags: {}, daily: {}, center: null, introDone: false, repel: 0, mile: { upto: '', talk: 0, recall: 0, streak: 0 },
      // 今日目击（sighting.js）：been 进过的野外地图 { 地图 id: 1 }，sight 今天的目标和累计（字段说明在 sighting.js 的 fresh() 上面）
      been: {}, sight: window.EchoSight ? EchoSight.fresh() : {} }),
    stop: () => { stopLoop(); useRecentSrc(false); adv.on = false; adv.want = ''; if (dlg) { clearInterval(dlg.tw); dlg = null; const d = $('w-dlg'); if (d) d.hidden = true; } busy = false; },
    // ---- 给首页 / 设置 / 宝箱 / 成就用的接口（game.js、monsters.js 调用）----
    // 下一枚徽章要过哪些课本 BOSS：{ z, island, leader, ok, need, done, unitLabel（下一个要打的单元，比如「七上 Unit 3」，ok 时为空）, target（最后一个要过的单元）, missing[] }；13 枚都有了返回 null
    nextGymNeed: () => { if (!E) return null; const z = nextGymZ(); if (z < 0) return null; const g = gymNeed(z); return Object.assign(g, { island: townName(E.W[z]), leader: bossName(E.W[z].boss) }); },   // 名字按界面语言
    // 现在该去哪、做什么：{ zh, z }（首页「继续冒险」下面的小字用）
    objective: () => (E ? objective() : null),
    // 传说的线索（首页卡片）：[{ id, icon, en, zh, task, have, need, done, caught, back }]
    legendClues: () => { try { return E && window.EchoStory && EchoStory.legendClues ? EchoStory.legendClues(SC) : []; } catch (e) { console.error(e); return []; } },
    // 每日宝箱：开出进化曲 / 蛋 / 稀有色蛋并放进背包或队伍，返回 { prize: 大图标, html: '<h2>…</h2><p>…</p>', kind, id }；返回 null 时用原来的奖品
    chestPrize: r => chestPrize(r),
    // 第一大区手册：{ caught, total }（total = DEX.region1Total）
    dexRegion: s => dexRegion(s),
    storyZhHTML: () => storyZhHTML(),
    // 支线委托（quests.js）的进度：[{ id, z, seen 去过那座岛, state: 'open' 能接 / 'locked' 还不能接 / 'done' 做完了, stars, lock 不能接的原因 }]
    quests: () => (E ? questRows().map(r => ({ id: r.q.id, z: r.q.z, seen: r.seen, state: r.state, stars: r.stars, lock: r.lock })) : []),
    // 设置里改了画质
    // （画不出来退下来过的话，改设置 = 从头再试：见 rebuildGL）
    setGfx: () => { if (!M || !$('w-view')) return; GL.ban = 0; GL.fails = 0; ensureRenderer(); loadR(); resize(); },
    // 现在用哪一档画质（自动档按设备和量出来的帧率；战斗画面也按这个）
    gfxTier: () => gfxTier(),
    ctlMode: () => ctlMode(),
    placeLabel: () => { const ws = E.S.world; if (!ws.started || !ws.map || !window.EchoMaps) return null; const m = EchoMaps.get(ws.map); return m ? placeName(m) : null; },
    _debug: () => ({ M, PL, FL, dlg, busy, R, perf, gl: GL, goMap: (id, how) => goMap(id, how), battle: (kind, o) => battle(kind, o || {}),
      // 测试用：假装进大地图是在 d 这一天（检查过了零点回首页）；回声技能 / 徽章判断；重赛出题有没有换成课本
      fakeDay: d => { adv.day = d; }, adv, skillOpen: k => skillOpen(k), hasBadge: z => hasBadge(z), recentSrc: () => !!srcBak, debug: DEBUG,
      talk: (pages, done) => talk(pages, done) }),   // 测试用：直接放一段对话（说话任务 / 选回答，tests/apk.test.js）
    _art: ART,
    signLabel: L => signLabel(L),   // 房子的招牌（world3d.js、world3d-open.js 也用）
    townTag: z => townTag(z),       // 别的课：第 z 座岛的地名牌 HTML（这门课的地名 + 界面语言的小字；没翻 / 英语课 null）——monsters.js 首页「飞去哪」
  };
})();
