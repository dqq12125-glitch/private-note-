// 能力检测的题库：检查 tools/place/<语言>/{vocab,listen,read,speak}.json，生成 placement-data.js（window.PLACE_DATA[语言]）。
// 用法：
//   node tools/place/build.js            正式题库（哪门语言的四个文件齐了就生成哪门；有一处不对就停下，什么都不写）
//   node tools/place/build.js --dev      题库还没写好时开发用：用 tools/place/_placeholder/seed.json 里的几道样题铺满每一级（生成的文件标着 tmp: true，
//                                        检测界面上会写「临时题库」，tests/place.test.js 也会说）——正式题库到了重新跑一遍不带 --dev 的
//   node tools/place/build.js --check    只检查，不写文件
// 生成的 placement-data.js 不要手改。题库的格式（每个文件是一个 JSON 数组）：
//   词汇  {"id":"en-v-3-012","skill":"vocab","band":3,"mode":"listen"|"read","word":"reluctant","pos":"adj",
//          "gloss":{"zh":"不情愿的","en":"not wanting to do something"},"wrong":{"zh":[三个],"en":[三个]},"pic":"🍎","wrongPic":[三个],"ex":"…"}
//          意思怎么给，按学习者的界面语言挑：有这门语言的 gloss 就用它，没有就用图（pic + wrongPic），再没有用英文释义（gloss.en + wrong.en）；
//          三样至少要有一样（界面语言是英语的人只能做有图或者有英文释义的题）
//   听力  {"id":"en-l-2-007","skill":"listen","band":2,"audio":[{"who":"A","g":"f","text":"…"},…],"q":"…","qGloss":{"zh":"…"},"opts":[3–4 个],"answer":0,
//          "optsPic":[和 opts 一样多的图，可以没有],"optsGloss":{"zh":[和 opts 一样多的译文，可以没有]}}
//          0–1 级：题目的译文（qGloss）、选项的图和译文直接给；2 级起题目只有外语，译文收在「译」后面（点了算看过提示）
//   语法  {"id":"en-g-4-003","skill":"read","band":4,"text":"… ___ …","opts":[…],"answer":0,"point":"…"}
//   阅读  {"id":"en-r-4-011","skill":"read","band":4,"passage":"…","q":"…","qGloss":{…},"opts":[…],"answer":2}
//   朗读  {"id":"en-s-1-004","skill":"speak","band":1,"kind":"read","text":"…"}
//   问答  {"id":"en-s-3-002","skill":"speak","band":3,"kind":"answer","q":"…","qGloss":{…},"rubric":"…"}
//   answer 是 opts 里第几个（按写的顺序，从 0 数）；游戏里每次打乱选项。
// 会停下来的错：id 重复、缺字段、answer 超出范围、选项重复、哪一级的题不够引擎用（每门界面语言分别数，见 placement.js 的 NEED）。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const ENGINE = require(path.join(ROOT, 'placement.js')).engine;   // 每级至少几道、哪些题这门界面语言能做：和游戏里用同一份
const SKILLS = ENGINE.SKILLS, FILES = { vocab: 'vocab', listen: 'listen', read: 'read', speak: 'speak' };
const UIS = ['zh', 'en'];   // 现在有的界面语言：每一门都要够题
const BANDS = [0, 1, 2, 3, 4, 5];

const str = v => typeof v === 'string' && v.trim().length > 0;
const same = a => { const s = a.map(x => String(x).trim().toLowerCase()); return new Set(s).size !== s.length; };
const langMap = (o, f) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0 && Object.values(o).every(f);

