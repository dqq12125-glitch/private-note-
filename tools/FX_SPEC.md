# 回声岛战斗特效 2.0 规格（2026-10-07 家长：「技能特效更加炫酷，可以加入技能动画」）

目标：放招要「有仪式感、打得响」，但**每一招都看得清**、**不拖节奏**、**手机跑得动**、**对孩子安全**。全部原创，不用任何现成游戏的素材和标志性设计。

## 1. 现状（改之前先读）

- `battle3d.js`（`window.Battle3D.create(host, opts)`）：three.js 场景、怪兽、运镜（`camTo` / `shotShoulder` / `shotToward` / `camPunch`）、粒子池（`emit` / `burst` / `rise`，上限 `MAXP`）、小物件（`ring` `orb` `bolt` `beam` `chunks` `addFx`）、闪屏（DOM 盖一层 `flash()`）、震动（`shake`）、17 个属性的 `FX[type](a, b, tier, cols, side)`（tier 0 小招 / 1 中招 / 2 大招，**命中那一刻 resolve**）、`attack(side, type, tier, support)`、`hit(side, {crit})`（打击停顿、受击动作、推镜）、`faint` `status` `buff` `heal` `enter` `catchThrow`。
- `monsters.js` 的 `strike()` 调 `await B3.attack(...)` 然后 `B3.hit(...)`；辅助招式 `B3.attack(side, type, 0, true)`。**这个时序约定不能变**：`attack()` 在命中瞬间返回，伤害数字和血条由 monsters.js 接着处理。
- 画质：monsters.js 开战时按 `EchoWorld.gfxTier()`（high / mid / low）给 `dpr`、`shadows`；减少动态效果（`prefers-reduced-motion`）时 `CINE=false` 不运镜。
- 预览：`tools/fx.html`（每个属性 × 3 档一个按钮，`?me=emberpup&foe=bubbly`）。

## 2. 新结构

- `battle3d.js`：保留场景、怪兽、运镜、`attack()` 的总流程；把特效工具整理成一个 **`kit` 对象**交给特效库；新增下面 §3 的工具和 §4 的流程。
- 新文件（根目录，自动打进 APK）：
  - `battle-fx-elements.js`：fire water grass ice ground rock
  - `battle-fx-energy.js`：spark psychic dragon ghost dark poison
  - `battle-fx-physical.js`：normal fight flying bug steel + 17 个属性的**辅助招式**特效
  - `battle-sfx.js`：合成音效（`window.BattleSFX`）
  - 每个文件往 `window.BattleFX` 里登记：`BattleFX.types[type] = { charge?, release, impact?, after? }`、`BattleFX.support[type] = fn`。没登记的属性用 battle3d 里保底的老特效。
- `index.html` 在 `battle3d.js` 后面依次加载这四个文件；`tools/fx.html` 也加载。

## 3. kit（battle3d.js 提供给特效库，约定好就别改名）

```
kit.T3, kit.scene, kit.cam, kit.q            // three、场景、相机、画质 'high'|'mid'|'low'
kit.V(x,y,z), kit.rnd(a,b), kit.sph(r), kit.C(hex), kit.sleep(ms), kit.tween(ms, k=>{}) → Promise
kit.center(side), kit.feet(side), kit.mon(side) → { root, height, R }      // 怪兽的中心点、脚下、模型
kit.emit(n, i => ({ pos, vel, col, size, life, grav, drag, grow, fade, spin? }))   // 粒子（按画质自动缩减数量）
kit.burst(at, cols, n, speed, size, life, grav) / kit.rise(at, cols, n, r, h, size, life)
kit.addFx(obj, life, (o, k, dt) => {}) → obj   // 带寿命的物件，到期自动 remove + dispose
kit.ring / orb / bolt / beam / chunks / fly(a, b, ms, obj, trail)   // 老工具保留
// 新工具（核心代理实现）：
kit.energyBeam(a, b, { col, col2, width, life, taper, noise })   // 着色器光束：滚动噪声、亮芯、两头收细、闪烁
kit.lightning(a, b, { col, width, branches, life, jag })        // 分叉闪电，每帧重新生成路径，带辉光层
kit.flame(at, { col, col2, size, life, rise })                  // 程序噪声火焰贴片（面向镜头）
kit.shockwave(at, { col, r0, r1, life, flat, thick })           // 冲击波环（叠加发光，可以平铺地面或面向镜头）
kit.impactStar(at, { col, size, life, spikes })                 // 动画式「命中星」：尖刺放射 + 白芯，面向镜头
kit.decal(at, { col, r, life, kind: 'scorch'|'frost'|'crack'|'splash'|'glow' })    // 地面贴花，慢慢淡出
kit.trail(getPos, { col, width, life })                         // 跟着物体的拖尾带
kit.aura(side, { col, life, strength })                         // 怪兽周身的属性光（蓄力用）
kit.groundCircle(side, { col, r, life, runes })                 // 脚下的魔法阵 / 光圈
kit.light(at, { col, intensity, dist, life })                   // 临时点光源（打到地面和怪兽上的光，高画质才有）
kit.flash(col, { strength, ms })                                 // 全屏闪：自动限频（见 §6）
kit.shake(amount), kit.camTo / camPunch / shotShoulder / shotToward / camHome   // 运镜
kit.slowmo(factor, ms)                                           // 特效时间放慢（大招命中瞬间）
kit.bloom(strength, ms)                                          // 发光后期临时加强（高画质）
kit.sfx(type, phase, tier)                                       // phase: 'charge'|'launch'|'impact'|'cutin'|'crit'；音效关着就什么都不做
```
所有新工具：**复用几何体和材质**（模块级缓存），寿命到了 dispose，热循环里不 new 对象；粒子数、灯光、后期按 `kit.q` 缩减。

