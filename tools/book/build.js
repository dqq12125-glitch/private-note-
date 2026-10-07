// 把课本同步的内容（tools/book/<册>.json）生成 book.js 和 talk-npcs.js 里的单元聊天角色。
// 用法：node tools/book/build.js
// 每册 json 的来源：单词和短语 = 课本书后「Words and phrases in each unit」（扫描页逐条转写、两人独立转写再核对）；
// 句子、对话、Boss、聊天角色是按单元话题和语法新写的（子代理写 + 两轮审校），不抄课文。
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
// 整套初中：按年级、学期排好（顺序不能改，存档里按这个顺序编号）。START = 弟弟上初一那年（秋季学期是七上）
const START = 2026;
const SERIES = ['hj7a', 'hj7b', 'hj8a', 'hj8b', 'hj9a', 'hj9b'];
const J = v => JSON.stringify(v);
const arr = (rows, ind) => rows.map(r => ind + J(r) + ',').join('\n');
const books = SERIES.filter(id => fs.existsSync(path.join(__dirname, id + '.json'))).map(id => JSON.parse(fs.readFileSync(path.join(__dirname, id + '.json'), 'utf8')));
let out = '// 回声岛 — 课本同步：沪教版（上海教育出版社）初中英语，七年级上册到九年级下册\n' +
  '// 由 tools/book/build.js 从 tools/book/<册>.json 生成，改内容请改 json 再生成。\n' +
  '// 单词和短语 = 课本书后的单元词汇表；句子和对话按单元话题、语法新编（不抄课文）。格式和 data.js 的岛一样：\n' +
  '// words: [英文, 中文, 图]，sents: [英文, 中文]，dlgs: [对方说, 正确回答, [干扰项, 干扰项]]\n' +
  'window.BOOKS = {\n  start: ' + START + ',   // 七上是哪年秋季学期（按日期猜孩子现在学到哪）\n  list: [\n';
for (const B of books) {
  out += '  {\n    id: ' + J(B.id) + ', name: ' + J(B.name) + ', short: ' + J(B.short) + ', press: ' + J(B.press) + (B.old ? ', old: true' : '') + ',\n    units: [\n';
  for (const u of B.units) {
    out += '      {\n        n: ' + u.n + ', name: ' + J(B.short + ' Unit ' + u.n + ' ' + u.zh) + ', en: ' + J(u.en) + ', zh: ' + J(u.zh) + ', icon: ' + J(u.icon) + ', color: ' + J(u.color) + ',\n' +
      '        key: ' + J(u.key) + ',\n' +
      '        grammar: ' + J(u.grammar) + ',\n' +
      '        boss: ' + J(u.boss) + ',\n' +
      '        words: [\n' + arr(u.words, '          ') + '\n        ],\n' +
      '        sents: [\n' + arr(u.sents, '          ') + '\n        ],\n' +
      '        dlgs: [\n' + arr(u.dlgs, '          ') + '\n        ],\n      },\n';
  }
  out += '    ],\n  },\n';
}
out += '  ],\n};\n';
fs.writeFileSync(path.join(ROOT, 'book.js'), out);

// 单元聊天角色：写进 talk-npcs.js 里 BEGIN/END 标记之间（游戏和中转服务、APK 直连共用那份文件）
// 聊天目标（家长 2026-10-07：目标拆成小步骤实时打勾、每个单元 3 个目标轮换、目标词带中文）在 tools/book/talk-goals.json，按角色 id：
//   { wordsZh: [和 words 一一对应的中文], steps: [[中文, 示范英文], …]（单元 json 里那个目标 = 「挑战」）,
//     more: [简单, 中等]（每个 { goal, goalZh, opener, steps }） }
// 生成的 goals = [简单, 中等, 挑战]，挑战那个只有 steps（目标、开场白用角色本身的 goal / goalZh / opener）
const TGF = path.join(__dirname, 'talk-goals.json');
const TG = fs.existsSync(TGF) ? JSON.parse(fs.readFileSync(TGF, 'utf8')) : {};
const bad = [];
const okSteps = (id, s) => {
  if (!Array.isArray(s) || s.length < 2 || s.length > 4 || s.some(x => !Array.isArray(x) || x.length !== 2 || !x[0] || !x[1])) bad.push(id + ' 的 steps 要 2–4 步，每步 [中文, 示范英文]');
};
const npcs = books.flatMap(B => B.units.map(u => {
  const t = u.talk, id = B.id + '-u' + u.n, x = TG[id];
  const o = { id, book: B.id, bookShort: B.short, unit: u.n, name: t.name, zh: t.zh, look: t.look, voice: t.voice, voiceZh: t.voiceZh, topic: t.topic, topicZh: t.topicZh, goal: t.goal, goalZh: t.goalZh, persona: t.persona, opener: t.opener, words: t.words };
  if (x) {
    if (!Array.isArray(x.wordsZh) || x.wordsZh.length !== t.words.length) bad.push(id + ' 的 wordsZh 要和 words 一样多（' + t.words.length + ' 个）');
    okSteps(id, x.steps);
    (x.more || []).forEach((g, k) => { if (!g.goal || !g.goalZh || !g.opener) bad.push(id + ' 的 more[' + k + '] 缺 goal / goalZh / opener'); okSteps(id + ' more[' + k + ']', g.steps); });
    o.wordsZh = x.wordsZh;
    o.goals = (x.more || []).map(g => ({ goal: g.goal, goalZh: g.goalZh, opener: g.opener, steps: g.steps })).concat([{ steps: x.steps }]);
  } else bad.push(id + ' 在 talk-goals.json 里没有聊天目标');
  return '    ' + J(o) + ',';
})).join('\n');
for (const k of Object.keys(TG)) if (!books.some(B => B.units.some(u => B.id + '-u' + u.n === k))) bad.push('talk-goals.json 里的 ' + k + ' 不是任何单元');
if (bad.length) { console.error('聊天目标有问题：\n- ' + bad.join('\n- ')); process.exit(1); }
const tp = path.join(ROOT, 'talk-npcs.js');
let tn = fs.readFileSync(tp, 'utf8');
const a = '    // BEGIN book units', b = '    // END book units';
if (!tn.includes(a) || !tn.includes(b)) throw new Error('talk-npcs.js 里没有 BEGIN/END 标记');
tn = tn.slice(0, tn.indexOf('\n', tn.indexOf(a)) + 1) + npcs + '\n' + tn.slice(tn.indexOf(b));
fs.writeFileSync(tp, tn);
const U = books.flatMap(B => B.units);
console.log('book.js:', books.map(B => B.short + ' ' + B.units.length).join(' / '), '·', U.reduce((s, u) => s + u.words.length, 0), 'words ·', U.reduce((s, u) => s + u.sents.length + u.dlgs.length, 0), 'sentences/dialogues · talk npcs', U.length);
