// 回声岛公开版服务器的测试：cd cloud && npm test
// 1) 用 wrangler 打包（wrangler deploy --dry-run，和部署的是同一份 dist/index.js，连带仓库根目录的 talk-core.js 等）
// 2) 起假上游（阿里云 / Resend / Apple，都在本机）、造测试证书链
// 3) 起两个本机 Worker（Miniflare，里面是 workerd）：A 配齐了，B 是「Apple 钥匙、管理口令没配」+ 每段聊天最长 3 秒
// 4) 跑 test/t-*.js；每个检查打一行 ✓ / ✗，最后退出码 = 没过的个数
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { T, startWorker, CLOUD, section } from './lib.js';
import { startFakes } from './fakes.js';
import { makeChain, makeCert, selfCheck, appleIdKeys, p8, OID_LEAF } from './pki.js';

const t0 = Date.now();
const only = process.argv.slice(2);
function build() {
  const bin = path.join(CLOUD, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!fs.existsSync(bin)) { console.log('✗ cloud/node_modules 没装：先 cd cloud && npm install'); process.exit(1); }
  execFileSync(process.execPath, [bin, 'deploy', '--dry-run', '--outdir', 'dist'], { cwd: CLOUD, stdio: 'pipe', env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1' }) });
  return path.join(CLOUD, 'dist', 'index.js');
}

(async () => {
  section('打包');
  const script = build();
  console.log('✓ wrangler 打包成功（' + Math.round(fs.statSync(script).size / 1024) + ' KB）');
  T.pass++;
  const P = { good: makeChain('Good'), evil: makeChain('Evil') };
  P.broken = makeChain('Broken', { leafSigner: P.evil.interKey.privateKey, leafIssuerCn: 'Good Intermediate' });   // 名字对得上、签名对不上
  // 好的中间证书签的、但已经过期的叶子
  const ol = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }), Y = 365 * 86400000;
  P.expiredLeaf = { key: ol, der: makeCert({ cn: 'Good Signing', issuerCn: 'Good Intermediate', pub: ol.publicKey, issuerKey: P.good.interKey.privateKey, hash: 'sha384', from: Date.now() - 3 * Y, to: Date.now() - Y, ca: false, marks: [OID_LEAF] }) };
  if (!selfCheck(P.good)) { console.log('✗ 测试证书链自己就不对（OpenSSL 验不过）'); process.exit(1); }
  const K = appleIdKeys(), key = p8();
  const models = { asrModel: 'qwen3-asr-flash', asrRtModel: 'qwen3-asr-flash-realtime' };
  const F = await startFakes(Object.assign({ jwks: K.jwks }, models));
  const dataKey = crypto.randomBytes(32).toString('base64');
  const base = {
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'test-pepper',
    DASHSCOPE_API_KEY: 'sk-fake-cloud-key', DS_HTTP_BASE: F.url, DS_WS_BASE: F.url.replace(/^http/, 'ws'),
    EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fake_key', RESEND_API_URL: F.url + '/resend/emails', EMAIL_FROM: 'Echo Island <noreply@example.test>',
    APPLE_BUNDLE_ID: 'com.example.echoisland', APPLE_PRODUCTS: JSON.stringify({ 'test.premium.monthly': 'monthly', 'test.premium.yearly': 'yearly' }),
    APPLE_ENVIRONMENTS: 'Production,Sandbox', APPLE_ROOT_SHA256: P.good.fp, APPLE_JWKS_URL: F.url + '/apple/auth/keys', APPLE_AUTH_BASE: F.url + '/apple',
    TALK_WARN_SEC: '2', TALK_MIN_START_SEC: '2', TALK_BEAT_SEC: '1', TALK_STALE_SEC: '3', WS_AUTH_WAIT_SEC: '2',
    RATE: JSON.stringify({ emailPerAddrHour: 3, emailPerIpHour: 10000, signinPerIpHour: 10000, reportPerUserDay: 3, consentPerUserDay: 5 }),
  };
  const rl = { RL_AI_USER: 20, RL_AI_IP: 100000, RL_WS_USER: 1000 };
  const A = await startWorker(script, Object.assign({}, base, { ADMIN_TOKEN: 'admin-test-token', APPLE_TEAM_ID: 'TEAM123456', APPLE_SIGNIN_KEY_ID: 'KEY1234567', APPLE_SIGNIN_KEY: key.pem, DATA_KEY: dataKey }), rl);
  const B = await startWorker(script, Object.assign({}, base, { TALK_SESSION_MAX_SEC: '3' }), rl);

  let n = 0;
  const ctx = { A, B, F, P, K, key, models, dataKey, script, rl, startWorker, uniq: tag => (tag || 'u') + (++n) + '-' + Date.now().toString(36) + '@example.test' };
  // 邮箱注册 / 登录一条龙：发码 → 从假邮箱里读码 → 验证。返回 { token, me, created }
  ctx.signup = async (X, o) => {
    o = o || {};
    const email = o.email || ctx.uniq(o.tag);
    const before = F.mails.length;
    const s = await X.api('POST', '/v1/auth/email/start', { body: { email, ui: o.ui }, now: o.now });
    if (s.status !== 200) return { status: s.status, json: s.json, email };
    const mail = F.mails.slice(before).reverse().find(m => m.to && m.to[0] === email);
    const code = mail && /\b(\d{6})\b/.exec(mail.text)[1];
    const v = await X.api('POST', '/v1/auth/email/verify', { body: { email, code, tzOffsetMin: o.tz, ui: o.ui }, now: o.now });
    const out = Object.assign({ email, code, status: v.status }, v.json);
    if (o.age && out.token) await X.api('PATCH', '/v1/me', { token: out.token, body: { ageGroup: o.age }, now: o.now });
    return out;
  };

  const files = fs.readdirSync(path.join(CLOUD, 'test')).filter(f => /^t-.*\.js$/.test(f)).sort().filter(f => !only.length || only.some(o => f.includes(o)));
  for (const f of files) {
    section(f);
    try { await (await import('./' + f)).default(ctx); }
    catch (e) { T.fail++; T.fails.push(f); console.log('✗ ' + f + ' 抛出了异常：' + (e && e.stack || e)); }
  }
  await Promise.all([A.dispose(), B.dispose()]);
  await F.close();
  console.log('\n—— 云端服务器测试：通过 ' + T.pass + '，失败 ' + T.fail + '，用了 ' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒');
  if (T.fail) console.log('没过的：\n  ' + T.fails.join('\n  '));
  process.exit(T.fail);
})().catch(e => { console.log('✗ 测试没跑起来：' + (e && e.stack || e)); process.exit(1); });
