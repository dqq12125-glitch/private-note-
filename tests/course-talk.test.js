// 别的语言的课里「和岛民聊天」（tools/course/TALK.md §4 和「第二轮」C，Playwright Chromium，约 4–5 分钟）：node tests/course-talk.test.js [--only=es,ja,zh,old,en] [--real]
// （--real：第 8 段的委托用正式的 tools/course/<语言>/quests.json，不用小样）
// 不调真的 AI：中转服务是真的 server/relay.js（另起一个进程，钥匙是假的、钥匙文件指到不存在的地方），它连的「阿里云」是这里起的假上游——
// 实时语音（松开话筒就「听到」排好的一句、response.create 就回排好的一句）和文字模型（打勾 / 翻译 / 评语，按请求的形状认）。
// 游戏：本机小网站（游戏文件 + /packs/：真的课程源文件经 tools/course/build.js 出的 course.json + 几段假配音），和 tests/course.test.js 一样。
//   es / ja / zh 每门语言各走一遍（西语、日语是中文界面，中文课是英语界面）：
//     1 聊天页：列的是这门课的 8 个单元角色，说的是这门语言，没有「还在做」；每日任务有「和岛民聊天」；学习锁要聊（不是整天免）；单元上有「聊这个单元」
//     2 打开一个角色：连接只发角色 id（语言由服务器按 id 查）、目标 / 小步骤 / 词卡的意思按界面语言、示范句和词卡带读音（日语、中文）、
//       岛民照着剧本说的开场白带读音、AI 标识和每天第一次的提示都在
//     3 用假识别结果说几句：够数的算、不够数的 / 说了别的语言的 / 同一句再说一遍不算；打勾；说到的词卡变绿
//     4 点气泡看意思（请求里带 lang 和 ui：中文界面翻成中文，英语界面翻成英文）、帮帮我
//     5 结束 → 评语页：星星、步骤、表扬、「更好的说法」（西语、中文第二天进复习；日语读音表认得全的那句进、认不全的只在评语里显示）、金币；
//       记录、岛民的记忆存在这门课的存档里；学习锁开了；日语进了复习的那句排得进复习、按读音打得了分
//     6 说到被欺负：安全标记、评语页的提醒、家长看全文要密码
//     7 大地图上和面前的人聊：按钮写着这门语言，连接是 npc=dyn、p 里带 lang
//     第二轮（TALK.md「第二轮」C；课程包里塞了 tests/course-r2-fixture.js 的小样：第一条委托的内容）：
//     8 支线委托：委托人头上有「?」→ 按 A：请求是译文（下面是界面语言的意思，日语 / 中文标读音）→ 选项页（目标、奖励；按钮写着这门语言）→ 聊天：
//       连接带 quest=<id>&lang=<语言>，目标说明按界面语言、示范句 / 词卡 / 开场白是课程包里这门语言的（带读音，词卡的意思去掉讲英语的括号），
//       服务器拼的人设是这条委托的、说这门语言；打勾的请求带 q 和 lang → 评语页「委托完成了」→ 回地图道谢（译文）、奖励只给一次、存在这门课的存档里、
//       「?」没了、委托本；西语的词卡不看冠词（la gorra / una gorra）
//     9 AI 发音点评：口语题没念准，服务器的 tipLangs 有这门语言 → 请求带 lang，点评显示出来（标着 AI）
//   old 老服务器（/health 没有 talkLangs）：聊天页「这门语言的 AI 聊天还在做」、学习锁整天免、没有聊天任务、打不开；记着「会」的旧结果问到以后改过来；
//       服务器连接时说不会（lang）；云端模式看账号的 talkLangs；APK 直连 = 不会；
//       第二轮：服务器会聊、可是没有 questLangs / tipLangs（第一轮的服务器）→ 没有「?」、没有点评；老的课程包（没有 QUESTS）→ 没有「?」；
//       云端模式看账号 / health 的 questLangs、tipLangs
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
const FX = require(path.join(__dirname, 'course-r2-fixture.js'));   // 第二轮的小样：第一条委托在三门语言里的内容
const QS = require(path.join(ROOT, 'quests.js'));
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
  // tip2（第二轮）：第二条「更好的说法」里有读音表认不出来的汉字（醤油）——只在评语里显示，不进复习；第一条读得出来，进
  ja: { ok: ['ゆいさんは友だちです。', 'ゆいさんは一年生です。', '父は船長です。'], short: 'はい。', other: '我的朋友是学生', worry: 'がっこうでいじめられています。',
    tip: ['ゆいさん友だちです', 'ゆいさんは友だちです。', '名字后面要加「は」'], tip2: ['ちちは醤油すきです', '父は醤油が好きです。', '「すき」前面要加「が」'] },
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
function pack(lang, texts, course, root) {
  const dir = path.join(TMP, root || 'packs', lang, VER); fs.mkdirSync(dir, { recursive: true });
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
// 两套课程包：/packs（塞了第二轮的小样：第一条委托的请求 / 感谢的译文、QUESTS、委托人的名字牌）、/packs0（原样：老的课程包，只有西语）
const C = {}, CAT = { fmt: 1, packs: {} }, CAT0 = { fmt: 1, packs: {} };
{ const b = pack('en', ['Hello!']); CAT.packs.en = { ver: VER, name: NAMES.en, bytes: b, core: b, course: false }; const b0 = pack('en', ['Hello!'], null, 'packs0'); CAT0.packs.en = { ver: VER, name: NAMES.en, bytes: b0, core: b0, course: false }; }
// --real：委托用正式的翻译（tools/course/<语言>/quests.json，经 build.js 并进 LINES / QUESTS：17 条都有）走一遍同样的画面；平时用小样（结果固定）
const REAL = process.argv.includes('--real');
// 第一条委托在这门课里的样子（从 course.json 里读：小样和正式的翻译都一样读法）
const QD = l => {
  const q0 = QS.byId['q0-cap'], c = C[l], LN = en => FX.textOf((c.LINES || {})[en] || ''), who = ((c.TERMS || {}).person || {})['Ms Rosa'];
  return { ask: q0.ask.map(a => LN(a[0])), thanks: q0.thanks.map(a => LN(a[0])), bye: LN(q0.bye[0]), who: who == null ? 'Ms Rosa' : FX.textOf(who) };
};
for (const l of LANGS) {
  const plain = courseOf(l);
  if (l === 'es') { const b0 = pack(l, plain.WORLDS[0].words.map(x => x[0]), JSON.parse(JSON.stringify(plain)), 'packs0'); CAT0.packs[l] = { ver: VER, name: NAMES[l], bytes: b0, core: b0, course: true }; }
  const c = C[l] = REAL ? CB.build(l, { check: true, lines: false, quests: path.join(ROOT, 'tools', 'course', l, 'quests.json') }).course : FX.apply(plain, l, { quests: true }), Q = QD(l);
  const b = pack(l, c.WORLDS[0].words.map(x => x[0]).concat(Q.ask, Q.thanks, [Q.bye]).filter(Boolean), c);
  CAT.packs[l] = { ver: VER, name: NAMES[l], bytes: b, core: b, course: true };
}
if (REAL) console.log('  （--real：委托的内容是正式的翻译：' + LANGS.map(l => l + ' ' + Object.keys(C[l].QUESTS || {}).length + ' 条').join('、') + '）');

// ---------- 本机小网站 ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', ogg: 'audio/ogg', glb: 'model/gltf-binary', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', bin: 'application/octet-stream', svg: 'image/svg+xml', txt: 'text/plain' };
const web = http.createServer((req, res) => {
  res.on('error', () => {});
  const u = decodeURIComponent(req.url.split('?')[0]);
  const send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body); };
  if (u.startsWith('/packs/') || u.startsWith('/packs0/')) {
    if (u === '/packs/catalog.json') return send(200, JSON.stringify(CAT), MIME.json);
    if (u === '/packs0/catalog.json') return send(200, JSON.stringify(CAT0), MIME.json);
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
const UP = { heard: [], npc: [], sys: [], ins: [], voice: [], items: [], evalResp: null, stepsResp: [], zh: '', tip: '', talks: 0 };
const fakeHttp = http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    let j = {}; try { j = JSON.parse(body); } catch (e) { j = {}; }
    const ms = Array.isArray(j.messages) ? j.messages : [], sys = String((ms[0] && ms[0].content) || ''), user = typeof (ms[1] && ms[1].content) === 'string' ? ms[1].content : '';
    // 按请求的形状认是哪一种（提示词的写法是 talk-core 的事）：打勾 max_tokens 60 + JSON、翻译 max_tokens 160、评语 JSON 没有上限、发音点评 max_tokens 80
    const kind = !ms.length ? 'other' : j.max_tokens === 60 && j.response_format ? 'steps' : j.max_tokens === 160 && !j.response_format ? 'zh' : j.response_format && !j.max_tokens ? 'eval' : j.max_tokens === 80 && !j.response_format ? 'tip' : 'other';
    UP.sys.push({ kind, sys, user });
    const content = kind === 'steps' ? JSON.stringify({ done: UP.stepsResp }) : kind === 'zh' ? UP.zh : kind === 'eval' ? JSON.stringify(UP.evalResp) : kind === 'tip' ? UP.tip : '';
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
// 第二轮：STUB.quest / STUB.tip 给了才有 questLangs / tipLangs（不给 = 第一轮的服务器：会聊，可是不会做委托、不会写点评）；posts 记下发来的 POST（不该有）
const STUB = { langs: undefined, quest: undefined, tip: undefined, hits: 0, talks: 0, posts: [] };
const stubWs = new WebSocketServer({ noServer: true });
const stub = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/health') { STUB.hits++; res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify(Object.assign({ ok: true, model: 'x', code: false, npcs: [] }, STUB.langs ? { talkLangs: STUB.langs } : null, STUB.quest ? { questLangs: STUB.quest } : null, STUB.tip ? { tipLangs: STUB.tip } : null))); }
  if (req.method !== 'GET') STUB.posts.push(req.method + ' ' + u);
  res.writeHead(404, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end();
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
  // 第二轮：服务器那一半（questLangs / tipLangs、talk-courses.js 里三门语言的委托）到没到
  const TCQ = (() => { try { return require(path.join(ROOT, 'talk-courses.js')).quests || {}; } catch (e) { return {}; } })();
  check(!!health && Array.isArray(health.questLangs) && Array.isArray(health.tipLangs) && LANGS.every(l => health.questLangs.includes(l) && health.tipLangs.includes(l)) && LANGS.every(l => TCQ[l] && TCQ[l]['q0-cap']),
    '第二轮：/health 的 questLangs、tipLangs 有 es / ja / zh，talk-courses.js 里有三门语言的委托', health && { q: health.questLangs, t: health.tipLangs, tc: Object.keys(TCQ) });

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
    p.on('request', r => { if (r.method() === 'POST' && /\/(zh|steps|tip)(\?|$)/.test(r.url())) p.posts.push({ path: new URL(r.url()).pathname, body: r.postData() || '' }); });
    await p.goto(BASE + '/index.html?packs=' + encodeURIComponent('/' + (o.packs || 'packs')) + (o.talk ? '&talk=' + encodeURIComponent(o.talk) : ''));
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
  // 大地图上的小工具（第二轮：委托的测试用）。hook：记下渲染器每一帧拿到的画面信息（谁头上有「?」）；face(id)：站到这个人跟前、面朝 TA；
  // dlgNow：对话框现在这一页（正文和名字牌不算读音 <rt>）；closeDlg：一直按 A 到对话结束（选项页选第二个「以后再说」）
  const WT = p => {
    const typed = async () => { for (let i = 0; i < 60; i++) { if (!(await p.evaluate(() => { const d = EchoWorld._debug().dlg; return !!(d && d.typing); }))) return; await W(p, 80); } };
    const A = async () => { await typed(); await p.evaluate(() => document.querySelector('#world [data-act=wA].ba').click()); await W(p, 260); };
    const dlgNow = async () => { await typed(); return p.evaluate(() => {
      const box = document.querySelector('#w-dlg'); if (!box || box.hidden) return null;
      const strip = el => { if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('rt').forEach(x => x.remove()); return c.textContent.trim(); };
      const en = box.querySelector('.d-en'), zh = box.querySelector('#d-zh');
      return { en: strip(en), enHtml: en ? en.innerHTML : '', zh: zh ? zh.textContent.trim() : '', zhBtn: !!(zh && zh.tagName === 'BUTTON'), hear: !!box.querySelector('.d-hear'), name: strip(box.querySelector('.d-name')), btns: [...box.querySelectorAll('[data-act=wPick]')].map(b => b.textContent.trim()) };
    }); };
    const closeDlg = async () => {
      for (let i = 0; i < 14 && await p.evaluate(() => !!EchoWorld._debug().dlg); i++) {
        if (await p.$('#w-dlg [data-act=wPick]')) { await p.click('#w-dlg [data-act=wPick][data-i="1"]'); await W(p, 300); }
        else if (await p.$('#w-dlg [data-act=wSkip]')) { await p.evaluate(() => document.querySelector('#w-dlg [data-act=wSkip]').click()); await W(p, 300); }   // 说话任务：跳过
        else await A();
      }
    };
    const hook = async () => { await p.evaluate(() => { EchoGame.closeModal(); const R = EchoWorld._debug().R; if (R && !R._q) { R._q = 1; const od = R.draw; R.draw = function (now, V) { window.__V = V; return od.call(R, now, V); }; } }); await W(p, 900); };
    const marks = () => p.evaluate(() => Object.fromEntries((window.__V ? window.__V.npcs : []).map(q => [q.n.id, !!q.quest])));
    const quests = () => p.evaluate(() => EchoWorld.quests());
    const face = async id => {
      const at = await p.evaluate(id => {
        const d = EchoWorld._debug(), n = d.M.npcs.find(x => String(x.id) === id), WK = EchoMaps.WALK;
        if (!n) return null;
        for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
          const x = n.x + dx, y = n.y + dy, c = d.M.grid[y] && d.M.grid[y][x];
          if (c && WK.includes(c) && !d.M.npcs.some(m => m.x === x && m.y === y)) { d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = dir; d.PL.moving = false; d.FL.x = d.FL.fx = x; d.FL.y = d.FL.fy = y; return { x, y, dir, name: n.name }; }
        }
        return null;
      }, id);
      await W(p, 200);
      return at;
    };
    return { typed, A, dlgNow, closeDlg, hook, marks, quests, face };
  };

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
      UP.evalResp = { steps: steps.map(() => true), done: true, stars: 3, praise: zhUi ? '说得真清楚！' : 'You said it very clearly!', tips: [{ said: T.tip[0], better: T.tip[1], note: T.tip[2] }].concat(T.tip2 ? [{ said: T.tip2[0], better: T.tip2[1], note: T.tip2[2] }] : []), memory: ['likes sea shells'], concern: false, concernWhy: '' };
      await p.evaluate(() => { EchoGame.S.settings.learner = 'kid'; EchoGame.S.settings.gate = true; });
      await endChat(p);
      const ev = await p.evaluate(() => ({ txt: (document.querySelector('.tk-eval') || {}).innerText || '', tips: (document.querySelector('.tk-tips') || {}).innerText || '', stepsR: [...document.querySelectorAll('.tk-steps-r li')].map(l => l.textContent) }));
      check(/★★★/.test(ev.txt) && /每一步都做到了|every step/.test(ev.txt) && ev.txt.includes(UP.evalResp.praise) && ev.stepsR.length === steps.length && ev.stepsR.every(s => s.startsWith('✅')) && /金币|coin/.test(ev.txt) && /AI/.test(ev.txt),
        '评语页：3 星、每一步打勾、表扬、金币、「评语由 AI 生成」', ev.txt.slice(0, 220));
      check(ev.tips.includes(T.tip[1]) && ev.tips.includes(T.tip[0]) && /每日复习|Daily review/.test(ev.tips) && (L === 'ja') === /📅/.test(ev.tips),
        '「更好的说法」（' + T.tip[1] + '）写着明天的每日复习里会再练' + (L === 'ja' ? '——日语两条里只有读得出来的那条进，标着 📅' : ''), ev.tips);
      if (L === 'ja') {
        const tv = await p.evaluate(() => [...document.querySelectorAll('.tk-tips > div')].map(d => d.textContent));
        check(tv.length === 2 && tv[0].includes(T.tip[1]) && tv[0].includes('📅') && tv[1].includes(T.tip2[1]) && !tv[1].includes('📅'), '日语：读音表认得全的那句（' + T.tip[1] + '）标 📅；有认不出来的汉字的那句（' + T.tip2[1] + '）只在评语里显示', tv);
      }
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
      check(st.free.length === 1 && st.free[0].en === T.tip[1] && st.free[0].said === T.tip[0] && !!st.free[0].due, NAMES[L].zh + '：「更好的说法」第二天进每日复习（带着原话）' + (L === 'ja' ? '——只有读得出来的那一句，认不全的那句（醤油）没进' : ''), st.free);
      if (L === 'ja') {
        // 进了复习的那句：到期以后排得进一轮复习（开口题），没有条目也按读音打得了分——识别结果写假名、写汉字都对，说错了不过
        const rv = await p.evaluate(t => {
          const S = EchoGame.S, d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          const e = Object.values(S.rev.items).find(x => x.k === 'free'), due0 = e.due;
          e.due = today;
          const qs = EchoGame.rev.build().filter(q => q.free), q = qs[0] || {}, sc = h => EchoGame.speech.bestScore(t, [h]).score;
          e.due = due0;
          return { n: qs.length, type: q.type, target: q.target, kana: sc('ゆいさんはともだちです'), kanji: sc('結衣さんは友達です'), wrong: sc('ゆいさんはせんせいです'), readable: [EchoLang.get('ja').readable(t), EchoLang.get('ja').readable('父は醤油が好きです。')] };
        }, T.tip[1]);
        check(rv.n === 1 && rv.type === 'sr_s' && rv.target === T.tip[1] && rv.kana >= 90 && rv.kanji >= 90 && rv.wrong < 85 && rv.readable[0] === true && rv.readable[1] === false,
          '日语：进了复习的那句到期以后是一道开口题，按读音打分（听到假名 ' + rv.kana + ' 分、听到汉字 ' + rv.kanji + ' 分、说错 ' + rv.wrong + ' 分）', rv);
      }
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

      // ---------- 8 支线委托（第二轮；课程包里有第一条委托 q0-cap 的小样）----------
      {
        const q0 = QS.byId['q0-cap'], F = QD(L), tx = FX.textOf, QC = C[L].QUESTS['q0-cap'], rosa = tx(F.who), qName = zhUi ? q0.zh : q0.en;
        // 目标说明：quests.js 的中文 / 英文那两份，里面的名字照课程包的名字表换成这门课的写法（英文那份里有「Ms Rosa」）
        const goalExp = (QC.names || []).reduce((s, [a, b]) => s.split(a).join(b), zhUi ? q0.goalZh : q0.goal);
        // 词卡的意思：中文界面是 quests.js 的中文（讲英语的括号去掉），英语界面是那个英语词
        const wMean = w => (zhUi ? String(w[1]).replace(/\s*[（(][^（()）]*[A-Za-z][^（()）]*[）)]/g, '').trim() : w[2]);
        const { A, dlgNow, closeDlg, hook, marks, quests, face } = WT(p);
        await hook();
        const state = () => p.evaluate(() => { const s = EchoGame.S; return { coins: s.coins, ball: (s.mon.bag.superball || 0), flag: s.world.flags['q:q0-cap'] || 0, quests: EchoGame.dayLog().quests || 0, goals: EchoGame.dayLog().chatGoals || 0 }; });
        let mk = await marks(), qs = await quests();
        const ok3 = await p.evaluate(() => [EchoTalk.questOk(), EchoTalk.questOk('q0-cap'), EchoTalk.questOk('q0-visitor')]);
        // （小样的课程包只有这一条委托的内容；--real 17 条都有，第二条要先做完第一条所以还没有「?」）
        check(mk['4'] === true && Object.values(mk).filter(Boolean).length === 1 && ok3[0] && ok3[1] && ok3[2] === REAL, '委托：服务器会（questLangs）、课程包里有这一条（QUESTS）→ 委托人头上有「?」' + (REAL ? '' : '；课程包里没有内容的别的委托不出'), { mk, ok3 });
        const q0row = () => qs.find(q => q.id === 'q0-cap') || {};
        check(qs.length === (REAL ? QS.list.length : 1) && q0row().state === 'open' && q0row().seen, '委托本（EchoWorld.quests()）：' + (REAL ? '17 条都在' : '只有课程包里有内容的这一条') + '，第一条能接', qs);
        // 站到她跟前、面朝她
        const at = await face('4');
        const s0 = await state();
        await A();
        let d = await dlgNow();
        const mean0 = zhUi ? q0.ask[0][1] : q0.ask[0][0];
        check(!!at && !!d && d.en === tx(F.ask[0]) && d.zh === mean0 && d.name === rosa && d.hear && (L === 'es' ? !d.enHtml.includes('<ruby>') : d.enHtml.includes('<ruby>')),
          '按 A：委托人说请求——' + NAMES[L].zh + '的译文（' + tx(F.ask[0]).slice(0, 16) + '…）' + (L === 'es' ? '' : '带读音') + '，下面是界面语言的意思，名字牌是这门课的写法（' + rosa + '）', d);
        await shot(p, L + '-quest-ask');
        await A(); d = await dlgNow(); const ask2 = d && d.en;
        await A(); d = await dlgNow();
        check(ask2 === tx(F.ask[1]) && !!d && d.en === tx(F.ask[2]), '第二、三句请求也是译文', [ask2, d && d.en]);
        await A(); d = await dlgNow();
        check(!!d && d.btns.length === 2 && d.btns[0].includes(NAME) && !/英语|English/.test(d.btns.join('')) && d.name.includes(qName) && d.zh.includes(goalExp) && (zhUi || REAL || goalExp.includes(rosa)) && /🎁/.test(d.zh) && d.en === '' && !d.hear,
          '选项页：名字牌是委托的名字，下面是目标和奖励；按钮「用' + NAME + '帮 TA」（不写英语）；上面不放委托的英文名、没有 🔊', d);
        await shot(p, L + '-quest-choice');
        await p.setViewportSize({ width: 844, height: 390 }); await W(p, 400);
        await shot(p, L + '-quest-choice-land');
        const fit = await p.evaluate(() => [...document.querySelectorAll('#w-dlg [data-act=wPick]')].map(b => { const r = b.getBoundingClientRect(), s = b.querySelector('span') || b; return { in: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, cut: s.scrollWidth > b.clientWidth + 1 }; }));
        await p.setViewportSize({ width: 390, height: 844 }); await W(p, 300);
        const fit2 = await p.evaluate(() => [...document.querySelectorAll('#w-dlg [data-act=wPick]')].map(b => { const r = b.getBoundingClientRect(), s = b.querySelector('span') || b; return { in: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, cut: s.scrollWidth > b.clientWidth + 1 }; }));
        check(fit.concat(fit2).every(f => f.in && !f.cut), '两个按钮横屏、竖屏都在屏幕里，字没被挤出去', { fit, fit2 });
        // 用这门语言帮 TA → 聊天
        UP.npc.push(tx(QC.opener));
        await p.click('#w-dlg [data-act=wPick][data-i="0"]');
        const opened = await p.waitForSelector('#tk-mic:not([disabled])', { timeout: 8000 }).then(() => true).catch(() => false);
        await p.waitForFunction(() => document.querySelectorAll('#tk-log .tk-b.npc').length > 0 && !!document.querySelector('#tk-log .tk-b.npc')._text, null, { timeout: 6000 }).catch(() => {});
        await W(p, 300);
        const wq = opened ? lastWs(p) : new URLSearchParams();
        check(opened && wq.get('quest') === 'q0-cap' && wq.get('lang') === L && wq.get('npc') === 'dyn' && !wq.has('p') && wq.get('ui') === ui, '聊天的连接：quest=q0-cap&lang=' + L + '（只发委托的 id 和语言，人设由服务器拼）', opened ? [...wq.entries()].map(e => e.join('=')).join('&') : relayOut.slice(-300));
        if (opened) {
          const ov = await p.evaluate(() => {
            const strip = el => { const c = el.cloneNode(true); c.querySelectorAll('rt, small').forEach(x => x.remove()); return c.textContent.trim(); };
            return { head: document.querySelector('.tk-head').innerText, goal: document.querySelector('.tk-gt').innerText,
              steps: [...document.querySelectorAll('#tk-steps li span')].map(s => s.textContent), eg: [...document.querySelectorAll('#tk-steps li small')].map(s => { const c = s.cloneNode(true); c.querySelectorAll('rt').forEach(x => x.remove()); return { txt: c.textContent, html: s.innerHTML }; }),
              words: [...document.querySelectorAll('.tk-words .tk-w')].map(b => ({ t: strip(b), html: b.innerHTML, mean: (b.querySelector('small') || {}).textContent || '' })),
              npc: [...document.querySelectorAll('#tk-log .tk-b.npc')].map(b => ({ text: b._text || '', html: b.innerHTML })), mic: document.querySelector('#tk-mic').textContent, ai: (document.querySelector('#tk-ai') || {}).textContent || '' };
          });
          check(ov.head.includes(rosa) && ov.head.includes(qName) && ov.goal.includes(goalExp) && ov.mic.includes(NAME) && !!ov.ai, '聊天界面：委托人的名字（' + rosa + '）、委托的名字、目标说明按界面语言（里面的名字是这门课的写法），话筒写着' + NAME + '，AI 标识在', { head: ov.head, goal: ov.goal });
          check(ov.steps.length === q0.steps.length && ov.steps.every((s, k) => s === (zhUi ? q0.steps[k][0] : q0.steps[k][1])) && ov.eg.length === q0.steps.length && ov.eg.every((e, k) => e.txt.includes(tx(QC.steps[k]))),
            '小步骤：说明是 quests.js 的' + (zhUi ? '中文' : '英语原句') + '，示范句是课程包里' + NAMES[L].zh + '的那一句（' + tx(QC.steps[0]) + '）', { steps: ov.steps, eg: ov.eg.map(e => e.txt) });
          check(ov.words.length === QC.words.length && ov.words.every((w, k) => w.t === tx(QC.words[k][0]) && w.mean === wMean(QC.words[k])) && !ov.words.some(w => /[（(].*[A-Za-z]/.test(w.mean) && zhUi),
            '词卡：' + NAMES[L].zh + '的词，下面的意思按界面语言（' + wMean(QC.words[3]) + '——讲英语的括号去掉了）', ov.words.map(w => w.t + '|' + w.mean));
          if (L === 'es') check(!ov.words.some(w => w.html.includes('<ruby>')) && !ov.eg.some(e => e.html.includes('<ruby>')), '西语：词卡、示范句不标读音');
          else check(ov.words.filter(w => w.html.includes('<ruby>')).length >= 1 && ov.eg.every(e => e.html.includes('<ruby>')), NAMES[L].zh + '：词卡、示范句照课程包里写的读音标（<ruby>）', { w: ov.words.map(w => w.html).slice(0, 3), e: ov.eg[0].html });
          const ob = ov.npc[0] || { text: '', html: '' };
          check(ob.text === tx(QC.opener) && (L === 'es' ? !ob.html.includes('<ruby>') : ob.html.includes('<ruby>')), '委托人开口（假 AI 照着开场白说）' + (L === 'es' ? '' : '：带读音'), ob);
          const ins = UP.ins[UP.ins.length - 1] || '', voice = UP.voice[UP.voice.length - 1], srvOpen = (TCQ[L] && TCQ[L]['q0-cap'] && TCQ[L]['q0-cap'].opener) || '\u0000';
          check(ins.includes(q0.persona.slice(0, 80)) && (!X.en || ins.includes(X.en)) && ins.includes(srvOpen) && !/Speak ONLY in English/.test(ins) && /small game task/.test(ins) && /parent or a teacher/.test(ins),
            '服务器拼的人设：这条委托的事实（quests.js 的英文）、说 ' + (X.en || L) + '、开场白是 talk-courses.js 里这门语言的，委托的规矩和安全规则都在', ins.slice(0, 220));
          check(!!voice && !['Jennifer', 'Aiden', 'Mione'].includes(voice), '音色是这门语言的（' + voice + '）', voice);
          // 说到词卡上的词：西语不看冠词（la gorra / una gorra）；日语按读音（词卡 ぼうし，听到的写成 帽子）
          const first = { es: 'Es una gorra azul del dueño.', ja: '帽子の持ち主の名前は何ですか', zh: '他的帽子在哪里？' }[L];
          await speak(p, first, []);
          const hit = await p.evaluate(() => [...document.querySelectorAll('.tk-w.hit')].map(b => +b.dataset.i));
          check(hit.includes(1), '说到词卡上的词（' + tx(QC.words[1][0]) + '；听到的是「' + first + '」）：卡片变绿' + (L === 'es' ? '——不看冠词' : L === 'ja' ? '——按读音比' : ''), hit);
          await speak(p, tx(QC.steps[0]), [1]);
          await p.waitForSelector('#tk-steps li.ok', { timeout: 4000 }).catch(() => {});
          const sp = p.posts.filter(x => x.path === '/steps').map(x => JSON.parse(x.body)).pop() || {};
          check(sp.q === 'q0-cap' && sp.lang === L && sp.npc === 'dyn' && await p.locator('#tk-steps li.ok').count() === 1, '打勾的请求带委托的 id 和语言（q = q0-cap、lang = ' + L + '），做到一步打一个勾', sp);
          await shot(p, L + '-quest-chat');
          await p.setViewportSize({ width: 844, height: 390 }); await W(p, 350);
          await shot(p, L + '-quest-chat-land');
          await p.setViewportSize({ width: 390, height: 844 }); await W(p, 250);
          await speak(p, tx(QC.steps[1]), [1, 2]);
          await speak(p, tx(QC.steps[2]), [1, 2, 3]);
          UP.evalResp = { steps: [true, true, true], done: true, stars: 3, praise: zhUi ? '问得真清楚！' : 'You asked very clearly!', tips: [], memory: [], concern: false, concernWhy: '' };
          await endChat(p);
          const evq = await p.evaluate(() => ({ txt: (document.querySelector('.tk-eval') || {}).innerText || '', close: !!document.querySelector('.tk-eval [data-act=talk_close]'), again: !!document.querySelector('.tk-eval [data-act=talk_again]') }));
          let s1 = await state();
          check(/★★★/.test(evq.txt) && evq.txt.includes(rosa) && evq.close && !evq.again && s1.flag === 0 && s1.goals === s0.goals + 1, '评语页：3 星、「委托完成了，' + rosa + ' 有奖励给你」，只有「回去领奖励」；聊天目标 +1，奖励要回地图才给', { txt: evq.txt.slice(0, 160), s1 });
          await shot(p, L + '-quest-eval');
          await p.click('.tk-eval [data-act=talk_close]'); await W(p, 500);
          d = await dlgNow(); s1 = await state();
          check(!(await p.$('#tk-ov')) && !!d && d.en === tx(F.thanks[0]) && d.name === rosa && d.zh === (zhUi ? q0.thanks[0][1] : q0.thanks[0][0]), '回到地图：委托人道谢，是' + NAMES[L].zh + '的译文（下面是界面语言的意思）', d);
          check(s1.flag === 3 && s1.ball === s0.ball + 2 && s1.coins === s0.coins + 50 + 25 && s1.quests === s0.quests + 1, '结果当场存好：world.flags["q:q0-cap"] = 3、金回声球 +2、金币 +50（另有聊天的 25）、今天完成 1 条', { s0, s1 });
          await shot(p, L + '-quest-thanks');
          await A(); d = await dlgNow();
          check(!!d && d.en === tx(F.thanks[1]), '第二句感谢也是译文', d && d.en);
          await closeDlg();
          const sv = await p.evaluate(l => { EchoGame.flush(); return { own: (JSON.parse(localStorage.getItem('echo-island-v1@' + l)).world.flags || {})['q:q0-cap'] || 0, en: (JSON.parse(localStorage.getItem('echo-island-v1')).world.flags || {})['q:q0-cap'] || 0 }; }, L);
          mk = await marks(); qs = await quests();
          check(sv.own === 3 && sv.en === 0 && mk['4'] === false && q0row().state === 'done' && q0row().stars === 3, '存在这门课自己的存档里（英语的存档里没有）；「?」没了，委托本里是做完了、3 星', { sv, mk, q: q0row() });
          // 再找她：先说一句近况（译文），不再给委托、不再给奖励
          await A(); d = await dlgNow();
          const s2a = await state();
          check(!!d && d.en === tx(F.bye) && !d.btns.length, '做完以后再按 A：她说一句近况（译文），没有委托的选项', d);
          await closeDlg();
          const s2 = await state();
          check(s2.coins === s1.coins && s2.ball === s1.ball && s2.flag === 3 && s2a.quests === s1.quests, '不能重做刷星：奖励只给一次', { s1, s2 });
          // 委托本
          await p.evaluate(() => document.querySelector('#world [data-act=wB]').click()); await W(p, 300);
          await p.click('#sheet [data-act=wQuests]'); await W(p, 300);
          const qsheet = await p.evaluate(() => document.querySelector('#sheet').innerText);
          check(qsheet.includes(rosa) && qsheet.includes(qName) && qsheet.includes(NAME) && !/用英语|in English/.test(qsheet) && /★★★/.test(qsheet), '冒险菜单的委托本：这一条做完了（★★★），找谁写的是这门课的名字，说明里写的是' + NAME, qsheet.slice(0, 200));
          await shot(p, L + '-quest-book');
          await p.evaluate(() => EchoGame.closeModal());
        }
        // 西语的词卡不看冠词；别的语言照旧（日语的规矩在 lang-ja.js，tests/lang.test.js 查）
        if (L === 'es') {
          const wh = await p.evaluate(() => { const H = (w, t) => EchoTalk._wordHit(w, t, 'es'); return [H('la gorra', 'Tengo una gorra azul.'), H('el dueño', 'Conozco al dueño.'), H('al lado de', 'Vive al lado del parque.'), H('¿Dónde está…?', '¿Dónde está Ben ahora?'), H('las piernas', 'Tengo unas piernas largas'),
            H('la gorra', 'Tengo un gorro.'), H('él', 'El perro es grande.'), H('él', 'Él es mi amigo.'), H('…', 'hola'), H('el nombre', 'Mi nombre es Ana')]; });
          check(JSON.stringify(wh) === JSON.stringify([true, true, true, true, true, false, false, true, false, true]), '西语词卡变绿的判断：冠词不算词（la gorra / una gorra、el dueño / al dueño）、del / al 当成 de / a、「…」「¿」不算词；别的词不乱对（gorra ≠ gorro，él ≠ el）', wh);
        }
      }

      // ---------- 9 AI 发音点评（第二轮）：口语题没念准，服务器会用这门语言写点评 → 请求带 lang，点评显示出来 ----------
      {
        const sent = C[L].WORLDS[0].sents[0][0], wrong = C[L].WORLDS[0].sents[1][0];
        UP.tip = zhUi ? '你读的好像是另一句话，先点喇叭听一遍原句再读' : 'It sounds like a different sentence. Tap the speaker and listen first.';
        UP.sys.length = 0;
        await p.evaluate(([s, w]) => {
          window.__heard = [w];
          EchoTalk.listenOnce = async o => { const t = window.__heard.length ? window.__heard.shift() : ''; if (o.onState) o.onState(t); return { text: t, err: t ? null : 'no-speech', how: 'done' }; };
          EchoGame.S.settings.mode = 'auto';
          EchoWorld._debug().talk([{ who: 'Kai', en: s, zh: '', kind: 'speak', target: s }]);
        }, [sent, wrong]);
        await W(p, 400);
        const tipOk = await p.evaluate(() => EchoTalk.tipOk());
        await p.click('#w-dlg [data-act=wMic]');
        const got = await p.waitForSelector('#w-heard .ai-tip', { timeout: 6000 }).then(() => true).catch(() => false);
        const tp = p.posts.filter(x => x.path === '/tip').map(x => JSON.parse(x.body)).pop() || {}, ts = UP.sys.filter(x => x.kind === 'tip').pop() || { sys: '' };
        const tipTxt = got ? await p.textContent('#w-heard .ai-tip') : '';
        check(tipOk && got && tipTxt.includes(UP.tip) && /AI/.test(tipTxt), '口语题没念准：AI 发音点评显示出来（标着 AI）', tipTxt);
        check(tp.target === sent && tp.heard === wrong && tp.lang === L && (zhUi ? tp.ui === undefined : tp.ui === ui), '点评的请求带 lang = ' + L + '（目标句子、听到的话、界面语言）', tp);
        check(ts.sys.includes(sent) && ts.sys.includes(zhUi ? X.zh || '\u0000' : X.en || '\u0000') && !/初中英语发音老师|learner of English/.test(ts.sys), '服务器给点评的提示词说的是' + (zhUi ? X.zh : X.en) + '（不是英语的那一份）', ts.sys.slice(0, 120));
        await shot(p, L + '-tip');
        await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; EchoGame.closeModal(); EchoGame.goHome('mon'); });
        await W(p, 300);
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

      // 第二轮：服务器会聊（talkLangs），可是没有 questLangs / tipLangs（第一轮的服务器）→ 聊天照开，委托人头上没有「?」、口语题没有点评
      STUB.langs = ['en', 'es']; STUB.quest = undefined; STUB.tip = undefined; STUB.posts.length = 0;
      await p.evaluate(() => EchoTalk.langAsk());
      await p.waitForFunction(() => EchoTalk.langOk(), null, { timeout: 6000 }).catch(() => {});
      const r1 = await p.evaluate(() => ({ talk: EchoTalk.langOk(), quest: EchoTalk.questOk(), q0: EchoTalk.questOk('q0-cap'), tip: EchoTalk.tipOk(), cache: localStorage.getItem('echo-talk-langs') }));
      check(r1.talk && !r1.quest && !r1.q0 && !r1.tip && Object.keys(JSON.parse(r1.cache)).join() === 'u,l', '第一轮的服务器（有 talkLangs，没有 questLangs / tipLangs）：聊天开着，委托和点评照旧关着（记下来的样子也和第一轮一样）', r1);
      await p.evaluate(() => { EchoGame.S.settings.learner = 'open'; EchoGame.S.settings.gate = false; EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); });
      await p.click('[data-act=wEnter]'); await W(p, 1300);
      const wt = WT(p);
      await wt.hook();
      const mk0 = await wt.marks(), qs0 = await wt.quests();
      check(Object.keys(mk0).length > 3 && !Object.values(mk0).some(Boolean) && qs0.length === 0, '……大地图上没有人头上有「?」，委托本是空的', { mk0, qs0 });
      await wt.face('4'); await wt.A();
      const d0 = await wt.dlgNow();
      check(!!d0 && d0.en !== QD('es').ask[0] && !d0.btns.length, '……按 A：她说的是平常的话，不是委托', d0);
      await wt.closeDlg();
      const sent0 = C.es.WORLDS[0].sents[0][0], wrong0 = C.es.WORLDS[0].sents[1][0];
      await p.evaluate(([s, w]) => {
        window.__heard = [w];
        EchoTalk.listenOnce = async o => { const t = window.__heard.length ? window.__heard.shift() : ''; if (o.onState) o.onState(t); return { text: t, err: t ? null : 'no-speech', how: 'done' }; };
        EchoGame.S.settings.mode = 'auto';
        EchoWorld._debug().talk([{ who: 'Kai', en: s, zh: '', kind: 'speak', target: s }]);
      }, [sent0, wrong0]);
      await W(p, 400);
      await p.click('#w-dlg [data-act=wMic]'); await W(p, 1500);
      const tip0 = await p.evaluate(() => ({ heard: (document.querySelector('#w-heard') || {}).textContent || '', tip: !!document.querySelector('#w-heard .ai-tip') }));
      check(!!tip0.heard && !tip0.tip && !p.posts.some(x => x.path === '/tip') && !STUB.posts.some(x => /tip/.test(x)), '……口语题没念准：照旧没有 AI 点评，也不去问服务器', { tip0, posts: STUB.posts });
      // 服务器后来会了（questLangs / tipLangs 有这门语言）：问到以后「?」就出来了（不用重新打开）
      STUB.quest = ['en', 'es']; STUB.tip = ['en', 'es'];
      await p.evaluate(() => { EchoGame.S.settings.mode = 'self'; EchoGame.closeModal(); });
      await wt.closeDlg();
      await p.evaluate(() => EchoTalk.langAsk());
      await p.waitForFunction(() => EchoTalk.questOk('q0-cap') && EchoTalk.tipOk(), null, { timeout: 6000 }).catch(() => {});
      await W(p, 900);
      const mk1 = await wt.marks(), c1 = await p.evaluate(() => JSON.parse(localStorage.getItem('echo-talk-langs')));
      check(mk1['4'] === true && c1.q.includes('es') && c1.t.includes('es'), '服务器后来说会了（/health 多了 questLangs / tipLangs）：记下来，委托人头上的「?」出来了', { mk1, c1 });
      // 委托的连接被服务器拒了（lang）：照「还在做」说，只把委托改回不会，聊天照旧
      await wt.face('4'); await wt.A(); await wt.A(); await wt.A(); await wt.A();
      const talks0 = STUB.talks;
      await p.click('#w-dlg [data-act=wPick][data-i="0"]').catch(() => {});
      await p.waitForFunction(() => /还在做/.test((document.querySelector('#tk-status') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
      const st4 = await p.evaluate(() => ({ status: (document.querySelector('#tk-status') || {}).textContent || '', err: EchoGame.dayLog().chatErr || '' }));
      await closeChat(p); await W(p, 700);
      STUB.quest = undefined;   // 重新问到的也是不会
      await p.evaluate(() => EchoTalk.langAsk());
      await p.waitForFunction(() => !EchoTalk.questOk(), null, { timeout: 6000 }).catch(() => {});
      const r4 = await p.evaluate(() => ({ talk: EchoTalk.langOk(), quest: EchoTalk.questOk(), flag: EchoGame.S.world.flags['q:q0-cap'] || 0 }));
      check(STUB.talks === talks0 + 1 && /这门语言的 AI 聊天还在做/.test(st4.status) && !st4.err && r4.talk && !r4.quest && !r4.flag, '委托的连接被服务器拒了（lang）：状态行写「还在做」、不记成连不上；之后委托按不会算，聊天照旧开着，委托没完成', { st4, r4 });
      await wt.closeDlg();
      await ctx.close();

      // 第二轮：老的课程包（course.json 里没有 QUESTS）+ 新的服务器 → 委托照旧不出
      {
        const c0 = await openGame({ talk: RELAY, packs: 'packs0' });
        await toCourse(c0.p, L);
        await c0.p.evaluate(() => EchoTalk.langAsk());
        await c0.p.waitForFunction(() => EchoTalk.langOk(), null, { timeout: 6000 }).catch(() => {});
        await c0.p.evaluate(() => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome('mon'); });
        await c0.p.click('[data-act=wEnter]'); await W(c0.p, 1300);
        const w0 = WT(c0.p);
        await w0.hook();
        const r0 = await c0.p.evaluate(() => ({ talk: EchoTalk.langOk(), q0: EchoTalk.questOk('q0-cap'), tip: EchoTalk.tipOk() })), m0 = await w0.marks(), q0s = await w0.quests();
        check(r0.talk && !r0.q0 && r0.tip && Object.keys(m0).length > 3 && !Object.values(m0).some(Boolean) && q0s.length === 0, '老的课程包（没有 QUESTS）+ 新的服务器：聊天、点评开着，委托照旧不出（没有「?」）', { r0, m0, q0s });
        await c0.ctx.close();
      }

      // 云端模式：看账号（GET /v1/me 的缓存）里的 talkLangs；老服务器没有这个字段、没登录 = 不会
      // 第二轮：委托、点评看账号的 questLangs / tipLangs（expQ）——第一条是第一轮的服务器（会聊，没有这两个字段），第二条是都有的
      for (const [me, exp, what, expQ] of [[{ plan: 'free', ageGroup: 'adult', features: {}, quota: { talk: { leftSec: 300, limitSec: 300 } }, talkLangs: ['en', 'es', 'ja', 'zh'] }, true, '账号里的 talkLangs 有这门语言：聊天开着（没有 questLangs / tipLangs：委托、点评照旧关着）', false],
        [{ plan: 'free', ageGroup: 'adult', features: {}, quota: { talk: { leftSec: 300, limitSec: 300 } }, talkLangs: ['en', 'es'], questLangs: ['en', 'es'], tipLangs: ['en', 'es'] }, true, '账号里 talkLangs、questLangs、tipLangs 都有这门语言：聊天、委托、点评都开着', true],
        [{ plan: 'free', ageGroup: 'adult', features: {}, quota: { talk: { leftSec: 300, limitSec: 300 } }, speechLangs: ['en', 'es'] }, false, '老服务器（没有 talkLangs）：照旧「还在做」', false], [null, false, '没登录（不知道服务器会不会）：照旧「还在做」', false]]) {
        const c2 = await openGame({ init: me => { window.ECHO_CLOUD_URL = 'http://127.0.0.1:9'; if (me) { localStorage.setItem('echo-cloud-token', 'tok-test'); localStorage.setItem('echo-cloud-me', JSON.stringify(me)); } }, initArg: me });
        await toCourse(c2.p, L, { learner: 'kid', gate: true });
        await talkTab(c2.p);
        const r = await c2.p.evaluate(() => ({ cloud: EchoCloud.on, tl: EchoAccount.talkLang('es'), en: EchoAccount.talkLang('en'), ok: EchoTalk.langOk(), home: document.querySelector('.tk-home').innerText, cards: document.querySelectorAll('.tk-home .tk-card').length, g: EchoGame.gate(),
          q: [EchoAccount.questLang('es'), EchoAccount.questLang('en'), EchoAccount.questLang('ja'), EchoTalk.questOk(), EchoTalk.questOk('q0-cap')], t: [EchoAccount.tipLang('es'), EchoAccount.tipLang('en'), EchoTalk.tipOk()] }));
        check(r.cloud && r.en === true && r.tl === exp && r.ok === exp && (exp ? r.cards === 8 && !/还在做/.test(r.home) && r.g.exWhy !== 'lang' : r.cards === 0 && /还在做/.test(r.home) && r.g.exWhy === 'lang'), '云端模式 · ' + what, { tl: r.tl, ok: r.ok, cards: r.cards, ex: r.g.exWhy });
        check(JSON.stringify(r.q) === JSON.stringify([expQ, true, false, expQ, expQ]) && JSON.stringify(r.t) === JSON.stringify([expQ, true, expQ]), '云端模式 · 委托 / 点评' + (expQ ? '开着（EchoAccount.questLang / tipLang）' : '关着'), { q: r.q, t: r.t });
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
