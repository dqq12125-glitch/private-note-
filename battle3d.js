// 回声岛 · 3D 战斗画面：两只 3D 怪兽站在台子上，招式有按属性做的特效（粒子、光束、闪电、冰刺、落石……）
// monsters.js 负责战斗规则，这里只负责画面：enter 出场、attack 放招（返回命中时刻）、hit 受击、faint 倒下、catchThrow 扔球
// 特效 2.0（规格见 tools/FX_SPEC.md）：这里管场景、怪兽、运镜、attack() 的流程（蓄力 → 大招过场 → 扑出去 → 出招 → 命中 → 余韵），
// 再把一整套特效工具打包成 kit 交给特效库。各属性的招式特效登记在 window.BattleFX（battle-fx-elements / energy / physical.js），
// 音效在 battle-sfx.js（window.BattleSFX）。没登记的属性用这里保底的老特效
(function () {
  'use strict';
  const T3 = window.THREE;
  if (!T3 || !window.Mon3D) return;
  const V = (x, y, z) => new T3.Vector3(x, y, z);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const TYPE_COL = {
    normal: ['#ffffff', '#d7d2b8'], fire: ['#ff7a2f', '#ffd54f'], water: ['#3fa9f5', '#bdefff'], grass: ['#5fd35f', '#d4ff8a'], spark: ['#ffe14d', '#ffffff'],
    ice: ['#9be7ff', '#ffffff'], fight: ['#ff7043', '#fff3e0'], poison: ['#b25ce6', '#e8b8ff'], ground: ['#c9964a', '#f0d7a0'], flying: ['#cfe3ff', '#ffffff'],
    psychic: ['#ff5ea8', '#ffd0e8'], bug: ['#a6d11f', '#eaff9a'], rock: ['#b09a50', '#e8dcb0'], ghost: ['#7d5ce6', '#2a1a4a'], dragon: ['#6a4dff', '#ff5ea8'],
    dark: ['#4a3a55', '#b388ff'], steel: ['#b0c4d4', '#ffffff'],
  };
  // 画质（FX_SPEC §7）：粒子上限、粒子数量倍率、临时点光源个数、发光后期、同时最多几块贴花、贴花和拖尾的长短（低画质减半）
  const QUAL = {
    high: { maxp: 2000, pmul: 1, lights: 2, bloom: true, decals: 8, trail: 1 },
    mid: { maxp: 900, pmul: .7, lights: 0, bloom: false, decals: 6, trail: 1 },
    low: { maxp: 400, pmul: .45, lights: 0, bloom: false, decals: 3, trail: .5 },
  };
  // 从开始蓄力到命中的时长上限（毫秒）：小招 / 中招 / 大招；辅助招式。出招超过上限 + 1.2 秒还没命中就当命中了（保险，别卡住战斗）
  const CAP = [1000, 1600, 2800], CAP_SUPPORT = 1200;
  const warn = (what, e) => { try { console.warn('[Battle3D] ' + what, e && e.message ? e.message : (e || '')); } catch (x) { /* 忽略 */ } };
  // 特效登记表：battle-fx-*.js 往 types / support 里登记，common 放所有属性共用的环节（编排用：charge / cutin / impact / after）
  const BFX = () => { const R = window.BattleFX = window.BattleFX || { types: {}, support: {} }; R.types = R.types || {}; R.support = R.support || {}; return R; };
  BFX();

  // ---------- 特效着色器 ----------
  // 公用的噪声：h21 哈希、vn 值噪声、fbm 叠 4 层
  const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
uniform float uCover;
void fxOut(vec3 c, float a) {
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
  a = clamp(a, 0., 1.);
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * uCover);
}
`;
  // 特效的混合方式统一用「预乘 alpha」：输出 (颜色 × a, a × uCover)。uCover = 0 是纯叠加发光（越叠越亮），1 是普通的不透明颜料，
  // 中间值既发光又能盖住一点背景——白天明亮的场地上颜色才不会被冲成一片白（暗颜色自动用 .9，看得见）
  // 方片（火焰、冲击波、命中星、贴花、魔法阵、周身光、柔光点）共用的顶点着色器：uBill=1 面向镜头（可以转 uRot、往镜头挪 uPush、按 uAnchor 移锚点），0 就按物体自己的朝向（平铺地面）
  const QUAD_VS = `
uniform float uBill; uniform float uRot; uniform vec2 uAnchor; uniform float uPush;
varying vec2 vUv;
void main() {
  vUv = uv;
  if (uBill > .5) {
    vec2 p = position.xy + uAnchor;
    float c = cos(uRot), s = sin(uRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
    mv.xy += p * sc;
    mv.z += uPush;
    gl_Position = projectionMatrix * mv;
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
}`;
  const QUAD_HEAD = `
uniform vec3 uCol; uniform vec3 uCol2; uniform float uOp; uniform float uK; uniform float uSeed; uniform float uTime; uniform vec4 uP;
varying vec2 vUv;
`;
  const QUAD_FS = {
    // 程序噪声火焰：往上卷的噪声、往上收窄，外圈 uCol、里面 uCol2、最热的地方发白
    flame: `
void main() {
  vec2 uv = vUv;
  float t = uTime + uSeed * 10.;
  float n = fbm(vec2(uv.x * 3. + uSeed * 7., uv.y * 2.2 - t * 2.4));
  float n2 = vn(vec2(uv.x * 6. - uSeed * 3., uv.y * 4. - t * 4.));
  float x = (uv.x - .5) * 2. + (n - .5) * .75 * uv.y;   // 越往上摆得越厉害
  float d = abs(x) / mix(.85, .08, pow(uv.y, .9));      // 往上收窄
  float top = uv.y + (n - .5) * .55 + (n2 - .5) * .2;
  float body = (1. - smoothstep(.5, 1., d)) * (1. - smoothstep(.5, .95, top)) * smoothstep(0., .06, uv.y);
  float heat = (1. - min(d, 1.)) * (1. - uv.y * .85) + (n2 - .5) * .3;   // 中间偏下最热
  vec3 c = mix(uCol * .8, uCol, smoothstep(0., .3, heat));
  c = mix(c, uCol2, smoothstep(.3, .62, heat));
  c = mix(c, vec3(1., .96, .86), smoothstep(.68, .95, heat) * .75);
  fxOut(c, body * uOp);
}`,
    // 冲击波：一圈亮环（粗细带噪声）+ 环里淡淡一层 + 放射状的速度线；uP.x = 环的相对粗细
    shock: `
void main() {
  vec2 p = vUv - .5; float d = length(p) * 2.; float a = atan(p.y, p.x);
  float th = max(uP.x, .02);
  float n = vn(vec2(a * 5. + uSeed * 20., d * 3. - uTime * 2.));
  float ring = exp(-pow((d - .86) / (th * (.55 + .7 * n)), 2.));
  float inner = smoothstep(.86, .2, d) * smoothstep(0., .5, d) * .22;
  float streak = pow(vn(vec2(a * 18. + uSeed * 40., uSeed)), 4.) * smoothstep(.45, .86, d) * (1. - smoothstep(.86, .98, d));
  float v = ring + (inner + streak * .8) * (1. - uK);
  vec3 c = mix(uCol, vec3(1.), clamp((ring - .55) * 1.2 * (1. - uK * .8), 0., 1.));
  fxOut(c, v * uOp * (1. - smoothstep(.97, 1., d)));
}`,
    // 命中星（动画式）：长短不一的尖刺 + 错开半格的小星 + 白芯；uP.x = 尖刺数，uP.y = 从里往外掏空的进度
    star: `
void main() {
  vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.y, p.x) + 3.14159265;
  float N = max(3., uP.x);
  float s1 = a / 6.2831853 * N; float f1 = fract(s1);
  float L1 = mix(.55, 1., h21(vec2(floor(s1), uSeed * 13.)));
  float R1 = mix(.2, L1, pow(1. - abs(f1 - .5) * 2., 2.4));
  float s2 = s1 + .5; float f2 = fract(s2);
  float L2 = mix(.3, .6, h21(vec2(floor(s2), uSeed * 7. + 3.)));
  float R2 = mix(.16, L2, pow(1. - abs(f2 - .5) * 2., 2.6));
  float outer = 1. - smoothstep(R1 - .03, R1, r);
  float inner = 1. - smoothstep(R2 - .03, R2, r);
  float hole = smoothstep(uP.y - .04, uP.y, r / max(R1, .01));
  float core = (1. - smoothstep(0., .3, r)) * (1. - uK);
  vec3 c = mix(uCol, mix(uCol2, vec3(1.), .7), max(inner, core));
  fxOut(c, max(outer * hole, core) * uOp);
}`,
    // 地面贴花：uP.x = 0 焦痕 / 1 冰霜 / 2 地裂 / 3 水渍 / 4 光斑
    decal: `
void main() {
  vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.y, p.x);
  float n = fbm(p * 2.2 + uSeed * 9.);
  float er = .8 + (n - .5) * .4;
  float disc = 1. - smoothstep(er - .14, er, r);
  int kd = int(uP.x + .5);
  vec3 c = uCol; float al = 0.;
  if (kd == 0) {
    c = mix(vec3(.04, .03, .02), uCol * .35, clamp(smoothstep(.1, .9, r / er) * .7 + (n - .5) * .3, 0., 1.));
    float ember = clamp(smoothstep(.1, 0., abs(r - er + .07)) * (1. - uK * 1.8) * (.6 + .8 * vn(vec2(a * 9., uTime * 3.))), 0., 1.);
    c = mix(c, uCol2, ember);
    al = disc * (.62 + .2 * n) + ember * .3;
  } else if (kd == 1) {
    float sp = pow(abs(cos(a * 5. + (n - .5) * 2.)), 24.) * (1. - smoothstep(.15, er + .1, r));
    float sp2 = pow(abs(cos(a * 9. + 1.3 + n * 3.)), 30.) * (1. - smoothstep(.1, er * .7, r));
    float glint = step(.97, h21(floor(p * 18.) + floor(uTime * 3.))) * disc;
    c = mix(mix(vec3(.85, .95, 1.), uCol, .35), vec3(1.), clamp(sp + sp2 + glint, 0., 1.));
    al = disc * (.32 + .25 * n) + (sp + sp2) * .55 + glint * .6;
  } else if (kd == 2) {
    float k = a / 6.2831853 * 7. + (n - .5) * .9 + r * .2;
    float f = abs(fract(k) - .5);
    float len = mix(.45, 1., h21(vec2(floor(k), uSeed)));
    float line = (1. - smoothstep(.02, .06 + .03 * (1. - r), f * (1. + r * 1.5))) * (1. - smoothstep(len - .1, len, r));
    float pit = 1. - smoothstep(.12, .32 + (n - .5) * .2, r);
    c = mix(uCol * .3, vec3(.06, .045, .03), .7);
    al = max(line * .85, pit * .6);
  } else if (kd == 3) {
    float rim = smoothstep(.1, 0., abs(r - er + .05));
    float drop = step(.9, h21(floor(p * 6.) + uSeed)) * (1. - smoothstep(.12, .2, length(fract(p * 6.) - .5))) * step(er, r) * (1. - smoothstep(.9, 1., r));
    c = mix(uCol * .55, mix(uCol, vec3(1.), .5), rim);
    al = disc * (.42 + .15 * n) + rim * .2 + drop * .5;
  } else {
    c = mix(uCol, vec3(1.), pow(max(0., 1. - r * 1.6), 3.));
    al = pow(max(0., 1. - r), 1.6) * (.75 + .5 * n) * .9;
  }
  fxOut(c, al * uOp);
}`,
    // 魔法阵：两道圆环、反着转的六边形和三角、（uP.z=1 时）一圈转动的符文；uP.y = 画出来的进度（从 0 度转一圈）
    circle: `
void main() {
  vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.y, p.x);
  float ang = (a + 3.14159265) / 6.2831853;
  float reveal = step(ang, uP.y);
  float t = uTime;
  float line = (1. - smoothstep(0., .03, abs(r - .95))) + (1. - smoothstep(0., .022, abs(r - .8))) * .9;
  float band = 0.;
  if (uP.z > .5 && r > .815 && r < .935) {
    float cell = fract(ang + t * .03) * 28.;
    vec2 q = vec2(fract(cell), (r - .815) / .12) - .5;
    float hh = h21(vec2(floor(cell), uSeed * 5.));
    if (hh < .25) band = 1. - smoothstep(.12, .2, length(q));
    else if (hh < .5) band = (1. - smoothstep(.06, .12, abs(q.x))) * (1. - smoothstep(.28, .34, abs(q.y)));
    else if (hh < .75) band = (1. - smoothstep(0., .08, abs(abs(q.x) * 1.3 + q.y * .9 - .1))) * step(abs(q.y), .32);
    else band = (1. - smoothstep(.06, .12, abs(abs(q.x) - .18))) * (1. - smoothstep(.22, .28, abs(q.y)));
  }
  float seg = 1.0471976;
  float hx = r * cos(mod(a - t * .4, seg) - seg * .5) / cos(seg * .5);
  float hexl = 1. - smoothstep(0., .03, abs(hx - .62));
  float seg3 = 2.0943951;
  float tx = r * cos(mod(a + t * .6, seg3) - seg3 * .5) / cos(seg3 * .5);
  float tril = (1. - smoothstep(0., .03, abs(tx - .7))) * .7;
  float fill = (1. - smoothstep(.2, .98, r)) * .1;
  float v = (line + band + hexl * .8 + tril) * reveal + fill;
  vec3 c = mix(uCol, vec3(1.), clamp((line + band) * .35, 0., .6));
  fxOut(c, v * (1. - smoothstep(.97, 1., r)) * uOp);
}`,
    // 怪兽周身的光：带噪声的一圈外壳 + 往上飘的光丝
    aura: `
void main() {
  vec2 p = (vUv - .5) * 2.;
  float d = length(p * vec2(1.2, .92));
  float a = atan(p.y, p.x);
  float n = fbm(vec2(a * 1.5 + uSeed * 5., d * 2.4 - uTime * 2.4));
  float up = fbm(vec2(p.x * 2.6 + uSeed * 3., p.y * 1.7 - uTime * 3.));
  float shell = smoothstep(1., .66, d + (n - .5) * .5) * smoothstep(.3, .74, d + (n - .5) * .25);
  float wisp = smoothstep(.5, .8, up) * (1. - smoothstep(.45, 1.05, d)) * smoothstep(-.7, .5, p.y);
  float v = (shell * .85 + wisp * .55) * smoothstep(-1., -.55, p.y);   // 底下淡掉：插进台面时不会有一道直边
  vec3 c = mix(uCol, uCol2, clamp(n * 1.3 - .2, 0., 1.)) + vec3(.35) * pow(shell, 3.);
  fxOut(c, v * uOp);
}`,
    // 柔光点
    glow: `
void main() {
  float r = length(vUv - .5) * 2.;
  float v = pow(max(0., 1. - r), 2.2);
  float core = pow(max(0., 1. - r * 2.4), 2.);
  fxOut(mix(uCol, vec3(1.), core), (v + core) * uOp);
}`,
  };
  // 着色器光束：顶点着色器里沿 a→b 拉成一条永远面向镜头的带子，两头收细；uGrow 是光束已经伸出去多远（0–1）
  const BEAM_VS = `
uniform vec3 uA; uniform vec3 uB; uniform float uW; uniform float uGrow; uniform float uTaper;
varying vec2 vUv;
void main() {
  float y = position.y * uGrow;
  vec3 P = mix(uA, uB, y);
  vec3 ax = normalize(uB - uA);
  vec3 tc = normalize(cameraPosition - P);
  vec3 sd = cross(ax, tc);
  float sl = length(sd);
  sd = sl > .0001 ? sd / sl : vec3(0., 1., 0.);
  float tp = .35 + .65 * smoothstep(0., uTaper, y);
  float te = .25 + .75 * smoothstep(0., uTaper * .6, uGrow - y);
  P += sd * position.x * uW * tp * te;
  vUv = vec2(position.x + .5, y);
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.);
}`;
  const BEAM_FS = `
uniform vec3 uCol; uniform vec3 uCol2; uniform float uOp; uniform float uSeed; uniform float uTime; uniform float uLen; uniform float uNoise;
varying vec2 vUv;
void main() {
  float x = abs(vUv.x - .5) * 2.;
  float along = vUv.y * uLen;
  float t = uTime;
  float n = fbm(vec2(along * 2. - t * 9., vUv.x * 2.5 + uSeed * 10.));
  float n2 = vn(vec2(along * 5. - t * 15., vUv.x * 6. + uSeed));
  float wob = (n - .5) * .5 * uNoise;
  float xe = x - wob * .6;   // 边缘跟着噪声抖
  float body = 1. - smoothstep(.5, .78, xe);   // 属性色的光身
  float halo = pow(max(0., 1. - xe), 2.) * .4;   // 外面一层淡光
  float core = 1. - smoothstep(.1, .3, x + (n2 - .5) * .14);   // 白热的芯
  float stripes = smoothstep(.55, 1., sin(along * 6. - t * 28. + x * 2.) * .5 + .5) * .35 * body;
  float flick = .86 + .14 * vn(vec2(t * 38., uSeed * 7.));
  vec3 bc = mix(uCol, uCol2, clamp(n * 1.3 + n2 * .3 - .3, 0., 1.));
  bc = mix(bc * .65, bc, smoothstep(.78, .35, xe)) * (1. + stripes);   // 外缘深一点：亮背景上也有轮廓
  vec3 c = mix(bc, vec3(1.), core);
  fxOut(c, (max(body * .92, halo) + core) * flick * uOp);
}`;
  // 带子（闪电、拖尾）：CPU 每帧算好面向镜头的两排顶点，aUv.x 是横向 -1..1，aUv.y 沿着线 0..1，aI 是亮度
  const RIB_VS = `
attribute vec2 aUv; attribute float aI;
varying vec2 vUv; varying float vI;
void main() { vUv = aUv; vI = aI; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  const RIB_FS = `
uniform vec3 uCol; uniform vec3 uCol2; uniform float uOp; uniform float uCore; uniform float uTime; uniform float uSeed;
varying vec2 vUv; varying float vI;
void main() {
  float v = vUv.x;
  float core = exp(-v * v * uCore);   // 白芯（uCore 越大越细）
  float body = exp(-v * v * 7.);      // 属性色的线身
  float halo = exp(-v * v * 1.6) * .35;
  float n = vn(vec2(vUv.y * 10. - uTime * 8. + uSeed * 30., v * 2.));
  vec3 bc = mix(uCol, uCol2, n * .5);
  bc = mix(bc * .65, bc, body);
  vec3 c = mix(bc, vec3(1.), clamp(core * 1.2, 0., 1.));
  fxOut(c, (max(body * .85, halo) + core) * vI * uOp);
}`;
  // 粒子：图集里 4 种样子（0 光点 / 1 四角星 / 2 烟团 / 3 泡泡环），可以自转；混合也是预乘 alpha，每颗粒子自己的 cover
  // （0 叠加发光、1 普通颜色——和以前「亮颜色叠加、暗颜色普通混合」的两组粒子画出来一样）
  const P_VS = `
attribute float size; attribute float alpha; attribute float tex; attribute float rot; attribute float cover; attribute vec3 color;
varying vec3 vC; varying float vA; varying float vT; varying vec2 vR; varying float vCv;
uniform float uScale;
void main() {
  vC = color; vA = alpha; vT = tex; vR = vec2(cos(rot), sin(rot)); vCv = cover;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
  // 叠加的粒子透明度打个折（.55）：一大团粒子叠在一起不会整片变成白色（水还是蓝的）
  const P_FS = `
uniform sampler2D uTex;
varying vec3 vC; varying float vA; varying float vT; varying vec2 vR; varying float vCv;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  pc = vec2(vR.x * pc.x - vR.y * pc.y, vR.y * pc.x + vR.x * pc.y);
  pc = clamp(pc + 0.5, 0.02, 0.98);
  float cx = mod(vT, 2.0), cy = floor(vT * 0.5 + 0.01);
  vec4 t = texture2D(uTex, vec2((cx + pc.x) * 0.5, 1.0 - (cy + pc.y) * 0.5));
  float wh = abs(vT - 2.0) < 0.5 ? 0.0 : 0.45;
  float core = smoothstep(0.55, 1.0, t.a);
  float A = t.a * vA * mix(0.55, 1.0, vCv);
  gl_FragColor = vec4(mix(vC, vec3(1.0), core * wh) * A, A * vCv);
}`;
  // 发光后期：全屏三角形、可分离的高斯模糊（5 次取样 = 9 格）、叠加回屏幕
  const POST_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
  const BLUR_FS = `
