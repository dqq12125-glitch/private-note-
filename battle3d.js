// 回声岛 · 3D 战斗画面：两只 3D 怪兽站在台子上，招式有按属性做的特效（粒子、光束、闪电、冰刺、落石……）
// monsters.js 负责战斗规则，这里只负责画面：enter 出场、attack 放招（返回命中时刻）、hit 受击、faint 倒下、catchThrow 扔球
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

  function create(host, opts) {
    opts = opts || {};
    const canvas = document.createElement('canvas');
    canvas.className = 'b3d';
    let renderer;
    try { renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' }); } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = T3.PCFShadowMap;
    const scene = new T3.Scene();
    const FOV = 38;
    const cam = new T3.PerspectiveCamera(FOV, 1, .1, 200);
    const CAM = { pos: V(-2.1, 1.85, 5.6), look: V(.45, .72, -.7) };   // 默认机位：低一点、平一点，远景画露得多
    const hemi = new T3.HemisphereLight(0xeaf6ff, 0x9fcf7a, 1.5);
    const sun = new T3.DirectionalLight(0xfff1d8, 2.2);
    sun.position.set(-3, 7, 4); sun.castShadow = renderer.shadowMap.enabled; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 }); sun.shadow.bias = -.001;
    scene.add(hemi, sun);

    // ---------- 场地 ----------
    const env = new T3.Group(); scene.add(env);
    const POS = { me: V(-1.15, 0, 1.25), foe: V(1.45, 0, -1.7) };
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
      // 两个台子
      ['me', 'foe'].forEach(k => {
        const pad = new T3.Mesh(new T3.CylinderGeometry(1.15, 1.25, .12, 40), new T3.MeshToonMaterial({ color: t.pad }));
        pad.position.copy(POS[k]).setY(.02); pad.receiveShadow = true; env.add(pad);
        const rim = new T3.Mesh(new T3.TorusGeometry(1.2, .05, 6, 40), new T3.MeshBasicMaterial({ color: t.rim }));
        rim.rotation.x = Math.PI / 2; rim.position.copy(POS[k]).setY(.08); env.add(rim);
      });
      env.userData.t = t;
    }

    // ---------- 怪兽 ----------
    const M = { me: null, foe: null };
    function setMon(side, sp, hidden) {
      if (M[side]) { scene.remove(M[side].R.root); Mon3D.dispose(M[side].R); }
      const R = Mon3D.build(sp, { unique: true });
      R.root.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.isMeshToonMaterial && !o.material.userData.own) o.material = o.material.clone(); if (o.material && o.material.userData.sprite) o.castShadow = false; } });
      const P = POS[side], other = POS[side === 'me' ? 'foe' : 'me'];
      R.root.position.copy(P);
      R.root.rotation.y = Math.atan2(other.x - P.x, other.z - P.z) + (side === 'me' ? .1 : -.55);
      const k = (side === 'me' ? 1.05 : 1.25) * (sp.legend ? 1.3 : 1) / Math.max(1, R.height * .9);
      R.root.scale.multiplyScalar(k);
      R.baseScale = R.root.scale.x;
      scene.add(R.root);
      M[side] = { R, sp, off: V(0, 0, 0), flash: 0, talk: 0, gone: !!hidden };
      R.root.visible = !hidden;
      return M[side];
    }
    const mats = side => { const a = []; M[side].R.root.traverse(o => { if (o.isMesh && o.material && (o.material.isMeshToonMaterial || o.material.userData.sprite)) a.push(o.material); }); return a; };

    // ---------- 粒子 ----------
    const MAXP = 700;
    const pGeo = new T3.BufferGeometry();
    const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
    pGeo.setAttribute('position', new T3.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new T3.BufferAttribute(pCol, 3));
    pGeo.setAttribute('size', new T3.BufferAttribute(pSize, 1));
    pGeo.setAttribute('alpha', new T3.BufferAttribute(pAlpha, 1));
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T3.CanvasTexture(c); })();
    const pMat = new T3.ShaderMaterial({
      uniforms: { uTex: { value: glowTex }, uScale: { value: 300 } },
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float core = smoothstep(0.55, 1.0, t.a); gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.45), t.a * vA); }',
      transparent: true, depthWrite: false, blending: T3.NormalBlending,
    });
    const points = new T3.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
    const parts = [];
    // p：{ pos, vel, col, size, life, grav, drag, grow, fade }
    function emit(n, fn) { for (let i = 0; i < n && parts.length < MAXP; i++) parts.push(fn(i)); }
    const rnd = (a, b) => a + Math.random() * (b - a);
    const sph = s => V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(s);
    const C = h => new T3.Color(h);

    // ---------- 特效用的小物件（带生命周期的网格） ----------
    const fx = [];
    function addFx(obj, life, update) { scene.add(obj); fx.push({ obj, t: 0, life, update }); return obj; }
    const glowMat = (col, op) => new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: op == null ? .9 : op, depthWrite: false });
    function ring(at, col, r0, r1, life, thick, flat) {
      const m = new T3.Mesh(new T3.TorusGeometry(1, thick || .06, 6, 40), glowMat(col));
      m.position.copy(at); if (flat !== false) m.rotation.x = Math.PI / 2;
      return addFx(m, life, (o, k) => { const r = r0 + (r1 - r0) * k; o.scale.set(r, r, r); o.material.opacity = .9 * (1 - k); });
    }
    function orb(col, r) { const g = new T3.Group(); g.add(new T3.Mesh(new T3.SphereGeometry(r, 14, 10), glowMat(col, .95))); g.add(new T3.Mesh(new T3.SphereGeometry(r * 1.8, 14, 10), glowMat(col, .35))); return g; }
    function bolt(a, b, col, width, jag) {
      const pts = [], n = 9;
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i && i < n) p.add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(jag || .25)); pts.push(p); }
      const g = new T3.Group();
      for (let i = 0; i < n; i++) {
        const s = pts[i], e = pts[i + 1], len = s.distanceTo(e);
        const seg = new T3.Mesh(new T3.CylinderGeometry(width, width, len, 5), glowMat(col, 1));
        seg.position.copy(s).lerp(e, .5); seg.quaternion.setFromUnitVectors(V(0, 1, 0), e.clone().sub(s).normalize()); g.add(seg);
      }
      return g;
    }
    function beam(a, b, col, width, life) {
      const len = a.distanceTo(b), m = new T3.Mesh(new T3.CylinderGeometry(width, width, len, 10, 1, true), glowMat(col, .85));
      m.position.copy(a).lerp(b, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
      return addFx(m, life, (o, k) => { const s = Math.sin(Math.min(1, k * 1.2) * Math.PI); o.scale.set(s + .05, 1, s + .05); o.material.opacity = .9 * s; });
    }
    function chunks(geoFn, col, n, at, spread, life, fly) {
      for (let i = 0; i < n; i++) {
        const m = new T3.Mesh(geoFn(), new T3.MeshToonMaterial({ color: col, transparent: true }));
        const v = fly ? fly(i) : sph(rnd(1.5, 3)).setY(rnd(1.5, 4));
        m.position.copy(at).add(sph(spread || .2));
        m.rotation.set(rnd(0, 6), rnd(0, 6), 0);
        addFx(m, life, (o, k, dt) => { v.y -= 9 * dt; o.position.addScaledVector(v, dt); o.rotation.x += dt * 6; if (o.position.y < .05) { o.position.y = .05; v.set(v.x * .5, -v.y * .3, v.z * .5); } o.material.opacity = k > .7 ? (1 - k) / .3 : 1; });
      }
    }
    const leafGeo = () => { const s = new T3.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.06, .05, 0, .16); s.quadraticCurveTo(-.06, .05, 0, 0); return new T3.ShapeGeometry(s); };

    // ---------- 镜头震动、闪屏 ----------
    let shake = 0, flashEl = null;
    function flash(col, ms) {
      if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'b3d-flash'; }
      if (flashEl.parentNode !== host) host.appendChild(flashEl);
      flashEl.style.background = col || '#fff';
      flashEl.style.transition = 'none'; flashEl.style.opacity = '.8';
      void flashEl.offsetWidth;
      flashEl.style.transition = 'opacity ' + (ms || 350) + 'ms'; flashEl.style.opacity = '0';
    }

    // ---------- 运镜（仿新世代对战：开场横扫、放招过肩、命中推近、倒下慢推） ----------
    // 镜头的目标用函数给出，怪兽动了镜头也跟着；拍完一定回到默认机位（CAM），screenPos 按默认机位算
    const RM = opts.reduced != null ? !!opts.reduced : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const CINE = opts.cinematic !== false && !RM;   // 减少动态效果时只用默认机位
    const EZ = {
      io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
      out: k => 1 - Math.pow(1 - k, 3),
      sine: k => .5 - Math.cos(k * Math.PI) / 2,
    };
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
    // 放招前：站在出招方身后（过肩），看着对手
    function shotShoulder(side) {
      return () => {
        const other = side === 'me' ? 'foe' : 'me', a = center(side), b = center(other);
        const d = b.clone().sub(a).setY(0).normalize(), r = V(-d.z, 0, d.x), h = monH(side);
        if (side === 'me') {
          // 我方：从右后方低一点看过去，自己在左下、对手在画面中间偏右
          const back = (1.9 + h * .8) * camF;
          const pos = a.clone().addScaledVector(d, -back).addScaledVector(r, 1.35 * camF).setY(Math.max(1.3, h * 1.25));
          return { pos, look: lerpV(a, b, .62).setY(b.y * .8 + .2) };
        }
        // 对方：从它身后高处往下看我方（远景画在背后，抬高机位让画面里不露出没画的那一侧）
        const back = (2.4 + h * .6) * camF;
        const pos = a.clone().addScaledVector(d, -back).addScaledVector(r, 1.3 * camF).setY(Math.max(3.3, h * 2.2));
        return { pos, look: lerpV(a, b, .68).setY(.3) };
      };
    }
    // 招式飞出去：从默认机位稍微推向挨打的一方
    function shotToward(side, k, lk) { return () => { const c = center(side); return { pos: lerpV(CAM.pos, c, k), look: lerpV(CAM.look, c, lk) }; }; }
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

    // ---------- 招式特效 ----------
    const center = side => { const m = M[side]; return m.R.root.position.clone().add(V(0, m.R.height * m.R.root.scale.x / m.R.size * .5, 0)); };
    // 弹道：从 a 飞到 b，沿途拖尾粒子
    function fly(a, b, ms, obj, trail) {
      return new Promise(res => {
        if (obj) { obj.position.copy(a); scene.add(obj); }
        const t0 = performance.now(), arc = a.distanceTo(b) * .15;
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / ms), p = a.clone().lerp(b, k); p.y += Math.sin(k * Math.PI) * arc;
          if (obj) obj.position.copy(p);
          if (trail) trail(p);
          if (k < 1) requestAnimationFrame(step); else { if (obj) scene.remove(obj); res(); }
        };
        step();
      });
    }
    function burst(at, cols, n, speed, size, life, grav) {
      emit(n, () => ({ pos: at.clone(), vel: sph(rnd(.4, 1) * speed), col: C(cols[Math.random() < .6 ? 0 : 1]), size: size * rnd(.6, 1.3), life: life * rnd(.7, 1.2), t: 0, grav: grav || 0, drag: 1.6 }));
    }
    function rise(at, cols, n, r, h, size, life) {
      emit(n, () => { const a = rnd(0, 6.28), rr = rnd(0, r); return { pos: at.clone().add(V(Math.cos(a) * rr, rnd(0, .2), Math.sin(a) * rr)), vel: V(0, rnd(.6, 1) * h, 0), col: C(cols[Math.random() < .5 ? 0 : 1]), size: size * rnd(.6, 1.2), life: life * rnd(.6, 1.1), t: 0, grav: 0, drag: .5 }; });
    }
    const FX = {};
    // 每个属性：tier 0 小招、1 中招、2 大招。返回 Promise，命中那一刻 resolve
    FX.default = async (a, b, t, cols) => {
      const o = orb(cols[0], .12 + t * .05);
      await fly(a, b, 420, o, p => emit(2, () => ({ pos: p.clone(), vel: sph(.3), col: C(cols[1]), size: .25, life: .35, t: 0 })));
      burst(b, cols, 30 + t * 30, 3 + t, .5, .6);
      ring(b, cols[0], .2, 1.4 + t * .6, .45);
    };
    FX.fire = async (a, b, t, cols) => {
      if (t < 2) {
        const o = orb('#ff9a3c', .14 + t * .06);
        await fly(a, b, 460, o, p => emit(4, () => ({ pos: p.clone().add(sph(.08)), vel: V(rnd(-.3, .3), rnd(.5, 1.2), rnd(-.3, .3)), col: C(Math.random() < .5 ? '#ff5a1f' : '#ffd54f'), size: .5, life: .45, t: 0 })));
        burst(b, ['#ff5a1f', '#ffd54f'], 50 + t * 40, 3.5, .6, .7, -1.5);
        if (t) ring(b.clone().setY(.1), '#ff7a2f', .3, 1.8, .5);
      } else {
        const g = b.clone().setY(0);
        for (let i = 0; i < 6; i++) { rise(g, ['#ff5a1f', '#ffd54f'], 40, .6, 4, .8, .8); await sleep(70); }
        flash('#ffb070', 400); shake = .25;
        burst(b, ['#ff5a1f', '#ffe082'], 90, 5, .8, .8, -2);
        ring(g.clone().setY(.1), '#ff7a2f', .4, 2.6, .6, .1);
      }
    };
    FX.water = async (a, b, t, cols) => {
      if (t === 0) {
        for (let i = 0; i < 4; i++) { const o = new T3.Mesh(new T3.SphereGeometry(.09, 12, 8), glowMat('#8fd8ff', .6)); fly(a.clone().add(sph(.15)), b.clone().add(sph(.2)), 420 + i * 60, o); await sleep(60); }
        await sleep(300);
      } else {
        await new Promise(res => { let k = 0; const iv = setInterval(() => { k++; emit(10, () => { const p = a.clone(); const d = b.clone().sub(a); return { pos: p.add(sph(.1)), vel: d.multiplyScalar(rnd(1.6, 2.1)).add(V(0, 1.4, 0)), col: C(Math.random() < .6 ? '#3fa9f5' : '#e0f7ff'), size: .45, life: .55, t: 0, grav: -4 }; }); if (k > (t === 2 ? 14 : 8)) { clearInterval(iv); res(); } }, 30); });
        await sleep(220);
      }
      burst(b, ['#3fa9f5', '#e0f7ff'], 60 + t * 30, 3, .5, .7, -5);
      if (t === 2) { const g = b.clone().setY(0); rise(g, ['#3fa9f5', '#ffffff'], 160, .7, 5, .7, .9); ring(g.clone().setY(.08), '#8fd8ff', .3, 2.4, .7, .09); shake = .2; flash('#bfe9ff', 300); }
    };
    FX.grass = async (a, b, t, cols) => {
      const n = 5 + t * 5;
      const leaves = [];
      for (let i = 0; i < n; i++) {
        const m = new T3.Mesh(leafGeo(), new T3.MeshToonMaterial({ color: i % 2 ? '#5fd35f' : '#9be86b', side: T3.DoubleSide }));
        m.userData.off = i / n * 6.28; leaves.push(m);
        fly(a.clone().add(sph(.2)), b.clone().add(sph(.25)), 480 + i * 30, m, null);
        const spin = () => { if (!m.parent) return; m.rotation.x += .3; m.rotation.z += .2; requestAnimationFrame(spin); }; spin();
      }
      await sleep(500 + n * 30);
      burst(b, ['#5fd35f', '#d4ff8a'], 40 + t * 30, 3, .45, .6);
      if (t === 2) { const top = b.clone().setY(7); beam(top, b.clone().setY(0), '#fff59d', .35, .7); flash('#fff9c4', 400); shake = .15; chunks(leafGeo, '#5fd35f', 16, b, .3, 1.2); }
    };
    FX.spark = async (a, b, t, cols) => {
      if (t < 2) {
        for (let i = 0; i < 2 + t * 2; i++) { addFx(bolt(a, b, i % 2 ? '#ffffff' : '#ffe14d', .025 + t * .01, .3), .18, (o, k) => { o.visible = Math.random() > .2; }); await sleep(90); }
      } else {
        for (let i = 0; i < 4; i++) { addFx(bolt(b.clone().setY(8).add(V(rnd(-.5, .5), 0, rnd(-.5, .5))), b.clone(), '#ffffff', .06, .5), .25, o => { o.visible = Math.random() > .25; }); flash(i % 2 ? '#fffbe0' : '#ffffff', 200); await sleep(110); }
        shake = .3;
      }
      burst(b, ['#ffe14d', '#ffffff'], 50 + t * 40, 4, .35, .45);
      ring(b, '#ffe14d', .2, 1.5 + t * .5, .35, .04, false);
    };
    FX.ice = async (a, b, t, cols) => {
      const shard = () => new T3.OctahedronGeometry(.08, 0);
      if (t < 2) {
        for (let i = 0; i < 3 + t * 3; i++) { const m = new T3.Mesh(shard(), glowMat('#bff3ff', .9)); m.scale.set(.6, 2, .6); fly(a.clone().add(sph(.15)), b.clone().add(sph(.2)), 380 + i * 40, m); await sleep(40); }
        await sleep(360);
      } else {
        const g = b.clone().setY(0);
        for (let i = 0; i < 8; i++) {
          const an = i / 8 * 6.28, m = new T3.Mesh(new T3.ConeGeometry(.16, .9, 6), new T3.MeshToonMaterial({ color: '#bff3ff', transparent: true, opacity: .9 }));
          m.position.copy(g).add(V(Math.cos(an) * .75, -.5, Math.sin(an) * .75)); m.rotation.set(Math.sin(an) * .3, 0, -Math.cos(an) * .3);
          addFx(m, 1.1, (o, k) => { o.position.y = -.5 + Math.min(1, k * 5) * .9 - (k > .8 ? (k - .8) * 4 : 0); });
        }
        await sleep(200); shake = .25; flash('#e0fbff', 350);
      }
      burst(b, ['#9be7ff', '#ffffff'], 60 + t * 30, 3, .4, .7, -2);
      ring(b.clone().setY(.08), '#bff3ff', .3, 1.6 + t * .6, .6);
    };
    FX.fight = async (a, b, t, cols, side) => {
      const hits = t === 2 ? 3 : 1;
      for (let i = 0; i < hits; i++) {
        const p = b.clone().add(sph(.2));
        burst(p, ['#ffffff', '#ffb74d'], 30, 4, .45, .35);
        ring(p, '#ffffff', .1, .9, .25, .05, false).lookAt(cam.position);
        shake = .12 + t * .05;
        await sleep(150);
      }
    };
    FX.poison = async (a, b, t, cols) => {
      for (let i = 0; i < 3 + t * 2; i++) { const o = new T3.Mesh(new T3.SphereGeometry(.1, 10, 8), new T3.MeshToonMaterial({ color: i % 2 ? '#b25ce6' : '#8e24aa' })); fly(a.clone().add(sph(.1)), b.clone().add(sph(.2)), 480 + i * 50, o); await sleep(50); }
      await sleep(420);
      rise(b.clone().setY(.2), ['#b25ce6', '#e8b8ff'], 50 + t * 50, .5 + t * .3, 1.5, .5, 1.1);
      if (t === 2) { flash('#e1bee7', 400); shake = .15; }
    };
    FX.ground = async (a, b, t, cols) => {
      const rock = () => new T3.IcosahedronGeometry(.1 + Math.random() * .06, 0);
      if (t < 2) { for (let i = 0; i < 3 + t * 3; i++) { const m = new T3.Mesh(rock(), new T3.MeshToonMaterial({ color: '#a0703a' })); fly(a.clone().add(sph(.15)), b.clone().add(sph(.2)), 420 + i * 40, m); await sleep(40); } await sleep(380); }
      else { shake = .45; const g = b.clone().setY(.05); for (let i = 0; i < 3; i++) { ring(g, '#c9964a', .2, 2.6, .55, .12); chunks(rock, '#a0703a', 8, g, .5, 1.3); await sleep(160); } }
      burst(b.clone().setY(.2), ['#c9964a', '#f0d7a0'], 50 + t * 30, 2.5, .6, .8, -3);
    };
    FX.flying = async (a, b, t, cols) => {
      for (let i = 0; i < 2 + t * 2; i++) { const r = ring(a.clone(), '#ffffff', .25, .5, .6, .03, false); r.lookAt(b); fly(a, b, 450, r); await sleep(90); }
      await sleep(360);
      if (t === 2) { const g = b.clone().setY(0); for (let i = 0; i < 40; i++) { const an = i * .5; emit(4, () => ({ pos: g.clone().add(V(Math.cos(an) * .5, i * .06, Math.sin(an) * .5)), vel: V(-Math.sin(an) * 2, 1.5, Math.cos(an) * 2), col: C('#ffffff'), size: .4, life: .7, t: 0 })); } shake = .15; }
      burst(b, ['#ffffff', '#cfe3ff'], 40 + t * 30, 3.5, .45, .5);
    };
    FX.psychic = async (a, b, t, cols) => {
      for (let i = 0; i < 3 + t * 2; i++) { const r = ring(a.clone(), '#ff5ea8', .2, .35, .7, .035, false); r.lookAt(b); fly(a, b, 520, r); await sleep(110); }
      await sleep(420);
      for (let i = 0; i < 3; i++) ring(b, i % 2 ? '#ffd0e8' : '#ff5ea8', .2, 1.4 + t * .5, .5 + i * .1, .04, false).lookAt(cam.position);
      if (t === 2) { flash('#ffc1e3', 450); shake = .18; }
      burst(b, ['#ff5ea8', '#ffd0e8'], 30 + t * 30, 2.5, .45, .6);
    };
    FX.bug = async (a, b, t, cols) => {
      if (t === 1) { beam(a, b, '#ffffff', .03, .5); await sleep(200); }
      else emit(40 + t * 40, i => { const d = b.clone().sub(a); return { pos: a.clone().add(sph(.2)), vel: d.multiplyScalar(rnd(1.8, 2.4)).add(sph(.8)), col: C(i % 2 ? '#a6d11f' : '#4e6b10'), size: .22, life: .55, t: 0, drag: .2 }; });
      await sleep(t === 1 ? 150 : 420);
      burst(b, ['#a6d11f', '#eaff9a'], 30 + t * 30, 3, .35, .5);
    };
    FX.rock = async (a, b, t, cols) => {
      const rock = () => new T3.IcosahedronGeometry(.14 + Math.random() * .08, 0);
      if (t < 2) { for (let i = 0; i < 2 + t * 2; i++) { const m = new T3.Mesh(rock(), new T3.MeshToonMaterial({ color: '#9c8850' })); fly(a.clone().add(sph(.15)), b.clone().add(sph(.2)), 420 + i * 50, m); await sleep(60); } await sleep(380); }
      else { for (let i = 0; i < 5; i++) { const m = new T3.Mesh(new T3.IcosahedronGeometry(.3, 0), new T3.MeshToonMaterial({ color: '#9c8850' })); const from = b.clone().add(V(rnd(-.6, .6), 6, rnd(-.6, .6))); fly(from, b.clone().add(V(rnd(-.4, .4), 0, rnd(-.4, .4))), 380, m); await sleep(120); shake = .3; } await sleep(200); }
      burst(b.clone().setY(.3), ['#b09a50', '#e8dcb0'], 50 + t * 30, 3, .55, .7, -3);
    };
    FX.ghost = async (a, b, t, cols) => {
      if (t < 2) { const o = orb('#7d5ce6', .16 + t * .05); await fly(a, b, 560, o, p => emit(3, () => ({ pos: p.clone(), vel: sph(.2), col: C('#4a2a8a'), size: .5, life: .6, t: 0 }))); }
      else { flash('#1a0f2e', 600); for (let i = 0; i < 6; i++) { rise(b.clone().setY(0), ['#7d5ce6', '#2a1a4a'], 30, 1, 1.4, .8, 1.2); await sleep(80); } shake = .2; }
      burst(b, ['#7d5ce6', '#b388ff'], 40 + t * 30, 2.5, .6, .7);
    };
    FX.dragon = async (a, b, t, cols) => {
      if (t === 0) await FX.default(a, b, 0, ['#6a4dff', '#ff5ea8']);
      else {
        await new Promise(res => { let k = 0; const iv = setInterval(() => { k++; emit(12, () => { const d = b.clone().sub(a); return { pos: a.clone().add(sph(.08)), vel: d.multiplyScalar(rnd(1.8, 2.2)).add(sph(.4)), col: C(Math.random() < .5 ? '#6a4dff' : '#ff5ea8'), size: .6, life: .5, t: 0 }; }); if (k > 12) { clearInterval(iv); res(); } }, 30); });
        await sleep(200);
      }
      if (t === 2) { for (let i = 0; i < 3; i++) { ring(b, '#6a4dff', .3, 2.4, .5, .08, false).lookAt(cam.position); await sleep(90); } flash('#d1c4ff', 400); shake = .3; }
      burst(b, ['#6a4dff', '#ff5ea8'], 50 + t * 30, 3.5, .55, .6);
    };
    FX.dark = async (a, b, t, cols) => {
      if (t === 2) flash('#20122e', 500);
      for (let i = 0; i < 1 + t; i++) {
        const m = new T3.Mesh(new T3.TorusGeometry(.5, .04, 4, 24, Math.PI * .8), glowMat(i % 2 ? '#b388ff' : '#ffffff'));
        m.position.copy(b); m.lookAt(cam.position); m.rotateZ(rnd(-1, 1));
        addFx(m, .3, (o, k) => { o.material.opacity = 1 - k; o.scale.setScalar(.8 + k * .6); });
        shake = .1 + t * .06; await sleep(140);
      }
      burst(b, ['#4a3a55', '#b388ff'], 40 + t * 30, 3, .55, .6);
    };
    FX.steel = async (a, b, t, cols) => {
      if (t < 2) { for (let i = 0; i < 3 + t * 2; i++) { const m = new T3.Mesh(new T3.TorusGeometry(.1, .03, 4, 12), new T3.MeshToonMaterial({ color: '#cfd8dc' })); fly(a.clone().add(sph(.1)), b.clone().add(sph(.2)), 420 + i * 40, m); const sp = () => { if (!m.parent) return; m.rotation.y += .5; requestAnimationFrame(sp); }; sp(); await sleep(50); } await sleep(380); }
      else { const m = new T3.Mesh(new T3.IcosahedronGeometry(.45, 1), new T3.MeshToonMaterial({ color: '#b0c4d4', emissive: '#223344' })); await fly(b.clone().add(V(-2, 7, -1)), b, 520, m, p => emit(4, () => ({ pos: p.clone(), vel: sph(.3), col: C('#ffd54f'), size: .6, life: .5, t: 0 }))); flash('#ffffff', 300); shake = .4; }
      burst(b, ['#b0c4d4', '#ffffff'], 50 + t * 30, 4, .4, .5);
      ring(b.clone().setY(.08), '#ffffff', .2, 1.4 + t * .8, .45);
    };
    FX.normal = async (a, b, t, cols) => { await sleep(120); for (let i = 0; i <= t; i++) { burst(b.clone().add(sph(.15)), ['#ffffff', '#ffe082'], 30, 3.5, .45, .35); ring(b, '#ffffff', .1, 1 + t * .4, .3, .05, false).lookAt(cam.position); shake = .1 + t * .1; await sleep(140); } };

    // ---------- 对外：出场 / 放招 / 受击 / 倒下 / 扔球 ----------
    const anim = [];
    function tween(ms, fn) { return new Promise(res => anim.push({ t0: performance.now(), ms, fn, res })); }
    async function enter(side, fromBall) {
      const m = M[side]; if (!m) return;
      m.gone = false; m.R.root.visible = true;
      if (Mon3D.play) Mon3D.play(m.R, 'idle');
      if (!introDone) intro();
      else if (!shot) { camTo(shotToward(side, .16, .45), 450, EZ.out); camHome(750, 700); }
      const s = m.R.baseScale;
      if (fromBall) { const p = center(side); burst(p, ['#ffffff', '#b388ff'], 40, 3, .5, .5); ring(p.clone().setY(.1), '#ffffff', .2, 1.5, .45); }
      else emit(24, () => ({ pos: m.R.root.position.clone().add(V(rnd(-.6, .6), .05, rnd(-.6, .6))), vel: V(rnd(-.5, .5), rnd(.3, .8), rnd(-.5, .5)), col: C('#e8dcb0'), size: .6, life: .6, t: 0 }));
      await tween(420, k => { const e = 1 - Math.pow(1 - k, 3); m.R.root.scale.setScalar(s * (e + Math.sin(k * Math.PI) * .15)); });
    }
    async function attack(side, type, tier, support) {
      const other = side === 'me' ? 'foe' : 'me', m = M[side], o = M[other];
      if (!m || !o) return;
      if (support) {
        // 辅助招式：原地发光一圈，不飞出去
        m.talk = 1;
        camTo(shotToward(side, .14, .4), 350, EZ.out);
        const c = TYPE_COL[type] || TYPE_COL.normal, p = center(side);
        ring(m.R.root.position.clone().setY(.08), c[0], .3, 1.4, .6, .06);
        rise(m.R.root.position.clone(), c, 40, .5, 1.6, .45, .8);
        await tween(500, k => { m.off.y = Math.sin(k * Math.PI) * .15; });
        m.talk = 0;
        camHome(600, 150);
        return;
      }
      const a = center(side), b = center(other), dir = b.clone().sub(a).setY(0).normalize();
      m.talk = 1;
      const physical = type === 'fight' || type === 'normal';
      // 运镜：先切到出招方身后（过肩），蓄力时看着对手；招式飞出去时镜头跟着推向对手
      if (CINE) { camTo(shotShoulder(side), 300, EZ.out); await sleep(150); }
      if (Mon3D.play && Mon3D.play(m.R, 'attack')) await sleep(physical ? 430 : 360);   // 会动的模型自己扑出去
      else await tween(physical ? 260 : 200, k => { m.off.copy(dir).multiplyScalar(Math.sin(k * Math.PI) * (physical ? .9 : .35)); });
      m.talk = 0;
      camTo(shotToward(other, other === 'me' ? .12 : .2, .5), 520, EZ.io);
      const cols = TYPE_COL[type] || TYPE_COL.normal;
      await (FX[type] || FX.default)(a.clone().addScaledVector(dir, .3), b, tier || 0, cols, side);
      camHome(650, 260);   // 命中后稍停一下再回默认机位（hit 会再推一下）
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
      if (opt.crit) { shake = Math.max(shake, .3); flash('#fff8e1', 320); }
      camPunch(() => center(side), opt.crit ? .9 : .45, opt.crit ? 1000 : 800);   // 命中：镜头往挨打的一方推近，多停一会儿
      if (shot && shot.to !== HOME) camHome(750, opt.crit ? 900 : 700);
    }
    async function faint(side) {
      const m = M[side]; if (!m) return;
      const ms = mats(side);
      const fall = Mon3D.play ? Mon3D.play(m.R, 'faint') : 0;
      // 倒下时镜头慢慢推过去（怪兽在往下沉，按开始的位置推）；对方离得远，主要靠变焦，别从我方怪兽背后穿过去
      const at = center(side), foe = side === 'foe';
      camTo(() => ({ pos: lerpV(CAM.pos, at, foe ? .1 : .26).add(V(foe ? .35 * camF : 0, foe ? .45 : 0, 0)), look: lerpV(CAM.look, at, .8), fov: foe ? 27 : 33 }), fall ? fall * 1000 + 650 : 900, EZ.sine);
      if (fall) await sleep(fall * 1000 + 250);   // 会动的模型先侧倒，再淡出
      ms.forEach(q => { q.transparent = true; });
      await tween(fall ? 400 : 700, k => { if (!fall) m.off.y = -k * .6; ms.forEach(q => { q.opacity = 1 - k; }); });
      m.R.root.visible = false; m.gone = true;
      ms.forEach(q => { q.opacity = 1; q.transparent = !!q.userData.sprite; }); m.off.set(0, 0, 0);
      camHome(750, 200);
    }
    // 异常状态：烧伤火星、中毒泡泡、麻痹电光、睡眠 Z、冰冻冰块、混乱星星
    const ST_COL = { brn: ['#ff5a1f', '#ffd54f'], psn: ['#9b4dca', '#e1bee7'], par: ['#ffe14d', '#ffffff'], slp: ['#7986cb', '#e8eaf6'], frz: ['#9be7ff', '#ffffff'], conf: ['#ff5ea8', '#fff59d'] };
    function status(side, kind) {
      const m = M[side]; if (!m) return;
      const c = ST_COL[kind] || ST_COL.conf, p = center(side);
      if (kind === 'slp' || kind === 'psn') rise(m.R.root.position.clone().setY(.4), c, 30, .4, 1.2, .5, 1.2);
      else if (kind === 'par') { for (let i = 0; i < 3; i++) addFx(bolt(p.clone().add(sph(.5)), p.clone().add(sph(.5)), '#ffe14d', .02, .15), .25, o => { o.visible = Math.random() > .3; }); burst(p, c, 25, 2.5, .3, .4); }
      else if (kind === 'frz') { chunks(() => new T3.OctahedronGeometry(.08, 0), '#bff3ff', 10, p, .3, .9); burst(p, c, 30, 2, .4, .6); }
      else if (kind === 'conf') { for (let i = 0; i < 3; i++) ring(p.clone().add(V(0, .5, 0)), c[i % 2], .1, .5, .8, .03).rotation.x = Math.PI / 2; }
      else burst(p, c, 40, 2.5, .45, .7, 1);
      m.flash = .6;
    }
    // 能力升降：往上飘的绿光 / 往下沉的蓝光
    function buff(side, up) {
      const m = M[side]; if (!m) return;
      const at = m.R.root.position.clone();
      emit(40, () => { const a = rnd(0, 6.28), r = rnd(.2, .7); return { pos: at.clone().add(V(Math.cos(a) * r, up ? rnd(0, .4) : rnd(1, 1.6), Math.sin(a) * r)), vel: V(0, up ? rnd(1.2, 2) : -rnd(1.2, 2), 0), col: C(up ? '#7dffb0' : '#6ab7ff'), size: .35, life: .8, t: 0 }; });
      ring(at.clone().setY(up ? .1 : 1.2), up ? '#7dffb0' : '#6ab7ff', .3, 1.1, .5, .05);
    }
    function heal(side) { const m = M[side]; if (!m) return; rise(m.R.root.position.clone(), ['#7dffb0', '#ffffff'], 60, .6, 1.8, .45, 1); }
    // 扔球收服：wobbles 次摇晃；ok 为 true 就收服成功
    const ballMesh = () => { const g = new T3.Group(); const top = new T3.Mesh(new T3.SphereGeometry(.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new T3.MeshToonMaterial({ color: '#8e6cef' })); const bot = new T3.Mesh(new T3.SphereGeometry(.16, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T3.MeshToonMaterial({ color: '#ffffff' })); const band = new T3.Mesh(new T3.TorusGeometry(.16, .018, 6, 24), new T3.MeshToonMaterial({ color: '#2b2b3a' })); band.rotation.x = Math.PI / 2; const btn = new T3.Mesh(new T3.SphereGeometry(.045, 10, 8), new T3.MeshToonMaterial({ color: '#ffffff' })); btn.position.z = .15; g.add(top, bot, band, btn); return g; };
    let ball = null;
    async function catchThrow(sup) {
      const m = M.foe;
      ball = ballMesh(); if (sup) ball.children[0].material.color.set('#26c6da');
      const a = center('me'), b = center('foe');
      await fly(a, b.clone().add(V(0, .2, 0)), 520, ball);
      scene.add(ball); ball.position.copy(b).add(V(0, .2, 0));
      flash('#ffffff', 250);
      const s = m.R.baseScale;
      await tween(320, k => { m.R.root.scale.setScalar(s * (1 - k)); });
      m.R.root.visible = false;
      await tween(300, k => { ball.position.y = b.y + .2 - k * (b.y + .05); });
      ball.position.y = .16;
    }
    async function wobble() { await tween(520, k => { ball.rotation.z = Math.sin(k * Math.PI * 2) * .5; }); }
    async function sealed() { burst(ball.position.clone(), ['#ffe082', '#ffffff'], 40, 2.5, .4, .7); ring(ball.position.clone(), '#ffe082', .1, 1, .5); await sleep(300); }
    async function breakOut() {
      const m = M.foe; flash('#ffffff', 250);
      burst(ball.position.clone(), ['#ffffff', '#b388ff'], 40, 3, .45, .5);
      scene.remove(ball); ball = null;
      m.R.root.visible = true;
      await tween(300, k => { m.R.root.scale.setScalar(m.R.baseScale * k); });
    }
    function removeBall() { if (ball) { scene.remove(ball); ball = null; } }

    // ---------- 每帧 ----------
    let raf = 0, last = 0, alive = true;
    const tmpC = new T3.Color();
    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now;
      const t = now / 1000;
      for (let i = anim.length - 1; i >= 0; i--) { const a = anim[i], k = Math.min(1, (now - a.t0) / a.ms); a.fn(k); if (k >= 1) { anim.splice(i, 1); a.res(); } }
      ['me', 'foe'].forEach(side => {
        const m = M[side]; if (!m) return;
        Mon3D.animate(m.R, t + (side === 'me' ? 0 : 1.3), { talk: m.talk ? Math.floor(t * 8) % 2 === 0 : false });
        m.R.root.position.copy(POS[side]).add(m.off);
        if (m.flash > 0) { m.flash = Math.max(0, m.flash - dt * 2.6); const e = Math.floor(m.flash * 10) % 2 ? m.flash : 0; mats(side).forEach(q => { if (q.emissive) q.emissive.setRGB(e, e, e); else q.color.setScalar(1 + e * 3); }); }
      });
      env.children.forEach(o => { if (o.userData.drift) { o.position.x += o.userData.drift * dt; if (o.position.x > 14) o.position.x = -14; } });
      // 粒子
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vel.y += (p.grav || 0) * dt; p.vel.multiplyScalar(Math.max(0, 1 - (p.drag || 0) * dt)); p.pos.addScaledVector(p.vel, dt);
      }
      const n = Math.min(parts.length, MAXP);
      for (let i = 0; i < n; i++) { const p = parts[i], k = p.t / p.life; pPos[i * 3] = p.pos.x; pPos[i * 3 + 1] = p.pos.y; pPos[i * 3 + 2] = p.pos.z; pCol[i * 3] = p.col.r; pCol[i * 3 + 1] = p.col.g; pCol[i * 3 + 2] = p.col.b; pSize[i] = p.size * (1 - k * .5); pAlpha[i] = 1 - k; }
      pGeo.setDrawRange(0, n);
      pMat.uniforms.uScale.value = host.clientHeight * 1.3;
      ['position', 'color', 'size', 'alpha'].forEach(k => { pGeo.attributes[k].needsUpdate = true; });
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const k = Math.min(1, f.t / f.life); if (f.update) f.update(f.obj, k, dt); if (k >= 1) { scene.remove(f.obj); f.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); fx.splice(i, 1); } }
      // 镜头：轻轻呼吸 + 震动
      shake = Math.max(0, shake - dt * 1.2);
      const cs = camStep(now);
      const drift = RM ? 0 : 1;   // 平时很慢地晃（减少动态效果时不晃）
      cam.position.copy(cs.pos).add(V(Math.sin(t * .23) * .12 * drift, Math.sin(t * .31) * .05 * drift, Math.sin(t * .17) * .06 * drift)).add(shake ? sph(shake * .25) : V(0, 0, 0));
      cam.lookAt(cs.look);
      if (Math.abs(cam.fov - cs.fov) > .01) { cam.fov = cs.fov; cam.updateProjectionMatrix(); }
      renderer.render(scene, cam);
    }
    function resize() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dpr || 1.5));
      renderer.setSize(w, h, false);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cam.aspect = w / h;
      // 竖屏把镜头拉远一点，两只怪兽都在画面里
      const f = w / h < 1 ? 1 + (1 - w / h) * .9 : 1;
      CAM.pos.set(-2.1 * f, 1.85 + (f - 1) * 1.1, 5.6 * f);
      if (f !== camF) { camF = f; placeBackdrop(); }
      cam.updateProjectionMatrix();
      pMat.uniforms.uScale.value = h * 1.3;
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
      ['me', 'foe'].forEach(s => { if (M[s]) { scene.remove(M[s].R.root); Mon3D.dispose(M[s].R); } });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove(); if (flashEl) flashEl.remove();
    }
    setEnv(opts.theme);
    mount(host);
    raf = requestAnimationFrame(frame);
    return { intro, setEnv, setMon, enter, attack, hit, faint, heal, status, buff, catchThrow, wobble, sealed, breakOut, removeBall, screenPos, mount, resize, destroy, get canvas() { return canvas; }, get camBusy() { return !!(shot || punch); } };
  }

  window.Battle3D = { create, TYPE_COL };
})();
