// 把一只母版模型（art/mon3d/<id>.glb）压成发布版（assets/mon3d/<id>.glb）。publish.js 用它；也可以单独跑：
//   node tools/mon3d/glbopt.mjs <src.glb> <dst.glb> [--tex 768] [--q 80] [--simplify 0.6] [--err 0.003] [--pos 12 --posPack true] ...
//   node tools/mon3d/glbopt.mjs --batch <jobs.json>      jobs.json = [{ id, src, dst, opts }]，一条一行地打印结果（publish.js 分 4 路跑）
// 做的事（按顺序）：去重 → 压平节点层级 → 合并相同顶点 → 减面（可选；meshoptimizer，带法线/贴图坐标权重，只删顶点不挪顶点，所以蒙皮不会坏）
//   → 动作去掉重复的关键帧 → 删掉「一直等于骨骼原位」的动作通道（JSON 小一大截，播放时结果一样）→ 清理
//   → 贴图缩小转 WebP → 量化 + meshopt 压缩（EXT_meshopt_compression，游戏里的 three.js 只带 meshopt 解码器，不能用 Draco）
//   → JSON 瘦身
// 需要：gltf-transform + meshoptimizer + sharp（默认在 D:/Claude/tools/gltf/node_modules，环境变量 GLTF_TRANSFORM 指到 cli.js 就用它旁边的）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const GT = process.env.GLTF_TRANSFORM || 'D:/Claude/tools/gltf/node_modules/@gltf-transform/cli/bin/cli.js';
const NM = path.resolve(GT, '..', '..', '..', '..');   // …/node_modules
const req = createRequire(path.join(NM, '_.js'));
const imp = p => import(pathToFileURL(path.join(NM, p)).href);

// 默认值 = 老做法（gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify false），
// 压出来和以前一样大。发布用的那一套写在 publish.js 的 PUB 里
export const DEFAULTS = {
  tex: 1024,        // 贴图最长边（上限）
  texPx: 0,         // > 0：贴图大小按这只模型的贴图密度自动定——战斗特写里每个屏幕像素至少这么多个贴图像素（见 textureXform）；0 = 固定用 tex
  closeup: 422,     // 战斗里最大的特写：模型的一个单位长度（模型身高 ≈ 1）在屏幕上占多少像素（横屏、DPR 2、出招运镜）；神兽在场上更大，publish.js 给它乘 1.3
  texMin: 448,      // 自动定大小时的下限
  q: 80,            // WebP 质量
  effort: 4,        // WebP 压缩用力程度（0–6，越大越慢越小）
  sharpYuv: false,  // WebP 用更准的色度采样（细的彩色线条不发灰，文件略大）
  kernel: 'lanczos3',   // 贴图缩小用的滤镜
  simplify: 1,      // 留下多少三角形（1 = 不减面）
  err: 0.003,       // 减面允许的误差（占模型大小的比例）；到了这个误差就停，不硬凑到 simplify 的比例
  wN: 0.5,          // 减面时法线的权重（保住明暗交界和描边）
  wUV: 1.0,         // 减面时贴图坐标的权重（保住花纹不滑动）
  pos: 14, uv: 12, nrm: 8, wgt: 8,   // 量化位数：位置 / 贴图坐标 / 法线 / 蒙皮权重
  posPack: false,   // 位置按 pos 位存成「小整数」（缩放并进骨骼的逆绑定矩阵），meshopt 才压得动；false = gltf-transform 原来的做法（位数调低也不变小）
  animTol: 1e-4,    // 动作去重复关键帧的容差
  dropRest: false,  // 删掉一直等于骨骼原位的动作通道
  minify: false,    // 把 JSON 里的默认值、多余的小数位去掉
  level: 'high',    // meshopt 压缩档（high：法线八面体、动作四元数/指数滤波）
};

let libP = null;
function lib() {
  return libP || (libP = (async () => {
    const core = await imp('@gltf-transform/core/dist/index.js');
    const ext = await imp('@gltf-transform/extensions/dist/index.js');
    const fn = await imp('@gltf-transform/functions/dist/index.js');
    const mo = await imp('meshoptimizer/index.js');
    const sharp = req('sharp');
    await Promise.all([mo.MeshoptEncoder.ready, mo.MeshoptDecoder.ready, mo.MeshoptSimplifier.ready]);
    const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': mo.MeshoptEncoder, 'meshopt.decoder': mo.MeshoptDecoder });
    return { core, ext, fn, mo, sharp, io };
  })());
}

