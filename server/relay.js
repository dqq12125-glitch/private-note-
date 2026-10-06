// 回声岛 AI 语音对话中转服务
// 孩子的浏览器 ⇄ 这里（WebSocket）⇄ 阿里云百炼 Qwen-Omni 实时语音（WebSocket，带密钥）
// - 密钥只在这里：环境变量 DASHSCOPE_API_KEY，或 KEY_FILE 指向一个写着 DASHSCOPE_API_KEY=... 的文件（默认 server/.env）
// - 人设、音色、安全规则都由服务器按 npc id 从 ../talk-npcs.js 读，孩子的手机只能选 npc、送声音/文字
// - 每台设备每天有时长上限，每段对话有时长上限；对话记录写到 server/logs/日期.jsonl，家长看 /logs
// 启动：cd server && npm install && node relay.js   （默认端口 8787；PORT 可改）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const NPCS = require('../talk-npcs.js');
const CORE = require('../talk-core.js');   // 人设、安全规则、事件翻译：和安卓 APK 直连模式共用

// ---------- 配置 ----------
function readEnvFile(p) {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) {}
  return out;
}
const FILE = readEnvFile(process.env.KEY_FILE || path.join(__dirname, '.env'));
const cfg = k => process.env[k] || FILE[k];
const KEY = cfg('DASHSCOPE_API_KEY');
const PORT = +(cfg('PORT') || 8787);
const MODEL = cfg('TALK_MODEL') || CORE.MODEL;
const UPSTREAM = (cfg('TALK_URL') || CORE.REALTIME_URL) + '?model=' + encodeURIComponent(MODEL);
const EVAL_URL = cfg('EVAL_BASE_URL') ? cfg('EVAL_BASE_URL') + '/chat/completions' : CORE.EVAL_URL;
const EVAL_MODEL = cfg('EVAL_MODEL') || CORE.EVAL_MODEL;
const DAILY_MIN = +(cfg('DAILY_MIN') || 30);        // 每台设备每天最多聊几分钟
const SESSION_MIN = +(cfg('SESSION_MIN') || 8);     // 每段对话最多几分钟
const MAX_LIVE = +(cfg('MAX_LIVE') || 4);           // 同时最多几段对话
const ACCESS_CODE = cfg('ACCESS_CODE') || '';       // 设了就要在游戏设置里填同样的家庭口令
const ADMIN_TOKEN = cfg('ADMIN_TOKEN') || '';       // 看对话记录用；没设只允许本机看
const ORIGINS = (cfg('ALLOWED_ORIGINS') || 'http://localhost,http://127.0.0.1,https://dqq12125-glitch.github.io,.ts.net,.trycloudflare.com').split(',').map(s => s.trim()).filter(Boolean);
if (!KEY) { console.error('没有找到 DASHSCOPE_API_KEY（环境变量或 KEY_FILE / server/.env）'); process.exit(1); }

// ---------- 用量（每台设备每天的秒数），存盘防重启清零 ----------
const USAGE_FILE = path.join(__dirname, 'usage.json');
let usage = {};
try { usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); } catch (e) {}
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
const usedSec = dev => (usage[today()] || {})[dev] || 0;
function addUsage(dev, sec) {
  const d = today();
  for (const k of Object.keys(usage)) if (k < d) delete usage[k];   // 只留今天
  usage[d] = usage[d] || {};
  usage[d][dev] = (usage[d][dev] || 0) + sec;
  try { fs.writeFileSync(USAGE_FILE, JSON.stringify(usage)); } catch (e) {}
}

// ---------- 对话记录 ----------
const LOG_DIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
function writeLog(rec) {
  try { fs.appendFileSync(path.join(LOG_DIR, today() + '.jsonl'), JSON.stringify(rec) + '\n'); } catch (e) {}
}

