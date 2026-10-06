// 战斗音效检查（battle-sfx.js，window.BattleSFX）：在无头 Chromium 里离线渲染每一个声音，量峰值、响度、时长；
// 再实时连放 100 次（50 次同一拍里 + 50 次每 10 毫秒一次）看会不会出错、同时发声有没有超上限、节点有没有收拾干净
//   node tools/sfx-check.js                 全部（17 属性 × 蓄力 / 出招 / 命中 × 3 档 + 过场 cutin / 暴击 crit / 受击 hit）
//   node tools/sfx-check.js fire water      只这几个（过场 / 暴击 / 受击写 cutin crit hit）
//   node tools/sfx-check.js --levels        量原始响度，算出音量校正写进 battle-sfx.js 的 BEGIN/END LEVELS 之间（只量几个时别的保留）
//   node tools/sfx-check.js --wav out/      顺便写出 WAV 试听：每个属性一个文件（蓄力、出招、命中 × 小 / 中 / 大，中间空 0.3 秒），common.wav 是过场 / 暴击 / 受击
//   --rate 48000 采样率（默认 44100）   --no-live 不做实时连放
// 打印：峰值 dBFS；响度 = K 加权（BS.1770 的滤波）、200 毫秒滑动窗口的最大值（耳朵对短声音大约按 200 毫秒积分，
//       比 LUFS 瞬时的 400 毫秒更公平：0.1 秒的「唰」和 0.5 秒的「呜——」一样响时读数也差不多）；目标；RMS（有声部分）；
//       时长（最后一个高于 -50 dBFS 的采样）；起音（第一个高于 -40 dBFS 的采样，命中要利落；总线压限器本身有 6 毫秒预读）；
//       亮度（5 kHz 以上的能量占几成，太高就刺耳）；软削波压到的采样比例；节点数
// 不合格（退出码 1）：峰值 > -3 dBFS、NaN、时长超上限、几乎没声音（响度 < -45）、命中 / 受击 / 暴击起音 > 25 毫秒、
//                     响度离目标超过 2 dB（校正过以后）、5 kHz 以上能量超过 30%、页面报错、连放出错 / 超上限 / 节点没收拾干净
const fs = require('fs');
const path = require('path');
const { chromium } = require('D:/Claude/echo-island/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'battle-sfx.js');
const args = process.argv.slice(2);
const opt = { only: [], levels: false, wav: null, rate: 44100, live: true };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--levels') opt.levels = true;
  else if (a === '--wav') opt.wav = args[++i];
  else if (a === '--rate') opt.rate = +args[++i];
  else if (a === '--no-live') opt.live = false;
  else opt.only.push(a);
}

// 响度目标（K 加权 200 毫秒最大，dB）：战斗配乐在「中」音量时大约 -27，英语朗读大约 -18～-20，game.js 原来的 SFX.hit 只有 -32；
// 大招命中比配乐响 5 dB 左右、比朗读小 3 dB 以上；小招、蓄力更轻（小招用得最多，别吵）
const TARGET = {
  charge: [-29.5, -28, -26.5],
  launch: [-27, -25.5, -24],
  impact: [-24.5, -23, -21.5],
  cutin: -24.5, crit: -23, hit: -24.5,
};
const targetOf = (phase, tier) => (Array.isArray(TARGET[phase]) ? TARGET[phase][tier] : TARGET[phase]);
const LIM = 9;        // 校正最多 ±9 dB（差更多说明配方本身要改）
const PEAK_MAX = -5;  // 校正后峰值别超过这个（软削波从 -6.9 dBFS 开始收，-5 以内只是轻轻压一下）

