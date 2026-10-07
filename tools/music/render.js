// 离线渲染每一首配乐，检查电平、削波、静音、循环接缝和渲染速度（用无头 Chromium 跑 music.js，和游戏里同一套合成）
//   node tools/music/render.js                   全部（music-data.js 里的）
//   node tools/music/render.js route cave        只这几首
//   node tools/music/render.js --wav out/        顺便写出 16 位 WAV（44.1kHz 立体声）
//   node tools/music/render.js --data x.js       用别的乐谱文件（内容是 window.MUSIC = {…}）代替 music-data.js（测引擎用）
//   --rate 48000 采样率   --seconds 30 每首只渲染多少秒
//   node tools/music/render.js --levels          音量校正：每首都量一遍，写出 tools/music/levels.json（{ id: 增益 dB }）
//   node tools/music/render.js --levels route    只重量这几首（levels.json 里别的保留）
//   --out x.json                                 levels 写到别的文件（测试用）
// 背景音乐：渲染「完整一遍 + 进循环 10 秒」；小段音乐：整首 + 尾音
// 打印：峰值 dBFS、RMS dBFS、削波的采样数（|x| > 0.999）、最长的静音（背景音乐超过 1.5 秒算问题）、
//       循环接缝（接缝前后 0.5 秒的 RMS 差多少 dB；「接回」= 循环点后 0.3 秒比第一遍同一处小多少；「两遍差」= 第二遍和第一遍每 50 毫秒的音量平均差几 dB）、
//       渲染速度（比实时快几倍）、最多同时几个声音（引擎上限 40，超过会掐掉最快结束的）、校正（这首用的音量校正 dB）
// 有削波、NaN 或渲染出错 → 退出码 1
//
// 音量校正（--levels）：各首写的时候音量不一样，听起来忽大忽小。按「循环段的 RMS」（小段音乐：整首）对齐到下面的目标：
//   战斗、对手、勇气之路、嘘声团 -19 dBFS；小镇、道路、海、挑战馆、洞穴、首页、结算 -20.5；休息站、学习、进化 -22.5（给朗读让路）；小段音乐 -19
//   最多加 4 dB、减 6 dB（差太多说明曲子本身要改配器/mix，别全靠校正）；加了以后峰值超过 -1 dBFS 就少加一点
//   量的时候先把校正当 0（原始音量），算出增益后带着它再量一遍，压限器让音量不完全线性时再修一次
//   写出 levels.json 后跑 node tools/music/build.js，把它并进 music-data.js（每首的 gain 字段），引擎 music.js 放的时候乘上
//   改了曲子（音符、音色、mix）之后要重新跑 --levels
const fs = require('fs');
const path = require('path');
const { chromium } = require('D:/Claude/echo-island/node_modules/playwright');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = { ids: [], wav: null, data: null, rate: 44100, seconds: 0, levels: false, out: path.join(__dirname, 'levels.json') };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--wav') opt.wav = args[++i];
  else if (a === '--data') opt.data = args[++i];
  else if (a === '--rate') opt.rate = +args[++i];
  else if (a === '--seconds') opt.seconds = +args[++i];
  else if (a === '--levels') opt.levels = true;
  else if (a === '--out') opt.out = path.resolve(args[++i]);
  else opt.ids.push(a);
}

// 音量目标（dBFS，循环段 RMS）；小段音乐（loop: false）一律 JINGLE
const LOUD = /^(battle_\w+|rival|league|hush)$/, SOFT = /^(center|study|evolve)$/;
const TARGET = { loud: -19, mid: -20.5, soft: -22.5, jingle: -19 };
const BOOST = 4, CUT = -6, PEAK = -1;
const groupOf = (id, loop) => (!loop ? 'jingle' : LOUD.test(id) ? 'loud' : SOFT.test(id) ? 'soft' : 'mid');

// 在页面里跑：按给定的校正渲染一首，量循环段（小段音乐：整首）的 RMS 和全曲峰值
async function level({ id, gain, rate }) {
  const song = window.MUSIC.songs[id], tl = window.MusicCore.timeline(song);
  const spb = 60 / song.bpm, full = tl.beats * spb, once = song.loop === false;
  const t1 = once ? 0 : tl.loopBeat * spb, t2 = full;
  const buf = await window.EchoMusic.render(id, { sampleRate: rate, gain, seconds: full + (once ? 1.2 : 0.3) });
  const n = buf.length, sr = buf.sampleRate, A = buf.getChannelData(0), B = buf.getChannelData(1);
  let pk = 0, s = 0;
  for (let i = 0; i < n; i++) { const m = Math.max(Math.abs(A[i]), Math.abs(B[i])); if (m > pk) pk = m; }
  const i1 = Math.round(t1 * sr), i2 = Math.min(n, Math.round(t2 * sr));
  for (let i = i1; i < i2; i++) s += A[i] * A[i] + B[i] * B[i];
  const db = x => (x > 1e-6 ? 20 * Math.log10(x) : -120);
  return { loop: !once, rms: db(Math.sqrt(s / (2 * Math.max(1, i2 - i1)))), peak: db(pk) };
}

