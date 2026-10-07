// 学习引擎测试：诚实打分（评估第 8 条）、间隔复习排期（第 6 条）、按掌握程度撤提示（第 9 条）
// - 打分：易混的音（three/tree、went/want）不算对、只错词尾算半对、同音词算对、漏掉关键实词不过关、有一个词没说对就不给 Perfect
// - 秒出分：少说最后一个词不能提前结束
// - 复习本：冒险里答对到期的题算复习（每天最多 20 次）、对战没念准只降一格、带提示不升格、每天新进 ≤ 10 条、积压 > 40 不加新的、
//   按逾期最久排序、对战先出到期的题、上限 3000 条且已掌握的不删；模拟 120 天：有掌握的题、积压不一直涨
// - 撤提示：第 0–1 格看着念、第 2–3 格只给首字母、第 4 格以上凭记忆说；点提示 / 第二次才说对 = 带提示通过（经验减半、不升格）；
//   Boss 题掌握了先不给选项；聊天里改过的句子显示原话；结算页显示「用了提示」「不看字说对」
// 运行：node tests/review.test.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!ok) fails++; };
const ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  p.setDefaultTimeout(4000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message + ' @ ' + String(e.stack || '').split(/\n/).slice(1, 3).join(' | ')));
  const W = ms => p.waitForTimeout(ms);
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, homeTab: 'quiz', settings: { tts: 'online', mode: 'self', sfx: false, gate: false, music: 'off' } })));
  await p.reload(); await W(400);

  // ---------- 1. 打分 ----------
  const sc = await p.evaluate(() => {
    const f = (t, h) => { const r = window.EchoGame.speech.scoreSpeech(t, h); return { s: r.score, m: r.marks.map(x => x ? 1 : 0).join(''), full: r.full }; };
    return {
      tree: f('I like three apples.', 'I like tree apples'),
      likes: f('He likes music.', 'He like music'),
      went: f('I went to the park.', 'I want to the park'),
      eye: f('I', 'eye'), ate: f('eight', 'ate'), write: f('right', 'write'),
      tree1: f('three', 'tree'), plural: f('pencil', 'pencils'),
      key: f('A good friend should have personal qualities like honesty.', 'A good friend should have like honesty'),
      endings: f('She likes reading books and watches films.', 'She like read book and watch film'),
      brit: f('My favourite colour is grey.', 'my favorite color is gray'),
      realise: f('I realise it now.', 'I realize it now'),
      name: f('Wake up, Emberpup!', 'wake up ember pup'),
      name2: f('Wake up, Emberpup!', 'wake up amber pop'),
      monday: f('I go swimming on Monday.', 'I go swimming on Sunday'),
      extra: f('Good morning!', 'um good morning teacher'),
      these: f('These are my books.', 'Those are my books'),
      not: f("I don't like it.", 'I like it'),
      perfect: f('How do you go to school?', 'how do you go to school'),
      noFunc: f('I go to the school by bus.', 'I go to school by bus'),
      // 评审量出来的误判：英式拼写 / 过去式、撇号被丢掉、短的拼音人名
      learnt: f('I have learnt a lot.', 'I have learned a lot'),
      tyre: f('The tyre is flat.', 'the tire is flat'),
      dont: f("I don't like it.", 'I dont like it'),
      its: f("It's a cat.", 'Its a cat'),
      its2: f('The dog wags its tail.', "the dog wags it's tail"),
      whats: f("What's your name?", 'whats your name'),
      li: f('Good morning, Mr Li.', 'good morning mr lee'),
      lin: f('This is Lin Tao.', 'this is lynn tao'),
      zhang: f('Hello, Mr Zhang.', 'hello mr jang'),
      wang: f('Wang Fang is my friend.', 'Wong Fong is my friend'),
      noName: f('This is Lin Tao.', 'this is'),
      china: f('I live in China.', 'I live in Chinese'),
    };
  });
  check(sc.tree.s < 60 && sc.tree.m === '1101', 'three/tree：句子不过关，three 标红', sc.tree);
  check(sc.likes.s >= 60 && sc.likes.s < 85 && sc.likes.m === '101', 'likes/like：只错词尾算半对（过关、不是 Perfect、标红）', sc.likes);
  check(sc.went.s < 60, 'went/want 不算对', sc.went);
  check(sc.eye.s === 100 && sc.ate.s === 100 && sc.write.s === 100, '同音词：eye = I、ate = eight、write = right', [sc.eye.s, sc.ate.s, sc.write.s]);
  check(sc.tree1.s < 60 && sc.plural.s >= 60 && sc.plural.s < 85, '单个词：tree 不过关，pencils 过关但不是 Perfect', [sc.tree1.s, sc.plural.s]);
  check(sc.key.s < 60, '漏掉关键实词（personal qualities）不过关', sc.key);
  check(sc.endings.s >= 60 && sc.endings.s < 85, '只错了词尾的句子能过关（比漏实词分高）', sc.endings);
  check(sc.brit.s === 100 && sc.realise.s === 100, '拼写变体（英式 / 美式）照样满分', [sc.brit.s, sc.realise.s]);
  check(sc.name.s >= 85 && sc.name2.s >= 55, '名字被拆成两个词、听写得不太像也认得（Ember pup / amber pop）', [sc.name, sc.name2]);
  check(sc.monday.s < 60, '大写的普通词不放宽：Monday ≠ Sunday', sc.monday);
  check(sc.extra.s === 100, '前后多说了几个词：短句满分', sc.extra);
  check(sc.these.s < 85 && sc.these.m[0] === '0', 'these/those 不算对', sc.these);
  check(sc.not.s < 60, '漏掉 not（意思反了）不过关', sc.not);
  check(sc.perfect.s === 100 && sc.perfect.full, '全对 100 分', sc.perfect);
  check(sc.noFunc.s < 85 && sc.noFunc.s >= 60 && !sc.noFunc.full, '漏一个虚词：过关但不给 Perfect', sc.noFunc);
  check(sc.learnt.s === 100 && sc.tyre.s === 100, '英式拼写 / 过去式：learnt = learned、tyre = tire', [sc.learnt.s, sc.tyre.s]);
  check(sc.dont.s === 100 && sc.its.s === 100 && sc.its2.s === 100 && sc.whats.s === 100, '识别结果丢了撇号（dont、Its、whats）或乱加（it\'s tail）：照样满分', [sc.dont.s, sc.its.s, sc.its2.s, sc.whats.s]);
  check(sc.li.s >= 85 && sc.lin.s >= 85 && sc.zhang.s >= 85 && sc.wang.s >= 85, '短的拼音人名写成英文的样子（Lee、Lynn、Jang、Wong Fong）：算对', [sc.li.s, sc.lin.s, sc.zhang.s, sc.wang.s]);
  check(sc.noName.s < 85 && !sc.noName.full, '名字整个没说：不给 Perfect', sc.noName);
  check(sc.china.s < 85, '大写的普通词不放宽：China ≠ Chinese', sc.china);

  // ---------- 2. 秒出分：少说最后一个词不能提前结束 ----------
  await p.evaluate(() => {
    window.__heard = []; window.__how = '';
    EchoTalk.cloudSR = () => true;
    EchoTalk.aiTip = async () => '';
    // 假的边说边识别：按顺序给出实时结果，game.js 的 match 一对上就结束
    EchoTalk.listenOnce = async o => {
      const seq = window.__heard.shift() || [''];
      let how = 'done', text = seq[seq.length - 1];
      for (const t of seq) { if (o.onState) o.onState(t); if (o.match && o.match(t)) { how = 'match'; text = t; break; } }
      window.__how = how;
      return { text, err: text ? null : 'no-speech', how };
    };
    window.EchoGame.S.settings.mode = 'auto';
  });
  const T = 'My favourite subjects are maths and English.';
  const em = await p.evaluate(T => ({ cut: window.EchoGame.speech.earlyMatch(T, 'My favourite subjects are maths and'), full: window.EchoGame.speech.earlyMatch(T, 'My favorite subjects are maths and English') }), T);
  check(!em.cut && em.full, '秒出分：少最后一个词不触发，说全了才触发', em);
  const rec = await p.evaluate(async T => {
    window.__heard = [['My favourite', 'My favourite subjects are maths and', 'My favourite subjects are maths and English', 'My favourite subjects are maths and English too']];
    const r = await window.EchoGame.speech.recognize(null, [T]);
    const a = { how: window.__how, text: r.alts[0] };
    window.__heard = [['My favourite subjects are maths', 'My favourite subjects are maths and']];
    const r2 = await window.EchoGame.speech.recognize(null, [T]);
    return [a, { how: window.__how, text: r2.alts[0] }];
  }, T);
  check(rec[0].how === 'match' && /English$/.test(rec[0].text) && rec[1].how === 'done', '实时识别：念到 English 才秒出分，半句不提前交卷', rec);

  // ---------- 3. 复习本的规则 ----------
  const R = await p.evaluate(({ t0, t1 }) => {
    const G = window.EchoGame, E = G.rev, S = G.S, out = {};
    const reset = () => { S.rev.items = {}; S.rev.day = { d: '', n: 0, f: 0 }; };
    // 排序：逾期最久的先来（不管格子）
    reset();
    S.rev.items['word:13:0'] = { k: 'word', w: 13, i: 0, b: 0, due: '2000-01-05', x: 3 };
    S.rev.items['word:13:1'] = { k: 'word', w: 13, i: 1, b: 4, due: '2000-01-01', x: 0 };
    S.rev.items['word:13:2'] = { k: 'word', w: 13, i: 2, b: 0, due: t0, x: 1 };
    out.order = E.due().map(([k]) => k);
    // 冒险里答对到期的题：升一格，每天最多算 20 次
    reset();
    for (let n = 0; n < 25; n++) S.rev.items['free:x' + n] = { k: 'free', en: 'Sentence number ' + n, zh: '句子', b: 2, due: '2000-01-01', x: 0 };
    for (let n = 0; n < 25; n++) E.right({ kind: 'sent', free: 'free:x' + n });
    out.field = { up: Object.values(S.rev.items).filter(e => e.b === 3).length, f: E.day().f };
    // 带提示答对：冒险里不变；复习里不升格、明天再考
    reset();
    S.rev.items['sent:13:0'] = { k: 'sent', w: 13, i: 0, b: 3, due: '2000-01-01', x: 0 };
    E.right({ kind: 'sent', w: 13, i: 0 }, false, true);
    out.aidedField = Object.assign({}, S.rev.items['sent:13:0']);
    E.right({ kind: 'sent', w: 13, i: 0 }, true, true);
    out.aidedRev = Object.assign({}, S.rev.items['sent:13:0']);
    E.right({ kind: 'sent', w: 13, i: 0 }, true);
    out.rev = Object.assign({}, S.rev.items['sent:13:0']);
    // 对战没念准：只降一格；没见过的记成错题
    S.rev.items['sent:13:1'] = { k: 'sent', w: 13, i: 1, b: 4, due: '2030-01-01', x: 0 };
    E.miss({ kind: 'sent', w: 13, i: 1 }); E.miss({ kind: 'sent', w: 13, i: 2 });
    out.miss = [Object.assign({}, S.rev.items['sent:13:1']), Object.assign({}, S.rev.items['sent:13:2'])];
    // 每天新进最多 10 条；带提示学到的按「弱」进来，也占名额
    reset();
    E.right({ kind: 'word', w: 13, i: 20 }, false, true);
    out.weak = Object.assign({}, S.rev.items['word:13:20']);
    for (let i = 0; i < 15; i++) E.right({ kind: 'word', w: 13, i });
    out.fresh = Object.values(S.rev.items).filter(e => e.b === 1 && e.due === t1).length;
    E.right({ kind: 'word', w: 13, i: 21 }, false, true);
    out.weakCap = !S.rev.items['word:13:21'];
    E.right({ kind: 'word', w: 0, i: 0 });   // 小岛的题答对不进复习
    out.isle = !S.rev.items['word:0:0'];
    // 积压超过 40 条：当天不加新学的
    reset();
    for (let n = 0; n < 41; n++) S.rev.items['free:y' + n] = { k: 'free', en: 'Backlog ' + n, zh: '积压', b: 1, due: '2000-01-01', x: 0 };
    E.right({ kind: 'word', w: 14, i: 0 });
    out.backlog = !S.rev.items['word:14:0'];
    // 对战出题：先出到期的、同一场不重复；冒险复习次数用完就出单元里没学过的
    reset();
    S.book.mix = 1;
    S.rev.items['sent:13:3'] = { k: 'sent', w: 13, i: 3, b: 2, due: '2000-01-01', x: 0 };
    S.rev.items['dlg:13:4'] = { k: 'dlg', w: 13, i: 4, b: 2, due: '2000-01-02', x: 0 };
    S.rev.items['free:z'] = { k: 'free', en: 'I usually walk to school.', zh: '我通常走路上学。', b: 2, due: '2000-01-03', x: 0 };
    const used = new Set();
    const a = E.pick('sent', 0, used), bq = E.pick('sent', 0, used), c = E.pick('dlg', 0, used);
    out.pick = [E.key(a.q), E.key(bq.q), E.key(c.q), a.it[0] === window.BOOKS.list[0].units[0].sents[3][0], !!bq.d.sents];
    S.rev.day.f = 20;
    const d2 = E.pick('sent', 0, new Set());
    out.pickFull = { key: E.key(d2.q), inRev: !!S.rev.items[E.key(d2.q)], unit: d2.q.w >= 13 };
    S.book.mix = .6;
    // 上限 3000 条还没掌握的；已经掌握的不删
    reset();
    for (let n = 0; n < 3010; n++) S.rev.items['free:t' + n] = { k: 'free', en: 'Trim ' + n, zh: '', b: 1, due: '2030-01-01', x: n % 2, c: '2026-01-01' };
    for (let n = 0; n < 5; n++) S.rev.items['free:m' + n] = { k: 'free', en: 'Mastered ' + n, zh: '', b: 7, due: '', x: 0 };
    E.trim();
    const all = Object.values(S.rev.items);
    out.trim = { active: all.filter(e => e.due).length, mastered: all.filter(e => !e.due).length, keptWrong: all.filter(e => e.due && e.x).length };
    // 聊天里改过的句子：存下原话
    reset();
    E.addFree('I usually get up at half past six.', '我通常六点半起床。', 'I usually get up at six half.');
    const fe = Object.entries(S.rev.items)[0];
    out.free = { said: fe[1].said, due: fe[1].due, fade: E.fade({ kind: 'sent', free: fe[0] }) };
    // 撤提示的级别和提示文字
    S.rev.items['sent:13:5'] = { k: 'sent', w: 13, i: 5, b: 0, due: t0 };
    S.rev.items['sent:13:6'] = { k: 'sent', w: 13, i: 6, b: 2, due: t0 };
    S.rev.items['sent:13:7'] = { k: 'sent', w: 13, i: 7, b: 4, due: t0 };
    S.rev.items['sent:13:8'] = { k: 'sent', w: 13, i: 8, b: 7, due: '' };
    out.fade = [5, 6, 7, 8, 9].map(i => E.fade({ kind: 'sent', w: 13, i }));
    out.cue = [E.cue('I usually get up.', 1), E.cue('My name is Tom.', 2, true)];
    reset();
    return out;
  }, { t0: ymd(0), t1: ymd(1) });
  check(R.order.join(',') === 'word:13:1,word:13:0,word:13:2', '复习顺序：逾期最久的先来', R.order);
  check(R.field.up === 20 && R.field.f === 20, '冒险里答对到期的题：升一格，每天最多算 20 次', R.field);
  check(R.aidedField.b === 3 && R.aidedField.due === '2000-01-01', '冒险里带提示答对：不算复习', R.aidedField);
  check(R.aidedRev.b === 3 && R.aidedRev.due === ymd(1), '复习里带提示答对：不升格，明天再考', R.aidedRev);
  check(R.rev.b === 4 && R.rev.due === ymd(7), '复习里自己答对：升一格（第 4 格隔 7 天）', R.rev);
  check(R.miss[0].b === 3 && R.miss[0].due === ymd(0) && R.miss[0].x === 1 && R.miss[1].b === 0 && R.miss[1].due === ymd(0), '对战没念准：只降一格、今天再复习；没见过的记成错题', R.miss);
  check(R.fresh === 9 && R.weak.b === 0 && R.weak.due === ymd(1) && R.weakCap && R.isle, '每天新进最多 10 条；带提示学到的按「弱」进来、也占名额；小岛的题答对不进', [R.fresh, R.weak, R.weakCap, R.isle]);
  check(R.backlog, '积压超过 40 条：当天不加新学的');
  check(R.pick[0] === 'sent:13:3' && R.pick[1] === 'free:z' && R.pick[2] === 'dlg:13:4' && R.pick[3] && R.pick[4], '对战出题：先出到期的、同一场不重复（聊天句子也能出）', R.pick);
  check(!R.pickFull.inRev && R.pickFull.unit, '冒险复习次数用完：出正在学的单元里没学过的', R.pickFull);
  check(R.trim.active === 3000 && R.trim.mastered === 5 && R.trim.keptWrong === 1505, '上限 3000 条：先删没错过的，已经掌握的不删', R.trim);
  check(R.free.said === 'I usually get up at six half.' && R.free.due === ymd(1) && R.free.fade === 3, '聊天里改过的句子：存下原话，明天复习', R.free);
  check(R.fade.join(',') === '0,1,2,2,0', '撤提示：第 0–1 格看着念、2–3 格首字母、4 格以上和已掌握凭记忆、没进复习本的看着念', R.fade);
  check(R.cue[0] === 'I  u______  g__  u_.' && R.cue[1] === 'My  ____  __  ___.', '提示文字：首字母 / 全遮住（回答留第一个词）', R.cue);

  // ---------- 4. 模拟 120 天：掌握数 > 0，积压不一直涨 ----------
  const sim = await p.evaluate(() => {
    const RealDate = Date; let off = 0;
    function FakeDate(...a) { if (!new.target) return RealDate(); return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + off); }
    FakeDate.prototype = RealDate.prototype; FakeDate.now = () => RealDate.now() + off; FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
    const realRandom = Math.random;
    let seed = 20261007;
    Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.Date = FakeDate;
    const G = window.EchoGame, E = G.rev, S = G.S, NB = window.WORLDS.length, units = window.BOOKS.list.flatMap(b => b.units);
    S.rev.items = {}; S.rev.day = { d: '', n: 0, f: 0 }; S.book.mix = .6;
    const days = [];
    try {
      for (let d = 0; d < 120; d++) {
        off = d * 864e5;
        S.book.at = Math.min(units.length - 1, Math.floor(d / 17));
        const due0 = E.due().length, w = NB + S.book.at, U = units[S.book.at];
        // ① 闯关学新的：正在学的单元里没见过的 4 题答对，另外 2 题答错
        const unseen = [];
        [['word', U.words], ['sent', U.sents], ['dlg', U.dlgs]].forEach(([kind, L]) => L.forEach((x, i) => { if (!S.rev.items[kind + ':' + w + ':' + i]) unseen.push({ kind, w, i }); }));
        for (let k = unseen.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [unseen[k], unseen[j]] = [unseen[j], unseen[k]]; }
        unseen.slice(0, 4).forEach(q => E.right(q));
        unseen.slice(4, 6).forEach(q => E.wrong(q));
        // ② 冒险：3 场对战，每场 5 题，九成答对
        for (let bt = 0; bt < 3; bt++) {
          const used = new Set();
          for (let k = 0; k < 5; k++) {
            const r = Math.random(), kind = r < .4 ? 'word' : r < .8 ? 'sent' : 'dlg';
            const pk = E.pick(kind, d % 13, used);
            if (Math.random() < .9) E.right(pk.q); else E.miss(pk.q);
          }
        }
        // ③ 每日复习一轮（20 题），九成答对
        for (const q of E.build()) { if (Math.random() < .9) E.right(q, true); else E.wrong(q); }
        const all = Object.values(S.rev.items);
        days.push({ d, due0, mastered: all.filter(e => !e.due).length, total: all.length });
      }
    } finally { window.Date = RealDate; Math.random = realRandom; }
    // 收拾模拟留下的「未来」记录（学习记录、最晚日期、每日任务），后面的测试按真实日期走
    S.rev.items = {}; S.rev.day = { d: '', n: 0, f: 0 }; S.log = {}; S.maxDay = ''; S.quests.day = '';
    document.getElementById('toasts').innerHTML = '';
    return days;
  });
  const last = sim[sim.length - 1], mid = sim.slice(50, 70), end = sim.slice(100);
  const avg = a => a.reduce((x, y) => x + y.due0, 0) / a.length;
  console.log('  模拟：第 30 天积压 ' + sim[30].due0 + '，第 60 天 ' + sim[60].due0 + '，第 90 天 ' + sim[90].due0 + '，第 119 天 ' + last.due0 + '；掌握 ' + last.mastered + ' / 共 ' + last.total + ' 条');
  check(last.mastered > 0, '120 天后有掌握的题', last);
  check(avg(end) <= Math.max(45, avg(mid) * 1.3) && Math.max(...end.map(x => x.due0)) <= 60, '积压不一直往上涨（第 100–120 天的积压不比第 50–70 天多很多）', { mid: Math.round(avg(mid)), end: Math.round(avg(end)), max: Math.max(...end.map(x => x.due0)) });

  // ---------- 5. 闯关 / 复习里撤提示（录音自评模式） ----------
  const U0 = await p.evaluate(() => window.BOOKS.list[0].units[0].sents.slice(0, 8));
  const setItems = items => p.evaluate(items => { const S = window.EchoGame.S; S.rev.items = items; S.rev.day = { d: '', n: 0, f: 0 }; }, items);
  const t0 = ymd(0);
  await setItems({ 'sent:13:0': { k: 'sent', w: 13, i: 0, b: 0, due: t0 }, 'sent:13:1': { k: 'sent', w: 13, i: 1, b: 2, due: t0 }, 'sent:13:2': { k: 'sent', w: 13, i: 2, b: 5, due: t0 } });
  await p.evaluate(() => { window.EchoGame.S.settings.mode = 'self'; });
  const card = async () => p.evaluate(() => { const st = document.querySelector('#st'); return { mask: st && st.classList.contains('mask'), st: st ? st.textContent : '', title: (document.querySelector('.q-title') || {}).textContent || '', type: (document.querySelector('.q-type') || {}).textContent || '', body: document.querySelector('#p-body').textContent }; });
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 0]], true)); await W(300);
  let c = await card();
  check(!c.mask && c.st.replace(/\s+/g, ' ').trim() === U0[0][0], '第 0 格：看着原文跟读', c.st);
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 1]], true)); await W(300);
  c = await card();
  check(c.mask && /_/.test(c.st) && c.st[0] === U0[1][0][0] && /首字母/.test(c.title) && /看首字母说/.test(c.type), '第 2 格：只给首字母（题型标签也改成「看首字母说」）', c);
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 2]], true)); await W(300);
  c = await card();
  check(c.mask && !/[a-z]/i.test(c.st) && /凭记忆/.test(c.title) && /凭记忆说/.test(c.type) && c.body.includes(U0[2][1]), '第 5 格：凭记忆说（只给中文，标签「凭记忆说」）', c);
  await p.screenshot({ path: path.join(out, 'review-fade.png') });
  check(await p.isVisible('#hintbtn') && !(await p.$('#p-body [data-act=sayT]')), '凭记忆说：没有「听原音」按钮，只有「💡 提示」');
  await p.click('#hintbtn'); await W(100);
  c = await card();
  check(c.mask && /^[A-Z]/.test(c.st) && /_/.test(c.st), '点提示：先给首字母', c.st);
  await p.click('#hintbtn'); await W(100);
  c = await card();
  check(!c.mask && c.st.replace(/\s+/g, ' ').trim() === U0[2][0] && await p.evaluate(() => window.EchoGame.P().aided), '再点提示：整句亮出来，这题算带提示', c.st);

  // ---------- 6. AI 打分模式：凭记忆说对、带提示、第二次才说对 ----------
  await p.evaluate(() => { window.EchoGame.S.settings.mode = 'auto'; });
  await setItems({ 'sent:13:2': { k: 'sent', w: 13, i: 2, b: 5, due: t0 }, 'sent:13:3': { k: 'sent', w: 13, i: 3, b: 5, due: t0 }, 'sent:13:4': { k: 'sent', w: 13, i: 4, b: 1, due: t0 } });
  const say = async heard => { await p.evaluate(h => { window.__heard.push(...h.map(x => [x])); }, heard); };
  // 凭记忆说对
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 2]], true)); await W(300);
  await say([U0[2][0]]);
  await p.click('#mic'); await W(400);
  let fb = await p.textContent('#fb-t');
  let st = await p.evaluate(() => ({ e: window.EchoGame.S.rev.items['sent:13:2'], recall: window.EchoGame.P().recall, aided: window.EchoGame.P().aided }));
  check(/Perfect！每个词都说对了/.test(fb) && st.e.b === 6 && st.recall === 1 && !st.aided, '凭记忆说对：Perfect、复习升一格、记一次「不看字说对」', { fb, st });
  // 点了提示再说对
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 3]], true)); await W(300);
  await p.click('#hintbtn'); await W(100);
  await say([U0[3][0]]);
  await p.click('#mic'); await W(400);
  fb = await p.textContent('#fb-t');
  st = await p.evaluate(() => window.EchoGame.S.rev.items['sent:13:3']);
  check(/有提示/.test(fb) && !/Perfect/.test(fb) && st.b === 5 && st.due === ymd(1), '点了提示：不算 Perfect，复习里不升格，明天再考', { fb, st });
  await p.click('#fb-btn'); await W(500);
  const res = await p.textContent('#result').catch(() => '');
  check(/1 题用了提示/.test(res), '结算页：用了几次提示', res.slice(0, 120));
  // 第二次才说对
  await p.evaluate(() => window.EchoGame.playQs([['sr_s', 13, 4]], true)); await W(300);
  await say(['banana banana', U0[4][0]]);
  await p.click('#mic'); await W(300);
  const hint1 = await p.textContent('#mic-hint');
  await p.click('#mic'); await W(400);
  fb = await p.textContent('#fb-t');
  st = await p.evaluate(() => ({ e: window.EchoGame.S.rev.items['sent:13:4'], combo: window.EchoGame.P().combo }));
  check(/2\/3/.test(hint1) && /有提示/.test(fb) && st.e.b === 1 && st.combo === 0, '第二次才说对：算带提示（不升格、不加连击）', { hint1, fb, st });
  // Boss 对话题：掌握了先不给选项，说不出来才亮出
  await setItems({ 'dlg:13:0': { k: 'dlg', w: 13, i: 0, b: 3, due: t0 } });
  await p.evaluate(() => window.EchoGame.playQs([['bt', 13, 0]], false)); await W(300);
  check(await p.isHidden('#bt-opts') && await p.isVisible('#bt-show'), 'Boss 题掌握了：先只播问题，不给选项');
  await say(['hello there my friend']);
  await p.click('#mic'); await W(400);
  check(await p.isVisible('#bt-opts .opt') && await p.evaluate(() => window.EchoGame.P().aided), '说不出来：亮出选项，这题算带提示');
  // 聊天里改过的句子：显示原话（划掉），让他直接说出对的
  await setItems({});
  await p.evaluate(() => { window.EchoGame.rev.addFree('I usually get up at half past six.', '我通常六点半起床。', 'I usually get up at six half.'); for (const e of Object.values(window.EchoGame.S.rev.items)) e.due = '2000-01-01'; });
  await p.evaluate(() => window.EchoGame.goHome());
  await p.evaluate(() => document.querySelector('[data-act=review]').click()); await W(300);
  await p.click('#modal [data-act=startReview]'); await W(500);
  const fq = await p.evaluate(() => ({ s: (document.querySelector('#p-body s') || {}).textContent || '', mask: !!document.querySelector('#st.mask'), title: document.querySelector('.q-title').textContent }));
  check(fq.s === 'I usually get up at six half.' && fq.mask, '聊天句子复习：显示原来的说法（划掉），正确的要自己说', fq);
  await p.screenshot({ path: path.join(out, 'review-chat-fix.png') });

  check(!errs.length, '没有报错', errs.slice(0, 3));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
