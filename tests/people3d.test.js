// 3D 小人（people3d.js，新画风大地图里代替纸片人）：
//   · has()：造型对象不对、状态不支持的都说不行（调用的人就继续用纸片）
//   · people.js 里每个造型（LOOKS / VILLAGERS / TRAINERS）两档精细度都搭得出来：2 个 draw call，三角形在预算里（精细档 ≤ 8000、省电档 ≤ 2500），
//     顶点里没有坏数，身高对；各种发型 × 帽子 × 衣服的组合也都搭得出来
//   · 颜色对得上 2D：用不带明暗的材质画，正面有肤色、眼睛、衣服的颜色，侧面也有一整只眼睛和露着的脸颊，背面有头发、背包、帽子的颜色；
//     光头从背后看头发只在两边；自带的卡通材质画出来不是黑的也不是白的；像大地图那样改过着色器的材质蒙皮照样管用
//   · 动作：站着腿不动、有呼吸；走路时两条腿一前一后、手和同一边的腿反着摆、身子上下颠、马尾和背包跟着晃、画面真的在变；停下来腿收回去；会眨眼
//   · 转身：不是一下子转过去、走近的那一边、最后转到位；骑车 / 踏浪 / 跳 / 说话 / 挥手各有各的姿势
//   · 步子按速度来：set({ speed }) 给真的速度，踩在地上的脚不滑、不陷进地里、鞋是平的；慢是走、快是跑；跳台阶的姿势跟着 set({ phase }) 走
//   · 同样的造型共用网格和材质；搭了再放、放了再搭四轮，release() 以后显存里的东西回到开始的数
// 运行：node tests/people3d.test.js（自己起一个本机小网站，打开 tools/people3d.html?test=1；无头浏览器用软件渲染）
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', png: 'image/png' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const file = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!file.startsWith(ROOT)) { r.writeHead(403); return r.end(); } fs.readFile(file, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); }).listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); });
const opts = { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; return ok; };
const HI_MAX = 8000, LO_MAX = 2500;

