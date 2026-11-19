// 能力检测 · 英语题库的自查：node tools/place/check-en.js
// 查 tools/place/en/{vocab,listen,read,speak}.json 的格式、数量、选项、长度、不该出现的话题和拼写变体。
// 有「错」退出码 1；「留意」只是提醒人看一眼，不算错。加 --quiet 不列「留意」。
// 这里只查机器能查的；一道题是不是只有一个答案、难度对不对级，要人（或者不看答案的另一个模型）来做。
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'en');
const QUIET = process.argv.includes('--quiet');
const BANDS = [0, 1, 2, 3, 4, 5];

const errs = [], notes = [];
const err = (id, msg) => errs.push(id + '：' + msg);
const note = (id, msg) => notes.push(id + '：' + msg);

// ---------- 读文件 ----------
function load(name) {
  const f = path.join(DIR, name + '.json');
  let arr;
  try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(name + '.json', '读不了：' + e.message); return []; }
  if (!Array.isArray(arr)) { err(name + '.json', '不是数组'); return []; }
  return arr;
}
const vocab = load('vocab'), listen = load('listen'), read = load('read'), speak = load('speak');
const all = [].concat(vocab, listen, read, speak);

// ---------- 小工具 ----------
const str = v => typeof v === 'string' && v.trim().length > 0;
const words = s => (String(s).toLowerCase().match(/[a-z0-9']+/g) || []);
const CJK = /[㐀-鿿豈-﫿]/;
const CJK_ANY = /[　-〿㐀-鿿豈-﫿＀-￯]/;
const NON_ASCII = /[^\x20-\x7e]/;
const distinct = a => new Set(a.map(x => String(x).trim().toLowerCase())).size === a.length;

// 图：一个表情算一个字位，不要旗子、肤色、连接符拼的、数字键帽，不要比 Unicode 12 新的
const SEG = new Intl.Segmenter('en', { granularity: 'grapheme' });
const U12_FA = [[0x1FA70, 0x1FA73], [0x1FA78, 0x1FA7A], [0x1FA80, 0x1FA82], [0x1FA90, 0x1FA95]];
const NEWER = [0x1F6D6, 0x1F6D7, 0x1F6DC, 0x1F6DD, 0x1F6DE, 0x1F6DF, 0x1F6FB, 0x1F6FC, 0x1F7F0, 0x1F90C, 0x1F972, 0x1F977, 0x1F978, 0x1F979,
  0x1F9A3, 0x1F9A4, 0x1F9AB, 0x1F9AC, 0x1F9AD, 0x1F9CB, 0x1F9CC];
// 手势、宗教、酒、烟、武器、医疗这些：各地意思不一样，或者不合适
const PIC_AVOID = '👍👎👌✌🤞🤟🤘🤙🖕✋🤚🖐👋🙏👏🙌👊✊🤛🤜☝👆👇👈👉🍺🍻🍷🍸🍹🥂🥃🍾🍶🚬🔫💀☠⚰⚱🏥💊💉⛪🕌🕍🛐✝☪✡☸🕉☦🔯🕎📿🎰🎲💋💘💔🗡⚔🔪💣🍑🍆';
const AVOID_SET = new Set([...PIC_AVOID].map(c => c.codePointAt(0)));
function picErr(s) {
  if (!str(s)) return '空的';
  if ([...SEG.segment(s)].length !== 1) return '不是一个字位';
  const cps = [...s].map(c => c.codePointAt(0)), base = cps[0];
  if (cps.includes(0x200D)) return '用连接符拼的';
  if (cps.some(c => c >= 0x1F3FB && c <= 0x1F3FF)) return '带肤色';
  if (cps.some(c => c >= 0x1F1E6 && c <= 0x1F1FF)) return '旗子';
  if (cps.includes(0x20E3)) return '数字键帽';
  if (cps.some(c => c >= 0xE0020 && c <= 0xE007F)) return '标签序列';
  if (!/\p{Extended_Pictographic}/u.test(String.fromCodePoint(base))) return '不是表情';
  if (cps.length > 2 || (cps.length === 2 && cps[1] !== 0xFE0F)) return '多了别的码位';
  const emojiDefault = /\p{Emoji_Presentation}/u.test(String.fromCodePoint(base));
  if (!emojiDefault && cps.length === 1) return '这个符号默认按文字显示，要带 U+FE0F';
  if (emojiDefault && cps.length === 2) return '不用带 U+FE0F';
  if (base >= 0x1FA70 && base <= 0x1FAFF && !U12_FA.some(([a, b]) => base >= a && base <= b)) return '比 Unicode 12 新';
  if (NEWER.includes(base)) return '比 Unicode 12 新';
  if (AVOID_SET.has(base)) return '手势 / 宗教 / 酒 / 武器这类，换一个';
  return '';
}

// 不该出现的话题（英文按整词，中文按字面）
const TOPIC_EN = ['politics?', 'political', 'politicians?', 'elections?', 'votes?', 'voted', 'voting', 'presidents?', 'governments?', 'parliament', 'ministers?', 'army', 'soldiers?', 'wars?', 'protests?',
  'gods?', 'church(es)?', 'temples?', 'mosques?', 'pray(s|ed|ing|ers?)?', 'bible', 'religio(n|ns|us)', 'christmas', 'easter', 'holy', 'priests?', 'heaven', 'hell', 'angels?', 'devils?', 'bless(ed|ing|ings)?',
  'beers?', 'wines?', 'alcohol(ic)?', 'drunk', 'whisky', 'whiskey', 'vodka', 'pubs?', 'cocktails?', 'champagne',
  'smok(e|es|ed|ing|ers?)', 'cigarettes?', 'tobacco', 'cigars?',
  'gambl(e|es|ed|ing|ers?)', 'casinos?', 'lottery', 'bets?', 'betting', 'poker',
  'girlfriends?', 'boyfriends?', 'dating', 'kiss(es|ed|ing)?', 'romance', 'romantic',
  'kill(s|ed|ing|ers?)?', 'murder(s|ed|ers?)?', 'guns?', 'weapons?', 'shoot(s|ing)?', 'shot', 'fight(s|ing|ers?)?', 'fought', 'punch(es|ed)?', 'stab(s|bed)?', 'bombs?', 'attack(s|ed|ing)?', 'blood', 'battles?', 'battlefields?',
  'crimes?', 'criminals?', 'thie(f|ves)', 'steal(s|ing)?', 'stole', 'stolen', 'robs?', 'robbed', 'robbery', 'prisons?', 'jail', 'violen(t|ce)',
  'sick', 'ill', 'illness(es)?', 'diseases?', 'hospitals?', 'cancer', 'virus(es)?', 'fever', 'pain(s|ful)?', 'aches?', 'headaches?', 'injur(y|ies|ed)', 'wound(s|ed)?', 'surgery', 'clinics?', 'dentists?', 'dental', 'nurses?', 'doctors?', 'ambulances?', 'medicines?', 'pills?',
  'dead', 'deaths?', 'die', 'dies', 'died', 'dying', 'funerals?', 'graves?', 'cemetery', 'ghosts?',
  'earthquakes?', 'floods?', 'hurricanes?', 'tsunamis?', 'disasters?', 'disastrous', 'catastroph(e|es|ic)', 'drown(s|ed|ing)?', 'explosions?',
  // 真实的牌子、作品、赛事
  'google', 'facebook', 'instagram', 'tiktok', 'youtube', 'iphones?', 'ipads?', 'samsung', 'huawei', 'nike', 'adidas', 'coca', 'cola', 'pepsi', 'mcdonalds?', 'kfc', 'starbucks', 'disney', 'marvel', 'netflix', 'microsoft', 'twitter', 'wechat', 'lego', 'barbie', 'minecraft', 'olympics?', 'world cup'];
const TOPIC_RE = new RegExp('\\b(' + TOPIC_EN.join('|') + ')\\b', 'i');
const TOPIC_ZH = ['政治', '选举', '总统', '政府', '战争', '士兵', '军队', '上帝', '教堂', '寺庙', '祈祷', '宗教', '圣诞', '啤酒', '葡萄酒', '喝醉', '酒吧', '香烟', '吸烟', '抽烟', '赌', '彩票', '女朋友', '男朋友', '约会', '接吻',
  '杀', '枪', '武器', '打架', '炸弹', '袭击', '血', '犯罪', '小偷', '监狱', '暴力', '生病', '疾病', '医院', '癌', '病毒', '发烧', '疼', '受伤', '手术', '药', '死', '葬礼', '坟', '鬼', '地震', '洪水', '飓风', '海啸', '灾'];

// 英式 / 美式写法不一样的词：题目里尽量不用（更不能当考点）
const SPELL_RE = new RegExp('\\b(' + ['colou?r\\w*', 'favou?r\\w*', 'neighbou?r\\w*', 'cent(re|er)s?', 'theat(re|er)s?', '(kilo|centi|milli)?met(re|er)s?', 'lit(re|er)s?', 'labou?r\\w*', 'honou?r\\w*', 'behaviou?r\\w*', 'flavou?r\\w*', 'harbou?r\\w*', 'humou?r\\w*', 'rumou?rs?',
  'gr[ae]y', 'tyres?', 'programmes?', 'cheques?', 'jewell?ery', 'travell?(ed|ing|ers?)', 'cancell?(ed|ing)', 'modell?(ed|ing)', 'practis(e|es|ed|ing)', 'practic(ed|ing)', 'licen[sc]e', 'defen[sc]e', 'offen[sc]e', 'analy[sz]e\\w*', 'catalog(ue)?s?',
  'maths?', 'mum', 'mom', 'mummy', 'mommy', 'aeroplanes?', 'airplanes?', 'pyjamas', 'pajamas', 'learnt', 'dreamt', 'spelt', 'burnt', 'gotten', 'whilst', 'amongst',
  'flats?', 'apartments?', 'lifts?', 'elevators?', 'lorr(y|ies)', 'trucks?', 'biscuits?', 'cookies?', 'sweets', 'cand(y|ies)', 'soccer', 'vacations?', 'movies?', 'autumn', 'trousers', 'pants', 'rubbish', 'garbage', 'trash', 'queues?', 'petrol', 'gasoline', 'crisps', 'pavements?', 'sidewalks?', 'zips?', 'zippers?', 'fortnight', 'timetables?',
  '\\w+i[sz](e|es|ed|ing|ation|ations)'].join('|') + ')\\b', 'gi');
// -ise / -ize 结尾但两边写法一样的词
const ISE_OK = new Set(['rise', 'rises', 'arise', 'arises', 'wise', 'likewise', 'otherwise', 'size', 'sizes', 'sized', 'prize', 'prizes', 'noise', 'noises', 'exercise', 'exercises', 'exercised', 'exercising', 'surprise', 'surprises', 'surprised', 'surprising',
  'promise', 'promises', 'promised', 'promising', 'advise', 'advises', 'advised', 'advising', 'precise', 'raise', 'raises', 'raised', 'raising', 'praise', 'praises', 'praised', 'praising', 'disguise', 'seize', 'seized', 'compromise', 'compromises', 'premise', 'premises', 'revise', 'revised', 'revising',
  'supervise', 'supervised', 'paradise', 'concise', 'expertise', 'enterprise', 'devise', 'devised', 'despise', 'comprise', 'comprises', 'comprised', 'franchise', 'televised', 'improvise', 'improvised', 'demise', 'poised', 'poise', 'bruise', 'bruised', 'cruise', 'cruises', 'treatise', 'anise', 'noised', 'raising', 'rising']);

function scanEn(id, field, s) {
  if (!str(s)) return;
  if (CJK_ANY.test(s)) err(id, field + ' 里有中文或全角符号：' + s);
  else if (NON_ASCII.test(s)) err(id, field + ' 里有不是 ASCII 的字符（配音和识别都容易出岔子）：' + s.match(NON_ASCII)[0] + ' ← ' + s);
  const t = TOPIC_RE.exec(s);
  if (t) err(id, field + ' 碰到不该出现的话题 / 真实名称「' + t[0] + '」：' + s);
  for (const m of s.matchAll(SPELL_RE)) { if (!ISE_OK.has(m[0].toLowerCase())) err(id, field + ' 有英美写法 / 说法不一样的词「' + m[0] + '」：' + s); }
}
function scanZh(id, field, s, strict) {
  if (!str(s)) { err(id, field + ' 是空的'); return; }
  if (!CJK.test(s)) err(id, field + ' 里没有中文：' + s);
  if (strict && /[A-Za-z]/.test(s)) err(id, field + ' 里有英文字母：' + s);
  const t = TOPIC_ZH.find(w => s.includes(w));
  if (t) err(id, field + ' 碰到不该出现的话题「' + t + '」：' + s);
}

// ---------- 每道题都要有的 ----------
const seen = new Map();
const LETTER = { vocab: 'v', listen: 'l', speak: 's' };
for (const it of all) {
  if (!it || typeof it !== 'object' || !str(it.id)) { err('（没有 id）', JSON.stringify(it).slice(0, 80)); continue; }
  if (seen.has(it.id)) err(it.id, 'id 重复');
  seen.set(it.id, it);
  const m = /^en-([vlgrs])-([0-5])-(\d{3})$/.exec(it.id);
  if (!m) { err(it.id, 'id 的样子不对（en-<v|l|g|r|s>-<级>-<三位数>）'); continue; }
  if (!Number.isInteger(it.band) || +m[2] !== it.band) err(it.id, 'id 里的级和 band 对不上');
  const want = it.skill === 'read' ? (str(it.passage) ? 'r' : 'g') : LETTER[it.skill];
  if (m[1] !== want) err(it.id, 'id 的字母和题型对不上（应该是 ' + want + '）');
}
for (const [arr, s] of [[vocab, 'vocab'], [listen, 'listen'], [read, 'read'], [speak, 'speak']]) for (const it of arr) if (it.skill !== s) err(it.id, 'skill 应该是 ' + s);
// 编号要连着
for (const k of ['v', 'l', 'g', 'r', 's']) for (const b of BANDS) {
  const ns = all.filter(it => new RegExp('^en-' + k + '-' + b + '-').test(it.id)).map(it => +it.id.slice(-3)).sort((a, c) => a - c);
  ns.forEach((n, i) => { if (n !== i + 1) err('en-' + k + '-' + b, '编号不连着：' + ns.join(',')); });
}

// ---------- 选择题公用 ----------
function choice(it) {
  if (!Array.isArray(it.opts) || it.opts.length !== 4 || !it.opts.every(str)) { err(it.id, 'opts 要 4 个不空的选项'); return false; }
  if (!distinct(it.opts)) err(it.id, '选项重复：' + JSON.stringify(it.opts));
  if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer > 3) { err(it.id, 'answer 超出范围'); return false; }
  it.opts.forEach((o, i) => scanEn(it.id, 'opts[' + i + ']', o));
  return true;
}

// ---------- 词汇 ----------
const POS = new Set(['n', 'v', 'adj', 'adv', 'prep', 'conj', 'num', 'phr', 'int']);
const IRREG = { come: ['came'], overcome: ['overcame'], run: ['ran'], take: ['took', 'taken'], give: ['gave', 'given'], find: ['found'], buy: ['bought'], forget: ['forgot'], choose: ['chose'], draw: ['drew'], swim: ['swam'], wear: ['wore'] };
const SMALL = new Set(['a', 'an', 'the', 'of', 'to', 'for', 'and', 'by', 'up', 'off', 'out', 'with', 'in', 'on']);
// 词根：五个字母以上的词取前五个字母，短的取整个词
const stemOf = w => w.length >= 6 ? w.slice(0, 5) : w;
function usesHeadword(word, def) {
  const hw = word.toLowerCase().split(/\s+/), dw = words(def);
  if (hw.length > 1 && def.toLowerCase().includes(word.toLowerCase())) return word;
  for (const h of hw) {
    if (hw.length > 1 && SMALL.has(h)) continue;
    const st = stemOf(h);
    const hit = dw.find(d => h.length >= 6 ? d.startsWith(st) : (d === h || d === h + 's' || d === h + 'ed' || d === h + 'ing' || (IRREG[h] || []).includes(d)));
    if (hit) return hit;
  }
  return '';
}
const headwords = new Map(), picOf = new Map();
for (const it of vocab) {
  const id = it.id;
  if (!str(it.word)) { err(id, '缺 word'); continue; }
  const key = it.word.toLowerCase();
  if (headwords.has(key)) err(id, '词重复了：' + it.word + '（另一条是 ' + headwords.get(key) + '）');
  headwords.set(key, id);
  if (it.mode !== 'listen' && it.mode !== 'read') err(id, 'mode 要是 listen / read');
  if (!POS.has(it.pos)) err(id, 'pos 不认识：' + it.pos);
  scanEn(id, 'word', it.word);
  if (!str(it.ex)) err(id, '缺 ex'); else {
    scanEn(id, 'ex', it.ex);
    const ew = words(it.ex);
    for (const h of key.split(/\s+/)) {
      const st = h.slice(0, Math.min(4, h.length));
      if (!ew.some(w => w.startsWith(st) || (IRREG[h] || []).includes(w))) err(id, 'ex 里没有这个词（' + h + '）：' + it.ex);
    }
    if (words(it.ex).length > [6, 10, 12, 14, 16, 18][it.band]) note(id, 'ex 偏长：' + it.ex);
  }
  // 中文意思
  const G = it.gloss || {}, W = it.wrong || {};
  if (!str(G.zh)) err(id, '缺 gloss.zh');
  else {
    scanZh(id, 'gloss.zh', G.zh, true);
    if (!Array.isArray(W.zh) || W.zh.length !== 3 || !W.zh.every(str)) err(id, 'wrong.zh 要 3 个');
    else {
      W.zh.forEach((w, i) => scanZh(id, 'wrong.zh[' + i + ']', w, true));
      if (!distinct(W.zh.concat([G.zh]))) err(id, '中文选项重复：' + JSON.stringify(W.zh.concat([G.zh])));
      const L = W.zh.concat([G.zh]).map(s => [...s].length);
      if (Math.max(...L) - Math.min(...L) > 3) note(id, '中文选项长短差得多：' + JSON.stringify(W.zh.concat([G.zh])));
    }
  }
  // 图（0–1 级）
  if (it.pic != null || it.wrongPic != null) {
    if (!str(it.pic) || !Array.isArray(it.wrongPic) || it.wrongPic.length !== 3) err(id, 'pic 和 wrongPic（3 个）要一起给');
    else {
      const four = [it.pic].concat(it.wrongPic);
      four.forEach(p => { const e = picErr(p); if (e) err(id, '图「' + p + '」' + e); });
      if (new Set(four).size !== 4) err(id, '四张图有重复：' + four.join(' '));
      if (picOf.has(it.pic)) note(id, '这张图 ' + it.pic + ' 已经是另一个词的答案（' + picOf.get(it.pic) + '）');
      picOf.set(it.pic, id);
    }
    if (it.band > 1) note(id, '2 级以上一般不用图');
  }
  // 英文释义（2–5 级）
  if (G.en != null || W.en != null) {
    if (!str(G.en) || !Array.isArray(W.en) || W.en.length !== 3 || !W.en.every(str)) err(id, 'gloss.en 和 wrong.en（3 个）要一起给');
    else {
      const four = [G.en].concat(W.en);
      four.forEach((d, i) => scanEn(id, i ? 'wrong.en[' + (i - 1) + ']' : 'gloss.en', d));
      if (!distinct(four)) err(id, '英文释义重复：' + JSON.stringify(four));
      const u = usesHeadword(it.word, G.en);
      if (u) err(id, 'gloss.en 用了这个词自己或者同一家的词（' + u + '）：' + G.en);
      W.en.forEach(d => { const x = usesHeadword(it.word, d); if (x) err(id, 'wrong.en 用了这个词自己或者同一家的词（' + x + '）：' + d); });
      const n = four.map(d => words(d).length);
      if (Math.max(...n) > 12) note(id, '英文释义偏长（' + Math.max(...n) + ' 个词）');
      if (Math.max(...n) / Math.min(...n) > 2.5 && Math.max(...n) - Math.min(...n) > 4) note(id, '英文释义长短差得多：' + JSON.stringify(four));
      if (n[0] === Math.max(...n) && n.filter(x => x === n[0]).length === 1 && n[0] - Math.max(...n.slice(1)) >= 3) note(id, '对的释义明显最长：' + JSON.stringify(four));
      if (n[0] === Math.min(...n) && n.filter(x => x === n[0]).length === 1 && Math.min(...n.slice(1)) - n[0] >= 3) note(id, '对的释义明显最短：' + JSON.stringify(four));
    }
  }
  if (it.band >= 2 && !str(G.en)) err(id, '2–5 级要有 gloss.en / wrong.en');
  if (it.band <= 1 && !str(it.pic) && str(G.en)) note(id, '0–1 级没图却有英文释义');
}

// 两个词的四个选项几乎一样（四个里有三个以上相同）：同一个人先后做到这两题，前一题会给后一题提示
{
  const four = (it, pic) => new Set(pic ? (str(it.pic) ? [it.pic].concat(it.wrongPic || []) : []) : [it.gloss && it.gloss.zh].concat((it.wrong && it.wrong.zh) || []));
  const share = (A, B) => { let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n; };
  for (let i = 0; i < vocab.length; i++) for (let j = i + 1; j < vocab.length; j++) {
    const a = vocab[i], b = vocab[j];
    const n = Math.max(share(four(a, true), four(b, true)), share(four(a, false), four(b, false)));
    if (n >= 4) err(a.id, '和 ' + b.id + ' 的四个选项完全一样（' + a.word + ' / ' + b.word + '）');
    else if (n === 3) note(a.id, '和 ' + b.id + ' 的选项有三个一样（' + a.word + ' / ' + b.word + '），别让同一个人连着做');
  }
}

// ---------- 听力 ----------
const LISTEN_MAX = [6, 22, 50, 50, 65, 65];
for (const it of listen) {
  const id = it.id;
  if (!Array.isArray(it.audio) || !it.audio.length) { err(id, '缺 audio'); continue; }
  let total = 0; const gOf = {};
  it.audio.forEach((a, i) => {
    if (!a || !str(a.text) || (a.g !== 'f' && a.g !== 'm') || !str(a.who)) { err(id, 'audio[' + i + '] 要有 who、g（f / m）、text'); return; }
    scanEn(id, 'audio[' + i + ']', a.text);
    if (/\d/.test(a.text)) err(id, 'audio 里有阿拉伯数字（配音可能念法不一）：' + a.text);
    if (/\b(Mr|Mrs|Ms|Dr|St|etc|e\.g|i\.e)\b\.?/.test(a.text)) note(id, 'audio 里有缩写：' + a.text);
    if (gOf[a.who] && gOf[a.who] !== a.g) err(id, '同一个人 ' + a.who + ' 的 g 前后不一样');
    gOf[a.who] = a.g;
    if (i && it.audio[i - 1].who === a.who) err(id, '连着两句是同一个人（应该轮流）');
    total += words(a.text).length;
  });
  if (Object.keys(gOf).length === 2 && new Set(Object.values(gOf)).size !== 2) err(id, '两个人要一男一女');
  if (Object.keys(gOf).length > 2) err(id, '最多两个人');
  if (total > LISTEN_MAX[it.band]) err(id, '第 ' + it.band + ' 级的听力一共 ' + total + ' 个词，超过 ' + LISTEN_MAX[it.band]);
  if (it.band === 0 && it.audio.length !== 1) err(id, '0 级只念一个词或短语');
  if (it.audio.length > 4) err(id, '对话最多 4 轮');
  if (!str(it.q)) err(id, '缺 q'); else scanEn(id, 'q', it.q);
  scanZh(id, 'qGloss.zh', it.qGloss && it.qGloss.zh, false);
  if (!choice(it)) continue;
  if (it.band === 0) {
    const oz = it.optsGloss && it.optsGloss.zh;
    if (!Array.isArray(oz) || oz.length !== 4) err(id, '0 级要有 optsGloss.zh（4 个）');
    else { oz.forEach((o, i) => scanZh(id, 'optsGloss.zh[' + i + ']', o, true)); if (!distinct(oz)) err(id, 'optsGloss.zh 重复'); }
  }
  if (it.optsPic != null) {
    if (!Array.isArray(it.optsPic) || it.optsPic.length !== 4) err(id, 'optsPic 要和 opts 一样多');
    else {
      it.optsPic.forEach(p => { const e = picErr(p); if (e) err(id, '图「' + p + '」' + e); });
      if (new Set(it.optsPic).size !== 4) err(id, '四张图有重复：' + it.optsPic.join(' '));
    }
    if (it.band > 1) note(id, '2 级以上的听力一般不用图');
  }
  // 干扰项最好用到录音里说过的东西（2 级以上）
  if (it.band >= 2) {
    const aw = new Set(words(it.audio.map(a => a.text).join(' ')).filter(w => w.length > 3));
    const used = it.opts.filter((o, i) => i !== it.answer && words(o).some(w => aw.has(w))).length;
    if (!used) note(id, '三个错的选项都没用到录音里的词');
  }
}

// ---------- 语法填空、阅读 ----------
for (const it of read) {
  const id = it.id;
  if (!choice(it)) continue;
  if (str(it.passage)) {
    scanEn(id, 'passage', it.passage);
    const n = words(it.passage).length;
    if (n < 40 || n > 90) err(id, '短文 ' + n + ' 个词，要 40–90');
    if (!str(it.q)) err(id, '缺 q'); else scanEn(id, 'q', it.q);
    if (it.qGloss != null) scanZh(id, 'qGloss.zh', it.qGloss.zh, false);
    if (it.band < 3) err(id, '0–2 级只出填空题');
  } else {
    if (!str(it.text)) { err(id, '缺 text'); continue; }
    scanEn(id, 'text', it.text);
    const blanks = (it.text.match(/_{2,}/g) || []);
    if (blanks.length !== 1 || blanks[0] !== '___') err(id, '填空题要正好一个 ___：' + it.text);
    if (!str(it.point)) err(id, '缺 point'); else scanEn(id, 'point', it.point);
    // 答案别在题干里出现过
    const stem = new Set(words(it.text.replace('___', ' ')));
    const ans = words(it.opts[it.answer]);
    if (ans.length && ans.every(w => stem.has(w)) && ans.some(w => w.length > 3)) note(id, '答案里的词在题干里已经出现：' + it.opts[it.answer] + ' ← ' + it.text);
  }
}

// ---------- 口语 ----------
const READ_LEN = [[3, 5], [5, 8], [8, 12], [10, 16], [14, 22], [16, 28]];
for (const it of speak) {
  const id = it.id;
  if (it.kind === 'read') {
    if (!str(it.text)) { err(id, '缺 text'); continue; }
    scanEn(id, 'text', it.text);
    if (/\d/.test(it.text)) err(id, '朗读句子里有阿拉伯数字');
    const n = words(it.text).length, [lo, hi] = READ_LEN[it.band];
    if (n < lo || n > hi) err(id, '第 ' + it.band + ' 级朗读 ' + n + ' 个词，要 ' + lo + '–' + hi);
  } else if (it.kind === 'answer') {
    if (!str(it.q)) err(id, '缺 q'); else scanEn(id, 'q', it.q);
    scanZh(id, 'qGloss.zh', it.qGloss && it.qGloss.zh, false);
    if (!str(it.rubric)) err(id, '缺 rubric'); else { scanEn(id, 'rubric', it.rubric); if (words(it.rubric).length < 25) note(id, 'rubric 太短'); }
    // 不问个人信息
    if (/\byour (real )?(name|age|school|address|family|parents?|mother|father|job|boss|salary|health|religion|phone|birthday|home ?town|country)\b|\bhow old are you\b|\bwhere do you (live|work|study)\b|\bwho do you live with\b/i.test(it.q)) err(id, '问到了个人信息：' + it.q);
  } else err(id, 'kind 要是 read / answer');
}

// ---------- 数量 ----------
const count = (arr, f) => BANDS.map(b => arr.filter(it => it.band === b && (!f || f(it))).length);
const expect = (name, got, want) => { if (got.join('/') !== want.join('/')) err(name, '每级的数量是 ' + got.join('/') + '，应该是 ' + want.join('/')); };
expect('vocab', count(vocab), [30, 30, 30, 30, 30, 30]);
expect('listen', count(listen), [18, 18, 18, 18, 18, 18]);
expect('read', count(read), [20, 20, 20, 20, 20, 20]);
expect('read 填空', count(read, it => !it.passage), [20, 20, 20, 12, 12, 12]);
expect('read 短文', count(read, it => !!it.passage), [0, 0, 0, 8, 8, 8]);
expect('speak', count(speak), [8, 8, 8, 8, 8, 8]);
expect('speak 问答', count(speak, it => it.kind === 'answer'), [0, 0, 2, 4, 6, 6]);
const modeL = count(vocab, it => it.mode === 'listen');
modeL.forEach((n, b) => { if (n < 12 || n > 18) err('vocab', '第 ' + b + ' 级听的词有 ' + n + ' 个，要差不多一半（12–18）'); });
const picN = count(vocab, it => str(it.pic)), enN = count(vocab, it => it.gloss && str(it.gloss.en)), lpicN = count(listen, it => Array.isArray(it.optsPic));
if (picN[0] < 27) err('vocab', '0 级有图的只有 ' + picN[0] + ' 个，差不多每个都要有');
if (picN[1] < 20) err('vocab', '1 级有图的只有 ' + picN[1] + ' 个，至少三分之二');

// ---------- 答案位置 ----------
function spread(name, arr) {
  const c = [0, 0, 0, 0]; arr.forEach(it => { if (Number.isInteger(it.answer)) c[it.answer]++; });
  const n = arr.length;
  c.forEach((x, i) => { if (x < n * 0.18 || x > n * 0.32) err(name, '答案在第 ' + i + ' 个的有 ' + x + '/' + n + ' 道，不够平均'); });
  for (const b of BANDS) { const cb = [0, 0, 0, 0]; arr.filter(it => it.band === b).forEach(it => cb[it.answer]++); if (cb.some(x => x === 0)) note(name, '第 ' + b + ' 级有的位置一次都没当过答案：' + cb.join('/')); }
  // 对的那个是不是老是明显最长 / 最短（比别的长或短 15% 以上、且差 3 个字符以上才算）
  let longest = 0, shortest = 0;
  arr.forEach(it => {
    const a = it.opts[it.answer].length, rest = it.opts.filter((o, i) => i !== it.answer).map(o => o.length);
    const mx = Math.max(...rest), mn = Math.min(...rest);
    if (a >= mx * 1.15 && a - mx >= 3) { longest++; if (it.band >= 2) note(it.id, '对的选项明显最长：' + it.opts[it.answer] + ' ／ ' + it.opts.filter((o, i) => i !== it.answer).join(' ／ ')); }
    if (a <= mn * 0.85 && mn - a >= 3) shortest++;
  });
  if (longest > n * 0.25) note(name, '对的选项明显最长的有 ' + longest + '/' + n + ' 道，偏多');
  if (shortest > n * 0.25) note(name, '对的选项明显最短的有 ' + shortest + '/' + n + ' 道，偏多');
  return c.join('/') + '（对的明显最长 ' + longest + '、明显最短 ' + shortest + '）';
}
const posL = spread('listen', listen), posR = spread('read', read);

// ---------- 差不多一样的题 ----------
function jaccard(a, b) { const A = new Set(a), B = new Set(b); let i = 0; A.forEach(x => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); }
function near(name, list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.w.length < 3 || b.w.length < 3) { if (a.t === b.t) err(a.id, name + ' 和 ' + b.id + ' 一样：' + a.t); continue; }
    const s = jaccard(a.w, b.w);
    if (s >= 0.8) err(a.id, name + ' 和 ' + b.id + ' 几乎一样：' + a.t + ' ／ ' + b.t);
    else if (s >= 0.6) note(a.id, name + ' 和 ' + b.id + ' 有点像：' + a.t + ' ／ ' + b.t);
  }
}
const T = (id, t) => ({ id, t: t.toLowerCase(), w: words(t) });
near('填空题干', read.filter(it => !it.passage && str(it.text)).map(it => T(it.id, it.text)));
near('短文', read.filter(it => it.passage).map(it => T(it.id, it.passage)));
near('录音', listen.filter(it => Array.isArray(it.audio)).map(it => T(it.id, it.audio.map(a => a.text).join(' '))));
near('口语', speak.map(it => T(it.id, it.text || it.q || '')));
near('朗读句子和填空题干', speak.filter(it => it.kind === 'read').map(it => T(it.id, it.text)).concat(read.filter(it => !it.passage && str(it.text)).map(it => T(it.id, it.text.replace('___', '')))));

