// 回声岛 · 战斗特效库（元素系）：火 fire、水 water、草 grass、冰 ice、地面 ground、岩石 rock
// 登记到 window.BattleFX.types[type] = { charge?, release, impact?, after?, physical? }（规格见 tools/FX_SPEC.md §2–§5）：
//   release(kit, ctx) 放出招式，**必须在命中那一刻 resolve**（monsters.js 接着出伤害数字、调 hit()）
//   charge(kit, ctx) 蓄力时加的东西：这里都是「放出去就不管」，不 await（蓄力多长由通用蓄力决定）
//   impact / after 命中后、余韵（后台跑，不挡流程）；命中星、闪屏、点光源、大招慢动作由 battle3d.js 的通用命中做，这里只加属性味道。
//   六个属性都登记了 generic: { wave: false }：通用的白色冲击波（大招还有一圈面向镜头的）叠上发光后期会糊成一个白球，冲击波改成自己放属性色的
//   kit = battle3d.js 给的工具箱（FX_SPEC §3.1）；ctx = { a 出招点, b 命中点, dir 朝对手的水平方向, side, other, tier 0 小招 / 1 中招 / 2 大招, cols, info, type }
// 2026-10-07 特效 2.0 重做——每个属性三档一眼分得出来，大招有一个招牌镜头：
//   火   小 Hot Nip       火球飞过去，上下两排火焰獠牙一口咬合
//        中 Flame Wave    一道火浪贴着地面卷过去，扑上对手脚下烧成一圈
//        大 Fire Boom     蓄力时头顶长出小太阳 → 扔出去砸进对手脚下 → 地面烧红、火苗一圈圈冒 → 火柱冲天
//   水   小 Bubble Shot   一串泡泡晃着飞过去、连环炸开
//        中 Tidal Wave    一道卷着白沫的浪从脚下涌起、拍到对手身上
//        大 Hydro Storm   双股螺旋水流 → 对手脚下卷起水龙卷把它托起来 → 砸下去溅起水花皇冠
//   草   小 Leaf Cut      旋转的飞叶镖拐着弯飞过去，留下斩痕
//        中 Vine Swing    两根藤蔓从地里钻出、甩过头顶抽下去
//        大 Solar Bloom   藤蔓缠身、脚下开出一朵大花、天上聚光，阳光柱砸下来花瓣四散
//   冰   小 Frost Nip     三根冰锥，命中处长出一朵冰花
//        中 Snow Spin     旋转的冰刃雪环飞过去，绕着对手转一圈再收拢扎进去
//        大 Glacier Crash 地面一路冻过去 → 冰晶牢笼困住对手 → 冰山从天上砸下来全部炸碎
//   地面 小 Mud Toss      两团泥巴高高抛过去，啪地溅开
//        中 Sand Twister  沙尘龙卷带着碎石移过去，把对手卷在里面
//        大 Quake Slam    跺脚 → 地裂一路裂到对手脚下 → 一圈岩柱拱起来
//   岩石 小 Pebble Pop    一把碎石散弹
//        中 Rock Roll     大石头从地里顶出来，蹦着滚过去撞碎
//        大 Boulder Fall  对手脚下的影子越来越大，陨石带着烟尾巴砸下来，后面还跟着两块
// 时长（release 开始到命中，实测）：小招 ≈ 0.25–0.3 s、中招 ≈ 0.45–0.65 s、大招 ≈ 0.55–0.8 s（前面还有蓄力、大招过场、特殊动作）
// 安全：全屏闪一律交给通用命中（这里不闪）；自己的震动 ≥ .2 的每招最多一次（通用命中大招再震一次）；减少动态效果时不把对手托起来
// 好看：实心的东西（石头、冰、叶子、藤蔓、花瓣、水）不进发光后期（solid）；土、石头的粒子颜色压暗（粒子都会发光，亮土黄色会发出橙光像火）；
//   天上掉下来的东西从对手身后落（awayCam），挡在镜头前面的岩柱、冰晶矮一截
// 性能：网格数量按画质缩减（QN），粒子 kit.emit 自己缩减；几何体用 kit.geo 缓存（名字以 el: 开头）；藤蔓、地裂的几何体每次新建、到期释放；
//   材质用 kit 的池子，水的着色器材质每场战斗留 4 个循环用（waterMat）
(function () {
  'use strict';
  const BFX = window.BattleFX = window.BattleFX || { types: {}, support: {} };
  const T = BFX.types = BFX.types || {};

  // ---------- 公用小工具 ----------
  const PI = Math.PI, TAU = Math.PI * 2;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const QN = (kit, n) => Math.max(1, Math.round(n * kit.qs.pmul));   // 网格数量按画质缩减（1 / .7 / .45）
  const flat = (kit, d) => kit.V(-d.z, 0, d.x);                       // 水平面上和 d 垂直的方向（左右）
  const wait = (kit, ms) => kit.tween(ms, () => {});                  // 按特效时间等（slowmo 时一起慢）
  const backOut = k => { const s = 1.7, x = k - 1; return 1 + (s + 1) * x * x * x + s * x * x; };   // 冲过头一点再回来
  // 每秒 perSec 个（已按画质缩减）：返回 dt 秒 → 这一帧放几个
  function rate(kit, perSec) { let acc = Math.random(); const r = perSec * kit.qs.pmul; return dt => { acc += r * dt; const n = Math.floor(acc); acc -= n; return n; }; }
  // 拿着一个物件：addFx 管寿命（最长 life 秒），h.end() 提前结束（下一帧移走、材质还回池子）
  function hold(kit, obj, life, upd, end) {
    const h = { obj, dead: false, end() { h.dead = true; } };
    kit.addFx(obj, life, (o, k, dt) => h.dead || (upd ? upd(o, k, dt) === true : false), end);
    return h;
  }
  // 二次贝塞尔曲线上的点
  const bez = (out, p0, c, p1, t) => { const u = 1 - t; return out.set(u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, u * u * p0.y + 2 * u * t * c.y + t * t * p1.y, u * u * p0.z + 2 * u * t * c.z + t * t * p1.z); };
  // 镜头的右、上方向（画「斩痕」、冰花这种贴着屏幕的东西用）
  const camAxes = kit => { const q = kit.cam.quaternion; return { r: kit.V(1, 0, 0).applyQuaternion(q), u: kit.V(0, 1, 0).applyQuaternion(q) }; };
  // 实心的东西（石头、冰块、叶子、藤蔓、花瓣）不进发光后期：亮颜色的打光模型一发光就糊成一团白
  const solid = o => { o.traverse(q => { q.layers.disable(1); }); return o; };
  // 往镜头挪一点（盖在怪兽前面）
  const toCam = (kit, p, d) => p.clone().add(kit.cam.position.clone().sub(p).normalize().multiplyScalar(d));
  // 水平方向上背对镜头（从天上掉下来的东西从对手身后落下，不会挡在镜头前面）
  const awayCam = (kit, p) => p.clone().sub(kit.cam.position).setY(0).normalize();
  // 大招镜头：从默认机位推向挨打的一方，再抬头 lift（看冲天的柱子、天上掉下来的东西）；对手打我方时我方离镜头近，少抬一点
  function camUp(kit, ctx, lift, ms) {
    const near = ctx.other === 'me', f = kit.shotToward(ctx.other, near ? .06 : .2, .55);
    kit.camTo(() => { const s = f(); s.look.y += lift * (near ? .55 : 1); return s; }, ms || 450, kit.EZ.io);
  }
  // 斩痕：贴着屏幕的一道细光（ang 是屏幕上的角度）
  function slash(kit, at, o) {
    o = o || {};
    const { r, u } = camAxes(kit), an = o.ang != null ? o.ang : kit.rnd(-.8, .8), L = o.len || .55;
    const d = r.multiplyScalar(Math.cos(an)).addScaledVector(u, Math.sin(an)).multiplyScalar(L), c = toCam(kit, at, o.push || .45);
    return kit.energyBeam(c.clone().sub(d), c.clone().add(d), { col: o.col || '#ffffff', col2: o.col2 || '#ffffff', width: o.width || .08, life: o.life || .2, grow: .3, taper: .45, noise: .3, cover: o.cover == null ? .3 : o.cover });
  }
  // 碎块（共用几何体）：飞出去、落地弹一下、最后淡掉。o = { s0, s1 大小, vel(i) 初速度, spread, grav, life, emissive, side, floor }
  function debris(kit, geoFn, cols, n, at, o) {
    o = o || {};
    const { V, rnd, T3 } = kit;
    for (let i = 0; i < QN(kit, n); i++) {
      const m = new T3.Mesh(geoFn(i), kit.toonMat(pick(cols), { transparent: true, emissive: o.emissive || '#1a140c', side: o.side }));
      const s = rnd(o.s0 || .06, o.s1 || .12);
      if (o.shape) o.shape(m, s); else m.scale.setScalar(s);
      m.position.copy(at).add(kit.sph(o.spread == null ? .15 : o.spread));
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      const v = o.vel ? o.vel(i) : kit.sph(rnd(1.2, 2.6)).add(V(0, rnd(1.5, 3), 0)), w = V(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
      const g = o.grav == null ? 10 : o.grav, floor = o.floor == null ? .09 : o.floor;
      kit.addFx(m, rnd(.75, 1.05) * (o.life || 1), (q, k, dt) => {
        v.y -= g * dt; q.position.addScaledVector(v, dt);
        if (q.position.y < floor + s * .4) { q.position.y = floor + s * .4; v.set(v.x * .45, Math.abs(v.y) * .28, v.z * .45); w.multiplyScalar(.5); }
        q.rotation.x += w.x * dt; q.rotation.y += w.y * dt; q.rotation.z += w.z * dt;
        q.material.opacity = k > .7 ? (1 - k) / .3 : 1;
      });
      solid(m);
    }
  }

  // ---------- 共用几何体（kit.geo 按名字缓存，整场战斗只建一次，不会被释放） ----------
  // 按顶点位置算的哈希：同一个位置的顶点挪得一样，捏出来的形状面不会裂开
  const H3 = (x, y, z, s) => { const n = Math.sin(Math.round(x * 1e3) * .0129898 + Math.round(y * 1e3) * .078233 + Math.round(z * 1e3) * .037719 + s * 4.137) * 43758.5453; return n - Math.floor(n); };
  function lumpy(g, amt, seed) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + (H3(x, y, z, seed) - .5) * amt;
      p.setXYZ(i, x * f, y * f, z * f);
    }
    g.computeVertexNormals();
    return g;
  }
  // 拆成不共用顶点的三角形 → 法线是平的，石头、冰块一面一面的
  const facet = g => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.computeVertexNormals(); return n; };
  // 浪：一片往前卷的水（+Z 朝前、x 左右 -1..1、底在 y=0、浪顶高 1；两头收窄）
  function waveGeo(T3) {
    const S = [[-1, 0], [-.72, .15], [-.45, .4], [-.22, .7], [-.05, .93], [.1, 1], [.25, .97], [.37, .84], [.44, .66], [.46, .5]];
    const NU = 16, NS = S.length, pos = [], uv = [], idx = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU * 2 - 1, tp = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 4)));
      for (let j = 0; j < NS; j++) { pos.push(u, S[j][1] * tp, S[j][0] * (.55 + .45 * tp)); uv.push(i / NU, j / (NS - 1)); }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NS - 1; j++) { const a = i * NS + j, b = a + NS; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const GEO = {
    ball: k => k.geo('sph14', () => new k.T3.SphereGeometry(1, 14, 10)),   // 和 kit.orb 共用
    // 冰锥 / 冰片：细长八面体，尖朝 ±Y，长 2
    shard: k => k.geo('el:shard', () => new k.T3.OctahedronGeometry(1, 0).scale(.26, 1, .26)),
    // 冰晶柱：六棱柱 + 尖顶（底在 y=0、高 1）
    crystal: k => k.geo('el:crystal', () => { const V2 = k.T3.Vector2; return facet(new k.T3.LatheGeometry([new V2(0, 0), new V2(.2, 0), new V2(.23, .64), new V2(0, 1)], 6)); }),
    // 冰牢：六棱柱（底在 y=0、半径 1、高 1）
    prism: k => k.geo('el:prism', () => facet(new k.T3.CylinderGeometry(1, 1, 1, 6, 1, false).translate(0, .5, 0))),
    // 冰山：捏扁一点、坑坑洼洼的二十面体
    berg: k => k.geo('el:berg', () => lumpy(new k.T3.IcosahedronGeometry(1, 0), .4, 7).scale(1, .82, 1)),
    // 大石头（一面一面的）、三种小碎石、泥巴团（圆滑）、岩柱（底在 y=0、高 1）
    boulder: k => k.geo('el:boulder', () => lumpy(new k.T3.IcosahedronGeometry(1, 1), .32, 3)),
    rock: (k, i) => k.geo('el:rock' + ((i | 0) % 3), () => lumpy(new k.T3.IcosahedronGeometry(1, 0), .55, 11 + ((i | 0) % 3) * 5)),
    mud: k => k.geo('el:mud', () => lumpy(new k.T3.SphereGeometry(1, 10, 8), .45, 5)),
    pillar: k => k.geo('el:pillar', () => lumpy(facet(new k.T3.CylinderGeometry(.13, .3, 1, 5, 2).translate(0, .5, 0)), .3, 9)),
    // 叶片：中心在原点、长 1（尖朝 ±Y），转起来像飞镖
    blade: k => k.geo('el:blade', () => { const s = new k.T3.Shape(); s.moveTo(0, -.5); s.quadraticCurveTo(.34, -.08, 0, .5); s.quadraticCurveTo(-.34, -.08, 0, -.5); return new k.T3.ShapeGeometry(s, 6); }),
    // 花瓣：根在原点、朝 +Y 长 1
    petal: k => k.geo('el:petal', () => { const s = new k.T3.Shape(); s.moveTo(0, 0); s.bezierCurveTo(.44, .22, .38, .86, 0, 1); s.bezierCurveTo(-.38, .86, -.44, .22, 0, 0); return new k.T3.ShapeGeometry(s, 8); }),
    wave: k => k.geo('el:wave', () => waveGeo(k.T3)),
  };

  // ======================= 火 =======================
  const FIRE = ['#ff7a2f', '#ffd54f', '#ffb347', '#ff5a1f'];
  const FL = { col: '#ff3d0a', col2: '#ffb52e' };   // 火焰贴片用深一点的红橙（默认的橙黄叠在亮场地上发白）
  // 火星：四角星，往上飘、闪
  function embers(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, sp = o.spread == null ? .15 : o.spread;
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(rnd(0, sp))), vel: kit.sph(rnd(.3, 1) * (o.speed || 1.4)).add(V(0, rnd(.4, 1.4) * (o.up || 1), 0)), col: pick(FIRE), size: rnd(.12, .24) * (o.size || 1), life: rnd(.4, .8) * (o.life || 1), grav: o.grav == null ? 1.2 : o.grav, drag: 1.4, tex: 'star', spin: rnd(-7, 7), grow: .3, cover: 0 }));
  }
  // 灰烟（普通颜色，能盖住亮背景）
  function smoke(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, r = o.r || .3;
    kit.emit(n, () => ({ pos: at.clone().add(V(rnd(-r, r), rnd(0, .2), rnd(-r, r))), vel: V(rnd(-.2, .2), rnd(.4, .9) * (o.up || 1), rnd(-.2, .2)), col: pick(o.cols || ['#6b625a', '#857a70', '#4e4842']), size: rnd(.4, .7) * (o.size || 1), life: rnd(.8, 1.3) * (o.life || 1), grow: 2.2, drag: .8, tex: 'smoke', spin: rnd(-1, 1), cover: o.cover == null ? .5 : o.cover, alpha: o.alpha == null ? .8 : o.alpha }));
  }
  // 面向镜头的火焰贴片（底边在 at），rot 是屏幕上的朝向（0 朝上）
  function flameAt(kit, at, size, life, rot, o) {
    o = o || {};
    const m = kit.flame(at, { size, life, col: o.col || FL.col, col2: o.col2 || FL.col2, push: o.push || 0, cover: o.cover == null ? .62 : o.cover, rise: o.rise || 0 });
    m.material.uniforms.uRot.value = rot || 0;
    return m;
  }
  // 屏幕上指向 (dx, dy)（镜头空间）的贴片转角
  const rotTo = (dx, dy) => Math.atan2(-dx, dy);
  // 世界方向 → 镜头空间方向
  const viewDir = (kit, d) => d.clone().applyQuaternion(kit.cam.quaternion.clone().invert());
  // 火球：白热的芯 + 橙红的壳 + 一圈往外窜的火舌（隔一会儿冒一根新的）；s.dir（镜头空间的飞行方向）有值时火舌都朝后，像彗星
  // o = { life, every（多久冒一根火舌）, upd(dt) 每帧额外做的事 }；s.grow 0–1 控制大小，s.h.end() 拿掉
  // 火舌是自己有寿命的特效，**不能放进火球的 Group 里**：火球到期时会把整组的材质还回池子，还活着的火舌的材质就被别的火焰拿去用了
  // （两团火共用一个材质、乱闪）。所以火舌留在场景里，每帧跟着火球挪；火球没了，火舌也一起收掉
  function fireBall(kit, R, o) {
    o = o || {};
    const { T3, rnd } = kit, g = new T3.Group(), ball = GEO.ball(kit), tongues = [];
    const core = new T3.Mesh(ball, kit.glowMat('#fff3c4', 1, true)), shell = new T3.Mesh(ball, kit.glowMat('#ff6a1a', .95)), halo = new T3.Mesh(ball, kit.glowMat('#ff3d0a', .3));
    g.add(halo, shell, core);
    const s = { g, R, grow: 1, dir: null };
    let acc = 0, t = 0;
    s.h = hold(kit, g, o.life || 4.5, (q, k, dt) => {
      t += dt; acc += dt;
      if (o.upd) o.upd(dt);
      const r = R * s.grow, pu = 1 + .07 * Math.sin(t * 22);
      core.scale.setScalar(Math.max(.001, r * .55 * pu)); shell.scale.setScalar(Math.max(.001, r * pu)); halo.scale.setScalar(Math.max(.001, r * 1.45 * (1 + .08 * Math.sin(t * 13))));
      if (acc > (o.every || .07) && r > .03) {
        acc = 0;
        const rot = s.dir ? rotTo(-s.dir.x, -s.dir.y) + rnd(-.35, .35) : rnd(0, TAU);
        tongues.push(flameAt(kit, g.position, r * rnd(1.3, 1.9) * (s.dir ? 1.3 : 1), rnd(.22, .32), rot, { push: .05 }));
      }
      // 火舌跟着火球（火焰自己每帧会把高度设回出生时的高度，这里在它之后再挪一次）；已经到期的从名单里拿掉
      for (let i = tongues.length - 1; i >= 0; i--) { const fl = tongues[i]; if (!fl.parent) tongues.splice(i, 1); else fl.position.copy(g.position); }
    }, () => {
      // 火球没了：还活着的火舌藏起来、下一帧到期（材质由它们自己的条目还回池子）
      tongues.forEach(fl => { const f = fl.userData.fxe; fl.visible = false; if (f) f.t = f.life; });
      tongues.length = 0;
    });
    return s;
  }
  // 大招蓄力：头顶长出一颗小太阳，出招时把它扔出去（存在 ctx._sun；过场期间一直悬着，跟着怪兽浮起来）
  function fireSun(kit, side, instant) {
    const { V, rnd } = kit, mm = kit.mon(side), top = () => mm.root.position.clone().add(V(0, mm.height + .4, 0)), feed = rate(kit, 70);
    let s = null;
    s = fireBall(kit, .3, { every: .06, upd: dt => {
      s.grow = Math.min(1, s.grow + dt / .5);
      if (!s.follow) return;
      s.g.position.copy(top());
      const n = feed(dt);   // 火星往里卷
      if (n) kit.emit(n, () => { const c = s.g.position, p = c.clone().add(kit.sph(rnd(.5, .8))), life = rnd(.22, .32); return { pos: p, vel: c.clone().sub(p).multiplyScalar(1 / life), col: pick(FIRE), size: rnd(.14, .26), life, grow: .3, tex: 'star', spin: rnd(-6, 6), cover: 0 }; });
    } });
    s.follow = true; s.grow = instant ? 1 : .05; s.g.position.copy(top());
    return s;
  }
  // 火焰獠牙：上下两排火舌（面向镜头，两边的往里歪），st.gap 1 张开 → 0 咬合
  function fangs(kit, at, size) {
    const { T3, V } = kit, { r } = camAxes(kit), st = { gap: 1 };
    [1, -1].forEach(sg => {
      const g = new T3.Group(), place = o => { o.position.copy(at).add(V(0, sg * (.03 + .46 * st.gap) * size, 0)); };
      place(g);
      kit.addFx(g, .5, o => { place(o); });
      [-1.5, -.5, .5, 1.5].forEach(i => {
        const outer = Math.abs(i) > 1;
        g.add(flameAt(kit, r.clone().multiplyScalar(i * .15 * size), (outer ? .27 : .36) * size, .45, (sg > 0 ? PI : 0) - sg * Math.sign(i) * (outer ? .38 : .12), { push: .55, cover: .72 }));
      });
    });
    return st;
  }
  // 一圈往外窜的火舌（面向镜头，咬中 / 炸开的那一下）
  function flameBurst(kit, at, n, size, push) {
    const r0 = kit.rnd(0, TAU);
    for (let i = 0; i < n; i++) flameAt(kit, at, size * kit.rnd(.8, 1.2), kit.rnd(.22, .3), r0 + i / n * TAU, { push: push || .5 });
  }
  async function emberBite(kit, ctx) {
    const { a, b } = ctx, { V, rnd } = kit, end = toCam(kit, b, .3);
    const fb = fireBall(kit, .12, { every: .04, life: 1 }), vd = viewDir(kit, end.clone().sub(a));
    fb.dir = V(vd.x, vd.y, 0).normalize();
    kit.trail(() => fb.h.dead ? null : fb.g.position, { col: FL.col, col2: FL.col2, width: .13, life: .12, cover: .6 });
    const sp = rate(kit, 110);
    let lk = 0, J = null;
    await kit.fly(a, end, 200, fb.g, (p, k) => {
      const n = sp((k - lk) * .2); lk = k;
      if (n) kit.emit(n, () => ({ pos: p.clone().add(kit.sph(.05)), vel: kit.sph(rnd(.2, .6)).add(V(0, .5, 0)), col: pick(FIRE), size: rnd(.12, .2), life: rnd(.25, .4), tex: 'star', spin: 6, grow: .3, cover: 0 }));
      if (!J && k > .3) J = fangs(kit, b, 1.3);   // 快到的时候獠牙张开
    }, { arc: .06 });
    fb.h.end();
    if (!J) J = fangs(kit, b, 1.3);
    await kit.tween(80, k => { J.gap = 1 - k * k; });
    J.gap = 0;
    // 咬中：一圈火舌炸开
    flameBurst(kit, b, QN(kit, 6), .3, .6);
    embers(kit, b, 14, { speed: 2.2, spread: .1 });
  }
  async function flameWave(kit, ctx) {
    const { dir, side, other, b } = ctx, { V, rnd } = kit, lat = flat(kit, dir);
    const f0 = kit.feet(side).addScaledVector(dir, .5), f1 = kit.feet(other).addScaledVector(dir, -.25), front = f0.clone();
    const ms = 420, rows = 12, nl = kit.q === 'high' ? 3 : 2;
    const L = kit.light(f0.clone().setY(.5), { col: '#ff7a2f', intensity: 9, dist: 4, life: .9 });
    let next = 0;
    await kit.tween(ms, k => {
      front.lerpVectors(f0, f1, k * (.7 + .3 * k));   // 越烧越快
      if (L) L.position.copy(front).setY(.55);
      while (next <= k * rows) {
        const kk = next / rows, w = .28 + .24 * kk;
        for (let i = 0; i < nl; i++) {
          const u = nl === 1 ? 0 : i / (nl - 1) * 2 - 1;
          kit.flame(front.clone().addScaledVector(lat, u * w + rnd(-.06, .06)).setY(.06), { size: (.36 + .32 * kk) * rnd(.85, 1.15) * (u ? .85 : 1.1), life: .4 + .12 * kk, rise: .12, col: FL.col, col2: FL.col2, cover: .62 });
        }
        embers(kit, front.clone().setY(.25), 3, { speed: 1, up: 1.4 });
        next++;
      }
    });
    // 火浪扑上去：脚下一圈火 + 身上一团火
    const F = kit.feet(other), H = kit.mon(other).height, n = QN(kit, 7);
    for (let i = 0; i < n; i++) { const an = i / n * TAU + rnd(-.2, .2); kit.flame(F.clone().add(V(Math.cos(an) * .55, -.02, Math.sin(an) * .55)), { size: rnd(.5, .7), life: .5, rise: .3, col: FL.col, col2: FL.col2, cover: .62 }); }
    kit.flame(F.clone().setY(.05), { size: H * .72, life: .42, rise: .2, push: .3, col: FL.col, col2: FL.col2, cover: .62 });
    embers(kit, b, 18, { speed: 2.4 });
  }
  async function infernoBlast(kit, ctx) {
    const { dir, side, other } = ctx, { V, rnd } = kit;
    const sun = ctx._sun && !ctx._sun.h.dead ? ctx._sun : fireSun(kit, side, true);
    ctx._sun = null; sun.follow = false; sun.grow = 1;
    const F = kit.feet(other), g0 = sun.g.position.clone(), hitP = F.clone().addScaledVector(dir, -.1).setY(.12);
    const ctl = g0.clone().lerp(hitP, .5).add(V(0, 2.3, 0)), p = V(0, 0, 0), prev = g0.clone();
    camUp(kit, ctx, 1, 520);
    kit.trail(() => sun.h.dead ? null : sun.g.position, { col: FL.col, col2: FL.col2, width: .3, life: .2, cover: .6 });
    const sp = rate(kit, 140);
    let lk = 0;
    // 1. 小太阳划一道高弧线砸进对手脚下（火舌朝后拖着）
    await kit.tween(380, k => {
      bez(p, g0, ctl, hitP, Math.pow(k, 1.5)); sun.g.position.copy(p);
      const vd = viewDir(kit, p.clone().sub(prev)); if (vd.lengthSq() > 1e-8) sun.dir = V(vd.x, vd.y, 0).normalize();
      prev.copy(p);
      const n = sp((k - lk) * .38); lk = k;
      if (n) kit.emit(n, () => ({ pos: p.clone().add(kit.sph(.15)), vel: kit.sph(rnd(.3, .9)), col: pick(FIRE), size: rnd(.16, .3), life: rnd(.3, .5), tex: 'star', spin: 5, grow: .3, cover: 0 }));
    });
    sun.h.end();
    // 2. 地面烧红，一圈火苗一个接一个冒出来
    kit.sfx('fire', 'impact', 0);
    flameBurst(kit, hitP.clone().setY(.3), QN(kit, 5), .45, .2);
    kit.shockwave(F.clone().setY(.12), { col: '#ff7a2f', col2: '#ffd54f', r0: .2, r1: 1.5, life: .4, thick: .12, cover: .5 });
    kit.decal(F, { kind: 'glow', col: '#ff5a1a', r: 1.15, life: 1.4 });
    kit.groundCircle(other, { col: '#ff5a1a', col2: '#ffb52e', r: 1.2, runes: true, life: 1.4, spin: 1.6, cover: .5 });
    kit.light(F.clone().setY(.4), { col: '#ff7a2f', intensity: 8, dist: 4, life: .5 });
    kit.shake(.12);
    embers(kit, hitP, 18, { speed: 2, up: 2 });
    const n = QN(kit, 7);
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU, q = F.clone().add(V(Math.cos(an) * .9, -.02, Math.sin(an) * .9));
      kit.flame(q, { size: .36, life: .45, rise: .1, col: FL.col, col2: FL.col2, cover: .62 });
      embers(kit, q.setY(.15), 3, { speed: .4, up: 2.5 });
      await wait(kit, 220 / n);
    }
    await wait(kit, 50);
    // 3. 火柱冲天（红橙色的柱子 + 一节节往上窜的火焰；命中后 0.45 秒就收掉，看得清对手）
    const top = F.clone().add(V(0, 5.5, 0)), bot = F.clone().setY(.02);
    kit.energyBeam(bot, top, { col: '#ff3d0a', col2: '#ff9a2e', width: .62, life: .45, grow: .12, taper: .06, noise: 1.8, cover: .7, opacity: .85 });
    const ns = QN(kit, 6);
    for (let i = 0; i < ns; i++) kit.flame(F.clone().add(V(rnd(-.15, .15), i * 2.6 / ns, rnd(-.15, .15))), { size: rnd(.95, 1.2) * (1 - i * .06), life: rnd(.38, .46), rise: 1.5, col: FL.col, col2: FL.col2, cover: .65 });
    const m = QN(kit, 7);
    for (let i = 0; i < m; i++) { const an = i / m * TAU + rnd(-.2, .2); kit.flame(F.clone().add(V(Math.cos(an) * .72, 0, Math.sin(an) * .72)), { size: rnd(.65, .85), life: .42, rise: .5, col: FL.col, col2: FL.col2, cover: .65 }); }
    kit.shockwave(F.clone().setY(.14), { col: '#ff7a2f', col2: '#ffd54f', r0: .4, r1: 2.7, life: .55, thick: .18, cover: .55 });
    kit.light(F.clone().setY(1.2), { col: '#ff8a3d', intensity: 8, dist: 6, life: .6 });
    kit.emit(40, () => ({ pos: F.clone().add(V(rnd(-.4, .4), rnd(0, .6), rnd(-.4, .4))), vel: V(rnd(-1.2, 1.2), rnd(3, 7), rnd(-1.2, 1.2)), col: pick(FIRE), size: rnd(.16, .3), life: rnd(.6, 1.1), grav: -4, drag: .6, tex: 'star', spin: rnd(-6, 6), grow: .3, cover: 0 }));
    kit.shake(.3);
  }
  T.fire = {
    generic: { wave: false },   // 冲击波自己放橙色的（通用的白色冲击波叠在火柱上整片发白）
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { V, rnd } = kit, c = kit.center(side), f = kit.feet(side);
      // 火星从四周往身上吸
      kit.emit(14 + t * 12, () => { const p = c.clone().add(kit.sph(rnd(.9, 1.4))), life = rnd(.3, .45); return { pos: p, vel: c.clone().sub(p).multiplyScalar(.9 / life), col: pick(FIRE), size: rnd(.14, .26), life, grow: .2, tex: 'star', spin: rnd(-8, 8), cover: 0 }; });
      // 中招以上脚下冒火苗
      if (t >= 1) { const n = QN(kit, 3 + t); for (let i = 0; i < n; i++) { const an = i / n * TAU + rnd(-.3, .3); kit.flame(f.clone().add(V(Math.cos(an) * .5, 0, Math.sin(an) * .5)), { size: rnd(.26, .38), life: rnd(.45, .6), rise: .15, col: FL.col, col2: FL.col2, cover: .6 }); } }
      if (t === 2) ctx._sun = fireSun(kit, side);
    },
    release(kit, ctx) { return [emberBite, flameWave, infernoBlast][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx, { V, rnd } = kit;
      embers(kit, b, 12 + t * 10, { speed: 2 + t * .5 });
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#ff7a2f', col2: '#ffd54f', r1: 1.5, life: .42, thick: .16, cover: .5 });
      // 身上烧着几簇小火苗
      if (t >= 1) { const H = kit.mon(other).height; for (let i = 0; i < QN(kit, 2 + t); i++) kit.flame(b.clone().add(V(rnd(-.3, .3), rnd(-.4, .1) * H, rnd(-.3, .3))), { size: rnd(.22, .32), life: rnd(.35, .5), rise: .2, push: .35, col: FL.col, col2: FL.col2, cover: .62 }); }
    },
    async after(kit, ctx) {
      const t = ctx.tier, F = kit.feet(ctx.other);
      if (t >= 1) kit.decal(F, { kind: 'scorch', r: .55 + t * .3, life: 2.4 + t * .6 });
      await wait(kit, 220);
      if (t >= 1) smoke(kit, F.clone().setY(.2), 4 + t * 5, { r: .3 + t * .15, up: 1 + t * .4, cover: .45 });
      embers(kit, F.clone().setY(.3), 5 + t * 5, { speed: .5, up: 1.2, life: 1.4, spread: .5 });
    },
  };

  // ======================= 水 =======================
  const WATER = ['#1e88e5', '#3fa9f5', '#6cc6ff', '#bdefff'];
  // 水的着色器（浪、水龙卷、水花皇冠共用）：深蓝 → 浅蓝的渐变 + 流动的水纹 + 边上的白沫 + 侧面发亮。不打光、不进发光后期（颜色不会被冲白）
  const WATER_VS = `
varying vec2 vUv; varying float vFres;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vec3 n = normalize(normalMatrix * normal);
  vFres = 1. - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
  // uEdge > 0：浪（uv.x 是左右，两头淡掉）；= 0：一圈的筒子（uv.x 绕一圈，按角度取噪声，没有接缝；uSwirl 螺旋、uSpin 转动）
  const WATER_FS = `
