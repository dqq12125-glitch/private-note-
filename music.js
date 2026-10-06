// 回声岛配乐引擎（window.EchoMusic）：用 WebAudio 现场合成 GBA 掌机风的背景音乐，不用音频文件
// - 乐谱在 music-data.js（window.MUSIC.songs，由 tools/music/build.js 生成），用 music-core.js 的 timeline() 展开成按拍子排好的音符
// - 15 种音色（方波 12.5/25/50%、三角波、GB 波形表、合成低音、锯齿、正弦、笛子、钟琴、拨弦、木琴、风琴、弦乐、铜管）+ 7 种合成鼓
// - 每个声部固定左右位置、旋律加回声（附点八分、跟着速度走）、长音延迟颤音、摇摆、整体压限不爆音、循环无缝接回 loopFrom
// - 排音符：50 毫秒一次的定时器，往后排 0.5 秒（three.js 每帧占着主线程也不会断）；每个声部一个游标，不用每次从头找
//   主线程卡过（两次排音符之间音频时钟走得太远）就自动多排一点（最多 1.5 秒），不卡了再慢慢收回来；
//   真错过了开头的音：短音/打击类不补（拍子不乱），持续类的长音从现在接上（铺底、低音不留洞）
// - 每首歌可以有 gain（dB，tools/music/levels.json 由 render.js --levels 算出、build.js 并进曲库），各首听起来一样响
// - 接口：play / jingle / duck / hold / setVolume / current / songs / state / render（规格见 tools/music/SPEC.md §5）
// - 第一次点屏幕/按键才创建 AudioContext（浏览器的自动播放规定），之前的 play() 记下来，解锁后接着放；
//   页面隐藏时先很快把音量收到 0 再挂起（不「咔」一声），正在放的小段音乐直接收掉（Promise 完成），回来淡入接着放背景音乐；
//   被系统挂起 / 'interrupted' 时试着恢复，不行就等下一次点屏幕；AudioContext 被关掉了下一次点屏幕重建
// - 自动化测试里（navigator.webdriver）默认不出声，所有调用什么都不做（Promise 立刻完成），网址带 ?music 才出声
// 试听：tools/music.html；离线检查电平/接缝：node tools/music/render.js
(function () {
  'use strict';
  const Core = window.MusicCore;
  const PARTS = ['lead', 'harm', 'arp', 'bass'];
  const ALL = PARTS.concat('drums');
  const LOOK = 0.5;         // 平时往后排多少秒的音符（主线程卡 0.45 秒以内都不漏音）
  const LOOK_MAX = 1.5;     // 主线程老是卡的时候最多往后排多少秒
  const TICK = 50;          // 排音符的定时器（毫秒）
  const TAIL = 1.0;         // 一次性小音乐结尾多留的尾音（秒）
  const CAP = 40;           // 一首歌同时最多几个声音，多了掐掉最快要结束的（省手机 CPU）
  const DUCK = 0.3;         // 英语朗读时音乐压到多少
  const MASTER = 0.5;       // 总线电平：各声部加起来要留够余量，压限器只管偶尔的尖峰
  const DEF_MIX = { lead: 0.9, harm: 0.45, arp: 0.35, bass: 0.85, drums: 0.6 };
  const DEF_INST = { lead: 'pulse25', harm: 'pulse50', arp: 'pulse12', bass: 'tri' };
  const PAN = { lead: 0.06, harm: -0.3, arp: 0.32, bass: 0 };              // 每个声部的左右位置
  const DPAN = { k: 'c', s: 'c', h: 'r', o: 'r', c: 'l', t: 'l', T: 'r' };  // 鼓：底鼓军鼓居中，镲和嗵鼓分到两边
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const noop = () => {};
  const warn = e => { try { console.warn('[EchoMusic]', e && e.message || e); } catch (x) { /* 没有 console */ } };

  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const QS = (typeof location !== 'undefined' && location.search) || '';
  const robot = typeof navigator !== 'undefined' && navigator.webdriver && !/[?&]music(?:[=&]|$)/.test(QS);
  let enabled = !!(AC && Core) && !robot;

  // ---------- 乐谱 ----------
  const lib = () => (window.MUSIC && window.MUSIC.songs) || {};
  const songOf = id => (id && Object.prototype.hasOwnProperty.call(lib(), id) ? lib()[id] : null);
  const TL = new Map();     // id → { song, tl }：展开一次就留着
  function tlOf(id) {
    const s = songOf(id);
    if (!s) return null;
    let c = TL.get(id);
    if (!c || c.song !== s) { c = { song: s, tl: Core.timeline(s) }; TL.set(id, c); }
    return c.tl;
  }
  // 第一个 t ≥ b 的音符（二分查找）
  function lower(ev, b) {
    let lo = 0, hi = ev.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t < b - 1e-9) lo = m + 1; else hi = m; }
    return lo;
  }

  // ---------- 每个 AudioContext 共用的波形和噪音（只算一次） ----------
  const KITS = new WeakMap();
  function kitOf(ctx) {
    let K = KITS.get(ctx);
    if (K) return K;
    K = { w: {}, noise: null, alive: 0, aliveMax: 0 };   // alive：节点还没断开的声音（查泄漏用）
    // 傅里叶系数 → PeriodicWave（浏览器按音高自动去掉超过奈奎斯特的泛音，不会混叠）；先归一化到峰值 1，音量由音色的 lvl 管
    const wave = (re, im) => {
      let pk = 0;
      for (let i = 0; i < 1024; i++) {
        const x = i / 1024 * 2 * Math.PI;
        let s = 0;
        for (let n = 1; n < re.length; n++) s += re[n] * Math.cos(n * x) + im[n] * Math.sin(n * x);
        pk = Math.max(pk, Math.abs(s));
      }
      const R = new Float32Array(re.map(v => v / pk)), I = new Float32Array(im.map(v => v / pk));
      try { return ctx.createPeriodicWave(R, I, { disableNormalization: true }); } catch (e) { return ctx.createPeriodicWave(R, I); }
    };
    // Lanczos σ：高次泛音慢慢收掉，方波边缘不振铃、不刺耳
    const sig = (n, N) => (n === 1 ? 1 : Math.sin(Math.PI * n / (N + 1)) / (Math.PI * n / (N + 1)));
    // 方波：占空比 d 的脉冲（去掉直流），系数 4/(nπ)·sin(nπd)
    const pulse = d => {
      const N = 64, re = [0], im = [0];
      for (let n = 1; n <= N; n++) { re.push(4 / (n * Math.PI) * Math.sin(n * Math.PI * d) * sig(n, N)); im.push(0); }
      return wave(re, im);
    };
    // 只有正弦相位的谐波表（风琴、笛子、正弦）
    const harm = amps => wave(amps.map(() => 0), amps);
    K.w.p12 = pulse(0.125); K.w.p25 = pulse(0.25); K.w.p50 = pulse(0.5);
    // GB 波形通道：32 格 4 位的软方波，取前 15 个谐波（圆一点，不扎耳朵）
    const tbl = [];
    for (let i = 0; i < 32; i++) tbl.push(Math.round(7.5 + 7.5 * Math.tanh(2.4 * Math.sin(2 * Math.PI * (i + 0.5) / 32)) / Math.tanh(2.4)));
    const mean = tbl.reduce((a, b) => a + b, 0) / 32, gre = [0], gim = [0];
    for (let n = 1; n <= 15; n++) {
      let c = 0, s = 0;
      tbl.forEach((v, i) => { c += (v - mean) * Math.cos(2 * Math.PI * n * i / 32); s += (v - mean) * Math.sin(2 * Math.PI * n * i / 32); });
      gre.push(c * 2 / 32); gim.push(s * 2 / 32);
    }
    K.w.gbw = wave(gre, gim);
    K.w.sin = harm([0, 1, 0.08, 0.025]);                                     // 正弦带一点点二次谐波（手机小喇叭上听得见）
    K.w.fl = harm([0, 1, 0.3, 0.1, 0.04, 0.015]);                            // 笛子
    K.w.org = harm([0, 1, 0.65, 0.4, 0.45, 0.06, 0.2, 0, 0.22, 0, 0.05]);    // 风琴：拉杆 16' 8' 5⅓' 4' 2⅔' 2'
    const pl = [0], pim = [0];                                               // 拨弦：在弦长 0.22 处拨的谐波
    for (let n = 1; n <= 32; n++) { pl.push(0); pim.push(Math.sin(n * Math.PI * 0.22) / Math.pow(n, 1.3) * sig(n, 32)); }
    K.w.plk = wave(pl, pim);
    // 噪音：1 秒白噪音（固定种子，每次渲染都一样）
    const n = Math.round(ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 0x2545f491;
    for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
    K.noise = buf;
    KITS.set(ctx, K);
    return K;
  }

  // ---------- 音色 ----------
  // lvl 峰值；a 起音 d 衰减 s 持续（0 = 打击类自然衰减完）r 释放（秒）；gate 正常音符发声的比例（断奏 ^ 一律 50%）
  // lp：低通 [倍数, 加多少 Hz, 上限, Q] → 截止 = min(上限, 频率×倍数+加)；bite：起音时截止从 频率×倍数 落回来（时间常数）；swell：铜管的截止先张开再落
  const MAR2 = { a: 0.001, d: 0.14, s: 0, r: 0.05 };   // 木琴的高泛音
  const INST = {
    pulse12: { w: 'p12', lvl: 0.3, a: 0.003, d: 0.3, s: 0.7, r: 0.06, gate: 0.88 },
    pulse25: { w: 'p25', lvl: 0.23, a: 0.003, d: 0.35, s: 0.75, r: 0.07, gate: 0.9 },
    pulse50: { w: 'p50', lvl: 0.13, a: 0.004, d: 0.35, s: 0.75, r: 0.08, gate: 0.9 },
    tri: { w: 'triangle', lvl: 0.275, a: 0.004, d: 0.2, s: 0.9, r: 0.05, gate: 0.92 },
    wave: { w: 'gbw', lvl: 0.176, a: 0.004, d: 0.25, s: 0.85, r: 0.06, gate: 0.9 },
    bass: { w: 'sawtooth', lvl: 0.315, a: 0.003, d: 0.22, s: 0.75, r: 0.05, gate: 0.85, lp: [2.4, 80, 2000, 4], bite: [9, 0.06] },
    saw: { w: 'sawtooth', lvl: 0.23, a: 0.012, d: 0.4, s: 0.75, r: 0.14, gate: 0.95, lp: [4, 500, 3200, 0.6] },
    sine: { w: 'sin', lvl: 0.205, a: 0.012, d: 0.5, s: 0.8, r: 0.14, gate: 0.95 },
    flute: { w: 'fl', lvl: 0.2, a: 0.06, d: 0.3, s: 0.85, r: 0.12, gate: 0.94, vib: 20, vibAlways: 9, fn: flute },
    bell: { lvl: 0.23, a: 0.002, d: 1.8, s: 0, r: 0.5, gate: 1, fn: bell },
    pluck: { w: 'plk', lvl: 0.45, a: 0.002, d: 1.0, s: 0, r: 0.1, gate: 1, lp: [2.5, 300, 6000, 0.8], bite: [12, 0.12] },
    marimba: { lvl: 0.36, a: 0.002, d: 0.7, s: 0, r: 0.08, gate: 1, fn: marimba },
    organ: { w: 'org', lvl: 0.18, a: 0.012, d: 0.1, s: 1, r: 0.07, gate: 0.96 },
    strings: { w: 'sawtooth', lvl: 0.132, a: 0.2, d: 0.6, s: 0.85, r: 0.45, gate: 1, lp: [5, 300, 3400, 0.5], det: [-8, 8] },
    brass: { w: 'sawtooth', lvl: 0.175, a: 0.035, d: 0.3, s: 0.8, r: 0.1, gate: 0.92, lp: [3.2, 200, 4000, 1.5], swell: [1.1, 6.5, 0.06], det: [-4, 4] },
  };

  // 包络：t 开始，off 松开；返回声音完全结束的时间
  function adsr(g, t, off, pk, I) {
    const a = Math.max(0.001, Math.min(I.a, (off - t) * 0.6));
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(pk, t + a);
    if (I.s < 1) g.setTargetAtTime(pk * I.s, t + a, I.d / 4);
    const rel = Math.max(off, t + a + 0.001);
    g.setTargetAtTime(0, rel, I.r / 4);
    const tail = rel + I.r * 1.3;
    return I.s > 0 ? tail : Math.min(tail, t + a + I.d * 1.3);
  }
  function osc(P, w, f, t) {
    const o = P.ctx.createOscillator(), pw = P.kit.w[w];
    if (pw) o.setPeriodicWave(pw); else o.type = w;
    o.frequency.value = f;
    o.start(t);
    return o;
  }
  const nzOff = P => (P.nz = (P.nz + 0.381966) % 1) * 0.8;   // 噪音每次从不同的地方开始放（固定序列，可重现）

  // 一般的音色：振荡器（可以几个微微走音的叠在一起）→ 低通（可选，带包络）→ 音量包络
  function plain(P, V, I, f, t, off, pk, out) {
    const ctx = P.ctx, amp = ctx.createGain();
    amp.gain.value = 0;
    amp.connect(out);
    V.amps.push(amp); V.nodes.push(amp);
    let head = amp;
    if (I.lp) {
      const fl = ctx.createBiquadFilter(), ny = ctx.sampleRate * 0.45, cap = Math.min(I.lp[2], ny), fc = Math.min(cap, f * I.lp[0] + I.lp[1]);
      fl.type = 'lowpass'; fl.Q.value = I.lp[3];
      if (I.bite) {
        fl.frequency.setValueAtTime(Math.min(ny, f * I.bite[0] + I.lp[1]), t);
        fl.frequency.setTargetAtTime(fc, t + 0.004, I.bite[1]);
      } else if (I.swell) {
        fl.frequency.setValueAtTime(Math.min(ny, f * I.swell[0] + I.lp[1]), t);
        fl.frequency.linearRampToValueAtTime(Math.min(ny, cap * 1.3, f * I.swell[1] + I.lp[1]), t + I.swell[2]);
        fl.frequency.setTargetAtTime(fc, t + I.swell[2], 0.15);
      } else fl.frequency.value = fc;
      fl.connect(amp);
      V.nodes.push(fl);
      head = fl;
    }
    for (const dt of I.det || [0]) {
      const o = osc(P, I.w, f, t);
      if (dt) o.detune.value = dt;
      o.connect(head);
      V.srcs.push(o);
    }
    return adsr(amp.gain, t, off, pk, I);
  }
  // 笛子：柔和的谐波 + 一直有的轻颤音 + 过了带通的气声（起音时吹一口，后面一点点）
  function flute(P, V, I, f, t, off, pk, out) {
    const end = plain(P, V, I, f, t, off, pk, out);
    const ctx = P.ctx, src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), bg = ctx.createGain();
    src.buffer = P.kit.noise; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = Math.min(ctx.sampleRate * 0.45, f * 2); bp.Q.value = 1.2;
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(pk * 0.5, t + 0.02);
    bg.gain.setTargetAtTime(pk * 0.07, t + 0.02, 0.04);
    bg.gain.setTargetAtTime(0, Math.max(off, t + 0.03), I.r / 4);
    src.connect(bp); bp.connect(bg); bg.connect(out);
    src.start(t, nzOff(P));
    V.srcs.push(src); V.nodes.push(bp, bg); V.amps.push(bg);
    return end;
  }
  // 钟琴：两个算子的 FM（调制器 3.5 倍频，调制深度起音时大、很快变小 → 先亮后圆）
  function bell(P, V, I, f, t, off, pk, out) {
    const ctx = P.ctx, car = osc(P, 'sine', f, t), mod = osc(P, 'sine', f * 3.5, t), mg = ctx.createGain(), amp = ctx.createGain();
    amp.gain.value = 0;
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.setTargetAtTime(f * 0.35, t, 0.14);
    mod.connect(mg); mg.connect(car.frequency); car.connect(amp); amp.connect(out);
    V.srcs.push(car, mod); V.nodes.push(mg, amp); V.amps.push(amp);
    return adsr(amp.gain, t, off, pk, I);
  }
  // 木琴：基音 + 3.93 倍的高泛音（很快消失，敲击感）
  function marimba(P, V, I, f, t, off, pk, out) {
    const ctx = P.ctx, o1 = osc(P, 'sine', f, t), a1 = ctx.createGain();
    a1.gain.value = 0;
    o1.connect(a1); a1.connect(out);
    V.srcs.push(o1); V.nodes.push(a1); V.amps.push(a1);
    if (f * 3.93 < ctx.sampleRate * 0.4) {
      const o2 = osc(P, 'sine', f * 3.93, t), a2 = ctx.createGain();
      a2.gain.value = 0;
      o2.connect(a2); a2.connect(out);
      V.srcs.push(o2); V.nodes.push(a2); V.amps.push(a2);
      adsr(a2.gain, t, off, pk * (f < 1200 ? 0.35 : 0.15), MAR2);
    }
    return adsr(a1.gain, t, off, pk, I);
  }
  // 颤音：音符开始后 delay 秒才慢慢出来（GBA 的延迟颤音）
  function vibrato(P, V, t, delay, cents) {
    const ctx = P.ctx, lfo = ctx.createOscillator(), dg = ctx.createGain();
    lfo.frequency.value = 5.3;
    dg.gain.value = 0;
    dg.gain.setValueAtTime(0, t + delay);
    dg.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
    lfo.connect(dg);
    V.srcs.forEach(s => { if (s.frequency && s.detune) dg.connect(s.detune); });   // 只接振荡器，不接噪音
    lfo.start(t);
    V.srcs.push(lfo); V.nodes.push(dg);
  }
  // 结束：到点停掉，放完断开所有节点（手机上不留垃圾）
  function finish(P, V, end) {
    V.end = end;
    for (const s of V.srcs) s.stop(end);
    const all = V.srcs.concat(V.nodes), K = P.kit;
    K.alive++; if (K.alive > K.aliveMax) K.aliveMax = K.alive;
    V.srcs[0].onended = () => { K.alive--; for (const n of all) { try { n.disconnect(); } catch (e) { /* 已经断了 */ } } };
    P.add(V);
  }
  // 一个音：name 音色，f 频率，t 开始，off 松开，v 力度（1 = 正常），vib 加延迟颤音（旋律里 ≥ 1 拍的长音）
  function voice(P, name, f, t, off, v, out, vib) {
    const I = INST[name] || INST.pulse25;
    const V = { start: t, end: t, srcs: [], nodes: [], amps: [] };
    const end = (I.fn || plain)(P, V, I, f, t, off, I.lvl * v, out);
    if (vib && off - t > 0.3) vibrato(P, V, t, Math.min(0.28, (off - t) * 0.35), I.vib || 14);
    else if (I.vibAlways) vibrato(P, V, t, 0.2, I.vibAlways);
    finish(P, V, end);
  }
  // 掐掉一个声音（同时发声太多的时候）：在 t 那一刻按当时的音量很快收掉（cancelAndHold 不会把还没起完的音一下子清零）
  function kill(V, t) {
    V.amps.forEach(a => {
      try {
        if (a.gain.cancelAndHoldAtTime) a.gain.cancelAndHoldAtTime(t); else a.gain.cancelScheduledValues(t);
        a.gain.setTargetAtTime(0, t, 0.01);
      } catch (e) { /* 忽略 */ }
    });
    V.srcs.forEach(s => { try { s.stop(t + 0.06); } catch (e) { /* 忽略 */ } });
    V.end = Math.min(V.end, t + 0.06);
  }

  // ---------- 鼓（噪音 + 扫频的正弦） ----------
  function drum(P, ch, t, out) {
    const ctx = P.ctx, V = { start: t, end: t, srcs: [], nodes: [], amps: [] };
    const env = (pk, a, tau) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(pk, t + a);
      g.gain.setTargetAtTime(0, t + a, tau);
      g.connect(out);
      V.nodes.push(g); V.amps.push(g);
      return g;
    };
    const noise = (type, fq, q, to) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
      s.buffer = P.kit.noise; s.loop = true;
      fl.type = type; fl.frequency.value = Math.min(fq, ctx.sampleRate * 0.45); fl.Q.value = q;
      s.connect(fl); fl.connect(to);
      s.start(t, nzOff(P));
      V.srcs.push(s); V.nodes.push(fl);
    };
    const tone = (type, f0, f1, sweep, to) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
      o.connect(to);
      o.start(t);
      V.srcs.push(o);
    };
    let len;
    switch (ch) {
      case 'k': tone('sine', 210, 46, 0.08, env(0.95, 0.002, 0.075)); len = 0.42; break;                                                // 底鼓
      case 's': noise('highpass', 1100, 0.7, env(0.42, 0.001, 0.045)); tone('triangle', 215, 160, 0.05, env(0.3, 0.001, 0.03)); len = 0.3; break;  // 军鼓
      case 'h': noise('highpass', 7200, 0.8, env(0.22, 0.001, 0.014)); len = 0.1; break;                                            // 闭镲
      case 'o': noise('highpass', 6400, 0.8, env(0.18, 0.002, 0.09)); len = 0.5; break;                                             // 开镲
      case 'c': noise('highpass', 3800, 0.6, env(0.22, 0.002, 0.38)); len = 2; break;                                               // 吊镲
      case 't': tone('sine', 150, 92, 0.2, env(0.6, 0.002, 0.09)); len = 0.5; break;                                                // 低嗵鼓
      case 'T': tone('sine', 235, 150, 0.16, env(0.55, 0.002, 0.075)); len = 0.42; break;                                           // 高嗵鼓
      default: return;
    }
    finish(P, V, t + len);
  }

  // ---------- 播放一首（实时和离线渲染共用同一份） ----------
  // ctx：AudioContext 或 OfflineAudioContext；dest：接到哪；at：从这个时刻开始；o.from 从第几拍开始（接着放），o.fadeIn 淡入秒数，o.once 只放一遍
  // o.gain：这首的音量校正（dB），不给就用乐谱里的 song.gain（levels.json 并进来的），都没有就是 0
  // 位置用「绝对拍」A 记：A = 0 是 at 那一刻；每过一遍循环，base 往后挪一个循环的长度 → 时间一直往前，循环点没有缝
  function player(ctx, dest, id, at, o) {
    o = o || {};
    const song = songOf(id), tl = tlOf(id);
    const P = { ctx, id, song, tl, kit: kitOf(ctx), voices: [], nz: 0, late: 0, saved: 0, steals: 0, most: 0, done: false, end: Infinity, stopAt: Infinity };
    const spb = 60 / (song.bpm || 120);
    const beats = tl.beats, loopBeat = tl.loopBeat, L = beats - loopBeat;
    const loop = !o.once && song.loop !== false && L > 0;
    const sw = clamp(+song.swing || 0, 0, 0.45);
    const from = clamp(Math.floor(o.from || 0), 0, Math.max(0, beats - 1));
    const inst = Object.assign({}, DEF_INST, song.inst), mix = Object.assign({}, DEF_MIX, song.mix);
    let base = -from, cur = from;
    const idx = {};
    ALL.forEach(p => { idx[p] = lower(tl.parts[p], from); });
    P.loop = loop; P.spb = spb; P.from = from; P.t0 = at; P.secs = beats * spb;

    // 摇摆：一拍里后半拍的八分音符往后推（十六分音符跟着按比例挪），三连音的位置不动
    function warp(f) {
      if (!sw) return f;
      const q = f * 8;
      if (Math.abs(q - Math.round(q)) > 1e-6) return f;
      return f <= 0.5 ? f * (1 + sw) : 0.5 + 0.5 * sw + (f - 0.5) * (1 - sw);
    }
    const timeOf = A => { const b = Math.floor(A + 1e-9); return at + (b + warp(Math.max(0, A - b))) * spb; };

    // 声部总线：音量 → 左右 → 这首歌的总音量（交叉淡入淡出用）→ 音乐总线
    // 要淡入的先把增益设成 0：自动化事件从 at 才开始，at 之前读到的是默认值 1——刚建好就被换掉时，淡出会从 1 开始，冒一下声
    const out = ctx.createGain(), nodes = [out];
    if (o.fadeIn > 0) { out.gain.value = 0; out.gain.setValueAtTime(0, at); out.gain.linearRampToValueAtTime(1, at + o.fadeIn); }
    out.connect(dest);
    const pan = (v, to) => {
      if (!ctx.createStereoPanner) return to;
      const p = ctx.createStereoPanner();
      p.pan.value = v; p.connect(to); nodes.push(p);
      return p;
    };
    // 音量校正乘进各声部的总线（回声从旋律总线取，跟着一起变），不多加节点
    const gdb = clamp(Number(o.gain != null ? o.gain : song.gain) || 0, -12, 12), lv = Math.pow(10, gdb / 20);
    P.gain = gdb;
    const bus = {};
    PARTS.forEach(p => { const g = ctx.createGain(); g.gain.value = clamp(+mix[p] || 0, 0, 1.5) * lv; g.connect(pan(PAN[p], out)); nodes.push(g); bus[p] = g; });
    const dbus = {};
    [['c', 0], ['l', -0.28], ['r', 0.26]].forEach(([k, v]) => { const g = ctx.createGain(); g.gain.value = clamp(+mix.drums || 0, 0, 1.5) * lv; g.connect(pan(v, out)); nodes.push(g); dbus[k] = g; });
    // 回声：旋律全量、琶音一半送进附点八分的延迟，反馈回路里有低通（越回越暗）和高通（不糊）
    const echo = clamp(+(song.fx && song.fx.echo) || 0, 0, 0.5);
    if (echo > 0) {
      const dl = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), ret = ctx.createGain(), s1 = ctx.createGain(), s2 = ctx.createGain();
      dl.delayTime.value = Math.min(1.9, spb * 0.75);
      lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.4;
      hp.type = 'highpass'; hp.frequency.value = 280; hp.Q.value = 0.5;
      fb.gain.value = 0.22 + echo * 0.45;
      s1.gain.value = echo; s2.gain.value = echo * 0.5; ret.gain.value = 0.9;
      bus.lead.connect(s1); bus.arp.connect(s2); s1.connect(dl); s2.connect(dl);
      dl.connect(lp); lp.connect(hp); hp.connect(fb); fb.connect(dl); hp.connect(ret);
      ret.connect(pan(-0.22, out));
      nodes.push(dl, fb, lp, hp, ret, s1, s2);
    }

    // 排一个音符（A0：指定绝对拍，接着放时补长音用）
    function fire(p, e, now, A0) {
      const A = A0 != null ? A0 : base + e.t;
      let t = timeOf(A);
      if (p === 'drums') {
        if (t < now - 0.03) { P.late++; return; }   // 主线程卡太久错过的鼓不补（拍子不乱），记个数
        return drum(P, e.ch, t, dbus[DPAN[e.ch] || 'c']);
      }
      const dur = Math.max(0.03, timeOf(A + e.d) - t), name = inst[p], I = INST[name] || INST.pulse25;   // 摇摆 + 三连音混写时结尾可能比开头还早，至少留 30 毫秒
      const g = e.stacc ? dur * 0.5 : Math.max(dur * 0.5, dur - Math.min(dur * (1 - I.gate), 0.05));
      const off = t + g;
      if (t < now - 0.03) {
        // 错过了开头：短音、打击类音色（钟琴/拨弦/木琴）不补；持续类的长音还剩 0.3 秒以上的从现在接上，别留个洞
        P.late++;
        if (!(I.s > 0) || off - now < 0.3) return;
        t = now + 0.01; P.saved++;
      }
      const n = e.notes.length, v = (e.acc ? 1.25 : 1) * (n > 1 ? 1.2 / Math.sqrt(n) : 1);
      const vib = p === 'lead' && e.d >= 1 - 1e-6;
      for (const m of e.notes) voice(P, name, mtof(m), t, off, v, bus[p], vib);
    }
    // 排到 until 这个时刻为止
    P.schedule = function (until) {
      if (P.done) return;
      until = Math.min(until, P.stopAt);
      const now = ctx.currentTime, target = (until - at) / spb;
      for (let guard = 0; guard < 256 && !P.done; guard++) {
        const endS = Math.min(beats, target - base);
        if (endS <= cur + 1e-9) break;
        for (const p of ALL) {
          const ev = tl.parts[p];
          let i = idx[p];
          while (i < ev.length && ev[i].t < endS - 1e-9) fire(p, ev[i++], now);
          idx[p] = i;
        }
        cur = endS;
        if (cur >= beats - 1e-9) {
          if (loop) { base += L; cur = loopBeat; ALL.forEach(p => { idx[p] = lower(tl.parts[p], loopBeat); }); }
          else { P.done = true; P.end = timeOf(base + beats) + TAIL; }
        }
      }
    };
    // 同时发声的数量：超过 CAP 就掐掉最快要结束的那个（多半已经在收尾，听不出来）
    P.add = function (V) {
      if (P.voices.length > 48) { const cut = ctx.currentTime - 0.05; P.voices = P.voices.filter(x => x.end > cut); }
      const live = P.voices.filter(x => !x.dead && x.end > V.start && x.start <= V.start);
      if (live.length >= CAP) {
        live.sort((x, y) => x.end - y.end);
        for (let k = 0; k <= live.length - CAP; k++) { kill(live[k], V.start); live[k].dead = true; P.steals++; }
      }
      P.most = Math.max(P.most, Math.min(live.length, CAP - 1) + 1);
      P.voices.push(V);
    };
    P.live = t => P.voices.reduce((n, x) => n + (!x.dead && x.start <= t && x.end > t ? 1 : 0), 0);
    // 时刻 t 放到这首的第几拍（乐谱里的拍子，循环过就折回去）
    P.pos = t => {
      let s = from + Math.max(0, (t - at) / spb);
      if (loop && s >= beats) s = loopBeat + (s - beats) % L;
      return Math.min(s, beats);
    };
    P.pass = t => { const s = from + Math.max(0, (t - at) / spb); return loop && s >= beats ? 2 + Math.floor((s - beats) / L) : 1; };
    // 淡出：dur 秒后不再排新音，到点由 dispose 收拾（只会把已经在淡出的改快，不会拖长——拖长了到点收拾时音量还没到 0）
    P.fadeOut = function (dur) {
      const now = ctx.currentTime, v0 = out.gain.value;
      if (P.stopAt <= now + dur) return;
      P.stopAt = now + dur;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(v0, now);
      out.gain.linearRampToValueAtTime(0, now + dur);
    };
    P.dispose = function () {
      const now = ctx.currentTime;
      P.done = true;
      P.voices.forEach(V => { if (V.end > now) V.srcs.forEach(s => { try { s.stop(now); } catch (e) { /* 忽略 */ } }); });
      P.voices = [];
      nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* 忽略 */ } });
    };
    if (beats <= 0) { P.done = true; P.end = at; }
    // 从中间接着放：那一刻还在响的长音（铺底、低音）补上剩下的部分，别等到下一个音才有声
    if (from > 0) {
      PARTS.forEach(p => {
        const ev = tl.parts[p];
        for (let i = idx[p] - 1; i >= 0 && i >= idx[p] - 12; i--) {
          const e = ev[i];
          if (e.t + e.d > from + 0.25) fire(p, { notes: e.notes, d: e.t + e.d - from, stacc: false, acc: false }, ctx.currentTime, 0);
        }
      });
    }
    return P;
  }

  // 音乐总线 → 柔一点的低通 → 压低（朗读）→ 静音（麦克风）→ 压限 → 音量 → 喇叭
  function master(ctx) {
    const bus = ctx.createGain(), tone = ctx.createBiquadFilter(), duck = ctx.createGain(), hold = ctx.createGain(), comp = ctx.createDynamicsCompressor(), vol = ctx.createGain();
    bus.gain.value = MASTER;
    tone.type = 'lowpass'; tone.frequency.value = Math.min(9500, ctx.sampleRate * 0.45); tone.Q.value = 0.5;
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.25;
    bus.connect(tone); tone.connect(duck); duck.connect(hold); hold.connect(comp); comp.connect(vol); vol.connect(ctx.destination);
    return { bus, tone, duck, hold, comp, vol };
  }

  // ---------- 实时播放 ----------
  let ctx = null, M = null, want = null, bgm = null, jing = null, paused = null, timer = 0;
  let vol = 1, duckN = 0, holdN = 0;
  let look = LOOK, lastNow = -1, cpu = 0, napTok = 0;
  const gates = { d: 1, h: 1 };
  const fading = new Set();     // 淡出中的（换歌、被小段音乐打断、放完尾音的小段音乐）
  const missing = new Set();
  const curve = v => v * v;     // 音量滑块 → 增益（听感更均匀）

  function ramp(pm, v, dur) {
    const now = ctx.currentTime, v0 = pm.value;
    pm.cancelScheduledValues(now);
    pm.setValueAtTime(v0, now);
    pm.linearRampToValueAtTime(v, now + dur);
  }
  function ensureTimer() { if (!timer) { lastNow = -1; timer = setInterval(tick, TICK); } }
  function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } lastNow = -1; }
  function tick() {
    try {
      if (!ctx) return;
      const c0 = performance.now(), now = ctx.currentTime;
      // 往后排多远自己调：两次排音符之间音频时钟走了多远 = 主线程卡了多久。卡过就多排一点，不卡了每秒收回 0.03 秒
      if (ctx.state === 'running' && !document.hidden && lastNow >= 0) {
        const gap = now - lastNow;
        if (gap > look - 0.15) look = Math.min(LOOK_MAX, gap + 0.25);
        else if (look > LOOK) look = Math.max(LOOK, look - gap * 0.03);
      }
      lastNow = now;
      const hz = now + (document.hidden ? Math.max(1, look) : look);   // 隐藏时定时器 1 秒一次（反正已经挂起）
      if (bgm) bgm.schedule(hz);
      if (jing) {
        jing.p.schedule(hz);
        if (jing.p.done && now >= jing.p.end - 0.45) endJingle('end');   // 尾音还剩一点时背景音乐就开始淡入
      }
      // 音量 0 已经挂起了：淡出中的直接收掉（时钟停了，等不到淡完）
      if (vol === 0 && ctx.state !== 'running') { fading.forEach(p => p.dispose()); fading.clear(); }
      fading.forEach(p => {
        if (now >= p.stopAt + 0.05) { p.dispose(); fading.delete(p); } else p.schedule(hz);
      });
      if (!bgm && !jing && !fading.size) stopTimer();
      cpu = cpu * 0.95 + (performance.now() - c0) * 0.05;
    } catch (e) { warn(e); }
  }
  // 换下来的播放器：淡出，到点由 tick 收拾
  function retire(p, dur) {
    const now = ctx.currentTime;
    if (now - p.t0 < 0.25) dur = Math.min(dur, 0.08);   // 刚开始放就被换掉（还在淡入、几乎没出声）：很快收掉
    p.fadeOut(dur);
    fading.add(p);
    // 一下子连换好几首：还在淡出的背景音乐最多留 2 首，更早的马上收掉（叠在一起又吵又费 CPU）
    const old = [];
    fading.forEach(x => { if (!x.isJingle && x.stopAt > now + 0.1) old.push(x); });
    for (let i = 0; i < old.length - 2; i++) old[i].fadeOut(0.05);
    ensureTimer();
  }
  // 让背景音乐和「该放什么」一致：小段音乐在放 / 音量 0 → 背景音乐很快淡出并记住放到哪；换了歌 → 交叉淡入淡出
  function sync() {
    if (!ctx || !M || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const blocked = !!jing || vol === 0;
    const target = want && songOf(want) ? want : null;
    let xfade = false;
    if (bgm && (blocked || bgm.id !== target)) {
      if (blocked) {
        if (bgm.id === target) paused = { id: bgm.id, pos: Math.floor(bgm.pos(now) + 1e-6) };
        retire(bgm, jing ? 0.15 : 0.06);   // 让给小段音乐 / 音量关掉：很快收
      } else { retire(bgm, 0.8); xfade = true; }
      bgm = null;
    }
    if (blocked || !target || bgm) return;
    const from = paused && paused.id === target ? paused.pos : 0;
    paused = null;
    bgm = player(ctx, M.bus, target, now + 0.05, { from, fadeIn: from ? 0.5 : xfade ? 0.6 : 0.02 });
    bgm.schedule(now + look);
    ensureTimer();
  }
  // 小段音乐结束：how = 'end' 放完了（尾音照放）/ 'cut' 被打断（0.08 秒淡出）；resync = false：先别接背景音乐（马上又有新的小段音乐）
  function endJingle(how, resync) {
    const J = jing;
    if (!J) return;
    jing = null;
    clearTimeout(J.safe);
    if (how === 'cut') J.p.fadeOut(0.08); else J.p.stopAt = Math.max(J.p.end, ctx.currentTime);
    fading.add(J.p);
    ensureTimer();
    J.res();
    if (resync !== false) sync();
  }
  // 压低 / 静音的目标值：朗读时 30%；麦克风在听、页面隐藏时 0
  const gateVals = () => ({ d: duckN > 0 ? DUCK : 1, h: holdN > 0 || document.hidden ? 0 : 1 });
  function applyGates() {
    if (!M) return;
    const g = gateVals();
    if (g.d !== gates.d) { ramp(M.duck.gain, g.d, g.d < gates.d ? 0.12 : 0.5); gates.d = g.d; }
    if (g.h !== gates.h) { ramp(M.hold.gain, g.h, g.h < gates.h ? 0.06 : 0.3); gates.h = g.h; }
  }
  // 等音频时钟走 delay 秒再挂起（先让音量收到 0，直接挂起会「咔」一声）。用一个不出声的音源的 ended 事件计时：
  // 页面隐藏后 setTimeout 会被拖到 1 秒一次，事件不会。should() 到点再确认一次还该不该挂起；napTok 变了 = 取消
  function nap(delay, should) {
    const tok = ++napTok;
    const go = () => { if (tok === napTok && ctx && ctx.state === 'running' && should()) ctx.suspend().catch(noop); };
    try {
      const s = ctx.createConstantSource(), now = ctx.currentTime;
      s.offset.value = 0; s.connect(M.bus);
      s.onended = () => { try { s.disconnect(); } catch (e) { /* 忽略 */ } go(); };
      s.start(now); s.stop(now + delay);
    } catch (e) { setTimeout(go, delay * 1000); }
  }
  // 解锁：第一次点屏幕/按键时创建 AudioContext；以后每次点都看看要不要 resume（被系统挂起、iOS 的 'interrupted'），被关掉了就重建
  function unlock() {
    if (!enabled) return;
    try {
      if (ctx && ctx.state === 'running') return;
      if (ctx && ctx.state === 'closed') drop();
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
        M = master(ctx);
        M.vol.gain.value = curve(vol);
        Object.assign(gates, gateVals());
        M.duck.gain.value = gates.d; M.hold.gain.value = gates.h;
        kitOf(ctx);
        ctx.onstatechange = onState;
      }
      if (ctx.state !== 'running' && vol > 0 && !document.hidden) ctx.resume().catch(noop);
      sync();
    } catch (e) { warn(e); enabled = !!ctx; }
  }
  // AudioContext 被关掉了：放手，下一次点屏幕重建（want 留着，重建后接着放）；等着的小段音乐 Promise 完成
  function drop() {
    const J = jing;
    jing = null; bgm = null; paused = null;
    if (J) { clearTimeout(J.safe); J.res(); }
    fading.clear(); stopTimer(); napTok++;
    ctx.onstatechange = null;
    ctx = null; M = null;
  }
  // 系统把声音挂起了（来电、别的应用抢了声音、iOS 的 'interrupted'）：在前台、音量不是 0 就试着接着放，不行就等下一次点屏幕
  // 被关掉了：马上放手（定时器停掉、等着的 Promise 完成），下一次点屏幕重建
  function onState() {
    const s = ctx && ctx.state;
    if (s === 'closed') drop();
    else if ((s === 'suspended' || s === 'interrupted') && vol > 0 && !document.hidden) ctx.resume().catch(noop);
  }
  // 页面隐藏：小段音乐直接收掉（Promise 完成，回来接着放背景音乐），总音量 0.06 秒收到 0 再挂起；回来：恢复，0.3 秒淡入
  function onVis() {
    if (!ctx || ctx.state === 'closed') return;
    try {
      if (document.hidden) {
        if (jing) endJingle('cut');
        applyGates();
        nap(0.08, () => document.hidden);
      } else {
        napTok++;
        if (vol > 0) { if (ctx.state !== 'running') ctx.resume().catch(noop); }
        else nap(0.2, () => vol === 0);   // 音量 0：照样要挂起（隐藏时那次可能把「音量 0 挂起」顶掉了）
        applyGates();
      }
    } catch (e) { warn(e); }
  }
  if (enabled) {
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVis);
  }

  function play(id) {
    try {
      id = id || null;
      if (id === want) return;
      want = id;
      if (paused && paused.id !== id) paused = null;
      if (id && !songOf(id) && !missing.has(id)) { missing.add(id); if (enabled) warn('没有这首歌：' + id); }
      sync();
    } catch (e) { warn(e); }
  }
  function jingle(id) {
    if (!ctx || !M || vol === 0 || ctx.state === 'closed' || document.hidden || !songOf(id)) return Promise.resolve();
    try {
      if (jing) endJingle('cut', false);   // 新的小段音乐打断还没放完的（不在两个中间把背景音乐拉起来）
      if (ctx.state !== 'running') ctx.resume().catch(noop);
      return new Promise(res => {
        let r = false;
        const J = { id, res: () => { if (!r) { r = true; res(); } } };
        jing = J;
        sync();   // 背景音乐 0.15 秒淡出，记住放到哪
        const now = ctx.currentTime;
        // 还在交叉淡出的背景音乐也一起 0.15 秒收掉，别和小段音乐叠在一起；有背景音乐要让路时小段音乐晚 0.16 秒开始
        let busy = false;
        fading.forEach(p => { if (!p.isJingle && p.stopAt > now) { busy = true; if (p.stopAt > now + 0.15) p.fadeOut(0.15); } });
        J.p = player(ctx, M.bus, id, now + (busy ? 0.16 : 0.03), { once: true });
        J.p.isJingle = true;
        J.p.schedule(now + look);
        // 保险：AudioContext 卡住了（被系统挂起等）也别让游戏一直等
        J.safe = setTimeout(() => { if (jing === J) endJingle('cut'); else J.res(); }, (J.p.secs + TAIL + 2) * 1000);
        ensureTimer();
      });
    } catch (e) { warn(e); return Promise.resolve(); }
  }
  // 计数：开几次就要关几次；多关的不算（不会变成负数，之后开一次照样生效）
  function duck(on) { duckN = Math.max(0, duckN + (on ? 1 : -1)); try { applyGates(); } catch (e) { warn(e); } }
  function hold(on) { holdN = Math.max(0, holdN + (on ? 1 : -1)); try { applyGates(); } catch (e) { warn(e); } }
  function setVolume(v) {
    try {
      v = clamp(Number(v) || 0, 0, 1);
      const was = vol;
      vol = v;
      if (!ctx || !M || ctx.state === 'closed') return;
      ramp(M.vol.gain, curve(v), 0.08);
      if (v === 0 && was > 0) {
        if (jing) endJingle('cut');
        sync();
        nap(0.2, () => vol === 0);   // 音量 0：不排音符，淡出后整个 AudioContext 挂起（省电）
      } else if (v > 0 && was === 0) {
        napTok++;
        if (!document.hidden && ctx.state !== 'running') ctx.resume().catch(noop);
        sync();
      }
    } catch (e) { warn(e); }
  }
  function songs() {
    if (!Core) return [];
    const S = lib();
    return Object.keys(S).map(id => {
      const s = S[id], tl = tlOf(id), spb = 60 / (s.bpm || 120);
      return { id, title: s.title, zh: s.zh, use: s.use, loop: s.loop !== false, seconds: +(tl.beats * spb).toFixed(1), loopSeconds: +((tl.beats - tl.loopBeat) * spb).toFixed(1), bpm: s.bpm, key: s.key, mode: s.mode, meter: s.meter || 4, bars: tl.bars };
    });
  }
  function state() {
    const now = ctx ? ctx.currentTime : 0, p = bgm, beat = p ? p.pos(now) : paused ? paused.pos : null;
    const meter = p ? p.tl.meter : 4;
    return {
      enabled, ctx: ctx ? ctx.state : 'none', current: want, playing: p ? p.id : null,
      beat: beat == null ? null : +beat.toFixed(3), bar: beat == null ? 0 : Math.floor(beat / meter + 1e-6) + 1, bars: p ? p.tl.bars : 0, pass: p ? p.pass(now) : 0,
      duck: duckN, hold: holdN, volume: vol, jingle: jing ? jing.id : null,
      voices: (p ? p.live(now) : 0) + (jing ? jing.p.live(now) : 0), late: p ? p.late : 0, saved: p ? p.saved : 0, time: +now.toFixed(3),
      // 查问题用：淡出中的播放器、节点还没断开的声音、现在往后排几秒、排音符每秒占主线程几毫秒、这首的音量校正 dB
      fading: fading.size, alive: ctx ? kitOf(ctx).alive : 0, look: +look.toFixed(2), cpu: +(cpu * 1000 / TICK).toFixed(2), level: p ? p.gain : 0,
      gain: M ? { duck: +M.duck.gain.value.toFixed(3), hold: +M.hold.gain.value.toFixed(3), volume: +M.vol.gain.value.toFixed(3), reduction: +(typeof M.comp.reduction === 'number' ? M.comp.reduction : (M.comp.reduction && M.comp.reduction.value) || 0).toFixed(2) } : null,
    };
  }
  // 离线渲染一首（检查电平、接缝、导出 WAV）：和实时播放同一套合成和排音符，只是按 0.5 秒一段用 suspend() 推着排
  // opt：seconds 渲染几秒、sampleRate、gain（dB，代替这首的音量校正；render.js --levels 用 0 量原始音量）
  function render(id, opt) {
    if (!enabled) return Promise.resolve(null);
    opt = opt || {};
    const song = songOf(id), tl = tlOf(id);
    if (!song || !OAC) return Promise.reject(new Error('没有这首歌：' + id));
    const spb = 60 / song.bpm, once = song.loop === false;
    const secs = opt.seconds || (once ? tl.beats * spb + TAIL + 0.2 : tl.beats * spb + 10);
    const sr = opt.sampleRate || 44100;
    const octx = new OAC(2, Math.ceil(secs * sr), sr);
    const m = master(octx);
    const P = player(octx, m.bus, id, 0, { gain: opt.gain });
    const STEP = 0.5;
    let err = null;
    P.schedule(Math.min(secs, STEP + LOOK));
    const plan = t => {
      if (t >= secs - 0.05) return;
      octx.suspend(t).then(() => {
        try { P.schedule(Math.min(secs, t + STEP + LOOK)); } catch (e) { err = err || e; }
        plan(t + STEP);
        octx.resume();
      });
    };
    plan(STEP);
    return octx.startRendering().then(buf => {
      if (err) throw err;
      // 给 render.js 看：最多同时几个声音、掐掉几个、漏排几个；alive 渲染完还没断开节点的声音（应该接近 0，查泄漏）；gain 用的音量校正 dB
      const K = kitOf(octx);
      buf.stats = { voices: P.most, steals: P.steals, late: P.late, alive: K.alive, aliveMax: K.aliveMax, gain: P.gain };
      return buf;
    });
  }

  window.EchoMusic = {
    play, jingle, duck, hold, setVolume, songs, state, render, unlock,
    get current() { return want; },
    INSTS: Object.keys(INST),
  };
})();
