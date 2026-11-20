// 课程包的打包工具（tools/pack/SPEC.md §2、§3）：把一门课的配音（以后还有 course.json）打成放在网上的样子。
//
//   node tools/pack/build.js --lang en [--ver 20261120.1] [--out dist/packs] [--only N] [--bundle 字节] [--core 字节]
//       → <out>/<语言>/<版本>/manifest.json、voice-000.bin …（同一份输入、同样的参数，生成的文件逐字节一样）
//   node tools/pack/build.js --catalog [--out dist/packs]
//       → <out>/catalog.json（每门语言最新的那个版本）和 <out>/_headers（Cloudflare 静态文件的跨域和缓存设置）
//   别的语言（等课程内容那一路落地再接）：--lang ja --course <course.json> --voice <目录>
//       <目录> 和 assets/voice 一样：index.json（{ v: { f, m }, fmt, f: [key…], m: [key…] }）、f/<key>.ogg、m/<key>.ogg，
//       句子表（排先后用）放 <目录>/lines.json，或者 --lines <文件>（和 tools/voice/lines.json 一样的格式：[{ t, g, p }]）
//
// 配音按「先用到的在前」排：tools/voice/lines.json 的 p（collect.js 记的来源顺序）从小到大，一句里女声在前；
// 句子表里没有、但 index.json 里有的（以前的台词留下的）排在最后（按声音、key）。--only N 只要前 N 句（给测试做小样，不带后面那些）。
// 切包：每个包 ≤ --bundle（默认 8 MiB，Cloudflare 静态文件单个上限 25 MiB）；前 --core 字节（默认 15,000,000）是 core——
// core 和后面的不在同一个包里（在 core 的边上另起一个包），装完 core 就能开始玩。
// 版本：不给 --ver 就用今天的日期 YYYYMMDD.n（n 从 1 起，这个版本已经有了而且内容不一样就 +1）；给了 --ver、这个版本已经有了而且内容不一样就停下——
// 同一个版本的文件永远不改。dist/ 不进仓库；发布由主会话做（见 tools/pack/SPEC.md §3）。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = require(path.join(ROOT, 'packs.js'))._;
const { key: keyOf } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));

// 各门语言的名字（catalog.json 的 name：中文界面、英文界面、这门语言自己的写法）
const NAMES = {
  en: { zh: '英语', en: 'English', self: 'English' },
  zh: { zh: '中文', en: 'Chinese', self: '中文' },
  ja: { zh: '日语', en: 'Japanese', self: '日本語' },
  es: { zh: '西班牙语', en: 'Spanish', self: 'Español' },
};
const MiB = 1048576;
const DEF = { bundle: 8 * MiB, core: 15000000 };

function args(argv) {
  const o = { lang: '', ver: '', out: path.join(ROOT, 'dist', 'packs'), only: 0, bundle: DEF.bundle, core: DEF.core, catalog: false, course: '', voice: '', lines: '', quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw new Error(a + ' 后面要跟一个值'); return x; };
    if (a === '--lang') o.lang = v();
    else if (a === '--ver') o.ver = v();
    else if (a === '--out') o.out = path.resolve(v());
    else if (a === '--only') o.only = +v();
    else if (a === '--bundle') o.bundle = +v();
    else if (a === '--core') o.core = +v();
    else if (a === '--course') o.course = path.resolve(v());
    else if (a === '--voice') o.voice = path.resolve(v());
    else if (a === '--lines') o.lines = path.resolve(v());
    else if (a === '--catalog') o.catalog = true;
    else if (a === '--quiet') o.quiet = true;
    else throw new Error('不认识的参数 ' + a);
  }
  if (!Number.isInteger(o.only) || o.only < 0) throw new Error('--only 要写一个整数');
  if (!(o.bundle >= 1024 && o.bundle <= 16 * MiB)) throw new Error('--bundle 要在 1 KiB 到 16 MiB 之间（SPEC：每个配音包 ≤ 16 MiB）');
  if (!(o.core >= 0)) throw new Error('--core 要写一个字节数');
  if (o.ver && !P.okVer(o.ver)) throw new Error('--ver 要写成 YYYYMMDD.n（比如 20261120.1）');
  if (o.lang && !/^[a-z]{2,3}$/.test(o.lang)) throw new Error('--lang 要写语言代码（en、ja……）');
  return o;
}