### 3.1 已实现（2026-10-07 核心代理）：准确的签名、默认值和补充的工具

**通用约定**
- 新工具都返回网格（`trail` 返回 `{ mesh, stop() }`，`light` 返回点光源或 `null`），都已经交给 `addFx` 管理，到期自动移走、材质还回池子；返回的网格可以接着改位置 / 缩放。
- **`cover`（所有新工具和粒子都有）**：特效统一用预乘 alpha 混合，`cover` = 0 纯叠加发光（越叠越亮），1 普通不透明颜色，中间值既发光又能盖住一点背景——白天明亮的场地上全叠加会被冲成一片白，所以默认都带一点 cover。不写时：暗颜色（亮度 < .09，幽灵 / 恶的黑紫）自动 .9，否则用各工具的默认值（下面括号里）。
- 新工具的颜色按 hex 原色输出（做了 sRGB 转换，和 `MeshBasicMaterial` 一致）；**粒子沿用老的做法，不转换**（同一个 hex 粒子看起来更深、更饱和）。
- 时间：`kit.tween`、`kit.fly`、`addFx` 的 `k/dt`、粒子、着色器动画、怪兽动作都按「特效时间」走，`slowmo` 时一起放慢；**`kit.sleep` 是真实时间**（不受 slowmo 影响）。全部按时间算，不依赖帧率。
- 放进场景的特效都在第 1 层（发光后期只画这一层），怪兽在第 2 层当遮挡；自己 `scene.add` 的东西要发光就 `obj.layers.enable(1)`（用 `addFx` / `fly` 会自动做）。

**基础**
```
kit.T3, kit.scene, kit.cam, kit.q ('high'|'mid'|'low'), kit.qs = { maxp, pmul, lights, bloom, decals, trail }   // 画质参数（补充）
kit.RM, kit.CINE           // 减少动态效果 / 是否运镜（补充；RM 或 !CINE 时 flash、slowmo 不生效，RM 时 shake 不生效）
kit.TYPE_COL, kit.EZ = { io, out, sine }   // 属性颜色、缓动函数（补充）
kit.V, kit.rnd, kit.sph, kit.C, kit.sleep(ms), kit.tween(ms, k => {}) → Promise
kit.center(side) → Vector3（新的）, kit.feet(side) → Vector3（脚下，y = .09 台面）
kit.mon(side) → { root, height（世界里的高）, R, off（位移，每帧叠加到站位上，扑出去 / 跳起来改它）, sp, side }（补充 off、sp）
kit.anim(side, 'attack'|'hit'|'idle'|'walk'|'faint', speed?) → 秒数（会动的模型播动作，程序模型返回 0）（补充）
kit.particles             // 现在有多少粒子（只读，补充）
```

