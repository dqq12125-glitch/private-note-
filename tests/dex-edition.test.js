// 家庭版 / 销售版的怪兽手册（不开浏览器，秒出结果）：
// 1. 两个版本的手册总数、第一大区数都不是 386 / 151，而且两个版本一样
// 2. 销售版里没有 RESERVED（等重画的）怪兽；byId 里还查得到（老 id 不会出错）
// 3. RESERVED 和 tools/mon3d/lookalike.txt 一致
// 4. 销售版的进化链：目标都在；被拿掉中间一阶的接到下一阶；上一阶被拿掉的成了第一阶
// 5. 手册编号 dexNo 从 1 连着编，保留的不编号
// 6. 剧情、岛上写死的怪兽（神兽、里程碑、训练师的队伍、笼子里的）都不是保留的
// 7. 版本从哪里来：原生桥 > window.ECHO_EDITION > 网址 > localStorage
// 运行：node tests/dex-edition.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; };

const SRC = fs.readFileSync(path.join(ROOT, 'dex.js'), 'utf8');
function load(win) {
  const ctx = { window: Object.assign({}, win) };
  if (win && win._search) { ctx.location = { search: win._search }; ctx.URLSearchParams = URLSearchParams; }
  vm.runInNewContext(SRC, ctx);
  return ctx.window.DEX;
}
const F = load({}), S = load({ ECHO_EDITION: 'sales' });

// ---------- 版本从哪里来 ----------
check(F.edition === 'family' && !F.sales, '默认是家庭版');
check(S.edition === 'sales' && S.sales, 'window.ECHO_EDITION = sales → 销售版');
check(load({ EchoNative: { edition: () => 'sales' } }).sales, '原生桥 EchoNative.edition() 说 sales → 销售版');
check(!load({ EchoNative: { edition: () => 'family' }, ECHO_EDITION: 'sales' }).sales, '原生桥说 family 时，页面变量改不成销售版');
check(load({ _search: '?edition=sales' }).sales, '网址 ?edition=sales → 销售版');
check(load({ localStorage: { getItem: k => (k === 'echo-edition' ? 'sales' : null) } }).sales, "localStorage['echo-edition'] = sales → 销售版");
check(!load({ EchoNative: { edition: () => { throw new Error('x'); } } }).sales, '原生桥出错 → 还是家庭版');

// ---------- 保留的怪兽和 lookalike.txt 一致 ----------
const look = new Set();
fs.readFileSync(path.join(ROOT, 'tools', 'mon3d', 'lookalike.txt'), 'utf8').split(/\r?\n/).forEach(l => {
  const first = l.trim().split(/\s+/)[0];
  if (first && !first.startsWith('#')) first.split('/').forEach(id => look.add(id));
});
const R = new Set(F.RESERVED);
check(look.size === R.size && [...look].every(id => R.has(id)), 'dex.js 的 RESERVED（' + R.size + ' 只）和 lookalike.txt 一致');
check([...R].every(id => F.byId[id]), '保留的 id 都还在（老存档能用）');

// ---------- 总数 ----------
check(F.total === S.total && F.region1Total === S.region1Total, '两个版本手册总数一样（' + F.total + '）、第一大区一样（' + F.region1Total + '）');
check(F.total !== 386 && F.region1Total !== 151, '手册总数不是 386、第一大区不是 151');
check(F.total === F.all.length - R.size && F.main.length === F.total, '手册总数 = 全部 − 保留的');
check(F.list.length === F.all.length && F.extra.length === R.size, '家庭版：全部都在，保留的放在番外（' + F.extra.length + ' 只）');
check(S.list.length === S.total && S.list.every(s => !R.has(s.id)) && !S.extra.length, '销售版：list 里没有保留的，没有番外');
check(S.byId.flamewolf && S.byId.flamewolf.reserved, '销售版的 byId 里还查得到保留的（不会出错）');

