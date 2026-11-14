// 把美术母版发布成游戏里用的压缩资源（art/ 不进仓库，assets/ 进仓库、随网页发布）
//   art/mon3d/<id>.glb        → assets/mon3d/<id>.glb   （tools/mon3d/glbopt.mjs：减面、删多余的动作通道、贴图缩小转 WebP、meshopt 压几何和动作）
//   art/gemini/cut2/<id>.png  → assets/mon2d/<id>.webp  （256×256 透明 WebP，菜单/图鉴/队伍/跟着走的怪兽用；没有 cut2 的用 art/gemini/cut/）
//   再写 assets/mon3d/index.json、assets/mon2d/index.json（有资源的怪兽 id，排好序），monster3d.js 启动时读
// 用法：node tools/mon3d/publish.js            只处理比母版旧的（按修改时间，可以反复跑）
//       node tools/mon3d/publish.js --force    全部重做
//       node tools/mon3d/publish.js --force --3d    只把 3D 模型全部重做，2D 图标不动（改了下面的 PUB 以后这样跑一遍）
//       node tools/mon3d/publish.js flamewolf  只做这几只
//       TEX_SIZE=512 node tools/mon3d/publish.js --force    贴图固定 512（不按贴图密度自动定大小）
// 个别怪兽用别的设置：tools/mon3d/overrides.json。改设置前后用 node tools/mon3d/vdiff.js 对比画面、node tools/mon3d/fxcheck.js 在战斗里看一遍
// 需要：gltf-transform + meshoptimizer + sharp（默认 D:/Claude/tools/gltf，可用环境变量 GLTF_TRANSFORM 指到 cli.js，用它旁边的 node_modules）、python + Pillow
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC3 = path.join(ROOT, 'art', 'mon3d'), SRC2 = path.join(ROOT, 'art', 'gemini', 'cut2'), SRC2_OLD = path.join(ROOT, 'art', 'gemini', 'cut');
const OUT3 = path.join(ROOT, 'assets', 'mon3d'), OUT2 = path.join(ROOT, 'assets', 'mon2d');
const PY = process.env.PYTHON || 'python';
const args = process.argv.slice(2), force = args.includes('--force'), only3d = args.includes('--3d'), only = new Set(args.filter(a => !a.startsWith('-')));

// 只收图鉴里有的 id（防止 _sheet、临时文件混进来）
global.window = {};
require(path.join(ROOT, 'dex.js'));
const IDS = new Set(window.DEX.list.map(s => s.id));

const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const list = (dir, ext) => { try { return fs.readdirSync(dir).filter(f => f.endsWith(ext) && !f.startsWith('_')).map(f => f.slice(0, -ext.length)).filter(id => IDS.has(id)); } catch (e) { return []; } };
const want = id => !only.size || only.has(id);
const kb = n => (n / 1024).toFixed(0) + 'KB';
fs.mkdirSync(OUT3, { recursive: true });
fs.mkdirSync(OUT2, { recursive: true });

// 暂不发布 3D 的（模型太扁/多了底座/和宝可梦太像，等重新生成）：tools/mon3d/hold.txt 每行一个 id（# 后面是注释）。
// 这些怪兽游戏里用 2D 原画纸片；已经发布过的 3D 文件删掉
const HOLD = new Set((() => { try { return fs.readFileSync(path.join(__dirname, 'hold.txt'), 'utf8'); } catch (e) { return ''; } })()
  .split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean));
for (const id of HOLD) { const f = path.join(OUT3, id + '.glb'); if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('  暂停发布 3D:', id); } }

