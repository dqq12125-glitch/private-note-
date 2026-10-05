// 收集游戏里要朗读的固定英文 → tools/voice/lines.json（给 gen.py 合成配音用）
//   闯关练习：data.js 的单词、句子、对话、岛主开场白，对话动画的台词（按角色性别）
//   剧情和岛民台词：各文件里「英文, 中文」成对写的地方（带 {rival} 这类占位符的是运行时拼的，跳过）
// 用法：node tools/voice/collect.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const { norm } = require('./key.js');

const lines = new Map();   // 规范化文本 → { t, g: Set('f'|'m') }
function add(t, gs) {
  if (typeof t !== 'string') return;
  const n = norm(t);
  if (!n || /[{}<>]|[\u4e00-\u9fff]/.test(n) || !/[A-Za-z]/.test(n)) return;
  const e = lines.get(n) || { t: n, g: new Set() };
  (gs || ['f', 'm']).forEach(g => e.g.add(g));
  lines.set(n, e);
}

// ---------- data.js（在沙箱里执行，直接读结构） ----------
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), ctx);
for (const w of ctx.window.WORLDS) {
  w.words.forEach(x => add(x[0], ['f']));
  w.sents.forEach(x => add(x[0], ['f']));
  w.dlgs.forEach(d => { add(d[0]); add(d[1]); (d[2] || []).forEach(o => add(o)); });
  if (w.boss && w.boss.hello) add(w.boss.hello);
  if (w.en) add(w.en, ['f']);
}
for (const s of ctx.window.SCENES || []) {
  (s.lines || []).forEach(l => { const c = s.cast[l[0]]; add(l[1], c && c[2] === 'm' ? ['m'] : c && c[2] === 'f' ? ['f'] : null); });
}

// monsters.js 里的辅助招式英文名和各属性对应的辅助招式
const SUP_EN = { roar: 'Big Roar', guard: 'Iron Guard', power: 'Power Up', speed: 'Speed Up', chill: 'Cold Wind', spooky: 'Spooky Face', sleep: 'Sleepy Song', poison: 'Poison Mist', para: 'Static Zap', burn: 'Hot Breath', confuse: 'Dizzy Dance', heal: 'Sweet Rest' };
const SUP_OF = { normal: 'roar', fire: 'burn', water: 'heal', grass: 'sleep', spark: 'para', ice: 'chill', fight: 'power', poison: 'poison', ground: 'guard', flying: 'speed', psychic: 'confuse', bug: 'poison', rock: 'guard', ghost: 'spooky', dragon: 'power', dark: 'spooky', steel: 'guard' };

// ---------- 战斗里拼了怪兽名字的固定句式（monsters.js）：386 只 × 几种说法，全部提前合成 ----------
const dctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'dex.js'), 'utf8'), dctx);
for (const sp of dctx.window.DEX.list) {
  const n = sp.en;
  add('A wild ' + n + ' appeared!', ['f']);
  add(n + ', I choose you!', ['f']);
  add('Go, ' + n + '!');                    // 我方（女声旁白）和对手训练师（男声）都会喊
  add(n + ', come back!', ['f']);
  add(n + ' fainted!', ['f']);
  add('Gotcha! ' + n + ' was caught!', ['f']);
  add(n + ' joined your team!', ['f']);
  add(n + ' held on for you!', ['f']);
  if (sp.dexEn) add(sp.dexEn, ['f']);        // 图鉴里点喇叭听介绍
  // 每次出招：「Sprouty, use Vine Lash!」—— 学招表照抄 monsters.js 的 learnset（改了那边这里也要改）
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
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  let m;
  while ((m = PAIR.exec(s))) {
    const en = m[2].replace(/\\(['"\\])/g, '$1');
    if (/[\u4e00-\u9fff]/.test(en) || en.length < 2 || !/[a-z]/i.test(en)) continue;
    add(en);
  }
}

// ---------- 跑测试时实际播过、但没配音的句子（tools/voice/misshook.js 收集） ----------
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

const out = [...lines.values()].map(e => ({ t: e.t, g: [...e.g].sort() })).sort((a, b) => a.t.localeCompare(b.t));
fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(out, null, 0));
const chars = out.reduce((s, e) => s + e.t.length * e.g.length, 0);
console.log('lines', out.length, 'clips', out.reduce((s, e) => s + e.g.length, 0), 'chars', chars);
