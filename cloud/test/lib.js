// 测试的小工具：打勾（✓ / ✗ 一行一个，tools/test-all.js 按这个数）、起一个本机的 Worker（Miniflare = 和线上一样的 workerd）、
// 调接口、开 WebSocket、直接读写 D1
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
const require = createRequire(import.meta.url);
const WS = require('ws');

export const T = { pass: 0, fail: 0, fails: [] };
export function ok(cond, msg, extra) {
  if (cond) { T.pass++; console.log('✓ ' + msg); }
  else { T.fail++; T.fails.push(msg); console.log('✗ ' + msg + (extra !== undefined ? '   → ' + JSON.stringify(extra).slice(0, 400) : '')); }
  return !!cond;
}
export const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg, { got: a, want: b });
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function until(fn, ms, step) {
  const t = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > (ms || 3000)) return v; await sleep(step || 50); }
}
export function section(s) { console.log('\n— ' + s); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export const CLOUD = ROOT;

// D1 的表：照 migrations/*.sql 建（去掉注释，按「;」分开）
async function migrate(db) {
  const dir = path.join(ROOT, 'migrations');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).map(l => l.replace(/--.*$/, '')).join('\n');
    for (const st of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(st).run();
  }
}

// 起一个 Worker：script 是 wrangler 打包出来的 dist/index.js（和部署的是同一份）
export async function startWorker(script, bindings, rl) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: script, compatibilityDate: '2026-11-01',
    d1Databases: { DB: 'test-' + Math.random().toString(36).slice(2) },
    ratelimits: Object.fromEntries(Object.entries(rl).map(([k, v], i) => [k, { namespace_id: String(9000 + i), simple: { limit: v, period: 60 } }])),
    bindings,
  }));
  const url = String(await mf.ready).replace(/\/$/, '');
  const db = await mf.getD1Database('DB');
  await migrate(db);
  const X = { mf, url, db };
  // 调接口：o = { token, body, headers, now（假装的现在，毫秒）, raw（原样的请求体） }
  X.api = async (method, p, o) => {
    o = o || {};
    const h = Object.assign({}, o.headers);
    if (o.token) h.Authorization = 'Bearer ' + o.token;
    if (o.now) h['x-test-now'] = String(o.now);
    let body;
    if (o.raw !== undefined) body = o.raw;
    else if (o.body !== undefined) { body = JSON.stringify(o.body); h['Content-Type'] = 'application/json'; }
    const r = await fetch(url + p, { method, headers: h, body });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: r.status, json, text, headers: r.headers };
  };
  // WebSocket：o = { token（放网址里）, first（第一条发 auth）, headers }
  X.ws = (p, o) => new Promise(resolve => {
    o = o || {};
    const u = url.replace(/^http/, 'ws') + p + (o.token ? (p.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(o.token) : '');
    const ws = new WS(u, { headers: Object.assign({}, o.headers, o.now ? { 'x-test-now': String(o.now) } : {}) });
    const C = { ws, msgs: [], closed: null, waiters: [] };
    C.send = m => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
    C.next = (pred, ms) => new Promise(res => {
      const hit = C.msgs.find(pred); if (hit) return res(hit);
      const w = { pred, res }; C.waiters.push(w);
      setTimeout(() => { C.waiters = C.waiters.filter(x => x !== w); res(null); }, ms || 5000);
    });
    C.close = () => { try { ws.close(); } catch (e) {} };
    C.done = new Promise(res => ws.on('close', (code, reason) => { C.closed = { code, reason: String(reason) }; res(C.closed); }));
    ws.on('message', d => {
      let m; try { m = JSON.parse(String(d)); } catch (e) { m = { raw: String(d) }; }
      C.msgs.push(m);
      C.waiters.filter(w => w.pred(m)).forEach(w => { C.waiters = C.waiters.filter(x => x !== w); w.res(m); });
    });
    ws.on('open', () => { if (o.first) ws.send(JSON.stringify({ type: 'auth', token: o.first })); resolve(C); });
    ws.on('error', () => resolve(C));
  });
  X.one = (sql, ...a) => db.prepare(sql).bind(...a).first();
  X.all = async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results;
  X.run = (sql, ...a) => db.prepare(sql).bind(...a).run();
  X.dispose = () => mf.dispose();
  return X;
}
