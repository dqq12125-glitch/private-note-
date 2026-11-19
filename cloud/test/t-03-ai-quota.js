// 按次计的 AI 调用（/asr /tip /tts /zh /steps /place）：和中转服务一样的请求和回答、计数、到上限 402、上游失败退回、
// 按用户时区零点重置、每分钟限流
import { ok, eq } from './lib.js';

const DAY = 86400000;
export default async function (C) {
  const { A, F } = C;
  const U = await C.signup(A, { age: 'adult' });
  const tk = U.token, me0 = (await A.api('GET', '/v1/me', { token: tk })).json;
  eq([me0.quota.talk.limitSec, me0.quota.asr.limit, me0.quota.aux.limit], [300, 400, 300], '免费档：每天聊 5 分钟、识别 400 段、别的 300 次');

  const h0 = F.http.length;
  const audio = 'UklGR' + 'A'.repeat(2000);
  const asr = await A.api('POST', '/v1/asr', { token: tk, body: { audio } });
  eq([asr.status, asr.json.text, asr.json.quota], [200, 'I like apples', { meter: 'asr', left: 399 }], '/v1/asr：听写结果 + 还剩 399');
  const up = F.http[h0];
  ok(up.headers.authorization === 'Bearer sk-fake-cloud-key' && up.body.model === 'qwen3-asr-flash' && up.body.messages[0].content[0].input_audio.data === 'data:audio/wav;base64,' + audio && up.body.asr_options.language === 'en',
    '/v1/asr 发给上游：密钥在服务器这边、模型按配置、不带答案', up.body.model);
  eq((await A.api('POST', '/v1/asr', { token: tk, body: { audio: 'short' } })).status, 400, '/v1/asr 声音太短：400（不扣次数）');
  const tip = await A.api('POST', '/v1/tip', { token: tk, body: { target: 'I like apples.', heard: 'I like apple', ui: 'en' } });
  ok(tip.status === 200 && tip.json.tip === 'Say "apple" clearly.' && tip.json.quota.meter === 'aux', '/v1/tip：一句点评', tip.json);
  const tipUp = F.http[F.http.length - 1].body;
  ok(tipUp.model === 'qwen-plus' && /pronunciation/.test(tipUp.messages[0].content) && tipUp.messages[0].content.includes('I like apples.'), '/v1/tip 的提示词由 talk-core 拼（英文界面）');
  const tts = await A.api('POST', '/v1/tts', { token: tk, body: { text: 'Hello there', g: 'm' } });
  ok(tts.status === 200 && tts.json.url === 'https://dashscope-result.example/audio.wav', '/v1/tts：音频地址（http 换成 https）', tts.json);
  const ttsUp = F.http[F.http.length - 1].body;
  ok(ttsUp.model === 'qwen3-tts-flash' && ttsUp.input.voice === 'Ethan' && ttsUp.input.language_type === 'English', '/v1/tts：男声 Ethan、英文', ttsUp.input);
  const zh = await A.api('POST', '/v1/zh', { token: tk, body: { text: 'Hello!' } });
  eq([zh.status, zh.json.zh], [200, '你好'], '/v1/zh：翻成中文');
  const st = await A.api('POST', '/v1/steps', { token: tk, body: { npc: 'dyn', nm: 'Mia', g: 0, turns: [{ who: 'npc', text: 'Hi!' }, { who: 'you', text: 'Hello Mia, nice to meet you.' }] } });
  eq([st.status, st.json.done], [200, [0, 2]], '/v1/steps：打勾的步骤（1 起的编号换成 0 起）');
  const typed = await A.api('POST', '/v1/steps', { token: tk, body: { npc: 'dyn', nm: 'Mia', turns: [{ who: 'you', text: 'hello', typed: true }] } });
  eq([typed.status, typed.json.done, typed.json.quota], [200, [], undefined], '/v1/steps 只打了字：直接回空，不问 AI、不扣次数');
  eq((await A.api('POST', '/v1/steps', { token: tk, body: { npc: 'constructor', turns: [{ who: 'you', text: 'hi there friend' }] } })).json.field, 'npc', '/v1/steps 不认识的岛民（包括 constructor 这种键）：400');
  const PLACE = (await import('../../placement-data.js')).default;
  const item = PLACE.en.items.find(x => x.skill === 'speak' && x.kind === 'answer');
  const pl = await A.api('POST', '/v1/place', { token: tk, body: { id: item.id, heard: 'I usually go to school by bus.' } });
  eq([pl.status, pl.json.score], [200, 2], '/v1/place：按题目 id 查评分要点，判 0/1/2');
  ok(F.http[F.http.length - 1].body.messages[0].content.includes(item.rubric.slice(0, 40)), '/v1/place 的评分要点是服务器从题库里查的');
  eq((await A.api('POST', '/v1/place', { token: tk, body: { id: 'nope', heard: 'x y z' } })).json.field, 'id', '/v1/place 没有这道题：400');
  let use = await A.one('SELECT asr_n, aux_n FROM usage WHERE user_id = ?1', U.me.id);
  eq([use.asr_n, use.aux_n], [1, 5], 'D1 里的计数：识别 1、别的 5（tip/tts/zh/steps/place）');

  // 上游失败：503 provider，退回这一次
  const fail = await A.api('POST', '/v1/zh', { token: tk, body: { text: 'failupstream please' } });
  eq([fail.status, fail.json.error, fail.json.up], [503, 'provider', 'Throttling'], '上游报错：503 provider，带上游的错误代码');
  use = await A.one('SELECT aux_n FROM usage WHERE user_id = ?1', U.me.id);
  eq(use.aux_n, 5, '上游失败的那一次不算');

  // 到上限：402
  await A.run('UPDATE usage SET asr_n = 400 WHERE user_id = ?1', U.me.id);
  const over = await A.api('POST', '/v1/asr', { token: tk, body: { audio } });
  ok(over.status === 402 && over.json.error === 'quota' && over.json.meter === 'asr' && over.json.limit === 400 && over.json.resetsAt, '识别到 400 段：402 quota（meter asr、resetsAt）', over.json);

  // 零点重置：按用户自己的时区（悉尼 +10:00）
  const V = await C.signup(A, { tz: 600, age: 'adult' });
  const localMid = Math.floor((Date.now() + 600 * 60000) / DAY + 1) * DAY - 600 * 60000;   // 下一个悉尼零点（UTC 时刻）
  const before = localMid - 30000, after = localMid + 5000;
  const meB = (await A.api('GET', '/v1/me', { token: V.token, now: before })).json;
  eq(meB.quota.resetsAt, new Date(localMid).toISOString(), 'resetsAt = 下一个本地零点');
  await A.run('INSERT INTO usage (user_id, day, aux_n) VALUES (?1, ?2, 300)', V.me.id, meB.quota.day);
  const z1 = await A.api('POST', '/v1/zh', { token: V.token, body: { text: 'Hi' }, now: before });
  eq([z1.status, z1.json.meter], [402, 'aux'], '零点前 30 秒：额度用完 402');
  const z2 = await A.api('POST', '/v1/zh', { token: V.token, body: { text: 'Hi' }, now: after });
  eq([z2.status, z2.json.quota && z2.json.quota.left], [200, 299], '本地零点过 5 秒：重新有额度');
  const meA = (await A.api('GET', '/v1/me', { token: V.token, now: after })).json;
  ok(meA.quota.day > meB.quota.day && meA.quota.aux.used === 1, '新的一天的用量另起一行', [meB.quota.day, meA.quota.day]);

  // 每分钟限流（测试配置：每个账号每分钟 20 次 AI 调用）
  const W = await C.signup(A, { age: 'adult' });
  const rs = [];
  for (let i = 0; i < 26; i++) rs.push(await A.api('POST', '/v1/zh', { token: W.token, body: { text: 'Hi ' + i } }));
  const codes = rs.map(r => r.status), first429 = rs.find(r => r.status === 429);
  ok(codes.slice(0, 5).every(c => c === 200) && first429 && first429.json.error === 'rate' && first429.json.retryAfter > 0, '同一个账号一分钟内太多次 AI 调用：429 rate', codes.join(','));
  const usedW = (await A.one('SELECT aux_n FROM usage WHERE user_id = ?1', W.me.id)).aux_n;
  eq(usedW, codes.filter(c => c === 200).length, '被限流挡下的不算次数');
}
