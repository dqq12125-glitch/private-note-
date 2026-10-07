// 把 tools/dex/*.json 合并成 dex.js 里的怪兽列表，同时做检查
// 运行：node tools/build-dex.js                 写 dex.js
//       node tools/build-dex.js --check         只检查不写
//       node tools/build-dex.js --sales=<目录>   另外生成销售版要打包的文件（安卓打销售版时 build.gradle 调用）：
//         <目录>/dex.js（没有保留的怪兽记录，进化链已经接好）、<目录>/assets/mon3d/index.json、<目录>/assets/mon2d/index.json（去掉保留的）
//
// 手册顺序（2026-10-08 评审 P0-C）：json 里的 no 只是美术流程用的老编号，**不打包进 dex.js**。
// dex.js 里怪兽的先后就是手册编号 dexNo 的顺序，按我们自己的规则排：
//   先按大区（r：老编号 1–151 是第一大区、152–251 第二、252–386 第三），
//   第一大区里按「这一家第一次在野外出现的岛」排（和 monsters.js 的野外表同一套算法），同一座岛按英文名字母排；
//   野外遇不到的（选伙伴的、只在蛋里的）放在后面，按属性、名字排；神兽放在每个大区最后。
//   同一条进化链挨在一起（一阶、二阶、三阶）。
// 每只怪兽带 r（大区）和 sd（0–999，能力值的固定小浮动，monsters.js 的 baseStats 用）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'dex');
const ROOT = path.join(__dirname, '..');
const out = path.join(ROOT, 'dex.js');
const spec = {
  types: 'normal fire water grass spark ice fight poison ground flying psychic bug rock ghost dragon dark steel'.split(' '),
  b: 'blob biped quad bird fish serpent bug golem ghost plant shell dragon'.split(' '),
  e: 'cat dog round bunny fin leaf antenna horn horns curl crest flame ice flower spikes crown cloud gem none'.split(' '),
  t: 'flame fin leaf bolt fluffy curl spike feather stinger club cloud long none'.split(' '),
  w: 'feather bat bug fairy none'.split(' '),
  p: 'spots stripes mask star none'.split(' '),
  m: 'smile fang beak grin o'.split(' '),
  x: 'mane crown shell leafback crystals flames cloud scarf antlers whiskers spikesback aura'.split(' '),
  habitat: 'grass forest water sea cave mountain sky town desert snow volcano swamp ruins night'.split(' '),
  items: 'firestone waterstone leafstone thunderstone moonstone sunstone icestone'.split(' '),
};
const all = [];
fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().forEach(f => {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  arr.forEach(s => { s._file = f; all.push(s); });
});
const errs = [], warn = [];
const byId = {}, byNo = {};
all.forEach(s => {
  const w = m => errs.push('#' + s.no + ' ' + s.id + ' (' + s._file + '): ' + m);
  if (byNo[s.no]) w('编号重复，和 ' + byNo[s.no].id); byNo[s.no] = s;
  if (byId[s.id]) w('id 重复，和 #' + byId[s.id].no); byId[s.id] = s;
  // keepId：改过英文名、但 id 要留给老存档用的（id 不跟着英文名变）
  if (s.id !== s.en.toLowerCase().replace(/\s/g, '') && !s.keepId) w('id 和英文名不一致');
  if (!/^[A-Z][a-zA-Z]{2,11}$/.test(s.en)) w('英文名格式 ' + s.en);
  if (!s.zh || s.zh.length < 2 || s.zh.length > 5) w('中文名 ' + s.zh);
  if (!Array.isArray(s.types) || !s.types.length || s.types.length > 2 || s.types.some(t => !spec.types.includes(t))) w('属性 ' + s.types);
  ['b', 'e', 't', 'w', 'p', 'm'].forEach(k => { if (s[k] != null && !spec[k].includes(s[k])) w(k + ' 不合法: ' + s[k]); });
  (s.x || []).forEach(x => { if (!spec.x.includes(x)) w('x 不合法: ' + x); });
  (s.habitat || []).forEach(h => { if (!spec.habitat.includes(h)) w('habitat 不合法: ' + h); });
  ['c', 'k', 'a'].forEach(k => { if (s[k] && !/^#[0-9a-fA-F]{6}$/.test(s[k])) w(k + ' 颜色格式'); });
  if (!(s.hp >= 25 && s.hp <= 110 && s.atk >= 6 && s.atk <= 32)) w('数值 hp ' + s.hp + ' atk ' + s.atk);
  if (!s.dexEn || !s.dexZh) w('缺手册文字');
});
all.forEach(s => (s.evo || []).forEach(e => {
  const t = byId[e.to];
  if (!t) errs.push('#' + s.no + ' ' + s.id + ': 进化目标不存在 ' + e.to);
  else if ((t.stage || 1) !== (s.stage || 1) + 1) warn.push('#' + s.no + ' ' + s.id + ' → ' + e.to + ' 阶段不连续');
  if (e.item && !spec.items.includes(e.item)) errs.push('#' + s.no + ' 进化道具不合法 ' + e.item);
  if (!e.item && !(e.lv >= 2 && e.lv <= 70)) errs.push('#' + s.no + ' 进化等级 ' + e.lv);
}));
const missing = []; for (let i = 1; i <= 386; i++) if (!byNo[i]) missing.push(i);
console.log('怪兽', all.length, '只；缺', missing.length, '个编号' + (missing.length && missing.length < 40 ? '：' + missing.join(',') : ''));
console.log('神兽', all.filter(s => s.legend).length, '；双属性', all.filter(s => s.types.length === 2).length, '；三阶链', all.filter(s => s.stage === 3).length);
const tc = {}; all.forEach(s => s.types.forEach(t => { tc[t] = (tc[t] || 0) + 1; })); console.log('属性分布', JSON.stringify(tc));
warn.forEach(w => console.log('注意', w));
errs.forEach(e => console.log('错误', e));
if (errs.length) { console.log('FAIL', errs.length); process.exitCode = 1; }
if (process.argv.includes('--check') || errs.length) return;

// ---------- 保留的（撞脸等重画）：和 dex.js 的 RESERVED、tools/mon3d/lookalike.txt 一致 ----------
const RES = new Set(fs.readFileSync(path.join(__dirname, 'mon3d', 'lookalike.txt'), 'utf8').split(/\r?\n/)
  .map(l => l.trim()).filter(l => l && !l.startsWith('#')).flatMap(l => l.split(/\s+/)[0].split('/')).filter(id => byId[id]));

// ---------- 排手册顺序 ----------
const region = s => s.no <= 151 ? 1 : s.no <= 251 ? 2 : 3;
const sd = s => ((s.no * 2654435761) >>> 0) % 1000;
all.forEach(s => (s.evo || []).forEach(e => { if (byId[e.to] && !byId[e.to]._from) byId[e.to]._from = s.id; }));
const baseOf = s => { let x = s; for (let i = 0; i < 4 && x._from; i++) x = byId[x._from]; return x; };
// 野外表：和 monsters.js 的 wildTable 同一套算法（第一大区、第一阶、按地点和稀有度、按区域编号打乱取 6–8 种）
const HAB = { grass: ['grass', 'forest', 'town', 'sky'], cave: ['cave', 'mountain', 'ruins', 'night'], water: ['water', 'sea', 'swamp'] };
const hash = (a, b) => { let h = 2166136261; for (const c of String(a) + '|' + b) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const REGION1 = all.filter(s => region(s) === 1 && !s.legend && !s.starter && !RES.has(s.id));
const isBase1 = s => { let f = s._from; while (f && RES.has(f)) f = byId[f]._from; return !f; };
const firstZ = {};
for (let z = 0; z < 13; z++) for (const hab of Object.keys(HAB)) {
  const key = z + hab, want = HAB[hab];
  let pool = REGION1.filter(s => isBase1(s) && (s.habitat || []).some(h => want.includes(h)) && s.rarity <= 2 + Math.floor(z / 3));
  if (pool.length < 4) pool = REGION1.filter(isBase1);
  pool.slice().sort((a, b) => hash(key, a.id) - hash(key, b.id)).slice(0, 6 + (z % 3)).forEach(s => {
    const b = baseOf(s).id; if (firstZ[b] == null || z < firstZ[b]) firstZ[b] = z;
  });
}
const TORD = spec.types;
const fams = {};
all.forEach(s => { const b = baseOf(s); (fams[b.id] = fams[b.id] || { base: b, list: [] }).list.push(s); });
const famKey = f => {
  const b = f.base, r = region(b), leg = f.list.some(s => s.legend) ? 1 : 0;
  const wild = r === 1 && firstZ[b.id] != null ? 0 : 1;
  const z = wild ? 99 : firstZ[b.id];
  return [r, leg, wild, z, wild ? TORD.indexOf(b.types[0]) : 0, b.en];
};
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
const famList = Object.values(fams).sort((a, b) => cmp(famKey(a), famKey(b)));
const ordered = famList.flatMap(f => f.list.sort((a, b) => (a.stage || 1) - (b.stage || 1) || a.en.localeCompare(b.en)));

const keep = 'id en zh types stage evo hp atk b c k a e t w p m x sz eye iris habitat rarity words dexEn dexZh legend starter'.split(' ');
const rowOf = s => { const o = {}; keep.forEach(k => { if (s[k] != null && !(Array.isArray(s[k]) && !s[k].length && k !== 'evo' && k !== 'types')) o[k] = s[k]; }); o.r = region(s); o.sd = sd(s); return o; };
const rows = ordered.map(rowOf);
const src = fs.readFileSync(out, 'utf8');
const put = (txt, list) => { const a = txt.indexOf('/* SPECIES:BEGIN */'), b = txt.indexOf('/* SPECIES:END */'); return txt.slice(0, a) + '/* SPECIES:BEGIN */\n  const SPECIES = [\n' + list.map(o => '    ' + JSON.stringify(o)).join(',\n') + ',\n  ];\n  ' + txt.slice(b); };
const next = put(src, rows);
const salesArg = process.argv.find(a => a.startsWith('--sales='));
// 生成销售版打包文件时不改 dex.js，只核对它是最新的（打包、测试都不该悄悄改源码）
if (!salesArg) {
  fs.writeFileSync(out, next);
  console.log('写入 dex.js：', rows.length, '只（手册顺序：大区 → 第一次在野外出现的岛 → 名字）');
} else if (next.replace(/\r\n/g, '\n') !== src.replace(/\r\n/g, '\n')) {
  console.log('错误：dex.js 不是最新的（tools/dex/*.json 改过）——先跑 node tools/build-dex.js');
  process.exitCode = 1;
  return;
}

// ---------- 销售版的打包文件 ----------
if (salesArg) {
  const sdir = path.resolve(salesArg.slice(8));
  // 进化目标是保留的：接到它的下一阶（用下一阶的进化条件），后面也没有了就不进化（和 dex.js 运行时的做法一样）
  const fix = (e, d) => !RES.has(e.to) ? [e] : d > 3 || !byId[e.to] ? [] : (byId[e.to].evo || []).flatMap(e2 => fix(e2, d + 1));
  const salesRows = ordered.filter(s => !RES.has(s.id)).map(s => { const o = rowOf(s); o.evo = (s.evo || []).flatMap(e => fix(e, 0)); return o; });
  let txt = put(next, salesRows);
  const a = txt.indexOf('/* RESERVED:BEGIN */'), b = txt.indexOf('/* RESERVED:END */');
  if (a < 0 || b < 0) throw new Error('dex.js 里找不到 RESERVED 标记');
  txt = txt.slice(0, a) + '/* RESERVED:BEGIN */ const RESERVED = [];   // 销售版：保留的怪兽连记录都不打包 ' + txt.slice(b);
  fs.mkdirSync(path.join(sdir, 'assets', 'mon3d'), { recursive: true });
  fs.mkdirSync(path.join(sdir, 'assets', 'mon2d'), { recursive: true });
  fs.writeFileSync(path.join(sdir, 'dex.js'), txt);
  ['mon3d', 'mon2d'].forEach(k => {
    const f = path.join(ROOT, 'assets', k, 'index.json');
    const ids = JSON.parse(fs.readFileSync(f, 'utf8')).filter(id => !RES.has(id));
    fs.writeFileSync(path.join(sdir, 'assets', k, 'index.json'), JSON.stringify(ids));
  });
  fs.writeFileSync(path.join(sdir, 'reserved.txt'), [...RES].join('\n') + '\n');
  console.log('销售版打包文件：', sdir, '（', salesRows.length, '只，去掉保留的', RES.size, '只）');
}
