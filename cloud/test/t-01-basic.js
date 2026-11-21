// 健康检查、路由、CORS、请求体大小
import { ok, eq } from './lib.js';

export default async function ({ A }) {
  const h = await A.api('GET', '/v1/health');
  ok(h.status === 200 && h.json.ok === true && h.json.version, 'health：200、ok、有版本号', h);
  eq([h.json.speechLangs, h.json.talkLangs], [['en', 'es', 'ja', 'zh'], ['en', 'es', 'ja', 'zh']], 'health：不用登录也给识别 / 合成、聊天会的语言（没登录的 App 要知道「只差登录」）');
  eq([h.json.questLangs, h.json.tipLangs], [['en', 'es', 'ja', 'zh'], ['en', 'es', 'ja', 'zh']], 'health：也给支线委托（服务器上有译文的语言——这里是测试的小样）、AI 发音点评会的语言');
  const nf = await A.api('GET', '/v1/nope');
  eq([nf.status, nf.json && nf.json.error], [404, 'not_found'], '没有的路径：404 not_found');
  const mm = await A.api('GET', '/v1/auth/email/start');
  eq([mm.status, mm.json && mm.json.error], [405, 'method'], '方法不对：405');
  const me = await A.api('GET', '/v1/me');
  eq([me.status, me.json.error, me.json.reason], [401, 'auth', 'token'], '没带 token：401 auth（reason token）');
  const bad = await A.api('GET', '/v1/me', { token: 'eis_' + 'x'.repeat(43) });
  eq([bad.status, bad.json.reason], [401, 'token'], '不认识的 token：401');
  // CORS：App 的网页来源可以，别的不行
  const pre = await A.api('OPTIONS', '/v1/me', { headers: { Origin: 'echoisland://localhost', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  ok(pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'echoisland://localhost' && /Authorization/.test(pre.headers.get('access-control-allow-headers')), 'CORS 预检：App 的来源 204，允许 Authorization 头', { s: pre.status });
  const pre2 = await A.api('OPTIONS', '/v1/me', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
  eq(pre2.status, 403, 'CORS 预检：别的网站 403');
  const h2 = await A.api('GET', '/v1/health', { headers: { Origin: 'https://appassets.androidplatform.net' } });
  eq(h2.headers.get('access-control-allow-origin'), 'https://appassets.androidplatform.net', '安卓 WebView 的来源拿到 CORS 头');
  // 请求体太大：413
  const big = await A.api('POST', '/v1/auth/email/start', { raw: JSON.stringify({ email: 'a@b.cd', pad: 'x'.repeat(70000) }), headers: { 'Content-Type': 'application/json' } });
  eq([big.status, big.json && big.json.error, big.json && big.json.limit], [413, 'too_large', 65536], 'JSON 超过 64 KB：413 too_large');
  const notJson = await A.api('POST', '/v1/auth/email/start', { raw: '[1,2]', headers: { 'Content-Type': 'application/json' } });
  eq([notJson.status, notJson.json.error], [400, 'bad_request'], '请求体不是 JSON 对象：400');
}
