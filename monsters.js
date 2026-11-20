// 回声岛 · 怪兽对战：用英语念咒语攻击，听懂对手的咒语来防御，收服、升级、进化
(function () {
  'use strict';

  // ---------- 界面文字（i18n.js 字表；键前缀 b.） ----------
  // 2026-11-19 搬进来：中文界面和以前一字不差。tx 纯文字（toast、textContent），hx 拼进 innerHTML（参数先转义）。
  // 内容（英文句子的中文意思、怪兽 / 招式的中文名）不搬：显示时走 gloss（英语界面不显示）；道具、属性、状态这种有 zh / en 两个名字的走 label
  const I18N = window.EchoI18n;
  const tx = (k, p) => (I18N ? I18N.t(k, p) : k), hx = (k, p) => (I18N ? I18N.h(k, p) : k);
  const gloss = o => (I18N ? I18N.gloss(o) : (o && o.zh) || null);
  const label = o => (I18N ? I18N.label(o) : (o && o.zh) || '');
  const isZh = () => !I18N || I18N.lang() === 'zh';
  // 中文名放在英文名后面的括号里：「Bubbly（泡泡）」；英语界面没有中文意思，就什么都不加
  const zhOf = o => { const g = gloss(o); return g ? tx('b.zhName', { zh: g }) : ''; };
  if (I18N) I18N.add({
    zh: {
      'b.zhName': '（{zh}）', 'b.q': '？', 'b.sep.list': '、', 'b.sep.comma': '，', 'b.sep.semi': '；',
      'b.task': ['🗣 说单词', '📜 念句子', '💬 对话大招'], 'b.tier': ['小招', '中招', '大招'],
      'b.eff.weak': '打中弱点！', 'b.eff.barely': '几乎没用', 'b.eff.low': '不太管用',
      'b.sup.roar': '对手攻击↓', 'b.sup.guard': '自己防御↑↑', 'b.sup.power': '自己攻击↑↑', 'b.sup.speed': '自己速度↑↑', 'b.sup.chill': '对手速度↓↓', 'b.sup.spooky': '对手防御↓↓',
      'b.sup.sleep': '让对手睡着', 'b.sup.poison': '让对手中毒', 'b.sup.para': '让对手麻痹', 'b.sup.burn': '让对手烧伤', 'b.sup.confuse': '让对手混乱', 'b.sup.heal': '回复一半体力',
      'b.st.brn': '被烧伤了！每回合都会掉血🔥', 'b.st.psn': '中毒了！每回合都会掉血☠️', 'b.st.par': '麻痹了！有时候会动不了⚡', 'b.st.slp': '睡着了💤', 'b.st.frz': '被冻住了🧊', 'b.st.conf': '混乱了！有时候会撞到自己😵',
      'b.item.ball': '收服野生怪兽', 'b.item.superball': '更容易收服', 'b.item.potion': '回复 40% 体力', 'b.item.superpotion': '回复 80% 体力', 'b.item.revive': '让累倒的怪兽恢复一半体力',
      'b.item.repel': '100 步内野生怪兽听不见你，不会跑出来', 'b.item.rope': '从洞穴里一下回到洞口', 'b.item.antidote': '治好中毒', 'b.item.burnheal': '治好烧伤', 'b.item.paraheal': '治好麻痹',
      'b.item.awakening': '叫醒睡着的怪兽', 'b.item.iceheal': '治好冰冻', 'b.item.fullheal': '治好所有异常状态', 'b.item.expshare': '戴着它，没出场的怪兽也在旁边听，能分到一半经验',
      'b.item.rod': '对着水按 A 钓鱼', 'b.item.bike': '骑车走得快一倍（右上角 🚲 按钮）', 'b.item.dowsing': '藏起来的道具会一闪一闪', 'b.item.stone': '进化曲：放给某些怪兽听，它就会进化',
      'b.item.hm': '回声技能「{skill}」{icon}（菜单 → 回声技能）', 'b.item.ticket': '坐渡轮去别的岛',
      'b.boss': ['鹦鹉船长', '彩虹蟹', '海龟奶奶', '猫头鹰校长', '八爪博士', '火烈鸟乐手', '闹钟公鸡', '河豚派对王', '鳄鱼巡查员', '鲨鱼纪律官', '海狮教练', '天气鲸', '回忆巨龙'],
      'b.fr': '亲密度', 'b.type': '{t}系', 'b.shiny': '稀有色', 'b.hp': '体力', 'b.xp': '经验',
      // 首页「怪兽冒险」
      'b.home.new.t': '新的冒险', 'b.home.new.p': '你刚搬到回声群岛最南边的你好岛。这里的怪兽听得懂英语——话说得越清楚，怪兽就越强。<br>回声博士好像遇到麻烦了……',
      'b.home.start': '🌅 开始冒险', 'b.home.clock': '手机日期被改过，先改回来', 'b.home.steps': '还差 {n} 步就能去冒险',
      'b.home.stats': 'HP {hp} · 攻击 {atk}', 'b.home.evo': ' · Lv {lv} 会进化',
      'b.home.mons': '🐾 我的怪兽 {n}', 'b.home.dex': '📖 怪兽手册 {a}/{b}', 'b.home.balls': '🔮 回声球 {n}',
      'b.home.continue': '继续冒险', 'b.home.go': '出发去冒险！',
      'b.gym.t': '🏅 下一枚徽章（{isle}）', 'b.gym.p': '岛主{leader}要你先学好课本：还差 <b>{unit}</b> 的 BOSS（课本 BOSS {done}/{need}）', 'b.gym.go': '📚 去闯关练习',
      'b.leg.t': '✨ 传说的线索', 'b.leg.name': '<b>{name}</b>：', 'b.leg.caught': '已经收服了！', 'b.leg.task': '{task}（{have}/{need}）', 'b.leg.done': ' · 到户外走走，它会来找你！',
      'b.home.tip': '走进草丛会遇到野生怪兽，路上的训练师看到你就会来挑战。<br>打败每个小镇的岛主拿到徽章，守卫才会让你去下一个小镇。岛主会先看你课本学到哪了：要先在「📚 闯关练习」打败对应单元的 BOSS。',
      'b.home.fly': '✈️ 飞回去过的小镇',
      'b.home.foot': '🏅 徽章 {a} / {b} · <button class="link" data-act="mBag">🎒 背包</button> · <button class="link" data-act="report">📊 学习周报</button> · 在「📚 闯关练习」每通关一关送 1 个回声球，三星送 2 个。',
      // 选初始怪兽、说话、麦克风
      'b.st.say': '想让它当你的伙伴，就对它大声说：', 'b.st.other': '再看看别的', 'b.st.retry': '再试一次：be my partner!', 'b.st.joined': '🎉 {name} 成为了你的伙伴！',
      'b.mic.say': '点麦克风，大声说', 'b.mic.read': '点麦克风，大声念出来', 'b.mic.on': '正在听……', 'b.mic.listen': '正在听……说完会自动停止', 'b.mic.start': '开始说话',
      'b.mic.again': '没听清，再大声一点', 'b.mic.closer': '没听清，靠近一点、大声一点再试一次', 'b.mic.try': '（第 {n}/3 次）',
      'b.said': '🎤 我说了！', 'b.listen': '🔊 听一遍', 'b.hear': '听', 'b.hearModel': '听示范', 'b.hearAgain': '再听一遍', 'b.hearQ': '再听一遍问题',
      'b.skip': '先跳过', 'b.skipAi': '📶 先跳过（已放进复习，联网后要补说）', 'b.heard': '我听到：“{t}”',
      'b.need.starter': '先选一只初始怪兽吧', 'b.need.rest': '怪兽们都没力气了，先去休息站休息',
      // 对战画面
      'b.leave': '离开战斗', 'b.title.wild': '野外对战', 'b.title.trainer': '训练师 {name}', 'b.title.leader': '岛主 {name}', 'b.title.zone': '第 {n} 区 · {isle}',
      'b.energy': '能量，攒满 3 格可以放大招', 'b.foeLeft': '对手剩下的怪兽',
      'b.stat.atk': '攻', 'b.stat.def': '防', 'b.stat.spd': '速', 'b.stat.atkL': '攻击', 'b.stat.defL': '防御', 'b.stat.spdL': '速度',
      'b.in.shiny': '✨ 闪闪发光的！', 'b.in.wild': '前面跳出来一只 <b>{name}</b>{zh}！', 'b.in.shinyToast': '✨ 是稀有色的 {name}！颜色和平常不一样，很少见哦',
      'b.in.foe': '{who}：“<b>{name}</b>，该你了！”', 'b.in.next': '{who}：“还没完！<b>{name}</b>，该你了！”', 'b.go': '<b>{name}</b>，上场！', 'b.rest': '<b>{name}</b>，先休息一下！',
      'b.selfWake': '{icon}{name} 自己恢复了！', 'b.menu': '念对英语，<b>{name}</b> 就出招！',
      // 别的语言的课（tools/course/ENGINE.md）：写着「英语」的几句换成这门语言（i18n.js 的 variant，{lang} 是语言名）
      'b.menu.c': '念对{lang}，<b>{name}</b> 就出招！', 'b.t.word.c': '🗣 说出图上的{lang}，发动 <b>{mv}</b>', 'b.talk.p.c': '每天用{lang}和它说一句，它会越来越喜欢你。亲密度 {h}',
      'b.home.new.p.c': '你刚搬到回声群岛最南边的你好岛。这里的怪兽听得懂{lang}——话说得越清楚，怪兽就越强。<br>回声博士好像遇到麻烦了……',
      'b.mv.strong': '克制', 'b.mv.low': '不太管用', 'b.mv.lock': '攒满 3 格能量',
      'b.catch': '🔮 收服', 'b.catch.weak': ' · 先打虚弱', 'b.switch': '🔄 换怪兽', 'b.bag': '🎒 背包',
      'b.wake.slp': '<b>{name}</b> 睡着了💤！大声喊它，念得越准越容易叫醒。', 'b.wake.frz': '<b>{name}</b> 被冻住了🧊！大声喊它，念得越准越容易化开。',
      'b.use': '用', 'b.back': '返回', 'b.close': '关闭', 'b.ok': '好了', 'b.okay': '好的',
      'b.bbag.t': '🎒 背包', 'b.bbag.p': '给 <b>{name}</b> 用道具（体力 {hp} / {max}{st}）。用道具会用掉这一回合。',
      'b.hpOf': '体力 {hp} / {max}', 'b.sw.go': '换它上场', 'b.sw.t': '🔄 换哪只上场？', 'b.sw.p': '换怪兽会用掉这一回合。',
      'b.why.listen': '没听出来', 'b.why.unheard': '没听清', 'b.why.wrong': '说成了错误的回答', 'b.why.pick': '选错了回答', 'b.why.miss': '没念准', 'b.why.unclear': '念得不够清楚',
      'b.l.right': '👂 听对了！（这回合不能暴击）', 'b.l.wrong': '没听出来，听一下正确的 👂',
      'b.noBalls': '回声球用完了！去「闯关练习」通关就能拿到，或者去商店买',
      'b.ball.t': '用哪种球？', 'b.ball.n': '🔮 回声球 ×{n}', 'b.ball.s': '💠 金回声球 ×{n}',
      // 招式面板
      'b.l.down': '📶 AI 打分暂时用不了：', 'b.l.ult': '听对手的问题，点出正确的回答', 'b.l.word': '听一听，点出你听到的词', 'b.l.sent': '听一听，点出你听到的咒语', 'b.l.use': '，发动 <b>{mv}</b>（这回合不能暴击）',
      'b.l.owe': '联网以后这一句要在复习里补说', 'b.l.catch': '<b>{name}</b> 已经很虚弱了，听准收服咒语！', 'b.l.hit': '听准了才能打中！', 'b.l.toast': '📶 AI 打分暂时用不了：这回合听一听、点出来',
      'b.back.move': '换个技能',
      'b.t.word': '🗣 说出图上的英文，发动 <b>{mv}</b>', 'b.hint.hear': '💡 听一下答案（这次就不能暴击了）', 'b.hint.see': '💡 看一下答案（这次就不能暴击了）',
      'b.blind': '🔥 不看字念（念对伤害 ×1.5）', 'b.t.mem': '🧠 凭记忆念出咒语，发动 <b>{mv}</b>', 'b.t.cue': '📜 看首字母，念出咒语，发动 <b>{mv}</b>', 'b.t.sent': '📜 大声念出咒语，发动 <b>{mv}</b>', 'b.t.blindOn': ' · 🔥 念对伤害 ×1.5',
      'b.t.ult.mem': '💬 大招 <b>{mv}</b>：听懂对手的问题，凭记忆大声回答！', 'b.t.ult.sr': '💬 大招 <b>{mv}</b>：听懂对手的问题，大声说出正确回答！', 'b.t.ult.self': '💬 大招 <b>{mv}</b>：听懂对手的问题，先选出正确回答，再大声说出来！',
      'b.showOpts': '👀 看看可以怎么回答（这次就不能暴击了）', 'b.optHear': '点选项可以先听一听',
      'b.t.wake': '📣 大声喊它！', 'b.t.catch': '🔮 念出收服咒语，把它装进回声球！',
      'b.rate.0': '😅 没念好', 'b.rate.1': '🙂 还行', 'b.rate.2': '😎 很准',
      'b.self.ult': '先点出正确的回答', 'b.self.rate': '大声念出来，然后诚实地给自己打分', 'b.self.picked': '选对了！现在大声说出这句回答，再打个分',
      'b.tip.catch': '<b>{name}</b> 已经很虚弱了，快收服它！', 'b.tip.sup': '念得清楚，辅助招式才会成功！', 'b.tip.hit': '念得越准，伤害越高；念得特别准会<b>暴击</b>！',
      'b.noSr': '这里用不了语音识别，改成自己念、自己打分',
      'b.ult.retry1': '没对上。看看这几个回答，把对的那句大声说出来（最后一次机会，这次不能暴击了）', 'b.ult.retry2': '没对上任何一个回答，再说一次（最后一次机会，这次不能暴击了）',
      'b.retry': '{n} 分，没念准，再试一次（最后一次机会{nc}）', 'b.retry.nc': '，这次不能暴击了',
      'b.rev.good': '念得很准！', 'b.rev.hear': '听一下正确的读法 👂',
      // 对战里的消息
      'b.faster': '<b>{name}</b> 速度更快，抢先出手！',
      'b.ca.slp': '<b>{name}</b> 正在呼呼大睡💤', 'b.ca.frz': '<b>{name}</b> 被冻住了，动不了🧊', 'b.ca.woke': '<b>{name}</b> 醒过来了！',
      'b.ca.par': '<b>{name}</b> 身体麻痹，动不了！⚡', 'b.ca.confEnd': '<b>{name}</b> 不再混乱了。', 'b.ca.confHit': '<b>{name}</b> 晕头转向，撞到了自己！',
      'b.ca.obey': '<b>{name}</b> 等级太高，不太听你的话，在发呆……（多拿徽章它就会听话了）',
      'b.eor.brn': '<b>{name}</b> 被烧伤了，好烫！🔥', 'b.eor.psn': '<b>{name}</b> 中毒了，好难受……☠️', 'b.got': '<b>{name}</b> {got}',
      'b.stg.maxUp': '<b>{name}</b> 的{stat}已经不能再提高了。', 'b.stg.maxDown': '<b>{name}</b> 的{stat}已经不能再降低了。',
      'b.stg.up2': '<b>{name}</b> 的{stat}大幅提高了！', 'b.stg.up1': '<b>{name}</b> 的{stat}提高了！', 'b.stg.down2': '<b>{name}</b> 的{stat}大幅降低了！', 'b.stg.down1': '<b>{name}</b> 的{stat}降低了！',
      'b.noEffect': '但是没有效果……', 'b.hpFull': '体力已经是满的了。', 'b.healed': '<b>{name}</b> 恢复了体力！',
      'b.rule.words': '📖 单词擂主的规则：你的小招伤害 ×1.5', 'b.rule.listen': '👂 听力擂主的规则：防御只有 8 秒，要听得快！',
      'b.rule.clear': '🗣️ 口语擂主的规则：念得很准伤害 ×1.6，一般只有 ×0.8', 'b.rule.talk': '💬 对话擂主的规则：一上场就有 3 格能量，可以直接放大招！',
      'b.used': '<b>{name}</b> 使用了 <b>{mv}</b>！', 'b.supFail': '咒语{why}，<b>{mv}</b> 失败了！',
      'b.crit': '暴击！', 'b.lbl.mem': '🔥 凭记忆', 'b.lbl.block': '挡住了',
      'b.hit.critBlind': '不看字也念得超准，<b>暴击</b>！', 'b.hit.crit': '发音超准，<b>暴击</b>！', 'b.hit.blind': '🔥 不看字也念对了，威力 ×1.5！', 'b.hit.graze': '咒语有点含糊，只擦伤了它。', 'b.hit.ok': '打中了！',
      'b.hit.weak': '属性克制，打中弱点！', 'b.hit.low': '属性不太对，不太管用。', 'b.miss': '咒语{why}，攻击落空了！',
      'b.wk.slp': '<b>{name}</b> 被你叫醒了！下一回合可以出招。', 'b.wk.frz': '<b>{name}</b> 身上的冰化开了！下一回合可以出招。',
      'b.wk.no.slp': '<b>{name}</b> 还是没醒……{tip}', 'b.wk.no.frz': '<b>{name}</b> 还是冻着……{tip}', 'b.wk.tip.clear': '喊得再清楚一点！', 'b.wk.tip.next': '下回合再试试。',
      'b.foePotion': '{who} 给 <b>{name}</b> 用了药水！',
      'b.def.msg': '<b>{name}</b> 要用 <b>{mv}</b>{zh}了！听懂它的咒语来防御！', 'b.def.msgUlt': '<b>{name}</b> 要用 <b>{mv}</b>{zh}了！<b>这是大招！</b>听懂它的咒语来防御！',
      'b.def.h': '🛡️ 它念的咒语是什么意思？选对就能挡住', 'b.def.hEn': '🛡️ 它念的是哪一句？选对就能挡住',
      'b.def.ok': '🛡️ <b>防住了！</b>', 'b.def.okSup': '它的招式没有效果。', 'b.def.okHit': '只受到一点点伤害。', 'b.def.late': '⏰ 来不及了！', 'b.def.wrong': '没听懂……', 'b.def.ans': '它念的是：<b>{ans}</b>',
      'b.hold': '💖 <b>{name}</b> 想着你，又站了起来！',
      // 升级、学招
      'b.lvup': '⬆️ {name} 升到了 Lv {lv}！', 'b.learned': '✨ {name} 学会了 {mv}！',
      'b.learn.t': '{name} 能学一个新招式了！', 'b.learn.p': '它已经会 4 个招式了。要忘掉哪一个，换成 <b>{mv}</b>？', 'b.learn.no': '不学了',
      'b.learn.skip': '{name} 没有学 {mv}', 'b.learn.ok': '好，{mv} 换下来了！', 'b.learn.say': '现在大声教它新招式：',
      'b.learn.ai': '📶 AI 打分暂时用不了，先学会这一招', 'b.learn.again': '再清楚一点，再说一次！',
      'b.tired': '<b>{name}</b> 累得不能再战斗了！', 'b.down': '<b>{name}</b> 累倒了……',
      // 收服、结算
      'b.throw': '扔出回声球！', 'b.throw.s': '扔出金回声球！', 'b.caught': '🎉 收服成功！<b>{name}</b>{zh}成为了你的伙伴！',
      'b.free': '哎呀，<b>{name}</b> 挣脱了！', 'b.free.say': '收服咒语要念得清楚一点。', 'b.free.weak': '再把它打虚弱一点，或者让它睡着、麻痹再试试。',
      'b.win.badge': '🏅 拿到了 {isle} 徽章！', 'b.win.balls': '🔮 回声球 +3', 'b.win.obey': '🐾 等级 {n} 以下的怪兽都会听你的话', 'b.win.unlock': '🏝️ 新区域解锁：{isle}',
      'b.win.coins': '💰 金币 +{n}', 'b.win.xp': '⭐ 出战的怪兽获得经验 +{n}', 'b.win.share': '（共学耳机：其他队员也分到一半）',
      'b.win.box': '队伍已经有 6 只了，新伙伴被送到了电脑箱子里（去休息站的电脑换）。', 'b.win.team': '新伙伴已经加入队伍！',
      'b.win.leader': '{who}：“你太厉害了！这枚徽章是你的了！”', 'b.win.trainer': '{who}：“你真厉害！”', 'b.win': '胜利！',
      'b.res.caught': '收服成功！', 'b.res.leader': '打败岛主！', 'b.res.go': '继续冒险 ▶', 'b.res.again': '⚔️ 再战一场', 'b.res.home': '回基地',
      'b.streak': '🔥 今日打卡成功！已连续 {n} 天',
      'b.lose': '你的怪兽们都累倒了……', 'b.lose.t': '先去休息站休息一下',
      'b.lose.p': '休息站能让怪兽恢复体力、治好异常状态。<br>小窍门：多在草丛里打野生怪兽把等级练上去，<br>用<b>属性克制</b>的招式，或者先用辅助招式降低对手的攻击。', 'b.lose.go': '去休息站',
      'b.potion.hp': '用了{item}！<b>{name}</b> 恢复了体力。', 'b.potion.st': '用了{item}！<b>{name}</b> 恢复正常了。',
      // 进化、详情
      'b.evo.t': '看！{name} 在长大……', 'b.evo.p': '{name} 正在长大！', 'b.evo.ok': '太棒了！', 'b.evo.done': '太棒了！<b>{from}</b> 长成了 <b>{to}</b>{zh}！',
      'b.egg': '蛋 Egg', 'b.egg.tip': '带着它一起走路，它就会慢慢长大、孵出来。',
      'b.egg.far': '它好像还要很久才会孵出来。', 'b.egg.mid': '里面有动静了！', 'b.egg.near': '快孵出来了！它在里面动来动去。',
      'b.sum.evoLv': 'Lv {lv} 进化成 {name}', 'b.sum.xp': '经验 {a} / {b}', 'b.sum.hp': '体力 HP', 'b.sum.atk': '攻击 ATK', 'b.sum.def': '防御 DEF', 'b.sum.spd': '速度 SPD',
      'b.sum.moves': '招式', 'b.sum.next': '以后还能学：{list}', 'b.sum.evo': '进化：{list}',
      'b.talk.done': '💬 今天聊过了', 'b.talk.go': '💬 和它说说话', 'b.nick.btn': '✏️ 起名字',
      // 起名字、说说话
      'b.nick.t': '给 {name} 起个英文名字吧！', 'b.nick.p': '选一个，也可以自己输入。', 'b.nick.ph': '自己输入英文名', 'b.nick.tip': '只能用英文字母，最多 10 个',
      'b.nick.keep': '不改了', 'b.nick.use': '就叫 {name}', 'b.nick.clear': '用回原名 {name}', 'b.nick.say': '大声告诉它新名字：', 'b.nick.back': '换一个名字',
      'b.nick.done': '它现在叫 {name} 了！', 'b.nick.orig': '用回了原来的名字', 'b.nick.ai': '📶 AI 打分暂时用不了，名字先起好了', 'b.nick.bad': '要用英文字母写哦，比如 Kiki',
      'b.score.again': '{n} 分，再清楚一点！',
      'b.mood': ['它有点害羞地看着你。', '它歪着头听你说话。', '它开心地转了一圈。', '它蹭了蹭你的手。', '它高兴得跳了起来！', '它紧紧地贴着你，最喜欢你了！💖'],
      'b.talk.later': '今天已经聊过了，明天再来和它说说话吧。', 'b.talk.t': '和 {name} 说说话', 'b.talk.p': '每天用英语和它说一句，它会越来越喜欢你。亲密度 {h}', 'b.talk.no': '先不说',
      'b.talk.close': '很亲的怪兽：快倒下时有时会为你坚持住，打起来也更用力。', 'b.talk.ok': '😊 好',
      // 怪兽幼儿园
      'b.day.take': '领回来', 'b.day.good': '💞 它们俩相处得很好（有相同的属性）。', 'b.day.bad': '它们俩不太合得来（没有相同的属性），不会有蛋。', 'b.day.leave': '寄养',
      'b.day.t': '🏡 怪兽幼儿园', 'b.day.p': '把两只怪兽寄养在这里，它们会跟着爷爷奶奶长大（每走 100 步长 1 级）。两只有相同属性的话，过一阵子会发现一个蛋！',
      'b.day.egg': '发现了一个蛋！', 'b.day.egg.s': '是它们俩留下的', 'b.day.eggTake': '收下', 'b.day.in': '寄养中 {n} / 2', 'b.day.none': '还没有寄养的怪兽。',
      'b.day.pick': '从队伍里选一只寄养', 'b.day.keep': '队伍里至少要留一只能战斗的怪兽。', 'b.day.thanks': '谢谢 Thank you!',
      'b.day.back': '🏡 {name} 回来了！', 'b.day.backLv': '🏡 {name} 回来了，长到了 Lv {lv}！', 'b.day.gotEgg': '🥚 得到了一个蛋！放在队伍里走路就会孵出来',
      // 手册的出没地点
      'b.hab.weed': '海草', 'b.hab.cave': '洞穴', 'b.hab.grass': '草丛', 'b.hab.water': '水上 / 钓鱼',
      'b.hab.one': '<b>{name}</b>（{how}）', 'b.hab.more': ' 等 {n} 个地方', 'b.hab.legend': '传说中的怪兽，只在特别的地方出现。', 'b.hab.starter': '回声博士的研究所。',
      'b.hab.from': '由 <b>{from}</b> 进化而来。', 'b.hab.fromAt': '由 <b>{from}</b> 进化而来；{base} 在 <b>{place}</b> 出没。',
      'b.hab.sight': '平时在野外很难遇到，偶尔会出现在回声博士告示板的「🔎 今日目击」里。', 'b.hab.none': '在第一年的群岛上还没有发现它。', 'b.hab.t': '📍 出没地点：',
      // 队伍、电脑箱子、背包
      'b.inTeam': '队伍中', 'b.tiredOut': ' · 累倒了', 'b.more': '详情', 'b.lead': '⭐ 主力', 'b.setLead': '设为主力',
      'b.team.t': '我的队伍 {n} / {max}', 'b.team.p': '主力先出场，倒下后队友自动接上。', 'b.team.box': '💻 电脑箱子里还有 {n} 只怪兽，去休息站的电脑可以换进队伍。',
      'b.pc.bench': '存进箱子', 'b.pc.join': '放进队伍', 'b.pc.move': '搬到…', 'b.pc.sort': '排序：', 'b.pc.lv': '等级', 'b.pc.no': '编号', 'b.pc.name': '名字',
      'b.pc.t': '💻 怪兽箱子', 'b.pc.p': '队伍最多 {team} 只；{boxes} 个箱子，每个放 {cap} 只。', 'b.pc.full': '队伍满了，先存一只进箱子再取。', 'b.pc.team': '队伍 {n} / {max}',
      'b.pc.box': '箱子 {n} Box {n}（{have} / {cap}）', 'b.pc.empty': '这个箱子是空的。', 'b.pc.close': '关闭电脑', 'b.pc.moveT': '把 {name} 搬到哪个箱子？', 'b.pc.boxN': '箱子 {n}',
      'b.on': '开着', 'b.off': '关着', 'b.ride': '骑', 'b.bag.t': '🎒 背包', 'b.bag.p': '💰 {n} 金币 · 道具可以在商店买，也可以在路上捡', 'b.bag.back': '返回背包',
      'b.useOn.t': '{icon} {item} 给谁用？', 'b.item.st': '{icon} {name} 恢复正常了', 'b.item.hp': '{icon} {name} 恢复了体力',
      // 怪兽手册、回声球
      'b.dex.page': '第 {p} / {n} 页', 'b.dex.t': '怪兽手册 {a} / {b}', 'b.dex.p': '收服或进化就能点亮，遇到过的会显示影子。点一只看它的介绍。',
      'b.dex.extra': '番外', 'b.dex.caught': '已收服', 'b.dex.seen': '见过', 'b.dex.none': '未发现', 'b.legend': '传说', 'b.dex.words': '名字里的英语：', 'b.dex.lock': '收服它就能看到完整的介绍。', 'b.dex.back': '返回手册',
      'b.balls.t': '回声球 × {n}', 'b.balls.p': '把野生怪兽打虚弱后，扔回声球并念出收服咒语，就能收服它。<br>在「📚 闯关练习」每通关一关送 1 个，三星送 2 个；打败岛主送 3 个。', 'b.balls.buy': '30 金币买 3 个',
      'b.flee.wild': '要逃跑吗？', 'b.flee.t': '要放弃挑战吗？', 'b.flee.p': '这场战斗不会有奖励。', 'b.flee.go': '离开', 'b.flee.stay': '继续战斗',
    },
    en: {
      'b.zhName': ' ({zh})', 'b.q': '?', 'b.sep.list': ', ', 'b.sep.comma': ', ', 'b.sep.semi': '; ',
      'b.task': ['🗣 Say a word', '📜 Say a sentence', '💬 Answer a question'], 'b.tier': ['Small move', 'Medium move', 'Big move'],
      'b.eff.weak': 'Weak spot!', 'b.eff.barely': 'Barely works', 'b.eff.low': 'Not so good',
      'b.sup.roar': 'Their ATK↓', 'b.sup.guard': 'Your DEF↑↑', 'b.sup.power': 'Your ATK↑↑', 'b.sup.speed': 'Your SPD↑↑', 'b.sup.chill': 'Their SPD↓↓', 'b.sup.spooky': 'Their DEF↓↓',
      'b.sup.sleep': 'Puts them to sleep', 'b.sup.poison': 'Poisons them', 'b.sup.para': 'Makes them numb', 'b.sup.burn': 'Burns them', 'b.sup.confuse': 'Makes them dizzy', 'b.sup.heal': 'Heals half HP',
      'b.st.brn': 'is burned! It loses HP every turn🔥', 'b.st.psn': 'is poisoned! It loses HP every turn☠️', 'b.st.par': 'is numb! Sometimes it cannot move⚡', 'b.st.slp': 'fell asleep💤', 'b.st.frz': 'is frozen🧊', 'b.st.conf': 'is dizzy! Sometimes it hits itself😵',
      'b.item.ball': 'Catches wild monsters', 'b.item.superball': 'Catches more easily', 'b.item.potion': 'Heals 40% HP', 'b.item.superpotion': 'Heals 80% HP', 'b.item.revive': 'Brings back a tired-out monster with half HP',
      'b.item.repel': 'For 100 steps, wild monsters cannot hear you and stay away', 'b.item.rope': 'Takes you from a cave straight back to its entrance', 'b.item.antidote': 'Cures poison', 'b.item.burnheal': 'Cures burns', 'b.item.paraheal': 'Cures numbness',
      'b.item.awakening': 'Wakes up a sleeping monster', 'b.item.iceheal': 'Thaws a frozen monster', 'b.item.fullheal': 'Cures every status problem', 'b.item.expshare': 'Monsters that did not battle listen too and get half the XP',
      'b.item.rod': 'Face the water and press A to fish', 'b.item.bike': 'Ride twice as fast (🚲 button, top right)', 'b.item.dowsing': 'Hidden items flash', 'b.item.stone': 'Growth song: play it to some monsters and they grow',
      'b.item.hm': 'Echo Skill "{skill}" {icon} (Menu → Echo Skills)', 'b.item.ticket': 'Takes the ferry to another island',
      'b.boss': ['Captain Polly', 'Crabby', 'Granny Turtle', 'Principal Owl', 'Doctor Octo', 'Flo', 'Rooster Rex', 'Puffy', 'Croc', 'Sharky', 'Coach Seal', 'Whaley', 'Memory Dragon'],
      'b.fr': 'Friendship', 'b.type': '{t}', 'b.shiny': 'Rare colour', 'b.hp': 'HP', 'b.xp': 'XP',
      'b.home.new.t': 'A new adventure', 'b.home.new.p': 'You just moved to Hello Island, at the south end of the Echo Islands. The monsters here understand English: the more clearly you speak, the stronger they are.<br>Professor Echo seems to need help…',
      'b.home.start': '🌅 Start the adventure', 'b.home.clock': 'The phone date was changed. Please change it back first', 'b.home.steps': { one: 'Finish {n} more task to start the adventure', other: 'Finish {n} more tasks to start the adventure' },
      'b.home.stats': 'HP {hp} · ATK {atk}', 'b.home.evo': ' · grows at Lv {lv}',
      'b.home.mons': '🐾 My monsters {n}', 'b.home.dex': '📖 Monster Book {a}/{b}', 'b.home.balls': '🔮 Echo Balls {n}',
      'b.home.continue': 'Keep exploring', 'b.home.go': "Let's go!",
      'b.gym.t': '🏅 Next badge ({isle})', 'b.gym.p': 'Isle Master {leader} wants you to study first: beat the boss level of <b>{unit}</b> (textbook bosses {done}/{need})', 'b.gym.go': '📚 Go to Practice',
      'b.leg.t': '✨ Legend Clues', 'b.leg.name': '<b>{name}</b>: ', 'b.leg.caught': 'Caught!', 'b.leg.task': '{task} ({have}/{need})', 'b.leg.done': ' · Go outside. It will come to find you!',
      'b.home.tip': 'Walk into tall grass to meet wild monsters. Trainers on the road come to battle you when they see you.<br>Beat each town\'s Isle Master to get a badge. Then the guard lets you go to the next town. Isle Masters check your textbook first: beat the boss level of the matching unit in "📚 Practice".',
      'b.home.fly': '✈️ Fly back to a town',
      'b.home.foot': '🏅 Badges {a} / {b} · <button class="link" data-act="mBag">🎒 Bag</button> · <button class="link" data-act="report">📊 Weekly Report</button> · Each level you clear in "📚 Practice" gives 1 Echo Ball, 3 stars give 2.',
      'b.st.say': 'To make it your partner, say this to it aloud:', 'b.st.other': 'Look at another one', 'b.st.retry': 'Try again: be my partner!', 'b.st.joined': '🎉 {name} joined your team!',
      'b.mic.say': 'Tap the mic and say it aloud', 'b.mic.read': 'Tap the mic and say it aloud', 'b.mic.on': 'Listening…', 'b.mic.listen': 'Listening… It stops when you finish', 'b.mic.start': 'Start speaking',
      'b.mic.again': "I didn't catch that. A bit louder, please", 'b.mic.closer': "I didn't catch that. Come closer, speak louder and try again", 'b.mic.try': ' (try {n}/3)',
      'b.said': '🎤 I said it!', 'b.listen': '🔊 Listen', 'b.hear': 'Listen', 'b.hearModel': 'Listen to the example', 'b.hearAgain': 'Listen again', 'b.hearQ': 'Listen to the question again',
      'b.skip': 'Skip for now', 'b.skipAi': '📶 Skip for now (saved for review: say it when you are online)', 'b.heard': 'I heard: "{t}"',
      'b.need.starter': 'Choose your first monster first', 'b.need.rest': 'Your monsters are too tired. Rest at a Rest Stop first',
      'b.leave': 'Leave the battle', 'b.title.wild': 'Wild battle', 'b.title.trainer': 'Trainer {name}', 'b.title.leader': 'Isle Master {name}', 'b.title.zone': 'Area {n} · {isle}',
      'b.energy': 'Energy: fill all 3 to use a big move', 'b.foeLeft': "Opponent's monsters left",
      'b.stat.atk': 'ATK', 'b.stat.def': 'DEF', 'b.stat.spd': 'SPD', 'b.stat.atkL': 'Attack', 'b.stat.defL': 'Defence', 'b.stat.spdL': 'Speed',
      'b.in.shiny': '✨ It sparkles! ', 'b.in.wild': 'A wild <b>{name}</b>{zh} jumped out!', 'b.in.shinyToast': '✨ A rare-colour {name}! Its colours are different. That is very rare!',
      'b.in.foe': '{who}: "<b>{name}</b>, your turn!"', 'b.in.next': '{who}: "Not over yet! <b>{name}</b>, your turn!"', 'b.go': '<b>{name}</b>, your turn!', 'b.rest': '<b>{name}</b>, take a rest!',
      'b.selfWake': '{icon}{name} is fine again!', 'b.menu': 'Say the English right, and <b>{name}</b> makes a move!',
      'b.menu.c': 'Say the {lang} right, and <b>{name}</b> makes a move!', 'b.t.word.c': '🗣 Say the {lang} for the picture to use <b>{mv}</b>', 'b.talk.p.c': 'Say one {lang} sentence to it every day, and it will like you more and more. Friendship {h}',
      'b.home.new.p.c': 'You just moved to Hello Island, at the south end of the Echo Islands. The monsters here understand {lang}: the more clearly you speak, the stronger they are.<br>Professor Echo seems to need help…',
      'b.mv.strong': 'Strong', 'b.mv.low': 'Not great', 'b.mv.lock': 'Fill 3 energy first',
      'b.catch': '🔮 Catch', 'b.catch.weak': ' · weaken it first', 'b.switch': '🔄 Switch', 'b.bag': '🎒 Bag',
      'b.wake.slp': '<b>{name}</b> is asleep💤! Call it loudly. The clearer you say it, the easier it wakes up.', 'b.wake.frz': '<b>{name}</b> is frozen🧊! Call it loudly. The clearer you say it, the faster the ice melts.',
      'b.use': 'Use', 'b.back': 'Back', 'b.close': 'Close', 'b.ok': 'OK', 'b.okay': 'OK',
      'b.bbag.t': '🎒 Bag', 'b.bbag.p': 'Use an item on <b>{name}</b> (HP {hp} / {max}{st}). Using an item takes this turn.',
      'b.hpOf': 'HP {hp} / {max}', 'b.sw.go': 'Send it in', 'b.sw.t': '🔄 Which one goes in?', 'b.sw.p': 'Switching takes this turn.',
      'b.why.listen': 'not heard right', 'b.why.unheard': 'not heard clearly', 'b.why.wrong': 'the wrong answer', 'b.why.pick': 'the wrong choice', 'b.why.miss': 'not said right', 'b.why.unclear': 'not clear enough',
      'b.l.right': '👂 You heard it right! (No power hit this turn)', 'b.l.wrong': 'Not quite. Listen to the right one 👂',
      'b.noBalls': 'No Echo Balls left! Clear levels in "Practice" to get more, or buy some at the shop',
      'b.ball.t': 'Which ball?', 'b.ball.n': '🔮 Echo Ball ×{n}', 'b.ball.s': '💠 Gold Echo Ball ×{n}',
      'b.l.down': '📶 AI scoring is not working right now: ', 'b.l.ult': "listen to the opponent's question and tap the right answer", 'b.l.word': 'listen and tap the word you hear', 'b.l.sent': 'listen and tap the spell you hear', 'b.l.use': ' to use <b>{mv}</b> (no power hit this turn)',
      'b.l.owe': 'When you are online, say this one again in review', 'b.l.catch': '<b>{name}</b> is very weak. Listen for the catch spell!', 'b.l.hit': 'Listen carefully to hit!', 'b.l.toast': '📶 AI scoring is not working right now: this turn, listen and tap',
      'b.back.move': 'Choose another move',
      'b.t.word': '🗣 Say the English for the picture to use <b>{mv}</b>', 'b.hint.hear': '💡 Hear the answer (no power hit this time)', 'b.hint.see': '💡 See the answer (no power hit this time)',
      'b.blind': '🔥 Say it without looking (×1.5 damage if right)', 'b.t.mem': '🧠 Say the spell from memory to use <b>{mv}</b>', 'b.t.cue': '📜 Use the first letters, say the spell and use <b>{mv}</b>', 'b.t.sent': '📜 Say the spell aloud to use <b>{mv}</b>', 'b.t.blindOn': ' · 🔥 ×1.5 damage if right',
      'b.t.ult.mem': '💬 Big move <b>{mv}</b>: understand the question and answer aloud from memory!', 'b.t.ult.sr': '💬 Big move <b>{mv}</b>: understand the question and say the right answer aloud!', 'b.t.ult.self': '💬 Big move <b>{mv}</b>: understand the question, choose the right answer, then say it aloud!',
      'b.showOpts': '👀 See possible answers (no power hit this time)', 'b.optHear': 'Tap an answer to hear it first',
      'b.t.wake': '📣 Call it loudly!', 'b.t.catch': '🔮 Say the catch spell to put it in the Echo Ball!',
      'b.rate.0': '😅 Not good', 'b.rate.1': '🙂 OK', 'b.rate.2': '😎 Very good',
      'b.self.ult': 'First tap the right answer', 'b.self.rate': 'Say it aloud, then give yourself an honest score', 'b.self.picked': 'Right! Now say this answer aloud, then score yourself',
      'b.tip.catch': '<b>{name}</b> is very weak. Catch it now!', 'b.tip.sup': 'Say it clearly to make the support move work!', 'b.tip.hit': 'The better you say it, the more damage it does. Say it really well for a <b>power hit</b>!',
      'b.noSr': 'Speech recognition does not work here. Say it and score yourself instead',
      'b.ult.retry1': 'No match. Look at these answers and say the right one aloud (last chance, no power hit this time)', 'b.ult.retry2': 'That did not match any answer. Say it again (last chance, no power hit this time)',
      'b.retry': { one: '{n} point. Not quite. Try again (last chance{nc})', other: '{n} points. Not quite. Try again (last chance{nc})' }, 'b.retry.nc': ', no power hit this time',
      'b.rev.good': 'Very clear!', 'b.rev.hear': 'Listen to the right way to say it 👂',
      'b.faster': '<b>{name}</b> is faster and moves first!',
      'b.ca.slp': '<b>{name}</b> is fast asleep💤', 'b.ca.frz': '<b>{name}</b> is frozen and cannot move🧊', 'b.ca.woke': '<b>{name}</b> woke up!',
      'b.ca.par': '<b>{name}</b> is numb and cannot move!⚡', 'b.ca.confEnd': '<b>{name}</b> is not dizzy any more.', 'b.ca.confHit': '<b>{name}</b> is so dizzy that it hit itself!',
      'b.ca.obey': "<b>{name}</b>'s level is too high. It is not listening and just stares… (Get more badges and it will listen)",
      'b.eor.brn': '<b>{name}</b> is hurt by its burn. Ouch, hot!🔥', 'b.eor.psn': '<b>{name}</b> is hurt by the poison…☠️', 'b.got': '<b>{name}</b> {got}',
      'b.stg.maxUp': "<b>{name}</b>'s {stat} cannot go any higher.", 'b.stg.maxDown': "<b>{name}</b>'s {stat} cannot go any lower.",
      'b.stg.up2': "<b>{name}</b>'s {stat} went way up!", 'b.stg.up1': "<b>{name}</b>'s {stat} went up!", 'b.stg.down2': "<b>{name}</b>'s {stat} went way down!", 'b.stg.down1': "<b>{name}</b>'s {stat} went down!",
      'b.noEffect': 'But nothing happened…', 'b.hpFull': 'Its HP is already full.', 'b.healed': '<b>{name}</b> got its HP back!',
      'b.rule.words': '📖 Word Master rule: your small moves do ×1.5 damage', 'b.rule.listen': '👂 Listening Master rule: you have only 8 seconds to defend. Listen fast!',
      'b.rule.clear': '🗣️ Speaking Master rule: very clear speech does ×1.6 damage, OK speech only ×0.8', 'b.rule.talk': '💬 Talk Master rule: you start with 3 energy, so you can use a big move right away!',
      'b.used': '<b>{name}</b> used <b>{mv}</b>!', 'b.supFail': 'The spell was {why}, so <b>{mv}</b> failed!',
      'b.crit': 'Power hit!', 'b.lbl.mem': '🔥 From memory', 'b.lbl.block': 'Blocked',
      'b.hit.critBlind': 'Perfect without looking: <b>power hit</b>! ', 'b.hit.crit': 'Perfect speaking: <b>power hit</b>! ', 'b.hit.blind': '🔥 Right without looking: ×1.5 power! ', 'b.hit.graze': 'The spell was a bit unclear. It only scratched it. ', 'b.hit.ok': 'Hit! ',
      'b.hit.weak': 'A weak spot!', 'b.hit.low': 'It did not work well.', 'b.miss': 'The spell was {why}. The attack missed!',
      'b.wk.slp': '<b>{name}</b> woke up! It can move next turn.', 'b.wk.frz': 'The ice on <b>{name}</b> melted! It can move next turn.',
      'b.wk.no.slp': '<b>{name}</b> is still asleep… {tip}', 'b.wk.no.frz': '<b>{name}</b> is still frozen… {tip}', 'b.wk.tip.clear': 'Call more clearly!', 'b.wk.tip.next': 'Try again next turn.',
      'b.foePotion': '{who} gave <b>{name}</b> a potion!',
      'b.def.msg': '<b>{name}</b> is going to use <b>{mv}</b>{zh}! Understand its spell to defend!', 'b.def.msgUlt': '<b>{name}</b> is going to use <b>{mv}</b>{zh}! <b>It is a big move!</b> Understand its spell to defend!',
      'b.def.h': '🛡️ What does its spell mean? Choose right to block it', 'b.def.hEn': '🛡️ Which spell did it say? Choose right to block it',
      'b.def.ok': '🛡️ <b>Blocked!</b> ', 'b.def.okSup': 'Its move did nothing.', 'b.def.okHit': 'Only a little damage.', 'b.def.late': '⏰ Too late! ', 'b.def.wrong': 'Not quite… ', 'b.def.ans': 'It said: <b>{ans}</b>',
      'b.hold': '💖 <b>{name}</b> thought of you and did not give up!',
      'b.lvup': '⬆️ {name} reached Lv {lv}!', 'b.learned': '✨ {name} learned {mv}!',
      'b.learn.t': '{name} can learn a new move!', 'b.learn.p': 'It already knows 4 moves. Which one should it drop for <b>{mv}</b>?', 'b.learn.no': "Don't learn it",
      'b.learn.skip': '{name} did not learn {mv}', 'b.learn.ok': 'OK, {mv} is dropped!', 'b.learn.say': 'Now teach it the new move aloud:',
      'b.learn.ai': '📶 AI scoring is not working right now. It learns the move anyway', 'b.learn.again': 'A bit more clearly. Say it once more!',
      'b.tired': '<b>{name}</b> is too tired to go on!', 'b.down': '<b>{name}</b> is too tired…',
      'b.throw': 'You threw an Echo Ball!', 'b.throw.s': 'You threw a Gold Echo Ball!', 'b.caught': '🎉 Caught! <b>{name}</b>{zh} is your new friend!',
      'b.free': 'Oh no, <b>{name}</b> broke free! ', 'b.free.say': 'Say the catch spell more clearly.', 'b.free.weak': 'Make it weaker, or make it sleep or go numb, then try again.',
      'b.win.badge': '🏅 You got the {isle} badge!', 'b.win.balls': '🔮 Echo Balls +3', 'b.win.obey': '🐾 Monsters up to Lv {n} will listen to you', 'b.win.unlock': '🏝️ New area open: {isle}',
      'b.win.coins': '💰 Coins +{n}', 'b.win.xp': '⭐ Monsters that battled got XP +{n}', 'b.win.share': ' (Team Headset: the rest of the team got half)',
      'b.win.box': 'Your team already has 6 monsters, so your new friend went to the Monster Box (swap it at a Rest Stop computer).', 'b.win.team': 'Your new friend joined your team!',
      'b.win.leader': '{who}: "You are amazing! This badge is yours!"', 'b.win.trainer': '{who}: "You are really good!"', 'b.win': 'You won!',
      'b.res.caught': 'Caught!', 'b.res.leader': 'You beat the Isle Master!', 'b.res.go': 'Keep exploring ▶', 'b.res.again': '⚔️ Battle again', 'b.res.home': 'Home',
      'b.streak': { one: '🔥 Today counts! {n} day in a row', other: '🔥 Today counts! {n} days in a row' },
      'b.lose': 'Your monsters are all too tired…', 'b.lose.t': 'Rest at a Rest Stop first',
      'b.lose.p': 'A Rest Stop brings back HP and cures status problems.<br>Tip: battle wild monsters in the grass to level up,<br>use moves that are <b>strong against</b> your opponent, or use a support move first to lower its attack.', 'b.lose.go': 'Go to the Rest Stop',
      'b.potion.hp': 'You used {item}! <b>{name}</b> got its HP back.', 'b.potion.st': 'You used {item}! <b>{name}</b> is back to normal.',
      'b.evo.t': 'Look! {name} is growing up…', 'b.evo.p': '{name} is growing!', 'b.evo.ok': 'Great!', 'b.evo.done': 'Great! <b>{from}</b> grew into <b>{to}</b>{zh}!',
      'b.egg': 'Egg', 'b.egg.tip': 'Walk with it and it will slowly grow and hatch.',
      'b.egg.far': 'It looks like it will take a long time to hatch.', 'b.egg.mid': 'Something is moving inside!', 'b.egg.near': 'It will hatch soon! It is moving around inside.',
      'b.sum.evoLv': 'Lv {lv}: grows into {name}', 'b.sum.xp': 'XP {a} / {b}', 'b.sum.hp': 'HP', 'b.sum.atk': 'ATK', 'b.sum.def': 'DEF', 'b.sum.spd': 'SPD',
      'b.sum.moves': 'Moves', 'b.sum.next': 'Can learn later: {list}', 'b.sum.evo': 'Grows: {list}',
      'b.talk.done': '💬 Talked today', 'b.talk.go': '💬 Talk to it', 'b.nick.btn': '✏️ Name it',
      'b.nick.t': 'Give {name} an English name!', 'b.nick.p': 'Pick one, or type your own.', 'b.nick.ph': 'Type an English name', 'b.nick.tip': 'English letters only, up to 10',
      'b.nick.keep': 'No change', 'b.nick.use': 'Keep the name {name}', 'b.nick.clear': 'Go back to {name}', 'b.nick.say': 'Tell it its new name aloud:', 'b.nick.back': 'Choose another name',
      'b.nick.done': 'Its name is now {name}!', 'b.nick.orig': 'It has its old name again', 'b.nick.ai': '📶 AI scoring is not working right now. The name is saved anyway', 'b.nick.bad': 'Please use English letters, like Kiki',
      'b.score.again': { one: '{n} point. A bit more clearly!', other: '{n} points. A bit more clearly!' },
      'b.mood': ['It looks at you a little shyly.', 'It tilts its head and listens to you.', 'It happily turns around.', 'It rubs against your hand.', 'It jumps for joy!', 'It stays close to you. It loves you most!💖'],
      'b.talk.later': 'You already talked today. Come back and talk to it tomorrow.', 'b.talk.t': 'Talk to {name}', 'b.talk.p': 'Say one English sentence to it every day, and it will like you more and more. Friendship {h}', 'b.talk.no': 'Not now',
      'b.talk.close': 'A very close monster sometimes keeps going when it is about to fall, and hits a little harder.', 'b.talk.ok': '😊 OK',
      'b.day.take': 'Take back', 'b.day.good': '💞 They get along well (they share a type).', 'b.day.bad': 'They do not get along (no shared type). There will be no egg.', 'b.day.leave': 'Leave here',
      'b.day.t': '🏡 Monster Daycare', 'b.day.p': 'Leave two monsters here. They grow up with Grandpa and Grandma (1 level every 100 steps). If they share a type, you may find an egg after a while!',
      'b.day.egg': 'An egg was found!', 'b.day.egg.s': 'Your two monsters left it', 'b.day.eggTake': 'Take it', 'b.day.in': 'Staying here {n} / 2', 'b.day.none': 'No monsters are staying here yet.',
      'b.day.pick': 'Choose one from your team', 'b.day.keep': 'Keep at least one monster in your team that can battle.', 'b.day.thanks': 'Thank you!',
      'b.day.back': '🏡 {name} is back!', 'b.day.backLv': '🏡 {name} is back and reached Lv {lv}!', 'b.day.gotEgg': '🥚 You got an egg! Keep it in your team and walk, and it will hatch',
      'b.hab.weed': 'seaweed', 'b.hab.cave': 'cave', 'b.hab.grass': 'tall grass', 'b.hab.water': 'on the water / fishing',
      'b.hab.one': '<b>{name}</b> ({how})', 'b.hab.more': ' and more ({n} places)', 'b.hab.legend': 'A legendary monster. It only appears in special places.', 'b.hab.starter': "Professor Echo's lab.",
      'b.hab.from': 'Grows from <b>{from}</b>.', 'b.hab.fromAt': 'Grows from <b>{from}</b>. {base} lives in <b>{place}</b>.',
      'b.hab.sight': 'Hard to meet in the wild. It sometimes shows up in "🔎 Today\'s Sighting" on Professor Echo\'s notice board.', 'b.hab.none': 'Nobody has found it on the first-year islands yet.', 'b.hab.t': '📍 Where to find it: ',
      'b.inTeam': 'In team', 'b.tiredOut': ' · too tired', 'b.more': 'Details', 'b.lead': '⭐ Lead', 'b.setLead': 'Make lead',
      'b.team.t': 'My team {n} / {max}', 'b.team.p': 'Your lead goes first. When it is too tired, the next one comes in.',
      'b.team.box': { one: '💻 There is {n} more monster in the Monster Box. Use the computer at a Rest Stop to swap it in.', other: '💻 There are {n} more monsters in the Monster Box. Use the computer at a Rest Stop to swap them in.' },
      'b.pc.bench': 'Put in box', 'b.pc.join': 'Add to team', 'b.pc.move': 'Move to…', 'b.pc.sort': 'Sort: ', 'b.pc.lv': 'Level', 'b.pc.no': 'Number', 'b.pc.name': 'Name',
      'b.pc.t': '💻 Monster Box', 'b.pc.p': 'Your team holds up to {team} monsters. There are {boxes} boxes with {cap} spaces each.', 'b.pc.full': ' Your team is full. Put one in a box first.', 'b.pc.team': 'Team {n} / {max}',
      'b.pc.box': 'Box {n} ({have} / {cap})', 'b.pc.empty': 'This box is empty.', 'b.pc.close': 'Turn off the computer', 'b.pc.moveT': 'Move {name} to which box?', 'b.pc.boxN': 'Box {n}',
      'b.on': 'On', 'b.off': 'Off', 'b.ride': 'Ride', 'b.bag.t': '🎒 Bag', 'b.bag.p': '💰 {n} coins · Buy items at the shop or find them on the road', 'b.bag.back': 'Back to Bag',
      'b.useOn.t': '{icon} Use {item} on which monster?', 'b.item.st': '{icon} {name} is back to normal', 'b.item.hp': '{icon} {name} got its HP back',
      'b.dex.page': 'Page {p} / {n}', 'b.dex.t': 'Monster Book {a} / {b}', 'b.dex.p': 'Catch or grow a monster to fill in its page. Monsters you have seen show as a shadow. Tap one to read about it.',
      'b.dex.extra': 'Extra', 'b.dex.caught': 'Caught', 'b.dex.seen': 'Seen', 'b.dex.none': 'Not found yet', 'b.legend': 'Legend', 'b.dex.words': 'English in its name: ', 'b.dex.lock': 'Catch it to read its full entry.', 'b.dex.back': 'Back to the Book',
      'b.balls.t': 'Echo Balls × {n}', 'b.balls.p': 'Make a wild monster weak, throw an Echo Ball and say the catch spell to catch it.<br>Each level you clear in "📚 Practice" gives 1, 3 stars give 2, and beating an Isle Master gives 3.', 'b.balls.buy': 'Buy 3 for 30 coins',
      'b.flee.wild': 'Run away?', 'b.flee.t': 'Give up this battle?', 'b.flee.p': 'You get no reward from this battle.', 'b.flee.go': 'Leave', 'b.flee.stay': 'Keep battling',
    },
  });
  // 岛主的名字：数据里只有中文名（data.js 的 boss.name），别的界面语言用字表里的英文名
  const bossName = z => { const L = !isZh() && I18N.raw('b.boss'); return (L && L[z]) || E.W[z].boss.name; };
  // 小岛的名字：中文界面用 data.js 的名字（和以前一样），别的语言用小镇地图的英文名（Hello Island……）
  const isleName = z => { if (isZh() || !window.EchoMaps) return E.W[z].name; const m = EchoMaps.get('t' + z); return (m && m.en) || E.W[z].name; };
  // 「先跳过」：中文界面照旧用 game.js 的那句（phase B 以后 game.js 自己换语言）
  const skipTxt = () => (isZh() ? E.SKIP_TXT || tx('b.skip') : tx('b.skipAi'));

  // ---------- 怪兽手册（数据在 dex.js：全部原创怪兽、17 种属性、招式、进化曲） ----------
  const D = window.DEX;
  const TYPES = D.TYPES;
  const SPECIES = D.byId;
  // 手册的顺序：有编号的在前（D.main，算总数），家庭版的番外（D.extra，等重画的几只）放最后、不算总数
  const ORDER = D.main.map(s => s.id).concat(D.extra.map(s => s.id));
  const COUNTED = new Set(D.main.map(s => s.id));
  const STARTERS = ['emberpup', 'bubbly', 'sprouty'];
  const MOVES = D.MOVES;
  const POWER = [1.0, 1.6, 2.6];
  const TASK = k => (I18N ? I18N.raw('b.task') || [] : [])[k] || '';   // 招式按钮上的「说单词 / 念句子 / 对话大招」
  const DOTS = ['●○○', '●●○', '●●●'];
  const STRONG = {}; D.ORDER.forEach(t => { STRONG[t] = (D.CHART[t].strong || []).slice(); });
  // 属性克制：招式属性打对手（对手可能是双属性）
  const eff = (atkType, defId) => D.eff(atkType, SPECIES[defId].types);
  const effLabel = e => e > 1 ? tx('b.eff.weak') : e < .4 ? tx('b.eff.barely') : e < 1 ? tx('b.eff.low') : '';
  // ---------- 招式 ----------
  // 招式编号：攻击招式 "fire:1"（属性:小招0/中招1/大招2），辅助招式 "s:sleep"
  const SUP = {
    roar: { en: 'Big Roar', zh: '大吼', type: 'normal', fx: { foe: { atk: -1 } } },
    guard: { en: 'Iron Guard', zh: '铁甲护身', type: 'steel', fx: { self: { def: 2 } } },
    power: { en: 'Power Up', zh: '鼓足劲', type: 'fight', fx: { self: { atk: 2 } } },
    speed: { en: 'Speed Up', zh: '加速', type: 'flying', fx: { self: { spd: 2 } } },
    chill: { en: 'Cold Wind', zh: '寒风', type: 'ice', fx: { foe: { spd: -2 } } },
    spooky: { en: 'Spooky Face', zh: '鬼脸', type: 'ghost', fx: { foe: { def: -2 } } },
    sleep: { en: 'Sleepy Song', zh: '催眠曲', type: 'grass', status: 'slp' },
    poison: { en: 'Poison Mist', zh: '毒雾', type: 'poison', status: 'psn' },
    para: { en: 'Static Zap', zh: '麻痹电', type: 'spark', status: 'par' },
    burn: { en: 'Hot Breath', zh: '灼热吐息', type: 'fire', status: 'brn' },
    confuse: { en: 'Dizzy Dance', zh: '眩晕舞', type: 'psychic', status: 'conf' },
    heal: { en: 'Sweet Rest', zh: '甜蜜休息', type: 'water', heal: .45 },
  };
  // 说明（desc）按界面语言现取：字表 b.sup.<id>
  Object.keys(SUP).forEach(k => Object.defineProperty(SUP[k], 'desc', { get: () => tx('b.sup.' + k), enumerable: true }));
  const SUP_OF = { normal: 'roar', fire: 'burn', water: 'heal', grass: 'sleep', spark: 'para', ice: 'chill', fight: 'power', poison: 'poison', ground: 'guard', flying: 'speed', psychic: 'confuse', bug: 'poison', rock: 'guard', ghost: 'spooky', dragon: 'power', dark: 'spooky', steel: 'guard' };
  const STATUS = {
    brn: { zh: '烧伤', en: 'Burn', color: '#f0642f' },
    psn: { zh: '中毒', en: 'Poison', color: '#9b4dca' },
    par: { zh: '麻痹', en: 'Numb', color: '#d9a000' },
    slp: { zh: '睡眠', en: 'Sleep', color: '#5c6bc0' },
    frz: { zh: '冰冻', en: 'Frozen', color: '#4fc3e8' },
    conf: { zh: '混乱', en: 'Dizzy', color: '#ec407a' },
  };
  // 陷入这种状态时的那句话（got）按界面语言现取：字表 b.st.<状态>
  Object.keys(STATUS).forEach(k => Object.defineProperty(STATUS[k], 'got', { get: () => tx('b.st.' + k), enumerable: true }));
  function parseMove(id) {
    if (id.startsWith('s:')) { const sup = SUP[id.slice(2)]; return { id, sup, type: sup.type, tier: 1 }; }
    const [type, t] = id.split(':');
    return { id, type, tier: +t };
  }
  const mvName = mv => mv.sup ? [mv.sup.en, mv.sup.zh] : MOVES[mv.type][mv.tier];
  // 学招表：Lv1 本属性小招 + 普通小招，Lv9 辅助招式，Lv15 本属性中招，Lv21 第二属性（或普通）中招，Lv28 本属性大招……
  const learnCache = {};
  function learnset(s) {
    if (learnCache[s.id]) return learnCache[s.id];
    const t1 = s.types[0], t2 = s.types[1], alt = t1 === 'normal' ? 'fight' : 'normal';
    const L = [[1, t1 + ':0'], [1, alt + ':0'], [9, 's:' + SUP_OF[t1]], [15, t1 + ':1'], [21, (t2 || alt) + ':1'], [28, t1 + ':2']];
    if (t2 && SUP_OF[t2] !== SUP_OF[t1]) L.push([34, 's:' + SUP_OF[t2]]);
    L.push([40, t2 ? t2 + ':2' : 's:' + (SUP_OF[t1] === 'heal' ? 'guard' : 'heal')]);
    return (learnCache[s.id] = L);
  }
  // 按等级应该会的招式：学过的里面最新的 4 个
  function defaultMoves(sp, lv) { const got = learnset(SPECIES[sp]).filter(([l]) => l <= lv).map(([, id]) => id); return got.filter((id, i) => got.indexOf(id) === i).slice(-4); }
  function ensureMoves(mon) { if (mon && (!mon.moves || !mon.moves.length)) mon.moves = defaultMoves(mon.sp, mon.lv); return mon; }
  const movesOf = mon => ensureMoves(mon).moves.map(parseMove);
  // 进化：等级到了（lv）或者听了进化曲（item）
  const lvEvo = mon => (SPECIES[mon.sp].evo || []).find(e => e.lv && mon.lv >= e.lv);
  const itemEvo = (mon, item) => (SPECIES[mon.sp].evo || []).find(e => e.item === item);
  const CATCH_LINES = ['Come with me!', "Let's be friends!", 'Welcome to my team!', 'You are my new friend!'];
  const TEAM_MAX = 6;
  // 背包道具。回声球和药水沿用老存档里的 balls / potions，其余放在 bag 里
  const ITEMS = {
    ball: { zh: '回声球', en: 'Echo Ball', icon: '🔮', price: 10 },
    superball: { zh: '金回声球', en: 'Gold Echo Ball', icon: '💠', price: 25 },
    potion: { zh: '药水', en: 'Potion', icon: '🧪', price: 20, heal: 0.4 },
    superpotion: { zh: '大瓶药水', en: 'Big Potion', icon: '💊', price: 40, heal: 0.8 },
    revive: { zh: '元气果', en: 'Energy Fruit', icon: '🍑', price: 60 },
    repel: { zh: '悄悄喷雾', en: 'Quiet Spray', icon: '🧴', price: 30 },
    rope: { zh: '回程绳', en: 'Return Rope', icon: '🪢', price: 25 },
  };
  Object.assign(ITEMS, {
    antidote: { zh: '薄荷茶', en: 'Mint Tea', icon: '🍵', price: 15 },
    burnheal: { zh: '冰凉膏', en: 'Cool Gel', icon: '🧯', price: 20 },
    paraheal: { zh: '活力贴', en: 'Move Patch', icon: '🟡', price: 20 },
    awakening: { zh: '闹钟铃', en: 'Alarm Bell', icon: '🔔', price: 20 },
    iceheal: { zh: '暖暖包', en: 'Warm Pack', icon: '🔥', price: 20 },
    fullheal: { zh: '彩虹糖', en: 'Rainbow Candy', icon: '🍬', price: 50 },
    expshare: { zh: '共学耳机', en: 'Team Headset', icon: '🎧', price: 0, key: true },
    rod: { zh: '钓竿', en: 'Fishing Rod', icon: '🎣', price: 150, key: true },
    bike: { zh: '自行车', en: 'Bike', icon: '🚲', price: 300, key: true },
    dowsing: { zh: '回声探测器', en: 'Echo Finder', icon: '📟', price: 200, key: true },
  });
  Object.entries(D.STONES).forEach(([id, st]) => { ITEMS[id] = { zh: st.zh, en: st.en, icon: st.icon, price: 120, stone: true }; });
  // 回声贝：剧情里的人送的重要物品，贴在耳边能听见一种回声技能；有了它再拿够徽章，就能在野外用（id 沿用老存档的 hm_*）
  // 回声技能只有四种（2026-10-08 按评审改）：开路（1–3 级：砍小树 / 敲碎裂石 / 推大石头）、点灯、水路（1–3 级：在水上走 / 潜到海底 / 爬上瀑布）、乘风。
  // 后面几级的回声贝是给已有技能升级。名字和 world.js 的 SKILLS 一致
  // @i18n-content 回声技能的中英文名是一对数据（界面上用 EchoI18n.label 按语言取）；tools/voice/collect.js 按 [id, 中文, 英文, 图标] 这个形状找英文名，不改形状
  [['cut', '开路', 'Clear Way', '🌿'], ['flash', '点灯', 'Light Up', '💡'], ['smash', '开路 2 级', 'Clear Way 2', '🪨'], ['strength', '开路 3 级', 'Clear Way 3', '💪'],
    ['surf', '水路', 'Water Way', '🌊'], ['fly', '乘风', 'Sky Ride', '🕊️'], ['dive', '水路 2 级', 'Water Way 2', '🤿'], ['falls', '水路 3 级', 'Water Way 3', '🏞️']].forEach(([k, zh, en, icon]) => {
    ITEMS['hm_' + k] = { zh: '回声贝 · ' + zh, en: 'Echo Shell: ' + en, icon: '🐚', price: 0, skill: { zh, en, icon }, key: true, hm: true };
  });
  // @i18n-content-end
  ITEMS.ticket = { zh: '船票', en: 'Ferry Ticket', icon: '🎫', price: 0, key: true };
  // 道具说明（desc）按界面语言现取（world.js 的商店也读 it.desc）：进化曲一句、回声贝带技能名、其余字表 b.item.<id>
  Object.keys(ITEMS).forEach(id => { const it = ITEMS[id]; Object.defineProperty(it, 'desc', { get: () => (it.stone ? tx('b.item.stone') : it.hm ? tx('b.item.hm', { skill: label(it.skill), icon: it.skill.icon }) : tx('b.item.' + id)), enumerable: true }); });
  const BAG_ORDER = ['expshare', 'hm_cut', 'hm_flash', 'hm_smash', 'hm_strength', 'hm_surf', 'hm_fly', 'hm_dive', 'hm_falls', 'ticket', 'bike', 'rod', 'dowsing','ball', 'superball', 'potion', 'superpotion', 'revive', 'antidote', 'burnheal', 'paraheal', 'awakening', 'iceheal', 'fullheal', 'repel', 'rope'].concat(Object.keys(D.STONES));
  function itemCount(id) { const m = M(); return id === 'ball' ? m.balls : id === 'potion' ? (m.potions || 0) : ((m.bag || {})[id] || 0); }
  function addItem(id, n) {
    const m = M();
    if (id === 'ball') m.balls += n;
    else if (id === 'potion') m.potions = (m.potions || 0) + n;
    else { m.bag = m.bag || {}; m.bag[id] = Math.max(0, (m.bag[id] || 0) + n); }
  }
  let FH = null; // 大地图提供的道具效果（悄悄喷雾、回程绳）

  // 能力值：手册给了体力和攻击；防御和速度按身体类型和属性推出来（同一种怪兽永远一样）
  const BODY_DEF = { golem: 1.35, shell: 1.4, quad: 1.05, dragon: 1.1, serpent: 1, blob: .95, biped: .95, bird: .8, fish: .9, bug: .85, ghost: .9, plant: 1 };
  const BODY_SPD = { bird: 1.35, fish: 1.15, bug: 1.2, serpent: 1.05, quad: 1.15, biped: 1.05, blob: .9, ghost: 1.1, dragon: 1.05, plant: .75, golem: .6, shell: .55 };
  const TYPE_DEF = { steel: .25, rock: .2, ground: .1, bug: -.05, psychic: -.1, flying: -.05 };
  const TYPE_SPD = { spark: .2, flying: .2, psychic: .1, dark: .1, fight: .05, steel: -.15, rock: -.15, ground: -.05 };
  function baseStats(s) {
    if (s._b) return s._b;
    const h = (s.sd || 0) / 1000;   // sd：每种怪兽固定的小浮动（tools/build-dex.js 生成）
    const td = s.types.reduce((a, t) => a + (TYPE_DEF[t] || 0), 0), ts = s.types.reduce((a, t) => a + (TYPE_SPD[t] || 0), 0);
    return (s._b = { hp: s.hp, atk: s.atk, def: Math.round(s.atk * (BODY_DEF[s.b] || 1) * (1 + td) * (.9 + h * .2)), spd: Math.round(s.atk * (BODY_SPD[s.b] || 1) * (1 + ts) * (1.1 - h * .2)) });
  }
  const stats = m => { const b = baseStats(SPECIES[m.sp]); return { hp: b.hp + m.lv * 6, atk: b.atk + m.lv * 2, def: b.def + m.lv * 2, spd: b.spd + m.lv * 2 }; };
  const xpNeed = lv => lv * 20;
  const zoneLv = z => 2 + z * 2;
  const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newMon = (sp, lv) => ({ uid: uid(), sp, lv, xp: 0, moves: defaultMoves(sp, lv) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let E = null;   // game.js 提供的工具
  let B = null;   // 当前战斗
  const live = b => B === b && !b.over;
  const M = () => E.S.mon;
  // 怪兽图：3D 模型截图（cartoon.js 的 monster() 会自动用 Mon3D）
  const svg = sp => window.Cartoon ? Cartoon.monster(SPECIES[sp]) : '';
  // 属性小图标（SVG，不依赖手机的 emoji 字体）
  const TICON = {}; D.ORDER.forEach(t => { TICON[t] = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + TYPES[t].icon + '" fill="currentColor"/></svg>'; });
  const tchip = t => '<span class="tchip" style="--tc:' + TYPES[t].color + '">' + TICON[t] + hx('b.type', { t: label(TYPES[t]) }) + '</span>';
  // 颜色很浅的属性（电、飞行、普通、冰……）招式按钮上用深色字，白字看不清
  const LIGHT = {};
  D.ORDER.forEach(t => { const n = parseInt(TYPES[t].color.slice(1), 16), lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; LIGHT[t] = .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255) > .32; });
  const chips = id => SPECIES[id].types.map(tchip).join('');

  // ---------- 养成：英文昵称、亲密度、稀有色、蛋 ----------
  const SHINY_RATE = 1 / 64;          // 野外遇到稀有色的机会（给孩子玩，故意定得高一点）
  const nm = mon => (mon && mon.nick) || SPECIES[mon.sp].en;
  // 名字后面的小字：起了昵称就写原来的英文名，再加中文名（中文界面才有）
  const subName = mon => { const s = SPECIES[mon.sp]; return [mon.nick ? s.en : '', gloss(s) || ''].filter(Boolean).join(' · '); };
  const frOf = mon => mon.fr == null ? 70 : mon.fr;
  const hearts = mon => Math.min(5, Math.floor(frOf(mon) / 51));
  const heartsHTML = mon => '<span class="frh" title="' + hx('b.fr') + '">' +[0, 1, 2, 3, 4].map(k => k < hearts(mon) ? '♥' : '♡').join('') + '</span>';
  function befriend(mon, n) { if (mon && !mon.egg) mon.fr = Math.max(0, Math.min(255, frOf(mon) + n)); }
  // 颜色转一个角度（稀有色用）；灰白的颜色不动
  function hueShift(hex, deg) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const n = parseInt(hex.slice(1, 7), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < .08) return hex;
    const sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h / 6 + deg / 360) % 1;
    const q = l < .5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
    const f = t => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < .5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  const SHINY_SP = {};
  // 画这只怪兽用的手册数据：稀有色的换一套颜色
  function spOf(mon) {
    const sp = SPECIES[mon.sp];
    if (!mon.shiny) return sp;
    return SHINY_SP[sp.id] || (SHINY_SP[sp.id] = Object.assign({}, sp, { id: sp.id + '_shiny', c: hueShift(sp.c, 150), a: hueShift(sp.a, 150), shiny: true }));
  }
  const EGG_SVG = '<svg class="mon-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="58" rx="16" ry="4" fill="rgba(0,0,0,.18)"/><path d="M32 6C20 6 12 26 12 38a20 20 0 0 0 40 0C52 26 44 6 32 6z" fill="#fffbef" stroke="#2b2b3a" stroke-width="3"/><circle cx="24" cy="30" r="4" fill="#9ccc65"/><circle cx="38" cy="22" r="3" fill="#ffb74d"/><circle cx="40" cy="42" r="5" fill="#64b5f6"/><circle cx="26" cy="46" r="3" fill="#f48fb1"/></svg>';
  const svgMon = mon => mon.egg ? EGG_SVG : window.Cartoon ? Cartoon.monster(spOf(mon)) : '';
  // 从哪一只进化来的：一直往回找到第一阶段
  const baseOf = id => { let x = SPECIES[id]; while (x.from && SPECIES[x.from]) x = SPECIES[x.from]; return x.id; };
  let B3 = null;   // 3D 战斗画面（battle3d.js）
  let RO = null;   // 盯着战场大小的 ResizeObserver
  // 会动的 3D 模型（assets/mon3d）：出场前先下载，最多等 2.5 秒，没下完就先用程序拼的模型
  const prep = sps => window.Mon3D && Mon3D.preload ? Promise.race([Mon3D.preload(sps).catch(() => {}), sleep(2500)]) : Promise.resolve();
  const teamSps = () => M().team.map(byUid).filter(m => m && !m.egg).map(spOf);
  function preloadTeam() { if (window.Mon3D && Mon3D.preload) Mon3D.preload(teamSps()); }
  // 3D 战斗里换上刚下载好的模型（出场前调用，这时候怪兽还藏着）。
  // B.rig3[side]：true 放的是会动的模型；false 放的是程序拼的 / 纸片；没有 = 开战时模型还在下载，先没放（见 renderBattle），这里补上
  function upgrade3D() {
    if (!B3 || !B || !window.Mon3D || !Mon3D.isLoaded) return;
    B.rig3 = B.rig3 || {};
    [['me', me()], ['foe', foe()]].forEach(([side, mon]) => {
      const sp = spOf(mon);
      if (B.rig3[side] === undefined || (!B.rig3[side] && Mon3D.hasModel(sp) && Mon3D.isLoaded(sp))) { B3.setMon(side, sp, true); B.rig3[side] = !!Mon3D.isLoaded(sp); }
    });
  }
  // 战斗背景：天空、云、远山、草地（雪地小镇换成白色）
  function arenaBG(z) {
    const w = E.W[z], snow = z === 11;
    let stripes = '';
    for (let i = 0; i < 6; i++) stripes += '<path d="M0 ' + (188 + i * 20) + ' H400" stroke="' + (snow ? '#e3ecf2' : '#a9da8b') + '" stroke-width="3"/>';
    return '<svg class="arena-bg" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (snow ? '#c3d8e8' : '#9ed8ff') + '"/><stop offset="1" stop-color="#f3fbff"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#bsky)"/>' +
      '<g fill="#fff" opacity=".92"><ellipse cx="70" cy="42" rx="34" ry="11"/><ellipse cx="94" cy="35" rx="21" ry="12"/><ellipse cx="305" cy="62" rx="30" ry="9"/><ellipse cx="326" cy="56" rx="17" ry="10"/></g>' +
      '<path d="M0 150 Q60 108 130 136 T260 124 T400 132 V300 H0Z" fill="' + w.color + '" opacity=".32"/>' +
      '<path d="M0 172 Q90 138 190 162 T400 152 V300 H0Z" fill="' + (snow ? '#e9f1f6' : '#97d276') + '"/>' +
      '<rect y="176" width="400" height="124" fill="' + (snow ? '#f5f9fb' : '#b5e399') + '"/>' + stripes + '</svg>';
  }
  // 命中特效：火花 / 泡泡 / 叶子 / 闪电
  function burst(id, type, big) {
    if (E.reduced) return;
    const arena = $('b-arena'); if (!arena || !$(id)) return;
    const [x, y] = center(id), n = big ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'fx fx-' + type;
      const a = Math.random() * Math.PI * 2, d = 28 + Math.random() * (big ? 70 : 50);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d - (type === 'fire' ? 26 : type === 'water' ? 14 : 0)).toFixed(1) + 'px');
      p.style.setProperty('--r', Math.round(Math.random() * 540) + 'deg');
      p.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
      arena.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
    if (type === 'spark' || big) { const f = document.createElement('i'); f.className = 'fx-flash'; arena.appendChild(f); setTimeout(() => f.remove(), 420); }
  }
  const byUid = u => M().box.find(m => m.uid === u);
  const lead = () => M().team.map(byUid).find(m => m && !m.egg) || M().box.find(m => !m.egg);
  // 手册里点亮了几种：只数有编号的（番外不算）
  const caughtN = () => ORDER.filter(id => COUNTED.has(id) && M().dex[id] === 'caught').length;

  // ---------- 基地（首页“怪兽冒险”标签） ----------
  function homeHTML() {
    const m = M(), esc = E.esc;
    if (!m.box.length) {
      return '<section class="mon-card starter-pick new-game"><div class="ng-mons">' + STARTERS.map(id => '<span class="st-svg">' + svg(id) + '</span>').join('') + '</div>' +
        '<h2>' + hx('b.home.new.t') + '</h2><p>' + hx('b.home.new.p') + '</p>' +
        '<button class="btn sun wide world-go" data-act="wEnter">' + hx('b.home.start') + '</button></section>';
    }
    const L = lead(), s = SPECIES[L.sp], st = stats(L);
    // 学习锁：锁着时两个小任务和锁着的按钮放在最上面，一眼就看到；开了就放在怪兽卡片下面
    const g = E.gate ? E.gate() : { open: true }, lock = E.gateCard ? E.gateCard() : '';
    const lockedBtn = '<button class="btn wide world-go locked" data-act="wEnter">🔒 ' + (g.back ? hx('b.home.clock') : hx('b.home.steps', { n: g.steps || 1 })) + '</button>';
    // 现在该去哪、做什么（评估第 14 条）：冒险按钮下面一行小字
    const ws = E.S.world || {}, EW = window.EchoWorld, safe = f => { try { return f(); } catch (e) { return null; } };
    const obj = ws.started && EW && EW.objective ? safe(() => EW.objective()) : null;
    const objText = obj && (obj.text || obj.zh);   // story.js 的 objective()：text 是界面语言的那句（老的 zh 字段也是同一句）
    // 要先学课本（挑战馆的门槛）时，后面跟一个「去闯关练习：七下 Unit 1 ›」，点了直接打开那个单元（world.js 的 wGoalHome → game.js goUnit）
    const goU = obj && obj.go === 'unit' && (E.WX || [])[obj.wi], goLab = goU ? (goU.bshort ? goU.bshort + ' ' : '') + 'Unit ' + goU.n : '';
    const objLine = objText ? '<p class="tip obj" style="margin-top:-4px">📍 ' + esc(objText) + (goLab && window.EchoI18n ? ' <button class="link obj-go" data-act="wGoalHome" data-w="' + obj.wi + '">' + EchoI18n.h('w.goal.go.home', { u: goLab }) + '</button>' : '') + '</p>' : '';
    let h = g.open ? '' : lock + lockedBtn + objLine;
    h += '<section class="mon-card lead" style="--tc:' + TYPES[s.type].color + '"><div class="lead-mon">' + svgMon(L) + '</div><div class="lead-info">' +
      '<div class="lead-name"><b>' + (L.shiny ? '✨' : '') + E.esc(nm(L)) + '</b><span>' + subName(L) + '</span> ' + heartsHTML(L) + '</div>' +
      '<div class="chips">' + chips(L.sp) + '<span class="lvchip">Lv ' + L.lv + '</span></div>' +
      '<div class="xpbar"><i style="width:' + (L.xp / xpNeed(L.lv) * 100) + '%"></i></div>' +
      '<small>' + hx('b.home.stats', { hp: st.hp, atk: st.atk }) + ((s.evo || []).find(e => e.lv) ? hx('b.home.evo', { lv: s.evo.find(e => e.lv).lv }) : '') + '</small></div>' +
      '<div class="lead-btns"><button class="btn small ghost" data-act="mTeam">' + hx('b.home.mons', { n: m.box.length }) + '</button><button class="btn small ghost" data-act="mDex">' + hx('b.home.dex', { a: caughtN(), b: D.total }) + '</button><button class="btn small sun" data-act="mBalls">' + hx('b.home.balls', { n: m.balls }) + '</button></div></section>';
    const place = EW && EW.placeLabel ? EW.placeLabel() : null;
    if (g.open) h += lock + '<button class="btn sun wide world-go" data-act="wEnter">🗺️ ' + (ws.started ? hx('b.home.continue') + (place ? ' · ' + place.name : '') : hx('b.home.go')) + '</button>' + objLine;
    // 下一枚徽章要先打败哪个课本单元的 BOSS（评估第 10 条：挑战馆跟着课本进度开）
    const gn = ws.started && EW && EW.nextGymNeed ? safe(() => EW.nextGymNeed()) : null;
    if (gn && !gn.ok && gn.unitLabel) {
      h += '<section class="mon-card gym-need"><h3>' + hx('b.gym.t', { isle: gn.island }) + '</h3><p>' + hx('b.gym.p', { leader: gn.leader, unit: gn.unitLabel, done: gn.done, need: gn.need }) + '</p>' +
        '<button class="btn small" data-act="tab" data-t="quiz" style="margin-top:8px">' + hx('b.gym.go') + '</button></section>';
    }
    // 今日目击（sighting.js）：博士的告示板每天一条英文线索，读懂了去对的地方才遇得到稀有怪兽；收服了就收成一行
    if (ws.started && window.EchoSight && !E.lang) h += safe(() => EchoSight.homeCard()) || '';   // 今日目击：别的语言的课先不出
    // 传说的线索：四只神兽是学习的里程碑
    const clues = ws.started && EW && EW.legendClues ? safe(() => EW.legendClues()) || [] : [];
    if (clues.length) {
      h += '<section class="mon-card legends"><h3>' + hx('b.leg.t') + '</h3><ul style="list-style:none;padding:0;margin:6px 0 0;display:grid;gap:4px;font-size:14px">' + clues.map(c =>
        '<li>' + (c.caught ? '✅' : c.icon) + ' ' + hx('b.leg.name', { name: label({ zh: c.zh, en: c.en }) }) + (c.caught ? hx('b.leg.caught') : hx('b.leg.task', { task: c.task, have: c.have, need: c.need }) + (c.done ? hx('b.leg.done') : '')) + '</li>').join('') + '</ul></section>';
    }
    h += '<p class="tip">' + hx('b.home.tip') + '</p>';
    const visited = Object.keys(ws.visited || {}).map(Number).sort((a, b) => a - b);
    if (visited.length > 1) {
      h += '<section class="mon-card fly"><h3>' + hx('b.home.fly') + '</h3><div class="fly-list">' + visited.map(z =>
        '<button class="btn small ghost" data-act="wFly" data-z="' + z + '">' + E.W[z].icon + ' ' + isleName(z) + (m.badges[z] ? ' 🏅' : '') + '</button>').join('') + '</div></section>';
    }
    h += '<p class="tip">' + hx('b.home.foot', { a: Object.keys(m.badges).length, b: E.W.length }) + '</p>';
    return h;
  }

  // ---------- 别的语言的课（tools/course/ENGINE.md §5）：写死的英语里「要开口说的那句」----------
  // 换成这座岛课程里的一句（game.js 的 learnLine：按 key 的哈希固定挑），题面给它的意思。英语课返回 null，调用的地方照旧
  const learnL = (key, z) => (E.lang && E.learnLine ? E.learnLine(key, z == null ? ((E.S.world && E.S.world.z) | 0) : z, 'sent') : null);
  const meanHTML = ln => (ln && ln.mean ? '<div class="say-zh">' + E.esc(ln.mean) + '</div>' : '');
  // ---------- 选初始怪兽：大声说 be my partner! ----------
  let starterLn = null;   // 别的课：这次要说的那句（learnL）
  function starterSheet(id) {
    const s = SPECIES[id], sr = E.speakMode() === 'sr';
    starterLn = learnL('be my partner', 0);
    E.openModal('<div class="evo-stage">' + svg(id) + '</div><h2>' + s.en + E.esc(zhOf(s)) + '</h2>' +
      '<p>' + hx('b.st.say') + '</p><div class="say-text" id="st-say">' + E.wordsHTML(starterLn ? starterLn.t : s.en + ', be my partner!') + '</div>' + meanHTML(starterLn) +
      (sr ? '<button class="mic" id="st-mic" data-act="mStarterMic" data-sp="' + id + '">' + E.MIC + '</button><div class="mic-hint" id="st-hint">' + hx('b.mic.say') + '</div>' +
          // AI 打分用不了（没网 / 额度 / 没密钥，评估第 3 条）：可以先跳过，这句放进复习、联网后要补说；说了 3 次还不行也能先跳过
          '<button class="link ai-skip" data-act="mStarterSkip" data-sp="' + id + '" id="st-skip"' + (E.aiDown && E.aiDown() ? '' : ' hidden') + '>' + E.esc(skipTxt()) + '</button>'
        : '<button class="btn leaf wide" data-act="mStarterGo" data-sp="' + id + '">' + hx('b.said') + '</button>') +
      '<div class="row"><button class="btn ghost" data-act="close">' + hx('b.st.other') + '</button><button class="btn ghost" data-act="mSayName" data-sp="' + id + '">' + hx('b.listen') + '</button></div>');
    starterTries = 0;
    E.say(starterLn ? starterLn.t : s.en + ', be my partner!');
  }
  let starterTries = 0;
  async function starterMic(id) {
    const m = $('st-mic'); if (!m) return;
    if (E.RT.listening) { E.stopListening(); return; }
    m.classList.add('on'); m.innerHTML = E.STOP; $('st-hint').textContent = tx('b.mic.on');
    const res = await E.recognize(null, [starterLn ? starterLn.t : 'be my partner']);
    if (!$('st-mic')) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) { E.RT.srBroken = true; takeStarter(id); return; }
    const skip = () => { const sk = $('st-skip'); if (sk) sk.hidden = false; };
    if (!res.alts.length) {
      if (res.fail === 'unheard' || !E.failHint) starterTries++;
      $('st-hint').textContent = E.failHint ? E.failHint(res) : tx('b.mic.again');
      if (starterTries >= 3 || (E.aiDown && E.aiDown())) skip();
      return;
    }
    const r = E.bestScore(starterLn ? starterLn.t : 'be my partner', res.alts);
    if (r.score >= 40) takeStarter(id);
    else { starterTries++; $('st-hint').textContent = tx('b.st.retry'); if (starterTries >= 3) skip(); }
  }
  // 先跳过：伙伴照样选好，这句放进复习（联网以后要补说）
  function starterSkip(id) {
    E.stopListening();
    if (E.revLater) E.revLater(starterLn ? starterLn.q || { en: starterLn.t } : { en: SPECIES[id].en + ', be my partner!', zh: SPECIES[id].zh + '，做我的伙伴吧！' });
    const L = E.dayLog && E.dayLog(); if (L) L.aiSkip = (L.aiSkip || 0) + 1;
    takeStarter(id);
  }
  function takeStarter(id) {
    const m = M();
    if (m.box.length) return;
    const mon = newMon(id, 5);
    m.box.push(mon); m.team = [mon.uid]; m.dex[id] = 'caught';
    E.save(); E.closeModal(); E.confetti(160); E.SFX.win();
    E.say(SPECIES[id].en + ' joined your team!');
    E.toast(tx('b.st.joined', { name: SPECIES[id].en }), 'gold');
    E.renderHome();
  }

  // ---------- 战斗 ----------
  // 第一大区（初一）的怪兽（dex.js 的 inRegion1；家庭版的番外也会出）；按出没地点和稀有度抽
  const REGION1 = D.list.filter(s => s.r === 1 && !s.legend && !s.starter);
  const isBase = s => D.isBase(s);   // 进化链的第一阶（销售版里上一阶被拿掉的也算）
  const HAB = { grass: ['grass', 'forest', 'town', 'sky'], cave: ['cave', 'mountain', 'ruins', 'night'], water: ['water', 'sea', 'swamp'] };
  const RW = [0, 30, 18, 8, 3, 1];
  const hash = (a, b) => { let h = 2166136261; for (const c of String(a) + '|' + b) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  // 一个区域的野生怪兽表：同一个区域每次都一样（6–8 种），越往后越可能出稀有的
  const tableCache = {};
  function wildTable(z, hab) {
    const key = z + hab; if (tableCache[key]) return tableCache[key];
    const want = HAB[hab] || HAB.grass;
    let pool = REGION1.filter(s => isBase(s) && (s.habitat || []).some(h => want.includes(h)) && s.rarity <= 2 + Math.floor(z / 3));
    if (pool.length < 4) pool = REGION1.filter(isBase);
    pool = pool.slice().sort((a, b) => hash(key, a.id) - hash(key, b.id)).slice(0, 6 + (z % 3));
    return (tableCache[key] = pool);
  }
  // 等级够了就用进化后的样子
  function grown(id, lv) { let s = SPECIES[id]; for (let i = 0; i < 2; i++) { const e = (s.evo || []).find(q => q.lv && lv >= q.lv); if (!e) break; s = SPECIES[e.to]; } return s.id; }
  function wildFoe(z, bonus, hab) {
    const tb = wildTable(z, hab || 'grass');
    let r = Math.random() * tb.reduce((a, s) => a + RW[s.rarity || 1], 0), sp = tb[0];
    for (const s of tb) { r -= RW[s.rarity || 1]; if (r <= 0) { sp = s; break; } }
    const lv = zoneLv(z) + (bonus || 0) + rnd(3);
    const mon = newMon(Math.random() < .6 ? grown(sp.id, lv) : sp.id, lv);
    if (Math.random() < SHINY_RATE || window.__forceShiny) mon.shiny = true;
    return mon;
  }
  // 13 个挑战馆各有主题属性
  const GYM = ['flying', 'rock', 'grass', 'psychic', 'steel', 'spark', 'fire', 'poison', 'ground', 'dark', 'ice', 'water', 'dragon'];
  function leaderFoes(z) {
    const t = GYM[z % GYM.length], n = 2 + Math.floor(z / 4), lv = zoneLv(z) + 2;
    let pool = D.list.filter(s => !s.legend && !s.starter && isBase(s) && s.types.includes(t) && s.r <= 2);
    if (!pool.length) pool = REGION1.filter(isBase);
    pool = pool.slice().sort((a, b) => hash('gym' + z, a.id) - hash('gym' + z, b.id));
    return Array.from({ length: n }, (_, k) => { const l = lv + k; return newMon(grown(pool[k % pool.length].id, l + 1), l); });
  }
  const me = () => byUid(B.team[B.ti]);
  const foe = () => B.foes[B.fi];
  const monOf = side => side === 'me' ? me() : foe();
  const hpOf = side => side === 'me' ? B.hp[me().uid] : B.foeHp;
  const addHp = (side, v) => { if (side === 'me') B.hp[me().uid] = Math.max(0, Math.min(stats(me()).hp, B.hp[me().uid] + v)); else B.foeHp = Math.max(0, Math.min(stats(foe()).hp, B.foeHp + v)); };

  const curHp = mon => { const max = stats(mon).hp; return mon.hp == null ? max : Math.max(0, Math.min(max, mon.hp)); };
  const anyAlive = () => M().team.some(u => { const m = byUid(u); return m && !m.egg && curHp(m) > 0; });
  // 休息站：体力回满，异常状态全好
  function healAll() { M().box.forEach(m => { m.hp = stats(m).hp; m.st = null; }); E.save(); }
  // 训练师的怪兽：按区域和编号固定，等级够了自动是进化形态
  function trainerFoes(z, seed, count, lv) {
    const pool = wildTable(z, 'grass').concat(wildTable(z, 'water'));
    return Array.from({ length: count }, (_, k) => { const sp = pool[(seed * 5 + k * 3) % pool.length], l = lv + k; return newMon(grown(sp.id, l), l); });
  }
  // 把战斗里的体力写回存档（体力和异常状态会一直保留，到休息站才恢复）
  function writeBack() {
    if (!B) return;
    B.team.forEach(u => { const m = byUid(u); if (m) m.hp = Math.max(0, Math.min(stats(m).hp, Math.round(B.hp[u]))); });
    E.save();
  }

  // opts：foes 指定对手，trainer {name, emoji} 训练师，onEnd(result) 从大地图进来时战斗结束的回调
  // 战斗音乐：岛主、冠军赛、神兽最燃；训练师（对手、嘘声团）次之；野生最轻快
  function battleMusic(kind, foes, opts) {
    if (kind === 'leader' || opts.rules || foes.some(f => SPECIES[f.sp] && SPECIES[f.sp].legend)) return 'battle_boss';
    return kind === 'trainer' ? 'battle_trainer' : 'battle_wild';
  }
  function startBattle(kind, z, opts) {
    opts = opts || {};
    if (!M().box.length) { E.toast(tx('b.need.starter')); return false; }
    if (!anyAlive()) { E.toast(tx('b.need.rest')); return false; }
    E.primeTTS(); E.ac();
    stopBattle();
    const team = M().team.filter(u => byUid(u) && !byUid(u).egg);
    team.forEach(u => ensureMoves(byUid(u)));
    const foes = opts.foes || (kind === 'wild' ? [wildFoe(z, opts.lvBonus, opts.hab)] : leaderFoes(z));
    foes.forEach(ensureMoves);
    const ti = team.findIndex(u => curHp(byUid(u)) > 0);
    B = {
      kind, z, foes, fi: 0, team, ti, hp: {}, energy: 0, fen: 0, turn: 'intro', over: false, used: new Set([team[ti]]), task: null, tries: 0, usedQ: new Set(),   // usedQ：这一场出过的英语题（不重复）
      onEnd: opts.onEnd, trainer: opts.trainer, result: '', noCatch: !!opts.noCatch,
      stg: { me: newStages(), foe: newStages() }, conf: { me: 0, foe: 0 },
      fpot: kind === 'leader' ? 2 : kind === 'trainer' ? 1 : 0,
      rules: opts.rules || null,
      tag: opts.tag || null,   // 特别的野外对战（今日目击，sighting.js）：{ title 顶上的标题, sub 标题下面的小字, msg 开场那句话前面加的一段 }
    };
    if (rule('talk')) B.energy = 3;
    if (B.rules) setTimeout(() => { if (B && B.rules) E.toast(ruleText(ruleNow()), 'gold'); }, 1500);
    team.forEach(u => { B.hp[u] = curHp(byUid(u)); });
    B.foeHp = stats(foes[0]).hp;
    B.enter = 'both';
    B.pre = prep(foes.concat(team.map(byUid)).map(spOf));
    foes.forEach(f => { if (M().dex[f.sp] !== 'caught') M().dex[f.sp] = 'seen'; });
    E.save();
    E.show('battle');
    E.music(battleMusic(kind, foes, opts));
    // 3D 战斗画面：设置里选了 2D 流畅或者手机不支持就用原来的 2D 画面
    if (window.Battle3D && (E.S.settings.gfx || 'auto') !== '2d' && E.S.settings.gfxAuto !== '2d') {
      // 画质和大地图同一档：精美最多按 2 倍像素比画（评估第 15 条：3 倍太烫）
      let tier = (E.S.settings.gfx === 'auto' ? E.S.settings.gfxAuto : E.S.settings.gfx) || 'mid';
      try { if (window.EchoWorld && EchoWorld.gfxTier) tier = EchoWorld.gfxTier(); } catch (e) { /* 大地图还没初始化就按设置 */ }
      // quality：特效的粒子上限、点光源、发光后期按画质缩减；sfx：设置里关了音效就不放招式音效
      try { B3 = Battle3D.create(document.createElement('div'), { theme: arenaTheme(z, opts.hab, opts.arena, opts.rules), shadows: tier !== 'low', dpr: tier === 'high' ? 2 : 1.5, quality: tier, sfx: () => E.S.settings.sfx !== false }); } catch (e) { B3 = null; }
    } else if (window.Battle3D && Battle3D.release) Battle3D.release();   // 这一场用 2D 流畅画面：上一场留着没用的 3D 画面彻底释放（见 battle3d.js 的 park）
    renderBattle();
    intro(B);
    return true;
  }
  function stopBattle() {
    if (RO) { RO.disconnect(); RO = null; }
    if (B3) { B3.destroy(); B3 = null; }
    if (!B) return;
    B.over = true;
    clearTimeout(B.defTimer);
    if (B.defDone) { const r = B.defDone; B.defDone = null; r(); }
    E.stopListening();
    B = null;
  }
  // 血量比例 → 颜色：绿 → 黄 → 红，平滑过渡（不是三档跳变）
  function hpColor(p) {
    const G = [148, 62, 44], Y = [45, 96, 52], R = [4, 84, 56];
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, k)));
    const c = p > .5 ? mix(Y, G, (p - .5) / .15) : p > .25 ? Y : mix(R, Y, (p - .1) / .15);
    return 'hsl(' + c[0].toFixed(0) + ' ' + c[1].toFixed(0) + '% ' + c[2].toFixed(0) + '%)';
  }
  // 顶上一整条状态栏（2026-10-08 按评审改）：左边是自己、右边是对手，两边对称；不放「HP」小标签，经验条挪到结算画面
  // 每一边：名字（✨稀有色）+ 等级、血条（掉血时后面留一截浅色慢慢缩）、属性 / 异常状态 / 能力升降一行
  function plate(side, mon, name, extra) {
    const mine = side === 'me', max = stats(mon).hp, p = Math.max(0, mine ? B.hp[mon.uid] : B.foeHp) / max, w = (p * 100) + '%';
    const id = mine ? 'my' : 'foe', t0 = SPECIES[mon.sp].types[0];
    return '<div class="hpcard ' + side + (B.enter === 'both' || B.enter === side ? ' enter' : '') + '" style="--tc:' + TYPES[t0].color + '">' +
      '<div class="hp-top"><b>' + (mon.shiny ? '<span class="shiny" title="' + hx('b.shiny') + '">✨</span>' : '') + name + '</b><span class="hp-lv"><small>Lv</small>' + mon.lv + '</span></div>' +
      '<div class="hpbar" title="' + hx('b.hp') + '"><span class="hp-ghost" id="b-' + id + 'ghost" style="width:' + w + '"></span><i id="b-' + id + 'hp" style="width:' + w + ';background-color:' + hpColor(p) + '"></i></div>' +
      '<div class="hp-foot">' + (extra || '') + '<div class="chips">' + chips(mon.sp) + '<span class="st-chip" id="b-' + id + 'st"></span><span class="stg" id="b-' + id + 'stg"></span></div></div></div>';
  }
  // 转屏（竖屏 ⇄ 横屏）后战斗画面跟着重新算大小
  // 对战画面跟着屏幕变大小。转屏以后隔一会儿再对两次：iPhone 上 resize 事件来的时候版面还没排完（和大地图一样，见 world.js）
  const b3Fit = () => { if (B && B3 && document.getElementById('b-arena')) { try { B3.resize(); } catch (e) { /* 忽略 */ } } };
  window.addEventListener('resize', () => { b3Fit(); setTimeout(b3Fit, 250); setTimeout(b3Fit, 700); });
  window.addEventListener('orientationchange', () => { setTimeout(b3Fit, 250); setTimeout(b3Fit, 700); });
  function renderBattle() {
    const w = E.W[B.z], f = foe(), m = me(), sf = SPECIES[f.sp], sm = SPECIES[m.sp];
    $('battle').innerHTML =
      '<div class="p-top"><button class="x" data-act="bFlee" aria-label="' + hx('b.leave') + '">✕</button><div class="th-title"><b>' + (B.tag && B.tag.title ? B.tag.title : B.kind === 'wild' ? hx('b.title.wild') : B.kind === 'trainer' ? hx('b.title.trainer', { name: B.trainer.name }) : hx('b.title.leader', { name: bossName(B.z) })) + '</b><small>' + (B.tag && B.tag.sub ? E.esc(B.tag.sub) : hx('b.title.zone', { n: B.z + 1, isle: isleName(B.z) })) + '</small></div><span class="b-energy" id="b-energy" title="' + hx('b.energy') + '"></span></div>' +
      '<div class="arena" id="b-arena" style="--wc:' + w.color + '">' + arenaBG(B.z) +
      // 2D 画面：两只怪兽侧面对站在同一条地平线上，脚下是属性色的一圈圈水波（3D 画面在 battle3d.js 里同样处理）
      '<div class="pad me" style="--rc:' + TYPES[sm.types[0]].color + '"></div><div class="mon me' + (B.enter === 'both' || B.enter === 'me' ? ' enter' : '') + '" id="b-me">' + svgMon(m) + '</div>' +
      '<div class="pad foe" style="--rc:' + TYPES[sf.types[0]].color + '"></div><div class="mon foe' + (B.enter === 'both' || B.enter === 'foe' ? ' enter' : '') + '" id="b-foe">' + svgMon(f) + '</div>' +
      '<div class="b-hud">' + plate('me', m, nm(m)) +
      '<span class="b-vs">' + (B.kind !== 'wild' ? '<span class="trainer">' + (B.kind === 'trainer' && B.trainer.img ? '<img src="' + B.trainer.img + '" alt="">' : '<span>' + w.boss.emoji + '</span>') + '</span>' : 'VS') + '</span>' +
      plate('foe', f, sf.en, (B.kind !== 'wild' ? '<div class="balls" title="' + hx('b.foeLeft') + '">' + B.foes.map((x, i) => '<span class="' + (i < B.fi ? 'down' : '') + '"></span>').join('') + '</div>' : '')) + '</div>' +
      '</div><div class="b-msg" id="b-msg"></div><div class="b-panel" id="b-panel"></div>';
    if (B3) {
      const ar = $('b-arena'); ar.classList.add('is3d'); B3.mount(ar);
      // 战场是弹性高度（下面的面板变高变矮时跟着变）：尺寸一变就让 3D 画面重新算
      if (window.ResizeObserver) { if (RO) RO.disconnect(); RO = new ResizeObserver(() => { if (B3 && ar.isConnected) { try { B3.resize(); } catch (e) { /* 忽略 */ } } }); RO.observe(ar); }
      B.rig3 = B.rig3 || {};
      // 刚开战、这只怪兽会动的模型还在下载（intro 里最多等 2.5 秒）：先不放程序拼的替身，等 upgrade3D() 再放——
      // 替身多半用不上，白建一遍、白编译一遍它的着色器，正好挤在开场最忙的那一秒
      const later = sp => B.turn === 'intro' && !!B.pre && !!(Mon3D.hasModel && Mon3D.isLoaded && Mon3D.hasModel(sp) && !Mon3D.isLoaded(sp));
      const put = (side, sp) => { if (later(sp)) { delete B.rig3[side]; return; } B3.setMon(side, sp, true); B.rig3[side] = !!(Mon3D.isLoaded && Mon3D.isLoaded(sp)); };
      if (B.enter === 'both' || B.enter === 'foe') put('foe', spOf(f));
      if (B.enter === 'both' || B.enter === 'me') put('me', spOf(m));
    }
    B.enter = '';
    updHp();
  }
  // 战斗场地的样子：洞穴暗、雪地白，其余是草地
  // 各岛的战斗场地：沙滩、糖果色、农田、雪地、雾里的古迹……（ground 取自远景画里空地的颜色，bdFloor 是画里空地从多高开始）
  const ARENAS = {
    hello: { sky1: '#7cc8f0', sky2: '#e6f6ff', ground: '#ebc684', hill: '#9ad66e', pad: '#fff4d6', rim: '#d9643a', backdrop: 'assets/arena/hello.jpg', bdFloor: .63 },
    crayon: { sky1: '#a7d8ff', sky2: '#fff0f7', ground: '#f3d493', hill: '#f7b9c9', pad: '#fff7b3', rim: '#f06292', backdrop: 'assets/arena/crayon.jpg', bdFloor: .66 },
    farm: { sky1: '#8fd0f0', sky2: '#fff6de', ground: '#f4d28d', hill: '#e0a24a', pad: '#f3e1b0', rim: '#a0703c', backdrop: 'assets/arena/farm.jpg', bdFloor: .65 },
    school: { sky1: '#86c5f0', sky2: '#eef8ff', ground: '#f4d089', hill: '#b5543c', pad: '#e8e2d4', rim: '#6d4c41', backdrop: 'assets/arena/school.jpg', bdFloor: .66 },
    lab: { sky1: '#8fd3f4', sky2: '#f2fbff', ground: '#f5cf83', hill: '#9fb4c0', pad: '#ffffff', rim: '#5c6bc0', backdrop: 'assets/arena/lab.jpg', bdFloor: .65 },
    circus: { sky1: '#ffb74d', sky2: '#fff3d6', ground: '#f6ce7e', hill: '#e53935', pad: '#fff6e0', rim: '#e53935', backdrop: 'assets/arena/circus.jpg', bdFloor: .66 },
    clock: { sky1: '#9fb7c9', sky2: '#f0ebe0', ground: '#c19f78', hill: '#6b4f45', pad: '#cfc6b6', rim: '#4f9e8a', backdrop: 'assets/arena/clock.jpg', bdFloor: .67 },
    party: { sky1: '#ffc1d9', sky2: '#fff8ec', ground: '#f1cd93', hill: '#ff8fb1', pad: '#fff4e0', rim: '#ff80ab', backdrop: 'assets/arena/party.jpg', bdFloor: .66 },
    jungle: { sky1: '#79c7a0', sky2: '#e8f7e0', ground: '#f2cb8d', hill: '#1f6f2f', pad: '#fbeccb', rim: '#6d4121', backdrop: 'assets/arena/jungle.jpg', bdFloor: .70 },
    city: { sky1: '#9fb7d0', sky2: '#eef3f8', ground: '#9fa7b0', hill: '#78909c', pad: '#dfe3e6', rim: '#ffca28', backdrop: 'assets/arena/city.jpg', bdFloor: .71 },
    sports: { sky1: '#6fc3ff', sky2: '#eaf8ff', ground: '#d1ae7b', hill: '#ff7043', pad: '#ffffff', rim: '#1e88e5', backdrop: 'assets/arena/sports.jpg', bdFloor: .70 },
    snow: { sky1: '#a9c9e0', sky2: '#eef6fb', ground: '#dbe5fa', hill: '#cfe3ee', pad: '#ffffff', rim: '#9fc3d6', backdrop: 'assets/arena/snow.jpg', bdFloor: .68 },
    ruins: { sky1: '#9aa6a8', sky2: '#e4e6e0', ground: '#af9a72', hill: '#8f8a80', pad: '#cfc6b3', rim: '#6d8b5a', backdrop: 'assets/arena/ruins.jpg', bdFloor: .71 },
    // 英语冠军赛（四位擂主和冠军的对战都带 rules）：体育场
    league: { sky1: '#3f6fd8', sky2: '#dfe9ff', ground: '#d2b494', hill: '#5c6bc0', pad: '#ffffff', rim: '#ffca28', backdrop: 'assets/arena/league.jpg', bdFloor: .74 },
  };
  // 场地的 backdrop 是远景画（assets/arena/*.jpg，约 21:9～3:1，下面三成多是空地），没有这张图就用程序画的小山
  function arenaTheme(z, hab, arena, rules) {
    if (rules) return ARENAS.league;
    if (hab === 'cave') return { sky1: '#231b24', sky2: '#4a3a36', ground: '#877569', hill: '#3a2e28', pad: '#c2b09a', rim: '#7fb8ff', backdrop: 'assets/arena/cave.jpg', bdFloor: .73 };
    if (hab === 'water' && arena === 'under') return { sky1: '#0f4c63', sky2: '#2f8fa8', ground: '#d8c79a', hill: '#2c7a6a', pad: '#e0cfa0', rim: '#4fc3f7' };
    const key = ARENAS[arena] ? arena : window.EchoMaps ? EchoMaps.themeOf(z) : null;
    if (ARENAS[key]) return ARENAS[key];
    if (z === 11) return { sky1: '#a9c9e0', sky2: '#eef6fb', ground: '#eef4f8', hill: '#cfe3ee', pad: '#ffffff', rim: '#9fc3d6' };
    return { rim: E.W[z] ? E.W[z].color : '#7aa85a' };
  }
  const STAT_ZH = k => tx('b.stat.' + k);   // 能力升降小标签：攻 / 防 / 速
  function updHp() {
    const f = foe(), m = me();
    const fmax = stats(f).hp, mmax = stats(m).hp, fh = Math.max(0, B.foeHp), mh = Math.max(0, B.hp[m.uid]);
    const bar = (id, v, max) => {
      const e = $(id + 'hp'), g = $(id + 'ghost'); if (!e) return;
      const p = v / max; e.style.width = (p * 100) + '%'; e.style.backgroundColor = hpColor(p); e.className = p > .5 ? '' : p > .2 ? 'mid' : 'low';
      if (g) g.style.width = (p * 100) + '%';   // 浅色的那截晚一点才缩（CSS 里有延迟）
    };
    bar('b-foe', fh, fmax); bar('b-my', mh, mmax);
    // 战斗中升级：名牌上的等级跟着变
    [['me', m], ['foe', f]].forEach(([side, mon]) => { const lv = document.querySelector('#b-arena .hpcard.' + side + ' .hp-lv'); if (lv) lv.innerHTML = '<small>Lv</small>' + mon.lv; });
    const n = $('b-myhpn'); if (n) n.textContent = Math.round(mh) + ' / ' + mmax;
    const en = $('b-energy'); if (en) en.innerHTML = [0, 1, 2].map(k => '<span class="' + (k < B.energy ? 'on' : 'off') + '">' + TICON.spark + '</span>').join('');
    [['me', 'b-myst', 'b-mystg'], ['foe', 'b-foest', 'b-foestg']].forEach(([side, sid, gid]) => {
      const mon = monOf(side), st = mon.st, e1 = $(sid), e2 = $(gid);
      if (e1) { e1.textContent = st ? label(STATUS[st]) : B.conf[side] ? label(STATUS.conf) : ''; e1.style.setProperty('--sc', st ? STATUS[st].color : '#ec407a'); e1.hidden = !st && !B.conf[side]; }
      if (e2) e2.innerHTML = Object.entries(B.stg[side]).filter(([, v]) => v).map(([k, v]) => '<span class="' + (v > 0 ? 'up' : 'down') + '">' + E.esc(STAT_ZH(k)) + (v > 0 ? '↑' : '↓') + Math.abs(v) + '</span>').join('');
    });
  }
  const msg = t => { const e = $('b-msg'); if (e) e.innerHTML = t; };
  const panel = h => { const e = $('b-panel'); if (e) e.innerHTML = h; };

  async function intro(b) {
    if (B3 && b.pre) { await b.pre; if (!live(b)) return; upgrade3D(); }
    const f = foe(), sf = SPECIES[f.sp], w = E.W[b.z];
    $('b-foe').classList.add('appear');
    if (b.kind === 'wild') {
      msg((b.tag && b.tag.msg ? b.tag.msg : '') + (f.shiny ? hx('b.in.shiny') : '') + hx('b.in.wild', { name: sf.en, zh: zhOf(sf) }));
      if (f.shiny) { E.SFX.win(); E.toast(tx('b.in.shinyToast', { name: sf.en }), 'gold'); }
      if (B3) B3.enter('foe', false);
      await E.say('Look out! Here comes ' + sf.en + '!');
    } else {
      const who = b.kind === 'trainer' ? b.trainer.name : bossName(b.z);
      msg(hx('b.in.foe', { who, name: sf.en }));
      if (B3) B3.enter('foe', true);
      await E.say("Let's battle! " + sf.en + ', your turn!', undefined, 'm');
    }
    if (!live(b)) return;
    msg(hx('b.go', { name: nm(me()) }));
    if (B3) B3.enter('me', true);
    await E.say(nm(me()) + ', your turn!');
    if (!live(b)) return;
    menu();
  }

  // ---------- 我方回合：选招式 ----------
  function menu() {
    if (!B) return;
    B.turn = 'me'; B.task = null; B.mv = null;
    const m = me(), sm = SPECIES[m.sp], f = foe();
    // 睡着 / 冻住：这一回合要先叫醒它
    if (m.st === 'slp' || m.st === 'frz') {
      if (m.st === 'slp') { m.slp = (m.slp || 1) - 1; if (m.slp <= 0) m.st = null; }
      else if (Math.random() < .2) m.st = null;
      if (!m.st) { E.toast(tx('b.selfWake', { icon: m.slp != null ? '☀️ ' : '🔥 ', name: nm(m) })); updHp(); }
      else { wakeTask(); return; }
    }
    const canCatch = B.kind === 'wild' && !B.noCatch && B.foeHp <= stats(f).hp * 0.6;
    const others = B.team.some((u, k) => k !== B.ti && B.hp[u] > 0);
    msg(hx('b.menu', { name: nm(m) }));
    panel('<div class="moves">' + movesOf(m).map((mv, i) => {
      const lock = mv.tier === 2 && B.energy < 3, nm = mvName(mv), e = mv.sup ? 1 : eff(mv.type, f.sp);
      const tag = mv.sup ? E.esc(mv.sup.desc) : (e > 1 ? '<em class="mv-eff">' + hx('b.mv.strong') + '</em>' : e < 1 ? hx('b.mv.low') : E.esc(label(TYPES[mv.type])));
      // 小字：招式的中文名（中文界面才有）· 克制 / 属性 / 辅助说明 · 要做什么
      const small = [E.esc(gloss({ zh: nm[1] }) || ''), tag, lock ? hx('b.mv.lock') : E.esc(TASK(mv.sup ? 1 : mv.tier))].filter(Boolean).join(' · ');
      return '<button class="move' + (mv.tier === 2 ? ' ult' : '') + (mv.sup ? ' sup' : '') + (LIGHT[mv.type] ? ' lt' : '') + '" style="--tc:' + TYPES[mv.type].color + '" data-act="bMove" data-i="' + i + '"' + (lock ? ' disabled' : '') + '><span class="mv-top"><span class="mv-ico">' + TICON[mv.type] + '</span><b>' + nm[0] + '</b><span class="mv-pow">' + (mv.sup ? '✦' : DOTS[mv.tier]) + '</span></span><small>' + small + '</small></button>';
    }).join('') + '</div>' +
      '<div class="b-items">' +
      (B.kind === 'wild' && !B.noCatch ? '<button class="btn small ' + (canCatch ? 'sun' : 'ghost') + '" data-act="bCatch"' + (canCatch ? '' : ' disabled') + '>' + hx('b.catch') + (canCatch ? '' : hx('b.catch.weak')) + '</button>' : '') +
      '<button class="btn small ghost" data-act="bSwitch"' + (others ? '' : ' disabled') + '>' + hx('b.switch') + '</button>' +
      '<button class="btn small ghost" data-act="bBag">' + hx('b.bag') + '</button></div>');
  }
  // 叫醒睡着 / 冻住的怪兽：大声喊它的名字
  function wakeTask() {
    const m = me(), sm = SPECIES[m.sp], slp = m.st === 'slp';
    B.turn = 'task'; B.tries = 0; B.hinted = false;
    B.task = { kind: 'wake', target: (slp ? 'Wake up, ' : 'Warm up, ') + nm(m) + '!', zh: slp ? '快醒醒！' : '快暖和起来！' };
    const ln = learnL(slp ? 'wake up' : 'warm up', B.z);   // 别的课：换成这座岛课程里的一句
    if (ln) Object.assign(B.task, { target: ln.t, zh: '', mean: ln.mean, q: ln.q });
    listenIfDown(B.task);
    taskPanel();
    msg(hx(slp ? 'b.wake.slp' : 'b.wake.frz', { name: nm(m) }));
  }
  // 战斗里的背包：回复体力、治异常状态，用掉这一回合
  const STATUS_HEAL = { antidote: ['psn'], burnheal: ['brn'], paraheal: ['par'], awakening: ['slp'], iceheal: ['frz'], fullheal: ['psn', 'brn', 'par', 'slp', 'frz'] };
  function battleBag() {
    if (!B || B.turn !== 'me') return;
    const m = me(), full = B.hp[m.uid] >= stats(m).hp;
    const ids = ['potion', 'superpotion'].concat(Object.keys(STATUS_HEAL).filter(id => itemCount(id) > 0));
    const rows = ids.map(id => {
      const it = ITEMS[id], n = itemCount(id), ok = n > 0 && (it.heal ? !full : STATUS_HEAL[id].includes(m.st));
      return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + E.esc(label(it)) + (it.key ? '' : ' ×' + n) + '</b><small>' + E.esc(it.desc) + '</small></div><button class="btn small sun" data-act="bUse" data-id="' + id + '"' + (ok ? '' : ' disabled') + '>' + hx('b.use') + '</button></div>';
    }).join('');
    E.openModal('<h2>' + hx('b.bbag.t') + '</h2><p>' + hx('b.bbag.p', { name: nm(m), hp: Math.max(0, Math.round(B.hp[m.uid])), max: stats(m).hp, st: m.st ? ' · ' + label(STATUS[m.st]) : '' }) + '</p>' + rows + '<button class="btn ghost wide" data-act="close">' + hx('b.back') + '</button>');
  }
  // 换怪兽：换上来的怪兽会挨对手这一回合的攻击
  function switchSheet() {
    if (!B || B.turn !== 'me') return;
    const rows = B.team.map((u, k) => {
      if (k === B.ti) return '';
      const mon = byUid(u), s = SPECIES[mon.sp], hp = Math.max(0, Math.round(B.hp[u]));
      return '<div class="mrow"><span class="mrow-svg">' + svg(mon.sp) + '</span><div class="mrow-i"><b>' + s.en + '</b> <small>Lv ' + mon.lv + '</small><div class="chips">' + chips(mon.sp) + (mon.st ? '<span class="st-chip" style="--sc:' + STATUS[mon.st].color + '">' + E.esc(label(STATUS[mon.st])) + '</span>' : '') + '</div><small>' + hx('b.hpOf', { hp, max: stats(mon).hp }) + '</small></div><div class="mrow-b"><button class="btn small sun" data-act="bSwitchTo" data-k="' + k + '"' + (hp > 0 ? '' : ' disabled') + '>' + hx('b.sw.go') + '</button></div></div>';
    }).join('');
    // pick-grid：竖屏不起作用（照常一行一只），横屏排成三列小卡片，点整张卡片就换上场
    E.openModal('<h2>' + hx('b.sw.t') + '</h2><p>' + hx('b.sw.p') + '</p><div class="pick-grid">' + rows + '</div><button class="btn ghost wide" data-act="close">' + hx('b.back') + '</button>');
  }
  function doSwitch(k) {
    if (!B || B.turn !== 'me' || k === B.ti || !(B.hp[B.team[k]] > 0)) return;
    E.closeModal();
    const b = B;
    B.turn = 'busy';
    round(b, Object.assign(async () => {
      const old = SPECIES[me().sp];
      msg(hx('b.rest', { name: old.en }));
      E.say(old.en + ', take a rest!');
      await Promise.all([sleep(700), prep([spOf(byUid(B.team[k]))])]);
      B.ti = k; B.used.add(B.team[k]); B.stg.me = newStages(); B.conf.me = 0;
      B.enter = 'me';
      renderBattle();
      const n = SPECIES[me().sp];
      msg(hx('b.go', { name: n.en }));
      $('b-me').classList.add('appear');
      if (B3) B3.enter('me', true);
      await E.say(n.en + ', your turn!');
    }, { priority: true }));
  }

  // 这一题出什么：先挑今天到期的复习题（同一场不重复），再挑课本正在学的单元里没学过的，最后随机（game.js 的 revPick）
  // kind：'word' / 'sent' / 'dlg'；返回 { q: 存进复习本的题, it: 题目内容, d: 挑干扰项用的小岛 / 单元 }
  function pickQ(kind) {
    if (E.revPick) return E.revPick(kind, B.z, B.usedQ);
    const sr = E.src ? E.src(B.z) : { w: B.z, d: E.W[B.z] }, L = kind === 'word' ? sr.d.words : kind === 'sent' ? sr.d.sents : sr.d.dlgs, k = rnd(L.length);
    return { q: { kind, w: sr.w, i: k }, it: L[k], d: sr.d };
  }
  // 技能任务：说单词 / 念句子 / 对话大招 / 辅助招式 / 收服咒语 / 叫醒
  // 句子和大招按这道题的掌握程度撤提示（E.fadeOf：0 看着念、1 只给首字母、2 凭记忆说）；
  // blind：不看字念（掌握了自动是，或者自己点「🔥 不看字念」），中招念对伤害 ×1.5
  function onMove(i) {
    if (!B || B.turn !== 'me') return;
    const mv = movesOf(me())[i];
    if (!mv || (mv.tier === 2 && B.energy < 3)) return;
    B.mv = mv; B.move = mv.tier; B.tries = 0; B.hinted = false; B.blind = false; B.turn = 'task';
    if (mv.tier === 0 && !mv.sup) { const p = pickQ('word'), it = p.it; B.task = { kind: 'word', q: p.q, d: p.d, target: it[0], zh: it[1], em: it[2] }; }
    else if (mv.tier === 1 || mv.sup) { const p = pickQ('sent'), it = p.it; B.task = { kind: 'sent', q: p.q, d: p.d, target: it[0], zh: it[1] }; }
    else { const p = pickQ('dlg'), it = p.it; B.task = { kind: 'ult', q: p.q, prompt: it[0], target: it[1], opts: shuffle([{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))]) }; }
    const t = B.task;
    if (E.lang && (t.kind === 'word' || t.kind === 'sent')) t.mean = E.meanText(t.target);   // 别的课：咒语下面的意思（英语界面给英文意思）
    t.fade = t.kind === 'word' ? 2 : E.fadeOf ? Math.min(2, E.fadeOf(t.q)) : 0;
    if (t.kind === 'sent' && t.fade >= 2 && canBlind()) B.blind = true;
    // 大招：掌握了以后先只播问题，凭记忆回答；说错一次（或者自己点「看选项」）才亮出选项，亮出来就不能暴击（只在 AI 打分时，自评要点选项）
    t.hid = t.kind === 'ult' && t.fade >= 1 && E.speakMode() === 'sr';
    // 按能力走的入门 / 初级（game.js 的 lvListen，levels.js 的 kinds）：单词、句子的招式有几成换成「听一听、点出来」，点对了照常出招
    if (!listenIfDown(t) && E.speakMode() === 'sr' && (t.kind === 'word' || t.kind === 'sent') && E.lvListen && E.lvListen()) {
      t.listen = true; t.lv = true; B.blind = false; B.hinted = true; t.lopts = listenOpts(t);
    }
    taskPanel();
  }
  // ---------- AI 打分用不了时：这一回合改成听音选招（家长 2026-10-07，评估第 3 条）----------
  // 没网 / 额度用完 / 没密钥（E.aiDown）：放一遍读音（大招放对手的问题），从 4 个里点出听到的那句（大招点出正确的回答）。
  // 点对了照常出招，但不能暴击（算带提示）；点错了这一招落空。复习本里不升格
  function listenIfDown(t) {
    if (E.speakMode() !== 'sr' || !(E.aiDown && E.aiDown())) return false;
    t.listen = true; B.blind = false; B.hinted = true;
    t.lopts = t.kind === 'ult' ? t.opts : listenOpts(t);
    return true;
  }
  function listenOpts(t) {
    let pool = [];
    if ((t.kind === 'word' || t.kind === 'sent') && t.d) pool = (t.kind === 'word' ? t.d.words : t.d.sents).map(x => x[0]);
    else if (E.lang && (t.kind === 'catch' || t.kind === 'wake')) pool = ((E.W[B.z] || E.W[0]).sents || []).map(x => x[0]);   // 别的课：同一座岛课程里的句子
    else if (t.kind === 'catch') pool = CATCH_LINES.slice();
    else if (t.kind === 'wake') { const n = nm(me()); pool = ['Wake up, ' + n + '!', 'Warm up, ' + n + '!', n + ', your turn!', n + ', take a rest!']; }
    const others = shuffle([...new Set(pool.filter(x => x && x.toLowerCase() !== t.target.toLowerCase()))]).slice(0, 3);
    return shuffle([{ c: true, t: t.target }].concat(others.map(x => ({ t: x }))));
  }
  function listenPick(i) {
    if (!B || B.turn !== 'task' || !B.task || !B.task.listen) return;
    const t = B.task, o = t.lopts[i]; if (!o) return;
    const ci = t.lopts.findIndex(x => x.c);
    document.querySelectorAll('#b-panel .opt').forEach((b, k) => b.classList.add(k === ci ? 'right' : k === i ? 'wrong' : 'dim'));
    const L = E.dayLog && E.dayLog(); if (L) L.aiListen = (L.aiListen || 0) + 1;
    if (o.c) reveal(70, '', () => finishTask(70, false));
    else reveal(0, t.target, () => finishTask(0, false, tx('b.why.listen')));
    const h = $('b-hint'); if (h) h.textContent = o.c ? tx('b.l.right') : tx('b.l.wrong');
  }
  // 「🔥 不看字念」只给攻击的中招（辅助招式没有伤害）
  const canBlind = () => !!(B && B.mv && !B.mv.sup && B.mv.tier === 1);
  function onCatch(ball) {
    if (!B || B.turn !== 'me' || B.kind !== 'wild') return;
    const nb = itemCount('ball'), ns = itemCount('superball');
    if (nb + ns <= 0) { E.toast(tx('b.noBalls')); return; }
    if (!ball && nb > 0 && ns > 0) {
      E.openModal('<h2>' + hx('b.ball.t') + '</h2><div class="row"><button class="btn sun" data-act="bCatch" data-ball="ball">' + hx('b.ball.n', { n: nb }) + '</button><button class="btn" data-act="bCatch" data-ball="superball">' + hx('b.ball.s', { n: ns }) + '</button></div><button class="btn ghost wide" data-act="close">' + hx('b.back') + '</button>');
      return;
    }
    E.closeModal();
    B.ball = ball || (nb > 0 ? 'ball' : 'superball');
    B.turn = 'task'; B.tries = 0; B.hinted = false;
    B.task = { kind: 'catch', target: pick(CATCH_LINES) };
    const ln = learnL('catch:' + B.task.target, B.z);   // 别的课：换成这座岛课程里的一句（还是随机挑四句里的一句的样子）
    if (ln) Object.assign(B.task, { target: ln.t, mean: ln.mean, q: ln.q });
    listenIfDown(B.task);
    taskPanel();
  }
  function taskPanel() {
    // rb：显示要学的那句话（别的课标读音；英语课就是 esc）
    const t = B.task, sr = E.speakMode() === 'sr', mv = B.mv ? mvName(B.mv) : ['', ''], esc = E.esc, rb = s => (E.lang ? E.ruby(s) : esc(s));
    let head, body = '';
    if (t.listen) {   // AI 打分用不了：听音选招（不能暴击）
      const ult = t.kind === 'ult';
      const I = window.EchoI18n;
      head = t.lv && I ? I.h('place.b.listen.' + t.kind, { mv: mv[0] })   // 按能力换成听音选的回合：不是 AI 出了问题，说法不一样
        : hx('b.l.down') + (ult ? hx('b.l.ult') : hx(t.kind === 'word' ? 'b.l.word' : 'b.l.sent')) + (B.mv && !B.mv.sup && t.kind !== 'catch' && t.kind !== 'wake' ? hx('b.l.use', { mv: mv[0] }) : '');
      body = (t.em ? '<div class="say-emoji">' + t.em + '</div>' : '') +
        '<div class="say-row"><button class="spk mini" data-act="' + (ult ? 'bHearQ' : 'bHear') + '" aria-label="' + hx('b.hearAgain') + '">' + E.SPK + '</button><span class="say-zh">' + hx(ult ? 'b.hearQ' : 'b.hearAgain') + '</span></div>' +
        '<div class="opts list b-listen">' + t.lopts.map((o, k) => '<button class="opt en" data-act="bLOpt" data-i="' + k + '"><span class="o-t">' + rb(o.t) + '</span></button>').join('') + '</div>';
      panel('<div class="task"><div class="task-h">' + head + '</div>' + body + '<div class="task-foot"><div class="mic-hint" id="b-hint">' + (t.lv && I ? I.h('place.b.listen.foot') : hx('b.l.owe')) + '</div></div>' +
        (t.kind === 'wake' ? '' : '<button class="link" data-act="bBack">' + hx('b.back.move') + '</button>') + '</div>');
      if (t.kind !== 'wake') msg(t.kind === 'catch' ? hx('b.l.catch', { name: SPECIES[foe().sp].en }) : hx('b.l.hit'));
      if (ult) E.say(t.prompt, undefined, 'm'); else E.say(t.target, 0.9);
      return;
    }
    // 英文下面的中文意思（中文界面才有；英语界面英文本身就是要学的内容）。别的课：t.mean 是课程内容在界面语言里的意思（英语界面也有）
    const zhLine = () => { const g = t.mean !== undefined ? t.mean : gloss({ zh: t.zh }); return g ? '<div class="say-zh">' + esc(g) + '</div>' : ''; };
    if (t.kind === 'word') {
      head = hx('b.t.word', { mv: mv[0] });
      body = '<div class="say-emoji">' + t.em + '</div>' + zhLine() + '<div class="say-text mask" id="b-say">' + esc(E.lang ? E.cueText(t.target, 2) : t.target.replace(/[a-z]/gi, '_')) + '</div>' +
        '<button class="link" data-act="bHint">' + hx('b.hint.hear') + '</button>';
    } else if (t.kind === 'sent') {
      const lv = B.hinted ? 0 : B.blind ? 2 : t.fade || 0;
      const blindBtn = canBlind() && !B.blind && !B.hinted ? '<button class="link" data-act="bBlind">' + hx('b.blind') + '</button>' : '';
      head = hx(lv >= 2 ? 'b.t.mem' : lv === 1 ? 'b.t.cue' : 'b.t.sent', { mv: mv[0] }) + (B.blind ? hx('b.t.blindOn') : '');
      body = lv
        ? zhLine() + '<div class="say-text mask" id="b-say">' + esc(E.cueText(t.target, lv)) + '</div>' + blindBtn +
          '<button class="link" data-act="bHint">' + hx('b.hint.see') + '</button>'
        : '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div>' + zhLine() + '<div class="say-row"><button class="spk mini" data-act="bHear" aria-label="' + hx('b.hearModel') + '">' + E.SPK + '</button></div>' + blindBtn;
    } else if (t.kind === 'ult') {
      const hid = t.hid && sr && !t.shown;   // 自评模式要点选项：不藏
      head = hx(hid ? 'b.t.ult.mem' : sr ? 'b.t.ult.sr' : 'b.t.ult.self', { mv: mv[0] });
      body = '<div class="say-row"><button class="spk mini" data-act="bHearQ" aria-label="' + hx('b.hearAgain') + '">' + E.SPK + '</button><span class="hidden-line blur" id="b-q">' + rb(t.prompt) + '</span></div>' +
        '<div class="opts list" id="b-opts"' + (hid ? ' hidden' : '') + '>' + t.opts.map((o, k) => '<button class="opt en" data-act="bOpt" data-i="' + k + '"><span class="o-t">' + rb(o.t) + '</span></button>').join('') + '</div>' +
        (hid ? '<button class="link" data-act="bShowOpts" id="b-show">' + hx('b.showOpts') + '</button>' : sr ? '<small class="tip">' + hx('b.optHear') + '</small>' : '');
    } else if (t.kind === 'wake') {
      head = hx('b.t.wake');
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div>' + zhLine() + '<div class="say-row"><button class="spk mini" data-act="bHear" aria-label="' + hx('b.hearModel') + '">' + E.SPK + '</button></div>';
    } else {
      head = hx('b.t.catch');
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div>' + (t.mean ? zhLine() : '') + '<div class="say-row"><button class="spk mini" data-act="bHear" aria-label="' + hx('b.hearModel') + '">' + E.SPK + '</button></div>';
    }
    const rate = '<div class="rate"><button class="btn coral" data-act="bRate" data-v="0">' + hx('b.rate.0') + '</button><button class="btn sun" data-act="bRate" data-v="1">' + hx('b.rate.1') + '</button><button class="btn leaf" data-act="bRate" data-v="2">' + hx('b.rate.2') + '</button></div>';
    // 话筒 / 提示 / 打分按钮放在一起（task-foot）：横屏时贴在面板底部，题目再长也看得见
    panel('<div class="task"><div class="task-h">' + head + '</div>' + body + '<div class="task-foot">' +
      (sr ? '<button class="mic" id="b-mic" data-act="bMic" aria-label="' + hx('b.mic.start') + '">' + E.MIC + '</button><div class="mic-hint" id="b-hint">' + hx('b.mic.read') + '</div><div class="heard" id="b-heard"></div>'
        : '<div class="mic-hint" id="b-hint">' + hx(t.kind === 'ult' ? 'b.self.ult' : 'b.self.rate') + '</div><div id="b-rate"' + (t.kind === 'ult' ? ' hidden' : '') + '>' + rate + '</div>') +
      '</div>' + (t.kind === 'wake' ? '' : '<button class="link" data-act="bBack">' + hx('b.back.move') + '</button>') + '</div>');
    if (t.kind !== 'wake') msg(t.kind === 'catch' ? hx('b.tip.catch', { name: SPECIES[foe().sp].en }) : B.mv && B.mv.sup ? hx('b.tip.sup') : hx('b.tip.hit'));
    if (t.kind === 'ult') E.say(t.prompt, undefined, 'm');
  }
  async function onMic() {
    if (!B || B.turn !== 'task') return;
    if (E.RT.listening) { E.stopListening(); return; }
    const b = B, t = B.task, m = $('b-mic');
    m.classList.add('on'); m.innerHTML = E.STOP;
    $('b-hint').textContent = tx('b.mic.listen');
    const res = await E.recognize(x => { const h = $('b-heard'); if (h) h.textContent = x; }, t.kind === 'ult' ? t.opts.map(o => o.t) : [t.target]);
    if (!live(b) || b.task !== t) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) {
      E.RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') E.RT.noRec = true;
      E.toast(tx('b.noSr'));
      taskPanel();
      return;
    }
    if (!res.alts.length) {
      // 没听清算一次尝试：第 3 次还没听清，这一招就落空（不卡在这一回合）
      if (res.fail === 'unheard' || !E.failHint) {
        t.miss = (t.miss || 0) + 1;
        if (t.miss >= 3) { reveal(0, t.target, () => finishTask(0, true, tx('b.why.unheard'))); return; }
        $('b-hint').textContent = (E.failHint ? E.failHint(res) : tx('b.mic.closer')) + tx('b.mic.try', { n: t.miss + 1 });
        return;
      }
      // 没网 / 额度 / 没密钥：连着用不了就把这一回合改成听音选招
      if (listenIfDown(t)) { taskPanel(); E.toast(tx('b.l.toast')); return; }
      const h = E.failHint(res); if (h) $('b-hint').textContent = h;
      return;
    }
    if (t.kind === 'ult') {
      const sc = t.opts.map(o => E.bestScore(o.t, res.alts));
      let bi = 0; sc.forEach((s, k) => { if (s.score > sc[bi].score) bi = k; });
      $('b-heard').textContent = tx('b.heard', { t: sc[bi].heard });
      const ci = t.opts.findIndex(o => o.c);
      if (t.opts[bi].c && sc[bi].score >= 45) { markOpts(bi); reveal(sc[bi].score, '', () => finishTask(sc[bi].score, true)); }
      else if (!t.opts[bi].c && sc[bi].score >= 60) { markOpts(ci, bi); reveal(0, t.target, () => finishTask(0, true, tx('b.why.wrong'))); }
      else if (B.tries < 1) {
        B.tries++; B.hinted = true;
        const was = showOpts(true);   // 凭记忆没说对：亮出选项再给一次机会
        $('b-hint').textContent = tx(was ? 'b.ult.retry1' : 'b.ult.retry2');
      }
      else { markOpts(ci); reveal(0, t.target, () => finishTask(0, true)); }
      return;
    }
    const r = E.bestScore(t.target, res.alts);
    $('b-heard').textContent = tx('b.heard', { t: r.heard });
    if (r.score < 90 && E.aiTip) E.aiTip(t.target, r.heard, $('b-heard'));
    const say = $('b-say');
    if (say) {
      if (say.classList.contains('mask')) { say.classList.remove('mask'); say.innerHTML = E.wordsHTML(t.target); }
      say.querySelectorAll('.w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    }
    // 第二次机会：答案已经亮出来了（单词题还会念一遍），跟着念对了也只算普通命中，不能暴击
    if (r.score < 30 && B.tries < 1) {
      B.tries++; B.hinted = true;
      $('b-hint').textContent = tx('b.retry', { n: r.score, nc: B.mv && !B.mv.sup && t.kind !== 'catch' ? tx('b.retry.nc') : '' });
      if (t.kind === 'word') E.say(t.target);
      return;
    }
    reveal(r.score, t.target, () => finishTask(r.score, true));
  }
  // 出招前先停一下：亮出答案（念到的词绿、没念到的红），没念好的再放一遍标准读音——
  // 不然面板马上换成战斗画面，孩子看不到正确答案，像是「技能直接放了」
  async function reveal(score, target, done) {
    const b = B, t = B.task, h = $('b-hint'), t0 = Date.now();
    B.turn = 'show';
    document.querySelectorAll('#b-panel [data-act=bHint], #b-panel [data-act=bBack], #b-panel [data-act=bBlind], #b-panel [data-act=bShowOpts]').forEach(x => { x.style.visibility = 'hidden'; });
    if (h) h.textContent = tx(score >= 85 ? 'b.rev.good' : 'b.rev.hear');
    if (score < 85 && target) { await Promise.race([E.say(target), sleep(5000)]); await sleep(400); }
    await sleep(Math.max(0, (score >= 85 ? 700 : 1500) - (Date.now() - t0)));
    if (live(b) && B.task === t && B.turn === 'show') done();
  }
  function markOpts(ri, wi) {
    showOpts(false);
    document.querySelectorAll('#b-panel .opt').forEach((b, k) => b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim'));
    const q = $('b-q'); if (q) q.classList.remove('blur');
  }
  // 大招的选项亮出来；early：还没答完就亮出来了（算看了答案）。返回 true 表示原来是藏着的
  function showOpts(early) {
    const o = $('b-opts'), s = $('b-show');
    if (s) s.remove();
    if (!o || !o.hidden) return false;
    o.hidden = false;
    if (early && B && B.task) B.task.shown = true;
    return true;
  }
  function onOpt(i) {
    if (!B || B.turn !== 'task' || B.task.kind !== 'ult') return;
    const t = B.task;
    if (E.speakMode() === 'sr') { E.say(t.opts[i].t); return; }
    if (t.picked) return;
    if (t.opts[i].c) {
      t.picked = true; markOpts(i);
      $('b-hint').textContent = tx('b.self.picked');
      $('b-rate').hidden = false;
      E.say(t.opts[i].t);
    } else {
      markOpts(t.opts.findIndex(o => o.c), i);
      finishTask(0, false, tx('b.why.pick'));
    }
  }
  function onRate(v) {
    if (!B || B.turn !== 'task') return;
    if (B.task.kind === 'ult' && !B.task.picked) return;
    const s = $('b-say');
    if (B.task.kind === 'word' || (s && s.classList.contains('mask'))) {   // 看图说、凭记忆念的：先亮出答案
      if (s) { s.classList.remove('mask'); s.innerHTML = E.wordsHTML(B.task.target); }
      if (v < 2) { reveal(0, B.task.target, () => finishTask([20, 65, 88][v], false)); return; }   // 没念好：先看答案、听一遍
    }
    finishTask([20, 65, 88][v], false);
  }
  function finishTask(score, measured, why) {
    const t = B.task, b = B;
    B.turn = 'busy';
    // 按能力换成听音选的回合（入门 / 初级，t.lv）：听对了按「带提示答对」记进复习（不升格），听错了降一格；不算开口说对，也不欠着
    if (t.listen && t.lv) { if (t.q) { if (score >= 55) { if (E.revRight) E.revRight(t.q, false, true); } else (E.revMiss || E.addWrong)(t.q); } }
    else if (t.listen) { if (t.q && E.revLater) E.revLater(t.q); }   // 听音选的回合（AI 用不了）：没开口，不算「开口说对」；这题欠着，联网后复习里要说
    else if (score >= 55) {
      E.S.stats.spoken++; E.qProg('spoken', 1);
      if (measured && score >= 85 && !B.hinted) { E.S.stats.perfect++; E.qProg('perfect', 1); }
      // 复习本：今天到期的算一次复习、课本新学的排进明天；带着提示（第二次机会、看了答案）答对的不升格
      if (t.q && E.revRight) E.revRight(t.q, false, !!B.hinted);
      // 不看字说对（凭记忆说出来的）：周报「不看字说对了几句」和神兽里程碑只数句子（recall）；单词小招另记 recallW
      const memory = !B.hinted && (t.kind === 'word' || B.blind || (t.kind === 'sent' && t.fade >= 2) || (t.kind === 'ult' && t.hid && !t.shown));
      if (measured && memory && t.q && E.dayLog) { const L = E.dayLog(), rk = t.kind === 'word' ? 'recallW' : 'recall'; L[rk] = (L[rk] || 0) + 1; }
    } else if (t.q) (E.revMiss || E.addWrong)(t.q);   // 对战里没念准：复习本里只降一格
    if (t.kind === 'catch') round(b, Object.assign(() => resolveCatch(score, b), { priority: true }));
    else if (t.kind === 'wake') round(b, () => resolveWake(score, b));
    else round(b, () => myAttack(score, why, b));
  }

  // ---------- 一个回合：速度快的先出手 ----------
  // mine：我方这回合做的事（async）；priority 的（道具、换怪兽、扔球）永远先
  const newStages = () => ({ atk: 0, def: 0, spd: 0 });
  const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  function spdOf(side) { const mon = monOf(side); let v = stats(mon).spd * stageMul(B.stg[side].spd); if (mon.st === 'par') v /= 2; return v; }
  async function round(b, mine) {
    const foeFirst = !(mine && mine.priority) && spdOf('foe') > spdOf('me');
    if (foeFirst) { msg(hx('b.faster', { name: SPECIES[foe().sp].en })); await sleep(800); }
    for (const who of foeFirst ? ['foe', 'me'] : ['me', 'foe']) {
      if (!live(b)) return;
      if (who === 'me') { if (mine) { const r = await mine(); if (r === 'end') return; } }
      else if (B.foeHp > 0 && B.hp[me().uid] > 0) await foeAct(b);
      if (!live(b)) return;
      if (B.foeHp <= 0) { await foeFaint(b); return; }
      if (B.hp[me().uid] <= 0) { await myFaint(b); return; }
    }
    await endOfRound(b);
    if (!live(b)) return;
    if (B.foeHp <= 0) { await foeFaint(b); return; }
    if (B.hp[me().uid] <= 0) { await myFaint(b); return; }
    menu();
  }
  // 行动前：睡着、冰冻、麻痹、混乱、不听话
  async function canAct(side, b) {
    const mon = monOf(side), name = nm(mon);
    if (side === 'foe' && (mon.st === 'slp' || mon.st === 'frz')) {
      if (mon.st === 'slp') { mon.slp = (mon.slp || 1) - 1; if (mon.slp <= 0) mon.st = null; }
      else if (Math.random() < .25) mon.st = null;
      updHp();
      msg(hx(mon.st ? (mon.st === 'slp' ? 'b.ca.slp' : 'b.ca.frz') : 'b.ca.woke', { name }));
      await sleep(900);
      if (mon.st) return false;
    }
    if (mon.st === 'par' && Math.random() < .25) { msg(hx('b.ca.par', { name })); if (B3) B3.status(side, 'par'); await sleep(1000); return false; }
    if (B.conf[side] > 0) {
      B.conf[side]--;
      if (!B.conf[side]) { msg(hx('b.ca.confEnd', { name })); updHp(); await sleep(700); }
      else if (Math.random() < .33) {
        const s = stats(mon), dmg = Math.max(1, Math.round(s.atk * .5 * Math.sqrt((s.atk + 20) / (s.def + 20))));
        msg(hx('b.ca.confHit', { name }));
        if (B3) B3.status(side, 'conf');
        addHp(side, -dmg); pop(side === 'me' ? 'b-me' : 'b-foe', '-' + dmg, 'dmg'); updHp();
        await sleep(1000);
        return false;
      }
    }
    if (side === 'me') {
      const cap = 20 + 10 * Object.keys(M().badges).length;
      if (mon.lv > cap && Math.random() < .3) { msg(hx('b.ca.obey', { name })); await sleep(1200); return false; }
    }
    return live(b);
  }
  // 回合结束：烧伤、中毒扣血
  async function endOfRound(b) {
    for (const side of ['me', 'foe']) {
      const mon = monOf(side);
      if (!(mon.st === 'brn' || mon.st === 'psn') || hpOf(side) <= 0) continue;
      const dmg = Math.max(1, Math.floor(stats(mon).hp / 8));
      addHp(side, -dmg);
      msg(hx(mon.st === 'brn' ? 'b.eor.brn' : 'b.eor.psn', { name: nm(mon) }));
      if (B3) B3.status(side, mon.st);
      pop(side === 'me' ? 'b-me' : 'b-foe', '-' + dmg, 'dmg');
      updHp();
      await sleep(900);
      if (!live(b)) return;
    }
  }
  // 伤害：攻击 × 招式威力 × 发音 × 属性克制 × 本属性加成 × 攻防比
  function damage(att, def, mv, mult) {
    const a = monOf(att), d = monOf(def), sa = SPECIES[a.sp];
    const atk = stats(a).atk * stageMul(B.stg[att].atk) * (a.st === 'brn' ? .6 : 1), dfn = stats(d).def * stageMul(B.stg[def].def);
    const e = eff(mv.type, d.sp), stab = sa.types.includes(mv.type) ? 1.2 : 1;
    const dmg = mult ? Math.max(1, Math.round(atk * POWER[mv.tier] * mult * e * stab * Math.sqrt((atk + 20) / (dfn + 20)) * (0.9 + Math.random() * 0.2))) : 0;
    return { dmg, e };
  }
  // 附加效果：招式有概率让对手烧伤 / 冰冻 / 麻痹 / 中毒 / 混乱
  const SIDE_FX = { fire: 'brn', ice: 'frz', spark: 'par', poison: 'psn', psychic: 'conf', ghost: 'conf' };
  async function sideEffect(att, def, mv) {
    const kind = SIDE_FX[mv.type];
    if (!kind || hpOf(def) <= 0) return;
    const chance = (kind === 'psn' ? .2 : .1) + (mv.tier === 2 ? .2 : 0);
    if (Math.random() < chance) await inflict(def, kind);
  }
  // 让一方陷入异常状态（已经有状态的不叠加；火系不会烧伤、冰系不会冻住……）
  async function inflict(side, kind) {
    const mon = monOf(side), s = SPECIES[mon.sp], name = s.en;
    if (kind === 'conf') {
      if (B.conf[side]) return false;
      B.conf[side] = 2 + rnd(3);
    } else {
      const immune = { brn: ['fire'], frz: ['ice'], par: ['spark'], psn: ['poison', 'steel'], slp: [] }[kind];
      if (mon.st || s.types.some(t => immune.includes(t))) return false;
      mon.st = kind;
      if (kind === 'slp') mon.slp = 1 + rnd(3);
    }
    updHp();
    if (B3) B3.status(side, kind);
    msg(hx('b.got', { name, got: STATUS[kind].got }));
    E.SFX.bad();
    await sleep(1000);
    return true;
  }
  // 能力升降
  async function stage(side, stat, n) {
    const cur = B.stg[side][stat], nv = Math.max(-6, Math.min(6, cur + n)), name = nm(monOf(side));
    const sl = tx('b.stat.' + stat + 'L');   // 攻击 / 防御 / 速度
    if (nv === cur) { msg(hx(n > 0 ? 'b.stg.maxUp' : 'b.stg.maxDown', { name, stat: sl })); await sleep(800); return; }
    B.stg[side][stat] = nv;
    updHp();
    if (B3) B3.buff(side, n > 0);
    msg(hx(n > 0 ? (n > 1 ? 'b.stg.up2' : 'b.stg.up1') : (n < -1 ? 'b.stg.down2' : 'b.stg.down1'), { name, stat: sl }));
    await sleep(900);
  }
  // 辅助招式的效果
  async function supEffect(att, def, sup) {
    if (sup.status) { if (!(await inflict(def, sup.status))) { msg(hx('b.noEffect')); await sleep(800); } }
    if (sup.fx) {
      for (const [stat, n] of Object.entries(sup.fx.self || {})) await stage(att, stat, n);
      for (const [stat, n] of Object.entries(sup.fx.foe || {})) await stage(def, stat, n);
    }
    if (sup.heal) {
      const mon = monOf(att), max = stats(mon).hp, v = Math.round(max * sup.heal);
      if (hpOf(att) >= max) { msg(hx('b.hpFull')); await sleep(800); return; }
      addHp(att, v); updHp();
      if (B3) B3.heal(att);
      pop(att === 'me' ? 'b-me' : 'b-foe', '+' + v, 'lbl');
      msg(hx('b.healed', { name: nm(mon) }));
      await sleep(900);
    }
  }

  // ---------- 动画 ----------
  function center(id) {
    if (B3) return B3.screenPos(id === 'b-foe' ? 'foe' : 'me');
    const a = $('b-arena').getBoundingClientRect(), r = $(id).getBoundingClientRect();
    return [r.left - a.left + r.width / 2, r.top - a.top + r.height / 2];
  }
  async function projectile(from, to, type) {
    const arena = $('b-arena'); if (!arena) return;
    const [x1, y1] = center(from), [x2, y2] = center(to);
    const p = document.createElement('span');
    p.className = 'proj orb orb-' + type;
    p.style.left = x1 + 'px'; p.style.top = y1 + 'px';
    arena.appendChild(p);
    void p.offsetWidth;
    p.style.left = x2 + 'px'; p.style.top = y2 + 'px'; p.style.transform = 'translate(-50%,-50%) scale(1.8)';
    await sleep(E.reduced ? 50 : 460);
    p.remove();
  }
  function pop(id, text, cls) {
    const arena = $('b-arena'); if (!arena || !$(id)) return;
    const [x, y] = center(id);
    const s = document.createElement('span');
    s.className = 'b-pop ' + (cls || ''); s.textContent = text;
    s.style.left = x + 'px'; s.style.top = (y - 30) + 'px';
    arena.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
  // info = { name, zh, sp }：招式英文名、中文名、出招的物种（3D 战斗的大招过场 / 中招横幅显示）
  async function strike(fromId, toId, type, dmg, labels, tier, info) {
    if (B3) {
      const from = fromId === 'b-me' ? 'me' : 'foe', to = from === 'me' ? 'foe' : 'me';
      await B3.attack(from, type, tier || 0, false, info);
      if (dmg > 0) {
        // 受击音效：有战斗合成音效（battle-sfx.js，带儿童安全的滤波和限幅）就用它的「hit」，不再叠一层老的方波 / 锯齿波音效
        if (window.BattleSFX && BattleSFX.enabled) { if (E.S.settings.sfx !== false) BattleSFX.play(type, 'hit', tier || 0); } else E.SFX.hit();
        B3.hit(to, { crit: labels.includes(tx('b.crit')) });
        pop(toId, '-' + dmg, 'dmg');
        labels.forEach((l, k) => setTimeout(() => pop(toId, l, 'lbl'), 250 + k * 250));
      } else pop(toId, 'MISS', 'lbl');
      await sleep(dmg > 0 ? (labels.includes(tx('b.crit')) ? 1300 : 1100) : 600);   // 挨打的画面多留一会儿
      return;
    }
    const f = $(fromId);
    f.classList.add('lunge', 'attack');
    await sleep(200);
    f.classList.remove('lunge');
    await projectile(fromId, toId, type);
    f.classList.remove('attack');
    const t = $(toId);
    if (dmg > 0) {
      t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
      E.SFX.hit();
      const crit = labels.includes(tx('b.crit'));
      burst(toId, type, crit);
      if (crit) { const ar = $('b-arena'); ar.classList.remove('shake'); void ar.offsetWidth; ar.classList.add('shake'); }
      pop(toId, '-' + dmg, 'dmg');
      labels.forEach((l, k) => setTimeout(() => pop(toId, l, 'lbl'), 250 + k * 250));
    } else pop(toId, 'MISS', 'lbl');
    await sleep(650);
  }

  // ---------- 英语冠军赛的特殊规则 ----------
  // words 单词擂主：小招伤害 ×1.5；listen 听力擂主：防御只有 8 秒；clear 口语擂主：念得很准 ×1.6、一般 ×0.8；talk 对话擂主：一上场就有 3 格能量
  // rotate：冠军每只怪兽换一种规则
  const RULE_KINDS = ['words', 'listen', 'clear', 'talk'];   // 说明在字表 b.rule.<规则>
  const ruleText = k => (RULE_KINDS.includes(k) ? tx('b.rule.' + k) : '');
  const ruleNow = () => !B || !B.rules ? null : B.rules.rotate ? B.rules.rotate[B.fi % B.rules.rotate.length] : B.rules.kind;
  const rule = k => ruleNow() === k;

  // ---------- 我方出手 ----------
  async function myAttack(score, why, b) {
    if (!(await canAct('me', b))) return;
    const m = me(), sm = SPECIES[m.sp], mvo = B.mv, mv = mvName(mvo);
    let mult = score >= 85 ? 1.3 : score >= 55 ? 1 : score >= 30 ? 0.6 : 0;
    if (rule('clear')) mult = score >= 85 ? 1.6 : score >= 55 ? 0.8 : score >= 30 ? 0.4 : 0;
    if (B.hinted) mult = Math.min(mult, 1);
    // 暴击：念得很准（每个词都对，打分最多 84 分就不会到 85）而且没看提示
    const crit = score >= 85 && !B.hinted && !mvo.sup;
    // 🔥 不看字念：中招念对伤害 ×1.5（念不好就按普通的算，不额外扣）
    const blind = B.blind && !B.hinted && score >= 55 && !mvo.sup;
    if (blind) mult *= 1.5;
    if (rule('words') && mvo.tier === 0 && !mvo.sup) mult *= 1.5;
    mult *= hearts(m) >= 5 ? 1.1 : hearts(m) >= 3 ? 1.05 : 1;
    panel('');
    msg(hx('b.used', { name: nm(m), mv: mv[0] }));
    E.say(nm(m) + ', use ' + mv[0] + '!');
    if (mvo.sup) {
      if (score < 55) { msg(hx('b.supFail', { why: why || tx('b.why.unclear'), mv: mv[0] })); await sleep(1000); return; }
      B.energy = Math.min(3, B.energy + 1);
      if (B3) await B3.attack('me', mvo.type, 0, true, { name: mv[0], zh: gloss({ zh: mv[1] }) || '', sp: spOf(m) });
      await supEffect('me', 'foe', mvo.sup);
      return;
    }
    const { dmg, e } = damage('me', 'foe', mvo, mult);
    if (mvo.tier === 2) B.energy = 0; else if (mult) B.energy = Math.min(3, B.energy + 1);
    const labels = [];
    if (crit && dmg) labels.push(tx('b.crit'));
    if (blind && dmg) labels.push(tx('b.lbl.mem'));
    if (dmg && effLabel(e)) labels.push(effLabel(e));
    await strike('b-me', 'b-foe', mvo.type, dmg, labels, mvo.tier, { name: mv[0], zh: gloss({ zh: mv[1] }) || '', sp: spOf(m) });
    if (!live(b)) return;
    addHp('foe', -dmg);
    if (dmg && foe().st === 'frz' && mvo.type === 'fire') { foe().st = null; }
    updHp();
    msg(dmg ? hx(crit ? (blind ? 'b.hit.critBlind' : 'b.hit.crit') : blind ? 'b.hit.blind' : mult < 1 ? 'b.hit.graze' : 'b.hit.ok') + (e > 1 ? hx('b.hit.weak') : e < 1 ? hx('b.hit.low') : '') : hx('b.miss', { why: why || tx('b.why.miss') }));
    await sleep(900);
    if (dmg) await sideEffect('me', 'foe', mvo);
  }
  // 叫醒自己的怪兽
  async function resolveWake(score, b) {
    const m = me(), name = nm(m), slp = m.st === 'slp';
    panel('');
    if (score >= 55 && Math.random() < (score >= 85 ? .9 : .6)) {
      m.st = null; updHp();
      msg(hx(slp ? 'b.wk.slp' : 'b.wk.frz', { name }));
      E.SFX.ok(2);
    } else msg(hx(slp ? 'b.wk.no.slp' : 'b.wk.no.frz', { name, tip: tx(score < 55 ? 'b.wk.tip.clear' : 'b.wk.tip.next') }));
    await sleep(1100);
  }

  // ---------- 对手出手：听懂它的咒语来防御 ----------
  function foeMoveChoice(f) {
    const mv = movesOf(f), dmgMv = mv.filter(x => !x.sup && x.tier < 2), ult = mv.find(x => x.tier === 2), sup = mv.filter(x => x.sup);
    if (ult && B.fen >= 3 && (B.kind !== 'wild' || Math.random() < .4)) { B.fen = 0; return ult; }
    if (sup.length && Math.random() < .22) {
      const s = pick(sup);
      if (!(s.sup.status && (me().st || s.sup.status === 'conf' && B.conf.me))) return s;
    }
    return dmgMv.length ? pick(dmgMv) : { type: SPECIES[f.sp].types[0], tier: 0 };
  }
  async function foeAct(b) {
    const f = foe(), sf = SPECIES[f.sp];
    // 训练师和岛主体力低的时候会用药
    if (B.fpot > 0 && B.foeHp < stats(f).hp * .3 && Math.random() < .7) {
      B.fpot--;
      const v = Math.round(stats(f).hp * .5);
      addHp('foe', v); updHp();
      if (B3) B3.heal('foe');
      pop('b-foe', '+' + v, 'lbl');
      msg(hx('b.foePotion', { who: B.kind === 'leader' ? bossName(B.z) : B.trainer.name, name: sf.en }));
      E.say('Here, take this potion!', undefined, 'm');
      await sleep(1300);
      return;
    }
    if (!(await canAct('foe', b))) return;
    B.fen++;
    const mvo = foeMoveChoice(f);
    await new Promise(res => { B.defDone = res; foeTurn(b, mvo); });
  }
  async function foeTurn(b, mvo) {
    B.turn = 'foe';
    const f = foe(), sf = SPECIES[f.sp], mv = mvo.tier === 0 && !mvo.sup ? 0 : 1, esc = E.esc;
    let d;
    // 听力防御也先出今天到期的复习题（pickQ），干扰项从同一个小岛 / 单元里挑
    // 选项是这句咒语的中文意思；界面语言里没有意思（英语界面）就改成「它念的是哪一句」，选项是英文原句（单词题照样带图）
    const mean = x => gloss({ zh: x[1] }), byEn = mean(['', '-']) == null;
    if (E.lang) d = langDef(mv);   // 别的语言的课：意思按 E.meanOf（英语界面给英文意思），中文课的条目没有中文意思也挑得出干扰项
    else if (mv === 0) {
      const p = pickQ('word'), it = p.it;
      const others = shuffle(p.d.words.filter(x => x !== it && x[1] !== it[1] && (!byEn || x[0] !== it[0]))).slice(0, 2);
      d = { q: p.q, spell: it[0], ans: it[0] + (byEn ? '' : ' = ' + it[1]), opts: shuffle([{ c: true, e: it[2], t: byEn ? it[0] : it[1] }, ...others.map(o => ({ e: o[2], t: byEn ? o[0] : o[1] }))]) };
    } else {
      const p = pickQ('sent'), it = p.it;
      const others = shuffle(p.d.sents.filter(x => x[0] !== it[0] && x[1] !== it[1])).slice(0, 2);
      d = { q: p.q, spell: it[0], ans: it[0] + (byEn ? '' : ' = ' + it[1]), opts: shuffle([{ c: true, t: byEn ? it[0] : it[1] }, ...others.map(o => ({ t: byEn ? o[0] : o[1] }))]) };
    }
    d.mv = mv; d.mvo = mvo; d.type = mvo.type; B.def = d;
    const nm = mvName(mvo);
    msg(hx(mvo.tier === 2 ? 'b.def.msgUlt' : 'b.def.msg', { name: sf.en, mv: nm[0], zh: zhOf({ zh: nm[1] }) }));
    panel('<div class="task def"><div class="task-h">' + hx((E.lang ? d.byEn : byEn) ? 'b.def.hEn' : 'b.def.h') + '</div><div class="b-timer"><i id="b-timer"></i></div>' +
      '<div class="say-row"><button class="spk mini" data-act="bDefHear" aria-label="' + hx('b.hearAgain') + '">' + E.SPK + '</button></div>' +
      '<div class="opts' + (mv === 0 ? '' : ' list') + '">' + d.opts.map((o, k) => '<button class="opt" data-act="bDef" data-i="' + k + '">' + (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + (E.lang ? E.ruby(o.t) : esc(o.t)) + '</span></button>').join('') + '</div></div>');
    $('b-foe').classList.add('attack');
    await E.say(d.spell, undefined, 'm');
    if (!live(b) || B.def !== d || d.done) return;
    $('b-foe').classList.remove('attack');
    const bar = $('b-timer');
    const dt = rule('listen') ? 8 : 12;
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = 'width ' + dt + 's linear'; bar.style.width = '0%'; }
    B.defTimer = setTimeout(() => { if (live(b) && B.def === d) defend(-1); }, dt * 1000);
  }
  // 别的语言的课：对手念的咒语（课程里的词 / 句子），选它的意思；有一个选项没有意思（比如中文界面学中文）就选听到的原文
  function langDef(mv) {
    const p = pickQ(mv === 0 ? 'word' : 'sent'), it = p.it, L = mv === 0 ? p.d.words : p.d.sents, m = x => E.meanOf(x);
    const others = shuffle(L.filter(x => x !== it && x[0] !== it[0] && (m(x) == null || m(x) !== m(it)))).slice(0, 2);
    const byM = [it].concat(others).every(x => m(x) != null);
    const opt = x => Object.assign(mv === 0 ? { e: x[2] } : {}, { t: byM ? m(x) : x[0] });
    return { q: p.q, spell: it[0], ans: it[0] + (byM ? ' = ' + m(it) : ''), byEn: !byM, opts: shuffle([Object.assign(opt(it), { c: true })].concat(others.map(opt))) };
  }
  async function defend(i) {
    const d = B && B.def;
    if (!d || d.done) return;
    d.done = true;
    clearTimeout(B.defTimer);
    const b = B, ok = i >= 0 && d.opts[i].c, finish = () => { const r = B && B.defDone; if (B) B.defDone = null; if (r) r(); };
    document.querySelectorAll('#b-panel .opt').forEach((btn, k) => btn.classList.add(d.opts[k].c ? 'right' : k === i ? 'wrong' : 'dim'));
    const bar = $('b-timer'); if (bar) { bar.style.transition = 'none'; }
    if (ok) { B.energy = Math.min(3, B.energy + 1); E.S.stats.listen++; E.qProg('listen', 1); E.SFX.ok(2); if (E.revRight) E.revRight(d.q); }
    else { (E.revMiss || E.addWrong)(d.q); E.SFX.bad(); }   // 没听懂：复习本里只降一格
    msg(ok ? hx('b.def.ok') + hx(d.mvo.sup ? 'b.def.okSup' : 'b.def.okHit') : hx(i < 0 ? 'b.def.late' : 'b.def.wrong') + hx('b.def.ans', { ans: d.ans }));
    await sleep(700);
    if (!live(b)) return finish();
    panel('');
    const fo = foe(), fn = mvName(d.mvo), fi = fo ? { name: fn[0], zh: gloss({ zh: fn[1] }) || '', sp: spOf(fo) } : null;   // 给 3D 战斗的招式名（中文名中文界面才有）和物种
    if (d.mvo.sup) {
      if (B3) await B3.attack('foe', d.type, 0, true, fi);
      if (!ok) await supEffect('foe', 'me', d.mvo.sup);
      return finish();
    }
    const { dmg: raw, e } = damage('foe', 'me', d.mvo, [0.8, 1, 1.15][d.mvo.tier] * 1);
    let dmg = Math.max(1, Math.round(raw * (ok ? 0.15 : 1)));
    // 很亲的怪兽：本来要倒下了，想着主人又站了起来
    const hold = hearts(me()) >= 4 && B.hp[me().uid] > 1 && dmg >= B.hp[me().uid] && Math.random() < .2;
    if (hold) dmg = B.hp[me().uid] - 1;
    await strike('b-foe', 'b-me', d.type, dmg, ok ? [tx('b.lbl.block')] : effLabel(e) ? [effLabel(e)] : [], d.mvo.tier, fi);
    if (!live(b)) return finish();
    addHp('me', -dmg);
    if (hold) { msg(hx('b.hold', { name: nm(me()) })); E.say(nm(me()) + ' did not give up!'); await sleep(1300); }
    if (me().st === 'frz' && d.type === 'fire') me().st = null;
    updHp();
    await sleep(500);
    if (!ok && live(b)) await sideEffect('foe', 'me', d.mvo);
    finish();
  }

  // ---------- 经验、升级、学新招 ----------
  function gainMonXp(mon, xp, quiet) {
    mon.xp += xp;
    ensureMoves(mon);
    while (mon.xp >= xpNeed(mon.lv) && mon.lv < 100) {
      mon.xp -= xpNeed(mon.lv); mon.lv++;
      befriend(mon, 2);
      if (B && B.hp[mon.uid] > 0) { B.hp[mon.uid] += 6; updHp(); }
      if (!quiet) E.toast(tx('b.lvup', { name: nm(mon), lv: mon.lv }), 'gold');
      const pend = M().pendingEvo || (M().pendingEvo = []);
      if (lvEvo(mon) && !pend.includes(mon.uid)) pend.push(mon.uid);
      learnAt(mon, mon.lv);
    }
  }
  // 到了这个等级能学的招式：没满 4 个直接学会，满了就排队问要不要换
  function learnAt(mon, lv) {
    learnset(SPECIES[mon.sp]).filter(([l]) => l === lv).forEach(([, id]) => {
      if (mon.moves.includes(id)) return;
      if (mon.moves.length < 4) { mon.moves.push(id); E.toast(tx('b.learned', { name: nm(mon), mv: mvName(parseMove(id))[0] }), 'gold'); }
      else (M().pendingLearn || (M().pendingLearn = [])).push({ u: mon.uid, id });
    });
  }
  // 学新招：选一个忘掉，然后大声说 "Emberpup, learn Flame Wave!"
  function learnNext() {
    const q = M().pendingLearn || [];
    if (!q.length || !$('modal').hidden) return false;
    const it = q[0], mon = byUid(it.u);
    if (!mon || mon.moves.includes(it.id)) { q.shift(); E.save(); return learnNext(); }
    const s = SPECIES[mon.sp], nm = mvName(parseMove(it.id));
    E.openModal('<h2>' + hx('b.learn.t', { name: s.en }) + '</h2><div class="learn-new">' + moveCard(parseMove(it.id)) + '</div><p>' + hx('b.learn.p', { mv: nm[0] }) + '</p>' +
      '<div class="learn-old">' + mon.moves.map((id, k) => '<button class="btn ghost" data-act="mForget" data-k="' + k + '">' + moveCard(parseMove(id)) + '</button>').join('') + '</div>' +
      '<button class="btn ghost wide" data-act="mForget" data-k="-1">' + hx('b.learn.no') + '</button>', { locked: true });
    E.say(s.en + ' can learn ' + nm[0] + ' now!');
    return true;
  }
  function forget(k) {
    const q = M().pendingLearn || [], it = q[0];
    if (!it) { E.closeModal(); return; }
    const mon = byUid(it.u), s = SPECIES[mon.sp], nm = mvName(parseMove(it.id));
    if (k < 0) { q.shift(); E.save(); E.closeModal(); E.toast(tx('b.learn.skip', { name: s.en, mv: nm[0] })); setTimeout(afterBattleQueue, 300); return; }
    const old = mvName(parseMove(mon.moves[k]));
    const ln = learnL('learn a move'), line = ln ? ln.t : s.en + ', learn ' + nm[0] + '!', sr = E.speakMode() === 'sr';   // 别的课：换成这座岛课程里的一句
    E.openModal('<h2>' + hx('b.learn.ok', { mv: old[0] }) + '</h2><p>' + hx('b.learn.say') + '</p><div class="say-text" id="lr-say">' + E.wordsHTML(line) + '</div>' + meanHTML(ln) +
      (sr ? '<button class="mic" id="lr-mic" data-act="mLearnMic" data-k="' + k + '">' + E.MIC + '</button><div class="mic-hint" id="lr-hint">' + hx('b.mic.say') + '</div>' : '<button class="btn leaf wide" data-act="mLearnGo" data-k="' + k + '">' + hx('b.said') + '</button>') +
      '<button class="btn ghost wide" data-act="mHearLearn">' + hx('b.listen') + '</button>', { locked: true });
    E.say(line);
  }
  function learnDone(k) {
    const q = M().pendingLearn || [], it = q.shift();
    if (!it) return;
    const mon = byUid(it.u);
    if (mon) mon.moves[k] = it.id;
    E.save(); E.closeModal(); E.SFX.win();
    E.toast(tx('b.learned', { name: nm(mon), mv: mvName(parseMove(it.id))[0] }), 'gold');
    setTimeout(afterBattleQueue, 400);
  }
  async function learnMic(k) {
    const m = $('lr-mic'); if (!m) return;
    if (E.RT.listening) { E.stopListening(); return; }
    m.classList.add('on'); m.innerHTML = E.STOP; $('lr-hint').textContent = tx('b.mic.on');
    const it = (M().pendingLearn || [])[0], ln = learnL('learn a move'), line = ln ? ln.t : it ? nm(byUid(it.u)) + ', learn ' + mvName(parseMove(it.id))[0] : '';
    const res = await E.recognize(null, [line]);
    if (!$('lr-mic')) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) { E.RT.srBroken = true; learnDone(k); return; }
    if (!res.alts.length) {
      // AI 打分用不了（没网 / 额度 / 没密钥）：招式先学会，不卡在这里
      if (res.fail !== 'unheard' && E.aiDown && E.aiDown()) { E.toast(tx('b.learn.ai')); learnDone(k); return; }
      $('lr-hint').textContent = E.failHint ? E.failHint(res) : tx('b.mic.again'); return;
    }
    if (E.bestScore(line, res.alts).score >= 45) learnDone(k); else $('lr-hint').textContent = tx('b.learn.again');
  }
  // 战斗结束后依次处理：学新招 → 进化
  function afterBattleQueue() {
    const pn = M().pendingNick;
    if (pn && pn.length && !B) { const u = pn.shift(); E.save(); if (byUid(u)) { nickSheet(u, 'queue'); return; } }
    if (!learnNext()) evolveNext();
  }

  async function foeFaint(b) {
    const f = foe(), sf = SPECIES[f.sp];
    $('b-foe').classList.add('faint');
    if (B3) B3.faint('foe');
    msg(hx('b.tired', { name: sf.en }));
    E.say(sf.en + ' is too tired to go on.');
    shareXp(10 + f.lv * 8);
    const eb = $('b-exp'), cm = me(); if (eb && cm) eb.style.width = (cm.xp / xpNeed(cm.lv) * 100) + '%';
    E.save();
    await sleep(1400);
    if (!live(b)) return;
    if (B.fi + 1 < B.foes.length) {
      B.fi++;
      B.foeHp = stats(foe()).hp; B.stg.foe = newStages(); B.conf.foe = 0; B.fen = 0;
      // 冠军换怪兽也换规则
      if (B.rules && B.rules.rotate) { if (rule('talk')) B.energy = 3; E.toast(ruleText(ruleNow()), 'gold'); }
      await prep([spOf(foe())]);
      if (!live(b)) return;
      B.enter = 'foe';
      renderBattle();
      const n = SPECIES[foe().sp];
      msg(hx('b.in.next', { who: B.kind === 'trainer' ? B.trainer.name : bossName(B.z), name: n.en }));
      $('b-foe').classList.add('appear');
      if (B3) B3.enter('foe', true);
      await E.say(n.en + ', your turn!', undefined, 'm');
      if (!live(b)) return;
      menu();
    } else win(b, false);
  }
  // 经验：出过场的拿全部；带着共学耳机的话，队伍里其他怪兽也拿一半
  function shareXp(xp) {
    B.used.forEach(u => { const mm = byUid(u); if (mm && B.hp[u] > 0) gainMonXp(mm, xp); });
    if (itemCount('expshare') > 0 && M().expShareOn !== false) B.team.forEach(u => { if (!B.used.has(u)) { const mm = byUid(u); if (mm && B.hp[u] > 0) gainMonXp(mm, Math.round(xp / 2), true); } });
  }
  async function myFaint(b) {
    const m = me();
    $('b-me').classList.add('faint');
    if (B3) B3.faint('me');
    msg(hx('b.down', { name: nm(m) }));
    m.st = null;
    await sleep(1300);
    if (!live(b)) return;
    const next = B.team.findIndex((u, k) => k !== B.ti && B.hp[u] > 0);
    if (next >= 0) {
      await prep([spOf(byUid(B.team[next]))]);
      if (!live(b)) return;
      B.ti = next; B.used.add(B.team[next]); B.stg.me = newStages(); B.conf.me = 0;
      B.enter = 'me';
      renderBattle();
      msg(hx('b.go', { name: nm(me()) }));
      $('b-me').classList.add('appear');
      if (B3) B3.enter('me', true);
      await E.say(nm(me()) + ', your turn!');
      if (!live(b)) return;
      menu();
    } else lose(b);
  }

  // ---------- 收服 ----------
  async function resolveCatch(score, b) {
    const f = foe(), sf = SPECIES[f.sp], max = stats(f).hp, sup = B.ball === 'superball';
    addItem(sup ? 'superball' : 'ball', -1);
    panel('');
    msg(hx(sup ? 'b.throw.s' : 'b.throw'));
    const ball = document.createElement('span');
    ball.className = 'proj ball';
    const arena = $('b-arena'), [x1, y1] = center('b-me'), [x2, y2] = center('b-foe');
    ball.style.left = x1 + 'px'; ball.style.top = y1 + 'px';
    arena.appendChild(ball); void ball.offsetWidth;
    ball.style.left = x2 + 'px'; ball.style.top = (y2 + 20) + 'px';
    if (B3) await B3.catchThrow(sup); else await sleep(500);
    if (!live(b)) return 'end';
    $('b-foe').classList.add('caught-in');
    ball.classList.add('wobble');
    // 收服的机会：体力越少越好收、咒语念得越清楚越好收；睡着 / 冻住 ×1.6，别的异常 ×1.3，金回声球 ×1.4，神兽难收
    const stBonus = f.st === 'slp' || f.st === 'frz' ? 1.6 : f.st ? 1.3 : 1;
    const p = (0.3 + 0.7 * (1 - Math.max(0, B.foeHp) / max)) * (score >= 85 ? 1.25 : score >= 55 ? 1 : 0.5) * (sup ? 1.4 : 1) * (sf.legend ? .35 : 1) * stBonus;
    const ok = Math.random() < p;
    // 回声球（海螺）里传出两声回声：两声都响完就收服了；不成的话第一声就停
    for (let k = 0; k < 2; k++) { E.SFX.tap(); if (B3) await B3.wobble(); else await sleep(600); if (!live(b)) return 'end'; if (!ok && k === 0) break; }
    if (ok) {
      ball.classList.remove('wobble'); ball.classList.add('sealed');
      if (B3) B3.sealed();
      shareXp(10 + f.lv * 8);
      const mon = newMon(f.sp, f.lv);
      mon.moves = f.moves.slice();
      if (f.shiny) { mon.shiny = true; (M().shinyDex = M().shinyDex || {})[f.sp] = 1; }
      mon.fr = 70;
      addMon(mon);
      if (!M().team.includes(mon.uid)) B.toBox = true;
      M().dex[f.sp] = 'caught';
      (M().pendingNick = M().pendingNick || []).push(mon.uid);
      M().caught = (M().caught || 0) + 1;
      E.qProg('catch', 1);
      E.jingle('catch', E.SFX.win); E.confetti(140);
      msg(hx('b.caught', { name: sf.en, zh: zhOf(sf) }));
      E.say('Yes! ' + sf.en + ' is your new friend!');
      E.save();
      await sleep(1200);
      if (!live(b)) return 'end';
      win(b, true);
      return 'end';
    }
    ball.remove();
    $('b-foe').classList.remove('caught-in');
    if (B3) B3.breakOut();
    E.SFX.bad();
    msg(hx('b.free', { name: sf.en }) + hx(score < 55 ? 'b.free.say' : 'b.free.weak'));
    E.save();
    await sleep(1200);
  }

  // ---------- 结算 ----------
  function win(b, caught) {
    B.turn = 'done';
    const m = M(), z = B.z, w = E.W[z];
    const topLv = Math.max(...B.foes.map(f => f.lv));
    let coins = 8 + topLv * 2, badge = false;
    const lines = [];
    if (B.kind === 'trainer') coins += 6 + topLv;
    if (B.kind === 'leader') {
      const first = !m.badges[z];
      m.badges[z] = 1;
      coins += first ? 40 : 10;
      if (first) { badge = true; m.balls += 3; lines.push(hx('b.win.badge', { isle: isleName(z) })); lines.push(hx('b.win.balls')); lines.push(hx('b.win.obey', { n: 20 + 10 * Object.keys(m.badges).length })); if (z + 1 < E.W.length) lines.push(hx('b.win.unlock', { isle: isleName(z + 1) })); }
    }
    E.S.coins += coins;
    B.result = caught ? 'caught' : 'win';
    writeBack();
    lines.unshift(hx('b.win.coins', { n: coins }));
    lines.push(hx('b.win.xp', { n: 10 + topLv * 8 }) + (itemCount('expshare') > 0 && m.expShareOn !== false ? hx('b.win.share') : ''));
    E.gainXp(15 + topLv);
    B.used.forEach(u => befriend(byUid(u), B.kind === 'wild' ? 1 : 3));
    m.wins = (m.wins || 0) + 1;
    E.qProg('battle', 1);
    const newDay = E.markToday();
    E.save(); E.renderTop();
    if (!caught) { E.jingle(badge ? 'badge' : 'win', E.SFX.win); E.confetti(B.kind === 'leader' ? 200 : 90); }
    E.music('victory');   // 号角放完接着放结算画面的音乐
    msg(caught ? hx(B.toBox ? 'b.win.box' : 'b.win.team') : B.kind === 'leader' ? hx('b.win.leader', { who: bossName(z) }) : B.kind === 'trainer' ? hx('b.win.trainer', { who: B.trainer.name }) : hx('b.win'));
    // 经验条只在结算画面出现（对战时的状态栏不放）
    const xm = me(), xpBar = xm ? '<div class="res-exp"><span>' + E.esc(nm(xm)) + ' <small>Lv ' + xm.lv + '</small></span><div class="xpbar" title="' + hx('b.xp') + '"><i style="width:' + Math.min(100, xm.xp / xpNeed(xm.lv) * 100) + '%"></i></div></div>' : '';
    panel('<div class="b-result"><div class="big">' + (caught ? '🔮' : B.kind === 'leader' ? '🏅' : '🏆') + '</div><b>' + hx(caught ? 'b.res.caught' : B.kind === 'leader' ? 'b.res.leader' : 'b.win') + '</b><p>' + lines.join('<br>') + '</p>' + xpBar +
      '<div class="say-row">' + (B.onEnd ? '<button class="btn" data-act="bEnd" data-focus>' + hx('b.res.go') + '</button>'
        : (B.kind === 'wild' ? '<button class="btn" data-act="mWild" data-z="' + z + '">' + hx('b.res.again') + '</button>' : '') + '<button class="btn ghost" data-act="bHome">' + hx('b.res.home') + '</button>') + '</div></div>');
    if (newDay) setTimeout(() => E.toast(tx('b.streak', { n: E.S.streak }), 'gold'), 900);
    setTimeout(() => { E.checkAch(); afterBattleQueue(); }, 1300);
  }
  function lose() {
    B.turn = 'done'; B.result = 'lose';
    writeBack();
    E.jingle('lose'); E.music(null);
    msg(hx('b.lose'));
    panel('<div class="b-result"><div class="big">💤</div><b>' + hx('b.lose.t') + '</b><p>' + hx('b.lose.p') + '</p><div class="say-row">' +
      (B.onEnd ? '<button class="btn" data-act="bEnd" data-focus>' + hx('b.lose.go') + '</button>' : '<button class="btn" data-act="bHome">' + hx('b.res.home') + '</button>') + '</div></div>');
  }
  // 战斗里用道具：回复体力或治异常状态，用掉这一回合
  function usePotion(id) {
    id = id || 'potion';
    if (!B || B.turn !== 'me' || itemCount(id) <= 0) return;
    const b = B, m = me(), max = stats(m).hp, it = ITEMS[id];
    if (it.heal ? B.hp[m.uid] >= max : !(STATUS_HEAL[id] || []).includes(m.st)) return;
    E.closeModal();
    B.turn = 'busy';
    round(b, Object.assign(async () => {
      addItem(id, -1);
      panel('');
      if (it.heal) {
        const heal = Math.max(20, Math.round(max * it.heal));
        B.hp[m.uid] = Math.min(max, B.hp[m.uid] + heal);
        msg(hx('b.potion.hp', { item: label(it), name: nm(m) }));
        pop('b-me', '+' + heal, 'lbl');
      } else { m.st = null; msg(hx('b.potion.st', { item: label(it), name: nm(m) })); }
      E.SFX.coin();
      if (B3) B3.heal('me');
      updHp(); E.save();
      await sleep(1100);
    }, { priority: true }));
  }
  // 进化排队保存在存档里：就算中途离开战斗，回到基地也会补上进化动画
  function evolveNext() {
    const pend = M().pendingEvo || [];
    if (!pend.length || !$('modal').hidden) return;
    const u = pend.shift(); E.save();
    const mon = byUid(u), ev = mon && lvEvo(mon);
    if (!ev) { evolveNext(); return; }
    evolveTo(mon, ev.to);
  }
  function evolveTo(mon, toId) {
    const from = SPECIES[mon.sp], to = SPECIES[toId];
    if (window.Mon3D && Mon3D.preload) Mon3D.preload([toId]);
    E.openModal('<h2>' + hx('b.evo.t', { name: from.en }) + '</h2><div class="evo-stage"><div class="evo-old">' + svg(mon.sp) + '</div><div class="evo-new">' + svg(toId) + '</div></div>' +
      '<p id="evo-t">' + hx('b.evo.p', { name: label(from) }) + '</p><button class="btn sun wide" data-act="mEvoOk" id="evo-ok" hidden>' + hx('b.evo.ok') + '</button>', { locked: true });
    E.say('Look! ' + from.en + ' is growing up!');
    E.music('evolve');
    mon.sp = toId;
    M().dex[toId] = 'caught';
    M().evolved = (M().evolved || 0) + 1;
    E.save();
    setTimeout(() => {
      const st = document.querySelector('.evo-stage'); if (st) st.classList.add('done');
      const t = $('evo-t'); if (t) t.innerHTML = hx('b.evo.done', { from: from.en, to: to.en, zh: zhOf(to) });
      const ok = $('evo-ok'); if (ok) ok.hidden = false;
      E.jingle('levelup', E.SFX.win); E.confetti(180);
      E.say(from.en + ' has grown up! Say hello to ' + to.en + '!');
      E.checkAch();
    }, 2600);
  }

  // ---------- 怪兽详情 ----------
  function moveCard(mv) {
    const nm = mvName(mv);
    const tier = (I18N ? I18N.raw('b.tier') || [] : [])[mv.tier] || '';
    return '<span class="mv-card" style="--tc:' + TYPES[mv.type].color + '"><span class="mv-ico">' + TICON[mv.type] + '</span><b>' + nm[0] + '</b><small>' + [gloss({ zh: nm[1] }) || '', label(TYPES[mv.type]), mv.sup ? mv.sup.desc : tier].filter(Boolean).map(x => E.esc(x)).join(' · ') + '</small></span>';
  }
  function summarySheet(u, back) {
    const mon = byUid(u); if (!mon) return;
    if (mon.egg) { E.openModal('<div class="sum-top"><span class="sum-pic">' + EGG_SVG + '</span><div><h2>' + hx('b.egg') + '</h2><p>' + hx(eggHint(mon)) + '</p><p class="tip">' + hx('b.egg.tip') + '</p></div></div><button class="btn ghost wide" data-act="' + (back || 'mTeam') + '">' + hx('b.back') + '</button>'); return; }
    ensureMoves(mon);
    const s = SPECIES[mon.sp], st = stats(mon), hp = curHp(mon), esc = E.esc;
    const bar = (k, v, max) => '<div class="sum-stat"><span>' + k + '</span><b>' + v + '</b><i><em style="width:' + Math.min(100, v / max * 100) + '%"></em></i></div>';
    const nextEvo = (s.evo || []).map(e => e.lv ? tx('b.sum.evoLv', { lv: e.lv, name: SPECIES[e.to].en }) : label(D.STONES[e.item]) + ' → ' + SPECIES[e.to].en).join(tx('b.sep.semi'));
    const nextMoves = learnset(s).filter(([l, id]) => l > mon.lv && !mon.moves.includes(id)).slice(0, 2).map(([l, id]) => 'Lv ' + l + ' ' + mvName(parseMove(id))[0]).join(tx('b.sep.comma'));
    const talked = (M().talked || {})[mon.uid] === E.dayStr(), dz = gloss({ zh: s.dexZh });
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + (mon.shiny ? '✨' : '') + nm(mon) + ' <small>' + subName(mon) + '</small></h2>' +
      '<div class="sum-fr">' + hx('b.fr') + ' ' + heartsHTML(mon) + ' <button class="btn small ' + (talked ? 'ghost' : 'sun') + '" data-act="mTalk" data-u="' + mon.uid + '">' + hx(talked ? 'b.talk.done' : 'b.talk.go') + '</button> <button class="btn small ghost" data-act="mNick" data-u="' + mon.uid + '">' + hx('b.nick.btn') + '</button></div><div class="chips">' + chips(mon.sp) + '<span class="lvchip">Lv ' + mon.lv + '</span>' + (mon.st ? '<span class="st-chip" style="--sc:' + STATUS[mon.st].color + '">' + esc(label(STATUS[mon.st])) + '</span>' : '') + '</div>' +
      '<small>' + hx('b.sum.xp', { a: mon.xp, b: xpNeed(mon.lv) }) + '</small><div class="xpbar"><i style="width:' + (mon.xp / xpNeed(mon.lv) * 100) + '%"></i></div></div></div>' +
      '<div class="sum-stats">' + bar(hx('b.sum.hp'), hp + '/' + st.hp, st.hp) + bar(hx('b.sum.atk'), st.atk, 250) + bar(hx('b.sum.def'), st.def, 250) + bar(hx('b.sum.spd'), st.spd, 250) + '</div>' +
      '<h3 class="pc-h">' + hx('b.sum.moves') + '</h3><div class="sum-moves">' + mon.moves.map(id => moveCard(parseMove(id))).join('') + '</div>' +
      (nextMoves ? '<p class="tip">' + hx('b.sum.next', { list: nextMoves }) + '</p>' : '') + (nextEvo ? '<p class="tip">' + hx('b.sum.evo', { list: nextEvo }) + '</p>' : '') +
      '<p class="dex-en">' + esc(s.dexEn) + '</p>' + (dz ? '<p class="dex-zh">' + esc(dz) + '</p>' : '') +
      '<button class="btn ghost wide" data-act="' + (back || 'mTeam') + '">' + hx('b.back') + '</button>');
  }

  // ---------- 英文昵称 ----------
  // 按属性推荐几个英文名字，也可以自己输入；起好以后要对它说 "Your name is ...!"
  const NICKS = {
    fire: ['Blaze', 'Sunny', 'Ember', 'Chilli'], water: ['Bubbles', 'Splash', 'Ocean', 'Wave'], grass: ['Leafy', 'Mint', 'Clover', 'Bean'], spark: ['Zippy', 'Flash', 'Bolt', 'Buzz'],
    ice: ['Snowy', 'Frosty', 'Icy', 'Crystal'], rock: ['Rocky', 'Pebble', 'Stone', 'Boulder'], ground: ['Sandy', 'Dusty', 'Digger', 'Muddy'], flying: ['Sky', 'Feather', 'Breezy', 'Wings'],
    bug: ['Buggy', 'Beetle', 'Dotty', 'Wiggle'], poison: ['Violet', 'Plum', 'Grape', 'Stinky'], psychic: ['Dream', 'Moony', 'Wonder', 'Star'], ghost: ['Boo', 'Shadow', 'Misty', 'Spooky'],
    dark: ['Midnight', 'Ninja', 'Coal', 'Shade'], steel: ['Iron', 'Tin', 'Bolty', 'Robo'], dragon: ['Drago', 'Legend', 'Ace', 'Scales'], fight: ['Champ', 'Punchy', 'Rocky', 'Hero'], normal: ['Buddy', 'Coco', 'Teddy', 'Lucky'],
  };
  let nickCtx = null;
  function nickSheet(u, then) {
    const mon = byUid(u); if (!mon) { if (then === 'queue') afterBattleQueue(); return; }
    const s = SPECIES[mon.sp], pool = [...new Set((NICKS[s.type] || []).concat(NICKS.normal, ['Momo', 'Pepper', 'Cookie', 'Max']))].slice(0, 8);
    nickCtx = { u, then, name: '' };
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + hx('b.nick.t', { name: nm(mon) }) + '</h2><p>' + hx('b.nick.p') + '</p></div></div>' +
      '<div class="nm-grid">' + pool.map(n => '<button class="btn ghost nm" data-act="mNickPick" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="nm-own"><input id="nick-in" maxlength="10" placeholder="' + hx('b.nick.ph') + '" autocomplete="off" autocapitalize="words" spellcheck="false"><button class="btn sun" data-act="mNickOwn">' + hx('b.ok') + '</button></div><small class="tip" id="nick-tip">' + hx('b.nick.tip') + '</small>' +
      '<div class="row"><button class="btn ghost" data-act="mNickSkip">' + (mon.nick ? hx('b.nick.keep') : hx('b.nick.use', { name: s.en })) + '</button>' + (mon.nick ? '<button class="btn ghost" data-act="mNickClear">' + hx('b.nick.clear', { name: s.en }) + '</button>' : '') + '</div>', { locked: true });
    // 弹出软键盘以后（横屏时屏幕只剩一小条），输入框要留在看得见的地方
    const inp = $('nick-in'); if (inp) inp.addEventListener('focus', () => setTimeout(() => { if (inp.isConnected) inp.scrollIntoView({ block: 'center' }); }, 300));
  }
  function nickSay(name) {
    if (!nickCtx) return;
    const mon = byUid(nickCtx.u); if (!mon) return;
    nickCtx.name = name;
    const ln = learnL('your name is'), line = ln ? ln.t : 'Your name is ' + name + '!', sr = E.speakMode() === 'sr';   // 别的课：换成这座岛课程里的一句
    nickCtx.line = line;
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + name + '</h2><p>' + hx('b.nick.say') + '</p></div></div><div class="say-text" id="nick-say">' + E.wordsHTML(line) + '</div>' + meanHTML(ln) +
      '<button class="spk mini" data-act="mNickHear" aria-label="' + hx('b.hear') + '">' + E.SPK + '</button>' +
      (sr ? '<button class="mic" id="nick-mic" data-act="mNickMic">' + E.MIC + '</button><div class="mic-hint" id="nick-hint">' + hx('b.mic.say') + '</div>' : '<button class="btn leaf wide" data-act="mNickGo">' + hx('b.said') + '</button>') +
      '<button class="link" data-act="mNickBack">' + hx('b.nick.back') + '</button>', { locked: true });
    E.say(line);
  }
  function nickDone(ok) {
    const c = nickCtx; nickCtx = null;
    const mon = c && byUid(c.u);
    if (mon && ok && c.name) {
      mon.nick = c.name === SPECIES[mon.sp].en ? undefined : c.name;
      befriend(mon, 5);
      E.S.stats.spoken = (E.S.stats.spoken || 0) + 1;
      E.save(); E.SFX.win();
      E.toast('💖 ' + (mon.nick ? tx('b.nick.done', { name: mon.nick }) : tx('b.nick.orig')), 'gold');
      E.say(nm(mon) + '!');
    }
    E.closeModal();
    if (c && c.then === 'queue') setTimeout(afterBattleQueue, 300);
    else if (c && c.then) summarySheet(c.u);
    E.renderHome && E.renderHome();
  }
  async function nickMic() {
    if (!nickCtx) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const line = E.lang && nickCtx.line ? nickCtx.line : 'Your name is ' + nickCtx.name + '!', m = $('nick-mic'); m.classList.add('on');
    const res = await E.recognize(() => {}, [line]);
    m.classList.remove('on');
    if (!res.alts.length) {
      if (res.fail !== 'unheard' && E.aiDown && E.aiDown()) { E.toast(tx('b.nick.ai')); nickDone(true); return; }
      $('nick-hint').textContent = E.failHint ? E.failHint(res) : tx('b.mic.again'); return;
    }
    const r = E.bestScore(line, res.alts);
    if (r.score >= 45) nickDone(true); else $('nick-hint').textContent = tx('b.score.again', { n: r.score });
  }

  // ---------- 每天和怪兽说说话：亲密度 ----------
  const TALKS = [
    n => 'Good morning, ' + n + '! You are my friend.', n => n + ", let's play together!", n => 'You are so brave, ' + n + '!', n => 'Thank you for your help, ' + n + '.',
    n => 'I like you very much, ' + n + '!', n => n + ', you did a great job today!', n => "Don't worry, " + n + ". I'm here.", n => n + ', are you hungry? Let me get some food.',
  ];
  const MOOD = k => ((I18N && I18N.raw('b.mood')) || [])[k] || '';   // 按亲密度（0–5 颗心）它的样子
  let talkCtx = null;
  function talkSheet(u, then) {
    const mon = byUid(u); if (!mon || mon.egg) return;
    const today = E.dayStr(), done = (M().talked || {})[u] === today;
    if (done) { E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + nm(mon) + '</h2><p>' + E.esc(MOOD(hearts(mon))) + '</p><p>' + hx('b.fr') + ' ' + heartsHTML(mon) + '</p><p class="tip">' + hx('b.talk.later') + '</p></div></div><button class="btn ghost wide" data-act="' + (then ? 'mTalkBack' : 'close') + '" data-u="' + u + '">' + hx('b.okay') + '</button>'); talkCtx = { u, then }; return; }
    const k = (new Date().getDate() + (SPECIES[mon.sp].sd || 0)) % TALKS.length, ln = learnL('talk:' + k);   // 别的课：换成这座岛课程里的一句
    const line = ln ? ln.t : TALKS[k](nm(mon)), sr = E.speakMode() === 'sr';
    talkCtx = { u, then, line };
    // b.talk.p 的 {h} 是爱心的 HTML（heartsHTML），所以用 tx 不用 hx；字表里这句没有要转义的字
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + hx('b.talk.t', { name: nm(mon) }) + '</h2><p>' + tx('b.talk.p', { h: heartsHTML(mon) }) + '</p></div></div>' +
      '<div class="say-text" id="talk-say">' + E.wordsHTML(line) + '</div>' + meanHTML(ln) + '<button class="spk mini" data-act="mTalkHear" aria-label="' + hx('b.hear') + '">' + E.SPK + '</button>' +
      (sr ? '<button class="mic" id="talk-mic" data-act="mTalkMic">' + E.MIC + '</button><div class="mic-hint" id="talk-hint">' + hx('b.mic.say') + '</div>' : '<button class="btn leaf wide" data-act="mTalkGo">' + hx('b.said') + '</button>') +
      '<button class="btn ghost wide" data-act="' + (then ? 'mTalkBack' : 'close') + '" data-u="' + u + '">' + hx('b.talk.no') + '</button>');
    E.say(line);
  }
  function talkDone() {
    const c = talkCtx, mon = c && byUid(c.u); if (!mon) return;
    (M().talked = M().talked || {})[c.u] = E.dayStr();
    const before = hearts(mon);
    befriend(mon, 12);
    E.S.stats.spoken = (E.S.stats.spoken || 0) + 1; E.qProg('spoken', 1);
    E.save(); E.SFX.ok(3);
    E.say(nm(mon) + '!');
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + nm(mon) + '</h2><p>' + E.esc(MOOD(hearts(mon))) + '</p><p>' + hx('b.fr') + ' ' + heartsHTML(mon) + (hearts(mon) > before ? ' <b>+1 ♥</b>' : '') + '</p>' +
      (hearts(mon) >= 4 ? '<p class="tip">' + hx('b.talk.close') + '</p>' : '') + '</div></div><button class="btn wide" data-act="' + (c.then ? 'mTalkBack' : 'close') + '" data-u="' + c.u + '">' + hx('b.talk.ok') + '</button>');
  }
  async function talkMic() {
    const c = talkCtx; if (!c) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const m = $('talk-mic'); m.classList.add('on');
    const res = await E.recognize(() => {}, [c.line]);
    m.classList.remove('on');
    if (!res.alts.length) { $('talk-hint').textContent = E.failHint ? E.failHint(res) : tx('b.mic.again'); return; }
    const r = E.bestScore(c.line, res.alts);
    if (r.score >= 45) talkDone(); else $('talk-hint').textContent = tx('b.score.again', { n: r.score });
  }

  // ---------- 怪兽幼儿园和蛋 ----------
  // 放两只有相同属性的怪兽在怪兽幼儿园，走一段路就会有蛋；蛋放在队伍里走路会孵出来
  const eggSteps = id => 250 + (SPECIES[id].rarity || 1) * 100;
  const eggHint = mon => mon.steps > eggSteps(mon.sp) * .6 ? 'b.egg.far' : mon.steps > 80 ? 'b.egg.mid' : 'b.egg.near';   // 字表的键
  function makeEgg(id) { const b = baseOf(id); return { uid: 'e' + Date.now().toString(36) + rnd(1e6).toString(36), sp: b, egg: true, steps: eggSteps(b), lv: 5, xp: 0 }; }
  function giveEgg(id) { const egg = makeEgg(id); addMon(egg); E.save(); return egg; }
  const day = () => (M().day = M().day || { mons: [], steps: 0, egg: false });
  const canBreed = (a, b) => a && b && !SPECIES[a.sp].legend && !SPECIES[b.sp].legend && SPECIES[a.sp].types.some(t => SPECIES[b.sp].types.includes(t));
  function daycareSheet() {
    const d = day(), gained = mon => Math.floor(d.steps / 100);
    const slots = d.mons.map((mon, i) => '<div class="mrow"><span class="mrow-svg">' + svgMon(mon) + '</span><div class="mrow-i"><b>' + nm(mon) + '</b> <small>Lv ' + mon.lv + (gained(mon) ? ' → Lv ' + Math.min(100, mon.lv + gained(mon)) : '') + '</small> ' + heartsHTML(mon) + '</div><div class="mrow-b"><button class="btn small" data-act="mDayTake" data-i="' + i + '">' + hx('b.day.take') + '</button></div></div>').join('');
    const pair = d.mons.length === 2 ? '<p class="tip">' + hx(canBreed(d.mons[0], d.mons[1]) ? 'b.day.good' : 'b.day.bad') + '</p>' : '';
    const room = d.mons.length < 2, can = M().team.filter(u => byUid(u) && !byUid(u).egg).length > 1;
    const pick = room ? teamMons().filter(x => !x.egg).map(mon => monRow(mon, '<button class="btn small sun" data-act="mDayLeave" data-u="' + mon.uid + '"' + (can ? '' : ' disabled') + '>' + hx('b.day.leave') + '</button>', true)).join('') : '';
    E.openModal('<h2>' + hx('b.day.t') + '</h2><p>' + hx('b.day.p') + '</p>' +
      (d.egg ? '<div class="ach"><span class="ae">🥚</span><div style="flex:1"><b>' + hx('b.day.egg') + '</b><small>' + hx('b.day.egg.s') + '</small></div><button class="btn small sun" data-act="mDayEgg">' + hx('b.day.eggTake') + '</button></div>' : '') +
      '<h3 class="pc-h">' + hx('b.day.in', { n: d.mons.length }) + '</h3>' + (slots || '<p class="tip">' + hx('b.day.none') + '</p>') + pair +
      (room ? '<h3 class="pc-h">' + hx('b.day.pick') + '</h3>' + (can ? '' : '<p class="tip">' + hx('b.day.keep') + '</p>') + pick : '') +
      '<button class="btn ghost wide" data-act="close">' + hx('b.day.thanks') + '</button>');
  }
  function dayLeave(u) {
    const m = M(), d = day(), mon = byUid(u);
    if (!mon || mon.egg || d.mons.length >= 2 || m.team.filter(x => byUid(x) && !byUid(x).egg).length <= 1) return;
    m.team = m.team.filter(x => x !== u); m.box = m.box.filter(x => x.uid !== u);
    d.mons.push(mon); if (d.mons.length === 1) d.steps = 0;
    E.save(); E.SFX.tap(); E.say('Please take care of ' + nm(mon) + '!');
    daycareSheet();
  }
  function dayTake(i) {
    const d = day(), mon = d.mons[i]; if (!mon) return;
    const up = Math.floor(d.steps / 100);
    if (up) { mon.lv = Math.min(100, mon.lv + up); mon.hp = null; learnAt(mon, mon.lv); }
    d.mons.splice(i, 1); if (!d.mons.length) d.steps = 0;
    addMon(mon); E.save(); E.SFX.coin();
    E.toast(up ? tx('b.day.backLv', { name: nm(mon), lv: mon.lv }) : tx('b.day.back', { name: nm(mon) }), 'gold');
    daycareSheet();
  }
  function dayEgg() {
    const d = day(); if (!d.egg || !d.mons.length) return;
    d.egg = false;
    giveEgg(d.mons[rnd(d.mons.length)].sp);
    E.SFX.win(); E.toast(tx('b.day.gotEgg'), 'gold');
    daycareSheet();
  }
  // 大地图每走一步调一次：带头的怪兽慢慢变亲、蛋慢慢孵、怪兽幼儿园慢慢出蛋。返回要孵出来的蛋
  function stepHook() {
    const m = M();
    m.walk = (m.walk || 0) + 1;
    if (m.walk % 60 === 0) befriend(lead(), 1);
    const d = m.day;
    if (d && d.mons.length) { d.steps++; if (d.mons.length === 2 && !d.egg && d.steps % 180 === 0 && canBreed(d.mons[0], d.mons[1])) d.egg = true; }
    const egg = m.team.map(byUid).find(x => x && x.egg && --x.steps <= 0);
    return egg ? { hatch: egg.uid, sp: egg.sp } : null;
  }
  // 孵出来：变成 5 级的小怪兽（有机会是稀有色），然后起名字
  function hatch(u) {
    const egg = byUid(u); if (!egg || !egg.egg) return null;
    delete egg.egg; delete egg.steps;
    egg.lv = 5; egg.xp = 0; egg.fr = 120; egg.moves = defaultMoves(egg.sp, 5); egg.hp = null;
    if (Math.random() < 1 / 32) { egg.shiny = true; (M().shinyDex = M().shinyDex || {})[egg.sp] = 1; }
    M().dex[egg.sp] = 'caught';
    E.save();
    return egg;
  }

  // ---------- 怪兽手册：出没地点 ----------
  let HAB_INDEX = null;
  function habitatIndex() {
    if (HAB_INDEX) return HAB_INDEX;
    HAB_INDEX = {};
    const EM = window.EchoMaps; if (!EM) return HAB_INDEX;
    EM.all().forEach(id => {
      const mp = EM.get(id); if (!mp || mp.kind === 'inside' || mp.kind === 'town') return;
      const flat = mp.grid.map(r => r.join('')).join(''), habs = [];
      // how 存字表的键（显示时按界面语言取）；地图名按界面语言取（中文名 / 英文名）
      if (flat.includes(',')) habs.push([mp.kind === 'under' ? 'water' : mp.hab || (mp.kind === 'cave' ? 'cave' : 'grass'), mp.kind === 'under' ? 'b.hab.weed' : mp.kind === 'cave' ? 'b.hab.cave' : 'b.hab.grass']);
      if (flat.includes(':')) habs.push(['cave', 'b.hab.cave']);
      if (/[~D]/.test(flat) && mp.kind !== 'under') habs.push(['water', 'b.hab.water']);
      habs.forEach(([h, hk]) => wildTable(mp.z, h).forEach(sp => { const L = HAB_INDEX[sp.id] = HAB_INDEX[sp.id] || []; const nmp = mp.name || mp.id; if (!L.some(x => x.zh === nmp && x.hk === hk)) L.push({ zh: nmp, en: mp.en || nmp, hk }); }));
    });
    return HAB_INDEX;
  }
  // 出没地点（按界面语言）：[{ name 地图名, how 怎么遇到 }]
  const habitatsOf = id => (habitatIndex()[id] || []).map(x => ({ name: label(x), how: tx(x.hk) }));
  function habitatHTML(id) {
    const s = SPECIES[id], L = habitatsOf(id);
    let txt;
    if (L && L.length) txt = L.slice(0, 5).map(x => hx('b.hab.one', { name: x.name, how: x.how })).join(hx('b.sep.list')) + (L.length > 5 ? hx('b.hab.more', { n: L.length }) : '');
    else if (s.legend) txt = hx('b.hab.legend');
    else if (s.starter) txt = hx('b.hab.starter');
    else if (s.from && SPECIES[s.from]) { const b = habitatsOf(baseOf(id)); txt = b.length ? hx('b.hab.fromAt', { from: SPECIES[s.from].en, base: SPECIES[baseOf(id)].en, place: b[0].name }) : hx('b.hab.from', { from: SPECIES[s.from].en }); }
    else if (window.EchoSight && !E.lang && EchoSight.may(id)) txt = hx('b.hab.sight');
    else txt = hx('b.hab.none');
    return '<p class="dex-hab">' + hx('b.hab.t') + txt + '</p>';
  }

  // ---------- 我的怪兽 / 怪兽手册 / 回声球 ----------
  // 一只怪兽的信息行，btn 是右边的按钮
  function monRow(mon, btn, inTeam) {
    const s = SPECIES[mon.sp];
    if (mon.egg) return '<div class="mrow"><span class="mrow-svg">' + EGG_SVG + '</span><div class="mrow-i"><b>' + hx('b.egg') + '</b> <small>' + hx(eggHint(mon)) + '</small>' + (inTeam ? '<div class="chips"><span class="lvchip in">' + hx('b.inTeam') + '</span></div>' : '') + '</div><div class="mrow-b">' + btn + '</div></div>';
    return '<div class="mrow"><span class="mrow-svg">' + svgMon(mon) + '</span><div class="mrow-i"><b>' + (mon.shiny ? '✨' : '') + nm(mon) + '</b> <small>' + subName(mon) + '</small> ' + heartsHTML(mon) + '<div class="chips">' + chips(mon.sp) + '<span class="lvchip">Lv ' + mon.lv + '</span>' + (inTeam ? '<span class="lvchip in">' + hx('b.inTeam') + '</span>' : '') + '</div>' +
      '<small>' + hx('b.hpOf', { hp: curHp(mon), max: stats(mon).hp }) + (curHp(mon) === 0 ? hx('b.tiredOut') : mon.st ? ' · ' + E.esc(label(STATUS[mon.st])) : '') + '</small>' +
      '<div class="xpbar"><i style="width:' + (mon.xp / xpNeed(mon.lv) * 100) + '%"></i></div></div><div class="mrow-b"><button class="btn small ghost" data-act="mSum" data-u="' + mon.uid + '">' + hx('b.more') + '</button>' + btn + '</div></div>';
  }
  const teamMons = () => M().team.map(byUid).filter(Boolean);
  const boxMons = () => M().box.filter(x => !M().team.includes(x.uid)).sort((a, b) => b.lv - a.lv);
  // 电脑箱子：10 个箱子，每个 24 只（老存档里一个箱子超过 24 只的照样留着，只是不再往里放）
  const BOXES = 10, BOX_CAP = 24;
  const inBox = k => M().box.filter(x => !M().team.includes(x.uid) && (x.bx || 0) === k);
  const freeBox = () => { for (let k = 0; k < BOXES; k++) if (inBox(k).length < BOX_CAP) return k; return BOXES - 1; };
  // 新怪兽（收服的、孵出来的、蛋）：队伍没满放队伍，满了放第一个有空位的箱子
  function addMon(mon) {
    const m = M();
    m.box.push(mon);
    if (m.team.length < TEAM_MAX) m.team.push(mon.uid); else mon.bx = freeBox();
  }
  // 队伍：看状态、换主力。存进箱子 / 从箱子取出要去休息站的电脑
  function teamSheet() {
    const rows = teamMons().map((mon, k) => monRow(mon, k === 0 ? '<span class="lead-tag">' + hx('b.lead') + '</span>' : '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '">' + hx('b.setLead') + '</button>', true)).join('');
    const nb = boxMons().length;
    E.openModal('<h2>' + hx('b.team.t', { n: teamMons().length, max: TEAM_MAX }) + '</h2><p>' + hx('b.team.p') + '</p>' + rows +
      (nb ? '<p class="tip">' + hx('b.team.box', { n: nb }) + '</p>' : '') +
      '<button class="btn ghost wide" data-act="close">' + hx('b.close') + '</button>');
  }
  // 休息站的电脑：队伍和箱子互相换
  function pcSheet(k) {
    const m = M();
    if (k != null) m.pcBox = Math.max(0, Math.min(BOXES - 1, k));
    const cur = m.pcBox || 0, sortBy = m.pcSort || 'lv';
    const full = m.team.length >= TEAM_MAX, one = m.team.filter(u => byUid(u) && !byUid(u).egg).length <= 1;
    const team = teamMons().map((mon, i) => monRow(mon, (i ? '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '" data-pc="1">' + hx('b.setLead') + '</button>' : '<span class="lead-tag">' + hx('b.lead') + '</span>') +
      '<button class="btn small ghost" data-act="mBench" data-u="' + mon.uid + '" data-pc="1"' + (one && !mon.egg ? ' disabled' : '') + '>' + hx('b.pc.bench') + '</button>', true)).join('');
    const sorter = { lv: (a, b) => b.lv - a.lv, no: (a, b) => (SPECIES[a.sp].dexNo || 9999) - (SPECIES[b.sp].dexNo || 9999), name: (a, b) => nm(a).localeCompare(nm(b)) }[sortBy];
    const list = inBox(cur).sort(sorter).map(mon => monRow(mon, '<button class="btn small sun" data-act="mJoin" data-u="' + mon.uid + '" data-pc="1"' + (full ? ' disabled' : '') + '>' + hx('b.pc.join') + '</button><button class="btn small ghost" data-act="mMoveAsk" data-u="' + mon.uid + '">' + hx('b.pc.move') + '</button>', false)).join('');
    const tabs = '<div class="pc-tabs">' + Array.from({ length: BOXES }, (_, i) => '<button class="btn small ' + (i === cur ? 'sun' : 'ghost') + '" data-act="mBox" data-b="' + i + '">' + (i + 1) + '<small>' + inBox(i).length + '</small></button>').join('') + '</div>';
    const sorts = '<div class="pc-sort">' + hx('b.pc.sort') + ['lv', 'no', 'name'].map(k2 => '<button class="link' + (k2 === sortBy ? ' on' : '') + '" data-act="mPcSort" data-k="' + k2 + '">' + hx('b.pc.' + k2) + '</button>').join(' · ') + '</div>';
    E.openModal('<h2>' + hx('b.pc.t') + '</h2><p>' + hx('b.pc.p', { team: TEAM_MAX, boxes: BOXES, cap: BOX_CAP }) + (full ? hx('b.pc.full') : '') + '</p><h3 class="pc-h">' + hx('b.pc.team', { n: m.team.length, max: TEAM_MAX }) + '</h3>' + team +
      '<h3 class="pc-h">' + hx('b.pc.box', { n: cur + 1, have: inBox(cur).length, cap: BOX_CAP }) + '</h3>' + tabs + sorts + (list || '<p class="tip">' + hx('b.pc.empty') + '</p>') +
      '<button class="btn ghost wide" data-act="close">' + hx('b.pc.close') + '</button>');
  }
  function moveAsk(u) {
    const mon = byUid(u); if (!mon) return;
    E.openModal('<h2>' + hx('b.pc.moveT', { name: nm(mon) }) + '</h2><div class="pc-tabs">' + Array.from({ length: BOXES }, (_, i) => '<button class="btn ' + ((mon.bx || 0) === i ? 'sun' : 'ghost') + '" data-act="mMoveTo" data-u="' + u + '" data-b="' + i + '"' + (inBox(i).length >= BOX_CAP ? ' disabled' : '') + '>' + hx('b.pc.boxN', { n: i + 1 }) + '<small>' + inBox(i).length + '/' + BOX_CAP + '</small></button>').join('') + '</div><button class="btn ghost wide" data-act="mPc">' + hx('b.back') + '</button>');
  }

  // 背包：在大地图上用回复道具、悄悄喷雾、回程绳
  function bagSheet() {
    const rows = BAG_ORDER.map(id => {
      const it = ITEMS[id], n = itemCount(id);
      if (!n && id !== 'ball' && id !== 'potion') return '';
      let use = '';
      const onOff = on => hx(on ? 'b.on' : 'b.off'), useBtn = hx('b.use');
      if (id === 'expshare') use = '<button class="btn small ' + (M().expShareOn !== false ? 'sun' : 'ghost') + '" data-act="mExpShare">' + onOff(M().expShareOn !== false) + '</button>';
      else if (id === 'dowsing') use = '<button class="btn small ' + (M().dowseOn !== false ? 'sun' : 'ghost') + '" data-act="mDowse">' + onOff(M().dowseOn !== false) + '</button>';
      else if (id === 'bike') use = '<button class="btn small" data-act="mUse" data-id="bike"' + (FH && FH.inWorld() ? '' : ' disabled') + '>' + hx('b.ride') + '</button>';
      else if (it.key) use = '';
      else if (STATUS_HEAL[id]) use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>' + useBtn + '</button>';
      else if (it.stone) use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>' + useBtn + '</button>';
      else if (it.heal || id === 'revive') use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>' + useBtn + '</button>';
      else if (id === 'repel') use = '<button class="btn small" data-act="mUse" data-id="repel"' + (n && FH && FH.inWorld() ? '' : ' disabled') + '>' + useBtn + '</button>';
      else if (id === 'rope') use = '<button class="btn small" data-act="mUse" data-id="rope"' + (n && FH && FH.canRope() ? '' : ' disabled') + '>' + useBtn + '</button>';
      // 名字按界面语言；小字里的英文名只在名字不是英文时才写（中文界面：说明 · Echo Ball）
      const name = label(it);
      return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + E.esc(name) + ' ×' + n + '</b><small>' + E.esc(it.desc) + (name !== it.en ? ' · ' + it.en : '') + '</small></div>' + use + '</div>';
    }).join('');
    E.openModal('<h2>' + hx('b.bag.t') + '</h2><p>' + hx('b.bag.p', { n: E.S.coins }) + '</p>' + rows + '<button class="btn ghost wide" data-act="close">' + hx('b.close') + '</button>');
  }
  // 选一只怪兽用回复道具
  function useItem(id) {
    const it = ITEMS[id];
    if (itemCount(id) <= 0) return;
    if (id === 'repel') { addItem(id, -1); E.save(); E.closeModal(); FH && FH.repel(); return; }
    if (id === 'rope') { addItem(id, -1); E.save(); FH && FH.rope(); return; }
    if (id === 'bike') { FH && FH.bike(); return; }
    const rows = teamMons().map(mon => {
      const max = stats(mon).hp, hp = curHp(mon), ok = STATUS_HEAL[id] ? STATUS_HEAL[id].includes(mon.st) : it.stone ? !!itemEvo(mon, id) : id === 'revive' ? hp === 0 : hp > 0 && hp < max;
      return monRow(mon, '<button class="btn small sun" data-act="mUseOn" data-id="' + id + '" data-u="' + mon.uid + '"' + (ok ? '' : ' disabled') + '>' + it.icon + ' ' + hx('b.use') + '</button>', true);
    }).join('');
    E.openModal('<h2>' + hx('b.useOn.t', { icon: it.icon, item: label(it) }) + '</h2><p>' + E.esc(it.desc) + '</p>' + rows + '<button class="btn ghost wide" data-act="mBag">' + hx('b.bag.back') + '</button>');
  }
  function useItemOn(id, u) {
    const mon = byUid(u), it = ITEMS[id];
    if (!mon || itemCount(id) <= 0) return;
    const max = stats(mon).hp, hp = curHp(mon);
    if (STATUS_HEAL[id]) { if (!STATUS_HEAL[id].includes(mon.st)) return; mon.st = null; addItem(id, -1); E.save(); E.SFX.coin(); E.toast(tx('b.item.st', { icon: it.icon, name: nm(mon) }), 'gold'); if (itemCount(id) > 0) useItem(id); else bagSheet(); return; }
    if (it.stone) { const ev = itemEvo(mon, id); if (!ev) return; addItem(id, -1); E.closeModal(); evolveTo(mon, ev.to); return; }
    if (id === 'revive') { if (hp > 0) return; mon.hp = Math.round(max / 2); }
    else { if (hp === 0 || hp >= max) return; mon.hp = Math.min(max, hp + Math.max(20, Math.round(max * it.heal))); }
    addItem(id, -1);
    E.save(); E.SFX.coin();
    E.toast(tx('b.item.hp', { icon: it.icon, name: nm(mon) }), 'gold');
    E.say(nm(mon) + ' feels better!');
    if (itemCount(id) > 0) useItem(id); else bagSheet();
  }
  // 怪兽手册：每页 24 只，点开看详情（英文介绍 + 中文 + 进化路线）；家庭版的番外排在最后，不编号
  const DEX_PAGE = 24;
  let dexPage = 0;
  function dexSheet(pg) {
    const m = M(), pages = Math.ceil(ORDER.length / DEX_PAGE);
    if (pg != null) dexPage = Math.max(0, Math.min(pages - 1, pg));
    const ids = ORDER.slice(dexPage * DEX_PAGE, dexPage * DEX_PAGE + DEX_PAGE);
    const nav = '<div class="dex-nav"><button class="btn small ghost" data-act="mDexPage" data-p="' + (dexPage - 1) + '"' + (dexPage ? '' : ' disabled') + '>◀</button><span>' + hx('b.dex.page', { p: dexPage + 1, n: pages }) + '</span><button class="btn small ghost" data-act="mDexPage" data-p="' + (dexPage + 1) + '"' + (dexPage < pages - 1 ? '' : ' disabled') + '>▶</button></div>';
    E.openModal('<h2>' + hx('b.dex.t', { a: caughtN(), b: D.total }) + '</h2><p>' + hx('b.dex.p') + '</p>' + nav + '<div class="dex">' + ids.map(id => {
      const s = SPECIES[id], st = m.dex[id];
      // 收服了：小字是中文名（中文界面）；英语界面没有中文名，写「Caught」
      return '<button class="dex-i ' + (st || 'none') + '" data-act="mDexOne" data-sp="' + id + '"' + (st ? '' : ' disabled') + '><span class="dex-no">' + (s.dexNo ? String(s.dexNo).padStart(3, '0') : hx('b.dex.extra')) + ((m.shinyDex || {})[id] ? ' ✨' : '') + '</span><span class="dex-svg">' + (st ? svg(id) : '') + '</span><b>' + (st ? s.en : '???') + '</b><small>' + (st === 'caught' ? E.esc(gloss(s) || tx('b.dex.caught')) : hx(st ? 'b.dex.seen' : 'b.dex.none')) + '</small></button>';
    }).join('') + '</div>' + nav + '<button class="btn ghost wide" data-act="close">' + hx('b.close') + '</button>');
  }
  function dexOne(id) {
    const s = SPECIES[id], st = M().dex[id], esc = E.esc;
    if (!st) return;
    const chain = [];
    let root = s; while (root.from) root = SPECIES[root.from];
    const walk = (x, depth) => { chain.push({ x, depth }); (x.evo || []).forEach(e => walk(SPECIES[e.to], depth + 1)); };
    walk(root, 0);
    const how = x => { const f = x.from && (SPECIES[x.from].evo || []).find(e => e.to === x.id); return f ? (f.lv ? 'Lv ' + f.lv : D.STONES[f.item] ? E.esc(label(D.STONES[f.item])) : '') : ''; };
    // 标题：编号 + 英文名 +（中文名）；没收服时中文名写「？」；英语界面没有中文名，括号整个不要
    const zp = gloss(s) ? zhOf({ zh: st === 'caught' ? gloss(s) : tx('b.q') }) : '', dz = gloss({ zh: s.dexZh });
    E.openModal('<div class="dex-big">' + svg(id) + '</div><h2>' + (s.dexNo ? 'No.' + s.dexNo : hx('b.dex.extra')) + ' ' + s.en + E.esc(zp) + '</h2><div class="chips" style="justify-content:center">' + chips(id) + (s.legend ? '<span class="lvchip">' + hx('b.legend') + '</span>' : '') + '</div>' +
      (st === 'caught' ? '<p class="dex-en">' + esc(s.dexEn) + ' <button class="spk mini" data-act="mSayDex" data-sp="' + id + '" aria-label="' + hx('b.hear') + '">' + E.SPK + '</button></p>' + (dz ? '<p class="dex-zh">' + esc(dz) + '</p>' : '') +
        (s.words && s.words.length ? '<p class="tip">' + hx('b.dex.words') + s.words.map(w => '<b>' + esc(w) + '</b>').join(' + ') + '</p>' : '') : '<p class="tip">' + hx('b.dex.lock') + '</p>') +
      habitatHTML(id) +
      (chain.length > 1 ? '<div class="dex-chain">' + chain.map(c => { const k = M().dex[c.x.id]; return '<span class="dc' + (c.x.id === id ? ' on' : '') + '">' + (c.depth ? '<i>' + how(c.x) + ' →</i>' : '') + '<span class="dc-svg">' + (k ? svg(c.x.id) : '') + '</span><small>' + (k ? c.x.en : '???') + '</small></span>'; }).join('') + '</div>' : '') +
      '<div class="row"><button class="btn ghost" data-act="mDex">' + hx('b.dex.back') + '</button><button class="btn ghost" data-act="close">' + hx('b.close') + '</button></div>');
    if (st === 'caught') E.say(s.en);
  }
  function ballSheet() {
    E.openModal('<div class="big">🔮</div><h2>' + hx('b.balls.t', { n: M().balls }) + '</h2><p>' + hx('b.balls.p') + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + hx('b.close') + '</button><button class="btn sun" data-act="mBuyBalls"' + (E.S.coins < 30 ? ' disabled' : '') + '>' + hx('b.balls.buy') + '</button></div>');
  }

  // ---------- 对外 ----------
  const num = (t, k) => +t.dataset[k];
  const actions = {
    mStarter: t => starterSheet(t.dataset.sp),
    mStarterMic: t => starterMic(t.dataset.sp),
    mStarterGo: t => takeStarter(t.dataset.sp),
    mStarterSkip: t => starterSkip(t.dataset.sp),
    mSayName: t => E.say(SPECIES[t.dataset.sp].en),
    mWild: t => startBattle('wild', num(t, 'z')),
    mLeader: t => startBattle('leader', num(t, 'z')),
    mTeam: teamSheet,
    mDex: () => dexSheet(),
    mDexPage: t => dexSheet(+t.dataset.p),
    mDexOne: t => dexOne(t.dataset.sp),
    mSayDex: t => E.say(SPECIES[t.dataset.sp].dexEn),
    mBalls: ballSheet,
    mBuyBalls: () => { if (E.S.coins < 30) return; E.S.coins -= 30; M().balls += 3; E.save(); E.SFX.coin(); E.renderTop(); E.renderHome(); ballSheet(); },
    mLead: t => { const m = M(); m.team = [t.dataset.u, ...m.team.filter(u => u !== t.dataset.u)]; E.save(); t.dataset.pc ? pcSheet() : teamSheet(); E.renderHome(); },
    mJoin: t => { const m = M(); if (m.team.length < TEAM_MAX && !m.team.includes(t.dataset.u)) m.team.push(t.dataset.u); E.save(); E.SFX.tap(); pcSheet(); },
    mBench: t => { const m = M(), mon = byUid(t.dataset.u); if (mon && (mon.egg || m.team.filter(u => byUid(u) && !byUid(u).egg).length > 1)) { m.team = m.team.filter(u => u !== t.dataset.u); mon.bx = inBox(m.pcBox || 0).length < BOX_CAP ? (m.pcBox || 0) : freeBox(); } E.save(); E.SFX.tap(); pcSheet(); E.renderHome(); },
    mBag: bagSheet,
    mUse: t => useItem(t.dataset.id),
    mUseOn: t => useItemOn(t.dataset.id, t.dataset.u),
    bBag: battleBag,
    bUse: t => usePotion(t.dataset.id),
    mEvoOk: () => { E.closeModal(); E.renderHome(); E.sceneMusic(); afterBattleQueue(); },
    mSum: t => summarySheet(t.dataset.u),
    mPc: () => pcSheet(),
    mBox: t => pcSheet(+t.dataset.b),
    mPcSort: t => { M().pcSort = t.dataset.k; E.save(); pcSheet(); },
    mMoveAsk: t => moveAsk(t.dataset.u),
    mMoveTo: t => { const mon = byUid(t.dataset.u); if (mon && inBox(+t.dataset.b).length < BOX_CAP) { mon.bx = +t.dataset.b; E.save(); E.SFX.tap(); } pcSheet(); },
    mNick: t => nickSheet(t.dataset.u, 'sum'),
    mNickPick: t => nickSay(t.dataset.n),
    mNickOwn: () => { const v = (($('nick-in') || {}).value || '').trim(); if (!/^[A-Za-z][A-Za-z]{0,9}$/.test(v)) { const tip = $('nick-tip'); if (tip) tip.textContent = tx('b.nick.bad'); return; } nickSay(v[0].toUpperCase() + v.slice(1).toLowerCase()); },
    mNickGo: () => nickDone(true),
    mNickMic: () => nickMic(),
    mNickHear: () => nickCtx && E.say(E.lang && nickCtx.line ? nickCtx.line : 'Your name is ' + nickCtx.name + '!', .8),
    mNickBack: () => nickCtx && nickSheet(nickCtx.u, nickCtx.then),
    mNickSkip: () => nickDone(false),
    mNickClear: () => { if (nickCtx) { nickCtx.name = SPECIES[byUid(nickCtx.u).sp].en; nickDone(true); } },
    mTalk: t => talkSheet(t.dataset.u, 'sum'),
    mTalkGo: () => talkDone(),
    mTalkMic: () => talkMic(),
    mTalkHear: () => talkCtx && talkCtx.line && E.say(talkCtx.line, .8),
    mTalkBack: t => { const c = talkCtx; talkCtx = null; if (c && c.then === 'sum') summarySheet(t.dataset.u); else E.closeModal(); },
    mDayLeave: t => dayLeave(t.dataset.u),
    mDayTake: t => dayTake(+t.dataset.i),
    mDayEgg: () => dayEgg(),
    mForget: t => forget(+t.dataset.k),
    mLearnGo: t => learnDone(+t.dataset.k),
    mLearnMic: t => learnMic(+t.dataset.k),
    mHearLearn: () => { const it = (M().pendingLearn || [])[0], ln = learnL('learn a move'); if (ln) E.say(ln.t, .8); else if (it) E.say(nm(byUid(it.u)) + ', learn ' + mvName(parseMove(it.id))[0] + '!', .8); },
    mExpShare: () => { M().expShareOn = M().expShareOn === false; E.save(); bagSheet(); },
    mDowse: () => { M().dowseOn = M().dowseOn === false; E.save(); bagSheet(); },
    bSwitch: switchSheet,
    bSwitchTo: t => doSwitch(+t.dataset.k),
    bMove: t => onMove(num(t, 'i')),
    bCatch: t => onCatch(t && t.dataset && t.dataset.ball),
    bMic: onMic,
    bOpt: t => onOpt(num(t, 'i')),
    bLOpt: t => listenPick(num(t, 'i')),
    bRate: t => onRate(num(t, 'v')),
    bHint: () => { if (!B || B.turn !== 'task') return; B.hinted = true; const s = $('b-say'); if (s) { s.classList.remove('mask'); s.innerHTML = E.wordsHTML(B.task.target); } const bl = document.querySelector('#b-panel [data-act=bBlind]'); if (bl) bl.remove(); E.say(B.task.target); },
    // 🔥 不看字念：把咒语藏起来，念对伤害 ×1.5、可以暴击
    bBlind: () => { if (!B || B.turn !== 'task' || !B.task || B.task.kind !== 'sent' || !canBlind() || B.hinted) return; B.blind = true; taskPanel(); },
    // 大招：自己先看选项（这次就不能暴击了）
    bShowOpts: () => { if (!B || B.turn !== 'task' || !B.task || B.task.kind !== 'ult') return; B.hinted = true; showOpts(true); },
    bHear: () => B && B.task && E.say(B.task.target, 0.8),
    bHearQ: () => B && B.task && E.say(B.task.prompt, undefined, 'm'),
    bBack: () => { if (B && B.turn === 'task') { E.stopListening(); menu(); } },
    bDef: t => defend(num(t, 'i')),
    bDefHear: () => B && B.def && E.say(B.def.spell, 0.8, 'm'),
    bPotion: () => usePotion('potion'),
    bEnd: () => { if (!B) return; const cb = B.onEnd, res = B.result || 'flee'; E.closeModal(); writeBack(); stopBattle(); if (cb) cb(res); setTimeout(afterBattleQueue, 500); },
    bFlee: () => {
      if (!B || B.turn === 'done') { B && B.onEnd ? actions.bEnd() : actions.bHome(); return; }
      E.openModal('<h2>' + hx(B.kind === 'wild' ? 'b.flee.wild' : 'b.flee.t') + '</h2><p>' + hx('b.flee.p') + '</p><div class="row"><button class="btn ghost" data-act="' + (B.onEnd ? 'bEnd' : 'bHome') + '">' + hx('b.flee.go') + '</button><button class="btn" data-act="close" data-focus>' + hx('b.flee.stay') + '</button></div>');
    },
    bHome: () => { E.closeModal(); writeBack(); stopBattle(); E.goHome('mon'); },
  };

  window.MonsterGame = {
    init(api) { E = api; return actions; },
    fresh: () => ({ box: [], team: [], dex: {}, badges: {}, balls: 5, potions: 2, bag: {}, wins: 0, caught: 0, evolved: 0 }),
    // 老存档：队伍从 3 只扩到 6 只，把箱子里等级最高的先补进队伍
    migrate() {
      const m = M();
      (m.box || []).forEach(ensureMoves);
      // 箱子里稀有色怪兽的 2D 图标先转好色（菜单、手册、队伍打开时就是稀有色）
      if (window.Mon3D && Mon3D.prepIcons) Mon3D.prepIcons((m.box || []).filter(x => x.shiny && !x.egg && SPECIES[x.sp]).map(spOf));
      if (m.v === 2) return;
      m.v = 2;
      m.bag = m.bag || {};
      boxMons().slice(0, Math.max(0, TEAM_MAX - m.team.length)).forEach(x => m.team.push(x.uid));
      E.save();
    },
    setFieldHooks: h => { FH = h; },
    STARTERS, STRONG, grown,
    // 按属性配一队怪兽（反派、擂主、冠军用）：同一个 seed 每次都一样，等级够了就是进化形态
    teamOf(types, n, lv, seed) {
      let pool = D.list.filter(s => !s.legend && !s.starter && isBase(s) && s.r <= 2 && s.types.some(t => types.includes(t)));
      if (!pool.length) pool = REGION1.filter(isBase);
      pool = pool.slice().sort((a, b) => hash(seed, a.id) - hash(seed, b.id));
      return Array.from({ length: n }, (_, k) => { const l = lv + k; return newMon(grown(pool[k % pool.length].id, l + 2), l); });
    },
    species: id => SPECIES[id],
    newMon,
    // 开场剧情里从博士的包里选的伙伴
    giveStarter(id) {
      const m = M();
      if (m.box.length) return null;
      const mon = newMon(id, 5);
      m.box.push(mon); m.team = [mon.uid]; m.dex[id] = 'caught';
      E.save();
      return mon;
    },
    ITEMS, itemCount, addItem, pcSheet, bagSheet, learnset, parseMove, stats,
    homeHTML,
    stop: () => { writeBack(); stopBattle(); },
    battle: startBattle,
    _b: () => B,   // 测试用：当前战斗
    _b3: () => B3,   // 测试用：3D 战斗画面（画面丢了能不能重建，tests/apk.test.js）
    trainerFoes,
    healAll,
    anyAlive,
    leadSpecies: () => { const L = lead(); return L ? spOf(L) : null; },
    preloadTeam,
    lead: () => lead(),
    nm, spOf, hearts, befriend, talkSheet, nickSheet, daycareSheet, stepHook, hatch, giveEgg, makeEgg,
    habitats: id => habitatsOf(id),
    wildTable,   // 一个区域某种栖息地平时会出的怪兽（今日目击用它来挑「平时在这里遇不到的」）
    zoneLv,
    afterHome: () => setTimeout(afterBattleQueue, 400),
    caughtCount: s => ORDER.filter(id => COUNTED.has(id) && s.mon.dex[id] === 'caught').length,
    total: D.total,
  };
})();
