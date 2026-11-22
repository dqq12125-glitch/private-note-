// 订阅（App Store 内购）：验签（证书链、签名、bundleId、产品、环境）、按 originalTransactionId 只存一行、
// 免费 / 月付 / 年付的额度、过期、属于别的账号；服务器通知：退款、宽限期、到期、去重、没人认领的按 appAccountToken 找主人
import crypto from 'node:crypto';
import { ok, eq } from './lib.js';
import { signJws } from './pki.js';

const DAY = 86400000;
export default async function (C) {
  const { A, P } = C;
  const now = Date.now();
  const mkTx = (U, o) => Object.assign({
    transactionId: 'tx' + crypto.randomBytes(6).toString('hex'), originalTransactionId: 'otid' + crypto.randomBytes(6).toString('hex'),
    bundleId: 'com.example.echoisland', productId: 'test.premium.monthly', purchaseDate: now - DAY, originalPurchaseDate: now - DAY,
    expiresDate: now + 29 * DAY, type: 'Auto-Renewable Subscription', inAppOwnershipType: 'PURCHASED', signedDate: now,
    environment: 'Production', appAccountToken: U ? U.me.iapToken : undefined, transactionReason: 'PURCHASE', storefront: 'AUS',
  }, o);
  const post = (U, jws) => A.api('POST', '/v1/iap/apple', { token: U.token, body: { signedTransaction: jws } });
  const me = async U => (await A.api('GET', '/v1/me', { token: U.token })).json;

  // ---------- 月付：正常买 ----------
  const M = await C.signup(A, { age: 'adult' });
  const t1 = mkTx(M);
  const r1 = await post(M, signJws(t1, P.good));
  ok(r1.status === 200 && r1.json.subscription.state === 'active' && r1.json.subscription.plan === 'monthly' && r1.json.me.plan === 'monthly', '月付：验签通过，active，档位 monthly', r1.json);
  eq([r1.json.me.quota.talk.limitSec, r1.json.me.quota.asr.limit, r1.json.me.quota.aux.limit], [1800, 1500, 1500], '月付的额度：每天 30 分钟、1500、1500');
  eq(r1.json.subscription.expiresAt, new Date(t1.expiresDate).toISOString(), '到期时间照交易里的 expiresDate');
  const r1b = await post(M, signJws(Object.assign({}, t1, { signedDate: now + 1000 }), P.good));
  const rows = await A.all('SELECT * FROM entitlements WHERE otid = ?1', t1.originalTransactionId);
  ok(r1b.status === 200 && rows.length === 1 && rows[0].user_id === M.me.id, '同一个 originalTransactionId 再送一次：还是一行（幂等）', rows.length);
  // 续订（新的 transactionId，同一个 originalTransactionId）
  const renew = Object.assign({}, t1, { transactionId: 'tx-renew', expiresDate: now + 59 * DAY, signedDate: now + 2000 });
  await post(M, signJws(renew, P.good));
  eq((await me(M)).subscription.expiresAt, new Date(renew.expiresDate).toISOString(), '续订：到期时间往后推，还是一行');
  const stale = Object.assign({}, t1, { expiresDate: now + 5 * DAY, signedDate: now - 5000 });
  await post(M, signJws(stale, P.good));
  eq((await me(M)).subscription.expiresAt, new Date(renew.expiresDate).toISOString(), '更旧的签名数据不覆盖新的');

  // ---------- 年付 ----------
  const Y = await C.signup(A, { age: 'adult' });
  const ry = await post(Y, signJws(mkTx(Y, { productId: 'test.premium.yearly', expiresDate: now + 300 * DAY }), P.good));
  eq([ry.json.me.plan, ry.json.me.quota.talk.limitSec], ['yearly', 1200], '年付：每天 20 分钟');
  const F0 = await C.signup(A, { age: 'adult' });
  eq([(await me(F0)).plan, (await me(F0)).quota.talk.limitSec], ['free', 300], '免费：每天 5 分钟');
  // ---------- 测试账号（TESTERS）：档位 tester，额度很高；买了月付也还是 tester ----------
  const TS = await C.signup(A, { age: 'adult', email: 'tester-a@example.test' });
  const mt = await me(TS);
  eq([mt.plan, mt.quota.talk.limitSec, mt.quota.asr.limit, mt.quota.aux.limit], ['tester', 86400, 1000000, 1000000], '测试账号（TESTERS 里的邮箱，大小写不一样）：档位 tester，每天聊 1440 分钟（一整天）、识别 100 万、别的 100 万');
  const rt = await post(TS, signJws(mkTx(TS), P.good));
  ok(rt.status === 200 && rt.json.subscription.plan === 'monthly' && rt.json.me.plan === 'tester' && rt.json.me.quota.talk.limitSec === 86400, '测试账号买了月付：订阅照样记着，档位还是 tester', rt.json.me.plan);
  const take3 = [];
  for (let i = 0; i < 3; i++) take3.push((await A.api('POST', '/v1/tts', { token: TS.token, body: { text: 'Hi there number ' + (i + 1), g: 'f' } })).status);
  ok(take3.every(s => s === 200) && (await me(TS)).quota.aux.used === 3 && (await me(TS)).quota.aux.left === 999997, '测试账号照样记用量（别的 AI 调用用了 3 次，还剩 999997）', take3);
  eq((await me(F0)).plan, 'free', '别的账号不受影响（TESTERS 里写了一个不存在的 id 也不会误认）');
  // 聊天 ready 里的 leftSec 跟着档位
  const NPCS = (await import('../../talk-npcs.js')).default;
  const c = await A.ws('/v1/talk?npc=' + NPCS.list[0].id, { first: Y.token });
  const rd = await c.next(m => m.type === 'ready');
  eq([rd && rd.leftSec, rd && rd.sessionSec], [1200, 600], '年付的聊天：今天还剩 1200 秒，每段最长 600 秒');
  c.send({ type: 'end' }); await c.done;

  // ---------- 不收的交易 ----------
  const X = await C.signup(A, { age: 'adult' });
  const cases = [
    ['bundleId 不是我们的', signJws(mkTx(X, { bundleId: 'com.other.app' }), P.good), 'bundle'],
    ['产品 id 不在配置里', signJws(mkTx(X, { productId: 'test.gems.100' }), P.good), 'product'],
    ['不认的环境（Xcode）', signJws(mkTx(X, { environment: 'Xcode' }), P.good), 'environment'],
    ['不认识的根证书', signJws(mkTx(X), P.evil), 'chain'],
    ['叶子不是中间证书签的', signJws(mkTx(X), P.good, { certs: [P.broken.leaf, P.good.inter, P.good.root], key: P.broken.leafKey }), 'chain'],
    ['叶子证书已经过期（同一个中间证书签的）', signJws(mkTx(X), P.good, { certs: [P.expiredLeaf.der, P.good.inter, P.good.root], key: P.expiredLeaf.key }), 'chain'],
    ['签名对不上（别的钥匙签的）', signJws(mkTx(X), P.good, { key: P.evil.leafKey }), 'signature'],
    ['乱写的', 'abc.def', 'format'],
  ];
  for (const [what, jws, reason] of cases) {
    const r = await post(X, jws);
    ok(r.status === 400 && r.json.error === 'bad_request' && r.json.field === 'signedTransaction' && r.json.reason === reason, '不收：' + what + ' → 400 reason ' + reason, r.json);
  }
  const tampered = signJws(mkTx(X), P.good).split('.');
  tampered[1] = Buffer.from(JSON.stringify(mkTx(X, { productId: 'test.premium.yearly', expiresDate: now + 999 * DAY }))).toString('base64url');
  eq((await post(X, tampered.join('.'))).json.reason, 'signature', '不收：内容被改过（签名还是原来的）');
  eq((await me(X)).plan, 'free', '这些都没让账号变成会员');
  // 过期的交易：收下，但不是会员
  const rx = await post(X, signJws(mkTx(X, { purchaseDate: now - 40 * DAY, expiresDate: now - 10 * DAY }), P.good));
  ok(rx.status === 200 && rx.json.subscription.state === 'expired' && rx.json.me.plan === 'free', '已经过期的交易：200，state expired，免费档', rx.json.subscription);
  // 别人的订阅
  const r409 = await post(X, signJws(Object.assign({}, t1, { appAccountToken: M.me.iapToken, signedDate: now + 3000 }), P.good));
  eq([r409.status, r409.json.reason], [409, 'iap_owned'], '拿别人账号的订阅来认领：409 iap_owned');

  // ---------- 服务器通知 V2 ----------
  const note = (type, tx, o) => signJws(Object.assign({
    notificationType: type, notificationUUID: crypto.randomUUID(), version: '2.0', signedDate: Date.now(),
    data: { appAppleId: 1, bundleId: 'com.example.echoisland', bundleVersion: '1', environment: tx.environment || 'Production', signedTransactionInfo: signJws(tx, P.good), signedRenewalInfo: o && o.ri ? signJws(o.ri, P.good) : undefined, status: o && o.status },
  }, o && o.extra), P.good);
  const notify = jws => A.api('POST', '/v1/iap/apple/notifications', { body: { signedPayload: jws } });
  // 宽限期：续费失败，但还在宽限期里 → 照样是会员
  const G = await C.signup(A, { age: 'adult' });
  const tg = mkTx(G, { expiresDate: now - 1000 });
  await post(G, signJws(tg, P.good));
  eq((await me(G)).plan, 'free', '到期了：免费');
  const ng = await notify(note('DID_FAIL_TO_RENEW', tg, { extra: { subtype: 'GRACE_PERIOD' }, status: 4, ri: { originalTransactionId: tg.originalTransactionId, productId: tg.productId, gracePeriodExpiresDate: now + 6 * DAY, signedDate: now, environment: 'Production' } }));
  const mg = await me(G);
  ok(ng.status === 200 && mg.subscription.state === 'grace' && mg.plan === 'monthly' && mg.subscription.graceUntil, '通知：续费失败但在宽限期 → state grace，照样是月付', mg.subscription);
  await post(G, signJws(Object.assign({}, tg, { signedDate: Date.now() + 5000 }), P.good));
  eq((await me(G)).subscription.state, 'grace', 'App 再送一次同一笔（还没续上）：宽限期不丢');
  await notify(note('GRACE_PERIOD_EXPIRED', tg, { extra: { signedDate: Date.now() + 10000 } }));
  eq([(await me(G)).subscription.state, (await me(G)).plan], ['expired', 'free'], '通知：宽限期结束 → expired');
  // 退款：月付那位
  const refundTx = Object.assign({}, renew, { revocationDate: Date.now(), revocationReason: 0, signedDate: Date.now() + 20000 });
  const nr = note('REFUND', refundTx, { extra: { signedDate: Date.now() + 20000 } });
  const r = await notify(nr);
  const mr = await me(M);
  ok(r.status === 200 && mr.subscription.state === 'revoked' && mr.plan === 'free' && mr.quota.talk.limitSec === 300, '通知：退款 → revoked，回到免费档', mr.subscription);
  const dup = await notify(nr);
  eq(dup.status, 200, '同一条通知再来一次：200（去重）');
  eq((await A.one('SELECT COUNT(*) AS n FROM iap_notes')).n >= 3, true, '处理过的通知记了 uuid');
  // 退款后又撤销退款
  await notify(note('REFUND_REVERSED', Object.assign({}, renew, { signedDate: Date.now() + 30000 }), { extra: { signedDate: Date.now() + 30000 } }));
  eq((await me(M)).plan, 'monthly', '通知：撤销退款 → 又是会员');
  // App 还没送交易、通知先到：按 appAccountToken 找到主人
  const N = await C.signup(A, { age: 'adult' });
  const tn = mkTx(N, { productId: 'test.premium.yearly', expiresDate: now + 360 * DAY });
  await notify(note('SUBSCRIBED', tn, { extra: { subtype: 'INITIAL_BUY' } }));
  eq((await me(N)).plan, 'yearly', '通知先到：按交易里的 appAccountToken（= me.iapToken）认到账号上');
  // 坏的通知
  eq((await notify(signJws({ notificationType: 'TEST' }, P.evil))).status, 400, '通知的签名不是 Apple 链：400');
  eq((await notify(note('TEST', mkTx(null)))).status, 200, 'TEST 通知：200');
  const wrongBundle = note('DID_RENEW', mkTx(N), {});
  const wb = JSON.parse(Buffer.from(wrongBundle.split('.')[1], 'base64url'));
  wb.data.bundleId = 'com.other.app';
  eq((await notify(signJws(wb, P.good))).json.reason, 'bundle', '通知的 bundleId 不对：400');
}