**粒子**：`kit.emit(n, i => p)`，`p = { pos, vel, col（Color 或 hex）, size, life, grav, drag, grow = .5（到最后是开始的几倍）, fade = 0（前百分之几不淡）, spin（弧度/秒）, tex: 'glow'|'star'|'smoke'|'ring'（补充：图集里 4 种样子，star 四角星、smoke 软烟团、ring 泡泡环）, cover（补充）, blend: 'add'|'normal'（老写法）, alpha }`。n 按画质乘 1 / .7 / .45，总数到上限（2000 / 900 / 400）就不加。`kit.burst`、`kit.rise` 不变。

**物件**
```
kit.addFx(obj, life秒, (o, k, dt) => { … return true 提前结束 }, end?) → obj   // 补充 end 回调、返回 true 提前结束
kit.fly(a, b, ms, obj, trail(p, k), { arc = .15, ease, spin: [x,y,z] 弧度/秒 }) → Promise（到达时 resolve）
      // 到了自动移走：addFx 管着的交给它释放；obj.userData.keep 的只移走；其他的释放（共用几何体除外）
kit.ring(at, col, r0, r1, life, thick, flat) / kit.orb(col, r) / kit.bolt(a, b, col, width, jag) / kit.beam(a, b, col, width, life) / kit.chunks(geoFn, col, n, at, spread, life, fly)
kit.geo(key, () => new Geometry) → 按名字缓存的共用几何体（不会被释放；同一个 key 必须是同样的形状）（补充）
kit.glowMat(col, opacity = .9, additive) / kit.toonMat(col, { transparent, opacity, side, emissive }) → 池子里的材质（到期自动还回去，别手动 dispose）（补充）
kit.leafGeo()                                              // 叶子形状（配 kit.geo('leaf', kit.leafGeo) 用）
```

**新工具**（括号里是默认值）
```
kit.energyBeam(a, b, { col, col2, width = .3, life = .6, taper = .25, noise = 1, grow = .16（伸出去用的时间比例）, opacity, cover = .45 })
      → mesh；要跟着动就改 mesh.material.uniforms.uA / uB；要随时改粗细就设 mesh.userData.wk（倍数，默认 1；龙魂离镜头近的几节用它变细）（Vector3）
kit.lightning(a, b, { col = '#ffe14d', col2 = '#fff', width = .05, branches = 2（≤ 8）, life = .3, jag = .25, rate = 0（几秒重新生成一次，0 = 每帧）, opacity, cover = .45 })
kit.flame(at, { col 外圈 = '#ff7a2f', col2 里面 = '#ffd54f', size = .6（宽；高 = 1.7 倍）, life = .8, rise = 0, push = 0（往镜头挪）, opacity, cover = .55 })   // 底边在 at
kit.shockwave(at, { col = '#fff', col2, r0 = .2, r1 = 1.6, life = .45, flat = true, thick = .14, push = .3（面向镜头时）, opacity, cover = .35 })
kit.impactStar(at, { col = '#fff', col2, size = .9, life = .3, spikes = 10, push = .6, cover = .5 })
kit.decal(at, { kind = 'scorch', col, col2（焦痕的余烬色）, r = .9, life = 3, opacity, cover（光斑 0，其他 1）})
      // 落在台子上自动贴台面；同时最多 8 / 6 / 3 块（多了最老的快速淡掉）；低画质寿命减半
kit.trail(getPos, { col = '#fff', col2, width = .12, life = .35（尾巴长几秒）, max = 8（最长存在几秒）, opacity, cover = .4 }) → { mesh, stop() }
      // getPos() 每帧返回位置，返回空就停；例：const o = kit.orb(...); kit.trail(() => o.parent && o.position, {...}); kit.fly(a, b, 500, o)
kit.aura(side, { col = '#fff', col2 = '#fff', life = .6, strength = 1, tint = true（怪兽身上泛属性色）, cover = .35, size = 1（光壳大小的倍数） })
kit.groundCircle(side, { col = '#fff', col2, r = 1.1, life = .8, runes = false, spin = .6, opacity, cover = .3 })   // 跟着怪兽走，先「画」一圈出来
kit.glow(at, { col, size = .6, life = .3, grow, follow: () => Vector3, push, opacity, cover = .15 })   // 柔光点（补充）
kit.light(at, { col, intensity = 8, dist = 5, life = .4 }) → PointLight | null   // 只有高画质有，同时最多 2 盏（满了顶掉快结束的那盏）
```

