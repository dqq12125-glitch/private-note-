// 发邮件：一个接口 send(R, 邮件)，两种实现
// - console：只打印到 Worker 日志（本机开发用；正式环境不许用，登录码会进日志、用户也收不到）
// - resend：Resend 的 HTTP 接口（https://resend.com/docs/api-reference/emails/send-email），Workers 里直接 fetch 就能用
// 换别家（Postmark、SES……）就在 PROVIDERS 里加一个同样参数的函数
import { HttpError, fetchT } from './util.js';

const PROVIDERS = {
  async console(R, m) {
    console.log('[email:console] to=' + m.to + ' subject=' + JSON.stringify(m.subject) + '\n' + m.text);
  },
  async resend(R, m) {
    const E = R.cfg.email;
    if (!E.resendKey || !E.from) throw new HttpError(503, 'unavailable', 'Email is not configured', { what: 'email' });
    if (!R.cfg.hostOk(E.resendUrl, 'email')) throw new HttpError(503, 'unavailable', 'Email host not allowed', { what: 'email' });
    let r;
    try {
      r = await fetchT(E.resendUrl, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + E.resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: E.from, to: [m.to], subject: m.subject, text: m.text, html: m.html, tags: m.tag ? [{ name: 'kind', value: m.tag }] : undefined }),
      }, 10000);
    } catch (e) { throw new HttpError(503, 'unavailable', 'Email provider unreachable', { what: 'email' }); }
    if (!r.ok) { console.log('email provider error', r.status, (await r.text()).slice(0, 200)); throw new HttpError(503, 'unavailable', 'Email provider error', { what: 'email' }); }
  },
};

export async function send(R, m) {
  const p = R.cfg.email.provider;
  if (!PROVIDERS[p] || (p === 'console' && R.cfg.prod)) throw new HttpError(503, 'unavailable', 'Email is not configured', { what: 'email' });
  await PROVIDERS[p](R, m);
}

// ---------- 邮件内容 ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wrap = body => '<!doctype html><meta charset="utf-8"><div style="font:15px/1.6 system-ui,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#1d2b36">' + body + '</div>';

export function codeMail(code, ui, min) {
  min = min || 10;
  if (ui === 'zh') return {
    subject: '回声岛登录码：' + code,
    text: '你的回声岛登录码是 ' + code + '，' + min + ' 分钟内有效。\n不是你要的？不用理这封邮件。',
    html: wrap('<p>你的回声岛登录码：</p><p style="font-size:28px;font-weight:800;letter-spacing:4px">' + code + '</p><p>' + min + ' 分钟内有效。不是你要的？不用理这封邮件。</p>'),
  };
  return {
    subject: 'Your Echo Island code: ' + code,
    text: 'Your Echo Island sign-in code is ' + code + '. It is valid for ' + min + ' minutes.\nDid not ask for it? Just ignore this email.',
    html: wrap('<p>Your Echo Island sign-in code:</p><p style="font-size:28px;font-weight:800;letter-spacing:4px">' + code + '</p><p>It is valid for ' + min + ' minutes. Did not ask for it? Just ignore this email.</p>'),
  };
}

// 给家长的同意邮件：中英文都写（家长看哪种都行）
export function consentMail(company, link) {
  return {
    subject: 'Echo Island: your child asks for permission / 回声岛：孩子请您同意',
    text: 'Hello,\n\nA child using Echo Island, an English speaking game by ' + company + ', gave this address as a parent\'s email. ' +
      'Before the child can talk with the game\'s AI characters by voice, we need a parent\'s permission.\n\n' +
      'Please read what we collect and decide here (valid for 7 days):\n' + link + '\n\nIf you do not know this child, ignore this email: nothing will be enabled.\n\n' +
      '您好！\n\n一个正在使用「回声岛」（' + company + ' 出品的英语口语游戏）的孩子把这个地址填成了家长的邮箱。孩子要用语音和游戏里的 AI 角色对话，需要先得到家长同意。\n\n' +
      '请打开下面的链接，看看我们收集什么、再决定（7 天内有效）：\n' + link + '\n\n如果您不认识这个孩子，不用理这封邮件，什么都不会打开。\n',
    html: wrap('<p>Hello,</p><p>A child using <b>Echo Island</b>, an English speaking game by ' + esc(company) + ', gave this address as a parent\'s email. Before the child can talk with the game\'s AI characters by voice, we need a parent\'s permission.</p>' +
      '<p><a href="' + esc(link) + '">Read what we collect and decide</a> (valid for 7 days). If you do not know this child, ignore this email: nothing will be enabled.</p><hr>' +
      '<p>您好！</p><p>一个正在使用「回声岛」（' + esc(company) + ' 出品的英语口语游戏）的孩子把这个地址填成了家长的邮箱。孩子要用语音和游戏里的 AI 角色对话，需要先得到家长同意。</p>' +
      '<p><a href="' + esc(link) + '">看看我们收集什么，再决定</a>（7 天内有效）。如果您不认识这个孩子，不用理这封邮件，什么都不会打开。</p>'),
  };
}
// 同意以后的确认信（email plus 的第二封）：带撤回链接
export function consentDoneMail(company, revokeLink) {
  return {
    subject: 'Echo Island: permission recorded / 回声岛：已记录您的同意',
    text: 'Thank you. We recorded your permission for your child to use voice chat with the AI characters in Echo Island (' + company + ').\n' +
      'If this was not you, or you change your mind, withdraw it here at any time:\n' + revokeLink + '\nYou can also delete the account inside the app (Settings).\n\n' +
      '谢谢您！我们已经记录了您的同意：孩子可以在「回声岛」（' + company + '）里用语音和 AI 角色对话。\n如果这不是您本人操作，或者您改主意了，随时可以在这里撤回：\n' + revokeLink + '\n也可以在 App 的设置里删除整个账号。\n',
    html: wrap('<p>Thank you. We recorded your permission for your child to use voice chat with the AI characters in Echo Island (' + esc(company) + ').</p><p>If this was not you, or you change your mind, <a href="' + esc(revokeLink) + '">withdraw it here</a> at any time. You can also delete the account inside the app (Settings).</p><hr>' +
      '<p>谢谢您！我们已经记录了您的同意：孩子可以在「回声岛」里用语音和 AI 角色对话。</p><p>如果这不是您本人操作，或者您改主意了，<a href="' + esc(revokeLink) + '">随时可以在这里撤回</a>。也可以在 App 的设置里删除整个账号。</p>'),
  };
}
export { esc };
