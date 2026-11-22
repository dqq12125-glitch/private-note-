// 订阅：App Store 内购（StoreKit 2）。App 把签名过的交易（JWS）送来，这里验证后记下「谁有什么订阅、到什么时候」；
// App Store 服务器通知 V2 负责后来的变化（续订、到期、宽限期、退款、撤销）。一个 originalTransactionId 一行，重复送来只是更新。API.md §7
import { HttpError, bad, json, unb64, readJson } from './util.js';
import { verifyAppleSigned, JwsError } from './jws.js';
import { subView, planOf } from './quota.js';
import { meView } from './me.js';

const trust = cfg => ({ rootSha256: cfg.apple.rootSha256, rootDer: cfg.apple.rootDerB64 ? unb64(cfg.apple.rootDerB64) : null });
const reject = (reason, msg) => bad('signedTransaction', msg || ('Transaction rejected: ' + reason), { reason });

async function verify(R, jws, field) {
  if (typeof jws !== 'string' || jws.length > 30000) throw bad(field, 'Missing signed data', { reason: 'format' });
  try { return await verifyAppleSigned(jws, trust(R.cfg), R.now); }
  catch (e) { if (e instanceof JwsError) throw bad(field, 'Signed data rejected: ' + e.message, { reason: e.reason }); throw e; }
}
// 交易 → 这一行该存的内容（还没合并老数据）
function rowOf(R, tx, signedAt) {
  const plan = R.cfg.apple.products[tx.productId];
  const expires = +tx.expiresDate || null, revoked = +tx.revocationDate || null;
  return {
    otid: String(tx.originalTransactionId || tx.transactionId || ''), product_id: String(tx.productId || ''), plan,
    state: revoked ? 'revoked' : tx.isUpgraded ? 'expired' : expires && expires > R.now ? 'active' : 'expired',
    expires_at: expires, grace_until: null, revoked_at: revoked, env: String(tx.environment || ''),
    app_token: tx.appAccountToken ? String(tx.appAccountToken).toLowerCase() : null, signed_at: +signedAt || +tx.signedDate || R.now,
  };
}
function checkTx(R, tx) {
  if (tx.bundleId !== R.cfg.apple.bundleId) throw reject('bundle', 'Wrong bundle id');
  if (!Object.prototype.hasOwnProperty.call(R.cfg.apple.products, tx.productId)) throw reject('product', 'Unknown product id');
  if (!R.cfg.apple.environments.includes(tx.environment)) throw reject('environment', 'Environment not accepted');
  if (!tx.originalTransactionId) throw reject('format', 'No originalTransactionId');
}
// 存一行：比库里那份旧的（signed_at 更早）不覆盖；宽限期在新的到期时间出现之前保留着
async function store(R, row, userId, keepGrace) {
  const DB = R.env.DB;
  const old = await DB.prepare('SELECT * FROM entitlements WHERE otid = ?1').bind(row.otid).first();
  if (old && keepGrace) {
    if (old.grace_until && !(row.expires_at > (old.expires_at || 0)) && row.state === 'expired' && old.state === 'grace') { row.state = 'grace'; row.grace_until = old.grace_until; }
    if (row.grace_until == null && row.state !== 'revoked' && !(row.expires_at > (old.expires_at || 0))) row.grace_until = old.grace_until;
  }
  await DB.prepare('INSERT INTO entitlements (otid, user_id, product_id, plan, state, expires_at, grace_until, revoked_at, env, app_token, signed_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) ' +
    'ON CONFLICT(otid) DO UPDATE SET user_id = COALESCE(excluded.user_id, entitlements.user_id), product_id = excluded.product_id, plan = excluded.plan, state = excluded.state, expires_at = excluded.expires_at, ' +
    'grace_until = excluded.grace_until, revoked_at = excluded.revoked_at, env = excluded.env, app_token = COALESCE(excluded.app_token, entitlements.app_token), signed_at = excluded.signed_at, updated_at = excluded.updated_at ' +
    'WHERE excluded.signed_at >= entitlements.signed_at')
    .bind(row.otid, userId || null, row.product_id, row.plan, row.state, row.expires_at, row.grace_until, row.revoked_at, row.env, row.app_token, row.signed_at, R.now).run();
  // 比库里旧、上面没写进去的：至少把还没人认领的这一行认领了
  if (userId) await DB.prepare('UPDATE entitlements SET user_id = ?2 WHERE otid = ?1 AND user_id IS NULL').bind(row.otid, userId).run();
  return old;
}

