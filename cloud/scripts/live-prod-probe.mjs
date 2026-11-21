// 用真的登录态量线上服务器的识别（**会花钱：真的阿里云额度，几分钱；会在线上的库里建一个测试账号、量完删掉。跑之前先问老板**）
// 为什么要这个：线上只能从 iPhone 用 Apple 登录，电脑拿不到登录态；而「服务器在 Cloudflare 的机房里去连 AI 供应商」这一段
// 只有在线上才看得出快慢（2026-11-21：本机起的服务器一切正常，线上却等 20 秒——悉尼机房到北京丢包，见 wrangler.toml 的 [placement]）。
// 做法：
//   1) 另开一个终端，把同一份程序以「预览」方式放到 Cloudflare 上跑，邮件改成打印（预览和线上用同一个库、同一把密钥，所以登录态通用）：
//        cd cloud
//        npx wrangler dev --remote --port 8799 --var ENVIRONMENT:preview --var EMAIL_PROVIDER:console > dist/wrangler-remote.log 2>&1
//      等日志里出现 Ready on。量完记得关掉（Windows 上要连 node、workerd 子进程一起杀，不然端口被占着、下次登录码打不到日志里）。
//   2) 先跑过一次 node scripts/live-speech.mjs（它把几段测试用的声音存在 dist/live-speech/）。
//   3) node scripts/live-prod-probe.mjs [线上地址]      不给地址 = 打预览自己（看「在离你最近的机房」是什么样）
// 打印：整段识别（/v1/asr）每次多久、实时识别（/v1/asr-rt，照真实说话的速度送）连上多久、说完多久出字。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CLOUD } from '../test/lib.js';
const require = createRequire(path.join(CLOUD, 'package.json'));
const WS = require('ws');
const DIR = path.join(CLOUD, 'dist', 'live-speech'), LOG = process.env.PROBE_LOG || path.join(CLOUD, 'dist', 'wrangler-remote.log');
const LOGIN = process.env.PROBE_LOGIN || 'http://127.0.0.1:8799', TARGET = (process.argv[2] || LOGIN).replace(/\/$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let BASE = LOGIN;
const api = async (method, p, o) => {
  o = o || {}; const h = {}; if (o.token) h.Authorization = 'Bearer ' + o.token; let body;
  if (o.body !== undefined) { body = JSON.stringify(o.body); h['Content-Type'] = 'application/json'; }
  const t0 = Date.now(); let r, text = '';
  try { r = await fetch(BASE + p, { method, headers: h, body, signal: AbortSignal.timeout(o.ms || 40000) }); text = await r.text(); }
  catch (e) { return { status: 0, text: String(e && e.message || e), ms: Date.now() - t0, json: null }; }
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, text, json, ms: Date.now() - t0 };
};
const pcmOf = wav => { const i = wav.indexOf(Buffer.from('data')); return wav.subarray(i + 8); };
const wavOf = pcm => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
const clip = n => { const f = path.join(DIR, n); if (!fs.existsSync(f)) { console.log('✗ 没有 ' + f + '：先跑一次 node scripts/live-speech.mjs'); process.exit(1); } return fs.readFileSync(f); };

