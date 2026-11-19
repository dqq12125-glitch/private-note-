// 举报：存最后几句、管理口令才能看、每天有上限；每天的定时任务把 90 天前的删掉（顺便删过期的会话、登录码、限流计数、老用量）
import { ok, eq } from './lib.js';

const DAY = 86400000;
export default async function (C) {
  const { A, B } = C;
  const U = await C.signup(A, { age: 'teen' });
  const turns = Array.from({ length: 12 }, (_, i) => ({ who: i % 2 ? 'you' : 'npc', text: 'line ' + i + (i === 11 ? ' ' + 'x'.repeat(900) : '') }));
  const r = await A.api('POST', '/v1/report', { token: U.token, body: { npc: 't0-anna', quest: null, reason: 'scary', note: 'It said something scary', turns } });
  ok(r.status === 200 && r.json.ok && /^r_/.test(r.json.id), '举报：200，有 id', r.json);
  eq((await A.api('POST', '/v1/report', { token: U.token, body: { turns: [] } })).status, 400, '没有内容的举报：400');
  const row = await A.one('SELECT * FROM reports WHERE id = ?1', r.json.id);
  const saved = JSON.parse(row.turns);
  ok(saved.length === 8 && saved[0].text === 'line 4' && saved[7].text.length === 500 && row.age_group === 'teen' && row.reason === 'scary', '只存最后 8 句、每句最多 500 字、记年龄段', { n: saved.length });
  const noTok = await A.api('GET', '/v1/admin/reports');
  eq([noTok.status, noTok.json.reason], [401, 'admin'], '看举报不带管理口令：401');
  eq((await A.api('GET', '/v1/admin/reports', { headers: { Authorization: 'Bearer wrong' } })).status, 401, '管理口令不对：401');
  eq((await A.api('GET', '/v1/admin/reports', { token: U.token })).status, 401, '用户的 token 看不了举报');
  eq((await B.api('GET', '/v1/admin/reports', { headers: { Authorization: 'Bearer anything' } })).status, 401, '没配 ADMIN_TOKEN：谁都看不了');
  const list = await A.api('GET', '/v1/admin/reports?limit=10', { headers: { Authorization: 'Bearer admin-test-token' } });
  const mine = list.json && list.json.reports.find(x => x.id === r.json.id);
  ok(list.status === 200 && mine && mine.turns.length === 8 && mine.npc === 't0-anna' && mine.reason === 'scary' && mine.userId === U.me.id, '管理口令对：列出举报和那几句', mine);
  // 每天最多 3 次（测试配置）
  const more = [];
  for (let i = 0; i < 3; i++) more.push((await A.api('POST', '/v1/report', { token: U.token, body: { turns: [{ who: 'npc', text: 'x' }] } })).status);
  eq(more, [200, 200, 429], '一天第 4 次举报：429');

  // 定时任务：90 天前的举报删掉，90 天内的留着
  const old = await A.api('POST', '/v1/report', { token: (await C.signup(A)).token, body: { turns: [{ who: 'npc', text: 'old one' }] }, now: Date.now() - 91 * DAY });
  const today = new Date().toISOString().slice(0, 10);
  await A.run('INSERT INTO usage (user_id, day, asr_n) VALUES (?1, ?2, 5)', U.me.id, '2020-01-01');
  await A.run('INSERT INTO talk_live (id, user_id, day, started_at, beat_at, sec) VALUES (?1, ?2, ?3, ?4, ?4, 12)', 't_cron', U.me.id, today, Date.now() - 3600000);
  const w = await A.mf.getWorker();
  await w.scheduled({ scheduledTime: new Date(), cron: '17 3 * * *' });
  ok(!(await A.one('SELECT 1 AS x FROM reports WHERE id = ?1', old.json.id)) && await A.one('SELECT 1 AS x FROM reports WHERE id = ?1', r.json.id), '定时任务：91 天前的举报删了，今天的还在');
  ok(!(await A.one('SELECT 1 AS x FROM usage WHERE day = ?1', '2020-01-01')), '定时任务：40 天前的用量删了');
  const folded = await A.one('SELECT talk_sec FROM usage WHERE user_id = ?1 AND day = ?2', U.me.id, today);
  ok(folded && folded.talk_sec === 12 && !(await A.one('SELECT 1 AS x FROM talk_live WHERE id = ?1', 't_cron')), '定时任务：断掉的聊天按最后进度记账后删掉', folded);
  await w.scheduled({ scheduledTime: new Date(Date.now() + 91 * DAY), cron: '17 3 * * *' });
  eq((await A.one('SELECT COUNT(*) AS n FROM reports')).n, 0, '91 天以后：所有举报都删了');
  eq((await A.one('SELECT COUNT(*) AS n FROM email_codes')).n, 0, '过期的登录码删了');
  eq((await A.one('SELECT COUNT(*) AS n FROM rl')).n, 0, '过期的限流计数删了');
  const sess = await A.one('SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?1', Date.now() + 91 * DAY);
  eq(sess.n, 0, '91 天后已经过期的会话删了');
}