// POST /v1/iap/apple
export async function iapApple(R, U) {
  const body = await readJson(R.req, R.cfg.limits.jsonBytes);
  if (!R.cfg.apple.bundleId) throw new HttpError(503, 'unavailable', 'In-app purchase is not configured', { what: 'apple' });
  const tx = await verify(R, body.signedTransaction, 'signedTransaction');
  checkTx(R, tx);
  const row = rowOf(R, tx);
  const owner = await R.env.DB.prepare('SELECT user_id FROM entitlements WHERE otid = ?1').bind(row.otid).first();
  if (owner && owner.user_id && owner.user_id !== U.id) {
    // 属于另一个账号：只有交易里的 appAccountToken 就是这个账号的，才转过来（比如老账号买的、又在这个账号上「恢复购买」不行）
    if (row.app_token && row.app_token === String(U.iap_token).toLowerCase()) await R.env.DB.prepare('UPDATE entitlements SET user_id = ?2 WHERE otid = ?1').bind(row.otid, U.id).run();
    else throw new HttpError(409, 'conflict', 'This subscription belongs to another account', { reason: 'iap_owned' });
  }
  await store(R, row, U.id, true);
  U.ents = (await R.env.DB.prepare('SELECT * FROM entitlements WHERE user_id = ?1').bind(U.id).all()).results || [];
  U.plan = planOf(R.cfg, U.ents, R.now, U).plan;
  const mine = U.ents.find(e => e.otid === row.otid);
  return json(200, { subscription: subView(mine, R.now), me: await meView(R, U) });
}

// POST /v1/iap/apple/notifications（App Store 服务器通知 V2）
export async function iapNotify(R) {
  const body = await readJson(R.req, R.cfg.limits.jsonBytes);
  const n = await verify(R, body.signedPayload, 'signedPayload');
  const DB = R.env.DB, ok = () => json(200, { ok: true });
  if (n.notificationUUID && await DB.prepare('SELECT 1 FROM iap_notes WHERE uuid = ?1').bind(String(n.notificationUUID)).first()) return ok();   // 处理过了
  const done = () => n.notificationUUID ? DB.prepare('INSERT INTO iap_notes (uuid, type, at) VALUES (?1, ?2, ?3) ON CONFLICT(uuid) DO NOTHING').bind(String(n.notificationUUID), String(n.notificationType || ''), R.now).run() : null;
  const d = n.data || {};
  if (n.notificationType === 'TEST' || !d.signedTransactionInfo) { await done(); return ok(); }
  if (d.bundleId !== R.cfg.apple.bundleId) throw bad('signedPayload', 'Wrong bundle id', { reason: 'bundle' });
  if (!R.cfg.apple.environments.includes(d.environment)) throw bad('signedPayload', 'Environment not accepted', { reason: 'environment' });
  const tx = await verify(R, d.signedTransactionInfo, 'signedPayload');
  const ri = d.signedRenewalInfo ? await verify(R, d.signedRenewalInfo, 'signedPayload') : null;
  if (tx.bundleId !== R.cfg.apple.bundleId) throw bad('signedPayload', 'Wrong bundle id', { reason: 'bundle' });
  if (!Object.prototype.hasOwnProperty.call(R.cfg.apple.products, tx.productId)) { console.log('iap notification for unknown product', tx.productId); await done(); return ok(); }
  const row = rowOf(R, tx, n.signedDate);
  const t = n.notificationType, sub = n.subtype, graceEnd = ri && +ri.gracePeriodExpiresDate;
  let keepGrace = true;   // 明确说到期 / 退款的通知：宽限期也一起结束
  if (t === 'REFUND' || t === 'REVOKE' || d.status === 5) { row.state = 'revoked'; row.revoked_at = +tx.revocationDate || +n.signedDate || R.now; keepGrace = false; }
  else if (t === 'EXPIRED' || t === 'GRACE_PERIOD_EXPIRED') { row.state = 'expired'; keepGrace = false; }
  else if ((t === 'DID_FAIL_TO_RENEW' && sub === 'GRACE_PERIOD') || d.status === 4) {
    if (graceEnd && graceEnd > R.now) { row.state = 'grace'; row.grace_until = graceEnd; }
  }
  // 谁的：库里已经有主人就是他；没有就按交易里的 appAccountToken 找（App 买的时候带上了 me.iapToken）
  let userId = null;
  if (row.app_token) { const u = await DB.prepare('SELECT id FROM users WHERE iap_token = ?1').bind(row.app_token).first(); userId = u ? u.id : null; }
  const old = await DB.prepare('SELECT user_id FROM entitlements WHERE otid = ?1').bind(row.otid).first();
  if (old && old.user_id) userId = null;   // 有主人了就不改主人
  await store(R, row, userId, keepGrace);
  await done();
  return ok();
}
