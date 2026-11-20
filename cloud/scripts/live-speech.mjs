// 实测别的语言的识别和合成（**会花钱：用的是真的阿里云额度，跑之前先问老板**；跑一遍四门语言约几分钱）
//   cd cloud && node scripts/live-speech.mjs [en es ja zh]
// 做法：本机起一份和线上一样的服务器程序（Miniflare + wrangler 打出来的 dist/index.js），上游接真的阿里云，
// 每门语言合成两句（女声、男声）→ 整段识别（/v1/asr）→ 实时识别（/v1/asr-rt），再拿本机提前配好的课程配音（dist/voice，有才用）识别一遍，
// 用游戏自己的打分（lang-*.js）算分。线上的服务器只能从 iPhone 用 Apple 登录，电脑拿不到登录态，所以不直接打线上。
// 钥匙：只在这个进程里从钥匙文件读出来交给本机的 Worker，不打印、不写文件（ECHO_KEY_FILE 可以换文件；一行 DASHSCOPE_API_KEY=…）。
// 上游地址 DS_HTTP_BASE / DS_WS_BASE 可以用环境变量换（试国际版时）。邮件用假的（读登录码）。结果另存 cloud/dist/live-speech/result.json。
// PATH 里要有 ffmpeg（把合成出来的声音转成 16 kHz 单声道）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startWorker, CLOUD } from '../test/lib.js';
import { startFakes } from '../test/fakes.js';
const ROOT = path.resolve(CLOUD, '..').replace(/\\/g, '/') + '/';
const require = createRequire(ROOT);
const OUT = path.join(CLOUD, 'dist', 'live-speech');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(2);
const DS_HTTP = process.env.DS_HTTP_BASE || 'https://dashscope.aliyuncs.com', DS_WS = process.env.DS_WS_BASE || 'wss://dashscope.aliyuncs.com';

const keyTxt = fs.readFileSync(process.env.ECHO_KEY_FILE || 'D:/Claude/tools/echo-relay/game-key.env', 'utf8');
const km = /^\s*DASHSCOPE_API_KEY\s*=\s*(\S+)\s*$/m.exec(keyTxt);
if (!km || !km[1].startsWith('sk-')) { console.log('✗ 钥匙文件里没有找到钥匙（不打印内容）'); process.exit(2); }
const KEY = km[1];
const scrub = s => String(s).split(KEY).join('sk-***');

const L = require(ROOT + 'lang.js'); require(ROOT + 'lang-es.js'); require(ROOT + 'lang-ja.js'); require(ROOT + 'lang-zh-data.js'); require(ROOT + 'lang-zh.js');
const { key: vkey } = require(ROOT + 'tools/voice/key.js');

