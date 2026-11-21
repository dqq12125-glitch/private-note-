// 别的语言的课里「和岛民聊天」（tools/course/TALK.md §4，Playwright Chromium，约 1–2 分钟）：node tests/course-talk.test.js [--only=es,ja,zh,old,en]
// 不调真的 AI：中转服务是真的 server/relay.js（另起一个进程，钥匙是假的、钥匙文件指到不存在的地方），它连的「阿里云」是这里起的假上游——
// 实时语音（松开话筒就「听到」排好的一句、response.create 就回排好的一句）和文字模型（打勾 / 翻译 / 评语，按请求的形状认）。
// 游戏：本机小网站（游戏文件 + /packs/：真的课程源文件经 tools/course/build.js 出的 course.json + 几段假配音），和 tests/course.test.js 一样。
//   es / ja / zh 每门语言各走一遍（西语、日语是中文界面，中文课是英语界面）：
//     1 聊天页：列的是这门课的 8 个单元角色，说的是这门语言，没有「还在做」；每日任务有「和岛民聊天」；学习锁要聊（不是整天免）；单元上有「聊这个单元」
//     2 打开一个角色：连接只发角色 id（语言由服务器按 id 查）、目标 / 小步骤 / 词卡的意思按界面语言、示范句和词卡带读音（日语、中文）、
//       岛民照着剧本说的开场白带读音、AI 标识和每天第一次的提示都在
//     3 用假识别结果说几句：够数的算、不够数的 / 说了别的语言的 / 同一句再说一遍不算；打勾；说到的词卡变绿
//     4 点气泡看意思（请求里带 lang 和 ui：中文界面翻成中文，英语界面翻成英文）、帮帮我
//     5 结束 → 评语页：星星、步骤、表扬、「更好的说法」（西语、中文第二天进复习，日语不进）、金币；记录、岛民的记忆存在这门课的存档里；学习锁开了
//     6 说到被欺负：安全标记、评语页的提醒、家长看全文要密码
//     7 大地图上和面前的人聊：按钮写着这门语言，连接是 npc=dyn、p 里带 lang
//   old 老服务器（/health 没有 talkLangs）：聊天页「这门语言的 AI 聊天还在做」、学习锁整天免、没有聊天任务、打不开；记着「会」的旧结果问到以后改过来；
//       服务器连接时说不会（lang）；云端模式看账号的 talkLangs；APK 直连 = 不会
//   en  英语课（课程包模式 + 同一个中转服务）：聊天页、数句子、请求和以前一样（不带 lang / ui），不问 /health
// 截图 tests/screenshots/ctalk-*.png（竖屏、横屏；要看图：字有没有挤出去、读音有没有压住别的字）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const CB = require(path.join(ROOT, 'tools', 'course', 'build.js'));
const PK = require(path.join(ROOT, 'packs.js'))._;
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
const TC = require(path.join(ROOT, 'talk-core.js'));
const { WebSocketServer } = require(path.join(ROOT, 'server', 'node_modules', 'ws'));
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + (typeof more === 'string' ? more : JSON.stringify(more)).slice(0, 900) : '')); if (!ok) fails++; return ok; };
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = s => !ONLY.length || ONLY.includes(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LANGS = ['es', 'ja', 'zh'];
const NAMES = { en: { zh: '英语', en: 'English', self: 'English' }, es: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, ja: { zh: '日语', en: 'Japanese', self: '日本語' }, zh: { zh: '中文', en: 'Chinese', self: '中文' } };
const UI = { es: 'zh', ja: 'zh', zh: 'en' };   // 每门课用哪种界面语言走（中文课在中文界面里不列）
// 假识别结果：够数的三句（第一句里有一张词卡上的词）、不够数的、说了别的语言的、说到被欺负的、评语里「原话 → 更好的说法」
const SAY = {
  es: { ok: ['Soy simpático y divertido.', 'Mi mejor amiga es muy valiente.', 'Tengo el pelo corto y los ojos castaños.'], short: 'Sí.', other: '我的朋友很勇敢', worry: 'En la escuela me acosan y estoy muy triste.',
    tip: ['Mi amiga es valiente mucho', 'Mi amiga es muy valiente.', '「muy」放在形容词前面'] },
  ja: { ok: ['ゆいさんは友だちです。', 'ゆいさんは一年生です。', '父は船長です。'], short: 'はい。', other: '我的朋友是学生', worry: 'がっこうでいじめられています。',
    tip: ['ゆいさん友だちです', 'ゆいさんは友だちです。', '名字后面要加「は」'] },
  zh: { ok: ['我的名字叫小云。', '我姓林，我叫林小云。', '认识你我很高兴。'], short: '你好。', other: 'My name is Tom and I like it', worry: '同学总是打我，我很难过。',
    tip: ['我名字叫小云', '我的名字叫小云。', 'Add 的 after 我.'] },
};

// ---------- 课程包小样（和 tests/course.test.js 一样的做法）----------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-ctalk-'));
const VER = '20261121.1';
const OGG = fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'f', fs.readdirSync(path.join(ROOT, 'assets', 'voice', 'f')).find(f => f.endsWith('.ogg'))));
function courseOf(lang) {
  try { return CB.build(lang, { check: true, lines: false }).course; } catch (e) { console.log('  ⚠ ' + lang + '：tools/course/check.js 没过，用 buildCourse 直接转：' + String(e.message).split('\n')[0]); return CB.buildCourse(lang, { lines: false }); }
}
function pack(lang, texts, course) {
  const dir = path.join(TMP, 'packs', lang, VER); fs.mkdirSync(dir, { recursive: true });
  const files = [];
  if (course) { const b = Buffer.from(JSON.stringify(course)); fs.writeFileSync(path.join(dir, 'course.json'), b); files.push({ name: 'course.json', kind: 'course', bytes: b.length, crc: PK.crcHex(new Uint8Array(b)) }); }
  const seen = new Set(), items = [];
  texts.forEach(t => { const k = key(t); if (!seen.has(k)) { seen.add(k); items.push({ g: 'f', k, data: new Uint8Array(OGG) }); } });
  const v = PK.packBundle(items);
  fs.writeFileSync(path.join(dir, 'voice-000.bin'), v);
  files.push({ name: 'voice-000.bin', kind: 'voice', core: true, bytes: v.length, crc: PK.crcHex(v), n: items.length });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ fmt: 1, lang, ver: VER, voice: { fmt: 'ogg-opus', f: 'x', m: 'y', n: { f: items.length, m: 0 } }, files }));
  return files.reduce((s, f) => s + f.bytes, 0);
}
const C = {}, CAT = { fmt: 1, packs: {} };
{ const b = pack('en', ['Hello!']); CAT.packs.en = { ver: VER, name: NAMES.en, bytes: b, core: b, course: false }; }
for (const l of LANGS) {
  const c = C[l] = courseOf(l), b = pack(l, c.WORLDS[0].words.map(x => x[0]), c);
  CAT.packs[l] = { ver: VER, name: NAMES[l], bytes: b, core: b, course: true };
}

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const web = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  if (u.startsWith('/packs/')) {
    if (u === '/packs/catalog.json') return send(200, JSON.stringify(CAT), MIME.json);
    const file = path.join(TMP, u);
    if (!file.startsWith(TMP) || !fs.existsSync(file)) return send(404, '');
    return send(200, fs.readFileSync(file), MIME[path.extname(file).slice(1)]);
  }
  const file = path.join(ROOT, u === '/' ? '/index.html' : u);
  if (!file.startsWith(ROOT)) return send(403, '');
  fs.readFile(file, (e, b) => (e ? send(404, '') : send(200, b, MIME[path.extname(file).slice(1)])));
});

