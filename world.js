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
  const TRAINER_EMO = [['🧑‍🎤', 'm'], ['👧', 'f'], ['👦', 'm'], ['👩‍🦰', 'f'], ['🧢', 'm'], ['👱‍♀️', 'f']];
  const VILLAGERS = [['👵', 'f', 'Granny'], ['👴', 'm', 'Grandpa'], ['👩', 'f', 'Ms Li'], ['🧑‍🌾', 'm', 'Farmer Joe'], ['👩‍🍳', 'f', 'Chef Mei'], ['🧔', 'm', 'Mr Brown']];

  let E = null, MG = null;
  let Z = null, cv = null, ctx = null, T = 40, VW = 0, VH = 0, raf = 0, running = false;
  const PL = { x: 0, y: 0, fx: 0, fy: 0, dir: 'up', moving: false, t0: 0 };
  const FL = { x: 0, y: 0, fx: 0, fy: 0 };
  let held = null, dlg = null, busy = false, flash = 0;
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
    const k = (Z.z * 2 + +n.id) % TRAINER_NAMES.length, e = TRAINER_EMO[(Z.z + +n.id) % TRAINER_EMO.length];
    return { name: TRAINER_NAMES[k], emoji: e[0], g: e[1] };
  };
  const villager = n => VILLAGERS[(Z.z + +n.id) % VILLAGERS.length];
  function npcLook(n) {
    if (n.role === 'guard') return ['💂', 'm', 'Guard'];
    if (n.role === 'talk' && Z.z === 0) return ['👩‍🔬', 'f', 'Professor Echo'];
    if (n.role === 'quiz') return ['🧑‍🏫', 'm', 'Mr Wise'];
    if (n.role === 'trainer') { const t = trainerInfo(n); return [t.emoji, t.g, t.name]; }
    return villager(n);
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
    const sr = E.speakMode() === 'sr', esc = E.esc;
    let body = '<div class="d-who">' + (pg.emo || '') + ' ' + esc(pg.who || '') + '<button class="spk mini" data-act="wHear" aria-label="再听一遍">' + E.SPK + '</button></div>';
    if (pg.en) body += '<div class="d-en">' + esc(pg.en) + '</div>';
    if (pg.zh) body += '<div class="d-zh">' + esc(pg.zh) + '</div>';
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
    if (pg.onShow) pg.onShow();
    if (pg.en) E.say(pg.en, undefined, pg.g);
  }
  function nextPage() {
    const pg = page();
    if (!pg || pg.kind) return;
    dlg.i++;
    if (dlg.i >= dlg.pages.length) closeDlg(); else showPage();
  }
  function closeDlg() {
    const d = dlg;
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
    const w = E.W[Z.z], [emo, g, name] = npcLook(n), z = Z.z, dk = 'd:' + z + ':' + n.id;
    const P = (en, zh, extra) => Object.assign({ who: name, emo, g, en, zh }, extra || {});
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
    talk([{ who: t.name, emo: t.emoji, g: t.g, en: "Hi! I'm " + t.name + ". Let's have a monster battle!", zh: '你好！我是 ' + t.name + '，我们来一场怪兽对战吧！' }], () => {
      const two = n.id === '5';
      battle('trainer', {
        foes: MG.trainerFoes(z, +n.id, two ? 2 : 1, two ? lv : lv + 1),
        trainer: { name: t.name, emoji: t.emoji },
        after: res => {
          if (res === 'win') { WS().flags[trainerKey(n)] = 1; E.save(); talk([{ who: t.name, emo: t.emoji, g: t.g, en: 'Wow, you are really strong!', zh: '哇，你真的很厉害！' }]); }
        },
      });
    });
  }
  function enterDoor(L) {
    const w = E.W[Z.z];
    if (L === 'C') {
      const c = Z.buildings.C;
      talk([
        { who: 'Nurse Amy', emo: '👩‍⚕️', g: 'f', en: 'Welcome to the Monster Center!', zh: '欢迎来到怪兽中心！' },
        { who: 'Nurse Amy', emo: '👩‍⚕️', g: 'f', en: 'Let me heal your monsters.', zh: '我来帮你的怪兽恢复体力。', onShow: () => { MG.healAll(); WS().center = { z: Z.z, x: c.door.x, y: c.door.y + 1 }; E.SFX.win(); E.save(); } },
        { who: 'Nurse Amy', emo: '👩‍⚕️', g: 'f', en: 'Your monsters are fully healed. Good luck!', zh: '怪兽们都恢复精神了，加油！' },
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
    flash = performance.now();
    E.SFX.hit();
    await sleep(760);
    flash = 0;
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
      { who: 'Nurse Amy', emo: '👩‍⚕️', g: 'f', en: "Your monsters are healed now. Don't give up!", zh: '怪兽们已经恢复了，别灰心，再去试试吧！' },
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
  function resize() {
    const v = $('w-view'), dpr = window.devicePixelRatio || 1;
    VW = v.clientWidth; VH = v.clientHeight;
    T = Math.max(28, Math.floor(VW / 9));
    cv.width = VW * dpr; cv.height = VH * dpr;
    cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function startLoop() { if (running) return; running = true; raf = requestAnimationFrame(frame); }
  function stopLoop() { running = false; cancelAnimationFrame(raf); held = null; }
  function frame(now) {
    if (!running) return;
    if (PL.moving && now - PL.t0 >= STEP_MS) { PL.moving = false; PL.fx = PL.x; PL.fy = PL.y; FL.fx = FL.x; FL.fy = FL.y; onStep(); }
    if (!PL.moving && held && !dlg && !busy) tryMove(held);
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function draw(now) {
    const prog = PL.moving ? Math.min(1, (now - PL.t0) / STEP_MS) : 1;
    const px = (PL.fx + (PL.x - PL.fx) * prog) * T, py = (PL.fy + (PL.y - PL.fy) * prog) * T;
    const mw = Z.W * T, mh = Z.H * T;
    const camX = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, px + T / 2 - VW / 2));
    const camY = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, py + T / 2 - VH / 2));
    ctx.fillStyle = Z.pal.tree; ctx.fillRect(0, 0, VW, VH);
    const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(Z.W - 1, Math.ceil((camX + VW) / T));
    const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(Z.H - 1, Math.ceil((camY + VH) / T));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(tile(x, y), x, y, x * T - camX, y * T - camY, now);
    Object.entries(Z.buildings).forEach(([L, b]) => drawBuilding(L, b, camX, camY));
    // 实体按 y 排序
    const ents = [];
    Z.picks.forEach(p => { if (!WS().flags[pickKey(p)]) ents.push({ y: p.y, f: () => drawEmoji((p.x + p.y + Z.z) % 2 === 1 ? '🧪' : '🔮', p.x * T - camX, p.y * T - camY + Math.sin(now / 300 + p.x) * T * .05, .55) }); });
    Z.npcs.forEach(n => { if (npcVisible(n)) ents.push({ y: n.y, f: () => drawNpc(n, n.x * T - camX, n.y * T - camY, now) }); });
    const fx = (FL.fx + (FL.x - FL.fx) * prog) * T - camX, fy = (FL.fy + (FL.y - FL.fy) * prog) * T - camY;
    const fwy = FL.fy + (FL.y - FL.fy) * prog;
    if (!(FL.x === PL.x && FL.y === PL.y)) ents.push({ y: fwy, f: () => drawFollower(fx, fy, now, PL.moving) });
    ents.push({ y: PL.fy + (PL.y - PL.fy) * prog + .01, f: () => drawPlayer(px - camX, py - camY, PL.dir, PL.moving, now) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    // 站在草丛里时，草盖住下半身
    [[PL.x, PL.y, px - camX, py - camY], [FL.x, FL.y, fx, fy]].forEach(([tx, ty, sx, sy]) => { if (!PL.moving && tile(tx, ty) === ',') drawBlades(sx, sy, now, true); });
    // 面前可以互动时，显示 A 提示
    if (!dlg && !PL.moving && !busy) {
      const [dx, dy] = DIRS[PL.dir], tx = PL.x + dx, ty = PL.y + dy;
      if (npcAt(tx, ty) || signAt(tx, ty) >= 0 || doorAt(tx, ty)) {
        const bx = tx * T - camX + T / 2, by = ty * T - camY - T * .15 + Math.sin(now / 200) * 3;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, T * .22, 0, 7); ctx.fill();
        ctx.strokeStyle = '#12304a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#e53935'; ctx.font = 'bold ' + Math.round(T * .28) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', bx, by + 1);
      }
    }
    if (flash) { const k = Math.floor((now - flash) / 110) % 2; if (k) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(0, 0, VW, VH); } }
  }
  function drawTile(c, x, y, sx, sy, now) {
    const p = Z.pal;
    const grass = () => {
      ctx.fillStyle = p.grass; ctx.fillRect(sx, sy, T + 1, T + 1);
      if ((x * 7 + y * 13) % 5 === 0) { ctx.fillStyle = p.speck; ctx.fillRect(sx + T * .3, sy + T * .55, T * .08, T * .14); ctx.fillRect(sx + T * .42, sy + T * .5, T * .08, T * .18); }
    };
    if (c === '#' || c === 'T') {
      grass();
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T * .86, T * .38, T * .12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7b4a26'; ctx.fillRect(sx + T * .43, sy + T * .55, T * .14, T * .32);
      ctx.fillStyle = p.tree; ctx.beginPath(); ctx.arc(sx + T / 2, sy + T * .4, T * .4, 0, 7); ctx.fill();
      ctx.fillStyle = p.treeHi; ctx.beginPath(); ctx.arc(sx + T * .38, sy + T * .3, T * .16, 0, 7); ctx.fill();
    } else if (c === ',') {
      ctx.fillStyle = p.tall; ctx.fillRect(sx, sy, T + 1, T + 1);
      drawBlades(sx, sy, now, false);
    } else if (c === '~') {
      ctx.fillStyle = '#4fc3f7'; ctx.fillRect(sx, sy, T + 1, T + 1);
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      const o = ((now / 900 + x * .37 + y * .21) % 1) * T;
      ctx.beginPath(); ctx.moveTo(sx + (o * .5) % T, sy + T * .35); ctx.quadraticCurveTo(sx + (o * .5) % T + T * .12, sy + T * .25, sx + (o * .5) % T + T * .24, sy + T * .35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + (o + T * .4) % T, sy + T * .72); ctx.quadraticCurveTo(sx + (o + T * .4) % T + T * .1, sy + T * .64, sx + (o + T * .4) % T + T * .2, sy + T * .72); ctx.stroke();
    } else if (c === '=' || c === '^' || c === 'v') {
      ctx.fillStyle = p.path; ctx.fillRect(sx, sy, T + 1, T + 1);
      if ((x * 5 + y * 3) % 4 === 0) { ctx.fillStyle = p.pebble; ctx.beginPath(); ctx.arc(sx + T * .3, sy + T * .7, T * .05, 0, 7); ctx.arc(sx + T * .7, sy + T * .3, T * .04, 0, 7); ctx.fill(); }
      if (c !== '=') {
        ctx.fillStyle = 'rgba(18,48,74,.35)'; ctx.beginPath();
        const up = c === '^', cy = sy + T / 2 + Math.sin(now / 250) * 3;
        ctx.moveTo(sx + T * .3, cy + (up ? T * .12 : -T * .12)); ctx.lineTo(sx + T * .7, cy + (up ? T * .12 : -T * .12)); ctx.lineTo(sx + T / 2, cy + (up ? -T * .14 : T * .14)); ctx.fill();
      }
    } else if (c === 'F') {
      grass();
      [['#ff6b9d', .28, .35], ['#ffd54f', .66, .3], ['#ffffff', .48, .7]].forEach(([col, fx, fy]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx + T * fx, sy + T * fy, T * .09, 0, 7); ctx.fill(); ctx.fillStyle = '#f9a825'; ctx.beginPath(); ctx.arc(sx + T * fx, sy + T * fy, T * .035, 0, 7); ctx.fill(); });
    } else if (c === 'B') {
      grass();
      ctx.fillStyle = '#7b4a26'; ctx.fillRect(sx + T * .45, sy + T * .45, T * .1, T * .45);
      ctx.fillStyle = '#c69c6d'; ctx.fillRect(sx + T * .18, sy + T * .18, T * .64, T * .36);
      ctx.strokeStyle = '#7b4a26'; ctx.lineWidth = 2; ctx.strokeRect(sx + T * .18, sy + T * .18, T * .64, T * .36);
      ctx.fillStyle = '#7b4a26'; ctx.fillRect(sx + T * .26, sy + T * .28, T * .48, T * .04); ctx.fillRect(sx + T * .26, sy + T * .38, T * .36, T * .04);
    } else grass();
  }
  function drawBlades(sx, sy, now, front) {
    const p = Z.pal, sway = Math.sin(now / 450 + sx * .05) * T * .03;
    ctx.strokeStyle = front ? p.tall : p.blade; ctx.lineWidth = Math.max(2, T * .06); ctx.lineCap = 'round';
    const base = front ? sy + T * .98 : sy + T * .9;
    [[.2, .55], [.5, .5], [.8, .55], [.35, .78], [.65, .8]].forEach(([fx, fy], i) => {
      if (front && i > 2) return;
      const bx = sx + T * fx, by = front ? base : sy + T * fy + T * .12;
      ctx.beginPath(); ctx.moveTo(bx - T * .08, by); ctx.lineTo(bx - T * .05 + sway, by - T * .22); ctx.moveTo(bx, by); ctx.lineTo(bx + sway, by - T * .28); ctx.moveTo(bx + T * .08, by); ctx.lineTo(bx + T * .06 + sway, by - T * .2); ctx.stroke();
    });
  }
  function drawBuilding(L, b, camX, camY) {
    const x = b.x0 * T - camX, y = b.y0 * T - camY, w = (b.x1 - b.x0 + 1) * T, h = (b.y1 - b.y0 + 1) * T;
    if (x > VW || y > VH || x + w < 0 || y + h < 0) return;
    const roof = L === 'C' ? '#e53935' : L === 'M' ? '#1e88e5' : E.W[Z.z].color;
    const wall = L === 'C' ? '#fff8ee' : L === 'M' ? '#e8f4ff' : '#fdf3e1';
    const rh = h * .48;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + T * .12, y + h - T * .05, w - T * .1, T * .16);
    ctx.fillStyle = wall; ctx.fillRect(x + T * .1, y + rh * .7, w - T * .2, h - rh * .7);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x, y + rh); ctx.lineTo(x + T * .3, y); ctx.lineTo(x + w - T * .3, y); ctx.lineTo(x + w, y + rh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 1; k < 4; k++) ctx.fillRect(x + T * .2, y + rh * k / 4 - 1, w - T * .4, 2);
    // 招牌
    const label = L === 'C' ? 'CENTER' : L === 'M' ? 'SHOP' : 'GYM';
    ctx.fillStyle = '#ffffff'; ctx.font = '800 ' + Math.round(T * .34) + 'px "Baloo 2", Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2 + (L === 'C' ? T * .22 : 0), y + rh * .52);
    if (L === 'C') { const cx = x + w / 2 - ctx.measureText(label).width / 2 - T * .05, cy = y + rh * .52; ctx.fillStyle = '#fff'; ctx.fillRect(cx - T * .12, cy - T * .04, T * .24, T * .08); ctx.fillRect(cx - T * .04, cy - T * .12, T * .08, T * .24); }
    if (L === 'G') { ctx.fillText(E.W[Z.z].boss.emoji, x + T * .55, y + rh + (h - rh) * .45); }
    // 窗户
    ctx.fillStyle = '#9fd8f5';
    const wy = y + rh + (h - rh) * .22, ww = T * .42, wh = T * .34;
    ctx.fillRect(x + w * .12, wy, ww, wh); ctx.fillRect(x + w * .88 - ww, wy, ww, wh);
    // 门
    const dx = b.door.x * T - camX, dy = b.door.y * T - camY;
    ctx.fillStyle = '#5d4037'; ctx.fillRect(dx + T * .2, dy + T * .25, T * .6, T * .75);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(dx + T * .26, dy + T * .31, T * .48, T * .69);
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(dx + T * .66, dy + T * .66, T * .045, 0, 7); ctx.fill();
  }
  function drawEmoji(e, sx, sy, scale) {
    ctx.font = Math.round(T * scale) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; // 彩色表情会继承填充色的透明度，先重置成不透明
    ctx.fillText(e, sx + T / 2, sy + T / 2);
  }
  function shadow(sx, sy, r) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T * .88, T * r, T * .1, 0, 0, 7); ctx.fill(); }
  function drawNpc(n, sx, sy, now) {
    shadow(sx, sy, .28);
    const [emo] = npcLook(n);
    drawEmoji(emo, sx, sy - T * .1 + Math.sin(now / 500 + n.x) * T * .02, .82);
    if (n.role === 'trainer' && !WS().flags[trainerKey(n)]) {
      // 视线方向的小箭头
      const [dx, dy] = DIRS[n.face];
      ctx.fillStyle = 'rgba(229,57,53,.55)'; ctx.beginPath(); ctx.arc(sx + T / 2 + dx * T * .42, sy + T / 2 + dy * T * .42, T * .06, 0, 7); ctx.fill();
    }
    if (n.alert && now - n.alert < 1100) {
      const bx = sx + T / 2, by = sy - T * .35;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12304a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - T * .18, by - T * .22, T * .36, T * .4, 6) : ctx.rect(bx - T * .18, by - T * .22, T * .36, T * .4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.font = '900 ' + Math.round(T * .34) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', bx, by - T * .02);
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
    shadow(sx, sy, .26);
    ctx.drawImage(im, sx - T * .05, sy - T * .2 - hop, T * 1.1, T * 1.1);
  }
  function drawPlayer(sx, sy, dir, moving, now) {
    const s = T, cx = sx + s / 2;
    const bob = moving ? Math.abs(Math.sin(now / 70)) * s * .05 : 0;
    const step = moving ? Math.sin(now / 55) : 0;
    shadow(sx, sy, .24);
    // 腿
    ctx.fillStyle = '#2e3a59';
    ctx.fillRect(cx - s * .13, sy + s * .68 - bob + (step > 0 ? -s * .03 : 0), s * .1, s * .2);
    ctx.fillRect(cx + s * .03, sy + s * .68 - bob + (step < 0 ? -s * .03 : 0), s * .1, s * .2);
    // 身体
    ctx.fillStyle = '#3a86ff';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - s * .2, sy + s * .42 - bob, s * .4, s * .32, s * .1) : ctx.rect(cx - s * .2, sy + s * .42 - bob, s * .4, s * .32); ctx.fill();
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(cx - s * .2, sy + s * .56 - bob, s * .4, s * .05);
    // 头
    const hy = sy + s * .3 - bob;
    ctx.fillStyle = '#ffdcc2'; ctx.beginPath(); ctx.arc(cx, hy, s * .2, 0, 7); ctx.fill();
    // 帽子
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(cx, hy - s * .02, s * .205, Math.PI, 0); ctx.fill();
    if (dir === 'up') { ctx.beginPath(); ctx.arc(cx, hy, s * .2, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#3b2a20'; ctx.fillRect(cx - s * .16, hy - s * .01, s * .32, s * .08); }
    else {
      const bx = dir === 'left' ? cx - s * .22 : dir === 'right' ? cx + s * .22 : cx;
      ctx.beginPath(); ctx.ellipse(bx, hy - s * .04, dir === 'down' ? s * .19 : s * .12, s * .05, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, hy - s * .12, s * .045, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d2a36';
      if (dir === 'down') { ctx.fillRect(cx - s * .09, hy + s * .02, s * .04, s * .06); ctx.fillRect(cx + s * .05, hy + s * .02, s * .04, s * .06); }
      else ctx.fillRect(cx + (dir === 'left' ? -s * .13 : s * .09), hy + s * .02, s * .04, s * .06);
    }
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
    stop: () => { stopLoop(); if (dlg) { dlg = null; const d = $('w-dlg'); if (d) d.hidden = true; } busy = false; },
    _debug: () => ({ Z, PL, FL, dlg, busy }),
    _templates: TEMPLATES,
  };
})();
