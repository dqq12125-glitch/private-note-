// 回声岛 · 要学的语言（window.EchoLang / Node 模块，2026-11-20）
// 英语以外的三门语言各有一个文件：lang-es.js 西班牙语、lang-ja.js 日语、lang-zh.js 中文（普通话，另有汉字拼音表 lang-zh-data.js）。
// 每个文件把自己登记到这里：reg(代码, 模块)；用的时候 get(代码) / has(代码) / list()。英语的打分还在 game.js 里（以后包成 'en' 也登记进来）。
// 这里只放三门语言共用的东西：
//   lev(a, b)                        编辑距离（字符串或数组）
//   alignSpans(n, H, wt, val, span, pref)  按顺序把目标的 n 个块对到听到的 H 个单位上：一块可以对一段，也可以没对上（加权的最长公共子序列）
//   contig(n, H, val, span)          目标的块是不是在听到的话里连着、按顺序、一个不差地说出来了（前后多说几个词也行）
//   finish(o)                        打分收尾：0–100 分、每块对没对、最后一块按顺序说了没有、是不是全对——和 game.js 的 scoreSpeech 同一套分数线
//   lexicon(语言, 课程条目)            课程里每个词 t → r、每个句子 seg[i] → r[i] 做成的读音表（日语、中文把识别结果换成读音时先查它）
//   best(模块, 目标, 候选们, ctx) / early(模块, 目标, 听到的, ctx)
// 打分的规矩和英语一样（家长 2026-10-07 定，CLAUDE.md「打分要诚实」）：识别服务不知道答案；易混的音不算对；只错词尾算半对（四分之三）、
// 不给 Perfect；同音的算对；漏掉（或说错）四分之一以上的关键实词不过关（最多 50 分）；有一个块没说对就不给 Perfect（最多 84 分）。
// 比英语多一条（negCap）：听到的话里多了一个目标里没有的否定词（no / 不 / ません），意思反了，和漏掉否定词一样不过关。
// 分数线：90 分以上而且最后一块按顺序说出来了 → 秒出分；60 分及格；85 分以上要每一块都对。
// 加载时不碰 DOM；Node 里 require('./lang.js') 拿到的是同一个对象（语言文件 require 它再登记）。
(function (root) {
  'use strict';
  const REG = Object.create(null);
  const reg = (code, mod) => { if (mod && typeof mod === 'object') { mod.code = code; REG[code] = mod; } return mod; };
  const get = code => REG[code] || null;
  const has = code => !!REG[code];
  const list = () => Object.keys(REG);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // 编辑距离：字符串按字（码位）比，数组按元素比
  function lev(a, b) {
    a = typeof a === 'string' ? Array.from(a) : a || [];
    b = typeof b === 'string' ? Array.from(b) : b || [];
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // 按顺序对齐（加权的最长公共子序列，块可以对一段）：
  // n 个目标块、听到的 H 个单位；块 i 可以对 [k, j)，长度在 span(i) = [最短, 最长] 之间；val(i, k, j) → 0 不对 / 3 只错了词尾 / 4 对。
  // 得分 = Σ 权重 × val 最大；一样多时选长度最接近 pref(i) 的那段。返回 got[i]（0 / 3 / 4）和 at[i]（对上的那段 [k, j]，没对上是 null）。
  // 和 game.js 的 align 一样：倒着找回去时先认「对上」，再按 dp 大小决定跳过目标还是跳过听到的。
  function alignSpans(n, H, wt, val, span, pref) {
    const dp = [], from = [], gv = [];
    for (let i = 0; i <= n; i++) { dp.push(new Float64Array(H + 1)); from.push(new Int32Array(H + 1).fill(-1)); gv.push(new Int8Array(H + 1)); }
    for (let i = 1; i <= n; i++) {
      const sp = span(i - 1), lo = Math.max(1, sp[0]), hi = sp[1], w = wt[i - 1], want = pref ? pref(i - 1) : lo;
      for (let j = 0; j <= H; j++) {
        let best = dp[i - 1][j];
        if (j > 0 && dp[i][j - 1] > best) best = dp[i][j - 1];
        let mv = -1, mk = -1, mvv = 0, md = 1e9;
        for (let L = lo; L <= hi && L <= j; L++) {
          const k = j - L, v = val(i - 1, k, j);
          if (!v) continue;
          const sc = dp[i - 1][k] + w * v, d = Math.abs(L - want);
          if (sc > mv || (sc === mv && d < md)) { mv = sc; mk = k; mvv = v; md = d; }
        }
        if (mk >= 0 && mv >= best) { best = mv; from[i][j] = mk; gv[i][j] = mvv; }
        dp[i][j] = best;
      }
    }
    const got = new Array(n).fill(0), at = new Array(n).fill(null);
    let i = n, j = H;
    while (i > 0 && j > 0) {
      const k = from[i][j];
      if (k >= 0 && dp[i][j] === dp[i - 1][k] + wt[i - 1] * gv[i][j]) { got[i - 1] = gv[i][j]; at[i - 1] = [k, j]; i--; j = k; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    return { got, at };
  }

  // 目标的 n 块是不是一块接一块、每块都对（val = 4）地出现在听到的话里（可以从中间开始、后面还有）；whole = true 时要从头到尾正好说完
  function contig(n, H, val, span, whole) {
    if (!n || !H) return false;
    for (let k = 0; k < H; k++) {
      if (whole && k > 0) break;
      let ends = new Set([k]);
      for (let i = 0; i < n && ends.size; i++) {
        const nx = new Set(), sp = span(i);
        ends.forEach(a => { for (let L = Math.max(1, sp[0]); L <= sp[1] && a + L <= H; L++) if (val(i, a, a + L) === 4) nx.add(a + L); });
        ends = nx;
      }
      if (whole ? ends.has(H) : ends.size) return true;
    }
    return false;
  }

  // 打分收尾（和 game.js 的 scoreSpeech 一模一样的算法，只是「单位」交给各门语言定）：
  // o.items：打分的单位（西语是词，日语、中文是 seg 的一块），每个 { wt 权重 1 虚词 / 2 实词, n 这个单位有几个最小单位（拍 / 音节 / 词，算 F1 用）,
  //          piece 属于第几块显示的块, name 是不是名字（名字不算进「关键实词」） }
  // o.got：每个单位对上多少（0 / 3 / 4）；o.pieces：显示的块有几个；o.nH：听到的最小单位有几个；
  // o.whole（单位 ≤ 2 个时）：{ eq 整个一样, split 分词不同（只有西语有）, sim 0–1 的相似度 }；o.contig：连着说出来了（单位 ≤ 3 个时算满分）
  function finish(o) {
    const it = o.items || [], got = o.got || [], m = it.length, P = o.pieces || 0;
    if (!m || !o.nH) return { score: 0, marks: new Array(P).fill(false), last: false, full: false };
    let W = 0, G = 0, hit = 0, nT = 0;
    it.forEach((x, i) => { W += x.wt * 4; G += got[i] * x.wt; hit += got[i] / 4 * x.n; nT += x.n; });
    const recall = G / W, f1 = 2 * hit / (nT + o.nH);
    let s = 0.6 * recall + 0.4 * f1, same = false;
    if (m <= 2 && o.whole) {
      const w = o.whole;
      if (w.eq) { s = 1; same = true; }                                   // 整个一样（只是分词 / 写法不同）
      else if (w.split) s = Math.max(s, Math.min(0.84, w.sim || 0));      // 分词不同又差一点
      else if (s < 0.5) s = Math.max(s, Math.min(0.5, w.sim || 0));       // 说成了别的词：给个参考分，不过关
    } else s = s * s * (2 - s);                                           // 句子：漏读的扣分更明显
    if (m <= 3 && o.contig) { s = 1; same = true; }                       // 短的按顺序完整说出来了（前后多说几个词也行）
    const marks = new Array(P).fill(true);
    it.forEach((x, i) => { if (got[i] !== 4) marks[x.piece] = false; });
    if (same || (P === 1 && s >= 0.9)) marks.fill(true);
    if (nT >= 3 && !same) {
      const content = [];
      it.forEach((x, i) => { if (x.wt === 2 && !x.name) content.push(i); });
      const miss = content.filter(i => !got[i]).length;
      if (content.length && miss / content.length >= 0.25) s = Math.min(s, 0.5);   // 关键的实词没说出来：不过关
      else if (miss) s = Math.min(s, 0.84);
    }
    const full = marks.every(Boolean);
    if (!full) s = Math.min(s, 0.84);                                     // Perfect 要每一块都说对
    return { score: Math.round(clamp(s, 0, 1) * 100), marks, last: same || got[m - 1] === 4, full };
  }

  // 意思说反了：听到的话里多了一个否定词（目标里没有、也没对上目标的哪一块），和漏掉否定词一样不过关（最多 50 分、不给 Perfect）。
  // 英语那边漏掉 not 不过关（tests/review.test.js），这里把「多说了一个 不 / no / ません」也补上
  function negCap(r, extra) {
    if (!extra) return r;
    return Object.assign(r, { score: Math.min(r.score, 50), full: false });
  }
  // 听到的第几个单位被对上了（at 是 alignSpans 给的）
  function covered(at, got, H) {
    const c = new Array(H).fill(false);
    (at || []).forEach((a, i) => { if (a && got[i]) for (let x = a[0]; x < a[1]; x++) c[x] = true; });
    return c;
  }

  // 走一遍课程内容（数组、对象嵌套都行），每个带字符串 t 的对象交给 f
  function walk(x, f, depth) {
    depth = depth || 0;
    if (!x || typeof x !== 'object' || depth > 10) return;
    if (Array.isArray(x)) { x.forEach(y => walk(y, f, depth + 1)); return; }
    if (typeof x.t === 'string') f(x);
    Object.keys(x).forEach(k => { const v = x[k]; if (v && typeof v === 'object') walk(v, f, depth + 1); });
  }

  // 读音表：{ lang, map: 写法 → [读音…], ctx: 写法 → [读音…]（后面要跟着平假名才算，日语动词形容词的词干用）, max 最长的写法有几个字, n 条数 }
  // 语言模块的 lexPairs(条目) 给出 [[写法, 读音, 'c'?], …]；同一个写法有几种读音都留着（先来的在前）
  function lexNew(lang) { return { lang, map: new Map(), ctx: new Map(), max: 0, n: 0 }; }
  function lexAdd(lex, k, v, kind) {
    if (!k || !v) return;
    const M = kind === 'c' ? lex.ctx : lex.map, a = M.get(k);
    if (a) { if (!a.includes(v)) a.push(v); return; }
    M.set(k, [v]); lex.n++;
    const len = Array.from(k).length;
    if (len > lex.max) lex.max = len;
  }
  function lexicon(lang, entries) {
    const mod = get(lang), lex = lexNew(lang);
    if (!mod || typeof mod.lexPairs !== 'function') return lex;
    walk(entries, e => (mod.lexPairs(e) || []).forEach(p => lexAdd(lex, p[0], p[1], p[2])));
    return lex;
  }

  // 几个识别候选里挑分最高的（没有候选：0 分，marks 全是 false）
  function best(mod, target, alts, ctx) {
    let b = null;
    (alts || []).forEach(a => { const r = mod.score(target, a, ctx); if (!b || r.score > b.score) b = Object.assign({}, r, { heard: a }); });
    return b || Object.assign({}, mod.score(target, '', ctx), { heard: '' });
  }
  // 秒出分：90 分以上，而且目标的最后一块已经按顺序说出来了
  function early(mod, target, heard, ctx) {
    const r = mod.score(target, heard, ctx);
    return r.score >= 90 && r.last;
  }
  // 级别 0–5 的整数，别的当没给（null）
  const lvOk = v => (typeof v === 'number' && v >= 0 && v <= 5 && v === Math.floor(v) ? v : null);

  const api = { reg, get, has, list, clamp, lev, alignSpans, contig, finish, negCap, covered, walk, lexicon, lexNew, lexAdd, best, early, lvOk };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoLang = api;
})(typeof window !== 'undefined' ? window : globalThis);
