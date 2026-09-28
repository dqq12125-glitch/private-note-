// 回声岛 · 3D 怪兽：用一组参数拼出卡通渲染（描边 + 三阶明暗）的低多边形怪兽，带呼吸、眨眼、摇尾巴、扇翅膀
// 参数（每只怪兽一份，见 dex.js）：
//   b 身体：blob 团子 / biped 两脚站 / quad 四脚兽 / bird 鸟 / fish 鱼 / serpent 蛇龙 / bug 虫 / golem 岩石巨人 / ghost 幽灵 / plant 植物 / shell 背壳 / dragon 龙
//   c 主色  k 肚皮色  a 点缀色
//   e 头上：cat dog round bunny fin leaf antenna horn horns curl crest flame ice flower spikes crown cloud gem none
//   t 尾巴：flame fin leaf bolt fluffy curl spike feather stinger club cloud long none
//   w 翅膀：feather bat bug fairy none
//   p 花纹：spots stripes mask star none（默认都有肚皮）
//   m 嘴：smile fang beak grin o
//   x 其他装饰（数组）：mane crown shell leafback crystals flames cloud scarf antlers whiskers spikesback aura
//   eye 眼睛：big normal sharp sleepy fierce（不写就按进化阶段）
//   sz 大小倍数；stage 进化阶段 1/2/3；legend 神兽
(function () {
  'use strict';
  const T3 = window.THREE;
  if (!T3) return;
  const V = (x, y, z) => new T3.Vector3(x, y, z);

  // ---------- 材质 ----------
  const grad = (() => { const t = new T3.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, T3.RedFormat); t.minFilter = t.magFilter = T3.NearestFilter; t.needsUpdate = true; return t; })();
  const toonCache = {}, lineCache = {}, basicCache = {};
  const toon = (hex, emissive) => toonCache[hex + (emissive || '')] || (toonCache[hex + (emissive || '')] = new T3.MeshToonMaterial({ color: hex, gradientMap: grad, emissive: emissive || 0x000000 }));
  const basic = (hex, opts) => { const k = hex + JSON.stringify(opts || {}); return basicCache[k] || (basicCache[k] = new T3.MeshBasicMaterial(Object.assign({ color: hex }, opts || {}))); };
  // 描边：顶点沿法线往外推，只画背面
  const line = (hex, w) => {
    const k = hex + w;
    if (lineCache[k]) return lineCache[k];
    return (lineCache[k] = new T3.ShaderMaterial({
      uniforms: { uC: { value: new T3.Color(hex) }, uW: { value: w } },
      vertexShader: 'uniform float uW; void main(){ vec3 p = position + normal * uW; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0);\n#include <colorspace_fragment>\n}',
      side: T3.BackSide,
    }));
  };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  }

  // ---------- 贴图：眼睛和嘴 ----------
  const texCache = {};
  function canvasTex(key, w, h, fn) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = 4;
    return (texCache[key] = t);
  }
  function eyeTex(style, iris) {
    return canvasTex('eye' + style + iris, 128, 160, (g, w, h) => {
      const cx = 64, cy = 84;
      g.save();
      // 眼白 + 眼眶
      g.beginPath();
      if (style === 'sharp' || style === 'fierce') { g.moveTo(8, 60); g.quadraticCurveTo(64, 20, 122, 48); g.quadraticCurveTo(128, 130, 64, 150); g.quadraticCurveTo(4, 140, 8, 60); }
      else if (style === 'sleepy') { g.moveTo(6, 86); g.quadraticCurveTo(64, 62, 122, 86); g.quadraticCurveTo(122, 152, 64, 154); g.quadraticCurveTo(6, 152, 6, 86); }
      else g.ellipse(cx, cy, style === 'big' ? 56 : 50, style === 'big' ? 72 : 66, 0, 0, Math.PI * 2);
      g.closePath();
      g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#1d1a26'; g.stroke();
      g.clip();
      // 虹膜
      const ir = style === 'big' ? 42 : style === 'fierce' ? 30 : 36, iy = cy + (style === 'sleepy' ? 30 : 10);
      const gr = g.createRadialGradient(cx, iy + 12, 4, cx, iy, ir * 1.2);
      gr.addColorStop(0, shade(iris, 1.45)); gr.addColorStop(.55, iris); gr.addColorStop(1, shade(iris, .45));
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, iy, ir * .92, ir * 1.1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#15121c'; g.beginPath(); g.ellipse(cx, iy + 2, ir * .45, ir * .6, 0, 0, Math.PI * 2); g.fill();
      // 高光
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - ir * .38, iy - ir * .45, ir * .32, ir * .38, -.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + ir * .4, iy + ir * .45, ir * .14, 0, Math.PI * 2); g.fill();
      if (style === 'fierce') { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, w, 30); }
      g.restore();
      if (style === 'sleepy') { g.fillStyle = '#1d1a26'; g.fillRect(10, 80, 108, 7); }
    });
  }
  function mouthTex(kind) {
    return canvasTex('mouth' + kind, 128, 96, g => {
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#3a1a14'; g.lineWidth = 9;
      if (kind === 'o') { g.fillStyle = '#5a1f1a'; g.beginPath(); g.ellipse(64, 50, 22, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(64, 64, 13, 8, 0, 0, Math.PI * 2); g.fill(); }
      else if (kind === 'grin') { g.fillStyle = '#5a1f1a'; g.beginPath(); g.moveTo(24, 36); g.quadraticCurveTo(64, 96, 104, 36); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(34, 36, 60, 10); }
      else {
        g.beginPath(); g.moveTo(30, 40); g.quadraticCurveTo(64, 72, 98, 40); g.stroke();
        if (kind === 'fang') { g.fillStyle = '#fff'; g.lineWidth = 5; [[46, 50], [82, 50]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 8, y - 6); g.lineTo(x, y + 14); g.lineTo(x + 8, y - 5); g.closePath(); g.fill(); g.stroke(); }); }
      }
    });
  }
  const starTex = () => canvasTex('star', 64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 12 : 30; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); } g.fill(); });

  // ---------- 零件 ----------
  // ---------- 外部美术（样品对比用）：?art=blender 用 Blender 做的模型（art/blender/*.glb） ----------
  const ART_MODE = (() => { try { return new URLSearchParams(location.search).get('art') || localStorage.getItem('echo-art') || ''; } catch (e) { return ''; } })();
  const SAMPLES = ['emberpup', 'flamewolf', 'bubbly', 'sprouty', 'zappy', 'songlet', 'owlet', 'twigling', 'moonbunny', 'echodrake'];
  const EXT = {};
  const baseId = sp => String(sp.id || '').replace(/_shiny$/, '');
  function buildExt(sp, ext) {
    const root = new T3.Group();
    const R = { root, body: new T3.Group(), head: new T3.Group(), tail: new T3.Group(), wings: [], eyes: [], ears: new T3.Group(), float: 0, height: 1, ext: true };
    root.add(R.body);
    const model = ext.scene.clone(true);
    let top = 0.01;
    const meshes = []; model.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.forEach(o => {
      const glow = /glow/.test((o.material && o.material.name) || '');
      o.material = glow ? (EXT._glow || (EXT._glow = new T3.MeshBasicMaterial({ vertexColors: true }))) : (EXT._toon || (EXT._toon = new T3.MeshToonMaterial({ vertexColors: true, gradientMap: grad })));
      if (!glow) o.add(new T3.Mesh(o.geometry, line('#2a1c18', .011)));
      o.geometry.computeBoundingBox();
      top = Math.max(top, o.geometry.boundingBox.max.y);
    });
    model.scale.setScalar(1.15 / top);
    R.body.add(model);
    const stage = sp.stage || 1, S = (sp.sz || 1) * (sp.legend ? 1.5 : stage === 1 ? .82 : stage === 2 ? 1 : 1.22);
    root.scale.setScalar(S);
    R.size = S; R.height = 1.15 * S; R.base = 0; R.blinkAt = 99;
    return R;
  }
  const ready = (() => {
    if (ART_MODE !== 'blender' || !T3.GLTFLoader) return Promise.resolve();
    const L = new T3.GLTFLoader();
    return Promise.all(SAMPLES.map(id => new Promise(res => L.load((window.ECHO_BASE || '') + 'art/blender/' + id + '.glb', g => { EXT[id] = { scene: g.scene }; res(); }, undefined, () => res()))))
      .then(() => { for (const k in snapCache) delete snapCache[k]; window.dispatchEvent(new Event('mon3d-ready')); });
  })();

  function build(sp, opts) {
    if (!(opts && opts.proc) && EXT[baseId(sp)]) return buildExt(sp, EXT[baseId(sp)]);
    const root = new T3.Group();
    const W = .016;                               // 描边粗细
    const c = sp.c || '#8bc34a', k = sp.k || '#fff4d8', a = sp.a || '#ffca28', dk = shade(c, .42);
    const stage = sp.stage || 1, legend = !!sp.legend;
    const eyeStyle = sp.eye || (legend ? 'fierce' : stage === 1 ? 'big' : stage === 2 ? 'normal' : 'sharp');
    const R = { root, body: new T3.Group(), head: new T3.Group(), tail: new T3.Group(), wings: [], eyes: [], ears: new T3.Group(), float: 0, height: 1 };
    root.add(R.body);
    // 一个带描边的零件
    const part = (geo, col, parent, pos, rot, scl, opts) => {
      opts = opts || {};
      const m = new T3.Mesh(geo, opts.mat || toon(col, opts.glow));
      if (!opts.noLine) { const o = new T3.Mesh(geo, line(opts.lineCol || shade(col, .38), (opts.w || W) / Math.max(.3, Math.min(scl ? Math.min(scl[0], scl[1], scl[2]) : 1, 1)))); m.add(o); }
      if (pos) m.position.copy(pos);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      if (scl) m.scale.set(scl[0], scl[1], scl[2]);
      (parent || R.body).add(m);
      return m;
    };
    const sph = (r, d) => new T3.SphereGeometry(r, d || 20, Math.round((d || 20) * .75));
    const ico = (r, d) => new T3.IcosahedronGeometry(r, d == null ? 1 : d);
    const cap = (r, l) => new T3.CapsuleGeometry(r, l, 4, 10);
    const cone = (r, h, s) => new T3.ConeGeometry(r, h, s || 12);
    const cyl = (r1, r2, h) => new T3.CylinderGeometry(r1, r2, h, 10);
    const flat = (fn, depth) => { const s = new T3.Shape(); fn(s); return new T3.ExtrudeGeometry(s, { depth: depth || .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1, curveSegments: 8 }).center(); };
    const leafShape = s => { s.moveTo(0, 0); s.quadraticCurveTo(.16, .12, 0, .4); s.quadraticCurveTo(-.16, .12, 0, 0); };

    // ---------- 身体 ----------
    let H = null, bodyC = V(0, .5, 0), bodyR = [.5, .46, .47], tailAt = V(0, .4, -.42), wingAt = V(0, .62, -.25), backAt = V(0, .85, -.25), neckY = .8;
    const B = sp.b || 'blob';
    const head = (cx, cy, cz, r, scl) => { R.head.position.set(cx, cy, cz); R.body.add(R.head); part(sph(r, 24), c, R.head, V(0, 0, 0), null, scl); return { r, s: scl || [1, 1, 1] }; };
    const belly = (pos, r, scl) => part(sph(r, 18), k, R.body, pos, null, scl, { noLine: true });
    const feet = (pts, r, col) => pts.forEach(p => part(sph(r || .12, 12), col || shade(c, .82), R.body, p, null, [1, .55, 1.25]));
    if (B === 'blob') {
      H = head(0, .5, 0, .5, [1, .92, .95]); R.head.position.y = .48;
      bodyC = V(0, .48, 0); bodyR = [.5, .46, .47];
      belly(V(0, .38, .2), .3, [1, .8, .6]);
      feet([V(-.22, .06, .14), V(.22, .06, .14)], .14);
      [-1, 1].forEach(s => part(sph(.11, 12), c, R.body, V(s * .47, .42, .06)));
      neckY = .95; R.height = 1;
    } else if (B === 'biped' || B === 'dragon') {
      const dr = B === 'dragon';
      part(sph(dr ? .36 : .3, 20), c, R.body, V(0, dr ? .6 : .46, 0), null, [1, 1.08, .92]);
      belly(V(0, dr ? .56 : .43, dr ? .2 : .16), dr ? .26 : .22, [1, 1.1, .6]);
      H = head(0, dr ? 1.22 : .95, dr ? .06 : 0, dr ? .3 : .34);
      if (dr) part(cap(.13, .25), c, R.body, V(0, .95, .03), [.25, 0, 0]);
      [-1, 1].forEach(s => {
        part(cap(dr ? .11 : .085, dr ? .22 : .16), shade(c, .9), R.body, V(s * (dr ? .18 : .13), dr ? .2 : .15, 0));
        part(sph(dr ? .13 : .11, 12), shade(c, .8), R.body, V(s * (dr ? .18 : .13), .05, .06), null, [1, .55, 1.3]);
        part(cap(.07, .2), c, R.body, V(s * (dr ? .38 : .31), dr ? .66 : .52, .05), [0, 0, s * .6]);
      });
      bodyC = V(0, dr ? .6 : .46, 0); bodyR = dr ? [.36, .39, .33] : [.3, .32, .28];
      tailAt = V(0, dr ? .45 : .36, -.28); wingAt = V(0, dr ? .8 : .62, -.22); backAt = V(0, dr ? .8 : .6, -.3);
      neckY = dr ? 1.5 : 1.28; R.height = dr ? 1.55 : 1.3;
    } else if (B === 'quad') {
      part(cap(.25, .42), c, R.body, V(0, .46, -.08), [Math.PI / 2, 0, 0]);
      belly(V(0, .36, -.05), .2, [1, .6, 1.6]);
      H = head(0, .8, .3, .3);
      [[-1, .18], [1, .18], [-1, -.32], [1, -.32]].forEach(([s, z]) => {
        part(cap(.075, .2), shade(c, .9), R.body, V(s * .17, .17, z));
        part(sph(.1, 12), shade(c, .78), R.body, V(s * .17, .05, z + .04), null, [1, .55, 1.3]);
      });
      bodyC = V(0, .46, -.08); bodyR = [.27, .27, .45];
      tailAt = V(0, .55, -.5); wingAt = V(0, .72, -.15); backAt = V(0, .72, -.15); neckY = 1.1; R.height = 1.12;
    } else if (B === 'bird') {
      H = head(0, .6, 0, .42, [1, 1.1, .95]);
      belly(V(0, .48, .22), .26, [1, 1.1, .55]);
      [-1, 1].forEach(s => {
        part(cyl(.025, .025, .2), '#f5a623', R.body, V(s * .12, .1, .04));
        [-1, 0, 1].forEach(t => part(cap(.02, .08), '#f5a623', R.body, V(s * .12 + t * .04, .02, .09), [Math.PI / 2, 0, t * .5]));
      });
      bodyC = V(0, .6, 0); bodyR = [.42, .46, .4];
      tailAt = V(0, .38, -.34); wingAt = V(0, .66, -.02); backAt = V(0, .95, -.2); neckY = 1.08; R.height = 1.1;
      R.float = .05;
    } else if (B === 'fish') {
      H = head(0, .75, 0, .45, [1, .9, 1.05]);
      belly(V(0, .6, .25), .26, [1, .7, .55]);
      bodyC = V(0, .75, 0); bodyR = [.45, .4, .47];
      tailAt = V(0, .75, -.45); wingAt = V(0, .75, 0); backAt = V(0, 1.1, -.05); neckY = 1.15; R.height = 1.2;
      R.float = .12;
      // 鱼鳍：两侧 + 背上
      [-1, 1].forEach(s => part(flat(q => { q.moveTo(0, 0); q.quadraticCurveTo(.3, .12, .34, -.1); q.quadraticCurveTo(.16, -.06, 0, -.12); }), shade(c, .82), R.body, V(s * .48, .68, .02), [0, s * .3, s < 0 ? Math.PI : 0]));
      part(flat(q => { q.moveTo(-.2, 0); q.quadraticCurveTo(0, .34, .22, .02); q.closePath(); }), a, R.body, V(0, 1.12, -.06), [0, Math.PI / 2, 0]);
      if (!sp.t) sp = Object.assign({}, sp, { t: 'fin' });
    } else if (B === 'serpent') {
      const pts = [V(.36, .1, -.22), V(-.28, .12, -.34), V(-.42, .14, .12), V(.08, .16, .34), V(.4, .24, .08), V(.24, .56, .02), V(0, .86, .1)];
      part(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 48, .15, 10, false), c, R.body);
      [0, 6].forEach(i => part(sph(.15, 14), c, R.body, pts[i]));
      H = head(0, 1.02, .16, .3, [1.05, .95, 1.1]);
      belly(V(.2, .5, .12), .1, [1, 1.8, .8]);
      bodyC = V(0, .3, 0); bodyR = [.45, .25, .4];
      tailAt = pts[0].clone(); wingAt = V(0, .7, -.05); backAt = V(.3, .45, -.1); neckY = 1.32; R.height = 1.3;
    } else if (B === 'bug') {
      part(sph(.3, 18), c, R.body, V(0, .34, -.32), null, [1, .85, 1.25]);
      if (sp.p !== 'none') [0, 1, 2].forEach(i => part(new T3.TorusGeometry(.26 - i * .03, .025, 6, 20), a, R.body, V(0, .34, -.18 - i * .14), [0, 0, 0], [1, .85, 1], { noLine: true }));
      part(sph(.19, 16), shade(c, .9), R.body, V(0, .42, .04));
      H = head(0, .66, .22, .28);
      [-1, 1].forEach(s => [-.08, .04, .16].forEach((z, i) => part(cap(.025, .24), shade(c, .6), R.body, V(s * .22, .22, z - .05), [0, 0, s * (1.1 + i * .15)])));
      bodyC = V(0, .4, -.1); bodyR = [.3, .3, .45];
      tailAt = V(0, .32, -.66); wingAt = V(0, .6, -.06); backAt = V(0, .6, -.2); neckY = .95; R.height = .95;
      if (!sp.e) sp = Object.assign({}, sp, { e: 'antenna' });
    } else if (B === 'golem') {
      part(ico(.55, 1), c, R.body, V(0, .62, 0), null, [1.1, .95, .85], { mat: new T3.MeshToonMaterial({ color: c, gradientMap: grad, flatShading: true }) });
      H = { r: .5, s: [1, 1, 1] }; R.head.position.set(0, .72, 0); R.body.add(R.head);
      [-1, 1].forEach(s => {
        part(ico(.22, 0), shade(c, .85), R.body, V(s * .66, .55, .06), null, [1, 1.2, 1]);
        part(ico(.18, 0), shade(c, .75), R.body, V(s * .26, .14, .02));
      });
      [[.3, .95, .2], [-.28, .4, .38], [.1, .3, .44]].forEach(([x, y, z]) => part(ico(.06, 0), shade(c, .7), R.body, V(x, y, z), null, null, { noLine: true }));
      bodyC = V(0, .62, 0); bodyR = [.6, .52, .47];
      tailAt = V(0, .4, -.45); wingAt = V(0, .8, -.35); backAt = V(0, 1.05, -.2); neckY = 1.22; R.height = 1.3;
    } else if (B === 'ghost') {
      const prof = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16, y = t * .95; prof.push(new T3.Vector2(Math.max(.001, Math.sin(Math.min(1, t * 1.05) * Math.PI) * .44 * (t < .3 ? .75 + t : 1) + (t < .12 ? Math.sin(t * 90) * .03 : 0)), y)); }
      part(new T3.LatheGeometry(prof, 24), c, R.body, V(0, .12, 0), null, [1, 1, .95]);
      H = { r: .4, s: [1, 1, 1] }; R.head.position.set(0, .62, 0); R.body.add(R.head);
      [-1, 1].forEach(s => part(sph(.1, 12), c, R.body, V(s * .44, .5, .08), null, [1, .7, 1]));
      bodyC = V(0, .6, 0); bodyR = [.44, .45, .42];
      tailAt = V(0, .2, -.3); wingAt = V(0, .7, -.2); backAt = V(0, 1, -.15); neckY = 1.08; R.height = 1.1;
      R.float = .1;
    } else if (B === 'plant') {
      H = head(0, .42, 0, .42, [1, .85, 1]);
      [0, 1, 2, 3, 4].forEach(i => { const an = i / 5 * Math.PI * 2 + .3; part(flat(leafShape, .02), shade(sp.a || '#4caf50', 1), R.body, V(Math.sin(an) * .36, .08, Math.cos(an) * .36), [-Math.PI / 2 + .35, an, 0]); });
      belly(V(0, .3, .28), .18, [1, .7, .5]);
      bodyC = V(0, .42, 0); bodyR = [.42, .36, .42];
      tailAt = V(0, .3, -.4); wingAt = V(0, .5, -.2); backAt = V(0, .7, -.25); neckY = .8; R.height = .85;
      if (!sp.e) sp = Object.assign({}, sp, { e: 'leaf' });
    } else if (B === 'shell') {
      part(sph(.34, 18), c, R.body, V(0, .38, .06), null, [1, .9, 1]);
      part(sph(.48, 22), a, R.body, V(0, .38, -.12), null, [1, .72, 1]);
      part(new T3.TorusGeometry(.47, .04, 6, 28), shade(a, .7), R.body, V(0, .32, -.12), [Math.PI / 2, 0, 0], null, { noLine: true });
      H = head(0, .56, .4, .26);
      [[-1, .18], [1, .18], [-1, -.3], [1, -.3]].forEach(([s, z]) => part(sph(.12, 12), shade(c, .85), R.body, V(s * .32, .08, z), null, [1, .6, 1.2]));
      bodyC = V(0, .4, -.1); bodyR = [.5, .36, .5];
      tailAt = V(0, .3, -.55); wingAt = V(0, .7, -.2); backAt = V(0, .72, -.12); neckY = .85; R.height = .95;
    }
    const hr = H.r, hs = H.s;

    // ---------- 脸 ----------
    // onHead(yaw, pitch)：头（椭球）表面上的一点，yaw 左右转、pitch 上下转；贴片沿法线朝外
    const onHead = (yaw, pitch, out) => {
      const d = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      return V(d.x * hr * hs[0], d.y * hr * hs[1], d.z * hr * hs[2]).multiplyScalar(1 + (out || .02));
    };
    const stick = (mesh, yaw, pitch, out) => { mesh.position.copy(onHead(yaw, pitch, out)); mesh.rotation.set(-pitch, yaw, 0, 'YXZ'); R.head.add(mesh); return mesh; };
    const fishFace = B === 'fish';
    const ew = hr * (eyeStyle === 'big' ? .46 : .4), eh = ew * 1.25, eyaw = fishFace ? .78 : .36, ep = .06;
    [-1, 1].forEach(s => {
      const eye = new T3.Mesh(new T3.PlaneGeometry(ew, eh), new T3.MeshBasicMaterial({ map: eyeTex(eyeStyle, sp.iris || (legend ? '#e0a020' : '#3a2a4a')), transparent: true, alphaTest: .2 }));
      stick(eye, s * eyaw, ep, .025);
      if (s > 0) eye.scale.x = -1;
      R.eyes.push(eye);
      if (eyeStyle === 'sharp' || eyeStyle === 'fierce') {
        const brow = new T3.Mesh(new T3.PlaneGeometry(ew * .95, ew * .17), basic(shade(c, .3)));
        stick(brow, s * eyaw, ep + .34, .035).rotateZ(-s * .35);
      }
    });
    // 腮红
    [-1, 1].forEach(s => stick(new T3.Mesh(new T3.PlaneGeometry(hr * .26, hr * .14), basic('#ff8a95', { transparent: true, opacity: .45, depthWrite: false })), s * .66, -.2, .02));
    // 嘴
    const mk = sp.m || (B === 'bird' ? 'beak' : 'smile');
    if (mk === 'beak') {
      const bk = part(cone(hr * .16, hr * .34, 8), sp.beak || '#f5a623', R.head, onHead(0, -.18, .12), [Math.PI / 2, 0, 0], null, {});
      bk.rotation.x = Math.PI / 2 - .18;
    } else {
      R.mouthC = new T3.Mesh(new T3.PlaneGeometry(hr * .4, hr * .3), new T3.MeshBasicMaterial({ map: mouthTex(mk === 'o' ? 'smile' : mk), transparent: true, alphaTest: .2 }));
      R.mouthO = new T3.Mesh(new T3.PlaneGeometry(hr * .4, hr * .3), new T3.MeshBasicMaterial({ map: mouthTex('o'), transparent: true, alphaTest: .2 }));
      [R.mouthC, R.mouthO].forEach(mm => stick(mm, 0, fishFace ? -.12 : -.34, .025));
      R.mouthO.visible = mk === 'o';
      R.mouthC.visible = mk !== 'o';
    }
    const fz = hr * hs[2], ey = hr * hs[1] * .06;
    // 花纹：面具
    if (sp.p === 'mask') stick(new T3.Mesh(new T3.PlaneGeometry(hr * 1.4, hr * .5), basic(shade(c, .5), { transparent: true, opacity: .8, depthWrite: false })), 0, ep, .015);

    // ---------- 头上的东西 ----------
    const topY = hr * hs[1] * .9;
    const ears = sp.e || 'none', EG = R.ears;
    R.head.add(EG);
    const pair = fn => [-1, 1].forEach(s => fn(s));
    if (ears === 'cat') pair(s => { part(cone(hr * .28, hr * .6, 4), c, EG, V(s * hr * .5, topY + hr * .1, 0), [0, 0, -s * .35]); part(cone(hr * .16, hr * .38, 4), k, EG, V(s * hr * .48, topY + hr * .08, hr * .08), [0, 0, -s * .35], null, { noLine: true }); });
    else if (ears === 'dog') pair(s => part(sph(hr * .26, 12), shade(c, .75), EG, V(s * hr * .82, hr * .3, 0), [0, 0, s * .5], [.7, 1.4, .5]));
    else if (ears === 'round') pair(s => { part(sph(hr * .26, 14), c, EG, V(s * hr * .62, topY, 0), null, [1, 1, .6]); part(sph(hr * .15, 12), k, EG, V(s * hr * .62, topY, hr * .12), null, [1, 1, .4], { noLine: true }); });
    else if (ears === 'bunny') pair(s => { part(cap(hr * .14, hr * .7), c, EG, V(s * hr * .3, topY + hr * .5, 0), [0, 0, -s * .18], [1, 1, .55]); part(cap(hr * .07, hr * .55), k, EG, V(s * hr * .3, topY + hr * .5, hr * .06), [0, 0, -s * .18], [1, 1, .4], { noLine: true }); });
    else if (ears === 'fin') part(flat(q => { q.moveTo(-.15, 0); q.quadraticCurveTo(-.02, .36, .2, .22); q.lineTo(.16, 0); q.closePath(); }), shade(c, .8), EG, V(0, topY + hr * .1, -hr * .1), [0, Math.PI / 2, 0]);
    else if (ears === 'leaf') { part(cyl(.012, .012, hr * .3), '#3d8b37', EG, V(0, topY + hr * .12, 0)); pair(s => part(flat(leafShape, .02), s > 0 ? '#66bb6a' : '#81c784', EG, V(s * hr * .2, topY + hr * .3, 0), [0, 0, -s * 1.1])); }
    else if (ears === 'antenna') pair(s => { part(cyl(.012, .012, hr * .6), shade(c, .5), EG, V(s * hr * .3, topY + hr * .28, 0), [0, 0, -s * .4]); part(sph(hr * .1, 10), a, EG, V(s * hr * .42, topY + hr * .56, 0), null, null, { glow: sp.glowA ? a : null }); });
    else if (ears === 'horn') part(cone(hr * .14, hr * .55, 10), a, EG, V(0, topY + hr * .25, hr * .15), [.25, 0, 0]);
    else if (ears === 'horns') pair(s => part(cone(hr * .12, hr * .5, 10), a, EG, V(s * hr * .42, topY + hr * .18, 0), [0, 0, -s * .45]));
    else if (ears === 'curl') pair(s => part(new T3.TorusGeometry(hr * .22, hr * .08, 8, 16, Math.PI * 1.5), a, EG, V(s * hr * .72, topY - hr * .05, -hr * .05), [0, s * Math.PI / 2, 0]));
    else if (ears === 'crest') [-1, 0, 1].forEach(i => part(cone(hr * .09, hr * .5, 8), a, EG, V(i * hr * .12, topY + hr * .25 - Math.abs(i) * .03, -hr * .15), [-.5, 0, -i * .4]));
    else if (ears === 'flame') [-1, 0, 1].forEach(i => part(cone(hr * .14, hr * (i ? .45 : .7), 8), i ? '#ffca28' : '#ff7043', EG, V(i * hr * .22, topY + hr * (i ? .15 : .3), -hr * .05), [0, 0, -i * .4], null, { glow: i ? '#553300' : '#662200', noLine: true }));
    else if (ears === 'ice') [-1, 0, 1].forEach(i => part(new T3.OctahedronGeometry(hr * .16, 0), '#bdefff', EG, V(i * hr * .3, topY + hr * (i ? .12 : .28), 0), [0, .4, -i * .3], [.7, 1.8, .7], { glow: '#224455' }));
    else if (ears === 'flower') { for (let i = 0; i < 5; i++) { const an = i / 5 * Math.PI * 2; part(sph(hr * .15, 10), a, EG, V(Math.cos(an) * hr * .2, topY + hr * .12, Math.sin(an) * hr * .2), null, [1, .45, 1]); } part(sph(hr * .12, 10), '#ffe066', EG, V(0, topY + hr * .18, 0), null, [1, .6, 1]); }
    else if (ears === 'spikes') [-1, 0, 1].forEach(i => part(cone(hr * .12, hr * .45, 6), a, EG, V(i * hr * .3, topY + hr * .1 - Math.abs(i) * .03, -hr * .3), [-.6, 0, -i * .5]));
    else if (ears === 'crown' || (sp.x || []).includes('crown')) {
      part(new T3.CylinderGeometry(hr * .42, hr * .38, hr * .16, 12, 1, true), '#ffd54f', EG, V(0, topY + hr * .02, 0), null, null, { glow: '#332200' });
      [0, 1, 2, 3, 4].forEach(i => { const an = i / 5 * Math.PI * 2; part(cone(hr * .08, hr * .2, 6), '#ffd54f', EG, V(Math.sin(an) * hr * .4, topY + hr * .18, Math.cos(an) * hr * .4), null, null, { noLine: true, glow: '#332200' }); });
    } else if (ears === 'cloud') [-1, 0, 1].forEach(i => part(sph(hr * (i ? .22 : .3), 12), '#ffffff', EG, V(i * hr * .32, topY + hr * .08, 0)));
    else if (ears === 'gem') part(new T3.OctahedronGeometry(hr * .13, 0), a, EG, V(0, hr * .45, fz * .92), [0, 0, 0], [1, 1.3, .6], { glow: shade(a, .35) });

    // ---------- 尾巴 ----------
    const tail = sp.t || 'none', TG = R.tail;
    TG.position.copy(tailAt); R.body.add(TG);
    if (tail === 'flame') { part(cone(.12, .42, 10), '#ff7043', TG, V(0, .22, -.08), [-.6, 0, 0], null, { glow: '#662200', noLine: true }); part(cone(.07, .26, 8), '#ffca28', TG, V(0, .2, -.04), [-.6, 0, 0], null, { glow: '#664400', noLine: true }); }
    else if (tail === 'fin') part(flat(q => { q.moveTo(0, 0); q.lineTo(.3, .22); q.quadraticCurveTo(.22, 0, .3, -.22); q.closePath(); }), shade(c, .82), TG, V(0, 0, -.14), [0, Math.PI / 2, 0]);
    else if (tail === 'leaf') part(flat(leafShape, .02), '#66bb6a', TG, V(0, .15, -.1), [-1, 0, 0], [1.2, 1.2, 1.2]);
    else if (tail === 'bolt') part(flat(q => { q.moveTo(0, 0); q.lineTo(.1, .12); q.lineTo(.04, .14); q.lineTo(.18, .36); q.lineTo(.02, .18); q.lineTo(.08, .16); q.closePath(); }, .04), '#ffd54f', TG, V(0, .18, -.08), [0, Math.PI / 2, 0], [1.3, 1.3, 1.3], { glow: '#443300' });
    else if (tail === 'fluffy') part(sph(.2, 14), sp.tc || k, TG, V(0, .1, -.12));
    else if (tail === 'curl') part(new T3.TorusGeometry(.13, .045, 8, 18, Math.PI * 1.6), c, TG, V(0, .14, -.1), [0, Math.PI / 2, 0]);
    else if (tail === 'spike') [0, 1, 2].forEach(i => part(cone(.07 - i * .015, .2, 6), a, TG, V(0, .05 + i * .02, -.1 - i * .14), [-1.3, 0, 0]));
    else if (tail === 'feather') [-1, 0, 1].forEach(i => part(sph(.09, 10), i ? c : a, TG, V(i * .09, .02, -.16), [.4, i * .4, 0], [.7, .4, 2]));
    else if (tail === 'stinger') { part(cap(.05, .3), c, TG, V(0, .12, -.14), [-.8, 0, 0]); part(cone(.06, .18, 8), a, TG, V(0, .28, -.28), [-.2, 0, 0]); }
    else if (tail === 'club') { part(cap(.05, .3), c, TG, V(0, .05, -.18), [-1.2, 0, 0]); part(ico(.12, 0), a, TG, V(0, .1, -.38)); }
    else if (tail === 'cloud') [0, 1, 2].forEach(i => part(sph(.12 - i * .02, 10), '#ffffff', TG, V(0, .05 + i * .06, -.12 - i * .12)));
    else if (tail === 'long') part(new T3.TubeGeometry(new T3.QuadraticBezierCurve3(V(0, 0, 0), V(0, -.1, -.5), V(0, .25, -.75)), 16, .06, 8, false), c, TG);

    // ---------- 翅膀 ----------
    const wing = sp.w || 'none';
    if (wing !== 'none') pair(s => {
      const pv = new T3.Group(); pv.position.set(wingAt.x + s * bodyR[0] * .75, wingAt.y, wingAt.z); R.body.add(pv); R.wings.push(pv); pv.userData.s = s;
      if (wing === 'feather') [0, 1, 2].forEach(i => part(sph(.12, 10), i === 2 ? a : shade(c, 1 - i * .06), pv, V(s * (.15 + i * .1), .1 - i * .06, -.02 * i), [0, 0, s * (.6 + i * .3)], [1.5 - i * .2, .45, .8]));
      else if (wing === 'bat') part(flat(q => { q.moveTo(0, 0); q.lineTo(.5, .32); q.quadraticCurveTo(.44, .12, .5, .02); q.quadraticCurveTo(.36, .04, .34, -.12); q.quadraticCurveTo(.2, -.02, 0, -.08); q.closePath(); }, .02), shade(c, .7), pv, V(s * .24, .06, 0), [0, s < 0 ? Math.PI : 0, 0]);
      else part(sph(.22, 14), wing === 'fairy' ? '#ffd6f2' : '#e6fbff', pv, V(s * .24, .12, -.02), [0, 0, s * .6], [1.3, .7, .12], { mat: new T3.MeshToonMaterial({ color: wing === 'fairy' ? '#ffd6f2' : '#e6fbff', gradientMap: grad, transparent: true, opacity: .7 }) });
    });

    // ---------- 花纹 ----------
    if (sp.p === 'spots') [[.55, .3], [-.6, .1], [.2, -.2], [-.2, .45], [.7, -.1]].forEach(([u, v]) => { const an = u * 1.2; part(sph(.06, 8), shade(c, .72), R.body, V(bodyC.x + Math.sin(an) * bodyR[0] * .98, bodyC.y + v * bodyR[1], bodyC.z + Math.cos(an) * bodyR[2] * .92), null, [1, 1, .35], { noLine: true }).lookAt(bodyC.x + Math.sin(an) * 9, bodyC.y + v * bodyR[1], bodyC.z + Math.cos(an) * 9); });
    if (sp.p === 'stripes' && B !== 'bug') [-.25, .1, .42].forEach(v => part(new T3.TorusGeometry(Math.sqrt(Math.max(.01, 1 - v * v)) * bodyR[0] * 1.005, .022, 6, 28), shade(c, .6), R.body, V(bodyC.x, bodyC.y + v * bodyR[1], bodyC.z), [Math.PI / 2, 0, 0], [1, bodyR[2] / bodyR[0], 1], { noLine: true }));
    if (sp.p === 'star') { const st = new T3.Mesh(new T3.PlaneGeometry(.2, .2), basic(a, { map: starTex(), transparent: true, alphaTest: .3 })); st.position.set(bodyC.x, bodyC.y - bodyR[1] * .1, bodyC.z + bodyR[2] * 1.02 + .02); R.body.add(st); }

    // ---------- 其他装饰 ----------
    (sp.x || []).forEach(x => {
      if (x === 'mane') for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2; part(sph(hr * .28, 10), a, R.head, V(Math.cos(an) * hr * .95, Math.sin(an) * hr * .8, -hr * .35)); }
      else if (x === 'shell') part(sph(.36, 16), a, R.body, V(backAt.x, backAt.y - .12, backAt.z - .08), null, [1, .7, .7]);
      else if (x === 'leafback') [-1, 0, 1].forEach(i => part(flat(leafShape, .02), i ? '#66bb6a' : '#43a047', R.body, V(backAt.x + i * .16, backAt.y, backAt.z), [-.5, 0, -i * .6], [1.3, 1.3, 1.3]));
      else if (x === 'crystals') [-1, 0, 1].forEach(i => part(new T3.OctahedronGeometry(.1, 0), a, R.body, V(backAt.x + i * .16, backAt.y + .08 - Math.abs(i) * .05, backAt.z), [0, .5, -i * .4], [.8, 1.9, .8], { glow: shade(a, .35) }));
      else if (x === 'flames') [-1, 0, 1].forEach(i => part(cone(.08, i ? .26 : .38, 8), i ? '#ffca28' : '#ff7043', R.body, V(backAt.x + i * .14, backAt.y + .1, backAt.z), [-.3, 0, -i * .3], null, { glow: '#552200', noLine: true }));
      else if (x === 'cloud') [-1, 0, 1].forEach(i => part(sph(.13, 10), '#ffffff', R.body, V(i * .3, .14, .1 + (i ? 0 : .1))));
      else if (x === 'scarf') part(new T3.TorusGeometry(hr * .72, hr * .1, 8, 24), a, R.body, V(R.head.position.x, R.head.position.y - hr * .8, R.head.position.z), [Math.PI / 2 - .1, 0, 0]);
      else if (x === 'antlers') pair(s => { part(cyl(.02, .025, .34), '#a1887f', R.head, V(s * hr * .35, topY + .14, -.02), [0, 0, -s * .4]); part(cyl(.015, .02, .16), '#a1887f', R.head, V(s * hr * .6, topY + .2, -.02), [0, 0, -s * 1.1]); });
      else if (x === 'whiskers') pair(s => [0, 1].forEach(i => { const wk = new T3.Mesh(new T3.CylinderGeometry(.006, .006, hr * .6, 4), basic('#3a2a2a')); wk.position.set(s * hr * .62, ey - hr * .25 + i * .04, fz * .7); wk.rotation.z = Math.PI / 2 + s * (i ? .15 : -.1); R.head.add(wk); }));
      else if (x === 'spikesback') [0, 1, 2, 3].forEach(i => part(cone(.07, .2, 6), a, R.body, V(backAt.x, backAt.y + .05 - i * .1, backAt.z - i * .04), [-.8 - i * .2, 0, 0]));
      else if (x === 'aura') { const ring = new T3.Mesh(new T3.TorusGeometry(.7, .03, 6, 40), basic(a, { transparent: true, opacity: .55, blending: T3.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = .03; root.add(ring); R.aura = ring; }
    });

    // 大小：一阶小、三阶大、神兽更大
    const S = (sp.sz || 1) * (legend ? 1.5 : stage === 1 ? .82 : stage === 2 ? 1 : 1.22);
    root.scale.setScalar(S);
    R.size = S; R.height *= S; R.float *= S;
    R.base = R.body.position.y;
    R.blinkAt = 1 + Math.random() * 3;
    return R;
  }

  // 每帧动画：呼吸、漂浮、眨眼、摇尾巴、扇翅膀；state.talk 张嘴
  function animate(R, t, state) {
    state = state || {};
    const br = Math.sin(t * 2.4) * .025;
    R.body.scale.set(1 - br * .5, 1 + br, 1 - br * .5);
    R.body.position.y = R.base + (R.float ? R.float / R.size * (1 + Math.sin(t * 1.8)) : 0);
    R.head.rotation.z = Math.sin(t * 1.3) * .04;
    R.tail.rotation.y = Math.sin(t * 4) * .35;
    R.wings.forEach(w => { w.rotation.z = w.userData.s * Math.sin(t * (R.float ? 10 : 3)) * (R.float ? .45 : .15); });
    R.ears.rotation.z = Math.sin(t * 2.1 + 1) * .03;
    const bl = (t % (R.blinkAt + 3)) > R.blinkAt + 2.85;
    R.eyes.forEach(e => { e.scale.y = bl ? .12 : 1; });
    if (R.mouthO && state.talk != null) { R.mouthO.visible = !!state.talk; R.mouthC.visible = !state.talk; }
    if (R.aura) { R.aura.rotation.z = t * .8; R.aura.scale.setScalar(1 + Math.sin(t * 2) * .06); }
  }

  // 释放（贴图和材质是共用的，不在这里释放）
  function dispose(R) { R.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }

  // ---------- 截图：给菜单、图鉴、2D 画面用 ----------
  let snapR = null, snapScene = null, snapCam = null;
  const snapCache = {};
  function snapshot(sp, size, opts) {
    size = size || 192;
    const key = sp.id + ':' + size + (opts && opts.proc ? ':p' : '') + (opts && opts.ry != null ? ':r' + opts.ry : '');
    if (snapCache[key]) return snapCache[key];
    try {
      if (!snapR) {
        const cv = document.createElement('canvas');
        snapR = new T3.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
        snapScene = new T3.Scene();
        snapScene.add(new T3.HemisphereLight(0xffffff, 0x8899aa, 1.6));
        const d = new T3.DirectionalLight(0xffffff, 1.8); d.position.set(2, 3, 4); snapScene.add(d);
        snapCam = new T3.PerspectiveCamera(26, 1, .1, 50);
      }
      snapR.setPixelRatio(1); snapR.setSize(size, size, false);
      const R = build(sp, opts);
      R.root.rotation.y = opts && opts.ry != null ? opts.ry : -.35;
      snapScene.add(R.root);
      const h = Math.max(R.height, .9), dist = h * 3.1 + .6;
      snapCam.position.set(dist * .18, h * .62 + dist * .16, dist);
      snapCam.lookAt(0, h * .48, 0);
      snapR.setClearColor(0x000000, 0);
      snapR.render(snapScene, snapCam);
      const url = snapR.domElement.toDataURL('image/png');
      snapScene.remove(R.root); dispose(R);
      return (snapCache[key] = url);
    } catch (e) { return ''; }
  }

  window.Mon3D = { build, animate, dispose, snapshot, shade, ready, mode: ART_MODE, samples: SAMPLES };
})();
