// 收集游戏里要朗读的固定英文 → tools/voice/lines.json（给 gen.py 合成配音用）
//   闯关练习：data.js 的单词、句子、对话、岛主开场白，对话动画的台词（按角色性别）
//   剧情和岛民台词：各文件里「英文, 中文」成对写的地方（带 {rival} 这类占位符的是运行时拼的，跳过）
//   支线委托：quests.js 里委托人在对话框里说的固定台词（请求、感谢、做完以后的那一句，按委托人的性别）、旁白、委托的英文名
//   今日目击：sighting.js 的告示板线索（模板拼得出来的每一句）
//   求助的话：lessons-en.js 的 help（tools/course/WORDS.md §8）
// 用法：node tools/voice/collect.js
// 输出每句 { t: 文字, g: ['f'|'m', …], p: 来源顺序 }。p 是课程包（tools/pack/SPEC.md §2）排「先用到的在前」用的：0 最先用到；
// 不影响 key（文件名还是 t 的哈希），gen.py 不看它。顺序按下面 GROUP 的先后，同一组里按收集到的先后；一句出现在好几处时取最靠前的那处
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const { norm } = require('./key.js');

// 来源的先后（课程包 core 先装前面这些）：能力检测 → 13 个话题小镇和对话动画 → story / world / game / monsters 的固定句子 → 第一组岛 →
// 第一册课本 → 委托 → 今日目击 → 怪兽的对战句子（按手册编号）→ 其余课本 → 其余岛 → 测试里漏配的
const GROUP = { place: 0, towns: 1, core: 2, isleA: 3, book1: 4, quests: 5, sight: 6, battle: 7, books: 8, isles: 9, misses: 10 };
let grp = GROUP.towns, seq = 0;
const lines = new Map();   // 规范化文本 → { t, g: Set('f'|'m'), o: [组, 第几个] }
function add(t, gs) {
  if (typeof t !== 'string') return;
  const n = norm(t);
  if (!n || /[{}<>]|[\u4e00-\u9fff]/.test(n) || !/[A-Za-z]/.test(n)) return;
  const e = lines.get(n) || { t: n, g: new Set(), o: null };
  (gs || ['f', 'm']).forEach(g => e.g.add(g));
  const o = [grp, seq++];
  if (!e.o || o[0] < e.o[0] || (o[0] === e.o[0] && o[1] < e.o[1])) e.o = o;
  lines.set(n, e);
}

// ---------- data.js（在沙箱里执行，直接读结构） ----------
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
grp = GROUP.towns;
for (const w of ctx.window.WORLDS) {
  w.words.forEach(x => add(x[0], ['f']));
  w.sents.forEach(x => add(x[0], ['f']));
  w.dlgs.forEach(d => { add(d[0]); add(d[1]); (d[2] || []).forEach(o => add(o)); });
  if (w.boss && w.boss.hello) add(w.boss.hello);
  if (w.en) add(w.en, ['f']);
}
// 课本单元（book.js）：单元单词表、句子、对话、Boss 开场白
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'book.js'), 'utf8'), ctx);
for (const { u, bi } of ((ctx.window.BOOKS || { list: [] }).list).flatMap((b, bi) => b.units.map(u => ({ u, bi })))) {
  grp = bi === 0 ? GROUP.book1 : GROUP.books;   // 第一册（七上）先装，其余课本排在后面
  u.words.forEach(x => add(x[0], ['f']));
  u.sents.forEach(x => add(x[0], ['f']));
  u.dlgs.forEach(d => { add(d[0]); add(d[1]); (d[2] || []).forEach(o => add(o)); });
  if (u.boss && u.boss.hello) add(u.boss.hello);
}
// 支线委托（quests.js）：委托人在对话框里说的请求、感谢、做完以后的那一句（用 TA 的性别的声音）；旁白和委托的英文名（男女声都配）。
// 聊天里的话是 AI 现场说的，不在这里
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'quests.js'), 'utf8'), ctx);
grp = GROUP.quests;
for (const q of (ctx.window.QUESTS || { list: [] }).list) {
  const g = [q.g === 'f' ? 'f' : 'm'];
  q.ask.forEach(a => add(a[0], g));
  q.thanks.forEach(a => add(a[0], g));
  add(q.bye[0], g);
  if (q.note) add(q.note[0]);
  add(q.en);
}
grp = GROUP.towns;   // 对话动画和话题小镇一组
for (const s of ctx.window.SCENES || []) {
  (s.lines || []).forEach(l => { const c = s.cast[l[0]]; add(l[1], c && c[2] === 'm' ? ['m'] : c && c[2] === 'f' ? ['f'] : null); });
}
// 英语课的「🆘 求助的话」（lessons-en.js，tools/course/WORDS.md §8：由 tools/course/build.js --lessons-en 生成）：整句，女声，和话题小镇一组（零基础一开始就用到）。
// 课前讲解里句型的例句是这一课里原样有的句子，上面已经收过了
if (fs.existsSync(path.join(ROOT, 'lessons-en.js'))) {
  const lctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'lessons-en.js'), 'utf8'), lctx, { filename: 'lessons-en.js' });
  for (const h of ((lctx.window.LESSONS_EN || {}).help || [])) add(h && h.t, ['f']);
}

