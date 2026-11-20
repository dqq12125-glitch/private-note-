// 回声岛 iPhone 版：页面一开始就执行的脚本（原生用 WKUserScript 在 document start 注入，排在游戏的任何脚本前面）。
// 作用：给网页一个和安卓一模一样的 window.EchoNative（方法名、参数个数、返回值都照 android/README.md 的表），
// 所以 game.js / talk.js / setup.js 不用为 iPhone 改。安卓上这些方法是同步的，这里分两条路：
//   同步（SYNC）：window.prompt('__echo_native__:' + JSON) → 原生在 prompt 回调里办完、把结果当 prompt 的返回值交回来；
//   异步（ASYNC，连阿里云的四个，没有返回值）：webkit.messageHandlers.echo.postMessage(…)，结果由原生调 window.__echoNative(id, 类型, 数据)。
// 另有 iPhone 才有的几个（IOS_ONLY：订阅、通过 Apple 登录、口语题的本机识别），走同一条异步的路；安卓的 EchoNative 里没有它们。
// 另外还管几件只有 iPhone 才要管的事（都在这个文件里，不动游戏的代码）：声音不被静音键关掉、开麦克风时切到「边录边放」、
// 来电 / Siri 打断以后把声音接上、麦克风的 16kHz 声音通道在 iPhone 上会丢样本所以改用系统默认的（WebKit bug 251350）、不让长按选字 / 双指缩放、
// <html> 上加 class="echo-ios"（style.css 末尾横屏让开灵动岛的几条认它）、请求持久存储。
// tests/ios.test.js 在电脑上用假的 prompt 跑这个文件，核对每个方法。
(function () {
  'use strict';
  var W = window;
  if (W.EchoNative) return;
  var BOOT = W.__ECHO_BOOT || {};
  var TAG = '__echo_native__:';
  var nativePrompt = W.prompt;   // 先留一份：以后页面换掉 window.prompt 也不影响桥

  function sync(m, a) {
    var r = null;
    try { r = nativePrompt.call(W, TAG + JSON.stringify({ m: m, a: a })); } catch (e) { r = null; }
    if (r == null || r === '') return undefined;
    try { return JSON.parse(r); } catch (e) { return undefined; }
  }
  function send(m, a) {
    try { W.webkit.messageHandlers.echo.postMessage({ m: m, a: a }); } catch (e) { /* 不在 App 里 */ }
  }
  function coerce(type, v) {
    if (type === 'i') { v = Number(v); return isFinite(v) ? Math.trunc(v) : 0; }
    return v == null ? null : String(v);
  }

  // 方法表：名字 → [种类, 参数（i 整数 / s 字符串，一个字母一个参数）, 原生没回音时的返回值（没有 = 这个方法没有返回值）]
  var SPEC = {
    // AI 连接（直连阿里云，带密钥）
    hasKey: ['sync', '', false],
    setKey: ['sync', 's'],
    wsOpen: ['async', 'is'],
    wsSend: ['async', 'is'],
    wsClose: ['async', 'i'],
    post: ['async', 'iss'],
    // 设置、版本、诊断
    setOrientation: ['sync', 's'],
    version: ['sync', '', '{}'],
    diag: ['sync', '', '{}'],
    takeRecovered: ['sync', '', false],
    edition: ['sync', '', 'sales'],
    books: ['sync', '', ''],
    verUrl: ['sync', '', ''],
    storage: ['sync', '', '{}'],
    // 家长密码
    hasPin: ['sync', '', false],
    checkPin: ['sync', 's', false],
    pinStatus: ['sync', '', '{}'],
    setPin: ['sync', 's', false],
    // 麦克风
    micPermission: ['sync', '', 'denied'],
    openAppSettings: ['sync', '', false],
    // 存档备份和导出
    backupWrite: ['sync', 's', false],
    backupList: ['sync', '', '[]'],
    backupRead: ['sync', 's', ''],
    backupPick: ['sync', '', false],
    shareText: ['sync', 'ss', false],
    shareFile: ['sync', 'sss', false],
    // ---- iPhone 才有的（IOS_ONLY，安卓以后接 Google Play 结算再加）：都是异步的，第一个参数是网页给的编号，
    //      结果 window.__echoNative(id, 'ok' / 'fail', JSON 文字)；说明在 ios/README.md「订阅和登录」 ----
    // 订阅（StoreKit 2）。iapProducts 的第二个参数可以是数组（转成 "a,b"）或者逗号分开的文字，空的 = 月度、年度两个
    iapProducts: ['async', 'is'],
    iapBuy: ['async', 'iss'],          // (id, 商品编号, 服务器给这个账号的 UUID)
    iapRestore: ['async', 'i'],
    iapCurrent: ['async', 'i'],
    iapPending: ['async', 'i'],
    iapFinish: ['async', 'is'],        // (id, transactionId)：服务器存好了才调
    iapManage: ['async', 'i'],
    // 通过 Apple 登录
    appleSignIn: ['async', 'is'],      // (id, 网页生成的随机 nonce 原文)
    appleCredentialState: ['async', 'is'],
    // 口语题的本机识别（LocalSpeech.swift，iPhone 自带的语音识别、只在手机上识别）：过程是事件 echo-speech；talk.js 的 listenOnce 用
    speechState: ['async', 'i'],       // 能不能用（不弹框）
    speechStart: ['async', 'is'],      // (id, 选项 JSON 文字)：第一次弹「语音识别」的权限框；识别任务建好了就回 ok
    speechFeed: ['async', 'is'],       // (speechStart 的编号, base64 的 16 位 PCM)：网页录到的声音一段段送过去，不回话（麦克风归网页）
    speechStop: ['async', 'i']
  };
  var IOS_ONLY = ['iapProducts', 'iapBuy', 'iapRestore', 'iapCurrent', 'iapPending', 'iapFinish', 'iapManage', 'appleSignIn', 'appleCredentialState',
    'speechState', 'speechStart', 'speechFeed', 'speechStop'];

  function make(name, spec) {
    var kind = spec[0], types = spec[1], hasRet = spec.length > 2, dflt = spec[2];
    var call = function (args) {
      var a = [];
      for (var i = 0; i < types.length; i++) a.push(coerce(types[i], args[i]));
      if (kind === 'async') { send(name, a); return undefined; }
      var r = sync(name, a);
      if (!hasRet) return undefined;
      return r === undefined || r === null ? dflt : r;
    };
    // 参数个数要和安卓一样（fn.length）
    switch (types.length) {
      case 0: return function () { return call([]); };
      case 1: return function (a) { return call([a]); };
      case 2: return function (a, b) { return call([a, b]); };
      default: return function (a, b, c) { return call([a, b, c]); };
    }
  }

  var N = {};
  Object.keys(SPEC).forEach(function (name) { N[name] = make(name, SPEC[name]); });
  W.EchoNative = N;

  // 和安卓一样：页面一开始原生告诉游戏「在 App 里」、中转服务的地址和家庭口令（只有家庭版可能有）。ECHO_IOS 是 iPhone 版独有的
  W.ECHO_APP = 1;
  W.ECHO_IOS = 1;
  W.ECHO_TALK_URL = BOOT.talkUrl || '';
  try { if (BOOT.talkCode && !localStorage.getItem('echo-talk-code')) localStorage.setItem('echo-talk-code', BOOT.talkCode); } catch (e) { /* 忽略 */ }
  // style.css 末尾只给 iPhone 版的几条（横屏让开灵动岛和底部横条、输入框不放大页面）认这个 class
  function markRoot() { try { document.documentElement.classList.add('echo-ios'); return true; } catch (e) { return false; } }
  if (!markRoot()) document.addEventListener('DOMContentLoaded', markRoot);
  // 存档在 localStorage：请 WebKit 把这个网站当「持久存储」（手机空间紧张时不先清它）。不给也没关系：原生每天另存一份备份到「文件」App
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* 不给就算了 */ }); } catch (e) { /* 老系统没有 */ }

  // ---------- 声音 ----------
  // iPhone 上网页的声音归 WebKit 自己管（App 里设系统的声音类别不管用）。navigator.audioSession.type：
  //   'playback' = 像播放器一样出声，静音键关不掉（不设的话，合成的配乐 / 音效 / 岛民的声音会被静音键关掉）；
  //   'play-and-record' = 边录边放（开着麦克风时必须是它；'playback' 下 getUserMedia 会直接报错）。
  // 所以：平时 playback；网页要开麦克风的那一刻换成 play-and-record；麦克风的声音轨道都停了再换回来。
  var AS = null;
  try { AS = navigator.audioSession || null; } catch (e) { AS = null; }
  function sessionType(t) { try { if (AS && AS.type !== t) AS.type = t; } catch (e) { /* 老系统没有 / 不让设 */ } }
  sessionType('playback');

  var live = [];   // 还开着的麦克风声音轨道（口语题的本机识别也是网页开的麦克风，和云端识别一样走这里）
  function trackGone(t) {
    var i = live.indexOf(t);
    if (i >= 0) live.splice(i, 1);
    if (!live.length) sessionType('playback');
  }
  try {
    var MD = navigator.mediaDevices;
    if (MD && typeof MD.getUserMedia === 'function') {
      var realGUM = MD.getUserMedia.bind(MD);
      MD.getUserMedia = function (constraints) {
        var wantsAudio = !!(constraints && constraints.audio);
        if (wantsAudio) sessionType('play-and-record');
        return realGUM(constraints).then(function (stream) {
          try {
            stream.getAudioTracks().forEach(function (t) {
              live.push(t);
              t.addEventListener('ended', function () { trackGone(t); });
            });
          } catch (e) { /* 忽略 */ }
          return stream;
        }, function (err) {
          if (wantsAudio && !live.length) sessionType('playback');
          throw err;
        });
      };
    }
    // 网页自己 stop() 的轨道不会有 ended 事件：在 stop 里记一下
    if (W.MediaStreamTrack && MediaStreamTrack.prototype && typeof MediaStreamTrack.prototype.stop === 'function') {
      var realStop = MediaStreamTrack.prototype.stop;
      MediaStreamTrack.prototype.stop = function () {
        var r = realStop.apply(this, arguments);
        try { trackGone(this); } catch (e) { /* 忽略 */ }
        return r;
      };
    }
  } catch (e) { /* 没有麦克风接口：游戏自己会提示 */ }

  // AudioContext：记下建过的（来电 / Siri 打断以后要接上）；麦克风用的 16kHz 通道在 iPhone 上会丢四分之一的样本
  //（WebKit 的老问题），去掉这个选项用系统默认的采样率——talk.js 本来就会按实际采样率换算成 16k
  var ctxs = [];
  function remember(ctx) {
    try {
      ctxs = ctxs.filter(function (r) { var c = r.deref(); return c && c.state !== 'closed'; });
      ctxs.push(new WeakRef(ctx));
    } catch (e) { /* 没有 WeakRef 就不记 */ }
  }
  try {
    var RealAC = W.AudioContext || W.webkitAudioContext;
    if (RealAC && typeof Proxy === 'function' && typeof Reflect === 'object') {
      var WrappedAC = new Proxy(RealAC, {
        construct: function (Target, args, NewTarget) {
          var o = args && args[0];
          if (o && typeof o === 'object' && o.sampleRate === 16000) {
            o = Object.assign({}, o);
            delete o.sampleRate;
            args = [o];
          }
          var ctx = Reflect.construct(Target, args || [], NewTarget === WrappedAC ? Target : NewTarget);
          remember(ctx);
          return ctx;
        }
      });
      if (W.AudioContext) W.AudioContext = WrappedAC;
      if (W.webkitAudioContext) W.webkitAudioContext = WrappedAC;
    }
  } catch (e) { /* 包不上就用原来的 */ }

  // 原生在 App 回到前台时调（来电结束、Siri 关掉、从「设置」回来）：被系统打断的声音通道接上
  function wake() {
    var n = 0;
    ctxs.forEach(function (r) {
      var c = null;
      try { c = r.deref(); } catch (e) { c = null; }
      if (c && c.state === 'interrupted') { n++; try { var p = c.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* 忽略 */ } }
    });
    if (!live.length) sessionType('playback');
    return n;
  }
  W.__echoIOS = { wake: wake, spec: SPEC, iosOnly: IOS_ONLY.slice(), live: function () { return live.length; } };

  // ---------- 触摸 ----------
  // 长按不弹「拷贝 / 查询」、不选中文字（输入框照常能选、能粘贴）；横屏时文字不自动放大；不让双指缩放、输入框聚焦时不放大页面
  var STYLE = 'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    'body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    'input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}';
  function addStyle() {
    try {
      if (document.getElementById('echo-ios-style')) return true;
      var host = document.head || document.documentElement;
      if (!host) return false;
      var st = document.createElement('style');
      st.id = 'echo-ios-style';
      st.textContent = STYLE;
      host.appendChild(st);
      return true;
    } catch (e) { return false; }
  }
  function fixViewport() {
    try {
      var m = document.querySelector('meta[name=viewport]');
      if (m && !/user-scalable/.test(m.content)) m.content += ',maximum-scale=1,user-scalable=no';
    } catch (e) { /* 忽略 */ }
  }
  // ---------- 测试版的版本角标 ----------
  // TestFlight 的包（打包时给了 ECHO_BETA，启动对象里的 beta 就是「1.0.0 (465143)」这样的字）在屏幕最下面正中放一行很小的半透明版本号：
  // 老板截图发过来，一眼看得出手机上装的是哪一版（2026-11-20：修好的版本传上去了，手机还没更新，截图看着像「没修」）。
  // 不接触摸、不挡东西；提交审核的包不给 ECHO_BETA，就没有这一行
  function addBeta() {
    try {
      if (!BOOT.beta) return true;
      if (document.getElementById('echo-beta')) return true;
      if (!document.body) return false;
      var d = document.createElement('div');
      d.id = 'echo-beta';
      d.setAttribute('aria-hidden', 'true');
      d.textContent = String(BOOT.beta);
      d.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom, 0px) + 1px);transform:translateX(-50%);z-index:2147483000;' +
        'font:600 9px/1 -apple-system,system-ui,sans-serif;letter-spacing:.3px;color:#fff;opacity:.5;text-shadow:0 0 2px #000,0 0 2px #000;pointer-events:none;white-space:nowrap';
      document.body.appendChild(d);
      // 版本号后面跟上最近一次口语识别的情况（talk.js 的 EchoTalk.lastSpeech()）：哪个引擎、怎么结束的、为什么改走云端、原生的错误代号、
      // 点了到开始听 / 第一个字 / 结束各多少毫秒；本机识别那几样：fed 送过去几段声音 / 原生说收到几段，v: 有没有人声（w 网页量到、n 原生说出声、- 都没有），
      // off: 这次打开 App 不再用本机识别的原因。老板截图里带着它，不用连电脑也知道识别卡在哪一步
      setInterval(function () {
        try {
          var s = W.EchoTalk && W.EchoTalk.lastSpeech ? W.EchoTalk.lastSpeech() : null, t = String(BOOT.beta);
          if (s) {
            t += ' · ' + (s.eng || '?') + ' ' + (s.how || s.err || (s.ok ? 'ok' : '')) + (s.fell ? ' fell:' + s.fell : '') + (s.nerr ? ' ' + String(s.nerr).slice(0, 40) : '') +
              ' ' + [s.listen, s.first, s.end].map(function (v) { return v == null ? '-' : v; }).join('/') +
              (s.fed != null ? ' fed' + s.fed + (s.nfed != null ? '/' + s.nfed : '') : '') + (s.vo ? ' v:' + s.vo : '') + (s.off ? ' off:' + s.off : '');
          }
          if (d.textContent !== t) d.textContent = t;
        } catch (e) { /* 只是给人看的一行字 */ }
      }, 1000);
      return true;
    } catch (e) { return true; }
  }
  // ---------- 口语题的本机识别：第二版重新打开 ----------
  // 2026-11-20 第一版（原生自己用 AVAudioEngine 录音）在老板的 iPhone 上一开始听就停：App 自己的声音会话和网页那一层（WebKit 另一个进程）的
  // 声音会话互相打断（没在真机上看到日志，是按代码推的），界面停在「请说……」。当晚的临时版在这里每次打开都写 localStorage['echo-sr'] = 'cloud'。
  // 第二版改成「网页录音、原生只管识别」（speechFeed），把临时版写的值清掉——只清一次（记号 echo-sr-v2），以后调试时自己设的 'cloud' 照样管用
  try {
    if (!W.localStorage.getItem('echo-sr-v2')) {
      if (W.localStorage.getItem('echo-sr') === 'cloud') W.localStorage.removeItem('echo-sr');
      W.localStorage.removeItem('echo-sr-try');
      W.localStorage.setItem('echo-sr-v2', '1');
    }
  } catch (e) { /* 没有存储就算了 */ }
  if (!addStyle()) document.addEventListener('DOMContentLoaded', addStyle);
  document.addEventListener('DOMContentLoaded', function () { addStyle(); fixViewport(); addBeta(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
})();
