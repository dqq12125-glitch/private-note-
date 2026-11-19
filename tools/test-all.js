// 回声岛 · 并行跑全套测试（一个个跑要 1 小时左右，这里同时跑几个）
// 用法：
//   node tools/test-all.js                全部（默认同时 6 个）
//   node tools/test-all.js --jobs 4       同时 4 个
//   node tools/test-all.js battle talk    只跑名字里带这些字的
//   node tools/test-all.js --serial       一个个跑（和以前的 npm test 一样的顺序）
// 每个测试的完整输出存在 tests/logs/<名字>.log；失败的会自动再单独跑一次（机器忙的时候个别按时间判断的检查会误报），
// 两次都没过才算失败。最后打印一张表：每个测试多久、几个 ✓ 几个 ✗，退出码 = 失败的个数。
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const LOGS = path.join(ROOT, 'tests', 'logs');
// 顺序 = 以前 npm test 的顺序；慢的（岛、冠军赛、冒险）排在前面先开跑，总时间才短
const FAST = ['tools/check-banned.js', 'tests/dex-edition.test.js', 'tests/maps.test.js', 'tests/native.test.js', 'tests/ios.test.js'];   // 不开浏览器，先跑：有一个不过就没必要往下跑
const ALL = ['tests/practice.test.js', 'tests/book.test.js', 'tests/story.test.js', 'tests/battle.test.js', 'tests/apk.test.js', 'tests/sales.test.js', 'tests/gate.test.js', 'tests/save.test.js', 'tests/review.test.js', 'tests/talk.test.js', 'tests/quests.test.js', 'tests/world-goals.test.js', 'tests/sighting.test.js', 'tests/place.test.js', 'tests/i18n.test.js', 'tests/music.test.js', 'tests/field.test.js', 'tests/league.test.js', 'tests/raise.test.js', 'tests/adventure.test.js', 'tests/render3d.test.js', 'tests/look.test.js', 'tests/people3d.test.js', 'tests/isle-a.test.js', 'tests/isle-b.test.js', 'tests/isle-c.test.js', 'tests/isle-d.test.js', 'tests/isle-e.test.js'];
const SLOW_FIRST = ['isle-', 'league', 'adventure', 'render3d', 'look', 'story', 'gate', 'apk', 'sales', 'talk', 'quests'];

const argv = process.argv.slice(2); let jobs = Math.max(2, Math.min(6, Math.floor(os.cpus().length / 4))), serial = false; const only = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--jobs') jobs = +argv[++i] || jobs; else if (argv[i] === '--serial') serial = true; else only.push(argv[i]); }
if (serial) jobs = 1;
const pick = list => (only.length ? list.filter(f => only.some(o => f.includes(o))) : list);
const name = f => path.basename(f).replace(/\.test\.js$|\.js$/, '');
const fmt = ms => (ms >= 60000 ? Math.floor(ms / 60000) + ' 分 ' + Math.round(ms % 60000 / 1000) + ' 秒' : (ms / 1000).toFixed(1) + ' 秒');

function run(file, tag) {
  return new Promise(res => {
    const t0 = Date.now(), log = path.join(LOGS, name(file) + (tag || '') + '.log');
    const out = fs.createWriteStream(log);
    const ch = spawn(process.execPath, [file], { cwd: ROOT, env: process.env });
    let buf = '';
    const on = d => { out.write(d); buf += d; if (buf.length > 4e6) buf = buf.slice(-2e6); };
    ch.stdout.on('data', on); ch.stderr.on('data', on);
    ch.on('close', code => {
      out.end();
      const lines = buf.split(/\r?\n/);
      res({ file, code, ms: Date.now() - t0, ok: lines.filter(l => l.startsWith('✓')).length, bad: lines.filter(l => l.startsWith('✗')), tail: lines.filter(Boolean).slice(-6), log });
    });
  });
}
async function pool(list, n, onDone) {
  const q = list.slice(), out = [];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) { const r = await run(q.shift()); out.push(r); onDone(r); } }));
  return out;
}

(async () => {
  fs.mkdirSync(LOGS, { recursive: true });
  const T0 = Date.now(), results = [];
  const say = r => console.log((r.code === 0 ? '✓' : '✗') + ' ' + name(r.file).padEnd(14) + fmt(r.ms).padStart(12) + '   ✓ ' + r.ok + (r.bad.length ? '   ✗ ' + r.bad.length : ''));
  // 1) 不开浏览器的几个：很快，先跑
  for (const f of pick(FAST)) { const r = await run(f); results.push(r); say(r); }
  if (results.some(r => r.code !== 0) && !only.length) { console.log('\n基础检查没过，后面的先不跑：'); results.filter(r => r.code).forEach(r => console.log('  ' + r.file + '\n    ' + r.bad.concat(r.tail).slice(0, 8).join('\n    '))); process.exit(1); }
  // 2) 开浏览器的：同时跑 jobs 个
  let list = pick(ALL);
  if (!serial) list = list.slice().sort((a, b) => { const k = f => { const i = SLOW_FIRST.findIndex(s => f.includes(s)); return i < 0 ? 99 : i; }; return k(a) - k(b); });
  console.log('同时跑 ' + jobs + ' 个，共 ' + list.length + ' 个……');
  results.push(...await pool(list, jobs, say));
  // 3) 没过的单独再跑一次
  const failed = results.filter(r => r.code !== 0);
  for (const r of failed) {
    console.log('再跑一次 ' + name(r.file) + '（第一次没过：' + (r.bad[0] || r.tail[r.tail.length - 1] || '').slice(0, 120) + '）');
    const r2 = await run(r.file, '.retry'); say(r2);
    r.retry = r2;
  }
  const still = failed.filter(r => r.retry.code !== 0), flaky = failed.filter(r => r.retry.code === 0);
  console.log('\n—— 一共 ' + results.length + ' 个，用了 ' + fmt(Date.now() - T0) + '；通过 ' + (results.length - still.length) + '，失败 ' + still.length + (flaky.length ? '；第二次才过的（按时间判断的检查，机器忙时会这样）：' + flaky.map(r => name(r.file)).join('、') : ''));
  still.forEach(r => { console.log('\n✗ ' + r.file + '（完整输出：tests/logs/' + path.basename(r.retry.log) + '）'); r.retry.bad.concat(r.retry.bad.length ? [] : r.retry.tail).slice(0, 12).forEach(l => console.log('    ' + l.slice(0, 300))); });
  process.exit(still.length);
})();
