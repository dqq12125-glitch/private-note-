// 阿里云这把钥匙现在什么状态（花不到一分钱）：额度用完了、欠费了，还是只有某一种服务不通。
//   cd cloud && node scripts/live-provider-check.mjs
// 老板问「是不是没额度了」「AI 怎么没反应」时先跑它。一样一样试，只打印阿里云回的错误代码和事件名：
//   文字模型（HTTP）、合成（HTTP）、实时识别（WebSocket，口语题用的）、实时聊天（WebSocket，和岛民聊天用的，只发一句文字、不发声音）。
// 2026-11-24：前三样都正常，实时聊天连得上、可一发消息 3 秒后连接就被掐断（代码 1006、没有任何错误提示），三个实时聊天模型都一样。
// 当时我以为不像额度用完（以为会给错误代码），错了：百炼控制台「费用用量 → 免费额度」里 qwen3.8-omni-flash-realtime 是「剩 0 / 共 1M」、
// 「用完即停」开着——**实时聊天的免费额度用完又开着「用完即停」，表现就是这样：连得上、一发消息就断、不给错误代码**
// （文档写的 403 AllocationQuota.FreeTierOnly 是 HTTP 接口的样子）。实时识别还能用，是因为它的免费额度用完以后不支持「用完即停」、直接按量计费。
// 所以这条命令只能告诉你哪一样不通；是不是额度，要登录控制台看那一页（搜模型名，看「额度用尽或过期」那一栏）。
// 钥匙只在这个进程里从钥匙文件读（ECHO_KEY_FILE），不打印。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const WebSocket = require('ws');
const km = /^\s*DASHSCOPE_API_KEY\s*=\s*(\S+)\s*$/m.exec(fs.readFileSync(process.env.ECHO_KEY_FILE || 'D:/Claude/tools/echo-relay/game-key.env', 'utf8'));
if (!km || !km[1].startsWith('sk-')) { console.log('✗ 钥匙文件里没有找到钥匙（不打印内容）'); process.exit(2); }
const KEY = km[1], scrub = s => String(s).split(KEY).join('sk-***');
const H = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const HTTP = process.env.DS_HTTP_BASE || 'https://dashscope.aliyuncs.com', WSB = process.env.DS_WS_BASE || 'wss://dashscope.aliyuncs.com';
const TALK = process.env.TALK_MODEL || 'qwen3.8-omni-flash-realtime';

async function http(name, url, body) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const err = j.code || (j.error && (j.error.code || j.error.type)) || '';
    console.log((err || !r.ok ? '✗ ' : '✓ ') + name + '：HTTP ' + r.status + (err ? '  错误代码 ' + err + '  ' + scrub(String(j.message || (j.error && j.error.message) || '')).slice(0, 160) : '') + '  （' + (Date.now() - t0) + ' 毫秒）');
  } catch (e) { console.log('✗ ' + name + '：连不上 ' + scrub(e.message)); }
}
// first：连上以后发的消息；ok(m)：收到这条就算正常
function ws(name, model, first, ok) {
  return new Promise(resolve => {
    const t0 = Date.now(), seen = [];
    let done = false;
    const sock = new WebSocket(WSB + '/api-ws/v1/realtime?model=' + model, { headers: { Authorization: 'Bearer ' + KEY } });
    const end = (good, why) => { if (done) return; done = true; clearTimeout(tm); try { sock.close(); } catch (e) { /* 关了 */ } console.log((good ? '✓ ' : '✗ ') + name + '：' + why + '  收到的事件：' + (seen.join(' ') || '（没有）') + '  （' + (Date.now() - t0) + ' 毫秒）'); resolve(); };
    const tm = setTimeout(() => end(false, '等了 12 秒没有结果'), 12000);
    sock.on('unexpected-response', (rq, rs) => end(false, '握手被拒 HTTP ' + rs.statusCode));
    sock.on('error', e => end(false, '出错 ' + scrub(e.message)));
    sock.on('close', (c, why) => end(false, '连接被关了（代码 ' + c + (String(why || '') ? '，' + scrub(String(why)).slice(0, 120) : '') + '）'));
    sock.on('open', () => first.forEach(m => sock.send(JSON.stringify(m))));
    sock.on('message', d => {
      let m; try { m = JSON.parse(String(d)); } catch (e) { return; }
      seen.push(m.type === 'error' ? 'error[' + scrub(JSON.stringify(m.error || m)).slice(0, 260) + ']' : m.type);
      if (m.type === 'error') return end(false, '阿里云报错');
      if (ok(m)) end(true, '正常');
    });
  });
}

await http('文字模型 qwen-plus', HTTP + '/compatible-mode/v1/chat/completions', { model: 'qwen-plus', messages: [{ role: 'user', content: 'Say OK.' }], max_tokens: 3 });
await http('合成 qwen3-tts-flash', HTTP + '/api/v1/services/aigc/multimodal-generation/generation', { model: 'qwen3-tts-flash', input: { text: 'OK', voice: 'Jennifer', language_type: 'English' } });
await ws('实时识别 qwen3-asr-flash-realtime（口语题）', 'qwen3-asr-flash-realtime',
  [{ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: 'en' }, turn_detection: null } }],
  m => m.type === 'session.updated');
await ws('实时聊天 ' + TALK + '（和岛民聊天；只发一句文字）', TALK,
  [{ type: 'session.update', session: { modalities: ['text'], instructions: 'Reply with one short word.', turn_detection: null } },
    { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hi' }] } }, { type: 'response.create' }],
  m => m.type === 'response.done');
process.exit(0);
