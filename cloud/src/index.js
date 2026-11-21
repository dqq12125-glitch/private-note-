// 回声岛公开版服务器（Cloudflare Worker）：入口和路由。接口合同在 cloud/API.md，部署和配置在 cloud/README.md。
// 不用 Durable Object：账号、用量、订阅都在 D1；实时语音就在这个 Worker 里转发（为什么见 talk.js 开头和 README「成本」）
import { HttpError, json, errorResponse, readJson } from './util.js';
import { config } from './config.js';
import { authUser, emailStart, emailVerify, appleSignIn, signOut } from './auth.js';
import { meView, mePatch, meDelete } from './me.js';
import { consentRequest, consentStatus, consentPage, revokePage } from './consent.js';
import { iapApple, iapNotify } from './iap.js';
import { aiCall, AI_PATHS } from './ai.js';
import { wsAccept } from './talk.js';
import { report, adminReports, purge } from './report.js';

const VERSION = '1.0.0';   // 入口模块只能导出处理函数，版本号不导出

function ctxOf(req, env, ctx) {
  const cfg = config(env), t0 = Date.now();
  // 测试钩子：x-test-now 请求头当「现在」（只在 TEST_HOOKS=1 且不是正式环境时认）
  const fake = cfg.testHooks ? +req.headers.get('x-test-now') : NaN;
  return { req, env, ctx, cfg, t0, now: isFinite(fake) && fake > 0 ? fake : t0, url: new URL(req.url), ip: req.headers.get('cf-connecting-ip') || 'unknown' };
}

const signedIn = async (R, s) => {
  const U = await authUser(R, s.token);
  return json(200, { token: s.token, expiresAt: s.expiresAt, created: s.created, me: await meView(R, U) });
};
const body = R => readJson(R.req, R.cfg.limits.jsonBytes);

async function route(R) {
  const p = R.url.pathname.replace(/\/+$/, ''), m = R.req.method;
  const want = (...ms) => { if (!ms.includes(m)) throw new HttpError(405, 'method', 'Method not allowed'); };
  const user = () => authUser(R);

  if (p === '/v1/health') { want('GET', 'HEAD'); return json(200, { ok: true, version: VERSION, time: new Date(R.now).toISOString(), speechLangs: R.cfg.speechLangs, talkLangs: R.cfg.talkLangs, questLangs: R.cfg.questLangs, tipLangs: R.cfg.tipLangs }); }   // 几张语言表不用登录也给：没登录的人要知道「这门语言服务器会，只差登录」
  // 登录
  if (p === '/v1/auth/email/start') { want('POST'); return json(200, await emailStart(R, await body(R))); }
  if (p === '/v1/auth/email/verify') { want('POST'); return signedIn(R, await emailVerify(R, await body(R))); }
  if (p === '/v1/auth/apple') { want('POST'); return signedIn(R, await appleSignIn(R, await body(R))); }
  if (p === '/v1/auth/signout') { want('POST'); const U = await user(); return json(200, await signOut(R, U, await body(R))); }
  // 账号
  if (p === '/v1/me') {
    want('GET', 'PATCH', 'DELETE');
    const U = await user();
    if (m === 'GET') return json(200, await meView(R, U));
    if (m === 'PATCH') return json(200, await mePatch(R, U, await body(R)));
    return json(200, await meDelete(R, U, await body(R)));
  }
  // 家长同意
  if (p === '/v1/consent/request') { want('POST'); const U = await user(); return json(200, await consentRequest(R, U, await body(R))); }
  if (p === '/v1/consent') { want('GET'); return json(200, consentStatus(R, await user())); }
  let k;
  if ((k = /^\/v1\/consent\/(c|r)\/([^/]+)$/.exec(p))) { want('GET', 'POST'); return k[1] === 'c' ? consentPage(R, k[2]) : revokePage(R, k[2]); }
  // 订阅
  if (p === '/v1/iap/apple') { want('POST'); return iapApple(R, await user()); }
  if (p === '/v1/iap/apple/notifications') { want('POST'); return iapNotify(R); }
  // AI
  if ((k = /^\/v1\/([a-z]+)$/.exec(p)) && AI_PATHS.includes(k[1])) { want('POST'); return aiCall(R, await user(), k[1]); }
  if (p === '/v1/talk' || p === '/v1/asr-rt') { want('GET'); return wsAccept(R, p === '/v1/talk' ? 'talk' : 'asr'); }
  // 举报
  if (p === '/v1/report') { want('POST'); return report(R, await user()); }
  if (p === '/v1/admin/reports') { want('GET'); return adminReports(R); }
  throw new HttpError(404, 'not_found', 'No such endpoint');
}

// CORS：只给 App 自己的网页（ALLOWED_ORIGINS）；原生代码不带 Origin，不受影响
function cors(R, res, origin) {
  if (!origin || !R || !R.cfg.origins.includes(origin) || res.status === 101) return res;
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', origin); h.append('Vary', 'Origin'); h.set('Access-Control-Expose-Headers', 'Retry-After');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('origin');
    let R = null;
    try {
      R = ctxOf(req, env, ctx);
      if (req.method === 'OPTIONS') {
        if (!origin || !R.cfg.origins.includes(origin)) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } });
      }
      return cors(R, await route(R), origin);
    } catch (e) {
      if (!(e instanceof HttpError)) { console.log('unhandled', e && e.stack || e); e = new HttpError(500, 'server', 'Server error'); }
      return cors(R, errorResponse(e), origin);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(purge(env, config(env), controller.scheduledTime || Date.now()).then(r => console.log('purge', JSON.stringify(r))));
  },
};