(async () => {
  const en = clip('tts-en-f.16k.wav'), esF = clip('tts-es-f.16k.wav'), esM = clip('tts-es-m.16k.wav');
  const long = wavOf(Buffer.concat([pcmOf(esF), Buffer.alloc(16000), pcmOf(esM), Buffer.alloc(16000), pcmOf(esF), Buffer.alloc(16000), pcmOf(esM)]));
  // 登录：验证码从预览的日志里读（不打印）
  const email = 'probe-' + Date.now().toString(36) + '@example.test';
  const s = await api('POST', '/v1/auth/email/start', { body: { email } });
  if (s.status !== 200) { console.log('✗ 预览没起来或者不让登录：', s.status, s.text.slice(0, 200)); process.exit(1); }
  let code = null;
  for (let i = 0; i < 40 && !code; i++) { await sleep(500); const L = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8') : ''; const k = L.lastIndexOf('to=' + email); if (k >= 0) { const m = /\b(\d{6})\b/.exec(L.slice(k + email.length + 3, k + 900)); if (m) code = m[1]; } }
  if (!code) { console.log('✗ 日志里没等到登录码（' + LOG + '）：预览是不是只有一份在跑、输出是不是写到这个文件'); process.exit(1); }
  const v = await api('POST', '/v1/auth/email/verify', { body: { email, code } });
  const tk = v.json && v.json.token;
  if (!tk) { console.log('✗ 登录没成：', v.status, v.text.slice(0, 200)); process.exit(1); }
  BASE = TARGET;
  await api('PATCH', '/v1/me', { token: tk, body: { ageGroup: 'adult' } });
  const me = await api('GET', '/v1/me', { token: tk });
  console.log('打的是', BASE, '｜speechLangs', JSON.stringify(me.json && me.json.speechLangs));
  try {
    const asr = async (name, wav, lang) => { const r = await api('POST', '/v1/asr', { token: tk, body: lang ? { audio: wav.toString('base64'), lang } : { audio: wav.toString('base64') }, ms: 45000 }); console.log('整段', name, (pcmOf(wav).length / 32000).toFixed(1) + ' 秒的声音 →', r.status, r.ms + 'ms', r.status === 200 ? JSON.stringify(r.json.text) : r.text.slice(0, 200)); };
    await asr('en', en, null);
    await asr('es', esF, 'es');
    await asr('es（再一次）', esF, 'es');
    await asr('es 长', long, 'es');
    const rt = (name, wav, lang) => new Promise(resolve => {
      const t0 = Date.now(), pcm = pcmOf(wav), ev = [];
      const ws = new WS(BASE.replace(/^http/, 'ws') + '/v1/asr-rt' + (lang ? '?lang=' + lang : ''));
      let tOpen = 0, tSaid = 0, first = 0, fin = null;
      ws.on('open', async () => {
        tOpen = Date.now() - t0;
        ws.send(JSON.stringify({ type: 'auth', token: tk }));
        ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: lang || 'en' }, turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: 600 } } }));
        for (let i = 0; i < pcm.length; i += 3200) { if (ws.readyState !== 1) break; ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.subarray(i, i + 3200).toString('base64') })); await sleep(100); }
        tSaid = Date.now();
        const sil = Buffer.alloc(3200).toString('base64');
        for (let i = 0; i < 50 && !fin && ws.readyState === 1; i++) { ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: sil })); await sleep(100); }
        try { ws.send(JSON.stringify({ type: 'session.finish' })); } catch (e) {}
        setTimeout(() => { try { ws.close(); } catch (e) {} }, 1500);
      });
      ws.on('message', d => { let m; try { m = JSON.parse(String(d)); } catch (e) { m = { type: 'raw' }; } const at = Date.now() - t0; ev.push(m.type + '@' + at); if (/transcription\.text$/.test(m.type || '') && !first) first = at; if (m.type === 'error') ev.push(JSON.stringify(m).slice(0, 160)); if (/transcription\.completed$/.test(m.type || '') && !fin) fin = { at: Date.now(), text: m.transcript || '' }; });
      ws.on('close', () => { console.log('实时', name, (pcm.length / 32000).toFixed(1) + ' 秒的声音：连上 ' + tOpen + 'ms，上游就绪 ' + ((ev.find(e => e.startsWith('session.created')) || '@没有').split('@')[1]) + 'ms，第一个字 ' + (first || '没有') + 'ms，' + (fin ? '第一句认完在说完' + (fin.at - tSaid >= 0 ? '后 ' + (fin.at - tSaid) : '前 ' + (tSaid - fin.at)) + 'ms ' + JSON.stringify(fin.text) : '没有认完')); resolve(); });
      ws.on('error', e => { ev.push('wserror:' + e.message); });
    });
    await rt('en', en, null);
    await rt('es', esF, 'es');
    await rt('es 长', long, 'es');
  } finally {
    const d = await api('DELETE', '/v1/me', { token: tk });
    console.log('删掉测试账号', d.status, d.text.slice(0, 60));
  }
  process.exit(0);
})().catch(e => { console.log('✗', e && e.stack || e); process.exit(1); });
