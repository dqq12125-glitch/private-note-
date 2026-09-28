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
    let world = null, m = null, own = [], THEME = {};
    const spinners = [], glows = [];
    const sprites = [];            // 人物纸片
    const atlasCache = {};         // 造型 → 动作图集
    let player = null, follower = null, hintS = null, alertTex = null, hintTex = null, pickSprites = [];
    const camT = new T3.Vector3(), camGoal = new T3.Vector3();
    const room = () => m && m.kind === 'inside' && m.W <= 13 && m.H <= 13;
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
      spinners.length = 0; glows.length = 0; gateM = [];
      for (const k in WALLTEX) delete WALLTEX[k];
      world = new T3.Group();
      scene.add(world);
    }

    function load(map) {
      m = map;
      clear();
      THEME = (window.EchoMaps && EchoMaps.THEMES[m.theme]) || {};
      const pal = m.pal, out = m.kind === 'town' || m.kind === 'route' || m.kind === 'under', sea = !!(m.def && m.def.sea);
      // 地面贴图
      const px = Q.tex, tex = canvasTex(m.W * px, m.H * px, g => A.paintGround(g, m, px, true));
      const gmat = new T3.MeshLambertMaterial({ map: tex }); gmat._own = true;
      const ground = mesh(new T3.PlaneGeometry(m.W, m.H).rotateX(-Math.PI / 2), gmat, m.W / 2, 0, m.H / 2);
      ground.castShadow = false;
      if (out) {
        const og = new T3.MeshLambertMaterial({ color: sea ? '#2f86b8' : A.shade(pal.grass, .86) }); og._own = true;
        mesh(new T3.PlaneGeometry(m.W + 40, m.H + 40).rotateX(-Math.PI / 2), og, m.W / 2, -0.02, m.H / 2);
        if (!sea) {
          const wet = (xs, ys) => { let n = 0, k = 0; xs.forEach(x => ys.forEach(y => { k++; if ('~Dw'.includes(at(x, y)) && at(x, y)) n++; })); return n / Math.max(1, k); };
          const xs = [...Array(m.W).keys()], ys = [...Array(m.H).keys()];
          const wm = new T3.MeshLambertMaterial({ color: '#2f86b8' }); wm._own = true;
          if (wet(xs, [m.H - 1]) > .5) mesh(new T3.PlaneGeometry(m.W + 40, 20).rotateX(-Math.PI / 2), wm, m.W / 2, -0.01, m.H + 10);
          if (wet(xs, [0]) > .5) mesh(new T3.PlaneGeometry(m.W + 40, 20).rotateX(-Math.PI / 2), wm, m.W / 2, -0.01, -10);
          if (wet([0], ys) > .5) mesh(new T3.PlaneGeometry(20, m.H + 40).rotateX(-Math.PI / 2), wm, -10, -0.01, m.H / 2);
          if (wet([m.W - 1], ys) > .5) mesh(new T3.PlaneGeometry(20, m.H + 40).rotateX(-Math.PI / 2), wm, m.W + 10, -0.01, m.H / 2);
        }
      }
      scene.background = C(m.kind === 'inside' ? '#1a1410' : m.kind === 'cave' ? (m.dark ? '#0d0907' : A.shade(pal.wall, .5)) : m.kind === 'under' ? '#0f4c63' : sea ? '#2a7fb0' : A.shade(pal.tree, .55));
      buildTrees(); buildGrass(); buildWater(); buildRocks(); buildBuildings(); buildMarks(); buildProps(); buildIndoor(); buildObst();
      // 灯光：漆黑的洞穴只有主角身边亮；海底是蓝绿色的光
      const dark = !!m.dark, cave = m.kind === 'cave', inside = m.kind === 'inside', under = m.kind === 'under';
      hemi.intensity = dark ? .8 : cave ? 1.5 : inside ? 1.9 : under ? 1.3 : 1.6;
      hemi.color.set(dark ? '#8a7a70' : under ? '#8fe0f0' : '#eaf6ff'); hemi.groundColor.set(dark ? '#2a2018' : cave ? A.shade(pal.floor, .6) : inside ? '#b8a48c' : under ? '#2c6a70' : '#7fae6a');
      sun.intensity = dark ? .15 : cave ? 1.1 : inside ? 1.2 : under ? 1.0 : 2.1;
      sun.color.set(under ? '#bfefff' : THEME.pal && THEME.pal.fog ? '#e8e4d8' : '#fff1d8');
      lamp.intensity = dark ? 14 : 0;
      pitch = (inside && room() ? 56 : 52) * Math.PI / 180;
      // 人物
      m.npcs.forEach(n => sprites.push(person(n)));
      m.picks.forEach(p => pickSprites.push(pickSprite(p)));
      if (!player) player = person(null, true);
      world.add(player.root);
      if (!follower) follower = monSprite();
      world.add(follower.root);
      if (!hintS) hintS = bubbleSprite('A', '#e53935');
      if (!bike) bike = makeBike();
      world.add(bike);
      if (!ripple) { ripple = new T3.Mesh(new T3.TorusGeometry(.5, .04, 6, 28), new T3.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 })); ripple.rotation.x = Math.PI / 2; }
      world.add(ripple);
      sparkS.forEach(sp => world.add(sp));
      world.add(hintS);
      camT.set(-999, 0, 0);
      snap = '';
      resize();
    }

    // ---------- 树：每座岛的树不一样（棕榈、铅笔、秋天的树、松树、棒棒糖、热带大树、枯树……） ----------
    // 把几块几何体拼成一个（都转成不带索引的，带上顶点颜色）
    function merge(parts) {
      const pos = [], nor = [], col = [];
      parts.forEach(([g, hex]) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.computeVertexNormals();
        const c = C(hex || '#ffffff'), P = n.attributes.position, N = n.attributes.normal;
        for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
        if (n !== g) n.dispose();
        g.dispose();
      });
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
      return g;
    }
    const lowPoly = () => tier === 'low' ? 0 : 1;
    // 每种树：trunk 树干（随风不动）、crown 树冠（随风摆、挡住主角时镂空）；tint：树冠要不要按每棵树换颜色
    function treeKit(style, pal) {
      const d = lowPoly();
      const trunkC = style === 'dead' ? '#6b6258' : style === 'palm' ? '#a8793f' : '#6d4121';
      if (style === 'palm') {
        const trunk = merge([[new T3.CylinderGeometry(.07, .11, 1.3, 6).translate(0, .65, 0).rotateZ(.08), trunkC]]);
        const fr = [];
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * 6.28, leaf = new T3.ConeGeometry(.13, .95, 4).rotateZ(Math.PI / 2).scale(1, .35, 1).translate(.45, 0, 0).rotateZ(-.35).rotateY(a);
          fr.push([leaf.translate(-.05, 1.33, 0), k % 2 ? pal.tree : pal.treeHi]);
        }
        fr.push([new T3.IcosahedronGeometry(.13, 0).translate(-.02, 1.25, .04), '#6d4c2f']);
        return { trunk, crown: merge(fr) };
      }
      if (style === 'pencil') {
        return {
          trunk: merge([[new T3.ConeGeometry(.2, .32, 6).translate(0, 1.36, 0), '#f5d7a1'], [new T3.ConeGeometry(.07, .11, 6).translate(0, 1.47, 0), '#37474f'], [new T3.CylinderGeometry(.2, .2, .08, 6).translate(0, .06, 0), '#ef9a9a']]),
          crown: merge([[new T3.CylinderGeometry(.2, .2, 1.1, 6).translate(0, .66, 0), '#ffffff']]), tint: ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da'],
        };
      }
      if (style === 'lolli') {
        return {
          trunk: merge([[new T3.CylinderGeometry(.04, .04, .9, 6).translate(0, .45, 0), '#fffdf5']]),
          crown: merge([[new T3.SphereGeometry(.38, 12, 8).scale(1, 1, .45).translate(0, 1.15, 0), '#ffffff'], [new T3.TorusGeometry(.24, .05, 6, 16).translate(0, 1.15, .17), '#fff3f8']]),
          tint: ['#ff80ab', '#ffd54f', '#80deea', '#b39ddb', '#a5d6a7', '#ffab91'],
        };
      }
      if (style === 'pine' || style === 'snowpine') {
        const snow = style === 'snowpine', parts = [];
        [[.5, .55, .62], [.4, .5, .98], [.28, .42, 1.3]].forEach(([r, h, y]) => {
          parts.push([new T3.ConeGeometry(r, h, 7).translate(0, y, 0), pal.tree]);
          if (snow) parts.push([new T3.ConeGeometry(r * .62, h * .42, 7).translate(0, y + h * .3, 0), '#f4f9fb']);
        });
        return { trunk: merge([[new T3.CylinderGeometry(.07, .1, .4, 6).translate(0, .2, 0), trunkC]]), crown: merge(parts) };
      }
      if (style === 'cypress') {
        return { trunk: merge([[new T3.CylinderGeometry(.06, .09, .35, 6).translate(0, .17, 0), trunkC]]), crown: merge([[new T3.IcosahedronGeometry(.3, d).scale(1, 2.6, 1).translate(0, 1.05, 0), pal.tree], [new T3.IcosahedronGeometry(.2, d).scale(1, 1.8, 1).translate(.05, 1.35, .08), pal.treeHi]]) };
      }
      if (style === 'jungle') {
        return {
          trunk: merge([[new T3.CylinderGeometry(.09, .15, 1.1, 7).translate(0, .55, 0), '#5d4128'], [new T3.CylinderGeometry(.02, .02, .7, 4).translate(.28, .8, .1), '#3d7a2a']]),
          crown: merge([[new T3.IcosahedronGeometry(.62, d).scale(1.25, .5, 1.1).translate(0, 1.22, 0), pal.tree], [new T3.IcosahedronGeometry(.42, d).scale(1.2, .45, 1).translate(-.12, 1.46, .05), pal.treeHi], [new T3.ConeGeometry(.16, .6, 4).rotateZ(1.2).translate(.52, 1.05, 0), pal.treeHi], [new T3.ConeGeometry(.16, .6, 4).rotateZ(-1.2).translate(-.5, 1.02, .1), pal.tree]]),
        };
      }
      if (style === 'dead') {
        return {
          trunk: merge([[new T3.CylinderGeometry(.06, .12, 1.1, 5).translate(0, .55, 0).rotateZ(.1), trunkC], [new T3.CylinderGeometry(.03, .05, .55, 4).rotateZ(-.9).translate(.22, .95, 0), trunkC], [new T3.CylinderGeometry(.03, .05, .45, 4).rotateZ(.8).translate(-.2, .85, .05), trunkC]]),
          crown: merge([[new T3.IcosahedronGeometry(.28, 0).translate(.35, 1.15, 0), pal.tree], [new T3.IcosahedronGeometry(.24, 0).translate(-.3, 1.02, .05), pal.treeHi], [new T3.IcosahedronGeometry(.22, 0).translate(.02, 1.3, -.05), pal.tree]]),
        };
      }
      // round / autumn / orchard：圆圆的树冠；果树上挂着果子
      const parts = [[new T3.IcosahedronGeometry(.5, d).translate(0, .95, 0), pal.tree], [new T3.IcosahedronGeometry(.32, d).translate(-.06, 1.34, .04), pal.snow ? '#f4f9fb' : pal.treeHi]];
      if (style === 'orchard') [[.35, .85, .25, '#ff7043'], [-.3, 1.0, .3, '#ffca28'], [.1, .78, .44, '#e53935'], [-.12, 1.2, .38, '#ff7043']].forEach(([x, y, z, c]) => parts.push([new T3.IcosahedronGeometry(.08, 0).translate(x, y, z), c]));
      return { trunk: merge([[new T3.CylinderGeometry(.08, .12, .6, 6).translate(0, .3, 0), trunkC]]), crown: merge(parts) };
    }
    function buildTrees() {
      if (m.kind !== 'town' && m.kind !== 'route') return;
      const pal = m.pal, list = [], style = (THEME.tree || 'round');
      const push = (x, y, big) => {
        const r = rnd(x, y, 7), r2 = rnd(y, x, 9);
        list.push({ x: x + .5 + (big ? (r - .5) * .35 : (r - .5) * .1), z: y + .5 + (big ? (r2 - .5) * .3 : 0), s: (big ? 1.2 : 1) * (.88 + r * .24), ry: r2 * 6.28, k: .85 + r2 * .3, r });
      };
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { const c = at(x, y); if (c === '#' || c === 'T') push(x, y, c === '#'); }
      // 地图外面再种三圈，镜头看过去是一片森林（海边的地图外面是海）
      const sea = !!(m.def && m.def.sea);
      if (!sea) for (let y = -4; y < m.H + 4; y++) for (let x = -4; x < m.W + 4; x++) {
        if (x >= 0 && x < m.W && y >= 0 && y < m.H) continue;
        const ex = m.grid[Math.max(0, Math.min(m.H - 1, y))][Math.max(0, Math.min(m.W - 1, x))];
        if ('^v<>~D'.includes(ex)) continue;
        push(x, y, true);
      }
      const kit = treeKit(style, pal);
      inst(kit.trunk, trunkMat, list, true);
      const cols = kit.tint;
      inst(kit.crown, leafMat, list.map(p => Object.assign({}, p, { c: cols ? C(cols[Math.floor(p.r * cols.length) % cols.length]) : new T3.Color(p.k, p.k, p.k) })), true);
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
        [[.25, .3], [.72, .28], [.5, .62], [.22, .85], [.78, .84]].slice(0, tier === 'high' ? 5 : tier === 'mid' ? 4 : 3).forEach(([fx, fz], k) => list.push({ x: x + fx + (rnd(x, y, k) - .5) * .12, z: y + fz, s: .95 + rnd(y, x, k) * .35, ry: rnd(x + k, y, 3) * 6.28 }));
      }
      if (!list.length) return;
      tuftGeo = tuft(m.pal);
      inst(tuftGeo, grassMat, list, false);
    }

    // ---------- 水：半透明、有波光，靠岸的地方渐渐透明 ----------
    function buildWater() {
      const isW = (x, y) => '~Dw'.includes(at(x, y)) && at(x, y) !== '';
      const pos = [], edge = [], idx = [], deep = [], fall = [];
      const corner = (x, y) => (isW(x - 1, y - 1) && isW(x, y - 1) && isW(x - 1, y) && isW(x, y)) ? 1 : 0;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        if (!isW(x, y)) continue;
        const b = pos.length / 3;
        const c = at(x, y);
        [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].forEach(([cx, cy]) => { pos.push(cx, .03, cy); edge.push(corner(cx, cy) * .75 + .25 * (isW(x, y) ? 1 : 0)); deep.push(c === 'D' ? 1 : 0); fall.push(c === 'w' ? 1 : 0); });
        idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      }
      if (!pos.length) return;
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
      g.setAttribute('aEdge', new T3.Float32BufferAttribute(edge, 1));
      g.setAttribute('aDeep', new T3.Float32BufferAttribute(deep, 1));
      g.setAttribute('aFall', new T3.Float32BufferAttribute(fall, 1));
      g.setIndex(idx);
      const cave = m.kind === 'cave';
      const mat = new T3.ShaderMaterial({
        uniforms: { uTime: U.uTime, uDeep: { value: C(cave ? '#10304a' : '#2a8cc4') }, uShallow: { value: C(cave ? '#23577a' : '#7fd6f2') } },
        vertexShader: 'attribute float aEdge, aDeep, aFall; varying float vE, vD, vF; varying vec2 vW; void main(){ vE = aEdge; vD = aDeep; vF = aFall; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform float uTime; uniform vec3 uDeep, uShallow; varying float vE, vD, vF; varying vec2 vW;',
          'void main(){',
          '  float w = sin(vW.x * 2.3 + uTime * 1.2) * 0.5 + sin(vW.y * 3.1 - uTime * 0.9 + vW.x) * 0.5;',
          '  float s = smoothstep(0.86, 0.99, sin(vW.x * 5.3 + uTime * 1.7) * sin(vW.y * 4.1 - uTime * 1.3 + vW.x * 0.7));',
          '  vec3 c = mix(uShallow, uDeep, smoothstep(0.3, 1.0, vE)) + w * 0.035 + s * 0.55;',
          '  c = mix(c, uDeep * 0.55, vD * 0.7);',
          '  float f = smoothstep(0.55, 1.0, sin(vW.y * 7.0 - uTime * 10.0 + sin(vW.x * 3.0) * 1.5));',
          '  c = mix(c, vec3(0.93, 0.98, 1.0), vF * (0.25 + f * 0.6));',
          '  gl_FragColor = vec4(c, 0.35 + 0.5 * vE + vD * 0.2 + vF * 0.3);',
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
      const cliff = [], boulders = [], ledges = [], walls = [], coral = [], reef = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y), r = rnd(x, y, 5);
        if (c === 'R' && m.kind === 'under' && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => { const q = at(x + dx, y + dy); return !q || q === 'R'; })) reef.push({ x: x + .5, z: y + .5, sy: .3 + r * .25 });
        else if (c === 'R' && m.kind === 'under') coral.push({ x: x + .5 + (r - .5) * .2, z: y + .5, s: .8 + r * .35, sy: .55 + rnd(y, x, 6) * .6, ry: r * 6, c: C(['#d98880', '#e0b27a', '#a98bc2', '#6fb3a8', '#d68aa8', '#8f9bc9'][Math.floor(rnd(x, y, 8) * 6)]) });
        else if (c === 'R' || c === 'K') cliff.push({ x: x + .5, z: y + .5, sy: 1.1 + r * .35 });
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
      // 海底的礁石：矮矮的彩色珊瑚，不会挡住主角
      inst(box(), rockMats('#2f5d63', '#3f7470'), reef, true);
      if (coral.length) { const cg = new T3.IcosahedronGeometry(.46, 1).scale(1, 1, .9).translate(0, .3, 0); tint(cg, '#ffffff'); inst(cg, vcolFlat, coral, true); const tip = new T3.ConeGeometry(.12, .5, 6).translate(.18, .75, .05); tint(tip, '#ffffff'); inst(tip, vcolFlat, coral.map(q => Object.assign({}, q, { c: q.c.clone().multiplyScalar(1.15) })), false); }
      inst(box(), rockMats(cave ? (pal.rock || '#8a7260') : '#6b5a4b', cave ? (pal.dark ? '#3a2d24' : A.shade(pal.wall, .8)) : '#5b4a3d'), walls, true);
      const bg = new T3.IcosahedronGeometry(.36, 0).translate(0, .26, 0);
      tint(bg, cave ? pal.wallTop : (pal.rock || '#a39b8b'));
      inst(bg, vcolFlat, boulders, true);
      inst(cbox(1.01, .22, .56, A.shade(pal.grass || '#8fd16a', .66), A.shade(pal.grass || '#8fd16a', .92)), vcol, ledges, false);
    }

    // ---------- 房子：每座岛的建筑风格不一样 ----------
    // 怪兽中心（红顶）和商店（蓝顶）哪座岛都一样，一眼就认得出；道馆和民房按岛上的风格盖
    const WALLTEX = {};
    function wallTex(kind, col) {
      const key = kind + col;
      if (WALLTEX[key]) return WALLTEX[key];
      const t = canvasTex(64, 64, g => {
        g.fillStyle = col; g.fillRect(0, 0, 64, 64);
        if (kind === 'brick') { g.fillStyle = A.shade(col, .78); for (let r = 0; r < 8; r++) { g.fillRect(0, r * 8 + 7, 64, 1); for (let x = (r % 2) * 8; x < 64; x += 16) g.fillRect(x, r * 8, 1, 8); } }
        else if (kind === 'plank' || kind === 'log') { for (let r = 0; r < 6; r++) { g.fillStyle = A.shade(col, r % 2 ? .9 : 1.06); g.fillRect(0, r * 11, 64, 10); g.fillStyle = A.shade(col, .7); g.fillRect(0, r * 11 + 10, 64, 1); if (kind === 'log') { g.fillStyle = A.shade(col, .8); A.circ(g, 4, r * 11 + 5, 3); g.fill(); A.circ(g, 60, r * 11 + 5, 3); g.fill(); } } }
        else if (kind === 'stone') { for (let r = 0; r < 5; r++) for (let x = (r % 2) * 10; x < 64; x += 20) { g.fillStyle = A.shade(col, .92 + ((x + r * 7) % 3) * .05); A.rr(g, x + 1, r * 13 + 1, 18, 11, 2); g.fill(); } }
        else if (kind === 'stripe') { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : col; g.fillRect(k * 8, 0, 8, 64); } }
        else if (kind === 'office') { g.fillStyle = A.shade(col, .75); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { g.fillStyle = (r + c) % 3 ? '#9fc6de' : '#cfe6f5'; g.fillRect(c * 16 + 3, r * 16 + 3, 10, 10); } }
      });
      t.wrapS = t.wrapT = T3.RepeatWrapping;
      return (WALLTEX[key] = t);
    }
    function texMat(t, rx, ry) { const tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(rx, ry); own.push(tt); const mt = new T3.MeshLambertMaterial({ map: tt }); mt._own = true; return mt; }
    const HCOL = ['#ffd1dc', '#c8e6ff', '#fff3b0', '#d4f5c9', '#e6d4ff', '#ffe0c2'];
    function buildBuildings() {
      const house0 = THEME.house || 'med', P = m.pal;
      Object.values(m.buildings || {}).forEach(b => {
        const L = b.L, gym = L === 'G', std = L === 'C' || L === 'M';
        const style = b.style || (std ? 'std' : house0);
        const x0 = b.x0, x1 = b.x1 + 1, z0 = b.y0, z1 = b.y1 + 1, w = x1 - x0, cx = (x0 + x1) / 2;
        const front = z1 - .06, back = z0 + .3, d = front - back, cz = (front + back) / 2;
        const hsh = rnd(b.x0, b.y0, 3);
        let wallH = gym ? 1.75 : L === 'H' || L === 'J' ? 1.25 : 1.45, roofTop = wallH;
        const roofC = std ? A.buildColor(L, m) : gym ? (P.roof || A.buildColor(L, m)) : (P.roof || A.buildColor(L, m));
        let wallC = L === 'C' ? '#fff6ea' : L === 'M' ? '#f2f8ff' : (P.wall || '#fff8ec');
        const box = (bw, bh, bd, col, x, y, z, cast = true, top) => mesh(cbox(bw, bh, bd, col, top || col), vcol, x, y, z, cast);
        const wallBox = (h, tex, texCol) => {
          if (tex) { const mt = texMat(wallTex(tex, texCol), Math.max(1, Math.round(w)), Math.max(1, Math.round(h * 1.4))); mesh(new T3.BoxGeometry(w - .24, h, d).translate(0, h / 2, 0), mt, cx, 0, cz, true); }
          else mesh(cbox(w - .24, h, d, wallC, wallC, A.shade(wallC, .84)), vcol, cx, 0, cz, true);
        };
        const gableRoof = (h, col, over = .5, y = wallH) => { const rg = gable(w + .1, d + over, h); tint(rg, col); mesh(rg, vcolFlat, cx, y, cz, true); mesh(cbox(w + .14, .09, .16, A.shade(col, 1.18)), vcol, cx, y + h - .05, cz, false); roofTop = y + h; };
        const pyramid = (r, h, col, y = wallH, segs = 4) => { const g = new T3.ConeGeometry(r, h, segs, 1).rotateY(segs === 4 ? Math.PI / 4 : 0).translate(0, h / 2, 0); tint(g, col); mesh(g, vcolFlat, cx, y, cz, true); roofTop = y + h; };
        const cyl = (r, h, col, y, segs = 16, x = cx, z = cz) => { const g = new T3.CylinderGeometry(r, r, h, segs).translate(0, h / 2, 0); tint(g, col); return mesh(g, vcol, x, y, z, true); };
        const flatRoof = (col, y = wallH, lip = true) => { box(w - .1, .14, d + .1, col, cx, y, cz, true); if (lip) { box(w - .1, .18, .1, A.shade(col, .85), cx, y + .14, front, false); box(w - .1, .18, .1, A.shade(col, .85), cx, y + .14, back - .05, false); } roofTop = y + .3; };
        let round = false;
        switch (style) {
          case 'std': wallBox(wallH); gableRoof(.8, roofC); break;
          case 'med': wallC = '#fbf7ef'; wallBox(wallH); gableRoof(.55, gym ? roofC : '#d9643a', .4); break;
          case 'crayon': {
            wallC = HCOL[Math.floor(hsh * HCOL.length)]; wallBox(wallH);
            box(w - .1, .14, d + .1, ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc'][Math.floor(hsh * 5)], cx, wallH, cz, false);
            const r = Math.min(w, d + .4) * .62; pyramid(r, 1.0, '#f5d7a1', wallH + .14, 6);
            const tip = new T3.ConeGeometry(r * .3, .3, 6).translate(0, .15, 0); tint(tip, '#37474f'); mesh(tip, vcolFlat, cx, wallH + .14 + .7, cz, false);
            break;
          }
          case 'farm': wallBox(wallH, 'plank', P.wall || '#c9955e'); gableRoof(.95, '#e8c35a', .75); break;
          case 'brick': {
            wallH += gym ? .3 : .15; wallBox(wallH, 'brick', '#b5543c'); flatRoof('#6d4c41');
            if (w >= 5) { box(1, 1.1, 1, '#b5543c', cx, roofTop - .1, cz, true); pyramid(.8, .55, '#6d4c41', roofTop + .95); const cf = circleSign('#fffdf5', '#37474f', 'clock'); mesh(new T3.PlaneGeometry(.62, .62), cf, cx, roofTop - .95 + .55 - .28, cz + .51, false); }
            break;
          }
          case 'dome': {
            wallC = '#f6fafc'; wallBox(wallH); box(w - .2, .12, d + .04, P.trim || '#5c6bc0', cx, wallH - .3, cz, false);
            const dm = new T3.MeshLambertMaterial({ color: '#8fd3f4', transparent: true, opacity: .78, emissive: 0x16334a }); dm._own = true;
            mesh(new T3.SphereGeometry(Math.min(w - .24, d) * .5, 18, 10, 0, 6.29, 0, Math.PI / 2).scale(w > d + .5 ? (w - .24) / d : 1, 1, 1), dm, cx, wallH, cz, true);
            roofTop = wallH + Math.min(w, d) * .5;
            box(.05, .5, .05, '#90a4ae', cx + w * .3, roofTop - .2, cz, false);
            break;
          }
          case 'tent': {
            round = true;
            const r = Math.min(w - .2, d + .2) / 2, stripe = texMat(wallTex('stripe', gym ? roofC : ['#e53935', '#1e88e5', '#8e24aa', '#43a047'][Math.floor(hsh * 4)]), 6, 1);
            mesh(new T3.CylinderGeometry(r, r, wallH, 20).translate(0, wallH / 2, 0), stripe, cx, 0, cz, true);
            const cone = new T3.ConeGeometry(r * 1.12, 1.25, 20).translate(0, .62, 0);
            mesh(cone, texMat(wallTex('stripe', gym ? roofC : '#ffca28'), 8, 1), cx, wallH, cz, true);
            roofTop = wallH + 1.25;
            box(.04, .45, .04, '#6d4121', cx, roofTop - .05, cz, false);
            const fl = new T3.PlaneGeometry(.3, .18).translate(.15, 0, 0); tint(fl, '#ffca28'); mesh(fl, vcol, cx + .02, roofTop + .32, cz, false);
            break;
          }
          case 'tower': {
            wallH = gym ? 2.6 : 2.0; wallBox(wallH, 'stone', '#cfc6b6');
            pyramid(Math.max(w, d + .5) * .6, 1.2, '#4f9e8a');
            const cf = circleSign('#fffdf5', '#b8862b', 'clock'); mesh(new T3.PlaneGeometry(.6, .6), cf, cx, wallH - .5, front + .015, false);
            break;
          }
          case 'cake': {
            round = true;
            const r = Math.min(w - .2, d + .2) / 2;
            cyl(r, wallH * .62, '#fff4e0', 0, 24); cyl(r * .72, wallH * .45, '#ffe0ea', wallH * .62, 24);
            const icing = new T3.TorusGeometry(r, .09, 6, 24).rotateX(Math.PI / 2); tint(icing, '#ff8fb1'); mesh(icing, vcol, cx, wallH * .62, cz, false);
            const icing2 = new T3.TorusGeometry(r * .72, .08, 6, 24).rotateX(Math.PI / 2); tint(icing2, '#ffffff'); mesh(icing2, vcol, cx, wallH * 1.07, cz, false);
            roofTop = wallH * 1.07;
            const ch = new T3.SphereGeometry(.14, 10, 8); tint(ch, '#e53935'); mesh(ch, vcol, cx, roofTop + .12, cz, false);
            [-.35, .35].forEach(k => { box(.05, .3, .05, '#81d4fa', cx + k * r, roofTop, cz, false); const fm = new T3.MeshBasicMaterial({ color: '#ffca28' }); fm._own = true; mesh(new T3.SphereGeometry(.05, 6, 4), fm, cx + k * r, roofTop + .34, cz, false); });
            wallH = wallH * .62;
            break;
          }
          case 'hut': {
            [[x0 + .3, back + .1], [x1 - .3, back + .1], [x0 + .3, front - .1], [x1 - .3, front - .1]].forEach(([px, pz]) => box(.1, .5, .1, '#6d4121', px, 0, pz, true));
            mesh(cbox(w - .24, wallH - .1, d, '#a0703c', '#a0703c'), vcol, cx, .45, cz, true);
            gableRoof(.75, '#4c8f3a', .7, wallH + .35);
            box(w - .1, .06, .5, '#8a5a33', cx, .42, front + .2, false);
            wallH = wallH + .35;
            break;
          }
          case 'city': {
            wallH = gym ? 2.4 : L === 'H' || L === 'J' ? 2.2 + hsh * .8 : 2.8 + hsh * 1.2;
            wallBox(wallH, 'office', '#b0bec5'); flatRoof('#546e7a');
            box(.6, .35, .5, '#78909c', cx + w * .2, roofTop - .15, cz - .1, true);
            break;
          }
          case 'market': {
            wallC = '#ffffff'; wallBox(wallH); flatRoof(roofC);
            const awT = canvasTex(128, 32, g => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : ['#ff7043', '#1e88e5', '#43a047', '#fdd835'][Math.floor(hsh * 4)]; g.fillRect(k * 16, 0, 16, 32); } });
            const am = new T3.MeshLambertMaterial({ map: awT, side: T3.DoubleSide }); am._own = true;
            const aw = mesh(new T3.PlaneGeometry(w - .3, .5), am, cx, wallH * .78, front + .22, true); aw.rotation.x = -1.0;
            break;
          }
          case 'chalet': wallBox(wallH, 'log', '#8d6e63'); gableRoof(1.3, '#f4f8fb', .8); box(.24, .55, .24, '#6d4c41', x1 - .8, wallH + .5, cz - .1, true); box(.3, .08, .3, '#ffffff', x1 - .8, wallH + 1.05, cz - .1, false); break;
          case 'temple': {
            wallBox(wallH + .15, 'stone', '#c9bfa8'); wallH += .15;
            box(w + .1, .16, d + .5, '#b3a992', cx, wallH, cz, true); box(w - .5, .16, d, '#a39a84', cx, wallH + .16, cz, true); roofTop = wallH + .32;
            [x0 + .35, x1 - .35].forEach(px => { const g = new T3.CylinderGeometry(.12, .14, wallH, 10).translate(0, wallH / 2, 0); tint(g, '#ddd4bf'); mesh(g, vcol, px, 0, front + .22, true); });
            const vine = new T3.PlaneGeometry(.4, .7); tint(vine, '#6d8b5a'); mesh(vine, vcol, x0 + .8, wallH - .45, front + .013, false);
            break;
          }
          case 'lighthouse': {
            round = true;
            const r = .45, h = 3.2, stripe = texMat(wallTex('stripe', '#e53935'), 1, 1);
            stripe.map.rotation = Math.PI / 2; stripe.map.repeat.set(3, 1);
            mesh(new T3.CylinderGeometry(r * .8, r, h, 16).translate(0, h / 2, 0), stripe, cx, 0, cz, true);
            const lm = new T3.MeshBasicMaterial({ color: '#fff59d' }); lm._own = true; mesh(new T3.CylinderGeometry(.3, .3, .35, 12).translate(0, .17, 0), lm, cx, h, cz, false);
            pyramid(.42, .4, '#37474f', h + .35, 12); wallH = 1.1;
            break;
          }
          case 'windmill': {
            wallBox(wallH + .3, 'plank', '#e8d5b0'); wallH += .3; pyramid(Math.max(w, d) * .55, .9, '#8d6e63');
            const hub = new T3.Group(); hub.position.set(cx, wallH + .45, front + .25);
            for (let k = 0; k < 4; k++) { const bl = new T3.Mesh(cbox(.18, 1.3, .03, '#f5ecd9'), vcol); own.push(bl.geometry); bl.rotation.z = k * Math.PI / 2; hub.add(bl); }
            add(hub); spinners.push(hub);
            break;
          }
          case 'stadium': {
            round = true;
            const r = Math.min(w, d + .3) / 2;
            const ring = new T3.CylinderGeometry(r, r * 1.05, wallH, 28, 1, true).translate(0, wallH / 2, 0); tint(ring, '#eceff1');
            const rm = new T3.MeshLambertMaterial({ vertexColors: true, side: T3.DoubleSide }); rm._own = true; mesh(ring, rm, cx, 0, cz, true);
            const band = new T3.TorusGeometry(r, .08, 6, 28).rotateX(Math.PI / 2); tint(band, roofC); mesh(band, vcol, cx, wallH, cz, false);
            box(r * 1.2, .02, r * .9, '#66bb6a', cx, .02, cz, false);
            break;
          }
          default: wallBox(wallH); gableRoof(.8, roofC);
        }
        // 门（圆房子的门贴在最前面）
        if (b.door) {
          const dx = b.door.x + .5;
          const doorT = canvasTex(64, 96, g => {
            g.fillStyle = style === 'city' || style === 'dome' ? '#546e7a' : '#6b4a36'; A.rr(g, 4, 6, 56, 90, [22, 22, 0, 0]); g.fill();
            g.fillStyle = L === 'C' || style === 'city' || style === 'dome' ? '#c9ecff' : style === 'med' ? '#2f7fc1' : '#8d6e63'; A.rr(g, 12, 14, 40, 82, [16, 16, 0, 0]); g.fill();
            if (L === 'C' || L === 'M') { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(31, 14, 2, 82); }
            g.fillStyle = '#ffd54f'; A.circ(g, 44, 58, 4); g.fill();
          });
          const dm = new T3.MeshLambertMaterial({ map: doorT, transparent: true }); dm._own = true;
          const dy = style === 'hut' ? .45 : 0;
          mesh(new T3.PlaneGeometry(.62, .93), dm, dx, .465 + dy, (round ? front + .02 : front + .012), false);
          if (style === 'hut') { const lad = new T3.PlaneGeometry(.4, .5); tint(lad, '#8a5a33'); const o = mesh(lad, vcol, dx, .25, front + .35, false); o.rotation.x = -.5; }
        }
        // 窗户
        if (!round && style !== 'city') {
          const winT = canvasTex(64, 52, g => {
            g.fillStyle = style === 'med' ? '#2f7fc1' : '#ffffff'; A.rr(g, 0, 0, 64, 52, 8); g.fill();
            g.fillStyle = '#8fd3f4'; A.rr(g, 6, 6, 52, 40, 5); g.fill();
            g.fillStyle = '#ffffff'; g.fillRect(30, 6, 4, 40); g.fillRect(6, 24, 52, 4);
            g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(10, 40); g.lineTo(20, 10); g.lineTo(26, 10); g.lineTo(16, 40); g.fill();
          });
          const wm = new T3.MeshLambertMaterial({ map: winT, emissive: 0x223344 }); wm._own = true;
          const wy = (style === 'hut' ? .45 : 0) + Math.min(wallH, 1.6) * .55;
          [x0 + .75, x1 - .75].forEach(wx => { if (!b.door || Math.abs(wx - (b.door.x + .5)) > .7) mesh(new T3.PlaneGeometry(.5, .4), wm, wx, wy, front + .012, false); });
          if (style === 'med' || style === 'farm') [x0 + .75, x1 - .75].forEach(wx => { if (!b.door || Math.abs(wx - (b.door.x + .5)) > .7) box(.5, .1, .12, '#8a5a33', wx, wy - .3, front + .06, false, '#e57373'); });
        }
        // 招牌
        if (L === 'C' || L === 'M' || gym) {
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
          mesh(new T3.PlaneGeometry(sw, sw * 72 / 256), sm, cx, Math.min(wallH, 1.8) - .22 + (style === 'hut' ? .45 : 0), front + (round ? .06 : .02), false);
        }
        if (L === 'M' && style === 'std') {
          const awT = canvasTex(128, 32, g => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : roofC; g.fillRect(k * 16, 0, 16, 32); } });
          const am = new T3.MeshLambertMaterial({ map: awT, side: T3.DoubleSide }); am._own = true;
          const aw = mesh(new T3.PlaneGeometry(w - .5, .45), am, cx, wallH * .72, front + .2, true);
          aw.rotation.x = -1.0;
        }
        if (style === 'std' && (L === 'H' || L === 'J')) box(.22, .5, .22, A.shade(roofC, .7), x1 - .8, wallH + .25, cz - .1, true);
      });
    }
    // 圆形的钟面 / 标志
    function circleSign(bg, fg, kind) {
      const t = canvasTex(64, 64, g => {
        g.fillStyle = fg; A.circ(g, 32, 32, 31); g.fill(); g.fillStyle = bg; A.circ(g, 32, 32, 26); g.fill();
        if (kind === 'clock') { g.strokeStyle = fg; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 14); g.moveTo(32, 32); g.lineTo(44, 38); g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; g.fillStyle = fg; A.circ(g, 32 + Math.cos(a) * 21, 32 + Math.sin(a) * 21, 1.8); g.fill(); } }
      });
      const mt = new T3.MeshLambertMaterial({ map: t, transparent: true, emissive: 0x333333 }); mt._own = true;
      return mt;
    }

    // ---------- 地标（户外的 Z）、栅栏、机关门、楼梯、海底光圈、冰面 ----------
    // 地标的样子：def.markKinds 按顺序指定，否则按岛的风格
    const MARK_OF = { hello: 'anchor', crayon: 'crayon', farm: 'scarecrow', school: 'bell', lab: 'telescope', circus: 'balloon', clock: 'clock', party: 'gift', jungle: 'totem', city: 'light', sports: 'trophy', snow: 'snowman', ruins: 'stone' };
    function markMesh(kind, x, z) {
      const g = new T3.Group(); g.position.set(x, 0, z); add(g);
      const part = (geo, col, px, py, pz, flat) => { tint(geo, col); own.push(geo); const o = new T3.Mesh(geo, flat ? vcolFlat : vcol); o.position.set(px || 0, py || 0, pz || 0); o.castShadow = !!Q.shadow; g.add(o); return o; };
      const base = () => part(cbox(.7, .22, .7, '#b0bec5', '#cfd8dc'), '#b0bec5');
      switch (kind) {
        case 'anchor': base(); part(new T3.TorusGeometry(.25, .06, 6, 14, Math.PI).rotateZ(Math.PI), '#546e7a', 0, .55); part(new T3.CylinderGeometry(.05, .05, .7, 6), '#546e7a', 0, .6); part(new T3.TorusGeometry(.1, .04, 6, 12), '#546e7a', 0, 1.0); break;
        case 'crayon': part(new T3.CylinderGeometry(.22, .22, 1.1, 8).translate(0, .55, 0), ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'][Math.floor(rnd(x, z, 2) * 4)]); part(new T3.ConeGeometry(.22, .35, 8).translate(0, 1.27, 0), '#f5d7a1'); break;
        case 'scarecrow': part(new T3.CylinderGeometry(.04, .04, 1.3, 5).translate(0, .65, 0), '#8a5a33'); part(cbox(.8, .06, .06, '#8a5a33'), '#8a5a33', 0, .95); part(new T3.SphereGeometry(.17, 8, 6), '#f5d7a1', 0, 1.3); part(new T3.ConeGeometry(.25, .22, 8), '#e8c35a', 0, 1.48); part(cbox(.4, .4, .2, '#e57373'), '#e57373', 0, .72); break;
        case 'bell': part(cbox(.08, 1.2, .08, '#6d4c41'), '#6d4c41', -.3); part(cbox(.08, 1.2, .08, '#6d4c41'), '#6d4c41', .3); part(cbox(.7, .08, .1, '#6d4c41'), '#6d4c41', 0, 1.2); part(new T3.ConeGeometry(.2, .3, 12).translate(0, -.15, 0), '#ffca28', 0, 1.18); break;
        case 'telescope': part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(.25), '#546e7a', .1); part(new T3.CylinderGeometry(.03, .03, .8, 5).translate(0, .4, 0).rotateZ(-.25), '#546e7a', -.1); part(new T3.CylinderGeometry(.09, .12, .8, 10).rotateZ(-.9), '#eceff1', .05, .9); break;
        case 'balloon': [['#e53935', -.2, 1.1], ['#fdd835', .15, 1.25], ['#1e88e5', .02, .95]].forEach(([c, px, py]) => { part(new T3.SphereGeometry(.17, 10, 8).scale(1, 1.2, 1), c, px, py); part(new T3.CylinderGeometry(.006, .006, py, 3).translate(0, py / 2, 0), '#555555', px * .3, 0); }); part(cbox(.2, .12, .2, '#8d6e63'), '#8d6e63'); break;
        case 'clock': part(new T3.CylinderGeometry(.06, .08, 1.3, 8).translate(0, .65, 0), '#37474f'); { const f = new T3.Mesh(new T3.CylinderGeometry(.3, .3, .08, 20).rotateX(Math.PI / 2), circleSign('#fffdf5', '#37474f', 'clock')); f.position.set(0, 1.45, 0); own.push(f.geometry); g.add(f); part(new T3.TorusGeometry(.3, .04, 6, 20), '#b8862b', 0, 1.45); } break;
        case 'gift': part(cbox(.7, .6, .7, '#ff80ab'), '#ff80ab'); part(cbox(.72, .1, .15, '#ffd54f'), '#ffd54f', 0, .25); part(cbox(.15, .62, .72, '#ffd54f'), '#ffd54f'); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', -.1, .68); part(new T3.TorusGeometry(.12, .04, 6, 12), '#ffd54f', .1, .68); break;
        case 'totem': [['#8d6e63', .0], ['#e53935', .42], ['#1e88e5', .84]].forEach(([c, py]) => { part(cbox(.44, .4, .44, c), c, 0, py); part(cbox(.46, .06, .1, '#ffffff'), '#ffffff', 0, py + .24, .2); }); part(cbox(.9, .08, .2, '#43a047'), '#43a047', 0, 1.2); break;
        case 'light': part(new T3.CylinderGeometry(.04, .05, 1.2, 6).translate(0, .6, 0), '#455a64'); part(cbox(.24, .6, .2, '#263238'), '#263238', 0, 1.1); [['#e53935', 1.58], ['#fdd835', 1.4], ['#43a047', 1.22]].forEach(([c, py]) => { const mt = new T3.MeshBasicMaterial({ color: c }); mt._own = true; const o = new T3.Mesh(new T3.SphereGeometry(.06, 8, 6), mt); own.push(o.geometry); o.position.set(0, py, .1); g.add(o); }); break;
        case 'trophy': base(); part(new T3.CylinderGeometry(.08, .12, .3, 10).translate(0, .15, 0), '#ffca28', 0, .22); part(new T3.CylinderGeometry(.26, .1, .38, 14).translate(0, .19, 0), '#ffca28', 0, .52); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', .28, .75); part(new T3.TorusGeometry(.1, .03, 6, 10), '#ffca28', -.28, .75); break;
        case 'snowman': part(new T3.SphereGeometry(.32, 12, 10), '#ffffff', 0, .3); part(new T3.SphereGeometry(.23, 12, 10), '#ffffff', 0, .78); part(new T3.ConeGeometry(.04, .2, 6).rotateX(Math.PI / 2), '#ff7043', 0, .8, .26); part(new T3.CylinderGeometry(.16, .16, .22, 10), '#37474f', 0, 1.08); part(new T3.TorusGeometry(.2, .05, 6, 14).rotateX(Math.PI / 2), '#e53935', 0, .6); break;
        case 'stone': part(cbox(.5, 1.5, .3, '#8f8a80', '#a39e94'), '#8f8a80'); part(new T3.PlaneGeometry(.2, .6), '#6d8b5a', .12, .5, .16); break;
        case 'fountain': part(new T3.CylinderGeometry(.45, .5, .25, 16).translate(0, .12, 0), '#cfd8dc'); { const wm = new T3.MeshLambertMaterial({ color: '#4fc3f7', emissive: 0x114466 }); wm._own = true; const o = new T3.Mesh(new T3.CylinderGeometry(.4, .4, .05, 16), wm); own.push(o.geometry); o.position.y = .24; g.add(o); } part(new T3.CylinderGeometry(.06, .08, .6, 8).translate(0, .3, 0), '#cfd8dc', 0, .2); break;
        case 'boat': part(cbox(.8, .3, .5, '#8d6e63', '#a1887f'), '#8d6e63', 0, -.05); part(new T3.CylinderGeometry(.025, .025, 1, 5).translate(0, .5, 0), '#6d4121', 0, .2); { const s = new T3.PlaneGeometry(.5, .6).translate(.25, .45, 0); tint(s, '#fffdf5'); const o = new T3.Mesh(s, new T3.MeshLambertMaterial({ vertexColors: true, side: T3.DoubleSide })); o.material._own = true; own.push(s); o.position.y = .25; g.add(o); } break;
        default: part(cbox(.6, .5, .6, '#b0bec5', '#cfd8dc'), '#b0bec5'); part(new T3.IcosahedronGeometry(.24, 0).translate(0, .78, 0), '#ffc53d', 0, 0, 0, true);
      }
      return g;
    }
    let gateM = [];
    function buildMarks() {
      gateM = [];
      const kinds = (m.def && m.def.markKinds) || [];
      const posts = [], rails = [], ice = [];
      let zi = 0;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y), cx = x + .5, cz = y + .5;
        if (c === 'Z' && m.kind !== 'inside') markMesh(kinds[zi++] || MARK_OF[m.theme] || 'statue', cx, cz + .05);
        else if (c === 'f') {
          const hor = at(x - 1, y) === 'f' || at(x + 1, y) === 'f';
          posts.push({ x: cx, z: cz }); rails.push({ x: cx, z: cz, ry: hor ? 0 : Math.PI / 2 });
        } else if (c === '|') {
          // 机关门：一排发光的栏杆，打开了就沉到地下
          const g = new T3.Group(); g.position.set(cx, 0, cz); add(g);
          const bar = new T3.MeshLambertMaterial({ color: m.kind === 'inside' ? '#ff7043' : '#8d6e63', emissive: 0x331100 }); bar._own = true;
          [-.3, 0, .3].forEach(k => { const o = new T3.Mesh(new T3.CylinderGeometry(.06, .06, 1.1, 8).translate(0, .55, 0), bar); own.push(o.geometry); o.position.x = k; o.castShadow = !!Q.shadow; g.add(o); });
          const top = new T3.Mesh(cbox(.9, .1, .12, '#5d4037'), vcol); own.push(top.geometry); top.position.y = 1.0; g.add(top);
          gateM.push({ g, key: x + ',' + y });
        } else if (c === '%') {
          // 楼梯 / 梯子
          for (let k = 0; k < 3; k++) mesh(cbox(.9, .1 + k * .12, .3, m.pal.rock || m.pal.wall || '#9e9e9e', A.shade(m.pal.rock || m.pal.wall || '#9e9e9e', 1.15)), vcol, cx, 0, y + .15 + k * .3, false);
        } else if (c === 'U') {
          const um = new T3.MeshBasicMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, color: '#bff4ff' }); um._own = true;
          const o = mesh(new T3.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), um, cx, .05, cz, false); glows.push(o);
        } else if (c === 'I') ice.push({ x: cx, y: .012, z: cz });
      }
      // 栅栏和冰面一批画完（一格一个网格太费手机）
      const fcol = m.theme === 'city' ? '#90a4ae' : m.theme === 'farm' || m.theme === 'hello' ? '#fffdf5' : '#c89a66';
      inst(cbox(.1, .55, .1, fcol), vcol, posts, true);
      inst(merge([[cbox(1.02, .07, .06, fcol).translate(0, .22, 0), fcol], [cbox(1.02, .07, .06, fcol).translate(0, .42, 0), fcol]]), vcol, rails, false);
      if (ice.length) { const im = new T3.MeshLambertMaterial({ color: '#e3f6ff', transparent: true, opacity: .45, emissive: 0x2a4a5a }); im._own = true; own.push(im); const o = inst(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), im, ice, false); if (o) o.receiveShadow = false; }
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
        // 只有最外面一圈（后墙、两侧）是高墙；房间中间的隔墙画矮一点，不会挡住后面的主角
        (y === m.H - 1 || (y > 0 && x > 0 && x < m.W - 1) ? low : tall).push({ x: x + .5, z: y + .5 });
      }
      inst(cbox(1, 2.1, 1, p.wall, '#4e3a2c', p.trim), vcol, tall, true);
      inst(cbox(1, .55, 1, p.wall, p.trim || '#4e3a2c', p.trim), vcol, low, true);
      const zk = (m.def && m.def.markKinds) || [];
      let zi = 0;
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y), cx = x + .5, cz = y + .5;
        if (c === 'Z' && zk[zi] && zk[zi] !== 'statue') { indoorMark(zk[zi++], cx, cz); continue; }
        if (c === 'Z') zi++;
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

    // 室内的道具：黑板、相框、喇叭；其余按户外地标画（钟、礼物、奖杯……）
    function indoorMark(kind, cx, cz) {
      if (kind === 'board') {
        mesh(cbox(.9, .08, .1, '#8d6e63'), vcol, cx, .15, cz, false);
        mesh(cbox(.06, 1.1, .06, '#6d4c41'), vcol, cx - .4, 0, cz, true); mesh(cbox(.06, 1.1, .06, '#6d4c41'), vcol, cx + .4, 0, cz, true);
        const bt = canvasTex(96, 64, g => { g.fillStyle = '#8d6e63'; g.fillRect(0, 0, 96, 64); g.fillStyle = '#2e5d43'; g.fillRect(5, 5, 86, 54); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(14, 16, 50, 3); g.fillRect(14, 28, 64, 3); g.fillRect(14, 40, 36, 3); });
        const bm = new T3.MeshLambertMaterial({ map: bt }); bm._own = true; mesh(new T3.PlaneGeometry(.9, .6), bm, cx, .85, cz + .04, false);
      } else if (kind === 'photo') {
        mesh(cbox(.7, .6, .08, '#a1887f'), vcol, cx, .55, cz - .3, true);
        const pt = canvasTex(64, 56, g => { g.fillStyle = '#fff8e1'; g.fillRect(0, 0, 64, 56); ['#ffcc80', '#ffab91', '#f8bbd0'].forEach((c, i) => { g.fillStyle = c; A.circ(g, 14 + i * 18, 22, 8); g.fill(); g.fillStyle = '#90caf9'; g.fillRect(8 + i * 18, 32, 13, 16); }); });
        const pm = new T3.MeshLambertMaterial({ map: pt }); pm._own = true; mesh(new T3.PlaneGeometry(.58, .5), pm, cx, .85, cz - .25, false);
      } else if (kind === 'speaker') {
        mesh(cbox(.1, 1.0, .1, '#607d8b'), vcol, cx, 0, cz, true);
        const hn = new T3.ConeGeometry(.22, .4, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 1.05, .1); tint(hn, '#cfd8dc');
        const hm = new T3.MeshLambertMaterial({ vertexColors: true, side: T3.DoubleSide }); hm._own = true; mesh(hn, hm, cx, 0, cz, false);
      } else markMesh(kind, cx, cz);
    }

    // ---------- 野外技能的障碍：小树、裂开的岩石、大石头 ----------
    let obstM = [], bouldM = [], bike = null, ripple = null;
    const sparkS = [];
    function buildObst() {
      obstM = []; bouldM = [];
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        const c = at(x, y);
        if (c === 'n') {
          const g = new T3.Group();
          const tr = new T3.CylinderGeometry(.06, .08, .35, 6).translate(0, .17, 0); tint(tr, '#6d4121');
          const cr = new T3.IcosahedronGeometry(.3, 1).translate(0, .55, 0); tint(cr, '#7bc043');
          g.add(new T3.Mesh(tr, vcol), new T3.Mesh(cr, vcolFlat)); own.push(tr, cr);
          g.position.set(x + .5, 0, y + .5); g.traverse(o => { o.castShadow = !!Q.shadow; });
          world.add(g); obstM.push({ g, key: x + ',' + y });
        } else if (c === 'b') {
          const rg = new T3.IcosahedronGeometry(.38, 0).translate(0, .3, 0); tint(rg, '#b8a58a');
          const g = new T3.Mesh(rg, vcolFlat); own.push(rg);
          const crack = new T3.Mesh(new T3.BoxGeometry(.03, .34, .02), new T3.MeshBasicMaterial({ color: '#4e3b2c' })); crack.position.set(0, .34, .34); crack.rotation.z = .4; g.add(crack); own.push(crack.geometry, crack.material);
          g.position.set(x + .5, 0, y + .5); g.castShadow = !!Q.shadow;
          world.add(g); obstM.push({ g, key: x + ',' + y });
        }
      }
      (m.boulders || []).forEach(b => {
        const bg = new T3.IcosahedronGeometry(.45, 1).translate(0, .42, 0); tint(bg, '#9e9e9e');
        const g = new T3.Mesh(bg, vcolFlat); own.push(bg);
        g.position.set(b.x + .5, 0, b.y + .5); g.castShadow = !!Q.shadow;
        world.add(g); bouldM.push(g);
      });
    }
    function makeBike() {
      const g = new T3.Group(), wm = new T3.MeshLambertMaterial({ color: '#37474f' }), fm = new T3.MeshLambertMaterial({ color: '#e53935' });
      [-1, 1].forEach(k => { const w = new T3.Mesh(new T3.TorusGeometry(.17, .03, 6, 16), wm); w.position.set(0, .18, k * .24); w.rotation.y = Math.PI / 2; g.add(w); });
      const f = new T3.Mesh(new T3.BoxGeometry(.05, .05, .5), fm); f.position.set(0, .3, 0); g.add(f);
      const h = new T3.Mesh(new T3.BoxGeometry(.32, .04, .04), wm); h.position.set(0, .45, .2); g.add(h);
      return g;
    }
    const sparkTex = canvasTexKeep(32, 32, g => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(.4, 'rgba(255,240,150,.8)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    for (let i = 0; i < 4; i++) { const sp = new T3.Mesh(new T3.PlaneGeometry(.5, .5), new T3.MeshBasicMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: T3.AdditiveBlending })); sp.rotation.x = -.9; sp.visible = false; sparkS.push(sp); }

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
      const key = 'mon:' + sp.id;
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
      if (!sp || f.sp === sp.id) return;
      const im = A.monImg(sp);
      if (!im.complete || !im.naturalWidth) return;
      const c = document.createElement('canvas'); c.width = c.height = Q.cell;
      c.getContext('2d').drawImage(im, 0, 0, Q.cell, Q.cell);
      const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace;
      if (f.mesh) { f.root.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.map.dispose(); f.mesh.material.dispose(); }
      f.mesh = sheet(t, 1.05);
      f.mesh.rotation.x = -pitch * .8;
      f.root.add(f.mesh);
      f.sp = sp.id;
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
      const wantW = room() ? Math.min(m.W + 1.2, 8.6) : 9.6;
      dist = camera.aspect < 1.15 ? wantW / (2 * tan * camera.aspect) : (room() ? m.H + 1 : 9.4) / (2 * tan);
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
      player.mesh.position.y = V.hop + (V.surf ? .42 : V.bike ? .16 : 0);
      bike.visible = !!V.bike;
      if (V.bike) { bike.position.set(V.px + .5, 0, V.py + .5); bike.rotation.y = V.pdir === 'left' || V.pdir === 'right' ? Math.PI / 2 : 0; }
      ripple.visible = !!V.surf;
      if (V.surf) { ripple.position.set(V.px + .5, .06, V.py + .5); ripple.scale.setScalar(1 + Math.sin(now / 250) * .08); }
      spinners.forEach(o => { o.rotation.z = now / 900; });
      glows.forEach((o, i) => { o.material.opacity = .45 + .4 * Math.sin(now / 400 + i); });
      gateM.forEach(o => { const open = V.open && V.open.has(o.key); o.g.position.y += ((open ? -1.2 : 0) - o.g.position.y) * .2; o.g.visible = o.g.position.y > -1.1; });
      // 障碍：砍掉 / 碎掉的不画；大石头滑到新位置
      obstM.forEach(o => { o.g.visible = !V.cleared || !V.cleared.has(o.key); });
      V.obst.forEach((b, i) => { const g = bouldM[i]; if (!g) return; g.position.x += (b.x + .5 - g.position.x) * .3; g.position.z += (b.y + .5 - g.position.z) * .3; });
      // 寻宝器的闪光
      sparkS.forEach((sp, i) => { const h = V.sparkles[i]; sp.visible = !!h; if (h) { sp.position.set(h.x + .5, .15, h.y + .5); sp.material.opacity = .4 + .6 * (Math.sin(now / 230 + i * 2) + 1) / 2; sp.scale.setScalar(.7 + .5 * (Math.sin(now / 300 + i) + 1) / 2); } });
      // 跟着走的怪兽
      follower.root.visible = V.showF || (V.surf && !!V.lead);
      if (V.showF || V.surf) {
        setMon(follower, V.lead);
        const bob = V.pmoving ? Math.abs(Math.sin(now / 90)) * .08 : Math.sin(now / 600) * .02;
        follower.root.position.set(V.fx + .5, 0, V.fy + .5);
        if (V.surf) follower.root.position.set(V.px + .5, -.1, V.py + .55);
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
      const pad = room() ? .6 : m.kind === 'cave' || m.kind === 'inside' || m.kind === 'under' ? .8 : 1.6;
      const clamp = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
      camGoal.x = clamp(camGoal.x, halfW - pad, m.W - halfW + pad);
      camGoal.z = clamp(camGoal.z, north - pad, m.H - south + (room() ? pad : .2));
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
      if (m.dark) { lamp.intensity = V.flash ? 18 : 9; lamp.distance = V.flash ? 14 : 4.5; hemi.intensity = V.flash ? 1.1 : .45; }
      if (post) {
        tmp.set(V.px + .5, .6, V.py + .5).project(camera);
        const u = post.mat.uniforms;
        u.uFocus.value = tmp.y * .5 + .5;
        u.uCenter.value.set(tmp.x * .5 + .5, tmp.y * .5 + .5);
        u.uDark.value = m.dark ? (V.flash ? .35 : .97) : 0;
        u.uVig.value = room() ? .35 : m.kind === 'under' ? .8 : .55;
        u.uBand.value = room() ? .3 : .2;
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