// ---------- 减面 ----------
// 用 meshoptimizer 的 simplifyWithAttributes：只删顶点、不挪顶点（留下的顶点位置、法线、贴图坐标、骨骼权重都是原来的），
// 贴图接缝两边的顶点成对处理，不会把接缝撕开
function simplifyXform(L, o) {
  const { Primitive } = L.core, S = L.mo.MeshoptSimplifier;
  return async doc => {
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== Primitive.Mode.TRIANGLES || !prim.getIndices()) continue;
      const posA = prim.getAttribute('POSITION'), nrmA = prim.getAttribute('NORMAL'), uvA = prim.getAttribute('TEXCOORD_0');
      const n = posA.getCount();
      const pos = posA.getArray() instanceof Float32Array ? posA.getArray() : Float32Array.from(posA.getArray());
      const idx = Uint32Array.from(prim.getIndices().getArray());
      const target = Math.floor(o.simplify * idx.length / 3) * 3;
      let out;
      if (nrmA && uvA && (o.wN > 0 || o.wUV > 0)) {
        const at = new Float32Array(n * 5), el = [];
        for (let i = 0; i < n; i++) { nrmA.getElement(i, el); at[i * 5] = el[0]; at[i * 5 + 1] = el[1]; at[i * 5 + 2] = el[2]; uvA.getElement(i, el); at[i * 5 + 3] = el[0]; at[i * 5 + 4] = el[1]; }
        out = S.simplifyWithAttributes(idx, pos, 3, at, 5, [o.wN, o.wN, o.wN, o.wUV, o.wUV], null, target, o.err, []);
      } else out = S.simplify(idx, pos, 3, target, o.err, []);
      const srcIdx = prim.getIndices();
      prim.setIndices(doc.createAccessor().setType('SCALAR').setBuffer(srcIdx.getBuffer()).setArray(out[0]));
      if (srcIdx.listParents().length === 1) srcIdx.dispose();
      L.fn.compactPrimitive(prim);
      if (prim.getAttribute('POSITION').getCount() <= 65534) prim.getIndices().setArray(new Uint16Array(prim.getIndices().getArray()));
    }
  };
}

// ---------- 删掉「一直等于骨骼原位」的动作通道 ----------
// Blender 导出时每根骨骼每个动作都有 位置/旋转/缩放 三个通道，大多数从头到尾就是骨骼原来的值。
// three.js 的 AnimationMixer 对没有通道的属性用原值，所以删掉以后播出来一样，文件里的 JSON 少一大半、每帧要算的轨道也少了
function dropRestXform() {
  return async doc => {
    const EPS = 1e-5;
    for (const anim of doc.getRoot().listAnimations()) {
      for (const ch of anim.listChannels()) {
        const node = ch.getTargetNode(), s = ch.getSampler(), p = ch.getTargetPath();
        if (!node || !s) continue;
        const rest = p === 'translation' ? node.getTranslation() : p === 'rotation' ? node.getRotation() : p === 'scale' ? node.getScale() : null;
        if (!rest) continue;
        const out = s.getOutput(), n = out.getCount(), el = [];
        let same = true;
        for (let i = 0; i < n && same; i++) {
          out.getElement(i, el);
          // 四元数 q 和 -q 是同一个旋转
          const sign = p === 'rotation' && (el[0] * rest[0] + el[1] * rest[1] + el[2] * rest[2] + el[3] * rest[3]) < 0 ? -1 : 1;
          for (let k = 0; k < rest.length; k++) if (Math.abs(el[k] * sign - rest[k]) > EPS) { same = false; break; }
        }
        if (!same) continue;
        ch.dispose();
        if (s.listParents().filter(x => x.propertyType === 'AnimationChannel').length === 0) s.dispose();
      }
    }
  };
}

