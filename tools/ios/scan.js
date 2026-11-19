// 回声岛 · iPhone 检查：静态扫一遍「随 App 发布的文件」里用到的浏览器功能，标出 iOS Safari 从哪一版开始支持。不开浏览器，秒出。
// 用法：node tools/ios/scan.js            打印 + 写 tests/screenshots/ios/scan.json
//       node tools/ios/scan.js --all      没查到的也逐条打印「none」（默认也打印，只是合成一行）
// 扫哪些文件：index.html 里加载的全部脚本和样式、style.css、pages/*.html、isles/*.js、vendor/three.min.js（只报要紧的几样）。
// 版本号的出处：MDN browser-compat-data / caniuse（2026-11-19 查过的标 ✓；没标的是凭记忆，写着「未核对」的要再查）。
// 目标：最低 iOS 18.4，退一步 16.4 —— 比 16.4 新的标「>16.4」，比 18.4 新的标「>18.4」，iOS 上根本没有的标「iOS 无」。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'tests', 'screenshots', 'ios');
fs.mkdirSync(OUT, { recursive: true });
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---------- 要扫的文件 ----------
const html = read('index.html');
const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]);
const pages = fs.readdirSync(path.join(ROOT, 'pages')).filter(f => /\.html$/.test(f)).map(f => 'pages/' + f);
const isles = fs.readdirSync(path.join(ROOT, 'isles')).filter(f => /\.js$/.test(f)).map(f => 'isles/' + f);
const VENDOR = 'vendor/three.min.js';
const jsFiles = [...new Set(scripts.concat(isles))].filter(f => f !== VENDOR && fs.existsSync(path.join(ROOT, f)));
const cssFiles = [...new Set(styles.concat(['style.css']))];
const missing = scripts.filter(f => !fs.existsSync(path.join(ROOT, f)));

