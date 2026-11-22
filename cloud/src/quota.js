// 每天的用量：三种计量（talk 秒数 / asr 识别片段 / aux 别的小调用），按用户自己的时区过日子（API.md §6）
import { HttpError, isoOrNull } from './util.js';

const DAY = 86400000;
export const METERS = { talk: 'talk_sec', asr: 'asr_n', aux: 'aux_n' };

// 时区：设备报的「比 UTC 快几分钟」，夹在 −12:00…+14:00，按 15 分钟取整；不是数字 = null（不改）
export function clampTz(v) {
  if (v === undefined || v === null || v === '' || !isFinite(+v)) return null;
  return Math.max(-720, Math.min(840, Math.round(+v / 15) * 15));
}
// 这个时区里「今天」是哪天、下一个零点是哪个时刻
export const dayOf = (now, tz) => new Date(now + (tz | 0) * 60000).toISOString().slice(0, 10);
export const resetAt = (now, tz) => (Math.floor((now + (tz | 0) * 60000) / DAY) + 1) * DAY - (tz | 0) * 60000;
// 改时区：第一次直接用；以后离上次改不到 TZ_CHANGE_DAYS 天的不认（防止来回换时区多拿额度）
export function tzUpdate(cfg, user, tz, now) {
  if (tz == null || tz === user.tz_min) return null;
  if (user.tz_at && now - user.tz_at < cfg.tzChangeDays * DAY) return null;
  return tz;
}

// ---------- 订阅 → 档位 ----------
// 一行订阅现在是什么状态（以「现在」为准，不只看存的 state：过了到期时间就是 expired）
export function entNow(e, now) {
  if (!e) return { state: 'none', premium: false };
  if (e.state === 'revoked') return { state: 'revoked', premium: false };
  if (e.state === 'grace' && e.grace_until && e.grace_until > now) return { state: 'grace', premium: true };
  if ((e.state === 'active' || e.state === 'grace') && e.expires_at && e.expires_at > now) return { state: 'active', premium: true };
  return { state: 'expired', premium: false };
}
export function subView(e, now) {
  const s = entNow(e, now);
  return {
    state: s.state, plan: e ? e.plan : null, productId: e ? e.product_id : null,
    expiresAt: e ? isoOrNull(e.expires_at) : null, graceUntil: e && s.state === 'grace' ? isoOrNull(e.grace_until) : null,
    environment: e ? e.env : null,
  };
}
// 测试账号（config 的 testers：账号 id 一字不差，或者邮箱不分大小写）
export function isTester(cfg, U) {
  if (!U || !cfg.testers || !cfg.testers.length) return false;
  const mail = U.email ? String(U.email).toLowerCase() : '';
  return cfg.testers.some(t => t === U.id || (!!mail && t.toLowerCase() === mail));
}
// 几份订阅里挑一份：正在生效的里面每天聊天分钟最多的；都没生效就挑最近更新的那份（让 App 看到「已过期 / 已退款」）
// U 给了、又是测试账号：档位是 tester（订阅照样显示它自己的那份）
export function planOf(cfg, ents, now, U) {
  const rows = (ents || []).filter(Boolean);
  let best = null, bestMin = -1;
  for (const e of rows) {
    if (!entNow(e, now).premium || !cfg.plans[e.plan]) continue;
    const m = cfg.plans[e.plan].talkMin;
    if (m > bestMin) { best = e; bestMin = m; }
  }
  const last = best || rows.slice().sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  if (isTester(cfg, U)) return { plan: 'tester', ent: last };
  if (best) return { plan: best.plan, ent: best };
  return { plan: 'free', ent: last };
}
export function caps(cfg, plan) {
  const p = cfg.plans[plan] || cfg.plans.free;
  return { talk: Math.round(p.talkMin * 60), asr: p.asrN | 0, aux: p.auxN | 0 };
}

export async function usageRow(R, userId, day) {
  return (await R.env.DB.prepare('SELECT talk_sec, asr_n, aux_n FROM usage WHERE user_id = ?1 AND day = ?2').bind(userId, day).first()) || { talk_sec: 0, asr_n: 0, aux_n: 0 };
}
export function quotaView(cfg, U, row, now) {
  const c = caps(cfg, U.plan), day = dayOf(now, U.tz_min);
  const usedSec = Math.min(c.talk, Math.round(row.talk_sec || 0));
  return {
    day, tzOffsetMin: U.tz_min | 0, resetsAt: isoOrNull(resetAt(now, U.tz_min)),
    talk: { limitSec: c.talk, usedSec, leftSec: Math.max(0, c.talk - usedSec) },
    asr: { limit: c.asr, used: row.asr_n | 0, left: Math.max(0, c.asr - (row.asr_n | 0)) },
    aux: { limit: c.aux, used: row.aux_n | 0, left: Math.max(0, c.aux - (row.aux_n | 0)) },
  };
}

