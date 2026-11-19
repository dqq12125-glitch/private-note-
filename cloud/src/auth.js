// 登录：邮箱一次性验证码、Sign in with Apple；会话是长期有效的 bearer token（只存哈希）。API.md §1、§3
import { HttpError, bad, randId, rand, b64url, sha256hex, hmacHex, digits6, normEmail, uuid, fetchT } from './util.js';
import { need } from './config.js';
import { hitD1 } from './ratelimit.js';
import { clampTz, tzUpdate, planOf } from './quota.js';
import { send, codeMail } from './email.js';
import { verifyIdToken, es256Jwt, seal, unseal, JwsError } from './jws.js';
import { CORE } from './shared.js';

const DAY = 86400000;
const unauth = (reason, msg) => new HttpError(401, 'auth', msg || 'Not signed in', { reason });
const uiOf = v => CORE.uiOk(String(v || ''));

// ---------- 会话 → 用户（一次往返：会话 + 用户 + 家长同意 + 订阅） ----------
export async function authUser(R, token) {
  if (token === undefined) {
    const h = R.req.headers.get('authorization') || '';
    const m = /^Bearer\s+(\S+)$/i.exec(h); token = m ? m[1] : '';
  }
  if (!/^eis_[A-Za-z0-9_-]{43}$/.test(String(token || ''))) throw unauth('token');
  const hash = await sha256hex(token), DB = R.env.DB;
  const [a, b] = await DB.batch([
    DB.prepare('SELECT u.*, s.expires_at AS s_exp, s.kind AS s_kind, c.state AS c_state, c.parent_email AS c_parent, c.requested_at AS c_req, c.granted_at AS c_granted, c.expires_at AS c_exp ' +
      'FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN consents c ON c.user_id = u.id WHERE s.hash = ?1').bind(hash),
    DB.prepare('SELECT e.* FROM entitlements e JOIN sessions s ON s.user_id = e.user_id WHERE s.hash = ?1').bind(hash),
  ]);
  const U = a.results[0];
  if (!U) throw unauth('token');
  if (U.s_exp <= R.now) throw unauth('expired', 'Session expired');
  // 会话往后推：每天最多写一次
  const want = R.now + R.cfg.sessionDays * DAY;
  if (want - U.s_exp > DAY) R.ctx.waitUntil(DB.prepare('UPDATE sessions SET expires_at = ?2 WHERE hash = ?1').bind(hash, want).run().catch(() => {}));
  U.hash = hash; U.ents = b.results || [];
  U.plan = planOf(R.cfg, U.ents, R.now).plan;
  return U;
}