// ---------- 贴图：缩小、转 WebP ----------
// 贴图密度：每个三角形「贴图上的面积 / 模型上的面积」开方，按面积取中位数 = 模型上一个单位长度对应贴图边长的几分之几。
// Hunyuan3D 的贴图有的铺得满、有的碎，同样 1024 的图画到屏幕上清楚程度差一倍；按密度定大小，每只在特写里一样清楚
function uvDensity(doc) {
  const d = []; let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), U = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
    if (!P || !U || !I) continue;
    const a = [], b = [], c = [], ua = [], ub = [], uc = [];
    for (let t = 0, n = I.getCount(); t + 2 < n; t += 3) {
      const i = I.getScalar(t), j = I.getScalar(t + 1), k = I.getScalar(t + 2);
      P.getElement(i, a); P.getElement(j, b); P.getElement(k, c); U.getElement(i, ua); U.getElement(j, ub); U.getElement(k, uc);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const A = .5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      const T = .5 * Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (uc[0] - ua[0]) * (ub[1] - ua[1]));
      if (A > 0) { d.push([Math.sqrt(T / A), A]); total += A; }
    }
  }
  if (!d.length) return 0;
  d.sort((x, y) => x[0] - y[0]);
  let s = 0;
  for (const [v, A] of d) { s += A; if (s >= total / 2) return v; }
  return d[d.length - 1][0];
}
function textureXform(L, o, info) {
  return async doc => {
    let any = false, cap = o.tex;
    if (o.texPx > 0) {
      const D = uvDensity(doc);
      if (D > 0) cap = Math.min(o.tex, Math.max(o.texMin, Math.ceil(o.texPx * o.closeup / D / 64) * 64));
    }
    for (const tex of doc.getRoot().listTextures()) {
      const img = tex.getImage(); if (!img) continue;
      const meta = await L.sharp(img).metadata();
      const k = Math.min(1, cap / Math.max(meta.width, meta.height));
      info.tex = Math.round(Math.max(meta.width, meta.height) * k);
      let p = L.sharp(img);
      if (k < 1) p = p.resize(Math.max(1, Math.round(meta.width * k)), Math.max(1, Math.round(meta.height * k)), { fit: 'fill', kernel: o.kernel });
      const buf = await p.webp({ quality: o.q, effort: o.effort, smartSubsample: !!o.sharpYuv }).toBuffer();
      tex.setImage(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)).setMimeType('image/webp');
      any = true;
    }
    if (any) doc.createExtension(L.ext.EXTTextureWebP).setRequired(true);
  };
}

