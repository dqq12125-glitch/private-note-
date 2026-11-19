// 两个 WebSocket：/v1/talk 和岛民实时语音聊天、/v1/asr-rt 口语题的实时识别。API.md §8
// 做法照家庭版中转服务（server/relay.js）：手机只发岛民 / 委托的 id、目标、级别、界面语言、记忆，人设和安全规则在这里用 talk-core.js 拼，
// 手机发来的人设一概不看。区别：要登录、按账号计时（墙钟秒数）、额度用完前 60 秒提醒、到点由 talk-core 正常收尾（说一句、给评价）。
//
// 为什么不用 Durable Object：一段聊天要一直开着一条连阿里云的 WebSocket，Durable Object 有这样的出站连接就不能休眠，
// 整段时间按墙钟计费（README「成本」）；普通 Worker 只按 CPU 时间计费，转发声音几乎不费 CPU。
// 「一个账号同时只聊一段」和「断了也要记账」靠 D1 的 talk_live 表（quota.js 的 talkOpen / talkBeat / talkClose）。
import { HttpError, b64json, isoOrNull, randId } from './util.js';
import { CORE, npcById, questNpc } from './shared.js';
import { authUser } from './auth.js';
import { requireConsent } from './me.js';
import { wsLimit } from './ratelimit.js';
import { take, refund, talkOpen, talkBeat, talkClose, talkDrop, resetAt } from './quota.js';
import { dsSocket, dsPost, EVAL_PATH } from './upstream.js';

// 给学习者看的一句话（按这段的界面语言；没有的语言用英文）
const SAY = {
  auth: { zh: '请重新登录', en: 'Please sign in again.' },
  quota: { zh: '今天的聊天时间用完了，明天再来吧！', en: 'Today\'s chat time is used up. Come back tomorrow!' },
  consent: { zh: '要先得到家长同意，才能用语音和岛民聊天', en: 'A parent needs to agree before you can chat by voice.' },
  rate: { zh: '太频繁了，过一会儿再试', en: 'Too many tries. Wait a moment.' },
  conflict: { zh: '另一段聊天还开着，先把它结束吧', en: 'Another chat is still open. Finish it first.' },
  bad_request: { zh: '没有这个岛民', en: 'This islander is not here.' },
  too_large: { zh: '消息太大了', en: 'That message is too big.' },
  provider: { zh: 'AI 有点忙，过一会儿再试', en: 'The AI is busy. Try again soon.' },
  timeout: { zh: '连接超时了，再试一次', en: 'The connection timed out. Try again.' },
  server: { zh: '服务器出了点问题', en: 'Something went wrong on the server.' },
  unavailable: { zh: '服务还没准备好', en: 'The service is not ready yet.' },
};
const CLOSE = { 400: 4400, 401: 4401, 402: 4402, 403: 4403, 408: 4408, 409: 4409, 413: 4413, 429: 4429, 503: 4503 };