// ---------- 3D 模型 ----------
// 发布用的压缩设置（2026-11-15 重新定的，368 只从 77.7MB 降到 51.6MB；每一项的意思见 glbopt.mjs 的 DEFAULTS）：
//   dropRest / minify   动作里一直等于骨骼原位的通道删掉、JSON 去掉默认值和多余的小数位（画面不变）
//   posPack + pos 12    顶点位置 12 位、存成小整数（误差是模型大小的 1/4096）
//   q 75 + sharpYuv     贴图 WebP 质量 75 + 准确色度（细的彩色线条不发灰，和原来质量 80 差不多清楚）
//   texPx 0.7           贴图大小按贴图密度自动定：战斗里最大的特写（出招运镜、横屏、DPR 2）每个屏幕像素至少 0.7 个贴图像素，448–1024
//   simplify 0.6 …      减面：最多减到六成，误差 0.3% 以内，贴图坐标 / 法线加权（花纹多、明暗交界的地方基本不动）；留下的顶点原样不动，蒙皮不会坏
// 改这里以后：--force 全部重做，再用 vdiff.js 和现在发布的对比一遍
const PUB = { dropRest: true, minify: true, posPack: true, pos: 12, q: 75, sharpYuv: true, effort: 6, texPx: 0.7, simplify: 0.6, err: 0.003, wUV: 20, wN: 1 };
if (process.env.TEX_SIZE) { PUB.tex = +process.env.TEX_SIZE; PUB.texPx = 0; }
// 个别怪兽的设置（盖掉 PUB 里的同名项）：tools/mon3d/overrides.json。读不出来就停下，免得悄悄用错设置发布
const OVR_FILE = path.join(__dirname, 'overrides.json');
let OVR = {};
if (fs.existsSync(OVR_FILE)) {
  try { OVR = JSON.parse(fs.readFileSync(OVR_FILE, 'utf8')); } catch (e) { console.error('tools/mon3d/overrides.json 读不出来：' + e.message); process.exit(1); }
}
const ovrM = mtime(OVR_FILE);
// 神兽在战斗里站得比别的大三成，贴图按大三成算
const optsOf = id => { const o = Object.assign({}, PUB, window.DEX.byId[id] && window.DEX.byId[id].legend ? { closeup: 422 * 1.3 } : {}, OVR[id] || {}); delete o.why; return o; };
const WORKERS = Math.max(1, Math.min(8, +process.env.MON3D_JOBS || 4));   // 同时开几个进程压

let n3 = 0, skip3 = 0, bad3 = [], inB = 0, outB = 0;
const jobs3 = [];
for (const id of list(SRC3, '.glb')) {
  if (!want(id) || HOLD.has(id)) continue;
  const src = path.join(SRC3, id + '.glb'), dst = path.join(OUT3, id + '.glb');
  // Blender 可能正在写这个文件：刚改过（10 秒内）的先跳过，下次再做
  if (Date.now() - mtime(src) < 10000) { console.log('  等一下再做（刚生成）:', id); continue; }
  // 比母版新就不用做；overrides.json 里有它、而且那个文件比发布的新，也重做
  if (!force && mtime(dst) >= mtime(src) && !(OVR[id] && mtime(dst) < ovrM)) { skip3++; continue; }
  jobs3.push({ id, src, dst, opts: optsOf(id) });
}
// 分成几份，每份一个 node 进程跑 glbopt.mjs --batch（它每做完一只打印一行 JSON；先写 .tmp.glb 再改名，中途断了不会留下半个文件）
function pub3d() {
  if (!jobs3.length) return Promise.resolve();
  const n = Math.min(WORKERS, jobs3.length);
  const done = new Set();
  const one = (chunk, i) => new Promise(res => {
    const f = path.join(os.tmpdir(), 'mon3d-pub-' + process.pid + '-' + i + '.json');
    fs.writeFileSync(f, JSON.stringify(chunk));
    const p = spawn(process.execPath, [path.join(__dirname, 'glbopt.mjs'), '--batch', f], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '', err = '';
    const line = l => {
      let r; try { r = JSON.parse(l); } catch (e) { return; }
      done.add(r.id);
      if (!r.ok) { bad3.push(r.id); console.log('  ✗', r.id, r.err || ''); return; }
      const src = path.join(SRC3, r.id + '.glb');
      n3++; inB += fs.statSync(src).size; outB += r.bytes;
      console.log('  3D', r.id, kb(fs.statSync(src).size), '→', kb(r.bytes), '（' + r.tris + ' 三角形，贴图 ' + r.tex + '）');
    };
    p.stdout.on('data', d => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { line(buf.slice(0, k)); buf = buf.slice(k + 1); } });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { err += String(e.message || e); });
    p.on('close', () => {
      if (buf.trim()) line(buf);
      try { fs.unlinkSync(f); } catch (e) { /* 没有就算了 */ }
      // 进程半路挂了：没报结果的都算失败
      const lost = chunk.filter(j => !done.has(j.id));
      if (lost.length) { lost.forEach(j => bad3.push(j.id)); console.log('  ✗', lost.map(j => j.id).join(','), err.split('\n').filter(Boolean).slice(-2).join(' | ')); }
      res();
    });
  });
  return Promise.all([...Array(n)].map((_, i) => one(jobs3.filter((_, j) => j % n === i), i)));
}