uniform sampler2D tSrc; uniform vec2 uDir; uniform float uThr;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * .2270270270;
  s += texture2D(tSrc, vUv + uDir * 1.3846153846).rgb * .3162162162;
  s += texture2D(tSrc, vUv - uDir * 1.3846153846).rgb * .3162162162;
  s += texture2D(tSrc, vUv + uDir * 3.2307692308).rgb * .0702702703;
  s += texture2D(tSrc, vUv - uDir * 3.2307692308).rgb * .0702702703;
  if (uThr > 0.) s = max(s - uThr, 0.) / (1. - uThr);
  gl_FragColor = vec4(s, 1.);
}`;
  const COMP_FS = `
uniform sampler2D tA; uniform sampler2D tB; uniform float uS;
varying vec2 vUv;
void main() {
  vec3 c = (texture2D(tA, vUv).rgb * .9 + texture2D(tB, vUv).rgb * .6) * uS;
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;
  const BLOOM_BASE = .32;   // 放招时发光后期的基础强度（kit.bloom 临时加强）
  // 大招过场横幅里的速度线（横向能平铺的一张图，所有战斗共用，只画一次）：长短粗细不一的光痕，头亮尾淡
  let SPEED_URL = null;
  function speedTex() {
    if (SPEED_URL != null) return SPEED_URL;
    try {
      const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      let sd = 11; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;   // 固定的随机数，每次画得一样
      for (let i = 0; i < 44; i++) {
        const y = 4 + r() * (H - 8), len = 50 + r() * 230, x0 = r() * W, th = .6 + r() * 2.4, al = .22 + r() * .6;
        [x0, x0 - W].forEach(x => {   // 超出右边的部分从左边再画一次：横向接得上
          const gr = g.createLinearGradient(x, 0, x + len, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.75, 'rgba(255,255,255,' + al.toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(x + len / 2, y, len / 2, th, 0, 0, Math.PI * 2); g.fill();
        });
      }
      SPEED_URL = c.toDataURL('image/png');
    } catch (e) { SPEED_URL = ''; }
    return SPEED_URL;
  }

  function create(host, opts) {
    opts = opts || {};
    const Q = QUAL[opts.quality] ? opts.quality : 'mid', QS = QUAL[Q];
    let raf = 0, last = 0, alive = true, nextDraw = 0, fxNow = 0, monT = 0, warmed = false;
    let canvas = document.createElement('canvas');   // 画面丢了重建时会换一张（见 glRebuild）
    canvas.className = 'b3d';
    let renderer;
    try { renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' }); } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = T3.PCFShadowMap;
    // ---------- 画面丢了（webglcontextlost：切去微信再回来、系统收回显存）：不留黑屏（评估第 15 条）----------
    // 丢了先不画；恢复了（three.js 自己重建 GPU 资源）就重画影子、重新预编译特效；2.5 秒还没恢复，换一张新画布、新的 WebGL 接着画——
    // 场景、怪兽、特效都是 CPU 这边的对象，换一个渲染器照样能画，战斗不用重来
    const GL = { lost: 0, n: 0 };
    const glLog = m => { try { if (window.EchoErr) EchoErr.log('gl', m, 'battle3d'); } catch (e) { /* 忽略 */ } };
    function glWatch(c) {
      c.addEventListener('webglcontextlost', e => { e.preventDefault(); if (c === canvas && alive) { GL.lost = performance.now(); GL.n++; glLog('对战 3D 画面丢了'); } }, false);   // destroy() 自己释放的不算
      c.addEventListener('webglcontextrestored', () => { if (c !== canvas) return; GL.lost = 0; warmed = false; renderer.shadowMap.needsUpdate = true; try { resize(); } catch (e) { /* 忽略 */ } }, false);
    }
    glWatch(canvas);
    function glRebuild() {
      const nc = document.createElement('canvas');
      nc.className = 'b3d';
      let nr = null;
      try { nr = new T3.WebGLRenderer({ canvas: nc, antialias: true, alpha: false, powerPreference: 'default' }); } catch (e) { nr = null; }
      if (!nr || !nr.getContext()) { GL.lost = performance.now(); return false; }   // 还是建不出来：过 2.5 秒再试
      nr.shadowMap.enabled = renderer.shadowMap.enabled; nr.shadowMap.type = renderer.shadowMap.type;
      const old = renderer, oc = canvas;
      renderer = nr; canvas = nc; glWatch(nc);
      try { old.dispose(); } catch (e) { /* 丢了的画面释放不干净也没关系 */ }
      if (oc.parentNode) oc.replaceWith(nc);
      GL.lost = 0; warmed = false;
      try { resize(); } catch (e) { /* 忽略 */ }
      glLog('对战 3D 画面已重建');
      return true;
    }
    const scene = new T3.Scene();
    const FOV = 38;
    const cam = new T3.PerspectiveCamera(FOV, 1, .1, 200);
    // 默认机位（2026-10-08 按评审改）：从侧面正对着两只怪兽，自己在左、对手在右，一样大、一样远；低一点、平一点，远景画露得多
    const CAM = { pos: V(0, 1.6, 6.9), look: V(0, .78, 0) };
    const hemi = new T3.HemisphereLight(0xeaf6ff, 0x9fcf7a, 1.5);
    const sun = new T3.DirectionalLight(0xfff1d8, 2.2);
    sun.position.set(-3, 7, 4); sun.castShadow = renderer.shadowMap.enabled; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 }); sun.shadow.bias = -.001;
    // 灯在所有层都亮：发光后期只画特效层时灯光数量不变，材质不用换着色器
    hemi.layers.enableAll(); sun.layers.enableAll();
    scene.add(hemi, sun);
    // 减少动态效果（系统设置）时只用默认机位；减少动态效果或关了运镜：不运镜、不放慢、不闪屏（FX_SPEC §6）
    const RM = opts.reduced != null ? !!opts.reduced : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const CINE = opts.cinematic !== false && !RM;
    const EZ = {
      io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
      out: k => 1 - Math.pow(1 - k, 3),
      sine: k => .5 - Math.cos(k * Math.PI) / 2,
    };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const sph = s => V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(s);
    const C = h => new T3.Color(h);
    const lum = c => c.r * .3 + c.g * .59 + c.b * .11;   // 线性颜色的亮度
    const DIM = .09;
    // 统计（给 tools/fx.html、tools/fx-shots.js 看）：同时最多多少粒子、闪屏次数、被限频跳过的闪屏、出招超时
    const stats = { peak: 0, flashes: 0, flashSkipped: 0, over: 0, move: null };

    // ---------- 场地 ----------
    const env = new T3.Group(); scene.add(env);
    const POS = { me: V(-1.75, 0, 0), foe: V(1.75, 0, 0) };
    const ARENA_C = V((POS.me.x + POS.foe.x) / 2, 0, (POS.me.z + POS.foe.z) / 2);
    // 远景画（theme.backdrop）：像舞台布景一样画在最底层（不参与深度），贴在一圈很远的圆柱内壁上。
    // 竖直方向按默认机位摆：画里的地平线落在画面上方 43% 处、地标顶（画高 15% 处）刚好到画面顶；
    // 横向一张画占 90°，左右镜像接成一整圈（镜头转到哪儿都有画）。画的下半截是平地，往下淡出，露出同色的 3D 地面
    const BD = { R: 60, FH: .43, FT: .03, LM: .15, FLOOR: .64, SEG: 48 };   // 半径、地平线/地标顶在画面的位置、画里地标顶和空地起点的高度比例
    const bdFail = {};   // 载不到的图记住，同一张不再反复请求
    let envTok = 0, bdCur = null;
    const assetUrl = u => /^(https?:|data:|blob:|\/|\.\.?\/)/.test(u) ? u : (window.ECHO_BASE || '') + u;
    function loadImg(url, ok) {
      // file:// 打开时浏览器不让把本地图片当贴图用（跨域），就用程序画的背景
      if (!url || bdFail[url] || (location.protocol === 'file:' && !/^(data:|blob:)/.test(url))) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => ok(img);
      img.onerror = () => { bdFail[url] = 1; };
      img.src = url;
    }
    const imgTex = img => { const tx = new T3.Texture(img); tx.colorSpace = T3.SRGBColorSpace; tx.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1); tx.needsUpdate = true; return tx; };
    // 取画里一块区域的平均颜色（u0..u1、v0..v1 是 0–1 的比例，v 从上往下）
    function avgColor(img, u0, u1, v0, v1) {
      try {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
        const d = g.getImageData(Math.floor(u0 * 64), Math.floor(v0 * 64), Math.max(1, Math.round((u1 - u0) * 64)), Math.max(1, Math.round((v1 - v0) * 64))).data;
        let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4; return new T3.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, T3.SRGBColorSpace);
      } catch (e) { return null; }
    }
    // 按默认机位算圆柱的高低和大小（CAM 变了要重算）
    function backdropMesh(tx, hz, lm, fv) {
      const dir = CAM.look.clone().sub(CAM.pos).normalize(), pitch = Math.asin(dir.y);
      const hd = V(dir.x, 0, dir.z).normalize(), a0 = Math.atan2(hd.x, hd.z);
      // 从默认机位水平往前，到圆柱的距离
      const o = CAM.pos.clone().sub(ARENA_C).setY(0), bq = o.dot(hd), D = -bq + Math.sqrt(bq * bq - o.lengthSq() + BD.R * BD.R);
      const tf = Math.tan(FOV / 2 * Math.PI / 180), ang = f => pitch + Math.atan((1 - 2 * f) * tf);
      const yH = CAM.pos.y + D * Math.tan(ang(BD.FH)), yT = CAM.pos.y + D * Math.tan(ang(BD.FT));
      const H = (yT - yH) / (hz - lm), top = yT + lm * H;   // 画的顶边在世界里的高度；v 往下每 1 就低 H
      const A = Math.PI / 2;   // 一张画占 90°（横向会按这个稍微拉伸/压缩一点），4 张接成一圈
      const f0 = fv + .03, f1 = Math.min(.99, fv + .21), vs = [0, .06, f0, f0 + (f1 - f0) * .33, f0 + (f1 - f0) * .67, f1];
      const alpha = v => v <= .06 ? v / .06 : v <= f0 ? 1 : v >= f1 ? 0 : (k => 1 - k * k * (3 - 2 * k))((v - f0) / (f1 - f0));
      // u 从 -1.5 到 2.5：[0,1] 是原图，两边镜像；首尾都落在原图正中那一列，接缝看不出来
      const fold = u => u < -1 ? u + 2 : u < 0 ? -u : u <= 1 ? u : u <= 2 ? 2 - u : u - 2;
      const NA = BD.SEG * 4, pos = [], uv = [], col = [], idx = [];
      for (let j = 0; j < vs.length; j++) {
        const v = vs[j], y = top - v * H, al = alpha(v);
        for (let i = 0; i <= NA; i++) {
          const u = -1.5 + i / BD.SEG, an = a0 + (u - .5) * A;   // 角度变大是往左转，所以贴图横向反过来
          pos.push(ARENA_C.x + Math.sin(an) * BD.R, y, ARENA_C.z + Math.cos(an) * BD.R);
          uv.push(1 - fold(u), 1 - v);
          col.push(1, 1, 1, al);
        }
      }
      for (let j = 0; j < vs.length - 1; j++) for (let i = 0; i < NA; i++) {
        const p = j * (NA + 1) + i, q = p + NA + 1;
        idx.push(p, q, p + 1, p + 1, q, q + 1);
      }
      const geo = new T3.BufferGeometry();
      geo.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new T3.Float32BufferAttribute(col, 4));
      geo.setIndex(idx);
      // 放在不透明队列里、紧跟地面画：不测深度；混合用 5 = CustomBlending（默认参数就是 SrcAlpha / OneMinusSrcAlpha），
      // 这样 3D 地面在它下面、台子和怪兽在它上面
      const mat = new T3.MeshBasicMaterial({ map: tx, vertexColors: true, depthTest: false, depthWrite: false, fog: false, side: T3.DoubleSide });
      mat.blending = 5;
      const mesh = new T3.Mesh(geo, mat);
      mesh.renderOrder = -1; mesh.frustumCulled = false; mesh.userData.backdrop = true;
      return mesh;
    }
    function placeBackdrop() {
      if (!bdCur) return;
      if (bdCur.mesh) { env.remove(bdCur.mesh); bdCur.mesh.geometry.dispose(); bdCur.mesh.material.dispose(); }
      bdCur.mesh = backdropMesh(bdCur.tx, bdCur.hz, bdCur.lm, bdCur.fv);
      env.add(bdCur.mesh);
    }
    // 朝上的 3D 地面被半球光 + 太阳照着，颜色会偏一点（实测线性空间里约 ×0.96 / ×0.95 / ×0.87），反过来除掉，和画里的平地一个颜色
    const GROUND_L = [.964, .947, .865];
    function setEnv(theme) {
      const tok = ++envTok;
      if (bdCur) { bdCur.tx.dispose(); bdCur = null; }
      while (env.children.length) { const o = env.children.pop(); o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) { if (q.material.map) q.material.map.dispose(); q.material.dispose(); } }); }
      const t = Object.assign({ sky1: '#7fc8f8', sky2: '#e8f7ff', ground: '#8fd16a', hill: '#6fbf5a', pad: '#c8e6a0', rim: '#7aa85a' }, theme || {});
      const skyTex = (c1, c2) => {
        const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
        const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, c1); gr.addColorStop(.7, c2); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
        if (scene.background && scene.background.dispose) scene.background.dispose();
        const st = new T3.CanvasTexture(sky); st.colorSpace = T3.SRGBColorSpace; scene.background = st;
      };
      skyTex(t.sky1, t.sky2);
      scene.fog = new T3.Fog(t.sky2, 14, 34);
      const gMat = new T3.MeshLambertMaterial({ color: t.ground });
      const ground = new T3.Mesh(new T3.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), gMat);
      ground.receiveShadow = true; ground.renderOrder = -2; env.add(ground);
      // 地面贴图（可选，theme.groundTex）：一块能平铺的图
      if (t.groundTex) loadImg(assetUrl(t.groundTex), img => {
        if (tok !== envTok) return;
        const tx = imgTex(img); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.repeat.set(t.groundRepeat || 14, t.groundRepeat || 14);
        gMat.map = tx; gMat.color.set('#ffffff'); gMat.needsUpdate = true;
      });
      // 远处的小山和云（有远景画时藏起来）
      const proc = [];
      for (let i = 0; i < 7; i++) {
        const h = new T3.Mesh(new T3.SphereGeometry(3 + (i % 3), 16, 10), new T3.MeshLambertMaterial({ color: i % 2 ? t.hill : new T3.Color(t.hill).offsetHSL(0, 0, .06) }));
        h.scale.set(1.4, .55, 1); h.position.set(-12 + i * 4.5, -.4, -14 - (i % 2) * 3); env.add(h); proc.push(h);
      }
      for (let i = 0; i < 5; i++) {
        const cl = new T3.Group();
        [[0, 0, .8], [.8, .1, .6], [-.7, .05, .55]].forEach(([x, y, r]) => { const s = new T3.Mesh(new T3.SphereGeometry(r, 12, 8), new T3.MeshBasicMaterial({ color: '#ffffff' })); s.position.set(x, y, 0); cl.add(s); });
        cl.position.set(-9 + i * 5, 6 + (i % 2), -18); cl.userData.drift = .2 + i * .05; env.add(cl); proc.push(cl);
      }
      if (t.backdrop) loadImg(assetUrl(t.backdrop), img => {
        if (tok !== envTok) return;   // 已经换了场地
        // bdFloor：画里空地从多高开始（0–1，从上往下量）；地平线默认在它上面一点
        const fv = t.bdFloor || BD.FLOOR;
        bdCur = { tx: imgTex(img), fv, hz: t.horizon || fv - .06, lm: t.landmark || BD.LM };
        placeBackdrop();
        proc.forEach(o => { o.visible = false; });
        // 3D 地面：用画里平地那一块的平均色（theme.floor 可以强行指定）；天空：画最上面一条的颜色，镜头抬高时接得上
        const gc = t.floor ? new T3.Color(t.floor) : avgColor(img, .3, .7, fv + .05, Math.min(.98, fv + .22));
        if (gc && !t.groundTex) gMat.color.setRGB(gc.r / GROUND_L[0], gc.g / GROUND_L[1], gc.b / GROUND_L[2]);
        const top = avgColor(img, .2, .8, 0, .04);
        if (top) { const hx = '#' + top.getHexString(); skyTex(hx, hx); }
        scene.fog = null;   // 画自己有空气感；3D 地面远处被画盖住，不用雾
      });
      // 没有台子：怪兽脚下是它属性颜色的一圈圈水波（setMon 里按怪兽加，见 ripples）
      env.userData.t = t;
    }

    // ---------- 怪兽 ----------
    const M = { me: null, foe: null };
    // 朝向：在「正对对手」的基础上再转多少。我方平时侧过身来、露出 3/4 正面（图生 3D 的模型背面最难看），
    // 出招时才转过去对着对手，打完再转回来
    const TURN = { me: -.62, foe: .62 }, TURN_ATK = .1;
    // 脚下的水波：三圈属性色的细环，一圈圈往外扩、慢慢变淡（每帧在 ripplesStep 里动）
    const RIP = { me: null, foe: null };
    function ripples(side, sp) {
      if (RIP[side]) { scene.remove(RIP[side]); RIP[side].traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); RIP[side] = null; }
      const T = window.DEX && DEX.TYPES, col = (T && sp && sp.types && T[sp.types[0]] && T[sp.types[0]].color) || '#7aa85a';
      const g = new T3.Group(); g.position.copy(POS[side]).setY(.025);
      for (let i = 0; i < 3; i++) {
        const ring = new T3.Mesh(new T3.TorusGeometry(1, .035, 6, 56).rotateX(Math.PI / 2), new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, depthWrite: false }));
        ring.userData.k = i / 3; ring.renderOrder = 1; g.add(ring);
      }
      RIP[side] = g; scene.add(g);
    }
    function ripplesStep(now) {
      ['me', 'foe'].forEach(side => {
        const g = RIP[side]; if (!g) return;
        const m = M[side]; g.visible = !!(m && !m.gone && m.R.root.visible);
        g.children.forEach(r => { const k = (now / 2400 + r.userData.k) % 1; const s = .45 + k * .85; r.scale.set(s, 1, s); r.material.opacity = .55 * (1 - k) * (k < .12 ? k / .12 : 1); });
      });
    }
    function setMon(side, sp, hidden) {
      if (M[side]) { scene.remove(M[side].R.root); Mon3D.dispose(M[side].R); }
      const R = Mon3D.build(sp, { unique: true });
      R.root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        if (o.material && o.material.isMeshToonMaterial && !o.material.userData.own) o.material = o.material.clone();
        if (o.material && o.material.userData.sprite) o.castShadow = false;
        else o.layers.enable(2);   // 发光后期里当遮挡（怪兽身后的光被挡住）
      });
      const P = POS[side], other = POS[side === 'me' ? 'foe' : 'me'];
      R.root.position.copy(P);
      const yaw = Math.atan2(other.x - P.x, other.z - P.z);
      R.root.rotation.y = yaw + TURN[side];
      const k = 1.15 * (sp.legend ? 1.3 : 1) / Math.max(1, R.height * .9);
      R.root.scale.multiplyScalar(k);
      R.baseScale = R.root.scale.x;
      scene.add(R.root);
      // tintCol / tintV：kit.aura 给怪兽身上加的属性色（自发光），每帧和受击闪白一起算；spin：大招特殊动作的原地转身（弧度，叠加在朝向上）
      M[side] = { R, sp, off: V(0, 0, 0), flash: 0, talk: 0, gone: !!hidden, yaw, turn: TURN[side], spin: 0, tintCol: C('#ffffff'), tintV: 0, tinted: false };
      M[side].mats = mats(side);
      R.root.visible = !hidden;
      ripples(side, sp);
      return M[side];
    }
    const mats = side => { const a = []; M[side].R.root.traverse(o => { if (o.isMesh && o.material && (o.material.isMeshToonMaterial || o.material.userData.sprite)) a.push(o.material); }); return a; };

    // ---------- 共用的几何体和材质：特效反复用同一份，不每次 new（FX_SPEC §3、§7） ----------
    // geo(key, make)：按名字缓存的几何体（userData.shared，特效到期不释放，destroy 时才释放）
    const GEO = {};
    function geo(key, make) { let g = GEO[key]; if (!g) { g = GEO[key] = make(); g.userData.shared = true; } return g; }
    // 材质池：特效到期把材质还回池子（不 dispose），下次接着用——着色器程序一直在，放招不会因为重新编译卡一下
    const MP = {};
    function poolGet(key, make) {
      const p = MP[key] || (MP[key] = { free: [], all: [] });
      let m = p.free.pop();
      if (!m) { m = make(); m.userData.pool = key; p.all.push(m); }
      m.userData.free = false;
      return m;
    }
    function poolPut(m) { const p = MP[m.userData.pool]; if (p && !m.userData.free) { m.userData.free = true; p.free.push(m); } }
    // 发光材质（add：叠加混合，越叠越亮；暗颜色叠加看不见，还用普通混合）
    function glowMat(col, op, add) {
      const m = poolGet('basic', () => new T3.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      m.color.set(col == null ? '#ffffff' : col); m.opacity = op == null ? .9 : op;
      m.blending = add && lum(m.color) >= DIM ? T3.AdditiveBlending : T3.NormalBlending;
      return m;
    }
    // 卡通材质（石头、冰块、叶子……）：o = { transparent, opacity, side, emissive }
    function toonMat(col, o) {
      o = o || {};
      const dbl = o.side === T3.DoubleSide, tr = !!o.transparent || o.opacity != null;
      const m = poolGet('toon' + (tr ? 't' : '') + (dbl ? 'd' : ''), () => new T3.MeshToonMaterial({ transparent: tr, side: dbl ? T3.DoubleSide : T3.FrontSide }));
      m.color.set(col == null ? '#ffffff' : col); m.opacity = o.opacity == null ? 1 : o.opacity; m.emissive.set(o.emissive || '#000000');
      return m;
    }
    // 特效物件到期：共用几何体不动，池子里的材质还回去，其他的释放。
    // 子物件里有自己还活着的特效（addFx 管着、还没到期的）就不碰它：摘出来、让它自己的条目下一帧到期释放——
    // 不然它的材质被提前还回池子、别的特效拿去用了，它的 update 还在改 uniform，到期时又还一次（两个特效共用一个材质，乱闪乱跳）
    function releaseObj(obj) {
      const walk = o => {
        if (o !== obj) {
          const f = o.userData.fxe;
          if (f && !f.done) { o.removeFromParent(); o.visible = false; f.t = f.life; return; }
        }
        const g = o.geometry;
        if (g && !g.userData.shared) { if (g.userData.rib) ribPut(g); else g.dispose(); }
        const ms = o.material;
        if (ms) (Array.isArray(ms) ? ms : [ms]).forEach(m => { if (m.userData.pool) poolPut(m); else m.dispose(); });
        if (o.children.length) o.children.slice().forEach(walk);
      };
      walk(obj);
    }
    // 特效都在第 1 层（发光后期只画这一层）
    const fxLayer = obj => { obj.traverse(o => { o.layers.enable(1); }); return obj; };

    // ---------- 粒子 ----------
    const MAXP = QS.maxp;   // 同时最多多少粒子（按画质：2000 / 900 / 400）
    const TEXI = { glow: 0, star: 1, smoke: 2, ring: 3 };
    // 粒子图集 2×2：光点（和以前一样的径向渐变）、四角星、烟团、泡泡环
    function makeAtlas() {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const rad = (x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, a]) => gr.addColorStop(o, 'rgba(255,255,255,' + a + ')')); return gr; };
      g.fillStyle = rad(32, 32, 32, [[0, 1], [.35, .7], [1, 0]]); g.fillRect(0, 0, 64, 64);
      g.save(); g.beginPath(); g.rect(64, 0, 64, 64); g.clip();
      g.fillStyle = rad(96, 32, 16, [[0, .9], [1, 0]]); g.fillRect(64, 0, 64, 64);
      for (let i = 0; i < 2; i++) {
        g.save(); g.translate(96, 32); g.rotate(i * Math.PI / 2);
        const lg = g.createLinearGradient(-30, 0, 30, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg; g.beginPath(); g.moveTo(-30, 0); g.quadraticCurveTo(0, -3.2, 30, 0); g.quadraticCurveTo(0, 3.2, -30, 0); g.fill(); g.restore();
      }
      g.restore();
      g.save(); g.beginPath(); g.rect(0, 64, 64, 64); g.clip();
      let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;   // 固定的随机数，每次画得一样
      for (let i = 0; i < 9; i++) { const x = 32 + (rr() - .5) * 22, y = 96 + (rr() - .5) * 22, r = 11 + rr() * 9; g.fillStyle = rad(x, y, r, [[0, .42], [.6, .2], [1, 0]]); g.fillRect(0, 64, 64, 64); }
      g.restore();
      g.save(); g.beginPath(); g.rect(64, 64, 64, 64); g.clip();
      const rg = g.createRadialGradient(96, 96, 0, 96, 96, 30); rg.addColorStop(0, 'rgba(255,255,255,.08)'); rg.addColorStop(.72, 'rgba(255,255,255,.18)'); rg.addColorStop(.86, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(64, 64, 64, 64);
      g.fillStyle = rad(86, 86, 7, [[0, .95], [1, 0]]); g.fillRect(64, 64, 64, 64);
      g.restore();
      return new T3.CanvasTexture(c);
    }
    const atlas = makeAtlas();
    // 一个粒子池（一次绘制）：每颗粒子带自己的 cover（亮颜色默认 0 = 叠加发光；暗颜色——幽灵、暗系的黑烟——叠加上去看不见，默认 1 = 普通颜色）
    const pUni = { uTex: { value: atlas }, uScale: { value: 300 } };
    const PP = (() => {
      const g = new T3.BufferGeometry();
      const P = { geo: g, parts: [], n: 0, pos: new Float32Array(MAXP * 3), col: new Float32Array(MAXP * 3), size: new Float32Array(MAXP), alpha: new Float32Array(MAXP), tex: new Float32Array(MAXP), rot: new Float32Array(MAXP), cover: new Float32Array(MAXP) };
      [['position', P.pos, 3], ['color', P.col, 3], ['size', P.size, 1], ['alpha', P.alpha, 1], ['tex', P.tex, 1], ['rot', P.rot, 1], ['cover', P.cover, 1]].forEach(([k, arr, n]) => g.setAttribute(k, new T3.BufferAttribute(arr, n)));
      P.mat = new T3.ShaderMaterial({ uniforms: pUni, vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false, blending: T3.NormalBlending, premultipliedAlpha: true });
      const pts = new T3.Points(g, P.mat); pts.frustumCulled = false; pts.layers.enable(1); scene.add(pts);
      return P;
    })();
    let pCount = 0;
    // p：{ pos, vel, col, size, life, grav, drag, grow（到最后大小是开始的几倍，默认 .5）, fade（前百分之几不淡，默认 0）,
    //      spin（每秒转几弧度，配 star / smoke 才看得出）, tex（'glow' | 'star' | 'smoke' | 'ring'）,
    //      cover（0 叠加发光 … 1 普通颜色；不写按颜色深浅）, blend（老写法：'add' = cover 0，'normal' = cover 1）, alpha }
    // n 按画质自动缩减（高 1 / 中 .7 / 低 .45），总数到上限就不再加
    function emit(n, fn) {
      n = n > 0 ? Math.max(1, Math.round(n * QS.pmul)) : 0;
      for (let i = 0; i < n && pCount < MAXP; i++) {
        const p = fn(i); if (!p) continue;
        if (!p.col || !p.col.isColor) p.col = C(p.col || '#ffffff');
        p.t = p.t || 0; p.life = p.life || .5;
        p.tx = typeof p.tex === 'number' ? p.tex : (TEXI[p.tex] || 0);
        p.r0 = p.spin ? rnd(0, 6.28) : (p.rot || 0);
        p.cv = p.cover != null ? p.cover : p.blend === 'normal' ? 1 : p.blend === 'add' ? 0 : lum(p.col) < DIM ? 1 : 0;
        PP.parts.push(p);
        pCount++;
      }
    }
    function stepParticles(dt) {
      const P = PP, parts = P.parts;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vel.y += (p.grav || 0) * dt; if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.pos.addScaledVector(p.vel, dt);
      }
      const n = parts.length;
      pCount = n;
      if (n > stats.peak) stats.peak = n;
      if (!n && !P.n) return;
      for (let i = 0; i < n; i++) {
        const p = parts[i], k = p.t / p.life, i3 = i * 3, fd = Math.min(.99, p.fade || 0);
        P.pos[i3] = p.pos.x; P.pos[i3 + 1] = p.pos.y; P.pos[i3 + 2] = p.pos.z;
        P.col[i3] = p.col.r; P.col[i3 + 1] = p.col.g; P.col[i3 + 2] = p.col.b;
        P.size[i] = p.size * (1 + ((p.grow == null ? .5 : p.grow) - 1) * k);
        P.alpha[i] = (k <= fd ? 1 : 1 - (k - fd) / (1 - fd)) * (p.alpha == null ? 1 : p.alpha);
        P.tex[i] = p.tx; P.rot[i] = p.r0 + (p.spin || 0) * p.t; P.cover[i] = p.cv;
      }
      P.n = n;
      P.geo.setDrawRange(0, n);
      const at = P.geo.attributes;
      at.position.needsUpdate = at.color.needsUpdate = at.size.needsUpdate = at.alpha.needsUpdate = at.tex.needsUpdate = at.rot.needsUpdate = at.cover.needsUpdate = true;
    }
    // 一团粒子炸开 / 从脚下往上飘
    function burst(at, cols, n, speed, size, life, grav) {
      emit(n, () => ({ pos: at.clone(), vel: sph(rnd(.4, 1) * speed), col: C(cols[Math.random() < .6 ? 0 : 1]), size: size * rnd(.6, 1.3), life: life * rnd(.7, 1.2), t: 0, grav: grav || 0, drag: 1.6 }));
    }
    function rise(at, cols, n, r, h, size, life) {
      emit(n, () => { const a = rnd(0, 6.28), rr = rnd(0, r); return { pos: at.clone().add(V(Math.cos(a) * rr, rnd(0, .2), Math.sin(a) * rr)), vel: V(0, rnd(.6, 1) * h, 0), col: C(cols[Math.random() < .5 ? 0 : 1]), size: size * rnd(.6, 1.2), life: life * rnd(.6, 1.1), t: 0, grav: 0, drag: .5 }; });
    }

    // ---------- 特效用的小物件（带生命周期的网格） ----------
    // addFx(obj, life 秒, update(obj, k 0–1, dt), end)：到期自动移走、释放；update 返回 true 表示提前结束
    const fx = [];
    function addFxE(obj, life, update, end) {
      fxLayer(obj);
      if (!obj.parent) scene.add(obj);
      const f = { obj, t: 0, life: Math.max(.001, life || .5), update, end };
      obj.userData.fxe = f;
      fx.push(f);
      return f;
    }
    function addFx(obj, life, update, end) { return addFxE(obj, life, update, end).obj; }
    function stepFx(dt) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i]; f.t += dt;
        const k = Math.min(1, f.t / f.life);
        let done = false;
        if (f.update) { try { done = f.update(f.obj, k, dt) === true; } catch (e) { warn('特效更新出错', e); done = true; } }
        if (k >= 1 || done) {
          const j = fx.indexOf(f); if (j >= 0) fx.splice(j, 1);
          f.done = true;
          f.obj.removeFromParent();
          if (f.end) { try { f.end(); } catch (e) { warn('特效结束出错', e); } }
          releaseObj(f.obj);
        }
      }
    }
    function ring(at, col, r0, r1, life, thick, flat) {
      const th = Math.round((thick || .06) * 100) / 100;
      const m = new T3.Mesh(geo('torus' + th, () => new T3.TorusGeometry(1, th, 6, 40)), glowMat(col));
      m.position.copy(at); if (flat !== false) m.rotation.x = Math.PI / 2;
      m.scale.setScalar(Math.max(.001, r0));
      return addFx(m, life, (o, k) => { const r = r0 + (r1 - r0) * k; o.scale.set(r, r, r); o.material.opacity = .9 * (1 - k); });
    }
    function orb(col, r) {
      const g = new T3.Group(), s = geo('sph14', () => new T3.SphereGeometry(1, 14, 10));
      const a = new T3.Mesh(s, glowMat(col, .95, true)), b = new T3.Mesh(s, glowMat(col, .35, true));
      a.scale.setScalar(r); b.scale.setScalar(r * 1.8); g.add(a, b);
      return g;
    }
    function bolt(a, b, col, width, jag) {
      const pts = [], n = 9;
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i && i < n) p.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(jag || .25)); pts.push(p); }
      const g = new T3.Group(), cg = geo('cyl5', () => new T3.CylinderGeometry(1, 1, 1, 5));
      for (let i = 0; i < n; i++) {
        const s = pts[i], e = pts[i + 1], len = s.distanceTo(e);
        const seg = new T3.Mesh(cg, glowMat(col, 1));
        seg.scale.set(width, len, width);
        seg.position.copy(s).lerp(e, .5); seg.quaternion.setFromUnitVectors(V(0, 1, 0), e.clone().sub(s).normalize()); g.add(seg);
      }
      return g;
    }
    function beam(a, b, col, width, life) {
      const len = a.distanceTo(b), m = new T3.Mesh(geo('cyl10o', () => new T3.CylinderGeometry(1, 1, 1, 10, 1, true)), glowMat(col, .85));
      m.position.copy(a).lerp(b, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
      m.scale.set(width, len, width);
      return addFx(m, life, (o, k) => { const s = Math.sin(Math.min(1, k * 1.2) * Math.PI); o.scale.set((s + .05) * width, len, (s + .05) * width); o.material.opacity = .9 * s; });
    }
    // 碎块：geoFn() 可以返回 kit.geo 的共用几何体（不会被释放），也可以每块 new 一个（到期释放）
    function chunks(geoFn, col, n, at, spread, life, fly) {
      for (let i = 0; i < n; i++) {
        const m = new T3.Mesh(geoFn(), toonMat(col, { transparent: true }));
        const v = fly ? fly(i) : sph(rnd(1.5, 3)).setY(rnd(1.5, 4));
        m.position.copy(at).add(sph(spread || .2));
        m.rotation.set(rnd(0, 6), rnd(0, 6), 0);
        addFx(m, life, (o, k, dt) => { v.y -= 9 * dt; o.position.addScaledVector(v, dt); o.rotation.x += dt * 6; if (o.position.y < .05) { o.position.y = .05; v.set(v.x * .5, -v.y * .3, v.z * .5); } o.material.opacity = k > .7 ? (1 - k) / .3 : 1; });
      }
    }
    const leafGeo = () => { const s = new T3.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.06, .05, 0, .16); s.quadraticCurveTo(-.06, .05, 0, 0); return new T3.ShapeGeometry(s); };

    // ---------- 新特效工具（FX_SPEC §3） ----------
    const UT = { value: 0 };   // 特效着色器公用的时间（秒，跟着 slowmo 放慢）
    // cover（见 NOISE 后面 fxOut 的说明）：给了就用；暗颜色用 .9（叠加看不见）；否则用这个工具自己的默认值
    const coverOf = (o, col, def) => o && o.cover != null ? o.cover : lum(col) < DIM ? .9 : def;
    const FXMAT = { transparent: true, depthWrite: false, side: T3.DoubleSide, blending: T3.NormalBlending, premultipliedAlpha: true };
    function quadMat(kind) {
      const m = poolGet('q:' + kind, () => {
        const mt = new T3.ShaderMaterial(Object.assign({
          uniforms: { uTime: UT, uBill: { value: 1 }, uRot: { value: 0 }, uAnchor: { value: new T3.Vector2() }, uPush: { value: 0 }, uCol: { value: new T3.Color() }, uCol2: { value: new T3.Color() }, uOp: { value: 1 }, uK: { value: 0 }, uSeed: { value: 0 }, uP: { value: new T3.Vector4() }, uCover: { value: .4 } },
          vertexShader: QUAD_VS, fragmentShader: QUAD_HEAD + NOISE + QUAD_FS[kind],
        }, FXMAT));
        if (kind === 'decal') { mt.polygonOffset = true; mt.polygonOffsetFactor = -1; mt.polygonOffsetUnits = -4; }
        return mt;
      });
      const u = m.uniforms;
      u.uBill.value = 1; u.uRot.value = 0; u.uAnchor.value.set(0, 0); u.uPush.value = 0; u.uOp.value = 1; u.uK.value = 0; u.uSeed.value = Math.random(); u.uP.value.set(0, 0, 0, 0);
      m.depthTest = true;
      return m;
    }
    // 一块方片：bill 面向镜头，否则平放（躺在 xz 平面上）；cover 按 o.cover / 颜色深浅 / 默认值 def
    function quad(kind, bill, col, col2, o, def) {
      const m = new T3.Mesh(geo('quad', () => new T3.PlaneGeometry(1, 1)), quadMat(kind));
      m.frustumCulled = false;
      const u = m.material.uniforms;
      u.uBill.value = bill ? 1 : 0; u.uCol.value.set(col || '#ffffff'); u.uCol2.value.set(col2 || col || '#ffffff');
      u.uCover.value = coverOf(o, u.uCol.value, def == null ? .4 : def);
      if (!bill) m.rotation.x = -Math.PI / 2;
      return m;
    }
    function beamMat() {
      const m = poolGet('beam', () => new T3.ShaderMaterial(Object.assign({
        uniforms: { uTime: UT, uA: { value: V(0, 0, 0) }, uB: { value: V(0, 1, 0) }, uW: { value: .3 }, uGrow: { value: 0 }, uTaper: { value: .25 }, uCol: { value: new T3.Color() }, uCol2: { value: new T3.Color() }, uOp: { value: 1 }, uNoise: { value: 1 }, uSeed: { value: 0 }, uLen: { value: 1 }, uCover: { value: .4 } },
        vertexShader: BEAM_VS, fragmentShader: NOISE + BEAM_FS,
      }, FXMAT)));
      m.uniforms.uSeed.value = Math.random(); m.uniforms.uOp.value = 1; m.uniforms.uGrow.value = 0;
      return m;
    }
    function ribMat(col, col2, core, o, def) {
      const m = poolGet('rib', () => new T3.ShaderMaterial(Object.assign({
        uniforms: { uTime: UT, uCol: { value: new T3.Color() }, uCol2: { value: new T3.Color() }, uOp: { value: 1 }, uCore: { value: 16 }, uSeed: { value: 0 }, uCover: { value: .3 } },
        vertexShader: RIB_VS, fragmentShader: NOISE + RIB_FS,
      }, FXMAT)));
      const u = m.uniforms; u.uCol.value.set(col); u.uCol2.value.set(col2); u.uCore.value = core; u.uOp.value = 1; u.uSeed.value = Math.random();
      u.uCover.value = coverOf(o, u.uCol.value, def == null ? .3 : def);
      return m;
    }
    // 带子几何体池（闪电、拖尾每帧改顶点）：一条最多 RIBN 个点
    const RIBN = 96, ribFree = [], ribAll = [];
    function ribGet() {
      let g = ribFree.pop();
      if (!g) {
        g = new T3.BufferGeometry();
        g.setAttribute('position', new T3.BufferAttribute(new Float32Array(RIBN * 2 * 3), 3));
        g.setAttribute('aUv', new T3.BufferAttribute(new Float32Array(RIBN * 2 * 2), 2));
        g.setAttribute('aI', new T3.BufferAttribute(new Float32Array(RIBN * 2), 1));
        g.setIndex(new T3.BufferAttribute(new Uint16Array((RIBN - 1) * 6), 1));
        g.userData.rib = true; ribAll.push(g);
      }
      g.userData.free = false; g.setDrawRange(0, 0);
      return g;
    }
    function ribPut(g) { if (!g.userData.free) { g.userData.free = true; ribFree.push(g); } }
    // 把一条折线（pts = [x,y,z,…] 共 n 个点）写进带子，面向镜头；半宽从 w0 渐变到 w1、亮度从 i0 到 i1。st = { v 已写点数, ix 已写索引数 }
    const RT = { d: V(0, 0, 0), e: V(0, 0, 0), s: V(0, 0, 0) };
    function ribLine(g, st, pts, n, w0, w1, i0, i1) {
      n = Math.min(n, RIBN - st.v);
      if (n < 2) return;
      const P = g.attributes.position.array, U = g.attributes.aUv.array, I = g.attributes.aI.array, X = g.index.array, cp = cam.position;
      for (let i = 0; i < n; i++) {
        const j = Math.max(0, i - 1) * 3, l = Math.min(n - 1, i + 1) * 3, c = i * 3;
        RT.d.set(pts[l] - pts[j], pts[l + 1] - pts[j + 1], pts[l + 2] - pts[j + 2]);
        RT.e.set(cp.x - pts[c], cp.y - pts[c + 1], cp.z - pts[c + 2]);
        RT.s.crossVectors(RT.d, RT.e);
        const k = i / (n - 1), w = (w0 + (w1 - w0) * k) / (RT.s.length() || 1), vi = (st.v + i) * 2, p3 = vi * 3, u2 = vi * 2;
        P[p3] = pts[c] + RT.s.x * w; P[p3 + 1] = pts[c + 1] + RT.s.y * w; P[p3 + 2] = pts[c + 2] + RT.s.z * w;
        P[p3 + 3] = pts[c] - RT.s.x * w; P[p3 + 4] = pts[c + 1] - RT.s.y * w; P[p3 + 5] = pts[c + 2] - RT.s.z * w;
        U[u2] = -1; U[u2 + 1] = k; U[u2 + 2] = 1; U[u2 + 3] = k;
        I[vi] = I[vi + 1] = i0 + (i1 - i0) * k;
        if (i < n - 1) { const x = st.ix; X[x] = vi; X[x + 1] = vi + 1; X[x + 2] = vi + 2; X[x + 3] = vi + 1; X[x + 4] = vi + 3; X[x + 5] = vi + 2; st.ix += 6; }
      }
      st.v += n;
    }
    function ribDone(g, st) {
      g.setDrawRange(0, st.ix);
      const at = g.attributes; at.position.needsUpdate = at.aUv.needsUpdate = at.aI.needsUpdate = true; g.index.needsUpdate = true;
    }

    // 着色器光束 a → b：{ col, col2, width, life, taper（两头收细的长度比例）, noise（滚动噪声强弱）, grow（伸出去用的时间比例）, opacity }
    // 返回网格；要跟着动就改 mesh.material.uniforms.uA / uB；要随时改粗细就设 mesh.userData.wk（粗细的倍数，默认 1）
    function energyBeam(a, b, o) {
      o = o || {};
      const width = o.width || .3, life = o.life || .6, grow = o.grow == null ? .16 : o.grow;
      const m = new T3.Mesh(geo('beamq', () => new T3.PlaneGeometry(1, 1, 1, 24).translate(0, .5, 0)), beamMat());
      m.frustumCulled = false;
      const u = m.material.uniforms;
      u.uA.value.copy(a); u.uB.value.copy(b); u.uLen.value = a.distanceTo(b);
      u.uCol.value.set(o.col || '#ffffff'); u.uCol2.value.set(o.col2 || o.col || '#ffffff');
      u.uTaper.value = o.taper == null ? .25 : o.taper; u.uNoise.value = o.noise == null ? 1 : o.noise; u.uW.value = width;
      u.uCover.value = coverOf(o, u.uCol.value, .45);
      addFx(m, life, (q, k) => {
        u.uGrow.value = grow > 0 ? EZ.out(Math.min(1, k / grow)) : 1;
        const thin = k > .8 ? 1 - (k - .8) / .2 : 1;
        u.uW.value = width * (q.userData.wk == null ? 1 : q.userData.wk) * (.88 + .12 * Math.sin(k * 40)) * (.35 + .65 * thin);
        u.uOp.value = (o.opacity || 1) * Math.min(1, k * 10 + .2) * thin;
      });
      return m;
    }
    // 分叉闪电 a → b：{ col, col2, width, branches, life, jag（弯折程度）, rate（多少秒重新生成一次，默认每帧）, opacity }
    // 每帧重新生成路径；「闪」只是这根线自己忽明忽暗，不闪整屏
    const LT = { d: V(0, 0, 0), a: V(0, 0, 0), b: V(0, 0, 0), e: V(0, 0, 0) };
    function lightning(a, b, o) {
      o = o || {};
      const A = a.clone(), B = b.clone(), w = o.width || .05, nb = Math.min(8, o.branches == null ? 2 : o.branches), jag = o.jag == null ? .25 : o.jag, life = o.life || .3;
      const g = ribGet(), mat = ribMat(o.col || '#ffe14d', o.col2 || '#ffffff', 22, o, .45);
      const m = new T3.Mesh(g, mat); m.frustumCulled = false;
      const main = new Float32Array(26 * 3), br = new Float32Array(6 * 3), st = { v: 0, ix: 0 }, u = mat.uniforms;
      const gen = () => {
        st.v = 0; st.ix = 0;
        const L = A.distanceTo(B), N = Math.max(6, Math.min(24, Math.round(L * 5)));
        LT.d.subVectors(B, A).normalize();
        LT.a.set(0, 1, 0); if (Math.abs(LT.d.y) > .9) LT.a.set(1, 0, 0);
        LT.a.cross(LT.d).normalize(); LT.b.crossVectors(LT.d, LT.a);
        let o1 = 0, o2 = 0;
        for (let i = 0; i <= N; i++) {
          const t = i / N, env = Math.sin(t * Math.PI);
          o1 = o1 * .5 + rnd(-1, 1) * jag * L * .2; o2 = o2 * .5 + rnd(-1, 1) * jag * L * .2;
          main[i * 3] = A.x + (B.x - A.x) * t + (LT.a.x * o1 + LT.b.x * o2) * env;
          main[i * 3 + 1] = A.y + (B.y - A.y) * t + (LT.a.y * o1 + LT.b.y * o2) * env;
          main[i * 3 + 2] = A.z + (B.z - A.z) * t + (LT.a.z * o1 + LT.b.z * o2) * env;
        }
        ribLine(g, st, main, N + 1, w * 3, w * 2.2, 1, 1);
        for (let j = 0; j < nb; j++) {
          const s = 1 + Math.floor(rnd(.1, .7) * N), bl = L * rnd(.15, .32), step = bl / 5;
          LT.e.copy(LT.d).addScaledVector(LT.a, rnd(-1, 1) * .9).addScaledVector(LT.b, rnd(-1, 1) * .9).normalize();
          let x = main[s * 3], y = main[s * 3 + 1], z = main[s * 3 + 2];
          for (let i = 0; i < 6; i++) {
            br[i * 3] = x; br[i * 3 + 1] = y; br[i * 3 + 2] = z;
            x += LT.e.x * step + rnd(-1, 1) * step * jag * 1.5; y += LT.e.y * step + rnd(-1, 1) * step * jag * 1.5; z += LT.e.z * step + rnd(-1, 1) * step * jag * 1.5;
          }
          ribLine(g, st, br, 6, w * 2, w * .2, .75, .15);
        }
        ribDone(g, st);
      };
      gen();
      let acc = 0;
      addFx(m, life, (q, k, dt) => {
        acc += dt; if (acc >= (o.rate || 0)) { acc = 0; gen(); }
        u.uOp.value = (o.opacity || 1) * Math.min(1, k * 12 + .3) * (1 - Math.pow(k, 3)) * (RM ? .85 : .55 + .45 * Math.random());   // 减少动态效果时不忽明忽暗
      });
      return m;
    }
    // 跟着物体的拖尾带：getPos() 每帧返回位置（返回空就停）；{ col, col2, width, life（尾巴多长，秒）, max（最长存在几秒）, opacity }
    // 返回 { mesh, stop() }；低画质点数和长度减半
    function trail(getPos, o) {
      o = o || {};
      const N = Math.max(4, Math.round(24 * QS.trail)), life = (o.life || .35) * (QS.trail < 1 ? .6 : 1), hw = (o.width || .12) * .75;
      const hx = new Float32Array(N * 3), ht = new Float32Array(N), pts = new Float32Array(N * 3), st = { v: 0, ix: 0 };
      let n = 0, live = true, age = 0;
      const g = ribGet(), mat = ribMat(o.col || '#ffffff', o.col2 || o.col || '#ffffff', 12, o, .4), u = mat.uniforms;
      const m = new T3.Mesh(g, mat); m.frustumCulled = false;
      addFx(m, o.max || 8, (q, k, dt) => {
        age += dt;
        if (live) {
          let p = null; try { p = getPos(); } catch (e) { p = null; }
          if (p) {
            if (n === N) n--;
            hx.copyWithin(3, 0, n * 3); ht.copyWithin(1, 0, n);
            hx[0] = p.x; hx[1] = p.y; hx[2] = p.z; ht[0] = age; n++;
          } else live = false;
        }
        while (n && age - ht[n - 1] > life) n--;
        if (!live && !n) return true;
        st.v = 0; st.ix = 0;
        if (n >= 2) {
          for (let i = 0; i < n; i++) { const s = (n - 1 - i) * 3; pts[i * 3] = hx[s]; pts[i * 3 + 1] = hx[s + 1]; pts[i * 3 + 2] = hx[s + 2]; }
          ribLine(g, st, pts, n, 0, hw, 0, 1);
        }
        ribDone(g, st);
        u.uOp.value = o.opacity || 1;
      });
      return { mesh: m, stop() { live = false; } };
    }
    // 程序噪声火焰（面向镜头，底边在 at）：{ col 外圈, col2 里面, size, life, rise（往上飘多高）, opacity, push }
    function flame(at, o) {
      o = o || {};
      const size = o.size || .6, life = o.life || .8, rise = o.rise || 0, y0 = at.y;
      const m = quad('flame', true, o.col || '#ff7a2f', o.col2 || '#ffd54f', o, .55), u = m.material.uniforms;
      u.uAnchor.value.set(0, .5); u.uPush.value = o.push || 0;
      m.position.copy(at); m.scale.set(size * .55, size * .7, 1);
      addFx(m, life, (q, k) => {
        const g = EZ.out(Math.min(1, k / .18));
        q.scale.set(size * (.55 + .45 * g), size * 1.7 * (.4 + .6 * g) * (1 - .25 * Math.max(0, k - .6) / .4), 1);
        q.position.y = y0 + rise * k;
        u.uOp.value = (o.opacity || 1) * (k < .55 ? 1 : 1 - (k - .55) / .45);
      });
      return m;
    }
    // 冲击波环：{ col, r0, r1, life, flat（默认 true 平铺；false 面向镜头）, thick, opacity, push }
    function shockwave(at, o) {
      o = o || {};
      const r0 = o.r0 == null ? .2 : o.r0, r1 = o.r1 == null ? 1.6 : o.r1, life = o.life || .45, th = o.thick || .14, flat = o.flat !== false;
      const m = quad('shock', !flat, o.col || '#ffffff', o.col2, o, .35), u = m.material.uniforms;
      m.position.copy(at);
      if (flat) m.rotation.z = rnd(0, 6.28); else { u.uRot.value = rnd(0, 6.28); u.uPush.value = o.push == null ? .3 : o.push; }
      const sz = r => 2 * Math.max(.01, r) / .86;
      m.scale.set(sz(r0), sz(r0), 1);
      addFx(m, life, (q, k) => {
        const r = r0 + (r1 - r0) * EZ.out(k), s = sz(r);
        q.scale.set(s, s, 1);
        u.uP.value.x = Math.min(.5, th * .86 / Math.max(.05, r)); u.uK.value = k;
        u.uOp.value = (o.opacity || 1) * Math.pow(1 - k, 1.3) * Math.min(1, k * 12 + .2);
      });
      return m;
    }
    // 动画式命中星（面向镜头，往镜头挪一点盖在怪兽前面）：{ col, col2, size, life, spikes, push }
    function impactStar(at, o) {
      o = o || {};
      const size = o.size || .9, life = o.life || .3;
      const m = quad('star', true, o.col || '#ffffff', o.col2, o, .5), u = m.material.uniforms;
      u.uP.value.x = o.spikes || 10; u.uRot.value = rnd(0, 6.28); u.uPush.value = o.push == null ? .6 : o.push;
      m.position.copy(at); m.scale.set(size * .3, size * .3, 1);
      addFx(m, life, (q, k) => {
        const s = size * (.3 + .7 * EZ.out(Math.min(1, k / .2))) * (1 + k * .15);
        q.scale.set(s, s, 1);
        u.uK.value = k; u.uP.value.y = Math.max(0, (k - .3) / .7);
        u.uOp.value = k < .7 ? 1 : (1 - k) / .3;
      });
      return m;
    }
    // 地面贴花，慢慢淡出：{ kind: 'scorch' | 'frost' | 'crack' | 'splash' | 'glow', col, col2, r, life, opacity }
    // 落在台子上就贴台面；同时最多 QS.decals 块（多了让最老的快点淡掉）；低画质寿命减半
    const DECAL_K = { scorch: 0, frost: 1, crack: 2, splash: 3, glow: 4 };
    const DECAL_COL = [['#ff7a2f', '#ffcf70'], ['#9be7ff', '#ffffff'], ['#6b5030', '#3a2a1a'], ['#3fa9f5', '#bdefff'], ['#ffffff', '#ffffff']];
    const decals = [];
    function decal(at, o) {
      o = o || {};
      const kind = DECAL_K[o.kind] == null ? 0 : DECAL_K[o.kind], r = o.r || .9, life = (o.life || 3) * QS.trail;
      while (decals.length >= QS.decals) { const old = decals.shift(); old.t = Math.max(old.t, old.life * .9); }
      const m = quad('decal', false, o.col || DECAL_COL[kind][0], o.col2 || DECAL_COL[kind][1], o, 0), u = m.material.uniforms;
      u.uP.value.x = kind;
      if (kind !== 4 && o.cover == null) u.uCover.value = 1;   // 焦痕、冰霜、地裂、水渍是普通颜色；光斑是叠加发光
      m.renderOrder = -.5;
      const onPad = ['me', 'foe'].some(s => Math.hypot(at.x - POS[s].x, at.z - POS[s].z) < 1.22);
      m.position.set(at.x, onPad ? .085 : .012, at.z); m.rotation.z = rnd(0, 6.28); m.scale.set(r * 2, r * 2, 1);
      const f = addFxE(m, life, (q, k) => { u.uK.value = k; u.uOp.value = (o.opacity || 1) * Math.min(1, k * 25) * (k < .5 ? 1 : 1 - (k - .5) / .5); }, () => { const i = decals.indexOf(f); if (i >= 0) decals.splice(i, 1); });
      m.layers.disable(1);   // 贴花不进发光后期：它们要留好几秒，进了的话放完招后期还一直开着（FX_SPEC §7）
      decals.push(f);
      return m;
    }
    // 怪兽周身的属性光（蓄力用）：身后一片带噪声的光壳 + 身上泛属性色；{ col, col2, life, strength, tint（false 不给怪兽上色；数字 = 上色的强弱倍数）, size（光壳大小的倍数，默认 1） }
    function aura(side, o) {
      o = o || {};
      const mm = M[side]; if (!mm) return null;
      const life = o.life || .6, s = o.strength == null ? 1 : o.strength, col = C(o.col || '#ffffff'), h = monH(side), tmp = V(0, 0, 0), sz = o.size || 1;
      const q = quad('aura', true, col, o.col2 || '#ffffff', o, .35), u = q.material.uniforms;
      centerTo(side, q.position); q.scale.set(h * 1.55 * sz, h * 1.75 * sz, 1);
      addFx(q, life, (obj, k) => {
        centerTo(side, obj.position);
        tmp.copy(cam.position).sub(obj.position).normalize();
        obj.position.addScaledVector(tmp, -h * .3);   // 稍微放在怪兽后面：身前的部分挡住它，像从身后透出来的光
        obj.position.y += h * .12;
        const env = Math.min(1, k / .15) * (k > .75 ? (1 - k) / .25 : 1);
        u.uOp.value = Math.min(1, .9 * s) * env;
        if (o.tint !== false && M[side] === mm) { mm.tintCol.copy(col); mm.tintV = .45 * Math.min(1.5, s) * (typeof o.tint === 'number' ? o.tint : 1) * env * (.8 + .2 * Math.sin(UT.value * 18)); }
      }, () => { mm.tintV = 0; });
      return q;
    }
    // 脚下的魔法阵 / 光圈（跟着怪兽）：{ col, col2, r, life, runes（加一圈符文）, spin（每秒转多少）, opacity }
    function groundCircle(side, o) {
      o = o || {};
      const mm = M[side]; if (!mm) return null;
      const r = o.r || 1.1, life = o.life || .8, spin = (o.spin == null ? .6 : o.spin) * (Math.random() < .5 ? -1 : 1);
      const q = quad('circle', false, o.col || '#ffffff', o.col2, o, .3), u = q.material.uniforms;
      u.uP.value.z = o.runes ? 1 : 0;
      q.renderOrder = -.4;
      const place = obj => { obj.position.set(mm.R.root.position.x, .1, mm.R.root.position.z); };
      place(q); q.scale.set(r * 1.4, r * 1.4, 1);
      addFx(q, life, (obj, k, dt) => {
        place(obj);
        const g = EZ.out(Math.min(1, k / .2)), s = 2 * r * (.7 + .3 * g);
        obj.scale.set(s, s, 1); obj.rotation.z += spin * dt;
        u.uP.value.y = Math.min(1, k / .25); u.uK.value = k;
        u.uOp.value = (o.opacity || 1) * (k < .75 ? 1 : (1 - k) / .25);
      });
      return q;
    }
    // 柔光点（面向镜头）：{ col, size, life, grow（到最后是开始的几倍）, follow()（跟着走）, push, opacity }
    function glow(at, o) {
      o = o || {};
      const size = o.size || .6, life = o.life || .3;
      const q = quad('glow', true, o.col || '#ffffff', null, o, .15), u = q.material.uniforms;
      u.uPush.value = o.push || 0;
      q.position.copy(at); q.scale.set(size, size, 1);
      addFx(q, life, (obj, k) => {
        if (o.follow) { const p = o.follow(); if (p) obj.position.copy(p); }
        const s = size * (o.grow ? 1 + (o.grow - 1) * k : 1);
        obj.scale.set(s, s, 1);
        u.uOp.value = (o.opacity || 1) * Math.min(1, k * 10 + .3) * (1 - k);
      });
      return q;
    }
    // 临时点光源（只有高画质有，最多 2 盏，一直在场景里亮度为 0，用的时候点亮——灯的数量不变，材质不用重新编译）
    const LIGHTS = [];
    for (let i = 0; i < QS.lights; i++) { const L = new T3.PointLight(0xffffff, 0, 5, 2); L.layers.enableAll(); L.userData.fx = { t: 0, life: 0, i0: 0 }; scene.add(L); LIGHTS.push(L); }
    // { col, intensity, dist, life }；没有灯（中低画质）返回 null
    function light(at, o) {
      if (!LIGHTS.length) return null;
      o = o || {};
      let L = LIGHTS[0];
      for (const x of LIGHTS) { const f = x.userData.fx, g = L.userData.fx; if (!f.life) { L = x; break; } if (f.life - f.t < g.life - g.t) L = x; }
      L.position.copy(at); L.color.set(o.col || '#ffffff'); L.distance = o.dist || 5;
      Object.assign(L.userData.fx, { t: 0, life: o.life || .4, i0: o.intensity == null ? 8 : o.intensity });
      return L;
    }
    function stepLights(dt) {
      for (const L of LIGHTS) {
        const f = L.userData.fx; if (!f.life) continue;
        f.t += dt; const k = f.t / f.life;
        if (k >= 1) { f.life = 0; L.intensity = 0; } else L.intensity = f.i0 * (k < .12 ? k / .12 : Math.pow(1 - (k - .12) / .88, 2));
      }
    }

    // ---------- 闪屏、震动、放慢、发光后期、音效 ----------
    // 全屏闪（FX_SPEC §6）：每秒最多 3 次、两次至少隔 250ms，超了就跳过（高画质改成发光后期亮一下）；不透明度 ≤ .55；
    // 饱和的红色改成很淡的颜色；减少动态效果 / 关了运镜时不闪。flash(col, { strength, ms }) 或老写法 flash(col, ms)；返回有没有闪
    const FL = { el: null, times: [], on: false, t0: 0, ms: 300, peak: 0 };
    const fc = new T3.Color(), fhsl = { h: 0, s: 0, l: 0 };
    function flash(col, o) {
      if (typeof o === 'number') o = { ms: o };
      o = o || {};
      if (RM || !CINE) { stats.flashSkipped++; return false; }
      const now = performance.now(), ts = FL.times;
      while (ts.length && now - ts[0] >= 1000) ts.shift();
      if (ts.length >= 3 || (ts.length && now - ts[ts.length - 1] < 250)) { stats.flashSkipped++; bloom(1.8, 260); return false; }
      ts.push(now); stats.flashes++;
      fc.set(col || '#ffffff'); fc.getHSL(fhsl, T3.SRGBColorSpace);
      if (fhsl.s > .45 && (fhsl.h < .07 || fhsl.h > .93)) fc.setHSL(fhsl.h, .35, Math.max(fhsl.l, .82), T3.SRGBColorSpace);
      if (!FL.el) { FL.el = document.createElement('div'); FL.el.className = 'b3d-flash'; }
      if (FL.el.parentNode !== host) host.appendChild(FL.el);
      FL.el.style.transition = 'none'; FL.el.style.background = '#' + fc.getHexString(T3.SRGBColorSpace);
      FL.peak = Math.min(.55, o.strength == null ? .45 : o.strength); FL.ms = o.ms || 300; FL.t0 = now; FL.on = true;
      FL.el.style.opacity = FL.peak.toFixed(3);
      return true;
    }
    function stepFlash() {
      if (!FL.on) return;
      const k = (performance.now() - FL.t0) / FL.ms;
      if (k >= 1) { FL.on = false; FL.el.style.opacity = '0'; } else FL.el.style.opacity = (FL.peak * (1 - k) * (1 - k)).toFixed(3);
    }
    // 震动：最大 .45；一招里 ≥ .2 的大震最多两次（再多就降成 .15）；减少动态效果时不震
    let shakeAmt = 0, moveShakes = 0;
    function shake(a, force) {
      if (RM) return;
      a = Math.min(.45, Math.max(0, a || 0));
      if (a >= .2 && !force) { if (moveShakes >= 2) a = .15; else moveShakes++; }
      shakeAmt = Math.max(shakeAmt, a);
    }
    // 特效时间放慢（大招命中瞬间）：粒子、特效物件、kit.tween、着色器时间、怪兽动作都按这个倍数走；最后 30% 慢慢恢复
    let SM = null;
    function slowmo(f, ms) { if (!CINE) return; SM = { f: Math.max(.1, Math.min(1, f == null ? .35 : f)), t0: performance.now(), ms: ms || 260 }; }
    function timeScale() {
      if (!SM) return 1;
      const k = (performance.now() - SM.t0) / SM.ms;
      if (k >= 1) { SM = null; return 1; }
      return k < .7 ? SM.f : SM.f + (1 - SM.f) * (k - .7) / .3;
    }
    // 发光后期临时加强（只有高画质有）
    let BB = null;
    function bloom(s, ms) { if (!BL) return; BB = { s: s == null ? 1.6 : s, t0: performance.now(), ms: ms || 400 }; }
    // 音效：phase = 'charge' | 'launch' | 'impact' | 'cutin' | 'crit'；音效关着（opts.sfx() === false）就什么都不做
    function sfx(type, phase, tier) {
      try { if (opts.sfx && opts.sfx() === false) return; const S = window.BattleSFX; if (S && S.play) S.play(type, phase, tier || 0); } catch (e) { /* 音效出错不影响画面 */ }
    }

    // ---------- 发光后期（bloom-lite，只有高画质、只在有特效时开） ----------
    // 半分辨率另画一遍「只有特效」的画面（怪兽画成黑色当遮挡），提亮 + 两级模糊，再叠加回屏幕；不碰正常画面，背景和天空不会跟着发光
    const BL = QS.bloom ? makeBloom() : null;
    function makeBloom() {
      let type = T3.UnsignedByteType;
      try { const ex = renderer.extensions; if (ex.has('EXT_color_buffer_float') || ex.has('EXT_color_buffer_half_float')) type = T3.HalfFloatType; } catch (e) { /* 不支持就用 8 位 */ }
      const mk = depth => new T3.WebGLRenderTarget(2, 2, { type, depthBuffer: depth, stencilBuffer: false, minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, generateMipmaps: false });
      const B = { a: mk(true), b: mk(false), c: mk(false), d: mk(false), w: 2, h: 2, cam: new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene: new T3.Scene() };
      B.blur = new T3.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new T3.Vector2() }, uThr: { value: 0 } }, vertexShader: POST_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false });
      B.comp = new T3.ShaderMaterial({ uniforms: { tA: { value: B.a.texture }, tB: { value: B.d.texture }, uS: { value: 1 } }, vertexShader: POST_VS, fragmentShader: COMP_FS, transparent: true, blending: T3.AdditiveBlending, depthTest: false, depthWrite: false });
      B.occ = new T3.MeshBasicMaterial({ color: 0x000000 });
      B.quad = new T3.Mesh(new T3.PlaneGeometry(2, 2), B.blur); B.quad.frustumCulled = false; B.scene.add(B.quad);
      return B;
    }
    const tmpV2 = new T3.Vector2(), tmpC = new T3.Color();
    function bloomSize() {
      if (!BL) return;
      renderer.getDrawingBufferSize(tmpV2);
      let w = Math.max(2, Math.round(tmpV2.x / 2)), h = Math.max(2, Math.round(tmpV2.y / 2));
      if (w > 960) { h = Math.round(h * 960 / w); w = 960; }
      BL.w = w; BL.h = h; BL.a.setSize(w, h); BL.b.setSize(w, h);
      BL.c.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); BL.d.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    }
    function bloomPass(str) {
      const r = renderer, B = BL;
      const auto = r.autoClear, sAuto = r.shadowMap.autoUpdate, bg = scene.background, mask = cam.layers.mask, sc = pUni.uScale.value;
      r.getClearColor(tmpC); const ca = r.getClearAlpha();
      r.autoClear = false; r.shadowMap.autoUpdate = false; scene.background = null;
      r.setClearColor(0x000000, 1);
      r.setRenderTarget(B.a); r.clear(true, true, false);
      cam.layers.set(2); scene.overrideMaterial = B.occ; r.render(scene, cam);   // 怪兽：黑色遮挡
      scene.overrideMaterial = null; cam.layers.set(1);
      renderer.getDrawingBufferSize(tmpV2); pUni.uScale.value = sc * B.h / Math.max(1, tmpV2.y);
      r.render(scene, cam);   // 只有特效
      cam.layers.mask = mask; pUni.uScale.value = sc; scene.background = bg;
      const pass = (src, dx, dy, dst, thr) => { B.quad.material = B.blur; const u = B.blur.uniforms; u.tSrc.value = src.texture; u.uDir.value.set(dx, dy); u.uThr.value = thr; r.setRenderTarget(dst); r.render(B.scene, B.cam); };
      pass(B.a, 1.2 / B.w, 0, B.b, .3); pass(B.b, 0, 1.2 / B.h, B.a, 0);              // 半分辨率：提亮 + 模糊
      pass(B.a, 2.4 / B.w, 0, B.c, 0); pass(B.c, 0, 2.4 / B.c.height, B.d, 0);        // 四分之一：更宽的光晕
      r.setRenderTarget(null);
      B.quad.material = B.comp; B.comp.uniforms.uS.value = str; r.render(B.scene, B.cam);
      r.setClearColor(tmpC, ca); r.autoClear = auto; r.shadowMap.autoUpdate = sAuto;
    }
    function bloomStr() {
      let s = BLOOM_BASE;
      if (BB) {
        const k = (performance.now() - BB.t0) / BB.ms;
        if (k >= 1) BB = null; else if (BB.s > s) s += (BB.s - s) * (k < .2 ? 1 : 1 - (k - .2) / .8);
      }
      return s;
    }

    // ---------- 运镜（开场横扫、放招过肩、命中推近、倒下慢推） ----------
    // 镜头的目标用函数给出，怪兽动了镜头也跟着；拍完一定回到默认机位（CAM），screenPos 按默认机位算
    const cur = { pos: CAM.pos.clone(), look: CAM.look.clone(), fov: FOV };   // 当前机位（不含呼吸和震动）
    let shot = null, punch = null, camTimer = 0, introDone = false, camF = 1;
    const HOME = () => CAM;
    // to：() => { pos, look }；orbit：绕场地中心转过去（开场横扫用），不走直线
    function camTo(to, ms, ez, orbit) {
      clearTimeout(camTimer);
      if (!CINE) return;
      shot = { a: { pos: cur.pos.clone(), look: cur.look.clone(), fov: cur.fov }, to, t0: performance.now(), ms: Math.max(1, ms), ez: ez || EZ.io, orbit };
    }
    function camHome(ms, delay) {
      clearTimeout(camTimer);
      if (!CINE || !shot) return;
      const go = () => { if (shot && shot.to !== HOME) camTo(HOME, ms || 650, EZ.io); };
      if (delay) camTimer = setTimeout(go, delay); else go();
    }
    function camPunch(at, amt, ms) { if (CINE) punch = { at, amt, t0: performance.now(), ms: ms || 480 }; }
    const lerpV = (a, b, k) => a.clone().lerp(b, k);
    const monH = side => { const m = M[side]; return m ? m.R.height * m.R.root.scale.x / m.R.size : 1; };
    // 放招前：镜头移到出招方的斜前方（还是从观众这一侧看，不转到怪兽背后），看着对手
    function shotShoulder(side) {
      return () => {
        const other = side === 'me' ? 'foe' : 'me', a = center(side), b = center(other);
        const d = b.clone().sub(a).setY(0).normalize(), h = monH(side), front = V(0, 0, 1);
        const pos = a.clone().addScaledVector(d, -(.9 + h * .4) * camF).addScaledVector(front, (3.4 + h * .6) * camF).setY(Math.max(1.25, h * 1.15));
        return { pos, look: lerpV(a, b, .62).setY(b.y * .8 + .2) };
      };
    }
    // 招式飞出去：从默认机位稍微推向挨打的一方
    function shotToward(side, k, lk) { return () => { const c = center(side); return { pos: lerpV(CAM.pos, c, k), look: lerpV(CAM.look, c, lk) }; }; }
    // 大招蓄力的「主角特写」：在出招怪兽前方斜一点、低机位往上看（过场横幅就盖在这个画面上）
    function shotHero(side) {
      return () => {
        const other = side === 'me' ? 'foe' : 'me', a = center(side), b = center(other);
        const d = b.clone().sub(a).setY(0).normalize(), r = V(-d.z, 0, d.x), h = monH(side);
        const dist = (1.2 + h * 1.05) * camF;   // 竖屏再拉远一点
        const pos = a.clone().addScaledVector(d, dist * .8).addScaledVector(r, dist * (side === 'me' ? .55 : -.55)).setY(Math.max(.42, h * .4));
        return { pos, look: a.clone().setY(h * .6), fov: 40 };
      };
    }
    // 开场：从侧面低处的远景绕到默认机位
    function intro(ms) {
      introDone = true;
      if (!CINE) return;
      const rel = CAM.pos.clone().sub(ARENA_C), an = Math.atan2(rel.x, rel.z) + .65, rad = Math.hypot(rel.x, rel.z) * 1.15;
      // 起点不要太低：远景画是按默认机位摆的，镜头太低会看到画的上边
      cur.pos.set(ARENA_C.x + Math.sin(an) * rad, 1.2, ARENA_C.z + Math.cos(an) * rad);
      cur.look.copy(lerpV(ARENA_C, POS.foe, .55)).setY(.45);
      camTo(HOME, ms || 1600, EZ.io, true);
    }
    function camStep(now) {
      if (shot) {
        const k = Math.min(1, (now - shot.t0) / shot.ms), e = shot.ez(k), b = shot.to();
        if (shot.orbit) {
          // 绕场地中心：角度、半径、高度分别插值
          const ra = shot.a.pos.clone().sub(ARENA_C), rb = b.pos.clone().sub(ARENA_C);
          let a0 = Math.atan2(ra.x, ra.z), a1 = Math.atan2(rb.x, rb.z); if (a1 - a0 > Math.PI) a1 -= Math.PI * 2; if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
          const an = a0 + (a1 - a0) * e, rad = Math.hypot(ra.x, ra.z) + (Math.hypot(rb.x, rb.z) - Math.hypot(ra.x, ra.z)) * e;
          cur.pos.set(ARENA_C.x + Math.sin(an) * rad, shot.a.pos.y + (b.pos.y - shot.a.pos.y) * EZ.sine(k), ARENA_C.z + Math.cos(an) * rad);
        } else cur.pos.lerpVectors(shot.a.pos, b.pos, e);
        cur.look.lerpVectors(shot.a.look, b.look, e);
        cur.fov = shot.a.fov + ((b.fov || FOV) - shot.a.fov) * e;   // 可以顺便变焦
        if (k >= 1 && shot.to === HOME) shot = null;
      } else { cur.pos.copy(CAM.pos); cur.look.copy(CAM.look); cur.fov = FOV; }
      const pos = cur.pos.clone(), look = cur.look.clone();
      if (punch) {
        const k = Math.min(1, (now - punch.t0) / punch.ms), env = k < .16 ? EZ.out(k / .16) : 1 - EZ.sine((k - .16) / .84);
        const at = punch.at(), d = at.clone().sub(pos), len = d.length();
        pos.addScaledVector(d.normalize(), Math.min(punch.amt, len * .3) * env);
        look.lerp(at, .2 * env);
        if (k >= 1) punch = null;
      }
      return { pos, look, fov: cur.fov };
    }

    // ---------- 动画（按特效时间走，slowmo 时一起放慢） ----------
    const anim = [];
    function tween(ms, fn) {
      if (!alive) return Promise.resolve();
      return new Promise(res => anim.push({ t0: fxNow, ms: Math.max(1, ms), fn, res }));
    }
    function stepAnim() {
      for (let i = anim.length - 1; i >= 0; i--) {
        const a = anim[i]; if (!a) continue;
        const k = Math.min(1, (fxNow - a.t0) / a.ms);
        try { a.fn(k); } catch (e) { warn('动画出错', e); }
        if (k >= 1) { const j = anim.indexOf(a); if (j >= 0) anim.splice(j, 1); a.res(); }
      }
    }

    // ---------- 招式特效 ----------
    const center = side => { const m = M[side]; return m.R.root.position.clone().add(V(0, m.R.height * m.R.root.scale.x / m.R.size * .5, 0)); };
    const centerTo = (side, out) => { const m = M[side]; out.copy(m.R.root.position); out.y += monH(side) * .5; return out; };
    const feet = side => { const m = M[side]; return V(m.R.root.position.x, .09, m.R.root.position.z); };
    const mon = side => { const m = M[side]; return m ? { root: m.R.root, height: monH(side), R: m.R, off: m.off, sp: m.sp, side } : null; };
    const playAnim = (side, name, speed) => { const m = M[side]; return m && Mon3D.play ? (Mon3D.play(m.R, name, speed) || 0) : 0; };
    // 弹道：从 a 飞到 b（按特效时间），沿途 trail(p, k)；到了就移走——addFx 管着的交给它到期释放，userData.keep 的只移走不释放，其他的释放
    // o = { arc（弧高 = 距离 × arc，默认 .15）, ease(k), spin: [x, y, z]（每秒转多少弧度） }
    function fly(a, b, ms, obj, trail, o) {
      o = o || {};
      if (obj) { obj.position.copy(a); if (!obj.userData.keep) fxLayer(obj); if (!obj.parent) scene.add(obj); }
      const arc = a.distanceTo(b) * (o.arc == null ? .15 : o.arc), p = V(0, 0, 0), sp = o.spin;
      let lk = 0;
      return tween(ms, k => {
        const e = o.ease ? o.ease(k) : k;
        p.copy(a).lerp(b, e); p.y += Math.sin(e * Math.PI) * arc;
        if (obj) {
          obj.position.copy(p);
          if (sp) { const d = (k - lk) * ms / 1000; obj.rotation.x += sp[0] * d; obj.rotation.y += sp[1] * d; obj.rotation.z += sp[2] * d; }
        }
        lk = k;
        if (trail) trail(p.clone(), k);
        if (k >= 1 && obj) {
          const f = obj.userData.fxe;
          obj.removeFromParent();
          if (obj.userData.keep) return;
          if (f) f.t = f.life; else releaseObj(obj);
        }
      });
    }
    // 保底的老特效（没登记的属性用；各属性的特效在 battle-fx-*.js）
    const FX = {};
    FX.default = async (k, ctx) => {
      const { a, b, tier: t, cols } = ctx;
      const o = orb(cols[0], .12 + t * .05);
      await fly(a, b, 420, o, p => emit(2, () => ({ pos: p.clone(), vel: sph(.3), col: C(cols[1]), size: .25, life: .35, t: 0 })));
      burst(b, cols, 30 + t * 30, 3 + t, .5, .6);
      ring(b, cols[0], .2, 1.4 + t * .6, .45);
    };
    // 辅助招式的保底：原地发光一圈
    function supportDefault(k, ctx) { const p = M[ctx.side].R.root.position, c = ctx.cols; ring(p.clone().setY(.08), c[0], .3, 1.4, .6, .06); rise(p.clone(), c, 40, .5, 1.6, .45, .8); }

    // ---------- kit：交给特效库的工具箱（FX_SPEC §3，名字定了别改） ----------
    const kit = {
      T3, scene, cam, q: Q, qs: QS, RM, CINE, TYPE_COL, EZ,
      V, rnd, sph, C, sleep, tween,
      center, feet, mon, anim: playAnim,
      emit, burst, rise, addFx,
      ring, orb, bolt, beam, chunks, fly, geo, glowMat, toonMat, leafGeo,
      energyBeam, lightning, flame, shockwave, impactStar, decal, trail, aura, groundCircle, light, glow,
      flash, shake: a => shake(a), camTo, camPunch, shotShoulder, shotToward, shotHero, camHome, slowmo, bloom, sfx,
      get particles() { return pCount; },
    };

    // ---------- 对外：出场 / 放招 / 受击 / 倒下 / 扔球 ----------
    async function enter(side, fromBall) {
      const m = M[side]; if (!m) return;
      m.gone = false; m.R.root.visible = true;
      if (Mon3D.play) Mon3D.play(m.R, 'idle');
      if (!introDone) intro();
      else if (!shot) { camTo(shotToward(side, .16, .45), 450, EZ.out); camHome(750, 700); }
      const s = m.R.baseScale;
      if (fromBall) {
        // 从球里出来：一道往上冲的光柱 + 脚下一圈冲击波 + 迸出来的星光
        const p = center(side), f = feet(side), h = s * m.R.height / m.R.size;
        energyBeam(f.clone(), f.clone().setY(h * 2.4 + .6), { col: '#b388ff', col2: '#ffffff', width: .45 + h * .3, life: .5, grow: .3, taper: .12 });
        shockwave(f.clone().setY(.12), { col: '#ffffff', col2: '#b388ff', r1: 1.6, life: .45 });
        burst(p, ['#ffffff', '#b388ff'], 30, 3, .5, .5);
        emit(14, () => ({ pos: p.clone(), vel: sph(rnd(1.5, 3)), col: Math.random() < .5 ? '#ffffff' : '#d9c8ff', size: rnd(.14, .24), life: rnd(.35, .5), drag: 2.5, tex: 'star', spin: rnd(-4, 4) }));
      } else {
        emit(24, () => ({ pos: m.R.root.position.clone().add(V(rnd(-.6, .6), .05, rnd(-.6, .6))), vel: V(rnd(-.5, .5), rnd(.3, .8), rnd(-.5, .5)), col: C('#e8dcb0'), size: .6, life: .6, t: 0 }));
        shockwave(feet(side).setY(.12), { col: '#fff8e1', r1: 1.3, life: .4, thick: .08, opacity: .6 });
      }
      await tween(420, k => { const e = 1 - Math.pow(1 - k, 3); m.R.root.scale.setScalar(s * (e + Math.sin(k * Math.PI) * .15)); });
    }
    // 等一个 Promise，最多等 ms 毫秒（超时、出错都当它完成了，战斗不会卡住）
    const guard = (p, ms, what) => new Promise(res => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      const tm = setTimeout(() => { if (!done) { stats.over++; warn(what + ' 超过 ' + ms + 'ms，当它完成了'); } fin(); }, ms);
      Promise.resolve(p).then(() => { clearTimeout(tm); fin(); }, e => { clearTimeout(tm); warn(what + ' 出错', e); fin(); });
    });
    const callSafe = (fn, what) => { try { return fn(); } catch (e) { warn(what + ' 出错', e); return null; } };
    const bg = (fn, what) => { const r = callSafe(fn, what); if (r && r.catch) r.catch(e => warn(what + ' 出错', e)); };
    // ---------- 编排（FX_SPEC §4）：蓄力 → 大招过场 / 中招横幅 → 扑出去（大招换成特殊动作）→ 出招 → 命中 → 余韵 ----------
    // 时长（毫秒）：蓄力 CH_MS；大招蓄力到 CUT_AT 时横幅冲进来（蓄力剩下的部分在横幅底下接着放），横幅开始退场时就接特殊动作。
    // 会动的模型（小招 / 中招）：attack 动作在蓄力里提前开始（后仰那一段算蓄力，按 ATK_SP 加速），蓄力结束后 LEAD 毫秒扑到最前面（动作第 0.5 秒），这时出招
    const CH_MS = [250, 450, 700], CUT_AT = 400, LEAD = [110, 130], ATK_SP = [1.5, 1.25];
    const LUNGE_MS = [[150, 190], [200, 260]];   // 程序模型 / 纸片往前一扑：[特殊系, 物理系]
    // 大招特殊动作：leap 跳起转身砸地、dash 后缩再冲刺带残影、float（其他属性）浮起转身发光；登记时可以用 ult: 'leap' | 'dash' | 'float' 指定
    const ULT_STYLE = { fight: 'leap', ground: 'leap', rock: 'leap', steel: 'leap', normal: 'dash', flying: 'dash', bug: 'dash', dark: 'dash' };
    const isPhysical = (ctx, def) => def && def.physical != null ? !!def.physical : (ctx.type === 'fight' || ctx.type === 'normal');
    // 通用环节可以按属性关掉：登记时 generic: false（全关）或 { charge, star, wave, sparks, light, flash, slowmo, after: false }
    // 很浅的属性色（一般、飞行、冰、电）：周身光减半、不给怪兽上色（白光一叠，怪兽就看不清了）
    const paleK = col => (lum(C(col)) > .6 ? .45 : 1);
    // 浅色属性的周身光换成饱和一点的点缀色（浅色本身当第二色）、cover 加大：很浅的颜色几乎是纯叠加，
    // 叠在绿色的草地场地上会透出一片淡绿，看着像草系招式
    const AURA_ACC = { normal: ['#ffc21a', '#fff1b0'], steel: ['#6f87a0', '#c9d6e0'], ice: ['#2f8cf0', '#bff0ff'], flying: ['#5aa6ee', '#dcefff'], spark: ['#ffc800', '#fff59d'] };
    const noGen = (def, k) => !!def && (def.generic === false || !!(def.generic && def.generic[k] === false));
    // 放招：attack(side, type, tier, support, info)，info = { name, zh, sp }（招式英文名、中文名、出招的物种，可以不给：不给就不显示名字，立绘用场上这只）。
    // 流程：蓄力 phaseCharge → 大招过场 phaseCutin → 扑出去 phaseLunge（大招 ultMove）→ 出招 phaseRelease（命中瞬间 resolve）
    // → 命中 phaseImpact、余韵 phaseAfter（都在后台，不挡流程）。每一段：内置的通用环节 → BattleFX.common（有登记的话）→ 这个属性登记的
    async function attack(side, type, tier, support, info) {
      const other = side === 'me' ? 'foe' : 'me', m = M[side], o = M[other];
      if (!m || !o) return;
      tier = Math.max(0, Math.min(2, tier | 0));
      m.spin = 0;   // 上一招的特殊动作被打断时留下的转身
      const R = BFX(), cols = TYPE_COL[type] || TYPE_COL.normal;
      const a = center(side), b = support ? center(side) : center(other), dir = center(other).sub(a).setY(0).normalize();
      // ctx：a 出招点（大招特殊动作做完会挪到怪兽当时的位置）、b 命中点（辅助招式两个都是自己的中心）、dir 朝对手的水平方向
      const ctx = { a: support ? a : a.clone().addScaledVector(dir, .3), b, dir, side, other, tier, cols, info: info || null, type, support: !!support };
      moveShakes = 0;
      stats.move = { type, tier, support: !!support, t0: performance.now(), impact: 0 };
      if (support) { await supportMove(ctx, R); stats.move.impact = performance.now() - stats.move.t0; return; }
      const def = R.types[type] && R.types[type].release ? R.types[type] : null;
      // 两边平时都侧过一点身子朝着观众，出招时转过去正对对手
      const st = { turn0: TURN[side], turned: true, tok: (m.turnTok = (m.turnTok || 0) + 1), rigAtk: false, lifted: false };
      if (tier === 2) prepCut(ctx);          // 过场立绘先开始加载
      else if (tier === 1) banner(ctx);      // 中招：右上角的招式名小横幅（不挡流程）
      const charged = phaseCharge(ctx, def, st, R);
      if (tier === 2) { await sleep(CUT_AT); await Promise.all([charged, phaseCutin(ctx, def, R)]); }
      else { await charged; await phaseCutin(ctx, def, R); }
      await phaseLunge(ctx, def, st);
      await phaseRelease(ctx, def);
      stats.move.impact = performance.now() - stats.move.t0;
      phaseImpact(ctx, def, R);
      phaseAfter(ctx, def, R);
      camHome(650, tier === 2 ? 420 : 260);   // 命中后稍停一下再回默认机位（hit 会再推一下）
      if (st.lifted) { const y0 = m.off.y; tween(380, k => { if (M[side] === m && m.turnTok === st.tok) m.off.y = y0 * (1 - EZ.io(k)); }); }   // 浮起来的落回台子上
      if (st.turned) setTimeout(() => { if (M[side] === m && m.turnTok === st.tok) tween(520, k => { if (m.turnTok === st.tok) m.turn = TURN_ATK + (st.turn0 - TURN_ATK) * EZ.io(k); }); }, 350);
    }
    // 1. 蓄力：我方先转过去对着对手；小招中招过肩机位、大招正面低机位特写；通用蓄力 chargeFx + BattleFX.common.charge + 这个属性的 charge。
    //    至少蓄 CH_MS[tier]，钩子返回的 Promise 也等（最多 1 秒）
    async function phaseCharge(ctx, def, st, R) {
      const m = M[ctx.side], t = ctx.tier;
      m.talk = 1;
      if (st.turned) tween(260, k => { if (m.turnTok === st.tok) m.turn = st.turn0 + (TURN_ATK - st.turn0) * EZ.out(k); });
      sfx(ctx.type, 'charge', t);
      if (CINE) camTo(t === 2 ? shotHero(ctx.side) : shotShoulder(ctx.side), t === 2 ? 380 : 300, EZ.out);
      if (!noGen(def, 'charge')) callSafe(() => chargeFx(ctx), 'charge');
      // 会动的模型：attack 动作提前开始，扑到最前面的那一刻正好出招
      if (t < 2 && m.R.mixer && m.R.acts && m.R.acts.attack) {
        st.rigAtk = true;
        setTimeout(() => { if (alive && M[ctx.side] === m && m.turnTok === st.tok) playAnim(ctx.side, 'attack', ATK_SP[t]); }, Math.max(0, CH_MS[t] + LEAD[t] - 500 / ATK_SP[t]));
      }
      const parts = [sleep(CH_MS[t])];
      if (R.common && R.common.charge) parts.push(callSafe(() => R.common.charge(kit, ctx), 'common.charge'));
      if (def && def.charge) parts.push(callSafe(() => def.charge(kit, ctx), ctx.type + ' charge'));
      await guard(Promise.all(parts), 1000, ctx.type + ' charge');
    }
    // 2. 大招过场（DOM 横幅，到开始退场时 resolve）+ BattleFX.common.cutin（有登记的话，最多等 1.3 秒）
    async function phaseCutin(ctx, def, R) {
      const parts = [];
      if (ctx.tier === 2) { sfx(ctx.type, 'cutin', 2); showCut(ctx); parts.push(sleep(CUT_IN + CUT_HOLD)); }
      if (R.common && R.common.cutin) parts.push(guard(callSafe(() => R.common.cutin(kit, ctx), 'cutin'), 1300, 'cutin'));
      if (parts.length) await Promise.all(parts);
    }
    // 3. 扑出去：大招做特殊动作；会动的模型等 attack 动作扑到最前面；程序模型 / 纸片往前一扑（物理系扑得远；登记时可以用 physical 指定）
    async function phaseLunge(ctx, def, st) {
      const m = M[ctx.side], t = ctx.tier, phys = isPhysical(ctx, def);
      if (t === 2) await ultMove(ctx, def, st);
      else if (st.rigAtk) await sleep(LEAD[t] - 30);
      else await tween(LUNGE_MS[t][phys ? 1 : 0], k => { if (m.turnTok === st.tok) m.off.copy(ctx.dir).multiplyScalar(Math.sin(k * Math.PI) * (phys ? .9 : .35)); });
      m.talk = 0;
    }
    // 4. 出招：镜头推向挨打的一方（对方出招时直接切过去：从对方身后飞过来会贴着我方台子掠过去）；
    //    types[type].release(kit, ctx)（没登记用老特效）在命中瞬间 resolve。出错就退回保底特效
    async function phaseRelease(ctx, def) {
      camTo(shotToward(ctx.other, ctx.other === 'me' ? .12 : .2, .5), ctx.side === 'foe' ? 1 : 520, EZ.io);
      sfx(ctx.type, 'launch', ctx.tier);
      let p;
      try { p = def ? def.release(kit, ctx) : (FX[ctx.type] || FX.default)(kit, ctx); } catch (e) { warn(ctx.type + ' release 出错', e); p = FX.default(kit, ctx); }
      p = Promise.resolve(p).catch(e => { warn(ctx.type + ' release 出错', e); return FX.default(kit, ctx); });
      await guard(p, CAP[ctx.tier] + 1200, ctx.type + ' release');
    }
    // 5. 命中（不挡流程）：通用命中 impactFx + BattleFX.common.impact + 这个属性的 impact
    function phaseImpact(ctx, def, R) {
      sfx(ctx.type, 'impact', ctx.tier);
      callSafe(() => impactFx(ctx, def), 'impact');
      if (R.common && R.common.impact) bg(() => R.common.impact(kit, ctx), 'common.impact');
      if (def && def.impact) bg(() => def.impact(kit, ctx), ctx.type + ' impact');
    }
    // 6. 余韵（后台淡出）：通用 afterFx + BattleFX.common.after + 这个属性的 after（地面贴花、余烬、冰雾、烟……）
    function phaseAfter(ctx, def, R) {
      if (!noGen(def, 'after')) callSafe(() => afterFx(ctx), 'after');
      if (R.common && R.common.after) bg(() => R.common.after(kit, ctx), 'common.after');
      if (def && def.after) bg(() => def.after(kit, ctx), ctx.type + ' after');
    }

    // 通用蓄力：周身属性光 + 脚下光圈（大招带符文、转得快）+ 一圈光点螺旋着吸进怪兽；中招、大招脚下再推出一圈冲击波；
    // 大招再加从光圈往上冒的光点、点光源（高画质）。大招的光一直亮到特殊动作做完
    function chargeFx(ctx) {
      const { side, tier: t, cols } = ctx, h = monH(side), m = M[side];
      const life = [.5, .8, 2][t], pale = paleK(cols[0]), acc = AURA_ACC[ctx.type];   // 大招的周身光一直亮到特殊动作做完
      // 大招的上色淡一点（.25）：主角特写离得近，身上泛一层属性色就够了，再多就看不出它本来的颜色
      // 点缀色是饱和色、又带 cover，不会把怪兽冲白：强度只打 .75 折（不是浅色的 .45）
      aura(side, Object.assign({ col: acc ? acc[0] : cols[0], col2: acc ? acc[1] : cols[1], life, strength: [.5, .65, .72][t] * (acc ? .75 : pale), tint: pale === 1 && (t === 2 ? .25 : .4), size: t ? 1 : .86 }, acc ? { cover: .7 } : null));
      groundCircle(side, { col: cols[0], col2: cols[1], r: [.8, 1, 1.25][t], life: t === 2 ? 2.2 : life + .1, runes: t === 2, spin: t === 2 ? 1.3 : .8 });
      if (t) shockwave(feet(side).setY(.12), { col: cols[0], col2: cols[1], r0: .3, r1: t === 2 ? 1.9 : 1.3, life: .4, thick: .1 });
      // 吸进来的光点分几波（每波从外圈出发、到蓄力结束前收进中心）
      const waves = [1, 2, 4][t], per = [10, 11, 10][t], T = CH_MS[t] / 1000;
      const wave = w => {
        if (!alive || M[side] !== m) return;
        const c = center(side), left = T * (1 - w / waves);
        emit(per, i => {
          const an = rnd(0, 6.28), r = rnd(.75, 1.2) * (1 + t * .2), lf = Math.max(.14, left * rnd(.75, 1)), y = rnd(-.35, .55) * h;
          const p = c.clone().add(V(Math.cos(an) * r, y, Math.sin(an) * r));
          const v = c.clone().sub(p).multiplyScalar(1 / lf);
          v.x -= Math.sin(an) * r * 1.1; v.z += Math.cos(an) * r * 1.1;   // 横着绕一点：螺旋
          return { pos: p, vel: v, col: Math.random() < .55 ? cols[0] : cols[1], size: rnd(.14, .26) * (1 + t * .15), life: lf, grow: .3, fade: .5, tex: t === 2 && i % 3 === 0 ? 'star' : 'glow', spin: 4 };
        });
      };
      for (let w = 0; w < waves; w++) { if (w) setTimeout(() => wave(w), CH_MS[t] / waves * w); else wave(0); }
      if (t === 2) {
        const f = feet(side);
        for (let i = 0; i < 4; i++) setTimeout(() => { if (alive && M[side] === m) rise(feet(side), cols, 14, 1.05, 2.6, .22, .7); }, i * 180);
        rise(f, ['#ffffff', cols[1]], 10, .5, 1.6, .18, .9);
        // 点光源放在怪兽身后上方当轮廓光（背对主角特写的镜头）：放在身体里会从正面把它照成一片浅黄 / 奶白，主角特写反而看不清
        const cp = CINE ? shotHero(side)().pos : cam.position, away = center(side).sub(cp).setY(0);
        if (away.lengthSq() < 1e-6) away.copy(ctx.dir).negate(); away.normalize();
        light(center(side).addScaledVector(away, h * .9).add(V(0, h * .5, 0)), { col: cols[0], intensity: 2.5, dist: 3, life: 1.8 });
      }
    }
    // 大招特殊动作（FX_SPEC §4.1）：物理系跳起转身砸地 / 后缩再冲刺带残影，特殊系浮起转身发光；会动的模型同时播 attack 动作
    // （扑到最前面 = 出招那一刻），程序模型和纸片靠位移、转身、压扁拉长。做完把 ctx.a（出招点）挪到怪兽现在的位置
    async function ultMove(ctx, def, st) {
      const side = ctx.side, m = M[side], cols = ctx.cols, h = monH(side), bs = m.R.baseScale, dir = ctx.dir, tok = st.tok, sg = side === 'me' ? 1 : -1;
      const live = () => alive && M[side] === m && m.turnTok === tok;
      const style = (def && def.ult) || ULT_STYLE[ctx.type] || 'float';
      const sq = (x, y) => { if (live()) m.R.root.scale.set(bs * x, bs * y, bs * x); };   // 压扁 / 拉长
      const atk = ms => { if (m.R.mixer && live()) playAnim(side, 'attack', Math.min(2.2, Math.max(.8, 500 / ms))); };   // attack 动作扑到最前面落在 ms 毫秒后
      // 镜头：我方切到过肩（看得到对手），对方直接切到我方这边的近景（看它正面扑过来）
      if (CINE) { if (side === 'me') camTo(shotShoulder('me'), 260, EZ.out); else camTo(shotToward('me', .12, .5), 1); }
      if (RM) {   // 减少动态效果：不跳不转，原地亮一下
        atk(300);
        glow(center(side), { col: cols[1], size: h * 1.4, life: .45, follow: () => (live() ? center(side) : null) });
        await sleep(300);
      } else if (style === 'leap') {
        atk(360);
        await tween(80, k => sq(1 + .14 * EZ.out(k), 1 - .2 * EZ.out(k)));   // 蹲下
        let air = true;
        const H = .35 + h * .35, tr = trail(() => (live() && air ? center(side) : null), { col: cols[1], col2: cols[0], width: h * .45, life: .16, max: 1 });
        await tween(180, k => { if (!live()) return; const e = EZ.out(k); m.off.copy(dir).multiplyScalar(.3 * e); m.off.y = H * e; m.spin = Math.PI * 2 * EZ.io(k) * sg; sq(1 - .1 * (1 - k), 1 + .16 * (1 - k)); });   // 跳起来转一圈
        await tween(100, k => { if (!live()) return; m.off.y = H * (1 - k * k); sq(1 - .06 * k, 1 + .1 * k); });   // 砸下来
        air = false; tr.stop(); m.spin = 0;
        if (live()) {
          const f = feet(side);
          shockwave(f.clone().setY(.12), { col: cols[0], col2: cols[1], r1: 1.9, life: .45, thick: .18 });
          emit(18, i => { const an = i / 18 * 6.28; return { pos: f.clone().add(V(Math.cos(an) * .3, .06, Math.sin(an) * .3)), vel: V(Math.cos(an) * 2.4, rnd(.2, .6), Math.sin(an) * 2.4), col: '#e8dcb0', size: rnd(.4, .6), life: rnd(.4, .6), drag: 3, tex: 'smoke', cover: .7, grow: 1.6 }; });
          shake(.16);
        }
        await tween(70, k => sq(1 + .16 * (1 - k), 1 - .2 * (1 - k)));   // 落地压扁再弹回
        const o0 = m.off.clone();
        tween(220, k => { if (live()) m.off.set(o0.x * (1 - EZ.io(k)), m.off.y, o0.z * (1 - EZ.io(k))); });
      } else if (style === 'dash') {
        atk(230);
        await tween(90, k => { if (!live()) return; m.off.copy(dir).multiplyScalar(-.28 * EZ.out(k)); sq(1 + .08 * k, 1 - .08 * k); });   // 往后一缩
        const tr = trail(() => (live() ? center(side) : null), { col: cols[1], col2: cols[0], width: h * .7, life: .2, max: .7 });
        await tween(140, k => { if (!live()) return; m.off.copy(dir).multiplyScalar(-.28 + 1.68 * EZ.out(k)); sq(.92, 1.06); });   // 冲出去
        if (live()) { const c = center(side); emit(16, () => ({ pos: c.clone().add(sph(h * .4)), vel: dir.clone().multiplyScalar(-rnd(3, 5)).add(sph(.4)), col: Math.random() < .5 ? '#ffffff' : cols[1], size: rnd(.12, .22), life: rnd(.2, .3), drag: 2, tex: 'star', spin: rnd(-3, 3) })); }
        await tween(130, k => { if (!live()) return; m.off.copy(dir).multiplyScalar(1.4 * (1 - EZ.io(k))); sq(1, 1); });   // 收回来
        tr.stop();
      } else {
        atk(380);
        shockwave(feet(side).setY(.12), { col: cols[0], col2: cols[1], r1: 1.7, life: .5 });
        glow(center(side), { col: cols[1], size: h * 1.5, life: .7, opacity: .45, follow: () => (live() ? center(side) : null) });
        const L = .3 + h * .12;
        await tween(380, k => { if (!live()) return; m.off.y = L * EZ.out(Math.min(1, k / .6)); m.spin = Math.PI * 2 * EZ.io(k) * sg; });
        m.spin = 0;
        if (live()) { st.lifted = true; const c = center(side); emit(20, () => ({ pos: c.clone(), vel: sph(rnd(1.5, 3)), col: Math.random() < .5 ? '#ffffff' : cols[1], size: rnd(.12, .22), life: rnd(.3, .45), drag: 2.5, tex: 'star', spin: rnd(-4, 4) })); }
      }
      if (live()) { m.spin = 0; m.R.root.scale.setScalar(bs); }
      ctx.a.copy(center(side)).addScaledVector(dir, .3);
    }
    // 通用命中：动画式命中星、冲击波（中招、大招脚下一圈，大招再加一圈面向镜头的）、往外迸的星光、临时点光源、属性色闪烁（中招淡、大招强；限频）；
    // 大招再放慢一下 + 发光后期加强 + 震一下。每一项都能用登记时的 generic 关掉
    function impactFx(ctx, def) {
      const { b, tier: t, cols, other } = ctx, no = k => noGen(def, k);
      if (!no('star')) impactStar(b, { col: t === 2 ? '#ffffff' : '#fffdf0', col2: cols[0], size: [.75, 1.05, 1.6][t], life: [.2, .26, .34][t], spikes: [8, 10, 12][t] });
      if (!no('wave')) {
        if (t) shockwave(feet(other).setY(.12), { col: cols[0], col2: cols[1], r1: t === 2 ? 2.4 : 1.5, life: t === 2 ? .55 : .42, thick: .16 });
        if (t === 2) shockwave(b, { col: '#ffffff', col2: cols[0], flat: false, r1: 1.7, life: .4 });
      }
      if (!no('sparks')) emit([10, 20, 36][t], () => ({ pos: b.clone(), vel: sph(rnd(2.5, 5) * (1 + t * .3)), col: Math.random() < .5 ? '#ffffff' : cols[1], size: rnd(.12, .22) * (1 + t * .2), life: rnd(.2, .35), drag: 3, tex: 'star', spin: rnd(-4, 4), grow: .2 }));
      if (!no('light')) light(b, { col: cols[0], intensity: [4, 7, 12][t], dist: 4 + t, life: [.25, .35, .5][t] });
      if (!no('flash') && t) flash(cols[0], { strength: t === 2 ? .4 : .2, ms: t === 2 ? 320 : 200 });
      if (t === 2 && !no('slowmo')) { slowmo(.35, 260); bloom(2, 520); shake(.22); }
    }
    // 通用余韵：中招、大招在挨打的一方周围留一些慢慢往上飘的星光；大招脚下再留一块淡淡的属性色光斑
    function afterFx(ctx) {
      const { b, tier: t, cols, other } = ctx;
      if (!t) return;
      emit(t === 2 ? 26 : 12, () => ({ pos: b.clone().add(sph(rnd(.2, .7))), vel: V(rnd(-.25, .25), rnd(.25, .7), rnd(-.25, .25)), col: Math.random() < .5 ? cols[1] : '#ffffff', size: rnd(.1, .18), life: rnd(.9, 1.5), drag: .6, tex: Math.random() < .4 ? 'star' : 'glow', spin: rnd(-2, 2), fade: .3, grow: .6 }));
      if (t === 2) decal(feet(other), { kind: 'glow', col: cols[0], r: 1.15, life: 1.6, opacity: .7 });
    }

    // ---------- 大招过场 / 中招横幅（DOM，盖在战场上；FX_SPEC §4、§4.1） ----------
    // 大招：斜切的属性色横幅从出招一方冲进来（速度线、网点、出招怪兽的立绘、招式英文名大字 + 中文小字），进 .22 s、停 .6 s、出 .2 s；
    // 中招：右上角一条小横幅（约 .9 s，不挡战场）。都按 performance.now() 每帧驱动（不用 CSS 动画：假时钟截图对得上，切到后台回来也不乱）；
    // 减少动态效果 / 关了运镜时只淡入淡出。样式在 style.css 的「3D 战斗：大招过场」一节
    const CUT_IN = 220, CUT_HOLD = 600, CUT_OUT = 200, BAN_IN = 160, BAN_HOLD = 580, BAN_OUT = 160;
    const CUT = { el: null, run: null, sp: '', ban: null, banRun: null, zs: [] };
    function cutDom() {
      if (CUT.el) return CUT.el;
      const el = document.createElement('div');
      el.className = 'b3d-cut'; el.style.display = 'none'; el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="bc-dim"></div><div class="bc-band"><i class="bc-acc"></i><i class="bc-acc b"></i><div class="bc-bg"><i class="bc-lines"></i><i class="bc-dots"></i></div>' +
        '<div class="bc-mon"><img alt="" decoding="async"></div><div class="bc-name"><b></b><small></small></div></div>';
      const q = s => el.querySelector(s);
      Object.assign(CUT, { el, dim: q('.bc-dim'), band: q('.bc-band'), lines: q('.bc-lines'), monEl: q('.bc-mon'), img: q('.bc-mon img'), name: q('.bc-name'), nb: q('.bc-name b'), ns: q('.bc-name small') });
      const u = speedTex(); if (u) CUT.lines.style.backgroundImage = 'url(' + u + ')';
      return el;
    }
    // 立绘：发布的 2D 图标（assets/mon2d/<id>.webp）；稀有色的、?art=proc 的、图标读不到的用 Mon3D.snapshot（稀有色图标 / 3D 截图）
    function prepCut(ctx) {
      cutDom();
      const sp = (ctx.info && ctx.info.sp) || M[ctx.side].sp, img = CUT.img;
      if (!sp || CUT.sp === sp.id) return;
      CUT.sp = sp.id;
      const snap = () => { try { return Mon3D.snapshot(sp, 256) || ''; } catch (e) { return ''; } };
      const shiny = sp.shiny || /_shiny$/.test(String(sp.id || ''));
      img.style.visibility = 'hidden';
      img.onload = () => { img.style.visibility = ''; };
      img.onerror = () => { img.onerror = null; const u = snap(); if (u && u !== img.src) img.src = u; };
      img.src = (shiny || Mon3D.mode === 'proc' ? snap() : '') || assetUrl('assets/mon2d/' + String(sp.id || '').replace(/_shiny$/, '') + '.webp');
    }
    function showCut(ctx) {
      const el = cutDom();
      if (el.parentNode !== host) host.appendChild(el);
      prepCut(ctx);
      const info = ctx.info, nm = info && info.name;
      el.className = 'b3d-cut ' + ctx.side + (CINE ? '' : ' rm');
      el.style.setProperty('--c1', ctx.cols[0]); el.style.setProperty('--c2', ctx.cols[1]);
      CUT.nb.textContent = nm || ''; CUT.ns.textContent = (nm && info.zh) || '';
      CUT.name.style.display = nm ? '' : 'none'; CUT.ns.style.display = nm && info.zh ? '' : 'none';
      el.style.display = '';
      CUT.run = { t0: performance.now(), s: ctx.side === 'me' ? 1 : -1, fade: !CINE };
      stepCut();
    }
    function stepCut() {
      const r = CUT.run;
      if (!r) return;
      const t = performance.now() - r.t0, s = r.s;
      if (t >= CUT_IN + CUT_HOLD + CUT_OUT) { CUT.el.style.display = 'none'; CUT.run = null; return; }
      // bx 横幅沿自己的方向滑（% 横幅宽）、mx 立绘再错开一点（视差）、nx / ns / nop 招式名的位置、大小、透明度、dim 压暗、op 整体透明度（只淡入淡出时用）
      let bx = 0, mx = 0, nx = 0, ns = 1, nop = 1, dim = 1, op = 1;
      if (t < CUT_IN) {
        const k = t / CUT_IN, e = EZ.out(k);
        bx = -100 * (1 - e); mx = -45 * (1 - EZ.out(Math.max(0, (t - 50) / (CUT_IN - 50)))); nx = 30 * (1 - e); ns = 1.25 - .13 * e;
        nop = Math.max(0, (t - 70) / (CUT_IN - 70)); dim = e; op = k;
      } else if (t < CUT_IN + CUT_HOLD) {
        const k = (t - CUT_IN) / CUT_HOLD;
        mx = 5 * k; nx = -4 * k; ns = 1 + .12 * Math.max(0, 1 - k / .2);
      } else {
        const k = (t - CUT_IN - CUT_HOLD) / CUT_OUT, e = k * k;
        bx = 100 * e; mx = 5 + 30 * e; nx = -4 - 20 * e; nop = 1 - k; dim = 1 - k; op = 1 - k;
      }
      if (r.fade) { bx = mx = nx = 0; ns = 1; nop = 1; dim *= .7; } else op = 1;
      CUT.el.style.opacity = op.toFixed(3);
      CUT.dim.style.opacity = dim.toFixed(3);
      CUT.band.style.transform = 'translateY(-50%) rotate(' + (-7 * s) + 'deg) translateX(' + (bx * s).toFixed(2) + '%)';
      CUT.monEl.style.transform = 'translateX(' + (mx * s).toFixed(2) + '%)';
      CUT.name.style.transform = 'translate(' + (nx * s).toFixed(2) + '%, -50%) scale(' + ns.toFixed(3) + ')';
      CUT.name.style.opacity = nop.toFixed(3);
      if (!r.fade) CUT.lines.style.backgroundPosition = (t * 1.6 % 4096).toFixed(1) + 'px 0';
    }
    // 中招：右上角的招式名小横幅（英文名 + 中文名），从右边滑进来、扫一道高光、淡出；不挡流程
    function banner(ctx) {
      const info = ctx.info;
      if (!info || !info.name) return;
      if (!CUT.ban) {
        const el = document.createElement('div');
        el.className = 'b3d-ban'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<i class="bn-sheen"></i><b></b><small></small>';
        CUT.ban = el;
      }
      const el = CUT.ban;
      if (el.parentNode !== host) host.appendChild(el);
      el.style.setProperty('--c1', ctx.cols[0]); el.style.setProperty('--c2', ctx.cols[1]);
      el.querySelector('b').textContent = info.name;
      const zh = el.querySelector('small'); zh.textContent = info.zh || ''; zh.style.display = info.zh ? '' : 'none';
      el.style.display = '';
      CUT.banRun = { t0: performance.now(), fade: !CINE };
      stepBan();
    }
    function stepBan() {
      const r = CUT.banRun, el = CUT.ban;
      if (!r) return;
      const t = performance.now() - r.t0;
      if (t >= BAN_IN + BAN_HOLD + BAN_OUT) { el.style.display = 'none'; CUT.banRun = null; return; }
      let x = 0, op = 1;
      if (t < BAN_IN) { const k = t / BAN_IN; x = r.fade ? 0 : 115 * (1 - EZ.out(k)); op = r.fade ? k : Math.min(1, k * 2); }
      else if (t > BAN_IN + BAN_HOLD) { const k = (t - BAN_IN - BAN_HOLD) / BAN_OUT; x = r.fade ? 0 : -8 * k; op = 1 - k; }
      el.style.transform = 'translateX(' + x.toFixed(1) + '%) skewX(-12deg)';
      el.style.opacity = op.toFixed(3);
      el.firstChild.style.backgroundPosition = (r.fade ? 100 : 130 - 260 * Math.min(1, t / (BAN_IN + 320))).toFixed(1) + '% 0';
    }
    // 睡着：头上飘起几个「Z」（DOM，CSS 动画；减少动态效果时只淡入淡出）
    function zzz(side) {
      if (!host) return;
      const [x, y] = screenPos(side);
      for (let i = 0; i < 3; i++) {
        const z = document.createElement('span');
        z.className = 'b3d-z'; z.textContent = 'Z'; z.setAttribute('aria-hidden', 'true');
        z.style.left = (x + 12 + i * 10) + 'px'; z.style.top = (y - 34 - i * 12) + 'px'; z.style.fontSize = (16 + i * 6) + 'px'; z.style.animationDelay = (i * 220) + 'ms';
        host.appendChild(z); CUT.zs.push(z);
        setTimeout(() => { z.remove(); const j = CUT.zs.indexOf(z); if (j >= 0) CUT.zs.splice(j, 1); }, 1700 + i * 220);
      }
    }
    // 辅助招式：原地跳一下、镜头推近；特效用 BattleFX.support[type](kit, ctx)（没登记用保底的光圈）
    async function supportMove(ctx, R) {
      const m = M[ctx.side];
      m.talk = 1;
      camTo(shotToward(ctx.side, .14, .4), 350, EZ.out);
      sfx(ctx.type, 'charge', 0);
      const fn = R.support[ctx.type] || supportDefault;
      const hop = tween(500, k => { m.off.y = Math.sin(k * Math.PI) * .15; });
      await Promise.all([hop, guard(callSafe(() => fn(kit, ctx), ctx.type + ' support'), CAP_SUPPORT + 600, ctx.type + ' support')]);
      m.talk = 0;
      camHome(600, 150);
    }
    function hit(side, opt) {
      const m = M[side]; if (!m) return;
      opt = opt || {};
      m.flash = 1.6;
      // 打击停顿：命中那一下先定住（暴击更久），再放慢一点播受击动作——像新作那样让「挨打」看得清楚
      const stop = opt.crit ? 170 : 90;
      if (m.R.mixer) { m.R.mixer.timeScale = 0; setTimeout(() => { if (m.R.mixer) m.R.mixer.timeScale = 1; if (Mon3D.play) Mon3D.play(m.R, 'hit', .65); }, stop); }
      else if (Mon3D.play) Mon3D.play(m.R, 'hit');
      const back = center(side).sub(center(side === 'me' ? 'foe' : 'me')).setY(0).normalize();
      tween(opt.crit ? 900 : 720, k => { const e = k < .25 ? Math.sin(k / .25 * Math.PI / 2) : 1 - (k - .25) / .75; m.off.copy(back).multiplyScalar(e * (opt.crit ? .38 : .22)); m.off.x += Math.sin(k * 46) * .035 * (1 - k); });
      if (opt.crit) {
        // 暴击：金色的大命中星 + 一圈面向镜头的冲击波
        const p = center(side);
        impactStar(p, { col: '#fff6c8', col2: '#ffc53d', size: 1.35, life: .32, spikes: 12 });
        shockwave(p, { col: '#ffe082', col2: '#ffffff', flat: false, r1: 1.4, life: .36, thick: .1 });
        // 暴击很常见（答得好就暴击）：全屏闪淡一点（.25），震动也算进这一招的大震次数里（不再 force）
        shake(.3); flash('#fff8e1', { strength: .25, ms: 260 }); sfx(stats.move ? stats.move.type : 'normal', 'crit', stats.move ? stats.move.tier : 0);
      }
      camPunch(() => center(side), opt.crit ? .9 : .45, opt.crit ? 1000 : 800);   // 命中：镜头往挨打的一方推近，多停一会儿
      if (shot && shot.to !== HOME) camHome(750, opt.crit ? 900 : 700);
    }
    // 小尘土圈（落地、倒下）
    const dust = (at, n, sp) => emit(n, i => { const an = i / n * 6.28 + rnd(-.2, .2); return { pos: at.clone().add(V(Math.cos(an) * .25, .06, Math.sin(an) * .25)), vel: V(Math.cos(an) * sp, rnd(.15, .5), Math.sin(an) * sp), col: '#e8dcb0', size: rnd(.4, .6), life: rnd(.45, .65), drag: 3, tex: 'smoke', cover: .7, grow: 1.6 }; });
    async function faint(side) {
      const m = M[side]; if (!m) return;
      const ms = mats(side);
      const fall = Mon3D.play ? Mon3D.play(m.R, 'faint') : 0;
      // 倒下时镜头慢慢推过去（怪兽在往下沉，按开始的位置推）；对方离得远，主要靠变焦，别从我方怪兽背后穿过去
      const at = center(side), foe = side === 'foe';
      camTo(() => ({ pos: lerpV(CAM.pos, at, foe ? .1 : .26).add(V(foe ? .35 * camF : 0, foe ? .45 : 0, 0)), look: lerpV(CAM.look, at, .8), fov: foe ? 27 : 33 }), fall ? fall * 1000 + 650 : 900, EZ.sine);
      // 倒地扬起一圈尘土（会动的模型在侧倒到底的时候）
      setTimeout(() => { if (alive && M[side] === m) dust(feet(side), 14, 1.6); }, fall ? fall * 1000 * .62 : 120);
      if (fall) await sleep(fall * 1000 + 250);   // 会动的模型先侧倒，再淡出
      // 淡出时身上化成往上飘的光点
      if (M[side] === m) { const h = monH(side); rise(m.R.root.position.clone().setY(.15), ['#ffffff', '#d8dcff'], 28, .45, 1.1, .26, .9); emit(10, () => ({ pos: center(side).add(sph(h * .3)), vel: V(rnd(-.2, .2), rnd(.5, 1), rnd(-.2, .2)), col: '#ffffff', size: rnd(.12, .2), life: rnd(.7, 1), tex: 'star', spin: rnd(-2, 2), fade: .3 })); }
      ms.forEach(q => { q.transparent = true; });
      await tween(fall ? 400 : 700, k => { if (!fall) m.off.y = -k * .6; ms.forEach(q => { q.opacity = 1 - k; }); });
      m.R.root.visible = false; m.gone = true;
      ms.forEach(q => { q.opacity = 1; q.transparent = !!q.userData.sprite; }); m.off.set(0, 0, 0);
      camHome(750, 200);
    }
    // 异常状态：烧伤小火苗、中毒泡泡 + 毒渍、麻痹电弧、睡眠烟团 + 飘起来的 Z、冰冻冰块 + 冰霜、混乱头上绕圈的星星
    const ST_COL = { brn: ['#ff5a1f', '#ffd54f'], psn: ['#9b4dca', '#e1bee7'], par: ['#ffe14d', '#ffffff'], slp: ['#7986cb', '#e8eaf6'], frz: ['#9be7ff', '#ffffff'], conf: ['#ff5ea8', '#fff59d'] };
    function status(side, kind) {
      const m = M[side]; if (!m) return;
      const c = ST_COL[kind] || ST_COL.conf, p = center(side), f = feet(side), h = monH(side);
      if (kind === 'brn') {
        for (let i = 0; i < 4; i++) flame(f.clone().add(V(rnd(-.4, .4), rnd(.05, h * .35), rnd(-.25, .25))), { col: c[0], col2: c[1], size: rnd(.28, .45), life: rnd(.55, .85), rise: .35, push: .2 });
        rise(f, c, 24, .45, 1.6, .3, .9);
        aura(side, { col: c[0], col2: c[1], life: .7, strength: .55 });
      } else if (kind === 'psn') {
        emit(22, () => ({ pos: f.clone().add(V(rnd(-.45, .45), rnd(.1, h * .6), rnd(-.3, .3))), vel: V(rnd(-.15, .15), rnd(.5, 1.1), rnd(-.15, .15)), col: Math.random() < .6 ? c[0] : c[1], size: rnd(.16, .34), life: rnd(.7, 1.2), tex: 'ring', cover: .35, grow: 1.3, fade: .5 }));
        decal(f, { kind: 'splash', col: c[0], col2: c[1], r: .75, life: 1.4 });
        aura(side, { col: c[0], col2: c[1], life: .7, strength: .55 });
      } else if (kind === 'par') {
        for (let i = 0; i < 3; i++) lightning(p.clone().add(sph(h * .45)), p.clone().add(sph(h * .45)), { col: c[0], width: .025, branches: 1, life: .35, jag: .45, rate: .05 });
        emit(18, () => ({ pos: p.clone(), vel: sph(rnd(1.5, 3)), col: Math.random() < .5 ? c[0] : '#ffffff', size: rnd(.12, .22), life: rnd(.25, .4), drag: 3, tex: 'star', spin: rnd(-6, 6) }));
        aura(side, { col: c[0], col2: c[1], life: .45, strength: .6 });
      } else if (kind === 'slp') {
        emit(12, () => ({ pos: p.clone().add(sph(.3)).add(V(0, h * .25, 0)), vel: V(rnd(-.12, .12), rnd(.25, .45), rnd(-.12, .12)), col: '#c5cae9', size: rnd(.5, .8), life: rnd(1, 1.4), tex: 'smoke', cover: .5, grow: 1.5 }));
        rise(m.R.root.position.clone().setY(.4), c, 16, .4, .8, .3, 1.2);
        zzz(side);
      } else if (kind === 'frz') {
        chunks(() => geo('oct.08', () => new T3.OctahedronGeometry(.08, 0)), '#bff3ff', 10, p, .3, .9);
        burst(p, c, 24, 2, .4, .6);
        decal(f, { kind: 'frost', r: .85, life: 1.6 });
        shockwave(f.clone().setY(.12), { col: c[0], col2: c[1], r1: 1.3, life: .45 });
        aura(side, { col: c[0], col2: c[1], life: .6, strength: .7 });
      } else if (kind === 'conf') {
        for (let i = 0; i < 3; i++) ring(p.clone().add(V(0, .5, 0)), c[i % 2], .1, .5, .8, .03).rotation.x = Math.PI / 2;
        // 头上绕圈的四颗星（按特效时间转）
        const top = () => (M[side] === m ? center(side).add(V(0, h * .62, 0)) : null);
        for (let i = 0; i < 4; i++) {
          const a0 = i / 4 * 6.28;
          glow(top(), { col: i % 2 ? c[1] : c[0], size: .34, life: 1.1, cover: .5, follow: () => { const q = top(); if (!q) return null; const an = a0 + UT.value * 5; return q.add(V(Math.cos(an) * .4, Math.sin(an * 2) * .04, Math.sin(an) * .4)); } });
        }
        emit(10, () => ({ pos: p.clone().add(V(0, h * .6, 0)), vel: sph(rnd(.6, 1.2)), col: c[1], size: rnd(.14, .22), life: rnd(.5, .8), tex: 'star', spin: rnd(-4, 4) }));
      } else burst(p, c, 40, 2.5, .45, .7, 1);
      m.flash = .6;
    }
    // 能力升降：脚下光圈 + 往上飘（升）/ 往下沉（降）的星光 + 三道一道接一道的光环
    function buff(side, up) {
      const m = M[side]; if (!m) return;
      const at = m.R.root.position.clone(), h = monH(side), col = up ? '#7dffb0' : '#6ab7ff', col2 = up ? '#eafff2' : '#e3f2ff';
      emit(34, () => { const a = rnd(0, 6.28), r = rnd(.2, .65); return { pos: at.clone().add(V(Math.cos(a) * r, up ? rnd(0, .4) : rnd(1, 1.5) * h, Math.sin(a) * r)), vel: V(0, (up ? 1 : -1) * rnd(1.4, 2.4), 0), col: Math.random() < .7 ? col : col2, size: rnd(.16, .3), life: rnd(.6, .9), tex: Math.random() < .5 ? 'star' : 'glow', grow: .4 }; });
      groundCircle(side, { col, col2, r: .95, life: .9, spin: up ? 1.4 : -1.4 });
      [0, 1, 2].forEach(i => setTimeout(() => { if (alive && M[side] === m) ring(m.R.root.position.clone().setY(up ? .15 + i * h * .38 : h * 1.05 - i * h * .38), col, .35, .85, .45, .045); }, i * 110));
      aura(side, { col, col2, life: .6, strength: .5 });
    }
    // 回复：带符文的绿色光圈 + 往上冒的光点 + 从头上洒下来的星光 + 身上泛绿光
    function heal(side) {
      const m = M[side]; if (!m) return;
      const p = m.R.root.position.clone(), h = monH(side);
      rise(p, ['#7dffb0', '#ffffff'], 46, .6, 1.8, .4, 1);
      groundCircle(side, { col: '#7dffb0', col2: '#ffffff', r: 1, life: 1.1, runes: true, spin: .8 });
      emit(22, () => ({ pos: p.clone().add(V(rnd(-.5, .5), h * rnd(1.1, 1.5), rnd(-.4, .4))), vel: V(0, -rnd(.4, .8), 0), col: Math.random() < .5 ? '#ffffff' : '#b9ffd6', size: rnd(.14, .24), life: rnd(.8, 1.1), tex: 'star', spin: rnd(-2, 2), fade: .4 }));
      aura(side, { col: '#7dffb0', col2: '#ffffff', life: .9, strength: .6 });
    }
    // ---------- 扔回声球收服 ----------
    // 回声球是一只尖顶朝上的螺旋海螺：开口朝镜头，开口里含着一颗发光的回声珠（2D 图标是 Cartoon.shell，颜色一致）。
    // 外层 ball 的原点在壳底：落地贴地、摇晃时以壳底为支点；里层 body 的原点在壳的中间：飞的时候绕自己翻滚
    // 轮廓（半径, 高）：圆底、肩膀最宽，往上三圈一圈比一圈小（圈和圈之间往里收一道缝），最后是尖顶
    const SHELL_H = .47, SHELL_MID = .21;
    const SHELL_PROF = [[0, 0], [.08, .008], [.135, .04], [.165, .09], [.172, .14], [.162, .182], [.134, .207], [.12, .215], [.127, .232], [.121, .258], [.098, .279], [.084, .286], [.089, .301], [.081, .326], [.06, .343], [.05, .349], [.053, .363], [.042, .39], [.024, .425], [0, SHELL_H]];
    const SHELL_SEAM = [.212, .284, .347];   // 圈和圈之间的缝（缝上压一道浅色的棱）
    // 颜色以 cartoon.js 的 Cartoon.SHELL 为准；单独打开（tools/fx.html 没载 cartoon.js）时用这里的一份
    const SHELL_COL = (window.Cartoon && Cartoon.SHELL) || {
      ball: { body: '#9b7cf2', rib: '#d3c2ff', lip: '#fff1dc', inner: '#f6b7c9', pearl: '#f3ecff', glow: '#b388ff' },
      gold: { body: '#f5b82e', rib: '#ffe59a', lip: '#fff6dc', inner: '#ffb48a', pearl: '#d9fdff', glow: '#26c6da' },
    };
    function shellMesh(gold) {
      const c = SHELL_COL[gold ? 'gold' : 'ball'];
      const g = new T3.Group(), body = new T3.Group();
      body.position.y = SHELL_MID; g.add(body);
      const toon = col => new T3.MeshToonMaterial({ color: col, side: T3.DoubleSide });
      const put = (geo, mat, x, y, z) => { const o = new T3.Mesh(geo, mat); o.position.set(x || 0, (y || 0) - SHELL_MID, z || 0); o.castShadow = true; body.add(o); return o; };
      // 壳身
      put(new T3.LatheGeometry(SHELL_PROF.map(([x, y]) => new T3.Vector2(x, y)), 24), toon(c.body));
      // 每道缝上一圈浅色的棱，稍微斜一点，看起来是一圈圈盘上去的
      const rAt = y => { for (let i = 1; i < SHELL_PROF.length; i++) { const [x0, y0] = SHELL_PROF[i - 1], [x1, y1] = SHELL_PROF[i]; if (y1 >= y) return x0 + (x1 - x0) * (y - y0) / ((y1 - y0) || 1); } return 0; };
      SHELL_SEAM.forEach((y, i) => { const r = rAt(y) + .006; const o = put(new T3.TorusGeometry(r, .012 - i * .002, 5, 28), toon(c.rib), 0, y, 0); o.rotation.order = 'YXZ'; o.rotation.set(Math.PI / 2 + .1, .4 + i * 2.1, 0); });
      // 肩膀上一圈小疙瘩（正面留给开口）
      for (let k = 0; k < 5; k++) {
        const a = .95 + k * (Math.PI * 2 - 1.9) / 4, d = V(Math.sin(a), .6, Math.cos(a)).normalize();
        put(new T3.ConeGeometry(.026, .07, 6), toon(c.rib), Math.sin(a) * .158, .178, Math.cos(a) * .158).quaternion.setFromUnitVectors(V(0, 1, 0), d);
      }
      // 开口（+z）：奶油色的唇边、粉色的里面、发光的回声珠
      const lip = put(new T3.TorusGeometry(.082, .022, 6, 22), toon(c.lip), .03, .125, .15); lip.scale.set(1, 1.22, 1); lip.rotation.set(-.15, .22, -.22);
      const inner = put(new T3.SphereGeometry(.084, 14, 10), toon(c.inner), .03, .125, .146); inner.scale.set(.95, 1.18, .3); inner.rotation.set(-.15, .22, -.22);
      const pearl = put(new T3.SphereGeometry(.046, 14, 10), new T3.MeshBasicMaterial({ color: c.pearl }), .034, .118, .17);
      pearl.castShadow = false; pearl.layers.enable(1);   // 发光后期里亮一点
      g.userData.body = body; g.userData.col = c;
      return g;
    }
    let ball = null;
    const dropBall = () => { if (ball) { ball.removeFromParent(); releaseObj(ball); ball = null; } };
    // 壳的中间（开口、珠子差不多在这个高度）
    const ballMid = () => ball.position.clone().add(V(0, SHELL_MID, 0));
    // 回声：从壳里一圈圈往外扩的声波（面向镜头的圆环）；n 圈，每圈隔 gap 毫秒
    function echoRings(at, col, n, r1, gap) {
      for (let i = 0; i < n; i++) setTimeout(() => { if (alive) shockwave(at.clone(), { col, col2: '#ffffff', flat: false, r0: .12, r1: r1 * (1 + i * .25), life: .42, thick: .045, push: .2, opacity: .85 }); }, i * gap);
    }
    // 开口朝镜头（只转水平方向）
    const faceCam = o => { o.rotation.set(0, Math.atan2(cam.position.x - o.position.x, cam.position.z - o.position.z), 0); };
    async function catchThrow(sup) {
      const m = M.foe;
      dropBall();
      ball = shellMesh(sup); ball.userData.keep = true;
      const a = center('me'), b = center('foe'), bl = ball, body = ball.userData.body, tc = ball.userData.col.glow;
      const tr = trail(() => (bl.parent ? bl.position.clone().add(V(0, SHELL_MID, 0)) : null), { col: '#ffffff', col2: tc, width: .14, life: .22, max: 1.5 });   // 回声球飞过去的拖尾
      // 飞的时候壳绕着自己翻滚（里层转，外层只管位置）
      await fly(a.clone().setY(a.y - SHELL_MID), b.clone().setY(b.y - SHELL_MID + .2), 520, ball, (p, k) => { body.rotation.set(-k * 7, k * 11, 0); });
      tr.stop();
      if (ball !== bl) return;
      scene.add(ball); ball.position.copy(b).setY(b.y - SHELL_MID + .2); body.rotation.set(0, 0, 0); faceCam(ball);
      flash('#ffffff', 250);
      // 怪兽化成光，被吸进开口里的珠子
      const bp = ballMid();
      emit(34, () => { const p0 = center('foe').add(sph(rnd(.2, .6))), lf = rnd(.24, .34); return { pos: p0, vel: bp.clone().sub(p0).multiplyScalar(1 / lf), col: Math.random() < .5 ? '#ffffff' : tc, size: rnd(.12, .22), life: lf, grow: .3 }; });
      glow(bp, { col: '#e6dcff', size: .9, life: .45 });
      echoRings(bp, tc, 2, .7, 140);
      const s = m.R.baseScale;
      await tween(320, k => { m.R.root.scale.setScalar(s * (1 - k)); });
      m.R.root.visible = false;
      // 落到地上，再轻轻弹一下
      const y0 = ball ? ball.position.y : 0;
      await tween(240, k => { if (ball) ball.position.y = y0 * (1 - k * k); });
      await tween(200, k => { if (ball) { ball.position.y = Math.sin(k * Math.PI) * .07; ball.rotation.z = Math.sin(k * Math.PI) * .12; } });
      if (ball) { ball.position.y = .005; ball.rotation.z = 0; }
    }
    // 传出一声回声：海螺不摇晃，而是轻轻鼓起来一下、亮一下，从开口冒出一圈声波（monsters.js 一共传两声）
    async function wobble() {
      if (ball) echoRings(ballMid(), ball.userData.col.glow, 1, .6, 0);
      const s0 = ball ? ball.scale.x : 1;
      await tween(560, k => { if (ball) ball.scale.setScalar(s0 * (1 + Math.sin(k * Math.PI) * .18)); });
      if (ball) ball.scale.setScalar(s0);
    }
    async function sealed() {
      if (!ball) return;
      const p = ballMid(), bl = ball;
      burst(p, ['#ffe082', '#ffffff'], 30, 2.5, .4, .7); ring(p, '#ffe082', .1, 1, .5);
      impactStar(p, { col: '#fff6c8', col2: '#ffc53d', size: .9, life: .4, spikes: 8 });
      shockwave(ball.position.clone().setY(.1), { col: '#ffe082', col2: '#ffffff', r1: 1.2, life: .5 });
      echoRings(p, ball.userData.col.glow, 3, .9, 110);   // 收好了：三圈回声
      emit(14, () => ({ pos: p.clone(), vel: sph(rnd(1, 2)).setY(rnd(1, 2.2)), col: Math.random() < .5 ? '#ffe082' : '#ffffff', size: rnd(.14, .24), life: rnd(.6, .9), grav: -2, tex: 'star', spin: rnd(-4, 4) }));
      // 壳高兴地跳一下
      await tween(300, k => { if (ball === bl) ball.position.y = .005 + Math.sin(k * Math.PI) * .12; });
    }
    async function breakOut() {
      const m = M.foe; flash('#ffffff', 250);
      if (ball) { const p = ballMid(), tc = ball.userData.col.glow; burst(p, ['#ffffff', tc], 34, 3, .45, .5); shockwave(ball.position.clone().setY(.1), { col: '#ffffff', col2: tc, r1: 1.5, life: .4 }); impactStar(p, { col: '#ffffff', col2: tc, size: .8, life: .25 }); echoRings(p, tc, 2, .8, 90); }
      dropBall();
      m.R.root.visible = true;
      await tween(300, k => { m.R.root.scale.setScalar(m.R.baseScale * k); });
    }
    function removeBall() { dropBall(); }

    // ---------- 每帧 ----------
    const camJit = V(0, 0, 0);
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      // 画面丢了：等它恢复；2.5 秒还没恢复就换一个新的渲染器（glRebuild）
      if (GL.lost) { if (now - GL.lost > 2500 && !document.hidden) glRebuild(); if (GL.lost) return; }
      // 每秒最多画 60 次（120Hz 的屏幕不用画两倍，省电不烫手）；动画都按时间算，不受影响
      if (now < nextDraw - 2) return;
      nextDraw = Math.max(nextDraw + 1000 / 60, now + 1000 / 60 - 6);
      const rdt = last ? Math.min(250, now - last) : 16; last = now;
      const ts = timeScale();
      fxNow += rdt * ts;   // 特效时间（毫秒）：slowmo 时走得慢
      const dtR = Math.min(.05, rdt / 1000), dt = dtR * ts;   // 真实 dt（镜头、震动）和特效 dt
      monT += dt; UT.value += dt;
      const t = now / 1000;
      stepAnim();
      ['me', 'foe'].forEach(side => {
        const m = M[side]; if (!m) return;
        Mon3D.animate(m.R, monT + (side === 'me' ? 0 : 1.3), { talk: m.talk ? Math.floor(t * 8) % 2 === 0 : false });
        m.R.root.position.copy(POS[side]).add(m.off);
        m.R.root.rotation.y = m.yaw + m.turn + m.spin;
        // 受击泛白 + kit.aura 的属性色。泛白是一次平滑淡出（不一亮一暗地闪：以前约 11Hz 的频闪对光敏的孩子不安全，FX_SPEC §6），
        // 最亮也到不了纯白（.55，减少动态效果时 .3）；hit() 给 1.6（约 .6 秒淡完），异常状态给 .6（淡一点、短一点）
        if (m.flash > 0 || m.tintV > 0 || m.tinted) {
          m.flash = Math.max(0, m.flash - dt * 2.6);
          const e = (RM ? .3 : .55) * Math.pow(Math.min(1, m.flash / 1.6), 2), tv = m.tintV || 0, tc = m.tintCol;
          m.tinted = e > 0 || tv > 0;
          m.mats.forEach(q => { if (q.emissive) q.emissive.setRGB(e + tc.r * tv, e + tc.g * tv, e + tc.b * tv); else q.color.setRGB(1 + e * 1.5 + tc.r * tv * 2, 1 + e * 1.5 + tc.g * tv * 2, 1 + e * 1.5 + tc.b * tv * 2); });
        }
      });
      env.children.forEach(o => { if (o.userData.drift) { o.position.x += o.userData.drift * dtR; if (o.position.x > 14) o.position.x = -14; } });
      ripplesStep(now);
      pUni.uScale.value = host.clientHeight * renderer.getPixelRatio() * 1.3;   // 粒子大小按实际像素算（高像素比的手机上不会变小）
      stepParticles(dt);
      stepFx(dt);
      stepLights(dt);
      stepFlash();
      stepCut(); stepBan();   // 大招过场、中招横幅（DOM）
      // 镜头：轻轻呼吸 + 震动
      shakeAmt = Math.max(0, shakeAmt - dtR * 1.2);
      const cs = camStep(now);
      const drift = RM ? 0 : 1;   // 平时很慢地晃（减少动态效果时不晃）
      cam.position.copy(cs.pos);
      cam.position.x += Math.sin(t * .23) * .12 * drift; cam.position.y += Math.sin(t * .31) * .05 * drift; cam.position.z += Math.sin(t * .17) * .06 * drift;
      if (shakeAmt) { camJit.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(shakeAmt * .25); cam.position.add(camJit); }
      cam.lookAt(cs.look);
      if (Math.abs(cam.fov - cs.fov) > .01) { cam.fov = cs.fov; cam.updateProjectionMatrix(); }
      renderer.render(scene, cam);
      if (!warmed) { warmed = true; warm(); }   // 第一帧画完（阴影贴图有了）再预编译特效着色器
      if (BL && (pCount || BB || glowLive())) { try { bloomPass(bloomStr()); } catch (e) { warn('发光后期出错', e); } }
    }
    // 还有没有要发光的特效（在第 1 层、看得见、画得出东西的）：贴花、实心的碎块、只当计时器的空物件不算——
    // 只剩它们的时候不开发光后期（半分辨率重画 + 4 次模糊，高画质 DPR 3 的手机上很费电）
    function glowLive() {
      for (let i = 0; i < fx.length; i++) {
        const o = fx[i].obj;
        if (o.visible && (o.layers.mask & 2) && (o.isMesh || o.isPoints || o.isLine || o.children.length)) return true;
      }
      return false;
    }
    function resize() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dpr || 1.5));
      renderer.setSize(w, h, false);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cam.aspect = w / h;
      // 画面窄（竖屏）就把镜头拉远：左右两只怪兽（x = ±1.75，再留出身子和一点边）都要在画面里
      const f = Math.max(1, 2.55 / (Math.tan(FOV / 2 * Math.PI / 180) * (w / h)) / 6.9);
      CAM.pos.set(0, 1.6 + (f - 1) * .9, 6.9 * f);
      if (f !== camF) { camF = f; placeBackdrop(); }
      cam.updateProjectionMatrix();
      pUni.uScale.value = h * renderer.getPixelRatio() * 1.3;
      bloomSize();
    }
    // 怪兽在画面上的位置（给伤害数字、提示用），相对 host 左上角
    function screenPos(side) {
      const m = M[side]; if (!m) return [0, 0];
      // 按默认机位算：运镜时镜头会动，但伤害数字、提示要和平时站位对齐（镜头一会儿就回来）
      homeCam.aspect = cam.aspect; homeCam.fov = FOV; homeCam.updateProjectionMatrix();
      homeCam.position.copy(CAM.pos); homeCam.lookAt(CAM.look); homeCam.updateMatrixWorld();
      const p = center(side).project(homeCam);
      return [(p.x + 1) / 2 * host.clientWidth, (1 - p.y) / 2 * host.clientHeight];
    }
    const homeCam = new T3.PerspectiveCamera(38, 1, .1, 80);
    function mount(el) { host = el; el.prepend(canvas); resize(); }
    function destroy() {
      alive = false; cancelAnimationFrame(raf); clearTimeout(camTimer); envTok++;
      ['me', 'foe'].forEach(s => { if (M[s]) { scene.remove(M[s].R.root); Mon3D.dispose(M[s].R); } if (RIP[s]) { scene.remove(RIP[s]); RIP[s].traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); RIP[s] = null; } });
      fx.splice(0).forEach(f => { f.done = true; f.obj.removeFromParent(); releaseObj(f.obj); });
      anim.splice(0).forEach(a => a.res());   // 还在等的动画都当完成了（别让放招一直卡着）
      dropBall();
      PP.geo.dispose(); PP.mat.dispose();
      atlas.dispose();
      Object.keys(GEO).forEach(k => GEO[k].dispose());
      Object.keys(MP).forEach(k => MP[k].all.forEach(m => m.dispose()));
      ribAll.forEach(g => g.dispose());
      if (BL) { [BL.a, BL.b, BL.c, BL.d].forEach(rt => rt.dispose()); BL.quad.geometry.dispose(); BL.blur.dispose(); BL.comp.dispose(); BL.occ.dispose(); }
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove(); if (FL.el) FL.el.remove();
      if (CUT.el) CUT.el.remove(); if (CUT.ban) CUT.ban.remove(); CUT.zs.splice(0).forEach(z => z.remove()); CUT.run = CUT.banRun = null;
    }
    // 预先编译特效着色器（每种拿一个材质编译完还回池子，第一次放招不卡）；高画质再空跑一遍发光后期，把画到半分辨率缓冲用的那一套也编译好
    function warm() {
      try {
        const g = new T3.Group(), s = geo('sph14', () => new T3.SphereGeometry(1, 14, 10));
        Object.keys(QUAD_FS).forEach(k => g.add(quad(k, true)));
        g.add(new T3.Mesh(geo('beamq', () => new T3.PlaneGeometry(1, 1, 1, 24).translate(0, .5, 0)), beamMat()));
        g.add(new T3.Mesh(ribGet(), ribMat('#ffffff', '#ffffff', 8)));
        g.add(new T3.Mesh(s, glowMat('#ffffff')), new T3.Mesh(s, toonMat('#ffffff')), new T3.Mesh(s, toonMat('#ffffff', { transparent: true })));
        g.children.forEach(o => { o.scale.setScalar(.001); o.frustumCulled = false; });
        fxLayer(g); scene.add(g);
        renderer.compile(g, cam, scene);
        if (BL) bloomPass(0);
        scene.remove(g);
        releaseObj(g);
      } catch (e) { warn('预编译特效着色器出错', e); }
    }
    setEnv(opts.theme);
    mount(host);
    raf = requestAnimationFrame(frame);
    return {
      intro, setEnv, setMon, enter, attack, hit, faint, heal, status, buff, catchThrow, wobble, sealed, breakOut, removeBall, screenPos, mount, resize, destroy,
      kit, quality: Q,
      // 调试 / 工具用：粒子数和峰值、特效物件数、闪屏次数、显存对象数、着色器程序数
      fxStats: () => ({ parts: pCount, peak: stats.peak, fx: fx.length, anim: anim.length, flashes: stats.flashes, flashSkipped: stats.flashSkipped, over: stats.over, lights: LIGHTS.filter(L => L.userData.fx.life).length, move: stats.move, mem: Object.assign({}, renderer.info.memory), programs: renderer.info.programs ? renderer.info.programs.length : 0 }),
      fxReset: () => { stats.peak = pCount; stats.flashes = stats.flashSkipped = stats.over = 0; },
      fxIdle: () => !fx.length && !pCount && !FL.on && !anim.length && !CUT.run && !CUT.banRun,
      get canvas() { return canvas; }, get camBusy() { return !!(shot || punch); },
      glInfo: () => ({ lost: !!GL.lost, n: GL.n }),   // 画面丢过几次、现在是不是丢着（测试 / 诊断用）
    };
  }

  window.Battle3D = { create, TYPE_COL, QUAL, CAP };
})();
