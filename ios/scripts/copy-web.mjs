#!/usr/bin/env node
// 把游戏网页复制进 ios/www（只拿运行时要的文件）：和安卓 android/app/build.gradle 的 copyWeb 是同一份白名单、同样的销售版换法
// （tests/ios.test.js 核对两边的名单一样）。Windows、Mac 都能跑，只用 Node 自带的模块。
// 用法：
//   node ios/scripts/copy-web.mjs                       销售版（公开发的版本，默认）→ ios/www
//   node ios/scripts/copy-web.mjs --edition family      家庭版（带保留怪兽的番外）
//   node ios/scripts/copy-web.mjs --list                只把要打包的文件名打出来（每行一个），不复制
//   node ios/scripts/copy-web.mjs --out <目录>          复制到别处
// 也可以用环境变量 ECHO_EDITION=sales|family。
// 课程包模式（环境变量 ECHO_PACKS_URL 有值，或者 --packs <地址>；tools/pack/SPEC.md §6）：配音放在网上、要学哪门语言再下载，
// 所以不复制 assets/voice/f/**、assets/voice/m/**、assets/voice/index.json（必备文件也不要它们，改成要 packs.js）。安卓这一步不变。
// 销售版：撞脸待重画的保留怪兽（tools/mon3d/lookalike.txt，和 dex.js 的 RESERVED 一致）连美术带记录都不打包——
// 先跑 node tools/build-dex.js --sales=ios/.sales-web，换上没有保留怪兽记录的 dex.js 和两个 index.json，
// 不复制它们的 assets/mon2d/<id>.webp、assets/mon3d/<id>.glb（build-dex.js 会核对 dex.js 是最新的，不是就停下）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const IOS = path.resolve(HERE, '..');

// 和 build.gradle 的 include 一字不差：根目录的 index.html、*.js、style.css，和四个文件夹
export const INCLUDE = ['index.html', '*.js', 'style.css', 'assets/**', 'vendor/**', 'isles/**', 'pages/**'];
// 销售版换掉的三个文件（从 build-dex.js --sales 生成的目录里拿）
export const SALES_SWAP = ['dex.js', 'assets/mon3d/index.json', 'assets/mon2d/index.json'];

// 课程包模式不进包的配音（packs.js 从网上下载）。安卓 android/app/build.gradle 的 PACKS_EXCLUDE 要和这里一字不差（tests/ios.test.js 核对）
export const PACKS_EXCLUDE = ['assets/voice/f/**', 'assets/voice/m/**', 'assets/voice/index.json'];
export const packsExcluded = rel => PACKS_EXCLUDE.some(p => matches(rel, p));

// Gradle 复制时默认不拿的（Ant 的默认排除里和这里有关的几样）
const skipName = n => n === '.DS_Store' || n === '.gitignore' || n === '.gitattributes' || n.startsWith('._') || n.endsWith('~');

export function matches(rel, pattern) {
  if (pattern.endsWith('/**')) return rel.startsWith(pattern.slice(0, -2));
  if (pattern.startsWith('*.')) return !rel.includes('/') && rel.endsWith(pattern.slice(1));
  return rel === pattern;
}

// 保留怪兽的 id（tools/mon3d/lookalike.txt：每行第一个词，a/b 是一家的两只；# 开头是注释）
export function reservedIds(root = ROOT) {
  const txt = fs.readFileSync(path.join(root, 'tools', 'mon3d', 'lookalike.txt'), 'utf8');
  const ids = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    for (const id of line.split(/\s+/)[0].split('/')) if (/^[a-z]+$/.test(id)) ids.push(id);
  }
  return ids;
}

// 销售版不复制的：三个要换的文件，和保留怪兽的美术
export function salesExcluded(rel, ids) {
  if (SALES_SWAP.includes(rel)) return true;
  for (const dir of ['assets/mon3d/', 'assets/mon2d/']) {
    if (!rel.startsWith(dir)) continue;
    const name = rel.slice(dir.length);
    if (name.includes('/')) continue;
    for (const id of ids) {
      if (name === id + (dir === 'assets/mon3d/' ? '.glb' : '.webp') || name.startsWith(id + '_')) return true;
    }
  }
  return false;
}

function walk(dir, rel, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipName(e.name)) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
    else if (e.isFile()) out.push(r);
  }
}

