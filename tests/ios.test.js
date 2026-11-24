// iPhone 版的检查（不开浏览器、不用 Mac，几秒钟）：node tests/ios.test.js
// Swift 在这台电脑上编不了（云上的 Mac 编：.github/workflows/ios-simulator.yml），这里先把能在电脑上核对的都核对一遍：
// 1. 原生桥的方法：android/README.md 的每个方法，ios/App/Resources/echo-native.js 和 ios/App/Sources/Bridge.swift 里都有，名字一样、
//    参数个数和安卓 MainActivity 一样、同步 / 异步分得一样（异步 = 安卓那边结果走 window.__echoNative 回调的四个）；echo-native.js 在 vm 里真跑一遍
// 2. Info.plist：有中文的麦克风说明、没有放开 http 的例外（ATS）、出口合规写了不用加密；隐私清单写了用到的几类「要说明原因的接口」
// 3. 原生桥只连得到 dashscope.aliyuncs.com：联网的代码只在 DashScope.swift、两个入口先过 DashScope.allowed
// 4. ios/ 里会进仓库的文件没有像密钥的字符串（sk-…、64 位十六进制、私钥），生成的设置和网页不进仓库
// 5. ios/scripts/copy-web.mjs 的白名单和安卓 build.gradle 的 copyWeb 一样（按真的文件列表比一遍，家庭版、销售版）
// 6. ios/scripts/make-config.mjs：家长密码的哈希和 PinGuard（Swift / Java）一样；销售版给了密钥、密码、地址就停下；家庭版只放哈希
// 7. .github/workflows/ios-simulator.yml 读得出来、推到 echo-island/next 时跑、步骤齐全（StoreKit 测试单独一步、挑 26.2 的模拟器）；
//    ios-testflight.yml 只能手动点、先核对再传、密钥不进日志、只上传日志
// 8. 工程（project.yml）、Swift 里几处容易出错的地方（WebKit 回调的写法、调试包才能被网页检查器连、被叫停的请求不再回）、自测页覆盖每个方法
// 9. 订阅（Store.swift）和「通过 Apple 登录」（AppleSignIn.swift）：iPhone 才有的方法（IOS_ONLY 表）三处 + 自测页 + 两份 README 对得上、
//    finish 只在网页确认以后、没带权限的包当场回 unavailable、本地 App Store（Store.storekit）的商品和打包设置一样；
//    口语题的本机识别（LocalSpeech.swift，也在 IOS_ONLY 里）：只在手机上识别、答案不交给识别、声音由网页送来（speechFeed，原生不碰声音会话、不录音）、
//    后台当场停、Info.plist 有语音识别的说明、临时版写的 echo-sr = 'cloud' 只清一次
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const IOS = path.join(ROOT, 'ios');
const SRC = path.join(IOS, 'App', 'Sources');
let fails = 0;
const check = (ok, what, extra) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && extra !== undefined ? '\n    ' + JSON.stringify(extra).slice(0, 600) : '')); if (!ok) fails++; return ok; };
// 读源码一律按 LF 看：Windows 上 git 会把合并碰过的文件写成 CRLF，按行写的那些核对（Bridge.callSync 的 case）就对不上了
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const diff = (a, b) => ({ onlyLeft: [...a].filter(x => !b.includes(x)), onlyRight: [...b].filter(x => !a.includes(x)) });