export function wsAccept(R, kind) {
  if ((R.req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') throw new HttpError(400, 'bad_request', 'Expected a WebSocket upgrade', { field: 'upgrade' });
  const pair = new WebSocketPair(), client = pair[0], ws = pair[1];
  ws.accept();
  const qs = new URL(R.req.url).searchParams;
  const C = conn(R, ws, qs.get('ui'));
  (kind === 'talk' ? talkRun : asrRun)(R, C, qs).catch(e => C.fail(e));
  return new Response(null, { status: 101, webSocket: client });
}

// 一条客户端连接：发消息、出错收场、等第一条 auth 消息、大小上限
function conn(R, ws, uiRaw) {
  const C = { ws, ui: CORE.uiOk(String(uiRaw || '')) || 'zh', closed: false, onMsg: null, onClose: [], authWait: null };
  C.send = m => { if (!C.closed) try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) {} };
  C.close = code => { if (C.closed) return; C.closed = true; try { ws.close(code || 1000, ''); } catch (e) {} C.onClose.forEach(f => { try { f(); } catch (e) {} }); };
  C.fail = e => {
    if (C.closed) return;
    if (!(e instanceof HttpError)) { console.log('ws error', e && e.stack || e); e = new HttpError(500, 'server', 'Server error'); }
    const say = SAY[e.code] || SAY.server;
    C.send(Object.assign({ type: 'error', code: e.code, status: e.status, zh: say[C.ui] || say.en, message: e.message }, e.extra));
    C.close(CLOSE[e.status] || 4500);
  };
  ws.addEventListener('message', ev => {
    const d = ev.data, n = typeof d === 'string' ? d.length : (d && d.byteLength) || 0;
    if (n > R.cfg.limits.wsMsgBytes) return C.fail(new HttpError(413, 'too_large', 'Message too large', { limit: R.cfg.limits.wsMsgBytes }));
    if (typeof d !== 'string') return;
    let m; try { m = JSON.parse(d); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'ping') return C.send({ type: 'pong' });
    if (C.authWait && m.type === 'auth') { const f = C.authWait; C.authWait = null; return f(String(m.token || '')); }
    if (C.onMsg) C.onMsg(m, d);
  });
  ws.addEventListener('close', () => C.close(1000));
  ws.addEventListener('error', () => C.close(1011));
  return C;
}
// token：网址里的 ?token=，没有就等第一条 {type:'auth'}
function getToken(R, C, qs) {
  const t = qs.get('token');
  if (t) return Promise.resolve(t);
  return new Promise((res, rej) => {
    const tm = setTimeout(() => { C.authWait = null; rej(new HttpError(408, 'timeout', 'No auth message')); }, R.cfg.talk.authWaitSec * 1000);
    C.authWait = tok => { clearTimeout(tm); res(tok); };
    C.onClose.push(() => clearTimeout(tm));
  });
}
const clock = R => () => R.now + (Date.now() - R.t0);

// ---------- /v1/talk ----------
// 按 id 拼人设：和 relay.js 一模一样的取法（quest 优先，其次 dyn + p，再次 npc）
export function npcFrom(qs) {
  if (qs.get('quest')) return questNpc(qs.get('quest'));
  if (qs.get('npc') === 'dyn') { const d = b64json(qs.get('p') || ''); return d ? CORE.personNpc(d) : null; }
  return npcById(qs.get('npc'));
}
// 其余参数也照 relay.js 的规矩收（名字只留字母数字空格、目标 0–9、级别只认 0–5、界面语言只认 talk-core 认得的、记忆再过一遍 memOf）
export function talkParams(qs) {
  const lvRaw = qs.get('lv');
  let memory = null;
  try { memory = CORE.memOf(b64json(qs.get('m') || '')); } catch (e) { memory = null; }
  return {
    player: (qs.get('name') || '').replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 16),
    goal: Math.max(0, Math.min(9, parseInt(qs.get('g'), 10) || 0)),
    level: lvRaw != null && /^[0-5]$/.test(lvRaw) ? +lvRaw : null,
    ui: CORE.uiOk(qs.get('ui') || ''),
    memory,
  };
}

async function talkRun(R, C, qs) {
  const U = await authUser(R, await getToken(R, C, qs));
  if (C.closed) return;
  requireConsent(R, U, 'talk');
  await wsLimit(R, U);
  const npc = npcFrom(qs);
  if (!npc) throw new HttpError(400, 'bad_request', 'Unknown islander', { field: 'npc' });
  const P = talkParams(qs), T = R.cfg.talk, now = clock(R);
  const id = randId('t_', 12), live = await talkOpen(R, U, id);
  if (!live.ok) throw new HttpError(409, 'conflict', 'Another talk session is open', { reason: 'live_session' });
  if (C.closed) return talkDrop(R, id);
  if (live.left < T.minStartSec) {
    await talkDrop(R, id);
    throw new HttpError(402, 'quota', 'Daily allowance used up', { meter: 'talk', limit: live.cap, used: Math.round(live.used), resetsAt: isoOrNull(resetAt(R.now, U.tz_min)) });
  }
  let up;
  try { up = await dsSocket(R, R.cfg.ds.talkModel); }
  catch (e) { await talkDrop(R, id).catch(() => {}); throw e; }
  if (C.closed) { try { up.close(); } catch (e) {} return talkDrop(R, id); }

  const left = live.left, limitSec = Math.min(T.sessionMaxSec, left), why = left <= T.sessionMaxSec ? 'daily' : 'session';
  const t0 = Date.now();
  let beatSec = 0, ended = false, warnT = null, hardT = null;
  const beat = setInterval(() => {
    const s = Math.min(left, (Date.now() - t0) / 1000);
    talkBeat(R, id, s, now()).then(() => { beatSec = s; }).catch(() => {});
  }, T.beatSec * 1000);
  // 发给阿里云的 session.update：音色按配置改名（国际版没有的音色）、转写模型按配置——默认都不改，和中转服务发的一字不差
  const patch = m => {
    if (m.type !== 'session.update' || !m.session) return m;
    const s = Object.assign({}, m.session), vm = R.cfg.ds.voiceMap;
    if (s.voice && vm && Object.prototype.hasOwnProperty.call(vm, s.voice)) s.voice = vm[s.voice];
    if (s.input_audio_transcription) s.input_audio_transcription = Object.assign({}, s.input_audio_transcription, { model: R.cfg.ds.talkAsrModel });
    return Object.assign({}, m, { session: s });
  };
  const evaluate = async (n, turns, o) => {
    const body = CORE.evalBody(n, turns, o);
    if (!body) return null;
    body.model = R.cfg.ds.evalModel;
    try { return CORE.parseEval(await dsPost(R, EVAL_PATH, body, 15000), o && o.ui); } catch (e) { return null; }
  };
  const S = CORE.session({
    npc, player: P.player, limitSec, leftSec: left, goal: P.goal, memory: P.memory, level: P.level, ui: P.ui,
    up: m => { if (!ended) try { up.send(JSON.stringify(patch(m))); } catch (e) {} },
    out: m => {
      if (m.type === 'ready') {
        m = Object.assign({}, m, { warnSec: T.warnSec });
        // 还剩 warnSec 秒时提醒一次（这段本来就不到 warnSec 秒的，一开始就提醒）
        warnT = setTimeout(() => C.send({ type: 'quota', warn: true, leftSec: Math.round(Math.min(T.warnSec, limitSec)), why }), Math.max(0, limitSec - T.warnSec) * 1000);
        hardT = setTimeout(() => C.close(1000), (limitSec + 45) * 1000);   // 保险：评价卡住也要收场
      }
      C.send(m);
    },
    evaluate,
    onEnd: ({ sec }) => {
      ended = true; clearInterval(beat); clearTimeout(warnT);
      try { up.close(1000, ''); } catch (e) {}
      const charge = Math.min(left, sec);
      R.ctx.waitUntil(talkClose(R, U, id, live.day, charge, beatSec).catch(e => console.log('talk charge failed', e.message)));
      setTimeout(() => { clearTimeout(hardT); C.close(1000); }, 300);
    },
  });
  up.addEventListener('message', e => { let m; try { m = JSON.parse(typeof e.data === 'string' ? e.data : ''); } catch (er) { return; } S.fromUp(m); });
  up.addEventListener('close', () => S.upClosed());
  up.addEventListener('error', () => S.upClosed());
  C.onMsg = m => { if (m.type !== 'auth') S.fromGame(m); };
  // 手机先断开：照样评价、记账。放进 waitUntil，客户端那条连接没了以后 Worker 也要把这几步做完
  C.onClose.push(() => R.ctx.waitUntil(Promise.resolve(S.finish()).catch(() => {})));
  S.start();
}