// ---------- 假的阿里云 ----------
// UP.heard / UP.npc：排好的识别结果、岛民的话；UP.sys 文字模型收到的每个请求（kind：steps / zh / eval / other）；UP.ins / UP.voice / UP.items 实时语音收到的人设、音色、文字消息
const UP = { heard: [], npc: [], sys: [], ins: [], voice: [], items: [], evalResp: null, stepsResp: [], zh: '', talks: 0 };
const fakeHttp = http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    let j = {}; try { j = JSON.parse(body); } catch (e) { j = {}; }
    const ms = Array.isArray(j.messages) ? j.messages : [], sys = String((ms[0] && ms[0].content) || ''), user = typeof (ms[1] && ms[1].content) === 'string' ? ms[1].content : '';
    // 按请求的形状认是哪一种（提示词的写法是 talk-core 的事）：打勾 max_tokens 60 + JSON、翻译 max_tokens 160、评语 JSON 没有上限
    const kind = !ms.length ? 'other' : j.max_tokens === 60 && j.response_format ? 'steps' : j.max_tokens === 160 && !j.response_format ? 'zh' : j.response_format && !j.max_tokens ? 'eval' : 'other';
    UP.sys.push({ kind, sys, user });
    const content = kind === 'steps' ? JSON.stringify({ done: UP.stepsResp }) : kind === 'zh' ? UP.zh : kind === 'eval' ? JSON.stringify(UP.evalResp) : '';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content } }], output: { audio: { url: '' } } }));
  });
});
const fakeWs = new WebSocketServer({ port: 0, host: '127.0.0.1' });
fakeWs.on('connection', ws => {
  let n = 0; UP.talks++;
  const send = o => { try { ws.send(JSON.stringify(o)); } catch (e) { /* 断了 */ } };
  ws.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (m.type === 'session.update') { UP.ins.push(String(m.session.instructions || '')); UP.voice.push(m.session.voice); }
    if (m.type === 'conversation.item.create') UP.items.push(m.item.content[0].text);
    if (m.type === 'input_audio_buffer.commit') { const it = 'i' + (++n); send({ type: 'input_audio_buffer.committed', item_id: it }); send({ type: 'conversation.item.input_audio_transcription.completed', item_id: it, transcript: UP.heard.shift() || 'ok' }); }
    if (m.type === 'response.create') { const rid = 'r' + (++n); send({ type: 'response.audio_transcript.delta', delta: UP.npc.shift() || '…' }); send({ type: 'response.done', response: { id: rid } }); }
  });
});

// ---------- 老服务器 / 说了会其实不会的服务器（只有 /health 和一个一连上就回 lang 错的 /talk）----------
const STUB = { langs: undefined, hits: 0, talks: 0 };
const stubWs = new WebSocketServer({ noServer: true });
const stub = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/health') { STUB.hits++; res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify(Object.assign({ ok: true, model: 'x', code: false, npcs: [] }, STUB.langs ? { talkLangs: STUB.langs } : null))); }
  res.writeHead(404); res.end();
});
stub.on('upgrade', (req, socket, head) => stubWs.handleUpgrade(req, socket, head, ws => { STUB.talks++; ws.send(JSON.stringify({ type: 'error', code: 'lang', zh: '这里还不会用这门语言聊天' })); ws.close(); }));

const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const b64json = s => JSON.parse(Buffer.from(String(s || ''), 'base64url').toString('utf8'));

// 测试存档（英语的）：有进度、看过说明、自己学（没有学习锁，要测学习锁时在页面里改成孩子）、口语自评、只用配音、不放音乐
const SAVE = () => ({
  seenIntro: true, coins: 500, micCheck: 'x', xp: 120,
  settings: { tts: 'online', mode: 'self', gfx: '2d', sfx: false, gate: false, music: 'off', learner: 'open', ui: 'zh' },
  player: { gender: 'girl', name: 'Coco' },
  mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 10, xp: 0 }], team: ['u0'], dex: {}, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: -1, y: -1, dir: 'up', visited: { 0: 1 }, flags: { 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, daily: {} },
});

