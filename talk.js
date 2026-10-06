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
  // 安卓 APK 里有原生桥（EchoNative）并且存了百炼密钥：直连阿里云，不用中转服务（逻辑在 talk-core.js，和中转服务一样）
  const direct = () => { try { return !!(window.EchoNative && window.TalkCore && EchoNative.hasKey()); } catch (e) { return false; } };
  function relayUrl() {
    if (direct()) return 'direct:';
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
    const card = (n, now) => {
      const best = T.done[n.id];
      return '<button class="tk-card' + (now ? ' now' : '') + '" data-act="talk_open" data-npc="' + n.id + '">' +
        '<img src="' + face(n) + '" alt="">' +
        '<span class="tk-t"><b>' + (n.unit ? '<em>Unit ' + n.unit + (now ? ' · 📍 正在学' : '') + '</em> ' : '') + esc(n.zh) + ' <small>' + esc(n.name) + '</small></b>' +
        '<span>' + esc(n.topicZh) + ' · <i>' + esc(n.topic) + '</i></span>' +
        '<small>🔊 ' + esc(n.voiceZh) + (best ? ' · ' + '★'.repeat(best) : '') + '</small></span><span class="tk-go">🎙️</span></button>';
    };
    // 课本单元的聊天角色放前面，正在学的单元排第一个；后面是岛上的人
    // 只列正在学的这一册（别的册在闯关页每个单元上点「聊这个单元」）
    const cu = G.curUnit ? G.curUnit() : null, units = cu ? NPCS.list.filter(n => n.book === cu.book) : [], isle = NPCS.list.filter(n => !n.unit);
    const order = units.filter(n => n.unit === cu.n).concat(units.filter(n => n.unit !== cu.n));
    const cards = (units.length ? '<h3 class="tk-h">📗 课本话题 · ' + esc(cu.bshort) + '</h3>' + order.map(n => card(n, n.unit === cu.n)).join('') + '<h3 class="tk-h">🏝️ 岛上的人</h3>' : '') +
      isle.map(n => card(n, false)).join('');
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
    lmShut();   // 口语题预热的麦克风先关掉，聊天自己开
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
    if (window.EchoMusic) EchoMusic.hold(true);   // 聊天时麦克风一直开着：背景音乐静音
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
    if (url === 'direct:') ws = directSocket(npc, (G.S.player && G.S.player.name) || '');
    else try { ws = new WebSocket(url + '/talk?' + q); } catch (e) { status('服务地址不对：' + url); return; }
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
      else if (m.type === 'error') { c.err = m.zh; status('⚠️ ' + m.zh); if (m.code === 'code') setTimeout(configure, 600); }
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
    // 打字时弹出软键盘：输入框留在看得见的地方（横屏时屏幕只剩一小条）
    const toBottom = () => { const i = $('#tk-in'), b = $('#tk-log'); if (b) b.scrollTop = b.scrollHeight; if (i) i.scrollIntoView({ block: 'nearest' }); };
    $('#tk-in').addEventListener('focus', () => setTimeout(toBottom, 300));
    c.resize = () => { if (document.activeElement === $('#tk-in')) toBottom(); };   // 键盘弹出来、屏幕变矮：最新的一句留在看得见的地方
    window.addEventListener('resize', c.resize);
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
    if (window.EchoMusic) EchoMusic.hold(false);
    try { c.ws && c.ws.close(); } catch (e) {}
    if (c.key) { document.removeEventListener('keydown', c.key); document.removeEventListener('keyup', c.key); }
    if (c.resize) window.removeEventListener('resize', c.resize);
    stopPlayback(); micClose();
    const ov = $('#tk-ov'); if (ov) ov.remove();
    if (G.renderHome && !$('#home').hidden) G.renderHome();
  }

  // ---------- 聊完的评价 + 金币 + 存记录 ----------
  function showEval(c, m) {
    const esc = G.esc, T = state(), ev = m.eval, npc = c.npc;
    T.log.unshift({ t: Date.now(), npc: npc.id, nm: npc.id === 'dyn' ? npc.name : undefined, turns: c.turns.slice(0, 40), eval: ev, sec: m.sec || 0 });
    T.log = T.log.slice(0, 30);
    let coins = 0;
    if (ev) {
      const who = npc.id === 'dyn' ? 'p-' + npc.name : npc.id;   // 地图上的人按名字算，每人每天一次金币
      const key = who + ':' + G.dayStr();
      if (npc.id !== 'dyn') T.done[npc.id] = Math.max(T.done[npc.id] || 0, ev.stars);
      T.days = T.days || {};
      if (ev.done && !T.days[key]) { T.days[key] = 1; coins = 10 + 5 * ev.stars; G.S.coins += coins; }
      if (ev.done && G.qProg) G.qProg('talk', 1);   // 每日任务「和岛民聊天，完成 1 个目标」
      for (const k of Object.keys(T.days)) if (!k.endsWith(G.dayStr())) delete T.days[k];
    }
    // 学习锁：这次没连上 / 时长用完 / 打分失败，今天的聊天这一项就免了（不能让孩子卡一整天）
    if (G.dayLog) { const L = G.dayLog(); if (!ev && (c.err || !c.turns.some(t => t.who === 'you'))) L.chatFail = 1; L.chats = (L.chats || 0) + 1; }
    // 老师给的「更好的说法」进每日复习：明天跟读、排句子
    if (ev && ev.tips && G.revAddFree) ev.tips.forEach(t => G.revAddFree(t.better, t.zh));
    G.save(); if (G.renderTop) G.renderTop();
    const box = $('#tk-ov .tk-box'); if (!box) return;
    box.innerHTML = '<div class="tk-eval"><img src="' + face(npc) + '" alt="">' +
      (ev ? '<div class="tk-stars">' + '★'.repeat(ev.stars) + '<i>' + '★'.repeat(3 - ev.stars) + '</i></div>' +
        '<b>' + (ev.done ? '🎯 目标完成！' : '还差一点点，下次试试把目标说完整') + '</b><p>' + esc(ev.praise) + '</p>' +
        (ev.tips.length ? '<div class="tk-tips"><b>可以这样说更好（明天的每日复习里会再练）：</b>' + ev.tips.map(t => '<div><s>' + esc(t.said) + '</s><br>→ <b>' + esc(t.better) + '</b><small>' + esc(t.zh) + '</small></div>').join('') + '</div>' : '') +
        (coins ? '<p class="tk-coin">🪙 +' + coins + ' 金币</p>' : '')
        : c.err && !c.turns.some(t => t.who === 'you') ? '<b>⚠️ 没连上</b><p>' + esc(c.err) + '</p><p>' + (/401|403|Unauthorized|InvalidApiKey/i.test(c.err) ? '密钥不对：请家长在「设置 → AI 聊天和口语打分」里重新填。' : '检查一下网络，过一会儿再试。') + '</p>'
        : '<b>聊完啦！</b><p>这次没拿到老师的评价（可能是说得太少或网络问题）。</p>') +
      (G.gate && G.gate().on && G.gate().open ? '<p class="tk-coin">🔓 今天的学习任务完成了，可以去怪兽冒险！</p>' : '') +
      '<p class="tk-time">这次聊了 ' + m.sec + ' 秒 · 今天还能聊 ' + Math.floor(m.left / 60) + ' 分钟</p>' +
      '<div class="tk-btns"><button class="btn" data-act="talk_again" data-npc="' + npc.id + '">再聊一次</button><button class="btn ghost" data-act="talk_close">返回</button></div></div>';
    if (ev && ev.done && G.confetti) G.confetti(80);
  }

  // ---------- 家长：设置服务地址 / 家庭口令；看记录 ----------
  // ---------- 安卓 APK 直连：原生 WebSocket（带密钥）⇄ 阿里云；对外装成和中转服务一样的 WebSocket，聊天界面不用改 ----------
  const NWS = {}; let nid = 0;
  window.__echoNative = (id, type, data) => { const h = NWS[id]; if (h) h(type, data); };
  const DAILY_SEC = 30 * 60, SESSION_SEC = 8 * 60;   // 和中转服务的默认值一样：每天 30 分钟、每段 8 分钟
  function usage(add) {
    const day = G.dayStr(); let U = {};
    try { U = JSON.parse(LS('echo-talk-usage') || '{}'); } catch (e) {}
    for (const k of Object.keys(U)) if (k !== day) delete U[k];
    if (add) { U[day] = (U[day] || 0) + add; LS('echo-talk-usage', JSON.stringify(U)); }
    return U[day] || 0;
  }
  function directSocket(npcIn, player) {
    const C = window.TalkCore, N = window.EchoNative, id = ++nid;
    const sock = { readyState: 0, onmessage: null, onerror: null, onclose: null };
    const toGame = m => { if (sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const shut = () => { if (sock.readyState === 3) return; sock.readyState = 3; delete NWS[id]; if (sock.onclose) sock.onclose(); };
    const npc = npcIn.desc ? C.personNpc(npcIn.desc) : npcIn;
    const left = DAILY_SEC - usage();
    if (!npc || left < 20) { setTimeout(() => { toGame({ type: 'error', code: 'daily', zh: npc ? '今天的聊天时间用完了，明天再来吧！' : '没有这个岛民' }); shut(); }, 0); sock.send = () => {}; sock.close = shut; return sock; }
    const S = C.session({
      npc, player: String(player).replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16), limitSec: Math.min(SESSION_SEC, left), leftSec: left,
      up: m => { try { N.wsSend(id, JSON.stringify(m)); } catch (e) {} },
      out: toGame,
      evaluate: (n, turns) => new Promise(res => {
        const body = C.evalBody(n, turns); if (!body) return res(null);
        const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res(null); }, 15000);
        NWS[pid] = (type, data) => { clearTimeout(tm); delete NWS[pid]; let ev = null; try { if (type === 'ok') ev = C.parseEval(JSON.parse(data)); } catch (e) {} res(ev); };
        try { N.post(pid, C.EVAL_URL, JSON.stringify(body)); } catch (e) { clearTimeout(tm); res(null); }
      }),
      onEnd: ({ sec }) => { usage(sec); try { N.wsClose(id); } catch (e) {} setTimeout(shut, 300); },
    });
    NWS[id] = (type, data) => {
      if (type === 'open') { sock.readyState = 1; S.start(); }
      else if (type === 'message') { let m; try { m = JSON.parse(data); } catch (e) { return; } S.fromUp(m); }
      else if (type === 'closed') S.upClosed();
      else if (type === 'error') { if (sock.readyState === 0 && sock.onerror) sock.onerror({}); S.upClosed('连不上对话服务（' + String(data || '').slice(0, 60) + '）'); }
    };
    sock.send = str => { let m; try { m = JSON.parse(str); } catch (e) { return; } S.fromGame(m); };
    sock.close = () => { if (!S.closed) S.finish(); else shut(); };
    try { N.wsOpen(id, C.REALTIME_URL + '?model=' + encodeURIComponent(C.MODEL)); } catch (e) { setTimeout(() => NWS[id] && NWS[id]('error', e.message), 0); }
    return sock;
  }

  // 原生桥的 HTTPS（带密钥）：→ Promise<{ ok, text }>
  function nativePost(url, body, ms) {
    return new Promise(res => {
      const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res({ ok: false, text: 'timeout' }); }, ms || 15000);
      NWS[pid] = (type, data) => { clearTimeout(tm); delete NWS[pid]; res({ ok: type === 'ok', text: data || '' }); };
      try { window.EchoNative.post(pid, url, body); } catch (e) { clearTimeout(tm); delete NWS[pid]; res({ ok: false, text: e.message }); }
    });
  }

  // ---------- 跟读打分：APK 的 WebView 没有浏览器语音识别 → 录一句话，交给阿里云识别成文字（game.js 再按原来的办法打分） ----------
  // 说完停顿 1 秒多自动结束；5 秒都没出声就算没说；最长 8 秒
  const SR = { stop: null };
  function wav16(chunks, len, rate) {
    const all = new Float32Array(len); let o = 0;
    chunks.forEach(c => { all.set(c, o); o += c.length; });
    const k = rate / 16000, n = Math.floor(len / k), b = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (p, t) => { for (let i = 0; i < t.length; i++) b.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 16000, true); b.setUint32(28, 32000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, all[Math.floor(i * k)])); b.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    const bytes = new Uint8Array(b.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  // 网页版：中转服务（server/relay.js 的 /asr、/tip）替 APK 的原生桥去连阿里云
  const relayHttp = () => { const u = relayUrl(); return u && u !== 'direct:' ? u.replace(/^ws/, 'http') : ''; };
  const cloudSR = () => direct() || !!relayHttp();
  async function relayPost(path, body, ms) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || 15000);
    try {
      const code = LS('echo-talk-code');
      const r = await fetch(relayHttp() + path + (code ? '?code=' + encodeURIComponent(code) : ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      return { ok: r.ok, text: await r.text() };
    } catch (e) { return { ok: false, text: e.message }; } finally { clearTimeout(tm); }
  }
  // AI 老师点评：目标句子 + 识别出来的话 → 一句中文，指出最主要的差别、怎么读对
  const TIPS = {};
  async function aiTip(target, heard) {
    const k = target + '|' + heard;
    if (TIPS[k] !== undefined) return TIPS[k];
    const sys = '你是一位耐心的初中英语发音老师。学生要大声说的英文是：「' + target + '」。语音识别听到学生说的是：「' + heard + '」。用一句简体中文（不超过 28 个字）具体指出最主要的问题（哪个词读错、漏读或读成了别的词，可能是哪个音没发好），并告诉他怎么读对。如果听到的和目标几乎不是同一句话（大部分词都对不上），就只说「你读的好像是另一句话，先点喇叭听一遍原句再读」。不要表扬、不要客套，只输出这一句话。';
    const body = { model: 'qwen-plus', temperature: 0.2, max_tokens: 80, messages: [{ role: 'system', content: sys }, { role: 'user', content: '请点评。' }] };
    let tip = '';
    try {
      if (direct()) { const r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 10000); if (r.ok) tip = JSON.parse(r.text).choices[0].message.content; }
      else if (relayHttp()) { const r = await relayPost('/tip', { target, heard }, 10000); if (r.ok) tip = JSON.parse(r.text).tip; }
    } catch (e) { tip = ''; }
    tip = String(tip || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    TIPS[k] = tip;
    return tip;
  }
  // 朗读没有提前配音的句子：阿里云语音合成，返回音频地址（同一句话这次打开游戏里只合成一次）
  const TTSC = {};
  async function cloudTTS(text, g) {
    const k = (g || 'f') + '|' + text;
    if (TTSC[k]) return TTSC[k];
    let url = '';
    try {
      if (direct()) {
        const body = { model: 'qwen3-tts-flash', input: { text: String(text).slice(0, 300), voice: g === 'm' ? 'Ethan' : 'Cherry', language_type: 'English' } };
        const r = await nativePost('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', JSON.stringify(body), 6000);
        if (r.ok) url = JSON.parse(r.text).output.audio.url;
      } else if (relayHttp()) {
        const r = await relayPost('/tts', { text, g }, 6000);
        if (r.ok) url = JSON.parse(r.text).url;
      }
    } catch (e) { url = ''; }
    url = String(url || '').replace(/^http:/, 'https:');
    if (url) TTSC[k] = url;
    return url;
  }
  // ---------- 口语打分的识别：边说边送阿里云实时识别（qwen3-asr-flash-realtime） ----------
  // 以前：说完停 1.1 秒才算说完 → 整段上传 qwen3-asr-flash → 等结果，说完 2 秒多才出分。现在：
  // ① 一点话筒就开始录，同时连实时识别，连上之前录到的先存着再补发（开头不丢）；
  // ② 服务器边听边回文字（stash 是还没定下来的那截），孩子能看到自己说的话一个个冒出来；
  // ③ 调用方给 o.match(文字)（游戏里是「和答案对上 90 分以上」）：实时结果一对上就立刻结束，不用等停顿；
  //    对不上就等服务器判断说完（单词停顿 0.4 秒、句子 0.6 秒）。识别本身不知道答案（不带答案地听写），打分还是公正的；
  // ④ 实时识别连不上 / 断了：用录好的整段走原来的 qwen3-asr-flash。
  // 麦克风预热：说完不马上关，15 秒内再点话筒直接接着录（打开麦克风要零点几秒，孩子一点就说会丢开头）。
  const ASR_RT = 'qwen3-asr-flash-realtime';
  const LM = { stream: null, ctx: null, node: null, rate: 16000, sink: null, t: 0 };
  const RTA = { fails: 0 };   // 实时识别连续失败几次就先不用了（这次打开游戏）
  async function lmOpen() {
    clearTimeout(LM.t);
    if (LM.stream && LM.stream.active && LM.ctx && LM.ctx.state !== 'closed') {
      if (LM.ctx.state !== 'running') { try { await LM.ctx.resume(); } catch (e) {} }
      return LM;
    }
    lmShut();
    let stream, ctx;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return { err: 'not-allowed' }; }
    try {
      try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    } catch (e) { try { stream.getTracks().forEach(t => t.stop()); } catch (er) {} try { ctx && ctx.close(); } catch (er) {} return { err: 'audio-capture' }; }
    const node = new AudioWorkletNode(ctx, 'tk-cap');
    ctx.createMediaStreamSource(stream).connect(node);
    node.port.onmessage = e => { if (LM.sink) LM.sink(e.data); };
    Object.assign(LM, { stream, ctx, node, rate: ctx.sampleRate, sink: null });
    return LM;
  }
  function lmRelease() { LM.sink = null; clearTimeout(LM.t); LM.t = setTimeout(lmShut, 15000); }
  function lmShut() {
    clearTimeout(LM.t); LM.sink = null;
    try { if (LM.node) LM.node.port.onmessage = null; } catch (e) {}
    try { if (LM.stream) LM.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (LM.ctx) LM.ctx.close(); } catch (e) {}
    LM.stream = LM.ctx = LM.node = null;
  }
  // 切到后台就把麦克风关掉
  document.addEventListener('visibilitychange', () => { if (document.hidden && !LM.sink) lmShut(); });
  // 浮点 → 16kHz 16 位 PCM（不是 16k 的设备按比例取样，跨块记住小数位置）
  function pcm16(f, rate, st) {
    const k = rate / 16000, n = Math.max(0, Math.ceil((f.length - st.pos) / k)), out = new Int16Array(n);
    let p = st.pos, i = 0;
    for (; i < n && p < f.length; i++, p += k) { const v = Math.max(-1, Math.min(1, f[Math.floor(p)])); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
    st.pos = p - f.length;
    return i === n ? out : out.subarray(0, i);
  }
  function u8b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  // 实时识别的连接：APK 走原生桥（带密钥），网页版走中转服务的 /asr-rt
  function asrSock(on) {
    if (direct()) {
      const id = ++nid, N = window.EchoNative;
      NWS[id] = on;
      try { N.wsOpen(id, window.TalkCore.REALTIME_URL + '?model=' + ASR_RT); } catch (e) { setTimeout(() => on('error', e.message), 0); }
      return { send: s => { try { N.wsSend(id, s); } catch (e) {} }, close: () => { delete NWS[id]; try { N.wsClose(id); } catch (e) {} } };
    }
    const url = relayUrl(), code = LS('echo-talk-code');
    let ws;
    try { ws = new WebSocket(url + '/asr-rt' + (code ? '?code=' + encodeURIComponent(code) : '')); } catch (e) { setTimeout(() => on('error', e.message), 0); return { send() {}, close() {} }; }
    ws.onopen = () => on('open'); ws.onmessage = e => on('message', e.data); ws.onclose = () => on('closed'); ws.onerror = () => on('error', '');
    return { send: s => { if (ws.readyState === 1) ws.send(s); }, close: () => { try { ws.close(); } catch (e) {} } };
  }
  // 整段识别（原来的做法；实时识别不行时兜底）
  async function wholeAsr(chunks, len, rate) {
    const body = { model: 'qwen3-asr-flash', stream: false, asr_options: { language: 'en', enable_itn: false },
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + wav16(chunks, len, rate) } }] }] };
    let text = '', r;
    if (direct()) {
      r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 12000);
      try { text = String(JSON.parse(r.text).choices[0].message.content || '').trim(); } catch (e) {}
    } else {
      r = await relayPost('/asr', { audio: body.messages[0].content[0].input_audio.data.split(',')[1] }, 12000);
      try { text = String(JSON.parse(r.text).text || '').trim(); } catch (e) {}
    }
    return r.ok ? { text, err: text ? null : 'no-speech' } : { text: '', err: 'network' };
  }
  // o.onState(文字)：「🎤 请说……」和边说边出来的文字；o.match(文字) → true 就立刻结束；o.short：单词/短语（停顿等得短一点）
  async function listenOnce(o) {
    o = o || {};
    if (!cloudSR()) return { text: '', err: 'service-not-allowed' };
    if (C) return { text: '', err: 'busy' };   // 正在和岛民聊天，麦克风被占着
    const mic = await lmOpen();
    if (mic.err) return { text: '', err: mic.err };
    const rate = mic.rate, chunks = [], st = { pos: 0 }, t0 = performance.now();
    let len = 0, voiced = 0, quiet = 0, done = false, over = false, ready = false, queue = [], pend = [], pendN = 0, texts = [], cur = '', grace = 0, inSpeech = false;
    let dead = RTA.fails >= 3;
    return new Promise(resolve => {
      const full = () => (texts.join(' ') + ' ' + cur).replace(/\s+/g, ' ').trim();
      const fail = () => { if (dead) return; dead = true; RTA.fails++; };
      const heard = () => {
        const t = full(); if (!t) return;
        if (o.onState) o.onState(t);
        if (o.match && o.match(t)) finish('match');
      };
      const sock = dead ? null : asrSock((type, data) => {
        if (over) return;
        if (type === 'open') {
          sock.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: 'en' },
            turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: o.short ? 400 : 600 } } }));
          ready = true; queue.forEach(s => sock.send(s)); queue = [];
        } else if (type === 'message') {
          let m; try { m = JSON.parse(data); } catch (e) { return; }
          if (m.type === 'conversation.item.input_audio_transcription.text') { cur = (m.text || '') + (m.stash || ''); heard(); }
          else if (m.type === 'conversation.item.input_audio_transcription.completed') {
            RTA.fails = 0; inSpeech = false; texts.push(m.transcript || ''); cur = ''; heard();
            // 说完一段：稍等一下，孩子没接着说就结束（句子中间停顿了会接着识别下一段）
            clearTimeout(grace); grace = setTimeout(() => finish('done'), o.short ? 200 : 500);
          } else if (m.type === 'input_audio_buffer.speech_started') { inSpeech = true; clearTimeout(grace); }
          else if (m.type === 'error') fail();
        } else if (type === 'error' || type === 'closed') fail();
      });
      const finish = async why => {
        if (done) return; done = true;
        clearTimeout(grace); SR.stop = null; lmRelease();
        // 本机先判断说完了，但实时识别还没把这一段认完（刚连上 / 网慢，服务器还压着没处理的声音）：
        // 最多再等 2.5 秒它的「认完了」——只拿到半句就交卷会被当成说错
        const settled = () => texts.length && !inSpeech;
        if (why !== 'match' && why !== 'done' && why !== 'user' && sock && ready && !dead && voiced >= 3 && !settled()) {
          const t1 = performance.now();
          await new Promise(r => { const iv = setInterval(() => { if (settled() || dead || performance.now() - t1 > 2500) { clearInterval(iv); r(); } }, 40); });
        }
        over = true; clearTimeout(grace);
        const partial = !settled() && why !== 'match' && why !== 'user';
        if (sock) { try { sock.send(JSON.stringify({ type: 'session.finish' })); } catch (e) {} setTimeout(() => sock.close(), 400); }
        const t = full();
        if (t && !partial) return resolve({ text: t, err: null, ms: Math.round(performance.now() - t0), how: why });
        if (voiced < 3 || len < rate * 0.3) return resolve(t ? { text: t, err: null, how: why } : { text: '', err: why === 'user' ? 'aborted' : 'no-speech' });
        // 实时识别没认完（或者没连上）：录好的整段重新识别；整段也失败就用手上的半句
        if (o.onState) o.onState('🎧 识别中……');
        const w = await wholeAsr(chunks, len, rate);
        resolve(w.text || !t ? Object.assign(w, { how: 'whole' }) : { text: t, err: null, how: 'partial' });
      };
      SR.stop = () => finish('user');
      mic.sink = d => {
        if (done) return;
        chunks.push(d); len += d.length;
        // 攒够 0.1 秒送一次
        if (!dead) {
          pend.push(d); pendN += d.length;
          if (pendN >= rate * 0.1) {
            const f = new Float32Array(pendN); let p = 0; pend.forEach(c => { f.set(c, p); p += c.length; });
            const s = JSON.stringify({ type: 'input_audio_buffer.append', audio: u8b64((x => new Uint8Array(x.buffer, x.byteOffset, x.byteLength))(pcm16(f, rate, st))) });
            pend = []; pendN = 0;
            if (ready) sock.send(s); else if (queue.length < 120) queue.push(s);
          }
        }
        let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        const loud = Math.sqrt(sum / d.length) > 0.02, now = performance.now();
        // 本机的停顿判断只是保底：实时识别正常时它会先结束；不正常时停 1.1 秒就整段识别
        if (loud) { voiced++; quiet = 0; } else if (voiced >= 3) { if (!quiet) quiet = now; else if (now - quiet > (dead ? 1100 : 1800)) finish('silence'); }
        if (now - t0 > (o.maxMs || 8000)) finish('max');
        else if (voiced < 3 && now - t0 > 5000) finish('silence');
      };
      if (o.onState) o.onState('🎤 请说……');
    });
  }

  function configure() {
    if (window.EchoNative) {   // 安卓 APK：家长在这台手机上填一次百炼密钥（只存在这台手机里），直连阿里云
      if (G.parentOk && !G.parentOk('改 AI 密钥')) return;
      const k = prompt('家长设置：阿里云百炼 API Key（只存在这台手机里，用来和岛民聊天）\n已经设置过的话，留空就是不改；填 clear 删除', '');
      if (k === null) return;
      if (k.trim() === 'clear') EchoNative.setKey('');
      else if (k.trim()) EchoNative.setKey(k.trim());
      G.toast(direct() ? '✅ 已连上阿里云，可以和岛民聊天了' : '还没有设置密钥');
      if (G.renderHome) G.renderHome();
      return;
    }
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
  window.EchoTalk = { init, homeHTML, open, openPerson, relayUrl, cloudSR, listenOnce, aiTip, cloudTTS, stopListen: () => SR.stop && SR.stop() };
})();
