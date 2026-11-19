// 测试用的证书和钥匙：自己造一套和 App Store 一样形状的证书链（根 P-384 自签 → 中间 P-384 → 叶子 P-256，
// 中间和叶子带 Apple 的两个 OID），用来签「StoreKit 2 交易」和「服务器通知」；再造几套坏的（不认识的根、签名对不上、过期）。
// 造出来的证书用 Node 自带的 X509Certificate（OpenSSL）解析并验签一遍，免得服务器的解析器和这里的编码器一起写错。
// 还有：Sign in with Apple 的 RSA 钥匙（假的 JWKS）、签 client_secret 用的 P-256 钥匙。
import crypto from 'node:crypto';

// ---------- 最小的 DER 编码器 ----------
const L = n => (n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255]);
const tlv = (tag, c) => Buffer.concat([Buffer.from([tag, ...L(c.length)]), c]);
const seq = (...x) => tlv(0x30, Buffer.concat(x));
const set = (...x) => tlv(0x31, Buffer.concat(x));
const int = b => { b = Buffer.from(b); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return tlv(0x02, b); };
const nul = () => tlv(0x05, Buffer.alloc(0));
const bool = v => tlv(0x01, Buffer.from([v ? 0xff : 0]));
const octet = b => tlv(0x04, b);
const bits = b => tlv(0x03, Buffer.concat([Buffer.from([0]), b]));
const exp = (n, x) => tlv(0xa0 + n, x);
function oid(s) {
  const p = s.split('.').map(Number), out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) { const t = []; let x = v; do { t.unshift(x & 0x7f); x = Math.floor(x / 128); } while (x); for (let i = 0; i < t.length - 1; i++) t[i] |= 0x80; out.push(...t); }
  return tlv(0x06, Buffer.from(out));
}
function time(ms) {
  const d = new Date(ms), y = d.getUTCFullYear(), p = n => String(n).padStart(2, '0');
  const s = p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  return y >= 1950 && y < 2050 ? tlv(0x17, Buffer.from(p(y % 100) + s)) : tlv(0x18, Buffer.from(y + s));
}
const name = cn => seq(set(seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from(cn)))), set(seq(oid('2.5.4.10'), tlv(0x0c, Buffer.from('Echo Test PKI')))));

export const OID_LEAF = '1.2.840.113635.100.6.11.1', OID_INTER = '1.2.840.113635.100.6.2.1';
let serial = 1000;
// 造一张证书：issuerKey 签；hash 'sha256' | 'sha384'
export function makeCert({ cn, issuerCn, pub, issuerKey, hash, from, to, ca, marks }) {
  const alg = seq(oid(hash === 'sha384' ? '1.2.840.10045.4.3.3' : '1.2.840.10045.4.3.2'));
  const exts = [seq(oid('2.5.29.19'), bool(true), octet(ca ? seq(bool(true)) : seq()))].concat((marks || []).map(m => seq(oid(m), octet(nul()))));
  const tbs = seq(exp(0, int([2])), int([serial >> 8, serial++ & 255]), alg, name(issuerCn), seq(time(from), time(to)), name(cn), pub.export({ type: 'spki', format: 'der' }), exp(3, seq(...exts)));
  const sig = crypto.sign(hash, tbs, { key: issuerKey, dsaEncoding: 'der' });
  return seq(tbs, alg, bits(sig));
}
const ec = curve => crypto.generateKeyPairSync('ec', { namedCurve: curve });
const YEAR = 365 * 86400000;

// 一整套：根 → 中间 → 叶子
export function makeChain(tag, o) {
  o = o || {};
  const now = Date.now(), r = ec('P-384'), i = ec('P-384'), l = ec('P-256');
  const root = makeCert({ cn: tag + ' Root CA', issuerCn: tag + ' Root CA', pub: r.publicKey, issuerKey: r.privateKey, hash: 'sha384', from: now - 10 * YEAR, to: now + 10 * YEAR, ca: true });
  const inter = makeCert({ cn: tag + ' Intermediate', issuerCn: tag + ' Root CA', pub: i.publicKey, issuerKey: r.privateKey, hash: 'sha384', from: now - 5 * YEAR, to: now + 5 * YEAR, ca: true, marks: [OID_INTER] });
  const leaf = makeCert({ cn: tag + ' Signing', issuerCn: o.leafIssuerCn || tag + ' Intermediate', pub: l.publicKey, issuerKey: o.leafSigner || i.privateKey, hash: 'sha384',
    from: o.leafFrom || now - YEAR, to: o.leafTo || now + YEAR, ca: false, marks: o.noMark ? [] : [OID_LEAF] });
  return { root, inter, leaf, rootKey: r, interKey: i, leafKey: l, fp: crypto.createHash('sha256').update(root).digest('hex') };
}
// 用 OpenSSL 核对造出来的链（证书能解析、签名对得上）
export function selfCheck(c) {
  const R = new crypto.X509Certificate(c.root), I = new crypto.X509Certificate(c.inter), Lf = new crypto.X509Certificate(c.leaf);
  return R.verify(R.publicKey) && I.verify(R.publicKey) && Lf.verify(I.publicKey) && I.ca && !Lf.ca && Lf.checkIssued(I) && I.checkIssued(R);
}

const b64url = b => Buffer.from(b).toString('base64url');
// App Store 风格的 JWS：ES256，头里 x5c = [叶子, 中间, 根]（标准 base64）
export function signJws(payload, c, o) {
  o = o || {};
  const head = b64url(JSON.stringify({ alg: 'ES256', x5c: (o.certs || [c.leaf, c.inter, c.root]).map(d => Buffer.from(d).toString('base64')) }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: (o.key || c.leafKey).privateKey, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64url(sig);
}

// ---------- Sign in with Apple ----------
export function appleIdKeys() {
  const k = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(k.publicKey.export({ format: 'jwk' }), { kid: 'test-kid-1', alg: 'RS256', use: 'sig' });
  return { key: k, other, jwks: { keys: [jwk] } };
}
export function idToken(K, claims, o) {
  o = o || {};
  const head = b64url(JSON.stringify({ alg: 'RS256', kid: o.kid || 'test-kid-1' })), body = b64url(JSON.stringify(claims));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), (o.key || K.key).privateKey);
  return head + '.' + body + '.' + b64url(sig);
}
export const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex');
// client_secret 用的 .p8（PKCS#8 PEM）
export function p8() {
  const k = ec('P-256');
  return { pem: k.privateKey.export({ type: 'pkcs8', format: 'pem' }), pub: k.publicKey };
}
export function verifyEs256Jwt(jwt, pub) {
  const [h, b, s] = jwt.split('.');
  const ok = crypto.verify('sha256', Buffer.from(h + '.' + b), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  return { ok, header: JSON.parse(Buffer.from(h, 'base64url')), claims: JSON.parse(Buffer.from(b, 'base64url')) };
}