function wavFile(file, b64, ch, sr) {
  const pcm = Buffer.from(b64, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

// 在页面里跑：渲染一首并算统计（样本不用传回 Node，只有要 WAV 时才传）
async function measure({ id, rate, seconds, wav }) {
  const song = window.MUSIC.songs[id], tl = window.MusicCore.timeline(song);
  const spb = 60 / song.bpm, full = tl.beats * spb, loopT = tl.loopBeat * spb, L = full - loopT, once = song.loop === false;
  const t0 = performance.now();
  const buf = await window.EchoMusic.render(id, { sampleRate: rate, seconds: seconds || undefined });
  const ms = performance.now() - t0;
  const n = buf.length, sr = buf.sampleRate, A = buf.getChannelData(0), B = buf.getChannelData(1);
  let peak = 0, sum = 0, clip = 0, nan = 0;
  for (let i = 0; i < n; i++) {
    const a = A[i], b = B[i];
    if (a !== a || b !== b) { nan++; continue; }
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > peak) peak = m;
    if (m > 0.999) clip++;
    sum += a * a + b * b;
  }
  const db = x => (x > 1e-6 ? 20 * Math.log10(x) : -120);
  // 50 毫秒一格的 RMS 包络
  const W = Math.round(sr * 0.05), env = [];
  for (let i = 0; i + W <= n; i += W) {
    let s = 0;
    for (let j = i; j < i + W; j++) s += A[j] * A[j] + B[j] * B[j];
    env.push(Math.sqrt(s / (2 * W)));
  }
  const rmsOf = (t1, t2) => {
    const i1 = Math.max(0, Math.round(t1 * sr)), i2 = Math.min(n, Math.round(t2 * sr));
    if (i2 <= i1) return 0;
    let s = 0;
    for (let i = i1; i < i2; i++) s += A[i] * A[i] + B[i] * B[i];
    return Math.sqrt(s / (2 * (i2 - i1)));
  };
  // 最长的静音（-50 dBFS 以下）；小段音乐只看音乐部分（不算最后的尾音）
  const quiet = Math.pow(10, -50 / 20), musicEnd = once ? Math.min(env.length, Math.floor(full / 0.05)) : env.length;
  let run = 0, longest = 0, lead = 0;
  for (let k = 0; k < musicEnd; k++) {
    if (env[k] < quiet) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  for (let k = 0; k < env.length && env[k] < quiet; k++) lead++;
  const out = {
    id, title: song.title, loop: !once, seconds: +(n / sr).toFixed(2), full: +full.toFixed(2), loopSec: +L.toFixed(2),
    peak: +db(peak).toFixed(2), rms: +db(Math.sqrt(sum / (2 * n))).toFixed(2), clip, nan,
    silence: +(longest * 0.05).toFixed(2), leadIn: +(lead * 0.05).toFixed(2),
    ms: Math.round(ms), speed: +((n / sr) / (ms / 1000)).toFixed(1),
    voices: buf.stats ? buf.stats.voices : null, steals: buf.stats ? buf.stats.steals : null,
  };
  if (!once && n / sr > full + 0.6) {
    // 接缝（作曲看的）：循环点前后各 0.5 秒的 RMS 差，差太多说明最后一小节接回去不顺
    const before = rmsOf(full - 0.5, full), after = rmsOf(full, full + 0.5);
    out.seam = +(db(after) - db(before)).toFixed(1);
    // 接缝（引擎看的）：循环点后 0.3 秒和第一遍同一个地方（loopFrom 那一拍）比，引擎漏排音符会掉很多
    out.seamGap = +(db(rmsOf(full, full + 0.3)) - db(rmsOf(loopT, loopT + 0.3))).toFixed(1);
    // 第二遍和第一遍像不像：循环段每 50 毫秒的音量，平均差几 dB（只看有声音的格子）
    const len = Math.min(L, n / sr - full) - 0.1, m = Math.floor(len / 0.05);
    if (m > 10) {
      let d = 0, k2 = 0;
      for (let k = 0; k < m; k++) {
        const x = db(rmsOf(loopT + k * 0.05, loopT + (k + 1) * 0.05)), y = db(rmsOf(full + k * 0.05, full + (k + 1) * 0.05));
        if (Math.max(x, y) < -50) continue;
        d += Math.abs(Math.max(x, -60) - Math.max(y, -60)); k2++;
      }
      out.loopDiff = k2 ? +(d / k2).toFixed(2) : 0;
    }
  }
  if (wav) {
    const pcm = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.max(-1, Math.min(1, A[i] || 0)), b = Math.max(-1, Math.min(1, B[i] || 0));
      pcm[2 * i] = a < 0 ? a * 32768 : a * 32767; pcm[2 * i + 1] = b < 0 ? b * 32768 : b * 32767;
    }
    const u8 = new Uint8Array(pcm.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    out.wav = btoa(s);
    out.sr = sr;
  }
  out.gain = buf.stats && buf.stats.gain != null ? buf.stats.gain : 0;
  return out;
}

// --levels：量每首的原始音量，算出校正写进 levels.json
async function levels(page, ids) {
  const r1 = x => Math.round(x * 10) / 10;
  const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
  let old = {};
  try { old = JSON.parse(fs.readFileSync(opt.out, 'utf8')); } catch (e) { /* 还没有 */ }
  const res = opt.ids.length ? Object.assign({}, old) : {};   // 只量几首时别的保留；全量时重新写（删掉的曲子也跟着去掉）
  console.log(pad('曲子', 16) + pad('分组', 8) + lpad('目标', 7) + lpad('原始RMS', 9) + lpad('校正dB', 8) + lpad('校正后', 8) + lpad('峰值', 7));
  let bad = 0;
  for (const id of ids) {
    try {
      const raw = await page.evaluate(level, { id, gain: 0, rate: opt.rate });
      const grp = groupOf(id, raw.loop), tgt = TARGET[grp], notes = [];
      const lim = g => Math.max(CUT, Math.min(BOOST, g));
      let g = lim(tgt - raw.rms), m = await page.evaluate(level, { id, gain: g, rate: opt.rate });
      // 压限器让音量不完全跟着增益走：差 0.2 dB 以上再修一次
      if (Math.abs(tgt - m.rms) > 0.2 && lim(g + tgt - m.rms) !== g) { g = lim(g + tgt - m.rms); m = await page.evaluate(level, { id, gain: g, rate: opt.rate }); }
      // 峰值别太靠近 0 dB（渲染检查 |x| > 0.999 算削波）
      if (m.peak > PEAK && g > CUT) { g = lim(g - (m.peak - PEAK) - 0.1); m = await page.evaluate(level, { id, gain: g, rate: opt.rate }); notes.push('峰值太高，少加一点'); }
      if (g === BOOST && m.rms < tgt - 0.3) notes.push('加到上限 +' + BOOST + ' dB 还差 ' + r1(tgt - m.rms) + ' dB（曲子本身太小声，改 mix/配器）');
      if (g === CUT && m.rms > tgt + 0.3) notes.push('减到下限 ' + CUT + ' dB 还多 ' + r1(m.rms - tgt) + ' dB（曲子本身太大声，改 mix/配器）');
      res[id] = r1(g);
      console.log(pad(id, 16) + pad(grp, 8) + lpad(tgt, 7) + lpad(r1(raw.rms), 9) + lpad((g > 0 ? '+' : '') + r1(g), 8) + lpad(r1(m.rms), 8) + lpad(r1(m.peak), 7) + (notes.length ? '  ← ' + notes.join('；') : ''));
    } catch (e) {
      bad++;
      console.log(pad(id, 16) + '  渲染出错：' + e.message.split('\n')[0]);
    }
  }
  const sorted = {};
  Object.keys(res).sort().forEach(k => { sorted[k] = res[k]; });
  fs.writeFileSync(opt.out, JSON.stringify(sorted, null, 2) + '\n');
  console.log('\n写出 ' + opt.out + '（' + Object.keys(sorted).length + ' 首）。接着跑 node tools/music/build.js 把校正并进 music-data.js');
  return bad;
}

(async () => {
  const dataFile = opt.data ? path.resolve(opt.data) : path.join(ROOT, 'music-data.js');
  if (!fs.existsSync(dataFile)) { console.log('没有 ' + dataFile + '：先跑 node tools/music/build.js'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (opt.data) {
    // 用指定的乐谱，并且挡住页面自己加载的 music-data.js
    const src = fs.readFileSync(dataFile, 'utf8');
    await page.addInitScript({ content: src + '\n;(function(){var m=window.MUSIC;Object.defineProperty(window,"MUSIC",{get:function(){return m},set:function(){},configurable:true});})();' });
  }
  await page.goto('file:///' + path.join(ROOT, 'tools', 'music.html').replace(/\\/g, '/') + '?music');
  await page.waitForFunction(() => window.EchoMusic && window.MUSIC);
  let ids = await page.evaluate(() => Object.keys(window.MUSIC.songs));
  if (opt.ids.length) {
    const miss = opt.ids.filter(id => !ids.includes(id));
    if (miss.length) console.log('没有这几首：' + miss.join(' '));
    ids = opt.ids.filter(id => ids.includes(id));
  }
  if (opt.levels) {
    const bad = (await levels(page, ids)) + (errors.length ? 1 : 0);
    if (errors.length) console.log('\n页面错误：\n  ' + errors.join('\n  '));
    await browser.close();
    process.exit(bad ? 1 : 0);
  }
  if (opt.wav) fs.mkdirSync(opt.wav, { recursive: true });
  const pad = (s, n) => String(s).padEnd(n);
  const lpad = (s, n) => String(s).padStart(n);
  console.log(pad('曲子', 16) + lpad('渲染秒', 7) + lpad('峰值dB', 8) + lpad('RMS dB', 8) + lpad('削波', 6) + lpad('最长静音', 9) + lpad('接缝dB', 8) + lpad('接回', 7) + lpad('两遍差', 7) + lpad('速度×', 7) + lpad('同时', 5) + lpad('校正', 6));
  let bad = 0;
  const problems = [];
  let totalAudio = 0, totalMs = 0;
  for (const id of ids) {
    let r;
    try {
      r = await page.evaluate(measure, { id, rate: opt.rate, seconds: opt.seconds, wav: !!opt.wav });
    } catch (e) {
      bad++;
      console.log(pad(id, 16) + '  渲染出错：' + e.message.split('\n')[0]);
      continue;
    }
    totalAudio += r.seconds; totalMs += r.ms;
    const flags = [];
    if (r.clip) flags.push('削波 ' + r.clip + ' 个采样');
    if (r.nan) flags.push('NaN ' + r.nan + ' 个');
    if (r.peak > -1 && !r.clip) flags.push('峰值离 0 dB 不到 1 dB');
    if (r.rms < -30) flags.push('整体太小声（RMS ' + r.rms + ' dB）');
    if (r.loop && r.silence > 1.5) flags.push('有 ' + r.silence + ' 秒的静音（背景音乐别超过 1.5 秒）');
    if (r.leadIn > 0.3) flags.push('开头 ' + r.leadIn + ' 秒没声音');
    if (r.seam != null && Math.abs(r.seam) > 6) flags.push('循环接缝前后音量差 ' + r.seam + ' dB');
    if (r.seamGap != null && r.seamGap < -6) flags.push('循环接回去的地方比第一遍小 ' + -r.seamGap + ' dB（漏音？）');
    if (r.loopDiff != null && r.loopDiff > 3) flags.push('第二遍和第一遍的音量平均差 ' + r.loopDiff + ' dB');
    if (r.steals) flags.push('同时发声超过上限，掐掉了 ' + r.steals + ' 个音');
    if (r.clip || r.nan) bad++;
    console.log(pad(id, 16) + lpad(r.seconds.toFixed(1), 7) + lpad(r.peak.toFixed(1), 8) + lpad(r.rms.toFixed(1), 8) + lpad(r.clip, 6) + lpad(r.silence.toFixed(2), 9) +
      lpad(r.seam == null ? '-' : r.seam, 8) + lpad(r.seamGap == null ? '-' : r.seamGap, 7) + lpad(r.loopDiff == null ? '-' : r.loopDiff, 7) + lpad(r.speed, 7) + lpad(r.voices == null ? '-' : r.voices, 5) + lpad(r.gain ? (r.gain > 0 ? '+' : '') + r.gain : '0', 6) + (flags.length ? '  ← ' + flags.join('；') : ''));
    if (flags.length) problems.push(id + '：' + flags.join('；'));
    if (opt.wav && r.wav) wavFile(path.join(opt.wav, id + '.wav'), r.wav, 2, r.sr);
  }
  if (errors.length) { bad++; console.log('\n页面错误：\n  ' + errors.join('\n  ')); }
  console.log('\n' + ids.length + ' 首，共 ' + totalAudio.toFixed(0) + ' 秒音频，渲染 ' + (totalMs / 1000).toFixed(1) + ' 秒（平均比实时快 ' + (totalAudio / (totalMs / 1000 || 1)).toFixed(0) + ' 倍）' + (opt.wav ? '，WAV 在 ' + path.resolve(opt.wav) : ''));
  if (problems.length) console.log('要看一下的：\n  ' + problems.join('\n  '));
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
