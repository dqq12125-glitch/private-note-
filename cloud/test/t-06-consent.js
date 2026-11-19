// 孩子账号和家长同意（email plus）：没同意前语音 AI 不能用 → 家长邮件 → 网页（打开不算、按按钮才算）→ 确认信 → 能用 → 撤回 → 又不能用
import { ok, eq } from './lib.js';

export default async function (C) {
  const { A, F } = C;
  const kid = await C.signup(A, { age: 'child', ui: 'zh' });
  let me = (await A.api('GET', '/v1/me', { token: kid.token })).json;
  ok(me.consent.required && me.consent.state === 'none' && !me.features.talk && !me.features.place && !me.features.steps, '孩子账号：要家长同意，talk / place / steps 都关着', me.consent);
  const pl = await A.api('POST', '/v1/place', { token: kid.token, body: { id: 'x', heard: 'hello there' } });
  eq([pl.status, pl.json.error, pl.json.need, pl.json.feature], [403, 'consent', 'parent', 'place'], '检测的自由回答判分：403 consent');
  const st = await A.api('POST', '/v1/steps', { token: kid.token, body: { npc: 'dyn', nm: 'Mia', turns: [{ who: 'you', text: 'hello my friend' }] } });
  eq([st.status, st.json.feature], [403, 'steps'], '聊天打勾：403 consent');
  const asr = await A.api('POST', '/v1/asr', { token: kid.token, body: { audio: 'A'.repeat(1200) } });
  eq(asr.status, 200, '读句子的识别（打分用）：不挡');
  const none = await C.signup(A);
  const pn = await A.api('POST', '/v1/place', { token: none.token, body: { id: 'x', heard: 'hello there' } });
  eq([pn.status, pn.json.need], [403, 'age'], '没设年龄段：403 consent need=age');

  const teen = await C.signup(A, { age: 'teen' });
  eq((await A.api('POST', '/v1/consent/request', { token: teen.token, body: { parentEmail: 'p@example.test' } })).json.reason, 'not_child', '不是孩子账号要同意：409 not_child');
  eq((await A.api('POST', '/v1/consent/request', { token: kid.token, body: { parentEmail: kid.email } })).json.field, 'parentEmail', '家长邮箱不能和账号邮箱一样：400');
  const parent = C.uniq('parent'), n0 = F.mails.length;
  const rq = await A.api('POST', '/v1/consent/request', { token: kid.token, body: { parentEmail: parent } });
  ok(rq.status === 200 && rq.json.consent.state === 'pending' && rq.json.consent.parentEmail === parent.replace(/^(.)[^@]*/, '$1***'), '发给家长：pending，家长邮箱只显示一部分', rq.json);
  const mail = F.mails.slice(n0).find(m => m.to[0] === parent);
  const link = mail && /(https?:\/\/\S+\/v1\/consent\/c\/[A-Za-z0-9_-]{43})/.exec(mail.text)[1];
  ok(mail && link && /回声岛/.test(mail.text) && /Echo Island/.test(mail.text) && /Echo of Forest Pty Ltd/.test(mail.text), '家长邮件：中英文、公司名、同意链接', mail && mail.subject);
  const path = new URL(link).pathname;
  const page = await A.api('GET', path);
  ok(page.status === 200 && /I agree/.test(page.text) && /我同意/.test(page.text) && /method="post"/.test(page.text) && /Alibaba Cloud/.test(page.text) && /90 天/.test(page.text), '同意页：中英文、说清楚收集什么、有按钮', page.status);
  me = (await A.api('GET', '/v1/me', { token: kid.token })).json;
  eq(me.consent.state, 'pending', '只是打开链接（邮箱扫描也会打开）：不算同意');
  const n1 = F.mails.length;
  const agree = await A.api('POST', path, { raw: '', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  ok(agree.status === 200 && /谢谢/.test(agree.text), '按「我同意」：谢谢页');
  const done = F.mails.slice(n1).find(m => m.to[0] === parent);
  const rlink = done && /(https?:\/\/\S+\/v1\/consent\/r\/[A-Za-z0-9_-]{43})/.exec(done.text)[1];
  ok(done && rlink, '再给家长发一封确认信，带撤回链接（email plus）', done && done.subject);
  me = (await A.api('GET', '/v1/me', { token: kid.token })).json;
  ok(me.consent.state === 'granted' && me.consent.grantedAt && me.features.talk && me.features.place, '记下同意时间，语音 AI 打开', me.consent);
  const row = await A.one('SELECT granted_at, token_hash FROM consents WHERE user_id = ?1', kid.me.id);
  ok(row.granted_at > 0 && row.token_hash.length === 64 && !row.token_hash.includes(path.split('/').pop()), '库里存的是链接的哈希，不是链接');
  const NPCS = (await import('../../talk-npcs.js')).default;
  const c = await A.ws('/v1/talk?npc=' + NPCS.list[0].id, { first: kid.token });
  ok(await c.next(m => m.type === 'ready'), '同意以后孩子能聊了');
  c.send({ type: 'end' }); await c.done;
  eq((await A.api('POST', '/v1/consent/request', { token: kid.token, body: { parentEmail: parent } })).json.reason, 'granted', '已经同意过再发：409 granted');
  const raise = await A.api('PATCH', '/v1/me', { token: kid.token, body: { ageGroup: 'teen' } });
  eq(raise.status, 200, '家长同意过的孩子可以改大年龄段');
  await A.api('PATCH', '/v1/me', { token: kid.token, body: { ageGroup: 'child' } });
  // 撤回
  const rpath = new URL(rlink).pathname;
  const rp = await A.api('GET', rpath);
  ok(rp.status === 200 && /撤回/.test(rp.text), '撤回页：打开只是问一下');
  eq((await A.api('GET', '/v1/consent', { token: kid.token })).json.consent.state, 'granted', '打开撤回页不算撤回');
  await A.api('POST', rpath, { raw: '' });
  const s2 = (await A.api('GET', '/v1/consent', { token: kid.token })).json;
  ok(s2.consent.state === 'revoked' && !s2.features.talk, '按「撤回」：revoked，又不能聊了', s2);
  const c2 = await A.ws('/v1/talk?npc=' + NPCS.list[0].id, { first: kid.token });
  const e2 = await c2.next(m => m.type === 'error');
  eq(e2 && e2.code, 'consent', '撤回以后 talk：consent');
  eq((await A.api('GET', path)).status, 404, '撤回以后旧的同意链接失效');
  eq((await A.api('GET', '/v1/consent/c/' + 'x'.repeat(43))).status, 404, '乱写的链接：404 页');
}
