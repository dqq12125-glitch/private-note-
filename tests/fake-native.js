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
    diag() { log('diag'); return JSON.stringify({ renderGone: 0, lastGone: 0, lastCrash: false, sdk: 35, android: '15', webview: 'fake', debug: true }); },
    takeRecovered() { log('takeRecovered'); const r = S.recovered; S.recovered = false; return r; },
    hasPin() { log('hasPin'); return !!S.pin; },
    checkPin(p) {
      log('checkPin');
      p = p == null ? '' : String(p).trim();
      if (!S.pin || !p || waitMs() > 0) return false;
      if (p === String(S.pin)) { S.fails = 0; return true; }
      if (++S.fails >= TRIES) { S.fails = 0; S.lockUntil = S.now() + LOCK_MS; S.lockouts++; S.lastLock = S.now(); }
      return false;
    },
    pinStatus() {
      log('pinStatus');
      const w = waitMs();
      return JSON.stringify({ has: !!S.pin, locked: w > 0, waitSec: Math.ceil(w / 1000), triesLeft: w > 0 ? 0 : TRIES - S.fails, lockouts: S.lockouts, lastLock: S.lastLock });
    },
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
  W.ECHO_APP = 1;
  return S;
}

if (typeof module !== 'undefined') module.exports = { install: installFakeEchoNative };
