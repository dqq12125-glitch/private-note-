// iPhone 口语题的本机识别（2026-11-20，老板：「那个识别，还是太慢了，有时候还不准」）：
// 原生 ios/App/Sources/LocalSpeech.swift（手机自带的语音识别，只在手机上识别）+ talk.js 的 nativeListen。这里用假的原生桥
// （tests/fake-native.js 的 platform 'ios'，S.speech 按时间发 echo-speech 事件、记下 speechFeed 送来的每段声音）走一遍网页这一侧。
// 第二版（2026-11-20 晚）：麦克风归网页（和云端识别同一个 lmOpen），声音一段段 speechFeed 给原生；原生只管识别。
//  1. iPhone 上口语题先用本机识别（没网、云端连不上也行）：边说边出字、对上答案当场结束、不连阿里云、不算 AI 用量、计时记录；
//     网页开了麦克风，原生回 ok 以前录到的先存着、回了一起补发、之后接着送（16 位 PCM）；第一次要弹权限框时等原生问完再开麦克风
//  2. 读错了不给过（识别不知道答案，打分照样按 scoreSpeech）
//  3. 什么时候算说完：字停住 0.4 秒（单词）/ 0.6 秒（句子）、还在出声多等（最多 1.2 秒）、不出声了就结束、真的没说话 5 秒、原生自己停了有字就打分；
//     没拿到字时「请说……」那一行清掉，每种结果 game.js 都有一句提示（只有学的人自己点了停是「停了」）
//  4. 本机开不起来（unavailable / denied / busy）、原生出错、没认出字但有人声：同一次里接着走云端识别（用同一个麦克风、录好的声音一起交过去），孩子不用再点；
//     unavailable / denied 记住；别的原因连着两次也记住；麦克风被拒直接弹「去打开」；云端又用不了时按「没听清」回
//  5. 云端模式不登录、没网也能做口语题（本机）；本机用不了时照旧请他登录、先跳过
//  6. 开口前的小检查、设置页、周报诊断一行写着「本机识别」；家长须知多一句「声音不上传」
//  7. 安卓（没有本机识别）、网页版：和以前一样走云端识别
// 运行：node tests/speech.test.js（大约 1 分钟）。和 apk.test.js 一样起本机小网站（echo.localhost），外面的网址一律挡掉
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const FN = require('./fake-native');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.normalize(path.join(ROOT, u === '/' ? 'index.html' : u));
    if (!f.startsWith(ROOT) || /[\\/](android|server|node_modules|art|cloud)[\\/]/.test(f.slice(ROOT.length))) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, data) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 700) : '')); if (!ok) fails++; return ok; };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());
const MON = { v: 2, box: [{ uid: 'a', sp: 'emberpup', lv: 14, xp: 0 }], team: ['a'], dex: { emberpup: 'caught' }, balls: 5, potions: 3, bag: {}, badges: {} };
const WORLD = { v: 2, started: true, map: 't0', x: 8, y: 22, dir: 'up', flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 } };
// App 里一律开口 + AI 打分（mode auto → speakMode 'sr'）；micCheck 填上，别弹小检查（第 6 段自己打开）
const BASE = o => Object.assign({
  seenIntro: true, micCheck: TODAY, homeTab: 'quiz', player: { gender: 'boy', name: 'Tom' },
  settings: { tts: 'online', mode: 'auto', sfx: false, music: 'off', gfx: '2d', gate: false },
  mon: MON, world: WORLD, rev: { v: 1, items: {} }, book: { at: 0, mix: 0.6, view: 'book', vb: '' },
}, o || {});
// iPhone 的本机识别「能用」时 speechState 回的
const ON = { auth: 'authorized', mic: 'granted', onDevice: true, available: true, locale: 'en-US', engine: 'SFSpeechRecognizer' };

// 页面一开始：测试的开关（localStorage['__fakeOpts']，跨刷新保留）并进假原生桥；window.ECHO_IOS（真 App 里 echo-native.js 设的）——'__noios' 时不设
function applyFake() {
  const F = window.__fakeNative; if (!F) return;
  let o = {}; try { o = JSON.parse(localStorage.getItem('__fakeOpts') || '{}'); } catch (e) { o = {}; }
  const sp = o.speech; delete o.speech;
  Object.assign(F, o);
  if (sp && F.speech) Object.assign(F.speech, sp);
  if (!localStorage.getItem('__noios')) window.ECHO_IOS = 1;
  // 边说边出来的字：记下 #heard 每一次变成什么（看「边说边出字」）
  window.__heard = [];
  new MutationObserver(() => { const h = document.getElementById('heard'); const t = h ? h.textContent : ''; if (t && window.__heard[window.__heard.length - 1] !== t) window.__heard.push(t); })
    .observe(document, { subtree: true, childList: true, characterData: true });
}
// 假麦克风（本机、云端识别都用网页的麦克风）：一直有 320Hz 的声音；window.__micLevel(0) 变成没声音（「真的没说话」）
function fakeMic() {
  const md = navigator.mediaDevices; if (!md) return;
  const gains = [];
  let level = 0.3;
  window.__micLevel = v => { level = v; gains.forEach(g => { g.gain.value = v; }); };
  md.getUserMedia = async () => {
    window.__micAt = window.__micAt || [];
    window.__micAt.push(Date.now());
    if (localStorage.getItem('__mic') === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = level; osc.connect(g); g.connect(dest); osc.start();
    gains.push(g);
    window.__micOpens = (window.__micOpens || 0) + 1;
    return dest.stream;
  };
}
// 假的阿里云实时识别（云端那条路，APK 直连：net 'ok' 时 wsOpen 交给它）：收到第一段声音就回 localStorage['__cloudSay'] 那句
function fakeCloud() {
  const F = window.__fakeNative; if (!F) return;
  F.cloudOpens = 0;
  const said = {};
  F.onWsOpen = (id, url, cb) => {
    if (!/qwen3-asr-flash-realtime/.test(url)) { cb(id, 'error', 'HTTP 500 test'); return; }
    F.cloudOpens++;
    setTimeout(() => cb(id, 'open', ''), 20);
  };
  F.onWsSend = (id, text, cb) => {
    let m = null; try { m = JSON.parse(text); } catch (e) { return; }
    if (m.type !== 'input_audio_buffer.append' || said[id]) return;
    said[id] = 1;
    const t = localStorage.getItem('__cloudSay') || 'hello';
    setTimeout(() => {
      cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.text', text: t, stash: '' }));
      cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: t }));
    }, 120);
    // 句子中间停了一下又接着说：第一段认完以后过 __cloudSay2Ms 毫秒，服务器说「又开始说话了」，再认出 __cloudSay2
    const t2 = localStorage.getItem('__cloudSay2'), ms2 = +localStorage.getItem('__cloudSay2Ms') || 0;
    if (t2) setTimeout(() => {
      cb(id, 'message', JSON.stringify({ type: 'input_audio_buffer.speech_started' }));
      setTimeout(() => {
        cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.text', text: t2, stash: '' }));
        cb(id, 'message', JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: t2 }));
      }, 150);
    }, 120 + ms2);
  };
}

