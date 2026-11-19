// /v1/me：看账号、改年龄段 / 界面语言 / 级别 / 时区、删号（API.md §4）
import { HttpError, bad, isoOrNull, maskEmail } from './util.js';
import { clampTz, tzUpdate, dayOf, usageRow, quotaView, subView, planOf } from './quota.js';
import { appleRevoke } from './auth.js';
import { CORE } from './shared.js';

const AGES = ['child', 'teen', 'adult'];
const RANK = { child: 0, teen: 1, adult: 2 };

// 家长同意的状态（也给 /v1/consent 用）
export function consentView(U, now) {
  const required = U.age_group === 'child' || !U.age_group;
  let state = U.c_state || 'none';
  if (state === 'pending' && U.c_exp && U.c_exp <= now) state = 'none';   // 链接过期了：当没发过
  return { required, state, parentEmail: state === 'none' ? null : maskEmail(U.c_parent), requestedAt: state === 'none' ? null : isoOrNull(U.c_req), grantedAt: state === 'granted' ? isoOrNull(U.c_granted) : null };
}
// 这个功能现在能不能用：不能用时返回 403 要的 need（'age' / 'parent'），能用返回 ''
export function consentNeed(R, U, feature) {
  if (!R.cfg.consentGated.includes(feature)) return '';
  if (!U.age_group) return 'age';
  if (U.age_group === 'child' && U.c_state !== 'granted') return 'parent';
  return '';
}
export function requireConsent(R, U, feature) {
  const need = consentNeed(R, U, feature);
  if (need) throw new HttpError(403, 'consent', need === 'age' ? 'Age group not set' : 'Parent consent needed', { need, feature });
}
export function features(R, U) {
  const out = {};
  for (const f of ['talk', 'place', 'steps']) out[f] = !consentNeed(R, U, f);
  return out;
}

export async function meView(R, U) {
  const row = await usageRow(R, U.id, dayOf(R.now, U.tz_min));
  const pick = planOf(R.cfg, U.ents, R.now);
  return {
    id: U.id, email: U.email || null, apple: !!U.apple_sub, ageGroup: U.age_group || null, ui: U.ui || null,
    level: U.level == null ? null : U.level, tzOffsetMin: U.tz_min | 0, iapToken: U.iap_token, createdAt: isoOrNull(U.created_at),
    consent: consentView(U, R.now), features: features(R, U),
    plan: pick.plan, subscription: subView(pick.ent, R.now),
    quota: quotaView(R.cfg, U, row, R.now),
  };
}

export async function mePatch(R, U, body) {
  const sets = [], args = [U.id];
  const set = (col, v) => { sets.push(col + ' = ?' + args.push(v)); U[col] = v; };
  if ('ageGroup' in body) {
    const a = body.ageGroup;
    if (!AGES.includes(a)) throw bad('ageGroup', 'ageGroup must be child, teen or adult');
    // 中性的年龄门槛：孩子不能自己改大（家长同意过的除外），改小随时可以
    if (U.age_group === 'child' && RANK[a] > 0 && U.c_state !== 'granted') throw new HttpError(409, 'conflict', 'A child account cannot raise its age group', { reason: 'age_locked' });
    if (a !== U.age_group) set('age_group', a);
  }
  if ('ui' in body) { const u = CORE.uiOk(String(body.ui || '')); if (!u) throw bad('ui'); if (u !== U.ui) set('ui', u); }
  if ('level' in body) {
    const l = body.level;
    if (l !== null && !(Number.isInteger(l) && l >= 0 && l <= 5)) throw bad('level', 'level must be 0-5 or null');
    if (l !== U.level) set('level', l);
  }
  if ('tzOffsetMin' in body) {
    const tz = clampTz(body.tzOffsetMin);
    if (tz == null) throw bad('tzOffsetMin');
    const t = tzUpdate(R.cfg, U, tz, R.now);
    if (t != null) { set('tz_min', t); set('tz_at', R.now); }
  }
  if (sets.length) await R.env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?1').bind(...args).run();
  return meView(R, U);
}

// 删号：先删 D1 里的一切（马上），再撤销 Apple 授权（失败也不影响删号）
export async function meDelete(R, U, body) {
  const DB = R.env.DB, id = U.id;
  const tables = ['sessions', 'usage', 'talk_live', 'consents', 'reports', 'entitlements'];
  await DB.batch(tables.map(t => DB.prepare('DELETE FROM ' + t + ' WHERE user_id = ?1').bind(id)).concat([
    U.email ? DB.prepare('DELETE FROM email_codes WHERE email = ?1').bind(U.email) : DB.prepare('SELECT 1'),
    DB.prepare('DELETE FROM users WHERE id = ?1').bind(id),
  ]));
  const apple = await appleRevoke(R, U, body && body.appleAuthorizationCode);
  return { deleted: true, apple };
}
