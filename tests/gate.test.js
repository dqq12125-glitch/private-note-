// 端到端测试：学习锁、家长密码、冒险时间、学习周报、日报推送（家长 2026-10-07 的决定，评估第 2、4、5、12、16、18 条）
// - 学习锁的聊天一项：今天用语音说满 6 句（EchoTalk.today()）或完成一个小目标；首页卡片显示「已开口说 n/6 句」；复习结果页「去和岛民聊天」
// - 没网 / 聊天连上后服务器出错：临时放行 30 分钟（不写 gateOpen），联网后重新检查；AI 没开通：整天免（🟡）
// - 返回键 → EchoTalk.endIfOpen()；手机日期改过：家长输密码从今天重新开始
// - 家长密码：数字键盘、网页版第一次由家长设、错 5 次锁 10 分钟、要密码的设置、清空要再输入「清空」；APK（假原生桥）没密码就拒绝
// - 冒险时间：上学日 / 周末分钟数、晚上不能冒险、多学一点换时间、时间到了等这一场战斗结束再回首页
// - 周报：每天的标记、学习日 n/7、能力行（和上周比）、AI 花费、诊断、需要家长看看的聊天；S.weekly 永久保留；日报推送（PushPlus / 企业微信）
// 运行：node tests/gate.test.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const FN = require('./fake-native');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const today = () => daysAgo(0);
const at = (h, m, dow) => { const d = new Date(); if (dow != null) d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7)); d.setHours(h, m || 0, 0, 0); return d.getTime(); };   // 这周（往后）的周 dow 的 h:m

const MON = { v: 2, box: [{ uid: 'u0', sp: 'sprouty', lv: 30, xp: 0 }], team: ['u0'], dex: {}, balls: 5, potions: 5, bag: {}, badges: {} };
const SET = { tts: 'online', mode: 'self', sfx: false, music: 'off', gfx: '2d' };
const DUE = { 'word:13:0': { k: 'word', w: 13, i: 0, b: 0, due: '2000-01-01', x: 1 } };
const base = o => Object.assign({ seenIntro: true, homeTab: 'mon', player: { gender: 'boy', name: 'Tom' }, settings: Object.assign({}, SET), mon: MON, rev: { v: 1, items: JSON.parse(JSON.stringify(DUE)) } }, o || {});

