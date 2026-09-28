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
    const cam = new T3.PerspectiveCamera(38, 1, .1, 80);
    const CAM = { pos: V(-2.1, 2.1, 5.6), look: V(.45, .6, -.7) };
    const hemi = new T3.HemisphereLight(0xeaf6ff, 0x9fcf7a, 1.5);
    const sun = new T3.DirectionalLight(0xfff1d8, 2.2);
    sun.position.set(-3, 7, 4); sun.castShadow = renderer.shadowMap.enabled; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 }); sun.shadow.bias = -.001;
    scene.add(hemi, sun);

    // ---------- 场地 ----------
    const env = new T3.Group(); scene.add(env);
    const POS = { me: V(-1.15, 0, 1.25), foe: V(1.45, 0, -1.7) };
    function setEnv(theme) {
      while (env.children.length) { const o = env.children.pop(); o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material && q.material.map) q.material.map.dispose(); }); }
      const t = Object.assign({ sky1: '#7fc8f8', sky2: '#e8f7ff', ground: '#8fd16a', hill: '#6fbf5a', pad: '#c8e6a0', rim: '#7aa85a' }, theme || {});
      const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
      const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, t.sky1); gr.addColorStop(.7, t.sky2); gr.addColorStop(1, t.sky2);
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      const st = new T3.CanvasTexture(sky); st.colorSpace = T3.SRGBColorSpace; scene.background = st;
      scene.fog = new T3.Fog(t.sky2, 14, 34);
      const ground = new T3.Mesh(new T3.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new T3.MeshLambertMaterial({ color: t.ground }));
      ground.receiveShadow = true; env.add(ground);
      // 远处的小山和云
      for (let i = 0; i < 7; i++) {
        const h = new T3.Mesh(new T3.SphereGeometry(3 + (i % 3), 16, 10), new T3.MeshLambertMaterial({ color: i % 2 ? t.hill : new T3.Color(t.hill).offsetHSL(0, 0, .06) }));
        h.scale.set(1.4, .55, 1); h.position.set(-12 + i * 4.5, -.4, -14 - (i % 2) * 3); env.add(h);
      }
      for (let i = 0; i < 5; i++) {
        const cl = new T3.Group();
        [[0, 0, .8], [.8, .1, .6], [-.7, .05, .55]].forEach(([x, y, r]) => { const s = new T3.Mesh(new T3.SphereGeometry(r, 12, 8), new T3.MeshBasicMaterial({ color: '#ffffff' })); s.position.set(x, y, 0); cl.add(s); });
        cl.position.set(-9 + i * 5, 6 + (i % 2), -18); cl.userData.drift = .2 + i * .05; env.add(cl);
      }
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
      R.root.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.isMeshToonMaterial) o.material = o.material.clone(); } });
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
    const mats = side => { const a = []; M[side].R.root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) a.push(o.material); }); return a; };

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
      const s = m.R.baseScale;
      if (fromBall) { const p = center(side); burst(p, ['#ffffff', '#b388ff'], 40, 3, .5, .5); ring(p.clone().setY(.1), '#ffffff', .2, 1.5, .45); }
      else emit(24, () => ({ pos: m.R.root.position.clone().add(V(rnd(-.6, .6), .05, rnd(-.6, .6))), vel: V(rnd(-.5, .5), rnd(.3, .8), rnd(-.5, .5)), col: C('#e8dcb0'), size: .6, life: .6, t: 0 }));
      await tween(420, k => { const e = 1 - Math.pow(1 - k, 3); m.R.root.scale.setScalar(s * (e + Math.sin(k * Math.PI) * .15)); });
    }
    async function attack(side, type, tier) {
      const other = side === 'me' ? 'foe' : 'me', m = M[side], o = M[other];
      if (!m || !o) return;
      const a = center(side), b = center(other), dir = b.clone().sub(a).setY(0).normalize();
      m.talk = 1;
      const physical = type === 'fight' || type === 'normal';
      await tween(physical ? 260 : 200, k => { m.off.copy(dir).multiplyScalar(Math.sin(k * Math.PI) * (physical ? .9 : .35)); });
      m.talk = 0;
      const cols = TYPE_COL[type] || TYPE_COL.normal;
      await (FX[type] || FX.default)(a.clone().addScaledVector(dir, .3), b, tier || 0, cols, side);
    }
    function hit(side, opt) {
      const m = M[side]; if (!m) return;
      opt = opt || {};
      m.flash = 1;
      const back = center(side).sub(center(side === 'me' ? 'foe' : 'me')).setY(0).normalize();
      tween(380, k => { m.off.copy(back).multiplyScalar(Math.sin(k * Math.PI) * (opt.crit ? .35 : .18)); m.off.x += Math.sin(k * 40) * .03 * (1 - k); });
      if (opt.crit) { shake = Math.max(shake, .25); flash('#fff8e1', 250); }
    }
    async function faint(side) {
      const m = M[side]; if (!m) return;
      const ms = mats(side);
      ms.forEach(q => { q.transparent = true; });
      await tween(700, k => { m.off.y = -k * .6; ms.forEach(q => { q.opacity = 1 - k; }); });
      m.R.root.visible = false; m.gone = true;
      ms.forEach(q => { q.opacity = 1; q.transparent = false; }); m.off.set(0, 0, 0);
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
        if (m.flash > 0) { m.flash = Math.max(0, m.flash - dt * 4); const e = Math.floor(m.flash * 10) % 2 ? m.flash : 0; mats(side).forEach(q => { q.emissive.setRGB(e, e, e); }); }
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
      cam.position.copy(CAM.pos).add(V(Math.sin(t * .4) * .08, Math.sin(t * .5) * .04, 0)).add(shake ? sph(shake * .25) : V(0, 0, 0));
      cam.lookAt(CAM.look);
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
      CAM.pos.set(-2.1 * f, 2.1 + (f - 1) * 1.1, 5.6 * f);
      cam.updateProjectionMatrix();
      pMat.uniforms.uScale.value = h * 1.3;
    }
    // 怪兽在画面上的位置（给伤害数字、提示用），相对 host 左上角
    function screenPos(side) {
      const m = M[side]; if (!m) return [0, 0];
      const p = center(side).project(cam);
      return [(p.x + 1) / 2 * host.clientWidth, (1 - p.y) / 2 * host.clientHeight];
    }
    function mount(el) { host = el; el.prepend(canvas); resize(); }
    function destroy() {
      alive = false; cancelAnimationFrame(raf);
      ['me', 'foe'].forEach(s => { if (M[s]) { scene.remove(M[s].R.root); Mon3D.dispose(M[s].R); } });
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* 忽略 */ }
      canvas.remove(); if (flashEl) flashEl.remove();
    }
    setEnv(opts.theme);
    mount(host);
    raf = requestAnimationFrame(frame);
    return { setEnv, setMon, enter, attack, hit, faint, heal, catchThrow, wobble, sealed, breakOut, removeBall, screenPos, mount, resize, destroy, get canvas() { return canvas; } };
  }

  window.Battle3D = { create, TYPE_COL };
})();
