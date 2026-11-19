// 删号：D1 里这个人的一切马上删掉；Apple 账号撤销 Apple 授权（配了钥匙才撤，没配就跳过、记一句警告）
import { ok, eq, until } from './lib.js';
import { idToken, sha256hex, signJws, verifyEs256Jwt } from './pki.js';

const TABLES = ['sessions', 'usage', 'talk_live', 'consents', 'reports', 'entitlements'];
async function leftovers(X, id, email) {
  const out = {};
  for (const t of TABLES) out[t] = (await X.one('SELECT COUNT(*) AS n FROM ' + t + ' WHERE user_id = ?1', id)).n;
  out.users = (await X.one('SELECT COUNT(*) AS n FROM users WHERE id = ?1', id)).n;
  if (email) out.email_codes = (await X.one('SELECT COUNT(*) AS n FROM email_codes WHERE email = ?1', email)).n;
  return out;
}
const allZero = o => Object.values(o).every(n => n === 0);

export default async function (C) {
  const { A, B, F, K, P } = C;
  // 一个什么都有的孩子账号：会话两个、用量、举报、家长同意、订阅、还在等的登录码
  const kid = await C.signup(A, { age: 'child' });
  await C.signup(A, { email: kid.email });
  await A.api('POST', '/v1/asr', { token: kid.token, body: { audio: 'A'.repeat(1200) } });
  await A.api('POST', '/v1/report', { token: kid.token, body: { npc: 'x', reason: 'rude', turns: [{ who: 'npc', text: 'Something odd' }] } });
  await A.api('POST', '/v1/consent/request', { token: kid.token, body: { parentEmail: C.uniq('par') } });
  const now = Date.now();
  await A.api('POST', '/v1/iap/apple', { token: kid.token, body: { signedTransaction: signJws({ transactionId: 't1', originalTransactionId: 'otid-del-' + now, bundleId: 'com.example.echoisland', productId: 'test.premium.monthly', expiresDate: now + 9e8, signedDate: now, environment: 'Sandbox', appAccountToken: kid.me.iapToken }, P.good) } });
  await A.api('POST', '/v1/auth/email/start', { body: { email: kid.email } });
  await A.run('INSERT INTO talk_live (id, user_id, day, started_at, beat_at, sec) VALUES (?1, ?2, ?3, ?4, ?4, 1)', 't_del', kid.me.id, '2026-01-01', now);
  const before = await leftovers(A, kid.me.id, kid.email);
  ok(Object.values(before).every(n => n >= 1), '删之前每张表里都有这个人的东西', before);
  const del = await A.api('DELETE', '/v1/me', { token: kid.token });
  eq([del.status, del.json], [200, { deleted: true, apple: 'none' }], 'DELETE /v1/me：200（不是 Apple 账号 → apple none）');
  const after = await leftovers(A, kid.me.id, kid.email);
  ok(allZero(after), '删之后：users / 会话 / 用量 / 正在聊 / 同意 / 举报 / 订阅 / 登录码一行不剩', after);
  eq((await A.api('GET', '/v1/me', { token: kid.token })).status, 401, '删号后 token 不能用');
  await A.run('DELETE FROM rl');   // 这个邮箱这一小时已经要过 3 次码了（测试配置的上限）
  const again = await C.signup(A, { email: kid.email });
  ok(again.created === true && again.me.id !== kid.me.id, '同一个邮箱再注册：全新的账号');

  // Apple 账号：配了钥匙 → 用存着的 refresh token 撤销
  const nonce = 'nonce-del-' + Math.random().toString(36).slice(2), base = Math.floor(Date.now() / 1000);
  const claims = { iss: 'https://appleid.apple.com', aud: 'com.example.echoisland', exp: base + 600, iat: base, sub: 'apple-del-' + base, nonce: sha256hex(nonce) };
  const ap = await A.api('POST', '/v1/auth/apple', { body: { identityToken: idToken(K, claims), nonce, authorizationCode: 'code-del-1' } });
  await until(async () => (await A.one('SELECT apple_refresh FROM users WHERE id = ?1', ap.json.me.id)).apple_refresh, 3000);
  const n0 = F.apple.length;
  const d2 = await A.api('DELETE', '/v1/me', { token: ap.json.token, body: {} });
  const rv = F.apple.slice(n0).find(x => x.path === '/apple/auth/revoke');
  ok(d2.json.apple === 'revoked' && rv && rv.form.token === 'rt_code-del-1' && rv.form.token_type_hint === 'refresh_token' && verifyEs256Jwt(rv.form.client_secret, C.key.pub).ok, 'Apple 账号删号：用存着的 refresh token 撤销（client_secret 用 .p8 签）', { apple: d2.json.apple, form: rv && rv.form.token });
  ok(allZero(await leftovers(A, ap.json.me.id)), 'Apple 账号的数据也删干净了');
  // 删号时 App 给了新的授权码：用它换 token 再撤销
  const nonce2 = nonce + 'b', claims2 = Object.assign({}, claims, { sub: 'apple-del2-' + base, nonce: sha256hex(nonce2) });
  const ap2 = await A.api('POST', '/v1/auth/apple', { body: { identityToken: idToken(K, claims2), nonce: nonce2 } });
  const n1 = F.apple.length;
  const d3 = await A.api('DELETE', '/v1/me', { token: ap2.json.token, body: { appleAuthorizationCode: 'fresh-9' } });
  const ex = F.apple.slice(n1);
  ok(d3.json.apple === 'revoked' && ex.some(x => x.path === '/apple/auth/token' && x.form.code === 'fresh-9') && ex.some(x => x.path === '/apple/auth/revoke' && x.form.token === 'rt_fresh-9'), '删号时给了新授权码：换 token 再撤销', ex.map(x => x.path));

  // B 没配 Apple 钥匙：删号照删，撤销跳过
  const nonce3 = nonce + 'c', claims3 = Object.assign({}, claims, { sub: 'apple-del3-' + base, nonce: sha256hex(nonce3) });
  const ap3 = await B.api('POST', '/v1/auth/apple', { body: { identityToken: idToken(K, claims3), nonce: nonce3, authorizationCode: 'code-b' } });
  const n2 = F.apple.length;
  const d4 = await B.api('DELETE', '/v1/me', { token: ap3.json.token });
  ok(d4.status === 200 && d4.json.deleted && d4.json.apple === 'skipped' && F.apple.length === n2, '没配 Apple 钥匙：照样删号，撤销跳过（apple skipped，不连 Apple）', d4.json);
  ok(allZero(await leftovers(B, ap3.json.me.id)), '没配钥匙时数据也删干净了');
}
