// 别的语言的课（西语）在云端模式里走服务器的识别和合成（cloud/API.md §8 的 lang，2026-11-20：老板的 iPhone 上西语没有本机识别，口语题只能跳过）：
//  A 服务器说它认西语（GET /v1/me 的 speechLangs 有 es）：口语题连 /v1/asr-rt?lang=es，识别出来的字照这门课的打分规矩打分、过了；
//    实时识别连不上时整段走 POST /v1/asr，请求体带 lang: 'es'；没有配音的西语句子走 POST /v1/tts，带 lang: 'es'
//  B 服务器不认（老服务器：me 里没有 speechLangs）：和以前一样——口语题不去连服务器、说清楚原因、出「先跳过」；朗读用本机声音，不发合成请求
//  C 英语课：发给服务器的请求和以前一字不差（实时识别的网址没有 ?lang=、整段识别只有 audio、合成只有 text / g）
// 服务器是这里起的假服务器（和游戏同一个本机小网站，/v1/…），记下手机发来的每个请求；课程用 tools/course/build.js 出的西语 course.json（只读）。
// 运行：node tests/speech-lang.test.js（大约 1 分钟）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
// ws：根目录没装，借 server/ 或 cloud/ 的（cd server && npm install，或 cd cloud && npm ci）
const WSMOD = ['server', 'cloud'].map(d => path.join(ROOT, d, 'node_modules', 'ws')).find(d => fs.existsSync(path.join(d, 'package.json')));
if (!WSMOD) { console.log('✗ 没有 ws：先 cd server && npm install（或 cd cloud && npm ci）'); process.exit(1); }
const { WebSocketServer } = require(WSMOD);
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const FN = require('./fake-native');
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + JSON.stringify(more).slice(0, 900) : '')); if (!ok) fails++; return ok; };

// ---------- 西语课程包小样（course.json + 一个只有一句的配音包：第一座岛的词都没有配音，朗读要走现场合成） ----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-speech-lang-'));
const VER = '20261120.1';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
let course;
try { course = CB.build('es', { check: true }).course; } catch (e) { console.log('  ⚠ tools/course/check.js 没过，用 buildCourse 直接转：' + String(e.message).split('\n')[0]); course = CB.buildCourse('es'); }
function pack(lang, texts, c) {
  const dir = path.join(TMP, lang, VER); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  if (c) {
    const b = Buffer.from(JSON.stringify(c));
    fs.writeFileSync(path.join(dir, 'course.json'), b);
    files.push({ name: 'course.json', kind: 'course', bytes: b.length, crc: PK.crcHex(new Uint8Array(b)) });
  }
  const v = PK.packBundle(texts.map(t => ({ g: 'f', k: key(t), data: new Uint8Array(OGG) })));
  fs.writeFileSync(path.join(dir, 'voice-000.bin'), v);
  files.push({ name: 'voice-000.bin', kind: 'voice', core: true, bytes: v.length, crc: PK.crcHex(v), n: texts.length });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ fmt: 1, lang, ver: VER, voice: { fmt: 'ogg-opus', f: 'x', m: 'y', n: { f: texts.length, m: 0 } }, files }));
  return files.reduce((s, f) => s + f.bytes, 0);
}
const CAT = { fmt: 1, packs: {} };
{ const n = pack('en', ['Hello!']); CAT.packs.en = { ver: VER, name: { zh: '英语', en: 'English', self: 'English' }, bytes: n, core: n, course: false }; }
{ const n = pack('es', ['Zzz prueba.'], course); CAT.packs.es = { ver: VER, name: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, bytes: n, core: n, course: true, voiced: ['Zzz prueba.'] }; }

