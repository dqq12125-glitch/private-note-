// 回声岛 · 日语（EchoLang.reg('ja')；也是 Node 模块）——口语打分、提示、排句子、聊天算句数、名字、数字
// 先加载 lang.js。接口见 lang.js 和 tests/lang.test.js。
//
// 打分按「读音」比，不按写法比（和英语 game.js 的 scoreSpeech 同一套分数线，规矩见 lang.js 开头）：
// · 目标：课程条目的 seg（文节：わたしは / 学生 / です。）和每块的读音 r。显示、标红标绿都按 seg 一块一块来。
// · 识别结果（汉字假名混写，写法可能和课本不一样：私 / わたし、下さい / ください、3 / 三、有没有空格标点）先变成平假名的读音：
//   片假名 → 平假名；去掉空格标点；数字按后面的量词读（3時 さんじ、4時 よじ、1人 ひとり、3匹 さんびき、20日 はつか、3:30 さんじはん……）；
//   汉字按读音表换，最长的先换：先查这道题自己的 seg / r，再查整门课的读音表（EchoLang.lexicon('ja', 课程)，ctx.lex），
//   最后查这里自带的约 500 个常用词（BUILTIN：入门词、常见的另一种写法、动词形容词的词干，例如 飲 + 平假名 → の）。
//   一个写法有几种读音（良い いい / よい、家 いえ / うち、何 なに / なん）都试，哪个对得上算哪个。
// · 还剩下读不出来的汉字：那一小段改成按写法比（和目标那一块的写法一样就算对），不连累整句。名字那一块读不出来算半对（不扣「关键实词」，不给 Perfect）。
// · 比读音时：ー 当成前一个音的元音，おう = おお、えい = ええ，ぢ = じ、づ = ず、を = お；块尾的助词 は / へ 读 わ / え（识别服务写 は）。
//   长音、促音、浊音不同都不算对（おばさん ≠ おばあさん、きて ≠ きって、かき ≠ かぎ）——这些正是学的人要练的。
// · 一块对没对：读音一样 = 对；只差助词（学校に / 学校で、少一个 は）或者只差词尾（たべます / たべる / たべた、すきです / すきだ、
//   おおきい / おおきかった、がくせい / がくせいです）= 半对（¾，不给 Perfect）；肯定否定不一样（たべます / たべません）不算半对，算错——
//   只拿前半截凑半对也不行（降っています 对 降っていません 的「降って」）；多说了一个目标里没有的否定（ない / ません）整句不过关。
// · 虚词块（わたし、これ、です、はい……加上助词的）权重 1，其余是实词（权重 2）。否定的块一定是实词。
// · 名字：块是「X さん / くん / ちゃん / 先生」或 ctx.names 里的名字：差四分之一个音以内也算对，不算进「关键实词」。
// · 没有 seg 的目标（聊天里的句子、写错了的条目）：照样换成读音，按词（读音表里的词）和单个假名一小块一小块比，显示按每个字。
// 已知的不足：读音表以外的汉字只能按写法比（识别服务用了不同的汉字写法就对不上）；数字后面的量词只认常用的二十几个；
// 自带的词表只有入门的常用词；识别服务把整句写成平假名、目标却是课本里的汉字（反过来也一样）没问题，只要读音表里有这个词。
(function (root) {
  'use strict';
  const L = root.EchoLang || (typeof module !== 'undefined' && module.exports && typeof require === 'function' ? require('./lang.js') : null);

  // ---------- 文字 ----------
  const HANC = '㐀-䶿一-鿿豈-﫿々〆';
  const HAN = new RegExp('[' + HANC + ']');
  const HIRA = /[ぁ-ゖ]/;
  const SMALL = new Set('ぁぃぅぇぉゃゅょゎゕゖ');
  const PUN = /[\s　、。，．,.!！?？「」『』（）()［］[\]【】〈〉《》・…‥〜～~:：;；"'“”‘’\-—―_／/｢｣･]/g;
  const toHira = s => s.replace(/[ヵヶ]/g, 'か').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // 统一写法：NFKC（半角片假名、全角数字）、片假名 → 平假名、小写、去掉空格标点（时间里的冒号先留着）
  const nzKeep = s => toHira(String(s == null ? '' : s).normalize('NFKC')).toLowerCase();
  const nz = s => nzKeep(s).replace(PUN, '');
  // 拍：小的 ゃゅょぁぃぅぇぉ 跟着前一个假名；っ ん ー 自己算一拍
  function morae(s) {
    const out = [];
    for (const c of String(s)) { if (SMALL.has(c) && out.length && !HAN.test(out[out.length - 1])) out[out.length - 1] += c; else out.push(c); }
    return out;
  }
  const VOW = {};
  ['あかさたなはまやらわがざだばぱぁゃゎ', 'いきしちにひみりぎじぢびぴぃ', 'うくすつぬふむゆるぐずづぶぷぅゅゔ', 'えけせてねへめれげぜでべぺぇ', 'おこそとのほもよろをごぞどぼぽぉょ']
    .forEach((r, i) => { for (const c of r) VOW[c] = 'あいうえお'[i]; });
  // 比读音前的「发音一样就一样」：ー = 前一个元音，おう = おお、えい = ええ，ぢ = じ、づ = ず、を = お
  function fold(s) {
    let out = '';
    for (const c0 of String(s)) {
      let c = c0 === 'ぢ' ? 'じ' : c0 === 'づ' ? 'ず' : c0 === 'を' ? 'お' : c0;
      const pv = VOW[out.slice(-1)];
      if (c === 'ー' && pv) c = pv;
      else if (c === 'う' && pv === 'お') c = 'お';
      else if (c === 'い' && pv === 'え') c = 'え';
      out += c;
    }
    return out;
  }
  // 块尾的助词 は / へ 读 わ / え
  const foldP = s => fold(s).replace(/は$/, 'わ').replace(/へ$/, 'え');

  // ---------- 助词、词尾 ----------
  const PART = ['からは', 'までは', 'には', 'では', 'とは', 'へは', 'にも', 'でも', 'とも', 'からも', 'から', 'まで', 'より', 'だけ', 'しか', 'など',
    'って', 'の', 'は', 'わ', 'が', 'を', 'お', 'に', 'で', 'と', 'も', 'へ', 'え', 'や', 'か', 'ね', 'よ'];
  // 去掉块尾的一个助词（剩下的至少一拍）
  function core(s) {
    for (const p of PART) if (s.length > p.length && s.endsWith(p)) return s.slice(0, -p.length);
    return s;
  }
  // 词尾表：[词尾, 类别, 肯定 1 / 否定 0]。五段动词按行（か行 g-k …）、一段 v1、する vs、くる vk、形容词 ia、名词 / 形容动词 + です cop
  const PAT = [];
  (function () {
    const ROW = { k: 'かきくけこ', g: 'がぎぐげご', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの', b: 'ばびぶべぼ', m: 'まみむめも', r: 'らりるれろ', w: 'わいうえお' };
    const TE = { k: ['いて', 'いた'], g: ['いで', 'いだ'], s: ['して', 'した'], t: ['って', 'った'], n: ['んで', 'んだ'], b: ['んで', 'んだ'], m: ['んで', 'んだ'], r: ['って', 'った'], w: ['って', 'った'] };
    const POL = [['ます', 1], ['ました', 1], ['ません', 0], ['ませんでした', 0], ['ましょう', 1], ['たい', 1], ['たいです', 1], ['たくない', 0], ['ながら', 1]];
    const TT = [['', 1], ['いる', 1], ['います', 1], ['いました', 1], ['いた', 1], ['いない', 0], ['いません', 0], ['ください', 1], ['も', 1]];
    const add = (cls, list) => list.forEach(([s, p]) => PAT.push([s, cls, p]));
    Object.keys(ROW).forEach(x => {
      const [a, i, u, e, o] = ROW[x], c = 'g' + x, te = TE[x];
      add(c, [[u, 1], [a + 'ない', 0], [a + 'なかった', 0], [a + 'ないです', 0], [e + 'ば', 1], [e + 'る', 1], [o + 'う', 1], [te[1], 1]]);
      add(c, POL.map(([s, p]) => [i + s, p]));
      add(c, TT.map(([s, p]) => [te[0] + s, p]));
      if (x === 'k') { add(c, [['った', 1]]); add(c, TT.map(([s, p]) => ['って' + s, p])); }   // 行く：いって / いった
    });
    add('v1', [['る', 1], ['ない', 0], ['なかった', 0], ['ないです', 0], ['た', 1], ['よう', 1], ['れば', 1], ['られる', 1], ['ろ', 1]]);
    add('v1', POL); add('v1', TT.map(([s, p]) => ['て' + s, p]));
    add('vs', [['する', 1], ['しない', 0], ['しなかった', 0], ['した', 1], ['しよう', 1], ['すれば', 1]]);
    add('vs', POL.map(([s, p]) => ['し' + s, p])); add('vs', TT.map(([s, p]) => ['して' + s, p]));
    add('vk', [['くる', 1], ['こない', 0], ['こなかった', 0], ['きた', 1], ['こよう', 1], ['くれば', 1]]);
    add('vk', POL.map(([s, p]) => ['き' + s, p])); add('vk', TT.map(([s, p]) => ['きて' + s, p]));
    add('ia', [['い', 1], ['いです', 1], ['かった', 1], ['かったです', 1], ['くない', 0], ['くないです', 0], ['くありません', 0], ['くなかった', 0], ['くて', 1], ['く', 1], ['ければ', 1]]);
    add('cop', [['', 1], ['です', 1], ['でした', 1], ['だ', 1], ['だった', 1], ['でしょう', 1], ['だろう', 1], ['で', 1],
      ['じゃない', 0], ['じゃありません', 0], ['ではありません', 0], ['ではない', 0], ['じゃなかった', 0], ['じゃないです', 0], ['ではなかった', 0]]);
  })();
  const FCACHE = new Map();
  function forms(x) {
    let f = FCACHE.get(x);
    if (f) return f;
    f = [];
    for (const [s, cls, pol] of PAT) if (x.endsWith(s)) f.push({ stem: x.slice(0, x.length - s.length), cls, pol });
    if (FCACHE.size > 5000) FCACHE.clear();
    FCACHE.set(x, f);
    return f;
  }
  // 只差词尾（同一个词、肯定否定一样）：たべます / たべる、のむ / のんだ、すきです / すきだ、がくせい / がくせいです
  function infl(x, y) {
    if (x === y) return false;
    const fy = forms(y);
    for (const a of forms(x)) for (const b of fy) {
      if (a.cls === b.cls && a.pol === b.pol && a.stem === b.stem && (a.stem || a.cls === 'cop' || a.cls === 'vs' || a.cls === 'vk')) return true;
    }
    return false;
  }
  // 半对：只差助词（剩下的至少两拍），或者只差词尾
  function partial(x, y) {
    if (x === y) return false;
    const cx = core(x), cy = core(y);
    if (cx === cy && morae(cx).length >= 2) return true;
    return infl(x, y) || (cx !== cy && infl(cx, cy));
  }

  // ---------- 数字 ----------
  const D1 = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
  function jaNum(n) {
    n = Math.floor(Math.abs(+n) || 0);
    if (n === 0) return 'ぜろ';
    let out = '';
    if (n >= 10000) { out += jaNum(Math.floor(n / 10000)) + 'まん'; n %= 10000; }
    const s = Math.floor(n / 1000); if (s) out += s === 1 ? 'せん' : s === 3 ? 'さんぜん' : s === 8 ? 'はっせん' : D1[s] + 'せん'; n %= 1000;
    const h = Math.floor(n / 100); if (h) out += h === 1 ? 'ひゃく' : h === 3 ? 'さんびゃく' : h === 6 ? 'ろっぴゃく' : h === 8 ? 'はっぴゃく' : D1[h] + 'ひゃく'; n %= 100;
    const t = Math.floor(n / 10); if (t) out += (t === 1 ? '' : D1[t]) + 'じゅう'; n %= 10;
    if (n) out += D1[n];
    return out;
  }
  // 没有量词时的几种读法（4 よん / し、7 なな / しち、9 きゅう / く、0 ぜろ / れい）
  function numAlts(n) {
    const a = jaNum(n), d = n % 10, out = [a];
    if (n === 0) out.push('れい');
    else if (d === 4) out.push(a.replace(/よん$/, 'し'));
    else if (d === 7) out.push(a.replace(/なな$/, 'しち'));
    else if (d === 9) out.push(a.replace(/きゅう$/, 'く'));
    return out;
  }
  // 量词：1–10 的读法（| 分开几种说法）；c：11 以上个位用的读法（不写就和上面一样）；only：只有 1–10 有这个说法（11 以上只读数字）
  const CT = {
    '時': { t: 'いちじ にじ さんじ よじ ごじ ろくじ しちじ|ななじ はちじ くじ じゅうじ' },
    '時間': { t: 'いちじかん にじかん さんじかん よじかん ごじかん ろくじかん しちじかん|ななじかん はちじかん くじかん じゅうじかん' },
    '分': { t: 'いっぷん にふん さんぷん よんぷん ごふん ろっぷん ななふん|しちふん はっぷん|はちふん きゅうふん じゅっぷん|じっぷん' },
    '秒': { t: 'いちびょう にびょう さんびょう よんびょう ごびょう ろくびょう ななびょう はちびょう きゅうびょう じゅうびょう' },
    '月': { t: 'いちがつ にがつ さんがつ しがつ ごがつ ろくがつ しちがつ はちがつ くがつ じゅうがつ' },
    '日': { t: 'ついたち|いちにち ふつか みっか よっか いつか むいか なのか ようか ここのか とおか', c: 'いちにち ににち さんにち よっか ごにち ろくにち しちにち|ななにち はちにち くにち|きゅうにち' },
    '人': { t: 'ひとり ふたり さんにん よにん ごにん ろくにん しちにん|ななにん はちにん きゅうにん|くにん じゅうにん', c: 'いちにん ににん さんにん よにん ごにん ろくにん しちにん|ななにん はちにん きゅうにん|くにん' },
    'つ': { t: 'ひとつ ふたつ みっつ よっつ いつつ むっつ ななつ やっつ ここのつ とお', only: true },
    '匹': { t: 'いっぴき にひき さんびき よんひき ごひき ろっぴき ななひき はっぴき|はちひき きゅうひき じゅっぴき|じっぴき' },
    '本': { t: 'いっぽん にほん さんぼん よんほん ごほん ろっぽん ななほん はっぽん|はちほん きゅうほん じゅっぽん|じっぽん' },
    '杯': { t: 'いっぱい にはい さんばい よんはい ごはい ろっぱい ななはい はっぱい|はちはい きゅうはい じゅっぱい|じっぱい' },
    '個': { t: 'いっこ にこ さんこ よんこ ごこ ろっこ ななこ はっこ|はちこ きゅうこ じゅっこ|じっこ' },
    '回': { t: 'いっかい にかい さんかい よんかい ごかい ろっかい ななかい はっかい|はちかい きゅうかい じゅっかい|じっかい' },
    '階': { t: 'いっかい にかい さんがい|さんかい よんかい ごかい ろっかい ななかい はっかい|はちかい きゅうかい じゅっかい|じっかい' },
    '枚': { t: 'いちまい にまい さんまい よんまい ごまい ろくまい ななまい|しちまい はちまい きゅうまい じゅうまい' },
    '冊': { t: 'いっさつ にさつ さんさつ よんさつ ごさつ ろくさつ ななさつ はっさつ|はちさつ きゅうさつ じゅっさつ|じっさつ' },
    '台': { t: 'いちだい にだい さんだい よんだい ごだい ろくだい ななだい はちだい きゅうだい じゅうだい' },
    '歳': { t: 'いっさい にさい さんさい よんさい ごさい ろくさい ななさい はっさい きゅうさい じゅっさい|じっさい' },
    '年': { t: 'いちねん にねん さんねん よねん ごねん ろくねん しちねん|ななねん はちねん きゅうねん|くねん じゅうねん' },
    '年生': { t: 'いちねんせい にねんせい さんねんせい よねんせい ごねんせい ろくねんせい ななねんせい はちねんせい きゅうねんせい じゅうねんせい' },
    '円': { t: 'いちえん にえん さんえん よえん ごえん ろくえん ななえん はちえん きゅうえん じゅうえん' },
    '番': { t: 'いちばん にばん さんばん よんばん ごばん ろくばん ななばん はちばん きゅうばん じゅうばん' },
    '度': { t: 'いちど にど さんど よんど ごど ろくど ななど はちど きゅうど じゅうど' },
    '点': { t: 'いってん にてん さんてん よんてん ごてん ろくてん ななてん はってん きゅうてん じゅってん|じってん' },
    '週間': { t: 'いっしゅうかん にしゅうかん さんしゅうかん よんしゅうかん ごしゅうかん ろくしゅうかん ななしゅうかん はっしゅうかん|はちしゅうかん きゅうしゅうかん じゅっしゅうかん|じっしゅうかん' },
    'か月': { t: 'いっかげつ にかげつ さんかげつ よんかげつ ごかげつ ろっかげつ ななかげつ はっかげつ|はちかげつ きゅうかげつ じゅっかげつ|じっかげつ' },
  };
  CT['才'] = CT['歳'];
  Object.keys(CT).forEach(k => { const x = CT[k]; x.T = x.t.split(' ').map(s => s.split('|')); x.C = x.c ? x.c.split(' ').map(s => s.split('|')) : x.T; });
  const CNT = Object.keys(CT).sort((a, b) => b.length - a.length);
  // 数字 + 量词的读法（几种说法）
  function countWays(n, c) {
    const x = CT[c];
    if (!x) return numAlts(n);
    if (c === '日' && (n === 14 || n === 24)) return [jaNum(n - 4) + 'よっか'];
    if (c === '日' && n === 20) return ['はつか', 'にじゅうにち'];
    if ((c === '歳' || c === '才') && n === 20) return ['はたち', 'にじゅっさい', 'にじっさい'];
    if (c === '月' && n === 11) return ['じゅういちがつ'];
    if (c === '月' && n === 12) return ['じゅうにがつ'];
    if (n >= 1 && n <= 10) return x.T[n - 1].slice();
    if (n === 0) return numAlts(0).map(a => a + x.T[0][0].replace(/^いっ|^いち/, '').replace(/^ぴ/, 'ひ').replace(/^ぽ/, 'ほ').replace(/^ぱ/, 'は').replace(/^ぷ/, 'ふ'));
    if (x.only) return numAlts(n);
    const d = n % 10;
    if (d) return x.C[d - 1].map(w => jaNum(n - d) + w);
    if (n % 100) {   // 20、30……：百位以上 + 十位 + 「10」的读法
      const t = Math.floor((n % 100) / 10), hi = n - (n % 100);
      return x.T[9].map(w => (hi ? jaNum(hi) : '') + (t === 1 ? '' : D1[t]) + w);
    }
    const base = x.T[1][0].slice(1);   // 100、1000……：数字 + 量词的原形（にほん → ほん）
    return [jaNum(n) + base];
  }
  // 钟点的几种说法
  function timeWays(h, m) {
    const H = countWays(h, '時');
    if (!m) return H;
    const M = m === 30 ? ['はん'].concat(countWays(30, '分')) : countWays(m, '分');
    const out = [];
    H.forEach(a => M.forEach(b => out.push(a + b)));
    return out.slice(0, 6);
  }
  const KD = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const KU = { '十': 10, '百': 100, '千': 1000 };
  function kanjiNum(s) {
    let total = 0, sec = 0, cur = -1;
    for (const c of s) {
      if (c in KD) cur = cur < 0 ? KD[c] : cur * 10 + KD[c];
      else if (c in KU) { sec += (cur < 0 ? 1 : cur) * KU[c]; cur = -1; }
      else if (c === '万') { total += (sec + Math.max(cur, 0) || 1) * 10000; sec = 0; cur = -1; }
    }
    return total + sec + Math.max(cur, 0);
  }
  // 位置 i 开始的数字（阿拉伯数字或汉字数字）+ 量词 → { len, alts }
  const NUMRE = /^(\d{1,2}):(\d{2})|^(\d+(?:[,，]\d{3})*)|^([〇零一二三四五六七八九十百千万]+)/;
  function numAt(s, i) {
    const m = NUMRE.exec(s.slice(i, i + 24));
    if (!m) return null;
    if (m[1]) return { len: m[0].length, alts: timeWays(+m[1], +m[2]) };
    const n = m[3] ? +m[3].replace(/[,，]/g, '') : kanjiNum(m[4]);
    let len = m[0].length;
    const rest = s.slice(i + len);
    const c = CNT.find(k => rest.startsWith(k));
    if (c) return { len: len + c.length, alts: countWays(n, c) };
    if (m[4] && m[4].length === 1 && !(m[4] in KD)) return null;   // 单独一个 十 / 百 / 千 / 万 留给读音表
    return { len, alts: numAlts(n) };
  }

  // ---------- 读音表 ----------
  // 写法 + 读音 → 读音表的几条 [写法, 读音, 'c'?]：
  //   整个词；开头是汉字、后面跟着假名的（食べる、大きい、飲みます）→ 汉字 + 第一个假名（食べ → たべ）；
  //   后面只跟一个假名的（飲む、高い、見る）→ 汉字本身，后面跟着平假名才算（'c'：飲んで、高かった、見ます）；
  //   两个字以上的汉字词后面跟着助词的（学校に）→ 汉字词本身
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RUN = new RegExp('[' + HANC + ']+|[^' + HANC + ']+', 'g');
  const PARTC = 'はがをにでともへのやかね';
  function splitReading(runs, r) {
    try {
      const re = new RegExp('^' + runs.map(x => (HAN.test(x) ? '(.+?)' : esc(x))).join('') + '$', 'u');
      const m = re.exec(r);
      if (!m) return null;
      let k = 1;
      return runs.map(x => (HAN.test(x) ? m[k++] : x));
    } catch (e) { return null; }
  }
  function pairsOf(surf, read) {
    const s = nz(surf), r = nz(read);
    if (!s || !r || s === r) return [];
    if (!HAN.test(s)) return HAN.test(r) ? [] : [[s, r]];
    if (HAN.test(r)) return [];
    const out = [[s, r]], runs = s.match(RUN) || [];
    const parts = runs.length > 1 ? splitReading(runs, r) : null;
    if (!parts) return out;
    if (HAN.test(runs[0]) && runs[1]) {
      out.push([runs[0] + runs[1][0], parts[0] + runs[1][0]]);
      if (runs[1].length === 1) out.push([runs[0], parts[0], 'c']);
    }
    runs.forEach((x, i) => { if (HAN.test(x) && Array.from(x).length >= 2 && (!runs[i + 1] || PARTC.includes(runs[i + 1][0]))) out.push([x, parts[i]]); });
    return out;
  }
  // 自带的常用词（写法:读音，| 分开几种读法）。动词、形容词写原形，词干自动算出来
  const BUILTIN_SRC = `
私:わたし|わたくし 僕:ぼく 俺:おれ 君:きみ 貴方:あなた 彼:かれ 彼女:かのじょ 彼ら:かれら 自分:じぶん 皆:みんな|みな 皆さん:みなさん
誰:だれ 誰か:だれか 何:なに|なん 何か:なにか 何で:なんで|なにで 何時:なんじ 何人:なんにん 何歳:なんさい 何月:なんがつ 何日:なんにち 何曜日:なんようび 何回:なんかい 何色:なにいろ
人:ひと|じん|にん 日本人:にほんじん 外国人:がいこくじん 方:かた|ほう 友達:ともだち 達:たち 様:さま 君:きみ|くん 語:ご 屋:や 本屋:ほんや 花屋:はなや
日:ひ|にち 年:とし|ねん 円:えん 中:なか|ちゅう 授業中:じゅぎょうちゅう 友だち:ともだち 先生:せんせい 学生:がくせい 生徒:せいと 子供:こども 子ども:こども 大人:おとな 男:おとこ 女:おんな
男の子:おとこのこ 女の子:おんなのこ 男の人:おとこのひと 女の人:おんなのひと 家族:かぞく 父:ちち 母:はは 兄:あに 姉:あね 弟:おとうと 妹:いもうと 両親:りょうしん 兄弟:きょうだい
祖父:そふ 祖母:そぼ お父さん:おとうさん お母さん:おかあさん お兄さん:おにいさん お姉さん:おねえさん お祖父さん:おじいさん お祖母さん:おばあさん お爺さん:おじいさん お婆さん:おばあさん
叔父さん:おじさん 叔母さん:おばさん 伯父さん:おじさん 伯母さん:おばさん 赤ちゃん:あかちゃん 名前:なまえ 先輩:せんぱい 後輩:こうはい 医者:いしゃ 店員:てんいん 博士:はかせ 選手:せんしゅ 仲間:なかま
犬:いぬ 猫:ねこ 鳥:とり 魚:さかな 馬:うま 牛:うし 豚:ぶた 兎:うさぎ 熊:くま 象:ぞう 猿:さる 虎:とら 羊:ひつじ 狐:きつね 狸:たぬき 鼠:ねずみ 亀:かめ 蛙:かえる 蛇:へび 虫:むし 蝶:ちょう 蜂:はち 金魚:きんぎょ 動物:どうぶつ 鶏:にわとり
今日:きょう|こんにち 明日:あした|あす 昨日:きのう 今:いま 毎日:まいにち 毎朝:まいあさ 毎晩:まいばん 毎週:まいしゅう 毎年:まいとし|まいねん 毎月:まいつき
朝:あさ 昼:ひる 夜:よる 晩:ばん 夕方:ゆうがた 今朝:けさ 今晩:こんばん 今夜:こんや 午前:ごぜん 午後:ごご 時間:じかん 時:とき|じ 時々:ときどき 半:はん 前:まえ 後:あと|ご 後で:あとで 後ろ:うしろ
週:しゅう 今週:こんしゅう 来週:らいしゅう 先週:せんしゅう 今月:こんげつ 来月:らいげつ 先月:せんげつ 今年:ことし 去年:きょねん 来年:らいねん
月曜日:げつようび 火曜日:かようび 水曜日:すいようび 木曜日:もくようび 金曜日:きんようび 土曜日:どようび 日曜日:にちようび 曜日:ようび 週末:しゅうまつ
春:はる 夏:なつ 秋:あき 冬:ふゆ 季節:きせつ 誕生日:たんじょうび 休み:やすみ 夏休み:なつやすみ 冬休み:ふゆやすみ 春休み:はるやすみ 昼休み:ひるやすみ
最初:さいしょ 最後:さいご 次:つぎ 先:さき 一緒:いっしょ 一緒に:いっしょに 一番:いちばん 一度:いちど 初めて:はじめて 今度:こんど
学校:がっこう 小学校:しょうがっこう 中学校:ちゅうがっこう 高校:こうこう 大学:だいがく 教室:きょうしつ 図書館:としょかん 図書室:としょしつ 体育館:たいいくかん 音楽室:おんがくしつ
理科室:りかしつ 美術室:びじゅつしつ 保健室:ほけんしつ 職員室:しょくいんしつ 校庭:こうてい 運動場:うんどうじょう 食堂:しょくどう 廊下:ろうか 階段:かいだん
家:いえ|うち 部屋:へや 台所:だいどころ 玄関:げんかん 庭:にわ 公園:こうえん 駅:えき 店:みせ 病院:びょういん 銀行:ぎんこう 郵便局:ゆうびんきょく 交番:こうばん
町:まち 村:むら 島:しま 海:うみ 山:やま 川:かわ 池:いけ 森:もり 林:はやし 空:そら 道:みち 橋:はし 港:みなと 船:ふね 車:くるま 電車:でんしゃ 自転車:じてんしゃ 飛行機:ひこうき
世界:せかい 国:くに 日本:にほん|にっぽん 日本語:にほんご 英語:えいご 中国:ちゅうごく 中国語:ちゅうごくご 外国:がいこく 言葉:ことば
近く:ちかく 外:そと 上:うえ 下:した 右:みぎ 左:ひだり 横:よこ 隣:となり 間:あいだ 所:ところ 場所:ばしょ 北:きた 南:みなみ 東:ひがし 西:にし
国語:こくご 数学:すうがく 算数:さんすう 理科:りか 社会:しゃかい 音楽:おんがく 美術:びじゅつ 体育:たいいく 歴史:れきし 科学:かがく 宿題:しゅくだい 授業:じゅぎょう 勉強:べんきょう
試験:しけん 部活:ぶかつ 練習:れんしゅう 本:ほん 教科書:きょうかしょ 辞書:じしょ 鉛筆:えんぴつ 消しゴム:けしごむ 机:つくえ 椅子:いす 鞄:かばん 紙:かみ 筆箱:ふでばこ 定規:じょうぎ
色:いろ 赤:あか 青:あお 白:しろ 黒:くろ 黄色:きいろ 緑:みどり 茶色:ちゃいろ 紫:むらさき 色鉛筆:いろえんぴつ 絵:え 問題:もんだい 質問:しつもん 答え:こたえ 意味:いみ 漢字:かんじ 規則:きそく
食べ物:たべもの 飲み物:のみもの ご飯:ごはん 御飯:ごはん 朝ご飯:あさごはん 昼ご飯:ひるごはん 晩ご飯:ばんごはん 夕ご飯:ゆうごはん 水:みず お茶:おちゃ 茶:ちゃ 牛乳:ぎゅうにゅう
肉:にく 野菜:やさい 果物:くだもの 卵:たまご 林檎:りんご 苺:いちご 蜜柑:みかん 弁当:べんとう お弁当:おべんとう 料理:りょうり 米:こめ 寿司:すし お菓子:おかし 牛肉:ぎゅうにく 豚肉:ぶたにく 鶏肉:とりにく
天気:てんき 雨:あめ 雪:ゆき 風:かぜ 晴れ:はれ 曇り:くもり 雲:くも 太陽:たいよう 星:ほし 月:つき|がつ 虹:にじ 雷:かみなり 台風:たいふう
野球:やきゅう 水泳:すいえい 卓球:たっきゅう 運動:うんどう 趣味:しゅみ 映画:えいが 歌:うた 写真:しゃしん 読書:どくしょ 旅行:りょこう 散歩:さんぽ 買い物:かいもの 掃除:そうじ 洗濯:せんたく
遊び:あそび 試合:しあい 好き:すき 大好き:だいすき 嫌い:きらい 得意:とくい 苦手:にがて 上手:じょうず 下手:へた 楽器:がっき
頭:あたま 顔:かお 目:め 耳:みみ 鼻:はな 口:くち 手:て 足:あし 体:からだ 歯:は 髪:かみ
電話:でんわ 時計:とけい 手紙:てがみ 新聞:しんぶん 傘:かさ 靴:くつ 帽子:ぼうし 服:ふく 窓:まど 鍵:かぎ 箱:はこ 物:もの 事:こと 花:はな 木:き 草:くさ 石:いし 火:ひ 金:かね|きん お金:おかね
夢:ゆめ 心:こころ 声:こえ 音:おと 話:はなし 光:ひかり 力:ちから 気持ち:きもち 元気:げんき 静か:しずか 賑やか:にぎやか 綺麗:きれい 有名:ゆうめい 大切:たいせつ 大事:だいじ 大丈夫:だいじょうぶ
本当:ほんとう 簡単:かんたん 便利:べんり 親切:しんせつ 暇:ひま 残念:ざんねん 本当に:ほんとうに 少し:すこし 沢山:たくさん 全部:ぜんぶ 全然:ぜんぜん 多分:たぶん 特に:とくに 必ず:かならず 色々:いろいろ
大きい:おおきい 小さい:ちいさい 新しい:あたらしい 古い:ふるい 高い:たかい 安い:やすい 低い:ひくい 長い:ながい 短い:みじかい 良い:よい|いい 悪い:わるい 多い:おおい 少ない:すくない
早い:はやい 速い:はやい 遅い:おそい 楽しい:たのしい 嬉しい:うれしい 悲しい:かなしい 面白い:おもしろい 難しい:むずかしい 易しい:やさしい 優しい:やさしい 暑い:あつい 寒い:さむい
熱い:あつい 冷たい:つめたい 暖かい:あたたかい 温かい:あたたかい 涼しい:すずしい 美味しい:おいしい 甘い:あまい 辛い:からい 可愛い:かわいい 強い:つよい 弱い:よわい 明るい:あかるい
暗い:くらい 忙しい:いそがしい 眠い:ねむい 痛い:いたい 近い:ちかい 遠い:とおい 広い:ひろい 狭い:せまい 重い:おもい 軽い:かるい 若い:わかい 白い:しろい 黒い:くろい 赤い:あかい
青い:あおい 黄色い:きいろい 丸い:まるい 凄い:すごい 怖い:こわい 汚い:きたない 欲しい:ほしい 正しい:ただしい 寂しい:さびしい
食べる:たべる 飲む:のむ 見る:みる 行く:いく 帰る:かえる 起きる:おきる 寝る:ねる 書く:かく 読む:よむ 聞く:きく 話す:はなす 言う:いう 思う:おもう 分かる:わかる 知る:しる
買う:かう 売る:うる 作る:つくる 使う:つかう 待つ:まつ 持つ:もつ 立つ:たつ 座る:すわる 歩く:あるく 走る:はしる 泳ぐ:およぐ 遊ぶ:あそぶ 休む:やすむ 住む:すむ 働く:はたらく
歌う:うたう 習う:ならう 教える:おしえる 覚える:おぼえる 忘れる:わすれる 始まる:はじまる 始める:はじめる 終わる:おわる 開ける:あける 閉める:しめる 開く:あく|ひらく 閉まる:しまる
入る:はいる 入れる:いれる 出る:でる 出す:だす 会う:あう 呼ぶ:よぶ 乗る:のる 降りる:おりる 着る:きる 着く:つく 脱ぐ:ぬぐ 洗う:あらう 浴びる:あびる 撮る:とる 取る:とる
貸す:かす 借りる:かりる 返す:かえす 送る:おくる 見せる:みせる 見える:みえる 聞こえる:きこえる 弾く:ひく 描く:かく 引く:ひく 押す:おす 消す:けす 付ける:つける 笑う:わらう 泣く:なく
怒る:おこる 困る:こまる 手伝う:てつだう 頑張る:がんばる 違う:ちがう 決める:きめる 選ぶ:えらぶ 探す:さがす 見つける:みつける 調べる:しらべる 考える:かんがえる 答える:こたえる
生まれる:うまれる 生きる:いきる 育てる:そだてる 飼う:かう 運ぶ:はこぶ 急ぐ:いそぐ 止まる:とまる 止める:とめる 曲がる:まがる 渡る:わたる 登る:のぼる 飛ぶ:とぶ 届く:とどく
片付ける:かたづける 並ぶ:ならぶ 集める:あつめる 掛ける:かける
来る:くる 来れ:くれ 来ま:きま 来た:きた 来て:きて 来な:こな 来よ:こよ 来ら:こら
下さい:ください お願い:おねがい 御願い:おねがい 有難う:ありがとう 有り難う:ありがとう 御免なさい:ごめんなさい 宜しく:よろしく 頂きます:いただきます 御馳走様:ごちそうさま ご馳走様:ごちそうさま
お休みなさい:おやすみなさい 失礼:しつれい お早う:おはよう こんにちわ:こんにちは こんばんわ:こんばんは 半分:はんぶん 十分:じゅうぶん|じゅっぷん
陽翔:はると 春人:はると 悠真:ゆうま 蓮:れん 湊:みなと 颯太:そうた 蒼太:そうた 結衣:ゆい 唯:ゆい 由衣:ゆい 桜:さくら 咲良:さくら 陽菜:ひな 葵:あおい 凛:りん 結菜:ゆいな
美咲:みさき 健太:けんた 大翔:ひろと 翔太:しょうた 拓海:たくみ 莉子:りこ 花子:はなこ 太郎:たろう
`;
  let BUILTIN = null;
  function builtin() {
    if (BUILTIN) return BUILTIN;
    BUILTIN = L.lexNew('ja');
    BUILTIN_SRC.split(/\s+/).filter(Boolean).forEach(e => {
      const k = e.indexOf(':'), w = e.slice(0, k);
      e.slice(k + 1).split('|').forEach(r => pairsOf(w, r).forEach(p => L.lexAdd(BUILTIN, p[0], p[1], p[2])));
    });
    return BUILTIN;
  }
  // 课程条目 → 读音表的几条（EchoLang.lexicon('ja', …) 用）：词 t → r、句子每块 seg[i] → r[i]
  function lexPairs(e) {
    const out = [];
    if (!e || typeof e.t !== 'string') return out;
    if (Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length) e.seg.forEach((s, i) => out.push(...pairsOf(s, e.r[i])));
    else if (typeof e.r === 'string') out.push(...pairsOf(e.t, e.r));
    return out;
  }
  // 位置 i 开始，读音表里最长的词：几个来源按先后（这道题自己的 → 整门课的 → 自带的），一样长时前面的来源优先；
  // 同一个来源里一样长的「整个词」和「词干（后面要跟平假名）」都算上（話 はなし / 話す はな）
  function lexAt(s, i, look) {
    let best = null;
    const next = (k, L2) => s[i + L2] || '';
    for (const src of look) {
      if (!src) continue;
      for (let len = Math.min(src.max, s.length - i); len >= 1; len--) {
        if (best && len <= best.len) break;
        const k = s.substr(i, len), p = src.map.get(k), c = src.ctx.get(k);
        const alts = (p || []).concat(c && HIRA.test(next(k, len)) ? c : []);
        if (alts.length) { best = { len, alts: Array.from(new Set(alts)) }; break; }
      }
    }
    return best;
  }

  // ---------- 听到的话 → 读音的小单位 ----------
  // 每个单位 { a: [读音…], raw 读不出来的汉字 / 字母, s0 / s1 在统一写法后的字符串里的位置, m 几拍 }；
  // 读音表里只有一种读法的词拆成一拍一拍（好和目标的块对齐），有几种读法的整个词一个单位
  function conv(s, look) {
    const out = [];
    const push = (alts, s0, s1) => {
      if (alts.length === 1) morae(alts[0]).forEach(mo => out.push({ a: [mo], raw: false, s0, s1, m: 1 }));
      else out.push({ a: alts.slice(0, 4), raw: false, s0, s1, m: morae(alts[0]).length });
    };
    let i = 0;
    while (i < s.length) {
      const lx = lexAt(s, i, look), nm = numAt(s, i);
      const hit = nm && (!lx || nm.len > lx.len) ? nm : lx;
      if (hit) { push(hit.alts, i, i + hit.len); i += hit.len; continue; }
      const c = s[i];
      if (c === ':' || c === '：') { i++; continue; }
      if (HIRA.test(c) || c === 'ー') {
        let j = i + 1, mo = c;
        while (j < s.length && SMALL.has(s[j])) { mo += s[j]; j++; }
        out.push({ a: [mo], raw: false, s0: i, s1: j, m: 1 }); i = j; continue;
      }
      if (/[a-z0-9]/.test(c)) { let j = i + 1; while (j < s.length && /[a-z0-9]/.test(s[j])) j++; out.push({ a: [s.slice(i, j)], raw: true, s0: i, s1: j, m: 1 }); i = j; continue; }
      const w = c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) < 0xdc00 ? 2 : 1;
      out.push({ a: [s.substr(i, w)], raw: true, s0: i, s1: i + w, m: 1 }); i += w;
    }
    return out;
  }
  const hearNorm = h => nzKeep(h).replace(/(\d)\s*[:：]\s*(\d)/g, '$1:$2').replace(PUN, m => (m === ':' ? ':' : ''));
  const srcOf = pairs => { const x = L.lexNew('ja'); pairs.forEach(p => L.lexAdd(x, p[0], p[1], p[2])); return x; };
  const lookOf = (ctx, tp) => [tp ? srcOf(tp) : null, ctx && ctx.lex && ctx.lex.map ? ctx.lex : null, builtin()];

  // ---------- 目标 ----------
  const JA_FUNC = new Set(('わたし わたくし ぼく おれ あなた きみ かれ かのじょ これ それ あれ この その あの ここ そこ あそこ こちら そちら あちら ' +
    'です でした だ だった でしょう ます はい ええ うん えっと とても そして それから でも だから じゃあ では ください おねがいします').split(' '));
  const NEG = /(ない|なかった|ません|ではありません|じゃありません)/;
  const HONOR = /(さん|くん|ちゃん|さま|せんせい)$/;
  const NOT_HON = new Set('おとう おかあ おにい おねえ おじい おばあ おじ おば みな あか おじょう'.split(' '));
  const isEntry = (e, t) => e && typeof e === 'object';
  // 显示的块：有 seg 用 seg；一个词（r 是字符串）整个一块；别的每个字一块（标点跟着前一个字）
  function chars(t) {
    const out = [];
    for (const c of t) { if (/\s/.test(c)) continue; if (!nz(c) && out.length) out[out.length - 1] += c; else out.push(c); }
    return out;
  }
  function pieces(text, entry) {
    const t = String(text || '');
    if (isEntry(entry) && Array.isArray(entry.seg) && entry.seg.join('') === t) return entry.seg.slice();
    if (isEntry(entry) && typeof entry.r === 'string' && entry.t === t) return [t];
    return chars(t);
  }
  // 目标 → 打分的块 items：{ rs 读音（几种）, sn 写法, m 拍数, wt, name, piece 显示的第几块（没有 seg 时一块可以盖住几个字：pcs） }
  function tgt(text, ctx) {
    const t = String(text || ''), e = ctx && ctx.entry, names = ((ctx && ctx.names) || []).map(nz).filter(Boolean);
    const mk = (surf, r, piece) => {
      const rr = nz(r), c = core(rr), hon = HONOR.exec(c), stem = hon ? c.slice(0, c.length - hon[0].length) : '';
      // 名字：ctx.names 里的，或者「X さん / くん / ちゃん / さま / 先生」（お父さん、皆さん这种不算）
      const name = names.some(n => nz(surf).includes(n) || rr.includes(n)) || (!!hon && morae(stem).length >= 2 && !NOT_HON.has(stem));
      const wt = NEG.test(rr) ? 2 : (!c || JA_FUNC.has(c) || JA_FUNC.has(rr)) ? 1 : 2;
      return { rs: [rr], sn: nz(surf), m: morae(rr).length, wt, name, piece };
    };
    if (isEntry(e) && Array.isArray(e.seg) && Array.isArray(e.r) && e.seg.length === e.r.length && e.seg.join('') === t) {
      return { items: e.seg.map((s, i) => mk(s, e.r[i], i)).filter(x => x.m), P: e.seg.length, pairs: lexPairs(e) };
    }
    if (isEntry(e) && typeof e.r === 'string' && e.t === t) return { items: [mk(t, e.r, 0)].filter(x => x.m), P: 1, pairs: lexPairs(e) };
    // 没有读音的目标：每个字是显示的一块；读音表里的词、数字、单个假名、读不出来的汉字各是打分的一块
    const disp = chars(t), off = [];
    let s = '';
    disp.forEach((d, k) => { const x = nz(d); for (let q = 0; q < x.length; q++) off.push(k); s += x; });
    const look = lookOf(ctx, null), items = [];
    let i = 0;
    while (i < s.length) {
      const lx = lexAt(s, i, look), nm = numAt(s, i), hit = nm && (!lx || nm.len > lx.len) ? nm : lx;
      let len = 1, rs, raw = false;
      if (hit) { len = hit.len; rs = hit.alts; }
      else if (HIRA.test(s[i]) || s[i] === 'ー') { len = 1; while (i + len < s.length && SMALL.has(s[i + len])) len++; rs = [s.substr(i, len)]; }
      else { rs = [s[i]]; raw = true; }
      const sn = s.substr(i, len), r0 = rs[0];
      const pcs = Array.from(new Set(off.slice(i, i + len)));
      items.push({ rs, sn, m: raw ? 1 : morae(r0).length, wt: raw ? 2 : (PART.includes(r0) || JA_FUNC.has(r0) ? 1 : 2), name: false, piece: items.length, pcs, raw });
      i += len;
    }
    return { items, P: disp.length, pairs: null, chunked: true };
  }

  // ---------- 打分 ----------
  const nameTol = m => Math.max(1, Math.floor(m / 4));
  // 一块的读音 R 和听到的一段读音 A：4 对、3 只差助词 / 词尾、0 不对
  function cmp(it, R, A) {
    if (foldP(R) === foldP(A)) return 4;
    // 第一个音都不一样：不可能只差词尾 / 助词（くる / きます 除外），省得一一去试（长句子快很多）
    if (!it.name && R[0] !== A[0] && !/^[くきこ]/.test(R)) return 0;
    if (it.name && L.lev(morae(fold(R)), morae(fold(A))) <= nameTol(it.m)) return 4;
    return partial(R, A) ? 3 : 0;
  }
  // 那一段里有读不出来的汉字：按写法比
  function rawCmp(it, surf) {
    if (surf === it.sn) return 4;
    if (it.name) return 3;
    return partial(it.sn, surf) ? 3 : 0;
  }
  function score(target, heard, ctx) {
    ctx = ctx || {};
    const T = tgt(target, ctx), P = T.P;
    const zero = { score: 0, marks: new Array(P).fill(false), last: false, full: false };
    const hs = hearNorm(heard).slice(0, 400);
    if (!T.items.length || !hs) return zero;
    const look = lookOf(ctx, T.pairs);
    const H = conv(hs, look);
    if (!H.length) return zero;
    const its = T.items, n = its.length, memo = new Map();
    const val = (i, k, j) => {
      const key = i * 1048576 + k * 1024 + j;
      if (memo.has(key)) return memo.get(key);
      const it = its[i];
      let v = 0, raw = false;
      for (let x = k; x < j; x++) if (H[x].raw) { raw = true; break; }
      let said = '';
      if (raw || it.raw) { said = hs.slice(H[k].s0, H[j - 1].s1).replace(/:/g, ''); v = rawCmp(it, said); }
      else {
        let combos = [''];
        for (let x = k; x < j; x++) {
          const a = H[x].a;
          if (a.length === 1) combos = combos.map(c => c + a[0]);
          else { const nx = []; combos.forEach(c => a.forEach(y => nx.push(c + y))); combos = nx.slice(0, 8); }
        }
        said = combos[0];
        outer: for (const c of combos) for (const r of it.rs) { v = Math.max(v, cmp(it, r, c)); if (v === 4) break outer; }
      }
      // 半对不能靠「只认前半截」：后面紧跟着的假名里有否定（降っていません 只取 降って），肯定否定和目标不一样就不算
      if (v === 3) {
        let ext = '';
        for (let x = j; x < H.length && x < j + 6 && !H[x].raw && H[x].a.length === 1 && HIRA.test(H[x].a[0][0]); x++) ext += H[x].a[0];
        if (NEG.test(it.rs[0] + '') !== NEG.test(said + ext) && NEG.test(said + ext) !== NEG.test(said)) v = 0;
      }
      memo.set(key, v);
      return v;
    };
    const span = i => [1, its[i].m + 4], pref = i => its[i].m;
    const wt = its.map(x => x.wt);
    const { got, at } = L.alignSpans(n, H.length, wt, val, span, pref);
    const nH = H.reduce((a, x) => a + x.m, 0);
    // 多说了一个否定（ない / ません，目标里没有、也没对上哪一块）：意思反了
    const cov = L.covered(at, got, H.length), NEGG = /ない|なかった|ません/g;
    const runs = []; let run = '';
    H.forEach((x, k) => { if (cov[k]) { if (run) runs.push(run); run = ''; } else run += x.a[0]; });
    if (run) runs.push(run);
    const cnt = s => (s.match(NEGG) || []).length;
    const extraNeg = cnt(H.map(x => x.a[0]).join('')) > cnt(its.map(x => x.rs[0]).join('')) && runs.some(s => cnt(s) > 0);
    let whole = null;
    if (n <= 2) {
      const a = fold(its.map(x => x.rs[0]).join('')), b = fold(H.map(x => x.a[0]).join(''));
      whole = { eq: L.contig(n, H.length, val, span, true), split: false, sim: (1 - L.lev(a, b) / Math.max(a.length, b.length, 1)) * 0.95 };
    }
    const contig = n <= 3 && L.contig(n, H.length, val, span);
    const items = its.map((x, i) => ({ wt: x.wt, n: x.m, piece: T.chunked ? i : x.piece, name: x.name }));
    const r = L.negCap(L.finish({ items, got, pieces: T.chunked ? n : P, nH, whole, contig }), extraNeg);
    if (!T.chunked) return r;
    // 没有 seg：打分的块 → 每个字
    const marks = new Array(P).fill(true);
    its.forEach((x, i) => { if (!r.marks[i]) x.pcs.forEach(k => { marks[k] = false; }); });
    return Object.assign(r, { marks, full: r.full && marks.every(Boolean) });
  }

  // ---------- 读音（提示、短不短、几个字） ----------
  function readingOf(text, entry) {
    const t = String(text || '');
    if (isEntry(entry) && Array.isArray(entry.seg) && Array.isArray(entry.r) && entry.seg.join('') === t && entry.seg.length === entry.r.length) return entry.r.map(nz);
    if (isEntry(entry) && typeof entry.r === 'string' && entry.t === t) return [nz(entry.r)];
    return [conv(hearNorm(t), lookOf({}, null)).map(x => x.a[0]).join('')];
  }
  const trailP = s => (String(s).match(/[、。，．,.!！?？」』）)…〜～]+$/) || [''])[0];
  const isKata = s => /^[ァ-ヺ]/.test(s);
  const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const COUNT = /[ぁ-ゖァ-ヺ㐀-䶿一-鿿豈-﫿々0-9０-９]/g;
  const KANA_OR_HAN = /[ぁ-ゖァ-ヺ㐀-鿿]/;
  const KANA = /[ぁ-ゖァ-ヺ]/;
  const SMALLS = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/g;
  const countUnits = text => (String(text || '').replace(SMALLS, '').match(COUNT) || []).length;
  const MIN = [2, 4, 6];
  const minUnits = level => { const v = L.lvOk(level); return v === 0 ? MIN[0] : v === 1 ? MIN[1] : MIN[2]; };

  const mod = {
    code: 'ja',
    name: { zh: '日语', en: 'Japanese', self: '日本語' },
    script: 'kana',
    asr: { cloud: 'ja', apple: 'ja-JP', appleAlt: [], web: 'ja-JP' },
    tts: { cloud: 'Japanese', web: /^ja/i },
    aiName: 'Japanese',
    tones: false,
    // 打分的单位：平假名的拍（读不出来的汉字原样）
    units(text, ctx) {
      const e = ctx && ctx.entry, t = String(text || '');
      if (isEntry(e) && (e.t === t || (Array.isArray(e.seg) && e.seg.join('') === t))) return morae(readingOf(t, e).join(''));
      return conv(hearNorm(t), lookOf(ctx, null)).flatMap(x => (x.a.length > 1 ? morae(x.a[0]) : x.a));
    },
    pieces,
    score,
    best: (target, alts, ctx) => L.best(mod, target, alts, ctx),
    early: (target, heard, ctx) => L.early(mod, target, heard, ctx),
    // 短的（6 拍以内）：说完停 0.4 秒就算说完
    short: (text, entry) => morae(readingOf(text, entry).join('')).length <= 6,
    // 排句子的块：seg 去掉块尾的标点；没有 seg 按「、」和空格切，再不行每个字一块
    tiles(text, entry) {
      const t = String(text || '');
      const strip = s => s.replace(/^[「『（(]+/, '').replace(/[、。，．,.!！?？」』）)…〜～]+$/, '');
      if (isEntry(entry) && Array.isArray(entry.seg) && entry.seg.join('') === t) return entry.seg.map(strip).filter(Boolean);
      const parts = t.split(/[、\s]+/).map(strip).filter(Boolean);
      return parts.length > 1 ? parts : chars(strip(t)).map(strip).filter(Boolean);
    },
    joinTiles: t => (t || []).join(''),
    // 提示：1 = 每块留读音的第一拍（片假名的块用片假名），其余每拍一个 ＿；2 = 每拍一个 ＿（first：第一块照写）；块尾的标点留着
    cue(text, lv, entry, first) {
      const ps = pieces(text, entry), rs = readingOf(text, entry);
      const one = ps.length === rs.length;
      const blocks = one ? ps.map((p, k) => [p, rs[k]]) : [[String(text || ''), rs.join('')]];
      return blocks.map(([p, r], k) => {
        const mo = morae(r), tail = trailP(p);
        if (lv >= 2) return first && k === 0 ? p : '＿'.repeat(mo.length) + tail;
        const head = mo.length ? (isKata(p) ? toKata(mo[0]) : mo[0]) : '';
        return head + '＿'.repeat(Math.max(0, mo.length - 1)) + tail;
      }).join('  ');
    },
    // 几个字（聊天算句数）：假名、汉字、数字各算一个，小的 ゃゅょ 和 ー、标点不算
    countUnits,
    minUnits,
    // 算不算「用日语说了一句」：有假名（只有汉字的只在入门级、三个字以内算），没有韩文，字数够（入门 2、初级 4、其余 6）
    isLine(text, level) {
      const s = String(text || '');
      if (!KANA_OR_HAN.test(s) || /[가-힯]/.test(s)) return false;
      const n = countUnits(s);
      if (!KANA.test(s) && !(L.lvOk(level) === 0 && n <= 3)) return false;
      if ((s.match(/[A-Za-z]+/g) || []).join('').length > n) return false;
      return n >= minUnits(level);
    },
    key: text => nz(text).slice(0, 80),
    head: text => morae(nz(text)).slice(0, 2).join(''),
    // 玩家名字：平假名或片假名（可以有 ー），1–8 个字，不能用汉字（读不出来就没法打分）
    nameOk(s) {
      const v = String(s || '').normalize('NFKC').replace(/[\s　]+/g, '');
      if (!/^[ぁ-ゖァ-ヺー]{1,8}$/.test(v)) return null;
      if (/^[ぁぃぅぇぉゃゅょゎっんーァィゥェォャュョヮッン]/.test(v)) return null;
      return v;
    },
    num: n => jaNum(n),
    time: (h, m) => timeWays(+h || 0, +m || 0)[0],
    date: (mo, d) => countWays(+mo || 1, '月')[0] + countWays(+d || 1, '日')[0],
    count: (n, c) => countWays(+n || 0, c),
    lexPairs,
    _: { nz, morae, fold, foldP, conv: (h, ctx) => conv(hearNorm(h), lookOf(ctx, null)), partial, infl, core, countWays, jaNum, pairsOf, builtin },
  };
  if (L) L.reg('ja', mod);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : globalThis);
