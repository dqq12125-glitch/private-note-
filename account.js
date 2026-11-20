// 云端模式（公开版）：window.EchoCloud（开关和服务器地址）+ window.EchoAccount（账号、额度、会员、家长同意、举报、删号）。
// 接口合同在 cloud/API.md（一个字不差地照着写）；服务器在 cloud/。
//
// 什么时候是云端模式（EchoCloud.on）：打包时给了服务器地址——iPhone 版 make-config.mjs 的 ECHO_CLOUD_URL → BuildConfig.cloudUrl →
// GameViewController 启动对象 window.__ECHO_BOOT.cloudUrl；测试和网页版也可以用网址 ?cloud=<地址>（记进 localStorage['echo-cloud-url']，
// ?cloud=off 清掉）。没有地址就一切照旧：家庭版打包的密钥、销售版家长粘贴的密钥、网页版的家庭中转服务。
//
// 规矩（2026-11-20 老板：「客户不该看到粘贴密钥，我们管密钥，他们登录、每天几分钟免费 AI、买会员」）：
// - 不登录也能玩：冒险、闯关、复习都不要账号；只有 AI（聊天、口语自动打分、检测里的口语判分）要。第一次用 AI 又没登录时，
//   弹一张友好的「登录，每天免费用 n 分钟 AI」，不报错（ask / nudge）；口语题这时走「AI 用不了」那条路（先跳过、放进复习）。
// - 登录用的会话令牌存在 localStorage['echo-cloud-token']（不进存档 S：存档会导出、分享、备份）；钥匙串那一格是 AI 密钥的，不占用。
//   GET /v1/me 的结果缓存在 localStorage['echo-cloud-me']（没有令牌），首页 / 聊天页的「还剩几分钟」读它，额度的数字一律照服务器的。
// - 年龄段没设：登录后先问（中性的三个按钮，不预选）；13 岁以下、家长还没同意：聊天前走「请家长同意」（家长邮箱 → 邮件 → 这里自动刷新）。
// - 买会员（只有 iPhone：EchoNative.iapProducts 在）：服务器给的 iapToken → iapBuy → 交易的 JWS 交给 POST /v1/iap/apple →
//   **服务器说存好了（200）才 iapFinish**；每次打开 App、每次登录先 iapPending（逐笔交服务器、存好再 finish）再 iapCurrent（交服务器核对）；
//   echo-iap 事件（续费、退款、到期、换方案）同样交服务器、存好再 finish。孩子模式下买东西要家长密码，会员页对家长说话。安卓还没有结算：只显示方案和额度、说「很快就能买」，没有买的按钮。
// - 举报（聊天里每句 AI 的话、评语页）→ POST /v1/report；删号（设置里，确认两次）→ DELETE /v1/me，手机里的进度留着。
(function () {
  'use strict';
  const W = window;
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return ''; } return ''; };

  // ---------- 开关和地址 ----------
  const okUrl = u => /^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(u);
  const normUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  function pickUrl() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('cloud')) { const v = normUrl(q.get('cloud')); LS('echo-cloud-url', v && okUrl(v) ? v : null); }
    } catch (e) { /* 没有网址参数 */ }
    const boot = W.__ECHO_BOOT || {};
    for (const u of [boot.cloudUrl, W.ECHO_CLOUD_URL, LS('echo-cloud-url')]) { const v = normUrl(u); if (v && okUrl(v)) return v; }
    return '';
  }
  const BASE = pickUrl();
  const CLOUD = W.EchoCloud = Object.freeze({ on: !!BASE, url: BASE, api: BASE ? BASE + '/v1' : '', ws: BASE ? BASE.replace(/^http/, 'ws') + '/v1' : '' });

  // ---------- 界面文字（键前缀 ac.）----------
  const I18N = W.EchoI18n;
  const t = (k, p) => (I18N ? I18N.t(k, p) : k), h = (k, p) => (I18N ? I18N.h(k, p) : k);
  if (I18N) I18N.add({
    zh: {
      // 登录
      'ac.in.h': '登录，每天免费用 {n} 分钟 AI', 'ac.in.h.again': '请重新登录',
      'ac.in.p': '和岛民聊天、口语自动打分要用 AI。登录一个账号，每天送 {n} 分钟 AI 聊天；不登录也能玩冒险、闯关和复习。',
      'ac.in.p.again': '登录已经过期了（或者在别的地方退出了）。重新登录就能接着用 AI。',
      'ac.in.kid': '小朋友：请让爸爸妈妈来登录。', 'ac.in.apple': ' 通过 Apple 登录', 'ac.in.or': '或者用邮箱',
      'ac.in.email.ph': '邮箱地址', 'ac.in.send': '发送验证码', 'ac.in.sent': '6 位验证码已经发到 {email}，10 分钟内有效。',
      'ac.in.code.ph': '6 位验证码', 'ac.in.go': '登录', 'ac.in.change': '换个邮箱 / 重新发送',
      'ac.in.legal': '登录就表示同意下面两份文件：', 'ac.in.later': '以后再说', 'ac.wait': '请稍等……',
      'ac.in.bad.email': '这个邮箱地址好像不对', 'ac.in.bad.code': '验证码不对，再看一下邮件', 'ac.in.expired': '验证码过期了，请重新发送',
      'ac.in.rate': '试得太多了，过一会儿再来', 'ac.in.net': '连不上服务器，检查一下网络', 'ac.in.noemail': '现在发不了邮件，请稍后再试',
      'ac.in.apple.fail': 'Apple 登录没成功，再试一次或者用邮箱', 'ac.in.ok': '登录好了！', 'ac.in.ok.new': '账号建好了，欢迎！',
      // 年龄段
      'ac.age.h': '谁在用这个账号？', 'ac.age.p': '请选年龄段。我们只记年龄段，不记生日。',
      'ac.age.btn': '选年龄段', 'ac.age.child': '13 岁以下','ac.age.teen': '13–17 岁', 'ac.age.adult': '18 岁及以上',
      'ac.age.note': '13 岁以下的孩子要先得到家长同意，才能和岛民语音聊天。选好以后不能自己改大。',
      // 家长同意
      'ac.c.h': '先请家长同意', 'ac.c.p': '和岛民语音聊天之前，要请爸爸妈妈同意。写下家长的邮箱，我们发一封信，家长在信里按「我同意」就可以了。',
      'ac.c.ph': '家长的邮箱', 'ac.c.send': '发给家长', 'ac.c.sent': '已经发到 {email}。',
      'ac.c.wait': '请家长打开邮件，按「我同意」。同意以后这里会自动更新。', 'ac.c.check': '家长已经同意了', 'ac.c.again': '换个邮箱 / 再发一次',
      'ac.c.not': '还没收到同意。请家长看一下邮件（也看看垃圾邮件）。', 'ac.c.ok': '家长同意了，可以和岛民聊天了！',
      'ac.c.bad': '这个邮箱不行（不能和账号的邮箱一样）', 'ac.c.revoked': '家长撤回过同意，要再请家长同意一次。', 'ac.c.other': '不用 AI 也能玩冒险、闯关和复习。',
      // 额度
      'ac.q.h': '今天的免费 AI 时间用完了', 'ac.q.p': '{time} 又有了。想多聊，可以看看会员。', 'ac.q.p.m': '{time} 又有了。',
      'ac.q.member': '👑 看看会员', 'ac.ok': '好的', 'ac.close': '关闭', 'ac.cancel': '取消',
      // 聊天
      'ac.t.left': '🤖 AI 今天还剩 {n} 分钟', 'ac.t.secs': '🤖 AI 还剩 {n} 秒', 'ac.t.warn': '⏳ 还剩 {n} 秒，准备和 TA 说再见吧',
      'ac.t.warn.s': '⏳ 这段聊天还剩 {n} 秒，准备说再见吧', 'ac.t.out': '今天的免费 AI 时间用完了，明天再来，或者看看会员。',
      'ac.t.report': '举报这句话', 'ac.t.report.eval': '⚑ 举报这段评语',
      // 出错 / 提示条
      'ac.err.signin': '要先登录才能用 AI', 'ac.err.consent': '要先请家长同意，才能和岛民语音聊天', 'ac.err.quota': '今天的免费 AI 时间用完了，明天再来吧！',
      'ac.btn.signin': '登录', 'ac.btn.consent': '请家长同意', 'ac.btn.member': '👑 会员',
      'ac.fail.signin': '🔑 登录以后，AI 才能给你的口语打分', 'ac.fail.quota': '⏳ 今天的免费 AI 用完了，明天再来',
      'ac.bar.signin': '🔑 还没登录：口语没法自动打分、不能和岛民聊天', 'ac.bar.quota': '⏳ 今天的免费 AI 用完了', 'ac.chk.nokey': '（还没登录）',
      'ac.env.signin': '⚠️ 口语自动打分：登录以后才能用',
      // 学习锁、周报
      'ac.gate.nosign': '和岛民聊天（还没登录 AI 账号，今天先跳过）', 'ac.gate.consent': '和岛民聊天（还在等家长同意，今天先跳过）',
      'ac.rp.ex.nosign': '没登录 AI 账号', 'ac.rp.ex.consent': '等家长同意',
      // 会员
      'ac.m.h': '👑 会员', 'ac.m.h.kid': '👑 会员（请家长来看）', 'ac.m.kid': '家长您好：会员是自动续期的订阅，购买要输入家长密码。',
      'ac.plan.free': '免费版', 'ac.plan.monthly': '月度会员', 'ac.plan.yearly': '年度会员',
      'ac.m.until': '有效到 {d}', 'ac.m.grace': '扣费没成功，宽限到 {d}；请在 App Store 里更新付款方式', 'ac.m.expired': '会员已经到期', 'ac.m.revoked': '订阅已经退款',
      'ac.m.left': '今天 AI 聊天还剩 {n} 分钟，{time} 重置', 'ac.m.asr': '口语打分今天还能用 {n} 次',
      'ac.m.signin': '先登录，才能看会员和买会员。', 'ac.m.loading': '正在读取价格……', 'ac.m.noprod': '暂时读不到会员的价格，稍后再试。',
      'ac.m.buy': '订阅', 'ac.m.cur': '正在用', 'ac.m.trial': '可以免费试用 {p}',
      'ac.per.month': '每月', 'ac.per.year': '每年', 'ac.per.week': '每周', 'ac.per.day': '每天', 'ac.per.months': '每 {n} 个月', 'ac.per.years': '每 {n} 年', 'ac.per.weeks': '每 {n} 周', 'ac.per.days': '每 {n} 天',
      'ac.dur.month': '{n} 个月', 'ac.dur.year': '{n} 年', 'ac.dur.week': '{n} 周', 'ac.dur.day': '{n} 天',
      'ac.m.restore': '恢复购买', 'ac.m.manage': '管理订阅',
      'ac.m.legal': '订阅会自动续期，直到你取消。费用从 Apple 账户扣；当期结束前至少 24 小时在 iPhone「设置 → 你的名字 → 订阅」里取消，就不会再续费。',
      'ac.m.terms': '📄 使用条款', 'ac.m.privacy': '📄 隐私说明',
      'ac.m.nopay': '这台设备不允许购买（可能是「屏幕使用时间」关掉了 App 内购买）。',
      'ac.m.soon': '这个版本里还不能买会员，很快就可以了。每天的免费 AI 照常能用。',
      'ac.buy.why': '购买会员', 'ac.buy.ok': '🎉 会员开通了！', 'ac.buy.pending': '等批准（家人共享的「询问购买」）或者付款处理好以后就会开通。',
      'ac.buy.later': '买好了，正在和服务器核对，稍后会自动开通。', 'ac.buy.owned': '这个订阅已经绑在另一个回声岛账号上了。',
      'ac.buy.e.disabled': '这台设备不允许购买', 'ac.buy.e.busy': '上一笔还没完成', 'ac.buy.e.network': '连不上 App Store，稍后再试', 'ac.buy.e.other': '没买成，稍后再试',
      'ac.rs.ok': '恢复好了', 'ac.rs.none': '没找到可以恢复的会员',
      'ac.iap.purchase': '👑 会员开通了', 'ac.iap.renewal': '👑 会员已经续期', 'ac.iap.revoked': '订阅已经退款，现在是免费版', 'ac.iap.expired': '会员到期了，现在是免费版', 'ac.iap.upgraded': '👑 会员方案换好了',
      // 账号
      'ac.a.h': '👤 账号', 'ac.a.email': '邮箱：{e}', 'ac.a.apple': '通过 Apple 登录', 'ac.a.none': '还没登录。不登录也能玩，只是不能用 AI。',
      'ac.a.age': '年龄段：{a}', 'ac.a.age.none': '还没选', 'ac.a.consent': '家长同意：{s}',
      'ac.cs.none': '还没有', 'ac.cs.pending': '等家长按同意', 'ac.cs.granted': '已同意', 'ac.cs.revoked': '已撤回',
      'ac.a.signout': '退出登录', 'ac.a.delete': '删除账号', 'ac.out.ok': '已经退出登录',
      'ac.set.row': '👤 账号和会员', 'ac.set.in': '已登录 · {plan}', 'ac.set.out': '还没登录（AI 要登录才能用）', 'ac.set.btn': '打开',
      // 删号
      'ac.d.h': '删除账号',
      'ac.d.p': '<li>服务器上这个账号的东西会<b>马上全部删掉</b>：账号、登录、每天用了多少 AI、家长同意的记录、举报过的话。删了不能恢复。</li><li>这台设备里的游戏进度<b>不会</b>删，还留着（要删可以在设置里清空进度，或者卸载 App）。</li><li>App Store 的订阅<b>不会</b>自动取消：请到 iPhone「设置 → 你的名字 → 订阅」里取消。</li>',
      'ac.d.go': '继续', 'ac.d.h2': '真的要删除吗？', 'ac.d.p2': '这一步不能撤销。', 'ac.d.final': '永久删除账号',
      'ac.d.done': '账号已经删除。游戏进度还在这台设备上。', 'ac.d.sub': '如果买过会员，记得到 App Store 取消订阅。', 'ac.d.fail': '没删成，检查网络后再试',
      // 举报
      'ac.r.h': '⚑ 举报', 'ac.r.p': '觉得 AI 说的话不对劲？告诉我们，我们会检查。这几句聊天会发给我们，保留 90 天。',
      'ac.r.rude': '不礼貌', 'ac.r.scary': '吓人', 'ac.r.wrong': '说错了', 'ac.r.personal': '问我的个人信息', 'ac.r.other': '别的',
      'ac.r.note.ph': '想说的话（可以不写）', 'ac.r.send': '发送', 'ac.r.ok': '谢谢！我们收到了。', 'ac.r.fail': '没发出去，稍后再试',
      // 首页聊天那一栏
      'ac.s.signin': '✨ 登录，每天免费用 {n} 分钟 AI 聊天', 'ac.s.left': '🤖 今天 AI 聊天还剩 {n} 分钟', 'ac.s.parent': '👪 和岛民语音聊天要先请家长同意',
      'ac.s.age': '👤 先选一下年龄段', 'ac.s.account': '👤 账号',
      // 首次设置向导（云端模式代替「粘贴 AI 密钥」那一页）
      'ac.su.tab': 'AI 账号', 'ac.su.title': 'AI 和账号',
      'ac.su.p1': '和岛民用英语聊天、给口语打分，是由<b>人工智能（AI）</b>完成的。AI 生成的内容在 App 里都标着「AI 生成」。',
      'ac.su.p2': '<b>登录一个账号</b>（邮箱验证码，或者通过 Apple 登录），每天免费用 {n} 分钟 AI 聊天；想多用可以买会员。不用自己准备任何密钥。',
      'ac.su.p3': '现在登录、以后再登录都可以。不登录也能玩冒险、闯关和复习，只是不能用 AI。',
      'ac.su.kid': '给孩子用：请<b>家长</b>来登录。13 岁以下的孩子，第一次聊天前还要家长在邮件里按「同意」。',
      'ac.su.signin': '现在登录', 'ac.su.done': '✅ 已登录：{who}', 'ac.su.sum': '🤖 AI 账号：{v}', 'ac.su.sum.in': '已登录', 'ac.su.sum.out': '还没登录（以后在设置里登录）',
      'ac.su.pr.2.kid': '聊天和口语打分时，孩子说话的<b>声音和识别出来的文字</b>经过回声岛的服务器交给阿里云（国际版）处理，处理完不保存；服务器只记账号、每天用了多少 AI，不存聊天记录和录音。',
      'ac.su.pr.2.open': '聊天和口语打分时，您说话的<b>声音和识别出来的文字</b>经过回声岛的服务器交给阿里云（国际版）处理，处理完不保存；服务器只记账号、每天用了多少 AI，不存聊天记录和录音。',
      'ac.su.pr.4': '随时可以在设置里退出登录、删除账号、清空进度，或者卸载 App 删掉这台设备里的全部数据。',
      'ac.su.kid.under': '不同意的话请不要继续。',
      // 家长须知（聊天页）
      'ac.pv.s2': '<li>聊天、口语打分时，孩子说话的<b>声音和识别出来的文字</b>经过回声岛的服务器交给<b>阿里云（国际版）</b>处理。服务器<b>不保存</b>聊天记录和录音；只有在某句 AI 的话上按了「⚑ 举报」，那几句才会存 90 天给我们检查。</li>',
      'ac.pv.s5': '<li>聊天记录、岛民记住的小事<b>只存在这台设备里</b>（最近 30 段），卸载 App 就全部删掉。每天能用多少 AI 看账号的方案（「👑 会员」里写着）。</li>',
    },
    en: {
      'ac.in.h': 'Sign in for {n} free AI minutes every day', 'ac.in.h.again': 'Please sign in again',
      'ac.in.p': 'Chatting with islanders and automatic speaking scores use AI. Sign in to get {n} minutes of AI chat every day. You can play the adventure, levels and reviews without an account.',
      'ac.in.p.again': 'Your sign-in has expired (or you signed out somewhere else). Sign in again to keep using AI.',
      'ac.in.kid': 'If you are a child, ask a parent to sign in.', 'ac.in.apple': ' Sign in with Apple', 'ac.in.or': 'or use your email',
      'ac.in.email.ph': 'Email address', 'ac.in.send': 'Send code', 'ac.in.sent': 'A 6-digit code was sent to {email}. It works for 10 minutes.',
      'ac.in.code.ph': '6-digit code', 'ac.in.go': 'Sign in', 'ac.in.change': 'Change email / send again',
      'ac.in.legal': 'By signing in you agree to these two documents:', 'ac.in.later': 'Not now', 'ac.wait': 'Please wait…',
      'ac.in.bad.email': 'That email address does not look right', 'ac.in.bad.code': 'That code is not right. Check the email again', 'ac.in.expired': 'The code has expired. Send a new one',
      'ac.in.rate': 'Too many tries. Wait a little, then try again', 'ac.in.net': 'Cannot reach the server. Check the internet connection', 'ac.in.noemail': 'Email cannot be sent right now. Try again later',
      'ac.in.apple.fail': 'Sign in with Apple did not work. Try again or use email', 'ac.in.ok': 'Signed in!', 'ac.in.ok.new': 'Account created. Welcome!',
      'ac.age.h': 'Who uses this account?', 'ac.age.p': 'Choose an age group. We only keep the age group, never a birthday.',
      'ac.age.btn': 'Choose', 'ac.age.child': 'Under 13','ac.age.teen': '13–17', 'ac.age.adult': '18 or older',
      'ac.age.note': 'Children under 13 need a parent to agree before they can chat with islanders by voice. Once chosen, the age group cannot be raised without a parent.',
      'ac.c.h': 'Ask a parent first', 'ac.c.p': 'Before you chat with islanders by voice, a parent needs to agree. Enter a parent\'s email: we will send a letter, and the parent just taps "I agree" in it.',
      'ac.c.ph': 'Parent\'s email', 'ac.c.send': 'Send to parent', 'ac.c.sent': 'Sent to {email}.',
      'ac.c.wait': 'Ask your parent to open the email and tap "I agree". This page updates by itself.', 'ac.c.check': 'My parent has agreed', 'ac.c.again': 'Change email / send again',
      'ac.c.not': 'No permission yet. Ask your parent to check their email (and the spam folder).', 'ac.c.ok': 'Your parent agreed. You can chat with the islanders now!',
      'ac.c.bad': 'That email does not work (it cannot be the account\'s own email)', 'ac.c.revoked': 'A parent withdrew permission. Ask them to agree again.', 'ac.c.other': 'You can still play the adventure, levels and reviews without AI.',
      'ac.q.h': 'Today\'s free AI minutes are used up', 'ac.q.p': 'You get more at {time}. To chat more, see Membership.', 'ac.q.p.m': 'You get more at {time}.',
      'ac.q.member': '👑 See Membership', 'ac.ok': 'OK', 'ac.close': 'Close', 'ac.cancel': 'Cancel',
      'ac.t.left': { one: '🤖 AI left today: {n} min', other: '🤖 AI left today: {n} min' }, 'ac.t.secs': '🤖 AI left: {n} s', 'ac.t.warn': '⏳ {n} seconds left. Get ready to say goodbye',
      'ac.t.warn.s': '⏳ {n} seconds left in this chat. Get ready to say goodbye', 'ac.t.out': 'Today\'s free AI minutes are used up. Come back tomorrow, or see Membership.',
      'ac.t.report': 'Report this message', 'ac.t.report.eval': '⚑ Report these comments',
      'ac.err.signin': 'Sign in first to use AI', 'ac.err.consent': 'A parent needs to agree before you can chat by voice', 'ac.err.quota': 'Today\'s free AI minutes are used up. Come back tomorrow!',
      'ac.btn.signin': 'Sign in', 'ac.btn.consent': 'Ask a parent', 'ac.btn.member': '👑 Membership',
      'ac.fail.signin': '🔑 Sign in so the AI can score your speaking', 'ac.fail.quota': '⏳ Today\'s free AI is used up. Come back tomorrow',
      'ac.bar.signin': '🔑 Not signed in: no automatic speaking scores or chats', 'ac.bar.quota': '⏳ Today\'s free AI is used up', 'ac.chk.nokey': '(not signed in)',
      'ac.env.signin': '⚠️ Automatic speaking score: sign in to use it',
      'ac.gate.nosign': 'Chat with islanders (no AI account signed in, skipped today)', 'ac.gate.consent': 'Chat with islanders (waiting for a parent to agree, skipped today)',
      'ac.rp.ex.nosign': 'No AI account', 'ac.rp.ex.consent': 'Waiting for a parent',
      'ac.m.h': '👑 Membership', 'ac.m.h.kid': '👑 Membership (for parents)', 'ac.m.kid': 'For parents: Membership is an auto-renewing subscription. Buying needs the parent PIN.',
      'ac.plan.free': 'Free', 'ac.plan.monthly': 'Monthly Membership', 'ac.plan.yearly': 'Yearly Membership',
      'ac.m.until': 'Active until {d}', 'ac.m.grace': 'Payment failed; grace period until {d}. Please update your payment method in the App Store', 'ac.m.expired': 'Membership has ended', 'ac.m.revoked': 'The subscription was refunded',
      'ac.m.left': { one: 'AI chat left today: {n} minute. Resets at {time}', other: 'AI chat left today: {n} minutes. Resets at {time}' }, 'ac.m.asr': 'Speaking scores left today: {n}',
      'ac.m.signin': 'Sign in first to see or buy Membership.', 'ac.m.loading': 'Loading prices…', 'ac.m.noprod': 'Cannot load prices right now. Try again later.',
      'ac.m.buy': 'Subscribe', 'ac.m.cur': 'Current plan', 'ac.m.trial': 'Free trial: {p}',
      'ac.per.month': 'per month', 'ac.per.year': 'per year', 'ac.per.week': 'per week', 'ac.per.day': 'per day', 'ac.per.months': 'every {n} months', 'ac.per.years': 'every {n} years', 'ac.per.weeks': 'every {n} weeks', 'ac.per.days': 'every {n} days',
      'ac.dur.month': { one: '{n} month', other: '{n} months' }, 'ac.dur.year': { one: '{n} year', other: '{n} years' }, 'ac.dur.week': { one: '{n} week', other: '{n} weeks' }, 'ac.dur.day': { one: '{n} day', other: '{n} days' },
      'ac.m.restore': 'Restore purchases', 'ac.m.manage': 'Manage subscription',
      'ac.m.legal': 'Subscriptions renew automatically until you cancel. Payment is charged to your Apple Account. To stop renewal, cancel at least 24 hours before the current period ends in Settings → your name → Subscriptions.',
      'ac.m.terms': '📄 Terms of Use', 'ac.m.privacy': '📄 Privacy Notice',
      'ac.m.nopay': 'This device does not allow purchases (Screen Time may have turned off in-app purchases).',
      'ac.m.soon': 'Membership cannot be bought in this version yet. It is coming soon. Your free daily AI works as usual.',
      'ac.buy.why': 'Buy Membership', 'ac.buy.ok': '🎉 Membership is on!', 'ac.buy.pending': 'It will start once it is approved (Ask to Buy) or the payment goes through.',
      'ac.buy.later': 'Purchased. Checking with our server; it will switch on shortly.', 'ac.buy.owned': 'This subscription belongs to another Echo Island account.',
      'ac.buy.e.disabled': 'This device does not allow purchases', 'ac.buy.e.busy': 'The last purchase is not finished yet', 'ac.buy.e.network': 'Cannot reach the App Store. Try again later', 'ac.buy.e.other': 'The purchase did not go through. Try again later',
      'ac.rs.ok': 'Restored', 'ac.rs.none': 'No membership to restore was found',
      'ac.iap.purchase': '👑 Membership is on', 'ac.iap.renewal': '👑 Membership renewed', 'ac.iap.revoked': 'The subscription was refunded. You are on the free plan now', 'ac.iap.expired': 'Membership has ended. You are on the free plan now', 'ac.iap.upgraded': '👑 Your plan has changed',
      'ac.a.h': '👤 Account', 'ac.a.email': 'Email: {e}', 'ac.a.apple': 'Signed in with Apple', 'ac.a.none': 'Not signed in. You can still play, just without AI.',
      'ac.a.age': 'Age group: {a}', 'ac.a.age.none': 'not chosen', 'ac.a.consent': 'Parent permission: {s}',
      'ac.cs.none': 'not yet', 'ac.cs.pending': 'waiting for the parent', 'ac.cs.granted': 'given', 'ac.cs.revoked': 'withdrawn',
      'ac.a.signout': 'Sign out', 'ac.a.delete': 'Delete account', 'ac.out.ok': 'Signed out',
      'ac.set.row': '👤 Account & Membership', 'ac.set.in': 'Signed in · {plan}', 'ac.set.out': 'Not signed in (AI needs an account)', 'ac.set.btn': 'Open',
      'ac.d.h': 'Delete account',
      'ac.d.p': '<li>Everything for this account on our server is <b>deleted right away</b>: the account, sign-ins, daily AI use, parent permission records and reported lines. This cannot be undone.</li><li>The game progress on this device is <b>not</b> deleted; it stays here (to remove it, clear progress in Settings or uninstall the app).</li><li>An App Store subscription is <b>not</b> cancelled automatically: cancel it in Settings → your name → Subscriptions.</li>',
      'ac.d.go': 'Continue', 'ac.d.h2': 'Really delete?', 'ac.d.p2': 'This cannot be undone.', 'ac.d.final': 'Delete permanently',
      'ac.d.done': 'Account deleted. Your game progress is still on this device.', 'ac.d.sub': 'If you bought Membership, remember to cancel the subscription in the App Store.', 'ac.d.fail': 'Could not delete. Check the connection and try again',
      'ac.r.h': '⚑ Report', 'ac.r.p': 'Did the AI say something wrong? Tell us and we will check it. These chat lines are sent to us and kept for 90 days.',
      'ac.r.rude': 'Rude', 'ac.r.scary': 'Scary', 'ac.r.wrong': 'Wrong', 'ac.r.personal': 'Asked for personal info', 'ac.r.other': 'Other',
      'ac.r.note.ph': 'Anything to add (optional)', 'ac.r.send': 'Send', 'ac.r.ok': 'Thank you! We got it.', 'ac.r.fail': 'Could not send. Try again later',
      'ac.s.signin': '✨ Sign in for {n} free minutes of AI chat every day', 'ac.s.left': { one: '🤖 AI chat left today: {n} minute', other: '🤖 AI chat left today: {n} minutes' }, 'ac.s.parent': '👪 A parent needs to agree before voice chat',
      'ac.s.age': '👤 Choose your age group first', 'ac.s.account': '👤 Account',
      'ac.su.tab': 'AI account', 'ac.su.title': 'AI and your account',
      'ac.su.p1': 'Chatting with islanders in English and scoring speaking are done by <b>artificial intelligence (AI)</b>. AI-generated content is labelled "AI" in the app.',
      'ac.su.p2': '<b>Sign in</b> (email code or Sign in with Apple) to get {n} minutes of AI chat free every day; Membership gives you more. You do not need any key of your own.',
      'ac.su.p3': 'You can sign in now or later. Without an account you can still play the adventure, levels and reviews, just without AI.',
      'ac.su.kid': 'For a child: a <b>parent</b> should sign in. For children under 13, a parent also taps "I agree" in an email before the first chat.',
      'ac.su.signin': 'Sign in now', 'ac.su.done': '✅ Signed in: {who}', 'ac.su.sum': '🤖 AI account: {v}', 'ac.su.sum.in': 'signed in', 'ac.su.sum.out': 'not signed in (sign in later in Settings)',
      'ac.su.pr.2.kid': 'When your child chats or their speaking is scored, <b>their voice and the recognised text</b> go through the Echo Island server to Alibaba Cloud (international) for processing and are not kept afterwards. The server only keeps the account and how much AI was used each day, never chats or recordings.',
      'ac.su.pr.2.open': 'When you chat or your speaking is scored, <b>your voice and the recognised text</b> go through the Echo Island server to Alibaba Cloud (international) for processing and are not kept afterwards. The server only keeps the account and how much AI was used each day, never chats or recordings.',
      'ac.su.pr.4': 'At any time you can sign out, delete the account or clear progress in Settings, or uninstall the app to remove all data on this device.',
      'ac.su.kid.under': 'If you do not agree, please do not continue.',
      'ac.pv.s2': '<li>During chats and speech scoring, the child\'s <b>voice and the recognised text</b> go through the Echo Island server to <b>Alibaba Cloud (international)</b>. The server does <b>not keep</b> chats or recordings; only the few lines around a message someone reports with "⚑ Report" are kept for 90 days so we can check them.</li>',
      'ac.pv.s5': '<li>The chat log and the small things islanders remember are <b>kept only on this device</b> (the last 30 chats). Uninstalling the app deletes all of it. How much AI can be used each day depends on the account\'s plan (see "👑 Membership").</li>',
    },
  });

  // ---------- 状态 ----------
  // 测试里改短：EchoAccount.cfg（poll 家长同意多久查一次）
  const CFG = { http: 15000, poll: 5000, ws: 15000 };
  const FREE_MIN = 5;   // 只用在「登录送几分钟」的宣传句里（还没登录拿不到服务器的数）；登录以后一律显示 GET /v1/me 的数
  const MIN_START = 20; // 服务器 TALK_MIN_START_SEC 的默认值：今天剩的不到这么多秒，开聊会被 402 挡（API.md §8）
  const GATED = ['talk', 'place', 'steps'];
  const K = { tok: 'echo-cloud-token', me: 'echo-cloud-me', apple: 'echo-cloud-apple' };
  let G = null;
  const A = { me: null, at: 0, pend: null, pendF: '', nudged: false, again: false, form: { step: 'email', email: '', msg: '', busy: false }, prods: null, prodErr: '', canPay: true, buying: false, poll: 0 };
  try { A.me = JSON.parse(LS(K.me) || 'null'); } catch (e) { A.me = null; }
  const token = () => (CLOUD.on ? LS(K.tok) : '');
  const signed = () => !!token();
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nat = f => { try { return !!(W.EchoNative && typeof EchoNative[f] === 'function'); } catch (e) { return false; } };
  const diag = () => { try { return JSON.parse(EchoNative.diag() || '{}') || {}; } catch (e) { return {}; } };
  const ui = () => { try { return (G && G.S && G.S.settings.ui) || (I18N && I18N.lang()) || 'zh'; } catch (e) { return 'zh'; } };
  const loc = () => (ui() === 'zh' ? 'zh-CN' : 'en-GB');
  const tz = () => -new Date().getTimezoneOffset();
  const kid = () => { try { return !!(G && G.kidMode && G.kidMode()); } catch (e) { return false; } };
  const toast = m => { try { if (G) G.toast(m); } catch (e) { /* 没启动 */ } };
  const parse = s => { try { return typeof s === 'string' ? JSON.parse(s) : s || {}; } catch (e) { return {}; } };
  const canIap = () => nat('iapProducts') && nat('iapBuy');
  const canApple = () => nat('appleSignIn') && diag().appleSignIn === true;
  const timeOf = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }); };
  const dateOf = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(loc()); };
  // 原生的异步方法（iPhone 才有的订阅、通过 Apple 登录）：编号和回调表在 talk.js（window.__echoNative）
  const native = (m, args, ms) => (W.EchoTalk && EchoTalk.nativeCall ? EchoTalk.nativeCall(m, args, ms) : Promise.resolve({ type: 'fail', data: '{"error":"nonative"}' }));

  // ---------- 调服务器 ----------
  // → { ok, status, json, text, why }；why：signin（401）/ quota（402）/ consent（403）/ busy（429、503 provider / unavailable、500）/ network（连不上）/ offline
  const whyOf = (st, j) => { const e = j && j.error; return e === 'auth' ? 'signin' : e === 'quota' ? 'quota' : e === 'consent' ? 'consent' : e === 'rate' || e === 'provider' || e === 'unavailable' || e === 'server' ? 'busy' : 'network'; };   // 服务器答了 503 / 500：是它那边的事，不算没网
  async function call(method, path, body, o) {
    o = o || {};
    if (!CLOUD.on) return { ok: false, status: 0, json: null, text: 'no cloud', why: 'network' };
    const tk = token(), h = {};
    if (!o.noAuth) {
      if (!tk) return { ok: false, status: 401, json: { error: 'auth', reason: 'token' }, text: '{"error":"auth","reason":"token"}', why: 'signin' };
      h.Authorization = 'Bearer ' + tk;
    }
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), o.ms || CFG.http);
    let r, text = '';
    try { r = await fetch(CLOUD.api + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctl.signal }); text = await r.text(); }
    catch (e) { return { ok: false, status: 0, json: null, text: String((e && e.message) || e), why: navigator.onLine === false ? 'offline' : 'network' }; }
    finally { clearTimeout(tm); }
    let json = null; try { json = JSON.parse(text); } catch (e) { json = null; }
    const res = { ok: r.ok, status: r.status, json, text };
    if (!r.ok) {
      res.why = whyOf(r.status, json);
      if (r.status === 401 && !o.noAuth && tk === token()) lost();
      if (r.status === 402 && json) noteQuota(json.meter);
      if (r.status === 403 && json && json.error === 'consent') refresh();
    } else if (json && json.quota && json.quota.meter) noteLeft(json.quota.meter, json.quota.left);
    return res;
  }
  // talk.js 的 relayPost 在云端模式下走这里（/asr、/tip、/tts、/zh、/steps、/place）：→ { ok, status, text, why }
  async function post(path, body, ms) { const r = await call('POST', path, body, { ms }); return { ok: r.ok, status: r.status, text: r.text, why: r.why }; }

  // ---------- 账号缓存 ----------
  function setMe(me) {
    if (!me || typeof me !== 'object') return;
    A.me = me; A.at = Date.now();
    LS(K.me, JSON.stringify(me));
    changed();
  }
  // 账号变了（登录、退出、额度、方案）：首页重画、红条重算，再发一个 echo-account 事件（向导开着就重画那一页）
  function changed() {
    try { if (G && G.renderHome && !$('#home').hidden && $('#modal').hidden) G.renderHome(); } catch (e) { /* 还没启动 */ }
    try { if (G && G.refreshBars) G.refreshBars(); } catch (e) { /* 还没启动 */ }
    try { W.dispatchEvent(new CustomEvent('echo-account')); } catch (e) { /* 老浏览器 */ }
  }
  let refreshing = null;
  function refresh() {
    if (!signed()) return Promise.resolve(null);
    if (refreshing) return refreshing;
    refreshing = call('GET', '/me').then(r => { refreshing = null; if (r.ok && r.json) setMe(r.json); return r.ok ? A.me : null; }, () => { refreshing = null; return null; });
    return refreshing;
  }
  // 令牌没用了（401）：本机清掉，下次用 AI 时请他重新登录
  function lost() { clearLocal(); A.again = true; }
  function clearLocal() { LS(K.tok, null); LS(K.me, null); LS(K.apple, null); A.me = null; A.at = 0; A.prods = null; changed(); }
  function noteQuota(meter) {
    const q = A.me && A.me.quota; if (!q) return;
    if (meter === 'talk' && q.talk) q.talk.leftSec = 0; else if (q[meter]) q[meter].left = 0;
    LS(K.me, JSON.stringify(A.me)); changed();
  }
  function noteLeft(meter, left) { const q = A.me && A.me.quota; if (!q || !q[meter] || typeof left !== 'number') return; q[meter].left = left; LS(K.me, JSON.stringify(A.me)); }
  // 今天聊天还剩几秒（服务器的数；过了重置的时间就是整份）；不知道 = null
  function talkLeft() {
    const q = A.me && A.me.quota; if (!q || !q.talk) return null;
    if (q.resetsAt && Date.now() >= Date.parse(q.resetsAt)) return q.talk.limitSec;
    return Math.max(0, q.talk.leftSec | 0);
  }
  const freeMin = () => FREE_MIN;
  const planName = me => t('ac.plan.' + (me && /^(monthly|yearly)$/.test(me.plan) ? me.plan : 'free'));

  // ---------- 用 AI 之前看一眼：'' 能用；signin 没登录 / age 年龄段没设 / parent 孩子没有家长同意 / quota 今天聊天的时间用完了 ----------
  function need(f) {
    if (!CLOUD.on) return '';
    if (!signed()) return 'signin';
    const me = A.me; if (!me) return '';   // 还没拿到账号信息：让服务器说
    if (GATED.includes(f)) {
      const off = me.features ? me.features[f] === false : (!me.ageGroup || (me.ageGroup === 'child' && !(me.consent && me.consent.state === 'granted')));
      if (off) return me.ageGroup ? 'parent' : 'age';
    }
    if (f === 'talk') { const l = talkLeft(); if (l != null && l < MIN_START) return 'quota'; }
    return '';
  }
  // 能用返回 true；不能用就弹对应的那一页（登录 / 年龄段 / 请家长同意 / 时间用完），弄好了接着做 then
  function ask(f, then) {
    const w = need(f);
    if (!w) return true;
    A.pend = then || null; A.pendF = f || '';
    sheetFor(w);
    return false;
  }
  function sheetFor(w) {
    if (w === 'signin') signInSheet();
    else if (w === 'age') ageSheet();
    else if (w === 'parent') consentSheet();
    else if (w === 'quota') quotaSheet();
  }
  // 弄好了一步（登录 / 选了年龄段 / 家长同意了）：还差别的就接着弹，都好了就关掉、接着做原来要做的事
  function proceed() {
    const f = A.pendF;
    if (signed() && A.me && !A.me.ageGroup) { ageSheet(); return; }   // 年龄段先问（哪个功能都要先知道）
    const w = f ? need(f) : '';
    if (w && w !== 'quota') { sheetFor(w); return; }
    const then = A.pend; A.pend = null; A.pendF = '';
    if (G) G.closeModal();
    changed();   // 弹窗开着时首页没重画：现在补上（「登录送 n 分钟」→「今天还剩 n 分钟」）
    if (w === 'quota') { quotaSheet(); return; }
    if (then) setTimeout(then, 60);
  }
  // 第一次碰到要 AI 的口语题又没登录：弹一次「登录送 AI」（这次打开 App 只弹一次），题目这边照「AI 用不了」走
  function nudge() {
    if (!CLOUD.on || signed() || A.nudged || !G) return;
    A.nudged = true;
    if (!$('#modal').hidden) return;   // 已经有弹窗（家长密码、麦克风说明）：不叠
    A.pend = null; A.pendF = '';
    signInSheet();
  }

  // ---------- 登录 ----------
  function signInSheet() {
    const F = A.form, again = A.again;
    const apple = canApple();
    const form = F.step === 'code'
      ? '<p class="ac-small">' + h('ac.in.sent', { email: F.email }) + '</p>' +
        '<input id="ac-code" class="txt-in ac-in" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="' + h('ac.in.code.ph') + '">' +
        '<button class="btn" data-act="ac_verify"' + (F.busy ? ' disabled' : '') + '>' + h(F.busy ? 'ac.wait' : 'ac.in.go') + '</button>' +
        '<button class="link" data-act="ac_change">' + h('ac.in.change') + '</button>'
      : '<input id="ac-email" class="txt-in ac-in" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="' + h('ac.in.email.ph') + '" value="' + esc(F.email) + '">' +
        '<button class="btn" data-act="ac_send"' + (F.busy ? ' disabled' : '') + '>' + h(F.busy ? 'ac.wait' : 'ac.in.send') + '</button>';
    G.openModal('<div class="ac" id="ac-signin"><div class="big">✨</div><h2>' + (again ? h('ac.in.h.again') : h('ac.in.h', { n: freeMin() })) + '</h2>' +
      '<p>' + (again ? h('ac.in.p.again') : h('ac.in.p', { n: freeMin() })) + '</p>' +
      (kid() ? '<p class="tip">' + h('ac.in.kid') + '</p>' : '') +
      (apple ? '<button class="btn ac-apple" data-act="ac_apple"' + (F.busy ? ' disabled' : '') + '><span aria-hidden="true"></span>' + h('ac.in.apple') + '</button><p class="ac-or">' + h('ac.in.or') + '</p>' : '') +
      '<div class="ac-form">' + form + '</div>' +
      '<p class="ac-msg" id="ac-msg">' + esc(F.msg) + '</p>' +
      legalLinks('ac.in.legal') +
      '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.in.later') + '</button></div></div>');
    const f = $(F.step === 'code' ? '#ac-code' : '#ac-email'); if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }, 80);
  }
  const legalLinks = lead => '<p class="ac-legal">' + (lead ? h(lead) + ' ' : '') + '<button class="link" data-act="suDoc" data-doc="terms">' + h('ac.m.terms') + '</button> <button class="link" data-act="suDoc" data-doc="privacy">' + h('ac.m.privacy') + '</button></p>';
  function formMsg(m) { A.form.msg = m || ''; const el = $('#ac-msg'); if (el) el.textContent = A.form.msg; }
  async function sendCode() {
    const F = A.form, inp = $('#ac-email'), email = String(inp ? inp.value : F.email).trim();
    F.email = email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { formMsg(t('ac.in.bad.email')); return; }
    F.busy = true; F.msg = ''; signInSheet();
    const r = await call('POST', '/auth/email/start', { email, ui: ui() }, { noAuth: true });
    F.busy = false;
    if (r.ok) { F.step = 'code'; F.msg = ''; }
    else F.msg = t(r.status === 400 ? 'ac.in.bad.email' : r.status === 429 ? 'ac.in.rate' : r.status === 503 ? 'ac.in.noemail' : 'ac.in.net');
    if ($('#ac-signin')) signInSheet();
  }
  async function verify() {
    const F = A.form, inp = $('#ac-code'), code = String(inp ? inp.value : '').replace(/\D/g, '');
    if (code.length !== 6) { formMsg(t('ac.in.bad.code')); return; }
    F.busy = true; F.msg = ''; signInSheet();
    const r = await call('POST', '/auth/email/verify', { email: F.email, code, tzOffsetMin: tz(), ui: ui() }, { noAuth: true });
    F.busy = false;
    if (r.ok && r.json && r.json.token) { await session(r.json); return; }
    F.msg = t(r.status === 401 ? (r.json && r.json.reason === 'expired' ? 'ac.in.expired' : 'ac.in.bad.code') : r.status === 429 ? 'ac.in.rate' : 'ac.in.net');
    if (r.json && r.json.reason === 'expired') F.step = 'email';
    if ($('#ac-signin')) signInSheet();
  }
  // 通过 Apple 登录：网页生成随机的 nonce 原文，原生把它的 SHA-256 放进请求；原文和身份令牌一起交给服务器（API.md §3）
  async function appleIn() {
    const F = A.form; if (F.busy) return;
    const b = new Uint8Array(24); crypto.getRandomValues(b);
    const nonce = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    F.busy = true; F.msg = ''; signInSheet();
    const r = await native('appleSignIn', [nonce], 0);
    const d = parse(r.data);
    if (r.type !== 'ok' || d.cancelled || !d.identityToken) { F.busy = false; F.msg = r.type === 'ok' ? '' : t('ac.in.apple.fail'); if ($('#ac-signin')) signInSheet(); return; }
    const res = await call('POST', '/auth/apple', { identityToken: d.identityToken, nonce, authorizationCode: d.authorizationCode || undefined, tzOffsetMin: tz(), ui: ui() }, { noAuth: true });
    F.busy = false;
    if (res.ok && res.json && res.json.token) { if (d.user) LS(K.apple, String(d.user).slice(0, 200)); await session(res.json); return; }
    F.msg = t(res.status === 429 ? 'ac.in.rate' : res.status === 0 ? 'ac.in.net' : 'ac.in.apple.fail');
    if ($('#ac-signin')) signInSheet();
  }
  // 登录成功：存令牌和账号，先把没交给服务器的交易补上（iapPending），再接着做原来要做的事
  async function session(j) {
    LS(K.tok, j.token); A.again = false;
    A.form = { step: 'email', email: '', msg: '', busy: false };
    setMe(j.me);
    toast(t(j.created ? 'ac.in.ok.new' : 'ac.in.ok'));
    reconcile();
    proceed();
  }
  async function signOut() {
    if (signed()) await call('POST', '/auth/signout', {});
    clearLocal(); A.again = false;
    toast(t('ac.out.ok'));
  }

  // ---------- 年龄段 ----------
  function ageSheet() {
    G.openModal('<div class="ac" id="ac-age"><div class="big">👤</div><h2>' + h('ac.age.h') + '</h2><p>' + h('ac.age.p') + '</p>' +
      '<div class="ac-ages">' + ['child', 'teen', 'adult'].map(a => '<button class="btn ghost" data-act="ac_age" data-v="' + a + '">' + h('ac.age.' + a) + '</button>').join('') + '</div>' +
      '<p class="ac-small">' + h('ac.age.note') + '</p><p class="ac-msg" id="ac-msg"></p>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.in.later') + '</button></div></div>');
  }
  async function setAge(a) {
    if (!/^(child|teen|adult)$/.test(a)) return;
    const r = await call('PATCH', '/me', { ageGroup: a });
    if (r.ok && r.json) { setMe(r.json); proceed(); return; }
    const m = $('#ac-msg'); if (m) m.textContent = t('ac.in.net');
  }

  // ---------- 家长同意（13 岁以下）----------
  function consentSheet(note) {
    const c = (A.me && A.me.consent) || {}, pending = c.state === 'pending';
    G.openModal('<div class="ac" id="ac-consent"><div class="big">👪</div><h2>' + h('ac.c.h') + '</h2>' +
      (c.state === 'revoked' ? '<p class="tip">' + h('ac.c.revoked') + '</p>' : '') +
      (pending && !A.consentRe
        ? '<p><b>' + h('ac.c.sent', { email: c.parentEmail || '' }) + '</b></p><p>' + h('ac.c.wait') + '</p>' +
          '<div class="ac-form"><button class="btn" data-act="ac_consent_check">' + h('ac.c.check') + '</button><button class="link" data-act="ac_consent_again">' + h('ac.c.again') + '</button></div>'
        : '<p>' + h('ac.c.p') + '</p><div class="ac-form"><input id="ac-parent" class="txt-in ac-in" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + h('ac.c.ph') + '">' +
          '<button class="btn" data-act="ac_consent_send">' + h('ac.c.send') + '</button></div>') +
      '<p class="ac-msg" id="ac-msg">' + esc(note || '') + '</p><p class="ac-small">' + h('ac.c.other') + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.in.later') + '</button></div></div>');
    if (pending && !A.consentRe) pollConsent();
  }
  async function consentSend() {
    const inp = $('#ac-parent'), email = String(inp ? inp.value : '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { const m = $('#ac-msg'); if (m) m.textContent = t('ac.in.bad.email'); return; }
    const r = await call('POST', '/consent/request', { parentEmail: email, ui: ui() });
    if (r.ok && r.json && r.json.consent) { A.consentRe = false; if (A.me) { A.me.consent = r.json.consent; setMe(A.me); } consentSheet(); return; }
    if (r.status === 409 && r.json && r.json.reason === 'granted') { await refresh(); proceed(); return; }
    const m = $('#ac-msg'); if (m) m.textContent = t(r.status === 400 ? 'ac.c.bad' : r.status === 429 ? 'ac.in.rate' : 'ac.in.net');
  }
  // 等家长同意：这一页开着就每隔一会儿问一次（GET /v1/consent），同意了自动接着走
  async function consentCheck(manual) {
    const r = await call('GET', '/consent');
    if (!r.ok || !r.json) { if (manual) { const m = $('#ac-msg'); if (m) m.textContent = t('ac.in.net'); } return false; }
    if (A.me) { A.me.consent = r.json.consent; A.me.features = r.json.features; LS(K.me, JSON.stringify(A.me)); }
    if (r.json.consent && r.json.consent.state === 'granted') {
      clearInterval(A.poll); A.poll = 0;
      await refresh();
      toast(t('ac.c.ok'));
      if ($('#ac-consent')) proceed();
      return true;
    }
    if (manual) { const m = $('#ac-msg'); if (m) m.textContent = t('ac.c.not'); }
    return false;
  }
  function pollConsent() {
    clearInterval(A.poll);
    A.poll = setInterval(() => { if (!$('#ac-consent') || !signed()) { clearInterval(A.poll); A.poll = 0; return; } consentCheck(false); }, CFG.poll);
  }

  // ---------- 今天的时间用完了 ----------
  function quotaSheet() {
    const me = A.me || {}, q = me.quota || {}, premium = me.plan === 'monthly' || me.plan === 'yearly';
    G.openModal('<div class="ac" id="ac-quota"><div class="big">⏳</div><h2>' + h('ac.q.h') + '</h2><p>' + h(premium ? 'ac.q.p.m' : 'ac.q.p', { time: timeOf(q.resetsAt) }) + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.ok') + '</button>' + (premium ? '' : '<button class="btn sun" data-act="ac_member" data-focus>' + h('ac.q.member') + '</button>') + '</div></div>');
  }

  // ---------- 会员 ----------
  const periodText = p => { if (!p || !p.unit) return ''; const u = /^(day|week|month|year)$/.test(p.unit) ? p.unit : 'month'; return (p.value || 1) > 1 ? t('ac.per.' + u + 's', { n: p.value }) : t('ac.per.' + u); };
  const durText = (p, count) => { if (!p || !p.unit) return ''; const u = /^(day|week|month|year)$/.test(p.unit) ? p.unit : 'month'; return t('ac.dur.' + u, { n: (p.value || 1) * (count || 1) }); };
  function subLine(me) {
    const s = (me && me.subscription) || {};
    if (s.state === 'active' && s.expiresAt) return h('ac.m.until', { d: dateOf(s.expiresAt) });
    if (s.state === 'grace') return h('ac.m.grace', { d: dateOf(s.graceUntil) });
    if (s.state === 'expired') return h('ac.m.expired');
    if (s.state === 'revoked') return h('ac.m.revoked');
    return '';
  }
  function leftLine(me) {
    const q = me && me.quota; if (!q || !q.talk) return '';
    // iPhone 的口语题用本机识别（不算额度）：「口语打分今天还能用 n 次」就不写了，免得以为口语题也在扣次数
    const local = (() => { try { return !!(W.EchoTalk && EchoTalk.localSR && EchoTalk.localSR()); } catch (e) { return false; } })();
    return '<p class="ac-left">' + h('ac.m.left', { n: Math.floor((talkLeft() || 0) / 60), time: timeOf(q.resetsAt) }) + (q.asr && !local ? '<br><small>' + h('ac.m.asr', { n: q.asr.left }) + '</small>' : '') + '</p>';
  }
  function memberSheet() {
    const me = A.me, k = kid();
    let body = '';
    if (!signed()) body = '<p>' + h('ac.m.signin') + '</p><button class="btn wide" data-act="ac_signin">' + h('ac.btn.signin') + '</button>';
    else {
      const premium = me && (me.plan === 'monthly' || me.plan === 'yearly'), sl = subLine(me);
      body = '<div class="ac-plan"><b>' + esc(planName(me)) + '</b>' + (sl ? '<small>' + sl + '</small>' : '') + '</div>' + leftLine(me);
      if (canIap()) {
        if (!A.prods && !A.prodErr) { body += '<p class="ac-small" id="ac-prods">' + h('ac.m.loading') + '</p>'; loadProducts(); }
        else if (!A.prods || !A.prods.length) body += '<p class="ac-small">' + h('ac.m.noprod') + '</p>';
        else {
          body += A.prods.map(p => {
            const cur = premium && me.plan === p.kind && me.subscription && me.subscription.productId === p.id;
            const trial = p.trial && p.introOffer ? '<small class="ac-trial">' + h('ac.m.trial', { p: durText(p.introOffer.period, p.introOffer.periodCount) }) + '</small>' : '';
            return '<div class="ac-prod" data-kind="' + esc(p.kind) + '"><div><b>' + esc(p.title || t('ac.plan.' + (p.kind === 'yearly' ? 'yearly' : 'monthly'))) + '</b>' +
              '<span class="ac-price">' + esc(p.displayPrice) + ' ' + esc(periodText(p.period)) + '</span>' + (p.description ? '<small>' + esc(p.description) + '</small>' : '') + trial + '</div>' +
              (cur ? '<span class="ac-cur">' + h('ac.m.cur') + '</span>' : '<button class="btn sun" data-act="ac_buy" data-k="' + esc(p.kind) + '"' + (A.buying || !A.canPay ? ' disabled' : '') + '>' + h(A.buying ? 'ac.wait' : 'ac.m.buy') + '</button>') + '</div>';
          }).join('');
          if (!A.canPay) body += '<p class="ac-small">' + h('ac.m.nopay') + '</p>';
        }
        body += '<div class="ac-row"><button class="btn small ghost" data-act="ac_restore">' + h('ac.m.restore') + '</button>' + (premium ? '<button class="btn small ghost" data-act="ac_manage">' + h('ac.m.manage') + '</button>' : '') + '</div>' +
          '<p class="ac-small ac-auto">' + h('ac.m.legal') + '</p>';
      } else body += '<p class="tip">' + h('ac.m.soon') + '</p>';
    }
    G.openModal('<div class="ac" id="ac-member"><h2>' + h(k ? 'ac.m.h.kid' : 'ac.m.h') + '</h2>' + (k ? '<p class="tip">' + h('ac.m.kid') + '</p>' : '') + body +
      legalLinks('') + '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.close') + '</button></div></div>');
  }
  async function loadProducts() {
    if (A.loadingProds) return; A.loadingProds = true;
    const r = await native('iapProducts', [''], 20000);
    A.loadingProds = false;
    const d = parse(r.data);
    if (r.type === 'ok' && Array.isArray(d.products)) { A.prods = d.products.filter(p => p && p.id && (p.kind === 'monthly' || p.kind === 'yearly')); A.canPay = d.canPay !== false; A.prodErr = ''; }
    else A.prodErr = (d && d.error) || 'store';
    if ($('#ac-member')) memberSheet();
  }
  // 一笔交易交给服务器（POST /v1/iap/apple）：存好了（200）才算数
  async function submit(tx) {
    if (!tx || !tx.jws) return { ok: false };
    const r = await call('POST', '/iap/apple', { signedTransaction: tx.jws });
    if (r.ok && r.json && r.json.me) setMe(r.json.me);
    return { ok: r.ok, reason: r.json && r.json.reason, sub: r.json && r.json.subscription };
  }
  // 交给服务器、**服务器说存好了才 finish**（没 finish 的苹果下次打开 App 还会再给，iapPending 能拿到）
  async function settle(tx) {
    const s = await submit(tx);
    if (s.ok && tx.transactionId) await native('iapFinish', [String(tx.transactionId)], 20000);
    return s;
  }
  // 打开 App / 登录以后：先补没 finish 的（iapPending），再把现在有效的交给服务器核对（iapCurrent）
  async function reconcile() {
    if (!signed() || !canIap() || A.reconciling) return;
    A.reconciling = true;
    try {
      const p = await native('iapPending', [], 20000);
      if (p.type === 'ok') for (const tx of parse(p.data).transactions || []) await settle(tx);
      const c = await native('iapCurrent', [], 20000);
      if (c.type === 'ok') for (const tx of parse(c.data).entitlements || []) await submit(tx);
      await refresh();
    } finally { A.reconciling = false; }
  }
  function buy(kind) {
    if (!signed()) { A.pend = () => memberSheet(); A.pendF = ''; signInSheet(); return; }
    const p = (A.prods || []).find(x => x.kind === kind); if (!p || A.buying) return;
    if (kid()) { G.parentOk(t('ac.buy.why'), () => doBuy(p)); return; }
    doBuy(p);
  }
  async function doBuy(p) {
    if (A.buying) return;
    A.buying = true; memberSheet();
    try {
      const me = await refresh(), tok = me && me.iapToken;
      if (!tok) { toast(t('ac.in.net')); return; }
      const r = await native('iapBuy', [p.id, tok], 0);   // 苹果的确认框：不限时
      const d = parse(r.data);
      if (r.type !== 'ok') { toast(t(d.error === 'payments-disabled' ? 'ac.buy.e.disabled' : d.error === 'busy' ? 'ac.buy.e.busy' : d.error === 'network' ? 'ac.buy.e.network' : 'ac.buy.e.other')); return; }
      if (d.status === 'cancelled') return;
      if (d.status === 'pending') { toast(t('ac.buy.pending')); return; }
      if (d.status === 'purchased' || d.status === 'unverified') {
        const s = await settle(d);
        toast(t(s.ok ? 'ac.buy.ok' : s.reason === 'iap_owned' ? 'ac.buy.owned' : 'ac.buy.later'));
        if (s.ok && G && G.confetti) G.confetti(60);
      }
    } finally { A.buying = false; if ($('#ac-member') || $('#modal').hidden) memberSheet(); }
  }
  async function restore() {
    if (!signed()) { signInSheet(); return; }
    const r = await native('iapRestore', [], 0);
    const list = r.type === 'ok' ? parse(r.data).entitlements || [] : [];
    let n = 0;
    for (const tx of list) if ((await submit(tx)).ok) n++;
    await refresh();
    toast(t(n ? 'ac.rs.ok' : 'ac.rs.none'));
    if ($('#ac-member')) memberSheet();
  }
  async function manage() {
    await native('iapManage', [], 0);
    const c = await native('iapCurrent', [], 20000);
    if (c.type === 'ok') for (const tx of parse(c.data).entitlements || []) await submit(tx);
    await refresh();
    if ($('#ac-member')) memberSheet();
  }
  // 原生听到的交易（续费、退款 / 撤销、到期、换方案、「询问购买」批准了、别的设备上买的）：交给服务器，存好了再 finish
  W.addEventListener('echo-iap', async e => {
    const tx = e && e.detail; if (!tx || !CLOUD.on || !signed()) return;   // 没登录：下次登录时 iapPending 会再给
    const s = await settle(tx);
    if (!s.ok) return;
    const k = /^(purchase|renewal|revoked|expired|upgraded)$/.test(tx.kind) ? tx.kind : 'purchase';
    toast(t('ac.iap.' + k));
    if ($('#ac-member')) memberSheet();
  });

  // ---------- 账号页（设置里）、删号 ----------
  function accountSheet(noRefresh) {
    const me = A.me;
    let body;
    if (!signed()) body = '<p>' + h('ac.a.none') + '</p><button class="btn wide" data-act="ac_signin">' + h('ac.btn.signin') + '</button>';
    else {
      const who = me && me.email ? h('ac.a.email', { e: me.email }) : me && me.apple ? h('ac.a.apple') : '';
      const age = me && me.ageGroup ? t('ac.age.' + me.ageGroup) : t('ac.a.age.none');
      const cs = me && me.consent && me.consent.required ? '<li>' + h('ac.a.consent', { s: t('ac.cs.' + (me.consent.state || 'none')) }) + (me.consent.state !== 'granted' && me.ageGroup === 'child' ? ' <button class="link" data-act="ac_consent">' + h('ac.btn.consent') + '</button>' : '') + '</li>' : '';
      body = '<ul class="ac-info">' + (who ? '<li>' + who + '</li>' : '') + '<li>' + h('ac.a.age', { a: age }) + (me && !me.ageGroup ? ' <button class="link" data-act="ac_agepick">' + h('ac.s.age') + '</button>' : '') + '</li>' + cs +
        '<li><b>' + esc(planName(me)) + '</b> ' + subLine(me) + '</li></ul>' + leftLine(me) +
        '<div class="ac-row"><button class="btn sun" data-act="ac_member">' + h('ac.btn.member') + '</button><button class="btn ghost" data-act="ac_signout">' + h('ac.a.signout') + '</button></div>' +
        '<button class="link ac-del" data-act="ac_delete">' + h('ac.a.delete') + '</button>';
    }
    G.openModal('<div class="ac" id="ac-account"><h2>' + h('ac.a.h') + '</h2>' + body + legalLinks('') + '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.close') + '</button></div></div>');
    if (signed() && !noRefresh) { const before = JSON.stringify(A.me); refresh().then(() => { if ($('#ac-account') && A.me && JSON.stringify(A.me) !== before) accountSheet(true); }); }   // 账号信息变了才重画（不然按钮会在手指下面换掉）
  }
  function deleteSheet(step) {
    if (step === 2) {
      G.openModal('<div class="ac" id="ac-delete2"><div class="big">⚠️</div><h2>' + h('ac.d.h2') + '</h2><p>' + h('ac.d.p2') + '</p>' +
        '<div class="row"><button class="btn ghost" data-act="close" data-focus>' + h('ac.cancel') + '</button><button class="btn coral" data-act="ac_delete_go">' + h('ac.d.final') + '</button></div></div>');
      return;
    }
    G.openModal('<div class="ac" id="ac-delete"><div class="big">🗑️</div><h2>' + h('ac.d.h') + '</h2><ul class="ac-info">' + h('ac.d.p') + '</ul>' +
      '<div class="row"><button class="btn ghost" data-act="close" data-focus>' + h('ac.cancel') + '</button><button class="btn" data-act="ac_delete_next">' + h('ac.d.go') + '</button></div></div>');
  }
  async function deleteGo() {
    const r = await call('DELETE', '/me', {});
    if (!r.ok && r.status !== 401) { toast(t('ac.d.fail')); return; }
    clearLocal(); A.again = false;
    G.openModal('<div class="ac" id="ac-deleted"><div class="big">✅</div><h2>' + h('ac.d.h') + '</h2><p>' + h('ac.d.done') + '</p><p class="tip">' + h('ac.d.sub') + '</p>' +
      '<div class="row"><button class="btn" data-act="close" data-focus>' + h('ac.ok') + '</button></div></div>');
  }

  // ---------- 举报（聊天里 AI 的话、评语）----------
  const REASONS = ['rude', 'scary', 'wrong', 'personal', 'other'];
  function reportSheet(o) {
    if (!o || !o.turns || !o.turns.length) return;
    A.rep = { o, reason: A.rep && A.rep.o === o ? A.rep.reason : '' };
    const R = A.rep;
    G.openModal('<div class="ac" id="ac-report"><h2>' + h('ac.r.h') + '</h2><p class="ac-small">' + h('ac.r.p') + '</p>' +
      '<blockquote class="ac-quote">' + esc(o.turns[o.turns.length - 1].text) + '</blockquote>' +
      '<div class="ac-reasons">' + REASONS.map(r => '<button class="btn small ' + (R.reason === r ? 'on' : 'ghost') + '" data-act="ac_rep_reason" data-v="' + r + '">' + h('ac.r.' + r) + '</button>').join('') + '</div>' +
      '<textarea id="ac-note" class="txt-in ac-in" maxlength="300" rows="2" placeholder="' + h('ac.r.note.ph') + '"></textarea>' +
      '<div class="row"><button class="btn ghost" data-act="close">' + h('ac.cancel') + '</button><button class="btn" data-act="ac_rep_send"' + (R.reason ? '' : ' disabled') + '>' + h('ac.r.send') + '</button></div></div>');
  }
  async function reportSend() {
    const R = A.rep; if (!R || !R.reason) return;
    const note = (($('#ac-note') || {}).value || '').trim().slice(0, 300);
    const o = R.o, body = { npc: o.npc || null, quest: o.quest || null, reason: R.reason, turns: o.turns.slice(-8).map(x => ({ who: x.who === 'you' ? 'you' : 'npc', text: String(x.text || '').slice(0, 500) })) };
    if (note) body.note = note;
    const r = await call('POST', '/report', body);
    G.closeModal();
    toast(t(r.ok ? 'ac.r.ok' : 'ac.r.fail'));
    A.rep = null;
  }

  // ---------- 别的地方用的几块 ----------
  // 首页「和岛民聊天」那一栏最上面：还没登录 → 登录送 n 分钟；登录了 → 今天还剩几分钟 + 会员；孩子没有家长同意 → 请家长同意
  function strip() {
    if (!CLOUD.on) return '';
    if (!signed()) return '<div class="ac-strip"><span>' + h('ac.s.signin', { n: freeMin() }) + '</span><button class="btn small" data-act="ac_signin">' + h('ac.btn.signin') + '</button></div>';
    if (!A.me || Date.now() - A.at > 60000) refresh();
    const w = need('talk');
    const line = w === 'age' ? '<span>' + h('ac.s.age') + '</span><button class="btn small" data-act="ac_agepick">' + h('ac.age.btn') + '</button>'
      : w === 'parent' ? '<span>' + h('ac.s.parent') + '</span><button class="btn small" data-act="ac_consent">' + h('ac.btn.consent') + '</button>'
      : '<span>' + h('ac.s.left', { n: Math.floor((talkLeft() || 0) / 60) }) + ' · <small>' + esc(planName(A.me)) + '</small></span><button class="btn small sun" data-act="ac_member">' + h('ac.btn.member') + '</button>';
    return '<div class="ac-strip">' + line + '<button class="btn small ghost" data-act="ac_account" aria-label="' + h('ac.s.account') + '">👤</button></div>';
  }
  // 设置页最上面一行
  function settingsRow() {
    if (!CLOUD.on) return '';
    return '<div class="set" id="set-account"><label>' + h('ac.set.row') + '</label><div class="say-row"><span class="set-v">' + (signed() ? h('ac.set.in', { plan: planName(A.me) }) : h('ac.set.out')) + '</span>' +
      '<button class="btn small ghost" data-act="ac_account">' + h('ac.set.btn') + '</button></div></div>';
  }
  // 学习锁（game.js 的 gate）：'' 照常；nosign 没登录 / consent 还等家长同意（或年龄段没选）→ 聊天这一项今天免；quota 今天聊天时间用完了（照 chatDaily 办）
  function gateWhy() {
    if (!CLOUD.on) return '';
    if (!signed()) return 'nosign';
    const w = need('talk');
    return w === 'age' || w === 'parent' ? 'consent' : w === 'quota' ? 'quota' : '';
  }
  // 口语题没听到时那一行、首页红条：云端模式自己的说法（没有就返回 ''，game.js 照原来的）
  function failText(f, why) {
    if (!CLOUD.on) return '';
    if (f === 'nokey' || why === 'signin') return t('ac.fail.signin');
    if (why === 'quota') return t('ac.fail.quota');
    if (why === 'consent') return t('ac.err.consent');
    return '';
  }
  function barText(st) {
    if (!CLOUD.on || !st) return '';
    if (st.cls === 'nokey' || st.why === 'signin') return t('ac.bar.signin');
    if (st.why === 'quota') return t('ac.bar.quota');
    return '';
  }
  // 点首页红条：云端模式下直接给能解决问题的那一页；返回 true = 处理了
  function barInfo(st) {
    if (!CLOUD.on || !st) return false;
    if (st.cls === 'nokey' || st.why === 'signin') { A.pend = null; A.pendF = ''; signInSheet(); return true; }
    if (st.why === 'quota') { refresh(); quotaSheet(); return true; }
    if (st.why === 'consent') { consentSheet(); return true; }
    return false;
  }
  // 聊天连不上时状态行下面那个按钮要做的事（talk.js 的 talk_fix）：code = signin / consent / quota
  function fix(code, then) {
    A.pend = then || null; A.pendF = 'talk';
    if (code === 'signin' || !signed()) { signInSheet(); return; }
    if (code === 'quota') { refresh(); quotaSheet(); return; }
    refresh().then(() => { const w = need('talk'); if (w) sheetFor(w); else consentSheet(); });
  }
  // 首次设置向导：云端模式代替「粘贴 AI 密钥」的那一页（setup.js）
  function setupPage(forKid) {
    const me = A.me;
    return '<div class="su-hero">🤖</div><h2>' + h('ac.su.title') + '</h2>' +
      '<div class="su-card ai"><p>' + h('ac.su.p1') + '</p><p>' + h('ac.su.p2', { n: freeMin() }) + '</p></div>' +
      (forKid ? '<p>' + h('ac.su.kid') + '</p>' : '') +
      (signed() ? '<p class="su-done-line">' + h('ac.su.done', { who: (me && (me.email || (me.apple ? t('ac.a.apple') : ''))) || '' }) + '</p>'
        : '<button class="btn sun" data-act="ac_signin" id="su-ac-signin">' + h('ac.su.signin') + '</button>') +
      '<p class="su-small">' + h('ac.su.p3') + '</p>';
  }
  const setupSum = () => h('ac.su.sum', { v: t(signed() ? 'ac.su.sum.in' : 'ac.su.sum.out') });

  // 按回车：邮箱 → 发验证码，验证码 → 登录，家长邮箱 → 发给家长
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target || !e.target.id) return;
    const id = e.target.id;
    if (id === 'ac-email') { e.preventDefault(); sendCode(); } else if (id === 'ac-code') { e.preventDefault(); verify(); } else if (id === 'ac-parent') { e.preventDefault(); consentSend(); }
  });
  // 验证码填满 6 位自动登录
  document.addEventListener('input', e => { if (e.target && e.target.id === 'ac-code' && String(e.target.value).replace(/\D/g, '').length === 6 && !A.form.busy) verify(); });

  // 打开 App：有令牌就更新账号信息、补交没 finish 的交易；通过 Apple 登录的看一眼授权是不是被停用了
  async function boot() {
    if (!CLOUD.on || !signed()) return;
    await refresh();
    const au = LS(K.apple);
    if (au && nat('appleCredentialState')) {
      const r = await native('appleCredentialState', [au], 10000);
      if (r.type === 'ok' && /^(revoked|notFound)$/.test(parse(r.data).state || '')) { clearLocal(); return; }
    }
    reconcile();
  }
  W.addEventListener('online', () => { if (CLOUD.on && signed()) refresh(); });

  function init(api) {
    G = api;
    if (CLOUD.on) setTimeout(boot, 300);
    if (!CLOUD.on) return {};
    return {
      ac_signin: () => { A.pend = null; A.pendF = ''; signInSheet(); },
      ac_send: () => sendCode(),
      ac_verify: () => verify(),
      ac_change: () => { A.form.step = 'email'; A.form.msg = ''; signInSheet(); },
      ac_apple: () => appleIn(),
      ac_age: el => setAge(el.dataset.v),
      ac_agepick: () => ageSheet(),
      ac_consent: () => { A.consentRe = false; refresh().then(() => consentSheet()); },
      ac_consent_send: () => consentSend(),
      ac_consent_check: () => consentCheck(true),
      ac_consent_again: () => { A.consentRe = true; consentSheet(); },
      ac_member: () => { memberSheet(); if (signed()) { const before = JSON.stringify(A.me); refresh().then(() => { if ($('#ac-member') && !A.buying && JSON.stringify(A.me) !== before) memberSheet(); }); } },
      ac_buy: el => buy(el.dataset.k),
      ac_restore: () => restore(),
      ac_manage: () => manage(),
      ac_account: () => accountSheet(),
      ac_signout: () => signOut().then(() => { if ($('#ac-account')) accountSheet(); }),
      ac_delete: () => G.parentOk(t('ac.d.h'), () => deleteSheet(1)),
      ac_delete_next: () => deleteSheet(2),
      ac_delete_go: () => deleteGo(),
      ac_rep_reason: el => { if (A.rep) { A.rep.reason = el.dataset.v; const note = ($('#ac-note') || {}).value || ''; reportSheet(A.rep.o); const n = $('#ac-note'); if (n) n.value = note; } },
      ac_rep_send: () => reportSend(),
    };
  }

  W.EchoAccount = {
    init, cfg: CFG, token, signed, me: () => A.me, refresh, talkLeft, need, ask, nudge, fix, post, noteQuota, lost,
    strip, settingsRow, gateWhy, failText, barText, barInfo, setupPage, setupSum, reportSheet, memberSheet, signInSheet, accountSheet,
    reconcile, planName: () => planName(A.me), MIN_START,
  };
})();
