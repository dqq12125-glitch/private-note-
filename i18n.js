// 回声岛 · 界面语言（window.EchoI18n / Node 模块）
// 2026-11-19：游戏要给所有人用，不只是看得懂中文的人——界面上的字不再直接写在代码里，放进「字表」，按界面语言取。
// 现在有中文（zh，默认，老存档都是它）和英文（en）；新加的功能（能力检测、分级、谁在学……）已经全部走这里，
// 游戏里原来那两千多句中文以后一批一批搬进来（搬的时候照下面的用法）。
//
// 用法：
//   EchoI18n.add({ zh: { 'place.title': '能力检测' }, en: { 'place.title': 'Level check' } });   // 每个文件登记自己的字表，键加上自己的前缀
//   const t = EchoI18n.t, h = EchoI18n.h;
//   t('place.left', { n: 3 })            → 纯文字（toast、textContent、aria-label、prompt 用）：{n} 换成参数，参数原样放进去
//   h('place.hello', { name })           → 拼进 innerHTML 用：字表里的文字可以带 <b> 这类标签，**参数**先转义再放进去
//   `<p>${h('place.hello', { name })}</p>`   // 模板字符串里直接用
//   复数：值写成 { one: '{n} item', other: '{n} items' }，按参数 n 和这门语言的复数规则挑（中文只用 other）；
//         还可以写 zero（n 是 0 时优先用它），比如 { zero: '没有记录', other: '{n} 条记录' }
//   EchoI18n.raw('game.praise')          → 原样取出来（数组、对象也行，比如一组表扬的话）
//   EchoI18n.pick({ zh: '苹果', en: 'apple' })  → 数据里按语言写的字段，取当前界面语言的那个（没有返回 undefined；第二个参数给语言，第三个给 true 就退回中文 / 第一个有的）
//   EchoI18n.gloss(台词)                 → 内容（英文台词、线索……）在界面语言里的意思：中文界面给 zh；英语界面 / 没有这门语言的意思给 null（不显示、不出「译」）
//   EchoI18n.label(道具)                 → 数据里的名字：界面语言 → 英文 → 中文（道具、属性、招式名这种 { zh, en } 的）
// 取不到：当前语言 → 中文 → 键本身（界面上看到键名就知道哪句漏了；EchoI18n.missing() 给测试用，列出哪门语言缺哪些键）。
// 界面语言存在 S.settings.ui：game.js 启动时 EchoI18n.use(() => S.settings.ui)。这个文件加载时不碰 DOM、不读存档。
(function (root) {
  'use strict';
  const BASE = 'zh';
  // 界面语言的名单。name 是这门语言自己的写法（语言选择页上用），en 是它的英文名（给 AI 的提示里用）
  const LANGS = [
    { id: 'zh', name: '中文', en: 'Chinese', html: 'zh-CN' },
    { id: 'en', name: 'English', en: 'English', html: 'en' },
  ];
  const T = {};          // 语言 → { 键: 文字 | 数组 | { one, other, … } }
  let cur = BASE, getter = null;
  const known = l => LANGS.some(x => x.id === l);

  // 现在的界面语言
  function lang() {
    let l = cur;
    if (getter) { try { l = getter() || cur; } catch (e) { l = cur; } }
    return known(l) ? l : BASE;
  }
  // tables = { zh: { 键: 值 }, en: { … } }
  function add(tables) {
    for (const l of Object.keys(tables || {})) Object.assign(T[l] || (T[l] = {}), tables[l]);
    return api;
  }
  function find(key, l) {
    if (T[l] && Object.prototype.hasOwnProperty.call(T[l], key)) return { v: T[l][key], l };
    if (l !== BASE && T[BASE] && Object.prototype.hasOwnProperty.call(T[BASE], key)) return { v: T[BASE][key], l: BASE };
    return null;
  }
  const PR = {};
  function plural(l, n) {
    try { PR[l] = PR[l] || new Intl.PluralRules(l); return PR[l].select(n); } catch (e) { return n === 1 ? 'one' : 'other'; }
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // {名字} 换成参数；没给这个参数就原样留着（一眼看得出漏了）
  function fill(s, p, safe) {
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? (safe ? esc(p[k]) : String(p[k])) : m));
  }
  // 别的语言的课（tools/course/ENGINE.md）：界面上写着「英语」的那几句另有一份「.c」的写法（{lang} = 在学的语言名），
  // game.js 在学别的语言时 variant('.c', () => ({ lang })) 打开：键有 .c 版本就用它。英语课不打开，一切照旧
  let VAR = '', VARP = null;
  function variant(sfx, params) { VAR = sfx || ''; VARP = params || null; return api; }
  function text(key, p, l, safe) {
    if (VAR && find(key + VAR, known(l) ? l : lang())) { key = key + VAR; p = Object.assign({}, typeof VARP === 'function' ? VARP() : VARP, p); }
    const f = find(key, known(l) ? l : lang());
    if (!f) return key;
    let v = f.v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const n = p ? +p.n : NaN;
      v = (n === 0 && v.zero != null ? v.zero : v[plural(f.l, n)]);
      if (v == null) v = f.v.other != null ? f.v.other : '';
    }
    return fill(Array.isArray(v) ? v.join('') : v, p, safe);
  }
  const t = (key, p, l) => text(key, p, l, false);
  const h = (key, p, l) => text(key, p, l, true);
  function raw(key, l) { const f = find(key, known(l) ? l : lang()); return f ? f.v : undefined; }
  // 数据里按语言写的字段 { zh: …, en: … }
  function pick(o, l, fallback) {
    if (!o || typeof o !== 'object') return undefined;
    l = l || lang();
    if (o[l] != null) return o[l];
    if (!fallback) return undefined;
    if (o[BASE] != null) return o[BASE];
    const k = Object.keys(o)[0];
    return k ? o[k] : undefined;
  }
  // 内容的「意思」：剧情 / 村民的台词、委托、目击线索……英文是要学的内容，旁边的 zh 是它的中文意思（以后加 fr、es……就是那门语言的意思）。
  // gloss(o) = 这句内容在现在的界面语言里的意思；界面语言就是要学的语言（英语界面学英语）、或者内容没有这门语言的意思 → null（不显示，也不出「译」按钮）。
  // 和 pick 的区别：英语界面时 pick 会拿到 o.en（内容本身），gloss 给 null；没有这门语言的意思时也不退回中文
  function gloss(o, target) {
    const l = lang();
    if (!o || typeof o !== 'object' || l === (target || 'en')) return null;
    const v = o[l];
    return v == null || v === '' ? null : v;
  }
  // 数据里的名字（道具、属性、招式……有 zh / en 两个字段）：现在的界面语言 → 英文 → 中文（别的语言的人看英文名比看中文名强）
  function label(o) {
    if (!o || typeof o !== 'object') return o == null ? '' : String(o);
    const l = lang();
    return o[l] != null ? o[l] : o.en != null ? o.en : o[BASE] != null ? o[BASE] : '';
  }
  // 换界面语言（game.js 把它存进 S.settings.ui）；顺手改 <html lang>，读屏和浏览器的翻译提示才对
  function set(l) {
    cur = known(l) ? l : BASE;
    try { if (root.document && root.document.documentElement) root.document.documentElement.lang = (LANGS.find(x => x.id === lang()) || LANGS[0]).html; } catch (e) { /* 没有页面（Node） */ }
    return cur;
  }
  // 以后的语言从哪儿读（game.js：() => S.settings.ui）
  function use(fn) { getter = typeof fn === 'function' ? fn : null; set(lang()); return api; }
  // 哪门语言缺哪些键（以中文的为准；prefix 只看某个前缀）。测试用
  function missing(prefix) {
    const out = {}, base = Object.keys(T[BASE] || {}).filter(k => !prefix || k.startsWith(prefix));
    for (const x of LANGS) {
      if (x.id === BASE) continue;
      const m = base.filter(k => !(T[x.id] && Object.prototype.hasOwnProperty.call(T[x.id], k)));
      const extra = Object.keys(T[x.id] || {}).filter(k => (!prefix || k.startsWith(prefix)) && !(T[BASE] && Object.prototype.hasOwnProperty.call(T[BASE], k)));
      if (m.length || extra.length) out[x.id] = { missing: m, extra };
    }
    return out;
  }
  const api = {
    BASE, LANGS, add, t, h, raw, pick, gloss, label, lang, set, use, missing, esc, variant,
    has: (key, l) => !!(T[l || lang()] && Object.prototype.hasOwnProperty.call(T[l || lang()], key)),
    keys: l => Object.keys(T[l || BASE] || {}),
    name: l => (LANGS.find(x => x.id === l) || {}).name || l,     // 这门语言自己的写法
    enName: l => (LANGS.find(x => x.id === l) || {}).en || '',   // 英文名
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EchoI18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
