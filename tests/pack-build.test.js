// 课程包：不开浏览器的那一半（tools/pack/SPEC.md §7，几秒）：node tests/pack-build.test.js
// 1. packs.js 的纯函数：CRC-32 的已知答案、接着算；拼包 ↔ 拆包一来一回一样；坏的包（不是 EPK1、头太长、头不是 JSON、各段加起来不对）都拦下；
//    版本号比大小；课程包地址认哪些
// 2. tools/voice/lines.json：每句有来源顺序 p（0 起、不重复、连着的），排在最前面的是能力检测的句子；key 不变（文件名还是文字的哈希）
// 3. tools/pack/build.js：排序（p 小的在前、一句里女声在前、句子表外的旧配音在最后按 key、--only 只要前 N 句）、切包（不超过 --bundle、
//    core 和后面的不在一个包、core 在前）、同样的输入两次打出来逐字节一样、版本已经有了而且内容不一样就停下；
//    --catalog 写 catalog.json 和 _headers；tools/pack/check.js 认得好的、挑得出坏的（crc、少文件、多文件）
// 4. 别的语言（--course / --voice）：用假的小 course.json 和假的 .ogg 打一个包：course.json 排第一、标 core，配音按 lines.json 的 p 排，
//    check.js 认得；course.json 里 VOICE 的某一段配音没有、语言对不上、没标 core 都挑得出来
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'packs.js'));
const B = require(path.join(ROOT, 'tools', 'pack', 'build.js'));
const C = require(path.join(ROOT, 'tools', 'pack', 'check.js'));
const { key } = require(path.join(ROOT, 'tools', 'voice', 'key.js'));
let fails = 0;
const check = (ok, what, more) => { console.log((ok ? '✓ ' : '✗ ') + what + (!ok && more !== undefined ? '\n    ' + JSON.stringify(more).slice(0, 800) : '')); if (!ok) fails++; return ok; };
const throws = f => { try { f(); return ''; } catch (e) { return e.message || String(e); } };
const _ = P._;

// ---------- 1. 纯函数 ----------
check(P.on === false && Array.isArray(P.LANGS) && P.LANGS.join() === 'en', 'Node 里 require packs.js：on 是 false，只给纯函数（LANGS 现在只有 en）');
const nine = Buffer.from('123456789');
check(_.crcHex(nine) === 'cbf43926', 'CRC-32("123456789") = cbf43926（标准的已知答案）', _.crcHex(nine));
check(_.hex8(_.crc32(nine.subarray(4), _.crc32(nine.subarray(0, 4)))) === 'cbf43926', 'CRC-32 可以一块块接着算（下载时边下边算）');
check(_.crcHex(new Uint8Array(0)) === '00000000', '空的 CRC-32 = 00000000');
{
  const rnd = n => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (i * 131 + 7) & 255; return a; };
  const items = [{ g: 'f', k: 'abc', data: rnd(10) }, { g: 'm', k: 'abc', data: rnd(0) }, { g: 'f', k: 'z9', data: rnd(3000) }];
  const b = _.packBundle(items);
  const r = _.readBundle(b);
  check(String.fromCharCode(...b.subarray(0, 4)) === 'EPK1' && new DataView(b.buffer).getUint32(4, true) === b.length - 8 - 3010, '拼出来的包：开头 EPK1、头的长度小端 u32、后面是各段原样');
  check(JSON.stringify(r.items) === JSON.stringify([['f', 'abc', 10], ['m', 'abc', 0], ['f', 'z9', 3000]]) &&
    items.every((x, i) => Buffer.compare(Buffer.from(b.subarray(r.at[i], r.at[i] + x.data.length)), Buffer.from(x.data)) === 0), '拼包 ↔ 拆包一来一回一样（同一个 key 两个声音、0 字节的段也行）');
  check(!!_.readBundle(b.buffer.slice(0)) && !!_.readBundle(Buffer.from(b)), '拆包认 ArrayBuffer、Uint8Array、Node 的 Buffer');
  const bad = (name, mut) => { const c = Uint8Array.from(b); mut(c); return check(!!throws(() => _.readBundle(c)), '坏的包拦下：' + name); };
  bad('不是 EPK1', c => { c[0] = 0x50; });
  bad('头的长度比文件长', c => new DataView(c.buffer).setUint32(4, c.length, true));
  bad('头不是 JSON', c => { c[8] = 0x7b; c[9] = 0x7b; });
  check(!!throws(() => _.readBundle(b.subarray(0, b.length - 1))), '坏的包拦下：少了最后一个字节（各段加起来不等于文件长度）');
  check(!!throws(() => _.readBundle(Buffer.concat([Buffer.from(b), Buffer.from([0])]))), '坏的包拦下：多了一个字节');
  check(!!throws(() => _.readBundle(_.packBundle([{ g: 'f', k: '', data: rnd(1) }]))), '坏的包拦下：key 是空的');
  check(!!throws(() => _.readBundle(new Uint8Array(4))), '坏的包拦下：不到 8 个字节');
}
check(_.verCmp('20261120.10', '20261120.9') > 0 && _.verCmp('20261121.1', '20261120.9') > 0 && _.verCmp('20261120.1', '20261120.1') === 0 && _.verCmp('20261119.3', '20261120.1') < 0,
  '版本号按数比：20261120.10 比 .9 新，第二天的比前一天的新');
