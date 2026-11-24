// 和岛民用英语自由聊天（AI 语音对话）：window.EchoTalk
// 浏览器 ⇄ 中转服务 server/relay.js（WebSocket）⇄ 阿里云百炼 Qwen-Omni 实时语音。密钥只在中转服务里（APK 里在原生桥里）。
// 按住按钮说话（16kHz 16 位 PCM 分块发出），松开发送；岛民用自己的音色回答（24kHz PCM 边收边播），屏幕上显示双方的话。
// 聊完让文字模型打分：按小步骤给星（差 1 步也算完成）、一句表扬、最多两条改进。连不上服务时提示家长设置，不影响别的玩法。
// 家长 2026-10-07 定的规矩：
// - 学习锁的「聊天」看这台手机上数的：今天用语音说满 6 句英语（识别结果 ≥3 个英文词、不含中文），或完成一个小目标。打字的不算句数、不给金币、不开锁
// - 麦克风能用时打字框收起来；返回键 / 切后台 = 结束并评价；评价超时也先存记录、照样计句数
// - 聊天里有「帮帮我」「再听一遍」「点一下看中文」；目标拆成小步骤实时打勾；每个角色几个目标轮换；岛民记得上次聊过的游戏里的小事（只存手机里）
// - 孩子说难过、被欺负、有危险时岛民认真回应并让他告诉家长 / 老师，这段聊天打上标记，家长输密码能看全文
// 给 game.js 的接口：EchoTalk.today()（学习锁用）、EchoTalk.endIfOpen()（返回键用）、EchoTalk.concerns()（周报「有几段聊天需要家长看看」）
(function () {
  'use strict';
  let NPCS = window.TALK_NPCS;     // 别的语言的课：game.js 换成 course.json 的 TALK（useNpcs）
  const Core = () => window.TalkCore;
  let G = null;                    // game.js 给的工具（S、save、toast、esc、openModal……）
  // 在学别的语言（tools/course/ENGINE.md §4、tools/course/TALK.md §4）：这门语言能不能和岛民聊，看服务器会不会——
  // 云端模式看 GET /v1/me 的 talkLangs（account.js 的 talkLang），网页版的中转服务看它 /health 回的 talkLangs（relayLangs，见下面）；
  // 老服务器、APK 直连阿里云 = 不会：照旧写「这门语言的 AI 聊天还在做」，学习锁里聊天那一项整天免。
  // 第二轮（2026-11-21 傍晚，TALK.md「第二轮」C）：支线委托、口语题的 AI 发音点评也看服务器——它另说两样：questLangs（会用哪些语言做委托）、
  // tipLangs（会用哪些语言写点评），和 talkLangs 在同一个地方问（云端模式 account.js 的 questLang / tipLang，中转服务的 /health）。
  // 老服务器没有这两个字段 = 不会：委托人头上没有「?」、没有点评，和第一轮一样。
  // CL() 在学哪门语言（'' = 英语课：下面每一处英语课走的都是原来那一行）；coreLang：打包进来的 talk-core.js 认不认这门语言
  // （数句子、判完成的规则在它那里；它不认就当这门语言聊不了）
  const CL = () => (G && G.lang && typeof G.course === 'string' && G.course !== 'en' ? G.course : '');
  const coreLang = l => { const c = Core(); try { return !!(l && c && typeof c.langOk === 'function' && c.langOk(l) === l); } catch (e) { return false; } };
  // k：'' 聊天（talkLangs）/ 'q' 委托（questLangs）/ 't' 发音点评（tipLangs）
  const SRV_FN = { '': 'talkLang', q: 'questLang', t: 'tipLang' };
  const langSrv = (l, k) => {
    k = k || '';
    if (cloudOn()) { try { const A = ACC(), f = A && A[SRV_FN[k]]; return typeof f === 'function' && !!f(l); } catch (e) { return false; } }
    if (direct()) return false;
    return relayLangs(k).includes(l);
  };
  const langTalk = () => { const l = CL(); return !!l && coreLang(l) && langSrv(l); };
  const langOff = () => !!(G && G.lang) && !langTalk();
  // 别的课里委托开不开：能聊（上面那一条）+ 服务器会用这门语言做委托 + 课程包里有委托的内容（game.js 的 questLoc 查 course.json 的 QUESTS）。
  // 英语课一直 true。给了 id：这一条在课程包里有没有、小步骤和 quests.js 是不是一样多（不一样多的界面和服务器对不上，不出）
  function questLoc(id) {
    const q = window.QUESTS && Object.prototype.hasOwnProperty.call(QUESTS.byId, id) ? QUESTS.byId[id] : null;
    let loc = null; try { loc = q && G && G.questLoc ? G.questLoc(id) : null; } catch (e) { loc = null; }
    return loc && Array.isArray(loc.steps) && loc.steps.length === q.steps.length ? loc : null;
  }
  function questOk(id) {
    const l = CL();
    if (!l) return !(G && G.lang);   // 英语课：照旧（在学别的语言、可是语言代码不认得：不出）
    if (!langTalk() || !langSrv(l, 'q')) return false;
    return id == null ? !!(G && G.questLoc) : !!questLoc(id);
  }
  // 别的课里口语题的 AI 发音点评出不出（game.js 的 aiTip 问）：服务器会用这门语言写点评才出
  const tipOk = () => { const l = CL(); return l ? langSrv(l, 't') : !(G && G.lang); };
  const $ = s => document.querySelector(s);
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return ''; } };
  // 等老师评价最多几毫秒、HTTPS 请求超时（测试里改短：EchoTalk.cfg）
  const CFG = { evalWait: 20000, httpWait: 15000 };
  const NEED = (window.TalkCore && TalkCore.VOICE_NEED) || 6;

  // ---------- 界面文字（i18n.js 字表；键前缀 tk.） ----------
  // 2026-11-19 搬进来。中文和原来一字不差；英文写得短、写得浅。岛民的话、委托和角色的中文意思是内容，按 gloss 显示（英语界面不显示）。
  // 给 AI 的提示词不是界面，在 talk-core.js（评语、点评按界面语言要）
  const I18N = window.EchoI18n;
  const tx = (k, p) => (I18N ? I18N.t(k, p) : k), hx = (k, p) => (I18N ? I18N.h(k, p) : k);
  // 数据里有 zh / en 两个名字的（委托名、目标、岛名）：按界面语言取
  const lbl = o => (I18N ? I18N.label(o) : (o && o.zh) || '');
  // 内容的中文意思（岛民的中文名、话题、词卡）：中文界面给中文，英语界面给 null（不显示）
  const gloss = o => (I18N ? I18N.gloss(o) : (o && o.zh) || null);
  // 中文界面：才有「点岛民的话看中文」（只会翻成中文），小步骤才显示数据里的中文
  const zhUi = () => !I18N || I18N.lang() === 'zh';
  const loc = () => (zhUi() ? 'zh-CN' : 'en-GB');
  // 小步骤给学习者看的那句：中文界面用数据里的中文；别的界面语言用英文的步骤说明（goalOf 的 task，现在只有地图上随便聊的人有），
  // 没有就写「第 n 步」（点一下看示范句）
  const stepTxt = (s, k) => (zhUi() ? s.zh : s.task || tx('tk.step', { n: k + 1 }));
  if (I18N) I18N.add({
    zh: {
      // 别的语言的课（tools/course/ENGINE.md §4）
      'tk.lang.h': '这门语言的 AI 聊天还在做', 'tk.lang.p': '岛民现在还只会用英语聊天。这门语言的聊天做好以后会在这里打开；学习锁里「聊天」这一项先每天自动免掉。先去闯关练习、每日复习和怪兽冒险吧！',
      // 别的语言的课、服务器会用这门语言聊的时候（tools/course/TALK.md §4）：原来写着「英语」「看中文」的句子的「.c」写法
      // （i18n.js 的 variant：{lang} = 在学的语言的名字；英语课不走这几句）
      'tk.prog.need.c': ' · 用语音说满 {n} 句{lang}，或者完成一个小目标', 'tk.h.book.c': '📗 课程单元 · {b}', 'tk.intro.h.c': '🗣️ 用{lang}和岛民聊天',
      'tk.intro.p.c': '按住话筒说{lang}，松开就发出去；岛民会用自己的声音回答你。每段聊天有一个小目标，拆成几个小步骤，做到一步就打一个勾，完成了有金币！听不懂就点「💡 帮帮我」或者点岛民的话看意思。',
      'tk.ready.mic.c': '按住话筒说{lang}，说完松开。点岛民说的话可以看意思。', 'tk.mic.c': '🎤 按住说{lang}', 'tk.type.ph.c': '打字聊天（{lang}）', 'tk.zh.tap.c': '点一下看意思',
      'tk.toast.done.c': '🎉 今天的聊天任务完成了！（已开口说 {n} 句{lang}）', 'tk.e.quiet.p.c': '按住话筒说{lang}，岛民就会回答你。',
      'tk.r.few.c': '这次用语音说的{lang}句子不到 3 句{typed}，目标先不算完成。下次按住话筒说吧！',
      // 评语里「更好的说法」不进每日复习的课（日语：没有读音的句子打不了分）；大地图上和面前的人随便聊的目标（别的课）
      'tk.r.tips.only': '可以这样说更好：', 'tk.dyn.goal': '和 {name} 用{lang}随便聊聊：打个招呼，问 TA 一个问题，也回答 TA 的问题。',
      // 第二轮：日语的「更好的说法」读得出来的才进复习——两条里只有一条进的时候，进的那条标 📅
      'tk.r.tips.some': '可以这样说更好（带 📅 的那句明天的每日复习里会再练）：',
      'tk.err.offline': '现在没网，连上网再来聊吧', 'tk.err.auth': 'AI 密钥不对，请告诉家长', 'tk.err.quota': 'AI 额度用完了，请告诉家长', 'tk.err.busy': 'AI 有点忙，过一会儿再试',
      'tk.err.code': '家庭口令不对，请告诉家长', 'tk.err.network': '连不上 AI 聊天，过一会儿再试；一直不行就告诉家长', 'tk.err.daily': '今天的聊天时间用完了，明天再来吧！',
      'tk.err.nonpc': '没有这个岛民', 'tk.err.log': '聊天：{raw}', 'tk.err.conn': '连不上对话服务 {url}', 'tk.err.up': '连不上对话服务（{msg}）',
      'tk.prog': '🗣️ 已开口说 {a}/{b} 句', 'tk.prog.done': '🗣️ 今天已开口说 {n} 句 ✅', 'tk.prog.ok': ' · 今天的聊天任务完成了', 'tk.prog.need': ' · 用语音说满 {n} 句英语，或者完成一个小目标',
      // 首页的聊天
      'tk.card.now': ' · 📍 正在学', 'tk.card.next': '🎯 下次：{lv}', 'tk.h.book': '📗 课本话题 · {b}', 'tk.h.isle': '🏝️ 岛上的人',
      'tk.intro.h': '🗣️ 用英语和岛民聊天',
      'tk.intro.p': '按住话筒说英语，松开就发出去；岛民会用自己的声音回答你。每段聊天有一个小目标，拆成几个小步骤，做到一步就打一个勾，完成了有金币！听不懂就点「💡 帮帮我」或者点岛民的话看中文。',
      'tk.ai.line': '🤖 岛民的话和声音由 AI 生成', 'tk.warn': '还没连上对话服务。请家长点下面的「设置服务」。',
      'tk.foot.log': '📜 聊天记录', 'tk.foot.cfg': '⚙️ 设置服务', 'tk.concern.btn': '👪 家长看看',
      // AI 标识
      'tk.ai.spoken': '温馨提示：岛民说的话和声音，都由人工智能生成。', 'tk.ai.bubble': '🤖 {s}', 'tk.ai.title': '岛民的话和声音由人工智能生成',
      // 聊天界面
      'tk.ready.mic': '按住话筒说英语，说完松开。点岛民说的话可以看中文。', 'tk.ready.type': '打字聊天：写好按「发送」。',
      'tk.top.free': '自由聊天 · {isle}', 'tk.top.quest': '📋 委托 · {q}', 'tk.end': '结束', 'tk.eg': '例：{s}', 'tk.step': '第 {n} 步', 'tk.st.conn': '正在连接……',
      'tk.sos': '求助的话', 'tk.help': '💡 帮帮我', 'tk.replay': '🔁 再听一遍', 'tk.slow': '🐢 慢一点', 'tk.mic': '🎤 按住说英语', 'tk.mic.on': '🔴 正在听……松开发送',
      'tk.typeopen': '⌨️ 麦克风用不了？点这里打字', 'tk.type.ph': '打字聊天（英文）', 'tk.send': '发送', 'tk.typenote': '打字的话不算「开口说」的句数，也不给金币',
      'tk.st.nomic': '用不了麦克风（没给权限或不支持），可以先打字聊。', 'tk.micfix': '🎤 去设置里打开麦克风', 'tk.st.badurl': '服务地址不对：{url}', 'tk.zh.tap': '点一下看中文',
      'tk.st.short': '按住久一点再说哦。', 'tk.st.think': '岛民在想……', 'tk.st.notyet': '还没连上，等一下再发。',
      'tk.toast.done': '🎉 今天的聊天任务完成了！（已开口说 {n} 句英语）', 'tk.toast.all': '🎯 小步骤全做到了！和 TA 说再见，再点「结束」', 'tk.toast.most': '🎯 小目标差不多完成了！再做一步更好，也可以点「结束」',
      'tk.zh.busy': '翻译中……', 'tk.zh.fail': '（这次没翻译出来，再点一下试试）', 'tk.st.help': '💡 岛民在想一句你可以照着说的话……', 'tk.st.eval': '聊得不错！正在给这段对话写评语……',
      'tk.toast.goal': '🎯 和 {name} 的聊天目标完成了！', 'tk.coins': '+{n} 金币', 'tk.why.def': '孩子说到了难过或不安全的事',
      // 聊完：评语页
      'tk.btn.reward': '🎁 回去领奖励', 'tk.btn.retry': '再试一次', 'tk.btn.again': '再聊一次', 'tk.btn.back': '返回', 'tk.gate.open': '🔓 今天的学习任务完成了，可以去怪兽冒险！',
      'tk.e.daily.h': '今天聊够啦', 'tk.e.fail.h': '⚠️ 没连上', 'tk.e.raw': '（给家长看：{raw}）', 'tk.e.quiet.h': '这次没说话哦', 'tk.e.quiet.p': '按住话筒说英语，岛民就会回答你。',
      'tk.left': '今天还能聊 {n} 分钟', 'tk.time': '这次聊了 {n} 秒',
      'tk.r.all': '🎯 目标完成！每一步都做到了', 'tk.r.most': '🎯 目标完成！（差 1 步也算完成）', 'tk.r.speak': '要开口说才算哦', 'tk.r.near': '还差一点点，下次试试把小步骤都说到',
      'tk.r.few': '这次用语音说的英语句子不到 3 句{typed}，目标先不算完成。下次按住话筒说吧！', 'tk.r.typed': '（打字的不算）',
      'tk.r.ai': '🤖 评语由 AI 生成', 'tk.r.noai': '这次没来得及写评语，不过这段聊天算数，已经记下来了！', 'tk.r.tips': '可以这样说更好（明天的每日复习里会再练）：',
      'tk.r.coins': '🪙 +{n} 金币', 'tk.r.q.done': '📋 委托完成了！回到冒险里，{name} 有奖励给你', 'tk.r.q.not': '📋 委托还没完成：把小步骤都说到，再来试一次',
      'tk.r.late.h': '聊完啦！这段聊天算数 👍', 'tk.r.late.p': '这次评语没来得及写完（可能是网络慢），不过你开口说的句子已经记下来了。',
      'tk.r.concern': '💛 如果你遇到了难过或者不安全的事，记得马上告诉爸爸妈妈或者老师。',
      // 口语题的识别
      'tk.asr.say': '🎤 请说……', 'tk.asr.hear': '🎤 在听……', 'tk.asr.busy': '🎧 识别中……',
      // 口语题用的是哪个识别（iPhone 的本机识别 / 云端识别）：设置页、开口前的小检查、周报诊断一行、家长须知。不写是哪家的
      'tk.sr.env': '✅ 口语自动打分：本机识别（用 iPhone 自带的语音识别在手机上听写，不用联网、不用登录；手机用不了时改用云端识别）',
      'tk.sr.chk.dev': '麦克风没问题！口语题用本机识别：在这台手机上听写，不用联网。', 'tk.sr.chk.cloud': '（口语识别：云端，要联网）',
      'tk.sr.rp': ' · 口语识别：本机 {a} 次、云端 {b} 次，本机说完约 {s} 秒出分',
      'tk.pv.dev': '<li>iPhone 上的口语题先用 iPhone 自带的语音识别，<b>在这台手机上</b>把说的话写成文字来打分，认出来了这段声音就<b>不上传</b>；这台手机用不了本机识别（不支持、没允许），或者这一次没认出来时，这一句才按上面那样发出去识别。</li>',
      // 家长：设置服务、聊天记录、家长看看、家长须知
      'tk.cfg.why': '改 AI 密钥', 'tk.cfg.key': '家长设置：阿里云百炼 API Key（只存在这台手机里，用来和岛民聊天）\n已经设置过的话，留空就是不改；填 clear 删除',
      'tk.cfg.ok': '✅ 已连上阿里云，可以和岛民聊天了', 'tk.cfg.nokey': '还没有设置密钥',
      'tk.cfg.url': '对话服务地址（家长填）：\n例如 wss://你的服务器域名 ；本机试用填 ws://localhost:8787\n留空恢复默认', 'tk.cfg.code': '家庭口令（服务没设口令就留空）：',
      'tk.cfg.now': '对话服务：{url}', 'tk.cfg.none': '未设置',
      'tk.log.me': '我：', 'tk.log.who': '{name}：', 'tk.log.typed': '（打字）', 'tk.log.voice': ' · 开口 {n} 句', 'tk.log.none': '还没有聊天记录。', 'tk.log.p': '最近 30 次，只存在这台设备上。',
      'tk.concern.p': '孩子在聊天里说到难过、被欺负、害怕或有危险时，这段聊天会标出来（AI 判断，加上本机查关键词，可能有误报）。岛民会提醒孩子马上告诉家长或老师。',
      'tk.concern.seen': '✅ 家长看过了', 'tk.concern.none': '没有需要注意的聊天。',
      'tk.pv.h': 'ℹ️ 家长须知：AI 聊天',
      'tk.pv.s1': '<li>岛民的话和声音、口语打分都由<b>人工智能（AI）生成</b>。聊天页顶上一直写着「{l}」，每天第一次聊天开头还会写一句提示。</li>',
      'tk.pv.s2': '<li>聊天、口语打分时，孩子说话的<b>声音和识别出来的文字</b>直接从这台手机发到阿里云，用的是<b>您自己的阿里云账号和密钥</b>（费用也由阿里云直接向您收）。开发者<b>收不到</b>这些声音和文字，也没有服务器存它们。</li>',
      'tk.pv.role': '<li>岛民只扮演游戏角色、只聊游戏和日常的话题，不会问真名、学校、住址、电话。孩子认真问「你是真人吗」，岛民会说自己是<b>电脑做的游戏角色</b>。</li>',
      'tk.pv.safe': '<li>孩子说到难过、被欺负、害怕或有危险时，岛民会认真回应、提醒他马上告诉家长或老师，这段聊天会标出来，家长在「👪 家长看看」里输密码能看全文，周报上也会提示。</li>',
      'tk.pv.s5': '<li>聊天记录、岛民记住的小事都<b>只存在这台手机里</b>（聊天记录最近 30 段），卸载 App 就全部删掉。每天最多聊 {n} 分钟。</li>',
      'tk.pv.name': '<li>给主角起名时请用<b>游戏昵称</b>，不要用真名。</li>',
      'tk.pv.w1': '<li>和岛民聊天、口语题打分时，孩子说话的<b>声音和识别出来的文字</b>会发到<b>阿里云百炼</b>做语音识别、对话和打分。安卓 APK 直接连阿里云；网页版经过家里的中转服务。</li>',
      'tk.pv.w4': '<li>聊天记录存在这台手机里（最近 30 段）；网页版的中转服务也会存一份，<b>保留 90 天</b>后自动删掉。</li>',
      'tk.pv.w5': '<li>岛民会记住孩子在游戏里说过的小事（比如喜欢画画、有一只火怪兽），下次聊天提起来——<b>只存在这台手机里</b>，不记真名、学校、住址。</li>',
      'tk.pv.doc': '📄 儿童隐私说明（全文）', 'tk.pv.forget': '🧹 让岛民忘掉以前聊过的事', 'tk.forgot': '岛民忘掉以前聊过的事了',
    },
    en: {
      'tk.lang.h': 'AI chat in this language is still being built', 'tk.lang.p': 'For now the islanders can only chat in English. Chat in this language will open here when it is ready; until then the "chat" part of the study lock is skipped every day. Try Practice, Daily review and the Monster Adventure!',
      'tk.prog.need.c': { one: ' · Say {n} {lang} line aloud, or finish a chat goal', other: ' · Say {n} {lang} lines aloud, or finish a chat goal' },
      'tk.h.book.c': '📗 Course units · {b}', 'tk.intro.h.c': '🗣️ Chat with islanders in {lang}',
      'tk.intro.p.c': 'Hold the mic and speak {lang}, then let go to send. Each islander answers in their own voice. Every chat has a goal with a few small steps: you get a tick for each step, and coins when you finish! If you get stuck, tap "💡 Help me", or tap what the islander said to see what it means.',
      'tk.ready.mic.c': 'Hold the mic and speak {lang}. Let go when you finish.', 'tk.mic.c': '🎤 Hold to speak {lang}', 'tk.type.ph.c': 'Type in {lang}',
      'tk.zh.tap.c': 'Tap to see what it means',
      'tk.toast.done.c': { one: '🎉 Today\'s chat task is done! (You said {n} {lang} line)', other: '🎉 Today\'s chat task is done! (You said {n} {lang} lines)' },
      'tk.e.quiet.p.c': 'Hold the mic and speak {lang}, and the islander will answer you.',
      'tk.r.few.c': 'You spoke fewer than 3 {lang} lines this time{typed}, so the goal does not count yet. Next time, hold the mic and talk!',
      'tk.r.tips.only': 'A better way to say it:', 'tk.dyn.goal': 'Chat with {name} in {lang}: say hello, ask them a question, and answer their questions.',
      'tk.r.tips.some': 'A better way to say it (you\'ll practise the one marked 📅 in tomorrow\'s Daily review):',
      'tk.err.offline': 'You\'re offline. Connect to the internet, then come back to chat', 'tk.err.auth': 'The AI key is wrong. Please ask a parent or check Settings',
      'tk.err.quota': 'The AI credit has run out. Please ask a parent or check Settings', 'tk.err.busy': 'The AI is a bit busy. Try again in a moment',
      'tk.err.code': 'The family code is wrong. Please ask a parent', 'tk.err.network': 'Can\'t reach AI chat. Try again in a moment; if it keeps happening, ask a parent',
      'tk.err.daily': 'Today\'s chat time is used up. Come back tomorrow!',
      'tk.err.nonpc': 'No such islander', 'tk.err.log': 'Chat: {raw}', 'tk.err.conn': 'Can\'t connect to the chat service {url}', 'tk.err.up': 'Can\'t connect to the chat service ({msg})',
      'tk.prog': '🗣️ Lines spoken: {a}/{b}', 'tk.prog.done': { one: '🗣️ Spoke {n} line today ✅', other: '🗣️ Spoke {n} lines today ✅' },
      'tk.prog.ok': ' · Today\'s chat task is done', 'tk.prog.need': { one: ' · Say {n} English line aloud, or finish a chat goal', other: ' · Say {n} English lines aloud, or finish a chat goal' },
      'tk.card.now': ' · 📍 Studying now', 'tk.card.next': '🎯 Next: {lv}', 'tk.h.book': '📗 Textbook topics · {b}', 'tk.h.isle': '🏝️ Islanders',
      'tk.intro.h': '🗣️ Chat with islanders in English',
      'tk.intro.p': 'Hold the mic and speak English, then let go to send. Each islander answers in their own voice. Every chat has a goal with a few small steps: you get a tick for each step, and coins when you finish! If you get stuck, tap "💡 Help me".',
      'tk.ai.line': '🤖 The islanders\' words and voices are made by AI', 'tk.warn': 'Not connected to the chat service yet. A parent can tap "⚙️ Chat service" below.',
      'tk.foot.log': '📜 Chat log', 'tk.foot.cfg': '⚙️ Chat service', 'tk.concern.btn': '👪 Parent check',
      'tk.ai.spoken': 'Please note: what the islanders say, and their voices, are made by AI.', 'tk.ai.bubble': '🤖 {s}', 'tk.ai.title': 'The islanders\' words and voices are made by AI',
      'tk.ready.mic': 'Hold the mic and speak English. Let go when you finish.', 'tk.ready.type': 'Typing chat: write your message and tap "Send".',
      'tk.top.free': 'Free chat · {isle}', 'tk.top.quest': '📋 Request · {q}', 'tk.end': 'End', 'tk.eg': 'e.g. {s}', 'tk.step': 'Step {n}', 'tk.st.conn': 'Connecting…',
      'tk.sos': 'Phrases for help', 'tk.help': '💡 Help me', 'tk.replay': '🔁 Hear it again', 'tk.slow': '🐢 Slower', 'tk.mic': '🎤 Hold to speak English', 'tk.mic.on': '🔴 Listening… let go to send',
      'tk.typeopen': '⌨️ Mic not working? Tap here to type', 'tk.type.ph': 'Type in English', 'tk.send': 'Send', 'tk.typenote': 'Typed lines don\'t count as spoken lines and don\'t earn coins',
      'tk.st.nomic': 'Can\'t use the microphone (no permission, or not supported). You can type for now.', 'tk.micfix': '🎤 Turn on the mic in Settings', 'tk.st.badurl': 'Wrong service address: {url}',
      'tk.zh.tap': 'Tap to translate',
      'tk.st.short': 'Hold it a little longer while you speak.', 'tk.st.think': 'The islander is thinking…', 'tk.st.notyet': 'Not connected yet. Wait a moment, then send.',
      'tk.toast.done': { one: '🎉 Today\'s chat task is done! (You said {n} English line)', other: '🎉 Today\'s chat task is done! (You said {n} English lines)' },
      'tk.toast.all': '🎯 You did every step! Say goodbye, then tap "End"', 'tk.toast.most': '🎯 Goal almost done! One more step is even better, or tap "End"',
      'tk.zh.busy': 'Translating…', 'tk.zh.fail': '(Could not translate this time. Tap again to try.)', 'tk.st.help': '💡 The islander is thinking of a line you can copy…',
      'tk.st.eval': 'Nice chat! Writing comments on it…',
      'tk.toast.goal': '🎯 Chat goal with {name} done! ', 'tk.coins': { one: '+{n} coin', other: '+{n} coins' }, 'tk.why.def': 'The child talked about something sad or unsafe',
      'tk.btn.reward': '🎁 Go back for your reward', 'tk.btn.retry': 'Try again', 'tk.btn.again': 'Chat again', 'tk.btn.back': 'Back',
      'tk.gate.open': '🔓 Today\'s study tasks are done. Time for a Monster Adventure!',
      'tk.e.daily.h': 'That\'s enough chat for today', 'tk.e.fail.h': '⚠️ Couldn\'t connect', 'tk.e.raw': '(For parents: {raw})', 'tk.e.quiet.h': 'You didn\'t say anything this time',
      'tk.e.quiet.p': 'Hold the mic and speak English, and the islander will answer you.',
      'tk.left': { one: '{n} minute of chat left today', other: '{n} minutes of chat left today' }, 'tk.time': { one: 'This chat: {n} second', other: 'This chat: {n} seconds' },
      'tk.r.all': '🎯 Goal done! You did every step', 'tk.r.most': '🎯 Goal done! (One step missing still counts)', 'tk.r.speak': 'You need to speak for it to count',
      'tk.r.near': 'Almost there! Next time, try to do all the small steps',
      'tk.r.few': 'You spoke fewer than 3 English lines this time{typed}, so the goal does not count yet. Next time, hold the mic and talk!', 'tk.r.typed': ' (typed lines don\'t count)',
      'tk.r.ai': '🤖 Comments made by AI', 'tk.r.noai': 'There was no time to write comments this time, but this chat still counts. It has been saved!',
      'tk.r.tips': 'A better way to say it (you\'ll practise it in tomorrow\'s Daily review):',
      'tk.r.coins': { one: '🪙 +{n} coin', other: '🪙 +{n} coins' }, 'tk.r.q.done': '📋 Request done! Go back to your adventure: {name} has a reward for you',
      'tk.r.q.not': '📋 Request not done yet: do all the small steps, then try again',
      'tk.r.late.h': 'Chat over! This chat counts 👍', 'tk.r.late.p': 'There was no time to finish the comments (maybe the network is slow), but the lines you said have been saved.',
      'tk.r.concern': '💛 If something sad or unsafe is happening to you, tell a parent or a teacher right away.',
      'tk.asr.say': '🎤 Speak now…', 'tk.asr.hear': '🎤 Listening…', 'tk.asr.busy': '🎧 Recognising…',
      'tk.sr.env': '✅ Automatic speaking score: on-device recognition (the iPhone\'s own speech recognition writes down what you say on this phone; no internet or sign-in needed. If it can\'t be used, cloud recognition is used instead)',
      'tk.sr.chk.dev': 'The microphone works! Speaking questions use on-device recognition: it all happens on this phone, no internet needed.', 'tk.sr.chk.cloud': ' (Speech recognition: cloud, needs internet)',
      'tk.sr.rp': ' · Speech recognition: on device {a}, cloud {b}; on device the score comes about {s}s after you stop',
      'tk.pv.dev': '<li>On iPhone, speaking questions first use the iPhone\'s own speech recognition to write down what was said <b>on this phone</b>; when that works, the audio is <b>not uploaded</b>. If this phone can\'t use on-device recognition (not supported, or not allowed), or it didn\'t catch that answer, that one answer is sent out for recognition as described above.</li>',
      'tk.cfg.why': 'Change the AI key', 'tk.cfg.key': 'Parent Settings: Alibaba Cloud Model Studio API key (kept only on this phone, used to chat with islanders)\nIf a key is already set, leave this empty to keep it; type clear to delete it',
      'tk.cfg.ok': '✅ Connected to Alibaba Cloud. You can chat with the islanders now', 'tk.cfg.nokey': 'No key set yet',
      'tk.cfg.url': 'Chat service address (for parents):\nfor example wss://your-server-domain ; to try it on this computer, use ws://localhost:8787\nLeave empty to go back to the default',
      'tk.cfg.code': 'Family code (leave empty if the service has none):', 'tk.cfg.now': 'Chat service: {url}', 'tk.cfg.none': 'not set',
      'tk.log.me': 'Me: ', 'tk.log.who': '{name}: ', 'tk.log.typed': ' (typed)', 'tk.log.voice': { one: ' · {n} line spoken', other: ' · {n} lines spoken' }, 'tk.log.none': 'No chats yet.',
      'tk.log.p': 'The last 30 chats, kept only on this device.',
      'tk.concern.p': 'If the child talks about feeling sad, being bullied, being scared or being in danger, that chat is marked (judged by AI plus a keyword check on this device, so there may be false alarms). The islander reminds the child to tell a parent or teacher right away.',
      'tk.concern.seen': '✅ A parent has seen this', 'tk.concern.none': 'No chats need checking.',
      'tk.pv.h': 'ℹ️ Notes for parents: AI chat',
      'tk.pv.s1': '<li>The islanders\' words and voices, and speech scoring, are <b>made by artificial intelligence (AI)</b>. The top of the chat page always says "{l}", and the first chat of each day starts with a written notice.</li>',
      'tk.pv.s2': '<li>During chats and speech scoring, the child\'s <b>voice and the recognised text</b> go straight from this phone to Alibaba Cloud, using <b>your own Alibaba Cloud account and key</b> (Alibaba Cloud bills you directly). The developer <b>never receives</b> this voice or text, and no server stores it.</li>',
      'tk.pv.role': '<li>Islanders only play game characters and only talk about the game and everyday topics. They never ask for a real name, school, address or phone number. If the child seriously asks "Are you a real person?", the islander says it is <b>a game character made by a computer</b>.</li>',
      'tk.pv.safe': '<li>If the child talks about feeling sad, being bullied, being scared or being in danger, the islander takes it seriously and reminds them to tell a parent or teacher right away. That chat is marked: in "👪 Parent check", enter the parent PIN to read all of it. The Weekly report shows a note too.</li>',
      'tk.pv.s5': { one: '<li>The chat log and the small things islanders remember are <b>kept only on this phone</b> (the last 30 chats). Uninstalling the app deletes all of it. Chat time is at most {n} minute a day.</li>',
        other: '<li>The chat log and the small things islanders remember are <b>kept only on this phone</b> (the last 30 chats). Uninstalling the app deletes all of it. Chat time is at most {n} minutes a day.</li>' },
      'tk.pv.name': '<li>Please use a <b>game nickname</b> for the player, not a real name.</li>',
      'tk.pv.w1': '<li>When the child chats with islanders or speaking questions are scored, the child\'s <b>voice and the recognised text</b> are sent to <b>Alibaba Cloud Model Studio</b> for speech recognition, chat and scoring. The Android app connects to Alibaba Cloud directly; the web version goes through the family\'s own relay service.</li>',
      'tk.pv.w4': '<li>The chat log is kept on this phone (the last 30 chats). The web version\'s relay service also keeps a copy, which is <b>deleted automatically after 90 days</b>.</li>',
      'tk.pv.w5': '<li>Islanders remember small things the child said in the game (for example, likes drawing, has a fire monster) and bring them up next time. This is <b>kept only on this phone</b>; real names, schools and addresses are never kept.</li>',
      'tk.pv.doc': '📄 Children\'s privacy notice (full text)', 'tk.pv.forget': '🧹 Make the islanders forget past chats', 'tk.forgot': 'The islanders have forgotten past chats',
    },
  });

  // ---------- 聊天界面新加元素的样式（style.css 不归这个文件管，只补 .tk-* 的新东西） ----------
  (function css() {
    if (document.getElementById('tk-css')) return;
    const s = document.createElement('style'); s.id = 'tk-css';
    s.textContent = [
      '.tk-cnt{align-self:flex-start;margin-top:3px;font-size:12px;font-weight:800;color:var(--lagoon-d,#095e66);background:#e3f4f1;border-radius:10px;padding:1px 8px}',
      '.tk-cnt.ok{color:#1f8650;background:#dcf5e6}',
      '.tk-gt{font-weight:700}',
      '.tk-lv{font-style:normal;font-size:12px;background:#fff;color:#9a6b00;border-radius:8px;padding:0 6px;box-shadow:0 1px 0 #f0dca0;margin-right:2px}',
      '.tk-steps{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:2px}',
      '.tk-steps li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 6px;cursor:pointer;padding:1px 2px;border-radius:8px}',
      '.tk-steps li i{font-style:normal;width:1.4em;text-align:center;flex:none}',
      '.tk-steps li span{flex:1;min-width:0}',
      '.tk-steps li small{flex-basis:100%;padding-left:2em;color:#6d4c00;font-weight:700}',
      '.tk-steps li.ok span{color:#1f8650}',
      '.tk-steps li.ok i{animation:tk-pop .45s ease-out}',
      '@keyframes tk-pop{0%{transform:scale(.4)}70%{transform:scale(1.4)}100%{transform:scale(1)}}',
      '.tk-w{flex:none;white-space:nowrap;border:0;background:#fff;border-radius:10px;padding:2px 8px;font:inherit;font-size:13px;color:#6d4c00;box-shadow:0 2px 0 #f0dca0;cursor:pointer}',
      // 竖屏：词卡排成一行左右滑，给对话留地方（横屏时目标在左边一栏，照常换行）
      '.tk-ov .tk-goal .tk-words{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:3px}',
      '.tk-ov .tk-goal .tk-words::-webkit-scrollbar{display:none}',
      '.tk-w small{margin-left:4px;color:#9a7b3a;font-size:12px}',
      '.tk-w.hit{background:#dcf5e6;color:#1f8650;box-shadow:0 2px 0 #9ed8b4}',
      '.tk-w.hit::before{content:"✓ "}',
      '.tk-b.npc.tap{cursor:pointer}',
      // 别的语言的课（日语、中文）：示范句、词卡、开场白上面的读音——聊天界面里字小，读音放大一点才看得清（浏览器默认是一半大）
      // 每块之间留一点空（中文的拼音比字宽，挨着会连成一串）
      '.tk-ov rt{font-size:.66em;font-weight:400;line-height:1.2}',
      '.tk-ov .tk-steps li small rt,.tk-ov .tk-w rt{font-size:.74em}',
      '.tk-ov ruby{margin:0 .14em}',
      '.tk-b .tk-zh{display:block;margin-top:4px;padding-top:4px;border-top:1px dashed var(--line,#d3e6e2);color:var(--ink-2,#4a6478);font-size:14px}',
      '.tk-b.you.wait{opacity:.72}',   // 还没定下来的字（正在说、或者在等最后的听写结果）：淡一点
      '.tk-b.you.typed{background:#5f8f89}',
      '.tk-b.you.typed::after{content:" ⌨️";font-size:12px}',
      '.tk-tools{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
      '.tk-tools button{border:0;border-radius:12px;padding:6px 10px;background:var(--card,#fff);box-shadow:0 3px 0 var(--line,#d3e6e2);font:inherit;font-size:14px;font-weight:700;color:var(--ink,#12304a);cursor:pointer}',
      '.tk-tools button:disabled{opacity:.45}',
      '.tk-typeopen{border:0;background:none;color:var(--ink-2,#4a6478);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:2px}',
      '.tk-typenote{color:var(--ink-3,#7d93a3);font-size:12px;text-align:center}',
      '.tk-steps-r{text-align:left;width:100%;box-sizing:border-box;list-style:none;padding:8px 12px;margin:4px 0;background:var(--card,#fff);border-radius:14px;box-shadow:0 3px 0 var(--line,#d3e6e2);font-size:14px}',
      '.tk-note{color:var(--ink-2,#4a6478);font-size:13px}',
      '.tk-prog{margin:6px 0 0;font-weight:800;color:var(--lagoon-d,#095e66)}',
      '.tk-prog.ok{color:#1f8650}',
      '.tk-concern{border:2px solid #ffb74d;border-radius:12px;padding:8px 10px;margin:8px 0;background:#fff8ee;text-align:left}',
      '.tk-concern .why{color:#8a4b00;font-weight:700}',
      '.tk-lr .typed::after{content:attr(data-typed);color:var(--ink-3,#7d93a3);font-size:12px}',   // 「（打字）」按界面语言：turnsHTML 写在 data-typed 里
      '.tk-notice{text-align:left;font-size:14px;line-height:1.55}',
      '.tk-notice li{margin:4px 0}',
      '.tk-badge{display:inline-block;min-width:1.4em;margin-left:4px;border-radius:9px;background:#ff7043;color:#fff;font-size:12px;line-height:1.4em;text-align:center}',
      '.tk-raw{color:var(--ink-3,#7d93a3);font-size:12px;word-break:break-all}',
      // AI 标识：聊天页顶上的小标签、开头那句提示、首页聊天介绍里的一行
      '.tk-ai{align-self:flex-start;margin-top:2px;font-size:11px;font-weight:800;color:#4b3d8f;background:#efeaff;border-radius:8px;padding:1px 7px}',
      '.tk-b.sys{align-self:center;max-width:94%;background:#f3f0ff;color:#4b3d8f;font-size:13px;line-height:1.45;text-align:center;border-radius:12px;padding:6px 10px}',
      '.tk-ai-line{margin:4px 0 0;font-size:12px;color:var(--ink-3,#7d93a3)}',
      // 横屏：「按住说英语」是最要紧的按钮，不能被工具按钮挤成两行的小按钮；「点这里打字」的链接单独一行放右边
      '@media (orientation: landscape) and (max-height: 600px){.tk-ctl{flex-wrap:wrap}.tk-tools{flex:none}.tk-typenote{flex-basis:100%}.tk-typeopen{flex-basis:100%;text-align:right}.tk-mic{min-width:200px;white-space:nowrap}.tk-ov .tk-goal .tk-words{flex-wrap:wrap;overflow:visible}}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

  // ---------- 服务地址：本机打开时默认连本机 8787；手机上由家长在「设置服务」里填 ----------
  // 网址带 ?talk=wss://… 就记住这个服务地址（家长给孩子的手机设一次）
  // ?code=… 顺便记住家庭口令
  try {
    const sp = new URLSearchParams(location.search), q = sp.get('talk'), c = sp.get('code');
    if (q && /^wss?:\/\//.test(q)) LS('echo-talk-url', q);
    if (c) LS('echo-talk-code', c.slice(0, 40));
  } catch (e) {}
  // 从 trycloudflare 隧道打开（游戏和对话服务是同一个地址）：连同一个地址
  const sameHost = () => location.protocol === 'https:' && /\.(ts\.net|trycloudflare\.com)$/.test(location.hostname);
  // 云端模式（公开版，account.js 的 EchoCloud）：AI 全走 cloud/ 的服务器（API.md），它和中转服务（server/relay.js）同样的路径和消息，
  // 只是要登录：HTTP 带 Authorization，WebSocket 连上先发 {type:'auth'}；不发家庭口令、设备号。云端模式下不直连阿里云（有密钥也不用）
  const cloudOn = () => !!(window.EchoCloud && EchoCloud.on);
  const ACC = () => window.EchoAccount || null;
  // 安卓 APK 里有原生桥（EchoNative）并且存了百炼密钥：直连阿里云，不用中转服务（逻辑在 talk-core.js，和中转服务一样）
  const direct = () => { try { return !cloudOn() && !!(window.EchoNative && window.TalkCore && EchoNative.hasKey()); } catch (e) { return false; } };
  function relayUrl() {
    if (cloudOn()) return EchoCloud.ws;
    if (direct()) return 'direct:';
    const own = LS('echo-talk-url');
    if (own) return own.replace(/\/+$/, '');
    if (window.ECHO_TALK_URL) return window.ECHO_TALK_URL;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return 'ws://' + location.hostname + ':8787';
    // 通过 Tailscale 的 https 地址打开（tailscale serve 把 /talk 转给本机的中转服务）：连同一个地址
    if (sameHost()) return 'wss://' + location.host;
    return '';
  }
  function devId() {
    let d = LS('echo-dev');
    if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); LS('echo-dev', d); }
    return d;
  }

  // ---------- 别的语言的课：网页版的中转服务会用哪些语言聊（GET /health 的 talkLangs，tools/course/TALK.md §3、§4）----------
  // 老的中转服务没有这个字段 = 只会英语。问到的结果按服务地址记在 localStorage['echo-talk-langs']（下次打开不用等就知道，
  // 不然学习锁先按「这门语言聊不了」算，今天就免了）；每次打开游戏、换了服务地址、重新连上网都再问一次，变了就重画首页。
  // 英语课不问；云端模式（看账号的 talkLangs）、APK 直连（这一轮不做）也不问
  // 第二轮：同一次 /health 里还有 questLangs（委托）、tipLangs（发音点评），一起记着（q、t）；老的记录、老的中转服务没有 = 都不会
  const TLK = { key: 'echo-talk-langs', u: '', l: null, q: null, t: null, busy: null, busyU: '' };
  // k：'' 聊天 / 'q' 委托 / 't' 发音点评
  function relayLangs(k) {
    const u = relayHttp(); if (!u) return [];
    if (TLK.u !== u) {
      TLK.u = u; TLK.l = TLK.q = TLK.t = null;
      try {
        const j = JSON.parse(LS(TLK.key) || 'null');
        if (j && j.u === u && Array.isArray(j.l)) { TLK.l = j.l.map(String); TLK.q = Array.isArray(j.q) ? j.q.map(String) : null; TLK.t = Array.isArray(j.t) ? j.t.map(String) : null; }
      } catch (e) { /* 记的东西坏了：当没问过 */ }
    }
    return (k === 'q' ? TLK.q : k === 't' ? TLK.t : TLK.l) || [];
  }
  // list：服务器说它会的语言（数组）；不是数组（老服务器）= 只会英语。
  // more = { q 委托, t 发音点评 }：/health 问到的时候一起给（不是数组 = 不会）；不给 more（连接时服务器才说不会聊）= 这两样照原来记的
  const langArr = list => (Array.isArray(list) ? list : []).map(String).filter(x => /^[a-z]{2,3}$/.test(x)).slice(0, 12);
  function relayLangsSet(u, list, more) {
    const now = () => [relayLangs(), relayLangs('q'), relayLangs('t')].map(a => a.join(',')).join('|'), before = now();
    const l = langArr(list), q = more ? langArr(more.q) : TLK.u === u ? TLK.q || [] : [], t = more ? langArr(more.t) : TLK.u === u ? TLK.t || [] : [];
    TLK.u = u; TLK.l = l; TLK.q = q; TLK.t = t;
    // 记下来的样子：没有委托、没有点评的（老服务器）和第一轮一字不差（{ u, l }）
    LS(TLK.key, JSON.stringify(Object.assign({ u, l }, q.length ? { q } : null, t.length ? { t } : null)));
    if (now() === before) return;
    try { if (G && G.renderHome && !$('#home').hidden && $('#modal').hidden) G.renderHome(); } catch (e) { /* 还没启动 */ }
  }
  function relayAsk() {
    const u = relayHttp();
    if (!u || !CL() || cloudOn() || direct()) return Promise.resolve();
    if (TLK.busy && TLK.busyU === u) return TLK.busy;
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
    TLK.busyU = u;
    TLK.busy = fetch(u + '/health', { signal: ctl.signal }).then(r => (r.ok ? r.json() : null)).then(j => { if (j && typeof j === 'object') relayLangsSet(u, j.talkLangs, { q: j.questLangs, t: j.tipLangs }); })
      .catch(() => { /* 连不上：上次问到的先留着 */ }).then(() => { clearTimeout(tm); TLK.busy = null; });
    return TLK.busy;
  }
  window.addEventListener('online', () => { relayAsk(); });

  // ---------- AI 出错的原因（给口语打分、首页红条用：EchoTalk.lastErr()） ----------
  // offline 没网 / auth 密钥不对 / quota 额度用完或欠费 / busy 太频繁 / code 家庭口令不对 / network 其他连不上
  // （家长 2026-10-07，评估第 3 条：口语打分按这个分成「没网」和「密钥 / 额度」两类，首页红条、周报都用）
  // 先认额度：额度用完时阿里云有时回 403（Arrearage / AllocationQuota），不能当成密钥不对
  let LASTERR = null;
  function errWhy(t) {
    t = String(t || '');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    // 云端模式：服务器的错误码（API.md §2）。auth → signin 要（重新）登录、consent 要家长同意、quota 今天的免费额度用完了
    if (cloudOn()) {
      const m = /"error"\s*:\s*"(auth|quota|consent|rate|provider|unavailable)"/.exec(t);
      if (m) return { auth: 'signin', quota: 'quota', consent: 'consent', rate: 'busy', provider: 'busy', unavailable: 'busy' }[m[1]];   // unavailable = 服务器答了、只是它那边没准备好（比如没配好密钥）：不是孩子没网，别说「没网」
      // 等服务器等到超时（我们自己掐掉的请求）：手机是连着网的（上面查过），多半是服务器去连 AI 那一段慢——
      // 2026-11-20 老板的 iPhone：整段识别等了 20 秒，界面写的是「没网」，其实网是好的。算「AI 有点忙」
      if (/abort|timed? ?out/i.test(t)) return 'busy';
    }
    if (/"error"\s*:\s*"code"|家庭口令/.test(t)) return 'code';
    if (/Arrearage|AllocationQuota|quota|Insufficient|FreeTierOnly|exceeded your|overdue|欠费|额度/i.test(t)) return 'quota';
    if (/InvalidApiKey|Unauthorized|invalid.{0,3}api.{0,3}key|AccessDenied|HTTP 40[13]\b|"code"\s*:\s*"?40[13]|no key|密钥/i.test(t)) return 'auth';
    if (/Throttl|rate.?limit|HTTP 429|Too Many Requests|"error"\s*:\s*"busy"/i.test(t)) return 'busy';
    // 原生（OkHttp）/ 浏览器报的「连不上网」：找不到服务器地址、网络不可达、断网（服务器拒绝连接不算：那是中转服务没开，还是 network）
    if (/Unable to resolve host|UnknownHost|No address associated|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Network is unreachable|ENETUNREACH|ENOTFOUND|EAI_AGAIN/i.test(t)) return 'offline';
    return 'network';
  }
  function noteAi(where, text) { LASTERR = { why: errWhy(text), where, at: Date.now() }; return LASTERR.why; }
  // 给孩子看的出错说明：只说一句他听得懂的话。服务器 / 原生报的原文（HTTP 401、Unable to resolve host……）只给家长看（灰色小字 + 出错记录）
  // 每种原因一句（字表 tk.err.*）。时间用完了也用字表里的那句（中转服务发来的是中文，和这句一字不差）
  const ERR_WHY = ['offline', 'auth', 'quota', 'busy', 'code', 'network'];
  // 云端模式多两种（signin、consent），quota 说的是「今天的免费 AI 用完了」，不是「请告诉家长」（account.js 的 ac. 字表）
  const errTxt = why => (why === 'signin' || why === 'consent' ? tx('ac.err.' + why) : why === 'quota' && cloudOn() ? tx('ac.err.quota') : ERR_WHY.includes(why) ? tx('tk.err.' + why) : '');
  const kidErr = why => (why === 'daily' || why === 'limit' ? tx('tk.err.daily') : errTxt(why) || errTxt('network'));
  // 原文记进出错记录（家长设置「🔧 出错记录」），'direct:'（APK 直连）这种内部地址不写
  function errRaw(raw) {
    raw = String(raw || '').replace(/\s*[（(]?direct:[）)]?/g, '').trim();
    if (raw && window.EchoErr) EchoErr.log('ai', tx('tk.err.log', { raw }), 'talk');
    return raw;
  }

  // 头像：people.js 的 portrait 要造型对象，名单里写的是造型名
  const face = n => EchoPeople.portrait(n.lookObj || EchoPeople.LOOKS[n.look] || (CL() && !n.look && lookPick(n)) || EchoPeople.LOOKS.clerk);

  // ---------- 存档里的聊天数据 S.talk ----------
  // log 最近的记录、done 每个岛民最好几星、days 今天拿过金币的（岛民:日期）、mem 岛民记得的事、n 和每个岛民聊过几次（轮换目标）、seen 今天算过的句子
  function state() {
    const S = G.S;
    if (!S.talk || typeof S.talk !== 'object') S.talk = { log: [], done: {}, days: {} };
    const T = S.talk;
    if (!Array.isArray(T.log)) T.log = [];
    for (const k of ['done', 'days', 'mem', 'n']) if (!T[k] || typeof T[k] !== 'object') T[k] = {};
    return T;
  }
  const memKey = npc => npc.id === 'dyn' ? 'p-' + npc.name : npc.id;
  // 按能力走（做过能力检测、课程选了「按能力」）时岛民按第几级说话（game.js 的 chatLevel；没有 = null，一切照旧）；uiNow 界面语言
  const chatLv = () => { try { const v = G && G.chatLevel ? G.chatLevel() : null; return typeof v === 'number' ? v : null; } catch (e) { return null; } };
  const uiNow = () => { try { return (G && G.uiLang && G.uiLang()) || 'zh'; } catch (e) { return 'zh'; } };

  // ---------- 别的语言的课里聊天用的小工具（tools/course/TALK.md §4；英语课一个都不走，走的还是原来那一行）----------
  const langName = () => tx('pk.name.' + CL());   // 在学的语言叫什么（packs.js 的字表，按界面语言）
  // 一句算不算「开口说的这门语言的句子」、这段聊天用语音说了几句、最后判完成没有：别的课多给 talk-core 一个语言（规则在 TALK.md §2 的表里）
  const isLineOf = (text, lv) => { const l = CL(), c = Core(); return l ? c.isLine(text, lv, l) : c.isLine(text, lv); };
  const voiceCnt = (turns, lv) => { const l = CL(), c = Core(); return l ? c.voiceLines(turns, lv, l) : c.voiceLines(turns, lv); };
  const judgeOf = (g, turns, raw, live, lv) => { const l = CL(), c = Core(); return l ? c.judge(g, turns, raw, live, lv, l) : c.judge(g, turns, raw, live, lv); };
  // 要学的那句话（示范句、词卡、照着剧本说出来的开场白）：日语、中文标读音（game.js 的 rubyLine：课程里写过读音的词才标）；
  // 英语课、西语就是转义。岛民现场说的话不标
  const rbl = t => (CL() && G.rubyLine ? G.rubyLine(t) : G.esc(t));
  // 「例：……」里的示范句带读音（hx 会把参数转义，读音是 HTML：先放一个记号再换）
  const egHTML = t => (CL() ? hx('tk.eg', { s: '\u0001' }).split('\u0001').join(rbl(t)) : hx('tk.eg', { s: t }));
  // （课程角色的小步骤是 [中文说明, 这门语言的示范句, { en: 英文说明 }]：talk-core 的 goalOf 给出来 zh / en（示范句）/ task（英文说明），stepTxt 照旧用）
  // 词卡下面的意思：中文界面给中文，别的界面给英文那份（课程角色的 wordsEn）；地图上的人没有，查课程里这个词的意思
  function wordMean(npc, k) {
    const zh = (npc.wordsZh || [])[k], en = (npc.wordsEn || [])[k], v = zhUi() ? zh : en;
    if (v) return v;
    try { return (G.meanText && G.meanText(npc.words[k])) || ''; } catch (e) { return ''; }
  }
  // 课程角色没有写造型：按性别、是不是孩子，从现成的造型里按 id 固定挑一个（同一个人每次一样）
  const LOOK_POOL = { kf: ['kidF', 'studentF', 'girl'], km: ['kid', 'student', 'boy'], f: ['weather', 'nurse', 'granny', 'mom'], m: ['teacher', 'ranger', 'fisher', 'scientist'] };
  function lookPick(n) {
    const pool = LOOK_POOL[(n.kid ? 'k' : '') + (n.gender === 'm' ? 'm' : 'f')];
    let h = 0; for (const ch of String(n.id || n.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return EchoPeople.LOOKS[pool[h % pool.length]] || null;
  }
  // 点岛民的话看意思：中文界面翻成中文，英语界面翻成英文（英语课的英语界面照旧没有：就是在学这门语言）；
  // 界面语言就是在学的语言（中文界面学中文）也没有
  const canZh = () => (CL() ? CL() !== uiNow() : zhUi());
  // 别的课的评语里「更好的说法」这一句进不进每日复习：西语、中文都进；语言模块有 readable 这条规矩的（现在只有日语，lang-ja.js）问它——
  // 这句话里的汉字，课程的读音表（game.js 的 lexNow）加上它自带的词表都读得出来才进；认不全的只在评语里显示（复习是按读音打分的）。
  // 是哪门语言的规矩写在语言模块里，这里不写
  function tipToRev(text) {
    const L = CL() && G ? G.lang : null;
    if (!L || typeof L.readable !== 'function') return true;
    try { return !!L.readable(String(text || ''), G.lexNow ? G.lexNow() : null); } catch (e) { return false; }
  }

  function countLog(k, n) { if (!G) return; const L = G.dayLog(); L[k] = (L[k] || 0) + (n || 1); G.save(); }
  // AI 用量记进今天的日志（周报估算花费）：实时聊天 aiChatIn / aiChatOut（其中音频 aiChatAudioIn / aiChatAudioOut）；
  // 文字模型（评价、打勾、翻译、点评）aiTextIn / aiTextOut —— 只有 APK 直连时数得到，网页版的花在中转服务那边
  function addUse(m) {
    if (!G || !G.S) return; const L = G.dayLog();
    L.aiChatIn = (L.aiChatIn || 0) + (m.in | 0); L.aiChatOut = (L.aiChatOut || 0) + (m.out | 0);
    L.aiChatAudioIn = (L.aiChatAudioIn || 0) + (m.ain | 0); L.aiChatAudioOut = (L.aiChatAudioOut || 0) + (m.aout | 0);
  }
  function textUse(j) {
    try { const u = j && j.usage; if (!u || !G || !G.S) return; const L = G.dayLog(); L.aiTextIn = (L.aiTextIn || 0) + (u.prompt_tokens | 0); L.aiTextOut = (L.aiTextOut || 0) + (u.completion_tokens | 0); } catch (e) {}
  }

  // 今天的聊天情况（game.js 的学习锁用）：
  // voiceLines 今天用语音说的英语句子数（≥3 个英文词、不含中文，同一句只算一次；打字不算）
  // goals 今天完成的聊天小目标数；typedLines 今天打字发的句数；concern 今天有几段聊天被打上「需要家长看看」的标记
  // need 要说满几句（6）；done = goals > 0 或 voiceLines ≥ need
  function today() {
    if (!G || !G.S) return { voiceLines: 0, goals: 0, typedLines: 0, concern: 0, need: NEED, done: false };
    const L = G.dayLog(), T = state(), d = G.dayStr();
    const goals = Math.max(L.chatGoals || 0, Object.keys(T.days).filter(k => k.endsWith(':' + d)).length);
    const voiceLines = L.voiceLines || 0;
    return { voiceLines, goals, typedLines: L.typedLines || 0, concern: L.concern || 0, need: NEED, done: goals > 0 || voiceLines >= NEED };
  }
  // 家长还没看过的、有安全标记的聊天有几段（周报提示一行用）
  function concerns() { if (!G || !G.S) return 0; return state().log.filter(r => r.concern && !r.seen).length; }
  const progText = t => t.voiceLines >= NEED ? tx('tk.prog.done', { n: t.voiceLines }) : tx('tk.prog', { a: t.voiceLines, b: NEED });
  function progress() {
    const el = $('#tk-cnt'); if (!el) return;
    const t = today(); el.textContent = progText(t); el.classList.toggle('ok', t.voiceLines >= NEED);
  }

  // ---------- 首页的「和岛民聊天」 ----------
  function homeHTML() {
    if (langOff()) return '<section class="tk-home"><div class="tk-intro"><b>' + hx('tk.lang.h') + '</b><p>' + hx('tk.lang.p') + '</p></div></section>';
    const esc = G.esc, T = state(), url = relayUrl(), core = Core(), t = today(), nc = concerns(), cl = CL();
    const card = (n, now) => {
      const best = T.done[n.id], g = core.goalOf(n, core.goalIndex ? core.goalIndex(n, T.n[n.id] || 0, chatLv()) : T.n[n.id] || 0);
      // 角色的中文名、话题和音色的中文是内容：英语界面只留英文名、英文话题，没有音色那一截
      const nz = gloss({ zh: n.zh }), tz = gloss({ zh: n.topicZh }), vz = gloss({ zh: n.voiceZh });
      // 别的课：单元号按界面语言写（game.js 的 unitNo）；话题只写界面语言那一份（英文的话题不是要学的内容）
      const un = n.unit ? (cl && G.unitNo ? esc(G.unitNo(n.unit)) : 'Unit ' + n.unit) : '';
      return '<button class="tk-card' + (now ? ' now' : '') + '" data-act="talk_open" data-npc="' + n.id + '">' +
        '<img src="' + face(n) + '" alt="">' +
        '<span class="tk-t"><b>' + (n.unit ? '<em>' + un + (now ? hx('tk.card.now') : '') + '</em> ' : '') + (nz != null && !(cl && nz === n.name) ? esc(nz) + ' <small>' + esc(n.name) + '</small>' : esc(n.name)) + '</b>' +
        (cl ? '<span>' + esc(lbl({ zh: n.topicZh, en: n.topic })) + '</span>' : '<span>' + (tz != null ? esc(tz) + ' · ' : '') + '<i>' + esc(n.topic) + '</i></span>') +
        '<small>' + [vz != null ? '🔊 ' + esc(vz) : '', best ? '★'.repeat(best) : '', g.lv ? hx('tk.card.next', { lv: g.lv }) : ''].filter(Boolean).join(' · ') + '</small></span><span class="tk-go">🎙️</span></button>';
    };
    // 课本单元的聊天角色放前面，正在学的单元排第一个；后面是岛上的人
    // 只列正在学的这一册（别的册在闯关页每个单元上点「聊这个单元」）
    const cu = G.curUnit ? G.curUnit() : null, units = cu ? NPCS.list.filter(n => n.book === cu.book) : [], isle = NPCS.list.filter(n => !n.unit);
    const order = units.filter(n => n.unit === cu.n).concat(units.filter(n => n.unit !== cu.n));
    // 别的课只有单元角色（没有「岛上的人」那一栏）；课程不止一册时也只列正在学的这一册
    const cards = (units.length ? '<h3 class="tk-h">' + hx('tk.h.book', { b: cu.bshort }) + '</h3>' + order.map(n => card(n, n.unit === cu.n)).join('') + (cl && !isle.length ? '' : '<h3 class="tk-h">' + hx('tk.h.isle') + '</h3>') : '') +
      isle.map(n => card(n, false)).join('');
    const acc = cloudOn() && ACC() ? ACC().strip() : '';   // 云端模式：登录送几分钟 / 今天还剩几分钟 + 会员（account.js）
    return '<section class="tk-home">' + acc +
      '<div class="tk-intro"><b>' + hx('tk.intro.h') + '</b><p>' + hx('tk.intro.p') + '</p>' +
      '<p class="tk-prog' + (t.done ? ' ok' : '') + '">' + esc(progText(t)) + (t.done ? hx('tk.prog.ok') : hx('tk.prog.need', { n: NEED })) + '</p>' +
      '<p class="tk-ai-line">' + hx('tk.ai.line') + '</p></div>' +
      (url ? '' : '<div class="tk-warn">' + hx('tk.warn') + '</div>') +
      '<div class="tk-list">' + cards + '</div>' +
      '<div class="tk-foot"><button class="btn ghost" data-act="talk_log">' + hx('tk.foot.log') + '</button>' + (acc ? '<button class="btn ghost" data-act="ac_account">' + hx('ac.s.account') + '</button>' : '<button class="btn ghost" data-act="talk_cfg">' + hx('tk.foot.cfg') + '</button>') + '</div>' +
      '<div class="tk-foot"><button class="btn ghost small" data-act="talk_privacy">' + hx('g.set.saf.info') + '</button><button class="btn ghost small" data-act="talk_concerns">' + hx('tk.concern.btn') + (nc ? '<span class="tk-badge">' + nc + '</span>' : '') + '</button></div>' +
      '</section>';
  }

  // ---------- 麦克风：16kHz 单声道 16 位 PCM ----------
  const WORKLET = 'class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("tk-cap",P);';
  const MIC = { ctx: null, stream: null, node: null, on: false, buf: [], len: 0, rate: 16000 };
  async function micOpen() {
    if (MIC.ctx) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      let ctx;
      try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
      MIC.ctx = ctx; MIC.rate = ctx.sampleRate;
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
      const src = ctx.createMediaStreamSource(MIC.stream);
      const node = new AudioWorkletNode(ctx, 'tk-cap');
      // MIC.rec：这一次按住说的话另存一份（最多 30 秒），最后的听写结果一直不来时拿它整段再认一遍（settleHeard）
      node.port.onmessage = e => { if (MIC.on) { MIC.buf.push(e.data); MIC.len += e.data.length; if (MIC.rec && MIC.recLen < MIC.rate * 30) { MIC.rec.push(e.data); MIC.recLen += e.data.length; } if (MIC.len >= MIC.rate / 10) flushMic(); } };
      src.connect(node);   // 不接到扬声器，免得回声
      MIC.node = node;
      return true;
    } catch (e) { micClose(); throw e; }   // 打开到一半失败：别留下半个麦克风（不然界面以为能说话）
  }
  function micClose() {
    try { MIC.stream && MIC.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { MIC.ctx && MIC.ctx.close(); } catch (e) {}
    Object.assign(MIC, { ctx: null, stream: null, node: null, on: false, buf: [], len: 0 });
  }
  function flushMic() {
    if (!MIC.len) return;
    const all = new Float32Array(MIC.len); let o = 0;
    MIC.buf.forEach(b => { all.set(b, o); o += b.length; });
    MIC.buf = []; MIC.len = 0;
    // 采样率不是 16k 的浏览器：按比例抽样
    const k = MIC.rate / 16000, n = Math.floor(all.length / k), pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * k)])); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    const bytes = new Uint8Array(pcm.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    wsSend({ type: 'audio', data: btoa(s) });
  }

  // ---------- 播放岛民的声音：24kHz PCM 分块排队播；上一句的声音留在内存里，「再听一遍」用 ----------
  const OUT = { ctx: null, next: 0, srcs: [], cur: [], last: null, el: null, url: '', hold: null, notice: null };
  function playChunk(b64) {
    if (OUT.hold) { OUT.hold.push(b64); return; }   // 开头的 AI 提示还在准备：岛民的声音先排着
    if (!OUT.ctx) OUT.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = OUT.ctx;
    const bin = atob(b64), n = bin.length >> 1;
    if (!n) return;
    const buf = ctx.createBuffer(1, n, 24000), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[i] = v / 0x8000; }
    OUT.cur.push(new Float32Array(ch));
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.04, OUT.next);
    src.start(t); OUT.next = t + buf.duration;
    OUT.srcs.push(src); src.onended = () => { OUT.srcs = OUT.srcs.filter(x => x !== src); talking(); };
    talking();
  }
  function stopPlayback() {
    OUT.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); OUT.srcs = []; OUT.next = 0;
    if (OUT.notice) { try { OUT.notice.stop(); } catch (e) {} OUT.notice = null; }
    if (OUT.hold) { const q = OUT.hold; OUT.hold = null; q.length = 0; }
    talking();
  }

  // ---------- AI 标识（《人工智能生成合成内容标识办法》，2025-09-01 起）----------
  // 聊天页顶上一直写着「AI 生成」；另外每天第一次聊天，开头写一句「岛民说的话和声音都由人工智能生成」。
  // 2026-11-20 老板定：每天一次、只写字、不用语音念，也不写是哪家的模型（以前每段聊天都写 + 用打包的中文配音念一遍，还带着服务商的名字）。
  // 「今天写过没有」记在今天的学习记录里（dayLog().aiNotice，原来就在数次数）
  const aiLabel = () => tx('g.sr.aimark');   // 「AI 生成」（game.js 的字表，和口语点评的 AI 标记同一句）
  function aiNotice() {
    let L = null; try { L = G && G.dayLog ? G.dayLog() : null; } catch (e) { L = null; }
    if (L && L.aiNotice) return;
    bubble('sys', tx('tk.ai.bubble', { s: tx('tk.ai.spoken') }));
    countLog('aiNotice');
  }
  const npcSpeaking = () => OUT.srcs.length > 0 || !!(OUT.el && !OUT.el.paused);
  // 岛民说完一句：这一句的声音留着（再听一遍）
  function keepLast() { if (OUT.cur.length) OUT.last = OUT.cur; OUT.cur = []; }
  function stopReplay() { if (OUT.el) { try { OUT.el.pause(); } catch (e) {} OUT.el = null; } talking(); }
  // 24kHz 单声道浮点 → WAV（不重新采样）
  function wav24(chunks) {
    const n = chunks.reduce((a, c) => a + c.length, 0), b = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (p, t) => { for (let i = 0; i < t.length; i++) b.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 24000, true); b.setUint32(28, 48000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, n * 2, true);
    let o = 44; chunks.forEach(c => { for (let i = 0; i < c.length; i++, o += 2) { const v = Math.max(-1, Math.min(1, c[i])); b.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); } });
    return new Blob([b.buffer], { type: 'audio/wav' });
  }
  // 再听一遍（slow：0.8 倍速，音调不变）
  function replay(slow) {
    const c = C;
    if (!c || c.holding || !OUT.last || !OUT.last.length) return;
    stopPlayback(); stopReplay();
    try { if (OUT.url) URL.revokeObjectURL(OUT.url); } catch (e) {}
    OUT.url = URL.createObjectURL(wav24(OUT.last));
    const a = new Audio(OUT.url);
    a.preservesPitch = true; a.playbackRate = slow ? 0.8 : 1;
    a.onplay = a.onended = a.onpause = () => talking();
    OUT.el = a;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    countLog(slow ? 'chatSlow' : 'chatReplay');
  }

  // ---------- 一段对话 ----------
  // 正在聊的这一段：{ npc, base 人设（地图上的人是临时人设）, mk 记忆的键, goal 这次的目标, ws, bubble 岛民正在说的气泡, live 正在按着说的气泡,
  //   ticks 实时打过勾的步骤, holding, ready 连上了, ending 老师在看, done 评价出来了, rec 存好的记录, t0, turns, pend, ... }
  let C = null;
  let LAST = null;  // 上一次聊天的对象（「再聊一次」用）
  const wsSend = m => { if (C && C.ws && C.ws.readyState === 1) C.ws.send(JSON.stringify(m)); };

  function talking() {
    const f = $('#tk-face'); if (f) f.classList.toggle('speaking', npcSpeaking());
  }
  function bubble(who, text) {
    const box = $('#tk-log'); if (!box) return null;
    const d = document.createElement('div');
    d.className = 'tk-b ' + who; d.textContent = text;
    box.appendChild(d); stick();
    return d;
  }
  // 最新的话留在看得见的地方（上面的气泡填进一长段字变高了，也要跟着滚到底）
  function stick() { const box = $('#tk-log'); if (box) box.scrollTop = box.scrollHeight; }
  // 孩子说的话的气泡：按住话筒就出现，边说边出字，松开后换成整段识别结果。按服务器给的编号对上气泡
  function youBubble(c, item, take) {
    let b = item && c.pend.find(x => x._item === item);
    if (!b && take) { b = take(); if (b && item) b._item = item; }
    return b || null;
  }
  const firstFree = c => () => c.pend.find(x => !x._item) || null;
  function dropPend(c, b) { c.pend = c.pend.filter(x => x !== b); }
  // 别的课：这一行换了字可能多占一行（语言名长），对话那一栏跟着变矮——最新的一句留在看得见的地方
  function status(t) { const s = $('#tk-status'); if (s) s.textContent = t; if (CL()) stick(); }
  const readyText = () => tx(MIC.ctx ? 'tk.ready.mic' : 'tk.ready.type');

  // 大地图上随便一个人：把名字、身份、所在的岛、他说过的话交给中转服务，由服务器拼出人设（安全规则服务器自己加）
  // top：聊天界面顶上那一行（已经按界面语言拼好）；目标、步骤用 talk-core 的 personNpc（和服务器拼的一样）
  function openPerson(d) {
    // 别的课：告诉服务器这个人说哪门语言（连接参数 p 里的 lang，talk-core 的 personNpc 照它拼人设）
    if (CL()) d = Object.assign({}, d, { lang: CL() });
    const npc = {
      id: 'dyn', name: d.name, zh: d.name, lookObj: d.lookObj, voiceZh: '',
      top: tx('tk.top.free', { isle: lbl({ zh: d.islandZh || '', en: d.island || '' }) }), topic: 'Free chat',
      words: (d.words || []).slice(0, 6), desc: d,
    };
    return open(npc);
  }
  // 大地图上的支线委托（quests.js，world.js 调）：只把委托的 id 交给中转服务，人设、目标、小步骤由服务器按 id 从 quests.js 里读；
  // APK 直连时本机按同一份拼（talk-core 的 questNpc）。界面上的目标、步骤、词卡也读那一份。
  // onResult({ done, stars, said })：这段聊天有了结果就告诉大地图——关掉界面时说一次；评语在后台才到的，到了再说一次（以后一次为准）
  // 别的课（TALK.md 第二轮）：连接多带一个 lang（服务器按 talk-core 的 questNpc(q, lang, loc) 拼人设，开场白、示范句、词换成这门语言的）；
  // 界面上的目标说明还是 quests.js 的中文 / 英文那两份，示范句、词卡、开场白用课程包里这门语言的（questLoc），委托人的名字按这门课的名字牌写
  function openQuest(qid, look, onResult) {
    const q = window.QUESTS && Object.prototype.hasOwnProperty.call(QUESTS.byId, qid) ? QUESTS.byId[qid] : null;
    if (!q) return;
    if (G && G.lang) {
      const loc = questOk(qid) ? questLoc(qid) : null;
      if (!loc) { if (G.toast) G.toast(tx('tk.lang.h')); return; }
      const nm = G.termOf ? G.termOf('person', q.who) : q.who;
      return open({
        id: 'dyn', quest: q.id, name: nm, zh: nm, lookObj: look, voiceZh: '',
        top: tx('tk.top.quest', { q: lbl(q) }), topic: q.en, goalZh: q.goalZh,
        words: loc.words.map(w => w.t), wordsZh: loc.words.map(w => w.zh), wordsEn: loc.words.map(w => w.en), onResult,
      });
    }
    return open({
      id: 'dyn', quest: q.id, name: q.who, zh: q.who, lookObj: look, voiceZh: '',
      top: tx('tk.top.quest', { q: lbl(q) }), topic: q.en, goalZh: q.goalZh,
      words: q.words.map(w => w[0]), wordsZh: q.words.map(w => w[1]), onResult,
    });
  }
  // 别的课的委托：聊天界面要的那几样（目标、小步骤、开场白）。人设不在手机上拼——服务器按委托的 id 和语言自己拼。
  // 小步骤 [中文说明（quests.js）, 这门语言的示范句（课程包）, { en: 英语原句 }]：英语界面拿英语原句当这一步的说明（就是要说的那句话的意思）
  function questBase(q, cl) {
    const loc = q ? questLoc(q.id) : null;
    if (!loc) return null;
    // 目标说明里的名字（Ms Rosa、Hello Island……）换成这门课的写法（课程包给了名字表才换，game.js 的 questNames）
    const nm = s => { try { return G.questNames ? G.questNames(q.id, String(s || '')) : String(s || ''); } catch (e) { return String(s || ''); } };
    return {
      id: 'quest:' + q.id, quest: q.id, lang: cl, name: String(q.who || ''), goal: nm(q.goal), goalZh: nm(q.goalZh), opener: loc.opener,
      goals: [{ steps: q.steps.slice(0, 4).map((s, k) => [s[0], loc.steps[k], { en: s[1] }]) }],
      words: loc.words.map(w => w.t), wordsZh: loc.words.map(w => w.zh),
    };
  }
  function result(c) {
    const f = c.npc && c.npc.onResult; if (typeof f !== 'function') return;
    const ev = c.rec && c.rec.eval;
    try { f({ done: !!(c.rec && c.rec.goal), stars: ev ? ev.stars : 0, said: c.turns.some(t => t.who === 'you') }); } catch (e) { console.error(e); }
  }
  // 现在能不能开聊（大地图上的委托先问一下）：能聊返回 ''；肯定聊不了就返回给孩子看的一句话（和聊天界面里连不上时说的一样）：
  // 没开通、手机说没网、今天的聊天时间用完了。密钥不对 / 额度用完由 game.js 的 chatKeyBad 判断，那一句用 errText('auth' / 'quota') 取
  function blocked() {
    if (langOff()) return tx('tk.lang.h');
    if (!relayUrl()) return tx('w.q.noai');   // world.js 的字表：「AI 聊天还没开通，请告诉家长」
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return errTxt('offline');
    // 云端模式：没登录、要家长同意的不拦（open() 会弹登录 / 请家长同意那一页）；只有账号说今天的时间用完了才拦
    if (cloudOn()) { try { return ACC() && ACC().need('talk') === 'quota' ? tx('ac.err.quota') : ''; } catch (e) { return ''; } }
    try { if (G && G.S && (G.dayLog().chatDaily || (direct() && DAILY_SEC - usage() < 20))) return kidErr('daily'); } catch (e) { /* 读不到就让他试 */ }
    return '';
  }
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function open(id) {
    if (langOff()) { if (G && G.toast) G.toast(tx('tk.lang.h')); return; }
    const npc = typeof id === 'object' ? id : NPCS.byId[id]; if (!npc) return;
    if (C) { if (C.ending || C.done) close(); else return; }
    lmShut();   // 口语题预热的麦克风先关掉，聊天自己开
    const url = relayUrl();
    if (!url) { configure(); return; }
    // 云端模式：没登录 / 年龄段没选 / 孩子还没有家长同意 / 今天的时间用完了 → 先弹那一页（account.js），弄好了再接着开这段聊天
    if (cloudOn() && ACC() && !ACC().ask('talk', () => open(id))) return;
    const esc = G.esc, core = Core(), T = state(), cl = CL();
    // 地图上的人：目标、步骤按 talk-core 的临时人设（和服务器拼的一样）；委托按 quests.js 里那一条
    // 别的课的委托：界面要的那几样自己拼（questBase：示范句、开场白是课程包里这门语言的）；课程包里没有这一条就不开
    const qb = npc.quest && cl ? questBase(QUESTS.byId[npc.quest], cl) : null;
    if (npc.quest && cl && !qb) return;
    const base = qb || (npc.quest ? core.questNpc(QUESTS.byId[npc.quest]) : npc.desc ? core.personNpc(npc.desc) : npc), mk = memKey(npc), lvl = chatLv(), goal = core.goalOf(base, core.goalIndex ? core.goalIndex(base, T.n[mk] || 0, lvl) : T.n[mk] || 0);   // lvl：按能力走时岛民按第几级说话、挑哪个目标（没有 = null，照旧）
    // 别的课里地图上的人：示范句要是这门语言的——talk-core 拼出来的人不是这门语言就不显示示范句（不拿英语的例句教别的语言）
    if (cl && npc.desc && (!base || base.lang !== cl)) goal.steps.forEach(s => { s.en = ''; });
    // 目标：中文界面用中文的目标；别的界面语言用英文的（委托、岛民、地图上的人都有英文的 goal）。别的课里地图上的人：字表里那一句（说的是这门语言）
    const goalTx = cl && npc.desc ? tx('tk.dyn.goal', { name: npc.name, lang: langName() }) : lbl({ zh: goal.goalZh || npc.goalZh || '', en: goal.goal || npc.goal || '' }), zh = npc.wordsZh || [], mem = T.mem[mk] || null;
    // 词卡下面的意思：英语课照旧（中文界面给中文，英语界面不给）；别的课按界面语言（wordMean）
    const wm = k => (cl ? wordMean(npc, k) : gloss({ zh: zh[k] }) ? zh[k] : '');
    // 顶上：中文名 · 英文名（英语界面只有英文名）、话题（地图上的人 / 委托是拼好的 top）
    const nz = npc.zh === npc.name ? null : gloss({ zh: npc.zh }), top = npc.top != null ? npc.top : lbl({ zh: npc.topicZh, en: npc.topic });
    const ov = document.createElement('div');
    ov.id = 'tk-ov'; ov.className = 'tk-ov';
    ov.innerHTML = '<div class="tk-box">' +
      '<div class="tk-head"><img id="tk-face" src="' + face(npc) + '" alt=""><div><b>' + (nz == null ? esc(npc.name) : esc(nz) + ' · ' + esc(npc.name)) + '</b><small>' + esc(top) + '</small>' +
      '<span class="tk-ai" id="tk-ai" title="' + hx('tk.ai.title') + '">' + esc(aiLabel()) + '</span><span class="tk-cnt" id="tk-cnt"></span>' +
      (cloudOn() ? '<span class="tk-min" id="tk-min" hidden></span>' : '') + '</div>' +
      '<button class="tk-x" data-act="talk_end" aria-label="' + hx('tk.end') + '">' + hx('tk.end') + '</button></div>' +
      '<div class="tk-goal"><div class="tk-gt">🎯 ' + (goal.lv ? '<em class="tk-lv">' + esc(goal.lv) + '</em> ' : '') + esc(goalTx) + '</div>' +
      (goal.steps.length ? '<ol class="tk-steps" id="tk-steps">' + goal.steps.map((s, k) => '<li data-act="talk_step" data-i="' + k + '"><i>☐</i><span>' + esc(stepTxt(s, k)) + '</span>' + (s.en ? '<small hidden>' + egHTML(s.en) + '</small>' : '') + '</li>').join('') + '</ol>' : '') +
      '<div class="tk-words">' + npc.words.map((w, k) => '<button type="button" class="tk-w" data-act="talk_word" data-i="' + k + '">' + rbl(w) + (wm(k) ? '<small>' + esc(wm(k)) + '</small>' : '') + '</button>').join('') + '</div></div>' +
      '<div class="tk-log" id="tk-log"></div>' +
      '<div class="tk-status" id="tk-status">' + hx('tk.st.conn') + '</div>' +
      '<div class="tk-ctl"><div class="tk-tools"><button type="button" id="tk-help" data-act="talk_help" disabled>' + hx('tk.help') + '</button><button type="button" id="tk-re" data-act="talk_replay" disabled>' + hx('tk.replay') + '</button><button type="button" id="tk-slow" data-act="talk_replay" data-slow="1" disabled>' + hx('tk.slow') + '</button>' +
        // 🆘 求助的话（tools/course/WORDS.md §8）：点开是一张表，点一句先听、再自己说出来（不替他发出去）；按钮的事在 game.js（sosList）
        (G && G.helpOn && G.helpOn() ? '<button type="button" id="tk-sos" data-act="sosList" aria-label="' + hx('tk.sos') + '">🆘</button>' : '') + '</div>' +
      '<button class="tk-mic" id="tk-mic" disabled>' + hx('tk.mic') + '</button>' +
      '<button type="button" class="tk-typeopen" id="tk-typeopen" data-act="talk_typeopen" hidden>' + hx('tk.typeopen') + '</button>' +
      '<form class="tk-type" id="tk-type" hidden><input id="tk-in" maxlength="200" autocomplete="off" placeholder="' + hx('tk.type.ph') + '"><button class="btn">' + hx('tk.send') + '</button></form>' +
      '<small class="tk-typenote" id="tk-typenote" hidden>' + hx('tk.typenote') + '</small></div></div>';
    document.body.appendChild(ov);
    LAST = npc;
    // ui：这段聊天的界面语言（发给 AI：评语、打勾按它；「更好的说法」的解释是不是中文）
    C = { npc, base, mk, goal, level: lvl, ui: uiNow(), ws: null, bubble: null, holding: false, ready: false, ending: false, done: false, t0: Date.now(), turns: [], pend: [], live: null, ticks: goal.steps.map(() => false) };
    if (cl) C.lang = cl;   // 别的课：这段聊天说的是哪门语言
    if (window.EchoMusic) EchoMusic.hold(true);   // 聊天时麦克风一直开着：背景音乐静音
    const c = C;
    progress();
    OUT.last = null; OUT.cur = [];
    aiNotice();   // AI 标识：每天第一次聊天，开头写一句「岛民说的话和声音都由人工智能生成」

    // 麦克风：先要权限；要不到就只能打字（打字框直接打开）
    let micOk = false;
    try { micOk = await micOpen(); } catch (e) { micOk = false; c.micErr = (e && e.name) || 'mic'; LASTERR = { why: 'mic', name: c.micErr, where: 'chat', at: Date.now() }; }
    if (c !== C) return;
    if (micOk) $('#tk-typeopen').hidden = false;
    else {
      typeOpen(false); status(tx('tk.st.nomic'));
      // 安卓原生桥有「打开本应用的设置」时，给一个去打开麦克风权限的按钮
      try {
        if (window.EchoNative && typeof EchoNative.openAppSettings === 'function') {
          const n = $('#tk-typenote'); if (n) n.insertAdjacentHTML('afterend', '<button type="button" class="tk-typeopen" data-act="talk_micfix">' + hx('tk.micfix') + '</button>');
        }
      } catch (e) {}
    }

    const q = new URLSearchParams({ npc: npc.id, dev: devId(), name: (G.S.player && G.S.player.name) || '', g: String(goal.i) });
    // 别的课里地图上的人：p 里多一个 lang（这个人说哪门语言；课程的单元角色只发 id，语言由服务器按 id 查）
    if (npc.desc) { const d = npc.desc; q.set('p', b64(JSON.stringify(Object.assign({ name: d.name, g: d.g, kid: !!d.kid, role: d.role, island: d.island, place: d.place, lines: d.lines, words: d.words }, d.lang ? { lang: d.lang } : null)))); }
    if (npc.quest) q.set('quest', npc.quest);   // 委托：只发 id
    if (npc.quest && cl) q.set('lang', cl);     // 别的课的委托：再告诉服务器是哪门语言（TALK.md 第二轮：quest=<id>&lang=<语言>）
    // 能力级别和界面语言：中转服务只认 0–5 和认得的语言代码，那一段「怎么说话」在服务器上拼。
    // 界面不是中文时不管有没有级别都发 ui（别把他说成中国学生、评语按界面语言写）；中文界面、按课本走的照旧不发
    if (lvl != null) q.set('lv', String(lvl));
    if (lvl != null || c.ui !== 'zh') q.set('ui', c.ui);
    if (mem) q.set('m', b64(JSON.stringify({ facts: mem.facts || [], better: mem.better || '' })));
    const code = LS('echo-talk-code'); if (code && !cloudOn()) q.set('code', code);
    if (cloudOn()) q.delete('dev');   // 服务器按账号算，不要设备号（API.md §8 的参数表里没有）
    let ws;
    if (url === 'direct:') ws = directSocket(npc, (G.S.player && G.S.player.name) || '', goal.i, mem, lvl, c.ui);
    else try { ws = new WebSocket(url + '/talk?' + q); } catch (e) { status(tx('tk.st.badurl', { url })); return; }
    // 云端模式：连上先发 {type:'auth', token}（令牌不进网址、日志）；空闲时每 30 秒 ping 一次（API.md §1、§8）
    if (cloudOn() && url !== 'direct:') {
      ws.addEventListener('open', () => { try { ws.send(JSON.stringify({ type: 'auth', token: ACC() ? ACC().token() : '' })); } catch (e) { /* 断了 */ } });
      c.pingT = setInterval(() => { if (ws.readyState === 1) try { ws.send('{"type":"ping"}'); } catch (e) { /* 断了 */ } }, 30000);
    }
    c.ws = ws;
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      // 聊天界面关了以后，只收老师的评价（在后台存好）
      if (c !== C && !(m.type === 'eval' && c.ending && !c.done)) return;
      if (m.type === 'ready') {
        c.ready = true;
        // 今天聊天连上过（学习锁据此判断「Wi-Fi 连着但上不了网」：连上过就不算没网）
        { const L = G.dayLog(); if (!L.chatConn) { L.chatConn = 1; G.save(); } }
        if (LASTERR && LASTERR.where === 'chat') LASTERR = null;   // 这次连上了：以前「聊天连不上」的原因（密钥 / 额度 / 没网）作废，委托和学习锁不再拿它说事
        status(micOk ? readyText() : tx('tk.ready.type'));
        const mic = $('#tk-mic'); if (mic && micOk) mic.disabled = false;
        const h = $('#tk-help'); if (h) h.disabled = false;
        if (cloudOn() && typeof m.leftSec === 'number') { c.cl = { left: m.leftSec, at: Date.now() }; minTick(c); c.minT = setInterval(() => minTick(c), 1000); }
      } else if (m.type === 'quota' && m.warn) {   // 云端模式：这段聊天还剩 warnSec（60）秒（why：daily 今天的额度 / session 一段最长的时间）
        c.cloudWhy = m.why === 'session' ? 'session' : 'daily';
        const msg = tx(m.why === 'session' ? 'ac.t.warn.s' : 'ac.t.warn', { n: m.leftSec | 0 });
        G.toast(msg); if (!c.ending) status(msg);
        const el = $('#tk-min'); if (el) el.classList.add('low');
      } else if (m.type === 'usage') addUse(m);
      else if (m.type === 'audio') { if (c.ending) return; c.responding = true; playChunk(m.data); }   // 点了结束：岛民没说完的半句不再放
      else if (m.type === 'npc') {
        c.responding = true;
        if (!c.bubble) c.bubble = bubble('npc', '');
        if (c.bubble) { c.bubble.textContent += m.delta; stick(); }
      } else if (m.type === 'npc_done') {
        c.responding = false; if (m.text) c.turns.push({ who: 'npc', text: m.text });
        // 别的课：这句就是照着剧本说的开场白（一字不差）才标读音；岛民现场说的话不标
        if (c.lang && c.bubble && m.text && m.text.replace(/\s+/g, '') === String(c.goal.opener || '').replace(/\s+/g, '')) { const h = rbl(c.goal.opener); if (h.includes('<ruby>')) c.bubble.innerHTML = h; }
        // 说完的话可以点一下看中文（只有中文界面：英语界面就是在学这门语言，不翻译）；别的课点一下看意思（canZh）
        if (c.bubble && m.text) { c.bubble._text = m.text; if (canZh()) { c.bubble.dataset.act = 'talk_zh'; c.bubble.classList.add('tap'); c.bubble.title = tx('tk.zh.tap'); } }
        // 云端模式（公开版）：每句 AI 的话后面一个小「⚑」举报（两家商店都要求 AI 生成的内容能举报）
        if (cloudOn() && c.bubble && m.text) c.bubble.insertAdjacentHTML('beforeend', '<button type="button" class="tk-rep" data-act="talk_report" data-k="' + (c.turns.length - 1) + '" title="' + hx('ac.t.report') + '" aria-label="' + hx('ac.t.report') + '">⚑</button>');
        c.bubble = null;
        keepLast();
        if (OUT.last) ['#tk-re', '#tk-slow'].forEach(s => { const b = $(s); if (b) b.disabled = false; });
        // 一个字都没听到的气泡（没出声 / 杂音）：等 5 秒，字还没来就删掉（正在按着说的那个不删）
        const empty = c.pend.filter(b => !b._has && b !== c.live);
        if (empty.length) setTimeout(() => empty.forEach(b => { if (!b._has && b !== c.live) { b.remove(); dropPend(c, b); } }), 5000);
        // 边说边出的字有了，可最后的结果一直没来：岛民答完再等 3 秒还没来，就自己定下来（settleHeard）
        const half = c.pend.filter(b => b._has && b !== c.live && b.classList.contains('wait'));
        if (half.length) setTimeout(() => half.forEach(b => settleHeard(c, b)), 3000);
        if (!c.ending) status(readyText());
      }
      else if (m.type === 'you_item') {   // 松开话筒那一段的编号：给还没编号的最早那个气泡
        youBubble(c, m.item, firstFree(c));
      }
      else if (m.type === 'you_live') {   // 边说边出字
        const b = youBubble(c, m.item, () => (c.live && !c.live._item ? c.live : firstFree(c)()));
        if (b) { b.textContent = m.text; b._has = true; stick(); }
      }
      else if (m.type === 'you') {
        if (m.item) { c.items = c.items || new Set(); if (c.items.has(m.item)) return; c.items.add(m.item); }
        m.text = snapHeard(c, m.text);   // 和这段聊天里现成的一句话只差写法 / 一个容易听混的辅音：照现成的那句显示
        // 这一段等不到结果、已经自己定下来了（settleHeard）：晚到的结果只把字改对，不再数一遍
        const sb = m.item && c.soft ? c.soft[m.item] : null;
        if (sb) {
          delete c.soft[m.item];
          if (sb.isConnected) sb.textContent = m.text;
          if (sb._turn) sb._turn.text = m.text;
          markWords(c, m.text); checkSteps(c); stick();
          return;
        }
        const p = youBubble(c, m.item, firstFree(c));
        if (p) { p.textContent = m.text; p._has = true; p._pcm = null; p.classList.remove('wait'); dropPend(c, p); stick(); } else bubble('you', m.text);
        c.turns.push({ who: 'you', text: m.text });
        heard(c, m.text);
      } else if (m.type === 'limit') { c.limitHit = true; status(m.zh); }
      else if (m.type === 'error' && c.lang && !c.ready && (m.reason === 'unsupported_lang' || m.field === 'lang' || m.code === 'lang')) {
        // 别的课：服务器说它不会用这门语言聊（记着的是旧的）——照「还在做」说，不算连不上；记下它现在会哪些、重新问一次
        c.err = tx('tk.lang.h'); c.errCode = 'lang'; c.errWhy = 'lang';
        status('⚠️ ' + c.err);
        if (cloudOn()) { try { if (ACC()) ACC().refresh(); } catch (e) { /* 账号模块出错 */ } }
        // 委托的连接被这样拒了：只把「会用这门语言做委托」改掉（聊天照原来记的）
        else if (c.npc.quest) { relayLangsSet(relayHttp(), relayLangs(), { q: relayLangs('q').filter(x => x !== c.lang), t: relayLangs('t') }); relayAsk(); }
        else { relayLangsSet(relayHttp(), Array.isArray(m.supported) ? m.supported : relayLangs().filter(x => x !== c.lang)); relayAsk(); }
      }
      else if (m.type === 'error') {
        c.err = m.zh; c.errCode = m.code;
        if (c.ready && (m.code === 'upstream' || m.code === 'closed')) c.upErr = true;   // 连上以后服务器出错 / 断开
        c.errWhy = noteErr(c, m);
        if (c.errWhy !== 'daily') errRaw(m.zh);
        status('⚠️ ' + kidErr(c.errWhy)); if (m.code === 'code') setTimeout(configure, 600);
        if (cloudOn()) cloudErr(c, m);
      }
      else if (m.type === 'eval') { clearTimeout(c.evalTimer); finishWith(c, m.eval, m.sec, m.left, 'eval'); }
    };
    ws.onerror = () => {
      if (c !== C || c.ending || c.ready || c.errCode === 'lang') return;
      // 直连（APK）的原因在 LASTERR 里（原生回的 HTTP 401 / 找不到服务器……）；中转服务没开时只知道「连不上」
      const le = LASTERR && Date.now() - LASTERR.at < 3000 ? LASTERR.why : '', why = noteErr(c, { code: 'net', zh: '', why: le });
      if (!le) errRaw(/^direct:/.test(url) ? '' : tx('tk.err.conn', { url }));
      c.errWhy = c.errWhy || why;
      status('⚠️ ' + kidErr(why));
    };
    ws.onclose = () => {
      if (c !== C || c.ending || c.done) return;
      const mic = $('#tk-mic'); if (mic) mic.disabled = true;
      // 聊到一半断了（可能是自己这边网断了，不算服务器出错）：说过的话照样存、照样算
      if (c.ready) { c.lost = true; if (c.turns.some(t => t.who === 'you')) end('lost'); }
    };

    // 按住说话（鼠标、触屏都行；电脑上也可以按住空格）
    const mic = $('#tk-mic');
    const down = e => {
      if (mic.disabled || c.holding || c.ending) return;
      e.preventDefault(); c.holding = true;
      if (npcSpeaking()) { stopPlayback(); stopReplay(); }                 // 打断岛民
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      if (MIC.ctx && MIC.ctx.state === 'suspended') MIC.ctx.resume();
      if (OUT.ctx && OUT.ctx.state === 'suspended') OUT.ctx.resume();
      MIC.buf = []; MIC.len = 0; MIC.rec = []; MIC.recLen = 0; MIC.on = true; c.pressAt = Date.now();
      mic.classList.add('on'); mic.textContent = tx('tk.mic.on');
      // 一按下就出现自己的气泡，说的话边说边冒出来
      c.live = bubble('you wait', '🎤 …'); c.pend.push(c.live);
    };
    const up = () => {
      if (!c.holding) return;
      c.holding = false; MIC.on = false; flushMic();
      mic.classList.remove('on'); mic.textContent = tx('tk.mic');
      const b = c.live; c.live = null;
      const rec = MIC.rec ? { chunks: MIC.rec, len: MIC.recLen, rate: MIC.rate } : null; MIC.rec = null;
      if (Date.now() - c.pressAt < 400) { wsSend({ type: 'commit' }); if (b) { b.remove(); dropPend(c, b); } status(tx('tk.st.short')); return; }
      if (b) b._pcm = rec;   // 这一句的声音跟着气泡走，最后的结果到了就扔掉
      wsSend({ type: 'commit' });
      if (b && !b._has) b.textContent = '……';
      status(tx('tk.st.think'));
    };
    mic.addEventListener('pointerdown', down);
    mic.addEventListener('contextmenu', e => e.preventDefault());   // 安卓长按会弹菜单 / 选字，按住说话时不要
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => mic.addEventListener(t, up));
    c.key = e => { if (e.code === 'Space' && document.activeElement !== $('#tk-in')) { e.preventDefault(); if (e.type === 'keydown' && !e.repeat) down(e); if (e.type === 'keyup') up(); } };
    document.addEventListener('keydown', c.key); document.addEventListener('keyup', c.key);
    // 打字时弹出软键盘：输入框留在看得见的地方（横屏时屏幕只剩一小条）
    const toBottom = () => { const i = $('#tk-in'), b = $('#tk-log'); if (b) b.scrollTop = b.scrollHeight; if (i) i.scrollIntoView({ block: 'nearest' }); };
    $('#tk-in').addEventListener('focus', () => setTimeout(toBottom, 300));
    c.resize = () => { if (document.activeElement === $('#tk-in')) toBottom(); };   // 键盘弹出来、屏幕变矮：最新的一句留在看得见的地方
    window.addEventListener('resize', c.resize);
    $('#tk-type').addEventListener('submit', e => {
      e.preventDefault();
      if (c.ending || c.done) return;
      const inp = $('#tk-in'), t = inp.value.replace(/\s+/g, ' ').trim(); if (!t) return;
      if (!c.ws || c.ws.readyState !== 1) { status(tx('tk.st.notyet')); return; }
      if (npcSpeaking()) { stopPlayback(); stopReplay(); }
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      // 打字的标上 typed：不算开口句数、不给金币、不开锁（规则在 talk-core 的 judge）
      wsSend({ type: 'text', text: t }); bubble('you typed', t); c.turns.push({ who: 'you', text: t, typed: true }); inp.value = '';
      countLog('typedLines');
      checkSteps(c);
      status(tx('tk.st.think'));
    });
  }
  // 打开打字框（麦克风能用时要点「麦克风用不了？点这里打字」才出来）
  function typeOpen(focus) {
    const f = $('#tk-type'), n = $('#tk-typenote'), l = $('#tk-typeopen');
    if (f) f.hidden = false; if (n) n.hidden = false; if (l) l.hidden = true;
    if (focus) { const i = $('#tk-in'); if (i) i.focus(); }
  }

  // 学习者的气泡等不到最后的听写结果（2026-11-24 老板的截图：他说「¿De dónde eres?」，岛民听懂了、答了，可气泡停在边说边出的
  // 「te donde eres」——没有标点、没有重音，是还没定下来的字；这一句也没算进开口句数）。实时听写偶尔不给最后那一下。
  // 岛民答完 3 秒还没来：别的课把这一句的声音整段再认一遍（和口语题同一个整段识别，按这门语言，出来的带标点和重音），
  // 认不出来、英语课（英语课的听写不指定语言，说中文要显示中文）就用边说边出的字。定下来以后照常算句数、词卡、打勾；
  // 最后的结果晚到了只改字（上面 'you' 那一段的 c.soft）。服务器那边的记录里没有这一句（评语、句数以服务器的为准时会少算它）
  async function settleHeard(c, b) {
    if (c !== C || c.ending || !b.isConnected || !b.classList.contains('wait') || b._settling) return;
    b._settling = true;
    let text = '';
    const pcm = b._pcm, lang = c.lang && G.lang && G.lang.asr ? G.lang.asr.cloud : '';
    if (lang && pcm && pcm.len > pcm.rate * 0.3 && cloudSR()) {
      try { const r = await wholeAsr(pcm.chunks, pcm.len, pcm.rate, lang); text = (r && r.text) || ''; } catch (e) { text = ''; }
    }
    b._settling = false;
    if (c !== C || !b.isConnected || !b.classList.contains('wait')) return;   // 等的时候最后的结果到了
    text = snapHeard(c, String(text || b.textContent || '').trim());
    if (!text) return;
    b.textContent = text; b.classList.remove('wait'); b._pcm = null; dropPend(c, b);
    const turn = { who: 'you', text };
    b._turn = turn;
    // 这一句是在岛民那句回答之前说的：插在它前面（打勾的模型按先后看）
    c.turns.splice(c.turns.length && c.turns[c.turns.length - 1].who === 'npc' ? c.turns.length - 1 : c.turns.length, 0, turn);
    if (b._item) { c.soft = c.soft || {}; c.soft[b._item] = b; }
    heard(c, text);
    stick();
  }
  // 孩子用语音说了一句（识别结果）：算句数、目标词卡片变绿、实时打勾
  function heard(c, text) {
    countLine(text);
    markWords(c, text);
    // 说了中文（周报：中文句数）。别的课：学中文的不数；学日语的全是汉字、没有假名才算（汉字本来就是日语的字）
    if (c.lang ? c.lang !== 'zh' && /[㐀-鿿]/.test(text) && !(c.lang === 'ja' && /[ぁ-ゖァ-ヺ]/.test(text)) : /[㐀-鿿]/.test(text)) countLog('chatSaidZh');
    checkSteps(c);
  }
  // 今天用语音说的英语句子：≥3 个英文词、不含中文；同一句话一天只算一次。说满 6 句弹一句
  function countLine(text) {
    const core = Core(), cl = CL();
    // 别的课：算不算一句按这门语言的规则（talk-core 的 isLine 第 3 个参数，TALK.md §2 的表）；同一句的键、一句有多长（西语几个词，日语、中文几个字）交给这门语言的模块
    if (!(cl ? isLineOf(text, chatLv()) : core.isLine(text, chatLv()))) return false;   // 按能力走的入门 / 初级：1 个、2 个英文词就算一句
    const T = state(), d = G.dayStr(), key = cl ? String(G.lang.key ? G.lang.key(text) : text).slice(0, 80) : String(text).toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!T.seen || T.seen.d !== d) T.seen = { d, h: [] };
    if (T.seen.h.includes(key)) return false;
    T.seen.h.push(key); if (T.seen.h.length > 80) T.seen.h.shift();
    const L = G.dayLog(), before = L.voiceLines || 0, n = cl ? (G.lang.countUnits ? G.lang.countUnits(text) : 1) : core.enWords(text).length;
    L.voiceLines = before + 1; L.voiceWords = (L.voiceWords || 0) + n;
    if (n > (L.voiceMax || 0)) { L.voiceMax = n; L.voiceBest = String(text).slice(0, 160); }   // 今天说的最长的一句（周报用）
    G.save();
    progress();
    if (before < NEED && before + 1 >= NEED) {
      G.toast(tx('tk.toast.done', { n: NEED }));
      if (G.renderTop) G.renderTop();
    }
    return true;
  }
  const norm = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
  // 孩子说到目标词：卡片变绿（四个词以上的短语对上前三个词就算）
  // 别的课：西语按词比（带重音的字母照样是字母）；日语、中文没有空格，去掉标点以后看这句话里有没有这个词
  // （西语不看重音符号：识别出来的字有时不带）
  const normL = (s, latin) => { s = String(s || '').normalize('NFKC').toLowerCase(); if (latin) s = s.normalize('NFD').replace(/\p{M}+/gu, ''); return s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); };
  // 西语（2026-11-21 西语译者：照着示范句说一遍，121 张委托词卡里 43 张不变绿）：冠词不算词——卡片「la gorra」遇到「una gorra」、
  // 「el dueño」遇到「al dueño」都要变绿；「del」「al」当成「de」「a」（卡片「al lado de」遇到「al lado del parque」）。
  // 卡片和听到的话两边一样处理。带重音的「él」（他）不是冠词：先认冠词再去重音。卡片上的「…」「¿」「?」不是字母，本来就不算词
  const ES_ART = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);
  const esWords = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim().split(' ')
    .filter(w => w && !ES_ART.has(w)).map(w => normL(w, true)).map(w => (w === 'del' ? 'de' : w === 'al' ? 'a' : w)).filter(Boolean);
  // 这张词卡在这句话里说到了没有（别的课）：lang 是哪门语言，latin 是不是拉丁字母的语言
  // 语言模块自己有 hasWord 这条规矩的（日语，lang-ja.js：按读音比——词卡写假名、识别结果写成汉字也要变绿）问它；它出错就照下面按写法比
  function wordHit(w, text, lang, latin) {
    const L = G && G.lang;
    if (L && typeof L.hasWord === 'function') {
      try { return !!L.hasWord(w, text, { lex: G.lexNow ? G.lexNow() : null, entry: G.entryOf ? G.entryOf(w) : null }); } catch (e) { /* 按写法比 */ }
    }
    if (lang === 'es') { const p = esWords(w).slice(0, 3).join(' '); return !!p && (' ' + esWords(text).join(' ') + ' ').includes(' ' + p + ' '); }
    const sq = s => (latin ? ' ' + normL(s, true) + ' ' : normL(s).replace(/ /g, ''));
    const p = latin ? ' ' + normL(w, true).split(' ').slice(0, 3).join(' ') + ' ' : sq(w);
    return !!p.trim() && sq(text).includes(p);
  }
  // 气泡里显示的字：听写出来的和这段聊天里现成的一句话（小步骤的示范句、词卡）是同一句、只差写法（大小写、标点、重音符号），
  // 或者只有一个词差一个容易听混的辅音——照现成的那句显示（2026-11-24 老板：「AI 听出来了，但是识别错了」：他说「¿De dónde eres?」，
  // 岛民听懂了，气泡是「te donde eres」）。
  // 为什么不让听写的模型看着这几句话听（corpus.text）：实测它管用（说得快、有杂音时「¡Hey, dónde eres?」能听回「¿De dónde eres?」），
  // 可声音不清楚时它会把给它看的那几句话整段照抄出来——学的人没说的话进了气泡，句数和打勾也跟着算，不行。
  // 这里只改写法、不猜话：词数要一样，最多一个词不一样，而且那个词只差一个字母、是下面这几对里的；只管拉丁字母的语言（西语）
  const CONF = ['td', 'pb', 'cg', 'kg', 'qg', 'bv', 'sz', 'sc', 'zc', 'mn', 'lr'];
  const confusable = (a, b) => {
    if (a.length !== b.length) return false;
    let d = -1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (d >= 0) return false; d = i; }
    return d >= 0 && (CONF.includes(a[d] + b[d]) || CONF.includes(b[d] + a[d]));
  };
  function snapHeard(c, text) {
    try {
      if (!c || !c.lang || !G || !G.lang || G.lang.script !== 'latin') return text;
      const hw = normL(text, true).split(' ').filter(Boolean);
      if (!hw.length) return text;
      const known = [...new Set(((c.goal && c.goal.steps) || []).map(s => s && s.en).concat(c.npc.words || []).filter(p => typeof p === 'string' && p))];
      let near = '';
      for (const p of known) {
        const pw = normL(p, true).split(' ').filter(Boolean);
        if (pw.length !== hw.length) continue;
        let diff = 0, ok = true;
        for (let i = 0; i < pw.length && ok; i++) { if (pw[i] === hw[i]) continue; if (pw.length >= 2 && confusable(pw[i], hw[i])) diff++; else ok = false; }
        if (!ok || diff > 1) continue;
        if (!diff) return p;   // 同一句，只差写法
        near = near || p;
      }
      return near || text;
    } catch (e) { return text; }
  }
  function markWordsL(c, text) {
    const latin = G.lang.script === 'latin';
    (c.npc.words || []).forEach((w, k) => {
      if (wordHit(w, text, c.lang, latin)) { const el = document.querySelector('.tk-w[data-i="' + k + '"]'); if (el) el.classList.add('hit'); }
    });
  }
  function markWords(c, text) {
    if (c.lang) return markWordsL(c, text);
    const t = ' ' + norm(text) + ' ';
    (c.npc.words || []).forEach((w, k) => {
      let p = norm(w).split(' ').filter(Boolean); if (!p.length) return;
      if (p.length >= 4) p = p.slice(0, 3);
      if (t.includes(' ' + p.join(' ') + ' ')) { const el = document.querySelector('.tk-w[data-i="' + k + '"]'); if (el) el.classList.add('hit'); }
    });
  }

  // ---------- 小步骤实时打勾：每说一句，和岛民的回答同时，让便宜的模型看一眼哪几步做到了 ----------
  async function stepCall(c) {
    const core = Core(), turns = c.turns.slice(-30), n = c.goal.steps.length;
    try {
      if (direct()) {
        const body = core.stepsBody(c.base, c.goal.i, turns, c.ui); if (!body) return [];
        const r = await nativePost(core.EVAL_URL, JSON.stringify(body), 12000);
        if (!r.ok) { noteAi('steps', r.text); return []; }
        const j = JSON.parse(r.text); textUse(j);
        return core.parseSteps(j, n);
      }
      if (relayHttp()) {
        // 别的课：多带一个 lang（课程的单元角色服务器按 id 就知道语言；地图上的人只有名字，靠它知道这段聊的是哪门语言）
        const r = await relayPost('/steps', { npc: c.npc.id, nm: c.npc.id === 'dyn' ? c.npc.name : undefined, q: c.npc.quest || undefined, g: c.goal.i, ui: c.ui !== 'zh' ? c.ui : undefined, lang: c.lang || undefined, turns: turns.map(t => ({ who: t.who, text: t.text, typed: !!t.typed })) }, 12000);
        if (!r.ok) { noteAi('steps', 'HTTP ' + r.status + ' ' + r.text); return []; }
        return (JSON.parse(r.text).done || []).map(x => x | 0).filter(x => x >= 0 && x < n);
      }
    } catch (e) {}
    return [];
  }
  function checkSteps(c) {
    if (!c.goal.steps.length || c.done || c.ending || c.ticks.every(Boolean)) return;
    if (c.stepBusy) { c.stepAgain = true; return; }
    c.stepBusy = true;
    stepCall(c).then(idx => {
      c.stepBusy = false;
      const before = c.ticks.filter(Boolean).length;
      idx.forEach(k => { if (!c.ticks[k]) { c.ticks[k] = true; tick(k); } });
      const n = c.goal.steps.length, need = n <= 2 ? n : n - 1, now = c.ticks.filter(Boolean).length;
      if (c === C && !c.ending && before < need && now >= need) G.toast(tx(now === n ? 'tk.toast.all' : 'tk.toast.most'));
      if (c.stepAgain) { c.stepAgain = false; checkSteps(c); }
    });
  }
  function tick(k) {
    const li = document.querySelector('#tk-steps li[data-i="' + k + '"]'); if (!li || li.classList.contains('ok')) return;
    li.classList.add('ok'); const i = li.querySelector('i'); if (i) i.textContent = '✅';
  }

  // ---------- 点岛民的话看中文（翻译一次就记住） ----------
  // 别的课（TALK.md §3、§4）：请求里多带 lang（这句话是哪门语言）和 ui（翻成哪种界面语言：中文界面翻成中文，英语界面翻成英文），
  // 回来的还在 zh 那一格里；记住的译文按界面语言分开。英语课的请求和以前一字不差
  const ZHC = {};
  async function translate(text) {
    const cl = CL(), ck = cl ? uiNow() + '|' + text : text;
    if (ZHC[ck]) return ZHC[ck];
    const core = Core(); let zh = '';
    try {
      if (direct()) {
        const r = await nativePost(core.EVAL_URL, JSON.stringify(cl ? core.zhBody(text, { lang: cl, ui: uiNow() }) : core.zhBody(text)), 10000);
        if (r.ok) { const j = JSON.parse(r.text); textUse(j); zh = core.parseZh(j); } else noteAi('zh', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/zh', cl ? { text, lang: cl, ui: uiNow() } : { text }, 10000);
        if (r.ok) zh = String(JSON.parse(r.text).zh || ''); else noteAi('zh', 'HTTP ' + r.status + ' ' + r.text);
      }
    } catch (e) { zh = ''; }
    zh = String(zh || '').trim().slice(0, 200);
    if (zh) ZHC[ck] = zh;
    return zh;
  }
  async function showZh(b) {
    if (!b || !b._text || b._busy || !canZh()) return;   // 英语课只翻成中文：别的界面语言不出这个；别的课翻成界面语言
    let z = b.querySelector('.tk-zh');
    if (z && !z._fail) { z.hidden = !z.hidden; stick(); return; }
    if (z) z.remove();
    z = document.createElement('small'); z.className = 'tk-zh'; z.textContent = tx('tk.zh.busy'); b.appendChild(z); b._busy = true;
    const zh = await translate(b._text);
    b._busy = false;
    if (zh) { z.textContent = zh; countLog('chatZh'); }
    else { z.textContent = tx('tk.zh.fail'); z._fail = true; }
    stick();
  }

  // ---------- 帮帮我：让岛民给一句能照着说的话（不算孩子说的） ----------
  function help() {
    const c = C;
    if (!c || !c.ready || c.ending || c.done || c.holding) return;
    if (Date.now() - (c.helpAt || 0) < 3000) return;
    c.helpAt = Date.now();
    if (npcSpeaking()) { stopPlayback(); stopReplay(); }
    if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
    wsSend({ type: 'help' });
    countLog('chatHelp');
    status(tx('tk.st.help'));
  }

  // ---------- 结束：返回键、切后台、点「结束」都走这里（结束并评价） ----------
  function end(why) {
    const c = C; if (!c) return false;
    if (c.done || c.ending) { close(); return true; }     // 评价已经出来了 / 老师还在看（评价到了在后台存好）
    if (!c.turns.some(t => t.who === 'you')) { close(); return true; }   // 一句都没说：没什么可存的
    c.ending = true; c.endWhy = why || 'btn';
    stopPlayback(); stopReplay(); MIC.on = false; c.holding = false;
    ['#tk-mic', '#tk-help', '#tk-re', '#tk-slow'].forEach(s => { const b = $(s); if (b) b.disabled = true; });
    if (c.ws && c.ws.readyState === 1) {
      status(tx('tk.st.eval'));
      wsSend({ type: 'end', steps: c.ticks });
      // 老师太慢：先把这段存下来、照样算（晚到的评价还会补上）
      c.evalTimer = setTimeout(() => { if (!c.done) finishWith(c, null, null, null, 'timeout'); }, CFG.evalWait);
    } else finishWith(c, null, null, null, 'lost');
    return true;
  }
  // 安卓返回键（game.js 的 EchoBack 调）：聊天开着就「结束并评价」（评价出来了再按一次就关掉），返回 true；没开着返回 false
  function endIfOpen() { if (!C) return false; end('back'); return true; }
  function close() {
    const c = C; if (!c) return;
    C = null;
    clearInterval(c.minT); clearInterval(c.pingT);
    if (cloudOn() && ACC() && c.ready) ACC().refresh();   // 用了几分钟：账号里的「今天还剩」更新
    if (c.ending && !c.done) c.bg = true;   // 老师还在看：连接先留着，评价到了在后台存好（最多等 CFG.evalWait）
    else { try { c.ws && c.ws.close(); } catch (e) {} }
    // 连上过、服务器真出错了，又一句都没能说：今天的聊天这一项免了
    if (!c.rec && c.upErr && navigator.onLine !== false) failDay(c);
    if (window.EchoMusic) EchoMusic.hold(false);
    if (c.key) { document.removeEventListener('keydown', c.key); document.removeEventListener('keyup', c.key); }
    if (c.resize) window.removeEventListener('resize', c.resize);
    stopPlayback(); stopReplay(); micClose();
    const ov = $('#tk-ov'); if (ov) ov.remove();
    if (G.renderHome && !$('#home').hidden) G.renderHome();
    if (!c.bg && !c.again) result(c);   // 委托：告诉大地图结果（评语还没到的等到了再说；点「再试一次」接着聊的先不说）
  }
  function failDay(c) { const L = G.dayLog(); L.chatFail = 1; L.chatFailWhy = c.errCode || 'closed'; G.save(); }
  // 没连上的原因记进今天的日志（学习锁、首页红条用）
  // 云端模式：聊天顶上「AI 今天还剩几分钟」（ready 里服务器给的 leftSec 往下数；不到 2 分钟数秒）
  function minTick(c) {
    const el = $('#tk-min');
    if (!el || c !== C || !c.cl || c.ending || c.done) { clearInterval(c.minT); return; }
    const s = Math.max(0, Math.round(c.cl.left - (Date.now() - c.cl.at) / 1000));
    el.hidden = false;
    el.textContent = s < 120 ? tx('ac.t.secs', { n: s }) : tx('ac.t.left', { n: Math.floor(s / 60) });
    el.classList.toggle('low', s <= 60);
  }
  // 云端模式：还没聊上就被服务器挡了（没登录 / 令牌过期、要家长同意、今天的时间用完了）——状态行下面给一个能解决的按钮
  function cloudErr(c, m) {
    const A = ACC(); if (!A) return;
    if (m.code === 'auth') A.lost();
    else if (m.code === 'quota') A.noteQuota('talk');
    else if (m.code === 'consent') A.refresh();
    const w = m.code === 'auth' ? 'signin' : m.code === 'consent' ? 'consent' : m.code === 'quota' ? 'quota' : '';
    if (!w || c.ready || c !== C || $('#tk-fix')) return;
    const s = $('#tk-status');
    if (s) s.insertAdjacentHTML('afterend', '<div class="tk-fix" id="tk-fix"><button class="btn small sun" data-act="talk_fix" data-w="' + w + '">' + hx(w === 'signin' ? 'ac.btn.signin' : w === 'consent' ? 'ac.btn.consent' : 'ac.btn.member') + '</button></div>');
  }
  // 云端模式：今天的免费时间用完了（聊到时间到、或者一开始就没时间了）——评语页 / 空页上的一行 +「会员」
  function outLine(c, left) {
    if (!cloudOn()) return '';
    const out = (c.limitHit && c.cloudWhy === 'daily') || c.errWhy === 'daily' || (left != null && ACC() && left < ACC().MIN_START);
    return out ? '<p class="tk-out">' + hx('ac.t.out') + '</p><div class="tk-btns"><button class="btn sun small" data-act="ac_member">' + hx('ac.btn.member') + '</button></div>' : '';
  }
  // 云端模式的错误码（API.md §8）→ 这边的原因：quota 和中转服务的 daily 一样算「今天的聊天时间用完了」（学习锁照 chatDaily 办）
  const CLOUD_WHY = { quota: 'daily', auth: 'signin', consent: 'consent', rate: 'busy', provider: 'busy', conflict: 'busy', unavailable: 'busy', timeout: 'network', server: 'busy', bad_request: 'network', too_large: 'network' };
  function noteErr(c, m) {
    const cw = cloudOn() && !m.why ? CLOUD_WHY[m.code] || '' : '';
    if (cw && cw !== 'daily') LASTERR = { why: cw, where: 'chat', at: Date.now() };
    const why = m.why || cw || (m.code === 'daily' ? 'daily' : m.code === 'code' ? 'code' : m.code === 'busy' ? 'busy' : noteAi('chat', m.zh));
    const L = G.dayLog();
    if (m.code === 'daily' || cw === 'daily') L.chatDaily = 1;   // 今天的聊天时长用完了
    if (!c.ready) L.chatErr = why;
    G.save();
    return why;
  }

  // ---------- 聊完：存记录、给星星金币、记住小事；评价晚到了再补 ----------
  // raw = 服务器 / 原生给的评价（已经按 talk-core 的 judge 判过，本机按实时打勾再判一次）；how = eval / timeout / lost
  function finishWith(c, raw, sec, left, how) {
    if (c.done && (!raw || !c.rec || (c.rec.eval && c.rec.eval.ai))) return;   // 已经存过：晚到的空评价不用管
    clearTimeout(c.evalTimer);
    if (!c.turns.some(t => t.who === 'you')) {   // 一句都没说（时间到 / 断开）：不存记录
      c.done = c.ended = true;
      if (c.upErr && navigator.onLine !== false) failDay(c);
      if (c === C) showEmpty(c, left);
      return;
    }
    const first = !c.rec, r = settle(c, raw, sec, how);
    c.done = c.ended = true;
    if (cloudOn() && ACC() && how === 'eval') ACC().refresh();
    if (c !== C) {   // 聊天界面已经关了：在后台存好，弹一句
      if (r.newGoal) G.toast(tx('tk.toast.goal', { name: c.npc.name }) + (r.coins ? tx('tk.coins', { n: r.coins }) : ''));
      try { c.ws && c.ws.close(); } catch (e) {}
      if (G.renderHome && !$('#home').hidden) G.renderHome();
      result(c);
      return;
    }
    if (!first && how === 'eval') try { c.ws && c.ws.close(); } catch (e) {}
    showEval(c, r, left);
  }
  function settle(c, raw, sec, how) {
    const core = Core(), T = state(), npc = c.npc, L = G.dayLog();
    const ev = c.lang ? judgeOf(c.goal, c.turns, raw, c.ticks, c.level) : core.judge(c.goal, c.turns, raw, c.ticks, c.level);   // 别的课：数句子按这门语言的规则
    let rec = c.rec, coins = 0, newGoal = false;
    if (!rec) {
      rec = c.rec = {
        t: c.t0, npc: npc.id, nm: npc.id === 'dyn' ? npc.name : undefined, q: npc.quest || undefined, g: c.goal.i,
        turns: c.turns.slice(0, 40).map(t => t.typed ? { who: t.who, text: t.text, typed: 1 } : { who: t.who, text: t.text }),
        eval: null, sec: sec != null ? sec : Math.round((Date.now() - c.t0) / 1000), voice: c.lang ? voiceCnt(c.turns, c.level) : core.voiceLines(c.turns, c.level),
      };
      if (how !== 'eval') rec.late = how;   // 老师没来得及评价（timeout 超时 / lost 断开）
      T.log.unshift(rec); trimLog(T);
      L.chats = (L.chats || 0) + 1;
      if (npc.id !== 'dyn') T.n[c.mk] = (T.n[c.mk] || 0) + 1;   // 下次换一个目标（地图上的人只有一个目标，不用数）
    }
    if (ev) { rec.eval = ev; delete rec.late; if (!ev.ai) rec.late = how; }
    // 安全标记：模型说的，或者本机查到的
    if (((ev && ev.concern) || core.worried(c.turns)) && !rec.concern) {
      rec.concern = 1; rec.why = (ev && ev.concernWhy) || '';   // 模型没说是哪句（本机查到的）：空着，显示时用字表那句（whyOf）
      L.concern = (L.concern || 0) + 1;
    }
    if (ev && ev.done && !rec.goal) {
      rec.goal = 1; newGoal = true; L.chatGoals = (L.chatGoals || 0) + 1;
      const key = (npc.id === 'dyn' ? 'p-' + npc.name : npc.id) + ':' + G.dayStr();   // 地图上的人按名字算，每人每天一次金币
      if (!T.days[key]) { T.days[key] = 1; coins = 10 + 5 * ev.stars; G.S.coins += coins; rec.coins = coins; }
      if (G.qProg) G.qProg('talk', 1);   // 每日任务「和岛民聊天，完成 1 个目标」
    }
    if (ev && npc.id !== 'dyn') T.done[npc.id] = Math.max(T.done[npc.id] || 0, ev.stars);
    if (ev && ev.ai && !rec.taught) {
      rec.taught = 1;
      // 老师给的「更好的说法」进每日复习（第三个参数是孩子的原话，复习时可以显示「你原来说的」）。
      // 第二个参数存成这句的中文意思：评语是按别的界面语言写的，解释就不是中文，不存
      // 别的课：西语、中文照样进（复习时按这门语言的规则打分）；日语一句一句看——读音表认得全的才进（tipToRev），认不全的只在评语里显示
      if (G.revAddFree) ev.tips.forEach(t => { if (!c.lang || tipToRev(t.better)) G.revAddFree(t.better, c.ui === 'zh' ? t.zh : '', t.said); });
      remember(c.mk, ev);
    }
    // 连上过、服务器真出错，又没拿到老师的评价：今天的聊天这一项免了（没网、一开始就没连上的不算）
    if (!(ev && ev.ai) && c.upErr && navigator.onLine !== false) failDay(c);
    for (const k of Object.keys(T.days)) if (!k.endsWith(G.dayStr())) delete T.days[k];
    G.save(); if (G.renderTop) G.renderTop();
    return { ev, coins: coins || (newGoal ? 0 : rec.coins || 0), newGoal, rec };
  }
  // 最近 30 段；有安全标记、家长还没看过的多留着（最多再留 10 段）。
  // 再按字数封顶（LOG_CHARS）：一段最多 40 句、一句最长几百字，40 段最坏能到四五十万字，整份存档每存一次都要带着它。
  // 超了就从最早的删起；最近 10 段、家长还没看过的安全标记不删
  const LOG_CHARS = 150000;
  function trimLog(T) {
    T.log = T.log.slice(0, 30).concat(T.log.slice(30).filter(r => r.concern && !r.seen).slice(0, 10));
    const len = T.log.map(r => JSON.stringify(r).length);
    let n = len.reduce((a, b) => a + b, 0);
    for (let i = T.log.length - 1; i >= 10 && n > LOG_CHARS; i--) {
      if (T.log[i].concern && !T.log[i].seen) continue;
      n -= len[i]; T.log.splice(i, 1);
    }
  }
  // 岛民记住这次聊到的游戏里的小事（只存在这台手机里）和老师改过的一句，下次开场提起
  function remember(mk, ev) {
    const T = state(), core = Core(), old = T.mem[mk] || {}, seen = new Set();
    const facts = (ev.memory || []).concat(old.facts || []).filter(x => { const k = String(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const m = core.memOf({ facts, better: ev.tips && ev.tips[0] ? ev.tips[0].better : '' });
    if (!m) { delete T.mem[mk]; return; }
    T.mem[mk] = { facts: m.facts, better: m.better, t: Date.now() };
    const ks = Object.keys(T.mem);
    if (ks.length > 40) ks.sort((a, b) => (T.mem[a].t || 0) - (T.mem[b].t || 0)).slice(0, ks.length - 40).forEach(k => delete T.mem[k]);
  }

  function evalBtns(c) {
    // 大地图上的委托：完成了回去领奖励；没完成可以马上再试一次，也可以以后再说（委托一直留着）
    if (c.npc.quest) {
      return c.rec && c.rec.goal ? '<div class="tk-btns"><button class="btn" data-act="talk_close">' + hx('tk.btn.reward') + '</button></div>'
        : '<div class="tk-btns"><button class="btn" data-act="talk_again" data-npc="dyn">' + hx('tk.btn.retry') + '</button><button class="btn ghost" data-act="talk_close">' + hx('w.q.later') + '</button></div>';
    }
    return '<div class="tk-btns"><button class="btn" data-act="talk_again" data-npc="' + c.npc.id + '">' + hx('tk.btn.again') + '</button><button class="btn ghost" data-act="talk_close">' + hx('tk.btn.back') + '</button></div>';
  }
  function gateLine() { try { return G.gate && G.gate().on && G.gate().open ? '<p class="tk-coin">' + hx('tk.gate.open') + '</p>' : ''; } catch (e) { return ''; } }
  function progLine() { const t = today(); return '<p class="tk-prog' + (t.voiceLines >= NEED ? ' ok' : '') + '">' + G.esc(progText(t)) + '</p>'; }
  // 一句都没说就结束了（连不上 / 时间到）
  function showEmpty(c, left) {
    const esc = G.esc, box = $('#tk-ov .tk-box'); if (!box) return;
    const why = c.err ? c.errWhy || errWhy(c.err) : '', raw = c.err ? String(c.err).replace(/\s*[（(]?direct:[）)]?/g, '').trim() : '';
    box.innerHTML = '<div class="tk-eval"><img src="' + face(c.npc) + '" alt="">' +
      (why === 'daily' ? '<b>' + hx('tk.e.daily.h') + '</b><p>' + esc(kidErr(why)) + '</p>'
        : c.err ? '<b>' + hx('tk.e.fail.h') + '</b><p>' + esc(kidErr(why)) + '</p>' + (raw && raw !== kidErr(why) ? '<p class="tk-raw">' + hx('tk.e.raw', { raw }) + '</p>' : '')
        : '<b>' + hx('tk.e.quiet.h') + '</b><p>' + hx('tk.e.quiet.p') + '</p>') +
      progLine() + (left != null ? '<p class="tk-time">' + hx('tk.left', { n: Math.floor(left / 60) }) + '</p>' : '') + outLine(c, left) + evalBtns(c) + '</div>';
  }
  function showEval(c, r, left) {
    const esc = G.esc, ev = r.ev, rec = r.rec, box = $('#tk-ov .tk-box'); if (!box) return;
    const steps = c.goal.steps, typed = c.turns.some(t => t.who === 'you' && t.typed), voice = rec.voice;
    const coins = r.coins;
    // 小步骤：中文界面照旧；别的界面语言没有步骤说明的（「第 n 步」）后面带上示范句
    const stepR = (s, k) => esc(stepTxt(s, k)) + (!zhUi() && !s.task && s.en ? ' <small>' + egHTML(s.en) + '</small>' : '');
    // 「更好的说法」哪几句明天进每日复习（别的课一句一句看，tipToRev；英语课都进）：都进 / 都不进 / 只有一部分进，标题各一句
    const inRev = ev ? ev.tips.map(t => !c.lang || tipToRev(t.better)) : [];
    const tipsKey = inRev.every(Boolean) ? 'tk.r.tips' : inRev.some(Boolean) ? 'tk.r.tips.some' : 'tk.r.tips.only';
    let body;
    if (ev) {
      body = '<div class="tk-stars">' + '★'.repeat(ev.stars) + '<i>' + '★'.repeat(3 - ev.stars) + '</i></div>' +
        '<b>' + hx(ev.done ? (ev.stars === 3 ? 'tk.r.all' : 'tk.r.most') : voice < 3 ? 'tk.r.speak' : 'tk.r.near') + '</b>' +
        (voice < 3 ? '<p class="tk-note">' + hx('tk.r.few', { typed: typed ? tx('tk.r.typed') : '' }) + '</p>' : '') +
        (steps.length ? '<ul class="tk-steps-r">' + steps.map((s, k) => '<li>' + (ev.steps[k] ? '✅ ' : '⬜ ') + stepR(s, k) + '</li>').join('') + '</ul>' : '') +
        (ev.praise ? '<p>' + esc(ev.praise) + '</p>' : '') +
        (ev.ai ? '<p class="tk-ai-line">' + hx('tk.r.ai') + '</p>' : '') +
        (!ev.ai ? '<p class="tk-note">' + hx('tk.r.noai') + '</p>' : '') +
        (ev.tips.length ? '<div class="tk-tips"><b>' + hx(tipsKey) + '</b>' + ev.tips.map((t, k) => '<div><s>' + esc(t.said) + '</s><br>→ <b>' + esc(t.better) + '</b>' + (tipsKey === 'tk.r.tips.some' && inRev[k] ? ' 📅' : '') + '<small>' + esc(t.zh) + '</small></div>').join('') + '</div>' : '') +
        (coins ? '<p class="tk-coin">' + hx('tk.r.coins', { n: coins }) + '</p>' : '') +
        (c.npc.quest ? '<p class="tk-coin">' + (ev.done ? hx('tk.r.q.done', { name: c.npc.name }) : hx('tk.r.q.not')) + '</p>' : '');
    } else {
      body = '<b>' + hx('tk.r.late.h') + '</b><p>' + hx('tk.r.late.p') + '</p>';
    }
    if (ev && ev.concern) body += '<p class="tk-note">' + hx('tk.r.concern') + '</p>';
    box.innerHTML = '<div class="tk-eval"><img src="' + face(c.npc) + '" alt="">' + body + progLine() + gateLine() +
      '<p class="tk-time">' + hx('tk.time', { n: rec.sec }) + (left != null ? ' · ' + hx('tk.left', { n: Math.floor(left / 60) }) : '') + '</p>' + outLine(c, left) + evalBtns(c) +
      // 云端模式：评语也是 AI 写的，能举报
      (cloudOn() && ev && ev.ai ? '<button class="link tk-rep-eval" data-act="talk_report_eval">' + hx('ac.t.report.eval') + '</button>' : '') + '</div>';
    if (ev && ev.done && r.newGoal && G.confetti) G.confetti(80);
  }

  // ---------- 安卓 APK 直连：原生 WebSocket（带密钥）⇄ 阿里云；对外装成和中转服务一样的 WebSocket，聊天界面不用改 ----------
  const NWS = {}; let nid = 0;
  window.__echoNative = (id, type, data) => { const h = NWS[id]; if (h) h(type, data); };
  // 和中转服务的默认值一样：每天 30 分钟、每段 8 分钟。销售版每天 15 分钟（AI 费用是家长自己付的，评估建议每天 10–15 分钟）
  const DAILY_SEC = (window.DEX && DEX.sales ? 15 : 30) * 60, SESSION_SEC = 8 * 60;
  function usage(add) {
    const day = G.dayStr(); let U = {};
    try { U = JSON.parse(LS('echo-talk-usage') || '{}'); } catch (e) {}
    for (const k of Object.keys(U)) if (k !== day) delete U[k];
    if (add) { U[day] = (U[day] || 0) + add; LS('echo-talk-usage', JSON.stringify(U)); }
    return U[day] || 0;
  }
  function directSocket(npcIn, player, gi, mem, level, ui) {
    const C = window.TalkCore, N = window.EchoNative, id = ++nid;
    const sock = { readyState: 0, onmessage: null, onerror: null, onclose: null };
    const toGame = m => { if (sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const shut = () => { if (sock.readyState === 3) return; sock.readyState = 3; delete NWS[id]; if (sock.onclose) sock.onclose(); };
    const npc = npcIn.quest ? C.questNpc(window.QUESTS && QUESTS.byId[npcIn.quest]) : npcIn.desc ? C.personNpc(npcIn.desc) : npcIn;
    const left = DAILY_SEC - usage();
    if (!npc || left < 20) { setTimeout(() => { toGame({ type: 'error', code: 'daily', zh: tx(npc ? 'tk.err.daily' : 'tk.err.nonpc') }); shut(); }, 0); sock.send = () => {}; sock.close = shut; return sock; }
    const S = C.session({
      npc, player: String(player).replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16), limitSec: Math.min(SESSION_SEC, left), leftSec: left, goal: gi, memory: mem, level, ui,
      up: m => { try { N.wsSend(id, JSON.stringify(m)); } catch (e) {} },
      out: toGame,
      evaluate: (n, turns, o) => new Promise(res => {
        const body = C.evalBody(n, turns, o); if (!body) return res(null);
        const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res(null); }, CFG.httpWait);
        NWS[pid] = (type, data) => { clearTimeout(tm); delete NWS[pid]; let ev = null; try { if (type === 'ok') { const j = JSON.parse(data); textUse(j); ev = C.parseEval(j, o && o.ui); } else noteAi('eval', data); } catch (e) {} res(ev); };
        try { N.post(pid, C.EVAL_URL, JSON.stringify(body)); } catch (e) { clearTimeout(tm); res(null); }
      }),
      onEnd: ({ sec }) => { usage(sec); try { N.wsClose(id); } catch (e) {} setTimeout(shut, 300); },
    });
    NWS[id] = (type, data) => {
      if (type === 'open') { sock.readyState = 1; S.start(); }
      else if (type === 'message') { let m; try { m = JSON.parse(data); } catch (e) { return; } S.fromUp(m); }
      else if (type === 'closed') S.upClosed();
      else if (type === 'error') { noteAi('chat', data); if (sock.readyState === 0 && sock.onerror) sock.onerror({}); S.upClosed(tx('tk.err.up', { msg: String(data || '').slice(0, 60) })); }
    };
    sock.send = str => { let m; try { m = JSON.parse(str); } catch (e) { return; } S.fromGame(m); };
    sock.close = () => { if (!S.closed) S.finish(); else shut(); };
    try { N.wsOpen(id, C.REALTIME_URL + '?model=' + encodeURIComponent(C.MODEL)); } catch (e) { setTimeout(() => NWS[id] && NWS[id]('error', e.message), 0); }
    return sock;
  }

  // 原生桥的 HTTPS（带密钥）：→ Promise<{ ok, text }>
  function nativePost(url, body, ms) {
    return new Promise(res => {
      const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res({ ok: false, text: 'timeout' }); }, ms || CFG.httpWait);
      NWS[pid] = (type, data) => { clearTimeout(tm); delete NWS[pid]; res({ ok: type === 'ok', text: data || '' }); };
      try { window.EchoNative.post(pid, url, body); } catch (e) { clearTimeout(tm); delete NWS[pid]; res({ ok: false, text: e.message }); }
    });
  }

  // ---------- 跟读打分：APK 的 WebView 没有浏览器语音识别 → 录一句话，交给阿里云识别成文字（game.js 再按原来的办法打分） ----------
  // 说完停顿 1 秒多自动结束；5 秒都没出声就算没说；最长 8 秒
  const SR = { stop: null };
  function wav16(chunks, len, rate) {
    const all = new Float32Array(len); let o = 0;
    chunks.forEach(c => { all.set(c, o); o += c.length; });
    const k = rate / 16000, n = Math.floor(len / k), b = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (p, t) => { for (let i = 0; i < t.length; i++) b.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * k)])); b.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    const bytes = new Uint8Array(b.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  // 网页版：中转服务（server/relay.js 的 /asr、/tip、/zh、/steps）替 APK 的原生桥去连阿里云
  const relayHttp = () => { const u = relayUrl(); return u && u !== 'direct:' ? u.replace(/^ws/, 'http') : ''; };
  const cloudSR = () => direct() || !!relayHttp();
  async function relayPost(path, body, ms) {
    // 云端模式：同样的路径和请求体（/v1/asr、/tip、/tts、/zh、/steps、/place），带登录令牌；没登录不发出去，直接回 401（API.md §8）
    if (cloudOn()) return ACC() ? ACC().post(path, body, ms || CFG.httpWait) : { ok: false, status: 0, text: 'no account module' };
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || CFG.httpWait);
    try {
      const code = LS('echo-talk-code');
      const r = await fetch(relayHttp() + path + (code ? '?code=' + encodeURIComponent(code) : ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      return { ok: r.ok, status: r.status, text: await r.text() };
    } catch (e) { return { ok: false, status: 0, text: e.message }; } finally { clearTimeout(tm); }
  }
  // AI 点评：目标句子 + 识别出来的话 → 一句话（按界面语言写），指出最主要的差别、怎么读对。提示词在 talk-core 的 tipBody（中转服务用同一份）
  const TIPS = {};
  async function aiTip(target, heard) {
    // iPhone 的本机识别不联网、不用登录也能打分：没网、云端模式没登录时点评就不要了（不白发一个请求、不挂「没网」的红条）
    if ((typeof navigator !== 'undefined' && navigator.onLine === false) || (cloudOn() && !(ACC() && ACC().signed()))) return '';
    const ui = uiNow(), k = ui + '|' + target + '|' + heard, core = Core();
    if (TIPS[k] !== undefined) return TIPS[k];
    // 别的课（TALK.md 第二轮）：服务器会用这门语言写点评才问（tipOk；game.js 的 aiTip 也先问过），请求里多带一个 lang——
    // 提示词由服务器按 talk-core 的 tipBody(target, heard, ui, lang) 拼。APK 直连在别的课里不走这里（tipOk 是 false）。英语课的请求一字不变
    const cl = CL();
    if (G && G.lang && !tipOk()) return '';
    const body = core.tipBody(target, heard, ui);
    let tip = '';
    try {
      if (direct()) { const r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 10000); if (r.ok) { const j = JSON.parse(r.text); textUse(j); tip = j.choices[0].message.content; } else noteAi('tip', r.text); }
      else if (relayHttp()) {
        const r = await relayPost('/tip', { target, heard, ui: ui !== 'zh' ? ui : undefined, lang: cl || undefined }, 10000);
        if (r.ok) tip = JSON.parse(r.text).tip;
        // 别的课：服务器这时候才说不会用这门语言写点评（记着的是旧的）——不算 AI 出错，记下来以后不再问
        else if (cl && r.status === 400 && /unsupported_lang|"(?:error|field)"\s*:\s*"lang"/.test(r.text)) {
          if (cloudOn()) { try { if (ACC()) ACC().refresh(); } catch (e) { /* 账号模块出错 */ } }
          else relayLangsSet(relayHttp(), relayLangs(), { q: relayLangs('q'), t: relayLangs('t').filter(x => x !== cl) });
        }
        else noteAi('tip', 'HTTP ' + r.status + ' ' + r.text);
      }
    } catch (e) { tip = ''; }
    tip = core.tipText(tip, ui);
    TIPS[k] = tip;
    return tip;
  }
  // 能力检测的口语问答题（placement.js）：把题目、这道题的评分要点、听写出来的话交给文字模型，判 0 / 1 / 2（talk-core 的 placeBody）。
  // 和上面的点评走同一条路：APK 直连阿里云；网页版走中转服务的 /place——只发题目的 id，题目和评分要点由服务器从 placement-data.js 里查。
  // 判不了（没网、密钥、超时、回的不是分数）返回 null，由检测那边决定跳过口语（不拿自评顶）
  async function placeJudge(item, heard, lang) {
    if (!item || !heard) return null;
    const core = Core();
    try {
      if (direct()) {
        const body = core.placeBody(item, heard, { lang }); if (!body) return null;
        const r = await nativePost(core.EVAL_URL, JSON.stringify(body), 12000);
        if (!r.ok) { noteAi('place', r.text); return null; }
        const j = JSON.parse(r.text); textUse(j);
        return core.parsePlace(j);
      }
      if (relayHttp()) {
        const r = await relayPost('/place', { id: item.id, lang: lang || 'en', heard: String(heard).slice(0, 500) }, 12000);
        if (!r.ok) { noteAi('place', 'HTTP ' + r.status + ' ' + r.text); return null; }
        const s = JSON.parse(r.text).score;
        return s === 0 || s === 1 || s === 2 ? { score: s } : null;
      }
    } catch (e) { /* 判不了 */ }
    return null;
  }
  // ---------- 为你出的题（game.js 的「为你出的题」，tools/course/ADAPT.md）：按要练的词，让文字模型现写几句新的练习句 ----------
  // 和上面的点评、检测判分走同一条路：APK 直连阿里云（talk-core 的 genBody）；网页版走中转服务的 /gen、云端模式走 /v1/gen——
  // 手机只发数据（在学哪门语言、界面语言、难度档、要练的词、学过的词），出题的要求由服务器按 talk-core 拼。
  // 不管从哪条路回来的，都再用 talk-core 的 genCheck 核对一遍（不是这门语言的、太长的、意思不对的不要）。
  // 出不了（没网、云端模式没登录、老服务器没有这条路、这门语言它不会、超时、回的不合规矩）→ null：game.js 改用课程里现成的题，不报错、不算 AI 出错
  const GEN = { off: {} };   // 这次打开 App 记着：哪个服务器的哪门语言出不了题（老服务器回 404、不会这门语言回 400）
  const genOk = () => { try { return !!(Core() && Core().genBody) && !(typeof navigator !== 'undefined' && navigator.onLine === false) && (direct() || (!!relayHttp() && !(cloudOn() && !(ACC() && ACC().signed())))); } catch (e) { return false; } };
  async function genQuiz(raw) {
    const core = Core(), o = core && core.genIn ? core.genIn(raw) : null;
    if (!o || !genOk()) return null;
    try {
      if (direct()) {
        const r = await nativePost(core.EVAL_URL, JSON.stringify(core.genBody(o)), 25000);
        if (!r.ok) return null;
        const j = JSON.parse(r.text); textUse(j);
        return core.parseGen(j, o);
      }
      const key = relayHttp() + '|' + o.lang;
      if (GEN.off[key]) return null;
      const r = await relayPost('/gen', o, 25000);
      if (!r.ok) { if (r.status === 404 || (r.status === 400 && /lang/.test(r.text))) GEN.off[key] = 1; return null; }
      return core.genCheck(JSON.parse(r.text), o);
    } catch (e) { return null; }
  }
  // ---------- 别的语言的课（es / ja / zh）的 AI 识别、合成：能不能带上这门语言（API.md §8 的 lang） ----------
  // 语言代码 ↔ 合成的 language_type（LANG.asr.cloud 'es' 和 LANG.tts.cloud 'Spanish' 两种写法都认）
  const SPL = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
  const splCode = v => Object.keys(SPL).find(c => c === v || SPL[c] === v) || '';
  // 云端模式：看服务器说它认哪些（GET /v1/me 的 speechLangs；老服务器没有这个字段 = 不认 → 口语题照旧「先跳过」、朗读用本机声音）；
  // APK 直连阿里云：直接带上语言；网页版的家庭中转服务：识别带上语言（老的中转服务不认，照旧当英语听——和以前一样），
  // 合成不走（不知道它认不认，老的会用英语的声音念别的语言），用本机声音
  function speechLang(v, kind) {
    const c = splCode(v);
    if (!c) return false;
    if (c === 'en') return true;
    if (cloudOn()) return !!(ACC() && ACC().speechLang && ACC().speechLang(c));
    if (direct()) return true;
    return kind !== 'tts';
  }
  // 朗读没有提前配音的句子：阿里云语音合成，返回音频地址（同一句话这次打开游戏里只合成一次）。
  // lang 默认英语（发出去的和以前一字不差）；别的语言的课给 LANG.tts.cloud（'Spanish' …），服务器不认就不发、回空（game.js 用本机声音）
  const TTSC = {};
  const TTS_V = { f: 'Cherry', m: 'Ethan' };   // APK 直连时别的语言的音色（和 cloud/ 的默认一样；上线前对着阿里云的音色表核对）
  async function cloudTTS(text, g, lang) {
    const code = splCode(lang) || 'en';
    lang = SPL[code];
    if (code !== 'en' && !speechLang(code, 'tts')) return '';
    const k = (g || 'f') + '|' + lang + '|' + text;
    if (TTSC[k]) return TTSC[k];
    let url = '';
    try {
      if (direct()) {
        const V = code === 'en' ? { f: 'Jennifer', m: 'Aiden' } : TTS_V;
        const body = { model: 'qwen3-tts-flash', input: { text: String(text).slice(0, 300), voice: g === 'm' ? V.m : V.f, language_type: lang } };
        const r = await nativePost('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', JSON.stringify(body), 6000);
        if (r.ok) url = JSON.parse(r.text).output.audio.url; else noteAi('tts', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/tts', code === 'en' ? { text, g } : { text, g, lang: code }, 6000);
        if (r.ok) url = JSON.parse(r.text).url; else noteAi('tts', 'HTTP ' + r.status + ' ' + r.text);
      }
    } catch (e) { url = ''; }
    url = String(url || '').replace(/^http:/, 'https:');
    if (url) TTSC[k] = url;
    return url;
  }
  // ---------- 家长首次设置向导的「测试」：密钥能不能用 ----------
  // 先把密钥存进原生（只存在这台手机里，网页拿不回来），再用它发一个最小的请求（qwen-plus，最多回 1 个 token，不到 0.01 元），看阿里云怎么说。
  // 返回 { ok, why, raw }：why = ok / format 不像密钥 / auth 密钥不对 / quota 欠费或额度用完 / inactive 服务或模型没开通 /
  // offline 没网 / busy 太忙 / network 别的连不上 / nonative 不在 APK 里；raw 是阿里云的原话（给家长看，里面没有密钥）。密钥本身不打印、不记日志
  async function keyTest(k) {
    k = String(k || '').trim();
    if (!window.EchoNative || typeof EchoNative.setKey !== 'function' || typeof EchoNative.post !== 'function') return { ok: false, why: 'nonative', raw: '' };
    if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(k)) return { ok: false, why: 'format', raw: '' };
    try { EchoNative.setKey(k); } catch (e) { return { ok: false, why: 'nonative', raw: '' }; }
    if (navigator.onLine === false) return { ok: false, why: 'offline', raw: '' };
    const body = { model: Core().EVAL_MODEL, max_tokens: 1, temperature: 0, messages: [{ role: 'user', content: 'Hi' }] };
    const r = await nativePost(Core().EVAL_URL, JSON.stringify(body), 12000);
    if (r.ok) { try { textUse(JSON.parse(r.text)); } catch (e) {} LASTERR = null; return { ok: true, why: 'ok', raw: '' }; }
    const raw = String(r.text || '').split(k).join('…').slice(0, 200);
    if (/Unpurchased|NotActivated|not.?activated|not.?opened|Model\.AccessDenied|model_not_found|ModelNotFound|does not exist/i.test(raw)) return { ok: false, why: 'inactive', raw };
    return { ok: false, why: raw === 'timeout' ? 'network' : errWhy(raw), raw };
  }

  // ---------- 口语打分的识别：边说边送阿里云实时识别（qwen3-asr-flash-realtime） ----------
  // 以前：说完停 1.1 秒才算说完 → 整段上传 qwen3-asr-flash → 等结果，说完 2 秒多才出分。现在：
  // ① 一点话筒就开始录，同时连实时识别，连上之前录到的先存着再补发（开头不丢）；
  // ② 服务器边听边回文字（stash 是还没定下来的那截），孩子能看到自己说的话一个个冒出来；
  // ③ 调用方给 o.match(文字)（游戏里是「和答案对上 90 分以上」）：实时结果一对上就立刻结束，不用等停顿；
  //    对不上就等服务器判断说完（单词停顿 0.4 秒、句子 0.6 秒）。识别本身不知道答案（不带答案地听写），打分还是公正的；
  // ④ 实时识别连不上 / 断了：用录好的整段走原来的 qwen3-asr-flash。
  // 麦克风预热：说完不马上关，15 秒内再点话筒直接接着录（打开麦克风要零点几秒，孩子一点就说会丢开头）。
  // 返回 { text, err, how, why }：err 是 network / no-speech / not-allowed / audio-capture / aborted / busy / service-not-allowed；
  // why 是出错的细分原因（offline / auth / quota / busy / code / network；麦克风的是浏览器报的错误名，比如 NotAllowedError）
  const ASR_RT = 'qwen3-asr-flash-realtime';
  // last：最近一次收到麦克风声音的时刻（AudioWorklet 一直在送，不管有没有人在听）；at：这次打开的时刻；stale：预热着的麦克风不出声、重开过几次（这次打开 App）
  const LM = { stream: null, ctx: null, node: null, rate: 16000, sink: null, t: 0, last: 0, at: 0, stale: 0, lv: 0 };
  // 正在听的时候麦克风这一小块有多响（均方根，说话一般 0.03–0.1）：界面上的话筒跟着它动——一开口就有反应，不用等识别出字（2026-11-24 老板：「说话那里还是有点卡」）
  const rmsOf = d => { let x = 0; for (let i = 0; i < d.length; i++) x += d[i] * d[i]; return d.length ? Math.sqrt(x / d.length) : 0; };
  const micLevel = () => (LM.sink && performance.now() - LM.last < 250 ? LM.lv : 0);
  const RTA = { fails: 0 };   // 实时识别连续失败几次就先不用了（这次打开游戏）
  // 麦克风这会儿还给不给声音（2026-11-22 老板的截图：对战里点话筒等了 5 秒「没听清」，角标 fed0 v:-——
  // 预热着的麦克风在 iPhone 上放过别的声音以后，流还「开着」，可一点声音都不送了）。最近 0.3 秒有声音进来就算；
  // 刚 resume 的要一会儿才来：最多再等 ms 毫秒
  async function lmFlowing(ms) {
    const tr = LM.stream && LM.stream.getAudioTracks ? LM.stream.getAudioTracks()[0] : null;
    if (!tr || tr.readyState !== 'live' || tr.muted) return false;
    const t0 = performance.now();
    if (t0 - LM.last < 300) return true;
    while (performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 30)); if (LM.last > t0) return true; }
    return false;
  }
  // 同一时间只开一次（复查 2026-11-22：听的时候的「不出声重开」和下一题点话筒撞在一起，会开出两个麦克风，后开好的把先开的那个顶掉、
  // 先开的没人关，或者把正在听的那一题的 sink 清掉）。开着的那一次没完，再来要的人拿同一个结果
  let lmP = null;
  function lmOpen() {
    if (lmP) return lmP;
    lmP = lmOpen1().finally(() => { lmP = null; });
    return lmP;
  }
  async function lmOpen1() {
    clearTimeout(LM.t);
    if (LM.stream && LM.stream.active && LM.ctx && LM.ctx.state !== 'closed') {
      // 本来就在跑的：声音每 8 毫秒来一次，0.3 秒没来就是不送了，只再等一小会儿（主线程刚忙完的话，积着的消息这时候会到）；
      // 刚叫醒（resume）的要一会儿才来，等久一点。2026-11-24 复查：以前一律再等 0.3 秒才重开，重开好的时候点话筒已经过去近半秒，
      // 一点就说的人头半秒的声音丢了（tests/speech.test.js 1b：识别结果先到了，声音一段都还没送过去）
      const was = LM.ctx.state === 'running';
      if (!was) { try { await LM.ctx.resume(); } catch (e) {} }
      if (await lmFlowing(was ? 60 : 300)) return LM;
      LM.stale++;   // 不出声了：关掉重开
    }
    lmShut();
    let stream, ctx;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return { err: 'not-allowed', why: (e && e.name) || 'mic' }; }
    try {
      try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    } catch (e) { try { stream.getTracks().forEach(t => t.stop()); } catch (er) {} try { ctx && ctx.close(); } catch (er) {} return { err: 'audio-capture', why: (e && e.name) || 'audio' }; }
    const node = new AudioWorkletNode(ctx, 'tk-cap');
    ctx.createMediaStreamSource(stream).connect(node);
    node.port.onmessage = e => { LM.last = performance.now(); if (LM.sink) { LM.lv = rmsOf(e.data); LM.sink(e.data); } };
    Object.assign(LM, { stream, ctx, node, rate: ctx.sampleRate, sink: null, at: performance.now() });
    return LM;
  }
  // 正在听的时候麦克风不出声：多久没有新的声音了（从这次打开、或者最后一次收到声音算起）
  const lmQuiet = () => (LM.node ? performance.now() - Math.max(LM.last, LM.at) : 0);
  function lmRelease() { LM.sink = null; clearTimeout(LM.t); LM.t = setTimeout(lmShut, 15000); }
  function lmShut() {
    clearTimeout(LM.t); LM.sink = null;
    try { if (LM.node) LM.node.port.onmessage = null; } catch (e) {}
    try { if (LM.stream) LM.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (LM.ctx) LM.ctx.close(); } catch (e) {}
    LM.stream = LM.ctx = LM.node = null;
  }
  // 切到后台：把口语题的麦克风关掉；正在和岛民聊天就「结束并评价」（家长定的：切后台和返回键一样）
  // 还没连上时不管：安卓第一次弹「允许用麦克风」的系统窗口时页面也会切到后台，那时不能把聊天关了
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !LM.sink) lmShut();
    if (document.hidden && C && !C.ending && !C.done && (C.ready || C.turns.some(t => t.who === 'you'))) end('hidden');
    if (!document.hidden) nspRefresh();   // iPhone：从「设置」里回来，本机识别的权限可能变了
  });
  // 浮点 → 16kHz 16 位 PCM（不是 16k 的设备按比例取样，跨块记住小数位置）
  function pcm16(f, rate, st) {
    const k = rate / 16000, n = Math.max(0, Math.ceil((f.length - st.pos) / k)), out = new Int16Array(n);
    let p = st.pos, i = 0;
    for (; i < n && p < f.length; i++, p += k) { const v = Math.max(-1, Math.min(1, f[Math.floor(p)])); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    st.pos = p - f.length;
    return i === n ? out : out.subarray(0, i);
  }
  function u8b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  // 实时识别的连接：APK 走原生桥（带密钥），网页版走中转服务的 /asr-rt
  // lang：别的语言的课（es / ja / zh）放进网址 ?lang=（服务器只认这个，API.md §8）；英语不给，网址和以前一样。APK 直连时语言在 session.update 里
  function asrSock(on, lang) {
    if (direct()) {
      const id = ++nid, N = window.EchoNative;
      NWS[id] = on;
      try { N.wsOpen(id, window.TalkCore.REALTIME_URL + '?model=' + ASR_RT); } catch (e) { setTimeout(() => on('error', e.message), 0); }
      return { send: s => { try { N.wsSend(id, s); } catch (e) {} }, close: () => { delete NWS[id]; try { N.wsClose(id); } catch (e) {} } };
    }
    const url = relayUrl(), code = cloudOn() ? '' : LS('echo-talk-code');
    // 云端模式：没登录就不连（listenOnce 前面已经挡了，这里兜底）；连上先发 auth，再告诉调用方「连上了」（API.md §8 /v1/asr-rt）
    const tok = cloudOn() && ACC() ? ACC().token() : '';
    if (cloudOn() && !tok) { setTimeout(() => on('error', '{"error":"auth"}'), 0); return { send() {}, close() {} }; }
    let ws;
    const qs = [code ? 'code=' + encodeURIComponent(code) : '', lang && lang !== 'en' ? 'lang=' + encodeURIComponent(lang) : ''].filter(Boolean).join('&');
    try { ws = new WebSocket(url + '/asr-rt' + (qs ? '?' + qs : '')); } catch (e) { setTimeout(() => on('error', e.message), 0); return { send() {}, close() {} }; }
    ws.onopen = () => { if (tok) try { ws.send(JSON.stringify({ type: 'auth', token: tok })); } catch (e) { /* 断了 */ } on('open'); };
    ws.onmessage = e => {
      // 云端模式：服务器自己的错误（没登录、额度用完……）和阿里云的事件走同一条连接：认出来交给 noteAi（listenOnce 的 fail 只看阿里云的 error）
      if (tok) { let m = null; try { m = JSON.parse(e.data); } catch (er) { /* 不是 JSON */ } if (m && m.type === 'error' && m.code && m.status) { if (m.code === 'auth' && ACC()) ACC().lost(); if (m.code === 'quota' && ACC()) ACC().noteQuota('asr'); on('error', JSON.stringify({ error: m.code })); return; } }
      on('message', e.data);
    };
    ws.onclose = () => on('closed'); ws.onerror = () => on('error', '');
    return { send: s => { if (ws.readyState === 1) ws.send(s); }, close: () => { try { ws.close(); } catch (e) {} } };
  }
  // 整段识别（原来的做法；实时识别不行时兜底）
  // lang：别的语言的课的识别语言（LANG.asr.cloud：es / ja / zh），英语不给（请求体和以前一样）。服务器（cloud/ 和新的中转服务）按它听；
  // 云端模式只在服务器的 speechLangs 里有这门语言时才走到这里（game.js 的 noCloud）
  async function wholeAsr(chunks, len, rate, lang) {
    const body = { model: 'qwen3-asr-flash', stream: false, asr_options: { language: lang || 'en', enable_itn: false },
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + wav16(chunks, len, rate) } }] }] };
    let text = '', r;
    if (direct()) {
      r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 12000);
      try { text = String(JSON.parse(r.text).choices[0].message.content || '').trim(); } catch (e) {}
    } else {
      r = await relayPost('/asr', Object.assign({ audio: body.messages[0].content[0].input_audio.data.split(',')[1] }, lang ? { lang } : null), 12000);
      try { text = String(JSON.parse(r.text).text || '').trim(); } catch (e) {}
      if (!r.ok) r.text = 'HTTP ' + r.status + ' ' + r.text;
    }
    return r.ok ? { text, err: text ? null : 'no-speech' } : { text: '', err: 'network', why: noteAi('asr', r.text) };
  }
  // ---------- iPhone：口语题先用手机自带的本机识别（2026-11-20 老板：「那个识别，还是太慢了，有时候还不准」） ----------
  // 原生 ios/App/Sources/LocalSpeech.swift（SFSpeechRecognizer，只在手机上识别）：不联网、不用登录、不算 AI 额度，边说边出字。
  // · 打分照样诚实：识别不知道答案（原生那边不设 contextualStrings），打分还是 game.js 的 scoreSpeech()。
  // · 什么时候算说完由这里定，不等苹果的「最终结果」：有字以后字停住不变 0.4 秒（单词）/ 0.6 秒（句子）/ 1.5 秒（说几句话），
  //   并且原生说人已经不出声了（voice 事件；一直「在出声」最多再等 1.2 秒，免得吵的地方停不下来）；对上答案（o.match）当场结束。
  // · 麦克风归网页（第二版，2026-11-20 晚）：和云端识别同一套 lmOpen 开麦克风，录到的声音换成 16kHz 16 位 PCM，每 0.1 秒一段用 speechFeed 送给原生；
  //   原生还没说「开好了」之前录到的先存着，一说好就补发。原生一点声音会话都不碰（第一版原生自己录音，在老板的 iPhone 上和网页那一层的声音互相打断，
  //   一点话筒就停在「请说……」）。麦克风的权限也是网页的（getUserMedia），被拒了和云端一样弹「去打开」。
  // · 不让学的人卡住：本机这一次没认出字，除了 ① 学的人自己点了停、② 真的没说话（网页没量到人声、原生也没说出声），
  //   一律同一次里接着走云端识别（录好的声音一起交过去，不用再说一遍）；云端用不了就按「没听清」回（有提示、算一次尝试）。
  //   原因记在 D.fell。「没有 / 不允许」（unavailable / denied / restricted）这次打开 App 记住，不再每题先试本机（回到前台再问一次原生，打开了就又用本机）；
  //   别的原因（原生出错、没认出字、开不起来、超时）连着两次也记住（off = 'fails'），这次打开 App 不再试本机。
  // · 每次识别的计时（点了到开始听、第一个字、结束、最后一个字到结束）和本机那几样（送了几段声音、有没有人声）留在内存里：
  //   EchoTalk.lastSpeech() / speechLog()，不上传；测试版的版本角标显示最近一次的（echo-native.js 的 addBeta）。
  // · 想对比时可以临时关掉本机识别：localStorage['echo-sr'] = 'cloud'（只给调试用，界面上没有开关）。
  const NSP = { st: null, off: '', fails: 0, noPre: false };
  const SRLOG = [];
  const nspHas = () => { try { const N = window.EchoNative; return !!(window.ECHO_IOS && N && typeof N.speechStart === 'function' && typeof N.speechState === 'function' && typeof N.speechStop === 'function'); } catch (e) { return false; } };
  const nspUsable = st => !!st && st.onDevice !== false && st.auth !== 'denied' && st.auth !== 'restricted';
  // 现在口语题会不会先用本机识别（还没问到原生的状态时先当能用：开不起来同一次里就改走云端）
  const localSR = () => nspHas() && !NSP.off && (!NSP.st || nspUsable(NSP.st)) && LS('echo-sr') !== 'cloud';
  function nspRefresh() {
    if (!nspHas()) return Promise.resolve(null);
    return nativeCall('speechState', [], 4000).then(r => {
      if (r.type !== 'ok') return NSP.st;
      try { NSP.st = JSON.parse(r.data || '{}'); } catch (e) { return NSP.st; }
      // 家长后来在「设置」里打开了语音识别 / 手机能用了：不再记着「用不了」（连着两次没认出来的 'fails' 这次打开 App 一直记着）
      if (NSP.off && NSP.off !== 'fails' && nspUsable(NSP.st) && NSP.st.auth === 'authorized' && NSP.st.available !== false) { NSP.off = ''; NSP.fails = 0; }
      return NSP.st;
    });
  }
  // 本机识别一次：→ { text, err, how }；本机没认出字、要改走云端时 → null（D.fell 写着原因；D.micP 是开麦克风的那一次、D.pre 是已经录好的声音，云端接着用）
  const PRE_SEC = 20;   // 给云端接着用的声音最多存多少秒
  // 说到一半停下来想下一个词的人别掐断（2026-11-24，老板在西语「说出回答」里：「这个我都没说完，他就停止识别了」——
  // 这句话 6 个词，听到 4 个，停了不到 1 秒就交卷了）。o.units：这句话大约有几个词（game.js 按题目算的，**只管等多久，不交给识别**）。
  // 听到的够数 → 0（照原来的 0.4 / 0.6 秒）；只差一点（八成以上）→ 1300；差得多 → 2000：不出声要满这么多毫秒才算说完。
  // 说对了照样当场结束（o.match）；真的只想说这么多的，等这一会儿、或者自己点一下话筒
  function lackWait(o, text, count) {
    const exp = o && o.units > 0 ? o.units : 0;
    if (!exp || !text) return 0;
    const got = count(text);
    // o.patient（game.js：零基础、入门和初级两档）：再放宽一半——只差一点 2 秒，差得多 3 秒。
    // 2026-11-24 老板第二张截图（还是老规则的包）：「Mis amigos son divertidos」后面想了至少 1.4 秒才要说「y curiosos」，2 秒对零基础偏紧
    const k = o.patient ? 1.5 : 1;
    return got >= exp ? 0 : Math.round((got >= exp * 0.8 ? 1300 : 2000) * k);
  }
  function nativeListen(o, D) {
    return new Promise(resolve => {
      const N = window.EchoNative, id = ++nid, now = () => performance.now();
      const short = !!o.short, need = o.long ? 1500 : short ? 400 : 600;
      let done = false, nok = false, mic = null, started = 0, text = '', chg = 0, voice = false, voiceOff = 0, tick = 0, tm = 0, raw = '';
      let pend = [], pendN = 0, q = [], preN = 0, loudN = 0, heardTold = false;
      const segs = [], pre = [], st = { pos: 0 };
      D.eng = 'device'; D.fed = 0;
      // 别的语言的课：第一个词、有几个词交给 LANG（o.head / o.count；日语、中文没有空格）
      const first = o.head || (s => (s.split(' ')[0] || '').toLowerCase()), nUnits = o.count || (s => s.split(' ').length);
      const stopNative = () => { try { N.speechStop(++nid); } catch (e) { /* 不在 App 里 */ } };
      // 收尾。原生还没回 speechStart 的（比如麦克风被拒得比原生开好还快）：等它回了 ok 再叫停一次，别让那一次一直开着
      const cleanup = () => {
        window.removeEventListener('echo-speech', onEv); clearInterval(tick); clearTimeout(tm); if (SR.stop === userStop) SR.stop = null;
        if (NWS[id]) NWS[id] = type => { delete NWS[id]; if (type === 'ok') stopNative(); };
      };
      // 有没有人声：网页量到的（响过 0.2 秒以上）或者原生说出过声
      const heardVoice = () => (mic && loudN >= mic.rate * 0.2) || D.voice != null;
      const vo = () => ((mic && loudN >= mic.rate * 0.2 ? 'w' : '') + (D.voice != null ? 'n' : '')) || '-';
      // 结束、不改走云端：麦克风照云端那样预热着（15 秒内再点不用重开）
      const end = r => {
        if (done) return; done = true;
        stopNative(); cleanup(); D.vo = vo();
        if (mic) lmRelease();
        resolve(r);
      };
      // 本机没认出字：改走云端（null）。麦克风接着录，录到的存进 D.pre（cloudListen 接手时一起交过去）；「没有 / 不允许」、连着两次没认出来记住
      const fall = (code, soft) => {
        if (done) return; done = true;
        stopNative(); cleanup();
        D.fell = code || 'error'; D.vo = vo(); D.pre = pre;
        if (code === 'unavailable' || code === 'denied' || code === 'restricted') NSP.off = code;
        else if (soft) { /* 不算进「连着两次没认出来」（见 check 里的 stuck） */ }
        else if (code !== 'end-background' && ++NSP.fails >= 2) NSP.off = 'fails';
        resolve(null);
      };
      // 怎么结束的：有字就打分；学的人点了停 → aborted；按计时结束（silence / max / done）又真的没说话 → 没听清；别的一律改走云端
      const QUIET = { silence: 1, max: 1, done: 1 };
      const finish = how => {
        if (done) return;
        const t = text.trim();
        if (t) { NSP.fails = 0; end({ text: t, err: null, how, ms: Math.round(now() - D.t0) }); return; }
        if (how === 'user') { end({ text: '', err: 'aborted', how }); return; }
        if (!heardVoice() && (QUIET[how] || (how === 'error' && /\b1110\b/.test(D.nerr || '')))) { end({ text: '', err: 'no-speech', how }); return; }
        fall(QUIET[how] ? 'notext' : how);
      };
      const userStop = () => finish('user');
      const feed = b => { D.fed++; try { N.speechFeed(id, b); } catch (e) { /* 老的壳子没有 speechFeed */ } };
      // 麦克风的每一小块（AudioWorklet，浮点）：先存一份（改走云端时用），量一下响不响，攒够 0.1 秒换成 16kHz 16 位 PCM 送给原生（原生还没开好就先排着）
      const sink = d => {
        if (preN < mic.rate * PRE_SEC) { pre.push(d); preN += d.length; }
        if (done) return;   // 已经改走云端：只存着，等 cloudListen 接手
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        if (Math.sqrt(sum / d.length) > 0.02) {
          loudN += d.length;
          if (D.wv == null && started) D.wv = now() - D.t0;   // wv：网页量到开始出声的时刻（角标的 say）
          // 出声满 0.15 秒、字还没出来：那一行从「请说」换成「在听」（字出来以前也看得出手机听到了）
          if (!heardTold && started && !text && loudN >= mic.rate * 0.15) { heardTold = true; if (o.onState) o.onState(tx('tk.asr.hear')); }
        }
        pend.push(d); pendN += d.length;
        if (pendN >= mic.rate * 0.1) {
          const f = new Float32Array(pendN); let p = 0; pend.forEach(c => { f.set(c, p); p += c.length; });
          pend = []; pendN = 0;
          const b = u8b64((x => new Uint8Array(x.buffer, x.byteOffset, x.byteLength))(pcm16(f, mic.rate, st)));
          if (nok) feed(b); else if (q.length < 150) q.push(b);
        }
      };
      // 原生开好了、麦克风也开好了：开始计时
      const ready = () => {
        if (done || !nok || !mic || started) return;
        started = now(); D.listen = started - D.t0;
        if (o.onState) o.onState(tx('tk.asr.say'));
        tick = setInterval(check, 50);
      };
      // 开麦克风（和云端识别同一个 lmOpen）。被拒 → not-allowed（game.js 弹「去打开」）
      const openMic = () => {
        D.micP = lmOpen();
        D.micP.then(m => {
          if (m.err) { if (!done) end({ text: '', err: m.err, why: m.why, how: 'mic' }); return; }
          if (done && !D.pre) { if (!LM.sink) lmRelease(); return; }   // 麦克风开好以前就结束了（被下一题接走了就别碰）
          mic = m; if (D.mic == null) D.mic = now() - D.t0;
          m.sink = sink;   // 已经改走云端的：sink 只往 D.pre 里存
          ready();
        });
      };
      const onEv = e => {
        const d = e && e.detail;
        if (!d || d.sid !== id || done) return;
        if (d.fed != null) D.nfed = d.fed;
        if (d.kind === 'partial' || d.kind === 'final') {
          const p = String(d.text || '').replace(/\s+/g, ' ').trim();
          // 手机上的识别在人停顿一下以后，有时从头另起一段（新的字不接着前面的）：前面那段先留着、拼在一起。
          // 只在「停住 0.35 秒以上、第一个词变了、字变少了」时才算另起一段（平常的改字不是这样）
          if (p && raw && p !== raw && now() - chg >= 350 && first(p) !== first(raw) && nUnits(p) < nUnits(raw)) segs.push(raw);
          if (p) raw = p;
          const t = segs.concat(raw ? [raw] : []).join(' ').trim();
          if (t && t !== text) {
            text = t; chg = now();
            D.chg = chg; if (D.first == null) D.first = chg - D.t0;
            if (o.onState) o.onState(t);
            if (o.match && o.match(t)) { finish('match'); return; }
          }
          if (d.kind === 'final') finish('final');
        } else if (d.kind === 'voice') {
          voice = !!d.on;
          if (!voice) voiceOff = now();
          if (voice && D.voice == null) D.voice = now() - D.t0;
        } else if (d.kind === 'error') {
          D.nerr = String(d.code || '');   // 比如 kAFAssistantErrorDomain 1101（手机上没有识别模型）；1110 是「没听到说话」
          finish('error');
        } else if (d.kind === 'end') finish('end-' + (d.reason || 'end'));   // 原生自己停了（切后台、最终结果是空的……）
      };
      // 麦克风开着却不出声（lmOpen 查过了，可也有听到一半才断的）：关掉重开一次，接着用同一个 sink；这次识别里只重开一次
      const reMic = () => { D.remic = (D.remic || 0) + 1; if (mic) mic.sink = null; mic = null; lmShut(); openMic(); };
      // 每 50 毫秒看一眼：说完了没有、太久没有
      const check = () => {
        if (done) return;
        const t = now(), since = t - started;
        // 1 秒一点声音都没进来：重开麦克风；重开了 1.5 秒还是没有 → 按「没听清」回（不卡 5 秒、也不改走云端——云端也是这个麦克风）
        if (mic && !text) {
          const q = lmQuiet();
          if (q > 1000 && !D.remic) { reMic(); return; }
          if (q > 1500 && D.remic) { end({ text: '', err: 'no-speech', how: 'nodata' }); return; }
        }
        if (since > (o.maxMs || 8000)) { finish('max'); return; }
        if (!text) {
          // 新引擎（边说边出字的那个）：人已经出声 3.5 秒、说了不止半秒，还一个字没有——它多半没在出结果。别干等到最长时间：
          // 这一句马上改走云端（录好的声音一起交过去）。用的是「提前备好」的分析器就先把它关了（这次打开 App 不再用），不算进「连着两次没认出来」
          if (/Analyzer/.test(D.neng || '') && D.wv != null && t - D.t0 - D.wv > 3500 && mic && loudN >= mic.rate * 0.6) {
            D.stuck = 1;
            if (D.npre && !NSP.noPre) { NSP.noPre = true; fall('notext', true); } else fall('notext');
            return;
          }
          if (since > (o.long ? 7000 : 5000) && !voice) finish('silence');
          return;
        }
        const still = t - chg;
        const lack = lackWait(o, text, nUnits), old = still >= need && (!voice || still >= need + 1200);
        if (!lack) { if (old) finish('done'); return; }
        if (old) D.lack = lack;   // 照原来的规矩这时候已经交卷了（角标的 w：这一次多等过）
        // 听到的比这句话少：字停住、并且不出声，两样都满 wait 毫秒才算说完。
        // 只看字停没停不行：手机出字比声音晚（新引擎晚 1 秒多），人接着说了、字还没出来，这时再停一下就被当成说完了
        const wait = Math.max(need, lack), sil = voice ? 0 : voiceOff ? t - voiceOff : still;
        if (still >= wait && (voice ? still >= wait + 1200 : sil >= wait)) finish('done');
      };
      window.addEventListener('echo-speech', onEv);
      SR.stop = userStop;
      // 第一次要弹「语音识别」的权限框：等久一点，而且等原生问完再开麦克风（两个系统框不一起弹）；平时麦克风和原生一起开，5 秒原生还没开好就改走云端
      const ns = NSP.st, asks = !ns || ns.auth !== 'authorized';
      tm = setTimeout(() => { if (!nok) fall('timeout'); }, asks ? 60000 : 5000);
      NWS[id] = (type, data) => {
        delete NWS[id]; clearTimeout(tm);
        let j = {}; try { j = JSON.parse(data || '{}') || {}; } catch (e) { j = {}; }
        if (done) { if (type === 'ok') stopNative(); return; }
        if (type !== 'ok') { fall(String(j.error || 'error')); return; }
        nok = true; D.nok = now() - D.t0; D.nms = j.ms; D.neng = j.engine || '';   // 原生用的哪个引擎（iOS 26 的 SpeechAnalyzer / 老的 SFSpeechRecognizer）
        D.npre = !!j.pre;   // 这一次用的是不是提前备好的分析器（角标的 sa+）
        NSP.st = Object.assign(NSP.st || { onDevice: true }, { auth: 'authorized' });   // 开起来了：语音识别的权限有了（下次不用等弹框那么久）
        q.forEach(feed); q = [];   // 开好以前录到的补发
        if (!D.micP) openMic();
        ready();
      };
      if (!asks) openMic();
      // engine：调试时 localStorage['echo-sr-engine'] = 'sf' 只用老引擎（和新的 SpeechAnalyzer 对比快慢）；平时不带
      const eng = LS('echo-sr-engine') === 'sf' ? { engine: 'sf' } : null;
      // prearm：提前备好的分析器出过「有声音不出字」以后，这次打开 App 不再用它（老的壳子不认这一项）
      try { N.speechStart(id, JSON.stringify(Object.assign({ short, long: !!o.long, locale: o.lang ? o.lang.apple : 'en-US', rate: 16000 }, eng, NSP.noPre ? { prearm: false } : null))); } catch (e) { fall('error'); }
    });
  }
  // 本机识别没认出字、云端又接不上：录好的声音不要了，麦克风照常预热着
  function dropPre(D) {
    if (!D || !D.pre) return;
    D.pre = null;
    lmRelease();
  }
  // 记一次识别的计时（只在内存里，最近 20 次）：listen 点了到开始听、first 第一个字、end 结束、lag 最后一个字变了到结束（说完以后等了多久）
  function srNote(D, r) {
    const now = performance.now(), ms = v => (v == null ? null : Math.round(v));
    // wv：网页量到开始出声（第一个字出来得慢，是识别慢还是人开口晚，看它）；remic：这次听到一半麦克风不出声、重开了几次；stale：预热着的麦克风不出声、开口前重开过几次（这次打开 App 一共）
    const rec = { at: D.at, eng: D.eng || '', short: D.short, how: (r && r.how) || '', ok: !!(r && r.text), err: (r && r.err) || '', fell: D.fell || '',
      listen: ms(D.listen), first: ms(D.first), voice: ms(D.voice), wv: ms(D.wv), end: ms(now - D.t0), lag: D.chg ? ms(now - D.chg) : null, ready: ms(D.ready), nms: D.nms == null ? null : D.nms,
      remic: D.remic || 0, stale: LM.stale };
    if (D.lack) rec.lack = D.lack;   // 听到的比这句话少、多等了（lackWait 的毫秒数；角标的 w）
    if (D.nerr) rec.nerr = D.nerr;
    // 本机识别那几样（试过本机才有）：开麦克风 / 原生开好用了几毫秒、送过去几段声音、原生说收到几段、有没有人声（w 网页 / n 原生 / - 没有）、这次打开 App 还用不用本机
    if (D.fed != null) Object.assign(rec, { mic: ms(D.mic), nok: ms(D.nok), fed: D.fed, nfed: D.nfed == null ? null : D.nfed, vo: D.vo || '', off: NSP.off || '', neng: D.neng || '', pre: D.npre ? 1 : 0, stuck: D.stuck || 0, noPre: NSP.noPre ? 1 : 0 });
    SRLOG.push(rec); if (SRLOG.length > 20) SRLOG.shift();
    if (r) r.eng = rec.eng;
    return r;
  }
  // 给 game.js 的几句话：设置页「口语自动打分：本机识别」、开口前小检查用的是哪个、周报诊断一行
  function srText(k, p) {
    if (k === 'env') return tx('tk.sr.env');
    if (k === 'chk') return p === 'device' ? tx('tk.sr.chk.dev') : tx('tk.sr.chk.cloud');
    if (k === 'rp') return tx('tk.sr.rp', p);
    return '';
  }
  // o.onState(文字)：「🎤 请说……」和边说边出来的文字；o.match(文字) → true 就立刻结束；o.short：单词/短语（停顿等得短一点）
  // iPhone 上先试本机识别（nativeListen），不行再走下面的云端识别（cloudListen）。返回值多一个 eng：'device' 本机 / 'cloud' 云端
  async function listenOnce(o) {
    o = Object.assign({}, o);
    // 长句子慢慢念 8 秒不够：按这句话有几个词放宽（一个词约 1 秒，最多 15 秒）；调用的地方自己给了 maxMs 的不动
    // o.patient（零基础、入门和初级）：念得慢、中间还要想词——3 个词以上就放宽，一个词约 1.5 秒，最多 18 秒
    if (!o.maxMs && o.patient && o.units > 2) o.maxMs = Math.min(18000, 4000 + o.units * 1500);
    else if (!o.maxMs && o.units > 5) o.maxMs = Math.min(15000, 3000 + o.units * 1000);
    const D = { at: Date.now(), t0: performance.now(), short: !!o.short, eng: '', fell: '' };
    let r = null;
    if (localSR() && !C) r = await nativeListen(o, D);
    if (!r && D.fell) {
      // 本机没认出字，云端又用不了（没有密钥 / 云端模式没登录）：
      //   本机这次打开 App 不用了（unavailable / denied / 连着两次）→ 和以前没有 AI 时一样（game.js 走「先跳过」、请他登录）；
      //   本机还能用（只是这一次没认出来）→ 按「没听清」回：有提示、算一次尝试，再说一次
      // o.noCloud：别的语言的课在云端模式里、服务器不认这门语言（GET /v1/me 没有 speechLangs 或者里面没有它，game.js 看），也按「云端用不了」算
      const why = o.noCloud ? 'lang' : !cloudSR() ? 'nokey' : cloudOn() && !(ACC() && ACC().signed()) ? 'signin' : '';
      if (why) { dropPre(D); r = NSP.off ? { text: '', err: 'nokey', why } : { text: '', err: 'no-speech', why: 'device', how: D.fell }; }
    }
    if (!r && o.noCloud) { dropPre(D); r = { text: '', err: 'nokey', why: 'lang' }; }
    if (!r) { D.eng = 'cloud'; r = await cloudListen(o, D); }
    // 没拿到字：把「🎤 请说……」「🎧 识别中……」那一行清掉（每个调用的地方都显示这一行，不清就像卡住了；提示由调用的地方按 fail 写）
    if (r && !r.text && o.onState) { try { o.onState(''); } catch (e) { /* 页面已经换了 */ } }
    return srNote(D, r);
  }
  async function cloudListen(o, D) {
    if (!cloudSR()) { dropPre(D); return { text: '', err: 'service-not-allowed' }; }
    if (cloudOn() && !(ACC() && ACC().signed())) { dropPre(D); return { text: '', err: 'network', why: noteAi('asr', '{"error":"auth"}') }; }   // 云端模式没登录：不开麦克风
    if (C) { dropPre(D); return { text: '', err: 'busy' }; }   // 正在和岛民聊天，麦克风被占着
    // iPhone 的本机识别没认出字、接着走这里：用它开着的那个麦克风，它录好的声音（D.pre）先补进来
    const mic = D.micP ? await D.micP : await lmOpen();
    if (mic.err) return { text: '', err: mic.err, why: mic.why };
    D.listen = performance.now() - D.t0;
    const rate = mic.rate, chunks = [], st = { pos: 0 }, t0 = performance.now();
    let len = 0, voiced = 0, quiet = 0, done = false, over = false, ready = false, queue = [], pend = [], pendN = 0, texts = [], cur = '', grace = 0, inSpeech = false;
    let dead = RTA.fails >= 3;
    return new Promise(resolve => {
      const full = () => (texts.join(' ') + ' ' + cur).replace(/\s+/g, ' ').trim();
      const cnt = o.count || (s => s.split(' ').filter(Boolean).length);
      let wd = 0;   // 麦克风不出声的看门狗（下面 mic.sink 之后才开）
      const fail = d => { if (dead) return; dead = true; RTA.fails++; if (d) noteAi('asr-rt', d); };
      const heard = () => {
        const t = full(); if (!t) return;
        if (t !== D.lastT) { D.lastT = t; D.chg = performance.now(); if (D.first == null) D.first = D.chg - D.t0; }
        if (o.onState) o.onState(t);
        if (o.match && o.match(t)) finish('match');
      };
      const sock = dead ? null : asrSock((type, data) => {   // 别的语言的课：网址带上 ?lang=（第二个参数，在这个回调后面）
        if (over) return;
        if (type === 'open') {
          sock.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: o.lang ? o.lang.cloud : 'en' },
            turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: o.short ? 400 : o.long ? 1000 : 600 } } }));
          ready = true; D.ready = performance.now() - D.t0; queue.forEach(s => sock.send(s)); queue = [];
        } else if (type === 'message') {
          let m; try { m = JSON.parse(data); } catch (e) { return; }
          if (m.type === 'conversation.item.input_audio_transcription.text') { cur = (m.text || '') + (m.stash || ''); heard(); }
          else if (m.type === 'conversation.item.input_audio_transcription.completed') {
            RTA.fails = 0; inSpeech = false; texts.push(m.transcript || ''); cur = ''; heard();
            // 说完一段：稍等一下，孩子没接着说就结束（句子中间停顿了会接着识别下一段）。
            // 听到的比这句话少（lackWait）：多等一会儿——服务器是停了 vad 毫秒才说「这一段完了」的，这里补到一共不出声 lack 毫秒
            const lack = lackWait(o, full(), cnt), vad = o.short ? 400 : o.long ? 1000 : 600;
            if (lack) D.lack = lack;
            clearTimeout(grace); grace = setTimeout(() => finish('done'), Math.max(o.short ? 200 : o.long ? 1500 : 500, lack - vad));
          } else if (m.type === 'input_audio_buffer.speech_started') { inSpeech = true; clearTimeout(grace); }
          else if (m.type === 'error') fail(JSON.stringify(m.error || m).slice(0, 200));
        } else if (type === 'error' || type === 'closed') fail(type === 'error' ? String(data || '') : '');
      }, o.lang && o.lang.cloud);
      const finish = async why => {
        if (done) return; done = true;
        clearTimeout(grace); clearInterval(wd); SR.stop = null; lmRelease();
        // 本机先判断说完了，但实时识别还没把这一段认完（刚连上 / 网慢，服务器还压着没处理的声音）：
        // 最多再等 2.5 秒它的「认完了」——只拿到半句就交卷会被当成说错
        const settled = () => texts.length && !inSpeech;
        if (why !== 'match' && why !== 'done' && why !== 'user' && sock && ready && !dead && voiced >= 3 && !settled()) {
          const t1 = performance.now();
          await new Promise(r => { const iv = setInterval(() => { if (settled() || dead || performance.now() - t1 > 2500) { clearInterval(iv); r(); } }, 40); });
        }
        over = true; clearTimeout(grace);
        const partial = !settled() && why !== 'match' && why !== 'user';
        if (sock) { try { sock.send(JSON.stringify({ type: 'session.finish' })); } catch (e) {} setTimeout(() => sock.close(), 400); }
        const t = full();
        if (t && !partial) return resolve({ text: t, err: null, ms: Math.round(performance.now() - t0), how: why });
        // how 也带上（只给角标 / speechLog 看：云端这条路没出字时分得清是没人说话 silence、到时间了 max、还是麦克风不出声 nodata）
        if (voiced < 3 || len < rate * 0.3) return resolve(t ? { text: t, err: null, how: why } : { text: '', err: why === 'user' ? 'aborted' : 'no-speech', how: why });
        // 实时识别没认完（或者没连上）：录好的整段重新识别；整段也失败就用手上的半句
        if (o.onState) o.onState(tx('tk.asr.busy'));
        const w = await wholeAsr(chunks, len, rate, o.lang && o.lang.cloud);
        resolve(w.text || !t ? Object.assign(w, { how: 'whole' }) : { text: t, err: null, how: 'partial' });
      };
      SR.stop = () => finish('user');
      mic.sink = d => {
        if (done) return;
        chunks.push(d); len += d.length;
        // 攒够 0.1 秒送一次
        if (!dead) {
          pend.push(d); pendN += d.length;
          if (pendN >= rate * 0.1) {
            const f = new Float32Array(pendN); let p = 0; pend.forEach(c => { f.set(c, p); p += c.length; });
            const s = JSON.stringify({ type: 'input_audio_buffer.append', audio: u8b64((x => new Uint8Array(x.buffer, x.byteOffset, x.byteLength))(pcm16(f, rate, st))) });
            pend = []; pendN = 0;
            if (ready) sock.send(s); else if (queue.length < 120) queue.push(s);
          }
        }
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const loud = Math.sqrt(sum / d.length) > 0.02, now = performance.now();
        // 本机的停顿判断只是保底：实时识别正常时它会先结束；不正常时停 1.1 秒就整段识别
        if (loud) { voiced++; quiet = 0; if (D.wv == null) D.wv = now - D.t0; } else if (voiced >= 3) { if (!quiet) quiet = now; else if (now - quiet > (o.long ? 2600 : dead ? 1100 : lackWait(o, full(), cnt) ? Math.max(2600, lackWait(o, full(), cnt) + 600) : 1800)) finish('silence'); }
        if (now - t0 > (o.maxMs || 8000)) finish('max');
        else if (voiced < 3 && now - t0 > 5000) finish('silence');
      };
      // 麦克风不出声（2026-11-22）：上面的计时都在收到声音时才跑，一点声音都没有就会一直等。每 0.2 秒看一眼：
      // 1 秒没有新的声音 → 重开一次麦克风（接着用同一个 sink）；重开了 1.5 秒还是没有 → 按没听清结束；兜底：超过最长时间 1.5 秒照样结束
      let remic = false;
      wd = setInterval(() => {
        if (done) { clearInterval(wd); return; }
        if (performance.now() - t0 > (o.maxMs || 8000) + 1500) { finish('max'); return; }
        const q = lmQuiet();
        if (q > 1000 && !remic) {
          remic = true; D.remic = (D.remic || 0) + 1;
          const h = LM.sink; lmShut();
          // 开好时这一题已经结束了：麦克风要是没被下一题接走（sink 还空着）就照常预热着、15 秒后关；被接走了就别碰
          lmOpen().then(m => { if (m.err) { if (!done) finish('nodata'); return; } if (done) { if (!LM.sink) lmRelease(); return; } m.sink = h; });
        } else if (q > 1500 && remic && !voiced) finish('nodata');
      }, 200);
      // 本机识别录好的声音（没认出字才到这里）：先按原来的顺序补进来，再接着录。里面已经有人声就显示「识别中」，不叫人再说一遍
      const pre = D.pre; D.pre = null;
      if (pre) pre.forEach(d => mic.sink(d));
      if (o.onState && !done) o.onState(tx(pre && voiced >= 3 ? 'tk.asr.busy' : 'tk.asr.say'));
    });
  }

  // ---------- 家长：设置服务地址 / 家庭口令；看记录；须知 ----------
  function configure() {
    // 云端模式：没有密钥、服务地址可设，「设置服务」换成账号页（account.js）
    if (cloudOn()) { if (ACC()) ACC().accountSheet(); return; }
    // 销售版：用首次设置向导的那一页（粘贴、「测试」、「怎么开通？」），要家长密码
    if (window.EchoNative && window.EchoSetup && EchoSetup.sales && EchoSetup.sales()) { if (G.parentOk) G.parentOk(tx('tk.cfg.why'), () => EchoSetup.open('key', true)); return; }
    if (window.EchoNative) {   // 安卓 APK：家长在这台手机上填一次百炼密钥（只存在这台手机里），直连阿里云
      if (G.parentOk && !G.parentOk(tx('tk.cfg.why'))) return;
      const k = prompt(tx('tk.cfg.key'), '');
      if (k === null) return;
      if (k.trim() === 'clear') EchoNative.setKey('');
      else if (k.trim()) EchoNative.setKey(k.trim());
      G.toast(tx(direct() ? 'tk.cfg.ok' : 'tk.cfg.nokey'));
      if (G.renderHome) G.renderHome();
      return;
    }
    const cur = relayUrl();
    const u = prompt(tx('tk.cfg.url'), LS('echo-talk-url') || cur);
    if (u === null) return;
    LS('echo-talk-url', u.trim() || null);
    const c = prompt(tx('tk.cfg.code'), LS('echo-talk-code'));
    if (c !== null) LS('echo-talk-code', c.trim() || null);
    G.toast(tx('tk.cfg.now', { url: relayUrl() || tx('tk.cfg.none') }));
    if (G.renderHome) G.renderHome();
    relayAsk();   // 别的课：换了服务地址，重新问它会不会用这门语言聊
  }
  const npcOf = r => NPCS.byId[r.npc] || { zh: r.nm || r.npc, name: r.nm || r.npc };
  // 记录里岛民的名字：中文界面用中文名，英语界面用英文名（中文名是内容）
  const nameOf = n => { const z = gloss({ zh: n.zh }); return z != null ? z : n.name; };
  // 安全标记的原因：模型写的那句；本机查到的（老记录里存的是中文那句）按界面语言显示
  const whyOf = r => (!r.why || (I18N && r.why === I18N.t('tk.why.def', null, 'zh')) ? tx('tk.why.def') : r.why);
  const turnsHTML = (r, n) => r.turns.map(t => '<div class="' + t.who + (t.typed ? ' typed' : '') + '"' + (t.typed ? ' data-typed="' + hx('tk.log.typed') + '"' : '') + '>' + (t.who === 'you' ? hx('tk.log.me') : hx('tk.log.who', { name: n.name })) + G.esc(t.text) + '</div>').join('');
  function showLog() {
    const esc = G.esc, T = state();
    const rows = T.log.map(r => {
      const n = npcOf(r);
      return '<div class="tk-lr"><b>' + esc(nameOf(n)) + '</b> <small>' + new Date(r.t).toLocaleString(loc()) + (r.eval ? ' · ' + '★'.repeat(r.eval.stars) + (r.eval.done ? ' · 🎯' : '') : '') + (r.voice != null ? hx('tk.log.voice', { n: r.voice }) : '') + '</small>' +
        turnsHTML(r, n) + '</div>';
    }).join('') || '<p>' + hx('tk.log.none') + '</p>';
    G.openModal('<h2>' + hx('tk.foot.log') + '</h2><p class="muted">' + hx('tk.log.p') + '</p><div class="tk-logs">' + rows + '</div><button class="btn" data-act="close">' + hx('g.close') + '</button>');
  }
  // 家长看看：有安全标记的聊天（孩子说到难过、被欺负、有危险……）全文。要家长密码；看过的点「家长看过了」，周报就不再提示
  let parentUntil = 0;
  function concernSheet(again) {
    if (!again || Date.now() > parentUntil) {
      if (G.parentOk && !G.parentOk(tx('g.set.saf.look'))) return;   // game.js 的字表：「看需要注意的聊天」
      parentUntil = Date.now() + 5 * 60000;
    }
    const esc = G.esc, T = state(), list = T.log.filter(r => r.concern);
    const rows = list.map(r => {
      const n = npcOf(r);
      return '<div class="tk-concern"><b>' + esc(nameOf(n)) + '</b> <small>' + new Date(r.t).toLocaleString(loc()) + '</small>' +
        '<p class="why">⚠️ ' + esc(whyOf(r)) + '</p><div class="tk-lr">' + turnsHTML(r, n) + '</div>' +
        (r.seen ? '<small>' + hx('tk.concern.seen') + '</small>' : '<button class="btn small" data-act="talk_ack" data-t="' + r.t + '">' + hx('tk.concern.seen') + '</button>') + '</div>';
    }).join('') || '<p>' + hx('tk.concern.none') + '</p>';
    G.openModal('<h2>' + hx('tk.concern.btn') + '</h2><p class="muted">' + hx('tk.concern.p') + '</p><div class="tk-logs">' + rows + '</div><button class="btn" data-act="close">' + hx('g.close') + '</button>');
  }
  function privacySheet() {
    if (cloudOn()) {   // 云端模式：经过回声岛的服务器，服务器不存聊天记录（举报的那几句存 90 天）
      G.openModal('<h2>' + hx('tk.pv.h') + '</h2><ul class="tk-notice">' +
        hx('tk.pv.s1', { l: aiLabel() }) + hx('ac.pv.s2') + (nspHas() ? hx('tk.pv.dev') : '') + hx('tk.pv.role') + hx('tk.pv.safe') + hx('ac.pv.s5') + hx('tk.pv.name') + '</ul>' +
        '<div class="tk-btns"><button class="btn ghost small" data-act="suDoc" data-doc="privacy">' + hx('tk.pv.doc') + '</button><button class="btn ghost small" data-act="talk_forget">' + hx('tk.pv.forget') + '</button><button class="btn" data-act="close">' + hx('g.ok') + '</button></div>');
      return;
    }
    if (window.EchoSetup && EchoSetup.sales && EchoSetup.sales()) {   // 销售版：没有中转服务，用的是家长自己的阿里云账号
      G.openModal('<h2>' + hx('tk.pv.h') + '</h2><ul class="tk-notice">' +
        hx('tk.pv.s1', { l: aiLabel() }) + hx('tk.pv.s2') + (nspHas() ? hx('tk.pv.dev') : '') + hx('tk.pv.role') + hx('tk.pv.safe') + hx('tk.pv.s5', { n: Math.round(DAILY_SEC / 60) }) + hx('tk.pv.name') + '</ul>' +
        '<div class="tk-btns"><button class="btn ghost small" data-act="suDoc" data-doc="privacy">' + hx('tk.pv.doc') + '</button><button class="btn ghost small" data-act="talk_forget">' + hx('tk.pv.forget') + '</button><button class="btn" data-act="close">' + hx('g.ok') + '</button></div>');
      return;
    }
    G.openModal('<h2>' + hx('tk.pv.h') + '</h2><ul class="tk-notice">' +
      hx('tk.pv.w1') + (nspHas() ? hx('tk.pv.dev') : '') + hx('tk.pv.role') + hx('tk.pv.safe') + hx('tk.pv.w4') + hx('tk.pv.w5') + hx('tk.pv.name') + '</ul>' +
      '<div class="tk-btns"><button class="btn ghost small" data-act="talk_forget">' + hx('tk.pv.forget') + '</button><button class="btn" data-act="close">' + hx('g.ok') + '</button></div>');
  }

  function init(api) {
    G = api;
    nspRefresh();   // iPhone：本机识别能不能用（不弹框）
    relayAsk();     // 别的课（网页版）：问一次中转服务会不会用这门语言聊（英语课、云端模式、APK 直连不问）
    return {
      talk_open: t => open(t.dataset.npc),
      // 委托没完成点「再试一次」：接着聊，先不告诉大地图结果（again）
      talk_again: t => { const id = t.dataset.npc, last = LAST; if (C && C.npc.quest && !(C.rec && C.rec.goal)) C.again = true; close(); open(id === 'dyn' ? last : id); },
      talk_end: () => end('btn'),
      // 「返回」：评价出来了就关掉；还在聊就「结束并评价」（老版 game.js 的返回键调这个，也不会把这段聊天丢掉）
      talk_close: () => end('back'),
      talk_cfg: () => configure(),
      talk_log: () => showLog(),
      talk_help: () => help(),
      talk_replay: t => replay(!!t.dataset.slow),
      talk_typeopen: () => typeOpen(true),
      talk_micfix: () => { try { EchoNative.openAppSettings(); } catch (e) {} },
      talk_zh: t => showZh(t),
      // 别的课：词卡、示范句是这门语言的话，不一定在课程的条目表里——say 的第 4 个参数让它照这门语言念（课程包里有配音放配音，没有用这门语言的声音）
      talk_word: t => { const c = C, w = c && c.npc.words[+t.dataset.i]; if (w && G.say && !c.holding) { stopPlayback(); stopReplay(); if (c.lang) G.say(w, 0, '', true); else G.say(w); } },
      talk_step: t => {   // 点一个小步骤：亮出示范句、读一遍
        const c = C, s = c && c.goal.steps[+t.dataset.i]; if (!s) return;
        const sm = t.querySelector('small'); if (sm && sm.hidden) { sm.hidden = false; countLog('chatHint'); }
        if (s.en && G.say && !c.holding) { stopPlayback(); stopReplay(); if (c.lang) G.say(s.en, 0, '', true); else G.say(s.en); }
      },
      talk_privacy: () => privacySheet(),
      talk_forget: () => { state().mem = {}; G.save(); G.toast(tx('tk.forgot')); },
      talk_concerns: () => concernSheet(false),
      talk_ack: t => { const r = state().log.find(x => x.t === +t.dataset.t); if (r) { r.seen = 1; G.save(); } concernSheet(true); },
      // 云端模式：举报一句 AI 的话（带上它和前面最多 7 句）/ 评语；被服务器挡住时状态行下面的按钮
      talk_report: t => { const c = C, k = +t.dataset.k; if (!c || !ACC() || !(k >= 0)) return; ACC().reportSheet(repOf(c, c.turns.slice(Math.max(0, k - 7), k + 1))); },
      talk_report_eval: () => {
        const c = C, ev = c && c.rec && c.rec.eval; if (!ev || !ACC()) return;
        const said = [ev.praise].concat((ev.tips || []).map(x => x.better)).filter(Boolean).join(' ');
        if (said) ACC().reportSheet(repOf(c, c.turns.slice(-7).concat([{ who: 'npc', text: said }])));
      },
      talk_fix: t => { const c = C, w = t.dataset.w; if (!c || !ACC()) return; const npc = c.npc; close(); if (w === 'quota') ACC().memberSheet(); else ACC().fix(w, () => open(npc)); },
    };
  }
  const repOf = (c, turns) => ({ npc: c.npc.id, quest: c.npc.quest || null, turns: turns.map(x => ({ who: x.who, text: x.text })) });
  // 原生的异步方法（iPhone 的订阅 / 通过 Apple 登录，account.js 用）：编号和回调表和连阿里云的共用一套（window.__echoNative）。
  // → Promise<{ type: 'ok' / 'fail' / 'timeout', data: JSON 文字 }>；ms 不给 = 一直等（苹果的确认框）
  function nativeCall(m, args, ms) {
    return new Promise(res => {
      const N = window.EchoNative, id = ++nid;
      if (!N || typeof N[m] !== 'function') { res({ type: 'fail', data: '{"error":"nonative"}' }); return; }
      const tm = ms ? setTimeout(() => { delete NWS[id]; res({ type: 'timeout', data: '{"error":"timeout"}' }); }, ms) : 0;
      NWS[id] = (type, data) => { clearTimeout(tm); delete NWS[id]; res({ type, data: data || '' }); };
      try { N[m].apply(N, [id].concat(args || [])); } catch (e) { clearTimeout(tm); delete NWS[id]; res({ type: 'fail', data: JSON.stringify({ error: 'nonative', message: String(e && e.message) }) }); }
    });
  }
  window.EchoTalk = {
    init, homeHTML, open, openPerson, openQuest, blocked, errText: errTxt, relayUrl, cloudSR, listenOnce, aiTip, placeJudge, genQuiz, genOk, cloudTTS, speechLang, keyTest, get AI_LABEL() { return aiLabel(); }, stopListen: () => SR.stop && SR.stop(),
    today, endIfOpen, concerns, isOpen: () => !!C, lastErr: () => LASTERR, NEED, cfg: CFG, nativeCall,
    // iPhone 的本机识别：口语题现在会不会先用它、最近一次 / 最近 20 次识别的计时（只在内存里）、给设置页 / 小检查 / 周报的话
    localSR, level: micLevel, lastSpeech: () => (SRLOG.length ? Object.assign({}, SRLOG[SRLOG.length - 1]) : null), speechLog: () => SRLOG.map(x => Object.assign({}, x)),
    // 测试用：装成 iPhone 上「麦克风开着、一点声音都不送」（截掉 AudioWorklet 送来的声音；重开麦克风是新的一份，不受影响）
    _micMute: () => { if (LM.node) LM.node.port.onmessage = null; },
    speechState: () => (NSP.st ? Object.assign({ off: NSP.off }, NSP.st) : { off: NSP.off, has: nspHas() }), speechRefresh: nspRefresh, srText,
    // 别的语言的课：换上这门课的聊天角色（game.js 的 courseUse，课程的 TALK）
    useNpcs: o => { if (o && o.list && o.byId) NPCS = o; },
    // 现在学的这门课能不能和岛民聊（英语课一直 true；别的课看服务器会不会，TALK.md §4）：game.js 的学习锁、每日任务、单元上的「聊这个单元」问它；
    // langAsk() 重新问一次网页版的中转服务（返回 Promise，问完了 langOk() 才是新的）
    langOk: () => !langOff(), langAsk: () => relayAsk(),
    // 第二轮（TALK.md）：别的课里支线委托开不开（world.js 的 QL() 问；给了 id = 这一条在课程包里有没有）、口语题的 AI 发音点评出不出（game.js 的 aiTip 问）。
    // 英语课都是 true
    questOk: id => { try { return questOk(id); } catch (e) { return false; } }, tipOk: () => { try { return tipOk(); } catch (e) { return false; } },
    // 测试用：别的课里一张词卡在一句话里说到了没有（markWordsL 用的同一个判断）
    _wordHit: (w, text, lang) => wordHit(w, text, lang, lang === 'es'),
  };
})();