// 查一门语言的全部题目。items：[{ …题目, _file }]；返回出错的说明（空数组 = 没问题）
function validate(lang, items, o) {
  o = o || {};
  const bad = [], seen = new Map(), need = o.need || ENGINE.NEED, uis = o.uis || UIS;
  const err = (it, msg) => bad.push((it && it.id ? it.id : '（没有 id）') + (it && it._file ? ' [' + it._file + ']' : '') + '：' + msg);
  const opts = it => {
    if (!Array.isArray(it.opts) || it.opts.length < 3 || it.opts.length > 4 || !it.opts.every(str)) { err(it, '缺 opts（要 3–4 个不空的选项）'); return; }
    if (same(it.opts)) err(it, '选项重复：' + JSON.stringify(it.opts));
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= it.opts.length) err(it, 'answer 超出范围（' + JSON.stringify(it.answer) + '，选项有 ' + it.opts.length + ' 个）');
    if (it.optsPic != null && (!Array.isArray(it.optsPic) || it.optsPic.length !== it.opts.length || !it.optsPic.every(str) || same(it.optsPic))) err(it, 'optsPic 要和 opts 一样多、各不相同');
    if (it.optsGloss != null && !langMap(it.optsGloss, a => Array.isArray(a) && a.length === it.opts.length && a.every(str))) err(it, 'optsGloss 要写成 {"zh":[和 opts 一样多的译文]}');
  };
  const gloss = (it, k) => { if (it[k] != null && !langMap(it[k], str)) err(it, k + ' 要写成 {"zh":"…"} 这样'); };
  for (const it of items) {
    if (!it || typeof it !== 'object') { bad.push('有一条不是对象'); continue; }
    if (!str(it.id)) { err(it, '缺 id'); continue; }
    if (seen.has(it.id)) err(it, 'id 重复（另一条在 ' + (seen.get(it.id) || '同一个文件') + '）');
    seen.set(it.id, it._file || '');
    if (!it.id.startsWith(lang + '-')) err(it, 'id 要以「' + lang + '-」开头');
    if (!SKILLS.includes(it.skill)) { err(it, '缺 skill（vocab / listen / read / speak）'); continue; }
    if (it._skill && it.skill !== it._skill) err(it, 'skill 是 ' + it.skill + '，却放在 ' + it._file);
    if (!Number.isInteger(it.band) || it.band < 0 || it.band > 5) { err(it, '缺 band（0–5 的整数）'); continue; }
    const m = /^[a-z]{2,3}-[a-z]+-(\d)-/.exec(it.id);
    if (m && +m[1] !== it.band) err(it, 'id 里写的是第 ' + m[1] + ' 级，band 却是 ' + it.band);
    if (it.skill === 'vocab') {
      if (!str(it.word)) err(it, '缺 word');
      if (it.mode !== 'listen' && it.mode !== 'read') err(it, '缺 mode（listen / read）');
      const G = it.gloss || {}, Wr = it.wrong || {};
      if (it.gloss != null && !langMap(G, str)) err(it, 'gloss 要写成 {"zh":"…"} 这样');
      for (const l of new Set(Object.keys(G).concat(Object.keys(Wr)))) {
        if (!str(G[l])) { err(it, 'wrong.' + l + ' 有了，gloss.' + l + ' 却没有'); continue; }
        if (!Array.isArray(Wr[l]) || Wr[l].length !== 3 || !Wr[l].every(str)) { err(it, '缺 wrong.' + l + '（要 3 个错的意思）'); continue; }
        if (same(Wr[l].concat([G[l]]))) err(it, '选项重复（' + l + '）：' + JSON.stringify(Wr[l].concat([G[l]])));
      }
      if (it.pic != null || it.wrongPic != null) {
        if (!str(it.pic) || !Array.isArray(it.wrongPic) || it.wrongPic.length !== 3 || !it.wrongPic.every(str)) err(it, 'pic 和 wrongPic 要一起给（wrongPic 3 个）');
        else if (same(it.wrongPic.concat([it.pic]))) err(it, '选项重复（图）：' + JSON.stringify(it.wrongPic.concat([it.pic])));
      }
      if (!Object.keys(G).length && !str(it.pic)) err(it, '缺 gloss（或者 pic）：意思至少要有一种给法');
    } else if (it.skill === 'listen') {
      if (!Array.isArray(it.audio) || !it.audio.length || !it.audio.every(a => a && str(a.text) && (a.g === 'f' || a.g === 'm'))) err(it, '缺 audio（每句要 text 和 g: "f" / "m"）');
      if (!str(it.q)) err(it, '缺 q');
      gloss(it, 'qGloss'); opts(it);
    } else if (it.skill === 'read') {
      if (str(it.passage)) { if (!str(it.q)) err(it, '有 passage 却缺 q'); }
      else if (!str(it.text)) err(it, '缺 text（语法题）或者 passage + q（阅读题）');
      gloss(it, 'qGloss'); opts(it);
    } else {
      if (it.kind === 'read') { if (!str(it.text)) err(it, '缺 text（朗读题）'); }
      else if (it.kind === 'answer') { if (!str(it.q)) err(it, '缺 q（问答题）'); if (!str(it.rubric)) err(it, '缺 rubric（问答题的评分要点）'); gloss(it, 'qGloss'); }
      else err(it, '缺 kind（read / answer）');
    }
  }
  // 每一级够不够引擎用：每门界面语言分别数（词汇题要这门语言能做的才算）
  for (const ui of uis) for (const s of SKILLS) for (const b of BANDS) {
    const n = items.filter(it => it && it.skill === s && it.band === b && ENGINE.eligible(it, ui)).length;
    if (n < need[s]) bad.push('题不够：' + s + ' 第 ' + b + ' 级，界面语言 ' + ui + ' 能做的只有 ' + n + ' 道（至少要 ' + need[s] + ' 道）');
  }
  return bad;
}

