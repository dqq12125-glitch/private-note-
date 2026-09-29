// 回声岛 · 怪兽对战：用英语念咒语攻击，听懂对手的咒语来防御，收服、升级、进化
(function () {
  'use strict';

  // ---------- 怪兽图鉴（数据在 dex.js：386 只、17 种属性、招式、进化石） ----------
  const D = window.DEX;
  const TYPES = D.TYPES;
  const SPECIES = D.byId;
  const ORDER = D.list.map(s => s.id);
  const STARTERS = ['emberpup', 'bubbly', 'sprouty'];
  const MOVES = D.MOVES;
  const POWER = [1.0, 1.6, 2.6];
  const TASK = ['🗣 说单词', '📜 念句子', '💬 对话大招'];
  const DOTS = ['●○○', '●●○', '●●●'];
  const STRONG = {}; D.ORDER.forEach(t => { STRONG[t] = (D.CHART[t].strong || []).slice(); });
  // 属性克制：招式属性打对手（对手可能是双属性）
  const eff = (atkType, defId) => D.eff(atkType, SPECIES[defId].types);
  const effLabel = e => e > 1 ? '效果拔群！' : e <= .3 ? '几乎没效果' : e < 1 ? '效果一般' : '';
  // ---------- 招式 ----------
  // 招式编号：攻击招式 "fire:1"（属性:小招0/中招1/大招2），辅助招式 "s:sleep"
  const SUP = {
    roar: { en: 'Big Roar', zh: '大吼', type: 'normal', fx: { foe: { atk: -1 } }, desc: '对手攻击↓' },
    guard: { en: 'Iron Guard', zh: '铁壁', type: 'steel', fx: { self: { def: 2 } }, desc: '自己防御↑↑' },
    power: { en: 'Power Up', zh: '蓄力', type: 'fight', fx: { self: { atk: 2 } }, desc: '自己攻击↑↑' },
    speed: { en: 'Speed Up', zh: '加速', type: 'flying', fx: { self: { spd: 2 } }, desc: '自己速度↑↑' },
    chill: { en: 'Cold Wind', zh: '寒风', type: 'ice', fx: { foe: { spd: -2 } }, desc: '对手速度↓↓' },
    spooky: { en: 'Spooky Face', zh: '鬼脸', type: 'ghost', fx: { foe: { def: -2 } }, desc: '对手防御↓↓' },
    sleep: { en: 'Sleepy Song', zh: '催眠曲', type: 'grass', status: 'slp', desc: '让对手睡着' },
    poison: { en: 'Poison Mist', zh: '毒雾', type: 'poison', status: 'psn', desc: '让对手中毒' },
    para: { en: 'Static Zap', zh: '麻痹电', type: 'spark', status: 'par', desc: '让对手麻痹' },
    burn: { en: 'Hot Breath', zh: '灼热吐息', type: 'fire', status: 'brn', desc: '让对手烧伤' },
    confuse: { en: 'Dizzy Dance', zh: '眩晕舞', type: 'psychic', status: 'conf', desc: '让对手混乱' },
    heal: { en: 'Sweet Rest', zh: '甜蜜休息', type: 'water', heal: .45, desc: '回复一半体力' },
  };
  const SUP_OF = { normal: 'roar', fire: 'burn', water: 'heal', grass: 'sleep', spark: 'para', ice: 'chill', fight: 'power', poison: 'poison', ground: 'guard', flying: 'speed', psychic: 'confuse', bug: 'poison', rock: 'guard', ghost: 'spooky', dragon: 'power', dark: 'spooky', steel: 'guard' };
  const STATUS = {
    brn: { zh: '烧伤', color: '#f0642f', got: '被烧伤了！每回合都会掉血🔥' },
    psn: { zh: '中毒', color: '#9b4dca', got: '中毒了！每回合都会掉血☠️' },
    par: { zh: '麻痹', color: '#d9a000', got: '麻痹了！有时候会动不了⚡' },
    slp: { zh: '睡眠', color: '#5c6bc0', got: '睡着了💤' },
    frz: { zh: '冰冻', color: '#4fc3e8', got: '被冻住了🧊' },
    conf: { zh: '混乱', color: '#ec407a', got: '混乱了！有时候会撞到自己😵' },
  };
  function parseMove(id) {
    if (id.startsWith('s:')) { const sup = SUP[id.slice(2)]; return { id, sup, type: sup.type, tier: 1 }; }
    const [type, t] = id.split(':');
    return { id, type, tier: +t };
  }
  const mvName = mv => mv.sup ? [mv.sup.en, mv.sup.zh] : MOVES[mv.type][mv.tier];
  // 学招表：Lv1 本属性小招 + 普通小招，Lv9 辅助招式，Lv15 本属性中招，Lv21 第二属性（或普通）中招，Lv28 本属性大招……
  const learnCache = {};
  function learnset(s) {
    if (learnCache[s.id]) return learnCache[s.id];
    const t1 = s.types[0], t2 = s.types[1], alt = t1 === 'normal' ? 'fight' : 'normal';
    const L = [[1, t1 + ':0'], [1, alt + ':0'], [9, 's:' + SUP_OF[t1]], [15, t1 + ':1'], [21, (t2 || alt) + ':1'], [28, t1 + ':2']];
    if (t2 && SUP_OF[t2] !== SUP_OF[t1]) L.push([34, 's:' + SUP_OF[t2]]);
    L.push([40, t2 ? t2 + ':2' : 's:' + (SUP_OF[t1] === 'heal' ? 'guard' : 'heal')]);
    return (learnCache[s.id] = L);
  }
  // 按等级应该会的招式：学过的里面最新的 4 个
  function defaultMoves(sp, lv) { const got = learnset(SPECIES[sp]).filter(([l]) => l <= lv).map(([, id]) => id); return got.filter((id, i) => got.indexOf(id) === i).slice(-4); }
  function ensureMoves(mon) { if (mon && (!mon.moves || !mon.moves.length)) mon.moves = defaultMoves(mon.sp, mon.lv); return mon; }
  const movesOf = mon => ensureMoves(mon).moves.map(parseMove);
  // 进化：等级到了（lv）或者用了进化石（item）
  const lvEvo = mon => (SPECIES[mon.sp].evo || []).find(e => e.lv && mon.lv >= e.lv);
  const itemEvo = (mon, item) => (SPECIES[mon.sp].evo || []).find(e => e.item === item);
  const CATCH_LINES = ['Come with me!', "Let's be friends!", 'Welcome to my team!', 'You are my new friend!'];
  const TEAM_MAX = 6;
  // 背包道具。回声球和药水沿用老存档里的 balls / potions，其余放在 bag 里
  const ITEMS = {
    ball: { zh: '回声球', en: 'Echo Ball', icon: '🔮', price: 10, desc: '收服野生怪兽' },
    superball: { zh: '超级球', en: 'Super Ball', icon: '💠', price: 25, desc: '更容易收服' },
    potion: { zh: '药水', en: 'Potion', icon: '🧪', price: 20, desc: '回复 40% 体力', heal: 0.4 },
    superpotion: { zh: '好伤药', en: 'Super Potion', icon: '💊', price: 40, desc: '回复 80% 体力', heal: 0.8 },
    revive: { zh: '复活草', en: 'Revive', icon: '🌿', price: 60, desc: '让累倒的怪兽恢复一半体力' },
    repel: { zh: '驱怪喷雾', en: 'Repel', icon: '🧴', price: 30, desc: '100 步内不遇野生怪兽' },
    rope: { zh: '逃生绳', en: 'Escape Rope', icon: '🪢', price: 25, desc: '从洞穴里一下回到洞口' },
  };
  Object.assign(ITEMS, {
    antidote: { zh: '解毒药', en: 'Antidote', icon: '🟣', price: 15, desc: '治好中毒' },
    burnheal: { zh: '烫伤药', en: 'Burn Heal', icon: '🧯', price: 20, desc: '治好烧伤' },
    paraheal: { zh: '解麻药', en: 'Paralyze Heal', icon: '🟡', price: 20, desc: '治好麻痹' },
    awakening: { zh: '清醒铃', en: 'Awakening', icon: '🔔', price: 20, desc: '叫醒睡着的怪兽' },
    iceheal: { zh: '解冻药', en: 'Ice Heal', icon: '🔥', price: 20, desc: '治好冰冻' },
    fullheal: { zh: '万灵药', en: 'Full Heal', icon: '✨', price: 50, desc: '治好所有异常状态' },
    expshare: { zh: '学习装置', en: 'Exp. Share', icon: '📡', price: 0, desc: '带着它，没出场的怪兽也能分到一半经验', key: true },
    rod: { zh: '钓竿', en: 'Fishing Rod', icon: '🎣', price: 150, desc: '对着水按 A 钓鱼', key: true },
    bike: { zh: '自行车', en: 'Bike', icon: '🚲', price: 300, desc: '骑车走得快一倍（右上角 🚲 按钮）', key: true },
    dowsing: { zh: '寻宝器', en: 'Dowsing Machine', icon: '📟', price: 200, desc: '藏起来的道具会一闪一闪', key: true },
  });
  Object.entries(D.STONES).forEach(([id, st]) => { ITEMS[id] = { zh: st.zh, en: st.en, icon: st.icon, price: 120, desc: '能让某些怪兽进化', stone: true }; });
  // 秘传学习器：剧情里的人送的重要物品，有了它再拿够徽章，就能在野外用对应的技能
  [['cut', '居合斩', 'Cut', '🌿'], ['flash', '闪光', 'Flash', '💡'], ['smash', '碎岩', 'Rock Smash', '🪨'], ['strength', '怪力', 'Strength', '💪'],
    ['surf', '冲浪', 'Surf', '🌊'], ['fly', '飞空', 'Fly', '🕊️'], ['dive', '潜水', 'Dive', '🤿'], ['falls', '攀瀑', 'Waterfall', '🏞️']].forEach(([k, zh, en, icon]) => {
    ITEMS['hm_' + k] = { zh: '秘传学习器 · ' + zh, en: 'HM ' + en, icon: '💿', price: 0, desc: '野外技能「' + zh + '」' + icon + '（菜单 → 野外技能）', key: true, hm: true };
  });
  ITEMS.ticket = { zh: '船票', en: 'Ferry Ticket', icon: '🎫', price: 0, desc: '坐渡轮去别的岛', key: true };
  const BAG_ORDER = ['expshare', 'hm_cut', 'hm_flash', 'hm_smash', 'hm_strength', 'hm_surf', 'hm_fly', 'hm_dive', 'hm_falls', 'ticket', 'bike', 'rod', 'dowsing','ball', 'superball', 'potion', 'superpotion', 'revive', 'antidote', 'burnheal', 'paraheal', 'awakening', 'iceheal', 'fullheal', 'repel', 'rope'].concat(Object.keys(D.STONES));
  function itemCount(id) { const m = M(); return id === 'ball' ? m.balls : id === 'potion' ? (m.potions || 0) : ((m.bag || {})[id] || 0); }
  function addItem(id, n) {
    const m = M();
    if (id === 'ball') m.balls += n;
    else if (id === 'potion') m.potions = (m.potions || 0) + n;
    else { m.bag = m.bag || {}; m.bag[id] = Math.max(0, (m.bag[id] || 0) + n); }
  }
  let FH = null; // 大地图提供的道具效果（驱怪喷雾、逃生绳）

  // 能力值：图鉴给了体力和攻击；防御和速度按身体类型和属性推出来（同一种怪兽永远一样）
  const BODY_DEF = { golem: 1.35, shell: 1.4, quad: 1.05, dragon: 1.1, serpent: 1, blob: .95, biped: .95, bird: .8, fish: .9, bug: .85, ghost: .9, plant: 1 };
  const BODY_SPD = { bird: 1.35, fish: 1.15, bug: 1.2, serpent: 1.05, quad: 1.15, biped: 1.05, blob: .9, ghost: 1.1, dragon: 1.05, plant: .75, golem: .6, shell: .55 };
  const TYPE_DEF = { steel: .25, rock: .2, ground: .1, bug: -.05, psychic: -.1, flying: -.05 };
  const TYPE_SPD = { spark: .2, flying: .2, psychic: .1, dark: .1, fight: .05, steel: -.15, rock: -.15, ground: -.05 };
  function baseStats(s) {
    if (s._b) return s._b;
    const h = ((s.no * 2654435761) >>> 0) % 1000 / 1000;
    const td = s.types.reduce((a, t) => a + (TYPE_DEF[t] || 0), 0), ts = s.types.reduce((a, t) => a + (TYPE_SPD[t] || 0), 0);
    return (s._b = { hp: s.hp, atk: s.atk, def: Math.round(s.atk * (BODY_DEF[s.b] || 1) * (1 + td) * (.9 + h * .2)), spd: Math.round(s.atk * (BODY_SPD[s.b] || 1) * (1 + ts) * (1.1 - h * .2)) });
  }
  const stats = m => { const b = baseStats(SPECIES[m.sp]); return { hp: b.hp + m.lv * 6, atk: b.atk + m.lv * 2, def: b.def + m.lv * 2, spd: b.spd + m.lv * 2 }; };
  const xpNeed = lv => lv * 20;
  const zoneLv = z => 2 + z * 2;
  const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newMon = (sp, lv) => ({ uid: uid(), sp, lv, xp: 0, moves: defaultMoves(sp, lv) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let E = null;   // game.js 提供的工具
  let B = null;   // 当前战斗
  const live = b => B === b && !b.over;
  const M = () => E.S.mon;
  // 怪兽图：3D 模型截图（cartoon.js 的 monster() 会自动用 Mon3D）
  const svg = sp => window.Cartoon ? Cartoon.monster(SPECIES[sp]) : '';
  // 属性小图标（SVG，不依赖手机的 emoji 字体）
  const TICON = {}; D.ORDER.forEach(t => { TICON[t] = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + TYPES[t].icon + '" fill="currentColor"/></svg>'; });
  const tchip = t => '<span class="tchip" style="--tc:' + TYPES[t].color + '">' + TICON[t] + TYPES[t].zh + '系</span>';
  const chips = id => SPECIES[id].types.map(tchip).join('');

  // ---------- 养成：英文昵称、亲密度、异色、蛋 ----------
  const SHINY_RATE = 1 / 64;          // 野外遇到异色的机会（给孩子玩，比原作高很多）
  const nm = mon => (mon && mon.nick) || SPECIES[mon.sp].en;
  const frOf = mon => mon.fr == null ? 70 : mon.fr;
  const hearts = mon => Math.min(5, Math.floor(frOf(mon) / 51));
  const heartsHTML = mon => '<span class="frh" title="亲密度">' + [0, 1, 2, 3, 4].map(k => k < hearts(mon) ? '♥' : '♡').join('') + '</span>';
  function befriend(mon, n) { if (mon && !mon.egg) mon.fr = Math.max(0, Math.min(255, frOf(mon) + n)); }
  // 颜色转一个角度（异色用）；灰白的颜色不动
  function hueShift(hex, deg) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const n = parseInt(hex.slice(1, 7), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < .08) return hex;
    const sat = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h / 6 + deg / 360) % 1;
    const q = l < .5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
    const f = t => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < .5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    return '#' + [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  const SHINY_SP = {};
  // 画这只怪兽用的图鉴数据：异色的换一套颜色
  function spOf(mon) {
    const sp = SPECIES[mon.sp];
    if (!mon.shiny) return sp;
    return SHINY_SP[sp.id] || (SHINY_SP[sp.id] = Object.assign({}, sp, { id: sp.id + '_shiny', c: hueShift(sp.c, 150), a: hueShift(sp.a, 150), shiny: true }));
  }
  const EGG_SVG = '<svg class="mon-svg" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="58" rx="16" ry="4" fill="rgba(0,0,0,.18)"/><path d="M32 6C20 6 12 26 12 38a20 20 0 0 0 40 0C52 26 44 6 32 6z" fill="#fffbef" stroke="#2b2b3a" stroke-width="3"/><circle cx="24" cy="30" r="4" fill="#9ccc65"/><circle cx="38" cy="22" r="3" fill="#ffb74d"/><circle cx="40" cy="42" r="5" fill="#64b5f6"/><circle cx="26" cy="46" r="3" fill="#f48fb1"/></svg>';
  const svgMon = mon => mon.egg ? EGG_SVG : window.Cartoon ? Cartoon.monster(spOf(mon)) : '';
  // 从哪一只进化来的：一直往回找到第一阶段
  const baseOf = id => { let x = SPECIES[id]; while (x.from && SPECIES[x.from]) x = SPECIES[x.from]; return x.id; };
  let B3 = null;   // 3D 战斗画面（battle3d.js）
  // 会动的 3D 模型（assets/mon3d）：出场前先下载，最多等 2.5 秒，没下完就先用程序拼的模型
  const prep = sps => window.Mon3D && Mon3D.preload ? Promise.race([Mon3D.preload(sps).catch(() => {}), sleep(2500)]) : Promise.resolve();
  const teamSps = () => M().team.map(byUid).filter(m => m && !m.egg).map(spOf);
  function preloadTeam() { if (window.Mon3D && Mon3D.preload) Mon3D.preload(teamSps()); }
  // 3D 战斗里换上刚下载好的模型（出场前调用，这时候怪兽还藏着）
  function upgrade3D() {
    if (!B3 || !B || !window.Mon3D || !Mon3D.isLoaded) return;
    B.rig3 = B.rig3 || {};
    [['me', me()], ['foe', foe()]].forEach(([side, mon]) => {
      const sp = spOf(mon);
      if (!B.rig3[side] && Mon3D.hasModel(sp) && Mon3D.isLoaded(sp)) { B3.setMon(side, sp, true); B.rig3[side] = true; }
    });
  }
  // 战斗背景：天空、云、远山、草地（雪地小镇换成白色）
  function arenaBG(z) {
    const w = E.W[z], snow = z === 11;
    let stripes = '';
    for (let i = 0; i < 6; i++) stripes += '<path d="M0 ' + (188 + i * 20) + ' H400" stroke="' + (snow ? '#e3ecf2' : '#a9da8b') + '" stroke-width="3"/>';
    return '<svg class="arena-bg" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (snow ? '#c3d8e8' : '#9ed8ff') + '"/><stop offset="1" stop-color="#f3fbff"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#bsky)"/>' +
      '<g fill="#fff" opacity=".92"><ellipse cx="70" cy="42" rx="34" ry="11"/><ellipse cx="94" cy="35" rx="21" ry="12"/><ellipse cx="305" cy="62" rx="30" ry="9"/><ellipse cx="326" cy="56" rx="17" ry="10"/></g>' +
      '<path d="M0 150 Q60 108 130 136 T260 124 T400 132 V300 H0Z" fill="' + w.color + '" opacity=".32"/>' +
      '<path d="M0 172 Q90 138 190 162 T400 152 V300 H0Z" fill="' + (snow ? '#e9f1f6' : '#97d276') + '"/>' +
      '<rect y="176" width="400" height="124" fill="' + (snow ? '#f5f9fb' : '#b5e399') + '"/>' + stripes + '</svg>';
  }
  // 命中特效：火花 / 泡泡 / 叶子 / 闪电
  function burst(id, type, big) {
    if (E.reduced) return;
    const arena = $('b-arena'); if (!arena || !$(id)) return;
    const [x, y] = center(id), n = big ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'fx fx-' + type;
      const a = Math.random() * Math.PI * 2, d = 28 + Math.random() * (big ? 70 : 50);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d - (type === 'fire' ? 26 : type === 'water' ? 14 : 0)).toFixed(1) + 'px');
      p.style.setProperty('--r', Math.round(Math.random() * 540) + 'deg');
      p.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
      arena.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
    if (type === 'spark' || big) { const f = document.createElement('i'); f.className = 'fx-flash'; arena.appendChild(f); setTimeout(() => f.remove(), 420); }
  }
  const byUid = u => M().box.find(m => m.uid === u);
  const lead = () => M().team.map(byUid).find(m => m && !m.egg) || M().box.find(m => !m.egg);
  const caughtN = () => ORDER.filter(id => M().dex[id] === 'caught').length;
  const zoneOpen = z => z === 0 || !!M().badges[z - 1] || E.S.settings.unlockAll;

  // ---------- 基地（首页“怪兽冒险”标签） ----------
  function homeHTML() {
    const m = M(), esc = E.esc;
    if (!m.box.length) {
      return '<section class="mon-card starter-pick new-game"><div class="ng-mons">' + STARTERS.map(id => '<span class="st-svg">' + svg(id) + '</span>').join('') + '</div>' +
        '<h2>新的冒险</h2><p>你刚搬到回声群岛最南边的你好岛。这里的怪兽听得懂英语——话说得越清楚，怪兽就越强。<br>回声博士好像遇到麻烦了……</p>' +
        '<button class="btn sun wide world-go" data-act="wEnter">🌅 开始冒险</button></section>';
    }
    const L = lead(), s = SPECIES[L.sp], st = stats(L);
    let h = '<section class="mon-card lead" style="--tc:' + TYPES[s.type].color + '"><div class="lead-mon">' + svgMon(L) + '</div><div class="lead-info">' +
      '<div class="lead-name"><b>' + (L.shiny ? '✨' : '') + E.esc(nm(L)) + '</b><span>' + (L.nick ? s.en + ' · ' : '') + s.zh + '</span> ' + heartsHTML(L) + '</div>' +
      '<div class="chips">' + chips(L.sp) + '<span class="lvchip">Lv ' + L.lv + '</span></div>' +
      '<div class="xpbar"><i style="width:' + (L.xp / xpNeed(L.lv) * 100) + '%"></i></div>' +
      '<small>HP ' + st.hp + ' · 攻击 ' + st.atk + ((s.evo || []).find(e => e.lv) ? ' · Lv ' + s.evo.find(e => e.lv).lv + ' 会进化' : '') + '</small></div>' +
      '<div class="lead-btns"><button class="btn small ghost" data-act="mTeam">🐾 我的怪兽 ' + m.box.length + '</button><button class="btn small ghost" data-act="mDex">📖 图鉴 ' + caughtN() + '/' + ORDER.length + '</button><button class="btn small sun" data-act="mBalls">🔮 回声球 ' + m.balls + '</button></div></section>';
    const ws = E.S.world || {}, place = window.EchoWorld && EchoWorld.placeLabel ? EchoWorld.placeLabel() : null;
    h += '<button class="btn sun wide world-go" data-act="wEnter">🗺️ ' + (ws.started ? '继续冒险' + (place ? ' · ' + place.name : '') : '出发去冒险！') + '</button>';
    h += '<p class="tip">走进草丛会遇到野生怪兽，路上的训练师看到你就会来挑战。<br>打败每个小镇的道馆馆主拿到徽章，守卫才会让你去下一个小镇。</p>';
    const visited = Object.keys(ws.visited || {}).map(Number).sort((a, b) => a - b);
    if (visited.length > 1) {
      h += '<section class="mon-card fly"><h3>✈️ 飞回去过的小镇</h3><div class="fly-list">' + visited.map(z =>
        '<button class="btn small ghost" data-act="wFly" data-z="' + z + '">' + E.W[z].icon + ' ' + E.W[z].name + (m.badges[z] ? ' 🏅' : '') + '</button>').join('') + '</div></section>';
    }
    h += '<p class="tip">🏅 徽章 ' + Object.keys(m.badges).length + ' / ' + E.W.length + ' · <button class="link" data-act="mBag">🎒 背包</button> · 在「📚 闯关练习」每通关一关送 1 个回声球，三星送 2 个。</p>';
    return h;
  }

  // ---------- 选初始怪兽：大声说 I choose you! ----------
  function starterSheet(id) {
    const s = SPECIES[id], sr = E.speakMode() === 'sr';
    E.openModal('<div class="evo-stage">' + svg(id) + '</div><h2>' + s.en + '（' + s.zh + '）</h2>' +
      '<p>想让它当你的伙伴，就对它大声说：</p><div class="say-text" id="st-say">' + E.wordsHTML(s.en + ', I choose you!') + '</div>' +
      (sr ? '<button class="mic" id="st-mic" data-act="mStarterMic" data-sp="' + id + '">' + E.MIC + '</button><div class="mic-hint" id="st-hint">点麦克风，大声说</div>'
        : '<button class="btn leaf wide" data-act="mStarterGo" data-sp="' + id + '">🎤 我说了！</button>') +
      '<div class="row"><button class="btn ghost" data-act="close">再看看别的</button><button class="btn ghost" data-act="mSayName" data-sp="' + id + '">🔊 听一遍</button></div>');
    E.say(s.en + ', I choose you!');
  }
  async function starterMic(id) {
    const m = $('st-mic'); if (!m) return;
    if (E.RT.listening) { E.stopListening(); return; }
    m.classList.add('on'); m.innerHTML = E.STOP; $('st-hint').textContent = '正在听……';
    const res = await E.recognize();
    if (!$('st-mic')) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) { E.RT.srBroken = true; takeStarter(id); return; }
    if (!res.alts.length) { $('st-hint').textContent = '没听清，再大声一点'; return; }
    const r = E.bestScore('I choose you', res.alts);
    if (r.score >= 40) takeStarter(id);
    else $('st-hint').textContent = '再试一次：I choose you!';
  }
  function takeStarter(id) {
    const m = M();
    if (m.box.length) return;
    const mon = newMon(id, 5);
    m.box.push(mon); m.team = [mon.uid]; m.dex[id] = 'caught';
    E.save(); E.closeModal(); E.confetti(160); E.SFX.win();
    E.say(SPECIES[id].en + ' joined your team!');
    E.toast('🎉 ' + SPECIES[id].en + ' 成为了你的伙伴！', 'gold');
    E.renderHome();
  }

  // ---------- 战斗 ----------
  // 第一大区（初一）用图鉴 1–151 号的怪兽；按出没地点和稀有度抽
  const REGION1 = D.list.filter(s => s.no <= 151 && !s.legend && !s.starter);
  const HAB = { grass: ['grass', 'forest', 'town', 'sky'], cave: ['cave', 'mountain', 'ruins', 'night'], water: ['water', 'sea', 'swamp'] };
  const RW = [0, 30, 18, 8, 3, 1];
  const hash = (a, b) => { let h = 2166136261; for (const c of String(a) + '|' + b) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  // 一个区域的野生怪兽表：同一个区域每次都一样（6–8 种），越往后越可能出稀有的
  const tableCache = {};
  function wildTable(z, hab) {
    const key = z + hab; if (tableCache[key]) return tableCache[key];
    const want = HAB[hab] || HAB.grass;
    let pool = REGION1.filter(s => s.stage === 1 && (s.habitat || []).some(h => want.includes(h)) && s.rarity <= 2 + Math.floor(z / 3));
    if (pool.length < 4) pool = REGION1.filter(s => s.stage === 1);
    pool = pool.slice().sort((a, b) => hash(key, a.id) - hash(key, b.id)).slice(0, 6 + (z % 3));
    return (tableCache[key] = pool);
  }
  // 等级够了就用进化后的样子
  function grown(id, lv) { let s = SPECIES[id]; for (let i = 0; i < 2; i++) { const e = (s.evo || []).find(q => q.lv && lv >= q.lv); if (!e) break; s = SPECIES[e.to]; } return s.id; }
  function wildFoe(z, bonus, hab) {
    const tb = wildTable(z, hab || 'grass');
    let r = Math.random() * tb.reduce((a, s) => a + RW[s.rarity || 1], 0), sp = tb[0];
    for (const s of tb) { r -= RW[s.rarity || 1]; if (r <= 0) { sp = s; break; } }
    const lv = zoneLv(z) + (bonus || 0) + rnd(3);
    const mon = newMon(Math.random() < .6 ? grown(sp.id, lv) : sp.id, lv);
    if (Math.random() < SHINY_RATE || window.__forceShiny) mon.shiny = true;
    return mon;
  }
  // 13 个道馆各有主题属性
  const GYM = ['flying', 'rock', 'grass', 'psychic', 'steel', 'spark', 'fire', 'poison', 'ground', 'dark', 'ice', 'water', 'dragon'];
  function leaderFoes(z) {
    const t = GYM[z % GYM.length], n = 2 + Math.floor(z / 4), lv = zoneLv(z) + 2;
    let pool = D.list.filter(s => !s.legend && !s.starter && s.stage === 1 && s.types.includes(t) && s.no <= 251);
    if (!pool.length) pool = REGION1.filter(s => s.stage === 1);
    pool = pool.slice().sort((a, b) => hash('gym' + z, a.id) - hash('gym' + z, b.id));
    return Array.from({ length: n }, (_, k) => { const l = lv + k; return newMon(grown(pool[k % pool.length].id, l + 1), l); });
  }
  const me = () => byUid(B.team[B.ti]);
  const foe = () => B.foes[B.fi];
  const monOf = side => side === 'me' ? me() : foe();
  const hpOf = side => side === 'me' ? B.hp[me().uid] : B.foeHp;
  const addHp = (side, v) => { if (side === 'me') B.hp[me().uid] = Math.max(0, Math.min(stats(me()).hp, B.hp[me().uid] + v)); else B.foeHp = Math.max(0, Math.min(stats(foe()).hp, B.foeHp + v)); };

  const curHp = mon => { const max = stats(mon).hp; return mon.hp == null ? max : Math.max(0, Math.min(max, mon.hp)); };
  const anyAlive = () => M().team.some(u => { const m = byUid(u); return m && !m.egg && curHp(m) > 0; });
  // 怪兽中心：体力回满，异常状态全好
  function healAll() { M().box.forEach(m => { m.hp = stats(m).hp; m.st = null; }); E.save(); }
  // 训练师的怪兽：按区域和编号固定，等级够了自动是进化形态
  function trainerFoes(z, seed, count, lv) {
    const pool = wildTable(z, 'grass').concat(wildTable(z, 'water'));
    return Array.from({ length: count }, (_, k) => { const sp = pool[(seed * 5 + k * 3) % pool.length], l = lv + k; return newMon(grown(sp.id, l), l); });
  }
  // 把战斗里的体力写回存档（体力和异常状态会一直保留，到怪兽中心才恢复）
  function writeBack() {
    if (!B) return;
    B.team.forEach(u => { const m = byUid(u); if (m) m.hp = Math.max(0, Math.min(stats(m).hp, Math.round(B.hp[u]))); });
    E.save();
  }

  // opts：foes 指定对手，trainer {name, emoji} 训练师，onEnd(result) 从大地图进来时战斗结束的回调
  function startBattle(kind, z, opts) {
    opts = opts || {};
    if (!M().box.length) { E.toast('先选一只初始怪兽吧'); return false; }
    if (!anyAlive()) { E.toast('怪兽们都没力气了，先去怪兽中心休息'); return false; }
    E.primeTTS(); E.ac();
    stopBattle();
    const team = M().team.filter(u => byUid(u) && !byUid(u).egg);
    team.forEach(u => ensureMoves(byUid(u)));
    const foes = opts.foes || (kind === 'wild' ? [wildFoe(z, opts.lvBonus, opts.hab)] : leaderFoes(z));
    foes.forEach(ensureMoves);
    const ti = team.findIndex(u => curHp(byUid(u)) > 0);
    B = {
      kind, z, foes, fi: 0, team, ti, hp: {}, energy: 0, fen: 0, turn: 'intro', over: false, used: new Set([team[ti]]), task: null, tries: 0,
      onEnd: opts.onEnd, trainer: opts.trainer, result: '', noCatch: !!opts.noCatch,
      stg: { me: newStages(), foe: newStages() }, conf: { me: 0, foe: 0 },
      fpot: kind === 'leader' ? 2 : kind === 'trainer' ? 1 : 0,
      rules: opts.rules || null,
    };
    if (rule('talk')) B.energy = 3;
    if (B.rules) setTimeout(() => { if (B && B.rules) E.toast(RULE_TEXT[ruleNow()] || '', 'gold'); }, 1500);
    team.forEach(u => { B.hp[u] = curHp(byUid(u)); });
    B.foeHp = stats(foes[0]).hp;
    B.enter = 'both';
    B.pre = prep(foes.concat(team.map(byUid)).map(spOf));
    foes.forEach(f => { if (M().dex[f.sp] !== 'caught') M().dex[f.sp] = 'seen'; });
    E.save();
    E.show('battle');
    // 3D 战斗画面：设置里选了 2D 流畅或者手机不支持就用原来的 2D 画面
    if (window.Battle3D && (E.S.settings.gfx || 'auto') !== '2d' && E.S.settings.gfxAuto !== '2d') {
      try { B3 = Battle3D.create(document.createElement('div'), { theme: arenaTheme(z, opts.hab, opts.arena, opts.rules), shadows: (E.S.settings.gfxAuto || E.S.settings.gfx) !== 'low', dpr: E.S.settings.gfx === 'high' ? 2 : 1.5 }); } catch (e) { B3 = null; }
    }
    renderBattle();
    intro(B);
    return true;
  }
  function stopBattle() {
    if (B3) { B3.destroy(); B3 = null; }
    if (!B) return;
    B.over = true;
    clearTimeout(B.defTimer);
    if (B.defDone) { const r = B.defDone; B.defDone = null; r(); }
    E.stopListening();
    B = null;
  }
  // 血量比例 → 颜色：绿 → 黄 → 红，平滑过渡（不是三档跳变）
  function hpColor(p) {
    const G = [148, 62, 44], Y = [45, 96, 52], R = [4, 84, 56];
    const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, k)));
    const c = p > .5 ? mix(Y, G, (p - .5) / .15) : p > .25 ? Y : mix(R, Y, (p - .1) / .15);
    return 'hsl(' + c[0].toFixed(0) + ' ' + c[1].toFixed(0) + '% ' + c[2].toFixed(0) + '%)';
  }
  // 名牌（仿新作的半透明小牌子）：对手在场地左上、自己在右下，都贴着边，不挡怪兽
  // 名字一行（✨异色 + 名字 + 等级）、血条（掉血时后面留一截浅色慢慢缩）、属性 / 异常状态 / 能力升降一行
  function plate(side, mon, name, extra, bottom) {
    const mine = side === 'me', max = stats(mon).hp, p = Math.max(0, mine ? B.hp[mon.uid] : B.foeHp) / max, w = (p * 100) + '%';
    const id = mine ? 'my' : 'foe', t0 = SPECIES[mon.sp].types[0];
    return '<div class="hpcard ' + side + (B.enter === 'both' || B.enter === side ? ' enter' : '') + '" style="--tc:' + TYPES[t0].color + '">' +
      '<div class="hp-top"><b>' + (mon.shiny ? '<span class="shiny" title="异色">✨</span>' : '') + name + '</b><span class="hp-lv"><small>Lv</small>' + mon.lv + '</span></div>' +
      '<div class="hprow"><span class="hplab">HP</span><div class="hpbar"><span class="hp-ghost" id="b-' + id + 'ghost" style="width:' + w + '"></span><i id="b-' + id + 'hp" style="width:' + w + ';background-color:' + hpColor(p) + '"></i></div></div>' +
      '<div class="hp-foot">' + (extra || '') + '<div class="chips">' + chips(mon.sp) + '<span class="st-chip" id="b-' + id + 'st"></span><span class="stg" id="b-' + id + 'stg"></span></div></div>' +
      (bottom || '') + '</div>';
  }
  function renderBattle() {
    const w = E.W[B.z], f = foe(), m = me(), sf = SPECIES[f.sp], sm = SPECIES[m.sp];
    $('battle').innerHTML =
      '<div class="p-top"><button class="x" data-act="bFlee" aria-label="离开战斗">✕</button><div class="th-title"><b>' + (B.kind === 'wild' ? '野外对战' : B.kind === 'trainer' ? '训练师 ' + B.trainer.name : '道馆馆主 ' + w.boss.name) + '</b><small>第 ' + (B.z + 1) + ' 区 · ' + w.name + '</small></div><span class="b-energy" id="b-energy" title="能量，攒满 3 格可以放大招"></span></div>' +
      '<div class="arena" id="b-arena" style="--wc:' + w.color + '">' + arenaBG(B.z) +
      plate('foe', f, sf.en, (B.kind !== 'wild' ? '<div class="balls" title="对手剩下的怪兽">' + B.foes.map((x, i) => '<span class="' + (i < B.fi ? 'down' : '') + '"></span>').join('') + '</div>' : '')) +
      '<div class="pad foe"></div><div class="mon foe' + (B.enter === 'both' || B.enter === 'foe' ? ' enter' : '') + '" id="b-foe">' + svgMon(f) + '</div>' +
      '<div class="pad me"></div><div class="mon me' + (B.enter === 'both' || B.enter === 'me' ? ' enter' : '') + '" id="b-me">' + svgMon(m) + '</div>' +
      plate('me', m, nm(m), '<small class="hpnum" id="b-myhpn"></small>', '<div class="expbar" title="经验"><i id="b-exp" style="width:' + (m.xp / xpNeed(m.lv) * 100) + '%"></i></div>') +
      (B.kind !== 'wild' ? '<div class="trainer">' + (B.kind === 'trainer' && B.trainer.img ? '<img src="' + B.trainer.img + '" alt="">' : '<span>' + w.boss.emoji + '</span>') + '</div>' : '') +
      '</div><div class="b-msg" id="b-msg"></div><div class="b-panel" id="b-panel"></div>';
    if (B3) {
      const ar = $('b-arena'); ar.classList.add('is3d'); B3.mount(ar);
      B.rig3 = B.rig3 || {};
      if (B.enter === 'both' || B.enter === 'foe') { B3.setMon('foe', spOf(f), true); B.rig3.foe = !!(Mon3D.isLoaded && Mon3D.isLoaded(spOf(f))); }
      if (B.enter === 'both' || B.enter === 'me') { B3.setMon('me', spOf(m), true); B.rig3.me = !!(Mon3D.isLoaded && Mon3D.isLoaded(spOf(m))); }
    }
    B.enter = '';
    updHp();
  }
  // 战斗场地的样子：洞穴暗、雪地白，其余是草地
  // 各岛的战斗场地：沙滩、糖果色、农田、雪地、雾里的古迹……（ground 取自远景画里空地的颜色，bdFloor 是画里空地从多高开始）
  const ARENAS = {
    hello: { sky1: '#7cc8f0', sky2: '#e6f6ff', ground: '#ebc684', hill: '#9ad66e', pad: '#fff4d6', rim: '#d9643a', backdrop: 'assets/arena/hello.jpg', bdFloor: .63 },
    crayon: { sky1: '#a7d8ff', sky2: '#fff0f7', ground: '#f3d493', hill: '#f7b9c9', pad: '#fff7b3', rim: '#f06292', backdrop: 'assets/arena/crayon.jpg', bdFloor: .66 },
    farm: { sky1: '#8fd0f0', sky2: '#fff6de', ground: '#f4d28d', hill: '#e0a24a', pad: '#f3e1b0', rim: '#a0703c', backdrop: 'assets/arena/farm.jpg', bdFloor: .65 },
    school: { sky1: '#86c5f0', sky2: '#eef8ff', ground: '#f4d089', hill: '#b5543c', pad: '#e8e2d4', rim: '#6d4c41', backdrop: 'assets/arena/school.jpg', bdFloor: .66 },
    lab: { sky1: '#8fd3f4', sky2: '#f2fbff', ground: '#f5cf83', hill: '#9fb4c0', pad: '#ffffff', rim: '#5c6bc0', backdrop: 'assets/arena/lab.jpg', bdFloor: .65 },
    circus: { sky1: '#ffb74d', sky2: '#fff3d6', ground: '#f6ce7e', hill: '#e53935', pad: '#fff6e0', rim: '#e53935', backdrop: 'assets/arena/circus.jpg', bdFloor: .66 },
    clock: { sky1: '#9fb7c9', sky2: '#f0ebe0', ground: '#c19f78', hill: '#6b4f45', pad: '#cfc6b6', rim: '#4f9e8a', backdrop: 'assets/arena/clock.jpg', bdFloor: .67 },
    party: { sky1: '#ffc1d9', sky2: '#fff8ec', ground: '#f1cd93', hill: '#ff8fb1', pad: '#fff4e0', rim: '#ff80ab', backdrop: 'assets/arena/party.jpg', bdFloor: .66 },
    jungle: { sky1: '#79c7a0', sky2: '#e8f7e0', ground: '#f2cb8d', hill: '#1f6f2f', pad: '#fbeccb', rim: '#6d4121', backdrop: 'assets/arena/jungle.jpg', bdFloor: .70 },
    city: { sky1: '#9fb7d0', sky2: '#eef3f8', ground: '#9fa7b0', hill: '#78909c', pad: '#dfe3e6', rim: '#ffca28', backdrop: 'assets/arena/city.jpg', bdFloor: .71 },
    sports: { sky1: '#6fc3ff', sky2: '#eaf8ff', ground: '#d1ae7b', hill: '#ff7043', pad: '#ffffff', rim: '#1e88e5', backdrop: 'assets/arena/sports.jpg', bdFloor: .70 },
    snow: { sky1: '#a9c9e0', sky2: '#eef6fb', ground: '#dbe5fa', hill: '#cfe3ee', pad: '#ffffff', rim: '#9fc3d6', backdrop: 'assets/arena/snow.jpg', bdFloor: .68 },
    ruins: { sky1: '#9aa6a8', sky2: '#e4e6e0', ground: '#af9a72', hill: '#8f8a80', pad: '#cfc6b3', rim: '#6d8b5a', backdrop: 'assets/arena/ruins.jpg', bdFloor: .71 },
    // 英语冠军赛（四大师和冠军的对战都带 rules）：体育场
    league: { sky1: '#3f6fd8', sky2: '#dfe9ff', ground: '#d2b494', hill: '#5c6bc0', pad: '#ffffff', rim: '#ffca28', backdrop: 'assets/arena/league.jpg', bdFloor: .74 },
  };
  // 场地的 backdrop 是远景画（assets/arena/*.jpg，约 21:9～3:1，下面三成多是空地），没有这张图就用程序画的小山
  function arenaTheme(z, hab, arena, rules) {
    if (rules) return ARENAS.league;
    if (hab === 'cave') return { sky1: '#231b24', sky2: '#4a3a36', ground: '#877569', hill: '#3a2e28', pad: '#c2b09a', rim: '#7fb8ff', backdrop: 'assets/arena/cave.jpg', bdFloor: .73 };
    if (hab === 'water' && arena === 'under') return { sky1: '#0f4c63', sky2: '#2f8fa8', ground: '#d8c79a', hill: '#2c7a6a', pad: '#e0cfa0', rim: '#4fc3f7' };
    const key = ARENAS[arena] ? arena : window.EchoMaps ? EchoMaps.themeOf(z) : null;
    if (ARENAS[key]) return ARENAS[key];
    if (z === 11) return { sky1: '#a9c9e0', sky2: '#eef6fb', ground: '#eef4f8', hill: '#cfe3ee', pad: '#ffffff', rim: '#9fc3d6' };
    return { rim: E.W[z] ? E.W[z].color : '#7aa85a' };
  }
  const STAT_ZH = { atk: '攻', def: '防', spd: '速' };
  function updHp() {
    const f = foe(), m = me();
    const fmax = stats(f).hp, mmax = stats(m).hp, fh = Math.max(0, B.foeHp), mh = Math.max(0, B.hp[m.uid]);
    const bar = (id, v, max) => {
      const e = $(id + 'hp'), g = $(id + 'ghost'); if (!e) return;
      const p = v / max; e.style.width = (p * 100) + '%'; e.style.backgroundColor = hpColor(p); e.className = p > .5 ? '' : p > .2 ? 'mid' : 'low';
      if (g) g.style.width = (p * 100) + '%';   // 浅色的那截晚一点才缩（CSS 里有延迟）
    };
    bar('b-foe', fh, fmax); bar('b-my', mh, mmax);
    const n = $('b-myhpn'); if (n) n.textContent = Math.round(mh) + ' / ' + mmax;
    const en = $('b-energy'); if (en) en.innerHTML = [0, 1, 2].map(k => '<span class="' + (k < B.energy ? 'on' : 'off') + '">' + TICON.spark + '</span>').join('');
    [['me', 'b-myst', 'b-mystg'], ['foe', 'b-foest', 'b-foestg']].forEach(([side, sid, gid]) => {
      const mon = monOf(side), st = mon.st, e1 = $(sid), e2 = $(gid);
      if (e1) { e1.textContent = st ? STATUS[st].zh : B.conf[side] ? '混乱' : ''; e1.style.setProperty('--sc', st ? STATUS[st].color : '#ec407a'); e1.hidden = !st && !B.conf[side]; }
      if (e2) e2.innerHTML = Object.entries(B.stg[side]).filter(([, v]) => v).map(([k, v]) => '<span class="' + (v > 0 ? 'up' : 'down') + '">' + STAT_ZH[k] + (v > 0 ? '↑' : '↓') + Math.abs(v) + '</span>').join('');
    });
  }
  const msg = t => { const e = $('b-msg'); if (e) e.innerHTML = t; };
  const panel = h => { const e = $('b-panel'); if (e) e.innerHTML = h; };

  async function intro(b) {
    if (B3 && b.pre) { await b.pre; if (!live(b)) return; upgrade3D(); }
    const f = foe(), sf = SPECIES[f.sp], w = E.W[b.z];
    $('b-foe').classList.add('appear');
    if (b.kind === 'wild') {
      msg((f.shiny ? '✨ 闪闪发光的！' : '') + '野生的 <b>' + sf.en + '</b>（' + sf.zh + '）出现了！');
      if (f.shiny) { E.SFX.win(); E.toast('✨ 是异色的 ' + sf.en + '！颜色和平常不一样，很少见哦', 'gold'); }
      if (B3) B3.enter('foe', false);
      await E.say('A wild ' + sf.en + ' appeared!');
    } else {
      const who = b.kind === 'trainer' ? b.trainer.name : w.boss.name;
      msg(who + '：“我要派出 <b>' + sf.en + '</b>！”');
      if (B3) B3.enter('foe', true);
      await E.say("Let's battle! Go, " + sf.en + '!', undefined, 'm');
    }
    if (!live(b)) return;
    msg('去吧，<b>' + nm(me()) + '</b>！');
    if (B3) B3.enter('me', true);
    await E.say('Go, ' + nm(me()) + '!');
    if (!live(b)) return;
    menu();
  }

  // ---------- 我方回合：选招式 ----------
  function menu() {
    if (!B) return;
    B.turn = 'me'; B.task = null; B.mv = null;
    const m = me(), sm = SPECIES[m.sp], f = foe();
    // 睡着 / 冻住：这一回合要先叫醒它
    if (m.st === 'slp' || m.st === 'frz') {
      if (m.st === 'slp') { m.slp = (m.slp || 1) - 1; if (m.slp <= 0) m.st = null; }
      else if (Math.random() < .2) m.st = null;
      if (!m.st) { E.toast((m.slp != null ? '☀️ ' : '🔥 ') + nm(m) + ' 自己恢复了！'); updHp(); }
      else { wakeTask(); return; }
    }
    const canCatch = B.kind === 'wild' && !B.noCatch && B.foeHp <= stats(f).hp * 0.6;
    const others = B.team.some((u, k) => k !== B.ti && B.hp[u] > 0);
    msg('<b>' + nm(m) + '</b> 要用什么技能？念对英语咒语才能成功！');
    panel('<div class="moves">' + movesOf(m).map((mv, i) => {
      const lock = mv.tier === 2 && B.energy < 3, nm = mvName(mv), e = mv.sup ? 1 : eff(mv.type, f.sp);
      const tag = mv.sup ? mv.sup.desc : (e > 1 ? '<em class="mv-eff">克制</em>' : e < 1 ? '不太管用' : TYPES[mv.type].zh);
      return '<button class="move' + (mv.tier === 2 ? ' ult' : '') + (mv.sup ? ' sup' : '') + '" style="--tc:' + TYPES[mv.type].color + '" data-act="bMove" data-i="' + i + '"' + (lock ? ' disabled' : '') + '><span class="mv-top"><span class="mv-ico">' + TICON[mv.type] + '</span><b>' + nm[0] + '</b><span class="mv-pow">' + (mv.sup ? '✦' : DOTS[mv.tier]) + '</span></span><small>' + nm[1] + ' · ' + tag + ' · ' + (lock ? '攒满 3 格能量' : TASK[mv.sup ? 1 : mv.tier]) + '</small></button>';
    }).join('') + '</div>' +
      '<div class="b-items">' +
      (B.kind === 'wild' && !B.noCatch ? '<button class="btn small ' + (canCatch ? 'sun' : 'ghost') + '" data-act="bCatch"' + (canCatch ? '' : ' disabled') + '>🔮 收服' + (canCatch ? '' : ' · 先打虚弱') + '</button>' : '') +
      '<button class="btn small ghost" data-act="bSwitch"' + (others ? '' : ' disabled') + '>🔄 换怪兽</button>' +
      '<button class="btn small ghost" data-act="bBag">🎒 背包</button></div>');
  }
  // 叫醒睡着 / 冻住的怪兽：大声喊它的名字
  function wakeTask() {
    const m = me(), sm = SPECIES[m.sp], slp = m.st === 'slp';
    B.turn = 'task'; B.tries = 0; B.hinted = false;
    B.task = { kind: 'wake', target: (slp ? 'Wake up, ' : 'Warm up, ') + nm(m) + '!', zh: slp ? '快醒醒！' : '快暖和起来！' };
    taskPanel();
    msg('<b>' + nm(m) + '</b> ' + (slp ? '睡着了💤' : '被冻住了🧊') + '！大声喊它，念得越准越容易' + (slp ? '叫醒' : '化开') + '。');
  }
  // 战斗里的背包：回复体力、治异常状态，用掉这一回合
  const STATUS_HEAL = { antidote: ['psn'], burnheal: ['brn'], paraheal: ['par'], awakening: ['slp'], iceheal: ['frz'], fullheal: ['psn', 'brn', 'par', 'slp', 'frz'] };
  function battleBag() {
    if (!B || B.turn !== 'me') return;
    const m = me(), full = B.hp[m.uid] >= stats(m).hp;
    const ids = ['potion', 'superpotion'].concat(Object.keys(STATUS_HEAL).filter(id => itemCount(id) > 0));
    const rows = ids.map(id => {
      const it = ITEMS[id], n = itemCount(id), ok = n > 0 && (it.heal ? !full : STATUS_HEAL[id].includes(m.st));
      return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + it.zh + (it.key ? '' : ' ×' + n) + '</b><small>' + it.desc + '</small></div><button class="btn small sun" data-act="bUse" data-id="' + id + '"' + (ok ? '' : ' disabled') + '>用</button></div>';
    }).join('');
    E.openModal('<h2>🎒 背包</h2><p>给 <b>' + nm(m) + '</b> 用道具（体力 ' + Math.max(0, Math.round(B.hp[m.uid])) + ' / ' + stats(m).hp + (m.st ? ' · ' + STATUS[m.st].zh : '') + '）。用道具会用掉这一回合。</p>' + rows + '<button class="btn ghost wide" data-act="close">返回</button>');
  }
  // 换怪兽：换上来的怪兽会挨对手这一回合的攻击
  function switchSheet() {
    if (!B || B.turn !== 'me') return;
    const rows = B.team.map((u, k) => {
      if (k === B.ti) return '';
      const mon = byUid(u), s = SPECIES[mon.sp], hp = Math.max(0, Math.round(B.hp[u]));
      return '<div class="mrow"><span class="mrow-svg">' + svg(mon.sp) + '</span><div class="mrow-i"><b>' + s.en + '</b> <small>Lv ' + mon.lv + '</small><div class="chips">' + chips(mon.sp) + (mon.st ? '<span class="st-chip" style="--sc:' + STATUS[mon.st].color + '">' + STATUS[mon.st].zh + '</span>' : '') + '</div><small>体力 ' + hp + ' / ' + stats(mon).hp + '</small></div><div class="mrow-b"><button class="btn small sun" data-act="bSwitchTo" data-k="' + k + '"' + (hp > 0 ? '' : ' disabled') + '>就决定是你了</button></div></div>';
    }).join('');
    E.openModal('<h2>🔄 换哪只上场？</h2><p>换怪兽会用掉这一回合。</p>' + rows + '<button class="btn ghost wide" data-act="close">返回</button>');
  }
  function doSwitch(k) {
    if (!B || B.turn !== 'me' || k === B.ti || !(B.hp[B.team[k]] > 0)) return;
    E.closeModal();
    const b = B;
    B.turn = 'busy';
    round(b, Object.assign(async () => {
      const old = SPECIES[me().sp];
      msg('回来吧，<b>' + old.en + '</b>！');
      E.say(old.en + ', come back!');
      await Promise.all([sleep(700), prep([spOf(byUid(B.team[k]))])]);
      B.ti = k; B.used.add(B.team[k]); B.stg.me = newStages(); B.conf.me = 0;
      B.enter = 'me';
      renderBattle();
      const n = SPECIES[me().sp];
      msg('去吧，<b>' + n.en + '</b>！');
      $('b-me').classList.add('appear');
      if (B3) B3.enter('me', true);
      await E.say('Go, ' + n.en + '!');
    }, { priority: true }));
  }

  // 技能任务：说单词 / 念句子 / 对话大招 / 辅助招式 / 收服咒语 / 叫醒
  function onMove(i) {
    if (!B || B.turn !== 'me') return;
    const mv = movesOf(me())[i];
    if (!mv || (mv.tier === 2 && B.energy < 3)) return;
    const Wz = E.W[B.z];
    B.mv = mv; B.move = mv.tier; B.tries = 0; B.hinted = false; B.turn = 'task';
    if (mv.tier === 0 && !mv.sup) { const k = rnd(Wz.words.length), it = Wz.words[k]; B.task = { kind: 'word', q: { kind: 'word', w: B.z, i: k }, target: it[0], zh: it[1], em: it[2] }; }
    else if (mv.tier === 1 || mv.sup) { const k = rnd(Wz.sents.length), it = Wz.sents[k]; B.task = { kind: 'sent', q: { kind: 'sent', w: B.z, i: k }, target: it[0], zh: it[1] }; }
    else { const k = rnd(Wz.dlgs.length), it = Wz.dlgs[k]; B.task = { kind: 'ult', q: { kind: 'dlg', w: B.z, i: k }, prompt: it[0], target: it[1], opts: shuffle([{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))]) }; }
    taskPanel();
  }
  function onCatch(ball) {
    if (!B || B.turn !== 'me' || B.kind !== 'wild') return;
    const nb = itemCount('ball'), ns = itemCount('superball');
    if (nb + ns <= 0) { E.toast('回声球用完了！去「闯关练习」通关就能拿到，或者去商店买'); return; }
    if (!ball && nb > 0 && ns > 0) {
      E.openModal('<h2>用哪种球？</h2><div class="row"><button class="btn sun" data-act="bCatch" data-ball="ball">🔮 回声球 ×' + nb + '</button><button class="btn" data-act="bCatch" data-ball="superball">💠 超级球 ×' + ns + '</button></div><button class="btn ghost wide" data-act="close">返回</button>');
      return;
    }
    E.closeModal();
    B.ball = ball || (nb > 0 ? 'ball' : 'superball');
    B.turn = 'task'; B.tries = 0; B.hinted = false;
    B.task = { kind: 'catch', target: pick(CATCH_LINES) };
    taskPanel();
  }
  function taskPanel() {
    const t = B.task, sr = E.speakMode() === 'sr', mv = B.mv ? mvName(B.mv) : ['', ''], esc = E.esc;
    let head, body = '';
    if (t.kind === 'word') {
      head = '🗣 说出图上的英文，发动 <b>' + mv[0] + '</b>';
      body = '<div class="say-emoji">' + t.em + '</div><div class="say-zh">' + esc(t.zh) + '</div><div class="say-text mask" id="b-say">' + esc(t.target.replace(/[a-z]/gi, '_')) + '</div>' +
        '<button class="link" data-act="bHint">💡 听一下答案（这次就不能暴击了）</button>';
    } else if (t.kind === 'sent') {
      head = '📜 大声念出咒语，发动 <b>' + mv[0] + '</b>';
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div><div class="say-zh">' + esc(t.zh) + '</div><div class="say-row"><button class="spk mini" data-act="bHear" aria-label="听示范">' + E.SPK + '</button></div>';
    } else if (t.kind === 'ult') {
      head = '💬 大招 <b>' + mv[0] + '</b>：听懂对手的问题，' + (sr ? '大声说出正确回答！' : '先选出正确回答，再大声说出来！');
      body = '<div class="say-row"><button class="spk mini" data-act="bHearQ" aria-label="再听一遍">' + E.SPK + '</button><span class="hidden-line blur" id="b-q">' + esc(t.prompt) + '</span></div>' +
        '<div class="opts list">' + t.opts.map((o, k) => '<button class="opt en" data-act="bOpt" data-i="' + k + '"><span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div>' +
        (sr ? '<small class="tip">点选项可以先听一听</small>' : '');
    } else if (t.kind === 'wake') {
      head = '📣 大声喊它！';
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div><div class="say-zh">' + esc(t.zh) + '</div><div class="say-row"><button class="spk mini" data-act="bHear" aria-label="听示范">' + E.SPK + '</button></div>';
    } else {
      head = '🔮 念出收服咒语，把它装进回声球！';
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div><div class="say-row"><button class="spk mini" data-act="bHear" aria-label="听示范">' + E.SPK + '</button></div>';
    }
    const rate = '<div class="rate"><button class="btn coral" data-act="bRate" data-v="0">😅 没念好</button><button class="btn sun" data-act="bRate" data-v="1">🙂 还行</button><button class="btn leaf" data-act="bRate" data-v="2">😎 很准</button></div>';
    panel('<div class="task"><div class="task-h">' + head + '</div>' + body +
      (sr ? '<button class="mic" id="b-mic" data-act="bMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="b-hint">点麦克风，大声念出来</div><div class="heard" id="b-heard"></div>'
        : '<div class="mic-hint" id="b-hint">' + (t.kind === 'ult' ? '先点出正确的回答' : '大声念出来，然后诚实地给自己打分') + '</div><div id="b-rate"' + (t.kind === 'ult' ? ' hidden' : '') + '>' + rate + '</div>') +
      (t.kind === 'wake' ? '' : '<button class="link" data-act="bBack">换个技能</button>') + '</div>');
    if (t.kind !== 'wake') msg(t.kind === 'catch' ? '<b>' + SPECIES[foe().sp].en + '</b> 已经很虚弱了，快收服它！' : B.mv && B.mv.sup ? '念得清楚，辅助招式才会成功！' : '念得越准，伤害越高；念得特别准会<b>暴击</b>！');
    if (t.kind === 'ult') E.say(t.prompt, undefined, 'm');
  }
  async function onMic() {
    if (!B || B.turn !== 'task') return;
    if (E.RT.listening) { E.stopListening(); return; }
    const b = B, t = B.task, m = $('b-mic');
    m.classList.add('on'); m.innerHTML = E.STOP;
    $('b-hint').textContent = '正在听……说完会自动停止';
    const res = await E.recognize(x => { const h = $('b-heard'); if (h) h.textContent = x; });
    if (!live(b) || b.task !== t) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) {
      E.RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') E.RT.noRec = true;
      E.toast('这里用不了语音识别，改成自己念、自己打分');
      taskPanel();
      return;
    }
    if (!res.alts.length) { $('b-hint').textContent = '没听清，靠近一点、大声一点再试一次'; return; }
    if (t.kind === 'ult') {
      const sc = t.opts.map(o => E.bestScore(o.t, res.alts));
      let bi = 0; sc.forEach((s, k) => { if (s.score > sc[bi].score) bi = k; });
      $('b-heard').textContent = '我听到：“' + sc[bi].heard + '”';
      if (t.opts[bi].c && sc[bi].score >= 45) { markOpts(bi); finishTask(sc[bi].score, true); }
      else if (!t.opts[bi].c && sc[bi].score >= 60) { markOpts(t.opts.findIndex(o => o.c), bi); finishTask(0, true, '说成了错误的回答'); }
      else if (B.tries < 1) { B.tries++; $('b-hint').textContent = '没对上任何一个回答，再说一次（最后一次机会）'; }
      else finishTask(0, true);
      return;
    }
    const r = E.bestScore(t.target, res.alts);
    $('b-heard').textContent = '我听到：“' + r.heard + '”';
    const say = $('b-say');
    if (say) {
      if (say.classList.contains('mask')) { say.classList.remove('mask'); say.innerHTML = E.wordsHTML(t.target); }
      say.querySelectorAll('.w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    }
    if (r.score < 30 && B.tries < 1) { B.tries++; $('b-hint').textContent = r.score + ' 分，没念准，再试一次（最后一次机会）'; return; }
    finishTask(r.score, true);
  }
  function markOpts(ri, wi) {
    document.querySelectorAll('#b-panel .opt').forEach((b, k) => b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim'));
    const q = $('b-q'); if (q) q.classList.remove('blur');
  }
  function onOpt(i) {
    if (!B || B.turn !== 'task' || B.task.kind !== 'ult') return;
    const t = B.task;
    if (E.speakMode() === 'sr') { E.say(t.opts[i].t); return; }
    if (t.picked) return;
    if (t.opts[i].c) {
      t.picked = true; markOpts(i);
      $('b-hint').textContent = '选对了！现在大声说出这句回答，再打个分';
      $('b-rate').hidden = false;
      E.say(t.opts[i].t);
    } else {
      markOpts(t.opts.findIndex(o => o.c), i);
      finishTask(0, false, '选错了回答');
    }
  }
  function onRate(v) {
    if (!B || B.turn !== 'task') return;
    if (B.task.kind === 'ult' && !B.task.picked) return;
    if (B.task.kind === 'word') { const s = $('b-say'); if (s) { s.classList.remove('mask'); s.innerHTML = E.wordsHTML(B.task.target); } }
    finishTask([20, 65, 88][v], false);
  }
  function finishTask(score, measured, why) {
    const t = B.task, b = B;
    B.turn = 'busy';
    if (score >= 55) {
      E.S.stats.spoken++; E.qProg('spoken', 1);
      if (measured && score >= 85) { E.S.stats.perfect++; E.qProg('perfect', 1); }
    } else if (t.q) E.addWrong(t.q);
    if (t.kind === 'catch') round(b, Object.assign(() => resolveCatch(score, b), { priority: true }));
    else if (t.kind === 'wake') round(b, () => resolveWake(score, b));
    else round(b, () => myAttack(score, why, b));
  }

  // ---------- 一个回合：速度快的先出手 ----------
  // mine：我方这回合做的事（async）；priority 的（道具、换怪兽、扔球）永远先
  const newStages = () => ({ atk: 0, def: 0, spd: 0 });
  const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  function spdOf(side) { const mon = monOf(side); let v = stats(mon).spd * stageMul(B.stg[side].spd); if (mon.st === 'par') v /= 2; return v; }
  async function round(b, mine) {
    const foeFirst = !(mine && mine.priority) && spdOf('foe') > spdOf('me');
    if (foeFirst) { msg('<b>' + SPECIES[foe().sp].en + '</b> 速度更快，抢先出手！'); await sleep(800); }
    for (const who of foeFirst ? ['foe', 'me'] : ['me', 'foe']) {
      if (!live(b)) return;
      if (who === 'me') { if (mine) { const r = await mine(); if (r === 'end') return; } }
      else if (B.foeHp > 0 && B.hp[me().uid] > 0) await foeAct(b);
      if (!live(b)) return;
      if (B.foeHp <= 0) { await foeFaint(b); return; }
      if (B.hp[me().uid] <= 0) { await myFaint(b); return; }
    }
    await endOfRound(b);
    if (!live(b)) return;
    if (B.foeHp <= 0) { await foeFaint(b); return; }
    if (B.hp[me().uid] <= 0) { await myFaint(b); return; }
    menu();
  }
  // 行动前：睡着、冰冻、麻痹、混乱、不听话
  async function canAct(side, b) {
    const mon = monOf(side), name = nm(mon);
    if (side === 'foe' && (mon.st === 'slp' || mon.st === 'frz')) {
      if (mon.st === 'slp') { mon.slp = (mon.slp || 1) - 1; if (mon.slp <= 0) mon.st = null; }
      else if (Math.random() < .25) mon.st = null;
      updHp();
      msg(mon.st ? '<b>' + name + '</b> ' + (mon.st === 'slp' ? '正在呼呼大睡💤' : '被冻住了，动不了🧊') : '<b>' + name + '</b> ' + '醒过来了！');
      await sleep(900);
      if (mon.st) return false;
    }
    if (mon.st === 'par' && Math.random() < .25) { msg('<b>' + name + '</b> 身体麻痹，动不了！⚡'); if (B3) B3.status(side, 'par'); await sleep(1000); return false; }
    if (B.conf[side] > 0) {
      B.conf[side]--;
      if (!B.conf[side]) { msg('<b>' + name + '</b> 不再混乱了。'); updHp(); await sleep(700); }
      else if (Math.random() < .33) {
        const s = stats(mon), dmg = Math.max(1, Math.round(s.atk * .5 * Math.sqrt((s.atk + 20) / (s.def + 20))));
        msg('<b>' + name + '</b> 晕头转向，撞到了自己！');
        if (B3) B3.status(side, 'conf');
        addHp(side, -dmg); pop(side === 'me' ? 'b-me' : 'b-foe', '-' + dmg, 'dmg'); updHp();
        await sleep(1000);
        return false;
      }
    }
    if (side === 'me') {
      const cap = 20 + 10 * Object.keys(M().badges).length;
      if (mon.lv > cap && Math.random() < .3) { msg('<b>' + name + '</b> 等级太高，不太听你的话，在发呆……（多拿徽章它就会听话了）'); await sleep(1200); return false; }
    }
    return live(b);
  }
  // 回合结束：烧伤、中毒扣血
  async function endOfRound(b) {
    for (const side of ['me', 'foe']) {
      const mon = monOf(side);
      if (!(mon.st === 'brn' || mon.st === 'psn') || hpOf(side) <= 0) continue;
      const dmg = Math.max(1, Math.floor(stats(mon).hp / 8));
      addHp(side, -dmg);
      msg('<b>' + nm(mon) + '</b> ' + (mon.st === 'brn' ? '被烧伤了，好烫！🔥' : '中毒了，好难受……☠️'));
      if (B3) B3.status(side, mon.st);
      pop(side === 'me' ? 'b-me' : 'b-foe', '-' + dmg, 'dmg');
      updHp();
      await sleep(900);
      if (!live(b)) return;
    }
  }
  // 伤害：攻击 × 招式威力 × 发音 × 属性克制 × 本属性加成 × 攻防比
  function damage(att, def, mv, mult) {
    const a = monOf(att), d = monOf(def), sa = SPECIES[a.sp];
    const atk = stats(a).atk * stageMul(B.stg[att].atk) * (a.st === 'brn' ? .6 : 1), dfn = stats(d).def * stageMul(B.stg[def].def);
    const e = eff(mv.type, d.sp), stab = sa.types.includes(mv.type) ? 1.2 : 1;
    const dmg = mult ? Math.max(1, Math.round(atk * POWER[mv.tier] * mult * e * stab * Math.sqrt((atk + 20) / (dfn + 20)) * (0.9 + Math.random() * 0.2))) : 0;
    return { dmg, e };
  }
  // 附加效果：招式有概率让对手烧伤 / 冰冻 / 麻痹 / 中毒 / 混乱
  const SIDE_FX = { fire: 'brn', ice: 'frz', spark: 'par', poison: 'psn', psychic: 'conf', ghost: 'conf' };
  async function sideEffect(att, def, mv) {
    const kind = SIDE_FX[mv.type];
    if (!kind || hpOf(def) <= 0) return;
    const chance = (kind === 'psn' ? .2 : .1) + (mv.tier === 2 ? .2 : 0);
    if (Math.random() < chance) await inflict(def, kind);
  }
  // 让一方陷入异常状态（已经有状态的不叠加；火系不会烧伤、冰系不会冻住……）
  async function inflict(side, kind) {
    const mon = monOf(side), s = SPECIES[mon.sp], name = s.en;
    if (kind === 'conf') {
      if (B.conf[side]) return false;
      B.conf[side] = 2 + rnd(3);
    } else {
      const immune = { brn: ['fire'], frz: ['ice'], par: ['spark'], psn: ['poison', 'steel'], slp: [] }[kind];
      if (mon.st || s.types.some(t => immune.includes(t))) return false;
      mon.st = kind;
      if (kind === 'slp') mon.slp = 1 + rnd(3);
    }
    updHp();
    if (B3) B3.status(side, kind);
    msg('<b>' + name + '</b> ' + STATUS[kind].got);
    E.SFX.bad();
    await sleep(1000);
    return true;
  }
  // 能力升降
  async function stage(side, stat, n) {
    const cur = B.stg[side][stat], nv = Math.max(-6, Math.min(6, cur + n)), name = nm(monOf(side));
    if (nv === cur) { msg('<b>' + name + '</b> 的' + { atk: '攻击', def: '防御', spd: '速度' }[stat] + '已经不能再' + (n > 0 ? '提高' : '降低') + '了。'); await sleep(800); return; }
    B.stg[side][stat] = nv;
    updHp();
    if (B3) B3.buff(side, n > 0);
    msg('<b>' + name + '</b> 的' + { atk: '攻击', def: '防御', spd: '速度' }[stat] + (n > 0 ? (n > 1 ? '大幅提高了！' : '提高了！') : (n < -1 ? '大幅降低了！' : '降低了！')));
    await sleep(900);
  }
  // 辅助招式的效果
  async function supEffect(att, def, sup) {
    if (sup.status) { if (!(await inflict(def, sup.status))) { msg('但是没有效果……'); await sleep(800); } }
    if (sup.fx) {
      for (const [stat, n] of Object.entries(sup.fx.self || {})) await stage(att, stat, n);
      for (const [stat, n] of Object.entries(sup.fx.foe || {})) await stage(def, stat, n);
    }
    if (sup.heal) {
      const mon = monOf(att), max = stats(mon).hp, v = Math.round(max * sup.heal);
      if (hpOf(att) >= max) { msg('体力已经是满的了。'); await sleep(800); return; }
      addHp(att, v); updHp();
      if (B3) B3.heal(att);
      pop(att === 'me' ? 'b-me' : 'b-foe', '+' + v, 'lbl');
      msg('<b>' + nm(mon) + '</b> 恢复了体力！');
      await sleep(900);
    }
  }

  // ---------- 动画 ----------
  function center(id) {
    if (B3) return B3.screenPos(id === 'b-foe' ? 'foe' : 'me');
    const a = $('b-arena').getBoundingClientRect(), r = $(id).getBoundingClientRect();
    return [r.left - a.left + r.width / 2, r.top - a.top + r.height / 2];
  }
  async function projectile(from, to, type) {
    const arena = $('b-arena'); if (!arena) return;
    const [x1, y1] = center(from), [x2, y2] = center(to);
    const p = document.createElement('span');
    p.className = 'proj orb orb-' + type;
    p.style.left = x1 + 'px'; p.style.top = y1 + 'px';
    arena.appendChild(p);
    void p.offsetWidth;
    p.style.left = x2 + 'px'; p.style.top = y2 + 'px'; p.style.transform = 'translate(-50%,-50%) scale(1.8)';
    await sleep(E.reduced ? 50 : 460);
    p.remove();
  }
  function pop(id, text, cls) {
    const arena = $('b-arena'); if (!arena || !$(id)) return;
    const [x, y] = center(id);
    const s = document.createElement('span');
    s.className = 'b-pop ' + (cls || ''); s.textContent = text;
    s.style.left = x + 'px'; s.style.top = (y - 30) + 'px';
    arena.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
  async function strike(fromId, toId, type, dmg, labels, tier) {
    if (B3) {
      const from = fromId === 'b-me' ? 'me' : 'foe', to = from === 'me' ? 'foe' : 'me';
      await B3.attack(from, type, tier || 0);
      if (dmg > 0) {
        E.SFX.hit();
        B3.hit(to, { crit: labels.includes('暴击！') });
        pop(toId, '-' + dmg, 'dmg');
        labels.forEach((l, k) => setTimeout(() => pop(toId, l, 'lbl'), 250 + k * 250));
      } else pop(toId, 'MISS', 'lbl');
      await sleep(dmg > 0 ? (labels.includes('暴击！') ? 1300 : 1100) : 600);   // 挨打的画面多留一会儿
      return;
    }
    const f = $(fromId);
    f.classList.add('lunge', 'attack');
    await sleep(200);
    f.classList.remove('lunge');
    await projectile(fromId, toId, type);
    f.classList.remove('attack');
    const t = $(toId);
    if (dmg > 0) {
      t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
      E.SFX.hit();
      const crit = labels.includes('暴击！');
      burst(toId, type, crit);
      if (crit) { const ar = $('b-arena'); ar.classList.remove('shake'); void ar.offsetWidth; ar.classList.add('shake'); }
      pop(toId, '-' + dmg, 'dmg');
      labels.forEach((l, k) => setTimeout(() => pop(toId, l, 'lbl'), 250 + k * 250));
    } else pop(toId, 'MISS', 'lbl');
    await sleep(650);
  }

  // ---------- 英语冠军赛的特殊规则 ----------
  // words 单词大师：小招伤害 ×1.5；listen 听力大师：防御只有 8 秒；clear 口语大师：念得很准 ×1.6、一般 ×0.8；talk 对话大师：一上场就有 3 格能量
  // rotate：冠军每只怪兽换一种规则
  const RULE_TEXT = {
    words: '📖 单词大师的规则：你的小招伤害 ×1.5',
    listen: '👂 听力大师的规则：防御只有 8 秒，要听得快！',
    clear: '🗣️ 口语大师的规则：念得很准伤害 ×1.6，一般只有 ×0.8',
    talk: '💬 对话大师的规则：一上场就有 3 格能量，可以直接放大招！',
  };
  const ruleNow = () => !B || !B.rules ? null : B.rules.rotate ? B.rules.rotate[B.fi % B.rules.rotate.length] : B.rules.kind;
  const rule = k => ruleNow() === k;

  // ---------- 我方出手 ----------
  async function myAttack(score, why, b) {
    if (!(await canAct('me', b))) return;
    const m = me(), sm = SPECIES[m.sp], mvo = B.mv, mv = mvName(mvo);
    let mult = score >= 85 ? 1.3 : score >= 55 ? 1 : score >= 30 ? 0.6 : 0;
    if (rule('clear')) mult = score >= 85 ? 1.6 : score >= 55 ? 0.8 : score >= 30 ? 0.4 : 0;
    if (B.hinted) mult = Math.min(mult, 1);
    if (rule('words') && mvo.tier === 0 && !mvo.sup) mult *= 1.5;
    mult *= hearts(m) >= 5 ? 1.1 : hearts(m) >= 3 ? 1.05 : 1;
    panel('');
    msg('<b>' + nm(m) + '</b> 使用了 <b>' + mv[0] + '</b>！');
    E.say(nm(m) + ', use ' + mv[0] + '!');
    if (mvo.sup) {
      if (score < 55) { msg('咒语' + (why || '念得不够清楚') + '，<b>' + mv[0] + '</b> 失败了！'); await sleep(1000); return; }
      B.energy = Math.min(3, B.energy + 1);
      if (B3) await B3.attack('me', mvo.type, 0, true);
      await supEffect('me', 'foe', mvo.sup);
      return;
    }
    const { dmg, e } = damage('me', 'foe', mvo, mult);
    if (mvo.tier === 2) B.energy = 0; else if (mult) B.energy = Math.min(3, B.energy + 1);
    const labels = [];
    if (mult >= 1.3) labels.push('暴击！');
    if (dmg && effLabel(e)) labels.push(effLabel(e));
    await strike('b-me', 'b-foe', mvo.type, dmg, labels, mvo.tier);
    if (!live(b)) return;
    addHp('foe', -dmg);
    if (dmg && foe().st === 'frz' && mvo.type === 'fire') { foe().st = null; }
    updHp();
    msg(dmg ? (mult >= 1.3 ? '发音超准，<b>暴击</b>！' : mult < 1 ? '咒语有点含糊，只擦伤了它。' : '打中了！') + (e > 1 ? '属性克制，效果拔群！' : e < 1 ? '属性不太对，效果一般。' : '') : '咒语' + (why || '没念准') + '，攻击落空了！');
    await sleep(900);
    if (dmg) await sideEffect('me', 'foe', mvo);
  }
  // 叫醒自己的怪兽
  async function resolveWake(score, b) {
    const m = me(), name = nm(m), slp = m.st === 'slp';
    panel('');
    if (score >= 55 && Math.random() < (score >= 85 ? .9 : .6)) {
      m.st = null; updHp();
      msg('<b>' + name + '</b> ' + (slp ? '被你叫醒了！' : '身上的冰化开了！') + '下一回合可以出招。');
      E.SFX.ok(2);
    } else msg('<b>' + name + '</b> 还是' + (slp ? '没醒……' : '冻着……') + (score < 55 ? '喊得再清楚一点！' : '下回合再试试。'));
    await sleep(1100);
  }

  // ---------- 对手出手：听懂它的咒语来防御 ----------
  function foeMoveChoice(f) {
    const mv = movesOf(f), dmgMv = mv.filter(x => !x.sup && x.tier < 2), ult = mv.find(x => x.tier === 2), sup = mv.filter(x => x.sup);
    if (ult && B.fen >= 3 && (B.kind !== 'wild' || Math.random() < .4)) { B.fen = 0; return ult; }
    if (sup.length && Math.random() < .22) {
      const s = pick(sup);
      if (!(s.sup.status && (me().st || s.sup.status === 'conf' && B.conf.me))) return s;
    }
    return dmgMv.length ? pick(dmgMv) : { type: SPECIES[f.sp].types[0], tier: 0 };
  }
  async function foeAct(b) {
    const f = foe(), sf = SPECIES[f.sp];
    // 训练师和馆主体力低的时候会用药
    if (B.fpot > 0 && B.foeHp < stats(f).hp * .3 && Math.random() < .7) {
      B.fpot--;
      const v = Math.round(stats(f).hp * .5);
      addHp('foe', v); updHp();
      if (B3) B3.heal('foe');
      pop('b-foe', '+' + v, 'lbl');
      msg((B.kind === 'leader' ? E.W[B.z].boss.name : B.trainer.name) + ' 给 <b>' + sf.en + '</b> 用了药水！');
      E.say('Here, take this potion!', undefined, 'm');
      await sleep(1300);
      return;
    }
    if (!(await canAct('foe', b))) return;
    B.fen++;
    const mvo = foeMoveChoice(f);
    await new Promise(res => { B.defDone = res; foeTurn(b, mvo); });
  }
  async function foeTurn(b, mvo) {
    B.turn = 'foe';
    const f = foe(), sf = SPECIES[f.sp], Wz = E.W[B.z], mv = mvo.tier === 0 && !mvo.sup ? 0 : 1, esc = E.esc;
    let d;
    if (mv === 0) {
      const k = rnd(Wz.words.length), it = Wz.words[k];
      const others = shuffle(Wz.words.filter((x, j) => j !== k && x[1] !== it[1])).slice(0, 2);
      d = { q: { kind: 'word', w: B.z, i: k }, spell: it[0], ans: it[0] + ' = ' + it[1], opts: shuffle([{ c: true, e: it[2], t: it[1] }, ...others.map(o => ({ e: o[2], t: o[1] }))]) };
    } else {
      const k = rnd(Wz.sents.length), it = Wz.sents[k];
      const others = shuffle(Wz.sents.filter((x, j) => j !== k)).slice(0, 2);
      d = { q: { kind: 'sent', w: B.z, i: k }, spell: it[0], ans: it[0] + ' = ' + it[1], opts: shuffle([{ c: true, t: it[1] }, ...others.map(o => ({ t: o[1] }))]) };
    }
    d.mv = mv; d.mvo = mvo; d.type = mvo.type; B.def = d;
    const nm = mvName(mvo);
    msg('<b>' + sf.en + '</b> 要用 <b>' + nm[0] + '</b>（' + nm[1] + '）了！' + (mvo.tier === 2 ? '<b>这是大招！</b>' : '') + '听懂它的咒语来防御！');
    panel('<div class="task def"><div class="task-h">🛡️ 它念的咒语是什么意思？选对就能挡住</div><div class="b-timer"><i id="b-timer"></i></div>' +
      '<div class="say-row"><button class="spk mini" data-act="bDefHear" aria-label="再听一遍">' + E.SPK + '</button></div>' +
      '<div class="opts' + (mv === 0 ? '' : ' list') + '">' + d.opts.map((o, k) => '<button class="opt" data-act="bDef" data-i="' + k + '">' + (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div></div>');
    $('b-foe').classList.add('attack');
    await E.say(d.spell, undefined, 'm');
    if (!live(b) || B.def !== d || d.done) return;
    $('b-foe').classList.remove('attack');
    const bar = $('b-timer');
    const dt = rule('listen') ? 8 : 12;
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = 'width ' + dt + 's linear'; bar.style.width = '0%'; }
    B.defTimer = setTimeout(() => { if (live(b) && B.def === d) defend(-1); }, dt * 1000);
  }
  async function defend(i) {
    const d = B && B.def;
    if (!d || d.done) return;
    d.done = true;
    clearTimeout(B.defTimer);
    const b = B, ok = i >= 0 && d.opts[i].c, finish = () => { const r = B && B.defDone; if (B) B.defDone = null; if (r) r(); };
    document.querySelectorAll('#b-panel .opt').forEach((btn, k) => btn.classList.add(d.opts[k].c ? 'right' : k === i ? 'wrong' : 'dim'));
    const bar = $('b-timer'); if (bar) { bar.style.transition = 'none'; }
    if (ok) { B.energy = Math.min(3, B.energy + 1); E.S.stats.listen++; E.qProg('listen', 1); E.SFX.ok(2); }
    else { E.addWrong(d.q); E.SFX.bad(); }
    msg(ok ? '🛡️ <b>防住了！</b>' + (d.mvo.sup ? '它的招式没有效果。' : '只受到一点点伤害。') : (i < 0 ? '⏰ 来不及了！' : '没听懂……') + '它念的是：<b>' + E.esc(d.ans) + '</b>');
    await sleep(700);
    if (!live(b)) return finish();
    panel('');
    if (d.mvo.sup) {
      if (B3) await B3.attack('foe', d.type, 0, true);
      if (!ok) await supEffect('foe', 'me', d.mvo.sup);
      return finish();
    }
    const { dmg: raw, e } = damage('foe', 'me', d.mvo, [0.8, 1, 1.15][d.mvo.tier] * 1);
    let dmg = Math.max(1, Math.round(raw * (ok ? 0.15 : 1)));
    // 很亲的怪兽：本来要倒下了，为了不让你难过坚持住了
    const hold = hearts(me()) >= 4 && B.hp[me().uid] > 1 && dmg >= B.hp[me().uid] && Math.random() < .2;
    if (hold) dmg = B.hp[me().uid] - 1;
    await strike('b-foe', 'b-me', d.type, dmg, ok ? ['挡住了'] : effLabel(e) ? [effLabel(e)] : [], d.mvo.tier);
    if (!live(b)) return finish();
    addHp('me', -dmg);
    if (hold) { msg('💖 <b>' + nm(me()) + '</b> 为了不让你难过，咬牙坚持住了！'); E.say(nm(me()) + ' held on for you!'); await sleep(1300); }
    if (me().st === 'frz' && d.type === 'fire') me().st = null;
    updHp();
    await sleep(500);
    if (!ok && live(b)) await sideEffect('foe', 'me', d.mvo);
    finish();
  }

  // ---------- 经验、升级、学新招 ----------
  function gainMonXp(mon, xp, quiet) {
    mon.xp += xp;
    ensureMoves(mon);
    while (mon.xp >= xpNeed(mon.lv) && mon.lv < 100) {
      mon.xp -= xpNeed(mon.lv); mon.lv++;
      befriend(mon, 2);
      if (B && B.hp[mon.uid] > 0) { B.hp[mon.uid] += 6; updHp(); }
      if (!quiet) E.toast('⬆️ ' + nm(mon) + ' 升到了 Lv ' + mon.lv + '！', 'gold');
      const pend = M().pendingEvo || (M().pendingEvo = []);
      if (lvEvo(mon) && !pend.includes(mon.uid)) pend.push(mon.uid);
      learnAt(mon, mon.lv);
    }
  }
  // 到了这个等级能学的招式：没满 4 个直接学会，满了就排队问要不要换
  function learnAt(mon, lv) {
    learnset(SPECIES[mon.sp]).filter(([l]) => l === lv).forEach(([, id]) => {
      if (mon.moves.includes(id)) return;
      if (mon.moves.length < 4) { mon.moves.push(id); E.toast('✨ ' + nm(mon) + ' 学会了 ' + mvName(parseMove(id))[0] + '！', 'gold'); }
      else (M().pendingLearn || (M().pendingLearn = [])).push({ u: mon.uid, id });
    });
  }
  // 学新招：选一个忘掉，然后大声说 "Emberpup, learn Flame Wave!"
  function learnNext() {
    const q = M().pendingLearn || [];
    if (!q.length || !$('modal').hidden) return false;
    const it = q[0], mon = byUid(it.u);
    if (!mon || mon.moves.includes(it.id)) { q.shift(); E.save(); return learnNext(); }
    const s = SPECIES[mon.sp], nm = mvName(parseMove(it.id));
    E.openModal('<h2>' + s.en + ' 想学新招式！</h2><div class="learn-new">' + moveCard(parseMove(it.id)) + '</div><p>它已经会 4 个招式了。要忘掉哪一个，换成 <b>' + nm[0] + '</b>？</p>' +
      '<div class="learn-old">' + mon.moves.map((id, k) => '<button class="btn ghost" data-act="mForget" data-k="' + k + '">' + moveCard(parseMove(id)) + '</button>').join('') + '</div>' +
      '<button class="btn ghost wide" data-act="mForget" data-k="-1">不学了</button>', { locked: true });
    E.say(s.en + ' wants to learn ' + nm[0] + '.');
    return true;
  }
  function forget(k) {
    const q = M().pendingLearn || [], it = q[0];
    if (!it) { E.closeModal(); return; }
    const mon = byUid(it.u), s = SPECIES[mon.sp], nm = mvName(parseMove(it.id));
    if (k < 0) { q.shift(); E.save(); E.closeModal(); E.toast(s.en + ' 没有学 ' + nm[0]); setTimeout(afterBattleQueue, 300); return; }
    const old = mvName(parseMove(mon.moves[k]));
    const line = s.en + ', learn ' + nm[0] + '!', sr = E.speakMode() === 'sr';
    E.openModal('<h2>1, 2, 3……忘掉了 ' + old[0] + '！</h2><p>现在大声教它新招式：</p><div class="say-text" id="lr-say">' + E.wordsHTML(line) + '</div>' +
      (sr ? '<button class="mic" id="lr-mic" data-act="mLearnMic" data-k="' + k + '">' + E.MIC + '</button><div class="mic-hint" id="lr-hint">点麦克风，大声说</div>' : '<button class="btn leaf wide" data-act="mLearnGo" data-k="' + k + '">🎤 我说了！</button>') +
      '<button class="btn ghost wide" data-act="mHearLearn">🔊 听一遍</button>', { locked: true });
    E.say(line);
  }
  function learnDone(k) {
    const q = M().pendingLearn || [], it = q.shift();
    if (!it) return;
    const mon = byUid(it.u);
    if (mon) mon.moves[k] = it.id;
    E.save(); E.closeModal(); E.SFX.win();
    E.toast('✨ ' + nm(mon) + ' 学会了 ' + mvName(parseMove(it.id))[0] + '！', 'gold');
    setTimeout(afterBattleQueue, 400);
  }
  async function learnMic(k) {
    const m = $('lr-mic'); if (!m) return;
    if (E.RT.listening) { E.stopListening(); return; }
    m.classList.add('on'); m.innerHTML = E.STOP; $('lr-hint').textContent = '正在听……';
    const it = (M().pendingLearn || [])[0], line = it ? nm(byUid(it.u)) + ', learn ' + mvName(parseMove(it.id))[0] : '';
    const res = await E.recognize();
    if (!$('lr-mic')) return;
    m.classList.remove('on'); m.innerHTML = E.MIC;
    if (res.err && E.FATAL.includes(res.err)) { E.RT.srBroken = true; learnDone(k); return; }
    if (!res.alts.length) { $('lr-hint').textContent = '没听清，再大声一点'; return; }
    if (E.bestScore(line, res.alts).score >= 45) learnDone(k); else $('lr-hint').textContent = '再清楚一点，再说一次！';
  }
  // 战斗结束后依次处理：学新招 → 进化
  function afterBattleQueue() {
    const pn = M().pendingNick;
    if (pn && pn.length && !B) { const u = pn.shift(); E.save(); if (byUid(u)) { nickSheet(u, 'queue'); return; } }
    if (!learnNext()) evolveNext();
  }

  async function foeFaint(b) {
    const f = foe(), sf = SPECIES[f.sp];
    $('b-foe').classList.add('faint');
    if (B3) B3.faint('foe');
    msg('<b>' + sf.en + '</b> 倒下了！');
    E.say(sf.en + ' fainted!');
    shareXp(10 + f.lv * 8);
    const eb = $('b-exp'), cm = me(); if (eb && cm) eb.style.width = (cm.xp / xpNeed(cm.lv) * 100) + '%';
    E.save();
    await sleep(1400);
    if (!live(b)) return;
    if (B.fi + 1 < B.foes.length) {
      B.fi++;
      B.foeHp = stats(foe()).hp; B.stg.foe = newStages(); B.conf.foe = 0; B.fen = 0;
      // 冠军换怪兽也换规则
      if (B.rules && B.rules.rotate) { if (rule('talk')) B.energy = 3; E.toast(RULE_TEXT[ruleNow()], 'gold'); }
      await prep([spOf(foe())]);
      if (!live(b)) return;
      B.enter = 'foe';
      renderBattle();
      const n = SPECIES[foe().sp];
      msg((B.kind === 'trainer' ? B.trainer.name : E.W[B.z].boss.name) + '：“还没完！去吧，<b>' + n.en + '</b>！”');
      $('b-foe').classList.add('appear');
      if (B3) B3.enter('foe', true);
      await E.say('Go, ' + n.en + '!', undefined, 'm');
      if (!live(b)) return;
      menu();
    } else win(b, false);
  }
  // 经验：出过场的拿全部；带着学习装置的话，队伍里其他怪兽也拿一半
  function shareXp(xp) {
    B.used.forEach(u => { const mm = byUid(u); if (mm && B.hp[u] > 0) gainMonXp(mm, xp); });
    if (itemCount('expshare') > 0 && M().expShareOn !== false) B.team.forEach(u => { if (!B.used.has(u)) { const mm = byUid(u); if (mm && B.hp[u] > 0) gainMonXp(mm, Math.round(xp / 2), true); } });
  }
  async function myFaint(b) {
    const m = me();
    $('b-me').classList.add('faint');
    if (B3) B3.faint('me');
    msg('<b>' + nm(m) + '</b> 累倒了……');
    m.st = null;
    await sleep(1300);
    if (!live(b)) return;
    const next = B.team.findIndex((u, k) => k !== B.ti && B.hp[u] > 0);
    if (next >= 0) {
      await prep([spOf(byUid(B.team[next]))]);
      if (!live(b)) return;
      B.ti = next; B.used.add(B.team[next]); B.stg.me = newStages(); B.conf.me = 0;
      B.enter = 'me';
      renderBattle();
      msg('去吧，<b>' + nm(me()) + '</b>！');
      $('b-me').classList.add('appear');
      if (B3) B3.enter('me', true);
      await E.say('Go, ' + nm(me()) + '!');
      if (!live(b)) return;
      menu();
    } else lose(b);
  }

  // ---------- 收服 ----------
  async function resolveCatch(score, b) {
    const f = foe(), sf = SPECIES[f.sp], max = stats(f).hp, sup = B.ball === 'superball';
    addItem(sup ? 'superball' : 'ball', -1);
    panel('');
    msg(sup ? '去吧，超级球！' : '去吧，回声球！');
    const ball = document.createElement('span');
    ball.className = 'proj ball';
    const arena = $('b-arena'), [x1, y1] = center('b-me'), [x2, y2] = center('b-foe');
    ball.style.left = x1 + 'px'; ball.style.top = y1 + 'px';
    arena.appendChild(ball); void ball.offsetWidth;
    ball.style.left = x2 + 'px'; ball.style.top = (y2 + 20) + 'px';
    if (B3) await B3.catchThrow(sup); else await sleep(500);
    if (!live(b)) return 'end';
    $('b-foe').classList.add('caught-in');
    ball.classList.add('wobble');
    const stBonus = f.st === 'slp' || f.st === 'frz' ? 2 : f.st ? 1.5 : 1;
    const p = (0.3 + 0.7 * (1 - Math.max(0, B.foeHp) / max)) * (score >= 85 ? 1.25 : score >= 55 ? 1 : 0.5) * (sup ? 1.5 : 1) * (sf.legend ? .35 : 1) * stBonus;
    const ok = Math.random() < p;
    for (let k = 0; k < 3; k++) { E.SFX.tap(); if (B3) await B3.wobble(); else await sleep(600); if (!live(b)) return 'end'; if (!ok && k === 1) break; }
    if (ok) {
      ball.classList.remove('wobble'); ball.classList.add('sealed');
      if (B3) B3.sealed();
      shareXp(10 + f.lv * 8);
      const mon = newMon(f.sp, f.lv);
      mon.moves = f.moves.slice();
      if (f.shiny) { mon.shiny = true; (M().shinyDex = M().shinyDex || {})[f.sp] = 1; }
      mon.fr = 70;
      addMon(mon);
      if (!M().team.includes(mon.uid)) B.toBox = true;
      M().dex[f.sp] = 'caught';
      (M().pendingNick = M().pendingNick || []).push(mon.uid);
      M().caught = (M().caught || 0) + 1;
      E.qProg('catch', 1);
      E.SFX.win(); E.confetti(140);
      msg('🎉 收服成功！<b>' + sf.en + '</b>（' + sf.zh + '）成为了你的伙伴！');
      E.say('Gotcha! ' + sf.en + ' was caught!');
      E.save();
      await sleep(1200);
      if (!live(b)) return 'end';
      win(b, true);
      return 'end';
    }
    ball.remove();
    $('b-foe').classList.remove('caught-in');
    if (B3) B3.breakOut();
    E.SFX.bad();
    msg('哎呀，<b>' + sf.en + '</b> 挣脱了！' + (score < 55 ? '收服咒语要念得清楚一点。' : '再把它打虚弱一点，或者让它睡着、麻痹再试试。'));
    E.save();
    await sleep(1200);
  }

  // ---------- 结算 ----------
  function win(b, caught) {
    B.turn = 'done';
    const m = M(), z = B.z, w = E.W[z];
    const topLv = Math.max(...B.foes.map(f => f.lv));
    let coins = 8 + topLv * 2;
    const lines = [];
    if (B.kind === 'trainer') coins += 6 + topLv;
    if (B.kind === 'leader') {
      const first = !m.badges[z];
      m.badges[z] = 1;
      coins += first ? 40 : 10;
      if (first) { m.balls += 3; lines.push('🏅 拿到了 ' + w.name + ' 徽章！'); lines.push('🔮 回声球 +3'); lines.push('🐾 等级 ' + (20 + 10 * Object.keys(m.badges).length) + ' 以下的怪兽都会听你的话'); if (z + 1 < E.W.length) lines.push('🏝️ 新区域解锁：' + E.W[z + 1].name); }
    }
    E.S.coins += coins;
    B.result = caught ? 'caught' : 'win';
    writeBack();
    lines.unshift('💰 金币 +' + coins);
    lines.push('⭐ 出战的怪兽获得经验 +' + (10 + topLv * 8) + (itemCount('expshare') > 0 && m.expShareOn !== false ? '（学习装置：其他队员也分到一半）' : ''));
    E.gainXp(15 + topLv);
    B.used.forEach(u => befriend(byUid(u), B.kind === 'wild' ? 1 : 3));
    m.wins = (m.wins || 0) + 1;
    E.qProg('battle', 1);
    const newDay = E.markToday();
    E.save(); E.renderTop();
    if (!caught) { E.SFX.win(); E.confetti(B.kind === 'leader' ? 200 : 90); }
    msg(caught ? (B.toBox ? '队伍已经有 6 只了，新伙伴被送到了电脑箱子里（去怪兽中心的电脑换）。' : '新伙伴已经加入队伍！') : B.kind === 'leader' ? w.boss.name + '：“你太厉害了！这枚徽章是你的了！”' : B.kind === 'trainer' ? B.trainer.name + '：“你真厉害！”' : '胜利！');
    panel('<div class="b-result"><div class="big">' + (caught ? '🔮' : B.kind === 'leader' ? '🏅' : '🏆') + '</div><b>' + (caught ? '收服成功！' : B.kind === 'leader' ? '打败馆主！' : '胜利！') + '</b><p>' + lines.join('<br>') + '</p>' +
      '<div class="say-row">' + (B.onEnd ? '<button class="btn" data-act="bEnd" data-focus>继续冒险 ▶</button>'
        : (B.kind === 'wild' ? '<button class="btn" data-act="mWild" data-z="' + z + '">⚔️ 再战一场</button>' : '') + '<button class="btn ghost" data-act="bHome">回基地</button>') + '</div></div>');
    if (newDay) setTimeout(() => E.toast('🔥 今日打卡成功！已连续 ' + E.S.streak + ' 天', 'gold'), 900);
    setTimeout(() => { E.checkAch(); afterBattleQueue(); }, 1300);
  }
  function lose() {
    B.turn = 'done'; B.result = 'lose';
    writeBack();
    msg('你的怪兽们都累倒了……');
    panel('<div class="b-result"><div class="big">💤</div><b>先去怪兽中心休息一下</b><p>怪兽中心能让怪兽恢复体力、治好异常状态。<br>小窍门：多在草丛里打野生怪兽把等级练上去，<br>用<b>属性克制</b>的招式，或者先用辅助招式降低对手的攻击。</p><div class="say-row">' +
      (B.onEnd ? '<button class="btn" data-act="bEnd" data-focus>去怪兽中心</button>' : '<button class="btn" data-act="bHome">回基地</button>') + '</div></div>');
  }
  // 战斗里用道具：回复体力或治异常状态，用掉这一回合
  function usePotion(id) {
    id = id || 'potion';
    if (!B || B.turn !== 'me' || itemCount(id) <= 0) return;
    const b = B, m = me(), max = stats(m).hp, it = ITEMS[id];
    if (it.heal ? B.hp[m.uid] >= max : !(STATUS_HEAL[id] || []).includes(m.st)) return;
    E.closeModal();
    B.turn = 'busy';
    round(b, Object.assign(async () => {
      addItem(id, -1);
      panel('');
      if (it.heal) {
        const heal = Math.max(20, Math.round(max * it.heal));
        B.hp[m.uid] = Math.min(max, B.hp[m.uid] + heal);
        msg('用了' + it.zh + '！<b>' + nm(m) + '</b> 恢复了体力。');
        pop('b-me', '+' + heal, 'lbl');
      } else { m.st = null; msg('用了' + it.zh + '！<b>' + nm(m) + '</b> 恢复正常了。'); }
      E.SFX.coin();
      if (B3) B3.heal('me');
      updHp(); E.save();
      await sleep(1100);
    }, { priority: true }));
  }
  // 进化排队保存在存档里：就算中途离开战斗，回到基地也会补上进化动画
  function evolveNext() {
    const pend = M().pendingEvo || [];
    if (!pend.length || !$('modal').hidden) return;
    const u = pend.shift(); E.save();
    const mon = byUid(u), ev = mon && lvEvo(mon);
    if (!ev) { evolveNext(); return; }
    evolveTo(mon, ev.to);
  }
  function evolveTo(mon, toId) {
    const from = SPECIES[mon.sp], to = SPECIES[toId];
    if (window.Mon3D && Mon3D.preload) Mon3D.preload([toId]);
    E.openModal('<h2>咦？' + from.en + ' 的样子在变化……</h2><div class="evo-stage"><div class="evo-old">' + svg(mon.sp) + '</div><div class="evo-new">' + svg(toId) + '</div></div>' +
      '<p id="evo-t">' + from.zh + ' 正在进化！</p><button class="btn sun wide" data-act="mEvoOk" id="evo-ok" hidden>太棒了！</button>', { locked: true });
    E.say('What? ' + from.en + ' is evolving!');
    mon.sp = toId;
    M().dex[toId] = 'caught';
    M().evolved = (M().evolved || 0) + 1;
    E.save();
    setTimeout(() => {
      const st = document.querySelector('.evo-stage'); if (st) st.classList.add('done');
      const t = $('evo-t'); if (t) t.innerHTML = '恭喜！<b>' + from.en + '</b> 进化成了 <b>' + to.en + '</b>（' + to.zh + '）！';
      const ok = $('evo-ok'); if (ok) ok.hidden = false;
      E.SFX.win(); E.confetti(180);
      E.say(from.en + ' evolved into ' + to.en + '!');
      E.checkAch();
    }, 2600);
  }

  // ---------- 怪兽详情 ----------
  function moveCard(mv) {
    const nm = mvName(mv);
    return '<span class="mv-card" style="--tc:' + TYPES[mv.type].color + '"><span class="mv-ico">' + TICON[mv.type] + '</span><b>' + nm[0] + '</b><small>' + nm[1] + ' · ' + TYPES[mv.type].zh + ' · ' + (mv.sup ? mv.sup.desc : ['小招', '中招', '大招'][mv.tier]) + '</small></span>';
  }
  function summarySheet(u, back) {
    const mon = byUid(u); if (!mon) return;
    if (mon.egg) { E.openModal('<div class="sum-top"><span class="sum-pic">' + EGG_SVG + '</span><div><h2>蛋 Egg</h2><p>' + eggHint(mon) + '</p><p class="tip">带着它一起走路，它就会慢慢长大、孵出来。</p></div></div><button class="btn ghost wide" data-act="' + (back || 'mTeam') + '">返回</button>'); return; }
    ensureMoves(mon);
    const s = SPECIES[mon.sp], st = stats(mon), hp = curHp(mon), esc = E.esc;
    const bar = (k, v, max) => '<div class="sum-stat"><span>' + k + '</span><b>' + v + '</b><i><em style="width:' + Math.min(100, v / max * 100) + '%"></em></i></div>';
    const nextEvo = (s.evo || []).map(e => e.lv ? 'Lv ' + e.lv + ' 进化成 ' + SPECIES[e.to].en : D.STONES[e.item].zh + ' → ' + SPECIES[e.to].en).join('；');
    const nextMoves = learnset(s).filter(([l, id]) => l > mon.lv && !mon.moves.includes(id)).slice(0, 2).map(([l, id]) => 'Lv ' + l + ' ' + mvName(parseMove(id))[0]).join('，');
    const talked = (M().talked || {})[mon.uid] === E.dayStr();
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + (mon.shiny ? '✨' : '') + nm(mon) + ' <small>' + (mon.nick ? s.en + ' · ' : '') + s.zh + '</small></h2>' +
      '<div class="sum-fr">亲密度 ' + heartsHTML(mon) + ' <button class="btn small ' + (talked ? 'ghost' : 'sun') + '" data-act="mTalk" data-u="' + mon.uid + '">' + (talked ? '💬 今天聊过了' : '💬 和它说说话') + '</button> <button class="btn small ghost" data-act="mNick" data-u="' + mon.uid + '">✏️ 起名字</button></div><div class="chips">' + chips(mon.sp) + '<span class="lvchip">Lv ' + mon.lv + '</span>' + (mon.st ? '<span class="st-chip" style="--sc:' + STATUS[mon.st].color + '">' + STATUS[mon.st].zh + '</span>' : '') + '</div>' +
      '<small>经验 ' + mon.xp + ' / ' + xpNeed(mon.lv) + '</small><div class="xpbar"><i style="width:' + (mon.xp / xpNeed(mon.lv) * 100) + '%"></i></div></div></div>' +
      '<div class="sum-stats">' + bar('体力 HP', hp + '/' + st.hp, st.hp) + bar('攻击 ATK', st.atk, 250) + bar('防御 DEF', st.def, 250) + bar('速度 SPD', st.spd, 250) + '</div>' +
      '<h3 class="pc-h">招式</h3><div class="sum-moves">' + mon.moves.map(id => moveCard(parseMove(id))).join('') + '</div>' +
      (nextMoves ? '<p class="tip">以后还能学：' + nextMoves + '</p>' : '') + (nextEvo ? '<p class="tip">进化：' + nextEvo + '</p>' : '') +
      '<p class="dex-en">' + esc(s.dexEn) + '</p><p class="dex-zh">' + esc(s.dexZh) + '</p>' +
      '<button class="btn ghost wide" data-act="' + (back || 'mTeam') + '">返回</button>');
  }

  // ---------- 英文昵称 ----------
  // 按属性推荐几个英文名字，也可以自己输入；起好以后要对它说 "Your name is ...!"
  const NICKS = {
    fire: ['Blaze', 'Sunny', 'Ember', 'Chilli'], water: ['Bubbles', 'Splash', 'Ocean', 'Wave'], grass: ['Leafy', 'Mint', 'Clover', 'Bean'], spark: ['Zippy', 'Flash', 'Bolt', 'Buzz'],
    ice: ['Snowy', 'Frosty', 'Icy', 'Crystal'], rock: ['Rocky', 'Pebble', 'Stone', 'Boulder'], ground: ['Sandy', 'Dusty', 'Digger', 'Muddy'], flying: ['Sky', 'Feather', 'Breezy', 'Wings'],
    bug: ['Buggy', 'Beetle', 'Dotty', 'Wiggle'], poison: ['Violet', 'Plum', 'Grape', 'Stinky'], psychic: ['Dream', 'Moony', 'Wonder', 'Star'], ghost: ['Boo', 'Shadow', 'Misty', 'Spooky'],
    dark: ['Midnight', 'Ninja', 'Coal', 'Shade'], steel: ['Iron', 'Tin', 'Bolty', 'Robo'], dragon: ['Drago', 'Legend', 'Ace', 'Scales'], fight: ['Champ', 'Punchy', 'Rocky', 'Hero'], normal: ['Buddy', 'Coco', 'Teddy', 'Lucky'],
  };
  let nickCtx = null;
  function nickSheet(u, then) {
    const mon = byUid(u); if (!mon) { if (then === 'queue') afterBattleQueue(); return; }
    const s = SPECIES[mon.sp], pool = [...new Set((NICKS[s.type] || []).concat(NICKS.normal, ['Momo', 'Pepper', 'Cookie', 'Max']))].slice(0, 8);
    nickCtx = { u, then, name: '' };
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>给 ' + nm(mon) + ' 起个英文名字吧！</h2><p>选一个，也可以自己输入。</p></div></div>' +
      '<div class="nm-grid">' + pool.map(n => '<button class="btn ghost nm" data-act="mNickPick" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="nm-own"><input id="nick-in" maxlength="10" placeholder="自己输入英文名" autocomplete="off" autocapitalize="words" spellcheck="false"><button class="btn sun" data-act="mNickOwn">好了</button></div><small class="tip" id="nick-tip">只能用英文字母，最多 10 个</small>' +
      '<div class="row"><button class="btn ghost" data-act="mNickSkip">' + (mon.nick ? '不改了' : '就叫 ' + s.en) + '</button>' + (mon.nick ? '<button class="btn ghost" data-act="mNickClear">用回原名 ' + s.en + '</button>' : '') + '</div>', { locked: true });
  }
  function nickSay(name) {
    if (!nickCtx) return;
    const mon = byUid(nickCtx.u); if (!mon) return;
    nickCtx.name = name;
    const line = 'Your name is ' + name + '!', sr = E.speakMode() === 'sr';
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + name + '</h2><p>大声告诉它新名字：</p></div></div><div class="say-text" id="nick-say">' + E.wordsHTML(line) + '</div>' +
      '<button class="spk mini" data-act="mNickHear" aria-label="听">' + E.SPK + '</button>' +
      (sr ? '<button class="mic" id="nick-mic" data-act="mNickMic">' + E.MIC + '</button><div class="mic-hint" id="nick-hint">点麦克风，大声说</div>' : '<button class="btn leaf wide" data-act="mNickGo">🎤 我说了！</button>') +
      '<button class="link" data-act="mNickBack">换一个名字</button>', { locked: true });
    E.say(line);
  }
  function nickDone(ok) {
    const c = nickCtx; nickCtx = null;
    const mon = c && byUid(c.u);
    if (mon && ok && c.name) {
      mon.nick = c.name === SPECIES[mon.sp].en ? undefined : c.name;
      befriend(mon, 5);
      E.S.stats.spoken = (E.S.stats.spoken || 0) + 1;
      E.save(); E.SFX.win();
      E.toast('💖 ' + (mon.nick ? '它现在叫 ' + mon.nick + ' 了！' : '用回了原来的名字'), 'gold');
      E.say(nm(mon) + '!');
    }
    E.closeModal();
    if (c && c.then === 'queue') setTimeout(afterBattleQueue, 300);
    else if (c && c.then) summarySheet(c.u);
    E.renderHome && E.renderHome();
  }
  async function nickMic() {
    if (!nickCtx) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const line = 'Your name is ' + nickCtx.name + '!', m = $('nick-mic'); m.classList.add('on');
    const res = await E.recognize(() => {});
    m.classList.remove('on');
    if (!res.alts.length) { $('nick-hint').textContent = '没听清，再大声一点'; return; }
    const r = E.bestScore(line, res.alts);
    if (r.score >= 45) nickDone(true); else $('nick-hint').textContent = r.score + ' 分，再清楚一点！';
  }

  // ---------- 每天和怪兽说说话：亲密度 ----------
  const TALKS = [
    n => 'Good morning, ' + n + '! You are my friend.', n => n + ", let's play together!", n => 'You are so brave, ' + n + '!', n => 'Thank you for your help, ' + n + '.',
    n => 'I like you very much, ' + n + '!', n => n + ', you did a great job today!', n => "Don't worry, " + n + ". I'm here.", n => n + ', are you hungry? Let me get some food.',
  ];
  const MOOD = ['它有点害羞地看着你。', '它歪着头听你说话。', '它开心地转了一圈。', '它蹭了蹭你的手。', '它高兴得跳了起来！', '它紧紧地贴着你，最喜欢你了！💖'];
  let talkCtx = null;
  function talkSheet(u, then) {
    const mon = byUid(u); if (!mon || mon.egg) return;
    const today = E.dayStr(), done = (M().talked || {})[u] === today;
    if (done) { E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + nm(mon) + '</h2><p>' + MOOD[hearts(mon)] + '</p><p>亲密度 ' + heartsHTML(mon) + '</p><p class="tip">今天已经聊过了，明天再来和它说说话吧。</p></div></div><button class="btn ghost wide" data-act="' + (then ? 'mTalkBack' : 'close') + '" data-u="' + u + '">好的</button>'); talkCtx = { u, then }; return; }
    const line = TALKS[(new Date().getDate() + SPECIES[mon.sp].no) % TALKS.length](nm(mon)), sr = E.speakMode() === 'sr';
    talkCtx = { u, then, line };
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>和 ' + nm(mon) + ' 说说话</h2><p>每天用英语和它说一句，它会越来越喜欢你。亲密度 ' + heartsHTML(mon) + '</p></div></div>' +
      '<div class="say-text" id="talk-say">' + E.wordsHTML(line) + '</div><button class="spk mini" data-act="mTalkHear" aria-label="听">' + E.SPK + '</button>' +
      (sr ? '<button class="mic" id="talk-mic" data-act="mTalkMic">' + E.MIC + '</button><div class="mic-hint" id="talk-hint">点麦克风，大声说</div>' : '<button class="btn leaf wide" data-act="mTalkGo">🎤 我说了！</button>') +
      '<button class="btn ghost wide" data-act="' + (then ? 'mTalkBack' : 'close') + '" data-u="' + u + '">先不说</button>');
    E.say(line);
  }
  function talkDone() {
    const c = talkCtx, mon = c && byUid(c.u); if (!mon) return;
    (M().talked = M().talked || {})[c.u] = E.dayStr();
    const before = hearts(mon);
    befriend(mon, 12);
    E.S.stats.spoken = (E.S.stats.spoken || 0) + 1; E.qProg('spoken', 1);
    E.save(); E.SFX.ok(3);
    E.say(nm(mon) + '!');
    E.openModal('<div class="sum-top"><span class="sum-pic">' + svgMon(mon) + '</span><div><h2>' + nm(mon) + '</h2><p>' + MOOD[hearts(mon)] + '</p><p>亲密度 ' + heartsHTML(mon) + (hearts(mon) > before ? ' <b>+1 ♥</b>' : '') + '</p>' +
      (hearts(mon) >= 4 ? '<p class="tip">很亲的怪兽：快倒下时有时会为你坚持住，打起来也更用力。</p>' : '') + '</div></div><button class="btn wide" data-act="' + (c.then ? 'mTalkBack' : 'close') + '" data-u="' + c.u + '">😊 好</button>');
  }
  async function talkMic() {
    const c = talkCtx; if (!c) return;
    if (E.RT.listening) { E.stopListening(); return; }
    const m = $('talk-mic'); m.classList.add('on');
    const res = await E.recognize(() => {});
    m.classList.remove('on');
    if (!res.alts.length) { $('talk-hint').textContent = '没听清，再大声一点'; return; }
    const r = E.bestScore(c.line, res.alts);
    if (r.score >= 45) talkDone(); else $('talk-hint').textContent = r.score + ' 分，再清楚一点！';
  }

  // ---------- 养育屋和蛋 ----------
  // 放两只有相同属性的怪兽在养育屋，走一段路就会有蛋；蛋放在队伍里走路会孵出来
  const eggSteps = id => 250 + (SPECIES[id].rarity || 1) * 100;
  const eggHint = mon => mon.steps > eggSteps(mon.sp) * .6 ? '它好像还要很久才会孵出来。' : mon.steps > 80 ? '里面有动静了！' : '快孵出来了！它在里面动来动去。';
  function makeEgg(id) { const b = baseOf(id); return { uid: 'e' + Date.now().toString(36) + rnd(1e6).toString(36), sp: b, egg: true, steps: eggSteps(b), lv: 5, xp: 0 }; }
  function giveEgg(id) { const egg = makeEgg(id); addMon(egg); E.save(); return egg; }
  const day = () => (M().day = M().day || { mons: [], steps: 0, egg: false });
  const canBreed = (a, b) => a && b && !SPECIES[a.sp].legend && !SPECIES[b.sp].legend && SPECIES[a.sp].types.some(t => SPECIES[b.sp].types.includes(t));
  function daycareSheet() {
    const d = day(), gained = mon => Math.floor(d.steps / 100);
    const slots = d.mons.map((mon, i) => '<div class="mrow"><span class="mrow-svg">' + svgMon(mon) + '</span><div class="mrow-i"><b>' + nm(mon) + '</b> <small>Lv ' + mon.lv + (gained(mon) ? ' → Lv ' + Math.min(100, mon.lv + gained(mon)) : '') + '</small> ' + heartsHTML(mon) + '</div><div class="mrow-b"><button class="btn small" data-act="mDayTake" data-i="' + i + '">领回来</button></div></div>').join('');
    const pair = d.mons.length === 2 ? (canBreed(d.mons[0], d.mons[1]) ? '<p class="tip">💞 它们俩相处得很好（有相同的属性）。</p>' : '<p class="tip">它们俩不太合得来（没有相同的属性），不会有蛋。</p>') : '';
    const room = d.mons.length < 2, can = M().team.filter(u => byUid(u) && !byUid(u).egg).length > 1;
    const pick = room ? teamMons().filter(x => !x.egg).map(mon => monRow(mon, '<button class="btn small sun" data-act="mDayLeave" data-u="' + mon.uid + '"' + (can ? '' : ' disabled') + '>寄养</button>', true)).join('') : '';
    E.openModal('<h2>🏡 养育屋</h2><p>把两只怪兽寄养在这里，它们会跟着爷爷奶奶长大（每走 100 步长 1 级）。两只有相同属性的话，过一阵子会发现一个蛋！</p>' +
      (d.egg ? '<div class="ach"><span class="ae">🥚</span><div style="flex:1"><b>发现了一个蛋！</b><small>是它们俩留下的</small></div><button class="btn small sun" data-act="mDayEgg">收下</button></div>' : '') +
      '<h3 class="pc-h">寄养中 ' + d.mons.length + ' / 2</h3>' + (slots || '<p class="tip">还没有寄养的怪兽。</p>') + pair +
      (room ? '<h3 class="pc-h">从队伍里选一只寄养</h3>' + (can ? '' : '<p class="tip">队伍里至少要留一只能战斗的怪兽。</p>') + pick : '') +
      '<button class="btn ghost wide" data-act="close">谢谢 Thank you!</button>');
  }
  function dayLeave(u) {
    const m = M(), d = day(), mon = byUid(u);
    if (!mon || mon.egg || d.mons.length >= 2 || m.team.filter(x => byUid(x) && !byUid(x).egg).length <= 1) return;
    m.team = m.team.filter(x => x !== u); m.box = m.box.filter(x => x.uid !== u);
    d.mons.push(mon); if (d.mons.length === 1) d.steps = 0;
    E.save(); E.SFX.tap(); E.say('Please take care of ' + nm(mon) + '!');
    daycareSheet();
  }
  function dayTake(i) {
    const d = day(), mon = d.mons[i]; if (!mon) return;
    const up = Math.floor(d.steps / 100);
    if (up) { mon.lv = Math.min(100, mon.lv + up); mon.hp = null; learnAt(mon, mon.lv); }
    d.mons.splice(i, 1); if (!d.mons.length) d.steps = 0;
    addMon(mon); E.save(); E.SFX.coin();
    E.toast('🏡 ' + nm(mon) + ' 回来了' + (up ? '，长到了 Lv ' + mon.lv + '！' : '！'), 'gold');
    daycareSheet();
  }
  function dayEgg() {
    const d = day(); if (!d.egg || !d.mons.length) return;
    d.egg = false;
    giveEgg(d.mons[rnd(d.mons.length)].sp);
    E.SFX.win(); E.toast('🥚 得到了一个蛋！放在队伍里走路就会孵出来', 'gold');
    daycareSheet();
  }
  // 大地图每走一步调一次：带头的怪兽慢慢变亲、蛋慢慢孵、养育屋慢慢出蛋。返回要孵出来的蛋
  function stepHook() {
    const m = M();
    m.walk = (m.walk || 0) + 1;
    if (m.walk % 60 === 0) befriend(lead(), 1);
    const d = m.day;
    if (d && d.mons.length) { d.steps++; if (d.mons.length === 2 && !d.egg && d.steps % 180 === 0 && canBreed(d.mons[0], d.mons[1])) d.egg = true; }
    const egg = m.team.map(byUid).find(x => x && x.egg && --x.steps <= 0);
    return egg ? { hatch: egg.uid, sp: egg.sp } : null;
  }
  // 孵出来：变成 5 级的小怪兽（有机会是异色），然后起名字
  function hatch(u) {
    const egg = byUid(u); if (!egg || !egg.egg) return null;
    delete egg.egg; delete egg.steps;
    egg.lv = 5; egg.xp = 0; egg.fr = 120; egg.moves = defaultMoves(egg.sp, 5); egg.hp = null;
    if (Math.random() < 1 / 32) { egg.shiny = true; (M().shinyDex = M().shinyDex || {})[egg.sp] = 1; }
    M().dex[egg.sp] = 'caught';
    E.save();
    return egg;
  }

  // ---------- 图鉴：出没地点 ----------
  let HAB_INDEX = null;
  function habitatIndex() {
    if (HAB_INDEX) return HAB_INDEX;
    HAB_INDEX = {};
    const EM = window.EchoMaps; if (!EM) return HAB_INDEX;
    EM.all().forEach(id => {
      const mp = EM.get(id); if (!mp || mp.kind === 'inside' || mp.kind === 'town') return;
      const flat = mp.grid.map(r => r.join('')).join(''), habs = [];
      if (flat.includes(',')) habs.push([mp.kind === 'under' ? 'water' : mp.hab || (mp.kind === 'cave' ? 'cave' : 'grass'), mp.kind === 'under' ? '海草' : mp.kind === 'cave' ? '洞穴' : '草丛']);
      if (flat.includes(':')) habs.push(['cave', '洞穴']);
      if (/[~D]/.test(flat) && mp.kind !== 'under') habs.push(['water', '水上 / 钓鱼']);
      habs.forEach(([h, how]) => wildTable(mp.z, h).forEach(sp => { const L = HAB_INDEX[sp.id] = HAB_INDEX[sp.id] || []; const nmp = mp.name || mp.id; if (!L.some(x => x.name === nmp && x.how === how)) L.push({ name: nmp, how }); }));
    });
    return HAB_INDEX;
  }
  function habitatHTML(id) {
    const s = SPECIES[id], L = habitatIndex()[id];
    let txt;
    if (L && L.length) txt = L.slice(0, 5).map(x => '<b>' + E.esc(x.name) + '</b>（' + x.how + '）').join('、') + (L.length > 5 ? ' 等 ' + L.length + ' 个地方' : '');
    else if (s.legend) txt = '传说中的怪兽，只在特别的地方出现。';
    else if (s.starter) txt = '回声博士的研究所。';
    else if (s.from && SPECIES[s.from]) { const b = habitatIndex()[baseOf(id)]; txt = '由 <b>' + SPECIES[s.from].en + '</b> 进化而来' + (b && b.length ? '；' + SPECIES[baseOf(id)].en + ' 在 <b>' + E.esc(b[0].name) + '</b> 出没' : '') + '。'; }
    else txt = '在第一年的群岛上还没有发现它。';
    return '<p class="dex-hab">📍 出没地点：' + txt + '</p>';
  }

  // ---------- 我的怪兽 / 图鉴 / 回声球 ----------
  // 一只怪兽的信息行，btn 是右边的按钮
  function monRow(mon, btn, inTeam) {
    const s = SPECIES[mon.sp];
    if (mon.egg) return '<div class="mrow"><span class="mrow-svg">' + EGG_SVG + '</span><div class="mrow-i"><b>蛋 Egg</b> <small>' + eggHint(mon) + '</small>' + (inTeam ? '<div class="chips"><span class="lvchip in">队伍中</span></div>' : '') + '</div><div class="mrow-b">' + btn + '</div></div>';
    return '<div class="mrow"><span class="mrow-svg">' + svgMon(mon) + '</span><div class="mrow-i"><b>' + (mon.shiny ? '✨' : '') + nm(mon) + '</b> <small>' + (mon.nick ? s.en + ' · ' : '') + s.zh + '</small> ' + heartsHTML(mon) + '<div class="chips">' + chips(mon.sp) + '<span class="lvchip">Lv ' + mon.lv + '</span>' + (inTeam ? '<span class="lvchip in">队伍中</span>' : '') + '</div>' +
      '<small>体力 ' + curHp(mon) + ' / ' + stats(mon).hp + (curHp(mon) === 0 ? ' · 累倒了' : mon.st ? ' · ' + STATUS[mon.st].zh : '') + '</small>' +
      '<div class="xpbar"><i style="width:' + (mon.xp / xpNeed(mon.lv) * 100) + '%"></i></div></div><div class="mrow-b"><button class="btn small ghost" data-act="mSum" data-u="' + mon.uid + '">详情</button>' + btn + '</div></div>';
  }
  const teamMons = () => M().team.map(byUid).filter(Boolean);
  const boxMons = () => M().box.filter(x => !M().team.includes(x.uid)).sort((a, b) => b.lv - a.lv);
  // 电脑箱子：8 个箱子，每个 30 只
  const BOXES = 8, BOX_CAP = 30;
  const inBox = k => M().box.filter(x => !M().team.includes(x.uid) && (x.bx || 0) === k);
  const freeBox = () => { for (let k = 0; k < BOXES; k++) if (inBox(k).length < BOX_CAP) return k; return BOXES - 1; };
  // 新怪兽（收服的、孵出来的、蛋）：队伍没满放队伍，满了放第一个有空位的箱子
  function addMon(mon) {
    const m = M();
    m.box.push(mon);
    if (m.team.length < TEAM_MAX) m.team.push(mon.uid); else mon.bx = freeBox();
  }
  // 队伍：看状态、换主力。存进箱子 / 从箱子取出要去怪兽中心的电脑
  function teamSheet() {
    const rows = teamMons().map((mon, k) => monRow(mon, k === 0 ? '<span class="lead-tag">⭐ 主力</span>' : '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '">设为主力</button>', true)).join('');
    const nb = boxMons().length;
    E.openModal('<h2>我的队伍 ' + teamMons().length + ' / ' + TEAM_MAX + '</h2><p>主力先出场，倒下后队友自动接上。</p>' + rows +
      (nb ? '<p class="tip">💻 电脑箱子里还有 ' + nb + ' 只怪兽，去怪兽中心的电脑可以换进队伍。</p>' : '') +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  // 怪兽中心的电脑：队伍和箱子互相换
  function pcSheet(k) {
    const m = M();
    if (k != null) m.pcBox = Math.max(0, Math.min(BOXES - 1, k));
    const cur = m.pcBox || 0, sortBy = m.pcSort || 'lv';
    const full = m.team.length >= TEAM_MAX, one = m.team.filter(u => byUid(u) && !byUid(u).egg).length <= 1;
    const team = teamMons().map((mon, i) => monRow(mon, (i ? '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '" data-pc="1">设为主力</button>' : '<span class="lead-tag">⭐ 主力</span>') +
      '<button class="btn small ghost" data-act="mBench" data-u="' + mon.uid + '" data-pc="1"' + (one && !mon.egg ? ' disabled' : '') + '>存进箱子</button>', true)).join('');
    const sorter = { lv: (a, b) => b.lv - a.lv, no: (a, b) => SPECIES[a.sp].no - SPECIES[b.sp].no, name: (a, b) => nm(a).localeCompare(nm(b)) }[sortBy];
    const list = inBox(cur).sort(sorter).map(mon => monRow(mon, '<button class="btn small sun" data-act="mJoin" data-u="' + mon.uid + '" data-pc="1"' + (full ? ' disabled' : '') + '>放进队伍</button><button class="btn small ghost" data-act="mMoveAsk" data-u="' + mon.uid + '">搬到…</button>', false)).join('');
    const tabs = '<div class="pc-tabs">' + Array.from({ length: BOXES }, (_, i) => '<button class="btn small ' + (i === cur ? 'sun' : 'ghost') + '" data-act="mBox" data-b="' + i + '">' + (i + 1) + '<small>' + inBox(i).length + '</small></button>').join('') + '</div>';
    const sorts = '<div class="pc-sort">排序：' + [['lv', '等级'], ['no', '编号'], ['name', '名字']].map(([k2, zh]) => '<button class="link' + (k2 === sortBy ? ' on' : '') + '" data-act="mPcSort" data-k="' + k2 + '">' + zh + '</button>').join(' · ') + '</div>';
    E.openModal('<h2>💻 怪兽箱子</h2><p>队伍最多 ' + TEAM_MAX + ' 只；8 个箱子，每个放 ' + BOX_CAP + ' 只。' + (full ? '队伍满了，先存一只进箱子再取。' : '') + '</p><h3 class="pc-h">队伍 ' + m.team.length + ' / ' + TEAM_MAX + '</h3>' + team +
      '<h3 class="pc-h">箱子 ' + (cur + 1) + ' Box ' + (cur + 1) + '（' + inBox(cur).length + ' / ' + BOX_CAP + '）</h3>' + tabs + sorts + (list || '<p class="tip">这个箱子是空的。</p>') +
      '<button class="btn ghost wide" data-act="close">关闭电脑</button>');
  }
  function moveAsk(u) {
    const mon = byUid(u); if (!mon) return;
    E.openModal('<h2>把 ' + nm(mon) + ' 搬到哪个箱子？</h2><div class="pc-tabs">' + Array.from({ length: BOXES }, (_, i) => '<button class="btn ' + ((mon.bx || 0) === i ? 'sun' : 'ghost') + '" data-act="mMoveTo" data-u="' + u + '" data-b="' + i + '"' + (inBox(i).length >= BOX_CAP ? ' disabled' : '') + '>箱子 ' + (i + 1) + '<small>' + inBox(i).length + '/' + BOX_CAP + '</small></button>').join('') + '</div><button class="btn ghost wide" data-act="mPc">返回</button>');
  }

  // 背包：在大地图上用回复道具、驱怪喷雾、逃生绳
  function bagSheet() {
    const rows = BAG_ORDER.map(id => {
      const it = ITEMS[id], n = itemCount(id);
      if (!n && id !== 'ball' && id !== 'potion') return '';
      let use = '';
      if (id === 'expshare') use = '<button class="btn small ' + (M().expShareOn !== false ? 'sun' : 'ghost') + '" data-act="mExpShare">' + (M().expShareOn !== false ? '开着' : '关着') + '</button>';
      else if (id === 'dowsing') use = '<button class="btn small ' + (M().dowseOn !== false ? 'sun' : 'ghost') + '" data-act="mDowse">' + (M().dowseOn !== false ? '开着' : '关着') + '</button>';
      else if (id === 'bike') use = '<button class="btn small" data-act="mUse" data-id="bike"' + (FH && FH.inWorld() ? '' : ' disabled') + '>骑</button>';
      else if (it.key) use = '';
      else if (STATUS_HEAL[id]) use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>用</button>';
      else if (it.stone) use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>用</button>';
      else if (it.heal || id === 'revive') use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>用</button>';
      else if (id === 'repel') use = '<button class="btn small" data-act="mUse" data-id="repel"' + (n && FH && FH.inWorld() ? '' : ' disabled') + '>用</button>';
      else if (id === 'rope') use = '<button class="btn small" data-act="mUse" data-id="rope"' + (n && FH && FH.canRope() ? '' : ' disabled') + '>用</button>';
      return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + it.zh + ' ×' + n + '</b><small>' + it.desc + ' · ' + it.en + '</small></div>' + use + '</div>';
    }).join('');
    E.openModal('<h2>🎒 背包</h2><p>💰 ' + E.S.coins + ' 金币 · 道具可以在商店买，也可以在路上捡</p>' + rows + '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  // 选一只怪兽用回复道具
  function useItem(id) {
    const it = ITEMS[id];
    if (itemCount(id) <= 0) return;
    if (id === 'repel') { addItem(id, -1); E.save(); E.closeModal(); FH && FH.repel(); return; }
    if (id === 'rope') { addItem(id, -1); E.save(); FH && FH.rope(); return; }
    if (id === 'bike') { FH && FH.bike(); return; }
    const rows = teamMons().map(mon => {
      const max = stats(mon).hp, hp = curHp(mon), ok = STATUS_HEAL[id] ? STATUS_HEAL[id].includes(mon.st) : it.stone ? !!itemEvo(mon, id) : id === 'revive' ? hp === 0 : hp > 0 && hp < max;
      return monRow(mon, '<button class="btn small sun" data-act="mUseOn" data-id="' + id + '" data-u="' + mon.uid + '"' + (ok ? '' : ' disabled') + '>' + it.icon + ' 用</button>', true);
    }).join('');
    E.openModal('<h2>' + it.icon + ' ' + it.zh + ' 给谁用？</h2><p>' + it.desc + '</p>' + rows + '<button class="btn ghost wide" data-act="mBag">返回背包</button>');
  }
  function useItemOn(id, u) {
    const mon = byUid(u), it = ITEMS[id];
    if (!mon || itemCount(id) <= 0) return;
    const max = stats(mon).hp, hp = curHp(mon);
    if (STATUS_HEAL[id]) { if (!STATUS_HEAL[id].includes(mon.st)) return; mon.st = null; addItem(id, -1); E.save(); E.SFX.coin(); E.toast(it.icon + ' ' + nm(mon) + ' 恢复正常了', 'gold'); if (itemCount(id) > 0) useItem(id); else bagSheet(); return; }
    if (it.stone) { const ev = itemEvo(mon, id); if (!ev) return; addItem(id, -1); E.closeModal(); evolveTo(mon, ev.to); return; }
    if (id === 'revive') { if (hp > 0) return; mon.hp = Math.round(max / 2); }
    else { if (hp === 0 || hp >= max) return; mon.hp = Math.min(max, hp + Math.max(20, Math.round(max * it.heal))); }
    addItem(id, -1);
    E.save(); E.SFX.coin();
    E.toast(it.icon + ' ' + nm(mon) + ' 恢复了体力', 'gold');
    E.say(nm(mon) + ' feels better!');
    if (itemCount(id) > 0) useItem(id); else bagSheet();
  }
  // 图鉴：每页 24 只，点开看详情（英文图鉴 + 中文 + 进化路线）
  const DEX_PAGE = 24;
  let dexPage = 0;
  function dexSheet(pg) {
    const m = M(), pages = Math.ceil(ORDER.length / DEX_PAGE);
    if (pg != null) dexPage = Math.max(0, Math.min(pages - 1, pg));
    const ids = ORDER.slice(dexPage * DEX_PAGE, dexPage * DEX_PAGE + DEX_PAGE);
    const nav = '<div class="dex-nav"><button class="btn small ghost" data-act="mDexPage" data-p="' + (dexPage - 1) + '"' + (dexPage ? '' : ' disabled') + '>◀</button><span>' + (dexPage * DEX_PAGE + 1) + '–' + Math.min(ORDER.length, dexPage * DEX_PAGE + DEX_PAGE) + ' 号</span><button class="btn small ghost" data-act="mDexPage" data-p="' + (dexPage + 1) + '"' + (dexPage < pages - 1 ? '' : ' disabled') + '>▶</button></div>';
    E.openModal('<h2>怪兽图鉴 ' + caughtN() + ' / ' + ORDER.length + '</h2><p>收服或进化就能点亮，遇到过的会显示影子。点一只看它的图鉴。</p>' + nav + '<div class="dex">' + ids.map(id => {
      const s = SPECIES[id], st = m.dex[id];
      return '<button class="dex-i ' + (st || 'none') + '" data-act="mDexOne" data-sp="' + id + '"' + (st ? '' : ' disabled') + '><span class="dex-no">' + String(s.no).padStart(3, '0') + ((m.shinyDex || {})[id] ? ' ✨' : '') + '</span><span class="dex-svg">' + (st ? svg(id) : '') + '</span><b>' + (st ? s.en : '???') + '</b><small>' + (st === 'caught' ? s.zh : st ? '见过' : '未发现') + '</small></button>';
    }).join('') + '</div>' + nav + '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function dexOne(id) {
    const s = SPECIES[id], st = M().dex[id], esc = E.esc;
    if (!st) return;
    const chain = [];
    let root = s; while (root.from) root = SPECIES[root.from];
    const walk = (x, depth) => { chain.push({ x, depth }); (x.evo || []).forEach(e => walk(SPECIES[e.to], depth + 1)); };
    walk(root, 0);
    const how = x => { const f = x.from && (SPECIES[x.from].evo || []).find(e => e.to === x.id); return f ? (f.lv ? 'Lv ' + f.lv : D.STONES[f.item] ? D.STONES[f.item].zh : '') : ''; };
    E.openModal('<div class="dex-big">' + svg(id) + '</div><h2>No.' + s.no + ' ' + s.en + '（' + (st === 'caught' ? s.zh : '？') + '）</h2><div class="chips" style="justify-content:center">' + chips(id) + (s.legend ? '<span class="lvchip">传说</span>' : '') + '</div>' +
      (st === 'caught' ? '<p class="dex-en">' + esc(s.dexEn) + ' <button class="spk mini" data-act="mSayDex" data-sp="' + id + '" aria-label="听">' + E.SPK + '</button></p><p class="dex-zh">' + esc(s.dexZh) + '</p>' +
        (s.words && s.words.length ? '<p class="tip">名字里的英语：' + s.words.map(w => '<b>' + esc(w) + '</b>').join(' + ') + '</p>' : '') : '<p class="tip">收服它就能看到完整的图鉴。</p>') +
      habitatHTML(id) +
      (chain.length > 1 ? '<div class="dex-chain">' + chain.map(c => { const k = M().dex[c.x.id]; return '<span class="dc' + (c.x.id === id ? ' on' : '') + '">' + (c.depth ? '<i>' + how(c.x) + ' →</i>' : '') + '<span class="dc-svg">' + (k ? svg(c.x.id) : '') + '</span><small>' + (k ? c.x.en : '???') + '</small></span>'; }).join('') + '</div>' : '') +
      '<div class="row"><button class="btn ghost" data-act="mDex">返回图鉴</button><button class="btn ghost" data-act="close">关闭</button></div>');
    if (st === 'caught') E.say(s.en);
  }
  function ballSheet() {
    E.openModal('<div class="big">🔮</div><h2>回声球 × ' + M().balls + '</h2><p>把野生怪兽打虚弱后，扔回声球并念出收服咒语，就能收服它。<br>在「📚 闯关练习」每通关一关送 1 个，三星送 2 个；打败馆主送 3 个。</p>' +
      '<div class="row"><button class="btn ghost" data-act="close">关闭</button><button class="btn sun" data-act="mBuyBalls"' + (E.S.coins < 30 ? ' disabled' : '') + '>30 金币买 3 个</button></div>');
  }

  // ---------- 对外 ----------
  const num = (t, k) => +t.dataset[k];
  const actions = {
    mStarter: t => starterSheet(t.dataset.sp),
    mStarterMic: t => starterMic(t.dataset.sp),
    mStarterGo: t => takeStarter(t.dataset.sp),
    mSayName: t => E.say(SPECIES[t.dataset.sp].en),
    mWild: t => startBattle('wild', num(t, 'z')),
    mLeader: t => startBattle('leader', num(t, 'z')),
    mTeam: teamSheet,
    mDex: () => dexSheet(),
    mDexPage: t => dexSheet(+t.dataset.p),
    mDexOne: t => dexOne(t.dataset.sp),
    mSayDex: t => E.say(SPECIES[t.dataset.sp].dexEn),
    mBalls: ballSheet,
    mBuyBalls: () => { if (E.S.coins < 30) return; E.S.coins -= 30; M().balls += 3; E.save(); E.SFX.coin(); E.renderTop(); E.renderHome(); ballSheet(); },
    mLead: t => { const m = M(); m.team = [t.dataset.u, ...m.team.filter(u => u !== t.dataset.u)]; E.save(); t.dataset.pc ? pcSheet() : teamSheet(); E.renderHome(); },
    mJoin: t => { const m = M(); if (m.team.length < TEAM_MAX && !m.team.includes(t.dataset.u)) m.team.push(t.dataset.u); E.save(); E.SFX.tap(); pcSheet(); },
    mBench: t => { const m = M(), mon = byUid(t.dataset.u); if (mon && (mon.egg || m.team.filter(u => byUid(u) && !byUid(u).egg).length > 1)) { m.team = m.team.filter(u => u !== t.dataset.u); mon.bx = inBox(m.pcBox || 0).length < BOX_CAP ? (m.pcBox || 0) : freeBox(); } E.save(); E.SFX.tap(); pcSheet(); E.renderHome(); },
    mBag: bagSheet,
    mUse: t => useItem(t.dataset.id),
    mUseOn: t => useItemOn(t.dataset.id, t.dataset.u),
    bBag: battleBag,
    bUse: t => usePotion(t.dataset.id),
    mEvoOk: () => { E.closeModal(); E.renderHome(); afterBattleQueue(); },
    mSum: t => summarySheet(t.dataset.u),
    mPc: () => pcSheet(),
    mBox: t => pcSheet(+t.dataset.b),
    mPcSort: t => { M().pcSort = t.dataset.k; E.save(); pcSheet(); },
    mMoveAsk: t => moveAsk(t.dataset.u),
    mMoveTo: t => { const mon = byUid(t.dataset.u); if (mon && inBox(+t.dataset.b).length < BOX_CAP) { mon.bx = +t.dataset.b; E.save(); E.SFX.tap(); } pcSheet(); },
    mNick: t => nickSheet(t.dataset.u, 'sum'),
    mNickPick: t => nickSay(t.dataset.n),
    mNickOwn: () => { const v = (($('nick-in') || {}).value || '').trim(); if (!/^[A-Za-z][A-Za-z]{0,9}$/.test(v)) { const tip = $('nick-tip'); if (tip) tip.textContent = '要用英文字母写哦，比如 Kiki'; return; } nickSay(v[0].toUpperCase() + v.slice(1).toLowerCase()); },
    mNickGo: () => nickDone(true),
    mNickMic: () => nickMic(),
    mNickHear: () => nickCtx && E.say('Your name is ' + nickCtx.name + '!', .8),
    mNickBack: () => nickCtx && nickSheet(nickCtx.u, nickCtx.then),
    mNickSkip: () => nickDone(false),
    mNickClear: () => { if (nickCtx) { nickCtx.name = SPECIES[byUid(nickCtx.u).sp].en; nickDone(true); } },
    mTalk: t => talkSheet(t.dataset.u, 'sum'),
    mTalkGo: () => talkDone(),
    mTalkMic: () => talkMic(),
    mTalkHear: () => talkCtx && talkCtx.line && E.say(talkCtx.line, .8),
    mTalkBack: t => { const c = talkCtx; talkCtx = null; if (c && c.then === 'sum') summarySheet(t.dataset.u); else E.closeModal(); },
    mDayLeave: t => dayLeave(t.dataset.u),
    mDayTake: t => dayTake(+t.dataset.i),
    mDayEgg: () => dayEgg(),
    mForget: t => forget(+t.dataset.k),
    mLearnGo: t => learnDone(+t.dataset.k),
    mLearnMic: t => learnMic(+t.dataset.k),
    mHearLearn: () => { const it = (M().pendingLearn || [])[0]; if (it) E.say(nm(byUid(it.u)) + ', learn ' + mvName(parseMove(it.id))[0] + '!', .8); },
    mExpShare: () => { M().expShareOn = M().expShareOn === false; E.save(); bagSheet(); },
    mDowse: () => { M().dowseOn = M().dowseOn === false; E.save(); bagSheet(); },
    bSwitch: switchSheet,
    bSwitchTo: t => doSwitch(+t.dataset.k),
    bMove: t => onMove(num(t, 'i')),
    bCatch: t => onCatch(t && t.dataset && t.dataset.ball),
    bMic: onMic,
    bOpt: t => onOpt(num(t, 'i')),
    bRate: t => onRate(num(t, 'v')),
    bHint: () => { if (!B || B.turn !== 'task') return; B.hinted = true; const s = $('b-say'); if (s) { s.classList.remove('mask'); s.innerHTML = E.wordsHTML(B.task.target); } E.say(B.task.target); },
    bHear: () => B && B.task && E.say(B.task.target, 0.8),
    bHearQ: () => B && B.task && E.say(B.task.prompt, undefined, 'm'),
    bBack: () => { if (B && B.turn === 'task') { E.stopListening(); menu(); } },
    bDef: t => defend(num(t, 'i')),
    bDefHear: () => B && B.def && E.say(B.def.spell, 0.8, 'm'),
    bPotion: () => usePotion('potion'),
    bEnd: () => { if (!B) return; const cb = B.onEnd, res = B.result || 'flee'; E.closeModal(); writeBack(); stopBattle(); if (cb) cb(res); setTimeout(afterBattleQueue, 500); },
    bFlee: () => {
      if (!B || B.turn === 'done') { B && B.onEnd ? actions.bEnd() : actions.bHome(); return; }
      E.openModal('<h2>' + (B.kind === 'wild' ? '要逃跑吗？' : '要放弃挑战吗？') + '</h2><p>这场战斗不会有奖励。</p><div class="row"><button class="btn ghost" data-act="' + (B.onEnd ? 'bEnd' : 'bHome') + '">离开</button><button class="btn" data-act="close" data-focus>继续战斗</button></div>');
    },
    bHome: () => { E.closeModal(); writeBack(); stopBattle(); E.goHome('mon'); },
  };

  window.MonsterGame = {
    init(api) { E = api; return actions; },
    fresh: () => ({ box: [], team: [], dex: {}, badges: {}, balls: 5, potions: 2, bag: {}, wins: 0, caught: 0, evolved: 0 }),
    // 老存档：队伍从 3 只扩到 6 只，把箱子里等级最高的先补进队伍
    migrate() {
      const m = M();
      (m.box || []).forEach(ensureMoves);
      // 箱子里异色怪兽的 2D 图标先转好色（菜单、图鉴、队伍打开时就是异色）
      if (window.Mon3D && Mon3D.prepIcons) Mon3D.prepIcons((m.box || []).filter(x => x.shiny && !x.egg && SPECIES[x.sp]).map(spOf));
      if (m.v === 2) return;
      m.v = 2;
      m.bag = m.bag || {};
      boxMons().slice(0, Math.max(0, TEAM_MAX - m.team.length)).forEach(x => m.team.push(x.uid));
      E.save();
    },
    setFieldHooks: h => { FH = h; },
    STARTERS, STRONG, grown,
    // 按属性配一队怪兽（反派、大师、冠军用）：同一个 seed 每次都一样，等级够了就是进化形态
    teamOf(types, n, lv, seed) {
      let pool = D.list.filter(s => !s.legend && !s.starter && s.stage === 1 && s.no <= 251 && s.types.some(t => types.includes(t)));
      if (!pool.length) pool = REGION1.filter(s => s.stage === 1);
      pool = pool.slice().sort((a, b) => hash(seed, a.id) - hash(seed, b.id));
      return Array.from({ length: n }, (_, k) => { const l = lv + k; return newMon(grown(pool[k % pool.length].id, l + 2), l); });
    },
    species: id => SPECIES[id],
    newMon,
    // 开场剧情里从博士的包里选的伙伴
    giveStarter(id) {
      const m = M();
      if (m.box.length) return null;
      const mon = newMon(id, 5);
      m.box.push(mon); m.team = [mon.uid]; m.dex[id] = 'caught';
      E.save();
      return mon;
    },
    ITEMS, itemCount, addItem, pcSheet, bagSheet, learnset, parseMove, stats,
    homeHTML,
    stop: () => { writeBack(); stopBattle(); },
    battle: startBattle,
    trainerFoes,
    healAll,
    anyAlive,
    leadSpecies: () => { const L = lead(); return L ? spOf(L) : null; },
    preloadTeam,
    lead: () => lead(),
    nm, spOf, hearts, befriend, talkSheet, nickSheet, daycareSheet, stepHook, hatch, giveEgg, makeEgg,
    habitats: id => habitatIndex()[id] || [],
    zoneLv,
    afterHome: () => setTimeout(afterBattleQueue, 400),
    caughtCount: s => ORDER.filter(id => s.mon.dex[id] === 'caught').length,
    total: ORDER.length,
  };
})();
