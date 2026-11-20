// 课程包（tools/pack/SPEC.md §4、§5，2026-11-20 老板：「把这些语言的课程包放到网上，而不是放到程序里面，要学什么语言再下载。」）
// window.EchoPacks：要学的语言的配音（以后还有别的语言的课程内容 course.json）放在网上，选了这门课再下载，存在这台设备的 IndexedDB 里。
//
// 两种模式（SPEC §1）：
// - 老模式（没有课程包地址）：EchoPacks.on === false，ready() 立刻好，别的一律不做——配音照旧读安装包里的 assets/voice（game.js）。
//   家庭版 APK、弟弟的线上版、全部现有测试都是这样。
// - 课程包模式：地址按顺序取 原生启动对象 __ECHO_BOOT.packsUrl（打包时的 ECHO_PACKS_URL）→ window.ECHO_PACKS_URL →
//   网址 ?packs=<地址>（记进 localStorage['echo-packs-url']，?packs=off 清掉）。地址可以是 https://…、本机试的 http://localhost / 127.0.0.1，
//   或者同一个网站里的路径 /…（iPhone 自测页用 /__test/packs）。
//
// 存在 IndexedDB 的库 echo-packs（iPhone、安卓、浏览器同一份代码，不加原生方法）：
//   meta：语言 → { lang, ver, state, list: manifest 的 files, files: { 文件名: 'done' }, bytes, done, keys: { f: [...], m: [...] }, at, paused, next }
//         （next：「更新」时新版本的下载进度，齐了才换上、再删旧版本多出来的那几段；list、paused、next 是 SPEC 之外加的，断网时也接得上）
//   clip：语言/声音/key → ArrayBuffer（一段一条，不存 Blob：老 WebKit 的 IndexedDB 存 Blob 有毛病）
//   doc： 语言/course → course.json 的内容（英语没有）
// 加载时不碰 DOM、不读存档；Node 里能 require（拆包 / 拼包 / crc 这些纯函数在 EchoPacks._，tools/pack/build.js 和测试用）。
(function (root) {
  'use strict';
  const inNode = typeof module === 'object' && !!module && !!module.exports && typeof window === 'undefined';

  // =====================================================================================
  // ① 纯函数（Node 里也用：打包工具 tools/pack/build.js、核对工具 tools/pack/check.js、测试）
  // =====================================================================================
  // CRC-32（和 zip 的一样）。prev：接着上一段算（下载时一块块算）
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8, prev) {
    let c = ((prev === undefined ? 0 : prev) ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const hex8 = n => ('0000000' + (n >>> 0).toString(16)).slice(-8);
  const crcHex = u8 => hex8(crc32(u8));
  const u8of = b => (b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b));
  const MAGIC = [0x45, 0x50, 0x4b, 0x31];   // "EPK1"

  // 拼一个配音包：items = [{ g: 'f'|'m', k: key, data: Uint8Array }] → Uint8Array
  //   4 字节 "EPK1"、4 字节头的长度 H（小端 u32）、H 字节 UTF-8 的 JSON { items: [[声音, key, 字节数], …] }、各段 .ogg 原样按顺序接在后面
  function packBundle(items) {
    const head = new TextEncoder().encode(JSON.stringify({ items: items.map(x => [x.g, x.k, x.data.length]) }));
    const out = new Uint8Array(8 + head.length + items.reduce((s, x) => s + x.data.length, 0));
    out.set(MAGIC, 0);
    new DataView(out.buffer).setUint32(4, head.length, true);
    out.set(head, 8);
    let o = 8 + head.length;
    for (const x of items) { out.set(u8of(x.data), o); o += x.data.length; }
    return out;
  }
  // 拆开看：{ items: [[声音, key, 字节数], …], at: [每段从第几个字节开始] }。不是配音包、头坏了、各段加起来不等于文件长度：抛错
  function readBundle(buf) {
    const u8 = u8of(buf);
    if (u8.length < 8 || MAGIC.some((b, i) => u8[i] !== b)) throw new Error('not an EPK1 bundle');
    const H = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(4, true);
    if (8 + H > u8.length) throw new Error('bundle header is longer than the file');
    let head = null;
    try { head = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + H))); } catch (e) { throw new Error('bundle header is not JSON'); }
    const items = head && Array.isArray(head.items) ? head.items : null;
    if (!items) throw new Error('bundle header has no items');
    const at = [];
    let o = 8 + H;
    for (const it of items) {
      if (!Array.isArray(it) || typeof it[0] !== 'string' || typeof it[1] !== 'string' || !it[1] || !Number.isInteger(it[2]) || it[2] < 0) throw new Error('bad bundle item ' + JSON.stringify(it));
      at.push(o);
      o += it[2];
    }
    if (o !== u8.length) throw new Error('bundle items add up to ' + o + ' bytes, the file has ' + u8.length);
    return { items, at };
  }
  // 版本号 YYYYMMDD.n：按数比（20261120.10 比 20261120.9 新）
  const okVer = v => /^\d{8}\.\d{1,4}$/.test(String(v || ''));
  function verCmp(a, b) {
    const x = String(a || '').split('.').map(Number), y = String(b || '').split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
  }
  // 课程包地址：https://域名[:端口][/路径]、本机试的 http://localhost / 127.0.0.1 / [::1]，或者同一个网站里的 /路径（不许 //别的网站）
  const okUrl = u => /^https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(u) ||
    /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/[A-Za-z0-9._~\/-]*)?$/.test(u) || /^\/(?!\/)[A-Za-z0-9._~\/-]+$/.test(u);
  const normUrl = u => String(u || '').trim().replace(/\/+$/, '');
  // 这一步引擎支持的「要学的语言」（SPEC §5：别的语言的引擎和内容在做；目录里有、这里没有的不显示）
  const LANGS = ['en'];
  const RETRY = [1000, 3000, 8000];   // 一个文件失败了隔多久重试（3 次）；测试可以改小
  const BATCH = 300;                  // 拆包时一个事务写几段

  const pure = { crc32, crcHex, hex8, packBundle, readBundle, verCmp, okVer, okUrl, normUrl, RETRY, BATCH };
  if (inNode) {
    module.exports = { on: false, LANGS, _: pure };
    return;
  }

  // =====================================================================================
  // ② 下载和存储（浏览器 / WKWebView / 安卓 WebView）
  // =====================================================================================
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { return ''; } return ''; };
  function pickUrl() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('packs')) { const v = normUrl(q.get('packs')); LS('echo-packs-url', v && okUrl(v) ? v : null); }
    } catch (e) { /* 没有网址参数 */ }
    const boot = root.__ECHO_BOOT || {};
    for (const u of [boot.packsUrl, root.ECHO_PACKS_URL, LS('echo-packs-url')]) { const v = normUrl(u); if (v && okUrl(v)) return v; }
    return '';
  }
  const BASE = pickUrl(), ON = !!BASE;
  const course = () => LS('echo-course') || 'en';

  let db = null, STORE = '';            // STORE：'' 还没打开 / 'idb' / 'none'（打不开：隐私模式等，配音当作没有）
  const M = {};                          // 语言 → meta
  let KEYS = { f: new Set(), m: new Set() };   // 现在这门课装好了的段
  let CONTENT = null;                    // 这门课的 course 内容（英语 = null）
  let CAT = null, CAT_FRESH = false, catP = null;
  const JOB = {};                        // 语言 → { busy, paused, err, ctl, cur: { 文件名: 已下字节 }, runP, last }
  const job = l => JOB[l] || (JOB[l] = { busy: false, paused: false, err: null, ctl: new Set(), cur: {}, runP: null, last: 0, seq: 0, removing: false });
  const LIS = { progress: new Set(), state: new Set() };
  let lastUrl = '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errOf = (code, more) => Object.assign(new Error('packs: ' + code), { code }, more || {});

  function emit(ev, d) { for (const f of [...LIS[ev]]) { try { f(d); } catch (e) { /* 界面出错不影响下载 */ } } }
  function on_(ev, fn) { if (LIS[ev] && typeof fn === 'function') LIS[ev].add(fn); return () => { if (LIS[ev]) LIS[ev].delete(fn); }; }
  const emitState = l => emit('state', { lang: l, info: info(l) });
  // 进度：同一门课 0.15 秒最多一次（下完一个文件那一下一定发）
  function tick(l, now) {
    const J = job(l), t = Date.now();
    if (!now && t - J.last < 150) return;
    J.last = t;
    const i = info(l);
    emit('progress', { lang: l, done: i.done, bytes: i.bytes, coreDone: i.coreDone, core: i.core });
  }

  // ---------- IndexedDB ----------
  function idbOpen() {
    return new Promise((res, rej) => {
      let r;
      try { r = root.indexedDB.open('echo-packs', 1); } catch (e) { rej(e); return; }
      if (!r) { rej(new Error('no indexedDB')); return; }
      const to = setTimeout(() => rej(new Error('indexedDB open timed out')), 6000);
      r.onupgradeneeded = () => { const d = r.result; for (const s of ['meta', 'clip', 'doc']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
      r.onsuccess = () => { clearTimeout(to); const d = r.result; d.onversionchange = () => { try { d.close(); } catch (e) { /* 忽略 */ } }; res(d); };
      r.onerror = () => { clearTimeout(to); rej(r.error || new Error('indexedDB open failed')); };
    });
  }
  const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const txP = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error || new Error('transaction failed')); tx.onabort = () => rej(tx.error || new Error('transaction aborted')); });
  const dbGet = (s, k) => reqP(db.transaction(s, 'readonly').objectStore(s).get(k));
  function dbPut(s, k, v) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).put(v, k); return txP(tx); }
  function dbDel(s, k) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).delete(k); return txP(tx); }
  const KEY_END = String.fromCharCode(0xffff);   // 「这个前缀开头的都算」的上界
  function dbDelPrefix(s, pre) { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).delete(IDBKeyRange.bound(pre, pre + KEY_END)); return txP(tx); }
  function dbMetas() {
    return new Promise((res, rej) => {
      const out = [], r = db.transaction('meta', 'readonly').objectStore('meta').openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { out.push(c.value); c.continue(); } else res(out); };
      r.onerror = () => rej(r.error);
    });
  }
  // 存 meta：失败（空间满了）不让下载停在半路——下一个文件再存一次
  const saveMeta = m => dbPut('meta', m.lang, m).catch(e => { throw quota(e) ? errOf('space', { need: 0, free: 0 }) : errOf('store'); });
  const quota = e => !!e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || '')));

  // ---------- 状态 ----------
  const isDone = (T, f) => !!T && T.files[f.name] === 'done';
  function stateOf(m) {
    if (!m) return 'none';
    if (m.list.every(f => isDone(m, f))) return 'full';
    if (m.list.filter(f => f.core).every(f => isDone(m, f))) return 'core';
    return 'part';
  }
  function setKeys(l) {
    if (l !== course()) return;
    const m = M[l];
    KEYS = { f: new Set(m ? m.keys.f : []), m: new Set(m ? m.keys.m : []) };
  }
  function info(l) {
    const m = M[l], J = JOB[l] || { cur: {} }, c = CAT && CAT.packs ? CAT.packs[l] : null;
    const T = m ? m.next || m : null;
    const fly = n => (J.cur && J.cur[n]) || 0;
    const sum = (list, f) => list.reduce((s, x) => s + (f(x) ? x.bytes : 0), 0);
    const core = T ? sum(T.list, f => f.core) : c ? c.core || 0 : 0;
    const coreDone = T ? T.list.reduce((s, f) => s + (f.core ? (isDone(T, f) ? f.bytes : Math.min(fly(f.name), f.bytes)) : 0), 0) : 0;
    const done = T ? T.list.reduce((s, f) => s + (isDone(T, f) ? f.bytes : Math.min(fly(f.name), f.bytes)), 0) : 0;
    return {
      ver: m ? m.ver : c ? c.ver : '', bytes: T ? T.bytes : c ? c.bytes || 0 : 0, done, state: stateOf(m), busy: !!J.busy, err: J.err || null,
      update: !!(m && c && okVer(c.ver) && verCmp(c.ver, m.ver) > 0), paused: !!(m && m.paused), core, coreDone,
      next: m && m.next ? m.next.ver : '', used: m ? sum(m.list, f => isDone(m, f)) + (m.next ? sum(m.next.list, f => isDone(m.next, f)) : 0) : 0,
    };
  }
  const state = l => stateOf(M[l]);
  const hasClip = (k, g) => !!(KEYS[g] && KEYS[g].has(k));

  // ---------- 启动 ----------
  let readyP = null;
  function ready() {
    if (!ON) return Promise.resolve();   // 老模式：立刻好
    if (!readyP) {
      const b = boot();
      // 有的 WebKit 第一次打开 IndexedDB 一直不回话：最多等 4 秒就让游戏先开起来（读好了 key 表再补上）
      readyP = Promise.race([b, sleep(4000)]);
    }
    return readyP;
  }
  async function boot() {
    try { db = await idbOpen(); STORE = 'idb'; } catch (e) { STORE = 'none'; emitState(course()); return; }
    try {
      for (const m of await dbMetas()) if (m && m.lang && Array.isArray(m.list) && m.keys) M[m.lang] = m;
      setKeys(course());
      if (course() !== 'en' && M[course()]) CONTENT = (await dbGet('doc', course() + '/course')) || null;
    } catch (e) { /* 读坏了：当作没装 */ }
    emitState(course());
    // 点过下载、没下完、没暂停：接着下（后台，不等它）
    setTimeout(() => {
      for (const l of Object.keys(M)) { const m = M[l]; if (!m.paused && (m.next || stateOf(m) !== 'full')) install(l, { auto: true }); }
      catalog().then(() => emitState(course()), () => {});
    }, 0);
  }

  // ---------- 目录（catalog.json） ----------
  // 内存里缓存；取不到时用上次存的（localStorage['echo-packs-cat']，只有几百字）。force：重新取
  function catalog(force) {
    if (!ON) return Promise.resolve(null);
    if (CAT && CAT_FRESH && !force) return Promise.resolve(CAT);
    if (!catP) {
      catP = fetch(BASE + '/catalog.json', { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : Promise.reject(errOf('net', { status: r.status }))))
        .then(j => {
          if (!j || j.fmt !== 1 || !j.packs || typeof j.packs !== 'object') throw errOf('bad');
          CAT = j; CAT_FRESH = true; LS('echo-packs-cat', JSON.stringify(j));
          return j;
        })
        .catch(e => {
          if (!CAT) { try { const o = JSON.parse(LS('echo-packs-cat') || 'null'); if (o && o.packs) CAT = o; } catch (x) { /* 存的坏了 */ } }
          if (CAT) return CAT;
          throw e.code ? e : errOf('net');
        })
        .then(j => { catP = null; return j; }, e => { catP = null; throw e; });
    }
    return catP;
  }
  function manifest(l, ver) {
    return fetch(BASE + '/' + l + '/' + ver + '/manifest.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(errOf('net', { status: r.status }))), e => { throw e.code ? e : errOf('net'); })
      .then(j => {
        if (!j || j.fmt !== 1 || j.lang !== l || j.ver !== ver || !Array.isArray(j.files) || !j.files.length) throw errOf('bad');
        for (const f of j.files) if (!f || !/^[\w.-]+$/.test(f.name || '') || !Number.isInteger(f.bytes) || !/^[0-9a-f]{8}$/.test(f.crc || '')) throw errOf('bad');
        return j;
      });
  }
  // 一份新的下载计划（manifest → meta 或 meta.next）。core 的文件排前面
  function plan(l, man) {
    const list = man.files.map(f => ({ name: f.name, kind: f.kind === 'course' ? 'course' : 'voice', core: !!f.core || f.kind === 'course', bytes: f.bytes, crc: f.crc, n: f.n == null ? null : f.n }));
    list.sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0));
    return { lang: l, ver: man.ver, state: 'part', list, files: {}, bytes: list.reduce((s, f) => s + f.bytes, 0), done: 0, keys: { f: [], m: [] }, at: Date.now(), paused: false, next: null };
  }

  // ---------- 剩余空间 ----------
  // 有原生 storage()（安卓 / iPhone 的 App）用它说的剩余空间；没有就问浏览器（navigator.storage.estimate：配额 - 已用）
  async function freeSpace() {
    try {
      const N = root.EchoNative;
      if (N && typeof N.storage === 'function') { const s = JSON.parse(N.storage() || '{}'); if (s && s.free > 0) return s.free; }
    } catch (e) { /* 读不到就问浏览器 */ }
    try {
      if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e && e.quota > 0) return Math.max(0, e.quota - (e.usage || 0)); }
    } catch (e) { /* 不知道 */ }
    return Infinity;
  }

  // ---------- 下载 ----------
  // install(lang)：开始 / 接着下。一个文件一个文件来：下载（有进度）→ 核对 crc → 拆成一段段写进 clip → 记 files[name] = 'done'。
  // 断了、切后台、杀进程以后再叫一次，从没做完的那个文件接着来。同时最多两个文件；失败重试 3 次（1 秒、3 秒、8 秒）。
  // 人点的（不带 auto）：目录里有新版本就开始「更新」（先装新的，齐了再删旧的）。auto：打开 App 时接着下，只接着上次的，不自己更新
  function install(l, o) {
    if (!ON) return Promise.resolve(false);
    o = o || {};
    const J = job(l);
    if (J.busy && !J.paused) return Promise.resolve(true);
    if (J.removing) return Promise.resolve(false);
    // 刚按了暂停、上一次还没停稳：等它停稳再开始（seq：等的时候又被暂停 / 删除了就不开始）
    const prev = J.runP || Promise.resolve(), want = ++J.seq;
    J.err = null; J.busy = true;
    emitState(l);
    const p = prev.catch(() => {}).then(() => ready()).then(() => {
      if (J.seq !== want) return;
      J.paused = false;
      return runInstall(l, o);
    }).then(() => true, e => {
      if (!J.paused) { J.err = { code: e && e.code ? e.code : 'net', need: (e && e.need) || 0, free: (e && e.free) || 0 }; }
      return false;
    }).then(r => {
      if (J.runP === p) { J.busy = false; J.runP = null; }
      J.cur = {};
      emitState(l);
      return r;
    });
    J.runP = p;
    return p;
  }
  async function runInstall(l, o) {
    const J = job(l);
    J.busy = true;
    if (STORE !== 'idb') throw errOf('store');
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* 浏览器不给也没关系 */ }
    let m = M[l];
    if (!m || !o.auto) {
      let cat = null;
      try { cat = await catalog(!m); } catch (e) { if (!m) throw e; }
      const c = cat && cat.packs && cat.packs[l] && okVer(cat.packs[l].ver) ? cat.packs[l] : null;
      if (!m) {
        if (!c) throw errOf('cat');
        m = plan(l, await manifest(l, c.ver));
      } else if (c && verCmp(c.ver, m.ver) > 0 && !(m.next && m.next.ver === c.ver)) {
        const n = plan(l, await manifest(l, c.ver));
        delete n.next; delete n.paused;
        m.next = n;   // 有新版本：先装新的（换下来以前旧的照样能用）
      }
    }
    if (J.paused) return;
    m.paused = false;
    m.state = stateOf(m);
    M[l] = m;
    await saveMeta(m);
    await runFiles(l);
  }
  async function runFiles(l) {
    const J = job(l), m = M[l], nx = !!m.next, T = m.next || m;
    const todo = T.list.filter(f => !isDone(T, f));
    if (todo.length) {
      // 空间：剩下的 ×1.2（数据库的开销）；不够就不下，说清楚差多少
      const need = Math.round(todo.reduce((s, f) => s + f.bytes, 0) * 1.2), free = await freeSpace();
      if (free < need) throw errOf('space', { need, free });
      const q = todo.slice();
      let fail = null;
      const worker = async () => {
        while (q.length && !J.paused && !fail) {
          const f = q.shift();
          try { await oneFile(l, m, T, nx, f); } catch (e) { fail = fail || e; for (const c of J.ctl) { try { c.abort(); } catch (x) { /* 忽略 */ } } }
        }
      };
      await Promise.all([worker(), worker()]);   // 同时最多两个文件
      if (fail) throw fail;
      if (J.paused) return;
    }
    if (nx && T.list.every(f => isDone(T, f))) await swapIn(l);
  }
  async function oneFile(l, m, T, nx, f) {
    const J = job(l), url = BASE + '/' + l + '/' + T.ver + '/' + f.name;
    for (let a = 0; ; a++) {
      if (J.paused) return;
      try {
        const buf = await download(url, f, l);
        if (J.paused) return;
        if (buf.byteLength !== f.bytes || crcHex(new Uint8Array(buf)) !== f.crc) throw errOf('bad');   // 下坏了、下了一半：这个文件重下
        await ingest(l, m, T, nx, f, buf);
        return;
      } catch (e) {
        J.cur[f.name] = 0;
        if (J.paused || (e && e.name === 'AbortError')) return;
        if (e && (e.code === 'space' || e.code === 'store')) throw e;   // 存不进去：重下也没用
        if (a >= RETRY.length) throw e && e.code ? e : errOf('net');
        await sleep(RETRY[a]);
      }
    }
  }
  async function download(url, f, l) {
    const J = job(l), ctl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctl) J.ctl.add(ctl);
    try {
      let r;
      // no-store：下下来的已经存进数据库了，不再在浏览器的缓存里多占一份
      try { r = await fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined }); } catch (e) { if (e && e.name === 'AbortError') throw e; throw errOf('net'); }
      if (!r.ok) throw errOf(r.status === 404 ? 'gone' : 'net', { status: r.status });
      if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); J.cur[f.name] = b.byteLength; tick(l); return b; }
      const rd = r.body.getReader(), parts = [];
      let n = 0;
      for (;;) {
        const x = await rd.read();
        if (x.done) break;
        parts.push(x.value); n += x.value.length;
        J.cur[f.name] = n; tick(l);
        if (n > f.bytes + 65536) { try { rd.cancel(); } catch (e) { /* 忽略 */ } throw errOf('bad'); }
      }
      const out = new Uint8Array(n);
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return out.buffer;
    } finally { if (ctl) J.ctl.delete(ctl); }
  }
  // 拆包、写进数据库（一批几百段一个事务），最后记下这个文件做完了
  async function ingest(l, m, T, nx, f, buf) {
    const J = job(l), add = { f: [], m: [] };
    try {
      if (f.kind === 'course') {
        const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
        await dbPut('doc', l + (nx ? '/course@next' : '/course'), doc);
      } else {
        const { items, at } = readBundle(buf);
        if (f.n != null && items.length !== f.n) throw errOf('bad');
        for (let i = 0; i < items.length; i += BATCH) {
          if (J.paused) throw Object.assign(new Error('paused'), { name: 'AbortError' });
          const tx = db.transaction('clip', 'readwrite'), st = tx.objectStore('clip');
          for (let j = i; j < Math.min(items.length, i + BATCH); j++) {
            const it = items[j];
            st.put(buf.slice(at[j], at[j] + it[2]), l + '/' + it[0] + '/' + it[1]);   // 一段一个 ArrayBuffer（slice 是复制，不连着整个包）
            if (add[it[0]]) add[it[0]].push(it[1]);
          }
          await txP(tx);
        }
      }
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.code)) throw e;
      if (quota(e)) throw errOf('space', { need: f.bytes, free: 0 });
      if (e instanceof SyntaxError || /bundle/.test(String(e && e.message))) throw errOf('bad');
      throw errOf('store');
    }
    if (M[l] !== m || J.removing) return;   // 半路被删掉了
    const was = stateOf(m);
    for (const g of ['f', 'm']) if (add[g].length) T.keys[g] = T.keys[g].concat(add[g]);
    T.files[f.name] = 'done';
    T.done = T.list.reduce((s, x) => s + (isDone(T, x) ? x.bytes : 0), 0);
    T.at = Date.now();
    if (!nx) m.state = stateOf(m);
    J.cur[f.name] = 0;
    await saveMeta(m);
    if (!nx && l === course()) for (const g of ['f', 'm']) for (const k of add[g]) KEYS[g].add(k);
    tick(l, true);
    if (stateOf(m) !== was) emitState(l);
  }
  // 更新下完了：换上新版本，再删旧版本里有、新版本里没有的那几段
  async function swapIn(l) {
    const m = M[l], nx = m.next;
    const nm = Object.assign({}, nx, { lang: l, state: 'full', at: Date.now(), paused: false, next: null });
    if (nx.list.some(f => f.kind === 'course')) { const d = await dbGet('doc', l + '/course@next'); if (d) await dbPut('doc', l + '/course', d); await dbDel('doc', l + '/course@next'); }
    await saveMeta(nm);
    M[l] = nm;
    setKeys(l);
    const keep = { f: new Set(nm.keys.f), m: new Set(nm.keys.m) }, gone = [];
    for (const g of ['f', 'm']) for (const k of m.keys[g] || []) if (!keep[g].has(k)) gone.push(l + '/' + g + '/' + k);
    for (let i = 0; i < gone.length; i += BATCH) {
      const tx = db.transaction('clip', 'readwrite'), st = tx.objectStore('clip');
      gone.slice(i, i + BATCH).forEach(k => st.delete(k));
      await txP(tx);
    }
    emitState(l);
  }
  // 暂停：停掉正在下的，记下来（下次打开不自己接着下，等人点）
  function pause(l) {
    if (!ON) return Promise.resolve(false);
    const J = job(l);
    J.paused = true; J.seq++;
    for (const c of J.ctl) { try { c.abort(); } catch (e) { /* 忽略 */ } }
    const m = M[l];
    const done = () => { emitState(l); return true; };
    if (!m || STORE !== 'idb') return Promise.resolve(done());
    m.paused = true;
    return saveMeta(m).then(done, done);
  }
  // 删除：先停下、等正在写的那一批写完，再删这门课的全部段、meta、course
  async function remove(l) {
    if (!ON) return false;
    await ready();
    if (STORE !== 'idb') return false;
    const J = job(l);
    J.paused = true; J.removing = true; J.seq++;
    for (const c of J.ctl) { try { c.abort(); } catch (e) { /* 忽略 */ } }
    if (J.runP) await J.runP.catch(() => {});
    try {
      await dbDelPrefix('clip', l + '/');
      await dbDel('meta', l);
      await dbDel('doc', l + '/course');
      await dbDel('doc', l + '/course@next');
    } finally {
      delete M[l];
      setKeys(l);
      if (l === course()) CONTENT = null;
      J.paused = false; J.removing = false; J.err = null; J.cur = {};
      emitState(l);
    }
    return true;
  }
  // 一段配音的地址（blob:）；用完由这里回收：下一段开始放时回收上一段
  function clip(k, g) {
    if (!ON || STORE !== 'idb' || !hasClip(k, g)) return Promise.resolve(null);
    const l = course();
    return dbGet('clip', l + '/' + g + '/' + k).then(ab => {
      if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { /* 忽略 */ } lastUrl = ''; }
      if (!ab) return null;
      lastUrl = URL.createObjectURL(new Blob([ab], { type: 'audio/ogg' }));
      return lastUrl;
    }, () => null);
  }
  function setCourse(l) {
    if (!LANGS.includes(l)) return false;
    LS('echo-course', l);
    try { location.reload(); } catch (e) { /* 测试里没有页面 */ }
    return true;
  }
  // 联网了：上次因为没网停下的接着下
  try { if (ON) root.addEventListener('online', () => { for (const l of Object.keys(JOB)) { const J = JOB[l]; if (J.err && J.err.code === 'net' && !J.busy && M[l] && !M[l].paused) install(l, { auto: true }); } }); } catch (e) { /* 没有页面 */ }

  // =====================================================================================
  // ③ 界面：首页一条、设置里「📦 课程和语音包」那一页、全新开始的「下载课程」页（SPEC §5）。字都在 pk.* 里
  // =====================================================================================
  const I18N = root.EchoI18n;
  const t = (k, p) => (I18N ? I18N.t(k, p) : k), h = (k, p) => (I18N ? I18N.h(k, p) : k);
  if (I18N) I18N.add({
    zh: {
      'pk.name.en': '英语', 'pk.name.zh': '中文', 'pk.name.ja': '日语', 'pk.name.es': '西班牙语',
      'pk.bar.get': '📦 下载{lang}语音包（{mb} MB）', 'pk.bar.get0': '📦 下载{lang}语音包', 'pk.bar.go': '下载',
      'pk.bar.part': '📦 {lang}语音包还差 {mb} MB 没下完', 'pk.bar.resume': '接着下',
      'pk.bar.busy': '📦 正在下载{lang}语音包 {pct}%', 'pk.bar.paused': '📦 {lang}语音包暂停了（{pct}%）',
      'pk.bar.err': '📦 {lang}语音包没下完：{why}', 'pk.bar.upd': '📦 {lang}语音包有新版本', 'pk.bar.nostore': '📦 这台设备存不了语音包，朗读会用备用的声音',
      'pk.bar.more': '看看',
      'pk.set.row': '📦 课程和语音包', 'pk.set.open': '打开', 'pk.set.note': '朗读用的配音放在网上，要学哪门语言再下载到这台设备上。',
      'pk.sh.title': '📦 课程和语音包', 'pk.sh.cur': '现在学：{lang}', 'pk.sh.total': '语音包一共占了 {mb} MB。', 'pk.soon': '更多语言正在准备，以后会加进来。',
      'pk.sh.upd': '有新版本（{ver}）：先下新的，下齐了再换掉旧的。', 'pk.sh.upding': '正在下载新版本（{ver}），下齐以前还用旧的。',
      'pk.sh.cell': '建议连着 Wi-Fi 下载。',
      'pk.st.none': '还没下载', 'pk.st.part': '下了一部分', 'pk.st.core': '可以用了，其余还在下', 'pk.st.full': '已装好',
      'pk.st.busy': '正在下载', 'pk.st.paused': '暂停了',
      'pk.size': '{done} / {all} MB', 'pk.size.all': '{mb} MB',
      'pk.btn.get': '下载（{mb} MB）', 'pk.btn.resume': '接着下', 'pk.btn.pause': '暂停', 'pk.btn.del': '删除', 'pk.btn.upd': '更新（{mb} MB）', 'pk.btn.retry': '再试一次',
      'pk.btn.done': '完成',
      'pk.del.h': '删除{lang}语音包？', 'pk.del.p': '删除以后朗读会改用备用的声音（要联网，或者用手机自带的声音），以后可以再下载。学习进度不受影响。',
      'pk.del.ok': '删除', 'pk.del.no': '先不删', 'pk.del.done': '删好了', 'pk.del.why': '删除语音包',
      'pk.err.net': '连不上网络，联网以后再试', 'pk.err.cat': '现在拿不到课程目录，联网以后再试', 'pk.err.space': '空间不够：还差 {mb} MB',
      'pk.err.store': '这台设备存不了语音包（可能开着无痕 / 隐私模式），朗读会用备用的声音', 'pk.err.bad': '下载的文件坏了，重下了几次还是不行，过一会儿再试',
      'pk.err.gone': '网上找不到这个语音包，过一会儿再试',
      'pk.first.h': '下载{lang}课程', 'pk.first.p': '朗读用的配音要先下载到这台设备上：一共约 {mb} MB，建议连着 Wi-Fi。',
      'pk.first.core': '先下最要紧的一部分（约 {mb} MB），下好就能开始，其余的在后台接着下。',
      'pk.first.go': '下载（{mb} MB）', 'pk.first.wait': '正在下最要紧的部分……{pct}%', 'pk.first.ok': '可以开始了！其余的在后台接着下。',
      'pk.first.next': '继续', 'pk.first.skip': '先不下，继续', 'pk.first.back': '返回', 'pk.first.load': '正在看有哪些课程……', 'pk.first.later': '没有语音包也能玩，朗读会用备用的声音。以后在设置「📦 课程和语音包」里下载。',
    },
    en: {
      'pk.name.en': 'English', 'pk.name.zh': 'Chinese', 'pk.name.ja': 'Japanese', 'pk.name.es': 'Spanish',
      'pk.bar.get': '📦 Download the {lang} voice pack ({mb} MB)', 'pk.bar.get0': '📦 Download the {lang} voice pack', 'pk.bar.go': 'Download',
      'pk.bar.part': '📦 {lang} voice pack: {mb} MB still to download', 'pk.bar.resume': 'Continue',
      'pk.bar.busy': '📦 Downloading the {lang} voice pack {pct}%', 'pk.bar.paused': '📦 {lang} voice pack paused ({pct}%)',
      'pk.bar.err': '📦 {lang} voice pack not finished: {why}', 'pk.bar.upd': '📦 New version of the {lang} voice pack', 'pk.bar.nostore': '📦 This device cannot store voice packs; a backup voice reads aloud',
      'pk.bar.more': 'See',
      'pk.set.row': '📦 Courses and voice packs', 'pk.set.open': 'Open', 'pk.set.note': 'The recorded voices are online; download the language you are learning to this device.',
      'pk.sh.title': '📦 Courses and voice packs', 'pk.sh.cur': 'Learning now: {lang}', 'pk.sh.total': 'Voice packs use {mb} MB in total.', 'pk.soon': 'More languages are on the way.',
      'pk.sh.upd': 'New version ({ver}): it downloads first and replaces the old one when complete.', 'pk.sh.upding': 'Downloading the new version ({ver}); the old one is used until it is complete.',
      'pk.sh.cell': 'Wi-Fi is recommended for downloading.',
      'pk.st.none': 'Not downloaded', 'pk.st.part': 'Partly downloaded', 'pk.st.core': 'Ready to use, the rest is downloading', 'pk.st.full': 'Installed',
      'pk.st.busy': 'Downloading', 'pk.st.paused': 'Paused',
      'pk.size': '{done} / {all} MB', 'pk.size.all': '{mb} MB',
      'pk.btn.get': 'Download ({mb} MB)', 'pk.btn.resume': 'Continue', 'pk.btn.pause': 'Pause', 'pk.btn.del': 'Delete', 'pk.btn.upd': 'Update ({mb} MB)', 'pk.btn.retry': 'Try again',
      'pk.btn.done': 'Done',
      'pk.del.h': 'Delete the {lang} voice pack?', 'pk.del.p': 'After deleting, a backup voice reads aloud (online, or the device voice). You can download it again later. Learning progress is not affected.',
      'pk.del.ok': 'Delete', 'pk.del.no': 'Keep it', 'pk.del.done': 'Deleted', 'pk.del.why': 'delete a voice pack',
      'pk.err.net': 'No connection; try again when online', 'pk.err.cat': 'The course list is not available right now; try again when online', 'pk.err.space': 'Not enough space: {mb} MB more needed',
      'pk.err.store': 'This device cannot store voice packs (private browsing?); a backup voice reads aloud', 'pk.err.bad': 'The download kept arriving damaged; try again later',
      'pk.err.gone': 'This voice pack is not online; try again later',
      'pk.first.h': 'Download the {lang} course', 'pk.first.p': 'The recorded voices need to be downloaded to this device: about {mb} MB in total. Wi-Fi is recommended.',
      'pk.first.core': 'The most important part (about {mb} MB) comes first; you can start as soon as it is ready, and the rest downloads in the background.',
      'pk.first.go': 'Download ({mb} MB)', 'pk.first.wait': 'Downloading the most important part… {pct}%', 'pk.first.ok': 'Ready to start! The rest keeps downloading in the background.',
      'pk.first.next': 'Continue', 'pk.first.skip': 'Skip for now', 'pk.first.back': 'Back', 'pk.first.load': 'Checking the course list…', 'pk.first.later': 'You can play without the voice pack; a backup voice reads aloud. Download it later in Settings, "📦 Courses and voice packs".',
    },
  });
  let G = null;            // game.js 给的工具（init）
  let FIRST = null;        // 「下载课程」页开着时：{ lang, paint, live, next }
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uiLang = () => (I18N && I18N.lang ? I18N.lang() : 'zh');
  // 大小按 MiB 显示（和 SPEC 里「99 MB」一样）：10 以上取整，以下一位小数
  const mbOf = n => { const v = (n || 0) / 1048576; return v >= 10 ? String(Math.round(v)) : v > 0 ? String(Math.max(0.1, Math.round(v * 10) / 10)) : '0'; };
  const pctOf = (a, b) => (b > 0 ? Math.min(100, Math.floor(a * 100 / b)) : 0);
  function langName(l) {
    const c = CAT && CAT.packs && CAT.packs[l];
    const n = c && c.name ? c.name[uiLang()] || c.name.en : '';
    if (n) return n;
    const k = 'pk.name.' + l, v = t(k);
    return v !== k ? v : l;
  }
  function errText(e) {
    if (!e) return '';
    if (e.code === 'space') return t('pk.err.space', { mb: mbOf(Math.max(1, (e.need || 0) - (e.free || 0))) });
    return t({ net: 'pk.err.net', cat: 'pk.err.cat', store: 'pk.err.store', bad: 'pk.err.bad', gone: 'pk.err.gone' }[e.code] || 'pk.err.net');
  }
  function stText(i) {
    if (STORE === 'none') return t('pk.err.store');
    if (i.busy) return t('pk.st.busy') + ' ' + pctOf(i.done, i.bytes) + '%';
    if (i.paused && i.state !== 'full') return t('pk.st.paused');
    return t('pk.st.' + i.state);
  }
  // 这一页列哪几门：目录里有、引擎支持的，加上已经装了的
  function shown() {
    const ls = new Set(LANGS.filter(l => !CAT || !CAT.packs || CAT.packs[l] || M[l]));
    for (const l of Object.keys(M)) if (LANGS.includes(l)) ls.add(l);
    ls.add(course());
    return [...ls].filter(l => LANGS.includes(l));
  }

  // 首页一条（game.js 的 homeBars）：没下 / 下了一部分 / 正在下 / 出错 / 有新版本；装好了就没有
  function homeBar() {
    if (!ON || !G) return '';
    const L = course(), i = info(L), nm = langName(L);
    const bar = (txt, em, cls) => '<button class="pk-bar' + (cls ? ' ' + cls : '') + '" id="pk-bar" data-act="pkBar"><span id="pk-bar-t">' + txt + '</span>' + (em ? '<em>' + em + '</em>' : '') + '</button>';
    if (STORE === 'none') return bar(h('pk.bar.nostore'), h('pk.bar.more'), 'warn');
    if (!STORE) return '';
    if (i.busy) return bar(h('pk.bar.busy', { lang: nm, pct: pctOf(i.done, i.bytes) }), h('pk.bar.more'));
    if (i.err) return bar(h('pk.bar.err', { lang: nm, why: errText(i.err) }), h('pk.btn.retry'), 'warn');
    if (i.state === 'full') return i.update ? bar(h('pk.bar.upd', { lang: nm }), h('pk.bar.more')) : '';
    if (i.state === 'none') return bar(i.bytes ? h('pk.bar.get', { lang: nm, mb: mbOf(i.bytes) }) : h('pk.bar.get0', { lang: nm }), h('pk.bar.go'));
    if (i.paused) return bar(h('pk.bar.paused', { lang: nm, pct: pctOf(i.done, i.bytes) }), h('pk.bar.resume'));
    return bar(h('pk.bar.part', { lang: nm, mb: mbOf(i.bytes - i.done) }), h('pk.bar.resume'));
  }
  // 设置页里的一行（game.js 的 settingsSheet）
  function settingsRow() {
    if (!ON || !G) return '';
    const L = course();
    return '<div class="set" id="set-packs"><label>' + h('pk.set.row') + '</label><div class="say-row"><span class="set-v">' + esc(langName(L)) + ' · ' + esc(stText(info(L))) + '</span>' +
      '<button class="btn small ghost" data-act="pkSet">' + h('pk.set.open') + '</button></div><small>' + h('pk.set.note') + '</small></div>';
  }
  function rowHTML(l) {
    const i = info(l), btn = (act, k, p, cls) => '<button class="btn small' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-l="' + esc(l) + '">' + h(k, p) + '</button>';
    const b = [];
    if (STORE === 'idb') {
      if (i.busy) b.push(btn('pkPause', 'pk.btn.pause', null, 'ghost'));
      else if (i.state === 'none') b.push(i.bytes ? btn('pkGet', 'pk.btn.get', { mb: mbOf(i.bytes) }) : btn('pkGet', 'pk.bar.go'));   // 不知道多大：目录取不到，点了会说清楚
      else if (i.state !== 'full' || i.next) b.push(btn('pkGet', i.err ? 'pk.btn.retry' : 'pk.btn.resume'));
      else if (i.update) b.push(btn('pkGet', 'pk.btn.upd', { mb: mbOf((CAT && CAT.packs[l] && CAT.packs[l].bytes) || 0) }));
      if (i.state !== 'none' && !i.busy) b.push(btn('pkDel', 'pk.btn.del', null, 'ghost'));
    }
    const prog = i.state !== 'none' || i.busy;
    return '<div class="pk-row" data-l="' + esc(l) + '"><div class="pk-top"><b>' + esc(langName(l)) + (l === course() ? ' ✓' : '') + '</b><span id="pk-st-' + esc(l) + '">' + esc(stText(i)) + '</span></div>' +
      (prog ? '<div class="pk-prog"><i id="pk-p-' + esc(l) + '" style="width:' + pctOf(i.done, i.bytes) + '%"></i></div><small id="pk-t-' + esc(l) + '">' + h('pk.size', { done: mbOf(i.done), all: mbOf(i.bytes) }) + '</small>'
        : i.bytes ? '<small>' + h('pk.size.all', { mb: mbOf(i.bytes) }) + '</small>' : '') +
      (i.next ? '<small>' + h('pk.sh.upding', { ver: i.next }) + '</small>' : i.update ? '<small>' + h('pk.sh.upd', { ver: CAT.packs[l].ver }) + '</small>' : '') +
      (i.err ? '<p class="pk-warn">' + esc(errText(i.err)) + '</p>' : '') +
      (b.length ? '<div class="say-row">' + b.join('') + '</div>' : '') + '</div>';
  }
  let fromSet = false;
  // 设置里「📦 课程和语音包」那一页
  function sheet(fromSettings) {
    if (!G) return;
    if (fromSettings !== undefined) fromSet = !!fromSettings;
    const L = course(), used = Object.keys(M).reduce((s, l) => s + info(l).used, 0);
    G.openModal('<div id="pk-sheet"><h2>' + h('pk.sh.title') + '</h2>' +
      '<p>' + h('pk.sh.cur', { lang: langName(L) }) + '</p>' +
      (STORE === 'none' ? '<p class="pk-warn">' + h('pk.err.store') + '</p>' : '') +
      '<div class="pk-list">' + shown().map(rowHTML).join('') + '</div>' +
      '<p class="tip">' + h('pk.sh.total', { mb: mbOf(used) }) + ' ' + h('pk.sh.cell') + ' ' + h('pk.soon') + '</p>' +
      '<button class="btn wide" data-act="' + (fromSet ? 'setBack' : 'close') + '" data-focus>' + h('pk.btn.done') + '</button></div>');
    if (!CAT_FRESH) catalog().then(() => { if ($('#pk-sheet')) sheet(); }, () => {});
  }
  function delAsk(l) {
    const go = () => G.openModal('<div class="big">🗑️</div><h2>' + h('pk.del.h', { lang: langName(l) }) + '</h2><p>' + h('pk.del.p') + '</p>' +
      '<div class="row"><button class="btn ghost" data-act="pkSheet" data-focus>' + h('pk.del.no') + '</button><button class="btn" data-act="pkDelGo" data-l="' + esc(l) + '">' + h('pk.del.ok') + '</button></div>');
    // 孩子模式要家长密码（「自己学」时 parentOk 直接过）
    if (G.kidMode && G.kidMode()) G.parentOk(t('pk.del.why'), go); else go();
  }

  // 全新的开始，能力检测「选语言」之后的那一页（placement.js 调）：要下就画出来、返回 true；老模式 / 已经能用了返回 false
  // ctx = { paint(html), live() 这一页还开着吗, next() 往下走 }
  function firstStep(l, ctx) {
    if (!ON || !G || !LANGS.includes(l)) return false;
    const i = info(l);
    if (STORE === 'idb' && (i.state === 'core' || i.state === 'full')) return false;
    FIRST = Object.assign({ lang: l }, ctx);
    paintFirst(true);   // 第一次画：这时候 placement 还在「选语言」那一页，live() 还不是 true
    if (!CAT_FRESH) catalog().then(() => paintFirst(), () => paintFirst());
    return true;
  }
  function paintFirst(first) {
    const F = FIRST;
    if (!F) return;
    if (!first && !F.live()) { FIRST = null; return; }
    const i = info(F.lang), nm = langName(F.lang), ok = i.state === 'core' || i.state === 'full';
    const pct = pctOf(i.coreDone, i.core), err = STORE === 'none' ? { code: 'store' } : i.err;
    let body = '<p>' + (i.bytes ? h('pk.first.p', { mb: mbOf(i.bytes) }) : h('pk.first.load')) + '</p>' + (i.core ? '<p>' + h('pk.first.core', { mb: mbOf(i.core) }) + '</p>' : '');
    let nav;
    if (err) {
      body += '<p class="pk-warn">' + esc(errText(err)) + '</p><p class="pl-note">' + h('pk.first.later') + '</p>';
      nav = '<button class="btn ghost" data-act="pkFirstSkip">' + h('pk.first.skip') + '</button>' + (STORE === 'idb' ? '<button class="btn" data-act="pkFirstGet" data-focus>' + h('pk.btn.retry') + '</button>' : '');
    } else if (ok) {
      body += '<div class="pk-prog"><i id="pk-first-p" style="width:100%"></i></div><p class="pk-ok" id="pk-first-t">' + h('pk.first.ok') + '</p>';
      nav = '<button class="btn ghost" data-act="plGo" data-to="lang">' + h('pk.first.back') + '</button><button class="btn sun" data-act="pkFirstGo" data-focus>' + h('pk.first.next') + '</button>';
    } else if (i.busy || i.state !== 'none') {
      body += '<div class="pk-prog"><i id="pk-first-p" style="width:' + pct + '%"></i></div><p id="pk-first-t">' + h('pk.first.wait', { pct }) + '</p>';
      nav = '<button class="btn ghost" data-act="plGo" data-to="lang">' + h('pk.first.back') + '</button><button class="btn" data-act="pkFirstGo" disabled>' + h('pk.first.next') + '</button>';
    } else {
      nav = '<button class="btn ghost" data-act="plGo" data-to="lang">' + h('pk.first.back') + '</button><button class="btn sun" data-act="pkFirstGet" data-focus' + (i.bytes ? '' : ' disabled') + '>' + (i.bytes ? h('pk.first.go', { mb: mbOf(i.bytes) }) : h('pk.bar.go')) + '</button>';
    }
    F.paint('<div class="pl-step" id="pk-first"><div class="pl-hero">📦</div><h2>' + h('pk.first.h', { lang: nm }) + '</h2>' + body + '</div><div class="pl-nav">' + nav + '</div>');
  }
  // 下载进度：不重画整页，只改进度条和那一行字
  function onProgress(d) {
    const i = info(d.lang), pct = pctOf(i.done, i.bytes);
    if (d.lang === course()) { const bt = $('#pk-bar-t'); if (bt && i.busy) bt.textContent = t('pk.bar.busy', { lang: langName(d.lang), pct }); }
    const p = document.getElementById('pk-p-' + d.lang), tx = document.getElementById('pk-t-' + d.lang);
    if (p) p.style.width = pct + '%';
    if (tx) tx.textContent = t('pk.size', { done: mbOf(i.done), all: mbOf(i.bytes) });
    const st = document.getElementById('pk-st-' + d.lang);
    if (st) st.textContent = stText(i);
    if (FIRST && FIRST.lang === d.lang && FIRST.live() && !(i.state === 'core' || i.state === 'full')) {
      const fp = $('#pk-first-p'), ft = $('#pk-first-t'), cp = pctOf(i.coreDone, i.core);
      if (fp) fp.style.width = cp + '%';
      if (ft) ft.textContent = t('pk.first.wait', { pct: cp });
    }
  }
  function onState(d) {
    if (!G) return;
    if (G.refreshBars) G.refreshBars();
    if ($('#pk-sheet')) sheet();
    if (FIRST && FIRST.lang === d.lang) paintFirst();
  }

  // game.js 在课程包模式下调：拿工具、给按钮
  function init(api) {
    G = api;
    on_('progress', onProgress);
    on_('state', onState);
    return {
      // 首页那一条：没下 / 没下完 / 出错 → 点一下就开始下（第一次下要人点这一下，条上写着多少 MB）；正在下、装好了 → 打开那一页
      // 还不知道多大（目录还没取到）：先打开那一页（那一页去取目录、写上大小），不直接开始下
      pkBar: () => { const L = course(), i = info(L); if (STORE !== 'idb' || i.busy || (i.state === 'full' && !i.err) || (i.state === 'none' && !i.bytes)) { sheet(false); return; } install(L); if (G.refreshBars) G.refreshBars(); },
      pkSheet: () => sheet(),
      pkSet: () => sheet(true),
      pkGet: el => { install(el.dataset.l); sheet(); },
      pkPause: el => { pause(el.dataset.l).then(() => { if ($('#pk-sheet')) sheet(); }); },
      pkDel: el => delAsk(el.dataset.l),
      pkDelGo: el => { const l = el.dataset.l; remove(l).then(() => { if (G.toast) G.toast(t('pk.del.done')); sheet(); }); },
      pkFirstGet: () => { if (FIRST) { install(FIRST.lang); paintFirst(); } },
      pkFirstGo: () => { const F = FIRST; if (!F) return; const s = info(F.lang).state; if (s === 'core' || s === 'full') { FIRST = null; F.next(); } },
      pkFirstSkip: () => { const F = FIRST; if (!F) return; FIRST = null; F.next(); },
    };
  }

  const api = {
    get on() { return ON; }, get base() { return BASE; }, get store() { return STORE; },
    LANGS, course, ready, state, info, catalog, install, pause, remove, hasClip, clip, setCourse, on_,
    content: () => (course() === 'en' ? null : CONTENT),
    // 界面（game.js / placement.js 调）
    init, homeBar, settingsRow, sheet, firstStep,
    _: pure,
  };
  root.EchoPacks = api;
})(typeof window !== 'undefined' ? window : globalThis);