// ---------- 调试：DEBUG_AUDIO=1 时把孩子每次说的话存成 wav（server/debug/），查「识别出来的字和说的不一样」用 ----------
const DEBUG_AUDIO = /^(1|true|yes)$/i.test(cfg('DEBUG_AUDIO') || '');
const DEBUG_DIR = path.join(__dirname, 'debug');
function saveWav(chunks, dev, npc) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const pcm = Buffer.concat(chunks), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(path.join(DEBUG_DIR, Date.now() + '-' + dev + '-' + npc + '.wav'), Buffer.concat([h, pcm]));
  } catch (e) {}
}

// ---------- 人设 / 评价：在 talk-core.js ----------
// 大地图上随便一个人：游戏把名字、身份、所在的岛、他说过的话（base64url JSON）发过来，talk-core 拼成人设
function personNpc(p) {
  let d;
  try { d = JSON.parse(Buffer.from(String(p || ''), 'base64url').toString('utf8')); } catch (e) { return null; }
  return CORE.personNpc(d);
}
async function evaluate(npc, turns) {
  // 聊完后让文字模型给个温和的评价（中文），失败就不给
  const body = CORE.evalBody(npc, turns);
  if (!body) return null;
  body.model = EVAL_MODEL;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(tm);
    return CORE.parseEval(await r.json());
  } catch (e) { console.log('eval failed', e.message); return null; }
}