**画面**
```
kit.flash(col, { strength = .45（最多 .55）, ms = 300 }) → 有没有真的闪   // 老写法 flash(col, ms) 也行
      // 每秒最多 3 次、两次至少隔 250ms，超了跳过（高画质改成发光后期亮一下）；饱和红色自动换成很淡的颜色
kit.shake(amount)          // 最大 .45；一招里 ≥ .2 的大震最多 2 次，再多降成 .15
kit.slowmo(factor = .35, ms = 260)   // 最后 30% 慢慢恢复
kit.bloom(strength = 1.6, ms = 400)  // 平时有特效时发光后期强度 .32，这里临时加强（只有高画质有）
kit.sfx(type, phase, tier)
kit.camTo(to: () => ({ pos, look, fov? }), ms, ease, orbit) / kit.camPunch(at: () => Vector3, amt, ms) / kit.shotShoulder(side) / kit.shotToward(side, k, lk) / kit.camHome(ms, delay)
```

**登记表（补充）**：`BattleFX.types[type] = { charge?, release, impact?, after?, physical?, ult?, generic? }`（`physical: true` 扑得远；不写时 fight、normal 算物理系；`ult` / `generic` 见 §4.1）；`BattleFX.support[type] = (kit, ctx) => {}`（辅助招式，`ctx.a`、`ctx.b` 都是自己的中心，可以返回 Promise，最多等 1.8 秒）；**`BattleFX.common = { charge?, cutin?, impact?, after? }`**：所有属性共用的环节（编排代理登记通用蓄力、过场横幅、通用命中），每一段先跑 common 再跑这个属性的。
`ctx = { a, b, dir, side, other, tier, cols, info, type, support }`。保险：`charge` 最多等 1 秒、`cutin` 1.3 秒、`release` 上限 + 1.2 秒（超时当命中了，`fxStats().over` 记一次）；`release` 出错退回保底特效；impact / after 出错只在控制台警告。
attack() 自动调的音效：蓄力 `sfx(type,'charge',tier)`、出招 `'launch'`、命中 `'impact'`；`hit(side, {crit:true})` 调 `'crit'`；`'cutin'` 由过场自己调。

**对外补充**（`Battle3D.create(host, { quality, sfx, … })` 返回的对象）：`kit`、`quality`、`fxStats()` → `{ parts, peak, fx, anim, flashes, flashSkipped, over, lights, move: { type, tier, impact }, mem: renderer.info.memory, programs }`、`fxReset()`、`fxIdle()`。`Battle3D.QUAL`、`Battle3D.CAP` 是画质表和时长上限。

## 4. 一招的流程（battle3d.js 的 attack 负责串起来）

`attack(side, type, tier, support, info)`，`info = { name: 'Flame Wave', zh: '火焰波', sp: 物种对象 }`（monsters.js 传进来；没传就不显示名字）。

1. **蓄力**（小招 0.25 s、中招 0.45 s、大招 0.7 s）：过肩机位；怪兽周身属性光 `aura`、脚下光圈；`types[type].charge(kit, ctx)` 可以加自己的（火星往里吸、水汽聚拢……）；`sfx(type,'charge')`。
2. **大招过场**（只有 tier 2）：画面斜切一条属性色的横幅从侧面冲进来，横幅里有速度线、出招怪兽的立绘（`assets/mon2d/<id>.webp`，没有就用 3D 截图）、**招式英文名大字**（Baloo 2，描边）+ 中文小字；进 0.22 s、停 0.6 s、出 0.2 s，总共 ≤ 1.1 s。中招在画面上方出一条小横幅显示招式名（0.9 s，不挡战场）。小招不出名字。DOM + CSS 动画，盖在 `#b-arena` 上，横屏也要好看；减少动态效果时只淡入淡出。
3. **出招**：怪兽的 `attack` 动作（会动的模型）或程序扑击；大招加一个特殊动作（物理系跳起 / 冲刺，特殊系浮起转身发光）；`types[type].release(kit, ctx)` **在命中瞬间 resolve**。
4. **命中**：`types[type].impact(kit, ctx)`（可选）+ 通用：命中星、冲击波、属性色闪烁（限频）、临时点光源、大招 `slowmo(.35, 260)` + `bloom`；`hit()` 里已有的打击停顿、受击动作、推镜保留。
5. **余韵**（不挡流程，后台淡出）：地面贴花、余烬 / 冰雾 / 烟，`types[type].after(kit, ctx)`。

