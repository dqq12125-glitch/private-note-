// 临时的测量用 Worker（不带任何钥匙，量完就删）：从它跑的那个机房去连阿里云（北京）要多久
// 打没有登录的请求（回 401），只量「连上 + 来回一趟」的时间、传 300KB 的时间、WebSocket 握手的时间
export default {
  async fetch(req) {
    const u = new URL(req.url), n = Math.min(8, +(u.searchParams.get('n') || 4)), kb = Math.min(600, +(u.searchParams.get('kb') || 300));
    const host = u.searchParams.get('intl') ? 'dashscope-intl.aliyuncs.com' : 'dashscope.aliyuncs.com';
    const out = { colo: req.cf && req.cf.colo, host, get: [] };
    for (let i = 0; i < n; i++) {
      const t0 = Date.now(); let st = 0;
      try { const r = await fetch('https://' + host + '/compatible-mode/v1/models', { headers: { Authorization: 'Bearer none' } }); st = r.status; await r.text(); } catch (e) { st = String(e).slice(0, 80); }
      out.get.push([Date.now() - t0, st]);
    }
    const t1 = Date.now(); let st2 = 0;
    try {
      const r = await fetch('https://' + host + '/compatible-mode/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer none', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'x', messages: [{ role: 'user', content: 'x'.repeat(kb * 1024) }] }) });
      st2 = r.status; await r.text();
    } catch (e) { st2 = String(e).slice(0, 80); }
    out.post = [Date.now() - t1, st2, kb + 'KB'];
    if (u.searchParams.get("ws") === "0") return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const t2 = Date.now(); let ws = "";
    try {
      const r = await fetch('https://' + host + '/api-ws/v1/realtime?model=qwen3-asr-flash-realtime', { headers: { Upgrade: 'websocket', Authorization: 'Bearer none' } });
      ws = r.status + (r.webSocket ? ' ws' : ''); if (r.webSocket) { r.webSocket.accept(); r.webSocket.close(); }
    } catch (e) { ws = String(e).slice(0, 80); }
    out.ws = [Date.now() - t2, ws];
    return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  },
};
