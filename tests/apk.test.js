// APK 专属路径的端到端测试（家长 2026-10-07，评估第 3、7、15、19 条）：注入假的安卓原生桥 EchoNative（tests/fake-native.js）和假的麦克风
// - AI 打分用不了：额度用完（Arrearage）/ 密钥失效（401）/ 没网 → 分清原因提示、首页红条、记进当天日志和周报；
//   连着 2 次 → 练习「先跳过（已放进复习，联网后要补说）」、剧情说话任务先跳过 / 选回答改成点选、选伙伴先跳过、战斗这一回合改成听音选招（不能暴击）；
//   APK 没有 AI 密钥 → 设置页「请家长在这里粘贴 AI 密钥」、一开始就能先跳过
// - 麦克风被拒：分清「这次没允许」/「永久拒绝」，弹窗说明 +「去打开」（openAppSettings），从设置回来麦克风好了就自动关掉；「没听清」算一次尝试
// - 第一次打开的「麦克风 + 网络 + 密钥」小检查（说一句 Hello）
// - 学习锁按 EchoTalk.today() 开（语音说满 6 句）；家长密码走 EchoNative.checkPin
// - 存档：每天第一次保存前轮换本机 3 份备份、往手机写一份；存档坏了不覆盖、用最近一份好的备份（本机的，再看手机里的）；
//   导出（shareFile）；从备份恢复（要家长密码）
// - 新版本：version.json 的 code 比装着的大 → 首页「有新版本，请家长更新」；设置底部和周报角落有版本号
// - 出错记录：没接住的错误存进 localStorage，周报诊断一行；3D 画面丢了（webglcontextlost）：大地图、对战都重建，不留黑屏；精美档最多 2 倍像素
// 运行：node tests/apk.test.js（大约 2 分钟）
// 注意：这个测试不用 file:// 打开，而是起一个本机的小网站（http://echo.localhost:端口）——口语识别的录音要用 AudioWorklet，
// file:// 页面加载不了它（blob:null）；用 echo.localhost 而不是 localhost，是为了别让 talk.js 去连本机 8787 的中转服务。外面的网址一律挡掉
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const FN = require('./fake-native');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ROOT = path.join(__dirname, '..');
const VER_URL = 'https://dqq12125-glitch.github.io/private-note-/version.json';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.normalize(path.join(ROOT, u === '/' ? 'index.html' : u));
    if (!f.startsWith(ROOT) || /[\\/](android|server|node_modules|art)[\\/]/.test(f.slice(ROOT.length))) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, data) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 600) : '')); if (!ok) fails++; };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());

const MON = { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0 }], team: ['a'], dex: { emberpup: 'caught' }, balls: 5, potions: 3, bag: {}, badges: {} };
const WORLD = { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))) };
// mode 'auto'：APK 里一律开口 + AI 打分（speakMode 'sr'）；micCheck 填上，别每次都弹小检查
const BASE = o => Object.assign({
  seenIntro: true, micCheck: TODAY, homeTab: 'quiz', player: { gender: 'boy', name: 'Tom' },
  settings: { tts: 'online', mode: 'auto', sfx: false, music: 'off', gfx: '2d', gate: false },
  mon: MON, world: WORLD, rev: { v: 1, items: {} }, book: { at: 0, mix: 0.6, view: 'book', vb: '' },
}, o || {});