`ctx = { a, b, dir, side, other, tier, cols, info }`（a 出招点、b 命中点、cols = TYPE_COL[type]）。

**时长上限**（从开始蓄力到命中 resolve）：小招 ≤ 1.0 s，中招 ≤ 1.6 s，大招 ≤ 2.8 s（含过场）。小招用得最多，必须利落。辅助招式 ≤ 1.2 s。

### 4.1 已实现（2026-10-07 编排代理）：各段时长、release 的时间预算、通用环节

**每段的时长**（毫秒；程序模型 / 纸片和会动的模型分开算）

| | 蓄力 | 过场 / 横幅 | 扑出去 / 特殊动作 | 留给 `release` 的预算 |
| --- | --- | --- | --- | --- |
| 小招 | 250 | 无 | 程序模型往前一扑 150（物理系 190）；会动的模型 `attack` 动作在蓄力里提前开始（1.5 倍速，后仰那段算蓄力），蓄力结束后 80 出招 | **≤ 550** |
| 中招 | 450 | 右上角小横幅 0.9 s，和蓄力同时（不占时间） | 200（物理系 260）；会动的模型 1.25 倍速，蓄力结束后 100 出招 | **≤ 850** |
| 大招 | 700，其中 400 时横幅冲进来 | 进 220 + 停 600 = 到 1220 开始退场（退场 200 和特殊动作同时） | float 380 / leap 430 / dash 360 | **≤ 1000** |

- `release` 从调用到 resolve（命中）别超过上面的预算，加起来才不超过 §4 的上限（用 `node tools/fx-shots.js <type> <tier>` 看「命中」那一栏）。`charge` 钩子返回的 Promise 也会等（大招的在过场底下等，不额外占时间；小招中招超过蓄力时长就会顺延）。
- 会动的模型（`assets/mon3d`，`attack` 动作 1.125 秒，第 0.5 秒扑到最前面）：小招中招在扑到最前面的那一刻出招；大招按特殊动作的长短调速，特殊动作做完正好扑到最前面。

**运镜**：小招中招过肩（`shotShoulder`）→ 出招时推向挨打的一方（`shotToward`）；大招蓄力切到出招怪兽正前方斜一点的低机位特写（`shotHero`，过场横幅盖在这个画面上）→ 特殊动作：我方切回过肩、对方直接切到我方这边的近景（看它正面扑过来）→ 出招推向挨打的一方。**对方出招时，出招那一下是直接切镜头**（以前从对方身后飞回来会贴着我方台子掠过去，见以前的 `rock-2-foe.png`）。

**大招特殊动作**（`ult`，不写按属性：fight / ground / rock / steel 跳，normal / flying / bug / dark 冲，其他浮）
- `leap`：蹲下（压扁）→ 跳起来转一圈（拉长、拖尾）→ 砸回台子（地面冲击波、尘土圈、小震 .16）→ 落地压扁再弹回；
- `dash`：往后一缩 → 冲出去 1.4（残影拖尾、往后飞的星光）→ 收回来；
- `float`：脚下冲击波、身上柔光（蓄力时的周身光还亮着），浮起来转一圈，迸一圈星光；**出招时一直浮着**，命中后 0.38 s 落回台子。
- 做完把 `ctx.a` 挪到怪兽当时的位置（浮着的就是浮起来的高度）+ 往对手方向 .3，`release` 直接用 `ctx.a` 就对得上。
- 减少动态效果时不跳不转，只原地亮一下（300ms）。

**内置的通用环节**（每一段都是：内置 → `BattleFX.common`（有登记的话）→ 这个属性登记的）
- 蓄力：周身属性光 `aura`（强度 .5 / .65 / .72；很浅的颜色——一般、飞行、冰、电——再乘 .45、不给怪兽上色）、脚下光圈（大招带符文）、一圈光点螺旋着吸进怪兽（分 1 / 2 / 4 波）；中招大招脚下推出一圈冲击波；大招再加从光圈往上冒的光点、点光源（放在怪兽身后上方当轮廓光，背对主角特写的镜头；放在身体里会把它从正面照成一片浅黄）。浅色属性（一般、钢、冰、飞行、电）的周身光用饱和一点的点缀色、cover .7（不然在草地场地上透出一片淡绿）；小招的光壳小一点。
- 命中：命中星（小 .75 / 中 1.05 / 大 1.6）、往外迸的星光、点光源；中招大招脚下冲击波 + 属性色全屏闪（.2 / .4，走限频）；大招再加一圈面向镜头的冲击波、`slowmo(.35, 260)`、`bloom(2, 520)`、`shake(.22)`。
- 余韵：中招大招在挨打的一方周围留慢慢往上飘的星光；大招脚下再留一块属性色光斑（`decal` glow，1.6 s）。
- **按属性关掉**：登记时 `generic: false`（全关）或 `generic: { charge: false, star: false, wave: false, sparks: false, light: false, flash: false, slowmo: false, after: false }` 关其中几项（比如自己已经做了很大的命中星，就关掉 `star`）。

