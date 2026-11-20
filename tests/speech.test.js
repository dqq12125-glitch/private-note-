// iPhone 口语题的本机识别（2026-11-20，老板：「那个识别，还是太慢了，有时候还不准」）：
// 原生 ios/App/Sources/LocalSpeech.swift（手机自带的语音识别，只在手机上识别）+ talk.js 的 nativeListen。这里用假的原生桥
// （tests/fake-native.js 的 platform 'ios'，S.speech 按时间发 echo-speech 事件）走一遍网页这一侧：
//  1. iPhone 上口语题先用本机识别（没网、云端连不上也行）：边说边出字、对上答案当场结束、不连阿里云、不算 AI 用量、计时记录
//  2. 读错了不给过（识别不知道答案，打分照样按 scoreSpeech）
//  3. 什么时候算说完：字停住 0.4 秒（单词）/ 0.6 秒（句子）、还在出声多等（最多 1.2 秒）、不出声了就结束、一直没说话 5 秒、被打断不打分
//  4. 本机开不起来（unavailable / denied / audio）同一次里改走云端识别，孩子不用再点；unavailable / denied 记住；麦克风被拒直接弹「去打开」
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
// 假麦克风（云端识别那条路要用）：一直有 320Hz 的声音
function fakeMic() {
  const md = navigator.mediaDevices; if (!md) return;
  md.getUserMedia = async () => {
    if (localStorage.getItem('__mic') === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = 0.3; osc.connect(g); g.connect(dest); osc.start();
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
  await load(BASE(), { fake: { speech: { state: ON, start: 'ok', script: [] } } });
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
  check(tDone < 1600, '点话筒到出分不到 1.6 秒（假的说话 0.5 秒）：' + tDone + ' 毫秒');
  let c = await calls();
  check(c.includes('speechStart') && !c.includes('wsOpen') && !c.includes('post'), '用的是原生的本机识别：没连阿里云（wsOpen / post 都没调），云端连不上也不要紧', c.filter(x => /speech|ws|post/.test(x)));
  let l = await L();
  check((l.asrN || 0) === asr0 && l.srDev === 1 && !l.srCloud, '本机识别不算 AI 用量（asrN 没变），周报的计数记了本机 1 次', l);
  check(await E(() => window.__micOpens || 0) === 0, '网页没有另开麦克风（录音是原生自己录的）');
  await p.screenshot({ path: out + '/speech-native-pass.png' });

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

  // ---------- 3. 说完的计时：单词 0.4 秒、句子 0.6 秒、还在出声多等、一直没说话、被打断 ----------
  await E(() => { window.EchoGame.closeModal(); window.EchoGame.goHome(); });
  const listen = (script, o) => E(async ([script, o]) => {
    Object.assign(window.__fakeNative.speech, { script });
    const t0 = performance.now();
    const r = await window.EchoTalk.listenOnce(Object.assign({ match: () => false }, o));
    return { r, ms: Math.round(performance.now() - t0), s: window.EchoTalk.lastSpeech() };
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
  x = await listen([[100, 'partial', 'I like'], [250, 'end', 'interrupted']], {});
  check(x.r.err === 'aborted' && !x.r.text, '被来电 / Siri 打断：说了一半的不拿去打分（aborted，不算一次尝试）', x.r);
  x = await listen([[100, 'partial', 'Hello'], [200, 'final', 'Hello there']], {});
  check(x.r.text === 'Hello there' && x.s.how === 'final', '原生给了最终结果：用它', x);
  x = await listen([], { short: true });
  check(x.r.err === 'no-speech' && x.s.how === 'silence' && x.ms >= 4900 && x.ms < 6500, '一直没说话：5 秒结束，算「没听清」', { r: x.r, ms: x.ms });
  c = await E(() => window.__fakeNative.speech.log.filter(x => x.m === 'speechStart').length - window.__fakeNative.speech.log.filter(x => x.m === 'speechStop').length);
  check(c <= 0, '每次结束都叫原生停下（speechStop）', c);
  check(await E(() => window.EchoTalk.speechLog().length >= 8 && window.EchoTalk.speechLog().every(r => r.eng === 'device')), '最近几次的计时都留着（EchoTalk.speechLog()，只在内存里）');

  // ---------- 4. 本机开不起来：同一次里改走云端，不用再点 ----------
  for (const why of ['unavailable', 'denied', 'audio']) {
    await load(BASE(), { fake: { net: 'ok', speech: { state: ON, start: 'fail:' + why, script: [] } } });
    target = await question(0);
    await E(t => localStorage.setItem('__cloudSay', t), target);
    await p.click('#mic');
    const ok = await until(() => E(() => window.EchoGame.P().answered), 80, 100);
    s = await last(); c = await calls();
    check(ok && s.eng === 'cloud' && s.fell === why && c.includes('speechStart') && c.includes('wsOpen'), why + '：只点了一次话筒，本机开不起来就接着走云端识别，过了', { ok, s, c: c.filter(x => /speech|ws/.test(x)) });
    const ls = await E(() => window.EchoTalk.localSR());
    check(why === 'audio' ? ls === true : ls === false, why + (why === 'audio' ? '：录音出错不记住（下一题还先试本机）' : '：记住了，这次打开 App 不再每题先试本机'), ls);
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
  // 麦克风被拒：云端也要麦克风，直接弹「去打开」
  await load(BASE(), { fake: { net: 'ok', mic: 'blocked', speech: { state: ON, start: 'fail:mic', script: [] } } });
  await question(0);
  await p.click('#mic');
  check(await until(() => E(() => !document.querySelector('#modal').hidden && /麦克风/.test(document.querySelector('#sheet').textContent)), 40), '麦克风被拒：弹「为什么要用麦克风 / 去打开」（不白白再去连云端）');
  c = await calls();
  check(!c.includes('wsOpen') && await E(() => (window.__micOpens || 0) === 0), '麦克风被拒时没去连云端、网页没开麦克风', c.filter(x => /speech|ws/.test(x)));
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
