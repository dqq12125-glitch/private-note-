// 举报：孩子在某句 AI 的话上按「举报」，App 把最后几句发来，存 REPORT_DAYS 天（默认 90）给我们检查；服务器平时不存聊天记录。API.md §9
import { HttpError, bad, json, randId, readJson, sameSecret, isoOrNull } from './util.js';
import { hitD1 } from './ratelimit.js';

const REASONS = ['rude', 'scary', 'wrong', 'personal', 'other'];
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const idOk = v => (typeof v === 'string' && /^[\w:.-]{1,64}$/.test(v) ? v : null);

export async function report(R, U) {
  const j = await readJson(R.req, R.cfg.limits.jsonBytes);
  const turns = (Array.isArray(j.turns) ? j.turns : []).slice(-8).map(t => ({ who: t && t.who === 'you' ? 'you' : 'npc', text: txt(t && t.text, 500) })).filter(t => t.text);
  if (!turns.length) throw bad('turns', 'Nothing to report');
  const reason = REASONS.includes(j.reason) ? j.reason : 'other';
  await hitD1(R, 'report', U.id, R.cfg.rate.reportPerUserDay, 86400);
  const id = randId('r_', 12);
  await R.env.DB.prepare('INSERT INTO reports (id, user_id, age_group, npc, quest, reason, note, turns, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(id, U.id, U.age_group || null, idOk(j.npc), idOk(j.quest), reason, txt(j.note, 300) || null, JSON.stringify(turns), R.now).run();
  return json(200, { ok: true, id });
}

// 老板看举报：Authorization: Bearer <ADMIN_TOKEN>
export async function adminReports(R) {
  const m = /^Bearer\s+(.+)$/i.exec(R.req.headers.get('authorization') || '');
  if (!R.cfg.adminToken || !m || !(await sameSecret(m[1].trim(), R.cfg.adminToken))) throw new HttpError(401, 'auth', 'Admin token required', { reason: 'admin' });
  const u = R.url.searchParams, limit = Math.max(1, Math.min(100, parseInt(u.get('limit'), 10) || 50));
  const before = u.get('before') ? Date.parse(u.get('before')) : NaN;
  const rows = (await R.env.DB.prepare('SELECT * FROM reports WHERE created_at < ?1 ORDER BY created_at DESC LIMIT ?2').bind(isFinite(before) ? before : 8.64e15, limit).all()).results || [];
  return json(200, {
    reports: rows.map(r => ({ id: r.id, createdAt: isoOrNull(r.created_at), userId: r.user_id, ageGroup: r.age_group, npc: r.npc, quest: r.quest, reason: r.reason, note: r.note, turns: JSON.parse(r.turns) })),
    next: rows.length === limit ? isoOrNull(rows[rows.length - 1].created_at) : null,
  });
}

// 每天的定时任务：删过期的东西（API.md、README「数据保留」）
export async function purge(env, cfg, now) {
  const DB = env.DB, DAY = 86400000;
  const keepDay = new Date(now - cfg.usageKeepDays * DAY).toISOString().slice(0, 10);
  const stale = now - cfg.talk.staleSec * 1000;
  const res = await DB.batch([
    DB.prepare('DELETE FROM reports WHERE created_at < ?1').bind(now - cfg.reportDays * DAY),
    DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now),
    DB.prepare('DELETE FROM email_codes WHERE expires_at < ?1').bind(now),
    DB.prepare('DELETE FROM apple_nonces WHERE expires_at < ?1').bind(now),
    DB.prepare('DELETE FROM rl WHERE exp < ?1').bind(now),
    DB.prepare('DELETE FROM consents WHERE state = \'pending\' AND expires_at < ?1').bind(now),   // 家长没点的请求：过期就连家长邮箱一起删
    DB.prepare('DELETE FROM iap_notes WHERE at < ?1').bind(now - 60 * DAY),
    DB.prepare('INSERT INTO usage (user_id, day, talk_sec) SELECT user_id, day, sec FROM talk_live WHERE beat_at < ?1 ON CONFLICT(user_id, day) DO UPDATE SET talk_sec = talk_sec + excluded.talk_sec').bind(stale),
    DB.prepare('DELETE FROM talk_live WHERE beat_at < ?1').bind(stale),
    DB.prepare('DELETE FROM usage WHERE day < ?1').bind(keepDay),
  ]);
  return { reports: res[0].meta.changes, sessions: res[1].meta.changes };
}
