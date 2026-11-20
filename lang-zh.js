// 回声岛 · 中文（普通话）（EchoLang.reg('zh')；也是 Node 模块）——口语打分、提示、排句子、聊天算句数、名字、数字
// 先加载 lang.js 和 lang-zh-data.js（常用汉字的拼音表，tools/lang/gen-zh-data.py 生成）。接口见 lang.js 和 tests/lang.test.js。
//
// 打分按「不带声调的拼音音节」比（和英语 game.js 的 scoreSpeech 同一套分数线，规矩见 lang.js 开头）：
// · **声调不打分**：识别服务给的是汉字，看不出学的人声调对不对（说成四声它也可能照样写对的字），所以这里一律不比声调，界面上也不能说「声调对了」。
// · 目标：课程条目的 seg（词）和每块的拼音 r（带声调，这里去掉声调）；多音字按 r 读（银行 yín háng、睡觉 shuì jiào）。显示、标红标绿按 seg 一块一块来。
// · 识别结果（简体汉字，同音字很常见：他 / 她 / 它、在 / 再、做 / 作，也会写数字）：数字先变成汉字（2 → 二 / 两，3:30 → 三点半 / 三点三十，
//   2026年 → 二零二六年，5月3日 的「日」也认「号」）；再按读音表换成音节：先查这道题自己的 seg / r，再查整门课的读音表（ctx.lex），
//   再查自带的几十个多音词，最后查拼音表（7000 个常用字）。一个字有几种常用读音的，哪个对得上算哪个；同一个字一定算对。
// · 同音字算对（音节一样）。易混的音不算对：zh / z、ch / c、sh / s、n / l、-n / -ng、r / l……识别服务真的写成了另一个音节的字（四 / 十、牛 / 流、
//   山 / 三、金 / 京），就是没说对。
// · 儿化（哪儿 nǎr、一点儿）、轻声（谢谢 xièxie）不影响对齐：儿化的「儿」两边都不算一个音节（女儿、儿子这种「儿」是一个音节的词例外）。
// · 一块对没对：每个音节都对 = 对；只差量词（一只 / 一个）或者只差块尾的 了 / 着 / 过 / 的 / 们 = 半对（¾，不给 Perfect）；别的算错。
// · 虚词（我 你 他 是 有 在 的 了 吗 很 也 都 这 那……）权重 1，其余是实词（权重 2）。不、没、别 改变意思，算实词；
//   多说了一个目标里没有的 不 / 没 / 别（我喜欢猫 → 我不喜欢猫）整句不过关。
// · 只差声调就变成别的词（买 / 卖、雨 / 鱼）也算对——这是「声调不打分」的代价，界面上不要说「发音全对」。
// · 名字：ctx.names 里的、自带的常见名字（小明、丽丽……）、叠字名（不是爸爸妈妈这种）：拼音只差一个字母也算对（同音字本来就算对），
//   不算进「关键实词」（识别服务常把名字写成别的字）。
// · 拼音表里没有的字（生僻字、字母）：按字本身比（一样就对）。
// 已知的不足：声调不打分；拼音表只有常用字；多音字的「常用读音」是按词频统计的，个别冷门读音不认（同一个字照样算对）；
// 识别服务用繁体字（zh-TW）时拼音表大多查不到，只能按字比——所以 appleAlt 里不放 zh-TW。
(function (root) {
  'use strict';
  const L = root.EchoLang || (typeof module !== 'undefined' && module.exports && typeof require === 'function' ? require('./lang.js') : null);

  // ---------- 拼音表 ----------
  let PY = null, SYL = null;
  function data() {
    if (PY) return PY;
    PY = new Map(); SYL = new Set();
    let D = root.EchoZhPinyin || null;
    if (!D && typeof module !== 'undefined' && module.exports && typeof require === 'function') { try { D = require('./lang-zh-data.js'); } catch (e) { D = null; } }
    if (!D) return PY;
    D.py.replace(/([a-z]+)([^a-z]+)/g, (m, s, cs) => { SYL.add(s); for (const c of cs) PY.set(c, [s]); return ''; });
    D.alt.replace(/([^a-z,])([a-z,]+)/g, (m, c, ss) => { const a = PY.get(c) || []; ss.split(',').filter(Boolean).forEach(s => { SYL.add(s); if (!a.includes(s)) a.push(s); }); PY.set(c, a); return ''; });
    ['er', 'ng', 'm', 'n', 'hm', 'yo', 'o', 'ei', 'ri'].forEach(s => SYL.add(s));
    return PY;
  }
  const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff〇]/;
  const PUN = /[\s\u3000，。、；：？！…—～·《》〈〉「」『』（）【】“”‘’,.;:?!"'()\[\]{}<>~\-_/\\|]/;
  const pyOf = c => (data().get(c) || []);
  // 拼音（带声调、可能连写、可能有隔音符号）→ [{ s 音节, r 儿化 }]；分不开返回 null
  function parsePy(r) {
    data();
    let s = String(r || '').normalize('NFD').replace(/u\u0308/g, 'v').replace(/U\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v');
    const chunks = s.split(/[^a-zv]+/).filter(Boolean), out = [];
    for (const ch of chunks) {
      const n = ch.length, best = new Array(n + 1).fill(null);
      best[0] = [];
      for (let i = 0; i < n; i++) {
        if (!best[i]) continue;
        for (let j = i + 1; j <= Math.min(n, i + 7); j++) {
          const w = ch.slice(i, j);
          let it = null;
          if (SYL.has(w)) it = { s: w, r: false };
          else if (w.length > 1 && w.endsWith('r') && SYL.has(w.slice(0, -1))) it = { s: w.slice(0, -1), r: true };
          if (!it) continue;
          const cand = best[i].concat([it]);
          if (!best[j] || cand.length < best[j].length) best[j] = cand;
        }
      }
      if (!best[n]) return null;
      out.push(...best[n]);
    }
    return out;
  }

  // ---------- 数字 ----------
  const DG = '零一二三四五六七八九';
  function zhNum(n) {
    n = Math.floor(Math.abs(+n) || 0);
    if (n < 10) return DG[n];
    if (n < 20) return '十' + (n % 10 ? DG[n % 10] : '');
    if (n < 100) return DG[Math.floor(n / 10)] + '十' + (n % 10 ? DG[n % 10] : '');
    const tail = (r, unit) => (!r ? '' : r < unit / 10 ? '零' + (r >= 10 && r < 20 ? '一' + zhNum(r) : zhNum(r)) : (r >= 10 && r < 20 ? '一' + zhNum(r) : zhNum(r)));
    if (n < 1000) return DG[Math.floor(n / 100)] + '百' + tail(n % 100, 100);
    if (n < 10000) return DG[Math.floor(n / 1000)] + '千' + tail(n % 1000, 1000);
    if (n < 1e8) return zhNum(Math.floor(n / 10000)) + '万' + tail(n % 10000, 10000);
    return String(n);
  }
  const digitwise = d => Array.from(d).map(x => DG[+x]).join('');
  // 钟点的几种说法（2 点 = 两点）
  function timeWays(h, m) {
    const H = (h === 2 ? '两' : zhNum(h)) + '点', M = zhNum(m);
    if (!m) return [H, H + '整'];
    if (m === 30) return [H + '半', H + '三十', H + '三十分'];
    if (m === 15) return [H + '十五', H + '十五分', H + '一刻'];
    if (m === 45) return [H + '四十五', H + '四十五分', H + '三刻'];
    if (m < 10) return [H + '零' + M, H + '零' + M + '分', H + M + '分'];
    return [H + M, H + M + '分'];
  }
  function variants(heard) {
    let vs = [String(heard || '').normalize('NFKC')];
    const re = /(\d{1,2})\s*[:：]\s*(\d{2})/;
    for (let k = 0; k < 3; k++) {
      if (!re.test(vs[0])) break;
      const nx = [];
      vs.forEach(v => { const m = re.exec(v); if (!m) { nx.push(v); return; } timeWays(+m[1], +m[2]).forEach(w => nx.push(v.slice(0, m.index) + w + v.slice(m.index + m[0].length))); });
      vs = nx.slice(0, 8);
    }
    return vs;
  }
  // 一段文字 → 字的记录 [{ c, x 另外也算的音节 }]：数字变汉字（2 → 二 / 两……），标点空格去掉，字母连着的算一个
  function recs(text) {
    const s = String(text || '').normalize('NFKC').toLowerCase(), out = [];
    let i = 0;
    const pushStr = (str, first2) => Array.from(str).forEach((c, k) => out.push({ c, x: k === 0 && first2 && c === '二' ? ['liang'] : null }));
    while (i < s.length) {
      const c = s[i];
      if (/\d/.test(c)) {
        const m = /^(\d+)(?:\.(\d+))?/.exec(s.slice(i));
        const d = m[1], after = s[i + m[0].length] || '';
        let str, two = false;
        if (after === '%') { str = '百分之' + zhNum(+d) + (m[2] ? '点' + digitwise(m[2]) : ''); i += m[0].length + 1; pushStr(str); continue; }
        if (m[2]) str = zhNum(+d) + '点' + digitwise(m[2]);
        else if ((d.length === 4 && after === '年') || d.length >= 5) str = digitwise(d);
        else { str = zhNum(+d); two = /^二($|[百千万])/.test(str); }
        pushStr(str, two);
        i += m[0].length;
        if (after === '日') { out.push({ c: '日', x: ['hao'] }); i++; }
        else if (after === '号') { out.push({ c: '号', x: ['ri'] }); i++; }
        continue;
      }
      if (/[a-z]/.test(c)) { let j = i + 1; while (j < s.length && /[a-z]/.test(s[j])) j++; out.push({ c: s.slice(i, j), latin: true }); i = j; continue; }
      if (PUN.test(c)) { i++; continue; }
      const cp = s.codePointAt(i), w = cp > 0xffff ? 2 : 1;
      out.push({ c: s.substr(i, w) });
      i += w;
    }
    return out;
  }

  // ---------- 读音表 ----------
  // 自带的多音词、「儿」是一个音节的词（别的「儿」跟在字后面一律当儿化）
  const BUILTIN_SRC = '银行:yin hang 行人:xing ren 睡觉:shui jiao 觉得:jue de 音乐:yin yue 快乐:kuai le 还是:hai shi 还有:hai you 长大:zhang da 长城:chang cheng ' +
    '重要:zhong yao 重新:chong xin 便宜:pian yi 方便:fang bian 地方:di fang 得到:de dao 了解:liao jie 为了:wei le 头发:tou fa 首都:shou dou 暖和:nuan huo ' +
    '爱好:ai hao 好吃:hao chi 教室:jiao shi 教书:jiao shu 空调:kong tiao 调皮:tiao pi 多少:duo shao 干净:gan jing 只有:zhi you 一只:yi zhi 东西:dong xi 时候:shi hou ' +
    '什么:shen me 怎么:zen me 漂亮:piao liang 衣服:yi fu 朋友:peng you 喜欢:xi huan 应该:ying gai 一会:yi hui 会计:kuai ji 角色:jue se 数学:shu xue 数一数:shu yi shu ' +
    '女儿:nv er 儿子:er zi 儿童:er tong 婴儿:ying er 幼儿:you er 幼儿园:you er yuan 孤儿:gu er 儿歌:er ge 男儿:nan er 健儿:jian er 儿女:er nv 儿科:er ke 托儿所:tuo er suo';
  let BUILTIN = null;
  function builtin() {
    if (BUILTIN) return BUILTIN;
    BUILTIN = L.lexNew('zh');
    BUILTIN_SRC.split(/\s+(?=[^\s:a-z]+:)/).forEach(e => { const k = e.indexOf(':'); if (k > 0) L.lexAdd(BUILTIN, e.slice(0, k), e.slice(k + 1).trim().replace(/\s+/g, ' ')); });
    return BUILTIN;
  }
  // 一块的汉字 + 它的拼音 → 每个字的音节（儿化的「儿」不要）；对不上返回 null
  function sylOf(chars, r) {
    const py = parsePy(r);
    if (!py) return null;
    const out = [];
    let p = 0;
    for (const c of chars) {
      if (c === '儿' && out.length && out[out.length - 1].er) continue;
      const it = py[p++];
      if (!it) return null;
      out.push({ c, s: it.s, er: it.r });
    }
    return p === py.length ? out : null;
  }
  // 课程条目 → 读音表的几条（EchoLang.lexicon('zh', …) 用）：[汉字（去掉儿化的「儿」）, '音节 音节']
  function lexPairs(e) {
    const out = [];
    if (!e || typeof e.t !== 'string') return out;
    const one = (surf, r) => {
      const cs = Array.from(String(surf)).filter(c => HAN.test(c));
      const sy = cs.length ? sylOf(cs, r) : null;
      if (sy && sy.length) out.push([sy.map(x => x.c).join(''), sy.map(x => x.s).join(' ')]);
    };
    if (Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length) e.seg.forEach((s, i) => one(s, e.r[i]));
    else if (typeof e.r === 'string') one(e.t, e.r);
    return out;
  }
  const srcOf = pairs => { const x = L.lexNew('zh'); pairs.forEach(p => L.lexAdd(x, p[0], p[1])); return x; };
  const lookOf = (ctx, tp) => [tp ? srcOf(tp) : null, ctx && ctx.lex && ctx.lex.map ? ctx.lex : null, builtin()];
  function lexAt(str, i, look) {
    let best = null;
    for (const src of look) {
      if (!src) continue;
      for (let len = Math.min(src.max, str.length - i); len >= 1; len--) {
        if (best && len <= best.len) break;
        const p = src.map.get(str.substr(i, len));
        if (p) { best = { len, v: p[0].split(' ') }; break; }
      }
    }
    return best;
  }
  // 「儿」是不是一个音节：在读音表的词里（女儿）、或者前面不是汉字
  // 记录 → 音节槽 [{ c, s: Set, raw }]（儿化的「儿」不要）
  function slots(rs, look) {
    const out = [], str = rs.map(r => (r.latin || r.c.length !== 1 ? '\u0001' : r.c)).join('');   // 和 rs 一一对应（字母、四字节的字占一格）
    let i = 0;
    while (i < rs.length) {
      const r = rs[i];
      if (r.latin) { out.push({ c: r.c, s: new Set(), raw: true, k: r.k }); i++; continue; }
      const lx = HAN.test(r.c) ? lexAt(str, i, look) : null;
      if (lx && lx.v.length === lx.len) {
        for (let q = 0; q < lx.len; q++) { const x = rs[i + q], s = new Set([lx.v[q]]); (x.x || []).forEach(y => s.add(y)); out.push({ c: x.c, s, raw: false, k: x.k }); }
        i += lx.len; continue;
      }
      if (r.c === '儿' && i > 0 && !rs[i - 1].latin && HAN.test(rs[i - 1].c)) { i++; continue; }   // 儿化
      const py = pyOf(r.c), s = new Set(py);
      (r.x || []).forEach(y => s.add(y));
      out.push({ c: r.c, s, raw: !py.length, k: r.k });
      i++;
    }
    return out;
  }

  // ---------- 目标 ----------
  const FUNC = new Set('我 你 他 她 它 您 我们 你们 他们 她们 它们 咱们 自己 是 有 在 的 了 吗 呢 吧 啊 呀 哦 嗯 着 过 得 地 和 跟 与 也 都 很 太 还 就 才 又 这 那 这个 那个 这儿 那儿 这里 那里 请 是的 好的'.split(' '));
  const NEG = /[不没别]/;
  const MEASURE = new Set('个 只 本 张 条 件 支 枝 杯 瓶 块 位 口 头 匹 辆 双 把 朵 棵 片 节 间 家 台 封 首 座 层 次 遍 岁 斤 碗 盒 包 袋 顶 套 副 群 种 样 点 分 元 天 年 周'.split(' '));
  const TAILP = new Set('了 着 过 的 们 地 得 儿'.split(' '));
  const NAMES = new Set('小明 小红 小华 小丽 小刚 小美 小东 小龙 小雨 小林 小芳 小军 小强 丽丽 东东 乐乐 欢欢 贝贝 晶晶 亮亮 佳佳 婷婷 阳阳'.split(' '));
  // 叠字但不是名字：亲属、常见的叠字词（星星、天天、常常、慢慢、看看、谢谢……）
  const REDUP = new Set('爸 妈 哥 姐 弟 妹 奶 爷 叔 姑 舅 婆 公 星 天 常 刚 慢 看 谢 试 想 走 听 说 聊 玩 等 好 宝 娃 猩 蛐 蝈 渐 偏 仅 往 稍 悄 默 轻 快 明 人 年 家 个 样'.split(' '));
  const isEntry = e => e && typeof e === 'object';
  const strip = s => Array.from(String(s)).filter(c => !PUN.test(c)).join('');
  function chars(t) {
    const out = [];
    for (const c of t) { if (/\s/.test(c)) continue; if (PUN.test(c) && out.length) out[out.length - 1] += c; else out.push(c); }
    return out;
  }
  function pieces(text, entry) {
    const t = String(text || '');
    if (isEntry(entry) && Array.isArray(entry.seg) && entry.seg.join('') === t) return entry.seg.slice();
    if (isEntry(entry) && typeof entry.r === 'string' && entry.t === t) return [t];
    return chars(t);
  }
  // 一块 → 打分的音节单位 [{ c, s: Set }]：有拼音按拼音（对不上再按拼音表），没有按读音表 / 拼音表
  function unitsOf(surf, r, look) {
    const rs = recs(surf);
    if (r != null && rs.every(x => !x.latin)) {
      const sy = sylOf(rs.map(x => x.c), r);
      if (sy) return sy.map((x, k) => { const s = new Set([x.s]); (rs[k] && rs[k].x || []).forEach(y => s.add(y)); return { c: x.c, s, raw: false }; });
    }
    return slots(rs, look);
  }
  function tgt(text, ctx) {
    const t = String(text || ''), e = ctx && ctx.entry, names = ((ctx && ctx.names) || []).map(strip).filter(Boolean);
    const look = lookOf(ctx, isEntry(e) ? lexPairs(e) : null);
    const mk = (surf, u, piece) => {
      const sf = strip(surf);
      const name = names.some(n => sf.includes(n)) || NAMES.has(sf) || (sf.length === 2 && sf[0] === sf[1] && HAN.test(sf[0]) && !REDUP.has(sf[0]));
      const wt = NEG.test(sf) ? 2 : FUNC.has(sf) ? 1 : 2;
      return { u, m: u.length, wt, name, piece, sf };
    };
    let items, P;
    if (isEntry(e) && Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length && e.seg.join('') === t) { items = e.seg.map((s, i) => mk(s, unitsOf(s, e.r[i], look), i)); P = e.seg.length; }
    else if (isEntry(e) && typeof e.r === 'string' && e.t === t) { items = [mk(t, unitsOf(t, e.r, look), 0)]; P = 1; }
    else {
      // 没有拼音：每个字一块；读音按整句查读音表（多音词、儿化的「儿」不算一个音节）
      const ps = chars(t), all = [];
      ps.forEach((p, k) => recs(p).forEach(r => { r.k = k; all.push(r); }));
      const sl = slots(all, look);
      items = ps.map((p, k) => mk(p, sl.filter(x => x.k === k), k));
      P = ps.length;
    }
    return { items: items.filter(x => x.m), P, look };
  }

  // ---------- 打分 ----------
  // 句尾的 啊 前面一连读就成了 呀 / 哇 / 哪，识别服务照听到的写：算一样
  const AH = new Set('啊呀哇哪'.split(''));
  const eqU = (u, h) => {
    if (u.c === h.c) return true;
    if (u.c === '啊' && AH.has(h.c)) return true;
    if (u.raw || h.raw) return false;
    for (const s of u.s) if (h.s.has(s)) return true;
    return false;
  };
  const prim = u => (u.raw ? u.c : u.s.values().next().value || u.c);
  // 名字只容一个字母的差别（同音字本来就算对；小林 ≠ 小明）
  const nameTol = () => 1;
  function score(target, heard, ctx) {
    ctx = ctx || {};
    const T = tgt(target, ctx), P = T.P;
    const zero = { score: 0, marks: new Array(P).fill(false), last: false, full: false };
    if (!T.items.length || !String(heard || '').trim()) return zero;
    let best = null;
    for (const hv of variants(heard)) {
      const H = slots(recs(hv), T.look);
      if (!H.length) continue;
      const r = one(T, H, P);
      if (!best || r.score > best.score) best = r;
    }
    return best || zero;
  }
  function one(T, H, P) {
    const its = T.items, n = its.length, memo = new Map();
    const val = (i, k, j) => {
      const key = i * 1048576 + k * 1024 + j;
      if (memo.has(key)) return memo.get(key);
      const it = its[i], U = it.u, m = U.length, Ln = j - k;
      let v = 0;
      const same = (a, b, len) => { for (let q = 0; q < len; q++) if (!eqU(U[a + q], H[b + q])) return false; return true; };
      if (Ln === m && same(0, k, m)) v = 4;
      else if (it.name && Ln >= Math.max(1, m - 1) && Ln <= m + 1) {
        const a = U.map(prim).join(''), b = H.slice(k, j).map(prim).join('');
        if (L.lev(a, b) <= nameTol(a.length)) v = 4;
      }
      if (!v && m >= 2) {
        // 只差量词：一只 / 一个、两本 / 两个
        if (Ln === m && same(0, k, m - 1) && MEASURE.has(U[m - 1].c) && MEASURE.has(H[j - 1].c)) v = 3;
        // 少了 / 多了块尾的 了 着 过 的 们
        else if (Ln === m - 1 && TAILP.has(U[m - 1].c) && same(0, k, m - 1)) v = 3;
      }
      if (!v && Ln === m + 1 && TAILP.has(H[j - 1].c) && same(0, k, m)) v = 3;
      memo.set(key, v);
      return v;
    };
    const span = i => [Math.max(1, its[i].m - 1), its[i].m + 1], pref = i => its[i].m;
    const { got, at } = L.alignSpans(n, H.length, its.map(x => x.wt), val, span, pref);
    // 多说了一个 不 / 没 / 别（目标里没有）：意思反了
    const cov = L.covered(at, got, H.length), negT = its.reduce((a, x) => a + x.u.filter(u => NEGC.has(u.c)).length, 0);
    const extraNeg = H.filter(h => NEGC.has(h.c)).length > negT && H.some((h, k) => NEGC.has(h.c) && !cov[k]);
    let whole = null;
    if (n <= 2) {
      const a = its.map(x => x.u.map(prim).join('')).join(''), b = H.map(prim).join('');
      whole = { eq: L.contig(n, H.length, val, span, true), split: false, sim: (1 - L.lev(a, b) / Math.max(a.length, b.length, 1)) * 0.95 };
    }
    const contig = n <= 3 && L.contig(n, H.length, val, span);
    const items = its.map(x => ({ wt: x.wt, n: x.m, piece: x.piece, name: x.name }));
    return L.negCap(L.finish({ items, got, pieces: P, nH: H.length, whole, contig }), extraNeg);
  }
  const NEGC = new Set('不 没 别'.split(' '));

  // ---------- 提示、排句子、聊天 ----------
  const trailP = s => { const a = Array.from(s); let t = ''; while (a.length && PUN.test(a[a.length - 1])) t = a.pop() + t; return t; };
  const PARTICLE = /[的了吗呢吧啊呀哦嗯哈啦嘛]/g;
  const HANG = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
  const countUnits = text => (String(text || '').replace(PARTICLE, '').match(HANG) || []).length;
  const MIN = [1, 2, 4];
  const minUnits = level => { const v = L.lvOk(level); return v === 0 ? MIN[0] : v === 1 ? MIN[1] : MIN[2]; };
  function sylsOf(text, entry) {
    const T = tgt(text, { entry });
    return T.items.map(x => x.u);
  }
  const mod = {
    code: 'zh',
    name: { zh: '中文', en: 'Chinese (Mandarin)', self: '中文' },
    script: 'han',
    asr: { cloud: 'zh', apple: 'zh-CN', appleAlt: [], web: 'zh-CN' },
    tts: { cloud: 'Chinese', web: /^(zh[-_](CN|SG|Hans)|cmn)/i },
    aiName: 'Mandarin Chinese',
    tones: false,   // 声调不打分
    // 打分的单位：不带声调的拼音音节（一个字有几种读音的给第一个；拼音表里没有的字原样）
    units: (text, ctx) => tgt(text, ctx || {}).items.flatMap(x => x.u.map(prim)),
    pieces,
    score,
    best: (target, alts, ctx) => L.best(mod, target, alts, ctx),
    early: (target, heard, ctx) => L.early(mod, target, heard, ctx),
    // 三个字以内：说完停 0.4 秒就算说完
    short: text => (String(text || '').match(HANG) || []).length <= 3,
    // 排句子的块：seg 去掉块尾的标点；没有 seg 每个字一块
    tiles(text, entry) {
      const t = String(text || ''), st = s => Array.from(s).filter(c => !PUN.test(c)).join('');
      if (isEntry(entry) && Array.isArray(entry.seg) && entry.seg.join('') === t) return entry.seg.map(st).filter(Boolean);
      return chars(t).map(st).filter(Boolean);
    },
    joinTiles: t => (t || []).join(''),
    // 提示：1 = 每个字给拼音的第一个字母（我有一只猫 → w  y  yz  m。）；2 = 每个字一个 ＿（first：第一块照写）；块尾的标点留着
    cue(text, lv, entry, first) {
      const ps = pieces(text, entry), us = sylsOf(text, entry);
      const blocks = ps.length === us.length ? ps.map((p, k) => [p, us[k]]) : [[String(text || ''), us.flat()]];
      return blocks.map(([p, u], k) => {
        const tail = trailP(p);
        if (lv >= 2) return first && k === 0 ? p : '＿'.repeat(u.length) + tail;
        return u.map(x => (x.raw ? x.c[0] : String(prim(x))[0])).join('') + tail;
      }).join('  ');
    },
    // 几个字（聊天算句数）：汉字个数，不算 的 了 吗 呢 吧 啊 这些语气词
    countUnits,
    minUnits,
    // 算不算「用中文说了一句」：有汉字、没有假名和韩文、字母不比汉字多，字数够（入门 1、初级 2、其余 4）
    isLine(text, level) {
      const s = String(text || '');
      if (!HAN.test(s) || /[\u3040-\u30ff\uac00-\ud7af]/.test(s)) return false;
      const n = countUnits(s);
      if ((s.match(/[A-Za-z]+/g) || []).length > n) return false;
      return n >= minUnits(level);
    },
    key: text => String(text || '').normalize('NFKC').toLowerCase().replace(/[\s\u3000，。、；：？！…—～·《》〈〉「」『』（）【】“”‘’,.;:?!"'()\[\]{}<>~\-_/\\|]+/g, '').slice(0, 80),
    head: text => { const a = recs(text); return a.length ? a[0].c : ''; },
    // 玩家名字：1–4 个汉字，都要在拼音表里（读得出来才能打分）
    nameOk(s) {
      const v = String(s || '').normalize('NFKC').replace(/[\s\u3000]+/g, '');
      if (!/^[\u4e00-\u9fff]{1,4}$/.test(v)) return null;
      return Array.from(v).every(c => pyOf(c).length) ? v : null;
    },
    num: n => zhNum(n).replace(/^二(?=[千万])/, '两'),
    time: (h, m) => timeWays(+h || 0, +m || 0)[0],
    date: (mo, d) => zhNum(+mo || 1) + '月' + zhNum(+d || 1) + '日',
    // 一个字的读音（不带声调，几种常用读音；拼音表里没有是 []）
    pinyin: c => pyOf(String(c || '')).slice(),
    lexPairs,
    _: { parsePy, recs, slots: (h, ctx) => slots(recs(h), lookOf(ctx, null)), zhNum, variants, builtin, data },
  };
  if (L) L.reg('zh', mod);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : globalThis);
