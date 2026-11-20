// 别的语言的课（西语 / 日语 / 中文）的识别和合成（API.md §8 的 lang）：
// 认 en / es / ja / zh；没给 lang = 发给上游的和以前一字不差；每种语言发给上游的样子；不认得的 400（不扣次数、不连上游）；
// 每次照样只算一次（识别算 asr、合成算 aux）；GET /v1/me 的 speechLangs；SPEECH_LANGS 关掉的语言、TTS_VOICES 改音色
import crypto from 'node:crypto';
import { ok, eq } from './lib.js';

const LANGS = { es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
const SAY = { es: 'Hola amigo', ja: 'こんにちは', zh: '你好' };
export default async function (C) {
  const { A, F } = C;
  const U = await C.signup(A, { age: 'child' });   // 孩子、没有家长同意：读句子的识别和合成不挡（和英语一样）
  const tk = U.token;
  const used = async () => (await A.one('SELECT asr_n, aux_n FROM usage WHERE user_id = ?1', U.me.id)) || { asr_n: 0, aux_n: 0 };
  const me = (await A.api('GET', '/v1/me', { token: tk })).json;
  eq(me.speechLangs, ['en', 'es', 'ja', 'zh'], 'GET /v1/me：speechLangs 列出服务器能识别、合成的语言（英语打头）');
  ok(me.features.talk === false, '（这个账号是没有家长同意的孩子：聊天被挡，下面的识别 / 合成照样能用）');

  // ---------- POST /v1/asr ----------
  const audio = 'UklGR' + 'B'.repeat(2000);
  const asrBody = language => JSON.stringify({ model: 'qwen3-asr-flash', stream: false, asr_options: { language, enable_itn: false }, messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + audio } }] }] });
  const asr = async body => { const h0 = F.http.length, n0 = (await used()).asr_n; const r = await A.api('POST', '/v1/asr', { token: tk, body }); return { r, ups: F.http.slice(h0), dn: (await used()).asr_n - n0 }; };
  let x = await asr({ audio });
  ok(x.r.status === 200 && x.ups.length === 1 && x.ups[0].raw === asrBody('en') && x.dn === 1, '/v1/asr 没给 lang：发给上游的请求体和以前一字不差（英语），算一次', x.ups[0] && x.ups[0].raw.slice(0, 160));
  x = await asr({ audio, lang: 'en' });
  ok(x.r.status === 200 && x.ups.length === 1 && x.ups[0].raw === asrBody('en') && x.dn === 1, "/v1/asr lang 'en'：和没给一样");
  for (const l of Object.keys(LANGS)) {
    x = await asr({ audio, lang: l });
    ok(x.r.status === 200 && x.r.json.text === 'I like apples' && x.r.json.quota.meter === 'asr' && x.ups.length === 1 && x.ups[0].raw === asrBody(l) && x.dn === 1,
      "/v1/asr lang '" + l + "'：上游的 asr_options.language 是 " + l + '（别的一字不差），回听写结果，算一次', { st: x.r.status, j: x.r.json, up: x.ups[0] && x.ups[0].body && x.ups[0].body.asr_options, dn: x.dn });
  }
  for (const v of ['fr', 'EN', 'Spanish', 'constructor', 5, true]) {
    x = await asr({ audio, lang: v });
    ok(x.r.status === 400 && x.r.json.error === 'bad_request' && x.r.json.field === 'lang' && x.r.json.reason === 'unsupported_lang' && JSON.stringify(x.r.json.supported) === JSON.stringify(['en', 'es', 'ja', 'zh']) && !x.ups.length && x.dn === 0,
      '/v1/asr lang ' + JSON.stringify(v) + '：400 bad_request（field lang、reason unsupported_lang、supported），不连上游、不扣次数', x.r.json);
  }

  // ---------- POST /v1/tts（另一个账号：测试配置每个账号每分钟 20 次 AI 调用） ----------
  const U2 = await C.signup(A, { age: 'child' });
  const used2 = async () => (await A.one('SELECT aux_n FROM usage WHERE user_id = ?1', U2.me.id)) || { aux_n: 0 };
  const ttsBody = (text, voice, type) => JSON.stringify({ model: 'qwen3-tts-flash', input: { text, voice, language_type: type } });
  const tts = async body => { const h0 = F.http.length, n0 = (await used2()).aux_n; const r = await A.api('POST', '/v1/tts', { token: U2.token, body }); return { r, ups: F.http.slice(h0), dn: (await used2()).aux_n - n0 }; };
  for (const [what, extra] of [['没给 lang', {}], ["lang 'en'", { lang: 'en' }], ["以前的 lang 'English'", { lang: 'English' }]]) {
    for (const g of ['f', 'm']) {
      x = await tts(Object.assign({ text: 'Hello there', g }, extra));
      ok(x.r.status === 200 && x.r.json.url === 'https://dashscope-result.example/audio.wav' && x.ups.length === 1 && x.ups[0].raw === ttsBody('Hello there', g === 'm' ? 'Aiden' : 'Jennifer', 'English') && x.dn === 1,
        '/v1/tts ' + what + '（' + g + '）：发给上游的和以前一字不差（英语、' + (g === 'm' ? 'Aiden' : 'Jennifer') + '），算一次', x.ups[0] && x.ups[0].raw);
    }
  }
  for (const l of Object.keys(LANGS)) {
    for (const g of ['f', 'm']) {
      x = await tts({ text: SAY[l], g, lang: l });
      ok(x.r.status === 200 && x.r.json.url && x.ups.length === 1 && x.ups[0].raw === ttsBody(SAY[l], g === 'm' ? 'Ethan' : 'Cherry', LANGS[l]) && x.dn === 1,
        "/v1/tts lang '" + l + "'（" + g + '）：language_type ' + LANGS[l] + '、这门语言的默认音色，算一次', x.ups[0] && x.ups[0].raw);
    }
  }
  x = await tts({ text: 'Hola', lang: 'Spanish' });
  ok(x.r.status === 200 && x.ups[0] && x.ups[0].body.input.language_type === 'Spanish' && x.ups[0].body.input.voice === 'Cherry', "/v1/tts 也认 'Spanish' 这种写法（和以前的 'Chinese' 一样）", x.ups[0] && x.ups[0].body);
  x = await tts({ text: '你好', lang: 'Chinese' });
  ok(x.r.status === 200 && x.ups[0] && x.ups[0].body.input.language_type === 'Chinese', "/v1/tts 以前的 'Chinese' 照样认（音色换成中文的那一个）", x.ups[0] && x.ups[0].body);
  for (const v of ['fr', 'French', 'english', 'constructor']) {
    x = await tts({ text: 'Bonjour', lang: v });
    ok(x.r.status === 400 && x.r.json.field === 'lang' && x.r.json.reason === 'unsupported_lang' && !x.ups.length && x.dn === 0, '/v1/tts lang ' + JSON.stringify(v) + '：400，不连上游、不扣次数', x.r.json);
  }

  // ---------- WS /v1/asr-rt ----------
  // 连一次：发 session.update（手机自己写的语言故意写成 fr——服务器不看）+ 一段声音 + 结束，拿假上游收到的 session.update
  const rt = async (qs, clientLang) => {
    const w0 = F.ws.length, n0 = (await used()).asr_n;
    const c = await A.ws('/v1/asr-rt' + qs, { first: tk });
    c.send({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: clientLang || 'fr' }, turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: 500 } } });
    c.send({ type: 'input_audio_buffer.append', audio: 'AAAA' });
    c.send({ type: 'session.finish' });
    const err = await c.next(m => m.type === 'error' || m.type === 'session.finished', 4000);
    await c.done;
    const up = F.ws.slice(w0);
    return { err: err && err.type === 'error' ? err : null, up, su: up[0] && up[0].msgs.find(m => m.type === 'session.update'), close: c.closed, dn: (await used()).asr_n - n0 };
  };
  const rtSu = language => JSON.stringify({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language }, turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: 500 } } });
  let w = await rt('', 'en');
  ok(!w.err && w.up.length === 1 && w.su && JSON.stringify(w.su) === rtSu('en') && w.dn === 1, '/v1/asr-rt 没给 lang：发给上游的 session.update 和以前一字不差（英语），算一次', w.su);
  w = await rt('');
  ok(!w.err && w.su && w.su.session.input_audio_transcription.language === 'en', '/v1/asr-rt：手机 session.update 里自己写的语言不看（没给 lang 就是英语）', w.su && w.su.session);
  for (const l of Object.keys(LANGS)) {
    w = await rt('?lang=' + l);
    ok(!w.err && w.up.length === 1 && JSON.stringify(w.su) === rtSu(l) && w.dn === 1, '/v1/asr-rt ?lang=' + l + '：上游听 ' + l + '（别的一字不差），算一次', w.su);
  }
  w = await rt('?lang=en');
  ok(!w.err && JSON.stringify(w.su) === rtSu('en'), '/v1/asr-rt ?lang=en：和没给一样');
  for (const v of ['fr', 'Spanish', 'constructor']) {
    w = await rt('?lang=' + encodeURIComponent(v));
    ok(w.err && w.err.code === 'bad_request' && w.err.status === 400 && w.err.field === 'lang' && w.err.reason === 'unsupported_lang' && /语言|language/.test(w.err.zh) && w.close && w.close.code === 4400 && !w.up.length && w.dn === 0,
      '/v1/asr-rt ?lang=' + v + '：error bad_request 400（field lang），关 4400，不连上游、不扣次数', { err: w.err, close: w.close, up: w.up.length, dn: w.dn });
  }

  // ---------- 配置：SPEECH_LANGS 关掉几种、TTS_VOICES 改音色 ----------
  const X = await C.startWorker(C.script, Object.assign({
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'test-pepper', DASHSCOPE_API_KEY: 'sk-fake-cloud-key', DS_HTTP_BASE: F.url, DS_WS_BASE: F.url.replace(/^http/, 'ws'), EMAIL_PROVIDER: 'console',
    SPEECH_LANGS: 'es,fr,es,constructor', TTS_VOICES: JSON.stringify({ es: { f: 'VoiceEsF' } }),
  }), C.rl);
  try {
    const token = 'eis_' + crypto.randomBytes(32).toString('base64url'), now = Date.now();
    await X.run('INSERT INTO users (id, email, age_group, tz_min, tz_at, iap_token, created_at) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5)', 'u_lang', 'l@example.test', 'adult', crypto.randomUUID(), now);
    await X.run('INSERT INTO sessions (hash, user_id, kind, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)', crypto.createHash('sha256').update(token).digest('hex'), 'u_lang', 'email', now, now + 86400000);
    eq((await X.api('GET', '/v1/me', { token })).json.speechLangs, ['en', 'es'], "SPEECH_LANGS='es,fr,es,constructor'：只剩认得的、不重复，英语一直在");
    const j = (await X.api('POST', '/v1/asr', { token, body: { audio, lang: 'ja' } })).json;
    ok(j.error === 'bad_request' && j.reason === 'unsupported_lang' && JSON.stringify(j.supported) === '["en","es"]', '关掉的语言（ja）：400，supported 只列开着的', j);
    const h0 = F.http.length;
    await X.api('POST', '/v1/tts', { token, body: { text: 'Hola', g: 'f', lang: 'es' } });
    await X.api('POST', '/v1/tts', { token, body: { text: 'Hola', g: 'm', lang: 'es' } });
    await X.api('POST', '/v1/tts', { token, body: { text: 'Hello', g: 'f' } });
    const v = F.http.slice(h0).map(r => r.body.input.voice);
    eq(v, ['VoiceEsF', 'Ethan', 'Jennifer'], 'TTS_VOICES 只改了西语女声：西语男声用默认、英语照旧');
  } finally { await X.dispose(); }
}
