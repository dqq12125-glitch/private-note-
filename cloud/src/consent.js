// 家长同意（「email plus」）：孩子账号填家长邮箱 → 给家长发链接 → 家长在网页上点「同意」→ 记下时间、再发一封确认信（带撤回链接）。
// 打开链接（GET）什么都不改：邮箱的安全扫描会自动打开链接；只有按按钮（POST）才算。API.md §5
import { HttpError, bad, rand, b64url, sha256hex, normEmail, isoOrNull } from './util.js';
import { hitD1 } from './ratelimit.js';
import { send, consentMail, consentDoneMail, esc } from './email.js';
import { consentView, features } from './me.js';

const DAY = 86400000;
const base = R => R.cfg.publicUrl || R.url.origin;

export async function consentRequest(R, U, body) {
  if (U.age_group !== 'child') throw new HttpError(409, 'conflict', 'Only child accounts need parent consent', { reason: 'not_child' });
  if (U.c_state === 'granted') throw new HttpError(409, 'conflict', 'Consent already granted', { reason: 'granted' });
  const parent = normEmail(body.parentEmail);
  if (!parent) throw bad('parentEmail', 'Not a valid email address');
  if (U.email && parent === U.email) throw bad('parentEmail', 'The parent email must be different from the account email');
  await hitD1(R, 'consent', U.id, R.cfg.rate.consentPerUserDay, 86400);
  const token = b64url(rand(32)), exp = R.now + R.cfg.consentLinkDays * DAY;
  await R.env.DB.prepare('INSERT INTO consents (user_id, parent_email, state, token_hash, requested_at, expires_at) VALUES (?1, ?2, \'pending\', ?3, ?4, ?5) ' +
    'ON CONFLICT(user_id) DO UPDATE SET parent_email = excluded.parent_email, state = \'pending\', token_hash = excluded.token_hash, revoke_hash = NULL, requested_at = excluded.requested_at, expires_at = excluded.expires_at, granted_at = NULL, revoked_at = NULL')
    .bind(U.id, parent, await sha256hex(token), R.now, exp).run();
  await send(R, Object.assign({ to: parent, tag: 'consent' }, consentMail(R.cfg.company, base(R) + '/v1/consent/c/' + token)));
  Object.assign(U, { c_state: 'pending', c_parent: parent, c_req: R.now, c_exp: exp, c_granted: null });
  return { consent: consentView(U, R.now) };
}

export const consentStatus = (R, U) => ({ consent: consentView(U, R.now), features: features(R, U) });

// ---------- 家长看的网页（中英文，很小） ----------
const page = (title, body, status) => new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(title) + '</title>' +
  '<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#f4f8fb;color:#1d2b36}main{max-width:640px;margin:0 auto;padding:16px}section{background:#fff;border-radius:14px;padding:14px 18px;margin:12px 0}h1{font-size:22px}h2{font-size:17px;margin:4px 0}li{margin:4px 0}button{font:inherit;font-weight:700;border:0;border-radius:12px;padding:12px 22px;background:#1f7a5a;color:#fff;cursor:pointer}button.no{background:#8a3b2b}.t{color:#5b6b78;font-size:14px}</style>' +
  '</head><body><main>' + body + '</main></body></html>', { status: status || 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });

function explain(R) {
  const c = esc(R.cfg.company), priv = R.cfg.privacyUrl ? '<p class="t"><a href="' + esc(R.cfg.privacyUrl) + '">Privacy policy / 隐私政策</a></p>' : '';
  return '<section><h2>What you are agreeing to</h2><ul>' +
    '<li>Your child can talk by voice with the AI characters in <b>Echo Island</b>, an English speaking game by ' + c + '.</li>' +
    '<li>While they talk, their voice and words go to our AI provider (Alibaba Cloud Model Studio, Singapore region) to be understood and answered. We do not keep recordings or chat logs.</li>' +
    '<li>We keep only: the account email, the age group (not the birth date), how many minutes of AI were used each day, your email and the time you agreed.</li>' +
    '<li>If your child presses <b>Report</b> on an AI message, the last few lines of that chat are kept for up to 90 days so we can check it.</li>' +
    '<li>You can withdraw this at any time (the confirmation email has the link), and the account can be deleted in the app.</li></ul></section>' +
    '<section><h2>您同意的是什么</h2><ul>' +
    '<li>孩子可以在「回声岛」（' + c + ' 出品的英语口语游戏）里用语音和 AI 角色对话。</li>' +
    '<li>对话时，孩子的声音和说的话会发给我们的 AI 服务商（阿里云百炼，新加坡）来听懂和回答。我们不保存录音，也不保存聊天记录。</li>' +
    '<li>我们只保存：账号邮箱、年龄段（不是生日）、每天用了几分钟 AI、您的邮箱和您同意的时间。</li>' +
    '<li>如果孩子在某句 AI 的话上按了「举报」，那段对话的最后几句会保存最多 90 天，供我们检查。</li>' +
    '<li>您随时可以撤回同意（确认邮件里有链接），也可以在 App 里删除整个账号。</li></ul></section>' + priv;
}

