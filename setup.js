// 销售版：家长首次设置向导 + 家庭定制（window.EchoSetup）
// 只在销售版（dex.js 的 DEX.sales：APK 原生桥 EchoNative.edition() === 'sales'，测试用 ?edition=sales）出现。
// 家长在远程协助安装时做一遍（评估「必须改」第 3、4、5、8、10 条），全部只存在这台手机里：
//   ① 欢迎 + AI 说明 + 隐私要点 + 监护人单独同意（全文在 pages/privacy.html、pages/consent.html）
//   ② 设备检查（安卓版本、WebView、WebGL2、剩余空间 ≥1GB、麦克风）——放在最前面：不合格就停在这里，「不过不收钱」（销售流程 00 号第 7–8 步：查完合格再付款）
//   ③ 家长密码（4 位，必须设；APK 里存在原生：EchoNative.setPin，每台手机自己的随机盐 + 哈希）
//   ④ 家长自己的阿里云百炼密钥（「测试」真的发一个最小的请求；「怎么开通？」打开 pages/bailian-guide.html）
//   ⑤ 家庭定制：孩子的英文昵称（不要真名）、预设部件拼的形象、从约 50 只原创伙伴里挑 3 只（开场时博士请孩子挑的三个贝壳里就是它们）、
//      家人当 NPC（Mom / Dad / Grandma / Grandpa / Brother / Sister + 预设造型），放在你好岛的家里
//   ⑥ 完成 → 把手机交给孩子
// 结果存在 S.settings.family（「清空进度」也留着）：{ v, step, done, consent: { at, v }, nick, avatar, starters, members, keyOk, device }
// 家庭定制在 App 里怎么生效：主角造型改 EchoPeople.LOOKS.boy / girl（world.js 的主角就用它）、伙伴改 MonsterGame.STARTERS（博士的包），
// 家里的人通过包一层 EchoStory 的 enter / talk / look 钩子放进你好岛的家（i0H），开场剧情换成认得孩子昵称的版本
(function () {
  'use strict';
  const P = window.EchoPeople, D = window.DEX;
  let G = null;   // game.js 给的工具（S、save、toast、esc、parentOk、dayStr……）
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sales = () => !!(D && D.sales);
  const nat = f => { try { return !!(window.EchoNative && typeof EchoNative[f] === 'function'); } catch (e) { return false; } };
  const DOC_V = '2026-10-08';   // 隐私说明 / 同意书的版本：同意的记录里存这个，以后改了文书要重新同意
  const BASE_LOOK = P ? { boy: Object.assign({}, P.LOOKS.boy), girl: Object.assign({}, P.LOOKS.girl) } : {};   // 改造型之前的主角
  const BASE_STARTERS = window.MonsterGame ? MonsterGame.STARTERS.slice() : [];

  // ---------- 文书（打包在 pages/，App 里用一层全屏的框打开，不离开 App） ----------
  const DOCS = {
    privacy: ['儿童隐私说明', 'pages/privacy.html'],
    consent: ['监护人同意书', 'pages/consent.html'],
    guide: ['怎么开通阿里云百炼、拿到 API Key', 'pages/bailian-guide.html'],
    licenses: ['开源许可与致谢', 'pages/licenses.html'],
  };
  function openDoc(k) {
    const d = DOCS[k]; if (!d) return;
    closeDoc();
    const el = document.createElement('div');
    el.id = 'su-doc'; el.className = 'su-doc';
    el.innerHTML = '<div class="su-doc-bar"><b>' + esc(d[0]) + '</b><button class="btn small" data-act="suDocClose">关闭</button></div><iframe src="' + d[1] + '" title="' + esc(d[0]) + '"></iframe>';
    document.body.appendChild(el);
  }
  function closeDoc() { const el = $('#su-doc'); if (el) { el.remove(); return true; } return false; }

  // ---------- 存档里的家庭设置 ----------
  function prof() {
    const st = G.S.settings;
    if (!st.family || typeof st.family !== 'object') st.family = null;
    return st.family;
  }
  function draft() {
    const st = G.S.settings;
    if (!st.family || typeof st.family !== 'object') st.family = { v: 1, step: 'welcome', done: '', consent: null, nick: '', avatar: { g: 'boy', skin: 0, style: 'spiky', hair: 0, cloth: 0, hat: 'cap' }, starters: [], members: [], keyOk: '', device: null };
    const F = st.family;
    if (!F.avatar || typeof F.avatar !== 'object') F.avatar = { g: 'boy', skin: 0, style: 'spiky', hair: 0, cloth: 0, hat: 'cap' };
    if (!Array.isArray(F.starters)) F.starters = [];
    if (!Array.isArray(F.members)) F.members = [];
    return F;
  }
  // 2026-11-19（给所有人用）：向导第一页先问「谁来用」——F.who = 'kid'（默认：给孩子用，家长来设置，就是原来的六步）/
  // 'open'（青少年 / 成人自己学：只留 AI 说明和隐私、设备检查、AI 密钥，不设家长密码、不做家庭定制，开场和家庭版一样自己选照片起名字）
  const doneF = () => { if (!sales() || !G) return null; const F = prof(); return F && F.done ? F : null; };
  const selfPath = F => !!(F && F.who === 'open');
  const famOn = () => { const F = doneF(); return F && !selfPath(F) ? F : null; };   // 家庭定制只在「给孩子用」时生效
  const needed = () => sales() && !doneF();
  // 新加的字走字表（i18n.js）：向导原来的中文以后一起搬
  const I18N = window.EchoI18n;
  const t = (k, p) => (I18N ? I18N.t(k, p) : k), h = (k, p) => (I18N ? I18N.h(k, p) : k);
  if (I18N) I18N.add({
    zh: {
      'su.ui': '界面语言 · Language',
      'su.who.q': '谁来用这个 App？', 'su.who.kid': '👨‍👩‍👧 给孩子用', 'su.who.open': '🧑 我自己学',
      'su.who.kid.note': '给孩子用：下面几页请家长来填（同意书、设备检查、家长密码、AI 密钥、家庭定制）。',
      'su.who.open.note': '青少年 / 成人自己学：不设家长密码，没有学习锁，也不限时。只要看 AI 和隐私说明、检查设备、填 AI 密钥。',
      'su.open.head': '🧭 首次设置', 'su.open.head.s': '大约 3 分钟', 'su.open.tabs': ['欢迎', '设备检查', 'AI 密钥', '完成'],
      'su.open.title': '欢迎使用回声岛',
      'su.open.lead': '回声岛是一个练外语听说的软件：要<b>开口说</b>，才能让怪兽出招、和岛民聊天。下面几页是使用前的设置，设置只存在这台手机里。',
      'su.open.ai.t': '🤖 关于 AI（人工智能）',
      'su.open.ai': '和岛民聊天、口语打分、能力检测里的口语部分，是由<b>人工智能</b>完成的，由<b>阿里云通义千问</b>提供。AI 生成的内容在 App 里都标着「AI 生成」，每段聊天开头还有一句语音提示。AI 只扮演 App 里的角色、只聊岛上的事和日常话题，不会问您的真名、单位、住址、电话。',
      'su.open.pr.t': '🔒 隐私要点',
      'su.open.pr.1': '存档、昵称、聊天记录<b>只存在这台手机里</b>，开发者收不到。',
      'su.open.pr.2': '聊天和口语打分时，您说话的<b>声音和识别出来的文字</b>会直接发到阿里云处理，用的是<b>您自己的阿里云账号</b>。开发者收不到，也不跑服务器。',
      'su.open.pr.3': '不收集真名、照片、住址、电话、生日。起名字时请用<b>昵称</b>；能力检测只记下年龄段。',
      'su.open.pr.4': '随时可以在设置里删掉 AI 密钥（就不再连 AI）、清空进度，或者卸载 App 删掉全部数据。',
      'su.open.doc': '📄 隐私说明（全文）',
      'su.open.consent': '我是使用者本人，已年满 14 周岁，已经读过隐私说明，<b>同意</b>使用 AI 聊天和口语打分（我说话的声音和识别出来的文字会发给阿里云处理）。',
      'su.open.under': '不满 14 周岁请选上面的「给孩子用」，由家长来设置。不同意的话请不要继续。',
      'su.open.need': '请先勾选同意（在这一页最下面）',
      'su.open.done.t': '设置好了！', 'su.open.done.key': '🗝️ AI 密钥：{v}', 'su.open.done.dev': '🩺 设备检查：{v}',
      'su.key.ok': '测试通过', 'su.key.has': '已粘贴（还没测试通过）', 'su.key.none': '还没有（口语不能自动打分，也不能和岛民聊天）',
      'su.dev.ok': '合格', 'su.dev.warn': '能用（有一项不太好）', 'su.dev.bad': '不合格', 'su.dev.none': '没做',
      'su.open.done.p': '接下来选要学的语言，做一个大约 6 分钟的能力检测，然后就可以开始了。以后要改，都在「设置」里。',
      'su.open.finish': '🎉 开始', 'su.back': '上一步',
    },
    en: {
      'su.ui': 'Language · 界面语言',
      'su.who.q': 'Who will use this app?', 'su.who.kid': '👨‍👩‍👧 A child', 'su.who.open': '🧑 Me',
      'su.who.kid.note': 'For a child: a parent fills in the next pages (consent, device check, parent PIN, AI key, family setup). These pages are in Chinese for now.',
      'su.who.open.note': 'For a teenager or adult learning alone: no parent PIN, no study gate, no time limits. You only read the AI and privacy notes, check the device and enter an AI key.',
      'su.open.head': '🧭 First-time setup', 'su.open.head.s': 'about 3 minutes', 'su.open.tabs': ['Welcome', 'Device check', 'AI key', 'Done'],
      'su.open.title': 'Welcome to Echo Island',
      'su.open.lead': 'Echo Island is an app for practising listening and speaking in a new language: you have to <b>speak aloud</b> for your monsters to move and to chat with the islanders. The next pages set things up. Everything stays on this phone.',
      'su.open.ai.t': '🤖 About AI',
      'su.open.ai': 'Chatting with islanders, scoring your speaking and the speaking part of the level check are done by <b>artificial intelligence</b>, provided by <b>Alibaba Cloud Tongyi Qianwen</b>. AI-generated content is labelled in the app, and each chat starts with a short spoken notice. The AI only plays characters in the app and talks about the islands and everyday topics. It will not ask for your real name, workplace, address or phone number.',
      'su.open.pr.t': '🔒 Privacy in brief',
      'su.open.pr.1': 'Your save, nickname and chat history are stored <b>only on this phone</b>. The developer cannot see them.',
      'su.open.pr.2': 'When you chat or your speaking is scored, <b>your voice and the recognised text</b> go straight to Alibaba Cloud, using <b>your own Alibaba Cloud account</b>. The developer does not receive them and runs no server.',
      'su.open.pr.3': 'No real name, photo, address, phone number or birthday is collected. Please use a <b>nickname</b>. The level check only keeps an age group.',
      'su.open.pr.4': 'At any time you can delete the AI key in Settings (the app then stops using AI), clear your progress, or uninstall the app to remove everything.',
      'su.open.doc': '📄 Privacy notice (full text, in Chinese)',
      'su.open.consent': 'I am the user, I am 14 or older, I have read the privacy notice, and I <b>agree</b> to use AI chat and speech scoring (my voice and the recognised text are sent to Alibaba Cloud for processing).',
      'su.open.under': 'If you are under 14, choose "A child" above and ask a parent to do the setup. If you do not agree, please do not continue.',
      'su.open.need': 'Please tick the consent box at the bottom of this page first',
      'su.open.done.t': 'All set!', 'su.open.done.key': '🗝️ AI key: {v}', 'su.open.done.dev': '🩺 Device check: {v}',
      'su.key.ok': 'tested and working', 'su.key.has': 'entered (not tested yet)', 'su.key.none': 'none yet (speaking cannot be scored and you cannot chat with islanders)',
      'su.dev.ok': 'passed', 'su.dev.warn': 'usable (one item is not ideal)', 'su.dev.bad': 'failed', 'su.dev.none': 'not done',
      'su.open.done.p': 'Next you choose the language to learn and take a level check of about 6 minutes. Then you can start. You can change everything later in Settings.',
      'su.open.finish': '🎉 Start', 'su.back': 'Back',
    },
  });

  // ---------- 主角形象：预设部件 ----------
  const SKINS = ['#ffe1c8', '#f1c7a0', '#d9a57b'];
  const HAIRS = ['#212121', '#3a2a24', '#7a4a2c', '#b0703c', '#8e5cc2'];
  const CLOTHES = ['#1f8f8c', '#e53935', '#1e88e5', '#8e6cef', '#ff8f00', '#ff7fa3', '#43a047'];
  const STYLES = [['spiky', '刺刺头'], ['short', '短发'], ['bob', '齐耳'], ['long', '长发'], ['ponytail', '马尾'], ['pigtails', '双马尾']];
  const HATS = [['cap', '帽子'], ['band', '发带'], ['none', '不戴']];
  function avatarLook(a) {
    a = a || {};
    const g = a.g === 'girl' ? 'girl' : 'boy', L = Object.assign({}, BASE_LOOK[g]);
    if (SKINS[a.skin]) L.skin = SKINS[a.skin];
    if (STYLES.some(s => s[0] === a.style)) L.style = a.style;
    if (HAIRS[a.hair]) L.hair = HAIRS[a.hair];
    const c = CLOTHES[a.cloth];
    if (c) { if (L.jacket) L.jacket = c; else L.shirt = c; }
    if (a.hat === 'none') { delete L.hat; delete L.hatC; delete L.hatLogo; }
    else if (a.hat === 'cap' || a.hat === 'band') { L.hat = a.hat; L.hatC = c || L.hatC || '#16a3a0'; if (a.hat === 'cap') L.hatLogo = '#ffffff'; else delete L.hatLogo; }
    return L;
  }
  // 主角的造型就是 LOOKS.boy / girl（world.js 的 playerLook）：先还原，再套上家长挑的
  function applyLook(F) {
    if (!P) return;
    ['boy', 'girl'].forEach(g => { const L = P.LOOKS[g]; Object.keys(L).forEach(k => delete L[k]); Object.assign(L, BASE_LOOK[g]); });
    if (F && F.avatar) { const g = F.avatar.g === 'girl' ? 'girl' : 'boy'; const L = P.LOOKS[g]; Object.keys(L).forEach(k => delete L[k]); Object.assign(L, avatarLook(F.avatar)); }
  }

  // ---------- 英文昵称：只能用英文字母；像中文真名的拼音（Zhang Wei、Liming）要家长确认「这不是真名」 ----------
  const PY = /^(?:(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|in|un|ia|ie|iu|ua|uo|ue|ui|er|a|o|e|i|u|v)){1,3}$/;
  const SURNAMES = new Set(('zhang wang li liu chen yang zhao huang zhou wu xu sun hu zhu gao lin he guo ma luo liang song zheng xie han tang feng yu dong xiao cheng cao yuan deng fu shen zeng peng lu su jiang cai jia ding wei xue ye yan pan du dai xia zhong tian ren fan fang shi yao tan liao zou xiong jin hao kong bai cui kang mao qiu qin gu hou shao meng long wan duan lei qian yin yi chang qiao lai gong wen').split(' '));
  // → { ok, name（整理好的大小写）, msg 不行的原因, warn 像真名 }
  function checkNick(v) {
    v = String(v || '').trim().replace(/\s+/g, ' ');
    if (!v) return { ok: false, msg: '请给孩子起一个英文昵称' };
    if (!/^[A-Za-z]+( [A-Za-z]+)?$/.test(v)) return { ok: false, msg: '只能用英文字母（最多两个词），比如 Kevin、Coco、Super Max' };
    if (v.replace(/ /g, '').length < 2 || v.length > 12) return { ok: false, msg: '昵称要 2 到 12 个字母' };
    const name = v.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const ws = v.toLowerCase().split(' ');
    const syl = w => { const m = w.match(/(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|in|un|ia|ie|iu|ua|uo|ue|ui|er|a|o|e|i|u|v)/g); return m ? m.length : 0; };
    const startsSur = w => [...SURNAMES].some(s => w.startsWith(s) && PY.test(w.slice(s.length) || 'a'));
    const warn = (ws.length === 2 && SURNAMES.has(ws[0]) && PY.test(ws[1])) || (ws.length === 1 && ws[0].length >= 6 && PY.test(ws[0]) && syl(ws[0]) >= 2 && startsSur(ws[0]));
    return { ok: true, name, warn };
  }

  // ---------- 伙伴库：约 50 只原创、不撞脸（销售版的保留怪兽不在里面）的第一阶怪兽 ----------
  // 只挑火 / 水 / 草 / 电（博士的包按这四种属性画颜色和说明）；有进化链的优先，再补稀有度 ≤3 的；像物件的不要
  const LIB_TYPES = ['fire', 'water', 'grass', 'spark'];
  const LIB_SKIP = new Set(['hotpot', 'skyballoon', 'lamppost', 'strawhat', 'ferryshell', 'kelpdrifter']);
  const TYPE_ZH = { fire: '🔥 火', water: '💧 水', grass: '🌿 草', spark: '⚡ 电' };
  let LIB = null;
  function library() {
    if (LIB) return LIB;
    const ok = s => s && D.isBase(s) && !s.legend && !s.reserved && !(D.reserved && D.reserved(s.id)) && LIB_TYPES.includes(s.type) && !LIB_SKIP.has(s.id);
    const all = D.list.filter(ok);
    const evo = all.filter(s => s.evo && s.evo.length), rest = all.filter(s => !(s.evo && s.evo.length) && (s.rarity || 3) <= 3).sort((a, b) => a.dexNo - b.dexNo);
    LIB = evo.concat(rest).slice(0, 50).sort((a, b) => LIB_TYPES.indexOf(a.type) - LIB_TYPES.indexOf(b.type) || a.dexNo - b.dexNo);
    return LIB;
  }
  const libOk = id => library().some(s => s.id === id);
  const monImg = s => '<span class="su-mi" data-sp="' + esc(s.id) + '"><img src="assets/mon2d/' + esc(s.id) + '.webp" alt="" loading="lazy"></span>';

  // ---------- 家里的人：称呼 + 预设造型（不收照片） ----------
  const L0 = P ? P.LOOKS : {};
  const tw = (base, o) => Object.assign({}, base, o);
  const RELS = [
    { rel: 'mom', call: 'Mom', zh: '妈妈', g: 'f', looks: [L0.mom, tw(L0.mom, { hair: '#212121', style: 'long', shirt: '#4fc3f7', apron: undefined, bottom: '#37474f' }), tw(L0.mom, { style: 'ponytail', hair: '#5d4037', shirt: '#ec407a', apron: undefined, bottom: '#455a64', skirt: false, glasses: true })] },
    { rel: 'dad', call: 'Dad', zh: '爸爸', g: 'm', looks: [L0.dad, tw(L0.dad, { hat: undefined, hatC: undefined, hatLogo: undefined, jacket: '#455a64', glasses: true }), tw(L0.dad, { hat: undefined, hatC: undefined, hatLogo: undefined, jacket: undefined, shirt: '#43a047', bottom: '#37474f', style: 'spiky' })] },
    { rel: 'grandma', call: 'Grandma', zh: '奶奶 / 外婆', g: 'f', looks: [L0.granny, tw(L0.granny, { shirt: '#e57373', bottom: '#5d4037' }), tw(L0.granny, { hair: '#9e9e9e', style: 'bob', shirt: '#4db6ac', glasses: false })] },
    { rel: 'grandpa', call: 'Grandpa', zh: '爷爷 / 外公', g: 'm', looks: [L0.grandpa, tw(L0.grandpa, { style: 'short', hair: '#e0e0e0', shirt: '#1e88e5', shirt2: undefined }), tw(L0.grandpa, { hat: 'straw', shirt: '#8bc34a', glasses: false })] },
    { rel: 'brother', call: 'Brother', zh: '哥哥 / 弟弟', g: 'm', looks: [L0.kid, L0.student, tw(L0.kid, { style: 'short', hair: '#212121', shirt: '#ff7043', bottom: '#37474f' })] },
    { rel: 'sister', call: 'Sister', zh: '姐姐 / 妹妹', g: 'f', looks: [L0.kidF, L0.studentF, tw(L0.kidF, { style: 'ponytail', hair: '#5d4037', shirt: '#ffca28', bottom: '#26a69a' })] },
  ].map(r => Object.assign(r, { looks: r.looks.map(l => { const o = Object.assign({}, l); Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o; }) }));
  const RBY = Object.fromEntries(RELS.map(r => [r.rel, r]));
  const MEM_MAX = 4;
  const member = m => { const r = RBY[m && m.rel]; return r ? { rel: r.rel, call: r.call, zh: r.zh, g: r.g, look: r.looks[m.look] || r.looks[0] } : null; };
  const members = F => (F.members || []).map(member).filter(Boolean);
  // 家里本来就有一位（地图上 role 'house' 的人，以前一直是妈妈）：有 Mom 就是她，没有就是第一位
  const houseOf = F => { const ms = members(F); return ms.find(m => m.rel === 'mom') || ms[0] || null; };

  // ---------- 向导 ----------
  // 顺序和销售流程（00 号第 7–9 步、06 号安装教程、03 号话术）一致：同意 → 设备检查（合格才付款）→ 家长密码 → AI 密钥 → 家庭定制 → 完成
  const FLOW = ['welcome', 'device', 'pin', 'key', 'nick', 'mons', 'fam', 'done'];
  const NUM = { welcome: 1, device: 2, pin: 3, key: 4, nick: 5, mons: 5, fam: 5, done: 6 };
  const TABS = ['欢迎', '设备检查', '家长密码', 'AI 密钥', '家庭定制', '完成'];
  const WZ = { step: '', edit: null, pin: null, key: null, nickWarnOk: false, dev: null };
  const isOpen = () => !!$('#setup');

  function open(step, edit) {
    if (!G) return;
    const F = draft();
    WZ.edit = edit ? (step === 'key' ? ['key'] : step === 'device' ? ['device'] : ['nick', 'mons', 'fam']) : null;
    WZ.step = WZ.edit ? WZ.edit[0] : (FLOW.includes(step) ? step : (FLOW.includes(F.step) ? F.step : 'welcome'));
    WZ.pin = null; WZ.key = null; WZ.nickWarnOk = false; WZ.dev = null;
    let el = $('#setup');
    if (!el) {
      el = document.createElement('div');
      el.id = 'setup'; el.className = 'su'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="su-box" id="su-box"></div>';
      document.body.appendChild(el);
      document.body.classList.add('su-on');
      // 伙伴的图标（assets/mon2d）读不到：换成程序画的
      el.addEventListener('error', e => {
        const t = e.target; if (!t || t.tagName !== 'IMG') return;
        const w = t.closest('.su-mi'), s = w && D.byId[w.dataset.sp];
        if (s && window.Cartoon) w.innerHTML = Cartoon.monster(s); else t.remove();
      }, true);
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', e => { if (WZ.step === 'pin' && /^\d$/.test(e.key) && e.target.tagName !== 'INPUT') { e.preventDefault(); pinKey(e.key); } });
    }
    render();
    if (WZ.step === 'device') deviceCheck();
  }
  function close() {
    closeDoc();
    const el = $('#setup'); if (el) el.remove();
    document.body.classList.remove('su-on');
    WZ.step = ''; WZ.edit = null; WZ.pin = null;
  }
  function go(step) {
    WZ.step = step;
    if (!WZ.edit) { const F = draft(); F.step = step; G.save(); }
    render();
    const b = $('#su-box'); if (b) b.scrollTop = 0;
    if (step === 'device' && !WZ.dev) deviceCheck();
  }
  // 「我自己学」那条路：欢迎（AI 说明、隐私、本人同意）→ 设备检查 → AI 密钥 → 完成
  const FLOW_SELF = ['welcome', 'device', 'key', 'done'];
  const pages = () => WZ.edit || (selfPath(prof()) ? FLOW_SELF : FLOW);
  function next() {
    const ps = pages(), i = ps.indexOf(WZ.step), why = blocked();
    if (why) { G.toast(why); return; }
    if (WZ.step === 'nick') saveNick();
    if (i >= ps.length - 1) { if (WZ.edit) saveEdit(); return; }
    go(ps[i + 1]);
  }
  function back() {
    const ps = pages(), i = ps.indexOf(WZ.step);
    if (i > 0) go(ps[i - 1]); else if (WZ.edit) close();
  }
  // 这一页还不能往下走的原因（'' = 可以）
  function blocked() {
    const F = draft();
    if (WZ.step === 'welcome') return F.consent && F.consent.v === DOC_V ? '' : selfPath(F) ? t('su.open.need') : '请先勾选同意（在这一页最下面）';
    if (WZ.step === 'pin') return pinHas() ? '' : '请先设好家长密码';
    if (WZ.step === 'nick') { const r = checkNick(($('#su-nick') || {}).value || F.nick); return !r.ok ? r.msg : r.warn && !WZ.nickWarnOk ? '这个昵称像真名，请换一个，或者勾选「这不是孩子的真名」' : ''; }
    if (WZ.step === 'mons') return F.starters.length === 3 ? '' : '请选 3 只伙伴（现在选了 ' + F.starters.length + ' 只）';
    // 设备检查：不合格就不能往下走（安装包里才这样；网页版看不到手机的情况，不拦）
    if (WZ.step === 'device') return WZ.dev && WZ.dev.busy ? '正在检查，等一下' : !WZ.edit && nat('diag') && WZ.dev && verdict(WZ.dev.rows) === 'bad' ? '这台设备现在不合格：按提示处理好再「重新检查」' : '';
    return '';
  }

  // 画面
  function render() {
    const box = $('#su-box'); if (!box) return;
    const F = draft(), self = !WZ.edit && selfPath(F), ps = pages(), i = ps.indexOf(WZ.step), last = i === ps.length - 1, n = self ? i + 1 : NUM[WZ.step];
    const tabNames = self ? (I18N && I18N.raw('su.open.tabs')) || [] : TABS;
    const tabs = WZ.edit ? '' : '<ol class="su-tabs"' + (self ? ' style="grid-template-columns:repeat(' + tabNames.length + ',1fr)"' : '') + '>' + tabNames.map((t, k) => '<li class="' + (k + 1 < n ? 'ok' : k + 1 === n ? 'on' : '') + '"><i>' + '①②③④⑤⑥'[k] + '</i><span>' + t + '</span></li>').join('') + '</ol>';
    // 第一页最上面（只在第一次走向导时）：界面语言、谁来用
    const top = !WZ.edit && WZ.step === 'welcome' ? whoBox(F) : '';
    const body = top + ({ welcome: self ? pWelcomeSelf : pWelcome, pin: pPin, key: pKey, nick: pNick, mons: pMons, fam: pFam, device: pDevice, done: self ? pDoneSelf : pDone })[WZ.step]();
    let nav;
    if (WZ.step === 'done' && self) nav = '<div class="su-nav"><button class="btn ghost" data-act="suBack">' + h('su.back') + '</button><button class="btn sun" data-act="suFinish" data-focus>' + h('su.open.finish') + '</button></div>';
    else if (WZ.step === 'done') nav = '<div class="su-nav"><button class="btn ghost" data-act="suBack">上一步</button><button class="btn sun" data-act="suFinish" data-focus>🎉 把手机交给孩子</button></div>';
    else if (WZ.edit) nav = '<div class="su-nav"><button class="btn ghost" data-act="' + (i > 0 ? 'suBack' : 'suCancel') + '">' + (i > 0 ? '上一步' : '取消') + '</button><button class="btn" data-act="suNext" id="su-next">' + (last ? '保存' : '下一步') + '</button></div>';
    else nav = '<div class="su-nav">' + (i > 0 ? '<button class="btn ghost" data-act="suBack">上一步</button>' : '<span></span>') + '<button class="btn" data-act="suNext" id="su-next"' + (blocked() && WZ.step !== 'nick' ? ' disabled' : '') + '>下一步</button></div>';
    box.innerHTML = '<div class="su-head"><b>' + (WZ.edit ? '🔒 家长设置' : self ? h('su.open.head') : '👪 家长首次设置') + '</b><small>' + (WZ.edit ? '' : self ? h('su.open.head.s') : '这几页请家长来填，大约 5 分钟') + '</small></div>' + tabs +
      '<div class="su-step" data-step="' + WZ.step + '">' + body + '</div>' + nav;
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'su-nick') {
      const r = checkNick(t.value), m = $('#su-nick-msg');
      WZ.nickWarnOk = false;
      if (m) m.innerHTML = !t.value.trim() ? '' : !r.ok ? '<span class="bad">' + esc(r.msg) + '</span>' : r.warn ? nickWarnHTML() : '<span class="ok">✅ App 里叫：' + esc(r.name) + '</span>';
    }
    if (t.id === 'su-key') { WZ.key = Object.assign(WZ.key || {}, { res: null }); const r = $('#su-key-res'); if (r) r.innerHTML = ''; }
  }

  // 第一页最上面：界面语言 + 谁来用（默认「给孩子用」= 原来的家长向导，一步不少）
  function whoBox(F) {
    const self = selfPath(F), ui = I18N ? I18N.lang() : 'zh';
    return '<div class="su-who" id="su-who">' +
      (I18N ? '<b>' + h('su.ui') + '</b><div class="seg">' + I18N.LANGS.map(l => '<button class="' + (l.id === ui ? 'on' : '') + '" data-act="suUi" data-l="' + l.id + '">' + esc(l.name) + '</button>').join('') + '</div>' : '') +
      '<b>' + h('su.who.q') + '</b><div class="seg">' + [['kid', 'su.who.kid'], ['open', 'su.who.open']].map(([m, k]) => '<button class="' + ((self ? 'open' : 'kid') === m ? 'on' : '') + '" data-act="suWho" data-m="' + m + '">' + h(k) + '</button>').join('') + '</div>' +
      '<small class="su-small">' + h(self ? 'su.who.open.note' : 'su.who.kid.note') + '</small></div>';
  }
  // ① 欢迎（我自己学）：AI 说明、隐私要点、本人同意
  function pWelcomeSelf() {
    const F = draft(), on = !!(F.consent && F.consent.v === DOC_V);
    return '<div class="su-hero">🏝️</div><h2>' + h('su.open.title') + '</h2>' +
      '<p class="su-lead">' + h('su.open.lead') + '</p>' +
      '<div class="su-card ai"><b>' + h('su.open.ai.t') + '</b><p>' + h('su.open.ai') + '</p></div>' +
      '<div class="su-card"><b>' + h('su.open.pr.t') + '</b><ul>' + [1, 2, 3, 4].map(k => '<li>' + h('su.open.pr.' + k) + '</li>').join('') + '</ul></div>' +
      '<div class="su-links"><button class="btn small ghost" data-act="suDoc" data-doc="privacy">' + h('su.open.doc') + '</button></div>' +
      '<label class="su-check"><input type="checkbox" id="su-consent" data-act="suConsent"' + (on ? ' checked' : '') + '><span>' + h('su.open.consent') + '</span></label>' +
      '<p class="su-small">' + h('su.open.under') + '</p>';
  }
  // ④ 完成（我自己学）
  function pDoneSelf() {
    const F = draft(), dv = F.device;
    return '<div class="su-hero">🎉</div><h2>' + h('su.open.done.t') + '</h2><ul class="su-sum">' +
      '<li>' + h('su.open.done.key', { v: t(F.keyOk ? 'su.key.ok' : hasKey() ? 'su.key.has' : 'su.key.none') }) + '</li>' +
      '<li>' + h('su.open.done.dev', { v: t(!dv ? 'su.dev.none' : dv.ok === 'ok' ? 'su.dev.ok' : dv.ok === 'warn' ? 'su.dev.warn' : 'su.dev.bad') }) + '</li></ul>' +
      '<p>' + h('su.open.done.p') + '</p>';
  }
  // ① 欢迎
  function pWelcome() {
    const F = draft(), on = !!(F.consent && F.consent.v === DOC_V);
    return '<div class="su-hero">🏝️</div><h2>欢迎使用回声岛</h2>' +
      '<p class="su-lead">回声岛是一个练英语听说的软件：孩子要<b>开口说英语</b>才能让怪兽出招、和岛民聊天。下面几页请<b>家长</b>来设置，设置只存在这台手机里。</p>' +
      '<div class="su-card ai"><b>🤖 关于 AI（人工智能）</b><p>和岛民英语聊天、口语打分，是由<b>人工智能</b>完成的，由<b>阿里云通义千问</b>提供。AI 生成的内容在 App 里都标着「AI 生成」，每段聊天开头还有一句语音提示。AI 只扮演 App 里的角色、只聊岛上的事和日常话题，不会问孩子的真名、学校、住址、电话。</p></div>' +
      '<div class="su-card"><b>🔒 隐私要点</b><ul>' +
      '<li>孩子的存档、昵称、家人设置、聊天记录<b>只存在这台手机里</b>，开发者收不到。</li>' +
      '<li>聊天和口语打分时，孩子说话的<b>声音和识别出来的文字</b>会直接发到阿里云处理，用的是<b>您自己的阿里云账号</b>。开发者收不到，也不跑服务器。</li>' +
      '<li>不收集真名、照片、学校、住址、电话。请给孩子起一个<b>英文昵称</b>（不要用真名），家人只用「Mom」「Dad」这样的称呼。</li>' +
      '<li>家长随时可以看聊天记录（要家长密码），可以在设置里删掉 AI 密钥（就不再连 AI）、清空进度，或者卸载 App 删掉全部数据。</li></ul></div>' +
      '<div class="su-links"><button class="btn small ghost" data-act="suDoc" data-doc="privacy">📄 儿童隐私说明（全文）</button><button class="btn small ghost" data-act="suDoc" data-doc="consent">📄 监护人同意书（全文）</button></div>' +
      '<label class="su-check"><input type="checkbox" id="su-consent" data-act="suConsent"' + (on ? ' checked' : '') + '><span>我是孩子的父母（或其他监护人），已经读过《儿童隐私说明》和《监护人同意书》，<b>单独同意</b>孩子使用 AI 聊天和口语打分（孩子的声音和识别出来的文字会发给阿里云处理）。</span></label>' +
      '<p class="su-small">不同意的话请不要继续，可以联系帮您安装的人办理退款。</p>';
  }

  // ② 家长密码
  const nativePin = () => nat('hasPin');
  function pinHas() {
    if (nativePin()) { try { return !!EchoNative.hasPin(); } catch (e) { return false; } }
    return /^\d{4}$/.test(G.S.settings.pin || '');
  }
  // 太好猜的：4 个一样（1111）、连着的（1234、9876）、常见的几个
  const COMMON_PINS = ['1212', '1122', '1313', '1314', '5201', '5200', '2580', '0852', '1010', '2000', '2020', '6969'];
  const weakPin = v => /^(\d)\1{3}$/.test(v) || '0123456789'.includes(v) || '9876543210'.includes(v) || COMMON_PINS.includes(v);
  function pPin() {
    if (pinHas() && !WZ.pin) {
      return '<div class="su-hero">🔑</div><h2>家长密码</h2><p class="su-done-line">✅ 家长密码已经设好了。</p>' +
        '<p class="su-small">关学习锁、改冒险时间、看聊天记录、换 AI 密钥……都要输它。以后要改：设置 → 🔒 家长设置 → 家长密码。忘了密码：先「💾 导出存档」（不用密码）→ 清除这个 App 的数据 → 重新设置 →「从备份恢复」，进度不会丢。</p>';
    }
    const p = WZ.pin || (WZ.pin = { mode: 'set1', buf: '', first: '', msg: '' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(k => k === 'clr' ? '<button class="pin-k fn" data-act="suPinClr">清除</button>'
      : k === 'del' ? '<button class="pin-k fn" data-act="suPinDel" aria-label="删掉一位">⌫</button>' : '<button class="pin-k" data-act="suPin" data-k="' + k + '">' + k + '</button>').join('');
    return '<div class="su-hero">🔑</div><h2>设一个家长密码</h2>' +
      '<p>关学习锁、改冒险时间、看有安全提示的聊天、换 AI 密钥……都要输这个 4 位数字密码。<b>别告诉孩子</b>，也别用 1234、1111、生日这种好猜的。</p>' +
      '<div class="pin su-pin"><p class="pin-t">' + (p.mode === 'set1' ? '输入 4 位数字的新密码' : '再输一遍，确认一下') + '</p>' +
      '<div class="pin-dots" id="su-pin-dots">' + [0, 1, 2, 3].map(i => '<i class="' + (i < p.buf.length ? 'on' : '') + '">' + (i < p.buf.length ? '●' : '○') + '</i>').join('') + '</div>' +
      '<p class="pin-msg" id="su-pin-msg">' + esc(p.msg) + '</p><div class="pin-pad">' + keys + '</div></div>' +
      '<p class="su-small">密码不会以原文保存：' + (nativePin() ? '手机里只存它加了随机「盐」以后的哈希值，输错 5 次锁 10 分钟。' : '网页版存在这台设备的浏览器里。') + '</p>';
  }
  function pinKey(k) {
    const p = WZ.pin; if (!p || p.buf.length >= 4 || p.busy) return;
    p.buf += k; p.msg = '';
    render();
    if (p.buf.length === 4) { p.busy = true; setTimeout(() => { p.busy = false; pinDone(); }, 150); }
  }
  function pinDone() {
    const p = WZ.pin; if (!p || p.buf.length < 4) return;
    const v = p.buf; p.buf = '';
    if (p.mode === 'set1') {
      if (weakPin(v)) { p.msg = '这个密码太好猜了，换一个吧'; render(); return; }
      p.first = v; p.mode = 'set2'; render(); return;
    }
    if (v !== p.first) { p.mode = 'set1'; p.first = ''; p.msg = '两次不一样，重新设一次'; render(); return; }
    let ok = false;
    if (nativePin()) { try { ok = nat('setPin') && !!EchoNative.setPin(v); } catch (e) { ok = false; } }
    else { G.S.settings.pin = v; G.S.settings.pinLock = { n: 0, until: 0, lockouts: 0 }; ok = true; }
    if (!ok) { p.mode = 'set1'; p.first = ''; p.msg = '密码没存上，再设一次'; render(); return; }
    WZ.pin = null; G.save();
    G.toast('🔑 家长密码设好了，别告诉孩子哦');
    render();
  }

  // ③ AI 密钥
  const KEY_RES = {
    ok: ['ok', '✅ 密钥能用！阿里云已经回答了（这次测试花费不到 0.01 元）。'],
    format: ['bad', '❌ 这不像百炼的 API Key：应该是 sk- 开头的一长串字母和数字。复制的时候别多带空格或中文。'],
    auth: ['bad', '❌ 密钥不对：检查一下是不是复制完整了；不行就在百炼控制台重新创建一个。'],
    quota: ['bad', '💳 阿里云账户欠费或额度用完了：先到阿里云充值（建议先充 20 元），再点「测试」。'],
    inactive: ['bad', '⚠️ 百炼服务（或这个模型）还没开通：在百炼控制台点「开通服务」，再点「测试」。'],
    offline: ['bad', '📶 手机现在没网：连上 Wi-Fi 或流量再点「测试」。'],
    busy: ['warn', '⏳ 阿里云有点忙，等一下再点「测试」。'],
    network: ['bad', '❌ 没连上阿里云：检查网络，过一会儿再试。'],
    nonative: ['warn', 'ℹ️ 网页版不能在这里填密钥（安卓 App 里才能用）。'],
  };
  const hasKey = () => { try { return nat('hasKey') && !!EchoNative.hasKey(); } catch (e) { return false; } };
  function pKey() {
    const F = draft(), k = WZ.key || (WZ.key = { res: null, busy: false }), had = hasKey();
    const res = k.res ? KEY_RES[k.res.why] || KEY_RES.network : null;
    return '<div class="su-hero">🗝️</div><h2>粘贴您的 AI 密钥</h2>' +
      '<p>AI 聊天和口语打分用的是<b>您自己的阿里云百炼账号</b>：费用由阿里云直接向您收（每天练 15 分钟左右，每月大约 15–21 元），开发者碰不到您的密钥，也收不到孩子的声音。</p>' +
      '<button class="btn small ghost su-guide" data-act="suDoc" data-doc="guide">❓ 怎么开通？（图文步骤）</button>' +
      (had && !k.res ? '<p class="su-done-line">✅ 这台手机里已经有密钥了' + (F.keyOk ? '（' + esc(F.keyOk) + ' 测试通过）' : '') + '。要换就在下面粘贴新的。</p>' : '') +
      '<div class="su-key"><input id="su-key" class="txt-in" type="password" placeholder="sk- 开头的一长串" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="btn" data-act="suKeyTest" id="su-key-test"' + (k.busy ? ' disabled' : '') + '>' + (k.busy ? '测试中…' : '测试') + '</button></div>' +
      '<label class="su-check small"><input type="checkbox" data-act="suKeyShow"><span>显示密钥</span></label>' +
      '<div class="su-res" id="su-key-res">' + (res ? '<p class="' + res[0] + '">' + res[1] + '</p>' + (k.res.raw && !k.res.ok ? '<p class="su-raw">阿里云说：' + esc(k.res.raw) + '</p>' : '') : '') + '</div>' +
      '<p class="su-small">密钥只存在这台手机里（安卓给这个 App 的私有空间），App 的界面读不回来，也不会发给开发者。以后在「设置 → 🔒 家长设置 → AI 聊天和口语打分」能换。请在阿里云设好<b>费用预警</b>。</p>' +
      (WZ.edit ? '' : '<button class="su-skip" data-act="suKeySkip">先跳过（没有密钥时：口语题不能自动打分，也不能和岛民聊天）</button>');
  }
  async function keyTest() {
    const inp = $('#su-key'), v = inp ? inp.value.trim() : '', k = WZ.key || (WZ.key = {});
    if (k.busy) return;
    if (!window.EchoTalk || !EchoTalk.keyTest) { k.res = { why: 'nonative' }; render(); return; }
    k.busy = true; k.res = null; render();
    const ni = $('#su-key'); if (ni) ni.value = v;
    let r;
    try { r = await EchoTalk.keyTest(v); } catch (e) { r = { ok: false, why: 'network', raw: '' }; }
    k.busy = false; k.res = r;
    if (r.ok) { const F = draft(); F.keyOk = G.dayStr(); G.save(); if (G.aiReset) G.aiReset(); }
    if (!$('#setup')) return;
    render();
    const ni2 = $('#su-key'); if (ni2 && !r.ok) ni2.value = v;   // 不对：留着让家长改（对了就清掉，屏幕上不留密钥）
  }

  // ④-1 昵称和形象
  function nickWarnHTML() {
    return '<span class="warn">⚠️ 这个看起来像中文名字的拼音。岛民会用它叫孩子、也会说给 AI 听：请换一个英文昵称（比如 Kevin、Coco）。</span>' +
      '<label class="su-check small"><input type="checkbox" data-act="suNickOk"' + (WZ.nickWarnOk ? ' checked' : '') + '><span>这不是孩子的真名，就用它</span></label>';
  }
  function saveNick() {
    const i = $('#su-nick'); if (!i) return;
    const r = checkNick(i.value); if (r.ok) { draft().nick = r.name; G.save(); }
  }
  function pNick() {
    const F = draft(), a = F.avatar, look = avatarLook(a), r = F.nick ? checkNick(F.nick) : null;
    const sw = (part, list) => list.map((c, k) => '<button class="su-sw' + (a[part] === k ? ' on' : '') + '" data-act="suPart" data-p="' + part + '" data-v="' + k + '" style="--c:' + c + '" aria-label="' + part + ' ' + (k + 1) + '"></button>').join('');
    const seg = (part, list) => list.map(([v, t]) => '<button class="' + (a[part] === v ? 'on' : '') + '" data-act="suPart" data-p="' + part + '" data-v="' + v + '">' + t + '</button>').join('');
    return '<h2>⑤ 家庭定制 1/3：孩子在 App 里的样子</h2>' +
      '<label class="su-lbl" for="su-nick">英文昵称</label><input id="su-nick" class="txt-in" maxlength="12" placeholder="比如 Kevin、Coco" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(F.nick) + '">' +
      '<p class="su-small">岛民会用这个名字叫孩子，也会说给 AI 听：<b>请用英文昵称，不要用真名</b>。只能用英文字母。</p>' +
      '<div class="su-msg" id="su-nick-msg">' + (r && r.ok ? (r.warn ? nickWarnHTML() : '<span class="ok">✅ App 里叫：' + esc(r.name) + '</span>') : '') + '</div>' +
      '<div class="su-av"><img class="su-av-img" id="su-av-img" alt="主角预览" src="' + (P ? P.standing(look, 120, 170) : '') + '">' +
      '<div class="su-parts">' +
      '<div class="su-row"><span>男孩 / 女孩</span><div class="seg">' + seg('g', [['boy', '男孩'], ['girl', '女孩']]) + '</div></div>' +
      '<div class="su-row"><span>肤色</span><div class="su-sws">' + sw('skin', SKINS) + '</div></div>' +
      '<div class="su-row"><span>发型</span><div class="seg wrap">' + seg('style', STYLES) + '</div></div>' +
      '<div class="su-row"><span>发色</span><div class="su-sws">' + sw('hair', HAIRS) + '</div></div>' +
      '<div class="su-row"><span>衣服</span><div class="su-sws">' + sw('cloth', CLOTHES) + '</div></div>' +
      '<div class="su-row"><span>帽子</span><div class="seg">' + seg('hat', HATS) + '</div></div>' +
      '</div></div>';
  }
  function setPart(t) {
    saveNick();
    const F = draft(), a = F.avatar, p = t.dataset.p, v = t.dataset.v;
    if (p === 'g') { a.g = v === 'girl' ? 'girl' : 'boy'; if (!a.styleSet) a.style = a.g === 'girl' ? 'ponytail' : 'spiky'; if (!a.hatSet) a.hat = a.g === 'girl' ? 'band' : 'cap'; }
    else if (p === 'style' || p === 'hat') { a[p] = v; a[p + 'Set'] = 1; }
    else a[p] = +v;
    G.save(); render();
  }

  // ④-2 伙伴
  function pMons() {
    const F = draft(), n = F.starters.length, lib = library();
    const groups = LIB_TYPES.map(t => {
      const ms = lib.filter(s => s.type === t);
      return ms.length ? '<h3 class="su-h3">' + TYPE_ZH[t] + '</h3><div class="su-mons">' + ms.map(s => {
        const on = F.starters.includes(s.id);
        return '<button class="su-mon' + (on ? ' on' : '') + '" data-act="suMon" data-id="' + esc(s.id) + '"' + (!on && n >= 3 ? ' disabled' : '') + '>' + monImg(s) + '<b>' + esc(s.en) + '</b><small>' + esc(s.zh) + '</small></button>';
      }).join('') + '</div>' : '';
    }).join('');
    return '<h2>⑤ 家庭定制 2/3：挑 3 只伙伴</h2>' +
      '<p>孩子开始冒险时，回声博士请孩子从三个贝壳里挑一只当第一个伙伴，贝壳里就是这 3 只（别的也能在野外遇到）。最好挑 3 种不同的属性。</p>' +
      '<p class="su-count" id="su-count">已选 <b>' + n + '</b> / 3' + (n ? '：' + F.starters.map(id => esc((D.byId[id] || {}).en || id)).join('、') : '') + '</p>' + groups;
  }
  function pickMon(id) {
    const F = draft(), i = F.starters.indexOf(id);
    if (i >= 0) F.starters.splice(i, 1);
    else if (F.starters.length < 3 && libOk(id)) F.starters.push(id);
    G.save();
    const box = $('#su-box'), y = box ? box.scrollTop : 0;
    render();
    if (box) box.scrollTop = y;
  }

  // ④-3 家里的人
  function pFam() {
    const F = draft(), ms = F.members, has = new Set(ms.map(m => m.rel));
    const chips = RELS.map(r => '<button class="btn small ' + (has.has(r.rel) ? '' : 'ghost') + '" data-act="suFamAdd" data-rel="' + r.rel + '"' + (has.has(r.rel) || ms.length >= MEM_MAX ? ' disabled' : '') + '>' + (has.has(r.rel) ? '✓ ' : '＋ ') + r.call + ' <small>' + r.zh + '</small></button>').join('');
    const list = ms.map((m, i) => {
      const r = RBY[m.rel]; if (!r) return '';
      return '<div class="su-mem"><div class="su-mem-h"><b>' + r.call + '</b> <small>' + r.zh + '</small><button class="su-x" data-act="suFamDel" data-i="' + i + '" aria-label="去掉">✕</button></div>' +
        '<div class="su-looks">' + r.looks.map((l, k) => '<button class="su-look' + ((m.look || 0) === k ? ' on' : '') + '" data-act="suFamLook" data-i="' + i + '" data-v="' + k + '"><img alt="造型 ' + (k + 1) + '" src="' + (P ? P.standing(l, 72, 102) : '') + '"></button>').join('') + '</div></div>';
    }).join('');
    return '<h2>⑤ 家庭定制 3/3：家里的人</h2>' +
      '<p>选几位家人放进 App 里你好岛的家（最多 ' + MEM_MAX + ' 位，也可以不选）。孩子回家时能和他们说话，他们会鼓励孩子说英语、帮怪兽恢复体力。App 里只用英文称呼，造型从下面挑，<b>不用照片</b>。</p>' +
      '<div class="su-chips">' + chips + '</div>' + (list ? '<div class="su-mems">' + list + '</div>' : '<p class="su-small">没选的话，家里就是默认的妈妈。</p>');
  }

  // ② 设备检查：安卓版本、WebView、WebGL2、剩余空间、麦克风（第二步：合格了才付款，不合格不收钱）
  // 每一行 { k, ok: true 合格 / false 不合格 / null 看不到, warn: 能用但有问题, label, val, tip }。必须合格的：安卓版本、剩余空间、麦克风
  async function deviceCheck() {
    const d = WZ.dev = { busy: true, rows: [] }, rows = d.rows;
    render();
    let dg = {}; try { if (nat('diag')) dg = JSON.parse(EchoNative.diag() || '{}') || {}; } catch (e) { dg = {}; }
    const sdk = +dg.sdk || 0;
    rows.push({ k: 'android', label: '安卓系统', ok: sdk ? sdk >= 26 : null, val: dg.android ? '安卓 ' + dg.android + '（API ' + sdk + '）' : '网页版看不到',
      tip: sdk && sdk < 26 ? '要安卓 8.0 以上' : sdk && sdk < 29 ? '能用；安卓 9 及以下第一次备份存档时会问「存储」权限' : '' });
    const wv = String(dg.webview || ''), m = (wv.match(/^(\d+)\./) || (navigator.userAgent.match(/Chrome\/(\d+)/) || []))[1], major = +m || 0;
    rows.push({ k: 'webview', label: '系统浏览器内核（WebView）', ok: major ? major >= 105 : null, warn: true, val: major ? '版本 ' + major : '看不出版本',
      tip: major && major < 105 ? '版本太老，部分画面会不正常：请在应用商店更新「Android System WebView」' : '' });
    let gl = false;
    try { const c = document.createElement('canvas'); gl = !!c.getContext('webgl2'); } catch (e) { gl = false; }
    rows.push({ k: 'webgl2', label: '3D 画面（WebGL2）', ok: gl, warn: true, val: gl ? '支持' : '不支持', tip: gl ? '' : '能玩，但冒险画面只能用「2D 流畅」' });
    let st = null; try { if (nat('storage')) st = JSON.parse(EchoNative.storage() || '{}') || null; } catch (e) { st = null; }
    const free = st && +st.free;
    rows.push({ k: 'storage', label: '剩余空间', ok: free ? free >= 1e9 : null, val: free ? (free / 1e9).toFixed(1) + ' GB' + (st.ram ? ' · 内存 ' + Math.round(st.ram / 1073741824) + ' GB' : '') : '网页版看不到',
      tip: free && free < 1e9 ? '至少要留 1 GB：先删掉一些不用的 App、照片或视频' : '' });
    render();
    rows.push(await micRow());
    d.busy = false;
    const F = draft();
    F.device = { at: Date.now(), ok: verdict(rows), rows: rows.map(r => ({ k: r.k, ok: r.ok })) };
    G.save();
    if (WZ.dev === d) render();
  }
  async function micRow() {
    const row = { k: 'mic', label: '麦克风', ok: false, val: '', tip: '' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Object.assign(row, { ok: null, val: '这个浏览器不能用麦克风' });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      try { s.getTracks().forEach(t => t.stop()); } catch (e) { /* 忽略 */ }
      return Object.assign(row, { ok: true, val: '可以用' });
    } catch (e) {
      let st = ''; try { if (nat('micPermission')) st = String(EchoNative.micPermission() || ''); } catch (er) { st = ''; }
      return Object.assign(row, { ok: false, val: st === 'blocked' ? '被永久拒绝了' : '没允许', fix: nat('openAppSettings'),
        tip: st === 'blocked' ? '点「去打开」→「权限」→「麦克风」→ 选「允许」，回来再点「重新检查」' : '手机问「允许使用麦克风吗」时要点「允许」，再点「重新检查」' });
    }
  }
  // 结论：必须的（安卓、空间、麦克风）有一项不合格 = bad；只是 WebView / WebGL2 不行 = warn；都好 = ok
  function verdict(rows) {
    if (rows.some(r => !r.warn && r.ok === false)) return 'bad';
    if (rows.some(r => r.warn && r.ok === false)) return 'warn';
    return 'ok';
  }
  function pDevice() {
    const d = WZ.dev, rows = d ? d.rows : [];
    const icon = r => r.ok === true ? '✅' : r.ok === null ? '➖' : r.warn ? '⚠️' : '❌';
    const v = d && !d.busy ? verdict(rows) : '';
    return '<div class="su-hero">🩺</div><h2>② 设备检查</h2>' +
      '<p>看看这台手机能不能顺利玩。iPhone、iPad、纯血鸿蒙、锁了安装的学习机装不上这个 App——能看到这一页，说明已经装上了。</p>' +
      '<ul class="su-dev">' + rows.map(r => '<li class="' + (r.ok === true ? 'ok' : r.ok === null ? 'na' : r.warn ? 'warn' : 'bad') + '" data-k="' + r.k + '"><i>' + icon(r) + '</i><div><b>' + esc(r.label) + '</b><span>' + esc(r.val) + '</span>' +
        (r.tip ? '<small>' + esc(r.tip) + '</small>' : '') + (r.fix && r.ok === false ? '<button class="btn small" data-act="suMicFix">⚙️ 去打开</button>' : '') + '</div></li>').join('') +
      (d && d.busy ? '<li class="na"><i>⏳</i><div><b>正在检查……</b>' + (rows.length >= 4 ? '<span>手机问「允许使用麦克风吗」时请点「允许」</span>' : '') + '</div></li>' : '') + '</ul>' +
      (v ? '<div class="su-verdict ' + v + '" id="su-verdict">' + (v === 'ok' ? '✅ 这台设备合格，可以放心用' : v === 'warn' ? '⚠️ 能用，但有一项不太好（见上面）' : '❌ 这台设备现在不合格：按上面的提示处理后点「重新检查」；处理不了请把这一页截图发给帮您安装的人（不合格不收费）') + '</div>' +
        (v !== 'bad' && !WZ.edit && !selfPath(prof()) ? '<p class="su-small su-pay">合格了：如果还没付款，帮您安装的人这时会把付款链接发给您。付好以后点「下一步」，接着设家长密码和 AI 密钥（这两步请您自己输入，远程协助时先暂停屏幕共享）。</p>' : '') : '') +
      '<button class="btn small ghost" data-act="suDevRun"' + (d && d.busy ? ' disabled' : '') + '>🔄 重新检查</button>';
  }

  // ⑥ 完成
  function pDone() {
    const F = draft(), ms = members(F), dv = F.device;
    const nick = F.nick ? checkNick(F.nick).name : '';
    return '<div class="su-hero">🎉</div><h2>设置好了！</h2><ul class="su-sum">' +
      '<li>🔑 家长密码：' + (pinHas() ? '已设好' : '<b class="bad">还没设</b>') + '</li>' +
      '<li>🗝️ AI 密钥：' + (F.keyOk ? '测试通过' : hasKey() ? '已粘贴（还没测试通过）' : '<b class="bad">还没有</b>（口语不能自动打分，也不能聊天）') + '</li>' +
      '<li>🙂 孩子在 App 里叫：<b>' + esc(nick || '（开场时再起）') + '</b></li>' +
      '<li>🐾 伙伴：' + (F.starters.length === 3 ? F.starters.map(id => esc((D.byId[id] || {}).en || id)).join('、') : '默认的 3 只') + '</li>' +
      '<li>👪 家里的人：' + (ms.length ? ms.map(m => m.call).join('、') : '默认的妈妈') + '</li>' +
      '<li>🩺 设备检查：' + (!dv ? '没做' : dv.ok === 'ok' ? '合格' : dv.ok === 'warn' ? '能玩（有一项不太好）' : '<b class="bad">不合格</b>') + '</li></ul>' +
      '<p>现在把手机交给孩子吧！以后要改，在「设置 → 🔒 家长设置」里（要家长密码）。</p>';
  }
  function finish() {
    const F = draft(), self = selfPath(F);
    if (!self && !pinHas()) { G.toast('请先设好家长密码'); go('pin'); return; }
    if (!(F.consent && F.consent.v === DOC_V)) { go('welcome'); return; }
    F.done = G.dayStr(); F.step = 'done';
    if (self) G.S.settings.learner = 'open';   // 我自己学：没有学习锁、不限时、不要家长密码（game.js 的 kidMode）
    apply(true);
    // 家长这边测试过密钥、麦克风也能用：孩子不用再做「说一句 Hello」的小检查
    const mic = F.device && (F.device.rows || []).find(r => r.k === 'mic');
    if (F.keyOk && mic && mic.ok) G.S.micCheck = G.dayStr();
    G.save();
    close();
    if (G.afterSetup) G.afterSetup();
  }
  function saveEdit() {
    const F = draft();
    if (WZ.step === 'fam' || WZ.edit.includes('nick')) { saveNick(); apply(true); }
    G.save(); close();
    G.toast('✅ 保存好了');
    if (G.afterEdit) G.afterEdit();
  }

  // ---------- 家庭定制在 App 里生效 ----------
  // setName：把昵称、性别写进存档（向导做完、改了家庭定制时）；平时打开 App 只在存档里还没有名字时补上
  function apply(setName) {
    if (!sales() || !G) return;
    const F = prof(); if (!F) return;
    if (!F.done && !setName) return;
    // 我自己学：没有家庭定制——主角造型、博士的包都是默认的，名字和样子在开场自己选
    if (selfPath(F)) { applyLook(null); const M0 = window.MonsterGame; if (M0 && M0.STARTERS && BASE_STARTERS.length) M0.STARTERS.splice(0, M0.STARTERS.length, ...BASE_STARTERS); return; }
    applyLook(F);
    const MG = window.MonsterGame;
    if (MG && MG.STARTERS) {
      const want = (F.starters || []).length === 3 && F.starters.every(libOk) ? F.starters : BASE_STARTERS;
      MG.STARTERS.splice(0, MG.STARTERS.length, ...want);
    }
    const S = G.S; S.player = S.player || {};
    const nk = F.nick ? checkNick(F.nick) : null;
    if (nk && nk.ok && (setName || !S.player.name)) S.player.name = nk.name;
    if (F.avatar && (setName || !S.player.gender)) S.player.gender = F.avatar.g === 'girl' ? 'girl' : 'boy';
  }

  // 你好岛的家（i0H）：家里本来那位（role 'house'）换成挑的家人，其余的人站在屋里；开场剧情换成认得孩子昵称的版本
  function spawnFamily(C, F) {
    const house = houseOf(F), M = C.map;
    const rest = members(F).filter(m => !house || m.rel !== house.rel);
    const taken = new Set(M.npcs.map(n => n.x + ',' + n.y)); taken.add(C.pl.x + ',' + C.pl.y);
    const door = []; for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (/[e^]/.test(C.tile(x, y))) door.push([x, y]);
    const nearDoor = (x, y) => door.some(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y) <= 1);
    const free = (x, y) => C.tile(x, y) === '_' && !taken.has(x + ',' + y) && !nearDoor(x, y);
    const pref = [[1, 4], [7, 5], [2, 6], [7, 3], [1, 2], [5, 5]].filter(([x, y]) => free(x, y));
    const all = []; for (let y = 1; y < M.H - 1; y++) for (let x = 1; x < M.W - 1; x++) if (free(x, y) && !pref.some(p => p[0] === x && p[1] === y)) all.push([x, y]);
    const spots = pref.concat(all);
    rest.forEach(m => {
      if (C.npc(n => n.fam === m.rel)) return;
      const at = spots.find(([x, y]) => !taken.has(x + ',' + y)); if (!at) return;
      taken.add(at[0] + ',' + at[1]);
      C.spawn({ id: 'fam-' + m.rel, fam: m.rel, role: 'fam', look: m.look, name: m.call, g: m.g, x: at[0], y: at[1], face: 'down' });
    });
  }
  const needSpawn = (C, F) => { const h = houseOf(F); return members(F).some(m => (!h || m.rel !== h.rel) && !C.npc(n => n.fam === m.rel)); };
  const LINES = {
    dad: [["Hi, {name}! I'm proud of you.", '嗨，{name}！爸爸为你骄傲。'], ['Speak English every day, and you will get better and better!', '每天说英语，你会越来越棒！']],
    mom: [['Hi, {name}! I love hearing you speak English.', '嗨，{name}！妈妈最喜欢听你说英语了。'], ['Have fun, and be careful out there!', '玩得开心，出门注意安全！']],
    grandma: [['Oh, {name}! Come and have some fruit.', '哎呀，{name}！快来吃点水果。'], ['Go slowly and be careful on your journey!', '路上慢慢走，注意安全！']],
    grandpa: [['{name}, a little every day makes a big difference.', '{name}，每天进步一点点，日积月累就很了不起。'], ['Say hello to the monsters for me!', '替我向怪兽们问好！']],
    brother: [["Hey, {name}! Let's have a monster battle one day!", '嘿，{name}！哪天我们来一场怪兽对战吧！'], ["Don't forget to practice your English!", '别忘了练英语哦！']],
    sister: [['Hi, {name}! Can you teach me some English words?', '嗨，{name}！你能教我几个英语单词吗？'], ['Good luck on your adventure!', '冒险加油！']],
  };
  const sayer = m => (en, zh, x) => Object.assign({ who: m.call, look: m.look, g: m.g, en, zh }, x || {});
  async function famTalk(C, n, m, house) {
    const s = sayer(m), E = C.E;
    C.faceEach(n);
    if (house && !C.flag('starter')) { await C.talk([s('Professor Echo lives next door. Go and say hello!', '回声博士就住在隔壁，快去打个招呼吧！')]); return; }
    let pages;
    if (house) {
      pages = [
        s('Welcome home, {name}! You look tired.', '欢迎回家，{name}！你看起来累了。'),
        s('Let your monsters have a good rest.', '让你的怪兽们好好休息一下吧。', { onShow: () => { C.MG.healAll(); E.SFX.win(); E.toast('💖 怪兽们的体力都恢复了', 'gold'); } }),
        s("Don't forget to eat well and sleep early!", '记得好好吃饭，早点睡觉！'),
      ];
    } else pages = (LINES[m.rel] || LINES.dad).map(([en, zh]) => s(en, zh));
    // 每位家人每天一次：对他说一句英语
    if (C.daily && C.daily('fam:' + m.rel)) {
      const line = 'I love you, ' + m.call + '!';
      pages.push({ who: '{name}', look: C.plook(), g: E.S.player && E.S.player.gender === 'girl' ? 'f' : 'm', en: line, zh: '对' + m.zh.split(' ')[0] + '说：' + line, kind: 'speak', target: line });
      pages.push(s('I love you too, {name}!', '我也爱你，{name}！'));
    }
    await C.talk(pages);
  }
  // 开场：和 story.js 的一样是「渡轮上的小岛通行证」，只是家长已经填好了昵称和样子（不用再选照片、起名字），由家里的人陪着；然后在家里醒来
  async function familyWake(C, F) {
    const E = C.E, L = window.EchoStory.lib, sc = C.scene(), house = houseOf(F);
    apply(false);
    spawnFamily(C, F);
    const s = house ? sayer(house) : L.mom, look = house ? house.look : P.LOOKS.mom;
    sc.className = 'w-scene intro'; sc.hidden = false;
    const mon = C.MG.species(C.MG.STARTERS[1] || 'bubbly') || C.MG.species('bubbly');
    sc.innerHTML = '<div class="in-light"></div><img class="in-prof" alt="" src="' + P.standing(look, 240, 330) + '"><div class="in-mon" id="in-mon">' + (window.Cartoon && mon ? Cartoon.monster(mon) : '') + '</div>';
    await C.wait(400);
    await C.talk([
      L.nar('A little ferry is sailing to Hello Island.', '一艘小渡轮正开往你好岛。'),
      s('Look, {name}! That green island is our new home!', '快看，{name}！那座绿绿的小岛就是我们的新家！'),
      s('People there talk with monsters in English.', '岛上的人用英语和怪兽说话。', { onShow: () => { const m = document.getElementById('in-mon'); if (m) m.classList.add('on'); } }),
      s('Here is your Island Pass. Read it out loud!', '这是你的小岛通行证，大声念出来吧！'),
      s('Read your pass: "My name is {name}."', '念一念通行证：My name is {name}.', { kind: 'speak', target: 'My name is {name}.' }),
      s('Great! Welcome to Hello Island, {name}!', '真棒！欢迎来到你好岛，{name}！'),
    ]);
    sc.classList.add('out');
    await C.wait(700);
    sc.hidden = true; sc.className = 'w-scene'; sc.innerHTML = '';
    const h = C.npc(n => n.role === 'house');
    await C.wait(300);
    if (h) { C.face(h, 'up'); C.facePlayer('down'); }
    await C.talk([
      s('Good morning, {name}! Did you sleep well in our new home?', '早上好，{name}！在新家睡得好吗？'),
      s('Our neighbour is Professor Echo. Go and say hello!', '我们的邻居是回声博士，快去打个招呼吧！'),
      s('Walk to the red mat and go outside.', '走到门口的红地垫，就能出门啦。'),
    ]);
    C.set('intro'); C.set('mom');
    E.save();
  }
  function hookStory() {
    const ST = window.EchoStory;
    if (!ST || ST._family) return;
    ST._family = true;
    const enter0 = ST.enter, talk0 = ST.talk, look0 = ST.look;
    ST.enter = function (C, how) {
      const F = famOn();
      if (F && C.map.id === 'i0H') {
        if (!C.MG.leadSpecies() && !C.flag('intro')) return () => familyWake(C, F);
        const r = enter0.apply(this, arguments);
        if (r) return async () => { spawnFamily(C, F); await r(); };
        return needSpawn(C, F) ? () => spawnFamily(C, F) : null;
      }
      return enter0.apply(this, arguments);
    };
    ST.talk = function (C, n) {
      const F = famOn();
      if (F && n && n.fam) { const m = members(F).find(x => x.rel === n.fam); if (m) return () => famTalk(C, n, m, false); }
      if (F && C.map.id === 'i0H' && n && n.role === 'house') { const h = houseOf(F); if (h) return () => famTalk(C, n, h, true); }
      return talk0.apply(this, arguments);
    };
    ST.look = function (C, n) {
      const F = famOn();
      if (F && C.map.id === 'i0H' && n && n.role === 'house') { const h = houseOf(F); if (h) return { name: h.call, g: h.g, look: h.look }; }
      return look0.apply(this, arguments);
    };
  }

  // ---------- 给 game.js ----------
  function init(api) {
    G = api;
    if (sales()) hookStory();
    return {
      suNext: () => next(),
      suBack: () => back(),
      suCancel: () => close(),
      suConsent: t => { const F = draft(); F.consent = t.checked ? { at: Date.now(), v: DOC_V } : null; G.save(); const b = $('#su-next'); if (b) b.disabled = !t.checked; },
      // 第一页：谁来用（换了就要重新勾同意：两条路的同意书说的不是一回事）、界面语言
      suWho: el => { if (WZ.edit || WZ.step !== 'welcome') return; const F = draft(), m = el.dataset.m === 'open' ? 'open' : 'kid'; if ((F.who || 'kid') === m) return; F.who = m; F.consent = null; G.save(); render(); },
      suUi: el => { if (G.setUi) G.setUi(el.dataset.l); render(); },
      suDoc: t => openDoc(t.dataset.doc),
      suDocClose: () => closeDoc(),
      suPin: t => pinKey(t.dataset.k),
      suPinDel: () => { if (WZ.pin) { WZ.pin.buf = WZ.pin.buf.slice(0, -1); render(); } },
      suPinClr: () => { if (WZ.pin) { WZ.pin.buf = ''; render(); } },
      suKeyTest: () => keyTest(),
      suKeyShow: t => { const i = $('#su-key'); if (i) i.type = t.checked ? 'text' : 'password'; },
      suKeySkip: () => { go(pages()[pages().indexOf('key') + 1]); },
      suNickOk: t => { WZ.nickWarnOk = !!t.checked; },
      suPart: t => setPart(t),
      suMon: t => pickMon(t.dataset.id),
      suFamAdd: t => { const F = draft(); if (F.members.length < MEM_MAX && RBY[t.dataset.rel] && !F.members.some(m => m.rel === t.dataset.rel)) { F.members.push({ rel: t.dataset.rel, look: 0 }); G.save(); render(); } },
      suFamDel: t => { const F = draft(); F.members.splice(+t.dataset.i, 1); G.save(); render(); },
      suFamLook: t => { const F = draft(), m = F.members[+t.dataset.i]; if (m) { m.look = +t.dataset.v; G.save(); render(); } },
      suDevRun: () => deviceCheck(),
      suMicFix: () => { try { EchoNative.openAppSettings(); } catch (e) { /* 忽略 */ } },
      suFinish: () => finish(),
      // 设置里（家长设置）：改家庭定制、再做一次设备检查；所有版本都能看开源许可
      suFamily: () => G.parentOk('改家庭定制', () => { G.closeModal(); open('nick', true); }),
      suDevice: () => { G.closeModal(); open('device', true); },
    };
  }
  // 安卓返回键：先关文书，再在向导里退一页（第一页不退出：向导必须做完）
  function onBack() {
    if (closeDoc()) return true;
    if (!isOpen()) return false;
    back();
    return true;
  }
  window.EchoSetup = {
    init, open, close, needed, apply, sales, back: onBack, isOpen, openDoc, closeDoc, library, checkNick, avatarLook, members: () => { const F = famOn(); return F ? members(F) : []; },
    RELS, DOCS, DOC_V,
  };
})();
