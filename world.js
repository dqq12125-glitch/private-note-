// 回声岛 · 大地图冒险：走路、草丛遇怪、训练师、怪兽中心、商店、道馆、守卫、英语对话
(function () {
  'use strict';

  // ---------- 地图模板 ----------
  // # 边界树  T 树  . 草地  , 草丛(会遇到野生怪兽)  = 小路  ~ 水  F 花  B 告示牌  o 道具
  // C/c 怪兽中心/门  G/g 道馆/门  M/m 商店/门  ^ 北出口  v 南出口  @ 起点  1-5 人物
  const TEMPLATES = [
    {
      rows: [
        '#########^########',
        '#TT,,,,,#2#,,,,TT#',
        '#T,,,,,,#.#,,,,,T#',
        '#,,,,,,,,.,,,,,,,#',
        '#,,,,4,,,.,,,,,,,#',
        '#........=.......#',
        '#.GGGGG..=..MMMM.#',
        '#.GGGGG..=..MMMM.#',
        '#.GGgGG..=..MMmM.#',
        '#.......==......B#',
        '#~~~.....=.......#',
        '#~~~..3..=...,,,,#',
        '#~~~.....=...,,,,#',
        '#.o......=...,,5,#',
        '#,,,,,...=...,,,,#',
        '#,,,,,...=.......#',
        '#,,,,,...=..CCCC.#',
        '#.......T=..CCCC.#',
        '#.F.F....=..CCcC.#',
        '#........=====...#',
        '#.B......=....1..#',
        '#TT......=.....TT#',
        '#TTT....@=....TTT#',
        '#########v########',
      ],
      npc: { 1: { role: 'talk' }, 2: { role: 'guard' }, 3: { role: 'quiz' }, 4: { role: 'trainer', face: 'right', sight: 4, under: ',' }, 5: { role: 'trainer', face: 'left', sight: 6, under: ',' } },
    },
    {
      rows: [
        '#########^########',
        '#,,,,,,,#2#,,,,,,#',
        '#,,4,,,,#.#,,,,,,#',
        '#,,,,,,,,.,,,,,,,#',
        '#........=....o..#',
        '#.CCCC...=..~~~~.#',
        '#.CCCC...=..~~~~.#',
        '#.CCcC...=..~~~~.#',
        '#........=..~~~~.#',
        '#.B..1...=.......#',
        '#..=======.....3.#',
        '#..=......,,,,,,.#',
        '#..=......,,5,,,.#',
        '#..=......,,,,,,.#',
        '#..=.............#',
        '#..=..GGGGG..MMMM#',
        '#..=..GGGGG..MMMM#',
        '#..=..GGgGG..MMmM#',
        '#..=...........F.#',
        '#..==========...T#',
        '#TT......@=...TTT#',
        '#########v########',
      ],
      npc: { 1: { role: 'talk' }, 2: { role: 'guard' }, 3: { role: 'quiz' }, 4: { role: 'trainer', face: 'right', sight: 4, under: ',' }, 5: { role: 'trainer', face: 'left', sight: 3, under: ',' } },
    },
  ];
  const PALETTES = [
    { grass: '#8fd16a', speck: '#79bd57', tall: '#4fa83d', blade: '#2f7d2a', path: '#ecd9a8', pebble: '#d6be86', tree: '#2e7d32', treeHi: '#43a047' },
    { grass: '#b5d86a', speck: '#9dc257', tall: '#7fa83a', blade: '#5b7f22', path: '#ead3a0', pebble: '#d3b77f', tree: '#c9772b', treeHi: '#e39a45' },
    { grass: '#7fd3a6', speck: '#68bd8f', tall: '#3fa77a', blade: '#237a55', path: '#e7dcc0', pebble: '#cbbd98', tree: '#1f7a5c', treeHi: '#2f9a74' },
  ];
  const SNOW = { grass: '#eef4f8', speck: '#d9e6ee', tall: '#b9d7e3', blade: '#7fa9bb', path: '#d7dee4', pebble: '#bdc8d0', tree: '#46806a', treeHi: '#e8f3f7' };
  const WALK = '.,=F^vo';
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const STEP_MS = 170;
  const TRAINER_NAMES = ['Jack', 'Amy', 'Ben', 'Kate', 'Sam', 'Lucy', 'Mike', 'Anna', 'Leo', 'Mia', 'Max', 'Emma', 'Tony', 'Nora'];

  let E = null, MG = null;
  let Z = null, cv = null, ctx = null, T = 40, VW = 0, VH = 0, raf = 0, running = false;
  const PL = { x: 0, y: 0, fx: 0, fy: 0, dir: 'up', moving: false, t0: 0 };
  const FL = { x: 0, y: 0, fx: 0, fy: 0 };
  let held = null, dlg = null, busy = false;
  const imgCache = {};
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const WS = () => E.S.world;
  const hasBadge = z => !!E.S.mon.badges[z] || E.S.settings.unlockAll;

  // ---------- 生成区域 ----------
  function buildZone(z) {
    const t = TEMPLATES[z % TEMPLATES.length], mirror = Math.floor(z / 2) % 2 === 1;
    const rows = t.rows.map(r => mirror ? [...r].reverse().join('') : r);
    const grid = rows.map(r => [...r]);
    const H = grid.length, Wd = grid[0].length;
    const npcs = [], signs = [], picks = [];
    let start = { x: 1, y: H - 2 };
    for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
      const c = grid[y][x];
      if (/[1-5]/.test(c)) {
        const d = t.npc[c];
        let face = d.face || 'down';
        if (mirror) face = face === 'left' ? 'right' : face === 'right' ? 'left' : face;
        npcs.push({ id: c, role: d.role, x, y, face, sight: d.sight || 0 });
        grid[y][x] = d.under || '.';
      } else if (c === '@') { start = { x, y }; grid[y][x] = '.'; }
      else if (c === 'B') signs.push({ x, y });
      else if (c === 'o') picks.push({ x, y });
      else if (c === 'v' && z === 0) grid[y][x] = '#';
      else if (c === '^' && z === E.W.length - 1) grid[y][x] = '#';
    }
    const buildings = {};
    'CGM'.split('').forEach(L => {
      let x0 = 99, y0 = 99, x1 = -1, y1 = -1, door = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
        const c = grid[y][x];
        if (c === L || c === L.toLowerCase()) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        if (c === L.toLowerCase()) door = { x, y };
      }
      if (door) buildings[L] = { x0, y0, x1, y1, door };
    });
    return { z, W: Wd, H, grid, npcs, signs, picks, start, buildings, pal: z === 11 ? SNOW : PALETTES[z % PALETTES.length] };
  }
  const tile = (x, y) => (Z.grid[y] && Z.grid[y][x]) || '#';
  const npcVisible = n => !(n.role === 'guard' && hasBadge(Z.z));
  const npcAt = (x, y) => Z.npcs.find(n => n.x === x && n.y === y && npcVisible(n));
  const pickKey = p => 'p:' + Z.z + ':' + p.x + ':' + p.y;
  const pickAt = (x, y) => Z.picks.find(p => p.x === x && p.y === y && !WS().flags[pickKey(p)]);
  const walkable = (x, y) => WALK.includes(tile(x, y)) && !npcAt(x, y);
  const doorAt = (x, y) => Object.entries(Z.buildings).find(([, b]) => b.door.x === x && b.door.y === y);
  const signAt = (x, y) => Z.signs.findIndex(s => s.x === x && s.y === y);
  const findTile = ch => { for (let y = 0; y < Z.H; y++) for (let x = 0; x < Z.W; x++) if (Z.grid[y][x] === ch) return { x, y }; return null; };
  const trainerKey = n => 't:' + Z.z + ':' + n.id;
  const trainerInfo = n => {
    const k = (Z.z * 2 + +n.id) % TRAINER_NAMES.length, e = TRAINER_LOOKS[(Z.z + +n.id) % TRAINER_LOOKS.length];
    return { name: TRAINER_NAMES[k], g: e[0], look: e[1] };
  };
  // 每个人物的名字、声音和造型
  function npcLook(n) {
    if (n.role === 'guard') return { name: 'Guard', g: 'm', look: LOOKS.guard };
    if (n.role === 'talk' && Z.z === 0) return { name: 'Professor Echo', g: 'f', look: LOOKS.prof };
    if (n.role === 'quiz') return { name: 'Mr Wise', g: 'm', look: LOOKS.teacher };
    if (n.role === 'trainer') return trainerInfo(n);
    const v = VILLAGER_LOOKS[(Z.z + +n.id) % VILLAGER_LOOKS.length];
    return { name: v[0], g: v[1], look: v[2] };
  }

  // ---------- 进入 / 切换区域 ----------
  function savePos() {
    const ws = WS();
    ws.z = Z.z; ws.x = PL.x; ws.y = PL.y; ws.dir = PL.dir;
    E.save();
  }
  function loadZone(z, spawn) {
    Z = buildZone(z);
    const ws = WS();
    ws.visited[z] = 1;
    let p;
    if (spawn && typeof spawn === 'object') p = spawn;
    else if (spawn === 'north') { const ex = findTile('^'); p = ex ? { x: ex.x, y: ex.y + 1, dir: 'down' } : null; }
    else if (spawn === 'center' || spawn === 'fly') { const c = Z.buildings.C; p = c ? { x: c.door.x, y: c.door.y + 1, dir: 'down' } : null; }
    if (!p || !walkable(p.x, p.y)) p = { x: Z.start.x, y: Z.start.y, dir: 'up' };
    PL.x = PL.fx = p.x; PL.y = PL.fy = p.y; PL.dir = p.dir || 'up'; PL.moving = false;
    const [dx, dy] = DIRS[PL.dir];
    const bx = p.x - dx, by = p.y - dy;
    FL.x = FL.fx = WALK.includes(tile(bx, by)) ? bx : p.x;
    FL.y = FL.fy = WALK.includes(tile(bx, by)) ? by : p.y;
    savePos();
    hud();
  }
  function enter(z, how) {
    if (!E.S.mon.box.length) { E.toast('先在「怪兽冒险」里选一只初始怪兽'); return; }
    E.primeTTS(); E.ac();
    E.closeModal();
    E.show('world');
    ensureDom();
    const ws = WS();
    if (how === 'resume' && ws.started && ws.x >= 0) loadZone(ws.z, { x: ws.x, y: ws.y, dir: ws.dir });
    else loadZone(z, how);
    ws.started = true;
    E.save();
    resize();
    startLoop();
    banner();
    if (!ws.introDone) {
      ws.introDone = true; E.save();
      setTimeout(() => talk([
        { who: '旁白', emo: '📣', en: 'Welcome to the Echo Islands!', zh: '欢迎来到回声群岛！' },
        { who: '旁白', emo: '📣', en: 'Use the arrow pad to walk. Press A to talk.', zh: '用方向键走路，走到别人面前按 A 键和他说话。' },
        { who: '旁白', emo: '📣', en: 'First, go and find Professor Echo!', zh: '先去找小镇里的回声博士吧！她就在你右边。' },
      ]), 1800);
    }
  }
  async function goZone(nz, spawn) {
    busy = true;
    const v = $('w-view'); v.classList.add('fade');
    await sleep(320);
    loadZone(nz, spawn);
    v.classList.remove('fade');
    banner();
    busy = false;
  }
  function banner() {
    const b = $('w-banner'), w = E.W[Z.z];
    b.innerHTML = '<small>第 ' + (Z.z + 1) + ' 镇' + (hasBadge(Z.z) && E.S.mon.badges[Z.z] ? ' · 🏅' : '') + '</small><b>' + w.name + '</b><span>' + E.esc(w.en) + ' Town</span>';
    b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 2600);
    E.say('Welcome to ' + w.en.replace(/[!?]/g, '') + ' Town!');
  }
  function hud() {
    const w = E.W[Z.z];
    $('w-zname').textContent = w.icon + ' ' + w.name;
    $('w-zsub').textContent = '第 ' + (Z.z + 1) + ' 镇 · 野外 Lv ' + MG.zoneLv(Z.z) + '–' + (MG.zoneLv(Z.z) + 2);
    $('w-badges').textContent = '🏅 ' + Object.keys(E.S.mon.badges).length;
    $('w-balls').textContent = '🔮 ' + E.S.mon.balls;
  }

  // ---------- 移动 ----------
  function tryMove(dir) {
    if (PL.moving || dlg || busy || !$('modal').hidden) return;
    PL.dir = dir;
    const [dx, dy] = DIRS[dir], nx = PL.x + dx, ny = PL.y + dy;
    const door = doorAt(nx, ny);
    if (door) { enterDoor(door[0], door[1]); return; }
    if (!walkable(nx, ny)) return;
    FL.fx = FL.x; FL.fy = FL.y; FL.x = PL.x; FL.y = PL.y;
    PL.fx = PL.x; PL.fy = PL.y; PL.x = nx; PL.y = ny;
    PL.moving = true; PL.t0 = performance.now();
  }
  function onStep() {
    const t = tile(PL.x, PL.y);
    savePos();
    const p = pickAt(PL.x, PL.y);
    if (p) { pickup(p); return; }
    if (t === '^') { goZone(Z.z + 1, 'south'); return; }
    if (t === 'v') { goZone(Z.z - 1, 'north'); return; }
    const tr = spotTrainer();
    if (tr) { trainerSpotted(tr); return; }
    if (t === ',' && Math.random() < 0.13 && MG.anyAlive()) encounter();
  }
  function spotTrainer() {
    for (const n of Z.npcs) {
      if (n.role !== 'trainer' || WS().flags[trainerKey(n)]) continue;
      if (Math.abs(n.x - PL.x) + Math.abs(n.y - PL.y) === 1) return n;
      const [dx, dy] = DIRS[n.face];
      for (let d = 1; d <= n.sight; d++) {
        const cx = n.x + dx * d, cy = n.y + dy * d;
        if (cx === PL.x && cy === PL.y) return n;
        if (!WALK.includes(tile(cx, cy)) || npcAt(cx, cy)) break;
      }
    }
    return null;
  }
  const faceTo = (a, b) => Math.abs(b.x - a.x) > Math.abs(b.y - a.y) ? (b.x > a.x ? 'right' : 'left') : (b.y > a.y ? 'down' : 'up');
  async function trainerSpotted(n) {
    busy = true;
    n.alert = performance.now();
    E.SFX.tap(); setTimeout(() => E.SFX.tap(), 120);
    await sleep(750);
    while (Math.abs(n.x - PL.x) + Math.abs(n.y - PL.y) > 1) {
      n.face = faceTo(n, PL);
      const [dx, dy] = DIRS[n.face];
      if (!WALK.includes(tile(n.x + dx, n.y + dy)) || (n.x + dx === FL.x && n.y + dy === FL.y && !(n.x + dx === PL.x && n.y + dy === PL.y))) break;
      n.x += dx; n.y += dy;
      await sleep(160);
    }
    n.face = faceTo(n, PL);
    PL.dir = faceTo(PL, n);
    busy = false;
    trainerTalk(n);
  }

  // ---------- 对话框 ----------
  function talk(pages, onDone) { dlg = { pages, i: 0, onDone, tries: 0 }; showPage(); }
  const page = () => dlg && dlg.pages[dlg.i];
  function showPage() {
    const pg = page(), box = $('w-dlg');
    if (!pg) { closeDlg(); return; }
    dlg.tries = 0; dlg.picked = false;
    const sr = E.speakMode() === 'sr', esc = E.esc, typing = !pg.kind && !!pg.en;
    clearInterval(dlg.tw);
    const face = pg.look ? '<img class="d-face" src="' + portrait(pg.look) + '" alt="">' : '<span class="d-face emo">' + (pg.emo || '💬') + '</span>';
    let body = '<div class="d-name">' + esc(pg.who || '') + '</div><button class="spk mini d-hear" data-act="wHear" aria-label="再听一遍">' + E.SPK + '</button>' +
      '<div class="d-row">' + face + '<div class="d-text">' +
      (pg.en ? '<div class="d-en" id="d-en">' + (typing ? '' : esc(pg.en)) + '</div>' : '') +
      (pg.zh ? '<div class="d-zh' + (typing ? ' wait' : '') + '" id="d-zh">' + esc(pg.zh) + '</div>' : '') + '</div></div>';
    if (pg.kind === 'speak') {
      body += '<div class="d-task"><div class="say-text" id="w-say">' + E.wordsHTML(pg.target) + '</div>' +
        (sr ? '<button class="mic" id="w-mic" data-act="wMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="w-hint">点麦克风，大声说出来</div><div class="heard" id="w-heard"></div>'
          : '<div class="mic-hint" id="w-hint">大声说出来，说完点「我说完了」</div><button class="btn leaf" data-act="wSelfDone">🎤 我说完了</button>') +
        '<button class="link" data-act="wSkip">先跳过</button></div>';
    } else if (pg.kind === 'answer') {
      body += '<div class="d-task"><div class="opts list">' + pg.opts.map((o, k) => '<button class="opt en" data-act="wOpt" data-i="' + k + '"><span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div>' +
        (sr ? '<small class="tip">选一句正确的回答，<b>大声说出来</b>（点选项可以先听）</small><button class="mic" id="w-mic" data-act="wMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="w-hint"></div><div class="heard" id="w-heard"></div>'
          : '<small class="tip" id="w-hint">点出正确的回答，再大声说一遍</small>') +
        '<button class="link" data-act="wSkip">先跳过</button></div>';
    } else body += '<span class="d-next">▼</span>';
    box.innerHTML = body;
    box.classList.toggle('task', !!pg.kind);
    box.hidden = false;
    if (typing) {
      // 英文一个字一个字打出来，按 A 可以直接显示全部
      let i = 0;
      dlg.typing = true;
      const el = $('d-en'), d = dlg;
      d.tw = setInterval(() => {
        i += 1;
        if (el) el.textContent = pg.en.slice(0, i);
        if (i >= pg.en.length) finishType(d);
      }, 26);
    }
    if (pg.onShow) pg.onShow();
    if (pg.en) E.say(pg.en, undefined, pg.g);
  }
  function finishType(d) {
    d = d || dlg;
    if (!d || !d.typing) return;
    clearInterval(d.tw); d.typing = false;
    const pg = d.pages[d.i], el = $('d-en'), zh = $('d-zh');
    if (el && pg) el.textContent = pg.en;
    if (zh) zh.classList.remove('wait');
  }
  function nextPage() {
    const pg = page();
    if (dlg && dlg.typing) { finishType(); return; }
    if (!pg || pg.kind) return;
    dlg.i++;
    if (dlg.i >= dlg.pages.length) closeDlg(); else showPage();
  }
  function closeDlg() {
    const d = dlg;
    if (d) clearInterval(d.tw);
    dlg = null;
    $('w-dlg').hidden = true;
    E.stopListening();
    if (d && d.onDone) d.onDone();
  }
  function insertPages(extra) { if (extra && extra.length) dlg.pages.splice(dlg.i + 1, 0, ...extra); }
  function passTask(score) {
    const pg = page();
    E.S.stats.spoken++; E.qProg('spoken', 1);
    if (score >= 85) { E.S.stats.perfect++; E.qProg('perfect', 1); }
    E.SFX.ok(3);
    insertPages(pg.pass ? pg.pass(score) : null);
    E.save();
    pg.kind = null;
    nextPage();
  }
  function failTask() {
    const pg = page();
    if (pg.q) E.addWrong(pg.q);
    insertPages(pg.fail ? pg.fail() : null);
    pg.kind = null;
    nextPage();
  }
  async function dlgMic() {
    const pg = page();
    if (!pg || !pg.kind) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const m = $('w-mic'), d = dlg;
    m.classList.add('on'); m.innerHTML = E.STOP;
    $('w-hint').textContent = '正在听……';
    const res = await E.recognize(x => { const h = $('w-heard'); if (h) h.textContent = x; });
    if (dlg !== d || page() !== pg) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) {
      E.RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') E.RT.noRec = true;
      E.toast('这里用不了语音识别，改成自己说、自己确认');
      showPage();
      return;
    }
    if (!res.alts.length) { $('w-hint').textContent = '没听清，大声一点再试一次'; return; }
    if (pg.kind === 'speak') {
      const r = E.bestScore(pg.target, res.alts);
      $('w-heard').textContent = '我听到：“' + r.heard + '”';
      document.querySelectorAll('#w-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
      if (r.score >= 55) { $('w-hint').innerHTML = '<b>' + r.score + ' 分</b> 说得好！'; setTimeout(() => { if (page() === pg) passTask(r.score); }, 700); }
      else { d.tries++; $('w-hint').textContent = r.score + ' 分，红色的词再读准一点' + (d.tries >= 2 ? '，也可以先跳过' : ''); }
    } else {
      const sc = pg.opts.map(o => E.bestScore(o.t, res.alts));
      let bi = 0; sc.forEach((s, k) => { if (s.score > sc[bi].score) bi = k; });
      $('w-heard').textContent = '我听到：“' + sc[bi].heard + '”';
      if (pg.opts[bi].c && sc[bi].score >= 45) { markOpts(bi); setTimeout(() => { if (page() === pg) passTask(sc[bi].score); }, 700); }
      else if (!pg.opts[bi].c && sc[bi].score >= 60) { markOpts(pg.opts.findIndex(o => o.c), bi); setTimeout(() => { if (page() === pg) failTask(); }, 900); }
      else { d.tries++; $('w-hint').textContent = '没对上任何一个回答，再说一次' + (d.tries >= 2 ? '，也可以先跳过' : ''); }
    }
  }
  function markOpts(ri, wi) { document.querySelectorAll('#w-dlg .opt').forEach((b, k) => b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim')); }
  function onOpt(i) {
    const pg = page();
    if (!pg || pg.kind !== 'answer') return;
    if (E.speakMode() === 'sr') { E.say(pg.opts[i].t); return; }
    if (dlg.picked) return;
    dlg.picked = true;
    if (pg.opts[i].c) {
      markOpts(i);
      E.say(pg.opts[i].t);
      $('w-hint').innerHTML = '选对了！大声说一遍，然后点 <button class="btn small leaf" data-act="wSelfDone">🎤 我说完了</button>';
    } else { markOpts(pg.opts.findIndex(o => o.c), i); setTimeout(() => { if (page() === pg) failTask(); }, 900); }
  }

  // ---------- 人物 / 告示牌 / 建筑 ----------
  const today = () => E.dayStr();
  const dailyDone = k => WS().daily[k] === today();
  const markDaily = k => { WS().daily[k] = today(); };
  function interact() {
    if (dlg) { nextPage(); return; }
    if (busy || PL.moving || !$('modal').hidden) return;
    const [dx, dy] = DIRS[PL.dir], tx = PL.x + dx, ty = PL.y + dy;
    const n = npcAt(tx, ty);
    if (n) { n.face = faceTo(n, PL); npcTalk(n); return; }
    const si = signAt(tx, ty);
    if (si >= 0) { signTalk(si); return; }
    const door = doorAt(tx, ty);
    if (door) enterDoor(door[0], door[1]);
  }
  function signTalk(i) {
    const w = E.W[Z.z];
    const pages = i === 0
      ? [{ who: '告示牌', emo: '🪧', en: 'Welcome to ' + w.en.replace(/[!?]/g, '') + ' Town!', zh: '欢迎来到' + w.name + '！' }]
      : [{ who: '告示牌', emo: '🪧', en: 'Watch out! Wild monsters live in the tall grass.', zh: '小心！草丛里住着野生怪兽。' }];
    talk(pages);
  }
  function npcTalk(n) {
    const w = E.W[Z.z], info = npcLook(n), g = info.g, name = info.name, z = Z.z, dk = 'd:' + z + ':' + n.id;
    const P = (en, zh, extra) => Object.assign({ who: name, look: info.look, g, en, zh }, extra || {});
    if (n.role === 'guard') {
      talk([P("Stop! You can't go north without this town's badge.", '站住！没有本镇的徽章不能往北走。'), P('Beat the gym leader first!', '先去道馆打败馆主吧！')]);
    } else if (n.role === 'trainer') {
      if (WS().flags[trainerKey(n)]) talk([P('You are really strong! Let me train more.', '你真厉害！我要再多练练。')]);
      else trainerTalk(n);
    } else if (n.role === 'quiz') {
      const k = Math.floor(Math.random() * w.dlgs.length), it = w.dlgs[k];
      const opts = [{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))].sort(() => Math.random() - .5);
      talk([
        P("Hello! Can you answer my question?", '你好！你能回答我的问题吗？' + (dailyDone(dk) ? '' : '答对了今天有礼物哦。')),
        P(it[0], '听一听，选出合适的回答，然后说出来。', {
          kind: 'answer', opts, q: { kind: 'dlg', w: z, i: k },
          pass: () => {
            if (dailyDone(dk)) return [P('Great answer! See you tomorrow.', '回答得真好！明天再来吧。')];
            markDaily(dk); E.S.mon.balls += 1; hud();
            return [P('Perfect! Here is an Echo Ball for you.', '太棒了！送你一个回声球。', { onShow: () => { E.SFX.coin(); E.toast('🔮 回声球 +1', 'gold'); } })];
          },
          fail: () => [P('Hmm, not quite. You can say: "' + it[1] + '"', '差一点。可以这样回答：“' + it[1] + '”')],
        }),
      ]);
    } else if (z === 0) {
      talk([
        P("Hello! I'm Professor Echo.", '你好！我是回声博士。'),
        P('Monsters on these islands understand English.', '这些岛上的怪兽都听得懂英语。'),
        P('Speak clearly, and your monsters will be strong!', '英语说得越清楚，你的怪兽就越强！'),
        P('Beat the gym leader, and the guard will let you go north.', '打败道馆馆主，守卫就会让你往北走。'),
        P('Now, can you say this to me?', '现在，你能对我说这句话吗？', {
          kind: 'speak', target: 'Nice to meet you, Professor!',
          pass: () => dailyDone(dk) ? [P('Very good!', '说得很好！')] : (markDaily(dk), E.S.coins += 10, E.renderTop(), [P('Very good! Here are 10 coins.', '说得很好！送你 10 个金币。')]),
        }),
      ]);
    } else {
      const s1 = w.sents[(+n.id + z) % w.sents.length], s2 = w.sents[(+n.id + z + 3) % w.sents.length];
      talk([
        P('Hi there!', '你好呀！'),
        P(s1[0], s1[1]),
        P(s2[0], s2[1]),
        P('Can you say it?', '你能跟我说一遍吗？', {
          kind: 'speak', target: s2[0], q: { kind: 'sent', w: z, i: w.sents.indexOf(s2) },
          pass: () => dailyDone(dk) ? [P('Good job!', '说得真好！')] : (markDaily(dk), E.S.coins += 10, E.renderTop(), [P('Good job! Here are 10 coins.', '说得真好！送你 10 个金币。')]),
        }),
      ]);
    }
  }
  function trainerTalk(n) {
    const t = trainerInfo(n), z = Z.z, lv = MG.zoneLv(z);
    talk([{ who: t.name, look: t.look, g: t.g, en: "Hi! I'm " + t.name + ". Let's have a monster battle!", zh: '你好！我是 ' + t.name + '，我们来一场怪兽对战吧！' }], () => {
      const two = n.id === '5';
      battle('trainer', {
        foes: MG.trainerFoes(z, +n.id, two ? 2 : 1, two ? lv : lv + 1),
        trainer: { name: t.name, img: portrait(t.look) },
        after: res => {
          if (res === 'win') { WS().flags[trainerKey(n)] = 1; E.save(); talk([{ who: t.name, look: t.look, g: t.g, en: 'Wow, you are really strong!', zh: '哇，你真的很厉害！' }]); }
        },
      });
    });
  }
  function enterDoor(L) {
    const w = E.W[Z.z];
    if (L === 'C') {
      const c = Z.buildings.C;
      talk([
        { who: 'Nurse Amy', look: LOOKS.nurse, g: 'f', en: 'Welcome to the Monster Center!', zh: '欢迎来到怪兽中心！' },
        { who: 'Nurse Amy', look: LOOKS.nurse, g: 'f', en: 'Let me heal your monsters.', zh: '我来帮你的怪兽恢复体力。', onShow: () => { MG.healAll(); WS().center = { z: Z.z, x: c.door.x, y: c.door.y + 1 }; E.SFX.win(); E.save(); } },
        { who: 'Nurse Amy', look: LOOKS.nurse, g: 'f', en: 'Your monsters are fully healed. Good luck!', zh: '怪兽们都恢复精神了，加油！' },
      ]);
    } else if (L === 'M') {
      E.say('Welcome! What would you like?', undefined, 'm');
      shopSheet();
    } else if (L === 'G') {
      const b = w.boss, had = !!E.S.mon.badges[Z.z];
      talk([
        { who: b.name, emo: b.emoji, g: 'm', en: b.hello, zh: had ? '又来挑战我了？好，再比一场！' : '我是' + b.name + '！想拿本镇的徽章，就先打败我！' },
      ], () => battle('leader', {
        after: res => {
          if (res === 'win' && !had) {
            talk([
              { who: b.name, emo: b.emoji, g: 'm', en: 'You beat me! Here is my badge.', zh: '你赢了！这枚徽章给你。' },
              { who: b.name, emo: b.emoji, g: 'm', en: 'The road to the north is open now.', zh: '现在北边的路已经为你打开了！' },
            ]);
          }
        },
      }));
    }
  }
  function pickup(p) {
    WS().flags[pickKey(p)] = 1;
    const potion = (p.x + p.y + Z.z) % 2 === 1;
    if (potion) E.S.mon.potions = (E.S.mon.potions || 0) + 1; else E.S.mon.balls += 1;
    E.save(); hud(); E.SFX.coin();
    talk([{ who: '旁白', emo: potion ? '🧪' : '🔮', en: potion ? 'You found a potion!' : 'You found an Echo Ball!', zh: potion ? '你捡到了一瓶药水！' : '你捡到了一个回声球！' }]);
  }
  function shopSheet() {
    const m = E.S.mon;
    E.openModal('<div class="big">🏪</div><h2>小镇商店</h2><p>你有 <b>' + E.S.coins + '</b> 金币 · 🔮 ' + m.balls + ' · 🧪 ' + (m.potions || 0) + '</p>' +
      '<div class="ach"><span class="ae">🔮</span><div style="flex:1"><b>回声球 ×3</b><small>收服野生怪兽用 · Echo Ball</small></div><button class="btn small sun" data-act="wBuy" data-i="0"' + (E.S.coins < 30 ? ' disabled' : '') + '>30 金币</button></div>' +
      '<div class="ach"><span class="ae">🧪</span><div style="flex:1"><b>药水 ×1</b><small>战斗中回复 40% 体力 · Potion</small></div><button class="btn small sun" data-act="wBuy" data-i="1"' + (E.S.coins < 20 ? ' disabled' : '') + '>20 金币</button></div>' +
      '<button class="btn ghost wide" data-act="close">Thank you! 谢谢</button>');
  }

  // ---------- 战斗 ----------
  function encounter() { battle('wild', {}); }
  async function battle(kind, o) {
    busy = true;
    trans = performance.now();
    E.SFX.hit();
    await sleep(820);
    trans = 0;
    stopLoop();
    const ok = MG.battle(kind, Z.z, {
      foes: o.foes, trainer: o.trainer,
      onEnd: res => {
        E.show('world');
        resize(); hud();
        startLoop();
        busy = false;
        if (res === 'lose') whiteout();
        else if (o.after) o.after(res);
      },
    });
    if (!ok) { startLoop(); busy = false; }
  }
  function whiteout() {
    MG.healAll();
    const c = WS().center;
    if (c && c.z === Z.z) { PL.x = PL.fx = c.x; PL.y = PL.fy = c.y; PL.dir = 'down'; }
    else loadZone(Z.z, 'center');
    FL.x = FL.fx = PL.x; FL.y = FL.fy = PL.y;
    savePos();
    talk([
      { who: '旁白', emo: '💤', en: 'Your monsters are tired. You hurried to the Monster Center.', zh: '你的怪兽都累倒了……你赶快跑回了怪兽中心。' },
      { who: 'Nurse Amy', look: LOOKS.nurse, g: 'f', en: "Your monsters are healed now. Don't give up!", zh: '怪兽们已经恢复了，别灰心，再去试试吧！' },
    ]);
  }

  // ---------- 画面 ----------
  function ensureDom() {
    if (cv) return;
    const sec = $('world');
    sec.innerHTML =
      '<div class="w-hud"><button class="x" data-act="wExit" aria-label="回首页">✕</button><div class="w-zone"><b id="w-zname"></b><small id="w-zsub"></small></div>' +
      '<span class="chip" id="w-badges"></span><span class="chip" id="w-balls"></span><button class="w-menu" data-act="wMenu" aria-label="菜单">☰</button></div>' +
      '<div class="w-view" id="w-view"><canvas id="w-canvas"></canvas><div class="w-banner" id="w-banner" hidden></div><div class="w-dlg" id="w-dlg" data-act="wA" hidden></div></div>' +
      '<div class="w-ctrl"><div class="dpad" id="w-dpad">' +
      ['up', 'left', 'right', 'down'].map(d => '<button class="dp dp-' + d + '" data-dir="' + d + '" aria-label="' + { up: '上', left: '左', right: '右', down: '下' }[d] + '">' + { up: '▲', left: '◀', right: '▶', down: '▼' }[d] + '</button>').join('') +
      '</div><div class="ab"><button class="bb" data-act="wB">B<small>菜单</small></button><button class="ba" data-act="wA">A<small>对话</small></button></div></div>';
    cv = $('w-canvas'); ctx = cv.getContext('2d');
    const dp = $('w-dpad');
    const down = e => { const b = e.target.closest('[data-dir]'); if (!b) return; e.preventDefault(); held = b.dataset.dir; b.classList.add('on'); tryMove(held); };
    const up = () => { held = null; dp.querySelectorAll('.on').forEach(b => b.classList.remove('on')); };
    dp.addEventListener('pointerdown', down);
    dp.addEventListener('pointerup', up);
    dp.addEventListener('pointercancel', up);
    dp.addEventListener('pointerleave', up);
    dp.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', () => { if (running) resize(); });
    const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    document.addEventListener('keydown', e => {
      if (!running || !$('modal').hidden) return;
      if (KEYS[e.key]) { e.preventDefault(); held = KEYS[e.key]; tryMove(held); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') { e.preventDefault(); interact(); }
      else if (e.key === 'Escape' || e.key === 'x') { e.preventDefault(); bButton(); }
    });
    document.addEventListener('keyup', e => { if (KEYS[e.key] === held) held = null; });
  }
  // 静态图层（地面、路、水、树、房子）按区域画一次缓存起来，每帧只画会动的东西
  let SC = null, SCkey = '', trans = 0;
  const OUT = 'rgba(32,38,50,.78)';
  function resize() {
    const v = $('w-view'), dpr = window.devicePixelRatio || 1;
    VW = v.clientWidth; VH = v.clientHeight;
    T = Math.max(28, Math.floor(VW / 9));
    cv.width = VW * dpr; cv.height = VH * dpr;
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    SCkey = '';
  }
  function startLoop() { if (running) return; running = true; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; cancelAnimationFrame(raf); held = null; }
  function frame(now) {
    if (!running) return;
    if (PL.moving && now - PL.t0 >= STEP_MS) { PL.moving = false; PL.fx = PL.x; PL.fy = PL.y; FL.fx = FL.x; FL.fy = FL.y; onStep(); }
    if (!PL.moving && held && !dlg && !busy) tryMove(held);
    // 镇上的人会时不时转头看看四周
    Z.npcs.forEach(n => {
      if (n.role !== 'talk' && n.role !== 'quiz') return;
      if (!n.nextTurn) n.nextTurn = now + 1500 + Math.random() * 3000;
      if (now > n.nextTurn && !dlg) { n.face = ['up', 'down', 'left', 'right', 'down'][Math.floor(Math.random() * 5)]; n.nextTurn = now + 2000 + Math.random() * 3500; }
    });
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  // ---------- 小工具 ----------
  function hsh(x, y) { let h = (x * 374761393 + y * 668265263 + Z.z * 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  }
  function rr(g, x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b);
    g.lineTo(x + w, y + h - c); g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d);
    g.lineTo(x, y + a); g.quadraticCurveTo(x, y, x + a, y); g.closePath();
  }
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); };
  const isPath = (x, y) => '=^v'.includes(tile(x, y));
  const isWater = (x, y) => tile(x, y) === '~';
  const isTall = (x, y) => tile(x, y) === ',';
  // 同类地块连在一起，边角自动变圆
  function blob(g, x, y, same, inset, color, R) {
    const sx = x * T, sy = y * T;
    const up = same(x, y - 1), dn = same(x, y + 1), lf = same(x - 1, y), rt = same(x + 1, y);
    const r = R == null ? T * .38 : R;
    const x0 = sx + (lf ? 0 : inset), y0 = sy + (up ? 0 : inset), x1 = sx + T - (rt ? 0 : inset), y1 = sy + T - (dn ? 0 : inset);
    g.fillStyle = color;
    rr(g, x0, y0, x1 - x0 + (rt ? .6 : 0), y1 - y0 + (dn ? .6 : 0), [!up && !lf ? r : 0, !up && !rt ? r : 0, !dn && !rt ? r : 0, !dn && !lf ? r : 0]);
    g.fill();
  }

  // ---------- 静态图层 ----------
  function buildStatic() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    SC = document.createElement('canvas');
    SC.width = Math.ceil(Z.W * T * dpr); SC.height = Math.ceil(Z.H * T * dpr);
    const g = SC.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const p = Z.pal;
    for (let y = 0; y < Z.H; y++) for (let x = 0; x < Z.W; x++) ground(g, x, y);
    for (let y = 0; y < Z.H; y++) for (let x = 0; x < Z.W; x++) {
      if (isPath(x, y)) {
        blob(g, x, y, isPath, 0, shade(p.path, .86));
        blob(g, x, y, isPath, T * .07, p.path, T * .32);
        if (hsh(x, y) > .6) { g.fillStyle = p.pebble; circ(g, x * T + T * (.25 + hsh(y, x) * .5), y * T + T * (.3 + hsh(x + 3, y) * .4), T * .045); g.fill(); }
      } else if (isWater(x, y)) {
        blob(g, x, y, isWater, 0, '#e9f8fc');
        blob(g, x, y, isWater, T * .1, '#6fcdf0', T * .32);
        blob(g, x, y, isWater, T * .22, '#4ab6e6', T * .24);
      }
    }
    for (let y = 0; y < Z.H; y++) for (let x = 0; x < Z.W; x++) {
      const c = tile(x, y);
      if (c === ',') tallGrass(g, x, y);
      else if (c === 'F') flowers(g, x, y);
      else if (c === 'B') sign(g, x, y);
      else if (c === '^' || c === 'v') {
        g.fillStyle = 'rgba(18,48,74,.28)';
        const up = c === '^', cx = x * T + T / 2, cy = y * T + T / 2;
        g.beginPath(); g.moveTo(cx - T * .18, cy + (up ? T * .1 : -T * .1)); g.lineTo(cx + T * .18, cy + (up ? T * .1 : -T * .1)); g.lineTo(cx, cy + (up ? -T * .14 : T * .14)); g.fill();
      }
    }
    Object.entries(Z.buildings).forEach(([L, b]) => building(g, L, b));
    for (let y = 0; y < Z.H; y++) for (let x = 0; x < Z.W; x++) if ('#T'.includes(tile(x, y))) tree(g, x, y);
    SCkey = Z.z + ':' + T;
  }
  function ground(g, x, y) {
    const p = Z.pal, sx = x * T, sy = y * T, r = hsh(x, y);
    g.fillStyle = r < .5 ? p.grass : shade(p.grass, .975);
    g.fillRect(sx, sy, T + .6, T + .6);
    if (r > .7) {
      g.strokeStyle = p.speck; g.lineWidth = Math.max(1.2, T * .035);
      const tx = sx + T * (.2 + hsh(y, x) * .6), ty = sy + T * (.35 + r * .35);
      g.beginPath(); g.moveTo(tx - T * .06, ty); g.lineTo(tx - T * .09, ty - T * .09); g.moveTo(tx, ty); g.lineTo(tx, ty - T * .12); g.moveTo(tx + T * .06, ty); g.lineTo(tx + T * .09, ty - T * .09); g.stroke();
    } else if (r < .06) {
      const fx = sx + T * .5, fy = sy + T * .5;
      g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { circ(g, fx + Math.cos(k * 1.26) * T * .045, fy + Math.sin(k * 1.26) * T * .045, T * .035); g.fill(); }
      g.fillStyle = '#ffc93c'; circ(g, fx, fy, T * .03); g.fill();
    }
  }
  function leaf(g, bx, by, h, w, lean, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx - w * .2 + lean * .4, by - h * .55, bx + lean, by - h); g.quadraticCurveTo(bx + w * .3 + lean * .3, by - h * .5, bx + w, by); g.closePath(); g.fill();
  }
  function clump(g, bx, by, h, p) {
    leaf(g, bx - T * .07, by, h * .8, T * .07, -T * .1, p.blade);
    leaf(g, bx + T * .07, by, h * .85, T * .07, T * .1, p.blade);
    leaf(g, bx, by, h, T * .08, 0, shade(p.tall, 1.12));
  }
  function tallGrass(g, x, y) {
    const p = Z.pal, sx = x * T, sy = y * T;
    blob(g, x, y, isTall, T * .04, p.tall, T * .3);
    [[.27, .42], [.73, .42], [.5, .7], [.22, .97], [.78, .97]].forEach(([fx, fy]) => clump(g, sx + T * fx, sy + T * fy, T * .34, p));
  }
  function flowers(g, x, y) {
    const sx = x * T, sy = y * T;
    [['#ff6b9d', .28, .38], ['#ffd54f', .7, .3], ['#ffffff', .5, .72], ['#b388ff', .82, .78]].forEach(([col, fx, fy]) => {
      const cx = sx + T * fx, cy = sy + T * fy;
      g.strokeStyle = '#4c8f3a'; g.lineWidth = Math.max(1, T * .03); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + T * .12); g.stroke();
      g.fillStyle = col; for (let k = 0; k < 5; k++) { circ(g, cx + Math.cos(k * 1.26) * T * .05, cy + Math.sin(k * 1.26) * T * .05, T * .045); g.fill(); }
      g.fillStyle = '#f9a825'; circ(g, cx, cy, T * .035); g.fill();
    });
  }
  function sign(g, x, y) {
    const sx = x * T, sy = y * T;
    g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, sx + T / 2, sy + T * .88, T * .3, T * .08); g.fill();
    g.fillStyle = '#8a5a33'; g.fillRect(sx + T * .3, sy + T * .45, T * .08, T * .42); g.fillRect(sx + T * .62, sy + T * .45, T * .08, T * .42);
    g.fillStyle = '#d7a86e'; rr(g, sx + T * .14, sy + T * .16, T * .72, T * .4, T * .06); g.fill();
    g.strokeStyle = OUT; g.lineWidth = Math.max(1.2, T * .035); g.stroke();
    g.fillStyle = '#8a5a33'; g.fillRect(sx + T * .24, sy + T * .27, T * .52, T * .04); g.fillRect(sx + T * .24, sy + T * .36, T * .4, T * .04); g.fillRect(sx + T * .24, sy + T * .45, T * .46, T * .04);
  }
  function tree(g, x, y) {
    const p = Z.pal, sx = x * T, sy = y * T, r = hsh(x, y), border = tile(x, y) === '#';
    const cx = sx + T / 2 + (border ? (r - .5) * T * .14 : 0), cy = sy + T * (border ? .42 : .4);
    const R = T * (border ? .52 : .44);
    g.fillStyle = 'rgba(0,0,0,.16)'; ell(g, cx, sy + T * .9, R * .8, T * .11); g.fill();
    g.fillStyle = '#6d4121'; rr(g, cx - T * .07, sy + T * .52, T * .14, T * .36, T * .03); g.fill();
    g.fillStyle = shade(p.tree, .72); circ(g, cx, cy + T * .07, R); g.fill();
    g.fillStyle = p.tree; circ(g, cx, cy, R * .93); g.fill();
    g.fillStyle = shade(p.tree, 1.12); circ(g, cx - R * .18, cy - R * .12, R * .62); g.fill();
    g.fillStyle = p.treeHi; circ(g, cx - R * .36, cy - R * .36, R * .28); g.fill();
    g.strokeStyle = shade(p.tree, .72); g.lineWidth = Math.max(1, T * .03);
    g.beginPath(); g.arc(cx + R * .25, cy + R * .2, R * .22, .3, 2.2); g.stroke();
  }
  function building(g, L, b) {
    const x = b.x0 * T, y = b.y0 * T, w = (b.x1 - b.x0 + 1) * T, h = (b.y1 - b.y0 + 1) * T;
    const roofC = L === 'C' ? '#e8514a' : L === 'M' ? '#3d8fe0' : E.W[Z.z].color;
    const wallC = L === 'C' ? '#fff6ea' : L === 'M' ? '#f2f8ff' : '#fbf1de';
    const lw = Math.max(1.4, T * .04), rh = h * .5;
    g.lineWidth = lw; g.strokeStyle = OUT;
    g.fillStyle = 'rgba(0,0,0,.2)'; rr(g, x + T * .15, y + h - T * .1, w - T * .1, T * .22, T * .1); g.fill();
    // 墙
    g.fillStyle = wallC; rr(g, x + T * .12, y + rh * .75, w - T * .24, h - rh * .75, T * .06); g.fill(); g.stroke();
    g.fillStyle = shade(wallC, .86); g.fillRect(x + T * .12 + lw / 2, y + h - T * .2, w - T * .24 - lw, T * .2 - lw / 2);
    if (L === 'G') { g.fillStyle = shade(wallC, .92); [x + T * .2, x + w - T * .42].forEach(px => { g.fillRect(px, y + rh, T * .22, h - rh - T * .2); }); }
    // 屋顶
    g.fillStyle = roofC;
    g.beginPath(); g.moveTo(x - T * .06, y + rh); g.lineTo(x + T * .34, y + T * .06); g.lineTo(x + w - T * .34, y + T * .06); g.lineTo(x + w + T * .06, y + rh); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = shade(roofC, .8); g.lineWidth = Math.max(1, T * .03);
    for (let k = 1; k < 4; k++) {
      const yy = y + T * .06 + (rh - T * .06) * k / 4, inset = T * .34 * (1 - k / 4);
      g.beginPath(); g.moveTo(x + inset, yy); g.lineTo(x + w - inset, yy); g.stroke();
      for (let xx = x + inset + (k % 2) * T * .2 + T * .2; xx < x + w - inset - T * .1; xx += T * .4) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy - (rh - T * .06) / 4); g.stroke(); }
    }
    g.fillStyle = shade(roofC, 1.15); g.fillRect(x + T * .36, y + T * .06, w - T * .72, T * .07);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + T * .12, y + rh, w - T * .24, T * .12);
    g.lineWidth = lw; g.strokeStyle = OUT;
    // 烟囱
    if (L !== 'G') { g.fillStyle = shade(roofC, .7); g.fillRect(x + w - T * .9, y - T * .05, T * .22, T * .35); g.strokeRect(x + w - T * .9, y - T * .05, T * .22, T * .35); }
    // 招牌
    const label = L === 'C' ? 'CENTER' : L === 'M' ? 'SHOP' : 'GYM';
    g.font = '800 ' + Math.round(T * .3) + 'px "Baloo 2", Nunito, "PingFang SC", sans-serif';
    const tw = g.measureText(label).width, pw = tw + T * (L === 'M' ? .45 : .75), ph = T * .44, px = x + w / 2 - pw / 2, py = y + rh * .52 - ph / 2;
    g.fillStyle = '#ffffff'; rr(g, px, py, pw, ph, ph / 2); g.fill(); g.strokeStyle = shade(roofC, .7); g.stroke();
    g.fillStyle = roofC; g.textAlign = 'left'; g.textBaseline = 'middle';
    const tx = px + (L === 'M' ? T * .22 : T * .5);
    g.fillText(label, tx, py + ph / 2 + 1);
    if (L === 'C') { const cx = px + T * .28, cy = py + ph / 2; g.fillRect(cx - T * .11, cy - T * .035, T * .22, T * .07); g.fillRect(cx - T * .035, cy - T * .11, T * .07, T * .22); }
    if (L === 'G') { const cx = px + T * .28, cy = py + ph / 2; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? T * .06 : T * .14; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } g.closePath(); g.fillStyle = '#ffc53d'; g.fill(); }
    g.strokeStyle = OUT;
    // 商店的条纹遮阳棚
    if (L === 'M') {
      const ay = y + rh + T * .02, n = Math.max(4, Math.round((w - T * .24) / (T * .32)));
      const aw = (w - T * .24) / n;
      for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#ffffff' : roofC; g.beginPath(); g.moveTo(x + T * .12 + k * aw, ay); g.lineTo(x + T * .12 + (k + 1) * aw, ay); g.lineTo(x + T * .12 + (k + 1) * aw, ay + T * .2); g.quadraticCurveTo(x + T * .12 + (k + .5) * aw, ay + T * .32, x + T * .12 + k * aw, ay + T * .2); g.closePath(); g.fill(); }
    }
    // 窗户
    const wy = y + rh + (h - rh) * .28, ww = T * .5, wh = T * .4;
    [x + w * .14, x + w * .86 - ww].forEach(wx => {
      if (Math.abs(wx + ww / 2 - (b.door.x * T + T / 2)) < T * .6) return;
      g.fillStyle = '#8fd3f4'; rr(g, wx, wy, ww, wh, T * .05); g.fill(); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, T * .03); g.beginPath(); g.moveTo(wx + ww / 2, wy + 2); g.lineTo(wx + ww / 2, wy + wh - 2); g.moveTo(wx + 2, wy + wh / 2); g.lineTo(wx + ww - 2, wy + wh / 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(wx + ww * .12, wy + wh * .8); g.lineTo(wx + ww * .35, wy + wh * .15); g.lineTo(wx + ww * .45, wy + wh * .15); g.lineTo(wx + ww * .22, wy + wh * .8); g.fill();
      g.lineWidth = lw; g.strokeStyle = OUT;
    });
    // 门
    const dx = b.door.x * T, dy = b.door.y * T;
    g.fillStyle = shade(roofC, .85); rr(g, dx + T * .12, dy + T * .12, T * .76, T * .16, T * .05); g.fill(); g.stroke();
    g.fillStyle = '#6b4a36'; rr(g, dx + T * .2, dy + T * .3, T * .6, T * .7, [T * .12, T * .12, 0, 0]); g.fill(); g.stroke();
    g.fillStyle = L === 'C' ? '#c9ecff' : '#8d6e63'; rr(g, dx + T * .27, dy + T * .37, T * .46, T * .56, [T * .08, T * .08, 0, 0]); g.fill();
    g.fillStyle = '#ffd54f'; circ(g, dx + T * .64, dy + T * .68, T * .04); g.fill();
    g.fillStyle = shade(roofC, .9); rr(g, dx + T * .16, dy + T * 1.02, T * .68, T * .12, T * .04); g.fill();
  }

  // ---------- 人物（手绘小人：四个方向，走路摆臂） ----------
  const LOOKS = {
    player: { skin: '#ffd9b8', hair: '#3b2a20', style: 'short', hat: 'cap', hatC: '#e53935', shirt: '#3a86ff', bottom: '#2e3a59', bag: '#ffb300' },
    prof: { skin: '#ffe0c4', hair: '#b8b8b8', style: 'bun', shirt: '#8e6cef', coat: '#ffffff', bottom: '#455a64', skirt: true, glasses: true },
    nurse: { skin: '#ffdcc2', hair: '#e57373', style: 'long', hat: 'nurse', shirt: '#f8bbd0', bottom: '#f48fb1', skirt: true },
    guard: { skin: '#f1c7a0', hair: '#2b2b2b', style: 'short', hat: 'helmet', hatC: '#1e3a8a', shirt: '#1e40af', bottom: '#1e293b' },
    teacher: { skin: '#f5d0b0', hair: '#5d4037', style: 'short', shirt: '#2cae69', bottom: '#34495e', glasses: true },
    clerk: { skin: '#ffdcc2', hair: '#1b1b1b', style: 'short', hat: 'cap', hatC: '#3d8fe0', shirt: '#ffffff', bottom: '#3d8fe0' },
  };
  const VILLAGER_LOOKS = [
    ['Granny', 'f', { skin: '#f6d5bd', hair: '#e6e6e6', style: 'bun', shirt: '#b388ff', bottom: '#6a5acd', skirt: true }],
    ['Grandpa', 'm', { skin: '#efc9a8', hair: '#cfcfcf', style: 'bald', shirt: '#8d6e63', bottom: '#5d4037', glasses: true }],
    ['Ms Li', 'f', { skin: '#ffdcc2', hair: '#212121', style: 'long', shirt: '#ff8a65', bottom: '#455a64', skirt: true }],
    ['Farmer Joe', 'm', { skin: '#e8b88f', hair: '#6d4c41', style: 'short', hat: 'straw', shirt: '#43a047', bottom: '#1565c0' }],
    ['Chef Mei', 'f', { skin: '#ffdcc2', hair: '#3e2723', style: 'short', hat: 'chef', shirt: '#ffffff', bottom: '#424242' }],
    ['Mr Brown', 'm', { skin: '#d9a57b', hair: '#4e342e', style: 'short', shirt: '#0288d1', bottom: '#37474f' }],
  ];
  const TRAINER_LOOKS = [
    ['m', { skin: '#ffdcc2', hair: '#2b2b2b', style: 'short', hat: 'cap', hatC: '#43a047', shirt: '#ffb300', bottom: '#1e3a8a' }],
    ['f', { skin: '#ffe0c4', hair: '#f4a261', style: 'pigtails', shirt: '#ec407a', bottom: '#6a1b9a', skirt: true }],
    ['m', { skin: '#e8b88f', hair: '#5d4037', style: 'short', shirt: '#26a69a', bottom: '#37474f' }],
    ['f', { skin: '#ffdcc2', hair: '#c62828', style: 'long', shirt: '#7e57c2', bottom: '#263238', skirt: true }],
    ['m', { skin: '#ffd9b8', hair: '#1b1b1b', style: 'short', hat: 'cap', hatC: '#1e88e5', shirt: '#e53935', bottom: '#2e3a59' }],
    ['f', { skin: '#ffe0c4', hair: '#ffd54f', style: 'long', hat: 'cap', hatC: '#ff7043', shirt: '#29b6f6', bottom: '#455a64', skirt: true }],
  ];
  // 以 40px 为设计尺寸画一个 Q 版小人：cx 脚底中心 x，fy 脚底 y，s 缩放后的格子大小
  function drawPerson(g, cx, fy, s, L, dir, phase, moving) {
    const k = s / 40, sw = moving ? Math.sin(phase) : 0, bob = moving ? Math.abs(Math.sin(phase)) * 1.4 : 0;
    const side = dir === 'left' || dir === 'right', back = dir === 'up';
    const fill = (c, stroke) => { g.fillStyle = c; g.fill(); if (stroke !== false) g.stroke(); };
    g.save();
    g.translate(cx, fy); g.scale(k, k);
    g.lineWidth = 1.5; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = 'rgba(0,0,0,.2)'; ell(g, 0, 0, 11, 3.4); g.fill();
    g.translate(0, -bob);
    if (dir === 'left') g.scale(-1, 1);
    const legC = L.bottom, dark = shade(legC, .8);
    // 腿和鞋
    if (side) {
      rr(g, -3 + sw * 3, -12, 5, 11, 2); fill(dark);
      rr(g, -3 - sw * 3, -12, 5, 11, 2); fill(legC);
      rr(g, -3.5 - sw * 3, -3.2, 7, 3.4, 1.6); fill('#3b2f2f');
    } else {
      rr(g, -6, -12 + (sw > 0 ? -1.5 : 0), 5, 11, 2); fill(legC);
      rr(g, 1, -12 + (sw < 0 ? -1.5 : 0), 5, 11, 2); fill(legC);
      rr(g, -6.5, -3.2 + (sw > 0 ? -1.5 : 0), 6, 3.4, 1.6); fill('#3b2f2f');
      rr(g, .5, -3.2 + (sw < 0 ? -1.5 : 0), 6, 3.4, 1.6); fill('#3b2f2f');
    }
    // 后面那只手（侧面）
    if (side) { rr(g, -2 + sw * 3.5, -23, 4.4, 10.5, 2.2); fill(shade(L.coat || L.shirt, .85)); }
    // 裙子 / 身体 / 白大褂
    if (L.skirt) { g.beginPath(); g.moveTo(-8, -18); g.lineTo(8, -18); g.lineTo(10, -9); g.lineTo(-10, -9); g.closePath(); fill(L.bottom); }
    rr(g, -8.5, -25, 17, 14, 5); fill(L.shirt);
    if (L.coat) { rr(g, -9, -25, 18, 17, 4); fill(L.coat); if (!back) { g.beginPath(); g.moveTo(0, -24); g.lineTo(0, -9); g.stroke(); g.fillStyle = L.shirt; g.fillRect(-2.5, -24.5, 5, 6); } }
    if (back && L.bag) { rr(g, -7, -25, 14, 12, 3.5); fill(L.bag); g.beginPath(); g.moveTo(-4, -20); g.lineTo(4, -20); g.stroke(); }
    // 手臂
    const armC = L.coat || L.shirt;
    if (side) { rr(g, -2 - sw * 3.5, -23, 4.4, 10.5, 2.2); fill(armC); circ(g, -.2 - sw * 3.5, -12, 2.4); fill(L.skin); }
    else {
      rr(g, -12.4, -23.5 + sw * 1.5, 4.4, 10.5, 2.2); fill(armC); circ(g, -10.2, -12.5 + sw * 1.5, 2.4); fill(L.skin);
      rr(g, 8, -23.5 - sw * 1.5, 4.4, 10.5, 2.2); fill(armC); circ(g, 10.2, -12.5 - sw * 1.5, 2.4); fill(L.skin);
    }
    // 头发（后面）
    const hy = -34;
    const hairBack = () => {
      g.fillStyle = L.hair;
      if (L.style === 'long') { rr(g, -11, hy - 4, 22, 17, 6); fill(L.hair); }
      if (L.style === 'pigtails') { circ(g, -12, hy + 3, 5); fill(L.hair); circ(g, 12, hy + 3, 5); fill(L.hair); }
      if (L.style === 'bun') { circ(g, back ? 0 : (side ? -6 : 0), hy - 10, 5.5); fill(L.hair); }
    };
    hairBack();
    // 头
    circ(g, 0, hy, 10.5); fill(L.skin);
    // 头发（前面）
    g.fillStyle = L.hair;
    if (L.style === 'bald') { g.beginPath(); g.arc(0, hy, 10.5, Math.PI * .9, Math.PI * 1.15); g.lineTo(-9, hy); g.fill(); g.beginPath(); g.arc(0, hy, 10.5, -Math.PI * .15, Math.PI * .1); g.lineTo(9, hy); g.fill(); }
    else if (back) { g.beginPath(); g.arc(0, hy, 10.8, Math.PI * .92, Math.PI * 2.08); g.closePath(); fill(L.hair); }
    else if (side) { g.beginPath(); g.arc(0, hy, 10.8, Math.PI * .95, Math.PI * 1.9); g.quadraticCurveTo(4, hy - 3, 1, hy - 1); g.quadraticCurveTo(-8, hy - 3, -10, hy + 6); g.closePath(); fill(L.hair); }
    else { g.beginPath(); g.arc(0, hy, 10.8, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(6, hy - 5, 2, hy - 3); g.quadraticCurveTo(-4, hy - 6, -10.6, hy - 1); g.closePath(); fill(L.hair); }
    // 脸
    if (!back) {
      g.fillStyle = '#1d2a36';
      if (side) { ell(g, 5, hy + 1.5, 1.5, 2.2); g.fill(); g.fillStyle = '#ffffff'; circ(g, 5.5, hy + .7, .6); g.fill(); g.fillStyle = 'rgba(255,120,120,.45)'; circ(g, 5.5, hy + 5, 2); g.fill(); g.strokeStyle = '#7a3b2e'; g.beginPath(); g.moveTo(7, hy + 6); g.lineTo(9, hy + 5.6); g.stroke(); }
      else {
        [-4, 4].forEach(ex => { g.fillStyle = '#1d2a36'; ell(g, ex, hy + 1.5, 1.5, 2.2); g.fill(); g.fillStyle = '#ffffff'; circ(g, ex + .5, hy + .7, .6); g.fill(); });
        g.fillStyle = 'rgba(255,120,120,.45)'; circ(g, -6.5, hy + 5, 2); g.fill(); circ(g, 6.5, hy + 5, 2); g.fill();
        g.strokeStyle = '#7a3b2e'; g.beginPath(); g.arc(0, hy + 4.5, 2, .2, Math.PI - .2); g.stroke();
      }
      g.strokeStyle = OUT;
      if (L.glasses) { g.lineWidth = 1.1; if (side) { circ(g, 5, hy + 1.5, 3); g.stroke(); } else { circ(g, -4, hy + 1.5, 3); g.stroke(); circ(g, 4, hy + 1.5, 3); g.stroke(); g.beginPath(); g.moveTo(-1, hy + 1.5); g.lineTo(1, hy + 1.5); g.stroke(); } g.lineWidth = 1.5; }
    }
    // 帽子
    if (L.hat === 'cap') {
      g.beginPath(); g.arc(0, hy - 1, 11, Math.PI, 0); g.closePath(); fill(L.hatC);
      g.fillStyle = '#ffffff'; circ(g, side ? -2 : 0, hy - 7, 2.2); g.fill();
      if (dir === 'down') { ell(g, 0, hy - 1.5, 11.5, 2.6); fill(shade(L.hatC, .8)); }
      else if (side) { rr(g, 4, hy - 3.5, 10, 3, 1.5); fill(shade(L.hatC, .8)); }
    } else if (L.hat === 'helmet') {
      g.beginPath(); g.arc(0, hy - .5, 12, Math.PI, 0); g.closePath(); fill(L.hatC);
      rr(g, -12.5, hy - 1.5, 25, 3, 1.5); fill(shade(L.hatC, .75));
      if (!back) { g.fillStyle = '#ffc53d'; circ(g, side ? 3 : 0, hy - 7, 2.6); g.fill(); }
    } else if (L.hat === 'nurse') {
      rr(g, -6, hy - 15, 12, 7, 2); fill('#ffffff');
      g.fillStyle = '#e53935'; g.fillRect(-1, hy - 14, 2, 5); g.fillRect(-2.5, hy - 12.5, 5, 2);
    } else if (L.hat === 'chef') {
      rr(g, -8, hy - 12, 16, 6, 1.5); fill('#ffffff');
      g.beginPath(); g.arc(-4.5, hy - 15, 5, 0, Math.PI * 2); g.arc(4.5, hy - 15, 5, 0, Math.PI * 2); g.arc(0, hy - 18, 5.5, 0, Math.PI * 2); fill('#ffffff');
    } else if (L.hat === 'straw') {
      ell(g, 0, hy - 5, 16, 3.6); fill('#e9c46a');
      g.beginPath(); g.arc(0, hy - 6, 8, Math.PI, 0); g.closePath(); fill('#e9c46a');
      g.fillStyle = '#c0392b'; g.fillRect(-8, hy - 8, 16, 2);
    }
    g.restore();
  }
  // 对话框头像
  const portraitCache = {};
  function portrait(look) {
    const key = JSON.stringify(look);
    if (!portraitCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#dff1ef'; circ(g, 64, 64, 64); g.fill();
      g.save(); circ(g, 64, 64, 62); g.clip();
      g.fillStyle = '#bfe3dd'; ell(g, 64, 132, 60, 26); g.fill();
      drawPerson(g, 64, 142, 100, look, 'down', 0, false);
      g.restore();
      portraitCache[key] = c.toDataURL();
    }
    return portraitCache[key];
  }

  // ---------- 每一帧 ----------
  function draw(now) {
    if (SCkey !== Z.z + ':' + T) buildStatic();
    const prog = PL.moving ? Math.min(1, (now - PL.t0) / STEP_MS) : 1;
    const px = (PL.fx + (PL.x - PL.fx) * prog) * T, py = (PL.fy + (PL.y - PL.fy) * prog) * T;
    const mw = Z.W * T, mh = Z.H * T;
    const camX = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, px + T / 2 - VW / 2));
    const camY = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, py + T / 2 - VH / 2));
    ctx.fillStyle = shade(Z.pal.tree, .7); ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(SC, -camX, -camY, mw, mh);
    // 水面闪光
    const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(Z.W - 1, Math.ceil((camX + VW) / T));
    const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(Z.H - 1, Math.ceil((camY + VH) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!isWater(x, y)) continue;
      const t = (now / 1400 + hsh(x, y)) % 1, a = Math.sin(t * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * .8).toFixed(2) + ')'; ctx.lineWidth = Math.max(1.5, T * .045); ctx.lineCap = 'round';
      const sx = x * T - camX + T * (.25 + hsh(y, x) * .4), sy = y * T - camY + T * (.35 + hsh(x + 1, y) * .35);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + T * .1, sy - T * .06, sx + T * .2, sy); ctx.stroke();
    }
    // 实体按 y 排序
    const ents = [];
    Z.picks.forEach(p => { if (!WS().flags[pickKey(p)]) ents.push({ y: p.y, f: () => drawItem((p.x + p.y + Z.z) % 2 === 1, p.x * T - camX, p.y * T - camY, now) }); });
    Z.npcs.forEach(n => { if (npcVisible(n)) ents.push({ y: n.y, f: () => drawNpc(n, n.x * T - camX, n.y * T - camY, now) }); });
    const fx = (FL.fx + (FL.x - FL.fx) * prog) * T - camX, fy = (FL.fy + (FL.y - FL.fy) * prog) * T - camY;
    if (!(FL.x === PL.x && FL.y === PL.y)) ents.push({ y: FL.fy + (FL.y - FL.fy) * prog, f: () => drawFollower(fx, fy, now, PL.moving) });
    ents.push({ y: PL.fy + (PL.y - PL.fy) * prog + .01, f: () => drawPerson(ctx, px - camX + T / 2, py - camY + T * .9, T, LOOKS.player, PL.dir, now / 75, PL.moving) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    // 站在草丛里时，草盖住腿
    [[PL.x, PL.y, px - camX, py - camY], [FL.x, FL.y, fx, fy]].forEach(([tx, ty, sx, sy]) => {
      if (PL.moving || tile(tx, ty) !== ',') return;
      [[.25, .98], [.5, 1.02], [.75, .98]].forEach(([ax, ay]) => clump(ctx, sx + T * ax, sy + T * ay, T * .3, Z.pal));
    });
    // 面前可以互动时，显示 A 提示
    if (!dlg && !PL.moving && !busy) {
      const [dx, dy] = DIRS[PL.dir], tx = PL.x + dx, ty = PL.y + dy;
      if (npcAt(tx, ty) || signAt(tx, ty) >= 0 || doorAt(tx, ty)) {
        const bx = tx * T - camX + T / 2, by = ty * T - camY - T * .2 + Math.sin(now / 220) * 3;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; circ(ctx, bx + 1, by + 2, T * .22); ctx.fill();
        ctx.fillStyle = '#ffffff'; circ(ctx, bx, by, T * .22); ctx.fill();
        ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#e53935'; ctx.font = '800 ' + Math.round(T * .26) + 'px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', bx, by + 1);
      }
    }
    // 进入战斗：黑色条纹从两边扫进来
    if (trans) {
      const p = (now - trans) / 700, n = 8, bh = VH / n;
      ctx.fillStyle = '#12304a';
      for (let i = 0; i < n; i++) {
        const w = VW * Math.min(1, Math.max(0, p * 1.7 - i * .07));
        if (i % 2) ctx.fillRect(VW - w, i * bh, w, bh + 1); else ctx.fillRect(0, i * bh, w, bh + 1);
      }
    }
  }
  function drawItem(potion, sx, sy, now) {
    const cx = sx + T / 2, cy = sy + T * .55 + Math.sin(now / 320 + sx) * T * .04;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, cx, sy + T * .86, T * .16, T * .05); ctx.fill();
    ctx.lineWidth = Math.max(1.4, T * .035); ctx.strokeStyle = OUT;
    if (potion) {
      ctx.fillStyle = '#e1f5fe'; rr(ctx, cx - T * .08, cy - T * .26, T * .16, T * .1, T * .02); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff6b9d'; rr(ctx, cx - T * .15, cy - T * .17, T * .3, T * .3, T * .1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; rr(ctx, cx - T * .1, cy - T * .12, T * .05, T * .16, T * .02); ctx.fill();
    } else {
      const R = T * .16;
      ctx.fillStyle = '#8e6cef'; circ(ctx, cx, cy, R); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke(); circ(ctx, cx, cy, R); ctx.stroke();
      ctx.fillStyle = '#ffffff'; circ(ctx, cx, cy, R * .32); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; circ(ctx, cx - R * .45, cy - R * .45, R * .18); ctx.fill();
    }
  }
  function drawNpc(n, sx, sy, now) {
    const info = npcLook(n);
    drawPerson(ctx, sx + T / 2, sy + T * .9, T, info.look, n.face, 0, false);
    if (n.alert && now - n.alert < 1100) {
      const bx = sx + T / 2, by = sy - T * .45;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      rr(ctx, bx - T * .17, by - T * .22, T * .34, T * .4, T * .08); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.font = '900 ' + Math.round(T * .32) + 'px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', bx, by - T * .02);
    }
  }
  function monImg(sp) {
    if (!imgCache[sp.en]) {
      const s = Cartoon.monster(sp).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const im = new Image();
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      imgCache[sp.en] = im;
    }
    return imgCache[sp.en];
  }
  function drawFollower(sx, sy, now, moving) {
    const sp = MG.leadSpecies();
    if (!sp || !window.Cartoon) return;
    const im = monImg(sp);
    if (!im.complete || !im.naturalWidth) return;
    const hop = moving ? Math.abs(Math.sin(now / 90)) * T * .08 : Math.sin(now / 600) * T * .02;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ell(ctx, sx + T / 2, sy + T * .86, T * .26, T * .08); ctx.fill();
    ctx.drawImage(im, sx - T * .05, sy - T * .2 - hop, T * 1.1, T * 1.1);
  }

  // ---------- 菜单 ----------
  function bButton() {
    if (dlg) { const pg = page(); if (!pg.kind) nextPage(); return; }
    menuSheet();
  }
  function menuSheet() {
    const m = E.S.mon;
    E.openModal('<h2>冒险菜单</h2><p>🏅 徽章 ' + Object.keys(m.badges).length + ' / ' + E.W.length + ' · 🔮 ' + m.balls + ' · 🧪 ' + (m.potions || 0) + ' · 💰 ' + E.S.coins + '</p>' +
      '<div class="w-menu-grid"><button class="btn ghost" data-act="mTeam">🐾 我的怪兽</button><button class="btn ghost" data-act="mDex">📖 图鉴</button>' +
      '<button class="btn ghost" data-act="wHelp">❓ 怎么玩</button><button class="btn ghost" data-act="wExit">🏠 回首页</button></div>' +
      '<button class="btn wide" data-act="close">继续冒险</button>');
  }
  function helpSheet() {
    E.openModal('<h2>怎么玩</h2><p>◀▲▼▶ 走路，<b>A</b> 和面前的人说话、看告示牌、进门；<b>B</b> 打开菜单。电脑上可以用方向键 / WASD、空格键。</p>' +
      '<p>🌿 走进深色草丛会遇到野生怪兽。<br>🧑‍🎤 训练师看到你就会过来挑战（红点是他看的方向）。<br>🏥 CENTER：怪兽中心，免费恢复体力。<br>🏪 SHOP：买回声球和药水。<br>🏟️ GYM：打败馆主拿徽章，守卫就会让你去下一个小镇。<br>🔮🧪 地上的道具走过去就能捡。</p>' +
      '<button class="btn wide" data-act="close">知道了</button>');
  }

  // ---------- 对外 ----------
  const actions = {
    wEnter: () => enter(0, 'resume'),
    wFly: t => enter(+t.dataset.z, 'fly'),
    wExit: () => { E.closeModal(); E.goHome('mon'); },
    wA: () => interact(),
    wB: () => bButton(),
    wMenu: () => menuSheet(),
    wHelp: () => helpSheet(),
    wHear: () => { const pg = page(); if (pg) E.say(pg.kind === 'speak' ? pg.target : pg.en, 0.8, pg.g); },
    wMic: () => dlgMic(),
    wSelfDone: () => { const pg = page(); if (pg && pg.kind) passTask(70); },
    wSkip: () => { const pg = page(); if (pg && pg.kind) failTask(); },
    wOpt: t => onOpt(+t.dataset.i),
    wBuy: t => {
      const i = +t.dataset.i, price = i === 0 ? 30 : 20;
      if (E.S.coins < price) return;
      E.S.coins -= price;
      if (i === 0) E.S.mon.balls += 3; else E.S.mon.potions = (E.S.mon.potions || 0) + 1;
      E.save(); E.SFX.coin(); E.renderTop(); hud();
      E.say(i === 0 ? 'Here are three Echo Balls.' : 'Here is a potion.', undefined, 'm');
      shopSheet();
    },
  };
  window.EchoWorld = {
    init(api, mg) { E = api; MG = mg; return actions; },
    fresh: () => ({ started: false, z: 0, x: -1, y: -1, dir: 'up', visited: {}, flags: {}, daily: {}, center: null, introDone: false }),
    stop: () => { stopLoop(); if (dlg) { clearInterval(dlg.tw); dlg = null; const d = $('w-dlg'); if (d) d.hidden = true; } busy = false; },
    _debug: () => ({ Z, PL, FL, dlg, busy }),
    _templates: TEMPLATES,
  };
})();
