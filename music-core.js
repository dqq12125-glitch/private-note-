// 回声岛配乐的乐谱格式（游戏里的 music.js 和 Node 里的 tools/music/build.js 共用）
// - timeline(song)：把乐谱展开成按拍子排好的音符事件（music.js 拿去合成）
// - check(song)：检查乐谱——每小节拍数、音域、乐器名（错误），调外音、强拍不协和、太单调、太密（警告），外加统计
// 乐谱写法见 tools/music/SPEC.md
(function (root) {
  'use strict';
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11], melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9], minorPentatonic: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], wholeTone: [0, 2, 4, 6, 8, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  const PARTS = ['lead', 'harm', 'arp', 'bass'];
  // 每个声部允许的音域（MIDI 号，C4 = 60）
  const RANGE = { lead: [55, 96], harm: [45, 84], arp: [52, 100], bass: [28, 62] };
  // 合成器提供的音色（music.js 实现）
  const INSTS = ['pulse12', 'pulse25', 'pulse50', 'tri', 'saw', 'sine', 'wave', 'flute', 'bell', 'pluck', 'organ', 'strings', 'brass', 'bass', 'marimba'];
  const DRUMS = 'kshoctT.';   // k 底鼓 s 军鼓 h 闭镲 o 开镲 c 吊镲 t 低嗵鼓 T 高嗵鼓 . 空
  const DENS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
  const EPS = 1e-6;

  function midi(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    return (+m[3] + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  // 时值：'4' 四分音符 = 1 拍；'8.' 附点八分；'2+8' 二分连八分；'12' 八分三连音的一个
  function dur(s) {
    let beats = 0;
    for (const p of s.split('+')) {
      const m = /^(\d+)(\.?)$/.exec(p);
      if (!m || !DENS.includes(+m[1])) return null;
      beats += 4 / +m[1] * (m[2] ? 1.5 : 1);
    }
    return beats;
  }
  // 一个音符：'C5/8'、'r/4'、'[C4 E4 G4]/2'、'G4/8^'（断奏）、'A4/4!'（重音）
  function token(tok) {
    const m = /^(r|\[[^\]]+\]|[A-G][#b]?-?\d)\/([0-9.+]+)([\^!]*)$/.exec(tok);
    if (!m) return { err: '看不懂的音符 "' + tok + '"' };
    const beats = dur(m[2]);
    if (beats == null) return { err: '看不懂的时值 "' + tok + '"' };
    let notes = [];
    if (m[1] === 'r') notes = [];
    else if (m[1][0] === '[') notes = m[1].slice(1, -1).trim().split(/\s+/).map(midi);
    else notes = [midi(m[1])];
    if (notes.some(n => n == null)) return { err: '看不懂的音名 "' + tok + '"' };
    return { notes, beats, stacc: m[3].includes('^'), acc: m[3].includes('!') };
  }
  const grid = song => (song.drumGrid || 4) * (song.meter || 4);

  // 展开整首：order 里的段落按顺序接起来
  function timeline(song) {
    const meter = song.meter || 4, errors = [];
    const out = { lead: [], harm: [], arp: [], bass: [], drums: [] };
    const sections = song.sections || {}, order = song.order || [];
    let t = 0, bars = 0, loopBeat = 0;
    order.forEach((name, oi) => {
      if (oi === (song.loopFrom || 0)) loopBeat = t;
      const sec = sections[name];
      if (!sec) { errors.push('order 里的段落 "' + name + '" 没有定义'); return; }
      const lens = Object.keys(sec).filter(k => k !== 'bars').map(k => (sec[k] || []).length);
      const n = sec.bars || Math.max(0, ...lens);
      Object.keys(sec).forEach(k => {
        if (k === 'bars') return;
        if (!PARTS.includes(k) && k !== 'drums') errors.push(name + '：不认识的声部 "' + k + '"（只有 lead harm arp bass drums）');
        else if ((sec[k] || []).length !== n) errors.push(name + '.' + k + '：' + (sec[k] || []).length + ' 小节，别的声部是 ' + n + ' 小节');
      });
      for (let b = 0; b < n; b++) {
        const t0 = t + b * meter;
        PARTS.forEach(p => {
          const bar = sec[p] && sec[p][b];
          if (bar == null) return;
          let x = 0;
          for (const tok of String(bar).match(/\[[^\]]*\]\S*|\S+/g) || []) {   // 和弦 [C4 E4 G4]/2 里有空格，整个当一个音符
            const e = token(tok);
            if (e.err) { errors.push(name + '.' + p + ' 第 ' + (b + 1) + ' 小节：' + e.err); return; }
            if (e.notes.length) out[p].push({ t: t0 + x, d: e.beats, notes: e.notes, stacc: e.stacc, acc: e.acc, bar: bars + b, sec: name });
            x += e.beats;
          }
          if (Math.abs(x - meter) > EPS) errors.push(name + '.' + p + ' 第 ' + (b + 1) + ' 小节：一共 ' + +x.toFixed(3) + ' 拍，应该是 ' + meter + ' 拍（"' + bar + '"）');
        });
        const dr = sec.drums && sec.drums[b];
        if (dr != null) {
          const s = String(dr).replace(/\s+/g, ''), g = grid(song), step = meter / g;
          if (s.length !== g) errors.push(name + '.drums 第 ' + (b + 1) + ' 小节：' + s.length + ' 格，应该是 ' + g + ' 格');
          for (let i = 0; i < s.length; i++) {
            if (!DRUMS.includes(s[i])) { errors.push(name + '.drums 第 ' + (b + 1) + ' 小节：不认识的鼓 "' + s[i] + '"'); continue; }
            if (s[i] !== '.') out.drums.push({ t: t0 + i * step, ch: s[i], bar: bars + b });
          }
        }
      }
      t += n * meter; bars += n;
    });
    return { parts: out, beats: t, bars, loopBeat, meter, bpm: song.bpm, errors };
  }

  // 检查：errors 必须改，warnings 要看情况
  function check(song) {
    const errors = [], warnings = [], st = {};
    const need = ['id', 'title', 'bpm', 'key', 'mode', 'order', 'sections'];
    need.forEach(k => { if (song[k] == null) errors.push('缺少 ' + k); });
    if (errors.length) return { errors, warnings, stats: st };
    const tl = timeline(song);
    errors.push(...tl.errors);
    const meter = song.meter || 4, spb = 60 / song.bpm;
    if (!(song.bpm >= 50 && song.bpm <= 220)) errors.push('bpm 要在 50–220');
    if (![2, 3, 4, 5, 6].includes(meter)) errors.push('meter 只能是 2–6（按四分音符算的拍数）');
    const tonic = PC[String(song.key)[0]] + (song.key[1] === '#' ? 1 : song.key[1] === 'b' ? -1 : 0);
    const scale = MODES[song.mode];
    if (isNaN(tonic)) errors.push('key 写成 C、F#、Bb 这样');
    if (!scale) errors.push('mode 只能是 ' + Object.keys(MODES).join(' / '));
    Object.entries(song.inst || {}).forEach(([p, v]) => {
      if (!PARTS.includes(p)) errors.push('inst 里不认识的声部 ' + p);
      if (!INSTS.includes(v)) errors.push('不认识的音色 ' + v + '（可用：' + INSTS.join(' ') + '）');
    });
    PARTS.forEach(p => {
      if (tl.parts[p].length && !(song.inst || {})[p]) errors.push(p + ' 声部有音符但 inst 里没给音色');
      const [lo, hi] = RANGE[p];
      tl.parts[p].forEach(e => e.notes.forEach(n => { if (n < lo || n > hi) errors.push(p + ' 第 ' + (e.bar + 1) + ' 小节的音 ' + n + ' 超出音域 ' + lo + '–' + hi); }));
      if ((p === 'lead' || p === 'bass') && tl.parts[p].some(e => e.notes.length > 1)) errors.push(p + ' 声部只能是单音（和弦写在 harm 里）');
      if (tl.parts[p].some(e => e.notes.length > 4)) errors.push(p + ' 声部同时最多 4 个音');
    });
    // 调外音比例
    let all = 0, out = 0;
    if (scale && !isNaN(tonic)) PARTS.forEach(p => tl.parts[p].forEach(e => e.notes.forEach(n => { all++; if (!scale.includes(((n - tonic) % 12 + 12) % 12)) out++; })));
    st.outOfKey = all ? +(out / all).toFixed(3) : 0;
    if (st.outOfKey > 0.15) warnings.push('调外音占 ' + Math.round(st.outOfKey * 100) + '%（超过 15%，确认是故意的半音经过或转调）');
    // 强拍上旋律和低音 / 和声的刺耳音程（小二度、大七度、三全音）
    const at = (p, t) => tl.parts[p].filter(e => e.t <= t + EPS && e.t + e.d > t + EPS).flatMap(e => e.notes);
    const strong = meter % 2 === 0 ? 2 : meter;
    let sb = 0, clash = 0;
    for (let t = 0; t < tl.beats; t += strong) {
      const ld = at('lead', t); if (!ld.length) continue;
      const other = at('bass', t).concat(at('harm', t));
      if (!other.length) continue;
      sb++;
      if (other.some(o => [1, 6, 11].includes(Math.abs(ld[0] - o) % 12))) clash++;
    }
    st.strongClash = sb ? +(clash / sb).toFixed(3) : 0;
    if (st.strongClash > 0.12) warnings.push('强拍上旋律和低音/和声刺耳（小二度/大七度/三全音）占 ' + Math.round(st.strongClash * 100) + '%');
    // 旋律：大跳、同音反复、重复度、密度
    const L = tl.parts.lead;
    let leaps = 0, rep = 0, maxRep = 0;
    for (let i = 1; i < L.length; i++) {
      const iv = Math.abs(L[i].notes[0] - L[i - 1].notes[0]);
      if (iv > 12) leaps++;
      rep = iv === 0 ? rep + 1 : 0; maxRep = Math.max(maxRep, rep + 1);
    }
    if (leaps > 2) warnings.push('旋律有 ' + leaps + ' 处超过八度的大跳');
    if (maxRep >= 8) warnings.push('旋律有连续 ' + maxRep + ' 个同音');
    const leadBars = [];
    order(song).forEach(name => { const s = song.sections[name]; if (s && s.lead) leadBars.push(...s.lead.map(b => String(b).trim())); });
    st.distinctLeadBars = leadBars.length ? +(new Set(leadBars).size / leadBars.length).toFixed(2) : 0;
    st.bars = tl.bars;
    st.seconds = +(tl.beats * spb).toFixed(1);
    st.loopSeconds = +((tl.beats - tl.loopBeat) * spb).toFixed(1);
    st.leadNotesPerSec = L.length ? +(L.length / (tl.beats * spb)).toFixed(2) : 0;
    if (song.loop !== false) {
      if (st.loopSeconds < 30) warnings.push('循环只有 ' + st.loopSeconds + ' 秒，背景音乐听久了会腻（建议 40–100 秒）');
      if (st.loopSeconds > 150) warnings.push('循环 ' + st.loopSeconds + ' 秒，太长了');
      if (leadBars.length >= 8 && st.distinctLeadBars < 0.3) warnings.push('旋律小节只有 ' + Math.round(st.distinctLeadBars * 100) + '% 不重复，太单调');
    } else if (st.seconds > 8) warnings.push('一次性的小音乐有 ' + st.seconds + ' 秒，太长了（建议 1.5–6 秒）');
    return { errors: [...new Set(errors)], warnings, stats: st };
  }
  const order = song => song.order || [];

  const api = { PARTS, RANGE, INSTS, MODES, DRUMS, midi, dur, token, timeline, check };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MusicCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
