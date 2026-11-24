// 配置：全部从 Worker 的环境变量（wrangler.toml 的 [vars] + `wrangler secret put` 的秘密）读，这里只放默认值。
// 每个名字的说明在 cloud/README.md「配置和秘密」。数字（每天几分钟、多少次、限流……）都在这里或 wrangler.toml，不写死在逻辑里。
import { HttpError } from './util.js';
import { CORE, questTable } from './shared.js';

// Apple Root CA - G3 的 SHA-256 指纹（Apple 公布的根证书列表 support.apple.com/121728：ECDSA 384 位、SHA-384、
// 序列号 2D C5 FC 88 D2 C5 4B 95、2039-04-30 到期）。App Store 签名数据（StoreKit 2 交易、服务器通知）的证书链最后一张必须是它。
// 只认指纹等于只认这一张证书本身（别的证书算不出同样的 SHA-256）；想把证书原文也放进来，设 APPLE_ROOT_CERT_B64（见 README）
export const APPLE_ROOT_G3_SHA256 = '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';

const DEF_PLANS = {
  // talkMin：每天实时聊天几分钟；asrN：每天几段识别（口语题打分）；auxN：每天几次点评 / 合成 / 翻译 / 打勾 / 检测判分
  free: { talkMin: 5, asrN: 400, auxN: 300 },
  monthly: { talkMin: 30, asrN: 1500, auxN: 1500 },
  yearly: { talkMin: 20, asrN: 1500, auxN: 1500 },
  // 测试账号（TESTERS 里列着的，2026-11-22 老板：「给我们开无限 AI，我们要做测试」，又说一遍「无限 AI」）：
  // 聊天每天 1440 分钟（一整天，用不完）、识别和别的各 100 万次 = 不限。用量照样记（每段聊天最长 10 分钟、每分钟限流照旧）
  tester: { talkMin: 1440, asrN: 1000000, auxN: 1000000 },
};
const DEF_RATE = {
  emailPerAddrHour: 5,     // 同一个邮箱每小时最多发几次登录码
  emailPerIpHour: 20,      // 同一个 IP 每小时最多要几次登录码
  signinPerIpHour: 60,     // 同一个 IP 每小时最多试几次登录（邮箱验证码 + Apple）
  aiPerUserMin: 60,        // 每个账号每分钟最多几次 AI 调用（HTTP）——有 RL_AI_USER 绑定时用绑定里的数
  aiPerIpMin: 240,         // 每个 IP 每分钟（RL_AI_IP）
  wsPerUserMin: 12,        // 每个账号每分钟最多开几次 WebSocket（RL_WS_USER）
  reportPerUserDay: 20,    // 每个账号每天最多举报几次
  consentPerUserDay: 5,    // 每个账号每天最多发几次家长同意邮件
};