// ---------- 功能表 ----------
// ios：iOS Safari 第一个支持的版本；'无' = iOS 上没有；ok ✓ = 查过 MDN / caniuse
const JS = [
  ['RegExp 后行断言 (?<= (?<!', /\(\?<[=!]/g, '16.4', ''],
  ['RegExp v 标志', /new RegExp\([^)\n]*,\s*['"][dgimsuy]*v[dgimsuy]*['"]\s*\)|\/[dgimsuy]*v[dgimsuy]*\.(?:test|exec)\(/g, '17.0', ''],
  ['structuredClone', /\bstructuredClone\s*\(/g, '15.4', ''],
  ['.at(', /\.at\(/g, '15.4', ''],
  ['findLast / findLastIndex', /\.findLast(?:Index)?\(/g, '15.4', ''],
  ['Object.groupBy / Map.groupBy', /\b(?:Object|Map)\.groupBy\b/g, '17.4', ''],
  ['Object.hasOwn', /\bObject\.hasOwn\b(?!Property)/g, '15.4', ''],
  ['toSorted / toReversed / toSpliced / .with(', /\.(?:toSorted|toReversed|toSpliced|with)\(/g, '16.0', ''],
  ['Set 的 union / intersection / difference…', /\.(?:union|intersection|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/g, '17.0', ''],
  ['Promise.withResolvers', /\bPromise\.withResolvers\b/g, '17.4', ''],
  ['Array.fromAsync', /\bArray\.fromAsync\b/g, '16.4', ''],
  ['requestIdleCallback / cancelIdleCallback', /\b(?:request|cancel)IdleCallback\b/g, '无', '✓ Safari 只在预览版的开关后面（MDN BCD），iOS 默认没有'],
  ['navigator.vibrate', /\bvibrate\b/g, '无', 'iOS 没有振动接口'],
  ['navigator.deviceMemory', /\bdeviceMemory\b/g, '无', ''],
  ['navigator.connection', /\bnavigator\.connection\b|\.connection\.(?:effectiveType|saveData|downlink)/g, '无', ''],
  ['navigator.userAgentData', /\buserAgentData\b/g, '无', ''],
  ['performance.memory', /\bperformance\.memory\b/g, '无', ''],
  ['screen.orientation', /\bscreen\.orientation\b/g, '16.4', 'lock() 在 iPhone 上不能用'],
  ['requestFullscreen', /\b(?:webkit)?(?:R|r)equestFullscreen\b|\bexitFullscreen\b|\bfullscreenElement\b/g, '无（iPhone）', 'iPhone 上只有 <video> 能全屏，iPad 才有元素全屏（未核对最新版本）'],
  ['OffscreenCanvas', /\bOffscreenCanvas\b/g, '16.4', '2D 16.4，WebGL 17.0'],
  ['new AudioContext（没有 webkitAudioContext 兜底）', /new AudioContext\b/g, '14.5', '不带前缀的 AudioContext：iOS 14.5 起；只是列出来，≥16.4 不成问题'],
  ['webkitAudioContext 兜底', /\bwebkitAudioContext\b/g, '6', ''],
  ['AudioWorklet', /\baudioWorklet\b|\bAudioWorkletNode\b/g, '14.5', ''],
  ['MediaRecorder', /\bMediaRecorder\b/g, '14.3', 'iOS 录出来是 audio/mp4（AAC），不是 webm'],
  ['audio/webm 的假设', /audio\/webm/g, '—', 'iOS 的 MediaRecorder 不出 webm；看是不是只当兜底的类型名'],
  ['SpeechRecognition', /\b(?:webkit)?SpeechRecognition\b/g, '14.5（webkit 前缀）', 'WKWebView 里一般用不了（未核对）'],
  ['speechSynthesis', /\bspeechSynthesis\b/g, '7', ''],
  ['getUserMedia', /\bgetUserMedia\b/g, '11（Safari）/ 14.3（WKWebView）', '要安全来源 + Info.plist 的麦克风说明'],
  ['AbortSignal.timeout', /\bAbortSignal\.timeout\b/g, '16.0', ''],
  ['Intl.Segmenter', /\bIntl\.Segmenter\b/g, '14.5', ''],
  ['顶层 await / ES 模块', /<script[^>]*type="module"|^\s*import\s.+\sfrom\s|^\s*export\s/gm, '15（顶层 await）', '全是普通脚本就不可能有顶层 await'],
  ['类的 static 块', /\bstatic\s*\{/g, '16.4', ''],
  ['??= / ||= / &&=', /\?\?=|\|\|=|&&=/g, '14', ''],
  ['createImageBitmap', /\bcreateImageBitmap\b/g, '15', ''],
  ['WebAssembly', /\bWebAssembly\b/g, '11', 'SIMD 16.4；锁定模式下没有 WebAssembly'],
  ['navigator.storage', /\bnavigator\.storage\b/g, '15.2（persist）/ 17.0（estimate）', ''],
  ['navigator.wakeLock', /\bwakeLock\b/g, '16.4', ''],
  ['navigator.share / clipboard', /\bnavigator\.(?:share|canShare|clipboard)\b/g, '12.2 / 13.4', ''],
  ['Page Lifecycle 的 freeze / resume 事件', /['"]freeze['"]|['"]resume['"]/g, '无', '只有 Chromium 有；iOS 靠 visibilitychange / pagehide'],
  ['beforeunload / unload', /['"](?:before)?unload['"]/g, '不可靠', 'iOS 上经常不触发'],
  ['scrollIntoView({ behavior: smooth })', /scrollIntoView\(\{[^}]*smooth/g, '15.4', ''],
  ['navigator.onLine', /\bnavigator\.onLine\b/g, '有', 'WKWebView 里只说明有没有网卡，不代表上得了网'],
  ['<a download> / URL.createObjectURL 下载', /\.download\s*=|createObjectURL\(/g, '13（Safari）', 'WKWebView 里 <a download> 不会存文件，要壳子接'],
  ['window.open', /\bwindow\.open\(/g, '有', 'WKWebView 里要壳子实现 createWebView，否则没反应'],
  ['alert / confirm / prompt（浏览器自带的弹窗）', /(?<![.\w$])(?:alert|confirm|prompt)\s*\(/g, '有', 'WKWebView 里要壳子实现 WKUIDelegate，否则不弹（confirm 当成取消）'],
  ['<input type=file>', /type=["']?file/g, '有', ''],
];
const CSS = [
  [':has(', /:has\(/g, '15.4', ''],
  ['dvh / svh / lvh', /\d(?:dvh|svh|lvh|dvw|svw|lvw)\b/g, '15.4', ''],
  ['CSS 嵌套 &', /[{;]\s*&[\s.:#\[>+~]/g, '16.5', ''],
  ['@container / container-type', /@container\b|\bcontainer-type\s*:|\bcontainer\s*:/g, '16.0', ''],
  ['容器查询单位 cqw / cqh / cqi / cqb', /\d(?:cqw|cqh|cqi|cqb|cqmin|cqmax)\b/g, '16.0', ''],
  ['color-mix(', /color-mix\(/g, '16.2', ''],
  ['text-wrap', /\btext-wrap\s*:/g, '17.4（balance 17.5，pretty 26）', '✓ MDN BCD'],
  ['@starting-style', /@starting-style\b/g, '17.5', ''],
  ['scrollbar-width', /\bscrollbar-width\s*:/g, '18.2', '✓ MDN BCD；16.4–18.1 要靠 ::-webkit-scrollbar'],
  ['scrollbar-gutter', /\bscrollbar-gutter\s*:/g, '18.2', '✓ MDN BCD'],
  ['overscroll-behavior', /\boverscroll-behavior(?:-[xy])?\s*:/g, '16.0', ''],
  ['touch-action', /\btouch-action\s*:/g, '13', 'none / manipulation / pan-x / pan-y'],
  ['-webkit-touch-callout', /-webkit-touch-callout\s*:/g, '2', '只有 iOS 有：长按不弹菜单'],
  ['-webkit-tap-highlight-color', /-webkit-tap-highlight-color\s*:/g, '2', ''],
  ['-webkit-text-size-adjust', /text-size-adjust\s*:/g, '2', 'iPhone 横屏会自己把字放大，要写 100% 关掉'],
  ['position: sticky', /position\s*:\s*sticky/g, '13', ''],
  ['aspect-ratio', /\baspect-ratio\s*:/g, '15.0', ''],
  ['inset:', /[{;\s]inset\s*:/g, '14.5', ''],
  ['gap（flex / grid）', /[{;\s](?:row-|column-)?gap\s*:/g, '14.5（flex）', ''],
  ['background-attachment: fixed', /background-attachment\s*:\s*fixed/g, '无', 'iOS 不支持，当成 scroll'],
  [':hover（不在 @media (hover: hover) 里的，点完会粘住）', /:hover\b/g, '有', ''],
  ['@media (hover / pointer)', /@media[^{]*\((?:any-)?(?:hover|pointer)\s*:/g, '9', ''],
  ['::-webkit-scrollbar', /::-webkit-scrollbar/g, '有', ''],
  ['padding-block / margin-inline 等逻辑属性', /\b(?:padding|margin)-(?:block|inline)\b/g, '14.5', ''],
  [':focus-visible', /:focus-visible/g, '15.4', ''],
  ['overflow: clip', /overflow(?:-[xy])?\s*:\s*clip/g, '16.0', ''],
  ['accent-color', /\baccent-color\s*:/g, '15.4', ''],
];

// ---------- 扫 ----------
const lineOf = (text, idx) => { let n = 1; for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) n++; return n; };
function hits(file, text, re) {
  const out = []; re.lastIndex = 0; let m; const lines = text.split('\n'), starts = []; let o = 0; lines.forEach(l => { starts.push(o); o += l.length + 1; });
  while ((m = re.exec(text))) { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= m.index) lo = mid; else hi = mid - 1; }
    const col = m.index - starts[lo], line = lines[lo]; out.push({ at: file + ':' + (lo + 1), s: line.slice(Math.max(0, col - 50), col + 70).trim() }); if (m[0] === '') re.lastIndex++; if (out.length > 400) break; }
  return out;
}
const newer = v => { const n = parseFloat(v); return /^无/.test(v) ? 'iOS 无' : isNaN(n) ? '' : n > 18.4 ? '>18.4' : n > 16.4 ? '>16.4' : ''; };
const res = { files: { js: jsFiles, css: cssFiles, pages, vendor: VENDOR, missing }, js: [], css: [], rules: {}, vendor: {} };
const texts = {}; jsFiles.concat(cssFiles, pages, ['index.html']).forEach(f => { texts[f] = read(f); });

for (const [name, re, ios, note] of JS) {
  const list = []; jsFiles.concat(pages, ['index.html']).forEach(f => list.push(...hits(f, texts[f], re)));
  res.js.push({ name, ios, flag: newer(ios), note, n: list.length, hits: list });
}
// CSS：样式文件、网页里的 <style>、还有 JS 里拼出来的样式（talk.js、setup.js 自己插 <style>；world.js 里有内联 style）
for (const [name, re, ios, note] of CSS) {
  const list = []; cssFiles.concat(pages, ['index.html'], jsFiles).forEach(f => list.push(...hits(f, texts[f], re)));
  res.css.push({ name, ios, flag: newer(ios), note, n: list.length, hits: list });
}
// 按规则查的三样：user-select 没配 -webkit-user-select、backdrop-filter 没配 -webkit-backdrop-filter、100vh 没配 dvh；:hover 在不在 (hover: hover) 里
function rules(file, text) { // 粗分：每个 {…} 一块（够用了：这几个属性都写在最里面一层）
  const out = []; const re = /([^{}]*)\{([^{}]*)\}/g; let m; while ((m = re.exec(text))) out.push({ sel: m[1].trim().split('\n').pop().trim().slice(-90), body: m[2], line: lineOf(text, m.index + m[1].length), file }); return out;
}
const R = []; cssFiles.forEach(f => R.push(...rules(f, texts[f]))); jsFiles.concat(pages).forEach(f => { if (/user-select|backdrop-filter|100vh/.test(texts[f])) R.push(...rules(f, texts[f])); });
res.rules.userSelectNoPrefix = R.filter(r => /(^|[;\s{'"])user-select\s*:/.test(r.body) && !/-webkit-user-select\s*:/.test(r.body)).map(r => ({ at: r.file + ':' + r.line, sel: r.sel, s: (r.body.match(/[^;]*user-select[^;]*/) || [''])[0].trim() }));
res.rules.backdropNoPrefix = R.filter(r => /(^|[;\s{'"])backdrop-filter\s*:/.test(r.body) && !/-webkit-backdrop-filter\s*:/.test(r.body)).map(r => ({ at: r.file + ':' + r.line, sel: r.sel, s: (r.body.match(/[^;]*backdrop-filter[^;]*/) || [''])[0].trim() }));
res.rules.vhNoDvh = R.filter(r => /100vh/.test(r.body) && !/100dvh/.test(r.body)).map(r => ({ at: r.file + ':' + r.line, sel: r.sel, s: (r.body.match(/[^;]*100vh[^;]*/) || [''])[0].trim().slice(0, 100) }));
// 输入框字号小于 16px：iOS 一点输入框就把页面放大
res.rules.smallInputFont = R.filter(r => /\b(?:input|select|textarea)\b/.test(r.sel) && /font-size\s*:\s*(\d+(?:\.\d+)?)px/.test(r.body) && +RegExp.$1 < 16).map(r => ({ at: r.file + ':' + r.line, sel: r.sel, s: (r.body.match(/font-size\s*:\s*[^;]+/) || [''])[0] }));
// :hover：在不在 @media (hover: hover) 的块里（按大括号层数找外面那层 @media）
res.rules.hover = [];
cssFiles.concat(jsFiles.filter(f => /:hover/.test(texts[f]))).forEach(f => { const t = texts[f]; const re = /:hover\b/g; let m; while ((m = re.exec(t))) { let depth = 0, inHover = false; for (let i = m.index; i >= 0; i--) { const c = t[i]; if (c === '}') depth++; else if (c === '{') { if (depth === 0) { const head = t.slice(Math.max(0, t.lastIndexOf('}', i) + 1, t.lastIndexOf(';', i) + 1), i); if (/@media[^{]*hover\s*:\s*hover/.test(head)) inHover = true; } else depth--; } }
  const ln = lineOf(t, m.index), line = t.split('\n')[ln - 1]; res.rules.hover.push({ at: f + ':' + ln, guarded: inHover, s: line.slice(Math.max(0, line.indexOf(':hover') - 60), line.indexOf(':hover') + 60).trim() }); } });
// viewport
res.viewport = (html.match(/<meta name="viewport"[^>]*>/) || [''])[0];
// 不是 <button> 却带 data-act 的元素：点击是在 document 上统一接的（game.js），iPhone 上这种元素要有 cursor: pointer（或者自己 / body 以下的祖先有点击监听）才会发 click
res.rules.nonButtonAct = (() => { const out = {}; jsFiles.concat(['index.html']).forEach(f => { const t = texts[f], re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^<>]{0,400}?)data-act=\\?["']?([a-zA-Z_]+)/g; let m;
  while ((m = re.exec(t))) { const tag = m[1].toLowerCase(); if (tag === 'button') continue; const cls = (m[2].match(/class=\\?["']([^"'\\ ]*)/) || [])[1] || '', id = (m[2].match(/id=\\?["']([^"'\\ ]*)/) || [])[1] || '';
    const k = tag + (id ? '#' + id : '') + (cls ? '.' + cls : '') + '  data-act=' + m[3]; (out[k] = out[k] || { el: k, inlinePointer: /cursor\s*:\s*pointer/.test(m[2]), at: [] }).at.push(f + ':' + lineOf(t, m.index)); } });
  return Object.values(out).map(x => ({ at: x.at[0], el: x.el, inlinePointer: x.inlinePointer, n: x.at.length, all: x.at })); })();
res.rules.cursorPointer = hits('style.css', texts['style.css'], /cursor\s*:\s*pointer/g).map(h => ({ at: h.at, s: (texts['style.css'].split('\n')[+h.at.split(':')[1] - 1].match(/^[^{]*/) || [''])[0].trim().slice(0, 80) }));

// vendor/three.min.js：只报要紧的
{
  const t = read(VENDOR), ctx = (re, w) => { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(t)) && out.length < 6) out.push(t.slice(Math.max(0, m.index - (w || 90)), m.index + (w || 90) + m[0].length).replace(/\s+/g, ' ')); return out; };
  const count = re => (t.match(re) || []).length;
  res.vendor = {
    bytes: t.length, banner: t.slice(0, 140),
    KHR_parallel_shader_compile: { n: count(/KHR_parallel_shader_compile/g), ctx: ctx(/KHR_parallel_shader_compile/g, 110) },
    OffscreenCanvas: { n: count(/OffscreenCanvas/g), ctx: ctx(/OffscreenCanvas/g, 80) },
    createImageBitmap: { n: count(/createImageBitmap/g), ctx: ctx(/typeof createImageBitmap[^;]{0,200}/g, 60) },
    safariSniff: ctx(/isSafari|safari\/i|Version\\\/\(\\d\+\)/g, 110).slice(0, 3),
    WebAssembly: { n: count(/WebAssembly/g), ctx: ctx(/WebAssembly\.(?:validate|instantiate|compile)[^;]{0,120}/g, 100) },
    meshopt: { n: count(/meshopt/gi), simdDetect: ctx(/WebAssembly\.validate\([^)]{0,80}\)/g, 160), noWasmMessage: ctx(/WebAssembly is not supported|No WebAssembly|not supported[^"']{0,40}/gi, 100).slice(0, 3), workers: count(/new Worker\(/g) },
    requestIdleCallback: count(/requestIdleCallback/g), structuredClone: count(/structuredClone/g), lookbehind: count(/\(\?<[=!]/g), staticBlock: count(/\bstatic\{/g), logicalAssign: count(/\?\?=|\|\|=|&&=/g), dotAt: count(/\.at\(/g), findLast: count(/\.findLast/g),
    floatTargets: { EXT_color_buffer_float: count(/EXT_color_buffer_float/g), EXT_color_buffer_half_float: count(/EXT_color_buffer_half_float/g), OES_texture_float_linear: count(/OES_texture_float_linear/g) },
    videoFrame: count(/VideoFrame/g), webgpu: count(/navigator\.gpu/g), xr: count(/navigator\.xr|XRSession/g),
  };
}
// 游戏自己的 3D 代码用没用浮点贴图 / 渲染目标（iPhone 不一定有 OES_texture_float_linear）
res.float = []; jsFiles.forEach(f => res.float.push(...hits(f, texts[f], /\b(?:HalfFloatType|FloatType)\b|OES_texture_float|EXT_color_buffer/g)));

fs.writeFileSync(path.join(OUT, 'scan.json'), JSON.stringify(res, null, 1));

// ---------- 打印 ----------
const P = s => console.log(s);
P('扫了 ' + jsFiles.length + ' 个脚本、' + cssFiles.length + ' 个样式、' + pages.length + ' 个网页 + ' + VENDOR + (missing.length ? '   ⚠️ index.html 里写了但找不到：' + missing.join(' ') : ''));
P('viewport：' + res.viewport);
const show = (title, list) => { P('\n===== ' + title + ' ====='); const none = [];
  list.forEach(x => { if (!x.n) { none.push(x.name); return; } P('\n■ ' + x.name + '  — iOS ' + x.ios + (x.flag ? '  【' + x.flag + '】' : '') + (x.note ? '  （' + x.note + '）' : '') + '  共 ' + x.n + ' 处'); x.hits.slice(0, process.argv.includes('--all') ? 999 : 14).forEach(h => P('   ' + h.at + '  ' + h.s.slice(0, 130))); if (x.hits.length > 14 && !process.argv.includes('--all')) P('   …… 还有 ' + (x.hits.length - 14) + ' 处（scan.json 里有全部）'); });
  P('\n□ none（一处都没有）：' + none.join('；')); };
show('JS', res.js); show('CSS（含 JS 里拼的样式）', res.css);
P('\n===== 按规则查 =====');
const rl = (t, l, f) => { P('\n■ ' + t + '：' + (l.length ? l.length + ' 处' : 'none')); l.forEach(x => P('   ' + x.at + '  ' + (x.sel ? x.sel + '  { ' + x.s + ' }' : f ? f(x) : x.s))); };
rl('user-select 没配 -webkit-user-select（iOS 只认带前缀的 ✓ MDN BCD）', res.rules.userSelectNoPrefix);
rl('backdrop-filter 没配 -webkit-backdrop-filter（不带前缀 iOS 18.0 起 ✓ MDN BCD；16.4–17.x 要前缀）', res.rules.backdropNoPrefix);
rl('100vh 没配 100dvh', res.rules.vhNoDvh);
rl('输入框字号小于 16px（iOS 聚焦时会自动放大页面）', res.rules.smallInputFont);
rl(':hover（guarded = 包在 @media (hover: hover) 里）', res.rules.hover, x => (x.guarded ? '[guarded] ' : '[会粘住] ') + x.s);
rl('不是 <button> 却带 data-act 的元素（iPhone 上要 cursor: pointer 才收得到在 document 上接的 click）', res.rules.nonButtonAct, x => x.el + (x.inlinePointer ? '  [内联 cursor:pointer]' : '') + (x.n > 1 ? '   共 ' + x.n + ' 处' : ''));
rl('style.css 里写了 cursor: pointer 的规则', res.rules.cursorPointer, x => x.s);
P('\n===== ' + VENDOR + ' =====\n' + JSON.stringify(res.vendor, null, 1));
P('\n===== 游戏自己的 3D 代码里的浮点贴图 / 扩展 =====' + (res.float.length ? '' : ' none')); res.float.slice(0, 30).forEach(h => P('   ' + h.at + '  ' + h.s.slice(0, 130)));
P('\n结果：' + path.join(OUT, 'scan.json'));