// ---------- 位置量化成小整数 ----------
// gltf-transform 的 quantize 把位置铺满 16 位（低位是高位的重复），位数调低文件也不变小。
// 这里按 bits 位取整后原样存成 Int16（数值只有 ±2^(bits-1)），再把「放大回去」的倍数乘进每根骨骼的逆绑定矩阵，
// 画出来的位置一样（误差 ≤ 模型大小的 1/2^bits），meshopt 压出来小不少。只处理蒙皮的网格；别的情况返回 false，交回 gltf-transform
function packPositions(L, doc, bits) {
  const { Node, Primitive } = L.core;
  const meshes = doc.getRoot().listMeshes();
  const nodesOf = mesh => mesh.listParents().filter(p => p instanceof Node);
  for (const mesh of meshes) {
    const nodes = nodesOf(mesh);
    if (!nodes.length || !nodes.every(n => n.getSkin())) return false;
    if (mesh.listPrimitives().some(p => p.listTargets().length || !(p.getAttribute('POSITION').getArray() instanceof Float32Array))) return false;
  }
  // 一副骨骼只能配一种缩放：两个网格共用一副骨骼的情况不处理
  const skinUse = new Map();
  for (const mesh of meshes) for (const n of nodesOf(mesh)) { const k = n.getSkin(); if (skinUse.has(k) && skinUse.get(k) !== mesh) return false; skinUse.set(k, mesh); }
  for (const mesh of meshes) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], el = [];
    for (const prim of mesh.listPrimitives()) { const a = prim.getAttribute('POSITION'); for (let i = 0, n = a.getCount(); i < n; i++) { a.getElement(i, el); for (let k = 0; k < 3; k++) { if (el[k] < min[k]) min[k] = el[k]; if (el[k] > max[k]) max[k] = el[k]; } } }
    const off = [0, 1, 2].map(k => (min[k] + max[k]) / 2), half = Math.max(...[0, 1, 2].map(k => (max[k] - min[k]) / 2)) || 1;
    const Q = Math.pow(2, bits - 1) - 1;
    const done = new Map();
    for (const prim of mesh.listPrimitives()) {
      const src = prim.getAttribute('POSITION');
      let dst = done.get(src);
      if (!dst) {
        const n = src.getCount(), arr = new Int16Array(n * 3);
        for (let i = 0; i < n; i++) { src.getElement(i, el); for (let k = 0; k < 3; k++) arr[i * 3 + k] = Math.round((el[k] - off[k]) / half * Q); }
        dst = src.clone().setArray(arr).setNormalized(true).setSparse(false);
        done.set(src, dst);
      }
      prim.setAttribute('POSITION', dst);
    }
    for (const src of done.keys()) if (src.listParents().filter(p => p instanceof Primitive).length === 0) src.dispose();
    // 读出来的值是 整数/32767，真实位置 = off + sc × 读出来的值：逆绑定矩阵右乘「平移(off) × 缩放(sc)」
    const sc = half * 32767 / Q;
    for (const skin of new Set(nodesOf(mesh).map(n => n.getSkin()))) {
      const old = skin.getInverseBindMatrices(), ibm = old.clone(), m = [];
      for (let i = 0, n = ibm.getCount(); i < n; i++) {
        ibm.getElement(i, m);   // 列主序 4×4
        const o = m.slice();
        for (let r = 0; r < 4; r++) {
          o[r] = m[r] * sc; o[4 + r] = m[4 + r] * sc; o[8 + r] = m[8 + r] * sc;
          o[12 + r] = m[r] * off[0] + m[4 + r] * off[1] + m[8 + r] * off[2] + m[12 + r];
        }
        ibm.setElement(i, o);
      }
      skin.setInverseBindMatrices(ibm);
      if (old.listParents().length <= 1) old.dispose();
    }
  }
  return true;
}

// ---------- 量化 + meshopt ----------
function meshoptXform(L, o) {
  const { EXTMeshoptCompression } = L.ext, { reorder, quantize } = L.fn;
  return async doc => {
    const high = o.level !== 'medium';
    await doc.transform(reorder({ encoder: L.mo.MeshoptEncoder, target: 'size' }));
    const packed = o.posPack && packPositions(L, doc, o.pos);
    await doc.transform(quantize({
      // high 档里法线交给八面体滤波，不在这里量化（和 gltf-transform 的 meshopt() 一样）；位置自己量化过的不再动
      pattern: packed ? (high ? /^(TEXCOORD|JOINTS|WEIGHTS|COLOR)(_\d+)?$/ : /^(?!POSITION)/) : (high ? /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR)(_\d+)?$/ : /.*/),
      patternTargets: high ? /^(POSITION|TEXCOORD|JOINTS|WEIGHTS|COLOR|NORMAL|TANGENT)(_\d+)?$/ : /.*/,
      quantizePosition: o.pos, quantizeTexcoord: o.uv, quantizeNormal: Math.min(o.nrm, high ? 8 : 16), quantizeWeight: o.wgt,
    }));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: high ? EXTMeshoptCompression.EncoderMethod.FILTER : EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  };
}

