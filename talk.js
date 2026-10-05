// 和岛民用英语自由聊天（AI 语音对话）：window.EchoTalk
// 浏览器 ⇄ 中转服务 server/relay.js（WebSocket）⇄ 阿里云百炼 Qwen-Omni 实时语音。密钥只在中转服务里。
// 按住按钮说话（16kHz 16 位 PCM 分块发出），松开发送；岛民用自己的音色回答（24kHz PCM 边收边播），屏幕上显示双方的话。
// 聊完中转服务让文字模型打分：完成目标没有、几颗星、一句表扬、最多两条改进。连不上服务时提示家长设置，不影响别的玩法。
(function () {
  'use strict';
  const NPCS = window.TALK_NPCS;
  let G = null;                    // game.js 给的工具（S、save、toast、esc、openModal……）
  const $ = s => document.querySelector(s);
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return ''; } };

  // ---------- 服务地址：本机打开时默认连本机 8787；手机上由家长在「设置服务」里填 ----------
  // 网址带 ?talk=wss://… 就记住这个服务地址（家长给孩子的手机设一次）
  // ?code=… 顺便记住家庭口令
  try {
    const sp = new URLSearchParams(location.search), q = sp.get('talk'), c = sp.get('code');
    if (q && /^wss?:\/\//.test(q)) LS('echo-talk-url', q);
    if (c) LS('echo-talk-code', c.slice(0, 40));
  } catch (e) {}
  // 从 trycloudflare 隧道打开（游戏和对话服务是同一个地址）：连同一个地址
  const sameHost = () => location.protocol === 'https:' && /\.(ts\.net|trycloudflare\.com)$/.test(location.hostname);
  function relayUrl() {
    const own = LS('echo-talk-url');
    if (own) return own.replace(/\/+$/, '');
    if (window.ECHO_TALK_URL) return window.ECHO_TALK_URL;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return 'ws://' + location.hostname + ':8787';
    // 通过 Tailscale 的 https 地址打开（tailscale serve 把 /talk 转给本机的中转服务）：连同一个地址
    if (sameHost()) return 'wss://' + location.host;
    return '';
  }
  function devId() {
    let d = LS('echo-dev');
    if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); LS('echo-dev', d); }
    return d;
  }

  // 头像：people.js 的 portrait 要造型对象，名单里写的是造型名
  const face = n => EchoPeople.portrait(n.lookObj || EchoPeople.LOOKS[n.look] || EchoPeople.LOOKS.clerk);

  // ---------- 首页的「和岛民聊天」 ----------
  function state() {
    const S = G.S;
    if (!S.talk || typeof S.talk !== 'object') S.talk = { log: [], done: {} };
    if (!Array.isArray(S.talk.log)) S.talk.log = [];
    if (!S.talk.done || typeof S.talk.done !== 'object') S.talk.done = {};
    return S.talk;
  }
  function homeHTML() {
    const esc = G.esc, T = state(), url = relayUrl();
    const cards = NPCS.list.map(n => {
      const best = T.done[n.id];
      return '<button class="tk-card" data-act="talk_open" data-npc="' + n.id + '">' +
        '<img src="' + face(n) + '" alt="">' +
        '<span class="tk-t"><b>' + esc(n.zh) + ' <small>' + esc(n.name) + '</small></b>' +
        '<span>' + esc(n.topicZh) + ' · <i>' + esc(n.topic) + '</i></span>' +
        '<small>🔊 ' + esc(n.voiceZh) + (best ? ' · ' + '★'.repeat(best) : '') + '</small></span><span class="tk-go">🎙️</span></button>';
    }).join('');
    return '<section class="tk-home">' +
      '<div class="tk-intro"><b>🗣️ 用英语和岛民聊天</b><p>按住话筒说英语，松开就发出去；岛民会用自己的声音回答你。每段聊天有一个小目标，完成了有金币！</p></div>' +
      (url ? '' : '<div class="tk-warn">还没连上对话服务。请家长点下面的「设置服务」。</div>') +
      '<div class="tk-list">' + cards + '</div>' +
      '<div class="tk-foot"><button class="btn ghost" data-act="talk_log">📜 聊天记录</button><button class="btn ghost" data-act="talk_cfg">⚙️ 设置服务</button></div>' +
      '</section>';
  }

  // ---------- 麦克风：16kHz 单声道 16 位 PCM ----------
  const WORKLET = 'class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("tk-cap",P);';
  const MIC = { ctx: null, stream: null, node: null, on: false, buf: [], len: 0, rate: 16000 };
  async function micOpen() {
    if (MIC.ctx) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    let ctx;
    try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
    MIC.ctx = ctx; MIC.rate = ctx.sampleRate;
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    const src = ctx.createMediaStreamSource(MIC.stream);
    const node = new AudioWorkletNode(ctx, 'tk-cap');
    node.port.onmessage = e => { if (MIC.on) { MIC.buf.push(e.data); MIC.len += e.data.length; if (MIC.len >= MIC.rate / 10) flushMic(); } };
    src.connect(node);   // 不接到扬声器，免得回声
    MIC.node = node;
    return true;
  }
  function micClose() {
    try { MIC.stream && MIC.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { MIC.ctx && MIC.ctx.close(); } catch (e) {}
    Object.assign(MIC, { ctx: null, stream: null, node: null, on: false, buf: [], len: 0 });
  }
  function flushMic() {
    if (!MIC.len) return;
    const all = new Float32Array(MIC.len); let o = 0;
    MIC.buf.forEach(b => { all.set(b, o); o += b.length; });
    MIC.buf = []; MIC.len = 0;
    // 采样率不是 16k 的浏览器：按比例抽样
    const k = MIC.rate / 16000, n = Math.floor(all.length / k), pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * k)])); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    const bytes = new Uint8Array(pcm.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    wsSend({ type: 'audio', data: btoa(s) });
  }

  // ---------- 播放岛民的声音：24kHz PCM 分块排队播 ----------
  const OUT = { ctx: null, next: 0, srcs: [] };
  function playChunk(b64) {
    if (!OUT.ctx) OUT.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = OUT.ctx;
    const bin = atob(b64), n = bin.length >> 1;
    if (!n) return;
    const buf = ctx.createBuffer(1, n, 24000), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[i] = v / 0x8000; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.04, OUT.next);
    src.start(t); OUT.next = t + buf.duration;
    OUT.srcs.push(src); src.onended = () => { OUT.srcs = OUT.srcs.filter(x => x !== src); talking(); };
    talking();
  }
  function stopPlayback() { OUT.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); OUT.srcs = []; OUT.next = 0; talking(); }
  const npcSpeaking = () => OUT.srcs.length > 0;

  // ---------- 一段对话 ----------
  let C = null;   // { npc, ws, bubble, holding, ended, t0 }
  let LAST = null;  // 上一次聊天的对象（「再聊一次」用）
  const wsSend = m => { if (C && C.ws && C.ws.readyState === 1) C.ws.send(JSON.stringify(m)); };

  function talking() {
    const f = $('#tk-face'); if (f) f.classList.toggle('speaking', npcSpeaking());
  }
  function bubble(who, text) {
    const box = $('#tk-log'); if (!box) return null;
    const d = document.createElement('div');
    d.className = 'tk-b ' + who; d.textContent = text;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
    return d;
  }
  function status(t) { const s = $('#tk-status'); if (s) s.textContent = t; }

  // 大地图上随便一个人：把名字、身份、所在的岛、他说过的话交给中转服务，由服务器拼出人设（安全规则服务器自己加）
  function openPerson(d) {
    const npc = {
      id: 'dyn', name: d.name, zh: d.name, lookObj: d.lookObj, voiceZh: '',
      topicZh: '自由聊天 · ' + (d.islandZh || ''), topic: 'Free chat',
      goalZh: '和 ' + d.name + ' 用英语随便聊聊：打个招呼，问 TA 一个问题，也回答 TA 的问题。',
      words: (d.words || []).slice(0, 6), desc: d,
    };
    return open(npc);
  }
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function open(id) {
    const npc = typeof id === 'object' ? id : NPCS.byId[id]; if (!npc) return;
    const url = relayUrl();
    if (!url) { configure(); return; }
    const esc = G.esc;
    const ov = document.createElement('div');
    ov.id = 'tk-ov'; ov.className = 'tk-ov';
    ov.innerHTML = '<div class="tk-box">' +
      '<div class="tk-head"><img id="tk-face" src="' + face(npc) + '" alt=""><div><b>' + (npc.zh === npc.name ? esc(npc.name) : esc(npc.zh) + ' · ' + esc(npc.name)) + '</b><small>' + esc(npc.topicZh) + '</small></div>' +
      '<button class="tk-x" data-act="talk_end" aria-label="结束">结束</button></div>' +
      '<div class="tk-goal">🎯 ' + esc(npc.goalZh) + '<div class="tk-words">' + npc.words.map(w => '<span>' + esc(w) + '</span>').join('') + '</div></div>' +
      '<div class="tk-log" id="tk-log"></div>' +
      '<div class="tk-status" id="tk-status">正在连接……</div>' +
      '<div class="tk-ctl"><button class="tk-mic" id="tk-mic" disabled>🎤 按住说英语</button>' +
      '<form class="tk-type" id="tk-type"><input id="tk-in" maxlength="200" autocomplete="off" placeholder="或者打字（英文）"><button class="btn">发送</button></form></div></div>';
    document.body.appendChild(ov);
    LAST = npc;
    C = { npc, ws: null, bubble: null, holding: false, ended: false, t0: Date.now(), turns: [] };
    const c = C;

    // 麦克风：先要权限；要不到就只能打字
    let micOk = false;
    try { micOk = await micOpen(); } catch (e) { micOk = false; }
    if (c !== C) return;
    if (!micOk) status('用不了麦克风（浏览器没给权限或不支持），可以打字聊。');

    const q = new URLSearchParams({ npc: npc.id, dev: devId(), name: (G.S.player && G.S.player.name) || '' });
    if (npc.desc) { const d = npc.desc; q.set('p', b64(JSON.stringify({ name: d.name, g: d.g, kid: !!d.kid, role: d.role, island: d.island, place: d.place, lines: d.lines, words: d.words }))); }
    const code = LS('echo-talk-code'); if (code) q.set('code', code);
    let ws;
    try { ws = new WebSocket(url + '/talk?' + q); } catch (e) { status('服务地址不对：' + url); return; }
    c.ws = ws;
    ws.onmessage = e => {
      if (c !== C) return;
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (m.type === 'ready') {
        status(micOk ? '按住话筒说英语，说完松开。' : '打字聊天：写好按「发送」。');
        const mic = $('#tk-mic'); if (mic && micOk) mic.disabled = false;
      } else if (m.type === 'audio') { c.responding = true; playChunk(m.data); }
      else if (m.type === 'npc') {
        c.responding = true;
        if (!c.bubble) c.bubble = bubble('npc', '');
        if (c.bubble) { c.bubble.textContent += m.delta; const b = $('#tk-log'); b.scrollTop = b.scrollHeight; }
      } else if (m.type === 'npc_done') {
        c.responding = false; if (m.text) c.turns.push({ who: 'npc', text: m.text }); c.bubble = null;
        // 识别出的字有时比回答来得晚：占位气泡先留着，等字到了填进去；5 秒还没来（没听清）再删
        const w = $('#tk-log .tk-b.you.wait'); if (w) setTimeout(() => { if (w.classList.contains('wait')) w.remove(); }, 5000);
        status(MIC.ctx ? '按住话筒说英语，说完松开。' : '打字聊天：写好按「发送」。');
      }
      else if (m.type === 'you') {
        if (m.item) { c.items = c.items || new Set(); if (c.items.has(m.item)) return; c.items.add(m.item); }
        const p = $('#tk-log .tk-b.you.wait');
        if (p) { p.textContent = m.text; p.classList.remove('wait'); } else bubble('you', m.text);
        c.turns.push({ who: 'you', text: m.text });
      } else if (m.type === 'limit') { status(m.zh); }
      else if (m.type === 'error') { status('⚠️ ' + m.zh); if (m.code === 'code') setTimeout(configure, 600); }
      else if (m.type === 'eval') { c.ended = true; showEval(c, m); }
    };
    ws.onerror = () => { if (c === C && !c.ended) status('⚠️ 连不上对话服务（' + url + '）。请家长检查服务有没有开。'); };
    ws.onclose = () => { if (c === C && !c.ended) { const mic = $('#tk-mic'); if (mic) mic.disabled = true; } };

    // 按住说话（鼠标、触屏都行；电脑上也可以按住空格）
    const mic = $('#tk-mic');
    const down = e => {
      if (mic.disabled || c.holding) return;
      e.preventDefault(); c.holding = true;
      if (npcSpeaking()) stopPlayback();                                   // 打断岛民
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      if (MIC.ctx && MIC.ctx.state === 'suspended') MIC.ctx.resume();
      if (OUT.ctx && OUT.ctx.state === 'suspended') OUT.ctx.resume();
      MIC.buf = []; MIC.len = 0; MIC.on = true; c.pressAt = Date.now();
      mic.classList.add('on'); mic.textContent = '🔴 正在听……松开发送';
    };
    const up = () => {
      if (!c.holding) return;
      c.holding = false; MIC.on = false; flushMic();
      mic.classList.remove('on'); mic.textContent = '🎤 按住说英语';
      if (Date.now() - c.pressAt < 400) { wsSend({ type: 'commit' }); status('按住久一点再说哦。'); return; }
      wsSend({ type: 'commit' });
      bubble('you wait', '……');
      status('岛民在想……');
    };
    mic.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => mic.addEventListener(t, up));
    c.key = e => { if (e.code === 'Space' && document.activeElement !== $('#tk-in')) { e.preventDefault(); if (e.type === 'keydown' && !e.repeat) down(e); if (e.type === 'keyup') up(); } };
    document.addEventListener('keydown', c.key); document.addEventListener('keyup', c.key);
    $('#tk-type').addEventListener('submit', e => {
      e.preventDefault();
      const inp = $('#tk-in'), t = inp.value.trim(); if (!t) return;
      if (npcSpeaking()) stopPlayback();
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      wsSend({ type: 'text', text: t }); bubble('you', t); c.turns.push({ who: 'you', text: t }); inp.value = '';
      status('岛民在想……');
    });
  }

  function end() {
    if (!C) return;
    const c = C;
    if (c.ended || !c.ws || c.ws.readyState !== 1 || !c.turns.some(t => t.who === 'you')) { close(); return; }
    stopPlayback(); MIC.on = false;
    status('聊得不错！老师正在看你们的对话……');
    const mic = $('#tk-mic'); if (mic) mic.disabled = true;
    wsSend({ type: 'end' });
    setTimeout(() => { if (C === c && !c.ended) close(); }, 20000);   // 评价太慢就直接关
  }
  function close() {
    if (!C) return;
    const c = C; C = null;
    try { c.ws && c.ws.close(); } catch (e) {}
    if (c.key) { document.removeEventListener('keydown', c.key); document.removeEventListener('keyup', c.key); }
    stopPlayback(); micClose();
    const ov = $('#tk-ov'); if (ov) ov.remove();
    if (G.renderHome && !$('#home').hidden) G.renderHome();
  }

  // ---------- 聊完的评价 + 金币 + 存记录 ----------
  function showEval(c, m) {
    const esc = G.esc, T = state(), ev = m.eval, npc = c.npc;
    T.log.unshift({ t: Date.now(), npc: npc.id, nm: npc.id === 'dyn' ? npc.name : undefined, turns: c.turns.slice(0, 40), eval: ev });
    T.log = T.log.slice(0, 30);
    let coins = 0;
    if (ev) {
      const who = npc.id === 'dyn' ? 'p-' + npc.name : npc.id;   // 地图上的人按名字算，每人每天一次金币
      const key = who + ':' + G.dayStr();
      if (npc.id !== 'dyn') T.done[npc.id] = Math.max(T.done[npc.id] || 0, ev.stars);
      T.days = T.days || {};
      if (ev.done && !T.days[key]) { T.days[key] = 1; coins = 10 + 5 * ev.stars; G.S.coins += coins; }
      for (const k of Object.keys(T.days)) if (!k.endsWith(G.dayStr())) delete T.days[k];
    }
    G.save(); if (G.renderTop) G.renderTop();
    const box = $('#tk-ov .tk-box'); if (!box) return;
    box.innerHTML = '<div class="tk-eval"><img src="' + face(npc) + '" alt="">' +
      (ev ? '<div class="tk-stars">' + '★'.repeat(ev.stars) + '<i>' + '★'.repeat(3 - ev.stars) + '</i></div>' +
        '<b>' + (ev.done ? '🎯 目标完成！' : '还差一点点，下次试试把目标说完整') + '</b><p>' + esc(ev.praise) + '</p>' +
        (ev.tips.length ? '<div class="tk-tips"><b>可以这样说更好：</b>' + ev.tips.map(t => '<div><s>' + esc(t.said) + '</s><br>→ <b>' + esc(t.better) + '</b><small>' + esc(t.zh) + '</small></div>').join('') + '</div>' : '') +
        (coins ? '<p class="tk-coin">🪙 +' + coins + ' 金币</p>' : '')
        : '<b>聊完啦！</b><p>这次没拿到老师的评价（可能是说得太少或网络问题）。</p>') +
      '<p class="tk-time">这次聊了 ' + m.sec + ' 秒 · 今天还能聊 ' + Math.floor(m.left / 60) + ' 分钟</p>' +
      '<div class="tk-btns"><button class="btn" data-act="talk_again" data-npc="' + npc.id + '">再聊一次</button><button class="btn ghost" data-act="talk_close">返回</button></div></div>';
    if (ev && ev.done && G.confetti) G.confetti(80);
  }

  // ---------- 家长：设置服务地址 / 家庭口令；看记录 ----------
  function configure() {
    const cur = relayUrl();
    const u = prompt('对话服务地址（家长填）：\n例如 wss://你的服务器域名 ；本机试用填 ws://localhost:8787\n留空恢复默认', LS('echo-talk-url') || cur);
    if (u === null) return;
    LS('echo-talk-url', u.trim() || null);
    const c = prompt('家庭口令（服务没设口令就留空）：', LS('echo-talk-code'));
    if (c !== null) LS('echo-talk-code', c.trim() || null);
    G.toast('对话服务：' + (relayUrl() || '未设置'));
    if (G.renderHome) G.renderHome();
  }
  function showLog() {
    const esc = G.esc, T = state();
    const rows = T.log.map(r => {
      const n = NPCS.byId[r.npc] || { zh: r.nm || r.npc, name: r.nm || r.npc };
      return '<div class="tk-lr"><b>' + esc(n.zh) + '</b> <small>' + new Date(r.t).toLocaleString('zh-CN') + (r.eval ? ' · ' + '★'.repeat(r.eval.stars) : '') + '</small>' +
        r.turns.map(t => '<div class="' + t.who + '">' + (t.who === 'you' ? '我：' : esc(n.name) + '：') + esc(t.text) + '</div>').join('') + '</div>';
    }).join('') || '<p>还没有聊天记录。</p>';
    G.openModal('<h2>📜 聊天记录</h2><p class="muted">最近 30 次，只存在这台设备上。</p><div class="tk-logs">' + rows + '</div><button class="btn" data-act="close">关闭</button>');
  }

  function init(api) {
    G = api;
    return {
      talk_open: t => open(t.dataset.npc),
      talk_again: t => { const id = t.dataset.npc, last = LAST; close(); open(id === 'dyn' ? last : id); },
      talk_end: () => end(),
      talk_close: () => close(),
      talk_cfg: () => configure(),
      talk_log: () => showLog(),
    };
  }
  window.EchoTalk = { init, homeHTML, open, openPerson, relayUrl };
})();