**过场 DOM**（`battle3d.js` 建，样式在 `style.css` 末尾「3D 战斗：大招过场」一节）：`.b3d-cut`（`.bc-dim` 压暗、`.bc-band` 斜切横幅：`.bc-bg` 里速度线 `.bc-lines` + 网点 `.bc-dots`、上下错开的色条 `.bc-acc`、立绘 `.bc-mon img`、招式名 `.bc-name b / small`），尺寸按战场大小（容器查询 `cqw / cqh`），竖屏横屏都合适；`.b3d-ban` 中招横幅；`.b3d-z` 睡着时飘的 Z。全部**按 `performance.now()` 每帧由 JS 驱动**（不是 CSS 动画），假时钟截图对得上。立绘：发布的 2D 图标，稀有色 / `?art=proc` / 读不到时用 `Mon3D.snapshot`；我方的左右翻过来朝右。

**其他升级**（时长都没变）：出场（从球里出来：往上冲的光柱 + 冲击波 + 星光；野生：尘土 + 淡淡的冲击波）、异常状态（烧伤小火苗、中毒泡泡 + 毒渍、麻痹电弧、睡眠烟团 + 飘起来的 Z、冰冻冰块 + 冰霜 + 冲击波、混乱头上绕圈的星星）、能力升降（光圈 + 三道依次的光环）、回复（带符文的光圈 + 从头上洒下来的星光）、倒下（倒地尘土、淡出时化成往上飘的光点）、扔回声球（回声球是尖顶朝上的螺旋海螺 `shellMesh`，开口朝镜头、里面含一颗发光的回声珠，金回声球是金壳 + 青色珠子，和 2D 图标 `Cartoon.shell()` 同色；飞的时候翻滚 + 拖尾、怪兽化成光被吸进开口、落地弹一下、每摇一下从开口冒一圈声波 `echoRings`、收好了三圈回声 + 金色命中星、挣脱时声波 + 碎光）、暴击（金色大命中星 + 面向镜头的冲击波）。

**kit 补充**：`kit.aura(side, { tint })` 的 `tint` 可以是数字（上色强弱的倍数）；`kit.shotHero(side)`（大招蓄力用的正面低机位特写，配 `kit.camTo`）。

**测**：`node tools/fx-shots.js <type> 2` 看接触印样图（过场是 DOM，也截得到）。

## 5. 每个属性的特效（设计代理按这个方向做，可以更好）

每个属性三档要**一眼能分出来**，大招要有一个「招牌镜头」（如火：脚下爆出火柱冲天；水：巨浪从侧面卷过去；雷：天上劈下分叉闪电落地爆开；冰：地面冻出冰晶阵把对手困住再炸碎；草：藤蔓从地里钻出缠住 + 阳光柱；大地：地裂 + 岩柱拱起；岩：陨石砸落；心灵：空间扭曲的同心环 + 对手浮空；龙：龙形能量弧线盘旋冲下；幽灵：影子从地下伸出；恶：黑色斩痕交叉；毒：毒沼泡泡爆开；功夫：连续三拳的冲击星 + 最后一记重击；飞行：龙卷风；虫：大群光点蜂拥；钢：巨大钢球砸下 + 金属火花；一般：白光冲撞 + 大命中星）。颜色用 `TYPE_COL`。

## 6. 安全和可读性（必须）