// monsters.js 里的辅助招式英文名和各属性对应的辅助招式
const SUP_EN = { roar: 'Big Roar', guard: 'Iron Guard', power: 'Power Up', speed: 'Speed Up', chill: 'Cold Wind', spooky: 'Spooky Face', sleep: 'Sleepy Song', poison: 'Poison Mist', para: 'Static Zap', burn: 'Hot Breath', confuse: 'Dizzy Dance', heal: 'Sweet Rest' };
const SUP_OF = { normal: 'roar', fire: 'burn', water: 'heal', grass: 'sleep', spark: 'para', ice: 'chill', fight: 'power', poison: 'poison', ground: 'guard', flying: 'speed', psychic: 'confuse', bug: 'poison', rock: 'guard', ghost: 'spooky', dragon: 'power', dark: 'spooky', steel: 'guard' };

// ---------- 战斗里拼了怪兽名字的固定句式（monsters.js）：每只怪兽 × 几种说法，全部提前合成 ----------
const dctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'dex.js'), 'utf8'), dctx);
for (const sp of dctx.window.DEX.list) {   // DEX.list 就是手册编号的顺序
  const n = sp.en;
  grp = GROUP.battle;
  add('Look out! Here comes ' + n + '!', ['f']);
  if (sp.starter) { grp = GROUP.core; add(n + ', be my partner!', ['f']); grp = GROUP.battle; }   // 选伙伴时说的（monsters.js 的 starterSheet、story.js 的 rescue）：开场就用到
  add(n + ', your turn!');                  // 我方（女声旁白）和对手训练师（男声）都会喊
  add("Let's battle! " + n + ', your turn!', ['m']);
  add(n + ', take a rest!', ['f']);
  add(n + ' is too tired to go on.', ['f']);
  add('Yes! ' + n + ' is your new friend!', ['f']);
  add(n + ' joined your team!', ['f']);
  add(n + ' did not give up!', ['f']);
  add('Look! ' + n + ' is growing up!', ['f']);
  if (sp.dexEn) add(sp.dexEn, ['f']);        // 手册里点喇叭听介绍
  // 每次出招：「Sprouty, use Vine Swing!」—— 学招表照抄 monsters.js 的 learnset（改了那边这里也要改）
  const t1 = sp.types[0], t2 = sp.types[1], alt = t1 === 'normal' ? 'fight' : 'normal';
  const ids = [t1 + ':0', alt + ':0', 's:' + SUP_OF[t1], t1 + ':1', (t2 || alt) + ':1', t1 + ':2'];
  if (t2 && SUP_OF[t2] !== SUP_OF[t1]) ids.push('s:' + SUP_OF[t2]);
  ids.push(t2 ? t2 + ':2' : 's:' + (SUP_OF[t1] === 'heal' ? 'guard' : 'heal'));
  for (const id of ids) {
    const mv = id.startsWith('s:') ? SUP_EN[id.slice(2)] : (dctx.window.DEX.MOVES[id.split(':')[0]] || [])[+id.split(':')[1]];
    if (mv) add(n + ', use ' + (Array.isArray(mv) ? mv[0] : mv) + '!', ['f']);
  }
}

