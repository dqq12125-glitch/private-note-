// WebSocket：/v1/talk（实时语音聊天，按墙钟秒数计、额度用完前提醒、到点正常收尾）和 /v1/asr-rt（实时识别）
import { ok, eq, sleep, until } from './lib.js';

const npcQ = 'npc=' + encodeURIComponent('NPCID') + '&g=1&ui=en&name=Kai';
export default async function (C) {
  const { A, B, F } = C;
  const NPCS = (await import('../../talk-npcs.js')).default;
  const nid = NPCS.list[0].id, q = npcQ.replace('NPCID', nid);
  const adult = await C.signup(A, { age: 'adult' });
  const lastUp = () => F.ws[F.ws.length - 1];

  // ---------- 一段完整的聊天 ----------
  const w0 = F.ws.length;
  const c = await A.ws('/v1/talk?' + q, { first: adult.token });
  const ready = await c.next(m => m.type === 'ready' || m.type === 'error');
  ok(ready && ready.type === 'ready' && ready.npc === nid && ready.leftSec === 300 && ready.sessionSec === 300 && ready.warnSec === 2, '第一条消息 auth → ready（今天还剩 300 秒、这段最长 300 秒、提前 2 秒提醒）', ready);
  const upc = F.ws[w0];
  ok(upc && upc.auth === 'Bearer sk-fake-cloud-key' && upc.model === 'qwen3.8-omni-flash-realtime', '连上游：密钥在服务器这边，模型按配置', upc && { model: upc.model });
  const su = upc && upc.msgs.find(m => m.type === 'session.update');
  ok(su && su.session.instructions.startsWith(NPCS.list[0].persona) && su.session.voice === NPCS.list[0].voice && su.session.input_audio_transcription.model === 'qwen3-asr-flash-realtime', '人设、音色由服务器按 npc id 拼', su && su.session.voice);
  await c.next(m => m.type === 'npc_done');
  c.send({ type: 'audio', data: 'A'.repeat(16000) });
  c.send({ type: 'commit' });
  const you = await c.next(m => m.type === 'you');
  eq(you && you.text, F.transcript, '说话 → 识别结果（type you）');
  await c.next(m => m.type === 'npc_done' && c.msgs.filter(x => x.type === 'npc_done').length >= 2);
  c.send({ type: 'ping' });
  ok(await c.next(m => m.type === 'pong'), 'ping → pong');
  c.send({ type: 'end', steps: [true, false, false] });
  const ev = await c.next(m => m.type === 'eval', 8000);
  ok(ev && ev.eval && typeof ev.sec === 'number' && ev.left <= 300, '结束 → 评价（eval）', ev);
  const cl = await c.done;
  eq(cl.code, 1000, '评价发完正常关闭（1000）');
  const used = await until(async () => { const r = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1', adult.me.id); return r && r.talk_sec > 0 && r; }, 3000);
  const live = await A.one('SELECT COUNT(*) AS n FROM talk_live WHERE user_id = ?1', adult.me.id);
  ok(used && used.talk_sec > 0 && used.talk_sec < 30 && live.n === 0, '记账：用了几秒、正在聊的那一行删掉了', { used, live });
  const evalReq = F.http.filter(h => h.body && /gentle, encouraging feedback/.test(String(h.body.messages && h.body.messages[0].content))).pop();
  ok(evalReq && evalReq.body.model === 'qwen-plus', '聊完的评价走配置的文字模型（英文界面 → 英文评语）');

  // 手机突然断开（没发 end）：照样记账、删掉「正在聊」
  const D = await C.signup(A, { age: 'adult' });
  const cd = await A.ws('/v1/talk?' + q, { first: D.token });
  await cd.next(m => m.type === 'npc_done');
  cd.ws.terminate();
  const ud = await until(async () => { const r = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1', D.me.id); const l = await A.one('SELECT COUNT(*) AS n FROM talk_live WHERE user_id = ?1', D.me.id); return r && r.talk_sec > 0 && l.n === 0 && r; }, 5000);
  ok(ud, '手机突然断开：照样按秒记账，「正在聊」那一行删掉', ud);

  // ---------- 登录方式和出错 ----------
  const c2 = await A.ws('/v1/talk?' + q, { token: adult.token });
  ok(await c2.next(m => m.type === 'ready'), '网址里的 ?token= 也行');
  c2.send({ type: 'end' }); await c2.done;
  const c3 = await A.ws('/v1/talk?' + q);
  const e3 = await c3.next(m => m.type === 'error', 4000); const d3 = await c3.done;
  eq([e3 && e3.code, d3.code], ['timeout', 4408], '一直不发 auth：error timeout，关闭码 4408');
  const c4 = await A.ws('/v1/talk?' + q, { first: 'eis_' + 'y'.repeat(43) });
  const e4 = await c4.next(m => m.type === 'error'); const d4 = await c4.done;
  ok(e4 && e4.code === 'auth' && e4.status === 401 && d4.code === 4401 && e4.zh === 'Please sign in again.', '错的 token：error auth（按界面语言的一句话）、4401', e4);
  const c5 = await A.ws('/v1/talk?npc=nobody&ui=zh', { first: adult.token });
  const e5 = await c5.next(m => m.type === 'error'); const d5 = await c5.done;
  ok(e5 && e5.code === 'bad_request' && e5.field === 'npc' && d5.code === 4400 && e5.zh === '没有这个岛民', '没有这个岛民：bad_request、4400', e5);
  // 同一个账号同时两段：第二段 409
  const c6 = await A.ws('/v1/talk?' + q, { first: adult.token });
  await c6.next(m => m.type === 'ready');
  const c7 = await A.ws('/v1/talk?' + q, { first: adult.token });
  const e7 = await c7.next(m => m.type === 'error'); const d7 = await c7.done;
  ok(e7 && e7.code === 'conflict' && e7.reason === 'live_session' && d7.code === 4409, '同时开第二段：conflict live_session、4409', e7);
  // 消息太大：4413
  c6.send({ type: 'audio', data: 'A'.repeat(300000) });
  const e6 = await c6.next(m => m.type === 'error'); const d6 = await c6.done;
  ok(e6 && e6.code === 'too_large' && d6.code === 4413, '一条消息超过 256 KB：too_large、4413', e6);
  await sleep(300);
  // 孩子 / 没设年龄段：没有家长同意不能聊
  const kid = await C.signup(A, { age: 'child' }), none = await C.signup(A);
  const k1 = await A.ws('/v1/talk?' + q, { first: kid.token });
  const ek = await k1.next(m => m.type === 'error'); const dk = await k1.done;
  ok(ek && ek.code === 'consent' && ek.need === 'parent' && dk.code === 4403, '孩子账号没有家长同意：consent need=parent、4403', ek);
  const k2 = await A.ws('/v1/talk?' + q, { first: none.token });
  const en = await k2.next(m => m.type === 'error');
  ok(en && en.code === 'consent' && en.need === 'age', '还没设年龄段：consent need=age', en);
  // 上游连不上：provider、4503，不记账
  const P = await C.signup(A, { age: 'adult' });
  F.refuseWs = true;
  const c8 = await A.ws('/v1/talk?' + q, { first: P.token });
  const e8 = await c8.next(m => m.type === 'error'); const d8 = await c8.done;
  F.refuseWs = false;
  ok(e8 && e8.code === 'provider' && d8.code === 4503, '阿里云连不上：provider、4503', e8);
  const p8 = await A.one('SELECT COUNT(*) AS n FROM talk_live WHERE user_id = ?1', P.me.id), pu = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1', P.me.id);
  ok(p8.n === 0 && !pu, '连不上的那次：不记账、不留「正在聊」');

  // ---------- 额度快用完：提前提醒，到点正常收尾 ----------
  const Q = await C.signup(A, { age: 'adult' });
  const meQ = (await A.api('GET', '/v1/me', { token: Q.token })).json;
  await A.run('INSERT INTO usage (user_id, day, talk_sec) VALUES (?1, ?2, 295)', Q.me.id, meQ.quota.day);
  const t0 = Date.now();
  const cq = await A.ws('/v1/talk?' + q, { first: Q.token });
  const rq = await cq.next(m => m.type === 'ready');
  eq([rq && rq.leftSec, rq && rq.sessionSec], [5, 5], '今天只剩 5 秒：ready 说 leftSec 5、sessionSec 5');
  const warn = await cq.next(m => m.type === 'quota', 6000), tw = Date.now() - t0;
  ok(warn && warn.warn === true && warn.why === 'daily' && warn.leftSec === 2 && tw > 2000 && tw < 4500, '还剩 2 秒（warnSec）时提醒：type quota、why daily', { warn, tw });
  const beatRow = await A.one('SELECT sec FROM talk_live WHERE user_id = ?1', Q.me.id);
  ok(beatRow && beatRow.sec >= 1, '聊天中按 TALK_BEAT_SEC 把进度写进 D1（断了也能按进度记账）', beatRow);
  const lim = await cq.next(m => m.type === 'limit', 6000);
  ok(lim && lim.zh === 'Chat time is up for today. Let\'s talk again tomorrow!', '到点：limit（按界面语言，talk-core 的那句）', lim);
  const evq = await cq.next(m => m.type === 'eval', 6000); const dq = await cq.done;
  ok(evq && dq.code === 1000, '然后照样给评价、正常关闭', dq);
  const uq = await until(async () => { const r = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1', Q.me.id); return r && r.talk_sec > 295 && r; }, 3000);
  ok(uq && uq.talk_sec <= 300.01, '记账不超过每天的上限（' + (uq && uq.talk_sec.toFixed(2)) + ' 秒）', uq);
  const cq2 = await A.ws('/v1/talk?' + q, { first: Q.token });
  const eq2 = await cq2.next(m => m.type === 'error'); const dq2 = await cq2.done;
  ok(eq2 && eq2.code === 'quota' && eq2.meter === 'talk' && dq2.code === 4402 && eq2.resetsAt, '用完了再开：quota、4402', eq2);
  const meQ2 = (await A.api('GET', '/v1/me', { token: Q.token })).json;
  eq(meQ2.quota.talk.leftSec, 0, 'me 里聊天剩 0 秒');

  // ---------- 断掉的聊天（Worker 被停掉、心跳不再更新）：按最后一次进度记账 ----------
  const S = await C.signup(A, { age: 'adult' });
  const dayS = (await A.api('GET', '/v1/me', { token: S.token })).json.quota.day;
  await A.run('INSERT INTO talk_live (id, user_id, day, started_at, beat_at, sec) VALUES (?1, ?2, ?3, ?4, ?4, 40)', 't_stale', S.me.id, dayS, Date.now() - 600000);
  const cs = await A.ws('/v1/talk?' + q, { first: S.token });
  const rs = await cs.next(m => m.type === 'ready');
  eq(rs && rs.leftSec, 260, '断掉的那段按最后进度（40 秒）记上，再开新的一段（还剩 260 秒）');
  cs.send({ type: 'end' }); await cs.done;

  // ---------- 每段最长（B：TALK_SESSION_MAX_SEC = 3）----------
  const M = await C.signup(B, { age: 'adult' });
  const cm = await B.ws('/v1/talk?' + q, { first: M.token });
  const rm = await cm.next(m => m.type === 'ready');
  eq([rm && rm.leftSec, rm && rm.sessionSec], [300, 3], '每段最长 3 秒：sessionSec 3');
  const wm = await cm.next(m => m.type === 'quota', 4000);
  eq(wm && wm.why, 'session', '这一段要到了（不是每天的额度）：why session');
  const lm = await cm.next(m => m.type === 'limit', 5000);
  ok(lm && /long chat/.test(lm.zh), '到点说「聊得够久了」', lm);
  await cm.done;

  // ---------- /v1/asr-rt ----------
  const R = await C.signup(A);   // 年龄段没设也能用：读句子的识别不算「自由对话」
  const n0 = F.ws.length;
  const ra = await A.ws('/v1/asr-rt', { first: R.token });
  ra.send({ type: 'session.update', session: { turn_detection: { silence_duration_ms: 50 }, instructions: 'EVIL', modalities: ['audio'] } });
  ra.send({ type: 'input_audio_buffer.append', audio: 'AAAA' });
  ra.send({ type: 'conversation.item.create', item: 'EVIL' });
  ra.send({ type: 'session.finish' });
  const tr = await ra.next(m => m.type === 'conversation.item.input_audio_transcription.text');
  const fin = await ra.next(m => m.type === 'session.finished');
  ok(tr && tr.text === 'hello' && fin, '实时识别：上游的事件原样转给手机', tr);
  const ru = F.ws[n0];
  ok(ru && ru.model === 'qwen3-asr-flash-realtime' && ru.msgs.length === 3 && ru.msgs[0].session.turn_detection.silence_duration_ms === 300 && !JSON.stringify(ru.msgs).includes('EVIL'),
    '只转发三种消息、停顿夹在 300–1200 毫秒、别的字段一概不要', ru && ru.msgs.map(m => m.type));
  await ra.done;
  eq((await A.one('SELECT asr_n FROM usage WHERE user_id = ?1', R.me.id)).asr_n, 1, '一次实时识别算一段');
  F.refuseWs = true;
  const rb = await A.ws('/v1/asr-rt', { first: R.token });
  const eb = await rb.next(m => m.type === 'error'); await rb.done;
  F.refuseWs = false;
  ok(eb && eb.code === 'provider', '实时识别连不上：provider', eb);
  eq((await A.one('SELECT asr_n FROM usage WHERE user_id = ?1', R.me.id)).asr_n, 1, '连不上的那次退回');
  lastUp();
}
