// 回声岛 · 在模拟器 / 手机上装好的 APK 里执行一段 JS（通过 WebView 的调试口），量安装包里的真实表现
// 先决条件：adb 连着设备，App 开着，安装包是能调试 WebView 的（家庭版 / 调试版都行）
// 用法：
//   node tools/perf/apk.js eval "document.title"            执行并打印结果（表达式可以是 await 的）
//   node tools/perf/apk.js file some.js                      执行一个文件里的 JS（最后一个表达式的值是结果）
//   node tools/perf/apk.js start | stop | home | kill        打开 App / 强行停止 / 按 Home 键 / 不经后台直接杀进程
// 环境变量：ADB（adb 的路径，默认 D:/Claude/tools/android/sdk/platform-tools/adb.exe）、PKG（默认 com.echoisland.app）
const { execFileSync } = require('child_process');
const fs = require('fs');
const ADB = process.env.ADB || 'D:/Claude/tools/android/sdk/platform-tools/adb.exe';
const PKG = process.env.PKG || 'com.echoisland.app';
const PORT = +process.env.CDP_PORT || 9333;
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function page() {
  let pid = '';
  for (let i = 0; i < 40 && !pid; i++) { try { pid = adb('shell', 'pidof', PKG).split(/\s+/)[0]; } catch (e) { /* 还没起来 */ } if (!pid) await sleep(500); }
  if (!pid) throw new Error('App 没在运行：' + PKG);
  adb('forward', 'tcp:' + PORT, 'localabstract:webview_devtools_remote_' + pid);
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
      const pg = list.find(x => x.type === 'page' && /index\.html|appassets/.test(x.url)) || list.find(x => x.type === 'page');
      if (pg) return pg.webSocketDebuggerUrl;
    } catch (e) { /* WebView 还没准备好 */ }
    await sleep(500);
  }
  throw new Error('连不上 WebView 的调试口（这个安装包可能不让调试）');
}
async function evaluate(expr) {
  const url = await page();
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('调试口连不上')); });
  const out = await new Promise((res, rej) => {
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) res(d); };
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true } }));
    setTimeout(() => rej(new Error('120 秒没有结果')), 120000);
  });
  ws.close();
  if (out.error) throw new Error(JSON.stringify(out.error));
  const r = out.result;
  if (r.exceptionDetails) throw new Error('JS 出错：' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}

module.exports = { adb, evaluate, sleep, PKG };
if (require.main === module) (async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'eval' || cmd === 'file') { const v = await evaluate(cmd === 'file' ? fs.readFileSync(arg, 'utf8') : arg); console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); }
  else if (cmd === 'start') { console.log(adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1').split('\n').pop()); }
  else if (cmd === 'stop') { adb('shell', 'am', 'force-stop', PKG); console.log('已强行停止'); }
  else if (cmd === 'home') { adb('shell', 'input', 'keyevent', 'HOME'); console.log('已按 Home'); }
  else if (cmd === 'kill') { const pid = adb('shell', 'pidof', PKG).split(/\s+/)[0]; adb('shell', 'run-as', PKG, 'kill', '-9', pid); console.log('已杀进程 ' + pid); }
  else console.log('用法：node tools/perf/apk.js eval "<js>" | file <js 文件> | start | stop | home | kill');
  process.exit(0);   // 调试口的连接会让进程一直不退，这里直接退
})().catch(e => { console.error(e.message); process.exit(1); });
