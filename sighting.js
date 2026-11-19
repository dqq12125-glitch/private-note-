// 回声岛 · 今日目击（Today's Sighting）
// 回声博士的告示板每天贴一条目击消息：有人在某个地方看到了一只平时在那里见不到的稀有怪兽。
// 告示上只有三条英文线索——① 哪座岛（按岛的样子或话题说，不直接说名字）② 什么样的地方、从小镇怎么走 ③ 躲在什么地形里、它长什么样。
// 读懂了，去那张地图、在那种地形里走几步，它一定会出来（一场普通的野外对战，顶上写着「今日目击」）。
// 不显示地图名字，地图上也不做记号：读懂英文就是玩法。中文收在「译」按钮后面（和剧情对话同一个设置 S.settings.storyZh，点一次记一次 zhTaps）。
//
// 定下来的规矩（家长 2026-11-15 批准的玩法，细节是这里定的）：
//   · 每天一个目标，按「日期 + 这份存档里不会变的东西（主角名字 + 第一只怪兽的 uid）」算出来，定了就写进存档（world.sight），重新打开不会换；
//   · 地点只从孩子一定去得了的野外地图里挑：进过的地图（world.been，world.js 进地图时记）加上「去过第 z+1 座岛的小镇 → 第 z 座岛小镇到那里
//     一路上的地图」（老存档没有记录时靠这个）。只要有野生怪兽的道路 / 洞穴 / 海路 / 海底；小镇、室内、挑战馆、冠军赛的路、剧情的地方都不算；
//   · 怪兽：这个版本手册里（DEX.list）第一大区的第一阶怪兽，栖息地对得上这种地形（或这张地图的地貌：雪地、火山、沙地……），
//     而且平时在这座岛的这种地形里遇不到（不在野生表里），或者在表里但很少见（稀有度 3 以上）；优先还没收服过的；神兽、初始伙伴、保留的不出；
//   · 稀有色 1/8（平时野外 1/64）；等级和那张地图的野生怪兽一样；
//   · 进对了地图弹一句提示；在对的地形里走到第 4–8 步出来（不会第一步就出来）；跑掉、打倒、输了以后再走 10–16 步还会出来；
//     悄悄喷雾有效的时候它不出来（喷雾说好了不遇怪），步数照算，喷雾一过就出来；
//   · 收服了今天就结束：金币 +30，三条线索一条都没点「译」再 +20；记累计几只、连着几天。第二天换一只，没收服的那只就走了。
// 每走一步只在内存里记步数，跟着 world.js 的 savePos() 那条便宜的路存，这里不调 save()。
(function () {
  'use strict';

  let E = null, MG = null, WH = null;   // game.js 的 api、MonsterGame、world.js 给的钩子 { battle(o), map(), running(), spray() }
  const EMaps = () => window.EchoMaps, DX = () => window.DEX;

  // ---------- 界面文字（i18n.js 字表；键前缀 si.） ----------
  // 三条线索本身是内容（英文 + 中文意思），不在这里：中文意思按 EchoI18n.gloss 显示——中文界面收在「译」后面，英语界面不显示（英文就是要读的）。
  // tools/voice/collect.js 在 Node 沙箱里加载这个文件、没有 EchoI18n：字表只在有的时候登记，界面上的字都在用的时候才取
  const I18N = window.EchoI18n;
  const tx = (k, p) => (I18N ? I18N.t(k, p) : k), hx = (k, p) => (I18N ? I18N.h(k, p) : k);
  if (I18N) I18N.add({
    zh: {
      'si.title': '今日目击', 'si.title.sub': 'Today\'s Sighting',
      'si.tag.sub': 'Today\'s Sighting · 稀有怪兽', 'si.tag.msg': '🔎 <b>今日目击！</b>告示板上说的稀有怪兽就在这里！<br>',
      'si.note.spray': '（🧴 悄悄喷雾还有效，它先不出来）',
      'si.end.win': '🔎 {name} 被打倒后溜走了——在这里多走一会儿，它还会出来',
      'si.end.flee': '🔎 {name} 还在这附近——在这里多走一会儿，它还会出来',
      'si.caught': '🔎 今日目击：收服了 {name}！金币 +{n}', 'si.caught.read': '（没看中文就读懂了，多 {n}）',
      'si.streak': ' · 连续 {n} 天', 'si.tally': '已经收服 {n} 只', 'si.tally.s': '{n} 只',
      'si.zh.btn': '译', 'si.zh.aria': '看中文', 'si.hear': '听一遍', 'si.paren': '{name}（{zh}）',
      'si.card.none': '：走出小镇、去过第一条路以后，回声博士的告示板每天会贴一条<b>英文线索</b>，读懂了就能找到稀有怪兽。',
      'si.card.done': '🔎 <b>今日目击</b> ✅ <b>{name}</b> 已收服',
      'si.st.seen': '👀 见过了，还没收服', 'si.st.new': '还没找到',
      'si.card.lead': '博士的告示板：有人看到了一只稀有怪兽！读懂线索，去那里找它。', 'si.how': '怎么找？',
      'si.row.none': '走出小镇、去过第一条路以后才有消息', 'si.row.new': '3 条英文线索 · 还没找到', 'si.row.caught': '✅ 今天的已经收服',
      'si.sheet.sub': 'Today\'s Sighting · 回声博士的告示板',
      'si.sheet.none': '告示板还是空的。先走出小镇、去第一条路上看看——以后每天这里会贴一条<b>英文线索</b>，读懂了就能找到一只稀有怪兽。',
      'si.sheet.done': '✅ <b>今天的已经收服：{name}</b>。明天会贴出新的告示。',
      'si.sheet.seen': '👀 <b>见过它了，还没收服。</b>它还在那一带：回到那里，在同样的地形里多走一会儿。',
      'si.sheet.new': '📋 <b>有人看到了一只稀有怪兽！</b>读懂三条英文线索，去那个地方找它。',
      'si.sheet.how': '📍 地图上没有记号。到了对的地方会有提示；在线索说的地形里走几步，它就会出来。<br>🔮 收服它：金币 +{n}',
      'si.sheet.read': '；三条线索都不点「译」再 +{n}',
      'si.sheet.how2': '。<br>🏃 跑掉了、打倒了也没关系，在那里多走一会儿它还会出来；明天会换一只。',
      'si.sheet.spray': '<br>🧴 悄悄喷雾还有效：这时候它不会出来。',
      'si.ok': '知道了',
    },
    en: {
      'si.title': 'Today\'s Sighting', 'si.title.sub': '',
      'si.tag.sub': 'A rare monster', 'si.tag.msg': '🔎 <b>Today\'s Sighting!</b> The rare monster from the notice board is here!<br>',
      'si.note.spray': ' (🧴 Your Quiet Spray is still on, so it stays hidden for now)',
      'si.end.win': '🔎 {name} ran away after the battle. Walk around here a bit more and it will come back.',
      'si.end.flee': '🔎 {name} is still near here. Walk around a bit more and it will come back.',
      'si.caught': '🔎 Today\'s Sighting: you caught {name}! +{n} coins', 'si.caught.read': ' (+{n} for reading the clues without help)',
      'si.streak': { one: ' · {n} day in a row', other: ' · {n} days in a row' }, 'si.tally': '{n} caught so far', 'si.tally.s': '{n} caught',
      'si.zh.btn': 'Meaning', 'si.zh.aria': 'Show the meaning', 'si.hear': 'Listen', 'si.paren': '{name} ({zh})',
      'si.card.none': ': once you leave the town and visit the first road, Professor Echo\'s notice board shows <b>English clues</b> every day. Understand them and you can find a rare monster.',
      'si.card.done': '🔎 <b>Today\'s Sighting</b> ✅ <b>{name}</b> caught',
      'si.st.seen': '👀 Seen, not caught yet', 'si.st.new': 'Not found yet',
      'si.card.lead': 'Professor Echo\'s notice board: someone saw a rare monster! Read the clues and go and find it.', 'si.how': 'How do I find it?',
      'si.row.none': 'News comes after you leave the town and visit the first road', 'si.row.new': '3 English clues · not found yet', 'si.row.caught': '✅ Today\'s monster is caught',
      'si.sheet.sub': 'Professor Echo\'s notice board',
      'si.sheet.none': 'The notice board is empty. First leave the town and visit the first road. After that, there will be <b>English clues</b> here every day. Understand them and you can find a rare monster.',
      'si.sheet.done': '✅ <b>Today\'s monster is caught: {name}</b>. A new notice comes tomorrow.',
      'si.sheet.seen': '👀 <b>You saw it, but you have not caught it yet.</b> It is still in the same place: go back and walk around a bit more on the same kind of ground.',
      'si.sheet.new': '📋 <b>Someone saw a rare monster!</b> Read the three English clues and go to that place to find it.',
      'si.sheet.how': '📍 There are no marks on the map. You will see a message when you reach the right place. Walk a few steps on the kind of ground the clues talk about, and it will come out.<br>🔮 Catch it: +{n} coins',
      'si.sheet.read': '. Don\'t tap any "Meaning" button: +{n} more',
      'si.sheet.how2': '.<br>🏃 If it runs away or you beat it, don\'t worry: walk there a bit more and it will come back. There is a new one every day.',
      'si.sheet.spray': '<br>🧴 Your Quiet Spray is on: it will not come out now.',
      'si.ok': 'Got it',
    },
  });
  // 线索在界面语言里的意思（中文界面 = zh；英语界面没有，英文就是要读的内容）。glossy()：现在的界面语言有没有线索的意思（线索只写了中文意思）
  const glossOf = c => (I18N ? I18N.gloss(c) : (c && c.zh) || null);
  const glossy = () => !!glossOf({ zh: '·' });

  // ---------- 数值 ----------
  const SHINY = 1 / 8;                   // 稀有色的机会
  const NEED = [4, 8];                   // 第一次：在对的地形里走到第 4–8 步出来
  const AGAIN = [10, 16];                // 见过一次以后：再走 10–16 步
  const COINS = 30, COINS_READ = 20;     // 收服的金币；三条线索都没点「译」再加
  const MIN_TILES = 12;                  // 这种地形至少要有这么多格，才算「这张地图有这种地形」
  // 不当目击地点的地图：勇气之路和冠军高原（去冠军赛的路）、嘘声团基地、回忆神殿和封印之间（剧情的地方）
  const SKIP = /^(v\d|vL|h8|d12)/;
  // 地形 → 对战用的栖息地（monsters.js 的 wildTable(z, hab)）
  const HAB3 = { grass: 'grass', cave: 'cave', sea: 'water', weed: 'water' };
  // 地形 → 哪些栖息地的怪兽算「对得上」（和野生表一样的分法；沙漠、雪地、火山的怪兽野生表里没有，由下面的 extraHab 按地图的地貌补上）
  const FIT = { grass: ['grass', 'forest', 'town', 'sky'], cave: ['cave', 'mountain', 'ruins', 'night'], sea: ['sea', 'water'], weed: ['sea', 'water', 'swamp'] };
  // 要用水路才到得了的地形：[回声贝, 要几枚徽章]（和 world.js 的 SKILLS 一样）
  const NEED_SKILL = { sea: ['hm_surf', 8], weed: ['hm_dive', 10] };

  // 按字符串算出一个 0–1 的数：同样的字符串永远是同一个数（FNV-1a 再搅一下，日期只差一个字也差得开）
  const h01 = s => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  // 这份存档里不会变的东西：主角名字 + 第一只怪兽（最早的伙伴）的 uid
  const seedOf = S => ((S.player || {}).name || '') + '|' + (((((S.mon || {}).box || [])[0]) || {}).uid || '');
  const nextDay = d => { const m = /^(\d+)-(\d+)-(\d+)$/.exec(d || ''); if (!m) return ''; const t = new Date(+m[1], +m[2] - 1, +m[3] + 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const zoneLv = z => (MG && MG.zoneLv ? MG.zoneLv(z) : 2 + z * 2);

  // ---------- 存档 ----------
  // world.sight：day 哪天的目标 / map hab sp lv shiny 目标（hab 是这里的地形名 grass cave sea weed）/ cv 线索用哪种说法 /
  // st '' 还没找到、seen 见过、caught 收服了 / steps 在对的地形里走了几步、need 走到第几步出来、met 今天见过几次 /
  // zh 哪几条线索点过「译」（按位）/ pm ps 上一次的地图和怪兽（不连着重复）/ total 一共收服几只、streak 连着几天、last 最后一次收服是哪天
  const fresh = () => ({ day: '', map: '', hab: '', sp: '', lv: 0, shiny: false, cv: [0, 0], st: '', steps: 0, need: 0, met: 0, zh: 0, pm: '', ps: '', total: 0, streak: 0, last: '' });
  function rec(S) {
    const ws = S.world, d = fresh();
    if (!ws.sight || typeof ws.sight !== 'object') ws.sight = d;
    else for (const k in d) if (ws.sight[k] == null) ws.sight[k] = d[k];
    if (!ws.been || typeof ws.been !== 'object') ws.been = {};
    return ws.sight;
  }

  // ---------- 哪些地图能当目击地点 ----------
  // 这张地图上会遇怪的地形：grass 草丛（陆上的路）/ cave 洞穴地面 / sea 海面（海路，要水路）/ weed 海草（海底）；不能当地点的返回 ''
  const TER = new WeakMap();
  function terrainOf(m) {
    if (!m || !m.grid) return '';
    if (TER.has(m)) return TER.get(m);
    let t = '';
    if (!SKIP.test(m.id) && !m.hab && (m.kind === 'route' || m.kind === 'cave' || m.kind === 'under')) {
      let g = 0, c = 0, w = 0;
      m.grid.forEach(r => r.forEach(ch => { if (ch === ',') g++; else if (ch === ':') c++; else if (ch === '~' || ch === 'D') w++; }));
      if (m.kind === 'under') t = g >= MIN_TILES ? 'weed' : '';
      else if (m.kind === 'cave') t = c >= MIN_TILES ? 'cave' : '';
      else if (m.def && m.def.sea) t = w >= MIN_TILES ? 'sea' : '';
      else t = g >= MIN_TILES ? 'grass' : '';
    }
    TER.set(m, t);
    return t;
  }
  // 从 from 走到 to 一路经过的地图：[{ id, via }]（via 是从上一张图出来的那组出口：^ v < > 地图的北南西东边，K 洞口，% 楼梯，e 地垫，D 潜下去……）
  const PATHS = {};
  function pathFrom(from, to) {
    const key = from + '>' + to;
    if (key in PATHS) return PATHS[key];
    const EM = EMaps();
    const walk = viaTowns => {
      const prev = {}, q = [from];
      prev[from] = null;
      while (q.length) {
        const cur = q.shift(), m = EM.get(cur);
        if (!m || (cur !== from && m.kind === 'town' && !viaTowns)) continue;
        const next = (m.groups || []).map(g => [g.to, g.via]).concat((m.npcs || []).filter(n => n.to).map(n => [n.to, 'ferry']));
        for (const [id, via] of next) {
          if (id in prev || !EM.get(id)) continue;
          prev[id] = { from: cur, via };
          if (id === to) { const out = []; for (let c = to; prev[c]; c = prev[c].from) out.unshift({ id: c, via: prev[c].via }); return out; }
          q.push(id);
        }
      }
      return null;
    };
    return (PATHS[key] = walk(false) || walk(true));
  }
  const hasSkill = (S, k) => { const n = NEED_SKILL[k]; return !n || ((((S.mon || {}).bag || {})[n[0]] || 0) > 0 && Object.keys((S.mon || {}).badges || {}).length >= n[1]); };
  // 孩子一定去得了的目击地点（地图 id，排好序）
  function reach(S) {
    const EM = EMaps(), ws = S.world || {}, ids = {};
    if (!EM) return [];
    Object.keys(ws.been || {}).forEach(id => { ids[id] = 1; });
    // 老存档没有 been：去过第 z 座岛的小镇，说明从上一座岛的小镇走过来那一路的地图都到过
    Object.keys(ws.visited || {}).map(Number).forEach(z => { if (z > 0) (pathFrom('t' + (z - 1), 't' + z) || []).forEach(p => { ids[p.id] = 1; }); });
    return Object.keys(ids).filter(id => { const t = terrainOf(EM.get(id)); return !!t && hasSkill(S, t); }).sort();
  }

  // ---------- 哪只怪兽 ----------
  // 这张地图的地貌另外招来的怪兽（它们的栖息地野生表里用不上）
  function extraHab(m) {
    const en = m.en || '', cave = m.def && m.def.cave, out = [];
    let sand = 0;
    m.grid.forEach(r => r.forEach(ch => { if (ch === 'S') sand++; }));
    if (m.theme === 'snow' || cave === 'ice') out.push('snow');
    if (cave === 'lava' || (m.groups || []).some(g => { const n = EMaps().get(g.to); return !!(n && n.def && n.def.cave === 'lava'); })) out.push('volcano');
    if (/Mountain|Summit/i.test(en)) out.push('mountain');
    if (sand >= 400 && !(m.def && m.def.sea)) out.push('desert');
    if (m.theme === 'jungle' && m.kind === 'route') out.push('swamp');
    if (m.theme === 'ruins') out.push('ruins');
    return out;
  }
  // 能出的怪兽：这个版本手册里第一大区的第一阶，不是神兽、初始伙伴、保留的
  const basePool = () => { const D = DX(); return D.list.filter(s => s.r === 1 && D.isBase(s) && !s.legend && !s.starter && !s.reserved); };
  // 栖息地对得上这张地图的（一只都对不上就全部都算）
  function fitPool(m) {
    const fit = FIT[terrainOf(m)].concat(extraHab(m)), all = basePool(), pool = all.filter(s => (s.habitat || []).some(h => fit.includes(h)));
    return pool.length ? pool : all;
  }
  // 候选：对得上、平时在这里遇不到或很少见的；优先还没收服过的
  function cands(m, S) {
    const hab = HAB3[terrainOf(m)], table = {};
    if (MG && MG.wildTable) MG.wildTable(m.z, hab).forEach(s => { table[s.id] = 1; });
    let pool = fitPool(m);
    const rare = pool.filter(s => (s.rarity || 1) >= 2 && (!table[s.id] || s.rarity >= 3));
    if (rare.length) pool = rare;
    const dex = (S.mon || {}).dex || {}, neu = pool.filter(s => dex[s.id] !== 'caught');
    return (neu.length ? neu : pool).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  // 越少见、越是「只有这种地貌才有」的，越容易被挑中
  function weight(s, m) {
    const ex = extraHab(m);
    return [0, 1, 2, 5, 6, 6][s.rarity || 1] * ((s.habitat || []).some(h => ex.includes(h)) ? 3 : 1);
  }

  // ---------- 今天的目标 ----------
  // 这份存档在这一天的目标（只算，不改存档）：{ map, hab, sp, lv, shiny, cv, need }；还没有去得了的地方就是 null
  function pick(S, day) {
    const EM = EMaps(), D = DX(), sg = (S.world || {}).sight || {};
    if (!EM || !D || !(((S.mon || {}).box) || []).length) return null;
    let maps = reach(S);
    if (!maps.length) return null;
    const seed = seedOf(S) + '|' + day, r = tag => h01(seed + '|' + tag);
    if (maps.length > 1 && sg.pm) maps = maps.filter(id => id !== sg.pm);   // 不连着两天在同一个地方
    const id = maps[Math.floor(r('map') * maps.length)], m = EM.get(id);
    let pool = cands(m, S);
    if (!pool.length) return null;
    if (pool.length > 1 && sg.ps) pool = pool.filter(s => s.id !== sg.ps);  // 也不连着两天是同一只
    const w = pool.map(s => weight(s, m));
    let x = r('mon') * w.reduce((a, b) => a + b, 0), sp = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x < 0) { sp = pool[i]; break; } }
    return {
      map: id, hab: terrainOf(m), sp: sp.id, lv: zoneLv(m.z) + (m.lvBonus || 0) + 1 + Math.floor(r('lv') * 2), shiny: r('shiny') < SHINY,
      cv: [Math.floor(r('c1') * 2), Math.floor(r('c3') * 12)], need: NEED[0] + Math.floor(r('need') * (NEED[1] - NEED[0] + 1)),
    };
  }
  // 把这一天的目标定下来、记进存档（已经定过就不动）。不在这里 save()：下一次存档自然带上；没存就关掉了，重新打开算出来的还是同一个。
  // 手机日期往回调：留着原来的，不重新抽
  function roll(S, day) {
    if (!S || !S.world) return null;
    const sg = rec(S);
    if (sg.day && day < sg.day) return sg;
    if (sg.day !== day) {
      if (sg.map) { sg.pm = sg.map; sg.ps = sg.sp; }
      Object.assign(sg, { day, map: '', hab: '', sp: '', lv: 0, shiny: false, cv: [0, 0], st: '', steps: 0, need: 0, met: 0, zh: 0 });
    }
    // 存档里的目标在这个版本里不能用了（换了版本手册里没有这只、地图改过）：当作今天还没定，重新挑
    if (sg.map && sg.st !== 'caught' && !usable(sg)) Object.assign(sg, { map: '', hab: '', sp: '', st: '', steps: 0, met: 0 });
    if (!sg.map) { const t = pick(S, day); if (t) Object.assign(sg, t); }
    return sg;
  }
  function usable(t) {
    const EM = EMaps(), D = DX(), sp = D && D.byId[t.sp];
    return !!(EM && sp && D.list.includes(sp) && terrainOf(EM.get(t.map)) === t.hab);
  }
  // 这只怪兽会不会出现在今日目击里（手册的「出没地点」用）
  const may = id => { const D = DX(); return !!(D && D.byId[id] && basePool().includes(D.byId[id])); };
  const ensure = () => (E ? roll(E.S, E.dayStr()) : null);
  // 连着几天（断了就是 0）
  const streakNow = (sg, day) => (sg.last && (sg.last === day || nextDay(sg.last) === day || sg.last > day) ? sg.streak || 0 : 0);

  // ---------- 三条线索（都从目标地图、目标怪兽的数据里拼出来，所以一定是真的） ----------
  // ① 哪座岛：按岛上小镇的树和房子说（maps.js 的 THEMES），或者按这座岛的话题说（data.js 的 WORLDS，每句里都有这个话题的单词）
  const TREE = {
    palm: ['palm trees', '棕榈树'], pencil: ['trees like big pencils', '像大铅笔一样的树'], autumn: ['orange autumn trees', '橙黄色的秋天的树'],
    round: ['round green trees', '圆圆的绿树'], cypress: ['tall thin trees', '又高又细的树'], pine: ['dark green pine trees', '深绿色的松树'],
    lolli: ['trees like lollipops', '像棒棒糖一样的树'], jungle: ['big jungle trees', '高大的丛林大树'], orchard: ['fruit trees', '果树'],
    snowpine: ['pine trees with snow on them', '落满雪的松树'], dead: ['old trees with no leaves', '没有叶子的老树'],
  };
  const HOUSE = {
    med: ['white houses with red roofs', '红屋顶的白房子'], crayon: ['houses in bright colours', '颜色鲜艳的房子'], farm: ['wooden farm houses', '木头搭的农舍'],
    brick: ['red brick buildings', '红砖楼'], dome: ['round glass houses', '圆圆的玻璃房子'], tent: ['big tents', '大帐篷'],
    tower: ['stone towers with clocks', '带钟的石塔'], cake: ['houses like cakes', '像蛋糕一样的房子'], hut: ['tree houses', '树屋'],
    city: ['tall buildings', '高楼'], market: ['small shops', '小店铺'], chalet: ['wooden houses with snow on the roofs', '屋顶积着雪的木屋'], temple: ['stone temples', '石头神殿'],
  };
  const TOPIC = [
    ['say hello and good morning to everyone', '见到谁都说 hello 和 good morning'],
    ['love pens, pencils and rulers in every colour', '喜欢各种颜色的钢笔、铅笔和尺子'],
    ['love to talk about their father, mother and family', '最爱聊自己的爸爸妈妈和一家人'],
    ['talk about the classroom, the library and the playground', '常常聊教室、图书馆和操场'],
    ['love English, maths and science', '最喜欢英语、数学和科学'],
    ['sing, dance and play chess in their clubs', '在社团里唱歌、跳舞、下棋'],
    ['always get up and have breakfast on time', '总是按时起床、按时吃早餐'],
    ['love birthday parties, cakes and balloons', '最喜欢生日派对、蛋糕和气球'],
    ['talk about pandas, tigers and monkeys', '常常聊熊猫、老虎和猴子'],
    ['must follow many rules and be quiet', '要遵守很多规则，还要保持安静'],
    ['play basketball and eat healthy food', '爱打篮球、吃健康的食物'],
    ['talk about sunny, rainy and snowy weather', '常常聊晴天、雨天和下雪天'],
    ['love to talk about the places they visited and the things they saw', '爱聊自己去过的地方、见过的东西'],
  ];
  function isleClue(z, v) {
    const EM = EMaps(), th = EM.THEMES[EM.themeOf(z)] || {}, tr = TREE[th.tree], ho = HOUSE[th.house], tp = TOPIC[z];
    if ((v === 0 || !tp) && tr && ho) return { k: 'look', en: 'It is on an island. There are ' + tr[0] + ' and ' + ho[0] + ' there.', zh: '它在一座岛上，那里有' + tr[1] + '和' + ho[1] + '。' };
    if (tp) return { k: 'topic', en: 'It is on an island. People there ' + tp[0] + '.', zh: '它在一座岛上，那里的人' + tp[1] + '。' };
    return { k: 'none', en: 'It is on an island.', zh: '它在一座岛上。' };
  }
  // ② 什么样的地方 + 从这座岛的小镇怎么走。每一种：[在哪, 中文, 「要先经过它」的英文, 中文]
  const PLACE = {
    road: ['on a road', '在一条路上', 'Walk along a road first.', '要先走过一条路。'],
    sandy: ['on a sandy road', '在一条满是沙子的路上', 'Walk along a sandy road first.', '要先走过一条沙子路。'],
    seaside: ['on a road by the sea', '在海边的一条路上', 'Walk along the sea first.', '要先沿着海边走一段。'],
    river: ['on a road by a river', '在河边的一条路上', 'Walk along a river first.', '要先沿着河走一段。'],
    farm: ['on a road around the farms', '在绕着农田的一条路上', 'Walk around the farms first.', '要先绕过农田。'],
    woods: ['in the woods', '在一片树林里', 'Walk through the woods first.', '要先穿过一片树林。'],
    beach: ['on a beach', '在一片海滩上', 'Walk across a beach first.', '要先走过一片海滩。'],
    cliff: ['on a cliff by the sea', '在海边的悬崖上', 'Walk along a cliff first.', '要先走过一段悬崖。'],
    mount: ['high on a mountain', '在高高的山上', 'Climb a mountain first.', '要先爬上一座山。'],
    snow: ['in a field of snow', '在一片白茫茫的雪地上', 'Walk across the snow first.', '要先走过一片雪地。'],
    jungle: ['on a path in the jungle', '在丛林里的一条小路上', 'Walk through the jungle first.', '要先穿过丛林。'],
    cave: ['in a cave', '在一个山洞里', 'Walk through a cave first.', '要先穿过一个山洞。'],
    dark: ['in a dark cave', '在一个黑黑的山洞里', 'Walk through a dark cave first.', '要先穿过一个黑黑的山洞。'],
    ice: ['in a cave of ice', '在一个全是冰的山洞里', 'Walk through a cave of ice first.', '要先穿过一个全是冰的山洞。'],
    lava: ['in a hot cave inside a mountain', '在山肚子里一个很热的洞里', 'Walk through a hot cave first.', '要先穿过一个很热的山洞。'],
    tunnel: ['in a tunnel', '在一条隧道里', 'Walk through a tunnel first.', '要先穿过一条隧道。'],
    sea: ['out at sea', '在海上', 'Cross the sea first.', '要先过一片海。'],
    under: ['under the sea', '在海底', 'Swim under the sea first.', '要先从海底游过去。'],
  };
  // 地图是哪一种地方：按种类、洞穴的样子和地图的英文名（作者起的名字里有 Woods / Beach / Cliff……）
  function placeKey(m) {
    const en = (m && m.en) || '', cave = m && m.def && m.def.cave;
    if (!m) return 'road';
    if (m.kind === 'under') return 'under';
    if (m.kind === 'cave') return cave === 'ice' ? 'ice' : cave === 'lava' ? 'lava' : /Tunnel/i.test(en) ? 'tunnel' : m.dark ? 'dark' : 'cave';
    if (m.def && m.def.sea) return 'sea';
    return /Woods|Forest/i.test(en) ? 'woods' : /Beach/i.test(en) ? 'beach' : /Cliff/i.test(en) ? 'cliff' : /Mountain|Summit/i.test(en) ? 'mount' : /Snow/i.test(en) ? 'snow'
      : /Jungle/i.test(en) ? 'jungle' : /Dune|Sand/i.test(en) ? 'sandy' : /Seaside|Coast/i.test(en) ? 'seaside' : /River|Waterfall/i.test(en) ? 'river' : /Farm/i.test(en) ? 'farm' : 'road';
  }
  // @i18n-content 线索第 ② 条的模板：英文和它的中文意思（中文按 EchoI18n.gloss 显示，不是界面文字）
  const DIR = { '^': ['north', '北'], v: ['south', '南'], '<': ['west', '西'], '>': ['east', '东'] };
  function placeClue(m) {
    const P = PLACE[placeKey(m)], path = pathFrom('t' + m.isle, m.id), last = path && path[path.length - 1];
    let k, en, zh;
    if (!path) { k = 'far'; en = 'It is far from the town.'; zh = '它离小镇比较远。'; }
    else if (last.via === 'D') { k = 'dive'; en = 'Go out to sea and dive down.'; zh = '要先到海上去，再潜下去。'; }
    else if (path.length === 1 && DIR[last.via]) { k = 'dir'; en = 'Go ' + DIR[last.via][0] + ' from the town.'; zh = '从小镇往' + DIR[last.via][1] + '走。'; }
    else if (path.length === 1) { k = 'in'; en = 'The way in is in the town.'; zh = '入口就在小镇里。'; }
    else { const F = PLACE[placeKey(EMaps().get(path[path.length - 2].id))]; k = 'far'; en = 'It is far from the town. ' + F[2]; zh = '它离小镇比较远，' + F[3]; }
    return { k, place: placeKey(m), en: 'It is ' + P[0] + '. ' + en, zh: '它' + P[1] + '。' + zh };
  }
  // @i18n-content-end
  // ③ 躲在什么地形里 + 它的一样特点（属性 / 样子 / 颜色 / 大小，每天换一种说）
  const TERRAIN = {
    grass: ['It hides in the tall grass.', '它躲在高高的草丛里。'],
    cave: ['It hides in the cave. Walk around inside.', '它藏在洞里，在里面多走走。'],
    sea: ['It swims on top of the water. Ride on the water to find it.', '它在水面上游，要到水上去找。'],
    weed: ['It hides in the seaweed.', '它躲在海草里。'],
  };
  const BODY = {
    quad: ['It walks on four legs.', '它用四条腿走路。'], biped: ['It stands on two legs.', '它用两条腿站着。'], bird: ['It looks like a bird.', '它长得像一只鸟。'],
    fish: ['It looks like a fish.', '它长得像一条鱼。'], serpent: ['It has a long body like a snake.', '它的身子长长的，像一条蛇。'], bug: ['It looks like a bug.', '它长得像一只小虫子。'],
    blob: ['It is round like a ball.', '它圆圆的，像一个球。'], ghost: ['It looks like a little ghost.', '它长得像一个小幽灵。'], shell: ['It has a shell on its back.', '它背上有一个壳。'],
    plant: ['It looks like a plant.', '它长得像一棵植物。'], golem: ['It looks like a stone giant.', '它长得像一个石头巨人。'], dragon: ['It looks like a dragon.', '它长得像一条龙。'],
  };
  // @i18n-content 线索第 ③ 条里颜色的中文意思
  const COLOUR = { red: '红色', orange: '橙色', yellow: '黄色', green: '绿色', blue: '蓝色', purple: '紫色', pink: '粉红色', brown: '棕色', black: '黑色', white: '白色', grey: '灰色' };
  // @i18n-content-end
  // 主色（dex 的 c）叫什么颜色；说不准的（两种颜色中间、太淡）返回 ''，不拿来当线索
  function colourOf(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return '';
    const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (l >= .93) return 'white';
    if (l <= .16) return 'black';
    if (s < .1) return l > .3 && l < .75 ? 'grey' : '';
    if (s < .35) return '';
    if (h >= 12 && h < 45 && l < .42) return 'brown';
    if (l > .85) return '';
    if (h >= 350 || h < 10) return l > .7 ? 'pink' : 'red';
    if (h >= 18 && h < 40) return 'orange';
    if (h >= 46 && h < 64) return 'yellow';
    if (h >= 78 && h < 160) return 'green';
    if (h >= 190 && h < 250) return 'blue';
    if (h >= 262 && h < 290) return 'purple';
    if (h >= 305 && h < 345) return 'pink';
    return '';
  }
  // 这只怪兽能说的特点（稀有色的不说颜色：颜色换过了）
  function traits(sp, shiny) {
    const T = DX().TYPES[sp.types[0]], out = [];
    if (T) out.push({ k: 'type', en: 'It is ' + (/^[AEIOU]/.test(T.en) ? 'an ' : 'a ') + T.en + ' monster.', zh: '它是' + T.zh + '系的怪兽。' });
    if (BODY[sp.b]) out.push({ k: 'body', en: BODY[sp.b][0], zh: BODY[sp.b][1] });
    const col = shiny ? '' : colourOf(sp.c);
    if (col) out.push({ k: 'colour', v: col, en: 'It is ' + col + '.', zh: '它是' + COLOUR[col] + '的。' });
    const sz = sp.sz == null ? 1 : sp.sz;
    if (sz <= .8) out.push({ k: 'size', v: 'small', en: 'It is very small.', zh: '它的个头很小。' });
    else if (sz >= 1.2) out.push({ k: 'size', v: 'big', en: 'It is big.', zh: '它的个头很大。' });
    return out;
  }
  // 目标 t = { map, hab, sp, shiny, cv } 的三条线索：[{ k, en, zh }]
  function clues(t) {
    const EM = EMaps(), D = DX(), m = t && EM && EM.get(t.map), sp = t && D && D.byId[t.sp];
    if (!m || !sp || !TERRAIN[t.hab]) return [];
    const cv = t.cv || [0, 0], tr = traits(sp, !!t.shiny), one = tr[(cv[1] || 0) % tr.length], ter = TERRAIN[t.hab];
    const c3 = { k: 'mon', trait: one.k, v: one.v, en: ter[0] + ' ' + one.en, zh: ter[1] + one.zh };
    return [isleClue(m.isle, cv[0] ? 1 : 0), placeClue(m), c3];
  }
  // 模板能拼出来的全部线索句子（tools/voice/collect.js 用来提前配音；两个版本的怪兽不一样，那边两个版本各跑一遍）
  function lines() {
    const EM = EMaps(), D = DX(), out = {}, byTer = {};
    if (!EM || !D) return [];
    EM.all().forEach(id => {
      const m = EM.get(id), ter = terrainOf(m);
      if (!ter) return;
      [0, 1].forEach(v => { out[isleClue(m.isle, v).en] = 1; });
      out[placeClue(m).en] = 1;
      fitPool(m).forEach(s => { (byTer[ter] = byTer[ter] || {})[s.id] = s; });
    });
    Object.keys(byTer).forEach(ter => Object.keys(byTer[ter]).forEach(id => traits(byTer[ter][id], false).forEach(t => { out[TERRAIN[ter][0] + ' ' + t.en] = 1; })));
    return Object.keys(out).sort();
  }

  // ---------- 大地图（world.js 调用） ----------
  const run = { prev: false, tm: 0 };   // prev：上一步也踩在对的地形上（刚下水、刚进地图的那一步不出来）
  const NOTE = ['Something rare is close!', '这附近有稀有怪兽的气息！'];
  // 对战顶上的标题（按现在的界面语言现取）
  const TAG = () => ({ title: '<span style="display:inline-block;padding:0 10px;border-radius:999px;background:var(--sun);color:var(--ink)">🔎 ' + hx('si.title') + '</span>', sub: tx('si.tag.sub'), msg: hx('si.tag.msg') });
  // 进了一张地图：有野生怪兽的记进 world.been（跟着 loadMap 里那次存档一起存）；是今天的目击地点就提示一句
  function onMap(M) {
    run.prev = false;
    if (!E || !M) return;
    const sg = rec(E.S);
    if (terrainOf(M)) E.S.world.been[M.id] = 1;
    clearTimeout(run.tm);
    if (!sg.map || sg.map !== M.id || sg.st === 'caught' || sg.day < E.dayStr()) return;
    run.tm = setTimeout(() => {
      if (!WH || WH.map() !== M || !WH.running()) return;
      const g = glossOf({ zh: NOTE[1] });
      E.toast('🔎 ' + NOTE[0] + (g ? ' ' + g : '') + (WH.spray() ? tx('si.note.spray') : ''), 'gold');
    }, 900);
  }
  // 走了一步。c = { map, hab 这一格会遇怪时的栖息地（不会遇怪是 ''）, surf 在水上, spray 悄悄喷雾还有效, idle 没有对话 / 剧情在进行 }
  // 返回 true = 目击的怪兽出来了（world.js 这一步就不再掷普通的遇怪）
  function onStep(c) {
    const sg = E && E.S.world.sight;
    if (!sg || !sg.map || sg.st === 'caught' || !c || !c.map || c.map.id !== sg.map) { run.prev = false; return false; }
    const here = !c.hab ? '' : c.map.kind === 'under' ? 'weed' : c.surf ? 'sea' : c.map.kind === 'cave' ? 'cave' : 'grass';
    if (here !== sg.hab) { run.prev = false; return false; }
    const was = run.prev;
    run.prev = true;
    if (sg.steps < sg.need) sg.steps++;
    // 传说怪兽正站在这张地图上等着的时候，不来抢戏
    if (sg.steps < sg.need || !was || c.spray || !c.idle || !MG.anyAlive() || (c.map.npcs || []).some(n => n.role === 'mlegend' || n.role === 'legend')) return false;
    if (sg.day < E.dayStr()) { run.prev = false; ensure(); return false; }   // 过了零点：昨天那只已经走了
    const sp = DX().byId[sg.sp];
    if (!sp) return false;
    const mon = MG.newMon(sg.sp, sg.lv);
    if (sg.shiny) mon.shiny = true;
    // 先记下「见过了」、步数重新数：这一场不管是跑掉、打倒还是输了，都要再走一阵它才会再出来
    sg.met = (sg.met || 0) + 1; sg.st = 'seen'; sg.steps = 0;
    sg.need = AGAIN[0] + Math.floor(h01(seedOf(E.S) + '|' + sg.day + '|again' + sg.met) * (AGAIN[1] - AGAIN[0] + 1));
    run.prev = false;
    WH.battle({ foes: [mon], hab: c.hab, tag: TAG(), after: res => ended(res, sp) });
    return true;
  }
  function ended(res, sp) {
    if (res === 'caught') { caught(sp); return; }
    if (res === 'win' || res === 'flee') E.toast(tx(res === 'win' ? 'si.end.win' : 'si.end.flee', { name: sp.en }));
  }
  const zhMode = () => { const m = E.S.settings.storyZh; return m === 'always' || m === 'tap' ? m : 'auto'; };
  function caught(sp) {
    const S = E.S, sg = rec(S);
    if (sg.st === 'caught') return;
    sg.st = 'caught';
    sg.streak = sg.last && nextDay(sg.last) === sg.day ? (sg.streak || 0) + 1 : 1;
    sg.last = sg.day; sg.total = (sg.total || 0) + 1;
    // 没点过「译」就算读懂了；界面语言没有线索的意思（英语界面）时本来就只能读英文，一定算
    const read = !sg.zh && (zhMode() !== 'always' || !glossy()), coins = COINS + (read ? COINS_READ : 0);
    S.coins += coins;
    E.save();
    if (E.SFX && E.SFX.coin) E.SFX.coin();
    E.toast(tx('si.caught', { name: sp.en, n: coins }) + (read && glossy() ? tx('si.caught.read', { n: COINS_READ }) : '') + (sg.streak > 1 ? tx('si.streak', { n: sg.streak }) : ''), 'gold');
    setTimeout(() => { if (E.checkAch) E.checkAch(); }, 1500);
  }

  // ---------- 首页卡片、冒险菜单里的告示板 ----------
  // 中文收不收起来：「总是显示」直接给中文；「自动」「点一下才显示」都先收成「译」（读懂英文才是这个玩法；点过的那条今天一直开着）
  const folded = (sg, i) => zhMode() !== 'always' && !((sg.zh || 0) & (1 << i));
  // 「译」按钮跟在英文后面（不另占一行，首页的卡片才不会太高）；点了以后换成英文下面的一行中文
  const ZH_BTN = 'display:inline-block;vertical-align:baseline;margin:0 0 0 4px;padding:0 10px;border:2px solid #1f8a9e;border-radius:999px;background:#e8f7f9;color:#16707f;font:inherit;font-size:13px;font-weight:800;line-height:1.3;cursor:pointer';
  const ZH_TXT = 'display:block;font-size:13px;font-weight:400;color:var(--ink-2);line-height:1.4';
  // 界面语言没有线索的意思（英语界面）：只有英文，没有「译」也没有中文那一行
  function clueRows(sg, list) {
    return '<div class="sg-clues" style="display:grid;gap:8px;margin:8px 0 2px">' + list.map((c, i) => {
      const g = glossOf(c);
      return '<div class="sg-clue" style="display:flex;gap:6px;align-items:flex-start;text-align:left">' +
      '<b style="flex:none;width:1.3em;color:var(--lagoon);line-height:1.35">' + '①②③'[i] + '</b>' +
      '<div style="flex:1;min-width:0;font-size:15px;font-weight:700;line-height:1.35;color:var(--ink)"><span class="sg-en">' + E.esc(c.en) + '</span>' +
      (!g ? '' : folded(sg, i) ? '<button class="sg-zh" data-act="sgZh" data-i="' + i + '" aria-label="' + hx('si.zh.aria') + '" style="' + ZH_BTN + '">' + hx('si.zh.btn') + '</button>'
        : '<span class="sg-zh" data-i="' + i + '" style="' + ZH_TXT + '">' + E.esc(g) + '</span>') + '</div>' +
      '<button class="spk mini" data-act="sayText" data-t="' + E.esc(c.en) + '" aria-label="' + hx('si.hear') + '" style="flex:none;width:34px;height:34px;border-radius:10px;box-shadow:0 3px 0 var(--lagoon-d)">' + E.SPK + '</button></div>';
    }).join('') + '</div>';
  }
  // 现在的样子（首页、菜单、测试都用这个）：st = none 还没有地方可去 / new 还没找到 / seen 见过了 / caught 收服了
  function state() {
    const sg = ensure();
    if (!sg) return { st: 'none', total: 0, streak: 0, clues: [] };
    const sp = sg.sp ? DX().byId[sg.sp] : null, day = E.dayStr();
    return { st: !sg.map || !sp ? 'none' : sg.st === 'caught' ? 'caught' : sg.st === 'seen' ? 'seen' : 'new', sg, sp, clues: sg.map && sp ? clues(sg) : [], total: sg.total || 0, streak: streakNow(sg, day) };
  }
  const tally = (st, short) => (st.total ? '⭐ ' + hx(short ? 'si.tally.s' : 'si.tally', { n: st.total }) + (st.streak > 1 ? hx('si.streak', { n: st.streak }) : '') : '');
  // 标题：中文界面后面跟一行小字英文名；英语界面标题本身就是英文
  const HEAD = () => { const sub = tx('si.title.sub'); return '🔎 ' + hx('si.title') + (sub ? ' <small style="font-weight:700;color:var(--ink-3);font-size:12px">' + E.esc(sub) + '</small>' : ''); };
  // 首页「怪兽冒险」里的卡片：没找到时摆出三条线索，收服了就收成一行
  function homeCard() {
    if (!E || !DX() || !EMaps()) return '';
    const st = state(), one = 'padding:10px 16px';
    if (st.st === 'none') return '<section class="mon-card sight none" style="' + one + '"><p>' + HEAD() + hx('si.card.none') + '</p></section>';
    if (st.st === 'caught') return '<section class="mon-card sight done" style="' + one + '"><p style="display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline"><span>' + hx('si.card.done', { name: (st.sg.shiny ? '✨' : '') + st.sp.en }) + '</span>' +
      '<span style="margin-left:auto;font-size:13px;color:var(--ink-3)">' + tally(st, true) + '</span></p></section>';
    return '<section class="mon-card sight" style="padding:12px 16px"><h3 style="margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:17px">' + HEAD() +
      '<span class="lvchip" style="margin-left:auto">' + hx(st.st === 'seen' ? 'si.st.seen' : 'si.st.new') + '</span></h3>' +
      '<p style="font-size:13px">' + hx('si.card.lead') + '</p>' + clueRows(st.sg, st.clues) +
      '<p class="tip" style="text-align:left">' + (tally(st) ? tally(st) + ' · ' : '') + '<button class="link" data-act="sgOpen" style="padding:2px 0">' + hx('si.how') + '</button></p></section>';
  }
  // 冒险菜单里「现在要做」下面的一行：现在的状态，点开是告示板（做成 .ach 一行：横屏时和「现在要做」并排，不多占一排按钮）
  function menuRow() {
    if (!E) return '';
    const st = state(), txt = hx({ none: 'si.row.none', new: 'si.row.new', seen: 'si.st.seen', caught: 'si.row.caught' }[st.st]);
    return '<div class="ach" data-act="sgOpen" role="button" tabindex="0" style="cursor:pointer"><span class="ae">🔎</span><div style="flex:1"><b>' + hx('si.title') + '</b><small>' + txt + '</small></div><span style="color:var(--ink-3);font-weight:800">›</span></div>';
  }
  // 告示板（首页卡片的「怎么找？」、冒险菜单里的「今日目击」）
  function sheet() {
    if (!E) return;
    const st = state(), spray = WH && WH.running() && WH.spray();
    let h = '<h2>🔎 ' + hx('si.title') + '</h2><p class="tip">' + hx('si.sheet.sub') + '</p>';
    if (st.st === 'none') h += '<p>' + hx('si.sheet.none') + '</p>';
    // （状态写成一段话，不用 .ach 那种卡片：横屏的弹窗里它只占三分之一宽，三条线索就被挤到下面去了）
    // 怪兽的中文名是它英文名的意思：英语界面不跟在后面
    else if (st.st === 'caught') { const n = (st.sg.shiny ? '✨' : '') + st.sp.en, g = glossOf(st.sp); h += '<p class="sg-st">' + hx('si.sheet.done', { name: g ? tx('si.paren', { name: n, zh: g }) : n }) + '</p>' + clueRows(st.sg, st.clues); }
    else {
      // 界面语言有线索的意思（中文界面）：收服 +30，一条都不点「译」再 +20；没有（英语界面）：只能读英文，直接写一共多少
      const gl = glossy();
      h += '<p class="sg-st">' + hx(st.st === 'seen' ? 'si.sheet.seen' : 'si.sheet.new') + '</p>' + clueRows(st.sg, st.clues) +
        '<p class="tip" style="text-align:left">' + hx('si.sheet.how', { n: gl ? COINS : COINS + COINS_READ }) +
        (gl && zhMode() !== 'always' ? hx('si.sheet.read', { n: COINS_READ }) : '') + hx('si.sheet.how2') +
        (spray ? hx('si.sheet.spray') : '') + '</p>';
    }
    if (tally(st)) h += '<p class="tip">' + tally(st) + '</p>';
    E.openModal(h + '<button class="btn wide" data-act="close" data-focus>' + hx('si.ok') + '</button>');
  }
  const actions = {
    sgOpen: () => sheet(),
    // 点「译」看这一条的中文：记进今天的学习记录（周报「看中文 X 次」），今天这条就一直开着
    sgZh: t => {
      const sg = rec(E.S), i = +t.dataset.i, c = clues(sg)[i], g = c && glossOf(c);
      if (!g) return;
      sg.zh = (sg.zh || 0) | (1 << i);
      const L = E.dayLog && E.dayLog();
      if (L) L.zhTaps = (L.zhTaps || 0) + 1;
      E.save();
      document.querySelectorAll('button.sg-zh[data-i="' + i + '"]').forEach(b => { b.outerHTML = '<span class="sg-zh" data-i="' + i + '" style="' + ZH_TXT + '">' + E.esc(g) + '</span>'; });
    },
  };

  window.EchoSight = {
    // world.js 的 init() 里调用：返回按钮的处理函数（并进 ACT）
    init(api, mg, hooks) { E = api; MG = mg; WH = hooks || null; return actions; },
    fresh,
    homeCard, sheet, state, may,
    // 大地图每进一张图、每走一步都会调这几个：这里出了错只记一笔，不能让走路、换地图、开菜单跟着坏掉
    menuRow: () => { try { return menuRow(); } catch (e) { console.error(e); return ''; } },
    onMap: M => { try { onMap(M); } catch (e) { console.error(e); } },
    onStep: c => { try { return onStep(c); } catch (e) { console.error(e); return false; } },
    // 下面这些也给测试和 tools/voice/collect.js 用
    pick, roll, reach, cands, clues, lines, terrainOf, pathFrom, placeKey, colourOf, traits, extraHab,
    K: { SHINY, NEED, AGAIN, COINS, COINS_READ, SKIP, HAB3, FIT, TERRAIN, NOTE, get TAG() { return TAG(); } },
    _run: run,
  };
})();