// 读一门语言的四个文件 → { items, bad }
function read(dir, lang) {
  const items = [], bad = [];
  for (const s of SKILLS) {
    const f = path.join(dir, FILES[s] + '.json');
    let arr;
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { bad.push(lang + '/' + FILES[s] + '.json 读不了：' + e.message); continue; }
    if (!Array.isArray(arr)) { bad.push(lang + '/' + FILES[s] + '.json 不是数组'); continue; }
    arr.forEach(it => items.push(it && typeof it === 'object' ? Object.assign({}, it, { _file: FILES[s] + '.json', _skill: s }) : it));
  }
  return { items, bad };
}

// 开发用：把几道样题铺满每一级（每级每项比最少的多 2 道）
function placeholder(lang) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '_placeholder', 'seed.json'), 'utf8'));
  const items = [];
  for (const s of SKILLS) {
    const src = seed.filter(x => x.skill === s), code = { vocab: 'v', listen: 'l', read: 'r', speak: 's' }[s];
    for (const b of BANDS) for (let k = 0; k < ENGINE.NEED[s] + 2; k++) {
      // 口语：低的三级朗读，高的三级问答
      const from = s === 'speak' ? src.filter(x => x.kind === (b <= 2 ? 'read' : 'answer')) : src;
      const it = JSON.parse(JSON.stringify(from[(b + k) % from.length]));
      items.push(Object.assign(it, { id: lang + '-' + code + '-' + b + '-9' + String(k).padStart(2, '0'), band: b, tmp: true, _file: '_placeholder/seed.json' }));
    }
  }
  return items;
}

function emit(data) {
  const J = v => JSON.stringify(v);
  let out = '// 回声岛 — 能力检测题库（placement.js 用；中转服务判口语问答题时也读它）\n' +
    '// 由 tools/place/build.js 从 tools/place/<语言>/{vocab,listen,read,speak}.json 生成，改题目请改 json 再生成，不要手改这个文件。\n' +
    '(function (root) {\n  const D = {\n';
  for (const lang of Object.keys(data)) {
    const d = data[lang];
    out += '    ' + J(lang) + ': {\n      lang: ' + J(lang) + (d.tmp ? ', tmp: true' : '') + ', n: ' + d.items.length + ',\n      items: [\n' +
      d.items.map(it => '        ' + J(it) + ',').join('\n') + '\n      ],\n    },\n';
  }
  out += '  };\n  if (typeof module !== \'undefined\' && module.exports) module.exports = D;\n  else root.PLACE_DATA = D;\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
  return out;
}
const strip = it => { const o = Object.assign({}, it); delete o._file; delete o._skill; return o; };

function main(argv) {
  const dev = argv.includes('--dev'), check = argv.includes('--check');
  const data = {}, bad = [];
  if (dev) {
    const items = placeholder('en');
    bad.push(...validate('en', items));
    data.en = { tmp: true, items: items.map(strip) };
  } else {
    const langs = fs.readdirSync(__dirname, { withFileTypes: true }).filter(d => d.isDirectory() && /^[a-z]{2,3}$/.test(d.name)).map(d => d.name).sort();
    if (!langs.length) { console.error('没有题库：tools/place/<语言>/ 一个都没有。正式题库没到时先用 node tools/place/build.js --dev'); process.exit(1); }
    for (const lang of langs) {
      const r = read(path.join(__dirname, lang), lang);
      bad.push(...r.bad.map(x => x), ...validate(lang, r.items).map(x => lang + ' · ' + x));
      data[lang] = { items: r.items.map(strip) };
    }
  }
  if (bad.length) { console.error('题库有问题（什么都没写）：\n- ' + bad.slice(0, 80).join('\n- ') + (bad.length > 80 ? '\n…… 一共 ' + bad.length + ' 处' : '')); process.exit(1); }
  for (const lang of Object.keys(data)) {
    const its = data[lang].items;
    console.log(lang + (data[lang].tmp ? '（临时题库）' : '') + '：' + its.length + ' 道  ' + SKILLS.map(s => s + ' ' + BANDS.map(b => its.filter(x => x.skill === s && x.band === b).length).join('/')).join('  '));
    for (const ui of UIS) console.log('  界面语言 ' + ui + ' 能做的词汇题：' + BANDS.map(b => its.filter(x => x.skill === 'vocab' && x.band === b && ENGINE.eligible(x, ui)).length).join('/'));
  }
  if (check) { console.log('只检查，没写文件'); return; }
  fs.writeFileSync(path.join(ROOT, 'placement-data.js'), emit(data));
  console.log('写好了 placement-data.js' + (dev ? '（临时题库：正式题库到了要重新生成）' : ''));
}

module.exports = { validate, read, placeholder, emit, UIS };
if (require.main === module) main(process.argv.slice(2));
