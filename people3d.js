// 回声岛 · 3D 小人（window.EchoPeople3D）：按 people.js 的造型对象（LOOKS / VILLAGERS / TRAINERS 那种）用代码搭出来的 Q 版立体小人，
// 给新画风的大地图用（world3d-open.js 里的人物原来是 2D 纸片）。和 2D 小人是同一套设计：大头、小身子、短手短脚，颜色、发型、帽子、背包、眼镜、围裙、裙子都对得上。
//
// 做法：
//   · 每个造型只搭一次网格（按造型的签名缓存，同样造型的人共用）：所有部件拼成一块蒙皮网格，颜色写在顶点上，每个顶点只跟一根骨头（部件是硬的，关节处互相插进去一点）；
//     脸另外一小块网格，贴一张用 2D 画法画出来的脸（眼睛、眉毛、睫毛、腮红、嘴），正好换掉头上朝前的那半边（同一个曲面、同样的格子、同样的法线），所以接缝看不出来。一个人 2 个 draw call。
//     脸的贴图是按经度绕着头铺的（一直到两边耳朵前面），眼睛比 2D 正面画的靠外一些：转到侧面还有一整只眼睛、腮红和一个小鼻子，鬓角和帽沿都让开脸颊。
//   · 部件都是「参数曲面」：给一个 (u, v) → 点 的函数，法线按函数本身求（不是按网格求），所以表面是圆滑的，同一个函数分几块上不同的颜色也没有接缝。
//   · 两档精细度（opts.detail）：'high'（默认，给好手机）分得细，头发是一缕一缕、分上下两层的，衣服有袖口 / 下摆 / 口袋 / 鞋底 / 围裙带子这些小东西，眼镜是真的镜框，
//     脸的贴图 768×320，一个人 4400–7200 个三角形（上限 8000）；'low' 只留大形，1200–2150 个三角形（上限 2500），脸的贴图 384×160（眼镜画在贴图上）。
//   · 动作全是算出来的（待机呼吸、眨眼、走 / 跑、转身、跳台阶、马尾 / 双马尾 / 背包慢半拍跟着晃），不用动画文件。13 根骨头（鞋单独绕脚踝转）。
//     走路的步子是按真的速度算的（见 gait）：踩在地上的那只脚不滑、鞋是平的；小人腿短，游戏里的速度得是跑（两脚有一段都离地）。
//   · 只用 WebGL2 本来就有的东西（iPhone 的 WKWebView、Mali 手机都行）：贴图都是画布画的或 8 位的，骨头用 three 自带的骨头贴图，不用浮点渲染目标，不用 OffscreenCanvas。
// 单位：people.js 里格子 40、脚底 0、头顶约 46；这里 1 个设计单位 = 0.025，所以不戴帽子的人高约 1.14（纸片人约 1.2，要一样高就放大到 1.06）。x 是小人自己的左手边，y 朝上，z 是小人面朝的方向。
//
// 接口：
//   EchoPeople3D.has(look, state)   这个造型、这个状态能不能用 3D 画（不能就继续用纸片）
//   EchoPeople3D.create(look, opts) → inst 或 null。opts.mat(kind, params)：调用的人给的材质工厂——kind 'body' 要一个带顶点颜色的卡通材质（会用在蒙皮网格上），
//                                    kind 'face' 要一个带 params.map 贴图的卡通材质（明暗要和 body 一样，不然脸那一片会看出边）；不给就用自带的三档明暗卡通材质。
//                                    opts.detail：'high'（默认）/ 'low'；opts.seed：动作的随机相位
//   EchoPeople3D.release()          放掉共用的网格、贴图、材质（还活着的小人也一起收掉）
//   inst.root                       THREE.Group，脚底在 y = 0，面朝 +z；大小 1 时高约 1.14（位置和缩放由调用的人定）
//   inst.set({ dir, moving, speed, state, phase })
//                                   dir: 'up' | 'down' | 'left' | 'right'（第一次设是直接到位，以后是转过去）；state 见下面的 STATES；
//                                   speed：在地上走多快——**世界单位每秒，按 root 的大小是 1 算**（root 放大了 s 倍就传「实际速度 ÷ s」；大地图一格是 1，所以是「每秒几格 ÷ s」）。
//                                          给对了，踩着地的脚就不滑。没给过按 2.4；骑车时用它定蹬车的快慢；
//                                   phase：state 是 'hop'（跳台阶）时用，0 = 起跳、0.5 = 最高、1 = 落地（就是 world.js 那一步走了百分之几）；不给就自己用 0.3 秒走完。离地多高由调用的人抬 root
//   inst.tick(dt)                   往前走 dt 秒的动作
//   EchoPeople3D.gait(speed)        这个速度下的步子：{ f 每秒几个来回, d 一只脚踩地占一个来回的多少, stride 踩地那一段多长 }（stride × f ÷ d = speed）
//   inst.height                     头顶（含帽子）的高度，头上的「?」「!」放在它上面
//   inst.dispose()
//   另外给调用的人用得上的：inst.body（蒙皮网格）、inst.face（脸）——要不要接影子（receiveShadow）两个要设成一样；inst.bones（按名字取骨头）；inst.tris；inst.detail
// 预览：tools/people3d.html；拍对比图：node tools/look/people-shots.js；测试：node tests/people3d.test.js
(function () {
  'use strict';

  const U = .025, D = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const spw = (v, e) => (v < 0 ? -Math.pow(-v, e) : Math.pow(v, e));
  const seq = (a, b, n) => { const o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; };
  const dg = (...xs) => xs.map(x => x * D);
  const dseq = (a, b, n) => seq(a * D, b * D, n);
  const wrapPi = a => Math.atan2(Math.sin(a), Math.cos(a));

  // 能画的状态：'' / idle / walk 平常（走不走看 moving）、bike 骑车、surf 踏浪（站在怪兽背上）、hop 跳台阶、talk 说话时点头、wave 挥手
  const STATES = { '': 1, idle: 1, walk: 1, bike: 1, surf: 1, hop: 1, talk: 1, wave: 1 };
  const GIRL = { long: 1, bob: 1, pigtails: 1, ponytail: 1, bun: 1 };
  const STYLE = { spiky: 1, short: 1, bald: 1, long: 1, bob: 1, pigtails: 1, ponytail: 1, bun: 1 };
  const DIRYAW = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };

  // ---------- 颜色（和 people.js 的 shade 一样在 sRGB 里压暗；顶点颜色要线性的） ----------
  function rgb(hex) {
    if (typeof hex !== 'string') return null;
    let m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(hex);
    return m ? m[1].split('').map(ch => parseInt(ch + ch, 16)) : null;
  }
  const toLin = v => { v = clamp(v, 0, 255) / 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
  const lin = (hex, f) => { const c = rgb(hex) || [255, 0, 255]; f = f == null ? 1 : f; return [toLin(Math.round(c[0] * f)), toLin(Math.round(c[1] * f)), toLin(Math.round(c[2] * f))]; };
  const mixLin = (a, b, t) => { const p = rgb(a) || [255, 0, 255], q = rgb(b) || [255, 255, 255]; return [0, 1, 2].map(i => toLin(lerp(p[i], q[i], t))); };
  const hexOr = (h, d) => (rgb(h) ? h : d);
  const css = (hex, f) => 'rgb(' + rgb(hex).map(v => Math.round(clamp(v * f, 0, 255))).join(',') + ')';

  // ---------- 网格小工具：一块块参数曲面拼起来 ----------
  function Kit(uv) { this.p = []; this.n = []; this.c = []; this.b = []; this.i = []; this.t = uv ? [] : null; this.tris = 0; }
  // f(u, v, out)：曲面；us / vs：两个方向各取哪些参数值；col：颜色（线性 [r,g,b]）；bone：跟哪根骨头
  // o.wrap：u 方向绕一圈（us 的头尾是同一条线）；朝哪边是外面：o.keep 照参数的方向（管子、手臂这类自己知道）、o.c 给一个里面的点、o.ring 一圈东西给圆心和半径、
  // o.dir 给一个大致的朝向，都不给就用这块面自己的中心；o.inv 反过来（朝里）；o.nf(n)：改一下法线（脸上用）；o.uv(x, y, z)：贴图坐标
  Kit.prototype.surf = function (f, us, vs, col, bone, o) {
    o = o || {};
    const nu = us.length, nv = vs.length, cols = o.wrap ? nu - 1 : nu, n = cols * nv;
    const u1 = us[nu - 1], v0 = vs[0], v1 = vs[nv - 1], eu = (u1 - us[0]) * 1e-3, ev = (v1 - v0) * 1e-3;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), q = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0];
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < cols; i++) {
      const u = us[i], v = vs[j], k = (j * cols + i) * 3;
      f(u, v, q); P[k] = q[0]; P[k + 1] = q[1]; P[k + 2] = q[2]; cx += q[0]; cy += q[1]; cz += q[2];
      // 法线 = 两个方向的切线叉乘。切线按函数本身求（到边了就往回取，不越过这块面），所以同一个函数分成几块也接得上
      const du = !o.wrap && i === nu - 1 ? -eu : eu;
      let vv = v, px = q[0], py = q[1], pz = q[2], nx = 0, ny = 1, nz = 0;
      for (let pass = 0; pass < 2; pass++) {
        const dv = j === nv - 1 ? -ev : ev, sg = du * dv > 0 ? 1 : -1;
        f(u + du, vv, a); f(u, vv + dv, b);
        const tx = a[0] - px, ty = a[1] - py, tz = a[2] - pz, sx = b[0] - px, sy = b[1] - py, sz = b[2] - pz;
        const x = (ty * sz - tz * sy) * sg, y = (tz * sx - tx * sz) * sg, z = (tx * sy - ty * sx) * sg, l = Math.hypot(x, y, z);
        if (l > 1e-9) { nx = x / l; ny = y / l; nz = z / l; break; }
        vv = v + (v1 - v0) * (j === 0 ? .03 : j === nv - 1 ? -.03 : .015);   // 收成一个点的地方（球的两极）切线是零：往里挪一点再算
        f(u, vv, a); px = a[0]; py = a[1]; pz = a[2];
      }
      N[k] = nx; N[k + 1] = ny; N[k + 2] = nz;
    }
    let flip = false;
    if (!o.keep) {
      let s = 0;
      if (o.dir) for (let k = 0; k < n * 3; k += 3) s += N[k] * o.dir[0] + N[k + 1] * o.dir[1] + N[k + 2] * o.dir[2];
      else if (o.ring) { const r = o.ring; for (let k = 0; k < n * 3; k += 3) { const dx = P[k] - r[0], dz = P[k + 2] - r[2], dl = Math.hypot(dx, dz) || 1; s += N[k] * (dx - dx / dl * r[3]) + N[k + 1] * (P[k + 1] - r[1]) + N[k + 2] * (dz - dz / dl * r[3]); } }
      else { const c0 = o.c || [cx / n, cy / n, cz / n]; for (let k = 0; k < n * 3; k += 3) s += N[k] * (P[k] - c0[0]) + N[k + 1] * (P[k + 1] - c0[1]) + N[k + 2] * (P[k + 2] - c0[2]); }
      flip = s < 0;
    }
    if (o.inv) flip = !flip;
    const base = this.p.length / 3, sg = flip ? -1 : 1;
    for (let j = 0; j < nv; j++) for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 3;
      q[0] = N[k] * sg; q[1] = N[k + 1] * sg; q[2] = N[k + 2] * sg;
      if (o.nf) o.nf(q);
      this.p.push(P[k], P[k + 1], P[k + 2]); this.n.push(q[0], q[1], q[2]); this.c.push(col[0], col[1], col[2]); this.b.push(bone);
      if (this.t) { const t = o.uv(P[k], P[k + 1], P[k + 2]); this.t.push(t[0], t[1]); }
    }
    const id = (i, j) => j * cols + (o.wrap ? i % cols : i);
    const same = (m, k) => { const x = P[m * 3] - P[k * 3], y = P[m * 3 + 1] - P[k * 3 + 1], z = P[m * 3 + 2] - P[k * 3 + 2]; return x * x + y * y + z * z < 1e-10; };
    const rev = flip !== ((u1 - us[0]) * (v1 - v0) < 0);   // 参数是倒着排的（比如从上往下）时三角形的绕向也要反过来
    const tri = (x, y, z) => { if (same(x, y) || same(y, z) || same(x, z)) return; if (rev) this.i.push(base + x, base + z, base + y); else this.i.push(base + x, base + y, base + z); this.tris++; };
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const A = id(i, j), B2 = id(i + 1, j), C = id(i + 1, j + 1), E = id(i, j + 1); tri(A, B2, E); tri(B2, C, E); }
    return this;
  };
  // 拼成 three 的几何体。org：原点挪到哪（脸那块网格挂在头的骨头上，要减掉骨头的位置）；skin：要不要骨头的编号
  Kit.prototype.geo = function (T, org, skin) {
    const g = new T.BufferGeometry(), nV = this.p.length / 3, pos = new Float32Array(nV * 3);
    for (let i = 0; i < nV * 3; i++) pos[i] = (this.p[i] - org[i % 3]) * U;
    // 存紧一点：法线、颜色用 16 位整数，骨头编号和权重用 8 位（一个精细档的小人约 150KB，全用浮点要 280KB）
    const nor = new Int16Array(nV * 3), col = new Uint16Array(nV * 3);
    for (let i = 0; i < nV * 3; i++) { nor[i] = Math.round(clamp(this.n[i], -1, 1) * 32767); col[i] = Math.round(clamp(this.c[i], 0, 1) * 65535); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3, true));
    g.setAttribute('color', new T.BufferAttribute(col, 3, true));
    if (this.t) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(this.t), 2));
    if (skin) {
      const si = new Uint8Array(nV * 4), sw = new Uint8Array(nV * 4);
      for (let i = 0; i < nV; i++) { si[i * 4] = this.b[i]; sw[i * 4] = 255; }
      g.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4, true));
    }
    g.setIndex(new T.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere();
    return g;
  };

  // ---------- 几种常用的曲面 ----------
  // 椭球：u 是绕竖轴的经度（0 = 正前方，往自己的左手边转），v 是从顶上往下的角度
  const ell = (cx, cy, cz, rx, ry, rz) => (u, v, o) => { const s = Math.sin(v); o[0] = cx + rx * s * Math.sin(u); o[1] = cy + ry * Math.cos(v); o[2] = cz + rz * s * Math.cos(u); };
  // 圆角方块（超椭球）：e 越小越方
  const sell = (cx, cy, cz, rx, ry, rz, e1, e2) => (u, v, o) => { const s = spw(Math.sin(v), e1); o[0] = cx + rx * s * spw(Math.sin(u), e2); o[1] = cy + ry * spw(Math.cos(v), e1); o[2] = cz + rz * s * spw(Math.cos(u), e2); };
  // 斜着放的椭球：三根轴（已经乘好半径）
  const ellAx = (c, ax, ay, az) => (u, v, o) => { const s = Math.sin(v), p = s * Math.sin(u), q = Math.cos(v), r = s * Math.cos(u); o[0] = c[0] + ax[0] * p + ay[0] * q + az[0] * r; o[1] = c[1] + ax[1] * p + ay[1] * q + az[1] * r; o[2] = c[2] + ax[2] * p + ay[2] * q + az[2] * r; };
  // 手臂 / 腿：两头是半球的圆柱，可以一头粗一头细。t 0–0.25 是 A 这头的半球，0.25–0.75 是中间，0.75–1 是 B 那头
  function limb(A, B, ra, rb) {
    let wx = B[0] - A[0], wy = B[1] - A[1], wz = B[2] - A[2];
    const L = Math.hypot(wx, wy, wz); wx /= L; wy /= L; wz /= L;
    let ux = Math.abs(wy) > .9 ? 1 : 0, uy = Math.abs(wy) > .9 ? 0 : 1, uz = 0;
    let vx = wy * uz - wz * uy, vy = wz * ux - wx * uz, vz = wx * uy - wy * ux; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
    ux = vy * wz - vz * wy; uy = vz * wx - vx * wz; uz = vx * wy - vy * wx;
    return (u, t, o) => {
      let r, d;
      if (t < .25) { const a = t / .25 * Math.PI / 2; r = ra * Math.sin(a); d = -ra * Math.cos(a); }
      else if (t > .75) { const a = (1 - t) / .25 * Math.PI / 2; r = rb * Math.sin(a); d = L + rb * Math.cos(a); }
      else { const k = (t - .25) / .5; r = ra + (rb - ra) * k; d = L * k; }
      const c = Math.cos(u) * r, s = Math.sin(u) * r;
      o[0] = A[0] + wx * d + ux * c + vx * s; o[1] = A[1] + wy * d + uy * c + vy * s; o[2] = A[2] + wz * d + uz * c + vz * s;
    };
  }
  const bez = (p0, p1, p2, p3) => (t, o) => { const m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t; for (let i = 0; i < 3; i++) o[i] = a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i]; };
  // 沿一条线扫出来的管子：ctr(t, out) 中心线，rad(t, u) 半径，up 一个不和线平行的方向，fa / fb 截面两个方向各压扁多少
  function sweep(ctr, rad, up, fa, fb) {
    const A = [0, 0, 0], B = [0, 0, 0];
    return (u, t, o) => {
      ctr(Math.max(0, t - .002), A); ctr(Math.min(1, t + .002), B); ctr(clamp(t, 0, 1), o);
      let wx = B[0] - A[0], wy = B[1] - A[1], wz = B[2] - A[2]; const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      let ax = up[1] * wz - up[2] * wy, ay = up[2] * wx - up[0] * wz, az = up[0] * wy - up[1] * wx; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      const bx = wy * az - wz * ay, by = wz * ax - wx * az, bz = wx * ay - wy * ax, r = rad(clamp(t, 0, 1), u), c = Math.cos(u) * r * (fa || 1), s = Math.sin(u) * r * (fb || 1);
      o[0] += ax * c + bx * s; o[1] += ay * c + by * s; o[2] += az * c + bz * s;
    };
  }
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const mul3 = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const add3 = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];

  // ---------- 骨头 ----------
  const BONES = ['hips', 'chest', 'head', 'armL', 'armR', 'legL', 'legR', 'tailA', 'tailB', 'bag', 'lid', 'footL', 'footR'];
  const PARENT = [-1, 0, 1, 1, 1, 0, 0, 2, 2, 1, 2, 5, 6];
  const B = {}; BONES.forEach((n, i) => { B[n] = i; });
  const HY = 30.5, HR = [12.4, 11.8, 11.7];                 // 头：中心高度、三个半径
  const HX = 13.6, HT = 15, HZ = 13.9, HCZ = -.5;          // 头发那层壳：比头大一圈，顶上高出一截，稍微靠后
  const LEG = 12.2, ANK = 2.2, LG = LEG - ANK;              // 胯多高、脚踝多高、胯到脚踝（腿绕胯转，鞋绕脚踝转）
  const REST = { hips: [0, 12.4, 0], chest: [0, 13.6, 0], head: [0, 21.6, 0], armL: [7.3, 20.4, 0], armR: [-7.3, 20.4, 0], legL: [3.3, LEG, 0], legR: [-3.3, LEG, 0], tailA: [0, HY + 9, -11], tailB: [0, HY + 9, -11], bag: [0, 21, -5], lid: [0, HY, 0], footL: [3.3, ANK, 0], footR: [-3.3, ANK, 0] };
  const HC = [0, HY, 0], HCN = [0, HY, HCZ];
  // 脸：眼睛在头上的位置（经度、比头中心低多少）。比 2D 正面画的靠外（2D 是 22° 左右），这样转到侧面还看得到一整只眼睛
  const EYE_LON = 33, EYE_Y = -1.8, FACE_W = Math.PI * HR[0];
  const FY0 = HY + HR[1] * Math.cos(150 * D), FH = HR[1] * (Math.cos(60 * D) - Math.cos(150 * D));   // 脸那块贴图竖着从哪到哪
  const rhoOf = y => Math.sqrt(Math.max(.01, 1 - (y / HR[1]) * (y / HR[1])));   // 这个高度上头有多宽（相对最宽那一圈）
  // 头表面上的一点：lon 经度（弧度，0 = 正前），y 比头中心高多少，off 往外浮起多少
  const onHead = (lon, y, off, o) => { const r = rhoOf(y); o[0] = (HR[0] + off) * r * Math.sin(lon); o[1] = HY + y; o[2] = (HR[2] + off) * r * Math.cos(lon); };

  // ---------- 步子 ----------
  // v：在地上走多快（世界单位每秒，按小人大小 1 算）。步子多大、多快都从它来：一只脚踩在地上时正好往后划 stride 这么长，所以踩着地的脚不滑。
  // 慢的时候是走（总有一只脚在地上，d = 0.5）；快了每秒迈的步数不再跟着涨（不然腿成了一团影子），改成跑：两脚都离地的一段越来越长
  function gait(v, o) {
    o.A = lerp(.36, .7, sst(.4, 4.2, v));                    // 腿最多往前 / 往后摆多少（弧度）
    o.stride = 2 * LG * Math.sin(o.A);                       // 一只脚从落地到离地在地上划过多长（设计单位）
    o.f = Math.min(v / U / (2 * o.stride), 2.2 + .14 * v);   // 每秒几个来回（一个来回 = 左右各一步）
    o.d = clamp(o.stride * o.f * U / v, .1, .5);             // 一只脚踩在地上的时间占一个来回的多少
    o.run = sst(.5, .3, o.d); o.air = 1.5 * o.run;           // 跑的程度；腾空时身子多抬多少
  }
  // 一条腿在一个来回里的 q 处：x 脚踝在胯前面多少、th 腿的角度、on 踩着地、lift 迈步时抬多高、comp 跑的时候落地那一下腿缩多少
  function legAt(q, g, o) {
    q -= Math.floor(q);
    if (q < g.d) { const u = q / g.d; o.on = true; o.u = u; o.x = g.stride * (.5 - u); o.lift = 0; o.comp = 1.5 * g.run * Math.sin(Math.PI * u); }
    else { const u = (q - g.d) / (1 - g.d); o.on = false; o.u = u; o.x = g.stride * (u * u * (3 - 2 * u) - .5); o.lift = (1.5 + 1.7 * g.run) * Math.sin(Math.PI * u); o.comp = 0; }
    o.th = Math.asin(clamp(o.x / LG, -1, 1)); o.xn = o.x / (g.stride * .5);
  }
  // 脸上的明暗：整张脸（连两腮、下巴、耳朵周围）用同一个「正前方偏上」的法线，所以脸是一整块颜色——朝着太阳就亮、背着就暗。
  // 卡通明暗只有两三档，脸要是按球面的法线算，转到斜侧面时亮面和半亮面的交界正好竖着切在脸颊上，看着像一条接缝（2026-11-19 就是这样）。
  // 只有头顶（光头才露出来）和后脑勺慢慢换回真的法线。脸那块网格、头、眼皮用的是同一个算法（鼻子、耳朵直接用 FACE_N），所以接得上。
  // 偏上 0.45 是挑过的：大地图的太阳在西南上方，朝南、朝西走脸是亮的（离明暗交界有余量，头晃一晃不会忽明忽暗），朝东、朝北是暗的
  const FACE_N = nrm([0, .45, 1]), faceN = n => { n[0] = FACE_N[0]; n[1] = FACE_N[1]; n[2] = FACE_N[2]; };
  const bendHead = n => { const k = sst(-.75, -.3, n[2]) * (1 - sst(.35, .75, n[1])); n[0] = lerp(n[0], FACE_N[0], k); n[1] = lerp(n[1], FACE_N[1], k); n[2] = lerp(n[2], FACE_N[2], k); const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; };
  // 头的表面上 (x, y) 这一点有多靠前（x、y 相对头中心）
  const headZ = (x, y) => HR[2] * Math.sqrt(Math.max(.01, 1 - (x / HR[0]) * (x / HR[0]) - (y / HR[1]) * (y / HR[1])));

  // ---------- 头发的下沿 ----------
  // 刘海：people.js 正面那条锯齿线（x，高出头中心多少），偶数个是发梢、奇数个是缺口
  const BANG_M = [[11.6, .5], [9.6, 5.6], [7.8, 1.8], [5.2, 6.4], [2.6, 2.2], [-.4, 6.8], [-3.2, 2.4], [-6, 6.2], [-8.4, 2], [-10.4, 5.4], [-12.2, .6]];
  const BANG_F = [[11.8, -2], [9.2, 4.4], [6.8, 1.2], [3.8, 5.4], [.4, 2.2], [-3, 6], [-6.4, 2.4], [-9.4, 4.8], [-12.4, -1]];
  const BANG_UP = .9;   // 头发那层壳比脸靠前，从上往下看刘海会显得低：整体抬一点
  // 两侧到后脑勺：[经度（度），下沿比头中心高多少（负的是低），是不是发梢]。太阳穴那里收上去（侧面看脸颊和眼睛是露着的，和 2D 侧面一样）、
  // 鬓角一缕垂在耳朵前面、耳朵上面让开、后面一圈锯齿（和 2D 背面一样：四个发梢）
  const SIDE = {
    short: [[70, 3.2, 0], [77, 2.6, 0], [83, -4.6, 1], [89, 1.3, 0], [97, 1.1, 0], [106, -2.6, 0], [116, -5.7, 1], [140, -2.3, 0], [161, -5.7, 1], [180, -2.3, 0]],
    med: [[70, 2.8, 0], [77, 2.2, 0], [83, -8.2, 1], [89, 1, 0], [97, .8, 0], [106, -2.6, 0], [116, -5.7, 1], [140, -2.3, 0], [161, -5.7, 1], [180, -2.3, 0]],
    bob: [[72, 1.8, 0], [82, -13, 1], [91, -9, 0], [102, -9.8, 0], [116, -10.8, 1], [140, -7.6, 0], [161, -10.8, 1], [180, -7.6, 0]],
    long: [[72, 1.8, 0], [82, -13, 1], [90, -5, 0], [99, -16.5, 0], [116, -20.2, 1], [140, -16.8, 0], [161, -20.2, 1], [180, -16.8, 0]],
  };
  // 上面那一层头发（只有精细档做）：盖在后脑勺上，发梢正好落在下面那层两缕之间
  const TIER = {
    short: [[97, 8, 0], [118, 4.8, 0], [140, .2, 1], [161, 4.8, 0], [180, .2, 1]],
    bob: [[97, 6.5, 0], [118, 1.5, 0], [140, -4, 1], [161, 1.5, 0], [180, -4, 1]],
    long: [[97, 5.5, 0], [118, -2, 0], [140, -8.4, 1], [161, -2, 0], [180, -8.4, 1]],
  };
  // 一圈下沿：pts 拐点，gap 隔多少度加一列，sub 缺口到发梢之间至少分几段（多于 1 段时发梢两边是鼓出来的弧线，不是直线）
  function hemLine(pts, gap, sub, closed) {
    pts = pts.slice().sort((a, b) => a[0] - b[0]);
    const cols = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil((b[0] - a[0]) / gap - 1e-6), Math.abs(a[2] - b[2]) === 1 ? sub : 1);
      for (let k = 0; k < n; k++) cols.push((a[0] + (b[0] - a[0]) * k / n) * D);
    }
    cols.push(pts[pts.length - 1][0] * D);
    const lo = pts[0][0], hi = pts[pts.length - 1][0];
    const at = (phi, o) => {   // 这个经度上下沿多高、离发梢多近（1 = 发梢正中，0 = 缺口）
      let d = phi / D;
      if (closed) d = ((d + 180) % 360 + 360) % 360 - 180; else d = clamp(d, lo, hi);
      let i = 0; while (i < pts.length - 2 && d > pts[i + 1][0]) i++;
      const a = pts[i], b = pts[i + 1], t = clamp((d - a[0]) / (b[0] - a[0] || 1), 0, 1), w = lerp(a[2], b[2], t);
      o[0] = sub > 1 && Math.abs(a[2] - b[2]) === 1 ? lerp(a[2] ? b[1] : a[1], a[2] ? a[1] : b[1], Math.pow(w, .7)) : lerp(a[1], b[1], t);
      o[1] = w;
    };
    return { cols, at };
  }
  function hairHem(style, hi) {
    const kind = style === 'long' || style === 'bob' ? style : GIRL[style] ? 'med' : 'short', pts = [];
    (GIRL[style] ? BANG_F : BANG_M).forEach(([x, y], i, a) => {
      const r = HX * (y >= 0 ? Math.sqrt(1 - (y / HT) * (y / HT)) : 1);
      pts.push([Math.asin(clamp(x / r, -1, 1)) / D, y + BANG_UP, i === 0 || i === a.length - 1 ? .5 : i % 2 ? 0 : 1]);
    });
    SIDE[kind].forEach(q => { pts.push(q, [-q[0], q[1], q[2]]); });
    const h = hemLine(pts, hi ? 8.4 : 13, hi ? 3 : 1, true);
    h.kind = kind;
    return h;
  }

  // 蝴蝶结（发带上的、围裙后面的）：两片 + 中间一个结。c 中心，tA 往两边、tN 往外、tW 上下
  function bow(K, c, tA, tN, tW, k, col, colKnot, bone, hi) {
    const us = dseq(0, 360, hi ? 8 : 6), vs = dseq(0, 180, hi ? 5 : 4);
    [[3.2, 3.2, 2.7], [-2.7, 2.6, 2.3]].forEach(([off, ra, rw]) => {
      const cc = add3(add3(c, tA, off * k), tN, .9 * k), e = ellAx(cc, mul3(tA, ra * k), mul3(tN, 1.5 * k), mul3(tW, rw * k)), sg = off > 0 ? 1 : -1;
      // 靠近结的那一头收窄，像扎起来的样子
      K.surf((u, v, o) => { e(u, v, o); const dx = (o[0] - cc[0]) * tA[0] + (o[1] - cc[1]) * tA[1] + (o[2] - cc[2]) * tA[2], q = .62 + .38 * sst(-1, .6, sg * dx / (ra * k)); for (let i = 0; i < 3; i++) { const along = cc[i] + tA[i] * dx; o[i] = along + (o[i] - along) * q; } }, us, vs, col, bone, { wrap: true, c: cc });
    });
    K.surf(ellAx(add3(c, tN, k), mul3(tA, 1.5 * k), mul3(tN, 1.5 * k), mul3(tW, 1.6 * k)), dseq(0, 360, 6), dseq(0, 180, hi ? 4 : 3), colKnot, bone, { wrap: true });
  }

  // ---------- 搭一个造型：返回 { geo 身体, face 脸, rest 骨头的位置, height, tris } ----------
  function build(T, L, hi) {
    const K = new Kit(), F = new Kit(true);
    const st = STYLE[L.style] ? L.style : 'short', bald = st === 'bald';
    const hat = L.hat, hc = hexOr(L.hatC, '#e53935'), skirt = !!L.skirt;
    const jacket = rgb(L.jacket) ? L.jacket : null, coat = rgb(L.coat) ? L.coat : null, apron = rgb(L.apron) ? L.apron : null, bag = rgb(L.bag) ? L.bag : null;
    const sleeve = jacket || coat || L.shirt, shoes = hexOr(L.shoes, '#4a3a35');
    const cSkin = lin(L.skin), cHair = lin(L.hair), rest = {};
    BONES.forEach(n => { rest[n] = REST[n].slice(); });
    const rg = (a, b, step) => dseq(a, b, Math.round((b - a) / step)), ring = n => dseq(-180, 180, n);

    // ---- 头：朝前的半边留给脸（另一块网格），顶上和后脑勺被头发盖住的不做（光头才做） ----
    const headF = ell(0, HY, 0, HR[0], HR[1], HR[2]), hcS = hi ? 10 : 18, hrS = hi ? 7.5 : 15, HN = { c: HC, nf: bendHead };
    const covered = st === 'long' || st === 'bob';   // 头发把耳朵和后脖子都盖住了
    if (bald) K.surf(headF, rg(-180, 180, hcS), rg(0, 60, hrS), cSkin, B.head, { wrap: true, c: HC, nf: bendHead });
    else K.surf(headF, rg(-90, 90, hcS), rg(45, 60, hrS), cSkin, B.head, HN);
    K.surf(headF, rg(90, 270, hcS), rg(bald ? 60 : covered ? 105 : hi ? 82.5 : 75, 180, hrS), cSkin, B.head, HN);
    K.surf(headF, rg(-90, 90, hcS), rg(150, 180, hrS), cSkin, B.head, HN);
    // 脸：和头是同一个曲面、同样的格子。贴图横着按经度铺开（一直绕到两边耳朵前面），眼睛、腮红是画在球面上的，所以正面、斜着、侧面看都在
    F.surf(headF, rg(-90, 90, hcS), rg(60, 150, hrS), [1, 1, 1], 0, { c: HC, nf: bendHead, uv: (x, y, z) => [.5 + Math.atan2(x / HR[0], z / HR[2]) / Math.PI, (y - FY0) / FH] });
    // 鼻子：一个小鼓包，侧面看轮廓上有它；法线和脸一样，所以正面看只是一个比肤色深一点的小点（和 2D 一样）
    K.surf(ell(0, HY - 4.3, headZ(0, -4.3) + .12, .72, .62, .8), ring(hi ? 8 : 6), dseq(0, 180, hi ? 5 : 3), lin(L.skin, .84), B.head, { wrap: true, nf: faceN });
    // 耳朵（长发、波波头盖住了，不做）。法线也和脸一样：不然转到斜侧面时耳朵自己亮一块
    if (!covered) [-1, 1].forEach(sx => {
      K.surf(ell(sx * 12, HY - 1.6, -.3, 1.4, 2.5, 1.8), ring(hi ? 10 : 6), dseq(0, 180, hi ? 6 : 4), cSkin, B.head, { wrap: true, nf: faceN });
      if (hi) K.surf((a, r, o) => { o[0] = sx * (13.43 - .16 * r * r); o[1] = HY - 1.55 + r * 1.4 * Math.sin(a); o[2] = -.2 + r * .95 * Math.cos(a); }, dseq(0, 360, 8), [0, 1], lin(L.skin, .86), B.head, { wrap: true, dir: [sx, 0, 0], nf: faceN });
    });
    // 眼皮：平时缩成一个点藏在头里，眨眼时放出来盖住眼睛（下面一道深色的弧 = 闭着的眼）
    // 眼睛周围的一圈：以眼睛为中心、沿着头的表面量 r 个单位、方向 a 的那一点
    const EL = EYE_LON * D, eyeRing = (sx, rx, ry, off) => (a, r, o) => { const y = EYE_Y + r * ry * Math.sin(a); onHead(sx * EL + r * rx * Math.cos(a) / (HR[0] * rhoOf(y)), y, off, o); };
    [-1, 1].forEach(sx => {
      K.surf(eyeRing(sx, 3.4, 3.8, .14), dseq(0, 360, hi ? 14 : 8), [0, 1], cSkin, B.lid, { wrap: true, c: HC, nf: bendHead });
      K.surf(eyeRing(sx, 3.4, 3.8, .26), dseq(200, 340, hi ? 8 : 4), [.7, 1.02], lin('#2b2233'), B.lid, { c: HC });
    });
    // 眼镜：精细档是真的镜框（两个圈贴着脸绕过去、鼻梁、两条镜腿），省电档画在脸的贴图上
    if (L.glasses && hi) {
      const cG = lin('#3b3b4a'), half = 3.95 / HR[0] / D;   // 镜圈的半径合多少度
      [-1, 1].forEach(sx => {
        const er = eyeRing(sx, 3.95, 3.95, .8);
        K.surf(sweep((t, o) => er(t * TAU, 1, o), () => .36, [sx * Math.sin(EL), 0, Math.cos(EL)]), dseq(0, 360, 4), seq(0, 1, 16), cG, B.head, { wrap: true, keep: true });
        K.surf(sweep((t, o) => onHead(sx * lerp(EYE_LON + half, 93, t) * D, lerp(-1.4, -.3, t), .65, o), () => .3, [0, 1, 0]), dseq(0, 360, 3), seq(0, 1, 5), cG, B.head, { wrap: true, keep: true });
      });
      K.surf(sweep((t, o) => onHead(lerp(-(EYE_LON - half), EYE_LON - half, t) * D, -1.3 + .5 * Math.sin(Math.PI * t), .8, o), () => .32, [0, 0, 1]), dseq(0, 360, 4), seq(0, 1, 4), cG, B.head, { wrap: true, keep: true });
    }

    // ---- 头发 ----
    const cHairIn = lin(L.hair, .8), q2 = [0, 0];
    let hairTop = HY + HT;
    if (!bald) {
      const hem = hairHem(st, hi), kind = hem.kind, curtain = kind === 'long' || kind === 'bob', spiky = st === 'spiky';
      // 耳朵以下头发怎么收：短发贴着头往里收；波波头中间鼓一点、底下往里卷；长发直着垂下去、发梢收一点
      const taper = d => (kind === 'long' ? 1 - .13 * sst(11, 21, d) : kind === 'bob' ? 1 + .035 * Math.sin(Math.min(1, d / 11) * Math.PI) - .11 * sst(6, 12.5, d) : 1 - .0036 * d * d);
      const yToS = y => (y >= 0 ? Math.acos(clamp(y / HT, -1, 1)) / (Math.PI / 2) : 1 - y / 15);
      // s：0 是头顶，1 是耳朵那一圈，再往上是垂下去的部分（每 15 个单位算 1）；mul：整体鼓出去多少倍
      // 戴着帽子：帽子盖住的那一截头发收在帽子里面（不然一缕缕鼓出来会穿到帽子外面），从帽沿下面才放开
      const dm = (y, c, r) => Math.sqrt(Math.max(0, 1 - (Math.max(0, y - c) / r) * (Math.max(0, y - c) / r)));
      const clip = hat === 'cap' ? y => lerp(1.25, .99 * dm(y, 0, 16.7), sst(.4, 2.2, y))
        : hat === 'helmet' ? y => lerp(1.25, 1.012 * dm(y, 2.4, 13.9), sst(-1, .8, y))
          : hat === 'straw' ? y => lerp(1.25, .62 * dm(y, 7.3, 9.4), sst(4.4, 5.5, y)) : null;
      const hairPt = (phi, s, o, kOff, mul) => {
        let r, y;
        if (s <= 1) { const th = s * Math.PI / 2; r = Math.sin(th); y = HT * Math.cos(th); if (kOff) r += kOff * s; }
        else { const d = (s - 1) * 15; r = taper(d) + (kOff || 0); y = -d; }
        r *= mul || 1;
        if (clip && y > 0) r = Math.min(r, clip(y));
        o[0] = HX * r * Math.sin(phi); o[1] = HY + y; o[2] = HCZ + HZ * r * Math.cos(phi);
      };
      // 每一列从头顶到下沿均匀分行；垂下去的那一段直，少分几行
      const sOf = (S, t) => { if (S <= 1) return t * S; const a = 1 / (1 + (S - 1) * .45); return t <= a ? t / a : 1 + (t - a) / (1 - a) * (S - 1); };
      // 一缕一缕：每个发梢是一条鼓起来的棱，缺口是棱之间的沟，越往发梢越明显（头顶是光的）；刘海鼓得少一点，刺猬头后面的发梢往外翘
      const bR = hi ? .078 : .04;
      const lock = (phi, t, w) => { const ap = Math.abs(wrapPi(phi)); return 1 + bR * (1 - .35 * sst(70 * D, 52 * D, ap)) * Math.sqrt(w * (2 - w)) * sst(.28, 1, t) + (spiky ? .06 * w * sst(.72, 1, t) * sst(95 * D, 112 * D, ap) : 0); };
      const shell = (phi, t, o) => { hem.at(phi, q2); hairPt(phi, sOf(yToS(q2[0]), t), o, 0, lock(phi, t, q2[1])); };
      const rows = (hi ? [10, 11, 13] : [7, 8, 9])[kind === 'long' ? 2 : kind === 'bob' ? 1 : 0];
      K.surf(shell, hem.cols, seq(0, 1, rows), cHair, B.head, { wrap: true, c: HCN });
      // 下沿的厚度：从发梢往里收到头上（长发是收到里面那一层）
      const inner = (phi, o) => {
        hem.at(phi, q2); const y = q2[0], S = yToS(y);
        if (curtain && S > 1) return hairPt(phi, S, o, -.17);
        const rho = Math.sqrt(Math.max(.02, 1 - (y / HR[1]) * (y / HR[1]))) * .97;
        o[0] = HR[0] * rho * Math.sin(phi); o[1] = HY + y; o[2] = HR[2] * rho * Math.cos(phi);
      };
      const a3 = [0, 0, 0], b3 = [0, 0, 0];
      K.surf((phi, v, o) => { shell(phi, 1, a3); inner(phi, b3); for (let i = 0; i < 3; i++) o[i] = lerp(a3[i], b3[i], v); }, hem.cols, [0, 1], cHairIn, B.head, { wrap: true, dir: [0, -1, 0] });
      // 长发 / 波波头：垂下来那一段的里面一层（从正面看得到）
      if (curtain) {
        const us = hem.cols.filter(p => p >= 62 * D).concat(hem.cols.filter(p => p <= -62 * D).map(p => p + TAU));
        K.surf((phi, v, o) => { hem.at(phi, q2); hairPt(phi, lerp(1, Math.max(1, yToS(q2[0])), v), o, -.17); }, us, hi ? [0, .33, .66, 1] : [0, .5, 1], cHairIn, B.head, { c: HCN, inv: true });
      }
      // 上面一层（精细档；扎马尾、盘发髻的头发是往上拢的，不分层）：从头顶下面钻出来，盖到耳朵那么高，发梢落在下面那层两缕之间
      if (hi && st !== 'ponytail' && st !== 'bun') {
        const tp = TIER[kind === 'med' ? 'short' : kind].slice();
        tp.slice(0, 4).forEach(q => tp.push([360 - q[0], q[1], q[2]]));
        const th = hemLine(tp, 7.5, 3, false);
        const tier = (phi, t, o) => {
          th.at(phi, q2);
          const edge = sst(97 * D, 110 * D, Math.abs(wrapPi(phi))), w = q2[1];
          hairPt(phi, lerp(.4, yToS(q2[0]), t), o, 0, 1 - .014 + edge * .07 * sst(0, .5, t) + .062 * Math.sqrt(w * (2 - w)) * sst(.3, 1, t) * edge);
        };
        K.surf(tier, th.cols, seq(0, 1, 6), cHair, B.head, { c: HCN });
        K.surf((phi, v, o) => { tier(phi, 1, a3); th.at(phi, q2); hairPt(phi, yToS(q2[0]) - .02, b3, 0, .985); for (let i = 0; i < 3; i++) o[i] = lerp(a3[i], b3[i], v); }, th.cols, [0, 1], cHairIn, B.head, { dir: [0, -1, 0] });
      }
      // 头顶翘起来的几撮（刺猬头，没戴帽子时）
      if (spiky && !hat) {
        const tuft = (dx, dy, dz, len, r0, lx, lz) => {
          const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
          const k = 1 / Math.sqrt((dx / HX) * (dx / HX) + (dy / HT) * (dy / HT) + (dz / HZ) * (dz / HZ)) - 1.4;
          const p0 = [dx * k, HY + dy * k, HCZ + dz * k];
          let ax = dx / HX / HX + lx * .01, ay = dy / HT / HT, az = dz / HZ / HZ + lz * .01; const al = Math.hypot(ax, ay, az); ax /= al; ay /= al; az /= al;
          const ctr = (t, o) => { o[0] = p0[0] + ax * len * t + lx * len * .3 * t * t; o[1] = p0[1] + ay * len * t; o[2] = p0[2] + az * len * t + lz * len * .3 * t * t; };
          K.surf(sweep(ctr, t => r0 * Math.pow(1 - t, .8), Math.abs(ay) > .9 ? [1, 0, 0] : [0, 1, 0]), dseq(0, 360, hi ? 8 : 6), hi ? [0, .2, .4, .6, .8, 1] : [0, .4, .75, 1], cHair, B.head, { wrap: true, keep: true });
          hairTop = Math.max(hairTop, p0[1] + ay * len);
        };
        tuft(.27, .95, .12, 6.4, 3.4, .1, -.3); tuft(-.27, .95, .1, 6.2, 3.3, -.1, -.3);
        tuft(0, .93, -.34, 6.8, 3.5, 0, -.5); tuft(.5, .8, -.3, 5.4, 3, .45, -.3); tuft(-.5, .8, -.3, 5.4, 3, -.45, -.3);
        if (hi) { tuft(.08, .9, .42, 4.6, 2.9, .2, .5); tuft(.3, .82, -.5, 4.6, 2.8, .2, -.5); tuft(-.3, .82, -.5, 4.6, 2.8, -.2, -.5); }
      }
      const tie = rgb(L.hatC) && hat === 'band' ? lin(hc) : lin(L.hair, .7);   // 扎头发的皮筋：有发带就和发带一个颜色
      if (st === 'ponytail') {
        // 马尾：从后脑勺上面扎起来，往后甩出去再垂下来；截面分三股
        const p0 = [0, HY + 9.8, -10.7];
        K.surf(sweep(bez(p0, [0, HY + 12, -20], [0, HY - .5, -21.5], [0, HY - 13, -16.5]), (t, u) => 4.5 * Math.pow(Math.sin(Math.PI * Math.pow(.12 + .88 * t, .75)), .85) * (hi ? 1 + .07 * Math.cos(3 * u + 1) * Math.sin(Math.PI * t) : 1), [1, 0, 0], .85, 1.1), dseq(0, 360, hi ? 12 : 8), hi ? seq(0, 1, 10) : [0, .15, .32, .5, .68, .85, 1], cHair, B.tailA, { wrap: true, keep: true });
        K.surf(ell(p0[0], p0[1] + .4, p0[2] - .9, 3.3, 2.5, 2.6), ring(hi ? 10 : 6), dseq(0, 180, hi ? 5 : 3), tie, B.head, { wrap: true });
        rest.tailA = p0; rest.tailB = p0;
      } else if (st === 'pigtails') {
        [1, -1].forEach(sx => {
          const p0 = [sx * 12.5, HY + 2.2, -4.8], name = sx > 0 ? 'tailA' : 'tailB';
          K.surf(sweep(bez(p0, [p0[0] + sx * 3.4, p0[1] + 1.4, p0[2] - .8], [p0[0] + sx * 5.4, p0[1] - 7, p0[2] - 1.4], [p0[0] + sx * 3.6, p0[1] - 14, p0[2] - .6]), (t, u) => 4.3 * Math.pow(Math.sin(Math.PI * Math.pow(.1 + .9 * t, .8)), .85) * (hi ? 1 + .07 * Math.cos(3 * u) * Math.sin(Math.PI * t) : 1), [0, 0, 1], 1, .9), dseq(0, 360, hi ? 9 : 8), hi ? seq(0, 1, 7) : [0, .16, .36, .58, .8, 1], cHair, B[name], { wrap: true, keep: true });
          K.surf(ell(p0[0] + sx * .6, p0[1] + .2, p0[2], 2.4, 2.4, 2.4), ring(6), dseq(0, 180, hi ? 4 : 3), tie, B.head, { wrap: true });
          rest[name] = p0;
        });
      } else if (st === 'bun') {
        const bun = ell(0, HY + 12.6, -6.4, 5.5, 5.1, 5.5), bc = [0, HY + 12.6, -6.4];
        K.surf(hi ? (u, v, o) => { bun(u, v, o); const k = 1 + .035 * Math.cos(5 * u + 3 * v) * Math.sin(v); for (let i = 0; i < 3; i++) o[i] = bc[i] + (o[i] - bc[i]) * k; } : bun, ring(hi ? 15 : 9), dseq(0, 180, hi ? 9 : 5), cHair, B.head, { wrap: true, c: bc });
        hairTop = Math.max(hairTop, HY + 17.7);
      }
    } else {
      // 光头：只剩两边各一撮（从太阳穴到耳朵后面，耳朵上面那一段窄、耳朵后面往下长一点），头顶和后脑勺是光的——和 2D 的正面、背面一样
      [1, -1].forEach(sx => {
        const tuft = (t, v, o) => {   // t：从前（太阳穴）到后；v：从上沿到下沿。两头收尖，中间鼓起来
          const env = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), .55), yt = lerp(2.2, 7.6, env) - 1.2 * sst(.55, 1, t), yb = lerp(1.7, lerp(1.4, -3.9, sst(.52, .8, t)), env);
          onHead(sx * lerp(50, 132, t) * D, lerp(yt, yb, v), (.2 + .95 * env) * Math.pow(Math.sin(Math.PI * clamp(v, 0, 1)), .6), o);
        };
        K.surf(tuft, seq(0, 1, hi ? 14 : 8), hi ? [0, .1, .28, .5, .72, .9, 1] : [0, .18, .5, .82, 1], cHair, B.head, { c: HC });
      });
      hairTop = HY + HR[1];
    }

    // ---- 帽子、发带 ----
    let top = hairTop;
    if (hat === 'cap') {
      const cz = HCZ, dome = ell(0, HY, cz, 14.05, 16.7, 14.2), cHat = lin(hc), HCc = [0, HY, cz], n = hi ? 32 : 20;
      K.surf(dome, ring(n), hi ? dseq(0, 70, 7) : dg(0, 18, 36, 54, 70), cHat, B.head, { wrap: true, c: HCc });
      K.surf(dome, ring(n), dg(70, 78.5), lin(hc, .8), B.head, { wrap: true, c: HCc });
      // 帽檐：压扁的椭球，往前伸、稍微往下斜
      const by = HY + 3.7, bz = cz + 10.6, tilt = 9 * D, ct = Math.cos(tilt), sn = Math.sin(tilt), brim = sell(0, 0, 0, 11.6, 1.05, 9.6, 1, .85);
      K.surf((u, v, o) => { brim(u, v, o); const y = o[1], z = o[2] + 4; o[1] = by + y * ct - z * sn; o[2] = bz - 4 + y * sn + z * ct; }, ring(hi ? 24 : 12), hi ? dseq(0, 180, 6) : dg(0, 50, 90, 130, 180), lin(hc, .75), B.head, { wrap: true });
      const d4 = [0, 0, 0], onDome = (phi, th, k, o) => { dome(phi, th, d4); o[0] = d4[0] * k; o[1] = HY + (d4[1] - HY) * k; o[2] = cz + (d4[2] - cz) * k; };
      // 帽子上的圆标（精细档中间还有一道小波浪，和 2D 一样）
      if (rgb(L.hatLogo)) {
        const t0 = Math.acos(10.8 / 16.7), at = (x, y, k, o) => onDome(x / (14.05 * Math.sin(t0)), t0 - y / 16.7, k, o);
        K.surf((a, r, o) => at(r * 3.1 * Math.cos(a), r * 3.1 * Math.sin(a), 1.012, o), dseq(0, 360, hi ? 16 : 8), [0, 1], lin(L.hatLogo), B.head, { wrap: true, c: HCc });
        if (hi) K.surf((u, v, o) => at(u, .75 * Math.sin(u / 1.9 * Math.PI) + v, 1.02, o), seq(-1.9, 1.9, 8), [-.34, .34], cHat, B.head, { c: HCc });
      }
      // 后面的调节带和上面那个半圆的口子（露出头发）
      K.surf((a, r, o) => onDome(Math.PI + r * 3.6 * Math.cos(a) / 13.4, 78.5 * D - r * 3.8 * Math.sin(a) / 16.7, 1.006, o), dseq(0, 180, hi ? 8 : 4), [0, 1], bald ? cSkin : cHair, B.head, { c: HCc });
      K.surf((u, v, o) => onDome(u, v, 1.014, o), dg(164, 180, 196), dg(73.6, 78.5), lin(hc, .85), B.head, { c: HCc });
      if (hi) K.surf(ell(0, HY + 16.7, cz, 1.5, .8, 1.5), ring(8), dseq(0, 180, 4), lin(hc, .8), B.head, { wrap: true });   // 帽顶的小扣子
      top = Math.max(top, HY + 16.7 + (hi ? .8 : 0));
    } else if (hat === 'band') {
      // 发带：从一边耳朵上面绕过头顶偏前的地方到另一边；左边一个蝴蝶结
      const cHat = lin(hc), tau = 22 * D, bc = (a, tu, k, o) => { o[0] = HX * k * Math.sin(a); o[1] = HY + HT * k * Math.cos(a) * Math.cos(tu); o[2] = HCZ + HZ * k * Math.cos(a) * Math.sin(tu); };
      const c5 = [0, 0, 0], e5 = [0, 0, 0], g5 = [0, 0, 0];
      const ribbon = (u, t, o) => {
        const tc = clamp(t, 0, 1), a = lerp(-68, 68, tc) * D, rr = Math.pow(Math.sin(Math.PI * tc), .35);
        bc(a, tau, 1.035, c5); bc(a, tau + .02, 1.035, e5); bc(a, tau - .02, 1.035, g5);
        const nn = nrm([c5[0], c5[1] - HY, c5[2] - HCZ]), ww = nrm([e5[0] - g5[0], e5[1] - g5[1], e5[2] - g5[2]]), cu = Math.cos(u) * 1.5 * rr, su = Math.sin(u) * .66 * rr;
        for (let i = 0; i < 3; i++) o[i] = c5[i] + ww[i] * cu + nn[i] * su;
      };
      K.surf(ribbon, dseq(0, 360, hi ? 6 : 4), seq(0, 1, hi ? 22 : 12), cHat, B.head, { wrap: true, c: HCN });
      const a0 = 40 * D; bc(a0, tau, 1.06, c5); bc(a0 + .05, tau, 1.06, e5); bc(a0, tau + .05, 1.06, g5);
      bow(K, c5.slice(), nrm([e5[0] - c5[0], e5[1] - c5[1], e5[2] - c5[2]]), nrm([c5[0], c5[1] - HY, c5[2] - HCZ]), nrm([g5[0] - c5[0], g5[1] - c5[1], g5[2] - c5[2]]), 1, cHat, lin(hc, .85), B.head, hi);
      top = Math.max(top, HY + 17);
    } else if (hat === 'helmet') {
      const cHat = lin(hc), cy = HY + 2.4, dome = ell(0, cy, HCZ, 14.3, 13.9, 14.5), HCh = [0, cy, HCZ];
      K.surf(dome, ring(hi ? 28 : 20), dseq(0, 90, hi ? 7 : 5), cHat, B.head, { wrap: true, c: HCh });
      // 帽沿一圈
      K.surf((u, v, o) => { const r = 14.9 + .9 * Math.cos(v); o[0] = r * Math.sin(u); o[1] = cy - .4 + 1.7 * Math.sin(v); o[2] = HCZ + (r + .3) * Math.cos(u); }, ring(hi ? 28 : 16), dseq(-90, 270, hi ? 5 : 4), lin(hc, .75), B.head, { wrap: true, ring: [0, cy - .4, HCZ, 14.9] });
      const t0 = Math.acos(7 / 13.9), d3 = [0, 0, 0];
      K.surf((a, r, o) => { dome(r * 2.8 * Math.cos(a) / (14.3 * Math.sin(t0)), t0 - r * 2.8 * Math.sin(a) / 13.9, d3); o[0] = d3[0] * 1.014; o[1] = cy + (d3[1] - cy) * 1.014; o[2] = HCZ + (d3[2] - HCZ) * 1.014; }, dseq(0, 360, hi ? 14 : 8), [0, 1], lin('#ffc53d'), B.head, { wrap: true, c: HCh });
      // 头顶从前到后一道棱（精细档）
      if (hi) K.surf((u, v, o) => { const th = lerp(-36, 78, v) * D, k = 1 + .045 * Math.cos(u) * Math.pow(Math.sin(Math.PI * v), .4); o[0] = 2.1 * Math.sin(u) * Math.pow(Math.sin(Math.PI * v), .4); o[1] = cy + 13.9 * Math.cos(th) * k; o[2] = HCZ - 14.5 * Math.sin(th) * k; }, dseq(-90, 90, 4), seq(0, 1, 12), lin(hc, .88), B.head, { c: HCh });
      top = Math.max(top, cy + 13.9 * 1.045);
    } else if (hat === 'headset') {
      // 耳机：头顶一道弧、两个耳罩、伸到嘴边的小话筒
      const cHat = lin(hc), c5 = [0, 0, 0];
      const arc = (t, o) => { const a = lerp(-84, 84, t) * D; o[0] = HX * 1.06 * Math.sin(a); o[1] = HY + HT * 1.06 * Math.cos(a); o[2] = HCZ + .5; };
      K.surf(sweep(arc, () => 1.15, [0, 0, 1], 1, 1.25), dseq(0, 360, hi ? 5 : 4), seq(0, 1, hi ? 16 : 12), cHat, B.head, { wrap: true, keep: true });
      [-1, 1].forEach(sx => {
        K.surf(sell(sx * 14, HY - 1, 0, 2.3, 4.1, 3.5, .7, .7), ring(hi ? 10 : 8), dseq(0, 180, hi ? 6 : 4), cHat, B.head, { wrap: true });
        if (hi) K.surf((a, r, o) => { o[0] = sx * (16.6 - .12 * r * r); o[1] = HY - 1 + r * 2.1 * Math.sin(a); o[2] = r * 1.9 * Math.cos(a); }, dseq(0, 360, 10), [0, 1], lin(hc, 1.3), B.head, { wrap: true, dir: [sx, 0, 0] });
      });
      const boom = bez([13.6, HY - 4, 2.2], [13, HY - 8.5, 7], [10.5, HY - 9.4, 10.5], [6.6, HY - 8.4, 10.3]);
      K.surf(sweep(boom, () => .6, [0, 1, 0]), dseq(0, 360, hi ? 5 : 4), seq(0, 1, hi ? 8 : 4), lin(hc, .5), B.head, { wrap: true, keep: true });
      boom(1, c5);
      K.surf(ell(c5[0], c5[1], c5[2], 1.7, 1.7, 1.7), ring(hi ? 10 : 6), dseq(0, 180, hi ? 6 : 3), lin(hexOr(L.micC, '#ffd54f')), B.head, { wrap: true });
      top = Math.max(top, HY + HT * 1.06 + 1.2);
    } else if (hat === 'chef') {
      // 厨师帽：一圈直筒（精细档有竖褶）+ 上面鼓出来的一大团（三瓣）
      const white = lin('#ffffff'), n = hi ? 28 : 14;
      K.surf((u, v, o) => { const r = 8.7 * (hi ? 1 + .018 * Math.cos(14 * u) : 1); o[0] = r * Math.sin(u); o[1] = HY + lerp(8.2, 15.4, v); o[2] = HCZ + r * Math.cos(u); }, ring(hi ? 56 : n), [0, 1], white, B.head, { wrap: true, c: [0, HY + 12, HCZ] });
      const puff = ell(0, HY + 20.6, HCZ, 10.8, 7, 10.4);
      K.surf((u, v, o) => { puff(u, v, o); const k = 1 + .07 * Math.cos(3 * u + .5) * Math.sin(v); o[0] *= k; o[2] = HCZ + (o[2] - HCZ) * k; }, ring(hi ? 30 : 15), dseq(0, 180, hi ? 10 : 6), white, B.head, { wrap: true, c: [0, HY + 20.6, HCZ] });
      top = Math.max(top, HY + 27.6);
    } else if (hat === 'straw') {
      // 草帽：一圈宽帽檐（边上往下弯一点）、圆顶、一道红带子
      const straw = lin('#e9c46a'), cy = HY + 6.4, n = hi ? 32 : 18;
      K.surf((u, v, o) => { const r = 13.3 + 4.4 * Math.cos(v), y = .75 * Math.sin(v) - .012 * (r - 9) * (r - 9); o[0] = r * Math.sin(u); o[1] = cy + y; o[2] = HCZ + r * Math.cos(u); }, ring(n), hi ? dseq(-180, 180, 5) : dg(-180, -90, 0, 90, 180), straw, B.head, { wrap: true, ring: [0, cy, HCZ, 13.3] });
      const dome = ell(0, cy + .9, HCZ, 9.3, 9.4, 9.3), cc = [0, cy + .9, HCZ];
      const crown = (u, v, o) => { if (v <= Math.PI / 2) return dome(u, v, o); o[0] = 9.3 * Math.sin(u); o[1] = cy + .9 - 9.4 * (v - Math.PI / 2); o[2] = HCZ + 9.3 * Math.cos(u); };
      K.surf(crown, ring(hi ? 28 : 16), hi ? dseq(0, 72, 6) : dg(0, 25, 50, 72), straw, B.head, { wrap: true, c: cc });
      K.surf(hi ? (u, v, o) => { crown(u, v, o); o[0] *= 1.02; o[2] = HCZ + (o[2] - HCZ) * 1.02; } : crown, ring(hi ? 28 : 16), dg(72, 90, 97.5), lin('#c0392b'), B.head, { wrap: true, c: cc });
      top = Math.max(top, cy + 10.3);
    }

    // ---- 身体 ----
    const shoulder = y => Math.sqrt(Math.max(0, 1 - ((y - 18.5) / 5) * ((y - 18.5) / 5)));
    const wide = y => (y <= 18.5 ? 6.1 + .9 * sst(10.6, 18.5, y) : 7 * shoulder(y));
    const wideC = y => (y <= 18.5 ? 7.3 + sst(13, 6.6, y) * 1.1 : 7.3 * shoulder(y));   // 大衣 / 白大褂：长到膝盖，下摆张开一点
    const skirtW = y => 5.6 + 3.8 * Math.pow(clamp((14.6 - y) / 7.8, 0, 1), 1.3);
    const bodyF = (wf, k) => (u, y, o) => { const w = wf(y) * k; o[0] = w * spw(Math.sin(u), .92); o[1] = y; o[2] = w * .77 * spw(Math.cos(u), .92); };
    const BC = [0, 17, 0], cShirt = lin(L.shirt), OB = { c: BC };
    const disc = (f, x0, y0, r, col, n) => K.surf((a, q, o) => f(x0 + q * r * Math.cos(a) / 6.5, y0 + q * r * Math.sin(a), o), dseq(0, 360, n), [0, 1], col, B.chest, { wrap: true, c: BC });
    const bodyK = coat ? 1 : jacket ? 1.05 : 1;   // 最外面那层衣服比身体大多少
    if (coat) {
      const f = bodyF(wideC, 1), ys = hi ? [6.6, 8.5, 10.5, 12.6, 14.8, 16.5, 18, 19.4, 20.5, 21.6, 22.5, 23.1, 23.5] : [6.6, 10.5, 14.8, 18, 20.5, 22.5, 23.5], cCoat = lin(coat), cut = ys.indexOf(14.8);
      K.surf(f, hi ? dseq(19, 341, 22) : dg(19, 45, 70, 100, 130, 155, 180, 205, 230, 260, 290, 315, 341), ys, cCoat, B.chest, OB);
      const fu = hi ? dg(-19, -9.5, 0, 9.5, 19) : dg(-19, 0, 19);
      K.surf(f, fu, ys.slice(0, cut + 1), cCoat, B.chest, OB);
      K.surf(f, fu, ys.slice(cut), cShirt, B.chest, OB);
      K.surf(bodyF(wideC, 1.012), dg(-1.6, 1.6), ys.slice(0, cut + 1), lin(coat, .7), B.chest, OB);   // 前面中间那道缝
      K.surf((u, v, o) => { f(u, 6.6, o); o[0] *= 1 - v; o[2] *= 1 - v; }, ring(hi ? 22 : 12), [0, 1], lin(coat, .75), B.chest, { wrap: true, dir: [0, -1, 0] });
      if (hi) {
        // 翻领（胸口两片）、两颗扣子、两个口袋
        const f2 = bodyF(wideC, 1.028);
        [1, -1].forEach(sx => {
          K.surf((u, v, o) => f2(sx * (19 + 26 * u * v) * D, lerp(14.8, 21.4, v), o), [0, .5, 1], [0, .25, .5, .75, 1], lin(coat, .9), B.chest, OB);
          K.surf(f2, dg(sx * 44, sx * 66), [9.2, 11.2], lin(coat, .87), B.chest, OB);
        });
        disc(bodyF(wideC, 1.03), .09, 12.6, .75, lin(coat, .6), 8); disc(bodyF(wideC, 1.03), .09, 9.6, .75, lin(coat, .6), 8);
      }
    } else if (jacket) {
      // 敞着的外套：前面中间露出一条里面的衣服，外套比里面厚一圈；脖子后面一个帽兜
      const ys = hi ? [10.4, 12, 13.5, 15.2, 17, 18.5, 19.6, 20.6, 21.5, 22.3, 23, 23.5] : [10.4, 13.5, 17, 19.6, 21.5, 23, 23.5], cJ = lin(jacket);
      K.surf(bodyF(wide, 1.05), hi ? dseq(20, 340, 22) : dg(20, 40, 65, 90, 120, 150, 180, 210, 240, 270, 295, 320, 340), ys, cJ, B.chest, OB);
      K.surf(bodyF(wide, 1), dg(-34, -17, 0, 17, 34), hi ? [10.4, 13, 15.5, 18, 19.6, 21, 22.5, 23.5] : [10.4, 15, 19.6, 22.5, 23.5], cShirt, B.chest, OB);
      K.surf(ell(0, 21.7, -5, 5.9, 2.4, 3.1), ring(hi ? 14 : 8), dseq(0, 180, hi ? 6 : 3), cJ, B.chest, { wrap: true });
      if (hi) {
        // 门襟的深色边、下摆一圈、两个斜口袋
        const f2 = bodyF(wide, 1.064);
        [1, -1].forEach(sx => { K.surf(f2, dg(sx * 20, sx * 24.5), ys.slice(0, 9), lin(jacket, .62), B.chest, OB); K.surf((u, v, o) => f2(u, v + (Math.abs(u) - 58 * D) * 2.2, o), dg(sx * 47, sx * 69), [12.9, 13.8], lin(jacket, .7), B.chest, OB); });
        K.surf((u, v, o) => { const w = wide(11.1) * (1.05 + .04 * Math.cos(v)); o[0] = w * spw(Math.sin(u), .92); o[1] = 11.1 + .85 * Math.sin(v); o[2] = w * .77 * spw(Math.cos(u), .92); }, dseq(22, 338, 22), dseq(-90, 90, 3), lin(jacket, .86), B.chest, { c: [0, 11.1, 0] });
      }
    } else {
      const f = bodyF(wide, 1);
      K.surf(f, ring(hi ? 24 : 12), hi ? [10.4, 12, 13.5, 15.2, 17, 18.5, 19.6, 20.6, 21.5, 22.3, 23, 23.5] : [10.4, 13.5, 17, 19.6, 21.5, 23, 23.5], cShirt, B.chest, { wrap: true, c: BC });
      // 领口的小三角
      const fv = bodyF(wide, 1.02);
      K.surf((u, v, o) => fv(u * v, 19.2 + 3.2 * v, o), hi ? dg(-26, -13, 0, 13, 26) : dg(-26, 0, 26), hi ? [0, .25, .5, .75, 1] : [0, .5, 1], rgb(L.shirt2) ? lin(L.shirt2) : lin(L.shirt, 1.15), B.chest, OB);
      // 下摆一道边（精细档）
      if (hi && !apron) K.surf(bodyF(wide, 1.014), ring(24), [12.2, 13], lin(L.shirt, .86), B.chest, { wrap: true, c: BC });
    }
    // 胸前的小徽章
    if (rgb(L.logo)) disc(bodyF(wide, bodyK + .028), Math.asin(-3.6 / 7), 16.6, 1.6, lin(L.logo), hi ? 12 : 6);
    // 腰 / 裙子
    const cBot = lin(L.bottom);
    if (skirt && !coat) {
      const sk = (u, y, o) => { const w = skirtW(y) * (1 + .04 * clamp((14.6 - y) / 7.8, 0, 1) * Math.cos(8 * u)); o[0] = w * Math.sin(u); o[1] = y; o[2] = w * .79 * Math.cos(u); }, n = hi ? 32 : 16;
      K.surf(sk, ring(n), hi ? [14.6, 12.8, 11, 9, 6.8] : [14.6, 11, 6.8], cBot, B.hips, { wrap: true, c: [0, 10, 0] });
      K.surf((u, v, o) => { sk(u, 6.8, o); o[0] *= 1 - v; o[2] *= 1 - v; }, ring(n), [0, 1], lin(L.bottom, .72), B.hips, { wrap: true, dir: [0, -1, 0] });
    } else if (!coat) K.surf(ell(0, 11.2, 0, 6.6, 3, 5.2), ring(hi ? 16 : 10), dseq(0, 180, hi ? 6 : 4), cBot, B.hips, { wrap: true });
    // 围裙：贴着身子前面的一片布，从胸口垂到膝盖（正面看是 2D 那样的一块长方形）。跟着身子、裙子的弧度走，有一点厚度——四边往里折回到身上，
    // 不是悬在身前的一张纸；穿裤子的，胯以下那一截是垂着的，背面也做上。精细档还有挂脖子的带子、腰上一圈带子和背后的蝴蝶结
    if (apron) {
      const cA = lin(apron), cEdge = lin(apron, .84), th = hi ? .36 : .3, free = !skirt && !coat;
      // 这个高度上身子（连裙子 / 大衣 / 胯）前面有多宽
      const env = y => {
        if (coat) return wideC(y);
        const t = wide(Math.max(y, 10.4)) * bodyK * (y < 10.4 ? 1 - .018 * (10.4 - y) : 1), b = skirt ? skirtW(y) * 1.02 : 6.75 * Math.sqrt(Math.max(0, 1 - ((y - 11.2) / 3) * ((y - 11.2) / 3)));
        return .5 * (t + b + Math.sqrt((t - b) * (t - b) + .5));   // 取大的那个，交接的地方圆一点（布不会折出一道死褶）
      };
      // 围裙上的一点：u 左右（-1 到 1，合 ±5.3 个单位宽）、y 高度、off 离身子表面多远
      const pan = (u, y, off, o) => { const w = env(y), x = 5.3 * u, su = Math.pow(Math.min(.985, Math.abs(x) / w), 1 / .92), k = 1 + off / w; o[0] = x * k; o[1] = y; o[2] = .77 * w * Math.pow(1 - su * su, .46) * k; };
      const us = seq(-1, 1, hi ? 8 : 4), ys = hi ? [19.5, 17.9, 16.3, 14.7, 13.2, 11.8, 10.4, 8.7, 7] : [19.5, 15.5, 12.5, 10.4, 8.5, 7], rim = v => th * (1 - v) - .1 * v;
      K.surf((u, y, o) => pan(u, y, th, o), us, ys, cA, B.chest, { dir: [0, 0, 1] });
      [1, -1].forEach(sx => K.surf((v, y, o) => pan(sx, y, rim(v), o), [0, 1], ys, cEdge, B.chest, { dir: [sx, 0, .2] }));
      K.surf((u, v, o) => pan(u, 7, rim(v), o), us, [0, 1], cEdge, B.chest, { dir: [0, -1, .1] });
      K.surf((u, v, o) => pan(u, 19.5, rim(v), o), us, [0, 1], cEdge, B.chest, { dir: [0, 1, .1] });
      if (free) K.surf((u, y, o) => pan(u, y, -.1, o), us, ys.filter(y => y <= 10.4), cEdge, B.chest, { dir: [0, 0, -1] });
      if (hi) {
        const fw = bodyF(wide, bodyK + .035), wz = wide(14.7) * bodyK * .77;
        K.surf(fw, dseq(50, 310, 18), [14.1, 15.3], lin(apron, .9), B.chest, OB);
        bow(K, [0, 14.7, -wz - .5], [1, 0, 0], [0, 0, -1], [0, 1, 0], .62, cA, lin(apron, .85), B.chest, true);
        [1, -1].forEach(sx => K.surf(sweep(bez([sx * 4.2, 19.3, 4.3], [sx * 4.9, 21.6, 4], [sx * 5.4, 23.4, 1.5], [sx * 4.6, 23, -2.5]), () => .55, [1, 0, 0], .7, 1.5), dseq(0, 360, 4), seq(0, 1, 5), lin(apron, .9), B.chest, { wrap: true, keep: true }));
      }
    }
    // 腿和鞋。穿裙子的露腿，袜子是白的；长裤精细档有一道裤脚
    const legC = skirt ? cSkin : cBot, nl = hi ? 12 : 8, barefoot = shoes.toLowerCase() === String(L.skin).toLowerCase();
    [1, -1].forEach(sx => {
      const bone = sx > 0 ? B.legL : B.legR, f = limb([sx * 3.3, 11.6, 0], [sx * 3.3, 2.6, 0], 2.5, 2.2), us = dseq(0, 360, nl), ok = { wrap: true, keep: true };
      if (skirt) { K.surf(f, us, [.12, .25, .628], legC, bone, ok); K.surf(f, us, [.628, .75], lin('#ffffff'), bone, ok); if (hi) K.surf(limb([sx * 3.3, 4.9, 0], [sx * 3.3, 4.4, 0], 2.48, 2.48), us, [.1, .25, .75, .9], lin('#eeeeee'), bone, ok); }
      else { K.surf(f, us, [.12, .25, .75], legC, bone, ok); if (hi) K.surf(limb([sx * 3.3, 4.6, 0], [sx * 3.3, 3.4, 0], 2.62, 2.58), us, [.1, .25, .75, .9], lin(L.bottom, .84), bone, ok); }
      // 鞋（跟着脚踝那根骨头，踩在地上时是平的）：鞋头长、鞋跟短；精细档下面多一层鞋底，鞋头上一小块亮的
      const sole = hi && !barefoot ? .85 : 0, foot = sx > 0 ? B.footL : B.footR;
      const shoe = (k, y0) => (u, v, o) => { const s = Math.pow(Math.sin(v), .62), cu = Math.cos(u); o[0] = sx * 3.3 + 3.05 * k * s * Math.sin(u) * (1 + .1 * cu); o[1] = Math.max(y0, 1.75 + 2 * Math.cos(v)); o[2] = .2 + (cu >= 0 ? 4.6 : 2.6) * k * s * spw(cu, .85); };
      K.surf(shoe(1, sole * .7), ring(hi ? 14 : 8), hi ? dseq(0, 180, 7) : dg(0, 45, 85, 125, 180), lin(shoes), foot, { wrap: true, c: [sx * 3.3, 1.5, .5] });
      if (sole) {
        K.surf((u, v, o) => { shoe(1.045, 0)(u, 90 * D, o); o[1] = lerp(sole, 0, v); }, ring(14), [0, 1], rgb(shoes).reduce((a, b) => a + b) > 600 ? lin(shoes, .78) : mixLin(shoes, '#f4f1ea', .8), foot, { wrap: true, c: [sx * 3.3, .4, .5] });
        K.surf((u, v, o) => { shoe(1.045, 0)(u, 90 * D, o); const k = 1 - v; o[0] = sx * 3.3 + (o[0] - sx * 3.3) * k; o[2] = .2 + (o[2] - .2) * k; o[1] = sole; }, ring(14), [0, .12], lin(shoes, .7), foot, { wrap: true, dir: [0, 1, 0] });
        K.surf(shoe(1.025, 0), dg(-28, 0, 28), dg(38, 50, 62), mixLin(shoes, '#ffffff', .45), foot, { c: [sx * 3.3, 1.5, .5] });
      }
    });
    // 手臂和手（平常稍微往外张开一点）；精细档有袖口、手上有个大拇指
    const cSleeve = lin(sleeve);
    [1, -1].forEach(sx => {
      const bone = sx > 0 ? B.armL : B.armR, S0 = [sx * 7.6, 20.2, 0], W0 = [sx * 9.5, 13, .4], ok = { wrap: true, keep: true };
      K.surf(limb(S0, W0, 2.2, 1.9), dseq(0, 360, nl), hi ? [0, .08, .17, .25, .5, .75] : [0, .125, .25, .75], cSleeve, bone, ok);
      K.surf(ell(sx * 9.75, 11.7, .5, 2.3, 2.3, 2.3), ring(hi ? 10 : 6), dseq(0, 180, hi ? 7 : 4), cSkin, bone, { wrap: true });
      if (hi) {
        const at = t => [lerp(S0[0], W0[0], t), lerp(S0[1], W0[1], t), lerp(S0[2], W0[2], t)];
        K.surf(limb(at(.86), at(1), 2.12, 2.12), dseq(0, 360, nl), [.1, .25, .75, .9], jacket || coat ? lin(sleeve, .84) : rgb(L.shirt2) ? lin(L.shirt2) : lin(L.shirt, .86), bone, ok);
        K.surf(ell(sx * 9.1, 11.9, 2.25, 1.05, 1.3, 1.1), ring(6), dseq(0, 180, 4), cSkin, bone, { wrap: true });
      }
    });
    // 背包：圆角方块，上面一片深一点的盖子，后面一个小口袋；前面两条背带。精细档还有提手、搭扣、两边的小兜
    if (bag) {
      const c0 = [0, 15.9, -8.1], box = k => sell(c0[0], c0[1], c0[2], 6.5 * k, 5.7, 3.1 * k, .55, .6), n = hi ? 20 : 12;
      K.surf(box(1.06), ring(n), hi ? dg(0, 18, 36, 54, 72, 87) : dg(0, 30, 60, 87), lin(bag, .9), B.bag, { wrap: true, c: c0 });
      K.surf(box(1), ring(n), hi ? dg(80, 100, 120, 140, 160, 180) : dg(80, 110, 145, 180), lin(bag), B.bag, { wrap: true, c: c0 });
      K.surf(sell(0, 13.3, -11, 3.7, 2, 1.1, .6, .6), ring(hi ? 12 : 8), dseq(0, 180, hi ? 5 : 3), lin(bag, 1.08), B.bag, { wrap: true });
      if (hi) {
        K.surf(sell(0, 17.2, -11.5, 1.25, 1.1, .55, .6, .6), ring(8), dseq(0, 180, 4), mixLin(bag, '#ffffff', .55), B.bag, { wrap: true });
        K.surf(sweep(bez([-2.4, 21.2, -8.1], [-2.4, 24, -8.1], [2.4, 24, -8.1], [2.4, 21.2, -8.1]), () => .55, [0, 0, 1]), dseq(0, 360, 5), seq(0, 1, 6), lin(bag, .8), B.bag, { wrap: true, keep: true });
        [1, -1].forEach(sx => K.surf(sell(sx * 6.9, 13.7, -8.1, 1, 2.3, 1.9, .7, .7), ring(8), dseq(0, 180, 4), lin(bag, .95), B.bag, { wrap: true }));
      }
      const wf = y => wide(y) * bodyK + .5;
      [1, -1].forEach(sx => K.surf((u, y, o) => { const w = wf(y), x = sx * (5.2 + u); o[0] = x; o[1] = y; o[2] = w * .77 * Math.sqrt(Math.max(.02, 1 - (x / w) * (x / w))); }, hi ? [-1, 0, 1] : [-1, 1], hi ? [13.7, 15, 16.5, 18, 19.2, 20.2, 21, 21.6] : [13.7, 16, 18.5, 20.2, 21.4], lin(bag, .85), B.chest, { dir: [0, 0, 1] }));
      rest.bag = [0, 21, -5.2];
    }

    let maxY = 0;
    for (let i = 1; i < K.p.length; i += 3) if (K.p[i] > maxY) maxY = K.p[i];
    return { geo: K.geo(T, [0, 0, 0], true), face: F.geo(T, rest.head, false), rest, height: Math.max(maxY, top) * U, tris: K.tris + F.tris };
  }

  // ---------- 脸的贴图 ----------
  // 横着是绕头的经度（左右各 90°，按头最宽那一圈的弧长算），竖着是高度：眼睛、腮红是「画在球面上」的，绕到头的两侧，所以正面、斜着、侧面看都在。
  // 画法和 people.js 一样（深色的眼睛、下半截的虹膜、两个高光、上眼线、腮红、嘴），另外加了淡淡的眉毛；底色就是肤色。鼻子是网格上的小鼓包，不画在这里
  function faceCanvas(L, girl, hi, glasses) {
    const W = hi ? 768 : 384, H = hi ? 320 : 160, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), FTOP = HR[1] * Math.cos(60 * D);
    g.fillStyle = L.skin; g.fillRect(0, 0, W, H);
    // 之后的坐标：正脸中间、头中心那么高是原点，x 是沿着头的表面往右量的弧长，y 往下，单位和 people.js 一样
    g.setTransform(W / FACE_W, 0, 0, H / FH, W / 2, FTOP * H / FH);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const el = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); };
    const eyeC = hexOr(L.eye, '#6b4a32'), ink = '#2b2233', X = EYE_LON * D * HR[0], y = -EYE_Y, rx = 3 / rhoOf(EYE_Y), ry = 3.35;
    [-1, 1].forEach(m => {
      const x = m * X;
      // 眉毛：头发的颜色压暗，细细的一道（刘海缝里才看得见）
      g.strokeStyle = css(L.hair, .62); g.globalAlpha = .7; g.lineWidth = girl ? .55 : .7;
      g.beginPath(); g.moveTo(x - m * 2.5, y - 6.1); g.quadraticCurveTo(x + m * .4, y - 7.1, x + m * 3.1, y - 6); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = ink; el(x, y, rx, ry); g.fill();
      const gr = g.createLinearGradient(0, y - 1, 0, y + 3.2); gr.addColorStop(0, css(eyeC, .78)); gr.addColorStop(1, css(eyeC, 1.22));
      g.fillStyle = gr; el(x, y + 1, rx * .8, 2.12); g.fill();
      g.fillStyle = 'rgba(255,255,255,.96)'; el(x - .8, y - 1.3, 1.18, 1.18); g.fill(); el(x + .85, y + 1.6, .5, .5); g.fill();
      // 上眼线：中间粗两头尖，贴着眼睛上沿；女孩外眼角往上翘一点
      g.fillStyle = ink; g.beginPath();
      g.moveTo(x - m * (rx + .6), y - 1.9); g.quadraticCurveTo(x - m * .2, y - 5.15, x + m * (rx + .8), y - 2.45);
      if (girl) { g.lineTo(x + m * (rx + 1.95), y - 3.7); g.lineTo(x + m * (rx + .6), y - 1.7); }
      g.quadraticCurveTo(x, y - 3.6, x - m * (rx + .6), y - 1.9); g.fill();
      // 腮红：在眼睛的外下方，侧面看正好在脸颊上
      const bx = m * 52 * D * HR[0], by = 6.3, br = 2.75 / rhoOf(-by), gb = g.createRadialGradient(bx, by, .2, bx, by, br);
      gb.addColorStop(0, 'rgba(255,112,130,.5)'); gb.addColorStop(.6, 'rgba(255,112,130,.4)'); gb.addColorStop(1, 'rgba(255,112,130,0)');
      g.fillStyle = gb; g.save(); g.translate(bx, by); g.scale(1, .52); g.translate(-bx, -by); el(bx, by, br, br); g.fill(); g.restore();
    });
    const mw = 1.7 / rhoOf(-7.3);
    g.strokeStyle = '#9a4a3c'; g.lineWidth = 1; g.beginPath(); g.moveTo(-mw, 6.5); g.quadraticCurveTo(0, 8.3, mw, 6.5); g.stroke();
    if (glasses) {
      const r = 3.95;
      g.strokeStyle = '#3b3b4a'; g.lineWidth = .95;
      el(-X, y, r, r); g.stroke(); el(X, y, r, r); g.stroke();
      g.beginPath(); g.moveTo(-(X - r), y - .4); g.lineTo(X - r, y - .4); g.moveTo(-(X + r), y - .6); g.lineTo(-FACE_W / 2, y - 1.4); g.moveTo(X + r, y - .6); g.lineTo(FACE_W / 2, y - 1.4); g.stroke();
    }
    return c;
  }

  // ---------- 缓存：网格按造型、脸的贴图按脸、材质按「谁给的工厂」 ----------
  const GEO = new Map(), FACE = new Map(), MATS = new Map(), LIVE = new Set(), KEEP = 48, KEEP_FACE = 20;   // 脸的贴图大（精细档 768×320，连同缩小图约 1.3MB），少留一些
  const stat = { built: 0, ms: 0 };
  let ramp = null, useN = 0, seedN = 0;
  const geoKey = (L, hi) => [hi ? 'H' : 'L', L.skin, L.hair, STYLE[L.style] ? L.style : 'short', L.hat || '', L.hat ? hexOr(L.hatC, '') : '', L.hat === 'cap' ? hexOr(L.hatLogo, '') : '', L.hat === 'headset' ? hexOr(L.micC, '') : '', L.shirt, hexOr(L.shirt2, ''), hexOr(L.jacket, ''), hexOr(L.coat, ''), hexOr(L.apron, ''), L.bottom, L.skirt ? 1 : 0, hexOr(L.shoes, ''), hexOr(L.bag, ''), hexOr(L.logo, ''), hi && L.glasses ? 1 : 0].join('|');
  const isGirl = L => (L.lash != null ? !!L.lash : !!GIRL[L.style]);
  const faceKey = (L, hi) => [hi ? 'H' : 'L', L.skin, L.hair, hexOr(L.eye, ''), isGirl(L) ? 1 : 0, L.glasses && !hi ? 1 : 0].join('|');
  function trim(map, free, keep) {   // 没人用的留一些（换地图回来不用重搭），太多了才放掉最久没用的
    if (map.size <= keep) return;
    [...map.entries()].filter(e => !e[1].refs).sort((a, b) => a[1].used - b[1].used).slice(0, map.size - keep).forEach(([k, e]) => { free(k, e); map.delete(k); });
  }
  const freeGeo = (k, e) => { e.geo.dispose(); e.face.dispose(); };
  const freeFace = (k, e) => { e.tex.dispose(); MATS.forEach(m => { const mt = m.face.get(k); if (mt) { mt.dispose(); m.face.delete(k); } }); };
  // 自带的材质：三档明暗（背光 / 半亮 / 亮面）的卡通材质，和大地图的明暗是一个路子；背光面不压得太暗（不低于本色的 66%），小人才干净
  function defMat(kind, p) {
    const T = window.THREE;
    if (!ramp) {
      const n = 64, d = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = (i + .5) / n * 2 - 1; d[i] = Math.round(255 * (.56 * sst(-.03, .05, x) + .44 * sst(.44, .53, x))); }
      ramp = new T.DataTexture(d, n, 1, T.RedFormat); ramp.minFilter = ramp.magFilter = T.LinearFilter; ramp.needsUpdate = true;
    }
    const m = kind === 'face' ? new T.MeshToonMaterial({ gradientMap: ramp, map: p.map }) : new T.MeshToonMaterial({ gradientMap: ramp, vertexColors: true });
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = clamp(outgoingLight, diffuseColor.rgb * 0.66, diffuseColor.rgb * 1.06);\n#include <opaque_fragment>'); };
    m.customProgramCacheKey = () => 'people3d';
    return m;
  }
  function matsOf(fn) { let m = MATS.get(fn); if (!m) MATS.set(fn, (m = { body: null, face: new Map() })); return m; }

  function has(look, state) {
    const T = window.THREE;
    if (!T || !T.Bone || !T.Skeleton || !T.SkinnedMesh || !T.MeshToonMaterial) return false;
    if (!look || typeof look !== 'object') return false;
    if (!rgb(look.skin) || !rgb(look.hair) || !rgb(look.shirt) || !rgb(look.bottom)) return false;
    return STATES[state == null ? '' : state] === 1;
  }

  function create(look, opts) {
    if (!has(look)) return null;
    opts = opts || {};
    const T = window.THREE, L = look, hi = opts.detail !== 'low';
    // 网格
    const gk = geoKey(L, hi);
    let ge = GEO.get(gk);
    if (!ge) {
      const t0 = performance.now();
      ge = build(T, L, hi); ge.refs = 0;
      stat.built++; stat.ms += performance.now() - t0;
      GEO.set(gk, ge);
    }
    ge.refs++; ge.used = ++useN;
    // 脸的贴图
    const fk = faceKey(L, hi);
    let fe = FACE.get(fk);
    if (!fe) {
      const tex = new T.CanvasTexture(faceCanvas(L, isGirl(L), hi, L.glasses && !hi));
      tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      fe = { tex, refs: 0 }; FACE.set(fk, fe);
    }
    fe.refs++; fe.used = ++useN;
    // 材质：身体的大家共用一个，脸的每张贴图一个
    const fn = typeof opts.mat === 'function' ? opts.mat : defMat, ms = matsOf(fn);
    if (!ms.body) ms.body = fn('body', {}) || defMat('body', {});
    let fm = ms.face.get(fk);
    if (!fm) { fm = fn('face', { map: fe.tex }) || defMat('face', { map: fe.tex }); ms.face.set(fk, fm); }

    // 骨头（每个人自己一副）
    const bones = BONES.map(n => { const b = new T.Bone(); b.name = n; return b; }), rest = ge.rest, bn = {};
    BONES.forEach((n, i) => {
      const p = PARENT[i], r = rest[n], q = p < 0 ? [0, 0, 0] : rest[BONES[p]];
      bones[i].position.set((r[0] - q[0]) * U, (r[1] - q[1]) * U, (r[2] - q[2]) * U);
      if (p >= 0) bones[p].add(bones[i]);
      bn[n] = bones[i];
    });
    const body = new T.SkinnedMesh(ge.geo, ms.body);
    body.add(bones[0]);
    body.bind(new T.Skeleton(bones));
    // 蒙皮网格的包围球不会跟着动作变：直接给一个够大的（省得每个人都按顶点算一遍）
    const bs = ge.geo.boundingSphere.clone(); bs.radius *= 1.35; body.boundingSphere = bs;
    const face = new T.Mesh(ge.face, fm);
    bn.head.add(face);
    const root = new T.Group(), pivot = new T.Group();
    root.add(pivot); pivot.add(body);
    const rp = BONES.map((n, i) => bones[i].position.clone());   // 每根骨头原来的位置

    const seed = opts.seed != null ? +opts.seed : (++seedN * .618) % 1;
    const S = { dir: 'down', yaw: 0, yawT: 0, moving: false, speed: 2.4, state: '', phase: null, hopT: 0, t: seed * 20, ph: 0, w: 0, ticked: false, blink: 1.2 + seed * 3, closed: 0, W: { bike: 0, surf: 0, hop: 0, talk: 0, wave: 0 }, tail: [0, 0, 0, 0], bagA: 0, bagV: 0 };
    const G = {}, LA = {}, LB = {};   // 这一帧的步子、左腿、右腿
    bn.lid.scale.setScalar(.001);
    const spring = (i, target, dt, om, ze) => { S.tail[i + 1] += (om * om * (target - S.tail[i]) - 2 * ze * om * S.tail[i + 1]) * dt; S.tail[i] += S.tail[i + 1] * dt; };
    const P = (i, x, y, z) => bones[i].position.set(rp[i].x + x * U, rp[i].y + y * U, rp[i].z + z * U);

    const inst = {
      root, pivot, body, face, look: L, bones: bn, height: ge.height, tris: ge.tris, detail: hi ? 'high' : 'low',
      // speed：在地上走多快——世界单位每秒，按 root 的大小是 1 算（root 放大了几倍就除以几；没给过就按 2.4）。迈步的快慢和步子大小都按它来，给对了脚就不滑
      // state: 'hop' 时的 phase：0（起跳）到 1（落地）；不给就自己用 0.3 秒走完
      set(o) {
        if (!o) return inst;
        if (o.dir && DIRYAW[o.dir] != null) { S.dir = o.dir; S.yawT = DIRYAW[o.dir]; if (!S.ticked || o.snap) { S.yaw = S.yawT; pivot.rotation.y = S.yaw; } }
        if (o.moving != null) S.moving = !!o.moving;
        if (o.speed != null && isFinite(o.speed)) S.speed = clamp(+o.speed, 0, 14);
        if (o.state != null) S.state = STATES[o.state] ? (o.state === 'idle' || o.state === 'walk' ? '' : o.state) : '';
        if (o.phase !== undefined) S.phase = o.phase == null || !isFinite(o.phase) ? null : clamp(+o.phase, 0, 1);
        return inst;
      },
      tick(dt) {
        dt = clamp(+dt || 0, 0, .1);
        S.ticked = true; S.t += dt;
        const t = S.t, W = S.W;
        // 转身：走最近的那一边，很快但不是一下子
        const dy = wrapPi(S.yawT - S.yaw), turn = dy * (1 - Math.exp(-dt * 16)), yawV = dt > 0 ? turn / dt : 0;
        S.yaw += turn; pivot.rotation.y = S.yaw;
        // 各种姿势占多少（慢慢过渡；跳很短，过渡要快）
        const k = 1 - Math.exp(-dt * 11), kHop = 1 - Math.exp(-dt * 30);
        S.w += ((S.moving ? 1 : 0) - S.w) * k;
        for (const n in W) W[n] += ((S.state === n ? 1 : 0) - W[n]) * (n === 'hop' ? kHop : k);
        const idle = 1 - S.w, br = Math.sin(t * 2.3), ride = Math.max(W.bike, W.surf, W.hop);
        const w = S.w * (1 - ride);                   // 走路的动作：骑车、踏浪、跳的时候不要
        // ---- 走 / 跑：步子按真的速度来，踩在地上的那只脚不滑（见上面的 gait / legAt） ----
        const v = Math.max(.3, S.speed);
        gait(v, G);
        if (S.moving || S.w > .02) S.ph += dt * (S.state === 'bike' ? clamp(.5 + .22 * v, .8, 3.2) : G.f);
        const p = S.ph - Math.floor(S.ph), cs = Math.sin(p * TAU), cc = Math.cos(p * TAU);
        legAt(p, G, LA); legAt(p + .5, G, LB);
        // 胯多高：有脚踩着地就由那条腿定（腿斜着时矮一点）；两脚都离地时画一道小弧线
        let hip;
        if (LA.on) hip = ANK + LG * Math.cos(LA.th) - LA.comp;
        else if (LB.on) hip = ANK + LG * Math.cos(LB.th) - LB.comp;
        else { const q = p < .5 ? p : p - .5, uf = clamp((q - G.d) / Math.max(1e-4, .5 - G.d), 0, 1); hip = ANK + LG * Math.cos(G.A) + G.air * 4 * uf * (1 - uf); }
        // 腿往上收多少：踩着地的正好收到脚贴地；迈步的那只抬起来，而且不能踩进地里
        const upA = Math.max(LA.lift, ANK + LG * Math.cos(LA.th) - hip), upB = Math.max(LB.lift, ANK + LG * Math.cos(LB.th) - hip);
        // ---- 跳台阶：hu 从 0（起跳）到 1（落地）。上去的时候腿收起来、手往上抬，下来的时候腿伸出去够地面，落地蹲一下；头发和背包慢半拍 ----
        if (S.state === 'hop') { if (S.phase == null) S.hopT = Math.min(1, S.hopT + dt / .3); } else S.hopT = 0;
        const hu = S.phase != null ? S.phase : S.hopT, hw = W.hop, vy = Math.cos(Math.PI * hu);
        const tuck = Math.sin(Math.PI * clamp(hu / .62, 0, 1)), reach = sst(.5, .82, hu) * (1 - sst(.93, 1, hu)), squat = 1 - sst(0, .14, hu) + sst(.9, 1, hu);
        const fall = Math.max(0, -vy) * hw, rise = Math.max(0, vy) * hw;
        // 胯和上身：腿不跟着上身歪（不然踩着地的脚会被带着动），前倾、左右拧都只在上身
        P(B.hips, 0, (hip - LEG) * w - .25 * W.surf - 1.4 * squat * hw, 0);
        bn.hips.rotation.set(0, 0, .04 * Math.sin(t * 2.1) * W.surf);
        const lean = Math.min(.2, .03 + .028 * v) * w, tw = Math.min(.22, .1 + .02 * v) * (LA.xn - LB.xn) * .5 * w;
        bn.chest.rotation.set(lean + .2 * W.bike + (.2 * tuck - .1 * reach) * hw, tw, 0);
        bn.chest.scale.set(1 + .008 * br, 1 + .016 * br, 1 + .02 * br);
        // 头：待机时轻轻晃、偶尔歪一下；走路时不跟着上身前倾和拧；说话时点头
        P(B.head, 0, .16 * br, 0);
        bn.head.rotation.set(-lean * .6 - .12 * W.bike + (.05 + .07 * Math.sin(t * 7.5)) * W.talk + (.14 * reach - .12 * tuck) * hw, -tw * .6 + .06 * Math.sin(t * .6 + seed * 9) * idle, .028 * Math.sin(t * .9 + seed * 5) * idle);
        // 手臂：和同一边的腿反着摆，走得越快摆得越大
        const aA = clamp(.3 + .1 * v, .3, .95) * w;
        const az = .1 * w + .025 * br * idle + (.25 + 1.75 * sst(.04, .42, hu) - 1.65 * sst(.8, 1, hu)) * hw + (.55 + .08 * Math.sin(t * 2.6)) * W.surf + (.2 + .06 * Math.sin(t * 7.5)) * W.talk;
        bn.armL.rotation.set(aA * LA.xn - 1.05 * W.bike - (.5 * tuck - .15 * reach) * hw - (.3 + .25 * Math.sin(t * 3.1)) * W.talk, 0, az);
        const wv = W.wave;
        bn.armR.rotation.set((aA * LB.xn - 1.05 * W.bike - (.35 * tuck - .15 * reach) * hw) * (1 - wv), 0, -az * (1 - wv) - (1.85 + .3 * Math.sin(t * 11)) * wv);
        // 腿和脚。th 是腿往前摆的角度；鞋绕脚踝反着转回来，踩在地上时是平的，迈步时先脚尖朝下、落地前翘起来一点
        const pb = W.bike * (S.moving ? 1 : .4), pedal = .32 * cs * pb, hopUp = (4.2 * tuck + 1.4 * squat) * hw;
        const thA = LA.th * w + .5 * W.bike + pedal + (.45 * tuck + .32 * reach) * hw, thB = LB.th * w + .5 * W.bike - pedal + (.2 * tuck - .12 * reach) * hw;
        bn.legL.rotation.set(-thA, 0, .3 * W.surf); bn.legR.rotation.set(-thB, 0, -.3 * W.surf);
        P(B.legL, 0, upA * w + (1 + cc) * .7 * pb + hopUp, 0);
        P(B.legR, 0, upB * w + (1 - cc) * .7 * pb + hopUp, 0);
        const toe = (.5 * tuck + .35 * reach) * hw - .1 * W.bike;
        bn.footL.rotation.set(thA + (LA.on ? 0 : .4 * Math.sin(TAU * LA.u)) * w + toe, 0, -.3 * W.surf);
        bn.footR.rotation.set(thB + (LB.on ? 0 : .4 * Math.sin(TAU * LB.u)) * w + toe, 0, .3 * W.surf);
        // 马尾 / 双马尾 / 背包：慢半拍跟着晃（弹簧）。走得快往后飘；往下落的时候飘起来
        const n = Math.max(1, Math.ceil(dt / .017)), h = dt / n;
        const tx = (.1 + .05 * Math.min(v, 6)) * w + .12 * Math.cos(2 * p * TAU - .9) * w + .035 * Math.sin(t * 1.4 + seed * 7) + .9 * fall - .2 * rise + .4 * W.bike * (S.moving ? 1 : 0);
        const tz = .15 * Math.sin(p * TAU - .7) * w - clamp(yawV * .05, -.5, .5);
        const bt = (.08 * Math.cos(2 * p * TAU - 1.1) + .03) * w + .4 * fall;
        for (let i = 0; i < n; i++) { spring(0, tx, h, 13, .3); spring(2, tz, h, 13, .3); S.bagV += (18 * 18 * (bt - S.bagA) - 2 * .35 * 18 * S.bagV) * h; S.bagA += S.bagV * h; }
        bn.tailA.rotation.set(S.tail[0], 0, S.tail[2]);
        bn.tailB.rotation.set(S.tail[0], 0, S.tail[2]);
        bn.bag.rotation.x = Math.max(-.02, S.bagA);
        // 眨眼
        S.blink -= dt;
        if (S.blink <= 0) { if (S.closed) { S.closed = 0; S.blink = 2.2 + ((Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1 * 3.4; } else { S.closed = 1; S.blink = .12; } bn.lid.scale.setScalar(S.closed ? 1 : .001); }
        return inst;
      },
      dispose() {
        if (!LIVE.has(inst)) return;
        LIVE.delete(inst);
        if (root.parent) root.parent.remove(root);
        bn.head.remove(face);
        body.skeleton.dispose();
        ge.refs--; fe.refs--;
        trim(GEO, freeGeo, KEEP); trim(FACE, freeFace, KEEP_FACE);
      },
    };
    LIVE.add(inst);
    return inst;
  }

  function release() {
    [...LIVE].forEach(i => i.dispose());
    GEO.forEach((e, k) => freeGeo(k, e)); GEO.clear();
    FACE.forEach(e => e.tex.dispose()); FACE.clear();
    MATS.forEach(m => { if (m.body) m.body.dispose(); m.face.forEach(x => x.dispose()); }); MATS.clear();
    if (ramp) { ramp.dispose(); ramp = null; }
  }

  window.EchoPeople3D = {
    has, create, release, STATES: Object.keys(STATES), BONES,
    // 这个速度下步子是什么样：f 每秒几个来回（一个来回两步）、d 一只脚踩在地上占一个来回的多少（0.5 = 走，小于 0.5 = 跑）、stride 踩在地上那一段有多长（世界单位）
    gait: v => { const o = {}; gait(Math.max(.3, +v || 0), o); return { f: o.f, d: o.d, stride: o.stride * U, swing: o.A }; },
    // 给测试和预览页看的：缓存里有多少、一共搭过几个造型、花了多少毫秒
    stats: () => ({ geos: GEO.size, faces: FACE.size, mats: [...MATS.values()].reduce((n, m) => n + (m.body ? 1 : 0) + m.face.size, 0), live: LIVE.size, built: stat.built, ms: stat.ms }),
  };
})();