// ---------- 仓库的「不能出现的词」 ----------
try {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'banned-terms.txt'), 'utf8').split(/\r?\n/);
  const terms = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^re:\/(.*)\/([a-z]*)$/.exec(t);
    terms.push(m ? { label: t, re: new RegExp(m[1], m[2].replace('g', '')) } : { label: t, s: t });
  }
  for (const name of ['vocab', 'listen', 'read', 'speak']) {
    fs.readFileSync(path.join(DIR, name + '.json'), 'utf8').split(/\r?\n/).forEach((line, i) => {
      for (const t of terms) if (t.re ? t.re.test(line) : line.includes(t.s)) err(name + '.json:' + (i + 1), '碰到 banned-terms.txt 里的「' + t.label + '」');
    });
  }
} catch (e) { note('banned-terms', '没读到 tools/banned-terms.txt，这一项没查'); }

// ---------- 引擎那边的检查（有就顺便跑） ----------
let engine = '没跑（placement.js / build.js 还加载不了）';
try {
  const B = require('./build.js');
  const r = B.read(DIR, 'en');
  const bad = r.bad.concat(B.validate('en', r.items));
  engine = bad.length ? bad.length + ' 处' : '通过';
  bad.slice(0, 30).forEach(x => err('build.js', x));
} catch (e) { engine += '：' + String(e.message).split('\n')[0]; }

// ---------- 报告 ----------
console.log('英语题库 ' + all.length + ' 道');
console.log('  词汇 ' + count(vocab).join('/') + '   听的 ' + modeL.join('/') + '   有图 ' + picN.join('/') + '   有英文释义 ' + enN.join('/'));
console.log('  听力 ' + count(listen).join('/') + '   选项有图 ' + lpicN.join('/') + '   答案位置 ' + posL);
console.log('  读   ' + count(read).join('/') + '   填空 ' + count(read, it => !it.passage).join('/') + '   短文 ' + count(read, it => !!it.passage).join('/') + '   答案位置 ' + posR);
console.log('  口语 ' + count(speak).join('/') + '   问答 ' + count(speak, it => it.kind === 'answer').join('/'));
console.log('  引擎的检查（build.js）：' + engine);
if (notes.length && !QUIET) console.log('\n留意 ' + notes.length + ' 处：\n- ' + notes.join('\n- '));
if (errs.length) { console.log('\n错 ' + errs.length + ' 处：\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('\n没有错' + (notes.length ? '（留意 ' + notes.length + ' 处' + (QUIET ? '，去掉 --quiet 看' : '') + '）' : ''));