- **闪屏限频**：全屏闪每秒最多 3 次（`kit.flash` 自己记时间，超了就跳过或改成局部光），单次不透明度 ≤ 0.55，**不用饱和红色全屏闪**（光敏性癫痫风险，参考 WCAG 2.3.1）。闪电的「闪烁」只能是闪电本身这根线忽明忽暗，不能整屏。
- 震动适度（`shake` ≤ 0.45），大招最多两次。
- 特效不能长时间盖住两只怪兽：命中后 0.5 s 内画面要能看清谁挨打了、血条和伤害数字。
- `prefers-reduced-motion` / `CINE=false`：不运镜、不放慢、过场只淡入淡出、不闪屏。
- **受击泛白**（`hit()` / 异常状态的 `m.flash`）：一次平滑淡出（最亮自发光 .55，减少动态效果 .3），不一亮一暗地频闪（以前约 11Hz，2026-10-07 审查改掉）。
- 暴击（答得好就暴击，很常见）：全屏闪 .25、震动算进这一招的大震次数里。
- 特效的子物件：自己有寿命的特效（`addFx` 管着的）别放进另一个特效的 Group 里；放了也不会坏（父物件到期时引擎把它摘出来、让它自己到期释放），但会跟着父物件一起消失。

## 7. 性能（REDMI Turbo 5 跑得动，低端手机也不卡）

- 画质 `high`：粒子上限 2000、点光源 ≤ 2、发光后期（半分辨率提亮 + 模糊叠加，只在有发光的特效 / 粒子时开：地面贴花、实心碎块、计时用的空物件不算）；`mid`：粒子 900、不要点光源和后期；`low`：粒子 400、贴花和拖尾减半。
- 不能有内存 / 显存泄漏：连放 60 招后 `renderer.info.memory`（几何体、贴图）回到开始的水平（± 少量缓存）；`destroy()` 全部释放。
- `tests/render3d.test.js`、战斗相关测试（`npm test` 里的）全部要过；测试里是软件渲染，很慢，特效不能依赖帧率（用时间算）。

## 8. 检查工具

- `tools/fx.html`：加上画质切换（high / mid / low）、「连放全部」、显示招式名和时长。
- `node tools/fx-shots.js <type> <tier> [--q high]`：无头浏览器里放一招，按时间均匀截 12 帧，拼成一张 4×3 的接触印样图存到 `tests/screenshots/fx/<type>-<tier>.png`，并打印：总时长、命中时刻、最多同时粒子数、闪屏次数、显存对象数。`node tools/fx-shots.js all` 跑全部 51 招。

**已实现（2026-10-07）**
- `tools/fx.html`：画质 high / mid / low（换画质会重建 Battle3D）、我方打对手 / 对手打我方、▶ 连放全部 51 招、每个属性一行（小 / 中 / 大招按钮显示英文招式名 + 辅助招式「辅」）、最下面一行 `kit` 新工具的单独演示。放完显示招式名、命中时刻（超过上限标红）、全部淡完的时长、粒子峰值、闪屏次数（限频跳过的另算）、几何体 / 贴图数、着色器程序数；下面一行实时帧率、粒子数。网址参数 `?q=mid&side=foe&me=emberpup&foe=bubbly&w=390&h=300&sfx=0`。给脚本用的 `window.FXT`：`play(type, tier, { support, side })`（命中时 resolve，接着调 hit）、`run(...)`（等淡完，返回统计）、`demo(name)` / `runDemo(name)`、`state()`、`setQuality(q)`、`setSide(s)`。
- `node tools/fx-shots.js`：
  - `fire 2`（tier 0 / 1 / 2 / `s` 辅助招式 / `all`）、`fire,water all`、`all`（51 招）、`demo lightning`（`demo all` 全部工具演示）
  - `--q mid|low`（文件名加 `-mid` / `-low`）、`--side foe`（加 `-foe`）、`--me id --foe id`、`--w 390 --h 300`、`--step 40`（截图间隔毫秒）、`--frames 12`
  - `--leak [60]`：泄漏检查——先把 51 招和 17 个辅助招式各放一遍（共用缓存填满），再连放 60 招，几何体多出 > 3 或贴图多出 > 1 就 FAIL（实测 high：缓存满了 83 几何体 / 12 贴图，再放 60 招不变）
  - 用 Playwright 的假时钟一步步拨时间，所以软件渲染再慢，截到的时刻、命中时刻、时长都是准的；**CSS 动画 / 过渡不归假时钟管**（浏览器合成器按真实时间跑），DOM 过场要截得准就用 JS 按 `performance.now()` 驱动。浏览器里有报错 / 警告会列出来，退出码 1。
  - 一招大约 5–15 秒（截 40 张左右），`all` 十几分钟。