// 每门语言：让服务器合成的两句 + 本机配音里现成的一句（课程里的句子）
const PLAN = {
  en: { say: ['I like apples very much.', 'Where is the library?'], clip: null },
  es: { say: ['Me gusta mucho la playa.', '¿Dónde está el faro?'], clip: 'Me llamo Ana.' },
  ja: { say: ['わたしは毎朝六時に起きます。', '図書館はどこですか？'], clip: 'はじめまして、ゆいです。' },
  zh: { say: ['我想喝一杯水。', '图书馆在哪里？'], clip: '我叫小明。' },
};
// 课程里的条目（读音），日语 / 中文打分用
const ENT = {};
for (const l of ['es', 'ja', 'zh']) {
  const cf = ROOT + 'dist/course/' + l + '/course.json', m = new Map();
  ENT[l] = m;
  if (!fs.existsSync(cf)) continue;   // 没生成过课程内容（node tools/course/build.js <语言>）：照样能测，只是不按课程里的读音打分
  const c = JSON.parse(fs.readFileSync(cf, 'utf8'));
  for (const w of c.WORLDS.concat(c.BOOKS.list.flatMap(b => b.units))) { w.sents.forEach(e => m.set(e[0], Object.assign({ t: e[0] }, e[2]))); w.dlgs.forEach(d => { m.set(d[0], Object.assign({ t: d[0] }, d[3].q)); m.set(d[1], Object.assign({ t: d[1] }, d[3].a)); }); }
  ENT[l] = m;
}
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[\s.,!?¿¡。、，！？「」“”"'’…·-]/g, '');
function grade(l, target, heard) {
  if (l === 'en') return norm(target) === norm(heard) ? 100 : null;
  const M = L.get(l), entry = ENT[l].get(target) || { t: target };
  try { const lex = l === 'ja' ? L.lexicon('ja', [...ENT.ja.values()]) : null; const r = M.score(target, heard, { entry, lex }); return typeof r === 'number' ? r : (r && r.score); } catch (e) { return 'ERR ' + e.message; }
}
const wav16 = (inFile, outFile) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inFile, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outFile]); return fs.readFileSync(outFile); };
const pcmOf = wav => { const i = wav.indexOf(Buffer.from('data')); return wav.subarray(i + 8); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const bin = path.join(CLOUD, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  execFileSync(process.execPath, [bin, 'deploy', '--dry-run', '--outdir', 'dist'], { cwd: CLOUD, stdio: 'pipe', env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1' }) });
  const script = path.join(CLOUD, 'dist', 'index.js');
  const F = await startFakes({ jwks: { keys: [] }, asrModel: 'x', asrRtModel: 'x' });
  const A = await startWorker(script, {
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'live-test-pepper',
    DASHSCOPE_API_KEY: KEY, DS_HTTP_BASE: DS_HTTP, DS_WS_BASE: DS_WS,
    ASR_MODEL: 'qwen3-asr-flash', ASR_RT_MODEL: 'qwen3-asr-flash-realtime', TTS_MODEL: 'qwen3-tts-flash',
    EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fake_key', RESEND_API_URL: F.url + '/resend/emails', EMAIL_FROM: 'Echo Island <noreply@example.test>',
    RATE: JSON.stringify({ emailPerAddrHour: 3, emailPerIpHour: 10000, signinPerIpHour: 10000, reportPerUserDay: 3, consentPerUserDay: 5 }),
  }, { RL_AI_USER: 1000, RL_AI_IP: 100000, RL_WS_USER: 1000 });
  const email = 'live-' + Date.now().toString(36) + '@example.test';
  await A.api('POST', '/v1/auth/email/start', { body: { email } });
  const code = /\b(\d{6})\b/.exec(F.mails[F.mails.length - 1].text)[1];
  const tk = (await A.api('POST', '/v1/auth/email/verify', { body: { email, code } })).json.token;
  await A.api('PATCH', '/v1/me', { token: tk, body: { ageGroup: 'adult' } });
  const me = (await A.api('GET', '/v1/me', { token: tk })).json;
  console.log('speechLangs', JSON.stringify(me.speechLangs));

  const rows = [];
  const asr = async (wav, lang) => { const t0 = Date.now(); const r = await A.api('POST', '/v1/asr', { token: tk, body: lang ? { audio: wav.toString('base64'), lang } : { audio: wav.toString('base64') } }); return { st: r.status, text: r.json && r.json.text, err: r.status === 200 ? null : scrub(r.text).slice(0, 300), ms: Date.now() - t0 }; };
  const rt = async (wav, lang) => {
    const t0 = Date.now(), pcm = pcmOf(wav);
    const c = await A.ws('/v1/asr-rt' + (lang ? '?lang=' + lang : ''), { first: tk });
    c.send({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: lang || 'en' }, turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: 500 } } });
    for (let i = 0; i < pcm.length; i += 3200) { c.send({ type: 'input_audio_buffer.append', audio: pcm.subarray(i, i + 3200).toString('base64') }); await sleep(40); }
    const tSaid = Date.now();
    const sil = Buffer.alloc(3200);
    let fin = null;
    for (let i = 0; i < 20 && !fin; i++) { c.send({ type: 'input_audio_buffer.append', audio: sil.toString('base64') }); fin = c.msgs.find(m => /transcription\.completed$/.test(m.type || '') || m.type === 'error'); await sleep(100); }
    if (!fin) fin = await c.next(m => /transcription\.completed$/.test(m.type || '') || m.type === 'error', 6000);
    const tFin = Date.now();
    c.send({ type: 'session.finish' }); await Promise.race([c.done, sleep(2500)]); c.close();
    const types = [...new Set(c.msgs.map(m => m.type))];
    return { text: fin && fin.type !== 'error' ? (fin.transcript || fin.text || '') : null, err: fin && fin.type === 'error' ? scrub(JSON.stringify(fin)).slice(0, 300) : (fin ? null : 'no final; events ' + types.join(',')), lag: tFin - tSaid, ms: tFin - t0, close: c.closed };
  };

  for (const [l, P] of Object.entries(PLAN)) {
    if (ONLY.length && !ONLY.includes(l)) continue;
    const items = [];
    for (let i = 0; i < P.say.length; i++) {
      const g = i % 2 ? 'm' : 'f', text = P.say[i];
      const r = await A.api('POST', '/v1/tts', { token: tk, body: { text, g, lang: l } });
      if (r.status !== 200 || !r.json.url) { rows.push({ l, src: 'tts-' + g, target: text, err: 'TTS ' + r.status + ' ' + scrub(r.text).slice(0, 300) }); continue; }
      const raw = Buffer.from(await (await fetch(r.json.url)).arrayBuffer());
      const f0 = path.join(OUT, 'tts-' + l + '-' + g + path.extname(new URL(r.json.url).pathname || '.wav')), f1 = path.join(OUT, 'tts-' + l + '-' + g + '.16k.wav');
      fs.writeFileSync(f0, raw);
      items.push({ src: '服务器合成（' + g + '）', target: text, wav: wav16(f0, f1), bytes: raw.length });
    }
    if (P.clip) {
      const f = ROOT + 'dist/voice/' + l + '/f/' + vkey(P.clip) + '.ogg';
      if (fs.existsSync(f)) items.push({ src: '课程配音（本机合成）', target: P.clip, wav: wav16(f, path.join(OUT, 'clip-' + l + '.16k.wav')) });
      else rows.push({ l, src: 'clip', target: P.clip, err: '没有这段配音' });
    }
    for (const it of items) {
      const a = await asr(it.wav, l), b = await rt(it.wav, l);
      rows.push({ l, src: it.src, target: it.target, sec: +(pcmOf(it.wav).length / 32000).toFixed(1), asr: a.text, asrErr: a.err, asrMs: a.ms, asrScore: a.text != null ? grade(l, it.target, a.text) : null, rt: b.text, rtErr: b.err, rtLag: b.lag, rtScore: b.text != null ? grade(l, it.target, b.text) : null });
    }
    // 对照：这门语言的声音按英语去听，会听成什么（说明 lang 真的起作用）
    if (l !== 'en' && items[0]) { const a = await asr(items[0].wav, 'en'); rows.push({ l, src: '对照：按英语听', target: items[0].target, asr: a.text, asrErr: a.err }); }
  }
  const used = await A.one('SELECT asr_n, aux_n FROM usage LIMIT 1');
  for (const r of rows) console.log(JSON.stringify(r));
  console.log('用量（本机这份服务器记的）', JSON.stringify(used));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 1));
  await A.dispose(); await F.close();
  process.exit(0);
})().catch(e => { console.log('✗ 没跑起来：' + scrub(e && e.stack || e)); process.exit(1); });
