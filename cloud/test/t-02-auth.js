// 登录：邮箱验证码、Sign in with Apple、会话过期 / 往后推、退出；/v1/me 的修改规矩
import { ok, eq, until } from './lib.js';
import { idToken, sha256hex, verifyEs256Jwt } from './pki.js';

const DAY = 86400000;
export default async function (C) {
  const { A, F, K } = C;

  // ---------- 邮箱 ----------
  const email = C.uniq('mail');
  const n0 = F.mails.length;
  const s = await A.api('POST', '/v1/auth/email/start', { body: { email: '  ' + email.toUpperCase() + ' ', ui: 'zh' } });
  eq([s.status, s.json], [200, { ok: true, expiresInSec: 600 }], '要登录码：200，10 分钟有效');
  const mail = F.mails[n0];
  ok(mail && mail.to[0] === email && mail.auth === 'Bearer re_fake_key' && /回声岛登录码/.test(mail.subject), '登录码邮件经 Resend 适配器发到小写后的地址（中文）', mail && { to: mail.to, subject: mail.subject });
  const code = /\b(\d{6})\b/.exec(mail.text)[1];
  const badMail = await A.api('POST', '/v1/auth/email/start', { body: { email: 'not-an-email' } });
  eq([badMail.status, badMail.json.field], [400, 'email'], '邮箱格式不对：400 field email');
  const wrong = await A.api('POST', '/v1/auth/email/verify', { body: { email, code: code === '000000' ? '111111' : '000000' } });
  eq([wrong.status, wrong.json.error, wrong.json.reason], [401, 'auth', 'code'], '码不对：401 reason code');
  const v = await A.api('POST', '/v1/auth/email/verify', { body: { email, code, tzOffsetMin: 600, ui: 'zh' } });
  ok(v.status === 200 && /^eis_[A-Za-z0-9_-]{43}$/.test(v.json.token) && v.json.created === true && v.json.me.email === email, '码对了：200，新账号，token 格式对', v.json);
  ok(v.json.me.tzOffsetMin === 600 && v.json.me.ui === 'zh' && v.json.me.ageGroup === null && v.json.me.plan === 'free' && /^[0-9a-f-]{36}$/.test(v.json.me.iapToken), 'me：时区 600、界面中文、年龄段没问、免费档、有 iapToken', v.json.me);
  const tok = v.json.token;
  const row = await A.one('SELECT * FROM sessions WHERE user_id = ?1', v.json.me.id);
  ok(row && row.hash !== tok && row.hash.length === 64, '会话只存 token 的 SHA-256');
  const codes = await A.one('SELECT COUNT(*) AS n FROM email_codes WHERE email = ?1', email);
  eq(codes.n, 0, '码用过就删');
  const again = await A.api('POST', '/v1/auth/email/verify', { body: { email, code } });
  eq([again.status, again.json.reason], [401, 'expired'], '同一个码不能用第二次');
  const me = await A.api('GET', '/v1/me', { token: tok });
  eq([me.status, me.json.id], [200, v.json.me.id], 'GET /v1/me：200');
  // 再登录一次：同一个账号
  const v2 = await C.signup(A, { email });
  eq([v2.created, v2.me && v2.me.id], [false, v.json.me.id], '同一个邮箱再登录：同一个账号，created=false');
  // 错 5 次：这个码作废（429）
  const e3 = C.uniq('tries');
  await A.api('POST', '/v1/auth/email/start', { body: { email: e3 } });
  let last;
  for (let i = 0; i < 6; i++) last = await A.api('POST', '/v1/auth/email/verify', { body: { email: e3, code: '999999' } });
  const real = /\b(\d{6})\b/.exec(F.mails.filter(m => m.to[0] === e3).pop().text)[1];
  const late = await A.api('POST', '/v1/auth/email/verify', { body: { email: e3, code: real } });
  ok(last.status === 429 && late.status === 429 && late.json.error === 'rate', '错 5 次以后对的码也不认：429 rate', { last: last.status, late: late.status });
  // 同一个邮箱每小时最多要 3 次码（测试配置）
  const e4 = C.uniq('rl');
  const r = [];
  for (let i = 0; i < 4; i++) r.push(await A.api('POST', '/v1/auth/email/start', { body: { email: e4 } }));
  ok(r.slice(0, 3).every(x => x.status === 200) && r[3].status === 429 && r[3].json.error === 'rate' && +r[3].headers.get('retry-after') > 0, '同一个邮箱第 4 次要码：429，带 Retry-After', r.map(x => x.status));
  const keys = await A.all('SELECT k FROM rl');
  ok(keys.length && keys.every(x => !x.k.includes('@') && !x.k.includes('example')), '限流表里没有原始邮箱');

  // ---------- 会话过期、往后推、退出 ----------
  const S = await C.signup(A);
  const now = Date.now();
  const d100 = await A.api('GET', '/v1/me', { token: S.token, now: now + 100 * DAY });
  eq(d100.status, 200, '100 天后还能用');
  await until(async () => (await A.one('SELECT expires_at FROM sessions WHERE user_id = ?1', S.me.id)).expires_at > now + 270 * DAY, 2000);
  const d250 = await A.api('GET', '/v1/me', { token: S.token, now: now + 250 * DAY });
  eq(d250.status, 200, '用过一次以后往后推：250 天时还能用（从第 100 天算 180 天）');
  const d500 = await A.api('GET', '/v1/me', { token: S.token, now: now + 500 * DAY });
  eq([d500.status, d500.json.reason], [401, 'expired'], '180 天没用：401 expired');
  const S2 = await C.signup(A, { email: S.email });
  const out = await A.api('POST', '/v1/auth/signout', { token: S2.token, body: {} });
  eq(out.status, 200, '退出：200');
  eq((await A.api('GET', '/v1/me', { token: S2.token })).status, 401, '退出以后这个 token 不能用');
  const S3 = await C.signup(A, { email: S.email }), S4 = await C.signup(A, { email: S.email });
  await A.api('POST', '/v1/auth/signout', { token: S3.token, body: { all: true } });
  eq((await A.api('GET', '/v1/me', { token: S4.token })).status, 401, '退出所有设备：别的 token 也不能用了');

  // ---------- /v1/me 的修改 ----------
  const P = await C.signup(A, { tz: 480 });
  let p = await A.api('PATCH', '/v1/me', { token: P.token, body: { ageGroup: 'teen', ui: 'en', level: 3 } });
  ok(p.status === 200 && p.json.ageGroup === 'teen' && p.json.ui === 'en' && p.json.level === 3, '改年龄段、界面语言、级别', p.json);
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { level: 9 } });
  eq([p.status, p.json.field], [400, 'level'], '级别超出 0–5：400');
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { ageGroup: 'child' } });
  eq([p.status, p.json.ageGroup], [200, 'child'], '年龄段改小：可以');
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { ageGroup: 'adult' } });
  eq([p.status, p.json.error, p.json.reason], [409, 'conflict', 'age_locked'], '孩子自己改大：409 age_locked');
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { tzOffsetMin: 600 } });
  eq(p.json.tzOffsetMin, 480, '注册时报过时区，7 天内再改：不认（还是 480）');
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { tzOffsetMin: 603 }, now: Date.now() + 8 * DAY });
  eq(p.json.tzOffsetMin, 600, '过了 7 天再改：认（按 15 分钟取整 603 → 600）');
  p = await A.api('PATCH', '/v1/me', { token: P.token, body: { tzOffsetMin: -900 }, now: Date.now() + 20 * DAY });
  eq(p.json.tzOffsetMin, -720, '时区夹在 −720…+840');

  // ---------- Sign in with Apple ----------
  const base = Math.floor(Date.now() / 1000);
  const claims = (o) => Object.assign({ iss: 'https://appleid.apple.com', aud: 'com.example.echoisland', exp: base + 600, iat: base, sub: 'apple-sub-' + Math.random().toString(36).slice(2) }, o);
  const nonce = () => 'nonce-' + Math.random().toString(36).slice(2) + '-' + Date.now();
  const sign = (c, n, o) => idToken(K, Object.assign({ nonce: sha256hex(n) }, c), o);
  const apple = (tokenStr, n, extra) => A.api('POST', '/v1/auth/apple', { body: Object.assign({ identityToken: tokenStr, nonce: n, tzOffsetMin: -300 }, extra) });
  let n1 = nonce(), c1 = claims();
  const a1 = await apple(sign(c1, n1), n1);
  ok(a1.status === 200 && a1.json.created && a1.json.me.apple === true && a1.json.me.email === null && a1.json.me.tzOffsetMin === -300, 'Apple 登录：新账号、没有邮箱、时区 −300', a1.json);
  const replay = await apple(sign(c1, n1), n1);
  eq([replay.status, replay.json.reason], [401, 'apple'], '同一个 nonce 再用：401');
  const n2 = nonce(), a2 = await apple(sign(c1, n2), n2);
  eq([a2.status, a2.json.created, a2.json.me && a2.json.me.id], [200, false, a1.json.me.id], '同一个 Apple ID 再登录：同一个账号');
  const bads = [
    ['aud 不是我们的 Bundle ID', claims({ sub: c1.sub, aud: 'com.other.app' })],
    ['iss 不是 Apple', claims({ iss: 'https://evil.example' })],
    ['过期的令牌', claims({ exp: base - 10 })],
  ];
  for (const [what, c] of bads) { const n = nonce(); const r2 = await apple(sign(c, n), n); eq([r2.status, r2.json.reason], [401, 'apple'], 'Apple：' + what + ' → 401'); }
  let nn = nonce();
  let r3 = await apple(sign(claims(), nn), nonce());
  eq(r3.status, 401, 'Apple：nonce 对不上 → 401');
  nn = nonce(); r3 = await apple(sign(claims(), nn, { key: K.other }), nn);
  eq(r3.status, 401, 'Apple：别的钥匙签的（kid 一样）→ 401');
  nn = nonce(); r3 = await apple(sign(claims(), nn, { kid: 'unknown-kid' }), nn);
  eq(r3.status, 401, 'Apple：不认识的 kid → 401');
  // 苹果给的邮箱核实过、又已经有这个邮箱的账号：连上同一个账号；带授权码 → 换 refresh token 加密存起来
  const E = await C.signup(A);
  nn = nonce();
  const before = F.apple.length;
  const a3 = await apple(sign(claims({ email: E.email, email_verified: 'true' }), nn), nn, { authorizationCode: 'code-link-1' });
  eq([a3.status, a3.json.me && a3.json.me.id, a3.json.me && a3.json.me.apple], [200, E.me.id, true], 'Apple 邮箱和老账号一样：连到老账号上');
  const stored = await until(async () => (await A.one('SELECT apple_refresh FROM users WHERE id = ?1', E.me.id)).apple_refresh, 3000);
  ok(stored && stored.startsWith('v1.') && !stored.includes('rt_code-link-1'), 'Apple 的 refresh token 加密存着（不是原文）', stored);
  const tx = F.apple.slice(before).find(x => x.path === '/apple/auth/token');
  const cs = tx && verifyEs256Jwt(tx.form.client_secret, C.key.pub);
  ok(tx && tx.form.code === 'code-link-1' && tx.form.grant_type === 'authorization_code' && cs.ok && cs.header.kid === 'KEY1234567' && cs.claims.iss === 'TEAM123456' && cs.claims.sub === 'com.example.echoisland' && cs.claims.aud === 'https://appleid.apple.com',
    'client_secret 是用 .p8 签的 ES256 JWT（iss = Team ID、sub = Bundle ID、aud = Apple）', cs && cs.claims);
}
