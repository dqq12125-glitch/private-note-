// 连阿里云百炼（国际版）。密钥只在这里用；地址只从配置拼（DS_HTTP_BASE / DS_WS_BASE），主机不在白名单就不连
import { HttpError, fetchT } from './util.js';
import { need } from './config.js';

export class ProviderError extends HttpError {
  constructor(up) { super(503, 'provider', 'AI provider failed', { up: String(up || '').slice(0, 40) }); }
}
function base(R, kind) {
  need(R.cfg, 'ds');
  const b = kind === 'ws' ? R.cfg.ds.wsBase : R.cfg.ds.httpBase;
  if (!R.cfg.hostOk(b.replace(/^ws/, 'http'), 'ds')) throw new HttpError(503, 'unavailable', 'AI provider host not allowed', { what: 'ds' });
  return b;
}
export const EVAL_PATH = '/compatible-mode/v1/chat/completions';
export const TTS_PATH = '/api/v1/services/aigc/multimodal-generation/generation';

// HTTP：回 JSON；阿里云报错（密钥、欠费、限流……）时带着它的错误代码抛 ProviderError（和中转服务的 up 一样）
export async function dsPost(R, path, body, ms) {
  const url = base(R, 'http') + path;
  let r, o;
  try {
    r = await fetchT(url, { method: 'POST', headers: { Authorization: 'Bearer ' + R.cfg.ds.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms || 12000);
    o = await r.json();
  } catch (e) { throw new ProviderError(e && e.name === 'AbortError' ? 'timeout' : 'network'); }
  if (!r.ok || o.error || (o.code && !o.choices && !o.output)) throw new ProviderError((o && o.error && (o.error.code || o.error.type)) || (o && o.code) || r.status);
  return o;
}

// 实时语音 / 实时识别的 WebSocket：Workers 里用 fetch + Upgrade 头连（这样才能带 Authorization 头）
export async function dsSocket(R, model) {
  const url = base(R, 'ws').replace(/^ws/, 'http') + '/api-ws/v1/realtime?model=' + encodeURIComponent(model);
  let r;
  try { r = await fetch(url, { headers: { Upgrade: 'websocket', Authorization: 'Bearer ' + R.cfg.ds.key } }); }
  catch (e) { throw new ProviderError('network'); }
  const ws = r.webSocket;
  if (!ws) throw new ProviderError(r.status);
  ws.accept();
  return ws;
}