(async () => {
  const { s, base } = await serve();
  const b = await chromium.launch(opts);
  const p = await (await b.newContext({ viewport: { width: 600, height: 600 } })).newPage(), errs = [];
  p.setDefaultTimeout(60000);
  p.on('pageerror', e => { errs.push(e.message); console.log('  [err]', e.message.slice(0, 300)); });
  p.on('console', m => { if (m.type() === 'error') console.log('  [cerr]', m.text().slice(0, 300)); });
  await p.goto(base + '/tools/people3d.html?test=1');
  await p.waitForFunction(() => window.P3D && P3D.ready);
  const E = (fn, a) => p.evaluate(fn, a);

  // 页面里的小工具：一个干净的场景（和大地图一样的灯）、一台正对着小人的镜头、读像素、数某种颜色的像素
  await E(() => {
    const T = P3D.T, R = P3D.renderer, P3 = EchoPeople3D, N = 256;
    R.setPixelRatio(1); R.setSize(N, N, false);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(11, 1, .1, 100), sun = new T.DirectionalLight(0xfff0d0, Math.PI * .5);
    sun.position.set(-7, 13.6, 12.8);
    scene.add(new T.HemisphereLight(0xcfe0ff, 0xd9cfae, Math.PI * .56), sun);
    cam.position.set(0, .72, 9); cam.lookAt(0, .72, 0);
    const gl = R.getContext(), buf = new Uint8Array(N * N * 4);
    const render = () => { R.info.reset(); R.setScissorTest(false); R.setViewport(0, 0, N, N); R.setClearColor(0x00ff00, 1); R.clear(); R.render(scene, cam); gl.readPixels(0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, buf); return { calls: R.info.render.calls, tris: R.info.render.triangles }; };
    const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const count = (hex, tol) => { const c = rgb(hex); let n = 0; for (let i = 0; i < buf.length; i += 4) if (Math.abs(buf[i] - c[0]) <= tol && Math.abs(buf[i + 1] - c[1]) <= tol && Math.abs(buf[i + 2] - c[2]) <= tol) n++; return n; };
    // 不是底色的像素有多少、平均多亮
    const body = () => { let n = 0, sum = 0; for (let i = 0; i < buf.length; i += 4) if (!(buf[i] < 8 && buf[i + 1] > 247 && buf[i + 2] < 8)) { n++; sum += buf[i] + buf[i + 1] + buf[i + 2]; } return { n, mean: n ? sum / n / 3 : 0 }; };
    const diff = other => { let n = 0; for (let i = 0; i < buf.length; i += 4) if (Math.abs(buf[i] - other[i]) + Math.abs(buf[i + 1] - other[i + 1]) + Math.abs(buf[i + 2] - other[i + 2]) > 40) n++; return n; };
    const bad = g => { let n = 0; ['position', 'normal', 'color', 'uv'].forEach(k => { const a = g.attributes[k]; if (a) for (let i = 0; i < a.array.length; i++) if (!isFinite(a.array[i])) n++; }); return n; };
    const run = (inst, sec, fn) => { for (let t = 0; t < sec - 1e-9; t += 1 / 60) { inst.tick(1 / 60); if (fn) fn(); } };
    const mem = () => ({ geo: R.info.memory.geometries, tex: R.info.memory.textures, prog: R.info.programs ? R.info.programs.length : 0 });
    let nBody = 0, nFace = 0;
    const flat = (kind, q) => { if (kind === 'face') { nFace++; return new T.MeshBasicMaterial({ map: q.map }); } nBody++; return new T.MeshBasicMaterial({ vertexColors: true }); };
    // 只数画面里一块地方（x0–x1 列、y0–y1 行，行从下往上数）
    const countIn = (hex, tol, x0, x1, y0, y1) => { const c = rgb(hex); let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * N + x) * 4; if (Math.abs(buf[i] - c[0]) <= tol && Math.abs(buf[i + 1] - c[1]) <= tol && Math.abs(buf[i + 2] - c[2]) <= tol) n++; } return n; };
    window.TT = { T, R, P3, scene, cam, render, count, countIn, body, diff, bad, run, mem, flat, buf, looks: P3D.looks, L: EchoPeople.LOOKS, made: () => ({ nBody, nFace }) };
  });

  // ---------- 1. has() ----------
  const has = await E(() => {
    const { P3, L } = TT, bad = [null, undefined, 'boy', 42, {}, { skin: '#ffdcc2' }, Object.assign({}, L.boy, { skin: 'red' }), Object.assign({}, L.boy, { hair: null })];
    return {
      api: ['has', 'create', 'release'].every(k => typeof P3[k] === 'function'),
      ok: ['', undefined, null, 'idle', 'walk', 'bike', 'surf', 'hop', 'talk', 'wave'].map(st => P3.has(L.boy, st)),
      no: ['dive', 'swim', 'fish', 'sleep', 'sit', 'Walk', 7].map(st => P3.has(L.boy, st)),
      badLook: bad.map(l => P3.has(l)), badMake: bad.map(l => P3.create(l)),
      states: P3.STATES,
    };
  });
  check(has.api, 'EchoPeople3D 有 has / create / release');
  check(has.ok.every(Boolean), '平常、走路、骑车、踏浪、跳、说话、挥手都说能画（' + has.states.filter(Boolean).join(' / ') + '）');
  check(has.no.every(v => v === false), '不支持的状态（潜到海底、游泳、钓鱼、睡觉……）说不行，调用的人就继续用纸片');
  check(has.badLook.every(v => v === false) && has.badMake.every(v => v === null), '造型不对（空的、不是对象、缺颜色、颜色不是 #rrggbb）：has 说不行，create 给 null');

  // ---------- 2. 每个造型、两档精细度：搭得出来，draw call 和三角形在预算里 ----------
  const all = await E(() => {
    const { P3, scene, render, bad, looks } = TT, rows = [];
    const t = { high: 0, low: 0 };
    for (const detail of ['high', 'low']) {
      const s0 = P3.stats();
      for (const [name, look] of looks) {
        const inst = P3.create(look, { detail });
        if (!inst) { rows.push({ name, detail, fail: 'create 给了 null' }); continue; }
        scene.add(inst.root);
        const r = render();
        rows.push({ name, detail, tris: inst.tris, calls: r.calls, drawn: r.tris, h: inst.height, bad: bad(inst.body.geometry) + bad(inst.face.geometry), verts: inst.body.geometry.attributes.position.count, api: !!(inst.root && inst.root.isGroup && inst.set && inst.tick && inst.dispose && inst.height > 0), detailOk: inst.detail === detail, bones: Object.keys(inst.bones).length, parent: inst.root.parent === scene });
        inst.dispose();
        rows[rows.length - 1].gone = inst.root.parent === null;
      }
      const s1 = P3.stats(); t[detail] = (s1.ms - s0.ms) / Math.max(1, s1.built - s0.built);
    }
    return { rows, ms: t, n: looks.length };
  });
  const rows = all.rows, H = rows.filter(r => r.detail === 'high'), Lo = rows.filter(r => r.detail === 'low');
  const mm = (a, k) => Math.min(...a.map(r => r[k])) + '–' + Math.max(...a.map(r => r[k]));
  check(all.n >= 60 && rows.length === all.n * 2 && rows.every(r => !r.fail && r.api && r.detailOk && r.bones === 13), all.n + ' 个造型两档都搭出来了，接口齐全（root / set / tick / height / dispose）');
  check(rows.every(r => r.calls === 2 && r.drawn === r.tris), '每个小人正好 2 个 draw call，画出来的三角形数和报的一样');
  check(H.every(r => r.tris <= HI_MAX), '精细档三角形 ' + mm(H, 'tris') + '（上限 ' + HI_MAX + '）' + H.filter(r => r.tris > HI_MAX).map(r => ' ' + r.name + ' ' + r.tris).join(''));
  check(Lo.every(r => r.tris <= LO_MAX), '省电档三角形 ' + mm(Lo, 'tris') + '（上限 ' + LO_MAX + '）' + Lo.filter(r => r.tris > LO_MAX).map(r => ' ' + r.name + ' ' + r.tris).join(''));
  check(rows.every(r => r.bad === 0 && r.verts < 65536), '顶点里没有坏数（NaN / 无穷大），顶点数没超过 16 位索引');
  check(rows.every(r => r.h > 1.03 && r.h < 1.75) && Math.abs(rows.find(r => r.name === 'mom').h - 1.14) < .02, '身高（含帽子）' + Math.min(...rows.map(r => r.h)).toFixed(2) + '–' + Math.max(...rows.map(r => r.h)).toFixed(2) + '，不戴帽子的约 1.14（光头矮一点）');
  check(rows.every(r => r.parent && r.gone), 'dispose() 把小人从场景里拿掉');
  // 软件渲染的测试机慢，时间只卡一个很松的上限；真机上的数看 tools/look/people-shots.js 的输出
  check(all.ms.high < 60 && all.ms.low < 30, '搭一个造型平均：精细档 ' + all.ms.high.toFixed(1) + ' 毫秒，省电档 ' + all.ms.low.toFixed(1) + ' 毫秒');

  // 各种组合：8 种发型 × 7 种帽子（含不戴、含不认识的）× 几套衣服
  const combo = await E(() => {
    const { P3, bad, L } = TT, styles = ['spiky', 'short', 'bald', 'long', 'bob', 'pigtails', 'ponytail', 'bun', 'mohawk', undefined], hats = [undefined, 'cap', 'band', 'helmet', 'headset', 'chef', 'straw', 'crown'];
    const outfits = [{}, { jacket: '#1f8f8c', bag: '#ffc233', logo: '#ffd54f' }, { coat: '#ffffff', skirt: true, glasses: true }, { apron: '#ffffff', skirt: true, shirt2: '#ffffff' }, { coat: '#263238', apron: '#f29b2b', bag: '#66bb6a', glasses: true, skirt: true, lash: true }, { jacket: '#ff7a3d', apron: '#ffffff', skirt: true, bag: '#4fc3f7', glasses: true, logo: '#ffd54f', lash: false, micC: '#ff0000', shoes: '#fff', jacket2: 1 }];
    let n = 0, worst = { high: 0, low: 0 }, fail = [];
    styles.forEach((style, i) => hats.forEach((hat, j) => {
      const look = Object.assign({ skin: '#ffdcc2', hair: '#3a2a24', shirt: '#ffffff', bottom: '#2f3a57', style, hat, hatC: '#16a3a0', hatLogo: '#ffffff' }, outfits[(i + j) % outfits.length]);
      ['high', 'low'].forEach(detail => {
        let inst = null;
        try { inst = P3.create(look, { detail }); } catch (e) { fail.push(style + '+' + hat + ' ' + e.message); return; }
        if (!inst) { fail.push(style + '+' + hat + ' null'); return; }
        n++;
        if (bad(inst.body.geometry) + bad(inst.face.geometry)) fail.push(style + '+' + hat + ' 坏数');
        if (inst.tris > worst[detail]) { worst[detail] = inst.tris; worst[detail + 'Of'] = style + '+' + hat; }
        inst.tick(.016); inst.dispose();
      });
    }));
    // 所有选项全开的：最重能有多重
    const max = P3.create(Object.assign({}, L.boy, { style: 'long', hat: 'helmet', coat: '#ffffff', apron: '#f29b2b', skirt: true, glasses: true, logo: '#ffd54f', shirt2: '#fff' }), { detail: 'high' });
    const maxTris = max.tris; max.dispose();
    P3.release();
    return { n, worst, fail, maxTris };
  });
  check(combo.fail.length === 0 && combo.n === 160, '发型 × 帽子 × 衣服的 ' + combo.n + ' 种组合（含不认识的发型 / 帽子：当短发 / 不戴帽子）都搭得出来' + (combo.fail.length ? '：' + combo.fail.slice(0, 4).join(' | ') : ''));
  check(combo.worst.high <= HI_MAX + 500 && combo.worst.low <= LO_MAX && combo.maxTris <= HI_MAX + 500, '最重的组合：精细档 ' + combo.worst.high + '（' + combo.worst.highOf + '），省电档 ' + combo.worst.low + '（' + combo.worst.lowOf + '），所有选项全开 ' + combo.maxTris);

  // ---------- 3. 颜色对得上（不带明暗的材质，颜色就是造型里写的颜色） ----------
  const col = await E(() => {
    const { P3, scene, render, count, flat, looks } = TT, miss = [], ok = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
    let n = 0;
    for (const [name, L] of looks) {
      const inst = P3.create(L, { mat: flat, detail: n % 2 ? 'low' : 'high' });
      scene.add(inst.root);
      const need = (what, hex, min) => { if (ok(hex) && count(hex, 8) < min) miss.push(name + ' ' + what + ' ' + hex + '（' + count(hex, 8) + ' 个像素）'); };
      inst.set({ dir: 'down' }); render();
      need('正面·肤色', L.skin, 150); need('正面·眼睛', '#2b2233', 20); need('正面·外衣', L.jacket || L.coat || L.shirt, 30);
      if (!(L.apron && (L.jacket || L.coat))) need('正面·衣服', L.shirt, 10);
      // 侧面：整只眼睛看得到（脸绕到头的两边去了），脸颊是露着的（肤色不少）
      for (const dir of ['left', 'right']) { inst.set({ dir, snap: true }); render(); need('侧面（朝' + (dir === 'left' ? '左' : '右') + '）·眼睛', '#2b2233', 12); need('侧面·脸', L.skin, 300); }
      inst.set({ dir: 'up', snap: true }); render();
      need('背面·头发', L.hair, 30);
      if (L.bag) need('背面·背包', L.bag, 50);
      if (!(L.coat && L.skirt)) need('背面·裤子 / 裙子', L.bottom, 10);
      if (L.hat === 'cap' || L.hat === 'band' || L.hat === 'helmet' || L.hat === 'headset') need('背面·帽子', L.hatC || '#e53935', 15);
      inst.dispose(); n++;
    }
    // 光头（没戴帽子的）：从背后看，头发只在两边，后脑勺中间是光的（和 2D 背面一样）
    const bald = looks.filter(([, L]) => L.style === 'bald' && !L.hat).map(([name, L]) => {
      const inst = P3.create(L, { mat: flat }); scene.add(inst.root); inst.set({ dir: 'up' }); render();
      const r = { name, mid: TT.countIn(L.hair, 8, 106, 150, 116, 190), left: TT.countIn(L.hair, 8, 70, 104, 116, 190), right: TT.countIn(L.hair, 8, 152, 186, 116, 190) };
      inst.dispose(); return r;
    });
    // 脸（贴图）和头（顶点颜色）的交界、还有脸颊上：带着灯（自带的卡通材质，和大地图一样的太阳和天光）转到 45°、67.5°、90°，
    // 沿着脸颊到耳后采一圈肤色——同一个角度下都得是同一个颜色（以前脸颊上竖着切出一道亮边，像接缝）。
    // 采的点：耳朵上下两排在脸颊上（交界前面），耳朵下面两排跨过交界（经度 90° 两边）；避开眼睛、腮红、耳朵；被头发、眼镜挡住的（颜色不像肤色、或者周围不是一整片）不算
    const D = Math.PI / 180, U = .025, v3 = new TT.T.Vector3(), PTS = [];
    [[-1, [56, 62, 68, 74]], [-3, [56, 62, 68, 74]], [-5.6, [70, 76, 82, 86, 94, 98, 104]], [-6.8, [70, 76, 82, 86, 94, 98, 104]]].forEach(([y, lons]) => lons.forEach(lon => PTS.push([lon, y])));
    const seam = ['strong', 'boy', 'leo', 'grandpa', 'kid', 'mom', 'girl', 'prof', 'gale'].map(name => {
      const L = TT.L[name], sk = [parseInt(L.skin.slice(1, 3), 16), parseInt(L.skin.slice(3, 5), 16), parseInt(L.skin.slice(5, 7), 16)], sl = Math.hypot(sk[0], sk[1], sk[2]);
      const r = { name, worst: 0, at: '', n: 0, face: 0, head: 0 };
      for (const detail of ['high', 'low']) {
        const inst = P3.create(L, { detail }); scene.add(inst.root); inst.set({ dir: 'down' });
        for (const yaw of [45, 67.5, 90]) for (const side of [1, -1]) {
          inst.root.rotation.y = -side * yaw * D; scene.updateMatrixWorld(true); render();
          const got = [];
          for (const [lon, y] of PTS) {
            const rho = Math.sqrt(1 - (y / 11.8) * (y / 11.8));
            v3.set(12.45 * rho * Math.sin(side * lon * D) * U, (30.5 + y) * U, 11.75 * rho * Math.cos(lon * D) * U).applyMatrix4(inst.root.matrixWorld).project(TT.cam);
            const px = Math.round((v3.x * .5 + .5) * 256), py = Math.round((v3.y * .5 + .5) * 256), c = [0, 0, 0];
            let lo = 255, hi = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((py + dy) * 256 + px + dx) * 4; lo = Math.min(lo, TT.buf[i + 1]); hi = Math.max(hi, TT.buf[i + 1]); if (!dx && !dy) { c[0] = TT.buf[i]; c[1] = TT.buf[i + 1]; c[2] = TT.buf[i + 2]; } }
            const cl = Math.hypot(c[0], c[1], c[2]) || 1, cos = (c[0] * sk[0] + c[1] * sk[1] + c[2] * sk[2]) / cl / sl;
            if (hi - lo <= 3 && cos > .997 && cl > sl * .5) got.push({ lon, c });
          }
          got.forEach(q => { r.n++; if (q.lon < 90) r.face++; else r.head++; });
          for (let k = 0; k < 3; k++) { const d = Math.max(...got.map(q => q.c[k])) - Math.min(...got.map(q => q.c[k])); if (got.length && d > r.worst) { r.worst = d; r.at = detail + ' ' + yaw + '° ' + (side > 0 ? '左脸' : '右脸'); } }
        }
        inst.dispose();
      }
      return r;
    });
    // 自带的卡通材质：和不带明暗的比，轮廓一样大，不黑不白
    const a = P3.create(TT.L.boy, { mat: flat }); scene.add(a.root); render(); const fa = TT.body(); a.dispose();
    const c = P3.create(TT.L.boy); scene.add(c.root); render(); const fc = TT.body(); const toon = c.body.material.type; c.dispose();
    // 大地图的材质是把 three 的卡通材质改过的（自己算顶点的位置，好加雾和风）：照那个改法做一个，蒙皮照样要管用
    const wm = new Map(), world = (kind, q) => {
      const m = new TT.T.MeshToonMaterial(kind === 'face' ? { map: q.map, alphaTest: .5 } : { vertexColors: true });
      m.onBeforeCompile = sh => {
        const NL = String.fromCharCode(10);
        sh.vertexShader = 'varying float vDep; varying vec3 vWp;' + NL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + NL + 'vec3 oW = vec3(0.0);')
          .replace('#include <project_vertex>', ['vec4 mvPosition = vec4(transformed, 1.0);', '#ifdef USE_INSTANCING', 'mvPosition = instanceMatrix * mvPosition;', '#endif', 'mvPosition = modelMatrix * mvPosition; mvPosition.xyz += oW; vWp = mvPosition.xyz;', 'mvPosition = viewMatrix * mvPosition; vDep = -mvPosition.z;', 'gl_Position = projectionMatrix * mvPosition;'].join(NL));
        sh.fragmentShader = 'varying float vDep; varying vec3 vWp;' + NL + sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = clamp(outgoingLight, diffuseColor.rgb * 0.66, diffuseColor.rgb * 1.06);' + NL + '#include <opaque_fragment>');
      };
      m.customProgramCacheKey = () => 'test-world-' + kind; wm.set(m, kind);
      return m;
    };
    const w = P3.create(TT.L.girl, { mat: world }); scene.add(w.root); w.set({ dir: 'left' }); render(); const fw0 = TT.body(), still = TT.buf.slice();
    w.set({ moving: true }); TT.run(w, .35); render(); const moved = TT.diff(still); w.dispose();
    const d = P3.create(TT.L.girl); scene.add(d.root); d.set({ dir: 'left' }); render(); const fd0 = TT.body(); d.dispose();
    return { n, miss, bald, seam, made: TT.made(), fa, fc, toon, world: { kinds: [...wm.values()].sort().join('+'), same: Math.abs(fw0.n - fd0.n) / fd0.n, mean: fw0.mean / fd0.mean, moved } };
  });
  check(col.miss.length === 0, col.n + ' 个造型：正面有肤色、眼睛、衣服的颜色，背面有头发、背包、裤子 / 裙子、帽子的颜色' + (col.miss.length ? '；缺：' + col.miss.slice(0, 6).join(' | ') : ''));
  check(col.bald.length >= 3 && col.bald.every(r => r.mid === 0 && r.left > 15 && r.right > 15), '光头从背后看：头发只在两边各一撮，后脑勺中间是光的 ' + JSON.stringify(col.bald.map(r => r.name + ' ' + r.left + '/' + r.mid + '/' + r.right)));
  const sm = col.seam, open = sm.filter(r => !['mom', 'prof'].includes(r.name));   // 波波头、发髻把耳朵后面盖住了，那两个只看脸颊
  check(sm.every(r => r.worst <= 4 && r.n >= 24 && r.face >= 20) && open.every(r => r.head >= 12), '带着灯转到 45° / 67.5° / 90°：脸颊上、脸和头的交界两边，肤色是同一个颜色（最多差 ' + Math.max(...sm.map(r => r.worst)) + ' 级；' + sm.map(r => r.name + ' ' + r.face + '+' + r.head + ' 个点' + (r.worst > 4 ? ' 差 ' + r.worst + '（' + r.at + '）' : '')).join('，') + '）');
  check(col.made.nBody === 1 && col.made.nFace >= 10 && col.made.nFace <= col.n * 2, '调用的人给的材质工厂：身体的材质只要了 1 个（大家共用），脸的每张贴图要一个（' + col.made.nFace + ' 个）');
  check(col.toon === 'MeshToonMaterial' && Math.abs(col.fc.n - col.fa.n) < col.fa.n * .03 && col.fc.mean > col.fa.mean * .55 && col.fc.mean < col.fa.mean * 1.08, '不给材质工厂：用自带的卡通材质，画出来不黑不白（平均亮度是本色的 ' + Math.round(col.fc.mean / col.fa.mean * 100) + '%）');

  check(col.world.kinds === 'body+face' && col.world.same < .01 && Math.abs(col.world.mean - 1) < .03 && col.world.moved > 250, '像大地图那样改过着色器的卡通材质（自己算顶点位置）：蒙皮照样管用，画出来和自带材质一样（轮廓差 ' + (col.world.same * 100).toFixed(1) + '%，走起来变了 ' + col.world.moved + ' 个像素）');

  // ---------- 4. 动作 ----------
  const anim = await E(() => {
    const { P3, scene, render, run, L } = TT, o = {};
    const g = P3.create(L.girl, { seed: .3 }); scene.add(g.root);
    const bn = g.bones, span = () => ({ lo: 9, hi: -9 }), put = (s, v) => { if (v < s.lo) s.lo = v; if (v > s.hi) s.hi = v; }, wid = s => s.hi - s.lo;
    // 站着
    let leg = span(), br = span(), lidOpen = 0, lidShut = 0;
    g.set({ dir: 'down', moving: false });
    run(g, 9, () => { put(leg, bn.legL.rotation.x); put(br, bn.chest.scale.y); if (bn.lid.scale.x > .5) lidShut++; else lidOpen++; });
    o.idleLeg = wid(leg); o.breath = wid(br); o.blinks = lidShut; o.open = lidOpen;
    render(); const still = TT.buf.slice();
    // 走路
    const legL = span(), legR = span(), tail = span(), bagS = span(), hip = span();
    let opp = 0, armOpp = 0, n = 0, maxDiff = 0, finite = true;
    g.set({ moving: true });
    run(g, .5);
    run(g, 2, () => {
      const a = bn.legL.rotation.x, c = bn.legR.rotation.x, arm = bn.armL.rotation.x;
      put(legL, a); put(legR, c); put(tail, bn.tailA.rotation.x); put(bagS, bn.bag.rotation.x); put(hip, bn.hips.position.y);
      if (Math.abs(a) > .15) { n++; if (a * c < 0) opp++; if (a * arm < 0) armOpp++; }
      Object.values(bn).forEach(q => { if (![q.position.x, q.position.y, q.position.z, q.quaternion.x, q.quaternion.w, q.scale.x].every(isFinite)) finite = false; });
    });
    for (let k = 0; k < 6; k++) { run(g, 1 / 15); render(); maxDiff = Math.max(maxDiff, TT.diff(still)); }
    Object.assign(o, { legL: wid(legL), legR: wid(legR), opp: opp / n, armOpp: armOpp / n, tail: wid(tail), bag: wid(bagS), bob: wid(hip), maxDiff, finite, yawWalk: g.pivot.rotation.y });
    // 停下来
    g.set({ moving: false }); run(g, 1.2);
    o.stopLeg = Math.abs(bn.legL.rotation.x) + Math.abs(bn.legR.rotation.x);
    // 转身
    const ys = [];
    g.set({ dir: 'left' }); g.tick(1 / 60); o.turn1 = g.pivot.rotation.y;
    run(g, .7); o.turnLeft = g.pivot.rotation.y;
    g.set({ dir: 'up' }); let maxStep = 0, prev = g.pivot.rotation.y;
    run(g, .7, () => { const y = g.pivot.rotation.y; maxStep = Math.max(maxStep, Math.abs(y - prev)); ys.push(y); prev = y; });
    o.turnUp = Math.cos(g.pivot.rotation.y - Math.PI); o.maxStep = maxStep; o.viaBack = ys.every(y => y <= -Math.PI / 2 + 1e-6);
    // 刚建出来、还没动过：第一次设朝向直接到位
    const f = P3.create(L.boy); f.set({ dir: 'right' }); o.snap = f.pivot.rotation.y; f.dispose();
    // 各种状态
    const pose = () => [bn.armL.rotation.x, bn.armL.rotation.z, bn.armR.rotation.x, bn.armR.rotation.z, bn.legL.rotation.x, bn.legL.rotation.z, bn.legR.rotation.x, bn.head.rotation.x, bn.hips.rotation.x];
    g.set({ dir: 'down', moving: false, state: '', snap: true }); run(g, 1.5); const base = pose();
    o.states = {};
    for (const st of ['bike', 'surf', 'hop', 'talk', 'wave']) {
      g.set({ state: st, moving: st === 'bike' }); let far = 0, fin = true;
      run(g, 1.2, () => { const q = pose(); q.forEach((v, i) => { if (!isFinite(v)) fin = false; far = Math.max(far, Math.abs(v - base[i])); }); });
      o.states[st] = fin ? far : -1;
      g.set({ state: '', moving: false }); run(g, 1);
    }
    o.back = pose().reduce((m, v, i) => Math.max(m, Math.abs(v - base[i])), 0);
    g.set({ state: 'dive' }); run(g, .5); o.unknown = pose().reduce((m, v, i) => Math.max(m, Math.abs(v - base[i])), 0);
    g.dispose();

    // 脚滑不滑：speed 是真的在地上走多快（世界单位每秒，小人大小 1）。小人原地走，地面按这个速度往后退——踩着地的那只脚在地面上的位置不能动
    const U = .025, ANK = 2.2 * U, b = P3.create(L.boy, { seed: .1 }), bb = b.bones, v3 = new TT.T.Vector3(), q4 = new TT.T.Quaternion();
    scene.add(b.root);
    o.feet = [.6, 1.2, 2.5, 5.5, 9].map(sp => {
      b.set({ dir: 'down', moving: true, speed: sp, state: '' }); run(b, 1.5);
      const r = { sp, drift: 0, low: 9, air: 0, both: 0, frames: 0, steps: 0, tilt: 0, gait: P3.gait(sp) }, st = [null, null];
      for (let i = 0, t = 0; i < 720; i++, t += 1 / 360) {
        b.tick(1 / 360); b.root.updateMatrixWorld(true);
        let on = 0;
        ['footL', 'footR'].forEach((nm, k) => {
          bb[nm].getWorldPosition(v3);
          r.low = Math.min(r.low, v3.y);
          if (v3.y < ANK + .0008) {
            on++;
            const gz = v3.z + sp * (t + 1 / 360);   // 这只脚在地面上的位置（小人朝 +z 走了 sp × t）
            if (!st[k]) { st[k] = { lo: gz, hi: gz }; r.steps++; } else { st[k].lo = Math.min(st[k].lo, gz); st[k].hi = Math.max(st[k].hi, gz); r.drift = Math.max(r.drift, st[k].hi - st[k].lo); }
            bb[nm].getWorldQuaternion(q4); r.tilt = Math.max(r.tilt, Math.abs(q4.x), Math.abs(q4.z));   // 踩着地的鞋是平的
          } else st[k] = null;
        });
        r.frames++; if (!on) r.air++; if (on === 2) r.both++;
      }
      return r;
    });
    // 跳台阶：姿势跟着调用的人给的 phase 走
    const hopAt = ph => { b.set({ moving: false, state: 'hop', phase: ph }); run(b, .4); return { lift: (bb.legL.position.y - (12.2 - 12.4) * U) / U, arm: bb.armL.rotation.z, hips: (bb.hips.position.y - 12.4 * U) / U, toe: bb.footL.rotation.x - -bb.legL.rotation.x, tail: bb.bag.rotation.x }; };
    o.hop = [0, .3, .5, .8, 1].map(hopAt);
    const again = hopAt(.3); o.hopSame = [Math.abs(again.lift - o.hop[1].lift), Math.abs(again.arm - o.hop[1].arm)];
    // 不给 phase：自己用 0.3 秒从起跳走到落地
    b.set({ state: '', phase: null }); run(b, .6); b.set({ state: 'hop' });
    run(b, .12); const mid = (bb.legL.position.y - (12.2 - 12.4) * U) / U; run(b, .5); o.hopAuto = { mid, end: (bb.legL.position.y - (12.2 - 12.4) * U) / U, arm: bb.armL.rotation.z };
    b.dispose();
    return o;
  });
  check(anim.idleLeg < .02 && anim.breath > .01, '站着：腿不动，身子有呼吸的起伏');
  check(anim.blinks > 0 && anim.open > anim.blinks * 5, '会眨眼（9 秒里闭了 ' + anim.blinks + ' 帧）');
  check(anim.legL > .7 && anim.legR > .7 && anim.opp > .95, '走路：两条腿一前一后摆（摆幅 ' + anim.legL.toFixed(2) + ' 弧度）');
  check(anim.armOpp > .95 && anim.bob > .0005, '手和同一边的腿反着摆，身子上下颠（' + (anim.bob * 1000).toFixed(0) + ' 毫）');
  check(anim.tail > .1 && anim.bag > .03, '马尾和背包跟着晃（马尾 ' + anim.tail.toFixed(2) + '，背包 ' + anim.bag.toFixed(2) + ' 弧度）');
  check(anim.maxDiff > 250 && anim.finite, '走路时画面真的在变（和站着比最多差 ' + anim.maxDiff + ' 个像素），骨头的数都正常');
  check(anim.stopLeg < .04, '停下来：腿收回去');
  check(anim.turn1 < -.05 && anim.turn1 > -1.5 && Math.abs(anim.turnLeft + Math.PI / 2) < .02 && Math.abs(anim.yawWalk) < 1e-6, '转身不是一下子转过去（第一帧转了 ' + Math.round(-anim.turn1 * 57.3) + '°），最后转到位');
  check(anim.turnUp > .999 && anim.maxStep < .5 && anim.viaBack, '从朝左转到朝上：走近的那一边（不绕一大圈）');
  check(Math.abs(anim.snap - Math.PI / 2) < 1e-6, '刚建出来第一次设朝向：直接到位，不转');
  check(Object.values(anim.states).every(v => v > .15) && anim.back < .08 && anim.unknown < .08, '骑车 / 踏浪 / 跳 / 说话 / 挥手各有各的姿势，放开就回到站姿；不认识的状态当平常 ' + JSON.stringify(anim.states, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
  // 步子
  const ft = anim.feet, fmt = r => r.sp + ' → 每秒 ' + (r.gait.f * 2).toFixed(1) + ' 步、滑 ' + (r.drift * 1000).toFixed(1) + ' 毫';
  check(ft.every(r => r.steps >= 4 && r.drift < .004 && r.low > .055 - .0006 && r.tilt < .01), '踩在地上的脚不滑、不陷进地里、鞋是平的（每秒走 ' + ft.map(fmt).join('；') + '）');
  check(ft.every(r => Math.abs(r.gait.stride * r.gait.f / r.gait.d - r.sp) < r.sp * .001), '步子是按速度算的：踩在地上那一段的长度 × 每秒几个来回 ÷ 踩地的时间比例 = 走路的速度');
  check(ft[0].gait.d === .5 && ft[0].air === 0 && ft[3].gait.d < .3 && ft[3].air > ft[3].frames * .3 && ft.every(r => r.both < r.frames * .02), '慢的时候是走（总有一只脚在地上），游戏里的速度是跑（两脚都离地的时间占 ' + Math.round(ft[3].air / ft[3].frames * 100) + '%）');
  check(ft[1].gait.f > ft[0].gait.f && ft[3].gait.f > ft[1].gait.f && ft[4].gait.f < 4, '走得快步子就密，但不会密成一团（每秒最多 ' + (ft[4].gait.f * 2).toFixed(1) + ' 步）');
  // 跳
  const hp = anim.hop;
  check(hp[1].lift > 2.5 && hp[1].arm > 1 && hp[0].lift < 2 && hp[0].arm < .6, '跳台阶·上去：腿收起来（' + hp[1].lift.toFixed(1) + '）、手往上抬（' + hp[1].arm.toFixed(2) + ' 弧度）');
  check(hp[3].lift < .6 && hp[3].arm > 1.4 && hp[3].toe > .2 && hp[3].tail > hp[1].tail + .1, '跳台阶·下来：腿伸出去够地面、脚尖朝下、手还举着，背包飘起来');
  check(hp[0].hips < -1 && hp[4].hips < -1 && hp[2].hips > -.2 && hp[4].arm < .8, '起跳和落地各蹲一下，落地时手放下来');
  check(anim.hopSame[0] < .01 && anim.hopSame[1] < .06 && anim.hopAuto.mid > 2 && anim.hopAuto.end < 2 && anim.hopAuto.arm < .8, '姿势只看调用的人给的 phase（同一个 phase 同一个姿势）；不给 phase 就自己用 0.3 秒走完');

  // ---------- 5. 共用、不泄漏 ----------
  const leak = await E(() => {
    const { P3, scene, render, mem, looks, L } = TT, o = {};
    P3.release(); render(); const m0 = mem();
    // 同样的造型共用网格、贴图、材质；不同的精细度是不同的网格
    const a = P3.create(L.boy), c = P3.create(Object.assign({ note: '别的字段不算' }, L.boy)), d = P3.create(L.boy, { detail: 'low' }), e = P3.create(L.girl);
    o.share = a.body.geometry === c.body.geometry && a.face.geometry === c.face.geometry && a.face.material === c.face.material && a.body.material === e.body.material && a.body.skeleton !== c.body.skeleton;
    o.lod = a.body.geometry !== d.body.geometry && d.tris < a.tris / 2;
    [a, c, d, e].forEach(i => i.dispose());
    o.rounds = [];
    for (let round = 0; round < 4; round++) {
      const list = [];
      looks.forEach(([n, look], i) => { for (let k = 0; k < 2; k++) { const inst = P3.create(look, { detail: (i + round % 2) % 3 === 0 ? 'low' : 'high' }); inst.root.position.set((i % 12) * .01, 0, -k * .01); inst.set({ dir: 'up', moving: true }).tick(.05); scene.add(inst.root); list.push(inst); } });
      render();
      o.rounds.push(Object.assign(mem(), P3.stats()));
      list.forEach(i => i.dispose());
    }
    render(); o.after = Object.assign(mem(), P3.stats());
    // 忘了 dispose 的，release() 也一起收掉
    const left = P3.create(L.mom); scene.add(left.root); render();
    P3.release(); render();
    o.leftGone = left.root.parent === null; o.end = Object.assign(mem(), P3.stats()); o.m0 = m0;
    return o;
  });
  check(leak.share, '同样的造型：网格、脸的贴图和材质共用，骨头各人一副');
  check(leak.lod, '两档精细度是两份网格，省电档的三角形不到精细档的一半');
  // 第 1、3 轮和第 2、4 轮各是同一批（哪些人用省电档轮着换）：缓存热了以后，同一批再来一遍，显存里的东西一个不多
  const r0 = leak.rounds[0], r1 = leak.rounds[1], r2 = leak.rounds[2], r3 = leak.rounds[3];
  check(r0.live === all.n * 2 && r3.geo === r1.geo && r3.tex === r1.tex && r3.prog === r0.prog && r2.geo <= (all.n + 48) * 2 && r2.tex <= all.n * 2 + 1 + all.n + 48, '全部造型各建 2 个、搭了放、放了搭四轮：显存里的东西没有越来越多（几何体 / 贴图 / 着色器）' + JSON.stringify(leak.rounds.map(r => r.geo + '/' + r.tex + '/' + r.prog)));
  check(leak.after.live === 0 && leak.after.geos <= 48 && leak.after.geo - leak.m0.geo === leak.after.geos * 2 && leak.after.tex - leak.m0.tex <= leak.after.faces + 1, '都 dispose 以后只留着缓存里的 ' + leak.after.geos + ' 个造型（下次不用重搭），骨头贴图都放掉了');
  check(leak.end.geo === leak.m0.geo && leak.end.tex === leak.m0.tex && leak.end.geos === 0 && leak.end.faces === 0 && leak.end.mats === 0 && leak.end.live === 0 && leak.leftGone, 'release() 以后显存里的几何体、贴图回到开始的数（' + leak.m0.geo + ' / ' + leak.m0.tex + ' → ' + leak.end.geo + ' / ' + leak.end.tex + '），忘了 dispose 的也收掉了');

  // ---------- 6. 留一张图 ----------
  await E(() => {
    const { T, R, P3, scene, cam, L } = TT;
    R.setSize(900, 300, false); P3D.renderer.domElement.style.width = '900px'; P3D.renderer.domElement.style.height = '300px';
    cam.aspect = 3; cam.fov = 14; cam.position.set(0, 1.9, 9); cam.lookAt(0, .62, 0); cam.updateProjectionMatrix();
    ['boy', 'girl', 'leo', 'mia', 'mom', 'prof', 'hiker', 'guard'].forEach((n, i) => { const inst = P3.create(L[n], { seed: i / 8 }); inst.root.position.x = (i - 3.5) * .78; inst.set({ dir: ['up', 'down', 'left', 'right'][i % 4], moving: i % 2 === 0 }); for (let k = 0; k < 30; k++) inst.tick(1 / 60); scene.add(inst.root); });
    R.info.reset(); R.setViewport(0, 0, 900, 300); R.setClearColor(0x86c964, 1); R.clear(); R.render(scene, cam);
  });
  await p.locator('#gl').screenshot({ path: out + '/people3d.png' });
  await E(() => EchoPeople3D.release());

  check(!errs.length, '全程没有报错' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
  console.log(fails ? 'FAIL ' + fails : 'PASS');
  if (fails) process.exitCode = 1;
  await b.close(); s.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