async function newSession(R, userId, kind) {
  const token = 'eis_' + b64url(rand(32)), exp = R.now + R.cfg.sessionDays * DAY;
  await R.env.DB.prepare('INSERT INTO sessions (hash, user_id, kind, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(await sha256hex(token), userId, kind, R.now, exp).run();
  return { token, expiresAt: new Date(exp).toISOString() };
}
// 新账号（邮箱或 Apple）。tz 不给 = UTC，等以后第一次报上来
async function createUser(R, f) {
  const id = randId('u_', 12), tz = clampTz(f.tz);
  await R.env.DB.prepare('INSERT INTO users (id, email, apple_sub, ui, tz_min, tz_at, iap_token, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
    .bind(id, f.email || null, f.appleSub || null, uiOf(f.ui) || null, tz == null ? 0 : tz, tz == null ? 0 : R.now, uuid(), R.now).run();
  return id;
}
// 老账号再登录：顺便按规矩更新时区、补上界面语言
async function touchUser(R, u, tzIn, ui) {
  const tz = tzUpdate(R.cfg, u, clampTz(tzIn), R.now), sets = [], args = [u.id];
  if (tz != null) { sets.push('tz_min = ?' + (args.push(tz)), 'tz_at = ?' + (args.push(R.now))); }
  if (!u.ui && uiOf(ui)) sets.push('ui = ?' + (args.push(uiOf(ui))));
  if (sets.length) await R.env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?1').bind(...args).run();
}

// ---------- 邮箱登录 ----------
export async function emailStart(R, body) {
  const email = normEmail(body.email);
  if (!email) throw bad('email', 'Not a valid email address');
  const pep = need(R.cfg, 'pepper');
  await hitD1(R, 'mail-addr', email, R.cfg.rate.emailPerAddrHour, 3600);
  await hitD1(R, 'mail-ip', R.ip, R.cfg.rate.emailPerIpHour, 3600);
  const code = digits6();
  await R.env.DB.prepare('INSERT INTO email_codes (email, code_hash, tries, expires_at) VALUES (?1, ?2, 0, ?3) ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, tries = 0, expires_at = excluded.expires_at')
    .bind(email, await hmacHex(pep, email + '|' + code), R.now + R.cfg.codeMin * 60000).run();
  const m = codeMail(code, uiOf(body.ui) || 'en', R.cfg.codeMin);
  await send(R, Object.assign({ to: email, tag: 'code' }, m));
  return { ok: true, expiresInSec: R.cfg.codeMin * 60 };
}

export async function emailVerify(R, body) {
  const email = normEmail(body.email), code = String(body.code || '').replace(/\s+/g, '');
  if (!email) throw bad('email');
  if (!/^\d{6}$/.test(code)) throw bad('code', 'Code must be 6 digits');
  const pep = need(R.cfg, 'pepper');
  await hitD1(R, 'signin-ip', R.ip, R.cfg.rate.signinPerIpHour, 3600);
  const DB = R.env.DB;
  const row = await DB.prepare('SELECT * FROM email_codes WHERE email = ?1').bind(email).first();
  if (!row || row.expires_at <= R.now) throw unauth('expired', 'No live code for this address');
  if (row.tries >= R.cfg.codeTries) throw new HttpError(429, 'rate', 'Too many wrong codes', { retryAfter: Math.ceil((row.expires_at - R.now) / 1000), what: 'tries' });
  if (row.code_hash !== await hmacHex(pep, email + '|' + code)) {
    await DB.prepare('UPDATE email_codes SET tries = tries + 1 WHERE email = ?1').bind(email).run();
    throw unauth('code', 'Wrong code');
  }
  await DB.prepare('DELETE FROM email_codes WHERE email = ?1').bind(email).run();   // 一个码只能用一次
  let u = await DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first(), created = false;
  if (u) await touchUser(R, u, body.tzOffsetMin, body.ui);
  else { await createUser(R, { email, tz: body.tzOffsetMin, ui: body.ui }); created = true; u = await DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first(); }
  return Object.assign(await newSession(R, u.id, 'email'), { created, userId: u.id });
}

// ---------- Sign in with Apple ----------
export async function appleSignIn(R, body) {
  await hitD1(R, 'signin-ip', R.ip, R.cfg.rate.signinPerIpHour, 3600);
  if (!R.cfg.apple.bundleId) throw new HttpError(503, 'unavailable', 'Sign in with Apple is not configured', { what: 'apple' });
  let c;
  try { c = await verifyIdToken(R.cfg, body.identityToken, body.nonce, R.now); }
  catch (e) { if (e instanceof JwsError) throw unauth('apple', 'Apple identity token rejected: ' + e.reason); throw e; }
  const DB = R.env.DB;
  // 同一个 nonce 只能用一次（令牌被截下来也不能重放）
  const used = await DB.prepare('INSERT INTO apple_nonces (hash, expires_at) VALUES (?1, ?2) ON CONFLICT(hash) DO NOTHING RETURNING hash').bind(c.nonce, Math.max(+c.exp * 1000, R.now) + DAY).first();
  if (!used) throw unauth('apple', 'Nonce already used');
  const email = (c.email_verified === true || c.email_verified === 'true') ? normEmail(c.email) : '';
  let u = await DB.prepare('SELECT * FROM users WHERE apple_sub = ?1').bind(c.sub).first(), created = false;
  if (!u && email) {
    // 苹果给的邮箱已经核实过、而且已经有这个邮箱的账号：连到那个账号上
    u = await DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first();
    if (u) await DB.prepare('UPDATE users SET apple_sub = ?2 WHERE id = ?1 AND apple_sub IS NULL').bind(u.id, c.sub).run();
  }
  if (u) await touchUser(R, u, body.tzOffsetMin, body.ui);
  else {
    await createUser(R, { email: email || null, appleSub: c.sub, tz: body.tzOffsetMin, ui: body.ui });
    created = true;
    u = await DB.prepare('SELECT * FROM users WHERE apple_sub = ?1').bind(c.sub).first();
  }
  // 有授权码、也配了 Apple 的钥匙：换一个 refresh token 加密存起来，删号时用它撤销（不耽误登录，后台做）
  if (body.authorizationCode && appleKeyReady(R.cfg)) R.ctx.waitUntil(saveAppleRefresh(R, u.id, String(body.authorizationCode)).catch(e => console.log('apple token exchange failed', e.message)));
  return Object.assign(await newSession(R, u.id, 'apple'), { created, userId: u.id });
}

export async function signOut(R, U, body) {
  if (body && body.all === true) await R.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(U.id).run();
  else await R.env.DB.prepare('DELETE FROM sessions WHERE hash = ?1').bind(U.hash).run();
  return { ok: true };
}

// ---------- Apple：换 token、撤销（删号时，App Store 审核要求） ----------
export const appleKeyReady = cfg => !!(cfg.apple.teamId && cfg.apple.keyId && cfg.apple.key && cfg.apple.clientId);
async function clientSecret(R) {
  const A = R.cfg.apple, iat = Math.floor(R.now / 1000);
  return es256Jwt(A.key, A.keyId, { iss: A.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: A.clientId });
}
async function appleForm(R, path, fields) {
  const url = R.cfg.apple.authBase + path;
  if (!R.cfg.hostOk(url, 'apple')) throw new Error('Apple host not allowed');
  const form = new URLSearchParams(Object.assign({ client_id: R.cfg.apple.clientId, client_secret: await clientSecret(R) }, fields));
  return fetchT(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }, 8000);
}
async function exchange(R, code) {
  const r = await appleForm(R, '/auth/token', { code, grant_type: 'authorization_code' });
  if (!r.ok) throw new Error('token HTTP ' + r.status);
  return r.json();
}
async function saveAppleRefresh(R, userId, code) {
  const t = await exchange(R, code);
  if (!t.refresh_token) return;
  if (!R.cfg.dataKey) { console.log('warning: DATA_KEY not set, Apple refresh token not stored (deletion will need a fresh authorization code)'); return; }
  await R.env.DB.prepare('UPDATE users SET apple_refresh = ?2 WHERE id = ?1').bind(userId, await seal(R.cfg.dataKey, t.refresh_token)).run();
}
// 返回 'none' / 'revoked' / 'skipped' / 'failed'（API.md §4）
export async function appleRevoke(R, U, freshCode) {
  if (!U.apple_sub) return 'none';
  if (!appleKeyReady(R.cfg)) { console.log('warning: Sign in with Apple key not configured, token revocation skipped for a deleted account'); return 'skipped'; }
  try {
    let token = '', hint = 'refresh_token';
    if (freshCode) { const t = await exchange(R, String(freshCode)); token = t.refresh_token || t.access_token || ''; hint = t.refresh_token ? 'refresh_token' : 'access_token'; }
    if (!token && U.apple_refresh && R.cfg.dataKey) token = (await unseal(R.cfg.dataKey, U.apple_refresh)) || '';
    if (!token) { console.log('warning: no Apple token to revoke for a deleted account'); return 'skipped'; }
    const r = await appleForm(R, '/auth/revoke', { token, token_type_hint: hint });
    return r.ok ? 'revoked' : 'failed';
  } catch (e) { console.log('apple revoke failed', e.message); return 'failed'; }
}