// ---------- HTTP：健康检查、家长看记录 ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 本机直接打开才算本机：经过 Tailscale / Cloudflare 隧道转过来的请求虽然也是 127.0.0.1，但带着转发头
const isLocal = req => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'] && !req.headers['tailscale-user-login'];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ ok: true, model: MODEL, code: !!ACCESS_CODE, npcs: NPCS.list.map(n => n.id) }));
  }
  if (u.pathname === '/logs') {
    if (ADMIN_TOKEN ? u.searchParams.get('token') !== ADMIN_TOKEN : !isLocal(req)) { res.writeHead(403); return res.end('forbidden'); }
    const d = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('date') || '') ? u.searchParams.get('date') : today();
    let rows = [];
    try { rows = fs.readFileSync(path.join(LOG_DIR, d + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) {}
    const days = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl')).map(f => f.slice(0, 10)).sort().reverse();
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>回声岛对话记录</title>' +
      '<style>body{font:15px/1.6 system-ui,sans-serif;margin:16px;max-width:760px}h2{margin:18px 0 4px}.t{color:#666;font-size:13px}.you{color:#1565c0}.npc{color:#2e7d32}.card{border:1px solid #ddd;border-radius:10px;padding:10px 14px;margin:10px 0}</style>' +
      '<h1>回声岛 · AI 对话记录</h1><p>' + days.map(x => x === d ? '<b>' + x + '</b>' : '<a href="?date=' + x + (ADMIN_TOKEN ? '&token=' + encodeURIComponent(ADMIN_TOKEN) : '') + '">' + x + '</a>').join(' · ') + '</p>' +
      (rows.length ? rows.map(r => '<div class="card"><h2>' + esc(r.npcZh || r.npc) + '</h2><div class="t">' + esc(r.start) + ' · ' + Math.round(r.sec) + ' 秒 · 设备 ' + esc(r.dev) + (r.eval ? ' · ' + '★'.repeat(r.eval.stars) + (r.eval.done ? ' · 完成目标' : '') : '') + '</div>' +
        r.turns.map(t => '<div class="' + t.who + '">' + (t.who === 'you' ? '孩子：' : esc(r.npcName) + '：') + esc(t.text) + '</div>').join('') +
        (r.eval && r.eval.tips.length ? '<div class="t">建议：' + r.eval.tips.map(t => esc(t.said) + ' → ' + esc(t.better) + '（' + esc(t.zh) + '）').join('；') + '</div>' : '') + '</div>').join('') : '<p>这一天没有对话。</p>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
  }
  if (req.method === 'OPTIONS' && (u.pathname === '/asr' || u.pathname === '/tip' || u.pathname === '/tts')) {   // 跨域预检（GitHub Pages 上的网页版连家里的中转服务）
    let ok = false; try { ok = !!req.headers.origin && okOrigin(req.headers.origin); } catch (e) {}
    res.writeHead(ok ? 204 : 403, ok ? { 'Access-Control-Allow-Origin': req.headers.origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : {});
    return res.end();
  }
  if (req.method === 'POST' && (u.pathname === '/asr' || u.pathname === '/tip' || u.pathname === '/tts')) return cloudHelp(u, req, res);
  if (SERVE_GAME && (req.method === 'GET' || req.method === 'HEAD')) return serveGame(u, req, res);
  res.writeHead(404); res.end();
});

// ---------- 网页版的口语打分：/asr 录音 → 文字（qwen3-asr-flash，不给答案，听到什么写什么），/tip 目标句子 + 听到的 → 一句中文建议 ----------
// APK 直连阿里云不走这里。要家庭口令；每个 IP 每分钟最多 40 次
const hits = new Map();
function cloudHelp(u, req, res) {
  const cors = { 'Access-Control-Allow-Origin': req.headers.origin && okOrigin(req.headers.origin) ? req.headers.origin : 'null', 'Content-Type': 'application/json' };
  const bad = (c, m) => { res.writeHead(c, cors); res.end(JSON.stringify({ error: m })); };
  try { if (req.headers.origin && !okOrigin(req.headers.origin)) return bad(403, 'origin'); } catch (e) { return bad(403, 'origin'); }
  if (ACCESS_CODE && u.searchParams.get('code') !== ACCESS_CODE) return bad(403, 'code');
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '?', now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (h.length >= 40) return bad(429, 'busy'); h.push(now); hits.set(ip, h);
  let body = '', size = 0;
  req.on('data', c => { size += c.length; if (size > 3e6) { req.destroy(); return; } body += c; });
  req.on('end', async () => {
    let j; try { j = JSON.parse(body); } catch (e) { return bad(400, 'json'); }
    const call = async b => {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
      try { const r = await fetch(CORE.EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: ctl.signal }); return await r.json(); } finally { clearTimeout(tm); }
    };
    try {
      if (u.pathname === '/asr') {
        if (typeof j.audio !== 'string' || j.audio.length < 1000) return bad(400, 'audio');
        const r = await call({ model: 'qwen3-asr-flash', stream: false, asr_options: { language: 'en', enable_itn: false }, messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + j.audio } }] }] });
        res.writeHead(200, cors); return res.end(JSON.stringify({ text: String((r.choices && r.choices[0].message.content) || '').trim() }));
      }
      if (u.pathname === '/tts') {   // 网页版：没有提前配音的句子现场合成
        const text = clean(j.text, 300); if (!text) return bad(400, 'text');
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
        try {
          const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text, voice: j.g === 'm' ? 'Ethan' : 'Cherry', language_type: 'English' } }), signal: ctl.signal });
          const o = await r.json(), url = o.output && o.output.audio && o.output.audio.url;
          res.writeHead(url ? 200 : 502, cors); return res.end(JSON.stringify({ url: url || '' }));
        } finally { clearTimeout(tm); }
      }
      const target = clean(j.target, 200), heard = clean(j.heard, 200);
      if (!target || !heard) return bad(400, 'text');
      const sys = '你是一位耐心的初中英语发音老师。学生要大声说的英文是：「' + target + '」。语音识别听到学生说的是：「' + heard + '」。用一句简体中文（不超过 28 个字）具体指出最主要的问题（哪个词读错、漏读或读成了别的词，可能是哪个音没发好），并告诉他怎么读对。如果听到的和目标几乎不是同一句话（大部分词都对不上），就只说「你读的好像是另一句话，先点喇叭听一遍原句再读」。不要表扬、不要客套，只输出这一句话。';
      const r = await call({ model: EVAL_MODEL, temperature: 0.2, max_tokens: 80, messages: [{ role: 'system', content: sys }, { role: 'user', content: '请点评。' }] });
      res.writeHead(200, cors); res.end(JSON.stringify({ tip: String((r.choices && r.choices[0].message.content) || '').trim().slice(0, 60) }));
    } catch (e) { bad(502, 'upstream'); }
  });
}
const clean = (v, n) => String(v || '').replace(/[^\p{L}\p{N} .,!?'"’:;()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- 可选：顺便把游戏网页也放出来（家里用 Tailscale 试的时候，一个服务就够）----------
// SERVE_GAME=1 时从仓库根目录读文件；每次都让浏览器回来确认有没有新版本（no-cache + ETag），改了代码刷新就是新的
const SERVE_GAME = /^(1|true|yes)$/i.test(cfg('SERVE_GAME') || '');
const GAME_ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.apk': 'application/vnd.android.package-archive' };
function serveGame(u, req, res) {
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(GAME_ROOT, '.' + rel);
  // 只放游戏文件：不许跳出仓库，不许读 server/、tools/、art/、node_modules、隐藏文件
  if (!file.startsWith(GAME_ROOT + path.sep) || /[\\/](server|tools|art|node_modules|tests)[\\/]|[\\/]\./.test(file.slice(GAME_ROOT.length))) { res.writeHead(404); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
    const etag = '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
    const head = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    head['Accept-Ranges'] = 'bytes';
    // 断点续传（下载大文件——比如给家长的 APK——网络断了能接着下）
    const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (rg && (rg[1] || rg[2])) {
      let a = rg[1] ? +rg[1] : Math.max(0, st.size - +rg[2]), b = rg[1] && rg[2] ? Math.min(+rg[2], st.size - 1) : st.size - 1;
      if (a >= st.size || a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, Object.assign(head, { 'Content-Length': b - a + 1, 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size }));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- WebSocket：一段对话 ----------
// 两个 WebSocket 共用这个端口：/talk 和岛民聊天，/asr-rt 口语题的实时识别
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const asrWss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
server.on('upgrade', (req, socket, head) => {
  let p = ''; try { p = new URL(req.url, 'http://x').pathname; } catch (e) {}
  const w = p === '/talk' ? wss : p === '/asr-rt' ? asrWss : null;
  if (!w) { socket.destroy(); return; }
  w.handleUpgrade(req, socket, head, ws => w.emit('connection', ws, req));
});

// ---------- WebSocket：口语题的实时识别（网页版；APK 用原生桥直连） ----------
// 带着密钥连阿里云 qwen3-asr-flash-realtime，边说边回文字。只转发听写要用的几种消息（设置里只认停顿长度），
// 一次最多 15 秒、最多 15 秒的声音，同一个地址每分钟最多 40 次（和 /asr 一起算）
const ASR_RT_URL = CORE.REALTIME_URL + '?model=qwen3-asr-flash-realtime';
asrWss.on('connection', (cli, req) => {
  const u = new URL(req.url, 'http://x');
  const bye = () => { try { cli.close(); } catch (e) {} };
  try { if (req.headers.origin && !okOrigin(req.headers.origin)) return bye(); } catch (e) { return bye(); }
  if (ACCESS_CODE && u.searchParams.get('code') !== ACCESS_CODE) return bye();
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '?', now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (h.length >= 40) return bye(); h.push(now); hits.set(ip, h);
  const up = new WebSocket(ASR_RT_URL, { headers: { Authorization: 'Bearer ' + KEY } });
  const q = []; let bytes = 0;
  const end = () => { clearTimeout(kill); try { up.close(); } catch (e) {} bye(); };
  const kill = setTimeout(end, 15000);
  up.on('open', () => { q.forEach(x => up.send(x)); q.length = 0; });
  up.on('message', d => { if (cli.readyState === WebSocket.OPEN) cli.send(d.toString()); });
  up.on('close', end);
  up.on('error', e => { console.log('asr-rt upstream error', e.message); end(); });
  cli.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    let out = null;
    if (m.type === 'session.update') {
      const td = (m.session && m.session.turn_detection) || {};
      out = { type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: 'en' },
        turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: Math.max(300, Math.min(1200, +td.silence_duration_ms || 600)) } } };
    } else if (m.type === 'input_audio_buffer.append' && typeof m.audio === 'string') {
      bytes += m.audio.length; if (bytes > 700000) return end();   // 15 秒 16kHz PCM 的 base64 ≈ 640KB
      out = { type: m.type, audio: m.audio };
    } else if (m.type === 'session.finish') out = { type: m.type };
    if (!out) return;
    const x = JSON.stringify(out);
    if (up.readyState === WebSocket.OPEN) up.send(x); else if (up.readyState === WebSocket.CONNECTING) q.push(x);
  });
  cli.on('close', end);
});
let live = 0;
const okOrigin = o => !o || ORIGINS.some(a => a.startsWith('.') ? new URL(o).hostname.endsWith(a) : o === a || o.startsWith(a + ':'));

