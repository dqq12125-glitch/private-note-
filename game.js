// 回声岛 Echo Island — 游戏逻辑（纯前端，无需安装）

// 出错记录 window.EchoErr 在 errlog.js（index.html 的 <head> 里第一个加载，后面的文件加载时出错也记得到）

(function () {
  'use strict';

  // ---------- 界面文字（i18n.js 字表；键前缀 g.） ----------
  // 2026-11-19 第二批搬进来（游戏给所有人用，界面要有英文）。中文和原来一字不差；英文给学英语的人看，写得短、写得浅。
  // tr(键, 参数) 纯文字（toast、textContent、aria-label、prompt）；trh(键, 参数) 拼进 innerHTML（参数先转义）。
  // 内容（单词、句子、台词、单元标题的中文意思）不搬进字表：要显示「意思」走 meanOf() / gloss()（见下面）
  const I18N = window.EchoI18n;
  const tr = (k, p) => (I18N ? I18N.t(k, p) : k), trh = (k, p) => (I18N ? I18N.h(k, p) : k);
  // 数据里有 zh / en 两个名字的（道具、属性、岛名……）：界面语言 → 英文 → 中文
  const lbl = o => (I18N ? I18N.label(o) : (o && o.zh) || '');
  // 内容在界面语言里的意思（{ zh: … }）：中文界面给 zh；英语界面（界面语言就是要学的语言）/ 内容没有这门语言的意思给 null（不显示那一行）
  const gloss = o => (I18N ? I18N.gloss(o) : (o && o.zh) || null);
  // ---------- 在学哪门语言（tools/course/ENGINE.md，2026-11-20）----------
  // 只有课程包模式才可能不是英语（EchoPacks.course()，localStorage['echo-course']）；lang-*.js 没登记的语言一律按英语。
  // LANG = 这门语言的模块（lang.js 的接口），英语是 null：凡是「认定在学英语」的地方都看它——英语的路一个字不变，别的语言走 LANG 的打分、提示、词块、读音
  const COURSE = (() => { try { const P = window.EchoPacks, c = P && P.on ? P.course() : 'en'; return c !== 'en' && window.EchoLang && EchoLang.has(c) ? c : 'en'; } catch (e) { return 'en'; } })();
  const LANG = COURSE === 'en' ? null : EchoLang.get(COURSE);
  // 界面上写着「英语」的那几句换成「.c」的写法（{lang} = 这门语言的名字，packs.js 的 pk.name.*），见 i18n.js 的 variant
  if (LANG && I18N && I18N.variant) I18N.variant('.c', () => ({ lang: I18N.t('pk.name.' + COURSE) }));
  // 课程内容（单词、句子、对话）的意思：要学的语言是 COURSE（英语课和 gloss 一样；别的课英语界面给 en 那份、中文界面给中文）
  const glossC = o => (I18N ? I18N.gloss(o, COURSE) : (o && o.zh) || null);
  // 这门课现在能不能和岛民聊（tools/course/TALK.md §4）：英语课一直能（连不连得上另说）；别的课看服务器会不会用这门语言聊
  // （talk.js 的 langOk：云端模式看账号的 talkLangs，网页版看中转服务 /health 的 talkLangs；老服务器、APK 直连 = 不会，一切照旧）
  const talkLang = () => { if (!LANG) return true; try { return !!(window.EchoTalk && EchoTalk.langOk && EchoTalk.langOk()); } catch (e) { return false; } };
  // 聊天里一句话有多长：英语、西语数词；日语、中文数的是字——周报、日报里「每句 n 个词」「最长一句 n 个词」那几句换成「字」的写法（键后面加 .ch）
  const CH = LANG && LANG.script !== 'latin' ? '.ch' : '';
  // ---------- 单词 / 句子的「意思」（规则只写在这里）----------
  // 条目是 data.js / book.js 的单词 [英文, 中文意思, 表情] 或句子 [英文, 中文意思]（对话 [问, 答, [错的答]] 没有意思）；
  // 复习本里聊天改过的句子是 { en, zh }。
  // 钩子：以后的内容批次给别的界面语言加意思时，在数组最后放一个对象 { fr: '…', es: '…' }（对象条目放在 .gloss），这里自动读到。
  // meanOf(条目) = 现在的界面语言里的意思：中文界面给中文；英语界面给 null；别的界面语言有 gloss[界面语言] 就给，没有给 null（不退回中文）。
  // 拿到 null 时不显示意思那一行，也不拿「意思」出题——闯关 / 复习 / 对战换成什么题见 cueMode()
  const glossObj = it => { const g = Array.isArray(it) ? it[it.length - 1] : it && it.gloss; return g && typeof g === 'object' && !Array.isArray(g) ? g : null; };
  const meanOf = it => (it ? glossC(Object.assign({ zh: Array.isArray(it) ? it[1] : it.zh }, glossObj(it))) : null);
  // 课本的册名（七上……）：book.js 里只有中文的 short；别的界面语言用字表 g.book.<册 id>。别的课（course.json）的册自己带着英文的 x.en.short（L1）
  const bookShort = b => { if (LANG && b && b.x) return lbl({ zh: b.short, en: b.x.en && b.x.en.short }); const k = 'g.book.' + (b && b.id); return I18N && I18N.lang() !== 'zh' && I18N.has(k) ? tr(k) : (b && b.short) || ''; };
  // 岛主 / 单元 BOSS 的名字：中文界面用中文名；别的语言用英文名（data.js 的 boss.en；课本单元的 BOSS 没有 en，从开场白里取：I'm Ollie.）
  const bossName = b => lbl({ zh: b && b.name, en: (b && b.en) || (/\bI(?:'m| am) ((?:the )?[A-Z][\w-]*(?: [A-Z][\w-]*)*)/.exec((b && b.hello) || '') || [])[1] });
  // 小岛的名字：中文界面用中文名（你好岛）；别的语言用这座岛小镇地图的英文名（Crayon Island……，和大地图、剧情里说的一样，world.js 的 townName）
  const isleName = z => { const w = window.WORLDS[z], m = window.EchoMaps && EchoMaps.get ? EchoMaps.get('t' + z) : null; return w ? lbl({ zh: w.name, en: (m && m.en) || String(w.en).replace(/[!?]/g, '') + ' Town' }) : ''; };
  if (I18N) I18N.add({
    zh: {
      // —— 公用 ——
      'g.ok': '知道了', 'g.close': '关闭', 'g.cancel': '取消',
      'g.book.hj7a': '七上', 'g.book.hj7b': '七下', 'g.book.hj8a': '八上', 'g.book.hj8b': '八下', 'g.book.hj9a': '九上', 'g.book.hj9b': '九下',

      // —— 第一段：关卡配方、成就、存档、朗读、识别、AI 用不了、打分（G1）——
      'g.rc.0.n': '听词', 'g.rc.0.d': '听单词，选出意思和拼写。',
      'g.rc.1.n': '说词', 'g.rc.1.d': '跟读单词，再看图说出英文。',
      'g.rc.2.n': '听句', 'g.rc.2.d': '听整句话，理解意思、排出顺序。',
      'g.rc.3.n': '说句', 'g.rc.3.d': '一句一句跟读，把句子说顺。',
      'g.rc.4.n': '对话', 'g.rc.4.d': '听对方说话，选出并说出合适的回答。',
      'g.rc.5.n': '挑战', 'g.rc.5.d': '所有题型混在一起，还会复习前面岛上的内容。',
      'g.rc.6.d': '和岛主面对面对话！听懂它的话，大声说出正确回答来攻击它。',
      'g.type.lw': '🎧 听音选义', 'g.type.ls': '🎧 听音选词', 'g.type.lm': '🎧 听句选意', 'g.type.lr': '💬 听问选答', 'g.type.lo': '🧩 听音排句',
      'g.type.sr_w': '🎤 单词跟读', 'g.type.sr_s': '🎤 句子跟读', 'g.type.sr_d': '🎤 说出回答', 'g.type.sp': '🖼️ 看图说英语', 'g.type.bt': '⚔️ 对话攻击',
      'g.tag.lw': '听音选义', 'g.tag.ls': '听音选词', 'g.tag.lm': '听句选意', 'g.tag.lr': '听问选答', 'g.tag.lo': '听音排句',
      'g.tag.sr_w': '单词跟读', 'g.tag.sr_s': '句子跟读', 'g.tag.sr_d': '说出回答', 'g.tag.sp': '看图说英语', 'g.tag.bt': '对话攻击',
      'g.praise': ['太棒了！', 'Great!', 'Nice!', '答对了！', 'Excellent!', 'Well done!', '厉害！'],
      'g.title.1': '见习水手', 'g.title.3': '小小水手', 'g.title.5': '听力侦探', 'g.title.7': '口语新星', 'g.title.10': '发音达人',
      'g.title.13': '对话高手', 'g.title.16': '岛屿探险家', 'g.title.20': '英语船长', 'g.title.25': '回声大师', 'g.title.30': '传奇船长',
      'g.pet.chick': '小鸡', 'g.pet.cat': '小猫', 'g.pet.dog': '小狗', 'g.pet.rabbit': '兔子', 'g.pet.frog': '青蛙', 'g.pet.fox': '狐狸',
      'g.pet.panda': '熊猫', 'g.pet.penguin': '企鹅', 'g.pet.owl': '猫头鹰', 'g.pet.dolphin': '海豚', 'g.pet.unicorn': '独角兽', 'g.pet.dragon': '小龙',
      'g.pet.dino': '小恐龙', 'g.pet.butterfly': '蝴蝶', 'g.pet.octopus': '小章鱼',
      'g.qp.lv2': '完成 2 个关卡', 'g.qp.lv4': '完成 4 个关卡', 'g.qp.sp10': '开口说对 10 次', 'g.qp.sp25': '开口说对 25 次',
      'g.qp.cb8': '一关里连击达到 8', 'g.qp.st3': '拿到 1 次三星', 'g.qp.pf5': '获得 5 次 Perfect 发音', 'g.qp.ls20': '听力题答对 20 道',
      'g.qp.rv5': '每日复习答对 5 题', 'g.qp.rp1': '完成 1 次对话角色扮演', 'g.qp.bt3': '赢得 3 场怪兽对战', 'g.qp.ct1': '收服 1 只野生怪兽',
      'g.qp.tk1': '用英语和岛民聊天，完成 1 个目标',
      'g.ach.first.n': '起航', 'g.ach.first.d': '完成第 1 关',
      'g.ach.lv10.n': '乘风破浪', 'g.ach.lv10.d': '完成 10 关',
      'g.ach.lv50.n': '远洋航行', 'g.ach.lv50.d': '完成 50 关',
      'g.ach.boss1.n': '初战告捷', 'g.ach.boss1.d': '打败第 1 个 Boss',
      'g.ach.boss5.n': 'Boss 猎人', 'g.ach.boss5.d': '打败 5 个 Boss',
      'g.ach.allboss.n': '群岛之王', 'g.ach.allboss.d': '打败全部 13 个 Boss',
      'g.ach.c10.n': '十连击', 'g.ach.c10.d': '一关里连击 10 次',
      'g.ach.flaw.n': '零失误', 'g.ach.flaw.d': '一关里每题都答对',
      'g.ach.sp50.n': '敢开口', 'g.ach.sp50.d': '开口说对 50 次',
      'g.ach.sp300.n': '口语达人', 'g.ach.sp300.d': '开口说对 300 次',
      'g.ach.pf30.n': '标准发音', 'g.ach.pf30.d': '获得 30 次 Perfect 发音',
      'g.ach.st3.n': '三天打卡', 'g.ach.st3.d': '连续打卡 3 天',
      'g.ach.st7.n': '一周不断', 'g.ach.st7.d': '连续打卡 7 天',
      'g.ach.st30.n': '月度坚持', 'g.ach.st30.d': '连续打卡 30 天',
      'g.ach.three10.n': '星星收集者', 'g.ach.three10.d': '拿到 10 次三星',
      'g.ach.world.n': '完美海岛', 'g.ach.world.d': '一个岛的 7 关全部三星',
      'g.ach.rv20.n': '温故知新', 'g.ach.rv20.d': '每日复习答对 20 题',
      'g.ach.pets3.n': '宠物之家', 'g.ach.pets3.d': '拥有 3 只宠物',
      'g.ach.rich.n': '小富翁', 'g.ach.rich.d': '同时拥有 500 金币',
      'g.ach.actor.n': '小演员', 'g.ach.actor.d': '完成 5 次对话角色扮演',
      'g.ach.catch1.n': '第一个伙伴', 'g.ach.catch1.d': '收服第 1 只野生怪兽',
      'g.ach.dex8.n': '手册收集家', 'g.ach.dex8.d': '手册点亮 8 种怪兽',
      'g.ach.dexall.n': '怪兽大师', 'g.ach.dexall.d': '手册点亮第一大区全部 {n} 种',
      'g.ach.evo1.n': '进化！', 'g.ach.evo1.d': '第一次让怪兽进化',
      'g.ach.badge5.n': '徽章收集者', 'g.ach.badge5.d': '拿到 5 枚岛主徽章',
      'g.ach.badgeall.n': '冠军训练师', 'g.ach.badgeall.d': '拿到全部 13 枚岛主徽章',
      'g.ach.sight1.n': '好眼力', 'g.ach.sight1.d': '读懂英文线索，收服 1 只「今日目击」的怪兽',
      'g.ach.sight7.n': '线索小侦探', 'g.ach.sight7.d': '收服 7 只「今日目击」的怪兽',
      'g.save.dev': '这台设备上 {d} 的备份', 'g.save.phone': '手机「下载/EchoIsland」里 {d} 的备份', 'g.save.before': '以前',
      'g.save.badlog': '存档读不出来（{n} 字）', 'g.save.wlog': '存档写不出来：{msg}', 'g.save.fulllog': '存档存不进去（空间满了？）',
      'g.save.full': '存档存不进去了（手机给游戏的空间满了），今天玩的可能存不下来。请家长在 设置 → 💾 存档备份 里先「导出存档」。',
      'g.save.full.h': '存档存不进去了',
      'g.store.cutlog': '存档空间快满了，删掉了较早的两份备份', 'g.store.pctlog': '存档空间快满了：已用 {pct}%（{n} 字）',
      'g.store.h': '存档空间快满了',
      'g.store.p1': '<p>手机给游戏放存档的地方已经用了 <b>{pct}%</b>。现在还能正常存；满了以后，新的进度就存不进去了。</p>',
      'g.store.p2': '<p class="tip">请家长：先在「设置 → 🔒 家长设置 → 💾 存档备份」里点「导出存档」，发到微信里存一份；再把这条提示告诉帮你装游戏的人。</p>',
      'g.store.bar': '💾 存档空间快满了（已用 {pct}%），请告诉家长',
      'g.streak.keep': '🧊 连胜保护卡生效，{n} 天连续打卡保住了！', 'g.streak.lost': '💧 {n} 天的连续打卡断了，今天重新开始吧',
      'g.tts.silent': '这句的声音要联网才能听到', 'g.tts.tap': '点一下 🔊 就能听到发音',
      'g.sr.aimark': 'AI 生成', 'g.sr.cloud': '连不上 AI 打分，先用浏览器的识别 / 录音自评',
      'g.fail.key.auth': 'AI 密钥不对', 'g.fail.key.quota': 'AI 额度用完了', 'g.fail.key.busy': 'AI 有点忙', 'g.fail.key.code': '家庭口令不对',
      'g.fail.short.auth': '密钥不对', 'g.fail.short.quota': '额度用完了', 'g.fail.short.busy': '有点忙', 'g.fail.short.code': '家庭口令不对',
      'g.fail.key.other': 'AI 打分用不了', 'g.fail.key.line': '{why}，没法打分：请告诉家长',
      'g.fail.mic': '🎤 要先允许回声岛用麦克风，才能开口说', 'g.fail.nokey': '🔑 还没有 AI 密钥，没法自动打分：请家长在设置里粘贴',
      'g.fail.net': '📶 没网，没法打分：连上网再说一次', 'g.fail.busy': '⏳ AI 有点忙，过一会儿再说一次',
      'g.fail.unheard': '没听清，靠近一点、大声一点再试一次', 'g.fail.stop': '⏹ 停了。准备好了再点话筒说',
      'g.bar.nokey': '🔑 还没有 AI 密钥：口语没法自动打分，请家长在设置里粘贴', 'g.bar.net': '📶 连不上网：口语打分和聊天要联网',
      'g.bar.quota': '💳 AI 额度用完了，请告诉家长', 'g.bar.busy': '⏳ AI 太忙了，过一会儿再试', 'g.bar.code': '🔑 家庭口令不对，请告诉家长',
      'g.bar.auth': '🔑 AI 密钥不对：口语打分和聊天用不了，请告诉家长',
      'g.bar.how': '怎么办？', 'g.bar.see': '看看',
      'g.bar.upd.n': '🆕 有新版本（{name}），请家长更新', 'g.bar.upd': '🆕 有新版本，请家长更新',
      'g.bar.parent': '🔒 家长设置',
      'g.bar.i.nokey': '这台手机上还没有 AI 密钥。请家长打开「设置 → 🔒 家长设置 → AI 聊天和口语打分」，粘贴阿里云百炼的 API Key（只存在这台手机里）。',
      'g.bar.i.net': '口语打分和和岛民聊天都要联网。看看 Wi-Fi 或者流量开着没有，连上网再说。',
      'g.bar.i.quota': '家长：阿里云百炼的额度用完了（或者欠费了）。请到百炼控制台看看费用和额度，充值或者换一把新密钥。',
      'g.bar.i.busy': 'AI 那边一下子收到太多请求了，过几分钟再试就好。',
      'g.bar.i.code': '家长：中转服务的家庭口令不对，请在设置里重新填。',
      'g.bar.i.auth': '家长：AI 密钥不对（可能被作废了）。请在「设置 → 🔒 家长设置 → AI 聊天和口语打分」里粘贴新的密钥。',
      'g.bar.i.tip': '<p class="tip">AI 用不了的时候：要开口的题可以「先跳过」，这些句子都放进了每日复习，联网以后要补说；对战这一回合改成听一听、选出来（不能暴击）。</p>',
      'g.mic.h': '要用麦克风才能开口说英语',
      'g.mic.p': '<p>回声岛要<b>听你说的英语</b>，才能给你打分、让你和岛民聊天。声音只用来打分，不会存下来。</p>',
      'g.mic.blocked': '<p class="tip">手机现在不让回声岛用麦克风，也不会再问了：点「去打开」→「权限」→「麦克风」→ 选「允许」，再回到游戏。</p>',
      'g.mic.denied': '<p class="tip">刚才没有允许。再点一次话筒，手机会问你，这次点「允许」就好。</p>',
      'g.mic.later': '等会儿', 'g.mic.fix': '⚙️ 去打开', 'g.mic.fix2': '⚙️ 去设置里打开', 'g.mic.retry': '好的，再试一次',
      'g.mic.granted': '🎤 麦克风可以用了！再点一次话筒说吧',
      'g.mic.mic.ok': '🎤 麦克风 ✅', 'g.mic.mic.bad': '🎤 麦克风 ❌ 没允许用', 'g.mic.mic.quiet': '🎤 麦克风 ⚠️ 没听到声音：是不是被手指挡住了？', 'g.mic.mic.idle': '🎤 麦克风',
      'g.mic.net.ok': '📶 网络 ✅', 'g.mic.net.bad': '📶 网络 ❌ 连不上', 'g.mic.net.idle': '📶 网络',
      'g.mic.key.ok': '🔑 AI 密钥 ✅', 'g.mic.key.bad': '🔑 AI 密钥 ❌', 'g.mic.key.idle': '🔑 AI 密钥', 'g.mic.svc.ok': '🤖 AI 服务 ✅', 'g.mic.svc.bad': '🤖 AI 服务 ❌', 'g.mic.svc.idle': '🤖 AI 服务',
      'g.mic.nokey': '还没有：请家长在「设置 → 🔒 家长设置」里粘贴',
      'g.mic.chk.h': '开口前的小检查',
      'g.mic.chk.p': '<p>回声岛要听你说英语。点话筒，大声说：<b class="chk-say">Hello!</b></p>',
      'g.mic.chk.hint': '点话筒，说 Hello', 'g.mic.chk.go': '好了，出发！',
      'g.mic.listen': '正在听……大声说 Hello!', 'g.mic.nobrowser': '浏览器没让用麦克风',
      'g.mic.ok': '麦克风没问题！', 'g.mic.ok.key': '麦克风没问题！还差 AI 密钥：请家长在设置里粘贴，才能自动打分。',
      'g.mic.quiet': '没听到声音：靠近一点、大声说 Hello，再点一次话筒',
      'g.mic.allok': '全都没问题，可以开口说英语了！',
      'g.mic.covered': '没听到声音：麦克风是不是被挡住了？靠近一点、大声说 Hello，再点一次话筒',


      // —— 第二段：出题、每日复习、撤提示、每日任务、首页、课本单元、按能力走、闯关（G2）——
      'g.rev.card.again': '<b>今天复习过了</b><small>还可以加练 {n} 题（不练也行）</small>',
      'g.rev.card.done': '<b>今天的复习做完了</b><small>答错的题、课本新学的内容会按 1、2、4、7…天的间隔自动回来</small>',
      'g.rev.card.wrong': '{n} 道错题', 'g.rev.card.old': '{n} 道学过的', 'g.rev.card.chat': '{n} 句聊天里的',
      'g.rev.card.n': '今日复习 {n} 题', 'g.rev.card.per': '，一次复习 {n} 题',
      'g.fade.1': '🔤 看首字母说', 'g.fade.2': '🧠 凭记忆说', 'g.fade.3': '✏️ 改正说法',
      // 界面语言里没有意思时换出来的题（cueMode）：中文界面不会出现，留着给以后没写意思的语言
      'g.cue.lw.ty': '🎧 听音选词（带图）', 'g.cue.lw.tag': '听音选词（带图）', 'g.cue.lm.ty': '🎧 听句选句', 'g.cue.lm.tag': '听句选句',
      'g.cue.lw.t': '听一听，选出你听到的词', 'g.cue.lm.t': '听句子，选出你听到的那一句', 'g.cue.pic.t': '看图，凭记忆用英语说出来',
      'g.cue.hear.w': '先听一遍，再看首字母说出这个词', 'g.cue.hear.s': '先听一遍，再看首字母说出整句话',
      'g.q.lw.t': '听一听，选出正确的意思', 'g.q.ls.t': '听一听，选出你听到的英文', 'g.q.lm.t': '听句子，选出正确的中文意思',
      'g.q.lr.t': '对方这样说，你该怎么回答？', 'g.q.see.long': '看原文（先试着只用耳朵听）', 'g.q.see': '看原文',
      'g.q.lo.t': '听句子，按顺序点出单词', 'g.q.check': '检查', 'g.q.rep.t': '先听，再大声跟读',
      'g.q.fix.t': '这句话可以说得更好：直接说出正确的英文', 'g.q.mem.t': '看中文，凭记忆用英语说出来',
      'g.q.cue.w': '看首字母提示，说出这个词', 'g.q.cue.s': '看首字母提示，说出整句话', 'g.q.said': '你原来说的：<s>{s}</s>',
      'g.q.dlg.t': '听对方说话，然后大声说出你的回答', 'g.q.dlg.mem': '听对方说话，然后凭记忆大声说出你的回答', 'g.q.you': '你来说：',
      'g.q.sp.t': '看图，用英语说出来',
      'g.q.bt.mem': '听懂它的话，<b>凭记忆用英语回答</b>攻击它！', 'g.q.bt.sr': '选一句正确的回答，<b>大声说出来</b>攻击它！（点选项可以先听一听）',
      'g.q.bt.self': '先点出正确的回答，再大声说出来攻击它！', 'g.q.bt.show': '👀 看看可以怎么回答（这题就不能暴击了）',
      'g.task.done': '✅ 任务完成：{t}，回地图领奖励', 'g.toast.ach': '🏆 新成就「{name}」 +20 金币',
      'g.home.streak.on': '今天已打卡，连续 {n} 天', 'g.home.streak.off': '今天还没打卡，完成任意一关就算',
      'g.home.claim': '领取 +{n}', 'g.home.claimed': '✓ 已领取',
      'g.home.chest.open': '今天的宝箱已经打开', 'g.home.chest.ready': '每日宝箱可以打开了！', 'g.home.chest': '每日宝箱',
      'g.home.chest.tmr': '明天任务会刷新，记得回来', 'g.home.chest.how': '领完 3 个任务奖励就能打开，可能开出进化曲、怪兽蛋',
      'g.home.tasks': '今日任务', 'g.home.reset': '{n} 小时后刷新',
      'g.home.isle.no': '第 {n} 岛', 'g.home.isle.lock': '🔒 打败上一岛的 Boss 解锁', 'g.home.locked': '（未解锁）', 'g.home.start': '开始',
      'g.home.scene': '对话动画 · {t}', 'g.home.scene.seen': '✓ 看过了 · 可以再来跟读、角色扮演', 'g.home.scene.new': '先看看这个话题的英语对话怎么说 · 第一次看完 +10 金币',
      'g.home.tab.mon': '🐲 怪兽冒险', 'g.home.tab.quiz': '📚 闯关练习', 'g.home.tab.talk': '🗣️ 和岛民聊天',
      'g.home.qv.book': '📗 课本单元', 'g.home.qv.isle': '🏝️ 话题小岛',
      'g.unit.now': ' · 📍 正在学', 'g.unit.gram': '📐 语法：{t}', 'g.unit.talk': '🗣️ 和 {name} 聊这个单元', 'g.unit.setnow': '设为正在学',
      'g.unit.head': '📗 课本单元 · 适用于沪教版词汇', 'g.unit.open': '这个学年的课本单元（{list}）', 'g.unit.sep': '、', 'g.unit.all': '七年级到九年级六册书',
      'g.unit.what': '：每个单元要学的单词和短语，加上按单元的话题和语法自己编写的句子和对话（不是课文）。',
      'g.unit.cur': '正在学：<b>{u}</b>', 'g.unit.guess': '（按日期猜的）', 'g.unit.change': '改',
      // 别的课的单元号（英语课照课本写 Unit 3，不走这个键）
      'g.unit.no': '第 {n} 单元', 'g.ev.bookat.c': '📍 现在学 {b} 第 {n} 单元，冒险里会多出它的题', 'g.ev.gram.h.c': '第 {n} 单元语法：{t}', 'g.ev.gram.h0.c': '第 {n} 单元语法',
      'g.unit.old': '{b}的新教材还没出版（预计 2027 年春季），现在先用旧版教材的单元，新书出来后会换掉。',
      'g.det.count': ' 共 {n} 题，3 颗心。', 'g.det.best': '最好成绩：', 'g.det.scene': '🎬 先看对话动画',
      // 单词表、单词卡、我的单词本、发音入门（tools/course/WORDS.md）
      'g.wd.btn': '📖 单词表', 'g.wd.h': '单词表', 'g.wd.gram': '这一单元的语法：{t}', 'g.wd.cards': '▶ 用单词卡过一遍', 'g.wd.roma': '罗马字',
      'g.wd.roma.on': '显示', 'g.wd.roma.off': '不显示', 'g.wd.words': '单词（{n}）', 'g.wd.sents': '常用句子（{n}）', 'g.wd.say': '听一听', 'g.wd.none': '这一课没有单词',
      'g.wd.legend': '🆕 还没练过 · 🔁 在复习 · ✅ 已掌握　点 🔊 听发音', 'g.wd.st.new': '还没练过', 'g.wd.st.rev': '在复习', 'g.wd.st.ok': '已掌握', 'g.wd.back': '← 返回',
      'g.wc.n': '第 {i} / {n} 张', 'g.wc.skip': '跳过，直接闯关', 'g.wc.go': '我认识了，开始闯关', 'g.wc.done': '✓ 看完了', 'g.wc.prev': '上一张', 'g.wc.next': '下一张',
      'g.wc.say': '再听一遍', 'g.wc.gram': '语法要点', 'g.wc.swipe': '← → 翻页，也可以左右滑',
      'g.wb.btn': '📒 我的单词本（学过 {n} 个词）', 'g.wb.h': '📒 我的单词本', 'g.wb.all': '一共', 'g.wb.rev': '在复习', 'g.wb.ok': '已掌握',
      'g.wb.f.all': '全部', 'g.wb.f.rev': '🔁 在复习', 'g.wb.f.ok': '✅ 已掌握', 'g.wb.q': '🔍 找词或意思', 'g.wb.tap': '点一个词看例句',
      'g.wb.empty': '还没有学过的词。去闯关练习里过一关，学过的词就会出现在这里。', 'g.wb.none': '没有找到这样的词', 'g.wb.more': '再显示 {n} 个', 'g.wb.noex': '这一课的句子里没有用到这个词',
      'g.pr.btn': '🔤 发音入门', 'g.pr.h': '🔤 发音入门', 'g.pr.card': '先学发音和文字（约 10 分钟）', 'g.pr.card.go': '开始', 'g.pr.card.no': '不用了',
      'g.pr.tap': '点一格听发音；带小圆点的还有例词', 'g.pr.ex': '例词', 'g.pr.next': '下一段 →', 'g.pr.done': '✓ 学完了',
      // 第二部分：零基础怎么学（WORDS.md 第 7–11 条）
      'g.wd.slow': '慢慢念一遍',
      'g.ls.btn': '📘 这一课学什么', 'g.ls.h': '这一课学什么', 'g.ls.can': '学完能做什么', 'g.ls.pats': '句型', 'g.ls.tips': '提醒',
      'g.ls.next': '下一步：认识单词 →', 'g.ls.go': '开始闯关 →',
      'g.hp.h': '🆘 求助的话', 'g.hp.tab': '🆘 求助的话', 'g.hp.tip': '听不懂、说不出来的时候就说这几句。点 🔊 先听，再自己说出来。',
      'g.rt.h': '🧭 新手路线', 'g.rt.n': '{a} / {b}', 'g.rt.primer': '发音入门：先认字、学发音', 'g.rt.lesson': '{t}：这一课学什么', 'g.rt.cards': '用单词卡认识这一课的词',
      'g.rt.l14': '第 1–4 关：听和说', 'g.rt.scene': '看对话动画', 'g.rt.l57': '第 5–7 关：对话和 BOSS', 'g.rt.adv': '去冒险：到大地图上用学过的话', 'g.rt.chat': '和岛民聊一次天',
      'g.rt.next': '下一课：第 {n} 岛 {t}',
      'g.rt.done': '已完成 {n} 步', 'g.rt.more': '后面还有 {n} 步',
      // 一步一步学：单词小课（tools/course/STARTER.md）
      'g.mn.row': '🌱 一步一步学', 'g.mn.row.done': '学完了', 'g.mn.node': '第 {k} 节小课', 'g.mn.chip': '🌱 {k} / {n}',
      'g.mn.new': '新词', 'g.mn.got': '记住了，下一步 →', 'g.mn.mw.ty': '看意思选词', 'g.mn.mw.t': '这是哪个词？',
      'g.mn.fb.wrong': '没关系，再认一认，等一下再问你一次', 'g.mn.say.soft': '没关系，多听几遍，先往下学',
      'g.mn.res.t': '学会了 {n} 个新词！', 'g.mn.res.sub': '{name} · 小课 {k} / {n}', 'g.mn.res.rev': '这几个词明天会出现在每日复习里。',
      'g.mn.res.next': '下一节小课 →', 'g.mn.res.go': '小课学完了，开始闯关 →', 'g.mn.res.again': '再学一遍',
      'g.mn.ask.h': '先一步一步学', 'g.mn.ask.p': '这一课有 {w} 个新词。先上 {n} 节小课：每节只学三四个，约 3 分钟，先教后练、答错不扣心。学完再来闯关就不难了。',
      'g.mn.ask.go': '开始第 {k} 节小课', 'g.mn.ask.skip': '我学过了，直接闯关', 'g.mn.ls.next': '开始第 1 节小课 →',
      'g.rt.mini': '上小课：每节学三四个新词',
      'g.set.starter': '一步一步学', 'g.set.starter.d': '给零基础的人：每一课闯关以前先上几节小课，每节只学三四个新词，先教后练、答错不扣心。',
      'g.set.slow': '朗读速度', 'g.set.slow.off': '正常', 'g.set.slow.on': '🐢 慢', 'g.set.slow.d': '慢：配音放慢一点（声音不变调）。每个 🔊 旁边的 🐢 只放慢那一次。',
      'g.set.route': '新手路线', 'g.set.route.d': '首页最上面一步一步教你怎么学（打通第 3 岛以后就不再显示）。',
      'g.det.later': '再想想', 'g.det.go': '开始闯关',
      'g.play.norev': '今天没有要复习的题，太棒了！', 'g.play.boss': '{name} 挡住了去路！听懂它的话，<b>大声说出</b>正确的回答来攻击它。', 'g.play.fight': '⚔️ 迎战！',
      'g.play.combo': '🔥 {n} 连击', 'g.play.xpx': ' · 经验 ×{m}',
      'g.play.play': '播放', 'g.play.slowplay': '慢速播放', 'g.play.slow': '慢速', 'g.play.hear': '听原音', 'g.play.hearq': '听对方说', 'g.play.model': '听示范', 'g.play.again': '再听一遍',
      'g.play.mic': '开始说话', 'g.play.mic.sr': '点麦克风，然后大声说英语', 'g.play.mic.rec': '点麦克风开始录音，说完再点一次',
      'g.play.skip': '现在不方便开口？跳过这题', 'g.play.hint': '💡 提示', 'g.play.hint2': '💡 再给点提示',
      'g.play.listening': '正在听……说完会自动停止', 'g.play.nomic': '用不了麦克风，已切换成「大声读 + 自评」模式',
      'g.play.nosr': '这个浏览器连不上语音识别，已切换成「录音自评」模式', 'g.play.bt.tap': '点出正确的回答，再大声说出来',
      'g.play.rec.done': '录好了！在下面比一比', 'g.play.rec.on': '正在录音……说完点一下停止', 'g.play.rerec': '点麦克风重新录音',
      'g.play.self.pic': '先看图<b>大声说出英文</b>，说完再看答案', 'g.play.self.mem': '先<b>凭记忆大声说出来</b>，说完再看答案', 'g.play.self.done': '我说完了，看答案',
      'g.play.self.bt': '现在对着{name}大声说：<b>{s}</b>', 'g.play.self.cmp': '听听自己的录音，和原音比一比，像不像？', 'g.play.self.read': '大声读 2 遍，然后诚实地给自己打个分',
      'g.play.self.mine': '▶ 我的录音', 'g.play.self.orig': '🔊 原音',
      'g.play.rate.0': '😅 再练练', 'g.play.rate.1': '🙂 还行', 'g.play.rate.2': '😎 很像',
      'g.play.rate.again': '再听一遍原音，跟着读 ', 'g.play.rate.rerec': '，然后重新录音',
      'g.fb.xp': ' +{n} 经验', 'g.fb.peek': '（看了原文，减半）', 'g.fb.aid': '（有提示，减半）',
      'g.fb.wrong': '哎呀，不对', 'g.fb.ans': '正确答案：', 'g.fb.order': '顺序不对', 'g.fb.sent': '正确句子：', 'g.fb.reply': '正确回答：',
      'g.fb.heard': '我听到的是：“{s}”', 'g.fb.pts': '分',
      'g.fb.retry.mem': '再试一次！想不起来可以点「💡 提示」', 'g.fb.retry.red': '红色的词没读准，先点🔊听一遍，再试一次', 'g.fb.try': '（第 {n}/3 次）',
      'g.fb.bt.unheard': '没听清。直接点出正确的回答，再大声读一遍也行（这题不能暴击了）',
      'g.fb.pass.aid.rev': '过关！这次有提示，明天再考一次', 'g.fb.pass.aid': '过关！这次有提示，经验减半', 'g.fb.perfect': 'Perfect！每个词都说对了',
      'g.fb.good': 'Good！说得不错', 'g.fb.pass': '过关！再多练练会更好',
      'g.fb.fail': '没关系，这句先记下来', 'g.fb.saved': '已放进错题本（不扣心）：',
      'g.fb.skip.ai': '先跳过了', 'g.fb.skip': '已跳过', 'g.fb.skip.owe': '已放进复习，联网后要补说：',
      'g.fb.dodge': '{name} 躲开了！这句回答不对', 'g.fb.bt.see': '没对上。看看这几个回答，把对的那句大声说出来（这题不能暴击了）',
      'g.fb.bt.tap': '识别不太准？直接点出正确回答，再大声读一遍也行', 'g.fb.bt.again': '没对上任何一个选项，再说一次（第 {n}/3 次）',
      'g.fb.crit': '暴击！', 'g.fb.hit': '命中！',
      'g.res.fail': '<h2>小船没电了！</h2><p>3 颗心都用完了。错的题已经放进错题本。</p>', 'g.res.revive': '花 30 金币复活，继续这关',
      'g.res.once': '（每关只能复活一次）', 'g.res.poor': '（金币不够）', 'g.res.map': '回地图', 'g.res.retry': '重新挑战',
      'g.res.next': '下一关 →', 'g.res.goisle': '出发去 {name} →', 'g.res.nextunit': '下一单元：{name} →', 'g.res.adv': '🗺️ 去冒险', 'g.res.talk': '🗣️ 去和岛民聊天',
      'g.res.rev': '复习完成！', 'g.res.beat': '打败 {name}！', 'g.res.perfect': '完美通关！', 'g.res.clear': '通关！',
      'g.res.more': '今天还有 {n} 题可以复习', 'g.res.alldone': '今天的复习全部完成 ✅',
      'g.res.lucky': '🍀 幸运暴击！金币翻倍', 'g.res.three': '首次三星奖励 +15 金币', 'g.res.balls': '🔮 回声球 +{n}（去怪兽冒险收服怪兽）', 'g.res.newisle': '🏝️ 新岛屿解锁：{name}',
      'g.res.gate.open': '🔓 冒险解锁了！今天可以去怪兽冒险了', 'g.res.gate.talk': '✅ 复习完成 · 再和岛民用英语聊一聊（已开口说 {n}/{need} 句）就能去冒险',
      'g.res.gate.more': '再复习一轮（答对一半以上）才算完成哦',
      'g.res.xp': '经验', 'g.res.coins': '金币', 'g.res.combo': '最高连击', 'g.res.recall': '🔥 不看字说对 {n} 题，记得真牢！',
      'g.res.score': '答对 {c} / {t}', 'g.res.nolose': '不丢心、', 'g.res.3star': '答对 90% 以上可拿三星',
      'g.res.aided': '💡 其中 {n} 题用了提示（经验减半）', 'g.res.aided.rev': '💡 其中 {n} 题用了提示（经验减半，明天再考一次）', 'g.res.again': '再玩一次',
      'g.res.streak': '🔥 今日打卡成功！已连续 {n} 天',
      'g.res.lvup': '<h2>升级啦！Lv {lv}</h2><p>新称号：<b>{title}</b>。奖励 20 金币，去宠物店看看吧！</p>', 'g.res.yay': '太好了',
      'g.res.rest': '<h2>护眼时间</h2><p>已经连续练了 30 分钟，真厉害！看看窗外远处 20 秒，喝口水，让眼睛和嗓子歇一歇。</p>',
      'g.res.resting': '休息中 {n}', 'g.res.rested': '休息好了，继续',


      // —— 第三段：对话动画剧场、宝箱 / 商店 / 设置、新版本、导出 / 恢复（G3）——
      'g.ver.name': '回声岛 {name}（{code}）', 'g.ver.app': '回声岛 安卓版', 'g.ver.web.name': '回声岛 网页版',
      'g.ver.new.h': '有新版本了',
      'g.ver.new.p': '<p>现在装的是 <b>{me}（{mc}）</b>，新版本是 <b>{ne}（{nc}）</b>。</p>',
      'g.ver.new.notes': '<p class="tip">更新了什么：{notes}</p>',
      'g.ver.new.how': '请家长把新版本覆盖安装到这台手机上（存档不会丢，安装前也可以先在设置里「导出存档」）。',
      'g.ver.new.url': '下载地址：<br><b class="ver-url">{url}</b>', 'g.ver.share': '📤 把地址发给家长',
      'g.ver.sheet.h': '🆕 检查新版本的地址', 'g.ver.sheet.p': '打开 App 时去这个地址看有没有新版本（一个 version.json 文件）。',
      'g.ver.sheet.def': '留空就用默认地址：', 'g.ver.sheet.none': '留空就不检查。', 'g.ver.back': '返回', 'g.ver.save': '保存',
      'g.bak.title': '回声岛存档（含 AI 生成的聊天文字）', 'g.bak.toast.file': '📤 选「微信」发给家长或者「文件传输助手」存起来', 'g.bak.toast.text': '📤 选「微信」发给家长存起来',
      'g.bak.toast.dl': '💾 存档下载好了：{name}', 'g.bak.toast.fail': '导出失败了',
      'g.bak.row.dev': '📱 这台设备 · {d}', 'g.bak.row.reset': '↩️ 清空之前的进度', 'g.bak.row.restore': '↩️ 上次恢复之前的进度', 'g.bak.row.dl': '📁 下载/EchoIsland · {d}',
      'g.bak.sheet.h': '🗂️ 从备份恢复', 'g.bak.sheet.p': '选一份备份，用它替换现在的进度。现在的进度会先另存一份（恢复错了还能换回来）。',
      'g.bak.none': '还没有备份。每天第一次打开游戏时会自动备份一份。',
      'g.bak.file.native': '📂 从文件里选（换手机、重装以后用；微信里收到的存档文件先存到手机里）', 'g.bak.file.web': '📂 选一个存档文件（.json）',
      'g.bak.bad': '这个文件不是回声岛的存档，或者已经坏了', 'g.bak.label': '备份',
      'g.bak.use.h': '用这份备份？', 'g.bak.use.p': '现在的进度（{cur}）会被换掉，不过会先另存一份。', 'g.bak.use.no': '不了', 'g.bak.use.go': '恢复',
      'g.bak.full': '存不进去（这台设备的空间满了？）', 'g.bak.picked': '选的文件', 'g.bak.readfail': '读不了这个文件（{e}）',
      'g.err.native': '原生：', 'g.err.recent': ' · 最近 {n} 条（最多留 50 条）', 'g.err.none': '没有出错记录 👍',
      'g.err.share': '📤 发给帮忙的人', 'g.err.clear': '🧹 清空',
      'g.intro.h': '欢迎来到回声岛！',
      'g.intro.p1': '<p><b>🐲 怪兽冒险</b>：选一只怪兽当伙伴，用英语念咒语攻击，听懂对手的英语来防御。收服新怪兽、升级进化，打败 13 个区域的岛主拿徽章。</p>',
      'g.intro.p2': '<p><b>📚 闯关练习</b>：📗 课本单元（适用于沪教版词汇，跟着学校的单元走）和 13 座话题小岛。每通关一关送回声球，用来收服怪兽。</p>',
      'g.intro.p3': '<p><b>🗣️ 和岛民聊天</b>：按住话筒，用英语和岛上的人真的聊天；聊完 AI 写评语，说错的句子第二天会出现在 📕 每日复习里。</p>',
      'g.intro.p4': '<p>🎁 每天 3 个任务，做完开宝箱 · 🔥 每天打一场就算打卡</p>',
      'g.intro.voice': '🔊 试试声音', 'g.intro.go': '出发！',
      'g.set.nokey.h': '🔑 请家长在这里粘贴 AI 密钥', 'g.set.nokey.d': '还没有 AI 密钥：口语题没法自动打分（可以先跳过，联网有密钥以后再补说），也不能和岛民聊天。',
      'g.set.h': '设置', 'g.set.mine': '🙂 我的设置',
      'g.set.mic': '🩺 麦克风和网络', 'g.set.mic.btn': '检查一下（说一句 Hello）',
      'g.set.rate': '朗读速度', 'g.set.try': '🔊 试听',
      'g.set.tts': '发音来源', 'g.set.tts.auto': '自然配音', 'g.set.tts.device': '本机声音', 'g.set.tts.online': '只用配音',
      'g.set.tts.d': '「自然配音」：固定的句子用提前合成的真人感配音，拼了名字的句子联网时用阿里云现场合成，没网时用本机声音。「只用配音」不用本机声音。选「本机声音」就全部用浏览器自带的朗读。',
      'g.set.voice': '朗读声音',
      'g.set.sc.app': '口语打分', 'g.set.sc.app.d': '🎤 一律开口说，AI 听写打分（阿里云语音识别），说得不准会给一句中文建议。要联网。',
      'g.set.sc.mode': '口语打分方式', 'g.set.mode.auto': 'AI 打分（推荐）', 'g.set.mode.self': '录音自评',
      'g.set.sc.mode.d': 'AI 打分：连得上对话服务就用阿里云语音识别打分，否则用浏览器自带的识别。',
      'g.set.gfx': '冒险画面', 'g.set.gfx.auto': '自动', 'g.set.gfx.high': '精美', 'g.set.gfx.mid': '标准', 'g.set.gfx.low': '省电', 'g.set.gfx.2d': '2D 流畅',
      'g.set.gfx.auto.d': '自动：好手机先用精美画质，其他先用标准，跑不动会自动降一档', 'g.set.gfx.now': '（现在是「{m}」）', 'g.set.stop': '。',
      'g.set.gfx.hot': '手机发烫或者卡顿，就选省电或 2D 流畅。',
      'g.set.look': '画面风格', 'g.set.look.std': '经典', 'g.set.look.new': '新画风（试用）',
      'g.set.look.d': '新画风还在试：只换户外的小镇和道路，房子里、洞穴里照旧。卡顿就换回经典。',
      'g.set.ctl': '冒险里的操作', 'g.set.ctl.joy': '🕹️ 摇杆', 'g.set.ctl.pad': '✚ 方向键',
      'g.set.ctl.pad.d': '方向键：左下角十字键走路；A / B 在右下角。', 'g.set.ctl.joy.d': '摇杆：左手按住屏幕左边任意地方推着走；A / B 在右下角。',
      'g.set.or': '屏幕方向', 'g.set.or.portrait': '📱 竖屏', 'g.set.or.landscape': '🎮 横屏', 'g.set.or.auto': '🔄 跟着手机转',
      'g.set.or.d': '横屏玩冒险和对战更像掌机；做题、聊天竖着横着都能用。',
      'g.set.sfx': '音效', 'g.set.on': '开', 'g.set.off': '关',
      'g.set.mu': '音乐', 'g.set.mu.off': '关', 'g.set.mu.low': '小', 'g.set.mu.mid': '中', 'g.set.mu.high': '大',
      'g.set.lic': '开源许可与致谢',
      'g.set.gate': '先学习再冒险', 'g.set.gate.on': '🔒 开（推荐）',
      'g.set.gate.d': '开着时，每天先做完每日复习、用英语和岛民聊一聊（用语音说满 6 句，或者完成一个小目标），才能去怪兽冒险。关掉要家长密码，关过的天周报上会标出来；关着时冒险也不限时。',
      'g.set.lim': '⏱️ 冒险时间', 'g.set.edit': '改',
      'g.set.lim.d': '只算大地图和对战的时间。时间到了不会半路掐断，等这一场战斗或这段对话结束再回首页。多做一轮复习、多完成一个聊天目标、多通关一关新练习（或拿到更多星星），每样 +10 分钟。',
      'g.set.mix': '冒险里的英语题', 'g.set.mix.a': '多出课本', 'g.set.mix.b': '少量课本', 'g.set.mix.c': '只用岛上话题',
      'g.set.mix.d': '打怪兽、答村民的题时，有一部分换成课本正在学的单元（{unit}，在闯关页「📗 课本单元」里改）。',
      'g.set.ai': '🗣️ AI 聊天和口语打分', 'g.set.ai.on': '✅ 已连上阿里云', 'g.set.ai.off': '⚠️ 还没有 AI 密钥', 'g.set.ai.change': '换密钥', 'g.set.ai.paste': '粘贴密钥',
      'g.set.ai.on.d': '用阿里云百炼的 API Key，只存在这台手机里，装新版也不用重填。',
      'g.set.ai.off.d': '请家长在这里粘贴 AI 密钥（阿里云百炼的 API Key），只存在这台手机里。设好以后能和岛民用英语聊天，口语题也会自动打分。',
      'g.set.unl': '闯关练习：全部关卡直接开放', 'g.set.unl.0': '按顺序解锁', 'g.set.unl.1': '全部直接开放',
      'g.set.unl.d': '只对「📚 闯关练习」有效（想跟着课本直接练某个单元时打开）；冒险里的徽章、守卫、回声技能不受影响。',
      'g.set.push': '📲 学习日报发到微信', 'g.set.push.on': '✅ 每天 20 点以后发（{k}）', 'g.set.push.wecom': '企业微信群机器人', 'g.set.push.off': '没开（默认不发）', 'g.set.push.btn': '设置',
      'g.set.saf': '👪 聊天安全', 'g.set.saf.look': '看需要注意的聊天', 'g.set.saf.n': '看需要注意的聊天（{n} 段）', 'g.set.saf.info': 'ℹ️ 家长须知',
      'g.set.saf.d': '孩子在聊天里说到难过、被欺负、有危险时，那段聊天会标出来，输家长密码能看全文。',
      'g.set.pin': '🔑 家长密码', 'g.set.pin.has': '已经设好了', 'g.set.pin.none': '还没设', 'g.set.pin.change': '改密码', 'g.set.pin.set': '设密码',
      'g.set.pin.d1': '首次设置时家长设的 4 位密码（手机里只存加了随机盐的哈希），输错 5 次锁 10 分钟。忘了密码：先「💾 导出存档」（不用密码）→ 在手机设置里清除这个 App 的数据 → 重新走一遍家长设置、设新密码 → 「从备份恢复」，进度就回来了（手机「下载/EchoIsland」里每天也有自动备份）。',
      'g.set.pin.nat.has': '打包时设好的 4 位密码，输错 5 次锁 10 分钟。要换密码：改 echo.properties 的 PARENT_PIN，重新打包安装（存档不会丢）。',
      'g.set.pin.nat.none': '⚠️ 这个安装包没有设家长密码，上面这些都改不了。请家长在 echo.properties 里写 PARENT_PIN（4 位数字），重新打包安装。',
      'g.set.pin.web.none': '还没设（第一次要用时由家长来设）', 'g.set.pin.lock': '输错 5 次锁 10 分钟。',
      'g.set.fam': '👪 家庭定制', 'g.set.fam.noname': '（没起名）', 'g.set.sep': '、',
      'g.set.fam.d': '孩子的英文昵称和形象、博士包里的 3 只伙伴（开始新冒险时生效）、家里的人。只存在这台手机里。',
      'g.set.dev': '🩺 设备检查', 'g.set.dev.ok': '✅ 合格', 'g.set.dev.warn': '⚠️ 能玩', 'g.set.dev.bad': '❌ 不合格', 'g.set.dev.none': '没做过', 'g.set.dev.again': '再检查一次',
      'g.set.priv': '📄 隐私和同意', 'g.set.priv.doc': '儿童隐私说明', 'g.set.priv.consent': '监护人同意书',
      'g.set.priv.ok': '监护人 {d} 同意过（{v} 版）。要撤回同意：在上面「AI 聊天和口语打分」里删掉密钥（就不再连 AI），或者卸载 App。',
      'g.bak.h': '💾 存档备份', 'g.bak.export': '📤 导出存档', 'g.bak.restore': '🗂️ 从备份恢复',
      'g.bak.d1': '每天第一次打开时自动备份：这台设备上留 3 份', 'g.bak.last': '（最近一份是 {d} 的）', 'g.bak.before': '以前',
      'g.bak.dl': '，手机「下载/EchoIsland」文件夹里留 7 份（卸载 App 也不会删）',
      'g.bak.d2': '。「导出存档」可以发到微信里存着，换手机、重装以后用「从备份恢复」。', 'g.bak.used': '存档空间已用 {n}%。',
      'g.ver.h': '🆕 检查新版本', 'g.ver.edit': '改地址', 'g.ver.defaultUrl': '默认地址',
      'g.ver.on': '打开 App 时去看一眼有没有新版本（{url}），有就在首页提示「请家长更新」。',
      'g.ver.noaddr': '没有填地址：不检查新版本（新版本由帮您安装的人发给您）。', 'g.ver.web': '网页版总是最新的，不用检查。',
      'g.err.h': '🔧 出错记录', 'g.err.week': '最近 7 天 {n} 条', 'g.err.look': '看看',
      'g.err.d': '游戏出错时自动记下最近 50 条，只存在这台设备里。手机上有问题时，可以把它发给帮你装游戏的人。',
      'g.set.reset': '清空进度', 'g.set.reset.btn': '清空全部进度', 'g.set.reset.d': '星星、金币、怪兽、复习记录都会清零，无法恢复。要家长密码，还要输入「清空」两个字。',
      'g.set.parent': '🔒 家长设置',
      'g.chest.pet': '<h2>开出限定宠物：{name}！</h2><p>宝箱限定，商店买不到哦。</p>',
      'g.chest.freeze': '<h2>开出连胜保护卡！</h2><p>哪天忘了打卡，它会自动帮你保住连续天数。</p>',
      'g.chest.coins': '<h2>开出 {n} 金币！</h2><p>明天再来，任务会刷新。</p>',
      'g.chest.take': '收下',
      'g.shop.following': '跟着你', 'g.shop.take': '点击带上', 'g.shop.chestonly': '宝箱限定', 'g.shop.fromchest': '每日宝箱开出',
      'g.shop.head': '<h2>宠物店</h2><p>你有 <b>{n}</b> 金币。宠物会在地图上陪你闯关。</p>',
      'g.shop.fz': '连胜保护卡（有 {n} 张，最多 2 张）', 'g.shop.fzd': '忘记打卡一天时自动使用，保住连续天数', 'g.shop.fzbtn': '100 金币',
      'g.shop.chestpet': '这只宠物只能从每日宝箱开出', 'g.shop.short': '金币还差 {n}，去闯关赚金币吧', 'g.shop.bought': '买到了 {name}！',
      'g.achv.h': '成就 {n} / {t}', 'g.achv.sum': 'Lv {lv} {title} · 共 {stars} 颗星 · 开口说对 {spoken} 次 · 完成 {levels} 关',
      'g.set.env.app': '✅ 朗读：自然配音（装在手机里，不用联网）', 'g.set.env.sr.ok': '✅ 口语自动打分：说完一句交给阿里云识别（要联网）',
      'g.set.env.sr.nokey': '⚠️ 口语自动打分：还没有 AI 密钥', 'g.set.env.see': '（见上面）', 'g.set.env.paste': '，请家长在「设置 → 🔒 家长设置」里粘贴',
      'g.set.env.dev': '✅ 朗读：本机声音 {name}', 'g.set.env.nodev': '⚠️ 朗读：这个浏览器没有英语声音，在「设置」里换成「自然配音」',
      'g.set.env.nat': '✅ 朗读：自然配音（没有配音的句子联网时用阿里云现场合成）', 'g.set.env.nat.dev': '✅ 朗读：自然配音（没有配音的句子联网时用阿里云现场合成，没网时用本机声音）',
      'g.set.env.wx': '<br>📱 你正在微信里打开：点右上角「···」→「在浏览器打开」，录音和语音识别会更稳定。',
      'g.set.env.sr.web': '✅ 支持语音识别，开口会自动打分', 'g.set.env.sr.none': '⚠️ 语音识别不可用，口语题用「录音 + 自评」',
      'g.set.env.tip': '在中国大陆，电脑上推荐用 <b>Edge 浏览器</b>，手机推荐 <b>iPhone 自带 Safari</b>；Chrome 的语音识别要连 Google 服务器，通常用不了。',
      'g.th.tip.watch': '先完整看一遍。关掉英文字幕，就能练纯听力。点下面的对话记录可以单独再听一句。',
      'g.th.tip.shadow': '每句播完会停下来，你跟着说一遍，说对了自动继续。',
      'g.th.tip.role': '选一个角色，轮到你时大声说出台词，另一个角色由电脑来演。',
      'g.th.lvup': '🎖️ 升级啦！Lv {lv} {title} +20 金币',
      'g.th.pause': '⏸ 暂停', 'g.th.resume': '▶ 继续', 'g.th.again': '🔁 再来一遍', 'g.th.start': '▶ 开始播放',
      'g.th.m.watch': '👀 看动画', 'g.th.m.shadow': '🔁 跟读', 'g.th.m.role': '🎭 角色扮演',
      'g.th.exit': '退出', 'g.th.ep': '第 {n} 集', 'g.th.you': ' · 你', 'g.th.me': '我来演',
      'g.th.slow': '<span>🐢</span>慢速', 'g.th.en': '<span>En</span>英文', 'g.th.zh': '<span>中</span>中文',
      'g.th.end': '🎉 演完啦！', 'g.th.idle': '点「开始播放」，看看他们怎么说', 'g.th.ear': '🎧 只用耳朵听……',
      'g.th.logh': '对话记录（点一句再听一遍）',
      'g.th.turn.role': '轮到你了，大声说：', 'g.th.turn.shadow': '跟着说一遍：',
      'g.th.taps': '点麦克风，然后大声说', 'g.th.hear': '🔊 听示范', 'g.th.skip': '跳过这句',
      'g.th.orskip': '，或者点「跳过这句」', 'g.th.canskip': '（可以先点「跳过这句」）',
      'g.th.perfect': '<b>{n} 分</b> Perfect！', 'g.th.good': '<b>{n} 分</b> Good！',
      'g.th.msg.watch': '第一次看完 +10 金币', 'g.th.msg.shadow': '跟读完成 +20 经验', 'g.th.msg.role': '角色扮演完成 +30 经验 +10 金币',
      'g.th.next.shadow': '🔁 接着跟读', 'g.th.next.role': '🎭 试试角色扮演', 'g.th.swap': '换演 {name}',
      'g.th.fin.role': '演得真棒！', 'g.th.fin.shadow': '跟读完成！', 'g.th.fin.watch': '看完啦！', 'g.th.fin.more': '多看几遍，对话就能脱口而出', 'g.th.map': '回地图',


      // —— 第四段：事件、对战工具、学习记录、学习锁、冒险时间、家长密码、周报、日报推送、启动（G4）——
      'g.ev.bookat': '📍 现在学 {b} Unit {n}，冒险里会多出它的题',
      'g.ev.locked.h': '{b}还没开放',
      'g.ev.locked.p': '这台手机上开放的是这个学年的课本单元。下一学年的单元是另外的内容包，请家长联系帮您安装的人。',
      'g.ev.pick.h': '📗 课本学到哪个单元了？',
      'g.ev.pick.p': '选好以后，闯关页会标出这个单元；怪兽冒险里的英语题也会多出这个单元的单词和句子。',
      'g.ev.pick.old': '（旧版）',
      'g.ev.gram.h': 'Unit {n} 语法：{t}',
      'g.ev.gram.h0': 'Unit {n} 语法',
      'g.ev.why.mix': '改冒险里的英语题',
      'g.ev.why.gate': '关学习锁',
      'g.ev.why.clock': '手机日期被改过：从今天重新开始',
      'g.ev.clock.ok': '📅 好了，从今天重新开始',
      'g.ev.why.pin': '改家长密码',
      'g.ev.pin.ok': '🔑 家长密码改好了',
      'g.ev.why.lim': '改冒险时间',
      'g.ev.why.push': '改学习日报推送',
      'g.ev.why.ver': '改检查新版本的地址',
      'g.ev.why.bak': '从备份恢复',
      'g.ev.why.unlock': '闯关练习全部直接开放',
      'g.ev.why.reset': '清空全部进度',
      'g.ev.why.zh': '改剧情中文',
      'g.ev.micfix': '在「权限 → 麦克风」里选「允许」，再回到游戏',
      'g.ev.upd.t': '回声岛有新版本',
      'g.ev.upd.b': '回声岛新版本 {v}：{u}',
      'g.ev.ver.https': '地址要以 https:// 开头',
      'g.ev.ver.new': '好了，以后去新地址检查',
      'g.ev.ver.def': '用回默认地址',
      'g.ev.bak.bad': '这份备份读不出来',
      'g.ev.bak.pick': '打不开文件选择',
      'g.ev.bak.big': '文件太大了，不像存档',
      'g.ev.bak.read': '读不了这个文件',
      'g.ev.err.title': '回声岛出错记录',
      'g.ev.err.copied': '复制好了，可以粘贴发给别人',
      'g.ev.err.nocopy': '复制不了',
      'g.ev.playfail': '播放录音失败',
      'g.ev.quit.h': '要离开这一关吗？',
      'g.ev.quit.p': '现在退出，这一关的进度不会保存。',
      'g.ev.quit.yes': '退出',
      'g.ev.quit.no': '继续闯关',
      'g.ev.revive': '❤️ 复活成功！',
      'g.ev.sep': '、',
      'g.ev.rv.h': '每日复习',
      'g.ev.rv.miss': ' · 错过 {n} 次',
      'g.ev.rv.today': '今天要复习 <b>{n}</b> 题：{list}。',
      'g.ev.rv.wrong': '{n} 道错题',
      'g.ev.rv.old': '{n} 道学过的',
      'g.ev.rv.chat': '{n} 句 AI 聊天里学到的更好说法',
      'g.ev.rv.done': '今天的复习做完了！',
      'g.ev.rv.rule': '答错的题当天就复习；复习答对一次，隔 1、2、4、7、15、30 天再考一次，都对了就算掌握。冒险里答对今天到期的题也算复习。',
      'g.ev.rv.tip': '⏳ 以后会回来的 {a} 题 · 🏅 已经掌握 {b} 题',
      'g.ev.rv.sum': '📖 错题本（点一句就能听）',
      'g.ev.rv.later': '等会儿',
      'g.ev.rv.go': '复习 {n} 题',
      'g.ev.claim': '+{c} 金币 +20 经验',
      'g.ev.nosr': '这个浏览器不支持语音识别，会继续用录音自评',
      'g.ev.reset.h': '清空全部进度',
      'g.ev.reset.p': '星星、金币、怪兽、徽章、复习记录都会清零。清空前会先另存一份，清错了可以在「从备份恢复」里找回（要家长密码）。',
      'g.ev.reset.ask': '真的要清空，请在下面输入「清空」两个字：',
      'g.ev.reset.aria': '输入清空两个字',
      'g.ev.reset.no': '不清空了',
      'g.ev.reset.go': '清空',
      'g.ev.reset.word': '清空',
      'g.ev.reset.need': '要输入「清空」两个字才会清空',
      'g.ev.reset.done': '进度已清空',
      'g.gate.rev.done': '每日复习 · 今天做完一轮了',
      'g.gate.rev.none': '每日复习（今天没有要复习的）',
      'g.gate.rev.todo': '做一轮每日复习（{n} 题）',
      'g.gate.chat.goal': '和岛民聊天：完成了小目标',
      'g.gate.chat.said': '和岛民聊天：今天开口说了 {n} 句英语',
      'g.gate.chat.noai': '和岛民聊天（AI 聊天还没开通，今天先跳过）',
      'g.gate.chat.daily': '和岛民聊天（今天的聊天时间用完了，先跳过）',
      'g.gate.chat.pass': '和岛民聊天：{r}，先让你冒险 {n} 分钟',
      'g.gate.chat.key': '和岛民聊天：{r}，现在聊不了，请告诉家长（家长可以在 🔒 家长设置 里暂时关学习锁）',
      'g.gate.chat.used': '用英语和岛民聊天：已开口说 <em class="gate-n">{a}/{b}</em> 句（{x}）',
      'g.gate.chat.go': '用英语和岛民聊天：已开口说 <em class="gate-n">{a}/{b}</em> 句，或者完成一个小目标',
      'g.gate.why.offline': '现在没网',
      'g.gate.why.daily': '今天的聊天时间用完了',
      'g.gate.why.fail': '今天聊天连不上',
      'g.gate.key.quota': 'AI 额度用完了',
      'g.gate.key.auth': 'AI 密钥不对',
      'g.gate.again.tmr': '明天再来聊',
      'g.gate.again.net': '连上网说满就能接着冒险',
      'g.gate.t.back': '📅 手机日期好像被改过了',
      'g.gate.t.pass': '📵 今天先去冒险吧（临时 {n} 分钟）',
      'g.gate.t.open': '🎉 今天的学习完成了，出发冒险吧！',
      'g.gate.t.todo': '📚 冒险前的 2 个小任务（完成 {n}/2）',
      'g.gate.back.tip': '把手机改回「自动设置日期和时间」再来。',
      'g.gate.back.btn': '👪 家长：从今天重新开始',
      'g.gate.btn.rev': '去复习',
      'g.gate.btn.chat': '去聊天',
      'g.gate.report': '📊 看这周的学习周报',
      'g.gate.blk.back': '手机日期好像被改过了，改回自动时间再来',
      'g.gate.blk.rev': '先把今天的每日复习做完，再去冒险',
      'g.gate.blk.key': '{r}，现在没法聊天：请告诉家长',
      'g.gate.blk.used.daily': '临时冒险时间用完了，今天的聊天时间也用完了，明天再来吧',
      'g.gate.blk.used': '临时冒险时间用完了：连上网，用英语和岛民聊一聊就能接着玩',
      'g.gate.blk.chat': '先用英语和岛民聊一聊：开口说满 {need} 句（现在 {n} 句），或者完成一个小目标',
      'g.adv.nolimit': '不限时',
      'g.adv.lim': '上学日 {wd} 分钟 · 周末 {we} 分钟',
      'g.adv.lim.night': ' · {a}–{b} 不能冒险',
      'g.adv.line.night': '🌙 {a} 到早上 {b} 不能冒险',
      'g.adv.line.over': '⏰ 今天的冒险时间用完了',
      'g.adv.line.more': '（多学一点能换时间）',
      'g.adv.line.left': '🕹️ 今天还能冒险 <b>{n}</b> 分钟',
      'g.adv.line.bonus': '（含多学奖励 {n} 分钟）',
      'g.adv.pass.toast': '📵 {r}：先让你冒险 {n} 分钟',
      'g.adv.pass.offline': '今天没网',
      'g.adv.pass.daily': '今天的聊天时间用完了',
      'g.adv.pass.fail': '今天聊天连不上',
      'g.adv.stop.night.h': '该睡觉啦！',
      'g.adv.stop.night.p': '{a} 到早上 {b} 不能冒险。怪兽们都睡着了，明天再来吧！',
      'g.adv.stop.time.h': '今天的冒险时间到啦！',
      'g.adv.stop.time.in': '今天冒险了 {n} 分钟，怪兽们也要休息了。明天再来！',
      'g.adv.stop.time.out': '今天冒险了 {n} 分钟，怪兽们也要休息了。进度都存好了，明天再来！',
      'g.adv.stop.pass.h': '临时冒险时间到了',
      'g.adv.stop.pass.p': '今天没网（或者聊天连不上），先让你冒险了 {n} 分钟。连上网，用英语和岛民聊一聊，就能接着冒险。',
      'g.adv.stop.def': '先休息一下吧',
      'g.adv.stop.more': '想多玩一会儿？多做一轮复习、多完成一个聊天目标、或者多通关一关新练习（或拿到更多星星），每样能换 10 分钟（今天还能换 {n} 分钟）。',
      'g.adv.ok': '好的',
      'g.adv.warn5': '⏰ 今天的冒险还剩 5 分钟，打完这一场就该休息啦',
      'g.adv.min': '{n} 分钟',
      'g.adv.sheet.h': '⏱️ 冒险时间',
      'g.adv.sheet.p': '只算大地图和对战的时间（做题、复习、聊天不算）。时间到了不会半路掐断：等这一场战斗或这段对话结束，再提示回首页。',
      'g.adv.sheet.on': '冒险限时',
      'g.adv.sheet.lim': '限时（推荐）',
      'g.adv.sheet.wd': '上学日（周一到周五）每天',
      'g.adv.sheet.we': '周末每天',
      'g.adv.sheet.from': '晚上几点以后不能冒险',
      'g.adv.sheet.any': '不管',
      'g.adv.sheet.to': '早上几点以后才能冒险',
      'g.adv.sheet.max': '多学一点换时间，每天最多',
      'g.adv.sheet.plus': '+{n} 分钟',
      'g.adv.sheet.none': '不奖励',
      'g.adv.sheet.small': '多做一轮复习、多完成一个聊天目标、多通关一关新练习（或拿到更多星星），每样 +10 分钟。',
      'g.adv.sheet.done': '完成',
      'g.pin.none.h': '还没有家长密码',
      'g.pin.none.p': '这个安装包打包时没有设家长密码，「{w}」现在改不了。',
      'g.pin.this': '这个设置',
      'g.pin.none.tip': '请家长在电脑上的 android/echo.properties 里写 PARENT_PIN（4 位数字），重新打包安装（存档不会丢）。',
      'g.pin.first': '第一次用：请家长设一个 4 位数字密码，别告诉孩子',
      'g.pin.locked': '输错太多次了，{n} 分钟后再试',
      'g.pin.t.set1': '设一个 4 位数字的家长密码',
      'g.pin.t.set2': '再输一遍，确认一下',
      'g.pin.t.check': '请家长输入 4 位密码',
      'g.pin.clr': '清除',
      'g.pin.del': '删掉一位',
      'g.pin.h': '家长密码',
      'g.pin.typed': '已经输了 {n} 位',
      'g.pin.weak': '这个密码太好猜了，换一个吧',
      'g.pin.diff': '两次不一样，重新设一次',
      'g.pin.nosave': '密码没改成：要先输对旧密码，2 分钟内改完。再点一次「改密码」',
      'g.pin.saved': '🔑 家长密码设好了，别告诉孩子哦',
      'g.pin.wrong': '密码不对，还能试 {n} 次',
      'g.pin.again': '密码对了，再点一次刚才的按钮',
      'g.rp.dlg': '问：{q} 答：{a}',
      'g.rp.mon': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      'g.rp.md': '{mon}/{dd}',
      'g.rp.wd': ['日', '一', '二', '三', '四', '五', '六'],
      'g.rp.today': '今天',
      'g.rp.dow': '周{d}',
      'g.rp.heavy.tip': '冒险超过学习的 3 倍',
      'g.rp.miss': ' · 错 {n} 次',
      'g.rp.ex.noai': 'AI 聊天没开通',
      'g.rp.ex.daily': '聊天时间用完了',
      'g.rp.f.off': '🔓 {n} 天关过学习锁',
      'g.rp.f.back': '⏰ 手机日期被改过',
      'g.rp.f.reset': '⏰ 家长重设过日期',
      'g.rp.f.pass': '📵 断网放行 {n} 天',
      'g.rp.f.ex': '🟡 聊天免了 {n} 天（{why}）',
      'g.rp.f.night': '🌙 {n} 天很晚还在冒险',
      'g.rp.f.heavy': '冒险超过学习 3 倍 {n} 天',
      'g.rp.f.pin': '🔑 家长密码输错 {n} 次',
      'g.rp.f.pinlock': '（锁住 {n} 次）',
      'g.rp.f.cleared': '🧹 清空过进度',
      'g.rp.f.restored': '🗂️ 从备份恢复过存档',
      'g.rp.f.noai': '⚠️ AI 聊天没开通',
      'g.rp.f.key': '💳 AI 额度或密钥出问题 {n} 天',
      'g.rp.f.net': '📶 AI 连不上网 {n} 天',
      'g.rp.f.skip': '⏭️ AI 用不了先跳过 {n} 题（都在复习里）',
      'g.rp.f.mic': '🎤 麦克风被拒 {n} 次',
      'g.rp.ab.a': '<p class="rp-ab">💪 <b>能力</b>（和上周比）：每句 {n} 个词',
      'g.rp.ab.b': ' · 一次说对 {n}',
      'g.rp.ab.c': ' · 隔一周还记得 {n}',
      'g.rp.hb.a': '<p class="rp-line">🔥 不看字说对 <b>{n}</b> 句',
      'g.rp.hb.w': '（另有 {n} 个词）',
      'g.rp.hb.say': ' · 💡 带提示 {h} 次 · 🗣️ 聊天开口 {n} 句',
      'g.rp.hb.max': '（最长一句 {n} 个词）',
      'g.rp.hb.zh': ' · 说中文 {n} 句',
      'g.rp.hb.look': ' · 看中文 {a} 次 · 帮帮我 {b} 次',
      'g.rp.hist': '<h3>最近几周</h3><p class="rp-line">📈 学习日 {a}　🔥 不看字说对 {b}</p>',
      'g.rp.cost.lt': '不到 0.01',
      'g.rp.title.n': '{name} 的学习周报',
      'g.rp.title.me': '我的学习周报',
      'g.rp.sub': '{a} – {b} · 学习日 <b>{n}/7</b>',
      'g.rp.since': '（{d} 开始记录）',
      'g.rp.concern': '👪 有 {n} 段聊天需要家长看看（设置 → 🔒 家长设置 → 聊天安全，要家长密码）',
      'g.rp.legend': '每天几分钟：<i class="l"></i>学习 {a} <i class="p"></i>冒险 {b} <i class="o"></i>翻菜单　✅ 完成 🟡 免聊天 📵 断网放行 🔓 关锁 ⏰ 改日期 🌙 很晚',
      'g.rp.t.levels': '完成关卡',
      'g.rp.t.spoken': '开口说对',
      'g.rp.t.review': '复习答对',
      'g.rp.t.chat': 'AI 聊天 {m} 分钟',
      'g.rp.t.fresh': '新学的词句',
      'g.rp.t.mastered': '累计掌握',
      'g.rp.cu': '<p class="rp-line">📗 正在学 <b>{u}</b> · ★ {s}/21 · 这周答错 {n} 次（都进了复习）</p>',
      'g.rp.top': '最容易错的（累计）',
      'g.rp.tips': '聊天里 AI 改过的句子',
      'g.rp.cost': '💰 本周 AI 花费约 ¥{c}',
      'g.rp.cost.web': '（网页版的聊天费用记在中转服务那边）',
      'g.rp.end': '📸 截个图发给家长吧！',
      'g.rp.dg.ai': 'AI 出错 {n} 次',
      'g.rp.dg.aiwhy': '（没网 {a} · 密钥/额度 {b}）',
      'g.rp.dg.chat': ' · 聊天连不上 {n} 天',
      'g.rp.dg.err': ' · 程序出错 {n} 条',
      'g.rp.dg.gl': ' · 3D 画面丢过 {n} 次',
      'g.rp.dg.gone': ' · 画面重开过 {n} 次',
      'g.push.bad': '看不懂这个地址：要 32 位的 PushPlus token，或者 https://qyapi.weixin.qq.com/… 开头的机器人地址',
      'g.push.on': '📲 好了：每天 20 点以后发一条学习日报',
      'g.push.off': '不发日报了',
      'g.push.fill': '先填好 PushPlus token 或企业微信机器人地址',
      'g.push.test.t': '回声岛：测试消息',
      'g.push.test.b': '家长您好！以后每天晚上 8 点以后，会在这里收到孩子当天的学习小结。',
      'g.push.test.ok': '📲 发出去了，去微信里看看有没有收到',
      'g.push.test.no': '没发出去：检查一下网络和地址',
      'g.push.h': '📲 学习日报发到微信',
      'g.push.p': '每天晚上 8 点以后，把孩子当天的学习小结（学了多久、冒险多久、开口说了几句、学习任务完成没有）发一条到家长微信。默认不发。两种方式选一种：',
      'g.push.how1': '<b>PushPlus</b>：微信关注「pushplus 推送加」，在它的网站上复制你的 token（32 位）。',
      'g.push.how2': '<b>企业微信群机器人</b>：企业微信的群 → 群设置 → 群机器人 → 添加，复制 webhook 地址（https://qyapi.weixin.qq.com/… 开头）。',
      'g.push.ph': 'PushPlus token 或机器人地址',
      'g.push.tip': '聊天的内容不会发出去；有需要家长看看的聊天，只提示一句。没网时等联网后补发。',
      'g.push.btn.test': '发一条试试',
      'g.push.btn.save': '保存',
      'g.push.btn.off': '不发了',
      'g.push.btn.back': '返回',
      'g.push.title': '回声岛日报 {md}（{dow}）',
      'g.push.s.open': '✅ 学习任务完成了',
      'g.push.s.ex': '🟡 复习做完了（聊天这一项免了：{why}）',
      'g.push.s.pass': '📵 {r}，先临时冒险了 {n} 分钟（聊天没做）',
      'g.push.s.pass.daily': '聊天时间用完了（没怎么开口）',
      'g.push.s.pass.fail': '聊天连不上',
      'g.push.s.pass.off': '没网',
      'g.push.s.off': '🔓 学习锁关着',
      'g.push.s.todo': '⬜ 学习任务还没完成',
      'g.push.l.time': '⏱️ 学习 {a} 分钟 · 冒险 {b} 分钟',
      'g.push.l.rev': '📕 复习答对 {a} 题 · 🎤 开口说对 {b} 次 · 🔥 不看字说对 {c} 句',
      'g.push.l.chat': '🗣️ 和岛民聊天 {a} 段，用语音说了 {b} 句英语',
      'g.push.l.max': '（最长一句 {n} 个词）',
      'g.push.l.goals': '，完成 {n} 个小目标',
      'g.push.w.off': '🔓 关过学习锁',
      'g.push.w.back': '⏰ 手机日期被改过',
      'g.push.w.night': '🌙 很晚还在冒险',
      'g.push.w.quota': '💳 AI 额度用完了',
      'g.push.w.busy': '⏳ AI 太忙',
      'g.push.w.auth': '🔑 AI 密钥不对',
      'g.push.w.nokey': '🔑 还没有 AI 密钥',
      'g.push.w.skip': '⏭️ AI 用不了先跳过 {n} 题',
      'g.push.w.pinlock': '🔑 家长密码输错太多次被锁了',
      'g.push.w.pin': '🔑 家长密码输错 {n} 次',
      'g.push.l.concern': '👪 有 {n} 段聊天需要家长看看（游戏里：设置 → 🔒 家长设置 → 聊天安全）',
      'g.boot.quiet': '🔇 不用说话模式：要说话的地方都变成按钮了',
      'g.boot.bad.h': '存档读不出来了',
      'g.boot.bad.none': '也没找到能用的备份，只好从头开始。',
      'g.boot.bad.used': '别担心，已经用<b>{w}</b>恢复了，最多少了最近一点点进度。',
      'g.boot.bad.tip': '坏掉的那份另外存着没有删',
      'g.boot.bad.full': '；这台设备的空间满了，这次的进度先不保存，请告诉家长',
      'g.boot.bad.tip2': '。家长也可以在「设置 → 🔒 家长设置 → 💾 存档备份」里换一份备份。',
      'g.boot.restored': '🗂️ 已经从备份恢复：{w}',
      'g.boot.crash.log': '画面进程挂了，已经重新打开',
      'g.boot.crash': '刚才画面出了点问题，已经重新打开了，存档还在',
      'g.shell.title': '回声岛 Echo Island',
      'g.shell.pet': '我的宠物',
      'g.shell.streak': '连续打卡天数',
      'g.shell.coins': '金币',
      'g.shell.tabs': '模式',
      'g.shell.quests': '每日任务',
      'g.shell.review': '错题本',
      'g.shell.shop': '宠物店',
      'g.shell.ach': '成就',
      'g.shell.report': '周报',
      'g.shell.settings': '设置',
      'g.shell.foot': '回声岛 · 七年级英语听说闯关 · 进度只保存在这台设备的浏览器里',
      'g.shell.quit': '退出本关',
      'g.shell.next': '继续',

      // —— 别的语言的课（tools/course/ENGINE.md，2026-11-20）——
      'g.bak.other': '这份存档是另一门课的，不能用在这里',
      'g.fail.lang': '🎤 这门语言的口语要用手机自带的识别，现在用不了：先跳过，句子放进每日复习',
      'g.home.qv.course': '📗 课程单元',
      'g.unit.head.c': '📗 课程单元', 'g.unit.all.c': '这门课的单元都开放：每个单元有单词、句子和对话，按单元的话题和语法编写。',
      'g.gate.chat.lang': '和岛民聊天（这门语言的 AI 聊天还在做，今天先跳过）', 'g.rp.ex.lang': '这门语言的 AI 聊天还在做',
      'g.set.ruby': '读音', 'g.set.ruby.on': '显示', 'g.set.ruby.off': '不显示', 'g.set.ruby.d': '题目、选项、对话上面标出读音（凭记忆说的提示不标）。',
      'g.shell.foot.c': '回声岛 · {lang}听说闯关 · 进度只保存在这台设备上',
      // 下面这些「.c」是原来写着「英语」的句子在别的课里的写法（i18n.js 的 variant）
      'g.rc.1.d.c': '跟读单词，再看图说出{lang}。', 'g.type.sp.c': '🖼️ 看图说{lang}', 'g.tag.sp.c': '看图说{lang}',
      'g.cue.pic.t.c': '看图，凭记忆用{lang}说出来', 'g.q.ls.t.c': '听一听，选出你听到的{lang}', 'g.q.fix.t.c': '这句话可以说得更好：直接说出正确的{lang}',
      'g.q.mem.t.c': '看意思，凭记忆用{lang}说出来', 'g.q.sp.t.c': '看图，用{lang}说出来', 'g.q.bt.mem.c': '听懂它的话，<b>凭记忆用{lang}回答</b>攻击它！',
      'g.play.mic.sr.c': '点麦克风，然后大声说{lang}', 'g.play.self.pic.c': '先看图<b>大声说出{lang}</b>，说完再看答案', 'g.th.en.c': '<span>Aa</span>原文',
      'g.home.scene.new.c': '先看看这个话题的{lang}对话怎么说 · 第一次看完 +10 金币', 'g.th.tip.watch.c': '先完整看一遍。关掉原文字幕，就能练纯听力。点下面的对话记录可以单独再听一句。',
      'g.mic.h.c': '要用麦克风才能开口说{lang}', 'g.mic.p.c': '<p>回声岛要<b>听你说的{lang}</b>，才能给你打分。声音只用来打分，不会存下来。</p>', 'g.mic.allok.c': '全都没问题，可以开口说{lang}了！',
      'g.set.mix.c': '冒险里的{lang}题',
      'g.mic.chk.p.c': '<p>回声岛要听你说{lang}。点话筒，大声说：<b class="chk-say">{word}</b></p>', 'g.mic.listen.c': '正在听……大声说 {word}',
      // 夸奖里的英语词（Perfect / Good / Great!）：别的课换成中文
      'g.fb.perfect.c': '完美！每个词都说对了', 'g.fb.good.c': '不错！说得很好', 'g.th.perfect.c': '<b>{n} 分</b> 完美！', 'g.th.good.c': '<b>{n} 分</b> 不错！',
      'g.praise.c': ['太棒了！', '真棒！', '很好！', '答对了！', '好极了！', '做得好！', '厉害！'],
      'g.mic.chk.hint.c': '点话筒，说 {word}', 'g.mic.quiet.c': '没听到声音：靠近一点、大声说 {word}，再点一次话筒',
      'g.mic.covered.c': '没听到声音：麦克风是不是被挡住了？靠近一点、大声说 {word}，再点一次话筒', 'g.set.mic.btn.c': '检查一下（说一句 {word}）',
      'g.intro.c.p1': '<p><b>🐲 怪兽冒险</b>：选一只怪兽当伙伴，用{lang}念咒语攻击，听懂对手的{lang}来防御。收服新怪兽、升级进化，打败 13 个区域的岛主拿徽章。</p>',
      'g.intro.c.p2': '<p><b>📚 闯关练习</b>：📗 课程单元和 13 座话题小岛。每通关一关送回声球，用来收服怪兽。</p>',
      'g.intro.c.p3': '<p><b>🗣️ 和岛民聊天</b>：这门语言的 AI 聊天还在做，做好了会在这里打开。剧情里的对话先用界面的语言显示。</p>',
      // 和岛民聊天（tools/course/TALK.md §4，2026-11-21）：服务器会用这门语言聊的时候，学习锁、每日任务、周报、日报里说到「英语」的这几句
      'g.intro.c.p3.on': '<p><b>🗣️ 和岛民聊天</b>：按住话筒，用{lang}和岛上的人真的聊天；聊完 AI 写评语，告诉你怎样说更好。</p>',
      'g.qp.tk1.c': '用{lang}和岛民聊天，完成 1 个目标',
      'g.res.gate.talk.c': '✅ 复习完成 · 再和岛民用{lang}聊一聊（已开口说 {n}/{need} 句）就能去冒险',
      'g.set.gate.d.c': '开着时，每天先做完每日复习、用{lang}和岛民聊一聊（用语音说满 6 句，或者完成一个小目标），才能去怪兽冒险。关掉要家长密码，关过的天周报上会标出来；关着时冒险也不限时。',
      'g.set.ai.off.d.c': '请家长在这里粘贴 AI 密钥（阿里云百炼的 API Key），只存在这台手机里。设好以后口语题会自动打分。',
      'g.gate.chat.said.c': '和岛民聊天：今天开口说了 {n} 句{lang}',
      'g.gate.chat.used.c': '用{lang}和岛民聊天：已开口说 <em class="gate-n">{a}/{b}</em> 句（{x}）',
      'g.gate.chat.go.c': '用{lang}和岛民聊天：已开口说 <em class="gate-n">{a}/{b}</em> 句，或者完成一个小目标',
      'g.gate.blk.used.c': '临时冒险时间用完了：连上网，用{lang}和岛民聊一聊就能接着玩',
      'g.gate.blk.chat.c': '先用{lang}和岛民聊一聊：开口说满 {need} 句（现在 {n} 句），或者完成一个小目标',
      'g.adv.stop.pass.p.c': '今天没网（或者聊天连不上），先让你冒险了 {n} 分钟。连上网，用{lang}和岛民聊一聊，就能接着冒险。',
      'g.push.l.chat.c': '🗣️ 和岛民聊天 {a} 段，用语音说了 {b} 句{lang}', 'g.rp.hb.look.c': ' · 看意思 {a} 次 · 帮帮我 {b} 次',
      // 一句有多长：日语、中文数的是字（西语和英语一样数词）
      'g.rp.ab.a.ch': '<p class="rp-ab">💪 <b>能力</b>（和上周比）：每句 {n} 个字', 'g.rp.hb.max.ch': '（最长一句 {n} 个字）', 'g.push.l.max.ch': '（最长一句 {n} 个字）',
      // 第二轮（TALK.md）：别的课里今日目击的线索是这门语言的
      'g.ach.sight1.d.c': '读懂{lang}线索，收服 1 只「今日目击」的怪兽',

      // —— 字表结束 ——
    },
    en: {
      // —— 公用 ——
      'g.ok': 'Got it', 'g.close': 'Close', 'g.cancel': 'Cancel',
      'g.book.hj7a': '7A', 'g.book.hj7b': '7B', 'g.book.hj8a': '8A', 'g.book.hj8b': '8B', 'g.book.hj9a': '9A', 'g.book.hj9b': '9B',

      // —— 第一段（G1）——
      'g.rc.0.n': 'Hear Words', 'g.rc.0.d': 'Listen to the words. Choose the meaning and the spelling.',
      'g.rc.1.n': 'Say Words', 'g.rc.1.d': 'Repeat the words, then look at the pictures and say the English.',
      'g.rc.2.n': 'Hear Sentences', 'g.rc.2.d': 'Listen to whole sentences. Understand them and put the words in order.',
      'g.rc.3.n': 'Say Sentences', 'g.rc.3.d': 'Repeat sentence by sentence until you can say them smoothly.',
      'g.rc.4.n': 'Dialogue', 'g.rc.4.d': 'Listen to the other person. Choose a good answer and say it.',
      'g.rc.5.n': 'Challenge', 'g.rc.5.d': 'All question types mixed together, with review of the earlier islands.',
      'g.rc.6.d': 'Talk face to face with the Isle Master! Understand what they say, then say the right answer aloud to attack.',
      'g.type.lw': '🎧 Hear a word, pick its meaning', 'g.type.ls': '🎧 Hear a word, pick its spelling', 'g.type.lm': '🎧 Hear a sentence, pick its meaning', 'g.type.lr': '💬 Hear a question, pick the answer', 'g.type.lo': '🧩 Hear a sentence, put it in order',
      'g.type.sr_w': '🎤 Repeat the word', 'g.type.sr_s': '🎤 Repeat the sentence', 'g.type.sr_d': '🎤 Say the answer', 'g.type.sp': '🖼️ Say it from the picture', 'g.type.bt': '⚔️ Dialogue attack',
      'g.tag.lw': 'Word meaning', 'g.tag.ls': 'Word spelling', 'g.tag.lm': 'Sentence meaning', 'g.tag.lr': 'Question and answer', 'g.tag.lo': 'Sentence order',
      'g.tag.sr_w': 'Repeat words', 'g.tag.sr_s': 'Repeat sentences', 'g.tag.sr_d': 'Say the answer', 'g.tag.sp': 'Say from picture', 'g.tag.bt': 'Dialogue attack',
      'g.praise': ['Great!', 'Nice!', 'Excellent!', 'Well done!', 'Super!', 'Correct!', 'Awesome!'],
      'g.title.1': 'Trainee Sailor', 'g.title.3': 'Little Sailor', 'g.title.5': 'Listening Detective', 'g.title.7': 'Speaking Star', 'g.title.10': 'Pronunciation Pro',
      'g.title.13': 'Conversation Pro', 'g.title.16': 'Island Explorer', 'g.title.20': 'English Captain', 'g.title.25': 'Echo Master', 'g.title.30': 'Legendary Captain',
      'g.pet.chick': 'Chick', 'g.pet.cat': 'Kitten', 'g.pet.dog': 'Puppy', 'g.pet.rabbit': 'Rabbit', 'g.pet.frog': 'Frog', 'g.pet.fox': 'Fox',
      'g.pet.panda': 'Panda', 'g.pet.penguin': 'Penguin', 'g.pet.owl': 'Owl', 'g.pet.dolphin': 'Dolphin', 'g.pet.unicorn': 'Unicorn', 'g.pet.dragon': 'Little Dragon',
      'g.pet.dino': 'Little Dinosaur', 'g.pet.butterfly': 'Butterfly', 'g.pet.octopus': 'Little Octopus',
      'g.qp.lv2': 'Clear 2 levels', 'g.qp.lv4': 'Clear 4 levels', 'g.qp.sp10': 'Say 10 things correctly aloud', 'g.qp.sp25': 'Say 25 things correctly aloud',
      'g.qp.cb8': 'Reach a combo of 8 in one level', 'g.qp.st3': 'Get 3 stars on a level once', 'g.qp.pf5': 'Get 5 Perfect pronunciations', 'g.qp.ls20': 'Get 20 listening questions right',
      'g.qp.rv5': 'Get 5 Daily review questions right', 'g.qp.rp1': 'Finish 1 role-play', 'g.qp.bt3': 'Win 3 monster battles', 'g.qp.ct1': 'Catch 1 wild monster',
      'g.qp.tk1': 'Chat with an islander in English and finish 1 goal',
      'g.ach.first.n': 'Set Sail', 'g.ach.first.d': 'Clear your first level',
      'g.ach.lv10.n': 'Riding the Waves', 'g.ach.lv10.d': 'Clear 10 levels',
      'g.ach.lv50.n': 'Ocean Voyage', 'g.ach.lv50.d': 'Clear 50 levels',
      'g.ach.boss1.n': 'First Win', 'g.ach.boss1.d': 'Beat your first Boss',
      'g.ach.boss5.n': 'Boss Hunter', 'g.ach.boss5.d': 'Beat 5 Bosses',
      'g.ach.allboss.n': 'King of the Islands', 'g.ach.allboss.d': 'Beat all 13 Bosses',
      'g.ach.c10.n': 'Ten Hits', 'g.ach.c10.d': 'Get a combo of 10 in one level',
      'g.ach.flaw.n': 'No Mistakes', 'g.ach.flaw.d': 'Get every question right in one level',
      'g.ach.sp50.n': 'Brave Voice', 'g.ach.sp50.d': 'Say 50 things correctly aloud',
      'g.ach.sp300.n': 'Speaking Pro', 'g.ach.sp300.d': 'Say 300 things correctly aloud',
      'g.ach.pf30.n': 'Clear Pronunciation', 'g.ach.pf30.d': 'Get 30 Perfect pronunciations',
      'g.ach.st3.n': 'Three Days Running', 'g.ach.st3.d': 'Play 3 days in a row',
      'g.ach.st7.n': 'A Week Strong', 'g.ach.st7.d': 'Play 7 days in a row',
      'g.ach.st30.n': 'A Month Strong', 'g.ach.st30.d': 'Play 30 days in a row',
      'g.ach.three10.n': 'Star Collector', 'g.ach.three10.d': 'Get 3 stars 10 times',
      'g.ach.world.n': 'Perfect Island', 'g.ach.world.d': 'Get 3 stars on all 7 levels of one island',
      'g.ach.rv20.n': 'Learn by Reviewing', 'g.ach.rv20.d': 'Get 20 Daily review questions right',
      'g.ach.pets3.n': 'Pet Family', 'g.ach.pets3.d': 'Have 3 pets',
      'g.ach.rich.n': 'Coin Collector', 'g.ach.rich.d': 'Have 500 coins at the same time',
      'g.ach.actor.n': 'Little Actor', 'g.ach.actor.d': 'Finish 5 role-plays',
      'g.ach.catch1.n': 'First Partner', 'g.ach.catch1.d': 'Catch your first wild monster',
      'g.ach.dex8.n': 'Monster Collector', 'g.ach.dex8.d': 'Add 8 monsters to your Monsters list',
      'g.ach.dexall.n': 'Monster Master', 'g.ach.dexall.d': 'Add all {n} monsters of the first region to your Monsters list',
      'g.ach.evo1.n': 'Grow Up!', 'g.ach.evo1.d': 'Make a monster grow up for the first time',
      'g.ach.badge5.n': 'Badge Collector', 'g.ach.badge5.d': 'Win 5 Isle Master badges',
      'g.ach.badgeall.n': 'Champion Trainer', 'g.ach.badgeall.d': 'Win all 13 Isle Master badges',
      'g.ach.sight1.n': 'Sharp Eyes', 'g.ach.sight1.d': 'Read the English clues and catch 1 monster from Today\'s Sighting',
      'g.ach.sight7.n': 'Clue Detective', 'g.ach.sight7.d': 'Catch 7 monsters from Today\'s Sighting',
      'g.save.dev': 'Backup from {d} on this device', 'g.save.phone': 'Backup from {d} in the phone\'s Download/EchoIsland folder', 'g.save.before': 'earlier',
      'g.save.badlog': 'The save could not be read ({n} characters)', 'g.save.wlog': 'The save could not be written: {msg}', 'g.save.fulllog': 'The save could not be stored (storage full?)',
      'g.save.full': 'The save could not be stored (the phone\'s space for the game is full). Today\'s progress may be lost. A parent should first tap "Export save" in Settings → 💾 Save backup.',
      'g.save.full.h': 'The save could not be stored',
      'g.store.cutlog': 'Save storage is almost full. The two oldest backups were deleted', 'g.store.pctlog': 'Save storage is almost full: {pct}% used ({n} characters)',
      'g.store.h': 'Save storage is almost full',
      'g.store.p1': '<p>The phone\'s space for the game\'s save is <b>{pct}%</b> full. Saving still works for now, but when it is full, new progress cannot be saved.</p>',
      'g.store.p2': '<p class="tip">Parents: first go to "Settings → 🔒 Parent Settings → 💾 Save backup" and tap "Export save". Send the file to yourself or save it somewhere safe. Then tell the person who set up the game about this message.</p>',
      'g.store.bar': '💾 Save storage is almost full ({pct}% used). Please tell a parent',
      'g.streak.keep': '🧊 Streak freeze used! Your {n}-day streak is saved!', 'g.streak.lost': '💧 Your {n}-day streak has ended. Start again today!',
      'g.tts.silent': 'You need to be online to hear this sentence', 'g.tts.tap': 'Tap 🔊 to hear the pronunciation',
      'g.sr.aimark': 'AI-generated', 'g.sr.cloud': 'Cannot reach AI scoring. Using the browser\'s speech recognition / self-check for now',
      'g.fail.key.auth': 'The AI key is wrong', 'g.fail.key.quota': 'The AI credit has run out', 'g.fail.key.busy': 'The AI is a bit busy', 'g.fail.key.code': 'The family code is wrong',
      'g.fail.short.auth': 'not accepted', 'g.fail.short.quota': 'no credit left', 'g.fail.short.busy': 'busy', 'g.fail.short.code': 'wrong family code',
      'g.fail.key.other': 'AI scoring is not working', 'g.fail.key.line': '{why}, so I cannot score you. Please tell a parent',
      'g.fail.mic': '🎤 Allow Echo Island to use the microphone first, so you can speak', 'g.fail.nokey': '🔑 There is no AI key yet, so I cannot score you automatically. A parent can paste one in Settings',
      'g.fail.net': '📶 No internet, so I cannot score you. Connect and say it again', 'g.fail.busy': '⏳ The AI is a bit busy. Say it again in a moment',
      'g.fail.unheard': 'I didn\'t catch that. Move closer, speak louder and try again', 'g.fail.stop': '⏹ Stopped. Tap the mic when you are ready',
      'g.bar.nokey': '🔑 No AI key yet: speaking cannot be scored automatically. A parent can paste one in Settings', 'g.bar.net': '📶 No connection: scoring and Chat need the internet',
      'g.bar.quota': '💳 The AI credit has run out. Please tell a parent', 'g.bar.busy': '⏳ The AI is too busy. Try again in a moment', 'g.bar.code': '🔑 The family code is wrong. Please tell a parent',
      'g.bar.auth': '🔑 The AI key is wrong: scoring and Chat do not work. Please tell a parent',
      'g.bar.how': 'What to do?', 'g.bar.see': 'Details',
      'g.bar.upd.n': '🆕 A new version is available ({name}). Please ask a parent to update', 'g.bar.upd': '🆕 A new version is available. Please ask a parent to update',
      'g.bar.parent': '🔒 Parent Settings',
      'g.bar.i.nokey': 'This phone has no AI key yet. A parent should open "Settings → 🔒 Parent Settings → AI chat and speech scoring" and paste an Alibaba Cloud Bailian API key (it is only stored on this phone).',
      'g.bar.i.net': 'Speaking scores and Chat with islanders both need the internet. Check that Wi-Fi or mobile data is on, then try again.',
      'g.bar.i.quota': 'Parents: the Alibaba Cloud Bailian credit has run out (or the account is overdue). Check the cost and quota in the Bailian console, then top up or use a new key.',
      'g.bar.i.busy': 'The AI got too many requests at once. Try again in a few minutes.',
      'g.bar.i.code': 'Parents: the family code for the relay service is wrong. Please enter it again in Settings.',
      'g.bar.i.auth': 'Parents: the AI key is wrong (it may have been cancelled). Please paste a new key in "Settings → 🔒 Parent Settings → AI chat and speech scoring".',
      'g.bar.i.tip': '<p class="tip">When the AI is down: you can use "Skip for now" on speaking questions. Those sentences go into Daily review, and you say them later when you are online. In battle, this turn becomes listen-and-choose (no power hit).</p>',
      'g.mic.h': 'The microphone is needed to speak English',
      'g.mic.p': '<p>Echo Island needs to <b>hear your English</b> to score it and to let you chat with islanders. Your voice is only used for scoring and is not saved.</p>',
      'g.mic.blocked': '<p class="tip">The phone is blocking the microphone for Echo Island and will not ask again. Tap "Open settings", then "Permissions" → "Microphone" → "Allow", and come back to the game.</p>',
      'g.mic.denied': '<p class="tip">You did not allow it. Tap the mic again. The phone will ask you, and this time tap "Allow".</p>',
      'g.mic.later': 'Later', 'g.mic.fix': '⚙️ Open settings', 'g.mic.fix2': '⚙️ Open it in Settings', 'g.mic.retry': 'OK, try again',
      'g.mic.granted': '🎤 The microphone works now! Tap the mic again and speak',
      'g.mic.mic.ok': '🎤 Microphone ✅', 'g.mic.mic.bad': '🎤 Microphone ❌ Not allowed', 'g.mic.mic.quiet': '🎤 Microphone ⚠️ No sound heard: is a finger covering it?', 'g.mic.mic.idle': '🎤 Microphone',
      'g.mic.net.ok': '📶 Network ✅', 'g.mic.net.bad': '📶 Network ❌ Cannot connect', 'g.mic.net.idle': '📶 Network',
      'g.mic.key.ok': '🔑 AI key ✅', 'g.mic.key.bad': '🔑 AI key ❌', 'g.mic.key.idle': '🔑 AI key', 'g.mic.svc.ok': '🤖 AI service ✅', 'g.mic.svc.bad': '🤖 AI service ❌', 'g.mic.svc.idle': '🤖 AI service',
      'g.mic.nokey': 'Not set up yet: a parent can paste it in "Settings → 🔒 Parent Settings"',
      'g.mic.chk.h': 'Quick check before you speak',
      'g.mic.chk.p': '<p>Echo Island needs to hear you speak English. Tap the mic and say aloud: <b class="chk-say">Hello!</b></p>',
      'g.mic.chk.hint': 'Tap the mic and say Hello', 'g.mic.chk.go': 'All done, let\'s go!',
      'g.mic.listen': 'Listening… say Hello loudly!', 'g.mic.nobrowser': 'The browser did not allow the microphone',
      'g.mic.ok': 'The microphone works!', 'g.mic.ok.key': 'The microphone works! The AI key is still missing: a parent can paste it in Settings so speaking can be scored automatically.',
      'g.mic.quiet': 'No sound heard. Move closer, say Hello loudly and tap the mic again',
      'g.mic.allok': 'All good! You can speak English now!',
      'g.mic.covered': 'No sound heard. Is the microphone covered? Move closer, say Hello loudly and tap the mic again',


      // —— 第二段（G2）——
      'g.rev.card.again': { one: '<b>Review done for today</b><small>You can practise {n} more question (only if you want)</small>', other: '<b>Review done for today</b><small>You can practise {n} more questions (only if you want)</small>' },
      'g.rev.card.done': '<b>Daily review is done</b><small>Questions you got wrong and new textbook words come back after 1, 2, 4, 7… days</small>',
      'g.rev.card.wrong': { one: '{n} wrong question', other: '{n} wrong questions' }, 'g.rev.card.old': '{n} learnt before', 'g.rev.card.chat': { one: '{n} line from Chat', other: '{n} lines from Chat' },
      'g.rev.card.n': { one: 'Daily review: {n} question', other: 'Daily review: {n} questions' }, 'g.rev.card.per': ', {n} per round',
      'g.fade.1': '🔤 Say it from the first letters', 'g.fade.2': '🧠 Say it from memory', 'g.fade.3': '✏️ Say it the better way',
      'g.cue.lw.ty': '🎧 Hear a word, pick it (with pictures)', 'g.cue.lw.tag': 'Hear a word, pick it (pictures)', 'g.cue.lm.ty': '🎧 Hear a sentence, pick it', 'g.cue.lm.tag': 'Hear a sentence, pick it',
      'g.cue.lw.t': 'Listen and choose the word you hear', 'g.cue.lm.t': 'Listen and choose the sentence you hear', 'g.cue.pic.t': 'Look at the picture and say it in English from memory',
      'g.cue.hear.w': 'Listen once, then use the first letters to say this word', 'g.cue.hear.s': 'Listen once, then use the first letters to say the whole sentence',
      'g.q.lw.t': 'Listen and choose the right meaning', 'g.q.ls.t': 'Listen and choose the English you hear', 'g.q.lm.t': 'Listen and choose what the sentence means',
      'g.q.lr.t': 'What should you say back?', 'g.q.see.long': 'Show the words (try with just your ears first)', 'g.q.see': 'Show the words',
      'g.q.lo.t': 'Listen, then tap the words in order', 'g.q.check': 'Check', 'g.q.rep.t': 'Listen, then say it aloud after the voice',
      'g.q.fix.t': 'This can be said better: say the right English', 'g.q.mem.t': 'Look at the meaning and say it in English from memory',
      'g.q.cue.w': 'Use the first letters to say this word', 'g.q.cue.s': 'Use the first letters to say the whole sentence', 'g.q.said': 'You said: <s>{s}</s>',
      'g.q.dlg.t': 'Listen, then say your answer aloud', 'g.q.dlg.mem': 'Listen, then say your answer aloud from memory', 'g.q.you': 'Your turn:',
      'g.q.sp.t': 'Look at the picture and say it in English',
      'g.q.bt.mem': 'Understand what it says and <b>answer in English from memory</b> to attack!', 'g.q.bt.sr': 'Choose the right answer and <b>say it aloud</b> to attack! (Tap an answer to hear it first)',
      'g.q.bt.self': 'Tap the right answer, then say it aloud to attack!', 'g.q.bt.show': '👀 See some answers (no power hit for this one)',
      'g.task.done': '✅ Task done: {t}. Go back to the map for your reward', 'g.toast.ach': '🏆 New achievement "{name}" +20 coins',
      'g.home.streak.on': { one: 'Streak done today: {n} day in a row', other: 'Streak done today: {n} days in a row' }, 'g.home.streak.off': 'No streak yet today. Clear any level to get it',
      'g.home.claim': 'Get +{n}', 'g.home.claimed': '✓ Collected',
      'g.home.chest.open': 'Today\'s chest is open', 'g.home.chest.ready': 'The daily chest is ready!', 'g.home.chest': 'Daily chest',
      'g.home.chest.tmr': 'New tasks tomorrow. Come back!', 'g.home.chest.how': 'Get all 3 task rewards to open it. It may hold a growth song or a monster egg',
      'g.home.tasks': 'Today\'s tasks', 'g.home.reset': { one: 'New in {n} hour', other: 'New in {n} hours' },
      'g.home.isle.no': 'Island {n}', 'g.home.isle.lock': '🔒 Beat the Boss of the last island to unlock', 'g.home.locked': ' (locked)', 'g.home.start': 'Start',
      'g.home.scene': 'Theatre · {t}', 'g.home.scene.seen': '✓ Watched · Come back to repeat the lines or act a role', 'g.home.scene.new': 'See how people talk about this topic in English · +10 coins the first time',
      'g.home.tab.mon': '🐲 Monster Adventure', 'g.home.tab.quiz': '📚 Practice', 'g.home.tab.talk': '🗣️ Chat with islanders',
      'g.home.qv.book': '📗 Textbook units', 'g.home.qv.isle': '🏝️ Topic islands',
      'g.unit.now': ' · 📍 Learning now', 'g.unit.gram': '📐 Grammar: {t}', 'g.unit.talk': '🗣️ Chat with {name} about this unit', 'g.unit.setnow': 'Learn this unit now',
      'g.unit.head': '📗 Textbook units · for Hujiao-edition vocabulary', 'g.unit.open': 'Textbook units for this school year ({list})', 'g.unit.sep': ', ', 'g.unit.all': 'Six books, from Year 7 to Year 9',
      'g.unit.what': ': the words and phrases to learn in each unit, plus our own sentences and dialogues written for its topic and grammar (not the textbook texts).',
      'g.unit.cur': 'Learning now: <b>{u}</b>', 'g.unit.guess': ' (guessed from the date)', 'g.unit.change': 'Change',
      'g.unit.no': 'Unit {n}', 'g.ev.bookat.c': '📍 Now studying {b} Unit {n}. Its questions will also show up in Monster Adventure.', 'g.ev.gram.h.c': 'Unit {n} grammar: {t}', 'g.ev.gram.h0.c': 'Unit {n} grammar',
      'g.unit.old': 'The new {b} textbook is not out yet (expected in spring 2027). For now these are the units of the old textbook. They will change when the new book comes out.',
      'g.det.count': { one: ' {n} question, 3 hearts.', other: ' {n} questions, 3 hearts.' }, 'g.det.best': 'Best: ', 'g.det.scene': '🎬 Watch the Theatre first',
      // Word list, word cards, my word book, sounds and letters (tools/course/WORDS.md)
      'g.wd.btn': '📖 Word list', 'g.wd.h': 'Word list', 'g.wd.gram': 'Grammar in this unit: {t}', 'g.wd.cards': '▶ Go through them with word cards', 'g.wd.roma': 'Romaji',
      'g.wd.roma.on': 'Show', 'g.wd.roma.off': 'Hide', 'g.wd.words': 'Words ({n})', 'g.wd.sents': 'Useful sentences ({n})', 'g.wd.say': 'Listen', 'g.wd.none': 'No words in this lesson',
      'g.wd.legend': '🆕 not practised · 🔁 in review · ✅ learned · tap 🔊 to listen', 'g.wd.st.new': 'Not practised yet', 'g.wd.st.rev': 'In review', 'g.wd.st.ok': 'Learned', 'g.wd.back': '← Back',
      'g.wc.n': 'Card {i} of {n}', 'g.wc.skip': 'Skip, start the level', 'g.wc.go': 'I know them. Start!', 'g.wc.done': '✓ Done', 'g.wc.prev': 'Previous card', 'g.wc.next': 'Next card',
      'g.wc.say': 'Listen again', 'g.wc.gram': 'Grammar point', 'g.wc.swipe': '← → to turn, or swipe',
      'g.wb.btn': { one: '📒 My word book ({n} word learned)', other: '📒 My word book ({n} words learned)' }, 'g.wb.h': '📒 My word book', 'g.wb.all': 'Words', 'g.wb.rev': 'In review', 'g.wb.ok': 'Learned',
      'g.wb.f.all': 'All', 'g.wb.f.rev': '🔁 In review', 'g.wb.f.ok': '✅ Learned', 'g.wb.q': '🔍 Find a word or meaning', 'g.wb.tap': 'Tap a word to see an example',
      'g.wb.empty': 'No words yet. Clear a practice level and the words you learn will show up here.', 'g.wb.none': 'No words like that', 'g.wb.more': 'Show {n} more', 'g.wb.noex': 'No sentence in this lesson uses this word',
      'g.pr.btn': '🔤 Sounds and letters', 'g.pr.h': '🔤 Sounds and letters', 'g.pr.card': 'Learn the sounds and letters first (about 10 minutes)', 'g.pr.card.go': 'Start', 'g.pr.card.no': 'No thanks',
      'g.pr.tap': 'Tap a box to hear it. Boxes with a dot have example words.', 'g.pr.ex': 'Example words', 'g.pr.next': 'Next →', 'g.pr.done': '✓ Finished',
      // Part two: how to learn from zero (WORDS.md 7–11)
      'g.wd.slow': 'Say it slowly',
      'g.ls.btn': '📘 What you learn here', 'g.ls.h': 'What you learn here', 'g.ls.can': 'After this lesson you can', 'g.ls.pats': 'Sentence patterns', 'g.ls.tips': 'Watch out',
      'g.ls.next': 'Next: meet the words →', 'g.ls.go': 'Start the level →',
      'g.hp.h': '🆘 Phrases for help', 'g.hp.tab': '🆘 Phrases for help', 'g.hp.tip': 'Say these when you don\'t understand or don\'t know what to say. Tap 🔊 to listen first, then say it yourself.',
      'g.rt.h': '🧭 Beginner\'s path', 'g.rt.n': '{a} / {b}', 'g.rt.primer': 'Sounds and letters first', 'g.rt.lesson': '{t}: what you learn here', 'g.rt.cards': 'Meet the words with word cards',
      'g.rt.l14': 'Levels 1–4: listen and speak', 'g.rt.scene': 'Watch the Theatre', 'g.rt.l57': 'Levels 5–7: dialogues and the BOSS', 'g.rt.adv': 'Go on an adventure and use what you learned', 'g.rt.chat': 'Chat with an islander once',
      'g.rt.next': 'Next lesson: Island {n}, {t}',
      'g.rt.done': '{n} done', 'g.rt.more': '{n} more after these',
      // Step by step: mini word lessons (tools/course/STARTER.md)
      'g.mn.row': '🌱 Step by step', 'g.mn.row.done': 'Done', 'g.mn.node': 'Mini lesson {k}', 'g.mn.chip': '🌱 {k} / {n}',
      'g.mn.new': 'New word', 'g.mn.got': 'Got it. Next →', 'g.mn.mw.ty': 'Pick the word', 'g.mn.mw.t': 'Which word is it?',
      'g.mn.fb.wrong': 'That\'s OK. Look again. You\'ll get this one again soon', 'g.mn.say.soft': 'That\'s OK. Listen a few more times and keep going',
      'g.mn.res.t': { one: 'You learned {n} new word!', other: 'You learned {n} new words!' }, 'g.mn.res.sub': '{name} · Mini lesson {k} of {n}', 'g.mn.res.rev': 'These words will come back in tomorrow\'s Daily review.',
      'g.mn.res.next': 'Next mini lesson →', 'g.mn.res.go': 'Mini lessons done. Start the levels →', 'g.mn.res.again': 'Do it again',
      'g.mn.ask.h': 'Learn step by step first', 'g.mn.ask.p': 'This lesson has {w} new words. Take {n} mini lessons first: 3 or 4 words each, about 3 minutes. Each word is taught, then practised, and a wrong answer never costs a heart. The levels will be easy after that.',
      'g.mn.ask.go': 'Start mini lesson {k}', 'g.mn.ask.skip': 'I know these. Go to the levels', 'g.mn.ls.next': 'Start mini lesson 1 →',
      'g.rt.mini': 'Mini lessons: 3 or 4 new words each',
      'g.set.starter': 'Step by step', 'g.set.starter.d': 'For complete beginners: before the levels of each lesson you take a few mini lessons. Each one teaches only 3 or 4 new words, practises them right away, and a wrong answer never costs a heart.',
      'g.set.slow': 'Reading speed', 'g.set.slow.off': 'Normal', 'g.set.slow.on': '🐢 Slow', 'g.set.slow.d': 'Slow: recordings play a little slower (same pitch). The 🐢 next to each 🔊 slows down just that one time.',
      'g.set.route': 'Beginner\'s path', 'g.set.route.d': 'Step-by-step steps at the top of the home page (hidden after you clear Island 3).',
      'g.det.later': 'Not now', 'g.det.go': 'Start',
      'g.play.norev': 'Nothing to review today. Great!', 'g.play.boss': '{name} blocks the way! Understand what it says, then <b>say</b> the right answer aloud to attack.', 'g.play.fight': '⚔️ Fight!',
      'g.play.combo': '🔥 {n} combo', 'g.play.xpx': ' · XP ×{m}',
      'g.play.play': 'Play', 'g.play.slowplay': 'Play slowly', 'g.play.slow': 'Slow', 'g.play.hear': 'Hear it', 'g.play.hearq': 'Hear them', 'g.play.model': 'Hear an example', 'g.play.again': 'Hear it again',
      'g.play.mic': 'Start speaking', 'g.play.mic.sr': 'Tap the mic, then speak English aloud', 'g.play.mic.rec': 'Tap the mic to record, and tap again when you finish',
      'g.play.skip': 'Can\'t speak right now? Skip this one', 'g.play.hint': '💡 Hint', 'g.play.hint2': '💡 More help',
      'g.play.listening': 'Listening… It stops when you finish', 'g.play.nomic': 'The microphone does not work, so now you read aloud and judge yourself',
      'g.play.nosr': 'This browser cannot use speech recognition, so now you record and judge yourself', 'g.play.bt.tap': 'Tap the right answer, then say it aloud',
      'g.play.rec.done': 'Recorded! Compare below', 'g.play.rec.on': 'Recording… Tap to stop when you finish', 'g.play.rerec': 'Tap the mic to record again',
      'g.play.self.pic': 'Look at the picture and <b>say the English aloud</b> first, then see the answer', 'g.play.self.mem': '<b>Say it aloud from memory</b> first, then see the answer', 'g.play.self.done': 'I said it. Show the answer',
      'g.play.self.bt': 'Now say it aloud to {name}: <b>{s}</b>', 'g.play.self.cmp': 'Listen to your recording. Does it sound like the original?', 'g.play.self.read': 'Read it aloud twice, then give yourself an honest score',
      'g.play.self.mine': '▶ My recording', 'g.play.self.orig': '🔊 Original',
      'g.play.rate.0': '😅 Need practice', 'g.play.rate.1': '🙂 OK', 'g.play.rate.2': '😎 Very close',
      'g.play.rate.again': 'Listen to the original again and say it with the voice', 'g.play.rate.rerec': ', then record again',
      'g.fb.xp': ' +{n} XP', 'g.fb.peek': ' (you saw the words: half)', 'g.fb.aid': ' (with help: half)',
      'g.fb.wrong': 'Oops, not right', 'g.fb.ans': 'Right answer: ', 'g.fb.order': 'Wrong order', 'g.fb.sent': 'Right sentence: ', 'g.fb.reply': 'Right answer: ',
      'g.fb.heard': 'I heard: "{s}"', 'g.fb.pts': 'pts',
      'g.fb.retry.mem': 'Try again! If you can\'t remember, tap "💡 Hint"', 'g.fb.retry.red': 'The red words were not right. Tap 🔊 to listen, then try again', 'g.fb.try': ' (try {n}/3)',
      'g.fb.bt.unheard': 'I could not hear you. You can tap the right answer and read it aloud (no power hit for this one)',
      'g.fb.pass.aid.rev': 'Passed! You had help, so it comes back tomorrow', 'g.fb.pass.aid': 'Passed! You had help, so half XP', 'g.fb.perfect': 'Perfect! Every word was right',
      'g.fb.good': 'Good! Well said', 'g.fb.pass': 'Passed! A bit more practice will help',
      'g.fb.fail': 'That\'s OK. This one is saved for later', 'g.fb.saved': 'Added to your Review list (no heart lost): ',
      'g.fb.skip.ai': 'Skipped for now', 'g.fb.skip': 'Skipped', 'g.fb.skip.owe': 'Added to review. Say it when you are online again: ',
      'g.fb.dodge': '{name} dodged! That answer was not right', 'g.fb.bt.see': 'No match. Look at these answers and say the right one aloud (no power hit for this one)',
      'g.fb.bt.tap': 'Not heard well? You can tap the right answer and read it aloud', 'g.fb.bt.again': 'That did not match any answer. Say it again (try {n}/3)',
      'g.fb.crit': 'Power hit!', 'g.fb.hit': 'Hit!',
      'g.res.fail': '<h2>The boat is out of power!</h2><p>All 3 hearts are gone. The questions you got wrong are in your Review list.</p>', 'g.res.revive': 'Spend 30 coins to keep going in this level',
      'g.res.once': ' (only once per level)', 'g.res.poor': ' (not enough coins)', 'g.res.map': 'Back to the map', 'g.res.retry': 'Try again',
      'g.res.next': 'Next level →', 'g.res.goisle': 'Go to {name} →', 'g.res.nextunit': 'Next unit: {name} →', 'g.res.adv': '🗺️ Go on an adventure', 'g.res.talk': '🗣️ Chat with islanders',
      'g.res.rev': 'Review done!', 'g.res.beat': 'You beat {name}!', 'g.res.perfect': 'Perfect clear!', 'g.res.clear': 'Level cleared!',
      'g.res.more': { one: '{n} more question to review today', other: '{n} more questions to review today' }, 'g.res.alldone': 'Today\'s review is all done ✅',
      'g.res.lucky': '🍀 Lucky hit! Double coins', 'g.res.three': 'First 3 stars bonus: +15 coins', 'g.res.balls': '🔮 Echo Ball +{n} (catch monsters in Monster Adventure)', 'g.res.newisle': '🏝️ New island unlocked: {name}',
      'g.res.gate.open': '🔓 Adventure unlocked! You can go on a Monster Adventure today', 'g.res.gate.talk': '✅ Review done · Now chat with islanders in English ({n}/{need} lines spoken) to go on an adventure',
      'g.res.gate.more': 'Do one more round (get at least half right) to finish',
      'g.res.xp': 'XP', 'g.res.coins': 'Coins', 'g.res.combo': 'Best combo', 'g.res.recall': { one: '🔥 You said {n} answer right without looking. Great memory!', other: '🔥 You said {n} answers right without looking. Great memory!' },
      'g.res.score': 'Right: {c} / {t}', 'g.res.nolose': 'lose no hearts and ', 'g.res.3star': 'get 90% or more right for 3 stars',
      'g.res.aided': { one: '💡 {n} of them used a hint (half XP)', other: '💡 {n} of them used hints (half XP)' },
      'g.res.aided.rev': { one: '💡 {n} of them used a hint (half XP, back tomorrow)', other: '💡 {n} of them used hints (half XP, back tomorrow)' }, 'g.res.again': 'Play again',
      'g.res.streak': { one: '🔥 Streak kept today! {n} day in a row', other: '🔥 Streak kept today! {n} days in a row' },
      'g.res.lvup': '<h2>Level up! Lv {lv}</h2><p>New title: <b>{title}</b>. You get 20 coins. Go and see the Pet Shop!</p>', 'g.res.yay': 'Great!',
      'g.res.rest': '<h2>Eye break</h2><p>You have practised for 30 minutes. Well done! Look at something far away out of the window for 20 seconds, drink some water, and rest your eyes and voice.</p>',
      'g.res.resting': 'Resting {n}', 'g.res.rested': 'Rested. Let\'s go on',


      // —— 第三段（G3）——
      'g.ver.name': 'Echo Island {name} ({code})', 'g.ver.app': 'Echo Island for Android', 'g.ver.web.name': 'Echo Island web version',
      'g.ver.new.h': 'A new version is ready',
      'g.ver.new.p': '<p>You have <b>{me} ({mc})</b>. The new version is <b>{ne} ({nc})</b>.</p>',
      'g.ver.new.notes': '<p class="tip">What is new: {notes}</p>',
      'g.ver.new.how': 'Please ask a parent to install the new version over this one on this phone (your save is kept, and you can also use "Export save" in Settings first). ',
      'g.ver.new.url': 'Download address:<br><b class="ver-url">{url}</b>', 'g.ver.share': '📤 Send the address to a parent',
      'g.ver.sheet.h': '🆕 Address for new-version check', 'g.ver.sheet.p': 'When the app opens, it looks at this address to see if there is a new version (a version.json file). ',
      'g.ver.sheet.def': 'Leave it empty to use the default address:', 'g.ver.sheet.none': 'Leave it empty and it will not check.', 'g.ver.back': 'Back', 'g.ver.save': 'Save',
      'g.bak.title': 'Echo Island save (includes AI-written chat text)', 'g.bak.toast.file': '📤 Choose an app to send it to a parent or save it', 'g.bak.toast.text': '📤 Choose an app to send it to a parent to keep',
      'g.bak.toast.dl': '💾 Save downloaded: {name}', 'g.bak.toast.fail': 'Export failed',
      'g.bak.row.dev': '📱 This device · {d}', 'g.bak.row.reset': '↩️ Progress before clearing', 'g.bak.row.restore': '↩️ Progress before the last restore', 'g.bak.row.dl': '📁 Downloads/EchoIsland · {d}',
      'g.bak.sheet.h': '🗂️ Restore from backup', 'g.bak.sheet.p': 'Pick a backup to replace your current progress. Your current progress is saved first (so you can switch back if it was a mistake).',
      'g.bak.none': 'No backup yet. The game backs up the first time you open it each day.',
      'g.bak.file.native': '📂 Pick from a file (after changing phone or reinstalling; save a save-file you got in a chat app to the phone first)', 'g.bak.file.web': '📂 Pick a save file (.json)',
      'g.bak.bad': 'This file is not an Echo Island save, or it is broken', 'g.bak.label': 'Backup',
      'g.bak.use.h': 'Use this backup?', 'g.bak.use.p': 'Your current progress ({cur}) will be replaced, but it is saved first.', 'g.bak.use.no': 'No', 'g.bak.use.go': 'Restore',
      'g.bak.full': 'Cannot save (is this device full?)', 'g.bak.picked': 'the file you picked', 'g.bak.readfail': 'Cannot read this file ({e})',
      'g.err.native': 'Native: ', 'g.err.recent': ' · last {n} (up to 50 are kept)', 'g.err.none': 'No errors recorded 👍',
      'g.err.share': '📤 Send to a helper', 'g.err.clear': '🧹 Clear',
      'g.intro.h': 'Welcome to Echo Island!',
      'g.intro.p1': '<p><b>🐲 Monster Adventure</b>: pick a monster as your partner. Say spells in English to attack, and understand your rival\'s English to defend. Catch new monsters, grow them up, and beat the Isle Masters of 13 areas to win badges.</p>',
      'g.intro.p2': '<p><b>📚 Practice</b>: 📗 Textbook units (for Hujiao-edition vocabulary, following your school units) and 13 topic islands. Each level you clear gives you Echo Balls to catch monsters.</p>',
      'g.intro.p3': '<p><b>🗣️ Chat with islanders</b>: hold the mic and really chat with the people on the islands in English. After the chat, the AI writes comments, and sentences you got wrong show up in 📕 Daily review the next day.</p>',
      'g.intro.p4': '<p>🎁 3 tasks a day. Finish them to open the chest · 🔥 Play one battle a day to keep your streak</p>',
      'g.intro.voice': '🔊 Try the sound', 'g.intro.go': 'Let\'s go!',
      'g.set.nokey.h': '🔑 Ask a parent to paste the AI key here', 'g.set.nokey.d': 'There is no AI key yet, so speaking questions cannot be scored automatically (you can skip them and say them later, once there is a key and internet). You also cannot chat with islanders.',
      'g.set.h': 'Settings', 'g.set.mine': '🙂 My settings',
      'g.set.mic': '🩺 Microphone and internet', 'g.set.mic.btn': 'Check now (say "Hello")',
      'g.set.rate': 'Read-aloud speed', 'g.set.try': '🔊 Listen',
      'g.set.tts': 'Voice source', 'g.set.tts.auto': 'Natural voice', 'g.set.tts.device': 'Device voice', 'g.set.tts.online': 'Recordings only',
      'g.set.tts.d': '"Natural voice": fixed sentences use ready-made natural recordings. Sentences with a name in them are made online by Alibaba Cloud, or use the device voice when offline. "Recordings only" never uses the device voice. "Device voice" uses the voice built into your browser for everything.',
      'g.set.voice': 'Read-aloud voice',
      'g.set.sc.app': 'Speaking score', 'g.set.sc.app.d': '🎤 You always speak aloud. AI listens and scores you (Alibaba Cloud speech recognition). If you are not accurate, you get a short tip. Needs internet.',
      'g.set.sc.mode': 'How speaking is scored', 'g.set.mode.auto': 'AI score (recommended)', 'g.set.mode.self': 'Record and judge yourself',
      'g.set.sc.mode.d': 'AI score: if the chat service is reachable, Alibaba Cloud speech recognition scores you. If not, the speech recognition built into the browser is used.',
      'g.set.gfx': 'Adventure graphics', 'g.set.gfx.auto': 'Auto', 'g.set.gfx.high': 'High quality', 'g.set.gfx.mid': 'Standard', 'g.set.gfx.low': 'Battery saver', 'g.set.gfx.2d': 'Smooth mode (2D)',
      'g.set.gfx.auto.d': 'Auto: good phones start with high quality and others with standard. If it runs slowly, it goes down one level by itself', 'g.set.gfx.now': ' (now: "{m}")', 'g.set.stop': '.',
      'g.set.gfx.hot': 'If your phone gets hot or slow, choose Battery saver or Smooth mode (2D).',
      'g.set.look': 'Look', 'g.set.look.std': 'Classic', 'g.set.look.new': 'New (preview)',
      'g.set.look.d': 'The new look is a preview: it changes outdoor towns and roads only; houses and caves stay the same. If it is slow, switch back to Classic.',
      'g.set.ctl': 'Adventure controls', 'g.set.ctl.joy': '🕹️ Joystick', 'g.set.ctl.pad': '✚ D-pad',
      'g.set.ctl.pad.d': 'D-pad: walk with the cross at the bottom left. A / B are at the bottom right.', 'g.set.ctl.joy.d': 'Joystick: hold anywhere on the left of the screen with your left thumb and push to walk. A / B are at the bottom right.',
      'g.set.or': 'Screen direction', 'g.set.or.portrait': '📱 Portrait', 'g.set.or.landscape': '🎮 Landscape', 'g.set.or.auto': '🔄 Follow the phone',
      'g.set.or.d': 'Landscape makes adventures and battles feel like a handheld game. Questions and chat work either way.',
      'g.set.sfx': 'Sound effects', 'g.set.on': 'On', 'g.set.off': 'Off',
      'g.set.mu': 'Music', 'g.set.mu.off': 'Off', 'g.set.mu.low': 'Low', 'g.set.mu.mid': 'Medium', 'g.set.mu.high': 'High',
      'g.set.lic': 'Open-source licences and thanks',
      'g.set.gate': 'Study gate', 'g.set.gate.on': '🔒 On (recommended)',
      'g.set.gate.d': 'When it is on, each day you first finish the Daily review and chat with an islander in English (say 6 sentences by voice, or finish one small goal). Then you can go on a Monster Adventure. Turning it off needs the parent PIN, and the days it was off show in the Weekly report. While it is off, adventure time has no limit either.',
      'g.set.lim': '⏱️ Adventure time', 'g.set.edit': 'Change',
      'g.set.lim.d': 'Only time on the world map and in battles counts. When time is up, the game does not cut you off. It waits until the battle or talk ends, then goes to the home page. Do one more round of review, finish one more chat goal, or clear one more new level (or win more stars), and each one adds 10 minutes.',
      'g.set.mix': 'English questions in the adventure', 'g.set.mix.a': 'More textbook', 'g.set.mix.b': 'A little textbook', 'g.set.mix.c': 'Island topics only',
      'g.set.mix.d': 'When you battle monsters or answer islanders, some questions come from the textbook unit you are on now ({unit}). Change it on the Practice page, in "📗 Textbook units".',
      'g.set.ai': '🗣️ AI chat and speech scoring', 'g.set.ai.on': '✅ Connected to Alibaba Cloud', 'g.set.ai.off': '⚠️ No AI key yet', 'g.set.ai.change': 'Change key', 'g.set.ai.paste': 'Paste key',
      'g.set.ai.on.d': 'Uses an Alibaba Cloud Bailian API key. It is kept only on this phone, and you do not need to enter it again after an update.',
      'g.set.ai.off.d': 'Ask a parent to paste the AI key here (an Alibaba Cloud Bailian API key). It is kept only on this phone. After that you can chat with islanders in English, and speaking questions are scored automatically.',
      'g.set.unl': 'Practice: open all levels', 'g.set.unl.0': 'Unlock in order', 'g.set.unl.1': 'Open all',
      'g.set.unl.d': 'Only works for "📚 Practice" (turn it on to go straight to a textbook unit). Badges, guards and Echo Skills in the adventure are not affected.',
      'g.set.push': '📲 Send a daily report to WeChat', 'g.set.push.on': '✅ Sent every day after 8 pm ({k})', 'g.set.push.wecom': 'WeCom group bot', 'g.set.push.off': 'Off (nothing is sent by default)', 'g.set.push.btn': 'Set up',
      'g.set.saf': '👪 Chat safety', 'g.set.saf.look': 'Chats to check', 'g.set.saf.n': 'Chats to check ({n})', 'g.set.saf.info': 'ℹ️ Notes for parents',
      'g.set.saf.d': 'If the child talks about feeling sad, being bullied or being in danger, that chat is marked. Enter the parent PIN to read all of it.',
      'g.set.pin': '🔑 Parent PIN', 'g.set.pin.has': 'Already set', 'g.set.pin.none': 'Not set yet', 'g.set.pin.change': 'Change PIN', 'g.set.pin.set': 'Set PIN',
      'g.set.pin.d1': 'The 4-digit PIN a parent set during first set-up (the phone stores only a salted hash). Five wrong tries lock it for 10 minutes. If you forget it: first "💾 Export save" (no PIN needed) → clear this app\'s data in the phone settings → go through the parent set-up again and set a new PIN → "Restore from backup", and your progress comes back (there is also an automatic daily backup in the phone\'s Downloads/EchoIsland folder).',
      'g.set.pin.nat.has': 'A 4-digit PIN set when the app was built. Five wrong tries lock it for 10 minutes. To change it: edit PARENT_PIN in echo.properties, then build and install again (your save is kept).',
      'g.set.pin.nat.none': '⚠️ This app has no parent PIN, so the settings above cannot be changed. Please write PARENT_PIN (4 digits) in echo.properties, then build and install again.',
      'g.set.pin.web.none': 'Not set yet (a parent sets it the first time it is needed)', 'g.set.pin.lock': 'Five wrong tries lock it for 10 minutes.',
      'g.set.fam': '👪 Family set-up', 'g.set.fam.noname': '(no name yet)', 'g.set.sep': ', ',
      'g.set.fam.d': 'The child\'s English nickname and look, the 3 partners in the Professor\'s bag (they apply when a new adventure starts), and the family members. Kept only on this phone.',
      'g.set.dev': '🩺 Device check', 'g.set.dev.ok': '✅ Passed', 'g.set.dev.warn': '⚠️ Can play', 'g.set.dev.bad': '❌ Not suitable', 'g.set.dev.none': 'Not done', 'g.set.dev.again': 'Check again',
      'g.set.priv': '📄 Privacy and consent', 'g.set.priv.doc': 'Children\'s privacy notice', 'g.set.priv.consent': 'Guardian consent form',
      'g.set.priv.ok': 'A guardian agreed on {d} (version {v}). To withdraw consent: delete the key in "AI chat and speech scoring" above (then the app no longer connects to the AI), or uninstall the app.',
      'g.bak.h': '💾 Save backup', 'g.bak.export': '📤 Export save', 'g.bak.restore': '🗂️ Restore from backup',
      'g.bak.d1': 'The game backs up the first time you open it each day. This device keeps 3 copies', 'g.bak.last': ' (the latest is from {d})', 'g.bak.before': 'earlier',
      'g.bak.dl': ', and the phone\'s Downloads/EchoIsland folder keeps 7 (they stay even if you uninstall the app)',
      'g.bak.d2': '. "Export save" lets you send the file somewhere safe, such as a chat app. After changing phone or reinstalling, use "Restore from backup". ', 'g.bak.used': 'Save space used: {n}%.',
      'g.ver.h': '🆕 Check for a new version', 'g.ver.edit': 'Change address', 'g.ver.defaultUrl': 'default address',
      'g.ver.on': 'When the app opens, it checks if there is a new version ({url}). If there is, the home page asks a parent to update.',
      'g.ver.noaddr': 'No address is set, so it does not check for a new version. (The person who installed the app for you will send you new versions.)', 'g.ver.web': 'The web version is always up to date, so there is nothing to check.',
      'g.err.h': '🔧 Error log', 'g.err.week': 'Last 7 days: {n}', 'g.err.look': 'View',
      'g.err.d': 'When the game has an error, the last 50 are saved automatically. They stay only on this device. If something goes wrong on your phone, you can send them to the person who installed the game.',
      'g.set.reset': 'Clear progress', 'g.set.reset.btn': 'Clear all progress', 'g.set.reset.d': 'Stars, coins, monsters and review records will all be cleared, and this cannot be undone. You need the parent PIN, and you must also type the word "clear".',
      'g.set.parent': '🔒 Parent Settings',
      'g.chest.pet': '<h2>You got a chest-only pet: {name}!</h2><p>Only the chest gives this one. The shop does not sell it.</p>',
      'g.chest.freeze': '<h2>You got a streak saver card!</h2><p>If you forget a day, it keeps your days in a row for you.</p>',
      'g.chest.coins': { one: '<h2>You got {n} coin!</h2><p>Come back tomorrow. The tasks will be new.</p>', other: '<h2>You got {n} coins!</h2><p>Come back tomorrow. The tasks will be new.</p>' },
      'g.chest.take': 'Take it',
      'g.shop.following': 'With you', 'g.shop.take': 'Tap to take along', 'g.shop.chestonly': 'Chest only', 'g.shop.fromchest': 'From the daily chest',
      'g.shop.head': { one: '<h2>Pet Shop</h2><p>You have <b>{n}</b> coin. Pets come with you on the map.</p>', other: '<h2>Pet Shop</h2><p>You have <b>{n}</b> coins. Pets come with you on the map.</p>' },
      'g.shop.fz': 'Streak saver cards (you have {n}, max 2)', 'g.shop.fzd': 'Used automatically if you miss a day. It keeps your days in a row.', 'g.shop.fzbtn': '100 coins',
      'g.shop.chestpet': 'This pet only comes from the daily chest', 'g.shop.short': { one: '{n} more coin needed. Go and play levels to earn coins.', other: '{n} more coins needed. Go and play levels to earn coins.' }, 'g.shop.bought': 'You got {name}!',
      'g.achv.h': 'Achievements {n} / {t}', 'g.achv.sum': 'Lv {lv} {title} · Stars: {stars} · Spoken correctly: {spoken} · Levels cleared: {levels}',
      'g.set.env.app': '✅ Read-aloud: natural voice (stored on the phone, no internet needed)', 'g.set.env.sr.ok': '✅ Automatic speaking score: each sentence goes to Alibaba Cloud to be recognised (needs internet)',
      'g.set.env.sr.nokey': '⚠️ Automatic speaking score: no AI key yet', 'g.set.env.see': ' (see above)', 'g.set.env.paste': '. Ask a parent to paste it in Settings → 🔒 Parent Settings',
      'g.set.env.dev': '✅ Read-aloud: device voice {name}', 'g.set.env.nodev': '⚠️ Read-aloud: this browser has no English voice. In Settings, switch to "Natural voice"',
      'g.set.env.nat': '✅ Read-aloud: natural voice (sentences without a recording are made online by Alibaba Cloud)', 'g.set.env.nat.dev': '✅ Read-aloud: natural voice (sentences without a recording are made online by Alibaba Cloud, and the device voice is used offline)',
      'g.set.env.wx': '<br>📱 You opened this in WeChat: tap "···" at the top right, then "Open in browser". Recording and speech recognition work better there.',
      'g.set.env.sr.web': '✅ Speech recognition works. Your speaking is scored automatically', 'g.set.env.sr.none': '⚠️ Speech recognition is not available. Speaking questions use "record and judge yourself"',
      'g.set.env.tip': 'For speech recognition, <b>Edge</b> or <b>Safari</b> work best. In some places Chrome cannot use speech recognition, because it needs Google servers.',
      'g.th.tip.watch': 'Watch it once all the way through. Turn off the English text to practise listening only. Tap a line in the record below to hear it again.',
      'g.th.tip.shadow': 'It stops after each line. Say the line after it. When you get it right, it goes on.',
      'g.th.tip.role': 'Pick a character. When it is your turn, say the line aloud. The computer plays the other character.',
      'g.th.lvup': '🎖️ Level up! Lv {lv} {title} +20 coins',
      'g.th.pause': '⏸ Pause', 'g.th.resume': '▶ Resume', 'g.th.again': '🔁 Play again', 'g.th.start': '▶ Play',
      'g.th.m.watch': '👀 Watch', 'g.th.m.shadow': '🔁 Repeat', 'g.th.m.role': '🎭 Role-play',
      'g.th.exit': 'Exit', 'g.th.ep': 'Episode {n}', 'g.th.you': ' · You', 'g.th.me': 'I play',
      'g.th.slow': '<span>🐢</span>Slow', 'g.th.en': '<span>En</span>English', 'g.th.zh': '<span>zh</span>Chinese',
      'g.th.end': '🎉 All done!', 'g.th.idle': 'Tap "Play" to see what they say', 'g.th.ear': '🎧 Just listen…',
      'g.th.logh': 'Lines so far (tap one to hear it again)',
      'g.th.turn.role': 'Your turn. Say it aloud:', 'g.th.turn.shadow': 'Say it after me:',
      'g.th.taps': 'Tap the mic, then say it aloud', 'g.th.hear': '🔊 Hear it', 'g.th.skip': 'Skip this line',
      'g.th.orskip': ', or tap "Skip this line"', 'g.th.canskip': ' (you can tap "Skip this line" for now)',
      'g.th.perfect': '<b>{n} points</b> Perfect!', 'g.th.good': '<b>{n} points</b> Good!',
      'g.th.msg.watch': 'First time finished +10 coins', 'g.th.msg.shadow': 'Repeat done +20 XP', 'g.th.msg.role': 'Role-play done +30 XP +10 coins',
      'g.th.next.shadow': '🔁 Now repeat it', 'g.th.next.role': '🎭 Try role-play', 'g.th.swap': 'Play {name}',
      'g.th.fin.role': 'Great acting!', 'g.th.fin.shadow': 'Repeat done!', 'g.th.fin.watch': 'All watched!', 'g.th.fin.more': 'Watch a few more times and the lines will come easily', 'g.th.map': 'Back to map',


      // —— 第四段（G4）——
      'g.ev.bookat': '📍 Now studying {b} Unit {n}. Its questions will also show up in Monster Adventure.',
      'g.ev.locked.h': 'Textbook {b} is not open yet',
      'g.ev.locked.p': 'This device only has the textbook units for this school year. Next year\'s units are a separate content pack. Please ask a parent to contact the person who set this up for you.',
      'g.ev.pick.h': '📗 Which textbook unit are you on?',
      'g.ev.pick.p': 'Once you choose, the Practice page marks this unit, and Monster Adventure will ask more questions with its words and sentences.',
      'g.ev.pick.old': ' (old edition)',
      'g.ev.gram.h': 'Unit {n} grammar: {t}',
      'g.ev.gram.h0': 'Unit {n} grammar',
      'g.ev.why.mix': 'Change the English questions in Adventure',
      'g.ev.why.gate': 'Turn off the study gate',
      'g.ev.why.clock': 'The phone date was changed: start again from today',
      'g.ev.clock.ok': '📅 Done. Starting again from today',
      'g.ev.why.pin': 'Change the parent PIN',
      'g.ev.pin.ok': '🔑 Parent PIN changed',
      'g.ev.why.lim': 'Change adventure time',
      'g.ev.why.push': 'Change the daily report to a parent',
      'g.ev.why.ver': 'Change the address for checking updates',
      'g.ev.why.bak': 'Restore from backup',
      'g.ev.why.unlock': 'Open all Practice levels',
      'g.ev.why.reset': 'Erase all progress',
      'g.ev.why.zh': 'Change the story Chinese setting',
      'g.ev.micfix': 'In "Permissions → Microphone" choose "Allow", then come back to the game',
      'g.ev.upd.t': 'New version of Echo Island',
      'g.ev.upd.b': 'New version of Echo Island {v}: {u}',
      'g.ev.ver.https': 'The address must start with https://',
      'g.ev.ver.new': 'Done. From now on it will check the new address',
      'g.ev.ver.def': 'Using the default address again',
      'g.ev.bak.bad': 'This backup cannot be read',
      'g.ev.bak.pick': 'Cannot open the file picker',
      'g.ev.bak.big': 'This file is too big to be a save',
      'g.ev.bak.read': 'Cannot read this file',
      'g.ev.err.title': 'Echo Island error log',
      'g.ev.err.copied': 'Copied. You can paste it and send it',
      'g.ev.err.nocopy': 'Cannot copy',
      'g.ev.playfail': 'Could not play the recording',
      'g.ev.quit.h': 'Leave this level?',
      'g.ev.quit.p': 'If you leave now, your progress in this level will not be saved.',
      'g.ev.quit.yes': 'Leave',
      'g.ev.quit.no': 'Keep going',
      'g.ev.revive': '❤️ You are back in the game!',
      'g.ev.sep': ', ',
      'g.ev.rv.h': 'Daily review',
      'g.ev.rv.miss': { one: ' · missed {n} time', other: ' · missed {n} times' },
      'g.ev.rv.today': { one: 'You have <b>{n}</b> question to review today: {list}.', other: 'You have <b>{n}</b> questions to review today: {list}.' },
      'g.ev.rv.wrong': '{n} missed',
      'g.ev.rv.old': '{n} from before',
      'g.ev.rv.chat': { one: '{n} better way to say it from Chat', other: '{n} better ways to say it from Chat' },
      'g.ev.rv.done': 'Today\'s review is done!',
      'g.ev.rv.rule': ' Questions you get wrong come back the same day. Each time you get one right, it comes back after 1, 2, 4, 7, 15 and 30 days. Get them all right and it counts as mastered. Right answers to questions due today in Adventure count as review too.',
      'g.ev.rv.tip': '⏳ Coming back later: {a} · 🏅 Mastered: {b}',
      'g.ev.rv.sum': '📖 Review list (tap a line to hear it)',
      'g.ev.rv.later': 'Later',
      'g.ev.rv.go': { one: 'Review {n} question', other: 'Review {n} questions' },
      'g.ev.claim': '+{c} coins +20 XP',
      'g.ev.nosr': 'This browser does not support speech recognition. You will keep checking yourself.',
      'g.ev.reset.h': 'Clear all progress',
      'g.ev.reset.p': 'Stars, coins, monsters, badges and review records will all be cleared. A copy is saved first, so if you clear by mistake you can get it back with "Restore from backup" (needs the parent PIN).',
      'g.ev.reset.ask': 'To really clear everything, type the word "clear" below:',
      'g.ev.reset.aria': 'Type the word clear',
      'g.ev.reset.no': 'Do not clear',
      'g.ev.reset.go': 'Clear',
      'g.ev.reset.word': 'clear',
      'g.ev.reset.need': 'Type the word "clear" to clear everything',
      'g.ev.reset.done': 'Progress cleared',
      'g.gate.rev.done': 'Daily review · one round done today',
      'g.gate.rev.none': 'Daily review (nothing to review today)',
      'g.gate.rev.todo': { one: 'Do one round of Daily review ({n} question)', other: 'Do one round of Daily review ({n} questions)' },
      'g.gate.chat.goal': 'Chat with islanders: finished a chat goal',
      'g.gate.chat.said': { one: 'Chat with islanders: spoke {n} line of English today', other: 'Chat with islanders: spoke {n} lines of English today' },
      'g.gate.chat.noai': 'Chat with islanders (AI chat is not set up yet, skipped today)',
      'g.gate.chat.daily': 'Chat with islanders (today\'s chat time is used up, skipped)',
      'g.gate.chat.pass': { one: 'Chat with islanders: {r}, so you can adventure for {n} minute first', other: 'Chat with islanders: {r}, so you can adventure for {n} minutes first' },
      'g.gate.chat.key': 'Chat with islanders: {r}, so chat is not possible now. Please tell a parent (a parent can turn off the study gate for now in 🔒 Parent Settings)',
      'g.gate.chat.used': 'Chat with islanders in English: spoke <em class="gate-n">{a}/{b}</em> lines ({x})',
      'g.gate.chat.go': 'Chat with islanders in English: spoke <em class="gate-n">{a}/{b}</em> lines, or finish a chat goal',
      'g.gate.why.offline': 'there is no internet now',
      'g.gate.why.daily': 'today\'s chat time is used up',
      'g.gate.why.fail': 'chat cannot connect today',
      'g.gate.key.quota': 'the AI credit has run out',
      'g.gate.key.auth': 'the AI key is wrong',
      'g.gate.again.tmr': 'come back tomorrow to chat',
      'g.gate.again.net': 'get online and finish speaking to carry on',
      'g.gate.t.back': '📅 The phone date looks like it was changed',
      'g.gate.t.pass': { one: '📵 Go and adventure first today ({n} minute for now)', other: '📵 Go and adventure first today ({n} minutes for now)' },
      'g.gate.t.open': '🎉 Today\'s study is done. Off you go!',
      'g.gate.t.todo': '📚 2 small tasks before adventure ({n}/2 done)',
      'g.gate.back.tip': 'Set the phone back to "Set date and time automatically", then come back.',
      'g.gate.back.btn': '👪 Parent: start again from today',
      'g.gate.btn.rev': 'Go review',
      'g.gate.btn.chat': 'Go chat',
      'g.gate.report': '📊 See this week\'s report',
      'g.gate.blk.back': 'The phone date looks like it was changed. Set it back to automatic and come back',
      'g.gate.blk.rev': 'Finish today\'s Daily review first, then go adventuring',
      'g.gate.blk.key': '{r}, so chat is not possible now. Please tell a parent',
      'g.gate.blk.used.daily': 'Your temporary adventure time is up and today\'s chat time is used up too. See you tomorrow!',
      'g.gate.blk.used': 'Your temporary adventure time is up. Get online and chat with islanders in English to keep playing',
      'g.gate.blk.chat': 'First chat with islanders in English: speak {need} lines (now {n}), or finish a chat goal',
      'g.adv.nolimit': 'No limit',
      'g.adv.lim': 'School days {wd} min · Weekends {we} min',
      'g.adv.lim.night': ' · No adventures {a}–{b}',
      'g.adv.line.night': '🌙 No adventures from {a} until {b} in the morning',
      'g.adv.line.over': '⏰ Today\'s adventure time is used up',
      'g.adv.line.more': ' (study a bit more to earn time)',
      'g.adv.line.left': { one: '🕹️ You can adventure for <b>{n}</b> more minute today', other: '🕹️ You can adventure for <b>{n}</b> more minutes today' },
      'g.adv.line.bonus': { one: ' (includes {n} bonus minute)', other: ' (includes {n} bonus minutes)' },
      'g.adv.pass.toast': { one: '📵 {r}: you can adventure for {n} minute first', other: '📵 {r}: you can adventure for {n} minutes first' },
      'g.adv.pass.offline': 'No internet today',
      'g.adv.pass.daily': 'Today\'s chat time is used up',
      'g.adv.pass.fail': 'Chat cannot connect today',
      'g.adv.stop.night.h': 'Time to sleep!',
      'g.adv.stop.night.p': 'No adventures from {a} until {b} in the morning. The monsters are asleep. Come back tomorrow!',
      'g.adv.stop.time.h': 'Today\'s adventure time is up!',
      'g.adv.stop.time.in': { one: 'You adventured for {n} minute today. The monsters need a rest too. Come back tomorrow!', other: 'You adventured for {n} minutes today. The monsters need a rest too. Come back tomorrow!' },
      'g.adv.stop.time.out': { one: 'You adventured for {n} minute today. The monsters need a rest too. Your progress is saved. Come back tomorrow!', other: 'You adventured for {n} minutes today. The monsters need a rest too. Your progress is saved. Come back tomorrow!' },
      'g.adv.stop.pass.h': 'Your temporary adventure time is up',
      'g.adv.stop.pass.p': { one: 'There was no internet today (or chat could not connect), so you had {n} minute of adventure first. Get online and chat with islanders in English to carry on.', other: 'There was no internet today (or chat could not connect), so you had {n} minutes of adventure first. Get online and chat with islanders in English to carry on.' },
      'g.adv.stop.def': 'Have a little rest',
      'g.adv.stop.more': 'Want to play a bit longer? Do one more round of review, finish one more chat goal, or clear one more new level (or earn more stars). Each is worth 10 minutes (you can still earn {n} minutes today).',
      'g.adv.ok': 'OK',
      'g.adv.warn5': '⏰ 5 minutes of adventure left today. Finish this one, then it is time to rest',
      'g.adv.min': '{n} min',
      'g.adv.sheet.h': '⏱️ Adventure time',
      'g.adv.sheet.p': 'Only time on the map and in battles counts (Practice, review and chat do not). When time is up, you are not cut off: it waits until the battle or chat ends, then takes you home.',
      'g.adv.sheet.on': 'Adventure limit',
      'g.adv.sheet.lim': 'Limited (recommended)',
      'g.adv.sheet.wd': 'Each school day (Mon–Fri)',
      'g.adv.sheet.we': 'Each weekend day',
      'g.adv.sheet.from': 'No adventures after (evening)',
      'g.adv.sheet.any': 'Off',
      'g.adv.sheet.to': 'Adventures can start from (morning)',
      'g.adv.sheet.max': 'Extra study earns time, at most per day',
      'g.adv.sheet.plus': '+{n} min',
      'g.adv.sheet.none': 'No bonus',
      'g.adv.sheet.small': 'One more round of review, one more chat goal, or one more new level cleared (or more stars): +10 minutes each.',
      'g.adv.sheet.done': 'Done',
      'g.pin.none.h': 'No parent PIN yet',
      'g.pin.none.p': 'This app was built without a parent PIN, so "{w}" cannot be changed now.',
      'g.pin.this': 'this setting',
      'g.pin.none.tip': 'A parent needs to write PARENT_PIN (4 digits) in android/echo.properties on the computer, then build and install again (your save is kept).',
      'g.pin.first': 'First time: a parent sets a 4-digit PIN. Keep it secret from the child',
      'g.pin.locked': { one: 'Too many wrong tries. Try again in {n} minute', other: 'Too many wrong tries. Try again in {n} minutes' },
      'g.pin.t.set1': 'Set a 4-digit parent PIN',
      'g.pin.t.set2': 'Enter it again to confirm',
      'g.pin.t.check': 'Parent: enter the 4-digit PIN',
      'g.pin.clr': 'Clear',
      'g.pin.del': 'Delete one digit',
      'g.pin.h': 'Parent PIN',
      'g.pin.typed': { one: '{n} digit entered', other: '{n} digits entered' },
      'g.pin.weak': 'That PIN is too easy to guess. Choose another one',
      'g.pin.diff': 'The two did not match. Set it again',
      'g.pin.nosave': 'The PIN was not changed: enter the old PIN first and finish within 2 minutes. Tap "Change PIN" again',
      'g.pin.saved': '🔑 Parent PIN set. Keep it secret from the child',
      'g.pin.wrong': { one: 'Wrong PIN. {n} try left', other: 'Wrong PIN. {n} tries left' },
      'g.pin.again': 'PIN correct. Tap the button again',
      'g.rp.dlg': 'Q: {q} A: {a}',
      'g.rp.mon': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      'g.rp.md': '{dd} {mon}',
      'g.rp.wd': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      'g.rp.today': 'Today',
      'g.rp.dow': '{d}',
      'g.rp.heavy.tip': 'Adventure time is over 3 times study time',
      'g.rp.miss': { one: ' · missed {n} time', other: ' · missed {n} times' },
      'g.rp.ex.noai': 'AI chat not set up',
      'g.rp.ex.daily': 'chat time used up',
      'g.rp.f.off': { one: '🔓 Study gate turned off on {n} day', other: '🔓 Study gate turned off on {n} days' },
      'g.rp.f.back': '⏰ The phone date was changed',
      'g.rp.f.reset': '⏰ A parent reset the date',
      'g.rp.f.pass': { one: '📵 Offline pass on {n} day', other: '📵 Offline pass on {n} days' },
      'g.rp.f.ex': { one: '🟡 Chat skipped on {n} day ({why})', other: '🟡 Chat skipped on {n} days ({why})' },
      'g.rp.f.night': { one: '🌙 Late-night adventure on {n} day', other: '🌙 Late-night adventure on {n} days' },
      'g.rp.f.heavy': { one: 'Adventure over 3 times study on {n} day', other: 'Adventure over 3 times study on {n} days' },
      'g.rp.f.pin': { one: '🔑 Parent PIN wrong {n} time', other: '🔑 Parent PIN wrong {n} times' },
      'g.rp.f.pinlock': { one: ' (locked {n} time)', other: ' (locked {n} times)' },
      'g.rp.f.cleared': '🧹 Progress was erased',
      'g.rp.f.restored': '🗂️ Save was restored from a backup',
      'g.rp.f.noai': '⚠️ AI chat is not set up',
      'g.rp.f.key': { one: '💳 AI credit or key problem on {n} day', other: '💳 AI credit or key problem on {n} days' },
      'g.rp.f.net': { one: '📶 AI had no internet on {n} day', other: '📶 AI had no internet on {n} days' },
      'g.rp.f.skip': { one: '⏭️ AI was down: {n} question skipped (all in review)', other: '⏭️ AI was down: {n} questions skipped (all in review)' },
      'g.rp.f.mic': { one: '🎤 Microphone refused {n} time', other: '🎤 Microphone refused {n} times' },
      'g.rp.ab.a': '<p class="rp-ab">💪 <b>Skills</b> (compared with last week): words per line {n}',
      'g.rp.ab.b': ' · right first time {n}',
      'g.rp.ab.c': ' · still remembered after a week {n}',
      'g.rp.hb.a': { one: '<p class="rp-line">🔥 Said from memory: <b>{n}</b> line', other: '<p class="rp-line">🔥 Said from memory: <b>{n}</b> lines' },
      'g.rp.hb.w': { one: ' (plus {n} word)', other: ' (plus {n} words)' },
      'g.rp.hb.say': { one: ' · 💡 With hints: {h} · 🗣️ Spoken in chat: {n} line', other: ' · 💡 With hints: {h} · 🗣️ Spoken in chat: {n} lines' },
      'g.rp.hb.max': ' (longest: {n} words)',
      'g.rp.hb.zh': ' · Said in Chinese: {n}',
      'g.rp.hb.look': ' · Chinese looked up: {a} · "Help me" used: {b}',
      'g.rp.hist': '<h3>Recent weeks</h3><p class="rp-line">📈 Study days {a} &nbsp; 🔥 Said from memory {b}</p>',
      'g.rp.cost.lt': 'under 0.01',
      'g.rp.title.n': '{name}\'s weekly report',
      'g.rp.title.me': 'My weekly report',
      'g.rp.sub': '{a} – {b} · Study days <b>{n}/7</b>',
      'g.rp.since': ' (tracking since {d})',
      'g.rp.concern': { one: '👪 {n} chat needs a parent to look at it (Settings → 🔒 Parent Settings → Chat safety, needs the parent PIN)', other: '👪 {n} chats need a parent to look at them (Settings → 🔒 Parent Settings → Chat safety, needs the parent PIN)' },
      'g.rp.legend': 'Minutes per day: <i class="l"></i>Study {a} <i class="p"></i>Adventure {b} <i class="o"></i>In menus &nbsp; ✅ Done 🟡 Chat skipped 📵 Offline pass 🔓 Gate off ⏰ Date changed 🌙 Late',
      'g.rp.t.levels': 'Levels done',
      'g.rp.t.spoken': 'Said correctly',
      'g.rp.t.review': 'Review answers right',
      'g.rp.t.chat': 'Chats · {m} min',
      'g.rp.t.fresh': 'New words and sentences',
      'g.rp.t.mastered': 'Mastered so far',
      'g.rp.cu': '<p class="rp-line">📗 Studying <b>{u}</b> · ★ {s}/21 · wrong this week: {n} (all in review)</p>',
      'g.rp.top': 'Most missed so far',
      'g.rp.tips': 'Better ways to say it (from chats)',
      'g.rp.cost': '💰 AI cost this week: about ¥{c}',
      'g.rp.cost.web': ' (on the web version, chat costs are counted on the relay server)',
      'g.rp.end': '📸 Take a screenshot and send it to a parent!',
      'g.rp.dg.ai': { one: 'AI errors: {n}', other: 'AI errors: {n}' },
      'g.rp.dg.aiwhy': ' (no internet {a} · key/credit {b})',
      'g.rp.dg.chat': { one: ' · chat could not connect on {n} day', other: ' · chat could not connect on {n} days' },
      'g.rp.dg.err': ' · app errors: {n}',
      'g.rp.dg.gl': ' · 3D view lost: {n}',
      'g.rp.dg.gone': ' · view restarted: {n}',
      'g.push.bad': 'This address is not valid: use a 32-character PushPlus token, or a bot address starting with https://qyapi.weixin.qq.com/…',
      'g.push.on': '📲 Done: a daily report will be sent after 8 pm each day',
      'g.push.off': 'No more daily reports',
      'g.push.fill': 'First enter a PushPlus token or a WeCom bot address',
      'g.push.test.t': 'Echo Island: test message',
      'g.push.test.b': 'Hello! From now on, after 8 pm each day you will get the learner\'s study summary here.',
      'g.push.test.ok': '📲 Sent. Check your messages to see if it arrived',
      'g.push.test.no': 'Not sent: check the internet and the address',
      'g.push.h': '📲 Send the daily report to WeChat',
      'g.push.p': 'After 8 pm each day, one message with the learner\'s study summary (study time, adventure time, lines spoken, whether the study tasks are done) is sent to a parent\'s WeChat. It is off by default. Choose one of two ways:',
      'g.push.how1': '<b>PushPlus</b>: follow "pushplus" on WeChat and copy your token (32 characters) from its website.',
      'g.push.how2': '<b>WeCom group bot</b>: in a WeCom group go to Group settings → Group bots → Add, then copy the webhook address (it starts with https://qyapi.weixin.qq.com/…).',
      'g.push.ph': 'PushPlus token or bot address',
      'g.push.tip': 'The content of chats is never sent; if a chat needs a parent\'s attention, only a short note is sent. When there is no internet, it is sent once you are back online.',
      'g.push.btn.test': 'Send a test',
      'g.push.btn.save': 'Save',
      'g.push.btn.off': 'Stop sending',
      'g.push.btn.back': 'Back',
      'g.push.title': 'Echo Island daily report {md} ({dow})',
      'g.push.s.open': '✅ Study tasks done',
      'g.push.s.ex': '🟡 Review done (chat skipped: {why})',
      'g.push.s.pass': '📵 {r}; adventured for {n} minutes first (chat not done)',
      'g.push.s.pass.daily': 'chat time used up (hardly any speaking)',
      'g.push.s.pass.fail': 'chat could not connect',
      'g.push.s.pass.off': 'no internet',
      'g.push.s.off': '🔓 Study gate was off',
      'g.push.s.todo': '⬜ Study tasks not done yet',
      'g.push.l.time': '⏱️ Study {a} min · Adventure {b} min',
      'g.push.l.rev': '📕 Review answers right: {a} · 🎤 Said correctly: {b} · 🔥 Said from memory: {c}',
      'g.push.l.chat': '🗣️ Chats with islanders: {a}, lines of English spoken: {b}',
      'g.push.l.max': ' (longest: {n} words)',
      'g.push.l.goals': { one: ', {n} chat goal finished', other: ', {n} chat goals finished' },
      'g.push.w.off': '🔓 Study gate was turned off',
      'g.push.w.back': '⏰ The phone date was changed',
      'g.push.w.night': '🌙 Adventuring late at night',
      'g.push.w.quota': '💳 AI credit has run out',
      'g.push.w.busy': '⏳ AI was too busy',
      'g.push.w.auth': '🔑 AI key is wrong',
      'g.push.w.nokey': '🔑 No AI key yet',
      'g.push.w.skip': { one: '⏭️ AI was down: {n} question skipped', other: '⏭️ AI was down: {n} questions skipped' },
      'g.push.w.pinlock': '🔑 Parent PIN was locked after too many wrong tries',
      'g.push.w.pin': { one: '🔑 Parent PIN wrong {n} time', other: '🔑 Parent PIN wrong {n} times' },
      'g.push.l.concern': { one: '👪 {n} chat needs a parent to look at it (in the game: Settings → 🔒 Parent Settings → Chat safety)', other: '👪 {n} chats need a parent to look at them (in the game: Settings → 🔒 Parent Settings → Chat safety)' },
      'g.boot.quiet': '🔇 No-speaking mode: everywhere you would speak is now a button',
      'g.boot.bad.h': 'The save could not be read',
      'g.boot.bad.none': 'No usable backup was found either, so we have to start again from the beginning.',
      'g.boot.bad.used': 'Do not worry: it has been restored from <b>{w}</b>. At most a little recent progress is missing.',
      'g.boot.bad.tip': 'The damaged copy is kept and not deleted',
      'g.boot.bad.full': '; this device is full, so this time\'s progress is not being saved. Please tell a parent',
      'g.boot.bad.tip2': '. A parent can also switch to another backup in "Settings → 🔒 Parent Settings → 💾 Save backup".',
      'g.boot.restored': '🗂️ Restored from a backup: {w}',
      'g.boot.crash.log': 'The view process crashed and was reopened',
      'g.boot.crash': 'The screen had a problem and was reopened. Your save is safe',
      'g.shell.title': 'Echo Island',
      'g.shell.pet': 'My pet',
      'g.shell.streak': 'Days in a row',
      'g.shell.coins': 'Coins',
      'g.shell.tabs': 'Mode',
      'g.shell.quests': 'Daily tasks',
      'g.shell.review': 'Review list',
      'g.shell.shop': 'Pet Shop',
      'g.shell.ach': 'Achievements',
      'g.shell.report': 'Weekly report',
      'g.shell.settings': 'Settings',
      'g.shell.foot': 'Echo Island · English listening and speaking practice · Your progress is saved only on this device',
      'g.shell.quit': 'Leave this level',
      'g.shell.next': 'Continue',

      // —— Courses in other languages (tools/course/ENGINE.md, 2026-11-20) ——
      'g.bak.other': 'This save belongs to another course and cannot be used here',
      'g.fail.lang': '🎤 Speaking in this language needs the phone\'s own speech recognition, which is not available now. Skip for now; the sentence goes into your daily review',
      'g.home.qv.course': '📗 Course units',
      'g.unit.head.c': '📗 Course units', 'g.unit.all.c': 'All units of this course are open: each has words, sentences and dialogues written for its topic and grammar.',
      'g.gate.chat.lang': 'Chat with islanders (AI chat in this language is still being built, skipped today)', 'g.rp.ex.lang': 'AI chat in this language is still being built',
      'g.set.ruby': 'Readings', 'g.set.ruby.on': 'Show', 'g.set.ruby.off': 'Hide', 'g.set.ruby.d': 'Show how to read the words above questions, options and dialogues (not on memory hints).',
      'g.shell.foot.c': 'Echo Island · {lang} listening and speaking practice · Your progress is saved only on this device',
      'g.rc.1.d.c': 'Repeat the words, then look at the pictures and say them in {lang}.', 'g.type.sp.c': '🖼️ Say it in {lang} from the picture', 'g.tag.sp.c': 'Picture → {lang}',
      'g.cue.pic.t.c': 'Look at the picture and say it in {lang} from memory', 'g.q.ls.t.c': 'Listen and choose the {lang} you hear', 'g.q.fix.t.c': 'This can be said better: say the right {lang}',
      'g.q.mem.t.c': 'Look at the meaning and say it in {lang} from memory', 'g.q.sp.t.c': 'Look at the picture and say it in {lang}', 'g.q.bt.mem.c': 'Understand what it says and <b>answer in {lang} from memory</b> to attack!',
      'g.play.mic.sr.c': 'Tap the mic, then speak {lang} aloud', 'g.play.self.pic.c': 'Look at the picture and <b>say it aloud in {lang}</b> first, then see the answer', 'g.th.en.c': '<span>Aa</span>Text',
      'g.home.scene.new.c': 'See how people talk about this topic in {lang} · +10 coins the first time', 'g.th.tip.watch.c': 'Watch it once all the way through. Turn off the text to practise listening only. Tap a line in the record below to hear it again.',
      'g.mic.h.c': 'The microphone is needed to speak {lang}', 'g.mic.p.c': '<p>Echo Island needs to <b>hear your {lang}</b> to score it. Your voice is only used for scoring and is not saved.</p>', 'g.mic.allok.c': 'All good! You can speak {lang} now!',
      'g.set.mix.c': '{lang} questions in the adventure',
      'g.mic.chk.p.c': '<p>Echo Island needs to hear you speak {lang}. Tap the mic and say aloud: <b class="chk-say">{word}</b></p>', 'g.mic.listen.c': 'Listening… say {word} loudly!',
      'g.fb.perfect.c': 'Perfect! Every word was right', 'g.fb.good.c': 'Good! Well said', 'g.th.perfect.c': '<b>{n} points</b> Perfect!', 'g.th.good.c': '<b>{n} points</b> Good!',
      'g.praise.c': ['Great!', 'Nice!', 'Excellent!', 'Well done!', 'Super!', 'Correct!', 'Awesome!'],
      'g.mic.chk.hint.c': 'Tap the mic and say {word}', 'g.mic.quiet.c': 'No sound heard. Move closer, say {word} loudly and tap the mic again',
      'g.mic.covered.c': 'No sound heard. Is the microphone covered? Move closer, say {word} loudly and tap the mic again', 'g.set.mic.btn.c': 'Check now (say "{word}")',
      'g.intro.c.p1': '<p><b>🐲 Monster Adventure</b>: pick a monster as your partner. Say spells in {lang} to attack, and understand your rival\'s {lang} to defend. Catch new monsters, grow them up, and beat the Isle Masters of 13 areas to win badges.</p>',
      'g.intro.c.p2': '<p><b>📚 Practice</b>: 📗 Course units and 13 topic islands. Each level you clear gives you Echo Balls to catch monsters.</p>',
      'g.intro.c.p3': '<p><b>🗣️ Chat with islanders</b>: AI chat in this language is still being built; it will open here when it is ready. Story dialogues are shown in your interface language for now.</p>',
      // Chat with islanders in other courses (tools/course/TALK.md §4)
      'g.intro.c.p3.on': '<p><b>🗣️ Chat with islanders</b>: hold the mic and really chat with the people on the islands in {lang}. After the chat, the AI writes comments and shows you better ways to say things.</p>',
      'g.qp.tk1.c': 'Chat with an islander in {lang} and finish 1 goal',
      'g.res.gate.talk.c': '✅ Review done · Now chat with islanders in {lang} ({n}/{need} lines spoken) to go on an adventure',
      'g.set.gate.d.c': 'When it is on, each day you first finish the Daily review and chat with an islander in {lang} (say 6 sentences by voice, or finish one small goal). Then you can go on a Monster Adventure. Turning it off needs the parent PIN, and the days it was off show in the Weekly report. While it is off, adventure time has no limit either.',
      'g.set.ai.off.d.c': 'Ask a parent to paste the AI key here (an Alibaba Cloud Bailian API key). It is kept only on this phone. After that, speaking questions are scored automatically.',
      'g.gate.chat.said.c': { one: 'Chat with islanders: spoke {n} line of {lang} today', other: 'Chat with islanders: spoke {n} lines of {lang} today' },
      'g.gate.chat.used.c': 'Chat with islanders in {lang}: spoke <em class="gate-n">{a}/{b}</em> lines ({x})',
      'g.gate.chat.go.c': 'Chat with islanders in {lang}: spoke <em class="gate-n">{a}/{b}</em> lines, or finish a chat goal',
      'g.gate.blk.used.c': 'Your temporary adventure time is up. Get online and chat with islanders in {lang} to keep playing',
      'g.gate.blk.chat.c': 'First chat with islanders in {lang}: speak {need} lines (now {n}), or finish a chat goal',
      'g.adv.stop.pass.p.c': { one: 'There was no internet today (or chat could not connect), so you had {n} minute of adventure first. Get online and chat with islanders in {lang} to carry on.', other: 'There was no internet today (or chat could not connect), so you had {n} minutes of adventure first. Get online and chat with islanders in {lang} to carry on.' },
      'g.push.l.chat.c': '🗣️ Chats with islanders: {a}, lines of {lang} spoken: {b}', 'g.rp.hb.look.c': ' · Meanings looked up: {a} · "Help me" used: {b}',
      'g.rp.ab.a.ch': '<p class="rp-ab">💪 <b>Skills</b> (compared with last week): characters per line {n}', 'g.rp.hb.max.ch': ' (longest: {n} characters)', 'g.push.l.max.ch': ' (longest: {n} characters)',
      'g.ach.sight1.d.c': 'Read the {lang} clues and catch 1 monster from Today\'s Sighting',

      // —— 字表结束 ——
    },
  });

  // 内容的这几样（W / BOOKS / BK / NB / WX）英语课是加载时定下的；别的课在 start() 之前由 courseUse() 换成 course.json 里的（英语不换）
  let W = window.WORLDS;
  // 课本单元（book.js）：课本的每个单元和小岛一样有单词/句子/对话，接在 13 座岛后面编号（第 NB 号起），
  // 闯关、错题本、冒险出题都用 WX[编号]；只有岛屿才有的东西（岛主、徽章、乘风、对话动画）还是用 W
  let BOOKS = (window.BOOKS && window.BOOKS.list) || [];
  // bshort（七上……）是 getter：按界面语言给册名（world.js 的挑战馆门槛、talk.js 的课本话题也读它）
  const bkOf = list => list.flatMap((b, bi) => b.units.map(u => Object.defineProperty(Object.assign(u, { book: b.id, bi }), 'bshort', { get: () => bookShort(b), enumerable: true, configurable: true })));
  let BK = bkOf(BOOKS);   // 所有册的单元排成一列
  let NB = W.length, WX = W.concat(BK);
  // ---------- 别的语言的课程内容（ENGINE.md §2）----------
  // ENTRY：原文 → 条目 { t, seg, r, zh, en }（所有词、句子、对话的每一句、岛主的话、小剧场的每一句）；LEX：EchoLang.lexicon 的读音表。
  // 打分、提示、标读音都靠它们从一句话找回 seg / r。英语课两个都是空的、不用
  const ENTRY = new Map();
  let LEX = null;
  const entryOf = text => (LANG && text != null ? ENTRY.get(String(text)) || ENTRY.get(String(text).trim()) || null : null);
  // 打分的 ctx：这句话的条目 + 整门课的读音表
  const lctx = text => ({ entry: entryOf(text), lex: LEX });
  function entryAdd(t, x, zh) {
    if (typeof t !== 'string' || !t) return;
    const old = ENTRY.get(t);
    if (old && (old.seg || !(x && x.seg))) return;   // 先来的留着（同一句有 seg 的那份优先）
    const e = { t };
    if (x && typeof x === 'object') ['seg', 'r', 'en'].forEach(k => { if (x[k] != null) e[k] = x[k]; });
    e.zh = zh != null ? zh : (x && x.zh) || '';
    ENTRY.set(t, e);
  }
  function entriesOfWorld(w) {
    (w.words || []).forEach(it => entryAdd(it[0], glossObj(it), it[1]));
    (w.sents || []).forEach(it => entryAdd(it[0], glossObj(it), it[1]));
    (w.dlgs || []).forEach(it => { const x = glossObj(it) || {}; entryAdd(it[0], x.q); entryAdd(it[1], x.a); (it[2] || []).forEach((t, k) => entryAdd(t, (x.wrong || [])[k])); });
    if (w.boss && w.boss.hello) entryAdd(w.boss.hello, w.boss.x);
    if (w.key && w.x && w.x.key) entryAdd(w.key, w.x.key);
  }
  // course.json（tools/course/SPEC.md §6）→ 游戏里的内容。在 start() 之前调一次；英语课不调
  function courseUse(c) {
    window.WORLDS = c.WORLDS; window.SCENES = c.SCENES;
    window.BOOKS = c.BOOKS || { list: [] };
    W = c.WORLDS; BOOKS = window.BOOKS.list || []; BK = bkOf(BOOKS); NB = W.length; WX = W.concat(BK);
    // 和岛民聊天的角色：这门课的单元角色（服务器会用这门语言聊的时候聊天页列的就是它们，TALK.md §4；不会的时候聊天关着，别处也不拿英语的角色）
    const tl = Array.isArray(c.TALK) ? c.TALK : [];
    window.TALK_NPCS = { list: tl, byId: Object.fromEntries(tl.map(n => [n.id, n])) };
    if (window.EchoTalk && EchoTalk.useNpcs) EchoTalk.useNpcs(window.TALK_NPCS);
    if (window.EchoLevels && EchoLevels.addMap && c.MAP) EchoLevels.addMap(COURSE, c.MAP);
    ENTRY.clear();
    WX.forEach(entriesOfWorld);
    (c.SCENES || []).forEach(sc => (sc.lines || []).forEach(L => entryAdd(L[1], L[3], L[2])));
    LEX = EchoLang.lexicon(COURSE, [...ENTRY.values()]);
    // 台词翻译表（course.json 的 LINES / LINES_T / TERMS，tools/course/SPEC.md §8）：没有就是 null，写死的英语照 ENGINE.md §5 的过渡办法
    LTAB = window.EchoPacks && EchoPacks._ && EchoPacks._.lineTable ? EchoPacks._.lineTable(c) : null;
    // 支线委托在这门语言里的开场白、示范句、词卡（course.json 的 QUESTS，tools/course/TALK.md 第二轮）：老的课程包没有 = null，委托照旧不出
    CQ = c.QUESTS && typeof c.QUESTS === 'object' && !Array.isArray(c.QUESTS) ? c.QUESTS : null;
    CQN = {};
    // 发音入门（tools/course/WORDS.md §4，course.json 的 PRIMER）：有一段有格子才算有；老的课程包没有 = null（不出入口、不出首页卡片）
    PRIMER = c.PRIMER && Array.isArray(c.PRIMER.sections) && c.PRIMER.sections.some(s => s && Array.isArray(s.items) && s.items.some(Boolean)) ?
      Object.assign({}, c.PRIMER, { sections: c.PRIMER.sections.filter(s => s && Array.isArray(s.items) && s.items.some(Boolean) && (s.layout === 'grid' || s.layout === 'list')) }) : null;
    // 课前讲解、求助的话（WORDS.md 第 7、8、12 条，course.json 的 LESSONS）：老的课程包没有 = null
    LESSONS = c.LESSONS && typeof c.LESSONS === 'object' ? c.LESSONS : null;
    DICT = null;
  }
  // 英语课的课前讲解和求助的话在 lessons-en.js（window.LESSONS_EN）；别的课在 courseUse 里换成 course.json 的
  let LTAB = null, CQ = null, CQN = {}, PRIMER = null, LESSONS = LANG ? null : window.LESSONS_EN || null, DICT = null;
  // ---------- 别的课的支线委托：这门语言的那几样（course.json 的 QUESTS）----------
  // QUESTS[委托 id] = { opener 开场白, steps: [示范句…]（和 quests.js 的 steps 一步对一步）, words: [[这门语言的词, 中文, 英文]…] }；
  // 句子、词可以是字符串，也可以带读音：{ t, r }（词）/ { t, seg, r }（句子）——两种都认。
  // questLoc(id) → { opener, steps: [文字…], words: [{ t, zh, en }] }；带读音的顺手登记进条目表 ENTRY（标读音 ruby / rubyLine、朗读 say 就认得它）。
  // 英语课、老的课程包、这一条没写 / 写得不对：null（world.js 的 QL() 就不出这条委托）
  function questLoc(id) {
    if (!LANG || !CQ || typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(CQ, id)) return null;
    if (CQN[id] !== undefined) return CQN[id];
    const q = CQ[id];
    const one = (v, zh, en) => {
      const x = typeof v === 'string' ? { t: v } : v && typeof v === 'object' && !Array.isArray(v) && typeof v.t === 'string' ? v : null, t = x ? x.t.trim() : '';
      if (!t) return '';
      const e = {};
      if (Array.isArray(x.seg) && Array.isArray(x.r) && x.seg.length === x.r.length && x.seg.join('') === x.t) { e.seg = x.seg; e.r = x.r; }
      else if (typeof x.r === 'string' && x.r.trim()) e.r = x.r;
      if (en) e.en = String(en);
      if (e.seg || e.r || zh || en) entryAdd(t, e, zh ? String(zh) : '');
      return t;
    };
    let out = null;
    if (q && typeof q === 'object' && Array.isArray(q.steps) && q.steps.length) {
      const opener = one(q.opener), steps = q.steps.map(s => one(s));
      // 词卡的意思：中文那份是 quests.js 里给学英语的人写的，有的带着讲英语的括号（「去了（go 的过去式）」）——带拉丁字母的括号部分去掉；
      // 英文那份就是 quests.js 的那个英语词
      const zhClean = s => String(s).replace(/\s*[（(][^（()）]*[A-Za-z][^（()）]*[）)]/g, '').trim();
      const words = (Array.isArray(q.words) ? q.words : []).map(w => {
        const a = Array.isArray(w) ? w : [w, w && w.zh, w && w.en], zh = typeof a[1] === 'string' ? zhClean(a[1]) : '', en = typeof a[2] === 'string' ? a[2] : '';
        return { t: one(a[0], zh, en), zh, en };
      }).filter(w => w.t);
      // names（可以没有）：这条委托的英文原文里出现的名字在这门课里怎么写 [[英语名, 写法]…]（build.js 按台词翻译表的词配的）——
      // 界面上的目标说明是 quests.js 的中文 / 英文那两份，里面的人名、地名照它换（questNames）
      const names = (Array.isArray(q.names) ? q.names : []).filter(p => Array.isArray(p) && typeof p[0] === 'string' && p[0] && typeof p[1] === 'string' && p[1] && p[0] !== p[1]).map(p => [p[0], p[1]]);
      if (opener && steps.every(Boolean)) out = { opener, steps, words, names };
    }
    return (CQN[id] = out);
  }
  // 委托的目标说明（quests.js 的 goal / goalZh）里的名字换成这门课的写法：整个名字才换、长的先配（「Fisher Tom」先于「Tom」）。
  // 英语课、没有名字表：原样
  function questNames(id, s) {
    const loc = LANG ? questLoc(id) : null;
    if (!loc || !loc.names.length || typeof s !== 'string') return s;
    const m = new Map(loc.names), ks = [...m.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return s.replace(new RegExp('(^|[^A-Za-z])(' + ks.join('|') + ')(?![A-Za-z])', 'g'), (all, pre, k) => pre + m.get(k));
  }
  // ---------- 读音（日语、中文：ENGINE.md §3「读音」）----------
  // E.ruby(原文) → HTML：找得到条目就按词块标读音（真的 <ruby>），找不到就原样（转义过）。西语、关掉了「读音」的、英语课都原样
  const rubyOn = () => !!LANG && LANG.script !== 'latin' && S.settings.ruby !== false;
  const TAILP = /[\s、。，．,.!！?？;；:：」』）)…〜～]+$/u;
  function rubyPiece(p, r) {
    p = String(p); const tail = (TAILP.exec(p) || [''])[0], base = p.slice(0, p.length - tail.length);
    r = String(r || '').trim();
    // 日语：全是假名的块不用标；读音和写法一样也不用标
    if (!base || !r || r === base || (LANG.script === 'kana' && !/[㐀-鿿豈-﫿々]/.test(base))) return esc(p);
    // 台词里的名字（拉丁字母，读音就是它自己，后面可能跟着引号）：不标
    if (/^[A-Za-z][A-Za-z .'-]*$/.test(r) && base.replace(/[^A-Za-z .'-]/g, '') === r) return esc(p);
    return '<ruby>' + esc(base) + '<rt>' + esc(r) + '</rt></ruby>' + esc(tail);
  }
  // 一句话的词块和每块的读音（没有读音的块给 ''）
  function rubyParts(text) {
    const e = entryOf(text), ps = LANG.pieces(text, e);
    let rs = [];
    if (e && Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === ps.length) rs = e.r;
    else if (e && typeof e.r === 'string' && ps.length === 1) rs = [e.r];
    return ps.map((p, k) => [p, rs[k] || '']);
  }
  function ruby(text) {
    if (!rubyOn() || !entryOf(text)) return esc(text);
    return rubyParts(text).map(([p, r]) => rubyPiece(p, r)).join('');
  }
  // 显示要学的那句话：别的课标读音，英语课就是 esc（一字不变）
  const rb = t => (LANG ? ruby(t) : esc(t));
  // ---------- 聊天里要学的那几句的读音（tools/course/TALK.md §4：示范句、词卡、照着剧本说的开场白）----------
  // 课程的 TALK 没带读音。条目表里有这句就照条目标（ruby）；没有就拿课程里写过读音的词块一段一段去对：
  // · 只认课程里只有一种读法的写法（同一个写法写过两种读音的不标）；对不上的字不标——不猜；
  // · 日语：一串汉字要整串对上才标（「三人」不拿「人」的读音去凑），前面带着 お / ご 的要连着它一起对上（お母さん 不拿「母」的读音）；
  // · 中文：一个字一个字、一个词一个词对（先对最长的）。课程没教过的多音字可能标成课程里的那个读法——这一点知道，量很小。
  // 岛民现场说的话不走这里（不硬标）。西语、关了「读音」、英语课：原样
  const HANC = /[㐀-鿿豈-﫿々]/;
  let RLEX = null;
  function rubyLex() {
    if (RLEX && RLEX.n === ENTRY.size) return RLEX;
    const m = new Map(); let max = 1;
    const add = (k, r) => {
      k = String(k || '').replace(/^[\s「『（(“‘"']+/, '').replace(TAILP, ''); r = String(r || '').replace(TAILP, '').trim();
      if (!k || !r || !HANC.test(k)) return;
      if (m.has(k)) { if (m.get(k) !== r) m.set(k, ''); return; }
      m.set(k, r); max = Math.max(max, Array.from(k).length);
    };
    ENTRY.forEach(e => {
      if (Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length) e.seg.forEach((s, i) => add(s, e.r[i]));
      else if (typeof e.r === 'string') add(e.t, e.r);
    });
    return (RLEX = { m, max, n: ENTRY.size });
  }
  function rubyLine(text) {
    text = String(text == null ? '' : text);
    if (!rubyOn()) return esc(text);
    if (entryOf(text)) return ruby(text);
    const X = rubyLex(), cs = Array.from(text), kana = LANG.script === 'kana', isH = k => k >= 0 && k < cs.length && HANC.test(cs[k]);
    let out = '', i = 0;
    while (i < cs.length) {
      const han = isH(i);
      if (!han && !(kana && /[ぁ-ゖァ-ヺ]/.test(cs[i]))) { out += esc(cs[i]); i++; continue; }
      let j = i; while (isH(j)) j++;   // 从这里开始的这串汉字到哪里（不是汉字开头：j === i）
      const pre = kana && han && i > 0 && /[おご]/.test(cs[i - 1]);
      let hit = 0, r = '';
      if (!pre) for (let len = Math.min(X.max, cs.length - i); len >= 1; len--) {
        if (kana && (i + len < j || (isH(i + len - 1) && isH(i + len)))) continue;   // 日语：不能停在一串汉字中间
        const v = X.m.get(cs.slice(i, i + len).join(''));
        if (v) { hit = len; r = v; break; }
      }
      if (hit) { out += rubyPiece(cs.slice(i, i + hit).join(''), r); i += hit; }
      else if (kana && han) { out += esc(cs.slice(i, j).join('')); i = j; }   // 这串汉字课程里没写过读音：整串不标
      else { out += esc(cs[i]); i++; }
    }
    return out;
  }
  // 排句子的块的读音（块和条目的 seg 一一对上时才有）
  function tileR(text, toks) {
    const e = entryOf(text);
    return e && Array.isArray(e.seg) && Array.isArray(e.r) && e.r.length === toks.length ? e.r : null;
  }
  const isUnit = wi => wi >= NB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const range = n => Array.from({ length: n }, (_, i) => i);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  // ---------- 关卡配方：每个岛 7 关，最后是 Boss ----------
  // 数据表里的字按界面语言取（getter，用到的时候才取）：表的形状不变——别处还是 RECIPES[i].name、TYPE_TAG[t]、ACH 的 [id, 图标, 名字, 说明, 条件] 这样读
  // lazy(对象, 字段, 键, 参数函数)：给对象的字段（数组的下标也行）装一个按界面语言取字的 getter
  const lazy = (o, f, k, p) => Object.defineProperty(o, f, { get: () => tr(k, p ? p() : undefined), enumerable: true, configurable: true });
  // { 编号: 字 }：键 = 前缀 + 编号（编号是 '' 的用 idle）；没列出的编号读出来是 undefined
  const lazyMap = (pre, ids) => ids.reduce((o, id) => lazy(o, id, pre + (id === '' ? 'idle' : id)), {});
  const rc = (i, o) => { lazy(o, 'desc', 'g.rc.' + i + '.d'); return i < 6 ? lazy(o, 'name', 'g.rc.' + i + '.n') : o; };
  const RECIPES = [
    rc(0, { icon: '🎧', mix: [['lw', 6], ['ls', 4]] }),
    rc(1, { icon: '🎤', mix: [['sr_w', 4], ['sp', 4], ['lw', 2]] }),
    rc(2, { icon: '🎧', mix: [['lm', 5], ['lo', 3], ['ls', 2]] }),
    rc(3, { icon: '🎤', mix: [['sr_s', 5], ['lo', 2], ['lm', 3]] }),
    rc(4, { icon: '💬', mix: [['lr', 6], ['sr_d', 4]] }),
    rc(5, { icon: '⚡', mix: [['lw', 2], ['ls', 1], ['lm', 2], ['lo', 2], ['lr', 2], ['sr_s', 2], ['sp', 1]], review: true }),
    rc(6, { name: 'BOSS', icon: '👑', mix: [['bt', 6], ['lo', 2]], boss: true }),
  ];
  const KIND = { lw: 'word', ls: 'word', sp: 'word', sr_w: 'word', lm: 'sent', lo: 'sent', sr_s: 'sent', lr: 'dlg', sr_d: 'dlg', bt: 'dlg' };
  const TYPE_LABEL = lazyMap('g.type.', ['lw', 'ls', 'lm', 'lr', 'lo', 'sr_w', 'sr_s', 'sr_d', 'sp', 'bt']);
  const TYPE_TAG = lazyMap('g.tag.', ['lw', 'ls', 'lm', 'lr', 'lo', 'sr_w', 'sr_s', 'sr_d', 'sp', 'bt']);
  const SPEAK_TYPES = ['sr_w', 'sr_s', 'sr_d', 'sp'];
  // 表扬的话：数组的每一格是 getter（g.praise 在两门语言里一样长），pick(PRAISE) 照旧能用；别的课用 g.praise.c（中文界面里没有英语的夸奖）
  const PRAISE = [];
  for (let i = 0; i < 7; i++) Object.defineProperty(PRAISE, i, { get: () => { const a = I18N ? I18N.raw(LANG ? 'g.praise.c' : 'g.praise') : null; return a ? a[i] : ''; }, enumerable: true, configurable: true });

  const TITLES = [1, 3, 5, 7, 10, 13, 16, 20, 25, 30].map(n => lazy([n, ''], 1, 'g.title.' + n));
  const PETS = [['🐣', 0, 'chick'], ['🐱', 60, 'cat'], ['🐶', 60, 'dog'], ['🐰', 80, 'rabbit'], ['🐸', 80, 'frog'], ['🦊', 120, 'fox'], ['🐼', 150, 'panda'], ['🐧', 150, 'penguin'], ['🦉', 200, 'owl'], ['🐬', 250, 'dolphin'], ['🦄', 400, 'unicorn'], ['🐲', 600, 'dragon']]
    .map(([e, price, id]) => lazy([e, price, ''], 2, 'g.pet.' + id));
  const CHEST_PETS = [['🦖', 'dino'], ['🦋', 'butterfly'], ['🐙', 'octopus']].map(([e, id]) => lazy([e, ''], 1, 'g.pet.' + id));

  // 每日任务池：t（任务名）是 getter
  const QPOOL = [
    { id: 'lv2', goal: 2, key: 'levels', rw: 20 },
    { id: 'lv4', goal: 4, key: 'levels', rw: 40 },
    { id: 'sp10', goal: 10, key: 'spoken', rw: 20 },
    { id: 'sp25', goal: 25, key: 'spoken', rw: 40 },
    { id: 'cb8', goal: 8, key: 'combo', max: true, rw: 30 },
    { id: 'st3', goal: 1, key: 'three', rw: 30 },
    { id: 'pf5', goal: 5, key: 'perfect', rw: 30 },
    { id: 'ls20', goal: 20, key: 'listen', rw: 20 },
    { id: 'rv5', goal: 5, key: 'review', rw: 30 },
    { id: 'rp1', goal: 1, key: 'roleplay', rw: 30 },
    { id: 'bt3', goal: 3, key: 'battle', rw: 30 },
    { id: 'ct1', goal: 1, key: 'catch', rw: 40 },
    { id: 'tk1', goal: 1, key: 'talk', rw: 40 },
  ].map(q => lazy(q, 't', 'g.qp.' + q.id));
  const QDEF = Object.fromEntries(QPOOL.map(q => [q.id, q]));

  // 成就：[id, 图标, 名字, 说明, 条件]——名字（下标 2）和说明（下标 3）是 getter；p = 说明里 {n} 的取法
  const ach = (id, icon, test, p) => lazy(lazy([id, icon, '', '', test], 2, 'g.ach.' + id + '.n'), 3, 'g.ach.' + id + '.d', p);
  const ACH = [
    ach('first', '🚩', s => s.stats.levels >= 1),
    ach('lv10', '⛵', s => s.stats.levels >= 10),
    ach('lv50', '🚢', s => s.stats.levels >= 50),
    ach('boss1', '⚔️', s => s.stats.bosses >= 1),
    ach('boss5', '🛡️', s => s.stats.bosses >= 5),
    ach('allboss', '👑', s => W.every((w, i) => (s.stars[i + '-6'] || 0) > 0)),
    ach('c10', '🔥', s => s.stats.maxCombo >= 10),
    ach('flaw', '🎯', s => s.stats.flawless >= 1),
    ach('sp50', '🎤', s => s.stats.spoken >= 50),
    ach('sp300', '📣', s => s.stats.spoken >= 300),
    ach('pf30', '💯', s => s.stats.perfect >= 30),
    ach('st3', '📅', s => s.streak >= 3),
    ach('st7', '🗓️', s => s.streak >= 7),
    ach('st30', '🏅', s => s.streak >= 30),
    ach('three10', '⭐', s => s.stats.threeStars >= 10),
    ach('world', '🏝️', s => W.some((w, i) => range(7).every(l => (s.stars[i + '-' + l] || 0) === 3))),
    ach('rv20', '📕', s => s.stats.reviewed >= 20),
    ach('pets3', '🐾', s => s.pets.length >= 3),
    ach('rich', '💰', s => s.coins >= 500),
    ach('actor', '🎬', s => s.stats.roleplay >= 5),
    ach('catch1', '🔮', s => (s.mon.caught || 0) >= 1),
    ach('dex8', '📖', s => window.MonsterGame && MonsterGame.caughtCount(s) >= 8),
    ach('dexall', '🌈', s => { const r = window.EchoWorld && EchoWorld.dexRegion ? EchoWorld.dexRegion(s) : null; return !!r && r.total > 0 && r.caught >= r.total; }, () => ({ n: (window.DEX && DEX.region1Total) || '' })),
    ach('evo1', '✨', s => (s.mon.evolved || 0) >= 1),
    ach('badge5', '🏅', s => Object.keys(s.mon.badges).length >= 5),
    ach('badgeall', '🏆', s => Object.keys(s.mon.badges).length >= W.length),
    // 今日目击（sighting.js）：按一共收服了几只算，不按连续天数——不逼着天天来
    ach('sight1', '🔎', s => (((s.world || {}).sight || {}).total || 0) >= 1),
    ach('sight7', '🧭', s => (((s.world || {}).sight || {}).total || 0) >= 7),
  ];

  // ---------- 存档 ----------
  // 一门课一份存档（ENGINE.md §1）：英语还是 echo-island-v1；别的语言 echo-island-v1@<语言>。下面从 KEY 派生的（-bak1..3、-pos、-pre、-bad、-bakmeta）都跟着走
  const KEY = 'echo-island-v1' + (LANG ? '@' + COURSE : '');
  // 这份存档是不是这门课的（导入的文件、手机「下载/EchoIsland」里的备份不分语言：别的课的不拿来用）。别的课的存档带 course，英语的没有
  const mine = o => !!o && (LANG ? o.course === COURSE : !o.course);
  function fresh() {
    return {
      v: 1, xp: 0, coins: 50, stars: {}, streak: 0, lastDay: '', freeze: 0,
      quests: { day: '', list: [], chest: false }, wrong: {}, pets: ['🐣'], pet: '🐣', ach: {},
      stats: { levels: 0, spoken: 0, perfect: 0, maxCombo: 0, listen: 0, reviewed: 0, threeStars: 0, bosses: 0, flawless: 0, roleplay: 0 }, scenes: {},
      settings: { rate: 0.9, voice: '', mode: 'auto', tts: 'auto', sfx: true, unlockAll: false, gfx: 'auto', gfxAuto: '', ctl: 'joy', orient: 'portrait', gate: true, music: 'mid',
        // 冒险时间（家长设置）：on 限时、wd 上学日 / we 周末每天几分钟、from–to 这段时间不能冒险、max 多学一点最多奖励几分钟
        limit: { on: true, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 },
        push: '',                                 // 日报推送：PushPlus 的 token 或企业微信群机器人的 webhook 地址（空 = 不发）
        pinLock: { n: 0, until: 0, lockouts: 0 },  // 网页版家长密码输错的次数、锁到什么时候、一共被锁过几次（APK 里由原生管）
        verUrl: '',                               // 检查新版本的地址（家长设置里改；空 = 默认的 GitHub Pages 上的 version.json）
        family: null,                             // 销售版：家长首次设置向导的结果和家庭定制（setup.js 的 EchoSetup，「清空进度」也留着）
        // 2026-11-19（给所有人用）：ui 界面语言（i18n.js，'zh' / 'en'）；learner 谁在学——'kid' 孩子（学习锁、冒险限时、家长密码，老存档都是）/
        // 'open' 青少年和成人自己学（没有学习锁、不限时、不要家长密码，别的一样）；track 课程怎么排——'book' 按课本（老存档）/ 'level' 按能力检测的级别。
        // 注意：上面那个 mode 是口语打分方式（auto / self），和「谁在学」没关系
        ui: 'zh', learner: 'kid', track: 'book',
      }, seenIntro: false,
      micCheck: '',        // 第一次「麦克风 + 网络 + 密钥」小检查做过了没有（日期；'skip' = 先跳过了）
      upd: {},             // 最近一次查到的新版本：{ code, name, url, notes, at }（只有 APK 查）
      log: {},   // 每天的学习记录（周报用）：日期 → { min 玩了几分钟, learn 学习分钟, play 冒险分钟, levels 关卡, spoken 开口说对, review 复习答对, … }
      weekly: [],          // 每周压成一行、永久保留（S.log 只留 45 天）：见 weeklyRoll()
      push: { sent: '' },  // 日报最后发到哪一天了
      homeTab: 'mon', mon: window.MonsterGame ? MonsterGame.fresh() : { box: [], team: [], dex: {}, badges: {}, balls: 5 },
      world: window.EchoWorld ? EchoWorld.fresh() : {},
      player: { gender: '', name: '' },
      talk: { log: [], done: {}, days: {} },   // 和岛民聊天（talk.js）：最近的记录、每个岛民最好几星、今天拿过金币的
      book: { at: -1, mix: .6, view: 'book', vb: '' },   // 课本单元：正在学的单元（BK 里第几个，-1 = 没选过，按日期猜）、冒险出题里课本占几成、闯关页看课本还是小岛、正在看哪一册
      rev: { items: {}, v: 0, day: { d: '', n: 0, f: 0 }, gone: 0 },   // 每日复习（间隔复习）：见 revWrong / revRight / dueList；day = 今天新进了几条（n）、冒险里算了几次复习（f）；gone = 掌握以后删掉的聊天句子有几条（revTrim）
      // 能力检测（placement.js）：lang 在学的语言、who 年龄段（child / teen / adult，只存这个，不存生日）、know 自己报的学过多少（0–3）、
      // auto 最近一次测出来的综合级别（-1 = 没测过）、adj 自己调了几级、lv = auto + adj（现在按第几级安排，-1 = 没定过）、talk 测出来的聊天级别、
      // cap 综合级别是不是被听说压低过、sk 各项 { e 估计值, lv, n 做了几道 } 或 { skip 没测的原因 }、at 哪天测的、
      // from 按能力走时从第几个课本单元开始（前面的已免修）、hist 最近 6 次的结果、run 做到一半的那次（暂停）、seen 做过的题（下次先出没做过的）、
      // skip 哪天说了「以后再测」、card 哪天把首页的卡片关了
      place: { lang: 'en', who: '', know: -1, lv: -1, auto: -1, adj: 0, talk: -1, cap: 0, sk: {}, at: '', from: -1, hist: [], run: null, seen: [], skip: '', card: '' },
      // 单词卡（tools/course/WORDS.md §2）：哪个小镇 / 单元（WX 的编号）看过单词卡了 → 哪天；看过的第 1 关不再先弹单词卡
      // （开关在 settings.cards：true / false / 没有 = 开着，见 cardsOn；日语的罗马字开关 settings.romaji：没有 = 开着——这两个不放在这里，和 ruby 一样）
      seenCards: {},
      primerSeen: '',      // 发音入门（WORDS.md §4）看过 / 首页卡片点了「不用了」的日期（'' = 还没有：这门课还没有星时首页给一张卡片）
      // 课前讲解「这一课学什么」（WORDS.md §7）：哪个小镇 / 单元看过了 → 哪天（看过的第 1 关不再先弹讲解）。
      // 新手路线（§9）的开关 settings.route、点词看意思（§10）的开关 settings.wordTap、朗读慢一点（§11）settings.slow 都不放在这里（没有 = 照默认）
      seenLesson: {},
      // 一步一步学（tools/course/STARTER.md）：n[小镇 / 单元编号] = 学完几节小课；skip[编号] = 说了「我学过了，直接闯关」。开关 settings.starter 不放在这里（没有 = 照默认）
      mini: { n: {}, skip: {} },
    };
  }
  function merge(base, o) {
    for (const k in o) {
      const a = base[k], b = o[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) merge(a, b);
      else base[k] = b;
    }
    return base;
  }
  // ---------- 存档的备份（家长 2026-10-07，评估第 7 条）----------
  // ① 每天第一次保存前，把上一份存档复制成这台设备上的 bak1（原来的 bak1 → bak2 → bak3，留 3 份，哪天的记在 bakmeta）；
  // ② 存档读不出来（坏了）：不覆盖它——先原样另存一份（KEY-bad），再用最近一份好的备份（本机 bak1–3，APK 再看手机「下载/EchoIsland」里的），
  //    打开后告诉孩子（RT.restored）；一份好的都没有才从头开始；
  // ③ APK：每天第一次保存时往手机「下载/EchoIsland/」写一份（EchoNative.backupWrite：原生只留最近 7 份，卸载 App 也不删），
  //    切到后台时隔 1 小时以上再写一次（同一天覆盖同一份）。
  // 设置里「导出存档」（分享到微信 / 网页版下载成文件）、「从备份恢复」（要家长密码）见 exportSave / restoreSheet。
  //
  // 存档越玩越大（2026-11-15 量过：玩 1 年约 37 万字、3 年约 110 万字，localStorage 一共只有约 524 万字）：
  // ④ 备份压着存（lzPack，约六分之一）：本机 3 份、「恢复前 / 清空前」那份、坏档那份，超过 PACK_MIN 字的都压；读的时候 parseSave / bakGet 自动解开。
  //    小存档（测试用的）还是原样的 JSON。导出的文件、手机「下载/EchoIsland」里的也一直是原样的 JSON；
  // ⑤ 存档大了以后走路不重写整份存档：每走一步只往 KEY-pos 写一条很小的位置记录（savePos），停下来 1 秒、换地图、开战、回首页、切到后台时
  //    才把整份存档存一次（flushWalk）。下次打开时 KEY-pos 要是比存档新（上次没来得及整份存就被关掉了），就用它的位置（load 里的 posApply）；
  // ⑥ 快满之前先说（storeCheck）：用到 80% 首页挂一条请家长导出，不等到存不进去。
  const BAK = [1, 2, 3].map(n => KEY + '-bak' + n), BAK_META = KEY + '-bakmeta', BAD = KEY + '-bad', PRE = KEY + '-pre', POS = KEY + '-pos';
  const LS_QUOTA = 5 * 1024 * 1024;   // 浏览器 / WebView 给一个网站的 localStorage：键 + 值约 10MB，中文一个字占 2 字节 → 约 524 万字
  // iPhone（WebKit）只给 5MB：一个值里只要有一个中文字，整个值就按一个字 2 字节算 → 约 262 万字（tools/ios/probe.js 量过）。按一半算，快满的提示才来得及
  const LS_QUOTA_NOW = window.ECHO_IOS ? LS_QUOTA / 2 : LS_QUOTA;
  const PACK_MIN = 20000;             // 这么多字以上的备份才压
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } };
  // 读得出来、是一个存档对象 → 对象；写了一半、乱码、不是对象 → null（压过的备份先解开）
  function parseSave(txt) {
    if (!txt || typeof txt !== 'string') return null;
    txt = lzUnpack(txt);
    if (!txt) return null;
    try { const o = JSON.parse(txt); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
  }
  // ---------- 备份压着存（存档大了以后，几份备份原样放会把 localStorage 撑满）----------
  // LZW：存档文字先转成 UTF-8 字节，重复出现的片段换成 9–16 位的编号，再每 15 位装进一个字（都落在 0x20–0x801F，没有代理对）。
  // 格式：'LZ1:' + 原文字数 + ':' + UTF-8 字节数 + ':' + 字节的校验和（都是 36 进制）+ ':' + 压好的字。JSON 存档能压到原来的六分之一上下。
  // 压完马上解一次对一遍（lzPack 里），对不上就不压、原样存——备份宁可大一点，不能读不回来。
  const LZ_TAG = 'LZ1:', LZ_MAX = 65536, LZ_HS = 1 << 18;
  const lzBits = n => { let w = 9; while ((1 << w) < n) w++; return w; };
  const lzSum = u8 => { let h = 0x811c9dc5; for (let i = 0; i < u8.length; i++) h = Math.imul(h ^ u8[i], 16777619); return (h >>> 0).toString(36); };
  function lzPack(str) {
    if (typeof str !== 'string' || !str || typeof TextEncoder !== 'function') return str;
    try {
      const src = new TextEncoder().encode(str), n = src.length;
      const hk = new Int32Array(LZ_HS).fill(-1), hv = new Uint16Array(LZ_HS), out = new Uint16Array(Math.ceil(n * 16 / 15) + 8);
      let o = 0, buf = 0, nb = 0, next = 258, width = 9, w = src[0];
      const put = code => { buf = (buf << width) | code; nb += width; while (nb >= 15) { nb -= 15; out[o++] = ((buf >>> nb) & 0x7fff) + 32; } buf &= (1 << nb) - 1; };
      for (let i = 1; i < n; i++) {
        const c = src[i], key = (w << 8) | c;
        let h = (Math.imul(key, 0x9E3779B1) >>> 14) & (LZ_HS - 1), hit = -1;
        while (hk[h] !== -1) { if (hk[h] === key) { hit = hv[h]; break; } h = (h + 1) & (LZ_HS - 1); }
        if (hit >= 0) { w = hit; continue; }
        put(w);
        if (next < LZ_MAX) { hk[h] = key; hv[h] = next++; width = lzBits(next); }
        else { put(256); hk.fill(-1); next = 258; width = 9; }   // 字典满了：发一个「清空」，从头再攒
        w = c;
      }
      put(w);
      if (nb) out[o++] = ((buf << (15 - nb)) & 0x7fff) + 32;
      let s = ''; for (let i = 0; i < o; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, Math.min(o, i + 8192)));
      const packed = LZ_TAG + str.length.toString(36) + ':' + n.toString(36) + ':' + lzSum(src) + ':' + s;
      return packed.length < str.length && lzUnpack(packed) === str ? packed : str;
    } catch (e) { return str; }
  }
  // 解不开（不是这个格式、被截断、对不上字数）返回 null；没压过的原样返回
  function lzUnpack(txt) {
    if (typeof txt !== 'string' || txt.slice(0, LZ_TAG.length) !== LZ_TAG) return txt;
    try {
      const a = txt.indexOf(':', LZ_TAG.length), b = txt.indexOf(':', a + 1), c = txt.indexOf(':', b + 1);
      const chars = parseInt(txt.slice(LZ_TAG.length, a), 36), n = parseInt(txt.slice(a + 1, b), 36);
      if (a < 0 || b < 0 || c < 0 || !(n > 0) || n > 64 * 1024 * 1024) return null;
      const out = new Uint8Array(n), pre = new Uint16Array(LZ_MAX), suf = new Uint8Array(LZ_MAX), stack = new Uint8Array(LZ_MAX);
      let p = c + 1, buf = 0, nb = 0, o = 0, next = 258, prev = -1, first = 0;
      const end = txt.length;
      while (o < n) {
        const width = lzBits(Math.min(next + 1, LZ_MAX));
        while (nb < width) { if (p >= end) return null; buf = (buf << 15) | ((txt.charCodeAt(p++) - 32) & 0x7fff); nb += 15; }
        nb -= width;
        const code = (buf >>> nb) & ((1 << width) - 1); buf &= (1 << nb) - 1;
        if (code === 256) { next = 258; prev = -1; continue; }
        if (code === 257 || code > next || (code === next && prev < 0)) return null;
        let cur = code, sp = 0;
        if (code === next) { stack[sp++] = first; cur = prev; }   // 这一条还没建好（它就是「上一条 + 上一条的第一个字节」）
        while (cur >= 258) { stack[sp++] = suf[cur]; cur = pre[cur]; }
        first = cur; stack[sp++] = cur;
        if (o + sp > n) return null;
        while (sp) out[o++] = stack[--sp];
        if (prev >= 0 && next < LZ_MAX) { pre[next] = prev; suf[next] = first; next++; }
        prev = code;
      }
      if (lzSum(out) !== txt.slice(b + 1, c)) return null;
      const s = new TextDecoder('utf-8').decode(out);
      return s.length === chars ? s : null;
    } catch (e) { return null; }
  }
  const bakMeta = () => { try { return JSON.parse(lsGet(BAK_META) || '{}') || {}; } catch (e) { return {}; } };
  const nat = f => { try { return window.EchoNative && typeof EchoNative[f] === 'function'; } catch (e) { return false; } };
  // 往备份的键里放的：够大的压着放（已经压过的不动）；bakGet 读回原文（没有、解不开 → ''）
  const packBig = t => (t && t.length >= PACK_MIN && t.slice(0, LZ_TAG.length) !== LZ_TAG ? lzPack(t) : t);
  const bakGet = k => lzUnpack(lsGet(k) || '') || '';
  // 备份日期：bakmeta 里存的是日期（或空；老存档里存过中文的「以前」），显示时按界面语言补；备份的 label 是 getter，显示的时候才按界面语言拼
  const bakDayTxt = v => (!v || (I18N && v === I18N.t('g.save.before', null, 'zh')) ? tr('g.save.before') : v);
  // 最近一份读得出来的备份：{ o 存档, txt 原文, label 哪里的哪天的 }；先看本机的 3 份，再看手机「下载/EchoIsland」里的
  function bestBackup() {
    const meta = bakMeta();
    for (let i = 0; i < BAK.length; i++) {
      const txt = bakGet(BAK[i]), o = parseSave(txt);
      if (o) return { o, txt, get label() { return tr('g.save.dev', { d: bakDayTxt(meta['d' + (i + 1)]) }); } };
    }
    if (nat('backupList') && nat('backupRead')) {
      try {
        for (const b of JSON.parse(EchoNative.backupList() || '[]').slice(0, 7)) {
          const txt = EchoNative.backupRead(b.name), o = parseSave(txt);
          if (o && mine(o)) return { o, txt, get label() { return tr('g.save.phone', { d: b.date || b.name }); } };
        }
      } catch (e) { /* 读不到就算了 */ }
    }
    return null;
  }
  // 位置记录（KEY-pos）是照着某一份整存档记的：n = 那份存档的字数，b = 那份存档里的位置，p = 后来走到的位置，
  // c = 跟着走路变的几个数（walkCount：喷雾还剩几步、一共走了几步、幼儿园的步数、队伍里的蛋还要走几步）。
  // 打开游戏时现在的存档和它对得上（字数一样、位置一样）才用；对不上（存档被换过、从备份恢复过）就扔掉
  const posOf = w => (w ? [w.map, w.x, w.y, w.dir] : null);
  function walkCount(s) {
    const w = s.world || {}, m = s.mon || {}, eggs = {};
    (m.team || []).forEach(u => { const x = (m.box || []).find(q => q && q.uid === u); if (x && x.egg && typeof x.steps === 'number') eggs[u] = x.steps; });
    return [w.repel | 0, m.walk | 0, m.day && typeof m.day.steps === 'number' ? m.day.steps : -1, eggs];
  }
  function walkCountApply(s, c) {
    if (!Array.isArray(c)) return;
    const w = s.world, m = s.mon || {};
    if (typeof c[0] === 'number' && c[0] >= 0) w.repel = c[0];
    if (typeof c[1] === 'number' && c[1] >= (m.walk | 0)) m.walk = c[1];
    if (m.day && typeof c[2] === 'number' && c[2] >= (m.day.steps | 0)) m.day.steps = c[2];
    if (c[3] && typeof c[3] === 'object') (m.box || []).forEach(x => { const n = x && x.egg ? c[3][x.uid] : undefined; if (typeof n === 'number' && n > 0 && n < x.steps) x.steps = n; });   // 蛋只会越走越少；到 0 那一步孵出来时已经整份存过了
  }
  function posApply(s, raw) {
    const t = lsGet(POS), w = s.world;
    RT.posBase = posOf(w); RT.posKey = false;
    if (!t) return;
    let r = null;
    try { r = JSON.parse(t); } catch (e) { /* 坏了就不要 */ }
    const p = r && r.p;
    if (w && Array.isArray(p) && r.n === raw.length && String(r.b) === String(RT.posBase) && typeof p[0] === 'string' && p[2] >= 0 && p[3] >= 0) {
      w.map = p[0]; w.z = p[1] | 0; w.x = p[2] | 0; w.y = p[3] | 0; w.arrive = null;
      if (/^(up|down|left|right)$/.test(p[4])) w.dir = p[4];
      walkCountApply(s, r.c);
      RT.posKey = true; RT.walkDirty = true;   // 存档里还是原来的位置：下一次整份存的时候带上
    } else lsDel(POS);
  }
  function load(fallback) {
    const raw = lsGet(KEY);
    RT.lastTxt = raw || '';
    if (raw) {
      const o = parseSave(raw);
      if (o) { const s = merge(fresh(), o); posApply(s, raw); return s; }
      // 存档坏了：原样另存一份（不覆盖、能抢救），再用最近一份好的备份
      RT.badSave = true;
      lsDel(POS);   // 位置记录是跟着坏掉的那份的
      const b = bestBackup(), keep = packBig(raw);
      if (!lsSet(BAD, keep)) {   // 地方不够：腾掉最老的一份备份再存（要是正好要用它，b 里已经拿到了）
        lsDel(BAK[2]);
        if (!lsSet(BAD, keep)) RT.noSave = true;   // 连另存的地方都没有：这次先不保存，免得把坏档盖掉
      }
      { const meta = bakMeta(); meta.bad = dayStr(); lsSet(BAK_META, JSON.stringify(meta)); }   // 哪天坏的（空间紧的时候，一个月前的坏档先删）
      if (window.EchoErr) EchoErr.log('app', tr('g.save.badlog', { n: raw.length }), 'load');
      RT.restored = b ? { toString: () => b.label } : 'none';   // 读档时界面语言还没定：弹窗显示的时候（esc → String）才拼名字
      let s = fresh();
      if (b) { if (!RT.noSave && lsSet(KEY, b.txt)) RT.lastTxt = b.txt; s = merge(s, b.o); }
      RT.posBase = posOf(s.world);
      return s;
    }
    lsDel(POS);
    const s = fallback ? merge(fresh(), fallback) : fresh();
    RT.posBase = posOf(s.world);
    return s;
  }
  // 整份存档存进去了：记下存的是哪一份（lastTxt）、里面的位置；位置记录用不着了
  function saved(txt) {
    RT.lastTxt = txt; RT.posBase = posOf(S.world); RT.walkDirty = false;
    if (RT.walkTm) { clearTimeout(RT.walkTm); RT.walkTm = 0; }
    if (RT.posKey) { RT.posKey = false; lsDel(POS); }
  }
  // 整份存档：JSON.stringify + localStorage.setItem，当场写完（收服、徽章、复习、聊天、买东西……都走这里，一调用就存好了）。
  // 存档大了以后这一下不便宜（3 年的存档约 97 万字，在慢 4 倍的 CPU 上 50–110 毫秒），所以走路不走这里，见 savePos
  function save() {
    if (RT.noSave || RT.preStart) return;   // preStart：课程包模式下 start() 还没读存档（boot），这时的 S 是空白的，存了会盖掉真的存档
    let txt;
    try { txt = JSON.stringify(S); } catch (e) { if (window.EchoErr) EchoErr.log('app', tr('g.save.wlog', { msg: e.message }), 'save'); return; }
    const d = dayStr();
    if (RT.bakDay !== d) { RT.bakDay = d; dailyBackup(d, txt); }
    if (lsSet(KEY, txt)) { saved(txt); return; }
    // 存不下（空间满了）：先扔掉最老的一份备份再试
    lsDel(BAK[2]);
    if (lsSet(KEY, txt)) { saved(txt); setTimeout(storeCheck, 0); return; }
    setTimeout(storeCheck, 0);
    if (!RT.saveWarned) {
      RT.saveWarned = true;
      if (window.EchoErr) EchoErr.log('app', tr('g.save.fulllog'), 'save');
      // 第一次存不进去就说一声（只说一次）：不然孩子每次玩的进度都悄悄丢了
      setTimeout(() => {
        const t = tr('g.save.full');
        if ($('#modal').hidden) openModal('<div class="big">💾</div><h2>' + tr('g.save.full.h') + '</h2><p>' + t + '</p><button class="btn wide" data-act="close" data-focus>' + tr('g.ok') + '</button>');
        else toast('💾 ' + t);
      }, 0);
    }
  }
  // 每天第一次保存前：上一份存档 → bak1（原来的往后挪）；APK 往手机「下载/EchoIsland」写一份
  function dailyBackup(d, txt) {
    const meta = bakMeta();
    if (meta.day !== d) {
      const cur = lsGet(KEY);
      if (parseSave(cur)) {   // 坏的不往备份里放
        const v1 = lsGet(BAK[0]), v2 = lsGet(BAK[1]);
        if (v2) lsSet(BAK[2], packBig(v2));
        if (v1) lsSet(BAK[1], packBig(v1));
        lsSet(BAK[0], packBig(cur));   // 大存档压着放（约六分之一），不然 3 份备份就把 localStorage 占掉一大半
        meta.d3 = meta.d2; meta.d2 = meta.d1; meta.d1 = meta.day || '';   // 上一份存档最后是哪天存的
      }
      meta.day = d;
      lsSet(BAK_META, JSON.stringify(meta));
      setTimeout(storeCheck, 1500);   // 备份换过了：看一眼空间还够不够
    }
    nativeBackup(txt);
  }
  function nativeBackup(txt) {
    // 别的课不往手机「下载/EchoIsland」写（文件名是原生按日期定的，分不出语言：同一天会把英语课的那份盖掉）。ENGINE.md 末尾「和规格不一样的地方」
    if (!nat('backupWrite') || LANG) return;
    try { if (EchoNative.backupWrite(txt || JSON.stringify(S))) RT.natBakAt = Date.now(); } catch (e) { /* 写不了就算了，本机还有 3 份 */ }
  }

  // ---------- 走路只记位置（存档大了以后，每走一步就整份存一次会一步一卡）----------
  // world.js 每走一步调 savePos()：S.world 里的 map / x / y / dir 它已经改好了。
  // 存档还小（不到 WALK_FULL_MAX 字，整份存一次只要几毫秒）：照老办法每一步都整份存——最简单，localStorage 里永远是最新的。
  // 存档大了：这里只往 KEY-pos 写一条一百来个字的记录（位置 + 喷雾还剩几步、走了几步、蛋还要走几步），存档再大也不费事，
  // 被杀掉也不丢位置。整份存档等下面这些时候：
  //   停下来 1 秒（WALK_FOLD_MS）· 换地图 · 开战前 / 离开大地图（show）· 切到后台、页面关掉、被系统冻住 · 返回键退出 ·
  //   任何一次 save()（对话、捡东西、剧情……，还有下面记学习时间的定时器每分钟那一次）
  const WALK_FOLD_MS = 1000, WALK_FULL_MAX = 60000;
  function savePos() {
    if (RT.noSave || !S) return;
    if (RT.lastTxt.length < (RT.walkFull != null ? RT.walkFull : WALK_FULL_MAX)) { save(); return; }   // RT.walkFull：测试用，0 = 小存档也只记位置
    const w = S.world;
    RT.walkDirty = true;
    if (lsSet(POS, JSON.stringify({ n: RT.lastTxt.length, b: RT.posBase, p: [w.map, w.z, w.x, w.y, w.dir], c: walkCount(S) }))) RT.posKey = true;
    clearTimeout(RT.walkTm);
    RT.walkTm = setTimeout(() => { RT.walkTm = 0; flushWalk(true); }, WALK_FOLD_MS);
  }
  // 又迈出一步（world.js 的 step()）：还在走，「停下来 1 秒」重新算——别在走到半路的时候整份存（那一下会掉帧）
  function walkTouch() {
    if (!RT.walkTm) return;
    clearTimeout(RT.walkTm);
    RT.walkTm = setTimeout(() => { RT.walkTm = 0; flushWalk(true); }, WALK_FOLD_MS);
  }
  // 把走路攒下的整份存一次；没攒着就什么都不做。返回存了没有。
  // soft = 顺手存的（停下来、切后台、定时）：这时候 localStorage 里的存档要是已经不是游戏上次写的那份
  // （另一个标签页写过、测试脚本换过存档正要重新打开），就不去盖它
  function flushWalk(soft) {
    if (!RT.walkDirty || RT.noSave || !S) return false;
    if (soft && (lsGet(KEY) || '') !== RT.lastTxt) return false;
    save();
    return !RT.walkDirty;
  }

  // ---------- 存档空间：快满之前先说 ----------
  // localStorage 里一共用了多少字（键 + 值）。配额按最坏的算（中文一个字占 2 字节，约 524 万字）
  function lsUsage() {
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* 读不了就当没有 */ }
    return n;
  }
  const lsQuota = () => RT.lsQuota || LS_QUOTA_NOW;   // 测试里可以把配额改小
  // 每天换完备份、打开游戏、存不进去的时候看一眼：
  //   60% 以上：没压的备份压一下；一个月以前的坏档、「恢复前 / 清空前」那份删掉；
  //   90% 以上：最老的两份备份和坏档也删（最近一份备份、手机「下载/EchoIsland」里的都还在）；
  //   还在 80% 以上：首页挂一条「存档空间快满了」，请家长导出存档（homeBars / storeInfo）
  function storeCheck() {
    if (!S) return null;
    const q = lsQuota(), meta = bakMeta(), old = d => !d || dayDiff(String(d), dayStr()) > 30;
    let used = lsUsage();
    if (used > q * .6) {
      [BAD, PRE].concat(BAK).forEach(k => { const v = lsGet(k); if (v) { const pk = packBig(v); if (pk !== v) lsSet(k, pk); } });
      if (lsGet(BAD) && old(meta.bad)) lsDel(BAD);
      if (lsGet(PRE) && old(meta.pre)) lsDel(PRE);
      used = lsUsage();
    }
    if (used > q * .9) {
      [BAK[2], BAK[1], BAD].forEach(lsDel);
      used = lsUsage();
      if (window.EchoErr && !RT.storeCut) { RT.storeCut = true; EchoErr.log('app', tr('g.store.cutlog'), 'store'); }
    }
    RT.store = { used, quota: q, pct: Math.round(used / q * 100), warn: used > q * .8 };
    if (RT.store.warn && !RT.storeLogged) { RT.storeLogged = true; if (window.EchoErr) EchoErr.log('app', tr('g.store.pctlog', { pct: RT.store.pct, n: used }), 'store'); }
    refreshBars();
    return RT.store;
  }
  function storeInfo() {
    const st = storeCheck();
    if (!st || !st.warn) return;
    openModal('<div class="big">💾</div><h2>' + tr('g.store.h') + '</h2>' +
      trh('g.store.p1', { pct: st.pct }) +
      trh('g.store.p2') +
      '<div class="row"><button class="btn ghost" data-act="parentSet">' + tr('g.bar.parent') + '</button><button class="btn" data-act="close" data-focus>' + tr('g.ok') + '</button></div>');
  }

  let S = fresh();
  const RT = { srBroken: false, noRec: false, rec: null, mr: null, recUrl: '', listening: false, recording: false, lastRest: Date.now(), resetArm: false, scrollCur: true,
    pin: null, pinPass: null, parentUntil: 0, parentOpen: false, lastAct: null, advStop: '', battleEnd: 0, fakeNow: 0, fakeAt: 0, pushTry: 0,
    // AI 打分用不了（aiNote）：aiFails 连着失败几次、aiFailAt 最近一次、aiBar 首页红条 { cls, why, at }、aiOkAt 最近一次成功
    aiFails: 0, aiFailAt: 0, aiBar: null, aiOkAt: 0,
    // 存档：badSave 读到坏档、restored 用了哪份备份（'none' = 一份好的都没有）、noSave 这次不保存、bakDay 今天轮换过备份没有、natBakAt 最近往手机写备份的时间
    badSave: false, restored: '', noSave: false, bakDay: '', natBakAt: 0,
    // 走路只记位置（savePos / flushWalk）：lastTxt 游戏上次写进（或读出）localStorage 的那份存档原文、posBase 那份存档里的位置、
    // posKey 现在有没有 KEY-pos、walkDirty 走了路还没整份存、walkTm 停下来 1 秒后整份存的定时器；
    // store 最近一次量的存档空间 { used, quota, pct, warn }、lsQuota 测试用的假配额
    lastTxt: '', posBase: null, posKey: false, walkDirty: false, walkTm: 0, walkFull: null, store: null, lsQuota: 0 };
  let P = null; // 当前关卡
  // 2026-11-19（给所有人用）——界面语言：画面上的字从 i18n.js 的字表里取（tr / trh 在文件开头）
  if (window.EchoI18n) EchoI18n.use(() => (S && S.settings && S.settings.ui) || 'zh');
  // 谁在学：'kid' 孩子（老存档、家庭版都是：学习锁、冒险限时、家长密码）/ 'open' 青少年和成人自己学（这三样都没有，别的一样）
  const kidMode = () => S.settings.learner !== 'open';
  // 按能力走（做过能力检测、课程选的是「按能力」）时现在是第几级；不是就返回 null，一切照旧。分级和内容对照表在 levels.js
  const PLV = () => (window.EchoPlace && S.settings.track === 'level' && S.place && S.place.lv >= 0 ? S.place.lv : null);

  // ---------- 日期 / 连续打卡 ----------
  const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  function checkStreak() {
    if (!S.lastDay) return;
    const d = dayDiff(S.lastDay, dayStr());
    if (d <= 1) return;
    if (d === 2 && S.freeze > 0 && S.streak > 0) {
      S.freeze--;
      S.lastDay = dayStr(new Date(Date.now() - 864e5));
      setTimeout(() => toast(tr('g.streak.keep', { n: S.streak }), 'gold'), 600);
    } else if (S.streak > 0) {
      const lost = S.streak;
      S.streak = 0;
      setTimeout(() => toast(tr('g.streak.lost', { n: lost })), 600);
    }
    save();
  }
  function markToday() {
    const t = dayStr();
    if (S.lastDay === t) return false;
    const d = S.lastDay ? dayDiff(S.lastDay, t) : 99;
    S.streak = d === 1 ? S.streak + 1 : 1;
    S.lastDay = t;
    return true;
  }

  // ---------- 等级 ----------
  function lvInfo(xp) {
    let lv = 1, need = 100, x = xp;
    while (x >= need) { x -= need; lv++; need = 100 + (lv - 1) * 40; }
    return { lv, cur: x, need };
  }
  const titleOf = lv => TITLES.filter(t => t[0] <= lv).pop()[1];

  // ---------- 音效（WebAudio 合成，无需文件） ----------
  let AC = null;
  function ac() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, t0, dur, type, vol) {
    if (!S.settings.sfx) return;
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    ok(c) { const b = 523 * Math.pow(1.059, Math.min(c, 14)); tone(b, 0, .12, 'triangle', .16); tone(b * 1.26, .07, .12, 'triangle', .16); tone(b * 1.5, .14, .22, 'triangle', .16); },
    bad() { tone(233, 0, .16, 'sawtooth', .06); tone(174, .13, .26, 'sawtooth', .06); },
    star(i) { tone(784 * Math.pow(1.19, i), 0, .35, 'sine', .2); tone(1568 * Math.pow(1.19, i), .02, .25, 'sine', .06); },
    coin() { tone(988, 0, .08, 'square', .05); tone(1319, .07, .22, 'square', .05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .3, 'triangle', .16)); tone(1047, .5, .6, 'sine', .12); },
    hit() { tone(140, 0, .18, 'square', .1); tone(90, .06, .25, 'sawtooth', .08); },
    tap() { tone(700, 0, .05, 'sine', .05); },
  };
  // ---------- 配乐（music.js 现场合成；这里决定什么时候放哪首） ----------
  // 设置「音乐」关 / 小 / 中 / 大；大地图和战斗的曲子由 world.js / monsters.js 选，这里管首页和练习
  const MVOL = { off: 0, low: 0.35, mid: 0.6, high: 0.85 };
  const MUS = () => window.EchoMusic || null;
  const musicOn = () => !!MUS() && S.settings.music !== 'off' && MUS().state().enabled;
  function music(id) { const m = MUS(); if (m && id !== undefined) m.play(id); }
  // 一次性的小音乐（胜利、收服、恢复……）；音乐关着或者放不了时，用原来的音效 sfx 代替
  function jingle(id, sfx) {
    if (musicOn()) return MUS().jingle(id);
    if (sfx) sfx();
    return Promise.resolve();
  }
  function musicVol() { const m = MUS(); if (m) m.setVolume(MVOL[S.settings.music] != null ? MVOL[S.settings.music] : MVOL.mid); }
  // 这个画面该放哪首：首页放主题曲，闯关练习 / 复习 / 对话剧场放学习音乐，大地图问 EchoWorld，战斗由 monsters.js 开战时选好
  function sceneMusic() {
    // 能力检测、首次设置时不放背景音乐：听力题要听得清，而且这两个画面进不了设置、关不掉（老板 2026-11-20 在 iPhone 上做检测时提的）。
    // 两个画面开 / 关的时候各自再调一次这里（placement.js 的 mount / unmount、setup.js 的 open / close）
    if ((window.EchoPlace && EchoPlace.isOpen && EchoPlace.isOpen()) || (window.EchoSetup && EchoSetup.isOpen && EchoSetup.isOpen())) { music(''); return; }
    const s = RT.scr;
    if (s === 'world') { const id = window.EchoWorld && EchoWorld.music ? EchoWorld.music() : ''; if (id) music(id); return; }
    if (s === 'battle') return;
    music(s === 'home' ? 'title' : 'study');
  }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 不支持 */ } }

  // ---------- 朗读：提前合成的自然配音（打包在 assets/voice）→ 阿里云现场合成（qwen3-tts-flash）→ 浏览器自带的英语声音 ----------
  // 不再用有道的在线发音接口（评估「必须改」第 7 条：非公开接口，没有商用授权）。APK 的 WebView 没有本机声音：配音和阿里云都不行时就不出声
  const TTS = { voices: [], v: null, ok: 'speechSynthesis' in window, loaded: false };
  const PREF = [/(Aria|Jenny|Ava|Emma|Guy).*(Online|Natural)/i, /Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Zira|David)/i, /Google UK English Female/i, /Karen|Daniel|Moira|Tessa/i];
  // ---------- 自然配音：tools/voice/gen.py 用本机开源模型 Kokoro（Apache-2.0）提前合成的固定句子（assets/voice/{f,m}/<key>.ogg，Opus） ----------
  // 文件名是规范化文本的 FNV-1a 哈希，和 tools/voice/key.js 一样；没合成的句子（拼了名字的）联网时用阿里云现场合成，再不行用本机声音
  const CLIP = { f: new Set(), m: new Set() };
  // 课程包模式（packs.js，tools/pack/SPEC.md §5）：配音不在安装包里，问 EchoPacks（下载到这台设备上的）；老模式（EchoPacks.on 是 false）这一段一个字没变
  const PK = () => !!(window.EchoPacks && EchoPacks.on);
  function clipKey(t) {
    // 和 tools/voice/key.js 一样：表情符号不念，去掉再算
    const s = String(t).replace(/[\p{Extended_Pictographic}\u200D\uFE0F]/gu, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  // 配音是 Opus/Ogg：老 iOS Safari 放不了，就当没有打包配音（走阿里云 → 本机声音）
  const OGG_OK = (() => { try { return !!new Audio().canPlayType('audio/ogg; codecs="opus"'); } catch (e) { return false; } })();
  try {
    if (OGG_OK && location.protocol !== 'file:' && !PK()) fetch('assets/voice/index.json').then(r => (r.ok ? r.json() : null)).then(j => { if (j) { CLIP.f = new Set(j.f || []); CLIP.m = new Set(j.m || []); } }).catch(() => {});
  } catch (e) { /* file:// 打开时读不了，就不用配音 */ }
  function clipUrl(text, g) {
    const k = clipKey(text);
    for (const x of g === 'm' ? ['m', 'f'] : ['f', 'm']) if (CLIP[x].has(k)) return 'assets/voice/' + x + '/' + k + '.ogg';
    return '';
  }
  // 课程包模式：这句装好了没有（先要的那个声音，没有就另一个）→ [key, 声音] 或 null
  function packClip(text, g) {
    if (!OGG_OK) return null;
    const k = clipKey(text);
    for (const x of g === 'm' ? ['m', 'f'] : ['f', 'm']) if (EchoPacks.hasClip(k, x)) return [k, x];
    return null;
  }
  const FEM = /female|samantha|aria|jenny|ava|emma|zira|karen|moira|tessa|serena|victoria|allison|susan|libby|sonia|natasha|michelle|joanna|salli|kendra|fiona|kate/i;
  const MALE = /\bmale|daniel|david|guy|alex|fred|mark|ryan|aaron|arthur|george|thomas|oliver|christopher|eric|roger|brian|matthew|justin|rishi/i;
  const genderOf = v => !v ? '' : /female/i.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : FEM.test(v.name) ? 'f' : '';
  function loadVoices() {
    if (!TTS.ok) return;
    const all = speechSynthesis.getVoices();
    if (all.length) TTS.loaded = true;
    TTS.voices = LANG ? all.filter(v => LANG.tts.web.test(v.lang)) : all.filter(v => /^en([-_]|$)/i.test(v.lang));   // 别的课：挑那门语言的本机声音
    pickVoice();
  }
  function pickVoice() {
    const vs = TTS.voices;
    TTS.v = vs.find(v => v.name === S.settings.voice) || PREF.map(p => vs.find(v => p.test(v.name))).find(Boolean) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs[0] || null;
    const pool = [TTS.v, ...vs.filter(v => /en[-_]US/i.test(v.lang)), ...vs].filter(Boolean);
    TTS.vf = pool.find(v => genderOf(v) === 'f') || null;
    TTS.vm = pool.find(v => genderOf(v) === 'm') || null;
  }
  // 能不能用本机（浏览器自带）的英语声音：设置「只用配音」时不用；没有英语声音、合成失败过也不用
  const deviceOk = () => S.settings.tts !== 'online' && TTS.ok && !RT.ttsBroken && !(TTS.loaded && !TTS.voices.length);
  // 能不能请阿里云现场合成：设置「本机声音」时不用；要联网、有 AI 连接（APK 有密钥 / 网页版连得上中转服务），连续失败 3 次就这次打开游戏不再试
  const cloudOk = () => S.settings.tts !== 'device' && navigator.onLine !== false && !!(window.EchoTalk && EchoTalk.cloudTTS && EchoTalk.cloudSR && EchoTalk.cloudSR()) && !RT.cloudTTSBroken;
  function endPlaying() { $$('.spk.playing').forEach(b => b.classList.remove('playing')); }
  function startPlaying() { const main = $('#p-body .spk:not(.mini)'); if (main) main.classList.add('playing'); }
  // 没有能用的声音（没有配音、连不上阿里云、也没有本机声音）：不出声，APK 里第一次提醒一下。
  // 按句子长短停一小会儿再算「读完」（背景音乐照样压低这一会儿），对话、剧场的节奏和有声音时差不多
  function silent(res, text) {
    endPlaying();
    if (!RT.ttsWarned && window.ECHO_APP) { RT.ttsWarned = true; toast(tr('g.tts.silent')); }
    setTimeout(res, Math.min(1500, 200 + String(text || '').length * 20));
  }
  // 放一段音频（配音文件或阿里云合成的地址）；放不出来就 onFail()（没给就不出声）
  function playUrl(text, rate, res, g, url, onFail) {
    const a = RT.audio || (RT.audio = new Audio());
    let done = false;
    const fin = () => { if (done) return; done = true; endPlaying(); res(); };
    const t = setTimeout(fin, 4000 + text.length * 200);
    a.onended = fin;
    a.onerror = () => {
      if (done) return;
      done = true; clearTimeout(t);
      if (onFail) onFail(); else silent(res, text);
    };
    a.src = url;
    // 语速，音高不变：点了 🐢（给的语速比 0.75 慢，各处是 0.6 / 对话动画 0.65）就照它放，最慢 0.5；
    // 别的时候，设置「朗读速度：慢」（WORDS.md §11）是 0.8，不然 1。
    // （2026-11-23 老板：「慢速，并不慢」——以前 🐢 的 0.6 被夹成 0.75，零基础默认又是 0.8，两个几乎一样）
    // 2026-11-24 复查：以前「慢」只管没给语速的那几处；对战的题目和「听一下答案」、大地图对话框的「再听一遍」、对话动画的台词
    // 都带着 0.8–0.9 的语速来，结果照正常速度放——开着「慢」，再听一遍反而比第一遍快。现在开着「慢」的时候一律不比 0.8 快
    const want = rate || S.settings.rate, r = want < 0.75 ? Math.max(0.5, want) : slowOn() ? 0.8 : 1;
    // iPhone：换 src 以后加载时会把 playbackRate 换回 defaultPlaybackRate，两个都设，开始放的时候再对一次
    try { a.defaultPlaybackRate = r; } catch (e) { /* 老浏览器没有 */ }
    a.playbackRate = r;
    a.onplaying = () => { if (Math.abs(a.playbackRate - r) > 0.01) a.playbackRate = r; };
    try { a.preservesPitch = true; a.webkitPreservesPitch = true; } catch (e) { /* 老浏览器没有 */ }
    startPlaying();
    const pr = a.play();
    // 被下一句打断（AbortError：翻单词卡、连着点 🔊 时上一句还没放完）不是「要点一下才能出声」，不提示
    if (pr && pr.catch) pr.catch(e => { if (!done && !(e && e.name === 'AbortError')) toast(tr('g.tts.tap')); fin(); });
  }
  // g：对话角色的声音 'f' / 'm'；不传就用默认声音。朗读的时候把背景音乐压低，读完恢复
  // 只认最新的一句：新的一句打断旧的时，旧的那句晚一点才结束也不会提前把音乐放回来
  let duckTok = null;
  // own（别的课才看）：这句本来就是这门语言的话（聊天里的示范句、词卡，talk.js 给），不在条目表里也照这门语言念
  function say(text, rate, g, own) {
    if (!text) return Promise.resolve();
    // 别的课（ENGINE.md §5）：只念这门课的内容（条目表里有的、课程包里有配音的）；代码里写死的英语台词、喊话只给人看、不念——
    // 停一小会儿再算「读完」（和没有声音时一样），剧情、对战的节奏不变
    // 有台词翻译表（SPEC §8）的：念翻好的那句（课程包里有配音就放配音，没有用本机声音）
    if (LANG && !own && !entryOf(text) && !(PK() && packClip(text, g))) {
      const ln = lineOf(text);
      if (!ln) return new Promise(res => setTimeout(res, Math.min(1500, 200 + String(text).length * 20)));
      text = ln.t;
    }
    const m = MUS(), tok = {};
    if (m) { if (!duckTok) m.duck(true); duckTok = tok; }
    return sayRaw(text, rate, g).then(() => { if (m && duckTok === tok) { duckTok = null; m.duck(false); } });
  }
  function sayRaw(text, rate, g) {
    return new Promise(res => {
      if (!text) return res();
      stopListening();
      if (TTS.ok) speechSynthesis.cancel();
      if (RT.audio) RT.audio.pause();
      const id = RT.sayId = (RT.sayId || 0) + 1;
      // 课程包模式：装好了的那段从数据库读出来（blob: 地址）再放；没装好 / 读不出来照旧往下走（阿里云 → 本机声音）
      if (PK()) {
        // 没有配音：现场合成（别的课只在服务器认这门语言时，见 sayCloud），不行再用本机声音
        const next = () => sayCloud(text, rate, res, g, id);
        const pc = S.settings.tts === 'device' ? null : packClip(text, g);
        if (!pc) { next(); return; }
        EchoPacks.clip(pc[0], pc[1]).then(url => {
          if (RT.sayId !== id) return res();   // 读的时候已经换了别的句子
          if (url) playUrl(text, rate, res, g, url, next);
          else next();
        });
        return;
      }
      const clip = S.settings.tts === 'device' ? '' : clipUrl(text, g);
      // 配音文件没加载出来（APK 里不会，网页版断网时可能）：当成没有配音的句子
      if (clip) { playUrl(text, rate, res, g, clip, () => sayCloud(text, rate, res, g, id)); return; }
      sayCloud(text, rate, res, g, id);
    });
  }
  // 没有提前配音的句子（带名字的台词等）：能连阿里云就现场合成（约 1–2 秒，同一句只合成一次），不行再用本机声音
  // 别的课：合成带上这门语言（LANG.tts.cloud）；服务器不认这门语言（云端模式看 GET /v1/me 的 speechLangs、网页版的中转服务一律不走）就直接用本机声音
  function sayCloud(text, rate, res, g, id) {
    if (LANG && cloudOk() && !(EchoTalk.speechLang && EchoTalk.speechLang(LANG.tts.cloud, 'tts'))) { sayDevice(text, rate, res, g); return; }
    if (!cloudOk()) {
      // 自动化测试时记下没有配音的句子（tools/voice/misshook.js 收集，再补合成）
      if (navigator.webdriver && S.settings.tts !== 'device') { try { console.log('[voice-miss]' + JSON.stringify([text, g || ''])); } catch (e) {} }
      sayDevice(text, rate, res, g);
      return;
    }
    EchoTalk.cloudTTS(text, g, LANG ? LANG.tts.cloud : undefined).then(url => {
      if (RT.sayId !== id) return res();   // 等合成的时候已经换了别的句子
      if (url) { RT.cloudTTSFails = 0; playUrl(text, rate, res, g, url, () => sayDevice(text, rate, res, g)); return; }
      RT.cloudTTSFails = (RT.cloudTTSFails || 0) + 1; if (RT.cloudTTSFails >= 3) RT.cloudTTSBroken = true;
      sayDevice(text, rate, res, g);
    });
  }
  // 本机（浏览器自带）的英语声音；用不了就不出声
  // iPhone 版启动时没查本机声音（见 start()）：第一次真要用时再查
  function voicesNow() { if (window.ECHO_IOS && !TTS.loaded) { loadVoices(); TTS.loaded = true; } }
  function sayDevice(text, rate, res, g) {
    voicesNow();
    if (!deviceOk()) { silent(res, text); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = g === 'f' ? (TTS.vf || TTS.v) : g === 'm' ? (TTS.vm || TTS.v) : TTS.v;
    if (v) u.voice = v;
    u.lang = v ? v.lang : LANG ? LANG.asr.web : 'en-US';
    // 找不到对应性别的声音时，用音调区分两个角色
    if (g && genderOf(v) !== g) u.pitch = g === 'm' ? 0.75 : 1.3;
    u.rate = slowOn() ? Math.min(rate || S.settings.rate, 0.8) : rate || S.settings.rate;   // 「朗读速度：慢」：本机声音最快 0.8（特意给了语速的也一样）
    let done = false;
    const fin = () => { if (done) return; done = true; endPlaying(); res(); };
    u.onend = fin;
    u.onerror = e => {
      // 被新的朗读打断不算失败；真失败了：这次起不用本机声音
      if (!done && e && e.error && !/interrupted|canceled/.test(e.error)) { RT.ttsBroken = true; done = true; silent(res, text); return; }
      fin();
    };
    setTimeout(fin, 1800 + text.length * 150 / u.rate);
    startPlaying();
    speechSynthesis.speak(u);
  }
  // iOS / 微信要求第一次出声必须在点击里：点击时先“解锁”两种发音方式
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function primeTTS() {
    if (RT.primed) return;
    RT.primed = true;
    if (TTS.ok) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* 忽略 */ } }
    try { RT.audio = RT.audio || new Audio(); RT.audio.src = silentWav(); const p = RT.audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 忽略 */ }
  }

  // ---------- 语音识别 + 评分 ----------
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  const FATAL = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'];
  const canRecord = () => !RT.noRec && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  // 安卓 APK：WebView 里没有能用的浏览器语音识别 → 有阿里云密钥就录一句交给阿里云识别（talk.js listenOnce），连不上两次就改回录音自评
  const cloudSR = () => !!(window.EchoTalk && EchoTalk.cloudSR && EchoTalk.cloudSR()) && !RT.cloudBroken;
  // iPhone：口语题先用手机自带的本机识别（talk.js localSR，2026-11-20）——不联网、不用登录、不算 AI 额度；开不起来同一次里改走云端
  const localSR = () => !!(window.EchoTalk && EchoTalk.localSR && EchoTalk.localSR());
  // 口语默认「开口 + AI 打分」：APK 一律开口（没网就提示联网后再说，不会改成自评）；
  // 网页版连得上中转服务就用阿里云识别，否则用浏览器自带的识别，都没有才退回录音自评。「录音自评」只留给 ?quiet 测试链接
  function speakMode() {
    if (S.settings.mode === 'self') return 'self';
    if (cloudSR() || window.ECHO_APP) return 'sr';
    if (!SRC || RT.srBroken) return 'self';
    return 'sr';
  }
  // AI 老师点评：没说好（低于 90 分）时，把目标句子和听到的话交给 AI，给一句中文建议，接在「我听到」后面
  function aiTip(target, heard, el) {
    // 别的课（TALK.md 第二轮）：服务器会用这门语言写点评（它的 tipLangs 里有这门语言，talk.js 的 tipOk）才出，请求里带上语言；
    // 不会（老服务器没有这个字段、APK 直连）：和以前一样没有点评
    if (LANG && !(window.EchoTalk && EchoTalk.tipOk && EchoTalk.tipOk())) return;
    if (!heard || !el || !window.EchoTalk || !EchoTalk.aiTip) return;
    try { const L = dayLog(); L.tipN = (L.tipN || 0) + 1; } catch (e) { /* 周报用的计数 */ }
    EchoTalk.aiTip(target, heard).then(tip => { if (tip && el.isConnected && !el.querySelector('.ai-tip')) el.insertAdjacentHTML('beforeend', '<span class="ai-tip">💡 ' + esc(tip) + ' <i class="ai-mark" title="' + esc(tr('g.sr.aimark')) + '">AI</i></span>'); });   // AI 生成的点评标上「AI」
  }
  // 麦克风在听的时候背景音乐完全静音（不然会被录进去，影响 AI 打分），正在放的朗读也停掉（别让识别听到示范读音）
  // targets：这道题的答案（可以几个）。实时识别的结果一和答案对上（90 分以上，而且最后一个词也说出来了，见 earlyMatch）就立刻结束，不用等孩子停顿——「秒出分」
  // 返回 { alts: 听到的几种说法, err, fail, why }。fail 是没听到时的原因（家长 2026-10-07，评估第 3 条）：
  //   'mic' 麦克风被拒（APK 里顺手弹出说明和「去打开」）、'net' 没网、'key' 密钥不对 / 额度用完 / 太频繁（401/403/429/Arrearage/quota）、
  //   'nokey' APK 里还没有 AI 密钥、'unheard' 真的没听清（没出声、太小声、识别出来是空的，算一次尝试）、'stop' 自己点了停
  // opts（能力检测的口语问答题用）：{ maxMs 最长录多久, long: true 说几句话、句子中间可以停一停 }
  function recognize(onInterim, targets, opts) {
    const m = MUS(); if (m) m.hold(true);
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const t0 = Date.now(), cloud = cloudSR();
    return recognizeRaw(onInterim, targets, opts).then(r => { if (m) m.hold(false); const s = srDay(t0); if (cloud && !(s && s.eng === 'device')) logAsr(t0); return r; });
  }
  // 这一次用的是本机还是云端识别（talk.js 的计时记录）：周报诊断一行。本机识别不算 AI 用量（上面的 logAsr 只记云端的）
  function srDay(t0) {
    try {
      const s = window.EchoTalk && EchoTalk.lastSpeech ? EchoTalk.lastSpeech() : null;
      if (!s || s.at < t0) return null;
      const L = dayLog();
      if (s.eng === 'device') { L.srDev = (L.srDev || 0) + 1; if (s.ok && s.lag != null) { L.srLag = (L.srLag || 0) + s.lag; L.srLagN = (L.srLagN || 0) + 1; } }
      else if (s.eng === 'cloud') L.srCloud = (L.srCloud || 0) + 1;
      if (s.fell) L.srFell = (L.srFell || 0) + 1;
      return s;
    } catch (e) { return null; }
  }
  // 周报的 AI 用量：用阿里云识别了几次、大约几秒（估算花费）。失败的次数和原因在 aiNote 里记
  function logAsr(t0) {
    try {
      const L = dayLog();
      L.asrN = (L.asrN || 0) + 1;
      L.asrSec = +((L.asrSec || 0) + Math.min(30, (Date.now() - t0) / 1000)).toFixed(1);
    } catch (e) { /* 只是记录，出错不影响打分 */ }
  }
  // listenOnce 的结果 → fail 的种类（talk.js 的 why：offline / network 算没网；auth / quota / busy / code 算密钥和额度）
  function failOf(r) {
    if (!r || r.text) return '';
    if (r.err === 'nokey') return 'nokey';   // iPhone 的本机识别开不起来、云端又没有密钥 / 没登录
    if (r.err === 'not-allowed' || r.err === 'audio-capture') return 'mic';
    if (r.err === 'network') return r.why === 'offline' || r.why === 'network' || !r.why ? 'net' : 'key';
    if (r.err === 'aborted') return 'stop';
    return 'unheard';
  }
  // 别的课在云端模式里：服务器认这门语言（GET /v1/me 的 speechLangs，account.js）就走服务器的识别（带上 LANG.asr.cloud）；
  // 不认（老服务器、还没登录拿不到账号信息）时 iPhone 的本机识别又用不了，口语题按「AI 用不了」走（先跳过、进复习，ENGINE.md §6）
  const langSrv = () => !!LANG && !!(window.EchoTalk && EchoTalk.speechLang && EchoTalk.speechLang(LANG.asr.cloud, 'asr'));
  const langNoCloud = () => !!LANG && cloudOn() && !localSR() && !langSrv();
  function recognizeRaw(onInterim, targets, opts) {
    if (langNoCloud() && S.settings.mode !== 'self') { aiNote('nokey'); return Promise.resolve({ alts: [], err: 'nokey', fail: 'nokey', why: 'lang' }); }
    // 云端模式还没登录：不开麦克风，走「AI 用不了」那条路；第一次碰到时弹一次「登录，每天免费用 AI」（不是报错）
    // iPhone 的本机识别能用（localSR）：不登录、没网也能打分，不走这条
    if (cloudOn() && S.settings.mode !== 'self' && aiNoKey() && !localSR()) { RT.cloudAsked = true; aiNote('nokey'); if (ACC()) ACC().nudge(); return Promise.resolve({ alts: [], err: 'nokey', fail: 'nokey', why: 'signin' }); }
    if (cloudSR() || localSR()) {
      RT.listening = true;
      const tg = (targets || []).filter(Boolean);
      // 别的课：识别的语言（本机 / 云端）、「短的」怎么算、聊天里数词的办法都交给 LANG；云端模式里服务器不认这门语言就不许改走云端识别（noCloud）
      const lo = LANG ? { lang: LANG.asr, head: LANG.head, count: LANG.countUnits, noCloud: cloudOn() && !langSrv() } : null;
      return EchoTalk.listenOnce(Object.assign({ onState: onInterim, match: tg.length ? t => tg.some(x => earlyMatch(x, t)) : null, short: tg.length > 0 && tg.every(x => (LANG ? LANG.short(x, entryOf(x)) : x.trim().split(/\s+/).length <= 2)) },
        opts && opts.maxMs ? { maxMs: opts.maxMs } : null, opts && opts.long ? { long: true } : null, lo)).then(r => {
        RT.listening = false;
        r = r || {};
        const fail = failOf(r);
        // 本机识别开不起来、云端又用不了（没有密钥 / 没登录）：和上面没有 AI 时一样（先跳过；云端模式请他登录一次）
        if (fail === 'nokey') { if (cloudOn() && r.why !== 'lang') { RT.cloudAsked = true; if (ACC()) ACC().nudge(); } aiNote('nokey'); return { alts: [], err: 'nokey', fail, why: r.why || 'nokey' }; }
        if (fail === 'mic') {
          if (window.ECHO_APP) { micBlocked(r.why); return { alts: [], err: 'mic', fail, why: r.why || '' }; }   // APK 必须开口：说明为什么要麦克风 +「去打开」
          RT.cloudBroken = true;   // 网页版：退回浏览器识别 / 录音自评
          return { alts: [], err: r.err, fail, why: r.why || '' };
        }
        if (fail === 'net' || fail === 'key') {
          aiNote(fail, r.why);
          if (!window.ECHO_APP && (RT.cloudFails = (RT.cloudFails || 0) + 1) >= 2) { RT.cloudBroken = true; toast(tr('g.sr.cloud')); }
          return { alts: [], err: 'no-speech', fail, why: r.why || '' };
        }
        if (r.text) { aiNote('ok'); RT.cloudFails = 0; }
        return { alts: r.text ? [r.text] : [], err: r.err === 'network' || r.err === 'busy' ? 'no-speech' : r.err || null, fail, eng: r.eng || '' };
      });
    }
    // APK 里没有 AI 密钥：WebView 没有能用的浏览器识别，也不退回自评——走「AI 用不了」的出路（先跳过、放进复习）
    if (window.ECHO_APP && S.settings.mode !== 'self') { aiNote('nokey'); return Promise.resolve({ alts: [], err: 'nokey', fail: 'nokey', why: 'nokey' }); }
    return new Promise(resolve => {
      let r;
      try { r = new SRC(); } catch (e) { return resolve({ alts: [], err: 'service-not-allowed' }); }
      r.lang = LANG ? LANG.asr.web : 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
      let alts = [], err = null, finished = false;
      const end = () => {
        if (finished) return;
        finished = true; clearTimeout(t1); clearTimeout(t2); RT.rec = null; RT.listening = false;
        resolve({ alts, err });
      };
      r.onresult = e => {
        const rs = Array.from(e.results);
        const main = rs.map(x => x[0].transcript).join(' ').trim();
        if (onInterim) onInterim(main);
        const set = [main];
        if (rs.length === 1) for (let k = 1; k < rs[0].length; k++) set.push(rs[0][k].transcript);
        alts = set.filter(Boolean);
      };
      r.onerror = e => { err = e.error; };
      r.onend = end;
      const t1 = setTimeout(() => { try { r.stop(); } catch (e) { /* 忽略 */ } }, 10000);
      const t2 = setTimeout(end, 13000);
      RT.rec = r; RT.listening = true;
      try { r.start(); } catch (e) { err = 'start-failed'; end(); }
    });
  }
  function stopListening() {
    if (window.EchoTalk && EchoTalk.stopListen) EchoTalk.stopListen();
    if (RT.rec) { try { RT.rec.stop(); } catch (e) { /* 忽略 */ } }
    if (RT.mr && RT.recording) { try { RT.mr.stop(); } catch (e) { /* 忽略 */ } }
  }

  // ---------- AI 打分用不了时别让孩子卡死（家长 2026-10-07，评估第 3 条）----------
  // 没网 / 密钥不对或额度用完：分清原因提示（首页挂一条红条，记进当天日志和周报）；3 分钟里连着 2 次（aiDown）：
  //   剧情说话任务、选伙伴、闯关题出现「先跳过（已放进复习，联网后要补说）」，战斗这一回合改成听音选招（不能暴击）。
  // APK 里还没有 AI 密钥（aiNoKey）：一开始就是 aiDown，设置页顶上提示「请家长在这里粘贴 AI 密钥」。
  // 麦克风被拒：弹窗说明为什么要用麦克风 +「去打开」（EchoNative.micPermission 分清这次拒绝 / 永久拒绝，openAppSettings 跳到系统设置）。
  // 「没听清」算一次尝试（练习 / 剧情 / 战斗各自数）。
  const AI_DOWN_MS = 3 * 60e3;
  // 云端模式（公开版，account.js）：没有密钥这回事；「还没登录」就当成没有 AI（先跳过、放进复习），提示的话换成「登录以后……」
  const cloudOn = () => !!(window.EchoCloud && EchoCloud.on);
  const ACC = () => window.EchoAccount || null;
  const aiNoKey = () => cloudOn() ? S.settings.mode !== 'self' && !(ACC() && ACC().signed()) : !!window.ECHO_APP && S.settings.mode !== 'self' && !cloudSR();
  function aiDown() {
    if (speakMode() !== 'sr') return false;
    if (langNoCloud()) return true;             // 别的课在云端模式里，本机识别又用不了（ENGINE.md §6）
    if (aiNoKey() && !localSR()) return true;   // iPhone 的本机识别不要密钥、不要登录
    if (!cloudSR() && !localSR()) return false;
    return RT.aiFails >= 2 && Date.now() - RT.aiFailAt < AI_DOWN_MS;
  }
  // cls：'ok' 识别成功 / 'net' / 'key' / 'nokey'；why：talk.js 的细分原因（offline / network / auth / quota / busy / code）
  function aiNote(cls, why) {
    const now = Date.now();
    if (cls === 'ok') { RT.aiFails = 0; RT.aiOkAt = now; RT.aiBar = null; refreshBars(); return; }
    if (cls === 'nokey') { try { dayLog().aiNoKey = 1; } catch (e) { /* 只是记录 */ } refreshBars(); return; }
    // 隔了 3 分钟以上的失败不算「连着」：最多从 1 次接着数（再失败一次就又是「用不了」）
    RT.aiFails = (now - RT.aiFailAt < AI_DOWN_MS ? RT.aiFails : Math.min(1, RT.aiFails)) + 1;
    RT.aiFailAt = now;
    RT.aiBar = { cls, why: why || (cls === 'net' ? 'network' : ''), at: now };
    try {
      const L = dayLog();
      L.aiFail = (L.aiFail || 0) + 1; L.aiFailWhy = why || cls;
      if (cls === 'net') L.aiNet = (L.aiNet || 0) + 1; else { L.aiKey = (L.aiKey || 0) + 1; L.aiKeyWhy = why || 'auth'; }
    } catch (e) { /* 只是记录 */ }
    refreshBars();
  }
  window.addEventListener('online', () => { if (RT.aiBar && RT.aiBar.cls === 'net') { RT.aiBar = null; RT.aiFails = 0; } refreshBars(); });
  window.addEventListener('offline', () => refreshBars());
  const KEY_TXT = lazyMap('g.fail.key.', ['auth', 'quota', 'busy', 'code']), KEY_SHORT = lazyMap('g.fail.short.', ['auth', 'quota', 'busy', 'code']);   // KEY_SHORT：去掉「AI」的短说法，小检查里跟在 ❌ 后面
  // 没听到的时候，话筒下面那一行提示（练习 / 剧情 / 战斗 / 对话剧场共用）
  function failHint(res) {
    const f = res && res.fail, w = res && res.why;
    if (f === 'nokey' && w === 'lang') return tr('g.fail.lang');   // 别的课：这门语言要用手机自带的识别（ENGINE.md §6）
    if (f !== 'mic' && cloudOn() && ACC()) { const c = ACC().failText(f, w); if (c) return c; }   // 云端模式：没登录 / 今天的免费 AI 用完了
    if (f === 'mic') return tr('g.fail.mic');
    if (f === 'nokey') return tr('g.fail.nokey');
    if (f === 'net') return tr('g.fail.net');
    if (f === 'key') return w === 'busy' ? tr('g.fail.busy') : (w === 'quota' ? '💳 ' : '🔑 ') + tr('g.fail.key.line', { why: KEY_TXT[w] || tr('g.fail.key.other') });
    if (f === 'stop') return tr('g.fail.stop');   // 自己点了停：也写一句，别让「正在听……」那一行一直留着（对战、大地图的提示只在有字时才换）
    return tr('g.fail.unheard');
  }
  // 「先跳过」按钮上的字：和大地图（world.js）的 w.aiskip 是同一句，字表里只有一份
  const skipTxt = () => tr('w.aiskip');
  // 首页红条：现在 AI 用不了的原因（没有就返回 null）。口语打分的失败（aiNote）和聊天 / 朗读连不上（EchoTalk.lastErr）都算
  function aiBarState() {
    if (S.settings.mode === 'self' && !window.ECHO_APP) return null;   // 网页版的录音自评（测试也是）不用 AI
    // 云端模式没登录：没用到 AI 之前不挂红条（不登录本来就能玩）；口语题要 AI 了才挂「还没登录」
    if (aiNoKey()) return cloudOn() && !RT.cloudAsked ? null : { cls: 'nokey', why: 'nokey' };
    let st = RT.aiBar;
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    if (le && le.at > RT.aiOkAt && (!st || le.at > st.at + 1000) && /^(offline|network|auth|quota|busy)$/.test(le.why || ''))
      st = { cls: le.why === 'offline' || le.why === 'network' ? 'net' : 'key', why: le.why, at: le.at };
    if (!st || st.at < RT.aiOkAt) return null;
    // 网络的问题：10 分钟以后（或者手机说已经联网了）就不挂了；密钥和额度的问题一直挂着，直到成功一次或者家长换了密钥
    if (st.cls === 'net' && Date.now() - st.at > 10 * 60e3) return null;
    if (st.cls === 'key' && st.why === 'busy' && Date.now() - st.at > 5 * 60e3) return null;
    return st;
  }
  function barText(st) {
    if (cloudOn() && ACC()) { const c = ACC().barText(st); if (c) return c; }
    if (st.cls === 'nokey') return tr('g.bar.nokey');
    if (st.cls === 'net') return tr('g.bar.net');
    if (st.why === 'quota') return tr('g.bar.quota');
    if (st.why === 'busy') return tr('g.bar.busy');
    if (st.why === 'code') return tr('g.bar.code');
    return tr('g.bar.auth');
  }
  // 首页上面的提示条：AI 用不了（红）、有新版本（蓝）。挂在 #tabs 后面（index.html 不用改；横屏时在右栏最上面，见 style.css）
  function homeBars() {
    const tabs = $('#tabs'); if (!tabs) return;
    let box = $('#home-bars');
    if (!box) { box = document.createElement('div'); box.id = 'home-bars'; tabs.parentNode.insertBefore(box, tabs.nextSibling); }
    const st = aiBarState(), up = updNew(), full = RT.store && RT.store.warn ? RT.store : null;
    const pk = PK() ? EchoPacks.homeBar() : '';   // 课程包模式：这门课的语音包没下 / 没下完 / 正在下（packs.js）
    box.innerHTML = pk + (st ? '<button class="ai-bar" data-act="aiBarInfo" data-cls="' + st.cls + '">' + esc(barText(st)) + '<em>' + esc(tr('g.bar.how')) + '</em></button>' : '') +
      // 存档空间快满了（storeCheck）：还存得进去的时候就说，请家长导出
      (full ? '<button class="ai-bar" data-act="storeInfo" data-cls="store">' + trh('g.store.bar', { pct: full.pct }) + '<em>' + esc(tr('g.bar.how')) + '</em></button>' : '') +
      (up ? '<button class="upd-bar" data-act="updInfo">' + (S.upd.name ? trh('g.bar.upd.n', { name: S.upd.name }) : trh('g.bar.upd')) + '<em>' + esc(tr('g.bar.see')) + '</em></button>' : '');
    box.hidden = !st && !up && !full && !pk;
  }
  function refreshBars() { try { if (!$('#home').hidden) homeBars(); } catch (e) { /* 还没启动 */ } }
  function aiBarInfo() {
    const st = aiBarState();
    if (!st) { homeBars(); return; }
    if (cloudOn() && ACC() && ACC().barInfo(st)) return;   // 云端模式：直接给登录 / 会员那一页
    const parent = st.cls === 'nokey' || st.why === 'auth' || st.why === 'code';
    const how = st.cls === 'nokey' ? tr('g.bar.i.nokey')
      : st.cls === 'net' ? tr('g.bar.i.net')
      : st.why === 'quota' ? tr('g.bar.i.quota')
      : st.why === 'busy' ? tr('g.bar.i.busy')
      : st.why === 'code' ? tr('g.bar.i.code')
      : tr('g.bar.i.auth');
    openModal('<div class="big">' + (st.cls === 'net' ? '📶' : st.why === 'quota' ? '💳' : '🔑') + '</div><h2>' + esc(barText(st).replace(/^\S+\s/, '')) + '</h2><p>' + how + '</p>' +
      trh('g.bar.i.tip') +
      '<div class="row">' + (parent ? '<button class="btn ghost" data-act="parentSet">' + tr('g.bar.parent') + '</button>' : '') + '<button class="btn" data-act="close" data-focus>' + tr('g.ok') + '</button></div>');
  }
  // 麦克风被拒（APK）：问原生是「这次没允许」还是「永久拒绝、系统不会再问」，弹窗说明 +「去打开」
  const micState = () => { try { return nat('micPermission') ? String(EchoNative.micPermission() || '') : ''; } catch (e) { return ''; } };
  function micBlocked(why) {
    try { const L = dayLog(); L.micDeny = (L.micDeny || 0) + 1; } catch (e) { /* 只是记录 */ }
    micSheet(micState(), why);
  }
  function micSheet(state) {
    const blocked = state === 'blocked', canFix = nat('openAppSettings');
    RT.micSheet = true;
    openModal('<div class="big">🎤</div><h2>' + tr('g.mic.h') + '</h2>' +
      trh('g.mic.p') +
      (blocked ? trh('g.mic.blocked') : trh('g.mic.denied')) +
      '<div class="row">' + (blocked
        ? '<button class="btn ghost" data-act="close">' + tr('g.mic.later') + '</button>' + (canFix ? '<button class="btn" data-act="micFix" data-focus>' + tr('g.mic.fix') + '</button>' : '')
        : (canFix ? '<button class="btn ghost" data-act="micFix">' + tr('g.mic.fix2') + '</button>' : '') + '<button class="btn" data-act="close" data-focus>' + tr('g.mic.retry') + '</button>') + '</div>');
  }
  window.addEventListener('echo-mic', e => {
    if (e && e.detail === 'granted' && RT.micSheet) { RT.micSheet = false; if ($('#sheet [data-act=micFix]')) closeModal(); toast(tr('g.mic.granted')); }
  });

  // ---------- 第一次打开：「麦克风 + 网络 + 密钥」小检查（评估第 3 条 ⑤）----------
  // 请孩子说一句 Hello：顺便弹出麦克风权限框，测出麦克风被拒 / 被挡住、声音太小、没网、没密钥、额度用完。设置里也能再做一次
  const CHK_TXT = {
    mic: lazyMap('g.mic.mic.', ['ok', 'bad', 'quiet', '']),
    net: lazyMap('g.mic.net.', ['ok', 'bad', '']),
    key: lazyMap('g.mic.key.', ['ok', 'bad', '']),
    svc: lazyMap('g.mic.svc.', ['ok', 'bad', '']),   // 云端模式没有「密钥」这回事：第三行叫「AI 服务」
  };
  function chkRows() {
    const c = RT.chk || {};
    return ['mic', 'net', 'key'].map(k => '<li class="chk-' + (c[k] || 'wait') + '" id="chk-r-' + k + '">' + esc(CHK_TXT[k === 'key' && cloudOn() ? 'svc' : k][c[k] || ''] + (k === 'key' && c.key === 'bad' && c.keyWhy ? ' ' + c.keyWhy : '')) + '</li>').join('');
  }
  function checkSheet() {
    const nokey = aiNoKey();
    RT.chk = { mic: '', net: navigator.onLine === false ? 'bad' : '', key: nokey ? 'bad' : '', keyWhy: nokey ? (cloudOn() ? tr('ac.chk.nokey') : tr('g.mic.nokey')) : '' };
    openModal('<div class="big">🩺</div><h2>' + tr('g.mic.chk.h') + '</h2>' + trh('g.mic.chk.p', LANG ? { word: chkWord() } : undefined) +
      '<ul class="chk" id="chk">' + chkRows() + '</ul>' +
      '<div class="mic-wrap"><button class="mic" id="chk-mic" data-act="chkMic" aria-label="' + esc(tr('w.mic.aria')) + '">' + MIC + '</button><div class="mic-hint" id="chk-hint">' + tr('g.mic.chk.hint', { word: chkWord() }) + '</div><div class="heard" id="chk-heard"></div></div>' +
      '<div class="row"><button class="btn ghost" data-act="chkSkip">' + tr('w.skip') + '</button><button class="btn" data-act="chkDone" id="chk-done" hidden>' + tr('g.mic.chk.go') + '</button></div>');
  }
  // 没有 AI 密钥时只能测麦克风：开 2.5 秒，看声音够不够大
  async function micProbe(ms) {
    let stream, ctx;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return { err: 'mic', why: (e && e.name) || 'mic' }; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* 忽略 */ } }
      const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize), t0 = Date.now();
      let peak = 0;
      while (Date.now() - t0 < (ms || 2500)) {
        await new Promise(r => setTimeout(r, 60));
        an.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        peak = Math.max(peak, Math.sqrt(s / buf.length));
      }
      return { ok: true, loud: peak > 0.02, peak };
    } catch (e) { return { ok: true, loud: true }; }
    finally { try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* 忽略 */ } try { if (ctx) ctx.close(); } catch (e) { /* 忽略 */ } }
  }
  // 小检查要说的那个词：英语 Hello；别的课用第一座岛的第一个词（「你好」那一类）
  const chkWord = () => (LANG && W[0] && W[0].words && W[0].words[0] ? W[0].words[0][0] : 'Hello');
  async function chkMic() {
    if (RT.listening || RT.chkBusy) { stopListening(); return; }
    const m = $('#chk-mic'), hint = $('#chk-hint'), heard = $('#chk-heard'); if (!m) return;
    const c = RT.chk = RT.chk || {};
    const upd = () => { const ul = $('#chk'); if (ul) ul.innerHTML = chkRows(); };
    m.classList.add('on'); m.innerHTML = STOP; hint.textContent = tr('g.mic.listen', LANG ? { word: chkWord() } : undefined); heard.textContent = '';
    if ((aiNoKey() || !cloudSR()) && !localSR()) {   // 没有密钥：只能看麦克风有没有声音（iPhone 的本机识别能用就真的识别一次）
      RT.chkBusy = true;
      const r = await micProbe(2500);
      RT.chkBusy = false;
      if (!$('#chk-mic')) return;
      m.classList.remove('on'); m.innerHTML = MIC;
      if (r.err) { c.mic = 'bad'; upd(); if (window.ECHO_APP) micBlocked(r.why); else hint.textContent = tr('g.mic.nobrowser'); return; }
      c.mic = r.loud ? 'ok' : 'quiet'; upd();
      hint.textContent = r.loud ? tr(c.key === 'bad' ? 'g.mic.ok.key' : 'g.mic.ok') : tr('g.mic.quiet', { word: chkWord() });
      if (r.loud) { S.micCheck = dayStr(); save(); const d = $('#chk-done'); if (d) d.hidden = false; }
      return;
    }
    const res = await recognize(t => { const h = $('#chk-heard'); if (h) h.textContent = t; }, [chkWord()]);
    if (!$('#chk-mic')) return;
    m.classList.remove('on'); m.innerHTML = MIC;
    if (res.alts.length) {
      // 本机识别（iPhone）没用到网络和 AI：只说麦克风没问题，网络 / AI 那两行照原样；再说一句这次用的是本机还是云端
      const dev = res.eng === 'device', sr = window.EchoTalk && EchoTalk.srText ? EchoTalk.srText('chk', res.eng) : '';
      Object.assign(c, dev ? { mic: 'ok' } : { mic: 'ok', net: 'ok', key: 'ok', keyWhy: '' }); upd();
      heard.textContent = tr('w.heard', { t: res.alts[0] });
      hint.textContent = dev && sr ? sr : tr('g.mic.allok') + (res.eng === 'cloud' && window.ECHO_IOS ? sr : '');   // 安卓、网页版和以前一字不差
      S.micCheck = dayStr(); save();
      const d = $('#chk-done'); if (d) d.hidden = false;
      return;
    }
    if (res.fail === 'mic') { c.mic = 'bad'; upd(); return; }   // 说明弹窗已经弹出来了（APK）
    if (res.fail === 'net') { c.mic = 'ok'; c.net = 'bad'; }
    else if (res.fail === 'key') { c.mic = 'ok'; c.net = 'ok'; c.key = 'bad'; c.keyWhy = KEY_SHORT[res.why] || ''; }
    else if (res.fail === 'unheard') c.mic = 'quiet';
    heard.textContent = '';   // 没认出来：把「识别中……」收掉（以前失败了它还挂在话筒下面）
    upd();
    hint.textContent = res.fail === 'unheard' ? tr('g.mic.covered', { word: chkWord() }) : failHint(res);
  }

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function n2w(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + n2w(n % 100) : '');
    return String(n);
  }
  const ORDS = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth' };
  function ord(n) {
    if (ORDS[n]) return ORDS[n];
    if (n < 20) return ONES[n] + 'th';
    if (n % 10 === 0 && n < 100) return TENS[n / 10].replace(/y$/, 'ieth');
    if (n < 100) return TENS[Math.floor(n / 10)] + ' ' + ord(n % 10);
    return n2w(n);
  }
  const SPELL = { colour: 'color', favourite: 'favorite', maths: 'math', grey: 'gray', centre: 'center', okay: 'ok', mum: 'mom', mr: 'mister', ms: 'miss', pingpong: 'ping pong', cannot: 'can not',
    // 英式拼写 → 美式识别结果（差两个字母，tokEq 认不出来）
    kilometre: 'kilometer', kilometres: 'kilometers', metre: 'meter', metres: 'meters', programme: 'program', programmes: 'programs',
    litre: 'liter', litres: 'liters', theatre: 'theater', theatres: 'theaters', tyre: 'tire', tyres: 'tires',
    // 课本用英式的过去式（learnt），识别服务写成 learned
    learnt: 'learned', spelt: 'spelled', dreamt: 'dreamed', burnt: 'burned', smelt: 'smelled', spoilt: 'spoiled' };
  // 识别服务常常把缩写的撇号丢掉（I dont like it）：按没丢撇号的样子展开（目标和听到的都过一遍，两边一样）
  const CONTR = { dont: 'do not', doesnt: 'does not', didnt: 'did not', isnt: 'is not', arent: 'are not', wasnt: 'was not', werent: 'were not',
    cant: 'can not', wont: 'will not', havent: 'have not', hasnt: 'has not', hadnt: 'had not', couldnt: 'could not', shouldnt: 'should not',
    wouldnt: 'would not', mustnt: 'must not', neednt: 'need not', im: 'i am', ive: 'i have', youre: 'you are', youve: 'you have', youll: 'you will',
    theyre: 'they are', theyve: 'they have', theyll: 'they will', weve: 'we have', whats: 'what is', thats: 'that is', hes: 'he is', shes: 'she is',
    theres: 'there is', wheres: 'where is', heres: 'here is', lets: 'let us' };
  function norm(s) {
    s = ' ' + String(s).toLowerCase().replace(/[’‘`]/g, "'") + ' ';
    s = s.replace(/\b((?:[a-z]\.){2,})/g, m => m.replace(/\./g, ''));
    s = s.replace(/(\d+):(\d\d)/g, (m, h, mm) => n2w(+h) + ' ' + (+mm === 0 ? "o'clock" : (mm[0] === '0' ? 'oh ' + n2w(+mm) : n2w(+mm))));
    s = s.replace(/(\d+)(st|nd|rd|th)\b/g, (m, d) => ord(+d));
    s = s.replace(/\d+/g, d => ' ' + n2w(+d) + ' ');
    s = s.replace(/\blet's\b/g, 'let us').replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
      .replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'s\b/g, ' is').replace(/'d\b/g, ' would').replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have');
    s = s.replace(/-/g, ' ').replace(/'/g, '').replace(/[^a-z ]/g, ' ');
    return s.split(/\s+/).filter(Boolean).map(w => CONTR[w] || SPELL[w] || w).join(' ').split(' ').filter(Boolean);
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = range(n + 1);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // ---------- 打分要诚实（家长 2026-10-07 定，评估第 8 条）----------
  // 模糊匹配只留给拼写变体（realise/realize、honour/honor、travelled/traveled）；易混的音（three/tree、went/want、these/those、light/right）不算对，
  // 只错了词尾（likes/like、played/play）算半对（四分之三）；发音一样的词（eye = I、eight = ate、right = write）算对；
  // 实词比虚词重要：句子里漏掉（或说错）四分之一以上的实词就不过关，漏一个也不能算全对；有一个词没说对就不给 Perfect / 暴击（最多 84 分）。
  const HOMO = {};   // 同音词 → 同一组
  [['i', 'eye', 'aye'], ['eight', 'ate'], ['right', 'write', 'rite'], ['two', 'too', 'to'], ['four', 'for'], ['one', 'won'], ['no', 'know'], ['new', 'knew'],
    ['see', 'sea'], ['here', 'hear'], ['there', 'their'], ['by', 'buy', 'bye'], ['son', 'sun'], ['hour', 'our'], ['meet', 'meat'], ['week', 'weak'],
    ['road', 'rode'], ['wait', 'weight'], ['whole', 'hole'], ['which', 'witch'], ['flower', 'flour'], ['pair', 'pear'], ['dear', 'deer'], ['blue', 'blew'],
    ['night', 'knight'], ['tail', 'tale'], ['mail', 'male'], ['sale', 'sail'], ['be', 'bee'], ['peace', 'piece'], ['plain', 'plane'], ['aloud', 'allowed'],
    ['weather', 'whether'], ['made', 'maid'], ['steal', 'steel'], ['wood', 'would'], ['great', 'grate'], ['board', 'bored'], ['through', 'threw'], ['nose', 'knows'],
    ['sent', 'cent', 'scent'], ['ok', 'okay']].forEach(g => g.forEach(w => { HOMO[w] = g[0]; }));
  const canon = w => HOMO[w] || w;
  const pairSet = s => new Set(s.split(' ').flatMap(p => { const [a, b] = p.split('|'); return [a + '|' + b, b + '|' + a]; }));
  // 不许模糊匹配的词对（下面的规则大多也能挡住，这里写明最典型的）
  const NOFUZZ = pairSet('three|tree three|free went|want these|those light|right then|than were|where thing|think they|them quiet|quit live|love sing|sting bread|bead glass|grass play|pray collect|correct');
  // 不规则的词形变化：算「只错了词尾」
  const INFL = pairSet('go|goes do|does have|has is|are am|is am|are was|were is|was are|were a|an child|children man|men woman|women foot|feet tooth|teeth mouse|mice ' +
    'go|went see|saw eat|ate have|had do|did make|made take|took come|came get|got buy|bought think|thought say|said tell|told give|gave run|ran swim|swam sing|sang ' +
    'write|wrote know|knew know|known grow|grown take|taken see|seen give|given eat|eaten fall|fallen');
  const VOW = /[aeiouy]/;
  // 拼写变体：只差一个字母，而且不是首字母、词尾、元音换元音、l/r 互换、多一个 h/r/l（双写字母可以）
  function fuzzyOk(a, b) {
    if (a.length <= 3 || b.length <= 3 || NOFUZZ.has(a + '|' + b)) return false;
    if (a.length === b.length) {
      let i = 0; while (a[i] === b[i]) i++;
      if (a.slice(i + 1) !== b.slice(i + 1)) return false;
      const x = a[i], y = b[i];
      if (i === 0 || i === a.length - 1) return false;   // light/right、thing/think
      if (VOW.test(x) && VOW.test(y)) return false;      // went/want、these/those
      if ('lr'.includes(x) && 'lr'.includes(y)) return false;   // glass/grass
      return true;   // realise/realize、practise/practice
    }
    const [L, s] = a.length > b.length ? [a, b] : [b, a];
    if (L.length !== s.length + 1) return false;
    let i = 0; while (i < s.length && L[i] === s[i]) i++;
    if (L.slice(i + 1) !== s.slice(i)) return false;
    const c = L[i];
    if (L[i - 1] === c || L[i + 1] === c) return true;   // 双写字母：travelled/traveled
    if (i === 0 || i === L.length - 1) return false;     // 词头、词尾多一个字母（词尾变化交给 inflect）
    if ('hrl'.includes(c)) return false;                 // three/tree、were/where、bread/bead
    return true;   // honour/honor
  }
  // 只错了词尾：like/likes、play/played/playing、make/making、study/studies、stop/stopped、go/went……
  function inflect(a, b) {
    if (INFL.has(a + '|' + b)) return true;
    const [L, s] = a.length >= b.length ? [a, b] : [b, a];
    if (s.length < 3 || L === s) return false;
    const tail = L.slice(s.length);
    if (L.startsWith(s) && /^(s|es|d|ed|ing|er|est|ly)$/.test(tail)) return true;
    if (L.startsWith(s) && tail[0] === s[s.length - 1] && /^(ed|ing|er|est)$/.test(tail.slice(1))) return true;   // 双写：stop/stopped
    const stem = s.slice(0, -1), rest = L.slice(stem.length);
    if (s.endsWith('e') && L.startsWith(stem) && /^(ing|ed|er|est)$/.test(rest)) return true;     // make/making
    if (s.endsWith('y') && L.startsWith(stem) && /^(ies|ied|ier|iest)$/.test(rest)) return true;  // study/studies
    return false;
  }
  // 两个词对得上多少：4 = 对，3 = 只错了词尾，0 = 不对
  function tokM(a, b) {
    if (a === b || canon(a) === canon(b) || fuzzyOk(a, b)) return 4;
    return inflect(a, b) ? 3 : 0;
  }
  // 虚词（权重 1）；其余是实词（权重 2）。not / no / never 改变意思，算实词
  const FUNC = new Set(('a an the to of in on at by for from with about into onto over under up down out off and or but so if as than then that this these those ' +
    'there here is am are was were be been being do does did have has had will would shall should can could may might must i you he she it we they me him her ' +
    'us them my your his its our their mine yours ours hers theirs oh ok yes well just very too also please').split(' '));
  // 名字（怪兽名、昵称、人名）识别服务常常写错或拆成两个词：大写开头、不在句首、5 个字母以上的词放宽一点（差四分之一个字母以内也算对，拆开的两个词先拼回去）。
  // 课本里的中国人名是拼音、往往很短（Li → Lee、Lin → Lynn、Zhang → Jang、Wang Fang → Wong Fong）：看着像拼音的名字不管多长都算名字，差 2 个字母以内也算对。
  // 句首的词只有后面紧跟着另一个大写的词时才算名字（Wang Fang is…、Mr Li is…）
  const PINYIN = /^(?:(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|in|un|ia|ie|iu|ua|uo|ue|ui|er|a|o|e|i|u|v)){1,3}$/;
  const isPinyin = t => PINYIN.test(t);
  // 大写但不是人名的常用词：照普通词打分（说成别的就是错，Monday ≠ Sunday、China ≠ Chinese）
  const NOT_NAME = new Set(('monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october ' +
    'november december china chinese english america american canada canadian britain british france french japan japanese australia australian ' +
    'germany german italy italian russia russian india indian korea korean christmas easter earth moon sun mars internet tv').split(' '));
  const nameTol = t => (isPinyin(t) ? Math.max(2, Math.floor(t.length / 4)) : Math.max(1, Math.floor(t.length / 4)));
  function nameIdx(words) {
    const out = new Set();
    words.forEach((w, k) => {
      if (!/^[A-Z]/.test(w)) return;
      if (k > 0 ? !/[.!?]$/.test(words[k - 1]) : (/,$/.test(w) || (words.length > 1 && /^[A-Z]/.test(words[1]) && !/[.!?]$/.test(w) && w !== 'I'))) out.add(k);
    });
    return out;
  }
  // 加权的最长公共子序列：每个目标词按顺序找听到的词，返回每个目标词对上多少（0 / 3 / 4）
  function align(t, h, wt, isName) {
    const m = t.length, n = h.length;
    const M = t.map((x, i) => h.map(y => { const v = tokM(x, y); return v || !isName[i] ? v : (lev(x, y) <= nameTol(x) ? 4 : 0); }));
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const v = M[i - 1][j - 1];
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], v ? dp[i - 1][j - 1] + wt[i - 1] * v : 0);
    }
    const got = new Array(m).fill(0);
    let i = m, j = n;
    while (i > 0 && j > 0) {
      const v = M[i - 1][j - 1];
      if (v && dp[i][j] === dp[i - 1][j - 1] + wt[i - 1] * v) { got[i - 1] = v; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return got;
  }
  // 返回 0–100 分；marks：每个原始单词是否说对；last：最后一个词有没有按顺序对上（秒出分要用）；full：每个词都说对了
  function scoreSpeech(target, heard) {
    if (LANG) return LANG.score(target, heard, lctx(target));   // 别的课：lang-*.js 打分（同一套分数线，规矩见 lang.js 开头）
    const words = String(target || '').split(/\s+/).filter(Boolean), names = nameIdx(words);
    const flat = [], owner = [];
    words.forEach((w, k) => norm(w).forEach(t => { flat.push(t); owner.push(k); }));
    let h = norm(heard || '');
    if (!flat.length || !h.length) return { score: 0, marks: words.map(() => false), last: false, full: false };
    // it's / its 听起来一样，识别服务常常丢撇号或乱加：按目标句的写法改过来
    const pairAt = (a, x, y) => a.some((t, i) => t === x && a[i + 1] === y);
    if (pairAt(flat, 'it', 'is')) h = h.flatMap(t => (t === 'its' ? ['it', 'is'] : [t]));
    else if (flat.includes('its')) h = h.reduce((a, t) => { if (t === 'is' && a[a.length - 1] === 'it') a[a.length - 1] = 'its'; else a.push(t); return a; }, []);
    const isName = flat.map((t, i) => names.has(owner[i]) && !FUNC.has(t) && !NOT_NAME.has(t) && (t.length >= 5 || isPinyin(t)));
    // 名字被拆成两个词（Ember pup → emberpup）：拼回去
    isName.forEach((nm, i) => {
      if (!nm || h.includes(flat[i])) return;
      for (let j = 0; j + 1 < h.length; j++) { const jn = h[j] + h[j + 1]; if (lev(jn, flat[i]) <= nameTol(flat[i])) { h = h.slice(0, j).concat([jn], h.slice(j + 2)); break; } }
    });
    const wt = flat.map(t => FUNC.has(t) ? 1 : 2);
    const got = align(flat, h, wt, isName);
    const W = wt.reduce((a, x) => a + x, 0) * 4, G = got.reduce((a, g, i) => a + g * wt[i], 0);
    const hit = got.reduce((a, g) => a + g / 4, 0);
    const recall = G / W, f1 = 2 * hit / (flat.length + h.length);
    let s = 0.6 * recall + 0.4 * f1, same = false;
    const ca = flat.map(canon), cb = h.map(canon);
    if (flat.length <= 2) {
      const a = ca.join(''), b = cb.join(''), sim = (1 - lev(a, b) / Math.max(a.length, b.length)) * 0.95;
      if (a === b) { s = 1; same = true; }                                  // 只是分词不同：ice cream / icecream
      else if (flat.length !== h.length) s = Math.max(s, Math.min(.84, sim));   // 分词不同又差一点
      else if (s < .5) s = Math.max(s, Math.min(.5, sim));                  // 说成了别的词（tree）：给个参考分，不过关
    } else s = s * s * (2 - s);   // 句子：漏读的扣分更明显
    // 目标的几个词按顺序完整地说出来了（前后多说了几个词也行）：短的算满分
    if (flat.length <= 3 && (' ' + cb.join(' ') + ' ').includes(' ' + ca.join(' ') + ' ')) { s = 1; same = true; }
    const marks = words.map((w, k) => { const idx = owner.map((o, i) => o === k ? i : -1).filter(i => i >= 0); return idx.length === 0 || idx.every(i => got[i] === 4); });
    if (same || (words.length === 1 && s >= 0.9)) marks.fill(true);
    if (flat.length >= 3 && !same) {
      // 名字不算进「关键实词」：识别服务写不对名字很常见（照样扣分、不给 Perfect，但不会因此不过关）
      const content = flat.map((t, i) => i).filter(i => wt[i] === 2 && !isName[i]), miss = content.filter(i => !got[i]).length;
      if (content.length && miss / content.length >= .25) s = Math.min(s, .5);   // 关键的实词没说出来：不过关
      else if (miss) s = Math.min(s, .84);
    }
    const full = marks.every(Boolean);
    if (!full) s = Math.min(s, .84);   // Perfect / 暴击要每个词都说对
    return { score: Math.round(Math.max(0, Math.min(1, s)) * 100), marks, last: same || got[flat.length - 1] === 4, full };
  }
  function bestScore(target, alts) {
    if (LANG) return LANG.best(target, alts || [], lctx(target));
    let best = { score: -1, marks: [], heard: '', last: false, full: false };
    alts.forEach(a => { const r = scoreSpeech(target, a); if (r.score > best.score) best = { ...r, heard: a }; });
    return best;
  }
  // 秒出分：实时识别的结果 90 分以上，而且目标的最后一个词已经按顺序说出来了，才立刻结束（不然孩子还在说最后一个词就被截断）
  function earlyMatch(target, heard) {
    if (LANG) return LANG.early(target, heard, lctx(target));
    const r = scoreSpeech(target, heard);
    return r.score >= 90 && r.last;
  }

  // ---------- 出题 ----------
  // keyIdx：按条目的第几格去重（英语：0 原文 / 1 中文意思）；别的课按意思去重时用 meanKey（中文课的第 1 格是空的）
  function distract(list, i, n, keyIdx) {
    const kf = typeof keyIdx === 'function' ? keyIdx : x => x[keyIdx];
    const seen = new Set([kf(list[i])]);
    const out = [];
    for (const j of shuffle(range(list.length))) {
      if (j === i || seen.has(kf(list[j]))) continue;
      seen.add(kf(list[j])); out.push(list[j]);
      if (out.length === n) break;
    }
    return out;
  }
  // 别的课：按界面语言里的意思去重（没有意思就按原文）
  const meanKey = x => { const m = meanOf(x); return m != null && m !== '' ? m : x[0]; };
  // 排句子的块：英语按空格切；别的课交给 LANG.tiles（日语、中文按 seg）
  const tokens = s => (LANG ? LANG.tiles(s, entryOf(s)) : s.split(/\s+/).map(t => t.replace(/[.,!?]+$/g, '')).filter(Boolean));

  function makeQ(type, wi, i) {
    const w = WX[wi];
    const q = { type, kind: KIND[type], w: wi, i };
    // q.mean：题面上的意思（界面语言里的，meanOf；没有是 null）。听音选义 / 听句选意：四个选项里有一个没有意思，就换成「选听到的英文」（q.ear，见 cueMode 上面）
    if (q.kind === 'word') {
      const it = w.words[i];
      q.en = it[0]; q.zh = it[1]; q.em = it[2]; q.mean = meanOf(it);
      if (type === 'lw') {
        q.audio = it[0];
        const ds = distract(w.words, i, 3, q.mean != null ? (LANG ? meanKey : 1) : 0), ms = ds.map(meanOf), ear = q.mean == null || ms.some(m => m == null);
        if (ear) q.ear = true;
        q.opts = shuffle([{ c: true, e: it[2], t: ear ? it[0] : q.mean }, ...ds.map((o, k) => ({ e: o[2], t: ear ? o[0] : ms[k] }))]);
      }
      if (type === 'ls') { q.audio = it[0]; q.opts = shuffle([{ c: true, t: it[0] }, ...distract(w.words, i, 3, 0).map(o => ({ t: o[0] }))]); }
      if (type === 'sr_w') { q.audio = it[0]; q.target = it[0]; }
      if (type === 'sp') { q.audio = null; q.target = it[0]; }
    } else if (q.kind === 'sent') {
      const it = w.sents[i];
      q.en = it[0]; q.zh = it[1]; q.mean = meanOf(it);
      if (type === 'lm') {
        q.audio = it[0];
        const ds = distract(w.sents, i, 3, q.mean != null ? (LANG ? meanKey : 1) : 0), ms = ds.map(meanOf), ear = q.mean == null || ms.some(m => m == null);
        if (ear) q.ear = true;
        q.opts = shuffle([{ c: true, t: ear ? it[0] : q.mean }, ...ds.map((o, k) => ({ t: ear ? o[0] : ms[k] }))]);
      }
      if (type === 'lo') { q.audio = it[0]; q.tokens = tokens(it[0]); q.bank = shuffle(range(q.tokens.length)); if (LANG) q.tokR = tileR(it[0], q.tokens); }
      if (type === 'sr_s') { q.audio = it[0]; q.target = it[0]; }
    } else {
      const it = w.dlgs[i];
      q.prompt = it[0]; q.en = it[1]; q.audio = it[0];
      if (type === 'lr' || type === 'bt') q.opts = shuffle([{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))]);
      if (type === 'sr_d') q.target = it[1];
    }
    return q;
  }

  function buildLevel(wi, li) {
    const r = RECIPES[li], bags = {}, qs = [];
    const next = (kind, wj) => {
      const k = wj + ':' + kind;
      const len = kind === 'word' ? WX[wj].words.length : kind === 'sent' ? WX[wj].sents.length : WX[wj].dlgs.length;
      if (!bags[k] || !bags[k].length) bags[k] = shuffle(range(len));
      return bags[k].pop();
    };
    const first = isUnit(wi) ? NB : 0;   // 「挑战」复习前面的内容：小岛复习前面的岛，课本复习前面的单元
    r.mix.forEach(([t, n]) => {
      for (let k = 0; k < n; k++) {
        const wj = r.review && wi > first && Math.random() < 0.3 ? first + rnd(wi - first) : wi;
        qs.push(makeQ(t, wj, next(KIND[t], wj)));
      }
    });
    if (!r.boss) return shuffle(qs);
    const bt = qs.filter(q => q.type === 'bt'), lo = qs.filter(q => q.type === 'lo');
    return [bt[0], bt[1], lo[0], bt[2], bt[3], lo[1], bt[4], bt[5]].filter(Boolean);
  }

  // ---------- 每日复习（温故而知新）----------
  // 每道题一条记录 S.rev.items[键]：b = 第几格（0 = 刚答错），due = 哪天该复习（'' = 已经掌握），x = 答错过几次，c = 哪天进来的，
  // src = 'chat' 表示 AI 聊天里老师给的更好说法（said = 孩子原来的说法）。
  // 答错（闯关、村民出题、复习里）→ 回到第 0 格，当天就进复习；复习答对 → 进一格，隔 1、2、4、7、15、30 天再来；第 7 格算掌握（留着不删，周报「累计掌握」数它们）。
  // 课本单元的题第一次答对 → 第 1 格，第二天复习一次（新学的东西趁热巩固），之后按上面的间隔；带着提示才答对的按「弱」进来（第 0 格，明天考，也占每天新进的名额）。
  // 冒险也替复习干活（家长 2026-10-07 定，评估第 6 条）：闯关、对战、村民出题里答对一道今天到期的题，就算一次复习、升一格（每天最多算 REV_FIELD 次）；
  // 对战里没念准 / 没听懂只降一格（revMiss），不打回第 0 格。对战出题先挑今天到期的（revPick）。
  // 为了消化得过来：每天最多新进 REV_NEW 条，今天到期的积压超过 REV_BACKLOG 条就先不加新学的（答错的、聊天里改过的照样进）。
  const GAP = [0, 1, 2, 4, 7, 15, 30];
  const REV_N = 20;          // 一轮复习几题（家长定：每天 20 题，约 6–8 分钟）
  const REV_MAX = 3000;      // 复习本里最多留多少条还没掌握的（已经掌握的不删）
  const REV_NEW = 10;        // 每天最多新进几条
  const REV_BACKLOG = 40;    // 今天到期的超过这么多条，当天不再加新学的
  const REV_FIELD = 20;      // 冒险里答对到期的题，每天最多算几次复习
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return dayStr(new Date(y, m - 1, dd + n)); };
  const revKey = q => q.free || q.kind + ':' + q.w + ':' + q.i;
  const listOf = (w, kind) => kind === 'word' ? w.words : kind === 'sent' ? w.sents : w.dlgs;
  function revItemOk(e) {
    if (e.k === 'free') return !!e.en;
    const w = WX[e.w], L = w && listOf(w, e.k);
    return !!(L && L[e.i]);
  }
  function revMigrate() {   // 老存档的错题本搬进来（只做一次）
    if (S.rev.v) return;
    for (const [k, e] of Object.entries(S.wrong || {})) if (!S.rev.items[k]) S.rev.items[k] = { k: e.k, w: e.w, i: e.i, b: 0, due: dayStr(), x: e.m || 1 };
    S.wrong = {}; S.rev.v = 1;
  }
  // 今天的计数：n = 新进了几条，f = 冒险里算了几次复习（过了零点自动清零）
  function revDay() {
    const t = dayStr();
    if (!S.rev.day || S.rev.day.d !== t) S.rev.day = { d: t, n: 0, f: 0 };
    return S.rev.day;
  }
  // 今天还能不能加新学的：每天最多 REV_NEW 条，积压太多先消化
  const revNewOk = () => revDay().n < REV_NEW && dueList().length <= REV_BACKLOG;
  // 周报「隔一周还记得的比例」：今天到期、上次隔了 7 天以上（第 4 格以上）的题，这次答没答对（带提示的不算对）
  function logWeek(e, ok) {
    if (!e || !e.due || e.due > dayStr() || (e.b || 0) < 4) return;
    const L = dayLog(); L.weekN = (L.weekN || 0) + 1; if (ok) L.weekOk = (L.weekOk || 0) + 1;
  }
  function revUp(e, today) {   // 进一格
    e.b = Math.min(GAP.length, (e.b || 0) + 1);
    e.due = e.b >= GAP.length ? '' : addDays(today, GAP[e.b]); e.seen = today;
  }
  function revNew(q, k) {   // 新建一条记录（还没排期）
    revDay().n++;
    return (S.rev.items[k] = q.free ? { k: 'free', en: q.en, zh: q.zh || '', src: 'chat', c: dayStr() } : { k: q.kind, w: q.w, i: q.i, c: dayStr() });
  }
  function revWrong(q) {
    if (!q || !q.kind) return;
    const k = revKey(q), e = S.rev.items[k] || revNew(q, k);
    logWeek(e, false);
    e.b = 0; e.due = dayStr(); e.x = (e.x || 0) + 1; if (!e.c) e.c = dayStr();
    dayLog().wrongs = (dayLog().wrongs || 0) + 1;
    revTrim();
  }
  const addWrong = revWrong;   // 老名字：monsters.js / world.js 还在用
  // 对战里没念准 / 没听懂：只降一格（不清零），今天再复习一次；还没进复习本的照常记成错题
  function revMiss(q) {
    if (!q || !q.kind) return;
    const e = S.rev.items[revKey(q)];
    if (!e || !(e.b > 0)) { revWrong(q); return; }
    logWeek(e, false);
    e.b = Math.min(GAP.length, e.b) - 1; e.due = dayStr(); e.x = (e.x || 0) + 1;
    dayLog().wrongs = (dayLog().wrongs || 0) + 1;
  }
  // AI 打分用不了时「先跳过」（家长 2026-10-07，评估第 3 条）：放进复习、今天到期（格子不变、不算答错），标上 owe——
  // 联网以后复习里这题一定出开口题（buildReview），开口说对了才去掉。没有编号的句子（剧情里要说的话）用 revAddFree 的格式
  // 没有编号的句子在复习本里的键：英语照旧；别的课用 LANG.key（日语、中文去掉了字母以外的就什么都不剩了）
  const freeKey = en => 'free:' + (LANG ? LANG.key(en) : String(en).toLowerCase().replace(/[^a-z' ]/g, '').trim());
  function revLater(q) {
    if (!q) return;
    if (!q.kind && q.en) q = { kind: 'sent', free: freeKey(q.en), en: q.en, zh: q.zh || '' };
    if (!q.kind || (q.free && !q.en)) return;
    const k = revKey(q), today = dayStr();
    let e = S.rev.items[k];
    if (!e) { e = revNew(q, k); e.b = 0; e.x = 0; if (q.free) e.src = 'skip'; }
    if (!e.due || e.due > today) e.due = today;
    e.owe = 1;
    revTrim(); save();
  }
  // 答对了。inReview：在每日复习里；否则是闯关 / 对战 / 村民出题。aided：带着提示才答对（点了提示、看了原文、第 2 次才说对）
  function revRight(q, inReview, aided) {
    if (!q || !q.kind) return;
    const k = revKey(q), e = S.rev.items[k], today = dayStr();
    if (inReview) {
      if (!e) return;
      logWeek(e, !aided);
      if (aided) { e.due = addDays(today, 1); e.seen = today; }   // 带提示通过：不升格，明天再考一次
      else revUp(e, today);
      S.stats.reviewed++; qProg('review', 1);
      return;
    }
    if (e) {   // 冒险里碰到复习本里的题：今天到期的算一次复习（每天最多 REV_FIELD 次）
      if (aided || !e.due || e.due > today) return;
      const day = revDay();
      if (day.f >= REV_FIELD) return;
      logWeek(e, true);
      day.f++; revUp(e, today);
      S.stats.reviewed++; qProg('review', 1);
      dayLog().revField = (dayLog().revField || 0) + 1;
      return;
    }
    if (q.free || !isUnit(q.w)) return;   // 小岛的题答对了不进复习（和以前一样）
    if (unitFree(q.w - NB)) return;       // 按能力走：已免修的单元答对了不算「新学的」，不进复习（答错了照样进，见 revWrong）
    // 带提示学到的也占每天新进的名额（不然常点提示的孩子一天能塞进几十条）
    if (!revNewOk()) return;
    if (aided) { const n = revNew(q, k); n.b = 0; n.due = addDays(today, 1); n.x = 0; }   // 带提示学到的：按「弱」进来，明天考
    else { const n = revNew(q, k); n.b = 1; n.due = addDays(today, 1); n.x = 0; }   // 课本新学的：明天复习
    dayLog().fresh = (dayLog().fresh || 0) + 1;
    revTrim();
  }
  // AI 聊天结束时老师给的「更好的说法」：明天复习。said = 孩子原来的说法（复习时显示出来，让他自己说出对的）
  // talk.js 现在只传 (better, zh)；以后传第 3 个参数 said 就会用上
  function revAddFree(en, zh, said) {
    en = String(en || '').trim(); if (!en || en.split(/\s+/).length > 14) return;
    const k = freeKey(en);
    said = String(said || '').trim();
    if (said.toLowerCase() === en.toLowerCase() || said.split(/\s+/).length > 20) said = '';
    const old = S.rev.items[k];
    if (old) { if (said && !old.said) { old.said = said; save(); } return; }
    const e = revNew({ kind: 'sent', free: k, en, zh: String(zh || '') }, k);
    Object.assign(e, { b: 0, due: addDays(dayStr(), 1), x: 0 });
    if (said) e.said = said;
    revTrim(); save();
  }
  // 复习本最多留 REV_MAX 条还没掌握的。已经掌握的不删（周报「累计掌握」）；
  // 真的超了，先删只见过一次、从没错过的（刚进来、投入最少的），再删最早进来的。
  // 例外：AI 聊天里改过的句子（free）没有个数上限——课本的题一共就三千多条，聊天句子每天都在加，掌握了以后不会再出题，
  // 留着只是让存档越来越大（量过：三年能攒两千多条、五十多万字）。所以掌握了的聊天句子只留最近的 REV_FREE_KEEP 条，
  // 更早的删掉、只在 S.rev.gone 里记个数（「累计掌握」照样算上它们，revMastered）
  const REV_FREE_KEEP = 200;
  function revTrim() {
    const ks = Object.keys(S.rev.items), act = ks.filter(k => S.rev.items[k].due);
    if (act.length > REV_MAX) {
      act.sort((a, b) => { const A = S.rev.items[a], B = S.rev.items[b]; return ((A.x || 0) > 0) - ((B.x || 0) > 0) || (A.b || 0) - (B.b || 0) || (B.c || '').localeCompare(A.c || ''); });
      for (const k of act.slice(0, act.length - REV_MAX)) delete S.rev.items[k];
    }
    const old = ks.filter(k => { const e = S.rev.items[k]; return e && e.k === 'free' && !e.due; });
    if (old.length > REV_FREE_KEEP + 50) {   // 多出 50 条才理一次，不用每次都排序
      old.sort((a, b) => { const A = S.rev.items[a], B = S.rev.items[b]; return (A.seen || A.c || '').localeCompare(B.seen || B.c || ''); });   // 最早掌握的在前
      const cut = old.slice(0, old.length - REV_FREE_KEEP);
      for (const k of cut) delete S.rev.items[k];
      S.rev.gone = (S.rev.gone || 0) + cut.length;
    }
  }
  // 一共掌握了多少条（周报、复习页的「累计掌握」）：复习本里掌握了的 + 掌握以后删掉的聊天句子
  const revMastered = () => Object.values(S.rev.items).filter(e => !e.due).length + (S.rev.gone || 0);
  function dueList() {   // 今天该复习的：谁逾期最久谁先来（同一天到期的，格子低的、错得多的先来）
    const today = dayStr();
    for (const [k, e] of Object.entries(S.rev.items)) if (!revItemOk(e)) delete S.rev.items[k];
    return Object.entries(S.rev.items).filter(([, e]) => e.due && e.due <= today)
      .sort((a, b) => a[1].due.localeCompare(b[1].due) || (a[1].b || 0) - (b[1].b || 0) || (b[1].x || 0) - (a[1].x || 0));
  }
  // 冒险里出题（对战；以后村民出题也可以用）：先挑今天到期的复习题（同一场不重复，今天冒险里算复习的次数还没满），
  // 再挑课本正在学的单元里还没学过的（src(z) 给出单元时），最后才随机。
  // kind：'word' / 'sent' / 'dlg'；used：这一场已经出过的题（revKey 的 Set，会往里加）
  // 返回 { q: 存进复习本用的 { kind, w, i }（聊天句子是 { kind:'sent', free, en, zh }）, it: 题目内容（words/sents/dlgs 里的一条）, d: 挑干扰项用的小岛 / 单元 }
  function revPick(kind, z, used) {
    used = used || new Set();
    const take = (q, it, d) => { used.add(revKey(q)); return { q, it, d }; };
    if (revDay().f < REV_FIELD) {
      const hit = dueList().find(([k, e]) => !used.has(k) && (e.k === 'free' ? kind === 'sent' && !!e.zh : e.k === kind && (S.book.mix > 0 || !isUnit(e.w))));
      if (hit) {
        const [k, e] = hit;
        if (e.k === 'free') return take({ kind: 'sent', w: -1, i: -1, free: k, en: e.en, zh: e.zh }, [e.en, e.zh], src(z).d);
        return take({ kind, w: e.w, i: e.i }, listOf(WX[e.w], kind)[e.i], WX[e.w]);
      }
    }
    const sr = src(z), L = listOf(sr.d, kind);
    const keys = range(L.length).filter(i => !used.has(kind + ':' + sr.w + ':' + i));
    const fresh = isUnit(sr.w) ? keys.filter(i => !S.rev.items[kind + ':' + sr.w + ':' + i]) : [];
    const i = fresh.length ? pick(fresh) : keys.length ? pick(keys) : rnd(L.length);
    return take({ kind, w: sr.w, i }, L[i], sr.d);
  }
  function freeQ(type, e, k) {   // AI 聊天句子出题：跟读或听音排句
    const q = { type, kind: 'sent', w: -1, i: -1, free: k, en: e.en, zh: e.zh, mean: meanOf(e), audio: e.en };
    if (type === 'lo') { q.tokens = tokens(e.en); q.bank = shuffle(range(q.tokens.length)); }
    else q.target = e.en;
    return q;
  }
  function buildReview() {
    const off = ((navigator.onLine === false && !localSR()) || aiDown()) && speakMode() === 'sr';   // 没网 / AI 用不了就打不了分：只出听力题（iPhone 的本机识别没网也行）
    return shuffle(dueList().slice(0, REV_N).map(([k, e]) => {
      // 聊天里改过的句子：有原话的让他直接说出对的（开口），没有原话的跟读或排句子；AI 用不了时先跳过的（owe）联网后一定开口
      if (e.k === 'free') return freeQ(e.en.split(/\s+/).length >= 3 && (off || (!e.said && !e.owe && Math.random() < .5)) ? 'lo' : 'sr_s', e, k);
      const t = e.owe && !off ? (e.k === 'word' ? 'sp' : e.k === 'sent' ? 'sr_s' : 'sr_d')
        : e.k === 'word' ? pick(off ? ['lw', 'ls'] : ['lw', 'ls', 'sp']) : e.k === 'sent' ? pick(off ? ['lm', 'lo'] : ['lm', 'lo', 'sr_s']) : off ? 'lr' : pick(['lr', 'sr_d']);
      const q = makeQ(t, e.w, e.i);
      q.rkey = k;
      return q;
    }));
  }
  function revSummary() {
    const d = dueList(), wrong = d.filter(([, e]) => !e.b).length, chat = d.filter(([, e]) => e.k === 'free').length;
    return { n: d.length, wrong, chat, old: d.length - wrong - chat };
  }
  function revCard() {   // 首页上方：今天的复习
    const r = revSummary();
    if (r.n && (dayLog().revSess || 0) > 0) return '<button class="rev-card done" data-act="review"><span>✅</span><div>' + trh('g.rev.card.again', { n: r.n }) + '</div></button>';
    if (!r.n) return '<div class="rev-card done"><span>✅</span><div>' + trh('g.rev.card.done') + '</div></div>';
    const parts = [r.wrong ? trh('g.rev.card.wrong', { n: r.wrong }) : '', r.old ? trh('g.rev.card.old', { n: r.old }) : '', r.chat ? trh('g.rev.card.chat', { n: r.chat }) : ''].filter(Boolean).join(' + ');
    return '<button class="rev-card" data-act="review"><span>📕</span><div><b>' + trh('g.rev.card.n', { n: r.n }) + '</b><small>' + parts + (r.n > REV_N ? trh('g.rev.card.per', { n: REV_N }) : '') + '</small></div><em>' + trh('g.home.start') + '</em></button>';
  }
  // ---------- 按掌握程度撤提示（家长 2026-10-07 定，评估第 9 条）----------
  // 0 = 看着念（新学的、刚错过的：第 0–1 格）；1 = 只给每个词的首字母（第 2–3 格）；2 = 凭记忆说，只给中文和图（第 4 格以上、已掌握）；
  // 3 = 聊天里老师改过的句子：显示他原来的说法（划掉）和中文，让他直接说出对的
  // fadeRaw 只看复习本的格子（和界面语言无关）；界面上用的是 fadeFor / fadeOf（按 cueMode 换，见下面）
  function fadeRaw(q) {
    if (!q) return 0;
    const e = S.rev.items[revKey(q)];
    if (!e) return 0;
    if (q.free && e.said) return 3;
    const b = e.due ? (e.b || 0) : GAP.length, pl = PLV();
    // 按能力走：级别低的多看几次才撤提示，级别高的更早凭记忆说（levels.js 的 kinds；初中级 = 以前的 2 格 / 4 格）
    const lv = pl != null && window.EchoLevels ? EchoLevels.fade(S.place.lang, pl, b) : b >= 4 ? 2 : b >= 2 ? 1 : 0;
    return lv === 2 && e.k === 'free' && !e.zh ? 1 : lv;   // 没有中文的聊天句子凭记忆说不出来：最多撤到首字母
  }
  // 提示文字：1 = 每个词留首字母（I u____ g__ u_）；2 = 字母全遮住（first：对话的回答留下第一个词）
  function cueText(text, lv, first) {
    if (LANG) return LANG.cue(String(text), lv, entryOf(text), first);   // 别的课：每门语言自己的遮法（日语留读音的第一拍、中文留拼音首字母……）
    const initial = w => { let seen = false; return w.replace(/[a-z]/gi, c => (seen ? '_' : (seen = true, c))); };
    return String(text).split(/\s+/).filter(Boolean).map((w, k) => lv >= 2 ? (first && k === 0 ? w : w.replace(/[a-z]/gi, '_')) : initial(w)).join('  ');
  }
  // ---------- 界面语言里没有意思时，题怎么出（规则只写在这里，2026-11-19）----------
  // 原来不少题靠中文意思：听音选义 / 听句选意（选中文意思）、看中文凭记忆说、对战咒语下面那行中文。
  // 界面语言里没有这条的意思（meanOf 给 null，比如英语界面）时，一道题也不能显示中文，又都要答得出来：
  // · 「选意思」换成「选听到的英文」（单词的选项带着图）：makeQ 里看 meanOf，设 q.ear
  // · 「看意思说」按条目换，cueMode(意思, 条目, 种类, live) 给出：
  //   'mean' 有意思（中文界面；以后别的语言在条目里加了 gloss[界面语言]）：和以前一模一样。
  //          对话（问 → 答）本来就不靠意思（问句就是提示），也是 'mean'；中文界面一律 'mean'（没写中文的聊天句子照老规矩，见 fadeRaw）
  //   'pic'  单词有表情图：看图说——格子照旧，只是意思那一行不显示（凭记忆 = 只给图，和「看图说英语」一样）
  //   'hear' 能先念一遍的地方（闯关、复习，live = true）：先念一遍，再看首字母说；凭记忆的也只撤到首字母
  //   'read' 都不行（对战：monsters.js 不先念句子）：看着念
  // 打分照旧：换出来的就是这条平常的题，不算带提示——P.aided 还是只看点提示、重听、看原文、第 2 次才说对；
  // 复习本的键、格子、到期、revRight / revWrong / revMiss、REV_* 一点不变。
  // 「不看字说对」（P.blind → recall / recallW，周报和神兽里程碑）：看图说算（题面上只有图，和看图说英语一样）；
  // 先念一遍再说的不算（刚听过答案）、看着念的不算——所以 'hear' 撤到首字母（格数 1，blind 是 false）
  // 钩子：以后的内容批次给单词 / 句子加了别的语言的意思，meanOf 自动读到，这里就回到 'mean'，不用改
  const zhUi = () => !I18N || I18N.lang() === 'zh';
  function cueMode(mean, it, kind, live) {
    if (kind === 'dlg' || mean != null || zhUi()) return 'mean';
    if (kind === 'word' && Array.isArray(it) && it[2]) return 'pic';
    return live ? 'hear' : 'read';
  }
  // 题对应的内容条目：单词 / 句子是 words / sents 里的那一条，聊天句子是复习本里的 { en, zh }
  const itemOfQ = q => (q.free ? S.rev.items[q.free] || q : WX[q.w] ? listOf(WX[q.w], q.kind)[q.i] || null : null);
  // 题面上「意思」那一行：中文界面就是 q.zh（和以前一模一样，空的也照样占一行）；别的界面语言用 makeQ 存的 q.mean（meanOf），没有就是 null（不显示）
  const qMean = q => (zhUi() ? q.zh || '' : q.mean != null ? q.mean : null);
  // 撤提示的格数，按界面语言换过。live：这里会先念一遍（闯关、复习）。改正说法（3）题面上有他原来的话，闯关里照旧
  function fadeFor(q, live) {
    const f = fadeRaw(q);
    if (!f) return f;
    // 别的课：对战里咒语下面那行也是 meanOf（monsters.js 的 t.mean，英语界面给英文意思）
    const it = itemOfQ(q), m = cueMode(live || LANG ? meanOf(it) : gloss({ zh: it && (Array.isArray(it) ? it[1] : it.zh) }), it, q.kind, live);
    return m === 'mean' || m === 'pic' ? f : live && f === 3 ? 3 : m === 'hear' ? 1 : 0;
  }
  // 对战（monsters.js 的 E.fadeOf）、EchoGame.rev.fade、place.fade 用这个：对战里咒语下面的意思那行只认 zh（gloss({ zh })），也不先念——
  // 界面语言里看不到意思的句子就看着念（不会撤到「凭记忆」、也不会只剩首字母），聊天句子不显示原话也是看着念
  const fadeOf = q => fadeFor(q, false);

  // ---------- 每日任务 ----------
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function ensureQuests() {
    const t = dayStr();
    const canTalk = () => talkLang() && !!(window.EchoTalk && EchoTalk.relayUrl());   // 别的课：服务器不会用这门语言聊就不出「和岛民聊天」（ENGINE.md §5、TALK.md §4）
    if (S.quests.day === t && S.quests.list.length) {
      // 别的课：今天的任务是在还不知道服务器会不会用这门语言聊的时候排的（刚打开游戏还没问到、后来才登录）——现在知道能聊了，
      // 把最后一个还没动过的任务换成「和岛民聊天」（英语课不走这里：它排任务时就知道）
      if (LANG && !S.quests.list.some(q => q.id === 'tk1') && canTalk()) {
        const idle = S.quests.list.map((q, k) => (!q.p && !q.claimed ? k : -1)).filter(k => k >= 0);
        if (idle.length) { S.quests.list[idle[idle.length - 1]] = { id: 'tk1', p: 0, claimed: false }; save(); }
      }
      return;
    }
    const r = seeded(t), talkOn = canTalk();
    const pool = QPOOL.filter(q => (q.key !== 'review' || dueList().length >= 5) && q.key !== 'talk');
    // 连得上 AI 对话服务时，每天固定有一个「和岛民聊天」的任务：每天都真的开口用英语交流
    const picked = talkOn ? [{ id: 'tk1', p: 0, claimed: false }] : [], keys = new Set(talkOn ? ['talk'] : []);
    let guard = 0;
    while (picked.length < 3 && guard++ < 100) {
      const q = pool[Math.floor(r() * pool.length)];
      if (keys.has(q.key)) continue;
      keys.add(q.key); picked.push({ id: q.id, p: 0, claimed: false });
    }
    S.quests = { day: t, list: picked, chest: false };
    save();
  }
  function qProg(key, n, isMax) {
    if (!isMax) { const L = dayLog(); L[key] = (L[key] || 0) + n; }
    ensureQuests();
    S.quests.list.forEach(q => {
      const d = QDEF[q.id];
      if (!d || d.key !== key || q.claimed) return;
      const was = q.p >= d.goal;
      q.p = Math.min(d.goal, isMax ? Math.max(q.p, n) : q.p + n);
      if (!was && q.p >= d.goal) toast(tr('g.task.done', { t: d.t }), 'gold');
    });
  }

  // ---------- 成就 ----------
  function checkAch() {
    ACH.forEach(([id, e, name, , cond]) => {
      if (S.ach[id] || !cond(S)) return;
      S.ach[id] = Date.now();
      S.coins += 20;
      toast(tr('g.toast.ach', { name }), 'gold');
      SFX.coin();
    });
    save();
  }

  // ---------- 提示与弹窗 ----------
  const recentToasts = {};
  function toast(msg, cls) {
    // 同一句提示 8 秒内只弹一次，避免连续朗读失败时刷屏
    const now = Date.now();
    if (recentToasts[msg] && now - recentToasts[msg] < 8000) return;
    recentToasts[msg] = now;
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
  function openModal(html, opts) {
    // 新打开的弹窗从顶上开始看（上一个弹窗滚到哪里不要带过来，比如菜单 → 背包）；
    // 同一个弹窗重画（设置里点选项、商店买东西，标题没变）保持原来滚到的位置
    const sh = $('#sheet'), wasHidden = $('#modal').hidden, h2 = () => { const e = sh.querySelector('h2'); return e ? e.textContent : ''; };
    const before = wasHidden ? null : h2();
    sh.innerHTML = html;
    $('#modal').hidden = false;
    if (wasHidden || before !== h2()) sh.scrollTop = 0;
    RT.modalLocked = !!(opts && opts.locked);
    const f = $('#sheet [data-focus]') || $('#sheet button:not([disabled])');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  // 弹窗关掉：家长输过密码的这一会儿也结束（家长设置看完关掉，孩子拿到手机就不能接着改）
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; RT.resetArm = false; RT.pin = null; RT.parentUntil = 0; }

  function confetti(n) {
    if (reduced) return;
    const c = $('#fx'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const Wd = window.innerWidth, Hd = window.innerHeight;
    c.width = Wd * dpr; c.height = Hd * dpr; ctx.scale(dpr, dpr);
    const cols = ['#FFC53D', '#FF6B57', '#2CAE69', '#0E7C86', '#8E6CEF', '#FF5E9C'];
    const ps = Array.from({ length: n || 140 }, () => ({ x: Wd / 2 + (Math.random() - .5) * 120, y: Hd * .38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: pick(cols) }));
    const t0 = performance.now();
    (function f(t) {
      ctx.clearRect(0, 0, Wd, Hd);
      ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(f); else ctx.clearRect(0, 0, Wd, Hd);
    })(t0);
  }

  // ---------- 首页 ----------
  function isUnlocked(wi, li) {
    if (S.settings.unlockAll) return true;
    if (isUnit(wi)) return li === 0 || (S.stars[wi + '-' + (li - 1)] || 0) > 0;   // 课本单元：哪个单元都能直接开始，单元里按顺序
    if (li === 0) return wi === 0 || (S.stars[(wi - 1) + '-6'] || 0) > 0;
    return (S.stars[wi + '-' + (li - 1)] || 0) > 0;
  }
  function currentNode() {
    for (let wi = 0; wi < W.length; wi++) for (let li = 0; li < 7; li++)
      if (isUnlocked(wi, li) && !(S.stars[wi + '-' + li] > 0)) return wi + '-' + li;
    return '';
  }
  const starStr = n => '<span>' + '★'.repeat(n) + '</span><span class="off">' + '★'.repeat(3 - n) + '</span>';

  function renderTop() {
    const L = lvInfo(S.xp);
    $('#t-pet').textContent = S.pet;
    $('#t-lv').textContent = 'Lv ' + L.lv;
    $('#t-title').textContent = titleOf(L.lv);
    $('#t-xp').style.width = (L.cur / L.need * 100) + '%';
    $('#t-coins').textContent = S.coins;
    $('#t-streak-n').textContent = S.streak;
    $('#t-streak').classList.toggle('off', S.lastDay !== dayStr());
    $('#t-streak').title = S.lastDay === dayStr() ? tr('g.home.streak.on', { n: S.streak }) : tr('g.home.streak.off');
    const n = dueList().length;
    $('#t-wrong').textContent = n ? n : '';
  }
  function questHTML() {
    ensureQuests();
    const L = S.quests.list;
    const allDone = L.length && L.every(q => q.claimed);
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.max(1, Math.round((mid - now) / 36e5));
    const rows = L.map(q => {
      const d = QDEF[q.id]; if (!d) return '';
      const done = q.p >= d.goal;
      const right = done && !q.claimed
        ? '<button class="btn small sun claim" data-act="claim" data-q="' + q.id + '">' + trh('g.home.claim', { n: d.rw }) + '</button>'
        : '<span class="q-rw">' + (q.claimed ? trh('g.home.claimed') : q.p + ' / ' + d.goal) + '</span>';
      return '<div class="q-row ' + (q.claimed ? 'done' : '') + '"><span class="q-name">' + d.t + '</span>' + right + '<span class="q-bar"><i style="width:' + Math.min(100, q.p / d.goal * 100) + '%"></i></span></div>';
    }).join('');
    const opened = S.quests.chest, ready = allDone && !opened;
    const chest = '<button class="chest-btn ' + (ready ? 'ready' : '') + '" data-act="chest" ' + (ready ? '' : 'disabled') + '><span class="ch">' + (opened ? '📭' : '🎁') + '</span><span><b>' + trh(opened ? 'g.home.chest.open' : ready ? 'g.home.chest.ready' : 'g.home.chest') + '</b><br><small>' + trh(opened ? 'g.home.chest.tmr' : 'g.home.chest.how') + '</small></span></button>';
    // 能力检测的卡片（placement.js）：还没测过的存档在这里给一张（不强拉进去）；做到一半的显示「继续」
    const pc = window.EchoPlace && EchoPlace.homeCard ? EchoPlace.homeCard() : '';
    // 新手路线（WORDS.md §9）在最上面；它开着时发音入门的卡片不另出（路线的第 ① 步就是它）
    const rt = routeCard();
    return rt + pc + (rt ? '' : primerCard()) + revCard() + '<div class="q-head"><h3>' + trh('g.home.tasks') + '</h3><small>' + trh('g.home.reset', { n: hrs }) + '</small></div>' + rows + chest;
  }
  const OFFS = [0, -56, -78, -34, 38, 76, 0];
  // 小岛 / 课本单元的名字（按界面语言）：小岛 isleName（你好岛 / Crayon Island），单元 unitTxt（七上 Unit 1 友谊 / 7A Unit 1 Friendship）
  const wxName = wi => (isUnit(wi) ? unitTxt(WX[wi]) : isleName(wi));
  function worldHTML(w, wi, cur) {
    const unlocked = isUnlocked(wi, 0);
    const tot = range(7).reduce((a, l) => a + (S.stars[wi + '-' + l] || 0), 0);
    const head = isUnit(wi) ? unitHead(w, wi, tot) : '<div class="w-head"><span class="w-ico">' + w.icon + '</span><div><div class="w-no">' + trh('g.home.isle.no', { n: wi + 1 }) + '</div><h2>' + esc(isleName(wi)) + '</h2><p class="w-en">' + esc(w.en) + '</p></div>' +
      (unlocked ? '<span class="w-stars">★ ' + tot + '/21</span>' : '<span class="w-lock">' + trh('g.home.isle.lock') + '</span>') + '</div>';
    if (!unlocked) return '<section class="world locked" style="--wc:' + w.color + '">' + head + '</section>';
    const nodes = RECIPES.map((r, li) => {
      const k = wi + '-' + li, st = S.stars[k] || 0, un = isUnlocked(wi, li), isCur = k === cur;
      const cls = ['node', r.boss ? 'boss' : '', st ? 'done' : '', un ? '' : 'lock', isCur ? 'cur' : ''].join(' ');
      return '<button class="' + cls + '" style="--x:' + OFFS[li] + 'px" data-act="level" data-w="' + wi + '" data-l="' + li + '"' + (un ? '' : ' disabled') + ' aria-label="' + esc(wxName(wi) + ' ' + r.name) + (un ? '' : trh('g.home.locked')) + '">' +
        (isCur ? '<span class="n-start">' + trh('g.home.start') + '</span><span class="n-pet">' + S.pet + '</span>' : '') +
        '<span class="n-ico">' + (un ? (r.boss ? w.boss.emoji : r.icon) : '🔒') + '</span>' +
        '<span class="n-name">' + (r.boss ? 'BOSS · ' + esc(bossName(w.boss)) : r.name) + '</span><span class="n-stars">' + (un ? starStr(st) : '') + '</span></button>';
    }).join('');
    const sc = window.SCENES && window.SCENES[wi], seen = S.scenes[wi];
    const scBtn = sc ? '<button class="scene-btn" data-act="scene" data-w="' + wi + '"><span class="sb-ico">🎬</span><span class="sb-t"><b>' + trh('g.home.scene', { t: gloss({ zh: sc.title }) || isleName(wi) }) + '</b><small>' +
      trh(seen && seen.watched ? 'g.home.scene.seen' : 'g.home.scene.new') + '</small></span><span class="sb-go">▶</span></button>' : '';
    // 小岛：头下面一排「📖 单词表」（课本单元的在 unitHead 的那一排里）
    const wl = isUnit(wi) ? '' : '<div class="u-bar">' + (lessonOf(wi) ? '<button class="btn small ghost" data-act="lesson" data-w="' + wi + '">' + trh('g.ls.btn') + '</button>' : '') + '<button class="btn small" data-act="wordList" data-w="' + wi + '">' + trh('g.wd.btn') + '</button></div>';
    // 🌱 一步一步学的那一排（开着、或者这一课学过至少一节小课才有）
    return '<section class="world' + (isUnit(wi) ? ' unit' + (wi - NB === curIdx() ? ' now' : '') : '') + '" id="w' + wi + '" style="--wc:' + w.color + '">' + head + wl + miniRow(wi) + '<div class="path">' + scBtn + nodes + '</div></section>';
  }
  // ---------- 课本单元（适用于沪教版词汇；不叫「同步」，也不说「配套」：评估「必须改」第 6 条） ----------
  // 销售版只开放买了的那个学年的册（2026-10-08 评审：卖的是「本学年」，下一学年的内容包另买）：
  // 打包时 -PECHO_BOOKS=hj7a,hj7b 写进原生（EchoNative.books()），没有就是七上、七下。家庭版全部开放
  const BOOK_OPEN = (() => {
    if (LANG || !(window.DEX && DEX.sales)) return null;   // 别的课：所有单元都开放（ENGINE.md §4）
    let v = ''; try { if (nat('books')) v = String(EchoNative.books() || ''); } catch (e) { v = ''; }
    const ids = v.split(',').map(x => x.trim()).filter(Boolean);
    return new Set(ids.length ? ids : ['hj7a', 'hj7b']);
  })();
  const bookOpen = id => !BOOK_OPEN || BOOK_OPEN.has(id);
  const unitOpen = i => !!BK[i] && bookOpen(BK[i].book);
  // 正在学哪个单元：家长/孩子在闯关页选；没选过就按日期猜——七上从 BOOKS.start 那年秋天开始，
  // 秋季学期 9 月到次年 1 月、春季学期 2 月到 8 月，一个学期 8 个单元，一个单元两周多
  function guessIdx() {
    if (LANG) return 0;   // 按日期猜学到哪只属于英语课（课本跟着学校走）；别的课从第一个单元开始
    const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1, start = (window.BOOKS && window.BOOKS.start) || y;
    const sem = Math.max(0, (y - start) * 2 + (m >= 9 ? 0 : m >= 2 ? -1 : -2));
    const b = BOOKS[Math.min(sem, BOOKS.length - 1)];
    // 猜到的册没开放（销售版过了这个学年）：停在开放的最后一个单元
    if (!bookOpen(b.id)) { let last = -1; BK.forEach((u, i) => { if (bookOpen(u.book)) last = i; }); return last; }
    const s0 = m >= 9 || m < 2 ? new Date(m >= 9 ? y : y - 1, 8, 1) : new Date(y, 1, 20);
    const n = Math.max(1, Math.min(b.units.length, 1 + Math.floor((d - s0) / 864e5 / 17)));
    return BK.findIndex(u => u.book === b.id && u.n === n);
  }
  function curIdx() {
    if (!BK.length) return -1;
    if (PLV() != null) { const i = levelIdx(); if (i >= 0) return i; }
    return bookIdx();
  }
  // 按课本走时正在学的单元（一直以来的算法）：自己选的，没选过按日期猜
  const bookIdx = () => (S.book.at >= 0 && unitOpen(Math.min(S.book.at, BK.length - 1)) ? Math.min(S.book.at, BK.length - 1) : guessIdx());
  // ---------- 按能力走（placement.js 的能力检测，levels.js 的内容对照表）----------
  // 检测完定一个起点单元 S.place.from（前面的「已免修」，照样能练）；「正在学」从 S.book.at 起（检测时 = 起点，自己点「设为正在学」可以改），
  // 打赢这个单元的 BOSS 关就自动挪到下一个单元（finish() 里）——按课本走是按日期猜，按能力走是学完一个走一个
  function levelIdx() {
    const i = Math.max(0, Math.min(S.book.at >= 0 ? S.book.at : S.place.from, BK.length - 1));
    return unitOpen(i) ? i : -1;
  }
  // 这个单元是不是已免修（按能力走时，起点前面的单元）
  const unitFree = i => PLV() != null && S.place.from > 0 && i >= 0 && i < S.place.from;
  // 第 lv 级会排到哪个单元（结果页「接下来这样安排」用；不改存档）
  function placePlan(lv) {
    if (!window.EchoLevels || !BK.length) return null;
    const a = EchoLevels.startAt(S.place.lang, lv, BK, unitOpen), u = BK[a.i];
    return u ? { i: a.i, fit: a.fit, free: a.i, unit: u.bshort + ' ' + unitNo(u.n) + ' · ' + u.en, top: EchoLevels.topLevel(S.place.lang, BK) } : null;
  }
  // 按现在的级别把课程排好。why：'test' 刚测完——有进度的老存档不往回挪（按课本已经学到后面的，「正在学」留在那儿，只是前面的标成已免修）；
  // 'adjust' 自己调了级别、'track' 换回「按能力」：就按这一级的起点来
  function placeApply(why) {
    const lv = S.place.lv;
    if (!(lv >= 0) || S.settings.track !== 'level') return;   // 选了「按课本」的不动（在设置里调级别也不动他正在学的单元）
    const a = placePlan(lv);
    if (!a) return;
    const was = bookIdx(), keep = why === 'test' && window.EchoPlace && EchoPlace.hasProgress() && was > a.i && unitOpen(was);
    let at = keep ? was : a.i;
    while (at < BK.length - 1 && unitOpen(at + 1) && (S.stars[(NB + at) + '-6'] || 0) > 0) at++;   // BOSS 已经打过的单元不用再当「正在学」
    S.place.from = a.i;
    S.book.at = at;
    S.book.vb = BK[curIdx()] ? BK[curIdx()].book : BK[a.i].book;
    RT.scrollCur = true;
  }
  // 挑战馆的课本门槛从哪个单元数起、数到哪儿为止（world.js 的 gymNeed）：按课本走是全部单元；按能力走从起点单元数起，只数开放的
  function unitSpan() {
    if (PLV() == null || !(S.place.from > 0)) return { from: 0, end: BK.length };
    let end = S.place.from; while (end < BK.length && unitOpen(end)) end++;
    return { from: S.place.from, end };
  }
  // 换界面语言（设置里、全新开始的语言选择页）
  function setUi(l) {
    if (!window.EchoI18n) return;
    S.settings.ui = EchoI18n.LANGS.some(x => x.id === l) ? l : 'zh';
    EchoI18n.set(S.settings.ui); save();
    if (typeof shellUi === 'function') shellUi();   // index.html 里写死的字（事件那一段）也换过来
  }
  // 全新开始时选了「谁在学」（placement.js，只在全新的存档上调）：孩子 → 'kid'；青少年 / 成人 → 'open'。
  // 这台设备上有家长密码（安装包打包的 / 网页版设过的）就要输对才换成 'open'，没输（关掉了密码键盘）就还是 'kid'——年龄段照样记着；
  // 家庭版的安装包没打包密码时没法确认，也留在 'kid'。销售版由家长首次设置向导定（setup.js），这里不动
  function learnerPick(who, cb) {
    const want = who === 'child' ? 'kid' : 'open', ps = pinState();
    if (window.DEX && DEX.sales) { cb(); return; }
    if (want === 'kid' || !kidMode()) { if (want === 'kid' && !kidMode()) { S.settings.learner = 'kid'; save(); } cb(); return; }
    if (!ps.has) { if (!ps.native) { S.settings.learner = 'open'; save(); } cb(); return; }
    let done = false, iv = 0;
    const end = () => { if (done) return; done = true; clearInterval(iv); cb(); };
    parentOk(tr('place.who.pin'), () => { S.settings.learner = 'open'; RT.parentUntil = 0; save(); closeModal(); end(); });
    if (!done) iv = setInterval(() => { if ($('#modal').hidden || !RT.pin) end(); }, 200);
  }
  // 能力检测的画面关掉了（how：'done' 做完了 / 'later' 以后再测 / 'paused' 做到一半先退出）：重画首页；全新的开始接着看游戏说明
  function afterPlace() {
    if (!$('#home').hidden) renderHome();
    if (!S.seenIntro && $('#modal').hidden) setTimeout(introSheet, 200);
  }
  const curUnit = () => BK[curIdx()] || null;
  const viewBook = () => { const vb = S.book.vb; return BOOKS.find(b => b.id === vb && bookOpen(b.id)) || BOOKS[(curUnit() || { bi: 0 }).bi]; };
  function unitHead(u, wi, tot) {
    const now = wi - NB === curIdx();
    const free = unitFree(wi - NB) ? ' <span class="u-free" title="' + trh('place.unit.free.tip') + '">✓ ' + trh('place.unit.free') + '</span>' : '';   // 按能力走：起点前面的单元
    // 单元的中文标题、语法讲解是内容（gloss）：界面语言里没有就不显示（语法弹窗整段是中文，按钮也收起来）
    // 别的课：单元的英文标题在 x.en、语法的英文在 grammar.en（course.json），意思按 glossC 取
    const zt = LANG ? glossC({ zh: u.zh, en: u.x && u.x.en }) : gloss({ zh: u.zh }), gt = LANG ? glossC({ zh: u.grammar.title, en: u.grammar.en && u.grammar.en.title }) : gloss({ zh: u.grammar.title });
    return '<div class="w-head"><span class="w-ico">' + u.icon + '</span><div><div class="w-no">' + esc(u.bshort) + ' · ' + esc(unitNo(u.n)) + (now ? trh('g.unit.now') : '') + free + '</div><h2>' + esc(u.en) + (zt != null ? ' <small>' + esc(zt) + '</small>' : '') + '</h2><p class="w-en">' + esc(u.key) + '</p></div>' +
      '<span class="w-stars">★ ' + tot + '/21</span></div>' +
      '<div class="u-bar">' + (gt != null ? '<button class="link" data-act="bookGram" data-w="' + wi + '">' + trh('g.unit.gram', { t: gt }) + '</button>' : '') +
      (lessonOf(wi) ? '<button class="btn small ghost" data-act="lesson" data-w="' + wi + '">' + trh('g.ls.btn') + '</button>' : '') +
      '<button class="btn small" data-act="wordList" data-w="' + wi + '">' + trh('g.wd.btn') + '</button>' +
      (unitTalk(u) ? '<button class="btn small sun" data-act="talk_open" data-npc="' + unitTalk(u).id + '">' + trh('g.unit.talk', { name: unitTalk(u).name }) + '</button>' : '') +
      (now ? '' : '<button class="btn small ghost" data-act="bookAt" data-i="' + (wi - NB) + '">' + trh('g.unit.setnow') + '</button>') + '</div>';
  }
  function unitTalk(u) {   // 这个单元的 AI 聊天角色（连不上对话服务就不显示；别的课：服务器不会用这门语言聊也不显示）
    if (!talkLang() || !window.EchoTalk || !EchoTalk.relayUrl() || !window.TALK_NPCS) return null;
    return window.TALK_NPCS.byId[u.book + '-u' + u.n] || null;
  }
  function bookNode() {   // 「开始」标在正在学的单元里第一关没拿星的地方
    const wi = NB + curIdx();
    for (let li = 0; li < 7; li++) if (isUnlocked(wi, li) && !(S.stars[wi + '-' + li] > 0)) return wi + '-' + li;
    return '';
  }
  function bookHTML() {
    const cu = curUnit(), vb = viewBook();
    const chips = '<div class="seg books">' + BOOKS.map(b => '<button class="' + (b === vb ? 'on' : '') + (bookOpen(b.id) ? '' : ' locked') + '" data-act="bookView" data-b="' + b.id + '">' + (bookOpen(b.id) ? '' : '🔒') + esc(bookShort(b)) + (b.id === cu.book ? ' 📍' : '') + '</button>').join('') + '</div>';
    // 别的课：叫「课程单元」，没有「适用于沪教版词汇」、没有「按日期猜的」（ENGINE.md §4）
    return '<div class="book-head"><b>' + trh(LANG ? 'g.unit.head.c' : 'g.unit.head') + '</b>' +
      '<p>' + (LANG ? trh('g.unit.all.c') : (BOOK_OPEN ? trh('g.unit.open', { list: BOOKS.filter(b => bookOpen(b.id)).map(bookShort).join(tr('g.unit.sep')) }) : trh('g.unit.all')) + trh('g.unit.what')) + '</p>' +
      '<p>' + trh('g.unit.cur', { u: cu.bshort + ' ' + unitNo(cu.n) + ' ' + cu.en }) + (S.book.at >= 0 || LANG ? '' : trh('g.unit.guess')) + ' <button class="link" data-act="bookPick">' + trh('g.unit.change') + '</button></p>' + chips +
      (vb.old ? '<p class="tip">' + trh('g.unit.old', { b: bookShort(vb) }) + '</p>' : '') + '</div>' +
      BK.map((x, j) => x.book === vb.id ? worldHTML(x, NB + j, bookNode()) : '').join('');
  }
  // 别的课的「今日目击」卡片（TALK.md 第二轮 C）：monsters.js 的首页在别的课里不放它（那一行还写着「别的语言的课先不出」），
  // 这门课有线索的译文时（EchoSight.on()）在这里补上——和英语课同一个位置：「传说的线索」前面；没有那张卡片就放在「飞去哪」上面那行小提示前面。
  // 今天的线索查不到译文、还没开始冒险：homeCard() 给的是空的，什么都不加。英语课不走这里
  function sightHome() {
    try {
      const ES = window.EchoSight, box = $('#mon-home');
      if (!LANG || !ES || !ES.on || !ES.on() || !box || !(S.world && S.world.started) || $('.sight', box)) return;   // 已经有这张卡片了（monsters.js 以后自己放的话）：不放第二张
      const h = ES.homeCard();
      if (!h) return;
      const tips = $$(':scope > p.tip:not(.obj)', box), at = $(':scope > .mon-card.legends', box) || (tips.length >= 2 ? tips[tips.length - 2] : null);
      if (at) at.insertAdjacentHTML('beforebegin', h); else box.insertAdjacentHTML('beforeend', h);
    } catch (e) { console.error(e); }
  }
  function renderHome() {
    renderTop();
    homeBars();   // AI 用不了的红条、有新版本
    const talkOn = !!(window.EchoTalk && EchoTalk.relayUrl());   // 连得上对话服务才显示「和岛民聊天」
    const tab = S.homeTab === 'talk' && talkOn ? 'talk' : window.MonsterGame && S.homeTab !== 'quiz' ? 'mon' : 'quiz';
    $('#tabs').innerHTML = window.MonsterGame ? '<button class="' + (tab === 'mon' ? 'on' : '') + '" data-act="tab" data-t="mon">' + trh('g.home.tab.mon') + '</button><button class="' + (tab === 'quiz' ? 'on' : '') + '" data-act="tab" data-t="quiz">' + trh('g.home.tab.quiz') + '</button>' +
      (talkOn ? '<button class="' + (tab === 'talk' ? 'on' : '') + '" data-act="tab" data-t="talk">' + trh('g.home.tab.talk') + '</button>' : '') : '';
    $('#tabs').classList.toggle('three', talkOn);
    $('#quests').innerHTML = questHTML();
    $('#mon-home').hidden = tab !== 'mon';
    const go = $('#mon-go'); if (go) { go.hidden = tab !== 'mon'; if (tab !== 'mon') go.innerHTML = ''; }
    $('#quiz-home').hidden = tab !== 'quiz';
    $('#talk-home').hidden = tab !== 'talk';
    if (tab === 'talk') { $('#talk-home').innerHTML = EchoTalk.homeHTML(); return; }
    // 「冒险」栏：「继续冒险」和那行 📍 放在最上面的 #mon-go（每日任务卡片上面，2026-11-23 老板：「挪」），怪兽卡片和别的照旧在 #mon-home
    if (tab === 'mon') {
      const hp = MonsterGame.homeParts ? MonsterGame.homeParts() : { top: '', body: MonsterGame.homeHTML() };
      if (go) { go.innerHTML = hp.top; go.hidden = !hp.top; }
      $('#mon-home').innerHTML = go ? hp.body : hp.top + hp.body;
      if (LANG) sightHome(); MonsterGame.afterHome(); return;
    }
    const book = BK.length && S.book.view !== 'isle';
    const seg = BK.length ? '<div class="seg qv"><button class="' + (book ? 'on' : '') + '" data-act="quizView" data-v="book">' + trh(LANG ? 'g.home.qv.course' : 'g.home.qv.book') + '</button><button class="' + (book ? '' : 'on') + '" data-act="quizView" data-v="isle">' + trh('g.home.qv.isle') + '</button></div>' : '';
    const cur = currentNode();
    // 最上面一排：📒 我的单词本、🔤 发音入门（WORDS.md §3 §4）
    $('#map').innerHTML = wordsBar() + seg + (book ? bookHTML() : W.map((w, wi) => worldHTML(w, wi, cur)).join(''));
    if (RT.scrollCur) {
      RT.scrollCur = false;
      const n = $('.node.cur');
      if (n) setTimeout(() => n.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 120);
    }
  }
  // 样品美术（?art=blender / gemini）加载完之后，首页的怪兽卡片重画一次
  window.addEventListener('mon3d-ready', () => { if (!$('#home').hidden) renderHome(); });
  function show(id) {
    if (RT.scr === 'battle' && id === 'world') { RT.battleEnd = Date.now(); setTimeout(advTick, 600); }   // 刚打完一场（护眼提醒、时间到了都等这个时候）
    if (RT.scr === 'world' && id !== 'world') flushWalk();   // 离开大地图（开战、回首页）：走路攒下的先整份存好
    RT.scr = id;
    ['home', 'play', 'result', 'theater', 'battle', 'world'].forEach(s => { $('#' + s).hidden = s !== id; document.body.classList.toggle('scr-' + s, s === id); });
    $('#topbar').hidden = id === 'play' || id === 'theater' || id === 'battle' || id === 'world';
    document.body.classList.toggle('in-world', id === 'world');
    window.scrollTo(0, 0);
    sceneMusic();
  }
  function goHome(tab) {
    if (typeof tab === 'string') S.homeTab = tab;
    if (window.MonsterGame) MonsterGame.stop();
    if (window.EchoWorld) EchoWorld.stop();
    if (T) { stopScene(); T = null; }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    P = null;
    hideFb();
    RT.scrollCur = true;
    show('home');
    renderHome();
  }

  // 从大地图的「📍 现在要做」直接去要学的那个课本单元（2026-11-20 老板：「现在要做点了可以直接跳到要做的事情那里」）：
  // 和「回首页」走同一条路离开大地图（goHome：存档整份存好、冒险计时停下），打开闯关练习的课本单元，滚到这个单元的 BOSS 关并亮一下；
  // BOSS 还没解锁就亮这个单元第一关没拿星的。不改「正在学」的单元
  function goUnit(wi) {
    if (!isUnit(wi) || !BK[wi - NB]) { goHome('quiz'); return; }
    S.book.view = 'book'; S.book.vb = BK[wi - NB].book; save();
    goHome('quiz');
    let li = 6; if (!isUnlocked(wi, 6)) { li = 0; for (let k = 0; k < 7; k++) if (isUnlocked(wi, k) && !(S.stars[wi + '-' + k] > 0)) { li = k; break; } }
    const n = $('#w' + wi + ' .node[data-l="' + li + '"]');
    if (n) { n.classList.add('goal'); setTimeout(() => n.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 250); setTimeout(() => n.classList.remove('goal'), 6000); }
    return { wi, li };
  }

  // ---------- 关卡详情 ----------
  function levelSheet(wi, li) {
    const w = WX[wi], r = RECIPES[li];
    const st = S.stars[wi + '-' + li] || 0;
    // 听音选义 / 听句选意：这一关的内容在界面语言里没有意思时，出的是「选听到的英文」（makeQ 的 q.ear），标签跟着换
    const ear = t => (t === 'lw' && meanOf(w.words[0]) == null) || (t === 'lm' && meanOf(w.sents[0]) == null);
    const types = [...new Set(r.mix.map(m => m[0]))].map(t => '<span class="tag">' + (ear(t) ? trh('g.cue.' + t + '.tag') : TYPE_TAG[t]) + '</span>').join('');
    // 原来收起来的「先预习一下」换成「📖 单词表」按钮（WORDS.md §1：打开这个小镇 / 单元的单词表，关上回到这里）
    openModal(
      '<div class="big">' + (r.boss ? w.boss.emoji : r.icon) + '</div>' +
      '<h2>' + esc(wxName(wi)) + ' · ' + (r.boss ? 'BOSS ' + esc(bossName(w.boss)) : r.name) + '</h2>' +
      '<p>' + r.desc + (r.boss ? '' : trh('g.det.count', { n: r.mix.reduce((a, m) => a + m[1], 0) })) + '</p>' +
      '<div class="lv-types">' + types + '</div>' +
      (st ? '<p>' + trh('g.det.best') + '<span class="n-stars" style="font-size:18px">' + starStr(st) + '</span></p>' : '') +
      (li === 4 && window.SCENES && window.SCENES[wi] ? '<button class="btn sun wide" data-act="scene" data-w="' + wi + '">' + trh('g.det.scene') + '</button>' : '') +
      '<button class="btn ghost wide wd-open" data-act="wordList" data-w="' + wi + '" data-l="' + li + '">' + trh('g.wd.btn') + '</button>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + trh('g.det.later') + '</button><button class="btn" data-act="start" data-w="' + wi + '" data-l="' + li + '" data-focus>' + trh('g.det.go') + '</button></div>'
    );
  }

  // ---------- 单词表、先认识再闯关（单词卡）、我的单词本、发音入门（tools/course/WORDS.md，2026-11-22）----------
  // 老板：「应该做一个单词表出来的，不然完全的新手根本不懂那个语言，怎么学习呢？」英语课也有前三样；发音入门只给别的语言的课（course.json 有 PRIMER 才有）。
  // 单词的状态读复习本（S.rev.items，键和 revKey 一样：'word:' + 编号 + ':' + 第几个）：在复习本里、还有到期日 = 🔁 在复习；在复习本里、掌握了 = ✅ 已掌握；
  // 不在复习本里：这个小镇 / 单元拿过星 = ✅（小岛的题答对了本来就不进复习本，拿过星就算学过了——单词本「拿过星的小镇 / 单元的全部单词」也这么算），没拿过 = 🆕 还没练过
  const wdKey = (wi, i) => 'word:' + wi + ':' + i;
  const wxStarred = wi => range(7).some(l => (S.stars[wi + '-' + l] || 0) > 0);
  function wdState(wi, i) {
    const e = S.rev.items[wdKey(wi, i)];
    if (e) return e.due ? 'rev' : 'ok';
    return wxStarred(wi) ? 'ok' : 'new';
  }
  const WD_ICON = { new: '🆕', rev: '🔁', ok: '✅' };
  const wdBadge = st => '<span class="wd-st st-' + st + '" title="' + esc(tr('g.wd.st.' + st)) + '" aria-label="' + esc(tr('g.wd.st.' + st)) + '">' + WD_ICON[st] + '</span>';
  const SAY_BTN = (t, act) => '<button class="spk mini wd-say" data-act="' + (act || 'wdSay') + '" data-t="' + esc(t) + '" aria-label="' + esc(tr('g.wd.say')) + '">' + SPK + '</button>';
  // 界面语言那一份（数据里 { zh, en } 的说明）：界面语言没有就英文，中文界面没有就不显示（不拿英文顶）
  const uiPick = o => { if (!o) return ''; const l = I18N ? I18N.lang() : 'zh'; return typeof o[l] === 'string' && o[l] ? o[l] : l === 'zh' ? '' : o.en || ''; };
  // ---------- 日语的罗马字（WORDS.md §5）：只在这四样里多一行；单词表顶上的开关 S.settings.romaji（没有 = 开着）----------
  const romaOn = () => COURSE === 'ja' && !!LANG && typeof LANG.romaji === 'function' && S.settings.romaji !== false;
  const RO_TAIL = /[、。！？!?，,…]+$/;
  // 按词分开写（主会话 2026-11-22）：这门课认得的词的读音（平假名）——课程里每个词的读音、句子每个词块去掉块尾助词的读音、读音表（LEX）里的读音。
  // lang-ja.js 的 romajiWords 拿它从左往右按最长的切（田中先生 → tanaka sensei，島に → shima ni，おはようございます → ohayou gozaimasu）
  let RKN = null;
  function romaKnown() {
    if (RKN && RKN.n === ENTRY.size && RKN.wx === WX) return RKN.s;
    const s = new Set(), hira = x => String(x || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s　、。！？!?「」『』，,.…〜～]+/g, '');
    const PART = /(から|まで|より|には|では|は|が|を|に|で|と|も|へ|の|や|か|ね|よ)$/;
    const add = r => { r = hira(r); if (r.length >= 2 && !/[㐀-鿿々]/.test(r)) s.add(r); };
    WX.forEach(w => (w.words || []).forEach(it => { const g = glossObj(it); if (g && typeof g.r === 'string') add(g.r); }));
    ENTRY.forEach(e => { if (Array.isArray(e.seg) && Array.isArray(e.r)) e.r.forEach(r => { const h = hira(r); add(PART.test(h) ? h.replace(PART, '') : h); }); });
    if (LEX && LEX.map) LEX.map.forEach(rs => (rs || []).forEach(add));
    RKN = { s, n: ENTRY.size, wx: WX };
    return s;
  }
  // 一个词 / 一句话的罗马字：按条目的读音，按词分开写（词的 r 是一串：切得开才切；句子按 seg 一块一块再切，块尾的标点照搬）；还剩汉字、读不出来的不显示（''）
  function romaOf(text, r0) {
    if (!romaOn()) return '';
    const e = entryOf(text), K = romaKnown(), RW = (r, o) => (LANG.romajiWords ? LANG.romajiWords(r, K, o) : LANG.romaji(r, o && o.whole ? undefined : { block: true }));
    let out = '';
    if (r0) out = RW(String(r0).replace(RO_TAIL, ''), { whole: true }) + LANG.romaji((RO_TAIL.exec(String(r0)) || [''])[0]);
    else if (e && Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length) out = e.r.map((r, k) => RW(String(r).replace(RO_TAIL, ''), { block: true }) + LANG.romaji((RO_TAIL.exec(e.seg[k]) || [''])[0])).join(' ');
    else if (e && typeof e.r === 'string') out = RW(e.r.replace(RO_TAIL, ''), { whole: true }) + LANG.romaji((RO_TAIL.exec(e.r) || [''])[0]);
    else if (/^[ぁ-ゖァ-ヺー\s、。！？]+$/.test(String(text))) out = RW(String(text).replace(RO_TAIL, ''), { whole: true }) + LANG.romaji((RO_TAIL.exec(String(text)) || [''])[0]);
    out = out.replace(/\s+([,.?!])/g, '$1').replace(/\s+/g, ' ').trim();
    return /^[\x20-\x7e]+$/.test(out) ? out : '';
  }
  const romaHTML = (text, r0) => { const r = romaOf(text, r0); return r ? '<span class="wd-rom" lang="ja-Latn">' + esc(r) + '</span>' : ''; };
  // ---------- 例句：这一课 sents 里第一句含这个词的（英语、西语按词，日语中文按子串）；没有 → null ----------
  const wdToks = s => String(s).toLowerCase().normalize('NFC').replace(/[’‘]/g, "'").replace(/[¿¡.,!?;:"“”()«»…—–]/g, ' ').split(/\s+/).filter(Boolean);
  function wdExample(w, word) {
    const ss = (w && w.sents) || [];
    if (!LANG || LANG.script === 'latin') {
      const need = wdToks(word);
      if (!need.length) return null;
      return ss.find(s => { const t = wdToks(s[0]); for (let i = 0; i + need.length <= t.length; i++) if (need.every((x, k) => t[i + k] === x)) return true; return false; }) || null;
    }
    const core = String(word).replace(/[\s、。！？!?「」]/g, '');
    return core ? ss.find(s => String(s[0]).includes(core)) || null : null;
  }
  function wdExHTML(w, word) {
    const s = wdExample(w, word);
    if (!s) return '';
    const m = meanOf(s);
    return '<div class="wd-ex"><div class="wd-ex-t"><span>' + rb(s[0]) + '</span>' + SAYS(s[0]) + '</div>' + romaHTML(s[0]) + (m ? '<small>' + esc(m) + '</small>' : '') + '</div>';
  }
  // 一个词（单词表、单词本）：图、词（读音）、罗马字、意思、状态、🔊；ex = 例句直接画出来；attrs = 整行的属性（单词本：点一下展开例句）
  function wdRow(wi, i, ex, attrs) {
    const w = WX[wi], it = w.words[i], m = meanOf(it), st = wdState(wi, i);
    return '<div class="wd-row" data-st="' + st + '"' + (attrs || '') + '><span class="wd-pic" aria-hidden="true">' + esc(it[2] || '') + '</span>' +
      '<div class="wd-main"><div class="wd-w"><b>' + rb(it[0]) + '</b>' + wdBadge(st) + '</div>' + romaHTML(it[0]) + (m != null && m !== '' ? '<div class="wd-m">' + esc(m) + '</div>' : '') + (ex ? wdExHTML(w, it[0]) : '') + '</div>' +
      SAYS(it[0]) + '</div>';
  }
  function sentRow(s) {
    const m = meanOf(s);
    return '<div class="wd-row wd-srow"><div class="wd-main"><div class="wd-s">' + rb(s[0]) + '</div>' + romaHTML(s[0]) + (m ? '<div class="wd-m">' + esc(m) + '</div>' : '') + '</div>' + SAYS(s[0]) + '</div>';
  }
  // 标题：小镇 / 单元名。别的课：这门课的写法做大字 + 界面语言的名字做小字（和 world.js townTag 一个排法）
  function wdTitle(wi) {
    const w = WX[wi];
    if (isUnit(wi)) {
      const zt = LANG ? glossC({ zh: w.zh, en: w.x && w.x.en }) : gloss({ zh: w.zh });
      return '<small class="wd-no">' + esc(w.bshort + ' · ' + unitNo(w.n)) + '</small><h2>' + (LANG ? '<span class="pl-c"><b>' + rubyLine(w.en) + '</b>' + (zt ? '<small>' + esc(zt) + '</small>' : '') + '</span>' : esc(w.en) + (zt ? ' <small>' + esc(zt) + '</small>' : '')) + '</h2>';
    }
    const no = '<small class="wd-no">' + trh('g.home.isle.no', { n: wi + 1 }) + '</small>';
    if (LANG) return no + '<h2><span class="pl-c"><b>' + rubyLine(w.en) + '</b><small>' + esc(isleName(wi)) + '</small></span></h2>';
    return no + '<h2>' + esc(isleName(wi)) + ' <small>' + esc(w.en) + '</small></h2>';
  }
  // 单元的语法（标题 + 说明，按界面语言；英语课的语法讲解只有中文，英语界面就没有）
  function wdGram(w) {
    if (!w || !w.grammar) return null;
    const ge = (LANG && w.grammar.en) || {};
    const t = LANG ? glossC({ zh: w.grammar.title, en: ge.title }) : gloss({ zh: w.grammar.title });
    const p = LANG ? glossC({ zh: w.grammar.tip, en: ge.tip }) : gloss({ zh: w.grammar.tip });
    return t == null && p == null ? null : { t: t || '', p: p || '' };
  }

  // ---------- 📖 单词表（WORDS.md §1）----------
  // back：关上以后回到哪——{ li } 关卡详情、'menu' 大地图的冒险菜单；没有就只有「关闭」
  function wordList(wi, back) {
    const w = WX[wi];
    if (!w) return;
    RT.wl = { wi, back: back || null };
    const g = isUnit(wi) ? wdGram(w) : null, ws = w.words || [], ss = w.sents || [];
    const gram = g ? '<div class="wd-gram"><b>' + trh('g.wd.gram', { t: g.t }) + '</b>' + (g.p ? '<p>' + esc(g.p) + '</p>' : '') + '</div>' : '';
    const tog = COURSE === 'ja' && LANG && LANG.romaji ? '<div class="wd-tog"><span>' + trh('g.wd.roma') + '</span><div class="seg"><button class="' + (S.settings.romaji !== false ? 'on' : '') + '" data-act="wdRoma" data-v="1">' + trh('g.wd.roma.on') + '</button><button class="' + (S.settings.romaji === false ? 'on' : '') + '" data-act="wdRoma" data-v="0">' + trh('g.wd.roma.off') + '</button></div></div>' : '';
    // 顶上：📘 这一课学什么（有课前讲解的才有，§7）、▶ 用单词卡过一遍、罗马字开关
    const tools = (lessonOf(wi) ? '<button class="link wd-ls" data-act="lesson" data-w="' + wi + '" data-from="list">' + trh('g.ls.btn') + ' ›</button>' : '') +
      '<div class="wd-tools">' + (ws.length ? '<button class="btn small" data-act="wcOpen" data-w="' + wi + '">' + trh('g.wd.cards') + '</button>' : '') + tog + '</div>';
    openModal('<div class="wd-head"><span class="w-ico" style="background:' + esc(w.color || '') + '">' + esc(w.icon || '') + '</span><div class="wd-ht"><small class="wd-k">' + trh('g.wd.h') + '</small>' + wdTitle(wi) + '</div></div>' + gram + tools +
      '<p class="wd-legend">' + trh('g.wd.legend') + '</p>' +
      '<h3 class="wd-h">' + trh('g.wd.words', { n: ws.length }) + '</h3><div class="wd-list">' + (ws.length ? ws.map((it, i) => wdRow(wi, i, true)).join('') : '<p class="wd-legend">' + trh('g.wd.none') + '</p>') + '</div>' +
      (ss.length ? '<details class="pre wd-sents"><summary>' + trh('g.wd.sents', { n: ss.length }) + '</summary><div class="wd-list wd-slist">' + ss.map(sentRow).join('') + '</div></details>' : '') +
      '<div class="row">' + (back ? '<button class="btn ghost" data-act="wdBack">' + trh('g.wd.back') + '</button>' : '') + '<button class="btn" data-act="close" data-focus>' + trh('g.close') + '</button></div>');
  }

  // ---------- 先认识再闯关：单词卡（WORDS.md §2）----------
  // 第一次点开一个小镇 / 单元的第 1 关（这一关没有星、这一课没看过单词卡）：先一张一张认识这一课的词，再开考。看过（看完或跳过）记 S.seenCards[编号] = 日期。
  // 开关 S.settings.cards：true 开、false 关、没有 = 开着——只是自动化测试的浏览器（navigator.webdriver）里没写就当关着、网址带 ?nocards 也关：
  // 好多老测试自己写存档、点第 1 关就开考，不能因为这个改流程（tests/helpers.js 造的存档写着 cards: false；新测试写 cards: true）
  const cardsOn = () => S.settings.cards === true || (S.settings.cards !== false && !navigator.webdriver && !/[?&]nocards\b/.test(location.search));
  const cardsFirst = (wi, li) => li === 0 && cardsOn() && !!WX[wi] && (WX[wi].words || []).length > 0 && !((S.stars[wi + '-0'] || 0) > 0) && !(S.seenCards || {})[wi];
  function cardsSeen(wi) { if (!S.seenCards || typeof S.seenCards !== 'object') S.seenCards = {}; if (!S.seenCards[wi]) { S.seenCards[wi] = dayStr(); save(); } }
  // 开始一关：第一次进第 1 关先看「这一课学什么」（§7）、再过一遍单词卡，再开考
  function levelGo(wi, li) {
    // 开着「一步一步学」、这一课的小课还没学完：先问一句（tools/course/STARTER.md）
    if (li === 0 && miniFirst(wi)) { miniAsk(wi, li); return; }
    if (lessonFirst(wi, li)) { lessonSheet(wi, { li }); return; }
    if (cardsFirst(wi, li)) { openCards(wi, { li }); return; }
    startLevel(wi, li);
  }
  // o.li：看完开始哪一关（从「开始闯关」来的）；o.list：从单词表来的（看完回单词表，o.back 是单词表自己的 back）
  function openCards(wi, o) {
    const w = WX[wi]; if (!w) return;
    o = o || {};
    const g = isUnit(wi) ? wdGram(w) : null;
    RT.wc = { wi, k: 0, list: (g ? [{ g }] : []).concat((w.words || []).map((_, i) => ({ i }))), li: o.li != null ? o.li : null, list0: !!o.list, back: o.back || null };
    primeTTS(); ac();
    cardShow();
  }
  function cardShow() {
    const c = RT.wc; if (!c) return;
    const w = WX[c.wi], n = c.list.length, cur = c.list[c.k], last = c.k === n - 1;
    const dots = '<div class="wc-dots" aria-hidden="true">' + c.list.map((x, k) => '<i class="' + (k === c.k ? 'on' : k < c.k ? 'past' : '') + '"></i>').join('') + '</div>';
    let body;
    if (cur.g) body = '<div class="wc-card gram" id="wc-card"><div class="wc-pic">📐</div><div class="wc-tag">' + trh('g.wc.gram') + '</div><h3>' + esc(cur.g.t) + '</h3>' + (cur.g.p ? '<p class="wc-tip">' + esc(cur.g.p) + '</p>' : '') + '</div>';
    else {
      const it = w.words[cur.i], m = meanOf(it), ro = romaOf(it[0]);
      body = '<div class="wc-card" id="wc-card"><div class="wc-pic" aria-hidden="true">' + esc(it[2] || '') + '</div><div class="wc-word">' + rb(it[0]) + '</div>' +
        (ro ? '<div class="wc-rom" lang="ja-Latn">' + esc(ro) + '</div>' : '') + (m != null && m !== '' ? '<div class="wc-mean">' + esc(m) + '</div>' : '') +
        '<div class="wc-says"><button class="spk wc-say" data-act="wcSay" aria-label="' + esc(tr('g.wc.say')) + '">' + SPK + '</button>' +
        '<button class="slow wc-slow" data-act="wcSlow" aria-label="' + esc(tr('g.wd.slow')) + '"><span>🐢</span>' + trh('g.play.slow') + '</button></div></div>';
    }
    const top = '<div class="wc-top"><span class="wc-n">' + trh('g.wc.n', { i: c.k + 1, n }) + '</span>' + (c.li != null ? '<button class="link wc-skip" data-act="wcSkip">' + trh('g.wc.skip') + '</button>' : '<button class="link wc-skip" data-act="wcEnd">' + trh('g.wd.back') + '</button>') + '</div>';
    const fin = c.li != null ? '<button class="btn sun" data-act="wcGo" data-focus>' + trh('g.wc.go') + '</button>' : '<button class="btn" data-act="wcEnd" data-focus>' + trh('g.wc.done') + '</button>';
    openModal('<div class="wc" id="wc">' + top + dots + body + '<p class="wc-hint">' + trh('g.wc.swipe') + '</p></div>' +
      '<div class="row wc-nav"><button class="btn ghost" data-act="wcPrev"' + (c.k ? '' : ' disabled') + ' aria-label="' + esc(tr('g.wc.prev')) + '">←</button>' +
      (last ? fin : '<button class="btn" data-act="wcNext" data-focus aria-label="' + esc(tr('g.wc.next')) + '">→</button>') + '</div>');
    // 出现时自动念一遍（女声）；再点 🔊 是男声（没有男声的配音就是女声，packClip / clipUrl 自己会退）
    if (!cur.g) { const word = w.words[cur.i][0]; setTimeout(() => { if (RT.wc === c && c.list[c.k] === cur && $('#wc')) say(word, undefined, 'f'); }, 120); }
  }
  function cardStep(d) {
    const c = RT.wc; if (!c || !$('#wc')) return;
    const k = c.k + d;
    if (k < 0 || k >= c.list.length) return;
    c.k = k; SFX.tap(); cardShow();
  }
  // 看完 / 跳过：记一笔；从「开始闯关」来的开考，从单词表来的回单词表
  function cardEnd(go) {
    const c = RT.wc; if (!c) return;
    RT.wc = null;
    cardsSeen(c.wi);
    if (c.li != null) { closeModal(); if (go) startLevel(c.wi, c.li); return; }
    if (c.list0) wordList(c.wi, c.back); else closeModal();
  }
  // 单词卡：左右滑翻页（手机上手指、电脑上按住鼠标拖都行；#wc 的 touch-action 只让上下滚，横着滑归这里）
  let wcSw = null;
  document.addEventListener('pointerdown', e => { wcSw = RT.wc && e.target && e.target.closest && e.target.closest('#wc') ? { x: e.clientX, y: e.clientY } : null; }, true);
  document.addEventListener('pointerup', e => {
    const s = wcSw; wcSw = null;
    if (!s || !RT.wc || !$('#wc')) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) cardStep(dx < 0 ? 1 : -1);
  }, true);

  // ---------- 📒 我的单词本（WORDS.md §3）----------
  // 学过的词 = 复习本里的词（k === 'word'）+ 拿过星的小镇 / 单元的全部单词。按小镇 / 单元分组，新的在上（这一组的词最近一次进复习本 / 复习的日期，
  // 一样的按编号从大到小）；同一个写法只算一次（留最上面那组的）。每门课各自一本（跟着这门课的存档走）
  const wdNorm = t => String(t == null ? '' : t).toLowerCase().normalize('NFC').trim();
  function bookWords() {
    const by = new Map();
    const add = (wi, i) => { const w = WX[wi]; if (!w || !w.words || !w.words[i]) return; if (!by.has(wi)) by.set(wi, new Set()); by.get(wi).add(i); };
    for (const e of Object.values(S.rev.items || {})) if (e && e.k === 'word') add(e.w, e.i);
    WX.forEach((w, wi) => { if (wxStarred(wi)) (w.words || []).forEach((_, i) => add(wi, i)); });
    const dateOf = wi => { let d = ''; by.get(wi).forEach(i => { const e = S.rev.items[wdKey(wi, i)], x = e ? e.seen || e.c || '' : ''; if (x > d) d = x; }); return d; };
    const seen = new Set(), out = [];
    [...by.keys()].map(wi => ({ wi, d: dateOf(wi) })).sort((a, b) => b.d.localeCompare(a.d) || b.wi - a.wi).forEach(g => {
      const items = [...by.get(g.wi)].sort((a, b) => a - b).filter(i => { const k = wdNorm(WX[g.wi].words[i][0]); if (seen.has(k)) return false; seen.add(k); return true; }).map(i => ({ wi: g.wi, i, st: wdState(g.wi, i) }));
      if (items.length) out.push({ wi: g.wi, items });
    });
    return out;
  }
  const bookCount = () => bookWords().reduce((s, g) => s + g.items.length, 0);
  const WB_STEP = 240;   // 一次画多少个词（玩了几年的单词本有几千个词：先画这么多，「再显示」接着画）
  function wordBook() {
    RT.wb = RT.wb || { f: 'all', q: '', n: 1 };
    RT.wb.n = 1;
    const all = bookWords(), flat = all.flatMap(g => g.items), nr = flat.filter(x => x.st === 'rev').length;
    const stat = (n, k) => '<div class="stat"><b>' + n + '</b><small>' + trh(k) + '</small></div>';
    openModal('<h2>' + trh('g.wb.h') + '</h2>' +
      (flat.length ? '<div class="r-stats wb-stats">' + stat(flat.length, 'g.wb.all') + stat(nr, 'g.wb.rev') + stat(flat.length - nr, 'g.wb.ok') + '</div>' +
        '<div class="seg wb-f">' + ['all', 'rev', 'ok'].map(f => '<button class="' + (RT.wb.f === f ? 'on' : '') + '" data-act="wbF" data-f="' + f + '">' + trh('g.wb.f.' + f) + '</button>').join('') + '</div>' +
        '<input id="wb-q" class="wb-q" type="search" autocomplete="off" spellcheck="false" placeholder="' + esc(tr('g.wb.q')) + '" aria-label="' + esc(tr('g.wb.q')) + '" value="' + esc(RT.wb.q) + '">' +
        '<p class="wd-legend">' + trh('g.wb.tap') + '</p><div id="wb-list" class="wb-list"></div>'
        : '<p>' + trh('g.wb.empty') + '</p>') +
      '<div class="row"><button class="btn" data-act="close">' + trh('g.close') + '</button></div>');
    if (flat.length) wbList(all);
  }
  function wbList(all) {
    const box = $('#wb-list'); if (!box || !RT.wb) return;
    all = all || bookWords();
    const f = RT.wb.f, q = wdNorm(RT.wb.q);
    const hit = x => {
      if (f !== 'all' && x.st !== f) return false;
      if (!q) return true;
      const it = WX[x.wi].words[x.i], m = meanOf(it);
      return wdNorm(it[0]).includes(q) || (m != null && wdNorm(m).includes(q)) || (romaOn() && romaOf(it[0]).replace(/[\s']+/g, '').includes(q.replace(/[\s']+/g, '')));
    };
    let left = WB_STEP * RT.wb.n, more = 0, html = '';
    for (const g of all) {
      const xs = g.items.filter(hit);
      if (!xs.length) continue;
      const take = xs.slice(0, Math.max(0, left));
      more += xs.length - take.length; left -= take.length;
      if (!take.length) continue;
      html += '<section class="wb-g"><h3>' + esc(WX[g.wi].icon || '') + ' ' + esc(wxName(g.wi)) + ' <small>' + xs.length + '</small></h3><div class="wd-list">' +
        take.map(x => wdRow(x.wi, x.i, false, ' data-act="wbOpen" data-w="' + x.wi + '" data-i="' + x.i + '" role="button" tabindex="0"')).join('') + '</div></section>';
    }
    box.innerHTML = html ? html + (more ? '<button class="btn small ghost wb-more" data-act="wbMore">' + trh('g.wb.more', { n: more }) + '</button>' : '') : '<p class="wd-legend">' + trh('g.wb.none') + '</p>';
  }

  // ---------- 🔤 发音入门（WORDS.md §4）：course.json 的 PRIMER（只有西语、日语、中文的课，课程包里有才有）----------
  // 全新开始的人（这门课的存档里还没有任何星、没看过）首页给一张卡片；看过 / 点了「不用了」记 S.primerSeen = 日期
  const primerNew = () => !!PRIMER && !S.primerSeen && !Object.values(S.stars || {}).some(v => v > 0);
  function primerCard() {
    if (!primerNew()) return '';
    const secs = PRIMER.sections.slice(0, 4).map(s => lbl(s.title)).filter(Boolean).join(' · ');
    return '<div class="pr-card"><span class="pr-ico" aria-hidden="true">🔤</span><div class="pr-ct"><b>' + trh('g.pr.card') + '</b><small>' + esc(secs) + '</small></div>' +
      '<div class="pr-cb"><button class="btn small sun" data-act="primer">' + trh('g.pr.card.go') + '</button><button class="link" data-act="primerNo">' + trh('g.pr.card.no') + '</button></div></div>';
  }
  // 发音入门的格子 / 行自己念的那个音（一个假名、一个字母名、一个例字）：先用手机自带的声音念（主会话 2026-11-22 实测：单个音提前合成、云端合成都念不准——
  // 本机合成多出尾音、云端偶尔冒出几秒乱话；整词没这个问题，所以例词照常走 say()，课程包里有配音）。
  // 按这门课的语言挑本机声音：ja-JP / zh-CN / es-MX → es-US → es-ES，都没有再挑同一门语言别的地区；稍慢一点（0.8）。
  // 设置「只用配音」、本机声音坏过、这台设备没有这门语言的声音：退回 say()（课程包里有就放，没有就云端合成 → 本机）
  const PR_LOC = { ja: ['ja-JP'], zh: ['zh-CN'], es: ['es-MX', 'es-US', 'es-ES'] };
  function unitVoice() {
    if (!TTS.ok || !LANG || S.settings.tts === 'online' || RT.ttsBroken) return null;
    voicesNow();
    let all = [];
    try { all = speechSynthesis.getVoices() || []; } catch (e) { all = []; }
    const lc = s => String(s || '').replace('_', '-').toLowerCase();
    for (const loc of PR_LOC[COURSE] || []) { const v = all.find(x => lc(x.lang) === loc.toLowerCase()); if (v) return v; }
    return all.find(x => LANG.tts.web.test(String(x.lang || ''))) || null;
  }
  // rate：🐢 这一次放慢时给；不给 = 0.8（设置「朗读速度：慢」时 0.7）
  function sayUnit(text, rate) {
    if (!text) return Promise.resolve();
    const v = unitVoice();
    if (!v) return say(text, rate, 'f', true);
    const m = MUS(), tok = {};
    if (m) { if (!duckTok) m.duck(true); duckTok = tok; }
    return new Promise(res => {
      stopListening();
      try { speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
      if (RT.audio) RT.audio.pause();
      RT.sayId = (RT.sayId || 0) + 1;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v; u.lang = v.lang; u.rate = rate || (slowOn() ? 0.7 : 0.8);
      let done = false;
      const fin = () => { if (done) return; done = true; res(); };
      u.onend = fin;
      // 真失败了（不是被下一句打断）：这次起不用本机声音，这一句改走 say()
      u.onerror = e => { if (!done && e && e.error && !/interrupted|canceled/.test(e.error)) { done = true; RT.ttsBroken = true; say(text, undefined, 'f', true).then(res); return; } fin(); };
      setTimeout(fin, 1800 + String(text).length * 250);
      speechSynthesis.speak(u);
    }).then(() => { if (m && duckTok === tok) { duckTok = null; m.duck(false); } });
  }
  // 例词带读音：日语有汉字的整词标一个 <ruby>；中文拼音的音节数和汉字数一样就一个字一个字标；「读音」设置关了不标
  function prRuby(x) {
    const t = String(x.t || ''), r = typeof x.r === 'string' ? x.r.trim() : '';
    if (!r || !LANG || LANG.script === 'latin' || S.settings.ruby === false || r === t) return esc(t);
    if (LANG.script === 'kana') return /[㐀-鿿々]/.test(t) ? '<ruby>' + esc(t) + '<rt>' + esc(r) + '</rt></ruby>' : esc(t);
    const cs = Array.from(t), syl = r.split(/\s+/), hs = cs.filter(c => /[㐀-鿿]/.test(c));
    if (hs.length !== syl.length) return '<ruby>' + esc(t) + '<rt>' + esc(r) + '</rt></ruby>';
    let k = 0;
    return cs.map(c => (/[㐀-鿿]/.test(c) ? '<ruby>' + esc(c) + '<rt>' + esc(syl[k++]) + '</rt></ruby>' : esc(c))).join('');
  }
  function primerSheet(si) {
    if (!PRIMER) return;
    // 最后一段是「🆘 求助的话」（WORDS.md §8：学完发音马上学这几句；这门课有 lessons 才有）
    const hp = helpList().length > 0, secs = PRIMER.sections, nAll = secs.length + (hp ? 1 : 0), k = Math.max(0, Math.min(nAll - 1, si | 0)), s = secs[k];
    RT.pr = { k };
    if (!S.primerSeen) { S.primerSeen = dayStr(); save(); }
    const tabs = '<div class="seg wrap pr-tabs">' + secs.map((x, j) => '<button class="' + (j === k ? 'on' : '') + '" data-act="prSec" data-s="' + j + '">' + esc(lbl(x.title)) + '</button>').join('') +
      (hp ? '<button class="' + (k === secs.length ? 'on' : '') + '" data-act="prSec" data-s="' + secs.length + '">' + trh('g.hp.tab') + '</button>' : '') + '</div>';
    const foot = '<div class="row">' + (k < nAll - 1 ? '<button class="btn ghost" data-act="close">' + trh('g.close') + '</button><button class="btn" data-act="prSec" data-s="' + (k + 1) + '" data-focus>' + trh('g.pr.next') + '</button>' : '<button class="btn" data-act="close" data-focus>' + trh('g.pr.done') + '</button>') + '</div>';
    if (!s) { openModal('<h2 class="pr-h">' + trh('g.pr.h') + ' <small>' + esc(tr('pk.name.' + COURSE)) + '</small></h2>' + tabs + '<div class="pr-sec"><h3>' + trh('g.hp.h') + '</h3>' + helpHTML() + '</div>' + foot); return; }
    const head = it => '<b>' + esc(it.t) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + (it.rom && it.rom !== it.t ? '<i>' + esc(it.rom) + '</i>' : '');
    const ex = it => (Array.isArray(it.ex) && it.ex.length ? ' has-ex' : '');
    const body = s.layout === 'grid'
      ? '<div class="pr-grid" style="--cols:' + Math.max(1, Math.min(10, s.cols | 0 || 5)) + '">' + s.items.map((it, j) => (it == null ? '<span class="pr-cell empty" aria-hidden="true"></span>' : '<button class="pr-cell' + ex(it) + '" data-act="prSay" data-s="' + k + '" data-i="' + j + '">' + head(it) + '</button>')).join('') + '</div>'
      : '<div class="pr-list">' + s.items.map((it, j) => (it == null ? '' : '<button class="pr-row' + ex(it) + '" data-act="prSay" data-s="' + k + '" data-i="' + j + '"><span class="pr-rt">' + head(it) + '</span>' + (uiPick(it) ? '<span class="pr-note">' + esc(uiPick(it)) + '</span>' : '') + '</button>')).join('') + '</div>';
    openModal('<h2 class="pr-h">' + trh('g.pr.h') + ' <small>' + esc(tr('pk.name.' + COURSE)) + '</small></h2>' + tabs +
      '<div class="pr-sec"><h3>' + esc(lbl(s.title)) + '</h3><p>' + esc(lbl(s.intro)) + '</p><p class="wd-legend">' + trh('g.pr.tap') + '</p>' + body + '<div class="pr-ex" id="pr-ex" hidden></div></div>' + foot);
  }
  // 点了一格：念它，下面那块写说明和例词（词、读音、罗马字、意思、图、🔊）
  function prEx(it) {
    const box = $('#pr-ex'); if (!box) return;
    const note = uiPick(it), exs = Array.isArray(it.ex) ? it.ex.filter(x => x && x.t) : [];
    // 上面一行：这一格（大字、小字、罗马字 / 拼音）、🐢 再慢慢念一遍（本机声音）、说明
    box.innerHTML = '<div class="pr-ex-h"><b>' + esc(it.t) + '</b>' + (it.sub ? ' <small>' + esc(it.sub) + '</small>' : '') + (it.rom && it.rom !== it.t ? ' <i>' + esc(it.rom) + '</i>' : '') + SLOW_BTN(it.say, 'prSlowU') + (note ? '<span>' + esc(note) + '</span>' : '') + '</div>' +
      (exs.length ? '<small class="pr-ex-k">' + trh('g.pr.ex') + '</small><div class="wd-list">' + exs.map(x => {
        const m = LANG ? glossC({ zh: x.zh || '', en: x.en }) : null;
        return '<div class="wd-row"><span class="wd-pic" aria-hidden="true">' + esc(x.pic || '') + '</span><div class="wd-main"><div class="wd-w"><b>' + prRuby(x) + '</b></div>' +
          (LANG && LANG.script === 'kana' ? romaHTML(x.t, x.r || x.t) : '') + (m ? '<div class="wd-m">' + esc(m) + '</div>' : '') + '</div>' + SAYS(x.t, 'prSayEx', 'prSlowEx') + '</div>';
      }).join('') + '</div>' : '');
    box.hidden = false;
    try { box.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { /* 忽略 */ }
  }
  // ---------- 第二部分：零基础怎么学（tools/course/WORDS.md 第 7–11 条，2026-11-22）----------
  // 新加的「自动弹出 / 首页卡片 / 点词弹卡」在自动化测试的浏览器里没写开关就当关着（和单词卡一样：好多老测试自己写存档，不能因为这个改流程）
  const autoOff = () => !!navigator.webdriver || /[?&]nocards\b/.test(location.search);
  // 🐢 只这一次放慢（单词表、单词卡、课前讲解、发音入门、求助的话里每个 🔊 旁边）
  const SLOW_BTN = (t, act) => '<button class="slow mini wd-slow" data-act="' + (act || 'wdSlow') + '" data-t="' + esc(t) + '" aria-label="' + esc(tr('g.wd.slow')) + '"><span>🐢</span></button>';
  const SAYS = (t, act, slowAct) => '<span class="wd-says">' + SAY_BTN(t, act) + SLOW_BTN(t, slowAct) + '</span>';

  // ---------- 📘 这一课学什么（课前讲解，§7）：英语课读 lessons-en.js，别的课读 course.json 的 LESSONS ----------
  // 小镇按编号（"0"–"12"）；课本单元按单元 id（es1-1……，英语的课本单元没有：已经有语法讲解）
  function lessonOf(wi) {
    const L = LESSONS, w = WX[wi];
    if (!L || !w) return null;
    if (isUnit(wi)) return LANG && L.units ? L.units[w.book + '-' + w.n] || null : null;
    return L.towns ? L.towns[String(wi)] || null : null;
  }
  // 例句（这一课 sents / dlgs 里原样有的那一句）的意思：别的课从条目表找；英语课只有 sents 有意思，dlgs 的问 / 答没有（不显示空行）
  function lessonMean(w, t) {
    if (LANG) { const e = entryOf(t); return e ? glossC({ zh: e.zh || '', en: e.en }) : null; }
    const s = (w.sents || []).find(x => x[0] === t);
    return s ? meanOf(s) : null;
  }
  // 句型本身：空的地方（___）画成一个空格子；日语有汉字时下面写读音、中文下面写拼音，日语再一行罗马字
  function patternHTML(p) {
    const blank = h => h.replace(/_{2,}/g, '<span class="ls-blank">___</span>');
    let h = '<div class="ls-p">' + blank(esc(p.p)) + '</div>';
    const r = typeof p.r === 'string' ? p.r.trim() : '';
    if (LANG && r && (LANG.script === 'han' || /[㐀-鿿々]/.test(p.p))) h += '<div class="ls-r">' + blank(esc(r)) + '</div>';
    if (LANG && r && romaOn()) { const ro = LANG.romaji(r.replace(/_{2,}/g, ' ___ ')); if (/^[\x20-\x7e]+$/.test(ro)) h += '<span class="wd-rom" lang="ja-Latn">' + blank(esc(ro)) + '</span>'; }
    return h;
  }
  // o.li：从「开始闯关」来的（第一次进第 1 关：讲解 → 单词卡 → 开考）；o.back：关上回到哪（单词表）
  function lessonSheet(wi, o) {
    const w = WX[wi], L = lessonOf(wi);
    if (!w || !L) return;
    o = o || {};
    // o.mini：从「一步一步学」来的（第一节小课之前先看这一页；下一步是小课，不是单词卡）
    RT.ls = { wi, li: o.li != null ? o.li : null, back: o.back || null, mini: !!o.mini };
    const nextCards0 = RT.ls.li != null && cardsFirst(wi, RT.ls.li);
    lessonSeen(wi);   // 看过就记一笔（第一次进第 1 关不再先弹这一页）
    const g = isUnit(wi) ? wdGram(w) : null;
    const pats = (L.patterns || []).map(p => {
      const m = uiPick({ zh: p.zh, en: p.en }), note = uiPick(p.note);
      const exs = (p.ex || []).map(t => { const mm = lessonMean(w, t); return '<div class="wd-ex ls-ex"><div class="wd-ex-t"><span>' + rb(t) + '</span>' + SAYS(t) + '</div>' + romaHTML(t) + (mm ? '<small>' + esc(mm) + '</small>' : '') + '</div>'; }).join('');
      return '<div class="ls-pat">' + patternHTML(p) + (m ? '<div class="wd-m">' + blankTxt(m) + '</div>' : '') + (note ? '<p class="ls-note">' + esc(note) + '</p>' : '') + exs + '</div>';
    }).join('');
    const tips = (L.tips || []).map(t => uiPick(t)).filter(Boolean).map(t => '<div class="ls-tip">💡 ' + esc(t) + '</div>').join('');
    const can = uiPick(L.can), intro = uiPick(L.intro);
    const first = RT.ls.li != null || RT.ls.mini, nextCards = nextCards0;
    openModal('<div class="wd-head"><span class="w-ico" style="background:' + esc(w.color || '') + '">' + esc(w.icon || '') + '</span><div class="wd-ht"><small class="wd-k">' + trh('g.ls.h') + '</small>' + wdTitle(wi) + '</div></div>' +
      (can ? '<div class="ls-can"><b>' + trh('g.ls.can') + '</b><span>' + esc(can) + '</span></div>' : '') +
      (intro ? '<p class="ls-intro">' + esc(intro) + '</p>' : '') +
      (pats ? '<h3 class="wd-h">' + trh('g.ls.pats') + '</h3><div class="ls-pats">' + pats + '</div>' : '') +
      (g ? '<div class="wd-gram"><b>' + trh('g.wd.gram', { t: g.t }) + '</b>' + (g.p ? '<p>' + esc(g.p) + '</p>' : '') + '</div>' : '') +
      (tips ? '<h3 class="wd-h">' + trh('g.ls.tips') + '</h3>' + tips : '') +
      (first ? '' : '<div class="wd-tools"><button class="btn small ghost" data-act="wordList" data-w="' + wi + '">' + trh('g.wd.btn') + '</button></div>') +
      '<div class="row ls-foot">' + (first
        ? (RT.ls.mini ? '<button class="btn ghost" data-act="close">' + trh('g.det.later') + '</button>' : '<button class="btn ghost" data-act="lsSkip">' + trh('g.wc.skip') + '</button>') +
          '<button class="btn sun" data-act="lsNext" data-focus>' + trh(RT.ls.mini ? 'g.mn.ls.next' : nextCards ? 'g.ls.next' : 'g.ls.go') + '</button>'
        : (o.back ? '<button class="btn ghost" data-act="lsBack">' + trh('g.wd.back') + '</button>' : '') + '<button class="btn" data-act="lsDone" data-focus>' + trh('g.close') + '</button>') + '</div>');
  }
  // 意思里的 ___ 也画成空格子
  const blankTxt = s => esc(s).replace(/_{2,}/g, '<span class="ls-blank">___</span>');
  const lessonSeen = wi => { if (!S.seenLesson || typeof S.seenLesson !== 'object') S.seenLesson = {}; if (!S.seenLesson[wi]) { S.seenLesson[wi] = dayStr(); save(); } };
  // 第一次进第 1 关：先看这一页（和单词卡同一个开关，WORDS.md §7「同一次先认识再闯关」）
  const lessonFirst = (wi, li) => li === 0 && cardsOn() && !!lessonOf(wi) && !((S.stars[wi + '-0'] || 0) > 0) && !(S.seenLesson || {})[wi];

  // ---------- 🆘 求助的话（§8）：发音入门的最后一段、聊天页的 🆘、单独一张表 ----------
  const helpList = () => (LESSONS && Array.isArray(LESSONS.help) ? LESSONS.help.filter(h => h && typeof h.t === 'string' && h.t) : []);
  // 一句：这门语言（日语有汉字时下面写读音、中文写拼音，日语一行罗马字）、意思、什么时候用、🔊 🐢。
  // 意思按界面语言；中文课的中文意思是空的（就是原文本身），中文界面只写「什么时候用」
  function helpRow(h) {
    const r = typeof h.r === 'string' ? h.r.trim() : '', m = uiPick({ zh: h.zh, en: h.en }), use = uiPick(h.use);
    const rl = LANG && r && (LANG.script === 'han' || /[㐀-鿿々]/.test(h.t)) ? '<div class="ls-r">' + esc(r) + '</div>' : '';
    const ro = LANG && r && romaOn() ? romaHTML(h.t, r) : '';
    return '<div class="wd-row hp-row"><div class="wd-main"><div class="wd-s">' + rb(h.t) + '</div>' + rl + ro + (m ? '<div class="wd-m">' + esc(m) + '</div>' : '') + (use ? '<small class="hp-use">' + esc(use) + '</small>' : '') + '</div>' + SAYS(h.t, 'hpSay', 'hpSlow') + '</div>';
  }
  const helpHTML = () => '<p class="wd-legend">' + trh('g.hp.tip') + '</p><div class="wd-list hp-list">' + helpList().map(helpRow).join('') + '</div>';
  function helpSheet() {
    if (!helpList().length) return;
    openModal('<h2>' + trh('g.hp.h') + '</h2>' + helpHTML() + '<div class="row"><button class="btn" data-act="close" data-focus>' + trh('g.close') + '</button></div>');
  }

  // ---------- 🧭 新手路线（§9）：还没打通第 3 个小镇的人，首页最上面一张卡片 ----------
  // 开关 S.settings.route：true 开、false 关、没有 = 照默认（自动化测试的浏览器里关；能力检测 / 「学过多少」是 2 级以上的人关）
  const routeOn = () => S.settings.route === true || (S.settings.route !== false && !autoOff() && !(S.place && S.place.lv >= 2));
  const cleared = z => (S.stars[z + '-6'] || 0) > 0;
  // 第 z 岛的几步：[id, 做完没有, 能不能走（聊天连不上就没有这一步）]
  function routeSteps(z) {
    const st = l => (S.stars[z + '-' + l] || 0) > 0, chat = !!(window.EchoTalk && EchoTalk.relayUrl && EchoTalk.relayUrl()) && talkLang();
    const sc = window.SCENES && window.SCENES[z];
    return [
      LANG && PRIMER && z === 0 ? ['primer', !!S.primerSeen] : null,
      lessonOf(z) ? ['lesson', !!(S.seenLesson || {})[z]] : null,
      // 开着「一步一步学」：这一步是上小课（每节 3 个新词），不是翻一遍单词卡
      starterOn() && miniN(z) ? ['mini', miniLeft(z) === 0 || !!MN().skip[z] || st(0)] : ['cards', !!(S.seenCards || {})[z] || st(0)],
      ['l14', st(0) && st(1) && st(2) && st(3)],
      sc ? ['scene', !!(S.scenes[z] && S.scenes[z].watched)] : null,
      ['l57', st(4) && st(5) && st(6)],
      z === 0 ? ['adv', !!(S.mon && (S.mon.box || []).length && S.world && S.world.started)] : null,
      z === 0 && chat ? ['chat', !!((S.talk && S.talk.log && S.talk.log.length) || Object.keys((S.talk && S.talk.done) || {}).length)] : null,
    ].filter(Boolean);
  }
  function routeCard() {
    if (!routeOn() || !W.length || cleared(Math.min(2, W.length - 1))) return '';
    const z = Math.max(0, W.findIndex((w, i) => !cleared(i)));
    const steps = routeSteps(0), all = steps.every(s => s[1]);
    // 第 1 岛的几步全打勾以后：收成一行「下一课：第 2 岛 ……」，点了去那座岛的闯关练习
    if (z > 0 || all) return '<button class="rt-next" data-act="rtGo" data-s="next" data-z="' + z + '">🧭 ' + trh('g.rt.next', { n: z + 1, t: isleName(z) }) + ' ›</button>';
    // 做完的收成一行「✅ 已完成 n 步」，没做的只列接下来 3 步（2026-11-22 细节检查：7 步全列出来时竖屏的「继续冒险」被挤下去约 480 像素、
    // 小手机横屏后面几步要滚着看）。做完的那几样别处都还能打开（单词表、单词卡、关卡、对话动画）
    const idx = steps.map((s, k) => [s[0], s[1], k]), done = idx.filter(s => s[1]), todo = idx.filter(s => !s[1]), shown = todo.slice(0, 3);
    return '<div class="rt-card"><div class="rt-h"><b>' + trh('g.rt.h') + '</b><small>' + trh('g.rt.n', { a: done.length, b: steps.length }) + '</small></div><ol class="rt-steps">' +
      (done.length ? '<li class="rt-done">✅ ' + trh('g.rt.done', { n: done.length }) + '</li>' : '') +
      shown.map(([id, , k], j) => '<li class="' + (j === 0 ? 'now' : '') + '"><button data-act="rtGo" data-s="' + id + '" data-z="0"><span class="rt-k">' + (k + 1) + '</span><span>' + trh('g.rt.' + id, { t: isleName(0) }) + '</span><span class="rt-go">›</span></button></li>').join('') +
      (todo.length > shown.length ? '<li class="rt-more">' + trh('g.rt.more', { n: todo.length - shown.length }) + '</li>' : '') + '</ol></div>';
  }
  // 去闯关练习里的第 z 岛，亮一下第 li 关
  function goIsle(z, li) {
    S.book.view = 'isle'; save();
    goHome('quiz');
    const n = $('#w' + z + ' .node[data-l="' + li + '"]');
    if (n) { n.classList.add('goal'); setTimeout(() => n.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 250); setTimeout(() => n.classList.remove('goal'), 6000); }
  }
  function routeGo(id, z) {
    const first = ls => { for (const l of ls) if (!((S.stars[z + '-' + l] || 0) > 0)) return l; return ls[ls.length - 1]; };
    if (id === 'primer') primerSheet(0);
    else if (id === 'lesson') lessonSheet(z);
    else if (id === 'cards') openCards(z, {});
    else if (id === 'mini') miniGo(z, null);
    else if (id === 'l14') goIsle(z, first([0, 1, 2, 3]));
    else if (id === 'scene') openScene(z);
    else if (id === 'l57' || id === 'next') goIsle(z, id === 'next' ? first([0, 1, 2, 3, 4, 5, 6]) : first([4, 5, 6]));
    else if (id === 'adv') goHome('mon');
    else if (id === 'chat') goHome('talk');
  }

  // ---------- 👆 点一个词看意思（§10）：学的语言的句子里点一个词，弹一张小卡（词、读音、意思、🔊）----------
  // 查的是这门课学过的词（所有小镇和单元的 words；日语另加每个词的读音）。西语按空格切、去掉标点，冠词去掉、词形照 lang-es.js 的 inflect 配；
  // 日语中文用这句话的 seg 词块（块尾的助词去掉再查），没有 seg 的按最长匹配课程里的词。查不到不弹（不猜）。
  // 开关 S.settings.wordTap：没有 = 开着（自动化测试的浏览器里关）
  const tapOn = () => S.settings.wordTap === true || (S.settings.wordTap !== false && !autoOff());
  // 哪些地方：大地图对话框的那一句、闯关题目上的那一句（遮起来的不算）、答完以后那一行、对话动画的字幕、聊天的气泡、单词表 / 课前讲解的例句、求助的话
  const TAP_SEL = '#w-dlg .d-en:not(.hid), #st:not(.mask), #hl:not(.blur), #fb-d, #th-sub .ss-en:not(.muted), .tk-b, .wd-ex-t > span, .wd-s';
  const ES_ART = /^(el|la|los|las|un|una|unos|unas|lo)\s+/;
  function dict() {
    if (DICT && DICT.wx === WX) return DICT;
    const m = new Map(), latin = !LANG || LANG.script === 'latin', fold = LANG && LANG._ && LANG._.fold;
    const put = (k, v) => { k = String(k || '').trim(); if (k && !m.has(k)) m.set(k, v); };
    WX.forEach((w, wi) => (w.words || []).forEach((it, i) => {
      const t = String(it[0]), v = { wi, i };
      if (latin) {
        const lo = t.toLowerCase().normalize('NFC').replace(/[¿¡.,!?;:"“”()]/g, '').replace(/\s+/g, ' ').trim();
        put(lo, v);
        if (LANG) { const b = lo.replace(ES_ART, ''); put(b, v); if (fold) put(fold(b), v); }
      } else {
        put(t.replace(/[、。！？!?「」]/g, ''), v);
        const g = glossObj(it);
        if (COURSE === 'ja' && g && typeof g.r === 'string' && Array.from(g.r).length >= 2) put(g.r, v);
      }
    }));
    let max = 1; m.forEach((v, k) => { max = Math.max(max, Array.from(k).length); });
    return (DICT = { m, max, wx: WX });
  }
  // 容器里看得见的字（读音 <rt> 不算）和点到的那个字在里面的位置
  function tapText(box, x, y) {
    let node = null, off = 0;
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
    else if (document.caretPositionFromPoint) { const r = document.caretPositionFromPoint(x, y); if (r) { node = r.offsetNode; off = r.offset; } }
    if (!node || !box.contains(node) || node.nodeType !== 3) return null;
    // caret…FromPoint 给的是离手指最近的那条「字缝」：点在一个字的右半边，给的是这个字后面的缝（偏移多 1）。
    // 不管的话：英语点词尾最后一个字母的右半边落到空格上、不弹；中文日语的单字词有一半会点成后面那个词（2026-11-24 复查，Chromium、WebKit 都这样）。
    // 前一个字的框里包着这个点，就算点的是前一个字
    if (off > 0) {
      try {
        const cr = document.createRange(); cr.setStart(node, off - 1); cr.setEnd(node, off);
        const cb = cr.getBoundingClientRect();
        if (cb.width > 0 && x >= cb.left && x < cb.right && y >= cb.top && y <= cb.bottom) off--;
      } catch (e) { /* 量不出来：照旧 */ }
    }
    // 点到读音上：算成那个 <ruby> 的字的开头
    const rt = node.parentElement && node.parentElement.closest('rt');
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let text = '', at = -1;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const inRt = n.parentElement && n.parentElement.closest('rt');
      if (rt && at < 0 && inRt === rt) at = text.length - 1;
      if (inRt) continue;
      if (n === node) at = text.length + Math.min(off, n.data.length - 1);
      text += n.data;
    }
    if (rt) { const ru = rt.closest('ruby'), base = ru ? (ru.textContent || '').replace(rt.textContent || '', '') : ''; const k = base ? text.indexOf(base) : -1; at = k >= 0 ? k : at; }
    return at >= 0 && at < text.length ? { text, at } : null;
  }
  function tapLookup(text, at) {
    const D = dict(), get = k => (k ? D.m.get(k) : null);
    if (!LANG || LANG.script === 'latin') {
      const re = /[A-Za-zÀ-ÿñÑ'’-]+/g, toks = [];
      let mm; while ((mm = re.exec(text))) toks.push({ w: mm[0].toLowerCase().replace(/’/g, "'"), s: mm.index, e: mm.index + mm[0].length });
      const k = toks.findIndex(t => at >= t.s && at < t.e);
      if (k < 0) return null;
      // 词组（good morning、buenos días）：点到的词在里面的最长那一段
      for (let len = Math.min(4, toks.length); len >= 1; len--) for (let a = Math.max(0, k - len + 1); a <= k && a + len <= toks.length; a++) {
        const ph = toks.slice(a, a + len).map(t => t.w).join(' '), v = get(ph);
        if (v && (len > 1 || !LANG || !ES_ART.test(ph + ' '))) return v;
      }
      const w = toks[k].w;
      if (!LANG) { for (const s of ['s', 'es', 'ed', 'd', 'ing']) if (w.endsWith(s) && w.length - s.length >= 3) { const v = get(w.slice(0, -s.length)) || (s === 'ing' ? get(w.slice(0, -3) + 'e') : null); if (v) return v; } return null; }
      const fold = LANG._ && LANG._.fold, infl = LANG._ && LANG._.inflect;
      if (fold) { const v = get(fold(w)); if (v) return v; }
      if (infl && fold) { const fw = fold(w); for (const [key, v] of D.m) if (!/\s/.test(key) && key.length >= 3 && infl(fw, fold(key))) return v; }
      return null;
    }
    // 日语、中文：先按这句话的 seg 词块
    const plain = text, e = entryOf(plain.trim());
    const tryBlock = b => {
      b = String(b || '').replace(/^[「『（(]+/, '').replace(/[\s、。！？!?「」』）)…〜～]+$/, '');
      let v = get(b); if (v) return v;
      if (COURSE === 'ja') { const c = b.replace(/(から|まで|より|には|では|は|が|を|に|で|と|も|へ|の|や|か|ね|よ)$/, ''); if (c !== b && (v = get(c))) return v; }
      return null;
    };
    if (e && Array.isArray(e.seg) && e.seg.join('') === e.t) {
      const base = plain.indexOf(e.t);
      if (base >= 0) { let pos = base; for (const s of e.seg) { if (at >= pos && at < pos + s.length) { const v = tryBlock(s); if (v) return v; break; } pos += s.length; } }
    }
    // 没有 seg（或者块整个查不到）：盖住点到的那个字的、课程里最长的词
    const cs = Array.from(plain);
    let best = null, bl = 0;
    for (let s = Math.max(0, at - D.max + 1); s <= at; s++) for (let len = Math.min(D.max, cs.length - s); len > bl && s + len > at; len--) { const v = get(cs.slice(s, s + len).join('')); if (v) { best = v; bl = len; break; } }
    return best;
  }
  function wordPop(v, x, y) {
    const it = WX[v.wi] && WX[v.wi].words[v.i]; if (!it) return;
    let el = $('#wd-pop');
    if (!el) { el = document.createElement('div'); el.id = 'wd-pop'; el.className = 'wd-pop'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); }
    const m = meanOf(it);
    el.innerHTML = '<span class="wd-pic" aria-hidden="true">' + esc(it[2] || '') + '</span><div class="wd-main"><div class="wd-w"><b>' + rb(it[0]) + '</b></div>' + romaHTML(it[0]) + (m != null && m !== '' ? '<div class="wd-m">' + esc(m) + '</div>' : '') + '</div>' +
      SAYS(it[0]) + '<button class="wd-pop-x" data-act="wdPopX" aria-label="' + esc(tr('g.close')) + '">✕</button>';
    el.hidden = false;
    const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const left = Math.max(8, Math.min(vw - r.width - 8, x - r.width / 2)), top = y + 24 + r.height < vh - 8 ? y + 24 : Math.max(8, y - r.height - 16);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    clearTimeout(RT.popT); RT.popT = setTimeout(() => { el.hidden = true; }, 9000);
  }
  // 怎么弹（2026-11-22 老板：「对话有点卡」）：第一版是在捕获阶段拦「点一下」，点到认得的词就弹卡、这一下不往下传——
  //   可大地图对话框点一下是翻页、聊天里点岛民的话是看翻译、对话动画点一下也有用，点在字上（最常点的地方）十有八九碰到认得的词，
  //   结果卡片一直弹、对话翻不过去，像卡住了。现在：
  //   - HOLD_SEL 这几处「点一下本来就有用」：**按住一个词约半秒**才弹卡，轻点照旧（翻页 / 看翻译）；
  //   - 别的地方（闯关题目、答完那一行、单词表 / 课前讲解的例句、求助的话：点一下本来没用）轻点、按住都弹。
  //   按住弹了卡以后，松手跟着来的那一下 click 吞掉（不翻页、不把卡片关掉）。
  const HOLD_SEL = '#w-dlg .d-en, #th-sub .ss-en, .tk-b';
  const HOLD_MS = 450;
  const tapBox = t => {
    if (!tapOn() || !t || !t.closest) return null;
    const box = t.closest(TAP_SEL);
    if (!box) return null;
    const ctl = t.closest('button, input, select, textarea, a, .opt');
    return ctl && box.contains(ctl) ? null : box;   // 句子里面的按钮（🔊）照旧
  };
  const tapFind = (box, x, y) => { try { const h = tapText(box, x, y); return h ? tapLookup(h.text, h.at) : null; } catch (err) { return null; } };
  let hold = null, held = 0;
  window.addEventListener('pointerdown', e => {
    // 每一下新的按压先忘掉上一次「按住弹了卡」：安卓长按会弹系统菜单（被我们拦了）、iOS 长按可能以 pointercancel 收尾，
    // 那一次后面没有 click，held 一直留着，下一下普通的点就会被吞掉（又像「对话卡住」）——复查 2026-11-22
    held = 0;
    if (hold) { clearTimeout(hold.t); hold = null; }
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const box = tapBox(e.target);
    if (!box) return;
    const x = e.clientX, y = e.clientY;
    hold = { x, y, t: setTimeout(() => { hold = null; const v = tapFind(box, x, y); if (v) { held = performance.now(); wordPop(v, x, y); } }, HOLD_MS) };
  }, true);
  // 手指挪开了（超过 10 像素：在滚动）、松手了、被系统收走了：不算按住
  const holdOff = e => {
    if (e.type === 'pointerup' && held) held = performance.now();   // 按住弹了卡：从松手算起，跟着来的 click 吞掉
    if (!hold || (e.type === 'pointermove' && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) <= 10)) return;
    clearTimeout(hold.t); hold = null;
  };
  ['pointermove', 'pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, holdOff, true));
  // 安卓长按会弹系统菜单（复制 / 全选）：这几处不要
  window.addEventListener('contextmenu', e => { if (tapBox(e.target)) e.preventDefault(); }, true);
  window.addEventListener('click', e => {
    if (held) {
      const fresh = performance.now() - held < 600;
      held = 0;
      if (fresh) { e.stopPropagation(); e.preventDefault(); return; }
    }
    const pop = $('#wd-pop');
    if (pop && !pop.hidden && !pop.contains(e.target)) pop.hidden = true;
    const box = tapBox(e.target);
    if (!box || box.matches(HOLD_SEL)) return;
    const v = tapFind(box, e.clientX, e.clientY);
    if (!v) return;
    e.stopPropagation(); e.preventDefault();
    wordPop(v, e.clientX, e.clientY);
  }, true);

  // ---------- 🐢 朗读慢一点（§11）：设置「朗读速度：正常 / 慢」S.settings.slow；没有 = 零基础（第 0 级）慢、别的正常 ----------
  const slowOn = () => S.settings.slow === true || (S.settings.slow == null && !!S.place && S.place.lv === 0);

  // ---------- 🌱 一步一步学：单词小课（tools/course/STARTER.md，2026-11-24）----------
  // 老板：「完全没基础的情况下有点难学……可以让人真的从 0 开始学」。原来一座岛 12 个新词翻一遍单词卡就开考（四选一、错 3 次失败）。
  // 现在闯关前面加几节小课：每节 3 个新词，先教（教学卡）后练（两个里选 → 这一节的词里选 → 看意思选词 → 跟读），答错不扣心、过两题再问。
  // 小课借闯关的画面（#play、P、renderQ / onPick / 话筒那一套）：P.mini = { k 第几节（从 0 数）, n 共几节 }，题目带 q.mini。
  // 开关 S.settings.starter：true 开、false 关、没有 = 零基础（第 0 级）开（自动化测试的浏览器里没写就当关着，和单词卡一样）
  const starterOn = () => S.settings.starter === true || (S.settings.starter == null && !autoOff() && !!S.place && S.place.lv === 0);
  const MN = () => {
    if (!S.mini || typeof S.mini !== 'object') S.mini = {};
    if (!S.mini.n || typeof S.mini.n !== 'object') S.mini.n = {};
    if (!S.mini.skip || typeof S.mini.skip !== 'object') S.mini.skip = {};
    return S.mini;
  };
  // 这一课的词按顺序 3 个一节；最后只剩 1 个就并进上一节（13 个词 = 3 + 3 + 3 + 4）
  function miniGroups(wi) {
    const n = ((WX[wi] || {}).words || []).length, gs = [];
    for (let i = 0; i < n; i += 3) gs.push(range(Math.min(3, n - i)).map(k => i + k));
    if (gs.length > 1 && gs[gs.length - 1].length === 1) gs[gs.length - 2].push(gs.pop()[0]);
    return gs;
  }
  const miniN = wi => miniGroups(wi).length;
  const miniDone = wi => Math.min(miniN(wi), MN().n[wi] | 0);
  const miniLeft = wi => miniN(wi) - miniDone(wi);
  // 点第 1 关时要不要先问「先一步一步学」：开着、这一课的小课没学完、没说过「我学过了」、第 1 关还没拿过星
  const miniFirst = wi => starterOn() && miniLeft(wi) > 0 && !MN().skip[wi] && !((S.stars[wi + '-0'] || 0) > 0);
  // 小课的一步。tc 教学卡（图、词、读音、意思，自动念一遍）；lw 听音选意思、mw 看意思选词：选项是 pool（这一课里的词的编号）里的词，
  // 意思一样的（看意思选词：写法一样的）不放在一起；sr_w 跟读（和闯关的一样，只是两次没读准就往下走）
  function miniQ(type, wi, i, pool) {
    const w = WX[wi], it = w.words[i], q = { type, kind: 'word', w: wi, i, mini: true, en: it[0], zh: it[1], em: it[2], mean: meanOf(it), audio: it[0] };
    if (type === 'sr_w') q.target = it[0];
    if (type !== 'lw' && type !== 'mw') return q;
    const mk = x => (type === 'mw' || q.mean == null ? wdNorm(x[0]) : LANG ? meanKey(x) : x[1]);
    const seen = new Set([mk(it)]), ds = [];
    (pool || []).forEach(j => { const o = w.words[j]; if (j === i || !o || seen.has(mk(o))) return; seen.add(mk(o)); ds.push(o); });
    // 一个能当错误选项的都没有（这一节只有一个词、意思撞了）：从这一课别的词里找一个
    if (!ds.length) distract(w.words, i, 1, mk).forEach(o => ds.push(o));
    if (type === 'lw') {
      const ms = ds.map(meanOf), ear = q.mean == null || ms.some(m => m == null);
      if (ear) q.ear = true;
      q.opts = shuffle([{ c: true, e: it[2], t: ear ? it[0] : q.mean }, ...ds.map((o, k) => ({ e: o[2], t: ear ? o[0] : ms[k] }))]);
    } else { q.audio = null; q.opts = shuffle([{ c: true, t: it[0] }, ...ds.map(o => ({ t: o[0] }))]); }   // 看意思选词：不先念（念了就成了听音选词），选完再念
    return q;
  }
  // 第 k 节小课的步骤（一个新词在一节里出现 5、6 次：教 → 马上认 → 听音选意思 → 看意思选词 → 跟读 → 小测）
  function buildMini(wi, k) {
    const w = WX[wi], gs = miniGroups(wi), g = gs[k] || [], prev = k > 0 ? gs[k - 1] : [], qs = [];
    if (!w || !g.length) return qs;
    const Q = (t, i, pool) => qs.push(miniQ(t, wi, i, pool));
    // ① 热身：上一节的词听两个
    shuffle(prev).slice(0, 2).forEach(i => Q('lw', i, prev));
    // ② 一个一个教，教完马上认一次：第 1 个词两个里选（另一个是上一节的词；第一节没有上一节，就用下一个要教的），后面的在这一节教过的词里选
    g.forEach((i, n) => { Q('tc', i); Q('lw', i, n ? g.slice(0, n + 1) : [i, prev.length ? prev[prev.length - 1] : g[1]]); });
    // ③ 混着来：听音选意思（最后教的那个刚问过，不再问）→ 看意思选词（没有意思也没有图的词换成听音选）→ 跟读
    shuffle(g.slice(0, -1)).forEach(i => Q('lw', i, g));
    shuffle(g).forEach(i => Q(meanOf(w.words[i]) != null || w.words[i][2] ? 'mw' : 'lw', i, g));
    g.forEach(i => Q('sr_w', i));
    // ④ 小测：这一节的词每个再听一次，选项里混着上一节的词（最多 4 个选项）
    shuffle(g).forEach(i => Q('lw', i, [i].concat(shuffle(prev.concat(g).filter(j => j !== i)).slice(0, 3))));
    return qs;
  }
  function startMini(wi, k) {
    const qs = buildMini(wi, k);
    if (!qs.length) return;
    primeTTS(); ac();
    // li 写 0（别处按 RECIPES[P.li] 读的不出错）；小课没有红心，hearts 一直是 3
    P = { wi, li: 0, mini: { k, n: miniN(wi) }, review: false, qs, idx: 0, total: qs.length, hearts: 3, combo: 0, maxCombo: 0, correct: 0, xp: 0, lost: 0, hits: 0, boss: false, bossMax: 0, revived: false, aidedN: 0, recall: 0 };
    show('play');
    renderHearts();
    $('#p-combo').textContent = '';
    $('#p-boss').innerHTML = '';
    renderQ();
  }
  // 小课里选错了：不扣心、不记错题；这一题过两题再问一次（选项重新打乱），同一题最多再问两次
  function miniAgain(q) {
    const n = (q.again || 0) + 1;
    if (n > 2) return;
    P.qs.splice(Math.min(P.qs.length, P.idx + 3), 0, Object.assign({}, q, { again: n, opts: q.opts ? shuffle(q.opts) : q.opts }));
    P.total = P.qs.length;
  }
  // 学完一节：记进度；这一节的词按「新学的」进每日复习（第 1 格、明天到期，占每天新进的名额，和课本新学的一样）；
  // 一座岛的小课都学完了：第 1 关不再先弹单词卡（S.seenCards）
  function miniFinish() {
    hideFb();
    const wi = P.wi, k = P.mini.k, n = P.mini.n, g = miniGroups(wi)[k] || [], M = MN(), first = (M.n[wi] | 0) <= k, today = dayStr();
    if (first) M.n[wi] = k + 1;
    // 这座岛学过的小课里的词，还不在复习本里的都试着放进去（当天新进的名额满了没进去的，下次学这座岛的小课时补上）
    miniGroups(wi).slice(0, M.n[wi] | 0).forEach(gr => gr.forEach(i => {
      const q = { kind: 'word', w: wi, i }, key = revKey(q);
      if (S.rev.items[key] || !revNewOk()) return;
      const e = revNew(q, key); e.b = 1; e.due = addDays(today, 1); e.x = 0;
      dayLog().fresh = (dayLog().fresh || 0) + 1;
    }));
    revTrim();
    const tmr = addDays(today, 1), inRev = g.some(i => (S.rev.items[revKey({ kind: 'word', w: wi, i })] || {}).due === tmr);
    const all = miniLeft(wi) === 0;
    if (all) { if (!S.seenCards || typeof S.seenCards !== 'object') S.seenCards = {}; if (!S.seenCards[wi]) S.seenCards[wi] = today; }
    const xp = P.xp + 10, coins = first ? 5 : 2, before = lvInfo(S.xp).lv;
    S.xp += xp; S.coins += coins;
    const after = lvInfo(S.xp).lv;
    if (after > before) S.coins += 20;
    S.stats.maxCombo = Math.max(S.stats.maxCombo, P.maxCombo);
    qProg('combo', P.maxCombo, true);
    dayLog().mini = (dayLog().mini || 0) + 1;
    const newDay = markToday();
    save();
    renderTop();
    const next = all
      ? '<button class="btn sun wide" data-act="go" data-w="' + wi + '" data-l="0" data-focus>' + trh('g.mn.res.go') + '</button>'
      : '<button class="btn wide" data-act="mini" data-w="' + wi + '" data-k="' + (k + 1) + '" data-focus>' + trh('g.mn.res.next') + '</button>';
    $('#result').innerHTML =
      '<div class="r-hero"><div class="big" style="font-size:64px">🌱</div><h1 class="r-title">' + trh('g.mn.res.t', { n: g.length }) + '</h1>' +
      '<p class="r-sub">' + trh('g.mn.res.sub', { name: wxName(wi), k: k + 1, n }) + '</p></div><div class="r-body">' +
      // 这一节学会的词：一个词一个小牌子（图、词、意思），点一下念一遍
      '<div class="mn-learned">' + g.map(i => { const it = WX[wi].words[i], m = meanOf(it); return '<button class="mn-w" data-act="wdSay" data-t="' + esc(it[0]) + '"><span aria-hidden="true">' + esc(it[2] || '') + '</span><b>' + rb(it[0]) + '</b>' + (m != null && m !== '' ? '<small>' + esc(m) + '</small>' : '') + '</button>'; }).join('') + '</div>' +
      (inRev ? '<p class="r-sub" style="margin:0">' + trh('g.mn.res.rev') + '</p>' : '') +
      '<div class="r-stats"><div class="stat xp"><b>+' + xp + '</b><small>' + trh('g.res.xp') + '</small></div><div class="stat cn"><b>+' + coins + '</b><small>' + trh('g.res.coins') + '</small></div><div class="stat cb"><b>' + P.maxCombo + '</b><small>' + trh('g.res.combo') + '</small></div></div>' +
      '<div class="r-actions">' + next + '<div class="row" style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" data-act="home">' + trh('g.res.map') + '</button>' +
      '<button class="btn ghost" style="flex:1" data-act="mini" data-w="' + wi + '" data-k="' + k + '">' + trh('g.mn.res.again') + '</button></div></div></div>';
    show('result');
    SFX.win();
    confetti(all ? 160 : 70);
    const f = $('#result [data-focus]') || $('#result button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 100);
    setTimeout(() => {
      if (newDay) toast(tr('g.res.streak', { n: S.streak }), 'gold');
      checkAch();
      if (after > before) {
        confetti(200);
        openModal('<div class="big">🎖️</div>' + trh('g.res.lvup', { lv: after, title: titleOf(after) }) + '<button class="btn sun wide" data-act="close" data-focus>' + trh('g.res.yay') + '</button>');
      }
    }, 1700);
  }
  // 去上第 k 节（不给 = 下一节没学的）。只能上学过的和下一节；第一节之前先看「这一课学什么」（有、而且没看过）
  function miniGo(wi, k) {
    const n = miniN(wi);
    if (!WX[wi] || !n) return;
    const d = miniDone(wi);
    k = Math.max(0, Math.min(k == null || isNaN(k) ? d : k, d, n - 1));
    if (k === 0 && d === 0 && lessonOf(wi) && !(S.seenLesson || {})[wi]) { lessonSheet(wi, { mini: true }); return; }
    closeModal();
    startMini(wi, k);
  }
  // 开着「一步一步学」、小课没学完就点了第 1 关：先问一句（不锁关卡——说「我学过了」就照常闯关，以后这一课不再问）
  function miniAsk(wi, li) {
    const d = miniDone(wi);
    openModal('<div class="big">🌱</div><h2>' + trh('g.mn.ask.h') + '</h2><p>' + trh('g.mn.ask.p', { w: (WX[wi].words || []).length, n: miniN(wi) }) + '</p>' +
      '<button class="btn sun wide" data-act="mini" data-w="' + wi + '" data-focus>' + trh('g.mn.ask.go', { k: d + 1 }) + '</button>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + trh('g.det.later') + '</button><button class="btn ghost" data-act="miniSkip" data-w="' + wi + '" data-l="' + li + '">' + trh('g.mn.ask.skip') + '</button></div>');
  }
  // 小镇 / 单元卡片上的一排：🌱 一步一步学 ① ② ③ ④（开着、或者学过至少一节才显示）
  function miniRow(wi) {
    const n = miniN(wi), d = miniDone(wi);
    if (!n || !(starterOn() || d > 0)) return '';
    return '<div class="mn-row"><span class="mn-t">' + trh('g.mn.row') + '</span>' + range(n).map(k =>
      '<button class="mn-node ' + (k < d ? 'done' : k === d ? 'cur' : 'lock') + '" data-act="mini" data-w="' + wi + '" data-k="' + k + '"' + (k > d ? ' disabled' : '') +
      ' aria-label="' + esc(tr('g.mn.node', { k: k + 1 })) + '">' + (k < d ? '✓' : k + 1) + '</button>').join('') +
      (d >= n ? '<span class="mn-ok">' + trh('g.mn.row.done') + '</span>' : '') + '</div>';
  }

  // 闯关练习页最上面：📒 我的单词本（学过 n 个词）、🔤 发音入门（这门课有才有）
  function wordsBar() {
    return '<div class="wd-bar"><button class="btn small ghost" data-act="wordBook">' + trh('g.wb.btn', { n: bookCount() }) + '</button>' +
      (PRIMER ? '<button class="btn small ghost" data-act="primer">' + trh('g.pr.btn') + '</button>' : '') + '</div>';
  }

  // ---------- 闯关 ----------
  // given：测试用，直接给好题目（EchoGame.playQs）
  function startLevel(wi, li, review, given) {
    primeTTS(); ac();
    const qs = given || (review ? buildReview() : buildLevel(wi, li));
    if (!qs.length) { toast(tr('g.play.norev')); return; }
    const boss = !review && RECIPES[li].boss;
    // aidedN：带提示通过了几题；recall：不看字说对了几题（结算页显示）
    P = { wi, li, review: !!review, qs, idx: 0, total: qs.length, hearts: 3, combo: 0, maxCombo: 0, correct: 0, xp: 0, lost: 0, hits: 0, boss, bossMax: qs.filter(q => q.type === 'bt').length, revived: false, aidedN: 0, recall: 0 };
    show('play');
    renderHearts();
    $('#p-combo').textContent = '';
    $('#p-boss').innerHTML = boss ? bossBar() : '';
    if (boss) {
      const b = WX[wi].boss;
      hideFb();
      $('#p-prog').style.width = '0%';
      $('#p-body').innerHTML = '<div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="hidden-line">' + rb(b.hello) + '</div></div></div>' +
        '<p class="say-zh" style="text-align:center">' + trh('g.play.boss', { name: bossName(b) }) + '</p>' +
        '<button class="btn sun wide" data-act="bossGo" data-focus>' + trh('g.play.fight') + '</button>';
      $('#p-body').dataset.q = 'intro';
      say(b.hello);
    } else renderQ();
  }
  function bossBar() {
    const b = WX[P.wi].boss;
    const pct = P.bossMax ? (1 - P.hits / P.bossMax) * 100 : 100;
    return '<div class="boss-hp" id="bosshp"><span class="be">' + b.emoji + '</span><span class="bn">' + esc(bossName(b)) + '</span><div class="hp"><i style="width:' + pct + '%"></i></div></div>';
  }
  function renderHearts() {
    // 小课没有红心：这里写「🌱 第几节 / 共几节」
    if (P.mini) { $('#p-hearts').innerHTML = '<span class="mn-chip">' + trh('g.mn.chip', { k: P.mini.k + 1, n: P.mini.n }) + '</span>'; return; }
    $('#p-hearts').innerHTML = range(3).map(i => '<span class="' + (i < P.hearts ? '' : 'lost') + '">❤️</span>').join('');
  }
  function showCombo() {
    const el = $('#p-combo');
    if (P.combo >= 2) {
      const m = mult();
      el.textContent = tr('g.play.combo', { n: P.combo }) + (m > 1 ? tr('g.play.xpx', { m }) : '');
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    } else el.textContent = '';
  }
  const mult = () => P.combo >= 10 ? 3 : P.combo >= 5 ? 2 : P.combo >= 3 ? 1.5 : 1;

  const audioBlock = () => '<div class="q-audio"><button class="spk" data-act="say" aria-label="' + trh('g.play.play') + '">' + SPK + '</button><button class="slow" data-act="saySlow" aria-label="' + trh('g.play.slowplay') + '"><span>🐢</span>' + trh('g.play.slow') + '</button></div>';
  function optsHTML(q, cls, list) {
    return '<div class="opts ' + (list ? 'list' : '') + '">' + q.opts.map((o, i) =>
      '<button class="opt ' + (cls || '') + '" data-act="' + (q.type === 'bt' ? 'btOpt' : 'pick') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' +
      (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + rb(o.t) + '</span></button>').join('') + '</div>';
  }
  function micHTML(q) {
    const mode = speakMode();
    const selfNoRec = mode === 'self' && !canRecord();
    let h = '';
    if (!selfNoRec) {
      h += '<div class="mic-wrap"><button class="mic" id="mic" data-act="mic" aria-label="' + trh('g.play.mic') + '">' + MIC + '</button>' +
        '<div class="mic-hint" id="mic-hint">' + trh(mode === 'sr' ? 'g.play.mic.sr' : 'g.play.mic.rec') + '</div>' +
        '<div class="heard" id="heard"></div><div id="score"></div></div>';
    }
    h += '<div class="self" id="self" hidden></div>';
    // 开口模式平时不能跳过（说三次还不行会记进每日复习）；AI 打分用不了（没网、额度、没密钥，aiDown）时才出现「先跳过」
    if (mode !== 'sr') h += '<button class="link" data-act="skip">' + trh('g.play.skip') + '</button>';
    else h += '<button class="link ai-skip" data-act="skip" id="p-skip"' + (aiDown() ? '' : ' hidden') + '>' + esc(skipTxt()) + '</button>';
    return h;
  }
  // 口语题分两块：q-main 是题目卡片，q-side 是话筒 / 自评 / 跳过（竖屏照常上下排，横屏左右两栏）
  const qSide = h => '<div class="q-side">' + h + '</div>';
  function wordsHTML(text) {
    // 别的课：按 LANG.pieces 的词块（和打分的 marks 一一对应），日语、中文每块标读音
    if (LANG) { const e = entryOf(text), ps = LANG.pieces(String(text), e), rs = rubyOn() && e ? rubyParts(text) : null; return ps.map((w, k) => '<span class="w">' + (rs && rs[k] ? rubyPiece(rs[k][0], rs[k][1]) : esc(w)) + '</span>').join(LANG.script === 'latin' ? ' ' : ''); }
    return text.split(/\s+/).map(w => '<span class="w">' + esc(w) + '</span>').join(' ');
  }
  // 排句子的一块（别的课标读音）
  const tileTxt = (q, i) => (LANG && rubyOn() && q.tokR ? rubyPiece(q.tokens[i], q.tokR[i]) : esc(q.tokens[i]));

  function renderQ() {
    const q = P.qs[P.idx];
    P.q = q; P.answered = false; P.tries = 0; P.miss = 0; P.hint = 0; P.lo = []; P.btChoose = false; P.pickedOk = false; P.selfReveal = false;
    // 按掌握程度撤提示：fade 见 fadeRaw() / fadeFor()；看图说英语一直是凭记忆说；Boss 的对话题掌握了以后先不给选项（只在 AI 打分时，自评要点选项）
    // aided：这题点过提示 / 看过原文 / 第 2 次才说对（不算 Perfect、不加连击、经验减半、复习里不升格）；blind：题面上没有答案
    // 界面语言里没有意思时：P.cue（cueMode）= 'pic' 看图说 / 'hear' 先念一遍再看首字母说，格数按 fadeFor 换过；blind 的算法不变
    const t = q.type, srm = speakMode() === 'sr', it = itemOfQ(q);
    P.cue = cueMode(meanOf(it), it, q.kind, true);
    // 小课（q.mini）：跟读一直看着全文，不撤提示
    P.fade = q.mini ? 0 : t === 'sp' ? 2 : /^sr_/.test(t) ? fadeFor(q, true) : t === 'bt' && srm ? Math.min(1, fadeFor(q, true)) : 0;
    P.aided = false;
    P.blind = t === 'sp' || P.fade >= 2 || (t === 'bt' && P.fade >= 1);
    hideFb();
    window.scrollTo(0, 0);   // 上一题往下滚过，新题要从标题开始看
    $('#p-prog').style.width = (P.idx / P.total * 100) + '%';
    // 撤了提示的跟读题不再叫「跟读」：看首字母说 / 凭记忆说 / 改正说法
    const FADE_LABEL = { 1: trh('g.fade.1'), 2: trh('g.fade.2'), 3: trh('g.fade.3') };
    let h = '<div class="q-type">' + (t === 'tc' ? trh('g.mn.new') : t === 'mw' ? trh('g.mn.mw.ty') : (/^sr_/.test(t) && FADE_LABEL[P.fade]) || (q.ear ? trh('g.cue.' + t + '.ty') : TYPE_LABEL[q.type])) + '</div>';
    const hintRow = '<div class="say-row"><button class="btn small ghost" data-act="hint" id="hintbtn">' + trh('g.play.hint') + '</button></div>';
    const said = P.fade === 3 ? (S.rev.items[revKey(q)] || {}).said || '' : '';
    // 意思那一行（qMean：中文界面照旧是 q.zh；界面语言里没有意思就不显示）
    const mean = qMean(q), meanDiv = mean != null ? '<div class="say-zh">' + esc(mean) + '</div>' : '';
    const slow = '<span>🐢</span>' + trh('g.play.slow');
    // 小课的两样（tools/course/STARTER.md）：tc 教学卡——图、词（读音、罗马字）、意思，自动念一遍，点「记住了」往下走；mw 看意思（和图）选词
    if (t === 'tc') h += '<div class="q-main"><div class="say-card tc-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') + '<div class="say-text">' + rb(q.en) + '</div>' + romaHTML(q.en) + meanDiv +
      '<div class="say-row"><button class="spk mini" data-act="say" aria-label="' + trh('g.play.play') + '">' + SPK + '</button><button class="slow" data-act="saySlow" aria-label="' + trh('g.play.slowplay') + '">' + slow + '</button></div></div></div>' +
      '<button class="btn wide" data-act="tcNext" id="tc-next">' + trh('g.mn.got') + '</button>';
    else if (t === 'mw') h += '<h2 class="q-title">' + trh('g.mn.mw.t') + '</h2><div class="mw-cue">' + (q.em ? '<span class="say-emoji">' + q.em + '</span>' : '') + (mean != null && mean !== '' ? '<b>' + esc(mean) + '</b>' : '') + '</div>' + optsHTML(q, 'en', true);
    else if (t === 'lw') h += '<h2 class="q-title">' + trh(q.ear ? 'g.cue.lw.t' : 'g.q.lw.t') + '</h2>' + audioBlock() + optsHTML(q, q.ear ? 'en' : '');
    else if (t === 'ls') h += '<h2 class="q-title">' + trh('g.q.ls.t') + '</h2>' + audioBlock() + optsHTML(q, 'en');
    else if (t === 'lm') h += '<h2 class="q-title">' + trh(q.ear ? 'g.cue.lm.t' : 'g.q.lm.t') + '</h2>' + audioBlock() + optsHTML(q, q.ear ? 'en' : '', true);
    else if (t === 'lr') h += '<h2 class="q-title">' + trh('g.q.lr.t') + '</h2>' + audioBlock() +
      '<div class="hidden-line blur" id="hl">' + rb(q.prompt) + '</div><div style="text-align:center"><button class="link" data-act="reveal">' + trh('g.q.see.long') + '</button></div>' + optsHTML(q, 'en', true);
    else if (t === 'lo') h += '<h2 class="q-title">' + trh('g.q.lo.t') + '</h2>' + audioBlock() +
      '<div class="lo-ans" id="lo-ans"></div><div class="lo-bank" id="lo-bank">' + q.bank.map(i => '<button class="tile" data-act="tile" data-i="' + i + '">' + tileTxt(q, i) + '</button>').join('') + '</div>' +
      '<button class="btn wide" data-act="loCheck" id="lo-check" disabled>' + trh('g.q.check') + '</button>';
    else if ((t === 'sr_w' || t === 'sr_s') && !P.fade) h += '<h2 class="q-title">' + trh('g.q.rep.t') + '</h2>' +
      '<div class="q-main"><div class="say-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') + '<div class="say-text" id="st">' + wordsHTML(q.target) + '</div>' + meanDiv +
      '<div class="say-row"><button class="spk mini" data-act="sayT" aria-label="' + trh('g.play.hear') + '">' + SPK + '</button><button class="slow" data-act="sayTSlow" aria-label="' + trh('g.play.slow') + '">' + slow + '</button></div></div></div>' + qSide(micHTML(q));
    else if (t === 'sr_w' || t === 'sr_s') h += '<h2 class="q-title">' + (P.fade === 3 ? trh('g.q.fix.t') : P.fade === 2 ? trh(P.cue === 'pic' ? 'g.cue.pic.t' : 'g.q.mem.t') : trh((P.cue === 'hear' ? 'g.cue.hear.' : 'g.q.cue.') + (t === 'sr_w' ? 'w' : 's'))) + '</h2>' +
      '<div class="q-main"><div class="say-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') +
      (said ? '<div class="say-zh">' + trh('g.q.said', { s: said }) + '</div>' : '') + (mean ? meanDiv : '') +
      '<div class="say-text mask" id="st">' + esc(cueText(q.target, P.fade === 1 ? 1 : 2)) + '</div>' + hintRow + '</div></div>' + qSide(micHTML(q));
    else if (t === 'sr_d') h += '<h2 class="q-title">' + trh(P.fade >= 2 ? 'g.q.dlg.mem' : 'g.q.dlg.t') + '</h2>' +
      '<div class="q-main"><div class="bubble-row"><span class="be">🧑‍🏫</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="' + trh('g.play.hearq') + '">' + SPK + '</button><span>' + rb(q.prompt) + '</span></div></div></div>' +
      '<div class="say-card"><div class="say-zh">' + trh('g.q.you') + '</div>' + (P.fade
        ? '<div class="say-text mask" id="st">' + esc(cueText(q.target, P.fade, true)) + '</div>' + hintRow
        : '<div class="say-text" id="st">' + wordsHTML(q.target) + '</div><div class="say-row"><button class="spk mini" data-act="sayT" aria-label="' + trh('g.play.model') + '">' + SPK + '</button><button class="slow" data-act="sayTSlow">' + slow + '</button></div>') + '</div></div>' + qSide(micHTML(q));
    else if (t === 'sp') h += '<h2 class="q-title">' + trh('g.q.sp.t') + '</h2>' +
      '<div class="q-main"><div class="say-card"><div class="say-emoji">' + q.em + '</div>' + meanDiv + '<div class="say-text mask" id="st">' + esc(cueText(q.target, 2)) + '</div>' +
      hintRow + '</div></div>' + qSide(micHTML(q));
    else if (t === 'bt') {
      const b = WX[P.wi].boss, hide = P.fade >= 1;
      h += '<div class="q-main"><div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="' + trh('g.play.again') + '">' + SPK + '</button><button class="slow" data-act="saySlow">' + slow + '</button></div>' +
        '<div class="hidden-line blur" id="hl">' + rb(q.prompt) + '</div><button class="link" data-act="reveal">' + trh('g.q.see') + '</button></div></div>' +
        '<p class="say-zh" style="text-align:center;margin:0">' + trh(hide ? 'g.q.bt.mem' : srm ? 'g.q.bt.sr' : 'g.q.bt.self') + '</p></div>' +
        (hide ? optsHTML(q, 'en', true).replace('<div class="opts', '<div id="bt-opts" hidden class="opts') + '<div style="text-align:center"><button class="link" data-act="btShow" id="bt-show">' + trh('g.q.bt.show') + '</button></div>' : optsHTML(q, 'en', true)) +
        qSide(srm ? micHTML(q) : '<div class="self" id="self" hidden></div>');
    }
    $('#p-body').innerHTML = h;
    $('#p-body').dataset.q = t;   // 横屏排版按题型分栏（style.css 横屏那段）
    if (SPEAK_TYPES.includes(t) && speakMode() === 'self' && !canRecord()) showSelf(false, true);
    // 自动先念一遍：跟读题撤了提示以后不念（不然等于把答案念出来）；说出回答 / Boss 念的是对方的问题，照常念。
    // 例外：界面语言里没有意思、换成「先听一遍，再看首字母说」的（cueMode 'hear'，格数 1）就念这一遍——再听要点提示，算带提示
    const once = P.cue === 'hear' && P.fade === 1;
    if (t !== 'sp' && (once || !(P.fade && (t === 'sr_w' || t === 'sr_s')))) setTimeout(() => { if (P && P.q === q) say(q.audio); }, 380);
    if (t === 'tc') { const b = $('#tc-next'); if (b) setTimeout(() => { if (P && P.q === q) b.focus({ preventScroll: true }); }, 60); }
  }
  // 撤了提示的题：亮出答案（marks：每个词说对没有，标绿 / 标红）
  function showAnswer(marks) {
    const st = $('#st'); if (!st || !P) return;
    if (st.classList.contains('mask')) { st.classList.remove('mask'); st.innerHTML = wordsHTML(P.q.target); }
    if (marks) $$('.w', st).forEach((w, k) => { w.classList.toggle('ok', !!marks[k]); w.classList.toggle('miss', !marks[k]); });
    const b = $('#hintbtn'); if (b) b.disabled = true;
  }
  // 撤了提示的题还没答完就听示范（键盘、录音自评的 🔊）：等于看了答案
  function peekAnswer() {
    const st = $('#st');
    if (!P || P.answered || P.selfReveal || !st || !st.classList.contains('mask')) return;
    P.aided = true; showAnswer();
  }
  // Boss 题的选项亮出来；aid：还没答完就看了（算带提示）
  function btReveal(aid) {
    const o = $('#bt-opts'); if (o) o.hidden = false;
    const b = $('#bt-show'); if (b) b.remove();
    if (aid && P && !P.answered) P.aided = true;
  }

  function praise() { return pick(PRAISE); }
  function showFb(ok, title, detail, btn) {
    const fb = $('#fb');
    fb.className = 'fb show ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
    $('#fb-t').textContent = title;
    $('#fb-d').innerHTML = detail || '';
    $('#fb-btn').textContent = btn || tr('g.shell.next');
    $('#p-prog').style.width = ((P.idx + 1) / P.total * 100) + '%';
    setTimeout(() => $('#fb-btn').focus({ preventScroll: true }), 60);
    // 标出对错的选项 / 排好的句子不要被反馈条盖住（横屏时屏幕矮，最常见）：往上滚一点，但别把它滚到顶栏下面
    setTimeout(() => {
      const ms = $$('#p-body .opt.right, #p-body .opt.wrong, #lo-ans').map(e => e.getBoundingClientRect()).filter(r => r.height);
      if (!ms.length || !fb.classList.contains('show')) return;
      const bot = Math.max(...ms.map(r => r.bottom)), top = Math.min(...ms.map(r => r.top));
      const limit = window.innerHeight - fb.offsetHeight - 8, head = ($('#play .p-top') || { offsetHeight: 0 }).offsetHeight + 8;
      const dy = Math.min(bot - limit, top - head);
      if (bot > limit && dy > 0) window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
    }, 40);
  }
  function hideFb() { $('#fb').className = 'fb'; }

  // 答对了。带着提示答对的（点过提示、看过原文、第 2 次才说对）：不算 Perfect、不加连击、经验减半、复习里不升格（明天再考），新学的按「弱」进复习
  function good(speak, perfect) {
    // 小课：不进复习本（学完一节，这一节的词一起按「新学的」进，miniFinish）；每日任务、听说的次数照常算
    if (P.mini) {
      P.correct++; P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo);
      const gain = Math.round((speak ? (perfect ? 8 : 6) : 4) * mult());
      P.xp += gain;
      if (speak) { S.stats.spoken++; qProg('spoken', 1); if (perfect) { S.stats.perfect++; qProg('perfect', 1); } logSpk(P.tries === 0); }
      else { S.stats.listen++; qProg('listen', 1); }
      SFX.ok(P.combo);
      showCombo();
      return gain;
    }
    const aided = !!P.aided || (speak && P.tries > 0);
    P.aided = aided;
    P.correct++;
    if (aided) { P.aidedN++; dayLog().aided = (dayLog().aided || 0) + 1; }
    else { P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo); }
    perfect = perfect && !aided;
    let gain = Math.round((speak ? (perfect ? 20 : 15) : 10) * mult());
    if (aided) gain = Math.max(1, Math.round(gain / 2));
    P.xp += gain;
    if (speak) { S.stats.spoken++; qProg('spoken', 1); if (perfect) { S.stats.perfect++; qProg('perfect', 1); } logSpk(!aided); }
    else { S.stats.listen++; qProg('listen', 1); }
    // 不看字说对（凭记忆说出来的）：结算页「几题」；周报和神兽里程碑只数句子（dayLog().recall），单个词另记 recallW
    if (speak && P.blind && !aided) { P.recall++; const rk = KIND[P.q.type] === 'word' ? 'recallW' : 'recall'; dayLog()[rk] = (dayLog()[rk] || 0) + 1; }
    if (speak) { const e = S.rev.items[revKey(P.q)]; if (e && e.owe) delete e.owe; }   // 先跳过、欠着的那句补说了
    revRight(P.q, P.review, aided);
    SFX.ok(P.combo);
    showCombo();
    if (P.boss && P.q.type === 'bt') bossHit();
    return gain;
  }
  // 周报「一次说对的比例」：开口题做完一道记一次（spkQ），第一次就不带提示说对的记 spk1
  function logSpk(first) { const L = dayLog(); L.spkQ = (L.spkQ || 0) + 1; if (first) L.spk1 = (L.spk1 || 0) + 1; }
  function bad() {
    // 小课：不扣心、不记错题，过两题再问一次
    if (P.mini) { P.combo = 0; P.lost++; SFX.bad(); buzz(120); showCombo(); miniAgain(P.q); return; }
    P.combo = 0; P.hearts--; P.lost++;
    addWrong(P.q);
    SFX.bad(); buzz(120);
    renderHearts(); showCombo();
  }
  function bossHit() {
    P.hits++;
    $('#p-boss').innerHTML = bossBar();
    const bar = $('#bosshp');
    bar.classList.add('hit');
    SFX.hit();
    const d = document.createElement('span');
    d.className = 'dmg'; d.textContent = '-' + Math.round(100 / P.bossMax) + '%';
    d.style.left = '60%'; d.style.top = '0';
    bar.style.position = 'relative';
    bar.appendChild(d);
  }
  function detailOf(q) {
    if (q.kind === 'dlg') return '<b>' + rb(q.prompt) + '</b> → ' + rb(q.en);
    const m = qMean(q);   // 界面语言里没有意思：只给英文
    return '<b>' + rb(q.en) + '</b>' + (m != null ? ' · ' + esc(m) : '');
  }

  // 选择题
  function onPick(i) {
    if (!P || P.answered) return;
    const q = P.q, o = q.opts[i];
    P.answered = true;
    $$('#p-body .opt').forEach((b, k) => {
      if (q.opts[k].c) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const hl = $('#hl'); if (hl) hl.classList.remove('blur');
    if (o.c) {
      const g = good(false);
      showFb(true, praise() + tr('g.fb.xp', { n: g }) + (P.aided ? tr('g.fb.peek') : ''), detailOf(q));
      if (q.type === 'mw') setTimeout(() => say(q.en), 250);   // 看意思选词：选对了念一遍这个词
    } else {
      bad();
      showFb(false, tr(P.mini ? 'g.mn.fb.wrong' : 'g.fb.wrong'), trh('g.fb.ans') + detailOf(q));
      setTimeout(() => say(q.type === 'lr' ? q.en : q.audio || q.en), 300);
    }
  }
  // 听音排句
  function onTile(i, fromAns) {
    if (!P || P.answered) return;
    const q = P.q;
    if (fromAns) P.lo = P.lo.filter(x => x !== i);
    else if (!P.lo.includes(i)) P.lo.push(i);
    SFX.tap();
    $('#lo-ans').innerHTML = P.lo.map(k => '<button class="tile" data-act="untile" data-i="' + k + '">' + tileTxt(q, k) + '</button>').join('');
    $$('#lo-bank .tile').forEach(b => b.classList.toggle('used', P.lo.includes(+b.dataset.i)));
    $('#lo-check').disabled = P.lo.length !== q.tokens.length;
  }
  function onLoCheck() {
    if (!P || P.answered) return;
    const q = P.q;
    P.answered = true;
    const ok = P.lo.map(k => q.tokens[k].toLowerCase()).join(' ') === q.tokens.map(t => t.toLowerCase()).join(' ');
    $('#lo-ans').classList.add(ok ? 'right' : 'wrong');
    if (ok) { const g = good(false); showFb(true, praise() + tr('g.fb.xp', { n: g }), detailOf(q)); }
    else { bad(); showFb(false, tr('g.fb.order'), trh('g.fb.sent') + detailOf(q)); setTimeout(() => say(q.audio), 300); }
  }

  // 口语题
  function setMic(on, label) {
    const m = $('#mic'); if (!m) return;
    m.classList.toggle('on', on);
    m.innerHTML = on ? STOP : MIC;
    if (label !== undefined) $('#mic-hint').textContent = label;
  }
  async function onMic() {
    if (!P || P.answered) return;
    if (RT.listening || RT.recording) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const q = P.q;
    if (speakMode() === 'sr') {
      setMic(true, tr('g.play.listening'));
      $('#heard').textContent = '';
      $('#score').innerHTML = '';
      const res = await recognize(t => { const h = $('#heard'); if (h) h.textContent = t; }, q.type === 'bt' ? q.opts.map(o => o.t) : [q.target]);
      if (!P || P.q !== q || P.answered) return;
      setMic(false, '');
      if (res.err && FATAL.includes(res.err)) {
        RT.srBroken = true;
        if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
        toast(tr(RT.noRec ? 'g.play.nomic' : 'g.play.nosr'));
        if (q.type === 'bt') { P.btChoose = true; btReveal(false); const wrap = $('.mic-wrap'); if (wrap) wrap.remove(); toast(tr('g.play.bt.tap')); }
        else renderQ();
        return;
      }
      // 没拿到话：把「🎤 请说……」那一行清掉。识别自己停了（不是孩子点的停）时下面不写提示，这一行不清就像卡住了（2026-11-20 老板的 iPhone）
      if (!res.alts.length) { const h = $('#heard'); if (h && /^(🎤|🎧)/.test(h.textContent)) h.textContent = ''; noHeard(res); return; }
      if (q.type === 'bt') evalBoss(res.alts); else evalSpeak(res.alts);
    } else {
      startRecording();
    }
  }
  function evalSpeak(alts) {
    const q = P.q;
    const r = bestScore(q.target, alts);
    $('#heard').textContent = tr('g.fb.heard', { s: r.heard });
    { const L = dayLog(); L.sayN = (L.sayN || 0) + 1; L.saySum = (L.saySum || 0) + r.score; }   // 周报：开口几次、平均几分
    if (r.score < 90) aiTip(q.target, r.heard, $('#heard'));
    const st = $('#st'), masked = st && st.classList.contains('mask');
    if (st && !masked) $$('.w', st).forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    const cls = r.score >= 85 ? 'good' : r.score >= 60 ? 'mid' : 'low';
    $('#score').innerHTML = '<div class="score ' + cls + '"><b>' + r.score + '</b><span>' + trh('g.fb.pts') + '</span></div>';
    if (r.score >= 60) passSpeak(r.score, true, r.marks);
    else {
      P.tries++;
      if (P.tries + P.miss >= sayMax()) failSpeak(r.marks);
      else { SFX.bad(); $('#mic-hint').textContent = tr(masked ? 'g.fb.retry.mem' : 'g.fb.retry.red') + tr('g.fb.try', { n: P.tries + P.miss + 1 }); }
    }
  }
  // 话筒没拿到话：没听清算一次尝试（第 3 次还没听清就记进错题本）；没网 / 额度 / 没密钥说清原因，AI 用不了时亮出「先跳过」
  function noHeard(res) {
    const hint = $('#mic-hint'); if (!hint || !P) return;
    if (res.fail === 'unheard') {
      P.miss++;
      if (P.tries + P.miss >= sayMax()) {
        if (P.q.type === 'bt') { P.btChoose = true; btReveal(true); hint.textContent = tr('g.fb.bt.unheard'); return; }
        failSpeak(); return;
      }
      SFX.bad();
      hint.textContent = failHint(res) + tr('g.fb.try', { n: P.tries + P.miss + 1 });
      return;
    }
    hint.textContent = failHint(res);
    if (aiDown()) { const sk = $('#p-skip'); if (sk) sk.hidden = false; }
  }
  // 口语题最多说几次：闯关 3 次；小课的跟读 2 次（没读准就先往下走，见 failSpeak）
  const sayMax = () => (P && P.mini ? 2 : 3);
  function passSpeak(score, measured, marks) {
    const q = P.q;
    P.answered = true;
    if (P.tries > 0) P.aided = true;   // 第 2 次才说对：算带提示
    const perfect = measured && score >= 85 && !P.aided;
    showAnswer(marks);
    const g = good(true, perfect);
    // 小课里第 2 次才读对的不说「有提示，经验减半」（小课不减经验、也不进复习）
    showFb(true, tr(P.aided && !P.mini ? (P.review ? 'g.fb.pass.aid.rev' : 'g.fb.pass.aid') : perfect ? 'g.fb.perfect' : score >= 75 ? 'g.fb.good' : 'g.fb.pass') + tr('g.fb.xp', { n: g }), detailOf(q));
  }
  function failSpeak(marks) {
    const q = P.q;
    // 小课：两次没读准（或没听清）就先往下走——亮出答案、再念一遍，不记错题（跟读是练习，不是考试；分数照实显示过了）
    if (P.mini) {
      P.answered = true; P.combo = 0; showCombo(); logSpk(false); showAnswer(marks);
      showFb(null, tr('g.mn.say.soft'), detailOf(q));
      setTimeout(() => say(q.target || q.en), 300);
      return;
    }
    P.answered = true;
    P.combo = 0; showCombo();
    addWrong(q);
    logSpk(false);
    showAnswer(marks);
    showFb(false, tr('g.fb.fail'), trh('g.fb.saved') + detailOf(q));
    setTimeout(() => say(q.target || q.en), 300);
  }
  // 跳过：自评模式「现在不方便开口」；开口模式只有 AI 用不了时才有——这题放进复习（今天到期、不算答错），联网以后复习里要补说
  function onSkip() {
    if (!P || P.answered) return;
    stopListening();
    P.answered = true;
    P.combo = 0; showCombo();
    const q = P.q, ai = speakMode() === 'sr' && !P.mini;   // 小课里跳过跟读：不欠着、不进复习
    if (ai) { revLater(q); const L = dayLog(); L.aiSkip = (L.aiSkip || 0) + 1; }
    showAnswer();
    btReveal(false);
    showFb(null, tr(ai ? 'g.fb.skip.ai' : 'g.fb.skip'), (ai ? trh('g.fb.skip.owe') : '') + detailOf(q));
  }
  // 💡 提示：一级级给（凭记忆 → 首字母 → 整句并念一遍）。点了就算带提示（不算 Perfect、经验减半、复习里不升格）
  function onHint() {
    if (!P || P.answered) return;
    const q = P.q, st = $('#st'); if (!st) return;
    P.hint++; P.aided = true;
    const b = $('#hintbtn');
    if (P.fade - P.hint === 1) { st.textContent = cueText(q.target, 1); if (b) b.textContent = tr('g.play.hint2'); }
    else { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); say(q.target); if (b) b.disabled = true; }
  }

  // 录音自评（识别不可用时）
  async function startRecording() {
    if (!canRecord()) { showSelf(false); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { RT.noRec = true; const w = $('.mic-wrap'); if (w) w.remove(); showSelf(false); return; }
    const q = P && P.q;
    let mr;
    try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); RT.noRec = true; showSelf(false); return; }
    const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      RT.recording = false; RT.mr = null; clearTimeout(RT.recTimer);
      if (MUS()) MUS().hold(false);
      if (!P || P.q !== q) return;
      if (RT.recUrl) URL.revokeObjectURL(RT.recUrl);
      RT.recUrl = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      setMic(false, tr('g.play.rec.done'));
      showSelf(true);
    };
    RT.mr = mr; RT.recording = true;
    if (MUS()) MUS().hold(true);
    mr.start();
    setMic(true, tr('g.play.rec.on'));
    RT.recTimer = setTimeout(() => { if (RT.recording) stopListening(); }, 9000);
  }
  // quiet：刚出题时直接显示（不滚动）；录完音、选对回答之后才出来的，滚到看得见的地方（横屏时常在屏幕下面）
  function showSelf(hasRec, quiet) {
    const q = P.q, box = $('#self');
    if (!box) return;
    const sp = q.type === 'sp', st = $('#st'), masked = !!st && st.classList.contains('mask');
    const reveal = () => { if (!quiet) setTimeout(() => { if (!box.hidden && box.isConnected) box.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }, 30); };
    // 撤了提示的题（看图说、凭记忆说）：先自己说，说完再看答案
    if (masked && !hasRec && !P.selfReveal && q.type !== 'bt') {
      box.hidden = false;
      box.innerHTML = '<p>' + trh(sp ? 'g.play.self.pic' : 'g.play.self.mem') + '</p><button class="btn small" data-act="selfReveal">' + trh('g.play.self.done') + '</button>';
      reveal();
      return;
    }
    if (masked) { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); if (hasRec) say(q.target); }
    box.hidden = false;
    box.innerHTML = '<p>' + (q.type === 'bt' ? trh('g.play.self.bt', { name: bossName(WX[P.wi].boss), s: q.target }) : trh(hasRec ? 'g.play.self.cmp' : 'g.play.self.read')) + '</p>' +
      '<div class="say-row">' + (hasRec ? '<button class="btn small ghost" data-act="playMine">' + trh('g.play.self.mine') + '</button>' : '') + '<button class="btn small ghost" data-act="sayT">' + trh('g.play.self.orig') + '</button></div>' +
      '<div class="rate"><button class="btn coral" data-act="rate" data-v="0">' + trh('g.play.rate.0') + '</button><button class="btn sun" data-act="rate" data-v="1">' + trh('g.play.rate.1') + '</button><button class="btn leaf" data-act="rate" data-v="2">' + trh('g.play.rate.2') + '</button></div>';
    reveal();
  }
  function onRate(v) {
    if (!P || P.answered) return;
    if (v === 0) {
      P.tries++;
      if (P.tries >= sayMax()) { failSpeak(); return; }
      toast(tr('g.play.rate.again') + (canRecord() && P.q.type !== 'bt' ? tr('g.play.rate.rerec') : ''));
      say(P.q.target);
      if (canRecord() && P.q.type !== 'bt' && speakMode() === 'self') { $('#self').hidden = true; setMic(false, tr('g.play.rerec')); }
      return;
    }
    passSpeak(v === 2 ? 90 : 72, false);
  }

  // Boss 对话
  function evalBoss(alts) {
    const q = P.q;
    const scores = q.opts.map(o => bestScore(o.t, alts));
    let bi = 0; scores.forEach((s, k) => { if (s.score > scores[bi].score) bi = k; });
    const best = scores[bi];
    $('#heard').textContent = tr('g.fb.heard', { s: best.heard });
    if (q.opts[bi].c && best.score >= 55) {
      markBt(bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      passBoss(best.score);
    } else if (!q.opts[bi].c && best.score >= 65) {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, tr('g.fb.dodge', { name: bossName(WX[P.wi].boss) }), trh('g.fb.reply') + detailOf(q));
      setTimeout(() => say(q.en), 300);
    } else {
      P.tries++;
      const hidden = !!$('#bt-opts') && $('#bt-opts').hidden;
      if (hidden) { btReveal(true); $('#mic-hint').textContent = tr('g.fb.bt.see'); }
      else if (P.tries + P.miss >= 3) { P.btChoose = true; $('#mic-hint').textContent = tr('g.fb.bt.tap'); }
      else $('#mic-hint').textContent = tr('g.fb.bt.again', { n: P.tries + P.miss + 1 });
    }
  }
  function markBt(ri, wi) {
    btReveal(false);
    $$('#p-body .opt').forEach((b, k) => { b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim'); });
  }
  function passBoss(score) {
    P.answered = true;
    if (P.tries > 0) P.aided = true;
    const crit = score >= 85 && !P.aided, g = good(true, crit);
    showFb(true, tr(crit ? 'g.fb.crit' : 'g.fb.hit') + tr('g.fb.xp', { n: g }) + (P.aided ? tr('g.fb.aid') : ''), detailOf(P.q));
  }
  function onBtOpt(i) {
    if (!P || P.answered) return;
    const q = P.q;
    if (speakMode() === 'sr' && !P.btChoose) { say(q.opts[i].t); return; }
    if (P.pickedOk) return;
    if (q.opts[i].c) {
      P.pickedOk = true;
      markBt(i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      q.target = q.opts[i].t;
      const w = $('.mic-wrap'); if (w) w.remove();
      if (!$('#self')) $('#p-body').insertAdjacentHTML('beforeend', '<div class="self" id="self" hidden></div>');
      showSelf(false);
      say(q.target);
    } else {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, tr('g.fb.dodge', { name: bossName(WX[P.wi].boss) }), trh('g.fb.reply') + detailOf(q));
      setTimeout(() => say(q.en), 300);
    }
  }

  function onNext() {
    if (!P || !P.answered) return;
    stopListening();
    if (P.hearts <= 0) { failModal(); return; }
    P.idx++;
    if (P.idx >= P.total) finish(); else renderQ();
  }
  function failModal() {
    const can = S.coins >= 30 && !P.revived;
    openModal('<div class="big">💔</div>' + trh('g.res.fail') +
      '<button class="btn sun wide" data-act="revive" ' + (can ? '' : 'disabled') + '>' + trh('g.res.revive') + (P.revived ? trh('g.res.once') : S.coins < 30 ? trh('g.res.poor') : '') + '</button>' +
      '<div class="row"><button class="btn ghost" data-act="home">' + trh('g.res.map') + '</button><button class="btn" data-act="retry">' + trh('g.res.retry') + '</button></div>', { locked: true });
  }

  function finish() {
    if (P.mini) { miniFinish(); return; }   // 小课有自己的结算（tools/course/STARTER.md）
    hideFb();
    const acc = P.correct / P.total;
    const stars = P.lost === 0 && acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    const key = P.wi + '-' + P.li;
    const prev = P.review ? 0 : (S.stars[key] || 0);
    if (!P.review) S.stars[key] = Math.max(prev, stars);
    let coins = 5 + stars * 5 + (P.boss ? 20 : 0);
    const lucky = Math.random() < 0.15;
    if (lucky) coins *= 2;
    const firstThree = !P.review && stars === 3 && prev < 3;
    if (firstThree) coins += 15;
    const balls = stars === 3 ? 2 : 1;
    S.mon.balls += balls;
    const xp = P.xp + 20 + stars * 10;
    const before = lvInfo(S.xp).lv;
    S.xp += xp; S.coins += coins;
    const after = lvInfo(S.xp).lv;
    S.stats.levels++;
    if (stars === 3) { S.stats.threeStars++; qProg('three', 1); }
    if (P.boss && prev === 0) S.stats.bosses++;
    // 按能力走：打赢了正在学的这个单元的 BOSS，「正在学」挪到下一个单元（冒险出题、聊天、挑战馆的门槛都跟着走）
    if (P.boss && !P.review && stars > 0 && PLV() != null && isUnit(P.wi) && P.wi - NB === curIdx() && unitOpen(P.wi - NB + 1)) { S.book.at = P.wi - NB + 1; RT.scrollCur = true; }
    if (P.lost === 0 && P.correct === P.total) S.stats.flawless++;
    S.stats.maxCombo = Math.max(S.stats.maxCombo, P.maxCombo);
    qProg('combo', P.maxCombo, true);
    qProg('levels', 1);
    if (P.review && P.correct >= Math.ceil(P.total / 2)) dayLog().revSess = (dayLog().revSess || 0) + 1;
    // 多学一点换冒险时间：只数真的有进步的练习关（第一次通关或星星变多），反复刷最简单的一关不算
    if (!P.review && stars > prev) dayLog().pract = (dayLog().pract || 0) + 1;
    const newDay = markToday();
    if (after > before) S.coins += 20;
    save();
    renderTop();

    const w = WX[P.wi], r = RECIPES[P.li];
    const newWorld = P.boss && prev === 0 && P.wi + 1 < W.length;
    let nextBtn = '';
    if (!P.review) {
      if (P.li < 6) nextBtn = '<button class="btn wide" data-act="go" data-w="' + P.wi + '" data-l="' + (P.li + 1) + '" data-focus>' + trh('g.res.next') + '</button>';
      else if (P.wi + 1 < W.length) nextBtn = '<button class="btn wide" data-act="go" data-w="' + (P.wi + 1) + '" data-l="0" data-focus>' + trh('g.res.goisle', { name: isleName(P.wi + 1) }) + '</button>';
      else if (isUnit(P.wi) && P.wi + 1 < WX.length) nextBtn = '<button class="btn wide" data-act="go" data-w="' + (P.wi + 1) + '" data-l="0" data-focus>' + trh('g.res.nextunit', { name: wxName(P.wi + 1) }) + '</button>';
    }
    const gt = P.review && S.settings.gate !== false ? gate() : null;
    if (P.review && gt && gt.open) nextBtn = '<button class="btn sun wide" data-act="goAdventure" data-focus>' + trh('g.res.adv') + '</button>';
    // 复习做完了、还差聊天：主按钮直接去和岛民聊天
    else if (P.review && gt && gt.revDone && !gt.chatOk && gt.chatOn && !gt.keyBad) nextBtn = '<button class="btn sun wide" data-act="gateTalk" data-focus>' + trh('g.res.talk') + '</button>';
    const title = P.review ? trh('g.res.rev') : P.boss ? trh('g.res.beat', { name: bossName(w.boss) }) : trh(stars === 3 ? 'g.res.perfect' : 'g.res.clear');
    // r-hero（大图、标题、星星）和 r-body（奖励、数据、按钮）：竖屏照常一列，横屏左右两栏
    $('#result').innerHTML =
      '<div class="r-hero"><div class="big" style="font-size:64px">' + (P.boss ? w.boss.emoji + '💥' : S.pet) + '</div>' +
      '<h1 class="r-title">' + title + '</h1>' +
      '<p class="r-sub">' + (P.review ? (dueList().length ? trh('g.res.more', { n: dueList().length }) : trh('g.res.alldone')) : esc(wxName(P.wi)) + ' · ' + r.name) + '</p>' +
      '<div class="r-stars" id="rstars"><span>⭐</span><span>⭐</span><span>⭐</span></div></div><div class="r-body">' +
      (lucky ? '<div class="lucky">' + trh('g.res.lucky') + '</div>' : '') +
      (firstThree ? '<div class="lucky">' + trh('g.res.three') + '</div>' : '') +
      (window.MonsterGame ? '<div class="lucky">' + trh('g.res.balls', { n: balls }) + '</div>' : '') +
      (newWorld ? '<div class="lucky">' + trh('g.res.newisle', { name: isleName(P.wi + 1) }) + '</div>' : '') +
      (gt ? '<div class="lucky">' + (gt.open ? trh('g.res.gate.open') : gt.revDone ? trh('g.res.gate.talk', { n: Math.min(gt.voice, gt.need), need: gt.need }) : trh('g.res.gate.more')) + '</div>' : '') +
      '<div class="r-stats"><div class="stat xp"><b>+' + xp + '</b><small>' + trh('g.res.xp') + '</small></div><div class="stat cn"><b>+' + coins + '</b><small>' + trh('g.res.coins') + '</small></div><div class="stat cb"><b>' + P.maxCombo + '</b><small>' + trh('g.res.combo') + '</small></div></div>' +
      (P.recall ? '<div class="lucky">' + trh('g.res.recall', { n: P.recall }) + '</div>' : '') +
      '<p class="r-sub" style="margin:0">' + trh('g.res.score', { c: P.correct, t: P.total }) + (stars < 3 ? ' · ' + (P.lost ? trh('g.res.nolose') : '') + trh('g.res.3star') : '') + '</p>' +
      (P.aidedN ? '<p class="r-sub" style="margin:0">' + trh(P.review ? 'g.res.aided.rev' : 'g.res.aided', { n: P.aidedN }) + '</p>' : '') +
      '<div class="r-actions">' + nextBtn + '<div class="row" style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" data-act="home">' + trh('g.res.map') + '</button>' +
      (P.review ? '' : '<button class="btn ghost" style="flex:1" data-act="retry">' + trh('g.res.again') + '</button>') + '</div></div></div>';
    show('result');
    SFX.win();
    confetti(stars === 3 ? 180 : 90);
    $$('#rstars span').forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); SFX.star(i); }, 400 + i * 380); });
    const f = $('#result [data-focus]') || $('#result button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 100);

    setTimeout(() => {
      if (newDay) toast(tr('g.res.streak', { n: S.streak }), 'gold');
      checkAch();
      if (after > before) {
        confetti(200);
        openModal('<div class="big">🎖️</div>' + trh('g.res.lvup', { lv: after, title: titleOf(after) }) + '<button class="btn sun wide" data-act="close" data-focus>' + trh('g.res.yay') + '</button>');
      } else if (Date.now() - RT.lastRest > 30 * 60e3) restModal();
    }, 1700);
  }
  function restModal() {
    RT.lastRest = Date.now();
    if (!kidMode()) return;   // 「自己学」不限时，也不强制休息
    openModal('<div class="big">👀</div>' + trh('g.res.rest') + '<button class="btn wide" id="restbtn" data-act="close" disabled>' + trh('g.res.resting', { n: 20 }) + '</button>', { locked: true });
    let n = 20;
    const t = setInterval(() => {
      n--;
      const b = $('#restbtn');
      if (!b) { clearInterval(t); return; }
      if (n <= 0) { clearInterval(t); b.disabled = false; b.textContent = tr('g.res.rested'); }
      else b.textContent = tr('g.res.resting', { n });
    }, 1000);
  }


  // ---------- 对话动画剧场：看动画 / 跟读 / 角色扮演 ----------
  let T = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // 台词的中文意思（内容）：英语界面给 null，不显示、也不出「中」开关
  // 小剧场一句的意思：英语课是 L[2]（中文）按 gloss；别的课 L[3] 里还有 en，按 glossC（英语界面也有意思）
  const lineMean = L => (LANG ? glossC(Object.assign({ zh: L[2] }, L[3] && typeof L[3] === 'object' ? L[3] : null)) : gloss({ zh: L[2] }));
  const thZh = L => (T && T.zh ? lineMean(L) : null);
  const glossOn = () => (LANG ? glossC({ zh: '·', en: '·' }) : gloss({ zh: '·' })) != null;
  // 日期、时间按界面语言的写法
  const loc = () => (I18N && I18N.lang() !== 'zh' ? 'en-GB' : 'zh-CN');
  function gainXp(n) {
    if (!n) return;
    const b = lvInfo(S.xp).lv;
    S.xp += n;
    const a = lvInfo(S.xp).lv;
    if (a > b) { S.coins += 20; toast(tr('g.th.lvup', { lv: a, title: titleOf(a) }), 'gold'); confetti(160); }
  }
  function openScene(wi) {
    const sc = window.SCENES && window.SCENES[wi];
    if (!sc) return;
    primeTTS(); ac();
    T = { wi, sc, idx: -1, mode: 'watch', me: 1, run: 0, playing: false, slow: false, zh: true, en: true, spoke: 0, turn: null, done: false, tries: 0 };
    show('theater');
    renderTheater();
  }
  function stopScene() {
    if (!T) return;
    T.run++;
    T.playing = false;
    if (T.turn) { const r = T.turn; T.turn = null; r(false); }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
  }
  const playLabel = () => T.playing ? tr('g.th.pause') : (T.idx >= 0 && !T.done ? tr('g.th.resume') : T.done ? tr('g.th.again') : tr('g.th.start'));
  function updPlay() { const b = $('#th-play'); if (b) b.textContent = playLabel(); }
  function renderTheater() {
    const sc = T.sc, w = W[T.wi], toon = !!window.Cartoon;
    const modes = ['watch', 'shadow', 'role'].map(m => [m, tr('g.th.m.' + m)]);
    // 标题 / 地点是中文内容：英语界面标题用岛名，地点不显示
    const ttl = gloss({ zh: sc.title }) || isleName(T.wi), plc = gloss({ zh: sc.place });
    $('#theater').innerHTML =
      '<div class="p-top"><button class="x" data-act="thClose" aria-label="' + tr('g.th.exit') + '">✕</button><div class="th-title"><b>🎬 ' + esc(ttl) + '</b><small>' + (plc != null ? esc(isleName(T.wi)) + ' · ' + esc(plc) : tr('g.th.ep', { n: T.wi + 1 })) + '</small></div></div>' +
      '<div class="stage' + (toon ? ' cartoon' : '') + ' live" id="stage" style="--wc:' + w.color + '">' +
      (toon && Cartoon.set(sc.set) ? '<div class="stage-set">' + Cartoon.set(sc.set) + '</div>' : '<span class="stage-bg">' + sc.bg + '</span>') +
      sc.cast.map((c, k) => '<div class="actor a' + k + '" id="actor' + k + '">' +
        (toon && Cartoon.has(c[0]) ? Cartoon.actor(c[0]) : '<span class="ae"><span class="af">' + c[1] + '</span></span>') +
        '<span class="an">' + esc(c[0]) + (T.mode === 'role' && T.me === k ? tr('g.th.you') : '') + '</span></div>').join('') +
      '<div class="stage-sub" id="th-sub"></div>' +
      '<div class="clap" id="th-clap" hidden><small>' + tr('g.th.ep', { n: T.wi + 1 }) + '</small><b>' + esc(ttl) + '</b>' + (plc != null ? '<span>' + esc(plc) + '</span>' : '') + '</div></div>' +
      '<div class="th-side"><div class="seg th-modes">' + modes.map(([m, n]) => '<button class="' + (T.mode === m ? 'on' : '') + '" data-act="thMode" data-m="' + m + '">' + n + '</button>').join('') + '</div>' +
      (T.mode === 'role' ? '<div class="seg th-modes"><span class="th-lab">' + tr('g.th.me') + '</span>' + sc.cast.map((c, k) => '<button class="' + (T.me === k ? 'on' : '') + '" data-act="thMe" data-i="' + k + '">' + c[1] + ' ' + esc(c[0]) + '</button>').join('') + '</div>' : '') +
      '<div class="th-ctrl"><button class="btn" id="th-play" data-act="thPlay">' + playLabel() + '</button>' +
      '<button class="slow' + (T.slow ? ' on' : '') + '" data-act="thSlow" aria-pressed="' + T.slow + '">' + trh('g.th.slow') + '</button>' +
      '<button class="slow' + (T.en ? ' on' : '') + '" data-act="thEn" aria-pressed="' + T.en + '">' + trh('g.th.en') + '</button>' +
      (glossOn() ? '<button class="slow' + (T.zh ? ' on' : '') + '" data-act="thZh" aria-pressed="' + T.zh + '">' + trh('g.th.zh') + '</button>' : '') + '</div>' +
      '<p class="th-tip">' + tr('g.th.tip.' + T.mode) + '</p>' +
      '<div id="th-turn"></div><div class="th-log" id="th-log"></div></div>';   // th-side：横屏时放在动画右边，自己上下滚
    renderStage(); renderLog();
    window.scrollTo(0, 0);
  }
  function renderStage() {
    const L = T.sc.lines[T.idx];
    T.sc.cast.forEach((c, k) => {
      const a = $('#actor' + k); if (!a) return;
      a.classList.toggle('talk', !!L && L[0] === k && T.playing);
      a.classList.toggle('dim', !!L && L[0] !== k);
    });
    const sub = $('#th-sub'); if (!sub) return;
    if (!L) { sub.className = 'stage-sub'; sub.innerHTML = T.done ? '<span class="ss-en">The End</span><span class="ss-zh">' + tr('g.th.end') + '</span>' : '<span class="ss-zh">' + tr('g.th.idle') + '</span>'; return; }
    sub.className = 'stage-sub ' + (L[0] === 0 ? 'l' : 'r');
    sub.innerHTML = '<span class="ss-who">' + esc(T.sc.cast[L[0]][0]) + '</span>' +
      (T.en ? '<span class="ss-en">' + rb(L[1]) + '</span>' : '<span class="ss-en muted">' + tr('g.th.ear') + '</span>') +
      (thZh(L) != null ? '<span class="ss-zh">' + esc(thZh(L)) + '</span>' : '');
  }
  function renderLog() {
    const log = $('#th-log'); if (!log) return;
    const n = T.done ? T.sc.lines.length : Math.max(0, T.idx);
    log.innerHTML = (n ? '<div class="th-lab">' + tr('g.th.logh') + '</div>' : '') + T.sc.lines.slice(0, n).map((L, i) => {
      const c = T.sc.cast[L[0]];
      return '<button class="lg lg' + L[0] + '" data-act="thLine" data-i="' + i + '"><span class="lg-e">' + c[1] + '</span><span class="lg-b"><b>' + rb(L[1]) + '</b>' + (lineMean(L) != null ? '<small>' + esc(lineMean(L)) + '</small>' : '') + '</span></button>';
    }).join('');
  }
  // 关掉或切换模式后，还在等待的旧播放流程要安静退出
  const alive = (t, my) => T === t && t.run === my;
  async function intro(my) {
    const t = T;
    const stage = $('#stage'), clap = $('#th-clap');
    if (!stage || reduced) return;
    stage.classList.remove('live', 'bye');
    $('#th-sub').className = 'stage-sub gone';
    clap.hidden = false;
    SFX.tap();
    await sleep(1500);
    if (!alive(t, my)) return;
    clap.hidden = true;
    void stage.offsetWidth;
    stage.classList.add('live');
    await sleep(900);
  }
  async function playFrom(i) {
    const t = T, my = ++T.run;
    T.playing = true; T.done = false;
    updPlay();
    const lines = T.sc.lines;
    if (i === 0) { await intro(my); if (!alive(t, my)) return; }
    for (T.idx = i; T.idx < lines.length; T.idx++) {
      const [who, en] = lines[T.idx];
      renderStage(); renderLog();
      if (T.mode === 'role' && who === T.me) { await kidTurn(); if (!alive(t, my)) return; continue; }
      await say(en, T.slow ? 0.65 : S.settings.rate, T.sc.cast[who][2]);
      if (!alive(t, my)) return;
      if (T.mode === 'shadow') { await kidTurn(); if (!alive(t, my)) return; }
      else { await sleep(500); if (!alive(t, my)) return; }
    }
    T.playing = false; T.done = true; T.idx = lines.length;
    renderStage(); renderLog(); updPlay();
    const stage = $('#stage'); if (stage) stage.classList.add('bye');
    sceneDone();
  }
  function kidTurn() {
    return new Promise(res => {
      T.turn = res; T.tries = 0;
      const L = T.sc.lines[T.idx], sr = speakMode() === 'sr';
      const a = $('#actor' + L[0]); if (a) a.classList.add('talk');
      $('#th-turn').innerHTML = '<div class="say-card th-you"><div class="say-zh">' + tr('g.th.turn.' + (T.mode === 'role' ? 'role' : 'shadow')) + '</div>' +
        '<div class="say-text" id="th-say">' + wordsHTML(L[1]) + '</div>' + (thZh(L) != null ? '<div class="say-zh">' + esc(thZh(L)) + '</div>' : '') +
        (sr ? '<button class="mic" id="th-mic" data-act="thMic" aria-label="' + tr('w.mic.aria') + '">' + MIC + '</button>' : '') +
        '<div class="mic-hint" id="th-hint">' + (sr ? tr('g.th.taps') : tr('w.self.hint')) + '</div><div class="heard" id="th-heard"></div>' +
        '<div class="say-row"><button class="btn small ghost" data-act="thHear">' + tr('g.th.hear') + '</button><button class="btn small ' + (sr ? 'ghost' : 'leaf') + '" id="th-done" data-act="thDone">' + (sr ? tr('g.th.skip') : tr('w.self.done')) + '</button></div></div>';
      $('#th-turn').scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  function endTurn(ok) {
    const r = T && T.turn; if (!r) return;
    T.turn = null;
    stopListening();
    $('#th-turn').innerHTML = '';
    if (ok) { T.spoke++; S.stats.spoken++; qProg('spoken', 1); }
    r(ok);
  }
  async function thMic() {
    if (!T || !T.turn) return;
    if (RT.listening) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const turn = T.turn, L = T.sc.lines[T.idx], m = $('#th-mic');
    m.classList.add('on'); m.innerHTML = STOP;
    $('#th-hint').textContent = tr('b.mic.listen');
    const res = await recognize(t => { const h = $('#th-heard'); if (h) h.textContent = t; }, [L[1]]);
    if (!T || T.turn !== turn) return;
    m.classList.remove('on'); m.innerHTML = MIC;
    if (res.err && FATAL.includes(res.err)) {
      RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
      toast(tr('w.sr.broken'));
      m.remove();
      $('#th-hint').textContent = tr('w.self.hint');
      const d = $('#th-done'); d.textContent = tr('w.self.done'); d.className = 'btn small leaf';
      return;
    }
    if (!res.alts.length) {
      // 对话剧场本来就有「跳过这句」：AI 用不了时只是把原因说清楚
      const h = failHint(res);
      if (res.fail === 'unheard') { T.tries++; $('#th-hint').textContent = h + (T.tries >= 2 ? tr('g.th.orskip') : ''); }
      else if (h) $('#th-hint').textContent = h + (aiDown() ? tr('g.th.canskip') : '');
      return;
    }
    const r = bestScore(L[1], res.alts);
    $('#th-heard').textContent = tr('w.heard', { t: r.heard });
    $$('#th-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    if (r.score >= 55) {
      SFX.ok(T.spoke);
      if (r.score >= 85) { S.stats.perfect++; qProg('perfect', 1); }
      $('#th-hint').innerHTML = trh(r.score >= 85 ? 'g.th.perfect' : 'g.th.good', { n: r.score });
      setTimeout(() => { if (T && T.turn === turn) endTurn(true); }, 900);
    } else {
      T.tries++;
      SFX.bad();
      $('#th-hint').textContent = tr('w.score.low', { n: r.score }) + (T.tries >= 2 ? tr('g.th.orskip') : '');
    }
  }
  function sceneDone() {
    const rec = S.scenes[T.wi] || (S.scenes[T.wi] = {});
    const msg = [];
    let coins = 0, xp = 0;
    if (T.mode === 'watch' && !rec.watched) { rec.watched = 1; coins += 10; msg.push(tr('g.th.msg.watch')); }
    if (T.mode === 'shadow') { rec.shadow = 1; xp += 20; msg.push(tr('g.th.msg.shadow')); }
    if (T.mode === 'role') { rec.role = 1; xp += 30; coins += 10; S.stats.roleplay++; qProg('roleplay', 1); msg.push(tr('g.th.msg.role')); }
    S.coins += coins;
    gainXp(xp);
    save(); checkAch();
    SFX.win(); confetti(90);
    const other = T.me === 0 ? 1 : 0;
    const nextBtn = T.mode === 'watch' ? '<button class="btn" data-act="thMode" data-m="shadow" data-go="1">' + tr('g.th.next.shadow') + '</button>'
      : T.mode === 'shadow' ? '<button class="btn" data-act="thMode" data-m="role" data-go="1">' + tr('g.th.next.role') + '</button>'
        : '<button class="btn" data-act="thMe" data-i="' + other + '" data-go="1">' + trh('g.th.swap', { name: T.sc.cast[other][0] }) + '</button>';
    $('#th-turn').innerHTML = '<div class="th-end"><div class="big">🎉</div><b>' + tr('g.th.fin.' + T.mode) + '</b>' +
      '<p>' + (msg.join(' · ') || tr('g.th.fin.more')) + '</p><div class="say-row">' + nextBtn + '<button class="btn ghost" data-act="thClose">' + tr('g.th.map') + '</button></div></div>';
    renderTop();
  }

  // ---------- 宝箱 / 商店 / 成就 / 设置 ----------
  function openChest() {
    if (S.quests.chest || !S.quests.list.every(q => q.claimed)) return;
    S.quests.chest = true;
    const r = Math.random();
    let prize, html;
    const unownedChest = CHEST_PETS.filter(p => !S.pets.includes(p[0]));
    // 先开冒险用的奖品（进化曲 / 怪兽蛋 / 稀有色蛋，world.js 的 chestPrize，评估第 10 条）；没开出来（约一成、或者还没有怪兽）再开原来的宠物 / 金币
    let wp = null;
    try { wp = window.EchoWorld && EchoWorld.chestPrize ? EchoWorld.chestPrize() : null; } catch (e) { console.error(e); wp = null; }
    if (wp) { prize = wp.prize; html = wp.html; }
    else if (r < 0.2 && unownedChest.length) {
      const p = pick(unownedChest); S.pets.push(p[0]); prize = p[0];
      html = trh('g.chest.pet', { name: p[1] });
    } else if (r < 0.32 && S.freeze < 2) {
      S.freeze++; prize = '🧊';
      html = trh('g.chest.freeze');
    } else {
      const c = pick([30, 40, 50, 60, 80, 100, 150]); S.coins += c; prize = '💰';
      html = trh('g.chest.coins', { n: c });
    }
    save();
    openModal('<div class="big" id="chestbig" style="animation:wiggle .5s 3">🎁</div><div id="chestres" hidden><div class="big">' + prize + '</div>' + html + '</div><button class="btn sun wide" data-act="close" id="chestok" hidden>' + tr('g.chest.take') + '</button>', { locked: true });
    SFX.tap();
    setTimeout(() => { $('#chestbig').hidden = true; $('#chestres').hidden = false; $('#chestok').hidden = false; SFX.win(); confetti(120); renderHome(); checkAch(); }, 1500);
  }
  function shopSheet() {
    const pets = PETS.map(([e, price, name]) => {
      const own = S.pets.includes(e), sel = S.pet === e;
      return '<button class="pet ' + (sel ? 'sel' : '') + (own || S.coins >= price ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + e + '</span>' + name +
        '<small>' + (sel ? tr('g.shop.following') : own ? tr('g.shop.take') : '<span class="coin"></span>' + price) + '</small></button>';
    }).join('');
    const chest = CHEST_PETS.map(([e, name]) => {
      const own = S.pets.includes(e);
      return '<button class="pet ' + (S.pet === e ? 'sel' : '') + (own ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + (own ? e : '❓') + '</span>' + (own ? name : tr('g.shop.chestonly')) + '<small>' + (own ? (S.pet === e ? tr('g.shop.following') : tr('g.shop.take')) : tr('g.shop.fromchest')) + '</small></button>';
    }).join('');
    openModal(trh('g.shop.head', { n: S.coins }) + '<div class="grid3">' + pets + chest + '</div>' +
      '<div class="ach"><span class="ae">🧊</span><div style="flex:1"><b>' + tr('g.shop.fz', { n: S.freeze }) + '</b><small>' + tr('g.shop.fzd') + '</small></div><button class="btn small sun" data-act="buyFreeze" ' + (S.freeze >= 2 || S.coins < 100 ? 'disabled' : '') + '>' + tr('g.shop.fzbtn') + '</button></div>' +
      '<button class="btn ghost wide" data-act="close">' + tr('g.close') + '</button>');
  }
  function onPet(e) {
    if (S.pets.includes(e)) { S.pet = e; SFX.tap(); }
    else {
      const p = PETS.find(x => x[0] === e);
      if (!p) { toast(tr('g.shop.chestpet')); return; }
      if (S.coins < p[1]) { toast(tr('g.shop.short', { n: p[1] - S.coins })); return; }
      S.coins -= p[1]; S.pets.push(e); S.pet = e; SFX.coin(); toast(tr('g.shop.bought', { name: p[2] }), 'gold');
    }
    save(); renderTop(); shopSheet(); checkAch();
  }
  function achSheet() {
    const n = Object.keys(S.ach).length;
    const L = lvInfo(S.xp);
    const totalStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
    openModal('<h2>' + tr('g.achv.h', { n, t: ACH.length }) + '</h2>' +
      '<p>' + tr('g.achv.sum', { lv: L.lv, title: titleOf(L.lv), stars: totalStars, spoken: S.stats.spoken, levels: S.stats.levels }) + '</p>' +
      ACH.map(([id, e, name, desc]) => '<div class="ach ' + (S.ach[id] ? '' : 'no') + '"><span class="ae">' + e + '</span><div><b>' + name + '</b><small>' + desc + '</small></div></div>').join('') +
      '<button class="btn ghost wide" data-act="close">' + tr('g.close') + '</button>');
  }
  // 单元号：英语课照课本写「Unit 3」；别的课按界面语言（中文界面「第 3 单元」，g.unit.no）
  function unitNo(n) { return LANG ? tr('g.unit.no', { n }) : 'Unit ' + n; }
  const unitTxt = u => (u ? lbl({ zh: u.name, en: u.bshort + ' ' + unitNo(u.n) + ' ' + u.en }) : '');
  function envHTML(inSet) {   // inSet：在设置页里（上面已经有「请家长粘贴 AI 密钥」的提示）
    if (window.ECHO_APP) {   // 安卓 APK：不用讲浏览器的事
      return '<div class="env">' + tr('g.set.env.app') + '<br>' +
        (localSR() && EchoTalk.srText ? esc(EchoTalk.srText('env')) : cloudOn() && aiNoKey() ? tr('ac.env.signin') : cloudSR() ? tr('g.set.env.sr.ok') : tr('g.set.env.sr.nokey') + (inSet ? tr('g.set.env.see') : tr('g.set.env.paste'))) + '</div>';
    }
    const st = S.settings.tts || 'auto';
    const tts = st === 'device' ? (TTS.voices.length ? trh('g.set.env.dev', { name: TTS.v ? TTS.v.name : '' }) : tr('g.set.env.nodev'))
      : tr(st === 'auto' && TTS.voices.length ? 'g.set.env.nat.dev' : 'g.set.env.nat');
    const wx = /MicroMessenger/i.test(navigator.userAgent) ? trh('g.set.env.wx') : '';
    const sr = SRC && !RT.srBroken ? tr('g.set.env.sr.web') : tr('g.set.env.sr.none');
    return '<div class="env">' + tts + '<br>' + sr + '<br>' + trh('g.set.env.tip') + wx + '</div>';
  }
  // 设置分两块：「🙂 我的设置」孩子自己随便改；「🔒 家长设置」收起来，里面改什么都要家长密码（家长 2026-10-07，评估第 4 条）
  function settingsSheet() {
    const st = S.settings;
    const voices = TTS.voices.map(v => '<option value="' + esc(v.name) + '"' + (TTS.v && TTS.v.name === v.name ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
    // APK 里还没有 AI 密钥：设置页最上面就说清楚（口语没法自动打分，走「先跳过」）
    // 云端模式：没有密钥，最上面是「账号和会员」那一行（account.js），没登录时 envHTML 里说「登录以后才能用」
    const noKey = cloudOn() ? (ACC() ? ACC().settingsRow() : '') : aiNoKey() ? '<div class="set-warn"><b>' + tr('g.set.nokey.h') + '</b><small>' + tr('g.set.nokey.d') + '</small><button class="btn small" data-act="talk_cfg">' + tr('g.set.ai.paste') + '</button></div>' : '';
    openModal('<h2>' + tr('g.set.h') + '</h2>' + noKey + envHTML(true) +
      '<h3 class="set-h">' + tr('g.set.mine') + '</h3>' +
      (speakMode() === 'sr' ? '<div class="set"><label>' + tr('g.set.mic') + '</label><div class="say-row"><button class="btn small ghost" data-act="micCheck">' + tr('g.set.mic.btn', { word: chkWord() }) + '</button></div></div>' : '') +
      '<div class="set"><label for="set-rate">' + tr('g.set.rate') + ' <span id="rate-v">' + st.rate.toFixed(2) + '</span></label><input type="range" id="set-rate" min="0.6" max="1.1" step="0.05" value="' + st.rate + '"><div class="say-row"><button class="btn small ghost" data-act="testVoice">' + tr('g.set.try') + '</button></div></div>' +
      '<div class="set"><label>' + tr('g.set.tts') + '</label><div class="seg">' +
      ['auto', 'device', 'online'].map(m => '<button class="' + ((st.tts || 'auto') === m ? 'on' : '') + '" data-act="setTts" data-m="' + m + '">' + tr('g.set.tts.' + m) + '</button>').join('') +
      '</div><small>' + tr('g.set.tts.d') + '</small></div>' +
      (voices ? '<div class="set"><label for="set-voice">' + tr('g.set.voice') + '</label><select id="set-voice">' + voices + '</select></div>' : '') +
      // 朗读速度（WORDS.md §11）：慢 = 配音 0.8 倍速（音高不变）、本机声音 0.8；零基础（第 0 级）默认是慢
      '<div class="set" id="set-slow"><label>' + trh('g.set.slow') + '</label><div class="seg"><button class="' + (slowOn() ? '' : 'on') + '" data-act="setSlow" data-v="0">' + trh('g.set.slow.off') + '</button><button class="' + (slowOn() ? 'on' : '') + '" data-act="setSlow" data-v="1">' + trh('g.set.slow.on') + '</button></div><small>' + trh('g.set.slow.d') + '</small></div>' +
      // 新手路线（§9）：首页最上面那张卡片
      '<div class="set" id="set-route"><label>' + trh('g.set.route') + '</label><div class="seg"><button class="' + (routeOn() ? 'on' : '') + '" data-act="setRoute" data-v="1">' + trh('g.set.on') + '</button><button class="' + (routeOn() ? '' : 'on') + '" data-act="setRoute" data-v="0">' + trh('g.set.off') + '</button></div><small>' + trh('g.set.route.d') + '</small></div>' +
      // 一步一步学（tools/course/STARTER.md）：闯关以前先上小课。零基础（第 0 级）默认开
      '<div class="set" id="set-starter"><label>' + trh('g.set.starter') + '</label><div class="seg"><button class="' + (starterOn() ? 'on' : '') + '" data-act="setStarter" data-v="1">' + trh('g.set.on') + '</button><button class="' + (starterOn() ? '' : 'on') + '" data-act="setStarter" data-v="0">' + trh('g.set.off') + '</button></div><small>' + trh('g.set.starter.d') + '</small></div>' +
      (window.ECHO_APP ? '<div class="set"><label>' + tr('g.set.sc.app') + '</label><small>' + tr('g.set.sc.app.d') + '</small></div>' :
      '<div class="set"><label>' + tr('g.set.sc.mode') + '</label><div class="seg">' +
      ['auto', 'self'].map(m => '<button class="' + (st.mode === m ? 'on' : '') + '" data-act="setMode" data-m="' + m + '">' + tr('g.set.mode.' + m) + '</button>').join('') +
      '</div><small>' + tr('g.set.sc.mode.d') + '</small></div>') +
      '<div class="set"><label>' + tr('g.set.gfx') + '</label><div class="seg wrap">' +
      ['auto', 'high', 'mid', 'low', '2d'].map(m => '<button class="' + ((st.gfx || 'auto') === m ? 'on' : '') + '" data-act="setGfx" data-m="' + m + '">' + tr('g.set.gfx.' + m) + '</button>').join('') +
      '</div><small>' + ((st.gfx || 'auto') === 'auto' ? tr('g.set.gfx.auto.d') + (st.gfxAuto ? tr('g.set.gfx.now', { m: tr('g.set.gfx.' + st.gfxAuto) }) : '') + tr('g.set.stop') : tr('g.set.gfx.hot')) + '</small></div>' +
      // 画面风格（新画风试用）：只有 3D 时才有这一行（2D 流畅模式用不上新画风）；默认经典
      (window.EchoWorldOpen && (st.gfx || 'auto') !== '2d' ? '<div class="set" id="set-look"><label>' + trh('g.set.look') + '</label><div class="seg">' +
        ['std', 'new'].map(m => '<button class="' + ((lookOn() ? 'new' : 'std') === m ? 'on' : '') + '" data-act="setLook" data-m="' + m + '">' + trh('g.set.look.' + m) + '</button>').join('') +
        '</div><small>' + trh('g.set.look.d') + '</small></div>' : '') +
      '<div class="set"><label>' + tr('g.set.ctl') + '</label><div class="seg">' +
        ['joy', 'pad'].map(m => '<button class="' + ((st.ctl || 'joy') === m ? 'on' : '') + '" data-act="setCtl" data-m="' + m + '">' + tr('g.set.ctl.' + m) + '</button>').join('') +
        '</div><small>' + tr(st.ctl === 'pad' ? 'g.set.ctl.pad.d' : 'g.set.ctl.joy.d') + '</small></div>' +
      (window.EchoNative && EchoNative.setOrientation ? '<div class="set"><label>' + tr('g.set.or') + '</label><div class="seg">' +
        ['portrait', 'landscape', 'auto'].map(m => '<button class="' + ((st.orient || 'portrait') === m ? 'on' : '') + '" data-act="setOrient" data-m="' + m + '">' + tr('g.set.or.' + m) + '</button>').join('') +
        '</div><small>' + tr('g.set.or.d') + '</small></div>' : '') +
      '<div class="set"><label>' + tr('g.set.sfx') + '</label><div class="seg"><button class="' + (st.sfx ? 'on' : '') + '" data-act="sfx" data-v="1">' + tr('g.set.on') + '</button><button class="' + (st.sfx ? '' : 'on') + '" data-act="sfx" data-v="0">' + tr('g.set.off') + '</button></div></div>' +
      '<div class="set"><label>' + tr('g.set.mu') + '</label><div class="seg">' + ['off', 'low', 'mid', 'high'].map(v => '<button class="' + ((st.music || 'mid') === v ? 'on' : '') + '" data-act="setMusic" data-v="' + v + '">' + tr('g.set.mu.' + v) + '</button>').join('') + '</div></div>' +
      // 2026-11-19（给所有人用）：能力检测和分级（placement.js）、界面语言（i18n.js）、谁在学（孩子 / 自己学）
      (window.EchoPlace ? EchoPlace.settingsRow() : '') +
      (PK() ? EchoPacks.settingsRow() : '') +   // 课程包模式：「📦 课程和语音包」
      // 日语、中文课：读音显示 / 不显示（默认显示；西语没有这一项，ENGINE.md §3）
      (LANG && LANG.script !== 'latin' ? '<div class="set" id="set-ruby"><label>' + trh('g.set.ruby') + '</label><div class="seg"><button class="' + (st.ruby !== false ? 'on' : '') + '" data-act="setRuby" data-v="1">' + trh('g.set.ruby.on') + '</button><button class="' + (st.ruby !== false ? '' : 'on') + '" data-act="setRuby" data-v="0">' + trh('g.set.ruby.off') + '</button></div><small>' + trh('g.set.ruby.d') + '</small></div>' : '') +
      (window.EchoI18n ? '<div class="set" id="set-ui"><label>' + trh('place.set.ui') + '</label><div class="seg">' + EchoI18n.LANGS.map(l => '<button class="' + ((st.ui || 'zh') === l.id ? 'on' : '') + '" data-act="setUi" data-l="' + l.id + '">' + esc(l.name) + '</button>').join('') + '</div>' +
        (tr('place.lang.partial') ? '<small>' + trh('place.lang.partial') + '</small>' : '') + '</div>' : '') +
      '<div class="set" id="set-learner"><label>' + trh('place.set.learner') + '</label><div class="seg">' + [['kid', 'place.learner.kid'], ['open', 'place.learner.open']].map(([m, k]) => '<button class="' + ((kidMode() ? 'kid' : 'open') === m ? 'on' : '') + '" data-act="setLearner" data-m="' + m + '">' + trh(k) + '</button>').join('') +
        '</div><small>' + trh('place.learner.' + (kidMode() ? 'kid' : 'open') + '.note') + '</small></div>' +
      parentHTML() +
      '<p class="set-ver">' + esc(verText()) + ' · <button class="link" data-act="suDoc" data-doc="licenses">' + tr('g.set.lic') + '</button></p>' +
      '<button class="btn ghost wide" data-act="close">' + tr('place.done') + '</button>');
  }
  // 「🔒 家长设置」：默认收起来；看可以随便看，改要家长密码（parentOk）
  function parentHTML() {
    const st = S.settings, c = limitCfg(), ps = pinState(), nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    const cloud = !!(window.EchoTalk && EchoTalk.cloudSR && EchoTalk.cloudSR()), pk = pushKind(st.push);
    const b = [], kid = kidMode();   // 「自己学」（青少年 / 成人）：没有学习锁和冒险限时这两行，这一块也不叫「家长设置」、不要密码
    if (kid) b.push('<div class="set"><label>' + tr('g.set.gate') + '</label><div class="seg">' +
      [[true, tr('g.set.gate.on')], [false, tr('g.set.off')]].map(([m, n]) => '<button class="' + ((st.gate !== false) === m ? 'on' : '') + '" data-act="setGate" data-m="' + (m ? 1 : 0) + '">' + n + '</button>').join('') +
      '</div><small>' + tr('g.set.gate.d') + '</small></div>');
    if (kid) b.push('<div class="set"><label>' + tr('g.set.lim') + '</label><div class="say-row"><span class="set-v">' + esc(limText(c)) + '</span><button class="btn small ghost" data-act="limEdit">' + tr('g.set.edit') + '</button></div>' +
      '<small>' + tr('g.set.lim.d') + '</small></div>');
    if (BK.length) b.push('<div class="set"><label>' + tr('g.set.mix') + '</label><div class="seg">' +
      [[.6, 'a'], [.3, 'b'], [0, 'c']].map(([m, n]) => '<button class="' + (S.book.mix === m ? 'on' : '') + '" data-act="setBookMix" data-m="' + m + '">' + tr('g.set.mix.' + n) + '</button>').join('') +
      '</div><small>' + trh('g.set.mix.d', { unit: unitTxt(curUnit()) }) + '</small></div>');
    if (window.EchoWorld && EchoWorld.storyZhHTML) b.push(EchoWorld.storyZhHTML());
    if (window.EchoNative && !cloudOn()) b.push('<div class="set"><label>' + tr('g.set.ai') + '</label><div class="say-row"><span class="set-v">' + tr(cloud ? 'g.set.ai.on' : 'g.set.ai.off') + '</span><button class="btn small ghost" data-act="talk_cfg">' + tr(cloud ? 'g.set.ai.change' : 'g.set.ai.paste') + '</button></div>' +
      '<small>' + tr(cloud ? 'g.set.ai.on.d' : 'g.set.ai.off.d') + '</small></div>');
    b.push('<div class="set"><label>' + tr('g.set.unl') + '</label><div class="seg"><button class="' + (st.unlockAll ? '' : 'on') + '" data-act="unlock" data-v="0">' + tr('g.set.unl.0') + '</button><button class="' + (st.unlockAll ? 'on' : '') + '" data-act="unlock" data-v="1">' + tr('g.set.unl.1') + '</button></div>' +
      '<small>' + tr('g.set.unl.d') + '</small></div>');
    b.push('<div class="set"><label>' + tr('g.set.push') + '</label><div class="say-row"><span class="set-v">' + (pk ? tr('g.set.push.on', { k: pk === 'wecom' ? tr('g.set.push.wecom') : 'PushPlus' }) : tr('g.set.push.off')) + '</span><button class="btn small ghost" data-act="pushEdit">' + tr('g.set.push.btn') + '</button></div></div>');
    if (window.EchoTalk) b.push('<div class="set"><label>' + tr('g.set.saf') + '</label><div class="say-row"><button class="btn small ghost" data-act="talk_concerns">' + (nc ? tr('g.set.saf.n', { n: nc }) : tr('g.set.saf.look')) + '</button><button class="btn small ghost" data-act="talk_privacy">' + tr('g.set.saf.info') + '</button></div>' +
      '<small>' + tr('g.set.saf.d') + '</small></div>');
    b.push('<div class="set"><label>' + tr('g.set.pin') + '</label>' + (ps.native && ps.sales
      ? '<div class="say-row"><span class="set-v">' + tr(ps.has ? 'g.set.pin.has' : 'g.set.pin.none') + '</span><button class="btn small ghost" data-act="pinChange">' + tr(ps.has ? 'g.set.pin.change' : 'g.set.pin.set') + '</button></div>' +
        '<small>' + tr('g.set.pin.d1') + '</small>'
      : ps.native
      ? '<small>' + tr(ps.has ? 'g.set.pin.nat.has' : 'g.set.pin.nat.none') + '</small>'
      : '<div class="say-row"><span class="set-v">' + tr(ps.has ? 'g.set.pin.has' : 'g.set.pin.web.none') + '</span>' + (ps.has ? '<button class="btn small ghost" data-act="pinChange">' + tr('g.set.pin.change') + '</button>' : '') + '</div><small>' + tr('g.set.pin.lock') + '</small>') + '</div>');
    // 销售版：家庭定制（昵称、形象、伙伴、家人）、设备检查、儿童隐私说明（家长首次设置向导 setup.js 里做过的，这里能改）
    if (window.EchoSetup && EchoSetup.sales()) {
      const fm = EchoSetup.members(), F = st.family || {};
      if (F.who !== 'open') b.push('<div class="set"><label>' + tr('g.set.fam') + '</label><div class="say-row"><span class="set-v">' + esc((S.player && S.player.name) || F.nick || tr('g.set.fam.noname')) + (fm.length ? ' · ' + esc(fm.map(m => m.call).join(tr('g.set.sep'))) : '') + '</span><button class="btn small ghost" data-act="suFamily">' + tr('g.set.edit') + '</button></div>' +
        '<small>' + tr('g.set.fam.d') + '</small></div>');
      b.push('<div class="set"><label>' + tr('g.set.dev') + '</label><div class="say-row"><span class="set-v">' + (F.device ? tr(F.device.ok === 'ok' ? 'g.set.dev.ok' : F.device.ok === 'warn' ? 'g.set.dev.warn' : 'g.set.dev.bad') : tr('g.set.dev.none')) + '</span><button class="btn small ghost" data-act="suDevice">' + tr('g.set.dev.again') + '</button></div></div>');
      b.push('<div class="set"><label>' + tr('g.set.priv') + '</label><div class="say-row"><button class="btn small ghost" data-act="suDoc" data-doc="privacy">' + tr('g.set.priv.doc') + '</button><button class="btn small ghost" data-act="suDoc" data-doc="consent">' + tr('g.set.priv.consent') + '</button></div>' +
        (F.consent && F.consent.at ? '<small>' + trh('g.set.priv.ok', { d: new Date(F.consent.at).toLocaleDateString(loc()), v: F.consent.v || '' }) + '</small>' : '') + '</div>');
    }
    // 存档备份（评估第 7 条）：导出（分享到微信 / 下载成文件）不用密码；从备份恢复要家长密码
    // （有没有备份只看在不在，不一份份解开来读：存档大了以后，设置页每点一下都重画，读三份备份要一两百毫秒）
    const meta = bakMeta(), nb = BAK.filter(k => lsGet(k)).length;
    b.push('<div class="set"><label>' + tr('g.bak.h') + '</label><div class="say-row"><button class="btn small ghost" data-act="bakExport">' + tr('g.bak.export') + '</button><button class="btn small ghost" data-act="bakRestore">' + tr('g.bak.restore') + '</button></div>' +
      '<small>' + tr('g.bak.d1') + (nb ? trh('g.bak.last', { d: meta.d1 || tr('g.bak.before') }) : '') +
      (nat('backupWrite') ? tr('g.bak.dl') : '') + tr('g.bak.d2') +
      tr('g.bak.used', { n: (RT.store || storeCheck() || { pct: 0 }).pct }) + '</small></div>');
    b.push('<div class="set"><label>' + tr('g.ver.h') + '</label><div class="say-row"><span class="set-v">' + esc(verText()) + '</span><button class="btn small ghost" data-act="verEdit">' + tr('g.ver.edit') + '</button></div>' +
      '<small>' + (myVer() ? (S.settings.verUrl || VER_URL0 ? trh('g.ver.on', { url: S.settings.verUrl || tr('g.ver.defaultUrl') }) : tr('g.ver.noaddr')) : tr('g.ver.web')) + '</small></div>');
    const ne = window.EchoErr ? EchoErr.count(7) : 0;
    b.push('<div class="set"><label>' + tr('g.err.h') + '</label><div class="say-row"><span class="set-v">' + tr('g.err.week', { n: ne }) + '</span><button class="btn small ghost" data-act="errLog">' + tr('g.err.look') + '</button></div><small>' + tr('g.err.d') + '</small></div>');
    b.push('<div class="set"><label>' + tr('g.set.reset') + '</label><button class="btn small coral" data-act="reset" id="resetbtn">' + tr('g.set.reset.btn') + '</button><small>' + tr('g.set.reset.d') + '</small></div>');
    return '<details class="parent" id="set-parent"' + (RT.parentOpen ? ' open' : '') + '><summary>' + (kid ? tr('g.set.parent') : trh('place.set.more')) + '</summary><div class="parent-in">' + b.join('') + '</div></details>';
  }
  // ---------- 画面风格：新画风试用（2026-11-19，老板要在 iPhone 上试，App 里没法加 ?look=new）----------
  // world3d-open.js 打开时读一次 ?look=new / localStorage['echo-look']，结果在 EchoWorldOpen.on；这里改 localStorage（下次打开也记得），
  // 同时把 on 跟着改，再让大地图换渲染器。画质没变时 world.js 的 ensureRenderer 不会重建，所以先把现在那个渲染器的 tier 清掉：
  // 在大地图上就当场换（EchoWorld.setGfx，和改画质一样），不在就等下次进地图时换。默认经典，不碰的人一切照旧
  function lookOn() { return !!(window.EchoWorldOpen && EchoWorldOpen.on); }
  function lookApply(on) {
    if (window.EchoWorldOpen) EchoWorldOpen.on = !!on;
    if (!window.EchoWorld) return;
    try { const d = EchoWorld._debug ? EchoWorld._debug() : null; if (d && d.R) d.R.tier = ''; } catch (e) { /* 还没进过大地图 */ }
    if (EchoWorld.setGfx) EchoWorld.setGfx();
  }
  // 版本号（APK 里原生给：日期 + 短哈希，见 android/README.md）
  function verText() {
    try { if (window.EchoNative && EchoNative.version) { const v = JSON.parse(EchoNative.version() || '{}'); if (v && v.name) return tr('g.ver.name', { name: v.name, code: v.code }); } } catch (e) { /* 老版本的原生没有 version() */ }
    return tr(window.ECHO_APP ? 'g.ver.app' : 'g.ver.web.name');
  }

  // ---------- 新版本提示（家长 2026-10-07，评估第 19 条）----------
  // APK 打开时去看一眼 version.json（默认放在 GitHub Pages，家长设置里能改地址），格式 {"code":N,"name":"…","url":"…","notes":"…"}；
  // code 比装着的大（EchoNative.version().code）就在首页挂「有新版本，请家长更新」。网页版总是最新的，不查。查不到（没网、国内打不开）就算了
  // 默认地址只在家庭版的安装包里（原生 EchoNative.verUrl()，打包时 echo.properties 的 VER_URL）；网页里不写死。
  // 销售版没有默认地址（不让别人家的手机去连境外的网站；新版本由帮忙安装的人私下发），家长要查就自己填一个
  const VER_URL0 = (() => { try { return window.DEX && DEX.sales ? '' : nat('verUrl') ? String(EchoNative.verUrl() || '') : ''; } catch (e) { return ''; } })();
  function myVer() { try { if (nat('version')) { const v = JSON.parse(EchoNative.version() || '{}'); if (v && +v.code > 0) return { code: +v.code, name: String(v.name || '') }; } } catch (e) { /* 老版本的原生没有 version() */ } return null; }
  const updNew = () => { const me = myVer(); return !!(me && S.upd && +S.upd.code > me.code); };
  function verCheck() {
    if (!myVer() || typeof fetch !== 'function') return Promise.resolve(false);
    const url = String(S.settings.verUrl || VER_URL0).trim();
    if (!/^https:\/\/[^\s]+$/.test(url)) return Promise.resolve(false);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(() => { if (ctl) ctl.abort(); }, 8000);
    return fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(r => (r.ok ? r.json() : null)).then(j => {
        clearTimeout(tm);
        if (!j || !(+j.code > 0)) return false;
        S.upd = { code: +j.code, name: String(j.name || '').slice(0, 40), url: /^https?:\/\/\S+$/.test(j.url || '') ? String(j.url).slice(0, 300) : '', notes: String(j.notes || '').slice(0, 400), at: Date.now() };
        save(); refreshBars();
        return true;
      }).catch(() => { clearTimeout(tm); return false; });
  }
  function updInfo() {
    const me = myVer(), u = S.upd || {};
    if (!updNew()) { refreshBars(); return; }
    openModal('<div class="big">🆕</div><h2>' + tr('g.ver.new.h') + '</h2>' + trh('g.ver.new.p', { me: me.name || '', mc: me.code, ne: u.name || '', nc: u.code }) +
      (u.notes ? trh('g.ver.new.notes', { notes: u.notes }) : '') +
      '<p>' + tr('g.ver.new.how') + (u.url ? trh('g.ver.new.url', { url: u.url }) : '') + '</p>' +
      '<div class="row">' + (u.url && nat('shareText') ? '<button class="btn ghost" data-act="updShare">' + tr('g.ver.share') + '</button>' : '') + '<button class="btn" data-act="close" data-focus>' + tr('g.ok') + '</button></div>');
  }
  function verSheet() {
    openModal('<h2>' + tr('g.ver.sheet.h') + '</h2><p>' + tr('g.ver.sheet.p') + (VER_URL0 ? tr('g.ver.sheet.def') + '</p><p class="tip ver-url">' + esc(VER_URL0) + '</p>' : tr('g.ver.sheet.none') + '</p>') +
      '<input id="ver-in" class="txt-in" autocomplete="off" spellcheck="false" placeholder="https://…/version.json" value="' + esc(S.settings.verUrl || '') + '">' +
      '<div class="row"><button class="btn ghost" data-act="setBack">' + tr('g.ver.back') + '</button><button class="btn" data-act="verSave">' + tr('g.ver.save') + '</button></div>');
  }

  // ---------- 导出存档 / 从备份恢复（评估第 7 条）----------
  const saveName = () => 'echo-save-' + (LANG ? COURSE + '-' : '') + dayStr().replace(/-/g, '') + '.json';
  function exportSave() {
    save();
    const txt = JSON.stringify(S), name = saveName();
    try { if (nat('shareFile') && EchoNative.shareFile(tr('g.bak.title'), name, txt)) { toast(tr('g.bak.toast.file')); return true; } } catch (e) { /* 换下一种 */ }
    try { if (nat('shareText') && EchoNative.shareText(tr('g.bak.title'), txt)) { toast(tr('g.bak.toast.text')); return true; } } catch (e) { /* 换下一种 */ }
    // 网页版：下载成一个文件
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast(tr('g.bak.toast.dl', { name }));
      return true;
    } catch (e) { toast(tr('g.bak.toast.fail')); return false; }
  }
  // 一份存档的样子：名字 · 等级 · 徽章 · 怪兽
  function saveSum(o) {
    const nm = o && o.player && o.player.name, mon = (o && o.mon) || {};
    return [nm ? String(nm).slice(0, 12) : '', 'Lv ' + lvInfo(+(o && o.xp) || 0).lv, '🏅 ' + Object.keys(mon.badges || {}).length, '🐾 ' + (mon.box || []).length].filter(Boolean).join(' · ');
  }
  function restoreSheet() {
    const meta = bakMeta(), rows = [];
    BAK.forEach((k, i) => { const o = parseSave(lsGet(k)); if (o) rows.push(['l', i, tr('g.bak.row.dev', { d: meta['d' + (i + 1)] || tr('g.bak.before') }), saveSum(o)]); });
    const pre = parseSave(lsGet(PRE)); if (pre) rows.push(['p', 0, tr(meta.preWhy === 'reset' ? 'g.bak.row.reset' : 'g.bak.row.restore') + (meta.pre ? ' · ' + meta.pre : ''), saveSum(pre)]);
    if (nat('backupList')) { try { JSON.parse(EchoNative.backupList() || '[]').forEach(b => rows.push(['n', b.name, tr('g.bak.row.dl', { d: b.date || b.name }), Math.max(1, Math.round((b.size || 0) / 1024)) + ' KB'])); } catch (e) { /* 读不到就不列 */ } }
    const list = rows.map(r => '<button class="pre-item bak-item" data-act="bakUse" data-src="' + r[0] + '" data-k="' + esc(r[1]) + '"><b>' + esc(r[2]) + '</b><span>' + esc(r[3]) + '</span></button>').join('');
    openModal('<h2>' + tr('g.bak.sheet.h') + '</h2><p>' + tr('g.bak.sheet.p') + '</p>' +
      '<div class="pre-list bak-list">' + (list || '<p class="tip">' + tr('g.bak.none') + '</p>') + '</div>' +
      (nat('backupPick') ? '<button class="btn small ghost wide" data-act="bakFile">' + tr('g.bak.file.native') + '</button>'
        : '<label class="btn small ghost wide bak-file">' + tr('g.bak.file.web') + '<input type="file" id="bak-file" accept=".json,application/json,text/plain" hidden></label>') +
      '<button class="btn ghost wide" data-act="setBack">' + tr('g.ver.back') + '</button>');
  }
  function bakText(src, k) {
    if (src === 'l') return bakGet(BAK[+k]);
    if (src === 'p') return bakGet(PRE);
    if (src === 'n' && nat('backupRead')) { try { return EchoNative.backupRead(k); } catch (e) { return ''; } }
    return '';
  }
  function restoreConfirm(txt, label) {
    const o = parseSave(txt);
    if (!o) { toast(tr('g.bak.bad')); return; }
    if (!mine(o)) { toast(tr('g.bak.other')); return; }   // 别的课的存档（一门课一份，ENGINE.md §1）
    RT.restoreTxt = txt; RT.restoreLabel = label || tr('g.bak.label');
    openModal('<div class="big">🗂️</div><h2>' + tr('g.bak.use.h') + '</h2><p><b>' + esc(label || '') + '</b><br>' + esc(saveSum(o)) + '</p>' +
      '<p>' + tr('g.bak.use.p', { cur: saveSum(S) }) + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="bakRestore">' + tr('g.bak.use.no') + '</button><button class="btn coral" data-act="bakGo">' + tr('g.bak.use.go') + '</button></div>');
  }
  function doRestore(txt, label) {
    const o = parseSave(txt);
    if (!o) { toast(tr('g.bak.bad')); return false; }
    if (!mine(o)) { toast(tr('g.bak.other')); return false; }
    save();
    txt = lzUnpack(txt);   // 存档本身一直是原样的 JSON（压着存的只有备份）
    const meta = bakMeta(), cur = packBig(JSON.stringify(S)); meta.pre = dayStr(); delete meta.preWhy;
    if (!lsSet(PRE, cur)) { lsDel(BAK[2]); lsSet(PRE, cur); }
    lsSet(BAK_META, JSON.stringify(meta));
    if (!lsSet(KEY, txt)) { toast(tr('g.bak.full')); return false; }
    lsDel(POS);   // 位置记录是跟着换掉的那份存档的
    RT.noSave = true;   // 马上重新打开：别让现在的进度又存回去
    try { sessionStorage.setItem('echo-restored', label || tr('g.bak.label')); } catch (e) { /* 忽略 */ }
    closeModal();
    setTimeout(() => location.reload(), 50);
    return true;
  }
  // 原生的文件选择器选好了（backupPick）
  window.addEventListener('echo-backup-picked', e => {
    const d = (e && e.detail) || {};
    if (!RT.pickWait) return;
    RT.pickWait = false;
    if (d.ok && d.text) restoreConfirm(d.text, '📂 ' + (d.name || tr('g.bak.picked')));
    else if (d.error && d.error !== 'cancel') toast(tr('g.bak.readfail', { e: d.error }));
  });
  // 出错记录（家长设置里看；可以发给帮忙的人）
  function errText() {
    const L = window.EchoErr ? EchoErr.list().reverse() : [];
    let diag = ''; try { if (nat('diag')) diag = EchoNative.diag(); } catch (e) { /* 忽略 */ }
    return verText() + '\n' + (diag ? tr('g.err.native') + diag + '\n' : '') + L.map(x => new Date(x.t).toLocaleString(loc()) + ' [' + x.k + '] ' + x.m + (x.s ? ' @' + x.s : '') + (x.n > 1 ? ' ×' + x.n : '')).join('\n');
  }
  function errSheet() {
    const L = window.EchoErr ? EchoErr.list().reverse() : [];
    const rows = L.slice(0, 50).map(x => '<li><small>' + esc(new Date(x.t).toLocaleString(loc())) + (x.n > 1 ? ' ×' + x.n : '') + '</small>' + esc(x.m) + (x.s ? ' <i>' + esc(x.s) + '</i>' : '') + '</li>').join('');
    openModal('<h2>' + tr('g.err.h') + '</h2><p class="tip">' + esc(verText()) + tr('g.err.recent', { n: L.length }) + '</p>' +
      (rows ? '<ul class="err-list">' + rows + '</ul>' : '<p>' + tr('g.err.none') + '</p>') +
      (rows ? '<div class="say-row"><button class="btn small ghost" data-act="errShare">' + tr('g.err.share') + '</button><button class="btn small ghost" data-act="errClear">' + tr('g.err.clear') + '</button></div>' : '') +
      '<button class="btn wide" data-act="setBack">' + tr('g.ver.back') + '</button>');
  }
  // 家长首次设置做完了（setup.js）：回首页，给孩子看游戏说明（看完接着做「说一句 Hello」的小检查，家长那边测过就不用）
  function afterSetup() {
    RT.parentUntil = 0;
    show('home'); renderHome();
    // 向导第一页选了「我自己学」的大人：全新的开始接着选要学的语言、做能力检测，做完再看说明（afterPlace）。孩子那条路和以前一样
    if (!kidMode() && window.EchoPlace && EchoPlace.isNew()) { setTimeout(() => EchoPlace.first(), 200); return; }
    if (!S.seenIntro) setTimeout(introSheet, 200);
    else if (window.ECHO_APP && !S.micCheck && speakMode() === 'sr') setTimeout(checkSheet, 300);
  }
  function introSheet() {
    const ln = LANG ? { lang: tr('pk.name.' + COURSE) } : null;   // 别的课：说的是那门语言、没有课本；AI 聊天看服务器会不会用这门语言聊（不会就照旧写「还在做」）
    openModal('<div class="big">🏝️</div><h2>' + tr('g.intro.h') + '</h2>' +
      (LANG ? trh('g.intro.c.p1', ln) + trh('g.intro.c.p2') + (talkLang() ? trh('g.intro.c.p3.on', ln) : trh('g.intro.c.p3')) : trh('g.intro.p1') + trh('g.intro.p2') + trh('g.intro.p3')) + trh('g.intro.p4') +
      envHTML() +
      '<div class="row"><button class="btn ghost" data-act="testVoice">' + tr('g.intro.voice') + '</button><button class="btn" data-act="introGo" data-focus>' + tr('g.intro.go') + '</button></div>', { locked: true });
  }

  // ---------- 事件 ----------
  const num = (t, k) => +t.dataset[k];
  // 课本的名字（选单元页的小标题）：中文界面给 book.js 的全名；别的界面语言给册名（7A……）
  const bookName = b => (I18N && I18N.lang() !== 'zh' ? bookShort(b) : b.name);
  // 单词 / 句子的意思；中文界面没有意思时是空串（和原来一样），别的界面语言没有意思是 null（不显示）
  const meanTxt = it => { const m = meanOf(it); return m == null && (!I18N || I18N.lang() === 'zh') ? '' : m; };
  const ACT = {
    level: t => { SFX.tap(); levelSheet(num(t, 'w'), num(t, 'l')); },
    quizView: t => { S.book.view = t.dataset.v; save(); RT.scrollCur = true; renderHome(); },
    bookAt: t => { const i = num(t, 'i'); if (!unitOpen(i)) return; S.book.at = i; S.book.vb = BK[i].book; save(); closeModal(); RT.scrollCur = true; renderHome(); toast(tr('g.ev.bookat', { b: BK[i].bshort, n: BK[i].n })); },
    bookView: t => {
      if (!bookOpen(t.dataset.b)) { const b = BOOKS.find(x => x.id === t.dataset.b) || {}; openModal('<div class="big">🔒</div><h2>' + trh('g.ev.locked.h', { b: bookShort(b) }) + '</h2><p>' + trh('g.ev.locked.p') + '</p><button class="btn wide" data-act="close" data-focus>' + trh('g.ok') + '</button>'); return; }
      S.book.vb = t.dataset.b; save(); renderHome();
    },
    bookPick: () => {
      const ci = curIdx();
      openModal('<h2>' + trh('g.ev.pick.h') + '</h2><p>' + trh('g.ev.pick.p') + '</p>' +
        BOOKS.filter(b => bookOpen(b.id)).map(b => '<h3 class="pick-h">' + esc(bookName(b)) + (b.old ? trh('g.ev.pick.old') : '') + '</h3><div class="fly-list">' +
          BK.map((u, i) => u.book !== b.id ? '' : '<button class="btn small ' + (i === ci ? '' : 'ghost') + '" data-act="bookAt" data-i="' + i + '">' + u.icon + ' U' + u.n + ' ' + esc(u.en) + '</button>').join('') + '</div>').join('') +
        '<button class="btn ghost wide" data-act="close">' + trh('g.cancel') + '</button>');
    },
    // 语法提示的标题和说明是中文写的内容：英语界面没有可显示的翻译，只给个标题
    bookGram: t => { const u = WX[num(t, 'w')], ge = (LANG && u.grammar.en) || {}, gt = LANG ? glossC({ zh: u.grammar.title, en: ge.title }) : gloss({ zh: u.grammar.title }), gp = LANG ? glossC({ zh: u.grammar.tip, en: ge.tip }) : gloss({ zh: u.grammar.tip }); openModal('<div class="big">📐</div><h2>' + (gt == null ? trh('g.ev.gram.h0', { n: u.n }) : trh('g.ev.gram.h', { n: u.n, t: gt })) + '</h2>' + (gp == null ? '' : '<p>' + esc(gp) + '</p>') + '<button class="btn wide" data-act="close" data-focus>' + trh('g.ok') + '</button>'); },
    setBookMix: t => { const m = +t.dataset.m; if (m === S.book.mix) return; parentOk(tr('g.ev.why.mix'), () => { S.book.mix = m; save(); settingsSheet(); }); },
    setGate: t => {
      const on = t.dataset.m === '1';
      if (on === (S.settings.gate !== false)) return;
      const go = () => { S.settings.gate = on; if (!on) dayLog().gateOff = 1; save(); settingsSheet(); };
      if (on) go(); else parentOk(tr('g.ev.why.gate'), go);
    },
    goAdventure: () => goHome('mon'),
    report: () => { closeModal(); reportSheet(); },
    gateTalk: () => { closeModal(); goHome('talk'); },
    // 学习锁卡片上「手机日期被改过」：家长输密码，从今天重新开始（maxDay 设成今天，周报记一笔）
    clockReset: () => parentOk(tr('g.ev.why.clock'), () => { S.maxDay = dayStr(); dayLog().clockReset = 1; save(); renderHome(); toast(tr('g.ev.clock.ok')); }),
    // 家长密码的数字键盘
    pinKey: t => pinKey(t.dataset.k),
    pinDel: () => { if (RT.pin) { RT.pin.buf = RT.pin.buf.slice(0, -1); pinUpd(); } },
    pinClr: () => { if (RT.pin) { RT.pin.buf = ''; pinUpd(); } },
    // 改家长密码：网页版和销售版的 APK 能改（销售版原生要 2 分钟内刚输对过旧密码，所以这里一律重新输一次）
    pinChange: () => {
      RT.parentUntil = 0; RT.pinPass = null;
      const setNew = () => pinPad(tr('g.ev.why.pin'), () => { toast(tr('g.ev.pin.ok')); settingsSheet(); }, 'set1');
      if (pinState().has) parentOk(tr('g.ev.why.pin'), setNew); else setNew();
    },
    // 冒险时间
    limEdit: () => parentOk(tr('g.ev.why.lim'), limitSheet),
    limSet: t => {
      const k = t.dataset.k, v = t.dataset.v, c = S.settings.limit = limitCfg();
      c[k] = k === 'on' ? v === '1' : k === 'from' || k === 'to' ? v : +v;
      save(); limitSheet();
    },
    setBack: () => settingsSheet(),   // 家长设置里的小页面「完成 / 返回」：回到设置（家长设置保持展开）
    // 日报推送
    pushEdit: () => parentOk(tr('g.ev.why.push'), pushSheet),
    pushSave: () => {
      const v = (($('#push-in') || {}).value || '').trim();
      if (v && !pushKind(v)) { toast(tr('g.push.bad')); return; }
      S.settings.push = v; S.push = { sent: '' }; save(); toast(v ? tr('g.push.on') : tr('g.push.off')); settingsSheet();
    },
    pushOff: () => { S.settings.push = ''; save(); toast(tr('g.push.off')); settingsSheet(); },
    pushTest: () => {
      const v = (($('#push-in') || {}).value || '').trim();
      if (!pushKind(v)) { toast(tr('g.push.fill')); return; }
      pushSend(tr('g.push.test.t'), tr('g.push.test.b'), v).then(ok => toast(ok ? tr('g.push.test.ok') : tr('g.push.test.no')));
    },
    setCtl: t => { S.settings.ctl = t.dataset.m; save(); if (window.EchoWorld && EchoWorld.ctlMode) EchoWorld.ctlMode(); settingsSheet(); },
    // 界面语言（i18n.js）
    setUi: t => { if (t.classList.contains('on')) return; setUi(t.dataset.l); settingsSheet(); if (!$('#home').hidden) renderHome(); },
    setRuby: t => { S.settings.ruby = t.dataset.v === '1'; save(); settingsSheet(); },
    // 谁在学：孩子 → 自己学（没有学习锁、不限时、设置不要家长密码）要输家长密码；换回「孩子」不用
    setLearner: t => {
      const m = t.dataset.m === 'open' ? 'open' : 'kid';
      if (m === (kidMode() ? 'kid' : 'open')) return;
      const go = () => { S.settings.learner = m; RT.parentUntil = 0; save(); toast(tr('place.learner.to.' + m)); settingsSheet(); if (!$('#home').hidden) renderHome(); };
      // 有家长密码的地方（安装包；网页版设过密码的）要输对才换；网页版从来没设过密码的直接换（没有密码可问）
      const ps = pinState();
      if (m === 'open' && (ps.has || ps.native)) parentOk(tr('place.who.pin'), go); else go();
    },
    setOrient: t => { S.settings.orient = t.dataset.m; save(); applyOrient(); settingsSheet(); },
    // 开始一关：第一次进第 1 关先看单词卡（levelGo，WORDS.md §2）
    start: t => { closeModal(); levelGo(num(t, 'w'), num(t, 'l')); },
    go: t => { const wi = num(t, 'w'), li = num(t, 'l'); if (!isUnlocked(wi, li)) { goHome(); return; } levelGo(wi, li); },
    // ---- 单词表、单词卡、我的单词本、发音入门（WORDS.md）----
    // 单词表：小镇 / 单元卡片上、关卡详情里（data-l：关上回关卡详情）、大地图冒险菜单里（data-from="menu"：关上回菜单）
    wordList: t => { SFX.tap(); wordList(num(t, 'w'), t.dataset.from === 'menu' ? 'menu' : t.dataset.l != null ? { li: num(t, 'l') } : null); },
    wdBack: () => {
      const b = RT.wl && RT.wl.back, wi = RT.wl ? RT.wl.wi : -1;
      if (b === 'menu' && ACT.wMenu) { ACT.wMenu(); return; }
      if (b && b.li != null && WX[wi]) { levelSheet(wi, b.li); return; }
      closeModal();
    },
    wdSay: t => say(t.dataset.t),
    wdRoma: t => { S.settings.romaji = t.dataset.v === '1'; save(); if (RT.wl) wordList(RT.wl.wi, RT.wl.back); },
    wcOpen: t => openCards(num(t, 'w'), { list: true, back: RT.wl ? RT.wl.back : null }),
    wcNext: () => cardStep(1),
    wcPrev: () => cardStep(-1),
    wcSay: () => { const c = RT.wc, cur = c && c.list[c.k]; if (cur && cur.i != null) say(WX[c.wi].words[cur.i][0], undefined, 'm'); },
    wcSkip: () => cardEnd(true),
    wcGo: () => cardEnd(true),
    wcEnd: () => cardEnd(false),
    wordBook: () => { SFX.tap(); wordBook(); },
    wbF: t => { if (!RT.wb) return; RT.wb.f = t.dataset.f; RT.wb.n = 1; $$('#sheet .wb-f button').forEach(b => b.classList.toggle('on', b.dataset.f === RT.wb.f)); wbList(); },
    wbMore: () => { if (!RT.wb) return; RT.wb.n++; wbList(); },
    // 单词本里点一个词：展开 / 收起例句
    wbOpen: t => {
      const row = t.closest('.wd-row'), main = row && row.querySelector('.wd-main');
      if (!main) return;
      const old = main.querySelector('.wd-ex, .wd-noex');
      if (old) { old.remove(); row.classList.remove('open'); return; }
      const w = WX[num(t, 'w')], it = w && w.words[num(t, 'i')];
      if (!it) return;
      main.insertAdjacentHTML('beforeend', wdExHTML(w, it[0]) || '<div class="wd-noex">' + trh('g.wb.noex') + '</div>');
      row.classList.add('open');
    },
    primer: () => { SFX.tap(); const was = primerNew(); primerSheet(RT.pr ? RT.pr.k : 0); if (was && !$('#home').hidden) renderHome(); },
    primerNo: () => { S.primerSeen = dayStr(); save(); renderHome(); },
    prSec: t => primerSheet(num(t, 's')),
    prSay: t => {
      const s = PRIMER && PRIMER.sections[num(t, 's')], it = s && s.items[num(t, 'i')];
      if (!it) return;
      $$('#sheet .pr-cell.on, #sheet .pr-row.on').forEach(b => b.classList.remove('on'));
      t.classList.add('on');
      sayUnit(it.say);
      prEx(it);
    },
    prSayEx: t => say(t.dataset.t, undefined, 'f', true),
    // ---- 第二部分（WORDS.md 第 7–11 条）----
    // 🐢 只这一次放慢：单词表 / 单词本 / 课前讲解的词和句子、单词卡、发音入门的例词和格子、求助的话
    wdSlow: t => say(t.dataset.t, 0.6),
    wcSlow: () => { const c = RT.wc, cur = c && c.list[c.k]; if (cur && cur.i != null) say(WX[c.wi].words[cur.i][0], 0.6, 'f'); },
    prSlowEx: t => say(t.dataset.t, 0.6, 'f', true),
    prSlowU: t => sayUnit(t.dataset.t, 0.6),
    hpSay: t => say(t.dataset.t, undefined, 'f', true),
    hpSlow: t => say(t.dataset.t, 0.6, 'f', true),
    // 📘 这一课学什么：小镇 / 单元卡片上、单词表顶上（data-from="list"：关上回单词表）、新手路线
    lesson: t => { SFX.tap(); lessonSheet(num(t, 'w'), t.dataset.from === 'list' ? { back: 'list' } : {}); },
    lsDone: () => { RT.ls = null; closeModal(); },
    lsBack: () => { const L = RT.ls; RT.ls = null; if (L && RT.wl && RT.wl.wi === L.wi) wordList(L.wi, RT.wl.back); else closeModal(); },
    // 第一次进第 1 关：讲解看完 → 单词卡（没看过的话）→ 开考；「跳过，直接闯关」两样都记一笔
    lsNext: () => { const L = RT.ls; RT.ls = null; if (L && L.mini) { closeModal(); startMini(L.wi, 0); return; } if (!L || L.li == null) { closeModal(); return; } if (cardsFirst(L.wi, L.li)) { openCards(L.wi, { li: L.li }); return; } closeModal(); startLevel(L.wi, L.li); },
    lsSkip: () => { const L = RT.ls; RT.ls = null; if (!L || L.li == null) { closeModal(); return; } cardsSeen(L.wi); closeModal(); startLevel(L.wi, L.li); },
    // 🆘 求助的话（聊天页的 🆘 也是它）
    sosList: () => { SFX.tap(); helpSheet(); },
    // 🧭 新手路线：点一步就去那里
    rtGo: t => { SFX.tap(); routeGo(t.dataset.s, num(t, 'z')); },
    setRoute: t => { S.settings.route = t.dataset.v === '1'; save(); settingsSheet(); },
    setSlow: t => { S.settings.slow = t.dataset.v === '1'; save(); settingsSheet(); },
    wdPopX: () => { const el = $('#wd-pop'); if (el) el.hidden = true; },
    close: () => { if ($('#restbtn') && $('#restbtn').disabled) return; closeModal(); },
    // 第一次打开：看完说明，开口模式下接着做「麦克风 + 网络 + 密钥」小检查
    introGo: () => { S.seenIntro = true; save(); closeModal(); primeTTS(); ac(); if (speakMode() === 'sr' && !S.micCheck) setTimeout(checkSheet, 200); },
    // 存档读不出来、用了备份的提示看完了：新存档（一份备份都没有）接着看游戏说明
    restoredOk: () => { closeModal(); if (!S.seenIntro) introSheet(); },
    // AI 打分用不了（评估第 3 条）
    aiBarInfo: () => aiBarInfo(),
    storeInfo: () => storeInfo(),
    parentSet: () => { RT.parentOpen = true; settingsSheet(); setTimeout(() => { const d = $('#set-parent'); if (d) d.scrollIntoView({ block: 'start' }); }, 60); },
    micFix: () => { try { if (nat('openAppSettings')) EchoNative.openAppSettings(); } catch (e) { /* 忽略 */ } toast(tr('g.ev.micfix')); },
    micCheck: () => checkSheet(),
    chkMic: () => chkMic(),
    chkSkip: () => { if (!S.micCheck) S.micCheck = 'skip'; save(); stopListening(); closeModal(); },
    chkDone: () => closeModal(),
    // 新版本
    updInfo: () => updInfo(),
    updShare: () => { try { if (S.upd && S.upd.url) EchoNative.shareText(tr('g.ev.upd.t'), tr('g.ev.upd.b', { v: S.upd.name || '', u: S.upd.url })); } catch (e) { /* 忽略 */ } },
    verEdit: () => parentOk(tr('g.ev.why.ver'), verSheet),
    verSave: () => {
      const v = (($('#ver-in') || {}).value || '').trim();
      if (v && !/^https:\/\/\S+$/.test(v)) { toast(tr('g.ev.ver.https')); return; }
      S.settings.verUrl = v; S.upd = {}; save(); toast(v ? tr('g.ev.ver.new') : tr('g.ev.ver.def')); settingsSheet(); verCheck();
    },
    // 存档备份
    bakExport: () => exportSave(),
    bakRestore: () => parentOk(tr('g.ev.why.bak'), restoreSheet),
    bakUse: t => { const txt = bakText(t.dataset.src, t.dataset.k); if (!txt) { toast(tr('g.ev.bak.bad')); return; } restoreConfirm(txt, (t.querySelector('b') || t).textContent); },
    bakFile: () => { RT.pickWait = true; try { EchoNative.backupPick(); } catch (e) { RT.pickWait = false; toast(tr('g.ev.bak.pick')); } },
    bakGo: () => { if (RT.restoreTxt) doRestore(RT.restoreTxt, RT.restoreLabel); },
    // 出错记录
    errLog: () => errSheet(),
    errShare: () => {
      const txt = errText();
      try { if (nat('shareText') && EchoNative.shareText(tr('g.ev.err.title'), txt)) return; } catch (e) { /* 换下一种 */ }
      try { navigator.clipboard.writeText(txt).then(() => toast(tr('g.ev.err.copied')), () => toast(tr('g.ev.err.nocopy'))); } catch (e) { toast(tr('g.ev.err.nocopy')); }
    },
    errClear: () => { if (window.EchoErr) EchoErr.clear(); errSheet(); },
    say: () => P && P.q && say(P.q.audio),
    saySlow: () => P && P.q && say(P.q.audio, 0.6),
    sayT: () => P && P.q && (peekAnswer(), say(P.q.target || P.q.en)),
    sayTSlow: () => P && P.q && (peekAnswer(), say(P.q.target || P.q.en, 0.6)),
    sayText: t => say(t.dataset.t),
    // 看原文：听力题变成了读的题，算带提示（经验减半、复习里不升格）
    reveal: t => { const h = $('#hl'); if (h) h.classList.remove('blur'); t.remove(); if (P && !P.answered) P.aided = true; },
    btShow: () => btReveal(true),
    pick: t => onPick(num(t, 'i')),
    tile: t => onTile(num(t, 'i'), false),
    untile: t => onTile(num(t, 'i'), true),
    loCheck: onLoCheck,
    mic: onMic,
    hint: onHint,
    skip: onSkip,
    rate: t => onRate(num(t, 'v')),
    playMine: () => { if (RT.recUrl) { const a = new Audio(RT.recUrl); a.play().catch(() => toast(tr('g.ev.playfail'))); } },
    selfReveal: () => { P.selfReveal = true; const st = $('#st'); if (st) { st.classList.remove('mask'); st.innerHTML = wordsHTML(P.q.target); } const b = $('#hintbtn'); if (b) b.disabled = true; say(P.q.target); showSelf(false); },
    btOpt: t => onBtOpt(num(t, 'i')),
    bossGo: () => renderQ(),
    scene: t => { closeModal(); openScene(num(t, 'w')); },
    thClose: () => goHome(),
    thPlay: () => {
      if (!T) return;
      if (T.playing) {
        stopScene(); $('#th-turn').innerHTML = ''; updPlay(); renderStage();
        const clap = $('#th-clap'); if (clap) clap.hidden = true;
        const stage = $('#stage'); if (stage) stage.classList.add('live');
        return;
      }
      primeTTS();
      playFrom(T.done || T.idx < 0 ? 0 : T.idx);
    },
    thMode: t => { stopScene(); T.mode = t.dataset.m; T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thMe: t => { stopScene(); T.me = num(t, 'i'); T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thSlow: t => { T.slow = !T.slow; t.classList.toggle('on', T.slow); t.setAttribute('aria-pressed', T.slow); },
    thEn: t => { T.en = !T.en; t.classList.toggle('on', T.en); t.setAttribute('aria-pressed', T.en); renderStage(); },
    thZh: t => { T.zh = !T.zh; t.classList.toggle('on', T.zh); t.setAttribute('aria-pressed', T.zh); renderStage(); },
    thLine: t => { if (!T || T.playing) return; const L = T.sc.lines[num(t, 'i')]; say(L[1], T.slow ? 0.65 : undefined, T.sc.cast[L[0]][2]); },
    thHear: () => { if (!T || !T.turn) return; const L = T.sc.lines[T.idx]; say(L[1], 0.75, T.sc.cast[L[0]][2]); },
    thMic: () => thMic(),
    thDone: () => endTurn(speakMode() !== 'sr'),
    next: onNext,
    quit: () => {
      if (!P) { goHome(); return; }
      openModal('<h2>' + trh('g.ev.quit.h') + '</h2><p>' + trh('g.ev.quit.p') + '</p><div class="row"><button class="btn ghost" data-act="home">' + trh('g.ev.quit.yes') + '</button><button class="btn" data-act="close" data-focus>' + trh('g.ev.quit.no') + '</button></div>');
    },
    home: () => { closeModal(); goHome(); },
    retry: () => { closeModal(); const p = P; if (!p) { goHome(); return; } if (p.mini) startMini(p.wi, p.mini.k); else if (p.review) startLevel(0, 0, true); else startLevel(p.wi, p.li); },
    // ---- 🌱 一步一步学：单词小课（tools/course/STARTER.md）----
    // 小镇 / 单元卡片上的 ① ② ③、「先一步一步学」的弹窗、小课结算页的「下一节」「再学一遍」、新手路线
    mini: t => { SFX.tap(); miniGo(num(t, 'w'), t.dataset.k != null ? num(t, 'k') : null); },
    // 「我学过了，直接闯关」：这一课以后不再问
    miniSkip: t => { const wi = num(t, 'w'), li = t.dataset.l != null ? num(t, 'l') : 0; MN().skip[wi] = 1; save(); closeModal(); levelGo(wi, li); },
    // 教学卡的「记住了，下一步」
    tcNext: () => { if (!P || !P.q || P.q.type !== 'tc' || P.answered) return; P.answered = true; SFX.tap(); onNext(); },
    setStarter: t => { S.settings.starter = t.dataset.v === '1'; save(); settingsSheet(); },
    revive: () => {
      if (!P || S.coins < 30 || P.revived) return;
      S.coins -= 30; P.revived = true; P.hearts = 2; save(); renderHearts(); closeModal(); SFX.coin();
      toast(tr('g.ev.revive'));
      P.idx++; if (P.idx >= P.total) finish(); else renderQ();
    },
    review: () => {
      const r = revSummary(), all = Object.values(S.rev.items);
      const wrongs = all.filter(e => e.x > 0 && e.due).sort((a, b) => b.x - a.x).slice(0, 30);
      const txt = e => e.k === 'free' ? [e.en, meanTxt(e)] : (() => { const w = WX[e.w], it = e.k === 'word' ? w.words[e.i] : e.k === 'sent' ? w.sents[e.i] : w.dlgs[e.i]; return e.k === 'dlg' ? [it[0] + ' → ' + it[1], ''] : [it[0], meanTxt(it)]; })();
      const list = wrongs.map(e => { const [en, zh] = txt(e), miss = e.x > 1 ? tr('g.ev.rv.miss', { n: e.x }) : ''; return '<button class="pre-item" data-act="sayText" data-t="' + esc(en.replace(' → ', ' ... ')) + '">🔊 <b>' + rb(en) + '</b><span>' + (zh == null ? esc(miss.slice(3)) : esc(zh) + esc(miss)) + '</span></button>'; }).join('');
      const mastered = revMastered(), waiting = all.filter(e => e.due && e.due > dayStr()).length;
      openModal('<div class="big">📕</div><h2>' + trh('g.ev.rv.h') + '</h2>' +
        '<p>' + (r.n ? trh('g.ev.rv.today', { n: r.n, list: [r.wrong ? tr('g.ev.rv.wrong', { n: r.wrong }) : '', r.old ? tr('g.ev.rv.old', { n: r.old }) : '', r.chat ? tr('g.ev.rv.chat', { n: r.chat }) : ''].filter(Boolean).join(tr('g.ev.sep')) }) : trh('g.ev.rv.done')) +
        trh('g.ev.rv.rule') + '</p>' +
        '<p class="tip">' + trh('g.ev.rv.tip', { a: waiting, b: mastered }) + '</p>' +
        (list ? '<details class="pre"><summary>' + trh('g.ev.rv.sum') + '</summary><div class="pre-list">' + list + '</div></details>' : '') +
        '<div class="row"><button class="btn ghost" data-act="close">' + trh('g.ev.rv.later') + '</button>' + (r.n ? '<button class="btn" data-act="startReview" data-focus>' + trh('g.ev.rv.go', { n: Math.min(REV_N, r.n) }) + '</button>' : '') + '</div>');
    },
    startReview: () => { closeModal(); startLevel(0, 0, true); },
    claim: t => {
      const q = S.quests.list.find(x => x.id === t.dataset.q), d = QDEF[t.dataset.q];
      if (!q || !d || q.claimed || q.p < d.goal) return;
      q.claimed = true; S.coins += d.rw; S.xp += 20; save(); SFX.coin();
      toast(tr('g.ev.claim', { c: d.rw }), 'gold');
      renderHome(); checkAch();
    },
    chest: openChest,
    shop: shopSheet,
    pet: t => onPet(t.dataset.p),
    buyFreeze: () => { if (S.freeze >= 2 || S.coins < 100) return; S.coins -= 100; S.freeze++; save(); SFX.coin(); renderTop(); shopSheet(); },
    ach: achSheet,
    settings: () => { RT.parentOpen = false; settingsSheet(); },
    testVoice: () => { ac(); primeTTS(); say('Hello! Welcome to Echo Island. Let\'s learn English together!'); },
    setMode: t => { S.settings.mode = t.dataset.m; if (t.dataset.m === 'auto') { RT.srBroken = false; RT.noRec = false; if (!SRC) toast(tr('g.ev.nosr')); } save(); settingsSheet(); },
    setTts: t => { S.settings.tts = t.dataset.m; RT.ttsBroken = false; save(); settingsSheet(); primeTTS(); say('Hello! How are you?'); },
    setGfx: t => { S.settings.gfx = t.dataset.m; if (t.dataset.m === 'auto') S.settings.gfxAuto = ''; save(); settingsSheet(); if (window.EchoWorld) EchoWorld.setGfx(); },
    setLook: t => { const on = t.dataset.m === 'new'; if (on === lookOn()) return; try { localStorage.setItem('echo-look', on ? 'new' : 'std');   /* 选经典也记下来：公开版不选的时候默认是新画风 */ } catch (e) { /* 存不下：只管这一次 */ } lookApply(on); settingsSheet(); },
    sfx: t => { S.settings.sfx = t.dataset.v === '1'; save(); settingsSheet(); },
    setMusic: t => { S.settings.music = t.dataset.v; save(); musicVol(); sceneMusic(); settingsSheet(); },
    // 「全部关卡直接开放」只对闯关练习有效；打开要家长密码，关上不用
    unlock: t => {
      const on = t.dataset.v === '1', go = () => { S.settings.unlockAll = on; save(); settingsSheet(); renderHome(); };
      if (on === !!S.settings.unlockAll) return;
      if (on) parentOk(tr('g.ev.why.unlock'), go); else go();
    },
    // 清空进度：家长密码 + 再输入「清空」两个字（英语界面：输入 reset）
    reset: () => parentOk(tr('g.ev.why.reset'), () => openModal('<div class="big">⚠️</div><h2>' + trh('g.ev.reset.h') + '</h2><p>' + trh('g.ev.reset.p') + '</p>' +
      '<p>' + trh('g.ev.reset.ask') + '</p><input id="reset-in" class="txt-in" autocomplete="off" aria-label="' + trh('g.ev.reset.aria') + '">' +
      '<div class="row"><button class="btn ghost" data-act="setBack">' + trh('g.ev.reset.no') + '</button><button class="btn coral" data-act="resetGo">' + trh('g.ev.reset.go') + '</button></div>')),
    resetGo: () => {
      const i = $('#reset-in');
      if (!i || i.value.trim().toLowerCase() !== tr('g.ev.reset.word').toLowerCase()) { toast(tr('g.ev.reset.need')); return; }
      // 设置和每周的记录（家长看的）留着；今天的记录上标一笔「清空过进度」
      // 清空前先另存一份（和「从备份恢复」之前一样存在 PRE），清错了还能找回来
      const meta = bakMeta(), cur = packBig(JSON.stringify(S)); meta.pre = dayStr(); meta.preWhy = 'reset';
      if (!lsSet(PRE, cur)) { lsDel(BAK[2]); lsSet(PRE, cur); }
      lsSet(BAK_META, JSON.stringify(meta));
      const keep = S.settings, weekly = S.weekly, maxDay = S.maxDay;
      S = fresh(); S.settings = keep; S.weekly = weekly; S.maxDay = maxDay; S.seenIntro = true; dayLog().reset = 1;
      if (window.EchoSetup) EchoSetup.apply(false);   // 销售版：家长设好的昵称、形象、伙伴接着用
      save(); closeModal(); renderHome(); toast(tr('g.ev.reset.done'));
    },
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (t) {
      if (t.disabled) return;
      const f = ACT[t.dataset.act];
      // 记下刚点的按钮：老写法 `if (!parentOk('…')) return;` 输对密码以后要把它再执行一次
      if (!/^pin/.test(t.dataset.act)) RT.lastAct = { act: t.dataset.act, el: t, t: Date.now() };
      if (f) f(t, e);
      return;
    }
    if (e.target.id === 'modal' && !RT.modalLocked) closeModal();
  });
  // 设置里「🔒 家长设置」展开 / 收起：重画设置页时保持原样
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'set-parent') RT.parentOpen = e.target.open; }, true);
  document.addEventListener('input', e => {
    if (e.target.id === 'set-rate') { S.settings.rate = +e.target.value; $('#rate-v').textContent = S.settings.rate.toFixed(2); save(); }
    // 我的单词本的搜索框：按词或意思找（日语也认罗马字），边打边找
    if (e.target.id === 'wb-q' && RT.wb) { RT.wb.q = e.target.value; RT.wb.n = 1; wbList(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'set-voice') { S.settings.voice = e.target.value; pickVoice(); save(); say('Hello! How are you?'); }
    // 网页版「从备份恢复」：选了一个存档文件
    if (e.target.id === 'bak-file' && e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > 32 * 1024 * 1024) { toast(tr('g.ev.bak.big')); return; }
      const rd = new FileReader();
      rd.onload = () => restoreConfirm(String(rd.result || ''), '📂 ' + f.name);
      rd.onerror = () => toast(tr('g.ev.bak.read'));
      rd.readAsText(f);
    }
  });
  document.addEventListener('keydown', e => {
    // 家长密码键盘：电脑上也可以直接敲数字
    if (RT.pin && !$('#modal').hidden && $('#pin-pad')) {
      if (/^\d$/.test(e.key)) { e.preventDefault(); pinKey(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); ACT.pinDel(); return; }
    }
    // 单词卡：← → 翻页
    if (!$('#modal').hidden && RT.wc && $('#wc') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); cardStep(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (!$('#modal').hidden) { if (e.key === 'Escape' && !RT.modalLocked) closeModal(); return; }
    if (!P || $('#play').hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Enter' && $('#fb').classList.contains('show')) { e.preventDefault(); onNext(); return; }
    if (/^[1-4]$/.test(e.key)) {
      const b = $$('#p-body .opt')[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); if (P.q) { if (/^sr_[ws]$/.test(P.q.type)) peekAnswer(); say(P.q.audio || P.q.target); } }
  });

  // 冒险里出英语题用哪份内容：按设置有几成换成课本正在学的单元（其中三成复习前面学过的单元），其余用这座岛的话题。
  // 返回 { w: 编号（存进错题本的 q.w）, d: 内容（words/sents/dlgs） }
  // 按能力走（PLV() 不是 null）：课本占几成按级别来（levels.js 的 mix：级别越高，1 级的小镇话题词出得越少；家长设成「只用岛上话题」的照旧），
  // 那三成复习只在「起点单元 … 正在学的前一个」里挑——已免修的单元不拿来出题；级别比现有内容高的（起点就是最难的那一册），在开放的最难的 8 个单元里挑
  function src(z) {
    const pl = PLV(), cur = curIdx();
    const mix = pl != null && S.book.mix > 0 && window.EchoLevels ? Math.max(S.book.mix, EchoLevels.profile(S.place.lang, pl).mix) : S.book.mix;
    if (cur < 0 || !(Math.random() < mix)) return { w: z, d: W[z] };
    if (pl == null) {
      const i = cur > 0 && Math.random() < .3 ? cur - 1 - rnd(Math.min(cur, 8)) : cur;   // 三成复习最近学过的 8 个单元（可以是上一册的）
      return { w: NB + i, d: BK[i] };
    }
    let i = cur;
    if (Math.random() < .3) {
      const from = Math.max(0, S.place.from), top = pl > EchoLevels.topLevel(S.place.lang, BK);
      const pool = top ? range(BK.length).filter(unitOpen).slice(-8) : range(cur).filter(k => k >= Math.max(from, cur - 8));
      if (pool.length) i = pick(pool);
    }
    return { w: NB + i, d: BK[i] };
  }
  // ---------- 别的课：写死的英语句子（台词翻译表 tools/course/SPEC.md §8；没翻的按 ENGINE.md §5 的过渡办法）----------
  // 课程内容一句话的意思（界面语言里的：英语界面 en、中文界面 zh；没有是 null）
  function meanText(t) { const e = entryOf(t); return e ? glossC({ zh: e.zh, en: e.en }) : null; }
  // lineOf(英语原文, { zh, fill, swap }) → { t, seg, r, en, zh, mean }，没有（英语课、没有翻译表、这句没翻）返回 null。
  //   原文可以带着 {name} / {rival}，也可以是已经换好名字的（换回占位符再找）；模板里的怪兽名可以是起的昵称（照原样，packs.js 的 lineFind）。
  //   t / seg / r 里的 {name} / {rival} 换成名字（fill：world.js 用自己的换法），en 是换好名字的英语原文。
  //   查到的这句登记进条目表 ENTRY：标读音（ruby）、逐块标色、打分（LANG.score 按 seg / r）、say() 都认得它，就像课程内容。
  //   zh：这句的中文意思（剧情页面的 zh），swap：[[英语, 译文]] 意思里夹着的英语原句换成译文；
  //   mean：界面语言里的意思（中文界面 = zh，英语界面 = 英语原文），说到「英语 / English」的换成在学的语言（翻译表的台词就是这么翻的，SPEC §8.2）
  const PNAME = () => (S.player && S.player.name) || 'Trainer';
  const RNAME = () => (S.player && S.player.gender === 'girl' ? 'Leo' : 'Mia');
  const fillNames = s => (typeof s === 'string' ? s.split('{name}').join(PNAME()).split('{rival}').join(RNAME()) : s);
  const reWord = s => new RegExp('(^|[^A-Za-z])' + String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'g');
  const unfillNames = s => { let o = String(s); if (S.player && S.player.name) o = o.replace(reWord(S.player.name), '$1{name}'); return o.replace(reWord(RNAME()), '$1{rival}'); };
  // 模板里的怪兽名：手册里的名字，或者自己队伍 / 箱子里起的昵称
  // （界面上的怪兽名已经换成这门课的写法时，lineFind 自己认得译名，见 packs.js 的 slotVal）
  const isMonName = v => !!(window.DEX && (DEX.all || DEX.list || []).some(sp => sp.en === v)) || ((S.mon && S.mon.box) || []).some(m => m && m.nick === v);
  function courseWord(s, ui) {
    if (typeof s !== 'string' || !s || !LANG || !I18N) return s;
    const nm = I18N.t('pk.name.' + COURSE, null, ui);
    // 「英文名」「English name」：名字暂时还是拉丁字母，说「名字」就好
    // @i18n-content 改写的是台词的意思（内容），不是界面文字
    if (ui === 'zh') return s.replace(/英文名/g, '名字').replace(/英语|英文/g, nm);
    // 英语界面：原文本来就说到这门语言（学科岛的课程表里「English」旁边还有学科「Chinese」，学中文时它翻成「语文」）：
    // 先改成「Chinese (language arts)」，不然「English → Chinese」以后两门课的意思一样了
    const own = new RegExp('\\b' + nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b(?! \\(language arts\\))', 'g');
    return s.replace(own, nm + ' (language arts)').replace(/\bEnglish name\b/g, 'name').replace(/\bEnglish\b/g, nm);
    // @i18n-content-end
  }
  // ---------- 画面上的名字（台词翻译表的词：monster / move / item / place / skill / crystal / person / sign / ui，tools/course/SPEC.md §8.1）----------
  // termRaw(类别, 英文) → { t, r } 或 null；英文前面的记号（地板字的「✓ 」、背景字的「♪ 」）不算，查到的译文前面照样加回去；
  // 招牌、地板字不分大小写（MUSIC / Music 是同一条）。英语课、没有翻译表、没翻：null
  function termRaw(cat, en) {
    if (!LANG || !LTAB || en == null) return null;
    const M = LTAB.M[cat];
    if (!M || typeof M !== 'object') return null;
    const s = String(en), pre = (/^[^A-Za-z]*/.exec(s) || [''])[0], core = s.slice(pre.length);
    if (!core) return null;
    let v = Object.prototype.hasOwnProperty.call(M, core) ? M[core] : null;
    if (v == null) {
      const lc = LTAB.lc || (LTAB.lc = {});
      const low = lc[cat] || (lc[cat] = new Map(Object.keys(M).map(k => [k.toLowerCase(), k])));
      const k = low.get(core.toLowerCase());
      if (k != null) v = M[k];
    }
    const x = typeof v === 'string' ? { t: v } : v && typeof v.t === 'string' ? v : null;
    return x ? { t: pre + x.t, r: typeof x.r === 'string' ? x.r : null, pre } : null;
  }
  // termOf(类别, 英文)：显示用的文字（没翻 / 英语课：英文原样）
  const termOf = (cat, en) => { const x = termRaw(cat, en); return x ? x.t : en; };
  // termHTML(类别, 英文)：显示用的 HTML——日语 / 中文有读音就标（「读音」设置关了不标），没翻的是转义过的英文
  function termHTML(cat, en) {
    const x = termRaw(cat, en);
    if (!x) return esc(en == null ? '' : String(en));
    if (!x.r || !rubyOn()) return esc(x.t);
    return esc(x.pre) + rubyPiece(x.t.slice(x.pre.length), x.r);
  }
  // 对手（Leo / Mia）是游戏里的人物，不是起的名字：这门课的名字牌怎么写（terms.person），台词里的 {rival} 就怎么写（读音 r 照名字牌的）
  const rivalTerm = () => termRaw('person', RNAME());
  const rivalIn = (s, r) => { const x = typeof s === 'string' ? rivalTerm() : null; return x ? s.split('{rival}').join(r ? x.r || x.t : x.t) : s; };
  // 台词意思里照留的英文：主角的名字、起的昵称、这门课不翻的怪兽名（西语照英文写）
  const glossKeep = v => v === PNAME() || ((S.mon && S.mon.box) || []).some(m => m && m.nick === v) || (isMonName(v) && !termRaw('monster', v));
  function lineOf(en, o) {
    if (!LANG || !LTAB || en == null || en === '') return null;
    o = o || {};
    en = String(en);
    const opt = { isMon: isMonName, content: v => entryOf(v) };
    let res = EchoPacks._.lineFind(LTAB, en, opt);
    if (!res) { const u = unfillNames(en); if (u !== en) res = EchoPacks._.lineFind(LTAB, u, opt); }
    if (!res) return null;
    const f = o.fill || fillNames, fT = s => f(rivalIn(s)), fR = s => f(rivalIn(s, true));
    const t = fT(res.t), seg = Array.isArray(res.seg) ? res.seg.map(fT) : null, r = Array.isArray(res.r) ? res.r.map(fR) : null, enF = f(en);
    // 中文意思：翻译表给了这句自己的意思（译文改写过，SPEC §8.2 的 zh）就用它；不然用原来的中文意思，里面夹着的英语换成译文——
    // 整句、模板的空、英语原文和译文里一一对应的引号（“What time do you get up?” → “¿A qué hora te levantas?”）、名字（termOf）；
    // 换完还剩英语单词的（「thirteen 和 thirty 听起来不一样」：是讲英语的话）这句意思靠不住，不显示（packs.js 的 glossFix）
    let zh = typeof res.zh === 'string' && res.zh ? fT(res.zh) : o.zh != null ? f(String(o.zh)) : null;
    if (zh && !res.zh) {
      const pairs = (o.swap || []).concat([[enF, t]], res.sv || []);
      const qa = EchoPacks._.quotes(enF), qb = EchoPacks._.quotes(t);
      if (qa.length && qa.length === qb.length) qa.forEach((q, i) => pairs.push([q, qb[i]]));
      zh = EchoPacks._.glossFix(zh, pairs, { term: hintTerm, keep: glossKeep });
    }
    const x = { en: courseWord(typeof res.en === 'string' && res.en ? f(res.en) : enF, 'en') };
    if (seg && r && seg.length === r.length && seg.join('') === t) { x.seg = seg; x.r = r; }
    entryAdd(t, x, zh ? courseWord(zh, 'zh') : '');
    const ui = I18N ? I18N.lang() : 'zh';
    return { t, seg: x.seg || null, r: x.r || null, en: enF, zh, mean: glossC({ zh: zh ? courseWord(zh, 'zh') : '', en: x.en }) || (ui === 'zh' ? null : x.en) };
  }
  // ---------- 界面提示里夹着的英语（「📍 现在要做」、挑战馆的玩法、提示条……ENGINE.md §5 第三批）----------
  // hintTx(键, 参数)：英语课就是 I18N.t(键, 参数)，一个字不变。别的课：句子里引着的英语原句换成这门课的那一句（整句表、模板、
  // 剧情台词里引着的同一句），名字换成这门课的写法（人、地方、水晶、回声技能、道具、怪兽、招式），中文界面里不是名字的英文拿掉
  // （packs.js 的 hintFix）；引着的那句没有译文：有「键.q」就用它（不引原句的说法），没有就连引号一起拿掉——不引英语。
  // 参数原样放进去（要改的参数调用的人自己先过 hintTx / termOf）
  const HINT_CATS = ['person', 'place', 'crystal', 'skill', 'item', 'monster', 'move'];
  function hintTerm(en) {
    if (!LTAB) return null;
    for (const c of HINT_CATS) {
      const M = LTAB.M[c], v = M && Object.prototype.hasOwnProperty.call(M, en) ? M[en] : null, t = typeof v === 'string' ? v : v && v.t;
      if (t) return t;
    }
    // 这门课不翻的怪兽名（西语照英文写，SPEC §8.2）：是名字，照留
    return isMonName(en) ? en : null;
  }
  function hintLine(q) {
    if (!LTAB) return null;
    q = String(q).trim();
    const opt = { isMon: isMonName, content: v => entryOf(v) }, qm = EchoPacks._.quoteMap(LTAB), u = unfillNames(q);
    const res = EchoPacks._.lineFind(LTAB, q, opt) || (u !== q ? EchoPacks._.lineFind(LTAB, u, opt) : null);
    const t = res ? res.t : qm.get(q) || qm.get(u);
    return t ? fillNames(rivalIn(t)) : null;
  }
  function hintNames() {
    if (!LTAB) return null;
    if (LTAB.hn !== undefined) return LTAB.hn;
    const pairs = [];
    for (const c of ['person', 'place', 'crystal', 'skill', 'monster']) for (const [a, v] of Object.entries(LTAB.M[c] || {})) pairs.push([a, typeof v === 'string' ? v : v && v.t]);
    return (LTAB.hn = EchoPacks._.namesRe(pairs));
  }
  const hintFixC = s => EchoPacks._.hintFix(s, { ui: I18N ? I18N.lang() : 'zh', line: hintLine, term: hintTerm, names: hintNames(), keep: glossKeep });
  // 别的课：一句中文说明（剧情页面的 zh）里夹着的英语换成译文——pairs 是 [[英语, 译文]]，名字换成这门课的写法；
  // 换完还剩英语单词：null（调用的人换一句不引英语的说法）。英语课：原样
  const glossText = (zh, pairs) => (LANG && window.EchoPacks && EchoPacks._.glossFix ? EchoPacks._.glossFix(zh, pairs || [], { term: hintTerm, keep: glossKeep }) : zh);
  function hintTx(key, p) {
    if (!I18N) return key;
    if (!LANG || !(window.EchoPacks && EchoPacks._ && EchoPacks._.hintFix)) return I18N.t(key, p);
    const vals = [], tp = { lang: I18N.t('pk.name.' + COURSE) };   // {lang}：「键.q」的说法里用（在学的语言名）
    for (const k of Object.keys(p || {})) {
      const v = p[k];
      if (typeof v === 'number') tp[k] = v;
      else { tp[k] = '' + vals.length + ''; vals.push(v == null ? '' : String(v)); }
    }
    let r = hintFixC(I18N.t(key, tp));
    if (r.miss.length && I18N.has(key + '.q')) r = hintFixC(I18N.t(key + '.q', tp));
    return r.s.replace(/(\d+)/g, (m, i) => vals[+i]);
  }
  // 名字（人）在这门课里怎么写；对手的名字也走这里（英语课：英文原样）
  const personOf = en => termOf('person', en);
  const hashOf = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  // 代码里写死的英语，凡是「要学的人开口说的 / 要选的」（剧情的 speak / answer 页、回声技能的指令、收服念的句子、唤醒、选伙伴、学招、起名、和怪兽说话）：
  // 别的课换成这座岛（小镇）课程里的一句（kind 'sent'）或一段对话（'dlg'）——按英语原文的哈希固定挑（同一个地方每次问同一句），题面给它的意思。
  // 台词翻译表里有这句（lineOf）就用翻好的那句；没有才按 key（不给就是英语原文）的哈希挑。返回 sent：{ t, mean, q }；dlg：{ q 问, a 答, wrong, mean 问句的意思, rq }。英语课返回 null
  function learnLine(en, z, kind, key, zh) {
    if (!LANG) return null;
    const ln = kind !== 'dlg' ? lineOf(en, { zh }) : null;
    if (ln) return { t: ln.t, mean: ln.mean, q: null, tl: true };
    const zi = Math.max(0, Math.min(W.length - 1, z | 0)), w = W[zi] || W[0], L = w && (kind === 'dlg' ? w.dlgs : w.sents);
    if (!L || !L.length) return null;
    const i = hashOf(String(key || en)) % L.length, it = L[i];
    if (kind === 'dlg') { const x = glossObj(it) || {}, xq = x.q || {}; return { q: it[0], a: it[1], wrong: (it[2] || []).slice(), mean: glossC({ zh: xq.zh, en: xq.en }), rq: { kind: 'dlg', w: zi, i } }; }
    return { t: it[0], mean: meanOf(it), q: { kind: 'sent', w: zi, i } };
  }
  // ---------- 换一门课（ENGINE.md §1）----------
  // 现在能学的课：英语 + 课程包目录里有、course: true、EchoLang 认得的（中文课在中文界面里不列）。老模式只有英语
  const courseList = () => (PK() && EchoPacks.learnable ? EchoPacks.learnable() : ['en']);
  // 换成 l 这门课：那门课还没有存档就新建一份（fresh() + 现在这份存档的设置：界面语言、谁在学、学习锁、限时、音乐、画质、方向、操作方式、家长密码……；
  // 本机英语声音的名字不抄；别的课 track 固定 'level'），现在这份先存好，再交给 EchoPacks.setCourse 重新打开页面
  function courseGo(l) {
    if (!PK() || l === COURSE || !courseList().includes(l)) return false;
    const key = 'echo-island-v1' + (l === 'en' ? '' : '@' + l);
    if (!lsGet(key)) {
      const s = fresh(), keep = JSON.parse(JSON.stringify(S.settings || {}));
      delete keep.voice;
      Object.assign(s.settings, keep, { track: l === 'en' ? 'book' : 'level' });
      s.place.lang = l; s.place.who = (S.place && S.place.who) || '';
      if (l !== 'en') s.course = l;
      lsSet(key, JSON.stringify(s));
    }
    if (!RT.preStart) { flushWalk(); save(); }
    return EchoPacks.setCourse(l);
  }
  // 按能力走：对战里要开口的招式，这一回合要不要换成「听一听、点出来」（monsters.js 的 listenIfDown 问；0–1 级有几成这样，别的级别不会）
  const lvListen = () => { const pl = PLV(); return pl != null && !!window.EchoLevels && Math.random() < EchoLevels.profile(S.place.lang, pl).listen; };

  // ---------- 怪兽对战模块（monsters.js）用到的工具 ----------
  if (window.MonsterGame) {
    const api = {
      // W / WX 是 getter：别的课在 start() 之前换成 course.json 的（courseUse），各模块用的时候再读
      get S() { return S; }, get W() { return W; }, get WX() { return WX; }, RT, FATAL, SFX, MIC, STOP, SPK, src, curUnit, curIdx, revRight, revAddFree, revMiss, revPick, fadeOf, cueText,
      // 在学的语言（ENGINE.md）：lang = LANG（英语课 null，各模块看它决定走不走别的语言的路）、course 语言代码、entryOf(原文) 条目、
      // ruby(原文) 标了读音的 HTML、meanText(原文) 课程内容的意思、learnLine(英语原文, 第几岛, 'sent'|'dlg') 写死的英语换成的课程句子（§5）
      lang: LANG, course: COURSE, entryOf, ruby: t => rb(t), meanText, learnLine,
      // rubyLine(原文)：聊天里的示范句、词卡、开场白（课程的 TALK 没带读音：按课程里写过的读音标，对不上的不标；talk.js 用）
      rubyLine: t => (LANG ? rubyLine(t) : esc(t)),
      // 第二轮（TALK.md）：questLoc(委托 id) 这条委托在这门语言里的开场白、示范句、词卡（course.json 的 QUESTS；没有是 null）；
      // lexNow() 整门课的读音表（talk.js 问日语模块「这句读不读得出来」时交给它）
      // questNames(委托 id, 目标说明) 把说明里的名字换成这门课的写法（课程包给了名字表才换）
      questLoc, questNames, lexNow: () => LEX,
      // 台词翻译表（tools/course/SPEC.md §8）：lineOf(英语原文, { zh, fill, swap }) → { t, seg, r, en, zh, mean } 或 null；courseWord(意思, 'zh'|'en') 把「英语」换成在学的语言
      lineOf, courseWord,
      // 画面上的名字（SPEC §8.1）：termOf(类别, 英文) 文字、termHTML(类别, 英文) 带读音的 HTML；英语课 / 没翻：英文
      termOf, termHTML,
      // 界面提示（ENGINE.md §5 第三批）：hintTx(键, 参数) 引着的英语原句、夹着的英文名字换成这门课的（英语课就是 I18N.t）；personOf(英文名) 人名
      hintTx, personOf, glossText,
      // 单元号：英语课「Unit 3」，别的课按界面语言（world.js 挑战馆的课本门槛、「📍 现在要做」用）
      unitNo,
      // courseList() 现在能学的课、courseGo(语言) 换课（新存档、重新打开页面）：packs.js 的「学这门」、placement.js 的「选语言」用
      courseList, courseGo,
      // 2026-11-19 按能力安排（placement.js / levels.js）：unitSpan() 挑战馆的课本门槛从哪个单元数到哪个单元（world.js gymNeed）、
      // lvListen() 这一回合换不换成听音选（monsters.js）、chatLevel() 岛民按第几级说话（没做检测 / 按课本走 = null）、uiLang() 界面语言（talk.js）、
      // kidMode() 是不是「孩子」（false = 青少年 / 成人自己学）、stopSay() 停掉正在放的朗读、recognize 的第三个参数见上面
      unitSpan, lvListen, kidMode, chatLevel: () => (window.EchoPlace ? EchoPlace.chatLevel() : null), uiLang: () => S.settings.ui || 'zh',
      stopSay: () => { if (TTS.ok) speechSynthesis.cancel(); if (RT.audio) RT.audio.pause(); },
      sceneMusic,   // 盖在上面的画面（能力检测、首次设置）开 / 关时重新决定放不放音乐
      save, say, recognize, bestScore, speakMode, stopListening, primeTTS, ac, toast, openModal, closeModal, confetti,
      // savePos：大地图走了一步，只记位置（不整份存）；flush：走路攒下的现在就整份存（开战前这种要紧的时候）
      savePos, flush: () => flushWalk(), walkTouch,
      qProg, checkAch, addWrong, markToday, gainXp, renderTop, renderHome, show, goHome, goUnit, esc, wordsHTML, aiTip, gate, gateCard, gateBlock, dayLog, parentOk, music, jingle, sceneMusic,
      reduced, dayStr,
      // AI 打分用不了时（评估第 3 条）：aiDown() 现在该不该给「先跳过 / 听音选」；failHint(res) 没听到时的一行提示；
      // revLater(q 或 {en, zh}) 先跳过的题放进复习、联网后要补说；SKIP_TXT 跳过按钮上的字（按界面语言，和 world.js 的 w.aiskip 一样）
      aiDown, failHint, revLater, get SKIP_TXT() { return skipTxt(); },
      // 界面语言（i18n.js）：gloss(内容) 内容在界面语言里的意思（英语界面给 null）、label(数据) { zh, en } 名字按界面语言、meanOf(单词 / 句子条目)
      gloss, label: lbl, meanOf,
      // 大地图上的支线委托（world.js）：chatKeyBad() 聊天是不是因为密钥 / 额度聊不了（'auth' / 'quota' / ''）；
      // advBonus() 冒险限时开着没有、今天「多学换时间」换了几分钟、最多几分钟（完成委托算一个聊天目标，也换 10 分钟）
      chatKeyBad, advBonus: () => { const pi = playInfo(); return { on: pi.on, bonus: pi.bonus, max: pi.c.max || 0 }; },
      // 🆘 求助的话（tools/course/WORDS.md §8）：这门课有没有（talk.js 的聊天页有才放 🆘 按钮，按钮是 data-act="sosList"）
      helpOn: () => helpList().length > 0,
    };
    Object.assign(ACT, MonsterGame.init(api), window.EchoWorld ? EchoWorld.init(api, MonsterGame) : {}, window.EchoTalk ? EchoTalk.init(api) : {}, {
      tab: t => { S.homeTab = t.dataset.t; save(); renderHome(); window.scrollTo(0, 0); },
    });
    // 销售版的家长首次设置向导（setup.js）：Object.create 留着 api 的 S（getter，存档换了也拿到新的）
    if (window.EchoSetup) {
      Object.assign(ACT, EchoSetup.init(Object.assign(Object.create(api), {
        afterSetup, setUi, afterEdit: () => { if (!$('#home').hidden) renderHome(); },
        aiReset: () => { RT.aiBar = null; RT.aiFails = 0; RT.aiOkAt = Date.now(); refreshBars(); },
      })));
    }
    // 云端模式的账号、会员、家长同意、举报、删号（account.js）：不是云端模式时 init 只记下工具，不加按钮
    if (window.EchoAccount) Object.assign(ACT, EchoAccount.init(Object.assign(Object.create(api), { refreshBars })));
    // 课程包（packs.js）：只有课程包模式才接上（老模式不加按钮、不听下载进度）
    if (PK()) Object.assign(ACT, EchoPacks.init(Object.assign(Object.create(api), { refreshBars })));
    // 能力检测（placement.js）：和向导一样拿一份带 S 的工具
    if (window.EchoPlace) {
      Object.assign(ACT, EchoPlace.init(Object.assign(Object.create(api), {
        placeApply, placePlan, learnerPick, setUi, afterPlace,
        // 口语问答题：听写出来的话交给文字模型按这道题的评分要点判（talk.js：APK 直连 / 网页版走中转服务的 /place）；判不了返回 null
        placeJudge: (item, heard, lang) => (window.EchoTalk && EchoTalk.placeJudge ? EchoTalk.placeJudge(item, heard, lang) : Promise.resolve(null)),
      })));
    }
    // 进大地图 / 乘风之前再看一眼冒险时间（学习锁本身由 world.js 查）；断网放行的 30 分钟从第一次进去时开始算
    for (const k of ['wEnter', 'wFly']) {
      const f = ACT[k];
      if (f) ACT[k] = (t, e) => { if (advEnterOk()) f(t, e); };
    }
    // 家长换了 AI 密钥：以前「密钥不对 / 额度用完」的红条和失败次数作废（下一次识别再看）
    if (ACT.talk_cfg) { const f = ACT.talk_cfg; ACT.talk_cfg = (t, e) => { RT.aiBar = null; RT.aiFails = 0; RT.aiOkAt = Date.now(); f(t, e); refreshBars(); }; }
    // 「剧情中文」在 🔒 家长设置里：改宽松（总是显示 / 自动）要家长密码；改严（点一下才显示）不用
    if (ACT.wZhMode) {
      const zf = ACT.wZhMode, ZR = { always: 0, auto: 1, tap: 2 };
      ACT.wZhMode = (t, e) => {
        if (t.classList.contains('on')) return;
        const cur = S.settings.storyZh || 'auto', v = t.dataset.m;
        if (!(v in ZR)) return;
        if (ZR[v] > (ZR[cur] != null ? ZR[cur] : 1)) { zf(t, e); return; }
        parentOk(tr('g.ev.why.zh'), () => { zf(t, e); RT.parentOpen = true; settingsSheet(); });
      };
    }
  }

  // 安卓 APK 的返回键（android/MainActivity.java 调用）：关弹窗 → 聊天开着就「结束并评价」（评价出来了再按一次关掉）→ 回首页；
  // 已经在首页就返回 false，APK 退到后台
  window.EchoBack = () => {
    try { if (window.EchoSetup && EchoSetup.back && EchoSetup.back()) return true; } catch (e) { /* 向导出错就按老办法 */ }
    // 能力检测开着：先关它上面的弹窗（家长密码、麦克风说明），再交给它（做题时 = 暂停）
    try { if (window.EchoPlace && EchoPlace.isOpen() && $('#modal').hidden && EchoPlace.back()) return true; } catch (e) { /* 出错就按老办法 */ }
    if (!$('#modal').hidden) {
      if (RT.modalLocked) return true;   // 护眼休息这种锁着的弹窗：返回键跳不过去
      if ($('#modal [data-act=close]')) closeModal();
      return true;
    }
    try { if (window.EchoTalk && EchoTalk.endIfOpen && EchoTalk.endIfOpen()) return true; } catch (e) { /* 聊天出错就按老办法关 */ }
    const tk = $('#tk-ov'); if (tk && ACT.talk_close) { ACT.talk_close(); return true; }
    if ($('#home').hidden) { goHome(); return true; }
    flushWalk(true);   // 已经在首页：APK 接着就退到后台了
    return false;
  };

  // ---------- 每天的学习记录（周报）----------
  // 学习锁 / 冒险时间 / 家长相关的字段：gateOpen 真的做完了学习任务、gateEx 聊天这一项整天免了（noai / daily）、
  // passAt / passWhy 断网放行开始的时间和原因、gateOff 关过学习锁、clockBack 手机日期被往回调、clockReset 家长从今天重新开始、
  // night 很晚还在冒险、warn5 冒险还剩 5 分钟提醒过、stopped 冒险被叫回首页的原因、pinFail / pinLock 家长密码输错几次 / 被锁几次、
  // reset 清空过进度、pract 通关的练习关、asrN / asrSec / tipN / aiFail AI 用量和失败、sayN / saySum / spkQ / spk1 / weekN / weekOk 能力指标、
  // quests 今天在大地图上完成了几条支线委托（world.js 记；每条也算进 chatGoals）
  // （这里存的都是数字和代码，不存界面文字；周报显示时才按界面语言翻）
  function dayLog(d) {
    d = d || dayStr();
    if (!S.log) S.log = {};
    if (!S.log[d]) {
      S.log[d] = { min: 0, learn: 0, play: 0 };
      const ks = Object.keys(S.log).sort();
      while (ks.length > 45) delete S.log[ks.shift()];   // 只留最近一个多月（每周的数字另外永久存在 S.weekly）
    }
    return S.log[d];
  }
  // 玩的时间：页面在前台、最近 1 分钟内碰过屏幕才算。做题、复习、对话动画、和岛民聊天算「学习」，冒险和对战算「冒险」，
  // 首页上翻菜单（手册、队伍、商店、设置、周报）两边都不算，只算进总时间
  let lastInput = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  // 手机日期被往回调（想骗学习锁）：记下见过的最晚日期，比它早就算改过（记在今天，周报上看得到）
  function trackDay() {
    const t = dayStr();
    if (!S.maxDay || t > S.maxDay) S.maxDay = t;
    else if (t < S.maxDay) dayLog().clockBack = 1;
  }
  setInterval(() => {
    if (!S) return;
    trackDay();
    const t = dayStr();
    if (RT.day && RT.day !== t) { weeklyRoll(); if (!$('#home').hidden) renderHome(); }   // 过了半夜：学习锁、今日复习换成新的一天
    RT.day = t;
    pushTick();
    if (document.hidden) return;
    if (Date.now() - lastInput > 5 * 60e3) RT.lastRest = Date.now();   // 停下来 5 分钟以上：护眼的「连续玩了多久」重新算
    if (Date.now() - lastInput > 60000) return;
    const L = dayLog(), dt = 0.25, tk = !!document.getElementById('tk-ov');
    const learn = tk || RT.scr === 'play' || RT.scr === 'result' || RT.scr === 'theater', play = !tk && (RT.scr === 'world' || RT.scr === 'battle');
    L.min = +(L.min + dt).toFixed(2);
    if (learn) L.learn = +((L.learn || 0) + dt).toFixed(2); else if (play) L.play = +((L.play || 0) + dt).toFixed(2);
    if (play && isNight(nowD(), limitCfg())) L.night = 1;   // 很晚还在冒险（学习锁关着、或者家长没限时的时候才可能）
    if (S.settings.gate === false) L.gateOff = 1;
    if (Math.round(L.min * 4) % 4 === 0) save();   // 每分钟存一次
  }, 15000);
  setInterval(() => advTick(), 1000);   // 每秒看一眼：打完一场、说完话的那一刻就停（别让孩子接着又撞进下一场）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { RT.parentUntil = 0; return; }   // 切出去再回来：家长要重新输密码
    if (!S) return;
    if (!$('#home').hidden) renderHome();
    advTick(); pushTick();
  });

  // ---------- 学习锁：先完成今天的复习和一次英语聊天，再去怪兽冒险（家长 2026-10-07 改过，评估第 2、5 条）----------
  // 复习：今天没有要复习的，或者今天认真做完过一轮复习（答对一半以上）
  // 聊天：今天完成过一个聊天小目标，或者今天用语音说满 6 句英语（EchoTalk.today()：≥3 个英文词、不含中文；打字的不算）
  // 聊天这一项免掉的情况：
  //   - AI 聊天没开通（noai）、今天的聊天时长用完了（daily）：整天免（周报标 🟡）
  //   - 别的语言的课、服务器不会用这门语言聊（lang：老服务器、APK 直连，talkLang()）：整天免；服务器会聊就和英语课一样要聊（TALK.md §4）
  //   - 没网、聊天连上以后服务器真出错了（chatFail，talk.js 只在这种时候记）：只临时放行 30 分钟，不写 gateOpen（周报标 📵）；
  //     30 分钟从第一次进大地图开始算；联网以后回首页 / 进出大地图时重新检查（又要聊天了）
  // 真的做完了（gateOpen）当天就一直开着（冒险里答错一题不会又锁上）；手机日期被往回调时不开
  // 云端模式（公开版，account.js 的 EchoAccount.gateWhy()，2026-11-20）：AI 要登录账号才能用，规矩是「不能因为没人登录就把孩子关在冒险外面」：
  //   - 还没登录（nosign）、年龄段没选 / 13 岁以下还在等家长同意（consent）：和「AI 聊天没开通」（noai）一样，聊天这一项整天免（周报 🟡 写原因）；
  //     家长想让学习锁照样要求聊天，就登录好、同意好（登录了、同意了就和平常一样要聊）。孩子自己退出登录也能这样躲过聊天——周报上看得见是哪一天、什么原因
  //   - 今天的免费 AI 时间用完了（quota：服务器回 402，或账号里今天剩的不到开聊的 20 秒）：照中转服务的 chatDaily 办——开口说过 3 句以上整天免，不然临时放行 30 分钟
  //   - 令牌过期（401）= 没登录；不会因为「密钥不对 / 额度用完」卡住（chatKeyBad 在云端模式下不说话）
  const PASS_MIN = 30;
  const passLeft = L => (L.passAt ? Math.max(0, PASS_MIN * 60e3 - (Date.now() - L.passAt)) : PASS_MIN * 60e3);
  function talkToday() {
    try { if (window.EchoTalk && EchoTalk.today) return EchoTalk.today(); } catch (e) { /* 聊天模块出错：当成还没聊 */ }
    return { voiceLines: 0, goals: 0, typedLines: 0, need: 6, done: false };
  }
  // 聊天连不上是因为密钥不对 / 额度用完（不是没网，也不是连上以后出错）：返回 'auth' / 'quota'，没有就是 ''。
  // 这种情况学习锁不自动放行（家长要去处理），只在卡片上说清楚
  function chatKeyBad() {
    if (cloudOn()) return '';   // 云端模式没有密钥：没登录、额度用完在 gate() 里按 cloudWhy 办
    const st = aiBarState();
    if (st && st.cls === 'key' && (st.why === 'auth' || st.why === 'quota')) return st.why;
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    if (le && le.where === 'chat' && (le.why === 'auth' || le.why === 'quota') && le.at > (RT.aiOkAt || 0) && dayStr(new Date(le.at)) === dayStr()) return le.why;
    return '';
  }
  function gate() {
    const today = dayStr(), on = kidMode() && S.settings.gate !== false, L = dayLog();   // 「自己学」没有学习锁
    const back = !!(S.maxDay && today < S.maxDay);
    const due = dueList().length, revDone = due === 0 || (L.revSess || 0) > 0;
    // 别的课：服务器不会用这门语言聊（老服务器、APK 直连）→ 聊天这一项整天免（lang）；会聊就和英语课一样要做（TALK.md §4）
    const langNo = !!LANG && !talkLang();
    const tk = talkToday(), chatOn = !langNo && !!(window.EchoTalk && EchoTalk.relayUrl());
    // 今天早些时候按「这门语言聊不了」免过，现在能聊了（刚问到服务器、刚登录）：那次免的不算数了
    if (!langNo && L.gateEx === 'lang') delete L.gateEx;
    // 没网：手机说没网；或者 Wi-Fi 连着但上不了网（最近 10 分钟 AI 报过「找不到服务器」、今天聊天也没连上过）
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    const offline = navigator.onLine === false || (!!le && le.why === 'offline' && Date.now() - le.at < 10 * 60e3 && !L.chatConn);
    const cw = cloudOn() && ACC() ? ACC().gateWhy() : '';   // 云端模式：nosign / consent / quota / ''（规矩见上面）
    const chatFail = !!L.chatFail, chatDaily = !!L.chatDaily || cw === 'quota', chatDone = !!tk.done;
    // 今天的聊天时间用完了：真的开口说过 3 句以上才整天免；一直不说话把时间耗完的，只临时放行 30 分钟
    const dailyFull = chatDaily && (tk.voiceLines || 0) >= 3;
    const exWhy = chatDone ? '' : langNo ? 'lang' : !chatOn ? 'noai' : cw === 'nosign' || cw === 'consent' ? cw : dailyFull ? 'daily' : '';
    const passWhy = chatDone || exWhy ? '' : offline ? 'offline' : chatFail ? 'fail' : chatDaily ? 'daily' : '';
    // 真的做完了就记下（学习锁关着也记：周报的 ✅ 和「学习日」看这个）
    if (!back && revDone && chatDone && !L.gateOpen) L.gateOpen = 1;
    let open = !on, pass = false, passMin = 0;
    if (on && !back) {
      if (L.gateOpen) open = true;
      else if (revDone && (exWhy || L.gateEx)) { if (!L.gateEx) L.gateEx = exWhy; open = true; }
      else if (revDone && passWhy && passLeft(L) > 0) { open = true; pass = true; passMin = Math.ceil(passLeft(L) / 60e3); }
    }
    if (on && !chatOn && window.ECHO_APP) L.noChat = 1;
    const chatOk = chatDone || !!exWhy || !!L.gateEx || pass;
    return {
      on, back, due, revDone, chatOn, offline, chatDone, chatFail, chatDaily, chatOk, open, keyBad: chatOk ? '' : chatKeyBad(),
      pass, passMin, passWhy, passUsed: !!L.passAt && !open, exWhy: exWhy || L.gateEx || '',
      voice: tk.voiceLines || 0, need: tk.need || 6, goals: tk.goals || 0,
      steps: (revDone ? 0 : 1) + (chatOk ? 0 : 1),
    };
  }
  function gateCard() {
    const g = gate();
    if (!g.on) return '';
    const L = dayLog();
    const row = (ok, txt, act, btn) => '<div class="gate-row' + (ok ? ' ok' : '') + '">' + (ok ? '<span>✅</span>' : '<i class="todo"></i>') + '<b>' + txt + '</b>' + (ok || !act ? '' : '<button class="btn small" data-act="' + act + '">' + btn + '</button>') + '</div>';
    const revTxt = g.revDone ? ((L.revSess || 0) ? trh('g.gate.rev.done') : trh('g.gate.rev.none')) : trh('g.gate.rev.todo', { n: Math.min(g.due, REV_N) });
    const prog = { a: Math.min(g.voice, g.need), b: g.need };
    const chatTxt = g.chatDone ? (g.goals ? trh('g.gate.chat.goal') : trh('g.gate.chat.said', { n: g.voice }))
      : g.exWhy === 'noai' ? trh('g.gate.chat.noai')
      : g.exWhy === 'lang' ? trh('g.gate.chat.lang')
      : g.exWhy === 'nosign' || g.exWhy === 'consent' ? trh('ac.gate.' + g.exWhy) + ' <button class="link" data-act="' + (g.exWhy === 'nosign' ? 'ac_signin' : 'ac_consent') + '">' + trh(g.exWhy === 'nosign' ? 'ac.btn.signin' : 'ac.btn.consent') + '</button>'
      : g.exWhy === 'daily' ? trh('g.gate.chat.daily')
      : g.pass ? trh('g.gate.chat.pass', { r: tr('g.gate.why.' + (g.passWhy === 'offline' ? 'offline' : g.passWhy === 'daily' ? 'daily' : 'fail')), n: g.passMin })
      : g.keyBad ? trh('g.gate.chat.key', { r: tr('g.gate.key.' + (g.keyBad === 'quota' ? 'quota' : 'auth')) })
      : g.passUsed ? trh('g.gate.chat.used', { a: prog.a, b: prog.b, x: tr(g.passWhy === 'daily' || g.chatDaily ? 'g.gate.again.tmr' : 'g.gate.again.net') })
      : trh('g.gate.chat.go', prog);
    const chatGood = g.chatOk && !g.pass, done = (g.revDone ? 1 : 0) + (chatGood ? 1 : 0);
    const title = g.back ? trh('g.gate.t.back') : g.open ? (g.pass ? trh('g.gate.t.pass', { n: g.passMin }) : trh('g.gate.t.open')) : trh('g.gate.t.todo', { n: done });
    return '<section class="gate-card' + (g.open ? ' open' : '') + (g.pass ? ' pass' : '') + '"><h3>' + title + '</h3>' +
      (g.back ? '<p class="tip">' + trh('g.gate.back.tip') + '</p><button class="link" data-act="clockReset">' + trh('g.gate.back.btn') + '</button>' : '') +
      row(g.revDone, revTxt, 'review', trh('g.gate.btn.rev')) + row(chatGood, chatTxt, g.chatOn && !g.pass && !g.keyBad ? 'gateTalk' : '', trh('g.gate.btn.chat')) +
      playLine() +
      '<button class="link" data-act="report">' + trh('g.gate.report') + '</button></section>';
  }
  function gateBlock() {
    const g = gate();
    toast(g.back ? tr('g.gate.blk.back')
      : !g.revDone ? tr('g.gate.blk.rev')
      : g.keyBad ? tr('g.gate.blk.key', { r: tr('g.gate.key.' + (g.keyBad === 'quota' ? 'quota' : 'auth')) })
      : g.passUsed ? (g.chatDaily ? tr('g.gate.blk.used.daily') : tr('g.gate.blk.used'))
      : tr('g.gate.blk.chat', { need: g.need, n: Math.min(g.voice, g.need) }));
    const c = $('.gate-card');
    if (c) { c.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); }
  }

  // ---------- 冒险时间（家长 2026-10-07，评估第 18 条）----------
  // 上学日 45 分钟、周末 90 分钟（只算大地图和对战）；21:30–7:00 不能冒险；多学一点换时间：多做一轮复习 / 多完成一个聊天目标 /
  // 多通关一关新练习（或拿到更多星星），每样 +10 分钟，每天最多 +30 分钟。家长设置里能改（S.settings.limit）。
  // 只在「先学习再冒险」开着时管（家长关掉学习锁 = 今天全部放开）；新游戏还没有怪兽时（开场剧情）不管。
  // 时间到了不半路掐断：等这一场战斗 / 这段对话 / 这段剧情结束，再友好地提示、回首页。
  const LIM0 = { on: true, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 };
  const nowD = () => new Date(RT.fakeNow ? RT.fakeNow + (Date.now() - RT.fakeAt) : Date.now());   // 测试可以换掉（EchoGame.T.setNow）
  const limitCfg = () => Object.assign({}, LIM0, S.settings.limit || {});
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : -1; };
  const clockTxt = s => String(s || '').replace(/^0(\d)/, '$1');
  function isNight(d, c) {
    const f = hm(c.from), t = hm(c.to);
    if (f < 0 || t < 0 || f === t) return false;
    const m = d.getHours() * 60 + d.getMinutes();
    return f > t ? m >= f || m < t : m >= f && m < t;
  }
  function bonusMin(L, c) {
    // 聊天目标：开学习锁用掉的那一个不算。大地图上的支线委托（L.quests）是进了冒险以后才做的，每条都算多学的——
    // 就算今天的学习锁是靠「说满 6 句」开的（那时一个目标都没完成），做完第一条委托也照样换 10 分钟
    const extra = Math.max(0, (L.revSess || 0) - 1) + Math.max(L.quests || 0, (L.chatGoals || 0) - 1) + (L.pract || 0);
    return Math.min(c.max || 0, extra * 10);
  }
  function playInfo() {
    const c = limitCfg(), d = nowD(), L = dayLog(), wkend = d.getDay() === 0 || d.getDay() === 6;
    const on = kidMode() && S.settings.gate !== false && c.on !== false;   // 「自己学」不限时
    const base = wkend ? c.we : c.wd, bonus = bonusMin(L, c), left = base + bonus - (L.play || 0), night = isNight(d, c);
    return { on, base, bonus, used: Math.round(L.play || 0), left: Math.max(0, Math.ceil(left)), night, over: on && (night || left <= 0), wkend, c };
  }
  function limText(c) {
    if (c.on === false) return tr('g.adv.nolimit');
    return tr('g.adv.lim', { wd: c.wd, we: c.we }) + (hm(c.from) >= 0 ? tr('g.adv.lim.night', { a: c.from, b: clockTxt(c.to) }) : '');
  }
  // 首页学习锁卡片上的一行：还能冒险几分钟 / 时间用完了 / 太晚了
  function playLine() {
    const pi = playInfo(), c = pi.c;
    if (!pi.on || !(S.mon && S.mon.box || []).length) return '';
    const t = pi.night ? trh('g.adv.line.night', { a: c.from, b: clockTxt(c.to) })
      : pi.over ? trh('g.adv.line.over') + (pi.bonus < (c.max || 0) ? trh('g.adv.line.more') : '')
      : trh('g.adv.line.left', { n: pi.left }) + (pi.bonus ? trh('g.adv.line.bonus', { n: pi.bonus }) : '');
    return '<p class="gate-time' + (pi.over ? ' over' : '') + '">' + t + '</p>';
  }
  const advLimitWhy = () => { const pi = playInfo(); return !pi.on ? '' : pi.night ? 'night' : pi.over ? 'time' : ''; };
  // 人在大地图 / 对战里时要不要停下来：'night' 太晚了 / 'time' 时间用完 / 'pass' 断网放行的 30 分钟到了；不用停返回 ''
  function advStopWhy() {
    if (!(S.mon && S.mon.box || []).length) return '';
    const w = advLimitWhy(); if (w) return w;
    const L = dayLog();
    if (kidMode() && S.settings.gate !== false && L.passAt && !L.gateOpen && !L.gateEx && !passLeft(L) && !gate().open) return 'pass';
    return '';
  }
  // 进大地图 / 乘风之前（包在 world.js 的 wEnter / wFly 外面）：学习锁开着、但时间用完或者太晚了 → 友好提示，不进；
  // 断网放行的 30 分钟从这里开始算。学习锁本身没开的由 world.js 自己拦（gateBlock）
  function advEnterOk() {
    if (!(S.mon && S.mon.box || []).length) return true;
    const g = gate();
    if (!g.on || !g.open || g.back) return true;
    const why = advLimitWhy();
    if (why) { stopSheet(why, true); return false; }
    if (g.pass && !dayLog().passAt) {
      const L = dayLog(); L.passAt = Date.now(); L.passWhy = g.passWhy; save();
      toast(tr('g.adv.pass.toast', { r: tr('g.adv.pass.' + (g.passWhy === 'offline' ? 'offline' : g.passWhy === 'daily' ? 'daily' : 'fail')), n: PASS_MIN }));
    }
    return true;
  }
  function stopSheet(why, entering) {
    const pi = playInfo(), c = pi.c;
    const more = (c.max || 0) - pi.bonus;
    const H = {
      night: ['🌙', trh('g.adv.stop.night.h'), trh('g.adv.stop.night.p', { a: c.from, b: clockTxt(c.to) })],
      time: ['⏰', trh('g.adv.stop.time.h'), trh(entering ? 'g.adv.stop.time.in' : 'g.adv.stop.time.out', { n: pi.used })],
      pass: ['📵', trh('g.adv.stop.pass.h'), trh('g.adv.stop.pass.p', { n: PASS_MIN })],
    }[why] || ['⏰', trh('g.adv.stop.def'), ''];
    openModal('<div class="big">' + H[0] + '</div><h2>' + H[1] + '</h2><p>' + H[2] + '</p>' +
      (why === 'time' && more > 0 ? '<p class="tip">' + trh('g.adv.stop.more', { n: more }) + '</p>' : '') +
      '<button class="btn wide" data-act="close" data-focus>' + trh('g.adv.ok') + '</button>');
  }
  // 大地图里现在空着吗（没在说话、没在播剧情、没有弹窗、没在和岛民聊天）
  function worldIdle() {
    if (!$('#modal').hidden || document.getElementById('tk-ov')) return false;
    const box = document.getElementById('w-dlg'); if (box && !box.hidden) return false;
    try {
      if (window.EchoWorld && typeof EchoWorld.idle === 'function') return !!EchoWorld.idle();   // world.js 以后给了正式接口就用它
      const d = window.EchoWorld && EchoWorld._debug && EchoWorld._debug(); if (d && (d.dlg || d.busy)) return false;
    } catch (e) { return false; }
    return true;
  }
  // 每秒看一眼：冒险快到时间提醒一次；该停了就等这场战斗 / 对话结束，再回首页；连续玩久了，打完一场提醒护眼
  function advTick() {
    if (!S) return;
    if (RT.scr !== 'world' && RT.scr !== 'battle') { RT.advStop = ''; return; }
    const pi = playInfo(), L = dayLog();
    if (pi.on && !pi.over && pi.left <= 5 && !L.warn5) { L.warn5 = 1; toast(tr('g.adv.warn5')); }
    if (!RT.advStop) RT.advStop = advStopWhy();
    if (RT.scr !== 'world' || !worldIdle()) return;
    if (RT.advStop) {
      const why = advStopWhy(); RT.advStop = '';
      if (!why) return;   // 等的时候情况变了（比如家长刚放宽了时间）
      L.stopped = why; save();
      goHome('mon');
      stopSheet(why, false);
      return;
    }
    if (RT.battleEnd && Date.now() - RT.battleEnd < 8000 && Date.now() - RT.lastRest > 35 * 60e3) { RT.battleEnd = 0; restModal(); }
  }
  function limitSheet() {
    const c = limitCfg();
    const seg = (k, list, fmt) => '<div class="seg wrap">' + list.map(v => '<button class="' + (String(c[k]) === String(v) ? 'on' : '') + '" data-act="limSet" data-k="' + k + '" data-v="' + v + '">' + fmt(v) + '</button>').join('') + '</div>';
    const mins = v => trh('g.adv.min', { n: v });
    openModal('<h2>' + trh('g.adv.sheet.h') + '</h2><p>' + trh('g.adv.sheet.p') + '</p>' +
      '<div class="set"><label>' + trh('g.adv.sheet.on') + '</label><div class="seg"><button class="' + (c.on ? 'on' : '') + '" data-act="limSet" data-k="on" data-v="1">' + trh('g.adv.sheet.lim') + '</button><button class="' + (c.on ? '' : 'on') + '" data-act="limSet" data-k="on" data-v="0">' + trh('g.adv.nolimit') + '</button></div></div>' +
      (c.on ? '<div class="set"><label>' + trh('g.adv.sheet.wd') + '</label>' + seg('wd', [30, 45, 60, 90, 120], mins) + '</div>' +
        '<div class="set"><label>' + trh('g.adv.sheet.we') + '</label>' + seg('we', [45, 60, 90, 120, 180], mins) + '</div>' +
        '<div class="set"><label>' + trh('g.adv.sheet.from') + '</label>' + seg('from', ['20:30', '21:00', '21:30', '22:00', ''], v => v || trh('g.adv.sheet.any')) + '</div>' +
        '<div class="set"><label>' + trh('g.adv.sheet.to') + '</label>' + seg('to', ['06:30', '07:00', '07:30', '08:00'], clockTxt) + '</div>' +
        '<div class="set"><label>' + trh('g.adv.sheet.max') + '</label>' + seg('max', [0, 30, 60], v => v ? trh('g.adv.sheet.plus', { n: v }) : trh('g.adv.sheet.none')) + '<small>' + trh('g.adv.sheet.small') + '</small></div>' : '') +
      '<button class="btn wide" data-act="setBack" data-focus>' + trh('g.adv.sheet.done') + '</button>');
  }

  // ---------- 家长密码（家长 2026-10-07，评估第 4 条）----------
  // APK：密码打包时写在 echo.properties 的 PARENT_PIN，原生只存加盐哈希：EchoNative.hasPin() / checkPin(pin) / pinStatus()，
  //      错 5 次锁 10 分钟（原生管，换时间也没用）。安装包里没有密码时一律拒绝（不再「谁先点谁设」）。
  // 网页版（没有原生桥）：沿用 S.settings.pin，第一次要用时由家长设；错 5 次锁 10 分钟（S.settings.pinLock）。
  // 输入用自己画的数字键盘，显示 ●。输对以后 2 分钟内、这个弹窗没关之前，接着改别的不用再输（RT.parentUntil）。
  // parentOk(why, onOk)：
  //   - 给了 onOk（推荐）：要输密码就弹键盘、马上返回 false，输对了调 onOk()；不用输（刚输过）就直接调 onOk() 并返回 true。
  //   - 没给 onOk（talk.js 的老写法 `if (!G.parentOk('…')) return;`）：弹键盘、返回 false；输对以后把刚才点的那个按钮
  //     （data-act）再执行一次，这一次 parentOk 返回 true。
  const PIN_TRIES = 5, PIN_LOCK = 10 * 60e3;
  const nativePin = () => { try { return !!(window.EchoNative && typeof EchoNative.hasPin === 'function'); } catch (e) { return false; } };
  // 销售版的 APK（EchoNative.setPin）：打包时没有密码，家长在首次设置向导里设、在家长设置里改（sales = true）
  const salesPin = () => !!(window.DEX && DEX.sales) && nat('setPin');
  function pinState() {
    if (nativePin()) {
      let st = {}, has = false;
      try { has = !!EchoNative.hasPin(); st = JSON.parse(EchoNative.pinStatus ? EchoNative.pinStatus() : '{}') || {}; } catch (e) { /* 读不到就当没锁 */ }
      return { native: true, sales: salesPin(), has, locked: !!st.locked, waitSec: st.waitSec || 0, triesLeft: st.triesLeft != null ? st.triesLeft : PIN_TRIES, lockouts: st.lockouts || 0 };
    }
    const lk = S.settings.pinLock || {}, wait = Math.max(0, (lk.until || 0) - Date.now());
    return { native: false, sales: false, has: /^\d{4}$/.test(S.settings.pin || ''), locked: wait > 0, waitSec: Math.ceil(wait / 1000), triesLeft: wait > 0 ? 0 : PIN_TRIES - (lk.n || 0), lockouts: lk.lockouts || 0 };
  }
  // 存新的家长密码：APK 交给原生（只有销售版能设，存加盐哈希；改密码要刚输对过），网页版存在存档里
  function pinSave(v) {
    if (nativePin()) { try { return salesPin() && !!EchoNative.setPin(v); } catch (e) { return false; } }
    S.settings.pin = v; S.settings.pinLock = { n: 0, until: 0, lockouts: (S.settings.pinLock || {}).lockouts || 0 }; save();
    return true;
  }
  function parentOk(why, onOk) {
    const now = Date.now();
    // 「自己学」（青少年 / 成人）：没有家长这一层，不问密码（从「孩子」换成「自己学」那一下要密码，见 setLearner / learnerPick）
    if (!kidMode()) { if (onOk) onOk(); return true; }
    // 刚输过密码：只在那个家长弹窗（设置页）还开着时算数——弹窗关了、或者根本没弹窗，就要重新输
    if ((now < RT.parentUntil && !$('#modal').hidden) || (RT.pinPass && RT.pinPass.why === why && now < RT.pinPass.until)) {
      RT.pinPass = null;
      if (RT.parentUntil) RT.parentUntil = now + 2 * 60e3;
      if (onOk) onOk();
      return true;
    }
    const st = pinState();
    if (st.native && !st.has && st.sales) { pinPad(why, onOk, 'set1', !onOk && RT.lastAct && now - RT.lastAct.t < 2000 ? RT.lastAct : null); return false; }   // 销售版还没设密码（向导没做完）：现在设
    if (st.native && !st.has) {
      openModal('<div class="big">🔑</div><h2>' + trh('g.pin.none.h') + '</h2><p>' + trh('g.pin.none.p', { w: why || tr('g.pin.this') }) + '</p>' +
        '<p class="tip">' + trh('g.pin.none.tip') + '</p><button class="btn wide" data-act="close" data-focus>' + trh('g.ok') + '</button>');
      return false;
    }
    const redo = !onOk && RT.lastAct && now - RT.lastAct.t < 2000 ? RT.lastAct : null;
    pinPad(why, onOk, st.has ? 'check' : 'set1', redo);
    return false;
  }
  function pinPad(why, onOk, mode, redo) {
    RT.pin = { why: why || '', onOk: onOk || null, redo: redo || null, mode: mode || 'check', buf: '', first: '', msg: mode === 'set1' && !pinState().has ? tr('g.pin.first') : '' };
    pinRender();
  }
  function pinRender(shake) {
    const p = RT.pin; if (!p) return;
    const st = pinState(), locked = p.mode === 'check' && st.locked;
    if (locked) p.msg = tr('g.pin.locked', { n: Math.max(1, Math.ceil(st.waitSec / 60)) });
    const t = p.mode === 'set1' ? trh('g.pin.t.set1') : p.mode === 'set2' ? trh('g.pin.t.set2') : trh('g.pin.t.check');
    const dis = locked ? ' disabled' : '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(k =>
      k === 'clr' ? '<button class="pin-k fn" data-act="pinClr"' + dis + '>' + trh('g.pin.clr') + '</button>'
        : k === 'del' ? '<button class="pin-k fn" data-act="pinDel" aria-label="' + trh('g.pin.del') + '"' + dis + '>⌫</button>'
          : '<button class="pin-k" data-act="pinKey" data-k="' + k + '"' + dis + '>' + k + '</button>').join('');
    openModal('<div class="pin"><div class="pin-ico">🔒</div><h2>' + trh('g.pin.h') + '</h2>' + (p.why ? '<p class="pin-why">' + esc(p.why) + '</p>' : '') +
      '<p class="pin-t">' + t + '</p><div class="pin-dots' + (shake ? ' shake' : '') + '" id="pin-dots"></div><p class="pin-msg" id="pin-msg"></p>' +
      '<div class="pin-pad" id="pin-pad">' + keys + '</div></div><button class="btn ghost wide" data-act="close">' + trh('g.cancel') + '</button>');
    pinUpd();
  }
  function pinUpd() {
    const p = RT.pin, d = $('#pin-dots'), m = $('#pin-msg');
    if (!p || !d) return;
    d.innerHTML = range(4).map(i => '<i class="' + (i < p.buf.length ? 'on' : '') + '">' + (i < p.buf.length ? '●' : '○') + '</i>').join('');
    d.setAttribute('aria-label', tr('g.pin.typed', { n: p.buf.length }));
    if (m) m.textContent = p.msg || '';
  }
  function pinKey(k) {
    const p = RT.pin;
    if (!p || !/^\d$/.test(k) || p.buf.length >= 4 || p.busy) return;
    if (p.mode === 'check' && pinState().locked) { pinRender(true); return; }
    p.buf += k; p.msg = ''; pinUpd();
    if (p.buf.length === 4) { p.busy = true; setTimeout(() => { p.busy = false; if (RT.pin === p) pinDone(); }, 150); }
  }
  function pinDone() {
    const p = RT.pin; if (!p || p.buf.length < 4) return;
    const v = p.buf; p.buf = '';
    if (p.mode === 'set1') {
      // 销售版：太好猜的密码（1111、1234……）不要
      if (window.DEX && DEX.sales && (/^(\d)\1{3}$/.test(v) || '0123456789'.includes(v) || '9876543210'.includes(v))) { p.msg = tr('g.pin.weak'); pinRender(true); return; }
      p.first = v; p.mode = 'set2'; p.msg = ''; pinRender(); return;
    }
    if (p.mode === 'set2') {
      if (v !== p.first) { p.mode = 'set1'; p.first = ''; p.msg = tr('g.pin.diff'); pinRender(true); return; }
      if (!pinSave(v)) { RT.pin = null; closeModal(); toast(tr('g.pin.nosave')); return; }
      toast(tr('g.pin.saved'));
      pinGrant(p); return;
    }
    const r = pinCheck(v);
    if (r.ok) { pinGrant(p); return; }
    p.msg = r.locked ? tr('g.pin.locked', { n: r.min }) : tr('g.pin.wrong', { n: r.left });
    pinRender(true);
  }
  // 核对密码；输错记进今天的日志（周报「家长密码输错几次、被锁几次」）
  function pinCheck(v) {
    const L = dayLog();
    if (nativePin()) {
      const before = pinState();
      if (before.locked) return { ok: false, locked: true, min: Math.max(1, Math.ceil(before.waitSec / 60)) };
      let ok = false;
      try { ok = !!EchoNative.checkPin(v); } catch (e) { ok = false; }
      if (ok) return { ok: true };
      L.pinFail = (L.pinFail || 0) + 1;
      const st = pinState();
      if (st.locked) { L.pinLock = (L.pinLock || 0) + 1; save(); return { ok: false, locked: true, min: Math.max(1, Math.ceil(st.waitSec / 60)) }; }
      save();
      return { ok: false, left: st.triesLeft };
    }
    const lk = S.settings.pinLock = Object.assign({ n: 0, until: 0, lockouts: 0 }, S.settings.pinLock);
    if (lk.until > Date.now()) return { ok: false, locked: true, min: Math.max(1, Math.ceil((lk.until - Date.now()) / 60e3)) };
    if (v === S.settings.pin) { lk.n = 0; save(); return { ok: true }; }
    lk.n++; L.pinFail = (L.pinFail || 0) + 1;
    if (lk.n >= PIN_TRIES) { lk.n = 0; lk.until = Date.now() + PIN_LOCK; lk.lockouts++; L.pinLock = (L.pinLock || 0) + 1; save(); return { ok: false, locked: true, min: PIN_LOCK / 60e3 }; }
    save();
    return { ok: false, left: PIN_TRIES - lk.n };
  }
  function pinGrant(p) {
    closeModal();
    RT.parentUntil = Date.now() + 2 * 60e3;   // 2 分钟内、弹窗没关之前，接着改别的不用再输
    // 做完以后没有弹窗开着（比如「从今天重新开始」直接回首页、换密钥用的是系统输入框）：家长这一次就结束了，
    // 不留 2 分钟的空窗给孩子接着点
    const done = () => { if ($('#modal').hidden) RT.parentUntil = 0; };
    if (p.onOk) { try { p.onOk(); } finally { done(); } return; }
    const f = p.redo && ACT[p.redo.act];
    // 找不到刚才的按钮：只放行「同一件事」30 秒（再点一次那个按钮），别的家长设置照样要密码
    if (!f) { RT.parentUntil = 0; RT.pinPass = { why: p.why, until: Date.now() + 30e3 }; toast(tr('g.pin.again')); return; }
    RT.pinPass = { why: p.why, until: Date.now() + 5000 };
    try { f(p.redo.el); } finally { RT.pinPass = null; done(); }
  }

  // ---------- 学习周报（孩子截图发给家长；家长 2026-10-07：要看得出能力有没有进步、要讲实话，评估第 12 条）----------
  // [英文, 意思]：意思在英语界面是 null（不显示）；中文界面没有意思是空串
  function revText(e) {
    if (e.k === 'free') return [e.en, meanTxt(e)];
    const w = WX[e.w], it = w && (e.k === 'word' ? w.words[e.i] : e.k === 'sent' ? w.sents[e.i] : w.dlgs[e.i]);
    if (!it) return ['', meanTxt(null)];
    return e.k === 'dlg' ? [tr('g.rp.dlg', { q: it[0], a: it[1] }), ''] : [it[0], meanTxt(it)];
  }
  const r1 = x => Math.round(x * 10) / 10;
  const pct = x => (x == null ? null : Math.round(x * 100));
  // 日期写成「月/日」（中文界面 11/13）；别的界面语言 13 Nov
  const rawArr = k => (I18N ? I18N.raw(k) : []) || [];
  const mdTxt = d => tr('g.rp.md', { mon: rawArr('g.rp.mon')[+d.slice(5, 7) - 1], dd: d.slice(8, 10) });
  // 固定用中文写的（存进出错记录的那种，以后看还是同一句）
  const trz = k => (I18N ? I18N.t(k, null, 'zh') : k);
  // 最近 n 天的日期（最后一天是今天）
  const daysBack = n => range(n).map(k => { const d = new Date(); d.setDate(d.getDate() - (n - 1) + k); return dayStr(d); });
  // AI 花费估算（元）：单价按阿里云百炼的公开价估（会变，只让家长心里有数）。实时聊天（其中音频另算）和文字模型的 token
  // 只有 APK 直连时数得到（talk.js 记的）；口语识别按秒算（recognize 记的 asrSec）。
  // 实时聊天 qwen3.8-omni-flash-realtime 北京区（2026-10-07 在阿里云官网复核）：每百万 token 文本输入 ¥1.5、输出 ¥4.5，音频输入 ¥6、输出 ¥12；
  // 文字模型（评价、打勾、翻译、点评）qwen-plus 每百万 token 输入 ¥0.8、输出 ¥2
  const PRICE = { chatIn: 0.0015, chatAudioIn: 0.006, chatOut: 0.0045, chatAudioOut: 0.012, textIn: 0.0008, textOut: 0.002, asrSec: 0.00022 };   // 元 / 千 token、元 / 秒
  function aiCost(sum) {
    const ain = sum('aiChatAudioIn'), aout = sum('aiChatAudioOut');
    return (Math.max(0, sum('aiChatIn') - ain) * PRICE.chatIn + ain * PRICE.chatAudioIn + Math.max(0, sum('aiChatOut') - aout) * PRICE.chatOut + aout * PRICE.chatAudioOut +
      sum('aiTextIn') * PRICE.textIn + sum('aiTextOut') * PRICE.textOut) / 1000 + sum('asrSec') * PRICE.asrSec;
  }
  // 一段日子的统计：学习日（✅ 真做完 + 🟡 聊天整天免了）、能力指标（每句几个词、一次说对率、隔一周还记得）、AI 花费
  function weekStats(days) {
    const L = days.map(d => (S.log && S.log[d]) || null), has = L.filter(Boolean);
    const sum = k => has.reduce((a, x) => a + (+x[k] || 0), 0);
    const ratio = (a, b) => (b ? a / b : null);
    return {
      L, sum, n: k => has.filter(x => x[k]).length,
      study: has.filter(x => x.gateOpen || x.gateEx).length,
      wpl: ratio(sum('voiceWords'), sum('voiceLines')),
      first: ratio(sum('spk1'), sum('spkQ')),
      week: ratio(sum('weekOk'), sum('weekN')),
      cost: aiCost(sum),
    };
  }
  // 每天的标记：✅ 学习任务真做完了 🟡 聊天这一项整天免了 📵 断网放行 🔓 关过学习锁 ⏰ 手机日期被改过 / 家长重设 🌙 很晚还在冒险
  const dayMarks = x => (x.gateOpen ? '✅' : x.gateEx ? '🟡' : '') + (x.passAt ? '📵' : '') + (x.gateOff ? '🔓' : '') + (x.clockBack || x.clockReset ? '⏰' : '') + (x.night ? '🌙' : '');
  // 聊天这一项为什么免了（日志里存的是代码 noai / daily，显示时按界面语言翻）
  const EX_TXT = { get noai() { return tr('g.rp.ex.noai'); }, get lang() { return tr('g.rp.ex.lang'); }, get daily() { return tr('g.rp.ex.daily'); }, get nosign() { return tr('ac.rp.ex.nosign'); }, get consent() { return tr('ac.rp.ex.consent'); } };
  const arrow = (a, b, eps) => (a == null || b == null ? '' : a > b + eps ? '<i class="up">↑</i>' : a < b - eps ? '<i class="dn">↓</i>' : '<i class="eq">→</i>');
  // 诊断一行：AI 失败几次（没网 / 密钥和额度）、聊天连不上几天、程序出错几条（EchoErr）、画面重开过几次（原生 diag）、版本号
  function diagLine(W0) {
    const fails = W0.sum('aiFail'), chatErr = W0.n('chatErr'), errs = window.EchoErr ? EchoErr.count(7) : 0;
    let gone = 0; try { if (nat('diag')) gone = +(JSON.parse(EchoNative.diag() || '{}').renderGone || 0); } catch (e) { /* 老版本的原生没有 diag() */ }
    return tr('g.rp.dg.ai', { n: fails }) + (fails ? tr('g.rp.dg.aiwhy', { a: W0.sum('aiNet'), b: W0.sum('aiKey') }) : '') + (chatErr ? tr('g.rp.dg.chat', { n: chatErr }) : '') +
      tr('g.rp.dg.err', { n: errs }) + (W0.sum('glLost') ? tr('g.rp.dg.gl', { n: W0.sum('glLost') }) : '') + (gone ? tr('g.rp.dg.gone', { n: gone }) : '') + srDiag(W0) + ' · ' + verText();
  }
  // iPhone 的本机识别用过才有这一截：本机 / 云端各几次、本机说完到出分平均几秒（srDay 记的）
  function srDiag(W0) {
    const a = W0.sum('srDev'), n = W0.sum('srLagN');
    if (!a || !window.EchoTalk || !EchoTalk.srText) return '';
    return EchoTalk.srText('rp', { a, b: W0.sum('srCloud'), s: n ? (W0.sum('srLag') / n / 1000).toFixed(1) : '–' });
  }
  function reportSheet() {
    weeklyRoll();
    const days = daysBack(7), W0 = weekStats(days), W1 = weekStats(daysBack(14).slice(0, 7));
    const L = W0.L.map(x => x || {}), sum = W0.sum;
    const first = Object.keys(S.log || {}).sort()[0] || days[6];
    const maxMin = Math.max(20, ...L.map(x => x.min || 0));
    const wk = rawArr('g.rp.wd');
    const heavy = x => (x.play || 0) >= 30 && (x.play || 0) > 3 * (x.learn || 0);   // 冒险超过学习的 3 倍
    const bars = days.map((d, k) => {
      const x = L[k], lh = (x.learn || 0) / maxMin * 100, ph = (x.play || 0) / maxMin * 100, other = Math.max(0, (x.min || 0) - (x.learn || 0) - (x.play || 0)) / maxMin * 100, dt = new Date(d.replace(/-/g, '/'));
      return '<div class="rp-day"><em>' + (dayMarks(x) || '&nbsp;') + '</em><div class="rp-bar"><i class="o" style="height:' + other + '%"></i><i class="p" style="height:' + ph + '%"></i><i class="l" style="height:' + lh + '%"></i></div>' +
        '<b' + (heavy(x) ? ' class="warn" title="' + trh('g.rp.heavy.tip') + '"' : '') + '>' + (d < first ? '–' : Math.round(x.min || 0)) + '</b><small>' + (k === 6 ? trh('g.rp.today') : trh('g.rp.dow', { d: wk[dt.getDay()] })) + '</small></div>';
    }).join('');
    const t0 = new Date(days[0].replace(/-/g, '/')).getTime();
    const chats = ((S.talk && S.talk.log) || []).filter(r => r.t >= t0);
    const rated = chats.filter(r => r.eval), avg = rated.length ? (rated.reduce((a, r) => a + r.eval.stars, 0) / rated.length).toFixed(1) : '';
    const chatMin = Math.round(chats.reduce((a, r) => a + (r.sec || 0), 0) / 60);
    const tips = []; chats.forEach(r => (r.eval && r.eval.tips || []).forEach(t => { if (tips.length < 3 && !tips.some(x => x.better === t.better)) tips.push(t); }));
    const items = Object.values(S.rev.items), mastered = revMastered();
    const top = items.filter(e => e.x > 1 && e.due).sort((a, b) => b.x - a.x).slice(0, 4).map(e => { const [en, zh] = revText(e); return en ? '<li><b>' + esc(en) + '</b> <small>' + (zh == null ? esc(tr('g.rp.miss', { n: e.x }).slice(3)) : esc(zh) + esc(tr('g.rp.miss', { n: e.x }))) + '</small></li>' : ''; }).join('');
    const cu = curUnit(), cwi = cu ? NB + curIdx() : -1, ustars = cu ? range(7).reduce((a, l) => a + (S.stars[cwi + '-' + l] || 0), 0) : 0;
    const name = S.player && S.player.name;
    const exWhy = [...new Set(L.filter(x => x.gateEx).map(x => EX_TXT[x.gateEx] || x.gateEx))].join(tr('g.ev.sep'));
    const heavyN = L.filter(heavy).length, nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    const flags = [
      W0.n('gateOff') ? tr('g.rp.f.off', { n: W0.n('gateOff') }) : '',
      W0.n('clockBack') ? tr('g.rp.f.back') : '',
      W0.n('clockReset') ? tr('g.rp.f.reset') : '',
      W0.n('passAt') ? tr('g.rp.f.pass', { n: W0.n('passAt') }) : '',
      W0.n('gateEx') ? tr('g.rp.f.ex', { n: W0.n('gateEx'), why: exWhy }) : '',
      W0.n('night') ? tr('g.rp.f.night', { n: W0.n('night') }) : '',
      heavyN ? tr('g.rp.f.heavy', { n: heavyN }) : '',
      sum('pinFail') ? tr('g.rp.f.pin', { n: sum('pinFail') }) + (sum('pinLock') ? tr('g.rp.f.pinlock', { n: sum('pinLock') }) : '') : '',
      W0.n('reset') ? tr('g.rp.f.cleared') : '',
      W0.n('restore') ? tr('g.rp.f.restored') : '',
      window.ECHO_APP && !(window.EchoTalk && EchoTalk.relayUrl()) ? tr('g.rp.f.noai') : '',
      // AI 打分用不了（评估第 3 条）：额度 / 密钥出问题的天数、没网的天数、先跳过了几题、麦克风被拒
      W0.n('aiKey') ? tr('g.rp.f.key', { n: W0.n('aiKey') }) : '',
      W0.n('aiNet') ? tr('g.rp.f.net', { n: W0.n('aiNet') }) : '',
      sum('aiSkip') ? tr('g.rp.f.skip', { n: sum('aiSkip') }) : '',
      sum('micDeny') ? tr('g.rp.f.mic', { n: sum('micDeny') }) : '',
    ].filter(Boolean).join(' · ');
    const pctS = x => (x == null ? '–' : pct(x) + '%');
    const ability = trh('g.rp.ab.a' + CH, { n: W0.wpl == null ? '–' : r1(W0.wpl) }) + arrow(W0.wpl, W1.wpl, 0.2) +
      trh('g.rp.ab.b', { n: pctS(W0.first) }) + arrow(pct(W0.first), pct(W1.first), 2) + trh('g.rp.ab.c', { n: pctS(W0.week) }) + arrow(pct(W0.week), pct(W1.week), 2) + '</p>';
    const maxW = Math.max(0, ...L.map(x => x.voiceMax || 0));
    const habit = trh('g.rp.hb.a', { n: sum('recall') }) + (sum('recallW') ? trh('g.rp.hb.w', { n: sum('recallW') }) : '') + trh('g.rp.hb.say', { h: sum('aided'), n: sum('voiceLines') }) + (maxW ? trh('g.rp.hb.max' + CH, { n: maxW }) : '') +
      (sum('chatSaidZh') ? trh('g.rp.hb.zh', { n: sum('chatSaidZh') }) : '') + trh('g.rp.hb.look', { a: sum('chatZh') + sum('zhTaps'), b: sum('chatHelp') }) + '</p>';
    const hist = (S.weekly || []).slice(-6);
    const histLine = hist.length >= 2 ? trh('g.rp.hist', { a: hist.map(r => r.d).join(' · '), b: hist.map(r => r.rc || 0).join(' · ') }) : '';
    const cost = W0.cost, costTxt = cost <= 0 ? '0' : cost < 0.01 ? tr('g.rp.cost.lt') : cost.toFixed(2);
    const tile = (n, t) => '<div class="rp-tile"><b>' + n + '</b><small>' + t + '</small></div>';
    openModal('<div class="report"><h2>📊 ' + (name ? trh('g.rp.title.n', { name }) : trh('g.rp.title.me')) + '</h2>' +
      '<p class="rp-sub">' + trh('g.rp.sub', { a: mdTxt(days[0]), b: mdTxt(days[6]), n: W0.study }) + (first > days[0] ? trh('g.rp.since', { d: mdTxt(first) }) : '') + '</p>' +
      (flags ? '<p class="rp-warn">' + esc(flags) + '</p>' : '') +
      (nc ? '<p class="rp-warn rp-concern">' + trh('g.rp.concern', { n: nc }) + '</p>' : '') +
      '<div class="rp-chart">' + bars + '</div><p class="rp-legend">' + trh('g.rp.legend', { a: Math.round(sum('learn')), b: Math.round(sum('play')) }) + '</p>' +
      ability +
      '<div class="rp-tiles">' + tile(Math.max(0, sum('levels') - sum('revSess')), trh('g.rp.t.levels')) + tile(sum('spoken'), trh('g.rp.t.spoken')) + tile(sum('review'), trh('g.rp.t.review')) +
      tile(chats.length, trh('g.rp.t.chat', { m: chatMin }) + (avg ? ' · ' + avg + '★' : '')) + tile(sum('fresh'), trh('g.rp.t.fresh')) + tile(mastered, trh('g.rp.t.mastered')) + '</div>' +
      habit +
      (cu ? trh('g.rp.cu', { u: cu.bshort + ' ' + unitNo(cu.n) + ' ' + cu.en, s: ustars, n: sum('wrongs') }) : '') +
      '<div class="rp-more">' +
      (top ? '<h3>' + trh('g.rp.top') + '</h3><ul class="rp-list">' + top + '</ul>' : '') +
      (tips.length ? '<h3>' + trh('g.rp.tips') + '</h3><ul class="rp-list">' + tips.map(t => '<li><s>' + esc(t.said) + '</s> → <b>' + esc(t.better) + '</b></li>').join('') + '</ul>' : '') +
      histLine +
      '</div><p class="rp-diag">' + trh('g.rp.cost', { c: costTxt }) + (window.ECHO_APP ? '' : trh('g.rp.cost.web')) + ' · 🔧 ' + esc(diagLine(W0)) + '</p>' +
      '<div class="rp-end"><span>' + trh('g.rp.end') + '</span><button class="btn small ghost" data-act="close">' + trh('g.close') + '</button></div></div>');
  }

  // ---------- 每周一行，永久保留（S.weekly）----------
  // S.log 只留 45 天；每周（周一到周日）的关键数字压成一行存进 S.weekly，三年也就一百多行。过完的周算一次就不再改（那时 7 天的记录都还在）。
  // 一行：w 周一的日期、d 学习日、l 学习分钟、p 冒险分钟、lv 完成关卡、s 开口说对、r 复习答对、rc 不看字说对、a 带提示、v 聊天语音句数、
  // g 聊天目标、wpl 每句几个词、f1 一次说对 %、wk 隔一周还记得 %、pass 断网放行天数、off 关锁天数、y AI 花费（元）、m 累计掌握、fin 这周过完了、part 这周的记录不全
  function weekStart(d) { const x = new Date(d.replace(/-/g, '/')); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dayStr(x); }
  function weekRow(ws) {
    const days = range(7).map(k => { const x = new Date(ws.replace(/-/g, '/')); x.setDate(x.getDate() + k); return dayStr(x); });
    const st = weekStats(days), s = st.sum;
    return {
      w: ws, d: st.study, l: Math.round(s('learn')), p: Math.round(s('play')), lv: Math.max(0, s('levels') - s('revSess')), s: s('spoken'), r: s('review'),
      rc: s('recall'), a: s('aided'), v: s('voiceLines'), g: s('chatGoals'), wpl: st.wpl == null ? null : r1(st.wpl), f1: pct(st.first), wk: pct(st.week),
      pass: st.n('passAt'), off: st.n('gateOff'), y: +st.cost.toFixed(2),
    };
  }
  function weeklyRoll() {
    if (!Array.isArray(S.weekly)) S.weekly = [];
    const today = dayStr(), cur = weekStart(today), logDays = Object.keys(S.log || {}).filter(d => d <= today).sort();
    for (const ws of new Set(logDays.map(weekStart))) {
      const i = S.weekly.findIndex(r => r.w === ws), old = i >= 0 ? S.weekly[i] : null;
      if (old && old.fin) continue;
      const row = weekRow(ws);
      if (logDays[0] > ws) row.part = 1;
      if (ws < cur) { row.fin = 1; if (old && old.m != null) row.m = old.m; }
      else row.m = revMastered();
      if (old) S.weekly[i] = row; else S.weekly.push(row);
    }
    S.weekly.sort((a, b) => a.w.localeCompare(b.w));
  }

  // ---------- 学习日报推送到家长微信（可选，默认不发；家长 2026-10-07，评估第 12 条）----------
  // 家长设置里填 PushPlus 的 token（32 位），或者企业微信群机器人的 webhook 地址（改要家长密码）。每天 20 点以后发一条当天的小结；
  // 没网 / 那天晚上没开游戏，就等下次打开时补发（第二天早上补前一天的）。聊天内容不发，有安全标记的聊天只提示一句。
  // 原生桥以后加了 pushPost(url, body, type)（只许连这两个地址）就走原生；现在用 fetch（no-cors：看不到回执，发出去就算）
  function pushKind(v) {
    v = String(v || '').trim();
    if (/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[\w-]+$/.test(v)) return 'wecom';
    if (/^[0-9a-f]{32}$/i.test(v)) return 'pushplus';
    return '';
  }
  // 给家长的日报：按界面语言写（家长看的就是孩子手机上选的那门语言）
  function daySummary(d) {
    const x = (S.log && S.log[d]) || {}, name = S.player && S.player.name, dt = new Date(d.replace(/-/g, '/')), m = n => Math.round(n || 0);
    const status = x.gateOpen ? tr('g.push.s.open') : x.gateEx ? tr('g.push.s.ex', { why: EX_TXT[x.gateEx] || x.gateEx })
      : x.passAt ? tr('g.push.s.pass', { r: tr('g.push.s.pass.' + (x.passWhy === 'daily' ? 'daily' : x.passWhy === 'fail' ? 'fail' : 'off')), n: PASS_MIN }) : x.gateOff ? tr('g.push.s.off') : tr('g.push.s.todo');
    const lines = [status,
      tr('g.push.l.time', { a: m(x.learn), b: m(x.play) }),
      tr('g.push.l.rev', { a: x.review || 0, b: x.spoken || 0, c: x.recall || 0 }),
      tr('g.push.l.chat', { a: x.chats || 0, b: x.voiceLines || 0 }) + (x.voiceMax ? tr('g.push.l.max' + CH, { n: x.voiceMax }) : '') + (x.chatGoals ? tr('g.push.l.goals', { n: x.chatGoals }) : ''),
    ];
    const warn = [x.gateOff ? tr('g.push.w.off') : '', x.clockBack ? tr('g.push.w.back') : '', x.night ? tr('g.push.w.night') : '',
      x.aiKey ? (x.aiKeyWhy === 'quota' ? tr('g.push.w.quota') : x.aiKeyWhy === 'busy' ? tr('g.push.w.busy') : tr('g.push.w.auth')) : x.aiNoKey ? tr('g.push.w.nokey') : '',
      x.aiSkip ? tr('g.push.w.skip', { n: x.aiSkip }) : '',
      x.pinLock ? tr('g.push.w.pinlock') : x.pinFail ? tr('g.push.w.pin', { n: x.pinFail }) : ''].filter(Boolean);
    if (warn.length) lines.push('⚠️ ' + warn.join(' · '));
    const nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    if (nc) lines.push(tr('g.push.l.concern', { n: nc }));
    lines.push('—— ' + verText());
    return { title: tr('g.push.title', { md: mdTxt(d), dow: tr('g.rp.dow', { d: rawArr('g.rp.wd')[dt.getDay()] }) }) + (name ? ' · ' + name : ''), text: lines.join('\n') };
  }
  function pushSend(title, text, to) {
    const v = String(to != null ? to : S.settings.push || '').trim(), kind = pushKind(v);
    if (!kind) return Promise.resolve(false);
    const req = kind === 'wecom'
      ? { url: v, type: 'text/plain;charset=UTF-8', body: JSON.stringify({ msgtype: 'text', text: { content: title + '\n' + text } }) }
      : { url: 'https://www.pushplus.plus/send', type: 'application/x-www-form-urlencoded;charset=UTF-8', body: new URLSearchParams({ token: v, title, content: esc(text).replace(/\n/g, '<br>'), template: 'html' }).toString() };
    try { if (window.EchoNative && typeof EchoNative.pushPost === 'function') return Promise.resolve(!!EchoNative.pushPost(req.url, req.body, req.type)); } catch (e) { /* 原生不行就用 fetch */ }
    if (typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(req.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': req.type }, body: req.body }).then(() => true, () => false);
  }
  function pushTick() {
    try {
      if (!S || !pushKind(S.settings.push) || navigator.onLine === false || RT.pushBusy || Date.now() - RT.pushTry < 5 * 60e3) return;
      const now = nowD(), y = new Date(now); y.setDate(y.getDate() - 1);
      const want = now.getHours() >= 20 ? dayStr(now) : dayStr(y);
      if (!S.push || typeof S.push !== 'object') S.push = { sent: '' };
      if ((S.push.sent || '') >= want) return;
      if (!S.log || !S.log[want]) { S.push.sent = want; save(); return; }   // 那天没开过游戏：不发
      RT.pushTry = Date.now(); RT.pushBusy = true;
      const msg = daySummary(want);
      pushSend(msg.title, msg.text).then(ok => { RT.pushBusy = false; if (ok) { S.push.sent = want; S.push.at = Date.now(); save(); } });
    } catch (e) { RT.pushBusy = false; }
  }
  function pushSheet() {
    const v = S.settings.push || '';
    openModal('<h2>' + trh('g.push.h') + '</h2><p>' + trh('g.push.p') + '</p>' +
      '<ul class="push-how"><li>' + trh('g.push.how1') + '</li>' +
      '<li>' + trh('g.push.how2') + '</li></ul>' +
      '<input id="push-in" class="txt-in" autocomplete="off" spellcheck="false" placeholder="' + trh('g.push.ph') + '" value="' + esc(v) + '">' +
      '<p class="tip">' + trh('g.push.tip') + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="pushTest">' + trh('g.push.btn.test') + '</button><button class="btn" data-act="pushSave">' + trh('g.push.btn.save') + '</button></div>' +
      (v ? '<button class="btn ghost wide" data-act="pushOff">' + trh('g.push.btn.off') + '</button>' : '<button class="btn ghost wide" data-act="setBack">' + trh('g.push.btn.back') + '</button>'));
  }

  // 安卓 APK：竖屏 / 横屏 / 跟着手机转（原生那边记住，下次打开直接用）
  function applyOrient() {
    try { if (window.EchoNative && EchoNative.setOrientation) EchoNative.setOrientation(S.settings.orient || 'portrait'); } catch (e) { /* 忽略 */ }
  }

  // index.html 里写死的中文（标题、顶栏提示、导航、五个工具按钮、页脚、退出本关、「继续」）：启动时和换界面语言时按字表写一遍
  // （函数声明：setUi 在别的段里也会调它；中文界面写出来和 index.html 里原来的字一样）
  function shellUi() {
    document.title = tr('g.shell.title');
    const at = (sel, attr, key) => { const e = $(sel); if (e) e.setAttribute(attr, tr(key)); };
    at('#topbar .me', 'aria-label', 'g.shell.pet'); at('#t-streak', 'title', 'g.shell.streak'); at('.chip.coins', 'title', 'g.shell.coins');
    at('#tabs', 'aria-label', 'g.shell.tabs'); at('#quests', 'aria-label', 'g.shell.quests'); at('#play .x[data-act=quit]', 'aria-label', 'g.shell.quit');
    // 工具按钮：<span>表情</span>文字<em>：只换中间那段文字
    $$('#quiz-home .tools .tool').forEach(b => {
      const key = { review: 'g.shell.review', shop: 'g.shell.shop', ach: 'g.shell.ach', report: 'g.shell.report', settings: 'g.shell.settings' }[b.dataset.act];
      const tn = key && Array.from(b.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
      if (tn) tn.nodeValue = tr(key);
    });
    const foot = $('#home .foot'); if (foot) foot.textContent = LANG ? tr('g.shell.foot.c', { lang: tr('pk.name.' + COURSE) }) : tr('g.shell.foot');
    // 「继续」按钮：做题时 game.js 会按情况改它的字，这里只在它还是默认的「继续」时换
    const fb = $('#fb-btn'); if (fb && ['zh', 'en'].some(l => fb.textContent === (I18N ? I18N.t('g.shell.next', null, l) : ''))) fb.textContent = tr('g.shell.next');
  }

  // 测试用：课本出题来源、每日复习
  window.EchoGame = { lineOf: (en, o) => lineOf(en, o), entryOf: t => entryOf(t), rubyLine: t => (LANG ? rubyLine(t) : esc(t)), termOf: (c, en) => termOf(c, en), termHTML: (c, en) => termHTML(c, en), hintTx: (k, p) => hintTx(k, p), personOf: en => personOf(en),goUnit: wi => goUnit(wi), src: z => src(z), dueList: () => dueList(), revAddFree: (en, zh) => revAddFree(en, zh), revRight: (q, r) => revRight(q, r), curIdx: () => curIdx(), curUnit: () => curUnit(), gate: () => gate(), dayLog: d => dayLog(d), reportSheet: () => reportSheet(), say: (t, r, g) => say(t, r, g), goHome: t => goHome(t), closeModal: () => closeModal(), get S() { return S; },
    // 走路只记位置、整份存档晚一点才存（见 savePos）：测试 / 工具要直接读 localStorage 里的位置、步数之前，先 flush() 一下
    flush: () => flushWalk() };
  // 测试用：打分（tests/review.test.js）、复习排期引擎、直接出指定的题（[题型, 编号, 第几条] 的列表）
  Object.assign(window.EchoGame, {
    speech: { scoreSpeech, bestScore, earlyMatch, recognize: (on, tg) => recognize(on, tg) },
    rev: { pick: revPick, right: revRight, wrong: revWrong, miss: revMiss, build: () => buildReview(), due: () => dueList(), day: () => revDay(), fade: fadeOf, cue: cueText, addFree: revAddFree, trim: revTrim, key: revKey,
      K: { GAP, REV_N, REV_MAX, REV_NEW, REV_BACKLOG, REV_FIELD } },
    playQs: (list, review) => startLevel(NB, 0, !!review, list.map(([t, w, i]) => makeQ(t, w, i))),
    P: () => P,
    // 测试用（tests/gate.test.js）：学习锁、冒险时间、家长密码、周报、每周记录、日报推送
    T: {
      playInfo: () => playInfo(), advTick: () => advTick(), advStopWhy: () => advStopWhy(), advEnterOk: () => advEnterOk(), weeklyRoll: () => weeklyRoll(), pushTick: () => pushTick(),
      daySummary: d => daySummary(d), pinState: () => pinState(), parentOk: (why, f) => parentOk(why, f), settings: () => { RT.parentOpen = false; settingsSheet(); },
      // 假装现在是某个时刻（毫秒；0 = 用真的时间）：只影响冒险时间（几点、周几）和日报推送
      setNow: ms => { RT.fakeNow = ms || 0; RT.fakeAt = Date.now(); RT.pushTry = 0; },
      RT,
    },
    // 测试用（tests/apk.test.js）：AI 用不了的分类和出路、存档备份、新版本、第一次的小检查
    A: {
      down: () => aiDown(), noKey: () => aiNoKey(), bar: () => aiBarState(), note: (c, w) => aiNote(c, w), failOf: r => failOf(r), hint: r => failHint(r),
      check: () => checkSheet(), later: q => revLater(q), save: () => save(), bakMeta: () => bakMeta(), best: () => bestBackup(), exportSave: () => exportSave(),
      // 存档空间和备份的压缩（tests/apk.test.js）：usage 用了多少字、storeCheck 看一眼空间、pack / unpack 备份的压缩、bakGet 读一份备份的原文
      usage: () => lsUsage(), storeCheck: () => storeCheck(), pack: t => lzPack(t), unpack: t => lzUnpack(t), bakGet: k => bakGet(k),
      verCheck: () => verCheck(), myVer: () => myVer(), updNew: () => updNew(), homeBars: () => homeBars(), settings: () => { RT.parentOpen = true; settingsSheet(); },
    },
  });

  // 测试用（tests/place.test.js）：按能力安排——现在第几级、会排到哪个单元、已免修、挑战馆从哪儿数、撤提示、听音选的比例、谁在学
  window.EchoGame.lv = {
    level: () => PLV(), plan: lv => placePlan(lv), apply: why => placeApply(why), free: i => unitFree(i), span: () => unitSpan(), fade: q => fadeOf(q), listen: () => lvListen(),
    kid: () => kidMode(), learnerPick: (w, cb) => learnerPick(w, cb), bookIdx: () => bookIdx(), units: () => BK.map((u, i) => ({ i, book: u.book, n: u.n, open: unitOpen(i) })),
  };

  // ---------- 启动 ----------
  function start(data) {
    RT.preStart = false;
    S = load(data && data.S);
    if (LANG) S.course = COURSE;   // 别的课的存档带着自己是哪门课（导入、恢复时认）
    if (S.place && S.place.lang !== COURSE) S.place.lang = COURSE;   // 能力检测、分级按在学的这门课（英语的老存档本来就是 en）
    revMigrate();
    revTrim();   // 老存档里攒了很多掌握了的聊天句子：打开时理一次
    if (S.book.cur && S.book.at < 0) { S.book.at = S.book.cur - 1; delete S.book.cur; }
    if (window.EchoI18n) EchoI18n.set(S.settings.ui || 'zh');   // 界面语言（<html lang> 也跟着换）
    shellUi();   // index.html 里写死的字按界面语言写一遍
    applyOrient();
    trackDay();
    weeklyRoll();
    musicVol();
    if (window.MonsterGame) MonsterGame.migrate();
    if (window.EchoSetup) EchoSetup.apply(false);   // 销售版：家长设好的形象、伙伴（博士的包）、昵称
    // 链接带 ?quiet：不方便说话时，所有口语任务都改成按按钮（等同设置里的「录音自评」）
    if (/[?&](quiet|nomic)\b/.test(location.search)) { S.settings.mode = 'self'; save(); setTimeout(() => toast(tr('g.boot.quiet')), 800); }
    checkStreak();
    ensureQuests();
    // iPhone 版不在启动时查本机声音：云上的模拟器里 getVoices() 卡住主线程 47 秒（2026-11-19 的 StoreKit 测试日志）；
    // iPhone 上本机声音只是最后一道兜底（前面有打包的配音和阿里云），真用到时 sayDevice 再查（voicesNow）
    if (!window.ECHO_IOS) {
      loadVoices();
      if (TTS.ok && 'onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
      setTimeout(() => { loadVoices(); TTS.loaded = true; }, 1500); // 一些安卓浏览器永远返回空列表
    }
    // 字体在 assets/fonts（style.css 的 @font-face），不再连 Google（国内连不上，也让测试不稳）
    show('home');
    renderHome();
    // 存档读不出来（坏了）：告诉孩子用了哪份备份（评估第 7 条）
    let told = false;
    if (RT.restored) {
      told = true;
      setTimeout(() => openModal('<div class="big">🛟</div><h2>' + trh('g.boot.bad.h') + '</h2>' +
        (RT.restored === 'none' ? '<p>' + trh('g.boot.bad.none') + '</p>' : '<p>' + trh('g.boot.bad.used', { w: RT.restored }) + '</p>') +
        '<p class="tip">' + trh('g.boot.bad.tip') + (RT.noSave ? trh('g.boot.bad.full') : '') + trh('g.boot.bad.tip2') + '</p>' +
        '<button class="btn wide" data-act="restoredOk" data-focus>' + trh('g.ok') + '</button>'), 400);
    }
    // 刚从备份恢复（restore 以后重新打开的）
    let rs = ''; try { rs = sessionStorage.getItem('echo-restored') || ''; sessionStorage.removeItem('echo-restored'); } catch (e) { /* 忽略 */ }
    if (rs) { dayLog().restore = 1; save(); setTimeout(() => toast(tr('g.boot.restored', { w: rs })), 500); }
    // 渲染进程挂了、原生刚重建过 WebView（评估第 15 条）
    try { if (nat('takeRecovered') && EchoNative.takeRecovered()) { if (window.EchoErr) EchoErr.log('app', trz('g.boot.crash.log'), 'native'); setTimeout(() => toast(tr('g.boot.crash')), 600); } } catch (e) { /* 忽略 */ }
    // 销售版第一次打开：先做家长首次设置（家长密码、AI 密钥、家庭定制、设备检查），做完再给孩子看说明（afterSetup）
    if (window.EchoSetup && EchoSetup.needed()) setTimeout(() => EchoSetup.open(), 100);
    // 全新的开始（没有存档、没有进度）：先选语言、做能力检测，做完或者说「以后再测」以后再看游戏说明（afterPlace）。
    // 有进度的老存档不会走到这里：只在首页给一张卡片（questHTML 里的 EchoPlace.homeCard）
    else if (!told && window.EchoPlace && EchoPlace.isNew()) setTimeout(() => EchoPlace.first(), 150);
    else if (!S.seenIntro) { if (!told) setTimeout(introSheet, 300); }   // 先说存档的事，「知道了」以后再看说明（restoredOk）
    // APK 第一次打开（或者从老版本升上来）：做一次「麦克风 + 网络 + 密钥」小检查
    else if (!told && window.ECHO_APP && !S.micCheck && speakMode() === 'sr') setTimeout(() => { if ($('#modal').hidden) checkSheet(); }, 900);
    setTimeout(storeCheck, 2500); // 存档空间还够不够（快满了首页挂一条）
    setTimeout(pushTick, 4000);   // 打开游戏时补发没送到的日报（家长开了推送才会发）
    setTimeout(verCheck, 3000);   // 有没有新版本（只有 APK 查）
  }
  // 切到后台 / 页面要关了 / 被系统冻住：走路攒下的整份存好（后台的 App 随时可能被系统杀掉）
  const onHide = () => {
    if (S) flushWalk(true);
    // 音效用的 AudioContext 也挂起：不然切到后台它还一直占着手机的声音输出（配乐、战斗音效那两个早就这样做了）；下一次出声时 ac() 会自己恢复
    try { if (AC && AC.state === 'running' && document.hidden) { const q = AC.suspend(); if (q && q.catch) q.catch(() => {}); } } catch (e) { /* 忽略 */ }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); });
  window.addEventListener('pagehide', onHide);
  document.addEventListener('freeze', onHide);
  // 切到后台：隔 1 小时以上再往手机「下载/EchoIsland」写一份今天的备份（同一天覆盖同一份）
  // （只写手机里的备份，不另外存 localStorage：别把外面刚改过的存档盖掉）
  document.addEventListener('visibilitychange', () => { if (document.hidden && S && !RT.noSave && RT.bakDay && nat('backupWrite') && Date.now() - RT.natBakAt > 60 * 60e3) nativeBackup(); });
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S })); } catch (e) { /* 忽略 */ } }
  // 课程包模式：先等 EchoPacks.ready()（装好的配音有哪些；别的语言的课程内容），最多等 5 秒；老模式照旧当场 start。
  // 等的这一会儿存档还没读（S 是 fresh() 的空白存档）：不许存（save 看 RT.preStart），首页先藏起来（别的模块加载完来重画首页、孩子点按钮，
  // 都会碰到空白的 S——2026-11-20 试的时候 mon3d-ready 重画首页顺手 save()，把测试存档盖成了空白的）；start 里 show('home') 再露出来
  function boot(d) {
    if (!PK()) { start(d); return; }
    RT.preStart = true;
    const hm = $('#home'); if (hm) hm.hidden = true;
    if (LANG) { courseBoot(d); return; }
    let go = false;
    const run = () => { if (!go) { go = true; start(d); } };
    EchoPacks.ready().then(run, run);
    setTimeout(run, 5000);
  }
  // 别的课（ENGINE.md §2）：等课程包把这门课的 course.json 读出来（不只等 4 秒：内容没读出来就开始等于拿英语内容配这门课的存档），
  // 换上内容再 start()；读不出来（包被清了、没下完）就停在「下载课程」那一页，不往下走
  function courseBoot(d) {
    let done = false;
    const go = () => {
      if (done) return; done = true;
      const c = EchoPacks.content();
      if (c && Array.isArray(c.WORLDS) && c.WORLDS.length) { courseUse(c); start(d); return; }
      // 存档还没读：界面语言先照这门课的存档（没有就照英语那份）
      try { const o = parseSave(lsGet(KEY)) || parseSave(lsGet('echo-island-v1')); if (o && o.settings && o.settings.ui) S.settings.ui = o.settings.ui; } catch (e) { /* 读不到就是中文 */ }
      if (window.EchoI18n) EchoI18n.set(S.settings.ui || 'zh');
      shellUi();
      if (EchoPacks.missing) EchoPacks.missing(COURSE);
    };
    (EchoPacks.courseReady ? EchoPacks.courseReady() : EchoPacks.ready()).then(go, go);
    setTimeout(go, 15000);
  }
  if (hot && typeof hot.ready === 'function') hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
