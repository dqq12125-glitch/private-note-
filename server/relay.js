// 回声岛 AI 语音对话中转服务
// 孩子的浏览器 ⇄ 这里（WebSocket）⇄ 阿里云百炼 Qwen-Omni 实时语音（WebSocket，带密钥）
// - 密钥只在这里：环境变量 DASHSCOPE_API_KEY，或 KEY_FILE 指向一个写着 DASHSCOPE_API_KEY=... 的文件（默认 server/.env）
// - 人设、音色、安全规则都由服务器按 npc id 从 ../talk-npcs.js 读，孩子的手机只能选 npc、送声音/文字
// - 大地图上的支线委托也一样：手机只发委托的 id（?quest=），人设、目标、小步骤由服务器从 ../quests.js 读
// - 每台设备每天有时长上限，每段对话有时长上限；对话记录写到 server/logs/日期.jsonl，家长看 /logs（只留 90 天，LOG_DAYS 可改）
// - 网页版的口语打分和聊天小工具也走这里：/asr 识别、/tip 点评、/tts 合成、/zh 翻译岛民的话、/steps 聊天小步骤打勾、
//   /place 能力检测的口语问答题（按题目 id 从 ../placement-data.js 查评分要点）
// - 按能力走的学习者：手机在 /talk 上多发 lv（0–5）和 ui（界面语言代码），岛民「这一级怎么说话」由 talk-core 在这里拼
// - 别的语言的课（西语 / 日语 / 中文，tools/course/TALK.md）：/talk 的 npc 可以是 ../talk-courses.js 里的角色 id，dyn 的 p 里可以带 lang；
//   /steps 认课程角色、/zh 多收 lang 和 ui；/health 的 talkLangs 说这里会用哪些语言聊天（TALK_LANGS 可关，英语一直在）
// - 第二轮：别的语言的课里的委托 /talk?quest=<id>&lang=<语言>、/steps 的 q + lang（人设还是 quests.js 的英文原文，开场白 / 示范句 / 词
//   用 ../talk-courses.js 的 quests 里这门语言的那一条）；/tip 多收 lang（别的语言的发音点评）；/health 多 questLangs、tipLangs
// - 为你出的题：/gen（要练的词 + 难度档 → 新写的练习句，提示词在 ../talk-core.js 的 genBody）；/health 多 genLangs（GEN_LANGS）
// 启动：cd server && npm install && node relay.js   （默认端口 8787；PORT 可改）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const NPCS = require('../talk-npcs.js');
const QUESTS = require('../quests.js');     // 支线委托：按 id 查，手机发来的人设文字一概不用
const CORE = require('../talk-core.js');   // 人设、安全规则、事件翻译：和安卓 APK 直连模式共用
// 能力检测的题库（placement-data.js，tools/place/build.js 生成）：判口语问答题时按题目 id 查评分要点。没有这个文件就不判（/place 回 400）
let PLACE = {};
try { PLACE = require('../placement-data.js'); } catch (e) { PLACE = {}; }
// 别的语言的课的聊天角色（talk-courses.js，tools/course/build.js --talk 生成）：按 id 查，手机发来的人设一概不用。没有这个文件就只有英语的角色
let COURSES = { langs: [], list: [], byId: {} };
try { COURSES = require('../talk-courses.js'); } catch (e) { COURSES = { langs: [], list: [], byId: {} }; }

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
// 口语题的识别、现场合成连哪里：默认就是阿里云（和以前一样）；测试时指到假的上游（cloud/test/t-05-relay.js）
const ASR_URL = cfg('ASR_URL') || CORE.EVAL_URL;
const TTS_URL = cfg('TTS_URL') || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
// 识别 / 合成的语言（别的语言的课，和公开版服务器 cloud/ 同一套，API.md §8 的 lang）：代码 → 合成的 language_type。没给 = 英语，发给阿里云的和以前一字不差
const SPEECH = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
// 别的语言合成用的音色（英语照旧 Jennifer / Aiden）：说这门语言地道的那几个，和实时聊天用的同名（2026-11-21 对着真的阿里云实测过）。
// TTS_VOICES='{"es":{"f":"…","m":"…"}}' 可改
const TTS_VOICES = (() => { let o = {}; try { o = JSON.parse(cfg('TTS_VOICES') || '{}') || {}; } catch (e) { o = {}; } return { es: Object.assign({ f: 'Sonrisa', m: 'Bodega' }, o.es), ja: Object.assign({ f: 'Ono Anna', m: 'Ryan' }, o.ja), zh: Object.assign({ f: 'Serena', m: 'Ryan' }, o.zh) }; })();
// lang → 代码；不认得 → null。names：/tts 也认 "Spanish" 这种写法
function speechLang(v, names) {
  if (v === undefined || v === null || v === '') return 'en';
  let s = String(v);
  if (names) { const k = Object.keys(SPEECH).find(x => SPEECH[x] === s); if (k) s = k; }
  return Object.prototype.hasOwnProperty.call(SPEECH, s) ? s : null;
}
// 和岛民聊天会用哪些语言（和公开版服务器 cloud/ 的 TALK_LANGS 同一套）：英语打头，只留 talk-core 认得的；/health 的 talkLangs 就是它
const TALK_LANGS = ['en'].concat(String(cfg('TALK_LANGS') || 'en,es,ja,zh').split(',').map(s => s.trim()).filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i));
// 聊天的语言：v 是手机说的代码（dyn 的 p.lang、/steps 和 /zh 的 lang）或者角色自己的 lang。没给 / 'en' = 英语（''）；不认得的、关掉的 → null
function talkLang(v) {
  if (v === undefined || v === null || v === '' || v === 'en') return '';
  const l = CORE.langOk(v);
  return l && TALK_LANGS.includes(l) ? l : null;
}
const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
// 岛民：先查英语的表，再查别的语言的课的角色（只认自己的键）
const npcById = id => (own(NPCS.byId, id) ? NPCS.byId[id] : own(COURSES.byId, id) ? COURSES.byId[id] : undefined);
// 别的语言的课里的委托译文（tools/course/TALK.md 第二轮）：talk-courses.js 的 quests——{ 语言: { 委托 id: { opener, steps, words } } }，
// build.js --talk 从 tools/course/<语言>/quests.json 生成。测试钩子（和公开版服务器 cloud/ 同名）：TEST_HOOKS=1 时把 TEST_QUESTS（JSON，同样的形状）
// 并上去，同一个 id 以它为准——测试用小样，不用等正式的译文；平时不用设
const QUEST_L = (() => {
  const out = {};
  let extra = null;
  if (cfg('TEST_HOOKS') === '1') { try { extra = JSON.parse(cfg('TEST_QUESTS') || 'null'); } catch (e) { extra = null; } }
  for (const src of [COURSES.quests, extra]) {
    if (!src || typeof src !== 'object') continue;
    for (const l of Object.keys(src)) if (CORE.langOk(l) === l && src[l] && typeof src[l] === 'object') out[l] = Object.assign(out[l] || {}, src[l]);
  }
  return out;
})();
// 支线委托会用哪些语言：QUEST_LANGS（没配 = 和 TALK_LANGS 一样），还要 TALK_LANGS 里开着、这里真有这门语言的委托译文；英语一直在。/health 的 questLangs 就是它
const QUEST_LANGS = ['en'].concat(String(cfg('QUEST_LANGS') || TALK_LANGS.join(',')).split(',').map(s => s.trim()).filter((l, i, a) => l !== 'en' && TALK_LANGS.includes(l) && own(QUEST_L, l) && Object.keys(QUEST_L[l]).length > 0 && a.indexOf(l) === i));
// AI 发音点评（/tip 的 lang）会用哪些语言：TIP_LANGS（没配 = 和 TALK_LANGS 一样），只留 talk-core 认得的；英语一直在。/health 的 tipLangs 就是它
const TIP_LANGS = ['en'].concat(String(cfg('TIP_LANGS') || TALK_LANGS.join(',')).split(',').map(s => s.trim()).filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i));
// 委托 / 点评的语言：规矩和 talkLang 一样（没给 / 'en' = 英语 ''；不认得的、没开的 → null），各看各的那张表
// 为你出的题（/gen 的 lang）会用哪些语言：GEN_LANGS（没配 = 和 TALK_LANGS 一样），只留 talk-core 认得的；英语一直在。/health 的 genLangs 就是它
const GEN_LANGS = ['en'].concat(String(cfg('GEN_LANGS') || TALK_LANGS.join(',')).split(',').map(s => s.trim()).filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i));
const langIn = (langs, v) => { if (v === undefined || v === null || v === '' || v === 'en') return ''; const l = CORE.langOk(v); return l && langs.includes(l) ? l : null; };
if (!KEY) { console.error('没有找到 DASHSCOPE_API_KEY（环境变量或 KEY_FILE / server/.env）'); process.exit(1); }