// ---------- 本机小网站 + 假的公开版服务器（/v1/…） ----------
const CL = { adv: true, say: '', refuseRt: false, http: [], ws: [] };
const ME = () => Object.assign({
  id: 'u_test', email: 'p***@example.test', apple: false, ageGroup: 'adult', ui: 'zh', level: 1, tzOffsetMin: 600, iapToken: '00000000-0000-4000-8000-000000000000', createdAt: '2026-11-20T00:00:00.000Z',
  consent: { required: false, state: 'none', parentEmail: null, requestedAt: null, grantedAt: null }, features: { talk: true, place: true, steps: true },
  plan: 'free', subscription: { state: 'none', plan: null, productId: null, expiresAt: null, graceUntil: null, environment: null },
  quota: { day: '2026-11-20', tzOffsetMin: 600, resetsAt: new Date(Date.now() + 864e5).toISOString(), talk: { limitSec: 300, usedSec: 0, leftSec: 300 }, asr: { limit: 400, used: 0, left: 400 }, aux: { limit: 300, used: 0, left: 300 } },
}, CL.adv ? { speechLangs: ['en', 'es', 'ja', 'zh'] } : {});
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const server = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  if (u.startsWith('/v1/')) {
    let raw = '';
    req.on('data', d => (raw += d));
    req.on('end', () => {
      let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
      CL.http.push({ method: req.method, path: u, auth: req.headers.authorization || '', body, raw });
      const j = (code, o) => send(code, JSON.stringify(o), MIME.json);
      if (u === '/v1/me' && req.method === 'GET') return j(200, ME());
      if (u === '/v1/asr' && req.method === 'POST') return j(200, { text: CL.say, quota: { meter: 'asr', left: 399 } });
      if (u === '/v1/tts' && req.method === 'POST') return j(200, { url: 'http://127.0.0.1:' + server.address().port + '/tts-test.ogg', quota: { meter: 'aux', left: 299 } });
      return j(404, { error: 'not_found', message: 'No such endpoint' });
    });
    return;
  }
  if (u === '/tts-test.ogg') return send(200, OGG, MIME.ogg);
  if (u.startsWith('/packs/')) {
    const r = u.slice(7);
    if (r === 'catalog.json') return send(200, JSON.stringify(CAT), MIME.json);
    const file = path.join(TMP, r);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT) || /[\\/](android|server|node_modules|cloud|ios)[\\/]/.test(file.slice(ROOT.length))) return send(404, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});
// 假的 /v1/asr-rt：记下网址和收到的消息；收到第一段声音就回 CL.say（边说边出的字 + 认完了）
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/v1/asr-rt' || CL.refuseRt) { CL.ws.push({ url: req.url, refused: true, msgs: [] }); socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    const c = { url: req.url, msgs: [] }; CL.ws.push(c);
    let said = false;
    ws.on('message', d => {
      let m; try { m = JSON.parse(String(d)); } catch (e) { return; }
      c.msgs.push(m);
      if (m.type === 'input_audio_buffer.append' && !said) {
        said = true;
        ws.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.text', text: CL.say, stash: '' }));
        ws.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: CL.say }));
      } else if (m.type === 'session.finish') { ws.send(JSON.stringify({ type: 'session.finished' })); setTimeout(() => ws.close(), 20); }
    });
  });
});