// 假麦克风：tone 每 2.6 秒「说」一句（0.8 秒 320Hz 的声音，够响）、silent 一直没声音、deny 不让用（NotAllowedError）
function fakeMic() {
  const md = navigator.mediaDevices;
  if (!md) return;
  md.getUserMedia = async () => {
    const m = localStorage.getItem('__mic') || 'tone';
    if (m === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = 0; osc.connect(g); g.connect(dest); osc.start();
    if (m === 'tone') { const burst = () => { const t = ac.currentTime; g.gain.setValueAtTime(0.3, t + 0.05); g.gain.setValueAtTime(0, t + 0.85); }; burst(); setInterval(burst, 2600); }
    return dest.stream;
  };
}
// 假原生桥的状态跨刷新保留：手机里的备份（__fakeBackups）、测试改过的开关（__fakeOpts：key / net / mic / pin …）
function keepFake() {
  const F = window.__fakeNative; if (!F) return;
  try { Object.assign(F.backups, JSON.parse(localStorage.getItem('__fakeBackups') || '{}')); } catch (e) { /* 忽略 */ }
  try { Object.assign(F, JSON.parse(localStorage.getItem('__fakeOpts') || '{}')); } catch (e) { /* 忽略 */ }
  const w = window.EchoNative.backupWrite;
  window.EchoNative.backupWrite = j => { const r = w(j); try { localStorage.setItem('__fakeBackups', JSON.stringify(F.backups)); } catch (e) { /* 忽略 */ } return r; };
}

(async () => {
  const srv = await serve();
  const PAGE = 'http://echo.localhost:' + srv.address().port + '/index.html';
  const b = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  let ver = { code: 400, name: '20261010-abc1234', url: 'https://example.com/echo-island.apk', notes: '新的冒险' };
  let verHits = 0;
  // 外面的网址一律挡掉（在线发音、谷歌字体……），只放 version.json（给假的内容）
  await ctx.route(u => !/^http:\/\/echo\.localhost:/.test(u.href) && !u.href.startsWith(VER_URL), r => r.abort());
  await ctx.route(VER_URL + '*', r => { verHits++; r.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(ver) }); });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', e => { if (!/boom-test/.test(e.message)) errs.push(e.message); });
  await p.addInitScript(FN.install, { key: 'sk-fake', net: 'offline', mic: 'granted', pin: '1234' });
  await p.addInitScript(keepFake);
  await p.addInitScript(fakeMic);
  const W = ms => p.waitForTimeout(ms);
  const E = (f, a) => p.evaluate(f, a);
  const until = async (fn, max = 60, gap = 150) => { for (let i = 0; i < max; i++) { if (await fn()) return true; await W(gap); } return false; };
  const fake = o => E(o => { Object.assign(window.__fakeNative, o); const k = JSON.parse(localStorage.getItem('__fakeOpts') || '{}'); localStorage.setItem('__fakeOpts', JSON.stringify(Object.assign(k, o))); }, o);
  const mic = m => E(m => localStorage.setItem('__mic', m), m);
  // 换存档、清掉本机备份和测试开关，重新打开；extra：要额外放进 localStorage 的键
  const load = async (s, opts) => {
    opts = opts || {};
    await E(([s, o]) => {
      Object.keys(localStorage).filter(k => /^echo-island-v1|^echo-errs|^__/.test(k)).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('__fakeOpts', JSON.stringify(o.fake || {}));
      localStorage.setItem('__mic', o.mic || 'tone');
      Object.entries(o.ls || {}).forEach(([k, v]) => localStorage.setItem(k, v));
      if (s !== null) localStorage.setItem('echo-island-v1', typeof s === 'string' ? s : JSON.stringify(s));
    }, [s, opts]);
    await p.reload();
    await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden);
    await W(300);
  };
  const closeAll = () => E(() => { window.EchoGame.closeModal(); window.EchoGame.goHome(); });
  const L = () => E(() => window.EchoGame.dayLog());
  const pin = async digits => { for (const d of digits) await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(350); };
  const sheet = () => p.textContent('#sheet').catch(() => '');
  const bars = () => p.textContent('#home-bars').catch(() => '');

  await p.goto(PAGE);

  // ---------- 1. 额度用完：真的走一遍「假麦克风 → listenOnce → 假原生桥 → 分类」（评估第 3 条）----------
  await load(BASE(), { fake: { net: 'quota' } });
  check(await E(() => window.ECHO_APP === 1 && window.EchoGame.speech && !window.EchoGame.A.down()), 'APK 模式（假原生桥）：一开始 AI 没出问题');
  await E(() => window.EchoGame.playQs([['sr_s', 13, 0]])); await W(900);
  check(await p.isHidden('#p-skip'), '练习开口题：平时没有「先跳过」');
  await p.click('#mic');
  check(await until(() => E(() => /额度用完/.test(document.querySelector('#mic-hint').textContent)), 80), '第 1 次：提示「AI 额度用完了」（不是「没听清」）', await p.textContent('#mic-hint'));
  let a = await E(() => ({ down: window.EchoGame.A.down(), skip: document.querySelector('#p-skip').hidden, L: window.EchoGame.dayLog(), tries: window.EchoGame.P().tries + window.EchoGame.P().miss }));
  check(!a.down && a.skip && a.L.aiKey === 1 && a.L.aiKeyWhy === 'quota' && a.tries === 0, '只失败 1 次：还不给跳过，记进日志（aiKey、quota），不算尝试次数', a);
  await p.click('#mic');
  check(await until(() => E(() => !document.querySelector('#p-skip').hidden), 80), '连着第 2 次：出现「先跳过（已放进复习，联网后要补说）」');
  check(/先跳过（已放进复习，联网后要补说）/.test(await p.textContent('#p-skip')), '跳过按钮的字');
  await p.click('#p-skip'); await W(300);
  a = await E(() => { const G = window.EchoGame, e = G.S.rev.items['sent:13:0']; return { fb: document.querySelector('#fb-t').textContent, e, L: G.dayLog(), hearts: G.P().hearts }; });
  check(/先跳过/.test(a.fb) && a.e && a.e.owe === 1 && a.e.due === TODAY && a.L.aiSkip === 1 && a.hearts === 3, '跳过：这题放进复习（今天到期、标「要补说」），不扣心', a);
  await closeAll(); await W(200);
  check(/AI 额度用完了，请告诉家长/.test(await bars()), '首页挂红条「AI 额度用完了，请告诉家长」', await bars());
  await p.click('#home-bars .ai-bar'); await W(200);
  check(/百炼控制台/.test(await sheet()) && /先跳过/.test(await sheet()), '点红条：说清楚怎么办（家长去百炼看额度；要开口的题可以先跳过）');
  await p.screenshot({ path: out + '/apk-ai-bar.png' });
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.reportSheet(); }); await W(300);
  const rp = await p.textContent('#sheet .report');
  check(/💳 AI 额度或密钥出问题 1 天/.test(rp) && /先跳过 1 题/.test(rp) && /密钥\/额度 2/.test(rp) && /20261007-fake000/.test(rp), '周报：额度问题、先跳过几题、诊断里的失败次数和版本号', rp.slice(-300));
  // 复习：AI 用不了时只出听力题；联网以后「要补说」的那句一定是开口题
  a = await E(() => { const G = window.EchoGame, R = G.rev; return { off: R.build().map(q => q.type), on: (G.A.note('ok'), R.build().map(q => q.type)) }; });
  check(!a.off.some(t => /^sr_|^sp$/.test(t)) && a.on.includes('sr_s'), '复习：AI 用不了只出听力题，好了以后「要补说」的那句是开口题', a);

  // ---------- 2. 密钥失效（401）/ 没网：原因分得清（talk.js 的分类，走假原生桥的 HTTPS）----------
  a = {};
  for (const net of ['badkey', 'quota', 'offline']) {
    await fake({ net });
    a[net] = await E(async () => { await EchoTalk.aiTip('I like apples.', 'I like apple ' + Math.random()); return EchoTalk.lastErr().why; });
  }
  check(a.badkey === 'auth' && a.quota === 'quota' && a.offline === 'offline', '401 → 密钥不对；Arrearage → 额度；找不到服务器 → 没网', a);
  a = await E(() => { const A = window.EchoGame.A; return [A.failOf({ err: 'network', why: 'auth' }), A.failOf({ err: 'network', why: 'busy' }), A.failOf({ err: 'network', why: 'offline' }), A.failOf({ err: 'not-allowed' }), A.failOf({ err: 'no-speech' }), A.hint({ fail: 'key', why: 'auth' })]; });
  check(a.join('|') === 'key|key|net|mic|unheard|🔑 AI 密钥不对，没法打分：请告诉家长', '四类：密钥 / 额度 / 太忙算一类，没网一类，麦克风，真没听清', a);

  // ---------- 3. 战斗：连着 2 次额度失败 → 这一回合听音选招，不能暴击 ----------
  await load(BASE({ settings: { tts: 'online', mode: 'auto', sfx: false, music: 'off', gfx: '2d', gate: false } }), { fake: { net: 'quota' } });
  await E(() => MonsterGame.battle('wild', 0, { onEnd() {}, foes: [MonsterGame.newMon('twigling', 14)] }));
  check(await until(() => p.$('#b-panel [data-act=bMove]'), 160), '对战开始');
  const spoken0 = await E(() => window.EchoGame.S.stats.spoken);
  await p.click('[data-act=bMove][data-i="1"]'); await W(200);
  await p.click('#b-mic');
  check(await until(() => E(() => /额度用完/.test((document.querySelector('#b-hint') || {}).textContent || '')), 80), '对战第 1 次：提示额度用完了');
  await p.click('#b-mic');
  check(await until(() => p.$('#b-panel .b-listen'), 80), '连着第 2 次：这一回合改成听音选招');
  a = await E(() => { const B = MonsterGame._b(); return { head: document.querySelector('#b-panel .task-h').textContent, n: document.querySelectorAll('#b-panel .b-listen .opt').length, ci: B.task.lopts.findIndex(o => o.c), hinted: B.hinted }; });
  check(/AI 打分暂时用不了/.test(a.head) && /不能暴击/.test(a.head) && a.n >= 2 && a.hinted, '听音选招：说明 + 选项，算带提示（不能暴击）', a);
  await p.screenshot({ path: out + '/apk-battle-listen.png' });
  await p.click('#b-panel .b-listen .opt >> nth=' + a.ci);
  check(await until(() => E(() => !/暴击/.test(document.querySelector('#b-msg').textContent) && MonsterGame._b() && MonsterGame._b().turn !== 'show' && MonsterGame._b().turn !== 'task'), 60), '点对了：出招，没有暴击');
  a = await E(([s0]) => ({ spoken: window.EchoGame.S.stats.spoken - s0, listen: window.EchoGame.dayLog().aiListen }), [spoken0]);
  check(a.spoken === 0 && a.listen === 1, '听音选的回合不算「开口说对」', a);
  // 下一回合：AI 还是用不了，一开始就是听音选
  await until(() => E(() => { if (!MonsterGame._b() || document.querySelector('#sheet [data-act=bEnd]')) return true; const d = document.querySelector('#b-panel [data-act=bDef]'); if (d) d.click(); return !!document.querySelector('#b-panel [data-act=bMove]'); }), 120);
  if (await p.$('#b-panel [data-act=bMove]')) {
    await p.click('[data-act=bMove][data-i="0"]'); await W(200);
    check(!!(await p.$('#b-panel .b-listen')) && !(await p.$('#b-mic')), 'AI 还是用不了：下一招直接听音选（单词招也一样）');
  }
  await E(() => { const x = document.querySelector('[data-act=bFlee]'); if (x) x.click(); });
  await p.click('#sheet [data-act=bEnd]').catch(() => {});

  // ---------- 4. 没有 AI 密钥：设置页提示、一开始就能先跳过、选伙伴先跳过、剧情说话任务先跳过 / 选回答改点选 ----------
  await load(BASE({ mon: { v: 2, box: [], team: [], dex: {}, balls: 5, bag: {}, badges: {} }, homeTab: 'mon' }), { fake: { key: '' } });
  a = await E(() => ({ noKey: window.EchoGame.A.noKey(), down: window.EchoGame.A.down(), bar: document.querySelector('#home-bars').textContent }));
  check(a.noKey && a.down && /还没有 AI 密钥/.test(a.bar), '没有 AI 密钥：一开始就算「AI 用不了」，首页红条', a);
  await E(() => window.EchoGame.A.settings()); await W(200);
  check(/请家长在这里粘贴 AI 密钥/.test(await p.textContent('#sheet .set-warn')) && !!(await p.$('#sheet .set-warn [data-act=talk_cfg]')), '设置页最上面：「请家长在这里粘贴 AI 密钥」+ 粘贴按钮');
  check(/20261007-fake000（321）/.test(await p.textContent('#sheet .set-ver')), '设置页底部显示版本号（EchoNative.version）');
  await p.screenshot({ path: out + '/apk-nokey-settings.png' });
  await closeAll();
  // 选伙伴
  await E(() => { const x = document.createElement('button'); x.dataset.act = 'mStarter'; x.dataset.sp = 'emberpup'; document.body.appendChild(x); x.click(); x.remove(); }); await W(200);
  check(await p.isVisible('#st-skip'), '选伙伴：没有密钥时直接有「先跳过」');
  await p.click('#st-mic'); await W(300);
  check(/还没有 AI 密钥/.test(await p.textContent('#st-hint')), '选伙伴点话筒：说清楚是没有密钥');
  await p.click('#st-skip'); await W(400);
  a = await E(() => { const S = window.EchoGame.S, e = S.rev.items['free:emberpup be my partner']; return { box: S.mon.box.length, e }; });
  check(a.box === 1 && a.e && a.e.owe === 1 && a.e.en === 'Emberpup, be my partner!', '先跳过：伙伴照样选好，这句放进复习（联网后要补说）', a);
  // 练习：开口题一进来就有「先跳过」
  await closeAll();
  await E(() => window.EchoGame.playQs([['sr_w', 13, 1]])); await W(900);   // 出题 0.38 秒后会自动念一遍（会停掉正在听的话筒）：等它念上再点话筒
  check(await p.isVisible('#p-skip'), '练习开口题：没有密钥时一进来就有「先跳过」');
  await p.click('#mic'); await W(300);
  check(/还没有 AI 密钥/.test(await p.textContent('#mic-hint')), '点话筒：提示还没有 AI 密钥');
  await closeAll();
  // 剧情：说话任务「先跳过」、选回答改成直接点
  await E(() => { const x = document.createElement('button'); x.dataset.act = 'wEnter'; document.body.appendChild(x); x.click(); x.remove(); });
  check(await until(() => E(() => !!(window.EchoWorld && EchoWorld._debug().M) && !document.querySelector('#world').hidden), 40), '进大地图');
  for (let i = 0; i < 30 && await E(() => !!EchoWorld._debug().dlg); i++) { await E(() => { const s = document.querySelector('#w-dlg [data-act=wAiSkip]:not([hidden])') || document.querySelector('#w-dlg [data-act=wPick]'); if (s) s.click(); else { const a = document.querySelector('#world [data-act=wA]'); if (a) a.click(); } }); await W(150); }
  await E(() => EchoWorld._debug().talk([{ who: 'Kai', en: 'Say hello to me!', zh: '大声说：你好，小凯！', kind: 'speak', target: 'Hello, Kai!' }]));
  await W(300);
  check(await p.isVisible('#w-aiskip'), '剧情说话任务：AI 用不了时有「先跳过」');
  await p.click('#w-aiskip'); await W(300);
  a = await E(() => ({ dlg: !!EchoWorld._debug().dlg, e: window.EchoGame.S.rev.items['free:hello kai'] }));
  check(!a.dlg && a.e && a.e.owe === 1 && a.e.zh === '你好，小凯！', '先跳过：剧情接着走，这句（带中文）放进复习', a);
  await E(() => { window.__passed = 0; EchoWorld._debug().talk([{ who: 'Kai', en: 'Are you ready?', zh: '你准备好了吗？', kind: 'answer', opts: [{ t: 'No, I am not.' }, { c: true, t: 'Yes, I am!' }], pass: () => { window.__passed = 1; return []; } }]); });
  await W(300);
  a = await E(() => ({ mic: !!document.querySelector('#w-mic'), hint: (document.querySelector('#w-hint') || {}).textContent }));
  check(!a.mic && /直接点出正确的回答/.test(a.hint), '选回答的任务：AI 用不了时直接点出正确的回答（没有话筒）', a);
  await p.click('#w-dlg .opt >> nth=1'); await W(1200);
  check(await E(() => window.__passed === 1 && !EchoWorld._debug().dlg && !!window.EchoGame.S.rev.items['free:yes i am']), '点对了：剧情照常往下走，这句也放进复习');
  await closeAll();

  // ---------- 5. 麦克风被拒：说明 +「去打开」，从设置回来就好了；「没听清」算一次尝试 ----------
  await load(BASE(), { fake: { mic: 'blocked', micAfterSettings: 'granted' }, mic: 'deny' });
  await E(() => window.EchoGame.playQs([['sr_w', 13, 2]])); await W(900);   // 出题 0.38 秒后会自动念一遍（会停掉正在听的话筒）：等它念上再点话筒
  await p.click('#mic');
  check(await until(() => p.$('#sheet [data-act=micFix]'), 40), '麦克风被永久拒绝：弹窗说明 +「去打开」');
  a = await sheet();
  check(/要用麦克风才能开口说英语/.test(a) && /去打开/.test(a) && /权限/.test(a), '弹窗：为什么要用麦克风、怎么打开', a);
  await p.screenshot({ path: out + '/apk-mic-blocked.png' });
  await p.click('#sheet [data-act=micFix]'); await W(300);
  a = await E(() => ({ opened: window.__fakeNative.settingsOpened, modal: !document.querySelector('#modal').hidden, deny: window.EchoGame.dayLog().micDeny }));
  check(a.opened === 1 && !a.modal && a.deny === 1, '点「去打开」：跳到系统设置；回来麦克风好了弹窗自动关（记一次被拒）', a);
  await closeAll();
  await load(BASE(), { fake: { mic: 'denied' }, mic: 'deny' });
  await E(() => window.EchoGame.playQs([['sr_w', 13, 2]])); await W(900);   // 出题 0.38 秒后会自动念一遍（会停掉正在听的话筒）：等它念上再点话筒
  await p.click('#mic');
  await until(() => p.$('#sheet [data-act=micFix]'), 40);
  a = await sheet();
  check(/再点一次话筒/.test(a) && /去设置里打开/.test(a) && /再试一次/.test(a), '只是这次没允许：「再试一次」（还有「去设置里打开」）', a);
  await closeAll();
  // 没听清（麦克风没声音）：算一次尝试，第 3 次就记进错题本
  await load(BASE(), { fake: { net: 'ok' }, mic: 'silent' });
  await E(() => window.EchoGame.playQs([['sr_w', 13, 3]])); await W(900);   // 出题 0.38 秒后会自动念一遍（会停掉正在听的话筒）：等它念上再点话筒
  await p.click('#mic');
  check(await until(() => E(() => /没听清.*第 2\/3 次/.test(document.querySelector('#mic-hint').textContent)), 80), '没听清：算一次尝试（第 2/3 次）', await p.textContent('#mic-hint'));
  check(await E(() => !window.EchoGame.A.down() && window.EchoGame.P().miss === 1), '没听清不算 AI 出错');
  await closeAll();

  // ---------- 6. 第一次打开：「麦克风 + 网络 + 密钥」小检查 ----------
  await load(BASE({ micCheck: '' }), { fake: { net: 'ok' } });
  await E(() => { const F = window.__fakeNative; F.onWsOpen = (id, u, cb) => cb(id, 'error', 'HTTP 500 test'); F.onPost = (id, u, body, cb) => cb(id, 'ok', JSON.stringify({ choices: [{ message: { content: 'Hello.' } }] })); });
  check(await until(() => p.$('#sheet #chk-mic'), 30), 'APK 第一次打开：自动弹出小检查');
  check(/大声说：Hello!/.test(await sheet()), '小检查：请孩子说一句 Hello');
  await p.click('#chk-mic');
  check(await until(() => E(() => !document.querySelector('#chk-done').hidden), 80), '说了 Hello：检查通过');
  a = await E(() => ({ rows: [...document.querySelectorAll('#chk li')].map(x => x.className), heard: document.querySelector('#chk-heard').textContent, saved: window.EchoGame.S.micCheck }));
  check(a.rows.every(c => c === 'chk-ok') && /Hello/.test(a.heard) && a.saved === TODAY, '麦克风 ✅ 网络 ✅ 密钥 ✅，记下做过了', a);
  await p.screenshot({ path: out + '/apk-check.png' });
  await p.click('#chk-done');
  await load(BASE({ micCheck: '' }), { fake: { key: '' }, mic: 'silent' });
  await until(() => p.$('#sheet #chk-mic'), 30);
  a = await E(() => [...document.querySelectorAll('#chk li')].map(x => x.className + ':' + x.textContent));
  check(/chk-bad:🔑 AI 密钥 ❌ 还没有/.test(a.join('|')), '没有密钥：小检查一打开就标出来', a);
  await p.click('#chk-mic');
  check(await until(() => E(() => /chk-quiet/.test(document.querySelector('#chk').innerHTML)), 60), '麦克风没声音：提示是不是被挡住了');
  await p.click('#sheet [data-act=chkSkip]');
  check(await E(() => window.EchoGame.S.micCheck === 'skip'), '先跳过：以后不自动弹（设置里还能做）');

  // ---------- 7. 学习锁按 EchoTalk.today()；家长密码走 EchoNative.checkPin ----------
  await load(BASE({ settings: { tts: 'online', mode: 'auto', sfx: false, music: 'off', gfx: '2d', gate: true }, homeTab: 'mon' }));
  await E(() => { window.__today = { voiceLines: 3, goals: 0, typedLines: 2, need: 6, done: false }; EchoTalk.today = () => window.__today; window.EchoGame.goHome('mon'); });
  a = await E(() => ({ g: window.EchoGame.gate(), card: document.querySelector('.gate-card').textContent }));
  check(!a.g.open && a.g.chatOn && a.g.voice === 3 && /已开口说 3\/6 句/.test(a.card), '学习锁：语音说了 3 句（打字的不算）还没开，卡片显示 3/6', a);
  await E(() => { window.__today = { voiceLines: 6, goals: 0, typedLines: 0, need: 6, done: true }; window.EchoGame.goHome('mon'); });
  a = await E(() => ({ g: window.EchoGame.gate(), L: window.EchoGame.dayLog() }));
  check(a.g.open && a.g.chatDone && a.L.gateOpen === 1, '说满 6 句：开锁（真做完了）', a.g);
  await fake({ key: '' });
  await E(() => { window.EchoGame.dayLog().gateOpen = 0; delete window.EchoGame.dayLog().gateOpen; window.__today = { voiceLines: 0, goals: 0, need: 6, done: false }; });
  a = await E(() => window.EchoGame.gate());
  check(a.open && a.exWhy === 'noai' && !a.chatOn, '没有 AI 密钥（聊天没开通）：聊天这一项整天免（🟡）', a);
  await fake({ key: 'sk-fake' });
  // 密钥不对时去聊天：孩子只看到一句听得懂的话（HTTP 401 这种原文只记进出错记录），学习锁卡片说清楚、不再给「去聊天」
  const net0 = await E(() => window.__fakeNative.net);
  await fake({ net: 'badkey' });
  await E(() => { delete window.EchoGame.dayLog().gateEx; window.__today = { voiceLines: 0, goals: 0, need: 6, done: false }; EchoTalk.open('lily'); });
  // 原文只出现在灰色小字「（给家长看：…）」里
  const kidText = () => E(() => { const o = document.querySelector('#tk-ov'); if (!o) return ''; const c = o.cloneNode(true); c.querySelectorAll('.tk-raw').forEach(x => x.remove()); return c.textContent; });
  await until(async () => /密钥不对/.test(await kidText()), 40);
  a = await E(() => ({ raw: (document.querySelector('#tk-ov .tk-raw') || {}).textContent || '', errs: window.EchoErr.list().filter(x => x.k === 'ai').map(x => x.m) }));
  a.kid = await kidText();
  check(/AI 密钥不对，请告诉家长/.test(a.kid) && !/HTTP|Unauthorized|direct:/.test(a.kid) && (!a.raw || /给家长看/.test(a.raw)) && !/direct:/.test(a.raw) && a.errs.some(m => /401/.test(m)) && !a.errs.some(m => /direct:/.test(m)),
    '聊天连不上（密钥不对）：孩子看到「AI 密钥不对，请告诉家长」，HTTP 401 原文只在「给家长看」的小字和出错记录里（不写 direct:）', a);
  await p.screenshot({ path: out + '/apk-chat-badkey.png' });
  await E(() => EchoTalk.endIfOpen()); await W(200);
  await E(() => window.EchoGame.goHome('mon')); await W(200);
  a = await E(() => ({ g: window.EchoGame.gate(), card: (document.querySelector('.gate-card') || {}).textContent || '', btn: !!document.querySelector('.gate-card [data-act=gateTalk]') }));
  check(a.g.keyBad === 'auth' && /AI 密钥不对，现在聊不了，请告诉家长/.test(a.card) && !a.btn, '学习锁卡片：写明密钥不对、聊不了（请告诉家长），不再给「去聊天」按钮', a);
  await fake({ net: net0 });
  // 家长密码：关学习锁要输，走原生 checkPin（输错有次数，输对放行）
  await E(() => window.EchoGame.A.settings()); await W(200);
  await E(() => document.querySelector('#sheet [data-act=setGate][data-m="0"]').click()); await W(200);
  await pin('0000');
  a = await E(() => ({ msg: document.querySelector('#pin-msg').textContent, calls: window.__fakeNative.calls.filter(c => c === 'checkPin').length, gate: window.EchoGame.S.settings.gate }));
  check(/还能试 4 次/.test(a.msg) && a.calls === 1 && a.gate === true, '密码输错：原生 checkPin 说不对，还能试 4 次', a);
  await pin('1234');
  check(await E(() => window.EchoGame.S.settings.gate === false && window.EchoGame.dayLog().gateOff === 1), '输对 1234（假原生里打包的密码）：学习锁关掉，记一笔');
  await closeAll();

  // ---------- 8. 存档：每天第一次保存前轮换备份、往手机写一份 ----------
  const OLD = JSON.stringify(BASE({ xp: 777, player: { gender: 'boy', name: 'Old' } }));
  await load(OLD, { ls: { 'echo-island-v1-bakmeta': JSON.stringify({ day: '2000-01-01' }), 'echo-island-v1-bak1': JSON.stringify(BASE({ xp: 1 })) } });
  await E(() => window.EchoGame.A.save());
  a = await E(() => ({ b1: JSON.parse(localStorage.getItem('echo-island-v1-bak1')).xp, b2: JSON.parse(localStorage.getItem('echo-island-v1-bak2')).xp, meta: window.EchoGame.A.bakMeta(), nat: Object.keys(window.__fakeNative.backups) }));
  check(a.b1 === 777 && a.b2 === 1 && a.meta.day === TODAY && a.meta.d1 === '2000-01-01', '今天第一次保存：上一份存档 → 备份 1，原来的备份 1 → 备份 2', a);
  check(a.nat.length === 1 && a.nat[0] === 'echo-save-' + TODAY.replace(/-/g, '') + '.json', '往手机「下载/EchoIsland」写了今天的备份（backupWrite）', a.nat);
  // 存档坏了：不覆盖、用本机最近一份好的备份，告诉孩子
  const BROKEN = '{"xp": 5, "coins": 9, "pla';
  await load(BROKEN, { ls: { 'echo-island-v1-bak1': JSON.stringify(BASE({ xp: 4321, player: { gender: 'boy', name: 'Bak' } })), 'echo-island-v1-bakmeta': JSON.stringify({ day: TODAY, d1: '2026-10-06' }) } });
  await until(() => p.$('#sheet .big'), 20);
  a = await E(() => ({ xp: window.EchoGame.S.xp, name: window.EchoGame.S.player.name, bad: localStorage.getItem('echo-island-v1-bad'), main: JSON.parse(localStorage.getItem('echo-island-v1')).xp, sheet: document.querySelector('#sheet').textContent }));
  check(a.xp === 4321 && a.name === 'Bak' && a.bad === BROKEN && a.main === 4321, '存档坏了：坏的那份原样另存，用本机最近的备份接着玩', a);
  check(/存档读不出来了/.test(a.sheet) && /2026-10-06/.test(a.sheet), '打开后告诉孩子用了哪天的备份', a.sheet);
  await closeAll();
  // 本机没有备份：用手机「下载/EchoIsland」里的
  const PHONE = JSON.stringify(BASE({ xp: 999, player: { gender: 'girl', name: 'Phone' } }));
  await load(BROKEN, { ls: { __fakeBackups: JSON.stringify({ 'echo-save-20261005.json': { text: PHONE, time: Date.now() - 864e5 } }) } });
  await until(() => p.$('#sheet .big'), 20);
  a = await E(() => ({ name: window.EchoGame.S.player.name, sheet: document.querySelector('#sheet').textContent }));
  check(a.name === 'Phone' && /下载\/EchoIsland/.test(a.sheet), '本机没有备份：用手机「下载/EchoIsland」里的', a);
  await closeAll();
  // 一份好的都没有：从头开始，坏档留着
  await load(BROKEN);
  await until(async () => /存档读不出来/.test(await sheet()), 20);
  check(/从头开始/.test(await sheet()) && await E(() => localStorage.getItem('echo-island-v1-bad') === '{"xp": 5, "coins": 9, "pla'), '一份备份都没有：从头开始，坏档另外留着');
  await p.click('#sheet [data-act=restoredOk]'); await W(300);
  check(/欢迎来到回声岛/.test(await sheet()), '「知道了」以后接着看游戏说明（新存档）');
  await closeAll();
  // 导出存档：分享成文件（可以发到微信）
  await load(BASE({ player: { gender: 'boy', name: 'Export' } }));
  await E(() => window.EchoGame.A.settings()); await W(200);
  await E(() => document.querySelector('#sheet [data-act=bakExport]').click()); await W(200);
  a = await E(() => window.__fakeNative.shared.map(s => ({ name: s.name, file: s.file, ok: JSON.parse(s.text).player.name })));
  check(a.length === 1 && a[0].file && /^echo-save-\d{8}\.json$/.test(a[0].name) && a[0].ok === 'Export', '导出存档：shareFile 发一个 echo-save-日期.json', a);
  // 从备份恢复：要家长密码；列出本机和手机里的备份；选一份 → 确认 → 重新打开就是那份存档
  await E(txt => { const F = window.__fakeNative; F.backups['echo-save-20261001.json'] = { text: txt, time: Date.now() - 6 * 864e5 }; localStorage.setItem('__fakeBackups', JSON.stringify(F.backups)); },
    JSON.stringify(BASE({ xp: 2468, player: { gender: 'boy', name: 'Restored' } })));
  await E(() => document.querySelector('#sheet [data-act=bakRestore]').click()); await W(200);
  check(!!(await p.$('#sheet #pin-pad')), '从备份恢复：先要家长密码');
  await pin('1234');
  a = await E(() => [...document.querySelectorAll('#sheet [data-act=bakUse]')].map(x => x.dataset.src + ':' + x.textContent));
  check(a.some(x => /^n:.*2026-10-01/.test(x)), '列出手机里的备份', a);
  await p.click('#sheet [data-act=bakUse][data-k="echo-save-20261001.json"]'); await W(200);
  check(/Restored/.test(await sheet()) && /会先另存一份/.test(await sheet()), '确认页：备份是谁的、现在的进度会先另存一份');
  await p.click('#sheet [data-act=bakGo]');
  await p.waitForFunction(() => window.EchoGame && window.EchoGame.S.player.name === 'Restored', null, { timeout: 8000 }).catch(() => {});
  await W(800);
  a = await E(() => ({ name: window.EchoGame.S.player.name, xp: window.EchoGame.S.xp, pre: JSON.parse(localStorage.getItem('echo-island-v1-pre') || '{}').player, restore: window.EchoGame.dayLog().restore }));
  check(a.name === 'Restored' && a.xp === 2468 && a.pre && a.pre.name === 'Export' && a.restore === 1, '恢复好了：重新打开就是备份的进度，原来的进度另存着，周报记一笔', a);

  // ---------- 9. 新版本：version.json 的 code 比装着的大 → 首页提示「请家长更新」----------
  await load(BASE());
  await E(() => window.EchoGame.A.verCheck()); await W(300);
  a = await E(() => ({ upd: window.EchoGame.S.upd, bars: document.querySelector('#home-bars').textContent }));
  check(verHits >= 1 && a.upd.code === 400 && /有新版本（20261010-abc1234），请家长更新/.test(a.bars), '有新版本：首页「有新版本，请家长更新」', a);
  await p.click('#home-bars .upd-bar'); await W(200);
  a = await sheet();
  check(/20261007-fake000（321）/.test(a) && /20261010-abc1234（400）/.test(a) && /新的冒险/.test(a) && /example\.com/.test(a), '点开：现在的版本、新版本、更新了什么、下载地址', a);
  await p.screenshot({ path: out + '/apk-update.png' });
  await p.click('#sheet [data-act=updShare]'); await W(100);
  check(await E(() => window.__fakeNative.shared.some(s => /example\.com/.test(s.text))), '把下载地址分享给家长（shareText）');
  ver = { code: 300, name: 'old' };
  await closeAll();
  await E(() => window.EchoGame.A.verCheck()); await W(300);
  check(!(await E(() => !!document.querySelector('#home-bars .upd-bar'))), 'version.json 的版本比装着的旧：不提示');

  // ---------- 10. 出错记录：没接住的错误存起来，周报诊断一行 ----------
  await E(() => { window.EchoErr.clear(); setTimeout(() => { throw new Error('boom-test 1'); }, 0); Promise.reject(new Error('boom-test 2')); });
  await W(1900);
  a = await E(() => ({ list: window.EchoErr.list().map(x => x.k + ':' + x.m), ls: JSON.parse(localStorage.getItem('echo-errs') || '[]').length }));
  check(a.list.some(x => /^error:.*boom-test 1/.test(x)) && a.list.some(x => /^promise:.*boom-test 2/.test(x)) && a.ls >= 2, '没接住的错误和 Promise 失败都记下来，存进 localStorage', a);
  await E(() => window.EchoGame.reportSheet()); await W(300);
  check(/程序出错 2 条/.test(await p.textContent('#sheet .rp-diag')), '周报诊断一行：程序出错几条', await p.textContent('#sheet .rp-diag'));
  await closeAll();

  // ---------- 11. 3D 画面丢了：大地图、对战都重建，不留黑屏；精美档最多 2 倍像素 ----------
  await load(BASE({ settings: { tts: 'online', mode: 'self', sfx: false, music: 'off', gfx: 'high', gate: false }, homeTab: 'mon' }));
  await E(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => 3, configurable: true }));   // 假装是 3 倍屏的手机
  await p.click('[data-act=wEnter]');
  check(await until(() => E(() => { const d = window.EchoWorld && EchoWorld._debug(); return !!(d && d.R && d.R.kind === '3d'); }), 40), '大地图：3D 画面');
  for (let i = 0; i < 30 && await E(() => !!EchoWorld._debug().dlg); i++) { await E(() => { const s = document.querySelector('#w-dlg [data-act=wSkip]:not([hidden])') || document.querySelector('#w-dlg [data-act=wPick]'); if (s) s.click(); else { const a = document.querySelector('#world [data-act=wA]'); if (a) a.click(); } }); await W(150); }
  await W(500);
  a = await E(() => { const c = document.querySelector('#w-view canvas.w-canvas'); return { dpr: c ? c.width / c.clientWidth : 0 }; });
  check(a.dpr > 1.9 && a.dpr <= 2.01, '3 倍屏上精美档最多按 2 倍像素画', a);
  // 丢了又恢复。这两次丢都是「切去微信再回来」那一类（先发一个页面切后台 / 回前台的事件）：world.js 的 rebuildGL 不把它算成「这个渲染器不行」，原地重建；
  // 一直在前台、刚建好就丢、连着两次才往下退（新画风 → 经典 3D → 2D，tests/look.test.js 第 10 节）
  await E(() => { document.dispatchEvent(new Event('visibilitychange')); window.__R0 = EchoWorld._debug().R; const gl = document.querySelector('#w-view canvas.w-canvas').getContext('webgl2'); window.__lose = gl.getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
  await W(400);
  check(await E(() => EchoWorld._debug().R.glState() === 'lost'), '画面丢了：先不画（lost）');
  await E(() => window.__lose.restoreContext());
  check(await until(() => E(() => { const R = EchoWorld._debug().R; return R !== window.__R0 && R.kind === '3d' && R.glState() === 'ok' && R.info().render.calls > 0; }), 40), '恢复了：整个重建，接着画');
  // 丢了一直不恢复：2.5 秒后换一张新画布
  await E(() => { document.dispatchEvent(new Event('visibilitychange')); window.__R1 = EchoWorld._debug().R; document.querySelector('#w-view canvas.w-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(); });
  check(await until(() => E(() => { const R = EchoWorld._debug().R; return R !== window.__R1 && R.glState && R.glState() === 'ok' && R.info().render.calls > 0; }), 50, 150), '一直不恢复：2.5 秒后换新画布重建');
  a = await E(() => ({ n: window.EchoGame.dayLog().glLost, errs: window.EchoErr.list().filter(x => x.k === 'gl').length, canvases: document.querySelectorAll('#w-view canvas.w-canvas').length }));
  check(a.n === 2 && a.errs >= 2 && a.canvases === 1, '记进日志和出错记录；只剩一张画布', a);
  // 对战的 3D 画面丢了：不黑屏，换新的渲染器接着画（战斗不用重来）
  await E(() => { EchoWorld.stop(); MonsterGame.battle('wild', 0, { onEnd() {}, hab: 'grass', foes: [MonsterGame.newMon('twigling', 3)] }); });
  check(await until(() => p.$('#b-arena canvas.b3d'), 40), '3D 对战画面');
  await W(800);
  a = await E(() => { const c = MonsterGame._b3().canvas; return c.width / c.clientWidth; });
  check(a > 1.9 && a <= 2.01, '3D 对战：精美档也最多 2 倍像素', a);
  await E(() => { const B3 = MonsterGame._b3(); window.__c0 = B3.canvas; B3.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(); });
  await W(300);
  check(await E(() => MonsterGame._b3().glInfo().lost), '对战画面丢了：先停');
  check(await until(() => E(() => { const B3 = MonsterGame._b3(); return B3 && !B3.glInfo().lost && B3.canvas !== window.__c0 && B3.canvas.isConnected && !window.__c0.isConnected; }), 40), '2.5 秒没恢复：换新画布接着画（战斗还在）');
  await E(() => { const x = document.querySelector('[data-act=bFlee]'); if (x) x.click(); });
  await p.click('#sheet [data-act=bEnd]').catch(() => {});

  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close();
  srv.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