(async () => {
  const webPort = await listen(web), fakePort = await listen(fakeHttp), stubPort = await listen(stub);
  await new Promise(r => (fakeWs.address() ? r() : fakeWs.on('listening', r)));
  // 真的中转服务：钥匙是假的，钥匙文件指到一个不存在的文件；聊天、评语、识别、合成全指到假上游
  // 端口：别的测试的中转服务用 18000–23999（talk / quests / place），这里用 24000–25999，一起跑的时候不撞
  const relayPort = 24000 + Math.floor(Math.random() * 2000), fakeBase = 'http://127.0.0.1:' + fakePort;
  const env = Object.assign({}, process.env, { DASHSCOPE_API_KEY: 'test-not-a-real-key', KEY_FILE: path.join(TMP, 'none.env'), PORT: String(relayPort), LOG_DIR: path.join(TMP, 'logs'), DEBUG_DIR: path.join(TMP, 'debug'),
    EVAL_BASE_URL: fakeBase, TALK_URL: 'ws://127.0.0.1:' + fakeWs.address().port, ASR_URL: fakeBase + '/asr', TTS_URL: fakeBase + '/tts', ASR_RT_URL: 'ws://127.0.0.1:' + fakeWs.address().port,
    USAGE_FILE: path.join(TMP, 'usage.json'), ACCESS_CODE: '', ADMIN_TOKEN: '', SERVE_GAME: '', DAILY_MIN: '60', SESSION_MIN: '8', TALK_LANGS: '', ALLOWED_ORIGINS: '' });
  fs.mkdirSync(env.LOG_DIR); fs.mkdirSync(env.DEBUG_DIR);
  const relay = spawn(process.execPath, [path.join(ROOT, 'server', 'relay.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let relayOut = ''; relay.stdout.on('data', d => { relayOut += d; }); relay.stderr.on('data', d => { relayOut += d; });
  let health = null;
  for (let k = 0; k < 60 && !health; k++) { await sleep(100); try { health = await (await fetch('http://127.0.0.1:' + relayPort + '/health')).json(); } catch (e) { health = null; } }
  const BASE = 'http://127.0.0.1:' + webPort, RELAY = 'ws://127.0.0.1:' + relayPort, OLD = 'ws://127.0.0.1:' + stubPort;
  // 对方那一半（talk-core.js、server/relay.js、talk-courses.js）到没到：没到的话这里说清楚等什么，后面三门语言的段落会跟着不过
  check(typeof TC.langOk === 'function' && LANGS.every(l => TC.langOk(l) === l) && TC.LANGS && LANGS.every(l => TC.LANGS[l] && typeof TC.LANGS[l].say === 'string'), '聊天核心 talk-core.js 认得 es / ja / zh（langOk、LANGS[lang].say）', Object.keys(TC).join(','));
  check(!!health && Array.isArray(health.talkLangs) && LANGS.every(l => health.talkLangs.includes(l)), '中转服务（真的 server/relay.js + 假上游）起来了，/health 的 talkLangs 有 es / ja / zh', health || relayOut.slice(-300));

  const browser = await chromium.launch(Object.assign({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const errs = [];
  // 打开游戏（英语存档）。o.talk：对话服务的地址；o.init：页面脚本跑之前要做的事
  async function openGame(o) {
    o = o || {};
    // 截图按 2 倍像素出：聊天界面里的读音字小，要放大了才看得出有没有压住别的字
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    // 只许连本机：游戏文件、课程包、中转服务、假服务器
    await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; return /^(127\.0\.0\.1|localhost)$/.test(h) ? r.continue() : r.abort(); });
    await ctx.addInitScript(s => { if (!localStorage.getItem('echo-island-v1')) localStorage.setItem('echo-island-v1', s); }, JSON.stringify(SAVE()));
    if (o.init) await ctx.addInitScript(o.init, o.initArg);
    const p = await ctx.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message, (e.stack || '').split('\n')[1]); });
    p.on('dialog', d => d.accept('1234'));
    p.wsUrls = []; p.posts = [];
    p.on('websocket', ws => p.wsUrls.push(ws.url()));
    p.on('request', r => { if (r.method() === 'POST' && /\/(zh|steps)(\?|$)/.test(r.url())) p.posts.push({ path: new URL(r.url()).pathname, body: r.postData() || '' }); });
    await p.goto(BASE + '/index.html?packs=' + encodeURIComponent('/packs') + (o.talk ? '&talk=' + encodeURIComponent(o.talk) : ''));
    await homeUp(p);
    return { ctx, p };
  }
  const homeUp = p => p.waitForFunction(() => window.EchoGame && EchoGame.S && !document.getElementById('home').hidden, null, { timeout: 25000 });
  const W = (p, ms) => p.waitForTimeout(ms);
  const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, 'ctalk-' + name + '.png') });
  // 换到 L 这门课：装课程包、写这门课的存档（第 2 级、按能力走）、重新打开
  async function toCourse(p, L, more) {
    await p.evaluate(l => EchoPacks.install(l), L);
    await p.evaluate(([l, ui, more]) => {
      const s = JSON.parse(localStorage.getItem('echo-island-v1'));
      Object.assign(s, { course: l, rev: undefined, stars: {}, talk: undefined, quests: undefined, log: undefined, place: { lang: l, lv: 2, auto: 2, talk: 2, adj: 0, know: 2, who: 'adult', at: '2026-11-20' } });
      Object.assign(s.settings, { track: 'level', ui, pin: '1234' }, more || null);
      localStorage.setItem('echo-island-v1@' + l, JSON.stringify(s)); localStorage.setItem('echo-course', l);
    }, [L, UI[L], more || null]);
    await p.reload(); await homeUp(p);
  }
  const talkTab = async p => { await p.evaluate(() => { EchoGame.S.homeTab = 'talk'; EchoGame.goHome('talk'); }); await p.waitForSelector('.tk-home'); await W(p, 150); };
  const openChat = async (p, id) => { await p.evaluate(i => EchoTalk.open(i), id); const ok = await p.waitForSelector('#tk-mic:not([disabled])', { timeout: 8000 }).then(() => true).catch(() => false); await W(p, 250); return ok; };
  // 按住话筒说一句（假上游按顺序「听到」UP.heard 里的话）；steps：这句说完以后文字模型说做到了哪几步（从 1 数）
  async function speak(p, text, steps) {
    if (steps) UP.stepsResp = steps;
    UP.heard.push(text);
    const n0 = await p.evaluate(() => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length);
    await p.locator('#tk-mic').dispatchEvent('pointerdown'); await W(p, 800); await p.locator('#tk-mic').dispatchEvent('pointerup');
    await p.waitForFunction(n => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length > n, n0, { timeout: 5000 }).catch(() => {});
    await W(p, 350);
  }
  const dayLog = p => p.evaluate(() => Object.assign({}, EchoGame.dayLog()));
  const endChat = async p => { await p.evaluate(() => EchoTalk.endIfOpen()); await p.waitForSelector('.tk-eval', { timeout: 8000 }).catch(() => {}); await W(p, 200); };
  const closeChat = async p => { await p.evaluate(() => { while (EchoTalk.isOpen()) EchoTalk.endIfOpen(); }); await W(p, 200); };
  const lastWs = p => new URL(p.wsUrls[p.wsUrls.length - 1].replace(/^ws/, 'http')).searchParams;

  try {
    // ================= 三门语言各走一遍 =================
    for (const L of LANGS.filter(want)) {
      const NAME = NAMES[L][UI[L]], ui = UI[L], zhUi = ui === 'zh', talk = C[L].TALK, npc = talk[0], X = TC.LANGS && TC.LANGS[L] ? TC.LANGS[L] : {}, T = SAY[L];
      console.log('— ' + L + '（' + NAMES[L].zh + '，界面 ' + ui + '）');
      UP.heard.length = 0; UP.npc.length = 0; UP.sys.length = 0; UP.items.length = 0; UP.ins.length = 0; UP.voice.length = 0;
      const { ctx, p } = await openGame({ talk: RELAY });
      await toCourse(p, L);
      await p.evaluate(() => EchoTalk.langAsk());
      const on = await p.waitForFunction(() => EchoTalk.langOk(), null, { timeout: 6000 }).then(() => true).catch(() => false);
      const cache = await p.evaluate(() => localStorage.getItem('echo-talk-langs'));
      check(on && !!cache && JSON.parse(cache).l.includes(L), '问到中转服务会用' + NAMES[L].zh + '聊（/health 的 talkLangs），结果记了下来', cache);
      if (!on) { await ctx.close(); continue; }

      // ---------- 1 聊天页、每日任务、学习锁、单元上的按钮 ----------
      await talkTab(p);
      const home = await p.evaluate(() => ({ txt: document.querySelector('.tk-home').innerText, ids: [...document.querySelectorAll('.tk-home .tk-card')].map(c => c.dataset.npc), heads: [...document.querySelectorAll('.tk-home .tk-h')].map(h => h.textContent), ai: !!document.querySelector('.tk-home .tk-ai-line'), btns: [...document.querySelectorAll('.tk-home [data-act]')].map(b => b.dataset.act) }));
      check(JSON.stringify(home.ids) === JSON.stringify(talk.map(n => n.id)) && home.heads.length === 1 && /课程单元|Course units/.test(home.heads[0]), '聊天页：列的是这门课的 ' + talk.length + ' 个单元角色，一栏「课程单元」，没有「岛上的人」', { ids: home.ids, heads: home.heads });
      check(home.txt.includes(NAME) && !/英语|in English|speak English/.test(home.txt) && !/还在做|still being built/.test(home.txt) && /0\/6/.test(home.txt), '聊天页说的是' + NAME + '（没有「英语」、没有「还在做」），有「已开口说 0/6 句」', home.txt.slice(0, 260));
      check(home.ai && ['talk_log', 'talk_privacy', 'talk_concerns'].every(a => home.btns.includes(a)), '聊天页：AI 生成的标识、聊天记录、家长须知、家长看看都在', home.btns);
      check(home.txt.includes(npc.name) && (zhUi ? home.txt.includes(npc.topicZh) && !home.txt.includes(npc.topic) : home.txt.includes(npc.topic)), '角色卡片：名字、话题按界面语言（' + (zhUi ? npc.topicZh : npc.topic) + '）', home.txt.slice(0, 200));
      await p.screenshot({ path: path.join(SHOTS, 'ctalk-' + L + '-home.png'), fullPage: true });   // 整页：下面的角色卡片也要看
      // 每日任务：有「和岛民聊天」；今天的任务是不知道能不能聊的时候排的 → 知道能聊了换进来
      const q1 = await p.evaluate(() => { const S = EchoGame.S; S.quests.list = S.quests.list.filter(q => q.id !== 'tk1'); const n = S.quests.list.length; EchoGame.goHome('talk'); return { n, ids: S.quests.list.map(q => q.id), txt: document.querySelector('#quests').innerText }; });
      check(q1.ids.includes('tk1') && q1.ids.length === q1.n && q1.txt.includes(NAME) && !/英语|English/.test(q1.txt), '每日任务：排任务时还不知道能聊的，现在把一个没动过的换成「用' + NAME + '和岛民聊天」', q1);
      // 学习锁（孩子、开着）：聊天这一项要做，不是「整天免」；早些时候按「聊不了」免过的不算数了
      const g1 = await p.evaluate(() => { const S = EchoGame.S; S.settings.learner = 'kid'; S.settings.gate = true; EchoGame.dayLog().gateEx = 'lang'; const g = EchoGame.gate(); EchoGame.goHome('mon'); return { g, ex: EchoGame.dayLog().gateEx || '', card: (document.querySelector('.gate-card') || {}).innerText || '' }; });
      check(g1.g.on && g1.g.chatOn && !g1.g.chatOk && !g1.g.open && g1.g.exWhy === '' && g1.ex === '', '学习锁：聊天这一项和英语课一样要做（不是整天免；早些时候按「聊不了」免的不算数了）', g1.g);
      check(g1.card.includes(NAME) && /0\/6/.test(g1.card) && !/英语|in English/.test(g1.card), '学习锁卡片：「用' + NAME + '和岛民聊天：已开口说 0/6 句」', g1.card.slice(0, 200));
      await p.evaluate(() => { const S = EchoGame.S; S.settings.learner = 'open'; S.settings.gate = false; S.homeTab = 'quiz'; EchoGame.goHome('quiz'); });
      await W(p, 200);
      const ub = await p.evaluate(id => !!document.querySelector('#map [data-act=talk_open][data-npc="' + id + '"]'), npc.id);
      check(ub, '闯关页：单元上有「聊这个单元」的按钮（' + npc.id + '）');

      // ---------- 2 打开第一个角色 ----------
      UP.npc.push(npc.opener);   // 岛民第一句照着剧本说开场白
      await talkTab(p);
      await p.click('.tk-home .tk-card[data-npc="' + npc.id + '"]');
      const opened = await p.waitForSelector('#tk-mic:not([disabled])', { timeout: 8000 }).then(() => true).catch(() => false);
      await p.waitForFunction(() => document.querySelectorAll('#tk-log .tk-b.npc').length > 0 && !!document.querySelector('#tk-log .tk-b.npc')._text, null, { timeout: 6000 }).catch(() => {});
      await W(p, 300);
      const q = opened ? lastWs(p) : new URLSearchParams();
      check(opened && q.get('npc') === npc.id && q.get('g') === '0' && q.get('lv') === '2' && q.get('ui') === ui && !q.has('lang') && !q.has('p') && !q.has('quest'), '连接：只发角色 id（' + npc.id + '）、目标、级别、界面语言——语言由服务器按 id 查', opened ? [...q.entries()].map(e => e.join('=')).join('&') : relayOut.slice(-300));
      const steps = npc.goals[0].steps;
      const ov = await p.evaluate(() => ({
        txt: document.querySelector('#tk-ov').innerText, head: document.querySelector('.tk-head').innerText, goal: document.querySelector('.tk-gt').innerText,
        // 示范句的字：读音（<rt>）不算
        steps: [...document.querySelectorAll('#tk-steps li span')].map(s => s.textContent), eg: [...document.querySelectorAll('#tk-steps li small')].map(s => { const c = s.cloneNode(true); c.querySelectorAll('rt').forEach(x => x.remove()); return { hidden: s.hidden, txt: c.textContent, html: s.innerHTML }; }),
        words: [...document.querySelectorAll('.tk-words .tk-w')].map(b => ({ html: b.innerHTML, mean: (b.querySelector('small') || {}).textContent || '' })),
        mic: document.querySelector('#tk-mic').textContent, status: document.querySelector('#tk-status').textContent, ph: document.querySelector('#tk-in').placeholder,
        ai: (document.querySelector('#tk-ai') || {}).textContent || '', sys: [...document.querySelectorAll('#tk-log .tk-b.sys')].map(b => b.textContent),
        npc: [...document.querySelectorAll('#tk-log .tk-b.npc')].map(b => ({ text: b._text || '', html: b.innerHTML, tap: b.dataset.act === 'talk_zh' })), cnt: document.querySelector('#tk-cnt').textContent,
      }));
      check(ov.head.includes(npc.name) && ov.goal.includes(zhUi ? npc.goalZh : npc.goal), '顶上是角色的名字，目标按界面语言（' + (zhUi ? npc.goalZh : npc.goal).slice(0, 30) + '）', { head: ov.head, goal: ov.goal });
      check(ov.steps.length === steps.length && ov.steps.every((s, k) => s === (zhUi ? steps[k][0] : steps[k][2].en)), '小步骤 ' + steps.length + ' 步，说明按界面语言（' + (zhUi ? steps[0][0] : steps[0][2].en) + '）', ov.steps);
      check(ov.eg.length === steps.length && ov.eg.every((e, k) => e.hidden && e.txt.includes(steps[k][1])), '每一步有这门语言的示范句（先收着，点一下才亮）', ov.eg.map(e => e.txt));
      check(ov.words.length === npc.words.length && ov.words.every((w, k) => w.mean === (zhUi ? npc.wordsZh[k] : npc.wordsEn[k])), '词卡下面的意思按界面语言（' + (zhUi ? npc.wordsZh[0] : npc.wordsEn[0]) + '）', ov.words.map(w => w.mean));
      const rubyW = ov.words.filter(w => w.html.includes('<ruby>')).length, rubyE = ov.eg.filter(e => e.html.includes('<ruby>')).length;
      if (L === 'es') check(!rubyW && !rubyE && !ov.npc.some(b => b.html.includes('<ruby>')), '西语：词卡、示范句、开场白都不标读音');
      else check(rubyW >= 1 && rubyE >= 1, NAMES[L].zh + '：词卡（' + rubyW + '/' + ov.words.length + '）和示范句（' + rubyE + '/' + ov.eg.length + '）带读音（<ruby>）', { w: ov.words.map(w => w.html).slice(0, 3), e: ov.eg.map(e => e.html).slice(0, 2) });
      // 读音只按课程里写过的标，不猜：日语一串汉字要整串对上、前面带「ご」的不拿单个字的读音去凑；关了「读音」就不标
      if (L !== 'es') {
        const rl = await p.evaluate(l => {
          const R = t => EchoGame.rubyLine(t), S = EchoGame.S, o = l === 'ja' ? { ok: R('父です'), run: R('鬱父です'), pre: R('ご父です') } : { ok: R('我叫小云') };
          S.settings.ruby = false; o.off = R(l === 'ja' ? '父です' : '我叫小云'); delete S.settings.ruby;
          return o;
        }, L);
        check(L === 'ja' ? /<rt>ちち<\/rt>/.test(rl.ok) && !rl.run.includes('<ruby>') && !rl.pre.includes('<ruby>') && !rl.off.includes('<ruby>') : /<rt>wǒ<\/rt>/.test(rl.ok) && /<rt>jiào<\/rt>/.test(rl.ok) && !rl.off.includes('<ruby>'),
          '读音只照课程里写过的标' + (L === 'ja' ? '（「父」ちち；「鬱父」整串对不上、「ご父」前面带着 ご：不标）' : '（我 wǒ、叫 jiào）') + '；设置里关了读音就不标', rl);
      }
      check(ov.mic.includes(NAME) && ov.status.includes(NAME) && ov.ph.includes(NAME) && !/英语|English/.test(ov.mic + ov.status + ov.ph) && (!zhUi || /看意思/.test(ov.status)), '话筒按钮、提示、打字框写的都是' + NAME + '（没有「英语」）', [ov.mic, ov.status, ov.ph]);
      check(!!ov.ai && ov.sys.length === 1 && /人工智能|made by AI/.test(ov.sys[0]) && /0\/6/.test(ov.cnt), 'AI 生成的标识在顶上，今天第一次聊天开头有一句提示；「已开口说 0/6 句」', { ai: ov.ai, sys: ov.sys, cnt: ov.cnt });
      const ob = ov.npc[0] || { text: '', html: '' };
      check(ob.text === npc.opener && ob.tap && (L === 'es' ? !ob.html.includes('<ruby>') : ob.html.includes('<ruby>')), '岛民开口（假 AI 照着剧本说开场白）：' + (L === 'es' ? '原样' : '带读音') + '，可以点一下看意思', ob);
      const ins = UP.ins[UP.ins.length - 1] || '', voice = UP.voice[UP.voice.length - 1];
      check(ins.includes(npc.persona.slice(0, 60)) && ins.includes(npc.opener) && (!X.en || ins.includes(X.en)) && !/Speak ONLY in English/.test(ins) && /parent or a teacher/.test(ins) && /game character made by a computer|made by a computer/.test(ins),
        '服务器拼的人设：这个角色、开场白、说的是 ' + (X.en || L) + '，安全规则在（告诉家长或老师、不装真人）', ins.slice(0, 200));
      check(!!voice && !['Jennifer', 'Aiden', 'Mione'].includes(voice) && (!X.voices || [].concat(X.voices.f, X.voices.m).includes(voice)), '音色是这门语言的（' + voice + '），不是英语的那三个', voice);
      // 点一步：亮出示范句
      await p.click('#tk-steps li[data-i="0"]'); await W(p, 200);
      check(await p.evaluate(() => !document.querySelector('#tk-steps li[data-i="0"] small').hidden) && (await dayLog(p)).chatHint === 1, '点一个小步骤：亮出示范句');

      // ---------- 3 说几句 ----------
      await speak(p, T.ok[0], [1]);
      await p.waitForSelector('#tk-steps li.ok', { timeout: 4000 }).catch(() => {});
      let lg = await dayLog(p);
      check(lg.voiceLines === 1 && /1\/6/.test(await p.textContent('#tk-cnt')), '说一句够数的' + NAMES[L].zh + '（' + T.ok[0] + '）：已开口说 1/6 句', lg.voiceLines);
      check(await p.locator('#tk-steps li.ok').count() === 1, '小步骤实时打勾（请求里是课程角色的 id）');
      const sp = p.posts.filter(x => x.path === '/steps').map(x => JSON.parse(x.body)).pop() || {};
      check(sp.npc === npc.id && sp.lang === L && sp.g === 0 && (zhUi ? sp.ui === undefined : sp.ui === ui), '打勾的请求：npc = ' + npc.id + '、lang = ' + L, sp);
      const hit = await p.evaluate(() => [...document.querySelectorAll('.tk-w.hit')].map(b => b.dataset.i));
      const expHit = npc.words.map((w, k) => [w, k]).filter(([w]) => T.ok[0].toLowerCase().includes(w.toLowerCase())).map(([, k]) => String(k));
      check(expHit.length > 0 && expHit.every(k => hit.includes(k)), '说到词卡上的词（' + expHit.map(k => npc.words[k]).join('、') + '）：卡片变绿', { hit, expHit });
      await speak(p, T.short);
      await speak(p, T.other);
      await speak(p, T.ok[0]);
      lg = await dayLog(p);
      check(lg.voiceLines === 1, '不够数的（' + T.short + '）、说了别的语言的（' + T.other + '）、同一句再说一遍：都不算', lg.voiceLines);
      check((lg.chatSaidZh || 0) === (L === 'zh' ? 0 : 1), L === 'zh' ? '学中文：说中文不记成「说了中文」' : '说了一句中文：周报里记一次', lg.chatSaidZh);
      await speak(p, T.ok[1], [1, 2]);
      await speak(p, T.ok[2], [1, 2, 3]);
      lg = await dayLog(p);
      const units = TC.lineUnits ? TC.lineUnits(T.ok.slice().sort((a, b) => TC.lineUnits(b, L) - TC.lineUnits(a, L))[0], L) : 0;
      check(lg.voiceLines === 3 && /3\/6/.test(await p.textContent('#tk-cnt')) && (!units || lg.voiceMax > 0), '再说两句：已开口说 3/6 句', { n: lg.voiceLines, max: lg.voiceMax, units });

      // ---------- 4 看意思、帮帮我 ----------
      UP.zh = zhUi ? '你好！（意思）' : 'Hello! (meaning)';
      await p.click('#tk-log .tk-b.npc.tap');
      await p.waitForFunction(() => { const z = document.querySelector('#tk-log .tk-zh'); return z && !/翻译中|Translating/.test(z.textContent); }, null, { timeout: 5000 }).catch(() => {});
      const zb = p.posts.filter(x => x.path === '/zh').map(x => JSON.parse(x.body)).pop() || {}, zs = UP.sys.filter(x => x.kind === 'zh').pop() || { sys: '' };
      check((await p.textContent('#tk-log .tk-zh')) === UP.zh && zb.text === npc.opener && zb.lang === L && zb.ui === ui && (await dayLog(p)).chatZh === 1, '点岛民的话看意思：请求里带 lang = ' + L + '、ui = ' + ui + '，译文显示出来', zb);
      check((zhUi ? /简体中文/.test(zs.sys) : /English|英文/.test(zs.sys)) && zs.user === npc.opener, '服务器要的是翻成' + (zhUi ? '中文' : '英文'), zs.sys.slice(0, 80));
      UP.npc.push((X.say || '') + ' ' + steps[1][1]);
      await p.click('#tk-help');
      await p.waitForFunction(t => [...document.querySelectorAll('#tk-log .tk-b.npc')].some(b => (b._text || '').includes(t)), steps[1][1], { timeout: 5000 }).catch(() => {});
      const helpB = await p.evaluate(() => [...document.querySelectorAll('#tk-log .tk-b.npc')].map(b => b._text || '').pop());
      check(UP.items.includes(TC.GAME_HELP) && !!X.say && helpB.startsWith(X.say) && (await dayLog(p)).chatHelp === 1, '帮帮我：岛民给一句能照着说的话（以「' + (X.say || '?') + '」开头）', helpB);
      await shot(p, L + '-chat');
      await p.setViewportSize({ width: 844, height: 390 }); await W(p, 350);
      await shot(p, L + '-chat-land');
      await p.setViewportSize({ width: 390, height: 844 }); await W(p, 250);

      // ---------- 5 结束 → 评语 ----------
      const coins0 = await p.evaluate(() => EchoGame.S.coins);
      UP.evalResp = { steps: steps.map(() => true), done: true, stars: 3, praise: zhUi ? '说得真清楚！' : 'You said it very clearly!', tips: [{ said: T.tip[0], better: T.tip[1], note: T.tip[2] }], memory: ['likes sea shells'], concern: false, concernWhy: '' };
      await p.evaluate(() => { EchoGame.S.settings.learner = 'kid'; EchoGame.S.settings.gate = true; });
      await endChat(p);
      const ev = await p.evaluate(() => ({ txt: (document.querySelector('.tk-eval') || {}).innerText || '', tips: (document.querySelector('.tk-tips') || {}).innerText || '', stepsR: [...document.querySelectorAll('.tk-steps-r li')].map(l => l.textContent) }));
      check(/★★★/.test(ev.txt) && /每一步都做到了|every step/.test(ev.txt) && ev.txt.includes(UP.evalResp.praise) && ev.stepsR.length === steps.length && ev.stepsR.every(s => s.startsWith('✅')) && /金币|coin/.test(ev.txt) && /AI/.test(ev.txt),
        '评语页：3 星、每一步打勾、表扬、金币、「评语由 AI 生成」', ev.txt.slice(0, 220));
      check(ev.tips.includes(T.tip[1]) && ev.tips.includes(T.tip[0]) && (L === 'ja' ? !/每日复习|Daily review/.test(ev.tips) : /每日复习|Daily review/.test(ev.tips)),
        '「更好的说法」（' + T.tip[1] + '）' + (L === 'ja' ? '只在评语里显示，不说「明天复习」' : '写着明天的每日复习里会再练'), ev.tips);
      await shot(p, L + '-eval');
      const st = await p.evaluate(([id, l]) => {
        const S = EchoGame.S, T = S.talk, r = T.log[0], fr = Object.values(S.rev.items).filter(e => e.k === 'free');
        return { npc: r && r.npc, done: r && r.eval && r.eval.done, stars: r && r.eval && r.eval.stars, voice: r && r.voice, mem: T.mem[id], n: T.n[id], best: T.done[id], coins: S.coins, today: EchoTalk.today(), free: fr.map(e => ({ en: e.en, said: e.said, due: e.due })),
          quest: (S.quests.list.find(q => q.id === 'tk1') || {}).p, gate: EchoGame.gate(), key: 'echo-island-v1@' + l, saved: JSON.parse(localStorage.getItem('echo-island-v1@' + l) || '{}').talk, en: JSON.parse(localStorage.getItem('echo-island-v1') || '{}').talk || null };
      }, [npc.id, L]);
      // 这段聊天里用语音说的句子：够数的三句 + 重说的那一遍（一段里重说也算一句；今天的句数才去重）
      check(st.npc === npc.id && st.done === true && st.stars === 3 && st.voice === 4 && st.best === 3 && st.n === 1 && st.coins === coins0 + 25, '记录存好：' + npc.id + '、完成、3 星、这段开口 4 句（按' + NAMES[L].zh + '的规则数：短的、别的语言的不算）、金币 +25', st);
      check(!!st.mem && st.mem.facts.includes('likes sea shells'), '岛民记住聊到的小事', st.mem);
      check(st.today.goals === 1 && st.today.done && st.quest === 1, '今天完成 1 个聊天小目标，每日任务「和岛民聊天」有进度', { today: st.today, quest: st.quest });
      check(st.gate.chatDone && st.gate.open && st.gate.exWhy === '', '学习锁：聊天这一项做完了，冒险解锁', st.gate);
      if (L === 'ja') check(!st.free.length, '日语：「更好的说法」先不进每日复习', st.free);
      else check(st.free.length === 1 && st.free[0].en === T.tip[1] && st.free[0].said === T.tip[0] && !!st.free[0].due, NAMES[L].zh + '：「更好的说法」第二天进每日复习（带着原话）', st.free);
      check(!!st.saved && st.saved.log.length === 1 && st.saved.log[0].npc === npc.id && (!st.en || !(st.en.log || []).length), '聊天记录、岛民的记忆存在这门课的存档里（' + st.key + '），英语的存档里没有', { saved: !!st.saved, en: st.en });
      await p.evaluate(() => { EchoGame.S.settings.learner = 'open'; EchoGame.S.settings.gate = false; });
      await closeChat(p);

      // ---------- 6 说到被欺负：安全标记、家长看全文要密码 ----------
      UP.npc.push(npc.opener);
      await openChat(p, npc.id);
      check((await p.evaluate(() => document.querySelectorAll('#tk-log .tk-b.sys').length)) === 0, '今天第二次聊天：开头不再写那句 AI 提示（每天一次）');
      await speak(p, T.worry);
      UP.evalResp = { steps: steps.map(() => false), done: false, stars: 1, praise: '', tips: [], memory: [], concern: false, concernWhy: '' };
      await endChat(p);
      const cz = await p.evaluate(() => ({ rec: EchoGame.S.talk.log[0], n: EchoTalk.concerns(), txt: (document.querySelector('.tk-eval') || {}).innerText || '' }));
      check(cz.rec && cz.rec.concern === 1 && cz.n === 1 && /告诉爸爸妈妈或者老师|tell a parent or a teacher/.test(cz.txt), '说到被欺负（' + T.worry + '）：本机查到、打上安全标记，评语页提醒告诉家长或老师', { c: cz.rec && cz.rec.concern, n: cz.n });
      await closeChat(p);
      await p.evaluate(() => { EchoGame.S.settings.learner = 'kid'; });
      await talkTab(p);
      await p.click('.tk-home [data-act=talk_concerns]');
      const pin = await p.waitForSelector('#pin-pad', { timeout: 3000 }).then(() => true).catch(() => false);
      check(pin, '家长看看：要家长密码');
      if (pin) {
        for (const d of '1234') await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]');
        const shown = await p.waitForSelector('#sheet [data-act=talk_ack]', { timeout: 3000 }).then(() => true).catch(() => false);
        check(shown && (await p.textContent('#sheet')).includes(T.worry), '家长输密码后看到全文');
      }
      await p.evaluate(() => { EchoGame.closeModal(); EchoGame.S.settings.learner = 'open'; });

      // ---------- 7 大地图上和面前的人聊 ----------
      await p.evaluate(() => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); });
      await p.click('[data-act=wEnter]'); await W(p, 1200);
      const found = await p.evaluate(async () => {
        const d = EchoWorld._debug(), b = document.getElementById('w-chat');
        for (const n of d.M.npcs.filter(n => !n.mon)) for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
          d.PL.x = d.PL.fx = n.x + dx; d.PL.y = d.PL.fy = n.y + dy; d.PL.dir = dir; d.PL.moving = false;
          await new Promise(r => setTimeout(r, 120));
          if (b && !b.hidden) return { id: n.id, label: b.innerText };
        }
        return null;
      });
      check(!!found && found.label.includes(NAME) && !/英语|English/.test(found.label), '大地图上面前有人：聊天按钮写着「' + NAME + '」', found);
      if (found) {
        UP.npc.push('…');
        await p.click('#w-chat');
        const ok = await p.waitForSelector('#tk-mic:not([disabled])', { timeout: 8000 }).then(() => true).catch(() => false);
        await W(p, 300);
        const dq = ok ? lastWs(p) : new URLSearchParams(), pj = dq.get('p') ? b64json(dq.get('p')) : {};
        check(ok && dq.get('npc') === 'dyn' && pj.lang === L && !!pj.name && Array.isArray(pj.words) && pj.words.length > 0 && !/ Island Island/.test(String(pj.island)), '和面前的人聊：npc=dyn，p 里带 lang = ' + L + '（名字、岛、他说过的话、建议的词）', pj);
        const dv = await p.evaluate(() => ({ goal: document.querySelector('.tk-gt').innerText, eg: [...document.querySelectorAll('#tk-steps li small')].map(s => s.textContent), steps: [...document.querySelectorAll('#tk-steps li span')].map(s => s.textContent), mic: document.querySelector('#tk-mic').textContent }));
        check(dv.goal.includes(NAME) && !/英语|in English/.test(dv.goal) && dv.steps.length === 3 && !dv.eg.some(t => /Nice to meet you|What do you like doing/.test(t)), '目标说的是用' + NAME + '随便聊聊，示范句不是英语的', dv);
        const dins = UP.ins[UP.ins.length - 1] || '';
        check((!X.en || dins.includes(X.en)) && !/Speak ONLY in English/.test(dins) && dins.includes(String(pj.name)), '服务器给这个人拼的人设说的是 ' + (X.en || L), dins.slice(0, 160));
        await shot(p, L + '-world-chat');
        await closeChat(p);
      }
      await ctx.close();
    }

    // ================= old 服务器不会：一切照旧 =================
    if (want('old')) {
      console.log('— old 老服务器（/health 没有 talkLangs）、说了会其实不会、云端模式、APK 直连');
      const L = 'es', npc = C[L].TALK[0];
      STUB.langs = undefined; STUB.hits = 0;
      const { ctx, p } = await openGame({ talk: OLD });
      await toCourse(p, L, { learner: 'kid', gate: true });
      await p.evaluate(() => EchoTalk.langAsk());
      await talkTab(p);
      const o = await p.evaluate(id => {
        const S = EchoGame.S, g = EchoGame.gate();
        return { ok: EchoTalk.langOk(), home: document.querySelector('.tk-home').innerText, cards: document.querySelectorAll('.tk-home .tk-card').length, g, ex: EchoGame.dayLog().gateEx, quests: S.quests.list.map(q => q.id),
          cache: localStorage.getItem('echo-talk-langs'), blocked: EchoTalk.blocked() };
      }, npc.id);
      check(STUB.hits >= 1 && o.ok === false && /这门语言的 AI 聊天还在做/.test(o.home) && o.cards === 0, '老服务器：聊天页照旧写「这门语言的 AI 聊天还在做」，不列角色', { hits: STUB.hits, home: o.home.slice(0, 80) });
      await p.screenshot({ path: path.join(SHOTS, 'ctalk-old-home.png'), fullPage: true });
      check(o.g.on && !o.g.chatOn && o.g.chatOk && o.g.open && o.g.exWhy === 'lang' && o.ex === 'lang', '老服务器：学习锁里聊天那一项照旧整天免（lang）', o.g);
      check(!o.quests.includes('tk1') && /还在做/.test(o.blocked), '老服务器：每日任务没有「和岛民聊天」', o.quests);
      await p.evaluate(() => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); });
      const card = await p.evaluate(() => (document.querySelector('.gate-card') || {}).innerText || '');
      check(/这门语言的 AI 聊天还在做，今天先跳过/.test(card), '老服务器：学习锁卡片照旧写「还在做，今天先跳过」', card.slice(0, 160));
      await p.evaluate(id => EchoTalk.open(id), npc.id); await W(p, 300);
      check(!(await p.$('#tk-ov')) && /还在做/.test(await p.textContent('#toasts')) && STUB.talks === 0, '老服务器：打不开聊天（提示一句「还在做」，不去连）');
      await p.evaluate(() => { EchoGame.S.homeTab = 'quiz'; EchoGame.goHome('quiz'); }); await W(p, 200);
      check(!(await p.$('#map [data-act=talk_open]')), '老服务器：单元上没有「聊这个单元」');
      // 记着「会」的旧结果（上次连的是新服务器）：问到现在不会，改过来、聊天页换回「还在做」
      await p.evaluate(u => { localStorage.setItem('echo-talk-langs', JSON.stringify({ u, l: ['en', 'es', 'ja', 'zh'] })); }, OLD.replace(/^ws/, 'http'));
      await p.reload(); await homeUp(p);
      await p.evaluate(() => EchoTalk.langAsk());
      await p.waitForFunction(() => !EchoTalk.langOk(), null, { timeout: 6000 }).catch(() => {});
      const st2 = await p.evaluate(() => ({ ok: EchoTalk.langOk(), cache: JSON.parse(localStorage.getItem('echo-talk-langs')).l }));
      check(st2.ok === false && st2.cache.length === 0, '记着「会」的旧结果：重新问到服务器不会，改过来', st2);
      // 服务器说会（/health），连接的时候又说不会（lang 的错）：照「还在做」说，记下来，不算连不上
      STUB.langs = ['en', 'es'];
      await p.evaluate(() => EchoTalk.langAsk());
      await p.waitForFunction(() => EchoTalk.langOk(), null, { timeout: 6000 }).catch(() => {});
      STUB.langs = undefined;
      await p.evaluate(id => EchoTalk.open(id), npc.id);
      await p.waitForFunction(() => /还在做/.test((document.querySelector('#tk-status') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
      const st3 = await p.evaluate(() => ({ status: (document.querySelector('#tk-status') || {}).textContent || '', err: EchoGame.dayLog().chatErr || '', last: EchoTalk.lastErr() }));
      await closeChat(p);
      await p.waitForFunction(() => !EchoTalk.langOk(), null, { timeout: 6000 }).catch(() => {});
      check(STUB.talks === 1 && /这门语言的 AI 聊天还在做/.test(st3.status) && !st3.err && !(st3.last && st3.last.where === 'chat') && (await p.evaluate(() => !EchoTalk.langOk())), '连接时服务器说不会用这门语言聊：状态行写「还在做」，不记成聊天连不上，之后按不会算', st3);
      // APK 直连阿里云（有原生桥、有密钥）：这一轮不做，照旧不会
      const dr = await p.evaluate(u => {
        localStorage.setItem('echo-talk-langs', JSON.stringify({ u, l: ['en', 'es'] }));
        window.EchoNative = { hasKey: () => true };
        const r = { url: EchoTalk.relayUrl(), ok: EchoTalk.langOk() };
        delete window.EchoNative;
        return r;
      }, OLD.replace(/^ws/, 'http'));
      check(dr.url === 'direct:' && dr.ok === false, 'APK 直连阿里云：别的课的聊天照旧关着', dr);
      await ctx.close();

      // 云端模式：看账号（GET /v1/me 的缓存）里的 talkLangs；老服务器没有这个字段、没登录 = 不会
      for (const [me, exp, what] of [[{ plan: 'free', ageGroup: 'adult', features: {}, quota: { talk: { leftSec: 300, limitSec: 300 } }, talkLangs: ['en', 'es', 'ja', 'zh'] }, true, '账号里的 talkLangs 有这门语言：聊天开着'],
        [{ plan: 'free', ageGroup: 'adult', features: {}, quota: { talk: { leftSec: 300, limitSec: 300 } }, speechLangs: ['en', 'es'] }, false, '老服务器（没有 talkLangs）：照旧「还在做」'], [null, false, '没登录（不知道服务器会不会）：照旧「还在做」']]) {
        const c2 = await openGame({ init: me => { window.ECHO_CLOUD_URL = 'http://127.0.0.1:9'; if (me) { localStorage.setItem('echo-cloud-token', 'tok-test'); localStorage.setItem('echo-cloud-me', JSON.stringify(me)); } }, initArg: me });
        await toCourse(c2.p, L, { learner: 'kid', gate: true });
        await talkTab(c2.p);
        const r = await c2.p.evaluate(() => ({ cloud: EchoCloud.on, tl: EchoAccount.talkLang('es'), en: EchoAccount.talkLang('en'), ok: EchoTalk.langOk(), home: document.querySelector('.tk-home').innerText, cards: document.querySelectorAll('.tk-home .tk-card').length, g: EchoGame.gate() }));
        check(r.cloud && r.en === true && r.tl === exp && r.ok === exp && (exp ? r.cards === 8 && !/还在做/.test(r.home) && r.g.exWhy !== 'lang' : r.cards === 0 && /还在做/.test(r.home) && r.g.exWhy === 'lang'), '云端模式 · ' + what, { tl: r.tl, ok: r.ok, cards: r.cards, ex: r.g.exWhy });
        if (exp) await shot(c2.p, 'cloud-home');
        await c2.ctx.close();
      }
    }

    // ================= en 英语课：一切照旧 =================
    if (want('en')) {
      console.log('— en 英语课（课程包模式 + 同一个中转服务）');
      UP.heard.length = 0; UP.npc.length = 0; UP.sys.length = 0; UP.items.length = 0; UP.ins.length = 0; UP.voice.length = 0;
      const { ctx, p } = await openGame({ talk: RELAY });
      await talkTab(p);
      const h = await p.evaluate(() => ({ course: EchoPacks.course(), ok: EchoTalk.langOk(), txt: document.querySelector('.tk-home').innerText, ids: [...document.querySelectorAll('.tk-home .tk-card')].map(c => c.dataset.npc), heads: [...document.querySelectorAll('.tk-home .tk-h')].map(x => x.textContent), cache: localStorage.getItem('echo-talk-langs') }));
      check(h.course === 'en' && h.ok === true && h.cache === null, '英语课：聊天一直开着，不去问 /health 的 talkLangs', { ok: h.ok, cache: h.cache });
      check(/用英语和岛民聊天/.test(h.txt) && /用语音说满 6 句英语/.test(h.txt) && /点岛民的话看中文/.test(h.txt) && h.ids.includes('hj7a-u1') && h.ids.includes('kai') && h.heads.length === 2 && /课本话题/.test(h.heads[0]) && /岛上的人/.test(h.heads[1]) && /Unit 1/.test(h.txt),
        '英语课 · 聊天页：和以前一样（用英语、课本话题 + 岛上的人、Unit n）', h.txt.slice(0, 200));
      const N = require(path.join(ROOT, 'talk-npcs.js')), en = N.byId['hj7a-u3'];
      UP.npc.push('Hello! What is the weather like today?');
      await openChat(p, 'hj7a-u3');
      const q = lastWs(p);
      check(q.get('npc') === 'hj7a-u3' && q.get('g') === '0' && !q.has('lang') && !q.has('ui') && !q.has('lv') && !q.has('p'), '英语课 · 连接的参数和以前一样（没有 lang、中文界面不发 ui）', [...q.entries()].map(e => e.join('=')).join('&'));
      const ov = await p.evaluate(() => ({ mic: document.querySelector('#tk-mic').textContent, ruby: document.querySelector('#tk-ov').innerHTML.includes('<ruby>'), eg: [...document.querySelectorAll('#tk-steps li small')].map(s => s.textContent), words: [...document.querySelectorAll('.tk-words .tk-w')].map(b => b.textContent), ready: document.querySelector('#tk-status').textContent }));
      const g0 = TC.goalOf(en, 0);
      check(ov.mic === '🎤 按住说英语' && !ov.ruby && ov.eg.every((t, k) => t === '例：' + g0.steps[k].en) && ov.words.every((t, k) => t === en.words[k] + (en.wordsZh[k] || '')) && /按住话筒说英语，说完松开。点岛民说的话可以看中文。/.test(ov.ready),
        '英语课 · 聊天界面：按住说英语、示范句、词卡和以前一样，没有读音', ov);
      check((UP.ins[UP.ins.length - 1] || '') === TC.instructions(en, 'Coco', { goal: 0 }) && ['Jennifer', 'Aiden', 'Mione'].includes(UP.voice[UP.voice.length - 1]), '英语课 · 服务器拼的人设和 talk-core 的一字不差，音色是英语的');
      await speak(p, 'It is sunny and warm today.', [1]);
      await speak(p, 'Yes, sure.');
      await speak(p, '我喜欢秋天 because it is cool');
      let lg = await dayLog(p);
      check(lg.voiceLines === 1 && lg.chatSaidZh === 1, '英语课 · 数句子：≥3 个英文词、不含中文（短的、带中文的不算）', { n: lg.voiceLines, zh: lg.chatSaidZh });
      const sb = p.posts.filter(x => x.path === '/steps').map(x => x.body).pop() || '';
      check(!/"lang"|"ui"/.test(sb) && JSON.parse(sb).npc === 'hj7a-u3', '英语课 · 打勾的请求里没有 lang', sb.slice(0, 120));
      UP.zh = '你好！今天天气怎么样？';
      await p.waitForSelector('#tk-log .tk-b.npc.tap');
      await p.click('#tk-log .tk-b.npc.tap');
      await p.waitForFunction(() => /你好/.test((document.querySelector('#tk-log .tk-zh') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
      const zb = p.posts.filter(x => x.path === '/zh').map(x => x.body).pop() || '', zs = UP.sys.filter(x => x.kind === 'zh').pop() || { sys: '' };
      check(Object.keys(JSON.parse(zb || '{}')).join() === 'text' && zs.sys === TC.zhBody('x').messages[0].content, '英语课 · 看中文的请求只有 text，服务器的提示词和以前一字不差', zb);
      await speak(p, 'I wear a T-shirt and shorts.', [1, 2]);
      await speak(p, 'I like to fly kites in spring.', [1, 2, 3]);
      UP.evalResp = { steps: [true, true, true], done: true, stars: 3, praise: '说得真棒！', tips: [{ said: 'It cool in October', better: 'It is cool in October.', zh: '别漏了 is' }], memory: [], concern: false, concernWhy: '' };
      await endChat(p);
      const ev = await p.evaluate(() => ({ txt: (document.querySelector('.tk-eval') || {}).innerText || '', free: Object.values(EchoGame.S.rev.items).filter(e => e.k === 'free').map(e => e.en), rec: EchoGame.S.talk.log[0], keys: Object.keys(localStorage).filter(k => k.includes('@')) }));
      check(/★★★/.test(ev.txt) && /明天的每日复习里会再练/.test(ev.txt) && ev.free.includes('It is cool in October.') && ev.rec.npc === 'hj7a-u3' && ev.rec.voice === 3 && !ev.keys.length, '英语课 · 评语页、「更好的说法」进复习、记录存在英语的存档里', { free: ev.free, keys: ev.keys });
      await closeChat(p);
      await ctx.close();
    }
  } catch (e) {
    console.log('✗ 出错：' + (e && e.stack || e));
    fails++;
  }
  check(!errs.length, '没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  relay.kill(); web.close(); fakeHttp.close(); fakeWs.close(); stub.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 临时文件夹 */ }
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})();