// ---------- 排好先后的配音段：[{ g, k, file }] ----------
function clipOrder(o) {
  const vdir = o.voice || (o.lang === 'en' ? path.join(ROOT, 'assets', 'voice') : '');
  if (!vdir) throw new Error('--lang ' + o.lang + ' 要给 --voice <目录>（这门语言的配音还没接进来：等 tools/course 那一路）');
  const idxFile = path.join(vdir, 'index.json');
  if (!fs.existsSync(idxFile)) throw new Error('找不到 ' + idxFile);
  const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
  if (idx.fmt && idx.fmt !== 'ogg-opus') throw new Error('配音格式是 ' + idx.fmt + '，课程包只收 ogg-opus');
  const have = { f: new Set(idx.f || []), m: new Set(idx.m || []) };
  const linesFile = o.lines || (o.voice ? path.join(vdir, 'lines.json') : path.join(ROOT, 'tools', 'voice', 'lines.json'));
  const lines = fs.existsSync(linesFile) ? JSON.parse(fs.readFileSync(linesFile, 'utf8')) : [];
  // p 从小到大（没有 p 的老句子表：照文件里的先后），一样的按文字
  const ord = lines.map((e, i) => ({ e, p: Number.isInteger(e.p) ? e.p : 1e9 + i })).sort((a, b) => a.p - b.p || (a.e.t < b.e.t ? -1 : a.e.t > b.e.t ? 1 : 0));
  const out = [], seen = new Set();
  const push = (g, k) => {
    const id = g + '/' + k;
    if (seen.has(id) || !have[g] || !have[g].has(k)) return;
    seen.add(id);
    out.push({ g, k, file: path.join(vdir, g, k + '.ogg') });
  };
  const taken = o.only ? ord.slice(0, o.only) : ord;
  for (const { e } of taken) for (const g of ['f', 'm']) if ((e.g || []).includes(g)) push(g, keyOf(e.t));
  let orphans = 0;
  if (!o.only) for (const g of ['f', 'm']) for (const k of [...have[g]].sort()) { if (!seen.has(g + '/' + k)) { push(g, k); orphans++; } }
  return { list: out, idx, orphans, lines: taken.length };
}

// ---------- 切包 ----------
function cut(list, o) {
  const bundles = [];
  let cur = null, pos = 0;
  for (const c of list) {
    const data = fs.readFileSync(c.file);
    const core = pos < o.core;
    // 头里这一条多长：["f","key",12345],
    const hb = 10 + c.k.length + String(data.length).length;
    // 换包：放不下了（8 字节 + 头 + 各段 ≤ --bundle），或者从 core 走到了 core 外面
    if (!cur || (cur.items.length && 8 + 12 + cur.head + hb + cur.bytes + data.length > o.bundle) || cur.core !== core) {
      cur = { core, items: [], bytes: 0, head: 0 };
      bundles.push(cur);
    }
    cur.items.push({ g: c.g, k: c.k, data });
    cur.bytes += data.length;
    cur.head += hb;
    pos += data.length;
  }
  return bundles;
}

const ymd = d => '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const sameDir = (dir, files) => fs.existsSync(dir) && files.every(f => { const p = path.join(dir, f.name); return fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), Buffer.from(f.data)) === 0; }) &&
  fs.readdirSync(dir).length === files.length;

function build(o) {
  const t0 = Date.now();
  const { list, idx, orphans, lines } = clipOrder(o);
  if (!list.length) throw new Error('一段配音都没有');
  const bundles = cut(list, o);
  const files = [], entries = [];
  if (o.course) {
    const data = fs.readFileSync(o.course);
    JSON.parse(data.toString('utf8'));   // 先确认是 JSON
    files.push({ name: 'course.json', data });
    entries.push({ name: 'course.json', kind: 'course', core: true, bytes: data.length, crc: P.crcHex(data) });
  }
  bundles.forEach((b, i) => {
    const data = P.packBundle(b.items);
    if (data.length > 16 * MiB) throw new Error('voice-' + i + ' 比 16 MiB 大');
    const name = 'voice-' + String(i).padStart(3, '0') + '.bin';
    files.push({ name, data });
    entries.push({ name, kind: 'voice', core: b.core, bytes: data.length, crc: P.crcHex(data), n: b.items.length });
  });
  const nf = list.filter(c => c.g === 'f').length, nm = list.length - nf;
  const man = (ver) => ({ fmt: 1, lang: o.lang, ver, voice: { fmt: 'ogg-opus', f: (idx.v && idx.v.f) || '', m: (idx.v && idx.v.m) || '', n: { f: nf, m: nm } }, files: entries });
  // 版本：给了就用；没给就今天的日期，已经有了而且不一样就 +1
  let ver = o.ver, dir = '', all = null;
  const withMan = v => files.concat([{ name: 'manifest.json', data: Buffer.from(JSON.stringify(man(v), null, 1) + '\n') }]);
  if (ver) {
    dir = path.join(o.out, o.lang, ver); all = withMan(ver);
    if (fs.existsSync(dir) && !sameDir(dir, all)) throw new Error(dir + ' 已经有了而且内容不一样：同一个版本的文件永远不改，换一个 --ver');
  } else {
    for (let n = 1; n < 10000; n++) {
      ver = ymd(new Date()) + '.' + n; dir = path.join(o.out, o.lang, ver); all = withMan(ver);
      if (!fs.existsSync(dir) || sameDir(dir, all)) break;
    }
  }
  const same = fs.existsSync(dir) && sameDir(dir, all);
  if (!same) {
    const tmp = dir + '.part';
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    for (const f of all) fs.writeFileSync(path.join(tmp, f.name), f.data);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
  }
  const total = entries.reduce((s, e) => s + e.bytes, 0), core = entries.filter(e => e.core).reduce((s, e) => s + e.bytes, 0);
  return { dir, ver, same, entries, total, core, clips: list.length, nf, nm, orphans, lines, ms: Date.now() - t0 };
}