(async () => {
  const srv = await serve();
  const PAGE = 'http://echo.localhost:' + srv.address().port + '/index.html';
  const b = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] },
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  let cloudHits = 0;
  async function newPage(native) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    // 外面的网址一律挡掉；云端模式的服务器（假地址）数一下有没有人去连
    await ctx.route(u => !/^http:\/\/echo\.localhost:/.test(u.href), r => { if (/cloud\.example\.com/.test(r.request().url())) cloudHits++; return r.abort(); });
    const p = await ctx.newPage();
    p.setDefaultTimeout(6000);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    if (native) await p.addInitScript(FN.install, native);
    await p.addInitScript(applyFake);
    await p.addInitScript(fakeMic);
    await p.addInitScript(fakeCloud);
    return { ctx, p, errs };
  }
  let { ctx, p, errs } = await newPage({ platform: 'ios', edition: 'family', key: 'sk-fake', net: 'offline', mic: 'granted', pin: '1234' });
  const W = ms => p.waitForTimeout(ms);
  const E = (f, a) => p.evaluate(f, a);
  const until = async (fn, max = 60, gap = 100) => { for (let i = 0; i < max; i++) { if (await fn()) return true; await W(gap); } return false; };
  // 换开关（跨刷新保留）
  const fake = o => E(o => {
    const F = window.__fakeNative, k = JSON.parse(localStorage.getItem('__fakeOpts') || '{}');
    if (o.speech) { Object.assign(F.speech, o.speech); k.speech = Object.assign(k.speech || {}, o.speech); }
    Object.keys(o).filter(x => x !== 'speech').forEach(x => { F[x] = o[x]; k[x] = o[x]; });
    localStorage.setItem('__fakeOpts', JSON.stringify(k));
  }, o);
  const load = async (s, opts) => {
    opts = opts || {};
    await E(([s, o]) => {
      Object.keys(localStorage).filter(k => /^echo-|^__/.test(k)).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('__fakeOpts', JSON.stringify(o.fake || {}));
      Object.entries(o.ls || {}).forEach(([k, v]) => localStorage.setItem(k, v));
      if (s !== null) localStorage.setItem('echo-island-v1', JSON.stringify(s));
    }, [s, opts]);
    await p.reload();
    await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden);
    await W(300);
  };
  const L = () => E(() => window.EchoGame.dayLog());
  const calls = () => E(() => window.__fakeNative.calls.slice());
  const last = () => E(() => window.EchoTalk.lastSpeech());
  // 开一道跟读题（第一个课本单元的第 i 句），返回答案
  const question = async i => { await E(i => { window.EchoGame.closeModal(); window.EchoGame.playQs([['sr_s', 13, i]]); window.__heard = []; }, i || 0); await W(700); return E(() => window.EchoGame.P().q.target); };
  const words = s => s.replace(/[^A-Za-z' ]/g, ' ').split(/\s+/).filter(Boolean);

  await p.goto(PAGE);

  // ---------- 1. 本机识别：边说边出字、对上答案当场结束、不连阿里云 ----------
  // 原生建识别任务用 0.6 秒（startMs，比开麦克风慢）：这段时间网页的麦克风已经在录，录到的要先存着、回 ok 时一起补发
  await load(BASE(), { fake: { speech: { state: ON, start: 'ok', startMs: 600, script: [] } } });
  check(await E(() => window.ECHO_IOS === 1 && window.EchoTalk.localSR() && window.EchoTalk.speechState().onDevice === true),
    'iPhone + 本机识别能用：EchoTalk.localSR() 是 true（开机时问过一次 speechState，不弹框）', await E(() => window.EchoTalk.speechState()));
  let target = await question(0);
  let w = words(target);
  check(w.length >= 3, '跟读题的答案是一句话：' + target);
  const half = w.slice(0, Math.ceil(w.length / 2)).join(' ');
  await fake({ speech: { script: [[60, 'voice', 1], [150, 'partial', w[0]], [300, 'partial', half], [500, 'partial', target]] } });
  const asr0 = (await L()).asrN || 0;
  const tTap = Date.now();
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 40, 50), '说对了：过了');
  const tDone = Date.now() - tTap;
  let a = await E(() => ({ heard: window.__heard.slice(), fb: (document.querySelector('#fb-t') || {}).textContent || '' }));
  check(a.heard.includes(w[0]) && a.heard.includes(half), '边说边出字：话筒下面先后出现「' + w[0] + '」「' + half + '」', a.heard);
  let s = await last();
  check(s && s.eng === 'device' && s.how === 'match' && s.ok && s.lag != null && s.lag < 250 && s.listen != null && s.first != null && s.end != null,
    '对上答案当场结束（没等 0.6 秒的停顿）：EchoTalk.lastSpeech() 记着用的本机、点了到开始听 / 第一个字 / 结束 / 说完以后等了多久', s);
  check(tDone < 1900, '点话筒到出分不到 1.9 秒（假的原生开好 0.6 秒 + 说话 0.5 秒）：' + tDone + ' 毫秒');
  let c = await calls();
  check(c.includes('speechStart') && !c.includes('wsOpen') && !c.includes('post'), '用的是原生的本机识别：没连阿里云（wsOpen / post 都没调），云端连不上也不要紧', c.filter(x => /speech|ws|post/.test(x)));
  let l = await L();
  check((l.asrN || 0) === asr0 && l.srDev === 1 && !l.srCloud, '本机识别不算 AI 用量（asrN 没变），周报的计数记了本机 1 次', l);
  // 麦克风归网页：开了一次麦克风，声音一段段送给原生（回 ok 以前录到的先存着、回了一起补发、之后接着送）
  a = await E(() => { const F = window.__fakeNative.speech; return { feeds: F.feeds.slice(), early: F.early, okAt: Object.assign({}, F.okAt), mics: window.__micOpens || 0, opts: F.log.filter(x => x.m === 'speechStart').map(x => x.opts) }; });
  const sid1 = Object.keys(a.okAt).map(Number)[0], f1 = a.feeds.filter(f => f.sid === sid1), ok1 = a.okAt[sid1];
  check(a.mics === 1, '网页开了一次麦克风（和云端识别同一个 lmOpen），不是原生自己录', a.mics);
  check(a.early === 0 && f1.length >= 3 && f1.every(f => f.at >= ok1), '原生回 ok 以前一段都没送（先存着），回 ok 以后才送：' + f1.length + ' 段', { early: a.early, n: f1.length });
  check(f1.filter(f => f.at - ok1 < 40).length >= 1 && f1.some(f => f.at - ok1 >= 150), '回 ok 那一下把存着的补发了，之后接着一段段送', f1.map(f => f.at - ok1));
  check(f1.every(f => f.bytes >= 3000 && f.bytes % 2 === 0) && f1.some(f => Math.abs(f.s0) > 50), '每段约 0.1 秒的 16kHz 16 位 PCM（3000 多字节、偶数），有声音', f1.slice(0, 3));
  check(a.opts.every(x => x.rate === 16000 && x.locale === 'en-US'), 'speechStart 告诉原生送来的声音是 16kHz', a.opts);
  check(s.fed === f1.length && s.vo && s.vo !== '-' && s.off === '' && s.mic != null && s.nok != null, 'lastSpeech() 记着送了几段（fed）、有没有人声、开麦克风 / 原生开好用了多久（版本角标显示这些）', s);
  await p.screenshot({ path: out + '/speech-native-pass.png' });
  // 第一次要弹「语音识别」的权限框（还没问过）：等原生问完（回 ok）再开麦克风，两个系统框不一起弹
  await load(BASE(), { fake: { speech: { state: Object.assign({}, ON, { auth: 'notDetermined' }), start: 'ok', startMs: 250, script: [] } } });
  target = await question(0);
  await fake({ speech: { script: [[1500, 'partial', target]] } });
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 50), '第一次（要弹权限框）：照样说对就过');
  a = await E(() => { const F = window.__fakeNative.speech; return { okAt: Object.values(F.okAt)[0], micAt: (window.__micAt || [])[0], fed: F.feeds.length }; });
  check(a.micAt >= a.okAt && a.fed >= 1, '第一次：原生问完权限、回了 ok 才开麦克风', a);

  // ---------- 1b. 麦克风开着却一点声音都不送（2026-11-22 老板的截图：对战里等了 5 秒「没听清」，角标 fed0 v:-） ----------
  // 预热着的麦克风（说完留 15 秒）在 iPhone 上放过别的声音以后会这样：开口前查一下，不出声就重开
  await load(BASE(), { fake: { speech: { state: ON, start: 'ok', startMs: 100, script: [] } } });
  target = await question(0);
  await fake({ speech: { script: [[300, 'partial', target]] } });
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 40, 50), '1b 第一题照常说对（麦克风预热着）');
  target = await question(1);
  await fake({ speech: { script: [[400, 'partial', target]] } });
  let m0 = await E(() => window.__micOpens || 0);
  await E(() => window.EchoTalk._micMute()); await W(500);   // 不出声有一会儿了（刚断的 0.3 秒内还算在出声，听的时候的看门狗管）
  let t1 = Date.now();
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 60, 50), '1b 预热的麦克风不出声了：开口前发现、重开，照样说对就过');
  s = await last();
  check((await E(() => window.__micOpens)) === m0 + 1 && s.stale >= 1 && !s.remic && s.fed > 0 && Date.now() - t1 < 2500, '1b 重开了一次麦克风（stale 记着），声音照常送给原生，没白等 5 秒：' + (Date.now() - t1) + ' 毫秒', s);
  // 听到一半麦克风断了声音：1 秒没有新的声音就重开一次，接着听
  target = await question(2);
  await fake({ speech: { script: [[2600, 'partial', target]] } });
  m0 = await E(() => window.__micOpens || 0);
  await p.click('#mic'); await W(350);
  await E(() => window.EchoTalk._micMute());
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 50), '1b 听到一半麦克风不出声：重开以后接着听，说对就过');
  s = await last();
  check((await E(() => window.__micOpens)) === m0 + 1 && s.remic === 1, '1b 听的时候重开了一次（remic 1，角标显示 re1）', s);
  // 重开了还是不出声：1.5 秒后按「没听清」回（不等 5 秒、不卡住）
  target = await question(3);
  await fake({ speech: { script: [] } });
  t1 = Date.now();
  await p.click('#mic'); await W(350);
  await E(() => { window.__muteIv = setInterval(() => window.EchoTalk._micMute(), 15); });   // 之后不管重开几次都不出声
  check(await until(() => E(() => { const s = window.EchoTalk.lastSpeech(); return s && s.how === 'nodata'; }), 100, 50), '1b 重开了还是一点声音都没有：按没听清结束');
  const tNo = Date.now() - t1;
  await W(200);
  a = await E(() => ({ hint: document.querySelector('#mic-hint').textContent, miss: window.EchoGame.P().miss, answered: window.EchoGame.P().answered }));
  check(tNo < 4000 && /没听清/.test(a.hint) && a.miss === 1 && !a.answered, '1b 点话筒后不到 4 秒就提示「没听清」、算一次尝试（以前一点声音都没有时要等 5 秒以上）：' + tNo + ' 毫秒', a);
  await E(() => clearInterval(window.__muteIv));

  // ---------- 2. 读错了不给过 ----------
  target = await question(1); w = words(target);
  const wrong = 'my dog is very big and brown today';
  await fake({ speech: { script: [[100, 'partial', 'my dog'], [250, 'partial', wrong]] } });
  await p.click('#mic');
  await until(() => E(() => { const s = window.EchoTalk.lastSpeech(); return s && s.how === 'done'; }), 40, 50);
  await W(300);
  a = await E(() => ({ P: { answered: window.EchoGame.P().answered, tries: window.EchoGame.P().tries }, hint: document.querySelector('#mic-hint').textContent, score: (document.querySelector('#score') || {}).textContent || '' }));
  s = await last();
  check(!a.P.answered && a.P.tries === 1 && s.eng === 'device' && s.how === 'done', '读错了（「' + wrong + '」对「' + target + '」）：不给过，算一次尝试，红字提示再说', { a, s });
  check(s.lag >= 550 && s.lag < 900, '句子：字停住 0.6 秒才算说完（' + s.lag + ' 毫秒）', s);
  c = await E(() => window.__fakeNative.speech.log.filter(x => x.m === 'speechStart').map(x => x.opts));
  check(c.every(o => !('target' in o) && !('answer' in o) && !('hints' in o) && !JSON.stringify(o).includes(words(target)[1])), '交给原生的只有 short / long / locale：答案不交给识别（诚实打分）', c);
  // 这句话有几个词只管「等多久算说完」：题目更长、只听到 2 个词 → 多等，不是 0.6 秒就交卷；几个词也不交给原生
  await W(400);
  await fake({ speech: { script: [[50, 'voice', 1], [100, 'partial', 'my dog'], [300, 'voice', 0]] } });
  await p.click('#mic');
  await until(() => E(() => { const s = window.EchoTalk.lastSpeech(); return s && s.how === 'done' && s.lack; }), 80, 50);
  s = await last();
  check(w.length < 4 || (s.lack === 2000 && s.lag >= 2150 && s.lag < 2800), '题目（' + w.length + ' 个词）只听到 2 个词：多等到不出声满 2 秒（' + s.lag + ' 毫秒，角标 w' + s.lack + '）', s);
  c = await E(() => window.__fakeNative.speech.log.filter(x => x.m === 'speechStart').map(x => x.opts));
  check(c.every(o => !('units' in o) && !('target' in o)), '这句话有几个词也不交给原生', c);
  await W(300);

  // ---------- 3. 说完的计时：单词 0.4 秒、句子 0.6 秒、还在出声多等、一直没说话、被打断 ----------
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.goHome(); });
  const listen = (script, o) => E(async ([script, o]) => {
    Object.assign(window.__fakeNative.speech, { script });
    const t0 = performance.now(), states = [];
    if (o.match === 1) o = Object.assign({}, o, { match: t => /Pablo/.test(t) });   // match: 1 = 听到 Pablo 就算对上
    const r = await window.EchoTalk.listenOnce(Object.assign({ match: () => false, onState: t => states.push(t) }, o));
    const A = window.EchoGame.A;
    return { r, ms: Math.round(performance.now() - t0), s: window.EchoTalk.lastSpeech(), last: states[states.length - 1], hint: A.hint({ fail: A.failOf(r), why: r.why }) };
  }, [script, o || {}]);
  let x = await listen([[100, 'partial', 'apple']], { short: true });
  check(x.r.text === 'apple' && x.r.eng === 'device' && x.s.lag >= 380 && x.s.lag < 650, '单词：字停住 0.4 秒就结束（' + x.s.lag + ' 毫秒）', x);
  x = await listen([[100, 'partial', 'I like it']], {});
  check(x.r.text === 'I like it' && x.s.lag >= 580 && x.s.lag < 850, '句子：字停住 0.6 秒才结束（' + x.s.lag + ' 毫秒）', x);
  x = await listen([[50, 'voice', 1], [100, 'partial', 'I like it'], [300, 'voice', 0]], {});
  check(x.s.lag >= 580 && x.s.lag < 850, '原生说「不出声了」：照 0.6 秒结束（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[50, 'voice', 1], [100, 'partial', 'I like']], {});
  check(x.s.lag >= 1700 && x.s.lag < 2200, '原生说「还在出声」（慢慢说、句子中间停一下）：多等，最多再等 1.2 秒（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[100, 'partial', 'I like'], [350, 'partial', 'I like apples']], {});
  check(x.r.text === 'I like apples' && x.s.lag >= 580, '字还在变：从最后一次变了开始算', x);
  x = await listen([[50, 'voice', 1], [100, 'partial', 'I like'], [200, 'partial', 'I like to'], [900, 'partial', 'apples'], [950, 'voice', 0]], {});
  check(x.r.text === 'I like to apples', '停顿以后手机的识别从头另起一段（「apples」）：前面那段留着、拼在一起', x.r);
  x = await listen([[100, 'partial', 'I lie'], [500, 'partial', 'I like']], {});
  check(x.r.text === 'I like', '平常的改字（第一个词没变）：不当成另起一段', x.r);
  // 说到一半停下来想词（2026-11-24 老板在西语「说出回答」里：6 个词的句子听到 4 个、停了不到 1 秒就交卷了）。units = 这句话大约几个词
  const HALF = 'Sí, soy ánimo, me', WHOLE = 'Sí, soy ánimo, me llamo Pablo';
  x = await listen([[50, 'voice', 1], [100, 'partial', 'Sí, soy'], [400, 'partial', HALF], [500, 'voice', 0], [1500, 'voice', 1], [2100, 'partial', WHOLE], [2300, 'voice', 0]], { units: 6 });
  check(x.r.text === WHOLE && x.s.how === 'done' && x.s.lack === 2000, '听到 4 个词（这句话 6 个）、停了 1 秒又接着说：没掐断，后半句也听到了', x);
  check(x.s.lag >= 580 && x.s.lag < 900, '说够数了：照原来的 0.6 秒结束（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[50, 'voice', 1], [100, 'partial', HALF], [300, 'voice', 0]], { units: 6 });
  check(x.r.text === HALF && x.s.how === 'done' && x.s.lag >= 2150 && x.s.lag < 2700 && x.s.lack === 2000, '听到的差得多、后面真的不说了：不出声满 2 秒才结束（' + x.s.lag + ' 毫秒）', x);
  x = await listen([[50, 'voice', 1], [100, 'partial', 'Sí, soy ánimo, me llamo'], [300, 'voice', 0]], { units: 6 });
  check(x.s.lag >= 1450 && x.s.lag < 1950 && x.s.lack === 1300, '只差一个词（6 个里听到 5 个）：等 1.3 秒（' + x.s.lag + ' 毫秒）', x.s);
  // 手机出字比声音晚：接着说了（原生说出声了）、字还没出来，这时又停一下——字是停了很久了，可人刚停，不能算说完
  x = await listen([[50, 'voice', 1], [100, 'partial', HALF], [300, 'voice', 0], [1200, 'voice', 1], [2300, 'voice', 0], [2900, 'partial', WHOLE]], { units: 6 });
  check(x.r.text === WHOLE, '接着说的那几个字晚到（字停了 2 秒多、人才刚停）：等到了', x);
  x = await listen([[100, 'partial', HALF]], { units: 6 });
  check(x.r.text === HALF && x.s.lag >= 1950 && x.s.lag < 2500, '原生没说过出不出声：按字停住的时间算，2 秒（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[50, 'voice', 1], [100, 'partial', 'I like it'], [300, 'voice', 0]], { units: 3 });
  check(x.s.lag >= 580 && x.s.lag < 850 && !x.s.lack, '听到的词够数（说错了也一样）：还是 0.6 秒，不多等（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[100, 'partial', 'apple']], { short: true, units: 1 });
  check(x.s.lag >= 380 && x.s.lag < 650, '单词：还是 0.4 秒（' + x.s.lag + ' 毫秒）', x.s);
  x = await listen([[50, 'voice', 1], [100, 'partial', HALF], [300, 'voice', 0], [700, 'partial', WHOLE]], { units: 6, match: 1 });
  check(x.r.text === WHOLE && x.s.how === 'match', '多等的时候说对了：照样当场结束', x.s);
  x = await listen([[100, 'partial', 'I like'], [250, 'end', 'background']], {});
  check(x.r.text === 'I like' && x.s.how === 'end-background', '原生自己停了（切后台）：已经听到的字照样打分，不会停在「请说……」', x);
  x = await listen([[100, 'partial', 'Hello'], [200, 'final', 'Hello there']], {});
  check(x.r.text === 'Hello there' && x.s.how === 'final', '原生给了最终结果：用它', x);
  await E(() => window.__micLevel(0));
  x = await listen([], { short: true });
  check(x.r.err === 'no-speech' && x.s.how === 'silence' && x.s.vo === '-' && !x.s.fell && x.ms >= 4900 && x.ms < 6500, '真的没说话（网页没量到人声、原生也没说出声）：5 秒结束，算「没听清」，不改走云端', { r: x.r, s: x.s, ms: x.ms });
  check(x.last === '' && x.hint && x.hint.length > 3, '没拿到字：「请说……」那一行清掉了，有一句提示：' + x.hint, x);
  await E(() => window.__micLevel(0.3));
  // 学的人自己点了停：只有这一种是 aborted（game.js 写「停了」，也不留「正在听」）
  x = await E(async () => {
    Object.assign(window.__fakeNative.speech, { script: [] });
    const states = [], pr = window.EchoTalk.listenOnce({ match: () => false, onState: t => states.push(t) });
    await new Promise(r => setTimeout(r, 400)); window.EchoTalk.stopListen();
    const A = window.EchoGame.A, r = await pr;
    return { r, last: states[states.length - 1], hint: A.hint({ fail: A.failOf(r) }), s: window.EchoTalk.lastSpeech() };
  });
  check(x.r.err === 'aborted' && x.s.how === 'user' && x.last === '' && /停/.test(x.hint), '自己点了停：aborted，那一行清掉，提示「' + x.hint + '」', x);
  // listenOnce 没拿到字时可能回的每一种：game.js 都有一句提示（对战、大地图、闯关、能力检测都按这个写）
  x = await E(() => ['no-speech', 'aborted', 'nokey', 'not-allowed', 'audio-capture', 'network'].map(err => ({ err, f: window.EchoGame.A.failOf({ text: '', err, why: err === 'network' ? 'offline' : '' }), h: window.EchoGame.A.hint({ fail: window.EchoGame.A.failOf({ text: '', err, why: err === 'network' ? 'offline' : '' }) }) })));
  check(x.every(o => o.h && o.h.length > 3), '没拿到字的每一种结果都有提示（不会只剩「正在听……」）', x);
  c = await E(() => window.__fakeNative.speech.log.filter(x => x.m === 'speechStart').length - window.__fakeNative.speech.log.filter(x => x.m === 'speechStop').length);
  check(c <= 0, '每次结束都叫原生停下（speechStop）', c);
  check(await E(() => window.EchoTalk.speechLog().length >= 8 && window.EchoTalk.speechLog().every(r => r.eng === 'device')), '最近几次的计时都留着（EchoTalk.speechLog()，只在内存里）');

  // ---------- 4. 本机开不起来：同一次里改走云端，不用再点 ----------
  for (const why of ['unavailable', 'denied', 'busy']) {
    await load(BASE(), { fake: { net: 'ok', speech: { state: ON, start: 'fail:' + why, script: [] } } });
    target = await question(0);
    await E(t => localStorage.setItem('__cloudSay', t), target);
    await p.click('#mic');
    const ok = await until(() => E(() => window.EchoGame.P().answered), 80, 100);
    s = await last(); c = await calls();
    check(ok && s.eng === 'cloud' && s.fell === why && c.includes('speechStart') && c.includes('wsOpen'), why + '：只点了一次话筒，本机开不起来就接着走云端识别，过了', { ok, s, c: c.filter(x => /speech|ws/.test(x)) });
    check(await E(() => window.__micOpens || 0) === 1, why + '：云端接着用本机那次开的麦克风（只开了一次）');
    const ls = await E(() => window.EchoTalk.localSR());
    check(why === 'busy' ? ls === true : ls === false, why + (why === 'busy' ? '：一次开不起来不记住（下一题还先试本机）' : '：记住了，这次打开 App 不再每题先试本机'), ls);
    if (why === 'unavailable') {
      await question(1);
      await E(() => { window.__fakeNative.calls.length = 0; });
      await E(t => localStorage.setItem('__cloudSay', t), await E(() => window.EchoGame.P().q.target));
      await p.click('#mic');
      await until(() => E(() => window.EchoGame.P().answered), 80, 100);
      c = await calls();
      check(!c.includes('speechStart') && c.includes('wsOpen'), '下一题直接走云端（不再先试本机）', c.filter(x => /speech|ws/.test(x)));
      // 回到前台再问一次：手机能用了就又用本机
      await fake({ speech: { state: ON } });
      await E(() => window.EchoTalk.speechRefresh());
      check(await E(() => window.EchoTalk.localSR()), '回到前台问一次 speechState：能用了就又用本机');
    }
  }
  // 原生开好了，但这一次没认出字（有人声）/ 原生出错 / 原生自己停了：同一次里接着走云端（同一个麦克风，录好的声音一起交过去）；连着两次以后这次打开 App 不再试本机
  await load(BASE(), { fake: { net: 'ok', speech: { state: ON, start: 'ok', script: [] } } });
  const cases = [
    ['error', [[50, 'voice', 1], [900, 'error', 'kAFAssistantErrorDomain 1101']], 'error'],   // 900 毫秒：机器忙时麦克风的第一段声音要过几百毫秒才出来，太早出错就一段都还没送
    ['notext', [[50, 'voice', 1], [300, 'voice', 0]], 'notext'],
  ];
  for (const [name, script, fell] of cases) {
    target = await question(0);
    await E(t => localStorage.setItem('__cloudSay', t), target);
    await fake({ speech: { script } });
    await E(() => { window.__fakeNative.calls.length = 0; });
    await p.click('#mic');
    const ok = await until(() => E(() => window.EchoGame.P().answered), 100, 100);
    s = await last(); c = await calls();
    check(ok && s.eng === 'cloud' && s.fell === fell && s.fed > 0 && c.includes('speechStart') && c.includes('wsOpen'),
      name + '：本机没认出字（有人声）→ 同一次里接着走云端，过了；记着 fell:' + fell + (s.nerr ? '、' + s.nerr : ''), { ok, s, c: c.filter(x => /speech|ws/.test(x)) });
    check(await E(() => window.__micOpens || 0) === 1, name + '：云端接着用同一个麦克风（没重开）');
  }
  check(s.nerr === undefined && (await E(() => window.EchoTalk.speechLog().slice(-2)[0].nerr)) === 'kAFAssistantErrorDomain 1101', '原生的错误代号记在计时里（版本角标显示）');
  check(await E(() => !window.EchoTalk.localSR() && window.EchoTalk.speechState().off === 'fails'), '连着两次本机没认出来：这次打开 App 不再试本机（off = fails）', await E(() => window.EchoTalk.speechState()));
  await E(() => window.EchoTalk.speechRefresh());
  check(await E(() => !window.EchoTalk.localSR()), '回到前台问一次 speechState：连着失败的照样记着（不像「没给权限」那样一打开就恢复）');
  target = await question(1);
  await E(t => localStorage.setItem('__cloudSay', t), target);
  await E(() => { window.__fakeNative.calls.length = 0; });
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 100) && !(await calls()).includes('speechStart'), '第三题直接走云端（不再先试本机）');
  // 本机这一次没认出字、云端又用不了（没有密钥）：按「没听清」回，有提示、算一次尝试，不停在「请说……」
  await load(BASE(), { fake: { key: '', speech: { state: ON, start: 'ok', script: [[100, 'voice', 1], [250, 'end', 'final']] } } });
  await question(0);
  await p.click('#mic');
  check(await until(() => E(() => !!window.EchoTalk.lastSpeech() && /没听清/.test(document.querySelector('#mic-hint').textContent)), 40), '本机没认出字、云端没有密钥：提示「没听清」', await p.textContent('#mic-hint'));
  a = await E(() => ({ heard: document.querySelector('#heard').textContent, miss: window.EchoGame.P().miss, s: window.EchoTalk.lastSpeech(), ls: window.EchoTalk.localSR() }));
  check(!/请说/.test(a.heard) && a.miss === 1 && a.s.fell === 'end-final' && a.s.err === 'no-speech' && a.ls, '「请说……」那一行清掉了、算一次没听清；本机下一题还先试（只失败了一次）', a);
  // 麦克风被拒（网页的 getUserMedia）：云端也要麦克风，直接弹「去打开」
  await load(BASE(), { fake: { net: 'ok', mic: 'blocked', speech: { state: ON, start: 'ok', script: [] } }, ls: { __mic: 'deny' } });
  await question(0);
  await p.click('#mic');
  check(await until(() => E(() => !document.querySelector('#modal').hidden && /麦克风/.test(document.querySelector('#sheet').textContent)), 40), '麦克风被拒：弹「为什么要用麦克风 / 去打开」（不白白再去连云端）');
  await W(300);   // 原生那一次可能比麦克风被拒晚回 ok：回了也要叫停
  c = await calls();
  a = await E(() => ({ fed: window.__fakeNative.speech.feeds.length, active: window.__fakeNative.speech.active }));
  check(!c.includes('wsOpen') && c.includes('speechStop') && a.fed === 0 && !a.active, '麦克风被拒时没去连云端、原生那一次也叫停了', { c: c.filter(x => /speech|ws/.test(x)), a });
  // 本机开不起来、云端又没有密钥：和以前没有 AI 时一样（先跳过）
  await load(BASE(), { fake: { key: '', speech: { state: ON, start: 'fail:unavailable', script: [] } } });
  await question(0);
  await p.click('#mic');
  check(await until(() => E(() => !document.querySelector('#p-skip').hidden), 40), '本机开不起来、也没有 AI 密钥：出现「先跳过」（和以前没有 AI 时一样）');
  s = await last();
  check(s && s.fell === 'unavailable' && s.err === 'nokey', '记着：本机 unavailable、云端没有密钥', s);

  // ---------- 5. 云端模式：不登录、没网也能做口语题（本机）；本机用不了照旧请他登录 ----------
  await load(BASE(), { ls: { 'echo-cloud-url': 'https://cloud.example.com' }, fake: { speech: { state: ON, start: 'ok', script: [] } } });
  check(await E(() => window.EchoCloud.on && !window.EchoAccount.signed() && window.EchoTalk.localSR() && !window.EchoGame.A.down()), '云端模式、没登录、本机识别能用：口语题不算「AI 用不了」');
  target = await question(0);
  await fake({ speech: { script: [[100, 'partial', target]] } });
  const hits0 = cloudHits;
  await ctx.setOffline(true);
  await W(200);
  check(await E(() => navigator.onLine === false), '（断网了）');
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 40, 50), '云端模式、没登录、没网：口语题照样能说、能过');
  a = await E(() => ({ modal: !document.querySelector('#modal').hidden, sheet: (document.querySelector('#sheet') || {}).textContent || '', L: window.EchoGame.dayLog() }));
  check(!a.modal && cloudHits === hits0 && !a.L.aiNoKey, '没弹「登录」、没去连服务器、不算「没有 AI」', { a: a.modal, sheet: a.sheet.slice(0, 80), hits: cloudHits - hits0 });
  // 复习里没网也出开口题（本机识别不用网）
  // （每道题开口还是排句子有一半是随机的：多出几次，开口题一次都没有才算错——没网又不能识别时一次都不会有）
  a = await E(today => { const G = window.EchoGame; G.S.rev.items['sent:13:2'] = { k: 'sent', w: 13, i: 2, b: 1, due: today, x: 1, c: today }; let t = []; for (let i = 0; i < 40; i++) t = t.concat(G.rev.build().map(q => q.type)); return t; }, TODAY);
  check(a.some(t => /^sr_/.test(t)), '没网时每日复习照样出开口题（本机识别不用网）', [...new Set(a)]);
  await ctx.setOffline(false);
  await W(200);
  // 本机用不了：照旧请他登录、先跳过
  await fake({ speech: { start: 'fail:unavailable' } });
  await question(1);
  await p.click('#mic');
  check(await until(() => E(() => !document.querySelector('#modal').hidden && !!document.querySelector('#sheet [data-act=ac_send], #sheet #ac-email')), 40), '本机用不了、没登录：照旧弹「登录，每天免费用 AI」');
  check(await E(() => !window.EchoTalk.localSR() && window.EchoGame.A.down()), '之后照旧算「AI 用不了」（先跳过）');
  await p.screenshot({ path: out + '/speech-cloud-signin.png' });

  // ---------- 6. 开口前的小检查、设置页、周报、家长须知 ----------
  await load(BASE(), { fake: { speech: { state: ON, start: 'ok', script: [[100, 'partial', 'Hello']] } } });
  await E(() => window.EchoGame.A.check()); await W(300);
  await p.click('#chk-mic');
  check(await until(() => E(() => /本机识别/.test(document.querySelector('#chk-hint').textContent)), 40), '开口前的小检查：说了 Hello，写着「口语题用本机识别：在这台手机上听写，不用联网」', await p.textContent('#chk-hint'));
  a = await E(() => ({ S: window.EchoGame.S.micCheck, rows: document.querySelector('#chk').textContent }));
  check(!!a.S && /麦克风 ✅/.test(a.rows), '小检查过了（S.micCheck），麦克风一行打勾', a);
  await p.screenshot({ path: out + '/speech-check.png' });
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.A.settings(); }); await W(300);
  check(/口语自动打分：本机识别/.test(await p.textContent('#sheet')), '设置页写着「口语自动打分：本机识别」');
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.reportSheet(); }); await W(300);
  check(/口语识别：本机 1 次、云端 0 次/.test(await p.textContent('#sheet')), '周报诊断一行：口语识别本机几次、云端几次、本机说完约几秒出分', (await p.textContent('#sheet')).slice(-260));
  // 家长须知（聊天页底下「ℹ️」）多一句：iPhone 上口语题在手机上识别、声音不上传
  await E(() => { window.EchoGame.closeModal(); const b = document.createElement('button'); b.dataset.act = 'talk_privacy'; b.id = '__pv'; document.body.appendChild(b); b.click(); }); await W(300);
  check(/在这台手机上/.test(await p.textContent('#sheet')) && /不上传/.test(await p.textContent('#sheet')), '家长须知：iPhone 上的口语题在这台手机上识别，这段声音不上传');
  // 英语界面：设置页那一行是英文
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.S.settings.ui = 'en'; window.EchoGame.A.settings(); }); await W(300);
  const enSet = await p.textContent('#sheet');
  check(/on-device recognition/.test(enSet) && !/本机/.test(enSet), '英语界面：设置页写 on-device recognition', enSet.slice(0, 300));
  await E(() => { const G = window.EchoGame; G.S.settings.ui = 'zh'; G.closeModal(); });

  check(!errs.length, 'iPhone 那几段没有报错', errs.slice(0, 3));
  await ctx.close();

  // ---------- 7. 安卓、网页版：和以前一样 ----------
  ({ ctx, p, errs } = await newPage({ platform: 'android', edition: 'family', key: 'sk-fake', net: 'ok', mic: 'granted', pin: '1234' }));
  await p.goto(PAGE);
  await load(BASE(), { ls: { __noios: '1' }, fake: { net: 'ok' } });
  check(await E(() => !window.ECHO_IOS && typeof window.EchoNative.speechStart === 'undefined' && !window.EchoTalk.localSR()), '安卓（家庭版）：没有本机识别的方法，localSR() 是 false');
  target = await question(0);
  await E(t => localStorage.setItem('__cloudSay', t), target);
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 100), '安卓：口语题照旧走阿里云实时识别，过了');
  c = await calls(); s = await last();
  check(c.includes('wsOpen') && s.eng === 'cloud' && !s.fell && (await L()).asrN === 1 && !(await L()).srDev, '安卓：连了实时识别、算 AI 用量、周报的本机计数没有', { c: c.filter(x => /ws|speech/.test(x)), s });
  // 云端那条路：听的时候麦克风不出声（以前这条路的计时都在收到声音时才跑，会一直等）：1 秒后重开，接着听
  target = await question(1);
  await E(t => localStorage.setItem('__cloudSay', t), target);
  let mc = await E(() => window.__micOpens || 0);
  await E(() => window.EchoTalk._micMute()); await W(500);   // 预热的那个不出声有一会儿了：开口前就该发现
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 100), '安卓 / 云端：预热的麦克风不出声 → 开口前重开，照样过');
  check((await E(() => window.__micOpens)) === mc + 1 && (await last()).stale >= 1, '安卓 / 云端：重开了一次', await last());
  target = await question(2);
  await E(t => localStorage.setItem('__cloudSay', t), target);
  mc = await E(() => window.__micOpens || 0);
  await E(() => { const F = window.__fakeNative, on = F.onWsOpen; F.onWsOpen = (id, url, cb) => { on(id, url, cb); setTimeout(() => window.EchoTalk._micMute(), 30); F.onWsOpen = on; }; });   // 连上的那一下就断声音
  await p.click('#mic');
  check(await until(() => E(() => window.EchoGame.P().answered), 80, 100), '安卓 / 云端：听的时候麦克风不出声 → 1 秒后重开，接着听，过了');
  s = await last();
  check((await E(() => window.__micOpens)) === mc + 1 && s.remic === 1, '安卓 / 云端：听的时候重开了一次（remic 1）', s);
  // 云端那条路也一样：听到的比这句话少，服务器说「这一段完了」以后多等一会儿
  const cloudListen = (say, say2, ms2, o) => E(async ([say, say2, ms2, o]) => {
    window.EchoGame.closeModal();
    localStorage.setItem('__cloudSay', say);
    if (say2) { localStorage.setItem('__cloudSay2', say2); localStorage.setItem('__cloudSay2Ms', String(ms2)); } else localStorage.removeItem('__cloudSay2');
    const t0 = performance.now();
    const r = await window.EchoTalk.listenOnce(Object.assign({ match: () => false }, o));
    localStorage.removeItem('__cloudSay2');
    return { r, ms: Math.round(performance.now() - t0), s: window.EchoTalk.lastSpeech() };
  }, [say, say2 || '', ms2 || 0, o || {}]);
  let y = await cloudListen('Sí, soy ánimo, me', 'llamo Pablo', 1000, { units: 6 });
  check(y.r.text === 'Sí, soy ánimo, me llamo Pablo' && y.s.eng === 'cloud' && y.s.lack === 2000, '安卓 / 云端：听到 4 个词（这句话 6 个）、停 1 秒又接着说：没掐断', y);
  y = await cloudListen('Sí, soy ánimo, me', '', 0, { units: 6 });
  check(y.r.text === 'Sí, soy ánimo, me' && y.s.lag >= 1300 && y.s.lag < 2300, '安卓 / 云端：后面真的不说了，多等 1.4 秒结束（' + y.s.lag + ' 毫秒）', y);
  y = await cloudListen('I like it', '', 0, { units: 3 });
  check(y.r.text === 'I like it' && y.s.lag >= 450 && y.s.lag < 1000 && !y.s.lack, '安卓 / 云端：词够数，还是等 0.5 秒（' + y.s.lag + ' 毫秒）', y);
  y = await cloudListen('I like', 'it', 1000, {});
  check(y.r.text === 'I like', '安卓 / 云端：不知道这句话多长（没给 units）：和以前一样', y);
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.reportSheet(); }); await W(300);
  check(!/口语识别：本机/.test(await p.textContent('#sheet')), '安卓的周报诊断一行和以前一样（没有本机识别那一截）');
  // iPhone 的假桥、但不是 App（没有 ECHO_IOS）：也不用本机识别
  await ctx.close();
  ({ ctx, p, errs } = await newPage({ platform: 'ios', edition: 'family', key: 'sk-fake', net: 'ok', mic: 'granted', pin: '1234', speech: { state: ON, start: 'ok' } }));
  await p.goto(PAGE);
  await load(BASE(), { ls: { __noios: '1' } });
  check(await E(() => !window.ECHO_IOS && !window.EchoTalk.localSR()), '没有 window.ECHO_IOS（不是 iPhone App）：不用本机识别');
  await ctx.close();
  // 网页版（没有原生桥）
  ({ ctx, p, errs } = await newPage(null));
  await p.goto(PAGE);
  await p.waitForFunction(() => window.EchoTalk && window.EchoGame);
  check(await E(() => !window.EchoNative && !window.EchoTalk.localSR() && window.EchoTalk.lastSpeech() === null), '网页版：没有本机识别');
  check(!errs.length, '安卓、网页版没有报错', errs.slice(0, 3));
  await ctx.close();

  await b.close();
  srv.close();
  console.log(fails ? `\n✗ ${fails} 项没过` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
