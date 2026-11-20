// 核对课程包（tools/pack/SPEC.md §3）：node tools/pack/check.js <目录>
// <目录> 可以是一个版本（里面有 manifest.json）、一门语言、或者整个 dist/packs（有 catalog.json 时也核对目录写的版本、大小）。
// 每个版本照 manifest 核对：文件都在、大小和 crc 对、配音包的格式对（EPK1、头读得出来、items 加起来等于文件长度）、
// 每个包的段数 = n、key 不重复（同一个声音里）、声音只有 f / m、manifest 的 voice.n 和实际的段数一样、core 的文件都在前面。
// 有问题退出码 1，一条条列出来。
'use strict';
const fs = require('fs');
const path = require('path');
const P = require(path.join(__dirname, '..', '..', 'packs.js'))._;

function checkVersion(dir) {
  const bad = [], mf = path.join(dir, 'manifest.json');
  let man;
  try { man = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) { return { dir, bad: ['manifest.json 读不出来：' + e.message], clips: 0, bytes: 0 }; }
  if (man.fmt !== 1) bad.push('fmt 不是 1');
  if (!P.okVer(man.ver) || path.basename(dir) !== man.ver) bad.push('版本 ' + man.ver + ' 和目录名 ' + path.basename(dir) + ' 对不上');
  if (path.basename(path.dirname(dir)) !== man.lang) bad.push('语言 ' + man.lang + ' 和目录对不上');
  const files = Array.isArray(man.files) ? man.files : [];
  if (!files.length) bad.push('files 是空的');
  const seen = { f: new Set(), m: new Set() }, names = new Set();
  let clips = 0, bytes = 0, coreEnded = false;
  const n = { f: 0, m: 0 };
  for (const f of files) {
    if (names.has(f.name)) bad.push(f.name + ' 重复了');
    names.add(f.name);
    if (!f.core) coreEnded = true; else if (coreEnded) bad.push(f.name + ' 是 core，但排在不是 core 的后面');
    const p = path.join(dir, f.name);
    if (!fs.existsSync(p)) { bad.push(f.name + ' 不在'); continue; }
    const data = fs.readFileSync(p);
    bytes += data.length;
    if (data.length !== f.bytes) bad.push(f.name + ' 大小是 ' + data.length + '，manifest 写的是 ' + f.bytes);
    if (P.crcHex(data) !== f.crc) bad.push(f.name + ' 的 crc 是 ' + P.crcHex(data) + '，manifest 写的是 ' + f.crc);
    if (f.kind === 'course') { try { JSON.parse(data.toString('utf8')); } catch (e) { bad.push(f.name + ' 不是 JSON'); } continue; }
    if (f.kind !== 'voice') { bad.push(f.name + ' 的 kind 不认识：' + f.kind); continue; }
    if (data.length > 16 * 1048576) bad.push(f.name + ' 比 16 MiB 大');
    let r;
    try { r = P.readBundle(data); } catch (e) { bad.push(f.name + '：' + e.message); continue; }
    if (f.n !== r.items.length) bad.push(f.name + ' 有 ' + r.items.length + ' 段，manifest 写的是 ' + f.n);
    r.items.forEach((it, i) => {
      const [g, k, len] = it;
      if (g !== 'f' && g !== 'm') { bad.push(f.name + ' 第 ' + i + ' 段的声音是 ' + g); return; }
      if (seen[g].has(k)) bad.push(f.name + '：' + g + '/' + k + ' 重复了');
      seen[g].add(k); n[g]++;
      const a = r.at[i];
      if (len < 4 || data.toString('latin1', a, a + 4) !== 'OggS') bad.push(f.name + '：' + g + '/' + k + ' 不是 Ogg');
    });
    clips += r.items.length;
  }
  const vn = man.voice && man.voice.n;
  if (!vn || vn.f !== n.f || vn.m !== n.m) bad.push('voice.n 写的是 ' + JSON.stringify(vn) + '，实际 ' + JSON.stringify(n));
  if (man.voice && man.voice.fmt !== 'ogg-opus') bad.push('voice.fmt 不是 ogg-opus');
  const extra = fs.readdirSync(dir).filter(x => x !== 'manifest.json' && !names.has(x));
  if (extra.length) bad.push('目录里多了 manifest 没写的文件：' + extra.join(', '));
  return { dir, bad, clips, bytes, man };
}

function find(dir, depth) {
  if (fs.existsSync(path.join(dir, 'manifest.json'))) return [dir];
  if (!depth) return [];
  return fs.readdirSync(dir).map(x => path.join(dir, x)).filter(p => fs.statSync(p).isDirectory()).sort().flatMap(p => find(p, depth - 1));
}

function check(dir) {
  const out = find(dir, 2).map(checkVersion);
  const bad = [];
  const cf = path.join(dir, 'catalog.json');
  if (fs.existsSync(cf)) {
    let cat = null;
    try { cat = JSON.parse(fs.readFileSync(cf, 'utf8')); } catch (e) { bad.push('catalog.json 读不出来'); }
    if (cat) {
      if (cat.fmt !== 1 || !cat.packs) bad.push('catalog.json 的 fmt / packs 不对');
      for (const [l, p] of Object.entries(cat.packs || {})) {
        const v = out.find(x => x.man && x.man.lang === l && x.man.ver === p.ver);
        if (!v) { bad.push('catalog.json 里 ' + l + ' ' + p.ver + ' 没有这个版本'); continue; }
        if (p.bytes !== v.man.files.reduce((s, f) => s + f.bytes, 0)) bad.push('catalog.json 里 ' + l + ' 的 bytes 和 manifest 不一样');
        if (p.core !== v.man.files.filter(f => f.core).reduce((s, f) => s + f.bytes, 0)) bad.push('catalog.json 里 ' + l + ' 的 core 和 manifest 不一样');
      }
    }
  }
  return { versions: out, bad: bad.concat(...out.map(v => v.bad.map(b => path.relative(dir, v.dir).replace(/\\/g, '/') + '：' + b))) };
}

if (require.main === module) {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'dist', 'packs'));
  if (!fs.existsSync(dir)) { console.error('check: 找不到 ' + dir); process.exit(1); }
  const r = check(dir);
  if (!r.versions.length) { console.error('check: ' + dir + ' 里没有 manifest.json'); process.exit(1); }
  for (const v of r.versions) console.log((v.bad.length ? '✗ ' : '✓ ') + path.relative(dir, v.dir).replace(/\\/g, '/') + '：' + (v.man ? v.man.files.length : 0) + ' 个文件，' + v.clips + ' 段，' + (v.bytes / 1048576).toFixed(2) + ' MiB');
  if (r.bad.length) { console.log(r.bad.slice(0, 50).map(b => '  ✗ ' + b).join('\n') + (r.bad.length > 50 ? '\n  ……还有 ' + (r.bad.length - 50) + ' 条' : '')); process.exit(1); }
  console.log('全部对得上');
}
module.exports = { check, checkVersion };
