// 回声岛 · 能力检测（window.EchoPlace / Node 模块）
// 2026-11-19 老板定的方向：游戏给所有人用（大人也用它学）——先做语言能力检测（不只英语，所有语言），测完按能力自动安排内容。
// 这个文件三块：① 自适应引擎（不碰 DOM，Node 里直接 require：tests/place.test.js 的模拟、tools/place/build.js 的检查都用它）；
// ② 检测的界面（选语言 → 谁在学、学过多少 → 四个部分的题 → 结果、调整）；③ 首页卡片、设置里的那一页。
// 题库是 placement-data.js（tools/place/build.js 生成），分级和内容对照表在 levels.js，界面上的字走 i18n.js（中文、英文）。
// 加载时不碰 DOM、不读存档。界面上叫「能力检测」「测评」，不叫考试；结果是为了安排内容做的估计，不承诺任何官方等级。
//
// 【自适应规则】（给人看的版本）
//   四项能力（词汇、听力、语法与阅读、口语）一项一项测，每项记一个 0–6 的估计值 e（第 L 级 = [L, L+1)）。
//   出题：这一项里还没出过、级别离 e 最近的那一道（同样近的随机挑，上次检测做过的往后排）。
//   答完：按「这一级的题他本来有多大把握答对」（p，含蒙对的概率）挪一步：e ← e + 步长 ×（答对 1 / 答错 0 − p）。
//         所以蒙对一道难题挪得多、答对一道容易的题几乎不动。
//   步长：从 1.3 开始；只要出现「来回」（上一步往上、这一步往下，或者反过来）就乘 0.7，最小 0.3——一路都对就大步往上，开始有对有错就细调。
//   停：这一项做够最少题数、步长已经缩到 0.5 以下（来回了三次）就停；最多做到上限。四项加起来 21–26 道。
//   起点：第一项按自己报的（四个选项 → 0.5 / 1.5 / 2.6 / 3.8）；后面几项 = 七成看前面几项测出来的平均，三成看自己报的。
//   没有重复的题；哪一级的题用完了就用最近的另一级。口语测不了（没麦克风 / 没网 / AI 没开通 / 自己跳过）就跳过，结果写「口语未测」。
//   模拟结果（tests/place.test.js，每次跑都重新算）：几千个已知真实水平的假学习者，各项估计在真实级别上下一级以内的超过九成，多数正好。
(function (root) {
  'use strict';
  const inNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const I18N = root.EchoI18n || (inNode ? require('./i18n.js') : null);
  const LV = root.EchoLevels || (inNode ? require('./levels.js') : null);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // =====================================================================================
  // ① 引擎
  // =====================================================================================
  const SKILLS = ['vocab', 'listen', 'read', 'speak'];
  const CFG = { vocab: { min: 6, max: 8 }, listen: { min: 5, max: 6 }, read: { min: 6, max: 7 }, speak: { min: 4, max: 5 } };   // 每项最少 / 最多几道（合计 21–26）
  const NEED = { vocab: 4, listen: 3, read: 4, speak: 3 };   // 题库每一级每一项至少要几道（build.js 按它检查）
  const P = { A: 2.2, K0: 1.3, KMIN: 0.3, SHRINK: 0.7, KSET: 0.5, CARRY: 0.7, EMIN: -0.5, EMAX: 6.2 };
  const START = [0.5, 1.5, 2.6, 3.8];   // 「学过多少」的四个选项 → 从哪儿起测

  // 词汇题的意思用什么给：'own' 学习者界面语言的释义 / 'pic' 图 / 'en' 英文释义 / '' 这门界面语言做不了这道题
  function form(item, ui) {
    if (!item || item.skill !== 'vocab') return 'own';
    const g = item.gloss || {}, w = item.wrong || {}, three = a => Array.isArray(a) && a.length === 3;
    if (g[ui] && three(w[ui])) return 'own';
    if (item.pic && three(item.wrongPic)) return 'pic';
    if (g.en && three(w.en)) return 'en';
    return '';
  }
  const eligible = (item, ui) => !!item && SKILLS.includes(item.skill) && form(item, ui || 'zh') !== '';
  // 蒙对的概率：选择题 = 1 / 选项数，口语 = 0
  const guessOf = item => (item.skill === 'speak' ? 0 : 1 / (item.skill === 'vocab' ? 4 : Math.max(2, (item.opts || []).length || 4)));
  // 估计值是 e 的人答对这道题的把握
  const pRight = (e, item) => { const g = guessOf(item); return g + (1 - g) / (1 + Math.exp(-P.A * (e - item.band))); };
  const settled = (st, s) => st.n >= CFG[s].max || (st.n >= CFG[s].min && st.k <= P.KSET);

  // 开始一次检测。o = { lang 在学的语言, ui 界面语言, know 学过多少（0–3）或者 start 直接给起点, skip: { speak: 原因 } 一开始就测不了的项 }
  // 返回的 run 是普通对象（能直接存进存档，暂停以后接着用）
  function create(o) {
    o = o || {};
    const e0 = typeof o.start === 'number' ? clamp(o.start, 0, 5.9) : START[clamp(o.know | 0, 0, 3)];
    const run = { lang: o.lang || 'en', ui: o.ui || 'zh', e0, si: 0, st: {}, used: [], log: [], cur: '', n: 0 };
    for (const s of SKILLS) run.st[s] = { e: e0, k: P.K0, n: 0, dir: 0, rev: 0, done: false };
    for (const s of Object.keys(o.skip || {})) if (run.st[s] && o.skip[s]) Object.assign(run.st[s], { done: true, skip: String(o.skip[s]) });
    return run;
  }
  function startOf(run, s) {
    const prev = SKILLS.slice(0, SKILLS.indexOf(s)).map(k => run.st[k]).filter(st => st.n > 0 && !st.skip);
    if (!prev.length) return run.e0;
    return P.CARRY * (prev.reduce((a, st) => a + st.e, 0) / prev.length) + (1 - P.CARRY) * run.e0;
  }
  // 下一道题（null = 全部做完）。o = { rnd 随机数（测试用）, seen 以前的检测做过的题 }
  function next(run, items, o) {
    o = o || {};
    const rnd = o.rnd || Math.random, seen = o.seen || [];
    if (run.cur) {   // 暂停回来：还没答的那一道接着出
      const it = items.find(x => x.id === run.cur);
      if (it && !run.st[it.skill].done) return it;
      run.cur = '';
    }
    while (run.si < SKILLS.length) {
      const s = SKILLS[run.si], st = run.st[s];
      if (!st.done && settled(st, s)) st.done = true;
      if (!st.done) {
        if (!st.n && !st.init) { st.init = 1; st.e = startOf(run, s); }
        let best = null, bd = Infinity;
        for (const it of items) {
          if (it.skill !== s || !eligible(it, run.ui) || run.used.includes(it.id)) continue;
          const d = Math.abs(it.band - st.e) + (seen.includes(it.id) ? 0.001 : 0) + rnd() * 0.0005;
          if (d < bd) { bd = d; best = it; }
        }
        if (best) { run.cur = best.id; return best; }
        st.done = true;                       // 这一项的题出完了
        if (!st.n) st.skip = 'none';
      }
      run.si++;
    }
    return null;
  }
  // 答了一道：x = 1 对 / 0 错 / 0.5 半对（看了翻译才答对、朗读差一点、问答题只答到一半）；meta 记进记录（用时、看没看翻译）
  function answer(run, item, x, meta) {
    const st = item && run.st[item.skill];
    if (!st || st.done || run.used.includes(item.id)) return false;
    x = clamp(+x || 0, 0, 1);
    const d = x - pRight(st.e, item), nd = d > 0 ? 1 : -1;
    st.e = +clamp(st.e + st.k * d, P.EMIN, P.EMAX).toFixed(3);
    if (st.dir && nd !== st.dir) { st.rev++; st.k = +Math.max(P.KMIN, st.k * P.SHRINK).toFixed(3); }
    st.dir = nd; st.n++; run.n++;
    run.used.push(item.id); run.cur = '';
    run.log.push(Object.assign({ id: item.id, b: item.band, x }, meta || {}));
    if (settled(st, item.skill)) st.done = true;
    return true;
  }
  // 这一项测不下去了（没麦克风、没网、AI 用不了、自己跳过）：做了不到 3 道的算「未测」，3 道以上就用已经做的
  function skipSkill(run, skill, why) {
    const st = run.st[skill]; if (!st || st.done) return;
    st.done = true;
    if (st.n < 3) st.skip = String(why || 'user');
    run.cur = '';   // 正出着的那一道不用答了
  }
  const finished = run => SKILLS.every(s => run.st[s].done);
  // 大概一共多少道（进度条用）
  const total = run => SKILLS.reduce((a, s) => a + (run.st[s].done ? run.st[s].n : Math.max(run.st[s].n + 1, CFG[s].min + 1)), 0);
  function result(run) {
    const sk = {};
    for (const s of SKILLS) { const st = run.st[s]; sk[s] = st.skip ? { skip: st.skip, n: st.n } : { e: +(+st.e).toFixed(2), lv: LV.levelOf(st.e), n: st.n }; }
    const o = LV.overall(sk);
    return { sk, lv: o.lv, talk: o.talk, capped: o.capped, speak: o.speak, n: run.n };
  }
  const engine = { SKILLS, CFG, NEED, P, START, form, eligible, guessOf, pRight, create, next, answer, skipSkill, finished, total, result };

  // =====================================================================================
  // 界面上的字（中文、英文）
  // =====================================================================================
  const STR = {
    zh: {
      'place.next': '下一步', 'place.back': '上一步', 'place.later': '以后再测', 'place.start': '开始', 'place.done': '完成', 'place.close': '关闭',
      'place.lang.title': '选择语言', 'place.lang.ui': '界面语言', 'place.lang.learn': '我想学', 'place.lang.soon': '更多语言正在准备，以后会加进来',
      'place.lang.partial': '',
      'place.who.title': '先认识一下', 'place.who.q': '谁在学？',
      'place.who.child': '孩子', 'place.who.child.s': '12 岁以下', 'place.who.teen': '青少年', 'place.who.teen.s': '13–17 岁', 'place.who.adult': '成人', 'place.who.adult.s': '18 岁以上',
      'place.know.q': '{lang}学过多少？',
      'place.know.0': '刚开始，几乎没学过', 'place.know.1': '学过一点：认识一些单词，会几句简单的话',
      'place.know.2': '能进行简单的日常对话，读懂简单的短文', 'place.know.3': '能比较自如地读文章、聊天',
      'place.who.privacy': '🔒 只记下年龄段和这个选择，用来决定从哪儿开始测。不问生日，也不收集别的个人信息。',
      'place.who.pin': '改成「自己学」（没有学习锁、不限时）',
      'place.ready.title': '能力检测', 'place.ready.lead': '大约 {n} 道题、{m} 分钟左右，分四个部分：',
      'place.ready.off': '这次测不了，会跳过：{why}',
      'place.ready.n1': '题目会跟着你的回答变难或者变容易，所以遇到不会的很正常。',
      'place.ready.n2': '不会就点「不知道」，别乱猜——蒙对了反而会把内容排得太难。',
      'place.ready.n3': '可以随时暂停，下次接着做。',
      'place.ready.n4': '这不是考试，没有分数和名次，只用来给你安排合适的内容。',
      'place.ready.mic': '🎤 口语部分要用麦克风，并且要联网。',
      'place.tmp': '⚠️ 现在用的是临时题库（开发用）',
      'place.why.mic': '用不了麦克风', 'place.why.net': '现在没网', 'place.why.ai': 'AI 还没开通，或者暂时用不了', 'place.why.self': '现在是「不用说话」模式',
      'place.why.user': '这次自己选了跳过', 'place.why.none': '题库里没有合适的题',
      'place.q.part': '{i}/4 · {name}', 'place.q.pause': '暂停', 'place.q.idk': '🤔 不知道', 'place.q.gloss': '译', 'place.q.say': '播放',
      'place.v.listen': '听一听，选出它的意思', 'place.v.read': '选出这个词的意思', 'place.v.pic.listen': '听一听，选出对应的图', 'place.v.pic.read': '选出对应的图',
      'place.l.title': '听一听，回答问题', 'place.l.first': '点喇叭开始听', 'place.l.left': { zero: '不能再听了', other: '还能再听 {n} 次' },
      'place.r.gap': '选出最合适的一项', 'place.r.passage': '读一读，回答问题',
      'place.s.read': '大声读出这句话', 'place.s.answer': '用{lang}回答这个问题（说两三句）',
      'place.s.mic': '点话筒开始说，说完会自动停', 'place.s.on': '🎤 请说……（说完再点一下话筒也行）', 'place.s.judging': '正在听你说了什么……',
      'place.s.again': '没听清，靠近一点再说一次', 'place.s.retry': '刚才没连上，再点一次话筒试试', 'place.s.heard': '听到：{t}',
      'place.s.skip': '现在不方便说话？跳过口语部分', 'place.s.off': '{why}：口语部分先跳过了，结果里会写「口语未测」',
      'place.pause.title': '已暂停', 'place.pause.p': '做到第 {n} 题了，进度已经存好。', 'place.pause.go': '继续', 'place.pause.exit': '先退出，下次接着做',
      'place.resume.title': '接着做能力检测？', 'place.resume.p': '上次做到第 {n} 题，进度还留着。', 'place.resume.go': '接着做', 'place.resume.new': '重新开始',
      'place.res.title': '检测完成！', 'place.res.your': '你现在的级别', 'place.res.skills': '各项能力',
      'place.res.note': 'ℹ️ 这是为了安排内容做的估计，不是考试成绩，也不是证书。',
      'place.res.unchecked': '未测',
      'place.res.nospeak': '口语未测（{why}）。综合级别按另外三项定；能用麦克风和 AI 的时候可以重新检测。',
      'place.res.plan': '接下来这样安排',
      'place.plan.unit': '📗 课程从 <b>{unit}</b> 开始。',
      'place.plan.free': { zero: '', other: '前面的 {n} 个单元标成「已免修」，想练随时能练。' },
      'place.plan.below': '🌱 现在还没有专门的入门课程：先从最容易的单元学起，多给提示。',
      'place.plan.beyond': '🚧 你的级别比现有的课程高：高级课程单元正在制作。现在先用最难的单元出题，主要靠和岛民的 AI 对话来练。',
      'place.plan.locked': '🔒 这台设备只开放了一部分课程，先从开放的里面最合适的单元开始。',
      'place.plan.kinds.low': '⚔️ 冒险里的题：一部分要开口的招式换成「听一听、点出来」，句子多练几次才撤掉提示。',
      'place.plan.kinds.mid': '⚔️ 冒险里的题：多数出自正在学的单元，练熟了的句子会让你凭记忆说。',
      'place.plan.kinds.high': '⚔️ 冒险里的题：都出自课程单元，学过的句子很快就要凭记忆说。',
      'place.plan.chat': '🗣️ 岛民按「{name}」的难度和你聊：{how}',
      'place.chat.0': '说得很慢，只用单词和很短的句子；实在不懂时用中文提示一句。',
      'place.chat.1': '说得慢，句子短而简单；连着卡住两次会用中文提示一句。',
      'place.chat.2': '说得慢而清楚，用常见的词，会请你把话说成完整的句子。',
      'place.chat.3': '语速自然、不急，会追问「为什么」，让你连着说两三句。',
      'place.chat.4': '正常语速，不简化语法，会要你讲理由、举例子。',
      'place.chat.5': '和对说得很流利的人说话一样，会要你论证观点、把话说准。',
      'place.plan.cap': 'ℹ️ 综合级别没有按最强的一项定：这里的内容要听、要说，所以不会比听力和口语里低的那一项高出一级以上。',
      'place.plan.book': '📗 现在是「按课本」走：课程照课本的顺序，和做检测以前一样。想按能力安排，在下面换成「按能力」。',
      'place.adj.q': '觉得不合适？可以自己调：', 'place.adj.down': '调低一级', 'place.adj.up': '调高一级', 'place.adj.from': '检测结果是「{name}」',
      'place.res.go': '就这样，开始！',
      'place.card.title': '🧭 测一测{lang}水平', 'place.card.sub': '约 6 分钟 · 测完按能力安排内容', 'place.card.go': '开始', 'place.card.no': '不用了',
      'place.card.resume': '🧭 能力检测做到一半（第 {n} 题）', 'place.card.resume.sub': '进度存着，接着做就行', 'place.card.resume.go': '继续',
      'place.card.hid': '好的。以后想测，在「设置 → 能力检测和分级」里。',
      'place.set.row': '🧭 能力检测和分级', 'place.set.none': '还没做过', 'place.set.open': '看看', 'place.set.start': '开始检测',
      'place.set.note': '测一次约 6 分钟，按能力安排课程单元、出题方式和岛民说话的难度。随时可以重新检测、自己调级别。',
      'place.sheet.title': '🧭 能力检测和分级',
      'place.sheet.none': '还没做过能力检测。做一次大约 6 分钟：测完会按你的能力安排课程单元、出题的方式和岛民说话的难度。',
      'place.sheet.lv': '现在的级别', 'place.sheet.track': '课程怎么排', 'place.track.level': '🧭 按能力', 'place.track.book': '📗 按课本',
      'place.sheet.retest': '重新检测', 'place.sheet.hist': '检测记录', 'place.hist.adj': '自己调过',
      'place.set.ui': '界面语言 · Language',
      'place.set.learner': '谁在学', 'place.learner.kid': '👦 孩子', 'place.learner.open': '🧑 自己学（青少年 / 成人）',
      'place.learner.kid.note': '孩子：每天先学习再冒险、冒险限时，下面的家长设置要家长密码。',
      'place.learner.open.note': '自己学：没有学习锁、不限时，设置不用家长密码。别的都一样。',
      'place.learner.to.open': '已改成「自己学」：没有学习锁，也不限时', 'place.learner.to.kid': '已改成「孩子」：学习锁和冒险时间回来了',
      'place.set.more': '⚙️ 更多设置',
      'place.unit.free': '已免修',
      'place.unit.free.tip': '按能力检测的结果，这个单元已免修（想练照样能练）',
      // 对战（monsters.js）：按能力换成「听一听、点出来」的回合
      'place.b.listen.word': '👂 听一听，点出你听到的词，发动 <b>{mv}</b>',
      'place.b.listen.sent': '👂 听一听，点出你听到的咒语，发动 <b>{mv}</b>',
      'place.b.listen.foot': '听准了再点，点对了照常出招',
    },
    en: {
      'place.next': 'Next', 'place.back': 'Back', 'place.later': 'Maybe later', 'place.start': 'Start', 'place.done': 'Done', 'place.close': 'Close',
      'place.lang.title': 'Choose your language', 'place.lang.ui': 'Interface language', 'place.lang.learn': 'I want to learn', 'place.lang.soon': 'More languages are on the way',
      'place.lang.partial': '',
      'place.who.title': 'First, a little about you', 'place.who.q': 'Who is learning?',
      'place.who.child': 'A child', 'place.who.child.s': 'under 13', 'place.who.teen': 'A teenager', 'place.who.teen.s': '13 to 17', 'place.who.adult': 'An adult', 'place.who.adult.s': '18 or over',
      'place.know.q': 'How much {lang} do you know?',
      'place.know.0': 'I am just starting', 'place.know.1': 'A little: some words and a few simple sentences',
      'place.know.2': 'I can have simple everyday conversations and read simple texts', 'place.know.3': 'I can read and chat fairly comfortably',
      'place.who.privacy': '🔒 We only keep the age group and this choice, to decide where the check starts. No birthday, no other personal details.',
      'place.who.pin': 'Switch to independent learner (no study gate, no time limits)',
      'place.ready.title': 'Level check', 'place.ready.lead': 'About {n} questions, around {m} minutes, in four parts:',
      'place.ready.off': 'cannot be checked this time and will be skipped: {why}',
      'place.ready.n1': 'Questions get harder or easier as you answer, so it is normal to meet some you cannot do.',
      'place.ready.n2': 'If you do not know, tap "I don\'t know" instead of guessing. Lucky guesses make your content too hard.',
      'place.ready.n3': 'You can pause at any time and carry on later.',
      'place.ready.n4': 'This is not an exam: no marks, no ranking. It is only used to arrange the right content for you.',
      'place.ready.mic': '🎤 The speaking part needs the microphone and an internet connection.',
      'place.tmp': '⚠️ Temporary item bank (development only)',
      'place.why.mic': 'the microphone cannot be used', 'place.why.net': 'there is no internet connection', 'place.why.ai': 'the AI service is not set up or not available', 'place.why.self': 'the app is in no-speaking mode',
      'place.why.user': 'you chose to skip it', 'place.why.none': 'there are no suitable questions',
      'place.q.part': '{i}/4 · {name}', 'place.q.pause': 'Pause', 'place.q.idk': '🤔 I don\'t know', 'place.q.gloss': 'Hint', 'place.q.say': 'Play',
      'place.v.listen': 'Listen and choose the meaning', 'place.v.read': 'Choose the meaning of this word', 'place.v.pic.listen': 'Listen and choose the picture', 'place.v.pic.read': 'Choose the matching picture',
      'place.l.title': 'Listen and answer the question', 'place.l.first': 'Tap the speaker to listen', 'place.l.left': { zero: 'No more replays', one: '{n} replay left', other: '{n} replays left' },
      'place.r.gap': 'Choose the best option', 'place.r.passage': 'Read and answer the question',
      'place.s.read': 'Read this sentence aloud', 'place.s.answer': 'Answer this question in {lang} (two or three sentences)',
      'place.s.mic': 'Tap the microphone and speak. It stops by itself', 'place.s.on': '🎤 Speak now… (tap the microphone again when you finish)', 'place.s.judging': 'Working out what you said…',
      'place.s.again': 'I did not catch that. Move closer and try once more', 'place.s.retry': 'That did not go through. Tap the microphone and try again', 'place.s.heard': 'Heard: {t}',
      'place.s.skip': 'Can\'t speak right now? Skip the speaking part', 'place.s.off': 'Speaking was skipped because {why}. The result will say "not checked"',
      'place.pause.title': 'Paused', 'place.pause.p': 'You are on question {n}. Your progress is saved.', 'place.pause.go': 'Continue', 'place.pause.exit': 'Leave for now',
      'place.resume.title': 'Carry on with the level check?', 'place.resume.p': 'Last time you reached question {n}. Your progress is still here.', 'place.resume.go': 'Carry on', 'place.resume.new': 'Start again',
      'place.res.title': 'All done!', 'place.res.your': 'Your level now', 'place.res.skills': 'By skill',
      'place.res.note': 'ℹ️ This is an estimate used to arrange your content. It is not an exam score or a certificate.',
      'place.res.unchecked': 'not checked',
      'place.res.nospeak': 'Speaking was not checked ({why}). Your level comes from the other three skills. You can redo the check when the microphone and the AI are available.',
      'place.res.plan': 'What happens next',
      'place.plan.unit': '📗 Your course starts at <b>{unit}</b>.',
      'place.plan.free': { zero: '', one: 'The {n} unit before it is marked "skipped". You can still play it any time.', other: 'The {n} units before it are marked "skipped". You can still play them any time.' },
      'place.plan.below': '🌱 There is no separate starter course yet: you begin with the easiest units, with extra hints.',
      'place.plan.beyond': '🚧 Your level is above the course units we have: advanced units are being made. For now questions come from the hardest units, and most of your practice is AI conversation with the islanders.',
      'place.plan.locked': '🔒 Only part of the course is open on this device, so you start at the best-fitting open unit.',
      'place.plan.kinds.low': '⚔️ In adventures: some speaking moves become listen-and-choose, and hints stay longer.',
      'place.plan.kinds.mid': '⚔️ In adventures: most questions come from your current unit, and sentences you know well are said from memory.',
      'place.plan.kinds.high': '⚔️ In adventures: all questions come from course units, and you say sentences from memory sooner.',
      'place.plan.chat': '🗣️ Islanders talk with you at "{name}" level: {how}',
      'place.chat.0': 'very slowly, with single words and very short sentences.',
      'place.chat.1': 'slowly, in short simple sentences.',
      'place.chat.2': 'slowly and clearly with common words, and they ask you for full sentences.',
      'place.chat.3': 'at a calm natural pace, with follow-up questions so that you say two or three sentences.',
      'place.chat.4': 'at natural speed without simplifying, asking for reasons and examples.',
      'place.chat.5': 'as they would with a fluent speaker, asking you to argue a point and be precise.',
      'place.plan.cap': 'ℹ️ Your overall level is not set by your strongest skill: content here is heard and spoken, so it never runs more than one level ahead of the weaker of listening and speaking.',
      'place.plan.book': '📗 You are on "By textbook": the course follows the textbook order, exactly as before the check. To have it arranged by level, switch to "By level" below.',
      'place.adj.q': 'Not quite right? Adjust it yourself:', 'place.adj.down': 'One level down', 'place.adj.up': 'One level up', 'place.adj.from': 'The check said "{name}"',
      'place.res.go': 'Looks good. Start!',
      'place.card.title': '🧭 Check your {lang} level', 'place.card.sub': 'About 6 minutes · then content is arranged to fit you', 'place.card.go': 'Start', 'place.card.no': 'No thanks',
      'place.card.resume': '🧭 Level check in progress (question {n})', 'place.card.resume.sub': 'Your progress is saved. Just carry on', 'place.card.resume.go': 'Continue',
      'place.card.hid': 'OK. You can find it later in Settings → Level check.',
      'place.set.row': '🧭 Level check', 'place.set.none': 'Not done yet', 'place.set.open': 'Open', 'place.set.start': 'Start the check',
      'place.set.note': 'One check takes about 6 minutes. It arranges course units, question types and how the islanders talk. You can redo it or adjust the level any time.',
      'place.sheet.title': '🧭 Level check',
      'place.sheet.none': 'You have not done the level check yet. It takes about 6 minutes, then course units, question types and the way islanders talk are arranged to fit you.',
      'place.sheet.lv': 'Current level', 'place.sheet.track': 'How the course is arranged', 'place.track.level': '🧭 By level', 'place.track.book': '📗 By textbook',
      'place.sheet.retest': 'Check again', 'place.sheet.hist': 'History', 'place.hist.adj': 'adjusted by hand',
      'place.set.ui': 'Language · 界面语言',
      'place.set.learner': 'Who is learning', 'place.learner.kid': '👦 A child', 'place.learner.open': '🧑 Independent learner (teen / adult)',
      'place.learner.kid.note': 'Child: study before adventure each day, adventure time limits, and the parent settings below need the parent PIN.',
      'place.learner.open.note': 'Independent learner: no study gate, no time limits, and settings need no parent PIN. Everything else is the same.',
      'place.learner.to.open': 'Switched to independent learner: no study gate, no time limits', 'place.learner.to.kid': 'Switched to child: the study gate and adventure time are back',
      'place.set.more': '⚙️ More settings',
      'place.unit.free': 'Skipped',
      'place.unit.free.tip': 'Skipped because of your level check (you can still play it)',
      'place.b.listen.word': '👂 Listen and tap the word you hear to use <b>{mv}</b>',
      'place.b.listen.sent': '👂 Listen and tap the spell you hear to use <b>{mv}</b>',
      'place.b.listen.foot': 'Listen carefully, then tap. A right answer makes the move',
    },
  };
  if (I18N) I18N.add(STR);
  const t = (k, p, l) => (I18N ? I18N.t(k, p, l) : k);
  const h = (k, p, l) => (I18N ? I18N.h(k, p, l) : k);

  // =====================================================================================
  // ② 界面
  // =====================================================================================
  // 每门在学的语言自己的小钩子：朗读、听写、朗读题打分都从这里走，引擎和界面里没有只对英语成立的逻辑。
  // 加一门语言：题库（tools/place/<语言>/）+ 这里一项 + levels.js 的内容对照表 + i18n 里它的名字（lv.lang.<语言>）
  const TARGETS = {
    en: {
      say: (G, text, rate, g) => G.say(text, rate, g),
      listen: (G, onInterim, targets, o) => G.recognize(onInterim, targets, o),
      score: (G, target, alts) => G.bestScore(target, alts),
    },
  };
  let G = null;            // game.js 给的工具
  let U = null;            // 现在这次打开的界面状态
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const data = lang => (root.PLACE_DATA && root.PLACE_DATA[lang]) || null;
  const itemsOf = lang => (data(lang) ? data(lang).items : []);
  const ui = () => (I18N ? I18N.lang() : 'zh');
  const langName = l => t('lv.lang.' + l);

  // 存档里的检测记录（默认值在 game.js 的 fresh()）
  function st() {
    const S = G.S;
    if (!S.place || typeof S.place !== 'object') S.place = {};
    const D = { lang: 'en', who: '', know: -1, lv: -1, auto: -1, adj: 0, talk: -1, cap: 0, at: '', from: -1, skip: '', card: '' };
    for (const k of Object.keys(D)) if (S.place[k] == null) S.place[k] = D[k];
    if (!S.place.sk || typeof S.place.sk !== 'object') S.place.sk = {};
    if (!Array.isArray(S.place.hist)) S.place.hist = [];
    if (!Array.isArray(S.place.seen)) S.place.seen = [];
    if (S.place.run === undefined) S.place.run = null;
    return S.place;
  }
  const placed = () => !!G && st().lv >= 0;
  const onLevel = () => placed() && G.S.settings.track === 'level';
  // 现在按第几级安排内容（没做过检测、或者选了「按课本」= null，一切照旧）
  const level = () => (onLevel() ? st().lv : null);
  // 和岛民聊天用第几级
  const chatLevel = () => (onLevel() ? clamp(st().talk + st().adj, 0, LV.TOP) : null);
  // 存档里有没有进度（有进度的老存档不会被拉进检测，只在首页给一张卡片）
  function hasProgress() {
    const S = G.S;
    return !!((S.mon && (S.mon.box || []).length) || Object.keys(S.stars || {}).length || S.xp > 0 || (S.world && S.world.started));
  }
  // 是不是全新的开始：没看过开场说明、没有任何进度、没做过检测、也没说过「以后再测」
  const isNew = () => !!G && !G.S.seenIntro && !hasProgress() && !placed() && !st().skip;

  // ---------- 画面的壳 ----------
  function mount() {
    let el = $('#place');
    if (!el) {
      el = document.createElement('div');
      el.id = 'place'; el.className = 'pl'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="pl-box" id="pl-box"></div>';
      document.body.appendChild(el);
      document.body.classList.add('pl-on');
    }
    return $('#pl-box');
  }
  function unmount() {
    stopAll();
    const el = $('#place'); if (el) el.remove();
    document.body.classList.remove('pl-on');
  }
  const isOpen = () => !!$('#place');
  function stopAll() {
    if (U) U.tok = (U.tok || 0) + 1;
    try { if (G && G.stopSay) G.stopSay(); } catch (e) { /* 忽略 */ }
    try { if (G && U && U.listening) G.stopListening(); } catch (e) { /* 忽略 */ }
  }
  function paint(html, step) {
    const box = mount();
    box.innerHTML = html; box.dataset.step = step || ''; box.scrollTop = 0;
    if (U) U.step = step || '';
  }
  const tmpBar = () => (data(st().lang) && data(st().lang).tmp ? '<p class="pl-tmp">' + h('place.tmp') + '</p>' : '');

  // ---------- 打开 ----------
  // first(done)：全新的开始（game.js 启动时）——选语言 → 谁在学 → 检测 → 结果，最后调 done()；
  // open(step, done)：首页卡片 / 设置里点进来（老存档）——从「谁在学」开始，不问界面语言
  function first(done) { begin('lang', done, true); }
  function open(step, done) { begin(step || 'who', done, false); }
  function begin(step, done, isFirst) {
    if (!G) return;
    U = { done: done || null, first: !!isFirst, tok: 0 };
    const P0 = st();
    if (P0.run) { pResume(); return; }   // 上次做到一半：先问接着做还是重新开始
    ({ lang: pLang, who: pWho, ready: pReady })[step === 'lang' || step === 'who' || step === 'ready' ? step : 'who']();
  }
  function finishFlow(how) {
    const d = U && U.done;
    unmount(); U = null;
    if (G.afterPlace) G.afterPlace(how);
    if (d) d(how);
  }

  // ---------- 选语言（只在全新开始时出现；以后在设置里改） ----------
  function pLang() {
    const cur = ui(), both = k => esc(t(k, null, 'zh')) + ' · ' + esc(t(k, null, 'en'));
    paint('<div class="pl-step">' +
      '<div class="pl-hero">🌍</div><h2>' + both('place.lang.title') + '</h2>' +
      '<p class="pl-lbl">' + both('place.lang.ui') + '</p>' +
      '<div class="pl-choices two">' + I18N.LANGS.map(l => '<button class="pl-choice' + (l.id === cur ? ' on' : '') + '" data-act="plUi" data-l="' + l.id + '"><b>' + esc(l.name) + '</b></button>').join('') + '</div>' +
      '<p class="pl-lbl">' + both('place.lang.learn') + '</p>' +
      '<div class="pl-choices two">' + Object.keys(TARGETS).map(l => '<button class="pl-choice' + (l === st().lang ? ' on' : '') + '" data-act="plTarget" data-l="' + l + '"><b>' + esc(t('lv.lang.' + l, null, 'en')) + '</b><small>' + esc(t('lv.lang.' + l, null, 'zh')) + '</small></button>').join('') + '</div>' +
      '<p class="tip">' + both('place.lang.soon') + '</p>' +
      (t('place.lang.partial') ? '<p class="pl-note">' + h('place.lang.partial') + '</p>' : '') +
      '</div><div class="pl-nav"><span></span><button class="btn" data-act="plGo" data-to="who" data-focus>' + h('place.next') + '</button></div>', 'lang');
  }

  // ---------- 谁在学、学过多少（只用来定从哪儿开始测；只存年龄段） ----------
  const WHO = [['child', '🧒'], ['teen', '🧑‍🎓'], ['adult', '🧑']];
  function pWho() {
    const P0 = st(), w = U.who != null ? U.who : P0.who, k = U.know != null ? U.know : P0.know;
    paint('<div class="pl-step">' +
      '<h2>' + h('place.who.title') + '</h2>' +
      '<p class="pl-lbl">' + h('place.who.q') + '</p>' +
      '<div class="pl-choices three">' + WHO.map(([id, em]) => '<button class="pl-choice' + (w === id ? ' on' : '') + '" data-act="plWho" data-v="' + id + '"><i>' + em + '</i><b>' + h('place.who.' + id) + '</b><small>' + h('place.who.' + id + '.s') + '</small></button>').join('') + '</div>' +
      '<p class="pl-lbl">' + h('place.know.q', { lang: langName(P0.lang) }) + '</p>' +
      '<div class="pl-choices one">' + [0, 1, 2, 3].map(i => '<button class="pl-choice row' + (k === i ? ' on' : '') + '" data-act="plKnow" data-v="' + i + '"><i>' + '🌱📗📘📙'.match(/./gu)[i] + '</i><b>' + h('place.know.' + i) + '</b></button>').join('') + '</div>' +
      '<p class="pl-note">' + h('place.who.privacy') + '</p>' +
      '</div><div class="pl-nav">' + (U.first ? '<button class="btn ghost" data-act="plGo" data-to="lang">' + h('place.back') + '</button>' : '<button class="btn ghost" data-act="plLater">' + h('place.later') + '</button>') +
      '<button class="btn" data-act="plWhoNext" id="pl-next"' + (w && k >= 0 ? '' : ' disabled') + '>' + h('place.next') + '</button></div>', 'who');
  }
  function whoNext() {
    const P0 = st();
    if (!U.who && P0.who) U.who = P0.who;
    if (U.know == null && P0.know >= 0) U.know = P0.know;
    if (!U.who || U.know == null || U.know < 0) return;
    P0.who = U.who; P0.know = U.know; G.save();
    // 谁在学 → 孩子 / 自己学（game.js 管：老存档不在这里换；有家长密码的地方换成「自己学」要输密码）
    const go = () => { if (U) pReady(); };
    if (U.first && G.learnerPick) G.learnerPick(U.who, go); else go();
  }

  // ---------- 开始之前 ----------
  // 口语现在测不测得了：'' = 可以；'self' 不用说话模式（测试链接）、'ai' 没有 AI 识别（没密钥 / 没连上）、'net' 没网
  function speakWhy() {
    try {
      if (G.speakMode() !== 'sr') return 'self';
      if (!(root.EchoTalk && EchoTalk.cloudSR && EchoTalk.cloudSR())) return 'ai';
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'net';
    } catch (e) { return 'ai'; }
    return '';
  }
  function pReady() {
    const why = speakWhy(), part = (s, em) => '<li><i>' + em + '</i><b>' + esc(LV.skill(s)) + '</b>' + (s === 'speak' && why ? '<small>' + h('place.ready.off', { why: t('place.why.' + why) }) + '</small>' : '') + '</li>';
    paint('<div class="pl-step">' + tmpBar() +
      '<div class="pl-hero">🧭</div><h2>' + h('place.ready.title') + '</h2>' +
      '<p>' + h('place.ready.lead', { n: 24, m: 6 }) + '</p>' +
      '<ol class="pl-parts">' + part('vocab', '🔤') + part('listen', '🎧') + part('read', '📖') + part('speak', '🎤') + '</ol>' +
      '<ul class="pl-notes"><li>' + h('place.ready.n1') + '</li><li>' + h('place.ready.n2') + '</li><li>' + h('place.ready.n3') + '</li><li>' + h('place.ready.n4') + '</li></ul>' +
      (why ? '' : '<p class="pl-note">' + h('place.ready.mic') + '</p>') +
      '</div><div class="pl-nav"><button class="btn ghost" data-act="plLater">' + h('place.later') + '</button><button class="btn sun" data-act="plStart" data-focus>' + h('place.start') + '</button></div>', 'ready');
  }
  function startRun() {
    const P0 = st(), why = speakWhy();
    P0.run = engine.create({ lang: P0.lang, ui: ui(), know: P0.know >= 0 ? P0.know : 1, skip: why ? { speak: why } : null });
    P0.skip = '';
    G.save();
    try { G.primeTTS(); G.ac(); } catch (e) { /* 忽略 */ }
    nextItem();
  }

  // ---------- 接着做 ----------
  function pResume() {
    const P0 = st(), n = (P0.run.n || 0) + 1;
    paint('<div class="pl-step center"><div class="pl-hero">🧭</div><h2>' + h('place.resume.title') + '</h2><p>' + h('place.resume.p', { n }) + '</p></div>' +
      '<div class="pl-nav col"><button class="btn sun" data-act="plResume" data-focus>' + h('place.resume.go') + '</button>' +
      '<button class="btn ghost" data-act="plRestart">' + h('place.resume.new') + '</button><button class="link" data-act="plLater">' + h('place.later') + '</button></div>', 'resume');
  }

  // ---------- 出题 ----------
  function nextItem() {
    const P0 = st(), run = P0.run; if (!run) return;
    stopAll();
    const prev = U.item ? U.item.skill : '';
    let it = engine.next(run, itemsOf(run.lang), { seen: P0.seen });
    // 轮到口语了才发现现在测不了（暂停以后换了地方、断了网、换成了不用说话模式）：跳过，写明原因
    if (it && it.skill === 'speak') { const why = speakWhy(); if (why) { engine.skipSkill(run, 'speak', why); it = engine.next(run, itemsOf(run.lang), { seen: P0.seen }); } }
    G.save();
    if (!it) { finishRun(); return; }
    U.item = it; U.hint = 0; U.plays = 0; U.t0 = Date.now(); U.locked = false; U.unheard = 0; U.listening = false; U.busy = false;
    U.newPart = !!prev && prev !== it.skill;   // 换到下一个部分：顶上的「2/4 · 听力」跳一下（不弹提示条，会挡住题目）
    pItem();
  }
  const SK_ICON = { vocab: '🔤', listen: '🎧', read: '📖', speak: '🎤' };
  // 题目下面的那句翻译：0–1 级直接给；2 级起收成「译」（点了算看了提示，这题只算半对）。界面语言就是在学的语言时没有
  function glossHTML(it, run) {
    const g = it.qGloss && run.ui !== run.lang ? it.qGloss[run.ui] : '';
    if (!g) return '';
    return it.band <= 1 || U.hint ? '<small class="pl-gloss">' + esc(g) + '</small>' : '<button class="pl-zh" data-act="plGloss">' + h('place.q.gloss') + '</button>';
  }
  function optsHTML(list, cls) {
    return '<div class="opts ' + (cls || '') + '" id="pl-opts">' + list.map((o, k) => '<button class="opt' + (o.en ? ' en' : '') + '" data-act="plPick" data-i="' + k + '">' +
      (o.e ? '<span class="o-e">' + esc(o.e) + '</span>' : '') + (o.t ? '<span class="o-t">' + esc(o.t) + '</span>' : '') + (o.g ? '<small class="o-g">' + esc(o.g) + '</small>' : '') + '</button>').join('') + '</div>';
  }
  function pItem() {
    const P0 = st(), run = P0.run, it = U.item, L = langName(run.lang);
    const done = run.n, tot = Math.max(done + 1, engine.total(run));
    let body = '', foot = '<button class="link pl-idk" data-act="plIdk">' + h('place.q.idk') + '</button>';
    const spk = '<button class="spk" data-act="plSay" aria-label="' + h('place.q.say') + '">' + G.SPK + '</button>';
    if (it.skill === 'vocab') {
      const f = engine.form(it, run.ui);
      const right = f === 'pic' ? { e: it.pic, c: 1 } : { t: (f === 'en' ? it.gloss.en : it.gloss[run.ui]), c: 1 };
      const wrong = f === 'pic' ? it.wrongPic.map(e => ({ e })) : (f === 'en' ? it.wrong.en : it.wrong[run.ui]).map(x => ({ t: x }));
      U.opts = shuffle([right].concat(wrong));
      body = '<h2 class="q-title">' + h('place.v.' + (f === 'pic' ? 'pic.' : '') + it.mode) + '</h2>' +
        (it.mode === 'listen' ? '<div class="q-audio">' + spk + '</div>' : '<div class="pl-word">' + esc(it.word) + '</div>') +
        optsHTML(U.opts, f === 'en' ? 'list' : f === 'pic' ? 'pics' : '');
    } else if (it.skill === 'listen' || it.skill === 'read') {
      // 0–1 级：选项有图就带图，有学习者界面语言的译文也带上（还读不了外语的人看得懂选项）；2 级起只有外语
      const pics = it.band <= 1 && Array.isArray(it.optsPic), og = it.band <= 1 && it.optsGloss && run.ui !== run.lang ? it.optsGloss[run.ui] : null;
      U.opts = shuffle(it.opts.map((x, k) => ({ t: x, e: pics ? it.optsPic[k] : '', g: og ? og[k] : '', c: k === it.answer ? 1 : 0, en: 1 })));
      const q = it.q ? '<div class="pl-q"><b>' + esc(it.q) + '</b>' + glossHTML(it, run) + '</div>' : '';
      if (it.skill === 'listen') {
        body = '<h2 class="q-title">' + h('place.l.title') + '</h2><div class="q-audio">' + spk + '<span class="pl-left" id="pl-left">' + h('place.l.first') + '</span></div>' + q + optsHTML(U.opts, pics ? 'pics' : 'list');
      } else if (it.passage) {
        body = '<h2 class="q-title">' + h('place.r.passage') + '</h2><div class="pl-passage">' + esc(it.passage) + '</div>' + q + optsHTML(U.opts, 'list');
      } else {
        body = '<h2 class="q-title">' + h('place.r.gap') + '</h2><div class="pl-text">' + esc(it.text).replace(/_{2,}/g, '<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>') + '</div>' + optsHTML(U.opts, 'list');
      }
    } else {
      const read = it.kind === 'read';
      body = '<h2 class="q-title">' + (read ? h('place.s.read') : h('place.s.answer', { lang: L })) + '</h2>' +
        (read ? '<div class="say-text pl-say">' + esc(it.text) + '</div>' : '<div class="pl-q"><b>' + esc(it.q) + '</b>' + glossHTML(it, run) + '</div>') +
        '<div class="mic-wrap"><button class="mic" id="pl-mic" data-act="plMic" aria-label="🎤">' + G.MIC + '</button><div class="mic-hint" id="pl-hint">' + h('place.s.mic') + '</div><div class="heard" id="pl-heard"></div></div>';
      foot = '<button class="link pl-idk" data-act="plIdk">' + h('place.q.idk') + '</button><button class="link" data-act="plSpeakSkip">' + h('place.s.skip') + '</button>';
    }
    paint('<div class="pl-top"><button class="pl-pause" data-act="plPause" aria-label="' + h('place.q.pause') + '">⏸</button>' +
      '<div class="pbar"><i style="width:' + Math.min(97, Math.round(done / tot * 100)) + '%"></i></div>' +
      '<span class="pl-part' + (U.newPart ? ' new' : '') + '" aria-live="polite">' + SK_ICON[it.skill] + ' ' + h('place.q.part', { i: SKILLS.indexOf(it.skill) + 1, name: LV.skill(it.skill) }) + '</span></div>' +
      '<div class="pl-step q" data-skill="' + it.skill + '" data-id="' + esc(it.id) + '">' + tmpBar() + body + '</div><div class="pl-foot">' + foot + '</div>', 'q');
    // 听词、听力：自动放一遍
    if ((it.skill === 'vocab' && it.mode === 'listen') || it.skill === 'listen') setTimeout(() => { if (U && U.item === it && U.step === 'q') playItem(); }, 350);
  }
  // 放这道题的声音：词汇题放单词（随便听几遍）；听力题按顺序放每一句，一共能听 2 遍
  const LISTEN_PLAYS = 2;
  async function playItem() {
    const it = U && U.item; if (!it || U.step !== 'q' || U.playing) return;
    const T = TARGETS[st().run.lang] || TARGETS.en, tok = U.tok;
    if (it.skill === 'listen') {
      if (U.plays >= LISTEN_PLAYS) return;
      U.plays++; U.playing = true;
      const left = $('#pl-left'); if (left) left.textContent = t('place.l.left', { n: LISTEN_PLAYS - U.plays });
      const b = $('#place .spk'); if (b) b.classList.add('playing');
      for (const a of it.audio) { if (!U || U.tok !== tok) break; await T.say(G, a.text, undefined, a.g); if (U && U.tok === tok && it.audio.length > 1) await new Promise(r => setTimeout(r, 250)); }
      if (U && U.tok === tok) { U.playing = false; const b2 = $('#place .spk'); if (b2) { b2.classList.remove('playing'); if (U.plays >= LISTEN_PLAYS) b2.disabled = true; } }
      else if (U) U.playing = false;
    } else if (it.skill === 'vocab') {
      U.playing = true;
      await T.say(G, it.word, undefined, 'f');
      if (U) U.playing = false;
    }
  }
  function mark(x, meta) {
    const P0 = st(), run = P0.run, it = U.item; if (!run || !it || U.locked) return;
    U.locked = true;
    stopAll();
    engine.answer(run, it, x, Object.assign({ ms: Date.now() - U.t0 }, U.hint ? { hint: 1 } : null, meta || null));
    G.save();
    setTimeout(() => { if (U && U.step === 'q') nextItem(); }, 320);
  }
  function pick(i) {
    if (!U || U.locked || !U.opts) return;
    const o = U.opts[i]; if (!o) return;
    document.querySelectorAll('#pl-opts .opt').forEach((b, k) => { b.disabled = true; if (k === i) b.classList.add('picked'); else b.classList.add('dim'); });
    mark(o.c ? (U.hint ? 0.5 : 1) : 0);
  }

  // ---------- 口语：朗读走原来的识别和打分；问答题听写以后交给文字模型按这道题的评分要点判 ----------
  function speakOff(why) {
    const P0 = st(), run = P0.run; if (!run) return;
    stopAll();
    engine.skipSkill(run, 'speak', why);
    G.save();
    G.toast(t('place.s.off', { why: t('place.why.' + why) }));
    nextItem();
  }
  async function mic() {
    const it = U && U.item; if (!it || it.skill !== 'speak' || U.locked || U.busy) return;
    if (U.listening) { G.stopListening(); return; }
    const run = st().run, T = TARGETS[run.lang] || TARGETS.en, btn = $('#pl-mic'), hint = $('#pl-hint'), heard = $('#pl-heard'), tok = U.tok;
    const read = it.kind === 'read';
    U.listening = true;
    if (btn) { btn.classList.add('on'); btn.innerHTML = G.STOP; }
    if (hint) hint.textContent = t('place.s.on');
    let res;
    try { res = await T.listen(G, tx => { if (U && U.tok === tok && heard && !/^🎤|^🎧/.test(tx)) heard.textContent = tx; }, read ? [it.text] : [], read ? null : { maxMs: 14000, long: true }); }
    catch (e) { res = { alts: [], fail: 'net' }; }
    if (!U || U.tok !== tok || U.item !== it) return;
    U.listening = false;
    if (btn) { btn.classList.remove('on'); btn.innerHTML = G.MIC; }
    res = res || {};
    const alts = (res.alts || []).filter(Boolean);
    if (!alts.length) {
      const f = res.fail || (res.err === 'not-allowed' || res.err === 'audio-capture' ? 'mic' : '');
      if (f === 'mic') { speakOff('mic'); return; }
      if (f === 'net' || f === 'key' || f === 'nokey') { U.spFail = (U.spFail || 0) + 1; if (U.spFail >= 2) { speakOff(f === 'net' ? 'net' : 'ai'); return; } if (hint) hint.textContent = t('place.s.retry'); return; }
      if (f === 'stop') { if (hint) hint.textContent = t('place.s.mic'); return; }
      U.unheard++;
      if (U.unheard >= 2) { mark(0, { unheard: 1 }); return; }
      if (hint) hint.textContent = t('place.s.again');
      return;
    }
    if (heard) heard.textContent = t('place.s.heard', { t: alts[0] });
    if (read) {
      const r = T.score(G, it.text, alts) || { score: 0 };
      U.spFail = 0;
      mark(r.score >= 85 ? 1 : r.score >= 60 ? 0.5 : 0, { sc: r.score });
      return;
    }
    // 问答题：交给文字模型判 0 / 1 / 2（判不了算一次 AI 失败：连着两次就跳过口语，不拿自评顶）
    U.busy = true;
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = t('place.s.judging');
    let j = null;
    try { j = G.placeJudge ? await G.placeJudge(it, alts[0], run.lang) : null; } catch (e) { j = null; }
    if (!U || U.tok !== tok || U.item !== it) return;
    U.busy = false;
    if (btn) btn.disabled = false;
    if (!j || typeof j.score !== 'number') {
      U.spFail = (U.spFail || 0) + 1;
      if (U.spFail >= 2) { speakOff(typeof navigator !== 'undefined' && navigator.onLine === false ? 'net' : 'ai'); return; }
      if (hint) hint.textContent = t('place.s.retry');
      return;
    }
    U.spFail = 0;
    mark(clamp(j.score / 2, 0, 1), { sc: j.score, hint: U.hint ? 1 : undefined });
  }

  // ---------- 暂停 ----------
  function pause() {
    if (!U || U.step !== 'q') return;
    stopAll(); U.listening = false; U.playing = false;
    G.save();
    const n = (st().run ? st().run.n : 0) + 1;
    paint('<div class="pl-step center"><div class="pl-hero">⏸️</div><h2>' + h('place.pause.title') + '</h2><p>' + h('place.pause.p', { n }) + '</p></div>' +
      '<div class="pl-nav col"><button class="btn sun" data-act="plResume" data-focus>' + h('place.pause.go') + '</button><button class="btn ghost" data-act="plExit">' + h('place.pause.exit') + '</button></div>', 'pause');
  }

  // ---------- 结果 ----------
  function finishRun() {
    const P0 = st(), run = P0.run, r = engine.result(run), d = G.dayStr();
    P0.sk = r.sk; P0.auto = r.lv; P0.talk = r.talk; P0.cap = r.capped ? 1 : 0; P0.adj = 0; P0.lv = r.lv; P0.at = d; P0.run = null; P0.skip = ''; P0.card = '';
    P0.seen = [...new Set(P0.seen.concat(run.used))].slice(-160);
    const short = s => (r.sk[s].skip ? -1 : r.sk[s].lv);
    P0.hist.unshift({ d, lv: r.lv, talk: r.talk, n: r.n, v: short('vocab'), l: short('listen'), r: short('read'), s: short('speak'), ui: run.ui });
    P0.hist = P0.hist.slice(0, 6);
    G.S.settings.track = 'level';
    if (G.placeApply) G.placeApply('test');
    G.save();
    U.fresh = true;
    pResult();
  }
  const bars = lv => '<span class="pl-bar">' + [0, 1, 2, 3, 4, 5].map(k => '<i class="' + (lv >= 0 && k <= lv ? 'on' : '') + '"></i>').join('') + '</span>';
  function levelCard(lv) {
    return '<div class="pl-level"><b class="pl-lv-n">' + lv + '</b><div><strong>' + esc(LV.name(lv)) + '</strong><small>' + h('lv.cefr', { c: LV.cefr(lv) }) + '</small><p>' + esc(LV.desc(lv)) + '</p></div></div>';
  }
  function skillsHTML(P0) {
    return '<div class="pl-skills">' + SKILLS.map(s => {
      const k = P0.sk[s] || {};
      return '<div class="pl-sk" data-skill="' + s + '"><span>' + SK_ICON[s] + ' ' + esc(LV.skill(s)) + '</span>' + bars(k.skip || k.lv == null ? -1 : k.lv) +
        '<em>' + (k.skip || k.lv == null ? h('place.res.unchecked') : esc(LV.name(k.lv))) + '</em></div>';
    }).join('') + '</div>';
  }
  // 「接下来这样安排」：按现在的级别（调过的话按调过的）问 game.js 会排到哪个单元
  function planHTML(P0) {
    const lv = P0.lv, a = G.placePlan ? G.placePlan(lv) : null, talk = clamp(P0.talk + P0.adj, 0, LV.TOP), li = [];
    if (G.S.settings.track !== 'level') li.push(h('place.plan.book'));
    else {
      if (a && a.unit) li.push(h('place.plan.unit', { unit: a.unit }) + (a.free > 0 ? ' ' + h('place.plan.free', { n: a.free }) : ''));
      if (a && a.fit === 'below') li.push(h('place.plan.below'));
      if (a && a.fit === 'beyond') li.push(h('place.plan.beyond'));
      if (a && a.fit === 'locked') li.push(h('place.plan.locked'));
      li.push(h('place.plan.kinds.' + (lv <= 1 ? 'low' : lv === 2 ? 'mid' : 'high')));
      li.push(h('place.plan.chat', { name: LV.name(talk), how: t('place.chat.' + talk) }));
    }
    if (P0.cap && !P0.adj) li.push(h('place.plan.cap'));
    return '<ul class="pl-plan">' + li.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  }
  function adjustHTML(P0) {
    return '<div class="pl-adjust"><p>' + h('place.adj.q') + '</p><div class="pl-adj-row">' +
      '<button class="btn small ghost" data-act="plAdj" data-d="-1"' + (P0.lv <= 0 ? ' disabled' : '') + ' aria-label="' + h('place.adj.down') + '">◀ ' + h('place.adj.down') + '</button>' +
      '<b>' + esc(LV.tag(P0.lv)) + '</b>' +
      '<button class="btn small ghost" data-act="plAdj" data-d="1"' + (P0.lv >= LV.TOP ? ' disabled' : '') + ' aria-label="' + h('place.adj.up') + '">' + h('place.adj.up') + ' ▶</button></div>' +
      (P0.adj ? '<small>' + h('place.adj.from', { name: LV.name(P0.auto) }) + '</small>' : '') + '</div>';
  }
  function resultBody(P0) {
    const sp = P0.sk.speak || {};
    return levelCard(P0.lv) + '<p class="pl-note">' + h('place.res.note') + '</p>' +
      '<h3>' + h('place.res.skills') + '</h3>' + skillsHTML(P0) +
      (sp.skip ? '<p class="pl-note warn" id="pl-nospeak">' + h('place.res.nospeak', { why: t('place.why.' + sp.skip) }) + '</p>' : '') +
      '<h3>' + h('place.res.plan') + '</h3>' + planHTML(P0) + adjustHTML(P0);
  }
  function pResult() {
    const P0 = st();
    paint('<div class="pl-step res">' + tmpBar() + '<div class="pl-hero">🎉</div><h2>' + h('place.res.title') + '</h2>' + resultBody(P0) + '</div>' +
      '<div class="pl-nav"><button class="btn sun" data-act="plFinish" data-focus>' + h(U.first || !hasProgress() ? 'place.res.go' : 'place.done') + '</button></div>', 'result');
  }
  function adjust(d) {
    const P0 = st(); if (!placed()) return;
    const lv = clamp(P0.lv + d, 0, LV.TOP); if (lv === P0.lv) return;
    P0.lv = lv; P0.adj = lv - P0.auto;
    if (P0.hist[0] && P0.hist[0].d === P0.at) P0.hist[0].adj = P0.adj;
    if (G.placeApply) G.placeApply('adjust');
    G.save();
    if (isOpen() && U && U.step === 'result') pResult(); else sheet();
  }

  // =====================================================================================
  // ③ 首页卡片、设置里的那一页
  // =====================================================================================
  function homeCard() {
    if (!G || !data(st().lang)) return '';
    const P0 = st();
    if (P0.run) return '<div class="place-card" id="place-card"><button class="pc-main" data-act="plOpen"><span>🧭</span><div><b>' + h('place.card.resume', { n: (P0.run.n || 0) + 1 }).replace(/^🧭\s*/, '') + '</b><small>' + h('place.card.resume.sub') + '</small></div><em>' + h('place.card.resume.go') + '</em></button></div>';
    if (placed() || P0.card) return '';
    return '<div class="place-card" id="place-card"><button class="pc-main" data-act="plOpen"><span>🧭</span><div><b>' + h('place.card.title', { lang: langName(P0.lang) }).replace(/^🧭\s*/, '') + '</b><small>' + h('place.card.sub') + '</small></div><em>' + h('place.card.go') + '</em></button>' +
      '<button class="pc-x" data-act="plCardNo" aria-label="' + h('place.card.no') + '">✕</button></div>';
  }
  // 设置页里的一行（game.js 的 settingsSheet 调）
  function settingsRow() {
    if (!G || !data(st().lang)) return '';
    const P0 = st();
    return '<div class="set" id="set-place"><label>' + h('place.set.row') + '</label><div class="say-row"><span class="set-v">' + (placed() ? esc(LV.tag(P0.lv)) + ' · ' + h('lv.cefr', { c: LV.cefr(P0.lv) }) : h('place.set.none')) + '</span>' +
      '<button class="btn small ghost" data-act="plSheet">' + h(placed() ? 'place.set.open' : 'place.set.start') + '</button></div><small>' + h('place.set.note') + '</small></div>';
  }
  function sheet() {
    const P0 = st();
    if (!placed()) {
      G.openModal('<div class="big">🧭</div><h2>' + h('place.sheet.title') + '</h2><p>' + h('place.sheet.none') + '</p><p class="pl-note">' + h('place.res.note') + '</p>' +
        '<div class="row"><button class="btn ghost" data-act="setBack">' + h('place.back') + '</button><button class="btn" data-act="plOpen" data-focus>' + h('place.set.start') + '</button></div>');
      return;
    }
    const tr = G.S.settings.track === 'level' ? 'level' : 'book';
    const hist = P0.hist.map(x => '<li><b>' + esc(x.d) + '</b> · ' + esc(LV.tag(x.lv)) + ' <small>' + ['v', 'l', 'r', 's'].map((k, i) => SK_ICON[SKILLS[i]] + (x[k] >= 0 ? x[k] : '–')).join(' ') + (x.adj ? ' · ' + h('place.hist.adj') : '') + '</small></li>').join('');
    G.openModal('<h2>' + h('place.sheet.title') + '</h2><div class="pl-sheet">' +
      '<h3>' + h('place.sheet.lv') + '</h3>' + levelCard(P0.lv) + skillsHTML(P0) +
      ((P0.sk.speak || {}).skip ? '<p class="pl-note warn">' + h('place.res.nospeak', { why: t('place.why.' + P0.sk.speak.skip) }) + '</p>' : '') +
      '<p class="pl-note">' + h('place.res.note') + '</p>' +
      '<div class="set"><label>' + h('place.sheet.track') + '</label><div class="seg">' +
      [['level', 'place.track.level'], ['book', 'place.track.book']].map(([m, k]) => '<button class="' + (tr === m ? 'on' : '') + '" data-act="plTrack" data-m="' + m + '">' + h(k) + '</button>').join('') + '</div></div>' +
      planHTML(P0) + adjustHTML(P0) +
      (hist ? '<h3>' + h('place.sheet.hist') + '</h3><ul class="pl-hist">' + hist + '</ul>' : '') + '</div>' +
      '<div class="row"><button class="btn ghost" data-act="plRetest">' + h('place.sheet.retest') + '</button><button class="btn" data-act="setBack" data-focus>' + h('place.done') + '</button></div>');
  }

  // ---------- 安卓返回键 ----------
  function back() {
    if (!isOpen() || !U) return false;
    if (U.step === 'q') { pause(); return true; }
    if (U.step === 'pause') { nextItem(); return true; }
    if (U.step === 'who' && U.first) { pLang(); return true; }
    if (U.step === 'ready') { pWho(); return true; }
    if (U.step === 'result') { finishFlow('done'); return true; }
    if (U.step === 'lang') return true;   // 第一页：不退出
    later(); return true;
  }
  // 「以后再测」：记下来（全新的开始不会再被拉进来），首页的卡片还在
  function later() {
    const P0 = st();
    if (!placed() && !P0.skip) P0.skip = G.dayStr();
    G.save();
    finishFlow('later');
  }

  function init(api) {
    G = api;
    // 切到后台：正在放的声音停下来，题目停在暂停页。正在用话筒时不管——安卓第一次弹「允许用麦克风」的系统窗口时页面也算切到后台，
    // 那时不能把这道题停掉（识别自己会结束：说完了、没出声或者到时间）
    try { document.addEventListener('visibilitychange', () => { if (document.hidden && isOpen() && U && U.step === 'q' && !U.listening) pause(); }); } catch (e) { /* 没有页面 */ }
    return {
      plUi: el => { if (G.setUi) G.setUi(el.dataset.l); pLang(); },
      plTarget: el => { if (TARGETS[el.dataset.l]) { st().lang = el.dataset.l; G.save(); pLang(); } },
      plGo: el => { if (!U) return; if (el.dataset.to === 'lang') pLang(); else pWho(); },
      plWho: el => { if (!U) return; U.who = el.dataset.v; if (U.know == null && st().know >= 0) U.know = st().know; pWho(); },
      plKnow: el => { if (!U) return; U.know = +el.dataset.v; if (!U.who && st().who) U.who = st().who; pWho(); },
      plWhoNext: () => whoNext(),
      plLater: () => later(),
      plStart: () => startRun(),
      plResume: () => { if (st().run) nextItem(); else pReady(); },
      plRestart: () => { st().run = null; G.save(); pWho(); },
      plExit: () => finishFlow('paused'),
      plPause: () => pause(),
      plSay: () => playItem(),
      plPick: el => pick(+el.dataset.i),
      plIdk: () => { if (U && U.step === 'q' && !U.locked && !U.busy) { if (U.listening) G.stopListening(); mark(0, { idk: 1 }); } },
      plGloss: () => { if (!U || U.step !== 'q' || U.locked) return; U.hint = 1; const b = $('#place .pl-zh'), it = U.item, g = it.qGloss && it.qGloss[st().run.ui]; if (b && g) b.outerHTML = '<small class="pl-gloss">' + esc(g) + '</small>'; },
      plMic: () => mic(),
      plSpeakSkip: () => { if (U && U.step === 'q' && !U.busy) { if (U.listening) G.stopListening(); speakOff('user'); } },
      plAdj: el => adjust(+el.dataset.d),
      plFinish: () => finishFlow('done'),
      // 首页卡片、设置
      plOpen: () => { G.closeModal(); open('who'); },
      plCardNo: () => { st().card = G.dayStr(); G.save(); G.toast(t('place.card.hid')); if (G.renderHome) G.renderHome(); },
      plSheet: () => sheet(),
      plRetest: () => { G.closeModal(); st().run = null; open('who'); },
      plTrack: el => { if (!placed()) return; const m = el.dataset.m === 'level' ? 'level' : 'book'; if (G.S.settings.track === m) return; G.S.settings.track = m; if (m === 'level' && G.placeApply) G.placeApply('track'); G.save(); sheet(); if (G.renderHome) G.renderHome(); },
    };
  }

  const api = {
    engine, STR, TARGETS,
    init, first, open, isNew, isOpen, back, homeCard, settingsRow, sheet, level, chatLevel, placed: () => placed(), hasProgress: () => hasProgress(),
    // 测试用：现在的画面状态
    _ui: () => U,
  };
  if (inNode) module.exports = api;
  else root.EchoPlace = api;
})(typeof window !== 'undefined' ? window : globalThis);
