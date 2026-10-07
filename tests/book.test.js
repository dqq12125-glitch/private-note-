// 端到端测试：课本同步（沪教版七上）和每日复习（间隔复习）
// - 闯关页默认是「📗 课本同步」，能选正在学的单元，单元的第 1 关能全对通关
// - 课本新学的题答对 → 明天复习；答错 → 当天复习；复习答对 → 隔天再来
// - AI 聊天里老师给的更好说法进复习、能出题；老存档的错题本会搬进每日复习
// - 冒险出题有几成来自正在学的单元；聊天页课本话题排在前面
// - 秒出分：少说最后一个词时不能提前结束（复习排期、打分、撤提示的细节在 tests/review.test.js）
// 运行：node tests/book.test.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  p.setDefaultTimeout(4000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  let last = '';
  p.on('request', r => { const m = /audio=([^&]+)/.exec(r.url()); if (m) last = decodeURIComponent(m[1]); });
  const W = ms => p.waitForTimeout(ms);
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')));

  // ---------- 1. 课本同步页 ----------
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, homeTab: 'quiz', settings: { tts: 'online', mode: 'self', sfx: false } })));
  await p.reload(); await W(500);
  check(await p.isVisible('.book-head'), '闯关页默认显示课本同步');
  check(await p.evaluate(() => document.querySelectorAll('.world.unit').length === window.BOOKS.list[0].units.length), '显示正在学这一册的单元');
  await p.click('[data-act=bookPick]'); await W(200);
  await p.click('#modal [data-act=bookAt][data-i="1"]'); await W(400);
  check((await S()).book.at === 1, '选了七上 Unit 2');
  check(await p.evaluate(() => !!document.querySelector('.world.unit.now') && document.querySelector('.world.unit.now').textContent.includes('School life')), 'Unit 2 标成正在学');
  await p.click('.node.cur'); await p.click('#sheet [data-act=start]');
  for (let k = 0; k < 14; k++) {
    await W(700);
    if (await p.isVisible('#result')) break;
    const info = await p.evaluate(word => {
      const opts = [...document.querySelectorAll('#p-body .opt[data-act=pick] .o-t')].map(e => e.textContent);
      const w = window.BOOKS.list[0].units[1].words.find(x => x[0] === word);
      return { opts, idx: opts.findIndex(t => t === word || (w && t === w[1])) };
    }, last);
    if (info.idx >= 0) await p.click('#p-body .opt[data-act=pick] >> nth=' + info.idx).catch(() => {});
    await W(200);
    await p.click('#fb-btn').catch(() => {});
  }
  const res = await p.textContent('#result').catch(() => '');
  check(/通关/.test(res), 'Unit 2 第 1 关通关', res.slice(0, 40));
  await p.screenshot({ path: path.join(out, 'book-result.png') });
  let s = await S();
  const items = Object.entries(s.rev.items);
  const u2 = items.filter(([k]) => k.startsWith('word:14:'));
  check(u2.length >= 8 && u2.every(([, e]) => e.b === 1 && e.due === tomorrow()), '答对的课本单词排进明天的复习', u2.length);
  check(s.stars['14-0'] > 0, 'Unit 2 第 1 关有星星');

  // ---------- 2. 答错 → 今天复习；复习答对 → 进一格 ----------
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('echo-island-v1'));
    s.rev.items['word:14:0'] = { k: 'word', w: 14, i: 0, b: 0, due: '2000-01-01', x: 2 };   // 很早以前答错的
    s.rev.items['sent:13:3'] = { k: 'sent', w: 13, i: 3, b: 3, due: '2000-01-02', x: 0 };    // 到期的学过的句子
    localStorage.setItem('echo-island-v1', JSON.stringify(s));
  });
  await p.reload(); await W(500);
  const card = await p.textContent('.rev-card').catch(() => '');
  check(/今日复习 2 题/.test(card) && /1 道错题/.test(card), '首页显示今日复习', card.trim());
  await p.screenshot({ path: path.join(out, 'book-revcard.png') });
  await p.click('.rev-card'); await W(300);
  check(await p.isVisible('#modal [data-act=startReview]'), '每日复习弹窗');
  await p.click('#modal [data-act=startReview]'); await W(600);
  check(await p.isVisible('#play') && (await p.textContent('#p-body')).trim().length > 0, '复习题出来了');
  const sched = await p.evaluate(() => window.EchoGame.dueList().map(([k, e]) => k + '@' + e.b));
  check(sched[0] === 'word:14:0@0', '错题排在复习最前面', sched);
  const moved = await p.evaluate(() => { window.EchoGame.revRight({ kind: 'word', w: 14, i: 0 }, true); return window.EchoGame.S.rev.items['word:14:0']; });
  check(moved.b === 1 && moved.due === tomorrow(), '复习答对：进一格，明天再来', moved);
  const moved2 = await p.evaluate(() => { const e = window.EchoGame.S.rev.items['sent:13:3']; window.EchoGame.revRight({ kind: 'sent', w: 13, i: 3 }, true); return e; });
  const in7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  check(moved2.b === 4 && moved2.due === in7, '第 3 格答对：隔 7 天', moved2);

  // ---------- 3. AI 聊天的句子进复习、能出题 ----------
  await p.goto(PAGE); await W(400);
  await p.evaluate(() => { window.EchoGame.revAddFree('I usually get up at half past six.', '我通常六点半起床。'); });
  let s3 = await S();
  const free = Object.entries(s3.rev.items).find(([k]) => k.startsWith('free:'));
  check(free && free[1].due === tomorrow() && free[1].src === 'chat', 'AI 聊天的更好说法排进明天', free && free[1]);
  await p.evaluate(() => { const s = window.EchoGame.S; for (const e of Object.values(s.rev.items)) e.due = e.k === 'free' ? '2000-01-01' : ''; });
  await p.evaluate(() => document.querySelector('[data-act=review]').click()); await W(300);
  await p.click('#modal [data-act=startReview]'); await W(700);
  const qtext = await p.textContent('#p-body').catch(() => '');
  check(/六点半/.test(qtext) || ['usually', 'half', 'past', 'six'].every(w => qtext.includes(w)), '聊天句子能出成复习题（跟读或排句子）', qtext.slice(0, 60));
  await p.screenshot({ path: path.join(out, 'book-freeq.png') });

  // ---------- 4. 老存档的错题本搬进每日复习 ----------
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self' }, wrong: { 'word:0:2': { k: 'word', w: 0, i: 2, m: 3 } } })));
  await p.reload(); await W(500);
  const s4 = await p.evaluate(() => window.EchoGame.S);
  check(s4.rev.items['word:0:2'] && s4.rev.items['word:0:2'].b === 0 && s4.rev.items['word:0:2'].x === 3 && !Object.keys(s4.wrong).length, '老错题本搬进每日复习');

  // 只有七上那时的老存档：book.cur（第几单元）→ book.at
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self' }, book: { cur: 5, mix: .6, view: 'book' } })));
  await p.reload(); await W(400);
  check(await p.evaluate(() => window.EchoGame.S.book.at === 4 && window.EchoGame.curUnit().en === 'Off to space'), '老存档的「学到第 5 单元」迁移成七上 Unit 5');

  // ---------- 5. 冒险出题有几成来自正在学的单元 ----------
  const mix = await p.evaluate(() => {
    const s = window.EchoGame.S; s.book.at = 2; s.book.mix = .6;
    let unit = 0, cur = 0; for (let k = 0; k < 2000; k++) { const r = window.EchoGame.src(4); if (r.w >= 13) { unit++; if (r.w === 15) cur++; } }
    s.book.mix = 0; let none = 0; for (let k = 0; k < 200; k++) if (window.EchoGame.src(4).w >= 13) none++;
    return { unit: unit / 2000, cur: cur / Math.max(1, unit), none };
  });
  check(mix.unit > .5 && mix.unit < .7 && mix.cur > .6 && mix.none === 0, '冒险出题约六成来自课本（其中七成是正在学的单元），关掉就没有', mix);

  // ---------- 6. 聊天页：课本话题在前，正在学的单元排第一 ----------
  await p.evaluate(() => { localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9'); const s = window.EchoGame.S; s.book.at = 3; s.homeTab = 'talk'; localStorage.setItem('echo-island-v1', JSON.stringify(s)); });
  await p.reload(); await W(500);
  const first = await p.evaluate(() => { const c = document.querySelector('.tk-card'); return c ? c.dataset.npc + (c.classList.contains('now') ? ' now' : '') : ''; });
  check(first === 'hj7a-u4 now', '聊天页第一个是正在学的单元', first);
  await p.screenshot({ path: path.join(out, 'book-talk.png') });

  // ---------- 7. 学习锁：有复习没做 / 没聊天时不能进冒险；做完就开 ----------
  await p.goto(PAGE);
  await p.evaluate(() => {
    const d = new Date(), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    localStorage.setItem('echo-talk-url', 'ws://127.0.0.1:9');   // 假装连得上对话服务：聊天也算一项
    localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, homeTab: 'mon', settings: { tts: 'online', mode: 'self', sfx: false },
      mon: { v: 2, box: [{ uid: 'u0', sp: 'sprouty', lv: 5, xp: 0 }], team: ['u0'], dex: {}, balls: 5, potions: 0, bag: {}, badges: {} },
      rev: { v: 1, items: { 'word:13:0': { k: 'word', w: 13, i: 0, b: 0, due: '2000-01-01', x: 1 } } } }));
  });
  await p.reload(); await W(500);
  let g = await p.evaluate(() => window.EchoGame.gate());
  check(!g.open && !g.revDone && g.chatOn && !g.chatDone, '学习锁关着：复习没做、没聊天', g);
  check(await p.isVisible('.gate-card') && await p.isVisible('.world-go.locked'), '怪兽冒险页显示学习锁卡片、冒险按钮锁着');
  await p.screenshot({ path: path.join(out, 'book-gate.png') });
  await p.click('.world-go'); await W(400);
  check(await p.isHidden('#world'), '锁着时点「继续冒险」进不去');
  await p.evaluate(() => { const S = window.EchoGame.S, d = window.EchoGame.dayLog(); d.revSess = 1; S.talk.days = { ['hj7a-u1:' + Object.keys(S.log).sort().pop()]: 1 }; });
  g = await p.evaluate(() => window.EchoGame.gate());
  check(g.open, '复习做完、聊过一次：学习锁打开', g);
  // 打开以后当天一直开着：冒险里又答错一题也不会再锁上
  g = await p.evaluate(() => { const S = window.EchoGame.S; S.rev.items['word:13:1'] = { k: 'word', w: 13, i: 1, b: 0, due: '2000-01-01', x: 1 }; window.EchoGame.dayLog().revSess = 0; return window.EchoGame.gate(); });
  check(g.open, '当天打开过就一直开着（又答错一题也不锁）', g);
  // 聊天连上以后服务器出错：只临时放行 30 分钟（不写 gateOpen；细节在 tests/gate.test.js）
  g = await p.evaluate(() => { const S = window.EchoGame.S, L = window.EchoGame.dayLog(); delete L.gateOpen; L.revSess = 1; S.talk.days = {}; L.chatFail = 1; return window.EchoGame.gate(); });
  check(g.open && g.chatFail && g.pass && !(await p.evaluate(() => window.EchoGame.dayLog().gateOpen)), '聊天连不上：临时放行（不算做完）', g);
  // 手机日期往回调：锁着
  g = await p.evaluate(() => { const S = window.EchoGame.S; S.maxDay = '2099-01-01'; return window.EchoGame.gate(); });
  check(!g.open && g.back, '手机日期被往回调：锁着', g);
  await p.evaluate(() => { window.EchoGame.S.maxDay = ''; });
  // 关学习锁要家长密码（网页版第一次由家长设；自己画的数字键盘），再关一次输错不行
  const pin = async digits => { for (const d of digits) await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(300); };
  const setGate = m => p.evaluate(m => { window.EchoGame.closeModal(); window.EchoGame.T.settings(); document.querySelector('#sheet [data-act=setGate][data-m="' + m + '"]').click(); }, m);
  await p.evaluate(() => { const S = window.EchoGame.S; S.settings.gate = true; S.settings.pin = ''; });
  await setGate('0'); await W(200);
  check(await p.isVisible('#pin-pad'), '关学习锁：弹出家长密码键盘');
  await pin('1234'); await pin('1234');
  let st = await p.evaluate(() => ({ gate: window.EchoGame.S.settings.gate, pin: window.EchoGame.S.settings.pin, off: !!window.EchoGame.dayLog().gateOff }));
  check(st.gate === false && st.pin === '1234' && st.off, '第一次关学习锁：家长设好密码，当天记下「关过」', st);
  await setGate('1'); await W(200);
  await setGate('0'); await W(200);
  await pin('0000');
  st = await p.evaluate(() => ({ gate: window.EchoGame.S.settings.gate }));
  check(st.gate === true, '密码输错关不了学习锁', st);
  await p.evaluate(() => { const S = window.EchoGame.S; window.EchoGame.closeModal(); S.talk.days = {}; S.settings.gate = false; });
  check(await p.evaluate(() => window.EchoGame.gate().open), '家长把学习锁关了也能进');

  // ---------- 8. 学习周报 ----------
  await p.evaluate(() => {
    const S = window.EchoGame.S, L = window.EchoGame.dayLog();
    Object.assign(L, { min: 25, learn: 18, play: 7, levels: 2, spoken: 9, review: 6 });
    S.talk.log = [{ t: Date.now(), npc: 'hj7a-u1', turns: [], eval: { done: true, stars: 3, praise: '好', tips: [{ said: 'I goes to school.', better: 'I go to school.', zh: '' }] }, sec: 90 }];
    window.EchoGame.reportSheet();
  });
  await W(300);
  const rp = await p.textContent('#sheet .report').catch(() => '');
  check(/学习周报/.test(rp) && /25/.test(rp) && /I go to school/.test(rp) && /开口说对/.test(rp), '周报：时间、开口次数、聊天里改过的句子', rp.slice(0, 80));
  await p.screenshot({ path: path.join(out, 'book-report.png') });

  // ---------- 9. 秒出分：少说最后一个词时不能提前结束（评估第 8 条）----------
  await p.evaluate(() => window.EchoGame.closeModal());
  const early = await p.evaluate(async () => {
    const S = window.EchoGame.S, u = window.BOOKS.list[0].units[0], long = u.sents.slice().sort((a, b) => b[0].length - a[0].length)[0][0];
    const cut = long.replace(/\s*\S+$/, '');   // 少说最后一个词
    S.settings.mode = 'auto';
    EchoTalk.cloudSR = () => true;
    let how = '';
    // 假的边说边识别：一个词一个词地冒出来，game.js 的 match 一对上就结束
    EchoTalk.listenOnce = async o => { const ws = (window.__say || '').split(' '); for (let k = 1; k <= ws.length; k++) { const t = ws.slice(0, k).join(' '); if (o.match && o.match(t)) { how = 'match@' + k; return { text: t, err: null }; } } how = 'done'; return { text: ws.join(' '), err: null }; };
    window.__say = cut; await window.EchoGame.speech.recognize(null, [long]); const a = how;
    window.__say = long; await window.EchoGame.speech.recognize(null, [long]); const b = how;
    S.settings.mode = 'self';
    return { long, n: long.split(' ').length, cutScore: window.EchoGame.speech.scoreSpeech(long, cut).score, a, b };
  });
  check(early.a === 'done' && early.b === 'match@' + early.n && early.cutScore < 90, '少说最后一个词不会秒出分，说全了才秒出分', early);

  check(!errs.length, '没有报错', errs.slice(0, 3));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