// ---------- 编号 ----------
check(F.main.every((s, i) => s.dexNo === i + 1) && F.extra.every(s => !s.dexNo), '手册编号从 1 连着编，番外不编号');
check(S.main.every((s, i) => s.dexNo === i + 1), '销售版编号一样');
const bird = F.byId.frostwing;
check(bird.dexNo !== 144 && !bird.dexNo, '老编号 144 的那只不再显示编号');
// 评审 P0-C：美术流程的老编号 no 不打包；手册按我们自己的顺序（大区 → 第一次在野外出现的岛 → 名字），神兽在每个大区最后
check(F.all.every(s => s.no === undefined && [1, 2, 3].includes(s.r) && s.sd >= 0 && s.sd < 1000) && !/"no":/.test(SRC), 'dex.js 里没有老编号 no，只有大区 r 和能力浮动 sd');
check(F.main.every((s, i) => i === 0 || F.main[i - 1].r <= s.r), '手册按大区排（第一大区在最前）');
check([1, 2, 3].every(r => { const L = F.main.filter(s => s.r === r), k = L.findIndex(s => s.legend); return k < 0 || L.slice(k).every(s => s.legend); }), '每个大区的神兽都排在最后');
const starterNos = ['sprouty', 'emberpup', 'bubbly'].map(id => F.byId[id].dexNo);
check(starterNos.every(n => n > 20) && !F.main[0].starter, '三只初始伙伴不在手册最前面（' + starterNos.join('、') + '）');
const lv = id => (F.byId[id].evo || []).map(e => e.lv);
check(['sprouty', 'emberpup', 'bubbly', 'teabud', 'lampkit', 'puddleling', 'leafgecko', 'cinderchick', 'puddlenewt'].every(id => !lv(id).includes(16) && !lv(F.byId[id].evo[0].to).includes(36)), '三阶的草 / 火 / 水伙伴链不是 16 级、36 级进化');
check(F.byId.zappy.evo[0].lv && !F.byId.zappy.evo[0].item && F.byId.voltmouse.en !== 'Voltmouse', '#25 那只（亮亮仓鼠）按等级进化，不用进化曲；二阶改了名字');
const T = id => F.byId[id].types.join('/');
check(T('voltlion') !== 'spark' && T('flamelion') !== 'fire' && T('springlion') !== 'water', '三只狮子不再是单属性电 / 火 / 水');
check(T('rockgiant') !== 'rock' && T('icegiant') !== 'ice' && T('irongiant') !== 'steel', '三个巨人不再是单属性岩石 / 冰 / 钢');
check(T('skysong') !== 'dragon/psychic' && T('skyecho') !== 'dragon/psychic' && T('echodrake') !== 'dragon/flying' && T('wishstar') !== 'steel/psychic' &&
  T('tidewing') !== 'psychic/flying' && T('rainbowing') !== 'fire/flying' && T('timesprout') !== 'psychic/grass' && !F.byId.starcore.types.includes('psychic') && !F.byId.lullaby.types.includes('psychic') && !F.byId.mindra.types.includes('psychic'), '其余神兽也换了属性');
check(T('solarknight') !== 'fire/fight' && T('canyonguard') !== 'water/ground', '两只三阶（烈阳骑士、峡谷卫士）换了属性');

// ---------- 销售版的进化链 ----------
const ids = new Set(S.list.map(s => s.id));
const evoTargets = S.list.flatMap(s => (s.evo || []).map(e => e.to));
check(evoTargets.every(t => ids.has(t)), '销售版：每个进化目标都在');
check(S.list.every(s => !s.from || ids.has(s.from)), '销售版：上一阶都在');
check(JSON.stringify(S.byId.puddlenewt.evo) === JSON.stringify(F.byId.brookrunner.evo) && S.byId.canyonguard.from === 'puddlenewt', '中间一阶被拿掉：Puddlenewt 直接进化成 Canyonguard（用下一阶的条件）');
check(!S.byId.blazehound.evo.length && F.byId.blazehound.evo.length, '最后一阶被拿掉：销售版 Blazehound 不再进化，家庭版照旧');
check(S.isBase(S.byId.stormhawk) && !F.isBase(F.byId.stormhawk), '上一阶全被拿掉：销售版 Stormhawk 成了第一阶');
check(['springdeer', 'summerdeer', 'autumndeer', 'winterdeer'].every(id => S.isBase(S.byId[id])), '四只季节鹿在销售版里是第一阶');
// 每只都拿得到：第一阶（野外 / 蛋），或者从这个版本里的上一阶进化来
check(S.list.every(s => S.isBase(s) || ids.has(s.from)), '销售版里每只都能拿到（第一阶，或者能进化出来）');
check(F.list.every(s => (s.stage === 1) === F.isBase(s)), '家庭版：第一阶就是 stage 1（和以前一样）');

