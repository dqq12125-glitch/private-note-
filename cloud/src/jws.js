// JWS / JWT：
// - verifyAppleSigned()：App Store 的签名数据（StoreKit 2 交易、续订信息、服务器通知 V2），ES256 + x5c 证书链
// - verifyIdToken()：Sign in with Apple 的身份令牌，RS256，用 Apple 公布的 JWKS 验签
// - es256Jwt()：用 .p8 钥匙签 Sign in with Apple 的 client_secret（删号时撤销 Apple 授权用）
// - seal() / unseal()：AES-GCM 加密存 Apple 的 refresh token
import { enc, dec, unb64, b64url, b64json, fetchT, sha256, hex } from './util.js';
import { verifyChain, publicKey, CertError } from './x509.js';

export class JwsError extends Error { constructor(reason, msg) { super(msg || reason); this.reason = reason; } }

function split(jws) {
  const p = String(jws || '').split('.');
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) throw new JwsError('format', 'not a JWS');
  const header = b64json(p[0]), payload = b64json(p[1]);
  if (!header || !payload || typeof payload !== 'object') throw new JwsError('format', 'bad JWS JSON');
  return { p, header, payload, data: enc.encode(p[0] + '.' + p[1]), sig: unb64(p[2]) };
}

// App Store 签名数据 → 内容。trust = { rootSha256: [...], rootDer: Uint8Array|null }
export async function verifyAppleSigned(jws, trust, now) {
  const x = split(jws);
  if (x.header.alg !== 'ES256' || !Array.isArray(x.header.x5c)) throw new JwsError('format', 'expected ES256 with x5c');
  let leaf;
  const at = +x.payload.signedDate || now;   // 证书在签名那一刻有效就行（续订通知可能是很久以前买的那条链签的）
  try { leaf = await verifyChain(x.header.x5c.map(s => unb64(s)), at, trust); }
  catch (e) { throw new JwsError(e instanceof CertError ? e.reason : 'chain', e.message); }
  const { key } = await publicKey(leaf);
  if (x.sig.length !== 64 || !(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, x.sig, x.data))) throw new JwsError('signature', 'JWS signature does not verify');
  return x.payload;
}

// ---------- Sign in with Apple ----------
const JWKS = { url: '', at: 0, keys: [], tried: 0 };
async function jwk(cfg, kid, now) {
  const fresh = JWKS.url === cfg.apple.jwksUrl && now - JWKS.at < 3600000;
  let k = fresh && JWKS.keys.find(x => x.kid === kid);
  if (k) return k;
  if (now - JWKS.tried < 10000 && JWKS.url === cfg.apple.jwksUrl && fresh) return null;   // 不认识的 kid：10 秒内只重新拉一次
  if (!cfg.hostOk(cfg.apple.jwksUrl, 'apple')) throw new JwsError('config', 'JWKS host not allowed');
  JWKS.tried = now;
  const r = await fetchT(cfg.apple.jwksUrl, {}, 8000);
  if (!r.ok) throw new JwsError('jwks', 'JWKS HTTP ' + r.status);
  const j = await r.json();
  Object.assign(JWKS, { url: cfg.apple.jwksUrl, at: now, keys: Array.isArray(j.keys) ? j.keys : [] });
  return JWKS.keys.find(x => x.kid === kid) || null;
}
// 身份令牌 → claims（已经核对签名、iss、aud、exp、iat、nonce）
export async function verifyIdToken(cfg, token, rawNonce, now) {
  const x = split(token);
  if (x.header.alg !== 'RS256' || !x.header.kid) throw new JwsError('format', 'expected RS256');
  const k = await jwk(cfg, x.header.kid, now);
  if (!k || k.kty !== 'RSA') throw new JwsError('key', 'unknown key id');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, x.sig, x.data))) throw new JwsError('signature', 'bad signature');
  const c = x.payload;
  if (c.iss !== cfg.apple.issuer) throw new JwsError('iss', 'wrong issuer');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.some(a => cfg.apple.audiences.includes(a))) throw new JwsError('aud', 'wrong audience');
  if (!(+c.exp * 1000 > now)) throw new JwsError('exp', 'token expired');
  if (c.iat && +c.iat * 1000 > now + 300000) throw new JwsError('iat', 'token from the future');
  if (!c.sub) throw new JwsError('sub', 'no subject');
  // App 把 SHA-256(原始 nonce) 的十六进制交给 Apple，令牌里就是这个；我们拿原始 nonce 再算一遍对上
  if (typeof rawNonce !== 'string' || rawNonce.length < 16 || rawNonce.length > 200) throw new JwsError('nonce', 'nonce missing');
  if (c.nonce !== hex(await sha256(rawNonce))) throw new JwsError('nonce', 'nonce mismatch');
  return c;
}

// ---------- ES256 签名（client_secret） ----------
function pemBody(pem) {
  return unb64(String(pem).replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, ''));
}
export async function es256Jwt(pem, kid, claims) {
  const key = await crypto.subtle.importKey('pkcs8', pemBody(pem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'ES256', kid }))), body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
  return head + '.' + body + '.' + b64url(sig);
}

// ---------- AES-GCM（DATA_KEY = 32 字节的 base64） ----------
async function aesKey(b64key) {
  const raw = unb64(b64key);
  if (raw.length !== 32) throw new Error('DATA_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(b64key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(b64key), enc.encode(text)));
  return 'v1.' + b64url(iv) + '.' + b64url(ct);
}
export async function unseal(b64key, s) {
  const p = String(s || '').split('.');
  if (p[0] !== 'v1' || p.length !== 3) return null;
  try { return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p[1]) }, await aesKey(b64key), unb64(p[2]))); } catch (e) { return null; }
}
