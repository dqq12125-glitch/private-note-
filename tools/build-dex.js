// 把 tools/dex/*.json 合并成 dex.js 里的怪兽列表，同时做检查
// 运行：node tools/build-dex.js        （只检查不写：node tools/build-dex.js --check）
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'dex');
const out = path.join(__dirname, '..', 'dex.js');
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
  if (s.id !== s.en.toLowerCase().replace(/\s/g, '')) w('id 和英文名不一致');
  if (!/^[A-Z][a-zA-Z]{2,11}$/.test(s.en)) w('英文名格式 ' + s.en);
  if (!s.zh || s.zh.length < 2 || s.zh.length > 5) w('中文名 ' + s.zh);
  if (!Array.isArray(s.types) || !s.types.length || s.types.length > 2 || s.types.some(t => !spec.types.includes(t))) w('属性 ' + s.types);
  ['b', 'e', 't', 'w', 'p', 'm'].forEach(k => { if (s[k] != null && !spec[k].includes(s[k])) w(k + ' 不合法: ' + s[k]); });
  (s.x || []).forEach(x => { if (!spec.x.includes(x)) w('x 不合法: ' + x); });
  (s.habitat || []).forEach(h => { if (!spec.habitat.includes(h)) w('habitat 不合法: ' + h); });
  ['c', 'k', 'a'].forEach(k => { if (s[k] && !/^#[0-9a-fA-F]{6}$/.test(s[k])) w(k + ' 颜色格式'); });
  if (!(s.hp >= 25 && s.hp <= 110 && s.atk >= 6 && s.atk <= 32)) w('数值 hp ' + s.hp + ' atk ' + s.atk);
  if (!s.dexEn || !s.dexZh) w('缺图鉴文字');
});
all.forEach(s => (s.evo || []).forEach(e => {
  const t = byId[e.to];
  if (!t) errs.push('#' + s.no + ' ' + s.id + ': 进化目标不存在 ' + e.to);
  else if ((t.stage || 1) !== (s.stage || 1) + 1) warn.push('#' + s.no + ' ' + s.id + ' → ' + e.to + ' 阶段不连续');
  if (e.item && !spec.items.includes(e.item)) errs.push('#' + s.no + ' 进化道具不合法 ' + e.item);
  if (!e.item && !(e.lv >= 2 && e.lv <= 70)) errs.push('#' + s.no + ' 进化等级 ' + e.lv);
}));
const nos = all.map(s => s.no).sort((a, b) => a - b);
const missing = []; for (let i = 1; i <= 386; i++) if (!byNo[i]) missing.push(i);
console.log('怪兽', all.length, '只；缺', missing.length, '个编号' + (missing.length && missing.length < 40 ? '：' + missing.join(',') : ''));
console.log('神兽', all.filter(s => s.legend).length, '；双属性', all.filter(s => s.types.length === 2).length, '；三阶链', all.filter(s => s.stage === 3).length);
const tc = {}; all.forEach(s => s.types.forEach(t => { tc[t] = (tc[t] || 0) + 1; })); console.log('属性分布', JSON.stringify(tc));
warn.forEach(w => console.log('注意', w));
errs.forEach(e => console.log('错误', e));
if (errs.length) { console.log('FAIL', errs.length); process.exitCode = 1; }
if (process.argv.includes('--check') || errs.length) return;
const keep = 'no id en zh types stage evo hp atk b c k a e t w p m x sz eye iris habitat rarity words dexEn dexZh legend starter'.split(' ');
const rows = all.sort((a, b) => a.no - b.no).map(s => { const o = {}; keep.forEach(k => { if (s[k] != null && !(Array.isArray(s[k]) && !s[k].length && k !== 'evo' && k !== 'types')) o[k] = s[k]; }); return '    ' + JSON.stringify(o); });
const src = fs.readFileSync(out, 'utf8');
const a = src.indexOf('/* SPECIES:BEGIN */'), b = src.indexOf('/* SPECIES:END */');
fs.writeFileSync(out, src.slice(0, a) + '/* SPECIES:BEGIN */\n  const SPECIES = [\n' + rows.join(',\n') + ',\n  ];\n  ' + src.slice(b));
console.log('写入 dex.js：', rows.length, '只');
