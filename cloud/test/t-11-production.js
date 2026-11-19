// 正式环境的保护（ENVIRONMENT=production）：测试钩子不认、上游只许 *.aliyuncs.com、邮件不许只打印到日志、
// 默认只信 Apple Root CA - G3（测试自己造的根不认）
import crypto from 'node:crypto';
import { ok, eq } from './lib.js';
import { signJws } from './pki.js';

export default async function (C) {
  const { F, P } = C;
  const W = await C.startWorker(C.script, {
    ENVIRONMENT: 'production', TEST_HOOKS: '1', AUTH_PEPPER: 'prod-pepper', DASHSCOPE_API_KEY: 'sk-fake-prod',
    DS_HTTP_BASE: F.url, DS_WS_BASE: F.url.replace(/^http/, 'ws'), EMAIL_PROVIDER: 'console',
    APPLE_BUNDLE_ID: 'com.example.echoisland', APPLE_PRODUCTS: JSON.stringify({ 'test.premium.monthly': 'monthly' }),
  }, C.rl);
  try {
    // 直接在库里建一个账号和会话（正式环境里没法用测试邮箱登录）
    const token = 'eis_' + crypto.randomBytes(32).toString('base64url'), now = Date.now();
    await W.run('INSERT INTO users (id, email, age_group, tz_min, tz_at, iap_token, created_at) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5)', 'u_prod', 'p@example.test', 'adult', crypto.randomUUID(), now);
    await W.run('INSERT INTO sessions (hash, user_id, kind, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)', crypto.createHash('sha256').update(token).digest('hex'), 'u_prod', 'email', now, now + 86400000);
    const far = await W.api('GET', '/v1/me', { token, now: now + 400 * 86400000 });
    eq(far.status, 200, '正式环境不认 x-test-now（会话没有因为「假装 400 天后」过期）');
    const h0 = F.http.length;
    const zh = await W.api('POST', '/v1/zh', { token, body: { text: 'Hello' } });
    ok(zh.status === 503 && zh.json.error === 'unavailable' && zh.json.what === 'ds' && F.http.length === h0, '上游地址不是 *.aliyuncs.com：不连（503 unavailable），一个请求都没发出去', zh.json);
    eq((await W.one('SELECT aux_n FROM usage WHERE user_id = ?1', 'u_prod') || { aux_n: 0 }).aux_n, 0, '没连上游的那次不算');
    const m0 = F.mails.length;
    const mail = await W.api('POST', '/v1/auth/email/start', { body: { email: 'kid@example.test' } });
    ok(mail.status === 503 && mail.json.what === 'email' && F.mails.length === m0, '正式环境的邮件不能只打印到日志：503 unavailable email', mail.json);
    const tx = { transactionId: 't', originalTransactionId: 'o-prod', bundleId: 'com.example.echoisland', productId: 'test.premium.monthly', expiresDate: now + 9e8, signedDate: now, environment: 'Production' };
    const iap = await W.api('POST', '/v1/iap/apple', { token, body: { signedTransaction: signJws(tx, P.good) } });
    eq([iap.status, iap.json.reason], [400, 'chain'], '默认只信 Apple Root CA - G3：测试自己造的根不认');
  } finally { await W.dispose(); }
}
