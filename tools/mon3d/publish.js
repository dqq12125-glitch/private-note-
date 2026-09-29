// 把美术母版发布成游戏里用的压缩资源（art/ 不进仓库，assets/ 进仓库、随网页发布）
//   art/mon3d/<id>.glb        → assets/mon3d/<id>.glb   （gltf-transform：meshopt 压几何和动作、贴图转 WebP 1024）
//   art/gemini/cut2/<id>.png  → assets/mon2d/<id>.webp  （256×256 透明 WebP，菜单/图鉴/队伍/跟着走的怪兽用；没有 cut2 的用 art/gemini/cut/）
//   再写 assets/mon3d/index.json、assets/mon2d/index.json（有资源的怪兽 id，排好序），monster3d.js 启动时读
// 用法：node tools/mon3d/publish.js            只处理比母版旧的（按修改时间，可以反复跑）
//       node tools/mon3d/publish.js --force    全部重做
//       node tools/mon3d/publish.js flamewolf  只做这几只
// 需要：gltf-transform（默认 D:/Claude/tools/gltf，可用环境变量 GLTF_TRANSFORM 指到 cli.js）、python + Pillow
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC3 = path.join(ROOT, 'art', 'mon3d'), SRC2 = path.join(ROOT, 'art', 'gemini', 'cut2'), SRC2_OLD = path.join(ROOT, 'art', 'gemini', 'cut');
const OUT3 = path.join(ROOT, 'assets', 'mon3d'), OUT2 = path.join(ROOT, 'assets', 'mon2d');
const GT = process.env.GLTF_TRANSFORM || 'D:/Claude/tools/gltf/node_modules/@gltf-transform/cli/bin/cli.js';
const PY = process.env.PYTHON || 'python';
const TEX = process.env.TEX_SIZE || '1024';
const args = process.argv.slice(2), force = args.includes('--force'), only = new Set(args.filter(a => !a.startsWith('-')));

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
let n3 = 0, skip3 = 0, bad3 = [], inB = 0, outB = 0;
for (const id of list(SRC3, '.glb')) {
  if (!want(id) || HOLD.has(id)) continue;
  const src = path.join(SRC3, id + '.glb'), dst = path.join(OUT3, id + '.glb');
  // Blender 可能正在写这个文件：刚改过（10 秒内）的先跳过，下次再做
  if (Date.now() - mtime(src) < 10000) { console.log('  等一下再做（刚生成）:', id); continue; }
  if (!force && mtime(dst) >= mtime(src)) { skip3++; continue; }
  const tmp = dst + '.tmp.glb';
  // optimize 会做 dedup/weld/resample/prune/贴图压缩/meshopt；蒙皮和 5 个动作都保留（关掉 simplify，省不了多少还可能伤描边）
  const r = spawnSync(process.execPath, [GT, 'optimize', src, tmp, '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', TEX, '--simplify', 'false'], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(tmp)) { bad3.push(id); console.log('  ✗', id, (r.stderr || r.stdout || '').split('\n').filter(Boolean).slice(-2).join(' | ')); try { fs.unlinkSync(tmp); } catch (e) {} continue; }
  fs.renameSync(tmp, dst);
  n3++; inB += fs.statSync(src).size; outB += fs.statSync(dst).size;
  console.log('  3D', id, kb(fs.statSync(src).size), '→', kb(fs.statSync(dst).size));
}

// ---------- 2D 图标（一次调用 python 做完所有要更新的） ----------
const jobs = [];
let skip2 = 0;
// cut2 优先；最早那 10 只样品只有 art/gemini/cut/ 的图，拿来兜底
const pngOf = {};
list(SRC2_OLD, '.png').forEach(id => { pngOf[id] = path.join(SRC2_OLD, id + '.png'); });
list(SRC2, '.png').forEach(id => { pngOf[id] = path.join(SRC2, id + '.png'); });
for (const id of Object.keys(pngOf).sort()) {
  if (!want(id)) continue;
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
console.log('2D 图标：新做 ' + jobs.length + ' 张，已是最新 ' + skip2 + ' 张；共 ' + idx2.length + ' 张');
if (bad3.length) process.exitCode = 1;