check(_.okVer('20261120.1') && !_.okVer('2026112.1') && !_.okVer('20261120') && !_.okVer('../x'), '版本号的样子：YYYYMMDD.n');
check(['https://packs.example.com', 'https://a.b.c:8443/x/y', 'http://localhost:8000/packs', 'http://127.0.0.1:5/p', '/__test/packs'].every(_.okUrl) &&
  !['http://packs.example.com', 'ftp://x', '//evil.example/x', 'javascript:alert(1)', 'https://x.example/?a=1', '/'].some(_.okUrl),
  '课程包地址：https、本机 http、同一个网站里的 /路径；http 外网、// 开头、带查询参数的不认');

// ---------- 2. lines.json 的来源顺序 p ----------
const LINES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'voice', 'lines.json'), 'utf8'));
const ps = LINES.map(e => e.p);
check(LINES.length > 10000 && ps.every(Number.isInteger) && new Set(ps).size === ps.length && Math.min(...ps) === 0 && Math.max(...ps) === ps.length - 1,
  'tools/voice/lines.json：' + LINES.length + ' 句都有 p，0 到 ' + (ps.length - 1) + ' 不重复');
check(LINES.every(e => Object.keys(e).join() === 't,g,p' && Array.isArray(e.g) && e.g.length), '每句还是 { t, g } 加一个 p（gen.py 只读 t、g）');
{
  const pd = require(path.join(ROOT, 'placement-data.js')).en.items;
  const place = new Set(pd.flatMap(it => it.skill === 'listen' ? (it.audio || []).map(a => a.text) : it.skill === 'vocab' && it.mode === 'listen' ? [it.word] : []));
  const first = LINES.slice().sort((a, b) => a.p - b.p);
  const firstNonPlace = first.findIndex(e => !place.has(e.t));
  check(firstNonPlace > 100 && first.slice(0, firstNonPlace).every(e => place.has(e.t)), '排在最前面的是能力检测的句子（' + firstNonPlace + ' 句），然后才是别的', first.slice(0, 3).map(e => e.t));
}

