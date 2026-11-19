// 最小的 DER / X.509 解析和证书链验证：只做 App Store 签名数据要的那几样（ECDSA P-256 / P-384，SHA-256 / SHA-384）。
// Worker 里没有 node:crypto 的 X509Certificate，这里自己读 DER，签名交给 WebCrypto（crypto.subtle.verify）。
// 测试（cloud/test/pki.js）用自己造的一套证书链跑这里，并用 Node 自带的 X509Certificate 交叉核对造出来的证书
import { hex, sha256 } from './util.js';

export class CertError extends Error { constructor(reason, msg) { super(msg || reason); this.reason = reason; } }
const fail = (reason, msg) => { throw new CertError(reason, msg); };

// ---------- DER ----------
export function tlv(b, p) {
  if (p + 2 > b.length) fail('format', 'DER: truncated');
  const tag = b[p]; let len = b[p + 1], q = p + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) fail('format', 'DER: bad length');
    len = 0; for (let i = 0; i < n; i++) len = len * 256 + b[q++];
  }
  if (q + len > b.length) fail('format', 'DER: length past end');
  return { tag, start: p, cs: q, ce: q + len, end: q + len };
}
export function kids(b, t) {
  const out = []; let p = t.cs;
  while (p < t.ce) { const c = tlv(b, p); out.push(c); p = c.end; }
  if (p !== t.ce) fail('format', 'DER: children overrun');
  return out;
}
export function oid(b, t) {
  const v = b.subarray(t.cs, t.ce); if (!v.length) fail('format', 'DER: empty OID');
  const parts = [Math.floor(v[0] / 40), v[0] % 40]; let n = 0;
  for (let i = 1; i < v.length; i++) { n = n * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { parts.push(n); n = 0; } }
  return parts.join('.');
}
function time(b, t) {
  const s = String.fromCharCode.apply(null, b.subarray(t.cs, t.ce));
  let m;
  if (t.tag === 0x17 && (m = /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s))) return Date.UTC((+m[1] < 50 ? 2000 : 1900) + +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (t.tag === 0x18 && (m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return fail('format', 'X.509: bad time');
}

const SIG_ALG = { '1.2.840.10045.4.3.2': 'SHA-256', '1.2.840.10045.4.3.3': 'SHA-384' };
const CURVE = { '1.2.840.10045.3.1.7': { name: 'P-256', size: 32 }, '1.3.132.0.34': { name: 'P-384', size: 48 } };
const EC_KEY = '1.2.840.10045.2.1';

export function parseCert(der) {
  const top = tlv(der, 0);
  if (top.tag !== 0x30 || top.end !== der.length) fail('format', 'X.509: not a certificate');
  const [tbs, alg, sig] = kids(der, top);
  if (!tbs || !alg || !sig || tbs.tag !== 0x30 || sig.tag !== 0x03) fail('format', 'X.509: bad structure');
  const f = kids(der, tbs); let i = 0;
  if (f[0] && f[0].tag === 0xa0) i++;
  const [/* serial */, /* sigAlg */, issuer, validity, subject, spki] = f.slice(i, i + 6);
  if (!spki) fail('format', 'X.509: missing fields');
  const [nb, na] = kids(der, validity);
  const [kalg] = kids(der, spki), [kOid, kCurve] = kids(der, kalg);
  const ext = {};
  for (const x of f.slice(i + 6)) {
    if (x.tag !== 0xa3) continue;
    const [seq] = kids(der, x);
    for (const e of kids(der, seq)) {
      const parts = kids(der, e), id = oid(der, parts[0]), val = parts[parts.length - 1];
      ext[id] = { critical: parts.length === 3 && der[parts[1].cs] !== 0, value: der.subarray(val.cs, val.ce) };
    }
  }
  // basicConstraints：cA 为真才是 CA
  let ca = false;
  if (ext['2.5.29.19']) {
    const v = ext['2.5.29.19'].value, s = tlv(v, 0), c = s.cs < s.ce ? tlv(v, s.cs) : null;
    ca = !!(c && c.tag === 0x01 && v[c.cs] !== 0);
  }
  return {
    der,
    tbs: der.subarray(tbs.start, tbs.end),
    sigAlg: oid(der, kids(der, alg)[0]),
    sig: der.subarray(sig.cs + 1, sig.ce),   // BIT STRING 第一个字节是「没用的位数」
    issuer: der.subarray(issuer.start, issuer.end),
    subject: der.subarray(subject.start, subject.end),
    notBefore: time(der, nb), notAfter: time(der, na),
    keyAlg: oid(der, kOid), curve: kCurve && kCurve.tag === 0x06 ? oid(der, kCurve) : '',
    spki: der.subarray(spki.start, spki.end),
    ext, ca,
  };
}

// ECDSA 签名：DER 的 SEQUENCE { r, s } → WebCrypto 要的定长 r‖s
export function derSigToRaw(sig, size) {
  const seq = tlv(sig, 0); if (seq.tag !== 0x30) fail('signature', 'bad ECDSA signature');
  const [r, s] = kids(sig, seq), out = new Uint8Array(size * 2);
  [r, s].forEach((x, k) => {
    let v = sig.subarray(x.cs, x.ce);
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) fail('signature', 'bad ECDSA integer');
    out.set(v, k * size + size - v.length);
  });
  return out;
}

export async function publicKey(cert) {
  const c = CURVE[cert.curve];
  if (cert.keyAlg !== EC_KEY || !c) fail('chain', 'unsupported key');
  return { key: await crypto.subtle.importKey('spki', cert.spki, { name: 'ECDSA', namedCurve: c.name }, false, ['verify']), size: c.size };
}
// child 是不是 parent 签的
async function signedBy(child, parent) {
  const hash = SIG_ALG[child.sigAlg]; if (!hash) fail('chain', 'unsupported signature algorithm');
  const { key, size } = await publicKey(parent);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash }, key, derSigToRaw(child.sig, size), child.tbs);
  if (!ok) fail('chain', 'certificate signature does not verify');
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// App Store 的证书链：[叶子, 中间, 根]。
// 根：SHA-256 指纹必须在 rootSha256 里（正式 = Apple Root CA - G3；测试注入自己的），给了 rootDer 还要逐字节一样，并且是自签的；
// 中间：根签的、是 CA、带 Apple 的 OID 1.2.840.113635.100.6.2.1；叶子：中间签的、带 1.2.840.113635.100.6.11.1；
// 每张在 at 这个时刻都在有效期里（at = 签名数据自己的 signedDate，和 Apple 官方库关掉联网检查时一样）。
// 不查吊销（OCSP）：要联网，见 README
export const OID_LEAF = '1.2.840.113635.100.6.11.1';
export const OID_INTER = '1.2.840.113635.100.6.2.1';
export async function verifyChain(ders, at, trust) {
  if (!Array.isArray(ders) || ders.length !== 3) fail('chain', 'expected 3 certificates');
  const [leaf, inter, root] = ders.map(parseCert);
  const fp = hex(await sha256(root.der));
  if (!trust.rootSha256.includes(fp)) fail('chain', 'root is not trusted');
  if (trust.rootDer && !same(root.der, trust.rootDer)) fail('chain', 'root is not the configured certificate');
  if (!same(root.subject, root.issuer)) fail('chain', 'root is not self-signed');
  if (!same(inter.issuer, root.subject) || !same(leaf.issuer, inter.subject)) fail('chain', 'names do not chain');
  if (!inter.ca || !root.ca) fail('chain', 'issuer is not a CA');
  if (!inter.ext[OID_INTER] || !leaf.ext[OID_LEAF]) fail('chain', 'missing Apple certificate marker');
  for (const c of [leaf, inter, root]) if (!(at >= c.notBefore && at <= c.notAfter)) fail('chain', 'certificate not valid at signing time');
  await signedBy(root, root);
  await signedBy(inter, root);
  await signedBy(leaf, inter);
  return leaf;
}
