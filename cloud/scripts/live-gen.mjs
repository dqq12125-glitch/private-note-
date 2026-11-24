// 「为你出的题」对着真的文字模型试一次（一次不到一分钱；会花钱，先问老板）：
//   cd cloud && node scripts/live-gen.mjs [es|en|ja|zh] [界面语言 zh|en] [难度档 0-4]
// 用 talk-core 的 genBody 拼请求（和手机、中转服务、公开版服务器同一份），打印模型回的原话、核对以后留下几条、花了多久。
// 看的是：句子对不对、是不是只用了给的词、意思是不是界面语言、有没有超长。钥匙只在这个进程里从钥匙文件读（ECHO_KEY_FILE），不打印。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const CORE = require(path.resolve('..', 'talk-core.js'));
const km = /^\s*DASHSCOPE_API_KEY\s*=\s*(\S+)\s*$/m.exec(fs.readFileSync(process.env.ECHO_KEY_FILE || 'D:/Claude/tools/echo-relay/game-key.env', 'utf8'));
if (!km || !km[1].startsWith('sk-')) { console.log('✗ 钥匙文件里没有找到钥匙（不打印内容）'); process.exit(2); }
const KEY = km[1], scrub = s => String(s).split(KEY).join('sk-***');
const lang = process.argv[2] || 'es', ui = process.argv[3] || 'zh', band = +(process.argv[4] || 0);
// 每门语言一份小样：重点练的词（弱的、新学的）、学过的词
const SAMPLE = {
  es: { focus: [{ t: 'nuevo', m: '新的', why: 'weak' }, { t: 'me llamo', m: '我叫……', why: 'weak' }, { t: 'amigo', m: '朋友', why: 'new' }, { t: 'gracias', m: '谢谢', why: 'ok' }],
    known: ['hola', 'adiós', 'sí', 'no', 'buenos días', 'por favor', 'soy', 'tú', 'yo', 'bien'] },
  en: { focus: [{ t: 'library', m: '图书馆', why: 'weak' }, { t: 'borrow', m: '借', why: 'weak' }, { t: 'weekend', m: '周末', why: 'new' }, { t: 'friend', m: '朋友', why: 'ok' }],
    known: ['school', 'book', 'like', 'play', 'football', 'neighbour', 'classmate', 'every day', 'after school', 'homework'] },
  ja: { focus: [{ t: 'ねこ', m: '猫', why: 'weak' }, { t: 'すきです', m: '喜欢', why: 'new' }, { t: 'ともだち', m: '朋友', why: 'ok' }],
    known: ['こんにちは', 'ありがとう', 'わたし', 'いぬ', 'がっこう', 'ほん', 'はい', 'いいえ'] },
  zh: { focus: [{ t: '朋友', m: 'friend', why: 'weak' }, { t: '喜欢', m: 'to like', why: 'new' }, { t: '学校', m: 'school', why: 'ok' }],
    known: ['你好', '谢谢', '我', '你', '是', '不', '邻居', '书', '吃', '苹果'] },
};
const S = SAMPLE[lang] || SAMPLE.es;
const raw = { lang, ui, band, n: 6, dlg: band >= 1 ? 1 : 0, focus: ui === 'en' && lang !== 'zh' ? S.focus.map(x => Object.assign({}, x, { m: '' })) : S.focus, known: S.known, avoid: [] };
// --worker：不直接问模型，而是本机起一份和线上一样的服务器程序（Miniflare + wrangler 打出来的 dist/index.js，上游接真的阿里云），
// 登录一个临时账号，走 POST /v1/gen，再拿第一句走 POST /v1/tts——看的是服务器这条路通不通、扣了几次 aux。
// （线上的服务器只能从 iPhone 用 Apple 登录，电脑拿不到登录态，所以不直接打线上；和 live-speech.mjs 一样的办法）
if (process.argv.includes('--worker')) {
  const { execFileSync } = await import('node:child_process');
  const { startWorker, CLOUD } = await import('../test/lib.js');
  const { startFakes } = await import('../test/fakes.js');
  const bin = path.join(CLOUD, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  execFileSync(process.execPath, [bin, 'deploy', '--dry-run', '--outdir', 'dist'], { cwd: CLOUD, stdio: 'pipe', env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1' }) });
  const F = await startFakes({ jwks: { keys: [] }, asrModel: 'x', asrRtModel: 'x' });
  const A = await startWorker(path.join(CLOUD, 'dist', 'index.js'), {
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'live-test-pepper', DASHSCOPE_API_KEY: KEY,
    DS_HTTP_BASE: process.env.DS_HTTP_BASE || 'https://dashscope.aliyuncs.com', DS_WS_BASE: process.env.DS_WS_BASE || 'wss://dashscope.aliyuncs.com',
    EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fake_key', RESEND_API_URL: F.url + '/resend/emails', EMAIL_FROM: 'Echo Island <noreply@example.test>',
    RATE: JSON.stringify({ emailPerAddrHour: 3, emailPerIpHour: 10000, signinPerIpHour: 10000, reportPerUserDay: 3, consentPerUserDay: 5 }),
  }, { RL_AI_USER: 1000, RL_AI_IP: 100000, RL_WS_USER: 1000 });
  let code = 0;
  try {
    const email = 'live-' + Date.now().toString(36) + '@example.test';
    await A.api('POST', '/v1/auth/email/start', { body: { email } });
    const tk = (await A.api('POST', '/v1/auth/email/verify', { body: { email, code: /\b(\d{6})\b/.exec(F.mails[F.mails.length - 1].text)[1] } })).json.token;
    await A.api('PATCH', '/v1/me', { token: tk, body: { ageGroup: 'adult' } });
    const me = (await A.api('GET', '/v1/me', { token: tk })).json;
    console.log('genLangs ' + JSON.stringify(me.genLangs));
    const t0 = Date.now(), r = await A.api('POST', '/v1/gen', { token: tk, body: raw });
    console.log((r.status === 200 ? '✓' : '✗') + ' POST /v1/gen（' + lang + ' / 界面 ' + ui + ' / 难度档 ' + band + '）：HTTP ' + r.status + '，' + (Date.now() - t0) + ' 毫秒，' + scrub(JSON.stringify(r.json && r.json.quota || r.json)).slice(0, 200));
    if (r.status === 200) {
      r.json.s.forEach(x => console.log('  ' + x.t + '  ｜ ' + x.m + '  ｜ 练的词 ' + (x.f >= 0 ? raw.focus[x.f].t : '（没认出来）')));
      r.json.d.forEach(x => console.log('  问 ' + x.q + ' → 答 ' + x.a + '  ｜ 错的：' + x.x.join(' / ')));
      const t1 = Date.now(), t = await A.api('POST', '/v1/tts', { token: tk, body: lang === 'en' ? { text: r.json.s[0].t } : { text: r.json.s[0].t, lang } });
      console.log((t.status === 200 && t.json.url ? '✓' : '✗') + ' POST /v1/tts（第一句）：HTTP ' + t.status + '，' + (Date.now() - t1) + ' 毫秒，' + (t.json && t.json.url ? '有声音地址' : scrub(JSON.stringify(t.json)).slice(0, 160)));
    } else code = 1;
  } catch (e) { console.log('✗ ' + scrub(e.message)); code = 1; }
  try { await A.close(); } catch (e) { /* 关了 */ }
  try { await F.close(); } catch (e) { /* 关了 */ }
  process.exit(code);
}
const body = CORE.genBody(raw);
if (!body) { console.log('✗ genBody 回的是空的'); process.exit(2); }
const t0 = Date.now();
try {
  const r = await fetch(CORE.EVAL_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  const ms = Date.now() - t0;
  if (!r.ok || !j.choices) { console.log('✗ HTTP ' + r.status + '  ' + scrub(JSON.stringify(j)).slice(0, 300)); process.exit(1); }
  const text = j.choices[0].message.content, out = CORE.parseGen(j, raw);
  console.log('—— ' + lang + ' / 界面 ' + ui + ' / 难度档 ' + band + '：' + ms + ' 毫秒，用量 ' + JSON.stringify(j.usage || {}));
  console.log('模型回的原话：\n' + scrub(text));
  console.log('\n核对以后留下：句子 ' + (out ? out.s.length : 0) + ' / 要 ' + raw.n + '，对话 ' + (out ? out.d.length : 0) + ' / 要 ' + raw.dlg);
  if (out) { out.s.forEach(x => console.log('  ' + x.t + '  ｜ ' + x.m + '  ｜ 练的词 ' + (x.f >= 0 ? raw.focus[x.f].t : '（没认出来）'))); out.d.forEach(x => console.log('  问 ' + x.q + ' → 答 ' + x.a + '  ｜ 错的：' + x.x.join(' / '))); }
} catch (e) { console.log('✗ 连不上 ' + scrub(e.message)); process.exit(1); }