// ---------- catalog.json 和 _headers ----------
function catalog(o) {
  const packs = {};
  if (!fs.existsSync(o.out)) throw new Error('还没有 ' + o.out + '：先 --lang 打一门');
  for (const l of fs.readdirSync(o.out).sort()) {
    const ldir = path.join(o.out, l);
    if (!/^[a-z]{2,3}$/.test(l) || !fs.statSync(ldir).isDirectory()) continue;
    const vers = fs.readdirSync(ldir).filter(v => P.okVer(v) && fs.existsSync(path.join(ldir, v, 'manifest.json'))).sort(P.verCmp);
    if (!vers.length) continue;
    const ver = vers[vers.length - 1], man = JSON.parse(fs.readFileSync(path.join(ldir, ver, 'manifest.json'), 'utf8'));
    packs[l] = { ver, name: NAMES[l] || { zh: l, en: l, self: l }, bytes: man.files.reduce((s, f) => s + f.bytes, 0), core: man.files.filter(f => f.core).reduce((s, f) => s + f.bytes, 0), course: man.files.some(f => f.kind === 'course') };
  }
  const cat = { fmt: 1, packs };
  fs.writeFileSync(path.join(o.out, 'catalog.json'), JSON.stringify(cat, null, 1) + '\n');
  // Cloudflare 的 _headers：同一个头写两遍会用逗号连起来，所以每条路径的 Cache-Control 只写一处
  const H = ['/*', '  Access-Control-Allow-Origin: *', '', '/catalog.json', '  Cache-Control: public, max-age=300', ''];
  for (const l of Object.keys(packs)) H.push('/' + l + '/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  fs.writeFileSync(path.join(o.out, '_headers'), H.join('\n'));
  return cat;
}

const mib = n => (n / MiB).toFixed(2) + ' MiB';
if (require.main === module) {
  try {
    const o = args(process.argv.slice(2));
    if (o.catalog && !o.lang) {
      const cat = catalog(o);
      console.log('catalog: ' + Object.entries(cat.packs).map(([l, p]) => l + ' ' + p.ver + '（' + mib(p.bytes) + '，core ' + mib(p.core) + '）').join('；') + ' → ' + path.relative(ROOT, path.join(o.out, 'catalog.json')).replace(/\\/g, '/'));
    } else {
      if (!o.lang) throw new Error('要写 --lang <语言> 或者 --catalog');
      const r = build(o);
      if (!o.quiet) {
        console.log('pack ' + o.lang + ' ' + r.ver + (r.same ? '（已经有了，内容一样，没动）' : '') + ' → ' + path.relative(ROOT, r.dir).replace(/\\/g, '/'));
        console.log('  ' + r.lines + ' 句 → ' + r.clips + ' 段（女声 ' + r.nf + '、男声 ' + r.nm + (r.orphans ? '；句子表里没有的旧配音 ' + r.orphans + ' 段排在最后' : '') + '）');
        for (const e of r.entries) console.log('  ' + e.name.padEnd(14) + String(e.bytes).padStart(10) + ' 字节 ' + mib(e.bytes).padStart(10) + (e.core ? '  core' : '') + (e.n != null ? '  ' + e.n + ' 段' : '') + '  crc ' + e.crc);
        console.log('  一共 ' + r.entries.length + ' 个文件 ' + mib(r.total) + '，core ' + mib(r.core) + '，用了 ' + (r.ms / 1000).toFixed(1) + ' 秒');
      }
      if (o.catalog) catalog(o);
    }
  } catch (e) { console.error('pack: ' + e.message); process.exit(1); }
}
module.exports = { args, build, catalog, clipOrder, cut, NAMES, DEF };
