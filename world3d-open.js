// 回声岛 · 新画风的大地图（样品，默认不用）：镜头放低、跟在主角身后，看得到天和远处；地面有起伏
// 打开方式：网址带 ?look=new，或者 localStorage['echo-look'] = 'new'。不打开时这个文件什么都不做，world.js 照旧用 world3d.js
// 只画户外地图（小镇、道路）；室内、挑战馆、洞穴、海底交给 world3d.js 的老渲染器（见最下面的 create：两个渲染器各有一张画布，按地图换着用）
//
// 画风（这一版要做到的样子）：
//   · 明亮、干净的手绘卡通：一块块颜色，颜色之间柔和过渡；明暗只分两三档（亮面 / 半亮 / 背光），不是平滑的渐变
//   · 太阳是暖色的，影子偏冷偏蓝；远处的东西更浅、更蓝（隔着空气），一直淡到地平线上那一条暖白色的雾气里
//   · 跟着走的怪兽、人物、房子、树、山的轮廓有一圈细细的深色描边（按深度图在后期里画，线的颜色是底色压暗，不是纯黑）
//   · 草地是一片看得见的草叶：慢慢地成片起伏，时不时有一阵风从远处扫过来，草尖跟着变亮；草里散着小花
//   · 天空头顶是清澈的蓝，越靠近地平线越浅越暖；圆滚滚的积云慢慢飘
//   · 水是青绿色的，岸边一圈白色的浪花线，水面上有游动的亮点
//   · 亮的地方有一点点柔光；空气里飘着花瓣和花粉，花丛边有一两只蝴蝶
//   · 不用移轴虚化（那是老版「小模型」的感觉）
// 镜头和遮挡：镜头在主角南边上方、朝北看（方向不变，摇杆不用改），地平线在画面上面约五分之一、主角在中间偏下。
//   房子挡在镜头和主角中间 → 整栋用网点淡出去，只留地上一圈墙基；树和别的东西 → 在主角周围开一个圆窗；岩壁 → 镜头抬高；
//   主角面朝北和人说话 → 镜头也抬高一些（不然主角的背影正好把对面的人挡住）
// 逻辑一点没动：走路还是一格一格的，world.js 每帧给的 V（主角 / 怪兽 / 人物 / 道具 / 提示的格子坐标）只是换了个画法；
// 地形高度只从地图数据推（台阶 L 是往南跳的坎，水比地面低，走不了的边界鼓成小山），V 里的东西都贴着这个地面放
(function () {
  'use strict';

  const LOOK = (() => { try { return new URLSearchParams(location.search).get('look') || localStorage.getItem('echo-look') || ''; } catch (e) { return ''; } })();

  // 三档画质。dpr 是上限；sub：地面每格分成几段；grass / lawn：草丛、草坪的密度；ring：地图外面种几圈树；
  // skirt：地图外面的地形做多宽；far：最远画到哪（雾在这里完全盖住）；msaa：抗锯齿采样数；bloom：柔光图缩小多少倍（0 = 不要）
  const TIERS = {
    high: { dpr: 2, shadow: 2048, post: true, msaa: 4, bloom: 4, sub: 4, grass: 1, lawn: 1, ring: 10, skirt: 46, far: 300, clouds: 12, life: 1, cell: 160, mask: 8 },
    mid: { dpr: 1.5, shadow: 1024, post: true, msaa: 2, bloom: 6, sub: 3, grass: .6, lawn: .62, ring: 7, skirt: 38, far: 240, clouds: 8, life: .5, cell: 96, mask: 8 },
    low: { dpr: 1, shadow: 0, post: false, msaa: 0, bloom: 0, sub: 2, grass: .32, lawn: .22, ring: 5, skirt: 30, far: 170, clouds: 5, life: 0, cell: 64, mask: 6 },
  };
  const DIRI = { down: 0, left: 1, right: 2, up: 3 };
  const WATER = '~Dw', EXITS = '^v<>', BUILD = 'CMGHJAEcmghja';
  // 这张地图新渲染器画不画得了：只管户外的小镇和道路；有机关地板图层（over）的先不管
  const supports = m => !!m && (m.kind === 'town' || m.kind === 'route') && !m.over;

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
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ---------- 着色器里公用的几段 ----------
  // 雾（隔着空气的颜色）：近处不变，越远越浅越蓝（远山成了淡蓝色的剪影），最远那一截才化进地平线上的暖白色；uFogP = (开始距离, 浓度, 最远)
  const FOG_PARS = 'uniform vec3 uFogA; uniform vec3 uHaze; uniform vec3 uFogP;\n' +
    'vec3 airFog(vec3 c, float d) { float f = 1.0 - exp(-max(0.0, d - uFogP.x) * uFogP.y); return mix(mix(c, uFogA, f * 0.94), uHaze, smoothstep(uFogP.z * 0.5, uFogP.z, d)); }\n';
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
    // 光：太阳在镜头的左后方（西南、半高），朝着镜头的墙是亮面、朝西的是半亮、朝东朝北的背光；影子落向右后方
    // 天光偏冷（影子里只有它，所以影子是蓝的），太阳偏暖。three 的漫反射要除以 π，所以强度都乘了 π
    const SUN_DIR = new T3.Vector3(-.35, .68, .64).normalize();
    const hemi = new T3.HemisphereLight(0xcfe0ff, 0xd9cfae, Math.PI * .56);
    const sun = new T3.DirectionalLight(0xfff0d0, Math.PI * .5);
    scene.add(hemi, sun, sun.target);
    if (Q.shadow) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      const e = tier === 'high' ? 21 : 17;
      Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 90 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.03;
      sun.shadow.radius = tier === 'high' ? 2.2 : 1.4;
    }

    // ---------- 公用的量和贴图 ----------
    const C = h => new T3.Color(h);
    const U = {
      uTime: { value: 0 }, uPlayer: { value: new T3.Vector3(-99, 0, -99) }, uFollow: { value: new T3.Vector3(-99, 0, -99) },
      uHole: { value: new T3.Vector4(0, 0, 1, -1) }, uHoleY: { value: 0 },
      uFogA: { value: C('#bcd6ee') }, uHaze: { value: C('#f6ead6') }, uFogP: { value: new T3.Vector3(16, .017, Q.far) },
    };
    // 明暗三档：背光 0、半亮、亮面 1，档和档之间只留很窄的一点过渡（像手绘的色块边）
    const rampTex = (() => {
      const n = 64, d = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = (i + .5) / n * 2 - 1; d[i] = Math.round(255 * (.56 * sstep(-.03, .05, x) + .44 * sstep(.44, .53, x))); }
      const t = new T3.DataTexture(d, n, 1, T3.RedFormat); t.minFilter = t.magFilter = T3.LinearFilter; t.needsUpdate = true;
      return t;
    })();
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
    const keep = [rampTex, noiseTex];   // 一直留着的贴图 / 几何体 / 材质，destroy 时才放
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

    // ---------- 材质：在 three 的卡通材质上加几样东西 ----------
    // o.wind 随风摆（树）；o.grass 草叶（成片的起伏、阵风、被主角踩开）；o.occ 挡住主角时开圆窗（见上面的 HOLE）；o.fade 用网点淡出去（房子：uFade 淡掉多少，uFadeY 这个高度以下的墙基留着）；
    // o.flag 后期描边认不认它（写在 alpha 里：1 描、0 不描）；o.terrain 地面（按遮罩图分草 / 路 / 沙）；o.sprite 纸片人（不会被照得太暗太亮）
    function paint(mat, o) {
      mat.userData.o = o;
      mat.onBeforeCompile = sh => {
        const u = sh.uniforms;
        u.uTime = U.uTime; u.uPlayer = U.uPlayer; u.uFollow = U.uFollow; u.uHole = U.uHole; u.uHoleY = U.uHoleY; u.uFogA = U.uFogA; u.uHaze = U.uHaze; u.uFogP = U.uFogP;
        if (mat.userData.u) Object.assign(u, mat.userData.u);
        const v = ['#include <begin_vertex>', 'vec3 oW = vec3(0.0); vGust = 0.0;',
          '#ifdef USE_INSTANCING', 'vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float isc = length(instanceMatrix[1].xyz);', '#else', 'vec3 ip = vec3(0.0); float isc = 1.0;', '#endif'];
        if (o.wind) v.push(
          'float wy = max(0.0, transformed.y) * isc; float gu = gustAt(ip.xz); float ph = ip.x * 0.8 + ip.z * 0.6;',
          'oW.x += (sin(uTime * 1.5 + ph) * ' + o.wind.toFixed(4) + ' + gu * ' + (o.wind * 2.6).toFixed(4) + ' * (1.0 + 0.3 * sin(uTime * 4.3 + ph))) * wy;',
          'oW.z += (cos(uTime * 1.1 + ph * 0.7) * ' + (o.wind * .5).toFixed(4) + ' + gu * ' + (o.wind * 1.4).toFixed(4) + ') * wy;');
        if (o.grass) v.push(
          'float hh = max(0.0, transformed.y); float w2 = hh * hh * isc;',
          'float wv = sin(dot(ip.xz, vec2(0.42, 0.31)) - uTime * 1.05) * 0.5 + sin(dot(ip.xz, vec2(-0.23, 0.55)) - uTime * 0.72 + 1.7) * 0.5;',
          'float gu = gustAt(ip.xz); float fl = sin(uTime * 5.3 + ip.x * 3.1 + ip.z * 2.3);',
          'float bend = 0.22 + 0.30 * wv + gu * (1.25 + 0.3 * fl);',
          'oW.x += bend * w2 * 0.86; oW.z += bend * w2 * 0.5; oW.y -= abs(bend) * w2 * 0.28;',
          'vGust = (gu * 0.85 + wv * 0.22) * hh;',
          // 主角和怪兽走过，脚边的草往两边倒
          'vec2 dp = ip.xz - uPlayer.xz; float pd = length(dp); float pu = (1.0 - smoothstep(0.12, 0.7, pd)) * hh; oW.xz += dp / max(pd, 0.05) * pu * 0.3; oW.y -= pu * 0.16;',
          'dp = ip.xz - uFollow.xz; pd = length(dp); pu = (1.0 - smoothstep(0.12, 0.6, pd)) * hh; oW.xz += dp / max(pd, 0.05) * pu * 0.24; oW.y -= pu * 0.12;');
        sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer; uniform vec3 uFollow; varying float vGust; varying float vDep; varying vec3 vWp;\n' + GUST +
          sh.vertexShader.replace('#include <begin_vertex>', v.join('\n'))
            .replace('#include <project_vertex>', ['vec4 mvPosition = vec4(transformed, 1.0);', '#ifdef USE_INSTANCING', 'mvPosition = instanceMatrix * mvPosition;', '#endif',
              'mvPosition = modelMatrix * mvPosition; mvPosition.xyz += oW; vWp = mvPosition.xyz;', 'mvPosition = viewMatrix * mvPosition; vDep = -mvPosition.z;', 'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
        let f = 'uniform float uTime; varying float vGust; varying float vDep; varying vec3 vWp;\n' + FOG_PARS + BAYER + HOLE + (o.terrain ? TERRAIN_PARS : '') + sh.fragmentShader;
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
        if (o.grass) f = f.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 1.0 + vGust * 0.5; diffuseColor.rgb += vec3(0.07, 0.07, 0.0) * max(vGust, 0.0);');
        if (o.sprite) f = f.replace('#include <opaque_fragment>', 'outgoingLight = clamp(outgoingLight, diffuseColor.rgb * 0.66, diffuseColor.rgb * 1.06);\n#include <opaque_fragment>');
        f = f.replace('#include <fog_fragment>', 'gl_FragColor.rgb = airFog(gl_FragColor.rgb, vDep);')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = ' + (o.flag === 0 && Q.post ? '0.0' : '1.0') + ';');   // 直接画到屏幕上（省电档）时 alpha 必须是 1，不然画布会透出网页的底色
        sh.fragmentShader = f;
      };
      mat.customProgramCacheKey = () => 'open:' + o.key;
      return mat;
    }
    const toon = (opts, o) => { const m = paint(new T3.MeshToonMaterial(Object.assign({ gradientMap: rampTex, vertexColors: true }, opts || {})), o); keep.push(m); return m; };

    // 地面：遮罩图的红 = 小路，绿 = 沙地和水底，蓝 = 草丛；顶点颜色的红 = 山上的林地，绿 = 靠水的湿沙，蓝 = 地图外面有多远
    const TERRAIN_PARS = 'uniform sampler2D uMask; uniform sampler2D uNoise; uniform vec4 uMapO; uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uTall; uniform vec3 uForest; uniform vec3 uSand; uniform vec3 uSandWet; uniform vec3 uPath; uniform vec3 uPathRim;\n';
    const TERRAIN_COLOR = [
      '{ vec2 muv = (vWp.xz - uMapO.xy) * uMapO.zw;',
      '  vec4 nz = texture2D(uNoise, vWp.xz * 0.041); vec4 nd = texture2D(uNoise, vWp.xz * 0.33);',
      '  vec3 mk = texture2D(uMask, muv + (nd.rg - 0.5) * uMapO.zw * 0.34).rgb;',
      '  float outK = 1.0 - smoothstep(0.35, 0.95, vColor.b);',
      '  float pth = smoothstep(0.42, 0.52, mk.r + (nd.b - 0.5) * 0.14) * outK;',
      '  float snd = smoothstep(0.40, 0.54, mk.g + (nd.b - 0.5) * 0.16);',
      '  float tal = smoothstep(0.34, 0.56, mk.b + (nd.g - 0.5) * 0.2);',
      // 草地：三种绿，一大块一大块地换，块和块之间柔和过渡；再点一些深一点的小笔触
      '  vec3 gr = mix(uG0, uG1, smoothstep(0.42, 0.54, nz.r)); gr = mix(gr, uG2, smoothstep(0.54, 0.64, nz.g) * 0.85);',
      '  gr *= 1.0 - 0.07 * smoothstep(0.58, 0.66, nd.r) + 0.05 * smoothstep(0.62, 0.7, nd.a);',
      '  gr = mix(gr, uTall, tal * 0.9);',
      '  gr = mix(gr, uForest, vColor.r);',
      '  vec3 sd = mix(uSand, uSandWet, vColor.g); sd *= 1.0 - 0.04 * smoothstep(0.55, 0.7, nd.g);',
      // 小路：中间浅、边上一圈深一点（像用笔勾过），零星几颗小石子
      '  vec3 pc = mix(uPathRim, uPath, smoothstep(0.50, 0.74, mk.r + (nd.b - 0.5) * 0.14)); pc *= 1.0 - 0.07 * smoothstep(0.74, 0.8, nd.g) * step(0.5, nz.b);',
      '  vec3 col = mix(gr, sd, snd); col = mix(col, mix(pc, sd * 1.04, snd * 0.75), pth);',
      '  diffuseColor.rgb = col; }',
    ].join('\n');

    const terrainMat = (() => {
      const mt = new T3.MeshToonMaterial({ gradientMap: rampTex, vertexColors: true });
      mt.userData.u = { uMask: { value: null }, uNoise: { value: noiseTex }, uMapO: { value: new T3.Vector4(0, 0, 1, 1) } };
      ['uG0', 'uG1', 'uG2', 'uTall', 'uForest', 'uSand', 'uSandWet', 'uPath', 'uPathRim'].forEach(k => { mt.userData.u[k] = { value: C('#ffffff') }; });
      keep.push(mt);
      return paint(mt, { key: 'terrain', terrain: true });
    })();
    const solidMat = toon({ shadowSide: T3.DoubleSide }, { key: 'solid', occ: true });                 // 拼在一起的静物（石坎、栅栏、告示牌、码头……）
    const propMat = toon({}, { key: 'prop' });                                // 会动 / 会消失的小物件（障碍、机关门、小船）
    const grassMat = toon({ side: T3.DoubleSide }, { key: 'grass', grass: true, flag: 0 });
    const flowerMat = toon({ side: T3.DoubleSide }, { key: 'flower', wind: .05, flag: 0 });
    const treeMats = {};
    // 树的材质：dbl 两面都画（棕榈叶是一片片薄片）
    const treeMat = dbl => treeMats[dbl ? 'd' : 's'] || (treeMats[dbl ? 'd' : 's'] = toon({ side: dbl ? T3.DoubleSide : T3.FrontSide }, { key: 'tree', wind: .022, occ: true }));

    // ---------- 每张地图的内容 ----------
    let world = null, m = null, own = [], THEME = {}, PAL = {}, LAND = null;
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
    //   · 走不了的边界树（# 和成片的 T）离能走的地方越远越高，连到地图外面一圈小山；出口外面留一条山谷；靠海的那几边外面就是海
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
    function hillH(d, x, z) {
      if (d <= .55) return 0;
      const n1 = fbm(x * .21 + 7, z * .21 + 3), n2 = fbm(x * .075 + 40, z * .075 + 9), n3 = fbm(x * .033 + 5, z * .033 + 77);
      return sstep(.55, 3.4, d) * (.3 + .45 * n1) + sstep(2.4, 11, d) * (.5 + 1.7 * n2) + sstep(9, 24, d) * (4.2 * n3 * n3 * n3 + .2);
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
      // 台阶那条线（L 格偏南一点）两边不互相插值：线北边用上面的高度、南边用下面的
      const levAt = (px, pz) => {
        if (!step) return 0;
        const gx = clamp(px - .5, 0, W - 1), gz = clamp(pz - .5, 0, H - 1), x0 = Math.min(W - 2, Math.floor(gx)), z0 = Math.min(H - 2, Math.floor(gz)), fx = gx - x0, fz = gz - z0;
        const col = xc => (m.grid[z0][xc] === 'L' && m.grid[z0 + 1][xc] !== 'L' ? (pz < z0 + CUT ? lev[z0 * W + xc] : lev[(z0 + 1) * W + xc]) : lerp(lev[z0 * W + xc], lev[(z0 + 1) * W + xc], fz));
        return lerp(col(x0), col(x0 + 1), fx);
      };
      // ---- 细网格上每个点的高度 ----
      const X0 = -MG, Z0 = -MG, X1 = W + MG, Z1 = H + MG;
      const hgt = new Float32Array(nx * nz), sd = new Float32Array(nx * nz), shoreH = new Float32Array(nx * nz);
      // 离岸多远：先把直角抹圆（糊两遍），再按噪声里外挪一点，岸线就不是沿着格子的直线了
      for (let k = 0; k < nx * nz; k++) sd[k] = F.dWat[k] - F.dLand[k];
      for (let pass = 0; pass < 2; pass++) {
        const src = new Float32Array(sd);
        for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) { const k = j * nx + i; sd[k] = (src[k] * 4 + (src[k - 1] + src[k + 1] + src[k - nx] + src[k + nx]) * 2 + src[k - nx - 1] + src[k - nx + 1] + src[k + nx - 1] + src[k + nx + 1]) / 16; }
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = X0 + i / S, z = Z0 + j / S; if (Math.abs(sd[k]) < 1.2) sd[k] -= (fbm(x * .9 + 3, z * .9 + 7) - .5) * .3 * (1 - Math.abs(sd[k]) / 1.2) + .06; }
      const southK = z => 1 - .72 * sstep(H - 2.5, H + 4, z);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = X0 + i / S, z = Z0 + j / S, s = sd[k], base = levAt(x, z), sandK = 1 - sstep(0, .6, F.dSand[k]);
        const edge = lerp(.12, .3, sandK);
        shoreH[k] = base - edge;
        if (s >= 0) hgt[k] = base + hillH(F.dWalk[k], x, z) * southK(z) * sstep(.1, 1.6, s) - lerp(.12 * (1 - sstep(0, .4, s)), .3 * (1 - sstep(0, 2.4, s)), sandK);
        else hgt[k] = base - edge - (.1 + .7 * sstep(0, 1.2, -s));
      }
      // ---- 水：连在一起的算一片，水面比这一片最低的岸再低一点 ----
      const body = new Int16Array(W * H).fill(-1), wlev = [];
      let SEA = 1e9;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!(cls[y * W + x] & 1) || body[y * W + x] >= 0) continue;
        const id = wlev.length, q = [[x, y]]; let lo = 1e9, sea = false;
        body[y * W + x] = id;
        while (q.length) {
          const [cx, cy] = q.pop();
          if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) sea = true;
          for (let jj = (cy + MG) * S; jj <= (cy + MG + 1) * S; jj++) for (let ii = (cx + MG) * S; ii <= (cx + MG + 1) * S; ii++) if (F.dLand[jj * nx + ii] < .01) lo = Math.min(lo, shoreH[jj * nx + ii]);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const qx = cx + dx, qy = cy + dy; if (qx >= 0 && qy >= 0 && qx < W && qy < H && (cls[qy * W + qx] & 1) && body[qy * W + qx] < 0) { body[qy * W + qx] = id; q.push([qx, qy]); } });
        }
        if (lo > 1e8) lo = 0;
        wlev.push(lo - .07);
        if (sea) SEA = Math.min(SEA, lo - .07);
      }
      if (SEA > 1e8) SEA = -.5;
      const waterLevel = (x, y) => { const b = body[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)]; return b < 0 ? SEA : wlev[b]; };
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
      // 地图外面：山、山谷（出口外面）、海；再往外整座岛落回海里
      const R1 = Q.skirt * .5, R2 = Q.skirt * .82;
      const outer = (x, z, o) => {
        const cx = clamp(x, X0, X1), cz = clamp(z, Z0, Z1), dOut = Math.hypot(x - cx, z - cz);
        const n = fbm(x * .05 + 31, z * .05 + 17), corr = 1 - sstep(.3, 2.8, samp(F.dExit, cx, cz));
        const landK = sstep(-.5, 1.3, samp(sd, cx, cz) + (n - .5) * 2.4 * Math.min(1, dOut / 3));
        const dw = samp(F.dWalk, cx, cz) + dOut * (1 - .86 * corr * (1 - sstep(8, 20, dOut)));
        const fall = sstep(R1, R2, dOut + (n - .5) * 12);
        const land = lerp(levAt(cx, cz) + hillH(dw, x, z) * southK(z), SEA - 1.3, fall);
        if (o) { o.landK = landK * (1 - fall); o.dOut = dOut; o.corr = corr; o.dw = dw; }
        return lerp(SEA - .6 - .7 * sstep(0, 5, dOut), land, landK);
      };
      const inFine = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
      LAND = {
        W, H, S, nx, nz, X0, Z0, X1, Z1, F, sd, hgt, srf, cls, SEA, step, samp, outer, levAt, isWater, isPier, waterLevel,
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
          col[k] = o.landK * sstep(.7, 2.6, o.dw); col[k + 1] = 1 - o.landK; col[k + 2] = Math.min(1, o.dOut / 16);
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
      u.uMapO.value.set(-MG, -MG, 1 / tw, 1 / th);
      u.uG0.value.set(P.grass); u.uG1.value.copy(mixC(P.grass, '#f4f08c', P.snow ? .04 : .3)); u.uG2.value.copy(mixC(A.shade(P.grass, .86), '#27a082', P.snow ? .03 : .2));
      u.uTall.value.copy(mixC(A.shade(P.tall, .92), P.grass, .12)); u.uForest.value.copy(mixC(A.shade(P.tree, .82), P.grass, .28));
      u.uSand.value.set(P.sand); u.uSandWet.value.copy(mixC(A.shade(P.sand, .84), '#b9a37a', .25));
      u.uPath.value.set(P.path); u.uPathRim.value.copy(mixC(A.shade(P.path, .8), '#b08a5a', .2));
      const ms = new T3.Mesh(g, terrainMat);
      ms.frustumCulled = false;
      still(add(ms, false));
    }

    // ---------- 水：青绿色，岸边一圈浪花，水面上游动的亮点；远处连到地平线 ----------
    const waterMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uNoise: { value: noiseTex }, uFogA: U.uFogA, uHaze: U.uHaze, uFogP: U.uFogP, uShallow: { value: C('#8ff0dc') }, uMid: { value: C('#33c6cf') }, uDeep: { value: C('#1d8fd0') }, uSky: { value: C('#bfe4f6') } },
      vertexShader: 'attribute float aShore; varying float vS; varying vec3 vW; varying float vDep; void main(){ vS = aShore; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDep = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: [
        'uniform float uTime; uniform sampler2D uNoise; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform vec3 uSky; varying float vS; varying vec3 vW; varying float vDep;', FOG_PARS,
        'void main(){',
        '  vec2 p = vW.xz; float t = uTime;',
        '  float n1 = texture2D(uNoise, p * 0.06 + vec2(t * 0.012, t * 0.008)).g; float n2 = texture2D(uNoise, p * 0.17 - vec2(t * 0.02, -t * 0.015)).r;',
        '  float d = vS + (n2 - 0.5) * 0.22;',
        '  vec3 c = mix(uShallow, uMid, smoothstep(0.05, 0.95, d)); c = mix(c, uDeep, smoothstep(0.9, 3.4, d));',
        // 水面上一道道浅色的波纹（两层噪声错着走，取细细的一圈）
        '  float w = abs(fract(n1 * 3.0 + n2 * 1.3 + t * 0.04) - 0.5); c += vec3(0.10, 0.13, 0.12) * (1.0 - smoothstep(0.0, 0.035, w)) * smoothstep(0.25, 1.2, d);',
        // 岸边的浪花：贴着岸一圈白，外面还有一圈时隐时现、往岸上推的白线
        '  float e1 = 1.0 - smoothstep(0.10, 0.17, d + sin(t * 1.4 + p.x * 1.9 + p.y * 1.3) * 0.03);',
        '  float ph = fract(t * 0.16 + n1 * 0.6); float e2 = (1.0 - smoothstep(0.0, 0.045, abs(d - (0.62 - ph * 0.5)))) * (1.0 - ph) * step(0.0, d);',
        '  float foam = clamp(e1 + e2 * 0.75, 0.0, 1.0);',
        // 亮点：两层噪声都高的地方闪一下，位置慢慢漂
        '  float s1 = texture2D(uNoise, p * 1.05 + vec2(t * 0.06, t * 0.04)).g; float s2 = texture2D(uNoise, p * 1.37 - vec2(t * 0.05, t * 0.07)).g;',
        '  float sp = smoothstep(0.71, 0.75, min(s1, s2)) * smoothstep(0.3, 1.0, d) * smoothstep(0.4, 0.62, n1);',
        // 越远看到的越是天的颜色
        '  vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);',
        '  c = mix(c, uSky, fr * 0.62);',
        '  c = mix(c, vec3(1.0), foam * 0.92) + sp * 0.8;',
        '  float a = mix(0.58, 0.93, smoothstep(0.0, 1.3, d)); a = max(a, foam); a = max(a, fr);',
        '  gl_FragColor = vec4(airFog(c, vDep), a);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
      transparent: true, depthWrite: false,
    });
    keep.push(waterMat);
    function buildWater() {
      const L = LAND, S = L.S, pos = [], sh = [], idx = [];
      // 地图里（外加两格）的水：照着细网格铺，每个点带着「离岸多远」
      for (let ty = 0; ty < m.H + MG * 2; ty++) for (let tx = 0; tx < m.W + MG * 2; tx++) {
        const x = tx - MG, y = ty - MG;
        if (!L.isWater(x, y)) continue;
        const lv = L.waterLevel(x, y), b = pos.length / 3;
        for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) { const q = (ty * S + j) * L.nx + tx * S + i; pos.push(x + i / S, lv, y + j / S); sh.push(Math.max(0, -L.sd[q])); }
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = b + j * (S + 1) + i, c = a + S + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
      }
      // 外面的海：四大块，一直铺到最远
      const far = Q.far * 1.6, X0 = L.X0, X1 = L.X1, Z0 = L.Z0, Z1 = L.Z1;
      [[X0 - far, Z0 - far, X1 + far, Z0], [X0 - far, Z1, X1 + far, Z1 + far], [X0 - far, Z0, X0, Z1], [X1, Z0, X1 + far, Z1]].forEach(([ax, az, bx, bz]) => {
        const b = pos.length / 3;
        pos.push(ax, L.SEA, az, bx, L.SEA, az, ax, L.SEA, bz, bx, L.SEA, bz); sh.push(6, 6, 6, 6);
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      });
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('aShore', new T3.Float32BufferAttribute(sh, 1));
      g.setIndex(idx);
      own.push(g);
      const ms = new T3.Mesh(g, waterMat);
      ms.frustumCulled = false; ms.renderOrder = 2;
      still(add(ms, false, false));
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

    // ---------- 不会动的东西拼成一个网格：台阶的石坎、岩壁、栅栏、告示牌、码头、楼梯、小石头、地标 ----------
    let boatG = null;
    function buildStatics() {
      const L = LAND, S = L.S, bag = Bag(), P = PAL, W = m.W, H = m.H;
      const rock = P.rock || '#a39b8b', earth = mixC(rock, '#8f6b47', .42).getStyle(), rLo = mixC(A.shade(rock, .62), '#6b4a30', .4), rMid = C(earth), rHi = mixC(A.shade(rock, 1.04), '#b98f63', .3), lipC = mixC(A.shade(P.grass, .84), P.tall, .25);
      // 台阶：细网格上「线北边」和「线南边」两排点之间差多少，石坎就多高（到缺口那里自己收成 0）
      for (let y = 0; y < H - 1; y++) {
        if (!m.grid[y].includes('L')) continue;
        if (!L.step) {   // 高度没用上（数据对不上）：只画一道矮坎
          for (let x = 0; x < W; x++) if (m.grid[y][x] === 'L') box(bag, 1.01, .2, .3, topSide(A.shade(P.grass, .95), A.shade(rock, .85)), x + .5, 0, y + .8);
          continue;
        }
        const jn = (y + MG) * S + Math.floor(CUT * S), js = jn + 1, zN = L.Z0 + jn / S, zS = L.Z0 + js / S;
        for (let i = 0; i < L.nx - 1; i++) {
          const ta = L.hgt[jn * L.nx + i], tb = L.hgt[jn * L.nx + i + 1], ba = L.hgt[js * L.nx + i] - .04, bb = L.hgt[js * L.nx + i + 1] - .04;
          if (ta - ba < .1 && tb - bb < .1) continue;
          const xa = L.X0 + i / S, xb = xa + 1 / S, ja = (rnd(i, y, 31) - .5) * .05, jb = (rnd(i + 1, y, 31) - .5) * .05;
          const ma = lerp(ba, ta, .45), mb = lerp(bb, tb, .45), z0 = zS + .05, z1 = zS + .01;
          quad(bag, [xa, ba, z0 + ja], [xb, bb, z0 + jb], [xb, mb, z1 + jb], [xa, ma, z1 + ja], rLo, rLo, rMid, rMid);
          quad(bag, [xa, ma, z1 + ja], [xb, mb, z1 + jb], [xb, tb + .015, z1], [xa, ta + .015, z1], rMid, rMid, rHi, rHi);
          quad(bag, [xa, ta + .015, zN - .02], [xa, ta + .015, z1 + .03], [xb, tb + .015, z1 + .03], [xb, tb + .015, zN - .02], lipC);
        }
      }
      const isCliff = (x, y) => { const c = tIn(x, y); return c === 'R' || c === 'X' || c === 'K'; };
      const cornerH = (ix, iz) => 1.7 + .75 * rnd(ix, iz, 21) + ([[0, 0], [-1, 0], [0, -1], [-1, -1]].every(([dx, dy]) => isCliff(ix + dx, iz + dy)) ? .55 : 0);
      const capC = mixC(A.shade(P.grass, .9), rock, .25), darkC = C('#17100c');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x], cx = x + .5, cz = y + .5;
        if (isCliff(x, y)) {
          // 岩壁：一格一根石柱，挨着的拼成一整面；侧面分上下两层颜色，底下往外鼓一点，顶上是草
          const y0 = L.ground(cx, cz) - .05, cr = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([ix, iz]) => {
            occH[y * W + x] = y0 + 2.3;
            const inner = [[0, 0], [-1, 0], [0, -1], [-1, -1]].every(([dx, dy]) => isCliff(ix + dx, iz + dy));
            return { x: ix + (inner ? 0 : (rnd(ix, iz, 22) - .5) * .14), z: iz + (inner ? 0 : (rnd(iz, ix, 23) - .5) * .14), h: y0 + cornerH(ix, iz) };
          });
          quad(bag, [cr[0].x, cr[0].h, cr[0].z], [cr[3].x, cr[3].h, cr[3].z], [cr[2].x, cr[2].h, cr[2].z], [cr[1].x, cr[1].h, cr[1].z], c === 'X' ? rMid : capC);
          [[3, 2, 0, 1], [1, 0, 0, -1], [2, 1, 1, 0], [0, 3, -1, 0]].forEach(([a, b, dx, dz]) => {
            if (isCliff(x + dx, y + dz)) return;
            const pa = cr[a], pb = cr[b], ox = dx * .09, oz = dz * .09;
            const ma = [pa.x + ox * .3, lerp(y0, pa.h, .5), pa.z + oz * .3], mb = [pb.x + ox * .3, lerp(y0, pb.h, .5), pb.z + oz * .3];
            quad(bag, [pa.x + ox, y0, pa.z + oz], [pb.x + ox, y0, pb.z + oz], mb, ma, rLo, rLo, rMid, rMid);
            quad(bag, ma, mb, [pb.x, pb.h, pb.z], [pa.x, pa.h, pa.z], rMid, rMid, rHi, rHi);
          });
          if (c === 'K') {   // 洞口：南面一个黑色的拱门
            const zf = y + 1.1, n = 8;
            for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n; tri(bag, [cx, y0, zf], [cx + Math.cos(a0) * .36, y0 + .05 + Math.sin(a0) * .86, zf], [cx + Math.cos(a1) * .36, y0 + .05 + Math.sin(a1) * .86, zf], darkC); }
          }
        } else if (c === 'f') {
          const y0 = L.ground(cx, cz), fc = m.theme === 'city' ? '#aab8c2' : m.theme === 'farm' || m.theme === 'hello' ? '#fffdf5' : '#d6a56e';
          box(bag, .11, .58, .11, byY(A.shade(fc, .8), fc, 0, .5), cx, y0 - .04, cz);
          const e = tIn(x + 1, y) === 'f', s = tIn(x, y + 1) === 'f', w = tIn(x - 1, y) === 'f', n = tIn(x, y - 1) === 'f';
          [.2, .4].forEach(h => {
            if (e) box(bag, 1.0, .07, .06, fc, cx + .5, (y0 + L.ground(cx + 1, cz)) / 2 + h, cz);
            if (s) box(bag, .06, .07, 1.0, fc, cx, (y0 + L.ground(cx, cz + 1)) / 2 + h, cz + .5);
            if (!e && !w && !s && !n) box(bag, .9, .07, .06, fc, cx, y0 + h, cz);
          });
        } else if (c === 'B') {
          const y0 = L.ground(cx, cz + .05) - .03, z = cz + .05;
          box(bag, .07, .52, .07, '#8a5a33', cx - .22, y0, z); box(bag, .07, .52, .07, '#8a5a33', cx + .22, y0, z);
          box(bag, .78, .44, .07, byY('#c79658', '#e2b678', 0, .44), cx, y0 + .42, z);
          [[.72, .5], [.62, .36], [.52, .44]].forEach(([h, w]) => box(bag, w, .045, .02, '#7a4e2a', cx - (.5 - w) / 2, y0 + h, z + .04));
        } else if (c === '%') {
          const y0 = L.ground(cx, cz), sc = P.rock || '#9e9e9e';
          for (let k = 0; k < 3; k++) box(bag, .9, .1 + k * .12, .3, topSide(A.shade(sc, 1.12), A.shade(sc, .85)), cx, y0, y + .85 - k * .3);
        } else if (c === 'r') {
          const y0 = L.ground(cx, cz), r = rnd(x, y, 5), col = leafC(A.shade(rock, .72), A.shade(rock, .96), A.shade(rock, 1.12));
          put(bag, new T3.SphereGeometry(.3 + r * .08, 7, 5).scale(1.1, .78, .95).rotateY(r * 6), col, cx - .06, y0 + .16, cz + .04);
          put(bag, new T3.SphereGeometry(.17, 6, 4).scale(1, .8, 1), col, cx + .26, y0 + .08, cz + .16);
        } else if (c === 'I') {
          quad(bag, [x, L.ground(cx, cz) + .02, y], [x, L.ground(cx, cz) + .02, y + 1], [x + 1, L.ground(cx, cz) + .02, y + 1], [x + 1, L.ground(cx, cz) + .02, y], C('#dff3fb'));
        }
        if (L.cls[y * W + x] === 3) {
          // 码头：一块块木板、两边的边梁、角上扎进水里的木桩
          const dy = L.at(cx, cz), wet = (dx, dz) => L.isWater(x + dx, y + dz) && !L.isPier(x + dx, y + dz), pier = (dx, dz) => L.isPier(x + dx, y + dz);
          const ns = pier(0, -1) || pier(0, 1) || (!pier(-1, 0) && !pier(1, 0));   // 这一格的木板是顺着南北走的路横着铺
          for (let k = 0; k < 4; k++) {
            const tone = (k + x + y) % 2 ? '#c99b62' : '#b98950';
            if (ns) box(bag, 1.0, .07, .232, tone, cx, dy - .07, y + .125 + k * .25); else box(bag, .232, .07, 1.0, tone, x + .125 + k * .25, dy - .07, cz);
          }
          [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dz]) => {
            if (wet(dx, dz)) box(bag, dx ? .07 : 1.06, .1, dx ? 1.06 : .07, '#8a6238', cx + dx * .5, dy - .09, cz + dz * .5);
            else if (!pier(dx, dz)) box(bag, dx ? .34 : 1.0, .06, dx ? 1.0 : .34, '#b98950', cx + dx * .62, dy - .075, cz + dz * .62);   // 接岸的那一头多伸出一截
          });
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => { if (wet(dx, 0) && (wet(0, dz) || !pier(0, dz))) put(bag, new T3.CylinderGeometry(.065, .075, 1.5, 6), byY('#5d4024', '#8a6238', -.5, .7), cx + dx * .5, dy - .58, cz + dz * .46); });
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
        else markInto(bag, kind, x + .5, L.ground(x + .5, y + .5), y + .55);
      }
      if (!bag.p.length) return;
      const g = bake(bag);
      own.push(g);
      still(add(new T3.Mesh(g, solidMat), true));
    }
    const MARK_OF = { hello: 'anchor', crayon: 'crayon', farm: 'scarecrow', school: 'bell', lab: 'telescope', circus: 'balloon', clock: 'clock', party: 'gift', jungle: 'totem', city: 'light', sports: 'trophy', snow: 'snowman', ruins: 'stone' };
    function markInto(bag, kind, x, y, z) {
      const part = (g, col, px, py, pz) => put(bag, g, col, x + (px || 0), y + (py || 0), z + (pz || 0));
      const pb = (w, h, d, col, px, py, pz) => box(bag, w, h, d, col, x + (px || 0), y + (py || 0), z + (pz || 0));
      const base = () => pb(.74, .22, .74, topSide('#dfe6ea', '#b4c0c8'));
      switch (kind) {
        case 'anchor': base(); part(new T3.TorusGeometry(.25, .06, 6, 14, Math.PI).rotateZ(Math.PI), '#546e7a', 0, .58); part(new T3.CylinderGeometry(.05, .05, .7, 6), '#546e7a', 0, .63); part(new T3.TorusGeometry(.1, .04, 6, 12), '#546e7a', 0, 1.03); break;
        case 'crayon': part(new T3.CylinderGeometry(.22, .22, 1.1, 8).translate(0, .55, 0), ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'][Math.floor(rnd(Math.floor(x), Math.floor(z), 2) * 4)]); part(new T3.ConeGeometry(.22, .35, 8).translate(0, 1.27, 0), '#f5d7a1'); break;
        case 'scarecrow': part(new T3.CylinderGeometry(.04, .04, 1.3, 5).translate(0, .65, 0), '#8a5a33'); pb(.8, .06, .06, '#8a5a33', 0, .95); part(new T3.SphereGeometry(.17, 8, 6), '#f5d7a1', 0, 1.3); part(new T3.ConeGeometry(.25, .22, 8), '#e8c35a', 0, 1.48); pb(.4, .4, .2, '#e57373', 0, .52); break;
        case 'bell': pb(.08, 1.2, .08, '#6d4c41', -.3); pb(.08, 1.2, .08, '#6d4c41', .3); pb(.7, .08, .1, '#6d4c41', 0, 1.2); part(new T3.ConeGeometry(.2, .3, 12).translate(0, -.15, 0), '#ffca28', 0, 1.18); break;
        case 'telescope': part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(.25), '#546e7a', .1); part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(-.25), '#546e7a', -.1); part(new T3.CylinderGeometry(.09, .12, .8, 10).rotateZ(-.9), '#eceff1', .05, .9); break;
        case 'balloon': [['#e53935', -.2, 1.1], ['#fdd835', .15, 1.25], ['#1e88e5', .02, .95]].forEach(([c, px, py]) => { part(new T3.SphereGeometry(.17, 10, 8).scale(1, 1.2, 1), c, px, py); part(new T3.CylinderGeometry(.008, .008, py, 3).translate(0, py / 2, 0), '#555555', px * .3, 0); }); pb(.2, .12, .2, '#8d6e63'); break;
        case 'clock': part(new T3.CylinderGeometry(.06, .08, 1.3, 8).translate(0, .65, 0), '#37474f'); part(new T3.CylinderGeometry(.3, .3, .1, 20).rotateX(Math.PI / 2), '#fffdf5', 0, 1.45); part(new T3.TorusGeometry(.3, .045, 6, 20), '#b8862b', 0, 1.45); pb(.03, .2, .02, '#37474f', 0, 1.45, .06); pb(.14, .03, .02, '#37474f', .06, 1.44, .06); break;
        case 'gift': pb(.7, .6, .7, '#ff80ab'); pb(.72, .1, .15, '#ffd54f', 0, .25); pb(.15, .62, .72, '#ffd54f'); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', -.1, .68); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', .1, .68); break;
        case 'totem': [['#8d6e63', .0], ['#e53935', .42], ['#1e88e5', .84]].forEach(([c, py]) => { pb(.44, .4, .44, c, 0, py); pb(.46, .06, .1, '#ffffff', 0, py + .24, .2); }); pb(.9, .08, .2, '#43a047', 0, 1.2); break;
        case 'light': part(new T3.CylinderGeometry(.04, .05, 1.2, 6).translate(0, .6, 0), '#455a64'); pb(.24, .6, .2, '#263238', 0, 1.1); [['#e53935', 1.58], ['#fdd835', 1.4], ['#43a047', 1.22]].forEach(([c, py]) => part(new T3.SphereGeometry(.06, 8, 6), c, 0, py, .1)); break;
        case 'trophy': base(); part(new T3.CylinderGeometry(.08, .12, .3, 10).translate(0, .15, 0), '#ffca28', 0, .22); part(new T3.CylinderGeometry(.26, .1, .38, 14).translate(0, .19, 0), '#ffca28', 0, .52); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', .28, .75); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', -.28, .75); break;
        case 'snowman': part(new T3.SphereGeometry(.32, 12, 10), '#ffffff', 0, .3); part(new T3.SphereGeometry(.23, 12, 10), '#ffffff', 0, .78); part(new T3.ConeGeometry(.04, .2, 6).rotateX(Math.PI / 2), '#ff7043', 0, .8, .26); part(new T3.CylinderGeometry(.16, .16, .22, 10), '#37474f', 0, 1.08); part(new T3.TorusGeometry(.2, .05, 6, 14).rotateX(Math.PI / 2), '#e53935', 0, .6); break;
        case 'stone': pb(.5, 1.5, .3, topSide('#b3ada2', '#8f8a80')); pb(.2, .6, .02, '#6d8b5a', .12, .5, .16); break;
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

    // ---------- 树：每座岛的树不一样。树冠是一团团颜色（上面的浅、下面的深），树干矮矮胖胖 ----------
    // lod 0：地图里的树（细）；1：地图边上和外面近处的（省）；2：远处山上的一团（最省）
    function treeKit(style, P, lod) {
      const bag = Bag(), dk = A.shade(P.tree, .68), md = P.tree, hi = P.treeHi, lf = leafC(dk, md, hi), lfHi = leafC(md, hi, A.shade(hi, 1.12));
      const blob = (r, x, y, z, sx, sy, col) => put(bag, lod ? new T3.SphereGeometry(r, 7, 4).scale(sx || 1, sy || .9, 1) : new T3.SphereGeometry(r, 8, 5).scale(sx || 1, sy || .9, 1), col || lf, x, y, z);
      const trunkC = style === 'dead' ? '#6b6258' : '#7a4a26', trunk = (r0, r1, h, col) => put(bag, new T3.CylinderGeometry(r1, r0, h, 5, 1, true).translate(0, h / 2, 0), byY(A.shade(col || trunkC, .72), col || trunkC, 0, h));
      let top = 1.9, dbl = false, tint = null;
      if (style === 'palm') {
        // 棕榈：弯弯的树干一节一节的，顶上一圈往下垂的大叶子，叶子中间一道浅色的叶脉
        const Ht = 2.15, lean = .34, segs = lod ? 3 : 4, sides = lod ? 4 : 5, tA = C('#b98a57'), tB = C('#9c7242'), pt = t => [lean * t * t, Ht * t];
        for (let k = 0; k < segs; k++) {
          const [xa, ya] = pt(k / segs), [xb, yb] = pt((k + 1) / segs), ra = .13 - .055 * k / segs, rb = .13 - .055 * (k + 1) / segs + .012;
          for (let q = 0; q < sides; q++) {
            const a0 = q / sides * 6.283, a1 = (q + 1) / sides * 6.283;
            quad(bag, [xa + Math.cos(a0) * ra, ya, Math.sin(a0) * ra], [xb + Math.cos(a0) * rb, yb, Math.sin(a0) * rb], [xb + Math.cos(a1) * rb, yb, Math.sin(a1) * rb], [xa + Math.cos(a1) * ra, ya, Math.sin(a1) * ra], k % 2 ? tA : tB);
          }
        }
        const nF = lod === 2 ? 5 : lod ? 6 : 7, fs = lod === 2 ? 2 : lod ? 2 : 4, cEdge = C(md), cRib = C(hi), cTip = mixC(hi, '#f3e37a', .35), cDk = C(dk);
        for (let k = 0; k < nF; k++) {
          const a = k / nF * 6.283 + .3, Lf = 1.12 + (k % 3) * .1, up = .32 + (k % 2) * .16, ca = Math.cos(a), sa = Math.sin(a);
          const at = s => { const r = Lf * s, yy = Ht + .04 + up * Math.sin(s * 2.6) - .78 * s * s; return [lean + ca * r, yy, sa * r]; };
          for (let q = 0; q < fs; q++) {
            const s0 = q / fs, s1 = (q + 1) / fs, p0 = at(s0), p1 = at(s1), w0 = .27 * Math.pow(Math.sin(Math.PI * (.1 + .9 * s0)), .7), w1 = q === fs - 1 ? 0 : .27 * Math.pow(Math.sin(Math.PI * (.1 + .9 * s1)), .7), dr = .11;
            const l0 = [p0[0] - sa * w0, p0[1] - dr * (w0 / .27), p0[2] + ca * w0], r0 = [p0[0] + sa * w0, p0[1] - dr * (w0 / .27), p0[2] - ca * w0], l1 = [p1[0] - sa * w1, p1[1] - dr * (w1 / .27), p1[2] + ca * w1], r1 = [p1[0] + sa * w1, p1[1] - dr * (w1 / .27), p1[2] - ca * w1];
            const c0 = s0 > .6 ? cTip : cRib, c1 = s1 > .6 ? cTip : cRib, e0 = k % 2 ? cEdge : cDk;
            quad(bag, p0, l0, l1, p1, c0, e0, e0, c1); quad(bag, p0, p1, r1, r0, c0, c1, e0, e0);
          }
        }
        if (!lod) [[.1, -.06, .1], [-.08, -.1, -.06]].forEach(([px, py, pz]) => put(bag, new T3.IcosahedronGeometry(.09, 0), '#6d4c2f', lean + px, Ht + py, pz));
        top = 2.5; dbl = true;
      } else if (style === 'pine' || style === 'snowpine') {
        const snow = style === 'snowpine';
        trunk(.12, .08, .5);
        [[.62, .7, .42], [.5, .62, .86], [.36, .56, 1.28]].forEach(([r, h, y], k) => {
          put(bag, new T3.ConeGeometry(r, h, lod ? 6 : 8).translate(0, y + h / 2, 0), byY(k ? md : dk, hi, y, y + h * 1.2));
          if (snow) put(bag, new T3.ConeGeometry(r * .66, h * .5, lod ? 6 : 8).translate(0, y + h * .76, 0), '#f6fbfd');
        });
        top = 2.0;
      } else if (style === 'cypress') {
        trunk(.1, .07, .4);
        blob(.34, 0, 1.15, 0, 1, 2.5); if (!lod) blob(.24, .06, 1.6, .08, 1, 1.9, lfHi);
        top = 2.1;
      } else if (style === 'pencil') {
        put(bag, new T3.CylinderGeometry(.22, .22, 1.25, 6).translate(0, .75, 0), '#ffffff');
        put(bag, new T3.ConeGeometry(.22, .36, 6).translate(0, 1.56, 0), '#f5d7a1'); put(bag, new T3.ConeGeometry(.08, .13, 6).translate(0, 1.7, 0), '#37474f'); put(bag, new T3.CylinderGeometry(.23, .23, .12, 6).translate(0, .07, 0), '#ef9a9a');
        tint = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da']; top = 1.8;
      } else if (style === 'lolli') {
        put(bag, new T3.CylinderGeometry(.045, .045, 1.0, 6).translate(0, .5, 0), '#fffdf5');
        put(bag, new T3.SphereGeometry(.42, 12, 8).scale(1, 1, .45).translate(0, 1.3, 0), '#ffffff'); put(bag, new T3.TorusGeometry(.26, .055, 6, 16).translate(0, 1.3, .18), '#fff3f8');
        tint = ['#ff80ab', '#ffd54f', '#80deea', '#b39ddb', '#a5d6a7', '#ffab91']; top = 1.8;
      } else if (style === 'jungle') {
        trunk(.17, .1, 1.2, '#5d4128');
        blob(.74, 0, 1.38, 0, 1.25, .52); blob(.5, -.5, 1.2, .1, 1.1, .5); blob(.5, .52, 1.24, -.08, 1.1, .5); blob(.48, -.08, 1.68, .04, 1.2, .5, lfHi); if (!lod) blob(.36, .12, 1.22, .5, 1, .5);
        top = 2.0;
      } else if (style === 'dead') {
        trunk(.13, .06, 1.2);
        put(bag, new T3.CylinderGeometry(.03, .05, .6, 4).rotateZ(-.9).translate(.24, 1.02, 0), trunkC); put(bag, new T3.CylinderGeometry(.03, .05, .5, 4).rotateZ(.8).translate(-.22, .92, .05), trunkC);
        blob(.3, .4, 1.22, 0); blob(.26, -.34, 1.1, .05, 1, .9, lfHi); if (!lod) blob(.24, .02, 1.42, -.05);
        top = 1.7;
      } else {
        // 圆树（round / autumn / orchard）：五团叶子，果树挂果子
        const up = lod ? 0 : .3;   // 地图里的树干高一截
        if (!lod) trunk(.15, .09, 1.02);
        blob(lod === 2 ? .8 : .66, 0, 1.12 + up, 0);
        if (!lod) blob(.5, -.4, 1.0 + up, .12);
        if (lod < 2) blob(.5, .3, (lod ? 1.4 : 1.46) + up, 0, 1, .9, P.snow ? leafC('#dfeaf0', '#f4f9fb', '#ffffff') : lfHi);
        if (style === 'orchard' && !lod) [[.4, .9, .42, '#ff7043'], [-.36, 1.05, .4, '#ffca28'], [.1, .8, .62, '#e53935'], [-.12, 1.3, .52, '#ff7043']].forEach(([x, y, z, c]) => put(bag, new T3.SphereGeometry(.085, 6, 4), c, x, y, z));
        top = 2.0 + up;
      }
      return { geo: bake(bag), top, dbl, tint };
    }
    // 山上用哪种树打底：棕榈岛的山上是阔叶树林，棕榈从里面冒出来；别的岛就是本岛的树
    function buildTrees() {
      const L = LAND, P = PAL, style = THEME.tree || 'round', W = m.W, H = m.H;
      const lists = [[], [], [], [], []];   // 0 地图里的细树  1 外面近处的  2 外面远处的一团  3 外面混着种的阔叶树  4 地图里混着种的阔叶树
      const mixRound = style === 'palm';
      const push = (li, x, z, s, r) => lists[li].push({ x, y: L.ground(x, z) - .04, z, s, ry: r * 6.283, r });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x];
        if (c !== '#' && c !== 'T') continue;
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9), edge = c === '#';
        const px = x + .5 + (r - .5) * (edge ? .5 : .24), pz = y + .5 + (r2 - .5) * (edge ? .5 : .24);
        if (L.samp(L.sd, px, pz) < .25) continue;
        push(edge && mixRound && r2 > .45 ? 4 : 0, px, pz, (edge ? 1.12 : 1) * (.86 + r * .3), r2);
      }
      const o = {}, ring = Q.ring, far = ring + (tier === 'low' ? 0 : 12);
      for (let y = -far; y < H + far; y++) for (let x = -far; x < W + far; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) continue;
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9), px = x + .5 + (r - .5) * .7, pz = y + .5 + (r2 - .5) * .7;
        const h = L.outer(px, pz, o);
        if (o.landK < .7 || h < L.SEA + .25 || o.dOut > far) continue;
        if (pz > H + 2.5) continue;                                   // 地图南边外面是镜头待的地方（也看不到），不种
        if (o.corr > .55 && o.dOut < 14 && o.dw < 1.3) continue;    // 出口外面的山谷里不种树，看得到路通出去
        if (o.dOut <= ring) { if (rnd(x, y, 13) < .55) push(mixRound && r2 > .42 ? (o.dOut < 1.3 ? 4 : 3) : (o.dOut < 1.3 ? 0 : 1), px, pz, .95 + r * .4, r2); }
        else if (rnd(x, y, 13) < .26) push(2, px, pz, 1.7 + r * 1.2, r2);
      }
      const kits = [treeKit(style, P, 0), treeKit(style, P, 1), treeKit(mixRound ? 'round' : style, P, 2), mixRound ? treeKit('round', P, 1) : null, mixRound ? treeKit('round', P, 0) : null];
      // 三角形预算（树是最费的）：超了就先把地图里靠边的 # 换成省的那种，再把地图外面的按比例抽掉一些
      const nTri = i => (kits[i] ? kits[i].geo.attributes.position.count / 3 : 0), total = () => lists.reduce((a, l, i) => a + l.length * nTri(i), 0);
      if (lists[0].length * nTri(0) + lists[4].length * nTri(4) > TREE_TRIS * .6) {
        [[0, 1], [4, 3]].forEach(([a, b]) => { if (!kits[b]) return; const keepL = []; lists[a].forEach(p => { if (tIn(Math.floor(p.x), Math.floor(p.z)) === '#' || lists[a].length * nTri(a) > TREE_TRIS * .5 && rnd(p.x | 0, p.z | 0, 17) < .5) lists[b].push(p); else keepL.push(p); }); lists[a] = keepL; });
      }
      if (total() > TREE_TRIS) {
        const inner = lists[0].length * nTri(0) + lists[4].length * nTri(4), outer = total() - inner, k = Math.max(.1, (TREE_TRIS - inner) / Math.max(1, outer));
        [1, 2, 3].forEach(i => { lists[i] = lists[i].filter(p => tIn(Math.floor(p.x), Math.floor(p.z)) !== '' || rnd(p.x | 0, p.z | 0, 19) < k); });
      }
      lists.forEach((list, li) => {
        const kit = kits[li];
        if (!kit) return;
        if (!list.length) { kit.geo.dispose(); return; }
        const cols = kit.tint;
        list.forEach(p => { const k = .86 + p.r * .28; p.c = cols ? C(cols[Math.floor(p.r * cols.length) % cols.length]) : new T3.Color(k, k * (.97 + rnd(p.x | 0, p.z | 0, 4) * .06), k * .96); });
        inst(kit.geo, treeMat(kit.dbl), list, li !== 2);
      });
      // 省电档没有影子图：树脚下垫一块圆影子
      if (!Q.shadow) inst(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, lists[0].concat(lists[4]).map(p => ({ x: p.x + .12, y: p.y + .07, z: p.z - .1, s: 1.7 * p.s })), false);
    }

    // ---------- 草：草丛（会遇到怪兽的那种）又高又密、颜色深；普通草地是矮矮的草叶；草里散着小花 ----------
    function tuftGeo(n, h, w, rootC, midC, tipC, spread) {
      const bag = Bag(), c0 = C(rootC), c1 = C(midC), c2 = C(tipC);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + Math.sin(i * 7.1) * .5, r = spread * (.25 + ((i * 37) % 11) / 11 * .75), bx = Math.cos(a) * r, bz = Math.sin(a) * r;
        const hh = h * (.72 + ((i * 53) % 13) / 13 * .5), ww = w * (.8 + ((i * 17) % 7) / 7 * .4), lx = Math.cos(a) * hh * .16, lz = Math.sin(a) * hh * .16;
        const ox = Math.cos(a + 1.571) * ww, oz = Math.sin(a + 1.571) * ww;
        const A0 = [bx - ox, 0, bz - oz], B0 = [bx + ox, 0, bz + oz], A1 = [bx + lx * .45 - ox * .62, hh * .55, bz + lz * .45 - oz * .62], B1 = [bx + lx * .45 + ox * .62, hh * .55, bz + lz * .45 + oz * .62], T = [bx + lx, hh, bz + lz];
        quad(bag, A0, B0, B1, A1, c0, c0, c1, c1); tri(bag, A1, B1, T, c1, c1, c2);
      }
      const g = bake(bag), nr = g.attributes.normal;
      for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);   // 法线一律朝上：草叶和地面受一样的光，不会一片片忽明忽暗
      return g;
    }
    function lawnGeo(rootC, tipC) {
      const bag = Bag(), c0 = C(rootC), c2 = C(tipC);
      for (let i = 0; i < 6; i++) {
        const bx = (i - 2.5) * .085 + Math.sin(i * 5.3) * .035, bz = Math.cos(i * 3.7) * .11, hh = .13 + ((i * 53) % 13) / 13 * .17, w = .045 + ((i * 29) % 7) / 7 * .03, lean = Math.sin(i * 2.9) * .09;
        tri(bag, [bx - w, 0, bz], [bx + w, 0, bz], [bx + lean, hh, bz + .03], c0, c0, c2);
      }
      const g = bake(bag), nr = g.attributes.normal;
      for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
      return g;
    }
    function buildGrass() {
      const L = LAND, P = PAL, W = m.W, H = m.H, BAND = 8, tall = {}, lawn = {}, flowers = [[], [], [], []];
      // 草的预算：草丛、草地特别多的地图每格少放几簇
      let cT = 0, cL = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = m.grid[y][x]; if (c === ',') cT++; else if ('.FBofT'.includes(c)) cL++; }
      const nT = Math.max(2, Math.min(Math.round(9 * Q.grass), Math.floor(GRASS_TRIS / 21 / Math.max(1, cT)))), nL = Math.max(1, Math.min(Math.round(12 * Q.lawn), Math.floor(GRASS_TRIS * .8 / 6 / Math.max(1, cL))));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = m.grid[y][x], b = Math.floor(y / BAND);
        if (c === ',') {
          const list = tall[b] || (tall[b] = []);
          for (let k = 0; k < nT; k++) {
            const px = x + ((k % 3) + .5) / 3 + (rnd(x * 3 + k, y, 41) - .5) * .3, pz = y + (Math.floor(k / 3) + .5) / 3 + (rnd(x, y * 3 + k, 42) - .5) * .3, r = rnd(x + k, y - k, 43);
            list.push({ x: px, y: L.ground(px, pz), z: pz, s: .9 + r * .35, sy: .85 + rnd(k, x + y, 44) * .45, ry: r * 6.283 });
          }
        } else if ('.FBofT'.includes(c) && !L.isWater(x, y) && !(m.paintAs && c === 'o' && m.paintAs[x + ',' + y] && m.paintAs[x + ',' + y] !== '.')) {
          const list = lawn[b] || (lawn[b] = []), n = c === 'T' ? Math.ceil(nL / 2) : nL;
          for (let k = 0; k < n; k++) {
            const px = x + ((k % 4) + rnd(x * 5 + k, y, 51) * 1.5 - .25) / 4, pz = y + ((Math.floor(k / 4) % 3) + rnd(x, y * 5 + k, 52) * 1.6 - .3) / 3, r = rnd(x + k * 3, y + k, 53);
            if (L.samp(L.F.dWalk, px, pz) > .5 || L.samp(L.sd, px, pz) < .2) continue;
            const kc = .94 + rnd(k + x, y * 3, 55) * .12, pt = sstep(.35, .65, fbm(px * .16 + 5, pz * .16 + 2)) - .5;   // pt：这一片偏黄（正）还是偏青（负）
            list.push({ x: px, y: L.ground(px, pz) - .01, z: pz, s: .9 + r * .35, sy: .7 + rnd(k, x - y, 54) * .7, ry: (r - .5) * 1.1, c: new T3.Color(kc * (1 + pt * .22), kc * (1 + pt * .07), kc * (1 - pt * .3)) });
          }
          // 花：F 格是一小片花；草地上零星几朵，成片的地方多一点
          const nF = c === 'F' ? 7 : (fbm(x * .23 + 3, y * .23 + 8) > .62 && rnd(x, y, 61) < .55 ? 2 : rnd(x, y, 62) < .06 ? 1 : 0);
          for (let k = 0; k < nF && c !== 'T'; k++) {
            const px = x + .12 + rnd(x * 7 + k, y, 63) * .76, pz = y + .12 + rnd(x, y * 7 + k, 64) * .76, r = rnd(x + k, y + k * 5, 65);
            flowers[Math.floor(rnd(x + k * 2, y, 66) * 4)].push({ x: px, y: L.ground(px, pz), z: pz, s: .8 + r * .5, ry: (r - .5) * .8 });
          }
        }
      }
      const tg = tuftGeo(7, .56, .06, mixC(A.shade(P.tall, .7), P.blade, .35), P.tall, mixC(P.tall, '#eef7a0', P.snow ? .15 : .42), .2);
      const lg = lawnGeo(mixC(A.shade(P.grass, .88), '#27a082', P.snow ? .02 : .08), mixC(P.grass, '#f4f6a0', P.snow ? .06 : .22));
      let any = false;
      Object.values(tall).forEach(list => { const im = inst(tg.clone(), grassMat, list, false); if (im) { any = true; grassBands.push(im); } });
      Object.values(lawn).forEach(list => { const im = inst(lg.clone(), grassMat, list, false); if (im) grassBands.push(im); });
      tg.dispose(); lg.dispose();
      // 四种颜色的小花：五片花瓣朝着镜头这边仰着，一根短短的茎
      [['#ffffff', '#ffd54f'], ['#ff7fa8', '#ffe082'], ['#ffd84a', '#ff8f3d'], ['#b79bff', '#fff59d']].forEach(([pc, cc], fi) => {
        if (!flowers[fi].length) return;
        const bag = Bag(), cp = C(pc), cq = C(A.shade(pc, .86)), ce = C(cc), cs = C(A.shade(P.blade, 1.1)), R = .1, hy = .36, tl = .72;
        tri(bag, [-.014, 0, 0], [.014, 0, 0], [0, hy, 0], cs);
        for (let k = 0; k < 5; k++) {
          const a0 = k / 5 * 6.283, a1 = (k + .5) / 5 * 6.283, a2 = (k + 1) / 5 * 6.283, pt = (a, r) => [Math.cos(a) * r, hy + Math.sin(a) * r * tl, Math.sin(a) * r * (1 - tl) + .01];
          tri(bag, [0, hy, .012], pt(a0, R * .55), pt(a1, R), ce, cq, cp); tri(bag, [0, hy, .012], pt(a1, R), pt(a2, R * .55), ce, cp, cq);
        }
        const g = bake(bag), nr = g.attributes.normal;
        for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
        inst(g, flowerMat, flowers[fi], false);
      });
      return any;
    }
    const grassBands = [], TREE_TRIS = tier === 'high' ? 150000 : tier === 'mid' ? 85000 : 45000, GRASS_TRIS = tier === 'high' ? 56000 : tier === 'mid' ? 30000 : 14000;

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
        const gable = (h, col, over, yb) => {
          yb = y0 + (yb == null ? wallH : yb);
          const hw = (w + .2) / 2, zf = front + over, zb = back - .14, zr = cz + .04, c1 = C(col), c2 = C(A.shade(col, .88)), cR = C(A.shade(col, 1.16)), cF = C(A.shade(col, .7)), nB = 6, wc = C(wallC), cS = C(A.shade(col, .64));
          for (let k = 0; k < nB; k++) { const ta = k / nB, tb = (k + 1) / nB, sag = t => -.07 * Math.sin(t * Math.PI); const ya = yb + h * ta + sag(ta) + (k ? .045 : 0), yt = yb + h * tb + sag(tb), za = lerp(zf, zr, ta), zt = lerp(zf, zr, tb); quad(bag, [cx - hw, ya, za], [cx + hw, ya, za], [cx + hw, yt, zt], [cx - hw, yt, zt], k % 2 ? c2 : c1); if (k) quad(bag, [cx - hw, ya - .045, za], [cx + hw, ya - .045, za], [cx + hw, ya, za], [cx - hw, ya, za], cS); }
          quad(bag, [cx + hw, yb, zb], [cx - hw, yb, zb], [cx - hw, yb + h, zr], [cx + hw, yb + h, zr], c2);
          quad(bag, [cx - hw, yb - .11, zf], [cx + hw, yb - .11, zf], [cx + hw, yb, zf], [cx - hw, yb, zf], cF);
          { const xa = cx - (w - .2) / 2, xb = cx + (w - .2) / 2, c0 = mixC(A.shade(wallC, .7), '#8aa0d0', .3), c1 = C(A.shade(wallC, .97)); quad(bag, [xa, yb - .3, front + .004], [xb, yb - .3, front + .004], [xb, yb - .02, front + .004], [xa, yb - .02, front + .004], c1, c1, c0, c0); }
          box(bag, w + .28, .1, .16, cR, cx, yb + h - .05, zr);
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
        const chimney = () => { bx(.26, .62, .26, byY(A.shade(roofC, .6), A.shade(roofC, .78), 0, .62), x1 - .85, wallH + .3, cz - .1); bx(.34, .08, .34, '#f1ebe0', x1 - .85, wallH + .9, cz - .1); };
        switch (style) {
          case 'med': wallC = '#fbf7ef'; wall(wallH); gable(gym ? 1.15 : .95, gym ? roofC : '#d9643a', .42); if (home) chimney(); doorKind = 'blue'; winKind = 'shutter'; break;
          case 'crayon': {
            wallC = HCOL[Math.floor(hsh * HCOL.length)]; wall(wallH); flat(['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc'][Math.floor(hsh * 5)], wallH, false);
            const r = Math.min(w, d + .4) * .56; pyramid(r, Math.min(r, d * .62), 1.05, '#f5d7a1', wallH + .14, 6);
            gp(new T3.ConeGeometry(r * .36, .34, 6).scale(1, 1, Math.min(1, d * .62 / r)), '#37474f', cx, wallH + .14 + .9, cz); top += .1; winKind = 'round';
            break;
          }
          case 'farm': wall(wallH, 'plank', P.wall || '#c9955e'); gable(1.15, '#e8c35a', .6); winKind = 'shutter'; shut = '#7a4a28'; break;
          case 'brick': {
            wallH += gym ? .3 : .15; wall(wallH, 'brick', '#b5543c'); flat('#6d4c41');
            if (w >= 5) { bx(1, 1.1, 1, '#b5543c', cx, wallH + .14, cz); pyramid(.8, .8, .6, '#6d4c41', wallH + 1.24); dS(cx - .3, y0 + wallH + .5, cx + .3, y0 + wallH + 1.1, cz + .51, clockCell()); }
            break;
          }
          case 'dome': {
            wallC = '#f6fafc'; wall(wallH); bx(w - .16, .12, d + .06, P.trim || '#5c6bc0', cx, wallH - .32, cz);
            const dr = Math.min(w - .24, d) * .5, dsx = w > d + .5 ? (w - .24) / d : 1;
            gp(new T3.SphereGeometry(dr, 16, 8, 0, 6.2832, 0, Math.PI / 2).scale(dsx, 1, 1), leafC('#5fb3e0', '#8fd3f4', '#dff4ff'), cx, wallH, cz);
            bx(.05, .5, .05, '#90a4ae', cx + w * .3, wallH + dr * .8, cz); top = wallH + dr; doorKind = 'glass';
            break;
          }
          case 'tent': {
            round = Math.min(w - .2, d + .2) / 2; const sc = gym ? roofC : ['#e53935', '#1e88e5', '#8e24aa', '#43a047'][Math.floor(hsh * 4)], n = 16;
            for (let k = 0; k < n; k++) { const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, col = C(k % 2 ? '#ffffff' : sc), col2 = C(k % 2 ? '#ffffff' : (gym ? roofC : '#ffca28')), P0 = [cx + Math.cos(a0) * round, y0, cz + Math.sin(a0) * round], P1 = [cx + Math.cos(a1) * round, y0, cz + Math.sin(a1) * round]; quad(bag, P1, P0, [P0[0], y0 + wallH, P0[2]], [P1[0], y0 + wallH, P1[2]], col); tri(bag, [cx + Math.cos(a1) * round * 1.14, y0 + wallH, cz + Math.sin(a1) * round * 1.14], [cx + Math.cos(a0) * round * 1.14, y0 + wallH, cz + Math.sin(a0) * round * 1.14], [cx, y0 + wallH + 1.3, cz], col2); }
            bx(.04, .5, .04, '#6d4121', cx, wallH + 1.25, cz); bx(.3, .18, .02, '#ffca28', cx + .17, wallH + 1.55, cz); top = wallH + 1.6;
            break;
          }
          case 'tower': wallH = gym ? 2.7 : 2.1; wall(wallH, 'stone', '#cfc6b6'); pyramid((w + .5) / 2, (d + .5) / 2, 1.3, '#4f9e8a'); dS(cx - .3, y0 + wallH - .78, cx + .3, y0 + wallH - .18, front + .012, clockCell()); break;
          case 'cake': {
            round = Math.min(w - .2, d + .2) / 2;
            gp(new T3.CylinderGeometry(round, round, wallH * .64, 22).translate(0, wallH * .32, 0), '#fff4e0', cx, 0, cz); gp(new T3.CylinderGeometry(round * .72, round * .72, wallH * .46, 22).translate(0, wallH * .23, 0), '#ffe0ea', cx, wallH * .64, cz);
            gp(new T3.TorusGeometry(round, .1, 6, 22).rotateX(Math.PI / 2), '#ff8fb1', cx, wallH * .64, cz); gp(new T3.TorusGeometry(round * .72, .09, 6, 22).rotateX(Math.PI / 2), '#ffffff', cx, wallH * 1.1, cz);
            gp(new T3.SphereGeometry(.15, 10, 8), '#e53935', cx, wallH * 1.1 + .14, cz); top = wallH * 1.1 + .3; wallH *= .64;
            break;
          }
          case 'hut': {
            [[x0 + .3, back + .1], [x1 - .3, back + .1], [x0 + .3, front - .1], [x1 - .3, front - .1]].forEach(([px, pz]) => bx(.11, .5, .11, '#6d4121', px, 0, pz));
            bx(w - .24, wallH - .1, d, byY('#8c5e30', '#a8773f', 0, wallH - .1), cx, .45, cz); gable(.85, '#4c8f3a', .6, wallH + .35); bx(w - .1, .06, .5, '#8a5a33', cx, .42, front + .2);
            for (let k = 0; k < 3; k++) bx(.42, .05, .1, '#8a5a33', b.door ? b.door.x + .5 : cx, .08 + k * .13, front + .52 - k * .1);
            break;
          }
          case 'city': wallH = gym ? 2.5 : home ? 2.3 + hsh * .8 : 2.9 + hsh * 1.2; wall(wallH, 'office', '#b0bec5'); flat('#546e7a'); bx(.6, .35, .5, '#78909c', cx + w * .2, wallH + .14, cz - .1); doorKind = 'glass'; winKind = 'none'; break;
          case 'market': {
            wallC = '#ffffff'; wall(wallH); flat(roofC);
            const sc = ['#ff7043', '#1e88e5', '#43a047', '#fdd835'][Math.floor(hsh * 4)], n = Math.max(4, Math.round(w * 2));
            for (let k = 0; k < n; k++) { const xa = x0 + .15 + (w - .3) * k / n, xb = x0 + .15 + (w - .3) * (k + 1) / n; quad(bag, [xa, y0 + wallH * .62, front + .5], [xb, y0 + wallH * .62, front + .5], [xb, y0 + wallH * .86, front + .02], [xa, y0 + wallH * .86, front + .02], C(k % 2 ? '#ffffff' : sc)); }
            winKind = 'none';
            break;
          }
          case 'chalet': wall(wallH, 'log', '#8d6e63'); gable(1.4, '#f4f8fb', .6); chimney(); break;
          case 'temple': {
            wallH += .15; wall(wallH, 'stone', '#c9bfa8'); bx(w + .1, .16, d + .5, '#b3a992', cx, wallH, cz); bx(w - .5, .16, d, '#a39a84', cx, wallH + .16, cz); top = wallH + .32;
            [x0 + .35, x1 - .35].forEach(px => gp(new T3.CylinderGeometry(.12, .15, wallH, 10).translate(0, wallH / 2, 0), '#ddd4bf', px, 0, front + .24));
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
            wallH += .3; wall(wallH, 'plank', '#e8d5b0'); pyramid((w + .2) / 2, (d + .3) / 2, 1.0, '#8d6e63');
            const hub = new T3.Group(), hb = Bag(); hub.position.set(cx, y0 + wallH + .5, front + .3);
            for (let k = 0; k < 4; k++) put(hb, new T3.BoxGeometry(.2, 1.4, .03).translate(0, .78, 0).rotateZ(k * Math.PI / 2), '#f5ecd9'); put(hb, new T3.SphereGeometry(.1, 8, 6), '#8d6e63');
            const hg = bake(hb); own.push(hg); hub.add(new T3.Mesh(hg, propMat)); hub.children[0].castShadow = !!Q.shadow; add(hub, false); spinners.push(hub); top = wallH + 1.7;
            break;
          }
          case 'stadium': {
            round = Math.min(w, d + .3) / 2;
            gp(new T3.CylinderGeometry(round, round * 1.05, wallH, 24, 1, true).translate(0, wallH / 2, 0), byY('#cfd8dc', '#f3f6f7', 0, wallH), cx, 0, cz); gp(new T3.TorusGeometry(round, .09, 6, 24).rotateX(Math.PI / 2), roofC, cx, wallH, cz);
            round *= 1.04;
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
          if (style !== 'hut') bx(.9, .09, .3, topSide('#e9e2d5', '#bdb3a2'), dx, 0, dz + .16);
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
          [x0 + .86, x1 - .86].forEach(wx => { if (!b.door || Math.abs(wx - (b.door.x + .5)) > .8) dS(wx - .42, wy, wx + .42, wy + .72, front + .014, cellW); });
          if (w >= 7 && b.door) [cx - 1.1, cx + 1.1].forEach(wx => { if (Math.abs(wx - (b.door.x + .5)) > .8 && Math.abs(wx - x0 - .86) > .9 && Math.abs(wx - x1 + .86) > .9) dS(wx - .42, wy, wx + .42, wy + .72, front + .014, cellW); });
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
        const fade = { value: 0 }, bm = paint(new T3.MeshToonMaterial({ gradientMap: rampTex, vertexColors: true, shadowSide: T3.DoubleSide }), { key: 'bld', occ: true, fade: true, floor: true });
        bm.userData.u = { uFade: fade, uFadeY: { value: y0 + .15 }, uRect: { value: new Float32Array(fnd || [0, 0, -1, -1]) } };   // 圆房子没有方墙基：范围给个空的，不画地板
        const sg = bake(bag); own.push(sg, bm);
        const sMesh = still(add(new T3.Mesh(sg, bm), true));
        if (dq.p.length) {
          const dm = paint(new T3.MeshToonMaterial({ gradientMap: rampTex, map: tex, alphaTest: .5 }), { key: 'bldDecal', occ: true, fade: true });
          dm.userData.u = { uFade: fade, uFadeY: bm.userData.u.uFadeY };
          const dg = new T3.BufferGeometry();
          dg.setAttribute('position', new T3.Float32BufferAttribute(dq.p, 3)); dg.setAttribute('normal', new T3.Float32BufferAttribute(dq.n, 3)); dg.setAttribute('uv', new T3.Float32BufferAttribute(dq.u, 2));
          own.push(dg, dm);
          still(add(new T3.Mesh(dg, dm), false));
        }
        BLD.push({ x0, x1, z0: back - .15, top: y0 + top, fade, cur: 0, mesh: sMesh });
      });
      function clockCell() {
        return atlasCell('clock', 64, 64, g => {
          g.fillStyle = '#b8862b'; A.circ(g, 32, 32, 31); g.fill(); g.fillStyle = '#fffdf5'; A.circ(g, 32, 32, 26); g.fill();
          g.strokeStyle = '#37474f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 14); g.moveTo(32, 32); g.lineTo(44, 38); g.stroke();
          for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillStyle = '#37474f'; A.circ(g, 32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21, 1.8); g.fill(); }
        });
      }
    }
    function fadeBuildings(dt, px, py, pz) {
      const k = 1 - Math.exp(-dt * 8), tan = Math.tan(CAM.cur || CAM.dl), camZ = camera.position.z;
      for (let i = 0; i < BLD.length; i++) {
        const b = BLD[i], want = b.z0 > pz - .1 && b.z0 < camZ - 1 && px > b.x0 - 1.7 && px < b.x1 + 1.7 && b.top > py + .3 + (b.z0 - pz) * tan - 1.1 ? 1 : 0;
        if (b.cur !== want) {
          b.cur += (want - b.cur) * k; if (Math.abs(b.cur - want) < .02) b.cur = want; b.fade.value = b.cur;
          const cast = b.cur < .5 && !!Q.shadow;   // 淡出去的房子影子也收掉（影子图重画一次）
          if (b.mesh.castShadow !== cast) { b.mesh.castShadow = cast; renderer.shadowMap.needsUpdate = true; }
        }
      }
    }
    let occH = null;   // occH：每格上面的岩壁顶有多高，镜头要从它上面看过去

    // ---------- 回声技能的障碍（小树、裂开的岩石、大石头）、机关门、地上的道具 ----------
    let obstM = [], bouldM = [], gateM = [], pickS = [];
    function buildMovables() {
      const L = LAND, P = PAL, rock = P.rock || '#a39b8b';
      obstM = []; bouldM = []; gateM = []; pickS = [];
      const mk = (bag, x, z, y) => { const g = bake(bag); own.push(g); const o = new T3.Mesh(g, propMat); o.position.set(x, y == null ? L.ground(x, z) : y, z); return add(o, true); };
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = m.grid[y][x];
        if (c === 'n') {
          const b = Bag(); put(b, new T3.CylinderGeometry(.06, .09, .4, 6).translate(0, .2, 0), '#7a4a26');
          put(b, new T3.SphereGeometry(.34, 8, 6).scale(1, .9, 1), leafC(A.shade(P.tree, .7), P.tree, P.treeHi), 0, .62, 0); put(b, new T3.SphereGeometry(.22, 7, 5), leafC(P.tree, P.treeHi, A.shade(P.treeHi, 1.1)), .12, .9, .05);
          obstM.push({ g: mk(b, x + .5, y + .5), key: x + ',' + y });
        } else if (c === 'b') {
          const b = Bag(); put(b, new T3.IcosahedronGeometry(.4, 0).scale(1.05, .9, 1), leafC(A.shade(rock, .7), A.shade(rock, .95), A.shade(rock, 1.1)), 0, .3, 0);
          box(b, .035, .4, .02, '#3d2d20', .03, .16, .37);
          obstM.push({ g: mk(b, x + .5, y + .5), key: x + ',' + y });
        } else if (c === '|') {
          const b = Bag(); [-.3, 0, .3].forEach(k => put(b, new T3.CylinderGeometry(.06, .06, 1.1, 8).translate(0, .55, 0), '#8d6e63', k, 0, 0)); box(b, .9, .1, .12, '#5d4037', 0, 1.0, 0);
          const g = mk(b, x + .5, y + .5); gateM.push({ g, key: x + ',' + y, y0: g.position.y });
        }
      }
      (m.boulders || []).forEach(q => {
        const b = Bag(); put(b, new T3.SphereGeometry(.46, 9, 7).scale(1, .92, 1), leafC('#6f6f6f', '#9e9e9e', '#c4c4c4'), 0, .42, 0);
        bouldM.push(mk(b, q.x + .5, q.y + .5));
      });
      m.picks.forEach(p => {
        const o = new T3.Mesh(pickGeo, pickMat); o.position.set(p.x + .5, 0, p.y + .55);
        world.add(o); pickS.push({ p, o });
      });
    }

    // ---------- 人物纸片：笔直立着、正对镜头，脚下一块圆影子（影子统一在 blobs 里画） ----------
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
      const s = { n, root: new T3.Group(), key: '', frame: -1, dir: '', mesh: null, rx: n ? n.x : 0, ry: n ? n.y : 0, alert: null, quest: null, tex: null, im: null };
      return s;
    }
    function dropMesh(s) {
      if (!s.mesh) return;
      s.root.remove(s.mesh); s.mesh.geometry.dispose();
      if (s.tex) { s.tex.dispose(); s.mesh.material.dispose(); s.tex = null; }
      s.mesh = null;
    }
    function setLook(s, look) {
      const mt = lookMat(look), key = JSON.stringify(look);
      if (s.key === key) return;
      dropMesh(s);
      s.mesh = new T3.Mesh(sheetGeo(PERSON), mt); s.mesh.receiveShadow = !!Q.shadow;
      s.root.add(s.mesh);
      s.key = key; s.frame = -1; s.dir = '';
    }
    function setFrame(s, dir, frame) {
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

    // ---------- 天：头顶蓝、地平线暖白；一朵朵圆滚滚的云慢慢飘；远处几座小岛淡在雾气里 ----------
    const skyMat = new T3.ShaderMaterial({
      uniforms: { uZen: { value: C('#3a8fe6') }, uMid: { value: C('#69bcf3') }, uLow: { value: C('#bfe4f7') }, uHaze: U.uHaze },
      vertexShader: 'varying vec3 vDir; void main(){ vec3 dv = vec3(position.x / projectionMatrix[0][0], position.y / projectionMatrix[1][1], -1.0); vDir = transpose(mat3(viewMatrix)) * dv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uHaze; varying vec3 vDir;\nvoid main(){ float e = normalize(vDir).y; vec3 c = mix(uHaze, uLow, smoothstep(-0.005, 0.045, e)); c = mix(c, uMid, smoothstep(0.03, 0.15, e)); c = mix(c, uZen, smoothstep(0.13, 0.5, e)); gl_FragColor = vec4(c, ' + (Q.post ? '0.0' : '1.0') + ');\n#include <colorspace_fragment>\n}',
      depthTest: false, depthWrite: false,
    });
    const sky = new T3.Mesh(new T3.PlaneGeometry(2, 2), skyMat);
    sky.frustumCulled = false; sky.renderOrder = -100; sky.matrixAutoUpdate = false;
    keep.push(skyMat, sky.geometry);
    // 云：四种样子画在一张图上（一堆圆叠起来，顶上白、底下带一点蓝灰）
    const cloudTex = canvasTex(512, 256, g => {
      for (let v = 0; v < 4; v++) {
        const ox = (v % 2) * 256, oy = Math.floor(v / 2) * 128, c2 = document.createElement('canvas'); c2.width = 256; c2.height = 128;
        const q = c2.getContext('2d'), n = 7 + v * 2;
        q.fillStyle = '#fff';
        const puffs = [];
        for (let k = 0; k < n; k++) { const t = k / (n - 1), x = 44 + t * 168 + (hash2(k, v) - .5) * 14, r = 16 + 27 * Math.sin(Math.PI * (.12 + .76 * t)) * (.66 + hash2(k + 9, v) * .56); puffs.push([x, 92 - r * .82, r]); q.beginPath(); q.arc(x, 92 - r * .82, r, 0, 6.283); q.fill(); }
        q.fillRect(40, 78, 176, 16); q.beginPath(); q.arc(40, 86, 8, 0, 6.283); q.arc(216, 86, 8, 0, 6.283); q.fill();
        q.globalCompositeOperation = 'source-atop';
        const gr = q.createLinearGradient(0, 30, 0, 96); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#fbfcff'); gr.addColorStop(.72, '#dfe9f8'); gr.addColorStop(1, '#b3c6e6');
        q.fillStyle = gr; q.fillRect(0, 0, 256, 128);
        puffs.forEach(([x, y, r], k) => {
          if (k % 2) { const g2 = q.createRadialGradient(x + r * .3, y + r * .45, r * .2, x + r * .1, y + r * .2, r * 1.05); g2.addColorStop(0, 'rgba(160,184,224,.5)'); g2.addColorStop(1, 'rgba(160,184,224,0)'); q.fillStyle = g2; q.beginPath(); q.arc(x, y, r, 0, 6.283); q.fill(); }
          const g3 = q.createRadialGradient(x - r * .3, y - r * .35, 0, x - r * .3, y - r * .35, r * .8); g3.addColorStop(0, 'rgba(255,255,255,.95)'); g3.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g3; q.beginPath(); q.arc(x, y, r, 0, 6.283); q.fill();
        });
        g.drawImage(c2, ox, oy);
      }
    });
    cloudTex.anisotropy = 4;
    const cloudMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uMap: { value: cloudTex }, uHaze: U.uHaze },
      vertexShader: 'attribute vec4 aCell; attribute vec2 aDrift; uniform float uTime; varying vec2 vUv; varying float vE; varying float vEl;\nvoid main(){ vUv = aCell.xy + uv * aCell.zw; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); float hw = 430.0; float x = mod(w.x + aDrift.x + uTime * aDrift.y + hw, hw * 2.0) - hw; vE = 1.0 - smoothstep(hw * 0.72, hw * 0.98, abs(x)); w.x = x + cameraPosition.x * 0.9; vec3 d = w.xyz - cameraPosition; vEl = d.y / length(d); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform sampler2D uMap; uniform vec3 uHaze; varying vec2 vUv; varying float vE; varying float vEl;\nvoid main(){ vec4 t = texture2D(uMap, vUv); vec3 c = mix(uHaze, t.rgb, 0.35 + 0.65 * smoothstep(0.0, 0.11, vEl)); gl_FragColor = vec4(c, t.a * vE * (0.55 + 0.45 * smoothstep(0.0, 0.07, vEl)));\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    const cloudGeo = new T3.PlaneGeometry(1, 1);
    const clouds = (() => {
      const n = Q.clouds, im = new T3.InstancedMesh(cloudGeo, cloudMat, n), cell = new Float32Array(n * 4), drift = new Float32Array(n * 2), o = new T3.Object3D();
      for (let i = 0; i < n; i++) {
        const r = hash2(i, 71), r2 = hash2(i, 72), r3 = hash2(i, 73), dist = 150 + r * 170, w = (26 + r2 * 34) * dist / 230;
        o.position.set(0, 6 + dist * (.045 + r3 * .17), -dist); o.scale.set(w, w * .5, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
        const v = i % 4; cell.set([(v % 2) * .5, 1 - (Math.floor(v / 2) + 1) * .5, .5, .5], i * 4);
        drift.set([(i / n + r * .08) * 860, 1.1 + r2 * 1.3], i * 2);
      }
      cloudGeo.setAttribute('aCell', new T3.InstancedBufferAttribute(cell, 4)); cloudGeo.setAttribute('aDrift', new T3.InstancedBufferAttribute(drift, 2));
      im.frustumCulled = false; im.renderOrder = -50; im.matrixAutoUpdate = false;
      return im;
    })();
    keep.push(cloudTex, cloudMat, cloudGeo, clouds);
    const farMat = toon({}, { key: 'far' });
    let farIsles = null;
    function buildFar() {
      // 远处的小岛：几座圆头的山，离得远，被雾气染成淡蓝色；每张地图位置不一样（按地图名字算）
      const bag = Bag(), P = PAL, seed = m.id.length * 31 + m.z * 7, cxm = m.W / 2, czm = m.H / 2, n = tier === 'low' ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const r = hash2(i, seed), r2 = hash2(i + 40, seed), r3 = hash2(i + 80, seed), ang = -Math.PI / 2 + (i / (n - 1) - .5) * 2.4 + (r - .5) * .2, dist = Q.skirt + 46 + r2 * 70, R = 13 + r3 * 20, Hh = 7 + r * 15;
        [[1, 1, 0], [.62, .6, .78], [.5, .42, -.7]].forEach(([kr, kh, off], j) => {
          if (j && hash2(i * 3 + j, seed) < .3) return;
          const g = new T3.ConeGeometry(1, 1, 11, 4), p = g.attributes.position, Rj = R * kr, Hj = Hh * kh;
          for (let k = 0; k < p.count; k++) { const y = p.getY(k) + .5, a = Math.atan2(p.getZ(k), p.getX(k)), rr = (1 - Math.pow(y, .9)) * (.8 + .45 * vnoise(a * 1.7 + i * 9 + j * 4, y * 3 + i)) + .08; p.setXYZ(k, Math.cos(a) * rr * Rj, (Math.pow(y, 1.05) + (y > .05 && y < .95 ? (vnoise(a * 2.1 + 4 + j, i * 5.3) - .5) * .2 : 0)) * Hj, Math.sin(a) * rr * Rj * .8); }
          g.computeVertexNormals();
          put(bag, g, byY(A.shade(P.sand, .95), mixC(P.tree, P.grass, .5).getStyle(), .2, Hj * .1 + .4), cxm + Math.cos(ang) * dist - Math.sin(ang) * off * R, LAND.SEA - .2, czm + Math.sin(ang) * dist + Math.cos(ang) * off * R);
        });
      }
      const g = bake(bag); own.push(g);
      farIsles = new T3.Mesh(g, farMat); farIsles.frustumCulled = false;
      still(add(farIsles, false, false));
    }
    // 飘在空气里的花瓣和花粉（全在着色器里算，围着镜头转一个大盒子）；两三只蝴蝶
    const lifeN = Math.round(90 * Q.life);
    const lifeMat = new T3.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCen: { value: new T3.Vector3() }, uPx: { value: 1 } },
      vertexShader: 'attribute vec2 aK; uniform float uTime; uniform vec3 uCen; uniform float uPx; varying vec2 vK; varying float vA;\nvoid main(){ vec3 box = vec3(24.0, 6.5, 30.0); vec3 p = position * box; float t = uTime;\n  p.x += t * (0.55 + aK.x * 0.5); p.z += t * 0.2; p.y += sin(t * 0.8 + position.x * 40.0) * 0.5 - t * 0.12 * aK.y;\n  p = mod(p - uCen + box * 0.5, box) - box * 0.5 + uCen; p.y = uCen.y + mod(p.y - uCen.y + 1.0, box.y) - 0.6;\n  vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vK = vec2(aK.y, t * (2.0 + aK.x * 3.0) + position.z * 20.0);\n  gl_PointSize = uPx * (aK.y > 0.5 ? 0.085 : 0.045) * (0.7 + aK.x * 0.6) / max(0.5, -mv.z); vA = smoothstep(3.0, 6.0, -mv.z) * (1.0 - smoothstep(22.0, 30.0, -mv.z)); }',
      fragmentShader: 'varying vec2 vK; varying float vA;\nvoid main(){ vec2 q = gl_PointCoord - 0.5; float a;\n  vec3 c;\n  if (vK.x > 0.5) { float s = sin(vK.y), co = cos(vK.y); vec2 r = vec2(q.x * co - q.y * s, (q.x * s + q.y * co) * (1.6 + 1.2 * abs(sin(vK.y * 0.7)))); a = 1.0 - smoothstep(0.34, 0.42, length(r)); c = mix(vec3(1.0, 0.72, 0.82), vec3(1.0, 0.95, 0.96), smoothstep(-0.3, 0.3, r.x)); }\n  else { a = (1.0 - smoothstep(0.1, 0.5, length(q))) * 0.8; c = vec3(1.0, 0.98, 0.82); }\n  gl_FragColor = vec4(c, a * vA);\n#include <colorspace_fragment>\n}',
      transparent: true, depthWrite: false,
    });
    const life = (() => {
      if (!lifeN) return null;
      const g = new T3.BufferGeometry(), p = new Float32Array(lifeN * 3), k = new Float32Array(lifeN * 2);
      for (let i = 0; i < lifeN; i++) { p[i * 3] = hash2(i, 81); p[i * 3 + 1] = hash2(i, 82); p[i * 3 + 2] = hash2(i, 83); k[i * 2] = hash2(i, 84); k[i * 2 + 1] = i % 3 === 0 ? 1 : 0; }
      g.setAttribute('position', new T3.BufferAttribute(p, 3)); g.setAttribute('aK', new T3.BufferAttribute(k, 2));
      const o = new T3.Points(g, lifeMat); o.frustumCulled = false; o.renderOrder = 4; o.matrixAutoUpdate = false;
      keep.push(g);
      return o;
    })();
    keep.push(lifeMat);
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
      rt = new T3.WebGLRenderTarget(4, 4, { samples: Q.msaa, colorSpace: T3.SRGBColorSpace, depthBuffer: true, depthTexture: dtex });
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
        uniforms: { tDiffuse: { value: rt.texture }, tDepth: { value: dtex }, tBloom: { value: null }, uPx: { value: new T3.Vector2(1, 1) }, uNF: { value: new T3.Vector2(.5, 600) }, uBloom: { value: Q.bloom ? .42 : 0 }, uLine: { value: dtex ? 1 : 0 } },
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
          '    col = mix(col, col * vec3(0.26, 0.24, 0.36), k * 0.86);',
          '  }',
          '  col += texture2D(tBloom, vUv).rgb * uBloom;',
          // 调色：饱和一点点，暗部往冷色偏一点点，四角极轻的压暗
          '  float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, 1.1);',
          '  vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.22;',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <colorspace_fragment>',
          '}',
        ].join('\n'),
      });
      const quad = new T3.Mesh(new T3.PlaneGeometry(2, 2), comp);
      quad.frustumCulled = false;
      post = { scene: new T3.Scene(), cam: new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad, bright, blur, comp, a: Q.bloom ? mk() : null, b: Q.bloom ? mk() : null, dtex };
      post.scene.add(quad);
    }

    // ---------- 载入一张地图 ----------
    const spriteList = [];
    function clear() {
      if (world) scene.remove(world);
      own.forEach(o => o.dispose && o.dispose());
      own = [];
      spriteList.forEach(s => dropMesh(s));
      spriteList.length = 0; sprites.clear();
      BLD.length = 0; spinners.length = 0; grassBands.length = 0;
      obstM = []; bouldM = []; gateM = []; pickS = []; boatG = null; farIsles = null; atlas = null;
      world = new T3.Group(); world.matrixAutoUpdate = false;
      scene.add(world);
    }
    function addPerson(n) { const s = person(n); sprites.set(n, s); spriteList.push(s); world.add(s.root); return s; }
    function load(map) {
      m = map;
      clear();
      THEME = (window.EchoMaps && EchoMaps.THEMES[m.theme]) || {}; PAL = Object.assign({ grass: '#9ad66e', tall: '#55ab40', blade: '#2f7d2a', path: '#f1dfb2', tree: '#3f9a4a', treeHi: '#6cc15a', sand: '#f7e8bb', rock: '#a39b8b' }, m.pal || {});
      // 空气的颜色：雾里的古迹岛灰一些、浓一些；雪岛更白
      U.uFogA.value.set(PAL.fog ? '#b7c3c4' : PAL.snow ? '#cfdff0' : '#a9cdf0'); U.uHaze.value.set(PAL.fog ? '#dfe3df' : PAL.snow ? '#f3f6fb' : '#f8ecd8'); U.uFogP.value.set(PAL.fog ? 6 : 15, PAL.fog ? .034 : .0165, Q.far);
      skyMat.uniforms.uZen.value.set(PAL.fog ? '#8fa9ba' : '#3a8fe6'); skyMat.uniforms.uMid.value.set(PAL.fog ? '#b3c4cc' : '#62b8f2'); skyMat.uniforms.uLow.value.set(PAL.fog ? '#cfd8d8' : '#bde3f7');
      occH = new Float32Array(m.W * m.H);
      buildLand(); buildTerrain(); buildWater(); buildStatics(); buildTrees(); buildGrass(); buildBuildings(); buildMovables(); buildFar();
      clouds.position.set(m.W / 2, 0, m.H / 2); clouds.updateMatrix();
      world.add(sky, clouds, blobs);
      if (life) world.add(life);
      flies.forEach(f => { world.add(f.o); f.t0 = -1e9; });
      m.npcs.forEach(addPerson);
      world.add(player.root, fol.root, bike, ripple, hintS);
      sparkS.forEach(sp => world.add(sp));
      hintS.visible = false; bike.visible = false; ripple.visible = false;
      sun.position.copy(SUN_DIR).multiplyScalar(42); sun.target.position.set(0, 0, 0);
      camT.x = -999; snapKey = ''; jumpP.on = false; jumpF.on = false;
      resize();
      // 着色器先编译好（不然第一帧、第一次出现某种东西时会卡一下）
      try { if (rt) renderer.setRenderTarget(rt); renderer.compile(scene, camera); renderer.setRenderTarget(null); } catch (e) { /* 编译不了就等画的时候再编 */ }
    }

    // ---------- 镜头：跟在主角身后（南边）上方，朝北看；地平线在画面上面四分之一左右，主角在中间偏下 ----------
    const CAM = { phi: 0, dl: 0, D: 11, frac: .1, cur: 0 };
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
      lifeMat.uniforms.uPx.value = VH * dpr / (2 * tH);
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
      setFrame(player, V.pdir, V.pmoving ? 1 + (Math.floor(now / 85) % 2) : 0);
      player.root.position.set(px, py, pz);
      player.mesh.position.y = V.hop + (V.surf ? .36 + Math.sin(t * 2.2) * .03 : V.bike ? .16 : 0);
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
      for (let i = 0; i < V.npcs.length; i++) {
        const q = V.npcs[i], s = sprites.get(q.n) || addPerson(q.n);   // 剧情里临时出现的人现加
        s.seen = seenTick;
        if (q.mon) iconSheet(s, q.mon, 1.05); else setLook(s, q.look);
        s.rx += (q.x - s.rx) * kN; s.ry += (q.y - s.ry) * kN;
        const sx = s.rx + .5, sz = s.ry + .5, sy = L.at(sx, sz), walking = Math.abs(q.x - s.rx) + Math.abs(q.y - s.ry) > .05;
        if (q.mon) { if (s.mesh) s.mesh.position.y = Math.abs(Math.sin(now / 110)) * .12; } else setFrame(s, q.face, walking ? 1 + (Math.floor(now / 90) % 2) : 0);
        s.root.position.set(sx, sy, sz);
        s.root.visible = true;
        blobAt(sx, sy, sz + .02, .76, .44);
        // 离镜头远的牌子放大一点，不然看不清
        const bs = clamp((cpz - sz) / 11, 1, 2.3);
        if (q.alert) { if (!s.alert) { s.alert = bubble(alertMat); s.root.add(s.alert); } s.alert.visible = true; s.alert.position.set(0, 1.5 + .2 * bs, 0); s.alert.scale.setScalar(bs); }
        else if (s.alert) s.alert.visible = false;
        // 这个人有委托：头上一个金色的「?」，轻轻上下浮（「!」出来时先让开）
        if (q.quest && !q.alert) { if (!s.quest) { s.quest = bubble(questMat); s.root.add(s.quest); } s.quest.visible = true; s.quest.position.set(0, 1.52 + .22 * bs + Math.sin(now / 260 + q.x) * .05, 0); s.quest.scale.setScalar(bs); }
        else if (s.quest) s.quest.visible = false;
      }
      for (let i = 0; i < spriteList.length; i++) if (spriteList[i].seen !== seenTick) spriteList[i].root.visible = false;
      // 地上的道具
      for (let i = 0; i < pickS.length; i++) {
        const ps = pickS[i], on = V.picks.includes(ps.p);
        ps.o.visible = on;
        if (on) { const gy = L.at(ps.p.x + .5, ps.p.y + .55); ps.o.position.y = gy + .03 + Math.sin(now / 320 + ps.p.x) * .04; blobAt(ps.p.x + .5, gy, ps.p.y + .57, .44, .26); }
      }
      // A 键提示
      hintS.visible = !!V.hint;
      if (V.hint) { const hx = V.hint.x + .5, hz = V.hint.y + .5, hc = tIn(V.hint.x, V.hint.y), door = hc !== '' && BUILD.includes(hc); hintS.position.set(hx, L.at(hx, hz + (door ? .6 : 0)) + (door ? 1.32 : 1.62) + Math.sin(now / 220) * .06, hz + (door ? .5 : 0)); }
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
      need = Math.min(need, .8);
      // 主角面朝北、面前一格站着人（要和 TA 说话）：镜头也抬高（俯角约 41°），不然主角的背影正好把对面的人挡住
      if (!V.pmoving && V.pdir === 'up') { const tx = Math.round(V.px), ty = Math.round(V.py) - 1; for (let i = 0; i < V.npcs.length; i++) if (V.npcs[i].x === tx && V.npcs[i].y === ty) { need = Math.max(need, .72); break; } }
      CAM.cur = snapCam || !CAM.cur ? need : CAM.cur + (need - CAM.cur) * (1 - Math.exp(-dt * (need > CAM.cur ? 5 : 2.5)));
      const cz = camT.z + Math.cos(CAM.cur) * CAM.D;
      let cy = fy0 + Math.sin(CAM.cur) * CAM.D;
      // 不钻进山里：镜头脚下、镜头前面一点的地面再高也留出空隙（慢慢抬上去，不跳）
      const lift = Math.max(0, Math.max(L.ground(camT.x, cz), L.ground(camT.x, cz - 2)) + 1.6 - cy);
      camLift += (lift - camLift) * (1 - Math.exp(-dt * 5));
      cy += camLift;
      camera.position.set(camT.x, cy, cz);
      camera.rotation.set(-(Math.atan2(cy - fy0, cz - camT.z) - CAM.phi), 0, 0);
      U.uPlayer.value.set(px, py, pz);
      fadeBuildings(dt, px, py, pz);
      lifeMat.uniforms.uCen.value.set(camT.x, camT.y, camT.z - 7);
      // 主角在画面上的位置（给「圆窗」用）：圆心在主角腰上，半径比主角高一点
      camera.updateMatrixWorld();
      _v.set(px, py + .62 + V.hop, pz).applyMatrix4(camera.matrixWorldInverse);
      const pd = -_v.z;
      _v.applyMatrix4(camera.projectionMatrix);
      U.uHole.value.set((_v.x * .5 + .5) * bufW, (_v.y * .5 + .5) * bufH, CAM.frac * .86 * bufH, pd - .55); U.uHoleY.value = py + .38;
      // 草：太远的那几条不画
      for (let i = 0; i < grassBands.length; i++) { const b = grassBands[i], s = b.boundingSphere; b.visible = !s || camT.z - s.center.z - s.radius < GRASS_FAR; }
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
    const GRASS_FAR = tier === 'high' ? 52 : tier === 'mid' ? 38 : 26;
    function destroy() {
      clear();
      scene.remove(world);
      folDrop(); dropMesh(fol.icon); dropMesh(player);
      Object.values(atlasCache).forEach(t => t.dispose());
      Object.values(spriteMats).forEach(x => x.dispose());
      keep.forEach(x => x.dispose && x.dispose());
      if (rt) { rt.dispose(); if (post.dtex) post.dtex.dispose(); if (post.a) { post.a.dispose(); post.b.dispose(); } post.bright.dispose(); post.blur.dispose(); post.comp.dispose(); post.quad.geometry.dispose(); }
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove();
    }
    return {
      kind: '3d', canvas, load, resize, draw, destroy, glState, info: () => renderer.info,
      // marks：现在画着几块委托的「?」牌子；probe：测试和 tools/look 用（地面多高、人站在哪、跟着走的是模型还是纸片）
      marks: () => spriteList.filter(s => s.quest && s.quest.visible && s.root.visible).length,
      // 场景里每个网格多少三角形（按多到少），查「哪样东西最费」用
      stats: () => { const out = []; world.traverse(o => { const g = o.geometry; if (!g || !o.visible) return; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); out.push([Math.round(n), o.isInstancedMesh ? o.count : 1, (o.material.userData.o || {}).key || o.material.type]); }); return out.sort((a, b) => b[0] - a[0]).slice(0, 24); },
      probe: () => ({
        at: (x, z) => LAND.at(x, z), ground: (x, z) => LAND.ground(x, z), step: LAND.step, sea: LAND.SEA,
        player: player.root.position.toArray(), hop: player.mesh ? player.mesh.position.y : 0, follower: fol.root.visible ? fol.root.position.toArray() : null, model: !!fol.R, icon: !fol.R && !!fol.icon.mesh,
        people: spriteList.filter(s => s.root.visible).map(s => s.root.position.toArray()), picks: pickS.filter(p => p.o.visible).map(p => p.o.position.toArray()),
        hint: hintS.visible ? hintS.position.toArray() : null, cam: camera.position.toArray(), pitch: -camera.rotation.x, fov: camera.fov, hole: U.uHole.value.toArray(), alerts: spriteList.filter(s => s.alert && s.alert.visible && s.root.visible).length, buildings: BLD.length, faded: BLD.filter(b => b.cur > .4).length,
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