// 在页面里跑：渲染一个声音，量各种数
async function measure({ type, phase, tier, rate, gain, wav }) {
  const buf = await window.BattleSFX.render(type, phase, tier, { sampleRate: rate, gain });
  const A = buf.getChannelData(0), n = A.length, sr = buf.sampleRate, t0 = buf.stats.t0 || 0;
  // K 加权（BS.1770 的近似：1.5 kHz 高架 +4 dB + 38 Hz 高通）
  const oc = new OfflineAudioContext(1, n, sr), s = oc.createBufferSource(), sh = oc.createBiquadFilter(), hp = oc.createBiquadFilter();
  s.buffer = buf;
  sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4;
  hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
  s.connect(sh); sh.connect(hp); hp.connect(oc.destination); s.start();
  const K = (await oc.startRendering()).getChannelData(0);
  // 亮度：5 kHz 以上（两级巴特沃斯高通，24 dB/八度；高通的 Q 单位是 dB，-3.01 = 不鼓包）的能量占全部的比例
  const oh = new OfflineAudioContext(1, n, sr), s2 = oh.createBufferSource(), h1 = oh.createBiquadFilter(), h2 = oh.createBiquadFilter();
  s2.buffer = buf; h1.type = h2.type = 'highpass'; h1.frequency.value = h2.frequency.value = 5000; h1.Q.value = h2.Q.value = -3.01;
  s2.connect(h1); h1.connect(h2); h2.connect(oh.destination); s2.start();
  const H = (await oh.startRendering()).getChannelData(0);
  let eAll = 0, eHi = 0;
  for (let i = 0; i < n; i++) { eAll += A[i] * A[i] || 0; eHi += H[i] * H[i] || 0; }
  let pk = 0, nan = 0, knee = 0, first = -1, last = -1;
  for (let i = 0; i < n; i++) {
    const x = A[i];
    if (x !== x) { nan++; continue; }
    const a = Math.abs(x);
    if (a > pk) pk = a;
    if (a > 0.45) knee++;
    if (first < 0 && a > 0.01) first = i;
    if (a > 0.00316) last = i;
  }
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + (K[i] === K[i] ? K[i] * K[i] : 0);
  const W = Math.round(0.2 * sr), step = Math.round(0.005 * sr);
  let best = 0;
  for (let i = Math.min(W, n); i <= n; i += step) { const m = (cum[i] - cum[Math.max(0, i - W)]) / W; if (m > best) best = m; }
  let act = 0;
  if (first >= 0) { for (let i = first; i <= last; i++) act += A[i] * A[i]; act /= Math.max(1, last - first + 1); }
  const db = x => (x > 1e-9 ? 20 * Math.log10(x) : -120);
  const out = {
    type, phase, tier, gain: buf.stats.gain, sources: buf.stats.sources, nodes: buf.stats.nodes, max: buf.stats.max,
    peak: +db(pk).toFixed(2), loud: +(best > 1e-12 ? -0.691 + 10 * Math.log10(best) : -120).toFixed(2), rms: +db(Math.sqrt(act)).toFixed(2),
    len: last < 0 ? 0 : +((last + 1) / sr - t0).toFixed(3), lead: first < 0 ? -1 : +((first / sr - t0) * 1000).toFixed(1),
    knee: +(knee / n * 100).toFixed(2), nan, hi: eAll > 0 ? Math.round(eHi / eAll * 100) : 0,
  };
  if (wav) out.samples = Array.from(A.subarray(0, Math.min(n, last + Math.round(0.02 * sr))));
  return out;
}

function wavFile(file, samples, sr) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) { const v = Math.max(-1, Math.min(1, samples[i] || 0)); pcm.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), i * 2); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

