// 回声岛 · 新画风的大地图（样品，默认不用）：镜头放低、跟在主角身后，看得到天和远处；地面有起伏
// 打开方式：网址带 ?look=new，或者 localStorage['echo-look'] = 'new'。不打开时这个文件什么都不做，world.js 照旧用 world3d.js
// 只画户外地图（小镇、道路）；室内、挑战馆、洞穴、海底交给 world3d.js 的老渲染器（见最下面的 create：两个渲染器各有一张画布，按地图换着用）
//
// 画风（这一版要做到的样子）：明亮、柔和、有手绘感的野外——天大、看得远、草在风里动、光是软的
//   · 形状靠明暗分出来，不靠黑线。地面、草、树冠、石头、山的明暗是软的两档（亮面 / 暗面，中间一条宽宽的过渡带），房子和物件是硬一点的三档
//   · 太阳在左上方，暖黄色；影子和背光面偏蓝紫，影子的边是软的。远处的东西更浅、更蓝（隔着空气），低处的空气更浓，最远化进地平线上那一条暖白色里；
//     一大片一大片的云影慢慢滑过地面、草、树、屋顶和水面（所有着色器查同一个函数）
//   · 描边只留给人、怪兽和能对着按 A 的东西（告示牌、地标、道具），细细的一条、颜色是底色压暗；房子只有淡淡的一丝；地面、草、树、山、远处的东西都不描
//   · 树冠是软的一团团（法线朝「整个树冠的外面」），轮廓和表面是画出来的树叶（镂空的贴片）；棕榈的叶子是一条条弯下来的带子，上面是剪开的小叶；
//     石坎、岩壁、石头是圆润的大块，侧面画着一层层的岩层，顶上垂着草边
//   · 草地是一根根细草叶，根的颜色就是脚下的地面，只有草尖浅一点、黄一点；风是一道道大浪扫过去，浪头上的草尖发亮；草里有三叶草和小花；
//     离主角远了越来越稀，最后接上地面上画的草叶笔触，没有一条分界线。草丛（会遇到怪兽的）高、深、带草穗，一眼分得出
//   · 看得远：成片的边界树一群一群地种、中间是矮灌木；地图外面的地往海里落下去，出口外面是一道垭口，望出去是海、远处的岛（正北那座上面立着灯标塔）和淡在雾气里的大山
//   · 天空头顶是深一些的蓝，越靠近地平线越浅越暖；几朵又大又软的平底积云慢慢飘
//   · 水从清澈的青绿到深蓝，岸边一道道往岸上推的浪花，朝着亮的那边一条碎光
//   · 房子上的东西是做出来的：一片片筒瓦、窗框窗棂、百叶窗扇、窗台上的花箱、门框门柱、烟囱
//   · 亮的地方有一点点柔光，左上角罩着一片太阳的暖光，最后一点点调色（很缓的 S 形、亮部偏暖、暗部偏冷）；空气里飘着花瓣和花粉，花丛边有一两只蝴蝶
//   · 不用移轴虚化（那是老版「小模型」的感觉）
// 三档画质差得很开（见 TIERS）：精美档给性能好的手机，画面里几十万到一百万个三角形，细的东西都堆在镜头跟前（草、树都按远近换零件）；省电档十来万。
// 手机（包括 iPhone 的 WKWebView）上能跑的写法：只用 WebGL2 自带的东西；渲染目标都是 8 位的，不用浮点贴图；不边画边读同一张图；
//   描边要读的深度图先试一次，读不出来就不描边；用到世界坐标和时间的地方都标了 highp；贴图全是画布上画出来的（不用 OffscreenCanvas / createImageBitmap）；
//   满屏的后期只有一遍（描边 + 柔光 + 调色合在一起），柔光那三遍是缩小了很多倍的小图
// 镜头和遮挡：镜头在主角南边上方、朝北看（方向不变，摇杆不用改），地平线在画面上面约五分之一、主角在中间偏下。
//   房子挡在镜头和主角中间 → 整栋用网点淡出去，只留地上一圈墙基；树和别的东西 → 在主角周围开一个圆窗；岩壁 → 镜头抬高；
//   主角面朝北和人说话 → 镜头也抬高一些（不然主角的背影正好把对面的人挡住）；对面是 3D 小人、对话框开着时再绕到主角右后方约 27°（两个人的脸和背影都看得到），说完转回正北
// 人物：有 people3d.js（EchoPeople3D）就是 3D 小人——主角、对手、村民、剧情里临时出现的人；没装它、或者它说这个造型不行，就是老的纸片人。
//   站在哪、朝哪边、走多快、在不在说话都还是 world.js 每帧给的；小人的材质由这里给（和别的东西一样受云影、雾、影子、描边），脚下的圆影子不变
// 逻辑一点没动：走路还是一格一格的，world.js 每帧给的 V（主角 / 怪兽 / 人物 / 道具 / 提示的格子坐标）只是换了个画法；
// 地形高度只从地图数据推（台阶 L 是往南跳的坎，水比地面低，走不了的边界鼓成小山），V 里的东西都贴着这个地面放
(function () {
  'use strict';

  const LOOK = (() => { try { return new URLSearchParams(location.search).get('look') || localStorage.getItem('echo-look') || ''; } catch (e) { return ''; } })();

  // 三档画质。high 给性能好的手机（画面里可以到一百万个三角形上下），mid 约三十万，low 约十二万——三档差得开，world.js 的自动降档才有用。
  // dpr 是上限；shadow：影子图多大；sub：地面每格分成几段；det：圆的东西（树冠、石头）细分几次；grass / lawn：草丛、草坪的密度；
  // ring：地图外面种几圈树；skirt：地图外面的地形做多宽；far：最远画到哪（雾在这里完全盖住）；msaa：抗锯齿采样数；bloom：柔光图缩小多少倍（0 = 不要）；
  // leaf / detail：树叶贴图、地面细节贴图的边长；mask：地面遮罩图每格几个像素
  const TIERS = {
    high: { dpr: 3, shadow: 3072, post: true, msaa: 4, bloom: 4, sub: 4, det: 3, grass: 1, lawn: 1, ring: 12, skirt: 62, far: 340, clouds: 7, life: 1, cell: 192, mask: 16, leaf: 2048, detail: 1024 },
    mid: { dpr: 1.5, shadow: 2048, post: true, msaa: 2, bloom: 6, sub: 3, det: 2, grass: .5, lawn: .3, ring: 8, skirt: 44, far: 260, clouds: 6, life: .5, cell: 96, mask: 8, leaf: 1024, detail: 512 },
    low: { dpr: 1, shadow: 0, post: false, msaa: 0, bloom: 0, sub: 2, det: 1, grass: .22, lawn: .1, ring: 5, skirt: 32, far: 180, clouds: 4, life: 0, cell: 64, mask: 6, leaf: 512, detail: 256 },
  };
  const DIRI = { down: 0, left: 1, right: 2, up: 3 };
  const WATER = '~Dw', EXITS = '^v<>', BUILD = 'CMGHJAEcmghja';
  // 这张地图新渲染器画不画得了：只管户外的小镇和道路（户外的 over 图层只是地上画的东西，比如规则城的斑马线，照样画；挑战馆的机关地板都在室内）
  const supports = m => !!m && (m.kind === 'town' || m.kind === 'route');

  // ---------- 每座岛的「天气」：天空、空气、太阳、空气里飘的东西 ----------
  // 按岛（m.isle）挑；勇气之路、冠军高原（v 开头的地图）单独一种：晴朗、金色的光。
  //   fog：远处的东西往这个颜色里淡；haze：地平线那一条；fogP：[雾从多远开始, 浓度]；sky：[头顶, 中间, 贴着地平线]；sun / sunK：太阳的颜色和强弱；hemi：[天光, 地面反光]
  //   life：空气里飘的东西——petal 花瓣和花粉 / leaf 秋天的落叶 / snow 雪花 / confetti 彩纸屑 / mote 慢慢飘的浅色小光点 / shaving 彩色的铅笔屑；lifeK：多少（× 画质档的量）
  const MOODS = {
    0: { fog: '#9cc6f4', haze: '#fbf1de', fogP: [17, .0118], sky: ['#2877dc', '#5fb3f1', '#b9e1f7'], sun: '#fff0b8', sunK: 1, hemi: ['#dce1ff', '#efe2c4'], life: 'petal', lifeK: 1 },
    1: { fog: '#b2c3f2', haze: '#fff0ea', fogP: [17, .0118], sky: ['#3b7ee2', '#7db9f5', '#d6e4fb'], sun: '#fff2c4', sunK: 1, hemi: ['#e2e0ff', '#f6e4d6'], life: 'shaving', lifeK: 1 },
    2: { fog: '#b6c8de', haze: '#fde6bf', fogP: [16, .0122], sky: ['#2f7ad2', '#79b6e8', '#dce4e6'], sun: '#ffe2a2', sunK: 1.04, hemi: ['#e0dcf2', '#f4dfb6'], life: 'leaf', lifeK: 1 },
    3: { fog: '#a3c7f0', haze: '#f8f0e2', fogP: [17, .0115], sky: ['#2774da', '#62b2f1', '#c2e2f6'], sun: '#fff2c0', sunK: 1, hemi: ['#dce2ff', '#ece3cc'], life: 'petal', lifeK: 1.1 },
    4: { fog: '#a6cbf2', haze: '#eef4fa', fogP: [18, .011], sky: ['#1f6fd8', '#58adf2', '#c0e4fa'], sun: '#fffbe6', sunK: 1, hemi: ['#d8e4ff', '#e6e6dc'], life: 'mote', lifeK: .5 },
    5: { fog: '#b9cde6', haze: '#fde6c2', fogP: [16, .0124], sky: ['#2b78d6', '#71b4ee', '#d4e4ec'], sun: '#ffeab0', sunK: 1.03, hemi: ['#e0e0fa', '#f4e0bc'], life: 'confetti', lifeK: .55 },
    6: { fog: '#b2bccb', haze: '#efe2d2', fogP: [14, .0142], sky: ['#3871be', '#78a5d4', '#cdd5dc'], sun: '#ffe6b8', sunK: .96, hemi: ['#dcdcee', '#eadcc6'], life: 'mote', lifeK: .8 },
    7: { fog: '#c2c3f2', haze: '#ffe8f0', fogP: [17, .0118], sky: ['#3d7ee6', '#86bdf6', '#f0def2'], sun: '#fff0c8', sunK: 1, hemi: ['#ecdcff', '#fbe2e6'], life: 'confetti', lifeK: 1 },
    8: { fog: '#a3c4b4', haze: '#ecf1dc', fogP: [12, .0165], sky: ['#2c7cc4', '#78bcd4', '#d2e9dc'], sun: '#fff0c0', sunK: .98, hemi: ['#d4e6e4', '#e2e6c4'], life: 'mote', lifeK: 1 },
    9: { fog: '#a9bdd4', haze: '#edf0f2', fogP: [16, .0125], sky: ['#2a70cc', '#68abe6', '#cde0ee'], sun: '#fff6dc', sunK: 1, hemi: ['#dae2f6', '#e4e4e0'], life: 'mote', lifeK: .35 },
    10: { fog: '#9cc6f4', haze: '#fbf0dc', fogP: [17, .0115], sky: ['#2470dc', '#5cb0f2', '#bfe0f6'], sun: '#fff2bc', sunK: 1.02, hemi: ['#dce2ff', '#ece4c6'], life: 'petal', lifeK: .7 },
    11: { fog: '#c2d8f0', haze: '#eef4fb', fogP: [16, .011], sky: ['#3f84d6', '#8cbeee', '#d6e8f8'], sun: '#fffaf0', sunK: .98, hemi: ['#e2e8ff', '#eef0f2'], life: 'snow', lifeK: 1.6 },
    12: { fog: '#b4c2c4', haze: '#dfe3df', fogP: [8, .024], sky: ['#8fa9ba', '#b3c4cc', '#cfd8d8'], sun: '#fff2d2', sunK: .9, hemi: ['#d8dee4', '#e2e0d2'], life: 'mote', lifeK: 1 },
    league: { fog: '#a6c6ee', haze: '#fff0d4', fogP: [18, .011], sky: ['#2268d6', '#5aaaf0', '#c6e2f6'], sun: '#ffeaa8', sunK: 1.05, hemi: ['#dce0ff', '#f2e2c2'], life: 'confetti', lifeK: .45 },
  };
  // 每种地貌（m.theme）的地面和岩石：
  //   path：小路的样子 dirt 土路 / asphalt 柏油马路 / stone 石板路 / tile 方砖 / candy 糖果色（撒着彩色糖粒）/ crayon 蜡笔涂过的彩色小路 / snow 踩实的雪
  //   sand：沙地的样子 beach 沙滩 / dune 沙丘（风吹出来的大波纹）/ paving 人行道的方砖 / ash 火山灰和碎石 / snow 雪
  //   rock：岩壁的 [暗, 中, 亮]；cap：岩壁顶上是 grass 草 / snow 雪 / rock 光秃秃的石头 / moss 苔藓；band：岩层颜色深浅差多少；book：岩层画成一摞摞的书（书脊和米白的书页）
  const GROUND = {
    hello: { path: 'dirt', sand: 'beach', rock: ['#8a6a50', '#b48d6a', '#dcc3a0'], cap: 'grass', band: .22 },
    crayon: { path: 'crayon', sand: 'beach', rock: ['#7d6aa6', '#a593cc', '#d4c8ec'], cap: 'grass', band: .26 },
    farm: { path: 'dirt', sand: 'beach', rock: ['#7a5e44', '#a5825e', '#cfb48c'], cap: 'grass', band: .22 },
    school: { path: 'tile', sand: 'beach', rock: ['#76695c', '#9d9080', '#c9bfb0'], cap: 'grass', band: .2, book: true },   // 书山：岩壁是一摞摞的大书
    lab: { path: 'tile', sand: 'beach', rock: ['#5f7584', '#8aa2b0', '#c2d2da'], cap: 'grass', band: .18 },
    circus: { path: 'dirt', sand: 'dune', rock: ['#9a6a42', '#c99a68', '#ecc996'], cap: 'rock', band: .28 },
    clock: { path: 'stone', sand: 'ash', rock: ['#4e4440', '#76685e', '#a39283'], cap: 'rock', band: .26 },
    party: { path: 'candy', sand: 'beach', rock: ['#8d6c9a', '#b897c4', '#e2cde8'], cap: 'grass', band: .24 },
    jungle: { path: 'dirt', sand: 'beach', rock: ['#5a5440', '#857b5e', '#b0a684'], cap: 'moss', band: .2 },
    city: { path: 'asphalt', sand: 'paving', rock: ['#606a72', '#8a959e', '#bcc6cc'], cap: 'grass', band: .14 },
    sports: { path: 'dirt', sand: 'beach', rock: ['#7f6a56', '#a8927a', '#d2c0a6'], cap: 'grass', band: .2 },
    snow: { path: 'snow', sand: 'snow', rock: ['#5d6f80', '#8798aa', '#bccad6'], cap: 'snow', band: .2 },
    ruins: { path: 'stone', sand: 'beach', rock: ['#5c5a52', '#858278', '#b4b0a2'], cap: 'moss', band: .22 },
  };
  const PATHK = { dirt: 0, asphalt: 1, stone: 2, tile: 3, candy: 4, crayon: 5, snow: 6 }, SANDK = { beach: 0, dune: 1, paving: 2, ash: 3, snow: 4 };
  const LIFEK = { petal: 0, leaf: 1, snow: 2, confetti: 3, mote: 4, shaving: 5 };

  // ---------- 噪声（地形起伏、贴图、摆放都用它；同样的输入永远同样的输出） ----------
  const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => vnoise(x, y) * .57 + vnoise(x * 2.03 + 11.3, y * 2.03 + 4.7) * .29 + vnoise(x * 4.1 + 3.1, y * 4.1 + 9.2) * .14;
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract2 = x => x - Math.floor(x);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ---------- 着色器里公用的几段 ----------
  // 雾（隔着空气的颜色）：近处不变，中间一段先灰一点，越远越浅越蓝（远山成了淡蓝色的剪影）；低处的空气更浓，山脚先淡掉、山顶露在外面；
  // 最远那一截化进地平线上的暖白色。uFogP = (开始距离, 浓度, 最远)；d 离镜头多远，y 这一点多高
  const FOG_PARS = 'uniform vec3 uFogA; uniform vec3 uHaze; uniform vec3 uFogP;\n' +
    'vec3 airFog(vec3 c, float d, float y) { float lowK = 1.0 - smoothstep(-1.0, 12.0, y); float f = 1.0 - exp(-max(0.0, d - uFogP.x) * uFogP.y * (1.0 + 0.5 * lowK)); float l = dot(c, vec3(0.3, 0.59, 0.11)); c = mix(c, vec3(l), f * 0.26); c = mix(c, uFogA, f * 0.9); return mix(c, uHaze, smoothstep(uFogP.z * 0.4, uFogP.z, d) * (0.3 + 0.62 * (1.0 - smoothstep(2.0, 45.0, y)))); }\n';
  // 云影：一大片一大片的明暗慢慢滑过去。地面、草、树、屋顶、水、人都查这一个函数，所以是「同一片云」。返回 0 = 太阳底下，1 = 云影正中
  const CLOUD = 'uniform sampler2D uNoise;\nfloat cloudSh(highp vec2 p) { highp vec2 q = p * 0.0105 + uTime * vec2(0.021, 0.009); float a = texture2D(uNoise, q).a; float b = texture2D(uNoise, q * 2.3 + vec2(0.37, 0.11)).r; return smoothstep(0.48, 0.6, a * 0.82 + b * 0.18); }\n';
  // 网点镂空（挡住主角的东西变「半透明」）：4×4 的网点表
  const BAYER = 'float bayer4(vec2 p) { vec2 q = floor(mod(p, 4.0)); int i = int(q.x) + int(q.y) * 4; const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); return (m[i] + 0.5) / 16.0; }\n';
  // 一阵风：一条慢慢扫过整张地图的带子（草和树共用，所以是「同一阵风」）
  const GUST = 'float gustAt(vec2 p) { float g = sin(dot(p, vec2(0.13, 0.09)) - uTime * 0.62) + 0.5 * sin(dot(p, vec2(-0.07, 0.17)) - uTime * 0.41 + 1.3); return smoothstep(0.7, 1.4, g); }\n';
  // 挡住主角的东西：比主角离镜头近、又落在画面上主角周围那个圆里的像素不画（圆边上用网点过渡），像在房子、树上开了一扇圆窗。
  // uHole = (圆心 x, 圆心 y, 半径, 主角离镜头多远)，前三个是画布上的像素；uHoleY：比这个高度矮的东西挡不住人，不开窗
  const HOLE = 'uniform vec4 uHole; uniform float uHoleY;\n';
  const HOLE_CUT = '  if (vDep < uHole.w && vWp.y > uHoleY) { float hd = length(gl_FragCoord.xy - uHole.xy) / uHole.z; if (hd < 1.0 && bayer4(gl_FragCoord.xy) > smoothstep(0.68, 1.0, hd)) discard; }';

  function createOpen(view, tier, A) {
    const T3 = window.THREE;
    if (!T3) return null;
    const Q = TIERS[tier] || TIERS.mid;
    const canvas = document.createElement('canvas');
    canvas.className = 'w-canvas';
    let renderer;
    try {
      renderer = new T3.WebGLRenderer({ canvas, antialias: !Q.post && tier !== 'low', alpha: false, stencil: false, powerPreference: 'default' });
    } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    view.prepend(canvas);
    // 画面丢了（和 world3d.js 一样的约定）：'ok' / 'lost' 刚丢 / 'restored' 恢复了 / 'dead' 2.5 秒还没恢复，后两种由 world.js 整个重建
    const gl = { lost: 0, restored: false };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); gl.lost = performance.now(); gl.restored = false; }, false);
    canvas.addEventListener('webglcontextrestored', () => { gl.restored = true; }, false);
    const glState = () => (!gl.lost ? 'ok' : gl.restored ? 'restored' : performance.now() - gl.lost > 2500 ? 'dead' : 'lost');
    renderer.shadowMap.enabled = !!Q.shadow;
    renderer.shadowMap.type = T3.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = T3.NoToneMapping;
    renderer.info.autoReset = false;

    const scene = new T3.Scene();
    const camera = new T3.PerspectiveCamera(56, 1, .5, Q.far * 2.2);
    camera.rotation.order = 'YXZ';
    // 光：太阳在左边、稍微靠镜头这一侧、高高的（画面左上角亮一片就是它）——树冠、山、石头左边亮右边暗，形状靠明暗分出来；
    // 朝西的墙、朝着镜头的墙和屋顶是亮面（屋檐在墙上压一道影子），朝东的背光；影子往右后方落在地上。
    // 天光偏蓝紫（影子里只有它，所以影子是蓝紫色的），地面反上来的光偏暖，太阳是暖黄的。three 的漫反射要除以 π，所以强度都乘了 π
    const SUN_DIR = new T3.Vector3(-.64, .66, .4).normalize();
    const hemi = new T3.HemisphereLight(0xdce1ff, 0xefe2c4, Math.PI * .68);
    const sun = new T3.DirectionalLight(0xfff0b8, Math.PI * .54);
    scene.add(hemi, sun, sun.target);
    if (Q.shadow) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      const e = tier === 'high' ? 24 : 17;
      Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 96 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.04;
      sun.shadow.radius = tier === 'high' ? 5 : 3;   // 影子的边是软的（影子图上糊这么多个像素）
    }

    // ---------- 公用的量和贴图 ----------
    const C = h => new T3.Color(h);
    const U = {
      uTime: { value: 0 }, uPlayer: { value: new T3.Vector3(-99, 0, -99) }, uFollow: { value: new T3.Vector3(-99, 0, -99) },
      uHole: { value: new T3.Vector4(0, 0, 1, -1) }, uHoleY: { value: 0 },
      uFogA: { value: C('#bcd6ee') }, uHaze: { value: C('#f6ead6') }, uFogP: { value: new T3.Vector3(16, .017, Q.far) },
      uNoise: { value: null }, uSunC: { value: C('#ffffff') },          // 噪声贴图；太阳照到一个纯白的面上有多亮（着色器里用它算「这一点被太阳照到了多少」）
      uCamT: { value: new T3.Vector3() }, uGrassD: { value: new T3.Vector4(8, 26, 5, 9) },   // 草的远近：围着哪一点（主角前面一点）、多远以内是满的、多远以外没有、离镜头多近开始变稀
    };
    U.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity / Math.PI);
    // 明暗的台阶。硬的三档（房子、物件）：背光 0、半亮、亮面 1，档和档之间只留很窄的一点过渡（像手绘的色块边）；
    // 软的两档（地面、草、树冠、山）：暗面和亮面之间是一条宽宽的、柔和的过渡带，圆的东西看起来就是软的一团
    const ramp = fn => {
      const n = 64, d = new Uint8Array(n);
      for (let i = 0; i < n; i++) d[i] = Math.round(255 * fn((i + .5) / n * 2 - 1));
      const t = new T3.DataTexture(d, n, 1, T3.RedFormat); t.minFilter = t.magFilter = T3.LinearFilter; t.needsUpdate = true;
      return t;
    };
    const rampTex = ramp(x => .5 * sstep(-.5, -.4, x) + .5 * sstep(.24, .33, x));
    const softTex = ramp(x => .55 * sstep(-.5, .2, x) + .45 * sstep(.05, .8, x));
    // 3D 小人用的：和硬的那种一样是三档，只是背光那一档退得更靠后。小人的脸是一整块用同一个法线（见 people3d.js 的 FACE_N），朝东走时它离「半亮 / 背光」的交界很近，
    // 头一晃整张脸会忽明忽暗；交界挪到 -0.6 以后，四个朝向都离交界有余量（朝南、朝西是亮面，朝东、朝北是半亮）
    const personTex = ramp(x => .5 * sstep(-.75, -.6, x) + .5 * sstep(.24, .33, x));
    // 噪声贴图（四个通道四种粗细，首尾相接）：地面的色块、路边不整齐的边、水面的亮点都查它
    const noiseTex = (() => {
      const n = 128, d = new Uint8Array(n * n * 4), per = [8, 16, 32, 4];
      for (let c = 0; c < 4; c++) {
        const P = per[c], cell = n / P, lat = (i, j) => hash2(((i % P) + P) % P + c * 57, ((j % P) + P) % P + c * 131);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const gx = x / cell, gy = y / cell, xi = Math.floor(gx), yi = Math.floor(gy), fx = gx - xi, fy = gy - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
          const a = lat(xi, yi), b = lat(xi + 1, yi), e = lat(xi, yi + 1), f = lat(xi + 1, yi + 1);
          d[(y * n + x) * 4 + c] = Math.round(255 * (a + (b - a) * u + (e - a) * v + (a - b - e + f) * u * v));
        }
      }
      const t = new T3.DataTexture(d, n, n); t.wrapS = t.wrapT = T3.RepeatWrapping; t.magFilter = T3.LinearFilter; t.minFilter = T3.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      return t;
    })();
    U.uNoise.value = noiseTex;
    const keep = [rampTex, softTex, personTex, noiseTex];   // 一直留着的贴图 / 几何体 / 材质，destroy 时才放
    function canvasTex(w, h, fn, srgb) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      fn(c.getContext('2d'), w, h);
      const t = new T3.CanvasTexture(c);
      if (srgb !== false) t.colorSpace = T3.SRGBColorSpace;
      return t;
    }
    const blobTex = canvasTex(64, 64, g => {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(22,40,84,.5)'); gr.addColorStop(.55, 'rgba(22,40,84,.3)'); gr.addColorStop(1, 'rgba(22,40,84,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    keep.push(blobTex);

    // ---------- 画出来的贴图：树叶和草边（都在一张图上）、地面的细节 ----------
    // 树叶贴图：一簇阔叶（两种）、一整片棕榈叶（中间一根浅色的叶脉，两边是一条条剪开的小叶）、垂在石坎边上的一排草。
    // 颜色都画得很浅（接近白），真正的绿来自顶点颜色，所以每座岛都用这一张。LEAF[名字] = 这一块在图上的位置 [u0, v0, u1, v1]
    const LEAF = {};
    const leafTex = (() => {
      const W = Q.leaf, cv = document.createElement('canvas'); cv.width = cv.height = W;
      const g = cv.getContext('2d'), k = W / 1024;
      const cell = (name, x, y, w, h, draw) => {
        g.save(); g.setTransform(k, 0, 0, k, x * k, y * k); g.beginPath(); g.rect(1, 1, w - 2, h - 2); g.clip(); draw(w, h); g.restore();
        const pad = 2 / 1024; LEAF[name] = [x / 1024 + pad, y / 1024 + pad, (x + w) / 1024 - pad, (y + h) / 1024 - pad];   // 这张图不上下翻（DataTexture），v 从上往下
      };
      // 一片叶子：尖朝上，一半亮一半暗（像折了一下），中间一道叶脉
      const leaf = (x, y, rot, len, wd, v) => {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.beginPath(); g.moveTo(0, len * .36); g.quadraticCurveTo(wd, len * .02, 0, -len * .64); g.quadraticCurveTo(-wd, len * .02, 0, len * .36);
        g.fillStyle = 'rgb(' + v + ',' + Math.min(255, v + 5) + ',' + Math.round(v * .9) + ')'; g.fill();
        g.beginPath(); g.moveTo(0, len * .36); g.quadraticCurveTo(wd, len * .02, 0, -len * .64); g.closePath();
        g.fillStyle = 'rgba(120,150,120,.2)'; g.fill();
        g.strokeStyle = 'rgba(255,255,244,.55)'; g.lineWidth = Math.max(1.2, wd * .07); g.beginPath(); g.moveTo(0, len * .3); g.lineTo(0, -len * .52); g.stroke();
        g.restore();
      };
      const clump = seed => (w, h) => {
        const R = (i, j) => hash2(i * 7 + j * 131, seed), cx = w / 2, by = h - 12;
        g.fillStyle = 'rgb(226,236,214)'; g.beginPath(); g.ellipse(cx, by - 34, w * .3, h * .2, 0, 0, 6.283); g.fill();
        const list = [];
        for (let i = 0; i < 74; i++) { const a = (R(i, 1) * 2 - 1) * 1.45, d = (.2 + R(i, 2) * .62 * Math.cos(a * .55)) * h; list.push([a, d, i]); }
        list.sort((p, q) => q[1] - p[1]);   // 外面的先画，里面的盖在上面
        list.forEach(([a, d, i]) => {
          const len = (.15 + R(i, 3) * .1) * h;
          leaf(cx + Math.sin(a) * d * .72, by - 8 - Math.cos(a) * d, a + (R(i, 5) - .5) * 1.0, len, len * (.34 + R(i, 4) * .12), 218 + Math.floor(R(i, 6) * 37));
        });
      };
      cell('clump', 0, 0, 384, 384, clump(11));
      cell('clumpB', 384, 0, 384, 384, clump(23));
      // 棕榈叶：叶柄在左、叶尖在右；小叶一条一条斜着往叶尖那边长，条和条之间留着缝
      cell('frond', 0, 384, 1024, 256, (w, h) => {
        const N = 36, my = h / 2;
        for (let side = -1; side <= 1; side += 2) for (let i = 0; i < N; i++) {
          const t = (i + (side > 0 ? .5 : 0)) / N, x = 34 + t * 890, len = (h / 2 - 9) * Math.pow(Math.sin(Math.PI * (.05 + .9 * t)), .5) * (.88 + hash2(i, 31 + side) * .12), sweep = .42 + t * .5;
          const ex = x + len * sweep, ey = my + side * len, wd = 13.5 - t * 5, v = 222 + Math.floor(hash2(i, 37 + side) * 33);
          g.beginPath(); g.moveTo(x - wd * .9, my); g.quadraticCurveTo(x + (ex - x) * .3 - wd * .5, my + side * len * .55, ex, ey); g.quadraticCurveTo(x + (ex - x) * .62 + wd * .9, my + side * len * .42, x + wd * 1.5, my); g.closePath();
          g.fillStyle = 'rgb(' + (v - 10) + ',' + v + ',' + Math.round(v * .84) + ')'; g.fill();
          g.strokeStyle = 'rgba(92,124,96,.34)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + wd * 1.5, my); g.quadraticCurveTo(x + (ex - x) * .62 + wd * .9, my + side * len * .42, ex, ey); g.stroke();
        }
        g.beginPath(); g.moveTo(6, my - 8); g.lineTo(1004, my - 1.6); g.lineTo(1004, my + 1.6); g.lineTo(6, my + 8); g.closePath(); g.fillStyle = 'rgb(255,255,236)'; g.fill();
      });
      // 草边：上面一条是实的（盖在石坎顶上），下面垂着长长短短的草
      cell('fringe', 0, 640, 1024, 128, (w, h) => {
        g.fillStyle = 'rgb(224,234,208)'; g.fillRect(0, 0, w, 40);
        for (let i = 0; i < 170; i++) {
          const x = hash2(i, 51) * w, len = 26 + hash2(i, 52) * 60, wd = 4.5 + hash2(i, 53) * 5, bend = (hash2(i, 54) - .5) * 34, v = 198 + Math.floor(hash2(i, 55) * 56);
          g.beginPath(); g.moveTo(x - wd, 34); g.quadraticCurveTo(x - wd * .3 + bend * .4, 34 + len * .6, x + bend, 34 + len); g.quadraticCurveTo(x + wd * .6 + bend * .4, 34 + len * .5, x + wd, 34); g.closePath();
          g.fillStyle = 'rgb(' + (v - 12) + ',' + v + ',' + Math.round(v * .82) + ')'; g.fill();
        }
      });
      // 透明的地方颜色不能是黑的（不然叶子边上会糊出一圈黑边）：没画到的像素一律填成叶子的浅色，只有透明度管镂空
      const im = g.getImageData(0, 0, W, W), d = im.data;
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a < 255) { const b = 255 - a; d[i] = (d[i] * a + 222 * b) / 255; d[i + 1] = (d[i + 1] * a + 232 * b) / 255; d[i + 2] = (d[i + 2] * a + 206 * b) / 255; } }
      const t = new T3.DataTexture(new Uint8Array(d.buffer), W, W);
      t.colorSpace = T3.SRGBColorSpace; t.magFilter = T3.LinearFilter; t.minFilter = T3.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
      return t;
    })();
    // 地面的细节（首尾相接地铺）：红 = 小路上的碎石子，绿 = 沙地上的沙粒和一道道波纹，蓝 = 草地上一笔一笔的草叶。脚边的地面靠它才清楚，远了就淡掉
    const detailTex = (() => {
      const W = Q.detail, k = W / 512, layer = fn => {
        const c = document.createElement('canvas'); c.width = c.height = W;
        const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, W, W);
        // 每样东西在四周多画一遍，贴图就首尾相接了
        const wrap = (x, y, r, draw) => { for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const px = x + ox * 512, py = y + oy * 512; if (px < -r || py < -r || px > 512 + r || py > 512 + r) continue; g.save(); g.setTransform(k, 0, 0, k, px * k, py * k); draw(g); g.restore(); } };
        fn(g, wrap);
        return g.getImageData(0, 0, W, W).data;
      };
      const grey = v => 'rgb(' + v + ',' + v + ',' + v + ')';
      const gravel = layer((g, wrap) => {
        for (let i = 0; i < 1500; i++) { const r = .8 + hash2(i, 61) * 1.3, v = hash2(i, 62) > .5 ? 172 : 88; wrap(hash2(i, 63) * 512, hash2(i, 64) * 512, r, q => { q.fillStyle = grey(v); q.beginPath(); q.arc(0, 0, r, 0, 6.283); q.fill(); }); }
        for (let i = 0; i < 430; i++) {
          const r = 2.6 + hash2(i, 65) * hash2(i, 66) * 7, rot = hash2(i, 67) * 3.14, sq = .58 + hash2(i, 68) * .34, lt = hash2(i, 69) > .42;
          wrap(hash2(i, 70) * 512, hash2(i, 71) * 512, r * 1.4, q => { q.rotate(rot); q.fillStyle = grey(62); q.beginPath(); q.ellipse(r * .14, r * .2, r, r * sq, 0, 0, 6.283); q.fill(); q.fillStyle = grey(lt ? 206 : 150); q.beginPath(); q.ellipse(0, 0, r, r * sq, 0, 0, 6.283); q.fill(); q.fillStyle = grey(lt ? 236 : 178); q.beginPath(); q.ellipse(-r * .22, -r * .2, r * .5, r * sq * .45, 0, 0, 6.283); q.fill(); });
        }
      });
      const sandL = layer((g, wrap) => {
        g.setTransform(k, 0, 0, k, 0, 0); g.lineCap = 'round';
        for (let row = 0; row < 26; row++) {
          const y0 = (row + .5) * 512 / 26, ph = hash2(row, 72) * 6.283, a2 = 2.5 + hash2(row, 73) * 3;
          [[0, 104, 2.4], [-2.6, 166, 2]].forEach(([oy, v, lw]) => { g.strokeStyle = grey(v); g.lineWidth = lw; g.beginPath(); for (let x = -8; x <= 520; x += 8) { const y = y0 + oy + Math.sin(x / 512 * 6.283 * 2 + ph) * a2 + Math.sin(x / 512 * 6.283 * 5 + ph * 2) * 1.2; if (x === -8) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); });
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < 2600; i++) { const r = .6 + hash2(i, 74) * .9, v = hash2(i, 75) > .5 ? 168 : 92; wrap(hash2(i, 76) * 512, hash2(i, 77) * 512, r, q => { q.fillStyle = grey(v); q.beginPath(); q.arc(0, 0, r, 0, 6.283); q.fill(); }); }
      });
      const strokes = layer((g, wrap) => {
        for (let i = 0; i < 3400; i++) {
          const len = 7 + hash2(i, 78) * 15, rot = (hash2(i, 79) - .5) * .8, v = 128 + Math.round((hash2(i, 80) - .45) * 120), wd = 1.3 + hash2(i, 81) * 1.5;
          wrap(hash2(i, 82) * 512, hash2(i, 83) * 512, len, q => { q.rotate(rot); q.fillStyle = grey(Math.max(40, Math.min(240, v))); q.beginPath(); q.moveTo(-wd, len * .5); q.quadraticCurveTo(-wd * .6, 0, 0, -len * .5); q.quadraticCurveTo(wd * .6, 0, wd, len * .5); q.closePath(); q.fill(); });
        }
      });
      const out = new Uint8Array(W * W * 4);
      for (let i = 0; i < W * W; i++) { out[i * 4] = gravel[i * 4]; out[i * 4 + 1] = sandL[i * 4]; out[i * 4 + 2] = strokes[i * 4]; out[i * 4 + 3] = 255; }
      const t = new T3.DataTexture(out, W, W);
      t.wrapS = t.wrapT = T3.RepeatWrapping; t.magFilter = T3.LinearFilter; t.minFilter = T3.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = tier === 'high' ? 8 : 4; t.needsUpdate = true;
      return t;
    })();
    keep.push(leafTex, detailTex);

    // ---------- 材质：在 three 的卡通材质上加几样东西 ----------
    // 每种材质都有的：云影（太阳光被云挡掉一些）、影子和背光面偏蓝紫、隔着空气的雾。
    // o.wind 随风摆（树）；o.flutter 叶片自己再抖一抖；o.grass 草叶（颜色跟着脚下的地面、成片的风浪、被主角踩开、远了缩回地里）；o.lod 小东西远了缩没；
    // o.occ 挡住主角时开圆窗（见上面的 HOLE）；o.fade 用网点淡出去（房子：uFade 淡掉多少，uFadeY 这个高度以下的墙基留着）；o.floor 淡出去以后墙基里面画木地板；
    // o.flag 后期描边认不认它（写在 alpha 里：1 描、0 不描、中间的值是淡淡的一条）；o.terrain 地面（按遮罩图分草 / 路 / 沙）；o.rock 石头侧面画一层层的岩层；
    // o.leaf 树叶（法线不按正反面翻，亮面偏暖黄绿、暗面偏冷蓝绿）；o.rim 逆光的那一圈暖色亮边有多强；o.sprite 人物（不会被照得太暗太亮；纸片人左上边缘一道暖光，3D 小人用 o.prim：朝着太阳那一侧的轮廓一圈暖光）；
    // o.cloud 云影有多重（0 = 不受云影）
    const GRASS_VPARS = 'attribute vec3 aB; uniform sampler2D uNoise; uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uTall; uniform vec3 uCamT; uniform vec4 uGrassD; varying vec3 vGc;\n';
    const GRASS_V = [
      'float tallK = step(0.5, aB.z) * step(aB.z, 2.5);',
      'vec3 ic = vec3(0.5);',
      '#ifdef USE_INSTANCING_COLOR', 'ic = instanceColor;', '#endif',
      // 离主角越远留下的越少：每一簇有自己的「最远能留到哪」，过了就缩回地里——没有一条分界线；离镜头太近的也抽掉一些，不然画面最下面全是放大的草叶
      'float gThr = mix(uGrassD.x, uGrassD.y, ic.r) * (1.0 + 0.55 * tallK);',
      'float keepK = 1.0 - smoothstep(-2.2, 0.0, length(ip.xz - uCamT.xz) - gThr);',
      'keepK *= clamp((smoothstep(uGrassD.z, uGrassD.w, length(ip - cameraPosition)) * 1.4 + 0.25 - ic.b) * 4.0, 0.0, 1.0);',
      'transformed *= keepK;',
      // 根的颜色 = 脚下那块地面的颜色（和地面着色器同一个算法），所以草是从地里「长」出来的
      'vec4 gz = texture2D(uNoise, ip.xz * 0.041);',
      'vec3 gc = mix(uG0, uG1, smoothstep(0.42, 0.54, gz.r)); gc = mix(gc, uG2, smoothstep(0.54, 0.64, gz.g) * 0.85);',
      'float hy = max(0.0, transformed.y) * isc;',
      // 风：一道道大浪从远处扫过来（浪头上的草尖发亮、弯得更低），浪和浪之间是细碎的小摆动；再加上树也认的那一阵阵风
      'float ph = dot(ip.xz, vec2(0.30, 0.17)) - uTime * 0.9 + gz.a * 5.0;',
      'float wv = sin(ph) * 0.5 + 0.5; float sheen = smoothstep(0.58, 1.0, wv);',
      'float wv2 = sin(dot(ip.xz, vec2(-0.55, 0.8)) - uTime * 1.9 + gz.r * 4.0);',
      'float gu = gustAt(ip.xz); float fl = sin(uTime * 5.3 + ip.x * 3.1 + ip.z * 2.3 + aB.y * 6.0);',
      'float bend = (0.06 + 0.22 * wv + 0.36 * sheen + 0.07 * wv2 + gu * (0.7 + 0.25 * fl)) * (1.0 + 0.15 * tallK) + (fl * 0.06 + wv2 * 0.07) * tallK;',
      'oW.x += bend * aB.x * hy * 0.86; oW.z += bend * aB.x * hy * 0.5; oW.y -= abs(bend) * aB.x * hy * 0.3;',
      'vGust = (sheen * 0.9 + gu * 0.7 + wv * 0.1) * aB.x * aB.x;',
      // 主角和怪兽走过，脚边的草往两边倒
      'vec2 dp = ip.xz - uPlayer.xz; float pd = length(dp); float pu = 1.0 - smoothstep(0.12, 0.7, pd); oW.xz += dp / max(pd, 0.05) * pu * hy * 0.62; oW.y -= pu * hy * 0.34;',
      'dp = ip.xz - uFollow.xz; pd = length(dp); pu = 1.0 - smoothstep(0.12, 0.6, pd); oW.xz += dp / max(pd, 0.05) * pu * hy * 0.5; oW.y -= pu * hy * 0.26;',
      // 颜色：从根到尖只有最上面一小截变浅变黄；草丛深、草穗是麦色；三叶草、小花各有各的颜色
      'vec3 gRoot = mix(gc * (0.97 + 0.06 * ic.g), uTall * 0.84, tallK);',
      'vec3 gTip = mix(gc * 1.12 + vec3(0.085, 0.085, -0.012), uTall * 1.32 + vec3(0.07, 0.11, 0.0), tallK);',
      'float tk = smoothstep(0.2, 1.0, aB.x);',
      'vGc = mix(gRoot, gTip, tk * tk);',
      'if (aB.z > 1.5) vGc = mix(gTip, vec3(0.84, 0.74, 0.40), 0.6);',
      'if (aB.z > 2.5) vGc = gc * vec3(0.82, 1.05, 0.9) + vec3(0.0, 0.04, 0.012) + aB.y * 0.07;',
      'if (aB.z > 3.5) vGc = mix(vec3(1.0, 0.97, 0.93), mix(vec3(1.0, 0.74, 0.82), vec3(1.0, 0.87, 0.36), step(0.75, ic.g)), step(0.45, ic.g));',
      'if (aB.z > 4.5) vGc = vec3(1.0, 0.72, 0.16);',
    ].join('\n');
    function paint(mat, o) {
      mat.userData.o = o;
      const flag = !Q.post || o.flag == null ? 1 : o.flag, cs = o.cloud == null ? .58 : o.cloud;   // 直接画到屏幕上（省电档）时 alpha 必须是 1，不然画布会透出网页的底色
      mat.onBeforeCompile = sh => {
        const u = sh.uniforms;
        u.uTime = U.uTime; u.uPlayer = U.uPlayer; u.uFollow = U.uFollow; u.uHole = U.uHole; u.uHoleY = U.uHoleY; u.uFogA = U.uFogA; u.uHaze = U.uHaze; u.uFogP = U.uFogP;
        u.uNoise = U.uNoise; u.uSunC = U.uSunC; u.uCamT = U.uCamT; u.uGrassD = U.uGrassD;
        if (mat.userData.u) Object.assign(u, mat.userData.u);
        const v = ['#include <begin_vertex>', 'vec3 oW = vec3(0.0); vGust = 0.0;',
          '#ifdef USE_INSTANCING', 'vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float isc = length(instanceMatrix[1].xyz);', '#else', 'vec3 ip = vec3(0.0); float isc = 1.0;', '#endif'];
        if (o.lod) v.push('transformed *= 1.0 - smoothstep(' + o.lod[0].toFixed(1) + ', ' + o.lod[1].toFixed(1) + ', length(ip.xz - uCamT.xz));');
        if (o.wind) v.push(
          'float wy = max(0.0, transformed.y) * isc; float gu = gustAt(ip.xz); float ph = ip.x * 0.8 + ip.z * 0.6;',
          'oW.x += (sin(uTime * 1.5 + ph) * ' + o.wind.toFixed(4) + ' + gu * ' + (o.wind * 2.6).toFixed(4) + ' * (1.0 + 0.3 * sin(uTime * 4.3 + ph))) * wy;',
          'oW.z += (cos(uTime * 1.1 + ph * 0.7) * ' + (o.wind * .5).toFixed(4) + ' + gu * ' + (o.wind * 1.4).toFixed(4) + ') * wy;');
        if (o.flutter) v.push('oW.xy += vec2(sin(uTime * 2.7 + ip.x * 1.7 + transformed.y * 6.0 + transformed.x * 5.0), cos(uTime * 2.2 + ip.z * 1.3 + transformed.x * 7.0)) * (0.012 + 0.02 * gustAt(ip.xz)) * isc;');
        if (o.grass) v.push(GRASS_V);
        if (o.rock) v.push('vNy = normal.y;');
        // o.tintW：每个实例的颜色只染「纯白」的顶点（铅笔的笔杆和笔芯、棒棒糖的糖、蜡笔花丛的花），别的顶点（木头、商标纸、叶子）只跟着轻轻深浅一点
        if (o.tintW) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', ['#include <color_vertex>', '#if defined( USE_INSTANCING_COLOR ) && defined( USE_COLOR )',
          '  { float wk = step(2.99, color.r + color.g + color.b); vColor.rgb = color * mix(vec3(0.93 + 0.14 * fract(instanceColor.r * 7.0 + instanceColor.b * 3.0)), instanceColor.rgb, wk); }', '#endif'].join('\n'));
        sh.vertexShader = 'uniform highp float uTime; uniform vec3 uPlayer; uniform vec3 uFollow; varying float vGust; varying highp float vDep; varying highp vec3 vWp;\n' + (o.grass ? GRASS_VPARS : o.lod ? 'uniform vec3 uCamT;\n' : '') + (o.rock ? 'varying float vNy;\n' : '') + GUST +
          sh.vertexShader.replace('#include <begin_vertex>', v.join('\n'))
            .replace('#include <project_vertex>', ['vec4 mvPosition = vec4(transformed, 1.0);', '#ifdef USE_INSTANCING', 'mvPosition = instanceMatrix * mvPosition;', '#endif',
              'mvPosition = modelMatrix * mvPosition; mvPosition.xyz += oW; vWp = mvPosition.xyz;', 'mvPosition = viewMatrix * mvPosition; vDep = -mvPosition.z;', 'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
        let f = 'uniform highp float uTime; uniform vec3 uSunC; varying float vGust; varying highp float vDep; varying highp vec3 vWp;\n' + FOG_PARS + CLOUD + BAYER + HOLE + (o.terrain ? TERRAIN_PARS : '') + (o.grass ? 'varying vec3 vGc;\n' : '') + (o.rock ? 'varying float vNy;\n' : '') + sh.fragmentShader;
        if (o.occ) f = f.replace('void main() {', 'void main() {\n' + HOLE_CUT);
        if (o.fade) f = 'uniform float uFade; uniform float uFadeY;\n' + f.replace('void main() {', 'void main() {\n  if (uFade > 0.01 && vWp.y > uFadeY && bayer4(gl_FragCoord.xy + 2.0) < uFade) discard;');
        // 房子淡出去以后剩下的那块墙基顶面：里面画成木地板（一条条木板、墙根暗一圈），像把房子剖开看——原来是一整块灰白的板，占掉小半个屏幕很难看
        if (o.floor) f = 'uniform vec4 uRect;\n' + f.replace('#include <color_fragment>', ['#include <color_fragment>',
          '  if (uFade > 0.01 && vWp.y > uFadeY - 0.04 && vWp.y < uFadeY + 0.002) {',
          '    vec2 fe = min(vWp.xz - uRect.xy, uRect.zw - vWp.xz); float rim = min(fe.x, fe.y);',
          '    float inK = smoothstep(0.11, 0.13, rim) * smoothstep(0.0, 0.6, uFade);',
          '    float row = vWp.z * 2.6; float pl = fract(row); float rid = floor(row);',
          '    float seam = smoothstep(0.0, 0.05, pl) * (1.0 - smoothstep(0.95, 1.0, pl));',
          '    float butt = smoothstep(0.0, 0.012, fract(vWp.x * 0.55 + fract(rid * 0.37)));',
          '    vec3 wood = mix(vec3(0.62, 0.40, 0.21), vec3(0.53, 0.33, 0.17), fract(rid * 0.618));',
          '    wood *= 0.78 + 0.22 * seam * butt;',
          '    wood *= 1.0 - 0.28 * (1.0 - smoothstep(0.13, 0.34, rim));',
          '    diffuseColor.rgb = mix(diffuseColor.rgb, wood, inK);',
          '  }'].join('\n'));
        if (o.terrain) f = f.replace('#include <color_fragment>', TERRAIN_COLOR);
        if (o.grass) f = f.replace('#include <color_fragment>', 'diffuseColor.rgb = vGc * (1.0 + vGust * 0.36) + vec3(0.085, 0.085, 0.02) * vGust;');
        // 石头：侧面画上一层层的岩层（层和层深浅不一样，层之间一道细缝，线跟着噪声弯一弯）；朝上的面不画
        if (o.rock) f = f.replace('#include <color_fragment>', ['#include <color_fragment>',
          '  { float st = vWp.y * 3.3 + texture2D(uNoise, vWp.xz * 0.11 + vWp.y * 0.07).r * 1.5; float bd = fract(st); float id = floor(st);',
          '    float tone = 0.88 + 0.22 * fract(sin(id * 12.99) * 43758.5); float seam = smoothstep(0.0, 0.09, bd);',
          '    float gr = texture2D(uNoise, vec2(vWp.x + vWp.z, vWp.y * 3.0) * 0.6).g;',
          '    diffuseColor.rgb *= mix(1.0, tone * (0.8 + 0.2 * seam) * (0.94 + 0.12 * gr), 1.0 - smoothstep(0.45, 0.8, vNy));',
          // 顶面：一块块深浅不一（草皮、雪、苔藓不是一整块平平的颜色）
          '    float tk = smoothstep(0.6, 0.9, vNy); diffuseColor.rgb *= 1.0 + tk * (0.16 * (texture2D(uNoise, vWp.xz * 0.19).r - 0.5) + 0.1 * (texture2D(uNoise, vWp.xz * 1.1 + 0.3).g - 0.5)); }'].join('\n'));
        if (o.leaf) f = f.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
        // 光：云影挡掉一部分太阳光；背光和影子里偏蓝紫；树叶亮面偏暖、暗面偏冷；逆光的边上一圈暖色
        const L = ['{ float cs = cloudSh(vWp.xz) * ' + cs.toFixed(2) + ';',
          '  float lit0 = clamp(dot(reflectedLight.directDiffuse, vec3(1.0)) / max(dot(diffuseColor.rgb, uSunC), 0.0001), 0.0, 1.0); float lit = lit0 * (1.0 - cs);',
          '  reflectedLight.directDiffuse *= 1.0 - cs;',
          '  reflectedLight.indirectDiffuse *= mix(vec3(0.92, 0.95, 1.09), vec3(1.0), lit0) * (1.0 - 0.12 * cs);'];   // 蓝紫只给背光面和东西投下的影子；云影只是太阳光少了一截
        if (o.leaf) L.push('  reflectedLight.directDiffuse *= vec3(1.12, 1.03, 0.76); reflectedLight.indirectDiffuse *= mix(vec3(0.80, 0.98, 1.12), vec3(1.0, 1.0, 0.96), lit);');
        if (o.rim) L.push('#if NUM_DIR_LIGHTS > 0',
          '  { float rk = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0) * smoothstep(-0.35, 0.5, dot(normal, directionalLights[0].direction)) * (1.0 - smoothstep(16.0, 40.0, vDep));',
          '    reflectedLight.directDiffuse += (diffuseColor.rgb * 0.6 + 0.4) * uSunC * rk * ' + o.rim.toFixed(2) + ' * (1.0 - cs); }',
          '#endif');
        L.push('}');
        f = f.replace('#include <aomap_fragment>', L.join('\n'));
        if (o.sprite) f = f.replace('#include <opaque_fragment>', ['outgoingLight = clamp(outgoingLight, diffuseColor.rgb * 0.7, diffuseColor.rgb * 1.06);'].concat(o.prim ? [
          '#if NUM_DIR_LIGHTS > 0',
          '  { float rk = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5) * smoothstep(-0.2, 0.6, dot(normal, directionalLights[0].direction));',
          '    outgoingLight += (diffuseColor.rgb * 0.5 + vec3(0.5, 0.44, 0.3)) * rk * ' + o.prim.toFixed(2) + ' * (1.0 - 0.6 * cloudSh(vWp.xz)); }',
          '#endif'] : [
          '#ifdef USE_MAP',
          '  { float aN = texture2D(map, vMapUv + vec2(-0.010, 0.018)).a; outgoingLight += vec3(1.0, 0.86, 0.62) * (1.0 - smoothstep(0.25, 0.75, aN)) * 0.3 * (1.0 - 0.6 * cloudSh(vWp.xz)); }',
          '#endif'], ['#include <opaque_fragment>']).join('\n'));
        f = f.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = airFog(gl_FragColor.rgb, vDep, vWp.y);')
          .replace('#include <fog_fragment>', '')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = ' + flag.toFixed(2) + ';');
        sh.fragmentShader = f;
      };
      mat.customProgramCacheKey = () => 'open:' + o.key;
      return mat;
    }
    const toon = (opts, o) => { const m = paint(new T3.MeshToonMaterial(Object.assign({ gradientMap: rampTex, vertexColors: true }, opts || {})), o); keep.push(m); return m; };

    // 地面：遮罩图的红 = 小路，绿 = 沙地和水底，蓝 = 草丛；顶点颜色的红 = 山上的林地，绿 = 靠水的湿沙，蓝 = 地图外面有多远
    const TERRAIN_PARS = 'uniform sampler2D uMask; uniform sampler2D uDetail; uniform vec4 uMapO; uniform float uSeaY; uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uTall; uniform vec3 uForest; uniform vec3 uSand; uniform vec3 uSandWet; uniform vec3 uPath; uniform vec3 uPathRim; uniform float uPathK; uniform float uSandK;\n' +
      // 蜡笔、糖粒用的五种颜色
      'vec3 crayonC(float h) { return h < 0.2 ? vec3(1.0, 0.55, 0.6) : h < 0.4 ? vec3(1.0, 0.84, 0.4) : h < 0.6 ? vec3(0.5, 0.76, 1.0) : h < 0.8 ? vec3(0.56, 0.86, 0.5) : vec3(0.8, 0.62, 1.0); }\n' +
      // 一格一格的砖 / 石板：返回 (离缝多远, 这一块的编号算出来的 0…1)。k：每格几块；off：隔一行错开半块
      // 远了缝和深浅都淡掉（不然远处一大片缝会闪、会变成一格格的棋盘）
      'vec2 slab(highp vec2 p, float k, float off) { highp vec2 q = p * k; q.x += off * step(1.0, mod(floor(q.y), 2.0)) * 0.5; vec2 f = fract(q); float fk = smoothstep(16.0, 34.0, vDep); return mix(vec2(min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), fract(sin(dot(floor(q), vec2(12.9898, 78.233))) * 43758.5453)), vec2(0.5), fk); }\n';
    const TERRAIN_COLOR = [
      '{ vec2 muv = (vWp.xz - uMapO.xy) * uMapO.zw;',
      '  vec4 nz = texture2D(uNoise, vWp.xz * 0.041); vec4 nd = texture2D(uNoise, vWp.xz * 0.33);',
      // 细节：脚边清楚，远了淡掉
      '  float dK = 1.0 - smoothstep(10.0, 38.0, vDep); vec3 dt = (texture2D(uDetail, vWp.xz * 0.37).rgb - 0.5) * dK;',
      '  vec3 mk = texture2D(uMask, muv + (nd.rg - 0.5) * uMapO.zw * 0.34).rgb;',
      '  float outK = 1.0 - smoothstep(0.35, 0.95, vColor.b);',
      '  float pe = mk.r + (nd.b - 0.5) * 0.2 + dt.r * 0.12;',
      '  float pth = smoothstep(0.40, 0.55, pe) * outK;',
      '  float snd = smoothstep(0.41, 0.53, mk.g + (nd.b - 0.5) * 0.16 + dt.g * 0.08);',
      // 地图外面：贴着海面的那一圈是沙滩
      '  snd = max(snd, (1.0 - smoothstep(uSeaY + 0.16, uSeaY + 0.62, vWp.y + (nd.b - 0.5) * 0.3)) * smoothstep(0.03, 0.2, vColor.b));',
      '  float tal = smoothstep(0.34, 0.56, mk.b + (nd.g - 0.5) * 0.2 + dt.b * 0.1);',
      // 草地：三种绿，一大块一大块地换，块和块之间柔和过渡（草叶的根就是这个颜色）；上面一笔一笔顺着看过去的方向的草叶笔触，远处没有草叶的地方靠它接上
      '  vec3 gr = mix(uG0, uG1, smoothstep(0.42, 0.54, nz.r)); gr = mix(gr, uG2, smoothstep(0.54, 0.64, nz.g) * 0.85);',
      '  float stk = texture2D(uNoise, vec2(vWp.x * 1.9, vWp.z * 0.43)).g; float stk2 = texture2D(uNoise, vec2(vWp.x * 3.9 + 0.3, vWp.z * 0.95)).b;',
      '  gr *= 1.0 + 0.075 * (smoothstep(0.52, 0.7, stk) - smoothstep(0.52, 0.7, 1.0 - stk) * 0.8) + 0.05 * (stk2 - 0.5) + dt.b * 0.3;',
      '  gr = mix(gr, uTall * (0.88 + dt.b * 0.2), tal * 0.94);',
      '  gr = mix(gr, uForest * (0.96 + 0.1 * nd.r), vColor.r);',
      // 沙地：靠水的地方湿一点、深一点；一道道被水冲出来的波纹，脚边看得到沙粒
      '  vec3 sd = mix(uSand, uSandWet, vColor.g); float rp = sin(vWp.z * 7.5 + nz.a * 9.0 + nd.r * 2.2);',
      '  sd *= 1.0 - 0.035 * smoothstep(0.35, 0.9, rp) * (1.0 - vColor.g) + dt.g * 0.2;',
      // 不是海滩的「沙地」（只管干的地方，水底照旧是沙）：沙丘上风吹出来的大波纹 / 人行道的方砖 / 火山灰和碎石 / 雪
      '  if (uSandK > 0.5) { float dry = 1.0 - smoothstep(0.3, 0.7, vColor.g); vec3 s2;',
      '    if (uSandK < 1.5) { float w2 = sin(vWp.z * 3.1 + vWp.x * 0.7 + nz.a * 6.0 + nd.r * 1.5); s2 = uSand * (0.95 + 0.09 * nz.r) * (1.0 - 0.06 * smoothstep(0.2, 0.95, w2) + 0.03 * smoothstep(-0.9, -0.3, w2)) * (1.0 + dt.g * 0.16); }',
      '    else if (uSandK < 2.5) { vec2 sb = slab(vWp.xz, 2.0, 1.0); s2 = uSand * (0.93 + 0.1 * sb.y) * (1.0 - 0.16 * (1.0 - smoothstep(0.02, 0.06, sb.x))) * (1.0 + dt.r * 0.08); }',
      '    else if (uSandK < 3.5) { s2 = uSand * (0.84 + 0.2 * nd.r) * (1.0 + dt.r * 0.42) * (1.0 - 0.12 * smoothstep(0.62, 0.8, nz.g)); }',
      '    else { s2 = mix(uSand, vec3(1.0), 0.35) * (0.94 + 0.08 * nz.g + 0.03 * nd.b) + vec3(0.25) * step(0.93, texture2D(uNoise, vWp.xz * 5.3).a) * (1.0 - smoothstep(4.0, 14.0, vDep)); }',
      '    sd = mix(sd, s2, dry); }',
      // 小路：中间浅、边上一圈深一点（像用笔勾过），压实的地方深浅不匀，脚边看得到碎石子
      '  vec3 pc = mix(uPathRim, uPath, smoothstep(0.50, 0.80, pe)); pc *= 1.0 - 0.06 * smoothstep(0.5, 0.7, nz.b) + 0.04 * (nd.a - 0.5) + dt.r * 0.34;',
      // 别的小路：柏油马路（边上一道浅色的路牙）/ 石板路（一块块大小不一的石头，缝是深的）/ 方砖 / 糖果色（撒着彩色糖粒）/ 蜡笔涂过的（一道道斜着的彩色笔触）/ 踩实的雪
      '  if (uPathK > 0.5) {',
      '    if (uPathK < 1.5) { pc = uPath * (0.95 + 0.07 * (nd.a - 0.5)) * (1.0 + dt.r * 0.1); pc = mix(pc, uPathRim, smoothstep(0.43, 0.47, pe) * (1.0 - smoothstep(0.53, 0.57, pe)) * 0.9); }',
      '    else if (uPathK < 2.5) { vec2 sb = slab(vWp.xz + (nd.rg - 0.5) * 0.08, 1.7, 1.0); pc = mix(uPath * (0.86 + 0.24 * sb.y), uPathRim, (1.0 - smoothstep(0.035, 0.09, sb.x)) * 0.85) * (1.0 + dt.r * 0.14); pc = mix(pc, uPathRim, (1.0 - smoothstep(0.46, 0.56, pe)) * 0.5); }',
      '    else if (uPathK < 3.5) { vec2 sb = slab(vWp.xz, 2.0, 0.0); pc = mix(uPath * (0.95 + 0.08 * sb.y), uPathRim, (1.0 - smoothstep(0.015, 0.045, sb.x)) * 0.55); pc = mix(pc, uPathRim * 0.92, (1.0 - smoothstep(0.47, 0.55, pe)) * 0.7); }',
      '    else if (uPathK < 4.5) { float sp = texture2D(uNoise, vWp.xz * 3.3).a, sh = texture2D(uNoise, vWp.xz * 2.1 + 0.37).r; pc = mix(pc, mix(crayonC(fract(sh * 3.7)), vec3(1.0), 0.15), smoothstep(0.74, 0.77, sp) * (1.0 - smoothstep(6.0, 24.0, vDep))); }',
      '    else if (uPathK < 5.5) { float st = sin(dot(vWp.xz, vec2(4.2, 7.4)) + texture2D(uNoise, vWp.xz * 0.27).r * 7.0); float hh = texture2D(uNoise, vWp.xz * 0.045 + 0.3).b; pc = mix(pc, crayonC(fract(hh * 4.0 + floor(vWp.x * 0.25) * 0.2)) * 1.02, smoothstep(0.55, 0.8, st) * 0.32 * smoothstep(0.5, 0.7, pe)); }',
      '    else { pc = mix(uPath, vec3(0.97, 0.98, 1.0), 0.25 * nd.b) * (1.0 + dt.r * 0.1) * (1.0 - 0.05 * smoothstep(0.55, 0.75, nz.g)); }',
      '  }',
      '  vec3 col = mix(gr, sd, snd); col = mix(col, mix(pc, sd * 1.04, snd * 0.75), pth);',
      '  diffuseColor.rgb = col; }',
    ].join('\n');

    const terrainMat = (() => {
      const mt = new T3.MeshToonMaterial({ gradientMap: softTex, vertexColors: true });
      mt.userData.u = { uMask: { value: null }, uDetail: { value: detailTex }, uMapO: { value: new T3.Vector4(0, 0, 1, 1) }, uSeaY: { value: -1 }, uPathK: { value: 0 }, uSandK: { value: 0 } };
      ['uG0', 'uG1', 'uG2', 'uTall', 'uForest', 'uSand', 'uSandWet', 'uPath', 'uPathRim'].forEach(k => { mt.userData.u[k] = { value: C('#ffffff') }; });
      keep.push(mt);
      return paint(mt, { key: 'terrain', terrain: true, flag: 0 });
    })();
    const solidMat = toon({ shadowSide: T3.DoubleSide }, { key: 'solid', occ: true, flag: 0, rim: .5 });        // 拼在一起的静物（栅栏、码头、楼梯……）：不描边
    const thingMat = toon({ shadowSide: T3.DoubleSide }, { key: 'thing', occ: true, rim: .5 });                  // 能对着按 A 的静物（告示牌、地标）：留一圈细细的描边
    const rockMat = toon({ gradientMap: softTex, shadowSide: T3.DoubleSide }, { key: 'rock', occ: true, flag: 0, rock: true, rim: .35 });   // 石坎、岩壁、石头
    const propMat = toon({}, { key: 'prop', rim: .5 });                       // 会动 / 会消失的小物件（障碍、机关门、小船）
    const pebbleMat = toon({ gradientMap: softTex }, { key: 'pebble', flag: 0, lod: [tier === 'high' ? 20 : 13, tier === 'high' ? 30 : 20] });   // 路边的小石子：远了缩没
    const grassMat = (() => {
      const mt = new T3.MeshToonMaterial({ gradientMap: softTex, side: T3.DoubleSide }), tu = terrainMat.userData.u;
      mt.userData.u = { uG0: tu.uG0, uG1: tu.uG1, uG2: tu.uG2, uTall: tu.uTall };   // 和地面用同一套颜色
      keep.push(mt);
      return paint(mt, { key: 'grass', grass: true, flag: 0 });
    })();
    const flowerMat = toon({ side: T3.DoubleSide }, { key: 'flower', wind: .05, flag: 0 });
    // 树：树干和一团团树冠（不透明），树叶贴片 / 棕榈叶（镂空的贴图，两面都画）。fringe 是不随风动的贴片（石坎顶上垂下来的草边）
    const treeMat = toon({ gradientMap: softTex }, { key: 'tree', wind: .022, occ: true, flag: 0, leaf: true, rim: .55 });
    // 铅笔树、棒棒糖树、蜡笔花丛：每棵一种颜色，只染纯白的部分（见 o.tintW）；笔杆是硬的，摆得少
    const tintTreeMat = toon({ gradientMap: rampTex }, { key: 'treeT', wind: .008, occ: true, flag: 0, rim: .5, tintW: true });
    const leafMat = toon({ gradientMap: softTex, map: leafTex, alphaTest: .42, side: T3.DoubleSide }, { key: 'leaf', wind: .022, flutter: true, occ: true, flag: 0, leaf: true });
    const fringeMat = toon({ gradientMap: softTex, map: leafTex, alphaTest: .42, side: T3.DoubleSide }, { key: 'fringe', flag: 0, leaf: true });

    // ---------- 每张地图的内容 ----------
    let world = null, m = null, own = [], THEME = {}, PAL = {}, LAND = null, MOOD = MOODS[0], GND = GROUND.hello;
    let INFO = {};   // 这张图画了些什么（probe().look 给测试和 tools/look 用）：树的种类和用到的零件、房子的样子、天气、远景、瀑布、冰面、岩浆、地上画的东西
    const rnd = (x, y, s) => A.hsh(x, y, s);
    const still = o => { o.matrixAutoUpdate = false; o.updateMatrix(); return o; };
    function add(o, cast, recv) {
      o.castShadow = !!cast && !!Q.shadow; o.receiveShadow = recv !== false && !!Q.shadow;
      world.add(o);
      return o;
    }
    function inst(geo, mat, list, cast) {
      if (!list.length) { geo.dispose(); return null; }
      own.push(geo);
      const im = new T3.InstancedMesh(geo, mat, list.length), o = new T3.Object3D();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        o.position.set(p.x, p.y || 0, p.z); o.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
        o.scale.set(p.s || 1, p.sy || p.s || 1, p.s || 1); o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        if (p.c) im.setColorAt(i, p.c);
      }
      im.computeBoundingSphere();
      own.push(im);   // InstancedMesh 自己也要 dispose（每棵的位置那块数据）
      return still(add(im, cast));
    }
    // 地图上的格子：地图外面按最靠边的那一格延伸（出口外面还是路，海边外面还是海）
    const tAt = (x, y) => { const r = m.grid[y < 0 ? 0 : y >= m.H ? m.H - 1 : y]; return r[x < 0 ? 0 : x >= m.W ? m.W - 1 : x] || '.'; };
    const tIn = (x, y) => (x < 0 || y < 0 || x >= m.W || y >= m.H ? '' : m.grid[y][x]);

    // ---------- 地形：从地图数据推出每个点多高 ----------
    // 规则（都只看地图上的字，逻辑一点不碰）：
    //   · 能走的格子、房子、小物件底下是平的；
    //   · 台阶 L：它南边那一格比它矮一截（只能往南跳）。整张图的高度是「满足所有台阶、其余地方尽量平」的那个解，
    //     所以台阶中间的缺口（比如那条小路）自然成了一段缓坡。解出来能走的格子之间坡太陡（数据自相矛盾）就按比例压低，压得太多就干脆全平；
    //   · 水比岸低一点，沙滩朝着海慢慢低下去；
    //   · 走不了的边界树（# 和成片的 T）底下鼓起一道矮坡；地图外面是一块一块的山，山和山之间的地往海里落下去（从地图里能从山中间、树顶上看到海和远处的岛）；
    //     出口外面是一条山谷：路缓缓升到一个垭口再落向海，两边各一座山夹着；靠海的那几边外面就是海
    const MG = 2, CUT = .72, STEP = .46;
    function chamfer(isK, tw, th, S) {
      const nx = tw * S + 1, nz = th * S + 1, d = new Float32Array(nx * nz).fill(1e3), a = 1 / S, b = Math.SQRT2 / S;
      for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) if (isK[ty * tw + tx]) for (let j = ty * S; j <= ty * S + S; j++) for (let i = tx * S; i <= tx * S + S; i++) d[j * nx + i] = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; let v = d[k];
        if (i > 0) v = Math.min(v, d[k - 1] + a);
        if (j > 0) { v = Math.min(v, d[k - nx] + a); if (i > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); }
        d[k] = v;
      }
      for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i; let v = d[k];
        if (i < nx - 1) v = Math.min(v, d[k + 1] + a);
        if (j < nz - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0) v = Math.min(v, d[k + nx - 1] + b); }
        d[k] = v;
      }
      return d;
    }
    // 走不了的地方（成片的树、地图边）底下鼓起来一道矮坡：离能走的地方越远越高，上面还有大一点的起伏
    function bankH(d, x, z) {
      if (d <= .55) return 0;
      return sstep(.55, 3.2, d) * (.2 + .5 * fbm(x * .21 + 7, z * .21 + 3)) + sstep(1.6, 6, d) * .55 * fbm(x * .09 + 40, z * .09 + 9);
    }
    function buildLand() {
      const W = m.W, H = m.H, S = Q.sub, tw = W + MG * 2, th = H + MG * 2, nx = tw * S + 1, nz = th * S + 1;
      const walkSet = (window.EchoMaps && EchoMaps.WALK) || '.,=F^v<>o@S:_ueI%U';
      // ---- 每格是什么 ----
      const water0 = (x, y) => { const c = tIn(x, y); return c !== '' && WATER.includes(c); };
      const wetExit = (x, y) => { const c = tIn(x, y), d = { '^': [0, 1], v: [0, -1], '<': [1, 0], '>': [-1, 0] }[c]; return !!d && water0(x + d[0], y + d[1]); };
      const nWater = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => water0(x + dx, y + dy)).length;
      const cls = new Uint8Array(W * H);   // 1 水  3 码头（水上的小路）  5 水上的地标（小船）——最低一位是 1 的，地形都按水算
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x];
        if (water0(x, y) || wetExit(x, y)) cls[y * W + x] = 1;
        else if (c === '=' && nWater(x, y) >= 2) cls[y * W + x] = 3;
        else if (c === 'Z' && nWater(x, y) >= 2) cls[y * W + x] = 5;
      }
      // 码头接着码头：挨着码头、另一边是水的小路也算（T 字形的码头）
      for (let pass = 0; pass < 3; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (cls[y * W + x] || m.grid[y][x] !== '=') continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H ? 0 : cls[(y + dy) * W + x + dx]));
        if (nb.some(v => v === 3) && nb.filter(v => v & 1).length >= 2 && nb.filter(v => v === 1 || v === 5).length >= 1) cls[y * W + x] = 3;
      }
      const cl = (x, y) => cls[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
      const isWater = (x, y) => (cl(x, y) & 1) === 1, isPier = (x, y) => cl(x, y) === 3;
      const kWater = new Uint8Array(tw * th), kLand = new Uint8Array(tw * th), kFlat = new Uint8Array(tw * th), kSand = new Uint8Array(tw * th), kExit = new Uint8Array(tw * th);
      for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
        const x = tx - MG, y = ty - MG, c = tAt(x, y), k = ty * tw + tx, w = isWater(x, y);
        kWater[k] = w ? 1 : 0; kLand[k] = w ? 0 : 1;
        kFlat[k] = !w && c !== '#' && c !== 'T' ? 1 : 0;
        kSand[k] = !w && (c === 'S' || c === 'U') ? 1 : 0;
        kExit[k] = !w && EXITS.includes(c) && (x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1) ? 1 : 0;
      }
      const F = { dWalk: chamfer(kFlat, tw, th, S), dWat: chamfer(kWater, tw, th, S), dLand: chamfer(kLand, tw, th, S), dSand: chamfer(kSand, tw, th, S), dExit: chamfer(kExit, tw, th, S) };
      // ---- 台阶：解出每格的「层高」 ----
      const lev = new Float32Array(W * H);
      let step = STEP, hasL = false;
      for (let y = 0; y < H - 1 && !hasL; y++) for (let x = 0; x < W; x++) if (m.grid[y][x] === 'L') { hasL = true; break; }
      if (hasL) {
        const isL = (x, y) => m.grid[y][x] === 'L' && y + 1 < H && m.grid[y + 1][x] !== 'L';
        const fix = new Uint8Array(W * H);   // 连着地图边的水（海）定在 0
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && isWater(x, y)) fix[y * W + x] = 1;
        for (let it = 0; it < 260; it++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const k = y * W + x;
          if (fix[k]) continue;
          let s = 0, n = 0;
          if (x > 0) { s += lev[k - 1]; n++; }
          if (x < W - 1) { s += lev[k + 1]; n++; }
          // 台阶那条边的分量重一些（3 倍）：坎的高度基本保住，缓坡摊到别处
          if (y > 0) { const l = isL(x, y - 1), w = l ? 3 : 1; s += w * (lev[k - W] - (l ? STEP : 0)); n += w; }
          if (y < H - 1) { const l = isL(x, y), w = l ? 3 : 1; s += w * (lev[k + W] + (l ? STEP : 0)); n += w; }
          lev[k] += (s / n - lev[k]) * 1.6;
        }
        // 最低的能走的格子算 0；能走的格子之间最陡多少
        let lo = 1e9, steep = 0;
        const walk = (x, y) => walkSet.includes(m.grid[y][x]);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walk(x, y)) lo = Math.min(lo, lev[y * W + x]);
        if (lo > 1e8) lo = 0;
        for (let k = 0; k < W * H; k++) lev[k] -= lo;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (!walk(x, y)) continue;
          if (x < W - 1 && walk(x + 1, y)) steep = Math.max(steep, Math.abs(lev[y * W + x] - lev[y * W + x + 1]));
          if (y < H - 1 && walk(x, y + 1)) steep = Math.max(steep, Math.abs(lev[y * W + x] - lev[(y + 1) * W + x]));
        }
        const k = steep > .3 ? .3 / steep : 1;
        if (k < .4 || !isFinite(steep)) { lev.fill(0); step = 0; }
        else if (k < 1) { for (let i = 0; i < W * H; i++) lev[i] *= k; step *= k; }
      }
      // ---- 瀑布（w）：一列往南流下去的水。瀑布上面那一片（从最上面那格 w 往北，不穿过岩壁、边界树、瀑布能走到的地方）整片抬高，
      //      瀑布下面那一片不动，中间（岩壁、边界树）按离两边多远慢慢过渡。上下两片要是不穿过瀑布也连得起来，就不抬（瀑布画成平的急流）
      const falls = [];
      {
        const seen = new Uint8Array(W * H), wall = (x, y) => { const c = m.grid[y][x]; return c === 'R' || c === 'X' || c === 'K' || c === 'w' || c === '#'; };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (m.grid[y][x] !== 'w' || seen[y * W + x]) continue;
          let x0 = x, x1 = x, y0 = y, y1 = y; const q = [[x, y]]; seen[y * W + x] = 1;
          while (q.length) { const [cx, cy] = q.pop(); x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && m.grid[ny][nx] === 'w' && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); } }); }
          const fill = sy => { const r = new Uint8Array(W * H); if (sy < 0 || sy >= H) return r; const st = []; for (let xx = x0; xx <= x1; xx++) if (!wall(xx, sy)) { r[sy * W + xx] = 1; st.push([xx, sy]); } while (st.length) { const [cx, cy] = st.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !r[ny * W + nx] && !wall(nx, ny)) { r[ny * W + nx] = 1; st.push([nx, ny]); } }); } return r; };
          const up = fill(y0 - 1), dn = fill(y1 + 1), n = y1 - y0 + 1;
          let ok = up.some(v => v) && dn.some(v => v);
          for (let k = 0; ok && k < W * H; k++) if (up[k] && dn[k]) ok = false;
          const drop = ok ? (n + 1) * .52 : 0;
          if (drop) {
            // 两边的距离（格），中间的按比例过渡
            const dist = src => { const d = new Float32Array(W * H).fill(1e3), st = []; for (let k = 0; k < W * H; k++) if (src[k]) { d[k] = 0; st.push(k); } while (st.length) { const k = st.shift(), cx = k % W, cy = (k - cx) / W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; const j = ny * W + nx; if (d[j] > d[k] + 1) { d[j] = d[k] + 1; st.push(j); } }); } return d; };
            const dU = dist(up), dD = dist(dn);
            for (let k = 0; k < W * H; k++) lev[k] += up[k] ? drop : dn[k] ? 0 : drop * sstep(0, 1, dD[k] / Math.max(1e-3, dU[k] + dD[k]));
            // 瀑布自己那几格：一格一级往下
            for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) lev[yy * W + xx] = drop * (1 - (yy - y0 + 1) / (n + 1));
          }
          falls.push({ x0, x1, y0, y1, n, drop });
        }
      }
      const lifted = falls.some(f => f.drop > 0);
      // 台阶那条线（L 格偏南一点）两边不互相插值：线北边用上面的高度、南边用下面的
      const levAt = (px, pz) => {
        if (!step && !lifted) return 0;
        const gx = clamp(px - .5, 0, W - 1), gz = clamp(pz - .5, 0, H - 1), x0 = Math.min(W - 2, Math.floor(gx)), z0 = Math.min(H - 2, Math.floor(gz)), fx = gx - x0, fz = gz - z0;
        const col = xc => (m.grid[z0][xc] === 'L' && m.grid[z0 + 1][xc] !== 'L' ? (pz < z0 + CUT ? lev[z0 * W + xc] : lev[(z0 + 1) * W + xc]) : lerp(lev[z0 * W + xc], lev[(z0 + 1) * W + xc], fz));
        return lerp(col(x0), col(x0 + 1), fx);
      };
      // ---- 细网格上每个点的高度 ----
      const X0 = -MG, Z0 = -MG, X1 = W + MG, Z1 = H + MG;
      const hgt = new Float32Array(nx * nz), sd = new Float32Array(nx * nz), shoreH = new Float32Array(nx * nz);
      // 离岸多远：先把直角抹圆（糊两遍），再按噪声里外挪一点，岸线就不是沿着格子的直线了
      for (let k = 0; k < nx * nz; k++) sd[k] = F.dWat[k] - F.dLand[k];
      for (let pass = 0; pass < 4; pass++) {
        const src = new Float32Array(sd);
        for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; sd[k] = (src[k] * 4 + (src[k - 1] + src[k + 1] + src[k - nx] + src[k + nx]) * 2 + src[k - nx - 1] + src[k - nx + 1] + src[k + nx - 1] + src[k + nx + 1]) / 16; }
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = X0 + i / S, z = Z0 + j / S; if (Math.abs(sd[k]) < 1.2) sd[k] -= (fbm(x * .9 + 3, z * .9 + 7) - .5) * .3 * (1 - Math.abs(sd[k]) / 1.2) + .06; }
      const southK = z => 1 - .72 * sstep(H - 2.5, H + 4, z);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = X0 + i / S, z = Z0 + j / S, s = sd[k], base = levAt(x, z), sandK = 1 - sstep(0, .6, F.dSand[k]);
        const edge = lerp(.12, .3, sandK);
        shoreH[k] = base - edge;
        if (s >= 0) hgt[k] = base + bankH(F.dWalk[k], x, z) * southK(z) * sstep(.1, 1.6, s) - lerp(.12 * (1 - sstep(0, .4, s)), .3 * (1 - sstep(0, 2.4, s)), sandK);
        else hgt[k] = base - edge - (.1 + .7 * sstep(0, 1.2, -s));
      }
      // ---- 水：连在一起的算一片，水面比这一片最低的岸再低一点 ----
      const body = new Int16Array(W * H).fill(-1), wlev = [];
      let SEA = 1e9;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!(cls[y * W + x] & 1) || body[y * W + x] >= 0 || m.grid[y][x] === 'w') continue;
        const id = wlev.length, q = [[x, y]]; let lo = 1e9, sea = false;
        body[y * W + x] = id;
        while (q.length) {
          const [cx, cy] = q.pop();
          if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) sea = true;
          for (let jj = (cy + MG) * S; jj <= (cy + MG + 1) * S; jj++) for (let ii = (cx + MG) * S; ii <= (cx + MG + 1) * S; ii++) if (F.dLand[jj * nx + ii] < .01) lo = Math.min(lo, shoreH[jj * nx + ii]);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const qx = cx + dx, qy = cy + dy; if (qx >= 0 && qy >= 0 && qx < W && qy < H && (cls[qy * W + qx] & 1) && body[qy * W + qx] < 0 && m.grid[qy][qx] !== 'w') { body[qy * W + qx] = id; q.push([qx, qy]); } });
        }
        if (lo > 1e8) lo = 0;
        wlev.push(lo - .07);
        if (sea) SEA = Math.min(SEA, lo - .07);
      }
      if (SEA > 1e8) SEA = -.5;
      const bodyLevel = (x, y) => { const b = body[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)]; return b < 0 ? SEA : wlev[b]; };
      // 瀑布那几格的水面：上面那片水和下面那片水之间，一格一级往下（主角逆流往上爬的时候就站在这一级上）
      const wfL = new Float32Array(W * H).fill(NaN);
      falls.forEach(f => {
        const pick = yy => { for (let xx = f.x0; xx <= f.x1; xx++) if (yy >= 0 && yy < H && body[yy * W + xx] >= 0) return wlev[body[yy * W + xx]]; return null; };
        let U = pick(f.y0 - 1), D = pick(f.y1 + 1);
        if (U == null) U = D == null ? SEA : D + f.drop; if (D == null) D = U - f.drop;
        f.U = U; f.D = D;
        for (let yy = f.y0; yy <= f.y1; yy++) for (let xx = f.x0; xx <= f.x1; xx++) if (m.grid[yy][xx] === 'w') wfL[yy * W + xx] = lerp(U, D, (yy - f.y0 + 1) / (f.n + 1));
      });
      const waterLevel = (x, y) => { const k = clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1); return wfL[k] === wfL[k] ? wfL[k] : bodyLevel(x, y); };
      // 码头：木板面比水面高一点，主角走在木板上（地形本身在水底下）
      const srf = new Float32Array(hgt);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cls[y * W + x] === 3) {
        const dy = waterLevel(x, y) + .2;
        for (let jj = (y + MG) * S; jj <= (y + MG + 1) * S; jj++) for (let ii = (x + MG) * S; ii <= (x + MG + 1) * S; ii++) srf[jj * nx + ii] = dy;
      }
      const samp = (f, x, z) => {
        const gx = clamp((x - X0) * S, 0, nx - 1.001), gz = clamp((z - Z0) * S, 0, nz - 1.001), i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, k = j * nx + i;
        return (f[k] * (1 - fx) + f[k + 1] * fx) * (1 - fz) + (f[k + nx] * (1 - fx) + f[k + nx + 1] * fx) * fz;
      };
      // ---- 地图外面 ----
      // 出口（在地图边上、通到别的地图的那几格）：位置和朝外的方向
      const exits = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!EXITS.includes(m.grid[y][x]) || isWater(x, y)) continue;
        const d = y === 0 ? [0, -1] : y === H - 1 ? [0, 1] : x === 0 ? [-1, 0] : x === W - 1 ? [1, 0] : null;
        if (d) exits.push({ x: x + .5, z: y + .5, dx: d[0], dz: d[1] });
      }
      const seedA = String(m.id || '').split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9973, 7) * .137, route = m.kind === 'route';
      const R1 = Q.skirt * .5, R2 = Q.skirt * .8;
      const outer = (x, z, o) => {
        const cx = clamp(x, X0, X1), cz = clamp(z, Z0, Z1), dOut = Math.hypot(x - cx, z - cz);
        const n = fbm(x * .05 + 31, z * .05 + 17);
        const landK = sstep(-.5, 1.3, samp(sd, cx, cz) + (n - .5) * 2.4 * Math.min(1, dOut / 3));
        // 出口外面：一条山谷（路从这里通出去，越往外越宽），先缓缓升到一个垭口再落向海；两边各一座山夹着
        let val = 0, flank = 0, ax = 0;
        for (let i = 0; i < exits.length; i++) {
          const e = exits[i], al = (x - e.x) * e.dx + (z - e.z) * e.dz;
          if (al < -5) continue;
          const ap = Math.max(0, al), lat = Math.abs((x - e.x) * e.dz - (z - e.z) * e.dx) + (n - .5) * 1.6 * Math.min(1, ap / 6);
          const v = (1 - sstep(1.5 + ap * .1, 4.2 + ap * .28, lat)) * sstep(-2.5, .5, al);
          if (v > val) { val = v; ax = al; }
          flank = Math.max(flank, sstep(2.4, 6.5, lat) * (1 - sstep(13, 21, lat)) * sstep(-9, 2, al) * (1 - sstep(22, 38, al)));
        }
        // 山：一块一块的（低频噪声定哪里是山）；不是山的地方缓缓往海里落下去
        const mN = fbm(x * .03 + 3 + seedA, z * .03 + 9 - seedA), hill = Math.max(sstep(route ? .43 : .5, route ? .56 : .63, mN), flank) * (1 - val);
        const edgeH = samp(hgt, cx, cz), dw = samp(F.dWalk, cx, cz) + dOut, seaD = Math.max(.4, edgeH - SEA + 1.2);
        const n2 = fbm(x * .075 + 40, z * .075 + 9), n3 = fbm(x * .033 + 5, z * .033 + 77);
        const up = (sstep(0, 8, dOut) * (.9 + 1.7 * n2) + sstep(5, 26, dOut) * (1.2 + 5.8 * n3 * n3) * (route ? 1.15 : 1)) * southK(z);
        const low = (n2 - .5) * .5 * sstep(0, 4, dOut) - sstep(3 + 7 * n, 12 + 9 * n, dOut) * seaD;
        const pass = 1.3 * sstep(1, 11, ax) * (1 - sstep(13, 24, ax)) - sstep(15, 30, ax) * seaD;
        const fall = sstep(R1, R2, dOut + (n - .5) * 12);
        const land = lerp(edgeH + lerp(lerp(low, up, hill), pass, val), SEA - 1.3, fall);
        if (o) { o.landK = landK * (1 - fall); o.dOut = dOut; o.hill = hill; o.val = val; o.dw = dw; }
        return lerp(SEA - .6 - .7 * sstep(0, 5, dOut), land, landK);
      };
      const inFine = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
      LAND = {
        W, H, S, nx, nz, X0, Z0, X1, Z1, F, sd, hgt, srf, cls, SEA, step, samp, outer, levAt, isWater, isPier, waterLevel, falls,
        // 地面多高（树、石头这些放东西用）；at：主角 / 人物站的那个面（码头上是木板）
        ground: (x, z) => (inFine(x, z) ? samp(hgt, x, z) : outer(x, z)),
        at: (x, z) => samp(srf, x, z),
      };
    }

    // ---------- 地面的网格和遮罩图 ----------
    function paintMask() {
      const px = Q.mask, tw = m.W + MG * 2, th = m.H + MG * 2, L = LAND;
      const path = (x, y) => { const c = tAt(x, y); return (c === '=' || EXITS.includes(c)) && !L.isWater(x, y) && !L.isPier(x, y); };
      const sand = (x, y) => { const c = tAt(x, y); return c === 'S' || c === 'U' || L.isWater(x, y); };
      const tall = (x, y) => tAt(x, y) === ',';
      const t = canvasTex(tw * px, th * px, g => {
        g.fillStyle = '#000'; g.fillRect(0, 0, tw * px, th * px);
        g.globalCompositeOperation = 'lighter';
        const blob = (x, y, same, inset, r, col) => {
          const sx = (x + MG) * px, sy = (y + MG) * px, up = same(x, y - 1), dn = same(x, y + 1), lf = same(x - 1, y), rt = same(x + 1, y);
          const x0 = sx + (lf ? 0 : inset), y0 = sy + (up ? 0 : inset), x1 = sx + px - (rt ? 0 : inset), y1 = sy + px - (dn ? 0 : inset);
          g.fillStyle = col;
          A.rr(g, x0, y0, x1 - x0, y1 - y0, [!up && !lf ? r : 0, !up && !rt ? r : 0, !dn && !rt ? r : 0, !dn && !lf ? r : 0]);
          g.fill();
        };
        for (let y = -MG; y < m.H + MG; y++) for (let x = -MG; x < m.W + MG; x++) {
          if (path(x, y)) blob(x, y, path, -px * .04, px * .42, '#ff0000');
          if (sand(x, y)) blob(x, y, sand, -px * .08, px * .45, '#00ff00');
          if (tall(x, y)) blob(x, y, tall, px * .02, px * .4, '#0000ff');
        }
        // 糊一下：路和沙地的边在着色器里再按噪声弯一弯，就不是一格一格的直角了
        const im = g.getImageData(0, 0, tw * px, th * px), d = im.data, w = tw * px, h = th * px, tmp = new Uint8ClampedArray(d.length);
        for (let pass = 0; pass < 2; pass++) {
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, a = (y * w + Math.max(0, x - 1)) * 4, b = (y * w + Math.min(w - 1, x + 1)) * 4; for (let c = 0; c < 3; c++) tmp[k + c] = (d[a + c] + d[k + c] * 2 + d[b + c]) >> 2; }
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, a = (Math.max(0, y - 1) * w + x) * 4, b = (Math.min(h - 1, y + 1) * w + x) * 4; for (let c = 0; c < 3; c++) d[k + c] = (tmp[a + c] + tmp[k + c] * 2 + tmp[b + c]) >> 2; }
        }
        g.globalCompositeOperation = 'source-over';
        g.putImageData(im, 0, 0);
      }, false);
      t.flipY = false; t.generateMipmaps = false; t.minFilter = t.magFilter = T3.LinearFilter;
      own.push(t);
      return t;
    }
    const mixC = (a, b, t) => C(a).lerp(C(b), t);
    function buildTerrain() {
      const L = LAND, S = L.S, P = PAL;
      // 网格：地图里面（外加两格）是细的，往外一圈比一圈粗
      const ring = []; { let d = 0, st = 1; while (d < Q.skirt) { d += st; ring.push(d); st = Math.min(10, st * 1.32 + .2); } }
      const axis = (lo, hi, n) => { const a = []; for (let k = ring.length - 1; k >= 0; k--) a.push(lo - ring[k]); for (let i = 0; i < n; i++) a.push(lo + i / S); ring.forEach(d => a.push(hi + d)); return a; };
      const xs = axis(L.X0, L.X1, L.nx), zs = axis(L.Z0, L.Z1, L.nz), NX = xs.length, NZ = zs.length, R = ring.length;
      const pos = new Float32Array(NX * NZ * 3), col = new Float32Array(NX * NZ * 3), o = {};
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const k = (j * NX + i) * 3, x = xs[i], z = zs[j], fi = i - R, fj = j - R;
        pos[k] = x; pos[k + 2] = z;
        if (fi >= 0 && fj >= 0 && fi < L.nx && fj < L.nz) {
          const q = fj * L.nx + fi, s = L.sd[q];
          pos[k + 1] = L.hgt[q];
          col[k] = s > 0 ? sstep(.7, 2.6, L.F.dWalk[q]) * sstep(.2, 1.4, s) : 0;
          col[k + 1] = s > 0 ? 1 - sstep(0, .8, s) : 1;
          col[k + 2] = 0;
        } else {
          pos[k + 1] = L.outer(x, z, o);
          const cz2 = clamp(z, L.Z0, L.Z1), cx2 = clamp(x, L.X0, L.X1);
          col[k] = o.landK * Math.max(o.hill * sstep(0, 4, o.dOut), (1 - sstep(0, 3, o.dOut)) * sstep(.7, 2.6, L.samp(L.F.dWalk, cx2, cz2))); col[k + 1] = 1 - o.landK; col[k + 2] = Math.min(1, o.dOut / 16);
        }
      }
      const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
      let q = 0;
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.BufferAttribute(pos, 3));
      g.setAttribute('color', new T3.BufferAttribute(col, 3));
      g.setIndex(new T3.BufferAttribute(idx, 1));
      g.computeVertexNormals();
      own.push(g);
      const u = terrainMat.userData.u, tw = m.W + MG * 2, th = m.H + MG * 2;
      u.uMask.value = paintMask();
      u.uMapO.value.set(-MG, -MG, 1 / tw, 1 / th); u.uSeaY.value = L.SEA;
      u.uG0.value.set(P.grass); u.uG1.value.copy(mixC(P.grass, '#f4f08c', P.snow ? .04 : .3)); u.uG2.value.copy(mixC(A.shade(P.grass, .86), '#27a082', P.snow ? .03 : .2));
      if (P.snow) { u.uG1.value.set('#f8fbfd'); u.uG2.value.set('#cddcea'); }   // 雪地：白里透一块块淡淡的蓝（背阴、被风吹出来的雪窝）
      u.uTall.value.copy(mixC(A.shade(P.tall, .92), P.grass, .12)); u.uForest.value.copy(mixC(A.shade(P.tree, .82), P.grass, .28));
      u.uSand.value.set(A.shade(P.sand, .955)); u.uSandWet.value.copy(mixC(A.shade(P.sand, .84), '#b9a37a', .25));
      u.uPath.value.set(P.path); u.uPathRim.value.copy(mixC(A.shade(P.path, .8), '#b08a5a', .2));
      // 小路、沙地的样子（GROUND）：柏油路深一些、边上的路牙浅；石板路的缝深；方砖的缝浅；雪地更白
      const pk = PATHK[GND.path] || 0, sk = SANDK[GND.sand] || 0;
      u.uPathK.value = pk; u.uSandK.value = sk;
      if (pk === 1) { u.uPath.value.copy(mixC(A.shade(P.path, .62), '#5d6670', .3)); u.uPathRim.value.set('#e6e8ea'); }
      else if (pk === 2) { u.uPath.value.copy(mixC(P.path, P.rock || '#a39b8b', .25)); u.uPathRim.value.copy(mixC(A.shade(P.rock || '#a39b8b', .62), '#5b5048', .3)); }
      else if (pk === 3) { u.uPath.value.copy(mixC(P.path, '#ffffff', .2)); u.uPathRim.value.copy(C(A.shade(P.path, .8))); }
      else if (pk === 6) { u.uPath.value.copy(mixC(P.path, '#c9d6e2', .3)); u.uPathRim.value.copy(mixC(P.path, '#a9bccb', .5)); }
      if (sk === 2) u.uSand.value.copy(mixC(P.sand, '#cfd5da', .3));
      else if (sk === 3) u.uSand.value.copy(mixC(A.shade(P.sand, .62), '#6e625a', .45));
      else if (sk === 4) u.uSand.value.set('#f4f8fb');
      const ms = new T3.Mesh(g, terrainMat);
      ms.frustumCulled = false;
      still(add(ms, false));
    }

    // ---------- 水：浅的地方清澈的青绿，越深越蓝；岸边一道道浪花往岸上推；朝着太阳的方向一条碎碎的亮光；云影也落在水上 ----------
    const waterMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNoise: U.uNoise, uFogA: U.uFogA, uHaze: U.uHaze, uFogP: U.uFogP, uShallow: { value: C('#9cf3df') }, uMid: { value: C('#38c8d2') }, uDeep: { value: C('#1b7fd0') }, uSky: { value: C('#bfe4f6') }, uSunXZ: { value: new T3.Vector2(-.5, -.86).normalize() }, uHot: { value: 0 } },
      vertexShader: 'attribute float aShore; attribute float aDeep; varying float vS; varying float vD; varying highp vec3 vW; varying highp float vDep; void main(){ vS = aShore; vD = aDeep; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDep = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: [
        'uniform highp float uTime; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uSky; uniform vec2 uSunXZ; uniform float uHot; varying float vS; varying float vD; varying highp vec3 vW; varying highp float vDep;', FOG_PARS, CLOUD,
        'void main(){',
        '  highp vec2 p = vW.xz; highp float t = uTime;',
        '  float n1 = texture2D(uNoise, p * 0.06 + vec2(t * 0.012, t * 0.008)).g; float n2 = texture2D(uNoise, p * 0.17 - vec2(t * 0.02, -t * 0.015)).r;',
        '  float d = vS + (n2 - 0.5) * 0.22;',
        '  vec3 c = mix(uShallow, uMid, smoothstep(0.05, 1.1, d)); c = mix(c, uDeep, smoothstep(0.9, 4.6, d));',
        // 深水（D，能潜下去的地方）：一块深深的藏青，水底一串串小气泡慢慢冒上来
        '  c = mix(c, vec3(0.05, 0.2, 0.46), vD * 0.8); c += vec3(0.7) * smoothstep(0.86, 0.9, texture2D(uNoise, p * 2.2 + vec2(0.0, t * 0.3)).a) * vD * (1.0 - smoothstep(6.0, 26.0, vDep));',
        // 涌：一道道很宽的明暗慢慢往岸这边走
        '  float sw = sin(dot(p, vec2(0.07, 0.23)) + t * 0.55 + n1 * 3.0); c *= 1.0 + 0.045 * sw * smoothstep(0.6, 2.5, d);',
        // 水面上一道道浅色的波纹（两层噪声错着走，取细细的一圈）
        '  float w = abs(fract(n1 * 3.0 + n2 * 1.3 + t * 0.04) - 0.5); c += vec3(0.10, 0.13, 0.12) * (1.0 - smoothstep(0.0, 0.035, w)) * smoothstep(0.25, 1.2, d);',
        // 岸边的浪花：贴着岸一圈白，外面两道一前一后、往岸上推的白线
        '  float e1 = 1.0 - smoothstep(0.10, 0.17, d + sin(t * 1.4 + p.x * 1.9 + p.y * 1.3) * 0.03);',
        '  float ph = fract(t * 0.16 + n1 * 0.6); float e2 = (1.0 - smoothstep(0.0, 0.05, abs(d - (0.66 - ph * 0.54)))) * (1.0 - ph) * step(0.0, d);',
        '  float ph2 = fract(t * 0.16 + n1 * 0.6 + 0.5); float e3 = (1.0 - smoothstep(0.0, 0.04, abs(d - (1.15 - ph2 * 0.6)))) * (1.0 - ph2) * 0.6 * step(0.0, d);',
        '  float foam = clamp(e1 + e2 * 0.78 + e3 * (0.5 + 0.5 * n2), 0.0, 1.0);',
        // 亮点：两层噪声都高的地方闪一下，位置慢慢漂；朝着太阳的那个方向亮点密成一条光带
        '  vec3 v = normalize(cameraPosition - vW); float gp = pow(max(dot(normalize(p - cameraPosition.xz), uSunXZ), 0.0), 9.0);',
        '  float s1 = texture2D(uNoise, p * 1.05 + vec2(t * 0.06, t * 0.04)).g; float s2 = texture2D(uNoise, p * 1.37 - vec2(t * 0.05, t * 0.07)).g;',
        '  float sp = smoothstep(0.735 - gp * 0.14, 0.77 - gp * 0.14, min(s1, s2)) * smoothstep(0.3, 1.0, d) * smoothstep(0.42 - gp * 0.42, 0.66 - gp * 0.42, n1);',
        // 越远看到的越是天的颜色
        '  float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);',
        '  c = mix(c, uSky, fr * 0.6);',
        '  float cs = cloudSh(p); c *= 1.0 - 0.28 * cs;',
        '  c += vec3(1.0, 0.93, 0.78) * gp * 0.16 * (1.0 - cs) * smoothstep(1.0, 3.0, d);',
        '  c = mix(c, vec3(1.0), foam * 0.92) + sp * (0.6 + 0.6 * gp) * (1.0 - 0.6 * cs);',
        '  float a = mix(0.56, 0.93, smoothstep(0.0, 1.4, d)); a = max(a, foam); a = max(a, fr);',
        // 岩浆（钟山山顶的火山口）：一块块暗红的硬壳慢慢漂，壳和壳之间的缝里是发亮的橙黄，靠岸的地方一圈更亮（地图外面的海 vS = 7，还是海）
        '  if (uHot > 0.5 && vS < 6.5) { float k1 = texture2D(uNoise, p * 0.32 + vec2(t * 0.008, t * 0.004)).r, k2 = texture2D(uNoise, p * 0.85 - vec2(t * 0.012, -t * 0.01)).g;',
        '    float crust = smoothstep(0.46, 0.6, k1 * 0.62 + k2 * 0.38); vec3 glow = mix(vec3(1.0, 0.86, 0.32), vec3(1.0, 0.42, 0.1), smoothstep(0.3, 0.7, k2)) * (1.05 + 0.15 * sin(t * 1.7 + k1 * 9.0));',
        '    c = mix(glow, vec3(0.24, 0.1, 0.07) + vec3(0.12, 0.03, 0.0) * k2, crust); c = mix(c, vec3(1.0, 0.62, 0.22), (1.0 - smoothstep(0.0, 0.35, d)) * 0.75); a = 1.0; }',
        '  gl_FragColor = vec4(airFog(c, vDep, 0.0), a);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
      transparent: true, depthWrite: false,
    });
    keep.push(waterMat);
    const steamMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uPx: { value: 1 } },
      vertexShader: 'attribute float aS; uniform highp float uTime; uniform float uPx; varying float vA;\nvoid main(){ float t = fract(uTime * 0.11 + aS); vec3 p = position; p.y += t * 2.6; p.x += sin(t * 3.0 + aS * 6.0) * 0.35 + t * 0.6; vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.5 + t * 1.3) / max(0.5, -mv.z); vA = sin(t * 3.1416) * 0.32; }',
      fragmentShader: 'varying float vA;\nvoid main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0), (1.0 - smoothstep(0.15, 0.5, d)) * vA);\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    keep.push(steamMat);
    function buildWater() {
      const L = LAND, S = L.S, pos = [], sh = [], idx = [], dp = [];
      // 深水（D）有多深：按四周格子中心插值，边上是软的
      const isD = (x, y) => (tIn(x, y) === 'D' ? 1 : 0), deepAt = (px, pz) => { const gx = px - .5, gz = pz - .5, x0 = Math.floor(gx), z0 = Math.floor(gz), fx = gx - x0, fz = gz - z0; return lerp(lerp(isD(x0, z0), isD(x0 + 1, z0), fx), lerp(isD(x0, z0 + 1), isD(x0 + 1, z0 + 1), fx), fz); };
      // 地图里（外加两格）的水：照着细网格铺，每个点带着「离岸多远」
      for (let ty = 0; ty < m.H + MG * 2; ty++) for (let tx = 0; tx < m.W + MG * 2; tx++) {
        const x = tx - MG, y = ty - MG;
        if (!L.isWater(x, y) || tIn(x, y) === 'w') continue;   // 瀑布另画（buildFalls）
        const lv = L.waterLevel(x, y), b = pos.length / 3;
        for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) { const q = (ty * S + j) * L.nx + tx * S + i, px = x + i / S, pz = y + j / S; pos.push(px, lv, pz); sh.push(Math.max(0, -L.sd[q])); dp.push(deepAt(px, pz)); }
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = b + j * (S + 1) + i, c = a + S + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
      }
      // 外面的海：四大块，一直铺到最远
      const far = Q.far * 1.6, X0 = L.X0, X1 = L.X1, Z0 = L.Z0, Z1 = L.Z1;
      [[X0 - far, Z0 - far, X1 + far, Z0], [X0 - far, Z1, X1 + far, Z1 + far], [X0 - far, Z0, X0, Z1], [X1, Z0, X1 + far, Z1]].forEach(([ax, az, bx, bz]) => {
        const b = pos.length / 3;
        pos.push(ax, L.SEA, az, bx, L.SEA, az, ax, L.SEA, bz, bx, L.SEA, bz); sh.push(7, 7, 7, 7); dp.push(0, 0, 0, 0);
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      });
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('aShore', new T3.Float32BufferAttribute(sh, 1)); g.setAttribute('aDeep', new T3.Float32BufferAttribute(dp, 1));
      waterMat.uniforms.uHot.value = m.theme === 'clock' && m.kind === 'route' ? 1 : 0;   // 钟山山顶的火山口是岩浆（告示牌：Do not go near the lava）
      // 岩浆上冒着一缕缕热气和烟：一团团软软的白点从表面升起来、散开、淡掉
      if (waterMat.uniforms.uHot.value && tier !== 'low') {
        const cells = []; for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) if (L.isWater(x, y) && tIn(x, y) !== 'w') cells.push([x, y]);
        const N = Math.min(60, cells.length * 2), sp = new Float32Array(N * 3), sd = new Float32Array(N);
        for (let i = 0; i < N; i++) { const [x, y] = cells[Math.floor(hash2(i, 91) * cells.length)]; sp.set([x + hash2(i, 92), L.waterLevel(x, y), y + hash2(i, 93)], i * 3); sd[i] = hash2(i, 94); }
        const sg = new T3.BufferGeometry(); sg.setAttribute('position', new T3.BufferAttribute(sp, 3)); sg.setAttribute('aS', new T3.BufferAttribute(sd, 1)); own.push(sg);
        const so = new T3.Points(sg, steamMat); so.frustumCulled = false; so.renderOrder = 5; still(add(so, false, false));
      }
      g.setIndex(idx);
      own.push(g);
      const ms = new T3.Mesh(g, waterMat);
      ms.frustumCulled = false; ms.renderOrder = 2;
      still(add(ms, false, false));
    }

    // ---------- 瀑布：一级一级往下冲的水（每一级：一小段平的急流、一道往前鼓出去再垂下来的水帘、帘子底下一圈白沫），最下面冲进水潭的地方一大片白沫 ----------
    // aF：0 平的急流、1 往下落的水帘；aV：顺着水流走了多远（白色的水纹顺着它往下跑）；aFo：白沫有多浓
    const fallsMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNoise: U.uNoise, uFogA: U.uFogA, uHaze: U.uHaze, uFogP: U.uFogP },
      vertexShader: 'attribute float aF; attribute float aV; attribute float aFo; varying float vF; varying float vV; varying float vFo; varying highp vec3 vW; varying highp float vDep; void main(){ vF = aF; vV = aV; vFo = aFo; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDep = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: [
        'uniform highp float uTime; varying float vF; varying float vV; varying float vFo; varying highp vec3 vW; varying highp float vDep;', FOG_PARS, CLOUD,
        'void main(){',
        '  highp float t = uTime; float sp = mix(1.1, 3.4, vF);',
        // 一道道顺着水流跑下去的白色水纹（落下来的水帘上又密又快）
        '  float s1 = texture2D(uNoise, vec2(vW.x * 2.4, vV * 0.8 - t * sp * 0.8)).g, s2 = texture2D(uNoise, vec2(vW.x * 5.1 + 0.3, vV * 1.6 - t * sp * 1.3)).r;',
        '  float str = smoothstep(0.42, 0.74, s1 * 0.6 + s2 * 0.4);',
        '  vec3 c = mix(vec3(0.42, 0.80, 0.88), vec3(0.80, 0.95, 1.0), vF * 0.55);',
        '  c = mix(c, vec3(1.0), str * (0.3 + 0.6 * vF));',
        // 白沫：一团团翻着的泡沫（两层噪声错着动）
        '  float fn = texture2D(uNoise, vW.xz * 1.6 + vec2(0.0, -t * 0.45)).a * 0.6 + texture2D(uNoise, vW.xz * 3.1 - vec2(t * 0.3, 0.0)).g * 0.4;',
        '  float fo = max(vFo, 0.0), fade = clamp(1.0 + vFo, 0.0, 1.0);',
        '  float foam = smoothstep(0.25, 0.55, fn * 0.7 + fo * 0.6 - 0.2) * min(1.0, fo * 1.6);',
        '  c = mix(c, vec3(1.0), foam * 0.95);',
        '  c *= 1.0 - 0.18 * cloudSh(vW.xz);',
        '  float a = max(mix(0.8, 0.95, vF), foam * 0.95) * fade;',
        '  gl_FragColor = vec4(airFog(c, vDep, vW.y), a);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
      transparent: true, depthWrite: false,
    });
    keep.push(fallsMat);
    function buildFalls() {
      const L = LAND;
      if (!L.falls || !L.falls.length) return;
      const pos = [], aF = [], aV = [], aFo = [], idx = [], hiQ = tier === 'high';
      L.falls.forEach(f => {
        const xa = f.x0 - .03, xb = f.x1 + 1.03, nX = Math.max(2, (f.x1 - f.x0 + 1) * (hiQ ? 6 : 3));
        const lev = k => (k < 0 ? f.U : k >= f.n ? f.D : lerp(f.U, f.D, (k + 1) / (f.n + 1)));
        const pts = [{ z: f.y0 - .6, y: f.U + .01, F: 0, fo: -1 }];   // 两头的 fo 是 -1：淡进上面那片水、淡出到下面的水潭里
        if (f.drop > 0) {
          for (let j = 0; j <= f.n; j++) {
            const A0 = lev(j - 1), B0 = lev(j), zj = f.y0 + j;
            for (let q = 0; q <= 6; q++) { const s = q / 6; pts.push({ z: zj - .14 + .3 * (1 - (1 - s) * (1 - s)), y: A0 + (B0 - A0) * Math.pow(s, 1.3) + .01, F: s < .08 ? .25 : 1, fo: s > .7 ? (s - .7) * 3.3 : 0 }); }
            if (j < f.n) { pts.push({ z: zj + .36, y: B0 + .01, F: 0, fo: .9 }); pts.push({ z: zj + .86, y: B0 + .01, F: 0, fo: .25 }); }
            else { pts.push({ z: zj + .5, y: B0 + .012, F: 0, fo: 1 }); pts.push({ z: zj + 1.3, y: B0 + .012, F: 0, fo: .55 }); pts.push({ z: zj + 2.2, y: B0 + .012, F: 0, fo: -1 }); }
          }
        } else pts.push({ z: f.y1 + 1.5, y: f.D + .01, F: 0, fo: -1 });
        let v = 0;
        pts.forEach((q, i) => { if (i) v += Math.hypot(q.z - pts[i - 1].z, q.y - pts[i - 1].y); q.v = v; });
        const b = pos.length / 3;
        pts.forEach(q => { for (let i = 0; i <= nX; i++) { const x = lerp(xa, xb, i / nX), side = Math.min(i, nX - i) / nX; pos.push(x + (i === 0 ? -.04 : i === nX ? .04 : 0) * q.F, q.y, q.z); aF.push(q.F); aV.push(q.v); aFo.push(q.fo < 0 ? q.fo : Math.min(1, q.fo + (side < .08 ? .5 : 0))); } });
        for (let r = 0; r < pts.length - 1; r++) for (let i = 0; i < nX; i++) { const a = b + r * (nX + 1) + i, c = a + nX + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
      });
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('aF', new T3.Float32BufferAttribute(aF, 1)); g.setAttribute('aV', new T3.Float32BufferAttribute(aV, 1)); g.setAttribute('aFo', new T3.Float32BufferAttribute(aFo, 1));
      g.setIndex(idx); own.push(g);
      const ms = new T3.Mesh(g, fallsMat); ms.renderOrder = 3; ms.frustumCulled = false;
      still(add(ms, false, false));
    }

    // ---------- 冰面（I，踩上去会一直滑）：亮亮的、半透明的蓝，靠边一圈白霜，里面一道道白色的裂纹，天光和太阳在上面反着光，脚边一闪一闪的冰晶 ----------
    const iceMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNoise: U.uNoise, uFogA: U.uFogA, uHaze: U.uHaze, uFogP: U.uFogP, uSky: { value: C('#cfe6fb') }, uSunXZ: { value: new T3.Vector2(-.5, -.86).normalize() } },
      vertexShader: 'attribute float aE; varying float vE; varying highp vec3 vW; varying highp float vDep; void main(){ vE = aE; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDep = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: [
        'uniform highp float uTime; uniform vec3 uSky; uniform vec2 uSunXZ; varying float vE; varying highp vec3 vW; varying highp float vDep;', FOG_PARS, CLOUD,
        'void main(){',
        '  highp vec2 p = vW.xz; float e = vE;',
        '  vec3 c = mix(vec3(0.62, 0.84, 0.97), vec3(0.26, 0.56, 0.86), smoothstep(0.15, 1.8, e));',
        '  c *= 0.93 + 0.12 * texture2D(uNoise, p * 0.17).r;',
        // 裂纹：两层细细的白线（噪声的等高线），线边上一道浅浅的暗
        '  float k1 = abs(fract(texture2D(uNoise, p * 0.2).g * 4.0 + texture2D(uNoise, p * 0.55).r * 0.35) - 0.5), k2 = abs(fract(texture2D(uNoise, p * 0.46 + 0.3).b * 3.0) - 0.5);',
        '  float cr = (1.0 - smoothstep(0.01, 0.026, k1)) + (1.0 - smoothstep(0.006, 0.016, k2)) * 0.6, crD = (1.0 - smoothstep(0.026, 0.05, k1)) * (1.0 - cr);',
        '  c = mix(c, vec3(0.98, 1.0, 1.0), clamp(cr, 0.0, 1.0) * 0.8) - vec3(0.05, 0.03, 0.0) * crD;',
        // 靠边的白霜
        '  float fr = (1.0 - smoothstep(0.0, 0.8, e)) * smoothstep(0.35, 0.65, texture2D(uNoise, p * 2.2).a);',
        '  c = mix(c, vec3(0.97, 0.99, 1.0), fr * 0.75);',
        // 反光：越斜着看越是天的颜色；朝着太阳那边一条亮带；脚边一闪一闪的冰晶
        '  vec3 v = normalize(cameraPosition - vW); float fre = pow(1.0 - clamp(v.y, 0.0, 1.0), 2.2); c = mix(c, uSky, fre * 0.3);',
        '  float gp = pow(max(dot(normalize(p - cameraPosition.xz), uSunXZ), 0.0), 6.0); c += vec3(1.0, 0.97, 0.88) * gp * 0.22;',
        '  float g1 = texture2D(uNoise, p * 1.4 + vec2(uTime * 0.015, 0.0)).g, g2 = texture2D(uNoise, p * 1.9 - vec2(0.0, uTime * 0.012)).g;',
        '  c += vec3(0.6) * smoothstep(0.74, 0.76, min(g1, g2)) * (1.0 - smoothstep(4.0, 18.0, vDep));',
        '  c *= 1.0 - 0.2 * cloudSh(p);',
        '  gl_FragColor = vec4(airFog(c, vDep, vW.y), ' + (Q.post ? '0.0' : '1.0') + ');',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    keep.push(iceMat);
    function buildIce() {
      const L = LAND, S = L.S, W = m.W, H = m.H, tw = W + MG * 2, th = H + MG * 2, isI = (x, y) => tIn(x, y) === 'I';
      let any = false;
      const kNot = new Uint8Array(tw * th);
      for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) { const i = isI(tx - MG, ty - MG); kNot[ty * tw + tx] = i ? 0 : 1; if (i) any = true; }
      if (!any) return;
      INFO.ice = 1;
      const dE = chamfer(kNot, tw, th, S), pos = [], ae = [], idx = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!isI(x, y)) continue;
        const b = pos.length / 3;
        for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) { const px = x + i / S, pz = y + j / S, q = ((y + MG) * S + j) * L.nx + (x + MG) * S + i; pos.push(px, L.ground(px, pz) + .03, pz); ae.push(dE[q]); }
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = b + j * (S + 1) + i, c = a + S + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
      }
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('aE', new T3.Float32BufferAttribute(ae, 1)); g.setIndex(idx); own.push(g);
      iceMat.uniforms.uSky.value.set(MOOD.sky[2]);
      still(add(new T3.Mesh(g, iceMat), false, false));
    }

    // ---------- 拼几何体的小工具：把很多小零件倒进一个「袋子」，最后变成一个网格（一次画完） ----------
    const Bag = () => ({ p: [], n: [], c: [] });
    const _c = new T3.Color();
    // col：'#rrggbb'，或者 (out, nx, ny, nz, px, py, pz) => 给 out 上色 的函数
    function put(bag, g, col, x, y, z) {
      const s = g.index ? g.toNonIndexed() : g;
      if (!s.attributes.normal) s.computeVertexNormals();
      const P = s.attributes.position, N = s.attributes.normal, fn = typeof col === 'function' ? col : null;
      if (!fn) _c.set(col);
      x = x || 0; y = y || 0; z = z || 0;
      for (let i = 0; i < P.count; i++) {
        const px = P.getX(i), py = P.getY(i), pz = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
        bag.p.push(px + x, py + y, pz + z); bag.n.push(nx, ny, nz);
        if (fn) fn(_c, nx, ny, nz, px, py, pz);
        bag.c.push(_c.r, _c.g, _c.b);
      }
      if (s !== g) s.dispose();
      g.dispose();
      return bag;
    }
    // 一个三角形 / 四边形（平的，法线自己算）；颜色可以每个角不一样
    function tri(bag, a, b, c, ca, cb, cc) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      bag.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); bag.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      cb = cb || ca; cc = cc || ca;
      bag.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    }
    function quad(bag, a, b, c, d, ca, cb, cc, cd) { tri(bag, a, b, c, ca, cb || ca, cc || ca); tri(bag, a, c, d, ca, cc || ca, cd || ca); }
    function bake(bag) {
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(bag.p, 3));
      g.setAttribute('normal', new T3.Float32BufferAttribute(bag.n, 3));
      g.setAttribute('color', new T3.Float32BufferAttribute(bag.c, 3));
      return g;
    }
    const box = (bag, w, h, d, col, x, y, z) => put(bag, new T3.BoxGeometry(w, h, d).translate(0, h / 2, 0), col, x, y, z);
    // 上色的几种办法：按高度从 lo 到 hi；树叶团（顶上亮、底下暗）；顶面一种颜色、侧面一种
    const byY = (lo, hi, y0, y1) => { const a = C(lo), b = C(hi); return (out, nx, ny, nz, px, py) => { out.copy(a).lerp(b, clamp((py - y0) / (y1 - y0), 0, 1)); }; };
    const leafC = (lo, mid, hi) => { const a = C(lo), b = C(mid), c = C(hi); return (out, nx, ny) => { if (ny > 0) out.copy(b).lerp(c, ny * ny); else out.copy(b).lerp(a, Math.min(1, -ny * 1.4)); }; };
    const topSide = (top, side) => { const a = C(top), b = C(side); return (out, nx, ny) => { out.copy(ny > .5 ? a : b); }; };

    // ---------- 软的、圆的东西：球、树干、树叶贴片 ----------
    // 这些零件的法线都不是按一块块小面算的：球的法线从球心往外（还可以再往「整个树冠的中心」外面掰），树干的法线从轴心往外，所以受光是连续的、软的
    const BagU = () => ({ p: [], n: [], c: [], u: [] });   // 带贴图坐标的袋子（树叶贴片）
    const bakeU = bag => { const g = bake(bag); g.setAttribute('uv', new T3.Float32BufferAttribute(bag.u, 2)); return g; };
    // 把一模一样的顶点并起来（反复画很多遍的零件——树、草——顶点能少一大半）
    function weld(g) {
      const names = Object.keys(g.attributes), atts = names.map(n => g.attributes[n]), n = atts[0].count, seen = new Map(), idx = new Uint32Array(n), outs = atts.map(() => []);
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        let key = '';
        for (let a = 0; a < atts.length; a++) { const s = atts[a].itemSize, arr = atts[a].array; for (let k = 0; k < s; k++) key += Math.round(arr[i * s + k] * 2048) + ','; }
        let j = seen.get(key);
        if (j === undefined) { j = cnt++; seen.set(key, j); for (let a = 0; a < atts.length; a++) { const s = atts[a].itemSize, arr = atts[a].array; for (let k = 0; k < s; k++) outs[a].push(arr[i * s + k]); } }
        idx[i] = j;
      }
      const o = new T3.BufferGeometry();
      names.forEach((nm, a) => o.setAttribute(nm, new T3.Float32BufferAttribute(outs[a], atts[a].itemSize)));
      o.setIndex(new T3.BufferAttribute(cnt > 65535 ? idx : new Uint16Array(idx), 1));
      g.dispose();
      return o;
    }
    const triCount = g => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
    const ICO = {};
    const icoPos = det => ICO[det] || (ICO[det] = (() => { const g = new T3.IcosahedronGeometry(1, det), a = new Float32Array(g.attributes.position.array); g.dispose(); return a; })());
    // 一个软的球：细分的二十面体，表面按噪声鼓一鼓（lump），可以压扁拉长（sx sy sz）。
    // o.bc / o.bk：法线往「从 bc 这一点往外」掰多少——一棵树的几团叶子都朝同一个中心掰，整个树冠受光就像一个大球；o.col(out, nx, ny, nz) 上色
    function ball(bag, r, det, x, y, z, o) {
      const U0 = icoPos(det), sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || 1, lump = o.lump || 0, bc = o.bc, bk = bc ? (o.bk == null ? .55 : o.bk) : 0, seed = (o.seed || 0) * 3.7;
      for (let i = 0; i < U0.length; i += 3) {
        const ux = U0[i], uy = U0[i + 1], uz = U0[i + 2];
        const k = r * (1 + lump * 2 * (vnoise(ux * 2.2 + uz * 1.3 + seed, uy * 2.2 - uz * .9 + seed * 1.7) - .5));
        const px = x + ux * k * sx, py = y + uy * k * sy, pz = z + uz * k * sz;
        let nx = ux / sx, ny = uy / sy, nz = uz / sz, l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (bc) { const bx = px - bc[0], by = py - bc[1], bz = pz - bc[2], bl = Math.hypot(bx, by, bz) || 1; nx = lerp(nx, bx / bl, bk); ny = lerp(ny, by / bl, bk); nz = lerp(nz, bz / bl, bk); l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
        bag.p.push(px, py, pz); bag.n.push(nx, ny, nz);
        o.col(_c, nx, ny, nz, px - x, py - y, pz - z); bag.c.push(_c.r, _c.g, _c.b);
      }
    }
    // 树干：沿着一条弯线的一截截圆筒，法线从轴心往外；一圈深一圈浅（bands）或者从下往上由深到浅
    function trunkTo(bag, pts, r0, r1, sides, cLo, cHi, bands) {
      const n = pts.length - 1, ca = new T3.Color(), cb = new T3.Color();
      for (let k = 0; k < n; k++) {
        const A0 = pts[k], B0 = pts[k + 1];
        let ra = lerp(r0, r1, k / n), rb = lerp(r0, r1, (k + 1) / n);
        if (bands) { ca.copy(k % 2 ? cLo : cHi); cb.copy(ca).multiplyScalar(.9); ra *= 1.07; rb *= .95; } else { ca.copy(cLo).lerp(cHi, k / n); cb.copy(cLo).lerp(cHi, (k + 1) / n); }
        for (let q = 0; q < sides; q++) {
          const a0 = q / sides * 6.2832, a1 = (q + 1) / sides * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
          const V = [[A0[0] + c0 * ra, A0[1], A0[2] + s0 * ra, c0, s0, ca], [B0[0] + c0 * rb, B0[1], B0[2] + s0 * rb, c0, s0, cb], [B0[0] + c1 * rb, B0[1], B0[2] + s1 * rb, c1, s1, cb], [A0[0] + c1 * ra, A0[1], A0[2] + s1 * ra, c1, s1, ca]];
          for (const i of [0, 1, 2, 0, 2, 3]) { const p = V[i]; bag.p.push(p[0], p[1], p[2]); bag.n.push(p[3] * .97, .22, p[4] * .97); bag.c.push(p[5].r, p[5].g, p[5].b); }
        }
      }
    }
    // 一片树叶贴片：底边中点 b，半宽 R、高 Uv（都是三维的向量）。法线是「从树冠中心 bc 往外」，所以它和后面那团叶子受一样的光；叶尖的颜色往 tip 偏
    function cardAt(Cd, cell, b, R, Uv, bc, col, tip, dim) {
      const t = [b[0] + Uv[0], b[1] + Uv[1], b[2] + Uv[2]];
      const nr = q => { const x = q[0] - bc[0], y = q[1] - bc[1], z = q[2] - bc[2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
      const n0 = nr(b), n1 = nr(t), c0 = new T3.Color(), c1 = new T3.Color();
      col(c0, n0[0], n0[1], n0[2]); col(c1, n1[0], n1[1], n1[2]);
      if (dim) { c0.multiplyScalar(dim); c1.multiplyScalar(.5 + dim * .5); }
      if (tip) c1.lerp(tip, .36);
      const V = [[b[0] - R[0], b[1] - R[1], b[2] - R[2], cell[0], cell[3]], [b[0] + R[0], b[1] + R[1], b[2] + R[2], cell[2], cell[3]], [t[0] + R[0], t[1] + R[1], t[2] + R[2], cell[2], cell[1]], [t[0] - R[0], t[1] - R[1], t[2] - R[2], cell[0], cell[1]]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const q = V[i], up = i >= 2, n = up ? n1 : n0, c = up ? c1 : c0; Cd.p.push(q[0], q[1], q[2]); Cd.n.push(n[0], n[1], n[2]); Cd.c.push(c.r, c.g, c.b); Cd.u.push(q[3], q[4]); }
    }
    // 树叶贴片都立在一个稍微仰着、朝着镜头的平面里（镜头永远在南边往北看）：X 是这个平面里的「右」，UPV 是「上」，TOC 是朝着镜头的方向
    const CAMP = .5, UPV = [0, Math.cos(CAMP), -Math.sin(CAMP)], TOC = [0, Math.sin(CAMP), Math.cos(CAMP)];
    // 一团叶子：一个软的球，轮廓上围一圈树叶贴片（叶尖朝外，轮廓就是叶子不是多边形），朝着镜头的这一面再贴几片（一层压一层的感觉）
    function puff(S, Cd, r, x, y, z, o) {
      const sx = o.sx || 1, sy = o.sy || .9, bc = o.bc || [x, y, z], seed = o.seed || 0;
      if (!o.noBall) ball(S, r * .93, o.det == null ? 1 : o.det, x, y, z, { sx, sy, sz: o.sz || 1, lump: o.lump == null ? .13 : o.lump, bc, bk: o.bk, col: (out, nx, ny, nz) => { o.col(out, nx, ny, nz); out.multiplyScalar(.87); }, seed });
      if (!Cd) return;
      const rx = r * sx, ry = r * sy, n = o.ring || 0, a0 = o.a0 == null ? -.7 : o.a0, a1 = o.a1 == null ? Math.PI + .7 : o.a1, cs = o.cs || 1;
      for (let k = 0; k < n; k++) {
        const j = hash2(k * 7 + 1, seed * 13 + 91), a = a0 + (a1 - a0) * (k + .5 + (j - .5) * .6) / n, ca = Math.cos(a), sa = Math.sin(a);
        const h = r * (.6 + j * .32) * cs, w = h * .5, kk = .66 + hash2(k, seed * 13 + 92) * .1;
        const b = [x + ca * rx * kk, y + sa * ry * kk * UPV[1] + TOC[1] * r * .12, z + sa * ry * kk * UPV[2] + TOC[2] * r * .12];
        cardAt(Cd, (k + seed) % 2 ? LEAF.clumpB : LEAF.clump, b, [sa * w, -ca * w * UPV[1], -ca * w * UPV[2]], [ca * h, sa * h * UPV[1], sa * h * UPV[2]], bc, o.col, o.tip, .9 + hash2(k, seed * 13 + 96) * .2);
      }
      const nd = o.dab || 0;
      for (let k = 0; k < nd; k++) {
        const j1 = hash2(k * 3 + 1, seed * 13 + 93), j2 = hash2(k * 3 + 2, seed * 13 + 94), dx = (j1 * 2 - 1) * .76, dy = -.74 + j2 * 1.44, dz = Math.sqrt(Math.max(.04, 1 - dx * dx - dy * dy));
        // 叶尖朝「上、往外」：从球的中轴往外的方向再加一点朝上
        let ux = dx * .7, uy = dy * .7 + (dy > -.2 ? .75 : -.3); const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
        const h = r * (.44 + j1 * .2) * cs, w = h * .56;
        const cx = x + dx * rx, cy = y + dy * ry * UPV[1] + dz * r * 1.14 * TOC[1], cz = z + dy * ry * UPV[2] + dz * r * 1.14 * TOC[2];
        const Uv = [ux * h, uy * h * UPV[1], uy * h * UPV[2]];
        cardAt(Cd, (k + seed) % 2 ? LEAF.clump : LEAF.clumpB, [cx - Uv[0] * .45, cy - Uv[1] * .45, cz - Uv[2] * .45], [uy * w, -ux * w * UPV[1], -ux * w * UPV[2]], Uv, bc, o.col, o.tip, .86 + hash2(k, seed * 13 + 97) * .26);
      }
    }
    // 一片棕榈叶：从 b 出发朝 ang 方向，先翘起来一点再垂下去；一截一截的带子，贴着 frond 那张图。fold > 0 时左右两半中间对折一点（浅浅的 V 字）
    function frond(Cd, b, ang, len, up, droop, wid, segs, bc, cA, cB, cT, fold) {
      const ca = Math.cos(ang), sa = Math.sin(ang), c = LEAF.frond, vm = (c[1] + c[3]) / 2, w = wid / 2;
      const at = s => { const r = len * (s - .12 * s * s); return [b[0] + ca * r, b[1] + up * Math.sin(s * 2.5) - droop * s * s, b[2] + sa * r]; };
      const vert = (q, col, u, v) => {
        let nx = (q[0] - bc[0]) * .55, ny = (q[1] - bc[1]) * .55 + .7, nz = (q[2] - bc[2]) * .55; const l = Math.hypot(nx, ny, nz) || 1;
        Cd.p.push(q[0], q[1], q[2]); Cd.n.push(nx / l, ny / l, nz / l); Cd.c.push(col.r, col.g, col.b); Cd.u.push(u, v);
      };
      for (let q = 0; q < segs; q++) {
        const s0 = q / segs, s1 = (q + 1) / segs, p0 = at(s0), p1 = at(s1), u0 = lerp(c[0], c[2], s0), u1 = lerp(c[0], c[2], s1), f0 = fold * w * (1 - s0 * .5), f1 = fold * w * (1 - s1 * .5);
        const L0 = [p0[0] - sa * w, p0[1] - f0, p0[2] + ca * w], R0 = [p0[0] + sa * w, p0[1] - f0, p0[2] - ca * w], L1 = [p1[0] - sa * w, p1[1] - f1, p1[2] + ca * w], R1 = [p1[0] + sa * w, p1[1] - f1, p1[2] - ca * w];
        const m0 = cA.clone().lerp(cT, s0 * s0), m1 = cA.clone().lerp(cT, s1 * s1), e0 = cB.clone().lerp(cT, s0 * s0 * .7), e1 = cB.clone().lerp(cT, s1 * s1 * .7);
        if (fold) {
          [[p0, m0, u0, vm], [L0, e0, u0, c[1]], [L1, e1, u1, c[1]], [p0, m0, u0, vm], [L1, e1, u1, c[1]], [p1, m1, u1, vm], [p0, m0, u0, vm], [p1, m1, u1, vm], [R1, e1, u1, c[3]], [p0, m0, u0, vm], [R1, e1, u1, c[3]], [R0, e0, u0, c[3]]].forEach(a => vert(a[0], a[1], a[2], a[3]));
        } else {
          [[L0, e0, u0, c[1]], [L1, e1, u1, c[1]], [R1, e1, u1, c[3]], [L0, e0, u0, c[1]], [R1, e1, u1, c[3]], [R0, e0, u0, c[3]]].forEach(a => vert(a[0], a[1], a[2], a[3]));
        }
      }
    }

    // ---------- 不会动的东西：石头类（石坎、岩壁、小石头）、普通的（栅栏、码头、楼梯）、能对着按 A 的（告示牌、地标）各拼成一个网格 ----------
    // 四个角各带自己的法线和颜色的四边形（石坎、岩壁用它，受光是连续的，看不出一块块的面）
    function quadN(bag, a, b, c, d, na, nb, nc, nd, ca, cb, cc, cd) {
      for (const v of [[a, na, ca], [b, nb, cb], [c, nc, cc], [a, na, ca], [c, nc, cc], [d, nd, cd]]) { bag.p.push(v[0][0], v[0][1], v[0][2]); bag.n.push(v[1][0], v[1][1], v[1][2]); bag.c.push(v[2].r, v[2].g, v[2].b); }
    }
    let boatG = null;
    function buildStatics() {
      const L = LAND, S = L.S, bag = Bag(), rk = Bag(), th = Bag(), fr = BagU(), P = PAL, W = m.W, H = m.H, hiD = tier === 'high';
      const rock = P.rock || '#a39b8b', earth = mixC(rock, '#8f6b47', .42).getStyle(), rLo = mixC(A.shade(rock, .62), '#6b4a30', .4), rMid = C(earth), rHi = mixC(A.shade(rock, 1.04), '#b98f63', .3);
      const lipC = mixC(A.shade(P.grass, .92), P.tall, .18), lipHi = mixC(P.grass, '#f1f3a4', .22), FR = LEAF.fringe, UP = [0, 1, 0];
      // 垂在石头边上的一排草（贴图）：从 (xa,ya) 到 (xb,yb)，朝 (nx,nz) 这边伸出去一点再垂下来
      const fringe = (xa, ya, za, xb, yb, zb, ox, oz, ph) => {
        const u0 = lerp(FR[0], FR[2], ph), u1 = lerp(FR[0], FR[2], ph + .249), dn = .22;
        const V = [[xa + ox, ya - dn, za + oz, u0, FR[3], lipHi], [xb + ox, yb - dn, zb + oz, u1, FR[3], lipHi], [xb + ox * .3, yb + .035, zb + oz * .3, u1, FR[1], lipC], [xa + ox * .3, ya + .035, za + oz * .3, u0, FR[1], lipC]];
        for (const i of [0, 1, 2, 0, 2, 3]) { const q = V[i]; fr.p.push(q[0], q[1], q[2]); fr.n.push(0, 1, 0); fr.c.push(q[5].r, q[5].g, q[5].b); fr.u.push(q[3], q[4]); }
      };
      // 台阶：细网格上「线北边」和「线南边」两排点之间差多少，石坎就多高（到缺口那里自己收成 0）。坎面往外鼓一点，顶上一条草边垂下来
      for (let y = 0; y < H - 1; y++) {
        if (!m.grid[y].includes('L')) continue;
        if (!L.step) {   // 高度没用上（数据对不上）：只画一道矮坎
          for (let x = 0; x < W; x++) if (m.grid[y][x] === 'L') box(rk, 1.01, .2, .3, topSide(A.shade(P.grass, .95), A.shade(rock, .85)), x + .5, 0, y + .8);
          continue;
        }
        const jn = (y + MG) * S + Math.floor(CUT * S), js = jn + 1, zN = L.Z0 + jn / S, zS = L.Z0 + js / S;
        const nB = [0, -.12, 1], nM = [0, .22, 1], nT = [0, .6, .8];
        for (let i = 0; i < L.nx - 1; i++) {
          const ta = L.hgt[jn * L.nx + i], tb = L.hgt[jn * L.nx + i + 1], ba = L.hgt[js * L.nx + i] - .04, bb = L.hgt[js * L.nx + i + 1] - .04;
          if (ta - ba < .1 && tb - bb < .1) continue;
          const xa = L.X0 + i / S, xb = xa + 1 / S, ja = (rnd(i, y, 31) - .5) * .06, jb = (rnd(i + 1, y, 31) - .5) * .06;
          const at = (x, b0, t0, j, k) => [x, lerp(b0, t0, k), zS + j + lerp(.085, .012, Math.sqrt(k))];
          const ks = [0, .4, .8, 1], ns = [nB, nM, nM, nT], cs2 = [rLo, rMid, rHi, rHi];
          for (let q = 0; q < 3; q++) quadN(rk, at(xa, ba, ta + .015, ja, ks[q]), at(xb, bb, tb + .015, jb, ks[q]), at(xb, bb, tb + .015, jb, ks[q + 1]), at(xa, ba, ta + .015, ja, ks[q + 1]), ns[q], ns[q], ns[q + 1], ns[q + 1], cs2[q], cs2[q], cs2[q + 1], cs2[q + 1]);
          quadN(rk, [xa, ta + .015, zN - .02], [xa, ta + .015, zS + ja + .014], [xb, tb + .015, zS + jb + .014], [xb, tb + .015, zN - .02], UP, UP, UP, UP, lipC, lipC, lipC, lipC);
          fringe(xa, ta + .015, zS + ja + .014, xb, tb + .015, zS + jb + .014, 0, .05, (i % 4) * .25);
        }
      }
      const isCliff = (x, y) => { const c = tIn(x, y); return c === 'R' || c === 'X' || c === 'K'; };
      // 岩壁越往里越高（一大片岩壁是一座山，不是一排一样高的柱子）：每格离最近的「不是岩壁」的格子有几格（最多算 4 格）
      const cDep = new Float32Array(W * H);
      { const q = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (!isCliff(x, y)) continue; cDep[k] = 9; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = tIn(x + dx, y + dy); return c !== '' && !isCliff(x + dx, y + dy); })) { cDep[k] = 1; q.push(k); } }
        while (q.length) { const k = q.shift(), x = k % W, y = (k - x) / W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return; const j = ny * W + nx; if (cDep[j] > cDep[k] + 1) { cDep[j] = cDep[k] + 1; q.push(j); } }); }
        for (let k = 0; k < W * H; k++) if (cDep[k] > 8) cDep[k] = 4; }
      const depAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : cDep[y * W + x]);
      const cornerH = (ix, iz) => {
        const cells = [[0, 0], [-1, 0], [0, -1], [-1, -1]], inner = cells.every(([dx, dy]) => isCliff(ix + dx, iz + dy));
        const dep = cells.reduce((a, [dx, dy]) => a + (isCliff(ix + dx, iz + dy) ? Math.min(4, depAt(ix + dx, iz + dy)) : 0), 0) / 4;
        return 1.7 + .75 * rnd(ix, iz, 21) + (inner ? .55 : 0) + Math.max(0, dep - 1) * (.42 + .4 * fbm(ix * .23 + 5, iz * .23 + 11));
      };
      // 岩壁的一个角朝哪边是「外」：挨着这个角的岩壁格子的中心都往这个角指，加起来就是
      const cornerOut = (ix, iz) => { let ox = 0, oz = 0; [[0, 0], [-1, 0], [0, -1], [-1, -1]].forEach(([dx, dy]) => { if (isCliff(ix + dx, iz + dy)) { ox += -(dx + .5); oz += -(dy + .5); } }); const l = Math.hypot(ox, oz); return l < .01 ? [0, 0] : [ox / l, oz / l]; };
      // 岩壁的颜色跟着地貌（GROUND.rock：暗、中、亮）；顶上是草 / 雪 / 光石头 / 苔藓
      const gr3 = GND.rock || [A.shade(rock, .62), earth, A.shade(rock, 1.04)], kLo = C(gr3[0]), kMid = C(gr3[1]), kHi = C(gr3[2]), cap = GND.cap || 'grass';
      const capC = cap === 'snow' ? C('#f2f7fb') : cap === 'rock' ? mixC(gr3[2], gr3[1], .3) : cap === 'moss' ? mixC(gr3[1], '#6f9a4c', .55) : mixC(A.shade(P.grass, .9), rock, .25), darkC = C('#17100c');
      const capLip = cap === 'snow' ? C('#ffffff') : capC, capFr = cap !== 'rock';
      const postG = (r, h, seg) => new T3.CylinderGeometry(r * .92, r, h, seg).translate(0, h / 2, 0);
      // 岩壁侧面的一层层：每层的上沿往外伸一点（顶面朝上、受光，是亮的一道），下沿往里收（背光，暗的一道），像一层层叠起来的岩层
      const KS = hiD ? [0, .14, .3, .44, .6, .74, .88, 1] : tier === 'mid' ? [0, .2, .42, .62, .82, 1] : [0, .4, .8, 1];
      const cliffC = [];   // 每一层的颜色（从下往上）：最下面暗，中间几层深浅交替，最上面亮
      for (let j = 0; j < KS.length; j++) { const k = KS[j], cc = kLo.clone().lerp(kMid, sstep(0, .35, k)).lerp(kHi, sstep(.5, 1, k)); cc.multiplyScalar(1 + (j % 2 ? -1 : 1) * GND.band * .25); cliffC.push(cc); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x], cx = x + .5, cz = y + .5;
        if (isCliff(x, y)) {
          // 岩壁：一格一块，挨着的拼成一整面（四个角的高度是共用的，顶面连成一片，越往里越高）；侧面一层层的岩层、底下往外鼓，角上的法线朝斜外（拐角是圆着过去的），
          // 顶上是草（或雪、苔藓、光石头），朝南的边垂着一排草
          let top = 0;
          const cr = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([ix, iz]) => {
            const inner = [[0, 0], [-1, 0], [0, -1], [-1, -1]].every(([dx, dy]) => isCliff(ix + dx, iz + dy)), out = cornerOut(ix, iz);
            const px = ix + (inner ? 0 : (rnd(ix, iz, 22) - .5) * .14), pz = iz + (inner ? 0 : (rnd(iz, ix, 23) - .5) * .14), b = L.ground(px, pz) - .1, h = b + .05 + cornerH(ix, iz);
            top = Math.max(top, h);
            return { x: px, z: pz, b, h, ox: out[0], oz: out[1] };
          });
          occH[y * W + x] = top; cliffTop[y * W + x] = (cr[0].h + cr[1].h + cr[2].h + cr[3].h) / 4;
          const cc = c === 'X' ? rMid : capC;
          quadN(rk, [cr[0].x, cr[0].h, cr[0].z], [cr[3].x, cr[3].h, cr[3].z], [cr[2].x, cr[2].h, cr[2].z], [cr[1].x, cr[1].h, cr[1].z], UP, UP, UP, UP, cc, cc, cc, cc);
          [[3, 2, 0, 1], [1, 0, 0, -1], [2, 1, 1, 0], [0, 3, -1, 0]].forEach(([a, b, dx, dz]) => {
            if (isCliff(x + dx, y + dz)) return;
            const pa = cr[a], pb = cr[b];
            // 这一面中间再加一列点，往外鼓一点（按世界坐标的噪声，鼓多少每面不一样），面就不是一块平板
            const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2, bulge = (fbm(mx * 1.3 + 3, mz * 1.3 + 7) - .35) * .22;
            const pm = { x: mx + dx * bulge, z: mz + dz * bulge, b: L.ground(mx, mz) - .1, h: (pa.h + pb.h) / 2 + (rnd(x * 3 + dx, y * 3 + dz, 25) - .5) * .25, ox: dx, oz: dz };
            const cols = [pa, pm, pb];
            const pt = (p, j) => {
              const k = KS[j], bl = lerp(.13, 0, Math.sqrt(k)), st = j > 0 && j < KS.length - 1 ? (j % 2 ? .05 : -.018) * (.7 + .6 * rnd(Math.round(p.x * 4), j, 26)) : 0;
              const o = bl + st;
              return [p.x + (p.ox * .6 + dx * .4) * o, lerp(p.b, p.h, k), p.z + (p.oz * .6 + dz * .4) * o];
            };
            const nr = (p, j) => { const k = KS[j], lip = j > 0 && j < KS.length - 1 ? (j % 2 ? .38 : -.22) : 0; return [p.ox * .55 + dx * .45, lerp(-.1, .55, k * k) + lip, p.oz * .55 + dz * .45]; };
            for (let s = 0; s < 2; s++) {
              const p0 = cols[s], p1 = cols[s + 1];
              for (let j = 0; j < KS.length - 1; j++) {
                if (GND.book) {   // 书山：每一层是一本书——伸出来的那层是彩色的书皮，缩进去的那层是米白的书页；书皮的颜色每两三格换一本
                  const bc2 = j % 2 ? BOOKC[Math.floor(hash2(Math.floor((p0.x + p0.z) / 2.3 + j * 7), j + Math.round(p0.b * 3)) * BOOKC.length)] : PAGEC;
                  quadN(rk, pt(p0, j), pt(p1, j), pt(p1, j + 1), pt(p0, j + 1), nr(p0, j), nr(p1, j), nr(p1, j + 1), nr(p0, j + 1), bc2, bc2, bc2, bc2);
                } else quadN(rk, pt(p0, j), pt(p1, j), pt(p1, j + 1), pt(p0, j + 1), nr(p0, j), nr(p1, j), nr(p1, j + 1), nr(p0, j + 1), cliffC[j], cliffC[j], cliffC[j + 1], cliffC[j + 1]);
              }
            }
            // 顶上的边：一圈压在岩壁上沿的「盖子」（草皮 / 雪 / 苔藓伸出来一点）
            if (cap !== 'rock' && c !== 'X') {
              const lo = (p, e) => [p.x + (p.ox * .6 + dx * .4) * e, p.h - .07, p.z + (p.oz * .6 + dz * .4) * e], hi = (p, e) => [p.x + (p.ox * .6 + dx * .4) * e, p.h + .02, p.z + (p.oz * .6 + dz * .4) * e];
              const nO = [dx * .7, .3, dz * .7];
              for (let s = 0; s < 2; s++) { const p0 = cols[s], p1 = cols[s + 1]; quadN(rk, lo(p0, .05), lo(p1, .05), hi(p1, .04), hi(p0, .04), nO, nO, UP, UP, capLip, capLip, capLip, capLip); quadN(rk, hi(p0, .04), hi(p1, .04), [p1.x, p1.h + .015, p1.z], [p0.x, p0.h + .015, p0.z], UP, UP, UP, UP, capLip, capLip, capLip, capLip); }
            }
            if (dz === 1 && c !== 'X' && capFr) { fringe(pa.x, pa.h, pa.z, pm.x, pm.h, pm.z, 0, .06, rnd(x, y, 24) * .7); fringe(pm.x, pm.h, pm.z, pb.x, pb.h, pb.z, 0, .06, rnd(y, x, 24) * .7); }
          });
          if (c === 'K') {   // 洞口：南面一个黑色的拱门（里面越往深处越黑），门框是一圈切好的石块，脚下两块大石头
            const y0 = L.ground(cx, cz + .6) - .05, zf = y + 1.15, n = 12, inC = C('#3a2c22'), sc = topSide(gr3[2], A.shade(gr3[2], .86));
            for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n; tri(rk, [cx, y0, zf], [cx + Math.cos(a0) * .38, y0 + .05 + Math.sin(a0) * .88, zf], [cx + Math.cos(a1) * .38, y0 + .05 + Math.sin(a1) * .88, zf], darkC, inC, inC); }
            for (let k = 0; k < 7; k++) {
              const a = Math.PI * (k + .5) / 7, g = new T3.BoxGeometry(.2, .15, .14).rotateZ(a - Math.PI / 2);
              put(rk, g, sc, cx + Math.cos(a) * .48, y0 + .05 + Math.sin(a) * .98, zf + .03);
            }
            [-1, 1].forEach(sd => box(rk, .16, .3, .16, sc, cx + sd * .48, y0, zf + .03));
          }
        } else if (c === 'f') {
          // 栅栏：圆木桩、两道圆木横杆
          const y0 = L.ground(cx, cz), fc = m.theme === 'city' ? '#aab8c2' : m.theme === 'farm' || m.theme === 'hello' ? '#fffdf5' : '#d6a56e', seg = hiD ? 10 : 6;
          put(bag, postG(.06, .6, seg), byY(A.shade(fc, .8), fc, 0, .5), cx, y0 - .04, cz);
          put(bag, new T3.SphereGeometry(.058, seg, Math.max(3, seg >> 1)).scale(1, .7, 1), A.shade(fc, 1.03), cx, y0 + .56, cz);
          const e = tIn(x + 1, y) === 'f', s2 = tIn(x, y + 1) === 'f', w = tIn(x - 1, y) === 'f', n = tIn(x, y - 1) === 'f';
          [.2, .4].forEach(h => {
            if (e) put(bag, new T3.CylinderGeometry(.03, .03, 1.0, seg > 6 ? 8 : 5).rotateZ(Math.PI / 2), fc, cx + .5, (y0 + L.ground(cx + 1, cz)) / 2 + h, cz);
            if (s2) put(bag, new T3.CylinderGeometry(.03, .03, 1.0, seg > 6 ? 8 : 5).rotateX(Math.PI / 2), fc, cx, (y0 + L.ground(cx, cz + 1)) / 2 + h, cz + .5);
            if (!e && !w && !s2 && !n) put(bag, new T3.CylinderGeometry(.03, .03, .9, seg > 6 ? 8 : 5).rotateZ(Math.PI / 2), fc, cx, y0 + h, cz);
          });
        } else if (c === 'B') {
          // 告示牌：两根圆木桩，一块有厚度、带边框的木板，上面几行字（深色的小条）
          const y0 = L.ground(cx, cz + .05) - .03, z = cz + .05, seg = hiD ? 10 : 6;
          [-.22, .22].forEach(k => { put(th, postG(.04, .56, seg), byY('#6f4526', '#8a5a33', 0, .5), cx + k, y0, z - .03); });
          box(th, .8, .46, .06, byY('#c79658', '#e6bb7d', 0, .46), cx, y0 + .41, z);
          box(th, .84, .05, .08, '#a87440', cx, y0 + .86, z); box(th, .84, .05, .08, '#9a6838', cx, y0 + .38, z);
          [[.72, .5], [.62, .36], [.52, .44]].forEach(([h, w]) => box(th, w, .045, .02, '#6f4526', cx - (.5 - w) / 2, y0 + h, z + .035));
        } else if (c === 'T' && m.theme === 'city' && !['#', 'T'].some(q => tIn(x - 1, y) === q && tIn(x + 1, y) === q)) {
          // 规则城的行道树：种在一个方方的石头花池里（池沿浅灰，里面是深色的土）
          const y0 = L.ground(cx, cz) - .02;
          box(bag, .78, .22, .78, topSide('#d5dadd', '#a9b1b6'), cx, y0, cz); box(bag, .62, .02, .62, '#6b5442', cx, y0 + .21, cz);
        } else if (c === '%') {
          const y0 = L.ground(cx, cz), sc = P.rock || '#9e9e9e';
          for (let k = 0; k < 3; k++) box(bag, .9, .1 + k * .12, .3, topSide(A.shade(sc, 1.12), A.shade(sc, .85)), cx, y0, y + .85 - k * .3);
        } else if (c === 'r') {
          // 小石头：两三块圆圆的、表面有点坑洼的石头
          const y0 = L.ground(cx, cz), r = rnd(x, y, 5), col = leafC(A.shade(rock, .7), A.shade(rock, .96), A.shade(rock, 1.14)), dt = Math.max(1, Q.det - 1);
          ball(rk, .3 + r * .08, dt, cx - .06, y0 + .15, cz + .04, { sx: 1.12, sy: .76, sz: .96, lump: .14, col, seed: x * 7 + y });
          ball(rk, .17, Math.max(1, dt - 1), cx + .27, y0 + .08, cz + .17, { sy: .8, lump: .16, col, seed: x + y * 5 });
          if (r > .5) ball(rk, .11, Math.max(1, dt - 1), cx - .3, y0 + .05, cz + .26, { sy: .75, lump: .16, col, seed: x * 3 + y * 2 });
        }
        if (L.cls[y * W + x] === 3) {
          // 码头：一块块木板（板和板之间留着缝）、两边的边梁、角上扎进水里的圆木桩，桩头上一圈绳子
          const dy = L.at(cx, cz), wet = (dx, dz) => L.isWater(x + dx, y + dz) && !L.isPier(x + dx, y + dz), pier = (dx, dz) => L.isPier(x + dx, y + dz);
          const ns = pier(0, -1) || pier(0, 1) || (!pier(-1, 0) && !pier(1, 0));   // 这一格的木板是顺着南北走的路横着铺
          const nP = hiD ? 6 : 4;
          for (let k = 0; k < nP; k++) {
            const tone = (k + x + y) % 2 ? '#c99b62' : '#b98950', st = 1 / nP, col = topSide(tone, A.shade(tone, .72));
            if (ns) box(bag, 1.0, .07, st - .02, col, cx, dy - .07, y + st / 2 + k * st); else box(bag, st - .02, .07, 1.0, col, x + st / 2 + k * st, dy - .07, cz);
          }
          [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dz]) => {
            if (wet(dx, dz)) box(bag, dx ? .07 : 1.06, .1, dx ? 1.06 : .07, '#8a6238', cx + dx * .5, dy - .09, cz + dz * .5);
            else if (!pier(dx, dz)) box(bag, dx ? .34 : 1.0, .06, dx ? 1.0 : .34, '#b98950', cx + dx * .62, dy - .075, cz + dz * .62);   // 接岸的那一头多伸出一截
          });
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => {
            if (!(wet(dx, 0) && (wet(0, dz) || !pier(0, dz)))) return;
            const seg = hiD ? 12 : 6, px = cx + dx * .5, pz = cz + dz * .46;
            put(bag, new T3.CylinderGeometry(.065, .078, 1.56, seg), byY('#5d4024', '#8a6238', -.5, .7), px, dy - .56, pz);
            put(bag, new T3.SphereGeometry(.066, seg, 4, 0, 6.2832, 0, Math.PI / 2).scale(1, .5, 1), '#9a7040', px, dy + .22, pz);
            if (hiD) put(bag, new T3.TorusGeometry(.072, .016, 5, seg).rotateX(Math.PI / 2), '#e9dcc0', px, dy + .1, pz);
          });
        }
      }
      // 地标（Z）：每座岛不一样；水上的那个是小船，单独放（会跟着水晃）
      const kinds = (m.def && m.def.markKinds) || [];
      let zi = 0;
      boatG = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (m.grid[y][x] !== 'Z') continue;
        const kind = kinds[zi++] || MARK_OF[m.theme] || 'statue', onWater = L.cls[y * W + x] === 5;
        if (onWater) { const b = Bag(); markInto(b, 'boat', 0, 0, 0); const g = bake(b); own.push(g); boatG = new T3.Mesh(g, propMat); boatG.position.set(x + .5, L.waterLevel(x, y), y + .5); boatG.userData.y0 = boatG.position.y; add(boatG, true); }
        else markInto(th, kind, x + .5, L.ground(x + .5, y + .5), y + .55);
      }
      // 户外的 over 图层：地上画的东西（规则城的斑马线）。斑马线是一道道白条，顺着过马路的方向，沿着马路排开
      if (m.over && m.def && m.def.paint) {
        const ov = (x, y) => (m.over[y] && m.over[y][x]) || '.', road = (x, y) => tIn(x, y) === '=' && ov(x, y) === '.';
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const ch = ov(x, y), pd = ch !== '.' && m.def.paint[ch];
          if (!pd) continue;
          const col = C(typeof pd === 'string' ? pd : pd.c || '#ffffff'), y0 = L.ground(x + .5, y + .5) + .012;
          let gx = x, run = 0; while (ov(gx - 1, y) === ch) gx--; while (ov(gx + run, y) === ch) run++;
          let gy = y, rz = 0; while (ov(x, gy - 1) === ch) gy--; while (ov(x, gy + rz) === ch) rz++;
          const horiz = road(gx - 1, y) || road(gx + run, y);   // 马路是东西向的：白条南北向，沿着 x 排
          for (let k = 0; k < 3; k++) {
            const a = (k + .2) / 3, b = (k + .75) / 3;
            if (horiz) quad(bag, [x + a, y0, y + .06], [x + a, y0, y + .94], [x + b, y0, y + .94], [x + b, y0, y + .06], col);
            else quad(bag, [x + .06, y0, y + a], [x + .06, y0, y + b], [x + .94, y0, y + b], [x + .94, y0, y + a], col);
          }
        }
      }
      [[bag, solidMat], [rk, rockMat], [th, thingMat]].forEach(([b, mt]) => { if (!b.p.length) return; const g = bake(b); own.push(g); still(add(new T3.Mesh(g, mt), true)); });
      if (fr.p.length) { const g = bakeU(fr); own.push(g); still(add(new T3.Mesh(g, fringeMat), false)); }
    }
    const MARK_OF = { hello: 'anchor', crayon: 'crayon', farm: 'scarecrow', school: 'bell', lab: 'telescope', circus: 'balloon', clock: 'clock', party: 'gift', jungle: 'totem', city: 'light', sports: 'trophy', snow: 'snowman', ruins: 'stone' };
    function markInto(bag, kind, x, y, z) {
      const part = (g, col, px, py, pz) => put(bag, g, col, x + (px || 0), y + (py || 0), z + (pz || 0));
      const pb = (w, h, d, col, px, py, pz) => box(bag, w, h, d, col, x + (px || 0), y + (py || 0), z + (pz || 0));
      const base = () => pb(.74, .22, .74, topSide('#dfe6ea', '#b4c0c8'));
      switch (kind) {
        case 'anchor': base(); part(new T3.TorusGeometry(.25, .06, 6, 14, Math.PI).rotateZ(Math.PI), '#546e7a', 0, .58); part(new T3.CylinderGeometry(.05, .05, .7, 6), '#546e7a', 0, .63); part(new T3.TorusGeometry(.1, .04, 6, 12), '#546e7a', 0, 1.03); break;
        case 'crayon': {
          // 一盒大蜡笔：黄绿色的纸盒（前面一块蓝色的标签），里面插着四支高高低低的蜡笔——圆笔杆、一圈深色的包装纸、圆锥形的蜡笔头
          pb(.78, .5, .4, byY('#7cc24a', '#a6dd6a', 0, .5), 0, 0, 0); pb(.5, .26, .02, '#42a5f5', 0, .12, .205);
          [['#ef5350', -.27, .95], ['#ffca28', -.09, 1.15], ['#42a5f5', .09, .85], ['#ab47bc', .27, 1.05]].forEach(([c, ox, hh]) => {
            part(new T3.CylinderGeometry(.085, .085, hh, 10).translate(0, hh / 2, 0), c, ox, .1, 0);
            part(new T3.CylinderGeometry(.088, .088, hh * .4, 10).translate(0, hh * .45, 0), A.shade(c, .72), ox, .1, 0);
            part(new T3.ConeGeometry(.085, .2, 10).translate(0, .1, 0), c, ox, .1 + hh, 0);
          });
          break;
        }
        case 'scarecrow': part(new T3.CylinderGeometry(.04, .04, 1.3, 5).translate(0, .65, 0), '#8a5a33'); pb(.8, .06, .06, '#8a5a33', 0, .95); part(new T3.SphereGeometry(.17, 8, 6), '#f5d7a1', 0, 1.3); part(new T3.ConeGeometry(.25, .22, 8), '#e8c35a', 0, 1.48); pb(.4, .4, .2, '#e57373', 0, .52); break;
        case 'bell': pb(.08, 1.2, .08, '#6d4c41', -.3); pb(.08, 1.2, .08, '#6d4c41', .3); pb(.7, .08, .1, '#6d4c41', 0, 1.2); part(new T3.ConeGeometry(.2, .3, 12).translate(0, -.15, 0), '#ffca28', 0, 1.18); break;
        case 'telescope': part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(.25), '#546e7a', .1); part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(-.25), '#546e7a', -.1); part(new T3.CylinderGeometry(.09, .12, .8, 10).rotateZ(-.9), '#eceff1', .05, .9); break;
        case 'balloon': [['#e53935', -.2, 1.1], ['#fdd835', .15, 1.25], ['#1e88e5', .02, .95]].forEach(([c, px, py]) => { part(new T3.SphereGeometry(.17, 10, 8).scale(1, 1.2, 1), c, px, py); part(new T3.CylinderGeometry(.008, .008, py, 3).translate(0, py / 2, 0), '#555555', px * .3, 0); }); pb(.2, .12, .2, '#8d6e63'); break;
        case 'clock': part(new T3.CylinderGeometry(.06, .08, 1.3, 8).translate(0, .65, 0), '#37474f'); part(new T3.CylinderGeometry(.3, .3, .1, 20).rotateX(Math.PI / 2), '#fffdf5', 0, 1.45); part(new T3.TorusGeometry(.3, .045, 6, 20), '#b8862b', 0, 1.45); pb(.03, .2, .02, '#37474f', 0, 1.45, .06); pb(.14, .03, .02, '#37474f', .06, 1.44, .06); break;
        case 'gift': pb(.7, .6, .7, '#ff80ab'); pb(.72, .1, .15, '#ffd54f', 0, .25); pb(.15, .62, .72, '#ffd54f'); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', -.1, .68); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', .1, .68); break;
        case 'totem': {
          // 动物岛的木图腾：三节圆木，每节刻着一张动物的脸（白眼圈、黑眼珠、一张嘴或一个尖嘴，脸的颜色各不一样），最上面张着一对木翅膀
          [['#a0714a', '#e57373', 0], ['#8d6040', '#4fc3f7', .44], ['#a87a50', '#ffd54f', .88]].forEach(([wc, fc, py], k) => {
            part(new T3.CylinderGeometry(.22, .24, .44, 10).translate(0, .22, 0), byY(A.shade(wc, .8), wc, 0, .44), 0, py);
            pb(.3, .1, .03, fc, 0, py + .24, .21);
            [-1, 1].forEach(sd => { part(new T3.CylinderGeometry(.065, .065, .03, 10).rotateX(Math.PI / 2), '#ffffff', sd * .09, py + .29, .22); part(new T3.CylinderGeometry(.032, .032, .03, 8).rotateX(Math.PI / 2), '#2b211a', sd * .09, py + .29, .235); });
            if (k === 1) part(new T3.ConeGeometry(.05, .14, 6).rotateX(Math.PI / 2), '#ffb300', 0, py + .18, .27); else pb(.14, .04, .02, '#3a2a1e', 0, py + .1, .225);
          });
          [-1, 1].forEach(sd => part(new T3.BoxGeometry(.5, .07, .16).rotateZ(sd * -.35), '#6d4121', sd * .38, 1.32, 0));
          part(new T3.ConeGeometry(.18, .2, 10).translate(0, .1, 0), '#43a047', 0, 1.32);
          break;
        }
        case 'light': part(new T3.CylinderGeometry(.04, .05, 1.2, 6).translate(0, .6, 0), '#455a64'); pb(.24, .6, .2, '#263238', 0, 1.1); [['#e53935', 1.58], ['#fdd835', 1.4], ['#43a047', 1.22]].forEach(([c, py]) => part(new T3.SphereGeometry(.06, 8, 6), c, 0, py, .1)); break;
        case 'trophy': base(); part(new T3.CylinderGeometry(.08, .12, .3, 10).translate(0, .15, 0), '#ffca28', 0, .22); part(new T3.CylinderGeometry(.26, .1, .38, 14).translate(0, .19, 0), '#ffca28', 0, .52); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', .28, .75); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', -.28, .75); break;
        case 'snowman': part(new T3.SphereGeometry(.32, 12, 10), '#ffffff', 0, .3); part(new T3.SphereGeometry(.23, 12, 10), '#ffffff', 0, .78); part(new T3.ConeGeometry(.04, .2, 6).rotateX(Math.PI / 2), '#ff7043', 0, .8, .26); part(new T3.CylinderGeometry(.16, .16, .22, 10), '#37474f', 0, 1.08); part(new T3.TorusGeometry(.2, .05, 6, 14).rotateX(Math.PI / 2), '#e53935', 0, .6); break;
        case 'stone': {
          // 古老的立石：圆了角的高石头（有点歪），正面刻着几道浅浅的古文字，头上和脚下长着苔藓
          const sc = leafC('#8a857a', '#aaa496', '#cdc7b8');
          ball(bag, .3, 1, x, y + .72, z, { sx: 1.05, sy: 2.6, sz: .62, lump: .07, col: sc, seed: Math.round(x * 3 + z) });
          ball(bag, .2, 1, x + .03, y + 1.42, z, { sx: 1.2, sy: .5, sz: .9, lump: .2, col: leafC('#4f6f3c', '#6f8f4a', '#93b46a'), seed: Math.round(x + z * 5) });
          [[.0, .95, .22], [-.06, .78, .16], [.05, .62, .2], [-.02, .46, .14]].forEach(([ox, oy, wd]) => pb(wd, .03, .02, '#6a6458', ox, oy, .19));
          ball(bag, .26, 1, x, y + .04, z + .04, { sx: 1.6, sy: .3, sz: 1.2, lump: .25, col: leafC('#4f6f3c', '#6f8f4a', '#8fb064'), seed: 3 });
          break;
        }
        case 'statue': {
          // 石头的守护鸟：两层的石座上蹲着一只收着翅膀的大鸟（圆身子、圆脑袋、短短的尖嘴），石头上一块块苔藓
          const sc = leafC('#8f8a80', '#b6b0a2', '#dcd6c8'), mc = leafC('#4f6f3c', '#6f8f4a', '#8fb064');
          pb(.78, .22, .78, topSide('#c9c2b2', '#9d968a')); pb(.6, .22, .6, topSide('#d4cdbd', '#a8a194'), 0, .22);
          ball(bag, .3, 2, x, y + .78, z, { sy: 1.15, sz: .9, lump: .05, col: sc, seed: 11 });
          ball(bag, .2, 2, x, y + 1.2, z + .04, { lump: .04, col: sc, seed: 12 });
          part(new T3.ConeGeometry(.06, .16, 6).rotateX(Math.PI / 2), '#a79f8f', 0, 1.18, .25);
          [-1, 1].forEach(sd => { ball(bag, .2, 1, x + sd * .24, y + .8, z - .02, { sx: .45, sy: 1.15, sz: .95, lump: .06, col: sc, seed: 13 + sd }); pb(.05, .05, .02, '#3a362f', sd * .08, 1.24, .2); });
          ball(bag, .1, 1, x + .16, y + .48, z + .2, { sx: 1.4, sy: .5, lump: .3, col: mc, seed: 15 });
          ball(bag, .08, 1, x - .12, y + 1.36, z, { sx: 1.3, sy: .45, lump: .3, col: mc, seed: 16 });
          break;
        }
        case 'fountain': part(new T3.CylinderGeometry(.48, .54, .26, 16).translate(0, .13, 0), topSide('#e3eaee', '#b8c4cc')); part(new T3.CylinderGeometry(.4, .4, .05, 16), '#59c9ee', 0, .26); part(new T3.CylinderGeometry(.06, .09, .6, 8).translate(0, .3, 0), '#cfd8dc', 0, .2); part(new T3.SphereGeometry(.1, 8, 6), '#e3eaee', 0, .84); break;
        case 'boat': {
          // 小木船：船身两头翘、白色船舷、一根桅杆一面小帆
          const hull = new T3.CylinderGeometry(.34, .2, .3, 10, 1).scale(1.5, 1, .8).translate(0, .1, 0);
          part(hull, byY('#a9744a', '#c98e5c', -.05, .25)); part(new T3.TorusGeometry(.33, .035, 5, 14).rotateX(Math.PI / 2).scale(1.5, 1, .8), '#fffaf0', 0, .25);
          part(new T3.CylinderGeometry(.022, .028, 1.05, 5).translate(0, .52, 0), '#6d4121', -.05, .2);
          const sc = C('#fffdf5'), sc2 = C('#ffe9c9');
          tri(bag, [x - .03, y + 1.2, z], [x - .03, y + .42, z], [x + .5, y + .46, z], sc, sc2, sc); tri(bag, [x - .03, y + 1.2, z], [x + .5, y + .46, z], [x - .03, y + .42, z], sc, sc, sc2);
          pb(.18, .1, .05, '#e53935', -.14, 1.2);
          break;
        }
        default: pb(.6, .5, .6, topSide('#dfe6ea', '#b4c0c8')); part(new T3.OctahedronGeometry(.24, 0), '#ffc53d', 0, .8);
      }
    }

    // ---------- 树：每座岛的树不一样 ----------
    // 树冠是软的一团团（见上面的 ball / puff），边上是画出来的树叶；棕榈的叶子是一条条弯下来的带子，贴着剪开小叶的贴图。
    // lod 0：地图里的树（细）；1：地图边上和外面近处的（省）；2：远处山上的一团树冠（最省）。v：同一种树的第几种样子
    function treeKit(style, P, lod, v) {
      const S = Bag(), Cd = BagU(), dk = A.shade(P.tree, .7), md = P.tree, hi = P.treeHi;
      const lf = leafC(dk, md, hi), lfHi = leafC(md, hi, A.shade(hi, 1.1)), tipC = mixC(hi, '#f4f0a4', .45);
      const det = Math.max(0, Q.det - 1 - lod), ck = (tier === 'high' ? 1.8 : tier === 'mid' ? 1 : .6) * (lod === 2 ? .85 : 1) * (style === 'jungle' ? (tier === 'high' ? .72 : .6) : 1), sides = Math.max(4, (tier === 'high' ? 10 : tier === 'mid' ? 7 : 5) - lod * 2);
      const trunkC = style === 'dead' ? '#6b6258' : '#7a4a26';
      let bc = [0, 1.3, 0], top = 1.9, spin = false, tint = null, sd = v * 37 + lod * 11 + 1;
      const stem = (r0, r1, h, col, ln) => trunkTo(S, tier === 'low' ? [[0, -.06, 0], [(ln || 0) * .4, h * .5, 0], [ln || 0, h, 0]] : [[0, -.06, 0], [(ln || 0) * .25, h * .34, 0], [(ln || 0) * .65, h * .68, 0], [ln || 0, h, 0]], r0 * 1.22, r1, sides, C(A.shade(col || trunkC, .68)), C(col || trunkC));   // 省电档的树干两截
      const blob = (r, x, y, z, sx, sy, col, o) => { o = o || {}; puff(S, Cd, r, x, y, z, { sx: sx || 1, sy: sy || .9, sz: o.sz, col: col || lf, det: o.det == null ? det : Math.max(0, o.det), bc, tip: tipC, seed: sd++, ring: Math.round((o.ring == null ? 8 : o.ring) * ck), dab: Math.round((o.dab == null ? 3 : o.dab) * ck * 3.6), a0: o.a0, a1: o.a1, cs: o.cs, lump: o.lump, bk: o.bk, noBall: o.noBall }); };
      if (style === 'palm') {
        // 棕榈：弯弯的树干一圈一圈的，顶上一蓬往四周垂下来的大叶子，叶心一小团，底下挂着几个椰子
        const Ht = 2.2, lean = .3 + v * .12, segs = lod === 2 ? 3 : lod ? 4 : (tier === 'high' ? 9 : 6), pt = t => [lean * t * t + Math.sin(t * 3.3) * .05, Ht * t - .05, 0];
        trunkTo(S, Array.from({ length: segs + 1 }, (_, k) => pt(k / segs)), .16, .085, sides, C('#a57b4b'), C('#bb8f5c'), true);
        const tp = pt(1), nF = lod === 2 ? 7 : lod ? 9 : (tier === 'high' ? 15 : 11), fs = lod === 2 ? 2 : lod ? 3 : (tier === 'high' ? 7 : 5), cA = mixC(md, hi, .45), cB = mixC(md, dk, .3), cT = mixC(hi, '#f1e88a', .45);
        bc = [tp[0], tp[1] - .35, 0];
        for (let k = 0; k < nF; k++) {
          const j = hash2(k, 77 + v * 5), a = k / nF * 6.2832 + .3 + v + (j - .5) * .25, inner = k % 3 === 2;
          frond(Cd, [tp[0], tp[1] + (inner ? .1 : .02), 0], a, (inner ? 1.05 : 1.4) + j * .22, inner ? .5 : .24 + j * .2, inner ? .35 : .64 + j * .3, inner ? .5 : .66, fs, bc, cA, cB, cT, lod ? 0 : .2);
        }
        ball(S, .15, Math.min(det, 1), tp[0], tp[1] + .02, 0, { col: lfHi, sy: .8 });
        if (!lod) [[.11, -.1, .1], [-.09, -.13, -.05], [.02, -.15, -.11]].forEach(([px, py, pz], k) => ball(S, .085, Math.max(0, Q.det - 2), tp[0] + px, tp[1] + py, pz, { col: leafC('#4d3220', '#6d4c2f', '#8a6540'), seed: k }));
        top = 2.6; spin = true;
      } else if (style === 'pine' || style === 'snowpine') {
        const snow = style === 'snowpine', seg = lod ? 8 : (tier === 'high' ? 18 : 10);
        stem(.12, .08, .5);
        bc = [0, .9, 0];
        [[.62, .7, .42], [.5, .62, .86], [.36, .56, 1.28]].forEach(([r, h, y], k) => {
          put(S, new T3.ConeGeometry(r, h, seg).translate(0, y + h / 2, 0), byY(k ? md : dk, hi, y, y + h * 1.2));
          if (snow) put(S, new T3.ConeGeometry(r * .66, h * .5, seg).translate(0, y + h * .76, 0), '#f6fbfd');
          // 每一层的裙边垂下来一圈枝梢
          blob(r * .82, 0, y + .08, 0, 1, .34, snow && k === 2 ? leafC('#dfeaf0', '#f4f9fb', '#ffffff') : lf, { noBall: true, ring: lod === 2 ? 4 : 7, dab: 0, a0: Math.PI * .98, a1: Math.PI * 2.02, cs: .62 });
        });
        top = 2.0;
      } else if (style === 'cypress') {
        stem(.1, .07, .4);
        bc = [0, 1.1, 0];
        blob(.34, 0, 1.15, 0, 1, 2.5, lf, { ring: 10, dab: 4, a0: -1.25, a1: Math.PI + 1.25, cs: .7 }); if (!lod) blob(.24, .06, 1.6, .08, 1, 1.9, lfHi, { ring: 5, dab: 2, a0: 0, a1: Math.PI, cs: .7 });
        top = 2.1;
      } else if (style === 'pencil') {
        // 彩色铅笔树：六棱的笔杆（每一面是平的，棱角分明，一面亮一面暗）、一圈米白的商标纸、削出来的木头尖、和笔杆同色的笔芯；最下面一圈银色的金属箍、粉色的橡皮。
        // 笔杆和笔芯是纯白的顶点颜色，每棵按实例颜色染成自己的颜色（tintW）；木头、商标纸、金属、橡皮不染
        const hh = v ? 1.42 : 1.1, r = .2, b0 = .27, flat = g => { const q = g.toNonIndexed(); g.dispose(); q.deleteAttribute('normal'); q.computeVertexNormals(); return q; };
        put(S, flat(new T3.CylinderGeometry(r * 1.02, r * 1.02, .15, 6).translate(0, .075, 0)), '#f19cad');
        put(S, new T3.CylinderGeometry(r * 1.08, r * 1.08, .13, lod ? 6 : 12).translate(0, .205, 0), byY('#9aa0a8', '#e2e5ea', .14, .27));
        put(S, flat(new T3.CylinderGeometry(r, r, hh, 6).translate(0, b0 + hh / 2, 0)), '#ffffff');
        if (!lod) put(S, flat(new T3.CylinderGeometry(r * 1.012, r * 1.012, .13, 6).translate(0, b0 + hh * .7, 0)), '#f4ead6');
        put(S, flat(new T3.ConeGeometry(r, .42, 6).translate(0, b0 + hh + .21, 0)), '#f2cf9a');
        put(S, flat(new T3.ConeGeometry(r * .34, .145, 6).translate(0, b0 + hh + .277 + .072, 0)), '#ffffff');
        tint = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da']; top = b0 + hh + .42; spin = true;
      } else if (style === 'cbush') {
        // 蜡笔花丛（彩色文具岛）：一团矮矮的叶子，上面开满一个颜色的圆花（花是纯白的，按实例染色）
        bc = [0, -.1, 0];
        blob(.42, 0, .27, 0, 1.2, .74, lf, { ring: 9, dab: 3, a0: -.25, a1: Math.PI + .25, cs: .82 });
        const nb = lod || tier === 'low' ? 5 : tier === 'mid' ? 8 : 11, bd = tier === 'high' && !lod ? 1 : 0;
        for (let k = 0; k < nb; k++) { const a = hash2(k, 51 + v) * 6.2832, e = .2 + hash2(k, 52) * .9, rx = Math.cos(a) * Math.cos(e) * .47, rz = Math.abs(Math.sin(a)) * Math.cos(e) * .32 + .06, ry = .27 + Math.sin(e) * .3; ball(S, .075 + hash2(k, 53) * .03, bd, rx, ry, rz, { sy: .8, col: leafC('#e6e6e6', '#ffffff', '#ffffff'), seed: k }); }
        tint = ['#ff6f91', '#ffc94a', '#6fb8ff', '#7ed67a', '#c391ff', '#ff9a5a']; top = .75;
      } else if (style === 'lolli') {
        // 棒棒糖树：白色的小棍、扁扁的圆糖上一圈圈螺旋花纹（一道糖色一道白：糖色是纯白的顶点、按实例染色，白的那道是 #fdfdfd、不染）、外圈一道白边，棍上系一个同色的蝴蝶结
        const sg = lod ? 14 : 30;
        put(S, new T3.CylinderGeometry(.045, .05, 1.06, 8).translate(0, .53, 0), '#fdfdfd');
        const W1 = C('#ffffff'), W2 = C('#fdfdfd');
        put(S, new T3.SphereGeometry(.44, sg, Math.round(sg * .62)).scale(1, 1, .42).translate(0, 1.36, 0), (out, nx, ny, nz, px, py) => { const dy = py - 1.36, a = Math.atan2(dy, px), rr = Math.hypot(px, dy); out.copy(fract2(a / 6.2832 * 2 + rr * 4.2) < .55 || rr > .41 ? (rr > .41 ? W2 : W1) : W2); });
        if (!lod) put(S, new T3.TorusGeometry(.43, .03, 6, sg).scale(1, 1, 1).translate(0, 1.36, 0), '#fdfdfd');
        if (!lod) [-1, 1].forEach(sd => { tri(S, [0, .95, .06], [sd * .17, 1.03, .07], [sd * .15, .87, .07], W1); tri(S, [0, .95, .06], [sd * .15, .87, .07], [sd * .17, 1.03, .07], W1); });
        tint = ['#ff80ab', '#ffd54f', '#80deea', '#b39ddb', '#a5d6a7', '#ffab91']; top = 1.85;
      } else if (style === 'jungle' && lod < 2) {   // 最省的那一档（远处、山上）落到下面「一团树冠」那种
        stem(.17, .1, 1.2, '#5d4128');
        bc = [0, 1.0, 0];
        const lite = tier !== 'high';   // 省电档：只留中间、上面两团（两边那两团并进中间那团）
        blob(lite ? .86 : .74, 0, 1.38, 0, lite ? 1.4 : 1.25, .52, lf, { ring: 10, dab: 4 }); if (!lite) { blob(.5, -.5, 1.2, .1, 1.1, .5, lf, { ring: 6, dab: 2, a0: 1.2, a1: Math.PI + .9 }); blob(.5, .52, 1.24, -.08, 1.1, .5, lf, { ring: 6, dab: 2, a0: -.9, a1: 1.9 }); } blob(.48, -.08, 1.68, .04, 1.2, .5, lfHi, { ring: 7, dab: 3, a0: -.1, a1: Math.PI + .1 }); if (!lod && !lite) blob(.36, .12, 1.22, .5, 1, .5, lf, { ring: 4, dab: 2 });
        // 树冠底下垂着几根藤（一条条往下挂的叶子带），树根往四周拱出几道板根
        if (lod < 2 && tier !== 'low') { const vc = mixC(md, dk, .2), vt = mixC(hi, '#cfe88a', .3); for (let k = 0; k < (lod ? 3 : 5); k++) { const a = k * 2.1 + v * .9, rr = .38 + hash2(k, 61 + v) * .3; frond(Cd, [Math.cos(a) * rr, 1.12, Math.sin(a) * rr * .8], a + 1.4, .3, 0, .9 + hash2(k, 62) * .4, .16, lod ? 2 : 4, bc, vc, vc, vt, 0); } }
        if (!lod && tier !== 'low') for (let k = 0; k < 4; k++) { const a = k * 1.57 + .4 + v; put(S, new T3.ConeGeometry(.07, .5, 4).rotateZ(Math.PI / 2 - .5).translate(.2, .12, 0).rotateY(-a), '#5d4128'); }
        top = 2.0;
      } else if (style === 'dead' && lod < 2) {
        // 雾里的老树（回忆岛）：歪着长的灰树干，往上分出几根弯弯的光枝子，枝头零星几团苔绿的叶子，枝子上垂着一缕缕灰绿的苔藓
        trunkTo(S, [[0, -.06, 0], [.08, .45, 0], [-.04, .85, .02], [.1, 1.2, 0]], .15, .07, sides, C(A.shade(trunkC, .7)), C(trunkC));
        const brs = [[-.9, .95, .55, .05], [.85, 1.05, .5, -.04], [-.35, 1.18, .42, .1], [.5, .7, .4, .08]];
        brs.forEach(([rz, by, ln, oz], k) => { if (lod && k > 1) return; put(S, new T3.CylinderGeometry(.022, .045, ln, 5).translate(0, ln / 2, 0).rotateZ(rz).translate(.02, by, oz), trunkC); });
        bc = [0, 1.15, 0];
        blob(.28, .42, 1.28, 0, 1, .8, lf, { ring: 5, dab: 1 }); blob(.24, -.4, 1.18, .05, 1, .8, lfHi, { ring: 5, dab: 1 }); if (!lod) blob(.2, .06, 1.5, -.05, 1, .8, lf, { ring: 4, dab: 1 });
        if (lod < 2) { const mc = mixC(md, '#c9cfb8', .45); [[-.38, 1.12, .06], [.4, 1.2, -.02], [.18, .98, .1], [-.12, 1.36, 0]].forEach(([mx, my, mz], k) => { if (lod && k > 1) return; frond(Cd, [mx, my, mz], k * 1.7 + v, .12, 0, .55 + hash2(k, 71) * .3, .14, lod ? 2 : 3, bc, mc, mc, mixC(mc, '#ffffff', .2), 0); }); }
        top = 1.75;
      } else if (style === 'fern') {
        // 丛林里的大叶子（动物岛的林下）：一丛从地里拱出来、往四周垂下去的大羽叶，中间一小团
        bc = [0, -.2, 0];
        const nF = lod || tier === 'low' ? 5 : tier === 'mid' ? 7 : 9, sgF = tier === 'low' ? 2 : tier === 'mid' ? 3 : 4, cA = mixC(md, hi, .3), cB = mixC(md, dk, .35), cT = mixC(hi, '#d8f08a', .35);
        for (let k = 0; k < nF; k++) { const j = hash2(k, 81 + v * 5), a = k / nF * 6.2832 + v * .7 + (j - .5) * .4; frond(Cd, [0, .06, 0], a, .72 + j * .3, .42 + j * .2, .55 + j * .2, .42, lod ? Math.min(3, sgF) : sgF, bc, cA, cB, cT, lod || tier === 'low' ? 0 : .25); }
        ball(S, .14, 1, 0, .1, 0, { col: lf, sy: .7 });
        top = .8;
      } else if (style === 'bush') {
        // 矮灌木（树群之间的空当、路边）：两团贴着地的叶子
        bc = [0, -.1, 0];
        blob(.42, 0, .27, 0, 1.2, .74, lf, { ring: 9, dab: 3, a0: -.25, a1: Math.PI + .25, cs: .82 });
        blob(.3, v ? -.36 : .36, .22, .1, 1.05, .78, lfHi, { ring: 5, dab: 2, a0: -.1, a1: Math.PI + .1, cs: .82, det: det - 1 });
        top = .75;
      } else if (lod === 2) {
        // 远处山上的林子：一团压扁的大树冠，顶上一排树叶
        bc = [0, -.5, 0];
        blob(.95, 0, .6, 0, 1.3, .72, lf, { ring: 8, dab: 0, a0: .12, a1: Math.PI - .12, cs: .9, det: Math.max(0, Q.det - 2) });
        top = 1.5;
      } else {
        // 圆树（round / autumn / orchard）：三团叶子，果树挂果子
        const up = lod ? 0 : .3, ln = v ? -.1 : .1, hiC = P.snow ? leafC('#dfeaf0', '#f4f9fb', '#ffffff') : lfHi;
        stem(.15, .09, lod ? .8 : 1.1, null, ln);
        bc = [ln, 1.2 + up, 0];
        if (lod) { blob(.74, ln, 1.2, 0, 1.06, .92, lf, { ring: 9, dab: 2 }); blob(.48, ln + (v ? -.26 : .26), 1.66, 0, 1, .9, hiC, { ring: 5, dab: 1, a0: -.1, a1: Math.PI + .1, det: det - 1 }); }
        else {
          blob(.68, ln, 1.14 + up, 0, 1.06, .92, lf, { ring: 10, dab: 4 });
          blob(.5, ln + (v ? .44 : -.44), 1.04 + up, .12, 1, .9, lf, { ring: 6, dab: 2, a0: v ? -1.1 : 1.0, a1: v ? 2.1 : Math.PI + 1.1 });
          blob(.48, ln + (v ? -.28 : .28), 1.5 + up, 0, 1, .9, hiC, { ring: 7, dab: 3, a0: -.25, a1: Math.PI + .25 });
          if (style === 'orchard') [[.4, .9, .42, '#ff7043'], [-.36, 1.05, .4, '#ffca28'], [.1, .8, .62, '#e53935'], [-.12, 1.3, .52, '#ff7043']].forEach(([x, y, z, c]) => ball(S, .085, 1, ln + x, y + up, z, { col: leafC(A.shade(c, .8), c, A.shade(c, 1.15)) }));
        }
        top = 2.0 + up;
      }
      return { geo: weld(bake(S)), cards: Cd.p.length ? weld(bakeU(Cd)) : null, top, spin, tint };
    }
    function buildTrees() {
      const L = LAND, P = PAL, style = THEME.tree || 'round', W = m.W, H = m.H, palm = style === 'palm', lolli = style === 'lolli';
      // 名单：main0* 地图里的树（细）；main1 外面近处的（省）；main2 外面远处平地上的；side0* / side1 棕榈岛上混着种的阔叶树；mound 山上的一团团树冠；bush* 树群之间的矮灌木
      const lists = {};
      const push = (key, x, z, s, r, spin, edge) => (lists[key] || (lists[key] = [])).push({ x, y: L.ground(x, z) - .04, z, s, ry: spin ? r * 6.2832 : (r - .5) * .5, r, edge });
      const woody = (x, y) => { const c = tIn(x, y); return c === '' || c === '#' || c === 'T'; };
      const grp = (x, y) => vnoise(x * .37 + 13.7, y * .37 + 5.1);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x];
        if (c !== '#' && c !== 'T') continue;
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9), edge = c === '#';
        const px = x + .5 + (r - .5) * (edge ? .5 : .24), pz = y + .5 + (r2 - .5) * (edge ? .5 : .24);
        if (L.samp(L.sd, px, pz) < .25) continue;
        const nb = (woody(x + 1, y) ? 1 : 0) + (woody(x - 1, y) ? 1 : 0) + (woody(x, y + 1) ? 1 : 0) + (woody(x, y - 1) ? 1 : 0), mass = edge || nb >= 2;
        // 成片的树（地图边上那几排、大树丛）不是每格一棵：一群一群地种，群和群之间是矮灌木——还是过不去，但能从上面、从中间看到后面的山和海
        if (mass && grp(x, y) < .44) { push('busha', px, pz, .85 + r2 * .5, r); continue; }
        const vv = r > .5 ? 'a' : 'b', sc = (edge ? 1.12 : 1) * (.86 + r * .3);
        // 棕榈岛：成片的树里一半是阔叶树；生日派对岛：成片的树是一团团的棉花糖树（side 那几种），单独的、路边的才是棒棒糖
        const sideK = palm ? mass && r2 > .5 : lolli ? mass : style === 'jungle' ? mass && r2 > .66 : false;   // 丛林里三棵里有一棵是棕榈
        if (sideK) push('side0' + vv, px, pz, sc, r2, false, edge);
        else push(palm ? 'main0' : 'main0' + vv, px, pz, sc, r2, palm, edge);
        { const it = lists[sideK ? 'side0' + vv : palm ? 'main0' : 'main0' + vv]; it[it.length - 1].deep = nb === 4 && woody(x + 1, y + 1) && woody(x - 1, y - 1) && woody(x + 1, y - 1) && woody(x - 1, y + 1); }   // 四周八格都是树：在树林深处，近看也只看得到树冠
      }
      // 一大片岩壁的顶上（四周都是岩壁的格子）零零星星长着灌木；雪岛上是小雪松；光秃秃的石头山（沙丘、火山）上不长
      if (GND.cap !== 'rock') {
        const cl = (x, y) => { const c = tIn(x, y); return c === 'R' || c === 'K'; };
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          if (!cl(x, y) || !cl(x + 1, y) || !cl(x - 1, y) || !cl(x, y + 1) || !cl(x, y - 1)) continue;
          const r = rnd(x, y, 33); if (r > .2) continue;
          const px = x + .5 + (rnd(x, y, 34) - .5) * .4, pz = y + .5 + (rnd(y, x, 34) - .5) * .4, snowy = GND.cap === 'snow';
          push(snowy ? 'main1' : 'busha', px, pz, snowy ? .55 + r * 1.2 : .7 + r * 2, rnd(x, y, 35), false);
          const it = lists[snowy ? 'main1' : 'busha']; it[it.length - 1].y = cliffTop[y * W + x] - .06;
        }
      }
      const o = {}, ring = Q.ring, far = Math.min(Q.skirt - 4, ring + (tier === 'low' ? 4 : 18));
      for (let y = -far; y < H + far; y++) for (let x = -far; x < W + far; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) continue;
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9), px = x + .5 + (r - .5) * .7, pz = y + .5 + (r2 - .5) * .7;
        L.outer(px, pz, o);
        const h = L.ground(px, pz);
        if (o.landK < .7 || h < L.SEA + .3 || o.dOut > far) continue;
        if (pz > H + 2.5) continue;                                   // 地图南边外面是镜头待的地方（也看不到），不种
        if (o.val > .45) continue;                                    // 出口外面的山谷里不种树，看得到路通出去
        const g2 = vnoise(x * .21 + 3.3, y * .21 + 8.8), q = rnd(x, y, 13);
        if (o.dOut <= ring) {
          // 近处：山上是一团团树冠连成的林子，夹着几棵看得出样子的树；平地上一小群一小群的，中间留空
          if (o.hill > .5) { if (q < .36) push('mound', px, pz, 1.2 + r * .9, r2); else if (q < .6) push(lolli || palm && r2 > .4 ? 'side1' : 'main1', px, pz, .95 + r * .4, r2, palm && r2 <= .4); }
          else if (g2 > .5) { if (q < .62) push(lolli || palm && r2 > .72 ? 'side1' : 'main1', px, pz, .95 + r * .4, r2, palm && r2 <= .72); }
          else if (g2 > .36 && q < .14) push('busha', px, pz, .9 + r2 * .6, r);
        } else if (o.hill > .5 ? q < .3 : g2 > .58 && q < .22) push(o.hill > .5 || lolli ? 'mound' : 'main2', px, pz, o.hill > .5 ? 1.7 + r * 1.3 : 1.15 + r * .5, r2, palm && o.hill <= .5);
      }
      const kitOf = key => {
        switch (key) {
          case 'main0': case 'main0a': return treeKit(style, P, 0, 0);
          case 'main0b': return treeKit(style, m.theme === 'school' ? Object.assign({}, P, { tree: '#e48aae', treeHi: '#ffd4e4' }) : P, 0, 1);   // 校园岛：一半的树开着粉色的花
          case 'main1': return treeKit(style, P, 1, 0);
          case 'main1b': return treeKit(style, m.theme === 'school' ? Object.assign({}, P, { tree: '#e48aae', treeHi: '#ffd4e4' }) : P, 1, 1);
          case 'main2': return treeKit(style, P, 2, 0);
          case 'side0a': return treeKit(style === 'jungle' ? 'palm' : 'round', P, 0, 0);
          case 'side0b': return treeKit(style === 'jungle' ? 'palm' : 'round', P, 0, 1);
          case 'side1': return treeKit(style === 'jungle' ? 'palm' : 'round', P, 1, 0);
          case 'side2': return treeKit(style === 'jungle' ? 'palm' : 'round', P, 2, 0);
          case 'mound': return treeKit(palm || lolli ? 'round' : style, P, 2, 1);
          case 'busha': return treeKit(style === 'pencil' ? 'cbush' : style === 'jungle' ? 'fern' : 'bush', P, 0, 0);
          default: return treeKit(style === 'pencil' ? 'cbush' : style === 'jungle' ? 'fern' : 'bush', P, 0, 1);
        }
      };
      const kits = {}, kit = key => kits[key] || (kits[key] = kitOf(key)), nTri = key => triCount(kit(key).geo) + triCount(kit(key).cards);
      const used = new Set(), COARSE = { main0: 'main1', main0a: 'main1', main0b: 'main1b', side0a: 'side1', side0b: 'side1', main1: 'main2', main1b: 'main2', side1: 'side2' };   // 细的树换成省的时用哪一种
      INFO.tree = style;
      const sum = keys => keys.reduce((a, k) => a + (lists[k] ? lists[k].length * nTri(k) : 0), 0);
      const IN = ['main0', 'main0a', 'main0b', 'side0a', 'side0b'], OUT = ['main1', 'main2', 'side1', 'mound'];
      // 三角形预算：地图里的树太多，就把最靠边的那一圈（#）换成省的那种；还多，外面的按比例抽掉一些
      // 还多：树林深处（四周八格都是树）的也换成省的——走在路上看得到的是林子边上那一排，深处的只露出树冠
      const demote = test => IN.forEach(k => { if (!lists[k]) return; const to = k.startsWith('side') ? 'side1' : 'main1', keepL = []; lists[k].forEach(p => { if (test(p)) (lists[to] || (lists[to] = [])).push(p); else keepL.push(p); }); lists[k] = keepL; });
      if (sum(IN) > TREE_TRIS * .7) demote(p => p.edge);
      if (sum(IN) > TREE_TRIS * .7) demote(p => p.deep);
      const all = () => sum(Object.keys(lists));
      if (all() > TREE_TRIS) {
        const outer = sum(OUT), k = Math.max(.08, (TREE_TRIS - (all() - outer)) / Math.max(1, outer));
        OUT.forEach(key => { if (lists[key]) lists[key] = lists[key].filter(p => p.edge || rnd(p.x | 0, p.z | 0, 19) < k); });
      }
      // 树不多（比如你好岛的棕榈）就不分条、不换省的（draw call 少）；多了（铅笔林、丛林、秋天的林子……）才分
      const heavy = all() > TREE_TRIS * (tier === 'high' ? .9 : .5);
      INFO.treeTris = all(); INFO.heavy = heavy;
      Object.keys(lists).forEach(key => {
        const list = lists[key];
        if (!list.length) return;
        const kt = kit(key), cols = kt.tint, far2 = key === 'mound' || key === 'main2';
        // 每棵的颜色：染色的树（铅笔、棒棒糖、蜡笔花丛）挑一种颜色；秋天的树各有各的秋色（金黄、橙、红、还有点绿的）；别的只是深浅不一
        list.forEach(p => { const k = .88 + p.r * .24; p.c = cols ? C(cols[Math.floor(p.r * cols.length) % cols.length]) : new T3.Color(k, k * (.97 + rnd(p.x | 0, p.z | 0, 4) * .06), k * .96); if (!cols && (style === 'autumn' || lolli && (key.startsWith('side') || key === 'mound'))) { const tb = lolli ? PASTEL : AUTUMN, a = tb[Math.floor(rnd(p.x | 0, p.z | 0, 8) * tb.length)]; p.c.r *= a[0]; p.c.g *= a[1]; p.c.b *= a[2]; } });
        // 树多的那几种按南北分成几条（每条自己一个网格）：镜头在主角南边朝北看，身后那几条整条不画。
        // 地图里的树（细的那种）每条另外备一份省的：离主角往北远了就换成省的（treeBands，draw 里按远近换），近处才是细的。分得太碎 draw call 就多了，所以只按南北分
        const coarseKey = COARSE[key] && (tier === 'low' ? (key.startsWith('side') ? 'side2' : 'main2') : COARSE[key]) || null, lod = heavy && coarseKey && list.length > 30;   // 省电档：远了直接换成最省的那种（一团树冠）
        const groups = {}, band = lod ? (tier === 'low' ? 16 : 10) : heavy && list.length > 120 && !far2 ? 12 : 1e9;
        list.forEach(p => { const k = Math.floor(p.z / band); (groups[k] || (groups[k] = [])).push(p); });
        const white = g => g.map(p => Object.assign({}, p, { c: new T3.Color(1, 1, 1) }));
        Object.keys(groups).forEach(bk => {
          const g = groups[bk], fine = [inst(kt.geo, cols ? tintTreeMat : treeMat, g, !far2)];
          used.add(key);
          if (kt.cards) fine.push(inst(kt.cards, leafMat, cols ? white(g) : g, !far2 && tier === 'high' || key === 'main0'));
          if (!lod) return;
          const ck = kit(coarseKey), coarse = [inst(ck.geo, ck.tint ? tintTreeMat : treeMat, g, true)];
          used.add(coarseKey);
          if (ck.cards) coarse.push(inst(ck.cards, leafMat, ck.tint ? white(g) : g, tier === 'high'));
          coarse.forEach(o => { if (o) o.visible = false; });
          treeBands.push({ z0: +bk * band, z1: (+bk + 1) * band, fine: fine.filter(Boolean), coarse: coarse.filter(Boolean), near: true });
        });
      });
      Object.keys(kits).forEach(k => { if (!used.has(k)) { kits[k].geo.dispose(); if (kits[k].cards) kits[k].cards.dispose(); } });
      INFO.trees = Object.fromEntries(Object.keys(lists).filter(k => lists[k].length).map(k => [k, lists[k].length]));
      // 省电档没有影子图：树脚下垫一块圆影子
      if (!Q.shadow) inst(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, IN.reduce((a, k) => a.concat(lists[k] || []), []).map(p => ({ x: p.x + .12, y: p.y + .07, z: p.z - .1, s: 1.7 * p.s })), false);
    }

    // ---------- 草 ----------
    // 草坪是一根根细细的草叶（每根两三截，到顶收成尖），一簇几根；根的颜色就是脚下地面的颜色，只有草尖浅一点、黄一点（都在着色器里算，见 GRASS_V）。
    // 草丛（会遇到怪兽的那种）高得多、颜色深、顶上带草穗、摆得更厉害，一眼分得出。草地里零星有三叶草和小花。
    // 离主角近的地方是满的，越远越稀，最后只剩地面上画的草叶笔触——没有一条看得见的分界线
    function bladeKit(kind, coarse) {   // kind：0 草坪；1 草坪 + 三叶草和小花；2 草丛。coarse：远处用的省的那种（根数少、每根宽一点，盖住的地方差不多）
      const p = [], b = [], tallK = kind === 2, n = coarse ? (tallK ? 5 : 3) : tallK ? 10 : (tier === 'high' ? 7 : 5), seg3 = tier === 'high' && !coarse, wK = coarse ? (tallK ? 1.7 : 2.1) : 1;
      const T3v = (A0, ta, B0, tb, C0, tc, r, kd) => { p.push(A0[0], A0[1], A0[2], B0[0], B0[1], B0[2], C0[0], C0[1], C0[2]); b.push(ta, r, kd, tb, r, kd, tc, r, kd); };
      const ts = seg3 ? [0, .38, .72, 1] : [0, .55, 1], ws = seg3 ? [1, .84, .52, 0] : [1, .68, 0];
      for (let i = 0; i < n; i++) {
        const sd = kind * 100 + 201, r1 = hash2(i, sd), r2 = hash2(i, sd + 1), r3 = hash2(i, sd + 2);
        const spread = tallK ? .2 : .16, bx = (r1 * 2 - 1) * spread, bz = (r2 * 2 - 1) * spread;
        const h = tallK ? .4 + r3 * .25 : .13 + r3 * .18, w = (tallK ? .019 + r1 * .011 : .011 + r2 * .008) * wK, yaw = (r3 - .5) * 1.5, cx = Math.cos(yaw), sx = Math.sin(yaw), lean = (r1 - .5) * h * .6, lz = (r2 - .35) * h * .32;
        const V = (ox, t, wk) => [bx + cx * ox * wk + lean * t * t, h * t, bz + sx * ox * wk + lz * t * t], kd = tallK ? 1 : 0;
        for (let q = 0; q < ts.length - 1; q++) {
          const a = V(-w, ts[q], ws[q]), c = V(w, ts[q], ws[q]);
          if (q === ts.length - 2) T3v(a, ts[q], c, ts[q], V(0, 1, 0), 1, r3, kd);
          else { const d = V(-w, ts[q + 1], ws[q + 1]), e = V(w, ts[q + 1], ws[q + 1]); T3v(a, ts[q], c, ts[q], e, ts[q + 1], r3, kd); T3v(a, ts[q], e, ts[q + 1], d, ts[q + 1], r3, kd); }
        }
        // 草穗：草尖上一颗小小的菱形
        if (tallK && (i === 1 || i === 6 && !coarse)) { const tp = V(0, 1, 0), s2 = .017, hh = .13; T3v([tp[0] - cx * s2, tp[1] + hh * .4, tp[2] - sx * s2], 1, [tp[0] + cx * s2, tp[1] + hh * .4, tp[2] + sx * s2], 1, [tp[0], tp[1] + hh, tp[2]], 1, r3, 2); T3v([tp[0] - cx * s2, tp[1] + hh * .4, tp[2] - sx * s2], 1, [tp[0], tp[1] - .02, tp[2]], 1, [tp[0] + cx * s2, tp[1] + hh * .4, tp[2] + sx * s2], 1, r3, 2); }
      }
      if (kind === 1) {
        // 三叶草：三片圆圆的小叶子平着摊开；小花：一根细茎，顶上一圈花瓣朝着镜头仰着，中间一点花心
        for (let i = 0; i < 4; i++) {
          const cx = (hash2(i, 311) * 2 - 1) * .15, cz = (hash2(i, 312) * 2 - 1) * .15, cy = .035 + hash2(i, 313) * .05, R = .034 + hash2(i, 314) * .016, a0 = hash2(i, 315) * 6.28, sh = hash2(i, 316);
          for (let j = 0; j < 3; j++) { const a = a0 + j * 2.0944, P0 = [cx, cy, cz], tip = [cx + Math.cos(a) * R, cy + .012, cz + Math.sin(a) * R], l = [cx + Math.cos(a - .62) * R * .74, cy + .008, cz + Math.sin(a - .62) * R * .74], r = [cx + Math.cos(a + .62) * R * .74, cy + .008, cz + Math.sin(a + .62) * R * .74]; T3v(P0, .2, l, .25, tip, .28, sh, 3); T3v(P0, .2, tip, .28, r, .25, sh, 3); }
        }
        for (let i = 0; i < 1; i++) {
          const fx = (hash2(i, 321) * 2 - 1) * .13, fz = (hash2(i, 322) * 2 - 1) * .13, fh = .17 + hash2(i, 323) * .1, R = .03 + hash2(i, 324) * .008, C0 = [fx, fh, fz + .004];
          T3v([fx - .005, 0, fz], 0, [fx + .005, 0, fz], 0, [fx, fh, fz], .9, .5, 0);
          const pt = (a, rr) => [fx + Math.cos(a) * rr, fh + Math.sin(a) * rr * .62, fz + .004 - Math.sin(a) * rr * .55 + .006];
          for (let j = 0; j < 6; j++) { const a = j / 6 * 6.2832; T3v(C0, .9, pt(a - .3, R * .72), .9, pt(a, R), .9, .5, 4); T3v(C0, .9, pt(a, R), .9, pt(a + .3, R * .72), .9, .5, 4); }
          for (let j = 0; j < 5; j++) { const a = j / 5 * 6.2832, a2 = (j + 1) / 5 * 6.2832, q = (aa) => { const v = pt(aa, R * .3); return [v[0], v[1] + .003, v[2] + .006]; }; T3v([C0[0], C0[1] + .003, C0[2] + .008], .9, q(a), .9, q(a2), .9, .5, 5); }
        }
      }
      const g = new T3.BufferGeometry(), nrm = new Float32Array(p.length);
      for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;   // 法线一律朝上：草叶和地面受一样的光，一整片草地是柔和的色块，不会一片片忽明忽暗
      g.setAttribute('position', new T3.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new T3.BufferAttribute(nrm, 3)); g.setAttribute('aB', new T3.Float32BufferAttribute(b, 3));
      return weld(g);
    }
    const grassChunks = [], treeBands = [];   // treeBands：地图里的树按南北分的一条条，每条有细的和省的两份（draw 里按远近换）
    function buildGrass() {
      const L = LAND, P = PAL, W = m.W, H = m.H, CH = tier === 'high' ? 8 : 12, lists = {}, flowers = [[], [], [], []];   // 一块多大：精美档分得细（按远近换零件更准），另外两档分得粗（少几次绘制）
      const nT = Math.max(2, Math.round(11 * Q.grass)), nL = Math.max(3, Math.round(32 * Q.lawn * (P.snow ? .35 : 1) * (tier === 'high' && INFO.heavy ? .85 : 1)));   // 雪地里的草大多埋在雪下面；树多的图（精美档）草坪稀一点
      const listsX = {};   // 带三叶草和小花的那些簇很稀，细的那一种按 16×16 格一块（少几次绘制）
      const into = (kind, x, y, it) => { const k = Math.floor(x / CH) + ',' + Math.floor(y / CH); (lists[k] || (lists[k] = [[], [], []]))[kind].push(it); if (kind === 1) { const k2 = Math.floor(x / CH / 2) + ',' + Math.floor(y / CH / 2); (listsX[k2] || (listsX[k2] = [])).push(it); } };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x];
        if (c === ',') {
          const g = Math.ceil(Math.sqrt(nT));
          for (let k = 0; k < nT; k++) {
            const px = x + ((k % g) + .5) / g + (rnd(x * 3 + k, y, 41) - .5) * .8 / g, pz = y + (Math.floor(k / g) + .5) / g + (rnd(x, y * 3 + k, 42) - .5) * .8 / g, r = rnd(x + k, y - k, 43);
            into(2, x, y, { x: px, y: L.ground(px, pz), z: pz, s: .9 + r * .35, sy: .85 + rnd(k, x + y, 44) * .45, ry: (r - .5) * 2.6, c: new T3.Color(rnd(x * 7 + k, y * 5 + 1, 45), rnd(k, x * 3 + y, 46), rnd(x + 2 * k, y + 9, 47)) });
          }
        } else if ('.FBofT'.includes(c) && !(c === 'T' && m.theme === 'city') && !L.isWater(x, y) && !(m.paintAs && c === 'o' && m.paintAs[x + ',' + y] && m.paintAs[x + ',' + y] !== '.')) {
          const n = c === 'T' ? Math.ceil(nL / 2) : nL, g = Math.ceil(Math.sqrt(n)), patch = fbm(x * .19 + 5, y * .19 + 2);
          for (let k = 0; k < n; k++) {
            const px = x + ((k % g) + .5) / g + (rnd(x * 5 + k, y, 51) - .5) * 1.1 / g, pz = y + (Math.floor(k / g) + .5) / g + (rnd(x, y * 5 + k, 52) - .5) * 1.1 / g, r = rnd(x + k * 3, y + k, 53);
            if (L.samp(L.F.dWalk, px, pz) > .5 || L.samp(L.sd, px, pz) < .2) continue;
            const q = rnd(x * 3 + k, y * 3 - k, 56), extra = (patch > .56 && q < .15) || q < .012;   // 三叶草和小花一片一片地长，别处零星几簇
            into(extra ? 1 : 0, x, y, { x: px, y: L.ground(px, pz) - .012, z: pz, s: .9 + r * .35, sy: .72 + rnd(k, x - y, 54) * .62, ry: (r - .5) * 1.2, c: new T3.Color(rnd(x * 7 + k, y * 5 + 2, 57), rnd(k + x, y * 3, 55), rnd(x + 2 * k, y + 5, 58)) });
          }
          // 花：F 格是一小片花；草地上零星几朵，成片的地方多一点
          const nF = c === 'F' ? 7 : (fbm(x * .23 + 3, y * .23 + 8) > .62 && rnd(x, y, 61) < .55 ? 2 : rnd(x, y, 62) < .06 ? 1 : 0);
          for (let k = 0; k < nF && c !== 'T'; k++) {
            const px = x + .12 + rnd(x * 7 + k, y, 63) * .76, pz = y + .12 + rnd(x, y * 7 + k, 64) * .76, r = rnd(x + k, y + k * 5, 65);
            flowers[Math.floor(rnd(x + k * 2, y, 66) * 4)].push({ x: px, y: L.ground(px, pz), z: pz, s: .8 + r * .5, ry: (r - .5) * .8 });
          }
        }
      }
      // 每块：近处用细的零件（草坪、草丛各一个网格，带三叶草小花的另算），远处换成省的（草坪一个、草丛一个）。
      // 每个网格里的簇按「能留到多远」从大到小排好：远了只画前面那些（着色器里用同一个数把它们缩回地里）
      const kits = {}, kit = (kind, coarse) => kits[kind + (coarse ? 'c' : '')] || (kits[kind + (coarse ? 'c' : '')] = bladeKit(kind, coarse)), fineOK = GRASS_NEAR > 0;
      let any = false;
      const part = (parts, kind, coarse, list) => { if (!list.length) return; const l2 = list.slice().sort((a, b) => b.c.r - a.c.r); parts.push({ im: inst(kit(kind, coarse), grassMat, l2, false), rs: Float32Array.from(l2, q => q.c.r), n: l2.length, tall: kind === 2, fine: !coarse }); };
      Object.keys(lists).forEach(key => {
        const [cx, cz] = key.split(',').map(Number), ls = lists[key], parts = [];
        if (fineOK) { part(parts, 0, false, ls[0]); part(parts, 2, false, ls[2]); }
        part(parts, 0, true, ls[0].concat(ls[1])); part(parts, 2, true, ls[2]);
        if (ls[2].length) any = true;
        grassChunks.push({ x0: cx * CH, x1: cx * CH + CH, z0: cz * CH, z1: cz * CH + CH, parts, near: false });
      });
      if (fineOK) Object.keys(listsX).forEach(key => {
        const [cx, cz] = key.split(',').map(Number), parts = [];
        part(parts, 1, false, listsX[key]);
        grassChunks.push({ x0: cx * CH * 2, x1: cx * CH * 2 + CH * 2, z0: cz * CH * 2, z1: cz * CH * 2 + CH * 2, parts, near: false, extra: true });
      });
      // 四种颜色的小花：五片花瓣朝着镜头这边仰着，一根短短的茎
      [['#ffffff', '#ffd54f'], ['#ff7fa8', '#ffe082'], ['#ffd84a', '#ff8f3d'], ['#b79bff', '#fff59d']].forEach(([pc, cc], fi) => {
        if (!flowers[fi].length) return;
        const bag = Bag(), cp = C(pc), cq = C(A.shade(pc, .86)), ce = C(cc), cs = C(A.shade(P.blade, 1.1)), R = .1, hy = .36, tl = .72, np = tier === 'low' ? 5 : 10;
        tri(bag, [-.012, 0, 0], [.012, 0, 0], [0, hy, 0], cs);
        // 每片花瓣圆圆的（细的那两档每片分两小瓣）
        for (let k = 0; k < np; k++) {
          const st = 6.2832 / np, a0 = k * st, a1 = (k + .5) * st, a2 = (k + 1) * st, big = np === 5 || k % 2 === 0, pt = (a, r) => [Math.cos(a) * r, hy + Math.sin(a) * r * tl, Math.sin(a) * r * (1 - tl) + .01];
          if (np === 5) { tri(bag, [0, hy, .012], pt(a0, R * .55), pt(a1, R), ce, cq, cp); tri(bag, [0, hy, .012], pt(a1, R), pt(a2, R * .55), ce, cp, cq); }
          else { tri(bag, [0, hy, .012], pt(a0, big ? R * .52 : R * .97), pt(a1, R * .93), ce, big ? cq : cp, cp); tri(bag, [0, hy, .012], pt(a1, R * .93), pt(a2, big ? R * .97 : R * .52), ce, cp, big ? cp : cq); }
        }
        const g = bake(bag), nr = g.attributes.normal;
        for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
        inst(g, flowerMat, flowers[fi], false);
      });
      return any;
    }
    // 路边、沙滩上的小石子（很小，一脚就跨过去了，不会被当成挡路的东西）：远了缩没
    function buildPebbles() {
      if (tier === 'low') return;
      const L = LAND, P = PAL, W = m.W, H = m.H, list = [], rock = P.rock || '#a39b8b';
      const isPath = (x, y) => { const c = tIn(x, y); return c === '=' && !L.isPier(x, y) && !L.isWater(x, y); };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x], path = isPath(x, y), sand = c === 'S';
        if (!path && !sand) continue;
        const n = path ? (tier === 'high' ? 3 : 2) : rnd(x, y, 71) < .28 ? 1 : 0;
        for (let k = 0; k < n; k++) {
          // 小路上的石子靠边放（路中间是走出来的，干净）
          let px = x + rnd(x * 5 + k, y, 72), pz = y + rnd(x, y * 5 + k, 73);
          if (path) { const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isPath(x + dx, y + dy)); if (!side.length) continue; const [dx, dy] = side[Math.floor(rnd(x + k, y - k, 74) * side.length)]; if (dx) px = x + .5 + dx * (.3 + rnd(k, x, 75) * .22); else pz = y + .5 + dy * (.3 + rnd(k, y, 75) * .22); }
          const r = rnd(x + k * 3, y + k, 76), k2 = .82 + rnd(k, x + y, 77) * .3, sh = sand && rnd(x, y + k, 80) < .6 ? [[1.25, 1.2, 1.12], [1.3, 1.02, 1.0], [1.3, 1.1, .9]][Math.floor(rnd(x + k, y, 81) * 3)] : [k2, k2, k2 * (.94 + rnd(x, k, 79) * .1)];
          list.push({ x: px, y: L.ground(px, pz) + .004, z: pz, s: .016 + r * r * .034, sy: (.016 + r * r * .034) * (.5 + rnd(k, x - y, 78) * .3), ry: r * 6.28, c: new T3.Color(sh[0], sh[1], sh[2]) });
        }
      }
      if (!list.length) return;
      const bag = Bag(), lo = mixC(A.shade(rock, .82), '#8d8791', .3).getStyle(), hiC = mixC(A.shade(rock, 1.12), '#ffffff', .35).getStyle();
      ball(bag, 1, Math.max(1, Q.det - 2), 0, .55, 0, { lump: .16, col: leafC(lo, mixC(rock, '#d6cfc2', .5).getStyle(), hiC), seed: 5 });
      inst(weld(bake(bag)), pebbleMat, list, false);
    }
    const BOOKC = ['#c0504d', '#3f74b6', '#5f9e4a', '#e3a92f', '#7b5aa6', '#d0603a', '#2f8f8a'].map(h => C(h)), PAGEC = C('#efe6cf');   // 书山的书皮、书页
    const PASTEL = [[1, 1, 1], [.78, 1.3, 1.25], [1.08, 1.32, .8], [.95, 1.12, 1.35], [1.05, 1.18, 1.05]];   // 棉花糖树：粉、薄荷绿、奶黄、淡紫、桃色（乘在粉色的树冠上）
    const AUTUMN = [[1.12, 1.06, .7], [1, .78, .62], [1.05, .9, .78], [.92, 1.12, .72], [1.1, .7, .56], [1, 1, 1]];   // 秋天的树：金黄、红、橙、黄绿、深红、原色
    const TREE_TRIS = tier === 'high' ? 470000 : tier === 'mid' ? 110000 : 42000;

    // ---------- 房子：每座岛的风格不一样；休息站（青绿屋顶）、商店（琥珀色屋顶）哪座岛都一个样 ----------
    // 一栋房子 = 一个上了色的网格 + 一个贴画网格（门、窗、招牌、砖纹，都画在这张地图的一张大贴图里）。
    // 房子在主角南边（镜头和主角中间）、屋顶够得着视线时，整栋用网点慢慢淡出去，最后只剩地上一圈墙基（看得出这里有栋房子），影子也收掉（BLD 里记着范围，fadeBuildings 每帧算）
    const spinners = [], BLD = [];
    let atlas = null;
    function atlasCell(key, w, h, draw) {
      const a = atlas;
      if (a.cells[key]) return a.cells[key];
      if (a.x + w + 2 > a.cv.width) { a.x = 2; a.y += a.rowH + 2; a.rowH = 0; }
      if (a.y + h + 2 > a.cv.height) return a.cells[Object.keys(a.cells)[0]] || [0, 0, .01, .01];   // 放不下了（不该发生）：用第一块顶着
      const x = a.x, y = a.y;
      a.g.save(); a.g.translate(x, y); a.g.beginPath(); a.g.rect(0, 0, w, h); a.g.clip(); draw(a.g, w, h); a.g.restore();
      a.x += w + 2; a.rowH = Math.max(a.rowH, h);
      return (a.cells[key] = [x / a.cv.width, 1 - (y + h) / a.cv.height, (x + w) / a.cv.width, 1 - y / a.cv.height]);
    }
    const HCOL = ['#ffd1dc', '#c8e6ff', '#fff3b0', '#d4f5c9', '#e6d4ff', '#ffe0c2'];
    function buildBuildings() {
      const list = Object.values(m.buildings || {});
      if (!list.length) return;
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024;
      atlas = { cv, g: cv.getContext('2d'), x: 2, y: 2, rowH: 0, cells: {} };
      const tex = new T3.CanvasTexture(cv); tex.colorSpace = T3.SRGBColorSpace; tex.anisotropy = 4;
      own.push(tex);
      const house0 = THEME.house || 'med', P = PAL;
      list.forEach(b => {
        const L = b.L, gym = L === 'G', std = L === 'C' || L === 'M', home = L === 'H' || L === 'J', style = b.style || (std ? 'std' : house0);
        (INFO.houses || (INFO.houses = [])).push(style);
        const x0 = b.x0, x1 = b.x1 + 1, z0 = b.y0, z1 = b.y1 + 1, w = x1 - x0, cx = (x0 + x1) / 2;
        const front = z1 - .22, back = z0 + .28, d = front - back, cz = (front + back) / 2, hsh = rnd(b.x0, b.y0, 3);
        const y0 = Math.min(LAND.ground(x0 + .3, z1 - .1), LAND.ground(x1 - .3, z1 - .1), LAND.ground(cx, z1 - .1)) - .02;
        const bag = Bag(), dq = { p: [], u: [], n: [] };
        let fnd = null;
        const roofC = std || gym ? A.buildColor(L, m) : (P.roof || A.buildColor(L, m));
        let wallC = L === 'C' ? '#fff6ea' : L === 'M' ? '#f4f8ff' : (P.wall || '#fff8ec'), wallH = gym ? 1.95 : home ? 1.45 : 1.65, top = wallH, round = 0, doorKind = 'wood', winKind = 'plain', shut = '#3b8fd4';
        // 贴画：朝南的一块（z 固定）/ 朝东西的一块（x 固定，s = ±1 是朝哪边）
        const dS = (ax, ay, bx, by, z, c) => { dq.p.push(ax, ay, z, bx, ay, z, bx, by, z, ax, ay, z, bx, by, z, ax, by, z); dq.u.push(c[0], c[1], c[2], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[3]); for (let k = 0; k < 6; k++) dq.n.push(0, 0, 1); };
        const dX = (x, s, az, ay, bz, by, c) => { const za = s > 0 ? az : bz, zb = s > 0 ? bz : az; dq.p.push(x, ay, za, x, ay, zb, x, by, zb, x, ay, za, x, by, zb, x, by, za); dq.u.push(c[0], c[1], c[2], c[1], c[2], c[3], c[0], c[1], c[2], c[3], c[0], c[3]); for (let k = 0; k < 6; k++) dq.n.push(s, 0, 0); };
        const bx = (bw, bh, bd, col, x, y, z) => box(bag, bw, bh, bd, col, x, y0 + y, z);
        const gp = (g, col, x, y, z) => put(bag, g, col, x, y0 + y, z);
        // 墙：下深上浅的一块颜色，脚下一圈石头墙基；tex 有的话四面贴上砖 / 木板 / 石块的纹
        const wallCell = (kind, col, tw, thh) => atlasCell('wall:' + kind + col + Math.round(tw * 2) + 'x' + Math.round(thh * 2), Math.min(320, Math.round(tw * 44)), Math.min(160, Math.round(thh * 44)), (g, W, H) => {
          g.fillStyle = col; g.fillRect(0, 0, W, H);
          const u = 44;
          if (kind === 'brick') { for (let r = 0; r * 9 < H; r++) for (let x = (r % 2) * 10 - 10; x < W; x += 20) { g.fillStyle = A.shade(col, .9 + ((x * 7 + r * 13) % 5) * .045); A.rr(g, x + 1, r * 9 + 1, 18, 7, 1.5); g.fill(); } }
          else if (kind === 'plank' || kind === 'log') { const rh = kind === 'log' ? 13 : 11; for (let r = 0; r * rh < H; r++) { g.fillStyle = A.shade(col, r % 2 ? .9 : 1.05); g.fillRect(0, r * rh, W, rh - 1); g.fillStyle = A.shade(col, .7); g.fillRect(0, r * rh + rh - 1, W, 1); if (kind === 'log') { g.fillStyle = A.shade(col, .78); A.circ(g, 5, r * rh + rh / 2, 3.4); g.fill(); A.circ(g, W - 5, r * rh + rh / 2, 3.4); g.fill(); } } }
          else if (kind === 'stone') { for (let r = 0; r * 14 < H; r++) for (let x = (r % 2) * 11 - 11; x < W; x += 22) { g.fillStyle = A.shade(col, .9 + ((x + r * 7) % 3) * .06); A.rr(g, x + 1, r * 14 + 1, 20, 12, 3); g.fill(); } }
          else if (kind === 'stripe') { for (let k = 0; k * 14 < W; k++) { g.fillStyle = k % 2 ? '#ffffff' : col; g.fillRect(k * 14, 0, 14, H); } }
          else if (kind === 'office') { g.fillStyle = A.shade(col, .92); g.fillRect(0, 0, W, H); for (let r = 0; r * u * .5 + 6 < H; r++) for (let c = 0; c * u * .5 + 6 < W; c++) { g.fillStyle = (r * 3 + c * 5) % 4 ? '#a9d3ec' : '#e3f4ff'; A.rr(g, c * u * .5 + 5, r * u * .5 + 5, u * .5 - 9, u * .5 - 9, 2); g.fill(); } }
        });
        const wall = (h, tex, texCol, wi) => {
          const ww = w - .2 - (wi || 0);
          bx(ww, h, d, byY(A.shade(tex ? texCol : wallC, .86), tex ? texCol : wallC, 0, h * .7), cx, 0, cz);
          bx(ww + .12, .16, d + .12, topSide('#e4ddd0', '#b9af9f'), cx, -.02, cz);
          if (!fnd) fnd = [cx - ww / 2 - .06, cz - d / 2 - .06, cx + ww / 2 + .06, cz + d / 2 + .06];   // 墙基的范围：淡出去以后里面画木地板
          if (tex) { dS(cx - ww / 2, y0 + .14, cx + ww / 2, y0 + h, front + .006, wallCell(tex, texCol, ww, h)); const sc = wallCell(tex, texCol, d, h); dX(cx - ww / 2 - .006, -1, back, y0 + .14, front, y0 + h, sc); dX(cx + ww / 2 + .006, 1, back, y0 + .14, front, y0 + h, sc); }
        };
        // 人字屋顶：前坡是一排排深浅相间的瓦，屋檐一条厚边，屋脊一根亮色的脊
        // kind：tile 筒瓦（默认）/ thatch 茅草（一层层厚厚的草，下沿一排参差的草尖）/ leaf 棕榈叶（同样的做法，草尖更长更乱）/ snow 积雪（瓦上盖着厚厚一层雪，屋檐挂着冰溜子）
        const gable = (h, col, over, yb, kind) => {
          yb = y0 + (yb == null ? wallH : yb);
          const hw = (w + .2) / 2, zf = front + over, zb = back - .14, zr = cz + .04, c1 = C(col), c2 = C(A.shade(col, .88)), cR = C(A.shade(col, 1.16)), cF = C(A.shade(col, .7)), nB = 6, wc = C(wallC), cS = C(A.shade(col, .64));
          const sl0 = Math.hypot(h, zf - zr), ny0 = (zf - zr) / sl0, nz0 = h / sl0, dn = [0, -h / sl0, (zf - zr) / sl0];   // 坡面朝外的法线；dn：顺着坡往下（往屋檐）的方向
          if (kind === 'thatch' || kind === 'leaf') {
            const rows = tier === 'high' ? 7 : tier === 'mid' ? 5 : 4, nTe = Math.max(6, Math.round(hw * 2 / (tier === 'high' ? .085 : tier === 'mid' ? .13 : .2))), sag = t => -.05 * Math.sin(t * Math.PI), leaf = kind === 'leaf';
            const NO = [0, ny0, nz0], cU = C(A.shade(col, .5)), cT = new T3.Color(), cTip = C(A.shade(col, leaf ? .8 : 1.14));
            for (let k = 0; k < rows; k++) {
              const ta = k / rows, tb = (k + 1) / rows, th = .1 - ta * .03, ya = yb + h * ta + sag(ta), yt = yb + h * tb + sag(tb), za = lerp(zf, zr, ta), zt = lerp(zf, zr, tb);
              cT.copy(k % 2 ? c2 : c1).multiplyScalar(.94 + hash2(k, Math.round(cx * 5)) * .12);
              const A0 = [cx - hw, ya + ny0 * th, za + nz0 * th], B0 = [cx + hw, ya + ny0 * th, za + nz0 * th], A1 = [cx - hw, yt + ny0 * th * .6, zt + nz0 * th * .6], B1 = [cx + hw, yt + ny0 * th * .6, zt + nz0 * th * .6];
              quadN(bag, A0, B0, B1, A1, NO, NO, NO, NO, cT, cT, cT.clone().multiplyScalar(1.05), cT.clone().multiplyScalar(1.05));
              // 下沿：一排参差的草尖，从这一层的上面垂下来，盖住下一层的根
              for (let i = 0; i < nTe; i++) {
                const xa = cx - hw + i / nTe * hw * 2, xb = cx - hw + (i + 1) / nTe * hw * 2, xm = (xa + xb) / 2, ln = (leaf ? .13 : .07) + hash2(i + k * 57, Math.round(cx * 3)) * (leaf ? .14 : .07);
                const pA = [xa, A0[1], A0[2]], pB = [xb, A0[1], A0[2]], tip = [xm + (hash2(i, k + 9) - .5) * .05, A0[1] + dn[1] * ln - ny0 * .02, A0[2] + dn[2] * ln - nz0 * .02];
                quadN(bag, pA, pB, [xb, ya - .01, za], [xa, ya - .01, za], [0, -nz0, ny0], [0, -nz0, ny0], [0, -nz0, ny0], [0, -nz0, ny0], cU, cU, cU, cU);
                tri(bag, pB, pA, tip, cT, cT, cTip); tri(bag, pA, pB, tip, cU, cU, cU);
              }
            }
            // 屋脊：一根圆圆的草捆
            if (tier !== 'low') put(bag, new T3.CylinderGeometry(.11, .11, w + .3, 8).rotateZ(Math.PI / 2), leafC(A.shade(col, .7), col, A.shade(col, 1.12)), cx, yb + h + .03, zr);
          } else if (kind === 'snow') {
            // 积雪的屋顶：底下是深色的木瓦（屋檐和两头露出来一条），上面一层厚厚的雪，雪的前沿是圆的；屋檐下面挂着几根冰溜子
            const NO = [0, ny0, nz0], cW = C('#f7fafd'), cW2 = C('#e2ecf5'), sag = t => -.04 * Math.sin(t * Math.PI), nS = tier === 'low' ? 3 : 6;
            quad(bag, [cx - hw, yb, zf], [cx + hw, yb, zf], [cx + hw, yb + h, zr], [cx - hw, yb + h, zr], c1);
            for (let k = 0; k < nS; k++) {
              const ta = .06 + k / nS * .94, tb = .06 + (k + 1) / nS * .94, th = .15, ya = yb + h * ta + sag(ta), yt = yb + h * tb + sag(tb), za = lerp(zf, zr, ta), zt = lerp(zf, zr, tb);
              quadN(bag, [cx - hw + .03, ya + ny0 * th, za + nz0 * th], [cx + hw - .03, ya + ny0 * th, za + nz0 * th], [cx + hw - .03, yt + ny0 * th, zt + nz0 * th], [cx - hw + .03, yt + ny0 * th, zt + nz0 * th], NO, NO, NO, NO, cW, cW, cW, cW);
            }
            // 雪的前沿：一道圆边（法线从朝前转到朝上）
            { const ta = .06, ya = yb + h * ta, za = lerp(zf, zr, ta), th = .15, P0 = [ya + ny0 * th, za + nz0 * th], P1 = [ya - .02, za + .05];
              quadN(bag, [cx - hw + .03, P1[0], P1[1]], [cx + hw - .03, P1[0], P1[1]], [cx + hw - .03, P0[0], P0[1]], [cx - hw + .03, P0[0], P0[1]], [0, -.2, 1], [0, -.2, 1], NO, NO, cW2, cW2, cW, cW); }
            if (tier !== 'low') for (let i = 0; i < Math.round(w * 3); i++) { const ix = cx - hw + .15 + (i + hash2(i, 61)) / Math.round(w * 3) * (hw * 2 - .3), ln = .08 + hash2(i, 62) * .16; put(bag, new T3.ConeGeometry(.025, ln, 5).rotateX(Math.PI).translate(0, -ln / 2, 0), '#e8f6ff', ix, yb - .06, zf - .02); }
          } else if (tier === 'low') {
            for (let k = 0; k < nB; k++) { const ta = k / nB, tb = (k + 1) / nB, sag = t => -.07 * Math.sin(t * Math.PI); const ya = yb + h * ta + sag(ta) + (k ? .045 : 0), yt = yb + h * tb + sag(tb), za = lerp(zf, zr, ta), zt = lerp(zf, zr, tb); quad(bag, [cx - hw, ya, za], [cx + hw, ya, za], [cx + hw, yt, zt], [cx - hw, yt, zt], k % 2 ? c2 : c1); if (k) quad(bag, [cx - hw, ya - .045, za], [cx + hw, ya - .045, za], [cx + hw, ya, za], [cx - hw, ya, za], cS); }
          } else {
            // 一排排筒瓦：每片是一条鼓起来的半圆（法线跟着弧面转，所以是圆的），上一排压着下一排，瓦和瓦之间露出深色的底
            const rows = tier === 'high' ? 9 : 7, nT = Math.max(4, Math.round(hw * 2 / (tier === 'high' ? .27 : .36))), tw = hw * 2 / nT, sl = Math.hypot(h, zf - zr), ny0 = (zf - zr) / sl, nz0 = h / sl, sag = t => -.07 * Math.sin(t * Math.PI);
            const arc = tier === 'high' ? [-1.15, -.5, 0, .5, 1.15] : [-1.1, 0, 1.1], bh = .05, cT = new T3.Color();
            for (let k = 0; k < rows; k++) {
              const ta = k / rows, tb = (k + 1) / rows, ya = yb + h * ta + sag(ta), yt = yb + h * tb + sag(tb), za = lerp(zf, zr, ta), zt = lerp(zf, zr, tb);
              quad(bag, [cx - hw, ya, za], [cx + hw, ya, za], [cx + hw, yt, zt], [cx - hw, yt, zt], cS);
              for (let i = 0; i < nT; i++) {
                const x0t = cx - hw + (i + .5 + (k % 2 ? .5 : 0)) * tw, kc = .9 + hash2(i + k * 31, Math.round(cx * 7 + h * 13)) * .22;
                if (x0t > cx + hw - tw * .3) continue;
                cT.copy(k % 2 ? c2 : c1).multiplyScalar(kc);
                const cLo = cT.clone(), cHi = cT.clone().multiplyScalar(1.07);
                const pts = arc.map(a => { const sx = Math.sin(a) / Math.sin(1.15) * tw * .47, lf = bh * (Math.cos(a) - Math.cos(1.15)) / (1 - Math.cos(1.15)); return { x: x0t + sx, l: lf, n: [Math.sin(a), ny0 * Math.cos(a), nz0 * Math.cos(a)] }; });
                // 下头（屋檐这边）抬高一点压在下一排上面，上头钻到上一排底下
                const lo = (q, e) => [q.x, ya + (q.l + e) * ny0 - .012, za + (q.l + e) * nz0 + .03], up = q => [q.x, yt + q.l * .55 * ny0 + .012, zt + q.l * .55 * nz0];
                for (let j = 0; j < pts.length - 1; j++) quadN(bag, lo(pts[j], .03), lo(pts[j + 1], .03), up(pts[j + 1]), up(pts[j]), pts[j].n, pts[j + 1].n, pts[j + 1].n, pts[j].n, cLo, cLo, cHi, cHi);
                // 瓦头：一个小小的半圆面
                const m0 = [x0t, ya - .012, za + .03], fn = [0, -nz0 * .3, 1];
                for (let j = 0; j < pts.length - 1; j++) quadN(bag, m0, lo(pts[j + 1], .03), lo(pts[j], .03), m0, fn, fn, fn, fn, cS, cS, cS, cS);
              }
            }
          }
          quad(bag, [cx + hw, yb, zb], [cx - hw, yb, zb], [cx - hw, yb + h, zr], [cx + hw, yb + h, zr], c2);
          quad(bag, [cx - hw, yb - .11, zf], [cx + hw, yb - .11, zf], [cx + hw, yb, zf], [cx - hw, yb, zf], cF);
          { const xa = cx - (w - .2) / 2, xb = cx + (w - .2) / 2, c0 = mixC(A.shade(wallC, .7), '#8aa0d0', .3), c1 = C(A.shade(wallC, .97)); quad(bag, [xa, yb - .3, front + .004], [xb, yb - .3, front + .004], [xb, yb - .02, front + .004], [xa, yb - .02, front + .004], c1, c1, c0, c0); }
          box(bag, w + .28, kind === 'snow' ? .14 : .1, kind === 'snow' ? .3 : .16, kind === 'snow' ? C('#f7fafd') : cR, cx, yb + h - .05 + (kind === 'snow' ? .1 : 0), zr);
          [-1, 1].forEach(s => {
            const xw = cx + s * (w - .2) / 2, xe = cx + s * hw, a = [xw, yb - .02, front], bb = [xw, yb - .02, back], t = [xw, yb + h * .93, zr];
            if (s > 0) tri(bag, a, bb, t, wc); else tri(bag, bb, a, t, wc);
            // 屋顶两头的封边（深一点的一条）
            const e0 = [xe, yb - .11, zf], e1 = [xe, yb + h - .11, zr], e2 = [xe, yb + h, zr], e3 = [xe, yb, zf], f0 = [xe, yb - .11, zb], f3 = [xe, yb, zb];
            if (s > 0) { quad(bag, e0, e1, e2, e3, cF); quad(bag, e1, f0, f3, e2, cF); } else { quad(bag, e3, e2, e1, e0, cF); quad(bag, e2, f3, f0, e1, cF); }
          });
          top = Math.max(top, yb - y0 + h);
        };
        // 四坡 / 多边的尖顶
        const pyramid = (rw, rd, h, col, yb, segs) => { yb = yb == null ? wallH : yb; const g = new T3.ConeGeometry(Math.SQRT1_2, h, segs || 4, 1).rotateY(segs && segs !== 4 ? 0 : Math.PI / 4).scale((segs && segs !== 4 ? 1.414 : 1) * rw, 1, (segs && segs !== 4 ? 1.414 : 1) * rd).translate(0, h / 2, 0); gp(g, byY(A.shade(col, .86), A.shade(col, 1.08), 0, h), cx, yb, cz); top = Math.max(top, yb + h); };
        const flat = (col, yb, lip) => { yb = yb == null ? wallH : yb; bx(w - .04, .14, d + .16, topSide(A.shade(col, 1.08), A.shade(col, .78)), cx, yb, cz); if (lip !== false) { bx(w - .04, .16, .1, A.shade(col, .86), cx, yb + .14, front + .03); bx(.1, .16, d + .16, A.shade(col, .86), cx - w / 2 + .07, yb + .14, cz); bx(.1, .16, d + .16, A.shade(col, .86), cx + w / 2 - .07, yb + .14, cz); } top = Math.max(top, yb + .3); };
        const chimney = () => {
          const px = x1 - .85, pz = cz - .1;
          bx(.28, .66, .28, byY(A.shade(roofC, .6), A.shade(roofC, .8), 0, .66), px, wallH + .3, pz); bx(.36, .07, .36, '#f1ebe0', px, wallH + .94, pz); bx(.3, .04, .3, '#d8d0c2', px, wallH + 1.01, pz);
          if (tier !== 'low') gp(new T3.CylinderGeometry(.075, .09, .2, 12, 1, true).translate(0, .1, 0), byY('#a85a3a', '#c9744e', 0, .2), px, wallH + 1.05, pz);
        };
        switch (style) {
          case 'med': wallC = '#fbf7ef'; wall(wallH); gable(gym ? 1.15 : .95, gym ? roofC : '#d9643a', .42); if (home) chimney(); doorKind = 'blue'; winKind = 'shutter'; break;
          case 'crayon': {
            // 糖果色的方块房子，屋顶是一支削尖的彩色铅笔：一圈六棱的笔杆（每面是平的）、削出来的木头尖、和笔杆同色的笔芯；墙上一道同色的「包装纸」色带，圆窗
            const pc = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#ff7043'][Math.floor(hsh * 6)], fl = g => { const q = g.toNonIndexed(); g.dispose(); q.deleteAttribute('normal'); q.computeVertexNormals(); return q; };
            wallC = HCOL[Math.floor(hsh * HCOL.length)]; wall(wallH);
            bx(w - .14, .15, d + .05, pc, cx, wallH - .46, cz);
            bx(w - .02, .1, d + .16, topSide(A.shade(wallC, 1.04), A.shade(wallC, .84)), cx, wallH, cz);
            const r = Math.min(w - .1, d + .5) * .58, rz = Math.min(1, d * .68 / r), bh = .36, ch = 1.15, yR = wallH + .1;
            gp(fl(new T3.CylinderGeometry(r, r, bh, 6).scale(1, 1, rz).translate(0, bh / 2, 0)), byY(A.shade(pc, .82), pc, 0, bh), cx, yR, cz);
            gp(fl(new T3.ConeGeometry(r, ch, 6).scale(1, 1, rz).translate(0, ch / 2, 0)), byY('#dcaa70', '#f6dbb0', 0, ch), cx, yR + bh, cz);
            gp(fl(new T3.ConeGeometry(r * .3, ch * .3, 6).scale(1, 1, rz).translate(0, ch * .15, 0)), pc, cx, yR + bh + ch * .7, cz);
            top = yR + bh + ch; winKind = 'round';
            break;
          }
          case 'farm': wall(wallH, 'plank', P.wall || '#c9955e'); gable(1.2, '#e3bd5a', .62, null, 'thatch'); winKind = 'shutter'; shut = '#7a4a28'; if (home) chimney(); break;
          case 'brick': {
            // 红砖教学楼：平顶、白色的檐口和窗台线、两层窗；宽的楼中间立着钟楼（方塔、四面钟、尖顶、顶上一只小铃铛）
            wallH += gym ? .45 : .3; wall(wallH, 'brick', '#b5543c'); flat('#7a5446');
            bx(w - .1, .09, d + .08, '#f3ece0', cx, wallH - .04, cz); bx(w - .14, .06, d + .04, '#efe6d6', cx, .62, cz);
            if (w >= 5) {
              const tw2 = Math.min(1.3, w * .2), th2 = 1.5;
              bx(tw2, th2, tw2, byY('#a24c38', '#bf5d46', 0, th2), cx, wallH + .14, cz); bx(tw2 + .12, .1, tw2 + .12, '#f3ece0', cx, wallH + .14 + th2, cz);
              pyramid(tw2 * .62, tw2 * .62, .75, '#5d4037', wallH + .24 + th2);
              dS(cx - .32, y0 + wallH + .55, cx + .32, y0 + wallH + 1.19, cz + tw2 / 2 + .01, clockCell());
              gp(new T3.LatheGeometry([[0, 0], [.13, 0], [.12, .04], [.08, .1], [.06, .16], [0, .18]].map(([px, py]) => new T3.Vector2(px, py)), 10), '#ffc93c', cx, wallH + .24 + th2 + .62, cz);
              top = Math.max(top, wallH + 1.2 + th2);
            }
            break;
          }
          case 'dome': {
            // 实验楼：白墙、一道蓝色的腰线，玻璃圆顶上几道白色的肋；有的楼顶边上立着一面朝天的卫星天线
            wallC = '#f6fafc'; wall(wallH); bx(w - .16, .12, d + .06, P.trim || '#5c6bc0', cx, wallH - .32, cz);
            const dr = Math.min(w - .24, d) * .5, dsx = w > d + .5 ? (w - .24) / d : 1, sg2 = tier === 'high' ? 24 : 16;
            gp(new T3.SphereGeometry(dr, sg2, 10, 0, 6.2832, 0, Math.PI / 2).scale(dsx, 1, 1), leafC('#5fb3e0', '#8fd3f4', '#e6f7ff'), cx, wallH, cz);
            if (tier !== 'low') for (let k = 0; k < 4; k++) gp(new T3.TorusGeometry(dr * 1.005, .022, 4, 16, Math.PI).rotateY(k * Math.PI / 4).scale(dsx, 1, 1), '#f4f8fb', cx, wallH, cz);
            gp(new T3.CylinderGeometry(dr * .2, dr * .24, .1, 10), '#e8eef2', cx, wallH + dr - .02, cz);
            if (hsh > .45) { const dx2 = cx + (w / 2 - .45) * (hsh > .7 ? 1 : -1), dz2 = back + .4; gp(new T3.CylinderGeometry(.04, .05, .45, 6).translate(0, .22, 0), '#90a4ae', dx2, wallH, dz2); gp(new T3.SphereGeometry(.34, 12, 5, 0, 6.2832, 0, Math.PI * .32).rotateX(-.75), '#f4f6f8', dx2, wallH + .55, dz2 + .1); gp(new T3.CylinderGeometry(.012, .012, .3, 4).rotateX(-.75).translate(0, .15, .1), '#607d8b', dx2, wallH + .5, dz2 + .1); }
            else bx(.05, .5, .05, '#90a4ae', cx + w * .3, wallH + dr * .8, cz);
            top = wallH + dr; doorKind = 'glass';
            break;
          }
          case 'tent': {
            // 马戏帐篷：一圈条纹的帐篷布、条纹的尖顶，檐口垂着一圈波浪边，顶上一面小旗，从尖顶往下拉着几串三角彩旗
            round = Math.min(w - .2, d + .2) / 2; const sc = gym ? roofC : ['#e53935', '#1e88e5', '#8e24aa', '#43a047'][Math.floor(hsh * 4)], n = 16, apex = [cx, y0 + wallH + 1.3, cz];
            for (let k = 0; k < n; k++) { const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, col = C(k % 2 ? '#ffffff' : sc), col2 = C(k % 2 ? '#ffffff' : (gym ? roofC : '#ffca28')), P0 = [cx + Math.cos(a0) * round, y0, cz + Math.sin(a0) * round], P1 = [cx + Math.cos(a1) * round, y0, cz + Math.sin(a1) * round]; quad(bag, P1, P0, [P0[0], y0 + wallH, P0[2]], [P1[0], y0 + wallH, P1[2]], col); tri(bag, [cx + Math.cos(a1) * round * 1.14, y0 + wallH, cz + Math.sin(a1) * round * 1.14], [cx + Math.cos(a0) * round * 1.14, y0 + wallH, cz + Math.sin(a0) * round * 1.14], apex, col2); }
            if (tier !== 'low') {
              // 檐口的波浪边：每一片布下面垂一个小半圆
              const vc = C(gym ? A.shade(roofC, .85) : '#ffca28');
              for (let k = 0; k < n * 2; k++) { const a0 = k / (n * 2) * 6.2832, a1 = (k + 1) / (n * 2) * 6.2832, am = (a0 + a1) / 2, r2 = round * 1.145; tri(bag, [cx + Math.cos(a1) * r2, y0 + wallH, cz + Math.sin(a1) * r2], [cx + Math.cos(a0) * r2, y0 + wallH, cz + Math.sin(a0) * r2], [cx + Math.cos(am) * r2, y0 + wallH - .14, cz + Math.sin(am) * r2], vc); }
              // 几串三角彩旗：从尖顶垂到帐篷边外面的地上（一根弯下来的绳子，上面挂着一面面小三角旗）
              const fc = ['#ffca28', '#e53935', '#1e88e5', '#43a047', '#ffffff'].map(h => C(h));
              [.9, 2.5, 4.1, 5.6].forEach((a, q) => {
                const end = [cx + Math.cos(a) * (round + 1.1), y0 + .05, cz + Math.sin(a) * (round + 1.1)], N = 8;
                for (let k = 0; k < N; k++) {
                  const t0 = k / N, t1 = (k + .55) / N, sag = t => Math.sin(t * Math.PI) * .45, at = t => [lerp(apex[0], end[0], t), lerp(apex[1], end[1], t) - sag(t) + .02, lerp(apex[2], end[2], t)];
                  const p0 = at(t0), p1 = at(t1), mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - .17, (p0[2] + p1[2]) / 2];
                  tri(bag, p0, p1, mid, fc[(k + q) % fc.length]); tri(bag, p1, p0, mid, fc[(k + q) % fc.length]);
                }
              });
            }
            bx(.04, .5, .04, '#6d4121', cx, wallH + 1.25, cz); bx(.3, .18, .02, '#ffca28', cx + .17, wallH + 1.55, cz); top = wallH + 1.6;
            break;
          }
          case 'tower': {
            // 作息岛的石塔：石块墙、一圈铜色的檐、铜绿的尖顶，正面一面钟，两边的墙上画着齿轮
            wallH = gym ? 2.7 : 2.1; wall(wallH, 'stone', '#cfc6b6'); bx(w + .02, .12, d + .14, '#b8862b', cx, wallH - .06, cz);
            pyramid((w + .5) / 2, (d + .5) / 2, 1.3, '#4f9e8a'); gp(new T3.SphereGeometry(.09, 8, 6), '#d9a93c', cx, wallH + 1.36, cz);
            dS(cx - .3, y0 + wallH - .78, cx + .3, y0 + wallH - .18, front + .012, clockCell());
            const gc = gearCell(); dX(x0 + .1 - .006, -1, cz - .32, y0 + wallH * .45, cz + .32, y0 + wallH * .45 + .64, gc); dX(x1 - .1 + .006, 1, cz - .32, y0 + wallH * .45, cz + .32, y0 + wallH * .45 + .64, gc);
            break;
          }
          case 'cake': {
            // 蛋糕房子：两层圆蛋糕，粉白相间的竖条奶油墙，每层顶上一圈奶油往下淌（一个个圆圆的「滴」），撒着彩色的糖粒，顶上三根小蜡烛
            round = Math.min(w - .2, d + .2) / 2; const sg3 = tier === 'high' ? 28 : 20, h1 = wallH * .64, h2 = wallH * .46, r1 = round, r2 = round * .72;
            gp(new T3.CylinderGeometry(r1, r1, h1, sg3).translate(0, h1 / 2, 0), (out, nx, ny, nz) => { out.set(Math.floor((Math.atan2(nz, nx) / 6.2832 + 1) * 14) % 2 ? '#fff4e0' : '#ffe3ec'); }, cx, 0, cz);
            gp(new T3.CylinderGeometry(r2, r2, h2, sg3).translate(0, h2 / 2, 0), '#ffd6e2', cx, h1, cz);
            gp(new T3.CylinderGeometry(r1 + .02, r1 + .02, .06, sg3), '#ff8fb1', cx, h1, cz);
            [[r1, h1, '#ffffff'], [r2, h1 + h2, '#ffffff']].forEach(([rr, yy, c]) => {
              gp(new T3.TorusGeometry(rr, .08, 6, sg3).rotateX(Math.PI / 2), c, cx, yy, cz);
              if (tier !== 'low') for (let k = 0; k < Math.round(rr * 9); k++) { const a = k / Math.round(rr * 9) * 6.2832 + .2, ln = .1 + hash2(k, Math.round(rr * 10)) * .16; gp(new T3.CapsuleGeometry(.045, ln, 3, 6).translate(0, -ln / 2, 0), c, cx + Math.cos(a) * (rr + .03), yy - .02, cz + Math.sin(a) * (rr + .03)); }
            });
            if (tier !== 'low') { const spc = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#ab47bc']; for (let k = 0; k < 22; k++) { const a = hash2(k, 71) * 6.2832, rr = Math.sqrt(hash2(k, 72)) * r2 * .9; bx(.06, .025, .025, spc[k % spc.length], cx + Math.cos(a) * rr, h1 + h2 + .06, cz + Math.sin(a) * rr); } }
            [-.22, 0, .22].forEach((ox, k) => { gp(new T3.CylinderGeometry(.04, .04, .3, 8).translate(0, .15, 0), ['#80deea', '#ff8fb1', '#fff176'][k], cx + ox, h1 + h2 + .04, cz + (k === 1 ? -.12 : .05)); gp(new T3.SphereGeometry(.05, 8, 6).scale(1, 1.5, 1), '#ffb43c', cx + ox, h1 + h2 + .41, cz + (k === 1 ? -.12 : .05)); });
            top = h1 + h2 + .5; wallH = h1;
            break;
          }
          case 'hut': {
            // 高脚树屋：四根木桩把屋子架起来（桩子之间斜撑着），木板墙，棕榈叶的屋顶（一层层垂下来的长叶子），门前一圈木平台、绳子栏杆和一段梯子
            [[x0 + .3, back + .1], [x1 - .3, back + .1], [x0 + .3, front - .1], [x1 - .3, front - .1]].forEach(([px, pz]) => gp(new T3.CylinderGeometry(.06, .075, .52, 8).translate(0, .26, 0), byY('#4e3018', '#6d4121', 0, .5), px, 0, pz));
            if (tier !== 'low') [[x0 + .3, 1], [x1 - .3, -1]].forEach(([px, sd]) => gp(new T3.CylinderGeometry(.025, .025, .7, 5).rotateX(sd * .9), '#6d4121', px, .22, cz));
            bx(w - .24, wallH - .1, d, byY('#8c5e30', '#a8773f', 0, wallH - .1), cx, .45, cz);
            dS(cx - (w - .24) / 2, y0 + .45, cx + (w - .24) / 2, y0 + .35 + wallH, front + .006, wallCell('plank', '#a06f3c', w - .24, wallH - .1));
            gable(.9, '#5f9a42', .62, wallH + .35, 'leaf');
            bx(w + .1, .07, .62, topSide('#a87445', '#7a5232'), cx, .4, front + .26);
            if (tier !== 'low') { for (let k = 0; k <= Math.round(w * 2); k++) { const px = x0 + .02 + k / Math.round(w * 2) * (w - .04); if (b.door && Math.abs(px - b.door.x - .5) < .3) continue; bx(.04, .3, .04, '#7a5232', px, .47, front + .55); } bx(w + .06, .025, .025, '#d8c08a', cx, .72, front + .55); }
            const lx = b.door ? b.door.x + .5 : cx;
            [-1, 1].forEach(sd => gp(new T3.CylinderGeometry(.025, .025, .62, 5).rotateX(-.45), '#7a5232', lx + sd * .17, .2, front + .7));
            for (let k = 0; k < 3; k++) bx(.36, .035, .05, '#8a5a33', lx, .08 + k * .12, front + .82 - k * .055);
            break;
          }
          case 'city': {
            // 规则城的楼：一格格玻璃窗的楼身（每栋一种浅色），一楼是一圈彩色的店面和雨棚，楼顶一圈矮墙，上面有水箱、空调外机、天线
            wallH = gym ? 2.5 : home ? 2.3 + hsh * .8 : 2.9 + hsh * 1.2;
            const tone = ['#b0bec5', '#c5cae9', '#b2dfdb', '#d7ccc8', '#cfd8dc'][Math.floor(hsh * 5)];
            wall(wallH, 'office', tone); flat('#5d6d78');
            const sh2 = ['#e57373', '#4fc3f7', '#ffb74d', '#81c784'][Math.floor(hsh * 4)];
            bx(w - .16, .5, .04, A.shade(sh2, .9), cx, .14, front + .012);
            if (tier !== 'low') for (let k = 0; k < Math.max(3, Math.round(w * 2)); k++) { const n2 = Math.max(3, Math.round(w * 2)), xa = x0 + .12 + (w - .24) * k / n2, xb = x0 + .12 + (w - .24) * (k + 1) / n2; quad(bag, [xa, y0 + .66, front + .32], [xb, y0 + .66, front + .32], [xb, y0 + .84, front + .02], [xa, y0 + .84, front + .02], C(k % 2 ? '#ffffff' : sh2)); }
            bx(w - .04, .18, .08, '#7f8f9a', cx, wallH + .14, back + .06);
            if (!gym) {
              const tx = x0 + .5 + hsh * (w - 1), tz = back + .45;
              gp(new T3.CylinderGeometry(.22, .22, .38, 10).translate(0, .19, 0), '#8d6e63', tx, wallH + .28, tz); gp(new T3.ConeGeometry(.25, .14, 10).translate(0, .07, 0), '#6d4c41', tx, wallH + .66, tz);
              [[-.1, '#90a4ae'], [.14, '#78909c']].forEach(([ox, c]) => bx(.28, .2, .22, c, x1 - .6 + ox, wallH + .28, cz - .05 + ox));
              if (hsh > .5) gp(new T3.CylinderGeometry(.012, .018, .9, 4).translate(0, .45, 0), '#546e7a', x0 + .4, wallH + .28, tz);
              top = wallH + .9;
            } else bx(.6, .35, .5, '#78909c', cx + w * .2, wallH + .14, cz - .1);
            doorKind = 'glass'; winKind = 'none';
            break;
          }
          case 'market': {
            wallC = '#ffffff'; wall(wallH); flat(roofC);
            const sc = ['#ff7043', '#1e88e5', '#43a047', '#fdd835'][Math.floor(hsh * 4)], n = Math.max(4, Math.round(w * 2));
            for (let k = 0; k < n; k++) { const xa = x0 + .15 + (w - .3) * k / n, xb = x0 + .15 + (w - .3) * (k + 1) / n; quad(bag, [xa, y0 + wallH * .62, front + .5], [xb, y0 + wallH * .62, front + .5], [xb, y0 + wallH * .86, front + .02], [xa, y0 + wallH * .86, front + .02], C(k % 2 ? '#ffffff' : sc)); }
            winKind = 'none';
            break;
          }
          case 'chalet': wall(wallH, 'log', '#8d6e63'); gable(1.45, '#6b4636', .62, null, 'snow'); chimney(); winKind = 'shutter'; shut = '#b23a32'; break;
          case 'temple': {
            // 回忆岛的石头神殿：石块墙、门前一排有凹槽的石柱（两头的那根断了半截）、厚厚的檐、三角形的山墙顶；墙上爬着藤，墙根长着苔藓
            wallH += .15; wall(wallH, 'stone', '#c9bfa8');
            bx(w + .1, .16, d + .62, topSide('#d2c9b2', '#a39a84'), cx, wallH, cz + .06);
            const ph = .62, hw2 = (w + .1) / 2, zf2 = front + .37, zb2 = back - .1, pc2 = C('#c4bba4'), pf = C('#b3a992');
            tri(bag, [cx - hw2, y0 + wallH + .16, zf2], [cx + hw2, y0 + wallH + .16, zf2], [cx, y0 + wallH + .16 + ph, zf2], pc2);
            { const yb2 = y0 + wallH + .16, yt2 = yb2 + ph, L2 = cx - hw2, R2 = cx + hw2; quad(bag, [L2, yb2, zf2], [cx, yt2, zf2], [cx, yt2, zb2], [L2, yb2, zb2], pf); quad(bag, [R2, yb2, zb2], [cx, yt2, zb2], [cx, yt2, zf2], [R2, yb2, zf2], pf); }
            top = wallH + .16 + ph;
            const nC = Math.max(2, Math.round(w / 1.1)), sgC = tier === 'high' ? 12 : 8;
            for (let k = 0; k < nC; k++) {
              const px = x0 + .32 + (w - .64) * k / (nC - 1); if (b.door && Math.abs(px - b.door.x - .5) < .45) continue;
              const broken = (k === 0 || k === nC - 1) && hsh > .4, ch = broken ? wallH * (.45 + hsh * .2) : wallH;
              gp(new T3.CylinderGeometry(.13, .15, ch, sgC).translate(0, ch / 2, 0), (out, nx, ny, nz) => { out.set('#ddd4bf').multiplyScalar(.86 + .14 * Math.abs(Math.sin(Math.atan2(nz, nx) * sgC / 2))); }, px, 0, front + .26);
              bx(.36, .1, .36, '#cfc6b0', px, 0, front + .26); if (!broken) bx(.36, .1, .36, '#cfc6b0', px, ch - .1, front + .26);
              else gp(new T3.IcosahedronGeometry(.11, 0), '#cfc6b0', px + .22, .06, front + .5);
            }
            if (tier !== 'low') for (let k = 0; k < 3; k++) { const vx = x0 + .4 + hash2(k, Math.round(cx * 7)) * (w - .8), ln = .5 + hash2(k, 3) * (wallH - .6); bx(.07, ln, .02, byY('#4f7a3a', '#6f9a4c', 0, ln), vx, wallH - ln, front + .015); for (let q = 0; q < 4; q++) ball(bag, .07, 1, vx + (q % 2 ? .05 : -.05), y0 + wallH - ln * (q + .5) / 4, front + .04, { sy: .7, col: leafC('#3f6a30', '#5f8f45', '#86b36a'), seed: k * 5 + q }); }
            bx(w - .1, .12, .06, '#7f9a5e', cx, .02, front + .02);
            winKind = 'none';
            break;
          }
          case 'lighthouse': {
            // 灯塔：一圈红一圈白往上收，顶上一圈栏杆、发亮的灯室、小尖顶
            const r = Math.min(.62, w * .34), Ht = 4.1, n = 7;
            for (let k = 0; k < n; k++) { const ra = r * (1 - .36 * k / n), rb = r * (1 - .36 * (k + 1) / n); gp(new T3.CylinderGeometry(rb, ra, Ht / n, 16).translate(0, Ht / n / 2, 0), k % 2 ? '#fdfaf3' : '#e5483d', cx, Ht * k / n, cz); }
            gp(new T3.CylinderGeometry(r * .92, r * .78, .1, 16), '#4a5560', cx, Ht + .05, cz); gp(new T3.TorusGeometry(r * .9, .025, 4, 16).rotateX(Math.PI / 2), '#4a5560', cx, Ht + .34, cz);
            gp(new T3.CylinderGeometry(r * .5, r * .5, .46, 12).translate(0, .23, 0), '#fff6a8', cx, Ht + .1, cz);
            gp(new T3.ConeGeometry(r * .66, .5, 12).translate(0, .25, 0), byY('#3b4650', '#5d6b78', 0, .5), cx, Ht + .56, cz); gp(new T3.SphereGeometry(.06, 6, 4), '#ffd54f', cx, Ht + 1.1, cz);
            bx(r * 2.5, .14, r * 2.5, topSide('#e4ddd0', '#b9af9f'), cx, -.02, cz);
            round = r * .99; top = Ht + 1.1; wallH = 1.2; winKind = 'none';
            break;
          }
          case 'windmill': {
            // 风车：往上收的八角塔身（木板墙）、八角的尖顶、塔前一根转轴上四片带格子的帆（会转）
            const rb = Math.min(w, d + .4) * .5, rt2 = rb * .72, hh = wallH + .7;
            gp(new T3.CylinderGeometry(rt2, rb, hh, 8).translate(0, hh / 2, 0), byY('#d9c5a0', '#f3e6cc', 0, hh), cx, 0, cz);
            if (tier !== 'low') for (let k = 1; k < 4; k++) { const f2 = k / 4; gp(new T3.CylinderGeometry(lerp(rb, rt2, f2) + .015, lerp(rb, rt2, f2) + .015, .04, 8), '#b39a74', cx, hh * f2, cz); }
            gp(new T3.ConeGeometry(rt2 * 1.18, .95, 8).translate(0, .47, 0), byY('#7a5240', '#9a6a52', 0, .95), cx, hh, cz);
            const hub = new T3.Group(), hb = Bag(), zs = cz + rt2 + .14; hub.position.set(cx, y0 + hh - .15, zs);
            for (let k = 0; k < 4; k++) {
              const rot = k * Math.PI / 2;
              put(hb, new T3.BoxGeometry(.05, 1.55, .05).translate(0, .8, 0).rotateZ(rot), '#7a5240');
              put(hb, new T3.BoxGeometry(.26, 1.1, .02).translate(.15, 1.0, 0).rotateZ(rot), '#f5ecd9');
              if (tier !== 'low') for (let q = 0; q < 4; q++) put(hb, new T3.BoxGeometry(.28, .025, .03).translate(.15, .55 + q * .3, .015).rotateZ(rot), '#9c7a5a');
            }
            put(hb, new T3.SphereGeometry(.1, 8, 6), '#7a5240');
            const hg = bake(hb); own.push(hg); hub.add(new T3.Mesh(hg, propMat)); hub.children[0].castShadow = !!Q.shadow; add(hub, false); spinners.push(hub);
            round = rb; top = hh + 1.6; wallH = 1.2; winKind = 'none';
            break;
          }
          case 'stadium': {
            // 体育场：一圈白墙（一道道竖的肋），顶上一圈彩色的檐和一面面小旗，门口一道拱门；四个角上立着高高的灯架
            round = Math.min(w, d + .3) / 2; const sgS = tier === 'high' ? 40 : 24, sH = wallH + .3;
            gp(new T3.CylinderGeometry(round, round * 1.05, sH, sgS, 1, true).translate(0, sH / 2, 0), (out, nx, ny, nz, px, py) => { out.set('#eef2f4').lerp(C('#c4ced4'), 1 - py / sH); if (Math.floor((Math.atan2(nz, nx) / 6.2832 + 1) * sgS) % 4 === 0) out.multiplyScalar(.9); }, cx, 0, cz);
            gp(new T3.TorusGeometry(round, .12, 6, sgS).rotateX(Math.PI / 2), roofC, cx, sH, cz);
            gp(new T3.CylinderGeometry(round * 1.08, round * 1.08, .1, sgS, 1, true).translate(0, .05, 0), '#1e88e5', cx, sH - .45, cz);
            if (tier !== 'low') for (let k = 0; k < 10; k++) { const a = Math.PI * (.08 + .84 * k / 9), px = cx + Math.cos(a) * round, pz = cz + Math.sin(a) * round; bx(.03, .5, .03, '#90a4ae', px, sH, pz); bx(.2, .12, .02, ['#e53935', '#fdd835', '#1e88e5', '#43a047'][k % 4], px + .1, sH + .36, pz); }
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b2]) => { const px = cx + a * (round + .3), pz = cz + b2 * (round * .55); bx(.08, sH + 1.6, .08, '#9aa6ae', px, 0, pz); bx(.5, .26, .12, '#fff8d8', px, sH + 1.55, pz + .04); });
            round *= 1.04; top = sH + 1.9; wallH = sH;
            break;
          }
          default: wall(wallH); gable(1.0, roofC, .36); if (home) chimney();
        }
        // 门：圆顶的门、门前一级台阶；圆房子的门贴在最前面
        const lift = style === 'hut' ? .45 : 0;
        if (b.door) {
          const dx = b.door.x + .5, dz = round ? cz + Math.sqrt(Math.max(0, round * round - (dx - cx) * (dx - cx))) + .02 : front + .014;
          if (std || doorKind === 'glass') doorKind = L === 'C' || doorKind === 'glass' ? 'glass' : 'wood';
          dS(dx - .36, y0 + lift + .02, dx + .36, y0 + lift + 1.06, dz, atlasCell('door:' + doorKind, 72, 104, (g) => {
            const fr = doorKind === 'glass' ? '#4d6b7a' : doorKind === 'blue' ? '#1c5a94' : '#5d3f2b', pn = doorKind === 'glass' ? '#c6ecff' : doorKind === 'blue' ? '#3f97de' : '#a06c43';
            g.fillStyle = '#f7f1e6'; A.rr(g, 0, 0, 72, 104, [32, 32, 0, 0]); g.fill();
            g.fillStyle = fr; A.rr(g, 5, 5, 62, 99, [28, 28, 0, 0]); g.fill();
            g.fillStyle = pn; A.rr(g, 11, 11, 50, 93, [23, 23, 0, 0]); g.fill();
            g.fillStyle = 'rgba(255,255,255,.28)'; A.rr(g, 15, 16, 14, 84, [10, 4, 0, 0]); g.fill();
            if (doorKind === 'glass') { g.fillStyle = fr; g.fillRect(34, 11, 4, 93); } else { g.strokeStyle = A.shade(pn, .78); g.lineWidth = 3; A.rr(g, 19, 50, 34, 44, 4); g.stroke(); g.fillStyle = '#bfe6fb'; A.circ(g, 36, 30, 9); g.fill(); g.strokeStyle = fr; g.lineWidth = 3; g.stroke(); }
            g.fillStyle = '#ffd54f'; A.circ(g, 51, 66, 4.5); g.fill();
          }));
          if (style !== 'hut') { bx(.9, .09, .3, topSide('#e9e2d5', '#bdb3a2'), dx, 0, dz + .16); if (tier !== 'low' && !round) bx(1.06, .045, .2, topSide('#ded6c8', '#b3a998'), dx, 0, dz + .4); }
          if (tier !== 'low' && !round && doorKind !== 'glass') {
            const fc = '#f4ede0', yb2 = lift + .02, sg = tier === 'high' ? 14 : 8;
            [-1, 1].forEach(sd => bx(.07, .68, .07, byY(A.shade(fc, .9), fc, 0, .68), dx + sd * .36, yb2, dz + .02));
            gp(new T3.TorusGeometry(.36, .04, 6, sg, Math.PI).scale(1, 1.02, 1), fc, dx, yb2 + .68, dz + .02);
            gp(new T3.SphereGeometry(.035, 8, 6), '#ffd54f', dx + .2, yb2 + .44, dz + .03);
          }
        }
        // 窗：白框、浅蓝玻璃上一道反光、木头窗扇、窗台上一盆花
        if (!round && winKind !== 'none') {
          const cellW = atlasCell('win:' + winKind + shut, 112, 96, (g) => {
            if (winKind === 'round') { g.fillStyle = '#ffffff'; A.circ(g, 56, 44, 34); g.fill(); g.fillStyle = '#9fdcf7'; A.circ(g, 56, 44, 27); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(53, 17, 6, 54); g.fillRect(29, 41, 54, 6); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(38, 60); g.lineTo(52, 22); g.lineTo(60, 22); g.lineTo(46, 60); g.fill(); return; }
            if (winKind === 'shutter') { g.fillStyle = shut; A.rr(g, 2, 6, 24, 66, 4); g.fill(); A.rr(g, 86, 6, 24, 66, 4); g.fill(); g.fillStyle = A.shade(shut, .8); for (let k = 0; k < 5; k++) { g.fillRect(5, 14 + k * 12, 18, 3); g.fillRect(89, 14 + k * 12, 18, 3); } }
            g.fillStyle = '#ffffff'; A.rr(g, 24, 4, 64, 70, 7); g.fill();
            const gr = g.createLinearGradient(0, 10, 0, 68); gr.addColorStop(0, '#8fd3f4'); gr.addColorStop(1, '#d9f3ff'); g.fillStyle = gr; A.rr(g, 30, 10, 52, 58, 4); g.fill();
            g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.moveTo(36, 62); g.lineTo(50, 14); g.lineTo(60, 14); g.lineTo(46, 62); g.fill();
            g.fillStyle = '#ffffff'; g.fillRect(54, 10, 4, 58); g.fillRect(30, 37, 52, 4);
            g.fillStyle = '#9a6a44'; A.rr(g, 22, 74, 68, 16, 4); g.fill();
            ['#ff6b9d', '#ffd54f', '#ffffff', '#ff6b9d', '#b388ff'].forEach((c, k) => { g.fillStyle = '#4c9a3f'; A.circ(g, 32 + k * 12, 74, 6); g.fill(); g.fillStyle = c; A.circ(g, 32 + k * 12, 70, 4); g.fill(); });
          });
          const wy = y0 + lift + Math.min(wallH, 1.7) * .34;
          const win3 = wx => {
            dS(wx - .42, wy, wx + .42, wy + .72, front + .014, cellW);
            if (tier === 'low' || winKind === 'round') return;
            const yw = wy - y0, fz = front + .02, wc = '#ffffff';
            // 窗框四条边、十字窗棂
            bx(.5, .04, .06, wc, wx, yw + .655, fz); bx(.5, .045, .08, wc, wx, yw + .155, fz + .01); [-1, 1].forEach(sd => bx(.04, .5, .06, wc, wx + sd * .23, yw + .175, fz));
            bx(.026, .47, .035, wc, wx, yw + .19, fz); bx(.44, .026, .035, wc, wx, yw + .41, fz);
            if (winKind === 'shutter') [-1, 1].forEach(sd => {
              bx(.16, .5, .035, byY(A.shade(shut, .86), shut, 0, .5), wx + sd * .335, yw + .175, fz - .004);
              for (let k = 0; k < (tier === 'high' ? 7 : 4); k++) bx(.12, .022, .02, A.shade(shut, 1.16), wx + sd * .335, yw + .21 + k * (tier === 'high' ? .064 : .11), fz + .018);
            });
            // 花箱：一个小木箱，里面一排叶子和几朵花
            bx(.52, .11, .13, topSide('#6d4a2c', '#9a6a44'), wx, yw + .035, fz + .05);
            for (let k = 0; k < 5; k++) {
              const fx = wx - .2 + k * .1, fy = y0 + yw + .16 + (k % 2) * .02;
              ball(bag, .055, 1, fx, fy, fz + .05, { col: leafC('#2f7d2a', '#4c9a3f', '#7cc45a'), sy: .8, seed: k });
              ball(bag, .036, 1, fx + .01, fy + .055, fz + .075, { col: leafC(A.shade(['#ff6b9d', '#ffd54f', '#ffffff', '#ff6b9d', '#b388ff'][k], .86), ['#ff6b9d', '#ffd54f', '#ffffff', '#ff6b9d', '#b388ff'][k], '#ffffff'), seed: k + 9 });
            }
          };
          [x0 + .86, x1 - .86].forEach(wx => { if (!b.door || Math.abs(wx - (b.door.x + .5)) > .8) win3(wx); });
          if (w >= 7 && b.door) [cx - 1.1, cx + 1.1].forEach(wx => { if (Math.abs(wx - (b.door.x + .5)) > .8 && Math.abs(wx - x0 - .86) > .9 && Math.abs(wx - x1 + .86) > .9) win3(wx); });
        }
        // 招牌：REST STOP / SHOP / GYM，挂在门上面
        if (std || gym) {
          const label = L === 'C' ? 'REST STOP' : L === 'M' ? 'SHOP' : 'GYM', rc = new T3.Color(roofC), ink = rc.r * .2126 + rc.g * .7152 + rc.b * .0722 > .45 ? (P.trim || '#37474f') : roofC;
          const sc = atlasCell('sign:' + label + ink, 256, 64, g => {
            g.fillStyle = '#ffffff'; A.rr(g, 2, 2, 252, 60, 30); g.fill(); g.lineWidth = 5; g.strokeStyle = A.shade(ink, .7); g.stroke();
            g.fillStyle = ink; g.font = '800 ' + (label.length > 6 ? 40 : 46) + 'px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 144, 36, 180);
            if (L === 'C') { g.beginPath(); g.moveTo(22, 45); g.bezierCurveTo(7, 35, 10, 17, 22, 26); g.bezierCurveTo(34, 17, 37, 35, 22, 45); g.fill(); g.strokeStyle = ink; g.lineWidth = 4; g.lineCap = 'round'; [14, 21].forEach(r => { g.beginPath(); g.arc(27, 32, r, -.6, .6); g.stroke(); }); }
            if (gym) { g.fillStyle = '#ffc53d'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7 : 17; g.lineTo(39 + Math.cos(a) * r, 33 + Math.sin(a) * r); } g.fill(); }
          });
          const sw = Math.min(w - .6, 2.0), sh = sw / 4, sy = y0 + lift + 1.12 + sh / 2, sz = round ? cz + round + .04 : front + .03;
          dS(cx - sw / 2, sy - sh / 2, cx + sw / 2, sy + sh / 2, sz, sc);
        }
        // 休息站屋脊上的小钟架和金色的铃铛（回声站的记号）
        if (L === 'C' && !round) {
          const ty = top - .04;
          [-.22, .22].forEach(k => bx(.06, .5, .06, '#f4efe4', cx + k, ty, cz + .04)); bx(.58, .07, .1, A.shade(roofC, .8), cx, ty + .48, cz + .04);
          gp(new T3.LatheGeometry([[0, 0], [.16, 0], [.15, .04], [.11, .1], [.09, .18], [.065, .235], [.03, .26], [0, .265]].map(([px, py]) => new T3.Vector2(px, py)), 12), '#ffc93c', cx, ty + .19, cz + .04);
          top = ty + .56;
        }
        // 商店窗户上面的条纹雨棚
        if (L === 'M' && style === 'std') [x0 + .86, x1 - .86].forEach(ax => {
          if (b.door && Math.abs(ax - (b.door.x + .5)) <= .8) return;
          for (let k = 0; k < 4; k++) quad(bag, [ax - .52 + k * .26, y0 + wallH * .62, front + .42], [ax - .26 + k * .26, y0 + wallH * .62, front + .42], [ax - .26 + k * .26, y0 + wallH * .8, front + .02], [ax - .52 + k * .26, y0 + wallH * .8, front + .02], C(k % 2 ? '#ffffff' : roofC));
        });
        // 两个网格：上色的和贴画的，共用一个「淡掉多少」
        const fade = { value: 0 }, bm = paint(new T3.MeshToonMaterial({ gradientMap: rampTex, vertexColors: true, shadowSide: T3.DoubleSide }), { key: 'bld', occ: true, fade: true, floor: true, flag: .3, rim: .4 });
        bm.userData.u = { uFade: fade, uFadeY: { value: y0 + .15 }, uRect: { value: new Float32Array(fnd || [0, 0, -1, -1]) } };   // 圆房子没有方墙基：范围给个空的，不画地板
        const sg = bake(bag); own.push(sg, bm);
        const sMesh = still(add(new T3.Mesh(sg, bm), true));
        if (dq.p.length) {
          const dm = paint(new T3.MeshToonMaterial({ gradientMap: rampTex, map: tex, alphaTest: .5 }), { key: 'bldDecal', occ: true, fade: true, flag: .3 });
          dm.userData.u = { uFade: fade, uFadeY: bm.userData.u.uFadeY };
          const dg = new T3.BufferGeometry();
          dg.setAttribute('position', new T3.Float32BufferAttribute(dq.p, 3)); dg.setAttribute('normal', new T3.Float32BufferAttribute(dq.n, 3)); dg.setAttribute('uv', new T3.Float32BufferAttribute(dq.u, 2));
          own.push(dg, dm);
          still(add(new T3.Mesh(dg, dm), false));
        }
        BLD.push({ x0, x1, z0: back - .15, top: y0 + top, fade, cur: 0, mesh: sMesh });
      });
      function gearCell() {
        return atlasCell('gear', 64, 64, g => {
          g.fillStyle = '#b8862b'; g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.2832, r = k % 2 ? 26 : 31; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
          g.fillStyle = '#d9b25a'; A.circ(g, 32, 32, 19); g.fill(); g.fillStyle = '#8a6420'; A.circ(g, 32, 32, 8); g.fill();
        });
      }
      function clockCell() {
        return atlasCell('clock', 64, 64, g => {
          g.fillStyle = '#b8862b'; A.circ(g, 32, 32, 31); g.fill(); g.fillStyle = '#fffdf5'; A.circ(g, 32, 32, 26); g.fill();
          g.strokeStyle = '#37474f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 14); g.moveTo(32, 32); g.lineTo(44, 38); g.stroke();
          for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillStyle = '#37474f'; A.circ(g, 32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21, 1.8); g.fill(); }
        });
      }
    }
    function fadeBuildings(dt, px, py, pz) {
      const k = 1 - Math.exp(-dt * 8), tan = Math.tan(CAM.cur || CAM.dl), camZ = camera.position.z, mx = (px + camera.position.x) / 2;   // mx：镜头绕到旁边（说话）时视线中段在哪
      for (let i = 0; i < BLD.length; i++) {
        const b = BLD[i], want = b.z0 > pz - .1 && b.z0 < camZ - 1 && ((px > b.x0 - 1.7 && px < b.x1 + 1.7) || (mx > b.x0 - 1.2 && mx < b.x1 + 1.2)) && b.top > py + .3 + (b.z0 - pz) * tan - 1.1 ? 1 : 0;
        if (b.cur !== want) {
          b.cur += (want - b.cur) * k; if (Math.abs(b.cur - want) < .02) b.cur = want; b.fade.value = b.cur;
          const cast = b.cur < .5 && !!Q.shadow;   // 淡出去的房子影子也收掉（影子图重画一次）
          if (b.mesh.castShadow !== cast) { b.mesh.castShadow = cast; renderer.shadowMap.needsUpdate = true; }
        }
      }
    }
    let occH = null, cliffTop = null;   // occH：每格上面的岩壁顶有多高，镜头要从它上面看过去；cliffTop：岩壁这一格顶面的平均高度（顶上种灌木用）

    // ---------- 回声技能的障碍（小树、裂开的岩石、大石头）、机关门、地上的道具 ----------
    let obstM = [], bouldM = [], gateM = [], pickS = [];
    function buildMovables() {
      const L = LAND, P = PAL, rock = P.rock || '#a39b8b';
      obstM = []; bouldM = []; gateM = []; pickS = [];
      const mk = (bag, x, z, y) => { const g = bake(bag); own.push(g); const o = new T3.Mesh(g, propMat); o.position.set(x, y == null ? L.ground(x, z) : y, z); return add(o, true); };
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = m.grid[y][x];
        if (c === 'n') {
          const b = Bag(), dt = Math.max(1, Q.det - 1); trunkTo(b, [[0, 0, 0], [.02, .22, 0], [0, .42, 0]], .09, .06, tier === 'high' ? 10 : 6, C('#5f3a1e'), C('#7a4a26'));
          ball(b, .34, dt, 0, .62, 0, { sy: .9, lump: .12, col: leafC(A.shade(P.tree, .7), P.tree, P.treeHi), bc: [0, .5, 0], seed: x + y }); ball(b, .22, dt, .12, .9, .05, { lump: .12, col: leafC(P.tree, P.treeHi, A.shade(P.treeHi, 1.1)), bc: [0, .5, 0], seed: x * 3 + y });
          obstM.push({ g: mk(b, x + .5, y + .5), key: x + ',' + y });
        } else if (c === 'b') {
          const b = Bag(); ball(b, .4, Math.max(1, Q.det - 1), 0, .3, 0, { sx: 1.05, sy: .9, lump: .16, col: leafC(A.shade(rock, .7), A.shade(rock, .95), A.shade(rock, 1.1)), seed: x + y * 3 });
          box(b, .035, .4, .02, '#3d2d20', .03, .16, .37);
          obstM.push({ g: mk(b, x + .5, y + .5), key: x + ',' + y });
        } else if (c === '|') {
          const b = Bag(); [-.3, 0, .3].forEach(k => put(b, new T3.CylinderGeometry(.06, .06, 1.1, tier === 'high' ? 14 : 8).translate(0, .55, 0), '#8d6e63', k, 0, 0)); box(b, .9, .1, .12, '#5d4037', 0, 1.0, 0);
          const g = mk(b, x + .5, y + .5); gateM.push({ g, key: x + ',' + y, y0: g.position.y });
        }
      }
      (m.boulders || []).forEach(q => {
        const b = Bag(); ball(b, .46, Math.max(1, Q.det), 0, .42, 0, { sy: .92, lump: .07, col: leafC('#6f6f6f', '#9e9e9e', '#c4c4c4'), seed: q.x + q.y * 7 });
        bouldM.push(mk(b, q.x + .5, q.y + .5));
      });
      m.picks.forEach(p => {
        const o = new T3.Mesh(pickGeo, pickMat); o.position.set(p.x + .5, 0, p.y + .55);
        world.add(o); pickS.push({ p, o });
      });
    }

    // ---------- 人物：能用 3D 小人（people3d.js 的 EchoPeople3D）就用——主角、对手、村民、剧情里临时出现的人都是；
    //   没装那个文件、或者这个造型它不认（has() 说不行），就还是纸片：笔直立着、正对镜头。脚下的圆影子两种都一样（统一在 blobs 里画）。
    //   3D 小人的材质是这里给的（personMat）：和别的东西一样受云影、雾、影子，描边照旧；身体和脸必须是同一种材质，不然脸那一块看得出边 ----------
    const P3S = 1.06;   // 3D 小人放大多少：和纸片人一样高
    const personMat = (kind, p) => paint(kind === 'face' ? new T3.MeshToonMaterial({ gradientMap: personTex, map: p.map }) : new T3.MeshToonMaterial({ gradientMap: personTex, vertexColors: true }), { key: kind === 'face' ? 'person-face' : 'person', sprite: true, prim: .3 });   // 这两个材质归 people3d.js 管（它来放掉），不进 keep
    const headTop = s => (s.inst ? s.inst.height * P3S : 1.2);   // 头顶多高（头上的牌子放在它上面）
    const atlasCache = {}, spriteMats = {}, PERSON = 1.5;   // 人物纸片多大（一格 = 1）
    const sprites = new Map();   // 地图上的人 n → 纸片
    function spriteMat(key, tex) {
      if (spriteMats[key]) return spriteMats[key];
      return (spriteMats[key] = paint(new T3.MeshToonMaterial({ gradientMap: rampTex, map: tex, alphaTest: .5 }), { key: 'sprite', sprite: true }));
    }
    function lookMat(look) {
      const key = JSON.stringify(look);
      if (!atlasCache[key]) { const t = new T3.CanvasTexture(A.atlas(look, Q.cell)); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4; atlasCache[key] = t; }
      return spriteMat(key, atlasCache[key]);
    }
    function sheetGeo(size) {
      const g = new T3.PlaneGeometry(size, size).translate(0, size / 2, 0), n = g.attributes.normal;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);   // 法线朝上：和地面受一样的光（在树影里会跟着暗下来）
      return g;
    }
    function person(n) {
      const s = { n, root: new T3.Group(), key: '', frame: -1, dir: '', mesh: null, inst: null, lookRef: null, lx: null, lz: 0, spd: 0, rx: n ? n.x : 0, ry: n ? n.y : 0, alert: null, quest: null, tex: null, im: null };
      return s;
    }
    function dropMesh(s) {
      if (s.inst) { try { s.inst.dispose(); } catch (e) { /* 忽略 */ } s.inst = null; }
      s.lookRef = null;
      if (!s.mesh) return;
      s.root.remove(s.mesh); s.mesh.geometry.dispose();
      if (s.tex) { s.tex.dispose(); s.mesh.material.dispose(); s.tex = null; }
      s.mesh = null;
    }
    function setLook(s, look) {
      const key = JSON.stringify(look);
      if (s.key === key && (s.inst || s.mesh)) return;
      dropMesh(s);
      const P3 = window.EchoPeople3D;
      let inst = null;
      if (P3 && P3.has && P3.has(look)) { try { inst = P3.create(look, { mat: personMat, detail: tier === 'low' ? 'low' : 'high' }); } catch (e) { inst = null; } }
      if (inst) {
        inst.root.scale.setScalar(P3S);
        inst.body.receiveShadow = inst.face.receiveShadow = !!Q.shadow; inst.body.castShadow = inst.face.castShadow = false;   // 影子还是脚下那块圆的
        s.root.add(inst.root); s.inst = inst;
      } else {
        s.mesh = new T3.Mesh(sheetGeo(PERSON), lookMat(look)); s.mesh.receiveShadow = !!Q.shadow;
        s.root.add(s.mesh);
      }
      s.key = key; s.lookRef = look; s.frame = -1; s.dir = ''; s.lx = null; s.spd = 0;
    }
    // 3D 小人这一帧的动作。真的走了多快按位置算（每秒几格 ÷ 放大倍数），给对了踩着地的脚才不滑
    function animate3(s, dt, x, z, dir, moving, state, phase) {
      const v = s.lx == null || dt <= 0 ? 0 : Math.min(14, Math.hypot(x - s.lx, z - s.lz) / dt / P3S);
      s.lx = x; s.lz = z;
      s.spd += (v - s.spd) * (1 - Math.exp(-dt * 12));
      s.inst.set({ dir: dir || 'down', moving: moving == null ? s.spd > .45 : moving, speed: Math.max(s.spd, v), state: state || '', phase: phase == null ? null : phase });
      s.inst.tick(dt);
    }
    function setFrame(s, dir, frame) {
      if (!s.mesh) return;
      if (s.dir === dir && s.frame === frame) return;
      s.dir = dir; s.frame = frame;
      const col = DIRI[dir] || 0, u0 = col / 4, u1 = (col + 1) / 4, vt = 1 - frame / 3, vb = 1 - (frame + 1) / 3, uv = s.mesh.geometry.attributes.uv;
      uv.setXY(0, u0, vt); uv.setXY(1, u1, vt); uv.setXY(2, u0, vb); uv.setXY(3, u1, vb);
      uv.needsUpdate = true;
    }
    // 怪兽的 2D 图标做成纸片（剧情里站在地图上的野生怪兽；跟着走的怪兽模型没到之前也先用它）
    function iconSheet(s, sp, size) {
      const key = 'mon:' + sp.id, im = A.monImg(sp);
      if (s.key === key && s.im === im) return true;
      if (!im.complete || !im.naturalWidth) return !!s.mesh && s.key === key;
      const c = document.createElement('canvas'); c.width = c.height = Q.cell;
      c.getContext('2d').drawImage(im, 0, 0, Q.cell, Q.cell);
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
      dropMesh(s);
      s.mesh = new T3.Mesh(sheetGeo(size), paint(new T3.MeshToonMaterial({ gradientMap: rampTex, map: t, alphaTest: .5 }), { key: 'sprite', sprite: true }));
      s.mesh.receiveShadow = !!Q.shadow; s.tex = t; s.base = iconFace(c);
      s.root.add(s.mesh);
      s.key = key; s.im = im; s.frame = -1;
      return true;
    }
    // 原画里的怪兽朝哪边（1 朝右、-1 朝左、0 看不出来）：头（上面 40%）的重心比整只偏右就是朝右
    function iconFace(c) {
      try {
        const n = c.width, a = c.getContext('2d').getImageData(0, 0, n, n).data;
        let y0 = n, y1 = -1, x0 = n, x1 = -1;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (a[(y * n + x) * 4 + 3] > 128) { if (y < y0) y0 = y; y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
        if (y1 < 0) return 0;
        const yh = y0 + (y1 - y0) * .4;
        let sx = 0, sn = 0, hx = 0, hn = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (a[(y * n + x) * 4 + 3] > 128) { sx += x; sn++; if (y < yh) { hx += x; hn++; } }
        const v = (hx / Math.max(1, hn) - sx / Math.max(1, sn)) / (x1 - x0 + 1);
        return v > .02 ? 1 : v < -.02 ? -1 : 0;
      } catch (e) { return 0; }
    }
    const blobMat = new T3.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
    const blobGeo = new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const blobs = new T3.InstancedMesh(blobGeo, blobMat, 96);
    blobs.frustumCulled = false; blobs.renderOrder = 1; blobs.matrixAutoUpdate = false;
    keep.push(blobMat, blobGeo, blobs);
    const _m4 = new T3.Matrix4();
    let nBlob = 0;
    function blobAt(x, y, z, sx, sz) { if (nBlob >= 96) return; _m4.makeScale(sx, 1, sz); _m4.setPosition(x, y + .035, z); blobs.setMatrixAt(nBlob++, _m4); }
    // 头顶上的牌子：按 A 的红圈、训练师的「!」、委托的金色「?」
    const bubGeo = new T3.PlaneGeometry(.5, .5);
    keep.push(bubGeo);
    function bubbleMat(ch, col, fill) {
      const t = canvasTex(64, 64, g => {
        g.fillStyle = 'rgba(0,0,0,.2)'; A.circ(g, 33, 35, 24); g.fill();
        g.fillStyle = fill || '#ffffff'; A.circ(g, 32, 32, 24); g.fill(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
        g.fillStyle = col; g.font = '900 30px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 34);
      });
      const mt = new T3.MeshBasicMaterial({ map: t, transparent: true, depthTest: false });
      keep.push(t, mt);
      return mt;
    }
    const hintMat = bubbleMat('A', '#e53935'), alertMat = bubbleMat('!', '#e53935'), questMat = bubbleMat('?', '#6d4300', '#ffc233');
    const bubble = mt => { const o = new T3.Mesh(bubGeo, mt); o.renderOrder = 10; return o; };
    const hintS = bubble(hintMat);
    const pickGeo = sheetGeo(.46), pickTex = canvasTex(64, 64, g => A.drawPickup(g, 32, 34, 22));
    const pickMat = spriteMat('pick', pickTex);
    keep.push(pickGeo, pickTex);
    const player = person(null);
    // 自行车、踏浪时脚下的水圈、回声探测器让藏着的道具一闪一闪的亮点
    const bike = (() => {
      const g = new T3.Group(), wm = new T3.MeshLambertMaterial({ color: '#37474f' }), fm = new T3.MeshLambertMaterial({ color: '#e53935' }), tg = new T3.TorusGeometry(.17, .03, 6, 16), fg = new T3.BoxGeometry(.05, .05, .5), hg = new T3.BoxGeometry(.32, .04, .04);
      [-1, 1].forEach(k => { const w = new T3.Mesh(tg, wm); w.position.set(0, .18, k * .24); w.rotation.y = Math.PI / 2; g.add(w); });
      const f = new T3.Mesh(fg, fm); f.position.set(0, .3, 0); g.add(f);
      const h = new T3.Mesh(hg, wm); h.position.set(0, .45, .2); g.add(h);
      keep.push(wm, fm, tg, fg, hg);
      return g;
    })();
    const ripple = new T3.Mesh(new T3.TorusGeometry(.5, .04, 6, 28), new T3.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .75 }));
    ripple.rotation.x = Math.PI / 2;
    const sparkTex = canvasTex(32, 32, g => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(.4, 'rgba(255,240,150,.8)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    const sparkMat = new T3.MeshBasicMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending }), sparkGeo = new T3.PlaneGeometry(.55, .55);
    const sparkS = [0, 1, 2, 3].map(() => { const sp = new T3.Mesh(sparkGeo, sparkMat.clone()); sp.visible = false; keep.push(sp.material); return sp; });
    keep.push(ripple.geometry, ripple.material, sparkTex, sparkMat, sparkGeo);

    // ---------- 跟着走的怪兽：用会动的模型（走路 / 待机，朝着走的方向，转身是慢慢转过去的）；模型没有或者还没下载好就用纸片图标 ----------
    const fol = { root: new T3.Group(), key: '', R: null, icon: person(null), yaw: 0, lx: 0, lz: 0, still: 0, mode: '', want: null };
    fol.root.add(fol.icon.root);
    function folDrop() {
      if (fol.R) { fol.root.remove(fol.R.root); try { window.Mon3D.dispose(fol.R); } catch (e) { /* 忽略 */ } fol.R = null; }
    }
    function folSet(sp) {
      const M3 = window.Mon3D, key = sp ? sp.id : '';
      if (fol.key !== key) {
        folDrop(); fol.key = key; fol.mode = '';
        if (sp && M3 && M3.preload) M3.preload([sp]);   // 后台下载；到了下面就换上
      }
      if (!sp) return;
      if (!fol.R && M3 && M3.hasModel && M3.hasModel(sp) && M3.isLoaded(sp)) {
        let R = null;
        try { R = M3.build(sp); } catch (e) { R = null; }
        if (R && R.rig) {
          // 大小：第一阶大约到主角腰上面一点，最大的也不比主角高太多
          const tall = clamp(R.height * .74, .58, 1.45);
          R.root.scale.multiplyScalar(tall / R.height);
          R.root.traverse(o => { if (o.isMesh) { o.receiveShadow = !!Q.shadow; o.castShadow = false; } });
          fol.root.add(R.root); fol.R = R; fol.tall = tall; fol.mode = '';
        } else if (R) { try { M3.dispose(R); } catch (e) { /* 忽略 */ } }
      }
      fol.icon.root.visible = !fol.R;
      if (!fol.R) iconSheet(fol.icon, sp, 1.0);
    }

    // ---------- 天：头顶是深一些的蓝，往下越来越浅，贴着地平线一条暖白；太阳在左前方（画面左上角亮一片）；几朵又大又软的积云慢慢飘；隔着海的远岛和远山 ----------
    const skyMat = new T3.ShaderMaterial({
      uniforms: { uZen: { value: C('#2877dc') }, uMid: { value: C('#5fb3f1') }, uLow: { value: C('#b9e1f7') }, uHaze: U.uHaze, uSunD: { value: new T3.Vector3(-.5, .42, -.76).normalize() } },
      vertexShader: 'varying vec3 vDir; void main(){ vec3 dv = vec3(position.x / projectionMatrix[0][0], position.y / projectionMatrix[1][1], -1.0); vDir = transpose(mat3(viewMatrix)) * dv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uHaze; uniform vec3 uSunD; varying vec3 vDir;\nvoid main(){ vec3 d = normalize(vDir); float e = d.y; vec3 c = mix(uHaze, uLow, smoothstep(-0.01, 0.055, e)); c = mix(c, uMid, smoothstep(0.035, 0.17, e)); c = mix(c, uZen, smoothstep(0.12, 0.38, e)); float sg = max(dot(d, uSunD), 0.0); c += vec3(1.0, 0.8, 0.52) * (pow(sg, 3.0) * 0.2 + pow(sg, 20.0) * 0.5); gl_FragColor = vec4(c, ' + (Q.post ? '0.0' : '1.0') + ');\n#include <colorspace_fragment>\n}',
      depthTest: false, depthWrite: false,
    });
    const sky = new T3.Mesh(new T3.PlaneGeometry(2, 2), skyMat);
    sky.frustumCulled = false; sky.renderOrder = -100; sky.matrixAutoUpdate = false;
    keep.push(skyMat, sky.geometry);
    // 云：四种样子画在一张图上。一堆边缘是虚的圆叠成一大团（上面再堆一层，像往上长的积云），底是平的；顶上受光是暖白，往下是蓝紫灰的底
    const cloudTex = (() => {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
      const g = cv.getContext('2d');
      for (let v = 0; v < 4; v++) {
        const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 256;
        const q = c2.getContext('2d'), base = 204, puffs = [], n = 8 + v * 2, n2 = 3 + v;
        for (let k = 0; k < n; k++) { const t = k / (n - 1), x = 78 + t * 356 + (hash2(k, v + 20) - .5) * 24, r = 24 + 58 * Math.sin(Math.PI * (.08 + .84 * t)) * (.62 + hash2(k + 9, v + 20) * .46); puffs.push([x, base - r * .74, r]); }
        for (let k = 0; k < n2; k++) { const t = (k + .5) / n2, x = 160 + t * 190 + (hash2(k, v + 40) - .5) * 30, r = 34 + 30 * hash2(k + 5, v + 40); puffs.push([x, base - 84 - 36 * Math.sin(Math.PI * t) - r * .2, r]); }
        puffs.forEach(([x, y, r]) => { const gr = q.createRadialGradient(x, y, r * .58, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.beginPath(); q.arc(x, y, r, 0, 6.283); q.fill(); });
        q.fillStyle = '#fff'; q.fillRect(78, base - 34, 356, 30);
        // 平底：底线下面擦掉，留一点点虚边
        q.globalCompositeOperation = 'destination-out';
        const cut = q.createLinearGradient(0, base - 9, 0, base + 5); cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)'); q.fillStyle = cut; q.fillRect(0, base - 9, 512, 70);
        q.globalCompositeOperation = 'source-atop';
        const gr = q.createLinearGradient(0, 20, 0, base); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.42, '#fdfbff'); gr.addColorStop(.72, '#dadff6'); gr.addColorStop(1, '#a3aedb');
        q.fillStyle = gr; q.fillRect(0, 0, 512, 256);
        puffs.forEach(([x, y, r], k) => {
          const g2 = q.createRadialGradient(x + r * .28, y + r * .5, r * .15, x + r * .1, y + r * .25, r * 1.05); g2.addColorStop(0, 'rgba(150,166,214,.42)'); g2.addColorStop(1, 'rgba(150,166,214,0)'); q.fillStyle = g2; q.beginPath(); q.arc(x, y, r, 0, 6.283); q.fill();
          const g3 = q.createRadialGradient(x - r * .3, y - r * .4, 0, x - r * .3, y - r * .4, r * .85); g3.addColorStop(0, 'rgba(255,253,244,.96)'); g3.addColorStop(1, 'rgba(255,253,244,0)'); q.fillStyle = g3; q.beginPath(); q.arc(x, y, r, 0, 6.283); q.fill();
        });
        g.drawImage(c2, (v % 2) * 512, Math.floor(v / 2) * 256);
      }
      // 透明的地方颜色填成白的（不然云的虚边会糊出一圈灰）
      const d = g.getImageData(0, 0, 1024, 512).data;
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3]; if (a < 255) { const b = 255 - a; d[i] = (d[i] * a + 250 * b) / 255; d[i + 1] = (d[i + 1] * a + 250 * b) / 255; d[i + 2] = (d[i + 2] * a + 255 * b) / 255; } }
      const t = new T3.DataTexture(new Uint8Array(d.buffer), 1024, 512);
      t.colorSpace = T3.SRGBColorSpace; t.magFilter = T3.LinearFilter; t.minFilter = T3.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      return t;
    })();
    const cloudMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMap: { value: cloudTex }, uHaze: U.uHaze },
      vertexShader: 'attribute vec4 aCell; attribute vec2 aDrift; uniform highp float uTime; varying vec2 vUv; varying float vE; varying float vEl;\nvoid main(){ vUv = aCell.xy + vec2(uv.x, 1.0 - uv.y) * aCell.zw; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); float hw = 520.0; float x = mod(w.x + aDrift.x + uTime * aDrift.y + hw, hw * 2.0) - hw; vE = 1.0 - smoothstep(hw * 0.72, hw * 0.98, abs(x)); w.x = x + cameraPosition.x * 0.9; vec3 d = w.xyz - cameraPosition; vEl = d.y / length(d); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D uMap; uniform vec3 uHaze; varying vec2 vUv; varying float vE; varying float vEl;\nvoid main(){ vec4 t = texture2D(uMap, vUv); vec3 c = mix(uHaze, t.rgb, 0.4 + 0.6 * smoothstep(0.0, 0.1, vEl)); gl_FragColor = vec4(c, t.a * vE * (0.5 + 0.5 * smoothstep(0.0, 0.06, vEl)));\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    const cloudGeo = new T3.PlaneGeometry(1, 1);
    const clouds = (() => {
      const n = Q.clouds, im = new T3.InstancedMesh(cloudGeo, cloudMat, n), cell = new Float32Array(n * 4), drift = new Float32Array(n * 2), o = new T3.Object3D();
      for (let i = 0; i < n; i++) {
        const r = hash2(i, 71), r2 = hash2(i, 72), r3 = hash2(i, 73), dist = 200 + r * 130, w = dist * (.3 + r2 * .2);
        o.position.set(0, dist * (.062 + r3 * .1), -dist); o.scale.set(w, w * .5, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
        const v = i % 4; cell.set([(v % 2) * .5, Math.floor(v / 2) * .5, .5, .5], i * 4);
        drift.set([(i / n + r * .1) * 1040, 1.5 + r2 * 1.6], i * 2);
      }
      cloudGeo.setAttribute('aCell', new T3.InstancedBufferAttribute(cell, 4)); cloudGeo.setAttribute('aDrift', new T3.InstancedBufferAttribute(drift, 2));
      im.frustumCulled = false; im.renderOrder = -50; im.matrixAutoUpdate = false;
      return im;
    })();
    keep.push(cloudTex, cloudMat, cloudGeo, clouds);
    const farMat = toon({ gradientMap: softTex }, { key: 'far', flag: 0, cloud: 0 });
    let farIsles = null;
    // 每座岛望出去看到什么（镜头一直朝北，看得到的是北边和两边）：
    //   north：正北那座（下一座岛：路就是往那边去的）[第几岛, 样子]；side：一边远一点的（上一座岛，或者地图上另一个邻居）；own：近一点的岬角上，本岛自己的地标；mtn：最远的大山什么样
    //   第 0 岛（你好岛）照原样（家长看过、喜欢）：正北灯标塔岛、一边尖岛、另一边大山
    // 邻居都按 WORLD.md 的地图网：0 → 1 → 2 → 3 → 4 →（渡轮）5 → 6 →（钟山）7 →（8 号水路）8 →（9 号水路）9 →（海底隧道）10 →（冰洞）11 →（瀑布）12 →（勇气之路）冠军高原
    const FAR_CFG = {
      0: { classic: true },
      1: { north: [2, 'windmill'], side: [0, 'beacon'], own: 'pencils', mtn: 'pastel' },
      2: { north: [3, 'clocktower'], side: [1, 'pencils'], own: 'windmill', mtn: 'hills' },
      3: { north: [4, 'observatory'], side: [2, 'windmill'], own: 'books', mtn: 'classic' },
      4: { north: [5, 'bigtop'], side: [3, 'books'], own: 'observatory', mtn: 'classic' },
      5: { north: [6, 'volcano'], side: [4, 'observatory'], own: 'bigtop', mtn: 'mesa' },
      6: { north: [7, 'balloons'], side: [5, 'bigtop'], own: 'volcano', mtn: 'none' },
      7: { north: [8, 'bigtree'], side: [6, 'volcano'], own: 'balloons', mtn: 'pastel' },
      8: { north: [9, 'skyline'], side: [7, 'balloons'], own: 'bigtree', mtn: 'misty' },
      9: { north: [10, 'stadium'], side: [8, 'bigtree'], own: 'skyline', mtn: 'classic' },
      10: { north: [11, 'snowpeak'], side: [9, 'skyline'], own: 'stadium', mtn: 'snow' },
      11: { north: [12, 'temple'], side: [10, 'stadium'], own: 'snowpeak', mtn: 'snow' },
      12: { north: [13, 'arena'], side: [11, 'snowpeak'], own: 'temple', mtn: 'misty' },
      league: { north: [13, 'arena'], side: [12, 'temple'], own: 'temple', mtn: 'classic' },
    };
    function buildFar() {
      // 远景（都隔着海，被空气染成淡蓝）：正北一座岛上立着下一座岛的地标——路就是往那边去的；一边近一点的岬角上是本岛自己的地标，另一边远一点是上一座岛；
      // 最远的地方一座淡在雾气里的大山（每座岛的山不一样：雪山、平顶的红岩山、软软的小丘……）；两头再散着几座小岛
      const bag = Bag(), P = PAL, sea = LAND.SEA - .15, seed = String(m.id || '').length * 31 + (m.z || 0) * 7 + 3, cxm = m.W / 2, FAR = Q.far, lowT = tier === 'low', sg = lowT ? 8 : 16;
      const h = k => hash2(k, seed), side = h(1) > .5 ? 1 : -1;
      const cfg = FAR_CFG[String(m.id || '')[0] === 'v' ? 'league' : clamp(m.isle | 0, 0, 12)] || FAR_CFG[0];
      INFO.far = cfg.classic ? { north: 'beacon', own: '', side: 'peak' } : { north: cfg.north[1], own: cfg.own, side: cfg.side[1], mtn: cfg.mtn };
      // 一座岛的地面颜色：按那座岛自己的配色（雪岛白、沙丘岛黄……）
      const palOf = z => (z === 13 ? (EchoMaps.THEMES.lab || {}).pal : z === (m.isle | 0) ? P : window.EchoMaps && EchoMaps.palFor ? EchoMaps.palFor(z) : P) || P;
      const landColOf = pp => {
        const green = mixC(pp.tree, pp.grass, .45), sandC = mixC(pp.sand, '#e9dcc0', .3), rockC = mixC(pp.rock || '#a39b8b', '#8d93ad', .45);
        return (out, nx, ny, nz, px, py) => { out.copy(sandC).lerp(green, sstep(.25, 1.1, py)); if (ny < .55) out.lerp(rockC, sstep(.55, .3, ny) * .7); };
      };
      const green = mixC(P.tree, P.grass, .45), rockC = mixC(P.rock || '#a39b8b', '#8d93ad', .45), paleC = C('#dfe5f0');
      const landCol = landColOf(P);
      // 一座山 / 岛：从中心往外按一条剖面线降下去（prof(半径 0…1, 角度) → 高度 0…1），边缘按噪声进进出出；sq 把它在南北方向压扁
      const mount = (x, z, R, Hh, prof, sd2, sq, col) => {
        const nr = lowT ? 7 : 13, ns = lowT ? 14 : 30, pos = [], idx = [];
        for (let i = 0; i <= nr; i++) for (let j = 0; j < ns; j++) {
          const rr = i / nr, a = j / ns * 6.2832, wob = .76 + .48 * vnoise(Math.cos(a) * 1.4 + sd2, Math.sin(a) * 1.4 + sd2 * 1.7);
          pos.push(Math.cos(a) * R * rr * wob, i === nr ? -.8 : Hh * prof(rr, a), Math.sin(a) * R * rr * wob * (sq || 1));
        }
        for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) { const a = i * ns + j, b = i * ns + (j + 1) % ns, c = a + ns, d = b + ns; idx.push(a, b, c, b, d, c); }
        const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        put(bag, g, col || landCol, x, sea, z);
      };
      const dome = rr => (1 - rr * rr) * .85 + .15 * (1 - rr);
      const ridge = (rr, a, sd2) => { const v = vnoise(Math.cos(a) * 2.3 * (.35 + rr) + sd2 * 1.3, Math.sin(a) * 2.3 * (.35 + rr) + sd2); return 1 - Math.abs(2 * v - 1); };
      const crag = sd2 => (rr, a) => (.42 * (1 - sstep(0, .9, rr)) + .58 * Math.pow(1 - rr, 2.1)) * (.74 + .5 * ridge(rr, a, sd2) * Math.min(1, rr * 3)), peak = crag(seed * .37 + 2);
      const mesa = rr => (1 - sstep(.55, .78, rr)) * .9 + .1 * (1 - rr);   // 平顶、陡边
      const d0 = Q.skirt + 56;
      // 正北：出口对着的方向（没有往北的出口就在地图正中的北边）
      let xN = 0, nN = 0;
      for (let x = 0; x < m.W; x++) if (EXITS.includes(m.grid[0][x])) { xN += x + .5; nN++; }
      const bx = nN ? xN / nN + 2 : cxm + (h(2) - .5) * 16, bz = -d0 - 8;
      const part = (g, col, x, y, z) => put(bag, g, col, x, y, z);
      const cyl = (r0, r1, hh, col, x, y, z, n) => part(new T3.CylinderGeometry(r1, r0, hh, n || sg).translate(0, hh / 2, 0), col, x, y, z);
      // ---- 各种地标（都站在 (x, y, z)，s 是大小）----
      const LM = {
        // 灯标塔：往上收的白塔身、一道珊瑚色的腰线、一圈挑出去的平台、发亮的灯室、小尖顶；旁边几间白墙红瓦的小房子
        beacon(x, y, z, s) {
          const wht = byY('#d9dce6', '#fffaf0', 0, 10 * s);
          part(new T3.CylinderGeometry(.95 * s, 1.55 * s, 9.6 * s, sg).translate(0, 4.8 * s, 0), wht, x, y, z);
          part(new T3.CylinderGeometry(1.2 * s, 1.26 * s, 1.1 * s, sg).translate(0, 5.6 * s, 0), '#ef7d62', x, y, z);
          part(new T3.CylinderGeometry(1.75 * s, 1.45 * s, .36 * s, sg).translate(0, 9.7 * s, 0), '#5d6a7c', x, y, z);
          part(new T3.CylinderGeometry(.82 * s, .82 * s, 1.5 * s, sg).translate(0, 10.6 * s, 0), '#fff3a6', x, y, z);
          part(new T3.ConeGeometry(1.25 * s, 1.5 * s, sg).translate(0, 12.1 * s, 0), '#3f7f86', x, y, z);
          part(new T3.CylinderGeometry(.06 * s, .06 * s, 1.6 * s, 5).translate(0, 13.5 * s, 0), '#5d6a7c', x, y, z);
          [[-7, 1.5, 0], [-10.5, 1.2, 1.4], [9, 1.3, .6]].forEach(([ox, hh, oz], k) => { box(bag, 2.2 * s, hh * s, 1.6 * s, '#f4efe4', x + ox * s, y - 1.2 * s, z + oz * s); part(new T3.ConeGeometry(1.75 * s, 1.1 * s, 4).rotateY(Math.PI / 4).scale(1, 1, .8).translate(0, (hh + .55) * s, 0), k % 2 ? '#e0714e' : '#d9643a', x + ox * s, y - 1.2 * s, z + oz * s); });
        },
        // 一丛竖着的大彩色铅笔（彩色文具岛）：六棱的笔杆、削出来的木头尖、和笔杆一样颜色的笔芯
        pencils(x, y, z, s) {
          const cols = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da'];
          for (let k = 0; k < 7; k++) {
            const a = k * 2.4 + .3, r = k ? (2.2 + (k % 3) * 1.4) * s : 0, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * .6, hh = (k ? 6 + hash2(k, 9) * 6 : 13) * s, w = (k ? .9 + hash2(k, 8) * .3 : 1.3) * s, c = cols[k % cols.length];
            part(new T3.CylinderGeometry(w, w, hh, 6).translate(0, hh / 2, 0), byY(A.shade(c, .8), c, 0, hh), px, y - 1, pz);
            part(new T3.ConeGeometry(w, w * 1.9, 6).translate(0, hh + w * .95, 0), '#f3d2a0', px, y - 1, pz);
            part(new T3.ConeGeometry(w * .36, w * .7, 6).translate(0, hh + w * 1.55, 0), c, px, y - 1, pz);
          }
        },
        // 大风车（家庭岛）：往上收的八角塔身、尖顶、四片扇叶；旁边一座红色的谷仓
        windmill(x, y, z, s) {
          cyl(1.9 * s, 1.25 * s, 7 * s, byY('#e8dcc4', '#fff8ea', 0, 7 * s), x, y - .5, z, 8);
          part(new T3.ConeGeometry(1.7 * s, 2.2 * s, 8).translate(0, 7.6 * s, 0), '#9a6a48', x, y - .5, z);
          for (let k = 0; k < 4; k++) part(new T3.BoxGeometry(.9 * s, 5.4 * s, .15 * s).translate(0, 2.9 * s, 0).rotateZ(k * Math.PI / 2 + .4), '#f6efe0', x, y + 5.4 * s, z + 1.6 * s);
          box(bag, 4 * s, 2.6 * s, 3 * s, '#c0503e', x + 5.5 * s, y - .5, z + 1 * s);
          part(new T3.CylinderGeometry(1.6 * s, 1.6 * s, 4.2 * s, 3).rotateZ(Math.PI / 2).scale(1, .8, 1.05).translate(0, 2.6 * s, 0), '#8a3f30', x + 5.5 * s, y - .5, z + 1 * s);
        },
        // 红砖钟楼（校园岛）：方塔、白色的檐、四面的钟、尖顶；旁边一栋长长的教学楼
        clocktower(x, y, z, s) {
          box(bag, 2.6 * s, 10 * s, 2.6 * s, byY('#9c4434', '#c0604a', 0, 10 * s), x, y - .5, z);
          box(bag, 3 * s, .35 * s, 3 * s, '#f3ece0', x, y - .5 + 8.2 * s, z);
          part(new T3.CylinderGeometry(.85 * s, .85 * s, .2 * s, sg).rotateX(Math.PI / 2), '#fffdf5', x, y - .5 + 9.1 * s, z + 1.38 * s);
          part(new T3.ConeGeometry(2.1 * s, 2.6 * s, 4).rotateY(Math.PI / 4).translate(0, 1.3 * s, 0), '#5d4037', x, y - .5 + 10 * s, z);
          box(bag, 9 * s, 3.6 * s, 3 * s, byY('#a84a38', '#c4644e', 0, 3.6 * s), x - 6.5 * s, y - .5, z + 1 * s);
          box(bag, 9.2 * s, .3 * s, 3.2 * s, '#efe6d6', x - 6.5 * s, y - .5 + 3.6 * s, z + 1 * s);
        },
        // 书山（校园岛）：一摞歪歪的大书，书脊各种颜色，书页是一道道米白
        books(x, y, z, s) {
          const cols = ['#c0504d', '#3f74b6', '#5f9e4a', '#e3a92f', '#7b5aa6', '#d0603a', '#2f8f8a'];
          let yy = y - 1;
          for (let k = 0; k < 8; k++) {
            const w = (9 - k * .8) * s, d = (6 - k * .45) * s, th = (1.2 + hash2(k, 3) * .7) * s, rot = (hash2(k, 4) - .5) * .5, ox = (hash2(k, 5) - .5) * 1.2 * s, c = cols[k % cols.length];
            part(new T3.BoxGeometry(w, th, d).rotateY(rot).translate(0, th / 2, 0), c, x + ox, yy, z);
            part(new T3.BoxGeometry(w - .3 * s, th * .78, d + .08 * s).rotateY(rot).translate(.2 * s, th / 2, 0), '#f4ecd8', x + ox, yy, z);
            yy += th;
          }
        },
        // 天文台（学科岛）：白色的圆塔、玻璃圆顶上一道开缝，旁边一面朝天的大锅（卫星天线）
        observatory(x, y, z, s) {
          cyl(2.6 * s, 2.5 * s, 3.4 * s, byY('#dfe6ea', '#ffffff', 0, 3.4 * s), x, y - .5, z);
          part(new T3.SphereGeometry(2.6 * s, sg, 8, 0, 6.2832, 0, Math.PI / 2), leafC('#7fb2d8', '#bfe3f7', '#ffffff'), x, y - .5 + 3.4 * s, z);
          box(bag, .7 * s, 2.4 * s, .3 * s, '#3a4a5a', x, y - .5 + 3.6 * s, z + 2.3 * s);
          cyl(.25 * s, .2 * s, 3 * s, '#cfd8dc', x + 5 * s, y - .5, z + .5 * s, 8);
          part(new T3.SphereGeometry(2.2 * s, sg, 6, 0, 6.2832, 0, Math.PI * .32).rotateX(-.7).scale(1, .7, 1), '#f2f5f7', x + 5 * s, y - .5 + 3.4 * s, z + .5 * s);
        },
        // 马戏大帐篷（社团岛）：红白条纹的圆帐篷、尖顶、顶上一面黄旗；旁边一座小的
        bigtop(x, y, z, s) {
          [[0, 0, 1, '#e53935'], [-7, 1.5, .55, '#1e88e5']].forEach(([ox, oz, k, c]) => {
            const R = 5 * s * k, wh = 2.6 * s * k, n = 16;
            for (let i = 0; i < n; i++) {
              const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, cc = C(i % 2 ? '#ffffff' : c), p0 = [x + ox * s + Math.cos(a0) * R, y - .5, z + oz * s + Math.sin(a0) * R], p1 = [x + ox * s + Math.cos(a1) * R, y - .5, z + oz * s + Math.sin(a1) * R];
              quad(bag, p1, p0, [p0[0], p0[1] + wh, p0[2]], [p1[0], p1[1] + wh, p1[2]], cc);
              tri(bag, [x + ox * s + Math.cos(a1) * R * 1.1, y - .5 + wh, z + oz * s + Math.sin(a1) * R * 1.1], [x + ox * s + Math.cos(a0) * R * 1.1, y - .5 + wh, z + oz * s + Math.sin(a0) * R * 1.1], [x + ox * s, y - .5 + wh + 4.2 * s * k, z + oz * s], cc);
            }
            box(bag, .12 * s, 1.6 * s * k, .12 * s, '#6d4121', x + ox * s, y - .5 + wh + 4 * s * k, z + oz * s);
            box(bag, 1.1 * s * k, .6 * s * k, .06, '#ffca28', x + ox * s + .55 * s * k, y - .5 + wh + 5 * s * k, z + oz * s);
          });
        },
        // 钟山（作息岛的火山）：山口冒着白烟，朝南的山坡上嵌着一面大钟
        volcano(x, y, z, s) {
          const R = 16 * s, Hh = 11 * s, vc = (out, nx, ny, nz, px, py) => { out.set('#7a6a60').lerp(C('#4f4440'), sstep(Hh * .3, Hh * .8, py)); if (py < Hh * .25) out.lerp(green, 1 - sstep(0, Hh * .25, py)); };
          mount(x, z, R, Hh, rr => (rr < .16 ? .82 + rr * 1.1 : (1 - sstep(.16, 1, rr)) * .99 + .01), seed + 21, .8, vc);
          // 山口边上一座石头钟塔，大钟朝南
          const tx = x - 3 * s, ty = sea + Hh * .84, tz = z + 2.6 * s;
          box(bag, 3 * s, 5 * s, 2.6 * s, byY('#6e625a', '#9a8a7c', 0, 5 * s), tx, ty, tz); part(new T3.ConeGeometry(2.4 * s, 2 * s, 4).rotateY(Math.PI / 4).translate(0, 1 * s, 0), '#4f9e8a', tx, ty + 5 * s, tz);
          part(new T3.CylinderGeometry(1.1 * s, 1.1 * s, .2 * s, sg).rotateX(Math.PI / 2), '#fff8e6', tx, ty + 3.3 * s, tz + 1.35 * s);
          part(new T3.TorusGeometry(1.1 * s, .16 * s, 6, sg), '#c7962f', tx, ty + 3.3 * s, tz + 1.4 * s);
          // 白烟：一团团往上、往一边飘，越高越大越淡（雾会把它们化开）
          for (let k = 0; k < 6; k++) part(new T3.IcosahedronGeometry((1.6 + k * .55) * s, lowT ? 1 : 2), '#f2f0ee', x + k * 1.6 * s, sea + Hh + (1.4 + k * 2.1) * s, z - k * .5 * s);
        },
        // 生日派对岛：一座三层的大蛋糕，上面插着蜡烛；天上飘着一串气球
        balloons(x, y, z, s) {
          [[4.2, 2.2, '#fff4e0'], [3.1, 2, '#ffd6e2'], [2, 1.8, '#fff4e0']].reduce((yy, [r, hh, c]) => { cyl(r * s, r * s, hh * s, c, x, yy, z); part(new T3.TorusGeometry(r * s, .25 * s, 6, sg).rotateX(Math.PI / 2), '#ff8fb1', x, yy + hh * s, z); return yy + hh * s; }, y - .5);
          for (let k = 0; k < 5; k++) { const a = k / 5 * 6.2832; box(bag, .2 * s, 1 * s, .2 * s, '#fffdf5', x + Math.cos(a) * 1.2 * s, y - .5 + 6 * s, z + Math.sin(a) * 1.2 * s); }
          const bc = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#ff80ab', '#ab47bc', '#ff7043'];
          for (let k = 0; k < 9; k++) { const bx2 = x + (6 + (k % 3) * 1.9 + hash2(k, 1) * .8) * s, by2 = y + (8 + Math.floor(k / 3) * 2 + hash2(k, 2) * 1.2) * s, bz2 = z + (hash2(k, 3) - .5) * 2 * s; part(new T3.SphereGeometry(1 * s, 10, 8).scale(1, 1.2, 1), bc[k % bc.length], bx2, by2, bz2); }
        },
        // 动物岛：一棵比整座岛还高的大树，伞一样的树冠
        bigtree(x, y, z, s) {
          cyl(1.6 * s, .9 * s, 12 * s, byY('#5d4128', '#7a5634', 0, 12 * s), x, y - 1, z, 10);
          const lc = leafC(A.shade('#2e7d32', .7), '#3f8f3a', '#7cc45a');
          [[0, 12, 0, 6], [-4.5, 10.5, 1, 4.2], [4.6, 10.8, -.5, 4.4], [-1.5, 14.5, -.5, 4], [2.5, 14, 1, 3.6]].forEach(([ox, oy, oz, r], k) => ball(bag, r * s, lowT ? 1 : 2, x + ox * s, y + oy * s, z + oz * s, { sy: .62, lump: .18, col: lc, seed: k }));
        },
        // 规则城：一片高楼，中间一座细高的电视塔
        skyline(x, y, z, s) {
          for (let k = 0; k < 12; k++) {
            const ox = (k - 5.5) * 2.3 * s + (hash2(k, 1) - .5) * s, oz = (hash2(k, 2) - .5) * 3 * s, hh = (5 + hash2(k, 3) * 12 + (Math.abs(k - 6) < 3 ? 5 : 0)) * s, w = (1.6 + hash2(k, 4) * .9) * s;
            box(bag, w, hh, w, byY('#7d8fa0', k % 3 ? '#cdd8e2' : '#b7c9d8', 0, hh), x + ox, y - 1, z + oz);
          }
          cyl(.5 * s, .3 * s, 24 * s, '#dfe6ea', x + 1 * s, y - 1, z - 1 * s, 8);
          part(new T3.SphereGeometry(1.3 * s, 10, 8).scale(1, .7, 1), '#cfd8dc', x + 1 * s, y - 1 + 18 * s, z - 1 * s);
        },
        // 运动美食岛：一座圆形的体育场，四根灯塔
        stadium(x, y, z, s) {
          const R = 7 * s;
          part(new T3.CylinderGeometry(R, R * 1.05, 3.6 * s, lowT ? 16 : 28, 1, true).translate(0, 1.8 * s, 0), byY('#cfd8dc', '#ffffff', 0, 3.6 * s), x, y - .5, z);
          part(new T3.TorusGeometry(R, .45 * s, 6, lowT ? 16 : 28).rotateX(Math.PI / 2), '#ff7043', x, y - .5 + 3.6 * s, z);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { box(bag, .3 * s, 8 * s, .3 * s, '#9aa6ae', x + a * R * .8, y - .5, z + b * R * .6); box(bag, 1.6 * s, .9 * s, .4 * s, '#fff8d8', x + a * R * .8, y - .5 + 8 * s, z + b * R * .6); });
        },
        // 天气岛：一串戴着雪帽的尖山，最高的那座山顶上一座小气象站
        snowpeak(x, y, z, s) {
          const sc = (out, nx, ny, nz, px, py) => { out.set('#6f8496').lerp(C('#f4f8fb'), sstep(4 * s, 8 * s, py + (nx - nz) * s)); };
          mount(x, z, 13 * s, 15 * s, crag(seed * .3 + 31), seed + 31, .8, sc);
          mount(x - 9 * s, z + 2, 9 * s, 10 * s, crag(seed * .3 + 32), seed + 32, .8, sc);
          mount(x + 9 * s, z + 3, 8 * s, 8 * s, crag(seed * .3 + 33), seed + 33, .8, sc);
          cyl(.9 * s, .9 * s, 1.4 * s, '#f6f8fa', x, sea + 10.6 * s, z);
          part(new T3.SphereGeometry(.9 * s, 10, 6, 0, 6.2832, 0, Math.PI / 2), '#ffffff', x, sea + 12 * s, z);
          box(bag, .1 * s, 1.6 * s, .1 * s, '#c62828', x + .9 * s, sea + 12 * s, z);
        },
        // 回忆岛：高高的平顶崖上一座石头神殿（一排石柱、三角形的屋顶，有几根断了），崖边挂着一道细细的瀑布
        temple(x, y, z, s) {
          const tc = (out, nx, ny, nz, px, py) => { out.set('#8f8a80').lerp(C('#a9b39a'), sstep(6 * s, 8 * s, py)); };
          mount(x, z, 11 * s, 8 * s, mesa, seed + 41, .8, tc);
          const ty = sea + 7.6 * s;
          box(bag, 9 * s, .5 * s, 5 * s, '#c9bfa8', x, ty, z); box(bag, 8 * s, .4 * s, 4.2 * s, '#d8cfb9', x, ty + .5 * s, z);
          for (let k = 0; k < 6; k++) { const hh = k === 1 ? 2 * s : k === 4 ? 2.8 * s : 4 * s; cyl(.4 * s, .34 * s, hh, '#e3dccb', x - 3.5 * s + k * 1.4 * s, ty + .9 * s, z + 1.5 * s, 8); }
          box(bag, 8.4 * s, .5 * s, 4 * s, '#d0c7b0', x, ty + 4.9 * s, z);
          part(new T3.CylinderGeometry(2.4 * s, 2.4 * s, 8.6 * s, 3).rotateZ(Math.PI / 2).scale(1, .45, 1.05).translate(0, 1 * s, 0), '#c2b89f', x, ty + 5.4 * s, z);
          box(bag, 1 * s, 7.8 * s, .2 * s, byY('#cfe8f4', '#ffffff', 0, 7.8 * s), x + 6 * s, sea, z + 6 * s * .8);
        },
        // 冠军高原：一座金顶的圆形大赛场，一圈皇冠一样的尖角，旗子
        arena(x, y, z, s) {
          const R = 8 * s;
          part(new T3.CylinderGeometry(R, R * 1.06, 4.4 * s, lowT ? 16 : 32).translate(0, 2.2 * s, 0), byY('#d9d2c2', '#fbf6ea', 0, 4.4 * s), x, y - .5, z);
          part(new T3.TorusGeometry(R, .4 * s, 6, lowT ? 16 : 32).rotateX(Math.PI / 2), '#e2b13c', x, y - .5 + 4.4 * s, z);
          for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832; part(new T3.ConeGeometry(.7 * s, 2 * s, 4).translate(0, 1 * s, 0), '#f2c544', x + Math.cos(a) * R, y - .5 + 4.6 * s, z + Math.sin(a) * R); }
          box(bag, .15 * s, 4 * s, .15 * s, '#6d5a3a', x, y - .5 + 4.4 * s, z); box(bag, 1.8 * s, 1 * s, .08, '#e53935', x + .9 * s, y - .5 + 7.4 * s, z);
        },
      };
      if (cfg.classic) {
        // 第 0 岛：照原样——正北长长的矮岛上一座灯标塔，一边尖岛，另一边大山
        mount(bx, bz, 30, 5.2, dome, seed + 1, .5);
        mount(bx - 19, bz + 3, 9, 3.4, dome, seed + 2, .7);
        LM.beacon(bx + 4, sea + 4.4, bz, 1);
        mount(cxm - side * (30 + h(3) * 8), -Q.skirt - 84, 19, 15 + h(4) * 4, peak, seed + 3, .8);
        mount(cxm - side * (48 + h(3) * 8), -Q.skirt - 78, 10, 6, crag(seed * .4 + 3), seed + 4, .8);
      } else {
        // 正北：下一座岛（它自己的配色），上面立着它的地标
        const [nz, nk] = cfg.north, nCol = landColOf(palOf(nz)), big = nk === 'volcano' || nk === 'snowpeak' || nk === 'temple';
        if (!big) { mount(bx, bz, 26, 4.6, dome, seed + 1, .5, nCol); mount(bx - 18, bz + 3, 8, 3, dome, seed + 2, .7, nCol); }
        else mount(bx, bz + 2, 22, 2.6, dome, seed + 1, .5, nCol);
        LM[nk](bx + 3, sea + (big ? 0 : 4.2), bz, big ? 1 : .95);
        // 一边、近一点：本岛的岬角和本岛的地标（大一些、清楚一些）
        const ox = cxm + side * (22 + h(3) * 6), oz = -Q.skirt - 34, oBig = cfg.own === 'volcano' || cfg.own === 'snowpeak' || cfg.own === 'temple';
        if (!oBig) mount(ox, oz, 15, 4.4, dome, seed + 3, .7);
        LM[cfg.own](ox, sea + (oBig ? 0 : 4), oz - (oBig ? 10 : 0), oBig ? 1.2 : .82);
        // 另一边、远一点：上一座岛
        const [sz2, sk] = cfg.side, sx = cxm - side * (28 + h(4) * 8), szz = -Q.skirt - 92, sBig = sk === 'volcano' || sk === 'snowpeak' || sk === 'temple';
        if (!sBig) mount(sx, szz, 18, 4, dome, seed + 4, .7, landColOf(palOf(sz2)));
        LM[sk](sx, sea + (sBig ? 0 : 3.6), szz, sBig ? .9 : .75);
      }
      // 最远：大山（一个主峰带一个矮一点的肩膀）。classic：山脚的林子、山腰的石头、泛白的山顶；snow：一大半是雪；hills：软软的、黄绿色的小丘；
      // mesa：平顶陡边的红岩山；pastel：颜色淡一些、粉一些；misty：低一些、藏在雾里；none：不要（这座岛自己就是那座山）
      const mt = cfg.mtn || 'classic';
      if (mt !== 'none') {
        const R = FAR * .2, Hh = FAR * (mt === 'hills' ? .06 : mt === 'misty' ? .1 : mt === 'mesa' ? .08 : .125), mx = cxm + side * FAR * .15, mz = -FAR * .74;
        const snowK = mt === 'snow' ? .3 : mt === 'pastel' ? .55 : .62;
        const midC = mt === 'mesa' ? C('#c9895a') : mt === 'pastel' ? mixC(rockC, '#c8b6e6', .35) : mt === 'hills' ? mixC(green, '#d9c27a', .4) : rockC;
        const mcol = (out, nx, ny, nz, px, py) => { out.copy(green).lerp(midC, sstep(Hh * .12, Hh * .45, py)); if (mt !== 'hills' && mt !== 'mesa') out.lerp(paleC, sstep(Hh * snowK, Hh * (snowK + .28), py + (nx - nz) * Hh * .06)); };
        const prof = mt === 'hills' ? dome : mt === 'mesa' ? mesa : null;
        mount(mx, mz, R, Hh, prof || crag(seed * .21 + 5), seed + 5, .7, mcol);
        mount(mx + side * R * .5, mz + 4, R * .62, Hh * .55, prof || crag(seed * .21 + 8), seed + 6, .7, mcol);
        mount(mx - side * R * .62, mz + 6, R * .5, Hh * .34, prof || crag(seed * .21 + 11), seed + 7, .7, mcol);
      }
      // 两头散着的小岛
      if (!lowT) [[-1, 68, 30, 11, 5], [1, 82, 46, 13, 6.5], [-1, 104, 70, 15, 4.5], [1, 120, 22, 10, 7]].forEach(([sd3, ox, oz, R, Hh], k) => mount(cxm + sd3 * (ox + h(10 + k) * 12), -Q.skirt - oz - h(20 + k) * 14, R, Hh, k % 2 ? peak : dome, seed + 10 + k, .7));
      const g = bake(bag); own.push(g);
      farIsles = new T3.Mesh(g, farMat); farIsles.frustumCulled = false;
      still(add(farIsles, false, false));
    }
    // 飘在空气里的东西（全在着色器里算，围着镜头转一个大盒子）：每座岛不一样（MOODS 的 life）——
    //   「片」（转着往下飘的小片：花瓣、落叶、彩纸屑、铅笔屑）和「点」（花粉、雪花、光点）各占一部分；两三只蝴蝶（下雪的岛上没有）
    const lifeMax = Math.round(150 * Q.life);
    const lifeMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCen: { value: new T3.Vector3() }, uPx: { value: 1 }, uPieces: { value: .33 }, uFall: { value: .12 }, uDFall: { value: 0 }, uSway: { value: 1 }, uDotS: { value: .045 }, uDotA: { value: .8 }, uPS: { value: .085 },
        uPA: { value: C('#ffb8d0') }, uPB: { value: C('#fff2f4') }, uDot: { value: C('#fffad0') }, uHue: { value: 0 } },
      vertexShader: 'attribute vec2 aK; uniform float uTime; uniform vec3 uCen; uniform float uPx; uniform float uPieces; uniform float uFall; uniform float uDFall; uniform float uSway; uniform float uDotS; uniform float uPS; varying vec3 vK; varying float vA;\n' +
        'void main(){ vec3 box = vec3(24.0, 6.5, 30.0); vec3 p = position * box; float t = uTime; float pc = step(aK.y, uPieces);\n' +
        '  p.x += t * (0.55 + aK.x * 0.5) * uSway; p.z += t * 0.2 * uSway; p.y += sin(t * 0.8 + position.x * 40.0) * 0.5 - t * mix(uDFall, uFall, pc) * (0.7 + aK.x * 0.6);\n' +
        '  p.x += sin(t * 1.3 + position.z * 31.0) * 0.35 * (1.0 - pc) * step(0.01, uDFall);\n' +
        '  p = mod(p - uCen + box * 0.5, box) - box * 0.5 + uCen; p.y = uCen.y + mod(p.y - uCen.y + 1.0, box.y) - 0.6;\n' +
        '  vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vK = vec3(pc, t * (2.0 + aK.x * 3.0) + position.z * 20.0, fract(aK.x * 7.13 + position.y * 3.7));\n' +
        '  gl_PointSize = uPx * mix(uDotS, uPS, pc) * (0.7 + aK.x * 0.6) / max(0.5, -mv.z); vA = smoothstep(3.0, 6.0, -mv.z) * (1.0 - smoothstep(22.0, 30.0, -mv.z)); }',
      fragmentShader: 'uniform vec3 uPA; uniform vec3 uPB; uniform vec3 uDot; uniform float uHue; uniform float uDotA; varying vec3 vK; varying float vA;\n' +
        'vec3 pal(float h, float k) { vec3 c = h < 0.2 ? vec3(1.0, 0.36, 0.44) : h < 0.4 ? vec3(1.0, 0.82, 0.22) : h < 0.6 ? vec3(0.3, 0.7, 1.0) : h < 0.8 ? vec3(0.44, 0.86, 0.42) : vec3(0.78, 0.5, 1.0); return mix(c, vec3(1.0), k); }\n' +
        'void main(){ vec2 q = gl_PointCoord - 0.5; float a;\n  vec3 c;\n' +
        '  if (vK.x > 0.5) { float s = sin(vK.y), co = cos(vK.y); vec2 r = vec2(q.x * co - q.y * s, (q.x * s + q.y * co) * (1.6 + 1.2 * abs(sin(vK.y * 0.7)))); a = 1.0 - smoothstep(0.34, 0.42, length(r));\n' +
        '    c = uHue > 0.5 ? pal(vK.z, uHue > 1.5 ? 0.42 : 0.0) * (0.85 + 0.15 * smoothstep(-0.3, 0.3, r.x)) : mix(uPA, uPB, uHue < -0.5 ? vK.z : smoothstep(-0.3, 0.3, r.x)); }\n' +
        '  else { a = (1.0 - smoothstep(0.1, 0.5, length(q))) * uDotA; c = uDot; }\n' +
        '  gl_FragColor = vec4(c, a * vA);\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    const life = (() => {
      if (!lifeMax) return null;
      const g = new T3.BufferGeometry(), p = new Float32Array(lifeMax * 3), k = new Float32Array(lifeMax * 2);
      for (let i = 0; i < lifeMax; i++) { p[i * 3] = hash2(i, 81); p[i * 3 + 1] = hash2(i, 82); p[i * 3 + 2] = hash2(i, 83); k[i * 2] = hash2(i, 84); k[i * 2 + 1] = hash2(i, 85); }
      g.setAttribute('position', new T3.BufferAttribute(p, 3)); g.setAttribute('aK', new T3.BufferAttribute(k, 2));
      const o = new T3.Points(g, lifeMat); o.frustumCulled = false; o.renderOrder = 4; o.matrixAutoUpdate = false;
      keep.push(g);
      return o;
    })();
    keep.push(lifeMat);
    // 换一种「空气里飘的东西」：各种的片 / 点各占多少、往下落多快、什么颜色
    //   uHue：0 片的颜色在 uPA 和 uPB 之间（一半亮一半暗）/ -1 每片在 uPA、uPB 之间随便挑 / 1 鲜艳的五种颜色 / 2 粉一点的五种颜色
    const LIFE_SET = {
      petal: { n: .9, pieces: .33, fall: .12, dfall: 0, sway: 1, dotS: .045, dotA: .8, ps: .085, pa: '#ffb8d0', pb: '#fff2f4', dot: '#fffad0', hue: 0 },
      leaf: { n: .8, pieces: .62, fall: .32, dfall: 0, sway: 1.1, dotS: .04, dotA: .6, ps: .1, pa: '#e8702a', pb: '#f4c23c', dot: '#fff2c8', hue: -1 },
      snow: { n: 1, pieces: 0, fall: 0, dfall: .7, sway: .45, dotS: .07, dotA: .95, ps: .08, pa: '#ffffff', pb: '#ffffff', dot: '#ffffff', hue: 0 },
      confetti: { n: .9, pieces: .78, fall: .26, dfall: 0, sway: .8, dotS: .04, dotA: .7, ps: .075, pa: '#ffffff', pb: '#ffffff', dot: '#fff6d8', hue: 1 },
      mote: { n: .8, pieces: 0, fall: 0, dfall: -.03, sway: .25, dotS: .04, dotA: .55, ps: .08, pa: '#ffffff', pb: '#ffffff', dot: '#f8f4e2', hue: 0 },
      shaving: { n: .9, pieces: .55, fall: .16, dfall: 0, sway: .9, dotS: .04, dotA: .7, ps: .08, pa: '#ffffff', pb: '#ffffff', dot: '#fffad8', hue: 2 },
    };
    function lifeSet(kind, k) {
      if (!life) return;
      const s = LIFE_SET[kind] || LIFE_SET.petal, u = lifeMat.uniforms;
      u.uPieces.value = s.pieces; u.uFall.value = s.fall; u.uDFall.value = s.dfall; u.uSway.value = s.sway; u.uDotS.value = s.dotS; u.uDotA.value = s.dotA; u.uPS.value = s.ps;
      u.uPA.value.set(s.pa); u.uPB.value.set(s.pb); u.uDot.value.set(s.dot); u.uHue.value = s.hue;
      life.geometry.setDrawRange(0, Math.min(lifeMax, Math.round(90 * Q.life * s.n * (k || 1))));
    }
    const flies = (() => {
      const out = [], n = tier === 'high' ? 3 : tier === 'mid' ? 2 : 0;
      if (!n) return out;
      const mat = new T3.MeshBasicMaterial({ vertexColors: true, side: T3.DoubleSide });
      keep.push(mat);
      [['#ff9d2e', '#5a2d0c'], ['#ffffff', '#6fb7ff'], ['#ffe14a', '#a55a00']].slice(0, n).forEach(([a, b], i) => {
        const bag = Bag(), ca = C(a), cb = C(b);
        [-1, 1].forEach(s => { tri(bag, [0, 0, .05], [s * .13, .02, .1], [s * .11, .02, -.02], cb, ca, ca); tri(bag, [0, 0, .05], [s * .11, .02, -.02], [s * .07, .01, -.1], cb, ca, ca); tri(bag, [0, 0, .05], [s * .07, .01, -.1], [0, 0, -.05], cb, ca, cb); });
        const g = bake(bag); keep.push(g);
        const o = new T3.Mesh(g, mat); o.rotation.order = 'YXZ';
        out.push({ o, ph: i * 2.1, ax: 0, az: 0, t0: -1e9 });
      });
      return out;
    })();

    // ---------- 后期：描边（按深度图找轮廓）＋ 亮处的柔光 ＋ 一点点调色。没有移轴虚化 ----------
    let rt = null, post = null;
    if (Q.post) {
      const dtex = T3.DepthTexture ? new T3.DepthTexture(4, 4) : null;
      rt = new T3.WebGLRenderTarget(4, 4, { samples: (window.devicePixelRatio || 1) >= 2.5 && Q.dpr >= 2.5 ? Math.min(2, Q.msaa) : Q.msaa, colorSpace: T3.SRGBColorSpace, depthBuffer: true, depthTexture: dtex });
      const mk = () => { const t = new T3.WebGLRenderTarget(4, 4, { colorSpace: T3.SRGBColorSpace, depthBuffer: false }); t.texture.minFilter = t.texture.magFilter = T3.LinearFilter; return t; };
      const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const bright = new T3.ShaderMaterial({
        uniforms: { tDiffuse: { value: rt.texture }, uPx: { value: new T3.Vector2(1, 1) } }, vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uPx; varying vec2 vUv;\nvoid main(){ vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0); vec3 s = texture2D(tDiffuse, vUv + o * uPx).rgb; float l = max(s.r, max(s.g, s.b)); c += s * smoothstep(0.74, 1.0, l); } gl_FragColor = vec4(c * 0.25, 1.0); }',
      });
      const blur = new T3.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uDir: { value: new T3.Vector2(1, 0) } }, vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;\nvoid main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227; c += (texture2D(tDiffuse, vUv + uDir * 1.3846).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846).rgb) * 0.3162; c += (texture2D(tDiffuse, vUv + uDir * 3.2308).rgb + texture2D(tDiffuse, vUv - uDir * 3.2308).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }',
      });
      const comp = new T3.ShaderMaterial({
        uniforms: { tDiffuse: { value: rt.texture }, tDepth: { value: dtex }, tBloom: { value: null }, uPx: { value: new T3.Vector2(1, 1) }, uNF: { value: new T3.Vector2(.5, 600) }, uBloom: { value: Q.bloom ? .32 : 0 }, uLine: { value: dtex ? 1 : 0 } },
        vertexShader: VS, depthTest: false, depthWrite: false,
        fragmentShader: [
          'uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform vec2 uPx; uniform vec2 uNF; uniform float uBloom; uniform float uLine; varying vec2 vUv;',
          'void main(){',
          '  vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;',
          '  if (uLine > 0.0) {',
          // 描边：深度在这一点「拐弯」（左右或上下两边的差不一样）就是轮廓；平的地面再斜也不会拐弯。只描近处那个面认的（alpha = 1）
          '    vec2 ox = vec2(uPx.x, 0.0), oy = vec2(0.0, uPx.y);',
          '    float d0 = texture2D(tDepth, vUv).x, dl = texture2D(tDepth, vUv - ox).x, dr = texture2D(tDepth, vUv + ox).x, du = texture2D(tDepth, vUv + oy).x, dd = texture2D(tDepth, vUv - oy).x;',
          '    float fN = c.a, dm = d0, a;',
          '    a = texture2D(tDiffuse, vUv - ox).a; if (dl < dm) { dm = dl; fN = a; } a = texture2D(tDiffuse, vUv + ox).a; if (dr < dm) { dm = dr; fN = a; }',
          '    a = texture2D(tDiffuse, vUv + oy).a; if (du < dm) { dm = du; fN = a; } a = texture2D(tDiffuse, vUv - oy).a; if (dd < dm) { dm = dd; fN = a; }',
          '    float sc = 1.0 - dm * (1.0 - uNF.x / uNF.y);',                    // ≈ 近平面 / 距离
          '    float e = max(abs(dl + dr - 2.0 * d0), abs(du + dd - 2.0 * d0)) / (0.022 * sc);',
          '    float z = uNF.x / max(sc, 0.0001);',
          '    float k = smoothstep(1.0, 2.4, e) * fN * (1.0 - smoothstep(26.0, 120.0, z)) * uLine;',
          '    col = mix(col, col * vec3(0.30, 0.27, 0.42), k * 0.82);',
          '  }',
          '  col += texture2D(tBloom, vUv).rgb * uBloom;',
          // 太阳在左上角外面：那一角罩着一片暖光
          '  vec2 gq = (vUv - vec2(0.08, 1.06)) * vec2(1.0, 1.5); col += vec3(1.0, 0.85, 0.6) * pow(clamp(1.0 - length(gq), 0.0, 1.0), 2.2) * 0.22;',
          // 调色（在显示的那个亮度曲线上做）：一条很缓的 S 形，亮部偏暖、暗部偏冷，饱和一点点，四角极轻的压暗
          '  vec3 gc = pow(clamp(col, 0.0, 1.0), vec3(0.4545));',
          '  gc = mix(gc, gc * gc * (3.0 - 2.0 * gc), 0.24);',
          '  float l = dot(gc, vec3(0.299, 0.587, 0.114));',
          '  gc += vec3(0.022, 0.010, -0.02) * smoothstep(0.6, 1.0, l) + vec3(-0.014, -0.002, 0.026) * (1.0 - smoothstep(0.0, 0.5, l));',
          '  gc = mix(vec3(l), gc, 1.07);',
          '  vec2 q = vUv - 0.5; gc *= 1.0 - dot(q, q) * 0.16;',
          '  col = pow(clamp(gc, 0.0, 1.0), vec3(2.2));',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <colorspace_fragment>',
          '}',
        ].join('\n'),
      });
      const quad = new T3.Mesh(new T3.PlaneGeometry(2, 2), comp);
      quad.frustumCulled = false;
      post = { scene: new T3.Scene(), cam: new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad, bright, blur, comp, a: Q.bloom ? mk() : null, b: Q.bloom ? mk() : null, dtex, line: !!dtex };
      post.scene.add(quad);
      // 描边要读深度图。有的手机显卡不会把抗锯齿用的多重采样深度「合并」成一张能读的图（读出来是乱的或者全一样），所以建好以后先试一次：
      // 左半边放一块近处的板子，画完把深度图读回来，左右两边应该一个近一个远。试不过就不描边——别的照常画（人物的图自己带着勾线，画面照样看得清）
      if (dtex) {
        let ok = false, out = null, dm = null, tm = null, tg = null;
        try {
          rt.setSize(16, 16);
          const ts = new T3.Scene(), tc = new T3.OrthographicCamera(-1, 1, 1, -1, 0, 2);
          tm = new T3.MeshBasicMaterial({ color: 0xffffff }); tg = new T3.PlaneGeometry(1, 2);
          const pl = new T3.Mesh(tg, tm); pl.position.set(-.5, 0, -1); ts.add(pl);
          renderer.setRenderTarget(rt); renderer.clear(); renderer.render(ts, tc);
          out = new T3.WebGLRenderTarget(16, 16, { depthBuffer: false });
          dm = new T3.ShaderMaterial({ uniforms: { tDepth: { value: dtex } }, vertexShader: VS, fragmentShader: 'uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(texture2D(tDepth, vUv).x), 1.0); }', depthTest: false, depthWrite: false });
          quad.material = dm; renderer.setRenderTarget(out); renderer.render(post.scene, post.cam);
          const px = new Uint8Array(16 * 16 * 4); renderer.readRenderTargetPixels(out, 0, 0, 16, 16, px);
          const near = px[(8 * 16 + 3) * 4], far = px[(8 * 16 + 12) * 4];
          ok = far > 245 && near > 70 && near < 190;
        } catch (e) { ok = false; }
        renderer.setRenderTarget(null); quad.material = comp;
        [out, dm, tm, tg].forEach(x => x && x.dispose());
        post.line = ok; comp.uniforms.uLine.value = ok ? 1 : 0;
      }
    }

    // ---------- 载入一张地图 ----------
    const spriteList = [];
    function clear() {
      if (world) scene.remove(world);
      own.forEach(o => o.dispose && o.dispose());
      own = [];
      spriteList.forEach(s => dropMesh(s));
      spriteList.length = 0; sprites.clear();
      BLD.length = 0; spinners.length = 0; grassChunks.length = 0; treeBands.length = 0;
      obstM = []; bouldM = []; gateM = []; pickS = []; boatG = null; farIsles = null; atlas = null;
      world = new T3.Group(); world.matrixAutoUpdate = false;
      scene.add(world);
    }
    function addPerson(n) { const s = person(n); sprites.set(n, s); spriteList.push(s); world.add(s.root); return s; }
    let buildMs = 0, geoMs = 0;   // 上一张地图建了多久（毫秒）：连着色器编译和第一遍画在内 / 只算拼几何体
    function load(map) {
      const t0 = performance.now();
      m = map;
      clear();
      THEME = (window.EchoMaps && EchoMaps.THEMES[m.theme]) || {}; PAL = Object.assign({ grass: '#9ad66e', tall: '#55ab40', blade: '#2f7d2a', path: '#f1dfb2', tree: '#3f9a4a', treeHi: '#6cc15a', sand: '#f7e8bb', rock: '#a39b8b' }, m.pal || {});
      // 这座岛的天气（MOODS）和这种地貌的地面、岩石（GROUND）：空气、天空、太阳的颜色，空气里飘的东西
      MOOD = MOODS[String(m.id || '')[0] === 'v' ? 'league' : clamp(m.isle | 0, 0, 12)] || MOODS[0]; GND = GROUND[m.theme] || GROUND.hello;
      U.uFogA.value.set(MOOD.fog); U.uHaze.value.set(MOOD.haze); U.uFogP.value.set(MOOD.fogP[0], MOOD.fogP[1], Q.far);
      skyMat.uniforms.uZen.value.set(MOOD.sky[0]); skyMat.uniforms.uMid.value.set(MOOD.sky[1]); skyMat.uniforms.uLow.value.set(MOOD.sky[2]);
      sun.color.set(MOOD.sun); sun.intensity = Math.PI * .54 * MOOD.sunK; hemi.color.set(MOOD.hemi[0]); hemi.groundColor.set(MOOD.hemi[1]);
      U.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity / Math.PI);
      lifeSet(MOOD.life, MOOD.lifeK);
      occH = new Float32Array(m.W * m.H); cliffTop = new Float32Array(m.W * m.H);
      INFO = { life: MOOD.life, path: GND.path, sand: GND.sand, cap: GND.cap };
      buildLand(); buildTerrain(); buildWater(); buildFalls(); buildIce(); buildStatics(); buildTrees(); buildGrass(); buildPebbles(); buildBuildings(); buildMovables(); buildFar();
      INFO.falls = LAND.falls.map(f => +f.drop.toFixed(2)); INFO.lava = !!waterMat.uniforms.uHot.value; INFO.over = !!(m.over && m.def && m.def.paint);
      clouds.position.set(m.W / 2, 0, m.H / 2); clouds.updateMatrix();
      world.add(sky, clouds, blobs);
      if (life) world.add(life);
      flies.forEach(f => { world.add(f.o); f.t0 = -1e9; f.o.visible = MOOD.life !== 'snow'; });   // 下雪的岛上没有蝴蝶
      m.npcs.forEach(addPerson);
      world.add(player.root, fol.root, bike, ripple, hintS);
      sparkS.forEach(sp => world.add(sp));
      hintS.visible = false; bike.visible = false; ripple.visible = false;
      sun.position.copy(SUN_DIR).multiplyScalar(42); sun.target.position.set(0, 0, 0);
      camT.x = -999; snapKey = ''; jumpP.on = false; jumpF.on = false;
      resize();
      geoMs = Math.round(performance.now() - t0);
      // 着色器先编译好，再从高处把整张地图画一遍（什么都不裁掉）：所有网格的数据这时候就传给显卡了，走到新地方时不会因为头一次画某一块而卡一下
      try {
        if (rt) renderer.setRenderTarget(rt);
        renderer.compile(scene, camera);
        const fc = [];
        world.traverse(o => { if (o.isMesh && o.frustumCulled) { fc.push(o); o.frustumCulled = false; } });
        grassChunks.forEach(ch => ch.parts.forEach(pt => { pt.im.count = pt.n; pt.im.visible = true; }));
        treeBands.forEach(b => b.coarse.forEach(o => { o.visible = true; }));
        camera.position.set(m.W / 2, 40, m.H / 2 + 30); camera.lookAt(m.W / 2, 0, m.H / 2); camera.updateMatrixWorld();
        if (Q.shadow) renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
        fc.forEach(o => { o.frustumCulled = true; });
        treeBands.forEach(b => { b.near = true; b.coarse.forEach(o => { o.visible = false; }); b.fine.forEach(o => { o.visible = true; }); });
        renderer.setRenderTarget(null);
      } catch (e) { /* 画不了就等真画的时候再说 */ }
      buildMs = Math.round(performance.now() - t0);
    }

    // ---------- 镜头：跟在主角身后（南边）上方，朝北看；地平线在画面上面四分之一左右，主角在中间偏下 ----------
    const CAM = { phi: 0, dl: 0, D: 11, frac: .1, cur: 0, yaw: 0 };
    const camT = new T3.Vector3(-999, 0, 0), look = new T3.Vector2(), _v = new T3.Vector3();
    const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }, DIRYAW = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
    let VW = 1, VH = 1, bufW = 1, bufH = 1, lastT = 0, snapKey = '', camLift = 0, seenTick = 0, bloomPx = [1, 1];
    function resize() {
      VW = Math.max(1, view.clientWidth); VH = Math.max(1, view.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, Q.dpr), a = VW / VH;
      renderer.setPixelRatio(dpr);
      renderer.setSize(VW, VH, false);
      canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
      // 竖屏：视角宽一些、镜头高一些（主角约占画面高的十分之一，左右各看得到三格）；横屏：视角窄一些、主角大一些
      // hy / py：地平线、主角在画面上从上往下的位置。下面那一截要留给对话框、摇杆和 A / B 键
      const k = sstep(.75, 1.6, a), fov = lerp(60, 44, k), hy = lerp(.215, .25, k), py = lerp(.6, .68, k), frac = lerp(.108, .2, k), tH = Math.tan(fov / 2 * Math.PI / 180);
      CAM.phi = Math.atan((2 * py - 1) * tH); CAM.dl = Math.atan((1 - 2 * hy) * tH) + CAM.phi; CAM.D = PERSON / (2 * tH * frac); CAM.frac = frac;
      bufW = Math.round(VW * dpr); bufH = Math.round(VH * dpr);
      camera.aspect = a; camera.fov = fov; camera.near = .5; camera.far = Q.far * 2.2;
      camera.updateProjectionMatrix();
      lifeMat.uniforms.uPx.value = VH * dpr / (2 * tH); steamMat.uniforms.uPx.value = VH * dpr / (2 * tH);
      const gD = tier === 'high' && INFO.heavy ? [8.5, 25] : GRASS_D;   // 树多的图（精美档）草收近一点，省下三角形
      U.uGrassD.value.set(gD[0] * lerp(1, .8, k), gD[1] * lerp(1, .72, k), 4.6, 8.2);   // 横屏看到的地面宽得多，草收近一点
      if (rt) {
        const w = Math.round(VW * dpr), h = Math.round(VH * dpr);
        rt.setSize(w, h);
        post.comp.uniforms.uPx.value.set(1 / w, 1 / h); post.comp.uniforms.uNF.value.set(camera.near, camera.far); post.bright.uniforms.uPx.value.set(1 / w, 1 / h);
        if (post.a) { const bw = Math.max(8, Math.round(w / Q.bloom)), bh = Math.max(8, Math.round(h / Q.bloom)); post.a.setSize(bw, bh); post.b.setSize(bw, bh); bloomPx = [1 / bw, 1 / bh]; }
      }
    }
    // 跳台阶：起点和落点之间的地面高度直着连过去（不然人会在坎上「掉」一下），上面再加 world.js 给的那道弧线
    const jumpP = { on: false, z0: 0, y0: 0 }, jumpF = { on: false, z0: 0, y0: 0 };
    function hopY(st, hop, x, z, ground) {
      if (hop <= 0) { st.on = false; st.y0 = ground; return ground; }
      if (!st.on) { st.on = true; st.z0 = Math.floor(z - .5 + .02) + .5; }
      const p = clamp((z - st.z0) / 2, 0, 1);
      return lerp(st.y0, LAND.at(x, st.z0 + 2), p);
    }
    function draw(now, V) {
      if (gl.lost) return;   // 画面丢了：等 world.js 重建
      const dt = lastT ? Math.max(0, Math.min(.1, (now - lastT) / 1000)) : .016; lastT = now;
      const t = now / 1000, L = LAND, M3 = window.Mon3D;
      U.uTime.value = t;
      renderer.info.reset();
      nBlob = 0;
      // 主角
      const px = V.px + .5, pz = V.py + .5, wl = V.surf ? L.waterLevel(Math.round(V.px), Math.round(V.py)) : 0;
      const py = V.surf ? wl : hopY(jumpP, V.hop, px, pz, L.at(px, pz));
      setLook(player, V.plook);
      player.root.position.set(px, py, pz);
      if (player.inst) {
        // 踏浪：站在怪兽背上；骑车：坐在车上；跳台阶：world.js 只给了离地多高，上升还是下落看它比上一帧高了还是低了；冰面上滑的时候不迈步
        const hN = clamp(V.hop / .55, 0, 1), rising = V.hop >= (player.hop0 || 0), tc = tIn(Math.round(V.px), Math.round(V.py));
        player.hop0 = V.hop;
        animate3(player, dt, px, pz, V.pdir, V.pmoving && tc !== 'I' && tc !== 'w', V.surf ? 'surf' : V.bike ? 'bike' : V.hop > .002 ? 'hop' : '', V.hop > .002 ? (rising ? Math.asin(hN) / Math.PI : 1 - Math.asin(hN) / Math.PI) : null);
        player.inst.root.position.y = V.hop + (V.surf ? (fol.R ? clamp(fol.tall * .5, .26, .6) : .34) + Math.sin(t * 2.2) * .03 : V.bike ? .16 : 0);
      } else {
        setFrame(player, V.pdir, V.pmoving ? 1 + (Math.floor(now / 85) % 2) : 0);
        player.mesh.position.y = V.hop + (V.surf ? .36 + Math.sin(t * 2.2) * .03 : V.bike ? .16 : 0);
      }
      if (!V.surf) blobAt(px, py, pz + .02, .78 - V.hop * .35, .46 - V.hop * .2);
      bike.visible = !!V.bike;
      if (V.bike) { bike.position.set(px, py, pz); bike.rotation.y = V.pdir === 'left' || V.pdir === 'right' ? Math.PI / 2 : 0; }
      ripple.visible = !!V.surf;
      if (V.surf) { ripple.position.set(px, wl + .03, pz); ripple.scale.setScalar(1 + Math.sin(now / 250) * .08); }
      for (let i = 0; i < spinners.length; i++) spinners[i].rotation.z = now / 900;
      for (let i = 0; i < gateM.length; i++) { const o = gateM[i], open = V.open && V.open.has(o.key); o.g.position.y += ((open ? o.y0 - 1.25 : o.y0) - o.g.position.y) * .2; o.g.visible = o.g.position.y > o.y0 - 1.15; }
      for (let i = 0; i < obstM.length; i++) obstM[i].g.visible = !V.cleared || !V.cleared.has(obstM[i].key);
      for (let i = 0; i < V.obst.length && i < bouldM.length; i++) { const b = V.obst[i], g = bouldM[i]; g.position.x += (b.x + .5 - g.position.x) * .3; g.position.z += (b.y + .5 - g.position.z) * .3; g.position.y = L.ground(g.position.x, g.position.z); }
      for (let i = 0; i < sparkS.length; i++) { const sp = sparkS[i], h = V.sparkles[i]; sp.visible = !!h; if (h) { sp.position.set(h.x + .5, L.at(h.x + .5, h.y + .5) + .28, h.y + .5); sp.material.opacity = .4 + .6 * (Math.sin(now / 230 + i * 2) + 1) / 2; sp.scale.setScalar(.7 + .5 * (Math.sin(now / 300 + i) + 1) / 2); } }
      if (boatG) { boatG.position.y = boatG.userData.y0 + Math.sin(t * 1.3) * .035 - .04; boatG.rotation.z = Math.sin(t * .9) * .05; boatG.rotation.x = Math.sin(t * 1.1 + 1) * .03; }
      // 跟着走的怪兽
      const showF = V.showF || (V.surf && !!V.lead);
      fol.root.visible = showF;
      if (showF) {
        folSet(V.lead);
        let fx = V.fx + .5, fz = V.fy + .5, fy;
        if (V.surf) { fx = px; fz = pz + .05; fy = wl - (fol.R ? fol.tall * .45 : .22); }
        else fy = hopY(jumpF, V.fhop, fx, fz, L.at(fx, fz));
        fol.root.position.set(fx, fy + V.fhop, fz);
        // 朝向：走的时候朝着走的方向；停下来过一会儿慢慢转向主角
        const mvx = fx - fol.lx, mvz = fz - fol.lz, moving = mvx * mvx + mvz * mvz > 1e-7 && V.pmoving && !V.surf;
        fol.lx = fx; fol.lz = fz;
        let want = fol.yaw;
        if (V.surf) want = DIRYAW[V.pdir] || 0;
        else if (moving) { want = Math.atan2(mvx, mvz); fol.still = 0; }
        else { fol.still += dt; if (fol.still > .3) { const dx = px - fx, dz = pz - fz; if (dx * dx + dz * dz > .2) want = Math.atan2(dx, dz); } }
        let dy = want - fol.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        fol.yaw += dy * (1 - Math.exp(-dt * 11));
        if (fol.R) {
          fol.R.root.rotation.y = fol.yaw;
          const mode = moving ? 'walk' : 'idle';
          if (fol.mode !== mode) { fol.mode = mode; M3.play(fol.R, mode, mode === 'walk' ? (V.bike ? 1.8 : 1.2) : 1); }
          M3.animate(fol.R, t);
        } else if (fol.icon.mesh) {
          const fdx = px - fx;
          if (!V.surf && Math.abs(fdx) > .05) fol.face = fdx > 0 ? 1 : -1;
          fol.icon.mesh.position.y = V.pmoving ? Math.abs(Math.sin(now / 90)) * .08 : Math.sin(now / 600) * .02;
          fol.icon.mesh.scale.x = fol.icon.base && fol.face && fol.face !== fol.icon.base ? -1 : 1;
        }
        if (!V.surf) blobAt(fx, fy, fz + .02, fol.R ? fol.tall * .95 : .7, fol.R ? fol.tall * .62 : .4);
        U.uFollow.value.set(fx, fy, fz);
      } else U.uFollow.value.set(-99, 0, -99);
      // 其他人物：位置平滑跟上（训练师走过来时不会一格一格跳）
      seenTick++;
      const kN = 1 - Math.exp(-dt * 14), cpz = camera.position.z;
      // 正在和谁说话：主角站着不动、面前一格有人、按 A 的提示收起来了（对话框开着）——那个人说话时点头、比划
      const dvT = DIRV[V.pdir] || DIRV.down, talkX = Math.round(V.px) + dvT[0], talkY = Math.round(V.py) + dvT[1], talking = !V.pmoving && !V.hint;
      for (let i = 0; i < V.npcs.length; i++) {
        const q = V.npcs[i], s = sprites.get(q.n) || addPerson(q.n);   // 剧情里临时出现的人现加
        s.seen = seenTick;
        if (q.mon) iconSheet(s, q.mon, 1.05); else setLook(s, q.look);
        s.rx += (q.x - s.rx) * kN; s.ry += (q.y - s.ry) * kN;
        const sx = s.rx + .5, sz = s.ry + .5, sy = L.at(sx, sz), walking = Math.abs(q.x - s.rx) + Math.abs(q.y - s.ry) > .05;
        if (q.mon) { if (s.mesh) s.mesh.position.y = Math.abs(Math.sin(now / 110)) * .12; }
        else if (s.inst) animate3(s, dt, sx, sz, q.face, null, talking && q.x === talkX && q.y === talkY ? 'talk' : '');
        else setFrame(s, q.face, walking ? 1 + (Math.floor(now / 90) % 2) : 0);
        s.root.position.set(sx, sy, sz);
        s.root.visible = true;
        blobAt(sx, sy, sz + .02, .76, .44);
        // 离镜头远的牌子放大一点，不然看不清
        const bs = clamp((cpz - sz) / 11, 1, 2.3);
        if (q.alert) { if (!s.alert) { s.alert = bubble(alertMat); s.root.add(s.alert); } s.alert.visible = true; s.alert.position.set(0, headTop(s) + .3 + .2 * bs, 0); s.alert.scale.setScalar(bs); }
        else if (s.alert) s.alert.visible = false;
        // 这个人有委托：头上一个金色的「?」，轻轻上下浮（「!」出来时先让开）
        if (q.quest && !q.alert) { if (!s.quest) { s.quest = bubble(questMat); s.root.add(s.quest); } s.quest.visible = true; s.quest.position.set(0, headTop(s) + .32 + .22 * bs + Math.sin(now / 260 + q.x) * .05, 0); s.quest.scale.setScalar(bs); }
        else if (s.quest) s.quest.visible = false;
      }
      for (let i = 0; i < spriteList.length; i++) { const s = spriteList[i]; if (s.seen !== seenTick) { s.root.visible = false; if (s.inst && seenTick - (s.seen || 0) > 600) { dropMesh(s); s.key = ''; } } }   // 很久没露面的（剧情里走掉的、被藏起来的）：把 3D 小人收掉，回来再建
      // 地上的道具
      for (let i = 0; i < pickS.length; i++) {
        const ps = pickS[i], on = V.picks.includes(ps.p);
        ps.o.visible = on;
        if (on) { const gy = L.at(ps.p.x + .5, ps.p.y + .55); ps.o.position.y = gy + .03 + Math.sin(now / 320 + ps.p.x) * .04; blobAt(ps.p.x + .5, gy, ps.p.y + .57, .44, .26); }
      }
      // A 键提示
      hintS.visible = !!V.hint;
      if (V.hint) {
        const hx = V.hint.x + .5, hz = V.hint.y + .5, hc = tIn(V.hint.x, V.hint.y), door = hc !== '' && BUILD.includes(hc);
        let top = 1.2;   // 提示的是一个人：放在 TA 头顶上面
        for (let i = 0; i < V.npcs.length; i++) if (V.npcs[i].x === V.hint.x && V.npcs[i].y === V.hint.y) { const hs = sprites.get(V.npcs[i].n); if (hs) top = headTop(hs); break; }
        hintS.position.set(hx, L.at(hx, hz + (door ? .6 : 0)) + (door ? 1.32 : top + .42) + Math.sin(now / 220) * .06, hz + (door ? .5 : 0));
      }
      blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
      // 镜头：稍微慢半拍跟上，往主角面朝的方向多看一点
      const dv = DIRV[V.pdir] || DIRV.down, kl = 1 - Math.exp(-dt * 2.4);
      look.x += (dv[0] * .75 - look.x) * kl; look.y += (dv[1] * .9 - look.y) * kl;
      const gx = px + look.x, gz = pz + look.y - .15;
      const snapCam = camT.x < -900;
      if (snapCam) { camT.set(px, py, pz - .15); look.set(0, 0); camLift = 0; }
      else { const kc = 1 - Math.exp(-dt * 6.5); camT.x += (gx - camT.x) * kc; camT.z += (gz - camT.z) * kc; camT.y += (py - camT.y) * (1 - Math.exp(-dt * 4)); }
      // 岩壁挡在镜头和主角中间：俯角加大（镜头抬高），从它上面看过去；抬到头还挡着就靠「圆窗」。房子不抬镜头，淡出去（fadeBuildings）
      const fy0 = camT.y + .55;
      let need = CAM.dl;
      for (let sI = 0; sI < 22; sI++) {
        const zz = Math.floor(camT.z + .6 + sI * .5);
        if (zz >= m.H) break;
        if (zz < 0) continue;
        for (let k = -1; k <= 1; k++) {
          const xx = Math.floor(camT.x + k * .6);
          if (xx < 0 || xx >= m.W) continue;
          const top = occH[zz * m.W + xx];
          if (top > 0) { const a = Math.atan2(top + .35 - fy0, Math.max(.5, zz - camT.z + .15)); if (a > need) need = a; }
        }
      }
      need = Math.min(need, .8);   // 岩壁最多抬到这里
      // 主角面朝北、面前一格站着人（要和 TA 说话）：镜头也抬高（纸片人俯角约 41°、3D 小人约 47°），不然主角的背影正好把对面的人挡住
      // 和 3D 小人说话（对话框开着）时再绕到主角右后方一点：TA 的脸在头的下半边，从正后方看总被主角的帽子挡住，绕开一点两个人的脸和背影就都看得到。
      // 只在对话框开着时绕（这时候不走路，摇杆的方向不受影响），说完转回正北
      let yawT = 0;
      if (!V.pmoving && V.pdir === 'up') { const tx = Math.round(V.px), ty = Math.round(V.py) - 1; for (let i = 0; i < V.npcs.length; i++) if (V.npcs[i].x === tx && V.npcs[i].y === ty) { const hs = sprites.get(V.npcs[i].n); need = Math.max(need, hs && hs.inst && talking ? .6 : .72); if (hs && hs.inst && talking) yawT = .48; break; } }
      CAM.yaw = snapCam ? 0 : CAM.yaw + (yawT - CAM.yaw) * (1 - Math.exp(-dt * (yawT ? 4.5 : 8)));
      if (Math.abs(CAM.yaw) < .002 && !yawT) CAM.yaw = 0;
      CAM.cur = snapCam || !CAM.cur ? need : CAM.cur + (need - CAM.cur) * (1 - Math.exp(-dt * (need > CAM.cur ? 5 : 2.5)));
      const ch = Math.cos(CAM.cur) * CAM.D, cx = camT.x + Math.sin(CAM.yaw) * ch, cz = camT.z + Math.cos(CAM.yaw) * ch;
      let cy = fy0 + Math.sin(CAM.cur) * CAM.D;
      // 不钻进山里：镜头脚下、镜头前面一点的地面再高也留出空隙（慢慢抬上去，不跳）
      const lift = Math.max(0, Math.max(L.ground(cx, cz), L.ground(cx, cz - 2)) + 1.6 - cy);
      camLift += (lift - camLift) * (1 - Math.exp(-dt * 5));
      cy += camLift;
      camera.position.set(cx, cy, cz);
      camera.rotation.set(-(Math.atan2(cy - fy0, ch) - CAM.phi), CAM.yaw, 0);
      U.uPlayer.value.set(px, py, pz);
      fadeBuildings(dt, px, py, pz);
      lifeMat.uniforms.uCen.value.set(camT.x, camT.y, camT.z - 7);
      // 主角在画面上的位置（给「圆窗」用）：圆心在主角腰上，半径比主角高一点
      camera.updateMatrixWorld();
      _v.set(px, py + .62 + V.hop, pz).applyMatrix4(camera.matrixWorldInverse);
      const pd = -_v.z;
      _v.applyMatrix4(camera.projectionMatrix);
      U.uHole.value.set((_v.x * .5 + .5) * bufW, (_v.y * .5 + .5) * bufH, CAM.frac * .86 * bufH, pd - .55); U.uHoleY.value = py + .38;
      // 草：一块一块地算，离主角越远画的簇越少（每块里的簇按「能留到多远」排好了序，只画前面那些；着色器里用同一个数把它们缩回地里）
      const gd = U.uGrassD.value, gcx = camT.x, gcz = camT.z - 5;
      U.uCamT.value.set(gcx, camT.y, gcz);
      for (let i = 0; i < grassChunks.length; i++) {
        const ch = grassChunks[i], d = Math.hypot(Math.max(ch.x0 - gcx, gcx - ch.x1, 0), Math.max(ch.z0 - gcz, gcz - ch.z1, 0));
        ch.near = d < (ch.near ? GRASS_NEAR + 1.5 : GRASS_NEAR);   // 近处细、远处省；来回走的时候不在分界上反复换
        for (let k = 0; k < ch.parts.length; k++) {
          const pt = ch.parts[k], f = pt.tall ? 1.55 : 1, q = (d - gd.x * f) / ((gd.y - gd.x) * f);
          let n = pt.n;
          if (pt.fine !== ch.near || q >= 1) n = 0; else if (q > 0) { let lo = 0, hi = pt.n; while (lo < hi) { const mid = (lo + hi) >> 1; if (pt.rs[mid] > q) lo = mid + 1; else hi = mid; } n = lo; }
          pt.im.count = n; pt.im.visible = n > 0;
        }
      }
      // 树：主角北边远了的那几条换成省的（来回走的时候在分界上留一点余量，不反复换）；换了要重画一次影子
      for (let i = 0; i < treeBands.length; i++) {
        const b = treeBands[i], near = camT.z - b.z1 < TREE_NEAR + (b.near ? 1.5 : 0);
        if (near === b.near) continue;
        b.near = near; b.fine.forEach(o => { o.visible = near; }); b.coarse.forEach(o => { o.visible = !near; });
        if (Q.shadow) renderer.shadowMap.needsUpdate = true;
      }
      // 蝴蝶：绕着附近的一小片地方飞；离主角太远了就换到主角前面去
      for (let i = 0; i < flies.length; i++) {
        const f = flies[i];
        if (Math.abs(f.ax - px) > 9 || f.az - pz > 5 || pz - f.az > 14 || t - f.t0 > 40) { f.ax = px + (hash2(i, Math.floor(t)) - .5) * 8; f.az = pz - 2 - hash2(i + 3, Math.floor(t)) * 7; f.t0 = t; }
        const a = t * (.5 + i * .13) + f.ph, x = f.ax + Math.sin(a) * 1.5 + Math.sin(a * 2.3) * .5, z = f.az + Math.cos(a * .8) * 1.2;
        f.o.position.set(x, L.ground(x, z) + .55 + Math.sin(a * 3.1) * .2, z);
        f.o.rotation.y = Math.atan2(Math.cos(a) * 1.5 + Math.cos(a * 2.3) * 1.15, -Math.sin(a * .8) * .96);
        f.o.scale.x = .25 + .75 * Math.abs(Math.sin(t * 13 + f.ph));
      }
      // 影子：范围跟着镜头走，按 4 格对齐，挪了才重画
      if (Q.shadow) {
        const sx = Math.round(camT.x / 4) * 4, sz = Math.round((camT.z - 9) / 4) * 4, key = sx + ',' + sz;
        if (key !== snapKey) { snapKey = key; sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 42, SUN_DIR.y * 42, sz + SUN_DIR.z * 42); sun.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true; }
      }
      if (post) {
        const q = post.quad;
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        if (post.a) {
          q.material = post.bright; renderer.setRenderTarget(post.a); renderer.render(post.scene, post.cam);
          q.material = post.blur; post.blur.uniforms.tDiffuse.value = post.a.texture; post.blur.uniforms.uDir.value.set(bloomPx[0], 0); renderer.setRenderTarget(post.b); renderer.render(post.scene, post.cam);
          post.blur.uniforms.tDiffuse.value = post.b.texture; post.blur.uniforms.uDir.value.set(0, bloomPx[1]); renderer.setRenderTarget(post.a); renderer.render(post.scene, post.cam);
          post.comp.uniforms.tBloom.value = post.a.texture;
        }
        q.material = post.comp; renderer.setRenderTarget(null);
        renderer.render(post.scene, post.cam);
      } else renderer.render(scene, camera);
    }
    const GRASS_D = tier === 'high' ? [9, 28] : tier === 'mid' ? [6, 21] : [4, 13];   // 草：离主角多远以内是满的、多远以外没有
    const GRASS_NEAR = tier === 'high' ? 7 : tier === 'mid' ? 4 : 0;
    const TREE_NEAR = tier === 'high' ? 16 : tier === 'mid' ? 10 : 6;   // 树：主角往北多远以内用细的                 // 草：离这么近的那几块用细的零件，再远用省的（省电档只有省的）
    function destroy() {
      clear();
      scene.remove(world);
      folDrop(); dropMesh(fol.icon); dropMesh(player);
      if (window.EchoPeople3D && EchoPeople3D.release) { try { EchoPeople3D.release(); } catch (e) { /* 忽略 */ } }   // 3D 小人共用的网格、脸的贴图、材质
      Object.values(atlasCache).forEach(t => t.dispose());
      Object.values(spriteMats).forEach(x => x.dispose());
      keep.forEach(x => x.dispose && x.dispose());
      if (rt) { rt.dispose(); if (post.dtex) post.dtex.dispose(); if (post.a) { post.a.dispose(); post.b.dispose(); } post.bright.dispose(); post.blur.dispose(); post.comp.dispose(); post.quad.geometry.dispose(); }
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove();
    }
    // 贴图和画面缓冲大约占多少显存（MB，按尺寸估的：影子图、树叶 / 地面细节 / 云 / 噪声贴图、这张地图的遮罩和房子贴画、人物的图、抗锯齿的画面缓冲）
    function texMB() {
      const px = (im, mip) => (im ? im.width * im.height * 4 * (mip ? 4 / 3 : 1) : 0);
      let b = Q.shadow ? Q.shadow * Q.shadow * 4 : 0;
      [leafTex, detailTex, cloudTex, noiseTex].forEach(t => { b += px(t.image, true); });
      own.forEach(o => { if (o.isTexture) b += px(o.image, o.generateMipmaps); });
      Object.values(atlasCache).forEach(t => { b += px(t.image, true); });
      if (rt) { const n = rt.width * rt.height; b += n * 8 * Math.max(1, rt.samples || 1) + n * 8; if (post.a) b += post.a.width * post.a.height * 8; }
      return Math.round(b / 1048576);
    }
    return {
      kind: '3d', canvas, load, resize, draw, destroy, glState, info: () => renderer.info,
      // marks：现在画着几块委托的「?」牌子；probe：测试和 tools/look 用（地面多高、人站在哪、跟着走的是模型还是纸片）
      marks: () => spriteList.filter(s => s.quest && s.quest.visible && s.root.visible).length,
      // 场景里每种东西（按材质分）有几个网格、多少三角形（按多到少），查「哪样东西最费」用；只算现在画着的
      stats: () => { const by = {}; world.traverse(o => { const g = o.geometry; if (!g || !o.visible) return; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1), k = (o.material.userData.o || {}).key || o.material.type, r = by[k] || (by[k] = [0, 0, k]); r[0] += Math.round(n); r[1]++; }); return Object.values(by).sort((a, b) => b[0] - a[0]); },
      probe: () => ({
        texMB: texMB(), buildMs, geoMs, line: !!(post && post.line), tier, look: INFO,
        grass: { chunks: grassChunks.filter(c => !c.extra).length, near: grassChunks.filter(c => c.near && !c.extra).length, drawn: grassChunks.reduce((a, c) => a + c.parts.reduce((b, p) => b + (p.im.visible ? p.im.count : 0), 0), 0), all: grassChunks.reduce((a, c) => a + c.parts.reduce((b, p) => b + (p.fine ? 0 : p.n), 0), 0) },
        outer: (x, z) => { const o = {}; const h = LAND.outer(x, z, o); return { h, hill: o.hill, val: o.val, land: o.landK }; },
        at: (x, z) => LAND.at(x, z), ground: (x, z) => LAND.ground(x, z), step: LAND.step, sea: LAND.SEA,
        player: player.root.position.toArray(), hop: player.inst ? player.inst.root.position.y : player.mesh ? player.mesh.position.y : 0,
        // 人物用的是 3D 小人还是纸片（怪兽的图标不算）；每个人头顶多高、头上的牌子在多高（都是相对脚底）
        p3: { on: !!window.EchoPeople3D, player: !!player.inst, people: spriteList.filter(s => s.root.visible && s.inst).length, paper: spriteList.filter(s => s.root.visible && !s.inst && s.mesh && s.key.slice(0, 4) !== 'mon:').length, live: window.EchoPeople3D && EchoPeople3D.stats ? EchoPeople3D.stats().live : 0 },
        heads: spriteList.filter(s => s.root.visible).map(s => ({ top: headTop(s), alert: s.alert && s.alert.visible ? s.alert.position.y : null, quest: s.quest && s.quest.visible ? s.quest.position.y : null })), hintTop: hintS.visible ? hintS.position.y : null, follower: fol.root.visible ? fol.root.position.toArray() : null, model: !!fol.R, icon: !fol.R && !!fol.icon.mesh,
        people: spriteList.filter(s => s.root.visible).map(s => s.root.position.toArray()), picks: pickS.filter(p => p.o.visible).map(p => p.o.position.toArray()),
        hint: hintS.visible ? hintS.position.toArray() : null, cam: camera.position.toArray(), pitch: -camera.rotation.x, yaw: camera.rotation.y, fov: camera.fov, hole: U.uHole.value.toArray(), alerts: spriteList.filter(s => s.alert && s.alert.visible && s.root.visible).length, buildings: BLD.length, faded: BLD.filter(b => b.cur > .4).length,
      }),
    };
  }

  // 给 world.js 用的渲染器：户外地图用上面的新渲染器，其余的地图（室内、挑战馆、洞穴、海底……）交给 world3d.js 的老渲染器。
  // 两个渲染器各有一张画布，用哪个就显示哪张；老的那个第一次进屋时才建，之后一直留着（进出房子不用每次重建）
  function create(view, tier, A) {
    const open = createOpen(view, tier, A);
    if (!open) return null;
    let old = null, oldCv = null, cur = open;
    const show = () => { open.canvas.style.display = cur === open ? '' : 'none'; if (oldCv) oldCv.style.display = cur === old ? '' : 'none'; };
    function pick(map) {
      if (supports(map) || !window.EchoWorld3D) return open;
      if (!old) { try { old = EchoWorld3D.create(view, tier, A); } catch (e) { old = null; } oldCv = old ? view.querySelector('canvas.w-canvas') : null; }
      return old || open;   // 老渲染器建不出来（不该发生）：新的硬着头皮画
    }
    return {
      kind: '3d', look: 'new',
      load(map, api) { cur = pick(map); show(); cur.load(map, api); },
      resize() { cur.resize(); },
      draw(now, V) { cur.draw(now, V); },
      destroy() { open.destroy(); if (old) old.destroy(); },
      glState: () => cur.glState(),
      info: () => cur.info(),
      marks: () => cur.marks(),
      using: () => (cur === open ? 'open' : 'std'),     // 现在这张地图是谁在画（测试用）
      probe: () => (cur === open ? open.probe() : null),
      statsOpen: () => (cur === open ? open.stats() : null),
    };
  }

  window.EchoWorldOpen = { on: LOOK === 'new', supports, create, TIERS };
})();
