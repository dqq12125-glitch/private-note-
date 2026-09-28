// 回声岛 Echo Island — 游戏逻辑（纯前端，无需安装）
(function () {
  'use strict';

  const W = window.WORLDS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const range = n => Array.from({ length: n }, (_, i) => i);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  // ---------- 关卡配方：每个岛 7 关，最后是 Boss ----------
  const RECIPES = [
    { name: '听词', icon: '🎧', desc: '听单词，选出意思和拼写。', mix: [['lw', 6], ['ls', 4]] },
    { name: '说词', icon: '🎤', desc: '跟读单词，再看图说出英文。', mix: [['sr_w', 4], ['sp', 4], ['lw', 2]] },
    { name: '听句', icon: '🎧', desc: '听整句话，理解意思、排出顺序。', mix: [['lm', 5], ['lo', 3], ['ls', 2]] },
    { name: '说句', icon: '🎤', desc: '一句一句跟读，把句子说顺。', mix: [['sr_s', 5], ['lo', 2], ['lm', 3]] },
    { name: '对话', icon: '💬', desc: '听对方说话，选出并说出合适的回答。', mix: [['lr', 6], ['sr_d', 4]] },
    { name: '挑战', icon: '⚡', desc: '所有题型混在一起，还会复习前面岛上的内容。', mix: [['lw', 2], ['ls', 1], ['lm', 2], ['lo', 2], ['lr', 2], ['sr_s', 2], ['sp', 1]], review: true },
    { name: 'BOSS', icon: '👑', desc: '和岛主面对面对话！听懂它的话，大声说出正确回答来攻击它。', mix: [['bt', 6], ['lo', 2]], boss: true },
  ];
  const KIND = { lw: 'word', ls: 'word', sp: 'word', sr_w: 'word', lm: 'sent', lo: 'sent', sr_s: 'sent', lr: 'dlg', sr_d: 'dlg', bt: 'dlg' };
  const TYPE_LABEL = { lw: '🎧 听音选义', ls: '🎧 听音选词', lm: '🎧 听句选意', lr: '💬 听问选答', lo: '🧩 听音排句', sr_w: '🎤 单词跟读', sr_s: '🎤 句子跟读', sr_d: '🎤 说出回答', sp: '🖼️ 看图说英语', bt: '⚔️ 对话攻击' };
  const TYPE_TAG = { lw: '听音选义', ls: '听音选词', lm: '听句选意', lr: '听问选答', lo: '听音排句', sr_w: '单词跟读', sr_s: '句子跟读', sr_d: '说出回答', sp: '看图说英语', bt: '对话攻击' };
  const SPEAK_TYPES = ['sr_w', 'sr_s', 'sr_d', 'sp'];
  const PRAISE = ['太棒了！', 'Great!', 'Nice!', '答对了！', 'Excellent!', 'Well done!', '厉害！'];

  const TITLES = [[1, '见习水手'], [3, '小小水手'], [5, '听力侦探'], [7, '口语新星'], [10, '发音达人'], [13, '对话高手'], [16, '岛屿探险家'], [20, '英语船长'], [25, '回声大师'], [30, '传奇船长']];
  const PETS = [['🐣', 0, '小鸡'], ['🐱', 60, '小猫'], ['🐶', 60, '小狗'], ['🐰', 80, '兔子'], ['🐸', 80, '青蛙'], ['🦊', 120, '狐狸'], ['🐼', 150, '熊猫'], ['🐧', 150, '企鹅'], ['🦉', 200, '猫头鹰'], ['🐬', 250, '海豚'], ['🦄', 400, '独角兽'], ['🐲', 600, '小龙']];
  const CHEST_PETS = [['🦖', '小恐龙'], ['🦋', '蝴蝶'], ['🐙', '小章鱼']];

  const QPOOL = [
    { id: 'lv2', t: '完成 2 个关卡', goal: 2, key: 'levels', rw: 20 },
    { id: 'lv4', t: '完成 4 个关卡', goal: 4, key: 'levels', rw: 40 },
    { id: 'sp10', t: '开口说对 10 次', goal: 10, key: 'spoken', rw: 20 },
    { id: 'sp25', t: '开口说对 25 次', goal: 25, key: 'spoken', rw: 40 },
    { id: 'cb8', t: '一关里连击达到 8', goal: 8, key: 'combo', max: true, rw: 30 },
    { id: 'st3', t: '拿到 1 次三星', goal: 1, key: 'three', rw: 30 },
    { id: 'pf5', t: '获得 5 次 Perfect 发音', goal: 5, key: 'perfect', rw: 30 },
    { id: 'ls20', t: '听力题答对 20 道', goal: 20, key: 'listen', rw: 20 },
    { id: 'rv5', t: '在错题本复习 5 题', goal: 5, key: 'review', rw: 30 },
    { id: 'rp1', t: '完成 1 次对话角色扮演', goal: 1, key: 'roleplay', rw: 30 },
    { id: 'bt3', t: '赢得 3 场怪兽对战', goal: 3, key: 'battle', rw: 30 },
    { id: 'ct1', t: '收服 1 只野生怪兽', goal: 1, key: 'catch', rw: 40 },
  ];
  const QDEF = Object.fromEntries(QPOOL.map(q => [q.id, q]));

  const ACH = [
    ['first', '🚩', '起航', '完成第 1 关', s => s.stats.levels >= 1],
    ['lv10', '⛵', '乘风破浪', '完成 10 关', s => s.stats.levels >= 10],
    ['lv50', '🚢', '远洋航行', '完成 50 关', s => s.stats.levels >= 50],
    ['boss1', '⚔️', '初战告捷', '打败第 1 个 Boss', s => s.stats.bosses >= 1],
    ['boss5', '🛡️', 'Boss 猎人', '打败 5 个 Boss', s => s.stats.bosses >= 5],
    ['allboss', '👑', '群岛之王', '打败全部 13 个 Boss', s => W.every((w, i) => (s.stars[i + '-6'] || 0) > 0)],
    ['c10', '🔥', '十连击', '一关里连击 10 次', s => s.stats.maxCombo >= 10],
    ['flaw', '🎯', '零失误', '一关里每题都答对', s => s.stats.flawless >= 1],
    ['sp50', '🎤', '敢开口', '开口说对 50 次', s => s.stats.spoken >= 50],
    ['sp300', '📣', '口语达人', '开口说对 300 次', s => s.stats.spoken >= 300],
    ['pf30', '💯', '标准发音', '获得 30 次 Perfect 发音', s => s.stats.perfect >= 30],
    ['st3', '📅', '三天打卡', '连续打卡 3 天', s => s.streak >= 3],
    ['st7', '🗓️', '一周不断', '连续打卡 7 天', s => s.streak >= 7],
    ['st30', '🏅', '月度坚持', '连续打卡 30 天', s => s.streak >= 30],
    ['three10', '⭐', '星星收集者', '拿到 10 次三星', s => s.stats.threeStars >= 10],
    ['world', '🏝️', '完美海岛', '一个岛的 7 关全部三星', s => W.some((w, i) => range(7).every(l => (s.stars[i + '-' + l] || 0) === 3))],
    ['rv20', '📕', '知错就改', '在错题本复习 20 题', s => s.stats.reviewed >= 20],
    ['pets3', '🐾', '宠物之家', '拥有 3 只宠物', s => s.pets.length >= 3],
    ['rich', '💰', '小富翁', '同时拥有 500 金币', s => s.coins >= 500],
    ['actor', '🎬', '小演员', '完成 5 次对话角色扮演', s => s.stats.roleplay >= 5],
    ['catch1', '🔮', '第一个伙伴', '收服第 1 只野生怪兽', s => (s.mon.caught || 0) >= 1],
    ['dex8', '📖', '图鉴收集家', '图鉴点亮 8 种怪兽', s => window.MonsterGame && MonsterGame.caughtCount(s) >= 8],
    ['dexall', '🌈', '怪兽大师', '图鉴点亮全部 16 种怪兽', s => window.MonsterGame && MonsterGame.caughtCount(s) >= MonsterGame.total],
    ['evo1', '✨', '进化！', '第一次让怪兽进化', s => (s.mon.evolved || 0) >= 1],
    ['badge5', '🏅', '徽章收集者', '拿到 5 枚馆主徽章', s => Object.keys(s.mon.badges).length >= 5],
    ['badgeall', '🏆', '冠军训练师', '拿到全部 13 枚馆主徽章', s => Object.keys(s.mon.badges).length >= W.length],
  ];

  // ---------- 存档 ----------
  const KEY = 'echo-island-v1';
  function fresh() {
    return {
      v: 1, xp: 0, coins: 50, stars: {}, streak: 0, lastDay: '', freeze: 0,
      quests: { day: '', list: [], chest: false }, wrong: {}, pets: ['🐣'], pet: '🐣', ach: {},
      stats: { levels: 0, spoken: 0, perfect: 0, maxCombo: 0, listen: 0, reviewed: 0, threeStars: 0, bosses: 0, flawless: 0, roleplay: 0 }, scenes: {},
      settings: { rate: 0.9, voice: '', mode: 'auto', tts: 'auto', sfx: true, unlockAll: false }, seenIntro: false,
      homeTab: 'mon', mon: window.MonsterGame ? MonsterGame.fresh() : { box: [], team: [], dex: {}, badges: {}, balls: 5 },
    };
  }
  function merge(base, o) {
    for (const k in o) {
      const a = base[k], b = o[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) merge(a, b);
      else base[k] = b;
    }
    return base;
  }
  function load(fallback) {
    try { const s = localStorage.getItem(KEY); if (s) return merge(fresh(), JSON.parse(s)); } catch (e) { /* 存储不可用 */ }
    if (fallback) return merge(fresh(), fallback);
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 存储不可用 */ } }

  let S = fresh();
  const RT = { srBroken: false, noRec: false, rec: null, mr: null, recUrl: '', listening: false, recording: false, lastRest: Date.now(), resetArm: false, scrollCur: true };
  let P = null; // 当前关卡

  // ---------- 日期 / 连续打卡 ----------
  const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  function checkStreak() {
    if (!S.lastDay) return;
    const d = dayDiff(S.lastDay, dayStr());
    if (d <= 1) return;
    if (d === 2 && S.freeze > 0 && S.streak > 0) {
      S.freeze--;
      S.lastDay = dayStr(new Date(Date.now() - 864e5));
      setTimeout(() => toast('🧊 连胜保护卡生效，' + S.streak + ' 天连续打卡保住了！', 'gold'), 600);
    } else if (S.streak > 0) {
      const lost = S.streak;
      S.streak = 0;
      setTimeout(() => toast('💧 ' + lost + ' 天的连续打卡断了，今天重新开始吧'), 600);
    }
    save();
  }
  function markToday() {
    const t = dayStr();
    if (S.lastDay === t) return false;
    const d = S.lastDay ? dayDiff(S.lastDay, t) : 99;
    S.streak = d === 1 ? S.streak + 1 : 1;
    S.lastDay = t;
    return true;
  }

  // ---------- 等级 ----------
  function lvInfo(xp) {
    let lv = 1, need = 100, x = xp;
    while (x >= need) { x -= need; lv++; need = 100 + (lv - 1) * 40; }
    return { lv, cur: x, need };
  }
  const titleOf = lv => TITLES.filter(t => t[0] <= lv).pop()[1];

  // ---------- 音效（WebAudio 合成，无需文件） ----------
  let AC = null;
  function ac() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, t0, dur, type, vol) {
    if (!S.settings.sfx) return;
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    ok(c) { const b = 523 * Math.pow(1.059, Math.min(c, 14)); tone(b, 0, .12, 'triangle', .16); tone(b * 1.26, .07, .12, 'triangle', .16); tone(b * 1.5, .14, .22, 'triangle', .16); },
    bad() { tone(233, 0, .16, 'sawtooth', .06); tone(174, .13, .26, 'sawtooth', .06); },
    star(i) { tone(784 * Math.pow(1.19, i), 0, .35, 'sine', .2); tone(1568 * Math.pow(1.19, i), .02, .25, 'sine', .06); },
    coin() { tone(988, 0, .08, 'square', .05); tone(1319, .07, .22, 'square', .05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .3, 'triangle', .16)); tone(1047, .5, .6, 'sine', .12); },
    hit() { tone(140, 0, .18, 'square', .1); tone(90, .06, .25, 'sawtooth', .08); },
    tap() { tone(700, 0, .05, 'sine', .05); },
  };
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 不支持 */ } }

  // ---------- 朗读：优先用手机/浏览器自带英语声音，没有就用有道在线发音 ----------
  const TTS = { voices: [], v: null, ok: 'speechSynthesis' in window, loaded: false };
  const PREF = [/(Aria|Jenny|Ava|Emma|Guy).*(Online|Natural)/i, /Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Zira|David)/i, /Google UK English Female/i, /Karen|Daniel|Moira|Tessa/i];
  // 有道两种口音（type=2 美音 / type=1 英音）正好给对话里的两个角色用
  const onlineUrl = (text, g) => 'https://dict.youdao.com/dictvoice?type=' + (g === 'm' ? 1 : 2) + '&audio=' + encodeURIComponent(text);
  const FEM = /female|samantha|aria|jenny|ava|emma|zira|karen|moira|tessa|serena|victoria|allison|susan|libby|sonia|natasha|michelle|joanna|salli|kendra|fiona|kate/i;
  const MALE = /\bmale|daniel|david|guy|alex|fred|mark|ryan|aaron|arthur|george|thomas|oliver|christopher|eric|roger|brian|matthew|justin|rishi/i;
  const genderOf = v => !v ? '' : /female/i.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : FEM.test(v.name) ? 'f' : '';
  function loadVoices() {
    if (!TTS.ok) return;
    const all = speechSynthesis.getVoices();
    if (all.length) TTS.loaded = true;
    TTS.voices = all.filter(v => /^en([-_]|$)/i.test(v.lang));
    pickVoice();
  }
  function pickVoice() {
    const vs = TTS.voices;
    TTS.v = vs.find(v => v.name === S.settings.voice) || PREF.map(p => vs.find(v => p.test(v.name))).find(Boolean) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs[0] || null;
    const pool = [TTS.v, ...vs.filter(v => /en[-_]US/i.test(v.lang)), ...vs].filter(Boolean);
    TTS.vf = pool.find(v => genderOf(v) === 'f') || null;
    TTS.vm = pool.find(v => genderOf(v) === 'm') || null;
  }
  // 自带声音不可用（没有英语声音、合成失败）时改用在线发音
  function useOnline() {
    const m = S.settings.tts;
    if (m === 'online') return true;
    if (m === 'device') return false;
    return !TTS.ok || RT.ttsBroken || (TTS.loaded && !TTS.voices.length);
  }
  function endPlaying() { $$('.spk.playing').forEach(b => b.classList.remove('playing')); }
  function startPlaying() { const main = $('#p-body .spk:not(.mini)'); if (main) main.classList.add('playing'); }
  function sayOnline(text, rate, res, g) {
    const a = RT.audio || (RT.audio = new Audio());
    let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(t); endPlaying(); res(); };
    const t = setTimeout(fin, 4000 + text.length * 200);
    a.onended = fin;
    a.onerror = () => { if (!done) toast('在线发音没加载出来，检查一下网络'); fin(); };
    a.src = onlineUrl(text, g);
    a.playbackRate = (rate || S.settings.rate) < 0.75 ? 0.75 : 1;
    startPlaying();
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => { if (!done) toast('点一下 🔊 就能听到发音'); fin(); });
  }
  // g：对话角色的声音 'f' / 'm'；不传就用默认声音
  function say(text, rate, g) {
    return new Promise(res => {
      if (!text) return res();
      stopListening();
      if (TTS.ok) speechSynthesis.cancel();
      if (RT.audio) RT.audio.pause();
      if (useOnline()) { sayOnline(text, rate, res, g); return; }
      const u = new SpeechSynthesisUtterance(text);
      const v = g === 'f' ? (TTS.vf || TTS.v) : g === 'm' ? (TTS.vm || TTS.v) : TTS.v;
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'en-US';
      // 找不到对应性别的声音时，用音调区分两个角色
      if (g && genderOf(v) !== g) u.pitch = g === 'm' ? 0.75 : 1.3;
      u.rate = rate || S.settings.rate;
      let done = false;
      const fin = () => { if (done) return; done = true; endPlaying(); res(); };
      u.onend = fin;
      u.onerror = e => {
        // 被新的朗读打断不算失败；真失败就切到在线发音重读一遍
        if (!done && e && e.error && !/interrupted|canceled/.test(e.error) && S.settings.tts !== 'device') {
          RT.ttsBroken = true; done = true; sayOnline(text, rate, res, g); return;
        }
        fin();
      };
      setTimeout(fin, 1800 + text.length * 150 / u.rate);
      startPlaying();
      speechSynthesis.speak(u);
    });
  }
  // iOS / 微信要求第一次出声必须在点击里：点击时先“解锁”两种发音方式
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function primeTTS() {
    if (RT.primed) return;
    RT.primed = true;
    if (TTS.ok) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* 忽略 */ } }
    try { RT.audio = RT.audio || new Audio(); RT.audio.src = silentWav(); const p = RT.audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 忽略 */ }
  }

  // ---------- 语音识别 + 评分 ----------
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  const FATAL = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'];
  const canRecord = () => !RT.noRec && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function speakMode() {
    if (S.settings.mode === 'self') return 'self';
    if (!SRC || RT.srBroken) return 'self';
    return 'sr';
  }
  function recognize(onInterim) {
    return new Promise(resolve => {
      let r;
      try { r = new SRC(); } catch (e) { return resolve({ alts: [], err: 'service-not-allowed' }); }
      r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
      let alts = [], err = null, finished = false;
      const end = () => {
        if (finished) return;
        finished = true; clearTimeout(t1); clearTimeout(t2); RT.rec = null; RT.listening = false;
        resolve({ alts, err });
      };
      r.onresult = e => {
        const rs = Array.from(e.results);
        const main = rs.map(x => x[0].transcript).join(' ').trim();
        if (onInterim) onInterim(main);
        const set = [main];
        if (rs.length === 1) for (let k = 1; k < rs[0].length; k++) set.push(rs[0][k].transcript);
        alts = set.filter(Boolean);
      };
      r.onerror = e => { err = e.error; };
      r.onend = end;
      const t1 = setTimeout(() => { try { r.stop(); } catch (e) { /* 忽略 */ } }, 10000);
      const t2 = setTimeout(end, 13000);
      RT.rec = r; RT.listening = true;
      try { r.start(); } catch (e) { err = 'start-failed'; end(); }
    });
  }
  function stopListening() {
    if (RT.rec) { try { RT.rec.stop(); } catch (e) { /* 忽略 */ } }
    if (RT.mr && RT.recording) { try { RT.mr.stop(); } catch (e) { /* 忽略 */ } }
  }

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function n2w(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + n2w(n % 100) : '');
    return String(n);
  }
  const ORDS = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth' };
  function ord(n) {
    if (ORDS[n]) return ORDS[n];
    if (n < 20) return ONES[n] + 'th';
    if (n % 10 === 0 && n < 100) return TENS[n / 10].replace(/y$/, 'ieth');
    if (n < 100) return TENS[Math.floor(n / 10)] + ' ' + ord(n % 10);
    return n2w(n);
  }
  const SPELL = { colour: 'color', favourite: 'favorite', maths: 'math', grey: 'gray', centre: 'center', okay: 'ok', mum: 'mom', mr: 'mister', ms: 'miss', pingpong: 'ping pong', cannot: 'can not' };
  function norm(s) {
    s = ' ' + String(s).toLowerCase().replace(/[’‘`]/g, "'") + ' ';
    s = s.replace(/\b((?:[a-z]\.){2,})/g, m => m.replace(/\./g, ''));
    s = s.replace(/(\d+):(\d\d)/g, (m, h, mm) => n2w(+h) + ' ' + (+mm === 0 ? "o'clock" : (mm[0] === '0' ? 'oh ' + n2w(+mm) : n2w(+mm))));
    s = s.replace(/(\d+)(st|nd|rd|th)\b/g, (m, d) => ord(+d));
    s = s.replace(/\d+/g, d => ' ' + n2w(+d) + ' ');
    s = s.replace(/\blet's\b/g, 'let us').replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
      .replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'s\b/g, ' is').replace(/'d\b/g, ' would').replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have');
    s = s.replace(/-/g, ' ').replace(/'/g, '').replace(/[^a-z ]/g, ' ');
    return s.split(/\s+/).filter(Boolean).map(w => SPELL[w] || w).join(' ').split(' ').filter(Boolean);
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = range(n + 1);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const tokEq = (a, b) => a === b || (a.length > 3 && b.length > 3 && lev(a, b) <= 1);
  function lcsFlags(t, h) {
    const m = t.length, n = h.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = tokEq(t[i - 1], h[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const flags = new Array(m).fill(false);
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (tokEq(t[i - 1], h[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) { flags[i - 1] = true; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return { flags, n: dp[m][n] };
  }
  // 返回 0–100 分，以及每个原始单词是否读对
  function scoreSpeech(target, heard) {
    const words = target.split(/\s+/).filter(Boolean);
    const flat = [], owner = [];
    words.forEach((w, k) => norm(w).forEach(t => { flat.push(t); owner.push(k); }));
    const h = norm(heard);
    if (!flat.length || !h.length) return { score: 0, marks: words.map(() => false) };
    const { flags, n } = lcsFlags(flat, h);
    const recall = n / flat.length, f1 = 2 * n / (flat.length + h.length);
    let s = 0.6 * recall + 0.4 * f1;
    const a = flat.join(''), b = h.join('');
    if (flat.length <= 2) s = Math.max(s, (1 - lev(a, b) / Math.max(a.length, b.length)) * 0.95);
    else s = s * s * (2 - s); // 句子：漏读关键词时扣分更明显
    if (flat.length <= 3 && (' ' + h.join(' ') + ' ').includes(' ' + flat.join(' ') + ' ')) s = 1;
    const marks = words.map((w, k) => { const idx = owner.map((o, i) => o === k ? i : -1).filter(i => i >= 0); return idx.length === 0 || idx.every(i => flags[i]); });
    if (s >= 0.98 || (words.length === 1 && s >= 0.9)) marks.fill(true);
    return { score: Math.round(Math.max(0, Math.min(1, s)) * 100), marks };
  }
  function bestScore(target, alts) {
    let best = { score: -1, marks: [], heard: '' };
    alts.forEach(a => { const r = scoreSpeech(target, a); if (r.score > best.score) best = { ...r, heard: a }; });
    return best;
  }

  // ---------- 出题 ----------
  function distract(list, i, n, keyIdx) {
    const seen = new Set([list[i][keyIdx]]);
    const out = [];
    for (const j of shuffle(range(list.length))) {
      if (j === i || seen.has(list[j][keyIdx])) continue;
      seen.add(list[j][keyIdx]); out.push(list[j]);
      if (out.length === n) break;
    }
    return out;
  }
  const tokens = s => s.split(/\s+/).map(t => t.replace(/[.,!?]+$/g, '')).filter(Boolean);

  function makeQ(type, wi, i) {
    const w = W[wi];
    const q = { type, kind: KIND[type], w: wi, i };
    if (q.kind === 'word') {
      const it = w.words[i];
      q.en = it[0]; q.zh = it[1]; q.em = it[2];
      if (type === 'lw') { q.audio = it[0]; q.opts = shuffle([{ c: true, e: it[2], t: it[1] }, ...distract(w.words, i, 3, 1).map(o => ({ e: o[2], t: o[1] }))]); }
      if (type === 'ls') { q.audio = it[0]; q.opts = shuffle([{ c: true, t: it[0] }, ...distract(w.words, i, 3, 0).map(o => ({ t: o[0] }))]); }
      if (type === 'sr_w') { q.audio = it[0]; q.target = it[0]; }
      if (type === 'sp') { q.audio = null; q.target = it[0]; }
    } else if (q.kind === 'sent') {
      const it = w.sents[i];
      q.en = it[0]; q.zh = it[1];
      if (type === 'lm') { q.audio = it[0]; q.opts = shuffle([{ c: true, t: it[1] }, ...distract(w.sents, i, 3, 1).map(o => ({ t: o[1] }))]); }
      if (type === 'lo') { q.audio = it[0]; q.tokens = tokens(it[0]); q.bank = shuffle(range(q.tokens.length)); }
      if (type === 'sr_s') { q.audio = it[0]; q.target = it[0]; }
    } else {
      const it = w.dlgs[i];
      q.prompt = it[0]; q.en = it[1]; q.audio = it[0];
      if (type === 'lr' || type === 'bt') q.opts = shuffle([{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))]);
      if (type === 'sr_d') q.target = it[1];
    }
    return q;
  }

  function buildLevel(wi, li) {
    const r = RECIPES[li], bags = {}, qs = [];
    const next = (kind, wj) => {
      const k = wj + ':' + kind;
      const len = kind === 'word' ? W[wj].words.length : kind === 'sent' ? W[wj].sents.length : W[wj].dlgs.length;
      if (!bags[k] || !bags[k].length) bags[k] = shuffle(range(len));
      return bags[k].pop();
    };
    r.mix.forEach(([t, n]) => {
      for (let k = 0; k < n; k++) {
        const wj = r.review && wi > 0 && Math.random() < 0.3 ? rnd(wi) : wi;
        qs.push(makeQ(t, wj, next(KIND[t], wj)));
      }
    });
    if (!r.boss) return shuffle(qs);
    const bt = qs.filter(q => q.type === 'bt'), lo = qs.filter(q => q.type === 'lo');
    return [bt[0], bt[1], lo[0], bt[2], bt[3], lo[1], bt[4], bt[5]].filter(Boolean);
  }

  function buildReview() {
    const ents = Object.entries(S.wrong).sort((a, b) => b[1].m - a[1].m).slice(0, 10);
    return shuffle(ents.map(([k, e]) => {
      const t = e.k === 'word' ? pick(['lw', 'ls', 'sp']) : e.k === 'sent' ? pick(['lm', 'lo', 'sr_s']) : pick(['lr', 'sr_d']);
      const q = makeQ(t, e.w, e.i);
      q.rkey = k;
      return q;
    }));
  }
  function addWrong(q) {
    if (!q || !q.kind) return;
    const k = q.kind + ':' + q.w + ':' + q.i;
    const prev = S.wrong[k];
    S.wrong[k] = { k: q.kind, w: q.w, i: q.i, m: (prev ? prev.m : 0) + 1 };
    const keys = Object.keys(S.wrong);
    if (keys.length > 80) { keys.sort((a, b) => S.wrong[a].m - S.wrong[b].m); delete S.wrong[keys[0]]; }
  }

  // ---------- 每日任务 ----------
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function ensureQuests() {
    const t = dayStr();
    if (S.quests.day === t && S.quests.list.length) return;
    const r = seeded(t);
    const pool = QPOOL.filter(q => q.key !== 'review' || Object.keys(S.wrong).length >= 5);
    const picked = [], keys = new Set();
    let guard = 0;
    while (picked.length < 3 && guard++ < 100) {
      const q = pool[Math.floor(r() * pool.length)];
      if (keys.has(q.key)) continue;
      keys.add(q.key); picked.push({ id: q.id, p: 0, claimed: false });
    }
    S.quests = { day: t, list: picked, chest: false };
    save();
  }
  function qProg(key, n, isMax) {
    ensureQuests();
    S.quests.list.forEach(q => {
      const d = QDEF[q.id];
      if (!d || d.key !== key || q.claimed) return;
      const was = q.p >= d.goal;
      q.p = Math.min(d.goal, isMax ? Math.max(q.p, n) : q.p + n);
      if (!was && q.p >= d.goal) toast('✅ 任务完成：' + d.t + '，回地图领奖励', 'gold');
    });
  }

  // ---------- 成就 ----------
  function checkAch() {
    ACH.forEach(([id, e, name, , cond]) => {
      if (S.ach[id] || !cond(S)) return;
      S.ach[id] = Date.now();
      S.coins += 20;
      toast('🏆 新成就「' + name + '」 +20 金币', 'gold');
      SFX.coin();
    });
    save();
  }

  // ---------- 提示与弹窗 ----------
  const recentToasts = {};
  function toast(msg, cls) {
    // 同一句提示 8 秒内只弹一次，避免连续朗读失败时刷屏
    const now = Date.now();
    if (recentToasts[msg] && now - recentToasts[msg] < 8000) return;
    recentToasts[msg] = now;
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
  function openModal(html, opts) {
    $('#sheet').innerHTML = html;
    $('#modal').hidden = false;
    RT.modalLocked = !!(opts && opts.locked);
    const f = $('#sheet [data-focus]') || $('#sheet button:not([disabled])');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; RT.resetArm = false; }

  function confetti(n) {
    if (reduced) return;
    const c = $('#fx'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const Wd = window.innerWidth, Hd = window.innerHeight;
    c.width = Wd * dpr; c.height = Hd * dpr; ctx.scale(dpr, dpr);
    const cols = ['#FFC53D', '#FF6B57', '#2CAE69', '#0E7C86', '#8E6CEF', '#FF5E9C'];
    const ps = Array.from({ length: n || 140 }, () => ({ x: Wd / 2 + (Math.random() - .5) * 120, y: Hd * .38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: pick(cols) }));
    const t0 = performance.now();
    (function f(t) {
      ctx.clearRect(0, 0, Wd, Hd);
      ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(f); else ctx.clearRect(0, 0, Wd, Hd);
    })(t0);
  }

  // ---------- 首页 ----------
  function isUnlocked(wi, li) {
    if (S.settings.unlockAll) return true;
    if (li === 0) return wi === 0 || (S.stars[(wi - 1) + '-6'] || 0) > 0;
    return (S.stars[wi + '-' + (li - 1)] || 0) > 0;
  }
  function currentNode() {
    for (let wi = 0; wi < W.length; wi++) for (let li = 0; li < 7; li++)
      if (isUnlocked(wi, li) && !(S.stars[wi + '-' + li] > 0)) return wi + '-' + li;
    return '';
  }
  const starStr = n => '<span>' + '★'.repeat(n) + '</span><span class="off">' + '★'.repeat(3 - n) + '</span>';

  function renderTop() {
    const L = lvInfo(S.xp);
    $('#t-pet').textContent = S.pet;
    $('#t-lv').textContent = 'Lv ' + L.lv;
    $('#t-title').textContent = titleOf(L.lv);
    $('#t-xp').style.width = (L.cur / L.need * 100) + '%';
    $('#t-coins').textContent = S.coins;
    $('#t-streak-n').textContent = S.streak;
    $('#t-streak').classList.toggle('off', S.lastDay !== dayStr());
    $('#t-streak').title = S.lastDay === dayStr() ? '今天已打卡，连续 ' + S.streak + ' 天' : '今天还没打卡，完成任意一关就算';
    const n = Object.keys(S.wrong).length;
    $('#t-wrong').textContent = n ? n : '';
  }
  function questHTML() {
    ensureQuests();
    const L = S.quests.list;
    const allDone = L.length && L.every(q => q.claimed);
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.max(1, Math.round((mid - now) / 36e5));
    const rows = L.map(q => {
      const d = QDEF[q.id]; if (!d) return '';
      const done = q.p >= d.goal;
      const right = done && !q.claimed
        ? '<button class="btn small sun claim" data-act="claim" data-q="' + q.id + '">领取 +' + d.rw + '</button>'
        : '<span class="q-rw">' + (q.claimed ? '✓ 已领取' : q.p + ' / ' + d.goal) + '</span>';
      return '<div class="q-row ' + (q.claimed ? 'done' : '') + '"><span class="q-name">' + d.t + '</span>' + right + '<span class="q-bar"><i style="width:' + Math.min(100, q.p / d.goal * 100) + '%"></i></span></div>';
    }).join('');
    const opened = S.quests.chest, ready = allDone && !opened;
    const chest = '<button class="chest-btn ' + (ready ? 'ready' : '') + '" data-act="chest" ' + (ready ? '' : 'disabled') + '><span class="ch">' + (opened ? '📭' : '🎁') + '</span><span><b>' + (opened ? '今天的宝箱已经打开' : ready ? '每日宝箱可以打开了！' : '每日宝箱') + '</b><br><small>' + (opened ? '明天任务会刷新，记得回来' : '领完 3 个任务奖励就能打开，可能开出限定宠物') + '</small></span></button>';
    return '<div class="q-head"><h3>今日任务</h3><small>' + hrs + ' 小时后刷新</small></div>' + rows + chest;
  }
  const OFFS = [0, -56, -78, -34, 38, 76, 0];
  function worldHTML(w, wi, cur) {
    const unlocked = isUnlocked(wi, 0);
    const tot = range(7).reduce((a, l) => a + (S.stars[wi + '-' + l] || 0), 0);
    const head = '<div class="w-head"><span class="w-ico">' + w.icon + '</span><div><div class="w-no">第 ' + (wi + 1) + ' 岛</div><h2>' + w.name + '</h2><p class="w-en">' + esc(w.en) + '</p></div>' +
      (unlocked ? '<span class="w-stars">★ ' + tot + '/21</span>' : '<span class="w-lock">🔒 打败上一岛的 Boss 解锁</span>') + '</div>';
    if (!unlocked) return '<section class="world locked" style="--wc:' + w.color + '">' + head + '</section>';
    const nodes = RECIPES.map((r, li) => {
      const k = wi + '-' + li, st = S.stars[k] || 0, un = isUnlocked(wi, li), isCur = k === cur;
      const cls = ['node', r.boss ? 'boss' : '', st ? 'done' : '', un ? '' : 'lock', isCur ? 'cur' : ''].join(' ');
      return '<button class="' + cls + '" style="--x:' + OFFS[li] + 'px" data-act="level" data-w="' + wi + '" data-l="' + li + '"' + (un ? '' : ' disabled') + ' aria-label="' + w.name + ' ' + r.name + (un ? '' : '（未解锁）') + '">' +
        (isCur ? '<span class="n-start">开始</span><span class="n-pet">' + S.pet + '</span>' : '') +
        '<span class="n-ico">' + (un ? (r.boss ? w.boss.emoji : r.icon) : '🔒') + '</span>' +
        '<span class="n-name">' + (r.boss ? 'BOSS · ' + w.boss.name : r.name) + '</span><span class="n-stars">' + (un ? starStr(st) : '') + '</span></button>';
    }).join('');
    const sc = window.SCENES && window.SCENES[wi], seen = S.scenes[wi];
    const scBtn = sc ? '<button class="scene-btn" data-act="scene" data-w="' + wi + '"><span class="sb-ico">🎬</span><span class="sb-t"><b>对话动画 · ' + esc(sc.title) + '</b><small>' +
      (seen && seen.watched ? '✓ 看过了 · 可以再来跟读、角色扮演' : '先看看这个话题的英语对话怎么说 · 第一次看完 +10 金币') + '</small></span><span class="sb-go">▶</span></button>' : '';
    return '<section class="world" style="--wc:' + w.color + '">' + head + '<div class="path">' + scBtn + nodes + '</div></section>';
  }
  function renderHome() {
    renderTop();
    const tab = window.MonsterGame && S.homeTab !== 'quiz' ? 'mon' : 'quiz';
    $('#tabs').innerHTML = window.MonsterGame ? '<button class="' + (tab === 'mon' ? 'on' : '') + '" data-act="tab" data-t="mon">🐲 怪兽冒险</button><button class="' + (tab === 'quiz' ? 'on' : '') + '" data-act="tab" data-t="quiz">📚 闯关练习</button>' : '';
    $('#quests').innerHTML = questHTML();
    $('#mon-home').hidden = tab !== 'mon';
    $('#quiz-home').hidden = tab !== 'quiz';
    if (tab === 'mon') { $('#mon-home').innerHTML = MonsterGame.homeHTML(); MonsterGame.afterHome(); return; }
    const cur = currentNode();
    $('#map').innerHTML = W.map((w, wi) => worldHTML(w, wi, cur)).join('');
    if (RT.scrollCur) {
      RT.scrollCur = false;
      const n = $('.node.cur');
      if (n) setTimeout(() => n.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 120);
    }
  }
  function show(id) {
    ['home', 'play', 'result', 'theater', 'battle'].forEach(s => { $('#' + s).hidden = s !== id; });
    $('#topbar').hidden = id === 'play' || id === 'theater' || id === 'battle';
    window.scrollTo(0, 0);
  }
  function goHome(tab) {
    if (typeof tab === 'string') S.homeTab = tab;
    if (window.MonsterGame) MonsterGame.stop();
    if (T) { stopScene(); T = null; }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    P = null;
    hideFb();
    RT.scrollCur = true;
    show('home');
    renderHome();
  }

  // ---------- 关卡详情 ----------
  function levelSheet(wi, li) {
    const w = W[wi], r = RECIPES[li];
    const st = S.stars[wi + '-' + li] || 0;
    const types = [...new Set(r.mix.map(m => m[0]))].map(t => '<span class="tag">' + TYPE_TAG[t] + '</span>').join('');
    let items;
    if (li <= 1) items = w.words.map(x => [x[0], x[2] + ' ' + x[1]]);
    else if (li <= 3) items = w.sents.map(x => [x[0], x[1]]);
    else items = w.dlgs.map(x => [x[0] + ' → ' + x[1], '']);
    const pre = items.map(([en, zh]) => '<button class="pre-item" data-act="sayText" data-t="' + esc(en.replace(' → ', ' ... ')) + '">🔊 <b>' + esc(en) + '</b><span>' + esc(zh) + '</span></button>').join('');
    openModal(
      '<div class="big">' + (r.boss ? w.boss.emoji : r.icon) + '</div>' +
      '<h2>' + w.name + ' · ' + (r.boss ? 'BOSS ' + w.boss.name : r.name) + '</h2>' +
      '<p>' + r.desc + (r.boss ? '' : ' 共 ' + r.mix.reduce((a, m) => a + m[1], 0) + ' 题，3 颗心。') + '</p>' +
      '<div class="lv-types">' + types + '</div>' +
      (st ? '<p>最好成绩：<span class="n-stars" style="font-size:18px">' + starStr(st) + '</span></p>' : '') +
      (li === 4 && window.SCENES && window.SCENES[wi] ? '<button class="btn sun wide" data-act="scene" data-w="' + wi + '">🎬 先看对话动画</button>' : '') +
      '<details class="pre"><summary>📖 先预习一下（点一句就能听）</summary><div class="pre-list">' + pre + '</div></details>' +
      '<div class="row"><button class="btn ghost" data-act="close">再想想</button><button class="btn" data-act="start" data-w="' + wi + '" data-l="' + li + '" data-focus>开始闯关</button></div>'
    );
  }

  // ---------- 闯关 ----------
  function startLevel(wi, li, review) {
    primeTTS(); ac();
    const qs = review ? buildReview() : buildLevel(wi, li);
    if (!qs.length) { toast('错题本是空的，太棒了！'); return; }
    const boss = !review && RECIPES[li].boss;
    P = { wi, li, review: !!review, qs, idx: 0, total: qs.length, hearts: 3, combo: 0, maxCombo: 0, correct: 0, xp: 0, lost: 0, hits: 0, boss, bossMax: qs.filter(q => q.type === 'bt').length, revived: false };
    show('play');
    renderHearts();
    $('#p-combo').textContent = '';
    $('#p-boss').innerHTML = boss ? bossBar() : '';
    if (boss) {
      const b = W[wi].boss;
      hideFb();
      $('#p-prog').style.width = '0%';
      $('#p-body').innerHTML = '<div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="hidden-line">' + esc(b.hello) + '</div></div></div>' +
        '<p class="say-zh" style="text-align:center">' + b.name + ' 挡住了去路！听懂它的话，<b>大声说出</b>正确的回答来攻击它。</p>' +
        '<button class="btn sun wide" data-act="bossGo" data-focus>⚔️ 迎战！</button>';
      say(b.hello);
    } else renderQ();
  }
  function bossBar() {
    const b = W[P.wi].boss;
    const pct = P.bossMax ? (1 - P.hits / P.bossMax) * 100 : 100;
    return '<div class="boss-hp" id="bosshp"><span class="be">' + b.emoji + '</span><span class="bn">' + b.name + '</span><div class="hp"><i style="width:' + pct + '%"></i></div></div>';
  }
  function renderHearts() {
    $('#p-hearts').innerHTML = range(3).map(i => '<span class="' + (i < P.hearts ? '' : 'lost') + '">❤️</span>').join('');
  }
  function showCombo() {
    const el = $('#p-combo');
    if (P.combo >= 2) {
      const m = mult();
      el.textContent = '🔥 ' + P.combo + ' 连击' + (m > 1 ? ' · 经验 ×' + m : '');
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    } else el.textContent = '';
  }
  const mult = () => P.combo >= 10 ? 3 : P.combo >= 5 ? 2 : P.combo >= 3 ? 1.5 : 1;

  const audioBlock = () => '<div class="q-audio"><button class="spk" data-act="say" aria-label="播放">' + SPK + '</button><button class="slow" data-act="saySlow" aria-label="慢速播放"><span>🐢</span>慢速</button></div>';
  function optsHTML(q, cls, list) {
    return '<div class="opts ' + (list ? 'list' : '') + '">' + q.opts.map((o, i) =>
      '<button class="opt ' + (cls || '') + '" data-act="' + (q.type === 'bt' ? 'btOpt' : 'pick') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' +
      (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div>';
  }
  function micHTML(q) {
    const mode = speakMode();
    const selfNoRec = mode === 'self' && !canRecord();
    let h = '';
    if (!selfNoRec) {
      h += '<div class="mic-wrap"><button class="mic" id="mic" data-act="mic" aria-label="开始说话">' + MIC + '</button>' +
        '<div class="mic-hint" id="mic-hint">' + (mode === 'sr' ? '点麦克风，然后大声说英语' : '点麦克风开始录音，说完再点一次') + '</div>' +
        '<div class="heard" id="heard"></div><div id="score"></div></div>';
    }
    h += '<div class="self" id="self" hidden></div>';
    h += '<button class="link" data-act="skip">现在不方便开口？跳过这题</button>';
    return h;
  }
  function wordsHTML(text) { return text.split(/\s+/).map(w => '<span class="w">' + esc(w) + '</span>').join(' '); }

  function renderQ() {
    const q = P.qs[P.idx];
    P.q = q; P.answered = false; P.tries = 0; P.hint = 0; P.lo = []; P.btChoose = false; P.pickedOk = false; P.selfReveal = false;
    hideFb();
    $('#p-prog').style.width = (P.idx / P.total * 100) + '%';
    let h = '<div class="q-type">' + TYPE_LABEL[q.type] + '</div>';
    const t = q.type;
    if (t === 'lw') h += '<h2 class="q-title">听一听，选出正确的意思</h2>' + audioBlock() + optsHTML(q);
    else if (t === 'ls') h += '<h2 class="q-title">听一听，选出你听到的英文</h2>' + audioBlock() + optsHTML(q, 'en');
    else if (t === 'lm') h += '<h2 class="q-title">听句子，选出正确的中文意思</h2>' + audioBlock() + optsHTML(q, '', true);
    else if (t === 'lr') h += '<h2 class="q-title">对方这样说，你该怎么回答？</h2>' + audioBlock() +
      '<div class="hidden-line blur" id="hl">' + esc(q.prompt) + '</div><div style="text-align:center"><button class="link" data-act="reveal">看原文（先试着只用耳朵听）</button></div>' + optsHTML(q, 'en', true);
    else if (t === 'lo') h += '<h2 class="q-title">听句子，按顺序点出单词</h2>' + audioBlock() +
      '<div class="lo-ans" id="lo-ans"></div><div class="lo-bank" id="lo-bank">' + q.bank.map(i => '<button class="tile" data-act="tile" data-i="' + i + '">' + esc(q.tokens[i]) + '</button>').join('') + '</div>' +
      '<button class="btn wide" data-act="loCheck" id="lo-check" disabled>检查</button>';
    else if (t === 'sr_w' || t === 'sr_s') h += '<h2 class="q-title">先听，再大声跟读</h2>' +
      '<div class="say-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') + '<div class="say-text" id="st">' + wordsHTML(q.target) + '</div><div class="say-zh">' + esc(q.zh) + '</div>' +
      '<div class="say-row"><button class="spk mini" data-act="sayT" aria-label="听原音">' + SPK + '</button><button class="slow" data-act="sayTSlow" aria-label="慢速"><span>🐢</span>慢速</button></div></div>' + micHTML(q);
    else if (t === 'sr_d') h += '<h2 class="q-title">听对方说话，然后大声说出你的回答</h2>' +
      '<div class="bubble-row"><span class="be">🧑‍🏫</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="听对方说">' + SPK + '</button><span>' + esc(q.prompt) + '</span></div></div></div>' +
      '<div class="say-card"><div class="say-zh">你来说：</div><div class="say-text" id="st">' + wordsHTML(q.target) + '</div><div class="say-row"><button class="spk mini" data-act="sayT" aria-label="听示范">' + SPK + '</button><button class="slow" data-act="sayTSlow"><span>🐢</span>慢速</button></div></div>' + micHTML(q);
    else if (t === 'sp') h += '<h2 class="q-title">看图，用英语说出来</h2>' +
      '<div class="say-card"><div class="say-emoji">' + q.em + '</div><div class="say-zh">' + esc(q.zh) + '</div><div class="say-text mask" id="st">' + esc(q.target.replace(/[a-z]/gi, '_')) + '</div>' +
      '<div class="say-row"><button class="btn small ghost" data-act="hint" id="hintbtn">💡 提示</button></div></div>' + micHTML(q);
    else if (t === 'bt') {
      const b = W[P.wi].boss, sr = speakMode() === 'sr';
      h += '<div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="再听一遍">' + SPK + '</button><button class="slow" data-act="saySlow"><span>🐢</span>慢速</button></div>' +
        '<div class="hidden-line blur" id="hl">' + esc(q.prompt) + '</div><button class="link" data-act="reveal">看原文</button></div></div>' +
        '<p class="say-zh" style="text-align:center;margin:0">' + (sr ? '选一句正确的回答，<b>大声说出来</b>攻击它！（点选项可以先听一听）' : '先点出正确的回答，再大声说出来攻击它！') + '</p>' +
        optsHTML(q, 'en', true) + (sr ? micHTML(q) : '<div class="self" id="self" hidden></div>');
    }
    $('#p-body').innerHTML = h;
    if (SPEAK_TYPES.includes(t) && speakMode() === 'self' && !canRecord()) showSelf(false);
    if (t !== 'sp') setTimeout(() => { if (P && P.q === q) say(q.audio); }, 380);
  }

  function praise() { return pick(PRAISE); }
  function showFb(ok, title, detail, btn) {
    const fb = $('#fb');
    fb.className = 'fb show ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
    $('#fb-t').textContent = title;
    $('#fb-d').innerHTML = detail || '';
    $('#fb-btn').textContent = btn || '继续';
    $('#p-prog').style.width = ((P.idx + 1) / P.total * 100) + '%';
    setTimeout(() => $('#fb-btn').focus({ preventScroll: true }), 60);
  }
  function hideFb() { $('#fb').className = 'fb'; }

  function good(speak, perfect) {
    P.combo++; P.correct++;
    P.maxCombo = Math.max(P.maxCombo, P.combo);
    const gain = Math.round((speak ? (perfect ? 20 : 15) : 10) * mult());
    P.xp += gain;
    if (speak) { S.stats.spoken++; qProg('spoken', 1); if (perfect) { S.stats.perfect++; qProg('perfect', 1); } }
    else { S.stats.listen++; qProg('listen', 1); }
    if (P.review && P.q.rkey && S.wrong[P.q.rkey]) { delete S.wrong[P.q.rkey]; S.stats.reviewed++; qProg('review', 1); }
    SFX.ok(P.combo);
    showCombo();
    if (P.boss && P.q.type === 'bt') bossHit();
    return gain;
  }
  function bad() {
    P.combo = 0; P.hearts--; P.lost++;
    addWrong(P.q);
    SFX.bad(); buzz(120);
    renderHearts(); showCombo();
  }
  function bossHit() {
    P.hits++;
    $('#p-boss').innerHTML = bossBar();
    const bar = $('#bosshp');
    bar.classList.add('hit');
    SFX.hit();
    const d = document.createElement('span');
    d.className = 'dmg'; d.textContent = '-' + Math.round(100 / P.bossMax) + '%';
    d.style.left = '60%'; d.style.top = '0';
    bar.style.position = 'relative';
    bar.appendChild(d);
  }
  function detailOf(q) {
    if (q.kind === 'dlg') return '<b>' + esc(q.prompt) + '</b> → ' + esc(q.en);
    return '<b>' + esc(q.en) + '</b> · ' + esc(q.zh);
  }

  // 选择题
  function onPick(i) {
    if (!P || P.answered) return;
    const q = P.q, o = q.opts[i];
    P.answered = true;
    $$('#p-body .opt').forEach((b, k) => {
      if (q.opts[k].c) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const hl = $('#hl'); if (hl) hl.classList.remove('blur');
    if (o.c) { const g = good(false); showFb(true, praise() + ' +' + g + ' 经验', detailOf(q)); }
    else {
      bad();
      showFb(false, '哎呀，不对', '正确答案：' + detailOf(q));
      setTimeout(() => say(q.type === 'lr' ? q.en : q.audio), 300);
    }
  }
  // 听音排句
  function onTile(i, fromAns) {
    if (!P || P.answered) return;
    const q = P.q;
    if (fromAns) P.lo = P.lo.filter(x => x !== i);
    else if (!P.lo.includes(i)) P.lo.push(i);
    SFX.tap();
    $('#lo-ans').innerHTML = P.lo.map(k => '<button class="tile" data-act="untile" data-i="' + k + '">' + esc(q.tokens[k]) + '</button>').join('');
    $$('#lo-bank .tile').forEach(b => b.classList.toggle('used', P.lo.includes(+b.dataset.i)));
    $('#lo-check').disabled = P.lo.length !== q.tokens.length;
  }
  function onLoCheck() {
    if (!P || P.answered) return;
    const q = P.q;
    P.answered = true;
    const ok = P.lo.map(k => q.tokens[k].toLowerCase()).join(' ') === q.tokens.map(t => t.toLowerCase()).join(' ');
    $('#lo-ans').classList.add(ok ? 'right' : 'wrong');
    if (ok) { const g = good(false); showFb(true, praise() + ' +' + g + ' 经验', detailOf(q)); }
    else { bad(); showFb(false, '顺序不对', '正确句子：' + detailOf(q)); setTimeout(() => say(q.audio), 300); }
  }

  // 口语题
  function setMic(on, label) {
    const m = $('#mic'); if (!m) return;
    m.classList.toggle('on', on);
    m.innerHTML = on ? STOP : MIC;
    if (label !== undefined) $('#mic-hint').textContent = label;
  }
  async function onMic() {
    if (!P || P.answered) return;
    if (RT.listening || RT.recording) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const q = P.q;
    if (speakMode() === 'sr') {
      setMic(true, '正在听……说完会自动停止');
      $('#heard').textContent = '';
      $('#score').innerHTML = '';
      const res = await recognize(t => { const h = $('#heard'); if (h) h.textContent = t; });
      if (!P || P.q !== q || P.answered) return;
      setMic(false, '');
      if (res.err && FATAL.includes(res.err)) {
        RT.srBroken = true;
        if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
        toast(RT.noRec ? '用不了麦克风，已切换成「大声读 + 自评」模式' : '这个浏览器连不上语音识别，已切换成「录音自评」模式');
        if (q.type === 'bt') { P.btChoose = true; const wrap = $('.mic-wrap'); if (wrap) wrap.remove(); toast('点出正确的回答，再大声说出来'); }
        else renderQ();
        return;
      }
      if (!res.alts.length) { $('#mic-hint').textContent = '没听清，靠近一点、大声一点，再点一次麦克风'; return; }
      if (q.type === 'bt') evalBoss(res.alts); else evalSpeak(res.alts);
    } else {
      startRecording();
    }
  }
  function evalSpeak(alts) {
    const q = P.q;
    const r = bestScore(q.target, alts);
    $('#heard').textContent = '我听到的是：“' + r.heard + '”';
    const st = $('#st');
    if (st && !st.classList.contains('mask')) $$('.w', st).forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    const cls = r.score >= 85 ? 'good' : r.score >= 60 ? 'mid' : 'low';
    $('#score').innerHTML = '<div class="score ' + cls + '"><b>' + r.score + '</b><span>分</span></div>';
    if (r.score >= 60) passSpeak(r.score, true);
    else {
      P.tries++;
      if (P.tries >= 3) failSpeak();
      else { SFX.bad(); $('#mic-hint').textContent = (q.type === 'sp' ? '再试一次！可以点「提示」' : '红色的词没读准，先点🔊听一遍，再试一次') + '（第 ' + (P.tries + 1) + '/3 次）'; }
    }
  }
  function passSpeak(score, measured) {
    const q = P.q;
    P.answered = true;
    const perfect = measured && score >= 85;
    if (q.type === 'sp') { const st = $('#st'); st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); }
    const g = good(true, perfect);
    showFb(true, (perfect ? 'Perfect！发音超棒' : score >= 75 ? 'Good！说得不错' : '过关！再多练练会更好') + ' +' + g + ' 经验', detailOf(q));
  }
  function failSpeak() {
    const q = P.q;
    P.answered = true;
    P.combo = 0; showCombo();
    addWrong(q);
    if (q.type === 'sp') { const st = $('#st'); st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); }
    showFb(false, '没关系，这句先记下来', '已放进错题本（不扣心）：' + detailOf(q));
    setTimeout(() => say(q.target || q.en), 300);
  }
  function onSkip() {
    if (!P || P.answered) return;
    stopListening();
    P.answered = true;
    P.combo = 0; showCombo();
    const q = P.q;
    if (q.type === 'sp') { const st = $('#st'); st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); }
    showFb(null, '已跳过', detailOf(q));
  }
  function onHint() {
    if (!P || P.answered) return;
    const q = P.q, st = $('#st');
    P.hint++;
    if (P.hint === 1) st.textContent = q.target.split(' ').map(w => w[0] + w.slice(1).replace(/[a-z]/gi, '_')).join('  ');
    else { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); say(q.target); const b = $('#hintbtn'); if (b) b.disabled = true; }
    if (P.hint === 1) { const b = $('#hintbtn'); if (b) b.textContent = '💡 再给点提示'; }
  }

  // 录音自评（识别不可用时）
  async function startRecording() {
    if (!canRecord()) { showSelf(false); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { RT.noRec = true; const w = $('.mic-wrap'); if (w) w.remove(); showSelf(false); return; }
    const q = P && P.q;
    let mr;
    try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); RT.noRec = true; showSelf(false); return; }
    const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      RT.recording = false; RT.mr = null; clearTimeout(RT.recTimer);
      if (!P || P.q !== q) return;
      if (RT.recUrl) URL.revokeObjectURL(RT.recUrl);
      RT.recUrl = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      setMic(false, '录好了！在下面比一比');
      showSelf(true);
    };
    RT.mr = mr; RT.recording = true;
    mr.start();
    setMic(true, '正在录音……说完点一下停止');
    RT.recTimer = setTimeout(() => { if (RT.recording) stopListening(); }, 9000);
  }
  function showSelf(hasRec) {
    const q = P.q, box = $('#self');
    if (!box) return;
    const sp = q.type === 'sp', st = $('#st');
    if (sp && !hasRec && st && st.classList.contains('mask') && !P.selfReveal) {
      box.hidden = false;
      box.innerHTML = '<p>先看图<b>大声说出英文</b>，说完再看答案</p><button class="btn small" data-act="selfReveal">我说完了，看答案</button>';
      return;
    }
    if (sp && st) { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); if (hasRec) say(q.target); }
    box.hidden = false;
    box.innerHTML = '<p>' + (q.type === 'bt' ? '现在对着' + W[P.wi].boss.name + '大声说：<b>' + esc(q.target) + '</b>' : hasRec ? '听听自己的录音，和原音比一比，像不像？' : '大声读 2 遍，然后诚实地给自己打个分') + '</p>' +
      '<div class="say-row">' + (hasRec ? '<button class="btn small ghost" data-act="playMine">▶ 我的录音</button>' : '') + '<button class="btn small ghost" data-act="sayT">🔊 原音</button></div>' +
      '<div class="rate"><button class="btn coral" data-act="rate" data-v="0">😅 再练练</button><button class="btn sun" data-act="rate" data-v="1">🙂 还行</button><button class="btn leaf" data-act="rate" data-v="2">😎 很像</button></div>';
  }
  function onRate(v) {
    if (!P || P.answered) return;
    if (v === 0) {
      P.tries++;
      if (P.tries >= 3) { failSpeak(); return; }
      toast('再听一遍原音，跟着读 ' + (canRecord() && P.q.type !== 'bt' ? '，然后重新录音' : ''));
      say(P.q.target);
      if (canRecord() && P.q.type !== 'bt' && speakMode() === 'self') { $('#self').hidden = true; setMic(false, '点麦克风重新录音'); }
      return;
    }
    passSpeak(v === 2 ? 90 : 72, false);
  }

  // Boss 对话
  function evalBoss(alts) {
    const q = P.q;
    const scores = q.opts.map(o => bestScore(o.t, alts));
    let bi = 0; scores.forEach((s, k) => { if (s.score > scores[bi].score) bi = k; });
    const best = scores[bi];
    $('#heard').textContent = '我听到的是：“' + best.heard + '”';
    if (q.opts[bi].c && best.score >= 55) {
      markBt(bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      passBoss(best.score);
    } else if (!q.opts[bi].c && best.score >= 65) {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, W[P.wi].boss.name + ' 躲开了！这句回答不对', '正确回答：' + detailOf(q));
      setTimeout(() => say(q.en), 300);
    } else {
      P.tries++;
      if (P.tries >= 3) { P.btChoose = true; $('#mic-hint').textContent = '识别不太准？直接点出正确回答，再大声读一遍也行'; }
      else $('#mic-hint').textContent = '没对上任何一个选项，再说一次（第 ' + (P.tries + 1) + '/3 次）';
    }
  }
  function markBt(ri, wi) {
    $$('#p-body .opt').forEach((b, k) => { b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim'); });
  }
  function passBoss(score) {
    P.answered = true;
    const g = good(true, score >= 85);
    showFb(true, (score >= 85 ? '暴击！' : '命中！') + ' +' + g + ' 经验', detailOf(P.q));
  }
  function onBtOpt(i) {
    if (!P || P.answered) return;
    const q = P.q;
    if (speakMode() === 'sr' && !P.btChoose) { say(q.opts[i].t); return; }
    if (P.pickedOk) return;
    if (q.opts[i].c) {
      P.pickedOk = true;
      markBt(i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      q.target = q.opts[i].t;
      const w = $('.mic-wrap'); if (w) w.remove();
      if (!$('#self')) $('#p-body').insertAdjacentHTML('beforeend', '<div class="self" id="self" hidden></div>');
      showSelf(false);
      say(q.target);
    } else {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, W[P.wi].boss.name + ' 躲开了！这句回答不对', '正确回答：' + detailOf(q));
      setTimeout(() => say(q.en), 300);
    }
  }

  function onNext() {
    if (!P || !P.answered) return;
    stopListening();
    if (P.hearts <= 0) { failModal(); return; }
    P.idx++;
    if (P.idx >= P.total) finish(); else renderQ();
  }
  function failModal() {
    const can = S.coins >= 30 && !P.revived;
    openModal('<div class="big">💔</div><h2>小船没电了！</h2><p>3 颗心都用完了。错的题已经放进错题本。</p>' +
      '<button class="btn sun wide" data-act="revive" ' + (can ? '' : 'disabled') + '>花 30 金币复活，继续这关' + (P.revived ? '（每关只能复活一次）' : S.coins < 30 ? '（金币不够）' : '') + '</button>' +
      '<div class="row"><button class="btn ghost" data-act="home">回地图</button><button class="btn" data-act="retry">重新挑战</button></div>', { locked: true });
  }

  function finish() {
    hideFb();
    const acc = P.correct / P.total;
    const stars = P.lost === 0 && acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    const key = P.wi + '-' + P.li;
    const prev = P.review ? 0 : (S.stars[key] || 0);
    if (!P.review) S.stars[key] = Math.max(prev, stars);
    let coins = 5 + stars * 5 + (P.boss ? 20 : 0);
    const lucky = Math.random() < 0.15;
    if (lucky) coins *= 2;
    const firstThree = !P.review && stars === 3 && prev < 3;
    if (firstThree) coins += 15;
    const balls = stars === 3 ? 2 : 1;
    S.mon.balls += balls;
    const xp = P.xp + 20 + stars * 10;
    const before = lvInfo(S.xp).lv;
    S.xp += xp; S.coins += coins;
    const after = lvInfo(S.xp).lv;
    S.stats.levels++;
    if (stars === 3) { S.stats.threeStars++; qProg('three', 1); }
    if (P.boss && prev === 0) S.stats.bosses++;
    if (P.lost === 0 && P.correct === P.total) S.stats.flawless++;
    S.stats.maxCombo = Math.max(S.stats.maxCombo, P.maxCombo);
    qProg('combo', P.maxCombo, true);
    qProg('levels', 1);
    const newDay = markToday();
    if (after > before) S.coins += 20;
    save();
    renderTop();

    const w = W[P.wi], r = RECIPES[P.li];
    const newWorld = P.boss && prev === 0 && P.wi + 1 < W.length;
    let nextBtn = '';
    if (!P.review) {
      if (P.li < 6) nextBtn = '<button class="btn wide" data-act="go" data-w="' + P.wi + '" data-l="' + (P.li + 1) + '" data-focus>下一关 →</button>';
      else if (P.wi + 1 < W.length) nextBtn = '<button class="btn wide" data-act="go" data-w="' + (P.wi + 1) + '" data-l="0" data-focus>出发去 ' + W[P.wi + 1].name + ' →</button>';
    }
    const title = P.review ? '错题复习完成！' : P.boss ? '打败 ' + w.boss.name + '！' : stars === 3 ? '完美通关！' : '通关！';
    $('#result').innerHTML =
      '<div class="big" style="font-size:64px">' + (P.boss ? w.boss.emoji + '💥' : S.pet) + '</div>' +
      '<h1 class="r-title">' + title + '</h1>' +
      '<p class="r-sub">' + (P.review ? '错题本还剩 ' + Object.keys(S.wrong).length + ' 题' : w.name + ' · ' + r.name) + '</p>' +
      '<div class="r-stars" id="rstars"><span>⭐</span><span>⭐</span><span>⭐</span></div>' +
      (lucky ? '<div class="lucky">🍀 幸运暴击！金币翻倍</div>' : '') +
      (firstThree ? '<div class="lucky">首次三星奖励 +15 金币</div>' : '') +
      (window.MonsterGame ? '<div class="lucky">🔮 回声球 +' + balls + '（去怪兽冒险收服怪兽）</div>' : '') +
      (newWorld ? '<div class="lucky">🏝️ 新岛屿解锁：' + W[P.wi + 1].name + '</div>' : '') +
      '<div class="r-stats"><div class="stat xp"><b>+' + xp + '</b><small>经验</small></div><div class="stat cn"><b>+' + coins + '</b><small>金币</small></div><div class="stat cb"><b>' + P.maxCombo + '</b><small>最高连击</small></div></div>' +
      '<p class="r-sub" style="margin:0">答对 ' + P.correct + ' / ' + P.total + (stars < 3 ? ' · ' + (P.lost ? '不丢心、' : '') + '答对 90% 以上可拿三星' : '') + '</p>' +
      '<div class="r-actions">' + nextBtn + '<div class="row" style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" data-act="home">回地图</button>' +
      (P.review ? '' : '<button class="btn ghost" style="flex:1" data-act="retry">再玩一次</button>') + '</div></div>';
    show('result');
    SFX.win();
    confetti(stars === 3 ? 180 : 90);
    $$('#rstars span').forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); SFX.star(i); }, 400 + i * 380); });
    const f = $('#result [data-focus]') || $('#result button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 100);

    setTimeout(() => {
      if (newDay) toast('🔥 今日打卡成功！已连续 ' + S.streak + ' 天', 'gold');
      checkAch();
      if (after > before) {
        confetti(200);
        openModal('<div class="big">🎖️</div><h2>升级啦！Lv ' + after + '</h2><p>新称号：<b>' + titleOf(after) + '</b>。奖励 20 金币，去宠物店看看吧！</p><button class="btn sun wide" data-act="close" data-focus>太好了</button>');
      } else if (Date.now() - RT.lastRest > 30 * 60e3) restModal();
    }, 1700);
  }
  function restModal() {
    RT.lastRest = Date.now();
    openModal('<div class="big">👀</div><h2>护眼时间</h2><p>已经连续练了 30 分钟，真厉害！看看窗外远处 20 秒，喝口水，让眼睛和嗓子歇一歇。</p><button class="btn wide" id="restbtn" data-act="close" disabled>休息中 20</button>', { locked: true });
    let n = 20;
    const t = setInterval(() => {
      n--;
      const b = $('#restbtn');
      if (!b) { clearInterval(t); return; }
      if (n <= 0) { clearInterval(t); b.disabled = false; b.textContent = '休息好了，继续'; }
      else b.textContent = '休息中 ' + n;
    }, 1000);
  }


  // ---------- 对话动画剧场：看动画 / 跟读 / 角色扮演 ----------
  let T = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MODE_TIP = {
    watch: '先完整看一遍。关掉英文字幕，就能练纯听力。点下面的对话记录可以单独再听一句。',
    shadow: '每句播完会停下来，你跟着说一遍，说对了自动继续。',
    role: '选一个角色，轮到你时大声说出台词，另一个角色由电脑来演。',
  };
  function gainXp(n) {
    if (!n) return;
    const b = lvInfo(S.xp).lv;
    S.xp += n;
    const a = lvInfo(S.xp).lv;
    if (a > b) { S.coins += 20; toast('🎖️ 升级啦！Lv ' + a + ' ' + titleOf(a) + ' +20 金币', 'gold'); confetti(160); }
  }
  function openScene(wi) {
    const sc = window.SCENES && window.SCENES[wi];
    if (!sc) return;
    primeTTS(); ac();
    T = { wi, sc, idx: -1, mode: 'watch', me: 1, run: 0, playing: false, slow: false, zh: true, en: true, spoke: 0, turn: null, done: false, tries: 0 };
    show('theater');
    renderTheater();
  }
  function stopScene() {
    if (!T) return;
    T.run++;
    T.playing = false;
    if (T.turn) { const r = T.turn; T.turn = null; r(false); }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
  }
  const playLabel = () => T.playing ? '⏸ 暂停' : (T.idx >= 0 && !T.done ? '▶ 继续' : T.done ? '🔁 再来一遍' : '▶ 开始播放');
  function updPlay() { const b = $('#th-play'); if (b) b.textContent = playLabel(); }
  function renderTheater() {
    const sc = T.sc, w = W[T.wi], toon = !!window.Cartoon;
    const modes = [['watch', '👀 看动画'], ['shadow', '🔁 跟读'], ['role', '🎭 角色扮演']];
    $('#theater').innerHTML =
      '<div class="p-top"><button class="x" data-act="thClose" aria-label="退出">✕</button><div class="th-title"><b>🎬 ' + esc(sc.title) + '</b><small>' + w.name + ' · ' + esc(sc.place) + '</small></div></div>' +
      '<div class="stage' + (toon ? ' cartoon' : '') + ' live" id="stage" style="--wc:' + w.color + '">' +
      (toon && Cartoon.set(sc.set) ? '<div class="stage-set">' + Cartoon.set(sc.set) + '</div>' : '<span class="stage-bg">' + sc.bg + '</span>') +
      sc.cast.map((c, k) => '<div class="actor a' + k + '" id="actor' + k + '">' +
        (toon && Cartoon.has(c[0]) ? Cartoon.actor(c[0]) : '<span class="ae"><span class="af">' + c[1] + '</span></span>') +
        '<span class="an">' + esc(c[0]) + (T.mode === 'role' && T.me === k ? ' · 你' : '') + '</span></div>').join('') +
      '<div class="stage-sub" id="th-sub"></div>' +
      '<div class="clap" id="th-clap" hidden><small>第 ' + (T.wi + 1) + ' 集</small><b>' + esc(sc.title) + '</b><span>' + esc(sc.place) + '</span></div></div>' +
      '<div class="seg th-modes">' + modes.map(([m, n]) => '<button class="' + (T.mode === m ? 'on' : '') + '" data-act="thMode" data-m="' + m + '">' + n + '</button>').join('') + '</div>' +
      (T.mode === 'role' ? '<div class="seg th-modes"><span class="th-lab">我来演</span>' + sc.cast.map((c, k) => '<button class="' + (T.me === k ? 'on' : '') + '" data-act="thMe" data-i="' + k + '">' + c[1] + ' ' + esc(c[0]) + '</button>').join('') + '</div>' : '') +
      '<div class="th-ctrl"><button class="btn" id="th-play" data-act="thPlay">' + playLabel() + '</button>' +
      '<button class="slow' + (T.slow ? ' on' : '') + '" data-act="thSlow" aria-pressed="' + T.slow + '"><span>🐢</span>慢速</button>' +
      '<button class="slow' + (T.en ? ' on' : '') + '" data-act="thEn" aria-pressed="' + T.en + '"><span>En</span>英文</button>' +
      '<button class="slow' + (T.zh ? ' on' : '') + '" data-act="thZh" aria-pressed="' + T.zh + '"><span>中</span>中文</button></div>' +
      '<p class="th-tip">' + MODE_TIP[T.mode] + '</p>' +
      '<div id="th-turn"></div><div class="th-log" id="th-log"></div>';
    renderStage(); renderLog();
    window.scrollTo(0, 0);
  }
  function renderStage() {
    const L = T.sc.lines[T.idx];
    T.sc.cast.forEach((c, k) => {
      const a = $('#actor' + k); if (!a) return;
      a.classList.toggle('talk', !!L && L[0] === k && T.playing);
      a.classList.toggle('dim', !!L && L[0] !== k);
    });
    const sub = $('#th-sub'); if (!sub) return;
    if (!L) { sub.className = 'stage-sub'; sub.innerHTML = T.done ? '<span class="ss-en">The End</span><span class="ss-zh">🎉 演完啦！</span>' : '<span class="ss-zh">点「开始播放」，看看他们怎么说</span>'; return; }
    sub.className = 'stage-sub ' + (L[0] === 0 ? 'l' : 'r');
    sub.innerHTML = '<span class="ss-who">' + esc(T.sc.cast[L[0]][0]) + '</span>' +
      (T.en ? '<span class="ss-en">' + esc(L[1]) + '</span>' : '<span class="ss-en muted">🎧 只用耳朵听……</span>') +
      (T.zh ? '<span class="ss-zh">' + esc(L[2]) + '</span>' : '');
  }
  function renderLog() {
    const log = $('#th-log'); if (!log) return;
    const n = T.done ? T.sc.lines.length : Math.max(0, T.idx);
    log.innerHTML = (n ? '<div class="th-lab">对话记录（点一句再听一遍）</div>' : '') + T.sc.lines.slice(0, n).map((L, i) => {
      const c = T.sc.cast[L[0]];
      return '<button class="lg lg' + L[0] + '" data-act="thLine" data-i="' + i + '"><span class="lg-e">' + c[1] + '</span><span class="lg-b"><b>' + esc(L[1]) + '</b><small>' + esc(L[2]) + '</small></span></button>';
    }).join('');
  }
  // 关掉或切换模式后，还在等待的旧播放流程要安静退出
  const alive = (t, my) => T === t && t.run === my;
  async function intro(my) {
    const t = T;
    const stage = $('#stage'), clap = $('#th-clap');
    if (!stage || reduced) return;
    stage.classList.remove('live', 'bye');
    $('#th-sub').className = 'stage-sub gone';
    clap.hidden = false;
    SFX.tap();
    await sleep(1500);
    if (!alive(t, my)) return;
    clap.hidden = true;
    void stage.offsetWidth;
    stage.classList.add('live');
    await sleep(900);
  }
  async function playFrom(i) {
    const t = T, my = ++T.run;
    T.playing = true; T.done = false;
    updPlay();
    const lines = T.sc.lines;
    if (i === 0) { await intro(my); if (!alive(t, my)) return; }
    for (T.idx = i; T.idx < lines.length; T.idx++) {
      const [who, en] = lines[T.idx];
      renderStage(); renderLog();
      if (T.mode === 'role' && who === T.me) { await kidTurn(); if (!alive(t, my)) return; continue; }
      await say(en, T.slow ? 0.65 : S.settings.rate, T.sc.cast[who][2]);
      if (!alive(t, my)) return;
      if (T.mode === 'shadow') { await kidTurn(); if (!alive(t, my)) return; }
      else { await sleep(500); if (!alive(t, my)) return; }
    }
    T.playing = false; T.done = true; T.idx = lines.length;
    renderStage(); renderLog(); updPlay();
    const stage = $('#stage'); if (stage) stage.classList.add('bye');
    sceneDone();
  }
  function kidTurn() {
    return new Promise(res => {
      T.turn = res; T.tries = 0;
      const L = T.sc.lines[T.idx], sr = speakMode() === 'sr';
      const a = $('#actor' + L[0]); if (a) a.classList.add('talk');
      $('#th-turn').innerHTML = '<div class="say-card th-you"><div class="say-zh">' + (T.mode === 'role' ? '轮到你了，大声说：' : '跟着说一遍：') + '</div>' +
        '<div class="say-text" id="th-say">' + wordsHTML(L[1]) + '</div>' + (T.zh ? '<div class="say-zh">' + esc(L[2]) + '</div>' : '') +
        (sr ? '<button class="mic" id="th-mic" data-act="thMic" aria-label="开始说话">' + MIC + '</button>' : '') +
        '<div class="mic-hint" id="th-hint">' + (sr ? '点麦克风，然后大声说' : '大声说出来，说完点「我说完了」') + '</div><div class="heard" id="th-heard"></div>' +
        '<div class="say-row"><button class="btn small ghost" data-act="thHear">🔊 听示范</button><button class="btn small ' + (sr ? 'ghost' : 'leaf') + '" id="th-done" data-act="thDone">' + (sr ? '跳过这句' : '🎤 我说完了') + '</button></div></div>';
      $('#th-turn').scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  function endTurn(ok) {
    const r = T && T.turn; if (!r) return;
    T.turn = null;
    stopListening();
    $('#th-turn').innerHTML = '';
    if (ok) { T.spoke++; S.stats.spoken++; qProg('spoken', 1); }
    r(ok);
  }
  async function thMic() {
    if (!T || !T.turn) return;
    if (RT.listening) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const turn = T.turn, L = T.sc.lines[T.idx], m = $('#th-mic');
    m.classList.add('on'); m.innerHTML = STOP;
    $('#th-hint').textContent = '正在听……说完会自动停止';
    const res = await recognize(t => { const h = $('#th-heard'); if (h) h.textContent = t; });
    if (!T || T.turn !== turn) return;
    m.classList.remove('on'); m.innerHTML = MIC;
    if (res.err && FATAL.includes(res.err)) {
      RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
      toast('这里用不了语音识别，改成自己说、自己确认');
      m.remove();
      $('#th-hint').textContent = '大声说出来，说完点「我说完了」';
      const d = $('#th-done'); d.textContent = '🎤 我说完了'; d.className = 'btn small leaf';
      return;
    }
    if (!res.alts.length) { $('#th-hint').textContent = '没听清，靠近一点、大声一点再试一次'; return; }
    const r = bestScore(L[1], res.alts);
    $('#th-heard').textContent = '我听到：“' + r.heard + '”';
    $$('#th-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    if (r.score >= 55) {
      SFX.ok(T.spoke);
      if (r.score >= 85) { S.stats.perfect++; qProg('perfect', 1); }
      $('#th-hint').innerHTML = '<b>' + r.score + ' 分</b> ' + (r.score >= 85 ? 'Perfect！' : 'Good！');
      setTimeout(() => { if (T && T.turn === turn) endTurn(true); }, 900);
    } else {
      T.tries++;
      SFX.bad();
      $('#th-hint').textContent = r.score + ' 分，红色的词再读准一点' + (T.tries >= 2 ? '，或者点「跳过这句」' : '');
    }
  }
  function sceneDone() {
    const rec = S.scenes[T.wi] || (S.scenes[T.wi] = {});
    const msg = [];
    let coins = 0, xp = 0;
    if (T.mode === 'watch' && !rec.watched) { rec.watched = 1; coins += 10; msg.push('第一次看完 +10 金币'); }
    if (T.mode === 'shadow') { rec.shadow = 1; xp += 20; msg.push('跟读完成 +20 经验'); }
    if (T.mode === 'role') { rec.role = 1; xp += 30; coins += 10; S.stats.roleplay++; qProg('roleplay', 1); msg.push('角色扮演完成 +30 经验 +10 金币'); }
    S.coins += coins;
    gainXp(xp);
    save(); checkAch();
    SFX.win(); confetti(90);
    const other = T.me === 0 ? 1 : 0;
    const nextBtn = T.mode === 'watch' ? '<button class="btn" data-act="thMode" data-m="shadow" data-go="1">🔁 接着跟读</button>'
      : T.mode === 'shadow' ? '<button class="btn" data-act="thMode" data-m="role" data-go="1">🎭 试试角色扮演</button>'
        : '<button class="btn" data-act="thMe" data-i="' + other + '" data-go="1">换演 ' + esc(T.sc.cast[other][0]) + '</button>';
    $('#th-turn').innerHTML = '<div class="th-end"><div class="big">🎉</div><b>' + (T.mode === 'role' ? '演得真棒！' : T.mode === 'shadow' ? '跟读完成！' : '看完啦！') + '</b>' +
      '<p>' + (msg.join(' · ') || '多看几遍，对话就能脱口而出') + '</p><div class="say-row">' + nextBtn + '<button class="btn ghost" data-act="thClose">回地图</button></div></div>';
    renderTop();
  }

  // ---------- 宝箱 / 商店 / 成就 / 设置 ----------
  function openChest() {
    if (S.quests.chest || !S.quests.list.every(q => q.claimed)) return;
    S.quests.chest = true;
    const r = Math.random();
    let prize, html;
    const unownedChest = CHEST_PETS.filter(p => !S.pets.includes(p[0]));
    if (r < 0.2 && unownedChest.length) {
      const p = pick(unownedChest); S.pets.push(p[0]); prize = p[0];
      html = '<h2>开出限定宠物：' + p[1] + '！</h2><p>宝箱限定，商店买不到哦。</p>';
    } else if (r < 0.32 && S.freeze < 2) {
      S.freeze++; prize = '🧊';
      html = '<h2>开出连胜保护卡！</h2><p>哪天忘了打卡，它会自动帮你保住连续天数。</p>';
    } else {
      const c = pick([30, 40, 50, 60, 80, 100, 150]); S.coins += c; prize = '💰';
      html = '<h2>开出 ' + c + ' 金币！</h2><p>明天再来，任务会刷新。</p>';
    }
    save();
    openModal('<div class="big" id="chestbig" style="animation:wiggle .5s 3">🎁</div><div id="chestres" hidden><div class="big">' + prize + '</div>' + html + '</div><button class="btn sun wide" data-act="close" id="chestok" hidden>收下</button>', { locked: true });
    SFX.tap();
    setTimeout(() => { $('#chestbig').hidden = true; $('#chestres').hidden = false; $('#chestok').hidden = false; SFX.win(); confetti(120); renderHome(); checkAch(); }, 1500);
  }
  function shopSheet() {
    const pets = PETS.map(([e, price, name]) => {
      const own = S.pets.includes(e), sel = S.pet === e;
      return '<button class="pet ' + (sel ? 'sel' : '') + (own || S.coins >= price ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + e + '</span>' + name +
        '<small>' + (sel ? '跟着你' : own ? '点击带上' : '<span class="coin"></span>' + price) + '</small></button>';
    }).join('');
    const chest = CHEST_PETS.map(([e, name]) => {
      const own = S.pets.includes(e);
      return '<button class="pet ' + (S.pet === e ? 'sel' : '') + (own ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + (own ? e : '❓') + '</span>' + (own ? name : '宝箱限定') + '<small>' + (own ? (S.pet === e ? '跟着你' : '点击带上') : '每日宝箱开出') + '</small></button>';
    }).join('');
    openModal('<h2>宠物店</h2><p>你有 <b>' + S.coins + '</b> 金币。宠物会在地图上陪你闯关。</p><div class="grid3">' + pets + chest + '</div>' +
      '<div class="ach"><span class="ae">🧊</span><div style="flex:1"><b>连胜保护卡（有 ' + S.freeze + ' 张，最多 2 张）</b><small>忘记打卡一天时自动使用，保住连续天数</small></div><button class="btn small sun" data-act="buyFreeze" ' + (S.freeze >= 2 || S.coins < 100 ? 'disabled' : '') + '>100 金币</button></div>' +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function onPet(e) {
    if (S.pets.includes(e)) { S.pet = e; SFX.tap(); }
    else {
      const p = PETS.find(x => x[0] === e);
      if (!p) { toast('这只宠物只能从每日宝箱开出'); return; }
      if (S.coins < p[1]) { toast('金币还差 ' + (p[1] - S.coins) + '，去闯关赚金币吧'); return; }
      S.coins -= p[1]; S.pets.push(e); S.pet = e; SFX.coin(); toast('买到了 ' + p[2] + '！', 'gold');
    }
    save(); renderTop(); shopSheet(); checkAch();
  }
  function achSheet() {
    const n = Object.keys(S.ach).length;
    const L = lvInfo(S.xp);
    const totalStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
    openModal('<h2>成就 ' + n + ' / ' + ACH.length + '</h2>' +
      '<p>Lv ' + L.lv + ' ' + titleOf(L.lv) + ' · 共 ' + totalStars + ' 颗星 · 开口说对 ' + S.stats.spoken + ' 次 · 完成 ' + S.stats.levels + ' 关</p>' +
      ACH.map(([id, e, name, desc]) => '<div class="ach ' + (S.ach[id] ? '' : 'no') + '"><span class="ae">' + e + '</span><div><b>' + name + '</b><small>' + desc + '</small></div></div>').join('') +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function envHTML() {
    const tts = useOnline() ? '✅ 朗读：有道在线发音（需要联网）' : TTS.voices.length ? '✅ 朗读：本机声音 ' + esc(TTS.v ? TTS.v.name : '') : '✅ 朗读：本机声音（没听到声音就在「设置」里换成在线发音）';
    const wx = /MicroMessenger/i.test(navigator.userAgent) ? '<br>📱 你正在微信里打开：点右上角「···」→「在浏览器打开」，录音和语音识别会更稳定。' : '';
    const sr = SRC && !RT.srBroken ? '✅ 支持语音识别，开口会自动打分' : '⚠️ 语音识别不可用，口语题用「录音 + 自评」';
    return '<div class="env">' + tts + '<br>' + sr + '<br>在中国大陆，电脑上推荐用 <b>Edge 浏览器</b>，手机推荐 <b>iPhone 自带 Safari</b>；Chrome 的语音识别要连 Google 服务器，通常用不了。' + wx + '</div>';
  }
  function settingsSheet() {
    const st = S.settings;
    const voices = TTS.voices.map(v => '<option value="' + esc(v.name) + '"' + (TTS.v && TTS.v.name === v.name ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
    openModal('<h2>设置</h2>' + envHTML() +
      '<div class="set"><label for="set-rate">朗读速度 <span id="rate-v">' + st.rate.toFixed(2) + '</span></label><input type="range" id="set-rate" min="0.6" max="1.1" step="0.05" value="' + st.rate + '"><div class="say-row"><button class="btn small ghost" data-act="testVoice">🔊 试听</button></div></div>' +
      '<div class="set"><label>发音来源</label><div class="seg">' +
      [['auto', '自动'], ['device', '本机声音'], ['online', '有道在线']].map(([m, n]) => '<button class="' + ((st.tts || 'auto') === m ? 'on' : '') + '" data-act="setTts" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>手机没声音或发音怪怪的，就选「有道在线」（需要联网）。</small></div>' +
      (voices ? '<div class="set"><label for="set-voice">朗读声音</label><select id="set-voice">' + voices + '</select></div>' : '') +
      '<div class="set"><label>口语打分方式</label><div class="seg">' +
      [['auto', '自动打分（推荐）'], ['self', '录音自评']].map(([m, n]) => '<button class="' + (st.mode === m ? 'on' : '') + '" data-act="setMode" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>自动打分：浏览器能识别语音就自动打分，不能就换成录音自评。</small></div>' +
      '<div class="set"><label>音效</label><div class="seg"><button class="' + (st.sfx ? 'on' : '') + '" data-act="sfx" data-v="1">开</button><button class="' + (st.sfx ? '' : 'on') + '" data-act="sfx" data-v="0">关</button></div></div>' +
      '<div class="set"><label>家长 / 老师模式</label><div class="seg"><button class="' + (st.unlockAll ? '' : 'on') + '" data-act="unlock" data-v="0">按顺序解锁</button><button class="' + (st.unlockAll ? 'on' : '') + '" data-act="unlock" data-v="1">全部关卡直接开放</button></div><small>想跟着课本进度直接练某个单元时打开。</small></div>' +
      '<div class="set"><label>清空进度</label><button class="btn small coral" data-act="reset" id="resetbtn">清空全部进度</button><small>星星、金币、宠物都会清零，无法恢复。</small></div>' +
      '<button class="btn ghost wide" data-act="close">完成</button>');
  }
  function introSheet() {
    openModal('<div class="big">🏝️</div><h2>欢迎来到回声岛！</h2>' +
      '<p><b>🐲 怪兽冒险</b>：选一只怪兽当伙伴，用英语念咒语攻击，听懂对手的英语来防御。收服新怪兽、升级进化，打败 13 个区域的馆主拿徽章。</p>' +
      '<p><b>📚 闯关练习</b>：13 座岛、每岛 7 关的听说练习，还有对话动画片。每通关一关送回声球，用来收服怪兽。</p>' +
      '<p>🎁 每天 3 个任务，做完开宝箱 · 🔥 每天打一场就算打卡</p>' +
      envHTML() +
      '<div class="row"><button class="btn ghost" data-act="testVoice">🔊 试试声音</button><button class="btn" data-act="introGo" data-focus>出发！</button></div>', { locked: true });
  }

  // ---------- 事件 ----------
  const num = (t, k) => +t.dataset[k];
  const ACT = {
    level: t => { SFX.tap(); levelSheet(num(t, 'w'), num(t, 'l')); },
    start: t => { closeModal(); startLevel(num(t, 'w'), num(t, 'l')); },
    go: t => { const wi = num(t, 'w'), li = num(t, 'l'); if (!isUnlocked(wi, li)) { goHome(); return; } startLevel(wi, li); },
    close: () => { if ($('#restbtn') && $('#restbtn').disabled) return; closeModal(); },
    introGo: () => { S.seenIntro = true; save(); closeModal(); primeTTS(); ac(); },
    say: () => P && P.q && say(P.q.audio),
    saySlow: () => P && P.q && say(P.q.audio, 0.6),
    sayT: () => P && P.q && say(P.q.target || P.q.en),
    sayTSlow: () => P && P.q && say(P.q.target || P.q.en, 0.6),
    sayText: t => say(t.dataset.t),
    reveal: t => { const h = $('#hl'); if (h) h.classList.remove('blur'); t.remove(); },
    pick: t => onPick(num(t, 'i')),
    tile: t => onTile(num(t, 'i'), false),
    untile: t => onTile(num(t, 'i'), true),
    loCheck: onLoCheck,
    mic: onMic,
    hint: onHint,
    skip: onSkip,
    rate: t => onRate(num(t, 'v')),
    playMine: () => { if (RT.recUrl) { const a = new Audio(RT.recUrl); a.play().catch(() => toast('播放录音失败')); } },
    selfReveal: () => { P.selfReveal = true; const st = $('#st'); if (st) { st.classList.remove('mask'); st.innerHTML = wordsHTML(P.q.target); } say(P.q.target); showSelf(false); },
    btOpt: t => onBtOpt(num(t, 'i')),
    bossGo: () => renderQ(),
    scene: t => { closeModal(); openScene(num(t, 'w')); },
    thClose: () => goHome(),
    thPlay: () => {
      if (!T) return;
      if (T.playing) {
        stopScene(); $('#th-turn').innerHTML = ''; updPlay(); renderStage();
        const clap = $('#th-clap'); if (clap) clap.hidden = true;
        const stage = $('#stage'); if (stage) stage.classList.add('live');
        return;
      }
      primeTTS();
      playFrom(T.done || T.idx < 0 ? 0 : T.idx);
    },
    thMode: t => { stopScene(); T.mode = t.dataset.m; T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thMe: t => { stopScene(); T.me = num(t, 'i'); T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thSlow: t => { T.slow = !T.slow; t.classList.toggle('on', T.slow); t.setAttribute('aria-pressed', T.slow); },
    thEn: t => { T.en = !T.en; t.classList.toggle('on', T.en); t.setAttribute('aria-pressed', T.en); renderStage(); },
    thZh: t => { T.zh = !T.zh; t.classList.toggle('on', T.zh); t.setAttribute('aria-pressed', T.zh); renderStage(); },
    thLine: t => { if (!T || T.playing) return; const L = T.sc.lines[num(t, 'i')]; say(L[1], T.slow ? 0.65 : undefined, T.sc.cast[L[0]][2]); },
    thHear: () => { if (!T || !T.turn) return; const L = T.sc.lines[T.idx]; say(L[1], 0.75, T.sc.cast[L[0]][2]); },
    thMic: () => thMic(),
    thDone: () => endTurn(speakMode() !== 'sr'),
    next: onNext,
    quit: () => {
      if (!P) { goHome(); return; }
      openModal('<h2>要离开这一关吗？</h2><p>现在退出，这一关的进度不会保存。</p><div class="row"><button class="btn ghost" data-act="home">退出</button><button class="btn" data-act="close" data-focus>继续闯关</button></div>');
    },
    home: () => { closeModal(); goHome(); },
    retry: () => { closeModal(); const p = P; if (!p) { goHome(); return; } if (p.review) startLevel(0, 0, true); else startLevel(p.wi, p.li); },
    revive: () => {
      if (!P || S.coins < 30 || P.revived) return;
      S.coins -= 30; P.revived = true; P.hearts = 2; save(); renderHearts(); closeModal(); SFX.coin();
      toast('❤️ 复活成功！');
      P.idx++; if (P.idx >= P.total) finish(); else renderQ();
    },
    review: () => {
      const n = Object.keys(S.wrong).length;
      if (!n) { toast('错题本是空的，继续保持！'); return; }
      openModal('<div class="big">📕</div><h2>错题本 · ' + n + ' 题</h2><p>答错或没说好的题都在这里。复习时答对一次，就从错题本里移除。</p>' +
        '<div class="row"><button class="btn ghost" data-act="close">等会儿</button><button class="btn" data-act="startReview" data-focus>复习 ' + Math.min(10, n) + ' 题</button></div>');
    },
    startReview: () => { closeModal(); startLevel(0, 0, true); },
    claim: t => {
      const q = S.quests.list.find(x => x.id === t.dataset.q), d = QDEF[t.dataset.q];
      if (!q || !d || q.claimed || q.p < d.goal) return;
      q.claimed = true; S.coins += d.rw; S.xp += 20; save(); SFX.coin();
      toast('+' + d.rw + ' 金币 +20 经验', 'gold');
      renderHome(); checkAch();
    },
    chest: openChest,
    shop: shopSheet,
    pet: t => onPet(t.dataset.p),
    buyFreeze: () => { if (S.freeze >= 2 || S.coins < 100) return; S.coins -= 100; S.freeze++; save(); SFX.coin(); renderTop(); shopSheet(); },
    ach: achSheet,
    settings: settingsSheet,
    testVoice: () => { ac(); primeTTS(); say('Hello! Welcome to Echo Island. Let\'s learn English together!'); },
    setMode: t => { S.settings.mode = t.dataset.m; if (t.dataset.m === 'auto') { RT.srBroken = false; RT.noRec = false; if (!SRC) toast('这个浏览器不支持语音识别，会继续用录音自评'); } save(); settingsSheet(); },
    setTts: t => { S.settings.tts = t.dataset.m; RT.ttsBroken = false; save(); settingsSheet(); primeTTS(); say('Hello! How are you?'); },
    sfx: t => { S.settings.sfx = t.dataset.v === '1'; save(); settingsSheet(); },
    unlock: t => { S.settings.unlockAll = t.dataset.v === '1'; save(); settingsSheet(); renderHome(); },
    reset: t => {
      if (!RT.resetArm) { RT.resetArm = true; t.textContent = '再点一次，确定清空'; return; }
      const keep = S.settings; S = fresh(); S.settings = keep; S.seenIntro = true; save(); closeModal(); renderHome(); toast('进度已清空');
    },
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (t) {
      if (t.disabled) return;
      const f = ACT[t.dataset.act];
      if (f) f(t, e);
      return;
    }
    if (e.target.id === 'modal' && !RT.modalLocked) closeModal();
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'set-rate') { S.settings.rate = +e.target.value; $('#rate-v').textContent = S.settings.rate.toFixed(2); save(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'set-voice') { S.settings.voice = e.target.value; pickVoice(); save(); say('Hello! How are you?'); }
  });
  document.addEventListener('keydown', e => {
    if (!$('#modal').hidden) { if (e.key === 'Escape' && !RT.modalLocked) closeModal(); return; }
    if (!P || $('#play').hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Enter' && $('#fb').classList.contains('show')) { e.preventDefault(); onNext(); return; }
    if (/^[1-4]$/.test(e.key)) {
      const b = $$('#p-body .opt')[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); if (P.q) say(P.q.audio || P.q.target); }
  });

  // ---------- 怪兽对战模块（monsters.js）用到的工具 ----------
  if (window.MonsterGame) {
    const api = {
      get S() { return S; }, W, RT, FATAL, SFX, MIC, STOP, SPK,
      save, say, recognize, bestScore, speakMode, stopListening, primeTTS, ac, toast, openModal, closeModal, confetti,
      qProg, checkAch, addWrong, markToday, gainXp, renderTop, renderHome, show, goHome, esc, wordsHTML,
      reduced,
    };
    Object.assign(ACT, MonsterGame.init(api), {
      tab: t => { S.homeTab = t.dataset.t; save(); renderHome(); window.scrollTo(0, 0); },
    });
  }

  // ---------- 启动 ----------
  function start(data) {
    S = load(data && data.S);
    checkStreak();
    ensureQuests();
    loadVoices();
    if (TTS.ok && 'onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
    setTimeout(() => { loadVoices(); TTS.loaded = true; }, 1500); // 一些安卓浏览器永远返回空列表
    const fl = document.createElement('link');
    fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@500;700;800&display=swap';
    document.head.appendChild(fl);
    show('home');
    renderHome();
    if (!S.seenIntro) setTimeout(introSheet, 300);
  }
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S })); } catch (e) { /* 忽略 */ } }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})();
