// 回声岛 · 造一份「玩了很久」的存档，量它有多大（存档会不会把 localStorage 撑满、存一次要多久，都靠它）
// 存档的样子照着真的来：game.js 的 fresh()、MonsterGame.fresh()、EchoWorld.fresh()、talk.js 的 S.talk；
// 题目编号、怪兽、岛民都从 data.js / book.js / dex.js / talk-npcs.js 里读真的（编号不对的复习条目游戏一打开就会删掉）。
// 这里造的是「游戏不做任何整理」时的样子（掌握了的聊天句子全留着）。游戏读进来以后会把掌握了的聊天句子理到 200 条（game.js 的 revTrim），
// 所以真正存回去的比这里小：1 年约 34 万字、3 年约 97 万字（tools/perf/saveperf.js 打印的就是读进来以后的）。
// 用法：
//   node tools/perf/bigsave.js                 打印「玩了 1 年」「玩了 3 年」两份存档每一部分多少字、加上备份占 localStorage 配额的多少
//   node tools/perf/bigsave.js --out <目录>     另外把两份存档写成 bigsave-1y.json / bigsave-3y.json
// 别的脚本里：const BS = require('./bigsave'); BS.build(3) → 存档对象；BS.sizes(存档) → 每部分多少字；BS.tiny(gfx) → 很小的对照存档
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const QUOTA = 5 * 1024 * 1024;   // Chromium 给每个网站的 localStorage：键 + 值一共约 5 MiB 个字（UTF-16 一个字算一个）