// 识别 / 合成认的语言（API.md §8 的 lang）：代码 → 阿里云合成的 language_type。只认这几种；SPEECH_LANGS 能关掉其中几种（英语一直在）
export const SPEECH_KNOWN = { en: 'English', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' };
// 别的语言合成用的音色（英语照旧用 TTS_VOICE_F / TTS_VOICE_M）：说这门语言地道的那几个，和实时聊天用的同名（tools/course/TALK.md §0）。
// 2026-11-21 对着真的阿里云实测过：合成模型认这些名字，合成出来的西语 / 日语 / 中文识别一字不差。TTS_VOICES 可改
const DEF_TTS_VOICES = { es: { f: 'Sonrisa', m: 'Bodega' }, ja: { f: 'Ono Anna', m: 'Ryan' }, zh: { f: 'Serena', m: 'Ryan' } };

const num = (v, d) => (v === undefined || v === null || v === '' || !isFinite(+v) ? d : +v);
const list = (v, d) => String(v == null || v === '' ? d : v).split(',').map(s => s.trim()).filter(Boolean);
function obj(v, d) {
  if (v == null || v === '') return d;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { throw new HttpError(503, 'unavailable', 'Bad JSON in config', { what: 'config' }); }
}

const cache = new WeakMap();
export function config(env) {
  let c = cache.get(env);
  if (c) return c;
  const ENV = String(env.ENVIRONMENT || 'dev');
  const prod = ENV === 'production';
  const plansIn = obj(env.PLANS, {});
  const plans = {};
  for (const k of Object.keys(DEF_PLANS)) plans[k] = Object.assign({}, DEF_PLANS[k], plansIn[k] || {});
  const bundleId = String(env.APPLE_BUNDLE_ID || '');
  const voicesIn = obj(env.TTS_VOICES, {}), ttsVoices = {};
  for (const k of Object.keys(DEF_TTS_VOICES)) ttsVoices[k] = Object.assign({}, DEF_TTS_VOICES[k], voicesIn[k] || {});
  const testHooks = String(env.TEST_HOOKS || '') === '1' && !prod;
  // 和岛民聊天（/v1/talk，连带 /v1/steps、/v1/zh）能用哪些语言：英语打头，只留 talk-core 认得的（CORE.LANGS）；GET /v1/me 的 talkLangs 就是它
  const talkLangs = ['en'].concat(list(env.TALK_LANGS, 'en,es,ja,zh').filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i));
  // 别的语言的课里的委托译文（talk-courses.js 的 quests）；测试钩子 TEST_QUESTS（JSON，同样的形状）并上去——测试用小样，不用等正式的译文
  const quests = questTable(testHooks ? obj(env.TEST_QUESTS, null) : null);
  c = {
    env: ENV, prod,
    // 测试钩子（x-test-now 请求头改「现在」、上游不限主机、TEST_QUESTS 委托译文的小样）：只在 TEST_HOOKS=1 且不是正式环境时打开
    testHooks,
    publicUrl: String(env.PUBLIC_URL || '').replace(/\/+$/, ''),
    company: String(env.COMPANY_NAME || 'Echo of Forest Pty Ltd'),
    privacyUrl: String(env.PRIVACY_URL || ''),
    pepper: String(env.AUTH_PEPPER || ''),
    adminToken: String(env.ADMIN_TOKEN || ''),
    dataKey: String(env.DATA_KEY || ''),
    origins: list(env.ALLOWED_ORIGINS, 'echoisland://localhost,https://appassets.androidplatform.net'),
    plans,
    // 测试账号：账号 id（u_…）或邮箱，逗号隔开。放在 Worker 的秘密里（wrangler secret put TESTERS），不写进公开的仓库
    testers: list(env.TESTERS, ''),
    rate: Object.assign({}, DEF_RATE, obj(env.RATE, {})),
    consentGated: list(env.CONSENT_GATED, 'talk,place,steps'),
    sessionDays: num(env.SESSION_DAYS, 180),
    tzChangeDays: num(env.TZ_CHANGE_DAYS, 7),
    reportDays: num(env.REPORT_DAYS, 90),
    usageKeepDays: num(env.USAGE_KEEP_DAYS, 40),
    consentLinkDays: num(env.CONSENT_LINK_DAYS, 7),
    codeMin: num(env.EMAIL_CODE_MIN, 10),
    codeTries: num(env.EMAIL_CODE_TRIES, 5),
    limits: {
      jsonBytes: num(env.MAX_JSON_BYTES, 65536),
      asrBytes: num(env.MAX_ASR_BYTES, 1500000),
      wsMsgBytes: num(env.MAX_WS_MSG_BYTES, 262144),
    },
    talk: {
      sessionMaxSec: num(env.TALK_SESSION_MAX_SEC, 600),   // 每段对话最长几秒
      warnSec: num(env.TALK_WARN_SEC, 60),                 // 还剩几秒时提醒
      minStartSec: num(env.TALK_MIN_START_SEC, 20),        // 今天剩下不到这么多秒就不让开新的一段（和中转服务一样）
      beatSec: num(env.TALK_BEAT_SEC, 20),                 // 每几秒把进度写进 D1
      staleSec: num(env.TALK_STALE_SEC, 60),               // 进度多久没更新算这段已经断了
      maxPerUser: num(env.TALK_MAX_PER_USER, 1),           // 一个账号同时几段
      authWaitSec: num(env.WS_AUTH_WAIT_SEC, 10),          // 等第一条 auth 消息几秒
    },
    asrRt: { maxSec: num(env.ASR_RT_MAX_SEC, 15), maxB64: num(env.ASR_RT_MAX_B64, 700000) },
    // 识别（/v1/asr、/v1/asr-rt）和合成（/v1/tts）能用哪些语言：英语打头，只留 SPEECH_KNOWN 里有的；GET /v1/me 的 speechLangs 就是它
    speechLangs: ['en'].concat(list(env.SPEECH_LANGS, 'en,es,ja,zh').filter((l, i, a) => l !== 'en' && Object.prototype.hasOwnProperty.call(SPEECH_KNOWN, l) && a.indexOf(l) === i)),
    talkLangs,
    // 支线委托（/v1/talk?quest=&lang=、/v1/steps 的 q + lang）能用哪些语言：QUEST_LANGS（没配 = 和 talkLangs 一样），还要 talkLangs 里开着、
    // 服务器上真有这门语言的委托译文（没有译文的语言不报，App 就不出「?」）；英语一直在。GET /v1/me、/v1/health 的 questLangs 就是它
    questLangs: ['en'].concat(list(env.QUEST_LANGS, talkLangs.join(',')).filter((l, i, a) => l !== 'en' && talkLangs.includes(l) && !!quests[l] && Object.keys(quests[l]).length > 0 && a.indexOf(l) === i)),
    // AI 发音点评（/v1/tip 的 lang）能用哪些语言：TIP_LANGS（没配 = 和 talkLangs 一样），只留 talk-core 认得的；英语一直在。tipLangs 就是它
    tipLangs: ['en'].concat(list(env.TIP_LANGS, talkLangs.join(',')).filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i)),
    // 为你出的题（/v1/gen 的 lang）能用哪些语言：GEN_LANGS（没配 = 和 talkLangs 一样），只留 talk-core 认得的；英语一直在。genLangs 就是它
    genLangs: ['en'].concat(list(env.GEN_LANGS, talkLangs.join(',')).filter((l, i, a) => l !== 'en' && !!CORE.langOk(l) && a.indexOf(l) === i)),
    quests,
    // 阿里云百炼国际版（新加坡）。模型名、地址都是配置：国际版和北京区的模型列表不一样，上线前对着控制台核对（README）
    ds: {
      key: String(env.DASHSCOPE_API_KEY || ''),
      httpBase: String(env.DS_HTTP_BASE || 'https://dashscope-intl.aliyuncs.com').replace(/\/+$/, ''),
      wsBase: String(env.DS_WS_BASE || 'wss://dashscope-intl.aliyuncs.com').replace(/\/+$/, ''),
      talkModel: String(env.TALK_MODEL || 'qwen3.8-omni-flash-realtime'),
      talkAsrModel: String(env.TALK_ASR_MODEL || 'qwen3-asr-flash-realtime'),
      asrRtModel: String(env.ASR_RT_MODEL || 'qwen3-asr-flash-realtime'),
      asrModel: String(env.ASR_MODEL || 'qwen3-asr-flash'),
      evalModel: String(env.EVAL_MODEL || 'qwen-plus'),
      ttsModel: String(env.TTS_MODEL || 'qwen3-tts-flash'),
      ttsVoice: { f: String(env.TTS_VOICE_F || 'Jennifer'), m: String(env.TTS_VOICE_M || 'Aiden') },
      ttsVoices,                               // 别的语言的合成音色：{ es: { f, m }, ja: …, zh: … }
      voiceMap: obj(env.TALK_VOICE_MAP, {}),   // 岛民音色改名：{ "talk-npcs 里的名字": "国际版有的名字" }，默认不改
    },
    apple: {
      bundleId,
      audiences: list(env.APPLE_AUDIENCES, bundleId),
      products: obj(env.APPLE_PRODUCTS, {}),      // { 产品 id: 'monthly' | 'yearly' }
      environments: list(env.APPLE_ENVIRONMENTS, 'Production,Sandbox'),
      rootSha256: list(env.APPLE_ROOT_SHA256, APPLE_ROOT_G3_SHA256).map(s => s.toLowerCase().replace(/[^0-9a-f]/g, '')),
      rootDerB64: String(env.APPLE_ROOT_CERT_B64 || '').replace(/\s+/g, ''),
      issuer: 'https://appleid.apple.com',
      jwksUrl: String(env.APPLE_JWKS_URL || 'https://appleid.apple.com/auth/keys'),
      authBase: String(env.APPLE_AUTH_BASE || 'https://appleid.apple.com').replace(/\/+$/, ''),
      teamId: String(env.APPLE_TEAM_ID || ''),
      keyId: String(env.APPLE_SIGNIN_KEY_ID || ''),
      key: String(env.APPLE_SIGNIN_KEY || ''),       // .p8 的内容（PKCS#8 PEM），秘密
      clientId: String(env.APPLE_CLIENT_ID || bundleId),
    },
    email: {
      provider: String(env.EMAIL_PROVIDER || (prod ? 'resend' : 'console')),
      from: String(env.EMAIL_FROM || ''),
      resendKey: String(env.RESEND_API_KEY || ''),
      resendUrl: String(env.RESEND_API_URL || 'https://api.resend.com/emails'),
    },
  };
  // 只连这些主机（防止配置写错或被改成别的地址）：正式环境里阿里云只许 *.aliyuncs.com，Apple 只许 appleid.apple.com，邮件只许 api.resend.com
  c.hostOk = (url, kind) => {
    let h; try { h = new URL(url).hostname; } catch (e) { return false; }
    if (c.testHooks) return true;
    if (kind === 'ds') return /(^|\.)aliyuncs\.com$/.test(h);
    if (kind === 'apple') return h === 'appleid.apple.com';
    if (kind === 'email') return h === 'api.resend.com';
    return false;
  };
  cache.set(env, c);
  return c;
}