// 假麦克风：一直有 320Hz 的声音；window.__micLevel(0) 变成没声音
function fakeMic() {
  const md = navigator.mediaDevices; if (!md) return;
  const gains = [];
  let level = 0.3;
  window.__micLevel = v => { level = v; gains.forEach(g => { g.gain.value = v; }); };
  md.getUserMedia = async () => {
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator(), g = ac.createGain();
    osc.frequency.value = 320; g.gain.value = level; osc.connect(g); g.connect(dest); osc.start();
    gains.push(g);
    return dest.stream;
  };
}
const SAVE = () => ({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120,
  settings: { tts: 'online', mode: 'auto', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh' },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1 }, daily: {} },
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  const W = (p, ms) => p.waitForTimeout(ms);
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const until = async (p, fn, arg, ms) => { const t0 = Date.now(); for (;;) { let v; try { v = await p.evaluate(fn, arg); } catch (e) { v = null; } if (v) return v; if (Date.now() - t0 > (ms || 6000)) return v; await W(p, 100); } };
  async function newPage(query, native) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(u => !u.href.startsWith(BASE), r => r.abort());   // 外面的网址一律挡掉
    // iPhone：假原生桥（tests/fake-native.js 的 platform 'ios'）+ window.ECHO_IOS（真 App 里 echo-native.js 设的）
    if (native) { await ctx.addInitScript(FN.install, Object.assign({ key: '', pin: '1234', net: 'ok', mic: 'granted' }, native)); await ctx.addInitScript(() => { window.ECHO_IOS = 1; }); }
    await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); localStorage.setItem('echo-cloud-token', 'eis_' + 'x'.repeat(43)); }, JSON.stringify(SAVE()));
    await ctx.addInitScript(fakeMic);
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message); });
    await p.goto(BASE + '/index.html' + query);
    await homeUp(p);
    return { ctx, p };
  }
  // 一道口语题：开题 → 服务器要回的字设成答案 → 点话筒；fallback = 实时识别连不上（整段识别兜底：说 0.8 秒就不出声了）
  async function speakQ(p, q, o) {
    o = o || {};
    await p.evaluate(q => { EchoGame.closeModal(); EchoGame.playQs([q]); }, q);
    await W(p, 500);
    const target = await p.evaluate(() => EchoGame.P().q.target);
    CL.say = o.say != null ? o.say : target; CL.refuseRt = !!o.fallback;
    const h0 = CL.http.length, w0 = CL.ws.length;
    await p.evaluate(() => window.__micLevel(0.3));
    await p.click('#mic');
    if (o.fallback) { await W(p, 900); await p.evaluate(() => window.__micLevel(0)); }
    if (o.expectSkip) await W(p, 700);
    else await until(p, () => EchoGame.P().answered || (document.getElementById('fb') || { classList: { contains: () => false } }).classList.contains('show'), null, 9000);
    await W(p, 300);
    CL.refuseRt = false;
    const st = await p.evaluate(() => ({ answered: !!EchoGame.P().answered, hint: (document.querySelector('#mic-hint') || {}).textContent || '', skip: !!document.querySelector('#p-skip') && !document.querySelector('#p-skip').hidden, last: EchoTalk.lastSpeech && EchoTalk.lastSpeech() }));
    return Object.assign(st, { target, http: CL.http.slice(h0).filter(r => r.path !== '/v1/me'), ws: CL.ws.slice(w0) });
  }
  const sayIt = async (p, text) => { const h0 = CL.http.length; await p.evaluate(t => EchoGame.say(t), text); await W(p, 400); return CL.http.slice(h0).filter(r => r.path === '/v1/tts'); };

  try {
    // ================= A 西语课 + 服务器认西语 =================
    console.log('— A 西语课，服务器认西语（speechLangs 有 es）');
    CL.adv = true;
    let { ctx, p } = await newPage('?packs=' + encodeURIComponent('/packs') + '&cloud=' + encodeURIComponent(BASE));
    await p.evaluate(() => EchoPacks.install('es'));
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: 'es', rev: undefined, stars: {}, place: { lang: 'es', lv: 1, auto: 1, know: 1, who: 'adult', at: '2026-11-20' } });
      s.settings.track = 'level'; s.settings.mode = 'auto';
      localStorage.setItem('echo-island-v1@es', JSON.stringify(s)); localStorage.setItem('echo-course', 'es');
    });
    await p.reload(); await homeUp(p);
    const me = await until(p, () => { const m = EchoAccount.me(); return m && m.speechLangs ? { langs: m.speechLangs, course: EchoPacks.course(), cloud: EchoCloud.on, signed: EchoAccount.signed() } : null; });
    check(me && me.course === 'es' && me.cloud && me.signed && JSON.stringify(me.langs) === '["en","es","ja","zh"]', '云端模式、登录了、学西语；GET /v1/me 拿到 speechLangs', me);
    check(await p.evaluate(() => EchoTalk.speechLang('es', 'asr') && EchoTalk.speechLang('Spanish', 'tts') && !EchoGame.A.down()), '服务器认西语：识别、合成都能走服务器，口语题不是「AI 用不了」');
    let r = await speakQ(p, ['sr_w', 0, 0]);
    let rt = r.ws.find(x => !x.refused), su = rt && rt.msgs.find(m => m.type === 'session.update');
    check(rt && /^\/v1\/asr-rt\?lang=es$/.test(rt.url) && rt.msgs[0] && rt.msgs[0].type === 'auth', '口语题连服务器的实时识别：/v1/asr-rt?lang=es，第一条消息是 auth', r.ws.map(x => x.url));
    check(su && su.session.input_audio_transcription.language === 'es', '（手机发的 session.update 里也写着 es）', su && su.session);
    check(r.answered && r.last && r.last.eng === 'cloud' && r.last.ok, '服务器认出来的西语（「' + r.target + '」）照这门课的规矩打分：过了', { answered: r.answered, last: r.last, hint: r.hint });
    check(!r.http.some(x => x.path === '/v1/asr'), '实时识别好好的：没有再整段识别');
    await p.screenshot({ path: path.join(SHOTS, 'speech-lang-es-cloud.png') });
    // 实时识别连不上：整段识别带 lang
    r = await speakQ(p, ['sr_w', 0, 1], { fallback: true });
    const whole = r.http.filter(x => x.path === '/v1/asr');
    check(r.ws.length && r.ws.every(x => x.refused && /lang=es/.test(x.url)) && whole.length === 1 && whole[0].body && whole[0].body.lang === 'es' && JSON.stringify(Object.keys(whole[0].body)) === '["audio","lang"]' && /^Bearer eis_/.test(whole[0].auth),
      '实时识别连不上：录好的整段交给 POST /v1/asr，请求体 { audio, lang: "es" }', { ws: r.ws.map(x => x.url), whole: whole.map(x => Object.keys(x.body || {})) });
    check(r.answered, '整段识别出来的西语照样打分、过了', { hint: r.hint, last: r.last });
    // 没有配音的西语词：现场合成带 lang
    const word = course.WORLDS[0].words[2][0];
    let tts = await sayIt(p, word);
    check(tts.length === 1 && tts[0].body.text === word && tts[0].body.lang === 'es' && JSON.stringify(Object.keys(tts[0].body).filter(k => k !== 'g')) === '["text","lang"]', '没有配音的西语词「' + word + '」：POST /v1/tts 带 lang: "es"', tts.map(x => x.body));
    check(await p.evaluate(() => (window.EchoGame.T && EchoGame.T.RT ? !EchoGame.T.RT.cloudTTSBroken : true)), '合成没被当成坏了');
    await ctx.close();

    // ================= B 老服务器：me 里没有 speechLangs =================
    console.log('— B 西语课，服务器不认（老服务器，没有 speechLangs）');
    CL.adv = false;
    ({ ctx, p } = await newPage('?packs=' + encodeURIComponent('/packs') + '&cloud=' + encodeURIComponent(BASE)));
    await p.evaluate(() => EchoPacks.install('es'));
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: 'es', rev: undefined, stars: {}, place: { lang: 'es', lv: 1, auto: 1, know: 1, who: 'adult', at: '2026-11-20' } });
      s.settings.track = 'level'; s.settings.mode = 'auto';
      localStorage.setItem('echo-island-v1@es', JSON.stringify(s)); localStorage.setItem('echo-course', 'es');
    });
    await p.reload(); await homeUp(p);
    const me2 = await until(p, () => { const m = EchoAccount.me(); return m && m.id && !('speechLangs' in m) ? { course: EchoPacks.course(), asr: EchoTalk.speechLang('es', 'asr'), tts: EchoTalk.speechLang('Spanish', 'tts') } : null; });
    check(me2 && me2.course === 'es' && !me2.asr && !me2.tts, '账号信息里没有 speechLangs：西语的识别、合成都不走服务器', me2);
    r = await speakQ(p, ['sr_w', 0, 0], { expectSkip: true });
    check(!r.answered && r.skip && /手机自带的识别|own speech recognition/.test(r.hint), '口语题和以前一样：说清楚要用手机自带的识别、出「先跳过」', { hint: r.hint, skip: r.skip });
    check(!r.ws.length && !r.http.some(x => x.path === '/v1/asr'), '没去连服务器的识别（实时、整段都没有）', { ws: r.ws.map(x => x.url), http: r.http.map(x => x.path) });
    tts = await sayIt(p, word);
    check(!tts.length, '没有配音的西语词：不发合成请求，直接用本机声音（和以前一样）', tts.map(x => x.body));
    await ctx.close();

    // ================= D iPhone：手机自带的识别没有西语（老板的手机，2026-11-20） =================
    console.log('— D iPhone，本机识别开不起来西语（unavailable）');
    const ON = { auth: 'authorized', mic: 'granted', onDevice: true, available: true, locale: 'en-US', engine: 'SFSpeechRecognizer' };
    const esSave = () => {
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: 'es', rev: undefined, stars: {}, place: { lang: 'es', lv: 1, auto: 1, know: 1, who: 'adult', at: '2026-11-20' } });
      s.settings.track = 'level'; s.settings.mode = 'auto';
      localStorage.setItem('echo-island-v1@es', JSON.stringify(s)); localStorage.setItem('echo-course', 'es');
    };
    for (const adv of [true, false]) {
      CL.adv = adv;
      ({ ctx, p } = await newPage('?packs=' + encodeURIComponent('/packs') + '&cloud=' + encodeURIComponent(BASE), { platform: 'ios', speech: { state: ON, start: 'fail:unavailable', script: [] } }));
      await p.evaluate(() => EchoPacks.install('es'));
      await p.evaluate(esSave);
      await p.reload(); await homeUp(p);
      await until(p, a => { const m = EchoAccount.me(); return m && m.id && ('speechLangs' in m) === a && EchoPacks.course() === 'es'; }, adv);
      check(await p.evaluate(() => EchoTalk.localSR()), (adv ? '服务器认西语' : '老服务器') + '：一开始照样先试本机识别');
      r = await speakQ(p, ['sr_w', 0, 0], adv ? {} : { expectSkip: true });
      const starts = await p.evaluate(() => window.__fakeNative.speech.log.filter(x => x.m === 'speechStart').map(x => x.opts.locale));
      if (adv) {
        check(starts[0] === 'es-MX' && r.last && r.last.fell === 'unavailable' && r.last.eng === 'cloud' && r.ws.some(x => /^\/v1\/asr-rt\?lang=es$/.test(x.url)) && r.answered,
          '本机开不起来西语：同一次里接着走服务器的识别（?lang=es），孩子不用再点、过了', { starts, last: r.last, ws: r.ws.map(x => x.url), hint: r.hint });
        await p.screenshot({ path: path.join(SHOTS, 'speech-lang-es-iphone.png') });
      } else {
        check(starts[0] === 'es-MX' && !r.answered && r.skip && /手机自带的识别|own speech recognition/.test(r.hint) && !r.ws.length && !r.http.some(x => x.path === '/v1/asr'),
          '老服务器：和以前一样，本机开不起来就说清楚原因、出「先跳过」，不去连服务器', { starts, hint: r.hint, skip: r.skip, ws: r.ws.map(x => x.url) });
      }
      await ctx.close();
    }

    // ================= C 英语课：请求和以前一字不差 =================
    console.log('— C 英语课（服务器认西语也一样）：发给服务器的请求和以前一样');
    CL.adv = true;
    ({ ctx, p } = await newPage('?cloud=' + encodeURIComponent(BASE)));
    await until(p, () => !!(EchoAccount.me() && EchoAccount.me().speechLangs));
    check(await p.evaluate(() => !EchoPacks.course || EchoPacks.course() === 'en'), '英语课');
    r = await speakQ(p, ['sr_w', 0, 0]);
    rt = r.ws.find(x => !x.refused); su = rt && rt.msgs.find(m => m.type === 'session.update');
    check(rt && rt.url === '/v1/asr-rt' && su && su.session.input_audio_transcription.language === 'en', '英语：实时识别的网址就是 /v1/asr-rt（没有 ?lang=），session.update 照旧 en', { url: rt && rt.url, su: su && su.session });
    check(r.answered, '英语照旧打分、过了', { hint: r.hint });
    r = await speakQ(p, ['sr_w', 0, 1], { fallback: true });
    const w2 = r.http.filter(x => x.path === '/v1/asr');
    check(w2.length === 1 && JSON.stringify(Object.keys(w2[0].body)) === '["audio"]' && r.ws.every(x => x.url === '/v1/asr-rt'), '英语整段识别：请求体只有 audio（和以前一样）', w2.map(x => Object.keys(x.body || {})));
    const line = 'Zebra quiz number seven for Coco';
    tts = await sayIt(p, line);
    check(tts.length === 1 && tts[0].raw === JSON.stringify({ text: line }), '英语没有配音的句子：合成的请求体和以前一字不差（{ text, g }，没有 lang）', tts.map(x => x.raw));
    await ctx.close();
  } catch (e) {
    console.log('✗ 出错：' + (e && e.stack || e));
    fails++;
  }
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 临时文件夹 */ }
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
