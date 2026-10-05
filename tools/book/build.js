// 把课本同步的内容（tools/book/hj7a.json）生成 book.js 和 talk-npcs.js 里的单元聊天角色。
// 用法：node tools/book/build.js
// hj7a.json 的来源：单词和短语 = 课本书后「Words and phrases in each unit」（pp.145–150）；句子、对话、Boss、聊天角色是按单元话题和语法新写的（子代理写 + 两轮审校），不抄课文。
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'hj7a.json'), 'utf8'));
const J = v => JSON.stringify(v);
const arr = (rows, ind) => rows.map(r => ind + J(r) + ',').join('\n');
let out = '// 回声岛 — 课本同步：' + B.name + '（' + B.press + '）\n' +
  '// 由 tools/book/build.js 从 tools/book/hj7a.json 生成，改内容请改 json 再生成。\n' +
  '// 单词和短语 = 课本书后的单元词汇表；句子和对话按单元话题、语法新编（不抄课文）。格式和 data.js 的岛一样：\n' +
  '// words: [英文, 中文, 图]，sents: [英文, 中文]，dlgs: [对方说, 正确回答, [干扰项, 干扰项]]\n' +
  'window.BOOK = {\n  id: ' + J(B.id) + ', name: ' + J(B.name) + ', short: ' + J(B.short) + ',\n  units: [\n';
for (const u of B.units) {
  out += '    {\n      n: ' + u.n + ', name: ' + J('Unit ' + u.n + ' ' + u.zh) + ', en: ' + J(u.en) + ', zh: ' + J(u.zh) + ', icon: ' + J(u.icon) + ', color: ' + J(u.color) + ',\n' +
    '      key: ' + J(u.key) + ',\n' +
    '      grammar: ' + J(u.grammar) + ',\n' +
    '      boss: ' + J(u.boss) + ',\n' +
    '      words: [\n' + arr(u.words, '        ') + '\n      ],\n' +
    '      sents: [\n' + arr(u.sents, '        ') + '\n      ],\n' +
    '      dlgs: [\n' + arr(u.dlgs, '        ') + '\n      ],\n    },\n';
}
out += '  ],\n};\n';
fs.writeFileSync(path.join(ROOT, 'book.js'), out);
// 单元聊天角色：写进 talk-npcs.js 里 BEGIN/END 标记之间（游戏和中转服务共用那份文件）
const npcs = B.units.map(u => {
  const t = u.talk;
  return '    ' + J({ id: B.id + '-u' + u.n, unit: u.n, book: B.short, name: t.name, zh: t.zh, look: t.look, voice: t.voice, voiceZh: t.voiceZh, topic: t.topic, topicZh: t.topicZh, goal: t.goal, goalZh: t.goalZh, persona: t.persona, opener: t.opener, words: t.words }) + ',';
}).join('\n');
const tp = path.join(ROOT, 'talk-npcs.js');
let tn = fs.readFileSync(tp, 'utf8');
const a = '    // BEGIN book units', b = '    // END book units';
if (!tn.includes(a)) throw new Error('talk-npcs.js 里没有 BEGIN/END 标记');
tn = tn.slice(0, tn.indexOf('\n', tn.indexOf(a)) + 1) + npcs + '\n' + tn.slice(tn.indexOf(b));
fs.writeFileSync(tp, tn);
console.log('book.js:', B.units.length, 'units,', B.units.reduce((s, u) => s + u.words.length, 0), 'words,', B.units.reduce((s, u) => s + u.sents.length + u.dlgs.length, 0), 'sentences/dialogues; talk npcs', B.units.length);