// 识别 / 合成的语言（API.md §8 的 lang）：没给 = 英语（发给上游的和以前一字不差）；不认得的、服务器关掉的 → 400 bad_request
// （field lang、reason unsupported_lang、supported 列出能用的）。names：/v1/tts 以前收 "English" / "Chinese"，这种写法照样认
export function speechLang(c, v, names) {
  if (v === undefined || v === null || v === '') return 'en';
  let s = String(v);
  if (names) { const k = Object.keys(SPEECH_KNOWN).find(x => SPEECH_KNOWN[x] === s); if (k) s = k; }
  if (!c.speechLangs.includes(s)) throw new HttpError(400, 'bad_request', 'Unsupported language', { field: 'lang', reason: 'unsupported_lang', supported: c.speechLangs.slice() });
  return s;
}

// 聊天的语言（API.md §8「Chat language」）：v 是手机说的语言代码（npc=dyn 的 p.lang、/v1/steps 和 /v1/zh 的 lang）或者角色自己的 lang。
// 没给 / '' / 'en' = 英语（返回 ''，一切照旧）；talk-core 认得、服务器开着的 → 这个代码；别的（不认得的、TALK_LANGS 关掉的）→ 400 bad_request
// （field lang、reason unsupported_lang、supported 列出能用的），和识别 / 合成的 lang 一个样：不扣额度、不连上游
export function talkLang(c, v) { return langIn(c.talkLangs, v); }
// 委托的语言（/v1/talk?quest= 的 lang、/v1/steps 带 q 时的 lang）、发音点评的语言（/v1/tip 的 lang）：规矩和 talkLang 一样，各看各的那张表
export function questLang(c, v) { return langIn(c.questLangs, v); }
export function tipLang(c, v) { return langIn(c.tipLangs, v); }
// 为你出的题的语言（/v1/gen 的 lang）：同样的规矩，看 genLangs
export function genLang(c, v) { return langIn(c.genLangs, v); }
export const noLang = supported => new HttpError(400, 'bad_request', 'Unsupported language', { field: 'lang', reason: 'unsupported_lang', supported: supported.slice() });
function langIn(langs, v) {
  if (v === undefined || v === null || v === '' || v === 'en') return '';
  const l = CORE.langOk(v);
  if (!l || !langs.includes(l)) throw noLang(langs);
  return l;
}

// 一定要有的秘密：没有就 503（部署了但没配好时，别带着默认值跑）
export function need(c, what) {
  const ok = what === 'pepper' ? (c.pepper || !c.prod) : what === 'ds' ? !!c.ds.key : true;
  if (!ok) throw new HttpError(503, 'unavailable', 'Server is not configured: ' + what, { what });
  return what === 'pepper' ? (c.pepper || 'dev-only-pepper') : true;
}