// ---------- /v1/asr-rt ----------
// 和 relay.js 的 /asr-rt 一样：只转发听写要用的三种消息，一次最多 ASR_RT_MAX_SEC 秒、约 15 秒的声音；每次连接算一次识别
async function asrRun(R, C, qs) {
  const q = []; let qn = 0;
  // 登录、连上游之前发来的先存着（最多存一次识别那么多的声音）
  C.onMsg = (m, raw) => { qn += raw.length; if (qn > R.cfg.asrRt.maxB64 + 65536) return C.fail(new HttpError(413, 'too_large', 'Too much audio before connecting', { limit: R.cfg.asrRt.maxB64 })); q.push(m); };
  const U = await authUser(R, await getToken(R, C, qs));
  if (C.closed) return;
  await wsLimit(R, U);
  const t = await take(R, U, 'asr');
  let up;
  try { up = await dsSocket(R, R.cfg.ds.asrRtModel); }
  catch (e) { await refund(R, U, t).catch(() => {}); throw e; }
  if (C.closed) { try { up.close(); } catch (e) {} return; }
  let bytes = 0;
  const end = () => { clearTimeout(kill); try { up.close(1000, ''); } catch (e) {} C.close(1000); };
  const kill = setTimeout(end, R.cfg.asrRt.maxSec * 1000);
  C.onClose.push(() => { clearTimeout(kill); try { up.close(1000, ''); } catch (e) {} });
  up.addEventListener('message', e => C.send(typeof e.data === 'string' ? e.data : ''));
  up.addEventListener('close', end);
  up.addEventListener('error', end);
  const fwd = m => {
    let out = null;
    if (m.type === 'session.update') {
      const td = (m.session && m.session.turn_detection) || {};
      out = { type: 'session.update', session: { modalities: ['text'], input_audio_format: 'pcm', sample_rate: 16000, input_audio_transcription: { language: 'en' },
        turn_detection: { type: 'server_vad', threshold: 0.2, silence_duration_ms: Math.max(300, Math.min(1200, +td.silence_duration_ms || 600)) } } };
    } else if (m.type === 'input_audio_buffer.append' && typeof m.audio === 'string') {
      bytes += m.audio.length; if (bytes > R.cfg.asrRt.maxB64) return end();
      out = { type: m.type, audio: m.audio };
    } else if (m.type === 'session.finish') out = { type: m.type };
    if (out) try { up.send(JSON.stringify(out)); } catch (e) {}
  };
  C.onMsg = fwd;
  q.splice(0).forEach(fwd);
}
