// 回声岛 · 怪兽对战：用英语念咒语攻击，听懂对手的咒语来防御，收服、升级、进化
(function () {
  'use strict';

  // ---------- 怪兽图鉴 ----------
  const TYPES = {
    fire: { zh: '火', icon: '🔥', color: '#f0642f' },
    water: { zh: '水', icon: '💧', color: '#2f8fdd' },
    grass: { zh: '草', icon: '🍃', color: '#3fa34d' },
    spark: { zh: '电', icon: '⚡', color: '#d9a000' },
  };
  const SPECIES = {
    emberpup: { en: 'Emberpup', zh: '火苗狗', type: 'fire', color: '#ff8a4c', belly: '#ffe0b2', shape: 'round', ears: 'dog', tail: 'flame', hp: 38, atk: 11, evo: 'blazehound' },
    blazehound: { en: 'Blazehound', zh: '烈焰犬', type: 'fire', color: '#e8532f', belly: '#ffd59e', shape: 'tall', ears: 'cat', tail: 'flame', extra: 'mane', accent: '#ffca28', hp: 52, atk: 15, stage: 2 },
    cindercat: { en: 'Cindercat', zh: '火花猫', type: 'fire', color: '#ffb347', belly: '#fff1d6', shape: 'round', ears: 'cat', tail: 'flame', hp: 36, atk: 12, evo: 'pyrolynx' },
    pyrolynx: { en: 'Pyrolynx', zh: '炎山猫', type: 'fire', color: '#f76b1c', belly: '#ffe0b2', shape: 'tall', ears: 'cat', tail: 'flame', extra: 'horn', accent: '#fff3c4', hp: 50, atk: 16, stage: 2 },
    bubbly: { en: 'Bubbly', zh: '泡泡鱼', type: 'water', color: '#4fc3f7', belly: '#e1f5fe', shape: 'round', ears: 'fin', tail: 'fin', hp: 46, atk: 9, evo: 'tidalfin' },
    tidalfin: { en: 'Tidalfin', zh: '潮汐鳍', type: 'water', color: '#1e88e5', belly: '#bbdefb', shape: 'wide', ears: 'fin', tail: 'fin', extra: 'crown', accent: '#ffd54f', hp: 62, atk: 13, stage: 2 },
    drizzle: { en: 'Drizzle', zh: '雨滴精', type: 'water', color: '#80deea', belly: '#e0f7fa', shape: 'tall', ears: 'round', tail: 'none', hp: 44, atk: 10, evo: 'torrent' },
    torrent: { en: 'Torrent', zh: '激流精', type: 'water', color: '#26a69a', belly: '#b2dfdb', shape: 'tall', ears: 'round', tail: 'fin', extra: 'wings', hp: 58, atk: 14, stage: 2 },
    sprouty: { en: 'Sprouty', zh: '小芽芽', type: 'grass', color: '#8bc34a', belly: '#f1f8e9', shape: 'round', ears: 'leaf', tail: 'leaf', hp: 42, atk: 10, evo: 'bloomtail' },
    bloomtail: { en: 'Bloomtail', zh: '花尾兽', type: 'grass', color: '#43a047', belly: '#dcedc8', shape: 'tall', ears: 'leaf', tail: 'leaf', extra: 'crown', accent: '#f48fb1', hp: 56, atk: 14, stage: 2 },
    mossbear: { en: 'Mossbear', zh: '苔藓熊', type: 'grass', color: '#9ccc65', belly: '#f1f8e9', shape: 'wide', ears: 'round', tail: 'none', hp: 48, atk: 9, evo: 'oakbear' },
    oakbear: { en: 'Oakbear', zh: '橡树熊', type: 'grass', color: '#558b2f', belly: '#dcedc8', shape: 'wide', ears: 'round', tail: 'leaf', extra: 'horn', accent: '#a1887f', hp: 64, atk: 13, stage: 2 },
    zappy: { en: 'Zappy', zh: '电电鼠', type: 'spark', color: '#ffd54f', belly: '#fff8e1', shape: 'round', ears: 'round', tail: 'bolt', hp: 34, atk: 12, evo: 'voltmouse' },
    voltmouse: { en: 'Voltmouse', zh: '伏特鼠', type: 'spark', color: '#ffb300', belly: '#fff3c4', shape: 'tall', ears: 'cat', tail: 'bolt', extra: 'mane', accent: '#fff176', hp: 48, atk: 17, stage: 2 },
    buzzbee: { en: 'Buzzbee', zh: '雷蜂', type: 'spark', color: '#fdd835', belly: '#fffde7', shape: 'round', ears: 'antenna', tail: 'none', extra: 'wings', accent: '#5d4037', hp: 32, atk: 13, evo: 'thunderwing' },
    thunderwing: { en: 'Thunderwing', zh: '雷翼', type: 'spark', color: '#f9a825', belly: '#fff8e1', shape: 'tall', ears: 'antenna', tail: 'bolt', extra: 'wings', accent: '#5d4037', hp: 46, atk: 18, stage: 2 },
  };
  const ORDER = Object.keys(SPECIES);
  const STARTERS = ['emberpup', 'bubbly', 'sprouty'];
  const WILD = ['cindercat', 'drizzle', 'mossbear', 'zappy', 'buzzbee'];
  const EVO_LV = 10;
  const MOVES = {
    fire: [['Ember Bite', '火花咬'], ['Flame Wave', '火焰波'], ['Inferno Blast', '烈焰爆破']],
    water: [['Bubble Shot', '泡泡弹'], ['Tidal Wave', '潮汐浪'], ['Hydro Storm', '水龙卷']],
    grass: [['Leaf Cut', '飞叶切'], ['Vine Whip', '藤鞭'], ['Solar Bloom', '阳光花爆']],
    spark: [['Spark Zap', '电火花'], ['Thunder Bolt', '十万伏特'], ['Storm Strike', '雷暴']],
  };
  const POWER = [1.0, 1.6, 2.6];
  const TASK = ['🗣 说单词', '📜 念句子', '💬 对话大招'];
  const DOTS = ['●○○', '●●○', '●●●'];
  const STRONG = { fire: ['grass'], grass: ['water', 'spark'], water: ['fire'], spark: ['water'] };
  const eff = (a, d) => STRONG[a].includes(d) ? 1.5 : STRONG[d].includes(a) ? 0.5 : 1;
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
  const BAG_ORDER = ['ball', 'superball', 'potion', 'superpotion', 'revive', 'repel', 'rope'];
  function itemCount(id) { const m = M(); return id === 'ball' ? m.balls : id === 'potion' ? (m.potions || 0) : ((m.bag || {})[id] || 0); }
  function addItem(id, n) {
    const m = M();
    if (id === 'ball') m.balls += n;
    else if (id === 'potion') m.potions = (m.potions || 0) + n;
    else { m.bag = m.bag || {}; m.bag[id] = Math.max(0, (m.bag[id] || 0) + n); }
  }
  let FH = null; // 大地图提供的道具效果（驱怪喷雾、逃生绳）

  const stats = m => { const s = SPECIES[m.sp]; return { hp: s.hp + m.lv * 6, atk: s.atk + m.lv * 2 }; };
  const xpNeed = lv => lv * 20;
  const zoneLv = z => 2 + z * 2;
  const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newMon = (sp, lv) => ({ uid: uid(), sp, lv, xp: 0 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let E = null;   // game.js 提供的工具
  let B = null;   // 当前战斗
  const live = b => B === b && !b.over;
  const M = () => E.S.mon;
  const svg = sp => window.Cartoon ? Cartoon.monster(SPECIES[sp]) : '<span style="font-size:60px">' + TYPES[SPECIES[sp].type].icon + '</span>';
  // 属性小图标（SVG，不依赖手机的 emoji 字体）
  const TICON = {
    fire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-1-3 0-6.5 1-9.5z" fill="currentColor"/></svg>',
    water: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C9 7 6 10.5 6 14a6 6 0 0 0 12 0c0-3.5-3-7-6-11.5z" fill="currentColor"/></svg>',
    grass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4C10 4 4 9 4 16c0 1.5.3 2.8.8 4 1-4 4-8 9-10-4 3-6.5 6.5-7.5 10.5C15 21 20 14 20 4z" fill="currentColor"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor"/></svg>',
  };
  const tchip = t => '<span class="tchip" style="--tc:' + TYPES[t].color + '">' + TICON[t] + TYPES[t].zh + '系</span>';
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
  const lead = () => byUid(M().team[0]) || M().box[0];
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
    let h = '<section class="mon-card lead" style="--tc:' + TYPES[s.type].color + '"><div class="lead-mon">' + svg(L.sp) + '</div><div class="lead-info">' +
      '<div class="lead-name"><b>' + s.en + '</b><span>' + s.zh + '</span></div>' +
      '<div class="chips">' + tchip(s.type) + '<span class="lvchip">Lv ' + L.lv + '</span></div>' +
      '<div class="xpbar"><i style="width:' + (L.xp / xpNeed(L.lv) * 100) + '%"></i></div>' +
      '<small>HP ' + st.hp + ' · 攻击 ' + st.atk + (s.evo ? ' · Lv ' + EVO_LV + ' 会进化' : '') + '</small></div>' +
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
  function wildFoe(z, bonus) {
    let sp = Math.random() < 0.08 ? pick(STARTERS) : Math.random() < 0.45 ? WILD[z % WILD.length] : pick(WILD);
    const lv = zoneLv(z) + (bonus || 0) + rnd(3);
    if (lv >= EVO_LV && SPECIES[sp].evo && Math.random() < 0.5) sp = SPECIES[sp].evo;
    return newMon(sp, lv);
  }
  function leaderFoes(z) {
    const pool = WILD.concat(STARTERS), lv = zoneLv(z) + 2;
    return [pool[(z * 2) % pool.length], pool[(z * 2 + 1) % pool.length]].map((sp, k) => {
      const l = lv + k;
      return newMon(l >= EVO_LV && SPECIES[sp].evo ? SPECIES[sp].evo : sp, l);
    });
  }
  const me = () => byUid(B.team[B.ti]);
  const foe = () => B.foes[B.fi];

  const curHp = mon => { const max = stats(mon).hp; return mon.hp == null ? max : Math.max(0, Math.min(max, mon.hp)); };
  const anyAlive = () => M().team.some(u => { const m = byUid(u); return m && curHp(m) > 0; });
  function healAll() { M().box.forEach(m => { m.hp = stats(m).hp; }); E.save(); }
  // 训练师的怪兽：按区域和编号固定，等级够了自动是进化形态
  function trainerFoes(z, seed, count, lv) {
    const pool = WILD.concat(STARTERS);
    return Array.from({ length: count }, (_, k) => {
      const sp = pool[(z * 3 + seed * 5 + k) % pool.length], l = lv + k;
      return newMon(l >= EVO_LV && SPECIES[sp].evo ? SPECIES[sp].evo : sp, l);
    });
  }
  // 把战斗里的体力写回存档（体力会一直保留，到怪兽中心才恢复）
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
    const team = M().team.filter(byUid);
    const foes = opts.foes || (kind === 'wild' ? [wildFoe(z, opts.lvBonus)] : leaderFoes(z));
    const ti = team.findIndex(u => curHp(byUid(u)) > 0);
    B = { kind, z, foes, fi: 0, team, ti, hp: {}, energy: 0, turn: 'intro', over: false, used: new Set([team[ti]]), task: null, tries: 0, onEnd: opts.onEnd, trainer: opts.trainer, result: '', noCatch: !!opts.noCatch };
    team.forEach(u => { B.hp[u] = curHp(byUid(u)); });
    B.foeHp = stats(foes[0]).hp;
    B.enter = 'both';
    foes.forEach(f => { if (M().dex[f.sp] !== 'caught') M().dex[f.sp] = 'seen'; });
    E.save();
    E.show('battle');
    renderBattle();
    intro(B);
    return true;
  }
  function stopBattle() {
    if (!B) return;
    B.over = true;
    clearTimeout(B.defTimer);
    E.stopListening();
    B = null;
  }
  function renderBattle() {
    const w = E.W[B.z], f = foe(), m = me(), sf = SPECIES[f.sp], sm = SPECIES[m.sp];
    $('battle').innerHTML =
      '<div class="p-top"><button class="x" data-act="bFlee" aria-label="离开战斗">✕</button><div class="th-title"><b>' + (B.kind === 'wild' ? '野外对战' : B.kind === 'trainer' ? '训练师 ' + B.trainer.name : '道馆馆主 ' + w.boss.name) + '</b><small>第 ' + (B.z + 1) + ' 区 · ' + w.name + '</small></div><span class="b-energy" id="b-energy" title="能量，攒满 3 格可以放大招"></span></div>' +
      '<div class="arena" id="b-arena" style="--wc:' + w.color + '">' + arenaBG(B.z) +
      '<div class="hpcard foe"><div class="hp-top"><b>' + sf.en + '</b><span class="hp-lv">Lv' + f.lv + '</span></div>' + tchip(sf.type) + '<div class="hprow"><span class="hplab">HP</span><div class="hpbar"><i id="b-foehp"></i></div></div>' +
      (B.kind !== 'wild' ? '<div class="balls">' + B.foes.map((x, i) => '<span class="' + (i < B.fi ? 'down' : '') + '">●</span>').join('') + '</div>' : '') + '</div>' +
      '<div class="pad foe"></div><div class="mon foe' + (B.enter === 'both' || B.enter === 'foe' ? ' enter' : '') + '" id="b-foe">' + svg(f.sp) + '</div>' +
      '<div class="pad me"></div><div class="mon me' + (B.enter === 'both' || B.enter === 'me' ? ' enter' : '') + '" id="b-me">' + svg(m.sp) + '</div>' +
      '<div class="hpcard me"><div class="hp-top"><b>' + sm.en + '</b><span class="hp-lv">Lv' + m.lv + '</span></div>' + tchip(sm.type) + '<div class="hprow"><span class="hplab">HP</span><div class="hpbar"><i id="b-myhp"></i></div></div><small id="b-myhpn"></small>' +
      '<div class="expbar" title="经验"><i id="b-exp" style="width:' + (m.xp / xpNeed(m.lv) * 100) + '%"></i></div></div>' +
      (B.kind !== 'wild' ? '<div class="trainer">' + (B.kind === 'trainer' && B.trainer.img ? '<img src="' + B.trainer.img + '" alt="">' : '<span>' + w.boss.emoji + '</span>') + '</div>' : '') +
      '</div><div class="b-msg" id="b-msg"></div><div class="b-panel" id="b-panel"></div>';
    B.enter = '';
    updHp();
  }
  function updHp() {
    const f = foe(), m = me();
    const fmax = stats(f).hp, mmax = stats(m).hp, fh = Math.max(0, B.foeHp), mh = Math.max(0, B.hp[m.uid]);
    const bar = (id, v, max) => { const e = $(id); if (!e) return; const p = v / max; e.style.width = (p * 100) + '%'; e.className = p > .5 ? '' : p > .2 ? 'mid' : 'low'; };
    bar('b-foehp', fh, fmax); bar('b-myhp', mh, mmax);
    const n = $('b-myhpn'); if (n) n.textContent = mh + ' / ' + mmax;
    const en = $('b-energy'); if (en) en.innerHTML = [0, 1, 2].map(k => '<span class="' + (k < B.energy ? 'on' : 'off') + '">' + TICON.spark + '</span>').join('');
  }
  const msg = t => { const e = $('b-msg'); if (e) e.innerHTML = t; };
  const panel = h => { const e = $('b-panel'); if (e) e.innerHTML = h; };

  async function intro(b) {
    const f = foe(), sf = SPECIES[f.sp], w = E.W[b.z];
    $('b-foe').classList.add('appear');
    if (b.kind === 'wild') {
      msg('野生的 <b>' + sf.en + '</b>（' + sf.zh + '）出现了！');
      await E.say('A wild ' + sf.en + ' appeared!');
    } else {
      const who = b.kind === 'trainer' ? b.trainer.name : w.boss.name;
      msg(who + '：“我要派出 <b>' + sf.en + '</b>！”');
      await E.say("Let's battle! Go, " + sf.en + '!', undefined, 'm');
    }
    if (!live(b)) return;
    msg('去吧，<b>' + SPECIES[me().sp].en + '</b>！');
    await E.say('Go, ' + SPECIES[me().sp].en + '!');
    if (!live(b)) return;
    menu();
  }
  function menu() {
    B.turn = 'me'; B.task = null;
    const m = me(), sm = SPECIES[m.sp], f = foe();
    const canCatch = B.kind === 'wild' && !B.noCatch && B.foeHp <= stats(f).hp * 0.6;
    msg('<b>' + sm.en + '</b> 要用什么技能？念对英语咒语才能打中！');
    panel('<div class="moves">' + MOVES[sm.type].map((mv, i) => {
      const lock = i === 2 && B.energy < 3;
      return '<button class="move' + (i === 2 ? ' ult' : '') + '" style="--tc:' + TYPES[sm.type].color + '" data-act="bMove" data-i="' + i + '"' + (lock ? ' disabled' : '') + '><span class="mv-top"><span class="mv-ico">' + TICON[sm.type] + '</span><b>' + mv[0] + '</b><span class="mv-pow">' + DOTS[i] + '</span></span><small>' + mv[1] + ' · ' + (lock ? '攒满 3 格能量解锁' : TASK[i]) + '</small></button>';
    }).join('') + '</div>' +
      '<div class="b-items">' +
      (B.kind === 'wild' && !B.noCatch ? '<button class="btn small ' + (canCatch ? 'sun' : 'ghost') + '" data-act="bCatch"' + (canCatch ? '' : ' disabled') + '>🔮 收服' + (canCatch ? '' : ' · 先打虚弱') + '</button>' : '') +
      '<button class="btn small ghost" data-act="bBag">🎒 背包</button></div>');
  }
  // 战斗里的背包：只能用回复类道具，用掉这一回合
  function battleBag() {
    if (!B || B.turn !== 'me') return;
    const m = me(), full = B.hp[m.uid] >= stats(m).hp;
    const rows = ['potion', 'superpotion'].map(id => {
      const it = ITEMS[id], n = itemCount(id);
      return '<div class="ach"><span class="ae">' + it.icon + '</span><div style="flex:1"><b>' + it.zh + ' ×' + n + '</b><small>' + it.desc + '</small></div><button class="btn small sun" data-act="bUse" data-id="' + id + '"' + (n > 0 && !full ? '' : ' disabled') + '>用</button></div>';
    }).join('');
    E.openModal('<h2>🎒 背包</h2><p>给 <b>' + SPECIES[m.sp].en + '</b> 用道具（体力 ' + Math.max(0, Math.round(B.hp[m.uid])) + ' / ' + stats(m).hp + '）。用道具会用掉这一回合。</p>' + rows + '<button class="btn ghost wide" data-act="close">返回</button>');
  }

  // 技能任务：说单词 / 念句子 / 对话大招 / 收服咒语
  function onMove(i) {
    if (!B || B.turn !== 'me') return;
    if (i === 2 && B.energy < 3) return;
    const Wz = E.W[B.z];
    B.move = i; B.tries = 0; B.hinted = false; B.turn = 'task';
    if (i === 0) { const k = rnd(Wz.words.length), it = Wz.words[k]; B.task = { kind: 'word', q: { kind: 'word', w: B.z, i: k }, target: it[0], zh: it[1], em: it[2] }; }
    else if (i === 1) { const k = rnd(Wz.sents.length), it = Wz.sents[k]; B.task = { kind: 'sent', q: { kind: 'sent', w: B.z, i: k }, target: it[0], zh: it[1] }; }
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
    const t = B.task, sr = E.speakMode() === 'sr', mv = MOVES[SPECIES[me().sp].type][B.move || 0], esc = E.esc;
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
    } else {
      head = '🔮 念出收服咒语，把它装进回声球！';
      body = '<div class="say-text" id="b-say">' + E.wordsHTML(t.target) + '</div><div class="say-row"><button class="spk mini" data-act="bHear" aria-label="听示范">' + E.SPK + '</button></div>';
    }
    const rate = '<div class="rate"><button class="btn coral" data-act="bRate" data-v="0">😅 没念好</button><button class="btn sun" data-act="bRate" data-v="1">🙂 还行</button><button class="btn leaf" data-act="bRate" data-v="2">😎 很准</button></div>';
    panel('<div class="task"><div class="task-h">' + head + '</div>' + body +
      (sr ? '<button class="mic" id="b-mic" data-act="bMic" aria-label="开始说话">' + E.MIC + '</button><div class="mic-hint" id="b-hint">点麦克风，大声念出来</div><div class="heard" id="b-heard"></div>'
        : '<div class="mic-hint" id="b-hint">' + (t.kind === 'ult' ? '先点出正确的回答' : '大声念出来，然后诚实地给自己打分') + '</div><div id="b-rate"' + (t.kind === 'ult' ? ' hidden' : '') + '>' + rate + '</div>') +
      '<button class="link" data-act="bBack">换个技能</button></div>');
    msg(t.kind === 'catch' ? '<b>' + SPECIES[foe().sp].en + '</b> 已经很虚弱了，快收服它！' : '念得越准，伤害越高；念得特别准会<b>暴击</b>！');
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
    const t = B.task;
    B.turn = 'busy';
    if (score >= 55) {
      E.S.stats.spoken++; E.qProg('spoken', 1);
      if (measured && score >= 85) { E.S.stats.perfect++; E.qProg('perfect', 1); }
    } else if (t.q) E.addWrong(t.q);
    if (t.kind === 'catch') resolveCatch(score, B);
    else resolveAttack(score, why, B);
  }

  // ---------- 动画 ----------
  function center(id) {
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
  async function strike(fromId, toId, type, dmg, labels) {
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

  async function resolveAttack(score, why, b) {
    const m = me(), f = foe(), sm = SPECIES[m.sp], sf = SPECIES[f.sp], mv = MOVES[sm.type][B.move];
    let mult = score >= 85 ? 1.3 : score >= 55 ? 1 : score >= 30 ? 0.6 : 0;
    if (B.hinted) mult = Math.min(mult, 1);
    const e = eff(sm.type, sf.type);
    const dmg = mult ? Math.max(1, Math.round(stats(m).atk * POWER[B.move] * mult * e * (0.9 + Math.random() * 0.2))) : 0;
    if (B.move === 2) B.energy = 0; else if (mult) B.energy = Math.min(3, B.energy + 1);
    panel('');
    msg('<b>' + sm.en + '</b> 使用了 <b>' + mv[0] + '</b>！');
    E.say(sm.en + ', use ' + mv[0] + '!');
    const labels = [];
    if (mult >= 1.3) labels.push('暴击！');
    if (dmg && e > 1) labels.push('效果拔群！');
    if (dmg && e < 1) labels.push('效果一般');
    await strike('b-me', 'b-foe', sm.type, dmg, labels);
    if (!live(b)) return;
    B.foeHp -= dmg;
    updHp();
    msg(dmg ? (mult >= 1.3 ? '发音超准，<b>暴击</b>！' : mult < 1 ? '咒语有点含糊，只擦伤了它。' : '打中了！') + (e > 1 ? '属性克制，效果拔群！' : '') : '咒语' + (why || '没念准') + '，攻击落空了！');
    await sleep(900);
    if (!live(b)) return;
    if (B.foeHp <= 0) foeFaint(b); else foeTurn(b);
  }

  // 对手回合：听懂它的咒语来防御
  async function foeTurn(b) {
    B.turn = 'foe';
    const f = foe(), sf = SPECIES[f.sp], Wz = E.W[B.z], mv = rnd(2), esc = E.esc;
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
    d.mv = mv; B.def = d;
    msg('<b>' + sf.en + '</b> 要用 <b>' + MOVES[sf.type][mv][0] + '</b> 了！听懂它的咒语来防御！');
    panel('<div class="task def"><div class="task-h">🛡️ 它念的咒语是什么意思？选对就能挡住</div><div class="b-timer"><i id="b-timer"></i></div>' +
      '<div class="say-row"><button class="spk mini" data-act="bDefHear" aria-label="再听一遍">' + E.SPK + '</button></div>' +
      '<div class="opts' + (mv === 0 ? '' : ' list') + '">' + d.opts.map((o, k) => '<button class="opt" data-act="bDef" data-i="' + k + '">' + (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div></div>');
    $('b-foe').classList.add('attack');
    await E.say(d.spell, undefined, 'm');
    if (!live(b) || B.def !== d || d.done) return;
    $('b-foe').classList.remove('attack');
    const bar = $('b-timer');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = 'width 12s linear'; bar.style.width = '0%'; }
    B.defTimer = setTimeout(() => { if (live(b) && B.def === d) defend(-1); }, 12000);
  }
  async function defend(i) {
    const d = B && B.def;
    if (!d || d.done) return;
    d.done = true;
    clearTimeout(B.defTimer);
    const b = B, ok = i >= 0 && d.opts[i].c;
    document.querySelectorAll('#b-panel .opt').forEach((btn, k) => btn.classList.add(d.opts[k].c ? 'right' : k === i ? 'wrong' : 'dim'));
    const bar = $('b-timer'); if (bar) { bar.style.transition = 'none'; }
    if (ok) { B.energy = Math.min(3, B.energy + 1); E.S.stats.listen++; E.qProg('listen', 1); E.SFX.ok(2); }
    else { E.addWrong(d.q); E.SFX.bad(); }
    const f = foe(), m = me(), sf = SPECIES[f.sp], sm = SPECIES[m.sp];
    const e = eff(sf.type, sm.type);
    const dmg = Math.max(1, Math.round(stats(f).atk * [0.8, 1.2][d.mv] * e * (ok ? 0.15 : 1) * (0.9 + Math.random() * 0.2)));
    msg(ok ? '🛡️ <b>防住了！</b>只受到一点点伤害。' : (i < 0 ? '⏰ 来不及了！' : '没听懂……') + '它念的是：<b>' + E.esc(d.ans) + '</b>');
    await sleep(700);
    if (!live(b)) return;
    panel('');
    await strike('b-foe', 'b-me', sf.type, dmg, ok ? ['挡住了'] : e > 1 ? ['效果拔群！'] : []);
    if (!live(b)) return;
    B.hp[m.uid] -= dmg;
    updHp();
    await sleep(500);
    if (!live(b)) return;
    if (B.hp[m.uid] <= 0) myFaint(b); else menu();
  }

  function gainMonXp(mon, xp) {
    mon.xp += xp;
    while (mon.xp >= xpNeed(mon.lv)) {
      mon.xp -= xpNeed(mon.lv); mon.lv++;
      if (B && B.hp[mon.uid] > 0) { B.hp[mon.uid] += 6; updHp(); }
      E.toast('⬆️ ' + SPECIES[mon.sp].en + ' 升到了 Lv ' + mon.lv + '！', 'gold');
      const pend = M().pendingEvo || (M().pendingEvo = []);
      if (SPECIES[mon.sp].evo && mon.lv >= EVO_LV && !pend.includes(mon.uid)) pend.push(mon.uid);
    }
  }
  async function foeFaint(b) {
    const f = foe(), sf = SPECIES[f.sp];
    $('b-foe').classList.add('faint');
    msg('<b>' + sf.en + '</b> 倒下了！');
    E.say(sf.en + ' fainted!');
    const xp = 10 + f.lv * 8;
    B.used.forEach(u => { const mm = byUid(u); if (mm) gainMonXp(mm, xp); });
    const eb = $('b-exp'), cm = me(); if (eb && cm) eb.style.width = (cm.xp / xpNeed(cm.lv) * 100) + '%';
    E.save();
    await sleep(1400);
    if (!live(b)) return;
    if (B.fi + 1 < B.foes.length) {
      B.fi++;
      B.foeHp = stats(foe()).hp;
      B.enter = 'foe';
      renderBattle();
      const n = SPECIES[foe().sp];
      msg((B.kind === 'trainer' ? B.trainer.name : E.W[B.z].boss.name) + '：“还没完！去吧，<b>' + n.en + '</b>！”');
      $('b-foe').classList.add('appear');
      await E.say('Go, ' + n.en + '!', undefined, 'm');
      if (!live(b)) return;
      menu();
    } else win(b, false);
  }
  async function myFaint(b) {
    const m = me();
    $('b-me').classList.add('faint');
    msg('<b>' + SPECIES[m.sp].en + '</b> 累倒了……');
    await sleep(1300);
    if (!live(b)) return;
    const next = B.team.findIndex((u, k) => k !== B.ti && B.hp[u] > 0);
    if (next >= 0) {
      B.ti = next; B.used.add(B.team[next]);
      B.enter = 'me';
      renderBattle();
      msg('去吧，<b>' + SPECIES[me().sp].en + '</b>！');
      $('b-me').classList.add('appear');
      await E.say('Go, ' + SPECIES[me().sp].en + '!');
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
    await sleep(500);
    if (!live(b)) return;
    $('b-foe').classList.add('caught-in');
    ball.classList.add('wobble');
    const p = (0.3 + 0.7 * (1 - Math.max(0, B.foeHp) / max)) * (score >= 85 ? 1.25 : score >= 55 ? 1 : 0.5) * (sup ? 1.5 : 1);
    const ok = Math.random() < p;
    for (let k = 0; k < 3; k++) { E.SFX.tap(); await sleep(600); if (!live(b)) return; if (!ok && k === 1) break; }
    if (ok) {
      ball.classList.remove('wobble'); ball.classList.add('sealed');
      B.used.forEach(u => { const mm = byUid(u); if (mm) gainMonXp(mm, 10 + f.lv * 8); });
      const mon = newMon(f.sp, f.lv);
      M().box.push(mon);
      if (M().team.length < TEAM_MAX) M().team.push(mon.uid);
      else B.toBox = true;
      M().dex[f.sp] = 'caught';
      M().caught = (M().caught || 0) + 1;
      E.qProg('catch', 1);
      E.SFX.win(); E.confetti(140);
      msg('🎉 收服成功！<b>' + sf.en + '</b>（' + sf.zh + '）成为了你的伙伴！');
      E.say('Gotcha! ' + sf.en + ' was caught!');
      E.save();
      await sleep(1200);
      if (!live(b)) return;
      win(b, true);
    } else {
      ball.remove();
      $('b-foe').classList.remove('caught-in');
      E.SFX.bad();
      msg('哎呀，<b>' + sf.en + '</b> 挣脱了！' + (score < 55 ? '收服咒语要念得清楚一点。' : '再把它打虚弱一点试试。'));
      E.save();
      await sleep(1200);
      if (!live(b)) return;
      foeTurn(b);
    }
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
      if (first) { m.balls += 3; lines.push('🏅 拿到了 ' + w.name + ' 徽章！'); lines.push('🔮 回声球 +3'); if (z + 1 < E.W.length) lines.push('🏝️ 新区域解锁：' + E.W[z + 1].name); }
    }
    E.S.coins += coins;
    B.result = caught ? 'caught' : 'win';
    writeBack();
    lines.unshift('💰 金币 +' + coins);
    lines.push('⭐ 出战的怪兽获得经验 +' + (10 + topLv * 8));
    E.gainXp(15 + topLv);
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
    setTimeout(() => { E.checkAch(); evolveNext(); }, 1300);
  }
  function lose() {
    B.turn = 'done'; B.result = 'lose';
    writeBack();
    msg('你的怪兽们都累倒了……');
    panel('<div class="b-result"><div class="big">💤</div><b>先去怪兽中心休息一下</b><p>怪兽中心能让怪兽恢复体力。<br>小窍门：多在草丛里打野生怪兽把等级练上去，<br>或者用<b>属性克制</b>（🔥 克 🍃，🍃 克 💧，💧 克 🔥）。</p><div class="say-row">' +
      (B.onEnd ? '<button class="btn" data-act="bEnd" data-focus>去怪兽中心</button>' : '<button class="btn" data-act="bHome">回基地</button>') + '</div></div>');
  }
  // 回复道具：用掉这一回合
  async function usePotion(id) {
    id = id || 'potion';
    if (!B || B.turn !== 'me' || itemCount(id) <= 0) return;
    const b = B, m = me(), max = stats(m).hp;
    if (B.hp[m.uid] >= max) return;
    E.closeModal();
    B.turn = 'busy';
    addItem(id, -1);
    const heal = Math.max(20, Math.round(max * ITEMS[id].heal));
    B.hp[m.uid] = Math.min(max, B.hp[m.uid] + heal);
    panel('');
    msg('用了' + ITEMS[id].zh + '！<b>' + SPECIES[m.sp].en + '</b> 恢复了体力。');
    E.SFX.coin();
    pop('b-me', '+' + heal, 'lbl');
    updHp(); E.save();
    await sleep(1100);
    if (live(b)) foeTurn(b);
  }
  // 进化排队保存在存档里：就算中途离开战斗，回到基地也会补上进化动画
  function evolveNext() {
    const pend = M().pendingEvo || [];
    if (!pend.length || !$('modal').hidden) return;
    const u = pend.shift(); E.save();
    const mon = byUid(u); if (!mon || !SPECIES[mon.sp].evo) return;
    const from = SPECIES[mon.sp], toId = from.evo, to = SPECIES[toId];
    E.openModal('<h2>咦？' + from.en + ' 的样子在变化……</h2><div class="evo-stage"><div class="evo-old">' + svg(mon.sp) + '</div><div class="evo-new">' + svg(toId) + '</div></div>' +
      '<p id="evo-t">' + from.zh + ' 正在进化！</p><button class="btn sun wide" data-act="mEvoOk" id="evo-ok" hidden>太棒了！</button>', { locked: true });
    E.say('What? ' + from.en + ' is evolving!');
    mon.sp = toId;
    M().dex[toId] = 'caught';
    M().evolved = (M().evolved || 0) + 1;
    E.save();
    setTimeout(() => {
      const s = document.querySelector('.evo-stage'); if (s) s.classList.add('done');
      const t = $('evo-t'); if (t) t.innerHTML = '恭喜！<b>' + from.en + '</b> 进化成了 <b>' + to.en + '</b>（' + to.zh + '）！';
      const ok = $('evo-ok'); if (ok) ok.hidden = false;
      E.SFX.win(); E.confetti(180);
      E.say(from.en + ' evolved into ' + to.en + '!');
      E.checkAch();
    }, 2600);
  }

  // ---------- 我的怪兽 / 图鉴 / 回声球 ----------
  // 一只怪兽的信息行，btn 是右边的按钮
  function monRow(mon, btn, inTeam) {
    const s = SPECIES[mon.sp];
    return '<div class="mrow"><span class="mrow-svg">' + svg(mon.sp) + '</span><div class="mrow-i"><b>' + s.en + '</b> <small>' + s.zh + '</small><div class="chips">' + tchip(s.type) + '<span class="lvchip">Lv ' + mon.lv + '</span>' + (inTeam ? '<span class="lvchip in">队伍中</span>' : '') + '</div>' +
      '<small>体力 ' + curHp(mon) + ' / ' + stats(mon).hp + (curHp(mon) === 0 ? ' · 累倒了' : '') + '</small>' +
      '<div class="xpbar"><i style="width:' + (mon.xp / xpNeed(mon.lv) * 100) + '%"></i></div></div><div class="mrow-b">' + btn + '</div></div>';
  }
  const teamMons = () => M().team.map(byUid).filter(Boolean);
  const boxMons = () => M().box.filter(x => !M().team.includes(x.uid)).sort((a, b) => b.lv - a.lv);
  // 队伍：看状态、换主力。存进箱子 / 从箱子取出要去怪兽中心的电脑
  function teamSheet() {
    const rows = teamMons().map((mon, k) => monRow(mon, k === 0 ? '<span class="lvchip">主力</span>' : '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '">设为主力</button>', true)).join('');
    const nb = boxMons().length;
    E.openModal('<h2>我的队伍 ' + teamMons().length + ' / ' + TEAM_MAX + '</h2><p>主力先出场，倒下后队友自动接上。</p>' + rows +
      (nb ? '<p class="tip">💻 电脑箱子里还有 ' + nb + ' 只怪兽，去怪兽中心的电脑可以换进队伍。</p>' : '') +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  // 怪兽中心的电脑：队伍和箱子互相换
  function pcSheet() {
    const full = M().team.length >= TEAM_MAX, one = M().team.length <= 1;
    const team = teamMons().map((mon, k) => monRow(mon, (k ? '<button class="btn small" data-act="mLead" data-u="' + mon.uid + '" data-pc="1">设为主力</button>' : '<span class="lvchip">主力</span>') +
      '<button class="btn small ghost" data-act="mBench" data-u="' + mon.uid + '" data-pc="1"' + (one ? ' disabled' : '') + '>存进箱子</button>', true)).join('');
    const box = boxMons().map(mon => monRow(mon, '<button class="btn small sun" data-act="mJoin" data-u="' + mon.uid + '" data-pc="1"' + (full ? ' disabled' : '') + '>放进队伍</button>', false)).join('');
    E.openModal('<h2>💻 怪兽箱子</h2><p>队伍最多 ' + TEAM_MAX + ' 只。' + (full ? '队伍满了，先存一只进箱子再取。' : '') + '</p><h3 class="pc-h">队伍 ' + M().team.length + ' / ' + TEAM_MAX + '</h3>' + team +
      '<h3 class="pc-h">箱子 ' + boxMons().length + '</h3>' + (box || '<p class="tip">箱子是空的。收服的怪兽在队伍满了以后会送到这里。</p>') +
      '<button class="btn ghost wide" data-act="close">关闭电脑</button>');
  }
  // 背包：在大地图上用回复道具、驱怪喷雾、逃生绳
  function bagSheet() {
    const rows = BAG_ORDER.map(id => {
      const it = ITEMS[id], n = itemCount(id);
      if (!n && id !== 'ball' && id !== 'potion') return '';
      let use = '';
      if (it.heal || id === 'revive') use = '<button class="btn small" data-act="mUse" data-id="' + id + '"' + (n ? '' : ' disabled') + '>用</button>';
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
    const rows = teamMons().map(mon => {
      const max = stats(mon).hp, hp = curHp(mon), ok = id === 'revive' ? hp === 0 : hp > 0 && hp < max;
      return monRow(mon, '<button class="btn small sun" data-act="mUseOn" data-id="' + id + '" data-u="' + mon.uid + '"' + (ok ? '' : ' disabled') + '>' + it.icon + ' 用</button>', true);
    }).join('');
    E.openModal('<h2>' + it.icon + ' ' + it.zh + ' 给谁用？</h2><p>' + it.desc + '</p>' + rows + '<button class="btn ghost wide" data-act="mBag">返回背包</button>');
  }
  function useItemOn(id, u) {
    const mon = byUid(u), it = ITEMS[id];
    if (!mon || itemCount(id) <= 0) return;
    const max = stats(mon).hp, hp = curHp(mon);
    if (id === 'revive') { if (hp > 0) return; mon.hp = Math.round(max / 2); }
    else { if (hp === 0 || hp >= max) return; mon.hp = Math.min(max, hp + Math.max(20, Math.round(max * it.heal))); }
    addItem(id, -1);
    E.save(); E.SFX.coin();
    E.toast(it.icon + ' ' + SPECIES[mon.sp].en + ' 恢复了体力', 'gold');
    E.say(SPECIES[mon.sp].en + ' feels better!');
    if (itemCount(id) > 0) useItem(id); else bagSheet();
  }
  function dexSheet() {
    const m = M();
    E.openModal('<h2>怪兽图鉴 ' + caughtN() + ' / ' + ORDER.length + '</h2><p>收服或进化就能点亮。遇到过的怪兽会显示影子。</p><div class="dex">' + ORDER.map(id => {
      const s = SPECIES[id], st = m.dex[id];
      return '<div class="dex-i ' + (st || 'none') + '"><span class="dex-svg">' + svg(id) + '</span><b>' + (st ? s.en : '???') + '</b><small>' + (st === 'caught' ? s.zh + ' · ' + TYPES[s.type].icon : st ? '见过' : '未发现') + '</small>' +
        (st === 'caught' ? '<button class="spk mini" data-act="mSayName" data-sp="' + id + '" aria-label="听名字">' + E.SPK + '</button>' : '') + '</div>';
    }).join('') + '</div><button class="btn ghost wide" data-act="close">关闭</button>');
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
    mDex: dexSheet,
    mBalls: ballSheet,
    mBuyBalls: () => { if (E.S.coins < 30) return; E.S.coins -= 30; M().balls += 3; E.save(); E.SFX.coin(); E.renderTop(); E.renderHome(); ballSheet(); },
    mLead: t => { const m = M(); m.team = [t.dataset.u, ...m.team.filter(u => u !== t.dataset.u)]; E.save(); t.dataset.pc ? pcSheet() : teamSheet(); E.renderHome(); },
    mJoin: t => { const m = M(); if (m.team.length < TEAM_MAX && !m.team.includes(t.dataset.u)) m.team.push(t.dataset.u); E.save(); E.SFX.tap(); pcSheet(); },
    mBench: t => { const m = M(); if (m.team.length > 1) m.team = m.team.filter(u => u !== t.dataset.u); E.save(); E.SFX.tap(); pcSheet(); E.renderHome(); },
    mBag: bagSheet,
    mUse: t => useItem(t.dataset.id),
    mUseOn: t => useItemOn(t.dataset.id, t.dataset.u),
    bBag: battleBag,
    bUse: t => usePotion(t.dataset.id),
    mEvoOk: () => { E.closeModal(); E.renderHome(); evolveNext(); },
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
    bEnd: () => { if (!B) return; const cb = B.onEnd, res = B.result || 'flee'; E.closeModal(); writeBack(); stopBattle(); if (cb) cb(res); },
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
      if (m.v === 2) return;
      m.v = 2;
      m.bag = m.bag || {};
      boxMons().slice(0, Math.max(0, TEAM_MAX - m.team.length)).forEach(x => m.team.push(x.uid));
      E.save();
    },
    setFieldHooks: h => { FH = h; },
    STARTERS, STRONG,
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
    ITEMS, itemCount, addItem, pcSheet, bagSheet,
    homeHTML,
    stop: () => { writeBack(); stopBattle(); },
    battle: startBattle,
    trainerFoes,
    healAll,
    anyAlive,
    leadSpecies: () => { const L = lead(); return L ? SPECIES[L.sp] : null; },
    zoneLv,
    afterHome: () => setTimeout(evolveNext, 400),
    caughtCount: s => ORDER.filter(id => s.mon.dex[id] === 'caught').length,
    total: ORDER.length,
  };
})();
