// 假的安卓原生桥 EchoNative：方法名、参数个数、返回值都和 android/app/src/main/java/com/echoisland/app/MainActivity.java
// 的 Native 一一对应（tests/native.test.js 会核对），行为照着原生写（家长密码错 5 次锁 10 分钟、备份留 7 份……）。
// 浏览器测试里模拟 APK：
//   const FN = require('./fake-native');
//   await page.addInitScript(FN.install, { mic: 'blocked', net: 'quota' });   // 在 page.goto 之前
// 页面里 window.__fakeNative 是它的状态和开关，测试可以随时改：
//   key（'' = 没密钥）、pin（null = 打包时没设家长密码）、mic（granted / denied / blocked）、
//   net（AI 连接的结果：'offline' 没网 / 'badkey' 密钥失效 401 / 'quota' 额度用完 / 'ok' 交给 onWsOpen / onPost）、
//   onWsOpen(id, url, cb) / onPost(id, url, body, cb)：自己接管连接（cb(id, 类型, 数据) 回给网页）、
//   micAfterSettings（openAppSettings() 回来以后麦克风变成什么）、picked（backupPick() 选到的 {ok, name, text}）、
//   now()（时钟，测锁定时间时可以换掉）；记录：backups、shared（分享过的）、settingsOpened、calls（调用过的方法名）。
//   销售版：edition（'family' 默认 / 'sales'）、storage（{free, total, ram} 字节，设备检查用）、diagExtra（并进 diag() 的字段，比如 {sdk: 25}）；
//   销售版装好时没有家长密码：install 时传 pin: null，向导里 setPin 设好。setPin 和原生一样：还没有密码直接设，有了要 2 分钟内刚输对过。
//   iPhone 版：platform: 'ios' 时 diag() 照 ios/App/Sources/Bridge.swift 的 diagJson() 回——没有 sdk / android，有 platform 'ios'、
//   ios（系统版本，默认 '26.1'）、model（hw.machine，默认 'iPhone17,3'）、webview 'WebKit'、micLastDeny {}；剩余空间照旧用 storage。
//   这三个也能在页面里改（window.__fakeNative.ios = '17.5'），下一次 diag() 就是新的。
function installFakeEchoNative(opts) {
  opts = opts || {};
  const W = typeof window !== 'undefined' ? window : globalThis;
  const TRIES = 5, LOCK_MS = 10 * 60 * 1000, KEEP = 7;
  const S = W.__fakeNative = {
    key: opts.key === undefined ? 'sk-fake' : opts.key,
    pin: opts.pin === undefined ? '1234' : opts.pin,
    mic: opts.mic || 'granted',
    net: opts.net || 'offline',
    micAfterSettings: opts.micAfterSettings || null,
    picked: opts.picked || null,
    version: opts.version || { code: 321, name: '20261007-fake000' },
    recovered: !!opts.recovered,
    edition: opts.edition === 'sales' ? 'sales' : 'family',
    // 检查新版本的默认地址：家庭版打包时写进去，销售版没有；销售版开放的课本册（空 = 七上、七下）
    books: opts.books || '',
    verUrl: opts.verUrl !== undefined ? opts.verUrl : opts.edition === 'sales' ? '' : 'https://dqq12125-glitch.github.io/private-note-/version.json',
    storage: opts.storage || { free: 8e9, total: 128e9, ram: 12e9 },
    diagExtra: opts.diagExtra || null,
    platform: opts.platform === 'ios' ? 'ios' : 'android',
    ios: opts.ios || '26.1',
    model: opts.model !== undefined ? opts.model : 'iPhone17,3',
    okAt: 0,              // 最近一次输对密码的时间（setPin 改密码要 2 分钟内输对过）
    orient: 'portrait',
    fails: 0, lockUntil: 0, lockouts: 0, lastLock: 0,
    backups: {},          // 名字 → { text, time }
    shared: [], settingsOpened: 0, calls: [],
    onWsOpen: null, onPost: null,
    now: () => Date.now(),
  };
  const cb = (id, type, data) => setTimeout(() => { if (W.__echoNative) W.__echoNative(id, type, data); }, 0);
  const emit = (name, detail) => { try { W.dispatchEvent(new W.CustomEvent(name, { detail })); } catch (e) { /* 没有 DOM 时忽略 */ } };
  const day = () => { const d = new Date(S.now()); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  const NAME = /^echo-save-(\d{8})(?: \((\d{1,4})\))?\.json$/;
  const sorted = () => Object.keys(S.backups).filter(n => NAME.test(n))
    .sort((a, b) => b.match(NAME)[1].localeCompare(a.match(NAME)[1]) || S.backups[b].time - S.backups[a].time);
  const waitMs = () => Math.max(0, Math.min(LOCK_MS, S.lockUntil - S.now()));
  // 销售版才能在手机上设密码：还没有就能设，有了要 2 分钟内刚输对过
  const canSet = () => S.edition === 'sales' && (!S.pin || (S.okAt > 0 && S.now() - S.okAt <= 2 * 60 * 1000));
  // 连接失败的样子和原生一样：WebSocket 回 'error' + 'HTTP 401 …'，HTTPS 回 'fail' + 阿里云的错误 JSON
  const failWs = id => cb(id, 'error', !S.key ? 'HTTP 401 no key' : S.net === 'badkey' ? 'HTTP 401 Unauthorized'
    : S.net === 'quota' ? 'HTTP 429 Too Many Requests' : 'Unable to resolve host "dashscope.aliyuncs.com"');
  const failPost = id => cb(id, 'fail', !S.key ? '{"code":"InvalidApiKey","message":"no key","status":401}'
    : S.net === 'badkey' ? '{"code":"InvalidApiKey","message":"Invalid API-key provided."}'
    : S.net === 'quota' ? '{"code":"Arrearage","message":"Access denied, please make sure your account is in good standing."}'
    : 'Unable to resolve host "dashscope.aliyuncs.com"');
  const log = n => S.calls.push(n);

  W.EchoNative = {
    hasKey() { log('hasKey'); return !!S.key; },
    setKey(k) { log('setKey'); S.key = (k || '').trim(); },
    setOrientation(m) { log('setOrientation'); S.orient = m === 'landscape' || m === 'auto' ? m : 'portrait'; },
    wsOpen(id, url) {
      log('wsOpen');
      if (!/^wss:\/\/dashscope\.aliyuncs\.com\//.test(url || '')) return cb(id, 'error', 'bad url');
      if (S.key && S.net === 'ok' && S.onWsOpen) return S.onWsOpen(id, url, cb);
      failWs(id);
    },
    wsSend(id, text) { log('wsSend'); if (S.onWsSend) S.onWsSend(id, text, cb); },
    wsClose(id) { log('wsClose'); if (S.onWsClose) S.onWsClose(id, cb); },
    post(id, url, body) {
      log('post');
      if (!/^https:\/\/dashscope\.aliyuncs\.com\//.test(url || '')) return cb(id, 'fail', 'bad url');
      if (S.key && S.net === 'ok' && S.onPost) return S.onPost(id, url, body, cb);
      failPost(id);
    },
    version() { log('version'); return JSON.stringify(S.version); },
    diag() {
      log('diag');
      return JSON.stringify(Object.assign(S.platform === 'ios'
        ? { renderGone: 0, lastGone: 0, lastCrash: false, platform: 'ios', ios: S.ios, model: S.model, webview: 'WebKit', debug: true, micLastDeny: {} }
        : { renderGone: 0, lastGone: 0, lastCrash: false, sdk: 35, android: '15', webview: 'fake', debug: true }, S.diagExtra || {}));
    },
    takeRecovered() { log('takeRecovered'); const r = S.recovered; S.recovered = false; return r; },
    hasPin() { log('hasPin'); return !!S.pin; },
    checkPin(p) {
      log('checkPin');
      p = p == null ? '' : String(p).trim();
      if (!S.pin || !p || waitMs() > 0) return false;
      if (p === String(S.pin)) { S.fails = 0; S.okAt = S.now(); return true; }
      if (++S.fails >= TRIES) { S.fails = 0; S.lockUntil = S.now() + LOCK_MS; S.lockouts++; S.lastLock = S.now(); }
      return false;
    },
    pinStatus() {
      log('pinStatus');
      const w = waitMs();
      return JSON.stringify({ has: !!S.pin, locked: w > 0, waitSec: Math.ceil(w / 1000), triesLeft: w > 0 ? 0 : TRIES - S.fails, lockouts: S.lockouts, lastLock: S.lastLock, canSet: canSet() });
    },
    setPin(p) {
      log('setPin');
      p = p == null ? '' : String(p).trim();
      if (!/^[0-9]{4}$/.test(p) || !canSet()) return false;
      S.pin = p; S.fails = 0; S.lockUntil = 0; S.okAt = 0;
      return true;
    },
    edition() { log('edition'); return S.edition; },
    verUrl() { log('verUrl'); return S.verUrl; },
    books() { log('books'); return S.books; },
    storage() { log('storage'); return JSON.stringify(S.storage || {}); },
    micPermission() { log('micPermission'); return S.mic; },
    openAppSettings() {
      log('openAppSettings');
      S.settingsOpened++;
      if (S.micAfterSettings && S.micAfterSettings !== S.mic) { S.mic = S.micAfterSettings; setTimeout(() => emit('echo-mic', S.mic), 0); }
      return true;
    },
    backupWrite(json) {
      log('backupWrite');
      if (json == null || !String(json).trim().startsWith('{')) return false;
      const name = 'echo-save-' + day() + '.json';
      S.backups[name] = { text: String(json), time: S.now() };
      sorted().filter(n => n !== name).slice(KEEP - 1).forEach(n => delete S.backups[n]);
      return true;
    },
    backupList() {
      log('backupList');
      return JSON.stringify(sorted().map(n => {
        const d = n.match(NAME)[1];
        return { name: n, date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), size: new TextEncoder().encode(S.backups[n].text).length, time: S.backups[n].time };
      }));
    },
    backupRead(name) { log('backupRead'); return NAME.test(name || '') && S.backups[name] ? S.backups[name].text : ''; },
    backupPick() { log('backupPick'); setTimeout(() => emit('echo-backup-picked', S.picked || { ok: false, name: '', error: 'cancel' }), 0); return true; },
    shareText(title, text) { log('shareText'); if (!text) return false; S.shared.push({ title, text, file: text.length > 8000 }); return true; },
    shareFile(title, name, text) {
      log('shareFile');
      if (text == null || !/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}$/.test(name || '') || !/\.(json|txt)$/.test(name)) return false;
      S.shared.push({ title, name, text, file: true });
      return true;
    },
  };
  // ---------- iPhone 才有的（platform: 'ios'）：订阅（Store.swift）和通过 Apple 登录（AppleSignIn.swift），照 ios/README.md「订阅和登录」的表 ----------
  // 都是异步的：第一个参数是编号，结果 window.__echoNative(编号, 'ok' / 'fail', JSON 文字)。安卓的假桥里没有它们（tests/native.test.js 按安卓核对）。
  // 开关（S.iap / S.apple，页面里随时能改）：
  //   iap.products 两个商品（displayPrice、period……）、iap.canPay、iap.buy（'purchased' 默认 / 'cancelled' / 'pending' / 'fail:<代号>'）、
  //   iap.bundle、iap.env（交易里的 bundleId / environment）；记录：iap.unfinished（还没 finish 的交易）、iap.finished（finish 过的编号 + 时间）、
  //   iap.entitlements（现在有效的，iapCurrent / iapRestore 回它）、iap.log（每次调用：方法名 + 时间）。
  //   交易的 JWS：页面里有 window.__mintJws(payload) 就用它签（测试用 Playwright 的 exposeFunction 接到自己造的 App Store 证书链），没有就是假的字符串。
  //   S.newTx(商品编号, {kind, revoked, expires, original}) 造一笔交易；S.fireIap(交易) 当成 Transaction.updates 来的（发 echo-iap 事件，也进 unfinished）。
  //   apple.on（diag().appleSignIn）、apple.result（'ok' / 'cancelled' / 'fail'）、apple.user、apple.state（appleCredentialState 回的）；
  //   身份令牌：页面里有 window.__appleToken(nonce 原文) 就用它造，没有就是假的。
  if (S.platform === 'ios') {
    const P = (opts.iap && opts.iap.prefix) || 'com.echoisland.app.premium.';
    S.iap = Object.assign({
      products: [
        { id: P + 'monthly', kind: 'monthly', title: 'Premium Monthly', description: 'More AI time every day', displayPrice: '$8.99', price: '8.99', currency: 'USD', groupId: 'g1', period: { unit: 'month', value: 1 }, introOffer: null, introEligible: false, trial: false },
        { id: P + 'yearly', kind: 'yearly', title: 'Premium Yearly', description: 'Best value', displayPrice: '$59.99', price: '59.99', currency: 'USD', groupId: 'g1', period: { unit: 'year', value: 1 }, introOffer: { paymentMode: 'freeTrial', period: { unit: 'week', value: 1 }, periodCount: 1, displayPrice: '$0.00' }, introEligible: true, trial: true },
      ],
      canPay: true, buy: 'purchased', bundle: 'com.echoisland.app', env: 'Sandbox',
      unfinished: [], finished: [], entitlements: [], log: [],
    }, opts.iap || {});
    S.apple = Object.assign({ on: true, result: 'ok', user: '001234.fakeappleuser.0001', state: 'authorized' }, opts.apple || {});
    const ok = (id, o) => cb(id, 'ok', JSON.stringify(o)), fail = (id, e, m) => cb(id, 'fail', JSON.stringify({ error: e, message: m || e }));
    const ilog = m => { log(m); S.iap.log.push({ m, at: Date.now() }); };
    let seq = 0;
    S.newTx = async (productId, o) => {
      o = o || {};
      const now = S.now(), DAY = 86400000, tid = String(2000000000000000 + Date.now() % 1e9 * 10 + (++seq));
      const pay = {
        transactionId: tid, originalTransactionId: o.original || tid, bundleId: S.iap.bundle, productId, purchaseDate: now, originalPurchaseDate: now,
        expiresDate: o.expires || now + (/yearly/.test(productId) ? 365 : 30) * DAY, type: 'Auto-Renewable Subscription', inAppOwnershipType: 'PURCHASED', signedDate: now,
        environment: S.iap.env, appAccountToken: o.token || (S.iap.lastToken || undefined), transactionReason: o.kind === 'renewal' ? 'RENEWAL' : 'PURCHASE', storefront: 'AUS',
      };
      if (o.revoked) { pay.revocationDate = now; pay.revocationReason = 0; }
      const jws = typeof W.__mintJws === 'function' ? await W.__mintJws(pay) : 'fake.' + btoa(JSON.stringify(pay)).replace(/=+$/, '') + '.sig';
      return { jws, verified: true, transactionId: tid, originalId: pay.originalTransactionId, productId, purchaseDate: now, expires: pay.expiresDate, revoked: o.revoked ? now : null,
        upgraded: false, appAccountToken: pay.appAccountToken || null, environment: S.iap.env, ownership: 'PURCHASED', kind: o.kind || 'purchase' };
    };
    S.fireIap = tx => { S.iap.unfinished.push(tx); emit('echo-iap', tx); };
    Object.assign(W.EchoNative, {
      iapProducts(id, ids) { ilog('iapProducts'); ok(id, { products: S.iap.products, missing: [], canPay: S.iap.canPay }); },
      iapBuy(id, productId, token) {
        ilog('iapBuy');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(token || ''))) return fail(id, 'bad-token');
        const b = S.iap.buy;
        if (b === 'cancelled' || b === 'pending') return ok(id, { status: b });
        if (/^fail:/.test(b)) return fail(id, b.slice(5));
        S.iap.lastToken = String(token).toLowerCase();
        S.newTx(productId, { token: S.iap.lastToken }).then(tx => {
          S.iap.unfinished.push(tx);
          S.iap.entitlements = S.iap.entitlements.filter(x => x.productId !== productId).concat([tx]);
          const o = Object.assign({}, tx, { status: 'purchased' }); delete o.kind;
          ok(id, o);
        });
      },
      iapRestore(id) { ilog('iapRestore'); ok(id, { synced: true, entitlements: S.iap.entitlements.filter(x => !x.revoked) }); },
      iapCurrent(id) { ilog('iapCurrent'); ok(id, { entitlements: S.iap.entitlements.filter(x => !x.revoked) }); },
      iapPending(id) { ilog('iapPending'); ok(id, { transactions: S.iap.unfinished.map(x => Object.assign({ kind: 'purchase' }, x)) }); },
      iapFinish(id, transactionId) {
        ilog('iapFinish');
        const i = S.iap.unfinished.findIndex(x => x.transactionId === String(transactionId));
        if (i < 0) return ok(id, { finished: false, transactionId, reason: 'not-unfinished' });
        S.iap.unfinished.splice(i, 1); S.iap.finished.push({ id: String(transactionId), at: Date.now() });
        ok(id, { finished: true, transactionId });
      },
      iapManage(id) { ilog('iapManage'); setTimeout(() => ok(id, { shown: true }), 20); },
      appleSignIn(id, nonce) {
        log('appleSignIn');
        if (!S.apple.on) return fail(id, 'unavailable', 'Sign in with Apple is not available in this build');
        if (!/^[\x21-\x7e]{16,256}$/.test(String(nonce || ''))) return fail(id, 'bad-nonce');
        if (S.apple.result === 'cancelled') return ok(id, { cancelled: true });
        if (S.apple.result === 'fail') return fail(id, 'failed');
        Promise.resolve(typeof W.__appleToken === 'function' ? W.__appleToken(String(nonce)) : 'fake.apple.token')
          .then(tok => ok(id, { identityToken: tok, authorizationCode: 'c' + Date.now().toString(36), user: S.apple.user, realUserStatus: 2 }));
      },
      appleCredentialState(id, user) { log('appleCredentialState'); if (!S.apple.on) return fail(id, 'unavailable'); ok(id, { state: S.apple.state }); },
    });
    const d0 = W.EchoNative.diag;
    W.EchoNative.diag = function () { const o = JSON.parse(d0()); o.appleSignIn = !!S.apple.on; o.iapProducts = S.iap.products.map(p => p.id); return JSON.stringify(o); };
  }
  W.ECHO_APP = 1;
  return S;
}

if (typeof module !== 'undefined') module.exports = { install: installFakeEchoNative };