// ---------- 其余脚本：「'英文', '中文'」成对出现的字符串 ----------
const PAIR = /(['"])((?:(?!\1)[^\\\n]|\\.)*)\1\s*,\s*(['"])((?:(?!\3)[^\\\n]|\\.)*[\u4e00-\u9fff](?:(?!\3)[^\\\n]|\\.)*)\3/g;
const files = ['story.js', 'world.js', 'monsters.js', 'game.js', ...fs.readdirSync(path.join(ROOT, 'isles')).filter(f => f.endsWith('.js')).map(f => 'isles/' + f)];
for (const f of files) {
  grp = !f.startsWith('isles/') ? GROUP.core : f.startsWith('isles/a-') ? GROUP.isleA : GROUP.isles;
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m;
  while ((m = PAIR.exec(s))) {
    const en = m[2].replace(/\\(['"\\])/g, '$1');
    if (/[\u4e00-\u9fff]/.test(en) || en.length < 2 || !/[a-z]/i.test(en)) continue;
    add(en);
  }
}

// ---------- 跑测试时实际播过、但没配音的句子（tools/voice/misshook.js 收集） ----------
grp = GROUP.misses;
try {
  for (const l of fs.readFileSync(path.join(__dirname, 'misses.jsonl'), 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try {
      const [t, g] = JSON.parse(l);
      if (/\b(Coco|Tom)\b|Test Field/.test(t)) continue;   // 测试里用的玩家名字，孩子的名字不一样，合成了也用不上
      add(t, g === 'm' ? ['m'] : ['f']);
    } catch (e) {}
  }
} catch (e) {}

// ---------- 运行时拼出来的固定句式：拿到 / 捡到道具（world.js）、选伙伴时问要不要它（story.js 的 starterBag） ----------
{
  grp = GROUP.core;
  const ms = fs.readFileSync(path.join(ROOT, 'monsters.js'), 'utf8');
  const itemEn = new Set();
  for (const m of ms.matchAll(/ en: '([^']+)', icon: /g)) itemEn.add(m[1]);
  const shells = ms.slice(ms.indexOf('// 回声贝：'), ms.indexOf("ITEMS['hm_' + k]"));   // 回声贝那一段：[id, 中文, 英文, 图标]
  for (const m of shells.matchAll(/\['[a-z]+', '[^']+', '([A-Za-z ]+)', '[^']+'\]/g)) itemEn.add('Echo Shell: ' + m[1]);
  Object.values(dctx.window.DEX.STONES).forEach(s => itemEn.add(s.en));
  for (const en of itemEn) {
    add('You got ' + en + '!');
    add('You found ' + (/^[aeiou]/i.test(en) ? 'an ' : 'a ') + en + '!');
    add('You found a hidden ' + en + '!', ['f']);
  }
  const TYPE_EN = { fire: 'fire', water: 'water', grass: 'grass', spark: 'electric' };
  for (const sp of dctx.window.DEX.list) if (sp.starter) add(sp.en + ' is a ' + TYPE_EN[sp.types[0]] + ' monster. Will you take it?', ['f']);
}

// ---------- 今日目击（sighting.js）：告示板上的三条英文线索，点 🔊 朗读（女声旁白） ----------
// 线索是按地图、怪兽的数据从模板拼的；EchoSight.lines() 给出模板拼得出来的每一句。家庭版、销售版的怪兽不一样，两个版本各拼一遍
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const isles = [...html.matchAll(/<script src="(isles\/[^"]+)"/g)].map(m => m[1]);
  let n = 0;
  grp = GROUP.sight;
  for (const ed of ['family', 'sales']) {
    const sctx = { window: { ECHO_EDITION: ed }, console, setTimeout, clearTimeout };
    vm.createContext(sctx);
    for (const f of ['dex.js', 'maps.js', 'people.js', 'story.js', ...isles, 'sighting.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sctx, { filename: f });
    for (const t of sctx.window.EchoSight.lines()) { add(t, ['f']); n++; }
  }
  if (!n) throw new Error('今日目击的线索一句都没拼出来（sighting.js 的 lines()）');
}

// ---------- 能力检测的题库（placement-data.js，tools/place/build.js 生成）：听力题的每一句（按说话人的性别）、「听一听选意思」的单词（女声） ----------
// 检测里这些声音走游戏平常的 say()，要提前配好（题目是固定的）。现在的配音模型只会英语：别的语言的题库到时候要另外找合成的办法
{
  const f = path.join(ROOT, 'placement-data.js');
  let n = 0;
  grp = GROUP.place;
  if (fs.existsSync(f)) {
    const D = require(f);
    if (D.en && D.en.tmp) console.log('placement: 现在是临时题库（--dev），正式题库生成以后要重新跑 collect');
    for (const it of (D.en ? D.en.items : [])) {
      if (it.skill === 'listen') for (const a of it.audio || []) { add(a.text, [a.g === 'm' ? 'm' : 'f']); n++; }
      else if (it.skill === 'vocab' && it.mode === 'listen') { add(it.word, ['f']); n++; }
    }
  }
  console.log('placement lines', n);
}

// ---------- 不合成「不能出现的词」（tools/banned-terms.txt）：老的漏配音记录里可能还有改名以前的句子 ----------
{
  const T = require('../check-banned.js').terms();
  let n = 0;
  for (const [k, e] of lines) if (T.some(t => (t.s ? e.t.includes(t.s) : t.re.test(e.t)))) { lines.delete(k); n++; }
  if (n) console.log('skip banned', n);
}

// 来源顺序 p：按 [组, 第几个] 排好以后的名次（0 起，连着的）
const rank = new Map([...lines.values()].sort((a, b) => a.o[0] - b.o[0] || a.o[1] - b.o[1]).map((e, i) => [e.t, i]));
const out = [...lines.values()].map(e => ({ t: e.t, g: [...e.g].sort(), p: rank.get(e.t) })).sort((a, b) => a.t.localeCompare(b.t));
fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(out, null, 0));
const chars = out.reduce((s, e) => s + e.t.length * e.g.length, 0);
console.log('lines', out.length, 'clips', out.reduce((s, e) => s + e.g.length, 0), 'chars', chars);