// 真的题库、怪兽、岛民（放在一个假的 window 里跑一遍数据文件）
let DATA = null;
function data() {
  if (DATA) return DATA;
  const w = {}; w.window = w; w.localStorage = { getItem: () => null }; w.location = { search: '' }; w.console = console;
  vm.createContext(w);
  for (const f of ['data.js', 'book.js', 'dex.js', 'talk-npcs.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), w, { filename: f });
  const W = w.WORLDS, BK = w.BOOKS.list.flatMap(b => b.units);
  return (DATA = { W, BK, WX: W.concat(BK), NB: W.length, DEX: w.DEX, NPCS: w.TALK_NPCS.list });
}

// 固定的随机数（每次造出来一样大）
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const NICKS = ['Kiki', 'Momo', 'Coco', 'Lulu', 'Bobo', 'Nana', 'Toto', 'Pipi', 'Dodo', 'Fifi', 'Sunny', 'Lucky', 'Cookie', 'Peanut', 'Shadow', 'Thunder', 'Snowball', 'Pudding', 'Captain', 'Princess'];

// 很小的对照存档（和 profile.js 用的一样）
const tiny = gfx => ({
  seenIntro: true, coins: 500, micCheck: 1, settings: { tts: 'online', mode: 'self', gfx: gfx || 'high', sfx: false, gate: false, music: 'off' }, player: { gender: 'girl', name: 'Amy' },
  mon: { v: 2, box: [{ uid: 'm1', sp: 'emberpup', lv: 30, xp: 0 }, { uid: 'm2', sp: 'tidalfin', lv: 30, xp: 0 }], team: ['m1', 'm2'], dex: { emberpup: 'caught' }, balls: 10, potions: 10, bag: {}, badges: {} },
  world: { v: 3, started: true, map: 't0', x: 8, y: 22, dir: 'up', visited: { 0: 1 }, flags: Object.assign({ 's:intro': 1, 's:mom': 1, 's:starter': 1, 's:rival1': 1, 's:expshare': 1 }, Object.fromEntries([...Array(13).keys()].map(i => ['s:ch' + i, 1]))), daily: {} },
});

// years = 1 或 3。opt.gfx 画质；opt.today 当成今天的日期（默认真的今天）
function build(years, opt) {
  opt = opt || {};
  const D = data(), R = rng(years * 7919 + 17), rnd = n => Math.floor(R() * n), pick = a => a[rnd(a.length)];
  const big = years >= 3, today = opt.today ? new Date(opt.today) : new Date(), T = dayStr(today), days = Math.round(years * 365);
  const ago = n => dayStr(addDays(today, -n));

  // ---- 闯关：学过的单元每关都有星星 ----
  const unitsDone = big ? D.BK.length : 16;           // 一年：七上 + 七下；三年：全部 46 个单元
  const stars = {};
  for (let w = 0; w < D.NB + unitsDone; w++) for (let l = 0; l < 7; l++) stars[w + '-' + l] = 1 + rnd(3);
  const scenes = {}; for (let w = 0; w < D.NB; w++) scenes[w] = { watched: 1, shadow: 1, role: 1 };

  // ---- 每日复习 S.rev ----
  // 有编号的题（单词 / 句子 / 对话）一共只有 3179 条；AI 聊天里改过的句子（free）没有上限，掌握了也不删
  const items = {}, keyed = [];
  for (let w = 0; w < D.NB + unitsDone; w++) {
    const u = D.WX[w];
    for (const [k, L] of [['word', u.words], ['sent', u.sents], ['dlg', u.dlgs]]) for (let i = 0; i < L.length; i++) if (w >= D.NB || R() < (big ? 1 : .75)) keyed.push([k, w, i]);
  }
  // 聊天里改过的句子：从课本的句子、对话里拿真句子（不超过 14 个词），「原话」是少一个词的说法
  const pool = [];
  D.WX.forEach(u => { u.sents.forEach(s => pool.push([s[0], s[1]])); u.dlgs.forEach(d => { pool.push([d[0], '']); pool.push([d[1], '']); (d[2] || []).forEach(x => pool.push([x, ''])); }); });
  const zhs = pool.filter(p => p[1]).map(p => p[1]);
  const uniq = new Map();
  for (const [en, zh] of pool) { const k = 'free:' + String(en).toLowerCase().replace(/[^a-z' ]/g, '').trim(); if (en.split(/\s+/).length <= 14 && en.split(/\s+/).length >= 3 && !uniq.has(k)) uniq.set(k, [en, zh || zhs[uniq.size % zhs.length]]); }
  let frees = [...uniq.entries()];
  // 不够就拼几个变化（真孩子三年里的句子比课本多）
  const pre = ['I think ', 'Maybe ', 'Yes, ', 'Well, ', 'Oh, '];
  for (let k = 0; frees.length < (big ? 2400 : 600) && k < 20000; k++) {
    const [key, [en, zh]] = frees[k % uniq.size], p = pre[Math.floor(k / uniq.size) % pre.length], e2 = p + en[0].toLowerCase() + en.slice(1);
    if (e2.split(/\s+/).length > 14) continue;
    const k2 = 'free:' + e2.toLowerCase().replace(/[^a-z' ]/g, '').trim(); if (k2 === key || uniq.has(k2)) continue;
    uniq.set(k2, [e2, zh]); frees.push([k2, [e2, zh]]);
  }
  frees = frees.slice(0, big ? 2400 : 600);
  // 没掌握的条数：三年的顶到上限 REV_MAX = 3000（有编号的 1500 + 聊天的 1500），其余都掌握了；一年的 700 条没掌握
  const GAP = [0, 1, 2, 4, 7, 15, 30];
  const openKeyed = big ? 1500 : 500, openFree = big ? 1500 : 200;
  const state = (e, open, born) => {
    e.c = ago(Math.min(days, born)); e.x = rnd(4);
    if (open) { e.b = rnd(GAP.length); const dueIn = rnd(40) < 1 ? -rnd(3) : 1 + rnd(GAP[e.b] || 1); e.due = dayStr(addDays(today, dueIn)); if (e.b) e.seen = ago(rnd(20)); }
    else { e.b = GAP.length; e.due = ''; e.seen = ago(rnd(Math.max(1, born))); }
    return e;
  };
  keyed.forEach(([k, w, i], n) => { items[k + ':' + w + ':' + i] = state({ k, w, i }, n >= keyed.length - openKeyed, Math.round(days * (1 - n / keyed.length)) + 1); });
  frees.forEach(([key, [en, zh]], n) => {
    const ws = en.split(' '), said = ws.length > 3 ? ws.filter((_, j) => j !== 1 + (n % (ws.length - 2))).join(' ') : '';
    const e = state({ k: 'free', en, zh, src: 'chat' }, n >= frees.length - openFree, Math.round(days * (1 - n / frees.length)) + 1);
    if (said && n % 5) e.said = said;
    items[key] = e;
  });
  const rev = { items, v: 1, day: { d: T, n: 3, f: 5 } };

  // ---- 每天的学习记录（留 45 天）和每周一行（永久）----
  const log = {};
  for (let d = 44; d >= 0; d--) {
    log[ago(d)] = { min: 62.5, learn: 24.25, play: 35.5, revSess: 1, review: 18, spoken: 31, levels: 3, pract: 1, wrongs: 6, fresh: 8, revField: 7, recall: 5, aided: 4, gateOpen: 1, chats: 2, chatGoals: 1, chatConn: 1,
      voiceLines: 9, voiceWords: 61, voiceMax: 11, voiceBest: 'I went to the park with my friend yesterday', typedLines: 1, sayN: 22, saySum: 131, spkQ: 25, spk1: 19, weekN: 6, weekOk: 5, zhTaps: 3,
      asrN: 48, asrSec: 171.5, tipN: 6, aiTextIn: 5210, aiTextOut: 1240, aiChatIn: 20110, aiChatOut: 8820, aiChatAudioIn: 14200, aiChatAudioOut: 7600, aiFail: 1, warn5: 1, stopped: 'limit' };
  }
  const weekly = [], mon0 = addDays(today, -((today.getDay() + 6) % 7));
  for (let k = Math.round(days / 7); k >= 1; k--) weekly.push({ w: dayStr(addDays(mon0, -7 * k)), d: 5 + rnd(3), l: 150 + rnd(60), p: 200 + rnd(120), lv: 12 + rnd(9), s: 180 + rnd(90), r: 100 + rnd(40), rc: 20 + rnd(30), a: 15 + rnd(20), v: 50 + rnd(30), g: 4 + rnd(4), wpl: 5 + rnd(30) / 10, f1: 60 + rnd(30), wk: 60 + rnd(35), pass: rnd(2), off: 0, y: +(1 + R() * 2).toFixed(2), fin: 1, m: 20 * (Math.round(days / 7) - k) });

  // ---- 怪兽：队伍 6 只 + 箱子（三年：10 个箱子 × 24 只全满，都起了名字）----
  const species = D.DEX.list.filter(s => !s.legend), nBox = big ? 240 : 110, box = [], team = [];
  for (let n = 0; n < 6 + nBox; n++) {
    const sp = species[(n * 7) % species.length], m = { uid: 'm' + (1e9 + n * 7919).toString(36) + rnd(46656).toString(36), sp: sp.id, lv: n < 6 ? 60 + rnd(30) : 5 + rnd(60), xp: rnd(900), hp: null, st: null, fr: 70 + rnd(180) };
    if (n < 6) team.push(m.uid); else m.bx = Math.floor((n - 6) / 24);
    if (big || n % 2 === 0) m.nick = NICKS[n % NICKS.length];
    if (n % 37 === 5) m.shiny = true;
    box.push(m);
  }
  const dex = {}; D.DEX.list.forEach((s, i) => { if (big || i < 200) dex[s.id] = big || i % 3 ? 'caught' : 'seen'; });
  const nb = big ? 13 : 5, badges = {}; for (let z = 0; z < nb; z++) badges[z] = 1;
  const bag = {}; ['superball', 'goldball', 'superpotion', 'revive', 'repel', 'rope', 'bike', 'leafstone', 'firestone', 'waterstone', 'thunderstone', 'moonstone', 'sunstone', 'icestone', 'hm_cut', 'hm_flash', 'hm_smash', 'hm_surf', 'hm_fly', 'hm_strength', 'hm_dive', 'hm_falls', 'expshare', 'dowser', 'shinycharm', 'egg_ticket'].forEach((k, i) => { if (big || i < 12) bag[k] = 1 + rnd(20); });
  const mon = { v: 2, box, team, dex, badges, balls: 40, potions: 25, bag, wins: big ? 2600 : 700, caught: big ? 420 : 130, evolved: big ? 90 : 25, walk: big ? 610000 : 180000, pcBox: 3, pcSort: 'lv',
    shinyDex: { emberpup: 1, tidalfin: 1, bookworm: 1 }, expShareOn: true, day: { mons: [], steps: 0 }, talked: T };

  // ---- 大地图：剧情旗标（剧情、训练师、捡过的东西、藏着的东西、机关门、别人送的）----
  const flags = {}, nf = big ? 600 : 260;
  ['intro', 'mom', 'starter', 'rival1', 'expshare'].forEach(k => { flags['s:' + k] = 1; });
  for (let z = 0; z < 13; z++) flags['s:ch' + z] = 1;
  // 四只学习里程碑的神兽都收服过了（不然一进大地图博士就打电话来，量不了走路）
  ['book', 'chat', 'streak', 'recall'].forEach(k => { flags['s:ml:' + k] = 1; flags['s:mlseen:' + k] = 1; });
  ['wishstar', 'skyecho', 'timesprout', 'lullaby'].forEach(k => { flags['s:leg:' + k] = 1; });
  for (let n = 0; Object.keys(flags).length < nf; n++) {
    const z = n % 13, a = n % 6;
    flags[a === 0 ? 's:q' + z + '_' + n : a === 1 ? 't:r' + z + ':' + n : a === 2 ? 'p:r' + z + ':' + (n % 40) + ':' + (n % 31) : a === 3 ? 'h:c' + z + ':' + (n % 37) + ':' + (n % 29) : a === 4 ? 'g:t' + z + ':' + n : 'gate:i' + z + 'G:' + n] = 1;
  }
  const daily = {}; for (let n = 0; n < (big ? 120 : 50); n++) daily[(n % 3 ? 'q:t' : 'rm') + (n % 13) + ':' + n] = n % 4 ? ago(1 + rnd(30)) : T;
  const visited = {}; for (let z = 0; z < nb + 1 && z < 13; z++) visited[z] = 1;
  const world = { v: 3, started: true, introDone: true, map: 't0', z: 0, x: 8, y: 22, dir: 'up', arrive: null, visited, flags, daily, center: { map: 'i0C' }, repel: 0, lastOut: { map: 't0', x: 8, y: 22, dir: 'up' },
    mile: { upto: T, talk: big ? 640 : 180, recall: big ? 2100 : 500, streak: big ? 210 : 60 } };

  // ---- 和岛民聊天：记录（最近 30 段 + 有安全标记没看过的 10 段）、岛民记得的事（40 个）、每个岛民聊过几次 ----
  const lines = pool.map(p => p[0]), npcs = D.NPCS, talkLog = [], nLog = big ? 40 : 30, nTurn = big ? 28 : 16;
  for (let n = 0; n < nLog; n++) {
    const npc = npcs[n % npcs.length], turns = [];
    for (let k = 0; k < nTurn; k++) turns.push(k % 2 ? { who: 'you', text: pick(lines) } : { who: 'npc', text: pick(lines) + ' ' + pick(lines) + (big ? ' ' + pick(lines) : '') });
    const f = frees[(n * 13) % frees.length][1];
    const rec = { t: today.getTime() - n * 43200e3, npc: npc.id, g: n % 3, turns, sec: 200 + rnd(160), voice: nTurn / 2, goal: 1, coins: 25, taught: 1,
      eval: { done: true, stars: 3, praise: '说得很完整，还用了过去时！', tips: [{ said: f[0].split(' ').slice(1).join(' '), better: f[0], zh: f[1] }, { said: pick(lines).toLowerCase(), better: pick(lines), zh: pick(zhs) }], steps: [true, true, true, false], memory: ['likes playing basketball after school', 'has a fire monster called Kiki', 'wants to visit the snow island'], concern: false, concernWhy: '', voice: nTurn / 2, ai: true } };
    if (n >= 30) { rec.concern = 1; rec.why = '孩子说到了难过或不安全的事'; }
    talkLog.push(rec);
  }
  const mem = {}, done = {}, cnt = {};
  npcs.forEach((p, i) => { if (big || i < 24) { done[p.id] = 1 + (i % 3); cnt[p.id] = 2 + rnd(big ? 30 : 8); } });
  for (let n = 0; n < (big ? 40 : 20); n++) mem[n < npcs.length && n % 4 ? npcs[n].id : 'p-' + NICKS[n % NICKS.length] + n] = { facts: ['likes playing basketball after school with friends', 'has a fire monster called Kiki and a water monster', 'wants to visit the snow island next week'], better: frees[n][1][0], t: today.getTime() - n * 864e5 };
  const seen = { d: T, h: [] }; for (let n = 0; n < (big ? 80 : 30); n++) seen.h.push(pick(lines).toLowerCase().replace(/[^a-z ]/g, '').slice(0, 60));
  const talk = { log: talkLog, done, days: { ['mom:' + T]: 1, ['kai:' + T]: 1 }, mem, n: cnt, seen };

  // ---- 其他 ----
  const ACH = ['first', 'lv10', 'lv50', 'boss1', 'boss5', 'allboss', 'c10', 'flaw', 'sp50', 'sp300', 'pf30', 'st3', 'st7', 'st30', 'three10', 'world', 'rv20', 'pets3', 'rich', 'actor', 'catch1', 'dex8', 'dexall', 'evo1', 'badge5', 'badgeall'];
  const ach = {}; ACH.forEach((id, i) => { if (big || i % 4) ach[id] = today.getTime() - (days - i * 9) * 864e5; });
  return {
    v: 1, xp: big ? 260000 : 70000, coins: big ? 5400 : 1300, stars, streak: big ? 46 : 21, lastDay: T, freeze: 2,
    quests: { day: T, list: [{ id: 'lv2', n: 1 }, { id: 'sp10', n: 6 }, { id: 'tk1', n: 0 }], chest: false }, wrong: {},
    pets: ['🐣', '🐱', '🐶', '🐰', '🐸', '🦊', '🐼', '🐧', '🦉', '🐬', '🦄', '🐲', '🦖', '🦋', '🐙'].slice(0, big ? 15 : 6), pet: '🐱', ach,
    stats: { levels: big ? 1900 : 600, spoken: big ? 31000 : 9000, perfect: big ? 9000 : 2500, maxCombo: 30, listen: big ? 24000 : 7000, reviewed: big ? 21000 : 6000, threeStars: big ? 300 : 90, bosses: big ? 59 : 20, flawless: big ? 240 : 60, roleplay: 13 }, scenes,
    settings: { rate: 0.9, voice: '', mode: 'self', tts: 'online', sfx: false, unlockAll: false, gfx: opt.gfx || 'high', gfxAuto: '', ctl: 'joy', orient: 'portrait', gate: false, music: 'off',
      limit: { on: false, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 }, push: '', pinLock: { n: 0, until: 0, lockouts: 1 }, verUrl: '', family: null, storyZh: 'auto' },
    seenIntro: true, micCheck: ago(days), upd: {}, log, weekly, push: { sent: ago(1) }, homeTab: 'mon', mon, world,
    player: { gender: 'girl', name: 'Amy' }, talk, book: { at: Math.min(unitsDone, D.BK.length) - 1, mix: .6, view: 'book', vb: '' }, rev, maxDay: T,
  };
}

// 每一部分多少字（JSON 以后）；total 是整份存档
function sizes(save) {
  const out = {};
  for (const k of Object.keys(save)) out[k] = JSON.stringify(save[k]).length + k.length + 4;
  const sub = (name, o) => { for (const k of Object.keys(o || {})) out[name + '.' + k] = JSON.stringify(o[k]).length; };
  sub('rev', save.rev); sub('talk', save.talk); sub('mon', save.mon); sub('world', save.world);
  if (save.rev && save.rev.items) {
    const it = Object.entries(save.rev.items), len = f => it.filter(f).reduce((s, [k, e]) => s + k.length + JSON.stringify(e).length + 4, 0), n = f => it.filter(f).length;
    out['rev.items 有编号的题'] = len(([, e]) => e.k !== 'free'); out['rev.items 聊天句子（没上限）'] = len(([, e]) => e.k === 'free');
    out['#rev 条数'] = it.length; out['#rev 没掌握'] = n(([, e]) => !!e.due); out['#rev 聊天句子'] = n(([, e]) => e.k === 'free');
  }
  out.total = JSON.stringify(save).length;
  return out;
}

module.exports = { build, sizes, tiny, data, QUOTA };

if (require.main === module) {
  const argv = process.argv.slice(2), oi = argv.indexOf('--out'), outDir = oi >= 0 ? argv[oi + 1] : '';
  const a = build(1), b = build(3), sa = sizes(a), sb = sizes(b), f = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const top = Object.keys(sb).filter(k => !k.includes('.') && !k.startsWith('#') && k !== 'total').sort((x, y) => sb[y] - sb[x]);
  console.log('== 存档每一部分多少字（JSON 以后的字数）==\n' + '部分'.padEnd(34) + '玩了 1 年'.padStart(12) + '玩了 3 年'.padStart(12));
  const row = (k, pad) => console.log(('  ' + (pad || '') + k).padEnd(36) + f(sa[k] || 0).padStart(12) + f(sb[k] || 0).padStart(12));
  top.forEach(k => { row(k); Object.keys(sb).filter(s => s.startsWith(k + '.')).sort((x, y) => sb[y] - sb[x]).slice(0, 6).forEach(s => { if (sb[s] > 2000) row(s, '  '); }); });
  console.log('  ' + '-'.repeat(56)); row('total');
  ['#rev 条数', '#rev 没掌握', '#rev 聊天句子'].forEach(row);
  const pct = n => (n / QUOTA * 100).toFixed(0) + '%';
  console.log('\n== 占 localStorage 多少（配额约 ' + f(QUOTA) + ' 字）==');
  for (const [nm, s] of [['1 年', sa.total], ['3 年', sb.total]]) {
    console.log('  ' + nm + '：存档 ' + f(s) + ' 字（' + pct(s) + '）；加 3 份每日备份 ' + f(s * 4) + '（' + pct(s * 4) + '）；再加「恢复前」「坏档」各一份 ' + f(s * 6) + '（' + pct(s * 6) + '）');
  }
  if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'bigsave-1y.json'), JSON.stringify(a)); fs.writeFileSync(path.join(outDir, 'bigsave-3y.json'), JSON.stringify(b)); console.log('\n写到 ' + outDir); }
}