// ---------- 3. 打包工具 ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-pack-'));
const args = a => B.args(a.concat(['--out', tmp, '--quiet']));
try {
  // 排序
  const ord = B.clipOrder(args(['--lang', 'en']));
  const byP = LINES.slice().sort((a, b) => a.p - b.p);
  const expect = [];
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'index.json'), 'utf8'));
  const have = { f: new Set(idx.f), m: new Set(idx.m) };
  for (const e of byP) for (const g of ['f', 'm']) if (e.g.includes(g) && have[g].has(key(e.t)) && !expect.includes(g + '/' + key(e.t))) expect.push(g + '/' + key(e.t));
  const got = ord.list.map(c => c.g + '/' + c.k);
  check(JSON.stringify(got.slice(0, expect.length)) === JSON.stringify(expect), '配音的先后：按 p 从小到大，一句里女声在前（' + expect.length + ' 段）');
  const tail = got.slice(expect.length);
  check(tail.length === ord.orphans && tail.length === idx.f.length + idx.m.length - expect.length && JSON.stringify(tail) === JSON.stringify(tail.slice().sort((a, b) => (a < b ? -1 : 1))),
    '句子表里没有的旧配音排在最后、按声音和 key 排（' + tail.length + ' 段）');
  check(new Set(got).size === got.length && got.length === idx.f.length + idx.m.length, '每段只出现一次，index.json 里的都在（' + got.length + ' 段）');
  const o12 = B.clipOrder(args(['--lang', 'en', '--only', '12']));
  check(o12.lines === 12 && o12.orphans === 0 && JSON.stringify(o12.list.map(c => c.g + '/' + c.k)) === JSON.stringify(got.slice(0, o12.list.length)), '--only 12：只要前 12 句（不带句子表外的）');
  check(!!throws(() => B.clipOrder(args(['--lang', 'ja']))), '别的语言没给 --voice：说清楚还没接进来，不乱打');

  // 切包
  const a1 = args(['--lang', 'en', '--ver', '20261120.1', '--only', '60', '--bundle', '30000', '--core', '70000']);
  const r1 = B.build(a1);
  const man = JSON.parse(fs.readFileSync(path.join(r1.dir, 'manifest.json'), 'utf8'));
  check(man.fmt === 1 && man.lang === 'en' && man.ver === '20261120.1' && man.voice.fmt === 'ogg-opus' && man.voice.f === 'af_heart' && man.voice.m === 'am_michael' &&
    man.voice.n.f + man.voice.n.m === r1.clips, 'manifest.json：fmt、语言、版本、声音（女 af_heart / 男 am_michael）和各几段');
  check(man.files.length >= 3 && man.files.every(f => f.bytes <= 30000 || f.n === 1), '每个包不超过 --bundle（一段本身比它大的除外）', man.files.map(f => f.bytes));
  const firstNon = man.files.findIndex(f => !f.core);
  check(firstNon > 0 && man.files.slice(firstNon).every(f => !f.core) && man.files.slice(0, firstNon).reduce((s, f) => s + f.bytes, 0) >= 70000 - 30000,
    'core 的包在前面，后面的都不是 core；core 大约是 --core 那么多', man.files.map(f => f.core));
  let pos = 0, cutOk = true;
  for (const f of man.files) { const r = _.readBundle(fs.readFileSync(path.join(r1.dir, f.name))); const seg = r.items.reduce((s, x) => s + x[2], 0); if (f.core !== pos < 70000) cutOk = false; pos += seg; }
  check(cutOk, 'core 的边上另起一个包（core 和后面的不在同一个包里）');
  const flat = man.files.flatMap(f => _.readBundle(fs.readFileSync(path.join(r1.dir, f.name))).items.map(x => x[0] + '/' + x[1]));
  check(JSON.stringify(flat) === JSON.stringify(got.slice(0, flat.length)), '包里的段按排好的先后');
  {
    const f0 = man.files[0], b0 = fs.readFileSync(path.join(r1.dir, f0.name)), rr = _.readBundle(b0);
    const [g, k, len] = rr.items[0];
    check(Buffer.compare(b0.subarray(rr.at[0], rr.at[0] + len), fs.readFileSync(path.join(ROOT, 'assets', 'voice', g, k + '.ogg'))) === 0, '包里的一段和原来的 .ogg 一字不差');
  }
  // 一样的输入 → 一样的文件
  const before = man.files.map(f => fs.readFileSync(path.join(r1.dir, f.name)).toString('base64')).join();
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-pack-'));
  const r2 = B.build(B.args(['--lang', 'en', '--ver', '20261120.1', '--only', '60', '--bundle', '30000', '--core', '70000', '--out', tmp2, '--quiet']));
  const after = man.files.map(f => fs.readFileSync(path.join(r2.dir, f.name)).toString('base64')).join();
  check(before === after && fs.readFileSync(path.join(r1.dir, 'manifest.json'), 'utf8') === fs.readFileSync(path.join(r2.dir, 'manifest.json'), 'utf8'), '同一份输入打两次：每个文件逐字节一样');
  const r3 = B.build(a1);
  check(r3.same === true, '同一个版本再打一次、内容一样：不动（不报错）');
  check(/已经有了而且内容不一样/.test(throws(() => B.build(args(['--lang', 'en', '--ver', '20261120.1', '--only', '61', '--bundle', '30000', '--core', '70000'])))),
    '同一个版本、内容不一样：停下（同一个版本的文件永远不改）');
  const r4 = B.build(args(['--lang', 'en', '--ver', '20261120.2', '--only', '61', '--bundle', '30000', '--core', '70000']));
  fs.rmSync(tmp2, { recursive: true, force: true });

  // catalog.json、_headers
  const cat = B.catalog(args(['--catalog']));
  const ce = cat.packs.en;
  check(cat.fmt === 1 && ce && ce.ver === '20261120.2' && ce.name.zh === '英语' && ce.name.self === 'English' && ce.course === false &&
    ce.bytes === r4.total && ce.core === r4.core, 'catalog.json：每门语言最新的版本（.2 比 .1 新）、名字、大小、core 多大、有没有课程内容', ce);
  const hd = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
  check(/^\/\*\n  Access-Control-Allow-Origin: \*$/m.test(hd) && /^\/catalog\.json\n  Cache-Control: public, max-age=300$/m.test(hd) && /^\/en\/\*\n  Cache-Control: public, max-age=31536000, immutable$/m.test(hd) &&
    (hd.match(/Cache-Control/g) || []).length === 2, '_headers：跨域都放开、catalog 5 分钟、带版本的路径一年不变（每条路径只写一处 Cache-Control）');

  // check.js
  const ok = C.check(tmp);
  check(ok.versions.length === 2 && !ok.bad.length, 'tools/pack/check.js：两个版本、catalog 都对得上', ok.bad);
  const victim = path.join(r1.dir, man.files[1].name), keep = fs.readFileSync(victim);
  const broke = Buffer.from(keep); broke[broke.length - 1] ^= 0xff; fs.writeFileSync(victim, broke);
  check(C.check(tmp).bad.some(b => /crc/.test(b)), 'check.js：改了一个字节，crc 对不上');
  fs.writeFileSync(victim, keep.subarray(0, keep.length - 10));
  check(C.check(tmp).bad.some(b => /大小/.test(b)), 'check.js：少了 10 个字节，大小对不上');
  fs.writeFileSync(victim, keep);
  fs.writeFileSync(path.join(r1.dir, 'extra.bin'), 'x');
  check(C.check(tmp).bad.some(b => /多了/.test(b)), 'check.js：目录里多了 manifest 没写的文件');
  fs.rmSync(path.join(r1.dir, 'extra.bin'));
  check(!C.check(tmp).bad.length, 'check.js：改回去又对得上');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------- 3b. 别的语言：--course / --voice ----------
{
  const t3 = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-pack-es-'));
  try {
    const fake = (n, tag) => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(n, tag)]);
    const vdir = path.join(t3, 'voice'), cdir = path.join(t3, 'course'), out = path.join(t3, 'out');
    for (const g of ['f', 'm']) fs.mkdirSync(path.join(vdir, g), { recursive: true });
    fs.mkdirSync(cdir, { recursive: true });
    // p 故意和写的先后相反：先写的 p 大
    const VOICE = [{ t: '¿Cómo te llamas?', g: ['f', 'm'], p: 2 }, { t: 'hola', g: ['f'], p: 1 }, { t: 'La casa', g: ['m'], p: 0 }];
    for (const e of VOICE) for (const g of e.g) fs.writeFileSync(path.join(vdir, g, key(e.t) + '.ogg'), fake(100 + e.p, e.p + 1));
    const idx = { v: { f: 'ef_dora', m: 'em_alex' }, fmt: 'ogg-opus', lang: 'es', f: VOICE.filter(e => e.g.includes('f')).map(e => key(e.t)).sort(), m: VOICE.filter(e => e.g.includes('m')).map(e => key(e.t)).sort() };
    fs.writeFileSync(path.join(vdir, 'index.json'), JSON.stringify(idx));
    fs.writeFileSync(path.join(vdir, 'lines.json'), JSON.stringify(VOICE));
    const course = { fmt: 1, lang: 'es', name: { zh: '西班牙语', en: 'Spanish', self: 'Español' }, WORLDS: [], SCENES: [], BOOKS: { list: [] }, TALK: [], MAP: {}, VOICE };
    const cfile = path.join(cdir, 'course.json');
    fs.writeFileSync(cfile, JSON.stringify(course));
    const mk = (extra, ver) => B.build(B.args(['--lang', 'es', '--ver', ver || '20261120.1', '--course', cfile, '--voice', vdir, '--out', out, '--quiet'].concat(extra || [])));
    const r = mk();
    const man = JSON.parse(fs.readFileSync(path.join(r.dir, 'manifest.json'), 'utf8'));
    check(man.lang === 'es' && man.files[0].name === 'course.json' && man.files[0].kind === 'course' && man.files[0].core === true && man.files[0].bytes === fs.statSync(cfile).size &&
      man.files[0].crc === _.crcHex(fs.readFileSync(cfile)), '别的语言：course.json 排第一、标 core、大小和 crc 对');
    check(man.voice.f === 'ef_dora' && man.voice.m === 'em_alex' && man.voice.n.f === 2 && man.voice.n.m === 2, 'manifest 的声音是 index.json 里的（ef_dora / em_alex），女声 2 段、男声 2 段');
    const items = _.readBundle(fs.readFileSync(path.join(r.dir, man.files[1].name))).items.map(x => x[0] + '/' + x[1]);
    check(JSON.stringify(items) === JSON.stringify(['m/' + key('La casa'), 'f/' + key('hola'), 'f/' + key('¿Cómo te llamas?'), 'm/' + key('¿Cómo te llamas?')]), '配音按 lines.json 的 p 排（不管文件里写的先后），一句里女声在前', items);
    check(!C.check(out).bad.length, 'check.js：这个别的语言的包对得上（课程内容 fmt / 语言 / VOICE 都有配音）', C.check(out).bad);
    B.catalog(B.args(['--catalog', '--out', out]));
    const cat = JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8')).packs.es;
    check(cat && cat.course === true && cat.name.self === 'Español' && cat.core === cat.bytes, 'catalog.json：es 有课程内容（course: true），都在 core 里（太小，不到 --core）', cat);
    // 配音目录里没有 lines.json：句子表取 course.json 的 VOICE，先后一样
    fs.rmSync(path.join(vdir, 'lines.json'));
    const r5 = mk([], '20261120.2'), items5 = _.readBundle(fs.readFileSync(path.join(r5.dir, 'voice-000.bin'))).items.map(x => x[0] + '/' + x[1]);
    check(r5.lines === 3 && JSON.stringify(items5) === JSON.stringify(items), '没有 lines.json 时用 --course 里的 VOICE 排先后（结果一样）', items5);
    // 挑得出坏的
    const badCourse = (what, mut, re) => {
      const c2 = JSON.parse(JSON.stringify(course)); mut(c2);
      const f2 = path.join(cdir, 'course2.json'); fs.writeFileSync(f2, JSON.stringify(c2));
      const out2 = path.join(t3, 'out-' + what.length);
      B.build(B.args(['--lang', 'es', '--ver', '20261120.1', '--course', f2, '--voice', vdir, '--out', out2, '--quiet']));
      const bad = C.check(out2).bad;
      return check(bad.some(b => re.test(b)), 'check.js 挑得出：' + what, bad);
    };
    badCourse('course.json 的语言和 manifest 对不上', c => { c.lang = 'ja'; }, /语言/);
    badCourse('VOICE 名单里有一句配音包里没有', c => { c.VOICE.push({ t: 'no existe', g: ['f'], p: 3 }); }, /VOICE 名单里有 1 段/);
    badCourse('course.json 缺 WORLDS', c => { delete c.WORLDS; }, /WORLDS/);
    // 没标 core：把 manifest 里 course.json 的 core 改成 false（crc 不变）
    const mf = path.join(r.dir, 'manifest.json'), m2 = JSON.parse(fs.readFileSync(mf, 'utf8'));
    m2.files[0].core = false; fs.writeFileSync(mf, JSON.stringify(m2));
    check(C.check(out).bad.some(b => /core/.test(b)), 'check.js 挑得出：course.json 没标 core');
  } finally { fs.rmSync(t3, { recursive: true, force: true }); }
}