// 把校正写进 battle-sfx.js 的 BEGIN/END LEVELS 之间
function writeLevels(L, types) {
  const src = fs.readFileSync(FILE, 'utf8');
  const a = src.indexOf('// BEGIN LEVELS'), b = src.indexOf('// END LEVELS');
  if (a < 0 || b < a) throw new Error('battle-sfx.js 里找不到 BEGIN/END LEVELS');
  const lineStart = src.lastIndexOf('\n', a) + 1, ind = src.slice(lineStart, a);
  const f = x => (Math.round(x * 10) / 10).toFixed(1);
  const rows = types.filter(t => L[t]).map(t => ind + '  ' + t + ': [' + L[t].map(r => '[' + r.map(f).join(', ') + ']').join(', ') + '],');
  const tail = ['cutin', 'crit', 'hit'].filter(k => typeof L[k] === 'number').map(k => k + ': ' + f(L[k])).join(', ');
  const body = '// BEGIN LEVELS\n' + ind + 'const LEVELS = {\n' + rows.join('\n') + '\n' + (tail ? ind + '  ' + tail + ',\n' : '') + ind + '};\n' + ind;
  fs.writeFileSync(FILE, src.slice(0, a) + body + src.slice(b));
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><title>sfx</title></head><body style="background:#123"></body></html>');
  await page.addScriptTag({ path: FILE });
  const info = await page.evaluate(() => ({ types: window.BattleSFX.TYPES, max: window.BattleSFX.MAXLEN, levels: JSON.parse(JSON.stringify(window.BattleSFX.LEVELS)) }));

  // 要量的声音
  const want = opt.only.length ? opt.only : info.types.concat(['cutin', 'crit', 'hit']);
  const bad = want.filter(w => !info.types.includes(w) && !['cutin', 'crit', 'hit'].includes(w));
  if (bad.length) { console.log('不认识：' + bad.join(' ')); process.exit(1); }
  const list = [];
  want.forEach(w => {
    if (info.types.includes(w)) ['charge', 'launch', 'impact'].forEach(p => [0, 1, 2].forEach(t => list.push({ type: w, phase: p, tier: t })));
    else list.push({ type: 'normal', phase: w, tier: 2 });
  });
  const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
  const nameOf = r => (['cutin', 'crit', 'hit'].includes(r.phase) ? r.phase : r.type + '.' + r.phase + '.' + r.tier);
  let fail = 0;

  if (opt.levels) {
    // 量原始响度（校正当 0）→ 算校正 → 带着校正再量一遍，压限器不线性时再修一次
    const L = JSON.parse(JSON.stringify(info.levels || {}));
    console.log(pad('声音', 20) + lpad('目标', 7) + lpad('原始', 8) + lpad('校正', 7) + lpad('校正后', 8) + lpad('峰值', 7));
    for (const r of list) {
      const tgt = targetOf(r.phase, r.tier);
      const raw = await page.evaluate(measure, Object.assign({ rate: opt.rate, gain: 0 }, r));
      const lim = g => Math.max(-LIM, Math.min(LIM, g));
      let g = lim(tgt - raw.loud), m = await page.evaluate(measure, Object.assign({ rate: opt.rate, gain: g }, r));
      for (let k = 0; k < 2 && Math.abs(tgt - m.loud) > 0.2 && lim(g + tgt - m.loud) !== g; k++) {
        g = lim(g + tgt - m.loud);
        m = await page.evaluate(measure, Object.assign({ rate: opt.rate, gain: g }, r));
      }
      let note = '';
      if (m.peak > PEAK_MAX) {   // 很短很尖的声音：响度到了目标峰值却太高，少加一点
        g = lim(g - (m.peak - PEAK_MAX) - 0.1);
        m = await page.evaluate(measure, Object.assign({ rate: opt.rate, gain: g }, r));
        note = '  ← 峰值限制，少加一点';
      }
      if (Math.abs(g) >= LIM) note += '  ← 校正到头了，改配方';
      else if (Math.abs(tgt - m.loud) > 1) note += '  ← 还差 ' + (tgt - m.loud).toFixed(1) + ' dB';
      console.log(pad(nameOf(r), 20) + lpad(tgt, 7) + lpad(raw.loud.toFixed(1), 8) + lpad((g > 0 ? '+' : '') + g.toFixed(1), 7) + lpad(m.loud.toFixed(1), 8) + lpad(m.peak.toFixed(1), 7) + note);
      if (['cutin', 'crit', 'hit'].includes(r.phase)) L[r.phase] = g;
      else {
        L[r.type] = L[r.type] || [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        L[r.type][{ charge: 0, launch: 1, impact: 2 }[r.phase]][r.tier] = g;
      }
    }
    writeLevels(L, info.types);
    console.log('\n音量校正写进了 ' + FILE + '（BEGIN/END LEVELS）。再跑一遍 node tools/sfx-check.js 看结果');
    await browser.close();
    process.exit(errors.length ? 1 : 0);
  }

  console.log(pad('声音', 20) + lpad('峰值dB', 8) + lpad('响度', 7) + lpad('目标', 7) + lpad('RMS', 7) + lpad('时长s', 7) + lpad('上限', 6) + lpad('起音ms', 8) + lpad('亮度%', 7) + lpad('削波%', 7) + lpad('节点', 6) + lpad('校正', 6));
  const rows = [];
  const levelsSet = Object.keys(info.levels || {}).length > 0;
  for (const r of list) {
    let m;
    try { m = await page.evaluate(measure, Object.assign({ rate: opt.rate, wav: !!opt.wav }, r)); } catch (e) { fail++; console.log(pad(nameOf(r), 20) + '  渲染出错：' + e.message.split('\n')[0]); continue; }
    rows.push(m);
    const tgt = targetOf(r.phase, r.tier), flags = [];
    if (m.peak > -3) flags.push('峰值超过 -3 dBFS');
    if (m.nan) flags.push('NaN ' + m.nan);
    if (m.len > m.max + 0.005) flags.push('超过上限 ' + m.max + ' 秒');
    if (m.loud < -45) flags.push('几乎没声音');
    if (['impact', 'hit', 'crit'].includes(r.phase) && m.lead > 25) flags.push('起音太慢');
    if (m.lead < 0) flags.push('没声音');
    if (levelsSet && Math.abs(m.loud - tgt) > 2) flags.push('离目标 ' + (m.loud - tgt).toFixed(1) + ' dB');
    if (m.knee > 3) flags.push('软削波压得多（' + m.knee + '%）');
    if (m.hi > 30) flags.push('高频太多，可能刺耳（5 kHz 以上 ' + m.hi + '%）');
    if (flags.length) fail++;
    console.log(pad(nameOf(r), 20) + lpad(m.peak.toFixed(1), 8) + lpad(m.loud.toFixed(1), 7) + lpad(tgt, 7) + lpad(m.rms.toFixed(1), 7) + lpad(m.len.toFixed(2), 7) + lpad(m.max, 6) + lpad(m.lead, 8) + lpad(m.hi, 7) + lpad(m.knee, 7) + lpad(m.nodes + m.sources, 6) + lpad(m.gain ? (m.gain > 0 ? '+' : '') + m.gain.toFixed(1) : '0', 6) + (flags.length ? '  ← ' + flags.join('；') : ''));
  }
  // 各阶段汇总
  const groups = {};
  rows.forEach(m => { const k = ['cutin', 'crit', 'hit'].includes(m.phase) ? m.phase : m.phase + ' ' + m.tier; (groups[k] = groups[k] || []).push(m); });
  console.log('\n' + pad('分组', 12) + lpad('个数', 5) + lpad('峰值最大', 9) + lpad('响度最小', 9) + lpad('响度最大', 9) + lpad('时长最短', 9) + lpad('时长最长', 9) + lpad('亮度最高', 9) + lpad('节点最多', 9));
  Object.keys(groups).forEach(k => {
    const g = groups[k], mx = f => Math.max.apply(null, g.map(f)), mn = f => Math.min.apply(null, g.map(f));
    console.log(pad(k, 12) + lpad(g.length, 5) + lpad(mx(m => m.peak).toFixed(1), 9) + lpad(mn(m => m.loud).toFixed(1), 9) + lpad(mx(m => m.loud).toFixed(1), 9) + lpad(mn(m => m.len).toFixed(2), 9) + lpad(mx(m => m.len).toFixed(2), 9) + lpad(mx(m => m.hi) + '%', 9) + lpad(mx(m => m.nodes + m.sources), 9));
  });

  // 参考：game.js 原来的 SFX.hit / SFX.ok（同样的量法），看看新音效和老音效、朗读比起来多响
  const ref = await page.evaluate(async rate => {
    const sr = rate, oc = new OfflineAudioContext(1, Math.ceil(sr * 0.6), sr);
    const tone = (f, t0, dur, type, vol) => {
      const o = oc.createOscillator(), g = oc.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(oc.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    };
    tone(140, 0.01, 0.18, 'square', 0.1); tone(90, 0.07, 0.25, 'sawtooth', 0.08);   // SFX.hit
    const b = await oc.startRendering(), A = b.getChannelData(0);
    const k = new OfflineAudioContext(1, A.length, sr), s = k.createBufferSource(), sh = k.createBiquadFilter(), hp = k.createBiquadFilter();
    s.buffer = b; sh.type = 'highshelf'; sh.frequency.value = 1500; sh.gain.value = 4; hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
    s.connect(sh); sh.connect(hp); hp.connect(k.destination); s.start();
    const K = (await k.startRendering()).getChannelData(0);
    let pk = 0, best = 0;
    const W = Math.round(0.2 * sr);
    for (let i = 0; i < A.length; i++) pk = Math.max(pk, Math.abs(A[i]));
    for (let i = W; i <= K.length; i += 100) { let m = 0; for (let j = i - W; j < i; j++) m += K[j] * K[j]; best = Math.max(best, m / W); }
    return { peak: 20 * Math.log10(pk), loud: -0.691 + 10 * Math.log10(best) };
  }, opt.rate);
  console.log('\n参考：game.js 原来的 SFX.hit 峰值 ' + ref.peak.toFixed(1) + ' dBFS、响度 ' + ref.loud.toFixed(1) + '（命中时 monsters.js 也会放它）');

  if (opt.wav) {
    fs.mkdirSync(opt.wav, { recursive: true });
    const gap = new Array(Math.round(opt.rate * 0.3)).fill(0);
    const byType = {};
    rows.forEach(m => { const k = ['cutin', 'crit', 'hit'].includes(m.phase) ? 'common' : m.type; (byType[k] = byType[k] || []).push(m); });
    Object.keys(byType).forEach(k => {
      let s = [];
      byType[k].forEach(m => { s = s.concat(m.samples, gap); });
      wavFile(path.join(opt.wav, k + '.wav'), s, opt.rate);
    });
    console.log('WAV 写在 ' + path.resolve(opt.wav));
  }

  if (opt.live) {
    // 实时：先「点」一下页面（浏览器要求有过用户操作才让 AudioContext 出声）
    await page.mouse.click(10, 10);
    const live = [];
    const r = await page.evaluate(async () => {
      const S = window.BattleSFX, T = S.TYPES, P = ['charge', 'launch', 'impact', 'cutin', 'crit', 'hit'], errs = [];
      S.enabled = true;
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      let ok = 0, maxV = 0;
      const w0 = performance.now(), warm = S.warm(), warmMs = performance.now() - w0;   // 开战时提前建好 AudioContext
      const t0 = performance.now();
      for (let i = 0; i < 50; i++) { try { if (S.play(T[i % 17], P[i % 6], i % 3)) ok++; } catch (e) { errs.push(e.message); } maxV = Math.max(maxV, S.state().voices); }
      const burstMs = performance.now() - t0;
      const s1 = S.state();
      for (let i = 0; i < 50; i++) {
        try { if (S.play(T[(i * 7) % 17], P[(i * 5) % 6], (i * 2) % 3)) ok++; } catch (e) { errs.push(e.message); }
        maxV = Math.max(maxV, S.state().voices);
        await sleep(10);
      }
      const s2 = S.state();
      // 怪参数、关掉开关、掐掉全部
      try { S.play('nope', 'impact', 9); S.play('fire', 'nope', 1); S.play(); S.play('fire', 'impact', 'x'); S.play('fire', 'impact', -3); S.play('fire', 'impact', NaN); } catch (e) { errs.push(e.message); }
      S.enabled = false; const off = S.play('water', 'impact', 2); S.enabled = true;
      S.stopAll();
      await sleep(1600);
      const s3 = S.state();
      // 收拾完以后再放一个，确认还能用
      const again = S.play('spark', 'impact', 2);
      await sleep(1300);
      const s4 = S.state();
      return { ok, maxV, burstMs, errs, s1, s2, s3, s4, off, again, warm, warmMs };
    });
    if (!r.warm) live.push('warm() 没建好 AudioContext');
    if (r.errs.length) live.push('play() 抛错：' + r.errs.join('；'));
    if (r.maxV > 8) live.push('同时发声 ' + r.maxV + ' 个，超过上限 8');
    if (r.s3.alive !== 0 || r.s3.voices !== 0) live.push('停下来 1.6 秒后还有 ' + r.s3.alive + ' 个声音没收拾（voices ' + r.s3.voices + '）');
    if (r.s4.alive !== 0) live.push('再放一个之后还有 ' + r.s4.alive + ' 个没收拾');
    if (r.s4.errors) live.push('state().errors = ' + r.s4.errors);
    if (r.off !== false) live.push('enabled = false 时还放了');
    if (!r.again) live.push('收拾完以后不能再放');
    if (r.s1.ctx !== 'running') live.push('AudioContext 状态 ' + r.s1.ctx);
    console.log('\n实时：warm() 建 AudioContext ' + r.warmMs.toFixed(1) + ' 毫秒；连放：同一拍里 50 次（' + r.burstMs.toFixed(1) + ' 毫秒）+ 每 10 毫秒一次 50 次 → 真的放了 ' + r.ok + ' 个（同一个声音 40 毫秒内只放一次），同时最多 ' + r.maxV +
      ' 个，掐掉 ' + r.s2.stolen + ' 个，跳过 ' + r.s2.dropped + ' 个；AudioContext ' + r.s1.ctx + '；停下来以后没收拾的 ' + r.s3.alive + ' 个；曲线缓存 ' + r.s4.curves + ' 条');
    if (live.length) { fail++; console.log('  ✗ ' + live.join('\n  ✗ ')); } else console.log('  ✓ 没有报错，节点都收拾干净了');
  }

  if (errors.length) { fail++; console.log('\n页面报错 / 警告：\n  ' + errors.join('\n  ')); }
  console.log('\n' + rows.length + ' 个声音' + (fail ? '，有 ' + fail + ' 处要看' : '，全部合格'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