(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const W = ms => p.waitForTimeout(ms);
  const E = (f, a) => p.evaluate(f, a);
  const G = () => E(() => window.EchoGame.gate());
  const L = () => E(() => window.EchoGame.dayLog());
  const setL = o => E(o => Object.assign(window.EchoGame.dayLog(), o), o);
  const delL = ks => E(ks => { const x = window.EchoGame.dayLog(); ks.forEach(k => delete x[k]); }, ks);
  const load = async (s, talk) => {
    await E(([s, t]) => { if (t) localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9'); else localStorage.removeItem('echo-talk-url'); localStorage.setItem('echo-island-v1', JSON.stringify(s)); }, [s, talk !== false]);
    await p.reload(); await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await W(300);
  };
  const home = () => E(() => { window.EchoGame.closeModal(); window.EchoGame.goHome('mon'); });
  const pin = async digits => { for (const d of digits) await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(300); };
  const settings = () => E(() => { window.EchoGame.closeModal(); window.EchoGame.T.settings(); });
  const tap = sel => E(s => document.querySelector(s).click(), sel);   // 收起来的「家长设置」里的按钮：直接点
  const sheet = () => p.textContent('#sheet').catch(() => '');

  await p.goto(PAGE);

  // ---------- 1. 学习锁的聊天一项：语音说满 6 句或完成一个小目标（评估第 2 条）----------
  await load(base());
  let g = await G();
  check(!g.open && !g.revDone && g.chatOn && g.voice === 0 && g.need === 6, '学习锁关着：复习没做、还没开口', g);
  check(/已开口说 0\/6 句/.test(await p.textContent('.gate-card')), '首页学习锁卡片显示「已开口说 0/6 句」');
  await setL({ revSess: 1, voiceLines: 5 });
  g = await G();
  check(!g.open && g.revDone && !g.chatDone && g.voice === 5 && g.steps === 1, '复习做完、说了 5 句：还不开', g);
  // 以前「聊两次 / 3 分钟」就算：现在不算了
  await E(() => { window.EchoGame.S.talk.log = [{ t: Date.now(), npc: 'kai', sec: 200, turns: [] }, { t: Date.now(), npc: 'kai', sec: 30, turns: [] }]; });
  check(!(await G()).open, '聊了两次、3 分钟以上但没说满 6 句：还不开');
  await setL({ voiceLines: 6 });
  g = await G();
  check(g.open && g.chatDone && !g.pass && (await L()).gateOpen === 1, '用语音说满 6 句：开锁（记下真做完了 gateOpen）', g);
  await delL(['gateOpen']); await setL({ voiceLines: 0 });
  await E(() => { const S = window.EchoGame.S; S.talk.days = { ['kai:' + Object.keys(S.log).sort().pop()]: 1 }; });
  check((await G()).open, '完成一个聊天小目标：开锁');
  await E(() => { window.EchoGame.S.talk.days = {}; window.EchoGame.S.talk.log = []; }); await delL(['gateOpen', 'revSess']);

  // ---------- 2. 复习结果页：复习做完了还差聊天 → 主按钮「去和岛民聊天」----------
  await E(() => window.EchoGame.playQs([['lw', 13, 0]], true)); await W(500);
  const right = await E(() => window.EchoGame.P().q.opts.findIndex(o => o.c));
  await p.click('#p-body .opt[data-act=pick] >> nth=' + right); await W(300);
  await p.click('#fb-btn'); await W(600);
  const rbtn = await p.textContent('#result .r-actions .btn').catch(() => '');
  check(/去和岛民聊天/.test(rbtn) && /已开口说 0\/6 句/.test(await p.textContent('#result')), '复习结果页：还差聊天时主按钮是「🗣️ 去和岛民聊天」', rbtn);
  await p.click('#result [data-act=gateTalk]'); await W(400);
  check(await p.isVisible('#talk-home') && await p.isHidden('#result'), '点了就回首页「和岛民聊天」');
  await E(() => { window.EchoGame.S.homeTab = 'mon'; }); await home();

  // ---------- 3. 返回键：聊天开着就交给 EchoTalk.endIfOpen()（结束并评价）----------
  const back = await E(() => { let n = 0; const o = EchoTalk.endIfOpen; EchoTalk.endIfOpen = () => (n++, true); const r = window.EchoBack(); EchoTalk.endIfOpen = o; return { r, n }; });
  check(back.r === true && back.n === 1, '返回键：聊天开着就「结束并评价」', back);
  const back2 = await E(() => { let n = 0; const o = EchoTalk.endIfOpen; EchoTalk.endIfOpen = () => (n++, false); window.EchoGame.reportSheet(); const r1 = window.EchoBack(); const shut = document.querySelector('#modal').hidden; const r2 = window.EchoBack(); EchoTalk.endIfOpen = o; return { r1, shut, r2, n }; });
  check(back2.r1 === true && back2.shut && back2.r2 === false && back2.n === 1, '返回键：先关弹窗；首页上没开聊天就交给手机（返回 false）', back2);

  // ---------- 4. 没网：临时放行 30 分钟；联网后重新检查；聊天连不上 / AI 没开通（评估第 5 条）----------
  await setL({ revSess: 1 });
  await E(t => window.EchoGame.T.setNow(t), at(16, 0, 3));   // 周三下午（别碰上晚上不能冒险的时间）
  await E(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
  g = await G();
  check(g.open && g.pass && g.passWhy === 'offline' && g.passMin === 30 && !(await L()).gateOpen && !(await L()).passAt, '没网：临时放行 30 分钟（不写 gateOpen，进大地图才开始算）', g);
  await home();
  check(/今天先去冒险吧/.test(await p.textContent('.gate-card')) && /现在没网/.test(await p.textContent('.gate-card')), '学习锁卡片写明「没网，先让你冒险」');
  check(await E(() => window.EchoGame.T.advEnterOk()) === true && (await L()).passAt > 0 && (await L()).passWhy === 'offline', '进大地图：开始计时 30 分钟');
  await setL({ passAt: Date.now() - 31 * 60e3 });
  g = await G();
  check(!g.open && g.passUsed, '30 分钟到了：又锁上', g);
  check(await E(() => window.EchoGame.T.advStopWhy()) === 'pass', '人在大地图里：等这一场结束回首页（pass）');
  await home();
  check(/连上网说满就能接着冒险/.test(await p.textContent('.gate-card')), '卡片：连上网说满就能接着冒险');
  await E(() => { delete navigator.onLine; });
  await setL({ passAt: Date.now() - 5 * 60e3 });
  check(!(await G()).open, '联网以后（放行还没到 30 分钟）：回首页重新检查，要先聊天');
  await setL({ chatFail: 1 });
  g = await G();
  check(g.open && g.pass && g.passWhy === 'fail', '聊天连上以后服务器出错（chatFail）：也只临时放行', g);
  await delL(['chatFail', 'passAt', 'passWhy']);
  await E(() => localStorage.removeItem('echo-talk-url'));
  g = await G();
  check(g.open && !g.pass && g.exWhy === 'noai' && (await L()).gateEx === 'noai' && !(await L()).gateOpen, 'AI 聊天没开通：聊天这一项整天免了（🟡，不算 gateOpen）', g);
  await E(() => localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9')); await delL(['gateEx', 'revSess']);
  // 今天的聊天时间用完了：开口说过 3 句以上才整天免；一直不说话把时间耗完的，只临时放行 30 分钟
  await setL({ revSess: 1, chatDaily: 1, voiceLines: 0 });
  g = await G();
  check(g.open && g.pass && g.passWhy === 'daily' && !g.exWhy && !(await L()).gateEx, '聊天时间用完、几乎没开口：只临时放行 30 分钟', g);
  await setL({ voiceLines: 3 });
  g = await G();
  check(g.open && !g.pass && g.exWhy === 'daily', '聊天时间用完、开口说过 3 句：聊天这一项整天免（🟡）', g);
  await delL(['gateEx', 'chatDaily', 'voiceLines']);
  // Wi-Fi 连着但上不了网（navigator.onLine 还是 true）：最近 AI 报过「找不到服务器」、今天聊天也没连上过 → 按没网算
  await E(() => { const le = { why: 'offline', where: 'chat', at: Date.now() }; window.__le0 = EchoTalk.lastErr; EchoTalk.lastErr = () => le; });
  g = await G();
  check(g.open && g.pass && g.passWhy === 'offline', 'Wi-Fi 连着但上不了网：也按没网临时放行', g);
  await setL({ chatConn: 1 });
  check(!(await G()).open, '今天聊天连上过：不算没网，要先聊天');
  await E(() => { EchoTalk.lastErr = window.__le0; }); await delL(['chatConn', 'revSess']);

  // ---------- 5. 家长密码（网页版）：数字键盘、第一次由家长设、错 5 次锁 10 分钟（评估第 4 条）----------
  await E(() => { const S = window.EchoGame.S; S.settings.pin = ''; S.settings.gate = true; });
  await settings();
  check(/我的设置/.test(await p.textContent('#sheet .set-h')) && await E(() => !document.querySelector('#set-parent').open) && /🔒 家长设置/.test(await p.textContent('#set-parent summary')), '设置分成「我的设置」和收起来的「🔒 家长设置」');
  await p.click('#set-parent summary'); await W(200);
  await p.screenshot({ path: path.join(out, 'gate-settings.png') });
  await tap('#sheet [data-act=setGate][data-m="0"]'); await W(200);
  check(await p.isVisible('#pin-pad') && /设一个 4 位数字/.test(await sheet()), '网页版第一次：家长设密码（数字键盘）');
  await p.click('#sheet [data-act=pinKey][data-k="1"]'); await p.click('#sheet [data-act=pinKey][data-k="2"]');
  check(await E(() => document.querySelectorAll('#pin-dots i.on').length) === 2 && /●●○○/.test(await p.textContent('#pin-dots')), '输入显示 ●');
  await p.screenshot({ path: path.join(out, 'gate-pin.png') });
  await p.click('#sheet [data-act=pinKey][data-k="3"]'); await p.click('#sheet [data-act=pinKey][data-k="4"]'); await W(300);
  check(/再输一遍/.test(await sheet()), '再输一遍确认');
  await pin('1234');
  let s = await E(() => ({ gate: window.EchoGame.S.settings.gate, pin: window.EchoGame.S.settings.pin, off: window.EchoGame.dayLog().gateOff, open: document.querySelector('#set-parent') && document.querySelector('#set-parent').open }));
  check(s.gate === false && s.pin === '1234' && s.off === 1 && s.open, '密码设好、学习锁关了（周报记「关过」）、回到设置还展开着家长设置', s);
  await tap('#sheet [data-act=setGate][data-m="1"]'); await W(100);
  await tap('#sheet [data-act=setGate][data-m="0"]'); await W(200);
  check(await E(() => window.EchoGame.S.settings.gate === false) && !(await p.isVisible('#pin-pad')), '刚输过密码、弹窗没关：接着改不用再输');
  await tap('#sheet [data-act=setGate][data-m="1"]'); await W(100);
  await settings(); await tap('#sheet [data-act=setGate][data-m="0"]'); await W(200);
  check(await p.isVisible('#pin-pad'), '设置关掉再打开：又要输密码');
  for (let k = 0; k < 4; k++) await pin('0000');
  check(/还能试 1 次/.test(await p.textContent('#pin-msg')), '输错了：提示还能试几次');
  await pin('0000');
  s = await E(() => ({ gate: window.EchoGame.S.settings.gate, lock: window.EchoGame.S.settings.pinLock, L: window.EchoGame.dayLog(), dis: document.querySelector('#sheet [data-act=pinKey]').disabled }));
  check(s.gate === true && s.lock.until > Date.now() + 9 * 60e3 && s.L.pinLock === 1 && s.L.pinFail === 5 && s.dis && /10 分钟后再试/.test(await p.textContent('#pin-msg')), '错 5 次：锁 10 分钟（键盘变灰，记进今天的日志）', s);
  await E(() => { window.EchoGame.S.settings.pinLock.until = 0; });
  // 要密码的设置：课本比例、全部关卡直接开放、清空进度
  await settings(); await tap('#sheet [data-act=setBookMix][data-m="0"]'); await W(200);
  check(await p.isVisible('#pin-pad') && await E(() => window.EchoGame.S.book.mix) === 0.6, '改冒险里的英语题：要密码');
  await pin('1234');
  check(await E(() => window.EchoGame.S.book.mix) === 0, '输对了才改');
  await settings(); await tap('#sheet [data-act=unlock][data-v="1"]'); await W(200);
  check(await p.isVisible('#pin-pad') && !(await E(() => window.EchoGame.S.settings.unlockAll)), '全部关卡直接开放：要密码');
  await pin('1234');
  check(await E(() => window.EchoGame.S.settings.unlockAll) === true, '输对了才开');
  await settings(); await tap('#sheet [data-act=unlock][data-v="0"]'); await W(100);
  check(await E(() => window.EchoGame.S.settings.unlockAll) === false, '关回按顺序解锁不用密码');
  await E(() => { window.EchoGame.S.coins = 999; });
  await settings(); await tap('#sheet [data-act=reset]'); await W(200);
  check(await p.isVisible('#pin-pad'), '清空进度：要密码');
  await pin('1234');
  await p.fill('#reset-in', '清'); await p.click('#sheet [data-act=resetGo]'); await W(200);
  check(await E(() => window.EchoGame.S.coins) === 999, '没输「清空」两个字：不清空');
  await p.fill('#reset-in', '清空'); await p.click('#sheet [data-act=resetGo]'); await W(300);
  s = await E(() => ({ coins: window.EchoGame.S.coins, pin: window.EchoGame.S.settings.pin, reset: window.EchoGame.dayLog().reset }));
  check(s.coins === 50 && s.pin === '1234' && s.reset === 1, '输了「清空」：清空进度（设置留着，今天记一笔）', s);
  check(await E(() => { const o = JSON.parse(localStorage.getItem('echo-island-v1-pre') || 'null'); return !!o && o.coins === 999; }), '清空前先另存一份（「从备份恢复」里能找回）');
  // talk.js 的老写法 parentOk('…')（同步）：输对以后把刚才点的按钮再执行一次
  await load(base({ homeTab: 'talk', settings: Object.assign({}, SET, { pin: '1234' }), talk: { log: [{ t: Date.now(), npc: 'lily', sec: 40, turns: [{ who: 'npc', text: 'Hi!' }, { who: 'you', text: 'Some kids bully me.' }], concern: 1, why: '说有人欺负他' }], done: {}, days: {} } }));
  await p.click('.tk-home [data-act=talk_concerns]'); await W(200);
  check(await p.isVisible('#pin-pad'), '聊天页「家长看看」：要家长密码');
  await pin('1234');
  check(await p.isVisible('#sheet [data-act=talk_ack]') && /bully me/.test(await sheet()), '输对以后看到需要注意的聊天全文');
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.S.homeTab = 'mon'; window.EchoGame.goHome('mon'); });

  // ---------- 6. 手机日期被改过：家长输密码从今天重新开始 ----------
  await E(() => { window.EchoGame.S.maxDay = '2099-01-01'; window.EchoGame.goHome('mon'); });
  check((await G()).back && await p.isVisible('.gate-card [data-act=clockReset]'), '日期被改过的卡片上有「家长：从今天重新开始」');
  await p.click('.gate-card [data-act=clockReset]'); await W(200);
  await pin('1234');
  s = await E(() => ({ max: window.EchoGame.S.maxDay, reset: window.EchoGame.dayLog().clockReset, back: window.EchoGame.gate().back }));
  check(s.max === today() && s.reset === 1 && !s.back, '输对密码：从今天重新开始（周报记一笔）', s);
  // 输完密码直接回了首页（没有家长弹窗开着）：家长这一次就结束了，孩子接着打开设置关学习锁还要密码
  await E(() => window.EchoGame.T.settings()); await tap('#sheet [data-act=setGate][data-m="0"]'); await W(200);
  check(await p.isVisible('#pin-pad') && await E(() => window.EchoGame.S.settings.gate) === true, '「从今天重新开始」以后：关学习锁照样要密码（不留 2 分钟空窗）');
  // 「剧情中文」在家长设置里：改宽松要密码，改严（点一下才显示）不用
  await settings(); await tap('#sheet [data-act=wZhMode][data-m=always]'); await W(200);
  check(await p.isVisible('#pin-pad') && await E(() => window.EchoGame.S.settings.storyZh || 'auto') === 'auto', '剧情中文改成「总是显示」：要密码');
  await pin('1234');
  check(await E(() => window.EchoGame.S.settings.storyZh) === 'always' && await E(() => document.querySelector('#sheet [data-act=wZhMode][data-m=always]').classList.contains('on')), '输对了才改，设置页上也亮着');
  await settings(); await tap('#sheet [data-act=wZhMode][data-m=tap]'); await W(200);
  check(!(await p.isVisible('#pin-pad')) && await E(() => window.EchoGame.S.settings.storyZh) === 'tap', '改成「点一下才显示」（更严）：不用密码');
  await E(() => { window.EchoGame.S.settings.storyZh = 'auto'; window.EchoGame.closeModal(); });

  // ---------- 7. 冒险时间（评估第 18 条）----------
  await load(base({ rev: { v: 1, items: {} }, settings: Object.assign({}, SET, { pin: '1234' }), log: { [today()]: { min: 0, learn: 0, play: 0, gateOpen: 1 } } }));
  await E(t => window.EchoGame.T.setNow(t), at(16, 0, 3));   // 周三下午 4 点
  let pi = await E(() => window.EchoGame.T.playInfo());
  check(pi.on && pi.base === 45 && pi.left === 45 && !pi.over, '上学日 45 分钟', pi);
  await setL({ play: 40 }); await home();
  check(/今天还能冒险 5 分钟/.test(await p.textContent('.gate-card')), '首页卡片显示还能冒险几分钟');
  await setL({ revSess: 2, chatGoals: 3, pract: 2 });
  pi = await E(() => window.EchoGame.T.playInfo());
  check(pi.bonus === 30 && pi.left === 35, '多学一点换时间：每样 +10 分钟，最多 +30', pi);
  await setL({ revSess: 1, chatGoals: 0, pract: 0, play: 46 }); await home();
  check(/冒险时间用完了/.test(await p.textContent('.gate-card')), '时间用完：卡片写明');
  await p.click('.world-go'); await W(300);
  check(/今天的冒险时间到啦/.test(await sheet()) && await p.isHidden('#world'), '时间用完：点「继续冒险」友好地拦住');
  await E(t => window.EchoGame.T.setNow(t), at(10, 0, 6));   // 周六上午
  pi = await E(() => window.EchoGame.T.playInfo());
  check(pi.base === 90 && !pi.over, '周末 90 分钟', pi);
  await setL({ play: 0 });
  await E(t => window.EchoGame.T.setNow(t), at(21, 45, 3));
  await home(); await p.click('.world-go'); await W(300);
  check(/该睡觉啦/.test(await sheet()) && await p.isHidden('#world'), '21:30 以后不能冒险');
  await E(() => { window.EchoGame.S.settings.gate = false; });
  check(!(await E(() => window.EchoGame.T.playInfo())).on, '家长关了学习锁：冒险不限时');
  await E(() => { window.EchoGame.S.settings.gate = true; });
  // 家长改冒险时间：要密码
  await settings(); await tap('#sheet [data-act=limEdit]'); await W(200);
  check(await p.isVisible('#pin-pad'), '改冒险时间：要密码');
  await pin('1234');
  await p.click('#sheet [data-act=limSet][data-k="wd"][data-v="60"]'); await W(150);
  await p.click('#sheet [data-act=limSet][data-k="from"][data-v="22:00"]'); await W(150);
  s = await E(() => window.EchoGame.S.settings.limit);
  check(s.wd === 60 && s.from === '22:00' && s.we === 90, '家长设置里能改（上学日 60 分钟、22:00 以后不能冒险）', s);
  await E(() => { window.EchoGame.S.settings.limit = { on: true, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 }; window.EchoGame.closeModal(); });
  // 人在大地图里时间到了：等这一场战斗结束再回首页
  await E(t => window.EchoGame.T.setNow(t), at(16, 0, 3));
  await load(base({ rev: { v: 1, items: {} }, settings: Object.assign({}, SET, { pin: '1234' }), log: { [today()]: { min: 0, learn: 0, play: 0, gateOpen: 1 } },
    world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', arrive: 'door:C', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} } }));
  await E(t => window.EchoGame.T.setNow(t), at(16, 0, 3));
  await p.click('[data-act=wEnter]'); await W(1500);
  check(await p.isVisible('#world'), '时间够：进了大地图');
  await setL({ play: 41 }); await W(2500);
  check(/还剩 5 分钟/.test(await p.textContent('#toasts')), '还剩 5 分钟：提醒一次');
  await E(() => EchoWorld._debug().battle('wild', {})); await p.waitForSelector('#battle:not([hidden])', { timeout: 6000 }).catch(() => {});
  await setL({ play: 60 }); await W(2600);
  check(await p.isVisible('#battle') && await E(() => window.EchoGame.T.RT.advStop) === 'time', '时间到了正在打仗：不半路掐断');
  await p.click('#battle [data-act=bFlee]'); await W(300);
  await p.click('#sheet [data-act=bEnd]').catch(() => {}); await W(2600);
  // 打完回到大地图，要是正好有人在说话（剧情），也等说完
  let talked = 0;
  for (let k = 0; k < 40 && await E(() => !!(EchoWorld._debug().dlg) && window.EchoGame.T.RT.scr === 'world'); k++) {
    talked++;
    if (k === 0) check(await p.isVisible('#world') && await p.isHidden('#home'), '有人在说话：先不回首页');
    if (await p.$('#w-dlg [data-act=wSelfDone]')) await p.click('#w-dlg [data-act=wSelfDone]'); else await E(() => document.querySelector('#w-dlg').click());
    await W(350);
  }
  await W(2600);
  check(await p.isVisible('#home') && /今天的冒险时间到啦/.test(await sheet()) && (await L()).stopped === 'time', '打完这一场' + (talked ? '、说完话' : '') + '：友好地提示、回首页');
  await p.screenshot({ path: path.join(out, 'gate-timeup.png') });
  await E(() => window.EchoGame.T.setNow(0));

  // ---------- 8. 周报：标记、学习日、能力（和上周比）、AI 花费、诊断、需要家长看看（评估第 12、16 条）----------
  await E(() => window.EchoGame.closeModal());
  await E(([d, prev]) => {
    const S = window.EchoGame.S, mk = o => Object.assign({ min: 30, learn: 15, play: 10 }, o);
    S.log = {};
    prev.forEach(k => { S.log[k] = mk({ voiceLines: 4, voiceWords: 12, spkQ: 10, spk1: 5, weekN: 4, weekOk: 2, gateOpen: 1 }); });
    S.log[d[0]] = mk({ play: 60, learn: 5, voiceLines: 6, voiceWords: 30, spkQ: 10, spk1: 8, weekN: 5, weekOk: 4 });
    S.log[d[1]] = mk({ night: 1 });
    S.log[d[2]] = mk({ clockBack: 1 });
    S.log[d[3]] = mk({ gateOff: 1, pinFail: 2 });
    S.log[d[4]] = mk({ passAt: Date.now() - 864e5 * 2, passWhy: 'offline' });
    S.log[d[5]] = mk({ gateEx: 'noai', recall: 7, aiChatIn: 20000, aiChatAudioIn: 15000, aiChatOut: 10000, aiChatAudioOut: 8000, asrSec: 300, aiFail: 3 });
    S.log[d[6]] = mk({ gateOpen: 1, voiceMax: 9 });
    S.talk.log = [{ t: Date.now(), npc: 'lily', sec: 60, turns: [], concern: 1, why: '难过' }];
    window.EchoGame.reportSheet();
  }, [[6, 5, 4, 3, 2, 1, 0].map(daysAgo), [13, 12, 11, 10, 9, 8, 7].map(daysAgo)]);
  await W(300);
  const rp = await p.textContent('#sheet .report');
  const marks = await E(() => [...document.querySelectorAll('.rp-day em')].map(e => e.textContent.trim()).join(''));
  check(['✅', '🟡', '📵', '🔓', '⏰', '🌙'].every(m => marks.includes(m)), '每天的标记：✅ 🟡 📵 🔓 ⏰ 🌙', marks);
  check(/学习日 2\/7/.test(rp) && !/连续打卡/.test(rp), '学习日 2/7（✅ + 🟡，不再写连续打卡）', rp.slice(0, 80));
  check(/每句 [\d.]+ 个词/.test(rp) && await p.isVisible('.rp-ab i.up') && /一次说对/.test(rp) && /隔一周还记得/.test(rp), '能力一行：每句几个词、一次说对、隔一周还记得，和上周比有箭头');
  check(/📵 断网放行 1 天/.test(rp) && /🔓 1 天关过学习锁/.test(rp) && /🔑 家长密码输错 2 次/.test(rp) && /🟡 聊天免了 1 天（AI 聊天没开通）/.test(rp), '周报讲实话：断网放行、关锁、密码输错、聊天免了');
  check(await p.isVisible('.rp-day b.warn'), '冒险超过学习 3 倍的那天标黄');
  check(/AI 花费约 ¥\d/.test(rp) && /AI 出错 3 次/.test(rp) && /网页版/.test(rp), 'AI 花费估算、诊断一行（出错次数、版本）');
  check(/有 1 段聊天需要家长看看/.test(rp) && /不看字说对 7 句/.test(rp), '有需要家长看看的聊天：提示一行；不看字说对几句');
  await p.screenshot({ path: path.join(out, 'gate-report.png') });
  await p.setViewportSize({ width: 915, height: 412 }); await W(300);
  await p.screenshot({ path: path.join(out, 'gate-report-land.png') });
  await p.setViewportSize({ width: 412, height: 915 }); await W(200);
  // 每周一行，永久保留
  const wk = await E(() => { window.EchoGame.T.weeklyRoll(); const S = window.EchoGame.S, n = S.weekly.length; S.log = {}; window.EchoGame.T.weeklyRoll(); return { n, after: S.weekly.length, fin: S.weekly.filter(r => r.fin).length, row: S.weekly[S.weekly.length - 1] }; });
  check(wk.n >= 2 && wk.after === wk.n && wk.fin >= 1 && 'd' in wk.row && 'rc' in wk.row, '每周压成一行存进 S.weekly，日志删了也还在', wk);

  // ---------- 9. 日报推送（可选，默认不发）----------
  await E(() => { window.EchoGame.closeModal(); window.__push = []; window.fetch = (u, o) => { window.__push.push({ u, o: { method: o.method, mode: o.mode, body: String(o.body) } }); return Promise.resolve({}); }; });
  await setL({ learn: 12, play: 20, review: 9, voiceLines: 6, gateOpen: 1 });
  await E(t => window.EchoGame.T.setNow(t), at(20, 30));
  await E(() => window.EchoGame.T.pushTick()); await W(200);
  check(await E(() => window.__push.length) === 0, '没设推送：不发');
  await settings(); await tap('#sheet [data-act=pushEdit]'); await W(200);
  check(await p.isVisible('#pin-pad'), '改日报推送：要家长密码');
  await pin('1234');
  await p.fill('#push-in', 'not-a-token'); await p.click('#sheet [data-act=pushSave]'); await W(200);
  check(!(await E(() => window.EchoGame.S.settings.push)), '看不懂的地址：不保存');
  const tok = '0123456789abcdef0123456789abcdef';
  await p.fill('#push-in', tok); await p.click('#sheet [data-act=pushSave]'); await W(200);
  check(await E(() => window.EchoGame.S.settings.push) === tok, 'PushPlus token 保存了');
  await E(() => window.EchoGame.closeModal());
  await E(t => window.EchoGame.T.setNow(t), at(20, 30));
  await E(() => window.EchoGame.T.pushTick()); await W(300);
  let ps = await E(() => ({ list: window.__push, sent: window.EchoGame.S.push.sent }));
  check(ps.list.length === 1 && /pushplus\.plus\/send/.test(ps.list[0].u) && ps.list[0].o.mode === 'no-cors' && ps.list[0].o.body.includes(tok) && /%E5%9B%9E%E5%A3%B0%E5%B2%9B%E6%97%A5%E6%8A%A5|回声岛日报/.test(decodeURIComponent(ps.list[0].o.body)) && ps.sent === today(), '20 点以后：发一条当天的日报（PushPlus）', ps);
  await E(t => window.EchoGame.T.setNow(t), at(21, 0));
  await E(() => window.EchoGame.T.pushTick()); await W(200);
  check(await E(() => window.__push.length) === 1, '一天只发一次');
  const sum = await E(d => window.EchoGame.T.daySummary(d), today());
  check(/✅ 学习任务完成了/.test(sum.text) && /用语音说了 6 句英语/.test(sum.text) && /有 1 段聊天需要家长看看/.test(sum.text) && !/bully|难过/.test(sum.text), '日报内容：完成情况、开口句数；聊天内容不发，只提示一句', sum);
  await E(() => { const S = window.EchoGame.S; S.settings.push = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc-123'; S.push = { sent: '' }; window.__push = []; });
  await E(t => window.EchoGame.T.setNow(t), at(20, 5));
  await E(() => window.EchoGame.T.pushTick()); await W(300);
  ps = await E(() => window.__push);
  check(ps.length === 1 && /qyapi\.weixin\.qq\.com/.test(ps[0].u) && JSON.parse(ps[0].o.body).msgtype === 'text' && /回声岛日报/.test(JSON.parse(ps[0].o.body).text.content), '企业微信群机器人：发 text 消息', ps[0]);
  await E(() => { const S = window.EchoGame.S; S.push = { sent: '' }; window.__push = []; });
  await E(t => window.EchoGame.T.setNow(t), at(10, 0));
  await E(() => window.EchoGame.T.pushTick()); await W(200);
  check(await E(() => window.__push.length) === 0, '还没到 20 点：不发今天的（昨天没开游戏也不补）');
  await E(() => { window.EchoGame.S.settings.push = ''; window.EchoGame.T.setNow(0); });

  // ---------- 每日宝箱：先开冒险奖品（world.js 的 chestPrize：进化石 / 蛋 / 异色蛋）----------
  await E(() => { const S = window.EchoGame.S; S.quests.list.forEach(q => { q.claimed = true; }); S.quests.chest = false; window.__cp = 0; EchoWorld.chestPrize = () => (window.__cp++, { prize: '💎', kind: 'stone', id: 'x', html: '<h2>开出进化石：测试石！</h2>' }); window.EchoGame.goHome('mon'); });
  await tap('#quests [data-act=chest]'); await W(1800);   // 宝箱一直在晃（不「稳定」），直接点
  check(/开出进化石：测试石/.test(await sheet()) && await E(() => window.__cp) === 1, '每日宝箱先开冒险奖品（进化石 / 蛋）');
  await p.click('#chestok').catch(() => {});

  check(!errs.length, '网页版没有报错', errs.slice(0, 3));

  // ---------- 10. APK（假的原生桥）：家长密码只认打包时设的，没设就拒绝 ----------
  const errs2 = [];
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(FN.install, { pin: null });
  const q = await ctx.newPage();
  q.setDefaultTimeout(5000);
  q.on('pageerror', e => errs2.push(e.message));
  const QE = (f, a) => q.evaluate(f, a);
  await q.goto(PAGE);
  await QE(s => localStorage.setItem('echo-island-v1', JSON.stringify(s)), base({ settings: Object.assign({}, SET, { mode: 'auto' }) }));
  await q.reload(); await q.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await q.waitForTimeout(300);
  await QE(() => { window.EchoGame.T.settings(); document.querySelector('#sheet [data-act=setGate][data-m="0"]').click(); });
  await q.waitForTimeout(200);
  check(/还没有家长密码/.test(await q.textContent('#sheet')) && !(await q.isVisible('#pin-pad')) && await QE(() => window.EchoGame.S.settings.gate) === true && !(await QE(() => window.EchoGame.S.settings.pin)), 'APK 没设家长密码：拒绝，不让当前的人设');
  await QE(() => { window.__fakeNative.pin = '2468'; window.EchoGame.closeModal(); window.EchoGame.T.settings(); document.querySelector('#sheet [data-act=setGate][data-m="0"]').click(); });
  await q.waitForTimeout(200);
  check(await q.isVisible('#pin-pad') && /请家长输入 4 位密码/.test(await q.textContent('#sheet')), 'APK 有密码：直接输（不是设）');
  const qpin = async ds => { for (const d of ds) await q.click('#sheet [data-act=pinKey][data-k="' + d + '"]'); await q.waitForTimeout(300); };
  for (let k = 0; k < 5; k++) await qpin('1111');
  let qs = await QE(() => ({ st: window.EchoGame.T.pinState(), L: window.EchoGame.dayLog(), gate: window.EchoGame.S.settings.gate }));
  check(qs.st.native && qs.st.locked && qs.L.pinLock === 1 && qs.gate === true && /10 分钟后再试/.test(await q.textContent('#pin-msg')), 'APK：错 5 次原生锁 10 分钟（记进周报）', qs);
  await QE(() => { window.__fakeNative.lockUntil = 0; window.EchoGame.closeModal(); window.EchoGame.T.settings(); document.querySelector('#sheet [data-act=setGate][data-m="0"]').click(); });
  await q.waitForTimeout(200);
  await qpin('2468');
  qs = await QE(() => ({ gate: window.EchoGame.S.settings.gate, pin: window.EchoGame.S.settings.pin || '', calls: window.__fakeNative.calls.filter(c => c === 'checkPin').length }));
  check(qs.gate === false && qs.pin === '' && qs.calls >= 6, 'APK：输对打包时的密码才关（S.settings.pin 不用）', qs);
  check(/回声岛 20261007-fake000（321）/.test(await q.textContent('#sheet .set-ver')), '设置页底部显示版本号');
  check(!errs2.length, 'APK 模拟没有报错', errs2.slice(0, 3));

  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