wss.on('connection', (cli, req) => {
  const u = new URL(req.url, 'http://x');
  const send = m => { if (cli.readyState === WebSocket.OPEN) cli.send(JSON.stringify(m)); };
  const fail = (zh, code) => { send({ type: 'error', code, zh }); cli.close(); };
  let origin = req.headers.origin; try { if (origin && !okOrigin(origin)) return fail('这个网页不能用对话服务', 'origin'); } catch (e) { return fail('这个网页不能用对话服务', 'origin'); }
  if (ACCESS_CODE && u.searchParams.get('code') !== ACCESS_CODE) return fail('家庭口令不对，请在设置里填好', 'code');
  const npc = u.searchParams.get('npc') === 'dyn' ? personNpc(u.searchParams.get('p')) : NPCS.byId[u.searchParams.get('npc')];
  if (!npc) return fail('没有这个岛民', 'npc');
  const dev = (u.searchParams.get('dev') || 'unknown').replace(/[^\w-]/g, '').slice(0, 40) || 'unknown';
  const player = (u.searchParams.get('name') || '').replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16);
  const left = DAILY_MIN * 60 - usedSec(dev);
  if (left < 20) return fail('今天的聊天时间用完了，明天再来吧！', 'daily');
  if (live >= MAX_LIVE) return fail('对话服务有点忙，过一会儿再试', 'busy');
  live++;

  const start = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const limitSec = Math.min(SESSION_MIN * 60, left);
  let rec = [];
  const up = new WebSocket(UPSTREAM, { headers: { Authorization: 'Bearer ' + KEY } });
  const S = CORE.session({
    npc, player, limitSec, leftSec: left,
    up: m => { if (up.readyState === WebSocket.OPEN) up.send(JSON.stringify(m)); },
    out: send,
    evaluate,
    onEnd: ({ turns, sec, eval: ev }) => {
      try { up.close(); } catch (e) {}
      addUsage(dev, sec); live--;
      writeLog({ start, dev, npc: npc.id, npcName: npc.name, npcZh: npc.zh, sec, turns, eval: ev });
      setTimeout(() => { try { cli.close(); } catch (e) {} }, 300);
    },
    log: DEBUG_AUDIO ? (...a) => console.log(...a) : null,
  });
  const finish = () => S.finish();
  up.on('open', () => S.start());
  up.on('message', buf => { let m; try { m = JSON.parse(buf); } catch (e) { return; } S.fromUp(m); });
  up.on('close', () => S.upClosed());
  up.on('error', e => { console.log('upstream ws error', e.message); S.upClosed('连不上对话服务'); });
  cli.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (DEBUG_AUDIO && m.type === 'audio' && typeof m.data === 'string') rec.push(Buffer.from(m.data, 'base64'));
    if (DEBUG_AUDIO && m.type === 'commit') { if (rec.length) saveWav(rec, dev, npc.id); rec = []; }
    S.fromGame(m);
  });
  cli.on('close', () => finish());
});

server.listen(PORT, () => console.log('回声岛对话中转服务：http://localhost:' + PORT + '  模型 ' + MODEL + '  每天 ' + DAILY_MIN + ' 分钟' + (ACCESS_CODE ? '  需要家庭口令' : '')));
