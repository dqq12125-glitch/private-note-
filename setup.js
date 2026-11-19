// 销售版：家长首次设置向导 + 家庭定制（window.EchoSetup）
// 只在销售版（dex.js 的 DEX.sales：APK 原生桥 EchoNative.edition() === 'sales'，测试用 ?edition=sales）出现。
// 家长在远程协助安装时做一遍（评估「必须改」第 3、4、5、8、10 条），全部只存在这台手机里：
//   ① 欢迎 + AI 说明 + 隐私要点 + 监护人单独同意（全文在 pages/privacy.html、pages/consent.html）
//   ② 设备检查（安卓版本、WebView、WebGL2、剩余空间 ≥1GB、麦克风；iPhone 版是 iOS 版本 ≥18.4 和机型、WebGL2、空间、麦克风）——放在最前面：不合格就停在这里，「不过不收钱」（销售流程 00 号第 7–8 步：查完合格再付款）
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
  // [标题的字表键, 文件]（全文页只有中文）
  const DOCS = {
    privacy: ['su.doc.privacy', 'pages/privacy.html'],
    consent: ['su.doc.consent', 'pages/consent.html'],
    guide: ['su.doc.guide', 'pages/bailian-guide.html'],
    licenses: ['su.doc.licenses', 'pages/licenses.html'],
  };
  function openDoc(k) {
    const d = DOCS[k]; if (!d) return;
    closeDoc();
    const el = document.createElement('div');
    el.id = 'su-doc'; el.className = 'su-doc';
    el.innerHTML = '<div class="su-doc-bar"><b>' + h(d[0]) + '</b><button class="btn small" data-act="suDocClose">' + h('su.close') + '</button></div><iframe src="' + d[1] + '" title="' + h(d[0]) + '"></iframe>';
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
      // ---- 2026-11-19 搬进来的：给孩子用的家长向导（原来写在下面各页里） ----
      'su.doc.privacy': '儿童隐私说明', 'su.doc.consent': '监护人同意书', 'su.doc.guide': '怎么开通阿里云百炼、拿到 API Key', 'su.doc.licenses': '开源许可与致谢',
      'su.close': '关闭', 'su.next': '下一步', 'su.cancel': '取消', 'su.save': '保存', 'su.saved': '✅ 保存好了', 'su.sep': '、',
      'su.tabs': ['欢迎', '设备检查', '家长密码', 'AI 密钥', '家庭定制', '完成'],
      'su.kid.head': '👪 家长首次设置', 'su.kid.head.s': '这几页请家长来填，大约 5 分钟', 'su.edit.head': '🔒 家长设置',
      'su.kid.finish': '🎉 把手机交给孩子',
      'su.kid.lead': '回声岛是一个练英语听说的软件：孩子要<b>开口说英语</b>才能让怪兽出招、和岛民聊天。下面几页请<b>家长</b>来设置，设置只存在这台手机里。',
      'su.kid.ai': '和岛民英语聊天、口语打分，是由<b>人工智能</b>完成的，由<b>阿里云通义千问</b>提供。AI 生成的内容在 App 里都标着「AI 生成」，每段聊天开头还有一句语音提示。AI 只扮演 App 里的角色、只聊岛上的事和日常话题，不会问孩子的真名、学校、住址、电话。',
      'su.kid.pr.1': '孩子的存档、昵称、家人设置、聊天记录<b>只存在这台手机里</b>，开发者收不到。',
      'su.kid.pr.2': '聊天和口语打分时，孩子说话的<b>声音和识别出来的文字</b>会直接发到阿里云处理，用的是<b>您自己的阿里云账号</b>。开发者收不到，也不跑服务器。',
      'su.kid.pr.3': '不收集真名、照片、学校、住址、电话。请给孩子起一个<b>英文昵称</b>（不要用真名），家人只用「Mom」「Dad」这样的称呼。',
      'su.kid.pr.4': '家长随时可以看聊天记录（要家长密码），可以在设置里删掉 AI 密钥（就不再连 AI）、清空进度，或者卸载 App 删掉全部数据。',
      'su.kid.doc.privacy': '📄 儿童隐私说明（全文）', 'su.kid.doc.consent': '📄 监护人同意书（全文）',
      'su.kid.consent': '我是孩子的父母（或其他监护人），已经读过《儿童隐私说明》和《监护人同意书》，<b>单独同意</b>孩子使用 AI 聊天和口语打分（孩子的声音和识别出来的文字会发给阿里云处理）。',
      'su.kid.under': '不同意的话请不要继续，可以联系帮您安装的人办理退款。',
      'su.need.pin': '请先设好家长密码', 'su.need.nick': '这个昵称像真名，请换一个，或者勾选「这不是孩子的真名」', 'su.need.mons': '请选 3 只伙伴（现在选了 {n} 只）',
      'su.pin.t.done': '家长密码', 'su.pin.done': '✅ 家长密码已经设好了。',
      'su.pin.done.p': '关学习锁、改冒险时间、看聊天记录、换 AI 密钥……都要输它。以后要改：设置 → 🔒 家长设置 → 家长密码。忘了密码：先「💾 导出存档」（不用密码）→ 清除这个 App 的数据 → 重新设置 →「从备份恢复」，进度不会丢。',
      'su.pin.clear': '清除', 'su.pin.del': '删掉一位', 'su.pin.title': '设一个家长密码',
      'su.pin.p': '关学习锁、改冒险时间、看有安全提示的聊天、换 AI 密钥……都要输这个 4 位数字密码。<b>别告诉孩子</b>，也别用 1234、1111、生日这种好猜的。',
      'su.pin.new': '输入 4 位数字的新密码', 'su.pin.again': '再输一遍，确认一下',
      'su.pin.store': '密码不会以原文保存：{how}', 'su.pin.store.native': '手机里只存它加了随机「盐」以后的哈希值，输错 5 次锁 10 分钟。', 'su.pin.store.web': '网页版存在这台设备的浏览器里。',
      'su.pin.weak': '这个密码太好猜了，换一个吧', 'su.pin.diff': '两次不一样，重新设一次', 'su.pin.fail': '密码没存上，再设一次', 'su.pin.ok': '🔑 家长密码设好了，别告诉孩子哦',
      'su.key.r.ok': '✅ 密钥能用！阿里云已经回答了（这次测试花费不到 0.01 元）。',
      'su.key.r.format': '❌ 这不像百炼的 API Key：应该是 sk- 开头的一长串字母和数字。复制的时候别多带空格或中文。',
      'su.key.r.auth': '❌ 密钥不对：检查一下是不是复制完整了；不行就在百炼控制台重新创建一个。',
      'su.key.r.quota': '💳 阿里云账户欠费或额度用完了：先到阿里云充值（建议先充 20 元），再点「测试」。',
      'su.key.r.inactive': '⚠️ 百炼服务（或这个模型）还没开通：在百炼控制台点「开通服务」，再点「测试」。',
      'su.key.r.offline': '📶 手机现在没网：连上 Wi-Fi 或流量再点「测试」。',
      'su.key.r.busy': '⏳ 阿里云有点忙，等一下再点「测试」。',
      'su.key.r.network': '❌ 没连上阿里云：检查网络，过一会儿再试。',
      'su.key.r.nonative': 'ℹ️ 网页版不能在这里填密钥（安卓 App 里才能用）。',
      'su.key.title': '粘贴您的 AI 密钥',
      'su.key.p': 'AI 聊天和口语打分用的是<b>您自己的阿里云百炼账号</b>：费用由阿里云直接向您收（每天练 15 分钟左右，每月大约 15–21 元），开发者碰不到您的密钥，也收不到孩子的声音。',
      'su.key.guide': '❓ 怎么开通？（图文步骤）',
      'su.key.had': '✅ 这台手机里已经有密钥了{when}。要换就在下面粘贴新的。', 'su.key.had.when': '（{d} 测试通过）',
      'su.key.ph': 'sk- 开头的一长串', 'su.key.testing': '测试中…', 'su.key.test': '测试', 'su.key.show': '显示密钥', 'su.key.raw': '阿里云说：{raw}',
      'su.key.note': '密钥只存在这台手机里（安卓给这个 App 的私有空间），App 的界面读不回来，也不会发给开发者。以后在「设置 → 🔒 家长设置 → AI 聊天和口语打分」能换。请在阿里云设好<b>费用预警</b>。',
      'su.key.note.ios': '密钥只存在这台 iPhone 里（系统的钥匙串），App 的界面读不回来，也不会发给开发者。以后在「设置 → 🔒 家长设置 → AI 聊天和口语打分」能换。请在阿里云设好<b>费用预警</b>。',
      'su.key.skip': '先跳过（没有密钥时：口语题不能自动打分，也不能和岛民聊天）',
      'su.nick.empty': '请给孩子起一个英文昵称', 'su.nick.letters': '只能用英文字母（最多两个词），比如 Kevin、Coco、Super Max', 'su.nick.len': '昵称要 2 到 12 个字母',
      'su.nick.ok': '✅ App 里叫：{name}',
      'su.nick.warn': '⚠️ 这个看起来像中文名字的拼音。岛民会用它叫孩子、也会说给 AI 听：请换一个英文昵称（比如 Kevin、Coco）。',
      'su.nick.notreal': '这不是孩子的真名，就用它',
      'su.nick.title': '⑤ 家庭定制 1/3：孩子在 App 里的样子', 'su.nick.lbl': '英文昵称', 'su.nick.ph': '比如 Kevin、Coco',
      'su.nick.p': '岛民会用这个名字叫孩子，也会说给 AI 听：<b>请用英文昵称，不要用真名</b>。只能用英文字母。',
      'su.av.alt': '主角预览', 'su.av.g': '男孩 / 女孩', 'su.av.boy': '男孩', 'su.av.girl': '女孩',
      'su.av.skin': '肤色', 'su.av.style': '发型', 'su.av.hair': '发色', 'su.av.cloth': '衣服', 'su.av.hat': '帽子',
      'su.style.spiky': '刺刺头', 'su.style.short': '短发', 'su.style.bob': '齐耳', 'su.style.long': '长发', 'su.style.ponytail': '马尾', 'su.style.pigtails': '双马尾',
      'su.hat.cap': '帽子', 'su.hat.band': '发带', 'su.hat.none': '不戴',
      'su.type.fire': '🔥 火', 'su.type.water': '💧 水', 'su.type.grass': '🌿 草', 'su.type.spark': '⚡ 电',
      'su.mons.title': '⑤ 家庭定制 2/3：挑 3 只伙伴',
      'su.mons.p': '孩子开始冒险时，回声博士请孩子从三个贝壳里挑一只当第一个伙伴，贝壳里就是这 3 只（别的也能在野外遇到）。最好挑 3 种不同的属性。',
      'su.mons.count': '已选 <b>{n}</b> / 3', 'su.mons.list': '：{list}',
      'su.fam.title': '⑤ 家庭定制 3/3：家里的人', 'su.fam.add': '＋ ', 'su.fam.del': '去掉', 'su.fam.look': '造型 {n}',
      'su.fam.p': '选几位家人放进 App 里你好岛的家（最多 {n} 位，也可以不选）。孩子回家时能和他们说话，他们会鼓励孩子说英语、帮怪兽恢复体力。App 里只用英文称呼，造型从下面挑，<b>不用照片</b>。',
      'su.fam.none': '没选的话，家里就是默认的妈妈。',
      'su.dev.busy': '正在检查，等一下', 'su.dev.blocked': '这台设备现在不合格：按提示处理好再「重新检查」',
      'su.dev.title': '② 设备检查',
      'su.dev.p': '看看这台手机能不能顺利玩。iPhone、iPad、纯血鸿蒙、锁了安装的学习机装不上这个 App——能看到这一页，说明已经装上了。',
      'su.dev.web': '网页版看不到',
      'su.dev.android': '安卓系统', 'su.dev.android.v': '安卓 {v}（API {api}）', 'su.dev.android.old': '要安卓 8.0 以上', 'su.dev.android.9': '能用；安卓 9 及以下第一次备份存档时会问「存储」权限',
      'su.dev.webview': '系统浏览器内核（WebView）', 'su.dev.webview.v': '版本 {v}', 'su.dev.webview.unknown': '看不出版本',
      'su.dev.webview.old': '版本太老，部分画面会不正常：请在应用商店更新「Android System WebView」',
      'su.dev.gl': '3D 画面（WebGL2）', 'su.dev.gl.yes': '支持', 'su.dev.gl.no': '不支持', 'su.dev.gl.tip': '能玩，但冒险画面只能用「2D 流畅」',
      'su.dev.storage': '剩余空间', 'su.dev.storage.ram': ' · 内存 {n} GB', 'su.dev.storage.low': '至少要留 1 GB：先删掉一些不用的 App、照片或视频',
      'su.dev.mic': '麦克风', 'su.dev.mic.nobrowser': '这个浏览器不能用麦克风', 'su.dev.mic.ok': '可以用', 'su.dev.mic.blocked': '被永久拒绝了', 'su.dev.mic.no': '没允许',
      'su.dev.mic.fix.blocked': '点「去打开」→「权限」→「麦克风」→ 选「允许」，回来再点「重新检查」',
      'su.dev.mic.fix.ask': '手机问「允许使用麦克风吗」时要点「允许」，再点「重新检查」',
      'su.dev.fix': '⚙️ 去打开', 'su.dev.checking': '正在检查……', 'su.dev.checking.mic': '手机问「允许使用麦克风吗」时请点「允许」',
      'su.dev.v.ok': '✅ 这台设备合格，可以放心用', 'su.dev.v.warn': '⚠️ 能用，但有一项不太好（见上面）',
      'su.dev.v.bad': '❌ 这台设备现在不合格：按上面的提示处理后点「重新检查」；处理不了请把这一页截图发给帮您安装的人（不合格不收费）',
      'su.dev.pay': '合格了：如果还没付款，帮您安装的人这时会把付款链接发给您。付好以后点「下一步」，接着设家长密码和 AI 密钥（这两步请您自己输入，远程协助时先暂停屏幕共享）。',
      'su.dev.again': '🔄 重新检查',
      // iPhone 版（diag().platform === 'ios'）的设备检查
      'su.dev.ios.p': '看看这台 iPhone 能不能顺利玩（要 iOS 18.4 以上）。',
      'su.dev.ios': 'iOS 系统', 'su.dev.ios.v': 'iOS {v}', 'su.dev.ios.vm': 'iOS {v}（{model}）',
      'su.dev.ios.old': '要 iOS 18.4 以上（App 自带的配音要用到）：到「设置 → 通用 → 软件更新」升级系统',
      'su.dev.ios.mic.blocked': '点「去打开」→ 打开「麦克风」开关，回来再点「重新检查」',
      'su.dev.ios.mic.ask': '手机问能不能使用麦克风时要同意，再点「重新检查」', 'su.dev.ios.checking.mic': '手机问能不能使用麦克风时，请同意',
      'su.done.pin': '🔑 家长密码：{v}', 'su.done.pin.ok': '已设好', 'su.done.pin.no': '还没设',
      'su.done.key.no': '还没有', 'su.done.key.no.s': '（口语不能自动打分，也不能聊天）',
      'su.done.nick': '🙂 孩子在 App 里叫：<b>{v}</b>', 'su.done.nick.later': '（开场时再起）',
      'su.done.mons': '🐾 伙伴：{v}', 'su.done.mons.def': '默认的 3 只', 'su.done.fam': '👪 家里的人：{v}', 'su.done.fam.def': '默认的妈妈',
      'su.done.dev.warn': '能玩（有一项不太好）',
      'su.done.p': '现在把手机交给孩子吧！以后要改，在「设置 → 🔒 家长设置」里（要家长密码）。',
      'su.healed': '💖 怪兽们的体力都恢复了', 'su.why.fam': '改家庭定制',
    },
    en: {
      'su.ui': 'Language · 界面语言',
      'su.who.q': 'Who will use this app?', 'su.who.kid': '👨‍👩‍👧 A child', 'su.who.open': '🧑 Me',
      'su.who.kid.note': 'For a child: a parent fills in the next pages (consent, device check, parent PIN, AI key, family setup).',
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
      'su.doc.privacy': 'Children\'s privacy notice (in Chinese)', 'su.doc.consent': 'Guardian consent form (in Chinese)', 'su.doc.guide': 'How to set up Alibaba Cloud Bailian and get an API key (in Chinese)', 'su.doc.licenses': 'Open-source licences and thanks',
      'su.close': 'Close', 'su.next': 'Next', 'su.cancel': 'Cancel', 'su.save': 'Save', 'su.saved': '✅ Saved', 'su.sep': ', ',
      'su.tabs': ['Welcome', 'Device', 'PIN', 'AI key', 'Family', 'Done'],
      'su.kid.head': '👪 First-time setup for parents', 'su.kid.head.s': 'A parent fills in these pages. About 5 minutes', 'su.edit.head': '🔒 Parent Settings',
      'su.kid.finish': '🎉 Finish',
      'su.kid.lead': 'Echo Island is an app for practising English listening and speaking: your child has to <b>speak English aloud</b> to make the monsters move and to chat with the islanders. A <b>parent</b> should fill in the next pages. Everything stays on this phone.',
      'su.kid.ai': 'English chats with the islanders and speech scoring are done by <b>artificial intelligence</b>, provided by <b>Alibaba Cloud Tongyi Qianwen</b>. AI-generated content is labelled "AI-generated" in the app, and each chat starts with a short spoken notice. The AI only plays characters in the app and only talks about the islands and everyday topics. It will not ask for your child\'s real name, school, address or phone number.',
      'su.kid.pr.1': 'Your child\'s save, nickname, family settings and chat history are stored <b>only on this phone</b>. The developer cannot see them.',
      'su.kid.pr.2': 'When your child chats or their speaking is scored, <b>their voice and the recognised text</b> go straight to Alibaba Cloud for processing, using <b>your own Alibaba Cloud account</b>. The developer does not receive them and runs no server.',
      'su.kid.pr.3': 'No real name, photo, school, address or phone number is collected. Please give your child an <b>English nickname</b> (not their real name). Family members are only called "Mom", "Dad" and so on.',
      'su.kid.pr.4': 'At any time a parent can read the chat history (with the parent PIN), delete the AI key in Settings (the app then stops using AI), clear the progress, or uninstall the app to remove all data.',
      'su.kid.doc.privacy': '📄 Children\'s privacy notice (full text, in Chinese)', 'su.kid.doc.consent': '📄 Guardian consent form (full text, in Chinese)',
      'su.kid.consent': 'I am the child\'s parent (or other guardian). I have read the "Children\'s privacy notice" and the "Guardian consent form", and I <b>separately agree</b> that my child may use AI chat and speech scoring (my child\'s voice and the recognised text are sent to Alibaba Cloud for processing).',
      'su.kid.under': 'If you do not agree, please do not continue. You can contact the person who installed the app for you to get a refund.',
      'su.need.pin': 'Please set the parent PIN first', 'su.need.nick': 'This nickname looks like a real name. Please choose another one, or tick "This is not my child\'s real name"', 'su.need.mons': 'Please choose 3 partners (chosen so far: {n})',
      'su.pin.t.done': 'Parent PIN', 'su.pin.done': '✅ The parent PIN is set.',
      'su.pin.done.p': 'You need it to turn off the study gate, change adventure time, read chats, change the AI key and more. To change it later: Settings → 🔒 Parent Settings → Parent PIN. Forgot the PIN? First "💾 Export save" (no PIN needed) → clear this app\'s data → set up again → "Restore from backup". No progress is lost.',
      'su.pin.clear': 'Clear', 'su.pin.del': 'Delete one digit', 'su.pin.title': 'Set a parent PIN',
      'su.pin.p': 'You need this 4-digit PIN to turn off the study gate, change adventure time, read chats with a safety flag, change the AI key and more. <b>Do not tell your child</b>, and do not use easy ones like 1234, 1111 or a birthday.',
      'su.pin.new': 'Enter a new 4-digit PIN', 'su.pin.again': 'Enter it again to confirm',
      'su.pin.store': 'The PIN is not stored as plain text: {how}', 'su.pin.store.native': 'the phone keeps only a hash of it with a random "salt". 5 wrong tries lock it for 10 minutes.', 'su.pin.store.web': 'the web version keeps it in this device\'s browser.',
      'su.pin.weak': 'This PIN is too easy to guess. Please choose another one', 'su.pin.diff': 'The two PINs are different. Please set it again', 'su.pin.fail': 'The PIN was not saved. Please set it again', 'su.pin.ok': '🔑 Parent PIN set. Do not tell your child!',
      'su.key.r.ok': '✅ The key works! Alibaba Cloud answered (this test cost less than 0.01 yuan).',
      'su.key.r.format': '❌ This does not look like a Bailian API key: it should be a long string of letters and numbers starting with sk-. Do not copy extra spaces or Chinese characters.',
      'su.key.r.auth': '❌ The key is wrong: check that you copied all of it. If that does not help, create a new one in the Bailian console.',
      'su.key.r.quota': '💳 The Alibaba Cloud account is in debt or out of credit: top it up first (we suggest 20 yuan to start), then tap "Test".',
      'su.key.r.inactive': '⚠️ The Bailian service (or this model) is not activated yet: activate the service in the Bailian console, then tap "Test".',
      'su.key.r.offline': '📶 The phone is offline: connect to Wi-Fi or mobile data, then tap "Test".',
      'su.key.r.busy': '⏳ Alibaba Cloud is busy. Wait a moment, then tap "Test".',
      'su.key.r.network': '❌ Could not reach Alibaba Cloud: check the network and try again later.',
      'su.key.r.nonative': 'ℹ️ The web version cannot take a key here (only the Android app can).',
      'su.key.title': 'Paste your AI key',
      'su.key.p': 'AI chat and speech scoring use <b>your own Alibaba Cloud Bailian account</b>: Alibaba Cloud charges you directly (about 15 minutes of practice a day costs roughly 15–21 yuan a month). The developer never touches your key and never receives your child\'s voice.',
      'su.key.guide': '❓ How to set it up (guide in Chinese)',
      'su.key.had': '✅ This phone already has a key{when}. To change it, paste a new one below.', 'su.key.had.when': ' (tested OK on {d})',
      'su.key.ph': 'a long string starting with sk-', 'su.key.testing': 'Testing…', 'su.key.test': 'Test', 'su.key.show': 'Show the key', 'su.key.raw': 'Alibaba Cloud says: {raw}',
      'su.key.note': 'The key is stored only on this phone (in the private space Android gives this app). The app screens cannot read it back, and it is never sent to the developer. You can change it later in "Settings → 🔒 Parent Settings → AI chat and speech scoring". Please set a <b>spending alert</b> in Alibaba Cloud.',
      'su.key.note.ios': 'The key is stored only on this iPhone (in the system keychain). The app screens cannot read it back, and it is never sent to the developer. You can change it later in "Settings → 🔒 Parent Settings → AI chat and speech scoring". Please set a <b>spending alert</b> in Alibaba Cloud.',
      'su.key.skip': 'Skip for now (without a key, speaking cannot be scored automatically and there is no chat with the islanders)',
      'su.nick.empty': 'Please give your child an English nickname', 'su.nick.letters': 'English letters only (up to two words), for example Kevin, Coco, Super Max', 'su.nick.len': 'The nickname needs 2 to 12 letters',
      'su.nick.ok': '✅ Name in the app: {name}',
      'su.nick.warn': '⚠️ This looks like a Chinese name written in pinyin. The islanders will call your child by it, and it is also sent to the AI: please choose an English nickname (for example Kevin or Coco).',
      'su.nick.notreal': 'This is not my child\'s real name. Use it',
      'su.nick.title': '⑤ Family setup 1/3: your child in the app', 'su.nick.lbl': 'English nickname', 'su.nick.ph': 'for example Kevin, Coco',
      'su.nick.p': 'The islanders will call your child by this name, and it is also sent to the AI: <b>please use an English nickname, not a real name</b>. English letters only.',
      'su.av.alt': 'Character preview', 'su.av.g': 'Boy / Girl', 'su.av.boy': 'Boy', 'su.av.girl': 'Girl',
      'su.av.skin': 'Skin', 'su.av.style': 'Hairstyle', 'su.av.hair': 'Hair colour', 'su.av.cloth': 'Clothes', 'su.av.hat': 'Hat',
      'su.style.spiky': 'Spiky', 'su.style.short': 'Short', 'su.style.bob': 'Bob', 'su.style.long': 'Long', 'su.style.ponytail': 'Ponytail', 'su.style.pigtails': 'Pigtails',
      'su.hat.cap': 'Cap', 'su.hat.band': 'Headband', 'su.hat.none': 'None',
      'su.type.fire': '🔥 Fire', 'su.type.water': '💧 Water', 'su.type.grass': '🌿 Grass', 'su.type.spark': '⚡ Spark',
      'su.mons.title': '⑤ Family setup 2/3: choose 3 partners',
      'su.mons.p': 'When your child starts the adventure, Professor Echo asks them to choose one of three shells as their first partner. These 3 monsters are in the shells (the others can still be met in the wild). It is best to choose 3 different types.',
      'su.mons.count': 'Chosen <b>{n}</b> / 3', 'su.mons.list': ': {list}',
      'su.fam.title': '⑤ Family setup 3/3: family members', 'su.fam.add': '+ ', 'su.fam.del': 'Remove', 'su.fam.look': 'Look {n}',
      'su.fam.p': 'Choose family members to put in your child\'s home on Hello Island (up to {n}, or nobody). When your child goes home, they can talk with them: they cheer your child on to speak English and heal the monsters. The app only uses English names like "Mom", and you choose how they look below: <b>no photos</b>.',
      'su.fam.none': 'If you choose nobody, the default Mom is at home.',
      'su.dev.busy': 'Checking, please wait', 'su.dev.blocked': 'This device does not pass yet: follow the tips, then tap "Check again"',
      'su.dev.title': '② Device check',
      'su.dev.p': 'Let\'s see if this phone runs the app well. iPhone, iPad, HarmonyOS NEXT and study tablets that block installs cannot install this app. If you can see this page, it is already installed.',
      'su.dev.web': 'Not visible in the web version',
      'su.dev.android': 'Android version', 'su.dev.android.v': 'Android {v} (API {api})', 'su.dev.android.old': 'Needs Android 8.0 or newer', 'su.dev.android.9': 'Works. On Android 9 or older, the first save backup asks for "Storage" permission',
      'su.dev.webview': 'System browser engine (WebView)', 'su.dev.webview.v': 'Version {v}', 'su.dev.webview.unknown': 'Version unknown',
      'su.dev.webview.old': 'Too old: some screens may not show correctly. Please update "Android System WebView" in the app store',
      'su.dev.gl': '3D graphics (WebGL2)', 'su.dev.gl.yes': 'Supported', 'su.dev.gl.no': 'Not supported', 'su.dev.gl.tip': 'Playable, but the adventure map can only use "Smooth mode (2D)"',
      'su.dev.storage': 'Free space', 'su.dev.storage.ram': ' · RAM {n} GB', 'su.dev.storage.low': 'At least 1 GB must be free: delete some apps, photos or videos you do not use',
      'su.dev.mic': 'Microphone', 'su.dev.mic.nobrowser': 'This browser cannot use the microphone', 'su.dev.mic.ok': 'Works', 'su.dev.mic.blocked': 'Permanently denied', 'su.dev.mic.no': 'Not allowed',
      'su.dev.mic.fix.blocked': 'Tap "Open settings" → "Permissions" → "Microphone" → choose "Allow", then come back and tap "Check again"',
      'su.dev.mic.fix.ask': 'When the phone asks about the microphone, tap "Allow", then tap "Check again"',
      'su.dev.fix': '⚙️ Open settings', 'su.dev.checking': 'Checking…', 'su.dev.checking.mic': 'When the phone asks about the microphone, please tap "Allow"',
      'su.dev.v.ok': '✅ This device passes. It is ready to use', 'su.dev.v.warn': '⚠️ Usable, but one item is not ideal (see above)',
      'su.dev.v.bad': '❌ This device does not pass yet: follow the tips above, then tap "Check again". If you cannot fix it, send a screenshot of this page to the person who installed the app for you (no charge if the device does not pass)',
      'su.dev.pay': 'Passed: if you have not paid yet, the person installing the app will now send you the payment link. After paying, tap "Next" to set the parent PIN and the AI key (please type these two yourself, and pause screen sharing during remote help).',
      'su.dev.again': '🔄 Check again',
      'su.dev.ios.p': 'Let\'s see if this iPhone runs the app well (it needs iOS 18.4 or newer).',
      'su.dev.ios': 'iOS version', 'su.dev.ios.v': 'iOS {v}', 'su.dev.ios.vm': 'iOS {v} ({model})',
      'su.dev.ios.old': 'Needs iOS 18.4 or newer (for the voices built into the app): go to Settings → General → Software Update',
      'su.dev.ios.mic.blocked': 'Tap "Open settings" → turn on "Microphone", then come back and tap "Check again"',
      'su.dev.ios.mic.ask': 'When the phone asks to use the microphone, allow it, then tap "Check again"', 'su.dev.ios.checking.mic': 'When the phone asks to use the microphone, please allow it',
      'su.done.pin': '🔑 Parent PIN: {v}', 'su.done.pin.ok': 'set', 'su.done.pin.no': 'not set yet',
      'su.done.key.no': 'none yet', 'su.done.key.no.s': ' (speaking cannot be scored automatically and there is no chat)',
      'su.done.nick': '🙂 Your child\'s name in the app: <b>{v}</b>', 'su.done.nick.later': '(chosen at the start)',
      'su.done.mons': '🐾 Partners: {v}', 'su.done.mons.def': 'the default 3', 'su.done.fam': '👪 Family: {v}', 'su.done.fam.def': 'the default Mom',
      'su.done.dev.warn': 'usable (one item is not ideal)',
      'su.done.p': 'Now give the phone to your child! To change anything later, go to "Settings → 🔒 Parent Settings" (needs the parent PIN).',
      'su.healed': '💖 Your monsters are full of energy again', 'su.why.fam': 'Change family setup',
    },
  });

  // ---------- 主角形象：预设部件 ----------
  const SKINS = ['#ffe1c8', '#f1c7a0', '#d9a57b'];
  const HAIRS = ['#212121', '#3a2a24', '#7a4a2c', '#b0703c', '#8e5cc2'];
  const CLOTHES = ['#1f8f8c', '#e53935', '#1e88e5', '#8e6cef', '#ff8f00', '#ff7fa3', '#43a047'];
  // [造型, 名字的字表键]
  const STYLES = ['spiky', 'short', 'bob', 'long', 'ponytail', 'pigtails'].map(v => [v, 'su.style.' + v]);
  const HATS = ['cap', 'band', 'none'].map(v => [v, 'su.hat.' + v]);
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
    if (!v) return { ok: false, msg: t('su.nick.empty') };
    if (!/^[A-Za-z]+( [A-Za-z]+)?$/.test(v)) return { ok: false, msg: t('su.nick.letters') };
    if (v.replace(/ /g, '').length < 2 || v.length > 12) return { ok: false, msg: t('su.nick.len') };
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
  // 称呼后面的小字（妈妈、爷爷 / 外公……）是英文称呼的意思：英语界面不显示
  const relZh = r => { const g = I18N ? I18N.gloss(r) : r.zh; return g ? ' <small>' + g + '</small>' : ''; };
  const MEM_MAX = 4;
  const member = m => { const r = RBY[m && m.rel]; return r ? { rel: r.rel, call: r.call, zh: r.zh, g: r.g, look: r.looks[m.look] || r.looks[0] } : null; };
  const members = F => (F.members || []).map(member).filter(Boolean);
  // 家里本来就有一位（地图上 role 'house' 的人，以前一直是妈妈）：有 Mom 就是她，没有就是第一位
  const houseOf = F => { const ms = members(F); return ms.find(m => m.rel === 'mom') || ms[0] || null; };

  // ---------- 向导 ----------
  // 顺序和销售流程（00 号第 7–9 步、06 号安装教程、03 号话术）一致：同意 → 设备检查（合格才付款）→ 家长密码 → AI 密钥 → 家庭定制 → 完成
  const FLOW = ['welcome', 'device', 'pin', 'key', 'nick', 'mons', 'fam', 'done'];
  const NUM = { welcome: 1, device: 2, pin: 3, key: 4, nick: 5, mons: 5, fam: 5, done: 6 };
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
    if (WZ.step === 'welcome') return F.consent && F.consent.v === DOC_V ? '' : t('su.open.need');   // 两条路说的是同一句
    if (WZ.step === 'pin') return pinHas() ? '' : t('su.need.pin');
    if (WZ.step === 'nick') { const r = checkNick(($('#su-nick') || {}).value || F.nick); return !r.ok ? r.msg : r.warn && !WZ.nickWarnOk ? t('su.need.nick') : ''; }
    if (WZ.step === 'mons') return F.starters.length === 3 ? '' : t('su.need.mons', { n: F.starters.length });
    // 设备检查：不合格就不能往下走（安装包里才这样；网页版看不到手机的情况，不拦）
    if (WZ.step === 'device') return WZ.dev && WZ.dev.busy ? t('su.dev.busy') : !WZ.edit && nat('diag') && WZ.dev && verdict(WZ.dev.rows) === 'bad' ? t('su.dev.blocked') : '';
    return '';
  }

  // 画面
  function render() {
    const box = $('#su-box'); if (!box) return;
    const F = draft(), self = !WZ.edit && selfPath(F), ps = pages(), i = ps.indexOf(WZ.step), last = i === ps.length - 1, n = self ? i + 1 : NUM[WZ.step];
    const tabNames = (I18N && I18N.raw(self ? 'su.open.tabs' : 'su.tabs')) || [];
    const tabs = WZ.edit ? '' : '<ol class="su-tabs"' + (self ? ' style="grid-template-columns:repeat(' + tabNames.length + ',1fr)"' : '') + '>' + tabNames.map((nm, k) => '<li class="' + (k + 1 < n ? 'ok' : k + 1 === n ? 'on' : '') + '"><i>' + '①②③④⑤⑥'[k] + '</i><span>' + nm + '</span></li>').join('') + '</ol>';
    // 第一页最上面（只在第一次走向导时）：界面语言、谁来用
    const top = !WZ.edit && WZ.step === 'welcome' ? whoBox(F) : '';
    const body = top + ({ welcome: self ? pWelcomeSelf : pWelcome, pin: pPin, key: pKey, nick: pNick, mons: pMons, fam: pFam, device: pDevice, done: self ? pDoneSelf : pDone })[WZ.step]();
    let nav;
    if (WZ.step === 'done' && self) nav = '<div class="su-nav"><button class="btn ghost" data-act="suBack">' + h('su.back') + '</button><button class="btn sun" data-act="suFinish" data-focus>' + h('su.open.finish') + '</button></div>';
    else if (WZ.step === 'done') nav = '<div class="su-nav"><button class="btn ghost" data-act="suBack">' + h('su.back') + '</button><button class="btn sun" data-act="suFinish" data-focus>' + h('su.kid.finish') + '</button></div>';
    else if (WZ.edit) nav = '<div class="su-nav"><button class="btn ghost" data-act="' + (i > 0 ? 'suBack' : 'suCancel') + '">' + h(i > 0 ? 'su.back' : 'su.cancel') + '</button><button class="btn" data-act="suNext" id="su-next">' + h(last ? 'su.save' : 'su.next') + '</button></div>';
    else nav = '<div class="su-nav">' + (i > 0 ? '<button class="btn ghost" data-act="suBack">' + h('su.back') + '</button>' : '<span></span>') + '<button class="btn" data-act="suNext" id="su-next"' + (blocked() && WZ.step !== 'nick' ? ' disabled' : '') + '>' + h('su.next') + '</button></div>';
    // 横屏时内容那一栏自己滚动（style.css）：同一页重画（点密码键、挑伙伴、换部件……）不跳回顶上
    const old = box.querySelector('.su-step'), sy = old && old.dataset.step === WZ.step ? old.scrollTop : 0;
    box.innerHTML = '<div class="su-head"><b>' + h(WZ.edit ? 'su.edit.head' : self ? 'su.open.head' : 'su.kid.head') + '</b><small>' + (WZ.edit ? '' : h(self ? 'su.open.head.s' : 'su.kid.head.s')) + '</small></div>' + tabs +
      '<div class="su-step" data-step="' + WZ.step + '">' + body + '</div>' + nav;
    if (sy) box.querySelector('.su-step').scrollTop = sy;
  }
  function onInput(e) {
    const el = e.target;
    if (el.id === 'su-nick') {
      const r = checkNick(el.value), m = $('#su-nick-msg');
      WZ.nickWarnOk = false;
      if (m) m.innerHTML = !el.value.trim() ? '' : !r.ok ? '<span class="bad">' + esc(r.msg) + '</span>' : r.warn ? nickWarnHTML() : '<span class="ok">' + h('su.nick.ok', { name: r.name }) + '</span>';
    }
    if (el.id === 'su-key') { WZ.key = Object.assign(WZ.key || {}, { res: null }); const r = $('#su-key-res'); if (r) r.innerHTML = ''; }
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
    return '<div class="su-hero">🏝️</div><h2>' + h('su.open.title') + '</h2>' +
      '<p class="su-lead">' + h('su.kid.lead') + '</p>' +
      '<div class="su-card ai"><b>' + h('su.open.ai.t') + '</b><p>' + h('su.kid.ai') + '</p></div>' +
      '<div class="su-card"><b>' + h('su.open.pr.t') + '</b><ul>' + [1, 2, 3, 4].map(k => '<li>' + h('su.kid.pr.' + k) + '</li>').join('') + '</ul></div>' +
      '<div class="su-links"><button class="btn small ghost" data-act="suDoc" data-doc="privacy">' + h('su.kid.doc.privacy') + '</button><button class="btn small ghost" data-act="suDoc" data-doc="consent">' + h('su.kid.doc.consent') + '</button></div>' +
      '<label class="su-check"><input type="checkbox" id="su-consent" data-act="suConsent"' + (on ? ' checked' : '') + '><span>' + h('su.kid.consent') + '</span></label>' +
      '<p class="su-small">' + h('su.kid.under') + '</p>';
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
      return '<div class="su-hero">🔑</div><h2>' + h('su.pin.t.done') + '</h2><p class="su-done-line">' + h('su.pin.done') + '</p>' +
        '<p class="su-small">' + h('su.pin.done.p') + '</p>';
    }
    const p = WZ.pin || (WZ.pin = { mode: 'set1', buf: '', first: '', msg: '' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(k => k === 'clr' ? '<button class="pin-k fn" data-act="suPinClr">' + h('su.pin.clear') + '</button>'
      : k === 'del' ? '<button class="pin-k fn" data-act="suPinDel" aria-label="' + h('su.pin.del') + '">⌫</button>' : '<button class="pin-k" data-act="suPin" data-k="' + k + '">' + k + '</button>').join('');
    return '<div class="su-hero">🔑</div><h2>' + h('su.pin.title') + '</h2>' +
      '<p>' + h('su.pin.p') + '</p>' +
      '<div class="pin su-pin"><p class="pin-t">' + h(p.mode === 'set1' ? 'su.pin.new' : 'su.pin.again') + '</p>' +
      '<div class="pin-dots" id="su-pin-dots">' + [0, 1, 2, 3].map(i => '<i class="' + (i < p.buf.length ? 'on' : '') + '">' + (i < p.buf.length ? '●' : '○') + '</i>').join('') + '</div>' +
      '<p class="pin-msg" id="su-pin-msg">' + esc(p.msg) + '</p><div class="pin-pad">' + keys + '</div></div>' +
      '<p class="su-small">' + h('su.pin.store', { how: t(nativePin() ? 'su.pin.store.native' : 'su.pin.store.web') }) + '</p>';
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
      if (weakPin(v)) { p.msg = t('su.pin.weak'); render(); return; }
      p.first = v; p.mode = 'set2'; render(); return;
    }
    if (v !== p.first) { p.mode = 'set1'; p.first = ''; p.msg = t('su.pin.diff'); render(); return; }
    let ok = false;
    if (nativePin()) { try { ok = nat('setPin') && !!EchoNative.setPin(v); } catch (e) { ok = false; } }
    else { G.S.settings.pin = v; G.S.settings.pinLock = { n: 0, until: 0, lockouts: 0 }; ok = true; }
    if (!ok) { p.mode = 'set1'; p.first = ''; p.msg = t('su.pin.fail'); render(); return; }
    WZ.pin = null; G.save();
    G.toast(t('su.pin.ok'));
    render();
  }

  // ③ AI 密钥
  // [样式, 说明的字表键]
  const KEY_RES = {
    ok: ['ok', 'su.key.r.ok'],
    format: ['bad', 'su.key.r.format'],
    auth: ['bad', 'su.key.r.auth'],
    quota: ['bad', 'su.key.r.quota'],
    inactive: ['bad', 'su.key.r.inactive'],
    offline: ['bad', 'su.key.r.offline'],
    busy: ['warn', 'su.key.r.busy'],
    network: ['bad', 'su.key.r.network'],
    nonative: ['warn', 'su.key.r.nonative'],
  };
  const hasKey = () => { try { return nat('hasKey') && !!EchoNative.hasKey(); } catch (e) { return false; } };
  function pKey() {
    const F = draft(), k = WZ.key || (WZ.key = { res: null, busy: false }), had = hasKey();
    const res = k.res ? KEY_RES[k.res.why] || KEY_RES.network : null;
    return '<div class="su-hero">🗝️</div><h2>' + h('su.key.title') + '</h2>' +
      '<p>' + h('su.key.p') + '</p>' +
      '<button class="btn small ghost su-guide" data-act="suDoc" data-doc="guide">' + h('su.key.guide') + '</button>' +
      (had && !k.res ? '<p class="su-done-line">' + h('su.key.had', { when: F.keyOk ? t('su.key.had.when', { d: F.keyOk }) : '' }) + '</p>' : '') +
      '<div class="su-key"><input id="su-key" class="txt-in" type="password" placeholder="' + h('su.key.ph') + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="btn" data-act="suKeyTest" id="su-key-test"' + (k.busy ? ' disabled' : '') + '>' + h(k.busy ? 'su.key.testing' : 'su.key.test') + '</button></div>' +
      '<label class="su-check small"><input type="checkbox" data-act="suKeyShow"><span>' + h('su.key.show') + '</span></label>' +
      '<div class="su-res" id="su-key-res">' + (res ? '<p class="' + res[0] + '">' + h(res[1]) + '</p>' + (k.res.raw && !k.res.ok ? '<p class="su-raw">' + h('su.key.raw', { raw: k.res.raw }) + '</p>' : '') : '') + '</div>' +
      '<p class="su-small">' + h(onIos() ? 'su.key.note.ios' : 'su.key.note') + '</p>' +
      (WZ.edit ? '' : '<button class="su-skip" data-act="suKeySkip">' + h('su.key.skip') + '</button>');
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
    return '<span class="warn">' + h('su.nick.warn') + '</span>' +
      '<label class="su-check small"><input type="checkbox" data-act="suNickOk"' + (WZ.nickWarnOk ? ' checked' : '') + '><span>' + h('su.nick.notreal') + '</span></label>';
  }
  function saveNick() {
    const i = $('#su-nick'); if (!i) return;
    const r = checkNick(i.value); if (r.ok) { draft().nick = r.name; G.save(); }
  }
  function pNick() {
    const F = draft(), a = F.avatar, look = avatarLook(a), r = F.nick ? checkNick(F.nick) : null;
    const sw = (part, list) => list.map((c, k) => '<button class="su-sw' + (a[part] === k ? ' on' : '') + '" data-act="suPart" data-p="' + part + '" data-v="' + k + '" style="--c:' + c + '" aria-label="' + part + ' ' + (k + 1) + '"></button>').join('');
    // list：[值, 名字的字表键]
    const seg = (part, list) => list.map(([v, key]) => '<button class="' + (a[part] === v ? 'on' : '') + '" data-act="suPart" data-p="' + part + '" data-v="' + v + '">' + h(key) + '</button>').join('');
    return '<h2>' + h('su.nick.title') + '</h2>' +
      '<label class="su-lbl" for="su-nick">' + h('su.nick.lbl') + '</label><input id="su-nick" class="txt-in" maxlength="12" placeholder="' + h('su.nick.ph') + '" autocomplete="off" autocapitalize="words" spellcheck="false" value="' + esc(F.nick) + '">' +
      '<p class="su-small">' + h('su.nick.p') + '</p>' +
      '<div class="su-msg" id="su-nick-msg">' + (r && r.ok ? (r.warn ? nickWarnHTML() : '<span class="ok">' + h('su.nick.ok', { name: r.name }) + '</span>') : '') + '</div>' +
      '<div class="su-av"><img class="su-av-img" id="su-av-img" alt="' + h('su.av.alt') + '" src="' + (P ? P.standing(look, 120, 170) : '') + '">' +
      '<div class="su-parts">' +
      '<div class="su-row"><span>' + h('su.av.g') + '</span><div class="seg">' + seg('g', [['boy', 'su.av.boy'], ['girl', 'su.av.girl']]) + '</div></div>' +
      '<div class="su-row"><span>' + h('su.av.skin') + '</span><div class="su-sws">' + sw('skin', SKINS) + '</div></div>' +
      '<div class="su-row"><span>' + h('su.av.style') + '</span><div class="seg wrap">' + seg('style', STYLES) + '</div></div>' +
      '<div class="su-row"><span>' + h('su.av.hair') + '</span><div class="su-sws">' + sw('hair', HAIRS) + '</div></div>' +
      '<div class="su-row"><span>' + h('su.av.cloth') + '</span><div class="su-sws">' + sw('cloth', CLOTHES) + '</div></div>' +
      '<div class="su-row"><span>' + h('su.av.hat') + '</span><div class="seg">' + seg('hat', HATS) + '</div></div>' +
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
    const groups = LIB_TYPES.map(ty => {
      const ms = lib.filter(s => s.type === ty);
      return ms.length ? '<h3 class="su-h3">' + h('su.type.' + ty) + '</h3><div class="su-mons">' + ms.map(s => {
        const on = F.starters.includes(s.id), zh = I18N ? I18N.gloss(s) : s.zh;   // 中文名是英文名的意思：英语界面不显示
        return '<button class="su-mon' + (on ? ' on' : '') + '" data-act="suMon" data-id="' + esc(s.id) + '"' + (!on && n >= 3 ? ' disabled' : '') + '>' + monImg(s) + '<b>' + esc(s.en) + '</b>' + (zh ? '<small>' + esc(zh) + '</small>' : '') + '</button>';
      }).join('') + '</div>' : '';
    }).join('');
    // 名字已经转义过，拼进去用 t()
    return '<h2>' + h('su.mons.title') + '</h2>' +
      '<p>' + h('su.mons.p') + '</p>' +
      '<p class="su-count" id="su-count">' + h('su.mons.count', { n }) + (n ? t('su.mons.list', { list: F.starters.map(id => esc((D.byId[id] || {}).en || id)).join(t('su.sep')) }) : '') + '</p>' + groups;
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
    const chips = RELS.map(r => '<button class="btn small ' + (has.has(r.rel) ? '' : 'ghost') + '" data-act="suFamAdd" data-rel="' + r.rel + '"' + (has.has(r.rel) || ms.length >= MEM_MAX ? ' disabled' : '') + '>' + (has.has(r.rel) ? '✓ ' : h('su.fam.add')) + r.call + relZh(r) + '</button>').join('');
    const list = ms.map((m, i) => {
      const r = RBY[m.rel]; if (!r) return '';
      return '<div class="su-mem"><div class="su-mem-h"><b>' + r.call + '</b>' + relZh(r) + '<button class="su-x" data-act="suFamDel" data-i="' + i + '" aria-label="' + h('su.fam.del') + '">✕</button></div>' +
        '<div class="su-looks">' + r.looks.map((l, k) => '<button class="su-look' + ((m.look || 0) === k ? ' on' : '') + '" data-act="suFamLook" data-i="' + i + '" data-v="' + k + '"><img alt="' + h('su.fam.look', { n: k + 1 }) + '" src="' + (P ? P.standing(l, 72, 102) : '') + '"></button>').join('') + '</div></div>';
    }).join('');
    return '<h2>' + h('su.fam.title') + '</h2>' +
      '<p>' + h('su.fam.p', { n: MEM_MAX }) + '</p>' +
      '<div class="su-chips">' + chips + '</div>' + (list ? '<div class="su-mems">' + list + '</div>' : '<p class="su-small">' + h('su.fam.none') + '</p>');
  }

  // ② 设备检查：安卓版本、WebView、WebGL2、剩余空间、麦克风（第二步：合格了才付款，不合格不收钱）
  // iPhone 版（diag().platform === 'ios'）：安卓版本、WebView 两行换成一行「iOS 版本 + 机型」（最低 18.4），其余一样
  // 每一行 { k, ok: true 合格 / false 不合格 / null 看不到, warn: 能用但有问题, label, val, tip }。必须合格的：安卓版本（iOS 版本）、剩余空间、麦克风
  // 是不是 iPhone 版（AI 密钥那页说密钥存在哪儿：iPhone 是钥匙串，不是「安卓给 App 的私有空间」）
  function onIos() { try { return !!(nat('diag') && (JSON.parse(EchoNative.diag() || '{}') || {}).platform === 'ios'); } catch (e) { return false; } }
  async function deviceCheck() {
    let dg = {}; try { if (nat('diag')) dg = JSON.parse(EchoNative.diag() || '{}') || {}; } catch (e) { dg = {}; }
    const ios = dg.platform === 'ios';
    const d = WZ.dev = { busy: true, rows: [], ios }, rows = d.rows;
    render();
    const sdk = +dg.sdk || 0;
    // label / val / tip 是函数：画的时候才按界面语言取字
    if (ios) rows.push(iosRow(dg));
    else rows.push({ k: 'android', label: () => t('su.dev.android'), ok: sdk ? sdk >= 26 : null, val: () => (dg.android ? t('su.dev.android.v', { v: dg.android, api: sdk }) : t('su.dev.web')),
      tip: () => (sdk && sdk < 26 ? t('su.dev.android.old') : sdk && sdk < 29 ? t('su.dev.android.9') : '') });
    const wv = String(dg.webview || ''), m = (wv.match(/^(\d+)\./) || (navigator.userAgent.match(/Chrome\/(\d+)/) || []))[1], major = +m || 0;
    if (!ios) rows.push({ k: 'webview', label: () => t('su.dev.webview'), ok: major ? major >= 105 : null, warn: true, val: () => (major ? t('su.dev.webview.v', { v: major }) : t('su.dev.webview.unknown')),
      tip: () => (major && major < 105 ? t('su.dev.webview.old') : '') });
    let gl = false;
    try { const c = document.createElement('canvas'); gl = !!c.getContext('webgl2'); } catch (e) { gl = false; }
    rows.push({ k: 'webgl2', label: () => t('su.dev.gl'), ok: gl, warn: true, val: () => t(gl ? 'su.dev.gl.yes' : 'su.dev.gl.no'), tip: () => (gl ? '' : t('su.dev.gl.tip')) });
    let st = null; try { if (nat('storage')) st = JSON.parse(EchoNative.storage() || '{}') || null; } catch (e) { st = null; }
    const free = st && +st.free;
    rows.push({ k: 'storage', label: () => t('su.dev.storage'), ok: free ? free >= 1e9 : null, val: () => (free ? (free / 1e9).toFixed(1) + ' GB' + (st.ram ? t('su.dev.storage.ram', { n: Math.round(st.ram / 1073741824) }) : '') : t('su.dev.web')),
      tip: () => (free && free < 1e9 ? t('su.dev.storage.low') : '') });
    render();
    rows.push(await micRow(ios));
    d.busy = false;
    const F = draft();
    F.device = { at: Date.now(), ok: verdict(rows), rows: rows.map(r => ({ k: r.k, ok: r.ok })) };
    G.save();
    if (WZ.dev === d) render();
  }
  // iPhone 版的系统一行：iOS 版本 + 机型（原生给的 hw.machine，比如 iPhone15,2）。
  // 最低 18.4：打包的配音是 Ogg 里的 Opus，iOS 18.4 起才放得出来（ios/README.md「最低 iOS」）；看不出版本就不拦
  function iosRow(dg) {
    const v = String(dg.ios || ''), mm = v.match(/^(\d+)(?:\.(\d+))?/), n = mm ? +mm[1] * 100 + (+mm[2] || 0) : 0, model = String(dg.model || '');
    return { k: 'ios', label: () => t('su.dev.ios'), ok: n ? n >= 1804 : null, val: () => (n ? t(model ? 'su.dev.ios.vm' : 'su.dev.ios.v', { v, model }) : t('su.dev.webview.unknown')),
      tip: () => (n && n < 1804 ? t('su.dev.ios.old') : '') };
  }
  // ios：iPhone 上「去打开」直接到「设置 → 回声岛」，里面就有麦克风开关（没有安卓的「权限」那一层）
  async function micRow(ios) {
    const row = { k: 'mic', label: () => t('su.dev.mic'), ok: false, val: () => '', tip: () => '' };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Object.assign(row, { ok: null, val: () => t('su.dev.mic.nobrowser') });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      try { s.getTracks().forEach(tr => tr.stop()); } catch (e) { /* 忽略 */ }
      return Object.assign(row, { ok: true, val: () => t('su.dev.mic.ok') });
    } catch (e) {
      let st = ''; try { if (nat('micPermission')) st = String(EchoNative.micPermission() || ''); } catch (er) { st = ''; }
      return Object.assign(row, { ok: false, val: () => t(st === 'blocked' ? 'su.dev.mic.blocked' : 'su.dev.mic.no'), fix: nat('openAppSettings'),
        tip: () => t(st === 'blocked' ? (ios ? 'su.dev.ios.mic.blocked' : 'su.dev.mic.fix.blocked') : ios ? 'su.dev.ios.mic.ask' : 'su.dev.mic.fix.ask') });
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
    return '<div class="su-hero">🩺</div><h2>' + h('su.dev.title') + '</h2>' +
      '<p>' + h(d && d.ios ? 'su.dev.ios.p' : 'su.dev.p') + '</p>' +
      '<ul class="su-dev">' + rows.map(r => { const tip = r.tip(); return '<li class="' + (r.ok === true ? 'ok' : r.ok === null ? 'na' : r.warn ? 'warn' : 'bad') + '" data-k="' + r.k + '"><i>' + icon(r) + '</i><div><b>' + esc(r.label()) + '</b><span>' + esc(r.val()) + '</span>' +
        (tip ? '<small>' + esc(tip) + '</small>' : '') + (r.fix && r.ok === false ? '<button class="btn small" data-act="suMicFix">' + h('su.dev.fix') + '</button>' : '') + '</div></li>'; }).join('') +
      (d && d.busy ? '<li class="na"><i>⏳</i><div><b>' + h('su.dev.checking') + '</b>' + (rows.some(r => r.k === 'storage') ? '<span>' + h(d.ios ? 'su.dev.ios.checking.mic' : 'su.dev.checking.mic') + '</span>' : '') + '</div></li>' : '') + '</ul>' +
      (v ? '<div class="su-verdict ' + v + '" id="su-verdict">' + h(v === 'ok' ? 'su.dev.v.ok' : v === 'warn' ? 'su.dev.v.warn' : 'su.dev.v.bad') + '</div>' +
        (v !== 'bad' && !WZ.edit && !selfPath(prof()) ? '<p class="su-small su-pay">' + h('su.dev.pay') + '</p>' : '') : '') +
      '<button class="btn small ghost" data-act="suDevRun"' + (d && d.busy ? ' disabled' : '') + '>' + h('su.dev.again') + '</button>';
  }

  // ⑥ 完成
  function pDone() {
    const F = draft(), ms = members(F), dv = F.device;
    const nick = F.nick ? checkNick(F.nick).name : '';
    // 参数里有 <b> 或者已经转义过的名字：这几行用 t() 拼
    const bad = k => '<b class="bad">' + h(k) + '</b>';
    return '<div class="su-hero">🎉</div><h2>' + h('su.open.done.t') + '</h2><ul class="su-sum">' +
      '<li>' + t('su.done.pin', { v: pinHas() ? h('su.done.pin.ok') : bad('su.done.pin.no') }) + '</li>' +
      '<li>' + t('su.open.done.key', { v: F.keyOk ? h('su.key.ok') : hasKey() ? h('su.key.has') : bad('su.done.key.no') + h('su.done.key.no.s') }) + '</li>' +
      '<li>' + h('su.done.nick', { v: nick || t('su.done.nick.later') }) + '</li>' +
      '<li>' + t('su.done.mons', { v: F.starters.length === 3 ? F.starters.map(id => esc((D.byId[id] || {}).en || id)).join(t('su.sep')) : h('su.done.mons.def') }) + '</li>' +
      '<li>' + t('su.done.fam', { v: ms.length ? ms.map(m => m.call).join(t('su.sep')) : h('su.done.fam.def') }) + '</li>' +
      '<li>' + t('su.open.done.dev', { v: !dv ? h('su.dev.none') : dv.ok === 'ok' ? h('su.dev.ok') : dv.ok === 'warn' ? h('su.done.dev.warn') : bad('su.dev.bad') }) + '</li></ul>' +
      '<p>' + h('su.done.p') + '</p>';
  }
  function finish() {
    const F = draft(), self = selfPath(F);
    if (!self && !pinHas()) { G.toast(t('su.need.pin')); go('pin'); return; }
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
    G.toast(t('su.saved'));
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
  // 家里人和开场的台词：s(英文, 中文意思)、L.nar(英文, 中文意思)，中文是内容（剧情中文），不进字表
  // @i18n-content-calls s:1 nar:1
  const sayer = m => (en, zh, x) => Object.assign({ who: m.call, look: m.look, g: m.g, en, zh }, x || {});
  async function famTalk(C, n, m, house) {
    const s = sayer(m), E = C.E;
    C.faceEach(n);
    if (house && !C.flag('starter')) { await C.talk([s('Professor Echo lives next door. Go and say hello!', '回声博士就住在隔壁，快去打个招呼吧！')]); return; }
    let pages;
    if (house) {
      pages = [
        s('Welcome home, {name}! You look tired.', '欢迎回家，{name}！你看起来累了。'),
        s('Let your monsters have a good rest.', '让你的怪兽们好好休息一下吧。', { onShow: () => { C.MG.healAll(); E.SFX.win(); E.toast(t('su.healed'), 'gold'); } }),
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
      suFamily: () => G.parentOk(t('su.why.fam'), () => { G.closeModal(); open('nick', true); }),
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
