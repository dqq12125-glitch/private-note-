// 回声岛 — 出错记录（家长 2026-10-07，评估第 15 条）
// index.html 在 <head> 里第一个加载它：后面 data.js … game.js 加载时出的错也记得到。
// 页面上没接住的错误、没处理的 Promise 失败、3D 画面丢了（EchoErr.log）都记下来，最近 50 条存在这台设备里（localStorage['echo-errs']），
// 周报底部的诊断一行、家长设置「🔧 出错记录」里看得到（孩子的手机上没法开调试，出了问题靠它查）。
// 一条：{ t 时间（毫秒）, k 种类 error / promise / gl / app / ai, m 内容（最多 200 字）, s 哪个文件第几行, n 连着出了几次 }
(function () {
  'use strict';
  const KEY = 'echo-errs', MAX = 50;
  let list = null, tm = 0;
  const read = () => { if (list) return list; try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { list = []; } if (!Array.isArray(list)) list = []; return list; };
  const flush = () => { tm = 0; try { localStorage.setItem(KEY, JSON.stringify(read().slice(-MAX))); } catch (e) { /* 存不下就算了 */ } };
  function log(kind, msg, src) {
    try {
      const L = read(), m = String(msg == null ? '' : msg).replace(/\s+/g, ' ').trim().slice(0, 200), s = String(src || '').replace(/^.*\//, '').slice(0, 80), last = L[L.length - 1];
      if (!m) return;
      // 同一个错误连着出（比如每一帧都出）：只加次数，不刷屏
      if (last && last.m === m && last.s === s && Date.now() - last.t < 60e3) { last.n = (last.n || 1) + 1; last.t = Date.now(); }
      else { L.push({ t: Date.now(), k: kind || 'app', m, s }); if (L.length > MAX) L.splice(0, L.length - MAX); }
      if (!tm) tm = setTimeout(flush, 1500);
    } catch (e) { /* 记录本身出错不能再报错 */ }
  }
  window.addEventListener('error', e => {
    if (!e) return;
    if (e.error || e.message) log('error', e.message || (e.error && e.error.message) || 'error', (e.filename || '') + (e.lineno ? ':' + e.lineno + ':' + (e.colno || 0) : ''));
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    log('promise', r && (r.message || r.name) ? (r.name && r.name !== 'Error' ? r.name + ': ' : '') + (r.message || '') : String(r), r && r.stack ? (String(r.stack).split('\n')[1] || '').trim() : '');
  });
  window.addEventListener('pagehide', () => { if (tm) { clearTimeout(tm); flush(); } });
  window.EchoErr = {
    log,
    list: () => read().slice(),
    // 最近 days 天里记了几条（同一条连着出的按 1 条算）
    count: days => { const t0 = Date.now() - (days || 7) * 864e5; return read().filter(x => x.t >= t0).length; },
    clear: () => { list = []; flush(); },
  };
})();