// ---------- JSON 瘦身 ----------
// GLB 里的 JSON 不压缩：去掉写出来的默认值（normalized:false、byteOffset:0、interpolation:LINEAR），
// 小数改成「读回来还是同一个 32 位浮点数」的最短写法（0.08006058633327484 → 0.08006059）
function minifyGlb(glb) {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(16, true) !== 0x4E4F534A) return glb;
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(Buffer.from(glb.buffer, glb.byteOffset + 20, jl).toString('utf8'));
  const short = x => {
    if (Number.isInteger(x)) return x;
    const f = Math.fround(x);
    for (let p = 1; p <= 9; p++) { const v = +f.toPrecision(p); if (Math.fround(v) === f) return v; }
    return x;
  };
  const walk = v => {
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = typeof v[i] === 'number' ? short(v[i]) : walk(v[i]); return v; }
    if (v && typeof v === 'object') for (const k in v) v[k] = typeof v[k] === 'number' ? short(v[k]) : walk(v[k]);
    return v;
  };
  walk(json.nodes || []); walk(json.accessors || []); walk(json.materials || []);
  for (const a of json.accessors || []) { if (a.normalized === false) delete a.normalized; if (a.byteOffset === 0) delete a.byteOffset; }
  for (const b of json.bufferViews || []) { if (b.byteOffset === 0) delete b.byteOffset; }
  for (const a of json.animations || []) for (const sm of a.samplers) if (sm.interpolation === 'LINEAR') delete sm.interpolation;
  let jb = Buffer.from(JSON.stringify(json), 'utf8');
  if (jb.length % 4) jb = Buffer.concat([jb, Buffer.alloc(4 - jb.length % 4, 0x20)]);
  const rest = Buffer.from(glb.buffer, glb.byteOffset + 20 + jl, glb.byteLength - 20 - jl);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + jb.length + rest.length, 8);
  head.writeUInt32LE(jb.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
  const out = Buffer.concat([head, jb, rest]);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

// 压一只。返回 { bytes, tris, verts, channels, tex }
export async function optimize(src, dst, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const L = await lib();
  const { dedup, flatten, weld, resample, prune } = L.fn;
  const doc = await L.io.read(src);
  doc.setLogger(new L.core.Logger(L.core.Logger.Verbosity.ERROR));
  // flatten：带蒙皮网格的节点挪到场景最外层（父节点的变换本来就不影响蒙皮网格，glTF 检查器要求这样放；老做法也是这样）
  const steps = [dedup(), flatten(), weld()];
  if (o.simplify < 1) steps.push(simplifyXform(L, o));
  steps.push(resample({ tolerance: o.animTol }));
  if (o.dropRest) steps.push(dropRestXform());
  // keepSolidTextures：纯色贴图也留着（monster3d.js 只认贴图，不认材质颜色）
  steps.push(prune({ keepAttributes: false, keepIndices: false, keepLeaves: false, keepSolidTextures: true }));
  const info = {};
  steps.push(textureXform(L, o, info));
  steps.push(meshoptXform(L, o));
  await doc.transform(...steps);
  let glb = await L.io.writeBinary(doc);
  if (o.minify) glb = minifyGlb(glb);
  fs.writeFileSync(dst, glb);
  let tris = 0, verts = 0, channels = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { tris += p.getIndices().getCount() / 3; verts += p.getAttribute('POSITION').getCount(); }
  for (const a of doc.getRoot().listAnimations()) channels += a.listChannels().length;
  return { bytes: glb.byteLength, tris, verts, channels, tex: info.tex || 0 };
}

// ---------- 命令行 ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const num = v => (v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v);
  if (a[0] === '--batch') {
    const jobs = JSON.parse(fs.readFileSync(a[1], 'utf8'));
    let bad = 0;
    for (const j of jobs) {
      const tmp = j.dst + '.tmp.glb';
      try {
        const r = await optimize(j.src, tmp, j.opts);
        fs.renameSync(tmp, j.dst);
        console.log(JSON.stringify(Object.assign({ id: j.id, ok: true }, r)));
      } catch (e) {
        bad++;
        try { fs.unlinkSync(tmp); } catch (x) { /* 没写出来 */ }
        console.log(JSON.stringify({ id: j.id, ok: false, err: String(e && e.message || e).split('\n')[0] }));
      }
    }
    process.exit(bad ? 1 : 0);
  } else {
    const pos = [], opts = {};
    for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) opts[a[i].slice(2)] = num(a[++i]); else pos.push(a[i]); }
    if (pos.length < 2) { console.log('用法：node tools/mon3d/glbopt.mjs <src.glb> <dst.glb> [--tex 768] [--q 80] [--simplify 0.6] [--err 0.003] [--pos 12 --posPack true]'); process.exit(2); }
    const r = await optimize(pos[0], pos[1], opts);
    console.log(path.basename(pos[1]), (r.bytes / 1024).toFixed(0) + 'KB', r.tris + ' 三角形', r.verts + ' 顶点', r.channels + ' 动作通道', '贴图 ' + r.tex);
  }
}