// 按次计的：先原子地「没到上限就 +1」，到了上限一行都不返回 → 402。返回 { day, left }
export async function take(R, U, meter) {
  const col = METERS[meter], cap = caps(R.cfg, U.plan)[meter], day = dayOf(R.now, U.tz_min);
  const over = used => new HttpError(402, 'quota', 'Daily allowance used up', { meter, limit: cap, used, resetsAt: isoOrNull(resetAt(R.now, U.tz_min)) });
  if (cap <= 0) throw over(0);
  const r = await R.env.DB.prepare('INSERT INTO usage (user_id, day, ' + col + ') VALUES (?1, ?2, 1) ON CONFLICT(user_id, day) DO UPDATE SET ' + col + ' = ' + col + ' + 1 WHERE ' + col + ' < ?3 RETURNING ' + col + ' AS n')
    .bind(U.id, day, cap).first();
  if (!r) throw over(cap);
  return { day, left: Math.max(0, cap - r.n), meter };
}
// 上游失败：退回这一次
export async function refund(R, U, t) {
  if (!t) return;
  const col = METERS[t.meter];
  await R.env.DB.prepare('UPDATE usage SET ' + col + ' = MAX(0, ' + col + ' - 1) WHERE user_id = ?1 AND day = ?2').bind(U.id, t.day).run();
}

// ---------- 实时聊天按秒计 ----------
// 断掉的聊天（心跳 TALK_STALE_SEC 没更新）：按最后一次写进去的进度记账，再删掉。user 给了只结算这个人的，不给结算所有人的（每天的定时任务）
export function foldStale(R, cutoff, userId) {
  const DB = R.env.DB, w = userId ? ' AND user_id = ?2' : '';
  const a = [cutoff].concat(userId ? [userId] : []);
  return [
    DB.prepare('INSERT INTO usage (user_id, day, talk_sec) SELECT user_id, day, sec FROM talk_live WHERE beat_at < ?1' + w + ' ON CONFLICT(user_id, day) DO UPDATE SET talk_sec = talk_sec + excluded.talk_sec').bind(...a),
    DB.prepare('DELETE FROM talk_live WHERE beat_at < ?1' + w).bind(...a),
  ];
}
// 开一段聊天：结算这个人断掉的老聊天 → 没超过同时段数就登记一行 → 读今天用了多少。都在一个批次里（D1 的批次是一个事务）
export async function talkOpen(R, U, id) {
  const DB = R.env.DB, day = dayOf(R.now, U.tz_min), t = R.cfg.talk;
  const res = await DB.batch(foldStale(R, R.now - t.staleSec * 1000, U.id).concat([
    DB.prepare('INSERT INTO talk_live (id, user_id, day, started_at, beat_at, sec) SELECT ?1, ?2, ?3, ?4, ?4, 0 WHERE (SELECT COUNT(*) FROM talk_live WHERE user_id = ?2) < ?5')
      .bind(id, U.id, day, R.now, t.maxPerUser),
    DB.prepare('SELECT (SELECT COUNT(*) FROM talk_live WHERE id = ?1) AS mine, (SELECT talk_sec FROM usage WHERE user_id = ?2 AND day = ?3) AS used').bind(id, U.id, day),
  ]));
  const row = res[res.length - 1].results[0] || {};
  const cap = caps(R.cfg, U.plan).talk, used = row.used || 0;
  return { ok: !!row.mine, day, cap, used, left: Math.max(0, cap - used) };
}
export const talkBeat = (R, id, sec, now) => R.env.DB.prepare('UPDATE talk_live SET beat_at = ?2, sec = ?3 WHERE id = ?1').bind(id, now, sec).run();
// 结束：记账（这一行还在就记全部秒数；已经被当成断掉结算过了就只补上最后一次心跳之后的那一截）再删行
export function talkClose(R, U, id, day, sec, beatSec) {
  const DB = R.env.DB;
  return DB.batch([
    DB.prepare('INSERT INTO usage (user_id, day, talk_sec) VALUES (?1, ?2, CASE WHEN EXISTS (SELECT 1 FROM talk_live WHERE id = ?3) THEN ?4 ELSE MAX(0, ?4 - ?5) END) ON CONFLICT(user_id, day) DO UPDATE SET talk_sec = talk_sec + excluded.talk_sec')
      .bind(U.id, day, id, sec, beatSec),
    DB.prepare('DELETE FROM talk_live WHERE id = ?1').bind(id),
  ]);
}
export const talkDrop = (R, id) => R.env.DB.prepare('DELETE FROM talk_live WHERE id = ?1').bind(id).run();