(async () => {
  // ---------- 1. 方法表：README ↔ 安卓 ↔ echo-native.js ↔ Bridge.swift ----------
  const readme = read('android/README.md');
  const bridgeDoc = readme.slice(readme.indexOf('## 原生桥'), readme.indexOf('**原生发给网页的事件**'));
  const docMethods = {};
  // 表格每一行的第一格（「| `wsSend(id, text)` / `wsClose(id)` |」这种一格两个的也算）
  for (const line of bridgeDoc.split(/\r?\n/).filter(l => l.startsWith('| `'))) {
    for (const m of line.split('|')[1].matchAll(/`(\w+)\(([^)`]*)\)/g)) docMethods[m[1]] = m[2].trim() ? m[2].split(',').length : 0;
  }
  const names = Object.keys(docMethods);
  check(names.length === 26, 'android/README.md 的原生桥表有 26 个方法（' + names.length + '）', names);

  const java = read('android/app/src/main/java/com/echoisland/app/MainActivity.java');
  const nat = java.slice(java.indexOf('private class Native'));
  const andr = {};
  const heads = [...nat.matchAll(/@JavascriptInterface\s+public\s+([\w<>]+)\s+(\w+)\s*\(([^)]*)\)/g)];
  heads.forEach((m, i) => {
    const body = nat.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : nat.indexOf('private static String jsStr'));
    // 异步 = 结果走 window.__echoNative 回调（cb）的连接：安卓上那几个是 void、在 OkHttp 的线程里回
    andr[m[2]] = { args: m[3].trim() ? m[3].split(',').length : 0, ret: m[1], async: /\bcb\(|\bsocks\./.test(body) };
  });
  check(same(Object.keys(andr), names), '安卓 MainActivity 的 @JavascriptInterface 方法和 README 一样', diff(Object.keys(andr), names));
  check(names.every(n => andr[n] && andr[n].args === docMethods[n]), 'README 写的参数个数和安卓一样');
  const ASYNC = names.filter(n => andr[n] && andr[n].async).sort();
  check(JSON.stringify(ASYNC) === JSON.stringify(['post', 'wsClose', 'wsOpen', 'wsSend']), '异步的是连阿里云的四个：wsOpen / wsSend / wsClose / post', ASYNC);
  // iPhone 才有的方法（安卓以后接 Google Play 结算再加对应的）：名字 → [同步 / 异步, 参数个数]。
  // 要在 echo-native.js、Bridge.swift（iosOnlyMethods）、自测页里名字和种类都一样，在 ios/README.md 和 android/README.md 的「iPhone 才有的」里写着
  const IOS_ONLY = {
    iapProducts: ['async', 2], iapBuy: ['async', 3], iapRestore: ['async', 1], iapCurrent: ['async', 1], iapPending: ['async', 1],
    iapFinish: ['async', 2], iapManage: ['async', 1], appleSignIn: ['async', 2], appleCredentialState: ['async', 2],
    // 口语题的本机识别（LocalSpeech.swift，2026-11-20；第二版声音由网页 speechFeed 送来）
    speechState: ['async', 1], speechStart: ['async', 2], speechFeed: ['async', 2], speechStop: ['async', 1],
  };
  const IOSN = Object.keys(IOS_ONLY);
  const ALL = names.concat(IOSN);
  check(!IOSN.some(n => n in docMethods || n in andr), 'iPhone 才有的方法安卓那边还没有（有了就从 IOS_ONLY 里拿掉，按共有的核对）', IOSN.filter(n => n in docMethods || n in andr));

  // echo-native.js 在 vm 里跑：假的 prompt（同步通道）和 webkit.messageHandlers（异步通道）
  const shimSrc = read('ios/App/Resources/echo-native.js');
  const prompts = [], posted = [];
  let answer = null;
  const ctx = {
    console, JSON, Math, Number, String, Object, Array, isFinite, Proxy, Reflect, WeakRef,
    __ECHO_BOOT: { talkUrl: '', talkCode: '' },
    prompt: msg => { prompts.push(msg); return typeof answer === 'function' ? answer(msg) : answer; },
    webkit: { messageHandlers: { echo: { postMessage: m => posted.push(JSON.parse(JSON.stringify(m))) } } },
    navigator: {}, localStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { classList: { list: [], add(c) { this.list.push(c); } } }, getElementById: () => null, addEventListener: () => {}, querySelector: () => null, head: null },
    MediaStreamTrack: function () {},
  };
  ctx.window = ctx;
  ctx.MediaStreamTrack.prototype.stop = function () {};
  vm.createContext(ctx);
  vm.runInContext(shimSrc, ctx, { filename: 'echo-native.js' });
  const N = ctx.EchoNative, SPEC = ctx.__echoIOS && ctx.__echoIOS.spec;
  check(!!N && !!SPEC, 'echo-native.js 装好了 window.EchoNative 和 __echoIOS.spec');
  check(ctx.ECHO_APP === 1 && ctx.ECHO_IOS === 1 && ctx.ECHO_TALK_URL === '', 'echo-native.js 设了 ECHO_APP、ECHO_IOS、ECHO_TALK_URL（和安卓一样一开始就有）');
  check(ctx.document.documentElement.classList.list.includes('echo-ios'), '<html> 上加了 echo-ios（style.css 末尾的 iPhone 专用几条认它）');
  check(same(Object.keys(N), ALL) && same(Object.keys(SPEC), ALL), 'echo-native.js 的方法 = README 的 26 个 + iPhone 才有的 ' + IOSN.length + ' 个', diff(Object.keys(N), ALL));
  check(names.every(n => typeof N[n] === 'function' && N[n].length === docMethods[n] && SPEC[n][1].length === docMethods[n]), '每个方法的参数个数（fn.length）和安卓一样',
    names.filter(n => !(N[n] && N[n].length === docMethods[n])));
  check(names.every(n => SPEC[n][0] === (ASYNC.includes(n) ? 'async' : 'sync')), 'echo-native.js 的同步 / 异步和安卓一样（异步 = 回调的四个）',
    names.filter(n => SPEC[n][0] !== (ASYNC.includes(n) ? 'async' : 'sync')));
  // 安卓有返回值的（boolean / String）这里也有「原生没回音时」的默认值；安卓 void 的这里没有返回值
  check(names.every(n => (andr[n].ret === 'void') === (SPEC[n].length === 2)), '有没有返回值和安卓一样（void ↔ 没有默认值）', names.filter(n => (andr[n].ret === 'void') !== (SPEC[n].length === 2)));
  check(IOSN.every(n => SPEC[n] && SPEC[n][0] === IOS_ONLY[n][0] && SPEC[n][1].length === IOS_ONLY[n][1] && N[n].length === IOS_ONLY[n][1] && SPEC[n][1][0] === 'i' && SPEC[n].length === 2),
    'echo-native.js 里 iPhone 才有的：种类、参数个数和 IOS_ONLY 表一样；异步的第一个参数是编号、没有返回值', IOSN.filter(n => !(SPEC[n] && SPEC[n][0] === IOS_ONLY[n][0] && SPEC[n][1].length === IOS_ONLY[n][1])));
  check(same([...(ctx.__echoIOS.iosOnly || [])], IOSN), 'echo-native.js 的 IOS_ONLY 名单（__echoIOS.iosOnly）和这里一样', ctx.__echoIOS.iosOnly);
  // 假桥（tests/fake-native.js）：platform 'ios' 时有 iPhone 才有的方法（tests/account.test.js 用），参数个数和这张表一样；安卓的没有
  {
    const FNk = require('./fake-native');
    const mk = o => { const c = { console, JSON, Math, Date, Promise, setTimeout, clearTimeout, btoa: s => Buffer.from(s, 'binary').toString('base64') }; c.window = c; vm.createContext(c); vm.runInContext('(' + FNk.install.toString() + ')', c)(o); return c.EchoNative; };
    const fi = mk({ platform: 'ios' }), fa = mk({});
    check(IOSN.every(n => typeof fi[n] === 'function' && fi[n].length === IOS_ONLY[n][1]), 'tests/fake-native.js（platform ios）有 iPhone 才有的 ' + IOSN.length + ' 个方法，参数个数和 IOS_ONLY 一样', IOSN.filter(n => !(fi[n] && fi[n].length === IOS_ONLY[n][1])));
    check(!IOSN.some(n => n in fa), '安卓的假桥里没有 iPhone 才有的方法（网页按 typeof EchoNative.iapProducts 分安卓 / iPhone）');
    check(JSON.parse(fi.diag()).appleSignIn === true && Array.isArray(JSON.parse(fi.diag()).iapProducts), '假桥 iPhone 的 diag() 多两项：appleSignIn、iapProducts（和 Bridge.swift 一样）');
  }
  // 真调一遍：同步的走 prompt('__echo_native__:{"m","a"}')，回的 JSON 原样交给网页；异步的走 postMessage、不碰 prompt
  answer = msg => { const o = JSON.parse(msg.slice('__echo_native__:'.length)); return o.m === 'edition' ? '"sales"' : o.m === 'hasPin' ? 'true' : o.m === 'version' ? '"{\\"code\\":5}"' : 'null'; };
  prompts.length = 0;
  const ed = N.edition(), hp = N.hasPin(), ver = N.version(), ck = N.checkPin(1234), sk = N.setKey(undefined);
  const sent = prompts.map(p => JSON.parse(p.slice('__echo_native__:'.length)));
  check(ed === 'sales' && hp === true && ver === '{"code":5}', '同步方法：原生的回答原样交给网页（字符串、布尔）', { ed, hp, ver });
  check(ck === false && sk === undefined, '原生回 null 时：有返回值的给默认值（checkPin → false），没返回值的（setKey）是 undefined', { ck, sk });
  check(prompts.every(p => p.startsWith('__echo_native__:')) && sent[3].m === 'checkPin' && sent[3].a[0] === '1234' && sent[4].a[0] === null,
    '同步方法的参数按安卓的类型传（数字转成字符串、undefined → null）', sent);
  prompts.length = 0; posted.length = 0;
  N.wsOpen('7', 'wss://dashscope.aliyuncs.com/x'); N.wsSend(7.9, '{}'); N.wsClose(7); N.post(8, 'https://dashscope.aliyuncs.com/y', '{"a":1}');
  check(!prompts.length && posted.length === 4 && posted[0].m === 'wsOpen' && posted[0].a[0] === 7 && posted[1].a[0] === 7 && posted[3].a.length === 3,
    '异步方法走 webkit.messageHandlers.echo（编号转成整数），不碰 prompt', posted);
  posted.length = 0;
  const r1 = N.iapProducts('11', ['com.a.monthly', 'com.a.yearly']), r2 = N.iapBuy(12, 'com.a.monthly', '3f1d2c4e-0000-4000-8000-000000000000');
  N.iapFinish(13, '2000000123456789'); N.appleSignIn(14.5, 'n0nce-n0nce-n0nce'); N.iapRestore(15);
  check(!prompts.length && r1 === undefined && r2 === undefined && posted.length === 5 && posted[0].m === 'iapProducts' && posted[0].a[0] === 11 && posted[0].a[1] === 'com.a.monthly,com.a.yearly' &&
    posted[1].a.length === 3 && posted[2].a[1] === '2000000123456789' && posted[3].m === 'appleSignIn' && posted[3].a[0] === 14 && posted[4].a.length === 1,
    'iPhone 才有的也走 messageHandlers.echo：编号转整数，iapProducts 的数组变成 "a,b"，交易编号按字符串传（不丢精度）', posted);
  posted.length = 0;
  const r3 = N.speechStart(21, JSON.stringify({ short: true })); N.speechState('22'); const r4 = N.speechFeed(21.2, 'AAD/fw=='); N.speechStop(23.7);
  check(!prompts.length && r3 === undefined && r4 === undefined && posted.length === 4 && posted[0].m === 'speechStart' && posted[0].a[0] === 21 && posted[0].a[1] === '{"short":true}' &&
    posted[1].m === 'speechState' && posted[1].a[0] === 22 && posted[2].m === 'speechFeed' && posted[2].a[0] === 21 && posted[2].a[1] === 'AAD/fw==' &&
    posted[3].m === 'speechStop' && posted[3].a[0] === 23,
    '本机识别的四个也走 messageHandlers.echo：选项按 JSON 文字传，speechFeed 带 speechStart 的编号和 base64 的声音、没有返回值', posted);
  // 第二版：声音归网页（getUserMedia 那一套），echo-native.js 不再有「原生在录音」的声音类别开关
  check(!('speech' in ctx.__echoIOS) && !/speechOn/.test(shimSrc), 'echo-native.js 没有 __echoIOS.speech 了（本机识别也是网页开麦克风，和云端一样走 getUserMedia 的那一套）');
  // 临时版（只用云端）写的 localStorage['echo-sr'] = 'cloud'：只清一次（记号 echo-sr-v2），以后自己设的 'cloud' 照样管用
  {
    const run = store => {
      const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
      const c3 = Object.assign({}, ctx, { localStorage: ls }); c3.window = c3; delete c3.EchoNative; delete c3.__echoIOS;
      vm.createContext(c3); vm.runInContext(shimSrc, c3, { filename: 'echo-native.js' });
      return store;
    };
    const a1 = run({ 'echo-sr': 'cloud', 'echo-sr-try': '1' }), a2 = run({ 'echo-sr': 'cloud', 'echo-sr-v2': '1' }), a3 = run({});
    check(!('echo-sr' in a1) && !('echo-sr-try' in a1) && a1['echo-sr-v2'] === '1' && a2['echo-sr'] === 'cloud' && a3['echo-sr-v2'] === '1' && !('echo-sr' in a3),
      'echo-native.js：第一次打开清掉临时版写的 echo-sr = cloud（记下 echo-sr-v2），之后自己设的 cloud 不动、也不再写', { a1, a2, a3 });
  }
  answer = () => null;
  check(N.edition() === 'sales' && N.micPermission() === 'denied' && N.backupList() === '[]' && N.storage() === '{}',
    '原生没回音时的默认值（edition = sales，最保守）');
  ctx.prompt = () => '"evil"';
  answer = () => '"family"';
  check(N.edition() === 'family', '网页换掉 window.prompt 也不影响桥（先留了一份）');

  // Bridge.swift：同步 / 异步两张表 + switch 里的 case
  const bridge = fs.readFileSync(path.join(SRC, 'Bridge.swift'), 'utf8').replace(/\r\n/g, '\n');
  const arr = name => ((bridge.match(new RegExp('static let ' + name + ' = \\[([\\s\\S]*?)\\]')) || [])[1] || '').match(/"(\w+)"/g).map(s => s.slice(1, -1));
  const fnBody = name => { const i = bridge.indexOf('func ' + name + '('); const j = bridge.indexOf('\n    }\n', i); return bridge.slice(i, j); };
  const cases = body => [...body.matchAll(/case "(\w+)":/g)].map(m => m[1]);
  const swSync = arr('syncMethods'), swAsync = arr('asyncMethods'), swIos = arr('iosOnlyMethods');
  check(same(swSync.concat(swAsync), ALL), 'Bridge.swift 的方法表 = README 的 26 个 + iPhone 才有的', diff(swSync.concat(swAsync), ALL));
  check(same(swAsync, ASYNC.concat(IOSN.filter(n => IOS_ONLY[n][0] === 'async'))) && same(swSync, names.filter(n => !ASYNC.includes(n)).concat(IOSN.filter(n => IOS_ONLY[n][0] === 'sync'))),
    'Bridge.swift 的异步表 = 安卓回调的四个 + iPhone 才有的异步的', swAsync);
  check(same(swIos, IOSN), 'Bridge.swift 的 iosOnlyMethods = IOS_ONLY 表', diff(swIos, IOSN));
  check(same(cases(fnBody('callSync')), swSync), 'Bridge.callSync 里每个同步方法都有 case', diff(cases(fnBody('callSync')), swSync));
  check(same(cases(fnBody('callAsync')), swAsync), 'Bridge.callAsync 里每个异步方法都有 case', diff(cases(fnBody('callAsync')), swAsync));
  check(/static let tag = "__echo_native__:"/.test(bridge) && shimSrc.includes("TAG = '__echo_native__:'") && /static let handlerName = "echo"/.test(bridge) && shimSrc.includes('messageHandlers.echo'),
    '两条通道的名字两边一样（prompt 的前缀、messageHandlers.echo）');
  check(/case "setPin":[\s\S]{0,200}Bridge\.sales && pin\.set/.test(bridge) && /allowSet: Bridge\.sales/.test(bridge), '只有销售版能在手机上设家长密码（和安卓一样）');
  check(/case "edition":\s*\n\s*return Bridge\.sales \? "sales" : "family"/.test(bridge) && /static let sales = BuildConfig\.edition != "family"/.test(bridge), 'edition()：不是 family 就是 sales（公开发的版本）');
  check(/k\.isEmpty \? BuildConfig\.dashscopeKey : k/.test(bridge), '手机上填的密钥（钥匙串）优先，没有才用打包时的');
  check(/"platform": "ios"/.test(bridge) && /"renderGone"/.test(bridge) && /"lastGone"/.test(bridge), 'diag() 有安卓那几个字段，另外写着 platform = ios');
  check(/"appleSignIn": AppleSignIn\.available/.test(bridge) && /"iapProducts": \[BuildConfig\.iapMonthly, BuildConfig\.iapYearly\]/.test(bridge),
    'diag() 还说这个包能不能通过 Apple 登录、订阅的两个商品编号（网页决定显不显示那个按钮）');
  check(/Store\.shared\.onEvent = \{[\s\S]{0,200}emit\("echo-iap"/.test(bridge), 'Transaction.updates 来的交易发事件 echo-iap 给网页（和 echo-mic、echo-backup-picked 一样的写法）');
  // 口语题的本机识别（LocalSpeech.swift）：过程走事件 echo-speech，三个方法的结果和别的异步方法一样回 window.__echoNative
  check(/lazy var speech = LocalSpeech\(engine: HybridSpeechEngine\(\)\) \{[\s\S]{0,120}emit\("echo-speech"/.test(bridge) &&
    /case "speechStart":[\s\S]{0,200}speech\.start\(sid: id, opts: Bridge\.str\(a, 1\)\)[\s\S]{0,120}self\?\.callback\(gen, id, ok \? "ok" : "fail", Bridge\.json\(body\)\)/.test(bridge) &&
    /case "speechState":[\s\S]{0,120}callback\(h\.gen, Bridge\.int\(a, 0\), "ok", Bridge\.json\(speech\.state\(\)\)\)/.test(bridge) &&
    /case "speechStop":[\s\S]{0,160}speech\.stop\(reason: "stop"\)/.test(bridge) &&
    /case "speechFeed":\s*\n\s*speech\.feed\(sid: Bridge\.int\(a, 0\), b64: Bridge\.str\(a, 1\)\)\s*\n\s*case /.test(bridge),
    '本机识别：speechState / speechStart / speechStop 回 window.__echoNative(id, ok / fail, JSON)，过程发事件 echo-speech；speechFeed 只把声音交给 LocalSpeech、不回话');
  {
    const ls = fs.readFileSync(path.join(SRC, 'LocalSpeech.swift'), 'utf8');
    const code = ls.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');   // 不看注释
    check(/req\.requiresOnDeviceRecognition = true/.test(code) && !/requiresOnDeviceRecognition = false/.test(code) && /supportsOnDeviceRecognition else/.test(code),
      'LocalSpeech.swift：只在手机上识别（requiresOnDeviceRecognition = true），手机不支持就回 unavailable，不退回苹果的服务器');
    check(!/contextualStrings|customizedLanguageModel|SFSpeechLanguageModel/.test(code), '诚实打分：识别不知道答案（代码里没有 contextualStrings、自定义语言模型）');
    check(/req\.shouldReportPartialResults = true/.test(code) && /"partial"/.test(code) && /"voice"/.test(code) && /"end"/.test(code), '边说边出字（partial），出声 / 不出声（voice）、停了（end）都发事件');
    check(/didEnterBackgroundNotification[\s\S]{0,200}stop\(reason: "background"\)/.test(code), '切到后台：当场停');
    // 第二版：声音归网页。第一版自己用 AVAudioEngine 录音、动 App 的声音会话，在老板的 iPhone 上和网页那一层的声音互相打断
    check(!/AVAudioEngine|installTap|AppAudio|AVAudioSession|AVCaptureDevice|setActive|setCategory|interruptionNotification|mediaServicesWereReset/.test(code),
      'LocalSpeech.swift 不录音、不碰声音会话（没有 AVAudioEngine / AppAudio / AVAudioSession / 麦克风权限 / 打断的监听）：声音由网页 speechFeed 送来');
    check(/func feed\(sid: Int, b64: String\)\s*\{\s*\n\s*guard let run = cur, run\.sid == sid, let buf = LocalSpeech\.pcmBuffer\(b64, rate: run\.rate\) else \{ return \}/.test(code) &&
      /static func pcmBuffer\(_ b64: String, rate: Double\) -> AVAudioPCMBuffer\?/.test(code) && /\.pcmFormatFloat32/.test(code),
      'speechFeed：编号不对 / 已经停了 / 解不开的不管；16 位 PCM 换成 32 位浮点单声道交给识别');
    check(/protocol SpeechEngine/.test(code) && /final class AppleSpeechEngine: SpeechEngine/.test(code), '识别引擎单独一层（以后换 SpeechAnalyzer 只再写一个 SpeechEngine）');
    check((fs.readFileSync(path.join(SRC, 'GameViewController.swift'), 'utf8').match(/bridge\.speech\.stop\(reason: "page"\)/g) || []).length === 2, '网页进程挂了重建时把本机识别停掉');
  }
  check(IOSN.filter(n => n.startsWith('iap')).every(n => new RegExp('case "' + n + '":[\\s\\S]{0,240}storeCall\\(h\\.gen, Bridge\\.int\\(a, 0\\)\\)').test(bridge)) &&
    /case "appleSignIn":[\s\S]{0,200}apple\.signIn\(nonce: Bridge\.str\(a, 1\)\)/.test(bridge) && /case "appleCredentialState":[\s\S]{0,200}apple\.credentialState\(user: Bridge\.str\(a, 1\)\)/.test(bridge) &&
    /self\?\.callback\(gen, id, r\.ok \? "ok" : "fail", r\.json\)/.test(bridge),
    '订阅、登录的结果和 wsOpen / post 一样回 window.__echoNative(id, ok / fail, JSON)，网页重建过就不回（gen）');

  // ---------- 2. Info.plist、隐私清单 ----------
  const plist = read('ios/App/Info.plist');
  const pv = key => ((plist.match(new RegExp('<key>' + key + '</key>\\s*<(string|true|false)\\s*/?>([^<]*)')) || []).slice(1));
  const mic = pv('NSMicrophoneUsageDescription');
  check(mic[0] === 'string' && /[一-鿿]/.test(mic[1]) && mic[1].length >= 15, 'Info.plist 有中文的麦克风说明', mic[1]);
  // 本机识别第一次要弹「语音识别」的权限框：没有这条说明，requestAuthorization 会让 App 直接崩
  const spd = pv('NSSpeechRecognitionUsageDescription');
  check(spd[0] === 'string' && /[一-鿿]/.test(spd[1]) && /手机上/.test(spd[1]) && /不会上传/.test(spd[1]), 'Info.plist 有中文的语音识别说明（在手机上识别、声音不上传）', spd[1]);
  check(!/NSAppTransportSecurity|NSAllowsArbitraryLoads|NSExceptionDomains|NSAllowsLocalNetworking/.test(plist), 'Info.plist 没有放开 http 的例外（App Transport Security 照默认：只许 https）');
  check(pv('ITSAppUsesNonExemptEncryption')[0] === 'false', '出口合规：ITSAppUsesNonExemptEncryption = false（只用系统的 HTTPS 和 SHA-256）');
  check(pv('CFBundleDisplayName')[1] === '回声岛' && pv('UIStatusBarHidden')[0] === 'true' && pv('UIFileSharingEnabled')[0] === 'true', 'App 名字「回声岛」、不显示状态栏、备份在「文件」App 里看得到');
  check(['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'].every(o => plist.includes('<string>' + o + '</string>')) && plist.includes('UILaunchScreen'),
    '竖屏 + 两个横屏、有启动画面');
  check(/UISceneDelegateClassName[\s\S]{0,80}SceneDelegate/.test(plist), '用「场景」的写法（以后的 iOS 必须这样）');
  const pr = read('ios/App/Resources/PrivacyInfo.xcprivacy');
  const reason = (cat, code) => new RegExp(cat + '</string>\\s*<key>NSPrivacyAccessedAPITypeReasons</key>\\s*<array>[\\s\\S]*?<string>' + code + '</string>[\\s\\S]*?</array>').test(pr);
  check(/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(pr), '隐私清单：不追踪');
  check(reason('NSPrivacyAccessedAPICategoryUserDefaults', 'CA92.1') && reason('NSPrivacyAccessedAPICategoryFileTimestamp', 'C617.1') &&
    reason('NSPrivacyAccessedAPICategorySystemBootTime', '35F9.1') && reason('NSPrivacyAccessedAPICategoryDiskSpace', 'E174.1') && reason('NSPrivacyAccessedAPICategoryDiskSpace', '85F4.1'),
    '隐私清单写了用到的「要说明原因的接口」：UserDefaults CA92.1、文件时间 C617.1、开机时长 35F9.1、剩余空间 E174.1 + 85F4.1');
  const swiftAll = fs.readdirSync(SRC).filter(f => f.endsWith('.swift')).map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  check(/UserDefaults/.test(swiftAll) && /contentModificationDate/.test(swiftAll) && /systemUptime/.test(swiftAll) && /volumeAvailableCapacityForImportantUsage/.test(swiftAll),
    '（这四类接口代码里真的用到了，清单没有白写）');
  check(/NSPrivacyCollectedDataTypeAudioData/.test(pr), '隐私清单：声音会发出去（识别、打分），写了「音频」');
  // 公开版有账号和订阅：邮箱、用户 ID、购买记录、音频，都和身份关联、只为 App 功能、不追踪
  const dataType = t => (pr.match(new RegExp('<string>NSPrivacyCollectedDataType' + t + '</string>([\\s\\S]*?)</dict>')) || [])[1] || '';
  const linkedForApp = t => { const b = dataType(t); return /NSPrivacyCollectedDataTypeLinked<\/key>\s*<true\/>/.test(b) && /NSPrivacyCollectedDataTypeTracking<\/key>\s*<false\/>/.test(b) &&
    /<string>NSPrivacyCollectedDataTypePurposeAppFunctionality<\/string>/.test(b) && !/PurposeThirdPartyAdvertising|PurposeDeveloperAdvertising|PurposeAnalytics/.test(b); };
  check(['EmailAddress', 'UserID', 'PurchaseHistory', 'AudioData', 'OtherUserContent'].every(linkedForApp),
    '隐私清单：邮箱、用户 ID、购买记录、音频、其他用户内容——和身份关联、只为 App 的功能、不追踪', ['EmailAddress', 'UserID', 'PurchaseHistory', 'AudioData', 'OtherUserContent'].filter(t => !linkedForApp(t)));
  check(!/<key>NSPrivacyTrackingDomains<\/key>\s*<array>\s*<string>/.test(pr), '隐私清单：没有追踪用的域名');
  // 「通过 Apple 登录」的权限文件：只有这一项；工程里不直接引用它（只有签名的包经 make-config.mjs 带上）
  const ent = read('ios/App/EchoIsland.entitlements');
  check(/<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/.test(ent) && (ent.match(/<key>/g) || []).length === 1,
    '权限文件 App/EchoIsland.entitlements 只有「通过 Apple 登录」（Default）');
  check(!/CODE_SIGN_ENTITLEMENTS:/.test(read('ios/project.yml')), 'project.yml 里不写 CODE_SIGN_ENTITLEMENTS（写了会盖掉 make-config.mjs 给签名包的那一行，云上不签名的包也会带上它）');

  // ---------- 3. 只连得到阿里云 ----------
  const ds = fs.readFileSync(path.join(SRC, 'DashScope.swift'), 'utf8');
  check(/static let host = "dashscope\.aliyuncs\.com"/.test(ds) && /static let wsPrefix = "wss:\/\/" \+ host \+ "\/"/.test(ds) && /static let httpsPrefix = "https:\/\/" \+ host \+ "\/"/.test(ds),
    'DashScope.swift 只认 wss:// 和 https:// 的 dashscope.aliyuncs.com');
  check(/func wsOpen[\s\S]{0,200}guard let u = DashScope\.allowed\(url, prefix: DashScope\.wsPrefix\)/.test(ds) && /func post[\s\S]{0,200}guard let u = DashScope\.allowed\(url, prefix: DashScope\.httpsPrefix\)/.test(ds),
    '连之前先过 DashScope.allowed（开头一模一样、主机名再核一遍、不许带用户名 / 端口）');
  const others = fs.readdirSync(SRC).filter(f => f.endsWith('.swift') && f !== 'DashScope.swift');
  const netUse = others.filter(f => /URLSession\b|webSocketTask|dataTask|NWConnection|CFStream|URLConnection/.test(fs.readFileSync(path.join(SRC, f), 'utf8')));
  check(!netUse.length, '联网的代码只在 DashScope.swift', netUse);
  const urls = [...swiftAll.matchAll(/"(?:https?|wss?):\/\/[^"]+"/g)].map(m => m[0]);   // "wss://" + host 这种拼的不算
  check(!urls.length, 'Swift 里没有写死别的网址', urls);
  const gvc = fs.readFileSync(path.join(SRC, 'GameViewController.swift'), 'utf8');
  check(/openOutside\(url\) \}\s*\n\s*decisionHandler\(\.cancel\)/.test(gvc), '网页要去外面的网址：交给系统浏览器，网页里不打开');
  check(/requestMediaCapturePermissionFor[\s\S]{0,300}type == \.microphone && Bridge\.trusted\(origin\) \? \.grant : \.deny/.test(gvc), '麦克风只给自己的网页，摄像头一律不给');

  // ---------- 4. 会进仓库的文件里没有密钥 ----------
  let tracked = [];
  try {
    tracked = execFileSync('git', ['--no-optional-locks', 'ls-files', '-co', '--exclude-standard', '--', 'ios', 'tools/ios', '.github/workflows/ios-simulator.yml', '.github/workflows/ios-testflight.yml', 'tests/ios.test.js'],
      { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  } catch (e) { tracked = []; }
  check(tracked.length > 20, '用 git 列出 ios/ 里会进仓库的文件（' + tracked.length + ' 个）');
  check(!tracked.some(f => /^ios\/(Generated|www|\.sales-web)\//.test(f) || /\.xcodeproj\//.test(f) || /echo\.properties$/.test(f)),
    '生成的打包设置（Generated/）、复制进来的网页（www/）、工程文件、echo.properties 不进仓库', tracked.filter(f => /Generated|www\/|xcodeproj|properties/.test(f)));
  const ignored = f => { try { execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT }); return true; } catch (e) { return false; } };
  check(ignored('ios/Generated/BuildConfig.swift') && ignored('ios/www/index.html') && ignored('ios/EchoIsland.xcodeproj/project.pbxproj') && ignored('ios/echo.properties'),
    '.gitignore 挡住了 Generated/、www/、工程文件和 echo.properties');
  const PIN_SALT = 'echo-island-parent-pin-v1:';
  const knownVectors = new Set([sha('abc'), sha(PIN_SALT + '2468')]);   // 测试里公开的两个已知答案
  const leaks = [];
  for (const f of tracked) {
    if (/\.(png|jpg|jpeg|webp|glb|ogg|car|bin)$/i.test(f) || !fs.existsSync(path.join(ROOT, f))) continue;   // .bin：自测页的课程包小样（配音）
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of s.matchAll(/sk-[A-Za-z0-9]{16,}/g)) leaks.push(f + ': sk-…（' + m[0].length + ' 字）');
    for (const m of s.matchAll(/\b[0-9a-f]{64}\b/g)) if (!knownVectors.has(m[0])) leaks.push(f + ': 64 位十六进制');
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) leaks.push(f + ': 私钥');
    if (/DASHSCOPE_API_KEY\s*=\s*['"]?[A-Za-z0-9-]{12,}/.test(s)) leaks.push(f + ': DASHSCOPE_API_KEY=…');
    if (/PARENT_PIN\s*=\s*\d{4}\b/.test(s)) leaks.push(f + ': PARENT_PIN=…');
  }
  check(!leaks.length, 'ios/ 里会进仓库的文件没有像密钥 / 家长密码的字符串（只数、不打印）', leaks);

  // ---------- 5. copy-web.mjs 的白名单 = build.gradle 的 copyWeb ----------
  const CW = await import(pathToFileURL(path.join(IOS, 'scripts', 'copy-web.mjs')).href);
  const gradle = read('android/app/build.gradle');
  const copyWeb = gradle.slice(gradle.indexOf("tasks.register('copyWeb'"), gradle.indexOf("preBuild.dependsOn 'copyWeb'"));
  const quoted = s => [...s.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const gInc = quoted((copyWeb.match(/include ([^\n]+)/) || [])[1] || '');
  const gExc = quoted((copyWeb.match(/exclude ('android[^\n]+)/) || [])[1] || '');
  const gSwap = quoted((copyWeb.match(/if \(SALES\) \{\s*exclude ([^\n]+)/) || [])[1] || '');
  check(same(gInc, CW.INCLUDE), 'copy-web.mjs 的 INCLUDE 和 build.gradle 的 include 一字不差', { gradle: gInc, ios: CW.INCLUDE });
  check(same(gSwap, CW.SALES_SWAP), '销售版换掉的三个文件两边一样', { gradle: gSwap, ios: CW.SALES_SWAP });
  check(/reservedIds\.each \{ id -> exclude "assets\/mon3d\/\$\{id\}\.glb", "assets\/mon2d\/\$\{id\}\.webp", "assets\/mon3d\/\$\{id\}_\*", "assets\/mon2d\/\$\{id\}_\*" \}/.test(copyWeb),
    'build.gradle 销售版不复制保留怪兽的 .glb / .webp / <id>_*（copy-web.mjs 的 salesExcluded 照这个写）');
  // 按真的文件列表比：Gradle（Ant 的写法）会复制哪些 ↔ copy-web.mjs 会复制哪些
  const ant = p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*') + '$');
  const antDefault = r => r.split('/').some(seg => seg === '.DS_Store' || seg === '.gitignore' || seg === '.gitattributes' || seg.startsWith('._') || seg.endsWith('~') || /^#.*#$/.test(seg) || seg === '.git');
  const all = [];
  const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) { if (!rel && !['assets', 'vendor', 'isles', 'pages'].includes(e.name)) continue; walk(path.join(dir, e.name), r); } else if (e.isFile()) all.push(r); } };
  walk(ROOT, '');
  const ids = CW.reservedIds(ROOT);
  const gradleFiles = sales => all.filter(r => !antDefault(r) && gInc.some(p => ant(p).test(r)) && !gExc.some(p => ant(p).test(r)) &&
    !(sales && (gSwap.includes(r) || ids.some(id => ['assets/mon3d/' + id + '.glb', 'assets/mon2d/' + id + '.webp', 'assets/mon3d/' + id + '_*', 'assets/mon2d/' + id + '_*'].some(p => ant(p).test(r)))))).sort();
  for (const ed of ['family', 'sales']) {
    const mine = CW.webFiles(ed, { salesDir: path.join(IOS, '.sales-web') }).filter(f => !(ed === 'sales' && CW.SALES_SWAP.includes(f.rel) && f.src.includes('.sales-web'))).map(f => f.rel).sort();
    const g = gradleFiles(ed === 'sales');
    check(JSON.stringify(mine) === JSON.stringify(g), ed + '：copy-web.mjs 复制的文件和 Gradle 的 copyWeb 一模一样（' + mine.length + ' 个）', diff(mine, g));
  }
  check(ids.length > 0 && ids.every(id => /^[a-z]+$/.test(id)), '保留怪兽的 id 从 tools/mon3d/lookalike.txt 读得出来（' + ids.length + ' 只）');
  // 课程包模式（tools/pack/SPEC.md §6）：给了 ECHO_PACKS_URL，配音（assets/voice/f、m、index.json）不进包，别的一个不少；packs.js 在包里
  {
    const plain = CW.webFiles('sales', { salesDir: path.join(IOS, '.sales-web') }).map(f => f.rel);
    const pk = CW.webFiles('sales', { salesDir: path.join(IOS, '.sales-web'), packs: true }).map(f => f.rel);
    const voice = plain.filter(r => /^assets\/voice\/(f|m)\//.test(r) || r === 'assets/voice/index.json');
    check(voice.length > 10000 && !pk.some(r => CW.packsExcluded(r)) && JSON.stringify(plain.filter(r => !voice.includes(r))) === JSON.stringify(pk),
      '课程包模式：copy-web.mjs 不复制 assets/voice/f、m 和 index.json（少了 ' + voice.length + ' 个），别的文件一样', diff(plain.filter(r => !voice.includes(r)), pk));
    check(pk.includes('packs.js') && plain.includes('packs.js') && CW.requiredFiles(true).includes('packs.js') && !CW.requiredFiles(true).includes('assets/voice/index.json') &&
      CW.requiredFiles(false).includes('assets/voice/index.json'), '必备文件：老模式要 assets/voice/index.json；课程包模式不要它、要 packs.js');
    check(pk.includes('assets/voice/zh/ai-notice.ogg') === plain.includes('assets/voice/zh/ai-notice.ogg'), '课程包模式只拿掉英语配音那三样（assets/voice/zh 照旧）');
    // 安卓的 copyWeb 在给了 ECHO_PACKS_URL 时拿掉同样的三样：名单一字不差，按真的文件列表比一遍（家庭版、销售版各一次）
    const gPacks = quoted((gradle.match(/def PACKS_EXCLUDE = \[([^\]\n]+)\]/) || [])[1] || '');
    check(same(gPacks, CW.PACKS_EXCLUDE) && /if \(PACKS_URL\) exclude PACKS_EXCLUDE/.test(copyWeb), 'build.gradle 的 PACKS_EXCLUDE 和 copy-web.mjs 的一字不差，只在给了 ECHO_PACKS_URL 时用', { gradle: gPacks, ios: CW.PACKS_EXCLUDE });
    for (const ed of ['family', 'sales']) {
      const mine = CW.webFiles(ed, { salesDir: path.join(IOS, '.sales-web'), packs: true }).filter(f => !(ed === 'sales' && CW.SALES_SWAP.includes(f.rel) && f.src.includes('.sales-web'))).map(f => f.rel).sort();
      const g = gradleFiles(ed === 'sales').filter(r => !gPacks.some(p => ant(p).test(r)));
      check(JSON.stringify(mine) === JSON.stringify(g), ed + '（课程包模式）：copy-web.mjs 复制的文件和 Gradle 的 copyWeb 一模一样（' + mine.length + ' 个）', diff(mine, g));
    }
    const cwSrc = read('ios/scripts/copy-web.mjs');
    check(/process\.env\.ECHO_PACKS_URL/.test(cwSrc) && /requiredFiles\(packs\)/.test(cwSrc), 'copy-web.mjs 看环境变量 ECHO_PACKS_URL（和 make-config.mjs 同一个）决定配音进不进包');
  }

  // ---------- 6. make-config.mjs ----------
  const MC = await import(pathToFileURL(path.join(IOS, 'scripts', 'make-config.mjs')).href);
  check(MC.PIN_SALT === PIN_SALT && gradle.includes("def PIN_SALT = '" + MC.PIN_SALT + "'"), 'make-config.mjs 的盐和 build.gradle 一样');
  check(gradle.includes("'" + MC.DEFAULT_VER_URL + "'") && MC.DEFAULT_BOOKS === 'hj7a,hj7b', '检查新版本的默认地址、销售版默认开放的课本和安卓一样');
  const h2468 = sha(PIN_SALT + '2468');
  check(MC.pinHash('2468') === h2468, 'make-config.mjs 算的哈希 = 盐 + 密码的 SHA-256（和 build.gradle 一样）');
  const tests = read('ios/Tests/LogicTests.swift');
  check(tests.includes('knownHash = "' + h2468 + '"') && /private let salt = "echo-island-parent-pin-v1:"/.test(tests), 'Swift 的单元测试拿同一个已知答案核对 PinGuard（模拟器里跑）');
  const pg = fs.readFileSync(path.join(SRC, 'PinGuard.swift'), 'utf8');
  check(/SHA256\.hash\(data: Data\(s\.utf8\)\)/.test(pg) && /String\(format: "%02x"/.test(pg) && /sha256Hex\(activeSalt\(\) \+ pin\)/.test(pg),
    'PinGuard.swift：盐 + 密码按 UTF-8 算 SHA-256、小写十六进制（和 Java 一样）');
  const javaPg = read('android/app/src/main/java/com/echoisland/app/PinGuard.java');
  const nums = s => [...s.matchAll(/(TRIES|LOCK_MS|CHANGE_MS)\s*(?::\s*Int64)?\s*=\s*([\d\s*L]+)/g)].map(m => m[1] + '=' + eval(m[2].replace(/L/g, '')));   // eslint-disable-line no-eval
  check(JSON.stringify(nums(pg)) === JSON.stringify(nums(javaPg)) && nums(pg).length === 3, 'PinGuard 的次数、锁定时间、改密码的时限和 Java 一样', { swift: nums(pg), java: nums(javaPg) });
  const sales = MC.compute({ edition: 'sales', props: { KEY_FILE: 'whatever', PARENT_PIN: '2468', TALK_URL: 'wss://x', VER_URL: 'https://x' }, env: {} });
  check(sales.cfg.dashscopeKey === '' && sales.cfg.parentPinHash === '' && sales.cfg.talkUrl === '' && sales.cfg.talkCode === '' && sales.cfg.verUrl === '' && sales.cfg.books === 'hj7a,hj7b',
    '销售版：配置文件里有的密钥、密码、地址一律不读');
  check(/static let dashscopeKey = ""/.test(sales.swift) && /static let parentPinHash = ""/.test(sales.swift) && /static let edition = "sales"/.test(sales.swift), '销售版生成的 BuildConfig.swift 里这几样是空的');
  for (const k of MC.SECRET_ENV) {
    let threw = '';
    try { MC.compute({ edition: 'sales', env: { [k]: k === 'ECHO_PARENT_PIN' ? '2468' : 'x' } }); } catch (e) { threw = e.message; }
    check(/Sales edition must not/.test(threw), '销售版给了 ' + k + ' 就停下', threw);
  }
  const fam = MC.compute({ edition: 'family', env: { ECHO_PARENT_PIN: '2468', ECHO_DASHSCOPE_KEY: 'test-value-not-a-key' } });
  check(fam.cfg.parentPinHash === h2468 && !fam.swift.includes('"2468"') && !fam.xcconfig.includes('2468') && fam.cfg.edition === 'family' && /\.family/.test(fam.xcconfig),
    '家庭版：家长密码只放哈希（原文不进生成的文件），App 标识后面加 .family');
  check(!/test-value-not-a-key/.test(fam.summary), '打印的那一行不带密钥（只说有 / 没有）', fam.summary);
  let threw = '';
  try { MC.compute({ edition: 'family', env: {}, release: true }); } catch (e) { threw = e.message; }
  check(/PARENT_PIN/.test(threw), '家庭版的正式包没有家长密码就停下（和安卓一样）');
  threw = '';
  try { MC.compute({ edition: 'family', env: { ECHO_PARENT_PIN: '12a4' } }); } catch (e) { threw = e.message; }
  check(/4 digits/.test(threw) && !threw.includes('12a4'), '家长密码不是 4 位数字就停下，报错里不带密码本身');
  const fixed = MC.compute({ edition: 'sales', env: { ECHO_VERSION_CODE: '77' } });
  check(fixed.cfg.versionCode === 77 && /^\d{8}-/.test(fixed.cfg.versionName) && /-s$/.test(fixed.cfg.versionName), '构建号能用 ECHO_VERSION_CODE 指定；版本名 = 日期-短哈希，销售版末尾 -s', fixed.cfg.versionName);
  const auto = MC.compute({ edition: 'sales', env: {} });
  check(auto.cfg.versionCode >= 1, '没指定时构建号 = git 提交数（浅克隆 / 没有 git 时退回 1，不报错）', auto.cfg.versionCode);
  const mcSrc = read('ios/scripts/make-config.mjs');
  check(/is-shallow-repository/.test(mcSrc) && /rev-list', '--count', 'HEAD'/.test(mcSrc), '浅克隆（云上 CI）数不出提交数时有退路');
  check(!/console\.log\([^)]*\b(key|hash|pin)\b\)/.test(mcSrc), 'make-config.mjs 不打印密钥、哈希、密码');
  // App 标识只写在 Config/Base.xcconfig 一处，和安卓的包名一样；订阅的商品编号跟着它
  const baseXc = read('ios/Config/Base.xcconfig');
  check(MC.DEFAULT_BUNDLE_ID === 'com.echoisland.app' && /^ECHO_BUNDLE_ID = com\.echoisland\.app$/m.test(baseXc) && gradle.includes("'com.echoisland.app'"),
    'App 标识 com.echoisland.app（和安卓的包名一样），只写在 Config/Base.xcconfig，make-config.mjs 从那里读', MC.DEFAULT_BUNDLE_ID);
  check(auto.cfg.iapMonthly === 'com.echoisland.app.premium.monthly' && auto.cfg.iapYearly === 'com.echoisland.app.premium.yearly' && auto.cfg.appleSignIn === false &&
    /static let iapMonthly = "com\.echoisland\.app\.premium\.monthly"/.test(auto.swift) && /static let appleSignIn: Bool = false/.test(auto.swift) && !/CODE_SIGN_ENTITLEMENTS/.test(auto.xcconfig),
    '默认（云上的模拟器包）：商品编号 = App 标识 + .premium.monthly / .yearly，不带「通过 Apple 登录」的权限');
  const famIap = MC.compute({ edition: 'family', env: { ECHO_PARENT_PIN: '2468' } });
  check(famIap.cfg.iapMonthly === 'com.echoisland.app.family.premium.monthly', '家庭版的商品编号跟着它自己的 App 标识（.family）', famIap.cfg.iapMonthly);
  const salesIap = MC.compute({ edition: 'sales', env: { ECHO_IAP_MONTHLY: 'echo_monthly', ECHO_IAP_YEARLY: 'echo.yearly', ECHO_BUNDLE_ID: 'com.example.other' } });
  check(salesIap.cfg.iapMonthly === 'echo_monthly' && salesIap.cfg.iapYearly === 'echo.yearly', '销售版可以给商品编号（不是秘密，安全检查不拦）');
  check(MC.compute({ edition: 'sales', env: { ECHO_BUNDLE_ID: 'com.example.other' } }).cfg.iapYearly === 'com.example.other.premium.yearly', '换了 App 标识，默认的商品编号跟着换');
  for (const bad of [{ ECHO_IAP_MONTHLY: 'has space' }, { ECHO_IAP_YEARLY: 'a-b' }, { ECHO_IAP_MONTHLY: 'same', ECHO_IAP_YEARLY: 'same' }, { ECHO_APPLE_SIGNIN: 'maybe' }]) {
    let t = '';
    try { MC.compute({ edition: 'sales', env: bad }); } catch (e) { t = e.message; }
    check(!!t, '写错就停下：' + JSON.stringify(bad), t);
  }
  const signed = MC.compute({ edition: 'sales', env: { ECHO_TEAM_ID: 'ABCDE12345' } });
  check(signed.cfg.appleSignIn === true && /^CODE_SIGN_ENTITLEMENTS = App\/EchoIsland\.entitlements$/m.test(signed.xcconfig) && /static let appleSignIn: Bool = true/.test(signed.swift),
    '给了团队编号（要签名的包）：默认带「通过 Apple 登录」的权限，BuildConfig.appleSignIn = true');
  const off = MC.compute({ edition: 'sales', env: { ECHO_TEAM_ID: 'ABCDE12345', ECHO_APPLE_SIGNIN: '0' } });
  check(off.cfg.appleSignIn === false && !/CODE_SIGN_ENTITLEMENTS/.test(off.xcconfig), 'ECHO_APPLE_SIGNIN=0：签名的包也不带（TestFlight 工作流里苹果不肯给权限时用）');
  check(fs.existsSync(path.join(IOS, 'App', 'EchoIsland.entitlements')), 'CODE_SIGN_ENTITLEMENTS 指的文件在（路径相对 ios/）');
  // 云端模式（account.js）：ECHO_CLOUD_URL 不是秘密，销售版也能给；BuildConfig.cloudUrl → GameViewController 的启动对象 → window.__ECHO_BOOT.cloudUrl
  check(auto.cfg.cloudUrl === '' && /static let cloudUrl = ""/.test(auto.swift), '没给 ECHO_CLOUD_URL：cloudUrl 是空的（不是云端模式，和以前一样）');
  const cl = MC.compute({ edition: 'sales', env: { ECHO_CLOUD_URL: 'https://api.example.com/v1/' } });
  check(cl.cfg.cloudUrl === 'https://api.example.com' && /static let cloudUrl = "https:\/\/api\.example\.com"/.test(cl.swift) && cl.cfg.dashscopeKey === '' && cl.cfg.talkUrl === '',
    '销售版可以给 ECHO_CLOUD_URL（不是秘密，不拦），末尾的 / 和 /v1 去掉', cl.cfg.cloudUrl);
  check(!MC.SECRET_ENV.includes('ECHO_CLOUD_URL'), 'ECHO_CLOUD_URL 不在「只有家庭版能给」的名单里');
  for (const bad of ['http://api.example.com', 'ftp://x', 'https://x.example/?token=1', 'javascript:alert(1)']) {
    let t = '';
    try { MC.compute({ edition: 'sales', env: { ECHO_CLOUD_URL: bad } }); } catch (e) { t = e.message; }
    check(/ECHO_CLOUD_URL/.test(t), 'ECHO_CLOUD_URL 写错就停下：' + bad, t);
  }
  check(MC.compute({ edition: 'sales', env: { ECHO_CLOUD_URL: 'http://localhost:8787' } }).cfg.cloudUrl === 'http://localhost:8787', '本机试的 http://localhost:端口 也认');
  const gvcSrc = fs.readFileSync(path.join(SRC, 'GameViewController.swift'), 'utf8');
  check(/"cloudUrl":\s*BuildConfig\.cloudUrl/.test(gvcSrc) && /window\.__ECHO_BOOT=/.test(gvcSrc), 'GameViewController 的启动对象里有 cloudUrl（网页的 account.js 从 window.__ECHO_BOOT 读）');
  const acSrc = read('account.js');
  check(/__ECHO_BOOT/.test(acSrc) && /cloudUrl/.test(acSrc), 'account.js 读启动对象里的 cloudUrl');
  // 课程包（packs.js）：ECHO_PACKS_URL → BuildConfig.packsUrl → 启动对象 packsUrl（和 cloudUrl 同一条路）
  check(auto.cfg.packsUrl === '' && /static let packsUrl = ""/.test(auto.swift) && /课程包：没有/.test(auto.summary), '没给 ECHO_PACKS_URL：packsUrl 是空的（配音打进包里，和以前一样）');
  const pu = MC.compute({ edition: 'sales', env: { ECHO_PACKS_URL: 'https://packs.example.com/' } });
  check(pu.cfg.packsUrl === 'https://packs.example.com' && /static let packsUrl = "https:\/\/packs\.example\.com"/.test(pu.swift) && pu.cfg.dashscopeKey === '',
    '销售版可以给 ECHO_PACKS_URL（不是秘密），末尾的 / 去掉');
  check(MC.compute({ edition: 'family', env: { ECHO_PARENT_PIN: '2468', ECHO_PACKS_URL: 'https://p.example.com/packs' } }).cfg.packsUrl === 'https://p.example.com/packs' && !MC.SECRET_ENV.includes('ECHO_PACKS_URL'),
    '家庭版也认 ECHO_PACKS_URL（带路径也行），它不在「只有家庭版能给」的名单里');
  for (const bad of ['http://packs.example.com', 'ftp://x', 'https://x.example/?v=1', 'javascript:alert(1)']) {
    let t = '';
    try { MC.compute({ edition: 'sales', env: { ECHO_PACKS_URL: bad } }); } catch (e) { t = e.message; }
    check(/ECHO_PACKS_URL/.test(t), 'ECHO_PACKS_URL 写错就停下：' + bad, t);
  }
  check(/"packsUrl":\s*BuildConfig\.packsUrl/.test(gvcSrc), 'GameViewController 的启动对象里有 packsUrl（网页的 packs.js 从 window.__ECHO_BOOT 读）');
  const pkSrc = read('packs.js');
  check(/boot\.packsUrl/.test(pkSrc) && /__ECHO_BOOT/.test(pkSrc) && /ECHO_PACKS_URL/.test(pkSrc), 'packs.js 读启动对象里的 packsUrl，再看 window.ECHO_PACKS_URL、?packs=');
  {
    const wfs = read('.github/workflows/ios-simulator.yml'), wtf = read('.github/workflows/ios-testflight.yml');
    check(/^\s+ECHO_PACKS_URL: \$\{\{ vars\.ECHO_PACKS_URL \}\}$/m.test(wfs), '模拟器工作流：ECHO_PACKS_URL 从仓库变量 vars.ECHO_PACKS_URL 取（空 = 配音打进包里）');
    check(/^\s+ECHO_PACKS_URL: \$\{\{ \(inputs\.edition \|\| 'sales'\) == 'sales' && vars\.ECHO_PACKS_URL \|\| '' \}\}$/m.test(wtf), 'TestFlight 工作流：只有销售版从仓库变量取 ECHO_PACKS_URL，家庭版一直打进包里');
  }
  // 自测页、UI 测试、小样（ios/www-test/packs）
  {
    const st = read('ios/www-test/selftest.html'), ui = read('ios/UITests/SmokeUITests.swift');
    check(/run === 'packs'\) await packs\(\)/.test(st) && /run === 'packs2'\) await packs2\(\)/.test(st) && /packsUrl: '\/__test\/packs'/.test(st) && /idbArrayBuffer/.test(st) && /idbKept/.test(st) && /'ended'/.test(st),
      '自测页 run=packs / packs2：IndexedDB 存 ArrayBuffer、重开还在；从 /__test/packs 装小样；blob: 地址放得出声（ended）');
    check(/test8CoursePackInstallAndRelaunch/.test(ui) && /\["packs", "packs2"\]/.test(ui) && /app\.terminate\(\)/.test(ui), 'UI 测试第 8 个：run=packs 装、关掉 App、run=packs2 再看');
    const fx = path.join(IOS, 'www-test', 'packs');
    let cat = null, man = null;
    try { cat = JSON.parse(read('ios/www-test/packs/catalog.json')); man = JSON.parse(read('ios/www-test/packs/en/' + cat.packs.en.ver + '/manifest.json')); } catch (e) { cat = null; }
    check(!!man && man.files.length >= 2 && man.files.some(f => f.core) && man.files.every(f => fs.existsSync(path.join(fx, 'en', cat.packs.en.ver, f.name))) &&
      fs.readdirSync(fx).length <= 3 && man.files.reduce((s, f) => s + f.bytes, 0) < 200000, 'ios/www-test/packs：tools/pack/build.js --only 打的小样（几十 KB，有 core 有后面的）', man && man.files.map(f => f.name + ' ' + f.bytes));
  }

  // ---------- 7. 云上的工作流 ----------
  const wfText = read('.github/workflows/ios-simulator.yml');
  let wf = null, wfErr = '';
  try { wf = parseYaml(wfText); } catch (e) { wfErr = e.message; }
  check(!!wf && !wfErr, '.github/workflows/ios-simulator.yml 读得出来（YAML）', wfErr);
  if (wf) {
    const on = wf.on || {}, push = on.push || {};
    check((push.branches || []).includes('echo-island/next'), '推到 echo-island/next 时跑');
    check(same(push.paths || [], ['ios/**', '.github/workflows/ios-simulator.yml', 'tools/ios/**']), '只在 ios/、这个工作流、tools/ios/ 变了的时候跑', push.paths);
    check('workflow_dispatch' in on, '也能手动点着跑（workflow_dispatch）');
    const job = Object.values(wf.jobs || {})[0] || {};
    check(job['runs-on'] === 'macos-26' && /Xcode_26\.\d+(\.\d+)?\.app/.test((job.env || {}).DEVELOPER_DIR || ''), '用 macos-26 的 Mac、写明了 Xcode 的版本', { runsOn: job['runs-on'], dev: (job.env || {}).DEVELOPER_DIR });
    const steps = job.steps || [];
    const stepWith = re => steps.find(s => re.test(String(s.run || '') + ' ' + String(s.uses || '')));
    const co = stepWith(/actions\/checkout/);
    check(!!co && co.with && co.with['fetch-depth'] === 1, '浅克隆（fetch-depth: 1）');
    const order = [/brew install xcodegen/, /ios\/scripts\/prepare\.mjs/, /xcodegen generate/, /build-for-testing/, /-only-testing:EchoIslandTests/, /-only-testing:EchoIslandUITests/].map(re => steps.indexOf(stepWith(re)));
    check(order.every(i => i >= 0) && order.every((v, i) => !i || v > order[i - 1]), '步骤分开、按顺序：装 XcodeGen → prepare → xcodegen → 编译 → 单元测试 → UI 测试', order);
    const xb = steps.filter(s => /xcodebuild (build|test)/.test(String(s.run || '')));
    check(xb.length === 5 && xb.every(s => /set -o pipefail/.test(s.run) && /tee "\$OUT\//.test(s.run)), '每次编译、测试都把完整日志存下来（pipefail，失败不会被管道吞掉）', xb.length);
    check(steps.filter(s => /resultBundlePath/.test(String(s.run || ''))).length === 3, '单元测试、StoreKit 测试、UI 测试各存一份 .xcresult');
    const unit = stepWith(/-only-testing:EchoIslandTests /), sk = stepWith(/-only-testing:EchoIslandTests\/StoreKitTests/);
    check(!!unit && /-skip-testing:EchoIslandTests\/StoreKitTests/.test(unit.run) && !!sk && /pick-simulator\.mjs --prefer 26\.2,26\.1/.test(sk.run) && /-destination "id=\$udid"/.test(sk.run) &&
      steps.indexOf(sk) > steps.indexOf(unit) && steps.indexOf(sk) < steps.indexOf(stepWith(/-only-testing:EchoIslandUITests/)),
      'StoreKit 测试单独一步、挑 iOS 26.2 / 26.1 的模拟器（26.5 上 SKTestSession 不管用），别的单元测试那一步跳过它');
    check(/for r in unit-tests storekit-tests ui-tests/.test(String((stepWith(/xcresulttool export attachments/) || {}).run || '')), 'StoreKit 测试的截图、附件也导出来');
    const up = stepWith(/actions\/upload-artifact/), ex = stepWith(/xcresulttool export attachments/);
    check(!!up && up.if === 'always()' && /\.xcresult/.test(up.with.path) && /attachments/.test(up.with.path) && /\.log/.test(up.with.path) && !!ex && ex.if === 'always()',
      '不管成没成都上传：日志、.xcresult、截图');
    check(!/secrets\.|ECHO_DASHSCOPE_KEY|ECHO_PARENT_PIN|ECHO_TEAM_ID/.test(wfText) && (job.env || {}).ECHO_EDITION === 'sales', '工作流里不用任何密钥、不签名，打的是销售版');
    check(stepWith(/tests\/ios\.test\.js/) !== undefined, '云上也先跑一遍这个文件');
  }

  // ---------- 7b. 传 TestFlight 的工作流 ----------
  const tfText = read('.github/workflows/ios-testflight.yml');
  let tf = null, tfErr = '';
  try { tf = parseYaml(tfText); } catch (e) { tfErr = e.message; }
  check(!!tf && !tfErr, '.github/workflows/ios-testflight.yml 读得出来（YAML）', tfErr);
  if (tf) {
    const on = tf.on || {};
    // 手动点，或者推一个 testflight-* 标签（这个仓库的默认分支不是游戏，手动点的工作流 GitHub 认不到）；推分支、推别的标签都不传
    const push = on.push || null, tags = push && push.tags || [];
    check(same(Object.keys(on).sort(), ['push', 'workflow_dispatch']) && push && !push.branches && !push.paths && same(tags, ['testflight-*']),
      '只能手动点（workflow_dispatch）或推 testflight-* 标签才传，推代码不会自己传', on);
    const inp = (on.workflow_dispatch || {}).inputs || {};
    check(inp.edition && inp.edition.default === 'sales' && same(inp.edition.options || [], ['sales', 'family']) && inp.version && inp.version.default === '' && inp.apple_signin && inp.apple_signin.type === 'boolean',
      '输入：版本（默认 sales）、可选的版本号、要不要「通过 Apple 登录」', inp);
    check(tf.concurrency && tf.concurrency['cancel-in-progress'] === false, '不取消正在传的（后来的排队）');
    const jobs = tf.jobs || {}, sj = jobs.secrets || {}, job = jobs.testflight || {};
    check(sj['runs-on'] === 'ubuntu-latest' && job.needs === 'secrets' && job['runs-on'] === 'macos-26', '先在 Linux 上看密钥都放了，再用 Mac');
    const sjRun = String(((sj.steps || [])[0] || {}).run || '');
    check(['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_P8', 'APPLE_TEAM_ID'].every(k => sjRun.includes(k)) && !/echo[^\n]*\$\{?(ASC_KEY_P8|ASC_KEY_ID|ASC_ISSUER_ID|APPLE_TEAM_ID)\b/.test(sjRun),
      '四个密钥都查了，只打印名字');
    check(!JSON.stringify(job.env || {}).includes('secrets.'), '密钥不放在整个 job 上（xcodebuild 会把环境变量写进日志），只给要用的那几步');
    const ts = job.steps || [];
    const at = re => ts.findIndex(s => re.test(String(s.run || '') + ' ' + String(s.uses || '') + ' ' + String(s.name || '')));
    const order = [/tests\/ios\.test\.js/, /prepare\.mjs/, /Simulator launch check/, /xcodebuild archive/, /Check the signed app/, /xcrun altool --upload-app/, /actions\/upload-artifact/].map(at);
    check(order.every(i => i >= 0) && order.every((v, i) => !i || v > order[i - 1]), '顺序：静态核对 → 准备 → 模拟器里打开看一眼 → archive / 签名 → 看签好的包 → 上传 → 只传日志', order);
    const sim = ts[order[2]] || {};
    check(/-configuration Release/.test(sim.run) && /simctl launch/.test(sim.run) && /launchctl list/.test(sim.run) && /page load failed/.test(sim.run), '模拟器检查：正式包的设置、装上打开、还在跑、网页打开了');
    const arch = ts[order[3]] || {}, up = ts[order[5]] || {};
    check(/-allowProvisioningUpdates -authenticationKeyPath "\$key" -authenticationKeyID "\$ASC_KEY_ID" -authenticationKeyIssuerID "\$ASC_ISSUER_ID"/.test(arch.run) &&
      /<key>method<\/key><string>app-store-connect<\/string>/.test(arch.run) && /CODE_SIGN_IDENTITY=- /.test(arch.run) && /AD_HOC_CODE_SIGNING_ALLOWED=YES/.test(arch.run) && /DEVELOPMENT_TEAM="\$APPLE_TEAM_ID"/.test(arch.run),
      'archive 临时签名、export 用 API 密钥让苹果云签名（method app-store-connect、自动签名）');
    check(/archive 1 && export_to export/.test(arch.run) && /archive 0/.test(arch.run) && /Sign In with Apple/.test(arch.run), '苹果不肯给「通过 Apple 登录」就不带它再签一次，并说老板要去后台勾哪里');
    const xcLines = tfText.split(/\r?\n/).filter(l => !/^\s*#/.test(l) && /\bxcodebuild (archive|-exportArchive)/.test(l));
    check(xcLines.length >= 3 && xcLines.every(l => /"\$\{clean\[@\]\}" xcodebuild/.test(l)) && /clean=\(env -u ASC_KEY_P8 -u ASC_KEY_ID -u ASC_ISSUER_ID/.test(tfText),
      '带着密钥的步骤里 xcodebuild 都先去掉密钥的环境变量再跑', xcLines);
    check(/trap 'rm -f "\$key"/.test(arch.run) && /trap 'rm -f "\$key"; rm -rf "\$keys"'/.test(up.run) && /chmod 600/.test(arch.run), '.p8 写在临时文件夹、用完就删');
    check(/API_PRIVATE_KEYS_DIR="\$keys" xcrun altool --upload-app --type ios --file "\$ipa" --apiKey "\$ASC_KEY_ID" --apiIssuer "\$ASC_ISSUER_ID"/.test(up.run) && /<string>upload<\/string>/.test(up.run),
      '用 altool + API 密钥传，不行再用 xcodebuild 的上传');
    const bn = ts.find(s => /Build number/.test(String(s.name || ''))) || {};
    check(/Date\.UTC\(2026, 0, 1\)\) \/ 60000/.test(bn.run) && /ECHO_VERSION_CODE=\$n/.test(bn.run) && /CURRENT_PROJECT_VERSION="\$ECHO_VERSION_CODE"/.test(arch.run),
      '构建号 = 2026-01-01（UTC）以来的分钟数（和老板另一个 App 一样，只增不减）');
    const art = ts[order[6]] || {}, scrub = ts.find(s => /Scrub/.test(String(s.name || ''))) || {};
    check(art.if === 'always()' && /^ios-ci\/\*\.log\nios-ci\/\*\.txt\n?$/.test(String((art.with || {}).path || '')) && !/ipa|xcarchive|export|\.p8/.test(String((art.with || {}).path || '')),
      '只上传日志：.ipa、.xcarchive、签过名的东西不传（仓库是公开的）', (art.with || {}).path);
    check(ts.indexOf(scrub) >= 0 && ts.indexOf(scrub) < order[6] && scrub.if === 'always()' && /APPLE_TEAM_ID/.test(scrub.run) && /PRIVATE KEY/.test(scrub.run),
      '上传前把团队编号、密钥编号从日志里抹掉，提到私钥的日志不传');
    check(!/set -x|cat "\$key"|echo "\$ASC_KEY_P8|printenv|env \|/.test(tfText), '不打印密钥（没有 set -x、cat 密钥、printenv）');
  }

  // ---------- 8. 工程和 Swift 里容易出错的几处 ----------
  const proj = read('ios/project.yml');
  check(/SWIFT_VERSION: "5\.0"/.test(proj) && /SWIFT_STRICT_CONCURRENCY: minimal/.test(proj), 'Swift 的语言版本钉在 5（Xcode 换默认值也不会突然编不过）');
  check(/iOS: "18\.4"/.test(proj), '最低 iOS 18.4（第一个能放 Ogg 里的 Opus 配音的版本）');
  // 只做 iPhone 要写在 App 的 target 里（XcodeGen 给 target 的默认值是 "1,2"，会盖掉工程级的设置；带着 iPad 传 TestFlight 被退回过：90474）
  check(/\n  EchoIsland:\s*\n\s*type: application[\s\S]*?\n        TARGETED_DEVICE_FAMILY: "1"[\s\S]*?\n    postBuildScripts:/.test(proj), 'project.yml：App 的 target 自己写着只做 iPhone（TARGETED_DEVICE_FAMILY "1"）');
  check(/Release:\s*\n\s*EXCLUDED_SOURCE_FILE_NAMES: www-test/.test(proj) && /rm -rf "\$\{TARGET_BUILD_DIR\}\/\$\{UNLOCALIZED_RESOURCES_FOLDER_PATH\}\/www-test"/.test(proj), '正式包不带原生桥自测页（两道）');
  check(/EchoIslandUITests:[\s\S]*type: bundle\.ui-testing/.test(proj) && /EchoIslandTests:[\s\S]*type: bundle\.unit-test/.test(proj), '有单元测试和 UI 测试两个 target');
  const wkSig = [/decidePolicyFor navigationAction: WKNavigationAction,\s*decisionHandler: @escaping @MainActor @Sendable \(WKNavigationActionPolicy\) -> Void\)/,
    /type: WKMediaCaptureType,\s*decisionHandler: @escaping @MainActor @Sendable \(WKPermissionDecision\) -> Void\)/,
    /runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String\?,\s*initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable \(String\?\) -> Void\)/,
    /runJavaScriptAlertPanelWithMessage message: String,\s*initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable \(\) -> Void\)/,
    /runJavaScriptConfirmPanelWithMessage message: String,\s*initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable \(Bool\) -> Void\)/];
  check(wkSig.every(re => re.test(gvc)), 'WebKit 回调的写法和 iOS SDK 一字不差（@MainActor @Sendable；写错了不报错、只是不被调用）', wkSig.map(re => re.test(gvc)));
  check(/#if DEBUG\s*\n\s*w\.isInspectable = true/.test(gvc) && (gvc.match(/isInspectable/g) || []).length === 1, '网页检查器只有调试包能连');
  check(/webViewWebContentProcessDidTerminate/.test(gvc) && /goneAt\.count >= 3/.test(gvc) && /recovered = true/.test(gvc), '网页进程挂了重建、带「刚恢复」的标记，2 分钟挂 3 次显示出错画面');
  check(/bounces = false/.test(gvc) && /allowsLinkPreview = false/.test(gvc) && /pinchGestureRecognizer\?\.isEnabled = false/.test(gvc) && /prefersStatusBarHidden: Bool \{ return true \}/.test(gvc),
    '不回弹、不出链接预览、不缩放、不显示状态栏');
  const wah = fs.readFileSync(path.join(SRC, 'WebAssetHandler.swift'), 'utf8');
  check(/live\.insert\(key\)/.test(wah) && /self\.live\.remove\(key\) != nil else \{ return \}/.test(wah) && /func webView\(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask\) \{\s*live\.remove/.test(wah),
    '请求被 WebKit 叫停以后不再回（不然 App 会崩）');
  check(['"ogg": "audio/ogg"', '"glb": "model/gltf-binary"', '"webp": "image/webp"', '"json": "application/json; charset=utf-8"', '"woff2": "font/woff2"'].every(s => wah.includes(s)) && /206/.test(wah) && /Content-Range/.test(wah),
    '类型对（ogg / glb / webp / json / 字体），带 Range 的回 206');
  const audio = fs.readFileSync(path.join(SRC, 'AppAudio.swift'), 'utf8');
  check(/\.playAndRecord/.test(audio) && /\.defaultToSpeaker/.test(audio) && /allowBluetoothA2DP/.test(audio) && /rawValue: 0x4/.test(audio) && /interruptionNotification/.test(gvc),
    '声音：边录边放、默认扬声器、蓝牙、来电打断以后接上');
  check(/isIdleTimerDisabled = true/.test(read('ios/App/Sources/AppDelegate.swift')), '玩的时候屏幕常亮');
  const selftest = read('ios/www-test/selftest.html');
  check(names.every(n => selftest.includes(n + ':') && (selftest.includes('N.' + n + '(') || n === 'openAppSettings' || n === 'backupPick')), '原生桥自测页认得每个方法、都调到（离开 App / 弹界面的两个另有按钮和 run=pick）',
    names.filter(n => !selftest.includes('N.' + n + '(')));
  check(/no real AI|不会真的连 AI/.test(selftest) && /if \(!N\.hasKey\(\)\)/.test(selftest), '自测页不真的连 AI（只在没有密钥时测那两个，原生当场回 401）');
  check(IOSN.every(n => selftest.includes(n + ": ['" + IOS_ONLY[n][0] + "', " + IOS_ONLY[n][1] + ']') && selftest.includes('N.' + n + '(')) &&
    selftest.includes("var IOS_ONLY = ['" + IOSN.join("', '") + "']"),
    '自测页认得 iPhone 才有的每个方法（种类、参数个数和 IOS_ONLY 一样），都调得到（弹系统界面的几个在按钮里）', IOSN.filter(n => !selftest.includes('N.' + n + '(')));
  check(/failed\(r, 'bad-token'\)/.test(selftest) && /failed\(r, 'unavailable'\)/.test(selftest) && /run === 'store'/.test(selftest), '自测页：当场回的（不是 UUID、这个包没有登录权限）一定要对；run=store 问商品');
  const uiSrc = read('ios/UITests/SmokeUITests.swift');
  check(/test6StoreProductsAndBuySheet/.test(uiSrc) && /"-EchoSelfTest", "store"/.test(uiSrc), 'UI 测试：订阅的商品问得到（异步桥一路通）、有商品就看购买面板');

  // ---------- 9. 订阅（StoreKit 2）和「通过 Apple 登录」 ----------
  const store = fs.readFileSync(path.join(SRC, 'Store.swift'), 'utf8');
  const apple = fs.readFileSync(path.join(SRC, 'AppleSignIn.swift'), 'utf8');
  const finishBody = store.slice(store.indexOf('func finish('), store.indexOf('\n    }\n', store.indexOf('func finish(')));
  check((store.match(/\.finish\(\)/g) || []).length === 1 && /await tx\.finish\(\)/.test(finishBody),
    'finish() 只在 iapFinish 里调（网页说服务器存好了才 finish；没 finish 的苹果下次打开再给）');
  check(/for await r in Transaction\.updates/.test(store) && /Store\.shared\.start\(\)/.test(read('ios/App/Sources/AppDelegate.swift')),
    '一开 App 就听 Transaction.updates（AppDelegate 里 start）');
  check(/\.appAccountToken\(uuid\)/.test(store) && /UUID\(uuidString:/.test(store) && /"bad-token"/.test(store), '买的时候带上账号的 UUID（appAccountToken），不是 UUID 就不买');
  check(/case \.userCancelled:\s*\n\s*return \.ok\(\["status": "cancelled"\]\)/.test(store) && /case \.pending:\s*\n\s*return \.ok\(\["status": "pending"\]\)/.test(store) &&
    /"unverified"/.test(store) && /StoreKitError, case \.userCancelled = e \{ return \.ok\(\["status": "cancelled"\]\) \}/.test(store),
    '买的结果分开回：purchased / unverified / pending（家长批准）/ cancelled（包括抛出来的取消）');
  check(/jwsRepresentation/.test(store) && /AppStore\.sync\(\)/.test(store) && /Transaction\.currentEntitlements/.test(store) && /Transaction\.unfinished/.test(store) &&
    /AppStore\.showManageSubscriptions\(in: s\)/.test(store) && /purchase\(confirmIn: vc, options: opts\)/.test(store),
    'StoreKit 2：jws、恢复（sync）、有效的订阅、没 finish 的、管理订阅面板、在游戏画面上弹购买确认');
  check(/static let shared = Store\(monthly: BuildConfig\.iapMonthly, yearly: BuildConfig\.iapYearly\)/.test(store), '商品编号来自打包设置（make-config.mjs）');
  const appleSig = [/nonisolated func authorizationController\(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization\)/,
    /nonisolated func authorizationController\(controller: ASAuthorizationController, didCompleteWithError error: Error\)/,
    /nonisolated func presentationAnchor\(for controller: ASAuthorizationController\) -> ASPresentationAnchor/];
  check(appleSig.every(re => re.test(apple)), '「通过 Apple 登录」的回调写法和 SDK 一字不差（写错了不报错、只是不被调用）', appleSig.map(re => re.test(apple)));
  check(/req\.nonce = AppleSignIn\.sha256Hex\(n\)/.test(apple) && /requestedScopes = \[\.fullName, \.email\]/.test(apple) && /SHA256\.hash/.test(apple),
    '请求里放的是 nonce 的 SHA-256（服务器拿原文核对，cloud/API.md §3）');
  const signInBody = apple.slice(apple.indexOf('func signIn('), apple.indexOf('ASAuthorizationController(authorizationRequests'));
  check(/guard AppleSignIn\.available else/.test(signInBody) && /"unavailable"/.test(signInBody) && /static var available: Bool \{ return BuildConfig\.appleSignIn \}/.test(apple) &&
    /getCredentialState\(forUserID:/.test(apple) && /guard AppleSignIn\.available else/.test(apple.slice(apple.indexOf('func credentialState('))),
    '没带权限的包：两个方法都当场回 unavailable，不碰系统');
  check(/case \.revoked: return "revoked"/.test(apple) && /\{"cancelled":true\}/.test(apple), '取消回 {cancelled:true}；Apple ID 停用了回 revoked');

  // 本地 App Store（Store.storekit）：两个自动续期订阅在同一个组，商品编号 = 默认的那两个，价格 8.99 / 59.99，年度的例子是 7 天免费试用
  let kit = null;
  try { kit = JSON.parse(read('ios/App/Store.storekit')); } catch (e) { kit = null; }
  const groups = (kit && kit.subscriptionGroups) || [], subs = groups.length === 1 ? groups[0].subscriptions || [] : [];
  const sub = id => subs.find(s => s.productID === id) || {};
  const mo = sub(auto.cfg.iapMonthly), yr = sub(auto.cfg.iapYearly);
  check(!!kit && groups.length === 1 && subs.length === 2 && subs.every(s => s.type === 'RecurringSubscription' && s.subscriptionGroupID === groups[0].id),
    'Store.storekit：一个订阅组、两个自动续期订阅');
  check(mo.displayPrice === '8.99' && mo.recurringSubscriptionPeriod === 'P1M' && yr.displayPrice === '59.99' && yr.recurringSubscriptionPeriod === 'P1Y',
    'Store.storekit：月度 8.99 / 每月，年度 59.99 / 每年，商品编号和 make-config.mjs 默认的一样', { mo: mo.productID, yr: yr.productID });
  check(!!yr.introductoryOffer && yr.introductoryOffer.paymentMode === 'free' && yr.introductoryOffer.subscriptionPeriod === 'P1W' && !mo.introductoryOffer,
    'Store.storekit：年度带 7 天免费试用（例子），月度没有');
  check(kit && kit.settings && kit.settings._storefront === 'USA' && kit.settings._locale === 'en_US' && !('_developerTeamID' in kit.settings), 'Store.storekit：美国区、英文，没有团队编号');
  check(/run:\s*\n\s*config: Debug\s*\n(\s*#[^\n]*\n)?\s*storeKitConfiguration: App\/Store\.storekit/.test(proj) &&
    /EchoIslandTests:[\s\S]*?- path: App\/Store\.storekit\s*\n\s*buildPhase: resources/.test(proj),
    'project.yml：Xcode 里运行用本地 App Store；单元测试包里带一份 Store.storekit（SKTestSession 读它）');

  // 挑模拟器的小脚本
  const PS = await import(pathToFileURL(path.join(IOS, 'scripts', 'pick-simulator.mjs')).href);
  const fake = { devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [{ udid: 'U265', name: 'iPhone 17', isAvailable: true }, { udid: 'P265', name: 'iPad Air', isAvailable: true }],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-2': [{ udid: 'U262a', name: 'iPhone 16e', isAvailable: true }, { udid: 'U262', name: 'iPhone 17', isAvailable: true }],
    'com.apple.CoreSimulator.SimRuntime.watchOS-26-0': [{ udid: 'W', name: 'Apple Watch', isAvailable: true }],
  } };
  const p1 = PS.pick(fake, { prefer: ['26.2', '26.1'], name: 'iPhone 17' }), p2 = PS.pick(fake, { prefer: ['26.1'], name: 'iPhone 17' }), p3 = PS.pick(fake, { name: 'iPhone 17' });
  check(p1 && p1.udid === 'U262' && p1.os === '26.2' && p1.preferred && p2 && p2.udid === 'U265' && !p2.preferred && p3 && p3.udid === 'U265' && PS.pick({ devices: {} }) === null,
    'pick-simulator.mjs：先要 26.2 的 iPhone 17；没有要的版本就挑最新的；只挑 iPhone', { p1, p2, p3 });
  const ui = read('ios/UITests/SmokeUITests.swift');
  check(/-EchoSelfTest/.test(ui) && /springboard/.test(ui) && /landscape/.test(ui) && /XCTAttachment\(screenshot/.test(ui), 'UI 测试：自测页、麦克风弹窗、横屏、截图');
  check(fs.existsSync(path.join(IOS, 'README.md')) && /TestFlight/.test(read('ios/README.md')), 'ios/README.md 写了怎么打包、怎么装到 iPhone');
  const iosReadme = read('ios/README.md');
  check(IOSN.every(n => new RegExp('\\| `' + n + '\\(').test(iosReadme)), 'ios/README.md 的「iPhone 才有的方法」表里写了每一个', IOSN.filter(n => !new RegExp('\\| `' + n + '\\(').test(iosReadme)));
  const andIos = readme.slice(readme.indexOf('### iPhone 才有的方法'));
  check(readme.includes('### iPhone 才有的方法') && readme.indexOf('### iPhone 才有的方法') > readme.indexOf('**原生发给网页的事件**') && IOSN.every(n => andIos.includes('`' + n + '`')),
    'android/README.md 有一小节「iPhone 才有的方法」（在安卓方法表外面，安卓的核对不数它们），名字都在', IOSN.filter(n => !andIos.includes('`' + n + '`')));
  check(/gh workflow run ios-testflight\.yml --ref echo-island\/next/.test(iosReadme) && /默认分支/.test(iosReadme), 'ios/README.md 写了怎么触发 TestFlight、工作流不在默认分支上要注意什么');

  console.log(fails ? `\n✗ ${fails} 项没过` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// ---------- 一个够用的 YAML 读法（只认工作流里用到的：映射、列表、| 多行、[a, b]、引号、注释） ----------
function parseYaml(src) {
  if (/\t/.test(src)) throw new Error('YAML 里不能有 Tab');
  const lines = src.split(/\r?\n/);
  let i = 0;
  const strip = s => { let q = null; for (let k = 0; k < s.length; k++) { const c = s[k]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '#' && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k); } return s.replace(/\s+$/, ''); };
  const ind = s => s.match(/^ */)[0].length;
  const blank = k => !strip(lines[k]).trim();
  const next = () => { let k = i; while (k < lines.length && blank(k)) k++; return k; };
  const flow = s => { const out = []; let d = 0, q = null, cur = ''; for (const c of s) { if (q) { cur += c; if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '[' || c === '{') d++; if (c === ']' || c === '}') d--; if (c === ',' && !d) { out.push(cur); cur = ''; continue; } cur += c; } if (cur.trim()) out.push(cur); return out; };
  const scalar = v => {
    v = v.trim();
    if (v === '' || v === '~' || v === 'null') return null;
    if (/^".*"$/.test(v)) return JSON.parse(v);
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    if (v[0] === '[') { if (!v.endsWith(']')) throw new Error('没写完的 [ ]：' + v); return flow(v.slice(1, -1)).map(scalar); }
    if (v[0] === '{') { if (!v.endsWith('}')) throw new Error('没写完的 { }：' + v); const o = {}; flow(v.slice(1, -1)).forEach(p => { const j = p.indexOf(':'); o[scalar(p.slice(0, j))] = scalar(p.slice(j + 1)); }); return o; }
    if (v === 'true') return true; if (v === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return +v;
    if (/^[&*!|>%@`]/.test(v)) throw new Error('这里不认的写法：' + v);
    return v;
  };
  const KEY = /^("[^"]*"|'[^']*'|[^\s:'"][^:]*?):(?:\s+(.*))?$/;
  function node(minInd) {
    const k = next(); if (k >= lines.length) return null;
    const l = strip(lines[k]), n = ind(l);
    if (n < minInd) return null;
    i = k;
    return /^-( |$)/.test(l.trim()) ? seq(n) : map(n);
  }
  function blockText(parent) {
    const out = []; let bi = null; i++;
    while (i < lines.length) { const l = lines[i]; if (!l.trim()) { out.push(''); i++; continue; } const n = ind(l); if (n <= parent) break; if (bi === null) bi = n; out.push(l.slice(bi)); i++; }
    return out.join('\n').replace(/\n+$/, '') + '\n';
  }
  function value(rest, n) {
    const r = (rest || '').trim();
    if (/^[|>][-+]?$/.test(r)) return blockText(n);
    i++;
    if (r) return scalar(r);
    const k = next(); if (k >= lines.length) return null;
    const l = strip(lines[k]), m = ind(l);
    return m > n || (m === n && /^-( |$)/.test(l.trim())) ? node(m) : null;
  }
  function map(n) {
    const o = {};
    for (;;) {
      const k = next(); if (k >= lines.length) break;
      const l = strip(lines[k]), m = ind(l); if (m < n) break;
      if (m > n) throw new Error('第 ' + (k + 1) + ' 行缩进不对');
      const t = l.trim(); if (/^-( |$)/.test(t)) break;
      const mm = t.match(KEY); if (!mm) throw new Error('第 ' + (k + 1) + ' 行读不懂：' + t);
      const key = scalar(mm[1]); if (key in o) throw new Error('第 ' + (k + 1) + ' 行：键 ' + key + ' 重复了');
      i = k; o[key] = value(mm[2], m);
    }
    return o;
  }
  function seq(n) {
    const a = [];
    for (;;) {
      const k = next(); if (k >= lines.length) break;
      const l = strip(lines[k]), m = ind(l), t = l.trim();
      if (m < n || !/^-( |$)/.test(t)) { if (m > n) throw new Error('第 ' + (k + 1) + ' 行缩进不对'); break; }
      if (m > n) throw new Error('第 ' + (k + 1) + ' 行缩进不对');
      const rest = t === '-' ? '' : t.slice(2);
      i = k;
      if (!rest) { i++; a.push(node(m + 1)); continue; }
      if (KEY.test(rest) && !/^["'[{]/.test(rest)) { lines[k] = ' '.repeat(m + 2) + rest; a.push(map(m + 2)); continue; }
      i++; a.push(scalar(rest));
    }
    return a;
  }
  const out = node(0);
  if (next() < lines.length) throw new Error('第 ' + (next() + 1) + ' 行没读到');
  return out;
}
