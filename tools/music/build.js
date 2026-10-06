// 把 tools/music/songs/*.js 的乐谱检查一遍，合成 music-data.js（window.MUSIC）
//   node tools/music/build.js            检查全部并写出 music-data.js（有错误就不写）
//   node tools/music/build.js route cave 只检查这几首，打印详细报告（不写文件）
//   --out x.js      写到别的文件（测试用）    --levels x.json  用别的音量校正文件（默认 tools/music/levels.json）
// 音量校正：tools/music/levels.json（{ id: 增益 dB }，由 node tools/music/render.js --levels 算出）里有的曲子，
//   写进曲库时加上 gain 字段，引擎 music.js 放的时候乘上；没有这个文件 / 没有这首就不加（引擎当 0 dB）
const fs = require('fs');
const path = require('path');
const core = require('../../music-core.js');

const DIR = path.join(__dirname, 'songs');
let OUT = path.join(__dirname, '..', '..', 'music-data.js');
let LEVELS = path.join(__dirname, 'levels.json');
const only = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') OUT = path.resolve(argv[++i]);
  else if (argv[i] === '--levels') LEVELS = path.resolve(argv[++i]);
  else only.push(argv[i]);
}
let levels = {};
if (fs.existsSync(LEVELS)) {
  try { levels = JSON.parse(fs.readFileSync(LEVELS, 'utf8')); } catch (e) { console.log('✗ ' + LEVELS + ' 读不了：' + e.message); process.exit(1); }
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const songs = {};
let bad = 0;
for (const f of files) {
  const id = f.replace(/\.js$/, '');
  if (only.length && !only.includes(id)) continue;
  let song;
  try { delete require.cache[require.resolve(path.join(DIR, f))]; song = require(path.join(DIR, f)); } catch (e) { console.log('✗ ' + id + '：文件读不了 ' + e.message); bad++; continue; }
  const r = core.check(song);
  if (song.id !== id) r.errors.unshift('id "' + song.id + '" 要和文件名 "' + id + '" 一样');
  const lv = levels[id];
  if (lv != null && !(typeof lv === 'number' && isFinite(lv) && Math.abs(lv) <= 12)) r.errors.push('levels.json 里 ' + id + ' 的音量校正 ' + JSON.stringify(lv) + ' 不对（要是 -12–12 的数）');
  const s = r.stats;
  console.log((r.errors.length ? '✗ ' : r.warnings.length ? '△ ' : '✓ ') + id + '  ' + (song.title || '') + '  ' + s.bars + ' 小节 · ' + s.seconds + ' 秒' + (song.loop !== false ? '（循环 ' + s.loopSeconds + ' 秒）' : '（一次性）') +
    ' · 调外 ' + Math.round((s.outOfKey || 0) * 100) + '% · 强拍刺耳 ' + Math.round((s.strongClash || 0) * 100) + '% · 旋律 ' + s.leadNotesPerSec + ' 个/秒 · 不重复小节 ' + Math.round((s.distinctLeadBars || 0) * 100) + '%' +
    (typeof lv === 'number' ? ' · 音量校正 ' + (lv > 0 ? '+' : '') + lv + ' dB' : ''));
  r.errors.slice(0, only.length ? 999 : 12).forEach(e => console.log('    错误：' + e));
  if (!only.length && r.errors.length > 12) console.log('    ……还有 ' + (r.errors.length - 12) + ' 个错误');
  r.warnings.forEach(w => console.log('    提醒：' + w));
  if (r.errors.length) bad++;
  songs[id] = typeof lv === 'number' ? Object.assign({}, song, { gain: lv }) : song;
}
if (only.length) process.exit(bad ? 1 : 0);
if (bad) { console.log('\n有 ' + bad + ' 首有错误，没有写 music-data.js'); process.exit(1); }
const stale = Object.keys(levels).filter(id => !songs[id]);
if (stale.length) console.log('\n提醒：levels.json 里有已经没有的曲子：' + stale.join(' ') + '（重新跑 node tools/music/render.js --levels）');
const body = '// 自动生成：node tools/music/build.js（从 tools/music/songs/*.js，音量校正来自 tools/music/levels.json），不要手改\nwindow.MUSIC = ' + JSON.stringify({ songs }) + ';\n';
fs.writeFileSync(OUT, body);
const nLv = Object.keys(songs).filter(id => typeof songs[id].gain === 'number').length;
console.log('\n写出 ' + path.relative(process.cwd(), OUT) + '：' + Object.keys(songs).length + ' 首，' + (body.length / 1024).toFixed(1) + ' KB' + (nLv ? '（' + nLv + ' 首带音量校正）' : ''));