// 要打包的文件：[{ rel 包里的相对路径, src 从哪复制 }]，按路径排好。o.packs：课程包模式（配音不进包）
export function webFiles(edition, o = {}) {
  const root = o.root || ROOT, sales = edition === 'sales';
  const rels = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (skipName(e.name)) continue;
    if (e.isFile()) { if (INCLUDE.some(p => matches(e.name, p))) rels.push(e.name); }
    else if (e.isDirectory() && INCLUDE.includes(e.name + '/**')) walk(path.join(root, e.name), e.name, rels);
  }
  const ids = sales ? reservedIds(root) : [];
  const files = rels.filter(r => !(sales && salesExcluded(r, ids)) && !(o.packs && packsExcluded(r))).map(r => ({ rel: r, src: path.join(root, r) }));
  if (sales) for (const r of SALES_SWAP) files.push({ rel: r, src: path.join(o.salesDir || path.join(IOS, '.sales-web'), r) });
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return files;
}

// 销售版要的三个文件：让 tools/build-dex.js 生成（它会核对 dex.js 是不是最新的）
export function buildSalesWeb(salesDir, root = ROOT) {
  execFileSync(process.execPath, ['tools/build-dex.js', '--sales=' + salesDir], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  for (const r of SALES_SWAP) if (!fs.existsSync(path.join(salesDir, r))) throw new Error('build-dex.js --sales 没有生成 ' + r);
}

// 复制到 out：只复制变了的（大小或修改时间不一样），out 里多出来的删掉。返回 { count, bytes, copied, removed }
export function sync(files, out) {
  fs.mkdirSync(out, { recursive: true });
  const want = new Set(files.map(f => f.rel));
  let copied = 0, removed = 0, bytes = 0;
  const have = [];
  walk(out, '', have);
  for (const r of have) if (!want.has(r)) { fs.rmSync(path.join(out, r), { force: true }); removed++; }
  for (const f of files) {
    const st = fs.statSync(f.src), dst = path.join(out, f.rel);
    bytes += st.size;
    let same = false;
    try { const d = fs.statSync(dst); same = d.size === st.size && Math.abs(d.mtimeMs - st.mtimeMs) < 2000; } catch (e) { same = false; }
    if (same) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f.src, dst);
    fs.utimesSync(dst, st.atime, st.mtime);
    copied++;
  }
  // 空文件夹清掉
  const prune = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(dir, e.name));
    if (dir !== out && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  };
  prune(out);
  return { count: files.length, bytes, copied, removed };
}

// 一定要在包里的文件：老模式要配音的索引；课程包模式不要配音，要 packs.js
export function requiredFiles(packs) {
  return ['index.html', 'style.css', 'game.js', 'dex.js', 'setup.js', 'vendor/three.min.js', packs ? 'packs.js' : 'assets/voice/index.json', 'pages/privacy.html'];
}

function main(argv) {
  const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
  const edition = String(arg('edition') || process.env.ECHO_EDITION || 'sales').trim().toLowerCase();
  if (edition !== 'sales' && edition !== 'family') throw new Error('ECHO_EDITION must be family or sales (got: ' + edition + ')');
  const out = path.resolve(arg('out') || path.join(IOS, 'www'));
  const packs = !!String(arg('packs') || process.env.ECHO_PACKS_URL || '').trim();
  const salesDir = path.join(IOS, '.sales-web');
  if (edition === 'sales') buildSalesWeb(salesDir);
  const files = webFiles(edition, { salesDir, packs });
  if (argv.includes('--list')) { for (const f of files) console.log(f.rel); return; }
  for (const need of requiredFiles(packs)) {
    if (!files.some(f => f.rel === need)) throw new Error('要打包的文件里没有 ' + need + '，停下');
  }
  if (packs && files.some(f => packsExcluded(f.rel))) throw new Error('课程包模式下包里还有配音，停下');
  const r = sync(files, out);
  fs.mkdirSync(path.join(IOS, 'Generated'), { recursive: true });
  fs.writeFileSync(path.join(IOS, 'Generated', 'web-manifest.json'), JSON.stringify({ edition, packs, count: r.count, bytes: r.bytes }) + '\n');
  console.log('copy-web: ' + edition + ' → ' + path.relative(ROOT, out).replace(/\\/g, '/') + '：' + r.count + ' 个文件，' +
    (r.bytes / 1048576).toFixed(1) + ' MB（这次复制 ' + r.copied + ' 个，删掉 ' + r.removed + ' 个）' +
    (edition === 'sales' ? '；没带 ' + reservedIds().length + ' 只保留怪兽' : '') + (packs ? '；课程包模式：配音不进包' : ''));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('copy-web: ' + e.message); process.exit(1); }
}
