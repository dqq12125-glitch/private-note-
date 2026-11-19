// 限流（API.md §11）
// - 登录、家长同意邮件、举报：次数少、又要全球都准（防止拿别人的邮箱轰炸），放 D1 的固定窗口计数（rl 表）
// - AI 调用和 WebSocket 每分钟的：次数多，每次写 D1 太贵，用 Cloudflare 的 Rate Limiting 绑定（RL_AI_USER / RL_AI_IP / RL_WS_USER，
//   每个机房各算各的）；没有绑定（本机开发）时退回这个 Worker 进程里的内存计数。真正封顶花费的是 D1 里每天的用量
import { HttpError, hmacHex } from './util.js';
import { need } from './config.js';

const rate = (sec, what) => new HttpError(429, 'rate', 'Too many requests', { retryAfter: Math.max(1, Math.ceil(sec)), what });

// D1 固定窗口：没到上限 +1；窗口过了从 1 重新数。键是带密钥的哈希（不存原始 IP / 邮箱）
export async function hitD1(R, kind, id, limit, windowSec) {
  if (!(limit > 0)) return;
  const k = kind + ':' + (await hmacHex(need(R.cfg, 'pepper'), kind + '|' + id)).slice(0, 40);
  const r = await R.env.DB.prepare('INSERT INTO rl (k, n, exp) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN exp <= ?3 THEN 1 ELSE n + 1 END, exp = CASE WHEN exp <= ?3 THEN ?2 ELSE exp END RETURNING n, exp')
    .bind(k, R.now + windowSec * 1000, R.now).first();
  if (r && r.n > limit) throw rate((r.exp - R.now) / 1000, kind);
}

// 每分钟的：先用绑定，没有绑定用内存
const mem = new Map();
function memHit(key, limit, now) {
  const w = Math.floor(now / 60000), k = key + '|' + w, n = (mem.get(k) || 0) + 1;
  mem.set(k, n);
  if (mem.size > 20000) for (const x of mem.keys()) { if (!x.endsWith('|' + w)) mem.delete(x); }
  return n <= limit;
}
export async function hitMinute(R, binding, fallbackLimit, key) {
  const b = R.env[binding];
  let ok;
  if (b && typeof b.limit === 'function') { try { ok = (await b.limit({ key })).success; } catch (e) { ok = true; } }
  else ok = memHit(binding + ':' + key, fallbackLimit, Date.now());
  if (!ok) throw rate(60 - (Date.now() / 1000) % 60, binding);
}
// AI 调用：账号一个、IP 一个
export async function aiLimit(R, U) {
  await hitMinute(R, 'RL_AI_USER', R.cfg.rate.aiPerUserMin, U.id);
  await hitMinute(R, 'RL_AI_IP', R.cfg.rate.aiPerIpMin, R.ip);
}
export const wsLimit = (R, U) => hitMinute(R, 'RL_WS_USER', R.cfg.rate.wsPerUserMin, U.id);
