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
const MODEL = cfg('TALK_MODEL') || 'qwen3.8-omni-flash-realtime';
const UPSTREAM = (cfg('TALK_URL') || 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime') + '?model=' + encodeURIComponent(MODEL);
const EVAL_URL = (cfg('EVAL_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1') + '/chat/completions';
const EVAL_MODEL = cfg('EVAL_MODEL') || 'qwen-plus';
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

// ---------- 人设 ----------
function instructions(npc, player) {
  return [
    npc.persona,
    'This is Echo Island, a friendly monster-collecting adventure game for learning English. You are talking with ' + (player || 'the player') + ', a 12-year-old Chinese student in Grade 7 who is learning English (beginner, CEFR A1 to A2).',
    'Rules:',
    '- Speak ONLY in English. Use short, simple sentences and common words. At most 2 short sentences per turn (about 20 words). Speak slowly and clearly, with a warm, lively tone that fits your character.',
    '- Keep the student talking: ask exactly one easy question each turn.',
    '- If the student is silent, answers in Chinese, or seems stuck, help with a tiny model sentence they can copy, e.g. "You can say: I want noodles." Then wait.',
    '- If the student makes a grammar or word mistake, do not say "wrong". Just repeat their idea correctly in your answer (recast), then continue.',
    '- Stay in character and inside the game world and everyday kid topics. Never ask for real personal information (real full name, school, address, phone, photos, passwords). Never talk about violence, scary, adult, political or unsafe topics; if the student brings one up, kindly change the subject back to the game.',
    '- Never mention that you are an AI model, and never mention any real games, brands or companies.',
    'Conversation goal for the student: ' + npc.goal + ' Guide the conversation step by step so the student can reach this goal. Useful words for them: ' + npc.words.join(', ') + '.',
    'When the goal is reached, praise the student in one short sentence and say goodbye in character.',
  ].join('\n');
}

// ---------- 大地图上随便一个人：游戏把名字、身份、所在的岛、他说过的话发过来，这里拼成人设 ----------
// 这些是孩子的浏览器发来的，只当「角色资料」用：逐项限长、只留字母标点，安全规则仍由 instructions() 统一加在后面
const VOICES = { f: ['Serena', 'Tina', 'Mione', 'Katerina', 'Maia', 'Jennifer'], m: ['Aiden', 'Ryan', 'Theo Calm', 'Joyner', 'Raymond', 'Dolce'], kf: ['Cici', 'Momo'], km: ['Evan'] };
const clean = (v, n) => String(v || '').replace(/[^\p{L}\p{N} .,!?'"’:;()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
function personNpc(p) {
  let d;
  try { d = JSON.parse(Buffer.from(String(p || ''), 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!d || typeof d !== 'object') return null;
  const name = clean(d.name, 30) || 'Friend', g = d.g === 'f' ? 'f' : 'm', kid = !!d.kid;
  const role = clean(d.role, 60) || 'a friendly villager', island = clean(d.island, 40) || 'Echo Island', place = clean(d.place, 30);
  const lines = (Array.isArray(d.lines) ? d.lines : []).slice(0, 5).map(x => clean(x, 160)).filter(Boolean);
  const words = (Array.isArray(d.words) ? d.words : []).slice(0, 10).map(x => clean(x, 24)).filter(Boolean);
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = VOICES[(kid ? 'k' : '') + g] || VOICES[g];
  return {
    id: 'dyn', name, zh: name, voice: pool[h % pool.length],
    persona: 'You are ' + name + ', ' + role + ' on ' + island + ' in the Echo Islands. You are ' + (kid ? 'a child' : 'a grown-up') + ', and you are ' + (place || 'outdoors') + ' right now. ' +
      (lines.length ? 'Here are things you have said before, keep the same personality and facts: "' + lines.join('" / "') + '". ' : '') +
      'This island\'s topic is: ' + island.replace(/ Island$/, '') + '.',
    goal: 'Have a friendly, natural chat with ' + name + ': greet each other, ask and answer a few simple questions about each other and about ' + island + '.',
    words: words.length ? words : ['Hello', 'How are you', 'I like', 'What about you'],
    opener: lines[0] || 'Hi there! Nice to meet you!',
  };
}

async function evaluate(npc, turns) {
  // 聊完后让文字模型给个温和的评价（中文），失败就不给
  const said = turns.filter(t => t.who === 'you' && t.text).length;
  if (!said) return null;
  const transcript = turns.map(t => (t.who === 'you' ? 'Student: ' : npc.name + ': ') + t.text).join('\n');
  const body = {
    model: EVAL_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是一位温柔的初中英语老师，给一个初一学生的英语口语对话打分。只输出 JSON：{"done":是否完成目标(true/false),"stars":1到3的整数,"praise":"一句具体的中文表扬（20字以内）","tips":[最多2条，{"said":"学生原句","better":"更好的英文说法","zh":"一句中文解释（20字以内）"}]}。tips 只挑最重要的错误，没有错误就给空数组。评分宽松，鼓励为主。' },
      { role: 'user', content: '对话目标：' + npc.goal + '\n\n对话记录（学生的话是语音识别出来的，可能有识别错误，不要因为识别错误扣分）：\n' + transcript },
    ],
  };
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(tm);
    const j = await r.json();
    const e = JSON.parse(j.choices[0].message.content);
    return { done: !!e.done, stars: Math.max(1, Math.min(3, e.stars | 0 || 1)), praise: String(e.praise || '').slice(0, 60), tips: (e.tips || []).slice(0, 2).map(t => ({ said: String(t.said || '').slice(0, 120), better: String(t.better || '').slice(0, 120), zh: String(t.zh || '').slice(0, 60) })) };
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
  if (SERVE_GAME && (req.method === 'GET' || req.method === 'HEAD')) return serveGame(u, req, res);
  res.writeHead(404); res.end();
});

// ---------- 可选：顺便把游戏网页也放出来（家里用 Tailscale 试的时候，一个服务就够）----------
// SERVE_GAME=1 时从仓库根目录读文件；每次都让浏览器回来确认有没有新版本（no-cache + ETag），改了代码刷新就是新的
const SERVE_GAME = /^(1|true|yes)$/i.test(cfg('SERVE_GAME') || '');
const GAME_ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
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
    res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- WebSocket：一段对话 ----------
const wss = new WebSocketServer({ server, path: '/talk', maxPayload: 256 * 1024 });
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

  const t0 = Date.now(), start = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const limitMs = Math.min(SESSION_MIN * 60, left) * 1000;
  const turns = []; let npcText = '', appended = 0, closed = false, evaluated = false, rec = [];
  const seenItem = new Set();
  const up = new WebSocket(UPSTREAM, { headers: { Authorization: 'Bearer ' + KEY } });
  const upSend = m => { if (up.readyState === WebSocket.OPEN) up.send(JSON.stringify(m)); };

  const timer = setTimeout(() => { send({ type: 'limit', zh: left <= SESSION_MIN * 60 ? '今天的聊天时间到了，明天再聊！' : '这段聊得够久啦，休息一下吧！' }); finish(); }, limitMs);
  async function finish() {
    if (closed) return; closed = true;
    clearTimeout(timer);
    try { up.close(); } catch (e) {}
    const sec = (Date.now() - t0) / 1000;
    addUsage(dev, sec); live--;
    let ev = null;
    if (!evaluated) { evaluated = true; ev = await evaluate(npc, turns); }
    send({ type: 'eval', eval: ev, sec: Math.round(sec), left: Math.max(0, Math.round(DAILY_MIN * 60 - usedSec(dev))) });
    writeLog({ start, dev, npc: npc.id, npcName: npc.name, npcZh: npc.zh, sec, turns, eval: ev });
    setTimeout(() => { try { cli.close(); } catch (e) {} }, 300);
  }

  up.on('open', () => {
    upSend({ type: 'session.update', session: {
      modalities: ['text', 'audio'], voice: npc.voice, instructions: instructions(npc, player),
      input_audio_format: 'pcm', output_audio_format: 'pcm',
      input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },   // 不强制英语：说中文就显示中文，孩子一看就知道
      turn_detection: null,
    } });
    // 开场白：让岛民先开口
    upSend({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '(The student has just walked up to you. Start the conversation in character, for example: "' + npc.opener + '")' }] } });
    upSend({ type: 'response.create' });
    send({ type: 'ready', npc: npc.id, leftSec: Math.round(left), sessionSec: Math.round(limitMs / 1000) });
  });
  up.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    switch (m.type) {
      case 'response.audio.delta': send({ type: 'audio', data: m.delta }); break;
      case 'response.audio_transcript.delta': npcText += m.delta || ''; send({ type: 'npc', delta: m.delta || '' }); break;
      case 'response.done':
        if (DEBUG_AUDIO) console.log('resp', m.response && m.response.id, JSON.stringify(npcText.slice(0, 60)));
        if (m.response && m.response.id) { if (seenItem.has(m.response.id)) { npcText = ''; break; } seenItem.add(m.response.id); }
        if (npcText.trim()) turns.push({ who: 'npc', text: npcText.trim() });
        send({ type: 'npc_done', text: npcText.trim() }); npcText = ''; break;
      case 'conversation.item.input_audio_transcription.completed':
        // 识别器对杂音会给 <non_speech> 之类的标记，不算孩子说的话
        if ((m.transcript || '').replace(/<[^>]*>/g, '').trim() && !seenItem.has(m.item_id || Math.random())) {
          if (m.item_id) seenItem.add(m.item_id);
          const tx = m.transcript.replace(/<[^>]*>/g, '').trim(); turns.push({ who: 'you', text: tx }); send({ type: 'you', text: tx, item: m.item_id || '' });
          if (DEBUG_AUDIO) console.log('asr', m.item_id, JSON.stringify(tx));
        }
        break;
      case 'error':
        console.log('upstream error', JSON.stringify(m).slice(0, 300));
        if (/no(ne)? active response|not active/i.test((m.error && m.error.message) || '')) break;   // 取消了一个已经说完的回答，不算错
        send({ type: 'error', code: 'upstream', zh: '对话服务出了点问题：' + String((m.error && m.error.message) || '').slice(0, 80) });
        break;
    }
  });
  up.on('close', () => { if (!closed) { send({ type: 'error', code: 'closed', zh: '对话连接断开了' }); finish(); } });
  up.on('error', e => { console.log('upstream ws error', e.message); if (!closed) { send({ type: 'error', code: 'upstream', zh: '连不上对话服务' }); finish(); } });

  cli.on('message', buf => {
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (m.type === 'audio' && typeof m.data === 'string' && m.data.length < 200000) {
      appended += m.data.length * 0.75 / 32;   // 16kHz 16 位单声道：每毫秒 32 字节
      if (DEBUG_AUDIO) rec.push(Buffer.from(m.data, 'base64'));
      upSend({ type: 'input_audio_buffer.append', audio: m.data });
    } else if (m.type === 'commit') {
      if (appended >= 300) {
        if (DEBUG_AUDIO) saveWav(rec, dev, npc.id);
        upSend({ type: 'input_audio_buffer.commit' }); upSend({ type: 'response.create' });
      } else upSend({ type: 'input_audio_buffer.clear' });
      appended = 0; rec = [];
    } else if (m.type === 'cancel') {
      upSend({ type: 'response.cancel' });
    } else if (m.type === 'text' && typeof m.text === 'string' && m.text.trim()) {
      const text = m.text.trim().slice(0, 200);
      turns.push({ who: 'you', text });
      upSend({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
      upSend({ type: 'response.create' });
    } else if (m.type === 'end') finish();
  });
  cli.on('close', () => finish());
});

server.listen(PORT, () => console.log('回声岛对话中转服务：http://localhost:' + PORT + '  模型 ' + MODEL + '  每天 ' + DAILY_MIN + ' 分钟' + (ACCESS_CODE ? '  需要家庭口令' : '')));