async function findBy(R, col, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) return null;
  return R.env.DB.prepare('SELECT * FROM consents WHERE ' + col + ' = ?1').bind(await sha256hex(token)).first();
}
const gone = () => page('Echo Island', '<section><h1>This link is not valid any more / 这个链接已经失效</h1><p>It may have expired or been replaced by a newer email. Ask your child to send the request again in the app.</p><p>链接可能已经过期，或者已经有更新的邮件。请让孩子在 App 里重新发送。</p></section>', 404);

// /v1/consent/c/<token>：GET 看说明，POST 同意
export async function consentPage(R, token) {
  const c = await findBy(R, 'token_hash', token);
  if (!c || c.state === 'revoked' || (c.expires_at <= R.now && c.state !== 'granted')) return gone();   // 撤回以后旧链接不能再同意一次
  if (c.state === 'granted') return page('Echo Island', '<section><h1>Thank you — permission is recorded / 谢谢，已经记录了您的同意</h1><p class="t">' + esc(isoOrNull(c.granted_at)) + '</p></section>');
  if (R.req.method === 'GET') {
    return page('Echo Island — parent permission', '<h1>Echo Island — parent permission<br>回声岛 · 家长同意</h1>' + explain(R) +
      '<section><form method="post"><p>I am this child\'s parent or legal guardian and I agree. / 我是孩子的家长或法定监护人，我同意。</p><button type="submit">I agree / 我同意</button></form>' +
      '<p class="t">If you do not agree, just close this page: nothing will be enabled. / 不同意就直接关掉这个页面，什么都不会打开。</p></section>');
  }
  const revoke = b64url(rand(32));
  const done = await R.env.DB.prepare('UPDATE consents SET state = \'granted\', granted_at = ?2, revoke_hash = ?3 WHERE user_id = ?1 AND state = \'pending\' RETURNING parent_email').bind(c.user_id, R.now, await sha256hex(revoke)).first();
  if (done) await send(R, Object.assign({ to: done.parent_email, tag: 'consent-done' }, consentDoneMail(R.cfg.company, base(R) + '/v1/consent/r/' + revoke)));
  return page('Echo Island', '<section><h1>Thank you — permission is recorded<br>谢谢，已经记录了您的同意</h1><p>We sent you a confirmation email with a link to withdraw it at any time.</p><p>我们给您发了一封确认邮件，里面有随时撤回的链接。</p></section>');
}

// /v1/consent/r/<token>：GET 问一下，POST 撤回
export async function revokePage(R, token) {
  const c = await findBy(R, 'revoke_hash', token);
  if (!c) return gone();
  if (c.state === 'revoked') return page('Echo Island', '<section><h1>Permission withdrawn / 已经撤回</h1></section>');
  if (R.req.method === 'GET') {
    return page('Echo Island — withdraw permission', '<section><h1>Withdraw permission? / 撤回同意？</h1><p>Your child will no longer be able to use voice chat with the AI characters. The account stays; it can be deleted in the app.</p><p>孩子将不能再用语音和 AI 角色对话。账号还在，可以在 App 里删除。</p>' +
      '<form method="post"><button class="no" type="submit">Withdraw / 撤回</button></form></section>');
  }
  await R.env.DB.prepare('UPDATE consents SET state = \'revoked\', revoked_at = ?2 WHERE user_id = ?1').bind(c.user_id, R.now).run();
  return page('Echo Island', '<section><h1>Permission withdrawn / 已经撤回</h1><p>Voice chat with the AI characters is now blocked for this account.</p><p>这个账号已经不能再用语音和 AI 角色对话。</p></section>');
}