uniform vec3 uDeep; uniform vec3 uLight; uniform float uTime; uniform float uOp; uniform float uSeed; uniform float uSwirl; uniform float uSpin; uniform float uFoam; uniform float uEdge; uniform vec2 uSc; uniform float uBase; uniform float uTop;
varying vec2 vUv; varying float vFres;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
vec2 base(float k) {
  if (uEdge > 0.) return vec2(vUv.x * 7. * k * uSc.x, 0.);
  float a = vUv.x * 6.2831853 + vUv.y * uSwirl - uTime * uSpin;
  return vec2(cos(a), sin(a)) * 1.4 * k;
}
void main() {
  float v = vUv.y;
  float n = vn(base(1.) + vec2(uSeed * 9., v * 3. * uSc.y - uTime * 2.4)) * .6 + vn(base(2.1) + vec2(3.7, v * 6. * uSc.y - uTime * 4.)) * .4;
  float streak = smoothstep(.62, .86, vn(base(3.2) + vec2(1.3 + uSeed, v * 1.6 * uSc.y - uTime * 3.2)));
  vec3 c = mix(uDeep, uLight, clamp(v * .85 + (n - .5) * .6, 0., 1.));
  c = mix(c, vec3(1.), streak * .45 + vFres * .18);
  float foam = smoothstep(uFoam, uFoam + .07, v + (n - .5) * .22);
  c = mix(c, vec3(1.), foam * .92);
  float a = uOp * (uBase + .28 * vFres + .35 * foam + streak * .15);
  if (uEdge > 0.) a *= smoothstep(0., uEdge, vUv.x) * smoothstep(0., uEdge, 1. - vUv.x);
  a *= smoothstep(0., .08, v);
  if (uTop > 0.) a *= 1. - smoothstep(uTop, 1., v + (n - .5) * .15);
  gl_FragColor = vec4(c, clamp(a, 0., 1.));
  #include <colorspace_fragment>
}`;
  // 每场战斗（每个 kit）留几个水材质循环用：userData.pool 设成 kit 不认识的名字，到期 releaseObj 只还不 dispose（着色器不用重新编译）
  const WMAT = new WeakMap();
  function waterMat(kit, o) {
    let L = WMAT.get(kit);
    if (!L) { L = []; WMAT.set(kit, L); }
    let m = L.find(x => !x.userData.busy);
    if (!m) {
      const T3 = kit.T3;
      m = new T3.ShaderMaterial({ uniforms: { uDeep: { value: new T3.Color() }, uLight: { value: new T3.Color() }, uTime: { value: 0 }, uOp: { value: 1 }, uSeed: { value: 0 }, uSwirl: { value: 0 }, uSpin: { value: 0 }, uFoam: { value: .86 }, uEdge: { value: 0 }, uSc: { value: new T3.Vector2(1, 1) }, uBase: { value: .6 }, uTop: { value: 0 } }, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, side: T3.DoubleSide });
      if (L.length < 4) { m.userData.pool = 'el:water'; L.push(m); }   // 多出来的（同时超过 4 个）用完就照常释放
    }
    m.userData.busy = true;
    const u = m.uniforms;
    u.uDeep.value.set(o.deep || '#1565c0'); u.uLight.value.set(o.light || '#6fd0ff'); u.uOp.value = 1; u.uSeed.value = Math.random(); u.uTime.value = 0;
    u.uSwirl.value = o.swirl || 0; u.uSpin.value = o.spin || 0; u.uFoam.value = o.foam == null ? .86 : o.foam; u.uEdge.value = o.edge || 0;
    u.uSc.value.set(o.sx || 1, o.sy || 1); u.uBase.value = o.base == null ? .6 : o.base; u.uTop.value = o.top || 0;
    return m;
  }
  // 一块水（几何体 + 水材质），按特效时间流动；返回 hold 句柄（h.u = uniforms）
  function waterMesh(kit, geo, life, o, upd) {
    const m = new kit.T3.Mesh(geo, waterMat(kit, o)), u = m.material.uniforms;
    m.frustumCulled = false;
    const h = hold(kit, m, life, (q, k, dt) => { u.uTime.value += dt; if (upd) return upd(q, k, dt); }, () => { m.material.userData.busy = false; });
    m.layers.disable(1);   // 不进发光后期
    h.u = u;
    return h;
  }
  // 水龙卷的筒子（底 .55、顶 1，往上越来越宽，开口）；水花皇冠（顶上一圈尖）
  GEO.torus = k => k.geo('el:torus', () => new k.T3.TorusGeometry(1, .06, 6, 40));   // 雪环
  GEO.spout = k => k.geo('el:spout', () => new k.T3.CylinderGeometry(1, .4, 1, 20, 6, true).translate(0, .5, 0));
  GEO.crown = k => k.geo('el:crown', () => {
    const g = new k.T3.CylinderGeometry(1, .45, 1, 24, 3, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > .49) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, .5 + .35 * Math.pow(Math.abs(Math.sin(a * 5)), 3)); }
    g.translate(0, .5, 0); g.computeVertexNormals();
    return g;
  });
  // 水珠：往外溅、往下掉（大多是普通混合的蓝色，亮场地上看得清）
  function droplets(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit;
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(rnd(0, o.spread || .12))), vel: kit.sph(rnd(.5, 1) * (o.speed || 2)).add(V(0, rnd(.5, 1.5) * (o.up || 1.5), 0)), col: pick(WATER), size: rnd(.1, .2) * (o.size || 1), life: rnd(.35, .6) * (o.life || 1), grav: -8, drag: .4, tex: 'glow', grow: .6, cover: .7 }));
  }
  // 泡泡（图集里的泡泡环）往上冒
  function bubbles(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, r = o.r || .4;
    kit.emit(n, () => ({ pos: at.clone().add(V(rnd(-r, r), rnd(0, .3), rnd(-r, r))), vel: V(rnd(-.2, .2), rnd(.5, 1.2) * (o.up || 1), rnd(-.2, .2)), col: '#8fd8ff', size: rnd(.14, .28) * (o.size || 1), life: rnd(.5, .9), grow: 1.2, drag: .5, tex: 'ring', cover: .45 }));
  }
  // 白沫（普通混合的白烟，亮背景上也看得见）
  function foam(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, r = o.r || .3;
    kit.emit(n, () => { const an = rnd(0, TAU), s = rnd(.4, 1) * (o.speed || 1.4); return { pos: at.clone().add(V(Math.cos(an) * rnd(0, r), rnd(0, .2), Math.sin(an) * rnd(0, r))), vel: V(Math.cos(an) * s, rnd(.3, 1.2) * (o.up || 1), Math.sin(an) * s), col: pick(['#ffffff', '#e8f9ff', '#cdeeff']), size: rnd(.35, .6) * (o.size || 1), life: rnd(.35, .6) * (o.life || 1), grow: 2, drag: 1.8, tex: 'smoke', spin: rnd(-2, 2), cover: .6, alpha: .7 }; });
  }
  // 一个泡泡：每帧在位置上盖一个泡泡环 + 一团淡蓝（晃着飞），到了就啪地破掉
  function bubbleShot1(kit, from, to, ms, size, lat) {
    const { V, rnd } = kit, p = V(0, 0, 0), wob = rnd(0, TAU), arc = from.distanceTo(to) * rnd(.06, .16);
    return kit.tween(ms, k => {
      p.lerpVectors(from, to, k); p.y += Math.sin(k * PI) * arc; p.addScaledVector(lat, Math.sin(k * 9 + wob) * .07);
      const s = size * (.45 + .55 * Math.min(1, k * 5)) * (1 + .1 * Math.sin(k * 40 + wob));
      kit.emit(1, () => ({ pos: p.clone(), vel: V(0, 0, 0), col: '#9be0ff', size: s, life: .06, grow: 1, tex: 'ring', cover: .55 }));
      kit.emit(1, () => ({ pos: p.clone(), vel: V(0, 0, 0), col: '#3fa9f5', size: s * .8, life: .06, grow: 1, tex: 'glow', cover: .6, alpha: .35 }));
    }).then(() => {
      kit.emit(1, () => ({ pos: to.clone(), vel: V(0, 0, 0), col: '#bdefff', size: size * 1.2, life: .16, grow: 2.4, tex: 'ring', cover: .5 }));
      droplets(kit, to, 8, { speed: 1.8, up: 1, size: 1 });
    });
  }
  async function bubbleShot(kit, ctx) {
    const { a, b, dir } = ctx, { V, rnd } = kit, lat = flat(kit, dir), n = Math.max(3, QN(kit, 5)), hits = [];
    for (let i = 0; i < n; i++) {
      const from = a.clone().add(kit.sph(.1)), to = toCam(kit, b, .2).addScaledVector(lat, rnd(-.3, .3)).add(V(0, rnd(-.22, .28), 0));
      hits.push(wait(kit, i * 34).then(() => bubbleShot1(kit, from, to, rnd(220, 250), rnd(.4, .58), lat)));
    }
    await hits[1];
  }
  async function tidalWave(kit, ctx) {
    const { dir, side, other, b } = ctx, { V, rnd, EZ } = kit, lat = flat(kit, dir);
    const f0 = kit.feet(side).addScaledVector(dir, .3).setY(.03), f1 = kit.feet(other).addScaledVector(dir, -.8).setY(.03);
    const H = Math.max(1.1, kit.mon(other).height * 1.2) * 1.25, W = 1.75, D = .95;
    const st = { fade: 1 };
    const h = waterMesh(kit, GEO.wave(kit), 1.6, { deep: '#1259b8', light: '#5ccfff', foam: .84, edge: .14, sx: .3, sy: 3, base: .78 }, () => { h.u.uOp.value = st.fade; });
    const m = h.obj;
    // 浪斜过来一点（往镜头那一侧转 .5 弧度）：从过肩机位正对着浪背看只是一块平平的蓝板，斜着才看得出往前卷的浪头
    const yaw = Math.atan2(dir.x, dir.z) + (side === 'me' ? -.5 : .5), wf = V(Math.sin(yaw), 0, Math.cos(yaw)), wl = flat(kit, wf);   // wf 浪头朝向、wl 浪的左右
    m.rotation.y = yaw; m.position.copy(f0); m.scale.set(W * .4, .01, D * .6);
    // 浪尖上的点（u = -1..1 左右）
    const lip = u => m.position.clone().addScaledVector(wl, u * m.scale.x).add(V(0, .9 * m.scale.y, 0)).addScaledVector(wf, .32 * m.scale.z);
    const fr = rate(kit, 260), sr = rate(kit, 90);
    let lk = 0;
    await kit.tween(440, k => {
      const dt = (k - lk) * .44, e = EZ.sine(k) * .8 + k * .2, g = EZ.out(Math.min(1, k / .4)); lk = k;
      m.position.lerpVectors(f0, f1, e);
      m.scale.set(W * (.4 + .6 * g), H * g, D * (.6 + .4 * g));
      let n = fr(dt);   // 浪尖的白沫
      if (n) kit.emit(n, () => ({ pos: lip(rnd(-.8, .8)), vel: wf.clone().multiplyScalar(rnd(.8, 1.6)).add(V(0, rnd(.2, .8), 0)), col: '#ffffff', size: rnd(.3, .5), life: rnd(.25, .4), grow: 1.6, drag: 1, tex: 'smoke', spin: rnd(-2, 2), cover: .6, alpha: .8 }));
      n = sr(dt);       // 浪脚溅起的水花
      if (n) kit.emit(n, () => ({ pos: m.position.clone().addScaledVector(lat, rnd(-.9, .9) * m.scale.x).addScaledVector(dir, rnd(.1, .4) * m.scale.z).setY(.12), vel: dir.clone().multiplyScalar(rnd(1, 2.5)).add(V(rnd(-.5, .5), rnd(1, 2.5), 0)), col: pick(WATER), size: rnd(.12, .2), life: rnd(.3, .5), grav: -7, tex: 'glow', cover: .7 }));
    });
    // 拍下来：浪往前倒、变扁、淡掉
    const p0 = m.position.clone();
    kit.tween(300, k => { const e = EZ.out(k); m.position.copy(p0).addScaledVector(dir, .6 * e); m.scale.y = H * (1 - .72 * e); m.scale.z = D * (1 + .5 * e); st.fade = 1 - k; }).then(() => h.end());
    await wait(kit, 70);
    const F = kit.feet(other);
    droplets(kit, b, 30, { speed: 3, up: 2.2, size: 1.2, spread: .3 });
    foam(kit, F.clone().setY(.2), 12, { r: .5, speed: 1.8, size: 1.2 });
    kit.shockwave(F.clone().setY(.12), { col: '#3fa9f5', col2: '#bdefff', r0: .3, r1: 1.9, life: .5, thick: .16, cover: .6 });
  }
  async function hydroStorm(kit, ctx) {
    const { a, b, dir, other } = ctx, { V, rnd, EZ } = kit, lat = flat(kit, dir), up = V(0, 1, 0);
    const p1 = b.clone().addScaledVector(dir, -.25);
    // 1. 双股螺旋水流
    const tips = [a.clone(), a.clone()], st = { jet: true, spout: true };
    tips.forEach(tp => kit.trail(() => st.jet ? tp : null, { col: '#1e88e5', col2: '#8fd8ff', width: .3, life: .2, cover: .75 }));
    kit.energyBeam(a, p1, { col: '#1e88e5', col2: '#8fd8ff', width: .16, life: .45, grow: .6, noise: 1.4, cover: .7 });
    const sp = rate(kit, 120);
    let lk = 0;
    await kit.tween(300, k => {
      const dt = (k - lk) * .3; lk = k;
      tips.forEach((tp, i) => { const th = k * 3.2 * TAU + i * PI, r = .27 * Math.sin(Math.min(1, k * 1.6) * PI / 2 + .25); tp.lerpVectors(a, p1, k).addScaledVector(lat, Math.cos(th) * r).addScaledVector(up, Math.sin(th) * r); });
      const n = sp(dt);
      if (n) kit.emit(n, () => ({ pos: tips[Math.random() < .5 ? 0 : 1].clone(), vel: kit.sph(rnd(.3, .9)).add(V(0, .4, 0)), col: pick(WATER), size: rnd(.1, .18), life: rnd(.25, .4), grav: -6, tex: 'glow', cover: .7 }));
    });
    st.jet = false;
    // 2. 对手脚下卷起水龙卷，把它托起来
    const F = kit.feet(other), mon = kit.mon(other), H = mon.height, lift = kit.RM ? 0 : .42;
    kit.sfx('water', 'impact', 0);
    droplets(kit, p1, 14, { speed: 2.4 });
    kit.groundCircle(other, { col: '#1e88e5', col2: '#8fd8ff', r: 1.25, life: 1.3, spin: 3.5, cover: .55 });
    kit.decal(F, { kind: 'splash', r: 1.15, life: 2.4 });
    camUp(kit, ctx, .7, 420);
    const sv = { h: 0, r: .5, op: 1 };
    const spout = waterMesh(kit, GEO.spout(kit), 1.4, { deep: '#1259b8', light: '#7fd8ff', swirl: 7, spin: 8, foam: .66, top: .8, base: .66 }, q => { q.scale.set(sv.r, Math.max(.001, sv.h), sv.r); spout.u.uOp.value = sv.op; });
    spout.obj.position.copy(F).setY(.03);
    const N = Math.max(2, QN(kit, 2)), ts = [];
    for (let j = 0; j < N; j++) { const tp = F.clone(); ts.push(tp); kit.trail(() => st.spout ? tp : null, { col: '#8fd8ff', col2: '#ffffff', width: .14, life: .25, cover: .5 }); }
    const br = rate(kit, 100);
    lk = 0;
    await kit.tween(420, k => {
      const dt = (k - lk) * .42, e = EZ.out(k); lk = k;
      sv.h = H * 2.7 * e; sv.r = .55 + .3 * e;
      ts.forEach((tp, j) => { const th = k * 2.6 * TAU + j / N * TAU, R = (.55 + .3 * k) * 1.05; tp.set(F.x + Math.cos(th) * R, .1 + H * 1.9 * e, F.z + Math.sin(th) * R); });
      mon.off.y = lift * e;
      const n = br(dt);
      if (n) kit.emit(n, () => { const an = rnd(0, TAU), R = rnd(.5, .85), y = rnd(0, H * 1.6); return Math.random() < .4
        ? { pos: V(F.x + Math.cos(an) * R * .7, y, F.z + Math.sin(an) * R * .7), vel: V(0, rnd(1, 2), 0), col: '#9be0ff', size: rnd(.14, .26), life: rnd(.35, .55), grow: 1.2, tex: 'ring', cover: .45 }
        : { pos: V(F.x + Math.cos(an) * R, y, F.z + Math.sin(an) * R), vel: V(-Math.sin(an) * 3 + Math.cos(an), rnd(.5, 1.5), Math.cos(an) * 3 + Math.sin(an)), col: pick(WATER), size: rnd(.12, .2), life: rnd(.3, .45), grav: -5, tex: 'glow', cover: .7 }; });
    });
    st.spout = false;
    // 3. 砸下去：水柱塌下来，溅起一圈水花皇冠
    await kit.tween(110, k => { mon.off.y = lift * (1 - k * k); sv.h = H * 2.7 * (1 - .75 * k); sv.r = .85 + .3 * k; });
    mon.off.y = 0;
    kit.tween(200, k => { sv.h = H * .55 * (1 - k); sv.op = 1 - k; }).then(() => spout.end());
    const cr = { r: .55, h: .2, op: 1 };
    const crown = waterMesh(kit, GEO.crown(kit), .6, { deep: '#1e88e5', light: '#8fd8ff', foam: .8, base: .7 }, (q, k) => {
      const e = EZ.out(k); cr.r = .55 + 1.15 * e; cr.h = (.35 + 1.1 * Math.sin(Math.min(1, k * 1.6) * PI * .5)) * (1 - .6 * k); cr.op = k < .45 ? 1 : 1 - (k - .45) / .55;
      q.scale.set(cr.r, cr.h, cr.r); crown.u.uOp.value = cr.op;
    });
    crown.obj.position.copy(F).setY(.03); crown.obj.scale.set(.55, .2, .55);
    kit.emit(30, () => { const an = rnd(0, TAU), r = rnd(.4, .7); return { pos: F.clone().add(V(Math.cos(an) * r, .2, Math.sin(an) * r)), vel: V(Math.cos(an) * rnd(1.2, 2.6), rnd(3, 5.5), Math.sin(an) * rnd(1.2, 2.6)), col: pick(WATER), size: rnd(.15, .26), life: rnd(.55, .8), grav: -10, drag: .2, tex: 'glow', cover: .7 }; });
    foam(kit, F.clone().setY(.15), 6, { r: .6, speed: 2.2, size: 1 });
    kit.shockwave(F.clone().setY(.13), { col: '#3fa9f5', col2: '#bdefff', r0: .4, r1: 2.6, life: .55, thick: .18, cover: .6 });
    kit.shake(.3);
  }
  // 大招蓄力：两股水绕着身子往上转
  function waterSwirl(kit, side) {
    const mm = kit.mon(side), base = mm.root.position.clone(), H = mm.height, tips = [base.clone(), base.clone()], st = { on: true };
    tips.forEach(tp => kit.trail(() => st.on ? tp : null, { col: '#1e88e5', col2: '#8fd8ff', width: .18, life: .25, cover: .7 }));
    kit.tween(700, k => { tips.forEach((tp, i) => { const th = k * 2.2 * TAU + i * PI, R = .7 - .2 * k; tp.set(base.x + Math.cos(th) * R, .12 + H * 1.05 * k, base.z + Math.sin(th) * R); }); }).then(() => { st.on = false; });
  }
  T.water = {
    generic: { wave: false },   // 冲击波自己放蓝色的（通用的白色冲击波叠在水花上一片白）
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { rnd } = kit, c = kit.center(side);
      // 水珠从四周聚过来，脚下冒泡泡
      kit.emit(12 + t * 10, () => { const p = c.clone().add(kit.sph(rnd(.8, 1.3))), life = rnd(.3, .45); return { pos: p, vel: c.clone().sub(p).multiplyScalar(.9 / life), col: pick(WATER), size: rnd(.12, .2), life, grow: .5, tex: 'glow', cover: .6 }; });
      bubbles(kit, kit.feet(side), 6 + t * 6, { r: .5 });
      if (t === 2) waterSwirl(kit, side);
      // 中招、大招要用水的着色器：蓄力时先画一下（看不见），第一次出招不会卡一下编译
      if (t >= 1) { const w = waterMesh(kit, GEO.ball(kit), .05, {}); w.u.uOp.value = 0; w.obj.position.copy(c); w.obj.scale.setScalar(.01); }
    },
    release(kit, ctx) { return [bubbleShot, tidalWave, hydroStorm][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      droplets(kit, b, 12 + t * 8, { speed: 2.2 + t * .4 });
      bubbles(kit, b.clone().setY(b.y * .5), 4 + t * 4, { r: .3, up: 1.2 });
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#3fa9f5', col2: '#bdefff', r1: 1.5, life: .42, thick: .16, cover: .6 });
    },
    async after(kit, ctx) {
      const t = ctx.tier, F = kit.feet(ctx.other);
      if (t === 1) kit.decal(F, { kind: 'splash', r: .8, life: 2 });
      // 身上往下滴水
      if (t >= 1) for (let i = 0; i < 5; i++) { await wait(kit, 110); droplets(kit, ctx.b.clone().add(kit.sph(.25)), 2, { speed: .3, up: .1, size: .9 }); }
    },
  };

  // ======================= 草 =======================
  const LEAF = ['#7ddc5a', '#a5e65a', '#5fd35f', '#b8f070'];
  // 绿色的光点 / 黄色的花粉（四角星）
  function motes(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit;
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(rnd(0, o.spread || .2))), vel: kit.sph(rnd(.3, 1) * (o.speed || 1.6)).add(V(0, rnd(0, 1) * (o.up || .8), 0)), col: pick(o.cols || ['#9be86b', '#d4ff8a', '#eaffc8']), size: rnd(.12, .22) * (o.size || 1), life: rnd(.4, .75) * (o.life || 1), grav: o.grav == null ? .5 : o.grav, drag: 1.5, tex: o.tex || 'star', spin: rnd(-5, 5), grow: .4, cover: 0 }));
  }
  // 冒出来的一片小叶子（长在藤蔓上，一会儿就淡掉）
  function sproutLeaf(kit, at, s) {
    const { T3, rnd } = kit, m = new T3.Mesh(GEO.blade(kit), kit.toonMat(pick(LEAF), { transparent: true, side: T3.DoubleSide, emissive: '#2a6b1f' }));
    const sz = (s || .15) * rnd(.8, 1.2);
    m.position.copy(at); m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    solid(kit.addFx(m, rnd(.45, .6), (o, k) => { o.scale.setScalar(sz * Math.min(1, k * 6)); o.material.opacity = k > .6 ? (1 - k) / .4 : 1; }));
  }
  // 藤蔓：实心的绿管子（根粗梢细、打光），每帧按脊线 spine(s, out)（s 0–1）重新摆顶点。st.len 0–1 长出来多少、st.fade 淡出、st.h.end() 拿掉
  // （几何体每根新建一个，到期释放）
  function vineTube(kit, spine, o) {
    o = o || {};
    const { T3, V } = kit, N = kit.q === 'low' ? 14 : 22, M = 6, r0 = o.r0 || .07, r1 = o.r1 || .025;
    const g = new T3.BufferGeometry(), pos = new Float32Array((N + 1) * M * 3), idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M; idx.push(a, a + M, b, b, a + M, b + M); }
    g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T3.Mesh(g, kit.toonMat(o.col || '#3f9b3a', { transparent: true, emissive: o.em || '#16420f' }));
    m.frustumCulled = false;
    const st = { len: 0, fade: 1 }, P = [], t = V(0, 0, 0), n = V(0, 0, 0), bn = V(0, 0, 0), q = V(0, 0, 0), UP = V(0, 1, 0), X = V(1, 0, 0);
    for (let i = 0; i <= N; i++) P.push(V(0, 0, 0));
    st.h = hold(kit, m, o.life || 2, () => {
      const L = Math.max(.001, st.len);
      for (let i = 0; i <= N; i++) spine(i / N * L, P[i]);
      for (let i = 0; i <= N; i++) {
        t.subVectors(P[Math.min(N, i + 1)], P[Math.max(0, i - 1)]).normalize();
        n.crossVectors(t, Math.abs(t.y) > .95 ? X : UP).normalize(); bn.crossVectors(t, n);
        const r = r0 + (r1 - r0) * i / N;
        for (let j = 0; j < M; j++) { const a = j / M * TAU, k = (i * M + j) * 3; q.copy(P[i]).addScaledVector(n, Math.cos(a) * r).addScaledVector(bn, Math.sin(a) * r); pos[k] = q.x; pos[k + 1] = q.y; pos[k + 2] = q.z; }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals();
      m.material.opacity = st.fade;
    });
    solid(m);
    return st;
  }
  // 一片飞叶镖：转着、拐个弯飞过去，拖一道黄绿色的光
  function razorLeaf(kit, from, to, ms, curve, lat, col) {
    const { V, T3, rnd } = kit, m = new T3.Mesh(GEO.blade(kit), kit.toonMat(col, { side: T3.DoubleSide, emissive: '#3d7a1a' }));
    m.scale.setScalar(.6); m.position.copy(from);
    const h = hold(kit, m, ms / 1000 + .5);
    solid(m);
    kit.trail(() => h.dead ? null : m.position, { col: '#9be86b', col2: '#f4ffd0', width: .2, life: .14, cover: .35 });
    const p = V(0, 0, 0), spin = rnd(26, 34) * (Math.random() < .5 ? 1 : -1);
    let lk = 0;
    return kit.tween(ms, k => {
      p.lerpVectors(from, to, k).addScaledVector(lat, Math.sin(k * PI) * curve); p.y += Math.sin(k * PI) * .12;
      m.position.copy(p); m.rotation.z += spin * (k - lk) * ms / 1000; m.rotation.x = .5 + .3 * Math.sin(k * 12); lk = k;
    }).then(() => { h.end(); return p.clone(); });
  }
  async function leafCut(kit, ctx) {
    const { a, b, dir } = ctx, { V, rnd } = kit, lat = flat(kit, dir), n = Math.max(2, QN(kit, 4)), hits = [];
    for (let i = 0; i < n; i++) {
      const from = a.clone().add(kit.sph(.08)), to = b.clone().addScaledVector(lat, rnd(-.18, .18)).add(V(0, rnd(-.12, .2), 0)), curve = (i % 2 ? 1 : -1) * rnd(.4, .6);
      hits.push(wait(kit, i * 35).then(() => razorLeaf(kit, from, to, 250, curve, lat, LEAF[i % 4])).then(p => {
        const an = (i % 2 ? -.7 : .7) + rnd(-.2, .2);
        slash(kit, p, { col: '#8ee05a', col2: '#ffffff', len: .62, width: .15, ang: an, cover: .5 });
        if (!i) slash(kit, p, { col: '#8ee05a', col2: '#ffffff', len: .55, width: .13, ang: -an, cover: .5, life: .24 });   // 第一片：交叉的两道
        motes(kit, p, 6, { speed: 2 });
      }));
    }
    await hits[0];
  }
  // 一根藤蔓：从地里钻出来甩过头顶，落到对手身上横着一抽（onHit 在抽中的那一下调），再缩回地里
  async function vine(kit, ctx, s, onHit) {
    const { b, dir, side } = ctx, { V } = kit, lat = flat(kit, dir);
    const F = kit.feet(side).addScaledVector(dir, .5).addScaledVector(lat, s * .28).setY(.02);
    const top = b.clone().addScaledVector(lat, s * .55).add(V(0, .5, 0)).addScaledVector(dir, -.15);
    const apex = F.clone().lerp(top, .45).add(V(0, 1.5, 0)).addScaledVector(lat, s * .6);
    const cur = { c: apex.clone(), p1: top.clone() }, tip = V(0, 0, 0), lr = rate(kit, 32);
    const v = vineTube(kit, (u, out) => bez(out, F, cur.c, cur.p1, u), { r0: .1, r1: .035, life: 1.4 });
    dust(kit, F, 6, { r: .1, speed: .8, up: 1, size: .6, life: .6 });
    let lk = 0;
    await kit.tween(330, k => { const dt = (k - lk) * .33; lk = k; v.len = kit.EZ.out(k); if (lr(dt)) sproutLeaf(kit, bez(tip, F, cur.c, cur.p1, v.len)); });
    // 横着抽过对手
    const c0 = cur.c.clone(), c1 = apex.clone().addScaledVector(lat, -s * 1.1).add(V(0, -.5, 0));
    const w0 = top.clone(), w1 = b.clone().addScaledVector(lat, -s * .7).add(V(0, -.25, 0)).addScaledVector(dir, -.2);
    const whip = k => { cur.p1.lerpVectors(w0, w1, k); cur.c.lerpVectors(c0, c1, k); };
    await kit.tween(45, k => whip(k * .5));
    onHit(bez(tip, F, cur.c, cur.p1, 1).clone());
    await kit.tween(45, k => whip(.5 + k * .5));
    kit.tween(260, k => { v.len = 1 - kit.EZ.io(k); v.fade = 1 - k * k; }).then(() => v.h.end());
  }
  async function vineLash(kit, ctx) {
    const { b } = ctx;
    const hit = s => p => {
      slash(kit, b, { col: '#8ee05a', col2: '#ffffff', len: .7, width: .15, ang: s > 0 ? -.35 : .35, life: .22, cover: .5 });
      motes(kit, p, 10, { speed: 2.4 });
      for (let i = 0; i < QN(kit, 3); i++) sproutLeaf(kit, p.clone().add(kit.sph(.25)), .18);
    };
    let first = null;
    const p1 = new Promise(res => { first = res; });
    vine(kit, ctx, 1, p => { hit(1)(p); first(); }).catch(e => { first(); throw e; });
    wait(kit, 90).then(() => vine(kit, ctx, -1, hit(-1)));
    await p1;
  }
  // 大招的花：外圈 8 片、里圈 5 片花瓣，先合成花苞围住对手，再一下子开成碗形；st.bud / st.open 0–1，st.scatter = true 花瓣飞散
  function bloomFlower(kit, F) {
    const { T3, rnd } = kit, n = kit.q === 'low' ? 6 : 8, g = new T3.Group(), st = { bud: 0, open: 0, scatter: false }, pets = [];
    g.position.copy(F).setY(.1);
    [[n, .44, 1, '#ff8fcf', 1.2], [5, .3, .68, '#ffd1ea', .75]].forEach(([cnt, rad, sz, col, open], ring) => {
      for (let i = 0; i < cnt; i++) {
        const pv = new T3.Group(); pv.rotation.y = (i + ring * .5) / cnt * TAU;
        const m = new T3.Mesh(GEO.petal(kit), kit.toonMat(i % 2 && !ring ? '#ffa8d8' : col, { transparent: true, side: T3.DoubleSide, emissive: '#7a2a5a' }));
        m.position.z = rad; pv.add(m); g.add(pv);
        pets.push({ m, sz: sz * rnd(.92, 1.05), open, vy: rnd(1.5, 3), vz: rnd(1.5, 3), w: rnd(-8, 8) });
      }
    });
    const heart = new T3.Mesh(GEO.ball(kit), kit.glowMat('#fff176', .95, true)); g.add(heart);
    let ts = 0;
    hold(kit, g, 2.4, (o, k, dt) => {
      heart.scale.setScalar(Math.max(.001, .26 * st.open));
      pets.forEach(p => {
        if (!st.scatter) { p.m.rotation.x = .08 + p.open * st.open; p.m.scale.set(.85, 1.25, 1).multiplyScalar(Math.max(.001, st.bud * p.sz)); return; }
        p.vy -= 5 * dt; p.m.position.z += p.vz * dt; p.m.position.y += p.vy * dt; p.m.rotation.x += p.w * dt; p.m.rotation.z += p.w * .5 * dt;
        p.m.material.opacity = Math.max(0, 1 - ts / .7);
      });
      if (st.scatter) { ts += dt; heart.visible = false; if (ts > .75) return true; }
    });
    pets.forEach(p => solid(p.m));
    return st;
  }
  async function solarBloom(kit, ctx) {
    const { other } = ctx, { V, rnd, EZ } = kit, F = kit.feet(other), H = kit.mon(other).height;
    camUp(kit, ctx, 1.1, 600);
    kit.groundCircle(other, { col: '#5fd35f', col2: '#d4ff8a', r: 1.25, runes: true, life: 1.5, spin: .9, cover: .5 });
    kit.decal(F, { kind: 'glow', col: '#9be86b', r: 1.1, life: 1.8 });
    // 1. 藤蔓从地里钻出来，一圈圈缠上去；花苞跟着长出来
    const N = Math.max(3, QN(kit, 4)), vines = [], lr = rate(kit, 45), tmp = V(0, 0, 0);
    for (let j = 0; j < N; j++) {
      const th0 = j / N * TAU;
      vines.push(vineTube(kit, (u, out) => { const th = th0 + u * 1.5 * TAU, R = .8 - .36 * u; return out.set(F.x + Math.cos(th) * R, .03 + H * 1.1 * u, F.z + Math.sin(th) * R); }, { r0: .07, r1: .028, life: 2 }));
    }
    dust(kit, F, 10, { r: .6, speed: 1, up: 1, size: .8 });
    const flower = bloomFlower(kit, F);
    let lk = 0;
    await kit.tween(360, k => {
      const dt = (k - lk) * .36, e = EZ.out(k); lk = k;
      vines.forEach(v => { v.len = e; });
      if (lr(dt)) { const j = Math.floor(rnd(0, N)), th = j / N * TAU + e * 1.5 * TAU, R = .8 - .36 * e; sproutLeaf(kit, tmp.set(F.x + Math.cos(th) * R, .03 + H * 1.1 * e, F.z + Math.sin(th) * R), .17); }
      flower.bud = e;
    });
    // 2. 花开，对手头顶聚起一团阳光
    const S = F.clone().add(V(0, 3.3, 0));
    kit.glow(S, { col: '#fff176', size: 1.9, life: .8, cover: .12 });
    kit.emit(24, () => { const p = S.clone().add(kit.sph(rnd(1.1, 1.6))), life = rnd(.25, .32); return { pos: p, vel: S.clone().sub(p).multiplyScalar(1 / life), col: pick(['#fff176', '#ffffff', '#d4ff8a']), size: rnd(.2, .34), life, grow: .3, tex: 'star', spin: 4, cover: 0 }; });
    await kit.tween(300, k => { flower.open = EZ.out(k); });
    // 3. 阳光柱砸下来（金黄色，0.4 秒就收）
    const bot = F.clone().setY(.02), top = F.clone().add(V(0, 7, 0));
    kit.energyBeam(top, bot, { col: '#ffd84a', col2: '#fff6b0', width: .9, life: .42, grow: .16, taper: .05, noise: .8, cover: .65, opacity: .9 });
    await wait(kit, 65);
    kit.shockwave(F.clone().setY(.14), { col: '#d4ff8a', col2: '#fff59d', r0: .4, r1: 2.6, life: .55, thick: .18, cover: .55 });
    motes(kit, F.clone().setY(.4), 26, { spread: .5, speed: 3, up: 2.5, cols: ['#fff176', '#d4ff8a', '#ffffff'] });
    kit.shake(.22);
    flower.scatter = true;
    kit.tween(300, k => { vines.forEach(v => { v.fade = 1 - k; }); }).then(() => vines.forEach(v => v.h.end()));
  }
  T.grass = {
    generic: { wave: false },   // 冲击波自己放黄绿色的
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { T3, rnd } = kit, mm = kit.mon(side), base = mm.root.position.clone(), H = mm.height, n = QN(kit, 3 + t * 2), life = .55 + t * .2;
      // 叶子绕着身子往上转
      for (let i = 0; i < n; i++) {
        const an0 = i / n * TAU, R = rnd(.5, .7), m = new T3.Mesh(GEO.blade(kit), kit.toonMat(pick(LEAF), { transparent: true, side: T3.DoubleSide, emissive: '#2a6b1f' }));
        m.scale.setScalar(rnd(.2, .28));
        kit.addFx(m, life, (q, k) => { const an = an0 + k * life * 5, r = R * (1 - .3 * k); q.position.set(base.x + Math.cos(an) * r, .15 + H * .9 * k, base.z + Math.sin(an) * r); q.rotation.set(an, an * 2, k * 6); q.material.opacity = k > .75 ? (1 - k) / .25 : 1; });
        solid(m);
      }
      motes(kit, kit.feet(side).setY(.2), 8 + t * 8, { spread: .5, speed: .4, up: 1.6, tex: 'glow' });
      if (t === 2) { const c = kit.center(side); kit.emit(16, () => { const p = c.clone().add(kit.sph(rnd(.9, 1.3))), lf = rnd(.35, .5); return { pos: p, vel: c.clone().sub(p).multiplyScalar(.9 / lf), col: '#fff59d', size: rnd(.14, .24), life: lf, tex: 'star', spin: 5, grow: .3, cover: 0 }; }); }
    },
    release(kit, ctx) { return [leafCut, vineLash, solarBloom][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx, { V, rnd, T3 } = kit;
      motes(kit, b, 8 + t * 8, { speed: 2 });
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#7ddc5a', col2: '#d4ff8a', r1: 1.5, life: .42, thick: .16, cover: .55 });
      // 碎叶子打着转飘下来
      debris(kit, () => GEO.blade(kit), LEAF, 3 + t * 2, b, { s0: .14, s1: .2, side: T3.DoubleSide, emissive: '#2a6b1f', grav: 3, vel: () => kit.sph(rnd(.8, 1.8)).add(V(0, rnd(.5, 1.5), 0)), life: .9 });
    },
    async after(kit, ctx) {
      if (ctx.tier === 2) kit.decal(kit.feet(ctx.other), { kind: 'glow', col: '#d4ff8a', r: 1, life: 2 });
      await wait(kit, 200);
      motes(kit, kit.feet(ctx.other).setY(.3), 4 + ctx.tier * 6, { spread: .6, speed: .3, up: 1, life: 1.6, grav: .3, tex: 'glow' });
    },
  };

  // ======================= 冰 =======================
  const ICE = ['#9be7ff', '#bff3ff', '#e6fbff', '#ffffff'];
  const iceMat = (kit, o) => { o = o || {}; return kit.toonMat(o.col || '#a8ecff', { transparent: !!o.tr, opacity: o.op, emissive: o.em || '#2a7fb0' }); };
  // 雪花（四角星）
  function snow(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit;
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(rnd(0, o.spread || .15))), vel: kit.sph(rnd(.4, 1) * (o.speed || 1.8)).add(V(0, rnd(0, 1) * (o.up || .6), 0)), col: pick(ICE), size: rnd(.12, .24) * (o.size || 1), life: rnd(.45, .8) * (o.life || 1), grav: o.grav == null ? -1 : o.grav, drag: 1.6, tex: 'star', spin: rnd(-5, 5), grow: .4, cover: .2 }));
  }
  // 寒气（贴地的白雾）
  function mist(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, r = o.r || .4;
    kit.emit(n, () => { const an = rnd(0, TAU), s = rnd(.2, .7) * (o.speed || 1); return { pos: at.clone().add(V(Math.cos(an) * rnd(0, r), rnd(0, .15), Math.sin(an) * rnd(0, r))), vel: V(Math.cos(an) * s, rnd(.05, .3) * (o.up || 1), Math.sin(an) * s), col: pick(['#ffffff', '#e6fbff', '#cdf3ff']), size: rnd(.45, .8) * (o.size || 1), life: rnd(.6, 1) * (o.life || 1), grow: 2, drag: 1.2, tex: 'smoke', spin: rnd(-1, 1), cover: .35, alpha: .7 }; });
  }
  // 地上冒出来一根冰晶（长出来、停一会、缩回去）；返回 { end() } 可以提前拿掉
  function crystal(kit, at, hh, o) {
    o = o || {};
    const { V, rnd } = kit, m = new kit.T3.Mesh(GEO.crystal(kit), iceMat(kit, { tr: true, op: .92, col: o.col }));
    const tilt = o.tilt || V(rnd(-.3, .3), 1, rnd(-.3, .3)).normalize(), w = (o.w || 1.1) * rnd(.85, 1.15), grow = o.grow || .14, life = o.life || .9, d = (o.delay || 0) / 1000;
    m.quaternion.setFromUnitVectors(V(0, 1, 0), tilt); m.rotateY(rnd(0, TAU));
    m.position.copy(at).setY(.04); m.scale.set(.001, .001, .001);
    const h = hold(kit, m, life + d, (q, k) => {
      const t = k * (life + d) - d;
      if (t < 0) return;
      const g = t < grow ? backOut(t / grow) : t > life - .2 ? Math.max(0, (life - t) / .2) : 1;
      q.scale.set(w * Math.max(.001, Math.min(1, g * 1.4)), hh * Math.max(.001, g), w * Math.max(.001, Math.min(1, g * 1.4)));
    });
    solid(m);
    return h;
  }
  // 一根冰锥飞过去（尖朝前），拖一道白光
  function iceShard(kit, from, to, ms, o) {
    o = o || {};
    const { V, T3 } = kit, m = new T3.Mesh(GEO.shard(kit), iceMat(kit)), Y = V(0, 1, 0), d = to.clone().sub(from).normalize(), p = V(0, 0, 0), prev = from.clone();
    m.scale.set((o.size || .2) * .9, o.size || .2, (o.size || .2) * .9); m.position.copy(from); m.quaternion.setFromUnitVectors(Y, d);
    const h = hold(kit, m, ms / 1000 + .5);
    solid(m);
    kit.trail(() => h.dead ? null : m.position, { col: '#6fd8ff', col2: '#ffffff', width: o.tw || .13, life: .13, cover: .45 });
    const arc = from.distanceTo(to) * (o.arc || .05);
    return kit.tween(ms, k => {
      p.lerpVectors(from, to, k); p.y += Math.sin(k * PI) * arc;
      d.subVectors(p, prev); if (d.lengthSq() > 1e-9) m.quaternion.setFromUnitVectors(Y, d.normalize());
      prev.copy(p); m.position.copy(p);
    }).then(() => { h.end(); return p.clone(); });
  }
  // 冰花：命中点往外（贴着屏幕）长出一圈小冰刺，马上碎掉
  function iceBloom(kit, at, big) {
    const { V, T3, rnd } = kit, c = toCam(kit, at, .35), n = QN(kit, big ? 8 : 4), Y = V(0, 1, 0), { r, u } = camAxes(kit);
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU + rnd(-.2, .2), d = r.clone().multiplyScalar(Math.cos(an)).addScaledVector(u, Math.sin(an)).normalize();
      const m = new T3.Mesh(GEO.shard(kit), iceMat(kit, { tr: true })), L = rnd(.18, .28) * (big ? 1 : .65);
      m.quaternion.setFromUnitVectors(Y, d); m.position.copy(c);
      kit.addFx(m, .34, (o, k) => { const g = kit.EZ.out(Math.min(1, k / .3)); o.scale.set(L * .7, Math.max(.001, L * g), L * .7); o.position.copy(c).addScaledVector(d, L * g); o.material.opacity = k < .6 ? 1 : (1 - k) / .4; });
      solid(m);
    }
    snow(kit, c, big ? 10 : 5, { speed: 2 });
    if (big) kit.shockwave(c, { col: '#9be7ff', col2: '#ffffff', flat: false, r0: .15, r1: .75, life: .25, thick: .1, cover: .5, push: .1 });
  }
  async function frostNip(kit, ctx) {
    const { a, b, dir } = ctx, { V, rnd } = kit, lat = flat(kit, dir), n = Math.max(2, QN(kit, 3)), hits = [];
    for (let i = 0; i < n; i++) {
      const o = i - (n - 1) / 2, from = a.clone().addScaledVector(lat, o * .12).add(V(0, rnd(-.05, .05), 0)), to = b.clone().addScaledVector(lat, o * .16).add(V(0, rnd(-.1, .15), 0));
      hits.push(wait(kit, i * 30).then(() => iceShard(kit, from, to, 220, { size: .3 })).then(p => iceBloom(kit, p, i === 0)));
    }
    await hits[0];
  }
  async function snowSpin(kit, ctx) {
    const { a, b } = ctx, { V, T3, rnd, EZ } = kit, n = Math.max(3, QN(kit, 6)), Y = V(0, 1, 0);
    const G = new T3.Group(), spin = new T3.Group(); G.add(spin);
    const ax = Y.clone().add(kit.cam.position.clone().sub(a).setY(0).normalize().multiplyScalar(.7)).normalize();   // 环面朝镜头斜一点
    G.quaternion.setFromUnitVectors(Y, ax);
    const sh = [];
    for (let i = 0; i < n; i++) {
      const an = i / n * TAU, m = new T3.Mesh(GEO.shard(kit), iceMat(kit));
      m.quaternion.setFromUnitVectors(Y, V(Math.cos(an) - Math.sin(an), 0, Math.sin(an) + Math.cos(an)).normalize());   // 斜着排，像转动的刀片
      spin.add(m); sh.push({ m, an });
    }
    // 一圈白色的雪环（看得出是个转动的圆盘）
    const halo = new T3.Mesh(GEO.torus(kit), kit.glowMat('#e6fbff', .55));
    halo.rotation.x = PI / 2; spin.add(halo);
    const st = { R: .45, w: 14, s: .24, rot: 0 }, wp = V(0, 0, 0), sr = rate(kit, 260);
    G.position.copy(a);
    const h = hold(kit, G, 1.6, (o, k, dt) => {
      st.rot += st.w * dt; spin.rotation.y = st.rot;
      sh.forEach(q => { q.m.position.set(Math.cos(q.an) * st.R, 0, Math.sin(q.an) * st.R); q.m.scale.set(st.s * .8, st.s, st.s * .8); }); halo.scale.setScalar(Math.max(.001, st.R * 1.05));
      const nn = sr(dt);   // 雪花沿着环切线甩出去
      for (let j = 0; j < nn; j++) {
        const an = rnd(0, TAU) + st.rot, tg = V(-Math.sin(an), 0, Math.cos(an)).applyQuaternion(G.quaternion);
        wp.set(Math.cos(an) * st.R, 0, Math.sin(an) * st.R).applyQuaternion(G.quaternion).add(G.position);
        kit.emit(1, () => ({ pos: wp.clone(), vel: tg.multiplyScalar(st.w * st.R * rnd(.3, .6) * Math.sign(st.w)).add(V(0, rnd(-.2, .3), 0)), col: pick(ICE), size: rnd(.18, .3), life: rnd(.3, .5), drag: 2, tex: 'star', spin: rnd(-6, 6), grow: .4, cover: .3 }));
      }
    });
    sh.forEach(q => solid(q.m));
    // 飞过去（越飞越大）
    await kit.tween(340, k => { G.position.lerpVectors(a, b, EZ.sine(k)); st.R = .42 + .16 * k; st.s = .22 + .05 * k; });
    // 绕着对手转一圈、再一下收拢扎进去
    await kit.tween(150, k => { G.position.copy(b); st.R = .58 + .4 * EZ.out(k); st.w = 14 + 10 * k; });
    await kit.tween(80, k => { st.R = .98 * (1 - k * k); });
    h.end();
    snow(kit, b, 30, { speed: 3, spread: .2 });
    mist(kit, b.clone().setY(.15), 6, { r: .4 });
    debris(kit, () => GEO.shard(kit), ['#a8ecff', '#cdf6ff'], 7, b, { s0: .12, s1: .18, emissive: '#2a7fb0', vel: () => kit.sph(rnd(1.5, 3)).add(V(0, rnd(1, 2.5), 0)), life: .7 });
  }
  async function glacierCrash(kit, ctx) {
    const { dir, side, other } = ctx, { V, T3, rnd } = kit, lat = flat(kit, dir), F = kit.feet(other), H = kit.mon(other).height;
    // 1. 地面一路冻过去：冰晶一根根冒出来
    const f0 = kit.feet(side).addScaledVector(dir, .55), p = V(0, 0, 0), steps = QN(kit, 9);
    camUp(kit, ctx, .9, 600);
    let next = 0;
    await kit.tween(280, k => {
      p.lerpVectors(f0, F, k);
      while (next <= k * steps) { const q = p.clone().addScaledVector(lat, rnd(-.2, .2)); crystal(kit, q, rnd(.25, .45), { w: .75, life: .6 }); mist(kit, q, 1, { r: .15, size: .6 }); next++; }
    });
    kit.sfx('ice', 'impact', 0);
    kit.decal(F, { kind: 'frost', r: 1.4, life: 3 });
    kit.groundCircle(other, { col: '#9be7ff', col2: '#ffffff', r: 1.25, runes: true, life: 1.3, spin: .5 });
    // 2. 冰晶牢笼：一圈大冰晶 + 罩住对手的冰壳，对手身上泛冰蓝
    kit.aura(other, { col: '#9be7ff', col2: '#ffffff', life: 1, strength: .9 });
    const parts = [], N = Math.max(4, QN(kit, 7)), ac = awayCam(kit, F);
    for (let i = 0; i < N; i++) { const an = i / N * TAU + rnd(-.15, .15), R = rnd(.66, .84), front = Math.cos(an) * ac.x + Math.sin(an) * ac.z < -.35; parts.push(crystal(kit, F.clone().add(V(Math.cos(an) * R, 0, Math.sin(an) * R)), H * rnd(.75, 1.2) * (front ? .5 : 1), { tilt: V(Math.cos(an) * .35, 1, Math.sin(an) * .35).normalize(), w: 1.3, life: 1.5, delay: i * 22, grow: .16 })); }
    const cage = new T3.Mesh(GEO.prism(kit), iceMat(kit, { tr: true, op: .42, col: '#c6f1ff', em: '#3a9fd0' }));
    cage.position.copy(F).setY(.04); cage.rotation.y = rnd(0, TAU); cage.scale.set(.56, .001, .56);
    parts.push(hold(kit, cage, 1.5)); solid(cage);
    mist(kit, F, 4, { r: .6, size: .8 });
    await kit.tween(220, k => { cage.scale.y = Math.max(.001, H * 1.15 * backOut(k)); });
    await wait(kit, 60);
    // 3. 冰山从天上砸下来
    const top = F.clone().add(V(0, H * 1.15 + .45, 0)), S = top.clone().add(V(0, 3.4, 0)).addScaledVector(awayCam(kit, F), .5);
    const berg = new T3.Group(), body = new T3.Mesh(GEO.berg(kit), iceMat(kit, { col: '#9fe4ff', em: '#24719e' }));
    body.scale.setScalar(.8); berg.add(body);
    for (let i = 0; i < 3; i++) { const sp = new T3.Mesh(GEO.crystal(kit), iceMat(kit, { col: '#c8f4ff' })); sp.position.set(rnd(-.2, .2), .25, rnd(-.2, .2)); sp.quaternion.setFromUnitVectors(V(0, 1, 0), V(rnd(-.6, .6), 1, rnd(-.6, .6)).normalize()); sp.scale.set(1.5, rnd(.6, .85), 1.5); berg.add(sp); }
    berg.position.copy(S);
    const bh = hold(kit, berg, 1.2); solid(berg);
    const sr = rate(kit, 120);
    let lk = 0;
    await kit.tween(320, k => { const dt = (k - lk) * .32; lk = k; berg.position.lerpVectors(S, top, Math.pow(k, 1.6)); berg.rotation.y += dt * 4; const n = sr(dt); if (n) snow(kit, berg.position, n, { spread: .5, speed: .6, up: 1 }); });
    // 4. 全部炸碎
    bh.end(); parts.forEach(q => q.end());
    const c = F.clone().add(V(0, H * .55, 0));
    debris(kit, () => GEO.shard(kit), ['#a8ecff', '#cdf6ff', '#8fdfff'], 20, c, { s0: .12, s1: .22, spread: .4, emissive: '#2a7fb0', vel: () => kit.sph(rnd(2, 4)).add(V(0, rnd(1.5, 4), 0)), life: .9 });
    snow(kit, c, 30, { speed: 4, spread: .4, size: 1.1, life: 1 });
    mist(kit, F, 6, { r: .8, speed: 1.6, size: .9 });
    kit.shockwave(F.clone().setY(.14), { col: '#6fd8ff', col2: '#ffffff', r0: .4, r1: 2.7, life: .55, thick: .2, cover: .5 });
    kit.shake(.35);
  }
  T.ice = {
    generic: { wave: false },   // 冲击波自己放冰蓝色的（通用的是白色，冰本来就浅，叠起来一片白）
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { V, rnd } = kit, c = kit.center(side), f = kit.feet(side);
      // 雪花往身上聚，脚下冒寒气
      kit.emit(12 + t * 10, () => { const p = c.clone().add(kit.sph(rnd(.9, 1.3))), life = rnd(.3, .45); return { pos: p, vel: c.clone().sub(p).multiplyScalar(.9 / life), col: pick(ICE), size: rnd(.14, .24), life, grow: .3, tex: 'star', spin: rnd(-6, 6), cover: .2 }; });
      mist(kit, f, 5 + t * 4, { r: .5, speed: .6 });
      if (t >= 1) kit.decal(f, { kind: 'frost', r: .55 + t * .2, life: 1.2 });
      if (t === 2) for (let i = 0; i < QN(kit, 5); i++) { const an = i / 5 * TAU + rnd(-.3, .3); crystal(kit, f.clone().add(V(Math.cos(an) * .6, 0, Math.sin(an) * .6)), rnd(.25, .4), { w: .8, life: .8, delay: i * 60 }); }
    },
    release(kit, ctx) { return [frostNip, snowSpin, glacierCrash][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      snow(kit, b, 10 + t * 10, { speed: 2.4 });
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#6fd8ff', col2: '#e6fbff', r1: 1.5, life: .42, thick: .16, cover: .5 });
      mist(kit, b.clone().setY(b.y * .4), 3 + t * 3, { r: .3, speed: .6 });
    },
    async after(kit, ctx) {
      const t = ctx.tier, F = kit.feet(ctx.other);
      if (t === 1) kit.decal(F, { kind: 'frost', r: .9, life: 2.4 });
      await wait(kit, 250);
      // 雪花慢慢飘下来
      kit.emit(6 + t * 8, () => ({ pos: F.clone().add(kit.V(kit.rnd(-.8, .8), kit.rnd(1, 2.2), kit.rnd(-.8, .8))), vel: kit.V(kit.rnd(-.2, .2), -kit.rnd(.4, .8), kit.rnd(-.2, .2)), col: pick(ICE), size: kit.rnd(.1, .18), life: kit.rnd(1, 1.6), tex: 'star', spin: kit.rnd(-2, 2), grow: .8, cover: .2 }));
    },
  };

  // ======================= 地面 =======================
  // 土色压暗一点：粒子都进发光后期，亮的土黄色在高画质下会发出橙光，看着像火
  const DIRT = ['#9a7a56', '#86684a', '#ad9070', '#755a40'];
  // 尘土（普通颜色的烟团）
  function dust(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit, r = o.r || .2;
    kit.emit(n, () => { const an = rnd(0, TAU), s = rnd(.4, 1) * (o.speed || 1.2); return { pos: at.clone().add(V(Math.cos(an) * rnd(0, r), rnd(0, .15), Math.sin(an) * rnd(0, r))), vel: V(Math.cos(an) * s, rnd(.2, .9) * (o.up || 1), Math.sin(an) * s), col: pick(o.cols || DIRT), size: rnd(.35, .6) * (o.size || 1), life: rnd(.5, .9) * (o.life || 1), grow: 2, drag: 1.6, tex: 'smoke', spin: rnd(-1.5, 1.5), cover: o.cover == null ? .75 : o.cover, alpha: .85 }; });
  }
  // 小土块 / 泥点（不透明，往下掉）
  function clods(kit, at, n, o) {
    o = o || {};
    const { V, rnd } = kit;
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(rnd(0, o.spread || .1))), vel: kit.sph(rnd(.5, 1) * (o.speed || 2)).add(V(0, rnd(1, 2.5) * (o.up || 1), 0)), col: pick(o.cols || ['#6b4423', '#8a5a2b', '#5a3a1e']), size: rnd(.08, .15) * (o.size || 1), life: rnd(.4, .6), grav: -10, drag: .3, tex: 'smoke', grow: .8, cover: 1 }));
  }
  function mudToss(kit, ctx) {
    const { a, b, dir } = ctx, { V } = kit, lat = flat(kit, dir), hits = [];
    [[.16, 0, -.08, .1], [.12, 70, .2, -.15]].forEach(([s, d, ox, oy], i) => {
      const from = a.clone().addScaledVector(lat, ox * .6), to = toCam(kit, b, .2).addScaledVector(lat, ox).add(V(0, oy, 0));
      const m = new kit.T3.Mesh(GEO.mud(kit), kit.toonMat('#6b4423', { emissive: '#1a0d04' })), dr = rate(kit, 50);
      m.scale.setScalar(s);
      let lk = 0;
      hits.push(wait(kit, d).then(() => { const f = kit.fly(from, to, 250, m, (p, k) => {
        const n = dr((k - lk) * .25); lk = k;
        if (n) kit.emit(n, () => ({ pos: p.clone().add(kit.sph(s * .6)), vel: V(0, -.3, 0), col: '#5a3a1e', size: kit.rnd(.07, .12), life: .35, grav: -8, tex: 'smoke', cover: 1 }));
      }, { arc: .35, spin: [7, 3, 5] }); solid(m); return f; }).then(() => {
        // 啪地溅开：一圈泥浆 + 泥点
        kit.shockwave(to, { col: '#5a3a1e', col2: '#8a5a2b', flat: false, r0: .1, r1: i ? .45 : .65, life: .22, thick: .22, cover: .95, push: .1 });
        clods(kit, to, i ? 9 : 14, { speed: 2.6, up: .8, size: 1.3 });
        dust(kit, to, 3, { r: .1, speed: .6, size: .7, life: .5 });
        if (!i) kit.decal(kit.feet(ctx.other), { kind: 'splash', col: '#5a3a1e', col2: '#8a5a2b', r: .5, life: 2 });
      }));
    });
    return hits[0];
  }
  async function sandTwister(kit, ctx) {
    const { dir, side, other } = ctx, { V, T3, rnd, EZ } = kit;
    const c0 = kit.feet(side).addScaledVector(dir, .6), c1 = kit.feet(other), c = c0.clone(), H = Math.max(1.5, kit.mon(other).height * 1.35);
    const st = { R: .45, w: 7, op: 1 }, np = Math.max(3, QN(kit, 6)), rocks = [], pr = rate(kit, 220), gr = rate(kit, 30);
    // 沙子的漏斗（和水龙卷同一个流动着色器，换成沙色、没有白沫）
    const fun = waterMesh(kit, GEO.spout(kit), 1.4, { deep: '#6e5236', light: '#d2b484', foam: 2, swirl: 6, spin: 9, base: .5, top: .82 }, q => { q.position.copy(c); q.scale.set(st.R * 1.25, H, st.R * 1.25); fun.u.uOp.value = st.op; });
    fun.obj.position.copy(c); fun.obj.scale.set(.01, .01, .01);
    for (let i = 0; i < np; i++) {
      const m = new T3.Mesh(GEO.rock(kit, i), kit.toonMat(pick(['#8a6236', '#a0703a', '#6b4a2a']), { emissive: '#1a0f05' }));
      m.scale.setScalar(rnd(.05, .085));
      rocks.push({ m, hh: (i + .5) / np, ph: rnd(0, TAU), h: hold(kit, m, 1.4) }); solid(m);
    }
    let t = 0;
    // 一帧：碎石绕着转；沙子沿着漏斗的弦飞（看起来在转），越往上越宽
    const step = dt => {
      t += dt;
      rocks.forEach(r => { const rad = (.15 + .6 * r.hh) * st.R / .55, an = r.ph + t * st.w * (1.3 - r.hh * .5); r.m.position.set(c.x + Math.cos(an) * rad, c.y + r.hh * H, c.z + Math.sin(an) * rad); r.m.rotation.x += dt * 8; r.m.rotation.y += dt * 5; });
      const n = pr(dt);
      if (n) kit.emit(n, () => {
        const hh = Math.pow(Math.random(), .8), rad = (.1 + .62 * hh) * st.R / .55 * rnd(.8, 1.1), an = rnd(0, TAU), life = rnd(.18, .26), d = st.w * life;
        return { pos: V(c.x + Math.cos(an) * rad, c.y + hh * H, c.z + Math.sin(an) * rad), vel: V((Math.cos(an + d) - Math.cos(an)) * rad / life, rnd(.3, .9), (Math.sin(an + d) - Math.sin(an)) * rad / life), col: pick(['#8a7050', '#7a6044', '#9a8060']), size: rnd(.18, .26) + hh * .18, life, grow: 1.3, tex: 'smoke', spin: rnd(-3, 3), cover: .8, alpha: .85 };
      });
      const g = gr(dt);   // 脚下扬起的尘
      if (g) dust(kit, c, g, { r: .3, speed: 1.4, up: .3, size: .8, life: .5 });
    };
    let lk = 0;
    await kit.tween(380, k => { const dt = (k - lk) * .38; lk = k; c.lerpVectors(c0, c1, EZ.sine(k)); st.R = (.42 + .2 * k) * Math.min(1, k * 5); step(dt); });
    lk = 0;
    await kit.tween(170, k => { const dt = (k - lk) * .17; lk = k; c.copy(c1); st.R = .62 + .28 * k; st.w = 7 + 5 * k; step(dt); });
    // 散开：碎石甩出去，漏斗淡掉
    rocks.forEach(r => r.h.end());
    kit.tween(220, k => { st.R = .9 + .3 * k; st.op = 1 - k; }).then(() => fun.end());
    debris(kit, i => GEO.rock(kit, i), ['#8a6236', '#a0703a', '#6b4a2a'], 6, c1.clone().setY(.6), { s0: .05, s1: .09, spread: .4, vel: () => kit.sph(rnd(2, 3.5)).add(V(0, rnd(.5, 2), 0)), life: .7 });
    dust(kit, c1, 14, { r: .5, speed: 2.2, up: .8, size: 1.1 });
  }
  // 岩柱：从地下猛地顶出来（冲过头一点），停一会儿再缩回去
  function pillar(kit, at, h, an, delay) {
    const { V, rnd, EZ } = kit, m = new kit.T3.Mesh(GEO.pillar(kit), kit.toonMat(pick(['#a0703a', '#8a6236', '#b5834a']), { emissive: '#24160a' }));
    m.quaternion.setFromUnitVectors(V(0, 1, 0), V(Math.cos(an) * .32, 1, Math.sin(an) * .32).normalize()); m.rotateY(rnd(0, TAU));
    const s = rnd(1.1, 1.4), d = delay / 1000, life = 1.15 + d;
    m.scale.set(s, h, s); m.position.copy(at).setY(-h - .1);
    kit.addFx(m, life, (o, k) => {
      const t = k * life - d;
      const y = t < 0 ? -h - .1 : t < .12 ? (-h - .1) * (1 - backOut(t / .12)) : t < .8 ? 0 : (-h - .1) * EZ.sine(Math.min(1, (t - .8) / .35));
      o.position.y = at.y - .06 + y;
    });
    solid(m);
  }
  // 地裂：贴着地面的一条深色锯齿带子（几何体每次新建、到期释放）；st.len 0–1 裂到哪儿、st.fade 淡出。pads = 台子中心（台面高一点）
  function crackLine(kit, pts, pads, life) {
    const { T3, rnd } = kit, n = pts.length, pos = new Float32Array(n * 6), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }   // 两面都画（材质池里的材质只画正面）
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)], L = Math.hypot(q.x - o.x, q.z - o.z) || 1;
      const nx = -(q.z - o.z) / L, nz = (q.x - o.x) / L, w = (.03 + .08 * Math.sin(i / (n - 1) * PI)) * rnd(.6, 1.3);
      const y = pads.some(c => Math.hypot(p.x - c.x, p.z - c.z) < 1.2) ? .1 : .025;
      pos.set([p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w], i * 6);
    }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new T3.Mesh(g, kit.glowMat('#2a1a0c', .9)), st = { len: 0, fade: 1 };
    m.frustumCulled = false;
    st.h = hold(kit, m, life, () => { g.setDrawRange(0, Math.floor(st.len * (n - 1)) * 12); m.material.opacity = .9 * st.fade; });
    solid(m);
    return st;
  }
  async function quakeSlam(kit, ctx) {
    const { dir, side, other } = ctx, { V, rnd } = kit, lat = flat(kit, dir);
    const A = kit.feet(side), F = kit.feet(other), H = kit.mon(other).height;
    // 1. 跺脚
    kit.shockwave(A.clone().setY(.12), { col: '#c9964a', col2: '#f0d7a0', r0: .3, r1: 1.5, life: .4, thick: .14, cover: .55 });
    dust(kit, A, 14, { r: .5, speed: 1.6, up: .5 });
    kit.shake(.12);
    camUp(kit, ctx, .35, 520);
    // 2. 地裂一路裂过去：黑色的裂缝 + 里面透出来的光，沿路冒土
    const f0 = A.clone().addScaledVector(dir, .7), K = 7, knots = [];
    for (let i = 0; i <= K; i++) knots.push(f0.clone().lerp(F, i / K).addScaledVector(lat, i && i < K ? rnd(-.2, .2) : 0).setY(.1));
    const pts = [];
    for (let i = 0; i < K; i++) for (let j = 0; j < 4; j++) pts.push(knots[i].clone().lerp(knots[i + 1], j / 4).addScaledVector(lat, j ? rnd(-.05, .05) : 0));
    pts.push(knots[K].clone());
    const crack = crackLine(kit, pts, [A, F], 2.6), tip = knots[0].clone(), pr = rate(kit, 50);
    let lk = 0;
    await kit.tween(460, k => {
      const dt = (k - lk) * .46, x = k * K, i = Math.min(K - 1, Math.floor(x)); lk = k;
      tip.lerpVectors(knots[i], knots[i + 1], x - i); crack.len = k;
      const n = pr(dt);
      if (n) { dust(kit, tip, n * 2, { r: .08, speed: .5, up: 1.6, size: .8, life: .7 }); clods(kit, tip, n, { speed: 1, up: 1.4 }); }
    });
    crack.len = 1;
    wait(kit, 900).then(() => kit.tween(700, k => { crack.fade = 1 - k; }));
    // 3. 对手脚下鼓起来
    kit.decal(F, { kind: 'crack', r: 1.45, life: 3 });
    dust(kit, F, 10, { r: .7, speed: .8, up: 1.4 });
    clods(kit, F, 8, { spread: .5, up: 1.2 });
    kit.shake(.1);
    await wait(kit, 150);
    // 4. 一圈岩柱拱起来
    const N = Math.max(4, QN(kit, 6)), ac = awayCam(kit, F);
    for (let i = 0; i < N; i++) {
      const an = i / N * TAU + rnd(-.2, .2), R = rnd(.72, .92), front = Math.cos(an) * ac.x + Math.sin(an) * ac.z < -.35;   // 挡在镜头前面的那几根矮一点
      pillar(kit, F.clone().add(V(Math.cos(an) * R, 0, Math.sin(an) * R)), H * rnd(.75, 1.15) * (front ? .4 : 1), an, i * 14);
    }
    await wait(kit, 50);
    kit.shockwave(F.clone().setY(.14), { col: '#c9964a', col2: '#f0d7a0', r0: .4, r1: 2.8, life: .55, thick: .2, cover: .55 });
    debris(kit, i => GEO.rock(kit, i), ['#8a6236', '#a0703a', '#6b4a2a'], 10, F.clone().setY(.3), { s0: .06, s1: .13, vel: () => V(rnd(-2.2, 2.2), rnd(3, 5.5), rnd(-2.2, 2.2)) });
    dust(kit, F, 20, { r: .6, speed: 2.4, up: .7, size: 1.1, life: 1.1 });
    kit.shake(.4);
  }
  T.ground = {
    generic: { wave: false },   // 冲击波自己放土色的（通用的白色冲击波 + 发光后期在岩柱上糊成一个白球）
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { V, T3, rnd } = kit, f = kit.feet(side), n = QN(kit, 3 + t * 2);
      // 脚下扬尘，土块蹦起来
      dust(kit, f, 6 + t * 5, { r: .5, speed: .9, up: .5 });
      for (let i = 0; i < n; i++) {
        const an = rnd(0, TAU), R = rnd(.4, .75), m = new T3.Mesh(GEO.rock(kit, i), kit.toonMat(pick(['#8a6236', '#a0703a', '#6b4a2a']), { transparent: true, emissive: '#1a0f05' })), hy = rnd(.35, .7), s = rnd(.05, .085), life = rnd(.45, .6) + t * .1;
        m.scale.setScalar(s);
        kit.addFx(m, life, (q, k, dt) => { q.position.set(f.x + Math.cos(an) * R, .09 + s * .5 + hy * 4 * k * (1 - k), f.z + Math.sin(an) * R); q.rotation.x += dt * 6; q.material.opacity = k > .8 ? (1 - k) / .2 : 1; });
        solid(m);
      }
      if (t === 2) { kit.decal(f, { kind: 'crack', r: .8, life: 1.6 }); kit.shake(.08); }
      // 沙尘龙卷用水的流动着色器：蓄力时先画一下（看不见），出招不会卡一下编译
      if (t === 1) { const w = waterMesh(kit, GEO.ball(kit), .05, {}); w.u.uOp.value = 0; w.obj.position.copy(f); w.obj.scale.setScalar(.01); }
    },
    release(kit, ctx) { return [mudToss, sandTwister, quakeSlam][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      dust(kit, b.clone().setY(b.y * .6), 6 + t * 6, { r: .25, speed: 1.6, up: .6 });
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#9a7a56', col2: '#d2b484', r1: 1.5, life: .42, thick: .16, cover: .6 });
      clods(kit, b, 4 + t * 4, { speed: 2.2 });
    },
    async after(kit, ctx) {
      if (ctx.tier === 1) kit.decal(kit.feet(ctx.other), { kind: 'crack', r: .7, life: 2 });
      await wait(kit, 250);
      dust(kit, kit.feet(ctx.other), 3 + ctx.tier * 4, { r: .7, speed: .3, up: .3, size: 1.2, life: 1.4, cover: .45 });
    },
  };

  // ======================= 岩石 =======================
  const STONE = ['#8f8470', '#9c8e74', '#7c7262', '#a8987a'];   // 灰褐色的石头
  const ROCKDUST = ['#8c8270', '#7a7060', '#9a8e78'];          // 石粉（压暗一点，免得在发光后期里变成黄光）
  const rockMat = (kit, col, tr) => kit.toonMat(col || pick(STONE), { transparent: !!tr, emissive: '#1e180c' });
  // 碎石屑（不透明的小灰点，往下掉）+ 一小团白烟
  function chips(kit, at, n) {
    const { V, rnd } = kit;
    kit.emit(n, () => ({ pos: at.clone(), vel: kit.sph(rnd(1, 2.4)).add(V(0, rnd(.5, 1.8), 0)), col: pick(['#6e6450', '#8a7a58', '#5a5242']), size: rnd(.07, .12), life: rnd(.35, .5), grav: -10, tex: 'smoke', grow: .8, cover: 1 }));
    kit.emit(2, () => ({ pos: at.clone(), vel: kit.sph(.3), col: '#b0a690', size: rnd(.28, .36), life: .25, grow: 2.2, tex: 'smoke', cover: .6, alpha: .8 }));
  }
  function pebblePop(kit, ctx) {
    const { a, b, dir } = ctx, { V, T3, rnd } = kit, lat = flat(kit, dir), n = Math.max(3, QN(kit, 5)), hits = [];
    for (let i = 0; i < n; i++) {
      const from = a.clone().addScaledVector(lat, rnd(-.12, .12)).add(kit.sph(.04)), to = toCam(kit, b, .15).addScaledVector(lat, rnd(-.32, .32)).add(V(0, rnd(-.25, .25), 0));
      const m = new T3.Mesh(GEO.rock(kit, i), rockMat(kit)), dr = rate(kit, 45);
      m.scale.setScalar(rnd(.08, .12));
      let lk = 0;
      hits.push(wait(kit, i * 28).then(() => { const f = kit.fly(from, to, 210, m, (p, k) => {
        const nn = dr((k - lk) * .21); lk = k;
        if (nn) kit.emit(nn, () => ({ pos: p.clone(), vel: kit.sph(.2), col: '#9a8e78', size: rnd(.12, .18), life: .25, grow: 2, tex: 'smoke', cover: .6, alpha: .6 }));
      }, { arc: .08, spin: [rnd(-15, 15), rnd(-15, 15), rnd(-15, 15)] }); solid(m); return f; }).then(() => chips(kit, to, 6)));
    }
    return hits[1];
  }
  async function rockRoll(kit, ctx) {
    const { dir, side, other } = ctx, { V, T3, rnd, EZ } = kit, R = .34;
    const s0 = kit.feet(side).addScaledVector(dir, .75), s1 = kit.feet(other).addScaledVector(dir, -(R + .32));
    const m = new T3.Mesh(GEO.boulder(kit), rockMat(kit, '#958870')), h = hold(kit, m, 1.5);
    solid(m);
    const axis = V(0, 0, 0).crossVectors(V(0, 1, 0), dir).normalize(), q = new T3.Quaternion(), L = s0.distanceTo(s1);
    m.scale.setScalar(R); m.position.copy(s0).setY(.09 - R);
    // 从地里顶出来
    dust(kit, s0, 10, { r: .3, speed: 1.4, up: .6 });
    clods(kit, s0, 6, { spread: .2, cols: ['#6e6450', '#8a7a58'] });
    await kit.tween(90, k => { m.position.y = .09 - R + 2 * R * EZ.out(k) + Math.sin(k * PI) * .12; });
    // 蹦着滚过去，越滚越快
    const dr = rate(kit, 70);
    let lk = 0, dist = 0;
    await kit.tween(400, k => {
      const dt = (k - lk) * .4, e = k * (.6 + .4 * k); lk = k;
      const hop = Math.abs(Math.sin(e * PI * 3)) * .16 * (1 - e * .5);
      m.position.lerpVectors(s0, s1, e); m.position.y = .09 + R + hop;
      const dd = e * L - dist; dist += dd;
      q.setFromAxisAngle(axis, dd / R); m.quaternion.premultiply(q);
      const n = dr(dt);
      if (n) kit.emit(n, () => ({ pos: m.position.clone().setY(.15).addScaledVector(dir, -R * .6), vel: dir.clone().multiplyScalar(-rnd(.3, 1)).add(V(rnd(-.4, .4), rnd(.3, .9), rnd(-.4, .4))), col: pick(ROCKDUST), size: rnd(.3, .5), life: rnd(.4, .6), grow: 2, drag: 1.5, tex: 'smoke', cover: .75, alpha: .8 }));
    });
    // 撞碎
    h.end();
    const at = m.position.clone();
    debris(kit, i => GEO.rock(kit, i), STONE, 9, at, { s0: .08, s1: .15, spread: .2, emissive: '#1e180c', vel: () => dir.clone().multiplyScalar(rnd(-.6, 1.2)).add(kit.sph(rnd(1, 2.2))).add(V(0, rnd(1.5, 3.2), 0)) });
    dust(kit, at.setY(.15), 16, { r: .3, speed: 2, up: 1, cols: ROCKDUST });
    kit.decal(kit.feet(other), { kind: 'crack', r: .6, life: 2 });
  }
  // 跟着大陨石落下来的小石头（落地在命中之后）
  function smallMeteor(kit, from, to, ms, delay) {
    const { V, T3, rnd } = kit;
    wait(kit, delay).then(async () => {
      const m = new T3.Mesh(GEO.boulder(kit), rockMat(kit)), h = hold(kit, m, ms / 1000 + .3), sr = rate(kit, 90);
      solid(m);
      m.scale.setScalar(rnd(.26, .32)); m.position.copy(from);
      let lk = 0;
      await kit.tween(ms, k => { const dt = (k - lk) * ms / 1000; lk = k; m.position.lerpVectors(from, to, k * k); m.rotation.x += dt * 5; const n = sr(dt); if (n) kit.emit(n, () => ({ pos: m.position.clone().add(kit.sph(.15)), vel: kit.sph(.3), col: pick(ROCKDUST), size: rnd(.3, .45), life: .45, grow: 2.2, tex: 'smoke', cover: .7, alpha: .75 })); });
      h.end();
      kit.sfx('rock', 'impact', 0);
      kit.shockwave(to.clone().setY(.13), { col: '#a89878', col2: '#e8dcb0', r0: .2, r1: 1.2, life: .35, thick: .14, cover: .6 });
      debris(kit, i => GEO.rock(kit, i), STONE, 5, to.clone().setY(.25), { s0: .06, s1: .11 });
      dust(kit, to, 10, { r: .3, speed: 1.6, up: .7, cols: ROCKDUST });
    });
  }
  async function boulderFall(kit, ctx) {
    const { dir, other } = ctx, { V, T3, rnd } = kit, lat = flat(kit, dir), F = kit.feet(other), R = .78;
    camUp(kit, ctx, 1.5, 450);
    const end = F.clone().setY(.09 + R * .75), S = end.clone().add(V(0, 5.2, 0)).addScaledVector(lat, .7).addScaledVector(awayCam(kit, F), 1);
    // 影子越来越大
    const sh = kit.decal(F, { kind: 'scorch', col: '#2a2218', col2: '#1a140c', r: 1.15, life: 1.1, opacity: .85 });
    const pre = 100, fall = 460;
    kit.tween(pre + fall, k => { const s = 2.3 * (.35 + .65 * k * k); sh.scale.set(s, s, 1); });
    smallMeteor(kit, S.clone().addScaledVector(lat, -1.6).add(V(0, 1, 0)), F.clone().addScaledVector(lat, -1).addScaledVector(dir, .3).setY(.35), 420, pre + 180);
    smallMeteor(kit, S.clone().addScaledVector(lat, 1).add(V(0, 1.6, 0)), F.clone().addScaledVector(lat, .95).addScaledVector(dir, -.2).setY(.35), 420, pre + 300);
    await wait(kit, pre);
    // 大陨石带着烟尾巴砸下来
    const m = new T3.Mesh(GEO.boulder(kit), rockMat(kit, '#8a7a58')), h = hold(kit, m, 2);
    solid(m);
    m.scale.setScalar(R); m.position.copy(S);
    const sr = rate(kit, 200);
    let lk = 0;
    await kit.tween(fall, k => {
      const dt = (k - lk) * fall / 1000; lk = k;
      m.position.lerpVectors(S, end, k * k); m.rotation.x += dt * 3; m.rotation.z += dt * 2;
      const n = sr(dt);
      if (n) kit.emit(n, () => ({ pos: m.position.clone().add(kit.sph(R * .7)), vel: kit.sph(.4).add(V(0, .8, 0)), col: pick(['#7a7060', '#8c8270', '#5e564a']), size: rnd(.5, .8), life: rnd(.32, .48), grow: 2.4, tex: 'smoke', spin: rnd(-2, 2), cover: .65, alpha: .75 }));
    });
    // 砸中：碎成一地
    h.end();
    debris(kit, i => GEO.rock(kit, i), STONE, 14, end, { s0: .12, s1: .24, spread: .45, vel: () => kit.sph(rnd(1.5, 3.5)).add(V(0, rnd(2, 4.5), 0)), life: 1.1 });
    kit.shockwave(F.clone().setY(.14), { col: '#a89878', col2: '#e8dcb0', r0: .4, r1: 3.1, life: .6, thick: .22, cover: .6 });
    kit.shockwave(F.clone().setY(.15), { col: '#8c8270', col2: '#c8bca0', r0: .2, r1: 1.9, life: .4, thick: .16, cover: .6 });
    kit.decal(F, { kind: 'crack', r: 1.55, life: 3 });
    dust(kit, F, 26, { r: .7, speed: 2.6, up: .8, size: 1.3, life: 1.1, cols: ROCKDUST });
    kit.shake(.45);
  }
  T.rock = {
    generic: { wave: false },   // 冲击波自己放土黄色的
    charge(kit, ctx) {
      const { side, tier: t } = ctx, { T3, rnd } = kit, mm = kit.mon(side), base = mm.root.position.clone(), n = QN(kit, 3 + t * 2);
      // 石头从地上浮起来，绕着身子转
      for (let i = 0; i < n; i++) {
        const an = rnd(0, TAU), R = rnd(.5, .8), hy = rnd(.25, .65) * mm.height, ph = rnd(0, TAU), s = rnd(.06, .1) * (1 + t * .15), life = .55 + t * .2, w = 2.5 * (i % 2 ? 1 : -1);
        const m = new T3.Mesh(GEO.rock(kit, i), rockMat(kit, null, true));
        m.scale.setScalar(s);
        kit.addFx(m, life, (q, k, dt) => {
          const up = kit.EZ.out(Math.min(1, k / .4)), a2 = an + w * k * life;
          q.position.set(base.x + Math.cos(a2) * R, .1 + hy * up + .04 * Math.sin(k * 20 + ph), base.z + Math.sin(a2) * R);
          q.rotation.x += dt * 2; q.rotation.y += dt * 3; q.material.opacity = k > .8 ? (1 - k) / .2 : 1;
        });
        solid(m);
      }
      dust(kit, kit.feet(side), 5 + t * 4, { r: .5, speed: .8, up: .4, cols: ROCKDUST });
    },
    release(kit, ctx) { return [pebblePop, rockRoll, boulderFall][ctx.tier](kit, ctx); },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      chips(kit, b, 6 + t * 6);
      if (t === 1) kit.shockwave(kit.feet(other).setY(.12), { col: '#a89878', col2: '#e8dcb0', r1: 1.5, life: .42, thick: .16, cover: .6 });
      dust(kit, b.clone().setY(b.y * .6), 4 + t * 4, { r: .25, speed: 1.4, up: .6, cols: ROCKDUST });
    },
    async after(kit, ctx) {
      await wait(kit, 300);
      dust(kit, kit.feet(ctx.other), 3 + ctx.tier * 4, { r: .8, speed: .3, up: .3, size: 1.2, life: 1.4, cover: .45, cols: ROCKDUST });
    },
  };

  // ======================= 开场预热（battle3d.js 的 warm，FX_SPEC §7.1） =======================
  // 战斗一开场，battle3d.js 把这些小步骤摊到很多帧里做完：一步建一个共用几何体（kit.geo 缓存），最后一步把水的着色器编译好——
  // 以前都是第一次用到的那一帧现做（几何体几毫秒到二十几毫秒，着色器 60 毫秒以上，都按手机速度算），放招时卡一下
  const WARM = BFX.warm = BFX.warm || [];
  Object.keys(GEO).forEach(n => WARM.push(n === 'rock' ? kit => { for (let i = 0; i < 3; i++) GEO.rock(kit, i); } : kit => { GEO[n](kit); }));
  // 水的材质：拿一个出来编译（noGlow：水不进发光后期，那一份程序不用编），马上标成没在用
  WARM.push(kit => { const m = waterMat(kit, {}); m.userData.busy = false; const o = new kit.T3.Mesh(GEO.wave(kit), m); o.userData.noGlow = true; return o; });
})();
