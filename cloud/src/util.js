// 公用小工具：JSON 回复、出错、随机数、哈希、base64url、读请求体（带大小上限）
// Worker 里没有 Buffer：编码解码都用 Web 标准的 TextEncoder / atob / btoa / crypto.subtle

export const enc = new TextEncoder();
export const dec = new TextDecoder();

// 出错：路由里 throw 出来，最外层统一变成 JSON 回复（API.md §2）
export class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status; this.code = code; this.extra = extra || {};
  }
}
export const bad = (field, message, extra) => new HttpError(400, 'bad_request', message || ('Bad field: ' + field), Object.assign({ field }, extra));

export function json(status, obj, headers) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}) });
}
export function errorResponse(e) {
  const h = {};
  if (e.status === 429 && e.extra && e.extra.retryAfter) h['Retry-After'] = String(Math.ceil(e.extra.retryAfter));
  return json(e.status, Object.assign({ error: e.code, message: e.message }, e.extra), h);
}

// ---------- 编码 ----------
export function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export const b64url = u8 => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function unb64(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '') + '==='.slice((String(s).length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// base64url 的 JSON（游戏发来的 p= / m=、JWT 的头和内容）；坏的返回 null
export function b64json(s) {
  try { return JSON.parse(dec.decode(unb64(s))); } catch (e) { return null; }
}
export const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
export function unhex(s) {
  const m = String(s).replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(m.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(m.substr(i * 2, 2), 16);
  return out;
}

// ---------- 随机与哈希 ----------
export function rand(n) { const u = new Uint8Array(n); crypto.getRandomValues(u); return u; }
export const randId = (prefix, n) => prefix + b64url(rand(n || 12));
export function uuid() { return crypto.randomUUID(); }
// 6 位数字的登录码（拒绝采样，不偏）
export function digits6() {
  for (;;) { const v = new Uint32Array(1); crypto.getRandomValues(v); if (v[0] < 4294000000) return String(v[0] % 1000000).padStart(6, '0'); }
}
export async function sha256(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
}
export const sha256hex = async data => hex(await sha256(data));
const hkeys = new Map();
export async function hmacHex(secret, msg) {
  let k = hkeys.get(secret);
  if (!k) { k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); hkeys.set(secret, k); }
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg))));
}
// 比较两个秘密字符串：先各自做哈希再比，时间和内容无关
export async function sameSecret(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// ---------- 读请求体：超过上限就 413，不把整个大请求读进内存 ----------
export async function readText(req, max) {
  const len = +(req.headers.get('content-length') || 0);
  if (len > max) throw new HttpError(413, 'too_large', 'Body too large', { limit: max });
  if (!req.body) return '';
  const rd = req.body.getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { rd.cancel(); } catch (e) {} throw new HttpError(413, 'too_large', 'Body too large', { limit: max }); }
    parts.push(value);
  }
  const all = new Uint8Array(n); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.byteLength; }
  return dec.decode(all);
}
export async function readJson(req, max) {
  const t = await readText(req, max);
  if (!t.trim()) return {};
  try { const j = JSON.parse(t); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) {}
  throw new HttpError(400, 'bad_request', 'Body must be a JSON object', { field: 'body' });
}

// 和中转服务一样的清理：只留字母数字和常用标点，限长（server/relay.js 的 clean）
export const clean = (v, n) => String(v || '').replace(/[^\p{L}\p{N} .,!?'"’:;()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export const isoOrNull = ms => (ms == null || !isFinite(ms) ? null : new Date(+ms).toISOString());
export const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export function normEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : '';
}
export const maskEmail = e => (e ? String(e).replace(/^(.)[^@]*(@.*)$/, '$1***$2') : null);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// fetch 带超时
export async function fetchT(url, init, ms) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || 12000);
  try { return await fetch(url, Object.assign({}, init, { signal: ctl.signal })); } finally { clearTimeout(tm); }
}
