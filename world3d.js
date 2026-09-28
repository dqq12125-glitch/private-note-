// 回声岛 · 2.5D 大地图画面（three.js，类似 HD-2D）：3D 地形和房子 + 2D 纸片人物 + 移轴景深
// 画质档位：high 精美 / mid 标准 / low 省电。创建失败（没有 WebGL2）时返回 null，world.js 会退回 2D
(function () {
  'use strict';

  const TIERS = {
    high: { dpr: 2, shadow: 2048, soft: true, post: true, taps: 16, tex: 48, cell: 128 },
    mid: { dpr: 1.5, shadow: 1024, soft: false, post: true, taps: 10, tex: 32, cell: 96 },
    low: { dpr: 1, shadow: 0, soft: false, post: false, taps: 0, tex: 24, cell: 64 },
  };
  const DIRI = { down: 0, left: 1, right: 2, up: 3 };
  const FOV = 30;

  function create(view, tier, A) {
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
    renderer.shadowMap.enabled = !!Q.shadow;
    renderer.shadowMap.type = Q.soft ? T3.PCFSoftShadowMap : T3.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = T3.NoToneMapping;
    renderer.info.autoReset = false;

    const scene = new T3.Scene();
    const camera = new T3.PerspectiveCamera(FOV, 1, 0.5, 200);
    const hemi = new T3.HemisphereLight(0xeaf6ff, 0x7fae6a, 1.6);
    const sun = new T3.DirectionalLight(0xfff1d8, 2.1);
    const lamp = new T3.PointLight(0xffd9a0, 0, 9, 1.2);
    scene.add(hemi, sun, sun.target, lamp);
    if (Q.shadow) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 15, bottom: -15, near: 1, far: 60 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 0.02;
    }

    // ---------- 后期：移轴景深 + 调色 + 暗角（洞穴里只照亮主角周围） ----------
    let rt = null, post = null;
    if (Q.post) {
      rt = new T3.WebGLRenderTarget(4, 4, { samples: 4, colorSpace: T3.SRGBColorSpace, depthBuffer: true });
      const mat = new T3.ShaderMaterial({
        uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new T3.Vector2(1, 1) }, uFocus: { value: .45 }, uBand: { value: .16 }, uBlur: { value: 5 }, uVig: { value: .55 }, uCenter: { value: new T3.Vector2(.5, .5) }, uDark: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uBlur, uVig, uDark; uniform vec2 uCenter; varying vec2 vUv;',
          'void main(){',
          '  vec3 col = texture2D(tDiffuse, vUv).rgb;',
          '  float dy = vUv.y - uFocus; float amt = smoothstep(uBand, uBand + 0.45, dy > 0.0 ? dy : -dy * 1.4);',
          '  if (amt > 0.01) {',
          '    vec3 acc = col; float n = 1.0;',
          '    for (int i = 0; i < ' + Q.taps + '; i++) {',
          '      float a = float(i) * 2.39996; float r = sqrt((float(i) + 0.5) / ' + Q.taps + '.0);',
          '      acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * uBlur * amt / uRes).rgb; n += 1.0;',
          '    }',
          '    col = acc / n;',
          '  }',
          '  float l = dot(col, vec3(0.299, 0.587, 0.114));',
          '  col = mix(vec3(l), col, 1.12) * vec3(1.02, 1.0, 0.97);',
          '  vec2 q = vUv - 0.5; col *= 1.0 - uVig * dot(q, q) * 1.5;',
          '  if (uDark > 0.0) { float d = length((vUv - uCenter) * vec2(uRes.x / uRes.y, 1.0)); col *= mix(1.0, 0.1 + 0.9 * smoothstep(0.58, 0.14, d), uDark); }',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <colorspace_fragment>',
          '}',
        ].join('\n'),
        depthTest: false, depthWrite: false,
      });
      const quad = new T3.Mesh(new T3.PlaneGeometry(2, 2), mat);
      quad.frustumCulled = false;
      post = { scene: new T3.Scene(), cam: new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
      post.scene.add(quad);
    }

    // ---------- 共用材质 ----------
    const U = { uTime: { value: 0 }, uPlayer: { value: new T3.Vector3(-99, 0, -99) } };
    // amp：随风摆动的幅度；occ：挡在主角和镜头之间时变成半透明（网点镂空）
    const windy = (mat, amp, key, occ) => {
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = U.uTime; sh.uniforms.uPlayer = U.uPlayer;
        const v = ['#include <begin_vertex>', 'vOcc = 0.0;', '#ifdef USE_INSTANCING', 'vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);'];
        if (amp) v.push('transformed.x += sin(uTime * 1.9 + ip.x * 0.8 + ip.z * 0.6) * ' + amp + ' * max(0.0, transformed.y);', 'transformed.z += cos(uTime * 1.3 + ip.x * 0.5) * ' + (amp * .4).toFixed(3) + ' * max(0.0, transformed.y);');
        if (occ) v.push('float oz = ip.z - uPlayer.z, ox = abs(ip.x - uPlayer.x);', 'vOcc = step(0.15, oz) * step(oz, 2.9) * step(ox, 1.25);');
        v.push('#endif');
        sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer; varying float vOcc;\n' + sh.vertexShader.replace('#include <begin_vertex>', v.join('\n'));
        if (occ) sh.fragmentShader = 'varying float vOcc;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vOcc > 0.5 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;');
      };
      mat.customProgramCacheKey = () => key;
      return mat;
    };
    const vcol = new T3.MeshLambertMaterial({ vertexColors: true });
    const vcolFlat = new T3.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const grassMat = windy(new T3.MeshLambertMaterial({ vertexColors: true, side: T3.DoubleSide }), 0.16, 'grass');
    const leafMat = windy(new T3.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.018, 'leaf', true);
    const trunkMat = windy(new T3.MeshLambertMaterial({ vertexColors: true }), 0, 'trunk', true);
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new T3.CanvasTexture(c);
    })();
    const blobMat = new T3.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const blobGeo = new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

    // ---------- 几何小工具 ----------
    const C = h => new T3.Color(h);
    // 带颜色的盒子：顶面一种颜色，侧面一种颜色，底部往上
    function cbox(w, h, d, side, top, base) {
      const g = new T3.BoxGeometry(w, h, d);
      g.translate(0, h / 2, 0);
      const n = g.attributes.normal, p = g.attributes.position, col = new Float32Array(n.count * 3);
      const cs = C(side), ct = C(top || side), cb = C(base || side);
      for (let i = 0; i < n.count; i++) {
        const c = n.getY(i) > .5 ? ct : (base && p.getY(i) < h * .3 ? cb : cs);
        const k = n.getX(i) > .5 || n.getZ(i) < -.5 ? .86 : 1;
        col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      }
      g.setAttribute('color', new T3.BufferAttribute(col, 3));
      return g;
    }
    function tint(g, hex, k) {
      const c = C(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r * (k || 1); col[i * 3 + 1] = c.g * (k || 1); col[i * 3 + 2] = c.b * (k || 1); }
      g.setAttribute('color', new T3.BufferAttribute(col, 3));
      return g;
    }
    // 人字形屋顶（屋脊沿 x 方向）
    function gable(w, d, h) {
      const hw = w / 2, hd = d / 2, A = [-hw, 0, hd], B = [hw, 0, hd], Cc = [hw, h, 0], D = [-hw, h, 0], Ee = [-hw, 0, -hd], F = [hw, 0, -hd];
      const tri = [A, B, Cc, A, Cc, D, F, Ee, D, F, D, Cc, A, D, Ee, B, F, Cc];
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(tri.flat(), 3));
      g.computeVertexNormals();
      return g;
    }
    function canvasTex(w, h, fn) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      fn(c.getContext('2d'), w, h);
      const t = new T3.CanvasTexture(c);
      t.colorSpace = T3.SRGBColorSpace;
      t.anisotropy = 4;
      own.push(t);
      return t;
    }

    // ---------- 每张地图的内容 ----------
    let world = null, m = null, own = [];
    const sprites = [];            // 人物纸片
    const atlasCache = {};         // 造型 → 动作图集
    let player = null, follower = null, hintS = null, alertTex = null, hintTex = null, pickSprites = [];
    const camT = new T3.Vector3(), camGoal = new T3.Vector3();
    let VW = 1, VH = 1, dist = 22, pitch = 50 * Math.PI / 180, lastT = 0, snap = '';

    function add(o) { world.add(o); return o; }
    function mesh(geo, mat, x, y, z, cast) {
      const o = new T3.Mesh(geo, mat); o.position.set(x, y, z);
      o.castShadow = !!cast && !!Q.shadow; o.receiveShadow = !!Q.shadow;
      own.push(geo);
      return add(o);
    }
    function inst(geo, mat, list, cast) {
      if (!list.length) return null;
      own.push(geo);
      const im = new T3.InstancedMesh(geo, mat, list.length), o = new T3.Object3D();
      list.forEach((p, i) => {
        o.position.set(p.x, p.y || 0, p.z); o.rotation.set(0, p.ry || 0, 0);
        o.scale.set(p.s || 1, p.sy || p.s || 1, p.s || 1); o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        if (p.c) im.setColorAt(i, p.c);
      });
      im.castShadow = !!cast && !!Q.shadow; im.receiveShadow = !!Q.shadow;
      im.computeBoundingSphere();
      return add(im);
    }
    const rnd = (x, y, s) => A.hsh(x, y, s);
    const at = (x, y) => (m.grid[y] && m.grid[y][x]) || '';

    function clear() {
      if (world) { scene.remove(world); world.traverse(o => { if (o.material && o.material._own) o.material.dispose(); }); }
      own.forEach(o => o.dispose && o.dispose());
      own = [];
      sprites.forEach(s => { if (s.mesh) { s.mesh.geometry.dispose(); s.mesh.material.dispose(); if (s.mesh.material.userData.tex) s.mesh.material.userData.tex.dispose(); } if (s.alert) { s.alert.geometry.dispose(); s.alert.material.dispose(); } });
      sprites.length = 0; pickSprites = [];
      world = new T3.Group();
      scene.add(world);
    }

    function load(map) {
      m = map;
      clear();
      const pal = m.pal, out = m.kind === 'town' || m.kind === 'route';
      // 地面贴图
      const px = Q.tex, tex = canvasTex(m.W * px, m.H * px, g => A.paintGround(g, m, px, true));
      const gmat = new T3.MeshLambertMaterial({ map: tex }); gmat._own = true;
      const ground = mesh(new T3.PlaneGeometry(m.W, m.H).rotateX(-Math.PI / 2), gmat, m.W / 2, 0, m.H / 2);
      ground.castShadow = false;
      if (out) {
        const og = new T3.MeshLambertMaterial({ color: A.shade(pal.grass, .86) }); og._own = true;
        mesh(new T3.PlaneGeometry(m.W + 40, m.H + 40).rotateX(-Math.PI / 2), og, m.W / 2, -0.02, m.H / 2);
      }
      scene.background = C(m.kind === 'inside' ? '#1a1410' : m.kind === 'cave' ? '#0d0907' : A.shade(pal.tree, .55));
      buildTrees(); buildGrass(); buildWater(); buildRocks(); buildBuildings(); buildProps(); buildIndoor();
      // 灯光
      const cave = m.kind === 'cave', inside = m.kind === 'inside';
      hemi.intensity = cave ? .8 : inside ? 1.9 : 1.6;
      hemi.color.set(cave ? '#8a7a70' : '#eaf6ff'); hemi.groundColor.set(cave ? '#2a2018' : inside ? '#b8a48c' : '#7fae6a');
      sun.intensity = cave ? .15 : inside ? 1.2 : 2.1;
      lamp.intensity = cave ? 14 : 0;
      pitch = (inside ? 56 : 52) * Math.PI / 180;
      // 人物
      m.npcs.forEach(n => sprites.push(person(n)));
      m.picks.forEach(p => pickSprites.push(pickSprite(p)));
      if (!player) player = person(null, true);
      world.add(player.root);
      if (!follower) follower = monSprite();
      world.add(follower.root);
      if (!hintS) hintS = bubbleSprite('A', '#e53935');
      world.add(hintS);
      camT.set(-999, 0, 0);
      snap = '';
      resize();
    }

    // ---------- 树 ----------
    function buildTrees() {
      if (m.kind !== 'town' && m.kind !== 'route') return;
      const pal = m.pal, list = [];
      const push = (x, y, big) => {
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9);
        list.push({ x: x + .5 + (big ? (r - .5) * .35 : (r - .5) * .1), z: y + .5 + (big ? (r2 - .5) * .3 : 0), s: (big ? 1.2 : 1) * (.88 + r * .24), ry: r2 * 6.28, k: .85 + r2 * .3 });
      };
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { const c = at(x, y); if (c === '#' || c === 'T') push(x, y, c === '#'); }
      // 地图外面再种三圈，镜头看过去是一片森林
      for (let y = -4; y < m.H + 4; y++) for (let x = -4; x < m.W + 4; x++) {
        if (x >= 0 && x < m.W && y >= 0 && y < m.H) continue;
        const ex = m.grid[Math.max(0, Math.min(m.H - 1, y))][Math.max(0, Math.min(m.W - 1, x))];
        if ((y < 0 || y >= m.H) && '^v'.includes(ex)) continue;
        push(x, y, true);
      }
      const trunk = new T3.CylinderGeometry(.08, .12, .6, 6).translate(0, .3, 0);
      tint(trunk, '#6d4121');
      const crown = new T3.IcosahedronGeometry(.5, tier === 'low' ? 0 : 1).translate(0, .95, 0);
      const top = new T3.IcosahedronGeometry(.32, tier === 'low' ? 0 : 1).translate(-.06, 1.34, .04);
      tint(crown, pal.tree); tint(top, pal.snow ? '#f4f9fb' : pal.treeHi);
      inst(trunk, trunkMat, list, true);
      inst(crown, leafMat, list.map(p => Object.assign({}, p, { c: new T3.Color(p.k, p.k, p.k) })), true);
      inst(top, leafMat, list.map(p => Object.assign({}, p, { c: new T3.Color(p.k, p.k, p.k) })), true);
      if (!Q.shadow) inst(blobGeo, blobMat, list.map(p => ({ x: p.x, y: .02, z: p.z, s: 1.3 * p.s })), false);
    }

    // ---------- 草丛：一簇簇会随风摆的草叶 ----------
    let tuftGeo = null;
    function tuft(pal) {
      const pos = [], col = [], base = C(pal.blade), tip = C(pal.tall).multiplyScalar(1.18);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.28 + Math.sin(i * 7.1) * .4, r = .06 + (i % 3) * .08, bx = Math.cos(a) * r, bz = Math.sin(a) * r;
        const h = .3 + ((i * 37) % 11) / 11 * .2, w = .055, lean = Math.cos(a) * .08;
        const ox = Math.cos(a + 1.57) * w, oz = Math.sin(a + 1.57) * w;
        pos.push(bx - ox, 0, bz - oz, bx + ox, 0, bz + oz, bx + lean, h, bz + Math.sin(a) * .06);
        col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
      }
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    }
    function buildGrass() {
      const list = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (at(x, y) !== ',') continue;
        [[.25, .3], [.72, .28], [.5, .62], [.22, .85], [.78, .84]].forEach(([fx, fz], k) => list.push({ x: x + fx + (rnd(x, y, k) - .5) * .12, z: y + fz, s: .95 + rnd(y, x, k) * .35, ry: rnd(x + k, y, 3) * 6.28 }));
      }
      if (!list.length) return;
      tuftGeo = tuft(m.pal);
      inst(tuftGeo, grassMat, list, false);
    }

    // ---------- 水：半透明、有波光，靠岸的地方渐渐透明 ----------
    function buildWater() {
      const isW = (x, y) => at(x, y) === '~';
      const pos = [], edge = [], idx = [];
      const corner = (x, y) => (isW(x - 1, y - 1) && isW(x, y - 1) && isW(x - 1, y) && isW(x, y)) ? 1 : 0;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (!isW(x, y)) continue;
        const b = pos.length / 3;
        [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].forEach(([cx, cy]) => { pos.push(cx, .03, cy); edge.push(corner(cx, cy) * .75 + .25 * (isW(x, y) ? 1 : 0)); });
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
      if (!pos.length) return;
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('aEdge', new T3.Float32BufferAttribute(edge, 1));
      g.setIndex(idx);
      const cave = m.kind === 'cave';
      const mat = new T3.ShaderMaterial({
        uniforms: { uTime: U.uTime, uDeep: { value: C(cave ? '#10304a' : '#2a8cc4') }, uShallow: { value: C(cave ? '#23577a' : '#7fd6f2') } },
        vertexShader: 'attribute float aEdge; varying float vE; varying vec2 vW; void main(){ vE = aEdge; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform float uTime; uniform vec3 uDeep, uShallow; varying float vE; varying vec2 vW;',
          'void main(){',
          '  float w = sin(vW.x * 2.3 + uTime * 1.2) * 0.5 + sin(vW.y * 3.1 - uTime * 0.9 + vW.x) * 0.5;',
          '  float s = smoothstep(0.86, 0.99, sin(vW.x * 5.3 + uTime * 1.7) * sin(vW.y * 4.1 - uTime * 1.3 + vW.x * 0.7));',
          '  vec3 c = mix(uShallow, uDeep, smoothstep(0.3, 1.0, vE)) + w * 0.035 + s * 0.55;',
          '  gl_FragColor = vec4(c, 0.35 + 0.5 * vE);',
          '  #include <colorspace_fragment>',
          '}',
        ].join('\n'),
        transparent: true, depthWrite: false,
      });
      mat._own = true;
      mesh(g, mat, 0, 0, 0, false).receiveShadow = false;
    }

    // ---------- 岩壁、石头、台阶、洞口、洞穴墙 ----------
    // 石头侧面的贴图：一层层的岩石纹理
    function rockTex(col) {
      return canvasTex(64, 64, g => {
        g.fillStyle = col; g.fillRect(0, 0, 64, 64);
        for (let k = 0; k < 7; k++) {
          const y = 4 + k * 9 + (k % 2) * 2;
          g.fillStyle = A.shade(col, .78); g.fillRect(0, y + 6, 64, 2);
          for (let x = (k % 2) * 9; x < 64; x += 14 + ((k * 5) % 7)) { g.fillStyle = A.shade(col, k % 3 ? 1.1 : .9); A.rr(g, x + 1, y, 11, 6, 3); g.fill(); }
        }
      });
    }
    function rockMats(side, top) {
      const sm = new T3.MeshLambertMaterial({ map: rockTex(side) }), tm = new T3.MeshLambertMaterial({ color: top });
      sm._own = tm._own = true;
      own.push(sm, tm);
      return [sm, sm, tm, sm, sm, sm];
    }
    function buildRocks() {
      const pal = m.pal, cave = m.kind === 'cave';
      const cliff = [], boulders = [], ledges = [], walls = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y), r = rnd(x, y, 5);
        if (c === 'R' || c === 'K') cliff.push({ x: x + .5, z: y + .5, sy: 1.1 + r * .35 });
        else if (c === 'X') walls.push({ x: x + .5, z: y + .5, sy: 1.2 + r * .5 });
        else if (c === 'r') boulders.push({ x: x + .5, z: y + .55, s: .8 + r * .3, ry: r * 6 });
        else if (c === 'L') ledges.push({ x: x + .5, z: y + .72 });
        if (c === 'K') {
          // 洞口：石框 + 黑色拱门
          const arch = canvasTex(64, 64, g => {
            g.fillStyle = A.shade(pal.rock || '#a39b8b', .7); g.beginPath(); g.moveTo(2, 64); g.lineTo(2, 28); g.quadraticCurveTo(32, -12, 62, 28); g.lineTo(62, 64); g.fill();
            g.fillStyle = '#140e0b'; g.beginPath(); g.moveTo(12, 64); g.lineTo(12, 32); g.quadraticCurveTo(32, 4, 52, 32); g.lineTo(52, 64); g.fill();
          });
          const am = new T3.MeshBasicMaterial({ map: arch, transparent: true }); am._own = true;
          mesh(new T3.PlaneGeometry(.96, .96), am, x + .5, .48, y + 1.005, false);
        }
      }
      const box = () => new T3.BoxGeometry(1, 1, 1).translate(0, .5, 0);
      inst(box(), rockMats(pal.rock || '#a39b8b', pal.grass || '#8fd16a'), cliff, true);
      inst(box(), rockMats(cave ? '#8a7260' : '#6b5a4b', cave ? '#3a2d24' : '#5b4a3d'), walls, true);
      const bg = new T3.IcosahedronGeometry(.36, 0).translate(0, .26, 0);
      tint(bg, cave ? pal.wallTop : (pal.rock || '#a39b8b'));
      inst(bg, vcolFlat, boulders, true);
      inst(cbox(1.01, .22, .56, A.shade(pal.grass || '#8fd16a', .66), A.shade(pal.grass || '#8fd16a', .92)), vcol, ledges, false);
    }

    // ---------- 房子 ----------
    function buildBuildings() {
      Object.entries(m.buildings || {}).forEach(([L, b]) => {
        const house = L === 'H' || L === 'J', gym = L === 'G';
        const x0 = b.x0, x1 = b.x1 + 1, z0 = b.y0, z1 = b.y1 + 1, w = x1 - x0, cx = (x0 + x1) / 2;
        const front = z1 - .06, back = z0 + .3, d = front - back, cz = (front + back) / 2;
        const wallH = gym ? 1.75 : house ? 1.25 : 1.45, roofH = gym ? .7 : .8;
        const roofC = A.buildColor(L, m), wallC = L === 'C' ? '#fff6ea' : L === 'M' ? '#f2f8ff' : house ? '#fff8ec' : '#fbf1de';
        mesh(cbox(w - .24, wallH, d, wallC, wallC, A.shade(wallC, .84)), vcol, cx, 0, cz, true);
        const rg = gable(w + .1, d + .5, roofH); tint(rg, roofC);
        mesh(rg, vcolFlat, cx, wallH, cz, true);
        mesh(cbox(w + .14, .09, .16, A.shade(roofC, 1.18)), vcol, cx, wallH + roofH - .05, cz, false);
        if (house) mesh(cbox(.22, .5, .22, A.shade(roofC, .7)), vcol, x1 - .8, wallH + .25, cz - .1, true);
        // 门
        const dx = b.door.x + .5;
        const doorT = canvasTex(64, 96, g => {
          g.fillStyle = '#6b4a36'; A.rr(g, 4, 6, 56, 90, [22, 22, 0, 0]); g.fill();
          g.fillStyle = L === 'C' ? '#c9ecff' : '#8d6e63'; A.rr(g, 12, 14, 40, 82, [16, 16, 0, 0]); g.fill();
          if (L === 'C' || L === 'M') { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(31, 14, 2, 82); }
          g.fillStyle = '#ffd54f'; A.circ(g, 44, 58, 4); g.fill();
        });
        const dm = new T3.MeshLambertMaterial({ map: doorT, transparent: true }); dm._own = true;
        mesh(new T3.PlaneGeometry(.62, .93), dm, dx, .465, front + .012, false);
        // 窗户
        const winT = canvasTex(64, 52, g => {
          g.fillStyle = '#ffffff'; A.rr(g, 0, 0, 64, 52, 8); g.fill();
          g.fillStyle = '#8fd3f4'; A.rr(g, 6, 6, 52, 40, 5); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(30, 6, 4, 40); g.fillRect(6, 24, 52, 4);
          g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(10, 40); g.lineTo(20, 10); g.lineTo(26, 10); g.lineTo(16, 40); g.fill();
        });
        const wm = new T3.MeshLambertMaterial({ map: winT, emissive: 0x223344 }); wm._own = true;
        const wy = wallH * .55;
        [x0 + .75, x1 - .75].forEach(wx => { if (Math.abs(wx - dx) > .7) mesh(new T3.PlaneGeometry(.5, .4), wm, wx, wy, front + .012, false); });
        // 招牌
        if (!house) {
          const label = L === 'C' ? 'CENTER' : L === 'M' ? 'SHOP' : 'GYM';
          const signT = canvasTex(256, 72, g => {
            g.fillStyle = '#ffffff'; A.rr(g, 2, 2, 252, 68, 34); g.fill();
            g.lineWidth = 5; g.strokeStyle = A.shade(roofC, .7); g.stroke();
            g.fillStyle = roofC; g.font = '800 44px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(label, 138, 40);
            if (L === 'C') { g.fillRect(24, 30, 30, 12); g.fillRect(33, 21, 12, 30); }
            if (L === 'G') { g.fillStyle = '#ffc53d'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 8 : 18; g.lineTo(38 + Math.cos(a) * r, 37 + Math.sin(a) * r); } g.fill(); }
          });
          const sm = new T3.MeshLambertMaterial({ map: signT, transparent: true, emissive: 0x222222 }); sm._own = true;
          const sw = Math.min(w - .5, 1.9);
          mesh(new T3.PlaneGeometry(sw, sw * 72 / 256), sm, cx, wallH - .22, front + .02, false);
        }
        // 商店的条纹遮阳棚
        if (L === 'M') {
          const awT = canvasTex(128, 32, g => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : roofC; g.fillRect(k * 16, 0, 16, 32); } });
          const am = new T3.MeshLambertMaterial({ map: awT, side: T3.DoubleSide }); am._own = true;
          const aw = mesh(new T3.PlaneGeometry(w - .5, .45), am, cx, wallH * .72, front + .2, true);
          aw.rotation.x = -1.0;
        }
      });
    }

    // ---------- 告示牌、道具球等户外小物件 ----------
    function buildProps() {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (at(x, y) !== 'B') continue;
        const cx = x + .5, cz = y + .55;
        mesh(cbox(.07, .5, .07, '#8a5a33'), vcol, cx - .2, 0, cz, true);
        mesh(cbox(.07, .5, .07, '#8a5a33'), vcol, cx + .2, 0, cz, true);
        const st = canvasTex(96, 56, g => {
          g.fillStyle = '#d7a86e'; A.rr(g, 2, 2, 92, 52, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = '#8a5a33'; g.stroke();
          g.fillStyle = '#8a5a33'; g.fillRect(16, 16, 64, 5); g.fillRect(16, 26, 48, 5); g.fillRect(16, 36, 56, 5);
        });
        const sm = new T3.MeshLambertMaterial({ map: st }); sm._own = true;
        mesh(new T3.BoxGeometry(.72, .42, .06), sm, cx, .62, cz, true);
      }
    }

    // ---------- 室内：墙、柜台、电脑、桌子、书架、盆栽、床、电视、雕像 ----------
    function buildIndoor() {
      if (m.kind !== 'inside') return;
      const p = m.pal, tall = [], low = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y);
        if (c !== 'W') continue;
        (y === m.H - 1 ? low : tall).push({ x: x + .5, z: y + .5 });
      }
      inst(cbox(1, 2.1, 1, p.wall, '#4e3a2c', p.trim), vcol, tall, true);
      inst(cbox(1, .25, 1, p.wall, '#4e3a2c'), vcol, low, false);
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y), cx = x + .5, cz = y + .5;
        if (c === 'Q') { mesh(cbox(1.02, .72, .8, '#b77a4a', '#e0a370'), vcol, cx, 0, cz, true); }
        else if (c === 'P') {
          mesh(cbox(.8, .6, .6, '#90a4ae', '#b0bec5'), vcol, cx, 0, cz, true);
          mesh(cbox(.62, .46, .12, '#263238'), vcol, cx, .62, cz - .1, true);
          const sm = new T3.MeshBasicMaterial({ color: '#4fc3f7' }); sm._own = true;
          const s = mesh(new T3.PlaneGeometry(.52, .36), sm, cx, .85, cz - .03, false); s.rotation.y = 0;
        } else if (c === 'Y') {
          mesh(cbox(.86, .42, .76, '#c28e5c', '#d9a877'), vcol, cx, 0, cz, true);
          mesh(cbox(.2, .12, .2, '#fff3e0'), vcol, cx, .42, cz, false);
        } else if (c === 'k') {
          const bt = canvasTex(64, 96, g => {
            g.fillStyle = '#6d4c41'; g.fillRect(0, 0, 64, 96);
            ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8'].forEach((b, i) => { g.fillStyle = b; g.fillRect(6 + i * 11, 10, 9, 32); g.fillRect(6 + ((i + 2) % 5) * 11, 54, 9, 32); });
            g.fillStyle = '#4e342e'; g.fillRect(0, 44, 64, 6);
          });
          const bm = new T3.MeshLambertMaterial({ map: bt }); bm._own = true;
          mesh(cbox(.92, 1.6, .5, '#8d6e63', '#a1887f'), vcol, cx, 0, cz - .2, true);
          mesh(new T3.PlaneGeometry(.8, 1.4), bm, cx, .8, cz + .055, false);
        } else if (c === 'p') {
          mesh(new T3.CylinderGeometry(.18, .14, .32, 8).translate(0, .16, 0), new T3.MeshLambertMaterial({ color: '#a1887f' }), cx, 0, cz, true).material._own = true;
          const lg = new T3.IcosahedronGeometry(.3, 1).translate(0, .55, 0); tint(lg, '#43a047');
          mesh(lg, vcolFlat, cx, 0, cz, true);
        } else if (c === 'd') {
          mesh(cbox(.9, .38, .96, '#90caf9', '#bbdefb'), vcol, cx, 0, cz, true);
          if (at(x, y - 1) !== 'd') mesh(cbox(.6, .12, .26, '#ffffff'), vcol, cx, .38, cz - .28, false);
        } else if (c === 't') {
          mesh(cbox(.8, .3, .5, '#6d4c41', '#8d6e63'), vcol, cx, 0, cz, true);
          mesh(cbox(.74, .5, .1, '#37474f'), vcol, cx, .3, cz - .1, true);
          const tm = new T3.MeshBasicMaterial({ color: '#80deea' }); tm._own = true;
          mesh(new T3.PlaneGeometry(.64, .4), tm, cx, .55, cz - .045, false);
        } else if (c === 'Z') {
          mesh(cbox(.6, .5, .6, '#b0bec5', '#cfd8dc'), vcol, cx, 0, cz, true);
          const star = new T3.IcosahedronGeometry(.24, 0).translate(0, .78, 0); tint(star, '#ffc53d');
          mesh(star, vcolFlat, cx, 0, cz, true);
        }
      }
    }

    // ---------- 人物纸片 ----------
    function atlas(look) {
      const key = JSON.stringify(look);
      if (atlasCache[key]) return atlasCache[key];
      const t = new T3.CanvasTexture(A.atlas(look, Q.cell));
      t.colorSpace = T3.SRGBColorSpace;
      t.anisotropy = 4;
      return (atlasCache[key] = t);
    }
    function sheet(map, size) {
      const geo = new T3.PlaneGeometry(size, size).translate(0, size / 2, 0);
      const mat = new T3.MeshLambertMaterial({ map, alphaTest: .5, emissive: 0x2a2a2a });
      const o = new T3.Mesh(geo, mat);
      return o;
    }
    function person(n, isPlayer) {
      const root = new T3.Group();
      const look = null;
      const s = { n, root, look, key: '', frame: -1, dir: '', mesh: null, rx: n ? n.x : 0, ry: n ? n.y : 0 };
      const sh = new T3.Mesh(blobGeo, blobMat); sh.scale.set(.75, 1, .45); sh.position.y = .015; root.add(sh);
      if (look) setLook(s, look);
      if (!isPlayer) world.add(root);
      return s;
    }
    function setLook(s, look) {
      const key = JSON.stringify(look);
      if (s.key === key) return;
      if (s.mesh) { s.root.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
      s.mesh = sheet(atlas(look), 1.35);
      s.mesh.rotation.x = -pitch * .8;
      s.root.add(s.mesh);
      s.key = key; s.frame = -1;
    }
    function setFrame(s, dir, frame) {
      if (s.dir === dir && s.frame === frame) return;
      s.dir = dir; s.frame = frame;
      const col = DIRI[dir] || 0, u0 = col / 4, u1 = (col + 1) / 4, vt = 1 - frame / 3, vb = 1 - (frame + 1) / 3;
      const uv = s.mesh.geometry.attributes.uv;
      uv.setXY(0, u0, vt); uv.setXY(1, u1, vt); uv.setXY(2, u0, vb); uv.setXY(3, u1, vb);
      uv.needsUpdate = true;
    }
    // 地图上的野生怪兽（剧情用）
    function setMonOn(s, sp) {
      const key = 'mon:' + sp.en;
      if (s.key === key) return;
      const im = A.monImg(sp);
      if (!im.complete || !im.naturalWidth) return;
      const c = document.createElement('canvas'); c.width = c.height = Q.cell;
      c.getContext('2d').drawImage(im, 0, 0, Q.cell, Q.cell);
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
      if (s.mesh) { s.root.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
      s.mesh = sheet(t, 1.05); s.mesh.rotation.x = -pitch * .8; s.mesh.material.userData.tex = t;
      s.root.add(s.mesh);
      s.key = key;
    }
    function monSprite() {
      const root = new T3.Group();
      const sh = new T3.Mesh(blobGeo, blobMat); sh.scale.set(.7, 1, .4); sh.position.y = .015; root.add(sh);
      return { root, mesh: null, sp: null };
    }
    function setMon(f, sp) {
      if (!sp || f.sp === sp.en) return;
      const im = A.monImg(sp);
      if (!im.complete || !im.naturalWidth) return;
      const c = document.createElement('canvas'); c.width = c.height = Q.cell;
      c.getContext('2d').drawImage(im, 0, 0, Q.cell, Q.cell);
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
      if (f.mesh) { f.root.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.map.dispose(); f.mesh.material.dispose(); }
      f.mesh = sheet(t, 1.05);
      f.mesh.rotation.x = -pitch * .8;
      f.root.add(f.mesh);
      f.sp = sp.en;
    }
    function bubbleSprite(ch, col) {
      const t = canvasTexKeep(64, 64, g => {
        g.fillStyle = 'rgba(0,0,0,.2)'; A.circ(g, 33, 35, 24); g.fill();
        g.fillStyle = '#ffffff'; A.circ(g, 32, 32, 24); g.fill(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
        g.fillStyle = col; g.font = '900 30px "Baloo 2", Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 34);
      });
      const o = new T3.Mesh(new T3.PlaneGeometry(.48, .48), new T3.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }));
      o.renderOrder = 10;
      o.rotation.x = -pitch * .8;
      return o;
    }
    function canvasTexKeep(w, h, fn) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      fn(c.getContext('2d'), w, h);
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
      return t;
    }
    let pickTex = null;
    function pickSprite(p) {
      if (!pickTex) pickTex = canvasTexKeep(64, 64, g => A.drawItemBall(g, 32, 32, 22));
      const o = new T3.Mesh(new T3.PlaneGeometry(.42, .42).translate(0, .21, 0), new T3.MeshLambertMaterial({ map: pickTex, alphaTest: .5, emissive: 0x333333 }));
      o.rotation.x = -pitch * .8;
      own.push(o.geometry, o.material);
      const root = new T3.Group(); root.add(o);
      const sh = new T3.Mesh(blobGeo, blobMat); sh.scale.set(.4, 1, .25); sh.position.y = .015; root.add(sh);
      root.position.set(p.x + .5, 0, p.y + .55);
      world.add(root);
      return { p, root, o };
    }

    // ---------- 镜头 ----------
    function resize() {
      VW = Math.max(1, view.clientWidth); VH = Math.max(1, view.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
      renderer.setPixelRatio(dpr);
      renderer.setSize(VW, VH, false);
      canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
      camera.aspect = VW / VH;
      // 竖屏看 9.5 格宽；横屏看 9 格高；房间里整间屋子都看得到
      const tan = Math.tan(FOV / 2 * Math.PI / 180);
      const wantW = m && m.kind === 'inside' ? Math.min(m.W + 1.2, 8.6) : 9.6;
      dist = camera.aspect < 1.15 ? wantW / (2 * tan * camera.aspect) : (m && m.kind === 'inside' ? m.H + 1 : 9.4) / (2 * tan);
      camera.far = dist * 3;
      camera.updateProjectionMatrix();
      if (rt) {
        rt.setSize(Math.round(VW * dpr), Math.round(VH * dpr));
        post.mat.uniforms.uRes.value.set(VW * dpr, VH * dpr);
        post.mat.uniforms.uBlur.value = (tier === 'high' ? 4.5 : 3.5) * dpr;
      }
    }
    const tmp = new T3.Vector3();
    function draw(now, V) {
      const dt = lastT ? Math.min(.1, (now - lastT) / 1000) : .016; lastT = now;
      U.uTime.value = now / 1000;
      renderer.info.reset();
      // 主角
      setLook(player, V.plook);
      setFrame(player, V.pdir, V.pmoving ? 1 + (Math.floor(now / 85) % 2) : 0);
      player.root.position.set(V.px + .5, 0, V.py + .5);
      player.mesh.position.y = V.hop;
      // 跟着走的怪兽
      follower.root.visible = V.showF;
      if (V.showF) {
        setMon(follower, V.lead);
        const bob = V.pmoving ? Math.abs(Math.sin(now / 90)) * .08 : Math.sin(now / 600) * .02;
        follower.root.position.set(V.fx + .5, 0, V.fy + .5);
        if (follower.mesh) follower.mesh.position.y = bob + V.fhop;
      }
      // 其他人物：位置平滑跟上（训练师走过来时不会一格一格跳）
      const seen = new Set();
      V.npcs.forEach(q => {
        let s = sprites.find(x => x.n === q.n);
        if (!s) { s = person(q.n); sprites.push(s); }   // 剧情里临时出现的人
        seen.add(s);
        if (q.mon) setMonOn(s, q.mon); else setLook(s, q.look);
        const k = 1 - Math.exp(-dt * 14);
        s.rx += (q.x - s.rx) * k; s.ry += (q.y - s.ry) * k;
        const walking = Math.abs(q.x - s.rx) + Math.abs(q.y - s.ry) > .05;
        if (q.mon) { if (s.mesh) s.mesh.position.y = Math.abs(Math.sin(now / 110)) * .12; }
        else setFrame(s, q.face, walking ? 1 + (Math.floor(now / 90) % 2) : 0);
        s.root.position.set(s.rx + .5, 0, s.ry + .5);
        s.root.visible = true;
        if (q.alert) { if (!s.alert) { s.alert = bubbleSprite('!', '#e53935'); s.root.add(s.alert); s.alert.position.set(0, 1.55, 0); } s.alert.visible = true; }
        else if (s.alert) s.alert.visible = false;
      });
      sprites.forEach(s => { if (!seen.has(s)) s.root.visible = false; });
      // 地上的道具
      pickSprites.forEach(ps => {
        const on = V.picks.includes(ps.p);
        ps.root.visible = on;
        if (on) ps.o.position.y = Math.sin(now / 320 + ps.p.x) * .04;
      });
      // A 键提示
      hintS.visible = !!V.hint;
      if (V.hint) hintS.position.set(V.hint.x + .5, 1.6 + Math.sin(now / 220) * .06, V.hint.y + .5);
      // 镜头跟着主角，靠近地图边上时停住
      camGoal.set(V.px + .5, 0, V.py + .5);
      U.uPlayer.value.set(V.px + .5, 0, V.py + .5);
      // 镜头能看到的范围：往北 north 格、往南 south 格、左右各 halfW 格
      const half = FOV / 2 * Math.PI / 180, cy = Math.sin(pitch) * dist, cz = Math.cos(pitch) * dist;
      const north = cy / Math.tan(pitch - half) - cz, south = cz - cy / Math.tan(pitch + half);
      const halfW = dist * Math.tan(half) * camera.aspect;
      const pad = m.kind === 'inside' ? .6 : m.kind === 'cave' ? .8 : 1.6;
      const clamp = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
      camGoal.x = clamp(camGoal.x, halfW - pad, m.W - halfW + pad);
      camGoal.z = clamp(camGoal.z, north - pad, m.H - south + (m.kind === 'inside' ? pad : .2));
      if (camT.x < -900) camT.copy(camGoal);
      else camT.lerp(camGoal, 1 - Math.exp(-dt * 9));
      camera.position.set(camT.x, Math.sin(pitch) * dist, camT.z + Math.cos(pitch) * dist);
      camera.lookAt(camT.x, 0, camT.z);
      // 太阳和影子：影子范围按 2 格对齐，只有移动过才重画影子
      if (Q.shadow) {
        const sx = Math.round(camT.x / 2) * 2, sz = Math.round(camT.z / 2) * 2, key = sx + ',' + sz;
        if (key !== snap) { snap = key; sun.target.position.set(sx, 0, sz - 1); sun.position.set(sx - 7, 16, sz + 6); sun.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true; }
      } else { sun.position.set(camT.x - 7, 16, camT.z + 6); sun.target.position.set(camT.x, 0, camT.z); }
      lamp.position.set(V.px + .5, 1.8, V.py + .8);
      if (post) {
        tmp.set(V.px + .5, .6, V.py + .5).project(camera);
        const u = post.mat.uniforms;
        u.uFocus.value = tmp.y * .5 + .5;
        u.uCenter.value.set(tmp.x * .5 + .5, tmp.y * .5 + .5);
        u.uDark.value = m.kind === 'cave' ? .92 : 0;
        u.uVig.value = m.kind === 'inside' ? .35 : .55;
        u.uBand.value = m.kind === 'inside' ? .3 : .2;
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(post.scene, post.cam);
      } else renderer.render(scene, camera);
    }
    function destroy() {
      clear();
      scene.remove(world);
      Object.values(atlasCache).forEach(t => t.dispose());
      [vcol, vcolFlat, grassMat, leafMat, trunkMat, blobMat].forEach(x => x.dispose());
      shadowTex.dispose(); blobGeo.dispose();
      if (rt) rt.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove();
    }
    return { kind: '3d', load, resize, draw, destroy, info: () => renderer.info };
  }

  window.EchoWorld3D = { create };
})();
