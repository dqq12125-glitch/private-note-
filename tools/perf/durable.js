// 回声岛 · 存档落盘实测（在装好的 APK 里）：写进 localStorage 的东西，App 被杀掉以后还在不在
// WebView 的内核不是每次 setItem 都马上写磁盘：写得越大、越频繁，落盘越晚。这里按游戏的写法（隔一会儿整份重写一次）试几种大小，
// 分两种死法：先按 Home 切到后台再被杀（平时从最近任务里划掉就是这样）/ 在前台直接被杀（闪退、没电）。
// 用法：node tools/perf/durable.js [--sizes 60000,340000,1100000] [--writes 4] [--gap 1500] [--bg 3000]
// 只用自己的测试键（dur-*），不碰存档；跑完删掉。
const A = require('./apk');
const argv = process.argv.slice(2), opt = { sizes: '60000,340000,1100000', writes: 4, gap: 1500, bg: 3000 };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i];
const start = async () => { A.adb('shell', 'monkey', '-p', A.PKG, '-c', 'android.intent.category.LAUNCHER', '1'); await A.sleep(6000); };
const write = (size, tag) => A.evaluate(`(async () => { const big = 'x'.repeat(${size} - 40); for (let i = 1; i <= ${opt.writes}; i++) { localStorage.setItem('dur-big', '{"n":' + i + ',"t":"${tag}","pad":"' + big + '"}'); localStorage.setItem('dur-m', '${tag}' + i); await new Promise(r => setTimeout(r, ${opt.gap})); } return localStorage.getItem('dur-m'); })()`);
const read = () => A.evaluate(`(localStorage.getItem('dur-m') || '没有') + ' / 大的那条第 ' + ((localStorage.getItem('dur-big') || '').match(/"n":(\\d+)/) || [0, '无'])[1] + ' 次'`);
(async () => {
  const rows = [];
  for (const size of opt.sizes.split(',').map(Number)) {
    for (const mode of ['后台再杀', '前台直接杀']) {
      const tag = (mode === '后台再杀' ? 'B' : 'F') + size + '-';
      A.adb('shell', 'am', 'force-stop', A.PKG); await start();
      const last = await write(size, tag);
      if (mode === '后台再杀') { A.adb('shell', 'input', 'keyevent', 'HOME'); await A.sleep(+opt.bg); }
      A.adb('shell', 'am', 'force-stop', A.PKG);
      await A.sleep(800); await start();
      const got = await read();
      const ok = got.startsWith(last);
      rows.push({ size, mode, last, got, ok });
      console.log(`${String(size).padStart(8)} 字  ${mode.padEnd(6)}  最后写的 ${last}  重开后读到 ${got}  ${ok ? '✓ 没丢' : '✗ 丢了'}`);
    }
  }
  await A.evaluate(`localStorage.removeItem('dur-big'); localStorage.removeItem('dur-m'); 'ok'`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
