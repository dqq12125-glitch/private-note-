// 和岛民用英语自由聊天（AI 语音对话）：window.EchoTalk
// 浏览器 ⇄ 中转服务 server/relay.js（WebSocket）⇄ 阿里云百炼 Qwen-Omni 实时语音。密钥只在中转服务里（APK 里在原生桥里）。
// 按住按钮说话（16kHz 16 位 PCM 分块发出），松开发送；岛民用自己的音色回答（24kHz PCM 边收边播），屏幕上显示双方的话。
// 聊完让文字模型打分：按小步骤给星（差 1 步也算完成）、一句表扬、最多两条改进。连不上服务时提示家长设置，不影响别的玩法。
// 家长 2026-10-07 定的规矩：
// - 学习锁的「聊天」看这台手机上数的：今天用语音说满 6 句英语（识别结果 ≥3 个英文词、不含中文），或完成一个小目标。打字的不算句数、不给金币、不开锁
// - 麦克风能用时打字框收起来；返回键 / 切后台 = 结束并评价；评价超时也先存记录、照样计句数
// - 聊天里有「帮帮我」「再听一遍」「点一下看中文」；目标拆成小步骤实时打勾；每个角色几个目标轮换；岛民记得上次聊过的游戏里的小事（只存手机里）
// - 孩子说难过、被欺负、有危险时岛民认真回应并让他告诉家长 / 老师，这段聊天打上标记，家长输密码能看全文
// 给 game.js 的接口：EchoTalk.today()（学习锁用）、EchoTalk.endIfOpen()（返回键用）、EchoTalk.concerns()（周报「有几段聊天需要家长看看」）
(function () {
  'use strict';
  const NPCS = window.TALK_NPCS;
  const Core = () => window.TalkCore;
  let G = null;                    // game.js 给的工具（S、save、toast、esc、openModal……）
  const $ = s => document.querySelector(s);
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return ''; } };
  // 等老师评价最多几毫秒、HTTPS 请求超时（测试里改短：EchoTalk.cfg）
  const CFG = { evalWait: 20000, httpWait: 15000 };
  const NEED = (window.TalkCore && TalkCore.VOICE_NEED) || 6;

  // ---------- 聊天界面新加元素的样式（style.css 不归这个文件管，只补 .tk-* 的新东西） ----------
  (function css() {
    if (document.getElementById('tk-css')) return;
    const s = document.createElement('style'); s.id = 'tk-css';
    s.textContent = [
      '.tk-cnt{align-self:flex-start;margin-top:3px;font-size:12px;font-weight:800;color:var(--lagoon-d,#095e66);background:#e3f4f1;border-radius:10px;padding:1px 8px}',
      '.tk-cnt.ok{color:#1f8650;background:#dcf5e6}',
      '.tk-gt{font-weight:700}',
      '.tk-lv{font-style:normal;font-size:12px;background:#fff;color:#9a6b00;border-radius:8px;padding:0 6px;box-shadow:0 1px 0 #f0dca0;margin-right:2px}',
      '.tk-steps{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:2px}',
      '.tk-steps li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 6px;cursor:pointer;padding:1px 2px;border-radius:8px}',
      '.tk-steps li i{font-style:normal;width:1.4em;text-align:center;flex:none}',
      '.tk-steps li span{flex:1;min-width:0}',
      '.tk-steps li small{flex-basis:100%;padding-left:2em;color:#6d4c00;font-weight:700}',
      '.tk-steps li.ok span{color:#1f8650}',
      '.tk-steps li.ok i{animation:tk-pop .45s ease-out}',
      '@keyframes tk-pop{0%{transform:scale(.4)}70%{transform:scale(1.4)}100%{transform:scale(1)}}',
      '.tk-w{flex:none;white-space:nowrap;border:0;background:#fff;border-radius:10px;padding:2px 8px;font:inherit;font-size:13px;color:#6d4c00;box-shadow:0 2px 0 #f0dca0;cursor:pointer}',
      // 竖屏：词卡排成一行左右滑，给对话留地方（横屏时目标在左边一栏，照常换行）
      '.tk-ov .tk-goal .tk-words{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:3px}',
      '.tk-ov .tk-goal .tk-words::-webkit-scrollbar{display:none}',
      '.tk-w small{margin-left:4px;color:#9a7b3a;font-size:12px}',
      '.tk-w.hit{background:#dcf5e6;color:#1f8650;box-shadow:0 2px 0 #9ed8b4}',
      '.tk-w.hit::before{content:"✓ "}',
      '.tk-b.npc.tap{cursor:pointer}',
      '.tk-b .tk-zh{display:block;margin-top:4px;padding-top:4px;border-top:1px dashed var(--line,#d3e6e2);color:var(--ink-2,#4a6478);font-size:14px}',
      '.tk-b.you.typed{background:#5f8f89}',
      '.tk-b.you.typed::after{content:" ⌨️";font-size:12px}',
      '.tk-tools{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
      '.tk-tools button{border:0;border-radius:12px;padding:6px 10px;background:var(--card,#fff);box-shadow:0 3px 0 var(--line,#d3e6e2);font:inherit;font-size:14px;font-weight:700;color:var(--ink,#12304a);cursor:pointer}',
      '.tk-tools button:disabled{opacity:.45}',
      '.tk-typeopen{border:0;background:none;color:var(--ink-2,#4a6478);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;padding:2px}',
      '.tk-typenote{color:var(--ink-3,#7d93a3);font-size:12px;text-align:center}',
      '.tk-steps-r{text-align:left;width:100%;box-sizing:border-box;list-style:none;padding:8px 12px;margin:4px 0;background:var(--card,#fff);border-radius:14px;box-shadow:0 3px 0 var(--line,#d3e6e2);font-size:14px}',
      '.tk-note{color:var(--ink-2,#4a6478);font-size:13px}',
      '.tk-prog{margin:6px 0 0;font-weight:800;color:var(--lagoon-d,#095e66)}',
      '.tk-prog.ok{color:#1f8650}',
      '.tk-concern{border:2px solid #ffb74d;border-radius:12px;padding:8px 10px;margin:8px 0;background:#fff8ee;text-align:left}',
      '.tk-concern .why{color:#8a4b00;font-weight:700}',
      '.tk-lr .typed::after{content:"（打字）";color:var(--ink-3,#7d93a3);font-size:12px}',
      '.tk-notice{text-align:left;font-size:14px;line-height:1.55}',
      '.tk-notice li{margin:4px 0}',
      '.tk-badge{display:inline-block;min-width:1.4em;margin-left:4px;border-radius:9px;background:#ff7043;color:#fff;font-size:12px;line-height:1.4em;text-align:center}',
      '.tk-raw{color:var(--ink-3,#7d93a3);font-size:12px;word-break:break-all}',
      // 横屏：「按住说英语」是最要紧的按钮，不能被工具按钮挤成两行的小按钮；「点这里打字」的链接单独一行放右边
      '@media (orientation: landscape) and (max-height: 600px){.tk-ctl{flex-wrap:wrap}.tk-tools{flex:none}.tk-typenote{flex-basis:100%}.tk-typeopen{flex-basis:100%;text-align:right}.tk-mic{min-width:200px;white-space:nowrap}.tk-ov .tk-goal .tk-words{flex-wrap:wrap;overflow:visible}}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  })();

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

  // ---------- AI 出错的原因（给口语打分、首页红条用：EchoTalk.lastErr()） ----------
  // offline 没网 / auth 密钥不对 / quota 额度用完或欠费 / busy 太频繁 / code 家庭口令不对 / network 其他连不上
  // （家长 2026-10-07，评估第 3 条：口语打分按这个分成「没网」和「密钥 / 额度」两类，首页红条、周报都用）
  // 先认额度：额度用完时阿里云有时回 403（Arrearage / AllocationQuota），不能当成密钥不对
  let LASTERR = null;
  function errWhy(t) {
    t = String(t || '');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    if (/"error"\s*:\s*"code"|家庭口令/.test(t)) return 'code';
    if (/Arrearage|AllocationQuota|quota|Insufficient|FreeTierOnly|exceeded your|overdue|欠费|额度/i.test(t)) return 'quota';
    if (/InvalidApiKey|Unauthorized|invalid.{0,3}api.{0,3}key|AccessDenied|HTTP 40[13]\b|"code"\s*:\s*"?40[13]|no key|密钥/i.test(t)) return 'auth';
    if (/Throttl|rate.?limit|HTTP 429|Too Many Requests|"error"\s*:\s*"busy"/i.test(t)) return 'busy';
    // 原生（OkHttp）/ 浏览器报的「连不上网」：找不到服务器地址、网络不可达、断网（服务器拒绝连接不算：那是中转服务没开，还是 network）
    if (/Unable to resolve host|UnknownHost|No address associated|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|Network is unreachable|ENETUNREACH|ENOTFOUND|EAI_AGAIN/i.test(t)) return 'offline';
    return 'network';
  }
  function noteAi(where, text) { LASTERR = { why: errWhy(text), where, at: Date.now() }; return LASTERR.why; }
  // 给孩子看的出错说明：只说一句他听得懂的话。服务器 / 原生报的原文（HTTP 401、Unable to resolve host……）只给家长看（灰色小字 + 出错记录）
  const ERR_ZH = { offline: '现在没网，连上网再来聊吧', auth: 'AI 密钥不对，请告诉家长', quota: 'AI 额度用完了，请告诉家长', busy: 'AI 有点忙，过一会儿再试',
    code: '家庭口令不对，请告诉家长', network: '连不上 AI 聊天，过一会儿再试；一直不行就告诉家长' };
  const kidErr = (why, raw) => (why === 'daily' || why === 'limit' ? String(raw || '今天的聊天时间用完了，明天再来吧！') : ERR_ZH[why] || ERR_ZH.network);
  // 原文记进出错记录（家长设置「🔧 出错记录」），'direct:'（APK 直连）这种内部地址不写
  function errRaw(raw) {
    raw = String(raw || '').replace(/\s*[（(]?direct:[）)]?/g, '').trim();
    if (raw && window.EchoErr) EchoErr.log('ai', '聊天：' + raw, 'talk');
    return raw;
  }

  // 头像：people.js 的 portrait 要造型对象，名单里写的是造型名
  const face = n => EchoPeople.portrait(n.lookObj || EchoPeople.LOOKS[n.look] || EchoPeople.LOOKS.clerk);

  // ---------- 存档里的聊天数据 S.talk ----------
  // log 最近的记录、done 每个岛民最好几星、days 今天拿过金币的（岛民:日期）、mem 岛民记得的事、n 和每个岛民聊过几次（轮换目标）、seen 今天算过的句子
  function state() {
    const S = G.S;
    if (!S.talk || typeof S.talk !== 'object') S.talk = { log: [], done: {}, days: {} };
    const T = S.talk;
    if (!Array.isArray(T.log)) T.log = [];
    for (const k of ['done', 'days', 'mem', 'n']) if (!T[k] || typeof T[k] !== 'object') T[k] = {};
    return T;
  }
  const memKey = npc => npc.id === 'dyn' ? 'p-' + npc.name : npc.id;
  function countLog(k, n) { if (!G) return; const L = G.dayLog(); L[k] = (L[k] || 0) + (n || 1); G.save(); }
  // AI 用量记进今天的日志（周报估算花费）：实时聊天 aiChatIn / aiChatOut（其中音频 aiChatAudioIn / aiChatAudioOut）；
  // 文字模型（评价、打勾、翻译、点评）aiTextIn / aiTextOut —— 只有 APK 直连时数得到，网页版的花在中转服务那边
  function addUse(m) {
    if (!G || !G.S) return; const L = G.dayLog();
    L.aiChatIn = (L.aiChatIn || 0) + (m.in | 0); L.aiChatOut = (L.aiChatOut || 0) + (m.out | 0);
    L.aiChatAudioIn = (L.aiChatAudioIn || 0) + (m.ain | 0); L.aiChatAudioOut = (L.aiChatAudioOut || 0) + (m.aout | 0);
  }
  function textUse(j) {
    try { const u = j && j.usage; if (!u || !G || !G.S) return; const L = G.dayLog(); L.aiTextIn = (L.aiTextIn || 0) + (u.prompt_tokens | 0); L.aiTextOut = (L.aiTextOut || 0) + (u.completion_tokens | 0); } catch (e) {}
  }

  // 今天的聊天情况（game.js 的学习锁用）：
  // voiceLines 今天用语音说的英语句子数（≥3 个英文词、不含中文，同一句只算一次；打字不算）
  // goals 今天完成的聊天小目标数；typedLines 今天打字发的句数；concern 今天有几段聊天被打上「需要家长看看」的标记
  // need 要说满几句（6）；done = goals > 0 或 voiceLines ≥ need
  function today() {
    if (!G || !G.S) return { voiceLines: 0, goals: 0, typedLines: 0, concern: 0, need: NEED, done: false };
    const L = G.dayLog(), T = state(), d = G.dayStr();
    const goals = Math.max(L.chatGoals || 0, Object.keys(T.days).filter(k => k.endsWith(':' + d)).length);
    const voiceLines = L.voiceLines || 0;
    return { voiceLines, goals, typedLines: L.typedLines || 0, concern: L.concern || 0, need: NEED, done: goals > 0 || voiceLines >= NEED };
  }
  // 家长还没看过的、有安全标记的聊天有几段（周报提示一行用）
  function concerns() { if (!G || !G.S) return 0; return state().log.filter(r => r.concern && !r.seen).length; }
  const progText = t => t.voiceLines >= NEED ? '🗣️ 今天已开口说 ' + t.voiceLines + ' 句 ✅' : '🗣️ 已开口说 ' + t.voiceLines + '/' + NEED + ' 句';
  function progress() {
    const el = $('#tk-cnt'); if (!el) return;
    const t = today(); el.textContent = progText(t); el.classList.toggle('ok', t.voiceLines >= NEED);
  }

  // ---------- 首页的「和岛民聊天」 ----------
  function homeHTML() {
    const esc = G.esc, T = state(), url = relayUrl(), core = Core(), t = today(), nc = concerns();
    const card = (n, now) => {
      const best = T.done[n.id], g = core.goalOf(n, T.n[n.id] || 0);
      return '<button class="tk-card' + (now ? ' now' : '') + '" data-act="talk_open" data-npc="' + n.id + '">' +
        '<img src="' + face(n) + '" alt="">' +
        '<span class="tk-t"><b>' + (n.unit ? '<em>Unit ' + n.unit + (now ? ' · 📍 正在学' : '') + '</em> ' : '') + esc(n.zh) + ' <small>' + esc(n.name) + '</small></b>' +
        '<span>' + esc(n.topicZh) + ' · <i>' + esc(n.topic) + '</i></span>' +
        '<small>🔊 ' + esc(n.voiceZh) + (best ? ' · ' + '★'.repeat(best) : '') + (g.lv ? ' · 🎯 下次：' + g.lv : '') + '</small></span><span class="tk-go">🎙️</span></button>';
    };
    // 课本单元的聊天角色放前面，正在学的单元排第一个；后面是岛上的人
    // 只列正在学的这一册（别的册在闯关页每个单元上点「聊这个单元」）
    const cu = G.curUnit ? G.curUnit() : null, units = cu ? NPCS.list.filter(n => n.book === cu.book) : [], isle = NPCS.list.filter(n => !n.unit);
    const order = units.filter(n => n.unit === cu.n).concat(units.filter(n => n.unit !== cu.n));
    const cards = (units.length ? '<h3 class="tk-h">📗 课本话题 · ' + esc(cu.bshort) + '</h3>' + order.map(n => card(n, n.unit === cu.n)).join('') + '<h3 class="tk-h">🏝️ 岛上的人</h3>' : '') +
      isle.map(n => card(n, false)).join('');
    return '<section class="tk-home">' +
      '<div class="tk-intro"><b>🗣️ 用英语和岛民聊天</b><p>按住话筒说英语，松开就发出去；岛民会用自己的声音回答你。每段聊天有一个小目标，拆成几个小步骤，做到一步就打一个勾，完成了有金币！听不懂就点「💡 帮帮我」或者点岛民的话看中文。</p>' +
      '<p class="tk-prog' + (t.done ? ' ok' : '') + '">' + progText(t) + (t.done ? ' · 今天的聊天任务完成了' : ' · 用语音说满 ' + NEED + ' 句英语，或者完成一个小目标') + '</p></div>' +
      (url ? '' : '<div class="tk-warn">还没连上对话服务。请家长点下面的「设置服务」。</div>') +
      '<div class="tk-list">' + cards + '</div>' +
      '<div class="tk-foot"><button class="btn ghost" data-act="talk_log">📜 聊天记录</button><button class="btn ghost" data-act="talk_cfg">⚙️ 设置服务</button></div>' +
      '<div class="tk-foot"><button class="btn ghost small" data-act="talk_privacy">ℹ️ 家长须知</button><button class="btn ghost small" data-act="talk_concerns">👪 家长看看' + (nc ? '<span class="tk-badge">' + nc + '</span>' : '') + '</button></div>' +
      '</section>';
  }

  // ---------- 麦克风：16kHz 单声道 16 位 PCM ----------
  const WORKLET = 'class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor("tk-cap",P);';
  const MIC = { ctx: null, stream: null, node: null, on: false, buf: [], len: 0, rate: 16000 };
  async function micOpen() {
    if (MIC.ctx) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
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
    } catch (e) { micClose(); throw e; }   // 打开到一半失败：别留下半个麦克风（不然界面以为能说话）
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

  // ---------- 播放岛民的声音：24kHz PCM 分块排队播；上一句的声音留在内存里，「再听一遍」用 ----------
  const OUT = { ctx: null, next: 0, srcs: [], cur: [], last: null, el: null, url: '' };
  function playChunk(b64) {
    if (!OUT.ctx) OUT.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = OUT.ctx;
    const bin = atob(b64), n = bin.length >> 1;
    if (!n) return;
    const buf = ctx.createBuffer(1, n, 24000), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[i] = v / 0x8000; }
    OUT.cur.push(new Float32Array(ch));
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    const t = Math.max(ctx.currentTime + 0.04, OUT.next);
    src.start(t); OUT.next = t + buf.duration;
    OUT.srcs.push(src); src.onended = () => { OUT.srcs = OUT.srcs.filter(x => x !== src); talking(); };
    talking();
  }
  function stopPlayback() { OUT.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); OUT.srcs = []; OUT.next = 0; talking(); }
  const npcSpeaking = () => OUT.srcs.length > 0 || !!(OUT.el && !OUT.el.paused);
  // 岛民说完一句：这一句的声音留着（再听一遍）
  function keepLast() { if (OUT.cur.length) OUT.last = OUT.cur; OUT.cur = []; }
  function stopReplay() { if (OUT.el) { try { OUT.el.pause(); } catch (e) {} OUT.el = null; } talking(); }
  // 24kHz 单声道浮点 → WAV（不重新采样）
  function wav24(chunks) {
    const n = chunks.reduce((a, c) => a + c.length, 0), b = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (p, t) => { for (let i = 0; i < t.length; i++) b.setUint8(p + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, 24000, true); b.setUint32(28, 48000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, n * 2, true);
    let o = 44; chunks.forEach(c => { for (let i = 0; i < c.length; i++, o += 2) { const v = Math.max(-1, Math.min(1, c[i])); b.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); } });
    return new Blob([b.buffer], { type: 'audio/wav' });
  }
  // 再听一遍（slow：0.8 倍速，音调不变）
  function replay(slow) {
    const c = C;
    if (!c || c.holding || !OUT.last || !OUT.last.length) return;
    stopPlayback(); stopReplay();
    try { if (OUT.url) URL.revokeObjectURL(OUT.url); } catch (e) {}
    OUT.url = URL.createObjectURL(wav24(OUT.last));
    const a = new Audio(OUT.url);
    a.preservesPitch = true; a.playbackRate = slow ? 0.8 : 1;
    a.onplay = a.onended = a.onpause = () => talking();
    OUT.el = a;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    countLog(slow ? 'chatSlow' : 'chatReplay');
  }

  // ---------- 一段对话 ----------
  // 正在聊的这一段：{ npc, base 人设（地图上的人是临时人设）, mk 记忆的键, goal 这次的目标, ws, bubble 岛民正在说的气泡, live 正在按着说的气泡,
  //   ticks 实时打过勾的步骤, holding, ready 连上了, ending 老师在看, done 评价出来了, rec 存好的记录, t0, turns, pend, ... }
  let C = null;
  let LAST = null;  // 上一次聊天的对象（「再聊一次」用）
  const wsSend = m => { if (C && C.ws && C.ws.readyState === 1) C.ws.send(JSON.stringify(m)); };

  function talking() {
    const f = $('#tk-face'); if (f) f.classList.toggle('speaking', npcSpeaking());
  }
  function bubble(who, text) {
    const box = $('#tk-log'); if (!box) return null;
    const d = document.createElement('div');
    d.className = 'tk-b ' + who; d.textContent = text;
    box.appendChild(d); stick();
    return d;
  }
  // 最新的话留在看得见的地方（上面的气泡填进一长段字变高了，也要跟着滚到底）
  function stick() { const box = $('#tk-log'); if (box) box.scrollTop = box.scrollHeight; }
  // 孩子说的话的气泡：按住话筒就出现，边说边出字，松开后换成整段识别结果。按服务器给的编号对上气泡
  function youBubble(c, item, take) {
    let b = item && c.pend.find(x => x._item === item);
    if (!b && take) { b = take(); if (b && item) b._item = item; }
    return b || null;
  }
  const firstFree = c => () => c.pend.find(x => !x._item) || null;
  function dropPend(c, b) { c.pend = c.pend.filter(x => x !== b); }
  function status(t) { const s = $('#tk-status'); if (s) s.textContent = t; }
  const readyText = () => MIC.ctx ? '按住话筒说英语，说完松开。点岛民说的话可以看中文。' : '打字聊天：写好按「发送」。';

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
    if (C) { if (C.ending || C.done) close(); else return; }
    lmShut();   // 口语题预热的麦克风先关掉，聊天自己开
    const url = relayUrl();
    if (!url) { configure(); return; }
    const esc = G.esc, core = Core(), T = state();
    // 地图上的人：目标、步骤按 talk-core 的临时人设（和服务器拼的一样）
    const base = npc.desc ? core.personNpc(npc.desc) : npc, mk = memKey(npc), goal = core.goalOf(base, T.n[mk] || 0);
    const goalZh = goal.goalZh || npc.goalZh || '', zh = npc.wordsZh || [], mem = T.mem[mk] || null;
    const ov = document.createElement('div');
    ov.id = 'tk-ov'; ov.className = 'tk-ov';
    ov.innerHTML = '<div class="tk-box">' +
      '<div class="tk-head"><img id="tk-face" src="' + face(npc) + '" alt=""><div><b>' + (npc.zh === npc.name ? esc(npc.name) : esc(npc.zh) + ' · ' + esc(npc.name)) + '</b><small>' + esc(npc.topicZh) + '</small><span class="tk-cnt" id="tk-cnt"></span></div>' +
      '<button class="tk-x" data-act="talk_end" aria-label="结束">结束</button></div>' +
      '<div class="tk-goal"><div class="tk-gt">🎯 ' + (goal.lv ? '<em class="tk-lv">' + goal.lv + '</em> ' : '') + esc(goalZh) + '</div>' +
      (goal.steps.length ? '<ol class="tk-steps" id="tk-steps">' + goal.steps.map((s, k) => '<li data-act="talk_step" data-i="' + k + '"><i>☐</i><span>' + esc(s.zh) + '</span>' + (s.en ? '<small hidden>例：' + esc(s.en) + '</small>' : '') + '</li>').join('') + '</ol>' : '') +
      '<div class="tk-words">' + npc.words.map((w, k) => '<button type="button" class="tk-w" data-act="talk_word" data-i="' + k + '">' + esc(w) + (zh[k] ? '<small>' + esc(zh[k]) + '</small>' : '') + '</button>').join('') + '</div></div>' +
      '<div class="tk-log" id="tk-log"></div>' +
      '<div class="tk-status" id="tk-status">正在连接……</div>' +
      '<div class="tk-ctl"><div class="tk-tools"><button type="button" id="tk-help" data-act="talk_help" disabled>💡 帮帮我</button><button type="button" id="tk-re" data-act="talk_replay" disabled>🔁 再听一遍</button><button type="button" id="tk-slow" data-act="talk_replay" data-slow="1" disabled>🐢 慢一点</button></div>' +
      '<button class="tk-mic" id="tk-mic" disabled>🎤 按住说英语</button>' +
      '<button type="button" class="tk-typeopen" id="tk-typeopen" data-act="talk_typeopen" hidden>⌨️ 麦克风用不了？点这里打字</button>' +
      '<form class="tk-type" id="tk-type" hidden><input id="tk-in" maxlength="200" autocomplete="off" placeholder="打字聊天（英文）"><button class="btn">发送</button></form>' +
      '<small class="tk-typenote" id="tk-typenote" hidden>打字的话不算「开口说」的句数，也不给金币</small></div></div>';
    document.body.appendChild(ov);
    LAST = npc;
    C = { npc, base, mk, goal, ws: null, bubble: null, holding: false, ready: false, ending: false, done: false, t0: Date.now(), turns: [], pend: [], live: null, ticks: goal.steps.map(() => false) };
    if (window.EchoMusic) EchoMusic.hold(true);   // 聊天时麦克风一直开着：背景音乐静音
    const c = C;
    progress();
    OUT.last = null; OUT.cur = [];

    // 麦克风：先要权限；要不到就只能打字（打字框直接打开）
    let micOk = false;
    try { micOk = await micOpen(); } catch (e) { micOk = false; c.micErr = (e && e.name) || 'mic'; LASTERR = { why: 'mic', name: c.micErr, where: 'chat', at: Date.now() }; }
    if (c !== C) return;
    if (micOk) $('#tk-typeopen').hidden = false;
    else {
      typeOpen(false); status('用不了麦克风（没给权限或不支持），可以先打字聊。');
      // 安卓原生桥有「打开本应用的设置」时，给一个去打开麦克风权限的按钮
      try {
        if (window.EchoNative && typeof EchoNative.openAppSettings === 'function') {
          const n = $('#tk-typenote'); if (n) n.insertAdjacentHTML('afterend', '<button type="button" class="tk-typeopen" data-act="talk_micfix">🎤 去设置里打开麦克风</button>');
        }
      } catch (e) {}
    }

    const q = new URLSearchParams({ npc: npc.id, dev: devId(), name: (G.S.player && G.S.player.name) || '', g: String(goal.i) });
    if (npc.desc) { const d = npc.desc; q.set('p', b64(JSON.stringify({ name: d.name, g: d.g, kid: !!d.kid, role: d.role, island: d.island, place: d.place, lines: d.lines, words: d.words }))); }
    if (mem) q.set('m', b64(JSON.stringify({ facts: mem.facts || [], better: mem.better || '' })));
    const code = LS('echo-talk-code'); if (code) q.set('code', code);
    let ws;
    if (url === 'direct:') ws = directSocket(npc, (G.S.player && G.S.player.name) || '', goal.i, mem);
    else try { ws = new WebSocket(url + '/talk?' + q); } catch (e) { status('服务地址不对：' + url); return; }
    c.ws = ws;
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      // 聊天界面关了以后，只收老师的评价（在后台存好）
      if (c !== C && !(m.type === 'eval' && c.ending && !c.done)) return;
      if (m.type === 'ready') {
        c.ready = true;
        // 今天聊天连上过（学习锁据此判断「Wi-Fi 连着但上不了网」：连上过就不算没网）
        { const L = G.dayLog(); if (!L.chatConn) { L.chatConn = 1; G.save(); } }
        status(micOk ? readyText() : '打字聊天：写好按「发送」。');
        const mic = $('#tk-mic'); if (mic && micOk) mic.disabled = false;
        const h = $('#tk-help'); if (h) h.disabled = false;
      } else if (m.type === 'usage') addUse(m);
      else if (m.type === 'audio') { if (c.ending) return; c.responding = true; playChunk(m.data); }   // 点了结束：岛民没说完的半句不再放
      else if (m.type === 'npc') {
        c.responding = true;
        if (!c.bubble) c.bubble = bubble('npc', '');
        if (c.bubble) { c.bubble.textContent += m.delta; stick(); }
      } else if (m.type === 'npc_done') {
        c.responding = false; if (m.text) c.turns.push({ who: 'npc', text: m.text });
        // 说完的话可以点一下看中文
        if (c.bubble && m.text) { c.bubble._text = m.text; c.bubble.dataset.act = 'talk_zh'; c.bubble.classList.add('tap'); c.bubble.title = '点一下看中文'; }
        c.bubble = null;
        keepLast();
        if (OUT.last) ['#tk-re', '#tk-slow'].forEach(s => { const b = $(s); if (b) b.disabled = false; });
        // 一个字都没听到的气泡（没出声 / 杂音）：等 5 秒，字还没来就删掉（正在按着说的那个不删）
        const empty = c.pend.filter(b => !b._has && b !== c.live);
        if (empty.length) setTimeout(() => empty.forEach(b => { if (!b._has && b !== c.live) { b.remove(); dropPend(c, b); } }), 5000);
        if (!c.ending) status(readyText());
      }
      else if (m.type === 'you_item') {   // 松开话筒那一段的编号：给还没编号的最早那个气泡
        youBubble(c, m.item, firstFree(c));
      }
      else if (m.type === 'you_live') {   // 边说边出字
        const b = youBubble(c, m.item, () => (c.live && !c.live._item ? c.live : firstFree(c)()));
        if (b) { b.textContent = m.text; b._has = true; stick(); }
      }
      else if (m.type === 'you') {
        if (m.item) { c.items = c.items || new Set(); if (c.items.has(m.item)) return; c.items.add(m.item); }
        const p = youBubble(c, m.item, firstFree(c));
        if (p) { p.textContent = m.text; p._has = true; p.classList.remove('wait'); dropPend(c, p); stick(); } else bubble('you', m.text);
        c.turns.push({ who: 'you', text: m.text });
        heard(c, m.text);
      } else if (m.type === 'limit') { status(m.zh); }
      else if (m.type === 'error') {
        c.err = m.zh; c.errCode = m.code;
        if (c.ready && (m.code === 'upstream' || m.code === 'closed')) c.upErr = true;   // 连上以后服务器出错 / 断开
        c.errWhy = noteErr(c, m);
        if (c.errWhy !== 'daily') errRaw(m.zh);
        status('⚠️ ' + kidErr(c.errWhy, m.zh)); if (m.code === 'code') setTimeout(configure, 600);
      }
      else if (m.type === 'eval') { clearTimeout(c.evalTimer); finishWith(c, m.eval, m.sec, m.left, 'eval'); }
    };
    ws.onerror = () => {
      if (c !== C || c.ending || c.ready) return;
      // 直连（APK）的原因在 LASTERR 里（原生回的 HTTP 401 / 找不到服务器……）；中转服务没开时只知道「连不上」
      const le = LASTERR && Date.now() - LASTERR.at < 3000 ? LASTERR.why : '', why = noteErr(c, { code: 'net', zh: '', why: le });
      if (!le) errRaw(/^direct:/.test(url) ? '' : '连不上对话服务 ' + url);
      c.errWhy = c.errWhy || why;
      status('⚠️ ' + kidErr(why));
    };
    ws.onclose = () => {
      if (c !== C || c.ending || c.done) return;
      const mic = $('#tk-mic'); if (mic) mic.disabled = true;
      // 聊到一半断了（可能是自己这边网断了，不算服务器出错）：说过的话照样存、照样算
      if (c.ready) { c.lost = true; if (c.turns.some(t => t.who === 'you')) end('lost'); }
    };

    // 按住说话（鼠标、触屏都行；电脑上也可以按住空格）
    const mic = $('#tk-mic');
    const down = e => {
      if (mic.disabled || c.holding || c.ending) return;
      e.preventDefault(); c.holding = true;
      if (npcSpeaking()) { stopPlayback(); stopReplay(); }                 // 打断岛民
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      if (MIC.ctx && MIC.ctx.state === 'suspended') MIC.ctx.resume();
      if (OUT.ctx && OUT.ctx.state === 'suspended') OUT.ctx.resume();
      MIC.buf = []; MIC.len = 0; MIC.on = true; c.pressAt = Date.now();
      mic.classList.add('on'); mic.textContent = '🔴 正在听……松开发送';
      // 一按下就出现自己的气泡，说的话边说边冒出来
      c.live = bubble('you wait', '🎤 …'); c.pend.push(c.live);
    };
    const up = () => {
      if (!c.holding) return;
      c.holding = false; MIC.on = false; flushMic();
      mic.classList.remove('on'); mic.textContent = '🎤 按住说英语';
      const b = c.live; c.live = null;
      if (Date.now() - c.pressAt < 400) { wsSend({ type: 'commit' }); if (b) { b.remove(); dropPend(c, b); } status('按住久一点再说哦。'); return; }
      wsSend({ type: 'commit' });
      if (b && !b._has) b.textContent = '……';
      status('岛民在想……');
    };
    mic.addEventListener('pointerdown', down);
    mic.addEventListener('contextmenu', e => e.preventDefault());   // 安卓长按会弹菜单 / 选字，按住说话时不要
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
      if (c.ending || c.done) return;
      const inp = $('#tk-in'), t = inp.value.replace(/\s+/g, ' ').trim(); if (!t) return;
      if (!c.ws || c.ws.readyState !== 1) { status('还没连上，等一下再发。'); return; }
      if (npcSpeaking()) { stopPlayback(); stopReplay(); }
      if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
      // 打字的标上 typed：不算开口句数、不给金币、不开锁（规则在 talk-core 的 judge）
      wsSend({ type: 'text', text: t }); bubble('you typed', t); c.turns.push({ who: 'you', text: t, typed: true }); inp.value = '';
      countLog('typedLines');
      checkSteps(c);
      status('岛民在想……');
    });
  }
  // 打开打字框（麦克风能用时要点「麦克风用不了？点这里打字」才出来）
  function typeOpen(focus) {
    const f = $('#tk-type'), n = $('#tk-typenote'), l = $('#tk-typeopen');
    if (f) f.hidden = false; if (n) n.hidden = false; if (l) l.hidden = true;
    if (focus) { const i = $('#tk-in'); if (i) i.focus(); }
  }

  // 孩子用语音说了一句（识别结果）：算句数、目标词卡片变绿、实时打勾
  function heard(c, text) {
    countLine(text);
    markWords(c, text);
    if (/[㐀-鿿]/.test(text)) countLog('chatSaidZh');   // 说了中文（周报：中文句数）
    checkSteps(c);
  }
  // 今天用语音说的英语句子：≥3 个英文词、不含中文；同一句话一天只算一次。说满 6 句弹一句
  function countLine(text) {
    const core = Core();
    if (!core.isLine(text)) return false;
    const T = state(), d = G.dayStr(), key = String(text).toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!T.seen || T.seen.d !== d) T.seen = { d, h: [] };
    if (T.seen.h.includes(key)) return false;
    T.seen.h.push(key); if (T.seen.h.length > 80) T.seen.h.shift();
    const L = G.dayLog(), before = L.voiceLines || 0, n = core.enWords(text).length;
    L.voiceLines = before + 1; L.voiceWords = (L.voiceWords || 0) + n;
    if (n > (L.voiceMax || 0)) { L.voiceMax = n; L.voiceBest = String(text).slice(0, 160); }   // 今天说的最长的一句（周报用）
    G.save();
    progress();
    if (before < NEED && before + 1 >= NEED) {
      G.toast('🎉 今天的聊天任务完成了！（已开口说 ' + NEED + ' 句英语）');
      if (G.renderTop) G.renderTop();
    }
    return true;
  }
  const norm = s => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
  // 孩子说到目标词：卡片变绿（四个词以上的短语对上前三个词就算）
  function markWords(c, text) {
    const t = ' ' + norm(text) + ' ';
    (c.npc.words || []).forEach((w, k) => {
      let p = norm(w).split(' ').filter(Boolean); if (!p.length) return;
      if (p.length >= 4) p = p.slice(0, 3);
      if (t.includes(' ' + p.join(' ') + ' ')) { const el = document.querySelector('.tk-w[data-i="' + k + '"]'); if (el) el.classList.add('hit'); }
    });
  }

  // ---------- 小步骤实时打勾：每说一句，和岛民的回答同时，让便宜的模型看一眼哪几步做到了 ----------
  async function stepCall(c) {
    const core = Core(), turns = c.turns.slice(-30), n = c.goal.steps.length;
    try {
      if (direct()) {
        const body = core.stepsBody(c.base, c.goal.i, turns); if (!body) return [];
        const r = await nativePost(core.EVAL_URL, JSON.stringify(body), 12000);
        if (!r.ok) { noteAi('steps', r.text); return []; }
        const j = JSON.parse(r.text); textUse(j);
        return core.parseSteps(j, n);
      }
      if (relayHttp()) {
        const r = await relayPost('/steps', { npc: c.npc.id, nm: c.npc.id === 'dyn' ? c.npc.name : undefined, g: c.goal.i, turns: turns.map(t => ({ who: t.who, text: t.text, typed: !!t.typed })) }, 12000);
        if (!r.ok) { noteAi('steps', 'HTTP ' + r.status + ' ' + r.text); return []; }
        return (JSON.parse(r.text).done || []).map(x => x | 0).filter(x => x >= 0 && x < n);
      }
    } catch (e) {}
    return [];
  }
  function checkSteps(c) {
    if (!c.goal.steps.length || c.done || c.ending || c.ticks.every(Boolean)) return;
    if (c.stepBusy) { c.stepAgain = true; return; }
    c.stepBusy = true;
    stepCall(c).then(idx => {
      c.stepBusy = false;
      const before = c.ticks.filter(Boolean).length;
      idx.forEach(k => { if (!c.ticks[k]) { c.ticks[k] = true; tick(k); } });
      const n = c.goal.steps.length, need = n <= 2 ? n : n - 1, now = c.ticks.filter(Boolean).length;
      if (c === C && !c.ending && before < need && now >= need) G.toast(now === n ? '🎯 小步骤全做到了！和 TA 说再见，再点「结束」' : '🎯 小目标差不多完成了！再做一步更好，也可以点「结束」');
      if (c.stepAgain) { c.stepAgain = false; checkSteps(c); }
    });
  }
  function tick(k) {
    const li = document.querySelector('#tk-steps li[data-i="' + k + '"]'); if (!li || li.classList.contains('ok')) return;
    li.classList.add('ok'); const i = li.querySelector('i'); if (i) i.textContent = '✅';
  }

  // ---------- 点岛民的话看中文（翻译一次就记住） ----------
  const ZHC = {};
  async function translate(text) {
    if (ZHC[text]) return ZHC[text];
    const core = Core(); let zh = '';
    try {
      if (direct()) {
        const r = await nativePost(core.EVAL_URL, JSON.stringify(core.zhBody(text)), 10000);
        if (r.ok) { const j = JSON.parse(r.text); textUse(j); zh = core.parseZh(j); } else noteAi('zh', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/zh', { text }, 10000);
        if (r.ok) zh = String(JSON.parse(r.text).zh || ''); else noteAi('zh', 'HTTP ' + r.status + ' ' + r.text);
      }
    } catch (e) { zh = ''; }
    zh = String(zh || '').trim().slice(0, 200);
    if (zh) ZHC[text] = zh;
    return zh;
  }
  async function showZh(b) {
    if (!b || !b._text || b._busy) return;
    let z = b.querySelector('.tk-zh');
    if (z && !z._fail) { z.hidden = !z.hidden; stick(); return; }
    if (z) z.remove();
    z = document.createElement('small'); z.className = 'tk-zh'; z.textContent = '翻译中……'; b.appendChild(z); b._busy = true;
    const zh = await translate(b._text);
    b._busy = false;
    if (zh) { z.textContent = zh; countLog('chatZh'); }
    else { z.textContent = '（这次没翻译出来，再点一下试试）'; z._fail = true; }
    stick();
  }

  // ---------- 帮帮我：让岛民给一句能照着说的话（不算孩子说的） ----------
  function help() {
    const c = C;
    if (!c || !c.ready || c.ending || c.done || c.holding) return;
    if (Date.now() - (c.helpAt || 0) < 3000) return;
    c.helpAt = Date.now();
    if (npcSpeaking()) { stopPlayback(); stopReplay(); }
    if (c.responding) { wsSend({ type: 'cancel' }); c.responding = false; }
    wsSend({ type: 'help' });
    countLog('chatHelp');
    status('💡 岛民在想一句你可以照着说的话……');
  }

  // ---------- 结束：返回键、切后台、点「结束」都走这里（结束并评价） ----------
  function end(why) {
    const c = C; if (!c) return false;
    if (c.done || c.ending) { close(); return true; }     // 评价已经出来了 / 老师还在看（评价到了在后台存好）
    if (!c.turns.some(t => t.who === 'you')) { close(); return true; }   // 一句都没说：没什么可存的
    c.ending = true; c.endWhy = why || 'btn';
    stopPlayback(); stopReplay(); MIC.on = false; c.holding = false;
    ['#tk-mic', '#tk-help', '#tk-re', '#tk-slow'].forEach(s => { const b = $(s); if (b) b.disabled = true; });
    if (c.ws && c.ws.readyState === 1) {
      status('聊得不错！老师正在看你们的对话……');
      wsSend({ type: 'end', steps: c.ticks });
      // 老师太慢：先把这段存下来、照样算（晚到的评价还会补上）
      c.evalTimer = setTimeout(() => { if (!c.done) finishWith(c, null, null, null, 'timeout'); }, CFG.evalWait);
    } else finishWith(c, null, null, null, 'lost');
    return true;
  }
  // 安卓返回键（game.js 的 EchoBack 调）：聊天开着就「结束并评价」（评价出来了再按一次就关掉），返回 true；没开着返回 false
  function endIfOpen() { if (!C) return false; end('back'); return true; }
  function close() {
    const c = C; if (!c) return;
    C = null;
    if (c.ending && !c.done) c.bg = true;   // 老师还在看：连接先留着，评价到了在后台存好（最多等 CFG.evalWait）
    else { try { c.ws && c.ws.close(); } catch (e) {} }
    // 连上过、服务器真出错了，又一句都没能说：今天的聊天这一项免了
    if (!c.rec && c.upErr && navigator.onLine !== false) failDay(c);
    if (window.EchoMusic) EchoMusic.hold(false);
    if (c.key) { document.removeEventListener('keydown', c.key); document.removeEventListener('keyup', c.key); }
    if (c.resize) window.removeEventListener('resize', c.resize);
    stopPlayback(); stopReplay(); micClose();
    const ov = $('#tk-ov'); if (ov) ov.remove();
    if (G.renderHome && !$('#home').hidden) G.renderHome();
  }
  function failDay(c) { const L = G.dayLog(); L.chatFail = 1; L.chatFailWhy = c.errCode || 'closed'; G.save(); }
  // 没连上的原因记进今天的日志（学习锁、首页红条用）
  function noteErr(c, m) {
    const why = m.why || (m.code === 'daily' ? 'daily' : m.code === 'code' ? 'code' : m.code === 'busy' ? 'busy' : noteAi('chat', m.zh));
    const L = G.dayLog();
    if (m.code === 'daily') L.chatDaily = 1;   // 今天的聊天时长用完了
    if (!c.ready) L.chatErr = why;
    G.save();
    return why;
  }

  // ---------- 聊完：存记录、给星星金币、记住小事；评价晚到了再补 ----------
  // raw = 服务器 / 原生给的评价（已经按 talk-core 的 judge 判过，本机按实时打勾再判一次）；how = eval / timeout / lost
  function finishWith(c, raw, sec, left, how) {
    if (c.done && (!raw || !c.rec || (c.rec.eval && c.rec.eval.ai))) return;   // 已经存过：晚到的空评价不用管
    clearTimeout(c.evalTimer);
    if (!c.turns.some(t => t.who === 'you')) {   // 一句都没说（时间到 / 断开）：不存记录
      c.done = c.ended = true;
      if (c.upErr && navigator.onLine !== false) failDay(c);
      if (c === C) showEmpty(c, left);
      return;
    }
    const first = !c.rec, r = settle(c, raw, sec, how);
    c.done = c.ended = true;
    if (c !== C) {   // 聊天界面已经关了：在后台存好，弹一句
      if (r.newGoal) G.toast('🎯 和 ' + c.npc.name + ' 的聊天目标完成了！' + (r.coins ? '+' + r.coins + ' 金币' : ''));
      try { c.ws && c.ws.close(); } catch (e) {}
      if (G.renderHome && !$('#home').hidden) G.renderHome();
      return;
    }
    if (!first && how === 'eval') try { c.ws && c.ws.close(); } catch (e) {}
    showEval(c, r, left);
  }
  function settle(c, raw, sec, how) {
    const core = Core(), T = state(), npc = c.npc, L = G.dayLog();
    const ev = core.judge(c.goal, c.turns, raw, c.ticks);
    let rec = c.rec, coins = 0, newGoal = false;
    if (!rec) {
      rec = c.rec = {
        t: c.t0, npc: npc.id, nm: npc.id === 'dyn' ? npc.name : undefined, g: c.goal.i,
        turns: c.turns.slice(0, 40).map(t => t.typed ? { who: t.who, text: t.text, typed: 1 } : { who: t.who, text: t.text }),
        eval: null, sec: sec != null ? sec : Math.round((Date.now() - c.t0) / 1000), voice: core.voiceLines(c.turns),
      };
      if (how !== 'eval') rec.late = how;   // 老师没来得及评价（timeout 超时 / lost 断开）
      T.log.unshift(rec); trimLog(T);
      L.chats = (L.chats || 0) + 1;
      if (npc.id !== 'dyn') T.n[c.mk] = (T.n[c.mk] || 0) + 1;   // 下次换一个目标（地图上的人只有一个目标，不用数）
    }
    if (ev) { rec.eval = ev; delete rec.late; if (!ev.ai) rec.late = how; }
    // 安全标记：模型说的，或者本机查到的
    if (((ev && ev.concern) || core.worried(c.turns)) && !rec.concern) {
      rec.concern = 1; rec.why = (ev && ev.concernWhy) || '孩子说到了难过或不安全的事';
      L.concern = (L.concern || 0) + 1;
    }
    if (ev && ev.done && !rec.goal) {
      rec.goal = 1; newGoal = true; L.chatGoals = (L.chatGoals || 0) + 1;
      const key = (npc.id === 'dyn' ? 'p-' + npc.name : npc.id) + ':' + G.dayStr();   // 地图上的人按名字算，每人每天一次金币
      if (!T.days[key]) { T.days[key] = 1; coins = 10 + 5 * ev.stars; G.S.coins += coins; rec.coins = coins; }
      if (G.qProg) G.qProg('talk', 1);   // 每日任务「和岛民聊天，完成 1 个目标」
    }
    if (ev && npc.id !== 'dyn') T.done[npc.id] = Math.max(T.done[npc.id] || 0, ev.stars);
    if (ev && ev.ai && !rec.taught) {
      rec.taught = 1;
      // 老师给的「更好的说法」进每日复习（第三个参数是孩子的原话，复习时可以显示「你原来说的」）
      if (G.revAddFree) ev.tips.forEach(t => G.revAddFree(t.better, t.zh, t.said));
      remember(c.mk, ev);
    }
    // 连上过、服务器真出错，又没拿到老师的评价：今天的聊天这一项免了（没网、一开始就没连上的不算）
    if (!(ev && ev.ai) && c.upErr && navigator.onLine !== false) failDay(c);
    for (const k of Object.keys(T.days)) if (!k.endsWith(G.dayStr())) delete T.days[k];
    G.save(); if (G.renderTop) G.renderTop();
    return { ev, coins: coins || (newGoal ? 0 : rec.coins || 0), newGoal, rec };
  }
  // 最近 30 段；有安全标记、家长还没看过的多留着（最多再留 10 段）
  function trimLog(T) {
    T.log = T.log.slice(0, 30).concat(T.log.slice(30).filter(r => r.concern && !r.seen).slice(0, 10));
  }
  // 岛民记住这次聊到的游戏里的小事（只存在这台手机里）和老师改过的一句，下次开场提起
  function remember(mk, ev) {
    const T = state(), core = Core(), old = T.mem[mk] || {}, seen = new Set();
    const facts = (ev.memory || []).concat(old.facts || []).filter(x => { const k = String(x).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const m = core.memOf({ facts, better: ev.tips && ev.tips[0] ? ev.tips[0].better : '' });
    if (!m) { delete T.mem[mk]; return; }
    T.mem[mk] = { facts: m.facts, better: m.better, t: Date.now() };
    const ks = Object.keys(T.mem);
    if (ks.length > 40) ks.sort((a, b) => (T.mem[a].t || 0) - (T.mem[b].t || 0)).slice(0, ks.length - 40).forEach(k => delete T.mem[k]);
  }

  function evalBtns(c) {
    return '<div class="tk-btns"><button class="btn" data-act="talk_again" data-npc="' + c.npc.id + '">再聊一次</button><button class="btn ghost" data-act="talk_close">返回</button></div>';
  }
  function gateLine() { try { return G.gate && G.gate().on && G.gate().open ? '<p class="tk-coin">🔓 今天的学习任务完成了，可以去怪兽冒险！</p>' : ''; } catch (e) { return ''; } }
  function progLine() { const t = today(); return '<p class="tk-prog' + (t.voiceLines >= NEED ? ' ok' : '') + '">' + progText(t) + '</p>'; }
  // 一句都没说就结束了（连不上 / 时间到）
  function showEmpty(c, left) {
    const esc = G.esc, box = $('#tk-ov .tk-box'); if (!box) return;
    const why = c.err ? c.errWhy || errWhy(c.err) : '', raw = c.err ? String(c.err).replace(/\s*[（(]?direct:[）)]?/g, '').trim() : '';
    box.innerHTML = '<div class="tk-eval"><img src="' + face(c.npc) + '" alt="">' +
      (why === 'daily' ? '<b>今天聊够啦</b><p>' + esc(kidErr(why, c.err)) + '</p>'
        : c.err ? '<b>⚠️ 没连上</b><p>' + esc(kidErr(why)) + '</p>' + (raw && raw !== kidErr(why) ? '<p class="tk-raw">（给家长看：' + esc(raw) + '）</p>' : '')
        : '<b>这次没说话哦</b><p>按住话筒说英语，岛民就会回答你。</p>') +
      progLine() + (left != null ? '<p class="tk-time">今天还能聊 ' + Math.floor(left / 60) + ' 分钟</p>' : '') + evalBtns(c) + '</div>';
  }
  function showEval(c, r, left) {
    const esc = G.esc, ev = r.ev, rec = r.rec, box = $('#tk-ov .tk-box'); if (!box) return;
    const steps = c.goal.steps, typed = c.turns.some(t => t.who === 'you' && t.typed), voice = rec.voice;
    const coins = r.coins;
    let body;
    if (ev) {
      body = '<div class="tk-stars">' + '★'.repeat(ev.stars) + '<i>' + '★'.repeat(3 - ev.stars) + '</i></div>' +
        '<b>' + (ev.done ? (ev.stars === 3 ? '🎯 目标完成！每一步都做到了' : '🎯 目标完成！（差 1 步也算完成）') : voice < 3 ? '要开口说才算哦' : '还差一点点，下次试试把小步骤都说到') + '</b>' +
        (voice < 3 ? '<p class="tk-note">这次用语音说的英语句子不到 3 句' + (typed ? '（打字的不算）' : '') + '，目标先不算完成。下次按住话筒说吧！</p>' : '') +
        (steps.length ? '<ul class="tk-steps-r">' + steps.map((s, k) => '<li>' + (ev.steps[k] ? '✅ ' : '⬜ ') + esc(s.zh) + '</li>').join('') + '</ul>' : '') +
        (ev.praise ? '<p>' + esc(ev.praise) + '</p>' : '') +
        (!ev.ai ? '<p class="tk-note">老师这次没来得及写评语，不过这段聊天算数，已经记下来了！</p>' : '') +
        (ev.tips.length ? '<div class="tk-tips"><b>可以这样说更好（明天的每日复习里会再练）：</b>' + ev.tips.map(t => '<div><s>' + esc(t.said) + '</s><br>→ <b>' + esc(t.better) + '</b><small>' + esc(t.zh) + '</small></div>').join('') + '</div>' : '') +
        (coins ? '<p class="tk-coin">🪙 +' + coins + ' 金币</p>' : '');
    } else {
      body = '<b>聊完啦！这段聊天算数 👍</b><p>老师这次没来得及看完（可能是网络慢），不过你开口说的句子已经记下来了。</p>';
    }
    if (ev && ev.concern) body += '<p class="tk-note">💛 如果你遇到了难过或者不安全的事，记得马上告诉爸爸妈妈或者老师。</p>';
    box.innerHTML = '<div class="tk-eval"><img src="' + face(c.npc) + '" alt="">' + body + progLine() + gateLine() +
      '<p class="tk-time">这次聊了 ' + rec.sec + ' 秒' + (left != null ? ' · 今天还能聊 ' + Math.floor(left / 60) + ' 分钟' : '') + '</p>' + evalBtns(c) + '</div>';
    if (ev && ev.done && r.newGoal && G.confetti) G.confetti(80);
  }

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
  function directSocket(npcIn, player, gi, mem) {
    const C = window.TalkCore, N = window.EchoNative, id = ++nid;
    const sock = { readyState: 0, onmessage: null, onerror: null, onclose: null };
    const toGame = m => { if (sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const shut = () => { if (sock.readyState === 3) return; sock.readyState = 3; delete NWS[id]; if (sock.onclose) sock.onclose(); };
    const npc = npcIn.desc ? C.personNpc(npcIn.desc) : npcIn;
    const left = DAILY_SEC - usage();
    if (!npc || left < 20) { setTimeout(() => { toGame({ type: 'error', code: 'daily', zh: npc ? '今天的聊天时间用完了，明天再来吧！' : '没有这个岛民' }); shut(); }, 0); sock.send = () => {}; sock.close = shut; return sock; }
    const S = C.session({
      npc, player: String(player).replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16), limitSec: Math.min(SESSION_SEC, left), leftSec: left, goal: gi, memory: mem,
      up: m => { try { N.wsSend(id, JSON.stringify(m)); } catch (e) {} },
      out: toGame,
      evaluate: (n, turns, o) => new Promise(res => {
        const body = C.evalBody(n, turns, o); if (!body) return res(null);
        const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res(null); }, CFG.httpWait);
        NWS[pid] = (type, data) => { clearTimeout(tm); delete NWS[pid]; let ev = null; try { if (type === 'ok') { const j = JSON.parse(data); textUse(j); ev = C.parseEval(j); } else noteAi('eval', data); } catch (e) {} res(ev); };
        try { N.post(pid, C.EVAL_URL, JSON.stringify(body)); } catch (e) { clearTimeout(tm); res(null); }
      }),
      onEnd: ({ sec }) => { usage(sec); try { N.wsClose(id); } catch (e) {} setTimeout(shut, 300); },
    });
    NWS[id] = (type, data) => {
      if (type === 'open') { sock.readyState = 1; S.start(); }
      else if (type === 'message') { let m; try { m = JSON.parse(data); } catch (e) { return; } S.fromUp(m); }
      else if (type === 'closed') S.upClosed();
      else if (type === 'error') { noteAi('chat', data); if (sock.readyState === 0 && sock.onerror) sock.onerror({}); S.upClosed('连不上对话服务（' + String(data || '').slice(0, 60) + '）'); }
    };
    sock.send = str => { let m; try { m = JSON.parse(str); } catch (e) { return; } S.fromGame(m); };
    sock.close = () => { if (!S.closed) S.finish(); else shut(); };
    try { N.wsOpen(id, C.REALTIME_URL + '?model=' + encodeURIComponent(C.MODEL)); } catch (e) { setTimeout(() => NWS[id] && NWS[id]('error', e.message), 0); }
    return sock;
  }

  // 原生桥的 HTTPS（带密钥）：→ Promise<{ ok, text }>
  function nativePost(url, body, ms) {
    return new Promise(res => {
      const pid = ++nid, tm = setTimeout(() => { delete NWS[pid]; res({ ok: false, text: 'timeout' }); }, ms || CFG.httpWait);
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
  // 网页版：中转服务（server/relay.js 的 /asr、/tip、/zh、/steps）替 APK 的原生桥去连阿里云
  const relayHttp = () => { const u = relayUrl(); return u && u !== 'direct:' ? u.replace(/^ws/, 'http') : ''; };
  const cloudSR = () => direct() || !!relayHttp();
  async function relayPost(path, body, ms) {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms || CFG.httpWait);
    try {
      const code = LS('echo-talk-code');
      const r = await fetch(relayHttp() + path + (code ? '?code=' + encodeURIComponent(code) : ''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      return { ok: r.ok, status: r.status, text: await r.text() };
    } catch (e) { return { ok: false, status: 0, text: e.message }; } finally { clearTimeout(tm); }
  }
  // AI 老师点评：目标句子 + 识别出来的话 → 一句中文，指出最主要的差别、怎么读对
  const TIPS = {};
  async function aiTip(target, heard) {
    const k = target + '|' + heard;
    if (TIPS[k] !== undefined) return TIPS[k];
    const sys = '你是一位耐心的初中英语发音老师。学生要大声说的英文是：「' + target + '」。语音识别听到学生说的是：「' + heard + '」。用一句简体中文（不超过 28 个字）指出最主要的问题：只说漏读了哪个词、多读了哪个词、或者把哪个词说成了哪个词，并告诉他正确的说法；不要猜是哪个音没发好。如果听到的和目标几乎不是同一句话（大部分词都对不上），就只说「你读的好像是另一句话，先点喇叭听一遍原句再读」。不要表扬、不要客套，只输出这一句话。';
    const body = { model: 'qwen-plus', temperature: 0.2, max_tokens: 80, messages: [{ role: 'system', content: sys }, { role: 'user', content: '请点评。' }] };
    let tip = '';
    try {
      if (direct()) { const r = await nativePost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', JSON.stringify(body), 10000); if (r.ok) { const j = JSON.parse(r.text); textUse(j); tip = j.choices[0].message.content; } else noteAi('tip', r.text); }
      else if (relayHttp()) { const r = await relayPost('/tip', { target, heard }, 10000); if (r.ok) tip = JSON.parse(r.text).tip; else noteAi('tip', 'HTTP ' + r.status + ' ' + r.text); }
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
        if (r.ok) url = JSON.parse(r.text).output.audio.url; else noteAi('tts', r.text);
      } else if (relayHttp()) {
        const r = await relayPost('/tts', { text, g }, 6000);
        if (r.ok) url = JSON.parse(r.text).url; else noteAi('tts', 'HTTP ' + r.status + ' ' + r.text);
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
  // 返回 { text, err, how, why }：err 是 network / no-speech / not-allowed / audio-capture / aborted / busy / service-not-allowed；
  // why 是出错的细分原因（offline / auth / quota / busy / code / network；麦克风的是浏览器报的错误名，比如 NotAllowedError）
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
    catch (e) { return { err: 'not-allowed', why: (e && e.name) || 'mic' }; }
    try {
      try { ctx = new AudioContext({ sampleRate: 16000 }); } catch (e) { ctx = new AudioContext(); }
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
    } catch (e) { try { stream.getTracks().forEach(t => t.stop()); } catch (er) {} try { ctx && ctx.close(); } catch (er) {} return { err: 'audio-capture', why: (e && e.name) || 'audio' }; }
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
  // 切到后台：把口语题的麦克风关掉；正在和岛民聊天就「结束并评价」（家长定的：切后台和返回键一样）
  // 还没连上时不管：安卓第一次弹「允许用麦克风」的系统窗口时页面也会切到后台，那时不能把聊天关了
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !LM.sink) lmShut();
    if (document.hidden && C && !C.ending && !C.done && (C.ready || C.turns.some(t => t.who === 'you'))) end('hidden');
  });
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
      if (!r.ok) r.text = 'HTTP ' + r.status + ' ' + r.text;
    }
    return r.ok ? { text, err: text ? null : 'no-speech' } : { text: '', err: 'network', why: noteAi('asr', r.text) };
  }
  // o.onState(文字)：「🎤 请说……」和边说边出来的文字；o.match(文字) → true 就立刻结束；o.short：单词/短语（停顿等得短一点）
  async function listenOnce(o) {
    o = o || {};
    if (!cloudSR()) return { text: '', err: 'service-not-allowed' };
    if (C) return { text: '', err: 'busy' };   // 正在和岛民聊天，麦克风被占着
    const mic = await lmOpen();
    if (mic.err) return { text: '', err: mic.err, why: mic.why };
    const rate = mic.rate, chunks = [], st = { pos: 0 }, t0 = performance.now();
    let len = 0, voiced = 0, quiet = 0, done = false, over = false, ready = false, queue = [], pend = [], pendN = 0, texts = [], cur = '', grace = 0, inSpeech = false;
    let dead = RTA.fails >= 3;
    return new Promise(resolve => {
      const full = () => (texts.join(' ') + ' ' + cur).replace(/\s+/g, ' ').trim();
      const fail = d => { if (dead) return; dead = true; RTA.fails++; if (d) noteAi('asr-rt', d); };
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
          else if (m.type === 'error') fail(JSON.stringify(m.error || m).slice(0, 200));
        } else if (type === 'error' || type === 'closed') fail(type === 'error' ? String(data || '') : '');
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

  // ---------- 家长：设置服务地址 / 家庭口令；看记录；须知 ----------
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
  const npcOf = r => NPCS.byId[r.npc] || { zh: r.nm || r.npc, name: r.nm || r.npc };
  const turnsHTML = (r, n) => r.turns.map(t => '<div class="' + t.who + (t.typed ? ' typed' : '') + '">' + (t.who === 'you' ? '我：' : G.esc(n.name) + '：') + G.esc(t.text) + '</div>').join('');
  function showLog() {
    const esc = G.esc, T = state();
    const rows = T.log.map(r => {
      const n = npcOf(r);
      return '<div class="tk-lr"><b>' + esc(n.zh) + '</b> <small>' + new Date(r.t).toLocaleString('zh-CN') + (r.eval ? ' · ' + '★'.repeat(r.eval.stars) + (r.eval.done ? ' · 🎯' : '') : '') + (r.voice != null ? ' · 开口 ' + r.voice + ' 句' : '') + '</small>' +
        turnsHTML(r, n) + '</div>';
    }).join('') || '<p>还没有聊天记录。</p>';
    G.openModal('<h2>📜 聊天记录</h2><p class="muted">最近 30 次，只存在这台设备上。</p><div class="tk-logs">' + rows + '</div><button class="btn" data-act="close">关闭</button>');
  }
  // 家长看看：有安全标记的聊天（孩子说到难过、被欺负、有危险……）全文。要家长密码；看过的点「家长看过了」，周报就不再提示
  let parentUntil = 0;
  function concernSheet(again) {
    if (!again || Date.now() > parentUntil) {
      if (G.parentOk && !G.parentOk('看需要注意的聊天')) return;
      parentUntil = Date.now() + 5 * 60000;
    }
    const esc = G.esc, T = state(), list = T.log.filter(r => r.concern);
    const rows = list.map(r => {
      const n = npcOf(r);
      return '<div class="tk-concern"><b>' + esc(n.zh) + '</b> <small>' + new Date(r.t).toLocaleString('zh-CN') + '</small>' +
        '<p class="why">⚠️ ' + esc(r.why || '') + '</p><div class="tk-lr">' + turnsHTML(r, n) + '</div>' +
        (r.seen ? '<small>✅ 家长看过了</small>' : '<button class="btn small" data-act="talk_ack" data-t="' + r.t + '">✅ 家长看过了</button>') + '</div>';
    }).join('') || '<p>没有需要注意的聊天。</p>';
    G.openModal('<h2>👪 家长看看</h2><p class="muted">孩子在聊天里说到难过、被欺负、害怕或有危险时，这段聊天会标出来（AI 判断，加上本机查关键词，可能有误报）。岛民会提醒孩子马上告诉家长或老师。</p><div class="tk-logs">' + rows + '</div><button class="btn" data-act="close">关闭</button>');
  }
  function privacySheet() {
    G.openModal('<h2>ℹ️ 家长须知：AI 聊天</h2><ul class="tk-notice">' +
      '<li>和岛民聊天、口语题打分时，孩子说话的<b>声音和识别出来的文字</b>会发到<b>阿里云百炼（通义千问）</b>做语音识别、对话和打分。安卓 APK 直接连阿里云；网页版经过家里的中转服务。</li>' +
      '<li>岛民只扮演游戏角色、只聊游戏和日常的话题，不会问真名、学校、住址、电话。孩子认真问「你是真人吗」，岛民会说自己是<b>电脑做的游戏角色</b>。</li>' +
      '<li>孩子说到难过、被欺负、害怕或有危险时，岛民会认真回应、提醒他马上告诉家长或老师，这段聊天会标出来，家长在「👪 家长看看」里输密码能看全文，周报上也会提示。</li>' +
      '<li>聊天记录存在这台手机里（最近 30 段）；网页版的中转服务也会存一份，<b>保留 90 天</b>后自动删掉。</li>' +
      '<li>岛民会记住孩子在游戏里说过的小事（比如喜欢画画、有一只火怪兽），下次聊天提起来——<b>只存在这台手机里</b>，不记真名、学校、住址。</li>' +
      '<li>给主角起名时请用<b>游戏昵称</b>，不要用真名。</li></ul>' +
      '<div class="tk-btns"><button class="btn ghost small" data-act="talk_forget">🧹 让岛民忘掉以前聊过的事</button><button class="btn" data-act="close">知道了</button></div>');
  }

  function init(api) {
    G = api;
    return {
      talk_open: t => open(t.dataset.npc),
      talk_again: t => { const id = t.dataset.npc, last = LAST; close(); open(id === 'dyn' ? last : id); },
      talk_end: () => end('btn'),
      // 「返回」：评价出来了就关掉；还在聊就「结束并评价」（老版 game.js 的返回键调这个，也不会把这段聊天丢掉）
      talk_close: () => end('back'),
      talk_cfg: () => configure(),
      talk_log: () => showLog(),
      talk_help: () => help(),
      talk_replay: t => replay(!!t.dataset.slow),
      talk_typeopen: () => typeOpen(true),
      talk_micfix: () => { try { EchoNative.openAppSettings(); } catch (e) {} },
      talk_zh: t => showZh(t),
      talk_word: t => { const c = C, w = c && c.npc.words[+t.dataset.i]; if (w && G.say && !c.holding) { stopPlayback(); stopReplay(); G.say(w); } },
      talk_step: t => {   // 点一个小步骤：亮出示范句、读一遍
        const c = C, s = c && c.goal.steps[+t.dataset.i]; if (!s) return;
        const sm = t.querySelector('small'); if (sm && sm.hidden) { sm.hidden = false; countLog('chatHint'); }
        if (s.en && G.say && !c.holding) { stopPlayback(); stopReplay(); G.say(s.en); }
      },
      talk_privacy: () => privacySheet(),
      talk_forget: () => { state().mem = {}; G.save(); G.toast('岛民忘掉以前聊过的事了'); },
      talk_concerns: () => concernSheet(false),
      talk_ack: t => { const r = state().log.find(x => x.t === +t.dataset.t); if (r) { r.seen = 1; G.save(); } concernSheet(true); },
    };
  }
  window.EchoTalk = {
    init, homeHTML, open, openPerson, relayUrl, cloudSR, listenOnce, aiTip, cloudTTS, stopListen: () => SR.stop && SR.stop(),
    today, endIfOpen, concerns, isOpen: () => !!C, lastErr: () => LASTERR, NEED, cfg: CFG,
  };
})();