// ---------- 用量（每台设备每天的秒数），存盘防重启清零 ----------
const USAGE_FILE = cfg('USAGE_FILE') ? path.resolve(cfg('USAGE_FILE')) : path.join(__dirname, 'usage.json');
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
// 只留最近 LOG_DAYS 天（默认 90 天，家长 2026-10-07 定）：启动时和以后每 6 小时删一次更早的
const LOG_DIR = cfg('LOG_DIR') ? path.resolve(cfg('LOG_DIR')) : path.join(__dirname, 'logs');
const LOG_DAYS = Math.max(1, +(cfg('LOG_DAYS') || 90));
fs.mkdirSync(LOG_DIR, { recursive: true });
function writeLog(rec) {
  try { fs.appendFileSync(path.join(LOG_DIR, today() + '.jsonl'), JSON.stringify(rec) + '\n'); } catch (e) {}
}
function pruneLogs() {
  const cut = new Date(Date.now() - LOG_DAYS * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  try {
    for (const f of fs.readdirSync(LOG_DIR)) if (/^\d{4}-\d\d-\d\d\.jsonl$/.test(f) && f.slice(0, 10) < cut) fs.unlinkSync(path.join(LOG_DIR, f));
  } catch (e) {}
  // 调试录音（DEBUG_AUDIO=1 才会录）是孩子的声音：只留 7 天
  try {
    for (const f of fs.readdirSync(DEBUG_DIR)) if (/\.wav$/.test(f) && Date.now() - fs.statSync(path.join(DEBUG_DIR, f)).mtimeMs > 7 * 86400000) fs.unlinkSync(path.join(DEBUG_DIR, f));
  } catch (e) {}
}

// ---------- 调试：DEBUG_AUDIO=1 时把孩子每次说的话存成 wav（server/debug/），查「识别出来的字和说的不一样」用 ----------
const DEBUG_AUDIO = /^(1|true|yes)$/i.test(cfg('DEBUG_AUDIO') || '');
const DEBUG_DIR = cfg('DEBUG_DIR') ? path.resolve(cfg('DEBUG_DIR')) : path.join(__dirname, 'debug');
pruneLogs(); setInterval(pruneLogs, 6 * 3600 * 1000).unref();
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
// 别的语言的课：p 里可以带 lang（这个人说哪门语言）；不认得的、关掉的语言 → 'lang'（/talk 回「lang」的错，不连阿里云）
function personNpc(p) {
  let d;
  try { d = JSON.parse(Buffer.from(String(p || ''), 'base64url').toString('utf8')); } catch (e) { return null; }
  if (d && typeof d === 'object' && talkLang(d.lang) === null) return 'lang';
  return CORE.personNpc(d);
}
// 支线委托：只认 quests.js 里有的 id（没有这条就当没有这个岛民）
// 别的语言的课：langRaw 是手机说的语言代码（/talk 的 lang、/steps 的 lang）。没给 / en = 英语，和以前一字不差；
// 这门语言这里不会（QUEST_LANGS）、或者这条委托没有这门语言的译文 → 'lang'（调用的地方回「lang」的错，不连阿里云）
function questNpc(id, langRaw) {
  id = String(id || '');
  if (!own(QUESTS.byId, id)) return null;
  const lang = langIn(QUEST_LANGS, langRaw);
  if (lang === null) return 'lang';
  if (!lang) return CORE.questNpc(QUESTS.byId[id]);
  return (own(QUEST_L[lang], id) && CORE.questNpc(QUESTS.byId[id], lang, QUEST_L[lang][id])) || 'lang';
}
async function evaluate(npc, turns, o) {
  // 聊完后让文字模型给个温和的评价（中文），失败就不给（talk-core 的 session 再按小步骤和「开口说了几句」定完成没有）
  const body = CORE.evalBody(npc, turns, o);
  if (!body) return null;
  body.model = EVAL_MODEL;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(tm);
    return CORE.parseEval(await r.json(), o && o.ui, npc.lang);   // ui：别的界面语言的评语按词数要的，字数上限放宽；lang：别的语言的课按这门语言比「改没改」
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
    // talkLangs：这里会用哪些语言聊天（别的语言的课看它决定开不开聊天；老的中转服务没有这个字段 = 只会英语）
    // questLangs / tipLangs：支线委托、AI 发音点评会用哪些语言（没有这两个字段 = 只有英语的）
    return res.end(JSON.stringify({ ok: true, model: MODEL, code: !!ACCESS_CODE, npcs: NPCS.list.map(n => n.id), talkLangs: TALK_LANGS, questLangs: QUEST_LANGS, tipLangs: TIP_LANGS, genLangs: GEN_LANGS }));
  }
  if (u.pathname === '/logs') {
    if (ADMIN_TOKEN ? u.searchParams.get('token') !== ADMIN_TOKEN : !isLocal(req)) { res.writeHead(403); return res.end('forbidden'); }
    const d = /^\d{4}-\d\d-\d\d$/.test(u.searchParams.get('date') || '') ? u.searchParams.get('date') : today();
    let rows = [];
    try { rows = fs.readFileSync(path.join(LOG_DIR, d + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) {}
    const days = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl')).map(f => f.slice(0, 10)).sort().reverse();
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>回声岛对话记录</title>' +
      '<style>body{font:15px/1.6 system-ui,sans-serif;margin:16px;max-width:760px}h2{margin:18px 0 4px}.t{color:#666;font-size:13px}.you{color:#1565c0}.npc{color:#2e7d32}.card{border:1px solid #ddd;border-radius:10px;padding:10px 14px;margin:10px 0}.card.flag{border:2px solid #f0a020;background:#fffaf0}.warn{color:#8a4b00;font-weight:700}</style>' +
      '<h1>回声岛 · AI 对话记录</h1><p>' + days.map(x => x === d ? '<b>' + x + '</b>' : '<a href="?date=' + x + (ADMIN_TOKEN ? '&token=' + encodeURIComponent(ADMIN_TOKEN) : '') + '">' + x + '</a>').join(' · ') + '</p>' +
      (rows.length ? rows.map(r => '<div class="card' + (r.concern ? ' flag' : '') + '"><h2>' + (r.concern ? '⚠️ ' : '') + esc(r.npcZh || r.npc) + '</h2><div class="t">' + esc(r.start) + ' · ' + Math.round(r.sec) + ' 秒 · 设备 ' + esc(r.dev) + (r.goal != null ? ' · 目标 ' + (r.goal + 1) : '') +
        (r.eval ? ' · ' + '★'.repeat(r.eval.stars) + (r.eval.done ? ' · 完成目标' : '') + (r.eval.voice != null ? ' · 开口 ' + r.eval.voice + ' 句' : '') : '') + '</div>' +
        (r.concern ? '<div class="warn">需要家长看看：' + esc((r.eval && r.eval.concernWhy) || '孩子说到了难过或不安全的事') + '</div>' : '') +
        r.turns.map(t => '<div class="' + t.who + '">' + (t.who === 'you' ? (t.typed ? '孩子（打字）：' : '孩子：') : esc(r.npcName) + '：') + esc(t.text) + '</div>').join('') +
        (r.eval && r.eval.tips.length ? '<div class="t">建议：' + r.eval.tips.map(t => esc(t.said) + ' → ' + esc(t.better) + '（' + esc(t.zh) + '）').join('；') + '</div>' : '') + '</div>').join('') : '<p>这一天没有对话。</p>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
  }
  const helpPath = /^\/(asr|tip|gen|tts|zh|steps|place)$/.test(u.pathname);
  if (req.method === 'OPTIONS' && helpPath) {   // 跨域预检（GitHub Pages 上的网页版连家里的中转服务）
    let ok = false; try { ok = !!req.headers.origin && okOrigin(req.headers.origin); } catch (e) {}
    res.writeHead(ok ? 204 : 403, ok ? { 'Access-Control-Allow-Origin': req.headers.origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : {});
    return res.end();
  }
  if (req.method === 'POST' && helpPath) return cloudHelp(u, req, res);
  if (SERVE_GAME && (req.method === 'GET' || req.method === 'HEAD')) return serveGame(u, req, res);
  res.writeHead(404); res.end();
});

// ---------- 网页版的口语打分：/asr 录音 → 文字（qwen3-asr-flash，不给答案，听到什么写什么），/tip 目标句子 + 听到的 → 一句建议（按界面语言 ui，没给 = 中文） ----------
// 聊天小工具：/zh 岛民的一句话 → 中文；/steps 聊到现在 → 哪几个小步骤做到了（提示词都在服务器这边按 talk-core 拼，孩子的话包在 <transcript> 里）
// APK 直连阿里云不走这里。要家庭口令；每个 IP 每分钟最多 40 次。阿里云报错（密钥不对、欠费、额度用完）时把错误代码带回去（up），游戏好告诉家长原因
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
    const call = async (b, url, ms) => {   // ms：这一次的超时（毫秒），不给 = 12 秒；出题要 4–10 秒，/gen 给 25 秒
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || 12000);
      try {
        const r = await fetch(url || CORE.EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: ctl.signal });
        const o = await r.json();
        if (!r.ok || o.error || (o.code && !o.choices)) { const e = new Error('upstream'); e.up = String((o.error && (o.error.code || o.error.type)) || o.code || r.status).slice(0, 40); throw e; }
        return o;
      } finally { clearTimeout(tm); }
    };
    try {
      if (u.pathname === '/zh') {   // 点岛民的话看中文
        // 别的语言的课：lang = 这句话是哪门语言，ui = 翻成哪种界面语言（zh / en）；都没给 = 和以前一字不差（英文 → 中文）
        const zl = talkLang(j.lang); if (zl === null) return bad(400, 'lang');
        const text = zl ? CORE.cleanText(j.text, 400) : clean(j.text, 400); if (!text) return bad(400, 'text');
        const body = CORE.zhBody(text, { lang: zl, ui: j.ui }); if (!body) return bad(400, 'ui');   // 已经是那门语言了：没有可翻的
        body.model = EVAL_MODEL;
        const r = await call(body, EVAL_URL);
        res.writeHead(200, cors); return res.end(JSON.stringify({ zh: CORE.parseZh(r) }));
      }
      if (u.pathname === '/steps') {   // 聊天中实时打勾
        // 别的语言的课：npc 可以是课程角色的 id；npc=dyn 时 lang 说那个人说哪门语言（没给 = 英语）
        // q（委托的 id）+ lang：别的语言的课里的委托（这门语言这里不会、或者没有这条的译文：400 lang）
        const dl = !j.q && j.npc === 'dyn' ? talkLang(j.lang) : '';
        if (dl === null) return bad(400, 'lang');
        const npc = j.q ? questNpc(j.q, j.lang) : j.npc === 'dyn' ? CORE.personNpc({ name: j.nm, lang: dl }) : npcById(j.npc);
        if (!npc) return bad(400, 'npc');
        if (npc === 'lang' || talkLang(npc.lang) === null) return bad(400, 'lang');   // 课程角色的语言这里没开
        const cl = npc.lang ? CORE.cleanText : clean;
        const turns = (Array.isArray(j.turns) ? j.turns : []).slice(-30).map(t => ({ who: t && t.who === 'you' ? 'you' : 'npc', text: cl(t && t.text, 300), typed: !!(t && t.typed) })).filter(t => t.text);
        const g = CORE.goalOf(npc, j.g), body = CORE.stepsBody(npc, g.i, turns, j.ui);   // ui：只认 talk-core 认得的界面语言
        if (!body) { res.writeHead(200, cors); return res.end(JSON.stringify({ done: [] })); }
        body.model = EVAL_MODEL;
        const r = await call(body, EVAL_URL);
        res.writeHead(200, cors); return res.end(JSON.stringify({ done: CORE.parseSteps(r, g.steps.length) }));
      }
      if (u.pathname === '/place') {   // 能力检测的口语问答题：手机只发题目的 id 和听写出来的话，题目和评分要点按 id 从题库里查
        const lang = /^[a-z]{2,3}$/.test(String(j.lang || '')) ? String(j.lang) : 'en';
        const bank = Object.prototype.hasOwnProperty.call(PLACE, lang) ? PLACE[lang].items : [], id = String(j.id || '');
        const item = bank.find(x => x.id === id && x.skill === 'speak' && x.kind === 'answer');
        if (!item) return bad(400, 'item');
        const body = CORE.placeBody(item, clean(j.heard, 500), { lang }); if (!body) return bad(400, 'text');
        body.model = EVAL_MODEL;
        const r = CORE.parsePlace(await call(body, EVAL_URL));
        res.writeHead(r ? 200 : 502, cors); return res.end(JSON.stringify(r || { error: 'upstream', up: 'score' }));
      }
      if (u.pathname === '/asr') {
        if (typeof j.audio !== 'string' || j.audio.length < 1000) return bad(400, 'audio');
        const language = speechLang(j.lang); if (!language) return bad(400, 'lang');   // 别的语言的课：es / ja / zh
        const r = await call({ model: 'qwen3-asr-flash', stream: false, asr_options: { language, enable_itn: false }, messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + j.audio } }] }] }, ASR_URL);
        res.writeHead(200, cors); return res.end(JSON.stringify({ text: String((r.choices && r.choices[0].message.content) || '').trim() }));
      }
      if (u.pathname === '/tts') {   // 网页版：没有提前配音的句子现场合成
        const text = clean(j.text, 300); if (!text) return bad(400, 'text');
        const lang = speechLang(j.lang, true); if (!lang) return bad(400, 'lang');
        const V = lang === 'en' ? { f: 'Jennifer', m: 'Aiden' } : TTS_VOICES[lang];
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
        try {
          const r = await fetch(TTS_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text, voice: j.g === 'm' ? V.m : V.f, language_type: SPEECH[lang] } }), signal: ctl.signal });
          const o = await r.json(), url = o.output && o.output.audio && o.output.audio.url;
          res.writeHead(url ? 200 : 502, cors); return res.end(JSON.stringify(url ? { url } : { url: '', error: 'upstream', up: String(o.code || r.status).slice(0, 40) }));
        } finally { clearTimeout(tm); }
      }
      if (u.pathname === '/gen') {   // 为你出的题：手机只发数据（要练的词、难度档、学过的词、上一轮的句子），提示词只由 talk-core 的 genBody 按洗过的数据拼
        const gl = langIn(GEN_LANGS, j.lang); if (gl === null) return bad(400, 'lang');   // 这里不会的语言（GEN_LANGS）
        const o = CORE.genIn(Object.assign({}, j, { lang: gl || 'en' })); if (!o) return bad(400, 'focus');   // 一个能用的要练的词都没有
        const body = CORE.genBody(o); body.model = EVAL_MODEL;
        const out = CORE.parseGen(await call(body, EVAL_URL, 25000), o);
        if (!out || !out.s.length) { const e = new Error('upstream'); e.up = 'gen'; throw e; }   // 模型回的一条能用的都没有：和上游出错一样
        res.writeHead(200, cors); return res.end(JSON.stringify({ s: out.s, d: out.d }));
      }
      // 别的语言的课的发音点评：lang = 这句话是哪门语言（没给 / en = 英语，和以前一字不差）；这里不会的（TIP_LANGS）→ 400 lang
      const tl = langIn(TIP_LANGS, j.lang); if (tl === null) return bad(400, 'lang');
      const tcl = tl ? CORE.cleanText : clean;   // 别的语言留着这门语言的标点和重音符号
      const target = tcl(j.target, 200), heard = tcl(j.heard, 200);
      if (!target || !heard) return bad(400, 'text');
      // 点评的提示词在 talk-core（和 APK 直连同一份）：按界面语言 ui 写，没给 = 中文
      const body = CORE.tipBody(target, heard, j.ui, tl); body.model = EVAL_MODEL;
      const r = await call(body, EVAL_URL);   // 和 /zh、/steps 一样走 EVAL_URL（默认就是阿里云；测试里是假的上游）
      res.writeHead(200, cors); res.end(JSON.stringify({ tip: CORE.parseTip(r, j.ui) }));
    } catch (e) { res.writeHead(502, cors); res.end(JSON.stringify({ error: 'upstream', up: e.up || '' })); }
  });
}
const clean = (v, n) => String(v || '').replace(/[^\p{L}\p{N} .,!?'"’:;()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- 可选：顺便把游戏网页也放出来（家里用 Tailscale 试的时候，一个服务就够）----------
// SERVE_GAME=1 时从仓库根目录读文件；每次都让浏览器回来确认有没有新版本（no-cache + ETag），改了代码刷新就是新的
const SERVE_GAME = /^(1|true|yes)$/i.test(cfg('SERVE_GAME') || '');
const GAME_ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.apk': 'application/vnd.android.package-archive', '.woff2': 'font/woff2' };
function serveGame(u, req, res) {
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(GAME_ROOT, '.' + rel);
  // 只放白名单里的游戏文件：根目录的 .html/.js/.css，和 assets/ vendor/ isles/ dl/ 下面的文件。
  // （以前是黑名单：android/ 里的签名密码、打包时生成的带密钥的 BuildConfig、文档等都会被隧道放到外网上）
  const relN = file.slice(GAME_ROOT.length).split(path.sep).join('/');
  const allowed = /^\/[\w.-]+\.(html|js|css)$/.test(relN) || /^\/(assets|vendor|isles|dl)\/[\w./-]+$/.test(relN);
  if (!file.startsWith(GAME_ROOT + path.sep) || !allowed || /\/\./.test(relN)) { res.writeHead(404); return res.end(); }
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
// 听哪种语言看网址里的 ?lang=（en / es / ja / zh，没给 = en；不认得的直接断开）
const ASR_RT_URL = (cfg('ASR_RT_URL') || CORE.REALTIME_URL) + '?model=qwen3-asr-flash-realtime';
asrWss.on('connection', (cli, req) => {
  const u = new URL(req.url, 'http://x');
  const bye = () => { try { cli.close(); } catch (e) {} };
  try { if (req.headers.origin && !okOrigin(req.headers.origin)) return bye(); } catch (e) { return bye(); }
  if (ACCESS_CODE && u.searchParams.get('code') !== ACCESS_CODE) return bye();
  const language = speechLang(u.searchParams.get('lang'));
  if (!language) return bye();
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
      out = { type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language },
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
  // 带着 quest= 的是支线委托：按 id 从 quests.js 里拼人设，手机一起发来的 npc / p 都不看
  // 别的语言的课：npc 可以是 talk-courses.js 里的角色 id；dyn 的 p 里可以带 lang。这门语言这里没开 → 「lang」的错，不连阿里云
  // 别的语言的课里的委托：quest=<id>&lang=<语言>（没带 lang = 英语的委托，和以前一字不差）
  const npc = u.searchParams.get('quest') ? questNpc(u.searchParams.get('quest'), u.searchParams.get('lang'))
    : u.searchParams.get('npc') === 'dyn' ? personNpc(u.searchParams.get('p')) : npcById(u.searchParams.get('npc'));
  if (!npc) return fail('没有这个岛民', 'npc');
  if (npc === 'lang' || talkLang(npc.lang) === null) return fail('这里还不会用这门语言聊天', 'lang');
  const dev = (u.searchParams.get('dev') || 'unknown').replace(/[^\w-]/g, '').slice(0, 40) || 'unknown';
  const player = (u.searchParams.get('name') || '').replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16);
  const goal = Math.max(0, Math.min(9, parseInt(u.searchParams.get('g'), 10) || 0));   // 这次聊第几个目标（轮换）
  // 按能力走的学习者：手机发来能力级别 lv（只认 0–5 的整数）和界面语言 ui（只认 talk-core 里列着的代码），
  // 「这一级怎么说话」那一段由 talk-core 在这里拼；别的字段一概不看，手机没法自己写规矩。没发 = 老存档，和以前一字不差。
  // ui 不看级别也要：界面不是中文的人不能被说成「中国学生」，评语也按界面语言写（ui=zh / 没发 = 和以前一字不差）
  const lvRaw = u.searchParams.get('lv'), level = lvRaw != null && /^[0-5]$/.test(lvRaw) ? +lvRaw : null;
  const ui = CORE.uiOk(u.searchParams.get('ui') || '');
  // 岛民记得的上次聊过的小事（孩子手机上存的）：talk-core 的 memOf 再筛一遍，只留游戏里的小事、限长去符号
  let memory = null;
  try { memory = CORE.memOf(JSON.parse(Buffer.from(String(u.searchParams.get('m') || ''), 'base64url').toString('utf8')), npc.lang); } catch (e) { memory = null; }
  const left = DAILY_MIN * 60 - usedSec(dev);
  if (left < 20) return fail('今天的聊天时间用完了，明天再来吧！', 'daily');
  if (live >= MAX_LIVE) return fail('对话服务有点忙，过一会儿再试', 'busy');
  live++;

  const start = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const limitSec = Math.min(SESSION_MIN * 60, left);
  let rec = [];
  const up = new WebSocket(UPSTREAM, { headers: { Authorization: 'Bearer ' + KEY } });
  const S = CORE.session({
    npc, player, limitSec, leftSec: left, goal, memory, level, ui,
    up: m => { if (up.readyState === WebSocket.OPEN) up.send(JSON.stringify(m)); },
    out: send,
    evaluate,
    onEnd: ({ turns, sec, eval: ev, goal: gi }) => {
      try { up.close(); } catch (e) {}
      addUsage(dev, sec); live--;
      writeLog({ start, dev, npc: npc.id, npcName: npc.name, npcZh: npc.zh, goal: gi, sec, turns, eval: ev, concern: !!(ev ? ev.concern : CORE.worried(turns)) });
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
