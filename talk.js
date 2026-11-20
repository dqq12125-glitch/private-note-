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
  const NPCS = window.TALK_NPCS;
  const Core = () => window.TalkCore;
  let G = null;                    // game.js 给的工具（S、save、toast、esc、openModal……）
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
      'tk.help': '💡 帮帮我', 'tk.replay': '🔁 再听一遍', 'tk.slow': '🐢 慢一点', 'tk.mic': '🎤 按住说英语', 'tk.mic.on': '🔴 正在听……松开发送',
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
      'tk.asr.say': '🎤 请说……', 'tk.asr.busy': '🎧 识别中……',
      // 口语题用的是哪个识别（iPhone 的本机识别 / 云端识别）：设置页、开口前的小检查、周报诊断一行、家长须知。不写是哪家的
      'tk.sr.env': '✅ 口语自动打分：本机识别（用 iPhone 自带的语音识别在手机上听写，不用联网、不用登录；手机用不了时改用云端识别）',
      'tk.sr.chk.dev': '麦克风没问题！口语题用本机识别：在这台手机上听写，不用联网。', 'tk.sr.chk.cloud': '（口语识别：云端，要联网）',
      'tk.sr.rp': ' · 口语识别：本机 {a} 次、云端 {b} 次，本机说完约 {s} 秒出分',
      'tk.pv.dev': '<li>iPhone 上的口语题先用 iPhone 自带的语音识别，<b>在这台手机上</b>把说的英语写成文字来打分，这段声音<b>不上传</b>；只有这台手机用不了本机识别（不支持、没允许）时，才按上面那样发出去识别。</li>',
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
      'tk.help': '💡 Help me', 'tk.replay': '🔁 Hear it again', 'tk.slow': '🐢 Slower', 'tk.mic': '🎤 Hold to speak English', 'tk.mic.on': '🔴 Listening… let go to send',
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
      'tk.asr.say': '🎤 Speak now…', 'tk.asr.busy': '🎧 Recognising…',
      'tk.sr.env': '✅ Automatic speaking score: on-device recognition (the iPhone\'s own speech recognition writes down what you say on this phone; no internet or sign-in needed. If it can\'t be used, cloud recognition is used instead)',
      'tk.sr.chk.dev': 'The microphone works! Speaking questions use on-device recognition: it all happens on this phone, no internet needed.', 'tk.sr.chk.cloud': ' (Speech recognition: cloud, needs internet)',
      'tk.sr.rp': ' · Speech recognition: on device {a}, cloud {b}; on device the score comes about {s}s after you stop',
      'tk.pv.dev': '<li>On iPhone, speaking questions first use the iPhone\'s own speech recognition to write down what was said <b>on this phone</b>; that audio is <b>not uploaded</b>. Only if this phone can\'t use on-device recognition (not supported, or not allowed) is it sent out for recognition as described above.</li>',
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
      '.tk-b .tk-zh{display:block;margin-top:4px;padding-top:4px;border-top:1px dashed var(--line,#d3e6e2);color:var(--ink-2,#4a6478);font-size:14px}',
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
  const face = n => EchoPeople.portrait(n.lookObj || EchoPeople.LOOKS[n.look] || EchoPeople.LOOKS.clerk);

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
    const esc = G.esc, T = state(), url = relayUrl(), core = Core(), t = today(), nc = concerns();
    const card = (n, now) => {
      const best = T.done[n.id], g = core.goalOf(n, core.goalIndex ? core.goalIndex(n, T.n[n.id] || 0, chatLv()) : T.n[n.id] || 0);
      // 角色的中文名、话题和音色的中文是内容：英语界面只留英文名、英文话题，没有音色那一截
      const nz = gloss({ zh: n.zh }), tz = gloss({ zh: n.topicZh }), vz = gloss({ zh: n.voiceZh });
      return '<button class="tk-card' + (now ? ' now' : '') + '" data-act="talk_open" data-npc="' + n.id + '">' +
        '<img src="' + face(n) + '" alt="">' +
        '<span class="tk-t"><b>' + (n.unit ? '<em>Unit ' + n.unit + (now ? hx('tk.card.now') : '') + '</em> ' : '') + (nz != null ? esc(nz) + ' <small>' + esc(n.name) + '</small>' : esc(n.name)) + '</b>' +
        '<span>' + (tz != null ? esc(tz) + ' · ' : '') + '<i>' + esc(n.topic) + '</i></span>' +
        '<small>' + [vz != null ? '🔊 ' + esc(vz) : '', best ? '★'.repeat(best) : '', g.lv ? hx('tk.card.next', { lv: g.lv }) : ''].filter(Boolean).join(' · ') + '</small></span><span class="tk-go">🎙️</span></button>';
    };
    // 课本单元的聊天角色放前面，正在学的单元排第一个；后面是岛上的人
    // 只列正在学的这一册（别的册在闯关页每个单元上点「聊这个单元」）
    const cu = G.curUnit ? G.curUnit() : null, units = cu ? NPCS.list.filter(n => n.book === cu.book) : [], isle = NPCS.list.filter(n => !n.unit);
    const order = units.filter(n => n.unit === cu.n).concat(units.filter(n => n.unit !== cu.n));
    const cards = (units.length ? '<h3 class="tk-h">' + hx('tk.h.book', { b: cu.bshort }) + '</h3>' + order.map(n => card(n, n.unit === cu.n)).join('') + '<h3 class="tk-h">' + hx('tk.h.isle') + '</h3>' : '') +
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
      node.port.onmessage = e => { if (MIC.on) { MIC.buf.push(e.data); MIC.len += e.data.length; if (MIC.len >= MIC.rate / 10) flushMic(); } };
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
  function status(t) { const s = $('#tk-status'); if (s) s.textContent = t; }
  const readyText = () => tx(MIC.ctx ? 'tk.ready.mic' : 'tk.ready.type');

  // 大地图上随便一个人：把名字、身份、所在的岛、他说过的话交给中转服务，由服务器拼出人设（安全规则服务器自己加）
  // top：聊天界面顶上那一行（已经按界面语言拼好）；目标、步骤用 talk-core 的 personNpc（和服务器拼的一样）
  function openPerson(d) {
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
  function openQuest(qid, look, onResult) {
    const q = window.QUESTS && Object.prototype.hasOwnProperty.call(QUESTS.byId, qid) ? QUESTS.byId[qid] : null;
    if (!q) return;
    return open({
      id: 'dyn', quest: q.id, name: q.who, zh: q.who, lookObj: look, voiceZh: '',
      top: tx('tk.top.quest', { q: lbl(q) }), topic: q.en, goalZh: q.goalZh,
      words: q.words.map(w => w[0]), wordsZh: q.words.map(w => w[1]), onResult,
    });
  }
  function result(c) {
    const f = c.npc && c.npc.onResult; if (typeof f !== 'function') return;
    const ev = c.rec && c.rec.eval;
    try { f({ done: !!(c.rec && c.rec.goal), stars: ev ? ev.stars : 0, said: c.turns.some(t => t.who === 'you') }); } catch (e) { console.error(e); }
  }
  // 现在能不能开聊（大地图上的委托先问一下）：能聊返回 ''；肯定聊不了就返回给孩子看的一句话（和聊天界面里连不上时说的一样）：
  // 没开通、手机说没网、今天的聊天时间用完了。密钥不对 / 额度用完由 game.js 的 chatKeyBad 判断，那一句用 errText('auth' / 'quota') 取
  function blocked() {
    if (!relayUrl()) return tx('w.q.noai');   // world.js 的字表：「AI 聊天还没开通，请告诉家长」
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return errTxt('offline');
    // 云端模式：没登录、要家长同意的不拦（open() 会弹登录 / 请家长同意那一页）；只有账号说今天的时间用完了才拦
    if (cloudOn()) { try { return ACC() && ACC().need('talk') === 'quota' ? tx('ac.err.quota') : ''; } catch (e) { return ''; } }
    try { if (G && G.S && (G.dayLog().chatDaily || (direct() && DAILY_SEC - usage() < 20))) return kidErr('daily'); } catch (e) { /* 读不到就让他试 */ }
    return '';
  }
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function open(id) {
    const npc = typeof id === 'object' ? id : NPCS.byId[id]; if (!npc) return;
    if (C) { if (C.ending || C.done) close(); else return; }
    lmShut();   // 口语题预热的麦克风先关掉，聊天自己开
    const url = relayUrl();
    if (!url) { configure(); return; }
    // 云端模式：没登录 / 年龄段没选 / 孩子还没有家长同意 / 今天的时间用完了 → 先弹那一页（account.js），弄好了再接着开这段聊天
    if (cloudOn() && ACC() && !ACC().ask('talk', () => open(id))) return;
    const esc = G.esc, core = Core(), T = state();
    // 地图上的人：目标、步骤按 talk-core 的临时人设（和服务器拼的一样）；委托按 quests.js 里那一条
    const base = npc.quest ? core.questNpc(QUESTS.byId[npc.quest]) : npc.desc ? core.personNpc(npc.desc) : npc, mk = memKey(npc), lvl = chatLv(), goal = core.goalOf(base, core.goalIndex ? core.goalIndex(base, T.n[mk] || 0, lvl) : T.n[mk] || 0);   // lvl：按能力走时岛民按第几级说话、挑哪个目标（没有 = null，照旧）
    // 目标：中文界面用中文的目标；别的界面语言用英文的（委托、岛民、地图上的人都有英文的 goal）
    const goalTx = lbl({ zh: goal.goalZh || npc.goalZh || '', en: goal.goal || npc.goal || '' }), zh = npc.wordsZh || [], mem = T.mem[mk] || null;
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
      (goal.steps.length ? '<ol class="tk-steps" id="tk-steps">' + goal.steps.map((s, k) => '<li data-act="talk_step" data-i="' + k + '"><i>☐</i><span>' + esc(stepTxt(s, k)) + '</span>' + (s.en ? '<small hidden>' + hx('tk.eg', { s: s.en }) + '</small>' : '') + '</li>').join('') + '</ol>' : '') +
      '<div class="tk-words">' + npc.words.map((w, k) => '<button type="button" class="tk-w" data-act="talk_word" data-i="' + k + '">' + esc(w) + (gloss({ zh: zh[k] }) ? '<small>' + esc(zh[k]) + '</small>' : '') + '</button>').join('') + '</div></div>' +
      '<div class="tk-log" id="tk-log"></div>' +
      '<div class="tk-status" id="tk-status">' + hx('tk.st.conn') + '</div>' +
      '<div class="tk-ctl"><div class="tk-tools"><button type="button" id="tk-help" data-act="talk_help" disabled>' + hx('tk.help') + '</button><button type="button" id="tk-re" data-act="talk_replay" disabled>' + hx('tk.replay') + '</button><button type="button" id="tk-slow" data-act="talk_replay" data-slow="1" disabled>' + hx('tk.slow') + '</button></div>' +
      '<button class="tk-mic" id="tk-mic" disabled>' + hx('tk.mic') + '</button>' +
      '<button type="button" class="tk-typeopen" id="tk-typeopen" data-act="talk_typeopen" hidden>' + hx('tk.typeopen') + '</button>' +
      '<form class="tk-type" id="tk-type" hidden><input id="tk-in" maxlength="200" autocomplete="off" placeholder="' + hx('tk.type.ph') + '"><button class="btn">' + hx('tk.send') + '</button></form>' +
      '<small class="tk-typenote" id="tk-typenote" hidden>' + hx('tk.typenote') + '</small></div></div>';
    document.body.appendChild(ov);
    LAST = npc;
    // ui：这段聊天的界面语言（发给 AI：评语、打勾按它；「更好的说法」的解释是不是中文）
    C = { npc, base, mk, goal, level: lvl, ui: uiNow(), ws: null, bubble: null, holding: false, ready: false, ending: false, done: false, t0: Date.now(), turns: [], pend: [], live: null, ticks: goal.steps.map(() => false) };
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
    if (npc.desc) { const d = npc.desc; q.set('p', b64(JSON.stringify({ name: d.name, g: d.g, kid: !!d.kid, role: d.role, island: d.island, place: d.place, lines: d.lines, words: d.words }))); }
    if (npc.quest) q.set('quest', npc.quest);   // 委托：只发 id
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
        // 说完的话可以点一下看中文（只有中文界面：英语界面就是在学这门语言，不翻译）
        if (c.bubble && m.text) { c.bubble._text = m.text; if (zhUi()) { c.bubble.dataset.act = 'talk_zh'; c.bubble.classList.add('tap'); c.bubble.title = tx('tk.zh.tap'); } }
        // 云端模式（公开版）：每句 AI 的话后面一个小「⚑」举报（两家商店都要求 AI 生成的内容能举报）
        if (cloudOn() && c.bubble && m.text) c.bubble.insertAdjacentHTML('beforeend', '<button type="button" class="tk-rep" data-act="talk_report" data-k="' + (c.turns.length - 1) + '" title="' + hx('ac.t.report') + '" aria-label="' + hx('ac.t.report') + '">⚑</button>');
        c.bubble = null;
        keepLast();
        if (OUT.last) ['#tk-re', '#tk-slow'].forEach(s => { const b = $(s); if (b) b.disabled = false; });
        // 一个字都没听到的气泡（没出声 / 杂音）：等 5 秒，字还没来就删掉（正在按着说的那个不删）
        const empty = c.pend.filter(b => !b._has && b !== c.live);
        if (empty.length) setTimeout(() => empty.forEach(b => { if (!b._has && b !== c.live) { b.remove(); dropPend(c, b); } }), 5000);
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
        const p = youBubble(c, m.item, firstFree(c));
        if (p) { p.textContent = m.text; p._has = true; p.classList.remove('wait'); dropPend(c, p); stick(); } else bubble('you', m.text);
        c.turns.push({ who: 'you', text: m.text });
        heard(c, m.text);
      } else if (m.type === 'limit') { c.limitHit = true; status(m.zh); }
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
      if (c !== C || c.ending || c.ready) return;
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
      MIC.buf = []; MIC.len = 0; MIC.on = true; c.pressAt = Date.now();
      mic.classList.add('on'); mic.textContent = tx('tk.mic.on');
      // 一按下就出现自己的气泡，说的话边说边冒出来
      c.live = bubble('you wait', '🎤 …'); c.pend.push(c.live);
    };
    const up = () => {
      if (!c.holding) return;
      c.holding = false; MIC.on = false; flushMic();
      mic.classList.remove('on'); mic.textContent = tx('tk.mic');
      const b = c.live; c.live = null;
      if (Date.now() - c.pressAt < 400) { wsSend({ type: 'commit' }); if (b) { b.remove(); dropPend(c, b); } status(tx('tk.st.short')); return; }
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

  // 孩子用语音说了一句（识别结果）：算句数、目标词卡片变绿、实时打勾
  function heard(c, text) {
    countLine(text);
    markWords(c, text);
    if (/[㐀-鿿]/.test(text)) countLog('chatSaidZh');   // 说了中文（周报：中文句数）
    checkSteps(c);
  }
  // 今天用语音说的英语句子：≥3 个英文词、不含中文；同一句话一天只算一次。说满 6 句弹一句
  function countLine(text) {
    const core = Core();
    if (!core.isLine(text, chatLv())) return false;   // 按能力走的入门 / 初级：1 个、2 个英文词就算一句
    const T = state(), d = G.dayStr(), key = String(text).toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!T.seen || T.seen.d !== d) T.seen = { d, h: [] };
    if (T.seen.h.includes(key)) return false;
    T.seen.h.push(key); if (T.seen.h.length > 80) T.seen.h.shift();
    const L = G.dayLog(), before = L.voiceLines || 0, n = core.enWords(text).length;
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
  function markWords(c, text) {
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
        const r = await relayPost('/steps', { npc: c.npc.id, nm: c.npc.id === 'dyn' ? c.npc.name : undefined, q: c.npc.quest || undefined, g: c.goal.i, ui: c.ui !== 'zh' ? c.ui : undefined, turns: turns.map(t => ({ who: t.who, text: t.text, typed: !!t.typed })) }, 12000);
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
  const ZHC = {};
  async function translate(text) {
    if (ZHC[text]) return ZHC[text];
    const core = Core(); let zh = '';
    try {
      if (direct()) {
        const r = await nativePost(core.EVAL_URL, JSON.stringify(core.zhBody(text)), 10000);
        if (r.ok) { const j = JSON.parse(r.text); textUse(j); zh = core.parseZh(j); } else noteAi('zh', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/zh', { text }, 10000);
        if (r.ok) zh = String(JSON.parse(r.text).zh || ''); else noteAi('zh', 'HTTP ' + r.status + ' ' + r.text);
      }
    } catch (e) { zh = ''; }
    zh = String(zh || '').trim().slice(0, 200);
    if (zh) ZHC[text] = zh;
    return zh;
  }
  async function showZh(b) {
    if (!b || !b._text || b._busy || !zhUi()) return;   // 只翻成中文：别的界面语言不出这个
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
    const ev = core.judge(c.goal, c.turns, raw, c.ticks, c.level);
    let rec = c.rec, coins = 0, newGoal = false;
    if (!rec) {
      rec = c.rec = {
        t: c.t0, npc: npc.id, nm: npc.id === 'dyn' ? npc.name : undefined, q: npc.quest || undefined, g: c.goal.i,
        turns: c.turns.slice(0, 40).map(t => t.typed ? { who: t.who, text: t.text, typed: 1 } : { who: t.who, text: t.text }),
        eval: null, sec: sec != null ? sec : Math.round((Date.now() - c.t0) / 1000), voice: core.voiceLines(c.turns, c.level),
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
      if (G.revAddFree) ev.tips.forEach(t => G.revAddFree(t.better, c.ui === 'zh' ? t.zh : '', t.said));
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
    const stepR = (s, k) => esc(stepTxt(s, k)) + (!zhUi() && !s.task && s.en ? ' <small>' + hx('tk.eg', { s: s.en }) + '</small>' : '');
    let body;
    if (ev) {
      body = '<div class="tk-stars">' + '★'.repeat(ev.stars) + '<i>' + '★'.repeat(3 - ev.stars) + '</i></div>' +
        '<b>' + hx(ev.done ? (ev.stars === 3 ? 'tk.r.all' : 'tk.r.most') : voice < 3 ? 'tk.r.speak' : 'tk.r.near') + '</b>' +
        (voice < 3 ? '<p class="tk-note">' + hx('tk.r.few', { typed: typed ? tx('tk.r.typed') : '' }) + '</p>' : '') +
        (steps.length ? '<ul class="tk-steps-r">' + steps.map((s, k) => '<li>' + (ev.steps[k] ? '✅ ' : '⬜ ') + stepR(s, k) + '</li>').join('') + '</ul>' : '') +
        (ev.praise ? '<p>' + esc(ev.praise) + '</p>' : '') +
        (ev.ai ? '<p class="tk-ai-line">' + hx('tk.r.ai') + '</p>' : '') +
        (!ev.ai ? '<p class="tk-note">' + hx('tk.r.noai') + '</p>' : '') +
        (ev.tips.length ? '<div class="tk-tips"><b>' + hx('tk.r.tips') + '</b>' + ev.tips.map(t => '<div><s>' + esc(t.said) + '</s><br>→ <b>' + esc(t.better) + '</b><small>' + esc(t.zh) + '</small></div>').join('') + '</div>' : '') +
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
    const body = core.tipBody(target, heard, ui);
    let tip = '';
    try {
      if (direct()) { const r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 10000); if (r.ok) { const j = JSON.parse(r.text); textUse(j); tip = j.choices[0].message.content; } else noteAi('tip', r.text); }
      else if (relayHttp()) { const r = await relayPost('/tip', { target, heard, ui: ui !== 'zh' ? ui : undefined }, 10000); if (r.ok) tip = JSON.parse(r.text).tip; else noteAi('tip', 'HTTP ' + r.status + ' ' + r.text); }
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
  // 朗读没有提前配音的句子：阿里云语音合成，返回音频地址（同一句话这次打开游戏里只合成一次）。lang 默认 English（AI 提示用 Chinese）
  const TTSC = {};
  async function cloudTTS(text, g, lang) {
    lang = lang === 'Chinese' ? 'Chinese' : 'English';
    const k = (g || 'f') + '|' + lang + '|' + text;
    if (TTSC[k]) return TTSC[k];
    let url = '';
    try {
      if (direct()) {
        const body = { model: 'qwen3-tts-flash', input: { text: String(text).slice(0, 300), voice: g === 'm' ? 'Aiden' : 'Jennifer', language_type: lang } };
        const r = await nativePost('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', JSON.stringify(body), 6000);
        if (r.ok) url = JSON.parse(r.text).output.audio.url; else noteAi('tts', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/tts', lang === 'English' ? { text, g } : { text, g, lang }, 6000);
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
  const LM = { stream: null, ctx: null, node: null, rate: 16000, sink: null, t: 0 };
  const RTA = { fails: 0 };   // 实时识别连续失败几次就先不用了（这次打开游戏）
  async function lmOpen() {
    clearTimeout(LM.t);
    if (LM.stream && LM.stream.active && LM.ctx && LM.ctx.state !== 'closed') {
      if (LM.ctx.state !== 'running') { try { await LM.ctx.resume(); } catch (e) {} }
      return LM;
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
    node.port.onmessage = e => { if (LM.sink) LM.sink(e.data); };
    Object.assign(LM, { stream, ctx, node, rate: ctx.sampleRate, sink: null });
    return LM;
  }
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
  function asrSock(on) {
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
    try { ws = new WebSocket(url + '/asr-rt' + (code ? '?code=' + encodeURIComponent(code) : '')); } catch (e) { setTimeout(() => on('error', e.message), 0); return { send() {}, close() {} }; }
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
  async function wholeAsr(chunks, len, rate) {
    const body = { model: 'qwen3-asr-flash', stream: false, asr_options: { language: 'en', enable_itn: false },
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + wav16(chunks, len, rate) } }] }] };
    let text = '', r;
    if (direct()) {
      r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 12000);
      try { text = String(JSON.parse(r.text).choices[0].message.content || '').trim(); } catch (e) {}
    } else {
      r = await relayPost('/asr', { audio: body.messages[0].content[0].input_audio.data.split(',')[1] }, 12000);
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
  // · 本机开不起来（这台手机没有本机识别、没给语音识别的权限、正在弹框、录音开不起来、超时）：同一次里接着走云端识别，孩子不用再点一下；
  //   「没有 / 不允许」（unavailable / denied / restricted）这次打开 App 记住，不再每题先试本机（回到前台再问一次原生，打开了就又用本机）。
  //   麦克风被拒是例外：云端也要麦克风，直接按「麦克风被拒」回（game.js 弹「去打开」）。
  // · 每次识别的计时（点了到开始听、第一个字、结束、最后一个字到结束）留在内存里：EchoTalk.lastSpeech() / speechLog()，不上传。
  // · 想对比时可以临时关掉本机识别：localStorage['echo-sr'] = 'cloud'（只给调试用，界面上没有开关）。
  const NSP = { st: null, off: '', fails: 0 };
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
      // 家长后来在「设置」里打开了语音识别 / 手机能用了：不再记着「用不了」
      if (NSP.off && nspUsable(NSP.st) && NSP.st.auth === 'authorized' && NSP.st.available !== false) { NSP.off = ''; NSP.fails = 0; }
      return NSP.st;
    });
  }
  // 本机识别一次：→ { text, err, how }；本机开不起来、要改走云端时 → null（D.fell 写着原因）
  function nativeListen(o, D) {
    return new Promise(resolve => {
      const N = window.EchoNative, id = ++nid, now = () => performance.now();
      const short = !!o.short, need = o.long ? 1500 : short ? 400 : 600;
      let done = false, started = 0, text = '', chg = 0, voice = false, tick = 0, tm = 0, raw = '';
      const segs = [];
      const first = s => (s.split(' ')[0] || '').toLowerCase();
      const io = window.__echoIOS;
      const audio = on => { try { if (io && io.speech) io.speech(on); } catch (e) { /* 老的壳子 */ } };
      const stopNative = () => { try { N.speechStop(++nid); } catch (e) { /* 不在 App 里 */ } };
      const cleanup = () => { window.removeEventListener('echo-speech', onEv); clearInterval(tick); clearTimeout(tm); delete NWS[id]; if (SR.stop === userStop) SR.stop = null; audio(false); };
      const finish = how => {
        if (done) return; done = true;
        stopNative(); cleanup();
        const t = text.trim();
        // 被来电 / Siri 打断、切到后台：说了一半的不拿去打分（不算一次尝试，孩子回来再说）
        if (t && how !== 'interrupted') { NSP.fails = 0; resolve({ text: t, err: null, how, ms: Math.round(now() - D.t0) }); return; }
        resolve({ text: '', err: how === 'user' || how === 'interrupted' ? 'aborted' : 'no-speech', how });
      };
      // 开不起来：改走云端（null）；「没有 / 不允许」记住
      const fall = code => {
        if (done) return; done = true;
        cleanup();
        D.fell = code || 'error';
        if (code === 'unavailable' || code === 'denied' || code === 'restricted') NSP.off = code;
        else if (code === 'audio' && ++NSP.fails >= 2) NSP.off = 'audio';
        if (code === 'mic') { D.eng = 'device'; resolve({ text: '', err: 'not-allowed', why: 'NotAllowedError', how: 'mic' }); return; }
        resolve(null);
      };
      // 孩子点了停：开始听了就拿已经听到的打分；还在等原生开起来（弹权限框）就整个不要了，也不改走云端
      const userStop = () => {
        if (started) { finish('user'); return; }
        if (done) return;
        done = true; stopNative(); cleanup();
        resolve({ text: '', err: 'aborted', how: 'user' });
      };
      const onEv = e => {
        const d = e && e.detail;
        if (!d || d.sid !== id || done || !started) return;
        if (d.kind === 'partial' || d.kind === 'final') {
          const p = String(d.text || '').replace(/\s+/g, ' ').trim();
          // 手机上的识别在人停顿一下以后，有时从头另起一段（新的字不接着前面的）：前面那段先留着、拼在一起。
          // 只在「停住 0.35 秒以上、第一个词变了、字变少了」时才算另起一段（平常的改字不是这样）
          if (p && raw && p !== raw && now() - chg >= 350 && first(p) !== first(raw) && p.split(' ').length < raw.split(' ').length) segs.push(raw);
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
          if (voice && D.voice == null) D.voice = now() - D.t0;
        } else if (d.kind === 'error') {
          D.nerr = String(d.code || '');
          // 原生自己出错（不是「没听到声音」那种）：连着两次没拿到字就先不用本机了
          if (!text && !/\b1110\b/.test(D.nerr) && ++NSP.fails >= 2) NSP.off = 'error';
          finish('error');
        } else if (d.kind === 'end') finish(d.reason === 'interrupted' || d.reason === 'background' || d.reason === 'audio-reset' ? 'interrupted' : 'end');
      };
      // 每 50 毫秒看一眼：说完了没有、太久没有
      const check = () => {
        if (done) return;
        const t = now(), since = t - started;
        if (since > (o.maxMs || 8000)) { finish('max'); return; }
        if (!text) { if (since > (o.long ? 7000 : 5000) && !voice) finish('silence'); return; }
        const still = t - chg;
        if (still >= need && (!voice || still >= need + 1200)) finish('done');
      };
      lmShut();       // 云端识别预热着的网页麦克风先放掉：这次原生自己录
      audio(true);
      window.addEventListener('echo-speech', onEv);
      SR.stop = userStop;
      // 第一次要弹「语音识别」和麦克风的权限框：等久一点；平时 5 秒还没开起来就改走云端
      const st = NSP.st, asks = !st || st.auth !== 'authorized' || st.mic !== 'granted';
      tm = setTimeout(() => { if (!started) { stopNative(); fall('timeout'); } }, asks ? 60000 : 5000);
      NWS[id] = (type, data) => {
        delete NWS[id]; clearTimeout(tm);
        let j = {}; try { j = JSON.parse(data || '{}') || {}; } catch (e) { j = {}; }
        if (done) { if (type === 'ok') stopNative(); return; }
        if (type !== 'ok') { fall(String(j.error || 'error')); return; }
        started = now(); D.eng = 'device'; D.listen = started - D.t0; D.nms = j.ms;
        NSP.st = Object.assign(NSP.st || { onDevice: true }, { auth: 'authorized', mic: 'granted' });   // 开起来了：权限都有了（下次不用等弹框那么久）
        if (o.onState) o.onState(tx('tk.asr.say'));
        tick = setInterval(check, 50);
      };
      try { N.speechStart(id, JSON.stringify({ short, long: !!o.long, locale: 'en-US' })); } catch (e) { fall('error'); }
    });
  }
  // 记一次识别的计时（只在内存里，最近 20 次）：listen 点了到开始听、first 第一个字、end 结束、lag 最后一个字变了到结束（说完以后等了多久）
  function srNote(D, r) {
    const now = performance.now(), ms = v => (v == null ? null : Math.round(v));
    const rec = { at: D.at, eng: D.eng || '', short: D.short, how: (r && r.how) || '', ok: !!(r && r.text), err: (r && r.err) || '', fell: D.fell || '',
      listen: ms(D.listen), first: ms(D.first), voice: ms(D.voice), end: ms(now - D.t0), lag: D.chg ? ms(now - D.chg) : null, ready: ms(D.ready), nms: D.nms == null ? null : D.nms };
    if (D.nerr) rec.nerr = D.nerr;
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
    o = o || {};
    const D = { at: Date.now(), t0: performance.now(), short: !!o.short, eng: '', fell: '' };
    let r = null;
    if (localSR() && !C) r = await nativeListen(o, D);
    if (!r && D.fell) {
      // 本机开不起来，云端又用不了（没有密钥 / 云端模式没登录）：和以前没有 AI 时一样（game.js 走「先跳过」、请他登录）
      if (!cloudSR()) r = { text: '', err: 'nokey', why: 'nokey' };
      else if (cloudOn() && !(ACC() && ACC().signed())) r = { text: '', err: 'nokey', why: 'signin' };
    }
    if (!r) { D.eng = 'cloud'; r = await cloudListen(o, D); }
    return srNote(D, r);
  }
  async function cloudListen(o, D) {
    if (!cloudSR()) return { text: '', err: 'service-not-allowed' };
    if (cloudOn() && !(ACC() && ACC().signed())) return { text: '', err: 'network', why: noteAi('asr', '{"error":"auth"}') };   // 云端模式没登录：不开麦克风
    if (C) return { text: '', err: 'busy' };   // 正在和岛民聊天，麦克风被占着
    const mic = await lmOpen();
    if (mic.err) return { text: '', err: mic.err, why: mic.why };
    D.listen = performance.now() - D.t0;
    const rate = mic.rate, chunks = [], st = { pos: 0 }, t0 = performance.now();
    let len = 0, voiced = 0, quiet = 0, done = false, over = false, ready = false, queue = [], pend = [], pendN = 0, texts = [], cur = '', grace = 0, inSpeech = false;
    let dead = RTA.fails >= 3;
    return new Promise(resolve => {
      const full = () => (texts.join(' ') + ' ' + cur).replace(/\s+/g, ' ').trim();
      const fail = d => { if (dead) return; dead = true; RTA.fails++; if (d) noteAi('asr-rt', d); };
      const heard = () => {
        const t = full(); if (!t) return;
        if (t !== D.lastT) { D.lastT = t; D.chg = performance.now(); if (D.first == null) D.first = D.chg - D.t0; }
        if (o.onState) o.onState(t);
        if (o.match && o.match(t)) finish('match');
      };
      const sock = dead ? null : asrSock((type, data) => {
        if (over) return;
        if (type === 'open') {
          sock.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: 'en' },
            turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: o.short ? 400 : o.long ? 1000 : 600 } } }));
          ready = true; D.ready = performance.now() - D.t0; queue.forEach(s => sock.send(s)); queue = [];
        } else if (type === 'message') {
          let m; try { m = JSON.parse(data); } catch (e) { return; }
          if (m.type === 'conversation.item.input_audio_transcription.text') { cur = (m.text || '') + (m.stash || ''); heard(); }
          else if (m.type === 'conversation.item.input_audio_transcription.completed') {
            RTA.fails = 0; inSpeech = false; texts.push(m.transcript || ''); cur = ''; heard();
            // 说完一段：稍等一下，孩子没接着说就结束（句子中间停顿了会接着识别下一段）
            clearTimeout(grace); grace = setTimeout(() => finish('done'), o.short ? 200 : o.long ? 1500 : 500);
          } else if (m.type === 'input_audio_buffer.speech_started') { inSpeech = true; clearTimeout(grace); }
          else if (m.type === 'error') fail(JSON.stringify(m.error || m).slice(0, 200));
        } else if (type === 'error' || type === 'closed') fail(type === 'error' ? String(data || '') : '');
      });
      const finish = async why => {
        if (done) return; done = true;
        clearTimeout(grace); SR.stop = null; lmRelease();
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
        if (voiced < 3 || len < rate * 0.3) return resolve(t ? { text: t, err: null, how: why } : { text: '', err: why === 'user' ? 'aborted' : 'no-speech' });
        // 实时识别没认完（或者没连上）：录好的整段重新识别；整段也失败就用手上的半句
        if (o.onState) o.onState(tx('tk.asr.busy'));
        const w = await wholeAsr(chunks, len, rate);
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
        if (loud) { voiced++; quiet = 0; } else if (voiced >= 3) { if (!quiet) quiet = now; else if (now - quiet > (o.long ? 2600 : dead ? 1100 : 1800)) finish('silence'); }
        if (now - t0 > (o.maxMs || 8000)) finish('max');
        else if (voiced < 3 && now - t0 > 5000) finish('silence');
      };
      if (o.onState) o.onState(tx('tk.asr.say'));
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
      talk_word: t => { const c = C, w = c && c.npc.words[+t.dataset.i]; if (w && G.say && !c.holding) { stopPlayback(); stopReplay(); G.say(w); } },
      talk_step: t => {   // 点一个小步骤：亮出示范句、读一遍
        const c = C, s = c && c.goal.steps[+t.dataset.i]; if (!s) return;
        const sm = t.querySelector('small'); if (sm && sm.hidden) { sm.hidden = false; countLog('chatHint'); }
        if (s.en && G.say && !c.holding) { stopPlayback(); stopReplay(); G.say(s.en); }
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
    init, homeHTML, open, openPerson, openQuest, blocked, errText: errTxt, relayUrl, cloudSR, listenOnce, aiTip, placeJudge, cloudTTS, keyTest, get AI_LABEL() { return aiLabel(); }, stopListen: () => SR.stop && SR.stop(),
    today, endIfOpen, concerns, isOpen: () => !!C, lastErr: () => LASTERR, NEED, cfg: CFG, nativeCall,
    // iPhone 的本机识别：口语题现在会不会先用它、最近一次 / 最近 20 次识别的计时（只在内存里）、给设置页 / 小检查 / 周报的话
    localSR, lastSpeech: () => (SRLOG.length ? Object.assign({}, SRLOG[SRLOG.length - 1]) : null), speechLog: () => SRLOG.map(x => Object.assign({}, x)),
    speechState: () => (NSP.st ? Object.assign({ off: NSP.off }, NSP.st) : { off: NSP.off, has: nspHas() }), speechRefresh: nspRefresh, srText,
  };
})();