pub3d().then(() => {
// ---------- 2D 图标（一次调用 python 做完所有要更新的） ----------
const jobs = [];
let skip2 = 0;
// cut2 优先；最早那 10 只样品只有 art/gemini/cut/ 的图，拿来兜底
const pngOf = {};
list(SRC2_OLD, '.png').forEach(id => { pngOf[id] = path.join(SRC2_OLD, id + '.png'); });
list(SRC2, '.png').forEach(id => { pngOf[id] = path.join(SRC2, id + '.png'); });
for (const id of Object.keys(pngOf).sort()) {
  if (!want(id) || only3d) continue;
  const src = pngOf[id], dst = path.join(OUT2, id + '.webp');
  if (Date.now() - mtime(src) < 5000) continue;
  if (!force && mtime(dst) >= mtime(src)) { skip2++; continue; }
  jobs.push([src, dst]);
}
if (jobs.length) {
  // 裁掉透明边、等比放进 256×256 正方形（脚底贴下边、左右居中），保留透明通道
  const py = [
    'import sys, json',
    'from PIL import Image',
    'for src, dst in json.load(sys.stdin):',
    '    im = Image.open(src).convert("RGBA")',
    '    bb = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()',
    '    if bb: im = im.crop(bb)',
    '    S, pad = 256, 8',
    '    k = min((S - 2 * pad) / im.width, (S - 2 * pad) / im.height)',
    '    w, h = max(1, round(im.width * k)), max(1, round(im.height * k))',
    '    im = im.resize((w, h), Image.LANCZOS)',
    '    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))',
    '    out.paste(im, ((S - w) // 2, S - pad - h))',
    '    out.save(dst, "WEBP", quality=80, method=4)',
    '    print("  2D", src.replace(chr(92), "/").split("/")[-1], "->", dst.replace(chr(92), "/").split("/")[-1])',
  ].join('\n');
  const r = spawnSync(PY, ['-c', py], { input: JSON.stringify(jobs), encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) console.log('  ✗ 2D 图标出错：', (r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | '));
}

// ---------- 索引：以 assets/ 里实际有的文件为准 ----------
const idx3 = list(OUT3, '.glb').sort(), idx2 = list(OUT2, '.webp').sort();
fs.writeFileSync(path.join(OUT3, 'index.json'), JSON.stringify(idx3) + '\n');
fs.writeFileSync(path.join(OUT2, 'index.json'), JSON.stringify(idx2) + '\n');
const tot = ids => ids.reduce((s, id) => s + fs.statSync(path.join(OUT3, id + '.glb')).size, 0);
const t3 = tot(idx3);
console.log('3D 模型：新做 ' + n3 + ' 个' + (n3 ? '（' + kb(inB) + ' → ' + kb(outB) + '）' : '') + '，已是最新 ' + skip3 + ' 个' + (bad3.length ? '，失败 ' + bad3.join(',') : '') +
  '；共 ' + idx3.length + ' 个，' + kb(t3) + (idx3.length ? '，平均 ' + kb(t3 / idx3.length) : ''));
console.log('2D 图标：' + (only3d ? '这次不处理（--3d）' : '新做 ' + jobs.length + ' 张，已是最新 ' + skip2 + ' 张') + '；共 ' + idx2.length + ' 张');
if (bad3.length) process.exitCode = 1;
}).catch(e => { console.error(e); process.exit(1); });
