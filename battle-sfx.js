// 回声岛 · 战斗音效（window.BattleSFX）：WebAudio 现场合成，不用音频文件（APK 不变大、没网也能放、没有版权问题）
// - 17 个属性 × 蓄力 charge / 出招 launch / 命中 impact × 小招 0 / 中招 1 / 大招 2，外加 大招过场 cutin、暴击 crit、通用受击 hit
//   battle3d.js 在放招的各个阶段调（kit.sfx → play），设置里关了音效时根本不会调；支援招式只调 charge 0
// - 风格：掌机 / 动画那样短、脆、亮。照顾孩子的耳朵：总线先切掉 70 Hz 以下、再柔和低通 7.2 kHz（不扎耳朵），
//   压限器 + 软削波（输出峰值一定不超过 -3.3 dBFS；单个声音实测都在 -7 dBFS 以下），
//   各声音按「K 加权、200 毫秒窗口的响度」对齐到适中的目标（LEVELS）：蓄力 -29.5/-28/-26.5、出招 -27/-25.5/-24、命中 -24.5/-23/-21.5，
//   过场 -24.5、暴击 -23、受击 -24.5——战斗配乐（中音量）大约 -27、英语朗读大约 -18～-20，大招命中比配乐响、比朗读小
// - 手机小喇叭放不出 100 Hz 以下：闷响用带二、三次谐波的正弦（sin2），从 150–250 Hz 往下掉，小喇叭上也听得见「咚」
// - 时长上限：蓄力 0.7 s、出招 0.6 s、命中 0.8 s、过场 1.0 s、暴击 0.6 s、受击 0.4 s（到点统一淡出，配方写长了也不会超）
// - 第一次 play()（或 warm()）才创建 AudioContext（页面还没被点过就先不建，免得浏览器挂起它还报警告）；挂起了就 resume；
//   闲 60 秒 / 页面隐藏就挂起（手机省电），下一次 play() 再恢复；战斗画面（body.scr-battle）里不挂起，点屏幕也会先恢复
//   ——恢复要几十到几百毫秒，挂着的话这一招的蓄力声会晚。页面里第一个 AudioContext 新建要 70 毫秒左右（之后的不到 1 毫秒），
//   游戏里配乐 / 界面音效早就建过了；单独用时开战调一下 warm()，别让第一招卡这一下
// - 同时最多 8 个声音（多了先掐最早的，30 毫秒淡出）；同一个声音 40 毫秒内重复调只放一次；
//   每个声音的节点在最后一个音源结束时全部断开（另有兜底定时器）；AudioContext 卡在挂起时，没收拾掉的声音最多 16 个
// - 噪音（白 / 褐）、方波波形表、削波曲线按 AudioContext 只算一次；噼啪、电流跳频的曲线按参数缓存
// - 配乐在压低（英语朗读）时音效也小 6 dB，麦克风在听（EchoMusic hold）时不出声
// - 自动化测试里（navigator.webdriver）默认关着（enabled = false），网址带 ?sfx=1 或者自己设 BattleSFX.enabled = true 才出声
// 接口：play(type, phase, tier) → 有没有真的放；render(type, phase, tier, { sampleRate, gain, seed }) → Promise<AudioBuffer>
//       （OfflineAudioContext 离线渲染，和 play 同一套合成和总线，查电平用；gain 给了就代替 LEVELS 里的校正 dB）；
//       warm()（提前建好 AudioContext）、enabled（开关）、setVolume(0–1)、stopAll()、unlock()、state()、TYPES、PHASES、MAXLEN、LEVELS
// 检查：node tools/sfx-check.js（每个声音的峰值 / 响度 / 时长 / 亮度、实时连放 100 次）；改了配方后跑 --levels 重新量音量校正，写进下面 BEGIN/END 之间
// 注意：monsters.js 的 strike() 命中时还会放 game.js 的 E.SFX.hit()（响度约 -32，比这里的命中小很多，叠在一起问题不大）
(function () {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const QS = (typeof location !== 'undefined' && location.search) || '';
  const robot = typeof navigator !== 'undefined' && !!navigator.webdriver && !/[?&]sfx=1(?:&|$)/.test(QS);

  const TYPES = ['normal', 'fire', 'water', 'grass', 'spark', 'ice', 'fight', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];
  const PHASES = ['charge', 'launch', 'impact', 'cutin', 'crit', 'hit'];
  const PI3 = { charge: 0, launch: 1, impact: 2 };
  const MAXLEN = { charge: 0.7, launch: 0.6, impact: 0.8, cutin: 1.0, crit: 0.6, hit: 0.4 };   // 秒（含尾音）
  const MAX_VOICES = 8;     // 同时最多几个声音
  const MAX_PENDING = 16;   // AudioContext 没在跑时，节点还没收拾掉的声音最多几个（再多就不加了）
  const SAME_MS = 40;       // 同一个声音多少毫秒内重复调只放一次
  const IDLE_MS = 60000;    // 闲多久挂起 AudioContext（战斗画面里不挂起：恢复要几十到几百毫秒，蓄力声会晚）
  const DUCK_DB = -6;       // 英语朗读时音效小多少
  const BUS = 0.45;         // 总线增益（压限器自带约 +7 dB 的补偿增益，先压下来；每个声音的音量 = 配方 × LEVELS 校正）
  const CH = [0.3, 0.48, 0.66], LA = [0.25, 0.4, 0.56], IM = [0.36, 0.55, 0.76];   // 蓄力 / 出招 / 命中 三档的基本长度（秒）

  // 音量校正（dB）：node tools/sfx-check.js --levels 量完自动写在下面 BEGIN/END 之间，别手改
  // 属性：[[蓄力 0,1,2], [出招 0,1,2], [命中 0,1,2]]；cutin / crit / hit 各一个数
  // BEGIN LEVELS
  const LEVELS = {
    normal: [[-1.9, -2.9, -2.7], [5.8, 4.0, -1.0], [2.2, 0.0, -2.3]],
    fire: [[3.3, 2.0, -0.7], [1.2, -3.7, -3.7], [4.2, 1.6, 0.1]],
    water: [[1.3, 0.7, 0.4], [6.1, 2.2, -0.9], [5.6, 5.0, 4.5]],
    grass: [[6.5, 6.6, 0.9], [4.1, 4.6, 2.6], [6.9, 4.4, 1.6]],
    spark: [[1.7, 0.8, -1.3], [2.1, -2.1, -2.7], [3.5, 0.7, -0.9]],
    ice: [[6.8, 5.1, 6.1], [4.8, 5.1, 4.3], [5.5, 3.4, 2.6]],
    fight: [[1.2, 1.8, -3.1], [5.6, 4.8, 4.1], [5.6, 3.4, 0.1]],
    poison: [[1.3, -0.1, 1.4], [3.8, 1.5, 1.9], [7.0, 4.3, 5.3]],
    ground: [[1.2, -2.5, -2.4], [5.6, 8.1, -0.5], [-1.5, -3.1, -5.8]],
    flying: [[6.7, 3.5, 1.7], [5.1, 4.8, 4.9], [7.2, 5.2, 3.9]],
    psychic: [[1.3, 1.0, 1.6], [3.5, -1.1, -0.7], [5.7, 4.7, 2.9]],
    bug: [[1.7, 0.5, 0.1], [1.8, 1.9, 3.6], [6.7, 4.7, 3.8]],
    rock: [[2.8, 0.4, 0.6], [2.1, -2.7, -0.5], [-0.6, -2.8, -5.1]],
    ghost: [[0.3, 0.1, 0.8], [7.0, -2.2, -2.3], [8.0, 5.5, 2.9]],
    dragon: [[-2.8, -2.0, -0.2], [6.4, -4.0, -4.1], [0.0, -1.8, -3.5]],
    dark: [[1.1, -0.4, 0.4], [8.1, 2.3, 1.3], [5.6, 2.6, -1.9]],
    steel: [[5.4, 4.6, 4.9], [6.8, 3.1, 2.5], [3.2, 1.4, -1.0]],
    cutin: -2.9, crit: 3.3, hit: 2.5,
  };
  // END LEVELS
  function lvl(type, phase, tier) {
    const v = PI3[phase] != null ? LEVELS[type] && LEVELS[type][PI3[phase]] && LEVELS[type][PI3[phase]][tier] : LEVELS[phase];
    return typeof v === 'number' ? v : 0;
  }

  // 每个属性的「调」：充能琶音、过场和弦从这里起
  const KEY = {
    normal: 523, fire: 587, water: 440, grass: 494, spark: 659, ice: 784, fight: 392, poison: 370, ground: 262,
    flying: 698, psychic: 622, bug: 554, rock: 294, ghost: 330, dragon: 330, dark: 277, steel: 466,
  };
  const MAJ = [0, 4, 7], MIN = [0, 3, 7], SUS = [0, 5, 7], PENTA = [0, 2, 4, 7, 9], WHOLE = [0, 2, 4, 6, 8, 10];
  const st = n => Math.pow(2, n / 12);
  // 从 root 开始按音阶往上数 n 个音（超过一个八度接着往上）
  function scl(root, sc, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(root * st(sc[i % sc.length] + 12 * Math.floor(i / sc.length)));
    return out;
  }
  const mul = (f, m) => (Array.isArray(f) ? f.map(x => x * m) : f * m);
  const noop = () => {};
  const warn = e => { try { console.warn('[BattleSFX]', e && e.message || e); } catch (x) { /* 没有 console */ } };

  // 小随机数（固定种子：离线渲染每次都一样；曲线缓存也用它）
  function rng32(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // 软削波：|x| ≤ 0.45 原样，往上平滑地收到 0.676（≈ -3.4 dBFS），输入再大也不会超过
  const CLIP = (() => {
    const n = 2049, c = new Float32Array(n), K = 0.45, C = 0.68;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * 2 - 1, a = Math.abs(x);
      c[i] = Math.sign(x) * (a <= K ? a : K + (C - K) * Math.tanh((a - K) / (C - K)));
    }
    return c;
  })();

  // ---------- 每个 AudioContext 共用的噪音和波形（只算一次） ----------
  const KITS = new WeakMap();
  function kitOf(c) {
    let K = KITS.get(c);
    if (K) return K;
    K = { w: {}, white: null, brown: null, alive: 0 };   // alive：节点还没断开的声音
    const n = Math.round(c.sampleRate), wb = c.createBuffer(1, n, c.sampleRate), bb = c.createBuffer(1, n, c.sampleRate);
    const w = wb.getChannelData(0), b = bb.getChannelData(0), r = rng32(0x5eed);
    let last = 0, pk = 0;
    for (let i = 0; i < n; i++) {
      w[i] = r() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;   // 褐噪音：积分 + 漏（低沉的隆隆声）
      b[i] = last;
      pk = Math.max(pk, Math.abs(last));
    }
    for (let i = 0; i < n; i++) b[i] /= pk || 1;
    K.white = wb; K.brown = bb;
    // 方波（Lanczos σ 收掉高次泛音，边缘不振铃、不扎耳朵）
    const sig = (k, N) => (k === 1 ? 1 : Math.sin(Math.PI * k / (N + 1)) / (Math.PI * k / (N + 1)));
    const pulse = d => {
      const N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (let k = 1; k <= N; k++) re[k] = 4 / (k * Math.PI) * Math.sin(k * Math.PI * d) * sig(k, N);
      return c.createPeriodicWave(re, im);
    };
    K.w.p12 = pulse(0.125); K.w.p25 = pulse(0.25);
    // 正弦 + 二、三次谐波：手机小喇叭放不出的低音，靠谐波「听」出来
    K.w.sin2 = c.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.42, 0.18]));
    KITS.set(c, K);
    return K;
  }

  // 噼啪、电流跳频用的曲线：按参数缓存（同样的参数有 3 种变体，随机挑一种）
  const CURVES = new Map();
  function curveOf(key, make) {
    let c = CURVES.get(key);
    if (!c) { if (CURVES.size > 120) CURVES.clear(); c = make(rng32(hash(key))); CURVES.set(key, c); }
    return c;
  }
  // 噼啪：每秒 rate 个随机小爆（泊松间隔），2 毫秒一格的增益曲线
  function pops(rate, d, vr) {
    return curveOf('p' + rate + '|' + Math.round(d * 50) + '|' + vr, r => {
      const n = Math.max(6, Math.round(d * 500)), c = new Float32Array(n);
      let i = Math.floor(r() * 5);
      while (i < n - 1) {
        const a = 0.35 + 0.65 * r(), len = 2 + Math.floor(r() * 4);
        for (let j = 0; j < len && i + j < n; j++) c[i + j] = Math.max(c[i + j], a * Math.pow(0.45, j));
        i += Math.max(2, Math.round(-Math.log(1 - r() * 0.999) * 500 / rate));
      }
      c[n - 1] = 0;
      return c;
    });
  }
  // 电流：频率在 f 上下 spread 个八度里随机跳，每秒 rate 跳（每格重复 4 个点，听起来是「跳」不是「滑」）
  function steps(f, spread, rate, d, vr) {
    return curveOf('z' + Math.round(f) + '|' + spread + '|' + rate + '|' + Math.round(d * 50) + '|' + vr, r => {
      const k = Math.max(2, Math.round(d * rate)), c = new Float32Array(k * 4);
      for (let i = 0; i < k; i++) { const v = f * Math.pow(2, (r() * 2 - 1) * spread); for (let j = 0; j < 4; j++) c[i * 4 + j] = v; }
      return c;
    });
  }

  // ---------- 总线：低切 → 柔和低通 → 压限 → 音量 → 软削波 → 喇叭 ----------
  function master(c) {
    const bus = c.createGain(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), comp = c.createDynamicsCompressor(), vol = c.createGain(), clip = c.createWaveShaper();
    bus.gain.value = BUS;
    hp.type = 'highpass'; hp.frequency.value = 70; hp.Q.value = 0.7;
    lp.type = 'lowpass'; lp.frequency.value = Math.min(7200, c.sampleRate * 0.45); lp.Q.value = 0.6;
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
    clip.curve = CLIP;
    bus.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(vol); vol.connect(clip); clip.connect(c.destination);
    return { bus, hp, lp, comp, vol, clip };
  }

  // ---------- 一个声音（voice）和合成小零件 ----------
  // 时间 t 都是相对这个声音开始（秒）；d 长度；v 峰值音量；a 起音；h 保持（前百分之几不衰减）；
  // f 频率（数字，或 [起, …, 止] 指数滑音，用 gt 秒）；am: [速度 Hz, 深度 0–1] 颤音（音量）；vib: [速度 Hz, 音分] 揉音；lfo: [速度, Hz] 滤波器摆动
  function voice(c, dest, t0, rng, vol, max) {
    const K = kitOf(c), out = c.createGain();
    out.gain.value = vol;
    out.connect(dest);
    K.alive++;
    return { c, K, t0, rng, vol, max, out, nodes: [out], srcs: [], left: 0, end: t0, done: false, cents: 0, safe: 0 };
  }
  function gain(V, v) { const g = V.c.createGain(); g.gain.value = v; V.nodes.push(g); return g; }
  function filt(V, type, f, q) {
    const b = V.c.createBiquadFilter();
    b.type = type; b.frequency.value = Math.min(f, V.c.sampleRate * 0.45); b.Q.value = q == null ? 0.7 : q;
    V.nodes.push(b);
    return b;
  }
  function osc(V, w, f) {
    const o = V.c.createOscillator(), pw = V.K.w[w];
    if (pw) o.setPeriodicWave(pw); else o.type = w || 'sine';
    o.frequency.value = f;
    o.detune.value = V.cents;
    return o;
  }
  // 音源登记：t 开始、d 秒后停（不超过这个声音的上限）；全部停了就断开整个声音的节点
  function run(V, s, t, d, off) {
    const T = V.t0 + t, end = Math.min(T + d + 0.03, V.t0 + V.max + 0.01);
    if (end <= T + 0.002) return;
    if (off != null) s.start(T, off); else s.start(T);
    s.stop(end);
    V.srcs.push(s); V.left++;
    if (end > V.end) V.end = end;
    s.onended = () => { V.left--; if (V.left <= 0) cleanup(V); };
  }
  function cleanup(V) {
    if (V.done) return;
    V.done = true;
    clearTimeout(V.safe);
    V.srcs.forEach(s => { try { s.onended = null; s.disconnect(); } catch (e) { /* 已经断开 */ } });
    V.nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* 已经断开 */ } });
    V.srcs.length = 0; V.nodes.length = 0;
    V.K.alive--;
    const i = live.indexOf(V);
    if (i >= 0) live.splice(i, 1);
  }
  // 包络：0 → a 秒线性升到 v → 保持到 a + (d - a)·h → 指数落到几乎 0（t + d）
  function env(pm, T, a, v, d, h) {
    a = Math.max(0.001, Math.min(a, d * 0.95));
    v = Math.max(2e-4, v);
    pm.setValueAtTime(0, T);
    pm.linearRampToValueAtTime(v, T + a);
    if (h) pm.setValueAtTime(v, T + a + (d - a) * h);
    pm.exponentialRampToValueAtTime(1e-4, T + d);
  }
  // 频率：数字就定住；数组就按时间平均分段指数滑过去
  function sweep(V, pm, T, f, dur, cap) {
    const top = cap ? V.c.sampleRate * 0.45 : 1e6, lim = x => Math.max(10, Math.min(top, x));
    if (!Array.isArray(f)) { pm.setValueAtTime(lim(f), T); return; }
    pm.setValueAtTime(lim(f[0]), T);
    const n = f.length - 1;
    for (let i = 1; i <= n; i++) pm.exponentialRampToValueAtTime(lim(f[i]), T + Math.max(0.005, dur) * i / n);
  }
  function lfo(V, rate, depth, param, t, d) {
    const l = osc(V, 'sine', rate), g = gain(V, depth);
    l.detune.value = 0;
    l.connect(g); g.connect(param);
    run(V, l, t, d);
  }
  // 音量包络（+ 颤音）→ 这个声音的出口
  function out(V, x, o, t, d) {
    const g = gain(V, 0);
    env(g.gain, V.t0 + t, o.a || 0.004, o.v, d, o.h);
    x.connect(g);
    let y = g;
    if (o.am) { const m = gain(V, 1 - o.am[1] / 2); lfo(V, o.am[0], o.am[1] / 2, m.gain, t, d); y.connect(m); y = m; }
    y.connect(V.out);
  }
  // 振荡器音：w 波形（sine triangle square sawtooth / p25 p12 方波 / sin2）；lp 低通（可滑）
  function tone(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, s = osc(V, o.w || 'sine', 440);
    sweep(V, s.frequency, T, o.f, o.gt || d);
    if (o.vib) lfo(V, o.vib[0], o.vib[1], s.detune, t, d);
    let x = s;
    if (o.lp) { const fl = filt(V, 'lowpass', 1000, o.q); sweep(V, fl.frequency, T, o.lp, d, true); x.connect(fl); x = fl; }
    out(V, x, o, t, d);
    run(V, s, t, d);
  }
  // 滤波噪音：ft 滤波类型，f 截止 / 中心频率（可滑），kind 'white' | 'brown'
  function noise(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, s = V.c.createBufferSource();
    s.buffer = V.K[o.kind || 'white']; s.loop = true;
    const fl = filt(V, o.ft || 'bandpass', 1000, o.q);
    sweep(V, fl.frequency, T, o.f, o.gt || d, true);
    if (o.lfo) lfo(V, o.lfo[0], o.lfo[1], fl.frequency, t, d);
    s.connect(fl);
    out(V, fl, o, t, d);
    run(V, s, t, d, V.rng() * 0.9);
  }
  // 「唰」：带通噪音扫过去，中间最响
  function swish(V, t, d, f0, f1, v, q) { noise(V, { t, d, ft: 'bandpass', f: [f0, f1], q: q || 1, a: d * 0.45, v }); }
  // 闷响：sin2 从 f 往下掉 + 一小下「哒」（click 是相对音量，0 不要）
  function thud(V, o) {
    const t = o.t || 0, d = o.d, f = o.f;
    tone(V, { t, w: 'sin2', f: [f, f * 0.36], gt: d * 0.5, d, a: 0.002, h: 0.06, v: o.v });
    if (o.click !== 0) noise(V, { t, ft: 'bandpass', f: o.cf || 2400, q: 0.8, d: 0.022, a: 0.001, v: o.v * (o.click == null ? 0.5 : o.click) });
  }
  // 噼啪：白噪音 → 滤波 → 随机小爆（火的余烬、碎石、电火花、毒泡）
  function crackle(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, s = V.c.createBufferSource();
    s.buffer = V.K.white; s.loop = true;
    const fl = filt(V, o.ft || 'bandpass', o.f || 2500, o.q == null ? 0.8 : o.q), c = gain(V, 0);
    c.gain.setValueCurveAtTime(pops(o.rate || 20, d, Math.floor(V.rng() * 3)), T, d);
    s.connect(fl); fl.connect(c);
    out(V, c, { a: o.a || 0.01, v: o.v, h: o.h == null ? 0.5 : o.h }, t, d);
    run(V, s, t, d, V.rng() * 0.9);
  }
  // 电流：方波频率随机乱跳
  function zap(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, s = osc(V, o.w || 'p25', o.f);
    s.frequency.setValueCurveAtTime(steps(o.f, o.spread || 0.6, o.rate || 45, d, Math.floor(V.rng() * 3)), T, d);
    const fl = filt(V, 'lowpass', o.lp || 3000, 0.7);
    s.connect(fl);
    out(V, fl, { a: 0.003, v: o.v, h: o.h == null ? 0.5 : o.h }, t, d);
    run(V, s, t, d);
  }
  // 金属 / 铃（FM）：调制深度从 idx 落下去，「铛——」的亮声慢慢变圆
  function bell(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, c = osc(V, 'sine', o.f), m = osc(V, 'sine', o.f * o.ratio), mg = gain(V, 0);
    const i0 = (o.idx || 2) * o.f * o.ratio;
    mg.gain.setValueAtTime(i0, T);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, i0 * 0.06), T + d);
    m.connect(mg); mg.connect(c.frequency);
    out(V, c, { a: o.a || 0.002, v: o.v }, t, d);
    run(V, c, t, d); run(V, m, t, d);
  }
  // 掌机风琶音：一个振荡器按 step 秒换音，每个音重新起音
  function arp(V, o) {
    const t = o.t || 0, T = V.t0 + t, n = o.notes.length, step = o.step, d = n * step + (o.tail || 0.1);
    const s = osc(V, o.w || 'p25', o.notes[0]), g = gain(V, 0);
    for (let i = 0; i < n; i++) {
      const ti = T + i * step;
      s.frequency.setValueAtTime(o.notes[i], ti);
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(o.v, ti + 0.004);
      if (i < n - 1) g.gain.exponentialRampToValueAtTime(o.v * 0.35, ti + step * 0.9);
      else g.gain.exponentialRampToValueAtTime(1e-4, T + d);
    }
    let x = s;
    if (o.lp) { x = filt(V, 'lowpass', o.lp, 0.7); s.connect(x); }
    x.connect(g); g.connect(V.out);
    run(V, s, t, d);
  }
  // 一串短音（气泡、水滴、冰晶叮叮）：同一个振荡器按顺序发声；seq 给了就按这些音，不然在 f: [低, 高] 里随机；bend 每个音结尾 / 开头的频率比
  function blips(V, o) {
    const t = o.t || 0, T = V.t0 + t, n = o.n, gap = o.gap, r = V.rng, len = Math.min(o.len, gap * 0.66);
    const s = osc(V, o.w || 'sine', 440), g = gain(V, 0);
    let tt = T;
    for (let i = 0; i < n; i++) {
      const f0 = o.seq ? o.seq[i % o.seq.length] : o.f[0] * Math.pow(o.f[1] / o.f[0], r());
      const amp = o.v * (o.seq ? 1 : 0.7 + 0.3 * r());
      s.frequency.setValueAtTime(f0, tt);
      if (o.bend && o.bend !== 1) s.frequency.exponentialRampToValueAtTime(f0 * o.bend, tt + len * 0.9);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(amp, tt + 0.003);
      g.gain.exponentialRampToValueAtTime(1e-4, tt + len);
      if (i < n - 1) tt += o.seq ? gap : gap * (0.7 + 0.6 * r());
    }
    s.connect(g); g.connect(V.out);
    run(V, s, t, tt - T + len);
  }
  // 低吼：两个差一点点的锯齿波 → 低通（截止快速摆动 = 喉咙里的「呼噜」）
  function growl(V, o) {
    const t = o.t || 0, d = o.d, T = V.t0 + t, fl = filt(V, 'lowpass', o.lp || 700, o.q || 3);
    [1, 1.013].forEach(m => { const s = osc(V, 'sawtooth', 100); sweep(V, s.frequency, T, mul(o.f, m), o.gt || d); s.connect(fl); run(V, s, t, d); });
    lfo(V, o.rate || 18, o.depth || 280, fl.frequency, t, d);
    out(V, fl, o, t, d);
  }
  // 和弦：iv 是半音数
  function chord(V, o) { o.iv.forEach(i => tone(V, Object.assign({}, o, { f: mul(o.f, st(i)) }))); }
  // 中招、大招蓄力的「充能」琶音（中招 4 个音、大招 7 个音）
  function riser(V, k, root, sc, w) {
    if (!k) return;
    arp(V, { t: k === 1 ? 0.12 : 0.1, notes: scl(root, sc, k === 1 ? 4 : 7), step: k === 1 ? 0.08 : 0.06, w: w || 'p25', v: k === 1 ? 0.06 : 0.075, lp: 2600, tail: 0.12 });
  }

  // ---------- 17 个属性的配方：R[type][phase](V, tier) ----------
  const R = {};
  // 一般：「呼」地冲过去，「咚」+ 命中星「叮」；大招「巨人跺脚」地面一震
  R.normal = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { w: 'triangle', f: [262, 523 * (1 + k * 0.25)], d, a: d * 0.6, v: 0.16 });
      if (k === 2) noise(V, { ft: 'lowpass', f: [500, 2400], d, a: d * 0.8, v: 0.07 });
      riser(V, k, KEY.normal, MAJ);
    },
    launch(V, k) {
      swish(V, 0, [0.2, 0.3, 0.42][k], 500, 2400, k === 2 ? 0.32 : 0.45);
      if (k >= 1) blips(V, { t: 0.06, n: 2 + k, gap: 0.07, len: 0.045, seq: [1319, 1568, 1976, 2637], w: 'triangle', v: 0.09 });
      if (k === 2) tone(V, { w: 'sin2', f: [90, 62], d: 0.5, a: 0.3, v: 0.15 });
    },
    impact(V, k) {
      thud(V, { f: [200, 175, 150][k], d: [0.25, 0.35, 0.5][k], v: 0.5 + k * 0.05 });
      noise(V, { ft: 'lowpass', f: [1800, 300], d: [0.15, 0.3, 0.5][k], a: 0.003, v: 0.18 + k * 0.06 });
      if (k >= 1) blips(V, { t: 0.02, n: k + 1, gap: 0.07, len: 0.045, seq: [1568, 2093, 2637], w: 'triangle', v: 0.1 });
      if (k === 2) crackle(V, { t: 0.05, d: 0.45, rate: 20, ft: 'lowpass', f: 1500, v: 0.25 });
    },
  };
  // 火：「呼——」吸气 + 火星噼啪；喷火「呼——」；命中「轰」+ 余烬噼啪
  R.fire = {
    charge(V, k) {
      const d = CH[k];
      noise(V, { ft: 'lowpass', f: [300, 1600 + k * 500], d, a: d * 0.75, v: 0.22, q: 1.2 });
      crackle(V, { d, rate: 18 + k * 8, ft: 'bandpass', f: 2000, v: 0.28, a: d * 0.5 });
      if (k === 2) tone(V, { w: 'sawtooth', f: [65, 98], d, a: d * 0.7, v: 0.07, lp: 420, q: 2 });
      riser(V, k, KEY.fire, MAJ);
    },
    launch(V, k) {
      const d = LA[k];
      noise(V, { ft: 'bandpass', f: [1200, 380], d, a: 0.03, h: 0.25, v: k ? 0.32 : 0.45, q: 0.7 });
      crackle(V, { d, rate: 30, ft: 'bandpass', f: 2200, v: 0.22 });
      if (k >= 1) growl(V, { f: k === 2 ? 82 : 98, d, a: 0.05, h: 0.3, v: 0.12, lp: 700, rate: 17, depth: 260 });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'lowpass', f: [3600, 220], gt: d * 0.7, d, a: 0.004, v: 0.45 + k * 0.05, q: 0.9 });
      thud(V, { f: [175, 155, 135][k], d: d * 0.6, v: 0.4 });
      crackle(V, { t: 0.04, d: d - 0.04, rate: 22, ft: 'bandpass', f: 2000, v: 0.26, h: 0.2 });
    },
  };
  // 水：气泡「咕噜咕噜」往上冒；泡泡弹「啵」/ 浪「哗——」；命中「哗啦」+ 水滴落下
  R.water = {
    charge(V, k) {
      const d = CH[k], n = [4, 6, 9][k];
      blips(V, { n, gap: d / (n + 0.5), len: 0.05, f: [380, 900], bend: 1.9, w: 'sine', v: 0.28 });
      if (k) noise(V, { ft: 'lowpass', f: [400, 1100], d, a: d * 0.7, v: 0.1, lfo: [5, 250] });
      riser(V, k, KEY.water, PENTA, 'triangle');
    },
    launch(V, k) {
      if (k === 0) {
        tone(V, { f: [320, 980], d: 0.11, a: 0.005, v: 0.38 });
        noise(V, { t: 0.02, ft: 'bandpass', f: [2600, 1200], d: 0.14, v: 0.18 });
        blips(V, { t: 0.1, n: 2, gap: 0.06, len: 0.04, f: [600, 900], bend: 1.7, v: 0.15 });
        return;
      }
      const d = LA[k];
      noise(V, { ft: 'lowpass', f: [350, 1500, 700], d, a: d * 0.45, v: 0.38, q: 0.8, lfo: [6, 200] });
      noise(V, { ft: 'bandpass', f: [900, 2600], d, a: d * 0.5, v: 0.12, q: 0.6 });
      blips(V, { t: 0.04, n: 3 + k * 2, gap: 0.07, len: 0.045, f: [420, 1000], bend: 1.8, v: 0.14 });
      if (k === 2) tone(V, { w: 'sin2', f: [70, 95], d, a: d * 0.5, v: 0.12 });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'bandpass', f: [2400, 650], d: d * 0.7, a: 0.003, v: 0.5, q: 0.6 });
      thud(V, { f: 210, d: 0.16 + k * 0.06, v: 0.28 + k * 0.06, click: 0.3 });
      blips(V, { t: 0.05, n: 3 + k * 2, gap: 0.06, len: 0.04, f: [900, 2200], bend: 0.6, v: 0.14 });
    },
  };
  // 草：叶子「沙沙」+ 五声音阶「叮」；叶片「咻咻」/ 藤蔓「啪」/ 阳光和弦升起来；命中「啪」+ 沙沙，大招花开「叮铃」
  R.grass = {
    charge(V, k) {
      const d = CH[k], n = 2 + k * 2;
      noise(V, { ft: 'bandpass', f: [1800, 2600], d, a: d * 0.6, v: 0.14, q: 1.2, am: [14, 0.7] });
      blips(V, { n, gap: d / (n + 0.5), len: 0.1, seq: scl(KEY.grass, PENTA, n), w: 'triangle', v: 0.09 });
      if (k === 2) chord(V, { f: KEY.grass, iv: [0, 4, 7, 12], d, a: d * 0.8, v: 0.05, w: 'triangle' });
    },
    launch(V, k) {
      if (k === 0) { swish(V, 0, 0.12, 1200, 3200, 0.45, 1.6); swish(V, 0.11, 0.12, 1100, 3000, 0.4, 1.6); return; }
      if (k === 1) {
        swish(V, 0, 0.16, 600, 2600, 0.32, 1.2);
        noise(V, { t: 0.17, ft: 'bandpass', f: 2200, q: 0.7, d: 0.03, a: 0.001, v: 0.45 });
        tone(V, { t: 0.17, f: [1900, 420], d: 0.1, v: 0.16 });
        return;
      }
      chord(V, { f: [KEY.grass, KEY.grass * 2], iv: [0, 4, 7], d: 0.55, gt: 0.45, a: 0.3, v: 0.07, w: 'triangle' });
      blips(V, { t: 0.15, n: 5, gap: 0.07, len: 0.045, seq: scl(KEY.grass * 2, PENTA, 5), w: 'triangle', v: 0.06 });
      swish(V, 0.05, 0.4, 600, 2600, 0.2, 1);
    },
    impact(V, k) {
      noise(V, { ft: 'bandpass', f: 1600, d: 0.08, a: 0.001, v: 0.6, q: 1.2 });
      thud(V, { f: 240, d: 0.18 + k * 0.08, v: 0.42 + k * 0.05, click: 0 });
      noise(V, { t: 0.03, ft: 'bandpass', f: 2600, d: IM[k] - 0.05, a: 0.02, v: 0.12, q: 1, am: [18, 0.7] });
      if (k === 2) arp(V, { t: 0.03, notes: scl(KEY.grass * 2, MAJ, 5), step: 0.035, w: 'triangle', v: 0.1, tail: 0.35 });
    },
  };
  // 电：「嗡——」充电 + 电火花；「噼」+ 电流乱跳 / 光束嗡嗡 / 雷声「咔啦」；命中电流 + 噼啪，大招「轰隆」
  R.spark = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { w: 'sawtooth', f: [110, 220 + k * 40], d, a: d * 0.7, v: 0.13, lp: 1600, q: 3, am: [30, 0.5] });
      crackle(V, { d, rate: 25 + k * 10, ft: 'bandpass', f: 3000, q: 0.6, v: 0.2, a: d * 0.5 });
      if (k === 2) zap(V, { t: d * 0.5, d: d * 0.45, f: 1200, spread: 0.6, rate: 45, v: 0.07 });
      riser(V, k, KEY.spark, MAJ, 'p12');
    },
    launch(V, k) {
      const d = LA[k];
      noise(V, { ft: 'highpass', f: 2200, d: 0.04 + k * 0.02, a: 0.001, v: 0.45 });
      zap(V, { d: [0.15, 0.36, 0.45][k], f: 950, spread: 0.55, rate: 50, v: 0.14, lp: 3200 });
      if (k >= 1) tone(V, { w: 'sawtooth', f: 175, d, a: 0.02, h: 0.6, v: 0.06, lp: 2000, q: 2, am: [55, 0.6] });
      if (k === 2) noise(V, { t: 0.02, ft: 'lowpass', f: [5000, 300], d: d - 0.02, a: 0.002, v: 0.35 });
    },
    impact(V, k) {
      const d = IM[k];
      zap(V, { d: 0.12 + k * 0.08, f: 1100, spread: 0.6, rate: 60, v: 0.14, lp: 3500 });
      crackle(V, { d: d * 0.8, rate: 40, ft: 'bandpass', f: 2600, q: 0.6, v: 0.26, h: 0.2 });
      thud(V, { f: 185, d: 0.2 + k * 0.1, v: 0.35 + k * 0.05 });
      if (k === 2) noise(V, { t: 0.03, ft: 'lowpass', f: [2500, 120], d: d - 0.03, a: 0.01, v: 0.45 });
    },
  };
  // 冰：冰晶「叮叮」+ 寒气；「铮」/ 风雪打转 / 冰川「吱嘎」；命中「咔嚓」碎冰 + 冰晶落下
  R.ice = {
    charge(V, k) {
      const d = CH[k], n = 3 + k * 3;
      blips(V, { n, gap: d / (n + 0.5), len: 0.1, seq: scl(KEY.ice * 2, PENTA, n), w: 'sine', v: 0.08 });
      noise(V, { ft: 'bandpass', f: 3000, q: 0.6, d, a: d * 0.7, v: 0.035 });
      if (k) noise(V, { ft: 'bandpass', f: [700, 1500], d, a: d * 0.6, v: 0.12, q: 2, lfo: [4, 300] });
    },
    launch(V, k) {
      if (k === 0) { bell(V, { f: 1200, ratio: 3.01, idx: 1.2, d: 0.22, v: 0.2 }); swish(V, 0, 0.14, 1400, 3400, 0.35, 1.5); return; }
      const d = LA[k];
      noise(V, { ft: 'bandpass', f: [600, 2000, 900], d, a: d * 0.35, v: 0.45, q: 2.5, lfo: [7, 350] });
      blips(V, { t: 0.05, n: 4 + k * 2, gap: 0.07, len: 0.045, f: [1800, 3000], w: 'triangle', v: 0.1 });
      if (k === 2) tone(V, { w: 'sawtooth', f: [62, 48], d, a: 0.1, v: 0.1, lp: 380, q: 4, am: [13, 0.7] });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'bandpass', f: 2400, q: 0.6, d: 0.1 + k * 0.04, a: 0.001, v: 0.45 });
      bell(V, { f: 1250, ratio: 2.76, idx: 1.6, d: 0.3 + k * 0.15, v: 0.13 });
      bell(V, { t: 0.03, f: 1870, ratio: 2.76, idx: 1.2, d: 0.25 + k * 0.1, v: 0.09 });
      thud(V, { f: 200, d: 0.18 + k * 0.08, v: 0.3 + k * 0.07 });
      if (k >= 1) blips(V, { t: 0.08, n: 3 + k * 3, gap: 0.055, len: 0.036, f: [1300, 2600], bend: 0.85, w: 'triangle', v: 0.08 });
    },
  };
  // 功夫：踏步「咚」+「哈！」；出拳「唰」，大招三连击；命中「砰」+ 拳头「啪」
  R.fight = {
    charge(V, k) {
      const d = CH[k];
      thud(V, { f: 150, d: 0.12, v: 0.35, click: 0.3 });
      tone(V, { w: 'p25', f: [220, 440 + k * 110], d, a: d * 0.6, v: 0.08, lp: 1500 });
      if (k === 2) thud(V, { t: 0.3, f: 160, d: 0.12, v: 0.38, click: 0.3 });
      riser(V, k, KEY.fight, MAJ);
    },
    launch(V, k) {
      if (k < 2) {   // 出拳 / 踢腿「唰」：高的一层 + 低的一层（手机上也听得出「呼」）
        const d = k ? 0.22 : 0.15;
        swish(V, 0, d, 600, k ? 1800 : 2200, 0.55, 1.1);
        swish(V, 0, d, 250, 700, 0.35, 0.9);
        return;
      }
      // 大招：冲过去「呼——」，再三下拳风（每一拳打中的「砰」由特效那边调 impact 0，这里不重复）
      swish(V, 0, 0.2, 300, 1200, 0.75, 1);
      [0.19, 0.33, 0.47].forEach(t => swish(V, t, 0.08, 800, 2200, 0.65, 1.1));
    },
    impact(V, k) {
      const d = IM[k];
      thud(V, { f: [235, 205, 180][k], d: [0.16, 0.24, 0.4][k], v: 0.6, click: 0.6 });
      noise(V, { ft: 'bandpass', f: 1900, d: 0.035, a: 0.001, v: 0.45, q: 0.9 });
      if (k >= 1) noise(V, { ft: 'lowpass', f: [1600, 250], d: d * 0.7, a: 0.003, v: 0.25 + k * 0.05 });
      if (k === 2) crackle(V, { t: 0.03, d: 0.35, rate: 25, ft: 'lowpass', f: 1800, v: 0.22 });
    },
  };
  // 毒：低低的「咕嘟」+「嘶」；「啵」一滴 / 「嗤——」喷；命中「啪叽」+ 滋滋冒泡
  R.poison = {
    charge(V, k) {
      const d = CH[k], n = 3 + k * 2;
      blips(V, { n, gap: d / (n + 0.5), len: 0.07, f: [170, 380], bend: 1.6, w: 'sin2', v: 0.3 });
      noise(V, { ft: 'bandpass', f: 2800, q: 0.7, d, a: d * 0.7, v: 0.06 });
      riser(V, k, KEY.poison, MIN);
    },
    launch(V, k) {
      if (k === 0) {
        tone(V, { w: 'sin2', f: [950, 320], d: 0.14, v: 0.45 });
        blips(V, { t: 0.1, n: 2, gap: 0.07, len: 0.05, f: [220, 360], bend: 1.6, w: 'sin2', v: 0.25 });
        noise(V, { t: 0.05, ft: 'bandpass', f: 2600, q: 0.7, d: 0.15, v: 0.08 });
        return;
      }
      const d = LA[k];
      noise(V, { ft: 'bandpass', f: [1300, 2000], d, a: 0.03, h: 0.4, v: 0.26, q: 0.7, am: [9, 0.5] });
      blips(V, { t: 0.05, n: 2 + k * 2, gap: 0.09, len: 0.06, f: [180, 400], bend: 1.5, w: 'sin2', v: 0.22 });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'lowpass', f: [3000, 400], d: 0.2 + k * 0.08, a: 0.002, v: 0.8 });
      tone(V, { w: 'sin2', f: [320, 110], d: 0.16 + k * 0.04, v: 0.6 });
      crackle(V, { t: 0.05, d: d - 0.05, rate: 45, ft: 'bandpass', f: 3000, q: 0.7, v: 0.12, h: 0.3 });
      if (k) blips(V, { t: 0.08, n: 2 + k * 2, gap: 0.08, len: 0.05, f: [160, 360], bend: 1.6, w: 'sin2', v: 0.3 });
    },
  };
  // 地面：「隆隆」+ 碎石；「噗」泥巴 / 沙尘龙卷 / 地震隆隆往上涌；命中重重的「咚」+ 碎石哗啦
  R.ground = {
    charge(V, k) {
      const d = CH[k];
      noise(V, { kind: 'brown', ft: 'lowpass', f: [250, 500], d, a: d * 0.7, v: 0.22, q: 0.8 });
      crackle(V, { d, rate: 14 + k * 6, ft: 'lowpass', f: 1400, v: 0.14, a: d * 0.4 });
      if (k) tone(V, { w: 'sin2', f: [70, 100], d, a: d * 0.7, v: 0.1 });
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { swish(V, 0, 0.18, 400, 1400, 0.5, 1); noise(V, { t: 0.13, ft: 'lowpass', f: 1200, d: 0.1, a: 0.002, v: 0.45 }); return; }   // 「呼——噗」
      if (k === 1) {
        noise(V, { ft: 'bandpass', f: [500, 1600, 800], d, a: d * 0.4, v: 0.3, q: 1.5, lfo: [5, 300] });
        crackle(V, { d, rate: 50, ft: 'bandpass', f: 2400, v: 0.09 });
        return;
      }
      noise(V, { kind: 'brown', ft: 'lowpass', f: [200, 650], d, a: d * 0.6, v: 0.4 });
      tone(V, { w: 'sawtooth', f: [45, 62], d, a: d * 0.6, v: 0.1, lp: 300 });
      crackle(V, { d, rate: 24, ft: 'lowpass', f: 1600, v: 0.2, a: d * 0.5 });
    },
    impact(V, k) {
      const d = IM[k];
      thud(V, { f: [165, 145, 125][k], d: [0.3, 0.45, 0.7][k], v: 0.6, click: 0.4 });
      crackle(V, { d: d * 0.7, rate: 30, ft: 'lowpass', f: 1800, v: 0.3, h: 0.2 });
      noise(V, { kind: 'brown', ft: 'lowpass', f: [900, 150], d, a: 0.003, v: 0.3 + k * 0.04 });
    },
  };
  // 飞行：扑扇翅膀 + 风；「呼」/ 俯冲的哨音 / 旋风；命中「啪」+ 一阵风
  R.flying = {
    charge(V, k) {
      const d = CH[k], n = 2 + k * 2;
      for (let i = 0; i < n; i++) noise(V, { t: i * d / n, ft: 'lowpass', f: [1400, 500], d: d / n * 0.9, a: 0.02, v: 0.3 });
      noise(V, { ft: 'bandpass', f: [600, 1400], d, a: d * 0.7, v: 0.1, q: 1.5 });
      riser(V, k, KEY.flying, SUS, 'triangle');
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { swish(V, 0, 0.18, 600, 1800, 0.5, 1); swish(V, 0, 0.18, 250, 600, 0.3, 0.9); return; }
      if (k === 1) { noise(V, { ft: 'bandpass', f: [2600, 700], d, a: d * 0.3, v: 0.42, q: 5 }); swish(V, 0.1, 0.25, 500, 1500, 0.4, 1); return; }
      noise(V, { ft: 'bandpass', f: [500, 1600, 700], d, a: d * 0.4, v: 0.4, q: 2.5, lfo: [3, 400] });
      noise(V, { ft: 'bandpass', f: [900, 2200, 1100], d, a: d * 0.5, v: 0.28, q: 3, lfo: [4.3, 500] });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'bandpass', f: 1500, d: 0.06, a: 0.001, v: 0.6, q: 0.8 });
      thud(V, { f: 205, d: 0.17 + k * 0.07, v: 0.42 + k * 0.05, click: 0 });
      noise(V, { ft: 'bandpass', f: [1200, 400], d, a: 0.01, v: 0.25 + k * 0.08, q: 1 });
    },
  };
  // 心灵：揉音的「嗡哇嗡哇」越来越高；「啾」/ 梦境波 / 星星琶音；命中「嗡哇」往下 +「叮」
  R.psychic = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { f: [311, 622 + k * 100], d, a: d * 0.6, v: 0.08, vib: [7, 45] });
      tone(V, { f: [466, 933 + k * 150], d, a: d * 0.7, v: 0.04, vib: [7.5, 45] });
      if (k === 2) blips(V, { t: 0.2, n: 5, gap: 0.08, len: 0.05, seq: scl(KEY.psychic * 2, WHOLE, 5), w: 'triangle', v: 0.06 });
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { tone(V, { f: [700, 1400], d: 0.2, a: 0.01, v: 0.4, vib: [14, 60] }); tone(V, { w: 'triangle', f: [350, 700], d: 0.2, a: 0.01, v: 0.18 }); return; }
      tone(V, { f: [420, 950, 700], d, a: d * 0.3, h: 0.3, v: 0.16, vib: [9, 70], am: [10, 0.5] });
      tone(V, { f: [630, 1425, 1050], d, a: d * 0.4, v: 0.06, vib: [9.5, 70] });
      if (k === 2) blips(V, { t: 0.1, n: 5, gap: 0.08, len: 0.05, seq: scl(KEY.psychic * 2, PENTA, 5), w: 'triangle', v: 0.07 });
    },
    impact(V, k) {
      const d = IM[k];
      tone(V, { w: 'sin2', f: [900, 240], gt: d * 0.6, d: d * 0.8, a: 0.004, v: 0.32, vib: [9, 60] });
      thud(V, { f: 190, d: 0.18 + k * 0.06, v: 0.3 });
      tone(V, { w: 'triangle', t: 0.03, f: 1760, d: 0.25, v: 0.08 });
      if (k === 2) chord(V, { t: 0.05, f: KEY.psychic, iv: [0, 4, 7, 11], d: 0.6, a: 0.02, v: 0.05, vib: [6, 30] });
    },
  };
  // 虫：翅膀「嗡嗡」；嗡一下咬 / 射丝「咻」/ 一大群；命中「咔」+ 一群小家伙噼里啪啦
  R.bug = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { w: 'sawtooth', f: [150, 185 + k * 20], d, a: d * 0.6, v: 0.17, lp: 1400, q: 2, am: [38, 0.75] });
      if (k === 2) tone(V, { w: 'sawtooth', f: [223, 270], d, a: d * 0.7, v: 0.1, lp: 1600, am: [43, 0.75] });
      riser(V, k, KEY.bug, PENTA, 'p12');
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) {
        tone(V, { w: 'sawtooth', f: [180, 360], d: 0.2, a: 0.01, h: 0.3, v: 0.32, lp: 1800, am: [40, 0.7] });
        noise(V, { t: 0.16, ft: 'highpass', f: 3000, d: 0.02, a: 0.001, v: 0.18 });
        return;
      }
      if (k === 1) {
        [0, 0.15].forEach(t => tone(V, { t, f: [2300, 520], d: 0.1, a: 0.003, v: 0.26 }));
        tone(V, { w: 'sawtooth', f: [170, 200], d, a: 0.05, v: 0.08, lp: 1400, am: [36, 0.8] });
        return;
      }
      [[168, 33], [183, 41], [201, 37]].forEach(([f, r]) => tone(V, { w: 'sawtooth', f: [f, f * 1.15, f], d, a: d * 0.3, h: 0.3, v: 0.1, lp: 1500, am: [r, 0.8] }));
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'highpass', f: 2800, d: 0.025, a: 0.001, v: 0.35 });
      tone(V, { w: 'p25', f: [950, 380], d: 0.08, a: 0.002, v: 0.2, lp: 3000 });
      thud(V, { f: 210, d: 0.18 + k * 0.06, v: 0.45 + k * 0.05, click: 0 });
      if (k) crackle(V, { t: 0.03, d: d * 0.7, rate: 30 + k * 10, ft: 'bandpass', f: 2200, v: 0.25, h: 0.3 });
      if (k === 2) tone(V, { w: 'sawtooth', t: 0.05, f: [200, 150], d: d - 0.1, a: 0.02, v: 0.08, lp: 1300, am: [37, 0.8] });
    },
  };
  // 岩石：石头摩擦；「啵」碎石弹 / 骨碌骨碌滚 / 巨石落下的哨音；命中「咚」+ 碎石哗啦，大招小石子落地
  R.rock = {
    charge(V, k) {
      const d = CH[k];
      crackle(V, { d, rate: 18 + k * 6, ft: 'lowpass', f: 1100, v: 0.2, a: d * 0.5 });
      noise(V, { kind: 'brown', ft: 'lowpass', f: [250, 450], d, a: d * 0.7, v: 0.2 });
      if (k) tone(V, { w: 'sawtooth', f: [58, 72], d, a: d * 0.7, v: 0.07, lp: 260 });
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) {   // 碎石弹：「啵、啵」两颗 + 飞出去的「咻」
        tone(V, { w: 'sin2', f: [820, 340], d: 0.08, a: 0.002, v: 0.45 });
        tone(V, { t: 0.09, w: 'sin2', f: [1000, 420], d: 0.07, a: 0.002, v: 0.35 });
        swish(V, 0, 0.2, 800, 2200, 0.3, 1);
        return;
      }
      if (k === 1) {
        noise(V, { kind: 'brown', ft: 'lowpass', f: 550, d, a: 0.08, h: 0.5, v: 0.55, am: [11, 0.7] });
        crackle(V, { d, rate: 20, ft: 'lowpass', f: 2000, v: 0.2 });
        return;
      }
      tone(V, { w: 'triangle', f: [1000, 260], d, a: 0.05, h: 0.1, v: 0.1 });
      noise(V, { kind: 'brown', ft: 'lowpass', f: [250, 700], d, a: d * 0.7, v: 0.45 });
    },
    impact(V, k) {
      const d = IM[k];
      thud(V, { f: [180, 155, 130][k], d: [0.28, 0.42, 0.66][k], v: 0.62, click: 0.5 });
      crackle(V, { d: d * 0.75, rate: 40, ft: 'lowpass', f: 2600, v: 0.32, h: 0.15 });
      noise(V, { ft: 'lowpass', f: [2200, 280], d: d * 0.8, a: 0.002, v: 0.3 + k * 0.05 });
      if (k === 2) blips(V, { t: 0.12, n: 5, gap: 0.07, len: 0.04, f: [500, 1100], bend: 0.8, w: 'triangle', v: 0.1 });
    },
  };
  // 幽灵：揉音的「呜——」（怪怪的但不吓人）；「噗呜」/ 幽灵灯笼「呜哦」/ 减七和弦；命中「噗」+ 往下飘的呜
  R.ghost = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { w: 'triangle', f: [247, 294 + k * 40], d, a: d * 0.6, v: 0.11, vib: [5, 70] });
      tone(V, { f: [496, 590 + k * 80], d, a: d * 0.7, v: 0.04, vib: [5.5, 70] });
      if (k === 2) noise(V, { ft: 'bandpass', f: [1200, 2000], d, a: d * 0.6, v: 0.08, q: 4, lfo: [3, 400] });
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { tone(V, { f: [620, 300], d: 0.18, a: 0.01, v: 0.3, vib: [10, 80] }); swish(V, 0, 0.14, 400, 1100, 0.15, 1); return; }
      tone(V, { f: [250, 520], d, a: d * 0.3, h: 0.3, v: 0.15, vib: [6, 90] });
      swish(V, 0.05, d * 0.8, 300, 1000, 0.2, 1);
      if (k === 2) chord(V, { f: KEY.ghost, iv: [0, 3, 6, 9], d, a: d * 0.4, v: 0.05, w: 'triangle', am: [8, 0.6] });
    },
    impact(V, k) {
      const d = IM[k];
      noise(V, { ft: 'lowpass', f: [1300, 300], d: 0.25 + k * 0.1, a: 0.004, v: 0.38 });
      tone(V, { f: [520, 190], d: d * 0.7, a: 0.004, v: 0.26, vib: [8, 80] });
      thud(V, { f: 175, d: 0.16 + k * 0.06, v: 0.26 + k * 0.07, click: 0.2 });
      if (k === 2) tone(V, { t: 0.08, f: [900, 220], d: d - 0.1, a: 0.02, v: 0.1, vib: [6, 90] });
    },
  };
  // 龙：喉咙里的低吼；龙鳞「唰——铮」/ 龙焰「吼——」/ 传说龙吼；命中「轰」+ 吼声尾巴，大招再加一个空五度
  R.dragon = {
    charge(V, k) {
      const d = CH[k];
      growl(V, { f: [70, 82 + k * 6], d, a: d * 0.7, v: 0.1, lp: 600, rate: 18, depth: 280 });
      riser(V, k, KEY.dragon, MIN);
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { swish(V, 0, 0.12, 1100, 3000, 0.36, 1.5); bell(V, { t: 0.05, f: 1300, ratio: 1.41, idx: 1.5, d: 0.2, v: 0.1 }); return; }
      growl(V, { f: k === 2 ? [80, 122, 92] : [96, 110], d, a: 0.06, h: 0.3, v: 0.14, lp: 900, rate: 21, depth: 400 });
      noise(V, { ft: 'bandpass', f: [650, 320], d, a: 0.05, h: 0.3, v: 0.2, q: 0.8 });
      if (k === 2) tone(V, { w: 'sin2', f: [55, 70], d, a: 0.1, v: 0.12 });
    },
    impact(V, k) {
      const d = IM[k];
      thud(V, { f: [165, 145, 125][k], d: d * 0.7, v: 0.58, click: 0.4 });
      noise(V, { ft: 'lowpass', f: [2600, 240], d: d * 0.8, a: 0.003, v: 0.38 });
      growl(V, { f: [90, 70], d: d * 0.7, a: 0.01, v: 0.12, lp: 600, rate: 15, depth: 250 });
      if (k === 2) chord(V, { t: 0.05, f: KEY.dragon * 2, iv: [0, 7, 12], d: 0.6, a: 0.02, v: 0.05, w: 'triangle' });
    },
  };
  // 恶：「咚、咚」低沉的脉动；一爪「唰」/ 再一爪 + 咬 / 往下沉的嗡 + 两爪；命中「铮」斩击，大招交叉第二刀
  R.dark = {
    charge(V, k) {
      const d = CH[k];
      tone(V, { w: 'sin2', f: 110, d, a: d * 0.5, v: 0.14, am: [4 + k, 0.8] });
      tone(V, { w: 'sin2', f: 165, d, a: d * 0.6, v: 0.06, am: [4 + k, 0.8] });
      noise(V, { ft: 'lowpass', f: [200, 600], d, a: d * 0.8, v: 0.12 });
      if (k === 2) tone(V, { w: 'sawtooth', f: [330, 220], d, a: d * 0.5, v: 0.06, lp: 900 });
    },
    launch(V, k) {
      const d = LA[k];
      swish(V, 0, 0.11, 1300, 3500, 0.4, 1.3); swish(V, 0, 0.11, 400, 1000, 0.25, 1);
      if (k === 1) { swish(V, 0.16, 0.11, 1300, 3500, 0.36, 1.3); thud(V, { t: 0.26, f: 320, d: 0.08, v: 0.3, click: 0.6 }); }
      if (k === 2) { tone(V, { w: 'sawtooth', f: [230, 110], d, a: 0.05, h: 0.3, v: 0.14, lp: 800 }); swish(V, 0.25, 0.11, 1300, 3500, 0.36, 1.3); }
    },
    impact(V, k) {
      const d = IM[k];
      bell(V, { f: 1100, ratio: 2.41, idx: 2.5, d: 0.22 + k * 0.08, v: 0.13 });
      noise(V, { ft: 'bandpass', f: 2800, q: 0.7, d: 0.06, a: 0.001, v: 0.35 });
      thud(V, { f: 185, d: 0.2 + k * 0.1, v: 0.4 + k * 0.06 });
      if (k === 2) {
        bell(V, { t: 0.1, f: 930, ratio: 2.41, idx: 2.5, d: 0.3, v: 0.12 });
        noise(V, { t: 0.1, ft: 'bandpass', f: 2800, q: 0.7, d: 0.06, a: 0.001, v: 0.3 });
        tone(V, { t: 0.1, w: 'sin2', f: [140, 60], d: d - 0.1, v: 0.25 });
      }
    },
  };
  // 钢：「铛」+ 金属嗡鸣；「叮」/ 旋转呜呜 / 流星落下；命中「铛——」+ 闷响，大招两下 + 金属火花
  R.steel = {
    charge(V, k) {
      const d = CH[k];
      bell(V, { f: 620, ratio: 2.76, idx: 2, d: 0.2, v: 0.12 });
      tone(V, { w: 'p25', f: [233, 349 + k * 60], d, a: d * 0.6, v: 0.07, lp: 1400, am: [20, 0.4] });
      riser(V, k, KEY.steel, SUS, 'p12');
    },
    launch(V, k) {
      const d = LA[k];
      if (k === 0) { swish(V, 0, 0.1, 1200, 3000, 0.3, 1.2); bell(V, { t: 0.06, f: 1100, ratio: 2.76, idx: 0.9, d: 0.14, v: 0.12 }); return; }
      tone(V, { w: 'p25', f: [300, 520], d, a: d * 0.3, h: 0.4, v: 0.12, lp: 2000, am: [24, 0.7] });
      swish(V, 0, d, 700, 2000, 0.2, 1.5);
      if (k === 2) tone(V, { w: 'triangle', f: [1200, 220], d, a: 0.05, h: 0.1, v: 0.1 });
    },
    impact(V, k) {
      const d = IM[k];
      bell(V, { f: 520, ratio: 2.76, idx: 4, d: d * 0.9, v: 0.2 });
      thud(V, { f: 185, d: 0.2 + k * 0.1, v: 0.42, click: 0.5 });
      noise(V, { ft: 'bandpass', f: 3000, d: 0.03, a: 0.001, v: 0.35 });
      if (k === 2) {
        bell(V, { t: 0.06, f: 391, ratio: 2.76, idx: 4, d: d * 0.8, v: 0.16 });
        crackle(V, { t: 0.02, d: 0.4, rate: 45, ft: 'bandpass', f: 3200, q: 0.7, v: 0.12 });
      }
    },
  };
  // 不分属性的：大招过场、暴击、通用受击
  const X = {
    // 横幅冲进来「咻——」（0.22 秒），停住时「锵」+ 这个属性调的和弦 + 低低的「咚」
    cutin(V, k, type) {
      const f = KEY[type] || KEY.normal;
      noise(V, { ft: 'bandpass', f: [400, 3500], d: 0.26, a: 0.23, v: 0.22, q: 1 });
      tone(V, { w: 'sawtooth', f: [f / 4, f / 2], d: 0.26, a: 0.22, v: 0.07, lp: [400, 2500] });
      chord(V, { t: 0.22, f, iv: [0, 4, 7, 12], d: 0.6, a: 0.005, v: 0.07, w: 'p25', lp: 3000 });
      bell(V, { t: 0.22, f: f * 2, ratio: 3, idx: 1.2, d: 0.5, v: 0.07 });
      thud(V, { t: 0.22, f: 130, d: 0.35, v: 0.25, click: 0.3 });
    },
    // 暴击：亮亮的「叮铃铃」往上 + 一记重拍
    crit(V) {
      const f = 1047;
      arp(V, { notes: [f, f * st(4), f * st(7), f * 2], step: 0.035, w: 'p25', v: 0.1, tail: 0.3, lp: 3500 });
      bell(V, { t: 0.1, f: f * 2, ratio: 3.01, idx: 1, d: 0.35, v: 0.06 });
      thud(V, { f: 200, d: 0.2, v: 0.4, click: 0.5 });
    },
    // 通用受击：「咚」闷一下
    hit(V) {
      thud(V, { f: 185, d: 0.22, v: 0.55, click: 0.5 });
      noise(V, { ft: 'lowpass', f: [1600, 300], d: 0.15, a: 0.002, v: 0.2 });
    },
  };

  // 造一个声音：配方 → 到上限统一淡出；所有音源结束就收拾（离线渲染和实时播放都走这里）
  function make(c, dest, t0, rng, type, phase, tier, db) {
    const V = voice(c, dest, t0, rng, Math.pow(10, db / 20), MAXLEN[phase]);
    V.cents = (rng() - 0.5) * 70;   // 每次音高差一点点（±35 音分），连放不机械
    try {
      const fn = R[type] && R[type][phase] ? R[type][phase] : X[phase];
      fn(V, tier, type);
      const g = V.out.gain, T = V.t0 + V.max;
      g.setValueAtTime(V.vol, T - 0.05);
      g.linearRampToValueAtTime(0, T);
    } catch (e) { cleanup(V); throw e; }
    if (!V.left) cleanup(V);
    return V;
  }
  function norm(type, phase, tier) {
    if (!Object.prototype.hasOwnProperty.call(MAXLEN, phase)) return null;
    return { type: Object.prototype.hasOwnProperty.call(R, type) ? type : 'normal', phase, tier: Math.max(0, Math.min(2, Math.floor(+tier) || 0)) };
  }

  // ---------- 实时播放 ----------
  let ctx = null, M = null, idleT = 0, volume = 1;
  const live = [];          // 正在响的声音（先来的在前）
  const recent = new Map(); // 同一个声音上次什么时候放的（performance.now）
  const stats = { played: 0, dropped: 0, stolen: 0, errors: 0 };

  function resume() { try { const p = ctx.resume(); if (p && p.catch) p.catch(noop); } catch (e) { /* 忽略 */ } }
  function ensure() {
    if (ctx && ctx.state === 'closed') { ctx = null; M = null; live.length = 0; }
    if (!ctx) {
      // 页面还没被点过：浏览器会把新建的 AudioContext 挂起还报警告，先不建（战斗都是点过以后才开始的）
      const ua = typeof navigator !== 'undefined' && navigator.userActivation;
      if (ua && !ua.hasBeenActive) return null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
      M = master(ctx);
      M.vol.gain.value = volume;
      kitOf(ctx);
    }
    if (ctx.state !== 'running') resume();
    return ctx;
  }
  // 配乐那边：麦克风在听 → 不出声；英语朗读中 → 小 6 dB
  function musicGate() {
    const m = window.EchoMusic;
    if (!m || !m.state) return '';
    try { const s = m.state(); return s.hold > 0 ? 'hold' : s.duck > 0 ? 'duck' : ''; } catch (e) { return ''; }
  }
  // 掐掉一个声音：30 毫秒淡出
  function steal(V) {
    const i = live.indexOf(V);
    if (i >= 0) live.splice(i, 1);
    if (V.done) return;
    stats.stolen++;
    try {
      const now = V.c.currentTime, g = V.out.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.03);
      V.srcs.forEach(s => { try { s.stop(now + 0.035); } catch (e) { /* 还没开始 / 已经停了 */ } });
    } catch (e) { cleanup(V); }
  }
  // 在战斗画面里吗（game.js 的 show() 给 body 加 scr-<画面> 类）
  function inBattle() { try { return !!(document.body && document.body.classList.contains('scr-battle')); } catch (e) { return false; } }
  function idle() { clearTimeout(idleT); idleT = setTimeout(nap, IDLE_MS); }
  function nap() {
    idleT = 0;
    if (!ctx || ctx.state !== 'running') return;
    if (live.length || inBattle()) { idle(); return; }
    try { const p = ctx.suspend(); if (p && p.catch) p.catch(noop); } catch (e) { /* 忽略 */ }
  }
  // 提前准备好（建 AudioContext、噪音和波形）：开战时调一下，第一招的蓄力声就不用等；页面还没被点过就什么都不做
  function warm() {
    try {
      if (!api.enabled || !AC || (typeof document !== 'undefined' && document.hidden)) return false;
      const c = ensure();
      if (c) idle();
      return !!c;
    } catch (e) { warn(e); return false; }
  }

  function play(type, phase, tier) {
    try {
      if (!api.enabled || !AC) return false;
      const n = norm(type, phase, tier);
      if (!n) return false;
      if (typeof document !== 'undefined' && document.hidden) return false;
      let db = lvl(n.type, n.phase, n.tier);
      const g = musicGate();
      if (g === 'hold') { stats.dropped++; return false; }
      if (g === 'duck') db += DUCK_DB;
      const c = ensure();
      if (!c) { stats.dropped++; return false; }
      const now = performance.now(), key = n.type + n.phase + n.tier;
      if (now - (recent.get(key) || -1e9) < SAME_MS) { stats.dropped++; return false; }
      if (c.state !== 'running' && kitOf(c).alive >= MAX_PENDING) { stats.dropped++; return false; }
      while (live.length >= MAX_VOICES) steal(live[0]);
      recent.set(key, now);
      const V = make(c, M.bus, c.currentTime + 0.012, Math.random, n.type, n.phase, n.tier, db);
      if (!V.done) {
        live.push(V);
        // 兜底：音源的 ended 万一没来（AudioContext 被关掉之类），到时间也把节点断开
        V.safe = setTimeout(() => cleanup(V), (V.max + 1.2) * 1000);
      }
      stats.played++;
      idle();
      return true;
    } catch (e) { stats.errors++; warn(e); return false; }
  }
  function stopAll() { live.slice().forEach(steal); }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    try { if (M) M.vol.gain.setTargetAtTime(volume, ctx.currentTime, 0.02); } catch (e) { warn(e); }
  }
  // 点屏幕时：有声音在等（AudioContext 被系统挂起了）、或者在战斗画面里（马上要放招了）就恢复
  function unlock() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || (typeof document !== 'undefined' && document.hidden)) return;
    if (live.length || inBattle()) { resume(); idle(); }
  }
  if (typeof window.addEventListener === 'function') {
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    // 页面隐藏：掐掉正在响的，稍后挂起（手机省电）；回来不用管，下一次 play() 会恢复
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden || !ctx) return;
      stopAll();
      clearTimeout(idleT); idleT = 0;
      setTimeout(() => { if (document.hidden && ctx && ctx.state === 'running') { try { const p = ctx.suspend(); if (p && p.catch) p.catch(noop); } catch (e) { /* 忽略 */ } } }, 100);
    });
  }
  function state() {
    return {
      enabled: api.enabled, ctx: ctx ? ctx.state : 'none', voices: live.length, alive: ctx ? kitOf(ctx).alive : 0,
      volume, curves: CURVES.size, played: stats.played, dropped: stats.dropped, stolen: stats.stolen, errors: stats.errors,
      reduction: M ? +(typeof M.comp.reduction === 'number' ? M.comp.reduction : (M.comp.reduction && M.comp.reduction.value) || 0).toFixed(2) : 0,
    };
  }

  // ---------- 离线渲染（查电平用）：和 play 同一套配方、同一条总线 ----------
  function render(type, phase, tier, opt) {
    opt = opt || {};
    const n = norm(type, phase, tier);
    if (!n) return Promise.reject(new Error('没有这个阶段：' + phase));
    if (!OAC) return Promise.reject(new Error('浏览器没有 OfflineAudioContext'));
    // 从 0.01 秒开始（和实时一样晚一点点开始，曲线类的自动化不会和建节点时的初始值撞在同一时刻）
    const sr = opt.sampleRate || 44100, t0 = 0.01, secs = t0 + MAXLEN[n.phase] + 0.15;
    const oc = new OAC(1, Math.ceil(secs * sr), sr);
    const m = master(oc);
    const db = opt.gain != null ? +opt.gain : lvl(n.type, n.phase, n.tier);
    const V = make(oc, m.bus, t0, rng32(hash(n.type + '|' + n.phase + '|' + n.tier + '|' + (opt.seed || 0))), n.type, n.phase, n.tier, db);
    const info = { type: n.type, phase: n.phase, tier: n.tier, gain: db, t0, sources: V.srcs.length, nodes: V.nodes.length, end: +(V.end - t0).toFixed(3), max: V.max };
    return oc.startRendering().then(buf => { buf.stats = info; return buf; });
  }

  const api = {
    enabled: !robot && !!AC,
    play, render, warm, setVolume, stopAll, unlock, state,
    TYPES, PHASES, MAXLEN, LEVELS,
  };
  window.BattleSFX = api;
})();
