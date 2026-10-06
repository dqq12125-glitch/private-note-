// 回声岛 · 战斗特效库（能量系）：电 spark、超能 psychic、龙 dragon、幽灵 ghost、恶 dark、毒 poison
// 登记到 window.BattleFX.types[type] = { charge?, release, impact?, after? }（规格见 tools/FX_SPEC.md §2–§6）：
//   charge(kit, ctx)  蓄力时加的属性特效（不返回 Promise，不挡流程；蓄力时长、周身光、脚下光圈由 battle3d.js 的通用蓄力管）
//   release(kit, ctx) 放出招式，**必须在命中那一刻 resolve**（monsters.js 接着出伤害数字、调 hit()）
//   impact / after    命中后属性自己的样子、余韵（后台跑，不挡流程）。通用的命中星 / 闪光 / 放慢由 battle3d.js 的通用命中做，
//                     通用冲击波这几个属性关掉了、自己画属性色的（generic.wave，原因见 groundWave）
//   ctx = { a 出招点, b 命中点, dir 朝对手的水平方向, side, other, tier 0 小招 / 1 中招 / 2 大招, cols, info, type }；
//   大招的「招牌镜头」有的从蓄力就开始搭（雷云、黑夜影沼、日食、毒沼），挂在 ctx 上交给 release / after 收尾
// 三档的样子（一眼分得出）：
//   电   小：两下电弧直劈过去          中：手前聚电球 → 粗光束 + 缠绕的电弧      大：对手头上聚雷云，三道试探雷 → 巨雷劈下，地面电弧四散
//   超能 小：意念光点带一串小波纹       中：一圈圈梦境波纹涌过去                  大：对手被托上半空，四周亮起星座连线 → 星座收拢、摔回地面
//   龙   小：一道龙鳞月牙刃飞过去       中：紫粉龙焰喷射，龙焰包住对手            大：龙吼声波 → 龙魂从身后盘旋升起，越过场地螺旋俯冲
//   幽灵 小：一团摇摇晃晃的鬼火         中：暗影球（黑核 + 紫晕 + 鬼火绕着转）    大：入夜，对手脚下影沼，影子之手从地下伸出抓住它 + 鬼火
//   恶   小：黑影一掠，留一道斩痕       中：上下两排獠牙一口咬合                  大：对手头上升起黑色日食，四道斩痕交叉 → 日食砸下、巨大十字斩
//   毒   小：一颗毒液滴抛过去溅开       中：一串污泥团喷过去，脚下毒水洼          大：对手脚下毒沼冒泡、毒雾旋风 → 毒泡一起爆开
// 同是紫色系的四个属性靠点缀色分开：龙 = 靛紫 + 粉 + 金，幽灵 = 黑影 + 青色鬼火，恶 = 墨黑 + 白色刀光，毒 = 品紫 + 泡泡 + 一点荧光绿
// 全屏闪一律走 kit.flash（自动限频），每招最多一次；闪电的「闪」只是线本身忽明忽暗。网格、闪电、拖尾的个数按画质缩（粒子 kit 自己缩）
(function () {
  'use strict';
  const BFX = window.BattleFX = window.BattleFX || { types: {}, support: {} };
  const T = BFX.types = BFX.types || {};

  // ---------- 配色（主色和 TYPE_COL 一致） ----------
  const SP = { y: '#ffe14d', w: '#ffffff', amb: '#ffb300', cl: '#4a5070', cl2: '#6b7291' };
  const PS = { p: '#ff5ea8', l: '#ffd0e8', v: '#b06cff', w: '#fff4fa', c: '#bdefff' };
  const DR = { v: '#6a4dff', p: '#ff5ea8', d: '#3b22c9', d2: '#a07dff', g: '#ffd36e', l: '#ffc4f0', li: '#b69cff' };
  const GH = { v: '#7d5ce6', d: '#2a1a4a', s: '#1c1030', c: '#8ff5e6', t: '#3fcfbf', l: '#c9b6ff', night: '#140a26' };
  const DK = { k: '#4a3a55', l: '#b388ff', b: '#120a1c', w: '#ffffff', night: '#120b1a' };
  const PO = { p: '#b25ce6', l: '#e8b8ff', d: '#6a1f8f', g: '#b6ff5c', goo: '#8e3fd0', em: '#2a0a44' };

  const CH_MS = [250, 450, 700];   // 规格 §4 的蓄力时长（小 / 中 / 大招）
  const QN = { high: 1, mid: .75, low: .5 };

  // ---------- 小工具（模块级，各属性共用） ----------
  const qn = (kit, n) => Math.max(1, Math.round(n * (QN[kit.q] || 1)));   // 网格 / 闪电 / 拖尾的个数按画质缩
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sgn = () => (Math.random() < .5 ? -1 : 1);
  // 计时器：每帧调 fn(k 0–1, dt)，返回 true 提前结束（挂在一个空物件上交给 kit.addFx，到期自动清掉）
  const tick = (kit, life, fn, end) => kit.addFx(new kit.T3.Object3D(), life, (o, k, dt) => fn(k, dt), end);
  // 默认机位（运镜时也按它排星座、斩痕，镜头动的时候图案不歪）
  const home = kit => kit.shotToward('me', 0, 0)();
  // 面向镜头的坐标轴：f 视线方向、r 屏幕右、u 屏幕上（from 不给就用当前镜头）
  function basis(kit, at, from) {
    const f = at.clone().sub(from || kit.cam.position).normalize();
    const r = f.clone().cross(kit.V(0, 1, 0)).normalize();
    return { f, r, u: r.clone().cross(f) };
  }
  // 一个物件面向镜头，再在屏幕里转 ang
  const face = (kit, o, ang) => { o.quaternion.copy(kit.cam.quaternion); if (ang) o.rotateZ(ang); };
  // 屏幕上从 a 到 b 的方向（弧度）
  function screenAng(kit, a, b) {
    const pa = a.clone().project(kit.cam), pb = b.clone().project(kit.cam);
    return Math.atan2(pb.y - pa.y, (pb.x - pa.x) * (kit.cam.aspect || 1));
  }
  // 怪兽头部（出招的嘴 / 额头），dir 给了就往前挪一点
  function headOf(kit, side, dir) {
    const m = kit.mon(side), c = kit.center(side);
    c.y += (m ? m.height : 1) * .26;
    if (dir) c.addScaledVector(dir, .2);
    return c;
  }
  const hOf = (kit, side) => { const m = kit.mon(side); return m ? m.height : 1; };
  // 挨打的是我方时它离镜头近，同样大的特效在画面上大很多、容易把它整个盖住：贴在它身上的大东西按这个缩一点
  const nearK = ctx => (ctx.other === 'me' ? .72 : 1);
  // 往镜头那边挪 d：贴在怪兽身上的图案（斩痕、獠牙）放在它前面，不然一半被身子挡住
  const front = (kit, at, d) => at.clone().add(kit.cam.position.clone().sub(at).normalize().multiplyScalar(d));
  // 命中时脚下一圈属性色的冲击波（中招、大招）。这几个属性都关掉了通用冲击波（generic.wave）：
  // 通用的大招冲击波是一圈面向镜头的白环，里面一层淡光被发光后期一晕，会在对手身上糊成一大团白（约 0.3 秒看不清谁挨打）
  const groundWave = (kit, ctx, col, col2, o) => { if (ctx.tier) kit.shockwave(kit.feet(ctx.other).setY(.12), Object.assign({ col, col2, r0: .3, r1: ctx.tier === 2 ? 2.4 : 1.5, life: ctx.tier === 2 ? .55 : .42, thick: .14, cover: .55 }, o)); };
  // 运镜：从默认机位往挨打的一方推 k、看向 lk，可以抬高视线、变焦（关了运镜什么都不做）
  function camFrame(kit, ctx, o) {
    if (!kit.CINE) return;
    const h = home(kit), near = ctx.other === 'me';
    kit.camTo(() => {
      const c = kit.center(ctx.other);
      return { pos: h.pos.clone().lerp(c, near ? (o.kNear == null ? o.k * .4 : o.kNear) : o.k).add(kit.V(0, o.up || 0, 0)), look: h.look.clone().lerp(c, o.lk == null ? .5 : o.lk).add(kit.V(0, o.lookUp || 0, 0)), fov: o.fov };
    }, o.ms || 480, o.ez);
  }
  // 月牙形（两段抛物线围成、两头尖）：x 从 -1 到 1，凸的一边朝 +y；h1 外弧高、h2 内弧高
  function crescentGeo(T3, h1, h2) {
    const s = new T3.Shape(), N = 22;
    for (let i = 0; i <= N; i++) { const x = -1 + 2 * i / N; if (i) s.lineTo(x, h1 * (1 - x * x)); else s.moveTo(x, 0); }
    for (let i = N - 1; i > 0; i--) { const x = -1 + 2 * i / N; s.lineTo(x, h2 * (1 - x * x)); }
    s.closePath();
    return new T3.ShapeGeometry(s);
  }
  // 共用的单位球（和 battle3d.js 的 orb 用的是同一份：同一个名字、同样的形状）
  const sphG = kit => kit.geo('sph14', () => new kit.T3.SphereGeometry(1, 14, 10));

  // ---------- 粒子小配方 ----------
  // 从四周吸进 at（蓄力）：半径 r、n 颗、life 秒内到
  function inward(kit, at, r, n, life, cols, o) {
    o = o || {};
    kit.emit(n, () => {
      const d = kit.sph(1), L = r * kit.rnd(.7, 1.1), tt = life * kit.rnd(.55, .95);
      return { pos: at.clone().addScaledVector(d, L), vel: d.multiplyScalar(-L / tt), col: pick(cols), size: (o.size || .2) * kit.rnd(.7, 1.3), life: tt, grow: .6, fade: .3, tex: o.tex || 'glow', spin: o.tex === 'star' ? kit.rnd(-6, 6) : 0, cover: o.cover == null ? .3 : o.cover };
    });
  }
  // 电火花：四角星，往外蹦、往下掉
  function sparks(kit, at, n, sp, o) {
    o = o || {};
    kit.emit(n, () => ({ pos: at.clone(), vel: kit.sph(kit.rnd(.4, 1) * sp).add(kit.V(0, sp * .35, 0)), col: Math.random() < .65 ? (o.col || SP.y) : SP.w, size: kit.rnd(.12, .26) * (o.s || 1), life: kit.rnd(.25, .5), grav: -9, drag: 1.2, tex: 'star', spin: kit.rnd(-12, 12), cover: .35 }));
  }
  // 一团烟：往外散、慢慢变大（暗颜色用 cover .85，亮背景上也看得见）
  function puff(kit, at, cols, n, sp, size, life, o) {
    o = o || {};
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(o.r || .1)), vel: kit.sph(kit.rnd(.4, 1) * sp).add(kit.V(0, o.up || 0, 0)), col: pick(cols), size: size * kit.rnd(.7, 1.3), life: life * kit.rnd(.7, 1.2), grow: o.grow || 1.8, fade: .1, drag: o.drag == null ? 2 : o.drag, grav: o.grav || 0, tex: 'smoke', spin: kit.rnd(-1.5, 1.5), cover: o.cover == null ? .85 : o.cover, alpha: o.alpha }));
  }
  // 一闪一闪的小星星（超能、龙鳞）：在 getC() 附近 r 范围里，life 秒内一共 n 颗
  function twinkle(kit, getC, r, n, life, cols, o) {
    o = o || {};
    let acc = 0;
    const rate = n * (QN[kit.q] || 1) / Math.max(.05, life);
    tick(kit, life, (k, dt) => {
      acc += dt * rate;
      while (acc >= 1) {
        acc--;
        const c = getC(); if (!c) return true;
        kit.emit(1, () => ({ pos: c.add(kit.sph(r * Math.cbrt(Math.random()))), vel: kit.V(0, o.up == null ? .3 : o.up, 0), col: pick(cols), size: (o.size || .26) * kit.rnd(.7, 1.3), life: kit.rnd(.25, .45), grow: .2, fade: .25, tex: 'star', spin: kit.rnd(-5, 5), cover: o.cover == null ? .3 : o.cover }));
      }
    });
  }
  // 泡泡（ring 贴图）：从 at 附近半径 r 冒出来往上飘
  function bubbles(kit, at, r, n, life, o) {
    o = o || {};
    kit.emit(n, () => {
      const an = kit.rnd(0, 6.28), rr = r * Math.sqrt(Math.random());
      return { pos: at.clone().add(kit.V(Math.cos(an) * rr, kit.rnd(0, .15), Math.sin(an) * rr)), vel: kit.V(kit.rnd(-.15, .15), kit.rnd(.4, 1) * (o.up || 1), kit.rnd(-.15, .15)), col: pick(o.cols || [PO.p, PO.l, PO.p]), size: kit.rnd(.14, .32) * (o.s || 1), life: life * kit.rnd(.6, 1.1), grow: 1.4, fade: .6, drag: .6, tex: 'ring', cover: o.cover == null ? .55 : o.cover };
    });
  }

  // ======================================================================
  // 电 spark：黄白电弧，命中后电弧在身上乱窜、火花蹦；大招从雷云劈下
  // ======================================================================
  // 电弧在一团东西表面乱窜：getC() 每次给中心、r 半径、rate 每秒几根、life 秒
  function crawl(kit, getC, r, rate, life, o) {
    o = o || {};
    let acc = 1;
    rate *= QN[kit.q] || 1;
    tick(kit, life, (k, dt) => {
      acc += dt * rate;
      while (acc >= 1) {
        acc--;
        const c = getC(); if (!c) return true;
        const p = kit.sph(r), q = p.clone().add(kit.sph(r * 1.1)).normalize().multiplyScalar(r * kit.rnd(.8, 1.1));
        kit.lightning(c.clone().add(p), c.add(q), { col: o.col || SP.y, col2: SP.w, width: o.width || .022, branches: 1, life: kit.rnd(.08, .14), jag: .45, cover: .5 });
      }
    });
  }
  const crawlMon = (kit, side, rate, life, o) => crawl(kit, () => kit.center(side), hOf(kit, side) * .5, rate, life, o);
  // 雷云（大招，蓄力时就开始聚）：对手头上一团翻滚的乌云，里面一闪一闪；返回 { top 云底中心, boom() 劈雷时云里一亮, end() }
  function stormCloud(kit, ctx) {
    const b = kit.center(ctx.other), h = hOf(kit, ctx.other);
    const top = kit.V(b.x, b.y + Math.max(1.5, h * 1.1) + .5, b.z);
    const st = {
      top, done: false, end() { st.done = true; },
      boom() { for (let i = 0; i < 3; i++) kit.glow(top.clone().add(kit.V(kit.rnd(-.7, .7), kit.rnd(0, .3), kit.rnd(-.3, .3))), { col: SP.y, size: kit.rnd(1.4, 2), life: .3, cover: .2 }); },
    };
    let acc = 8, fl = .1, fade = 1;   // 一开始先冒一团
    const rate = 46 * (QN[kit.q] || 1);
    tick(kit, 5, (k, dt) => {
      if (st.done) { fade -= dt / .3; if (fade <= 0) return true; }
      acc += dt * rate * Math.max(0, fade);
      while (acc >= 1) {
        acc--;
        kit.emit(1, () => ({ pos: top.clone().add(kit.V(kit.rnd(-1, 1) * 1.15, kit.rnd(-.15, .35), kit.rnd(-1, 1) * .8)), vel: kit.V(kit.rnd(-.2, .2), kit.rnd(-.04, .1), kit.rnd(-.2, .2)), col: Math.random() < .55 ? SP.cl : SP.cl2, size: kit.rnd(.8, 1.3), life: kit.rnd(.55, .8), grow: 1.35, fade: .3, tex: 'smoke', spin: kit.rnd(-.6, .6), cover: .9, alpha: .95 }));
      }
      fl -= dt;
      if (fl <= 0 && !st.done) {
        fl = kit.rnd(.07, .16);
        const p = top.clone().add(kit.V(kit.rnd(-.9, .9), kit.rnd(0, .3), kit.rnd(-.5, .5)));
        kit.glow(p, { col: SP.y, size: kit.rnd(.7, 1.2), life: .14, cover: .15 });
        if (Math.random() < .45) kit.lightning(p, p.clone().add(kit.V(kit.rnd(-.7, .7), kit.rnd(-.25, .1), kit.rnd(-.3, .3))), { width: .025, branches: 1, life: .1, jag: .5 });
      }
    });
    return st;
  }
  T.spark = {
    generic: { wave: false },   // 脚下的冲击波自己画（groundWave），见上面的说明
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .15;
      crawlMon(kit, side, [10, 16, 24][t], life, { width: .02 + t * .006 });
      if (t === 2) ctx._storm = stormCloud(kit, ctx);
    },
    async release(kit, ctx) {
      const { a, b, tier: t } = ctx;
      if (t === 0) {
        // Spark Zap：手边先噼啪一下，一道细电弧、紧跟一道粗的
        kit.glow(a, { col: SP.y, size: .5, grow: 1.6, life: .26, cover: .2 });
        crawl(kit, () => a.clone(), .16, 30, .15, { width: .016 });
        await kit.sleep(70);
        kit.lightning(a, b, { width: .035, branches: 1, life: .13, jag: .34, cover: .7 });
        await kit.sleep(80);
        kit.lightning(a, b, { width: .065, branches: 3, life: .22, jag: .26, cover: .7 });
        kit.glow(b, { col: SP.y, size: .9, life: .2, cover: .2 });
        await kit.sleep(25);
      } else if (t === 1) {
        // Bolt Beam：手前聚起一团电球，然后一根粗光束 + 两根缠着它的电弧
        // 电球放在身前、偏上、往画面右边挪一点（过肩镜头里不被自己的身子挡住）
        const ball = a.clone().addScaledVector(ctx.dir, .3).add(kit.V(0, .15, 0)).addScaledVector(basis(kit, a).r, .3);
        kit.glow(ball, { col: SP.y, size: .7, grow: 2.2, life: .3, cover: .45 });
        crawl(kit, () => ball.clone(), .3, 40, .28, { width: .024 });
        inward(kit, ball, 1, 20, .24, [SP.y, SP.w], { tex: 'star', size: .22 });
        await kit.sleep(230);
        kit.energyBeam(ball, b, { col: SP.y, col2: SP.w, width: .32, life: .48, grow: .13, noise: 1.3, cover: .78 });
        for (let i = 0; i < 2; i++) kit.lightning(ball, b, { width: .036, branches: 2, life: .42, jag: .2, rate: .045, cover: .7 });
        kit.glow(ball, { col: SP.w, size: 1.1, life: .25, cover: .1 });
        kit.light(ball, { col: SP.y, intensity: 7, life: .35 });
        kit.shake(.1);
        await kit.sleep(70);
      } else {
        // Storm Strike：雷云（蓄力时已经聚好）→ 锁定圈 → 三道试探雷落在周围 → 一道巨雷劈在对手身上
        const st = ctx._storm || (ctx._storm = stormCloud(kit, ctx)), top = st.top, feet = kit.feet(ctx.other);
        camFrame(kit, ctx, { k: .12, kNear: .03, lk: .55, lookUp: .75, up: .15, fov: 44, ms: 420 });
        kit.groundCircle(ctx.other, { col: SP.y, col2: SP.w, r: 1.05, life: 1.2, spin: 2.6 });
        const n = qn(kit, 3);
        for (let i = 0; i < n; i++) {
          const an = (i / n + Math.random() * .2) * 6.28, rr = kit.rnd(.85, 1.3), g = feet.clone().add(kit.V(Math.cos(an) * rr, .02, Math.sin(an) * rr));
          kit.lightning(top.clone().add(kit.V(kit.rnd(-.7, .7), 0, kit.rnd(-.4, .4))), g, { width: .045, branches: 3, life: .2, jag: .2 });
          kit.shockwave(g.clone().setY(.1), { col: SP.y, r0: .05, r1: .65, life: .28, thick: .1, cover: .45 });
          sparks(kit, g.clone().setY(.15), 9, 3);
          kit.sfx('spark', 'impact', 0);
          kit.shake(.08);
          await kit.sleep(115);
        }
        await kit.sleep(70);
        // 巨雷：两根粗的黄色闪电 + 一根白芯，云里亮一大团，落点一团黄光
        st.boom();
        const nk = nearK(ctx);
        kit.lightning(top, b, { width: .14 * nk, branches: 7, life: .4, jag: .2, rate: .05, cover: .7 });
        kit.lightning(top.clone().add(kit.V(.25, 0, 0)), b, { width: .09 * nk, branches: 3, life: .32, jag: .26, rate: .07, cover: .7 });
        kit.lightning(top, b, { col: SP.w, col2: SP.w, width: .045 * nk, branches: 1, life: .26, jag: .18, rate: .06, cover: .4 });
        kit.glow(feet.clone().setY(.3), { col: SP.y, size: 1.5, life: .3, cover: .4 });
        kit.flash('#fff6c8', { strength: .32, ms: 200 });
        kit.light(b, { col: SP.y, intensity: 14, life: .45 });
        kit.shake(.35);
        await kit.sleep(35);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      groundWave(kit, ctx, SP.y, SP.w);
      crawlMon(kit, other, [16, 20, 22][t], [.32, .5, .85][t], { width: .022 + t * .006 });
      sparks(kit, b, [14, 24, 40][t], 3 + t, { s: 1 + t * .2 });
      if (t === 2) {
        // 地面上的电弧往四周窜开
        const f = kit.feet(other).setY(.12), n = qn(kit, 6), a0 = Math.random() * 6.28;
        for (let i = 0; i < n; i++) { const an = a0 + i / n * 6.28, r = kit.rnd(1.3, 1.9); kit.lightning(f, f.clone().add(kit.V(Math.cos(an) * r, 0, Math.sin(an) * r)), { width: .04, branches: 2, life: .32, jag: .3, rate: .06 }); }
      }
    },
    async after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t >= 1) kit.decal(kit.feet(other), { kind: 'scorch', col: SP.amb, col2: SP.y, r: t === 2 ? 1.25 : .6, life: t === 2 ? 2.6 : 1.6 });
      if (t === 2) { await kit.sleep(250); if (ctx._storm) ctx._storm.end(); }
    },
  };

  // ======================================================================
  // 超能 psychic：粉色波纹、星星、托起对手；大招把对手托上半空画出星座再收拢摔下
  // ======================================================================
  // 头顶转的光环（陀螺仪一样斜着转），n 个
  function halos(kit, side, n, life) {
    const T3 = kit.T3, g = kit.geo('en_halo', () => new T3.TorusGeometry(1, .045, 6, 48)), m = kit.mon(side);
    if (!m) return;
    for (let i = 0; i < n; i++) {
      const r = new T3.Mesh(g, kit.glowMat(i % 2 ? PS.v : PS.p, .9, false)), tilt = .35 + i * .45, sp = (i % 2 ? -1 : 1) * (4 + i * 1.5), ph = Math.random() * 6.28;
      r.renderOrder = 2;
      kit.addFx(r, life, (o, k) => {
        o.position.copy(headOf(kit, side)); o.position.y += m.height * (.12 + i * .06);
        const s = m.height * (.36 + .1 * i) * kit.EZ.out(Math.min(1, k * 4));
        o.scale.set(s, s, s);
        o.rotation.set(Math.PI / 2 + tilt, ph + k * life * sp, 0, 'YXZ');
        o.material.opacity = .85 * (k > .8 ? (1 - k) / .2 : 1);
      });
    }
  }
  // 一圈波纹：shock 方片转成垂直于飞行方向，从 a 飞到 b（路上越变越大）
  function waveRing(kit, a, b, ms, o) {
    const m = kit.shockwave(a, { col: o.col, col2: o.col2, r0: o.r0 || .2, r1: o.r1 || .75, life: o.life || .55, thick: o.thick || .08, cover: o.cover == null ? .6 : o.cover });
    m.quaternion.setFromUnitVectors(kit.V(0, 0, 1), b.clone().sub(a).normalize());
    kit.tween(ms, k => { m.position.lerpVectors(a, b, k); });
    return m;
  }
  T.psychic = {
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .2;
      halos(kit, side, 1 + t, life + .1);
      twinkle(kit, () => headOf(kit, side), .55, [5, 9, 15][t], life, [PS.w, PS.l, PS.p]);
    },
    async release(kit, ctx) {
      const { a, b, tier: t } = ctx;
      if (t === 0) {
        // Mind Poke：额头射出一颗意念光点，身后留下一串小波纹
        const s = headOf(kit, ctx.side, ctx.dir), o = kit.orb(PS.p, .07);
        kit.trail(() => o.parent && o.position, { col: PS.p, col2: PS.l, width: .16, life: .16, cover: .55 });
        kit.glow(s, { col: PS.p, size: .55, life: .22, cover: .3 });
        let nx = 0;
        await kit.fly(s, b, 220, o, (p, k) => { if (k >= nx) { nx += .28; kit.shockwave(p, { col: nx > .5 ? PS.v : PS.p, flat: false, r0: .08, r1: .34, life: .24, thick: .08, cover: .65, push: 0 }); } }, { arc: .06 });
      } else if (t === 1) {
        // Dream Wave：一圈圈粉紫色的波纹涌过去，路上撒着星光；第三圈打到时算命中
        const s = headOf(kit, ctx.side, ctx.dir), n = qn(kit, 6), cols = [PS.p, PS.v, PS.l];
        kit.glow(s, { col: PS.p, size: .7, life: .5, cover: .25 });
        twinkle(kit, () => s.clone().lerp(b, Math.random()), .25, 16, .5, [PS.w, PS.l, PS.c], { up: .1 });
        const MS = 300, GAP = 62;
        for (let i = 0; i < n; i++) {
          waveRing(kit, s, b, MS, { col: cols[i % 3], col2: PS.l, r0: .2, r1: .62 + (i % 2) * .12, life: .5, thick: .075 });
          if (i < n - 1) await kit.sleep(GAP);
        }
        await kit.sleep(Math.max(40, MS + Math.min(2, n - 1) * GAP - (n - 1) * GAP));
      } else {
        // Star Mind：对手被托上半空，四周一颗颗亮起星星、连成星座 → 星座收拢 → 摔回地面
        const tm = kit.mon(ctx.other), off = tm.off, y0 = off.y, LIFT = kit.RM ? 0 : .55;   // 减少动态效果时不把对手托起来
        camFrame(kit, ctx, { k: .16, kNear: .05, lk: .62, lookUp: .5, fov: 41, ms: 420 });
        kit.groundCircle(ctx.other, { col: PS.p, col2: PS.l, runes: true, r: 1.15, life: 1.2, spin: 1.8, cover: .45 });
        kit.decal(kit.feet(ctx.other), { kind: 'glow', col: PS.p, r: 1, life: 1.2 });
        const cen = () => kit.center(ctx.other);
        let live = true;
        try {
          kit.tween(340, k => { off.y = y0 + LIFT * kit.EZ.out(k); });
          const N = qn(kit, 6), R = Math.max(.8, tm.height * .9), bs = basis(kit, cen(), home(kit).pos), a0 = Math.random() * 6.28;
          const S = [], P = [], beams = [];
          for (let i = 0; i < N; i++) { const an = a0 + i / N * 6.28 + kit.rnd(-.25, .25), rr = R * kit.rnd(.85, 1.15); S.push([Math.cos(an) * rr, Math.sin(an) * rr * .8 + .2]); P.push(kit.V(0, 0, 0)); }
          let fold = 0;
          const upd = () => { const c = cen(), f = 1 - fold; for (let i = 0; i < N; i++) P[i].copy(c).addScaledVector(bs.r, S[i][0] * f).addScaledVector(bs.u, S[i][1] * f); };
          upd();
          // 每帧：星星跟着对手（它在往上浮）、星座收拢，连线跟着星星走；顺便撒星光
          let tw = 0;
          tick(kit, 1.2, (k, dt) => {
            if (!live) return true;
            upd();
            beams.forEach(([m, i, j]) => { if (m.parent) { m.material.uniforms.uA.value.copy(P[i]); m.material.uniforms.uB.value.copy(P[j]); } });
            tw -= dt;
            if (tw <= 0) { tw = .05; const p = P[Math.floor(Math.random() * N)]; kit.emit(1, () => ({ pos: p.clone(), vel: kit.sph(.3), col: pick([PS.w, PS.l, PS.p]), size: .42, life: .28, grow: .2, tex: 'star', spin: 5, cover: .3 })); }
          });
          // 星星：白芯小球（一直亮到收拢完）+ 粉色光晕；连线：粉色细光束，一根根「画」出来
          const T_COL = 430, T_END = 640, STEP = 55;
          for (let i = 0; i <= N; i++) {
            const t0 = i * STEP, j = i % N;
            if (i < N) {
              const o = kit.orb(PS.w, .055);
              kit.addFx(o, 1.2, q => { q.position.copy(P[j]); q.scale.setScalar(1 + .25 * Math.sin(tw * 60 + j)); return !live; });
              kit.glow(P[j], { col: PS.p, size: .7, life: (T_END - t0) / 1000, follow: () => P[j], cover: .35 });
              kit.impactStar(P[j], { col: PS.p, col2: PS.w, size: .55, spikes: 4, life: .26, push: .2 });
            }
            if (i) { const L = (T_END + 40 - t0) / 1000; beams.push([kit.energyBeam(P[i - 1], P[j], { col: PS.p, col2: PS.l, width: .09, life: L, grow: .07 / L, taper: .1, noise: .35, cover: .75 }), i - 1, j]); }
            if (i < N) await kit.sleep(STEP);
          }
          await kit.sleep(T_COL - N * STEP);
          // 收拢：星星往中间缩，一圈光往里收
          kit.shockwave(cen(), { col: PS.p, col2: PS.l, flat: false, r0: R * 1.5, r1: .15, life: .22, thick: .12, cover: .6, push: .2 });
          await kit.tween(T_END - T_COL, k => { fold = k * k; });
          live = false;
          // 摔回地面
          await kit.tween(80, k => { off.y = y0 + LIFT * (1 - k * k); });
        } finally { live = false; off.y = y0; }
        kit.flash('#ffd6ea', { strength: .3, ms: 240 });
        kit.shake(.3);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx, cols = [PS.p, PS.v, PS.l];
      // 自己的命中星：粉色四角星（通用的白色命中星关掉了，大招时它和发光后期叠成一大团白）
      kit.impactStar(b, { col: PS.p, col2: PS.w, size: [.8, 1.05, 1.45][t], spikes: t === 2 ? 8 : 4, life: [.2, .26, .32][t], cover: .6 });
      // 一圈圈同心光环（超能的招牌）：用实心的细圆环——冲击波方片里面有一层淡光，几层叠起来再被发光后期一晕，会糊成一大团白
      const n = t === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) setTimeout(() => kit.ring(b, cols[i], .15, [.55, .85, 1.2][t] + i * [.3, .4, .45][t], .34 + t * .05, [.03, .035, .045][t], false).lookAt(kit.cam.position), i * 70);
      if (t) kit.shockwave(kit.feet(other).setY(.12), { col: PS.p, col2: PS.v, r0: .3, r1: t === 2 ? 2.3 : 1.5, life: t === 2 ? .5 : .42, thick: .12, cover: .6, opacity: .8 });
      kit.emit([8, 16, 30][t], () => ({ pos: b.clone().add(kit.sph(.2)), vel: kit.sph(kit.rnd(1.2, 3 + t)), col: pick([PS.w, PS.l, PS.p]), size: kit.rnd(.22, .4), life: kit.rnd(.3, .55), drag: 2.2, tex: 'star', spin: kit.rnd(-8, 8), cover: .35 }));
      // 梦境泡泡：淡彩色的光圈慢慢往上飘
      if (t) kit.emit(t === 2 ? 16 : 10, () => ({ pos: b.clone().add(kit.sph(kit.rnd(.3, .7))), vel: kit.V(kit.rnd(-.2, .2), kit.rnd(.4, .9), kit.rnd(-.2, .2)), col: pick([PS.p, PS.c, PS.v]), size: kit.rnd(.2, .36), life: kit.rnd(.7, 1.1), grow: 1.2, fade: .5, drag: .8, tex: 'ring', cover: .55 }));
    },
    after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t === 1) kit.decal(kit.feet(other), { kind: 'glow', col: PS.p, r: .8, life: 1.2 });
      if (t === 2) twinkle(kit, () => kit.center(other), .9, 12, .9, [PS.w, PS.l, PS.p], { up: .5 });
    },
    generic: { wave: false, star: false },   // 同心光环和粉色命中星自己画（见 groundWave 的说明）
  };

  // ======================================================================
  // 龙 dragon：靛紫 + 粉的龙焰、龙鳞（金粉闪光）、龙魂；大招龙魂盘旋俯冲
  // ======================================================================
  const moonGeo = kit => kit.geo('en_moon', () => crescentGeo(kit.T3, .5, .17));
  // 龙鳞碎片（压扁的八面体）
  const scaleGeo = kit => kit.geo('en_scale', () => new kit.T3.OctahedronGeometry(.07, 0).scale(1.2, .35, 1));
  // 龙鳞金粉：在 at 附近往上飘的小星星
  const scaleGlints = (kit, at, n, life) => kit.emit(n, () => ({ pos: at.clone().add(kit.sph(kit.rnd(.3, .7))), vel: kit.V(kit.rnd(-.3, .3), kit.rnd(.5, 1.2), kit.rnd(-.3, .3)), col: pick([DR.g, DR.l, DR.p]), size: kit.rnd(.16, .28), life: life * kit.rnd(.6, 1), grow: .3, fade: .3, tex: 'star', spin: kit.rnd(-6, 6), cover: .35 }));
  // 一圈紫粉龙焰（围着 at 一圈）
  function flameRing(kit, at, n, r, size, life, o) {
    o = o || {};
    const a0 = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      const an = a0 + i / n * 6.28 + kit.rnd(-.2, .2), rr = r * kit.rnd(.8, 1.15);
      kit.flame(at.clone().add(kit.V(Math.cos(an) * rr, 0, Math.sin(an) * rr)), { col: DR.v, col2: i % 3 ? DR.li : DR.p, size: size * kit.rnd(.8, 1.2), life: life * kit.rnd(.8, 1.1), rise: o.rise == null ? .2 : o.rise, cover: o.cover == null ? .6 : o.cover });
    }
  }
  // 月牙刃（面向镜头）：外圈粉、里面靛紫；返回 Group（交给 addFx 管）
  function moonBlade(kit, life, upd) {
    const T3 = kit.T3, g = moonGeo(kit), grp = new T3.Group();
    const outer = new T3.Mesh(g, kit.glowMat(DR.p, .95, false)), inner = new T3.Mesh(g, kit.glowMat(DR.v, 1, false)), core = new T3.Mesh(g, kit.glowMat('#ffffff', .9, true));
    outer.scale.set(1.05, 1.25, 1); core.scale.set(.9, .45, 1); core.position.y = .03;
    outer.renderOrder = 3; inner.renderOrder = 4; core.renderOrder = 5;
    grp.add(outer, inner, core);
    grp.children.forEach(c => { c.frustumCulled = false; });
    kit.addFx(grp, life, upd);
    return grp;
  }
  // 龙魂：沿着曲线 curve 飞的一条龙。身子是一串首尾相接的着色器光束（头粗尾细，每帧沿曲线往后排），
  // 比拖尾带「实」、颜色不会被白芯盖住；头是一团粉色亮光，两根金色龙须，一路掉金粉、拖着紫粉的火鬃。
  // 返回 { at(u) 把龙头放到曲线 u（0–1）处, dive() 撞上之后身子继续钻进终点（后台跑完自己清掉）}
  function serpent(kit, curve) {
    const V = kit.V, NS = kit.q === 'low' ? 10 : 12, LEN = .24, P = [], beams = [], head = V(0, 0, 0), tan = V(0, 0, 1), wv = V(0, 0, 0), wl = V(0, 0, 0), wr = V(0, 0, 0), ext = V(0, 0, 0);
    // 按离镜头的远近调粗细 / 大小的倍数：4.5 远的时候是 1
    const dk = p => Math.max(.5, Math.min(1.35, kit.cam.position.distanceTo(p) / 4.5));
    let u = 0, live = true, gl = 0;
    for (let i = 0; i <= NS; i++) P.push(curve.getPointAt(0));
    const place = () => {
      for (let i = 0; i <= NS; i++) curve.getPointAt(Math.max(0, Math.min(1, u - LEN * i / NS)), P[i]);
      head.copy(P[0]);
      // 每段两头各往外多伸 25%，和相邻的段叠起来（光束两头会收细，不叠的话关节处一节一节地细下去）
      beams.forEach((m, i) => {
        if (!m.parent) return;
        const un = m.material.uniforms;
        ext.subVectors(P[i], P[i + 1]).multiplyScalar(.25);
        un.uA.value.copy(P[i + 1]).sub(ext); un.uB.value.copy(P[i]).add(ext);
        m.visible = ext.lengthSq() > 1e-7;
        m.userData.wk = dk(P[i]);   // 离镜头近的那几节细一点（别糊满画面），飞远了粗一点（别缩成天上一根小线）
      });
    };
    for (let i = 0; i < NS; i++) beams.push(kit.energyBeam(P[i + 1], P[i], { col: DR.v, col2: i % 2 ? DR.d : DR.d2, width: .16 + .6 * Math.pow(1 - i / NS, 1.2), life: 1.15, grow: 0, taper: .01, noise: .8, cover: .9 }));
    if (kit.q !== 'low') {
      kit.trail(() => live && wl, { col: DR.g, col2: '#ffffff', width: .07, life: .2, cover: .45, max: 2 });
      kit.trail(() => live && wr, { col: DR.g, col2: '#ffffff', width: .07, life: .2, cover: .45, max: 2 });
    }
    // 龙头和头上的光也按远近缩放。龙头要先登记：特效每帧从后往前更新，后登记的光晕先更新（设好自己的大小），龙头再把它乘上倍数
    const hd = kit.orb(DR.p, .17);
    let hg = null;
    kit.addFx(hd, 2, o => { o.position.copy(head); const s = dk(head); o.scale.setScalar(s); if (hg && hg.parent) hg.scale.multiplyScalar(s); return !live; });
    hg = kit.glow(head, { col: DR.p, size: 1.1, life: 1.1, follow: () => live && head, cover: .35 });
    place();
    return {
      at(v) {
        u = v; place();
        curve.getTangentAt(Math.min(1, u), tan);
        wv.crossVectors(tan, V(0, 1, 0)); if (wv.lengthSq() < 1e-4) wv.set(1, 0, 0); wv.normalize();
        wl.copy(head).addScaledVector(wv, .17); wl.y += .07; wr.copy(head).addScaledVector(wv, -.17); wr.y += .07;
        // 火鬃（往后飘的紫粉火）+ 金粉
        kit.emit(1, () => ({ pos: head.clone().add(kit.sph(.08)), vel: tan.clone().multiplyScalar(-.6).add(kit.sph(.3)), col: pick([DR.p, DR.v, DR.l]), size: kit.rnd(.3, .45), life: .3, grow: 1.6, tex: 'smoke', spin: kit.rnd(-3, 3), cover: .6 }));
        if (u >= gl) { gl += .06; kit.emit(2, () => ({ pos: head.clone().add(kit.sph(.2)), vel: kit.sph(.5), col: pick([DR.g, DR.l, DR.p]), size: .2, life: .45, grow: .3, tex: 'star', spin: 7, cover: .35 })); }
      },
      dive() {
        live = false;
        const u0 = u;
        kit.tween(160, k => { u = u0 + LEN * k; place(); }).then(() => beams.forEach(m => { if (m.parent) m.visible = false; }));
      },
    };
  }
  T.dragon = {
    generic: { wave: false },   // 脚下的冲击波自己画（groundWave），见上面的说明
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .2, h = hOf(kit, side);
      flameRing(kit, kit.feet(side), qn(kit, [2, 4, 6][t]), h * .45 + .2, .45 + t * .12, life, { rise: .25 });
      scaleGlints(kit, kit.center(side), [6, 10, 18][t], life);
    },
    async release(kit, ctx) {
      const { a, b, tier: t } = ctx, { V } = kit;
      if (t === 0) {
        // Scale Swipe：一道月牙刃（凸的一边朝前）飞过去，路上掉龙鳞金粉
        const ang = screenAng(kit, a, b) - Math.PI / 2, size = .5;
        const blade = moonBlade(kit, .6, (o, k) => { face(kit, o, ang); o.scale.setScalar(size * (.5 + .5 * kit.EZ.out(Math.min(1, k * 5)))); });
        kit.trail(() => blade.parent && blade.position, { col: DR.v, col2: DR.p, width: .42, life: .13, cover: .55 });
        await kit.fly(a, b, 230, blade, p => kit.emit(2, () => ({ pos: p.clone().add(kit.sph(.15)), vel: kit.sph(.6), col: pick([DR.g, DR.p]), size: .18, life: .35, tex: 'star', spin: 8, cover: .35 })), { arc: .08 });
      } else if (t === 1) {
        // Drake Flame：嘴边先亮，然后喷出一股紫粉龙焰
        const m = headOf(kit, ctx.side, ctx.dir), d = b.clone().sub(m);
        kit.glow(m, { col: DR.p, size: .45, grow: 2, life: .3, cover: .3 });
        inward(kit, m, .8, 14, .12, [DR.p, DR.v, DR.g], { size: .22 });
        await kit.sleep(120);
        kit.energyBeam(m, b, { col: DR.v, col2: DR.li, width: .44, life: .62, grow: .21, noise: 1.8, taper: .35, cover: .75 });
        tick(kit, .42, () => { kit.emit(3, () => ({ pos: m.clone().add(kit.sph(.06)), vel: d.clone().multiplyScalar(kit.rnd(1.7, 2.3)).add(kit.sph(.5)), col: pick([DR.v, DR.p, DR.l]), size: kit.rnd(.4, .6), life: kit.rnd(.4, .55), grow: 1.8, drag: .4, tex: 'smoke', spin: kit.rnd(-3, 3), cover: .55 })); });
        kit.light(m, { col: DR.p, intensity: 7, life: .5 });
        await kit.sleep(140);
      } else {
        // Legend Roar：先吼出两圈声波，然后龙魂从身后盘旋升起、越过场地、螺旋俯冲到对手身上
        // 镜头一开始就往后拉（整条弧线都在画面里）；我方出招时龙魂从离镜头远的那一侧升起（第二个点换到另一侧：过肩机位就在我方身后右边，
        // 从镜头这一侧升起会贴着镜头掠过去，画面被一大团白粉色的身子填满）；身子离镜头近的几节变细（serpent 里按距离调）
        camFrame(kit, ctx, { k: -.03, kNear: -.02, lk: .4, lookUp: .6, up: .25, fov: 44, ms: 480 });
        const m = headOf(kit, ctx.side, ctx.dir);
        for (let i = 0; i < 2; i++) {
          kit.shockwave(m, { col: DR.v, col2: DR.p, flat: false, r0: .15, r1: .85 + i * .4, life: .32, thick: .1, cover: .7, push: .25 });
          if (!i) kit.shake(.16);
          await kit.sleep(60);
        }
        const A = kit.center(ctx.side), B = kit.center(ctx.other), d = ctx.dir.clone(), s = V(-d.z, 0, d.x), mid = A.clone().lerp(B, .5), hb = hOf(kit, ctx.other), sg = ctx.side === 'me' ? -1 : 1;
        const curve = new kit.T3.CatmullRomCurve3([
          A.clone().addScaledVector(d, -.6).add(V(0, -.2, 0)),
          A.clone().addScaledVector(s, .85 * sg).add(V(0, .5, 0)),
          A.clone().addScaledVector(d, -.25).addScaledVector(s, -.6).add(V(0, 1.15, 0)),
          mid.clone().addScaledVector(s, .45).add(V(0, 1.55, 0)),
          B.clone().addScaledVector(s, -.75).addScaledVector(d, -.2).add(V(0, Math.max(1.1, hb * 1.1), 0)),
          B.clone().addScaledVector(s, .5).addScaledVector(d, .15).add(V(0, .5, 0)),
          B.clone(),
        ], false, 'centripetal');
        const sn = serpent(kit, curve);
        await kit.tween(700, k => sn.at(Math.min(1, .45 * k + .55 * k * k)));
        sn.dive();
        kit.light(b, { col: DR.p, intensity: 12, life: .45 });
        kit.shake(.32);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx, f = kit.feet(other);
      groundWave(kit, ctx, DR.v, DR.p);
      if (t === 0) {
        // 命中处一道更大的月牙一闪 + 龙鳞碎片
        const ang = Math.random() * 6.28, sz = .75;
        moonBlade(kit, .22, (o, k) => { o.position.copy(b); face(kit, o, ang); o.scale.set(sz * (1 + k * .3), sz * (1 - k * .6), 1); o.children.forEach(c => { c.material.opacity = (1 - k) * .95; }); });
        kit.chunks(() => scaleGeo(kit), pick([DR.v, DR.p]), qn(kit, 6), b, .15, .7);
        scaleGlints(kit, b, 10, .5);
        return;
      }
      // 龙焰围成一圈烧（半径比对手大一点：围着它，不把它整个盖住）
      flameRing(kit, f, qn(kit, t === 2 ? 7 : 5), (t === 2 ? .85 : .5) * nearK(ctx) + .1, (t === 2 ? .85 : .75) * nearK(ctx), t === 2 ? .75 : .65, { cover: .78 });
      if (t === 1) kit.flame(f.clone().add(kit.cam.position.clone().sub(f).setY(0).normalize().multiplyScalar(.3)), { col: DR.v, col2: DR.li, size: .8, life: .5, push: .35, cover: .75 });
      puff(kit, b, [DR.v, DR.d, DR.li], t === 2 ? 10 : 7, 1.6, .45, .5, { up: 1.2, cover: .8 });
      kit.emit(t === 2 ? 30 : 14, () => ({ pos: f.clone().add(kit.V(kit.rnd(-.6, .6), kit.rnd(0, .3), kit.rnd(-.6, .6))), vel: kit.V(kit.rnd(-.4, .4), kit.rnd(1.2, 2.6), kit.rnd(-.4, .4)), col: pick([DR.p, DR.g, DR.l]), size: kit.rnd(.12, .22), life: kit.rnd(.6, 1), drag: .6, cover: .2 }));
      if (t === 2) {
        kit.chunks(() => scaleGeo(kit), pick([DR.v, DR.p, DR.g]), qn(kit, 12), b, .2, .9, () => kit.sph(kit.rnd(1.5, 3)).setY(kit.rnd(2, 4)));
        scaleGlints(kit, b, 20, .8);
      }
    },
    after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t === 1) kit.decal(kit.feet(other), { kind: 'scorch', col: DR.v, col2: DR.p, r: .75, life: 1.8 });
      if (t === 2) kit.decal(kit.feet(other), { kind: 'scorch', col: DR.v, col2: DR.p, r: 1.1, life: 2.4 });
    },
  };

  // ======================================================================
  // 幽灵 ghost：黑紫影子、青色鬼火、忽隐忽现；大招入夜、影沼里伸出影子之手
  // ======================================================================
  // 往上飘的黑紫烟丝（围着 side 的脚下）
  function wisps(kit, side, n, life) {
    const f = kit.feet(side), r = hOf(kit, side) * .45 + .2;
    kit.emit(n, () => { const an = kit.rnd(0, 6.28), rr = r * kit.rnd(.6, 1.1); return { pos: f.clone().add(kit.V(Math.cos(an) * rr, kit.rnd(0, .4), Math.sin(an) * rr)), vel: kit.V(kit.rnd(-.15, .15), kit.rnd(.6, 1.3), kit.rnd(-.15, .15)), col: pick([GH.s, GH.d, GH.v]), size: kit.rnd(.4, .7), life: life * kit.rnd(.7, 1.1), grow: 1.5, fade: .2, drag: .4, tex: 'smoke', spin: kit.rnd(-2, 2), cover: .85, alpha: .85 }; });
  }
  // 青色鬼火绕着 getC() 转：n 团、半径 r
  function spirits(kit, getC, n, r, life, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const ph = i / n * 6.28, sp = (o.sp || 4) * (1 + i * .15), tilt = kit.rnd(-.3, .3), p = kit.V(0, 0, 0);
      let t = 0;
      const pos = () => { const c = getC(); if (!c) return null; const an = ph + t * sp; return p.copy(c).add(kit.V(Math.cos(an) * r, Math.sin(an * 1.3) * .15 + tilt * Math.sin(an) * r, Math.sin(an) * r)); };
      tick(kit, life, (k, dt) => { t += dt; });
      pos();
      kit.glow(p, { col: GH.c, size: o.size || .32, life, follow: pos, cover: .35 });
      kit.trail(pos, { col: GH.c, col2: '#ffffff', width: .07, life: .18, max: life, cover: .4 });
    }
  }
  // 忽隐忽现：怪兽隐身一下下（减少动态效果时不做）
  function blink(kit, side, times, life) {
    const m = kit.mon(side); if (!m || kit.RM || !m.root.visible) return;
    const root = m.root, at = [];
    for (let i = 0; i < times; i++) at.push(.3 + i * .3);
    tick(kit, life, k => { root.visible = !at.some(x => k >= x && k < x + .07); }, () => { root.visible = true; });
  }
  // 影沼（大招，蓄力时就开始）：对手脚下一片黑紫的影子水洼 + 符文圈，冒黑烟；返回 { end() }
  function shadowPool(kit, ctx) {
    const st = { done: false, end() { st.done = true; } }, f = kit.feet(ctx.other), r = 1.25;
    kit.decal(f, { kind: 'splash', col: GH.s, col2: GH.v, r, life: 3.2 });
    kit.groundCircle(ctx.other, { col: GH.v, col2: GH.c, runes: true, r: 1.15, life: 2.6, spin: -.8, cover: .5 });
    let acc = 0;
    tick(kit, 4, (k, dt) => {
      if (st.done) return true;
      acc += dt * 26 * (QN[kit.q] || 1);
      while (acc >= 1) { acc--; const an = kit.rnd(0, 6.28), rr = r * Math.sqrt(Math.random()); kit.emit(1, () => ({ pos: f.clone().add(kit.V(Math.cos(an) * rr, .05, Math.sin(an) * rr)), vel: kit.V(0, kit.rnd(.4, 1), 0), col: pick([GH.s, GH.d]), size: kit.rnd(.35, .6), life: kit.rnd(.5, .8), grow: 1.6, fade: .2, tex: 'smoke', spin: kit.rnd(-2, 2), cover: .85, alpha: .7 })); }
    });
    return st;
  }
  T.ghost = {
    generic: { wave: false },   // 脚下的冲击波自己画（groundWave），见上面的说明
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .2;
      wisps(kit, side, [8, 14, 22][t], life);
      spirits(kit, () => kit.center(side), t + 1, hOf(kit, side) * .55 + .15, life);
      if (t >= 1) blink(kit, side, t, life);
      if (t === 2) { kit.flash(GH.night, { strength: .4, ms: 1000 }); ctx._pool = shadowPool(kit, ctx); }
    },
    async release(kit, ctx) {
      const { a, b, tier: t } = ctx, { V } = kit, s = V(-ctx.dir.z, 0, ctx.dir.x);
      if (t === 0) {
        // Spooky Tap：一团鬼火摇摇晃晃地飘过去（左右摆、往上拱），身后拖着黑烟
        const o = kit.orb(GH.c, .075), p = a.clone(), sw = sgn();
        kit.addFx(o, 1, () => !o.userData.on);
        o.userData.on = true; o.position.copy(a);
        kit.glow(p, { col: GH.v, size: .7, life: .4, follow: () => o.userData.on && o.position, cover: .5 });
        kit.trail(() => o.userData.on && o.position, { col: GH.s, col2: GH.v, width: .22, life: .22, cover: .85 });
        await kit.tween(300, k => {
          p.lerpVectors(a, b, k).addScaledVector(s, Math.sin(k * Math.PI * 2) * .3 * sw * (1 - k)); p.y += Math.sin(k * Math.PI) * .28;
          o.position.copy(p);
          if (Math.random() < .5) kit.emit(1, () => ({ pos: p.clone(), vel: kit.V(0, .4, 0).add(kit.sph(.2)), col: pick([GH.s, GH.d]), size: .3, life: .35, grow: 1.6, tex: 'smoke', cover: .85 }));
        });
        o.userData.on = false;
      } else if (t === 1) {
        // Shadow Orb：身前聚起一颗暗影球（黑核 + 紫晕 + 鬼火绕着转），然后飞过去
        const T3 = kit.T3, at = a.clone().addScaledVector(ctx.dir, .2).add(V(0, .08, 0)), sg = sphG(kit);
        const orb = new T3.Group(), core = new T3.Mesh(sg, kit.glowMat(GH.s, .97)), rim = new T3.Mesh(sg, kit.glowMat(GH.v, .55, false)), hal = new T3.Mesh(sg, kit.glowMat(GH.l, .35, true));
        rim.scale.setScalar(1.22); hal.scale.setScalar(1.55); hal.renderOrder = 1; rim.renderOrder = 2; core.renderOrder = 3;
        orb.add(hal, rim, core); orb.position.copy(at);
        let R = 0;
        kit.addFx(orb, 1.2, (o, k) => { o.scale.setScalar(R * (1 + .06 * Math.sin(k * 60))); });
        inward(kit, at, .9, 16, .22, [GH.s, GH.d, GH.v], { size: .45, cover: .85 });
        spirits(kit, () => orb.parent && orb.position.clone(), 2, .4, .6, { size: .22, sp: 9 });
        await kit.tween(220, k => { R = .26 * kit.EZ.out(k); });
        // 身后拖一路黑紫烟（不用拖尾带：它有一道白芯，暗影球后面拖白线不对味）
        const lp = at.clone();
        await kit.fly(at, b, 290, orb, p => {
          const n = Math.min(5, Math.ceil(p.distanceTo(lp) / (.07 / (QN[kit.q] || 1))));
          for (let j = 1; j <= n; j++) { const q = lp.clone().lerp(p, j / n); kit.emit(1, () => ({ pos: q.add(kit.sph(.06)), vel: kit.sph(.25).add(kit.V(0, .25, 0)), col: pick([GH.s, GH.s, GH.d, GH.v]), size: kit.rnd(.35, .5), life: .38, grow: 1.4, fade: .3, tex: 'smoke', spin: kit.rnd(-2, 2), cover: .9 })); }
          lp.copy(p);
        }, { arc: .12 });
      } else {
        // Phantom Night：影沼（蓄力时已经铺好）里伸出几只影子之手，弯过来抓住对手；四周冒青紫鬼火
        const pool = ctx._pool || (ctx._pool = shadowPool(kit, ctx));
        camFrame(kit, ctx, { k: .14, kNear: .04, lk: .6, lookUp: .3, fov: 41, ms: 420 });
        const f = kit.feet(ctx.other), hb = hOf(kit, ctx.other), N = qn(kit, 6), R0 = 1.15, a0 = Math.random() * 6.28, DUR = 520;
        // 青紫鬼火：在影沼后面那半圈（不挡住对手）
        const away = Math.atan2(f.z - kit.cam.position.z, f.x - kit.cam.position.x);
        [-.75, 0, .75].slice(0, qn(kit, 3)).forEach((d, i) => kit.flame(f.clone().add(V(Math.cos(away + d) * R0 * .85, 0, Math.sin(away + d) * R0 * .85)), { col: GH.v, col2: GH.t, size: i === 1 ? .85 : .7, life: .9, rise: .15, cover: .85 }));
        for (let i = 0; i < N; i++) {
          const th = a0 + i / N * 6.28, cw = sgn() * .9, H = hb * .95 + .35, tip = V(0, 0, 0), last = V(0, 0, 0), st = { k: 0, on: true };
          const at = () => { const k = st.k, rr = R0 * (1 - .78 * kit.EZ.io(k)), an = th + cw * k; return tip.set(f.x + Math.cos(an) * rr, .05 + Math.sin(k * Math.PI * .72) * H, f.z + Math.sin(an) * rr); };
          last.copy(at());
          kit.glow(tip, { col: GH.c, size: .36, life: (DUR + 120) / 1000, follow: () => st.on && tip, cover: .45 });
          // 影子之手：指尖走过的地方每隔一小段留一团黑紫烟，连起来就是一条从地里伸出来、越往上越细的影子
          kit.tween(DUR - i * 25, k => {
            st.k = k; at();
            const d = tip.distanceTo(last), n = Math.min(6, Math.ceil(d / (.06 / (QN[kit.q] || 1))));
            for (let j = 1; j <= n; j++) { const p = last.clone().lerp(tip, j / n); kit.emit(1, () => ({ pos: p, vel: kit.sph(.1), col: Math.random() < .7 ? GH.s : GH.d, size: .5 - .28 * k, life: .42, grow: 1.15, fade: .45, tex: 'smoke', spin: kit.rnd(-2, 2), cover: .95, alpha: 1 })); }
            last.copy(tip);
          }).then(() => { st.on = false; });
          await kit.sleep(30);
        }
        await kit.sleep(DUR - N * 30 - 20);
        kit.light(b, { col: GH.c, intensity: 10, life: .45 });
        kit.shake(.28);
        if (pool) setTimeout(() => pool.end(), 250);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      groundWave(kit, ctx, GH.v, GH.c, { cover: .7 });
      // 黑烟一圈炸开 + 青色火星。大招的烟在身体外面一圈往外散、淡一点（以前 30 团 + 26 团浓黑烟，命中后半秒对手是一团黑）
      if (t < 2) puff(kit, b, [GH.s, GH.d, GH.v], [10, 22][t], 1.8 + t * .5, .45 + t * .1, .45 + t * .1, { cover: .88 });
      else {
        const hb = hOf(kit, other), vf = b.clone().sub(kit.cam.position).normalize();
        // 方向去掉朝镜头的分量：烟圈在屏幕上围着身体的轮廓，不挡在身前
        kit.emit(14, () => { const d = kit.sph(1); d.addScaledVector(vf, -d.dot(vf)); if (d.lengthSq() < 1e-4) d.set(0, 1, 0); d.normalize(); return { pos: b.clone().addScaledVector(d, kit.rnd(.5, .8) * hb), vel: d.multiplyScalar(kit.rnd(1.6, 2.6)), col: pick([GH.s, GH.d, GH.v]), size: kit.rnd(.5, .75), life: kit.rnd(.5, .7), grow: 1.8, fade: .1, drag: 2, tex: 'smoke', spin: kit.rnd(-1.5, 1.5), cover: .6 }; });
      }
      kit.emit([6, 12, 24][t], () => ({ pos: b.clone().add(kit.sph(.2)), vel: kit.sph(kit.rnd(1, 2.5 + t)), col: pick([GH.c, '#ffffff', GH.l]), size: kit.rnd(.14, .26), life: kit.rnd(.3, .55), drag: 2, tex: 'star', spin: kit.rnd(-8, 8), cover: .35 }));
      if (t < 2) kit.shockwave(b, { col: GH.v, col2: GH.l, flat: false, r0: .1, r1: [.7, 1.3][t], life: .3 + t * .05, thick: .09, cover: .6 });
      if (t === 2) {
        // 一圈黑烟从脚边往上冲（在身体外面一圈，不糊在身上）
        const f = kit.feet(other), rr = hOf(kit, other) * .45 + .3;
        kit.emit(12, () => { const an = kit.rnd(0, 6.28); return { pos: f.clone().add(kit.V(Math.cos(an) * rr, .1, Math.sin(an) * rr)), vel: kit.V(Math.cos(an) * .5, kit.rnd(2.5, 4.5), Math.sin(an) * .5), col: pick([GH.s, GH.d, GH.v]), size: kit.rnd(.45, .7), life: kit.rnd(.4, .6), grow: 1.6, drag: 1.4, tex: 'smoke', spin: kit.rnd(-2, 2), cover: .6, alpha: .85 }; });
      }
    },
    after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t === 0) return;
      // 几缕鬼魂般的光点慢慢飘上去
      const c = kit.center(other);
      kit.emit(t === 2 ? 14 : 6, () => ({ pos: c.clone().add(kit.sph(kit.rnd(.3, .8))), vel: kit.V(kit.rnd(-.15, .15), kit.rnd(.4, .8), kit.rnd(-.15, .15)), col: pick([GH.c, GH.l]), size: kit.rnd(.22, .36), life: kit.rnd(.8, 1.3), grow: .7, fade: .4, drag: .4, cover: .3 }));
      if (t === 2) kit.decal(kit.feet(other), { kind: 'splash', col: GH.s, col2: GH.v, r: 1, life: 1.6 });
    },
  };

  // ======================================================================
  // 恶 dark：墨黑斩痕 + 白色刀光 + 淡紫描边；獠牙；大招黑色日食 + 十字斩
  // ======================================================================
  // 斩痕：从左尖到右尖 0..2 的月牙（轴心在左尖，放大 x 就是「划出来」）
  const slashGeo = kit => kit.geo('en_slash', () => crescentGeo(kit.T3, .3, .1).translate(1, -.1, 0));
  // 一道斩痕（面向镜头）：at 中心、ang 屏幕上的角度、half 半长；先「划」出来（刀光一闪），停一下再变细淡掉
  function slashMark(kit, at, ang, half, o) {
    o = o || {};
    const T3 = kit.T3, g = slashGeo(kit), life = o.life || .55, grp = new T3.Group(), ax = kit.V(0, 0, 0);
    const mk = (col, op, add, ro) => { const m = new T3.Mesh(g, kit.glowMat(col, op, add)); m.renderOrder = ro; m.frustumCulled = false; grp.add(m); return m; };
    const edge = mk(o.edge || DK.l, .95, false, 3), core = mk(o.col || DK.b, 1, false, 4), glint = mk('#ffffff', 1, true, 5);
    edge.scale.set(1.04, 1.7, 1); edge.position.set(-.04, -.03, 0); glint.scale.set(.96, .45, 1); glint.position.set(.04, .02, 0);
    const pos = o.follow || (() => at);
    kit.addFx(grp, life, (q, k) => {
      face(kit, q, ang);
      ax.set(1, 0, 0).applyQuaternion(q.quaternion);
      // 早一点开始变细（.3 起），黑芯最多 .75 不透明：斩痕叠在对手身上，命中后 0.5 秒内要看得清是谁挨打了（FX_SPEC §6）
      const w = kit.EZ.out(Math.min(1, k / .14)), thin = k < .3 ? 1 : 1 - (k - .3) / .7;
      q.position.copy(pos()).addScaledVector(ax, -half);
      q.scale.set(half * w, half * (o.thick || 1) * (.35 + .65 * thin), 1);
      glint.material.opacity = Math.max(0, 1 - k / .35);
      core.material.opacity = Math.min(.75, thin * 1.6);
      edge.material.opacity = .95 * Math.min(1, thin * 1.4);
    });
    return grp;
  }
  // 一道刀光扫过（白芯拖尾 + 黑影拖尾），沿屏幕角度 ang 穿过 at，ms 毫秒
  async function sweep(kit, at, ang, half, ms) {
    const bs = basis(kit, at), ax = bs.r.clone().multiplyScalar(Math.cos(ang)).addScaledVector(bs.u, Math.sin(ang));
    const p0 = at.clone().addScaledVector(ax, -half * 1.35), p1 = at.clone().addScaledVector(ax, half * 1.35), head = p0.clone();
    let live = true;
    kit.trail(() => live && head, { col: DK.b, col2: DK.k, width: .34, life: .12, cover: .9, max: 1 });
    kit.trail(() => live && head, { col: '#ffffff', col2: DK.l, width: .12, life: .09, cover: .35, max: 1 });
    await kit.tween(ms, k => { head.lerpVectors(p0, p1, k).addScaledVector(bs.f, -Math.sin(k * Math.PI) * .25); });
    live = false;
  }
  // 黑色日食（大招，蓄力时就开始升起）：对手头上一个黑盘 + 白色亮边 + 淡紫日冕；返回 { pos, end(), drop(to, ms) }
  function eclipse(kit, ctx) {
    const T3 = kit.T3, b = kit.center(ctx.other), hb = hOf(kit, ctx.other), sg = sphG(kit), rimG = kit.geo('en_rim', () => new T3.TorusGeometry(1, .07, 6, 48));
    const P = kit.V(b.x, b.y + Math.max(1.25, hb * .95) + .35, b.z), R = .42;
    const grp = new T3.Group(), cor = new T3.Mesh(sg, kit.glowMat(DK.l, .55, false)), disc = new T3.Mesh(sg, kit.glowMat(DK.b, 1)), rim = new T3.Mesh(rimG, kit.glowMat('#ffffff', .95, true));
    cor.scale.setScalar(1.28); cor.renderOrder = 2; disc.renderOrder = 3; rim.renderOrder = 4;
    grp.add(cor, disc, rim);
    const st = { pos: P, done: false, s: 0, end() { st.done = true; } };
    let fade = 1, fl = 0;
    grp.position.copy(P);
    kit.addFx(grp, 5, (o, k, dt) => {
      if (st.done) { fade -= dt / .25; if (fade <= 0) return true; }
      st.s = Math.min(1, st.s + dt / .45);
      const s = R * kit.EZ.out(st.s) * (st.done ? fade : 1);
      o.scale.setScalar(Math.max(.001, s));
      rim.quaternion.copy(kit.cam.quaternion);
      cor.material.opacity = .55 * fade * (.85 + .15 * Math.sin(k * 40));
      fl -= dt;
      if (fl <= 0 && !st.done && st.s > .6) { fl = kit.rnd(.25, .4); kit.shockwave(o.position, { col: DK.l, col2: '#ffffff', flat: false, r0: R * 1.1, r1: R * 2.6, life: .35, thick: .06, cover: .45, push: -.05 }); }
    });
    st.grp = grp;
    st.drop = (to, ms) => kit.tween(ms, k => { grp.position.lerpVectors(P, to, k * k); });
    // 日食下面一圈往上飘的黑紫烟（暗下来的感觉）
    kit.emit(14, () => ({ pos: P.clone().add(kit.sph(R * 1.3)), vel: kit.sph(.25), col: pick([DK.b, DK.k]), size: kit.rnd(.4, .7), life: kit.rnd(.8, 1.2), grow: 1.5, fade: .2, tex: 'smoke', spin: kit.rnd(-1, 1), cover: .85, alpha: .7 }));
    return st;
  }
  // 獠牙：上排 4 颗往下、下排 3 颗往上，面向镜头；返回 { open 张开的进度, snap 合上的进度 }（0–1，外面改）
  function fangs(kit, at, size, life) {
    const T3 = kit.T3, cone = kit.geo('en_fang', () => new T3.ConeGeometry(.085, .36, 6)), moon = moonGeo(kit);
    const grp = new T3.Group(), up = new T3.Group(), lo = new T3.Group(), st = { open: 0, snap: 0 };
    // 牙用不受光的纯色（受光的话被地面的绿光一照会发绿）
    const tooth = (g, x, y, rz, s) => { const m = new T3.Mesh(cone, kit.glowMat('#fbf8ff', 1, false)); m.position.set(x, y, 0); m.rotation.z = rz; m.scale.setScalar(s); m.renderOrder = 2; g.add(m); return m; };
    // 牙床：上颚是往上拱的月牙、下颚翻过来往下拱；后面垫一圈淡紫描边
    const jaw = (g, upper) => { const sy = upper ? 1 : -1; const m = new T3.Mesh(moon, kit.glowMat(DK.b, .95)); m.scale.set(.62, .9 * sy, 1); m.renderOrder = 1; g.add(m); const e = new T3.Mesh(moon, kit.glowMat(DK.l, .9, false)); e.scale.set(.68, 1.25 * sy, 1); e.position.set(0, -.03 * sy, -.01); e.renderOrder = 0; g.add(e); };
    [-.33, -.11, .11, .33].forEach((x, i) => tooth(up, x, -.02 - (i === 0 || i === 3 ? .02 : 0), Math.PI + x * .6, i === 0 || i === 3 ? 1.25 : .9));
    [-.22, 0, .22].forEach((x, i) => tooth(lo, x, .02, -x * .6, i === 1 ? .8 : .95));
    jaw(up, true); jaw(lo, false);
    grp.add(up, lo);
    kit.addFx(grp, life, (o, k) => {
      o.position.copy(at); face(kit, o);
      const gap = .62 * st.open * (1 - st.snap) + .06;
      up.position.y = gap * .55 + .16; lo.position.y = -gap * .45 - .16;
      o.scale.setScalar(size * (.6 + .4 * st.open));
      const fd = k > .75 ? (1 - k) / .25 : 1;
      o.traverse(c => { if (c.material) c.material.opacity = .95 * fd; });
    });
    return st;
  }
  T.dark = {
    generic: { wave: false },   // 脚下的冲击波自己画（groundWave），见上面的说明
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .2;
      // 脚下贴地的黑烟
      const f = kit.feet(side), r = hOf(kit, side) * .5 + .25;
      kit.emit([8, 14, 20][t], () => { const an = kit.rnd(0, 6.28); return { pos: f.clone().add(kit.V(Math.cos(an) * r, .08, Math.sin(an) * r)), vel: kit.V(-Math.cos(an) * .3, kit.rnd(.1, .4), -Math.sin(an) * .3), col: pick([DK.b, DK.k]), size: kit.rnd(.4, .65), life: life * kit.rnd(.7, 1), grow: 1.6, fade: .2, tex: 'smoke', spin: kit.rnd(-1.5, 1.5), cover: .85, alpha: .85 }; });
      // 眼里寒光一闪：只在脸朝着镜头的时候（我方过肩机位时镜头在它身后，星星会画到后脑勺上）
      if (t >= 1) kit.sleep(life * 650).then(() => {
        if (!kit.mon(side)) return;
        const e = headOf(kit, side, ctx.dir), toCam = kit.cam.position.clone().sub(e).setY(0).normalize();
        if (toCam.dot(ctx.dir) > .2) kit.impactStar(e, { col: '#ffffff', col2: DK.l, size: .5, spikes: 4, life: .26, push: .15 });
      });
      if (t === 2) { kit.flash(DK.night, { strength: .4, ms: 1000 }); ctx._ecl = eclipse(kit, ctx); }
    },
    async release(kit, ctx) {
      const { b, tier: t } = ctx, hb = hOf(kit, ctx.other);
      if (t === 0) {
        // Sneak Swipe：对手身边冒一下黑影，一道黑影刀光斜着掠过，留下一道斩痕
        const fb = front(kit, b, hb * .55 + .1);
        puff(kit, b.clone().add(kit.sph(.4)), [DK.b, DK.k], 6, .6, .45, .35, { cover: .85 });
        await kit.sleep(60);
        const ang = kit.rnd(.45, .75) * sgn(), half = Math.max(.55, hb * .6) * nearK(ctx);
        await sweep(kit, fb, ang, half, 110);
        slashMark(kit, fb, ang, half, { life: .5 });
      } else if (t === 1) {
        // Night Fang：上下两排獠牙张开、一口咬合
        const at = front(kit, b, hb * .55 + .15), st = fangs(kit, at, Math.max(1, hb * 1.15) * nearK(ctx), .62);
        kit.glow(at, { col: DK.l, size: 1.4, life: .35, cover: .3 });
        await kit.tween(150, k => { st.open = kit.EZ.out(k); });
        await kit.sleep(40);
        await kit.tween(110, k => { st.snap = k * k * k; });
        kit.shake(.16);
      } else {
        // Dark Eclipse：日食（蓄力时已升起）→ 四道斩痕交叉劈下 → 日食砸下来、一个巨大的十字斩
        const ecl = ctx._ecl || (ctx._ecl = eclipse(kit, ctx));
        camFrame(kit, ctx, { k: .12, kNear: .03, lk: .6, lookUp: .55, fov: 43, ms: 420 });
        const half = Math.max(.75, hb * .8) * nearK(ctx), base = Math.random() * 3.14, angs = [.62, -.62, 1.45, -.1].map(x => x + base * .1), fb = front(kit, b, hb * .55 + .1);
        for (let i = 0; i < 4; i++) {
          const p = fb.clone().add(kit.sph(.12));
          await sweep(kit, p, angs[i], half, 85);
          slashMark(kit, p, angs[i], half, { life: .55 - i * .05 });   // 命中后很快淡掉（最后一道命中后约 0.25 秒就没了）
          kit.sfx('dark', 'impact', 0);
          kit.shake(.1);
          kit.emit(6, () => ({ pos: p.clone(), vel: kit.sph(kit.rnd(1.5, 3)), col: pick([DK.l, '#ffffff']), size: .2, life: .3, tex: 'star', spin: 9, cover: .35 }));
          await kit.sleep(25);
        }
        await ecl.drop(b, 130);
        ecl.end();
        // 最后的大十字斩：短一点、细一点（以前命中后 0.4 秒还把对手整个盖住）
        slashMark(kit, fb, .78, half * 1.2, { life: .36, thick: 1.1 });
        slashMark(kit, fb, -.78, half * 1.2, { life: .36, thick: 1.1 });
        kit.light(b, { col: DK.l, intensity: 10, life: .4 });
        kit.shake(.34);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx;
      groundWave(kit, ctx, DK.k, DK.l, { cover: .85 });
      puff(kit, b, [DK.b, DK.k], [6, 12, 26][t], 1.4 + t * .6, .4 + t * .12, .4 + t * .1, { cover: .9 });
      kit.emit([8, 14, 26][t], () => ({ pos: b.clone().add(kit.sph(.2)), vel: kit.sph(kit.rnd(1.5, 3 + t)), col: pick([DK.l, '#ffffff', DK.l]), size: kit.rnd(.14, .26), life: kit.rnd(.25, .45), drag: 2, tex: 'star', spin: kit.rnd(-10, 10), cover: .35 }));
      if (t >= 1) {
        kit.chunks(() => kit.geo('en_shard', () => new kit.T3.OctahedronGeometry(.06, 0).scale(.6, 1.6, .6)), DK.b, qn(kit, t === 2 ? 10 : 6), b, .2, .8);
      }
    },
    after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t === 2) kit.decal(kit.feet(other), { kind: 'crack', col: DK.k, r: 1.25, life: 2.4 });
      else if (t === 1) kit.decal(kit.feet(other), { kind: 'crack', col: DK.k, r: .6, life: 1.4 });
    },
  };

  // ======================================================================
  // 毒 poison：品紫毒液、泡泡、毒雾、水洼；大招毒沼冒泡 + 毒雾旋风 → 泡泡一起爆开
  // ======================================================================
  // 毒液团：深紫的卡通小球 + 左上一点白色高光（黏糊糊、亮晶晶）
  function blobMesh(kit, col, s) {
    const m = new kit.T3.Mesh(sphG(kit), kit.toonMat(col, { emissive: PO.em }));
    const hl = new kit.T3.Mesh(sphG(kit), kit.glowMat('#ffffff', .85, false)); hl.scale.setScalar(.24); hl.position.set(-.38, .42, .5); m.add(hl);
    m.scale.setScalar(s);
    return m;
  }
  // 溅开：往外飞、往下掉的毒液点（不透明的深紫，亮背景上看得清）
  function splash(kit, at, n, sp, o) {
    o = o || {};
    kit.emit(n, () => ({ pos: at.clone().add(kit.sph(.08)), vel: kit.sph(kit.rnd(.5, 1) * sp).add(kit.V(0, sp * .55, 0)), col: pick([PO.goo, PO.d, PO.p]), size: kit.rnd(.16, .32) * (o.s || 1), life: kit.rnd(.35, .6), grav: -9, drag: .8, cover: .9 }));
  }
  // 溅起一圈「皇冠」：贴着地面往外飞的毒液点
  function crown(kit, at, n, sp) {
    kit.emit(n, i => { const an = i / n * 6.28 + kit.rnd(-.2, .2); return { pos: at.clone().add(kit.V(Math.cos(an) * .15, .05, Math.sin(an) * .15)), vel: kit.V(Math.cos(an) * sp, kit.rnd(1.6, 2.6), Math.sin(an) * sp), col: pick([PO.goo, PO.d]), size: kit.rnd(.18, .3), life: kit.rnd(.4, .55), grav: -10, drag: .5, cover: .92 }; });
  }
  // 毒沼（大招，蓄力时就开始）：对手脚下一大片毒水 + 一直冒泡；返回 { end() }
  function swamp(kit, ctx) {
    const st = { done: false, end() { st.done = true; } }, f = kit.feet(ctx.other), r = 1.3;
    kit.decal(f, { kind: 'splash', col: PO.p, col2: PO.l, r, life: 3.2 });
    kit.decal(f, { kind: 'glow', col: PO.p, r: r * .9, life: 2.4, opacity: .6 });
    let acc = 0;
    tick(kit, 4, (k, dt) => {
      if (st.done) return true;
      acc += dt * 30 * (QN[kit.q] || 1);
      while (acc >= 1) { acc--; bubbles(kit, f.clone().setY(.08), r * .9, 1, .9, { s: 1.2, up: .8 }); }
    });
    return st;
  }
  T.poison = {
    generic: { wave: false },   // 脚下的冲击波自己画（groundWave），见上面的说明
    charge(kit, ctx) {
      const { side, tier: t } = ctx, life = CH_MS[t] / 1000 + .2;
      kit.decal(kit.feet(side), { kind: 'splash', col: PO.p, col2: PO.l, r: .55 + t * .15, life: 1.2 + t * .4 });
      bubbles(kit, kit.feet(side).setY(.1), hOf(kit, side) * .45 + .2, [8, 14, 22][t], life + .2, { up: 1.2 });
      if (t === 2) ctx._swamp = swamp(kit, ctx);
    },
    async release(kit, ctx) {
      const { a, b, tier: t } = ctx, { V } = kit;
      if (t === 0) {
        // Toxic Drop：一颗大毒液滴抛过去（飞的时候一伸一缩），一路往下滴
        const d = blobMesh(kit, PO.goo, .16);
        kit.addFx(d, 1, (o, k) => { const w = Math.sin(k * 40) * .12; o.scale.set(.16 * (1 - w), .16 * (1 + w), .16 * (1 - w)); return !o.userData.on; }); d.userData.on = true;
        await kit.fly(a, b, 320, d, p => { if (Math.random() < .6) kit.emit(1, () => ({ pos: p.clone(), vel: kit.V(0, -.5, 0), col: pick([PO.goo, PO.d]), size: .14, life: .35, grav: -6, cover: .9 })); }, { arc: .28 });
        d.userData.on = false;
      } else if (t === 1) {
        // Sludge Spray：一串大小不一的污泥团喷过去，带着毒雾
        const n = qn(kit, 12), MS = 300, GAP = 24;
        kit.glow(a, { col: PO.p, size: .6, life: .35, cover: .4 });
        for (let i = 0; i < n; i++) {
          const m = blobMesh(kit, i % 3 ? PO.goo : PO.d, kit.rnd(.07, .13));
          kit.fly(a.clone().add(kit.sph(.06)), b.clone().add(kit.sph(.22)), MS + kit.rnd(-30, 30), m, p => { if (Math.random() < .3) kit.emit(1, () => ({ pos: p.clone(), vel: kit.sph(.3), col: pick([PO.p, PO.d, PO.goo]), size: .38, life: .4, grow: 1.7, tex: 'smoke', cover: .75, alpha: .75 })); }, { arc: kit.rnd(.15, .35) }).then(() => splash(kit, m.position.clone(), 3, 1.6));
          if (i === Math.floor(n / 2)) kit.decal(kit.feet(ctx.other), { kind: 'splash', col: PO.p, col2: PO.l, r: .85, life: 1.8 });
          await kit.sleep(GAP);
        }
        await kit.sleep(Math.max(30, MS - n * GAP * .5));
      } else {
        // Venom Storm：毒沼（蓄力时已铺好）里鼓起一个个大泡泡，毒雾绕着对手转成旋风 → 泡泡一起爆开
        const sw = ctx._swamp || (ctx._swamp = swamp(kit, ctx)), f = kit.feet(ctx.other), hb = hOf(kit, ctx.other);
        camFrame(kit, ctx, { k: .14, kNear: .04, lk: .6, lookUp: .35, fov: 42, ms: 420 });
        const N = qn(kit, 7), bs = [], T3 = kit.T3, sg = sphG(kit), DUR = .8;
        for (let i = 0; i < N; i++) {
          const an = i / N * 6.28 + kit.rnd(-.3, .3), rr = kit.rnd(.5, 1.05), p0 = f.clone().add(V(Math.cos(an) * rr, .05, Math.sin(an) * rr)), R = kit.rnd(.17, .3) * nearK(ctx), dl = i * .05;
          const m = new T3.Mesh(sg, kit.toonMat(i % 2 ? PO.goo : '#a259e0', { transparent: true, opacity: .72, emissive: PO.em }));
          const hl = new T3.Mesh(sg, kit.glowMat('#ffffff', .85, false)); hl.scale.setScalar(.22); hl.position.set(-.35, .4, .45); m.add(hl);
          m.position.copy(p0); m.scale.setScalar(.001);
          const st = { m, R, pop: false };
          kit.addFx(m, DUR + .3, (o, k, dt) => {
            if (st.pop) return true;
            const g = Math.max(0, Math.min(1, (k * (DUR + .3) - dl) / (DUR - dl)));
            o.scale.setScalar(Math.max(.001, R * kit.EZ.out(g) * (1 + .06 * Math.sin(k * 50 + i))));
            o.position.y = p0.y + R * .7 * g + g * g * .35;
          });
          bs.push(st);
        }
        // 毒雾旋风：三股毒气绕着对手螺旋往上（拖尾带，紫里带一点荧光绿）+ 跟着转的紫雾
        const NH = qn(kit, 3), H = hb * 1.5 + .5;
        for (let i = 0; i < NH; i++) {
          const ph0 = i / NH * 6.28, p = V(0, 0, 0);
          let tt = 0;
          const hp = () => { const y = kit.EZ.sine(Math.min(1, tt / DUR)) * H, an = ph0 + tt * 9, r = .95 - y / H * .35; return p.set(f.x + Math.cos(an) * r, .1 + y, f.z + Math.sin(an) * r); };
          tick(kit, DUR + .1, (k, dt) => { tt += dt; });
          kit.trail(() => (tt < DUR ? hp() : null), { col: PO.p, col2: i ? PO.d : PO.g, width: .2, life: .16, cover: .75, max: 2 });
        }
        let ph = Math.random() * 6.28, acc = 0;
        const rate = 60 * (QN[kit.q] || 1);
        tick(kit, DUR, (k, dt) => {
          ph += dt * 8; acc += dt * rate;
          while (acc >= 1) {
            acc--;
            const y = kit.rnd(0, H), r = .9 - y / H * .3, an = ph + kit.rnd(-.5, .5);
            kit.emit(1, () => ({ pos: f.clone().add(V(Math.cos(an) * r, y, Math.sin(an) * r)), vel: V(-Math.sin(an) * 1.6, .7, Math.cos(an) * 1.6), col: Math.random() < .12 ? PO.g : pick([PO.p, PO.d, PO.goo]), size: kit.rnd(.35, .55), life: kit.rnd(.3, .42), grow: 1.5, fade: .2, drag: .5, tex: 'smoke', spin: kit.rnd(-3, 3), cover: .8, alpha: .9 }));
          }
        });
        await kit.sleep(DUR * 1000);
        // 一起爆开
        bs.forEach(st => {
          const p = st.m.position.clone();
          st.pop = true;
          kit.emit(1, () => ({ pos: p.clone(), vel: kit.V(0, 0, 0), col: PO.p, size: st.R * 2, life: .16, grow: 1.4, tex: 'ring', cover: .85 }));
          splash(kit, p, 5, 2.2);
        });
        kit.light(kit.center(ctx.other), { col: PO.p, intensity: 10, life: .45 });
        kit.shake(.3);
        setTimeout(() => sw.end(), 300);
      }
    },
    impact(kit, ctx) {
      const { b, tier: t, other } = ctx, f = kit.feet(other), fb = front(kit, b, hOf(kit, other) * .45);
      groundWave(kit, ctx, PO.p, PO.l);
      splash(kit, fb, [18, 24, 34][t], 2.4 + t * .5, { s: 1.15 + t * .1 });
      crown(kit, f.clone().setY(.1), [10, 14, 22][t], 1.6 + t * .5);
      bubbles(kit, b.clone().add(kit.V(0, -.2, 0)), .5, [6, 8, 10][t], .9, { up: 1.3, cover: .75 });
      puff(kit, b, [PO.p, PO.d, PO.goo], [4, 8, 14][t], 1 + t * .5, .45 + t * .08, .5 + t * .1, { cover: .85, up: .5, alpha: .9 });
      if (t === 0) { kit.decal(f, { kind: 'splash', col: PO.p, col2: PO.l, r: .55, life: 1.3 }); return; }
      if (t === 2) {
        kit.emit(10, () => ({ pos: b.clone().add(kit.sph(.4)), vel: kit.sph(kit.rnd(1, 2.2)), col: PO.g, size: .18, life: .5, drag: 1.5, tex: 'star', spin: 6, cover: .4 }));
      }
    },
    after(kit, ctx) {
      const { tier: t, other } = ctx;
      if (t === 2) kit.decal(kit.feet(other), { kind: 'splash', col: PO.p, col2: PO.l, r: 1.5, life: 2.4 });
      // 余毒：脚下还冒几个泡泡
      const f = kit.feet(other).setY(.1);
      kit.sleep(200).then(() => bubbles(kit, f, .6, [4, 8, 14][t], 1, { up: .7 }));
    },
  };
})();
