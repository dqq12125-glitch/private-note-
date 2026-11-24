// 测试用的假上游：一个本机 HTTP + WebSocket 服务，同时扮演
// - 阿里云百炼（chat/completions、语音合成、实时语音 / 实时识别的 WebSocket）：记下服务器发了什么，回事先写好的事件
// - Resend（发邮件）：邮件不发出去，存在 mails 里给测试读登录码、同意链接
// - Apple（JWKS、/auth/token、/auth/revoke）
// 测试里不会有任何请求出这台电脑
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

export async function startFakes(o) {
  const F = { http: [], ws: [], mails: [], apple: [], refuseWs: false, transcript: 'I like apples very much.', jwks: o.jwks, n: 0 };
  const readBody = req => new Promise(res => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => res(b)); });
  const send = (res, code, obj, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  const chat = content => ({ id: 'c' + (++F.n), choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), raw = await readBody(req);
    let body = null; try { body = JSON.parse(raw); } catch (e) {}
    const rec = { path: u.pathname, method: req.method, headers: req.headers, body, raw };
    if (u.pathname === '/compatible-mode/v1/chat/completions') {
      F.http.push(rec);
      if (raw.includes('failupstream')) return send(res, 500, { code: 'Throttling', message: 'fake failure' });
      const sys = String((body.messages[0] && body.messages[0].content) || '');
      if (body.model === o.asrModel) return send(res, 200, chat('I like apples'));
      // 为你出的题（/v1/gen、/gen）：回 F.genReply（测试先设好的一段 JSON 文字；没设 = 一句不是 JSON 的话）
      if (/write short practice sentences/.test(sys)) return send(res, 200, chat(F.genReply != null ? F.genReply : 'sorry, no sentences today'));
      if (/打勾/.test(sys)) return send(res, 200, chat('{"done":[1,3]}'));
      if (/level check/.test(sys)) return send(res, 200, chat('{"score":2}'));
      if (/打分|gentle, encouraging feedback/.test(sys)) return send(res, 200, chat(JSON.stringify({ steps: [true, true, true], done: true, stars: 3, praise: 'Great job', tips: [], memory: ['likes apples'], concern: false, concernWhy: '' })));
      if (/翻译/.test(sys)) return send(res, 200, chat('你好'));
      return send(res, 200, chat('Say "apple" clearly.'));
    }
    if (u.pathname === '/api/v1/services/aigc/multimodal-generation/generation') {
      F.http.push(rec);
      return send(res, 200, { output: { audio: { url: 'http://dashscope-result.example/audio.wav' } }, request_id: 'r1' });
    }
    if (u.pathname === '/resend/emails') {
      F.mails.push({ auth: req.headers.authorization, ...body });
      return send(res, 200, { id: 'm' + F.mails.length });
    }
    if (u.pathname === '/apple/auth/keys') return send(res, 200, F.jwks);
    if (u.pathname === '/apple/auth/token' || u.pathname === '/apple/auth/revoke') {
      const form = Object.fromEntries(new URLSearchParams(raw));
      F.apple.push({ path: u.pathname, form });
      if (u.pathname === '/apple/auth/token') return send(res, 200, { access_token: 'at_' + form.code, refresh_token: 'rt_' + form.code, token_type: 'bearer', expires_in: 3600 });
      return send(res, 200, '');
    }
    send(res, 404, { error: 'fake: no route ' + u.pathname });
  });

  // 假的实时语音 / 实时识别
  const wss = new WebSocketServer({ noServer: true });
  srv.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/api-ws/v1/realtime' || F.refuseWs) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => {
      const c = { url: req.url, model: u.searchParams.get('model'), auth: req.headers.authorization, msgs: [], closed: false, ws };
      F.ws.push(c);
      const out = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
      let item = 0, resp = 0;
      ws.on('message', d => {
        let m; try { m = JSON.parse(d); } catch (e) { return; }
        c.msgs.push(m);
        const asr = c.model === o.asrRtModel;
        if (m.type === 'session.update') out({ type: 'session.updated' });
        else if (m.type === 'response.create') {
          const id = 'resp_' + (++resp);
          out({ type: 'response.audio_transcript.delta', delta: 'Hello there! ' });
          out({ type: 'response.audio.delta', delta: 'AAAAAAAA' });
          out({ type: 'response.audio_transcript.delta', delta: 'What do you like?' });
          out({ type: 'response.done', response: { id, usage: { input_tokens: 50, output_tokens: 30, input_tokens_details: { audio_tokens: 20 }, output_tokens_details: { audio_tokens: 25 } } } });
        } else if (m.type === 'input_audio_buffer.append' && asr) {
          out({ type: 'conversation.item.input_audio_transcription.text', text: 'hello', stash: ' world' });
        } else if (m.type === 'input_audio_buffer.commit') {
          const id = 'item_' + (++item);
          out({ type: 'input_audio_buffer.committed', item_id: id });
          out({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: F.transcript });
        } else if (m.type === 'session.finish') {
          out({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a1', transcript: 'hello world' });
          out({ type: 'session.finished' });
          setTimeout(() => ws.close(), 20);
        }
      });
      ws.on('close', () => { c.closed = true; });
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  F.url = 'http://127.0.0.1:' + srv.address().port;
  F.close = () => new Promise(r => { wss.clients.forEach(c => c.terminate()); srv.close(() => r()); });
  return F;
}
