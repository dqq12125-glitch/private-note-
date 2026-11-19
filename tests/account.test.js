// 云端模式（公开版：账号、每天免费 AI、会员、家长同意、举报、删号；account.js + talk.js / game.js / setup.js 里的钩子）的端到端测试。
// 跑**真的服务器**：和 cloud/test/run.js 一样用 wrangler 打包 cloud/（输出到 cloud/node_modules/.cache 下，不和 tests/cloud.test.js 抢 cloud/dist）、
// 起假的阿里云 / Resend / Apple（cloud/test/fakes.js）、自己造的 App Store 证书链（cloud/test/pki.js）、Miniflare 起两个本机 Worker：
//   A：正常的额度（免费每天 5 分钟）；B：免费每天只有 24 秒、提前 8 秒提醒（测「还剩 60 秒」的提醒和到点收尾、额度用完）。
// 再用 Playwright 打开**真的游戏页**（?cloud=<Worker 地址>）+ 假原生桥（tests/fake-native.js，platform 'ios' 时有订阅和通过 Apple 登录）：
//   首次设置向导没有「粘贴 AI 密钥」、不登录照样玩、第一次用 AI 弹「登录送 AI」、邮箱验证码登录、通过 Apple 登录、额度显示、
//   一段走服务器的聊天（举报一句、提醒、到点收尾）、额度用完 + 会员按钮、买月度（服务器存好才 iapFinish）、恢复、续费和退款事件、
//   下次打开补交没 finish 的、孩子模式买东西要家长密码、13 岁以下没同意 → 请家长 → 同意 → 能聊、举报、删号、退出、安卓没有买的按钮、
//   不是云端模式时一切照旧；中英文、竖屏横屏截图 tests/screenshots/account-*.png（要看图）。
// 运行：node tests/account.test.js（先 cd cloud && npm ci；大约 2–3 分钟）
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const FN = require('./fake-native');
const ROOT = path.join(__dirname, '..');
const CLOUD = path.join(ROOT, 'cloud');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (!ok && extra !== undefined ? '   → ' + JSON.stringify(extra).slice(0, 600) : '')); if (!ok) fails++; return !!ok; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean).map(Number);
const want = n => !ONLY.length || ONLY.includes(n);
const MONTHLY = 'com.echoisland.app.premium.monthly', YEARLY = 'com.echoisland.app.premium.yearly';

if (!fs.existsSync(path.join(CLOUD, 'node_modules', 'wrangler')) || !fs.existsSync(path.join(CLOUD, 'node_modules', 'miniflare'))) {
  console.log('✗ cloud/ 的依赖没装：cd cloud && npm ci（装在 cloud/node_modules，不进仓库）');
  process.exit(1);
}