// ---------- 4. 真的英语课程包（有 dist/packs 才看：tools/pack/build.js --lang en 打过的） ----------
{
  const d = path.join(ROOT, 'dist', 'packs');
  if (fs.existsSync(path.join(d, 'catalog.json'))) {
    const r = C.check(d);
    check(!r.bad.length && r.versions.some(v => v.man.lang === 'en'), 'dist/packs 里打好的课程包对得上（' + r.versions.map(v => v.man.lang + ' ' + v.man.ver + ' ' + v.clips + ' 段').join('，') + '）', r.bad.slice(0, 5));
    check(r.versions.every(v => v.man.files.every(f => f.bytes <= 16 * 1048576)), '每个配音包 ≤ 16 MiB');
  } else console.log('- 没有 dist/packs：跳过真的英语课程包（node tools/pack/build.js --lang en 打一个就会看）');
}
// 小样（ios/www-test/packs，iPhone 的自测页用）：对得上
{
  const d = path.join(ROOT, 'ios', 'www-test', 'packs');
  const r = C.check(d);
  check(r.versions.length === 1 && !r.bad.length && fs.existsSync(path.join(d, 'catalog.json')), 'ios/www-test/packs（iPhone 自测页的小样）对得上', r.bad);
}

console.log(fails ? '\n✗ ' + fails + ' 项没过' : '\n全部通过');
process.exit(fails ? 1 : 0);
