// 回声岛 · 战斗特效库（物理系 + 辅助招式）：一般 normal、功夫 fight、飞行 flying、虫 bug、钢 steel；17 个属性的辅助招式
// 登记到 window.BattleFX.types[type] = { charge?, release, impact?, after?, physical?, ult?, generic? }（规格见 tools/FX_SPEC.md §2–§5）：
//   release(kit, ctx) 放出招式，**必须在命中那一刻 resolve**（monsters.js 接着出伤害数字、调 hit()）
//   charge(kit, ctx) 蓄力时加的东西（这里都不返回 Promise，不拖长蓄力）；impact / after 命中后、余韵（后台跑，不挡流程）
//   physical：true 扑得远（物理系），不写按属性猜（fight、normal 是物理系）；ult：大招特殊动作 'leap' | 'dash' | 'float'（编排在 battle3d.js 里做）；
//   generic：关掉 battle3d.js 通用命中里的哪几项（见下面 GEN）
//   kit = battle3d.js 给的工具箱（§3）；ctx = { a 出招点, b 命中点, dir, side, other, tier 0/1/2, cols = TYPE_COL[type], info, type }
//   这里自己的状态都放在 ctx.phys 里（命中点 hit、冲到哪 land、有没有冲出去 dashed……），别和编排的通用环节撞名
// 辅助招式登记到 window.BattleFX.support[type] = (kit, ctx) => {}（ctx.a、ctx.b 都是自己的中心；返回 Promise，约 0.9 秒，上限 1.2 秒）。
//
// 设计（FX_SPEC §5，全部原创）：
//   一般 normal   小招 Body Bump 全身发白光冲过去一撞 / 中招 Star Rush 金色星光拖尾、跳着弧线冲过去，五角大星 /
//                 大招 Giant Stomp 原地跺一脚蹲下 → 对手脚下亮出金色落点圈 → 高高跳出画面、地上的影子越来越大 → 拖着金色彗尾砸下来，
//                 三道地面冲击波 + 大命中星 + 尘土环 + 碎石 + 地裂
//   功夫 fight    小招 Quick Punch 一步踏进去打出一道橙色拳风 + 收拢的速度线 / 中招 Power Kick 冲过去一个回旋踢，大月牙弧光扫过 /
//                 大招 Hero Combo 冲到跟前连打三拳（三个命中星，对手一晃一晃），后撤运气，最后一记燃烧的重拳
//   飞行 flying   小招 Wing Slap 两道风刃交叉飞过去划出一个 X，羽毛四散 / 中招 Gust Dive 跳上天裹着风圈俯冲撞下来 /
//                 大招 Sky Storm 对手脚下卷起一股会扭动的龙卷风（自己的着色器），碎叶羽毛绕着往上转，最后「呼」地炸开
//   虫 bug        小招 Buzz Nip 几只发光小虫歪歪扭扭飞过去，两片大颚「咔」地合上 / 中招 Silk Shot 吐出一根白丝，在对手身上张开一张蛛网 /
//                 大招 Swarm Rush 一大群萤火虫从侧面绕一个大弯蜂拥过去，围着对手打转，最后一起扎进去炸开
//   钢 steel      小招 Iron Tap 一颗转着的钢螺母弹过去「当」：四角钢光 + 金色火花 / 中招 Steel Spin 甩出高速旋转的钢齿轮，磨出一大串火花 /
//                 大招 Metal Meteor 对手脚下亮出瞄准阵和越来越大的影子，一颗巨大的钢球拖着白热尾巴从天上砸下来，火花喷泉 + 地裂
// 物理系冲过去时出招方真的跑到对手跟前（改 kit.mon(side).off），停在对手侧前方、不挡住挨打的那只，命中后自己弹回原位
(function () {
  'use strict';
  const BFX = window.BattleFX = window.BattleFX || { types: {}, support: {} };
  const T = BFX.types = BFX.types || {}, S = BFX.support = BFX.support || {};

  // ---------- 公用小工具 ----------
  // 自己算数量（网格个数、虫子只数……）时按画质打折：高 1 / 中 .7 / 低 .45（kit.emit 的粒子数 kit 自己会打折）
  const QN = kit => kit.q === 'high' ? 1 : kit.q === 'mid' ? .7 : .45;
  const cnt = (kit, n) => Math.max(1, Math.round(n * QN(kit)));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const P = ctx => ctx.phys || (ctx.phys = {});
  const hitAt = ctx => (ctx.phys && ctx.phys.hit) || ctx.b;
  // 对手身前（往镜头挪一点）的命中点：飞过去的实心物件停在这里，不会钻进身体里看不见；同时记成 ctx.phys.hit
  function frontHit(kit, ctx, k) { const e = kit.cam.matrixWorld.elements, h = kit.mon(ctx.other).height, p = ctx.b.clone().add(kit.V(e[8], e[9], e[10]).normalize().multiplyScalar((k || .45) * h)); P(ctx).hit = p; return p; }
  const later = (ms, fn) => setTimeout(fn, ms);
  // 镜头的右、上、朝后（指向镜头）三个方向
  function basis(kit) {
    const e = kit.cam.matrixWorld.elements;
    return { R: kit.V(e[0], e[1], e[2]).normalize(), U: kit.V(e[4], e[5], e[6]).normalize(), F: kit.V(e[8], e[9], e[10]).normalize() };
  }
  // 离镜头近的命中点（对手打我方时，我方就在镜头跟前）画面上会大一倍左右：命中星、面向镜头的冲击波、速度线按距离缩一点
  const zs = (kit, at) => Math.max(.5, Math.min(1, kit.cam.position.distanceTo(at) / 7.5));
  // 屏幕上从 p 指向 q 的角度（镜头的右 = 0，上 = π/2）
  function screenAng(kit, p, q) { const { R, U } = basis(kit), d = q.clone().sub(p); return Math.atan2(d.dot(U), d.dot(R)); }
  const DUST = ['#d9c9a3', '#c8b48a', '#b39d72'];
  // 通用命中（battle3d.js 的 impactFx）只留往外迸的星光，其他自己来：
  //   命中星、冲击波每个属性自己画（两套叠在一起糊成一片白）；点光源自己放（通用的大招 12 再叠上自己的，台面和怪兽被照成一片白）；
  //   全屏闪自己来（通用的按属性色闪：钢的灰蓝、功夫的橙红被限频器换成发灰的淡色，截图里像画面变暗了一下）；
  //   大招放慢自己来：通用的同时把发光后期加到 2，这几个属性的特效都是浅色的，一晕就是一大团白，所以只放慢、不加强发光
  const GEN = { star: false, wave: false, flash: false, slowmo: false, light: false };
  const FLASH = { normal: '#fff4d6', fight: '#fff1e0', flying: '#eef6ff', bug: '#f7ffd0', steel: '#f2f6fb' };
  function climax(kit, ctx) {
    const t = ctx.tier, col = FLASH[ctx.type] || '#ffffff';
    // 只有大招闪屏、放慢（中招不闪：暴击时 hit() 自己会闪，两次挨得太近会被限频器换成发光后期加强，满屏发白）
    if (t === 2) { kit.flash(col, { strength: .32, ms: 300 }); kit.slowmo(.35, 260); }
  }

  // ---------- 共用几何体（kit.geo 按名字缓存，战斗结束一起释放） ----------
  // 月牙：外圆半径 1、圆心在原点；内圆往左挪 d（中间最厚 d，两头尖），凸的一边朝 +x，躺在 xy 平面
  function crescentGeo(T3, d) {
    const xi = -d / 2, yi = Math.sqrt(1 - xi * xi), ao = Math.atan2(yi, xi), ai = Math.atan2(yi, xi + d);
    const s = new T3.Shape();
    s.moveTo(xi, -yi);
    s.absarc(0, 0, 1, -ao, ao, false);
    s.absarc(-d, 0, 1, ai, -ai, true);
    return new T3.ShapeGeometry(s, 24);
  }
  // 钢齿轮：10 个齿、中间一个孔，厚 .26（半径 1，用的时候缩放）
  function gearGeo(T3) {
    const s = new T3.Shape(), N = 10, st = Math.PI * 2 / N, r1 = 1, r0 = .74;
    const pt = (r, a, first) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; if (first) s.moveTo(x, y); else s.lineTo(x, y); };
    for (let i = 0; i < N; i++) { const a = i * st; pt(r0, a, i === 0); pt(r1, a + st * .14); pt(r1, a + st * .44); pt(r0, a + st * .58); pt(r0, a + st * .79); }
    s.closePath();
    const hole = new T3.Shape(); hole.absarc(0, 0, .3, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new T3.ExtrudeGeometry(s, { depth: .26, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -.13);
    return g;
  }
  // 蛛网：9 根辐条 + 5 圈稍微下垂的横丝，每根丝是一条细带子（xy 平面，半径 1）
  function webGeo(T3) {
    const pos = [], idx = [], w = .022;
    const seg = (x0, y0, x1, y1) => {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w, k = pos.length / 3;
      pos.push(x0 + nx, y0 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0);
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    };
    let sd = 11; const rr = () => (sd = sd * 16807 % 2147483647) / 2147483647;   // 固定的随机数，每次一样
    const N = 9, A = [], L = [];
    for (let i = 0; i < N; i++) { A.push((i + (rr() - .5) * .35) / N * Math.PI * 2); L.push(.88 + rr() * .12); }
    for (let i = 0; i < N; i++) seg(0, 0, Math.cos(A[i]) * L[i], Math.sin(A[i]) * L[i]);
    [.2, .34, .48, .62, .76].forEach(r => {
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, a0 = A[i], a1 = A[j] + (j === 0 ? Math.PI * 2 : 0), am = (a0 + a1) / 2, rm = r * (.86 + rr() * .04);
        const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, xm = Math.cos(am) * rm, ym = Math.sin(am) * rm;
        seg(x0, y0, xm, ym); seg(xm, ym, Math.cos(a1) * r, Math.sin(a1) * r);
      }
    });
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  const G = {
    cresW: kit => kit.geo('phys:cres.34', () => crescentGeo(kit.T3, .34)),
    cresN: kit => kit.geo('phys:cres.12', () => crescentGeo(kit.T3, .12)),
    gear: kit => kit.geo('phys:gear', () => gearGeo(kit.T3)),
    web: kit => kit.geo('phys:web', () => webGeo(kit.T3)),
    nut: kit => kit.geo('phys:nut', () => new kit.T3.CylinderGeometry(.19, .19, .12, 6)),
    plate: kit => kit.geo('phys:plate', () => new kit.T3.CylinderGeometry(.13, .13, .03, 6)),
    ball: kit => kit.geo('phys:ball', () => new kit.T3.IcosahedronGeometry(1, 1)),
    band: kit => kit.geo('phys:band', () => new kit.T3.TorusGeometry(1.02, .1, 6, 28)),
    disc: kit => kit.geo('phys:disc', () => new kit.T3.CylinderGeometry(1, 1, .01, 32)),
    peb: kit => kit.geo('phys:peb', () => new kit.T3.IcosahedronGeometry(.09, 0)),
    rock: kit => kit.geo('phys:rock', () => new kit.T3.IcosahedronGeometry(.12, 0)),
    leaf: kit => kit.geo('leaf', kit.leafGeo),
    feather: kit => kit.geo('phys:feather', () => { const T3 = kit.T3, s = new T3.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.06, .1, .022, .3); s.quadraticCurveTo(-.012, .2, -.04, .12); s.quadraticCurveTo(-.03, .05, 0, 0); return new T3.ShapeGeometry(s, 8); }),
  };

  // ---------- 龙卷风柱的着色器（飞行大招 Sky Storm 用） ----------
  // 一个往上张开的漏斗（LatheGeometry），表面是斜着往上转的风纹，边缘（侧面看过去的轮廓）更浓、正中间透明——里面的对手看得见
  const FUN_VS = `
uniform float uTime; uniform float uWob;
varying vec2 vUv; varying float vF;
void main() {
  vUv = uv;
  vec3 p = position;
  float y = uv.y;
  p.x += sin(uTime * 3.3 + y * 3.4) * uWob * y;   // 越往上扭得越厉害
  p.z += cos(uTime * 2.9 + y * 2.8) * uWob * y;
  vec4 wp = modelMatrix * vec4(p, 1.);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vF = 1. - abs(dot(n, normalize(cameraPosition - wp.xyz)));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
  const FUN_FS = `
uniform vec3 uCol; uniform vec3 uCol2; uniform float uOp; uniform float uTime; uniform float uCover;
varying vec2 vUv; varying float vF;
void main() {
  float u = vUv.x, v = vUv.y, t = uTime;
  float k1 = sin((u * 4. + v * 2.4 - t * 2.4) * 6.2831853);
  float k2 = sin((u * 9. + v * 3.6 - t * 4.2) * 6.2831853 + 1.7);
  float k3 = sin((u * 2. - v * .6 - t * 1.2) * 6.2831853 + .4);
  float s = k1 * .55 + k2 * .3 + k3 * .15;
  float band = smoothstep(-.35, .75, s);   // 宽的螺旋风纹
  float hi = smoothstep(.6, .95, s);       // 亮一点的风线
  float edge = pow(vF, 2.);
  float fade = smoothstep(0., .1, v) * (1. - smoothstep(.72, 1., v));
  float a = (.22 + band * .42 + hi * .14 + edge * .2) * fade * uOp;
  vec3 c = mix(uCol * (.85 + .15 * band), uCol2, clamp(band * .45 + hi * .4, 0., 1.));
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
  a = clamp(a, 0., 1.);
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * uCover);
}`;
  // 每场战斗（每个 kit）自己的一小池龙卷风材质。userData.pool 设成 battle3d 材质池里没有的名字：特效到期时它不会被 dispose（下次接着用，不重新编译）
  const FUN = new WeakMap();
  function funnelMat(kit) {
    let pool = FUN.get(kit); if (!pool) FUN.set(kit, pool = []);
    let m = pool.find(x => !x.userData.busy);
    if (!m) {
      const T3 = kit.T3;
      m = new T3.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uWob: { value: .18 }, uCol: { value: new T3.Color() }, uCol2: { value: new T3.Color() }, uOp: { value: 0 }, uCover: { value: .55 } },
        vertexShader: FUN_VS, fragmentShader: FUN_FS, transparent: true, depthWrite: false, side: T3.DoubleSide, blending: T3.NormalBlending, premultipliedAlpha: true,
      });
      m.userData.pool = 'phys:funnel';
      pool.push(m);
    }
    m.userData.busy = true;
    return m;
  }
  const funnelGeo = kit => kit.geo('phys:funnel', () => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const y = i / 14; pts.push(new kit.T3.Vector2(.5 + .5 * Math.pow(y, 1.5), y)); }
    return new kit.T3.LatheGeometry(pts, 30);
  });

  // ---------- 小特效积木 ----------
  // 一圈尘土（贴地往外扩的烟团）：o = { n, r 起始半径, sp 速度, size, life, cols, cover }
  function dust(kit, at, o) {
    o = o || {}; const cols = o.cols || DUST, z = zs(kit, at);
    kit.emit(o.n || 16, () => {
      const a = kit.rnd(0, 6.283), v = kit.V(Math.cos(a), 0, Math.sin(a));
      return { pos: at.clone().addScaledVector(v, kit.rnd(0, o.r || .3)).setY(at.y + kit.rnd(.05, .2)), vel: v.multiplyScalar((o.sp || 2.5) * kit.rnd(.6, 1.1)).setY(kit.rnd(.2, .7)), col: pick(cols), size: (o.size || .8) * z * kit.rnd(.7, 1.2), life: (o.life || .7) * kit.rnd(.8, 1.2), drag: 2.4, grav: .4, grow: 2, tex: 'smoke', spin: kit.rnd(-1.5, 1.5), cover: o.cover == null ? .7 : o.cover };
    });
  }
  // 金属火花：亮金色小点，带重力往外喷；o.dir 给了就往那边偏
  function sparks(kit, at, n, o) {
    o = o || {};
    kit.emit(n, () => {
      const v = kit.sph(1); if (o.dir) v.addScaledVector(o.dir, o.bias || 1);
      v.y = Math.abs(v.y) * (o.up || 1.2) + .3; v.normalize().multiplyScalar((o.sp || 5) * kit.rnd(.5, 1.1));
      return { pos: at.clone().add(kit.sph(.06)), vel: v, col: pick(['#ffd54f', '#ffd54f', '#fff6d0', '#ffab40']), size: (o.size || .24) * kit.rnd(.7, 1.3), life: (o.life || .5) * kit.rnd(.6, 1.2), grav: -11, drag: 1.2, grow: .25, tex: 'glow', cover: .35 };
    });
  }
  // 星星往外蹦（四角星粒子，转着）
  function starBurst(kit, at, n, cols, o) {
    o = o || {};
    kit.emit(n, () => ({ pos: at.clone(), vel: kit.sph(kit.rnd(.6, 1) * (o.sp || 3.2)), col: pick(cols), size: (o.size || .45) * kit.rnd(.7, 1.3), life: (o.life || .55) * kit.rnd(.8, 1.2), drag: 2.2, grav: o.grav == null ? -1.5 : o.grav, grow: .3, fade: .4, tex: 'star', spin: kit.rnd(-6, 6), cover: o.cover == null ? .25 : o.cover }));
  }
  // 一颗转着的四角星闪烁（金属反光、星光）
  function glint(kit, at, o) {
    o = o || {};
    kit.emit(1, () => ({ pos: at.clone(), vel: o.vel || kit.V(0, 0, 0), col: o.col || '#ffffff', size: o.size || 1, life: o.life || .35, grow: o.grow == null ? .2 : o.grow, fade: .3, tex: 'star', spin: o.spin == null ? 5 : o.spin, cover: o.cover == null ? .2 : o.cover }));
  }
  // 冲刺时身后甩出的风线（每帧调一次，粒子往后飞）
  function streaks(kit, ctx, cols, n, tex) {
    return () => {
      const c = kit.center(ctx.side), h = kit.mon(ctx.side).height;
      kit.emit(n, () => ({ pos: c.clone().add(kit.sph(kit.rnd(.1, .45) * h)), vel: ctx.dir.clone().multiplyScalar(-kit.rnd(2, 4)).add(kit.sph(.4)), col: pick(cols), size: kit.rnd(.18, .32) * (tex === 'star' ? 1.6 : 1), life: kit.rnd(.15, .26), grow: .3, tex: tex || 'glow', spin: tex === 'star' ? kit.rnd(-6, 6) : 0, cover: .3 }));
    };
  }
  // 速度线：从四周往命中点收拢的细光束（动画里「打中了！」的感觉）；o = { n, col, col2, r 外圈半径, r1 停在离中心多远, width, life }
  function speedLines(kit, at, o) {
    o = o || {}; const n = cnt(kit, o.n || 8), { R, U, F } = basis(kit), base = at.clone().addScaledVector(F, o.push == null ? .4 : o.push), a0 = kit.rnd(0, 6.283), z = zs(kit, at);
    for (let i = 0; i < n; i++) {
      const th = a0 + (i + kit.rnd(-.3, .3)) / n * Math.PI * 2, dv = R.clone().multiplyScalar(Math.cos(th)).addScaledVector(U, Math.sin(th));
      kit.energyBeam(base.clone().addScaledVector(dv, (o.r || 1.6) * z * kit.rnd(.8, 1.2)), base.clone().addScaledVector(dv, (o.r1 || .35) * z * kit.rnd(.8, 1.2)), { col: o.col, col2: o.col2 || '#ffffff', width: (o.width || .05) * kit.rnd(.7, 1.3), life: o.life || .2, noise: .2, grow: .5, taper: .5, cover: o.cover == null ? .5 : o.cover });
    }
  }
  // 月牙光刃（面向镜头，两层：外面属性色的宽月牙 + 前沿白色的细月牙）
  // o = { from, to（从哪飞到哪；不写 to 就停在 from）, apex（位置指的是弧顶，不是圆心）, col, col2, size, rot（凸边朝哪，屏幕上的角度）, rot1（转到哪）,
  //       life, travel（前百分之几飞完）, grow, hold（前百分之几不淡）, push（往镜头挪）, op }
  function crescent(kit, o) {
    const T3 = kit.T3, cam = kit.cam, g = new T3.Group();
    const m1 = new T3.Mesh(G.cresW(kit), kit.glowMat(o.col, .6)), m2 = new T3.Mesh(G.cresN(kit), kit.glowMat(o.col2 || '#ffffff', .95));
    m2.position.z = .01; g.add(m1, m2);
    const life = o.life || .3, size = o.size || 1, r0 = o.rot || 0, r1 = o.rot1 == null ? r0 : o.rot1, hold = o.hold || .55;
    const from = o.from.clone(), to = (o.to || o.from).clone(), qz = new T3.Quaternion(), Z = new T3.Vector3(0, 0, 1);
    const R = new T3.Vector3(), U = new T3.Vector3(), F = new T3.Vector3();
    const place = (q, k) => {
      const e = cam.matrixWorld.elements; R.set(e[0], e[1], e[2]).normalize(); U.set(e[4], e[5], e[6]).normalize(); F.set(e[8], e[9], e[10]).normalize();
      const rot = r0 + (r1 - r0) * kit.EZ.out(k), tr = o.travel ? Math.min(1, k / o.travel) : 1;
      const s = size * (.5 + .5 * kit.EZ.out(Math.min(1, k / (o.grow || .3))));
      q.position.lerpVectors(from, to, tr).addScaledVector(F, o.push == null ? .45 : o.push);
      if (o.apex) q.position.addScaledVector(R, -Math.cos(rot) * s).addScaledVector(U, -Math.sin(rot) * s);
      q.quaternion.copy(cam.quaternion).multiply(qz.setFromAxisAngle(Z, rot));
      q.scale.setScalar(s);
      const f = (k < hold ? 1 : 1 - (k - hold) / (1 - hold)) * (o.op || 1);
      m1.material.opacity = .6 * f; m2.material.opacity = .95 * f;
    };
    place(g, 0);
    return kit.addFx(g, life, place);
  }
  // 羽毛：白色小叶片，先往两边蹦，再左右摇着飘下来（别在对手头边挂太久：大羽毛停在头两侧像长了角）
  function feathers(kit, at, n, o) {
    o = o || {}; const T3 = kit.T3, geo = G.feather(kit);
    for (let i = 0; i < n; i++) {
      const m = new T3.Mesh(geo, kit.toonMat(o.col || (i % 3 ? '#ffffff' : '#dcecff'), { transparent: true, side: T3.DoubleSide, emissive: '#b8c4d0' }));
      m.scale.setScalar((o.size || 1.4) * kit.rnd(.8, 1.2));
      const base = at.clone().add(kit.sph(.15)), v = kit.sph(kit.rnd(.6, 1) * (o.sp || 2.4)), ph = kit.rnd(0, 6.28), sw = kit.rnd(5, 8);
      v.y = Math.abs(v.y) * .5 + .4;   // 主要往两边飞，不往上抛
      m.position.copy(base); m.rotation.set(kit.rnd(0, 6), kit.rnd(0, 6), kit.rnd(0, 6));
      noGlow(kit.addFx(m, (o.life || .8) * kit.rnd(.8, 1.15), (q, k, dt) => {
        v.multiplyScalar(Math.max(0, 1 - 3.2 * dt)); v.y -= 2 * dt;
        base.addScaledVector(v, dt);
        q.position.copy(base); q.position.x += Math.sin(k * sw + ph) * .12; q.position.z += Math.cos(k * sw * .8 + ph) * .08;
        q.rotation.z = Math.sin(k * sw + ph) * .9; q.rotation.y += dt * 2;
        q.material.opacity = k > .7 ? (1 - k) / .3 : 1;
      }));
    }
  }
  // 地上越来越大、越来越黑的影子（东西要从天上砸下来了）：life 结束的那一刻正好最大
  function shadowDisc(kit, at, o) {
    const m = new kit.T3.Mesh(G.disc(kit), kit.glowMat('#141c24', 0));
    m.position.set(at.x, .1, at.z); m.scale.set(.05, 1, .05); m.renderOrder = -.3;
    const r = o.r || 1, op = o.op || .42;
    return kit.addFx(m, o.life || .8, (q, k) => {
      const e = Math.min(1, k / .92), s = r * (.15 + .85 * e * e);
      q.scale.set(s, 1, s); q.material.opacity = op * (k < .92 ? e : (1 - k) / .08);
    });
  }
  // 实心的物件（钢球、齿轮、螺母）不进发光后期那一层：亮钢色一进去就被晕成一团白光
  const noGlow = obj => { obj.traverse(o => o.layers.disable(1)); return obj; };
  // 对手被连打时晃一下（真正的受击由 monsters.js 调 hit()）
  function jolt(kit, side, dir, amt, ms) {
    const B = kit.mon(side); if (!B) return;
    const o0 = B.off.clone();
    kit.tween(ms || 120, k => { B.off.copy(o0).addScaledVector(dir, Math.sin(k * Math.PI) * amt); });
  }

  // ---------- 冲过去 / 弹回来（出招方真的跑到对手跟前） ----------
  const CAM0 = { x: -2.1, z: 5.6 };   // battle3d.js 默认机位的大概位置（只用来判断停在对手哪一侧）
  // 算出出招方要挪多少（相对站位的位移）：停在对手身前 gap 远，再往「镜头 → 对手」这条线的侧面偏开至少 lat，别挡住挨打的那只
  function contact(kit, ctx, o) {
    o = o || {};
    const A = kit.mon(ctx.side), B = kit.mon(ctx.other);
    const base = A.root.position.clone().sub(A.off).setY(0), tp = B.root.position.clone().sub(B.off).setY(0);
    const d = tp.clone().sub(base), dist = d.length() || 1; d.multiplyScalar(1 / dist);
    const gap = Math.max(.85, (A.height + B.height) * .45) * (o.gap || 1);
    const p = tp.clone().addScaledVector(d, -Math.min(gap * (o.depth || .8), dist - .2));
    const ct = kit.V(tp.x - CAM0.x, 0, tp.z - CAM0.z).normalize(), cr = kit.V(-ct.z, 0, ct.x);
    const l = p.clone().sub(tp).dot(cr), need = (o.lat || 1) * (A.height + B.height) * .42, sg = l > .05 ? 1 : -1;
    if (Math.abs(l) < need) p.addScaledVector(cr, sg * (need - Math.abs(l)));
    const hit = kit.center(ctx.other).add(p.clone().sub(tp).normalize().multiplyScalar(B.height * .28));
    return { off: p.clone().sub(base), hit, land: p };
  }
  // 冲过去：从现在的位置冲到 contact 算出的地方（默认越冲越快），可以跳着冲（hop）；o.trail 拖尾参数、o.step(k) 每帧回调
  // （不另外播 attack 动作：编排已经在蓄力 / 大招特殊动作里播了，再播一遍会扑两次）
  function dash(kit, ctx, ms, o) {
    o = o || {};
    const A = kit.mon(ctx.side), c = contact(kit, ctx, o), from = A.off.clone(), to = c.off, ph = P(ctx);
    ph.hit = c.hit; ph.land = c.land; ph.dashed = true;
    let live = true;
    if (o.trail) kit.trail(() => live ? kit.center(ctx.side) : null, o.trail);
    const ez = o.ease || (k => k * k);
    return kit.tween(ms, k => {
      const e = ez(k);
      A.off.lerpVectors(from, to, e);
      A.off.y = from.y * (1 - e) + Math.sin(k * Math.PI) * (o.hop || 0);
      if (o.step) o.step(k);
    }).then(() => { live = false; });
  }
  // 撞完弹回原位（稍微跳一下）
  function recoil(kit, ctx, ms, hop, delay) {
    const ph = P(ctx); if (!ph.dashed) return; ph.dashed = false;
    const A = kit.mon(ctx.side); if (!A) return;
    later(delay || 0, () => {
      const from = A.off.clone();
      kit.tween(ms || 420, k => { const e = kit.EZ.io(k); A.off.copy(from).multiplyScalar(1 - e); A.off.y = from.y * (1 - e) + Math.sin(k * Math.PI) * (hop == null ? .3 : hop); });
    });
  }

  // ======================================================================
  // 一般 normal：白光冲撞 + 大命中星
  // ======================================================================
  const NW = '#fffaf0', NG = '#ffd54f', NC = '#fff3c4';
  // 大招 Giant Stomp：（大招特殊动作 leap 先在原地跳起来跺一脚）蹲下蓄力、对手脚下亮出金色落点圈 → 高高跳起 →
  // 影子越来越大 → 拖着白光彗尾砸下来（命中）
  async function megaStomp(kit, ctx) {
    const A = kit.mon(ctx.side), ph = P(ctx), H = 2.5;
    // 蹲下蓄力 0.22 秒：leap 落地后会在后台用 0.22 秒把水平位移收回来，这段只改高度，别和它抢
    kit.groundCircle(ctx.other, { col: NG, col2: NW, r: 1.25, life: .75, spin: 2.4, cover: .45 });
    dust(kit, kit.feet(ctx.side), { n: 10, r: .4, sp: 1.8, size: .55 });
    glint(kit, kit.center(ctx.side).add(kit.V(0, A.height * .3, 0)), { col: '#fff6d0', size: 1.2, life: .3 });
    await kit.tween(220, k => { A.off.y = -.13 * Math.sin(Math.min(1, k / .4) * Math.PI / 2); });
    const c = contact(kit, ctx, { gap: 1 }), from = A.off.clone(), to = c.off;
    ph.hit = c.hit; ph.land = c.land; ph.dashed = true;
    kit.shockwave(kit.feet(ctx.side).setY(.12), { col: NC, col2: NW, r0: .3, r1: 1.5 * zs(kit, kit.center(ctx.side)), life: .35, thick: .1 });
    shadowDisc(kit, c.land, { r: .95, life: .48 });
    let live = true;
    kit.trail(() => live ? kit.center(ctx.side) : null, { col: NG, col2: NW, width: .45, life: .16, cover: .5 });
    const xz = e => { A.off.x = from.x + (to.x - from.x) * e; A.off.z = from.z + (to.z - from.z) * e; };
    await kit.tween(250, k => { const e = kit.EZ.out(k); xz(.8 * e); A.off.y = from.y + (H - from.y) * e; });
    await kit.tween(70, k => { A.off.y = H + Math.sin(k * Math.PI) * .1; });   // 最高点停一下
    const st = streaks(kit, ctx, [NW, NG], 2);
    await kit.tween(160, k => {
      const e = k * k; xz(.8 + .2 * e); A.off.y = H * (1 - e);
      const c0 = kit.center(ctx.side);   // 往下砸时身边往上甩的白线
      kit.emit(2, () => ({ pos: c0.clone().add(kit.sph(.35)), vel: kit.V(kit.rnd(-.3, .3), kit.rnd(4, 7), kit.rnd(-.3, .3)), col: pick([NW, NG]), size: kit.rnd(.2, .34), life: .18, grow: .3, cover: .3 }));
      if (k > .5) st();
    });
    live = false;
  }
  T.normal = {
    physical: true, ult: 'leap', generic: GEN,
    // 蹬地蓄势：脚后扬起一小撮土，身上「叮」地亮一下
    charge(kit, ctx) {
      const f = kit.feet(ctx.side);
      dust(kit, f.clone().addScaledVector(ctx.dir, -.35), { n: 6 + ctx.tier * 4, r: .25, sp: 1.3, size: .5, life: .5 });
      later(120, () => glint(kit, kit.center(ctx.side).add(kit.V(0, kit.mon(ctx.side).height * .25, 0)), { col: '#fff6d0', size: .9 + ctx.tier * .3, life: .3 }));
    },
    async release(kit, ctx) {
      const t = ctx.tier;
      if (t === 0) {
        // 小招 Body Bump：全身泛白光，拖着一道白尾巴冲过去
        kit.aura(ctx.side, { col: NW, col2: NG, life: .3, strength: .6 });
        await dash(kit, ctx, 200, { gap: 1, trail: { col: NW, col2: NG, width: .55, life: .14, cover: .45 }, step: streaks(kit, ctx, [NW, '#ffe9a8'], 1) });
      } else if (t === 1) {
        // 中招 Star Rush：金色星光拖尾，跳着弧线冲过去，一路撒星星
        kit.aura(ctx.side, { col: NG, col2: NW, life: .55, strength: .9 });
        await dash(kit, ctx, 360, { hop: .5, trail: { col: NG, col2: NW, width: .7, life: .24, cover: .45 }, step: streaks(kit, ctx, [NG, '#ffffff', '#ffe9a8'], 1, 'star') });
      } else await megaStomp(kit, ctx);
    },
    impact(kit, ctx) {
      const t = ctx.tier, b = hitAt(ctx), z = zs(kit, b);
      climax(kit, ctx);
      if (t === 0) {
        kit.impactStar(b, { col: NG, col2: '#ffffff', size: 1.05 * z, life: .28, spikes: 12 });
        kit.shockwave(b, { col: NC, flat: false, r0: .15, r1: 1.05 * z, life: .28, thick: .09 });
        kit.burst(b, ['#ffffff', '#ffe082'], 22, 3.2, .32, .32);
        kit.shake(.12);
        recoil(kit, ctx, 360, .3, 40);
      } else if (t === 1) {
        // 五个角的大星星 + 星星往外蹦
        kit.impactStar(b, { col: NG, col2: '#ffffff', size: 1.5 * z, life: .34, spikes: 5 });
        kit.shockwave(b, { col: NG, col2: NW, flat: false, r0: .2, r1: 1.6 * z, life: .36, thick: .11 });
        kit.shockwave(kit.feet(ctx.other).setY(.12), { col: NC, col2: NG, r0: .3, r1: 1.9 * z, life: .45 });
        starBurst(kit, b, 14, [NG, '#ffffff', '#ffe9a8'], { sp: 3.6, size: .5 });
        kit.light(b, { col: '#ffe08a', intensity: 4, life: .3 });
        kit.shake(.2);
        recoil(kit, ctx, 420, .45, 60);
      } else {
        // 落地：巨大的命中星 + 三道地面冲击波 + 尘土环 + 碎石
        const land = (ctx.phys && ctx.phys.land) || kit.feet(ctx.other), g = kit.V(land.x, .12, land.z), g2 = g.clone().lerp(kit.feet(ctx.other).setY(.12), .5);
        kit.impactStar(b, { col: '#ffc94d', col2: '#ffffff', size: 1.65 * z, life: .34, spikes: 14 });
        kit.shockwave(g2, { col: NW, col2: NG, r0: .3, r1: 3.4 * z, life: .6, thick: .2 });
        later(90, () => kit.shockwave(g2, { col: NG, col2: NW, r0: .2, r1: 2.4 * z, life: .5, thick: .14 }));
        later(180, () => kit.shockwave(g2, { col: NC, r0: .2, r1: 1.5 * z, life: .4, thick: .12 }));
        kit.shockwave(b, { col: NG, col2: NW, flat: false, r0: .3, r1: 2 * z, life: .36, thick: .1 });
        dust(kit, g, { n: 18, r: .5, sp: 4.2, size: .6, life: .65, cover: .6 });
        kit.chunks(() => G.peb(kit), '#b8a888', cnt(kit, 8), g, .4, 1.1);
        starBurst(kit, b, 16, [NG, '#ffffff'], { sp: 4.5, size: .55 });
        kit.shake(.42);
        kit.light(b, { col: '#ffe9a8', intensity: 6, dist: 5, life: .45 });
        recoil(kit, ctx, 480, .7, 220);
      }
    },
    after(kit, ctx) {
      if (ctx.tier === 2) { const land = (ctx.phys && ctx.phys.land) || kit.feet(ctx.other); kit.decal(kit.V(land.x, 0, land.z).lerp(kit.feet(ctx.other), .4), { kind: 'crack', r: 1.5, life: 3 }); }
      recoil(kit, ctx, 420, .3, 300);   // 保险：出招中途出错时也弹回去
    },
  };

  // ======================================================================
  // 功夫 fight：连续的拳风、命中星、最后一记重击
  // ======================================================================
  const FO = '#ff7043', FY = '#ffe0b2', FW = '#fff3e0';
  // 拳风：从出招方身前打到 to 的一道粗短光束
  function jab(kit, ctx, to, w, life) {
    const from = kit.center(ctx.side).addScaledVector(ctx.dir, kit.mon(ctx.side).height * .3);
    kit.energyBeam(from, to.clone().addScaledVector(ctx.dir, .25), { col: FO, col2: FY, width: w, life, grow: .45, taper: .55, noise: .5, cover: .5 });
  }
  // 大招 Hero Combo：冲到跟前连打三拳 → 后撤运气 → 最后一记燃烧的重拳（命中）
  async function heroCombo(kit, ctx) {
    await dash(kit, ctx, 190, { gap: 1.15, trail: { col: FO, col2: FW, width: .5, life: .14, cover: .45 } });
    const A = kit.mon(ctx.side), base = A.off.clone(), b = hitAt(ctx), { R, U } = basis(kit), h = kit.mon(ctx.other).height, z = zs(kit, b);
    const spots = [[-.24, .16], [.22, -.06], [-.04, .3]];
    for (let i = 0; i < 3; i++) {
      const p = b.clone().addScaledVector(R, spots[i][0] * h).addScaledVector(U, spots[i][1] * h);
      kit.tween(110, k => { A.off.copy(base).addScaledVector(ctx.dir, Math.sin(k * Math.PI) * .14); });
      jab(kit, ctx, p, .26, .13);
      await kit.sleep(55);
      kit.impactStar(p, { col: FO, col2: FW, size: (.8 + i * .12) * z, life: .2, spikes: 6 });
      kit.shockwave(p, { col: FY, flat: false, r0: .1, r1: .7 * z, life: .2, thick: .07 });
      kit.burst(p, [FO, FW], 10, 3, .25, .25);
      jolt(kit, ctx.other, ctx.dir, .1, 110);
      kit.shake(.13); kit.sfx('fight', 'impact', 0);
      await kit.sleep(85);
    }
    // 后撤运气：往后一缩，身上冒橙色的气，拳头那儿越聚越亮
    kit.aura(ctx.side, { col: FO, col2: FY, life: .45, strength: 1.3 });
    const fist = () => kit.center(ctx.side).addScaledVector(ctx.dir, kit.mon(ctx.side).height * .35);
    kit.glow(fist(), { col: FO, size: .7, life: .3, grow: 2.2, follow: fist, cover: .3 });
    const fp = fist();
    kit.emit(18, () => { const d = kit.sph(kit.rnd(.7, 1.1)); return { pos: fp.clone().add(d), vel: d.multiplyScalar(-4), col: pick([FO, FY, '#ffffff']), size: kit.rnd(.15, .26), life: .22, grow: .3, cover: .2 }; });
    await kit.tween(200, k => { A.off.copy(base).addScaledVector(ctx.dir, -.45 * kit.EZ.out(k)); });
    await kit.tween(90, k => { A.off.copy(base).addScaledVector(ctx.dir, -.45 + .7 * k * k); });
    kit.energyBeam(fist(), b.clone().addScaledVector(ctx.dir, .6), { col: FO, col2: FY, width: .6, life: .22, grow: .3, taper: .4, noise: .8, cover: .55 });
  }
  T.fight = {
    physical: true, ult: 'float', generic: GEN,
    // 运气：身边几道往上窜的橙色气线 + 脚下一跺
    charge(kit, ctx) {
      const n = cnt(kit, 4 + ctx.tier * 2), h = kit.mon(ctx.side).height, f = kit.feet(ctx.side), a0 = kit.rnd(0, 6.283);
      for (let i = 0; i < n; i++) later(i * 45, () => {
        const a = a0 + i / n * 6.283, p = f.clone().add(kit.V(Math.cos(a) * .45 * h, kit.rnd(0, .25) * h, Math.sin(a) * .45 * h));
        kit.energyBeam(p, p.clone().add(kit.V(0, h * kit.rnd(.6, 1), 0)), { col: FO, col2: FY, width: .07, life: .24, grow: .45, noise: .3, taper: .5, cover: .5 });
      });
      kit.shockwave(f.setY(.12), { col: FO, col2: FY, r0: .2, r1: 1.1, life: .3, thick: .08 });
    },
    async release(kit, ctx) {
      const t = ctx.tier;
      if (t === 0) {
        // 小招 Quick Punch：一步踏进去，打出一道橙色拳风
        await dash(kit, ctx, 150, { gap: 1.3, trail: { col: FO, col2: FW, width: .4, life: .12, cover: .45 } });
        jab(kit, ctx, hitAt(ctx), .34, .16);
        await kit.sleep(50);
      } else if (t === 1) {
        // 中招 Power Kick：跳着冲过去，一个回旋踢——一道大月牙弧光从上往下扫过对手
        await dash(kit, ctx, 250, { gap: 1.05, hop: .35, trail: { col: FO, col2: FW, width: .5, life: .16, cover: .45 }, step: streaks(kit, ctx, [FO, FY], 1) });
        const b = hitAt(ctx), ang = screenAng(kit, kit.center(ctx.side), b);
        crescent(kit, { from: b, apex: true, col: FO, col2: FW, size: kit.mon(ctx.other).height * .95, rot: ang + 1.25, rot1: ang - 1, life: .34, grow: .25, hold: .5, push: .6 });
        await kit.sleep(80);
      } else await heroCombo(kit, ctx);
    },
    impact(kit, ctx) {
      const t = ctx.tier, b = hitAt(ctx), z = zs(kit, b);
      climax(kit, ctx);
      if (t === 0) {
        kit.impactStar(b, { col: FO, col2: FW, size: 1.05 * z, life: .26, spikes: 6 });
        speedLines(kit, b, { n: 8, col: FO, col2: FW, r: 1.5, r1: .4 });
        kit.shockwave(b, { col: FY, flat: false, r0: .15, r1: .95 * z, life: .26, thick: .08 });
        kit.burst(b, [FO, FW], 18, 3.5, .3, .3);
        kit.shake(.14);
        recoil(kit, ctx, 320, .2, 30);
      } else if (t === 1) {
        kit.impactStar(b, { col: FO, col2: FW, size: 1.4 * z, life: .32, spikes: 7 });
        speedLines(kit, b, { n: 10, col: FO, col2: FW, r: 1.9, r1: .5 });
        kit.shockwave(b, { col: FW, col2: FO, flat: false, r0: .2, r1: 1.5 * z, life: .34, thick: .1 });
        kit.shockwave(kit.feet(ctx.other).setY(.12), { col: FO, col2: FY, r0: .3, r1: 2 * z, life: .45, thick: .12 });
        dust(kit, kit.feet(ctx.other), { n: 14, r: .4, sp: 2.6, size: .7 });
        kit.light(b, { col: '#ffab91', intensity: 4, life: .3 });
        kit.shake(.22);
        recoil(kit, ctx, 420, .4, 80);
      } else {
        // 最后一记重拳：巨大的命中星 + 两圈面向镜头的冲击波 + 地面冲击波 + 一大圈速度线
        kit.impactStar(b, { col: '#ff5722', col2: FW, size: 2 * z, life: .36, spikes: 8 });
        kit.shockwave(b, { col: FO, col2: FW, flat: false, r0: .3, r1: 2.4 * z, life: .4, thick: .14 });
        kit.shockwave(kit.feet(ctx.other).setY(.12), { col: FO, col2: FY, r0: .3, r1: 3.2 * z, life: .55, thick: .18 });
        speedLines(kit, b, { n: 14, col: FO, col2: FW, r: 2.6, r1: .7, width: .07, life: .26 });
        dust(kit, kit.feet(ctx.other), { n: 22, r: .5, sp: 3.4, size: .9 });
        starBurst(kit, b, 14, [FO, FY, '#ffffff'], { sp: 4.2, size: .5 });
        kit.shake(.42);
        kit.light(b, { col: '#ff9e6e', intensity: 6, dist: 5, life: .45 });
        recoil(kit, ctx, 460, .5, 200);
      }
    },
    after(kit, ctx) { recoil(kit, ctx, 420, .3, 300); },
  };

  // ======================================================================
  // 飞行 flying：风刃、俯冲、龙卷风
  // ======================================================================
  const WB = '#7fbcf2', WD = '#4f93dc', WW = '#d6ebff';
  // 龙卷风柱（跟着对手的脚）：返回控制对象 { burst() 炸开散掉 }
  function tornado(kit, side, o) {
    const T3 = kit.T3, mat = funnelMat(kit), m = new T3.Mesh(funnelGeo(kit), mat), u = mat.uniforms, h = kit.mon(side).height;
    u.uCol.value.set(o.col || '#7aa4d6'); u.uCol2.value.set(o.col2 || '#d8eaff');   // 风纹别用纯白：高画质的发光后期一晕就是一片白
    u.uOp.value = 0; u.uCover.value = .75; u.uWob.value = .2;   // 材质是循环用的：上一次炸开时改过的扭动、透明度都要重设
    m.frustumCulled = false; m.renderOrder = 2;
    const z = zs(kit, kit.center(side)), H = (o.h || 3.2) * Math.max(.85, h * .9) * (.4 + .6 * z), W = 1.15 * Math.max(.9, h) * z;
    let burst = 0, bt = 0;
    const ctl = { burst() { burst = 1; } };
    const f = kit.feet(side); m.position.copy(f); m.scale.set(.3, .1, .3);
    // 风柱不进发光后期那一层：一大片浅色一晕就是满屏白（尤其对手出招、镜头贴着我方的时候）
    noGlow(kit.addFx(m, o.life || 2.2, (q, k, dt) => {
      u.uTime.value += dt;
      const fp = kit.feet(side); q.position.set(fp.x, .06, fp.z);
      q.rotation.y -= dt * 5;
      if (!burst) {
        const e = kit.EZ.out(Math.min(1, k * (o.life || 2.2) / .32));   // 0.32 秒长出来
        q.scale.set(W * (.5 + .5 * e), H * e, W * (.5 + .5 * e));
        u.uOp.value = Math.min(1, e * 1.4);
      } else {
        bt += dt; const e = Math.min(1, bt / .2);   // 炸开：往外撑、变矮、很快淡掉（别把挨打的那只盖住）
        q.scale.set(W * (1 + .45 * e), H * (1 - .3 * e), W * (1 + .45 * e));
        u.uOp.value = (1 - e) * (1 - e) * .8; u.uWob.value = .2 + .4 * e;
        if (e >= 1) return true;
      }
    }, () => { mat.userData.busy = false; }));
    return ctl;
  }
  // 大招 Sky Storm：扇出两道风刃到对手脚下 → 卷起龙卷风把它裹住转几圈（命中）→ impact 里炸开
  async function skyStorm(kit, ctx) {
    const a = ctx.a, f = kit.feet(ctx.other), ang = screenAng(kit, a, ctx.b), side = ctx.other, h = kit.mon(side).height;
    for (let i = 0; i < 2; i++) crescent(kit, { from: a.clone().add(kit.V(0, i ? .3 : -.15, 0)), to: f.clone().setY(.45 + i * .45), apex: true, col: WB, col2: WW, size: .6, rot: ang + (i ? .45 : -.45), life: .26, travel: .8, hold: .8 });
    await kit.sleep(170);
    kit.groundCircle(side, { col: WD, col2: WW, r: 1.35, life: 1.1, spin: 3.5, cover: .45 });
    kit.shockwave(f.clone().setY(.12), { col: WB, col2: WW, r0: .3, r1: 1.6 * zs(kit, ctx.b), life: .4, thick: .1 });
    P(ctx).storm = tornado(kit, side, { life: 1.6 });
    // 绕着风柱往上转的碎叶、羽毛、气流：几个「领头」沿螺旋往上，每帧撒一点
    const heads = cnt(kit, 7), ph = []; for (let i = 0; i < heads; i++) ph.push({ a: i / heads * 6.283, y: kit.rnd(0, 1), sp: kit.rnd(.8, 1.3), c: pick(['#ffffff', '#ffffff', '#cfe3ff', '#9be86b', '#d9c9a3']) });
    const trails = [];
    for (let i = 0; i < cnt(kit, 3); i++) { const st = { p: kit.V(0, 0, 0), live: true, a: i / 3 * 6.283 }; trails.push(st); kit.trail(() => st.live ? st.p : null, { col: WW, col2: WB, width: .2, life: .22, cover: .5 }); }
    await kit.tween(780, k => {
      const fp = kit.feet(side), T = k * .78;
      ph.forEach(p => {
        const y = ((p.y + T * p.sp * .9) % 1), r = (.35 + .8 * Math.pow(y, 1.3)) * Math.max(.9, h), an = p.a + T * 9 * p.sp;
        kit.emit(1, () => ({ pos: kit.V(fp.x + Math.cos(an) * r, .15 + y * 3 * Math.max(.85, h * .9), fp.z + Math.sin(an) * r), vel: kit.V(-Math.sin(an) * 2, 1, Math.cos(an) * 2), col: p.c, size: kit.rnd(.16, .26), life: .16, grow: .5, tex: p.c === '#9be86b' ? 'star' : 'glow', spin: 6, cover: p.c === '#9be86b' || p.c === '#d9c9a3' ? .8 : .35 }));
      });
      trails.forEach((st, i) => {
        const y = (T * 1.6 + i / 3) % 1, r = (.4 + .8 * Math.pow(y, 1.3)) * Math.max(.9, h), an = st.a + T * 11;
        st.p.set(fp.x + Math.cos(an) * r, .2 + y * 2.8 * Math.max(.85, h * .9), fp.z + Math.sin(an) * r);
      });
      // 风柱脚下卷起的尘土：贴地绕着转
      const da = T * 14 + Math.random() * 6.28, dr = .5 * Math.max(.9, h);
      kit.emit(2, () => ({ pos: kit.V(fp.x + Math.cos(da) * dr, .15, fp.z + Math.sin(da) * dr), vel: kit.V(-Math.sin(da) * 3, kit.rnd(.3, .9), Math.cos(da) * 3), col: pick(['#b9c9da', '#d3dce6', '#c8b896']), size: kit.rnd(.4, .6), life: .35, drag: 1, grow: 1.6, tex: 'smoke', spin: 3, cover: .6 }));
      if (Math.random() < .3) jolt(kit, side, kit.sph(1).setY(0).normalize(), .04, 80);
    });
    trails.forEach(st => { st.live = false; });
  }
  T.flying = {
    ult: 'float', generic: GEN,
    // 扇起风：身边两三圈往上旋的风环 + 掉几根羽毛
    charge(kit, ctx) {
      const f = kit.feet(ctx.side), h = kit.mon(ctx.side).height;
      for (let i = 0; i < 2 + ctx.tier; i++) later(i * 70, () => kit.shockwave(f.clone().setY(.2 + i * .35 * h), { col: WB, col2: WW, r0: .45 * h, r1: (.8 + .15 * i) * h, life: .35, thick: .06, cover: .5 }));
      feathers(kit, kit.center(ctx.side).add(kit.V(0, h * .3, 0)), cnt(kit, 2 + ctx.tier), { sp: 1.8, life: .8 });   // 飞快一点离开身体（别像长在头上的角）
    },
    async release(kit, ctx) {
      const t = ctx.tier;
      if (t === 0) {
        // 小招 Wing Slap：翅膀一扇，两道风刃交叉着飞过去
        const a = ctx.a, b = ctx.b, ang = screenAng(kit, a, b), { U } = basis(kit);
        for (let i = 0; i < 2; i++) {
          const s = i ? 1 : -1, off = U.clone().multiplyScalar(s * .45);
          crescent(kit, { from: a.clone().add(off), to: b.clone().addScaledVector(off, -.4), apex: true, col: WB, col2: WW, size: .55, rot: ang + s * .55, rot1: ang - s * .25, life: .3, travel: .75, hold: .75, push: .3 });
        }
        await kit.sleep(225);
      } else if (t === 1) {
        // 中招 Gust Dive：跳上天，裹着风圈从上往下俯冲撞过去
        const A = kit.mon(ctx.side), c = contact(kit, ctx, { gap: 1 }), from = A.off.clone(), to = c.off, ph = P(ctx);
        ph.hit = c.hit; ph.land = c.land; ph.dashed = true;
        let live = true, ringK = 0;
        kit.trail(() => live ? kit.center(ctx.side) : null, { col: WB, col2: WW, width: .65, life: .24, cover: .5 });
        const st = streaks(kit, ctx, [WW, WB], 1);
        await kit.tween(430, k => {
          const up = k < .4 ? kit.EZ.out(k / .4) : 1 - Math.pow((k - .4) / .6, 2);
          const fw = k < .4 ? .15 * (k / .4) : .15 + .85 * Math.pow((k - .4) / .6, 2);
          A.off.lerpVectors(from, to, fw); A.off.y = from.y * (1 - fw) + up * 1.5;
          if (k - ringK > .14) { ringK = k; kit.shockwave(kit.center(ctx.side), { col: WB, col2: WW, flat: false, r0: .3, r1: .95, life: .3, thick: .07, push: 0, cover: .5 }); }
          if (k > .4) st();
        });
        live = false;
      } else await skyStorm(kit, ctx);
    },
    impact(kit, ctx) {
      const t = ctx.tier, b = hitAt(ctx), z = zs(kit, b);
      climax(kit, ctx);
      if (t === 0) {
        // 风刃交叉划出一个 X + 羽毛四散
        crescent(kit, { from: b, apex: true, col: WB, col2: WW, size: .7 * z, rot: .8, rot1: .2, life: .28, push: .55 });
        crescent(kit, { from: b, apex: true, col: WB, col2: WW, size: .7 * z, rot: 2.35, rot1: 2.95, life: .28, push: .55 });
        kit.impactStar(b, { col: WB, col2: '#ffffff', size: .8 * z, life: .22, spikes: 9 });
        feathers(kit, b, cnt(kit, 6), { sp: 2.6 });
        kit.shake(.1);
      } else if (t === 1) {
        kit.impactStar(b, { col: WD, col2: '#ffffff', size: 1.15 * z, life: .28, spikes: 9 });
        kit.shockwave(b, { col: WB, col2: WW, flat: false, r0: .2, r1: 1.4 * z, life: .32, thick: .1 });
        kit.shockwave(kit.feet(ctx.other).setY(.12), { col: WB, col2: WW, r0: .3, r1: 2.2 * z, life: .45, thick: .12 });
        dust(kit, kit.feet(ctx.other), { n: 12, r: .5, sp: 3.4, size: .55, life: .55, cols: ['#a9bfd6', '#c4d3e3'], cover: .55 });
        feathers(kit, b, cnt(kit, 8), { sp: 3 });
        kit.light(b, { col: '#cfe3ff', intensity: 4, life: .3 });
        kit.shake(.2);
        recoil(kit, ctx, 460, .6, 60);
      } else {
        // 龙卷风「呼」地炸开：往外撑开散掉 + 地面风圈 + 羽毛碎叶四散
        const st = ctx.phys && ctx.phys.storm; if (st) st.burst();
        const g = kit.feet(ctx.other).setY(.12);
        kit.impactStar(b, { col: WD, col2: '#ffffff', size: 1.35 * z, life: .3, spikes: 12 });
        kit.shockwave(g, { col: WD, col2: WW, r0: .5, r1: 3.4 * z, life: .55, thick: .18 });
        later(80, () => kit.shockwave(g.clone().setY(1.2), { col: WB, col2: WW, r0: .4, r1: 2.6 * z, life: .45, thick: .12 }));
        dust(kit, g, { n: 14, r: .6, sp: 4.5, size: .55, life: .5, cols: ['#8fa9c4', '#a9bfd6', '#b5a888'], cover: .7 });
        feathers(kit, b, cnt(kit, 10), { sp: 4 });
        kit.shake(.38);
        kit.light(b, { col: '#cfe3ff', intensity: 6, dist: 5, life: .45 });
      }
    },
    after(kit, ctx) { recoil(kit, ctx, 420, .4, 300); },
  };

  // ======================================================================
  // 虫 bug：发光小虫、蛛丝、虫群
  // ======================================================================
  const BL = '#a6d11f', BY = '#f2ff8a', BG = '#d8f55a';
  // 一只发光小虫：按时间撒黄绿的亮点（每秒 rate 个，和帧率无关：30 帧的手机上虫群不会变稀，120 帧的也不会多一倍），
  // 高画质再加一圈淡绿的光（每秒 rate 的一半多一点）。g 是这只虫的状态（攒着不到一颗的零头），dt 这一帧过了几秒
  const BUGC = ['#e8ff5a', '#c8f03a', '#f6ffa0'];
  function bugDot(kit, p, big, g, dt, rate) {
    const r = rate || 60;
    g.acc = (g.acc == null ? Math.random() : g.acc) + r * kit.qs.pmul * dt;
    let n = Math.floor(g.acc); g.acc -= n;
    for (; n > 0; n--) kit.emit(1, () => ({ pos: p.clone(), vel: kit.sph(.2), col: pick(BUGC), size: (big || 1) * kit.rnd(.15, .2), life: .14, grow: .3, cover: .45 }));
    if (kit.q !== 'high') return;
    g.acch = (g.acch == null ? Math.random() : g.acch) + r * .6 * dt;
    n = Math.floor(g.acch); g.acch -= n;
    for (; n > 0; n--) kit.emit(1, () => ({ pos: p.clone(), vel: kit.sph(.1), col: '#9ccc1a', size: (big || 1) * .34, life: .08, grow: .6, cover: .1, alpha: .5 }));
  }
  // 小招 Buzz Nip：几只发光小虫歪歪扭扭地飞过去
  function buzzFlight(kit, ctx, n, ms) {
    const { R, U } = basis(kit), bugs = [];
    for (let i = 0; i < n; i++) bugs.push({ p0: ctx.a.clone().add(kit.sph(.15)), p1: ctx.b.clone().add(kit.sph(.22)), ph: kit.rnd(0, 6.28), f: kit.rnd(2.5, 3.5), amp: kit.rnd(.25, .4), d: i * .06 });
    const p = kit.V(0, 0, 0);
    let lk = 0;
    return kit.tween(ms, k => {
      const dt = (k - lk) * ms / 1000; lk = k;
      bugs.forEach(g => {
        const u = Math.max(0, Math.min(1, (k - g.d) / (1 - g.d))), w = Math.sin(u * Math.PI);
        p.lerpVectors(g.p0, g.p1, u).addScaledVector(R, Math.sin(u * Math.PI * 2 * g.f + g.ph) * g.amp * w).addScaledVector(U, Math.cos(u * Math.PI * 1.6 * g.f + g.ph) * g.amp * .6 * w);
        bugDot(kit, p, 1.5, g, dt, 60);
      });
    });
  }
  // 两片大颚「咔」地合上（两个月牙从两边往中间夹）
  function bite(kit, at, size) {
    const { R } = basis(kit);
    crescent(kit, { from: at.clone().addScaledVector(R, -.7 * size), to: at.clone().addScaledVector(R, -.08 * size), apex: true, col: '#7cb518', col2: BY, size: .62 * size, rot: Math.PI - .25, rot1: Math.PI + .3, life: .28, travel: .4, hold: .55, push: .6 });
    crescent(kit, { from: at.clone().addScaledVector(R, .7 * size), to: at.clone().addScaledVector(R, .08 * size), apex: true, col: '#7cb518', col2: BY, size: .62 * size, rot: .25, rot1: -.3, life: .28, travel: .4, hold: .55, push: .6 });
  }
  // 蛛网（面向镜头，跟着对手）：「啪」地张开，粘一会儿，淡掉
  function web(kit, follow, o) {
    const T3 = kit.T3, m = new T3.Mesh(G.web(kit), kit.glowMat('#ffffff', .95));
    const size = o.size || 1.2, rot = kit.rnd(0, 6.28), qz = new T3.Quaternion(), Z = new T3.Vector3(0, 0, 1), F = new T3.Vector3();
    const place = (q, k) => {
      const e = kit.cam.matrixWorld.elements; F.set(e[8], e[9], e[10]).normalize();
      q.position.copy(follow()).addScaledVector(F, .5);
      q.quaternion.copy(kit.cam.quaternion).multiply(qz.setFromAxisAngle(Z, rot));
      const g = kit.EZ.out(Math.min(1, k / .12)), wob = 1 + Math.sin(k * 38) * .05 * (1 - k);
      q.scale.setScalar(size * (.2 + .8 * g) * wob);
      q.material.opacity = .95 * (k < .65 ? 1 : (1 - k) / .35);
    };
    place(m, 0);
    return kit.addFx(m, o.life || 1.3, place);
  }
  // 大招 Swarm Rush：一大群萤火虫从侧面绕一个大弯蜂拥过去，围着对手打转，最后一起扎进去（命中）
  function swarmRush(kit, ctx) {
    const N = cnt(kit, 52), { R, U, F } = basis(kit), A = ctx.a, Bc = ctx.b, other = ctx.other;
    const sideSg = ctx.side === 'me' ? -1 : 1;
    const ctrl = A.clone().lerp(Bc, .45).addScaledVector(U, 1.7).addScaledVector(R, sideSg * 1.3);
    const TR = .42, T2 = .86, T3e = 1.0, DUR = 1000;   // 每只飞 0.42 秒；0.86 秒开始收拢；1 秒扎进去
    const bugs = [];
    for (let i = 0; i < N; i++) bugs.push({ p0: A.clone().add(kit.sph(.25)), c: ctrl.clone().add(kit.sph(.7)), d: i / N * .26, phi: kit.rnd(0, 6.283), yb: kit.rnd(-.35, .45), f: kit.rnd(9, 15), ph: kit.rnd(0, 6.28), big: kit.rnd(.8, 1.3) });
    const p = kit.V(0, 0, 0), q1 = kit.V(0, 0, 0);
    const h = kit.mon(other).height, RR = .95 * Math.max(.85, h);
    let lk = 0;
    return kit.tween(DUR, k => {
      const t = k * DUR / 1000, bc = kit.center(other), dt = (k - lk) * DUR / 1000;
      lk = k;
      bugs.forEach(g => {
        const arrive = g.d + TR, w = .07;
        if (t < g.d) return;
        if (t < arrive) {
          // 沿二次贝塞尔飞：起点 → 侧上方的控制点 → 对手身边那一圈上
          const u = (t - g.d) / TR, iu = 1 - u;
          q1.set(bc.x + Math.cos(g.phi) * RR, bc.y + g.yb * h, bc.z + Math.sin(g.phi) * RR);
          p.set(0, 0, 0).addScaledVector(g.p0, iu * iu).addScaledVector(g.c, 2 * iu * u).addScaledVector(q1, u * u);
        } else {
          // 围着对手打转，越转越近；最后 0.14 秒在它身前挤成一团扎进去（挤在身前，看得见）
          const s = t - arrive, an = g.phi + s * 10, conv = t < T2 ? 1 - .55 * Math.min(1, s / Math.max(.05, T2 - arrive)) : .45 * Math.max(0, 1 - (t - T2) / (T3e - T2)), fw = t < T2 ? 0 : (1 - conv / .45) * .8 * h;
          p.set(bc.x + Math.cos(an) * RR * conv, bc.y + g.yb * h * conv + Math.sin(s * 7 + g.ph) * .1, bc.z + Math.sin(an) * RR * conv).addScaledVector(F, fw);
        }
        p.addScaledVector(R, Math.sin(t * g.f + g.ph) * w).addScaledVector(U, Math.cos(t * g.f * 1.3 + g.ph) * w);
        bugDot(kit, p, g.big, g, dt, 45);   // 52 只：每只每秒 45 颗（以前每帧 2 颗，峰值 600 多颗粒子）
      });
    });
  }
  T.bug = {
    ult: 'dash', generic: GEN,
    // 嗡嗡：几只小光点绕着出招方转
    charge(kit, ctx) {
      const n = cnt(kit, 3 + ctx.tier * 2), h = kit.mon(ctx.side).height, ph = kit.rnd(0, 6.28), ms = 300 + ctx.tier * 150, gs = [], p = kit.V(0, 0, 0);
      for (let i = 0; i < n; i++) gs.push({});
      let lk = 0;
      kit.tween(ms, k => {
        const c = kit.center(ctx.side), dt = (k - lk) * ms / 1000; lk = k;
        for (let i = 0; i < n; i++) { const an = ph + i / n * 6.283 + k * 9, r = .65 * h; bugDot(kit, p.copy(c).add(kit.V(Math.cos(an) * r, Math.sin(k * 12 + i) * .25 * h, Math.sin(an) * r)), 1, gs[i], dt, 60); }
      });
    },
    async release(kit, ctx) {
      const t = ctx.tier;
      if (t === 0) await buzzFlight(kit, ctx, cnt(kit, 4), 280);
      else if (t === 1) {
        // 中招 Silk Shot：吐出一根白丝——前头一个丝球，后面拉着一根会抖的丝线
        kit.energyBeam(ctx.a, ctx.b, { col: '#ffffff', col2: '#f3ffd0', width: .085, life: .95, grow: .3, noise: .3, taper: .15, cover: .7 });
        const o = kit.orb('#ffffff', .1);
        kit.trail(() => o.parent && o.position, { col: '#ffffff', col2: BY, width: .2, life: .12, cover: .6 });
        await kit.fly(ctx.a, ctx.b, 290, o, null, { arc: .06 });
      } else await swarmRush(kit, ctx);
    },
    impact(kit, ctx) {
      const t = ctx.tier, b = hitAt(ctx), h = kit.mon(ctx.other).height, z = zs(kit, b);
      climax(kit, ctx);
      if (t === 0) {
        bite(kit, b, Math.max(.9, h) * z);
        kit.impactStar(b, { col: BL, col2: BY, size: .85 * z, life: .24, spikes: 9 });
        kit.burst(b, [BY, BL], 16, 2.6, .28, .3);
        kit.shake(.1);
      } else if (t === 1) {
        const other = ctx.other;
        web(kit, () => kit.center(other), { size: 1.25 * Math.max(.85, h) * z, life: 1.05 });
        kit.impactStar(b, { col: '#ffffff', col2: BY, size: .9 * z, life: .24, spikes: 10 });
        kit.emit(16, () => ({ pos: b.clone(), vel: kit.sph(kit.rnd(1.5, 3)), col: '#ffffff', size: kit.rnd(.12, .2), life: .5, drag: 2, grav: -2, cover: .6 }));
        jolt(kit, other, ctx.dir, .06, 140);
        kit.shake(.12);
      } else {
        // 虫群扎进去炸开：一圈绿光冲击波 + 光点四散
        const g = kit.feet(ctx.other).setY(.12);
        kit.impactStar(b, { col: BL, col2: BY, size: 1.65 * z, life: .36, spikes: 16 });
        kit.shockwave(b, { col: BG, col2: BY, flat: false, r0: .3, r1: 2.1 * z, life: .4, thick: .14 });
        kit.shockwave(g, { col: BL, col2: BY, r0: .4, r1: 2.8 * z, life: .5, thick: .16 });
        kit.emit(80, () => { const v = kit.sph(kit.rnd(2.5, 5.5)); return { pos: b.clone().add(kit.sph(.2)), vel: v, col: pick([BY, '#fffbd0', BL]), size: kit.rnd(.16, .26), life: kit.rnd(.45, .75), drag: 2.4, grav: -.6, grow: .3, cover: .15 }; });
        kit.shake(.36);
        kit.light(b, { col: '#e6ff8a', intensity: 6, dist: 5, life: .45 });
      }
    },
  };

  // ======================================================================
  // 钢 steel：钢螺母、钢齿轮、钢铁流星；金色火花
  // ======================================================================
  const SS = '#c9d6e0', SD = '#7f95a8', SE = '#1b2733';
  // 钢材质：浅钢色 + 一点深蓝自发光（卡通光照下暗面不发灰）
  const steelMat = (kit, col) => kit.toonMat(col || SS, { emissive: SE });
  // 中招 Steel Spin：甩出高速旋转的钢齿轮，划着弧线飞过去（命中时 resolve，齿轮留下来磨一会儿，见 impact）
  async function steelSpin(kit, ctx) {
    const T3 = kit.T3, gear = new T3.Mesh(G.gear(kit), steelMat(kit)), size = .36, ph = P(ctx);
    gear.userData.keep = true;   // 飞到了先别释放，留着磨火花
    gear.scale.setScalar(size);
    const qz = new T3.Quaternion(), qx = new T3.Quaternion().setFromAxisAngle(new T3.Vector3(1, 0, 0), .55), Z = new T3.Vector3(0, 0, 1);
    let spin = 0, last = 0;
    const face = k => { spin -= (k - last) * 26; last = k; gear.quaternion.copy(kit.cam.quaternion).multiply(qx).multiply(qz.setFromAxisAngle(Z, spin)); };
    kit.trail(() => gear.parent && gear.position, { col: '#eef4f9', col2: SD, width: .32, life: .16, cover: .6 });
    await kit.fly(ctx.a, frontHit(kit, ctx, .5), 360, gear, (p, k) => { face(k); if (Math.random() < .5) glint(kit, p.clone().add(kit.V(0, .15, 0)), { size: .45, life: .15 }); }, { arc: .35, ease: k => k * (2 - k) * .3 + k * .7 });
    ph.gear = gear;
  }
  // 大招 Metal Meteor：瞄准阵 + 越来越大的影子 → 巨大的钢球拖着白热尾巴从天上砸下来（命中）
  async function metalMeteor(kit, ctx) {
    const T3 = kit.T3, other = ctx.other, ph = P(ctx), h = kit.mon(other).height, { R, F } = basis(kit);
    kit.groundCircle(other, { col: SD, col2: '#ffffff', r: 1.3, life: 1, runes: true, spin: 2.5, cover: .5 });
    const land = kit.feet(other);
    shadowDisc(kit, land, { r: 1.1, life: .6, op: .5 });
    const g = new T3.Group(), ball = new T3.Mesh(G.ball(kit), kit.toonMat('#a9bccb', { emissive: '#223140' })), band = new T3.Mesh(G.band(kit), kit.toonMat('#4f6475', { emissive: '#101820' }));
    band.rotation.x = Math.PI / 2; g.add(ball, band);
    const sz = .62 * Math.max(.9, h); g.scale.setScalar(sz); g.userData.keep = true;
    g.rotation.set(.4, 0, .3);
    // 从画面左上方斜着砸下来（太高的话大半段在画面外，看不见）
    const end = ctx.b.clone().add(kit.V(0, .25 * h, 0)).addScaledVector(F, .35), start = end.clone().addScaledVector(R, -2.8).addScaledVector(F, -1).add(kit.V(0, 3.8, 0));
    const heat = () => g.parent ? g.position : null;
    await kit.sleep(60);
    const fall = kit.fly(start, end, 520, g, p => {
      kit.emit(3, () => ({ pos: p.clone().add(kit.sph(sz)), vel: kit.V(kit.rnd(-.5, .5), kit.rnd(2, 4), kit.rnd(-.5, .5)), col: pick(['#ffd54f', '#ffab40', '#fff3d6']), size: kit.rnd(.2, .35), life: .3, grow: .3, cover: .15 }));
      if (Math.random() < .35) glint(kit, p.clone().addScaledVector(R, -.3 * sz).add(kit.V(0, .45 * sz, 0)).addScaledVector(F, sz), { size: .7, life: .14 });
    }, { arc: 0, ease: k => k * k * .45 + k * .55, spin: [5, 2, 3] });
    kit.glow(start, { col: '#ff9a3c', size: 1.7 * sz / .62, life: .52, follow: heat, cover: .3, opacity: .75 });
    kit.trail(heat, { col: '#ffd59a', col2: '#ff8a3c', width: .6 * sz / .62, life: .13, cover: .55 });
    await fall;
    ph.ball = g;
  }
  T.steel = {
    ult: 'float', generic: GEN,
    // 擦亮：身上划过一道钢光（四角星从左上滑到右下）+ 几点银光
    charge(kit, ctx) {
      const c = kit.center(ctx.side), h = kit.mon(ctx.side).height, { R, U, F } = basis(kit);
      const p0 = c.clone().addScaledVector(R, -.35 * h).addScaledVector(U, .35 * h).addScaledVector(F, .5 * h);
      glint(kit, p0, { size: 1 + ctx.tier * .3, life: .32, vel: R.clone().sub(U).multiplyScalar(2.2 * h), spin: 3 });
      kit.emit(8 + ctx.tier * 6, () => ({ pos: c.clone().add(kit.sph(kit.rnd(.4, .7) * h)), vel: kit.sph(.3), col: pick(['#ffffff', SS, '#e3edf5']), size: kit.rnd(.25, .45), life: .35, tex: 'star', spin: 4, cover: .35 }));
    },
    async release(kit, ctx) {
      const t = ctx.tier;
      if (t === 0) {
        // 小招 Iron Tap：一颗转着的钢螺母「嗖」地弹过去
        const nut = new kit.T3.Mesh(G.nut(kit), steelMat(kit));
        kit.trail(() => nut.parent && nut.position, { col: '#eef4f9', col2: SD, width: .24, life: .13, cover: .6 });
        const go = kit.fly(ctx.a, frontHit(kit, ctx, .4), 220, nut, null, { arc: .05, spin: [14, 4, 22] });
        noGlow(nut);
        await go;
      } else if (t === 1) await steelSpin(kit, ctx);
      else await metalMeteor(kit, ctx);
    },
    impact(kit, ctx) {
      const t = ctx.tier, b = hitAt(ctx), back = ctx.dir.clone().negate(), z = zs(kit, b);
      climax(kit, ctx);
      if (t === 0) {
        // 「当」：四角钢光 + 金色火花往回弹 + 螺母弹飞
        kit.impactStar(b, { col: SD, col2: '#ffffff', size: 1.15 * z, life: .3, spikes: 4 });
        kit.shockwave(b, { col: SS, col2: '#ffffff', flat: false, r0: .15, r1: .9 * z, life: .26, thick: .07 });
        sparks(kit, b, 26, { dir: back, bias: 1.2, sp: 5 });
        kit.chunks(() => G.nut(kit), SS, 1, b, .05, .7, () => back.clone().multiplyScalar(1.6).setY(3.2));
        kit.shake(.12);
      } else if (t === 1) {
        // 齿轮贴在对手身上磨 0.28 秒，一直喷火花，然后弹飞变小
        const gear = ctx.phys && ctx.phys.gear;
        kit.impactStar(b, { col: SD, col2: '#ffffff', size: 1.25 * z, life: .3, spikes: 4 });
        kit.shockwave(kit.feet(ctx.other).setY(.12), { col: SS, col2: '#ffffff', r0: .3, r1: 1.7 * z, life: .4, thick: .1 });
        sparks(kit, b, 30, { dir: back, bias: 1, sp: 5.5 });
        kit.shake(.18);
        if (gear) {
          const T3 = kit.T3, qz = new T3.Quaternion(), qx = new T3.Quaternion().setFromAxisAngle(new T3.Vector3(1, 0, 0), .55), Z = new T3.Vector3(0, 0, 1), p0 = gear.position.clone(), v = back.clone().multiplyScalar(2).setY(3.5);
          kit.scene.add(gear);
          let spin = 0;
          noGlow(kit.addFx(gear, .62, (q, k, dt) => {
            spin -= dt * 28;
            q.quaternion.copy(kit.cam.quaternion).multiply(qx).multiply(qz.setFromAxisAngle(Z, spin));
            if (k < .45) { q.position.copy(p0).add(kit.sph(.025)); sparks(kit, p0, 3, { dir: back, bias: 1.4, sp: 4.5, life: .4 }); }
            else { v.y -= 12 * dt; q.position.addScaledVector(v, dt); q.scale.setScalar(.36 * (1 - (k - .45) / .55)); }
          }));
          later(130, () => kit.shake(.12));
        }
      } else {
        // 钢球砸中：巨大的四角钢光 + 金色火花喷泉 + 地面两道冲击波 + 碎石 + 钢球往外弹开、缩小
        const ball = ctx.phys && ctx.phys.ball, g = kit.feet(ctx.other).setY(.12);
        kit.impactStar(b, { col: SD, col2: '#eef3f8', size: 1.9 * z, life: .36, spikes: 4, cover: .6 });
        later(40, () => kit.impactStar(b, { col: '#ffc940', col2: '#fff6d0', size: 1.4 * z, life: .3, spikes: 12 }));
        sparks(kit, b, 90, { sp: 7, up: 2, life: .7, size: .26 });
        kit.shockwave(g, { col: SS, col2: '#ffffff', r0: .4, r1: 3.4 * z, life: .6, thick: .2 });
        later(100, () => kit.shockwave(g, { col: '#ffd54f', col2: '#ffffff', r0: .3, r1: 2.3 * z, life: .45, thick: .12 }));
        kit.shockwave(b, { col: SS, col2: '#ffffff', flat: false, r0: .3, r1: 2.1 * z, life: .36, thick: .1 });
        dust(kit, g, { n: 18, r: .6, sp: 4.2, size: .6, life: .6, cols: ['#8f8a80', '#a39c90', '#b7ad98'], cover: .65 });
        kit.chunks(() => G.peb(kit), '#8f9aa6', cnt(kit, 9), g, .4, 1.1);
        kit.shake(.45);
        kit.light(b, { col: '#ffd27a', intensity: 6, dist: 5, life: .45 });
        if (ball) {
          // 钢球马上弹开、缩小（别一直压在挨打的那只身上）
          const { R } = basis(kit), vel = R.clone().multiplyScalar(-4).add(ctx.dir.clone().multiplyScalar(-1.5)).setY(4), s0 = ball.scale.x;
          kit.scene.add(ball);
          noGlow(kit.addFx(ball, .3, (q, k, dt) => {
            vel.y -= 14 * dt; q.position.addScaledVector(vel, dt); q.rotation.x += dt * 6;
            q.scale.setScalar(s0 * (1 - k) * (1 - k));
            if (Math.random() < .5) glint(kit, q.position.clone().add(kit.sph(.3)), { size: .5, life: .18, col: '#fff3d6' });
          }));
        }
      }
    },
    after(kit, ctx) {
      if (ctx.tier === 2) { kit.decal(kit.feet(ctx.other), { kind: 'crack', r: 1.7, life: 3 }); kit.decal(kit.feet(ctx.other), { kind: 'glow', col: '#ffcf70', r: 1, life: 1 }); }
    },
  };

  // ======================================================================
  // 辅助招式（17 个属性）：原地蓄力变强——周身属性光 + 脚下魔法阵 + 属性小图案，0.62 秒时「嗡」地一下
  // ======================================================================
  // 螺旋往上（往下）的光点：几个「领头」沿螺旋走，每帧撒一个粒子；o = { n, cols, r, h0, h1（按身高的比例）, turns, ms, size, life, tex, spin, cover, rk（半径收缩比例） }
  function spiral(kit, side, o) {
    const h = kit.mon(side).height, n = cnt(kit, o.n || 3), a0 = kit.rnd(0, 6.283), sg = Math.random() < .5 ? 1 : -1;
    return kit.tween(o.ms || 700, k => {
      const f = kit.feet(side);
      for (let i = 0; i < n; i++) {
        const th = a0 + i / n * 6.283 + sg * k * (o.turns || 1.5) * 6.283, y = (o.h0 + (o.h1 - o.h0) * k) * h, rr = (o.r || .6) * h * (1 - (o.rk || 0) * k);
        kit.emit(1, () => ({ pos: kit.V(f.x + Math.cos(th) * rr, f.y + y, f.z + Math.sin(th) * rr), vel: kit.sph(.15), col: o.cols[i % o.cols.length], size: o.size || .25, life: o.life || .3, grow: .4, tex: o.tex || 'glow', spin: o.spin || 0, cover: o.cover }));
      }
    });
  }
  // 从脚下一圈往上冒的粒子（气泡、火星、烟……）
  function risers(kit, side, o) {
    const f = kit.feet(side), h = kit.mon(side).height;
    kit.emit(o.n || 20, () => {
      const a = kit.rnd(0, 6.283), r = kit.rnd(.2, 1) * (o.r || .6) * h;
      return { pos: f.clone().add(kit.V(Math.cos(a) * r, kit.rnd(0, o.y || .4) * h, Math.sin(a) * r)), vel: kit.V(kit.rnd(-.2, .2), (o.sp || 1.4) * kit.rnd(.6, 1.2), kit.rnd(-.2, .2)), col: pick(o.cols), size: (o.size || .25) * kit.rnd(.7, 1.3), life: (o.life || .8) * kit.rnd(.7, 1.2), drag: .6, grav: o.grav || 0, grow: o.grow == null ? .6 : o.grow, tex: o.tex || 'glow', spin: o.spin || 0, cover: o.cover, fade: .3 };
    });
  }
  // 一圈小物件绕着怪兽转（叶子、石子、钢片……）；o = { n, geo, cols, r, y0, y1, rise, turns, life, size, spin, inward, dbl, emissive }
  function orbitMeshes(kit, side, o) {   // o.solid：不进发光后期那一层
    const T3 = kit.T3, n = cnt(kit, o.n || 6), g = new T3.Group(), h = kit.mon(side).height, items = [], sg = Math.random() < .5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const m = new T3.Mesh(o.geo, kit.toonMat(o.cols[i % o.cols.length], { transparent: true, side: o.dbl ? T3.DoubleSide : T3.FrontSide, emissive: o.emissive }));
      m.rotation.set(kit.rnd(0, 6), kit.rnd(0, 6), 0); m.scale.setScalar(.001);
      g.add(m); items.push({ m, a: i / n * 6.283 + kit.rnd(-.2, .2), y: kit.rnd(o.y0 || .1, o.y1 || .9), s: kit.rnd(.8, 1.2) });
    }
    const obj = kit.addFx(g, o.life || 1, (q, k, dt) => {
      const f = kit.feet(side), grow = Math.min(1, k / .15), fade = k > .8 ? (1 - k) / .2 : 1;
      items.forEach(it => {
        const th = it.a + sg * k * (o.turns || 1) * 6.283, rr = (o.r || .7) * h * (1 - (o.inward || 0) * kit.EZ.io(k));
        it.m.position.set(f.x + Math.cos(th) * rr, f.y + (it.y + (o.rise || 0) * k) * h, f.z + Math.sin(th) * rr);
        it.m.rotation.x += dt * (o.spin == null ? 3 : o.spin); it.m.rotation.y += dt * (o.spin == null ? 3 : o.spin) * .7;
        it.m.scale.setScalar((o.size || 1) * it.s * grow);
        it.m.material.opacity = fade;
      });
    });
    return o.solid ? noGlow(obj) : obj;
  }
  // 往上升、越来越大的一圈圈风环 / 光环（平铺）
  function risingRings(kit, side, o) {
    const f = kit.feet(side), h = kit.mon(side).height, n = o.n || 3;
    for (let i = 0; i < n; i++) later(i * (o.gap || 110), () => {
      const r = kit.shockwave(f.clone().setY(.15), { col: o.col, col2: o.col2, r0: .5 * h, r1: (o.r1 || 1) * h, life: o.life || .55, thick: o.thick || .07, cover: o.cover == null ? .45 : o.cover });
      const y0 = .15, y1 = (o.h || 1.2) * h, life = o.life || .55;
      kit.addFx(new kit.T3.Group(), life, (q, k) => { r.position.y = y0 + (y1 - y0) * kit.EZ.out(k); });
    });
  }

  // 每个属性的辅助招式：col / col2 光的颜色，motif 蓄力时的小图案，pulse「嗡」那一下多加的东西
  const SUP = {
    normal: {
      col: '#ffe9a8', col2: '#ffffff',
      motif: (kit, ctx) => spiral(kit, ctx.side, { n: 3, cols: [NG, '#ffffff', '#fff3c4'], tex: 'star', size: .34, spin: 5, r: .55, h0: .05, h1: 1.25, turns: 1.4, ms: 650, life: .35, cover: .25 }),
      pulse: (kit, ctx) => starBurst(kit, kit.center(ctx.side), 12, [NG, '#ffffff'], { sp: 2.6 }),
    },
    fire: {
      motif(kit, ctx, c, c2, h) {
        const f = kit.feet(ctx.side), n = cnt(kit, 6);
        for (let i = 0; i < n; i++) { const a = i / n * 6.283; later(i * 50, () => kit.flame(f.clone().add(kit.V(Math.cos(a) * .62 * h, 0, Math.sin(a) * .62 * h)), { size: .42 * h, life: .8, rise: .12 })); }
        risers(kit, ctx.side, { n: 26, cols: ['#ff7a2f', '#ffd54f', '#ffab40'], size: .2, sp: 1.8, life: .8, r: .6, cover: .1 });
      },
      pulse: (kit, ctx, c, c2, h) => { kit.flame(kit.feet(ctx.side), { size: 1.05 * h, life: .45, col: '#ff7a2f', col2: '#ffe082' }); risers(kit, ctx.side, { n: 20, cols: ['#ffd54f', '#ff7a2f'], size: .24, sp: 3, life: .5, r: .4, cover: .1 }); },
    },
    water: {
      motif: (kit, ctx) => { risers(kit, ctx.side, { n: 22, cols: ['#bdefff', '#3fa9f5', '#ffffff'], tex: 'ring', size: .3, sp: 1.1, life: .9, r: .7, cover: .35, grow: 1.2 }); kit.decal(kit.feet(ctx.side), { kind: 'splash', r: .8, life: 1.3 }); },
      pulse: (kit, ctx) => { kit.burst(kit.center(ctx.side), ['#3fa9f5', '#bdefff'], 26, 2.6, .35, .5, -4); risers(kit, ctx.side, { n: 12, cols: ['#ffffff', '#bdefff'], tex: 'ring', size: .4, sp: 2.2, life: .5, r: .5, cover: .35 }); },
    },
    grass: {
      motif: (kit, ctx) => { orbitMeshes(kit, ctx.side, { n: 8, geo: G.leaf(kit), cols: ['#5fd35f', '#9be86b', '#3fae4a'], r: .7, y0: 0, y1: .4, rise: .9, turns: 1.3, life: 1, size: 2.2, spin: 5, dbl: true }); risers(kit, ctx.side, { n: 14, cols: ['#fff59d', '#d4ff8a'], size: .16, sp: .9, life: .9, r: .7, cover: .1 }); },
      pulse: (kit, ctx) => kit.burst(kit.center(ctx.side), ['#5fd35f', '#d4ff8a'], 22, 2.4, .3, .45),
    },
    spark: {
      motif(kit, ctx, c, c2, h) {
        for (let i = 0; i < cnt(kit, 6); i++) later(i * 95, () => { const c0 = kit.center(ctx.side); kit.lightning(c0.clone().add(kit.sph(.55 * h)), c0.clone().add(kit.sph(.55 * h)), { col: '#ffe14d', width: .025, branches: 1, life: .16, jag: .4 }); });
        risers(kit, ctx.side, { n: 14, cols: ['#ffe14d', '#ffffff'], size: .18, sp: 1.6, life: .5, r: .6, cover: .1 });
      },
      pulse(kit, ctx, c, c2, h) { const c0 = kit.center(ctx.side); for (let i = 0; i < cnt(kit, 4); i++) { const d = kit.sph(1).setY(kit.rnd(-.2, .6)).normalize(); kit.lightning(c0.clone().addScaledVector(d, .3 * h), c0.clone().addScaledVector(d, 1.3 * h), { col: '#ffe14d', width: .03, branches: 1, life: .2, jag: .35 }); } },
    },
    ice: {
      motif: (kit, ctx) => { spiral(kit, ctx.side, { n: 4, cols: ['#ffffff', '#9be7ff'], tex: 'star', size: .32, spin: 2, r: .75, h0: 1.3, h1: .1, turns: 1, ms: 700, life: .45, cover: .3 }); kit.decal(kit.feet(ctx.side), { kind: 'frost', r: .9, life: 1.4 }); },
      pulse: (kit, ctx) => starBurst(kit, kit.center(ctx.side), 14, ['#ffffff', '#9be7ff'], { sp: 2.4, size: .4, grav: 0 }),
    },
    fight: {
      motif(kit, ctx, c, c2, h) {
        const f = kit.feet(ctx.side), n = cnt(kit, 8);
        for (let i = 0; i < n; i++) later(i * 70, () => { const a = kit.rnd(0, 6.283), p = f.clone().add(kit.V(Math.cos(a) * .5 * h, kit.rnd(0, .3) * h, Math.sin(a) * .5 * h)); kit.energyBeam(p, p.clone().add(kit.V(0, h * kit.rnd(.7, 1.1), 0)), { col: FO, col2: FY, width: .08, life: .26, grow: .45, noise: .3, taper: .5, cover: .5 }); });
      },
      pulse: (kit, ctx, c, c2, h) => { kit.shockwave(kit.center(ctx.side), { col: FO, col2: FW, flat: false, r0: .3, r1: 1.6 * h, life: .35, thick: .1 }); dust(kit, kit.feet(ctx.side), { n: 16, r: .4, sp: 2.6, size: .7 }); kit.shake(.12); },
    },
    poison: {
      motif: (kit, ctx) => { risers(kit, ctx.side, { n: 20, cols: ['#b25ce6', '#e8b8ff', '#8e3fc9'], tex: 'ring', size: .3, sp: 1, life: .9, r: .65, cover: .45, grow: 1.3 }); risers(kit, ctx.side, { n: 10, cols: ['#7b3fa0', '#9b5cc6'], tex: 'smoke', size: .6, sp: .6, life: .9, r: .5, cover: .55, grow: 1.6 }); },
      pulse: (kit, ctx) => { const c0 = kit.center(ctx.side); kit.emit(16, () => ({ pos: c0.clone().add(kit.sph(kit.rnd(.3, .7))), vel: kit.sph(.5), col: pick(['#e8b8ff', '#b25ce6']), size: kit.rnd(.25, .4), life: .35, grow: 2, tex: 'ring', cover: .4 })); },
    },
    ground: {
      motif: (kit, ctx) => { orbitMeshes(kit, ctx.side, { n: 8, geo: G.peb(kit), cols: ['#c9964a', '#a87a3a', '#e0c08a'], r: .75, y0: 0, y1: .3, rise: .5, turns: .8, life: .95, size: 1.3, solid: true }); dust(kit, kit.feet(ctx.side), { n: 12, r: .5, sp: 1.4, size: .6, cols: ['#e0c99a', '#c9a46a'] }); },
      pulse: (kit, ctx) => { dust(kit, kit.feet(ctx.side), { n: 18, r: .4, sp: 3, size: .8, cols: ['#e0c99a', '#c9a46a'] }); kit.shake(.1); },
    },
    flying: {
      motif: (kit, ctx) => { risingRings(kit, ctx.side, { col: WB, col2: WW, n: 3, r1: 1.05, h: 1.3, life: .55 }); feathers(kit, kit.center(ctx.side).add(kit.V(0, .4, 0)), cnt(kit, 4), { sp: 1.3, life: 1.1 }); },
      pulse: (kit, ctx) => { kit.shockwave(kit.feet(ctx.side).setY(.14), { col: WW, col2: WB, r0: .4, r1: 2.2, life: .4, thick: .1 }); dust(kit, kit.feet(ctx.side), { n: 12, r: .4, sp: 3, size: .6, cols: ['#ffffff', '#e3f0ff'], cover: .4 }); },
    },
    psychic: {
      motif(kit, ctx, c, c2, h) {
        for (let i = 0; i < 3; i++) later(i * 170, () => kit.shockwave(kit.center(ctx.side), { col: '#ff5ea8', col2: '#ffd0e8', flat: false, r0: .25 * h, r1: 1.2 * h, life: .45, thick: .06, push: .2 }));
        risers(kit, ctx.side, { n: 14, cols: ['#ff8cc6', '#ffd0e8'], size: .3, sp: .7, life: .9, r: .8, y: .9, cover: .15 });
      },
      pulse: (kit, ctx, c, c2, h) => kit.shockwave(kit.feet(ctx.side).setY(.14), { col: '#ff5ea8', col2: '#ffd0e8', r0: .3, r1: 2, life: .45, thick: .08 }),
    },
    bug: {
      motif: (kit, ctx) => spiral(kit, ctx.side, { n: 4, cols: [BY, '#fffbd0'], size: .2, r: .7, h0: .1, h1: 1.1, turns: 2, ms: 700, life: .18, cover: .15 }),
      pulse: (kit, ctx) => kit.emit(24, () => ({ pos: kit.center(ctx.side), vel: kit.sph(kit.rnd(1.5, 3)), col: pick([BY, BL, '#fffbd0']), size: kit.rnd(.15, .24), life: .5, drag: 2, cover: .15 })),
    },
    rock: {
      motif: (kit, ctx) => orbitMeshes(kit, ctx.side, { n: 7, geo: G.rock(kit), cols: ['#b09a50', '#8d7a3c', '#d8c88a'], r: .85, y0: .25, y1: .75, turns: 1.2, life: .95, size: 1.3, inward: .25, solid: true }),
      pulse: (kit, ctx) => { dust(kit, kit.feet(ctx.side), { n: 16, r: .5, sp: 2.4, size: .7, cols: ['#d8c88a', '#b09a50'] }); kit.shake(.1); },
    },
    ghost: {
      col: '#8f6cff', col2: '#3a2466',
      motif(kit, ctx, c, c2, h) {
        risers(kit, ctx.side, { n: 14, cols: ['#3b2a63', '#2a1a4a', '#5a3fa0'], tex: 'smoke', size: .7, sp: .9, life: 1, r: .6, cover: .85, grow: 1.6 });
        const f = kit.feet(ctx.side), n = cnt(kit, 4);
        for (let i = 0; i < n; i++) { const a = i / n * 6.283 + .4; later(i * 80, () => kit.flame(f.clone().add(kit.V(Math.cos(a) * .6 * h, 0, Math.sin(a) * .6 * h)), { col: '#7d5ce6', col2: '#c9b6ff', size: .38 * h, life: .75, rise: .25 })); }
      },
      pulse: (kit, ctx, c, c2, h) => kit.shockwave(kit.center(ctx.side), { col: '#8f6cff', col2: '#c9b6ff', flat: false, r0: .3, r1: 1.4 * h, life: .4, thick: .09 }),
    },
    dragon: {
      motif(kit, ctx, c, c2, h) {
        // 蓝紫和粉两条光带绕着身子往上盘
        const side = ctx.side, sg = Math.random() < .5 ? 1 : -1;
        [['#6a4dff', '#b3a4ff', 0], ['#ff5ea8', '#ffd0e8', Math.PI]].forEach(([col, col2, a0]) => {
          const p = kit.V(0, 0, 0); let live = true;
          kit.trail(() => live ? p : null, { col, col2, width: .3, life: .3, cover: .5 });
          kit.tween(720, k => { const f = kit.feet(side), th = a0 + sg * k * 2.2 * 6.283, r = .7 * h * (1 - .3 * k); p.set(f.x + Math.cos(th) * r, f.y + (.05 + 1.25 * k) * h, f.z + Math.sin(th) * r); }).then(() => { live = false; });
        });
      },
      pulse: (kit, ctx) => starBurst(kit, kit.center(ctx.side), 14, ['#6a4dff', '#ff5ea8', '#ffffff'], { sp: 3, size: .42 }),
    },
    dark: {
      col: '#b388ff', col2: '#2a1f33',
      motif(kit, ctx, c, c2, h) {
        // 黑烟从四周往身上卷 + 几点紫色闪烁
        const ctr = kit.center(ctx.side);
        kit.emit(22, () => { const a = kit.rnd(0, 6.283), r = kit.rnd(.9, 1.3) * h, p = ctr.clone().add(kit.V(Math.cos(a) * r, kit.rnd(-.5, .4) * h, Math.sin(a) * r)); const t = kit.V(-Math.sin(a), 0, Math.cos(a)); return { pos: p, vel: ctr.clone().sub(p).multiplyScalar(1.1).addScaledVector(t, 1.4), col: pick(['#2a1f33', '#3d2d4a', '#4a3a55']), size: kit.rnd(.55, .85), life: .8, drag: .8, grow: .5, tex: 'smoke', spin: 2, cover: .9 }; });
        spiral(kit, ctx.side, { n: 2, cols: ['#b388ff', '#e1ccff'], tex: 'star', size: .3, spin: 4, r: .6, h0: .2, h1: 1.1, turns: 1.2, ms: 650, life: .3, cover: .3 });
      },
      pulse: (kit, ctx, c, c2, h) => kit.shockwave(kit.feet(ctx.side).setY(.14), { col: '#4a3a55', col2: '#b388ff', r0: .3, r1: 1.9, life: .45, thick: .12 }),
    },
    steel: {
      col: '#c9d6e0', col2: '#ffffff',
      motif: (kit, ctx) => orbitMeshes(kit, ctx.side, { n: 6, geo: G.plate(kit), cols: [SS, '#8fa3b5'], emissive: SE, r: 1, y0: .25, y1: .85, turns: .8, life: .9, size: 1.6, inward: .55, spin: 4, solid: true }),
      pulse(kit, ctx, c, c2, h) {
        const c0 = kit.center(ctx.side), { R, U, F } = basis(kit);
        glint(kit, c0.clone().addScaledVector(R, -.25 * h).addScaledVector(U, .3 * h).addScaledVector(F, .5 * h), { size: 1, life: .3, vel: R.clone().sub(U).multiplyScalar(1.5 * h) });
        kit.shockwave(c0, { col: SD, col2: SS, flat: false, r0: .3, r1: 1.3 * h, life: .3, thick: .07 });
        kit.emit(8, () => ({ pos: c0.clone().add(kit.sph(kit.rnd(.3, .6) * h)), vel: kit.sph(.4), col: pick(['#ffffff', SS]), size: kit.rnd(.25, .4), life: .4, tex: 'star', spin: 4, cover: .35 }));
      },
    },
  };
  // 骨架：属性光 + 魔法阵 + 小图案 → 0.62 秒「嗡」：脚下冲击波、身上一团光、点光源 → 0.9 秒结束
  async function powerUp(kit, ctx) {
    const sp = SUP[ctx.type] || SUP.normal, side = ctx.side, c = sp.col || ctx.cols[0], c2 = sp.col2 || ctx.cols[1], h = kit.mon(side).height;
    // 很浅的颜色（一般、钢、飞行、冰）：周身光减半、不给怪兽上色——白光一叠，怪兽就成了一团白
    const lc = kit.C(c), pale = lc.r * .3 + lc.g * .59 + lc.b * .11 > .55;
    kit.aura(side, { col: c, col2: c2, life: 1.05, strength: pale ? .45 : .8, tint: !pale });
    kit.groundCircle(side, { col: c, col2: c2, r: 1.05, life: 1.1, runes: true, spin: 1.4 });
    try { if (sp.motif) sp.motif(kit, ctx, c, c2, h); } catch (e) { console.warn('[BattleFX] ' + ctx.type + ' 辅助招式出错', e && e.message); }
    await kit.sleep(620);
    if (!kit.mon(side)) return;
    const f = kit.feet(side), ctr = kit.center(side);
    kit.sfx(ctx.type, 'launch', 0);
    kit.shockwave(f.clone().setY(.12), { col: c, col2: c2, r0: .3, r1: 1.8, life: .45, thick: .09, opacity: pale ? .7 : 1 });
    kit.glow(ctr, { col: c, size: h * 1.3, life: .35, grow: 1.5, opacity: pale ? .35 : .6 });
    kit.light(ctr, { col: c, intensity: 5, life: .45 });
    try { if (sp.pulse) sp.pulse(kit, ctx, c, c2, h); } catch (e) { console.warn('[BattleFX] ' + ctx.type + ' 辅助招式出错', e && e.message); }
    await kit.sleep(280);
  }
  ['normal', 'fire', 'water', 'grass', 'spark', 'ice', 'fight', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'].forEach(t => { S[t] = powerUp; });
})();