// ---------- 游戏网页（本机小网站：麦克风的 AudioWorklet 要 http 才能加载） ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.normalize(path.join(ROOT, u === '/' ? 'index.html' : u));
    if (!f.startsWith(ROOT) || /[\\/](android|server|node_modules|art|cloud|ios)[\\/]/.test(f.slice(ROOT.length))) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, data) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const t0 = Date.now();
  const imp = f => import(pathToFileURL(path.join(CLOUD, 'test', f)).href);
  const { startWorker } = await imp('lib.js');
  const { startFakes } = await imp('fakes.js');
  const { makeChain, signJws, appleIdKeys, idToken, sha256hex, selfCheck } = await imp('pki.js');

  // ---------- 1. 打包服务器（和部署的是同一份）：输出到 cloud/node_modules/.cache 下面自己的目录——不和 cloud.test.js 抢 cloud/dist；
  //      也不放系统临时目录（Windows 上 workerd 读不了 Temp 下的脚本，启动报 internal error）；node_modules 不进仓库、check-banned 不查 ----------
  const cacheDir = path.join(CLOUD, 'node_modules', '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const dist = fs.mkdtempSync(path.join(cacheDir, 'echo-account-'));
  execFileSync(process.execPath, [path.join(CLOUD, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'deploy', '--dry-run', '--outdir', dist],
    { cwd: CLOUD, stdio: 'pipe', env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1' }) });
  const script = path.join(dist, 'index.js');
  check(fs.existsSync(script), '服务器打包好了（wrangler，和 cloud.test.js 同一份源码）');

  const web = await serve();
  const HOST = 'http://127.0.0.1:' + web.address().port;
  const P = { good: makeChain('Good') };
  if (!selfCheck(P.good)) { console.log('✗ 测试证书链不对'); process.exit(1); }
  const K = appleIdKeys();
  const F = await startFakes({ jwks: K.jwks, asrModel: 'qwen3-asr-flash', asrRtModel: 'qwen3-asr-flash-realtime' });
  const base = {
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'test-pepper', ALLOWED_ORIGINS: HOST,
    DASHSCOPE_API_KEY: 'sk-fake-cloud-key', DS_HTTP_BASE: F.url, DS_WS_BASE: F.url.replace(/^http/, 'ws'),
    EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fake_key', RESEND_API_URL: F.url + '/resend/emails', EMAIL_FROM: 'Echo Island <noreply@example.test>',
    PUBLIC_URL: 'http://cloud.example.test',
    APPLE_BUNDLE_ID: 'com.echoisland.app', APPLE_PRODUCTS: JSON.stringify({ [MONTHLY]: 'monthly', [YEARLY]: 'yearly' }),
    APPLE_ENVIRONMENTS: 'Production,Sandbox', APPLE_ROOT_SHA256: P.good.fp, APPLE_JWKS_URL: F.url + '/apple/auth/keys', APPLE_AUTH_BASE: F.url + '/apple',
    TALK_BEAT_SEC: '1', TALK_STALE_SEC: '3', WS_AUTH_WAIT_SEC: '3',
    RATE: JSON.stringify({ emailPerAddrHour: 100, emailPerIpHour: 100000, signinPerIpHour: 100000, reportPerUserDay: 50, consentPerUserDay: 50 }),
  };
  const rl = { RL_AI_USER: 100000, RL_AI_IP: 100000, RL_WS_USER: 100000 };
  const A = await startWorker(script, Object.assign({}, base, { TALK_WARN_SEC: '60', TALK_MIN_START_SEC: '5' }), rl);
  const B = await startWorker(script, Object.assign({}, base, { PLANS: JSON.stringify({ free: { talkMin: 0.4 } }), TALK_WARN_SEC: '8', TALK_MIN_START_SEC: '3' }), rl);
  check(true, '两个本机 Worker 起来了（A 正常额度、B 免费每天 24 秒）');

  // 服务器这边（Node）注册一个账号：发码 → 从假邮箱读码 → 验证 → 设年龄段。返回 { token, me, email }
  let uid = 0;
  const uniq = tag => (tag || 'u') + (++uid) + '-' + Date.now().toString(36) + '@example.test';
  async function signup(X, age, tag) {
    const email = uniq(tag), n0 = F.mails.length;
    await X.api('POST', '/v1/auth/email/start', { body: { email } });
    const mail = F.mails.slice(n0).reverse().find(m => m.to && m.to[0] === email);
    const code = /\b(\d{6})\b/.exec(mail.text)[1];
    const v = await X.api('POST', '/v1/auth/email/verify', { body: { email, code, tzOffsetMin: -new Date().getTimezoneOffset() } });
    if (age) await X.api('PATCH', '/v1/me', { token: v.json.token, body: { ageGroup: age } });
    return { token: v.json.token, me: (await X.api('GET', '/v1/me', { token: v.json.token })).json, email };
  }
  const codeFor = email => { const m = F.mails.slice().reverse().find(x => x.to && x.to[0] === email); const r = m && /\b(\d{6})\b/.exec(m.text); return r ? r[1] : ''; };

  // ---------- 浏览器 ----------
  const b = await chromium.launch(Object.assign({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const VIEW = { port: { width: 390, height: 844 }, land: { width: 844, height: 390 } };
  const SAVE = o => JSON.stringify({ seenIntro: true, micCheck: 'skip', homeTab: o.tab || 'talk', coins: 321, book: { at: 2 },
    mon: { v: 2, box: [{ uid: 'u0', sp: 'tidalfin', lv: 8, xp: 0 }], team: ['u0'], dex: {}, balls: 5, potions: 5, bag: {}, badges: {} },
    settings: Object.assign({ tts: 'online', mode: 'auto', sfx: false, music: 'off', gate: false, learner: 'open', ui: o.ui || 'zh', gfx: '2d' }, o.settings || {}) });
  // 一个页面：o = { X（哪个 Worker）, native（假原生桥的设置，null = 网页版）, token, ui, view, save（false = 全新）, edition, cloud（false = 不是云端模式） }
  async function open(o) {
    o = Object.assign({ X: A, native: { platform: 'ios' }, ui: 'zh', view: 'port', save: true, cloud: true }, o);
    const ctx = await b.newContext({ viewport: VIEW[o.view] });
    const outside = [];
    // 外面的网址一律挡掉、记下来；家庭版打开时查新版本（version.json）是老功能、/v1/tts 回的是阿里云的音频地址（假的），回 404 就好
    await ctx.route(u => !u.href.startsWith(HOST) && !u.href.startsWith(A.url) && !u.href.startsWith(B.url), r => { if (/\/version\.json|dashscope-result\.example/.test(r.request().url())) return r.fulfill({ status: 404, body: '' }); outside.push(r.request().url()); r.abort(); });
    await ctx.exposeFunction('__mintJws', pay => signJws(pay, P.good));
    await ctx.exposeFunction('__appleToken', nonce => idToken(K, { iss: 'https://appleid.apple.com', aud: 'com.echoisland.app', sub: 'apple-sub-' + nonce.slice(0, 10), exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000), nonce: sha256hex(nonce), email: 'apple-' + nonce.slice(0, 6) + '@privaterelay.example', email_verified: 'true' }));
    if (o.native) await ctx.addInitScript(FN.install, Object.assign({ key: '', pin: '1234', net: 'ok', mic: 'granted' }, o.native));
    // 假原生的订阅状态跨刷新保留（真手机上没 finish 的交易在 StoreKit 里，App 重开还在）
    await ctx.addInitScript(() => {
      const F = window.__fakeNative; if (!F || !F.iap) return;
      try { const k = JSON.parse(localStorage.getItem('__iapKeep') || 'null'); if (k) Object.assign(F.iap, k); } catch (e) { /* 忽略 */ }
      try { const st = localStorage.getItem('__appleState'); if (st) F.apple.state = st; } catch (e) { /* 忽略 */ }
      setInterval(() => { try { localStorage.setItem('__iapKeep', JSON.stringify({ unfinished: F.iap.unfinished, entitlements: F.iap.entitlements, finished: F.iap.finished, buy: F.iap.buy })); } catch (e) { /* 忽略 */ } }, 200);
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(8000);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|404/.test(m.text())) errs.push('console: ' + m.text()); });
    const url = HOST + '/index.html?art=proc' + (o.cloud ? '&cloud=' + encodeURIComponent(o.X.url) : '&cloud=off') + (o.edition === 'sales' ? '&edition=sales' : '');
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.evaluate(([s, tok]) => { localStorage.clear(); if (s) localStorage.setItem('echo-island-v1', s); if (tok) localStorage.setItem('echo-cloud-token', tok); }, [o.save === false ? '' : typeof o.save === 'string' ? o.save : SAVE(o), o.token || '']);
    await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForFunction(() => window.EchoGame && window.EchoAccount && (document.querySelector('#setup') || !document.querySelector('#home').hidden), null, { timeout: 30000 });
    await p.evaluate(() => { EchoAccount.cfg.poll = 300; EchoTalk.cfg.evalWait = 8000; });
    await p.waitForTimeout(600);
    const T = {
      ctx, p, errs, outside,
      E: (f, a) => p.evaluate(f, a), W: ms => p.waitForTimeout(ms),
      until: async (fn, ms) => { const t1 = Date.now(); for (;;) { let v; try { v = await fn(); } catch (e) { v = null; } if (v) return v; if (Date.now() - t1 > (ms || 6000)) return v; await p.waitForTimeout(120); } },
      sheet: () => p.evaluate(() => { const s = document.querySelector('#modal:not([hidden]) #sheet'); return s ? s.innerText : ''; }),
      sheetId: () => p.evaluate(() => { const s = document.querySelector('#modal:not([hidden]) #sheet .ac'); return s ? s.id : ''; }),
      fake: () => p.evaluate(() => JSON.parse(JSON.stringify({ calls: window.__fakeNative.calls, iap: window.__fakeNative.iap ? { unfinished: window.__fakeNative.iap.unfinished.map(x => x.transactionId), finished: window.__fakeNative.iap.finished, log: window.__fakeNative.iap.log.map(x => x.m) } : null }))),
      tok: () => p.evaluate(() => localStorage.getItem('echo-cloud-token') || ''),
      shot: async name => { await p.waitForTimeout(400); await p.screenshot({ path: path.join(out, 'account-' + name + '.png') }); },   // 等弹窗的动画放完
      // 弹窗里没有横向滚动、按钮没挤出去
      fits: () => p.evaluate(() => { const s = document.querySelector('#modal:not([hidden]) #sheet'); if (!s) return true; const r = s.getBoundingClientRect(); return s.scrollWidth <= s.clientWidth + 1 && r.right <= innerWidth + 1 && [...s.querySelectorAll('button')].every(x => { const q = x.getBoundingClientRect(); return !q.width || (q.right <= r.right + 1 && q.left >= r.left - 1); }); }),
      close: async () => { check(!errs.length, '（这一页）没有报错', errs.slice(0, 4)); check(!outside.length, '（这一页）没连别的网址', outside.slice(0, 4)); await ctx.close(); },
    };
    return T;
  }
  // 在登录页用邮箱登录（页面里点）：填邮箱 → 发码 → 从假邮箱读码 → 填码（填满 6 位自动登录）
  async function emailIn(T, email) {
    await T.p.fill('#ac-email', email);
    await T.p.click('#sheet [data-act=ac_send]');
    await T.until(() => T.p.$('#ac-code'));
    const code = await T.until(() => codeFor(email));
    await T.p.fill('#ac-code', code);
    return T.until(async () => (await T.tok()) || '');
  }
  const openChat = async (T, id) => { await T.E(i => EchoTalk.open(i), id || 't0-anna'); };
  const NPC = require(path.join(ROOT, 'talk-npcs.js')).list[0].id;
  const speak = async T => {
    const n0 = await T.E(() => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length);
    await T.p.locator('#tk-mic').dispatchEvent('pointerdown'); await T.W(700); await T.p.locator('#tk-mic').dispatchEvent('pointerup');
    await T.until(() => T.E(n => document.querySelectorAll('#tk-log .tk-b.you:not(.wait)').length > n, n0), 6000);
  };

  // =====================================================================================================
  console.log('\n— 2. 不是云端模式：一切照旧（家庭版的密钥 / 网页版的中转服务）');
  if (want(2)) {
    const T = await open({ cloud: false, native: { platform: 'ios', key: 'sk-fake' } });
    check(await T.E(() => !EchoCloud.on && EchoCloud.url === ''), '没有服务器地址：EchoCloud.on = false');
    check(await T.E(() => !document.querySelector('.ac-strip') && !!document.querySelector('[data-act=talk_cfg]') && EchoTalk.relayUrl() === 'direct:'), '聊天页没有账号那一栏、有「设置服务」；有密钥照旧直连（direct:）');
    await T.E(() => EchoGame.T.settings());
    check(await T.E(() => !document.querySelector('#set-account') && !!document.querySelector('#sheet [data-act=talk_cfg]')), '设置里没有「账号和会员」，家长设置里照旧有 AI 密钥那一行');
    await T.close();
    const Tw = await open({ cloud: false, native: null });
    check(await Tw.E(() => !EchoCloud.on && /^ws:\/\/127\.0\.0\.1:8787$/.test(EchoTalk.relayUrl())), '网页版（本机打开）照旧连家里的中转服务 ws://…:8787');
    await Tw.close();
  }

  // =====================================================================================================
  console.log('\n— 3. 首次设置向导（销售版、iPhone、云端模式）：没有「粘贴 AI 密钥」那一页');
  if (want(3)) {
    const T = await open({ edition: 'sales', save: false, native: { platform: 'ios', edition: 'sales', pin: null } });
    check(await T.until(() => T.E(() => !!document.querySelector('#setup'))), '全新打开：家长首次设置向导');
    check(await T.E(() => EchoCloud.on && EchoCloud.url.startsWith('http://127.0.0.1')), '?cloud= 打开了云端模式');
    const welcome = await T.p.textContent('#su-box');
    check(!/您自己的阿里云账号/.test(welcome) && /经过回声岛的服务器/.test(welcome) && /使用条款/.test(welcome), '欢迎页的隐私要点换成「经过回声岛的服务器」，有《使用条款》链接', welcome.slice(0, 300));
    await T.p.click('#su-consent'); await T.W(150);
    await T.p.click('#su-next'); await T.W(400);   // → 设备检查
    await T.until(() => T.E(() => !document.querySelector('#su-next[disabled]') && !/检查中/.test(document.querySelector('#su-box').innerText)), 8000);
    await T.p.click('#su-next'); await T.W(300);   // → 家长密码
    for (const d of '1357') await T.p.click('#su-box [data-act=suPin][data-k="' + d + '"]');
    await T.W(300);
    for (const d of '1357') await T.p.click('#su-box [data-act=suPin][data-k="' + d + '"]');
    await T.W(400);
    await T.p.click('#su-next'); await T.W(400);   // → 原来的「AI 密钥」
    const step = await T.E(() => document.querySelector('#su-box .su-step').dataset.step);
    const box = await T.p.textContent('#su-box');
    check(step === 'key' && !(await T.p.$('#su-key')) && !(await T.p.$('[data-doc=guide]')) && !/粘贴|百炼|API Key/.test(box) && /不用自己准备任何密钥/.test(box), '这一步没有粘贴密钥的输入框、没有百炼开通指南（只说「不用自己准备任何密钥」）', box.slice(0, 300));
    check(/AI 和账号/.test(box) && /每天免费用 5 分钟/.test(box) && /以后再登录都可以/.test(box) && !!(await T.p.$('#su-box [data-act=ac_signin]')), '换成「AI 和账号」：AI 是什么、登录送 5 分钟、现在或以后登录');
    check(await T.E(() => [...document.querySelectorAll('.su-tabs li span')].map(x => x.textContent)[3] === 'AI 账号'), '步骤条上那一格叫「AI 账号」');
    await T.shot('wizard-zh-port');
    // 现在登录：登录页弹在向导上面
    await T.p.click('#su-box [data-act=ac_signin]'); await T.W(300);
    check(await T.E(() => { const m = document.querySelector('#modal'); return !m.hidden && +getComputedStyle(m).zIndex > +getComputedStyle(document.querySelector('#setup')).zIndex; }), '登录页弹在向导上面（看得见、点得到）');
    const email = uniq('wiz');
    check(!!(await emailIn(T, email)), '在向导里用邮箱登录成功');
    await T.until(() => T.sheetId().then(id => id === 'ac-age'));
    await T.p.click('#sheet [data-act=ac_age][data-v=adult]');
    await T.until(() => T.E(() => document.querySelector('#modal').hidden && /已登录/.test(document.querySelector('#su-box').innerText)));
    check(await T.E(() => document.querySelector('#modal').hidden && /已登录：/.test(document.querySelector('#su-box').innerText)), '登录好、选了年龄段：回到向导这一页，显示「已登录」',
      await T.E(() => ({ modal: document.querySelector('#modal').hidden, sheet: document.querySelector('#sheet').innerText.slice(0, 200), box: document.querySelector('#su-box').innerText.slice(-200) })));
    await T.p.click('#su-next'); await T.W(300);
    check(await T.E(() => document.querySelector('#su-box .su-step').dataset.step === 'nick'), '往下照旧是家庭定制（向导别的步骤没变）');
    await T.close();
    // 「我自己学」那条路：AI 那一步一样
    const T2 = await open({ edition: 'sales', save: JSON.stringify({ settings: { ui: 'en', family: { v: 1, step: 'key', done: '', consent: { at: Date.now(), v: '2026-10-08' }, who: 'open', avatar: {}, starters: [], members: [] } } }), native: { platform: 'ios', edition: 'sales', pin: null } });
    const b2 = await T2.p.textContent('#su-box').catch(() => '');
    check(/AI and your account/.test(b2) && /5 minutes of AI chat free/.test(b2) && !/paste|Bailian|API key/i.test(b2), '「我自己学」、英语界面：同样是 AI 和账号那一页（没有粘贴密钥）', b2.slice(0, 300));
    check(await T2.E(() => [...document.querySelectorAll('.su-tabs li span')].map(x => x.textContent)[2] === 'AI account'), '「我自己学」的步骤条第 3 格叫 AI account');
    await T2.shot('wizard-en-port');
    await T2.p.setViewportSize(VIEW.land); await T2.W(300);
    await T2.shot('wizard-en-land');
    await T2.close();
  }

  // =====================================================================================================
  console.log('\n— 4. 不登录也能玩；第一次用 AI → 「登录送 AI」；学习锁不因为没人登录把孩子关在外面');
  if (want(4)) {
    const T = await open({ settings: { learner: 'kid', gate: true }, tab: 'talk' });
    check(await T.E(() => EchoCloud.on && !EchoAccount.signed()), '云端模式、没登录');
    check(await T.E(() => /登录，每天免费用 5 分钟 AI 聊天/.test(document.querySelector('.ac-strip').innerText) && !document.querySelector('[data-act=talk_cfg]')), '聊天页最上面：「登录，每天免费用 5 分钟 AI 聊天」，没有「设置服务」');
    check(await T.E(() => !EchoGame.A.bar()), '没用到 AI 之前首页不挂「还没登录」的红条');
    const g = await T.E(() => { const g = EchoGame.gate(); return { open: g.open, ex: g.exWhy, chatOk: g.chatOk }; });
    check(g.open && g.ex === 'nosign' && g.chatOk, '学习锁：没登录 → 聊天这一项今天免（nosign），复习做完就能去冒险', g);
    await T.E(() => { EchoGame.S.homeTab = 'mon'; EchoGame.goHome(); });
    await T.W(300);
    check(await T.E(() => /还没登录 AI 账号/.test(document.querySelector('.gate-card').innerText) && !!document.querySelector('.gate-card [data-act=ac_signin]')), '学习锁卡片写明「还没登录 AI 账号，今天先跳过」，旁边有「登录」');
    // 口语题：没登录 → 第一次弹「登录送 AI」，结果走「AI 用不了」（nokey → 先跳过）
    const r1 = await T.E(() => EchoGame.speech.recognize(null, ['Hello']));
    check(r1.fail === 'nokey' && r1.why === 'signin', '口语题没登录：不开麦克风，fail = nokey（走先跳过、放进复习）', r1);
    check((await T.sheetId()) === 'ac-signin' && /每天免费用 5 分钟 AI/.test(await T.sheet()), '第一次碰到 AI：弹「登录，每天免费用 5 分钟 AI」（不是报错）');
    check(/请让爸爸妈妈来登录/.test(await T.sheet()), '孩子模式：登录页提醒请家长来登录');
    check(!!(await T.p.$('#sheet [data-act=ac_apple]')), 'iPhone（这个包带登录权限）：有「通过 Apple 登录」');
    await T.p.click('#sheet [data-act=close]'); await T.W(200);
    await T.E(() => EchoGame.speech.recognize(null, ['Hello']));
    check(!(await T.sheetId()), '同一次打开只弹一次');
    check(await T.E(() => EchoGame.A.down() && /登录以后，AI 才能给你的口语打分/.test(EchoGame.A.hint({ fail: 'nokey', why: 'signin' }))), 'AI 用不了 → 先跳过；提示是「登录以后，AI 才能给你的口语打分」');
    check(await T.E(() => !!EchoGame.A.bar() && EchoGame.A.bar().cls === 'nokey'), '用过一次以后首页挂「还没登录」的提示条');
    // 点岛民：登录页，不是出错
    await T.E(() => { EchoGame.S.homeTab = 'talk'; EchoGame.goHome(); });
    await T.W(300);
    await T.p.click('.tk-card >> nth=0'); await T.W(400);
    check((await T.sheetId()) === 'ac-signin' && !(await T.p.$('#tk-ov')), '没登录点岛民：弹登录页，不开聊天、不报错');
    await T.shot('signin-zh-port');
    check(await T.fits(), '登录页竖屏不挤出屏幕');
    // 邮箱登录 → 年龄段 → 自动接着开聊天
    const email = uniq('kid-parent');
    check(!!(await emailIn(T, email)), '邮箱验证码登录：拿到令牌，存在 localStorage（不在存档里）');
    check(await T.E(() => !JSON.stringify(EchoGame.S).includes('eis_')), '令牌不进存档（存档会导出、分享）');
    await T.until(() => T.sheetId().then(id => id === 'ac-age'));
    check((await T.sheetId()) === 'ac-age' && /13 岁以下/.test(await T.sheet()) && !(await T.p.$('#sheet [data-act=ac_age].on')), '登录以后问年龄段（三个按钮，不预选）');
    await T.shot('age-zh-port');
    await T.p.click('#sheet [data-act=ac_age][data-v=adult]');
    check(!!(await T.until(() => T.p.$('#tk-ov'))), '选好以后自动接着开刚才那段聊天');
    await T.until(() => T.E(() => !document.querySelector('#tk-mic').disabled), 8000);
    check(await T.E(() => /AI 今天还剩 5 分钟/.test(document.querySelector('#tk-min').textContent)), '聊天顶上：「AI 今天还剩 5 分钟」（服务器 ready 里的 leftSec）');
    await T.E(() => EchoTalk.endIfOpen()); await T.W(300);
    await T.E(() => document.querySelector('[data-act=talk_close]') && document.querySelector('[data-act=talk_close]').click());
    await T.W(400);
    const g2 = await T.E(() => EchoGame.gate().exWhy);
    check(g2 === 'nosign', '今天已经免过的这一项当天不再锁回去（gateEx 记下了）', g2);
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 5. 通过 Apple 登录（iPhone）；安卓、网页没有这个按钮');
  if (want(5)) {
    const T = await open({});
    await T.E(() => EchoAccount.signInSheet());
    await T.p.click('#sheet [data-act=ac_apple]');
    const tok = await T.until(() => T.tok());
    check(/^eis_/.test(tok || ''), '通过 Apple 登录：原生给身份令牌 + nonce 原文 → 服务器 → 令牌');
    const me = (await A.api('GET', '/v1/me', { token: tok })).json;
    check(me && me.apple === true && /privaterelay/.test(me.email || ''), '服务器上是 Apple 账号（nonce 的 SHA-256 对得上）', me && { apple: me.apple, email: me.email });
    check(await T.E(() => !!localStorage.getItem('echo-cloud-apple')), '记下 Apple 的用户编号（下次打开查授权还在不在）');
    await T.until(() => T.sheetId().then(id => id === 'ac-age'));
    await T.p.click('#sheet [data-act=ac_age][data-v=teen]'); await T.W(300);
    // 用户在 iPhone「设置」里停用了通过 Apple 登录：下次打开时查到（appleCredentialState），退出登录
    await T.E(() => localStorage.setItem('__appleState', 'revoked'));
    await T.p.reload(); await T.p.waitForFunction(() => window.EchoAccount);
    check(!!(await T.until(async () => !(await T.tok()), 5000)) && (await T.fake()).calls.includes('appleCredentialState'), 'Apple 授权被停用：重新打开时查到，退出登录');
    await T.close();
    const Ta = await open({ native: { platform: 'android' } });
    await Ta.E(() => EchoAccount.signInSheet());
    check(!(await Ta.p.$('#sheet [data-act=ac_apple]')), '安卓：登录页没有「通过 Apple 登录」');
    await Ta.close();
    const Tn = await open({ native: { platform: 'ios', apple: { on: false } } });
    await Tn.E(() => EchoAccount.signInSheet());
    check(!(await Tn.p.$('#sheet [data-act=ac_apple]')), 'iPhone 但这个包没有登录权限（diag().appleSignIn = false）：也没有这个按钮');
    await Tn.close();
  }

  // =====================================================================================================
  console.log('\n— 6. 一段走服务器的聊天：举报一句 AI 的话、评语也能举报');
  if (want(6)) {
    const U = await signup(A, 'adult');
    const T = await open({ token: U.token });
    check(await T.E(() => /今天 AI 聊天还剩 5 分钟/.test(document.querySelector('.ac-strip').innerText)), '聊天页那一栏：「今天 AI 聊天还剩 5 分钟」+ 会员');
    const ws0 = F.ws.length;
    await openChat(T, NPC);
    await T.until(() => T.E(() => !document.querySelector('#tk-mic').disabled), 8000);
    const up = F.ws[ws0];
    check(up && !/sk-|token|eis_/.test(up.url) && up.auth === 'Bearer sk-fake-cloud-key', '服务器替手机连阿里云（密钥在服务器）；手机发的网址里没有令牌');
    await speak(T);
    check(await T.until(() => T.E(() => /I like apples/.test(document.querySelector('#tk-log').innerText))), '说一句 → 服务器转写回来（you）');
    await T.until(() => T.E(() => document.querySelectorAll('#tk-log .tk-b.npc .tk-rep').length >= 1));
    check(await T.E(() => document.querySelectorAll('#tk-log .tk-b.npc .tk-rep').length >= 1), '每句岛民（AI）的话后面有一个小「⚑」举报');
    await T.shot('chat-zh-port');
    await T.p.click('#tk-log .tk-b.npc .tk-rep >> nth=0'); await T.W(300);
    check((await T.sheetId()) === 'ac-report' && await T.E(() => +getComputedStyle(document.querySelector('#modal')).zIndex > +getComputedStyle(document.querySelector('#tk-ov')).zIndex), '举报页弹在聊天上面');
    await T.shot('report-zh-port');
    await T.p.click('#sheet [data-act=ac_rep_reason][data-v=wrong]'); await T.W(150);
    await T.p.fill('#ac-note', 'test note');
    await T.p.click('#sheet [data-act=ac_rep_send]'); await T.W(600);
    const reps = await A.all('SELECT * FROM reports WHERE user_id = ?1', U.me.id);
    check(reps.length === 1 && reps[0].reason === 'wrong' && reps[0].note === 'test note' && reps[0].npc === NPC && JSON.parse(reps[0].turns).some(t => t.who === 'npc'), '举报存到服务器：原因、备注、岛民 id、那几句（AI 的话在里面）', reps[0]);
    await T.E(() => EchoTalk.endIfOpen());
    await T.until(() => T.p.$('.tk-eval'), 10000);
    check(!!(await T.p.$('[data-act=talk_report_eval]')), '评语页（AI 写的）也有「举报这段评语」');
    await T.p.click('[data-act=talk_report_eval]'); await T.W(200);
    await T.p.click('#sheet [data-act=ac_rep_reason][data-v=other]'); await T.p.click('#sheet [data-act=ac_rep_send]'); await T.W(500);
    check((await A.all('SELECT * FROM reports WHERE user_id = ?1', U.me.id)).length === 2, '评语也举报成功');
    await T.p.click('[data-act=talk_close]'); await T.W(800);
    const used = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1', U.me.id);
    check(used && used.talk_sec > 0, '服务器按墙钟秒数记了账', used);
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 7. 额度：聊天还剩 60 秒的提醒、到点收尾、用完了 → 会员（Worker B：免费每天 24 秒，提前 8 秒提醒）');
  if (want(7)) {
    const U = await signup(B, 'adult');
    const T = await open({ X: B, token: U.token });
    await openChat(T, NPC);
    await T.until(() => T.E(() => !document.querySelector('#tk-mic').disabled), 8000);
    check(await T.E(() => /AI 还剩 \d+ 秒/.test(document.querySelector('#tk-min').textContent)), '不到 2 分钟时顶上数秒');
    await speak(T);
    const warned = await T.until(() => T.E(() => /还剩 \d+ 秒，准备和 TA 说再见吧/.test(document.querySelector('#tk-status').textContent + ' ' + document.querySelector('.toasts').innerText)), 22000);
    check(!!warned, '服务器提醒（quota warn）：状态行 / 提示「还剩 n 秒，准备说再见」');
    check(await T.E(() => document.querySelector('#tk-min').classList.contains('low')), '顶上的剩余时间变红');
    await speak(T).catch(() => {});
    const ended = await T.until(() => T.p.$('.tk-eval'), 30000);
    check(!!ended, '到点：服务器收尾（limit），照样给评语');
    const ev = await T.E(() => document.querySelector('.tk-eval') ? document.querySelector('.tk-eval').innerText : '');
    check(/今天的免费 AI 时间用完了，明天再来，或者看看会员/.test(ev) && !!(await T.p.$('.tk-eval [data-act=ac_member]')), '评语页：「今天的免费 AI 时间用完了……」+「会员」按钮', ev.slice(0, 300));
    await T.shot('out-zh-port');
    await T.p.click('.tk-eval [data-act=ac_member]'); await T.W(400);
    check((await T.sheetId()) === 'ac-member', '点「会员」：会员页弹在聊天上面');
    await T.p.click('#sheet [data-act=close]'); await T.W(200);
    await T.p.click('[data-act=talk_close]'); await T.W(1500);
    await T.E(() => EchoAccount.refresh()); await T.W(300);
    check(await T.E(() => EchoAccount.need('talk') === 'quota'), '账号说今天聊天的时间用完了（need = quota）');
    const g = await T.E(() => { const g = EchoGame.gate(); return { chatDaily: g.chatDaily }; });
    check(g.chatDaily, '学习锁按「今天的聊天时间用完了」（chatDaily）办', g);
    check(await T.E(() => /今天的免费 AI 时间用完了/.test(EchoTalk.blocked())), '大地图的委托：说「今天的免费 AI 时间用完了」');
    await openChat(T, NPC); await T.W(400);
    check((await T.sheetId()) === 'ac-quota' && /今天的免费 AI 时间用完了/.test(await T.sheet()) && !!(await T.p.$('#sheet [data-act=ac_member]')) && !(await T.p.$('#tk-ov')), '再点岛民：「今天的免费 AI 时间用完了」+「看看会员」，不开聊天');
    await T.shot('quota-zh-port');
    // 本机的缓存说还有（比如别的设备用完了）：服务器回 quota → 状态行写明、下面一个「会员」按钮
    await T.p.click('#sheet [data-act=close]');
    await T.E(() => { const m = JSON.parse(localStorage.getItem('echo-cloud-me')); m.quota.talk.leftSec = 999; m.quota.resetsAt = new Date(Date.now() + 864e5).toISOString(); localStorage.setItem('echo-cloud-me', JSON.stringify(m)); });
    await T.p.route('**/v1/me', r => r.abort());   // 打开时更新不了账号信息：本机的缓存还说有时间
    await T.p.reload(); await T.p.waitForFunction(() => window.EchoAccount && window.EchoGame); await T.W(800);
    await openChat(T, NPC);
    const fixed = await T.until(() => T.p.$('#tk-fix [data-act=talk_fix][data-w=quota]'), 8000);
    check(!!fixed && /今天的聊天时间用完了/.test(await T.p.textContent('#tk-status')), '服务器回 402 quota：状态行「今天的聊天时间用完了」+「会员」按钮');
    await T.p.unroute('**/v1/me');
    await T.p.click('#tk-fix [data-act=talk_fix]'); await T.W(400);
    check((await T.sheetId()) === 'ac-member' && !(await T.p.$('#tk-ov')), '点它：关掉聊天、打开会员页');
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 8. 买月度会员：服务器存好了才 iapFinish；恢复；续费、退款事件；下次打开补交没 finish 的');
  if (want(8)) {
    const U = await signup(A, 'adult');
    const T = await open({ token: U.token });
    await T.E(() => EchoAccount.memberSheet());
    await T.until(() => T.p.$('#sheet .ac-prod'));
    const txt = await T.sheet();
    check(/\$8\.99 每月/.test(txt) && /\$59\.99 每年/.test(txt), '两个商品：价格和周期来自 iapProducts（不写死）', txt.slice(0, 400));
    check(/可以免费试用 1 周/.test(txt), '有免费试用的那个写明「可以免费试用 1 周」');
    check(/自动续期/.test(txt) && /设置 → 你的名字 → 订阅/.test(txt) && !!(await T.p.$('#sheet [data-doc=terms]')) && !!(await T.p.$('#sheet [data-doc=privacy]')), '写明自动续期、去哪里取消，有《使用条款》《隐私说明》链接');
    check(/免费版/.test(txt) && /今天 AI 聊天还剩 5 分钟/.test(txt) && /重置/.test(txt), '现在的方案、今天还剩几分钟、几点重置');
    check(!!(await T.p.$('#sheet [data-act=ac_restore]')) && !(await T.p.$('#sheet [data-act=ac_manage]')), '有「恢复购买」；还没买时没有「管理订阅」');
    await T.shot('member-zh-port');
    check(await T.fits(), '会员页竖屏不挤出屏幕');
    // 买：先把交给服务器的那一下拦住，看那时候有没有 finish
    let held = null, seenWhileHeld = null;
    await T.p.route('**/v1/iap/apple', async route => { held = route; });
    await T.p.click('#sheet .ac-prod[data-kind=monthly] [data-act=ac_buy]');
    await T.until(() => held, 8000);
    await T.W(400);
    seenWhileHeld = await T.fake();
    const meNow = (await A.api('GET', '/v1/me', { token: U.token })).json;
    check(held && seenWhileHeld.iap.log.includes('iapBuy') && !seenWhileHeld.iap.log.includes('iapFinish') && seenWhileHeld.iap.unfinished.length === 1,
      '买到了、正在交给服务器：这时候还没 iapFinish', seenWhileHeld.iap);
    check(held && JSON.parse(held.request().postData()).signedTransaction.split('.').length === 3, '交给服务器的是交易的 JWS（signedTransaction）');
    check(meNow.plan === 'free', '服务器还没收到时账号还是免费版');
    await held.continue();
    await T.p.unroute('**/v1/iap/apple');
    await T.until(async () => (await T.fake()).iap.finished.length === 1, 6000);
    const after = await T.fake();
    const ent = await A.all('SELECT * FROM entitlements WHERE user_id = ?1', U.me.id);
    check(after.iap.finished.length === 1 && !after.iap.unfinished.length && ent.length === 1, '服务器存好了（200）→ 才 iapFinish', { f: after.iap.finished, ent: ent.length });
    const log = after.iap.log;
    check(log.indexOf('iapBuy') < log.indexOf('iapFinish'), '顺序：iapBuy → 服务器 → iapFinish', log);
    const bought = (await A.api('GET', '/v1/me', { token: U.token })).json;
    check(bought.plan === 'monthly' && bought.quota.talk.limitSec === 1800, '服务器上是月度会员（每天 30 分钟）', { plan: bought.plan });
    await T.until(() => T.E(() => /月度会员/.test(document.querySelector('#sheet') ? document.querySelector('#sheet').innerText : '')), 4000);
    check(/月度会员/.test(await T.sheet()) && /正在用/.test(await T.sheet()) && !!(await T.p.$('#sheet [data-act=ac_manage]')), '会员页：月度会员「正在用」，有「管理订阅」');
    // 买的交易里带着服务器给的 iapToken（appAccountToken）
    const row = ent[0] || {};
    check(JSON.stringify(row).includes(U.me.iapToken) || (await T.E(() => window.__fakeNative.iap.lastToken)) === U.me.iapToken, '买的时候用的是服务器给这个账号的 iapToken（appAccountToken）');
    // 恢复购买
    let posts = 0; T.p.on('request', r => { if (/\/v1\/iap\/apple$/.test(r.url())) posts++; });
    await T.p.click('#sheet [data-act=ac_restore]');
    await T.until(() => T.E(() => /恢复好了/.test(document.querySelector('.toasts').innerText)), 6000);
    check(posts >= 1 && /恢复好了/.test(await T.E(() => document.querySelector('.toasts').innerText)), '恢复购买：有效的订阅交给服务器，提示「恢复好了」');
    // 续费事件（Transaction.updates）
    const first = (await T.E(() => window.__fakeNative.iap.entitlements[0]));
    const fin0 = (await T.fake()).iap.finished.length;
    await T.E(async o => { const tx = await window.__fakeNative.newTx(o.p, { kind: 'renewal', original: o.orig, expires: Date.now() + 60 * 864e5, token: o.tok }); window.__fakeNative.fireIap(tx); }, { p: MONTHLY, orig: first.originalId, tok: U.me.iapToken });
    await T.until(async () => (await T.fake()).iap.finished.length > fin0, 6000);
    const ren = (await A.api('GET', '/v1/me', { token: U.token })).json;
    check(Date.parse(ren.subscription.expiresAt) > Date.now() + 50 * 864e5 && (await T.fake()).iap.finished.length > fin0, '续费事件：交给服务器（到期往后推）、存好再 finish', ren.subscription);
    // 退款事件
    await T.E(async o => { const tx = await window.__fakeNative.newTx(o.p, { kind: 'revoked', original: o.orig, revoked: true, token: o.tok }); window.__fakeNative.fireIap(tx); }, { p: MONTHLY, orig: first.originalId, tok: U.me.iapToken });
    await T.until(async () => (await A.api('GET', '/v1/me', { token: U.token })).json.plan === 'free', 6000);
    const rev = (await A.api('GET', '/v1/me', { token: U.token })).json;
    check(rev.plan === 'free' && rev.subscription.state === 'revoked', '退款事件：服务器说 revoked，回到免费版', rev.subscription);
    await T.until(() => T.E(() => /已经退款/.test(document.querySelector('.toasts').innerText)), 4000);
    check(/已经退款/.test(await T.E(() => document.querySelector('.toasts').innerText)), '提示「订阅已经退款，现在是免费版」');
    // 下次打开补交：一笔没 finish 的年度（上次买完 App 被杀），服务器先挡一次（不 finish），再打开才交上、finish
    await T.E(async o => { const F = window.__fakeNative; const tx = await F.newTx(o.p, { token: o.tok }); F.iap.unfinished.push(tx); F.iap.entitlements = [tx]; }, { p: YEARLY, tok: U.me.iapToken });
    await T.W(400);
    await T.p.route('**/v1/iap/apple', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server"}' }));
    await T.p.reload(); await T.p.waitForFunction(() => window.EchoAccount); await T.W(2000);
    const f1 = await T.fake();
    check(f1.iap.log.includes('iapPending') && f1.iap.unfinished.length === 1, '打开 App：iapPending；服务器没存好（500）→ 不 finish，留着下次', f1.iap);
    await T.p.unroute('**/v1/iap/apple');
    await T.p.reload(); await T.p.waitForFunction(() => window.EchoAccount);
    await T.until(async () => !(await T.fake()).iap.unfinished.length, 6000);
    const f2 = await T.fake();
    const yr = (await A.api('GET', '/v1/me', { token: U.token })).json;
    check(!f2.iap.unfinished.length && yr.plan === 'yearly', '再打开：iapPending 交给服务器、存好才 finish，现在是年度会员', { unf: f2.iap.unfinished, plan: yr.plan });
    check(f2.iap.log.indexOf('iapPending') < f2.iap.log.indexOf('iapCurrent'), '先 iapPending 再 iapCurrent（核对现在有效的）', f2.iap.log);
    // 用户点了取消：什么都不交
    await T.E(() => { window.__fakeNative.iap.buy = 'cancelled'; EchoAccount.memberSheet(); });
    await T.until(() => T.p.$('#sheet .ac-prod[data-kind=monthly] [data-act=ac_buy]'));
    const n0 = posts;
    await T.p.click('#sheet .ac-prod[data-kind=monthly] [data-act=ac_buy]'); await T.W(800);
    check(posts === n0, '在苹果的确认框里点了取消：不交服务器、不 finish');
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 9. 孩子模式：会员页对家长说话，买要家长密码');
  if (want(9)) {
    const U = await signup(A, 'adult');
    const T = await open({ token: U.token, settings: { learner: 'kid' } });
    await T.E(() => EchoAccount.memberSheet());
    await T.until(() => T.p.$('#sheet .ac-prod'));
    check(/会员（请家长来看）/.test(await T.sheet()) && /家长您好/.test(await T.sheet()), '孩子模式：标题「请家长来看」、对家长说「购买要输入家长密码」');
    await T.p.click('#sheet .ac-prod[data-kind=monthly] [data-act=ac_buy]'); await T.W(400);
    check(!!(await T.p.$('#pin-pad')) && !(await T.fake()).iap.log.includes('iapBuy'), '点「订阅」：先要家长密码，还没 iapBuy');
    for (const d of '1234') await T.p.click('#sheet [data-act=pinKey][data-k="' + d + '"]');
    await T.until(async () => (await T.fake()).iap.finished.length === 1, 8000);
    check((await T.fake()).iap.log.includes('iapBuy') && (await A.api('GET', '/v1/me', { token: U.token })).json.plan === 'monthly', '输对家长密码：才买、交服务器、开通');
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 10. 13 岁以下没有家长同意：请家长 → 邮件 → 同意 → 能聊');
  if (want(10)) {
    const U = await signup(A, 'child');
    const T = await open({ token: U.token, settings: { learner: 'kid', gate: true } });
    check(await T.E(() => /和岛民语音聊天要先请家长同意/.test(document.querySelector('.ac-strip').innerText)), '聊天页那一栏：「和岛民语音聊天要先请家长同意」');
    check(await T.E(() => EchoGame.gate().exWhy === 'consent'), '学习锁：还等家长同意 → 聊天这一项今天免（consent）');
    await openChat(T, NPC); await T.W(400);
    check((await T.sheetId()) === 'ac-consent' && !(await T.p.$('#tk-ov')), '点岛民：「先请家长同意」，不开聊天');
    await T.shot('consent-zh-port');
    const parent = uniq('parent');
    await T.p.fill('#ac-parent', parent);
    await T.p.click('#sheet [data-act=ac_consent_send]');
    await T.until(() => T.E(() => /已经发到/.test(document.querySelector('#sheet').innerText)));
    check(/已经发到 .\*\*\*@example\.test/.test(await T.sheet()) && /自动更新/.test(await T.sheet()), '发出去了：显示家长邮箱（只露一部分），说「同意以后这里会自动更新」');
    await T.p.click('#sheet [data-act=ac_consent_check]'); await T.W(400);
    check(/还没收到同意/.test(await T.sheet()), '家长还没点：「还没收到同意」');
    const mail = F.mails.slice().reverse().find(m => m.to && m.to[0] === parent);
    const link = mail && /(https?:\/\/\S+\/v1\/consent\/c\/[A-Za-z0-9_-]{43})/.exec(mail.text)[1];
    check(!!link, '家长收到同意邮件');
    await A.api('POST', new URL(link).pathname, { raw: '', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const opened = await T.until(() => T.p.$('#tk-ov'), 8000);
    check(!!opened, '家长在邮件里按了同意：这里自己查到、接着开聊天');
    await T.until(() => T.E(() => !document.querySelector('#tk-mic').disabled), 8000);
    check(await T.E(() => !document.querySelector('#tk-mic').disabled), '孩子能和岛民聊了（服务器放行）');
    await T.E(() => EchoTalk.endIfOpen()); await T.W(300);
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 11. 退出登录、令牌失效、删号');
  if (want(11)) {
    const U = await signup(A, 'adult');
    const T = await open({ token: U.token });
    await T.E(() => EchoGame.T.settings());
    check(await T.E(() => /已登录 · 免费版/.test(document.querySelector('#set-account').innerText)), '设置最上面：「账号和会员 · 已登录 · 免费版」');
    check(await T.E(() => !document.querySelector('#sheet [data-act=talk_cfg]')), '云端模式：设置里没有 AI 密钥那一行');
    await T.p.click('#set-account [data-act=ac_account]'); await T.W(400);
    check((await T.sheetId()) === 'ac-account' && (await T.sheet()).includes(U.email), '账号页：邮箱、年龄段、方案');
    await T.shot('account-zh-port');
    await T.p.click('#sheet [data-act=ac_signout]'); await T.W(600);
    check(!(await T.tok()) && (await A.api('GET', '/v1/me', { token: U.token })).status === 401, '退出登录：本机令牌清掉、服务器上这个令牌失效');
    // 令牌在别处失效了：聊天时服务器回 auth → 状态行「要先登录」+ 登录按钮 → 「请重新登录」
    const U2 = await signup(A, 'adult');
    await T.E(t => localStorage.setItem('echo-cloud-token', t), U2.token);
    await A.api('POST', '/v1/auth/signout', { token: U2.token, body: {} });
    await T.p.reload(); await T.p.waitForFunction(() => window.EchoAccount && window.EchoGame); await T.W(800);
    if (await T.tok()) {
      await openChat(T, NPC);
      await T.until(() => T.p.$('#tk-fix [data-w=signin]'), 8000);
    }
    check(!(await T.tok()), '令牌失效（401）：本机自动清掉');
    await T.E(() => { if (document.querySelector('#tk-fix [data-act=talk_fix]')) document.querySelector('#tk-fix [data-act=talk_fix]').click(); else EchoAccount.signInSheet(); });
    await T.W(300);
    check(/请重新登录/.test(await T.sheet()), '再用 AI：「请重新登录」');
    // 删号：确认两次；手机里的进度留着
    const email = uniq('del');
    await emailIn(T, email);
    await T.until(() => T.sheetId().then(id => id === 'ac-age'));
    await T.p.click('#sheet [data-act=ac_age][data-v=adult]'); await T.W(300);
    const tok = await T.tok();
    const meDel = (await A.api('GET', '/v1/me', { token: tok })).json;
    await T.E(() => EchoAccount.accountSheet()); await T.W(300);
    await T.p.click('#sheet [data-act=ac_delete]'); await T.W(300);
    const d1 = await T.sheet();
    check((await T.sheetId()) === 'ac-delete' && /马上全部删掉/.test(d1) && /游戏进度不会删/.test(d1) && /订阅不会自动取消/.test(d1), '删号第一步：说清楚删什么、进度留在设备上、订阅要自己去取消', d1.slice(0, 300));
    await T.shot('delete-zh-port');
    await T.p.click('#sheet [data-act=ac_delete_next]'); await T.W(300);
    check((await T.sheetId()) === 'ac-delete2' && (await A.api('GET', '/v1/me', { token: tok })).status === 200, '第二步再确认一次（这时还没删）');
    await T.p.click('#sheet [data-act=ac_delete_go]'); await T.W(800);
    const gone = await A.one('SELECT id FROM users WHERE id = ?1', meDel.id);
    check(!gone && !(await T.tok()) && /账号已经删除/.test(await T.sheet()), '删掉了：服务器上没有这个账号、本机退出登录', gone);
    check(await T.E(() => JSON.parse(localStorage.getItem('echo-island-v1')).coins === 321), '手机里的存档还在（金币一样）');
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 12. 安卓（还没有结算）：显示方案和额度，说「很快就能买」，没有买的按钮');
  if (want(12)) {
    const U = await signup(A, 'adult');
    const T = await open({ token: U.token, native: { platform: 'android' } });
    await T.E(() => EchoAccount.memberSheet()); await T.W(500);
    const s = await T.sheet();
    check(/免费版/.test(s) && /今天 AI 聊天还剩 5 分钟/.test(s) && /很快就可以了/.test(s), '安卓：方案、今天还剩几分钟、「很快就可以了」');
    check(!(await T.p.$('#sheet [data-act=ac_buy]')) && !(await T.p.$('#sheet [data-act=ac_restore]')), '没有「订阅」「恢复购买」按钮（没有空按钮）');
    await T.shot('member-android-zh-port');
    await T.close();
  }

  // =====================================================================================================
  console.log('\n— 13. 截图：中英文 × 竖屏横屏（登录、会员、聊天里的剩余时间、家长同意、额度用完）');
  for (const ui of want(13) ? ['zh', 'en'] : []) {
    for (const view of ['port', 'land']) {
      const U = await signup(A, 'adult');
      const T = await open({ token: U.token, ui, view });
      const tag = ui + '-' + view;
      await T.E(() => EchoAccount.memberSheet()); await T.until(() => T.p.$('#sheet .ac-prod'));
      if (ui === 'en') check(/\$8\.99 per month/.test(await T.sheet()) && !/[一-鿿]/.test(await T.sheet()), '英语界面的会员页没有中文（' + view + '）', (await T.sheet()).slice(0, 200));
      check(await T.fits(), '会员页不挤出屏幕（' + tag + '）');
      await T.shot('member-' + tag);
      await T.E(() => EchoAccount.signInSheet()); await T.W(200);
      if (ui === 'en') check(/Sign in for 5 free AI minutes every day/.test(await T.sheet()) && !/[一-鿿]/.test(await T.sheet()), '英语界面的登录页没有中文（' + view + '）');
      check(await T.fits(), '登录页不挤出屏幕（' + tag + '）');
      await T.shot('signin-' + tag);
      await T.E(() => EchoAccount.fix('quota')); await T.W(300);
      await T.shot('quota-' + tag);
      await T.E(() => EchoGame.closeModal());
      await openChat(T, NPC);
      await T.until(() => T.E(() => !document.querySelector('#tk-mic').disabled && !document.querySelector('#tk-min').hidden), 8000);
      check(await T.E(() => { const m = document.querySelector('#tk-min'), r = m.getBoundingClientRect(); return !m.hidden && r.width > 0 && r.right <= innerWidth + 1; }), '聊天顶上的剩余时间看得见（' + tag + '）');
      if (ui === 'en') check(/AI left today: 5 min/.test(await T.p.textContent('#tk-min')), '英语界面：AI left today: 5 min');
      await T.shot('chat-' + tag);
      await T.E(() => EchoTalk.endIfOpen()); await T.W(300);
      await T.E(() => { const b = document.querySelector('[data-act=talk_close]'); if (b) b.click(); });
      await T.W(300);
      await T.E(() => { EchoGame.S.homeTab = 'talk'; EchoGame.goHome(); }); await T.W(300);
      await T.shot('home-' + tag);
      await T.close();
    }
  }

  await b.close();
  await Promise.all([A.dispose(), B.dispose()]);
  await F.close();
  web.close();
  try { fs.rmSync(dist, { recursive: true, force: true }); } catch (e) { /* 临时目录 */ }
  console.log('\n—— 云端模式（账号和会员）：' + (fails ? '失败 ' + fails : '全部通过') + '，用了 ' + ((Date.now() - t0) / 1000).toFixed(0) + ' 秒');
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('✗ 测试没跑起来：' + (e && e.stack || e)); process.exit(1); });