// ---------- 剧情和岛上写死的怪兽不能是保留的 ----------
const files = ['story.js', 'world.js', 'monsters.js', 'game.js', ...fs.readdirSync(path.join(ROOT, 'isles')).map(f => 'isles/' + f)];
const used = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const re of [/mon: '([a-z]+)'/g, /newMon\('([a-z]+)'/g, /\[\['([a-z]+)', -?\d+\]/g, /\], \['([a-z]+)', -?\d+\]/g, /\['([a-z]+)', \d+, \d+\]/g]) {
    let m; while ((m = re.exec(s))) used.push([f, m[1]]);
  }
}
const bad = used.filter(([, id]) => F.byId[id] && R.has(id));
check(used.length > 20 && !bad.length, '剧情 / 岛上写死的 ' + used.length + ' 处怪兽都不是保留的' + (bad.length ? '：' + JSON.stringify(bad) : ''));
const miles = [...fs.readFileSync(path.join(ROOT, 'story.js'), 'utf8').matchAll(/\{ id: '(\w+)', mon: '(\w+)', old: '(\w+)'/g)];
check(miles.length === 4 && miles.every(m => F.byId[m[2]] && !R.has(m[2]) && F.byId[m[2]].legend), '四个学习里程碑的神兽都在、都不是保留的：' + miles.map(m => m[1] + '→' + m[2]).join('、'));
check(['emberpup', 'bubbly', 'sprouty'].every(id => !R.has(id)), '三只初始伙伴不是保留的');

// ---------- 销售版安装包里的 dex.js 和怪兽图索引（tools/build-dex.js --sales，build.gradle 打销售版时调用） ----------
const os = require('os');
const { execFileSync } = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-sales-'));
let built = true;
try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-dex.js'), '--sales=' + tmp], { stdio: 'pipe' }); } catch (e) { built = false; console.log(String(e.stdout || '') + String(e.stderr || '')); }
check(built && fs.existsSync(path.join(tmp, 'dex.js')), 'build-dex.js --sales 生成了销售版的 dex.js（dex.js 是最新的）');
if (built) {
  const SS = fs.readFileSync(path.join(tmp, 'dex.js'), 'utf8');
  const ctx = { window: { ECHO_EDITION: 'sales' } };
  vm.runInNewContext(SS, ctx);
  const P = ctx.window.DEX;
  check([...R].every(id => !P.byId[id] && !SS.includes('"id":"' + id + '"')) && !P.RESERVED.length, '销售版 dex.js 里连保留的怪兽记录都没有');
  check(P.total === S.total && P.region1Total === S.region1Total && P.list.length === S.list.length, '总数、第一大区和运行时过滤的销售版一样（' + P.total + ' / ' + P.region1Total + '）');
  check(P.list.every((s, i) => s.id === S.list[i].id && s.dexNo === S.list[i].dexNo && JSON.stringify(s.evo) === JSON.stringify(S.list[i].evo) && (s.from || '') === (S.list[i].from || '')), '每只的编号、进化链和运行时过滤的销售版一样');
  ['mon3d', 'mon2d'].forEach(k => {
    const a = JSON.parse(fs.readFileSync(path.join(tmp, 'assets', k, 'index.json'), 'utf8')), b = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', k, 'index.json'), 'utf8'));
    check(a.every(id => !R.has(id)) && a.length === b.filter(id => !R.has(id)).length, 'assets/' + k + '/index.json：销售版去掉了保留的（' + (b.length - a.length) + ' 个）');
  });
  const rlist = fs.readFileSync(path.join(tmp, 'reserved.txt'), 'utf8').trim().split(/\s+/);
  check(rlist.length === R.size && rlist.every(id => R.has(id)), 'reserved.txt（给 build.gradle 排除美术文件用）和 RESERVED 一致');
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fails ? 'FAIL ' + fails : 'PASS');
if (fails) process.exitCode = 1;
