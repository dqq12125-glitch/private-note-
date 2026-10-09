// 回声岛 Echo Island — 游戏逻辑（纯前端，无需安装）

// 出错记录 window.EchoErr 在 errlog.js（index.html 的 <head> 里第一个加载，后面的文件加载时出错也记得到）

(function () {
  'use strict';

  const W = window.WORLDS;
  // 课本单元（book.js）：课本的每个单元和小岛一样有单词/句子/对话，接在 13 座岛后面编号（第 NB 号起），
  // 闯关、错题本、冒险出题都用 WX[编号]；只有岛屿才有的东西（岛主、徽章、乘风、对话动画）还是用 W
  const BOOKS = (window.BOOKS && window.BOOKS.list) || [];
  const BK = BOOKS.flatMap((b, bi) => b.units.map(u => Object.assign(u, { book: b.id, bshort: b.short, bi })));   // 所有册的单元排成一列
  const NB = W.length, WX = W.concat(BK);
  const isUnit = wi => wi >= NB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const range = n => Array.from({ length: n }, (_, i) => i);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  // ---------- 关卡配方：每个岛 7 关，最后是 Boss ----------
  const RECIPES = [
    { name: '听词', icon: '🎧', desc: '听单词，选出意思和拼写。', mix: [['lw', 6], ['ls', 4]] },
    { name: '说词', icon: '🎤', desc: '跟读单词，再看图说出英文。', mix: [['sr_w', 4], ['sp', 4], ['lw', 2]] },
    { name: '听句', icon: '🎧', desc: '听整句话，理解意思、排出顺序。', mix: [['lm', 5], ['lo', 3], ['ls', 2]] },
    { name: '说句', icon: '🎤', desc: '一句一句跟读，把句子说顺。', mix: [['sr_s', 5], ['lo', 2], ['lm', 3]] },
    { name: '对话', icon: '💬', desc: '听对方说话，选出并说出合适的回答。', mix: [['lr', 6], ['sr_d', 4]] },
    { name: '挑战', icon: '⚡', desc: '所有题型混在一起，还会复习前面岛上的内容。', mix: [['lw', 2], ['ls', 1], ['lm', 2], ['lo', 2], ['lr', 2], ['sr_s', 2], ['sp', 1]], review: true },
    { name: 'BOSS', icon: '👑', desc: '和岛主面对面对话！听懂它的话，大声说出正确回答来攻击它。', mix: [['bt', 6], ['lo', 2]], boss: true },
  ];
  const KIND = { lw: 'word', ls: 'word', sp: 'word', sr_w: 'word', lm: 'sent', lo: 'sent', sr_s: 'sent', lr: 'dlg', sr_d: 'dlg', bt: 'dlg' };
  const TYPE_LABEL = { lw: '🎧 听音选义', ls: '🎧 听音选词', lm: '🎧 听句选意', lr: '💬 听问选答', lo: '🧩 听音排句', sr_w: '🎤 单词跟读', sr_s: '🎤 句子跟读', sr_d: '🎤 说出回答', sp: '🖼️ 看图说英语', bt: '⚔️ 对话攻击' };
  const TYPE_TAG = { lw: '听音选义', ls: '听音选词', lm: '听句选意', lr: '听问选答', lo: '听音排句', sr_w: '单词跟读', sr_s: '句子跟读', sr_d: '说出回答', sp: '看图说英语', bt: '对话攻击' };
  const SPEAK_TYPES = ['sr_w', 'sr_s', 'sr_d', 'sp'];
  const PRAISE = ['太棒了！', 'Great!', 'Nice!', '答对了！', 'Excellent!', 'Well done!', '厉害！'];

  const TITLES = [[1, '见习水手'], [3, '小小水手'], [5, '听力侦探'], [7, '口语新星'], [10, '发音达人'], [13, '对话高手'], [16, '岛屿探险家'], [20, '英语船长'], [25, '回声大师'], [30, '传奇船长']];
  const PETS = [['🐣', 0, '小鸡'], ['🐱', 60, '小猫'], ['🐶', 60, '小狗'], ['🐰', 80, '兔子'], ['🐸', 80, '青蛙'], ['🦊', 120, '狐狸'], ['🐼', 150, '熊猫'], ['🐧', 150, '企鹅'], ['🦉', 200, '猫头鹰'], ['🐬', 250, '海豚'], ['🦄', 400, '独角兽'], ['🐲', 600, '小龙']];
  const CHEST_PETS = [['🦖', '小恐龙'], ['🦋', '蝴蝶'], ['🐙', '小章鱼']];

  const QPOOL = [
    { id: 'lv2', t: '完成 2 个关卡', goal: 2, key: 'levels', rw: 20 },
    { id: 'lv4', t: '完成 4 个关卡', goal: 4, key: 'levels', rw: 40 },
    { id: 'sp10', t: '开口说对 10 次', goal: 10, key: 'spoken', rw: 20 },
    { id: 'sp25', t: '开口说对 25 次', goal: 25, key: 'spoken', rw: 40 },
    { id: 'cb8', t: '一关里连击达到 8', goal: 8, key: 'combo', max: true, rw: 30 },
    { id: 'st3', t: '拿到 1 次三星', goal: 1, key: 'three', rw: 30 },
    { id: 'pf5', t: '获得 5 次 Perfect 发音', goal: 5, key: 'perfect', rw: 30 },
    { id: 'ls20', t: '听力题答对 20 道', goal: 20, key: 'listen', rw: 20 },
    { id: 'rv5', t: '每日复习答对 5 题', goal: 5, key: 'review', rw: 30 },
    { id: 'rp1', t: '完成 1 次对话角色扮演', goal: 1, key: 'roleplay', rw: 30 },
    { id: 'bt3', t: '赢得 3 场怪兽对战', goal: 3, key: 'battle', rw: 30 },
    { id: 'ct1', t: '收服 1 只野生怪兽', goal: 1, key: 'catch', rw: 40 },
    { id: 'tk1', t: '用英语和岛民聊天，完成 1 个目标', goal: 1, key: 'talk', rw: 40 },
  ];
  const QDEF = Object.fromEntries(QPOOL.map(q => [q.id, q]));

  const ACH = [
    ['first', '🚩', '起航', '完成第 1 关', s => s.stats.levels >= 1],
    ['lv10', '⛵', '乘风破浪', '完成 10 关', s => s.stats.levels >= 10],
    ['lv50', '🚢', '远洋航行', '完成 50 关', s => s.stats.levels >= 50],
    ['boss1', '⚔️', '初战告捷', '打败第 1 个 Boss', s => s.stats.bosses >= 1],
    ['boss5', '🛡️', 'Boss 猎人', '打败 5 个 Boss', s => s.stats.bosses >= 5],
    ['allboss', '👑', '群岛之王', '打败全部 13 个 Boss', s => W.every((w, i) => (s.stars[i + '-6'] || 0) > 0)],
    ['c10', '🔥', '十连击', '一关里连击 10 次', s => s.stats.maxCombo >= 10],
    ['flaw', '🎯', '零失误', '一关里每题都答对', s => s.stats.flawless >= 1],
    ['sp50', '🎤', '敢开口', '开口说对 50 次', s => s.stats.spoken >= 50],
    ['sp300', '📣', '口语达人', '开口说对 300 次', s => s.stats.spoken >= 300],
    ['pf30', '💯', '标准发音', '获得 30 次 Perfect 发音', s => s.stats.perfect >= 30],
    ['st3', '📅', '三天打卡', '连续打卡 3 天', s => s.streak >= 3],
    ['st7', '🗓️', '一周不断', '连续打卡 7 天', s => s.streak >= 7],
    ['st30', '🏅', '月度坚持', '连续打卡 30 天', s => s.streak >= 30],
    ['three10', '⭐', '星星收集者', '拿到 10 次三星', s => s.stats.threeStars >= 10],
    ['world', '🏝️', '完美海岛', '一个岛的 7 关全部三星', s => W.some((w, i) => range(7).every(l => (s.stars[i + '-' + l] || 0) === 3))],
    ['rv20', '📕', '温故知新', '每日复习答对 20 题', s => s.stats.reviewed >= 20],
    ['pets3', '🐾', '宠物之家', '拥有 3 只宠物', s => s.pets.length >= 3],
    ['rich', '💰', '小富翁', '同时拥有 500 金币', s => s.coins >= 500],
    ['actor', '🎬', '小演员', '完成 5 次对话角色扮演', s => s.stats.roleplay >= 5],
    ['catch1', '🔮', '第一个伙伴', '收服第 1 只野生怪兽', s => (s.mon.caught || 0) >= 1],
    ['dex8', '📖', '手册收集家', '手册点亮 8 种怪兽', s => window.MonsterGame && MonsterGame.caughtCount(s) >= 8],
    ['dexall', '🌈', '怪兽大师', '手册点亮第一大区全部 ' + ((window.DEX && DEX.region1Total) || '') + ' 种', s => { const r = window.EchoWorld && EchoWorld.dexRegion ? EchoWorld.dexRegion(s) : null; return !!r && r.total > 0 && r.caught >= r.total; }],
    ['evo1', '✨', '进化！', '第一次让怪兽进化', s => (s.mon.evolved || 0) >= 1],
    ['badge5', '🏅', '徽章收集者', '拿到 5 枚岛主徽章', s => Object.keys(s.mon.badges).length >= 5],
    ['badgeall', '🏆', '冠军训练师', '拿到全部 13 枚岛主徽章', s => Object.keys(s.mon.badges).length >= W.length],
  ];

  // ---------- 存档 ----------
  const KEY = 'echo-island-v1';
  function fresh() {
    return {
      v: 1, xp: 0, coins: 50, stars: {}, streak: 0, lastDay: '', freeze: 0,
      quests: { day: '', list: [], chest: false }, wrong: {}, pets: ['🐣'], pet: '🐣', ach: {},
      stats: { levels: 0, spoken: 0, perfect: 0, maxCombo: 0, listen: 0, reviewed: 0, threeStars: 0, bosses: 0, flawless: 0, roleplay: 0 }, scenes: {},
      settings: { rate: 0.9, voice: '', mode: 'auto', tts: 'auto', sfx: true, unlockAll: false, gfx: 'auto', gfxAuto: '', ctl: 'joy', orient: 'portrait', gate: true, music: 'mid',
        // 冒险时间（家长设置）：on 限时、wd 上学日 / we 周末每天几分钟、from–to 这段时间不能冒险、max 多学一点最多奖励几分钟
        limit: { on: true, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 },
        push: '',                                 // 日报推送：PushPlus 的 token 或企业微信群机器人的 webhook 地址（空 = 不发）
        pinLock: { n: 0, until: 0, lockouts: 0 },  // 网页版家长密码输错的次数、锁到什么时候、一共被锁过几次（APK 里由原生管）
        verUrl: '',                               // 检查新版本的地址（家长设置里改；空 = 默认的 GitHub Pages 上的 version.json）
        family: null,                             // 销售版：家长首次设置向导的结果和家庭定制（setup.js 的 EchoSetup，「清空进度」也留着）
      }, seenIntro: false,
      micCheck: '',        // 第一次「麦克风 + 网络 + 密钥」小检查做过了没有（日期；'skip' = 先跳过了）
      upd: {},             // 最近一次查到的新版本：{ code, name, url, notes, at }（只有 APK 查）
      log: {},   // 每天的学习记录（周报用）：日期 → { min 玩了几分钟, learn 学习分钟, play 冒险分钟, levels 关卡, spoken 开口说对, review 复习答对, … }
      weekly: [],          // 每周压成一行、永久保留（S.log 只留 45 天）：见 weeklyRoll()
      push: { sent: '' },  // 日报最后发到哪一天了
      homeTab: 'mon', mon: window.MonsterGame ? MonsterGame.fresh() : { box: [], team: [], dex: {}, badges: {}, balls: 5 },
      world: window.EchoWorld ? EchoWorld.fresh() : {},
      player: { gender: '', name: '' },
      talk: { log: [], done: {}, days: {} },   // 和岛民聊天（talk.js）：最近的记录、每个岛民最好几星、今天拿过金币的
      book: { at: -1, mix: .6, view: 'book', vb: '' },   // 课本单元：正在学的单元（BK 里第几个，-1 = 没选过，按日期猜）、冒险出题里课本占几成、闯关页看课本还是小岛、正在看哪一册
      rev: { items: {}, v: 0, day: { d: '', n: 0, f: 0 } },   // 每日复习（间隔复习）：见 revWrong / revRight / dueList；day = 今天新进了几条（n）、冒险里算了几次复习（f）
    };
  }
  function merge(base, o) {
    for (const k in o) {
      const a = base[k], b = o[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object' && !Array.isArray(a)) merge(a, b);
      else base[k] = b;
    }
    return base;
  }
  // ---------- 存档的备份（家长 2026-10-07，评估第 7 条）----------
  // ① 每天第一次保存前，把上一份存档复制成这台设备上的 bak1（原来的 bak1 → bak2 → bak3，留 3 份，哪天的记在 bakmeta）；
  // ② 存档读不出来（坏了）：不覆盖它——先原样另存一份（KEY-bad），再用最近一份好的备份（本机 bak1–3，APK 再看手机「下载/EchoIsland」里的），
  //    打开后告诉孩子（RT.restored）；一份好的都没有才从头开始；
  // ③ APK：每天第一次保存时往手机「下载/EchoIsland/」写一份（EchoNative.backupWrite：原生只留最近 7 份，卸载 App 也不删），
  //    切到后台时隔 1 小时以上再写一次（同一天覆盖同一份）。
  // 设置里「导出存档」（分享到微信 / 网页版下载成文件）、「从备份恢复」（要家长密码）见 exportSave / restoreSheet。
  const BAK = [1, 2, 3].map(n => KEY + '-bak' + n), BAK_META = KEY + '-bakmeta', BAD = KEY + '-bad', PRE = KEY + '-pre';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  // 读得出来、是一个存档对象 → 对象；写了一半、乱码、不是对象 → null
  function parseSave(txt) {
    if (!txt || typeof txt !== 'string') return null;
    try { const o = JSON.parse(txt); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
  }
  const bakMeta = () => { try { return JSON.parse(lsGet(BAK_META) || '{}') || {}; } catch (e) { return {}; } };
  const nat = f => { try { return window.EchoNative && typeof EchoNative[f] === 'function'; } catch (e) { return false; } };
  // 最近一份读得出来的备份：{ o 存档, txt, label 哪里的哪天的 }；先看本机的 3 份，再看手机「下载/EchoIsland」里的
  function bestBackup() {
    const meta = bakMeta();
    for (let i = 0; i < BAK.length; i++) {
      const txt = lsGet(BAK[i]), o = parseSave(txt);
      if (o) return { o, txt, label: '这台设备上 ' + (meta['d' + (i + 1)] || '以前') + ' 的备份' };
    }
    if (nat('backupList') && nat('backupRead')) {
      try {
        for (const b of JSON.parse(EchoNative.backupList() || '[]').slice(0, 7)) {
          const txt = EchoNative.backupRead(b.name), o = parseSave(txt);
          if (o) return { o, txt, label: '手机「下载/EchoIsland」里 ' + (b.date || b.name) + ' 的备份' };
        }
      } catch (e) { /* 读不到就算了 */ }
    }
    return null;
  }
  function load(fallback) {
    const raw = lsGet(KEY);
    if (raw) {
      const o = parseSave(raw);
      if (o) return merge(fresh(), o);
      // 存档坏了：原样另存一份（不覆盖、能抢救），再用最近一份好的备份
      RT.badSave = true;
      const b = bestBackup();
      if (!lsSet(BAD, raw)) {   // 地方不够：腾掉最老的一份备份再存（要是正好要用它，b 里已经拿到了）
        try { localStorage.removeItem(BAK[2]); } catch (e) { /* 忽略 */ }
        if (!lsSet(BAD, raw)) RT.noSave = true;   // 连另存的地方都没有：这次先不保存，免得把坏档盖掉
      }
      if (window.EchoErr) EchoErr.log('app', '存档读不出来（' + raw.length + ' 字）', 'load');
      RT.restored = b ? b.label : 'none';
      if (b) { if (!RT.noSave) lsSet(KEY, b.txt); return merge(fresh(), b.o); }
      return fresh();
    }
    if (fallback) return merge(fresh(), fallback);
    return fresh();
  }
  function save() {
    if (RT.noSave) return;
    let txt;
    try { txt = JSON.stringify(S); } catch (e) { if (window.EchoErr) EchoErr.log('app', '存档写不出来：' + e.message, 'save'); return; }
    const d = dayStr();
    if (RT.bakDay !== d) { RT.bakDay = d; dailyBackup(d, txt); }
    if (lsSet(KEY, txt)) return;
    // 存不下（空间满了）：先扔掉最老的一份备份再试
    try { localStorage.removeItem(BAK[2]); } catch (e) { /* 忽略 */ }
    if (!lsSet(KEY, txt) && !RT.saveWarned) {
      RT.saveWarned = true;
      if (window.EchoErr) EchoErr.log('app', '存档存不进去（空间满了？）', 'save');
      // 第一次存不进去就说一声（只说一次）：不然孩子每次玩的进度都悄悄丢了
      setTimeout(() => {
        const t = '存档存不进去了（手机给游戏的空间满了），今天玩的可能存不下来。请家长在 设置 → 💾 存档备份 里先「导出存档」。';
        if ($('#modal').hidden) openModal('<div class="big">💾</div><h2>存档存不进去了</h2><p>' + t + '</p><button class="btn wide" data-act="close" data-focus>知道了</button>');
        else toast('💾 ' + t);
      }, 0);
    }
  }
  // 每天第一次保存前：上一份存档 → bak1（原来的往后挪）；APK 往手机「下载/EchoIsland」写一份
  function dailyBackup(d, txt) {
    const meta = bakMeta();
    if (meta.day !== d) {
      const cur = lsGet(KEY);
      if (parseSave(cur)) {   // 坏的不往备份里放
        const v1 = lsGet(BAK[0]), v2 = lsGet(BAK[1]);
        if (v2) lsSet(BAK[2], v2);
        if (v1) lsSet(BAK[1], v1);
        lsSet(BAK[0], cur);
        meta.d3 = meta.d2; meta.d2 = meta.d1; meta.d1 = meta.day || '以前';   // 上一份存档最后是哪天存的
      }
      meta.day = d;
      lsSet(BAK_META, JSON.stringify(meta));
    }
    nativeBackup(txt);
  }
  function nativeBackup(txt) {
    if (!nat('backupWrite')) return;
    try { if (EchoNative.backupWrite(txt || JSON.stringify(S))) RT.natBakAt = Date.now(); } catch (e) { /* 写不了就算了，本机还有 3 份 */ }
  }

  let S = fresh();
  const RT = { srBroken: false, noRec: false, rec: null, mr: null, recUrl: '', listening: false, recording: false, lastRest: Date.now(), resetArm: false, scrollCur: true,
    pin: null, pinPass: null, parentUntil: 0, parentOpen: false, lastAct: null, advStop: '', battleEnd: 0, fakeNow: 0, fakeAt: 0, pushTry: 0,
    // AI 打分用不了（aiNote）：aiFails 连着失败几次、aiFailAt 最近一次、aiBar 首页红条 { cls, why, at }、aiOkAt 最近一次成功
    aiFails: 0, aiFailAt: 0, aiBar: null, aiOkAt: 0,
    // 存档：badSave 读到坏档、restored 用了哪份备份（'none' = 一份好的都没有）、noSave 这次不保存、bakDay 今天轮换过备份没有、natBakAt 最近往手机写备份的时间
    badSave: false, restored: '', noSave: false, bakDay: '', natBakAt: 0 };
  let P = null; // 当前关卡

  // ---------- 日期 / 连续打卡 ----------
  const dayStr = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  function checkStreak() {
    if (!S.lastDay) return;
    const d = dayDiff(S.lastDay, dayStr());
    if (d <= 1) return;
    if (d === 2 && S.freeze > 0 && S.streak > 0) {
      S.freeze--;
      S.lastDay = dayStr(new Date(Date.now() - 864e5));
      setTimeout(() => toast('🧊 连胜保护卡生效，' + S.streak + ' 天连续打卡保住了！', 'gold'), 600);
    } else if (S.streak > 0) {
      const lost = S.streak;
      S.streak = 0;
      setTimeout(() => toast('💧 ' + lost + ' 天的连续打卡断了，今天重新开始吧'), 600);
    }
    save();
  }
  function markToday() {
    const t = dayStr();
    if (S.lastDay === t) return false;
    const d = S.lastDay ? dayDiff(S.lastDay, t) : 99;
    S.streak = d === 1 ? S.streak + 1 : 1;
    S.lastDay = t;
    return true;
  }

  // ---------- 等级 ----------
  function lvInfo(xp) {
    let lv = 1, need = 100, x = xp;
    while (x >= need) { x -= need; lv++; need = 100 + (lv - 1) * 40; }
    return { lv, cur: x, need };
  }
  const titleOf = lv => TITLES.filter(t => t[0] <= lv).pop()[1];

  // ---------- 音效（WebAudio 合成，无需文件） ----------
  let AC = null;
  function ac() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, t0, dur, type, vol) {
    if (!S.settings.sfx) return;
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    ok(c) { const b = 523 * Math.pow(1.059, Math.min(c, 14)); tone(b, 0, .12, 'triangle', .16); tone(b * 1.26, .07, .12, 'triangle', .16); tone(b * 1.5, .14, .22, 'triangle', .16); },
    bad() { tone(233, 0, .16, 'sawtooth', .06); tone(174, .13, .26, 'sawtooth', .06); },
    star(i) { tone(784 * Math.pow(1.19, i), 0, .35, 'sine', .2); tone(1568 * Math.pow(1.19, i), .02, .25, 'sine', .06); },
    coin() { tone(988, 0, .08, 'square', .05); tone(1319, .07, .22, 'square', .05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .3, 'triangle', .16)); tone(1047, .5, .6, 'sine', .12); },
    hit() { tone(140, 0, .18, 'square', .1); tone(90, .06, .25, 'sawtooth', .08); },
    tap() { tone(700, 0, .05, 'sine', .05); },
  };
  // ---------- 配乐（music.js 现场合成；这里决定什么时候放哪首） ----------
  // 设置「音乐」关 / 小 / 中 / 大；大地图和战斗的曲子由 world.js / monsters.js 选，这里管首页和练习
  const MVOL = { off: 0, low: 0.35, mid: 0.6, high: 0.85 };
  const MUS = () => window.EchoMusic || null;
  const musicOn = () => !!MUS() && S.settings.music !== 'off' && MUS().state().enabled;
  function music(id) { const m = MUS(); if (m && id !== undefined) m.play(id); }
  // 一次性的小音乐（胜利、收服、恢复……）；音乐关着或者放不了时，用原来的音效 sfx 代替
  function jingle(id, sfx) {
    if (musicOn()) return MUS().jingle(id);
    if (sfx) sfx();
    return Promise.resolve();
  }
  function musicVol() { const m = MUS(); if (m) m.setVolume(MVOL[S.settings.music] != null ? MVOL[S.settings.music] : MVOL.mid); }
  // 这个画面该放哪首：首页放主题曲，闯关练习 / 复习 / 对话剧场放学习音乐，大地图问 EchoWorld，战斗由 monsters.js 开战时选好
  function sceneMusic() {
    const s = RT.scr;
    if (s === 'world') { const id = window.EchoWorld && EchoWorld.music ? EchoWorld.music() : ''; if (id) music(id); return; }
    if (s === 'battle') return;
    music(s === 'home' ? 'title' : 'study');
  }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 不支持 */ } }

  // ---------- 朗读：提前合成的自然配音（打包在 assets/voice）→ 阿里云现场合成（qwen3-tts-flash）→ 浏览器自带的英语声音 ----------
  // 不再用有道的在线发音接口（评估「必须改」第 7 条：非公开接口，没有商用授权）。APK 的 WebView 没有本机声音：配音和阿里云都不行时就不出声
  const TTS = { voices: [], v: null, ok: 'speechSynthesis' in window, loaded: false };
  const PREF = [/(Aria|Jenny|Ava|Emma|Guy).*(Online|Natural)/i, /Google US English/i, /Samantha/i, /Microsoft (Aria|Jenny|Zira|David)/i, /Google UK English Female/i, /Karen|Daniel|Moira|Tessa/i];
  // ---------- 自然配音：tools/voice/gen.py 用本机开源模型 Kokoro（Apache-2.0）提前合成的固定句子（assets/voice/{f,m}/<key>.mp3） ----------
  // 文件名是规范化文本的 FNV-1a 哈希，和 tools/voice/key.js 一样；没合成的句子（拼了名字的）联网时用阿里云现场合成，再不行用本机声音
  const CLIP = { f: new Set(), m: new Set() };
  function clipKey(t) {
    // 和 tools/voice/key.js 一样：表情符号不念，去掉再算
    const s = String(t).replace(/[\p{Extended_Pictographic}\u200D\uFE0F]/gu, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  try {
    if (location.protocol !== 'file:') fetch('assets/voice/index.json').then(r => (r.ok ? r.json() : null)).then(j => { if (j) { CLIP.f = new Set(j.f || []); CLIP.m = new Set(j.m || []); } }).catch(() => {});
  } catch (e) { /* file:// 打开时读不了，就不用配音 */ }
  function clipUrl(text, g) {
    const k = clipKey(text);
    for (const x of g === 'm' ? ['m', 'f'] : ['f', 'm']) if (CLIP[x].has(k)) return 'assets/voice/' + x + '/' + k + '.mp3';
    return '';
  }
  const FEM = /female|samantha|aria|jenny|ava|emma|zira|karen|moira|tessa|serena|victoria|allison|susan|libby|sonia|natasha|michelle|joanna|salli|kendra|fiona|kate/i;
  const MALE = /\bmale|daniel|david|guy|alex|fred|mark|ryan|aaron|arthur|george|thomas|oliver|christopher|eric|roger|brian|matthew|justin|rishi/i;
  const genderOf = v => !v ? '' : /female/i.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : FEM.test(v.name) ? 'f' : '';
  function loadVoices() {
    if (!TTS.ok) return;
    const all = speechSynthesis.getVoices();
    if (all.length) TTS.loaded = true;
    TTS.voices = all.filter(v => /^en([-_]|$)/i.test(v.lang));
    pickVoice();
  }
  function pickVoice() {
    const vs = TTS.voices;
    TTS.v = vs.find(v => v.name === S.settings.voice) || PREF.map(p => vs.find(v => p.test(v.name))).find(Boolean) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs[0] || null;
    const pool = [TTS.v, ...vs.filter(v => /en[-_]US/i.test(v.lang)), ...vs].filter(Boolean);
    TTS.vf = pool.find(v => genderOf(v) === 'f') || null;
    TTS.vm = pool.find(v => genderOf(v) === 'm') || null;
  }
  // 能不能用本机（浏览器自带）的英语声音：设置「只用配音」时不用；没有英语声音、合成失败过也不用
  const deviceOk = () => S.settings.tts !== 'online' && TTS.ok && !RT.ttsBroken && !(TTS.loaded && !TTS.voices.length);
  // 能不能请阿里云现场合成：设置「本机声音」时不用；要联网、有 AI 连接（APK 有密钥 / 网页版连得上中转服务），连续失败 3 次就这次打开游戏不再试
  const cloudOk = () => S.settings.tts !== 'device' && navigator.onLine !== false && !!(window.EchoTalk && EchoTalk.cloudTTS && EchoTalk.cloudSR && EchoTalk.cloudSR()) && !RT.cloudTTSBroken;
  function endPlaying() { $$('.spk.playing').forEach(b => b.classList.remove('playing')); }
  function startPlaying() { const main = $('#p-body .spk:not(.mini)'); if (main) main.classList.add('playing'); }
  // 没有能用的声音（没有配音、连不上阿里云、也没有本机声音）：不出声，APK 里第一次提醒一下。
  // 按句子长短停一小会儿再算「读完」（背景音乐照样压低这一会儿），对话、剧场的节奏和有声音时差不多
  function silent(res, text) {
    endPlaying();
    if (!RT.ttsWarned && window.ECHO_APP) { RT.ttsWarned = true; toast('这句的声音要联网才能听到'); }
    setTimeout(res, Math.min(1500, 200 + String(text || '').length * 20));
  }
  // 放一段音频（配音文件或阿里云合成的地址）；放不出来就 onFail()（没给就不出声）
  function playUrl(text, rate, res, g, url, onFail) {
    const a = RT.audio || (RT.audio = new Audio());
    let done = false;
    const fin = () => { if (done) return; done = true; endPlaying(); res(); };
    const t = setTimeout(fin, 4000 + text.length * 200);
    a.onended = fin;
    a.onerror = () => {
      if (done) return;
      done = true; clearTimeout(t);
      if (onFail) onFail(); else silent(res, text);
    };
    a.src = url;
    a.playbackRate = (rate || S.settings.rate) < 0.75 ? 0.75 : 1;
    startPlaying();
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => { if (!done) toast('点一下 🔊 就能听到发音'); fin(); });
  }
  // g：对话角色的声音 'f' / 'm'；不传就用默认声音。朗读的时候把背景音乐压低，读完恢复
  // 只认最新的一句：新的一句打断旧的时，旧的那句晚一点才结束也不会提前把音乐放回来
  let duckTok = null;
  function say(text, rate, g) {
    if (!text) return Promise.resolve();
    const m = MUS(), tok = {};
    if (m) { if (!duckTok) m.duck(true); duckTok = tok; }
    return sayRaw(text, rate, g).then(() => { if (m && duckTok === tok) { duckTok = null; m.duck(false); } });
  }
  function sayRaw(text, rate, g) {
    return new Promise(res => {
      if (!text) return res();
      stopListening();
      if (TTS.ok) speechSynthesis.cancel();
      if (RT.audio) RT.audio.pause();
      const id = RT.sayId = (RT.sayId || 0) + 1;
      const clip = S.settings.tts === 'device' ? '' : clipUrl(text, g);
      // 配音文件没加载出来（APK 里不会，网页版断网时可能）：当成没有配音的句子
      if (clip) { playUrl(text, rate, res, g, clip, () => sayCloud(text, rate, res, g, id)); return; }
      sayCloud(text, rate, res, g, id);
    });
  }
  // 没有提前配音的句子（带名字的台词等）：能连阿里云就现场合成（约 1–2 秒，同一句只合成一次），不行再用本机声音
  function sayCloud(text, rate, res, g, id) {
    if (!cloudOk()) {
      // 自动化测试时记下没有配音的句子（tools/voice/misshook.js 收集，再补合成）
      if (navigator.webdriver && S.settings.tts !== 'device') { try { console.log('[voice-miss]' + JSON.stringify([text, g || ''])); } catch (e) {} }
      sayDevice(text, rate, res, g);
      return;
    }
    EchoTalk.cloudTTS(text, g).then(url => {
      if (RT.sayId !== id) return res();   // 等合成的时候已经换了别的句子
      if (url) { RT.cloudTTSFails = 0; playUrl(text, rate, res, g, url, () => sayDevice(text, rate, res, g)); return; }
      RT.cloudTTSFails = (RT.cloudTTSFails || 0) + 1; if (RT.cloudTTSFails >= 3) RT.cloudTTSBroken = true;
      sayDevice(text, rate, res, g);
    });
  }
  // 本机（浏览器自带）的英语声音；用不了就不出声
  function sayDevice(text, rate, res, g) {
    if (!deviceOk()) { silent(res, text); return; }
    const u = new SpeechSynthesisUtterance(text);
    const v = g === 'f' ? (TTS.vf || TTS.v) : g === 'm' ? (TTS.vm || TTS.v) : TTS.v;
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-US';
    // 找不到对应性别的声音时，用音调区分两个角色
    if (g && genderOf(v) !== g) u.pitch = g === 'm' ? 0.75 : 1.3;
    u.rate = rate || S.settings.rate;
    let done = false;
    const fin = () => { if (done) return; done = true; endPlaying(); res(); };
    u.onend = fin;
    u.onerror = e => {
      // 被新的朗读打断不算失败；真失败了：这次起不用本机声音
      if (!done && e && e.error && !/interrupted|canceled/.test(e.error)) { RT.ttsBroken = true; done = true; silent(res, text); return; }
      fin();
    };
    setTimeout(fin, 1800 + text.length * 150 / u.rate);
    startPlaying();
    speechSynthesis.speak(u);
  }
  // iOS / 微信要求第一次出声必须在点击里：点击时先“解锁”两种发音方式
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  function primeTTS() {
    if (RT.primed) return;
    RT.primed = true;
    if (TTS.ok) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* 忽略 */ } }
    try { RT.audio = RT.audio || new Audio(); RT.audio.src = silentWav(); const p = RT.audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 忽略 */ }
  }

  // ---------- 语音识别 + 评分 ----------
  const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
  const FATAL = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'];
  const canRecord = () => !RT.noRec && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  // 安卓 APK：WebView 里没有能用的浏览器语音识别 → 有阿里云密钥就录一句交给阿里云识别（talk.js listenOnce），连不上两次就改回录音自评
  const cloudSR = () => !!(window.EchoTalk && EchoTalk.cloudSR && EchoTalk.cloudSR()) && !RT.cloudBroken;
  // 口语默认「开口 + AI 打分」：APK 一律开口（没网就提示联网后再说，不会改成自评）；
  // 网页版连得上中转服务就用阿里云识别，否则用浏览器自带的识别，都没有才退回录音自评。「录音自评」只留给 ?quiet 测试链接
  function speakMode() {
    if (S.settings.mode === 'self') return 'self';
    if (cloudSR() || window.ECHO_APP) return 'sr';
    if (!SRC || RT.srBroken) return 'self';
    return 'sr';
  }
  // AI 老师点评：没说好（低于 90 分）时，把目标句子和听到的话交给 AI，给一句中文建议，接在「我听到」后面
  function aiTip(target, heard, el) {
    if (!heard || !el || !window.EchoTalk || !EchoTalk.aiTip) return;
    try { const L = dayLog(); L.tipN = (L.tipN || 0) + 1; } catch (e) { /* 周报用的计数 */ }
    EchoTalk.aiTip(target, heard).then(tip => { if (tip && el.isConnected && !el.querySelector('.ai-tip')) el.insertAdjacentHTML('beforeend', '<span class="ai-tip">💡 ' + esc(tip) + ' <i class="ai-mark" title="AI 生成 · 由阿里云通义千问提供">AI</i></span>'); });   // AI 生成的点评标上「AI」
  }
  // 麦克风在听的时候背景音乐完全静音（不然会被录进去，影响 AI 打分），正在放的朗读也停掉（别让识别听到示范读音）
  // targets：这道题的答案（可以几个）。实时识别的结果一和答案对上（90 分以上，而且最后一个词也说出来了，见 earlyMatch）就立刻结束，不用等孩子停顿——「秒出分」
  // 返回 { alts: 听到的几种说法, err, fail, why }。fail 是没听到时的原因（家长 2026-10-07，评估第 3 条）：
  //   'mic' 麦克风被拒（APK 里顺手弹出说明和「去打开」）、'net' 没网、'key' 密钥不对 / 额度用完 / 太频繁（401/403/429/Arrearage/quota）、
  //   'nokey' APK 里还没有 AI 密钥、'unheard' 真的没听清（没出声、太小声、识别出来是空的，算一次尝试）、'stop' 自己点了停
  function recognize(onInterim, targets) {
    const m = MUS(); if (m) m.hold(true);
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const t0 = Date.now(), cloud = cloudSR();
    return recognizeRaw(onInterim, targets).then(r => { if (m) m.hold(false); if (cloud) logAsr(t0); return r; });
  }
  // 周报的 AI 用量：用阿里云识别了几次、大约几秒（估算花费）。失败的次数和原因在 aiNote 里记
  function logAsr(t0) {
    try {
      const L = dayLog();
      L.asrN = (L.asrN || 0) + 1;
      L.asrSec = +((L.asrSec || 0) + Math.min(30, (Date.now() - t0) / 1000)).toFixed(1);
    } catch (e) { /* 只是记录，出错不影响打分 */ }
  }
  // listenOnce 的结果 → fail 的种类（talk.js 的 why：offline / network 算没网；auth / quota / busy / code 算密钥和额度）
  function failOf(r) {
    if (!r || r.text) return '';
    if (r.err === 'not-allowed' || r.err === 'audio-capture') return 'mic';
    if (r.err === 'network') return r.why === 'offline' || r.why === 'network' || !r.why ? 'net' : 'key';
    if (r.err === 'aborted') return 'stop';
    return 'unheard';
  }
  function recognizeRaw(onInterim, targets) {
    if (cloudSR()) {
      RT.listening = true;
      const tg = (targets || []).filter(Boolean);
      return EchoTalk.listenOnce({ onState: onInterim, match: tg.length ? t => tg.some(x => earlyMatch(x, t)) : null, short: tg.length > 0 && tg.every(x => x.trim().split(/\s+/).length <= 2) }).then(r => {
        RT.listening = false;
        r = r || {};
        const fail = failOf(r);
        if (fail === 'mic') {
          if (window.ECHO_APP) { micBlocked(r.why); return { alts: [], err: 'mic', fail, why: r.why || '' }; }   // APK 必须开口：说明为什么要麦克风 +「去打开」
          RT.cloudBroken = true;   // 网页版：退回浏览器识别 / 录音自评
          return { alts: [], err: r.err, fail, why: r.why || '' };
        }
        if (fail === 'net' || fail === 'key') {
          aiNote(fail, r.why);
          if (!window.ECHO_APP && (RT.cloudFails = (RT.cloudFails || 0) + 1) >= 2) { RT.cloudBroken = true; toast('连不上 AI 打分，先用浏览器的识别 / 录音自评'); }
          return { alts: [], err: 'no-speech', fail, why: r.why || '' };
        }
        if (r.text) { aiNote('ok'); RT.cloudFails = 0; }
        return { alts: r.text ? [r.text] : [], err: r.err === 'network' || r.err === 'busy' ? 'no-speech' : r.err || null, fail };
      });
    }
    // APK 里没有 AI 密钥：WebView 没有能用的浏览器识别，也不退回自评——走「AI 用不了」的出路（先跳过、放进复习）
    if (window.ECHO_APP && S.settings.mode !== 'self') { aiNote('nokey'); return Promise.resolve({ alts: [], err: 'nokey', fail: 'nokey', why: 'nokey' }); }
    return new Promise(resolve => {
      let r;
      try { r = new SRC(); } catch (e) { return resolve({ alts: [], err: 'service-not-allowed' }); }
      r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
      let alts = [], err = null, finished = false;
      const end = () => {
        if (finished) return;
        finished = true; clearTimeout(t1); clearTimeout(t2); RT.rec = null; RT.listening = false;
        resolve({ alts, err });
      };
      r.onresult = e => {
        const rs = Array.from(e.results);
        const main = rs.map(x => x[0].transcript).join(' ').trim();
        if (onInterim) onInterim(main);
        const set = [main];
        if (rs.length === 1) for (let k = 1; k < rs[0].length; k++) set.push(rs[0][k].transcript);
        alts = set.filter(Boolean);
      };
      r.onerror = e => { err = e.error; };
      r.onend = end;
      const t1 = setTimeout(() => { try { r.stop(); } catch (e) { /* 忽略 */ } }, 10000);
      const t2 = setTimeout(end, 13000);
      RT.rec = r; RT.listening = true;
      try { r.start(); } catch (e) { err = 'start-failed'; end(); }
    });
  }
  function stopListening() {
    if (window.EchoTalk && EchoTalk.stopListen) EchoTalk.stopListen();
    if (RT.rec) { try { RT.rec.stop(); } catch (e) { /* 忽略 */ } }
    if (RT.mr && RT.recording) { try { RT.mr.stop(); } catch (e) { /* 忽略 */ } }
  }

  // ---------- AI 打分用不了时别让孩子卡死（家长 2026-10-07，评估第 3 条）----------
  // 没网 / 密钥不对或额度用完：分清原因提示（首页挂一条红条，记进当天日志和周报）；3 分钟里连着 2 次（aiDown）：
  //   剧情说话任务、选伙伴、闯关题出现「先跳过（已放进复习，联网后要补说）」，战斗这一回合改成听音选招（不能暴击）。
  // APK 里还没有 AI 密钥（aiNoKey）：一开始就是 aiDown，设置页顶上提示「请家长在这里粘贴 AI 密钥」。
  // 麦克风被拒：弹窗说明为什么要用麦克风 +「去打开」（EchoNative.micPermission 分清这次拒绝 / 永久拒绝，openAppSettings 跳到系统设置）。
  // 「没听清」算一次尝试（练习 / 剧情 / 战斗各自数）。
  const AI_DOWN_MS = 3 * 60e3;
  const aiNoKey = () => !!window.ECHO_APP && S.settings.mode !== 'self' && !cloudSR();
  function aiDown() {
    if (speakMode() !== 'sr') return false;
    if (aiNoKey()) return true;
    if (!cloudSR()) return false;
    return RT.aiFails >= 2 && Date.now() - RT.aiFailAt < AI_DOWN_MS;
  }
  // cls：'ok' 识别成功 / 'net' / 'key' / 'nokey'；why：talk.js 的细分原因（offline / network / auth / quota / busy / code）
  function aiNote(cls, why) {
    const now = Date.now();
    if (cls === 'ok') { RT.aiFails = 0; RT.aiOkAt = now; RT.aiBar = null; refreshBars(); return; }
    if (cls === 'nokey') { try { dayLog().aiNoKey = 1; } catch (e) { /* 只是记录 */ } refreshBars(); return; }
    // 隔了 3 分钟以上的失败不算「连着」：最多从 1 次接着数（再失败一次就又是「用不了」）
    RT.aiFails = (now - RT.aiFailAt < AI_DOWN_MS ? RT.aiFails : Math.min(1, RT.aiFails)) + 1;
    RT.aiFailAt = now;
    RT.aiBar = { cls, why: why || (cls === 'net' ? 'network' : ''), at: now };
    try {
      const L = dayLog();
      L.aiFail = (L.aiFail || 0) + 1; L.aiFailWhy = why || cls;
      if (cls === 'net') L.aiNet = (L.aiNet || 0) + 1; else { L.aiKey = (L.aiKey || 0) + 1; L.aiKeyWhy = why || 'auth'; }
    } catch (e) { /* 只是记录 */ }
    refreshBars();
  }
  window.addEventListener('online', () => { if (RT.aiBar && RT.aiBar.cls === 'net') { RT.aiBar = null; RT.aiFails = 0; } refreshBars(); });
  window.addEventListener('offline', () => refreshBars());
  const KEY_TXT = { auth: 'AI 密钥不对', quota: 'AI 额度用完了', busy: 'AI 有点忙', code: '家庭口令不对' };
  // 没听到的时候，话筒下面那一行提示（练习 / 剧情 / 战斗 / 对话剧场共用）
  function failHint(res) {
    const f = res && res.fail, w = res && res.why;
    if (f === 'mic') return '🎤 要先允许回声岛用麦克风，才能开口说';
    if (f === 'nokey') return '🔑 还没有 AI 密钥，没法自动打分：请家长在设置里粘贴';
    if (f === 'net') return '📶 没网，没法打分：连上网再说一次';
    if (f === 'key') return w === 'busy' ? '⏳ AI 有点忙，过一会儿再说一次' : (w === 'quota' ? '💳 ' : '🔑 ') + (KEY_TXT[w] || 'AI 打分用不了') + '，没法打分：请告诉家长';
    if (f === 'stop') return '';
    return '没听清，靠近一点、大声一点再试一次';
  }
  const SKIP_TXT = '📶 先跳过（已放进复习，联网后要补说）';
  // 首页红条：现在 AI 用不了的原因（没有就返回 null）。口语打分的失败（aiNote）和聊天 / 朗读连不上（EchoTalk.lastErr）都算
  function aiBarState() {
    if (S.settings.mode === 'self' && !window.ECHO_APP) return null;   // 网页版的录音自评（测试也是）不用 AI
    if (aiNoKey()) return { cls: 'nokey', why: 'nokey' };
    let st = RT.aiBar;
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    if (le && le.at > RT.aiOkAt && (!st || le.at > st.at + 1000) && /^(offline|network|auth|quota|busy)$/.test(le.why || ''))
      st = { cls: le.why === 'offline' || le.why === 'network' ? 'net' : 'key', why: le.why, at: le.at };
    if (!st || st.at < RT.aiOkAt) return null;
    // 网络的问题：10 分钟以后（或者手机说已经联网了）就不挂了；密钥和额度的问题一直挂着，直到成功一次或者家长换了密钥
    if (st.cls === 'net' && Date.now() - st.at > 10 * 60e3) return null;
    if (st.cls === 'key' && st.why === 'busy' && Date.now() - st.at > 5 * 60e3) return null;
    return st;
  }
  function barText(st) {
    if (st.cls === 'nokey') return '🔑 还没有 AI 密钥：口语没法自动打分，请家长在设置里粘贴';
    if (st.cls === 'net') return '📶 连不上网：口语打分和聊天要联网';
    if (st.why === 'quota') return '💳 AI 额度用完了，请告诉家长';
    if (st.why === 'busy') return '⏳ AI 太忙了，过一会儿再试';
    if (st.why === 'code') return '🔑 家庭口令不对，请告诉家长';
    return '🔑 AI 密钥不对：口语打分和聊天用不了，请告诉家长';
  }
  // 首页上面的提示条：AI 用不了（红）、有新版本（蓝）。挂在 #tabs 后面（index.html 不用改；横屏时在右栏最上面，见 style.css）
  function homeBars() {
    const tabs = $('#tabs'); if (!tabs) return;
    let box = $('#home-bars');
    if (!box) { box = document.createElement('div'); box.id = 'home-bars'; tabs.parentNode.insertBefore(box, tabs.nextSibling); }
    const st = aiBarState(), up = updNew();
    box.innerHTML = (st ? '<button class="ai-bar" data-act="aiBarInfo" data-cls="' + st.cls + '">' + esc(barText(st)) + '<em>怎么办？</em></button>' : '') +
      (up ? '<button class="upd-bar" data-act="updInfo">🆕 有新版本' + (S.upd.name ? '（' + esc(S.upd.name) + '）' : '') + '，请家长更新<em>看看</em></button>' : '');
    box.hidden = !st && !up;
  }
  function refreshBars() { try { if (!$('#home').hidden) homeBars(); } catch (e) { /* 还没启动 */ } }
  function aiBarInfo() {
    const st = aiBarState();
    if (!st) { homeBars(); return; }
    const parent = st.cls === 'nokey' || st.why === 'auth' || st.why === 'code';
    const how = st.cls === 'nokey' ? '这台手机上还没有 AI 密钥。请家长打开「设置 → 🔒 家长设置 → AI 聊天和口语打分」，粘贴阿里云百炼的 API Key（只存在这台手机里）。'
      : st.cls === 'net' ? '口语打分和和岛民聊天都要联网。看看 Wi-Fi 或者流量开着没有，连上网再说。'
      : st.why === 'quota' ? '家长：阿里云百炼的额度用完了（或者欠费了）。请到百炼控制台看看费用和额度，充值或者换一把新密钥。'
      : st.why === 'busy' ? 'AI 那边一下子收到太多请求了，过几分钟再试就好。'
      : st.why === 'code' ? '家长：中转服务的家庭口令不对，请在设置里重新填。'
      : '家长：AI 密钥不对（可能被作废了）。请在「设置 → 🔒 家长设置 → AI 聊天和口语打分」里粘贴新的密钥。';
    openModal('<div class="big">' + (st.cls === 'net' ? '📶' : st.why === 'quota' ? '💳' : '🔑') + '</div><h2>' + esc(barText(st).replace(/^\S+\s/, '')) + '</h2><p>' + how + '</p>' +
      '<p class="tip">AI 用不了的时候：要开口的题可以「先跳过」，这些句子都放进了每日复习，联网以后要补说；对战这一回合改成听一听、选出来（不能暴击）。</p>' +
      '<div class="row">' + (parent ? '<button class="btn ghost" data-act="parentSet">🔒 家长设置</button>' : '') + '<button class="btn" data-act="close" data-focus>知道了</button></div>');
  }
  // 麦克风被拒（APK）：问原生是「这次没允许」还是「永久拒绝、系统不会再问」，弹窗说明 +「去打开」
  const micState = () => { try { return nat('micPermission') ? String(EchoNative.micPermission() || '') : ''; } catch (e) { return ''; } };
  function micBlocked(why) {
    try { const L = dayLog(); L.micDeny = (L.micDeny || 0) + 1; } catch (e) { /* 只是记录 */ }
    micSheet(micState(), why);
  }
  function micSheet(state) {
    const blocked = state === 'blocked', canFix = nat('openAppSettings');
    RT.micSheet = true;
    openModal('<div class="big">🎤</div><h2>要用麦克风才能开口说英语</h2>' +
      '<p>回声岛要<b>听你说的英语</b>，才能给你打分、让你和岛民聊天。声音只用来打分，不会存下来。</p>' +
      (blocked ? '<p class="tip">手机现在不让回声岛用麦克风，也不会再问了：点「去打开」→「权限」→「麦克风」→ 选「允许」，再回到游戏。</p>'
        : '<p class="tip">刚才没有允许。再点一次话筒，手机会问你，这次点「允许」就好。</p>') +
      '<div class="row">' + (blocked
        ? '<button class="btn ghost" data-act="close">等会儿</button>' + (canFix ? '<button class="btn" data-act="micFix" data-focus>⚙️ 去打开</button>' : '')
        : (canFix ? '<button class="btn ghost" data-act="micFix">⚙️ 去设置里打开</button>' : '') + '<button class="btn" data-act="close" data-focus>好的，再试一次</button>') + '</div>');
  }
  window.addEventListener('echo-mic', e => {
    if (e && e.detail === 'granted' && RT.micSheet) { RT.micSheet = false; if ($('#sheet [data-act=micFix]')) closeModal(); toast('🎤 麦克风可以用了！再点一次话筒说吧'); }
  });

  // ---------- 第一次打开：「麦克风 + 网络 + 密钥」小检查（评估第 3 条 ⑤）----------
  // 请孩子说一句 Hello：顺便弹出麦克风权限框，测出麦克风被拒 / 被挡住、声音太小、没网、没密钥、额度用完。设置里也能再做一次
  const CHK_TXT = {
    mic: { ok: '🎤 麦克风 ✅', bad: '🎤 麦克风 ❌ 没允许用', quiet: '🎤 麦克风 ⚠️ 没听到声音：是不是被手指挡住了？', '': '🎤 麦克风' },
    net: { ok: '📶 网络 ✅', bad: '📶 网络 ❌ 连不上', '': '📶 网络' },
    key: { ok: '🔑 AI 密钥 ✅', bad: '🔑 AI 密钥 ❌', '': '🔑 AI 密钥' },
  };
  function chkRows() {
    const c = RT.chk || {};
    return ['mic', 'net', 'key'].map(k => '<li class="chk-' + (c[k] || 'wait') + '" id="chk-r-' + k + '">' + esc(CHK_TXT[k][c[k] || ''] + (k === 'key' && c.key === 'bad' && c.keyWhy ? ' ' + c.keyWhy : '')) + '</li>').join('');
  }
  function checkSheet() {
    const nokey = aiNoKey();
    RT.chk = { mic: '', net: navigator.onLine === false ? 'bad' : '', key: nokey ? 'bad' : '', keyWhy: nokey ? '还没有：请家长在「设置 → 🔒 家长设置」里粘贴' : '' };
    openModal('<div class="big">🩺</div><h2>开口前的小检查</h2><p>回声岛要听你说英语。点话筒，大声说：<b class="chk-say">Hello!</b></p>' +
      '<ul class="chk" id="chk">' + chkRows() + '</ul>' +
      '<div class="mic-wrap"><button class="mic" id="chk-mic" data-act="chkMic" aria-label="开始说话">' + MIC + '</button><div class="mic-hint" id="chk-hint">点话筒，说 Hello</div><div class="heard" id="chk-heard"></div></div>' +
      '<div class="row"><button class="btn ghost" data-act="chkSkip">先跳过</button><button class="btn" data-act="chkDone" id="chk-done" hidden>好了，出发！</button></div>');
  }
  // 没有 AI 密钥时只能测麦克风：开 2.5 秒，看声音够不够大
  async function micProbe(ms) {
    let stream, ctx;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return { err: 'mic', why: (e && e.name) || 'mic' }; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* 忽略 */ } }
      const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize), t0 = Date.now();
      let peak = 0;
      while (Date.now() - t0 < (ms || 2500)) {
        await new Promise(r => setTimeout(r, 60));
        an.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        peak = Math.max(peak, Math.sqrt(s / buf.length));
      }
      return { ok: true, loud: peak > 0.02, peak };
    } catch (e) { return { ok: true, loud: true }; }
    finally { try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* 忽略 */ } try { if (ctx) ctx.close(); } catch (e) { /* 忽略 */ } }
  }
  async function chkMic() {
    if (RT.listening || RT.chkBusy) { stopListening(); return; }
    const m = $('#chk-mic'), hint = $('#chk-hint'), heard = $('#chk-heard'); if (!m) return;
    const c = RT.chk = RT.chk || {};
    const upd = () => { const ul = $('#chk'); if (ul) ul.innerHTML = chkRows(); };
    m.classList.add('on'); m.innerHTML = STOP; hint.textContent = '正在听……大声说 Hello!'; heard.textContent = '';
    if (aiNoKey() || !cloudSR()) {   // 没有密钥：只能看麦克风有没有声音
      RT.chkBusy = true;
      const r = await micProbe(2500);
      RT.chkBusy = false;
      if (!$('#chk-mic')) return;
      m.classList.remove('on'); m.innerHTML = MIC;
      if (r.err) { c.mic = 'bad'; upd(); if (window.ECHO_APP) micBlocked(r.why); else hint.textContent = '浏览器没让用麦克风'; return; }
      c.mic = r.loud ? 'ok' : 'quiet'; upd();
      hint.textContent = r.loud ? '麦克风没问题！' + (c.key === 'bad' ? '还差 AI 密钥：请家长在设置里粘贴，才能自动打分。' : '') : '没听到声音：靠近一点、大声说 Hello，再点一次话筒';
      if (r.loud) { S.micCheck = dayStr(); save(); const d = $('#chk-done'); if (d) d.hidden = false; }
      return;
    }
    const res = await recognize(t => { const h = $('#chk-heard'); if (h) h.textContent = t; }, ['Hello']);
    if (!$('#chk-mic')) return;
    m.classList.remove('on'); m.innerHTML = MIC;
    if (res.alts.length) {
      Object.assign(c, { mic: 'ok', net: 'ok', key: 'ok', keyWhy: '' }); upd();
      heard.textContent = '我听到：“' + res.alts[0] + '”';
      hint.textContent = '全都没问题，可以开口说英语了！';
      S.micCheck = dayStr(); save();
      const d = $('#chk-done'); if (d) d.hidden = false;
      return;
    }
    if (res.fail === 'mic') { c.mic = 'bad'; upd(); return; }   // 说明弹窗已经弹出来了（APK）
    if (res.fail === 'net') { c.mic = 'ok'; c.net = 'bad'; }
    else if (res.fail === 'key') { c.mic = 'ok'; c.net = 'ok'; c.key = 'bad'; c.keyWhy = KEY_TXT[res.why] ? KEY_TXT[res.why].replace(/^AI /, '') : ''; }
    else if (res.fail === 'unheard') c.mic = 'quiet';
    upd();
    hint.textContent = res.fail === 'unheard' ? '没听到声音：麦克风是不是被挡住了？靠近一点、大声说 Hello，再点一次话筒' : failHint(res);
  }

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function n2w(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + n2w(n % 100) : '');
    return String(n);
  }
  const ORDS = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth' };
  function ord(n) {
    if (ORDS[n]) return ORDS[n];
    if (n < 20) return ONES[n] + 'th';
    if (n % 10 === 0 && n < 100) return TENS[n / 10].replace(/y$/, 'ieth');
    if (n < 100) return TENS[Math.floor(n / 10)] + ' ' + ord(n % 10);
    return n2w(n);
  }
  const SPELL = { colour: 'color', favourite: 'favorite', maths: 'math', grey: 'gray', centre: 'center', okay: 'ok', mum: 'mom', mr: 'mister', ms: 'miss', pingpong: 'ping pong', cannot: 'can not',
    // 英式拼写 → 美式识别结果（差两个字母，tokEq 认不出来）
    kilometre: 'kilometer', kilometres: 'kilometers', metre: 'meter', metres: 'meters', programme: 'program', programmes: 'programs',
    litre: 'liter', litres: 'liters', theatre: 'theater', theatres: 'theaters', tyre: 'tire', tyres: 'tires',
    // 课本用英式的过去式（learnt），识别服务写成 learned
    learnt: 'learned', spelt: 'spelled', dreamt: 'dreamed', burnt: 'burned', smelt: 'smelled', spoilt: 'spoiled' };
  // 识别服务常常把缩写的撇号丢掉（I dont like it）：按没丢撇号的样子展开（目标和听到的都过一遍，两边一样）
  const CONTR = { dont: 'do not', doesnt: 'does not', didnt: 'did not', isnt: 'is not', arent: 'are not', wasnt: 'was not', werent: 'were not',
    cant: 'can not', wont: 'will not', havent: 'have not', hasnt: 'has not', hadnt: 'had not', couldnt: 'could not', shouldnt: 'should not',
    wouldnt: 'would not', mustnt: 'must not', neednt: 'need not', im: 'i am', ive: 'i have', youre: 'you are', youve: 'you have', youll: 'you will',
    theyre: 'they are', theyve: 'they have', theyll: 'they will', weve: 'we have', whats: 'what is', thats: 'that is', hes: 'he is', shes: 'she is',
    theres: 'there is', wheres: 'where is', heres: 'here is', lets: 'let us' };
  function norm(s) {
    s = ' ' + String(s).toLowerCase().replace(/[’‘`]/g, "'") + ' ';
    s = s.replace(/\b((?:[a-z]\.){2,})/g, m => m.replace(/\./g, ''));
    s = s.replace(/(\d+):(\d\d)/g, (m, h, mm) => n2w(+h) + ' ' + (+mm === 0 ? "o'clock" : (mm[0] === '0' ? 'oh ' + n2w(+mm) : n2w(+mm))));
    s = s.replace(/(\d+)(st|nd|rd|th)\b/g, (m, d) => ord(+d));
    s = s.replace(/\d+/g, d => ' ' + n2w(+d) + ' ');
    s = s.replace(/\blet's\b/g, 'let us').replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not')
      .replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'s\b/g, ' is').replace(/'d\b/g, ' would').replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have');
    s = s.replace(/-/g, ' ').replace(/'/g, '').replace(/[^a-z ]/g, ' ');
    return s.split(/\s+/).filter(Boolean).map(w => CONTR[w] || SPELL[w] || w).join(' ').split(' ').filter(Boolean);
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = range(n + 1);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // ---------- 打分要诚实（家长 2026-10-07 定，评估第 8 条）----------
  // 模糊匹配只留给拼写变体（realise/realize、honour/honor、travelled/traveled）；易混的音（three/tree、went/want、these/those、light/right）不算对，
  // 只错了词尾（likes/like、played/play）算半对（四分之三）；发音一样的词（eye = I、eight = ate、right = write）算对；
  // 实词比虚词重要：句子里漏掉（或说错）四分之一以上的实词就不过关，漏一个也不能算全对；有一个词没说对就不给 Perfect / 暴击（最多 84 分）。
  const HOMO = {};   // 同音词 → 同一组
  [['i', 'eye', 'aye'], ['eight', 'ate'], ['right', 'write', 'rite'], ['two', 'too', 'to'], ['four', 'for'], ['one', 'won'], ['no', 'know'], ['new', 'knew'],
    ['see', 'sea'], ['here', 'hear'], ['there', 'their'], ['by', 'buy', 'bye'], ['son', 'sun'], ['hour', 'our'], ['meet', 'meat'], ['week', 'weak'],
    ['road', 'rode'], ['wait', 'weight'], ['whole', 'hole'], ['which', 'witch'], ['flower', 'flour'], ['pair', 'pear'], ['dear', 'deer'], ['blue', 'blew'],
    ['night', 'knight'], ['tail', 'tale'], ['mail', 'male'], ['sale', 'sail'], ['be', 'bee'], ['peace', 'piece'], ['plain', 'plane'], ['aloud', 'allowed'],
    ['weather', 'whether'], ['made', 'maid'], ['steal', 'steel'], ['wood', 'would'], ['great', 'grate'], ['board', 'bored'], ['through', 'threw'], ['nose', 'knows'],
    ['sent', 'cent', 'scent'], ['ok', 'okay']].forEach(g => g.forEach(w => { HOMO[w] = g[0]; }));
  const canon = w => HOMO[w] || w;
  const pairSet = s => new Set(s.split(' ').flatMap(p => { const [a, b] = p.split('|'); return [a + '|' + b, b + '|' + a]; }));
  // 不许模糊匹配的词对（下面的规则大多也能挡住，这里写明最典型的）
  const NOFUZZ = pairSet('three|tree three|free went|want these|those light|right then|than were|where thing|think they|them quiet|quit live|love sing|sting bread|bead glass|grass play|pray collect|correct');
  // 不规则的词形变化：算「只错了词尾」
  const INFL = pairSet('go|goes do|does have|has is|are am|is am|are was|were is|was are|were a|an child|children man|men woman|women foot|feet tooth|teeth mouse|mice ' +
    'go|went see|saw eat|ate have|had do|did make|made take|took come|came get|got buy|bought think|thought say|said tell|told give|gave run|ran swim|swam sing|sang ' +
    'write|wrote know|knew know|known grow|grown take|taken see|seen give|given eat|eaten fall|fallen');
  const VOW = /[aeiouy]/;
  // 拼写变体：只差一个字母，而且不是首字母、词尾、元音换元音、l/r 互换、多一个 h/r/l（双写字母可以）
  function fuzzyOk(a, b) {
    if (a.length <= 3 || b.length <= 3 || NOFUZZ.has(a + '|' + b)) return false;
    if (a.length === b.length) {
      let i = 0; while (a[i] === b[i]) i++;
      if (a.slice(i + 1) !== b.slice(i + 1)) return false;
      const x = a[i], y = b[i];
      if (i === 0 || i === a.length - 1) return false;   // light/right、thing/think
      if (VOW.test(x) && VOW.test(y)) return false;      // went/want、these/those
      if ('lr'.includes(x) && 'lr'.includes(y)) return false;   // glass/grass
      return true;   // realise/realize、practise/practice
    }
    const [L, s] = a.length > b.length ? [a, b] : [b, a];
    if (L.length !== s.length + 1) return false;
    let i = 0; while (i < s.length && L[i] === s[i]) i++;
    if (L.slice(i + 1) !== s.slice(i)) return false;
    const c = L[i];
    if (L[i - 1] === c || L[i + 1] === c) return true;   // 双写字母：travelled/traveled
    if (i === 0 || i === L.length - 1) return false;     // 词头、词尾多一个字母（词尾变化交给 inflect）
    if ('hrl'.includes(c)) return false;                 // three/tree、were/where、bread/bead
    return true;   // honour/honor
  }
  // 只错了词尾：like/likes、play/played/playing、make/making、study/studies、stop/stopped、go/went……
  function inflect(a, b) {
    if (INFL.has(a + '|' + b)) return true;
    const [L, s] = a.length >= b.length ? [a, b] : [b, a];
    if (s.length < 3 || L === s) return false;
    const tail = L.slice(s.length);
    if (L.startsWith(s) && /^(s|es|d|ed|ing|er|est|ly)$/.test(tail)) return true;
    if (L.startsWith(s) && tail[0] === s[s.length - 1] && /^(ed|ing|er|est)$/.test(tail.slice(1))) return true;   // 双写：stop/stopped
    const stem = s.slice(0, -1), rest = L.slice(stem.length);
    if (s.endsWith('e') && L.startsWith(stem) && /^(ing|ed|er|est)$/.test(rest)) return true;     // make/making
    if (s.endsWith('y') && L.startsWith(stem) && /^(ies|ied|ier|iest)$/.test(rest)) return true;  // study/studies
    return false;
  }
  // 两个词对得上多少：4 = 对，3 = 只错了词尾，0 = 不对
  function tokM(a, b) {
    if (a === b || canon(a) === canon(b) || fuzzyOk(a, b)) return 4;
    return inflect(a, b) ? 3 : 0;
  }
  // 虚词（权重 1）；其余是实词（权重 2）。not / no / never 改变意思，算实词
  const FUNC = new Set(('a an the to of in on at by for from with about into onto over under up down out off and or but so if as than then that this these those ' +
    'there here is am are was were be been being do does did have has had will would shall should can could may might must i you he she it we they me him her ' +
    'us them my your his its our their mine yours ours hers theirs oh ok yes well just very too also please').split(' '));
  // 名字（怪兽名、昵称、人名）识别服务常常写错或拆成两个词：大写开头、不在句首、5 个字母以上的词放宽一点（差四分之一个字母以内也算对，拆开的两个词先拼回去）。
  // 课本里的中国人名是拼音、往往很短（Li → Lee、Lin → Lynn、Zhang → Jang、Wang Fang → Wong Fong）：看着像拼音的名字不管多长都算名字，差 2 个字母以内也算对。
  // 句首的词只有后面紧跟着另一个大写的词时才算名字（Wang Fang is…、Mr Li is…）
  const PINYIN = /^(?:(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|in|un|ia|ie|iu|ua|uo|ue|ui|er|a|o|e|i|u|v)){1,3}$/;
  const isPinyin = t => PINYIN.test(t);
  // 大写但不是人名的常用词：照普通词打分（说成别的就是错，Monday ≠ Sunday、China ≠ Chinese）
  const NOT_NAME = new Set(('monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october ' +
    'november december china chinese english america american canada canadian britain british france french japan japanese australia australian ' +
    'germany german italy italian russia russian india indian korea korean christmas easter earth moon sun mars internet tv').split(' '));
  const nameTol = t => (isPinyin(t) ? Math.max(2, Math.floor(t.length / 4)) : Math.max(1, Math.floor(t.length / 4)));
  function nameIdx(words) {
    const out = new Set();
    words.forEach((w, k) => {
      if (!/^[A-Z]/.test(w)) return;
      if (k > 0 ? !/[.!?]$/.test(words[k - 1]) : (/,$/.test(w) || (words.length > 1 && /^[A-Z]/.test(words[1]) && !/[.!?]$/.test(w) && w !== 'I'))) out.add(k);
    });
    return out;
  }
  // 加权的最长公共子序列：每个目标词按顺序找听到的词，返回每个目标词对上多少（0 / 3 / 4）
  function align(t, h, wt, isName) {
    const m = t.length, n = h.length;
    const M = t.map((x, i) => h.map(y => { const v = tokM(x, y); return v || !isName[i] ? v : (lev(x, y) <= nameTol(x) ? 4 : 0); }));
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const v = M[i - 1][j - 1];
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], v ? dp[i - 1][j - 1] + wt[i - 1] * v : 0);
    }
    const got = new Array(m).fill(0);
    let i = m, j = n;
    while (i > 0 && j > 0) {
      const v = M[i - 1][j - 1];
      if (v && dp[i][j] === dp[i - 1][j - 1] + wt[i - 1] * v) { got[i - 1] = v; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return got;
  }
  // 返回 0–100 分；marks：每个原始单词是否说对；last：最后一个词有没有按顺序对上（秒出分要用）；full：每个词都说对了
  function scoreSpeech(target, heard) {
    const words = String(target || '').split(/\s+/).filter(Boolean), names = nameIdx(words);
    const flat = [], owner = [];
    words.forEach((w, k) => norm(w).forEach(t => { flat.push(t); owner.push(k); }));
    let h = norm(heard || '');
    if (!flat.length || !h.length) return { score: 0, marks: words.map(() => false), last: false, full: false };
    // it's / its 听起来一样，识别服务常常丢撇号或乱加：按目标句的写法改过来
    const pairAt = (a, x, y) => a.some((t, i) => t === x && a[i + 1] === y);
    if (pairAt(flat, 'it', 'is')) h = h.flatMap(t => (t === 'its' ? ['it', 'is'] : [t]));
    else if (flat.includes('its')) h = h.reduce((a, t) => { if (t === 'is' && a[a.length - 1] === 'it') a[a.length - 1] = 'its'; else a.push(t); return a; }, []);
    const isName = flat.map((t, i) => names.has(owner[i]) && !FUNC.has(t) && !NOT_NAME.has(t) && (t.length >= 5 || isPinyin(t)));
    // 名字被拆成两个词（Ember pup → emberpup）：拼回去
    isName.forEach((nm, i) => {
      if (!nm || h.includes(flat[i])) return;
      for (let j = 0; j + 1 < h.length; j++) { const jn = h[j] + h[j + 1]; if (lev(jn, flat[i]) <= nameTol(flat[i])) { h = h.slice(0, j).concat([jn], h.slice(j + 2)); break; } }
    });
    const wt = flat.map(t => FUNC.has(t) ? 1 : 2);
    const got = align(flat, h, wt, isName);
    const W = wt.reduce((a, x) => a + x, 0) * 4, G = got.reduce((a, g, i) => a + g * wt[i], 0);
    const hit = got.reduce((a, g) => a + g / 4, 0);
    const recall = G / W, f1 = 2 * hit / (flat.length + h.length);
    let s = 0.6 * recall + 0.4 * f1, same = false;
    const ca = flat.map(canon), cb = h.map(canon);
    if (flat.length <= 2) {
      const a = ca.join(''), b = cb.join(''), sim = (1 - lev(a, b) / Math.max(a.length, b.length)) * 0.95;
      if (a === b) { s = 1; same = true; }                                  // 只是分词不同：ice cream / icecream
      else if (flat.length !== h.length) s = Math.max(s, Math.min(.84, sim));   // 分词不同又差一点
      else if (s < .5) s = Math.max(s, Math.min(.5, sim));                  // 说成了别的词（tree）：给个参考分，不过关
    } else s = s * s * (2 - s);   // 句子：漏读的扣分更明显
    // 目标的几个词按顺序完整地说出来了（前后多说了几个词也行）：短的算满分
    if (flat.length <= 3 && (' ' + cb.join(' ') + ' ').includes(' ' + ca.join(' ') + ' ')) { s = 1; same = true; }
    const marks = words.map((w, k) => { const idx = owner.map((o, i) => o === k ? i : -1).filter(i => i >= 0); return idx.length === 0 || idx.every(i => got[i] === 4); });
    if (same || (words.length === 1 && s >= 0.9)) marks.fill(true);
    if (flat.length >= 3 && !same) {
      // 名字不算进「关键实词」：识别服务写不对名字很常见（照样扣分、不给 Perfect，但不会因此不过关）
      const content = flat.map((t, i) => i).filter(i => wt[i] === 2 && !isName[i]), miss = content.filter(i => !got[i]).length;
      if (content.length && miss / content.length >= .25) s = Math.min(s, .5);   // 关键的实词没说出来：不过关
      else if (miss) s = Math.min(s, .84);
    }
    const full = marks.every(Boolean);
    if (!full) s = Math.min(s, .84);   // Perfect / 暴击要每个词都说对
    return { score: Math.round(Math.max(0, Math.min(1, s)) * 100), marks, last: same || got[flat.length - 1] === 4, full };
  }
  function bestScore(target, alts) {
    let best = { score: -1, marks: [], heard: '', last: false, full: false };
    alts.forEach(a => { const r = scoreSpeech(target, a); if (r.score > best.score) best = { ...r, heard: a }; });
    return best;
  }
  // 秒出分：实时识别的结果 90 分以上，而且目标的最后一个词已经按顺序说出来了，才立刻结束（不然孩子还在说最后一个词就被截断）
  function earlyMatch(target, heard) {
    const r = scoreSpeech(target, heard);
    return r.score >= 90 && r.last;
  }

  // ---------- 出题 ----------
  function distract(list, i, n, keyIdx) {
    const seen = new Set([list[i][keyIdx]]);
    const out = [];
    for (const j of shuffle(range(list.length))) {
      if (j === i || seen.has(list[j][keyIdx])) continue;
      seen.add(list[j][keyIdx]); out.push(list[j]);
      if (out.length === n) break;
    }
    return out;
  }
  const tokens = s => s.split(/\s+/).map(t => t.replace(/[.,!?]+$/g, '')).filter(Boolean);

  function makeQ(type, wi, i) {
    const w = WX[wi];
    const q = { type, kind: KIND[type], w: wi, i };
    if (q.kind === 'word') {
      const it = w.words[i];
      q.en = it[0]; q.zh = it[1]; q.em = it[2];
      if (type === 'lw') { q.audio = it[0]; q.opts = shuffle([{ c: true, e: it[2], t: it[1] }, ...distract(w.words, i, 3, 1).map(o => ({ e: o[2], t: o[1] }))]); }
      if (type === 'ls') { q.audio = it[0]; q.opts = shuffle([{ c: true, t: it[0] }, ...distract(w.words, i, 3, 0).map(o => ({ t: o[0] }))]); }
      if (type === 'sr_w') { q.audio = it[0]; q.target = it[0]; }
      if (type === 'sp') { q.audio = null; q.target = it[0]; }
    } else if (q.kind === 'sent') {
      const it = w.sents[i];
      q.en = it[0]; q.zh = it[1];
      if (type === 'lm') { q.audio = it[0]; q.opts = shuffle([{ c: true, t: it[1] }, ...distract(w.sents, i, 3, 1).map(o => ({ t: o[1] }))]); }
      if (type === 'lo') { q.audio = it[0]; q.tokens = tokens(it[0]); q.bank = shuffle(range(q.tokens.length)); }
      if (type === 'sr_s') { q.audio = it[0]; q.target = it[0]; }
    } else {
      const it = w.dlgs[i];
      q.prompt = it[0]; q.en = it[1]; q.audio = it[0];
      if (type === 'lr' || type === 'bt') q.opts = shuffle([{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))]);
      if (type === 'sr_d') q.target = it[1];
    }
    return q;
  }

  function buildLevel(wi, li) {
    const r = RECIPES[li], bags = {}, qs = [];
    const next = (kind, wj) => {
      const k = wj + ':' + kind;
      const len = kind === 'word' ? WX[wj].words.length : kind === 'sent' ? WX[wj].sents.length : WX[wj].dlgs.length;
      if (!bags[k] || !bags[k].length) bags[k] = shuffle(range(len));
      return bags[k].pop();
    };
    const first = isUnit(wi) ? NB : 0;   // 「挑战」复习前面的内容：小岛复习前面的岛，课本复习前面的单元
    r.mix.forEach(([t, n]) => {
      for (let k = 0; k < n; k++) {
        const wj = r.review && wi > first && Math.random() < 0.3 ? first + rnd(wi - first) : wi;
        qs.push(makeQ(t, wj, next(KIND[t], wj)));
      }
    });
    if (!r.boss) return shuffle(qs);
    const bt = qs.filter(q => q.type === 'bt'), lo = qs.filter(q => q.type === 'lo');
    return [bt[0], bt[1], lo[0], bt[2], bt[3], lo[1], bt[4], bt[5]].filter(Boolean);
  }

  // ---------- 每日复习（温故而知新）----------
  // 每道题一条记录 S.rev.items[键]：b = 第几格（0 = 刚答错），due = 哪天该复习（'' = 已经掌握），x = 答错过几次，c = 哪天进来的，
  // src = 'chat' 表示 AI 聊天里老师给的更好说法（said = 孩子原来的说法）。
  // 答错（闯关、村民出题、复习里）→ 回到第 0 格，当天就进复习；复习答对 → 进一格，隔 1、2、4、7、15、30 天再来；第 7 格算掌握（留着不删，周报「累计掌握」数它们）。
  // 课本单元的题第一次答对 → 第 1 格，第二天复习一次（新学的东西趁热巩固），之后按上面的间隔；带着提示才答对的按「弱」进来（第 0 格，明天考，也占每天新进的名额）。
  // 冒险也替复习干活（家长 2026-10-07 定，评估第 6 条）：闯关、对战、村民出题里答对一道今天到期的题，就算一次复习、升一格（每天最多算 REV_FIELD 次）；
  // 对战里没念准 / 没听懂只降一格（revMiss），不打回第 0 格。对战出题先挑今天到期的（revPick）。
  // 为了消化得过来：每天最多新进 REV_NEW 条，今天到期的积压超过 REV_BACKLOG 条就先不加新学的（答错的、聊天里改过的照样进）。
  const GAP = [0, 1, 2, 4, 7, 15, 30];
  const REV_N = 20;          // 一轮复习几题（家长定：每天 20 题，约 6–8 分钟）
  const REV_MAX = 3000;      // 复习本里最多留多少条还没掌握的（已经掌握的不删）
  const REV_NEW = 10;        // 每天最多新进几条
  const REV_BACKLOG = 40;    // 今天到期的超过这么多条，当天不再加新学的
  const REV_FIELD = 20;      // 冒险里答对到期的题，每天最多算几次复习
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return dayStr(new Date(y, m - 1, dd + n)); };
  const revKey = q => q.free || q.kind + ':' + q.w + ':' + q.i;
  const listOf = (w, kind) => kind === 'word' ? w.words : kind === 'sent' ? w.sents : w.dlgs;
  function revItemOk(e) {
    if (e.k === 'free') return !!e.en;
    const w = WX[e.w], L = w && listOf(w, e.k);
    return !!(L && L[e.i]);
  }
  function revMigrate() {   // 老存档的错题本搬进来（只做一次）
    if (S.rev.v) return;
    for (const [k, e] of Object.entries(S.wrong || {})) if (!S.rev.items[k]) S.rev.items[k] = { k: e.k, w: e.w, i: e.i, b: 0, due: dayStr(), x: e.m || 1 };
    S.wrong = {}; S.rev.v = 1;
  }
  // 今天的计数：n = 新进了几条，f = 冒险里算了几次复习（过了零点自动清零）
  function revDay() {
    const t = dayStr();
    if (!S.rev.day || S.rev.day.d !== t) S.rev.day = { d: t, n: 0, f: 0 };
    return S.rev.day;
  }
  // 今天还能不能加新学的：每天最多 REV_NEW 条，积压太多先消化
  const revNewOk = () => revDay().n < REV_NEW && dueList().length <= REV_BACKLOG;
  // 周报「隔一周还记得的比例」：今天到期、上次隔了 7 天以上（第 4 格以上）的题，这次答没答对（带提示的不算对）
  function logWeek(e, ok) {
    if (!e || !e.due || e.due > dayStr() || (e.b || 0) < 4) return;
    const L = dayLog(); L.weekN = (L.weekN || 0) + 1; if (ok) L.weekOk = (L.weekOk || 0) + 1;
  }
  function revUp(e, today) {   // 进一格
    e.b = Math.min(GAP.length, (e.b || 0) + 1);
    e.due = e.b >= GAP.length ? '' : addDays(today, GAP[e.b]); e.seen = today;
  }
  function revNew(q, k) {   // 新建一条记录（还没排期）
    revDay().n++;
    return (S.rev.items[k] = q.free ? { k: 'free', en: q.en, zh: q.zh || '', src: 'chat', c: dayStr() } : { k: q.kind, w: q.w, i: q.i, c: dayStr() });
  }
  function revWrong(q) {
    if (!q || !q.kind) return;
    const k = revKey(q), e = S.rev.items[k] || revNew(q, k);
    logWeek(e, false);
    e.b = 0; e.due = dayStr(); e.x = (e.x || 0) + 1; if (!e.c) e.c = dayStr();
    dayLog().wrongs = (dayLog().wrongs || 0) + 1;
    revTrim();
  }
  const addWrong = revWrong;   // 老名字：monsters.js / world.js 还在用
  // 对战里没念准 / 没听懂：只降一格（不清零），今天再复习一次；还没进复习本的照常记成错题
  function revMiss(q) {
    if (!q || !q.kind) return;
    const e = S.rev.items[revKey(q)];
    if (!e || !(e.b > 0)) { revWrong(q); return; }
    logWeek(e, false);
    e.b = Math.min(GAP.length, e.b) - 1; e.due = dayStr(); e.x = (e.x || 0) + 1;
    dayLog().wrongs = (dayLog().wrongs || 0) + 1;
  }
  // AI 打分用不了时「先跳过」（家长 2026-10-07，评估第 3 条）：放进复习、今天到期（格子不变、不算答错），标上 owe——
  // 联网以后复习里这题一定出开口题（buildReview），开口说对了才去掉。没有编号的句子（剧情里要说的话）用 revAddFree 的格式
  function revLater(q) {
    if (!q) return;
    if (!q.kind && q.en) q = { kind: 'sent', free: 'free:' + String(q.en).toLowerCase().replace(/[^a-z' ]/g, '').trim(), en: q.en, zh: q.zh || '' };
    if (!q.kind || (q.free && !q.en)) return;
    const k = revKey(q), today = dayStr();
    let e = S.rev.items[k];
    if (!e) { e = revNew(q, k); e.b = 0; e.x = 0; if (q.free) e.src = 'skip'; }
    if (!e.due || e.due > today) e.due = today;
    e.owe = 1;
    revTrim(); save();
  }
  // 答对了。inReview：在每日复习里；否则是闯关 / 对战 / 村民出题。aided：带着提示才答对（点了提示、看了原文、第 2 次才说对）
  function revRight(q, inReview, aided) {
    if (!q || !q.kind) return;
    const k = revKey(q), e = S.rev.items[k], today = dayStr();
    if (inReview) {
      if (!e) return;
      logWeek(e, !aided);
      if (aided) { e.due = addDays(today, 1); e.seen = today; }   // 带提示通过：不升格，明天再考一次
      else revUp(e, today);
      S.stats.reviewed++; qProg('review', 1);
      return;
    }
    if (e) {   // 冒险里碰到复习本里的题：今天到期的算一次复习（每天最多 REV_FIELD 次）
      if (aided || !e.due || e.due > today) return;
      const day = revDay();
      if (day.f >= REV_FIELD) return;
      logWeek(e, true);
      day.f++; revUp(e, today);
      S.stats.reviewed++; qProg('review', 1);
      dayLog().revField = (dayLog().revField || 0) + 1;
      return;
    }
    if (q.free || !isUnit(q.w)) return;   // 小岛的题答对了不进复习（和以前一样）
    // 带提示学到的也占每天新进的名额（不然常点提示的孩子一天能塞进几十条）
    if (!revNewOk()) return;
    if (aided) { const n = revNew(q, k); n.b = 0; n.due = addDays(today, 1); n.x = 0; }   // 带提示学到的：按「弱」进来，明天考
    else { const n = revNew(q, k); n.b = 1; n.due = addDays(today, 1); n.x = 0; }   // 课本新学的：明天复习
    dayLog().fresh = (dayLog().fresh || 0) + 1;
    revTrim();
  }
  // AI 聊天结束时老师给的「更好的说法」：明天复习。said = 孩子原来的说法（复习时显示出来，让他自己说出对的）
  // talk.js 现在只传 (better, zh)；以后传第 3 个参数 said 就会用上
  function revAddFree(en, zh, said) {
    en = String(en || '').trim(); if (!en || en.split(/\s+/).length > 14) return;
    const k = 'free:' + en.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    said = String(said || '').trim();
    if (said.toLowerCase() === en.toLowerCase() || said.split(/\s+/).length > 20) said = '';
    const old = S.rev.items[k];
    if (old) { if (said && !old.said) { old.said = said; save(); } return; }
    const e = revNew({ kind: 'sent', free: k, en, zh: String(zh || '') }, k);
    Object.assign(e, { b: 0, due: addDays(dayStr(), 1), x: 0 });
    if (said) e.said = said;
    revTrim(); save();
  }
  // 复习本最多留 REV_MAX 条还没掌握的。已经掌握的不删（周报「累计掌握」）；
  // 真的超了，先删只见过一次、从没错过的（刚进来、投入最少的），再删最早进来的
  function revTrim() {
    const act = Object.keys(S.rev.items).filter(k => S.rev.items[k].due);
    if (act.length <= REV_MAX) return;
    act.sort((a, b) => { const A = S.rev.items[a], B = S.rev.items[b]; return ((A.x || 0) > 0) - ((B.x || 0) > 0) || (A.b || 0) - (B.b || 0) || (B.c || '').localeCompare(A.c || ''); });
    for (const k of act.slice(0, act.length - REV_MAX)) delete S.rev.items[k];
  }
  function dueList() {   // 今天该复习的：谁逾期最久谁先来（同一天到期的，格子低的、错得多的先来）
    const today = dayStr();
    for (const [k, e] of Object.entries(S.rev.items)) if (!revItemOk(e)) delete S.rev.items[k];
    return Object.entries(S.rev.items).filter(([, e]) => e.due && e.due <= today)
      .sort((a, b) => a[1].due.localeCompare(b[1].due) || (a[1].b || 0) - (b[1].b || 0) || (b[1].x || 0) - (a[1].x || 0));
  }
  // 冒险里出题（对战；以后村民出题也可以用）：先挑今天到期的复习题（同一场不重复，今天冒险里算复习的次数还没满），
  // 再挑课本正在学的单元里还没学过的（src(z) 给出单元时），最后才随机。
  // kind：'word' / 'sent' / 'dlg'；used：这一场已经出过的题（revKey 的 Set，会往里加）
  // 返回 { q: 存进复习本用的 { kind, w, i }（聊天句子是 { kind:'sent', free, en, zh }）, it: 题目内容（words/sents/dlgs 里的一条）, d: 挑干扰项用的小岛 / 单元 }
  function revPick(kind, z, used) {
    used = used || new Set();
    const take = (q, it, d) => { used.add(revKey(q)); return { q, it, d }; };
    if (revDay().f < REV_FIELD) {
      const hit = dueList().find(([k, e]) => !used.has(k) && (e.k === 'free' ? kind === 'sent' && !!e.zh : e.k === kind && (S.book.mix > 0 || !isUnit(e.w))));
      if (hit) {
        const [k, e] = hit;
        if (e.k === 'free') return take({ kind: 'sent', w: -1, i: -1, free: k, en: e.en, zh: e.zh }, [e.en, e.zh], src(z).d);
        return take({ kind, w: e.w, i: e.i }, listOf(WX[e.w], kind)[e.i], WX[e.w]);
      }
    }
    const sr = src(z), L = listOf(sr.d, kind);
    const keys = range(L.length).filter(i => !used.has(kind + ':' + sr.w + ':' + i));
    const fresh = isUnit(sr.w) ? keys.filter(i => !S.rev.items[kind + ':' + sr.w + ':' + i]) : [];
    const i = fresh.length ? pick(fresh) : keys.length ? pick(keys) : rnd(L.length);
    return take({ kind, w: sr.w, i }, L[i], sr.d);
  }
  function freeQ(type, e, k) {   // AI 聊天句子出题：跟读或听音排句
    const q = { type, kind: 'sent', w: -1, i: -1, free: k, en: e.en, zh: e.zh, audio: e.en };
    if (type === 'lo') { q.tokens = tokens(e.en); q.bank = shuffle(range(q.tokens.length)); }
    else q.target = e.en;
    return q;
  }
  function buildReview() {
    const off = (navigator.onLine === false || aiDown()) && speakMode() === 'sr';   // 没网 / AI 用不了就打不了分：只出听力题
    return shuffle(dueList().slice(0, REV_N).map(([k, e]) => {
      // 聊天里改过的句子：有原话的让他直接说出对的（开口），没有原话的跟读或排句子；AI 用不了时先跳过的（owe）联网后一定开口
      if (e.k === 'free') return freeQ(e.en.split(/\s+/).length >= 3 && (off || (!e.said && !e.owe && Math.random() < .5)) ? 'lo' : 'sr_s', e, k);
      const t = e.owe && !off ? (e.k === 'word' ? 'sp' : e.k === 'sent' ? 'sr_s' : 'sr_d')
        : e.k === 'word' ? pick(off ? ['lw', 'ls'] : ['lw', 'ls', 'sp']) : e.k === 'sent' ? pick(off ? ['lm', 'lo'] : ['lm', 'lo', 'sr_s']) : off ? 'lr' : pick(['lr', 'sr_d']);
      const q = makeQ(t, e.w, e.i);
      q.rkey = k;
      return q;
    }));
  }
  function revSummary() {
    const d = dueList(), wrong = d.filter(([, e]) => !e.b).length, chat = d.filter(([, e]) => e.k === 'free').length;
    return { n: d.length, wrong, chat, old: d.length - wrong - chat };
  }
  function revCard() {   // 首页上方：今天的复习
    const r = revSummary();
    if (r.n && (dayLog().revSess || 0) > 0) return '<button class="rev-card done" data-act="review"><span>✅</span><div><b>今天复习过了</b><small>还可以加练 ' + r.n + ' 题（不练也行）</small></div></button>';
    if (!r.n) return '<div class="rev-card done"><span>✅</span><div><b>今天的复习做完了</b><small>答错的题、课本新学的内容会按 1、2、4、7…天的间隔自动回来</small></div></div>';
    const parts = [r.wrong ? r.wrong + ' 道错题' : '', r.old ? r.old + ' 道学过的' : '', r.chat ? r.chat + ' 句聊天里的' : ''].filter(Boolean).join(' + ');
    return '<button class="rev-card" data-act="review"><span>📕</span><div><b>今日复习 ' + r.n + ' 题</b><small>' + parts + (r.n > REV_N ? '，一次复习 ' + REV_N + ' 题' : '') + '</small></div><em>开始</em></button>';
  }
  // ---------- 按掌握程度撤提示（家长 2026-10-07 定，评估第 9 条）----------
  // 0 = 看着念（新学的、刚错过的：第 0–1 格）；1 = 只给每个词的首字母（第 2–3 格）；2 = 凭记忆说，只给中文和图（第 4 格以上、已掌握）；
  // 3 = 聊天里老师改过的句子：显示他原来的说法（划掉）和中文，让他直接说出对的
  function fadeOf(q) {
    if (!q) return 0;
    const e = S.rev.items[revKey(q)];
    if (!e) return 0;
    if (q.free && e.said) return 3;
    const b = e.due ? (e.b || 0) : GAP.length;
    const lv = b >= 4 ? 2 : b >= 2 ? 1 : 0;
    return lv === 2 && e.k === 'free' && !e.zh ? 1 : lv;   // 没有中文的聊天句子凭记忆说不出来：最多撤到首字母
  }
  // 提示文字：1 = 每个词留首字母（I u____ g__ u_）；2 = 字母全遮住（first：对话的回答留下第一个词）
  function cueText(text, lv, first) {
    const initial = w => { let seen = false; return w.replace(/[a-z]/gi, c => (seen ? '_' : (seen = true, c))); };
    return String(text).split(/\s+/).filter(Boolean).map((w, k) => lv >= 2 ? (first && k === 0 ? w : w.replace(/[a-z]/gi, '_')) : initial(w)).join('  ');
  }

  // ---------- 每日任务 ----------
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function ensureQuests() {
    const t = dayStr();
    if (S.quests.day === t && S.quests.list.length) return;
    const r = seeded(t);
    const talkOn = !!(window.EchoTalk && EchoTalk.relayUrl());
    const pool = QPOOL.filter(q => (q.key !== 'review' || dueList().length >= 5) && q.key !== 'talk');
    // 连得上 AI 对话服务时，每天固定有一个「和岛民聊天」的任务：每天都真的开口用英语交流
    const picked = talkOn ? [{ id: 'tk1', p: 0, claimed: false }] : [], keys = new Set(talkOn ? ['talk'] : []);
    let guard = 0;
    while (picked.length < 3 && guard++ < 100) {
      const q = pool[Math.floor(r() * pool.length)];
      if (keys.has(q.key)) continue;
      keys.add(q.key); picked.push({ id: q.id, p: 0, claimed: false });
    }
    S.quests = { day: t, list: picked, chest: false };
    save();
  }
  function qProg(key, n, isMax) {
    if (!isMax) { const L = dayLog(); L[key] = (L[key] || 0) + n; }
    ensureQuests();
    S.quests.list.forEach(q => {
      const d = QDEF[q.id];
      if (!d || d.key !== key || q.claimed) return;
      const was = q.p >= d.goal;
      q.p = Math.min(d.goal, isMax ? Math.max(q.p, n) : q.p + n);
      if (!was && q.p >= d.goal) toast('✅ 任务完成：' + d.t + '，回地图领奖励', 'gold');
    });
  }

  // ---------- 成就 ----------
  function checkAch() {
    ACH.forEach(([id, e, name, , cond]) => {
      if (S.ach[id] || !cond(S)) return;
      S.ach[id] = Date.now();
      S.coins += 20;
      toast('🏆 新成就「' + name + '」 +20 金币', 'gold');
      SFX.coin();
    });
    save();
  }

  // ---------- 提示与弹窗 ----------
  const recentToasts = {};
  function toast(msg, cls) {
    // 同一句提示 8 秒内只弹一次，避免连续朗读失败时刷屏
    const now = Date.now();
    if (recentToasts[msg] && now - recentToasts[msg] < 8000) return;
    recentToasts[msg] = now;
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
  function openModal(html, opts) {
    // 新打开的弹窗从顶上开始看（上一个弹窗滚到哪里不要带过来，比如菜单 → 背包）；
    // 同一个弹窗重画（设置里点选项、商店买东西，标题没变）保持原来滚到的位置
    const sh = $('#sheet'), wasHidden = $('#modal').hidden, h2 = () => { const e = sh.querySelector('h2'); return e ? e.textContent : ''; };
    const before = wasHidden ? null : h2();
    sh.innerHTML = html;
    $('#modal').hidden = false;
    if (wasHidden || before !== h2()) sh.scrollTop = 0;
    RT.modalLocked = !!(opts && opts.locked);
    const f = $('#sheet [data-focus]') || $('#sheet button:not([disabled])');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  // 弹窗关掉：家长输过密码的这一会儿也结束（家长设置看完关掉，孩子拿到手机就不能接着改）
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; RT.resetArm = false; RT.pin = null; RT.parentUntil = 0; }

  function confetti(n) {
    if (reduced) return;
    const c = $('#fx'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const Wd = window.innerWidth, Hd = window.innerHeight;
    c.width = Wd * dpr; c.height = Hd * dpr; ctx.scale(dpr, dpr);
    const cols = ['#FFC53D', '#FF6B57', '#2CAE69', '#0E7C86', '#8E6CEF', '#FF5E9C'];
    const ps = Array.from({ length: n || 140 }, () => ({ x: Wd / 2 + (Math.random() - .5) * 120, y: Hd * .38, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: pick(cols) }));
    const t0 = performance.now();
    (function f(t) {
      ctx.clearRect(0, 0, Wd, Hd);
      ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(f); else ctx.clearRect(0, 0, Wd, Hd);
    })(t0);
  }

  // ---------- 首页 ----------
  function isUnlocked(wi, li) {
    if (S.settings.unlockAll) return true;
    if (isUnit(wi)) return li === 0 || (S.stars[wi + '-' + (li - 1)] || 0) > 0;   // 课本单元：哪个单元都能直接开始，单元里按顺序
    if (li === 0) return wi === 0 || (S.stars[(wi - 1) + '-6'] || 0) > 0;
    return (S.stars[wi + '-' + (li - 1)] || 0) > 0;
  }
  function currentNode() {
    for (let wi = 0; wi < W.length; wi++) for (let li = 0; li < 7; li++)
      if (isUnlocked(wi, li) && !(S.stars[wi + '-' + li] > 0)) return wi + '-' + li;
    return '';
  }
  const starStr = n => '<span>' + '★'.repeat(n) + '</span><span class="off">' + '★'.repeat(3 - n) + '</span>';

  function renderTop() {
    const L = lvInfo(S.xp);
    $('#t-pet').textContent = S.pet;
    $('#t-lv').textContent = 'Lv ' + L.lv;
    $('#t-title').textContent = titleOf(L.lv);
    $('#t-xp').style.width = (L.cur / L.need * 100) + '%';
    $('#t-coins').textContent = S.coins;
    $('#t-streak-n').textContent = S.streak;
    $('#t-streak').classList.toggle('off', S.lastDay !== dayStr());
    $('#t-streak').title = S.lastDay === dayStr() ? '今天已打卡，连续 ' + S.streak + ' 天' : '今天还没打卡，完成任意一关就算';
    const n = dueList().length;
    $('#t-wrong').textContent = n ? n : '';
  }
  function questHTML() {
    ensureQuests();
    const L = S.quests.list;
    const allDone = L.length && L.every(q => q.claimed);
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.max(1, Math.round((mid - now) / 36e5));
    const rows = L.map(q => {
      const d = QDEF[q.id]; if (!d) return '';
      const done = q.p >= d.goal;
      const right = done && !q.claimed
        ? '<button class="btn small sun claim" data-act="claim" data-q="' + q.id + '">领取 +' + d.rw + '</button>'
        : '<span class="q-rw">' + (q.claimed ? '✓ 已领取' : q.p + ' / ' + d.goal) + '</span>';
      return '<div class="q-row ' + (q.claimed ? 'done' : '') + '"><span class="q-name">' + d.t + '</span>' + right + '<span class="q-bar"><i style="width:' + Math.min(100, q.p / d.goal * 100) + '%"></i></span></div>';
    }).join('');
    const opened = S.quests.chest, ready = allDone && !opened;
    const chest = '<button class="chest-btn ' + (ready ? 'ready' : '') + '" data-act="chest" ' + (ready ? '' : 'disabled') + '><span class="ch">' + (opened ? '📭' : '🎁') + '</span><span><b>' + (opened ? '今天的宝箱已经打开' : ready ? '每日宝箱可以打开了！' : '每日宝箱') + '</b><br><small>' + (opened ? '明天任务会刷新，记得回来' : '领完 3 个任务奖励就能打开，可能开出进化曲、怪兽蛋') + '</small></span></button>';
    return revCard() + '<div class="q-head"><h3>今日任务</h3><small>' + hrs + ' 小时后刷新</small></div>' + rows + chest;
  }
  const OFFS = [0, -56, -78, -34, 38, 76, 0];
  function worldHTML(w, wi, cur) {
    const unlocked = isUnlocked(wi, 0);
    const tot = range(7).reduce((a, l) => a + (S.stars[wi + '-' + l] || 0), 0);
    const head = isUnit(wi) ? unitHead(w, wi, tot) : '<div class="w-head"><span class="w-ico">' + w.icon + '</span><div><div class="w-no">第 ' + (wi + 1) + ' 岛</div><h2>' + w.name + '</h2><p class="w-en">' + esc(w.en) + '</p></div>' +
      (unlocked ? '<span class="w-stars">★ ' + tot + '/21</span>' : '<span class="w-lock">🔒 打败上一岛的 Boss 解锁</span>') + '</div>';
    if (!unlocked) return '<section class="world locked" style="--wc:' + w.color + '">' + head + '</section>';
    const nodes = RECIPES.map((r, li) => {
      const k = wi + '-' + li, st = S.stars[k] || 0, un = isUnlocked(wi, li), isCur = k === cur;
      const cls = ['node', r.boss ? 'boss' : '', st ? 'done' : '', un ? '' : 'lock', isCur ? 'cur' : ''].join(' ');
      return '<button class="' + cls + '" style="--x:' + OFFS[li] + 'px" data-act="level" data-w="' + wi + '" data-l="' + li + '"' + (un ? '' : ' disabled') + ' aria-label="' + w.name + ' ' + r.name + (un ? '' : '（未解锁）') + '">' +
        (isCur ? '<span class="n-start">开始</span><span class="n-pet">' + S.pet + '</span>' : '') +
        '<span class="n-ico">' + (un ? (r.boss ? w.boss.emoji : r.icon) : '🔒') + '</span>' +
        '<span class="n-name">' + (r.boss ? 'BOSS · ' + w.boss.name : r.name) + '</span><span class="n-stars">' + (un ? starStr(st) : '') + '</span></button>';
    }).join('');
    const sc = window.SCENES && window.SCENES[wi], seen = S.scenes[wi];
    const scBtn = sc ? '<button class="scene-btn" data-act="scene" data-w="' + wi + '"><span class="sb-ico">🎬</span><span class="sb-t"><b>对话动画 · ' + esc(sc.title) + '</b><small>' +
      (seen && seen.watched ? '✓ 看过了 · 可以再来跟读、角色扮演' : '先看看这个话题的英语对话怎么说 · 第一次看完 +10 金币') + '</small></span><span class="sb-go">▶</span></button>' : '';
    return '<section class="world' + (isUnit(wi) ? ' unit' + (wi - NB === curIdx() ? ' now' : '') : '') + '" id="w' + wi + '" style="--wc:' + w.color + '">' + head + '<div class="path">' + scBtn + nodes + '</div></section>';
  }
  // ---------- 课本单元（适用于沪教版词汇；不叫「同步」，也不说「配套」：评估「必须改」第 6 条） ----------
  // 销售版只开放买了的那个学年的册（2026-10-08 评审：卖的是「本学年」，下一学年的内容包另买）：
  // 打包时 -PECHO_BOOKS=hj7a,hj7b 写进原生（EchoNative.books()），没有就是七上、七下。家庭版全部开放
  const BOOK_OPEN = (() => {
    if (!(window.DEX && DEX.sales)) return null;
    let v = ''; try { if (nat('books')) v = String(EchoNative.books() || ''); } catch (e) { v = ''; }
    const ids = v.split(',').map(x => x.trim()).filter(Boolean);
    return new Set(ids.length ? ids : ['hj7a', 'hj7b']);
  })();
  const bookOpen = id => !BOOK_OPEN || BOOK_OPEN.has(id);
  const unitOpen = i => !!BK[i] && bookOpen(BK[i].book);
  // 正在学哪个单元：家长/孩子在闯关页选；没选过就按日期猜——七上从 BOOKS.start 那年秋天开始，
  // 秋季学期 9 月到次年 1 月、春季学期 2 月到 8 月，一个学期 8 个单元，一个单元两周多
  function guessIdx() {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1, start = (window.BOOKS && window.BOOKS.start) || y;
    const sem = Math.max(0, (y - start) * 2 + (m >= 9 ? 0 : m >= 2 ? -1 : -2));
    const b = BOOKS[Math.min(sem, BOOKS.length - 1)];
    // 猜到的册没开放（销售版过了这个学年）：停在开放的最后一个单元
    if (!bookOpen(b.id)) { let last = -1; BK.forEach((u, i) => { if (bookOpen(u.book)) last = i; }); return last; }
    const s0 = m >= 9 || m < 2 ? new Date(m >= 9 ? y : y - 1, 8, 1) : new Date(y, 1, 20);
    const n = Math.max(1, Math.min(b.units.length, 1 + Math.floor((d - s0) / 864e5 / 17)));
    return BK.findIndex(u => u.book === b.id && u.n === n);
  }
  function curIdx() {
    if (!BK.length) return -1;
    return S.book.at >= 0 && unitOpen(Math.min(S.book.at, BK.length - 1)) ? Math.min(S.book.at, BK.length - 1) : guessIdx();
  }
  const curUnit = () => BK[curIdx()] || null;
  const viewBook = () => { const vb = S.book.vb; return BOOKS.find(b => b.id === vb && bookOpen(b.id)) || BOOKS[(curUnit() || { bi: 0 }).bi]; };
  function unitHead(u, wi, tot) {
    const now = wi - NB === curIdx();
    return '<div class="w-head"><span class="w-ico">' + u.icon + '</span><div><div class="w-no">' + esc(u.bshort) + ' · Unit ' + u.n + (now ? ' · 📍 正在学' : '') + '</div><h2>' + esc(u.en) + ' <small>' + esc(u.zh) + '</small></h2><p class="w-en">' + esc(u.key) + '</p></div>' +
      '<span class="w-stars">★ ' + tot + '/21</span></div>' +
      '<div class="u-bar"><button class="link" data-act="bookGram" data-w="' + wi + '">📐 语法：' + esc(u.grammar.title) + '</button>' +
      (unitTalk(u) ? '<button class="btn small sun" data-act="talk_open" data-npc="' + unitTalk(u).id + '">🗣️ 和 ' + esc(unitTalk(u).name) + ' 聊这个单元</button>' : '') +
      (now ? '' : '<button class="btn small ghost" data-act="bookAt" data-i="' + (wi - NB) + '">设为正在学</button>') + '</div>';
  }
  function unitTalk(u) {   // 这个单元的 AI 聊天角色（连不上对话服务就不显示）
    if (!window.EchoTalk || !EchoTalk.relayUrl() || !window.TALK_NPCS) return null;
    return window.TALK_NPCS.byId[u.book + '-u' + u.n] || null;
  }
  function bookNode() {   // 「开始」标在正在学的单元里第一关没拿星的地方
    const wi = NB + curIdx();
    for (let li = 0; li < 7; li++) if (isUnlocked(wi, li) && !(S.stars[wi + '-' + li] > 0)) return wi + '-' + li;
    return '';
  }
  function bookHTML() {
    const cu = curUnit(), vb = viewBook();
    const chips = '<div class="seg books">' + BOOKS.map(b => '<button class="' + (b === vb ? 'on' : '') + (bookOpen(b.id) ? '' : ' locked') + '" data-act="bookView" data-b="' + b.id + '">' + (bookOpen(b.id) ? '' : '🔒') + esc(b.short) + (b.id === cu.book ? ' 📍' : '') + '</button>').join('') + '</div>';
    return '<div class="book-head"><b>📗 课本单元 · 适用于沪教版词汇</b>' +
      '<p>' + (BOOK_OPEN ? '这个学年的课本单元（' + BOOKS.filter(b => bookOpen(b.id)).map(b => esc(b.short)).join('、') + '）' : '七年级到九年级六册书') + '：每个单元要学的单词和短语，加上按单元的话题和语法自己编写的句子和对话（不是课文）。</p>' +
      '<p>正在学：<b>' + esc(cu.bshort) + ' Unit ' + cu.n + ' ' + esc(cu.en) + '</b>' + (S.book.at >= 0 ? '' : '（按日期猜的）') + ' <button class="link" data-act="bookPick">改</button></p>' + chips +
      (vb.old ? '<p class="tip">' + esc(vb.short) + '的新教材还没出版（预计 2027 年春季），现在先用旧版教材的单元，新书出来后会换掉。</p>' : '') + '</div>' +
      BK.map((x, j) => x.book === vb.id ? worldHTML(x, NB + j, bookNode()) : '').join('');
  }
  function renderHome() {
    renderTop();
    homeBars();   // AI 用不了的红条、有新版本
    const talkOn = !!(window.EchoTalk && EchoTalk.relayUrl());   // 连得上对话服务才显示「和岛民聊天」
    const tab = S.homeTab === 'talk' && talkOn ? 'talk' : window.MonsterGame && S.homeTab !== 'quiz' ? 'mon' : 'quiz';
    $('#tabs').innerHTML = window.MonsterGame ? '<button class="' + (tab === 'mon' ? 'on' : '') + '" data-act="tab" data-t="mon">🐲 怪兽冒险</button><button class="' + (tab === 'quiz' ? 'on' : '') + '" data-act="tab" data-t="quiz">📚 闯关练习</button>' +
      (talkOn ? '<button class="' + (tab === 'talk' ? 'on' : '') + '" data-act="tab" data-t="talk">🗣️ 和岛民聊天</button>' : '') : '';
    $('#tabs').classList.toggle('three', talkOn);
    $('#quests').innerHTML = questHTML();
    $('#mon-home').hidden = tab !== 'mon';
    $('#quiz-home').hidden = tab !== 'quiz';
    $('#talk-home').hidden = tab !== 'talk';
    if (tab === 'talk') { $('#talk-home').innerHTML = EchoTalk.homeHTML(); return; }
    if (tab === 'mon') { $('#mon-home').innerHTML = MonsterGame.homeHTML(); MonsterGame.afterHome(); return; }
    const book = BK.length && S.book.view !== 'isle';
    const seg = BK.length ? '<div class="seg qv"><button class="' + (book ? 'on' : '') + '" data-act="quizView" data-v="book">📗 课本单元</button><button class="' + (book ? '' : 'on') + '" data-act="quizView" data-v="isle">🏝️ 话题小岛</button></div>' : '';
    const cur = currentNode();
    $('#map').innerHTML = seg + (book ? bookHTML() : W.map((w, wi) => worldHTML(w, wi, cur)).join(''));
    if (RT.scrollCur) {
      RT.scrollCur = false;
      const n = $('.node.cur');
      if (n) setTimeout(() => n.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 120);
    }
  }
  // 样品美术（?art=blender / gemini）加载完之后，首页的怪兽卡片重画一次
  window.addEventListener('mon3d-ready', () => { if (!$('#home').hidden) renderHome(); });
  function show(id) {
    if (RT.scr === 'battle' && id === 'world') { RT.battleEnd = Date.now(); setTimeout(advTick, 600); }   // 刚打完一场（护眼提醒、时间到了都等这个时候）
    RT.scr = id;
    ['home', 'play', 'result', 'theater', 'battle', 'world'].forEach(s => { $('#' + s).hidden = s !== id; document.body.classList.toggle('scr-' + s, s === id); });
    $('#topbar').hidden = id === 'play' || id === 'theater' || id === 'battle' || id === 'world';
    document.body.classList.toggle('in-world', id === 'world');
    window.scrollTo(0, 0);
    sceneMusic();
  }
  function goHome(tab) {
    if (typeof tab === 'string') S.homeTab = tab;
    if (window.MonsterGame) MonsterGame.stop();
    if (window.EchoWorld) EchoWorld.stop();
    if (T) { stopScene(); T = null; }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    P = null;
    hideFb();
    RT.scrollCur = true;
    show('home');
    renderHome();
  }

  // ---------- 关卡详情 ----------
  function levelSheet(wi, li) {
    const w = WX[wi], r = RECIPES[li];
    const st = S.stars[wi + '-' + li] || 0;
    const types = [...new Set(r.mix.map(m => m[0]))].map(t => '<span class="tag">' + TYPE_TAG[t] + '</span>').join('');
    let items;
    if (li <= 1) items = w.words.map(x => [x[0], x[2] + ' ' + x[1]]);
    else if (li <= 3) items = w.sents.map(x => [x[0], x[1]]);
    else items = w.dlgs.map(x => [x[0] + ' → ' + x[1], '']);
    const pre = items.map(([en, zh]) => '<button class="pre-item" data-act="sayText" data-t="' + esc(en.replace(' → ', ' ... ')) + '">🔊 <b>' + esc(en) + '</b><span>' + esc(zh) + '</span></button>').join('');
    openModal(
      '<div class="big">' + (r.boss ? w.boss.emoji : r.icon) + '</div>' +
      '<h2>' + w.name + ' · ' + (r.boss ? 'BOSS ' + w.boss.name : r.name) + '</h2>' +
      '<p>' + r.desc + (r.boss ? '' : ' 共 ' + r.mix.reduce((a, m) => a + m[1], 0) + ' 题，3 颗心。') + '</p>' +
      '<div class="lv-types">' + types + '</div>' +
      (st ? '<p>最好成绩：<span class="n-stars" style="font-size:18px">' + starStr(st) + '</span></p>' : '') +
      (li === 4 && window.SCENES && window.SCENES[wi] ? '<button class="btn sun wide" data-act="scene" data-w="' + wi + '">🎬 先看对话动画</button>' : '') +
      '<details class="pre"><summary>📖 先预习一下（点一句就能听）</summary><div class="pre-list">' + pre + '</div></details>' +
      '<div class="row"><button class="btn ghost" data-act="close">再想想</button><button class="btn" data-act="start" data-w="' + wi + '" data-l="' + li + '" data-focus>开始闯关</button></div>'
    );
  }

  // ---------- 闯关 ----------
  // given：测试用，直接给好题目（EchoGame.playQs）
  function startLevel(wi, li, review, given) {
    primeTTS(); ac();
    const qs = given || (review ? buildReview() : buildLevel(wi, li));
    if (!qs.length) { toast('今天没有要复习的题，太棒了！'); return; }
    const boss = !review && RECIPES[li].boss;
    // aidedN：带提示通过了几题；recall：不看字说对了几题（结算页显示）
    P = { wi, li, review: !!review, qs, idx: 0, total: qs.length, hearts: 3, combo: 0, maxCombo: 0, correct: 0, xp: 0, lost: 0, hits: 0, boss, bossMax: qs.filter(q => q.type === 'bt').length, revived: false, aidedN: 0, recall: 0 };
    show('play');
    renderHearts();
    $('#p-combo').textContent = '';
    $('#p-boss').innerHTML = boss ? bossBar() : '';
    if (boss) {
      const b = WX[wi].boss;
      hideFb();
      $('#p-prog').style.width = '0%';
      $('#p-body').innerHTML = '<div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="hidden-line">' + esc(b.hello) + '</div></div></div>' +
        '<p class="say-zh" style="text-align:center">' + b.name + ' 挡住了去路！听懂它的话，<b>大声说出</b>正确的回答来攻击它。</p>' +
        '<button class="btn sun wide" data-act="bossGo" data-focus>⚔️ 迎战！</button>';
      $('#p-body').dataset.q = 'intro';
      say(b.hello);
    } else renderQ();
  }
  function bossBar() {
    const b = WX[P.wi].boss;
    const pct = P.bossMax ? (1 - P.hits / P.bossMax) * 100 : 100;
    return '<div class="boss-hp" id="bosshp"><span class="be">' + b.emoji + '</span><span class="bn">' + b.name + '</span><div class="hp"><i style="width:' + pct + '%"></i></div></div>';
  }
  function renderHearts() {
    $('#p-hearts').innerHTML = range(3).map(i => '<span class="' + (i < P.hearts ? '' : 'lost') + '">❤️</span>').join('');
  }
  function showCombo() {
    const el = $('#p-combo');
    if (P.combo >= 2) {
      const m = mult();
      el.textContent = '🔥 ' + P.combo + ' 连击' + (m > 1 ? ' · 经验 ×' + m : '');
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    } else el.textContent = '';
  }
  const mult = () => P.combo >= 10 ? 3 : P.combo >= 5 ? 2 : P.combo >= 3 ? 1.5 : 1;

  const audioBlock = () => '<div class="q-audio"><button class="spk" data-act="say" aria-label="播放">' + SPK + '</button><button class="slow" data-act="saySlow" aria-label="慢速播放"><span>🐢</span>慢速</button></div>';
  function optsHTML(q, cls, list) {
    return '<div class="opts ' + (list ? 'list' : '') + '">' + q.opts.map((o, i) =>
      '<button class="opt ' + (cls || '') + '" data-act="' + (q.type === 'bt' ? 'btOpt' : 'pick') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span>' +
      (o.e ? '<span class="o-e">' + o.e + '</span>' : '') + '<span class="o-t">' + esc(o.t) + '</span></button>').join('') + '</div>';
  }
  function micHTML(q) {
    const mode = speakMode();
    const selfNoRec = mode === 'self' && !canRecord();
    let h = '';
    if (!selfNoRec) {
      h += '<div class="mic-wrap"><button class="mic" id="mic" data-act="mic" aria-label="开始说话">' + MIC + '</button>' +
        '<div class="mic-hint" id="mic-hint">' + (mode === 'sr' ? '点麦克风，然后大声说英语' : '点麦克风开始录音，说完再点一次') + '</div>' +
        '<div class="heard" id="heard"></div><div id="score"></div></div>';
    }
    h += '<div class="self" id="self" hidden></div>';
    // 开口模式平时不能跳过（说三次还不行会记进每日复习）；AI 打分用不了（没网、额度、没密钥，aiDown）时才出现「先跳过」
    if (mode !== 'sr') h += '<button class="link" data-act="skip">现在不方便开口？跳过这题</button>';
    else h += '<button class="link ai-skip" data-act="skip" id="p-skip"' + (aiDown() ? '' : ' hidden') + '>' + SKIP_TXT + '</button>';
    return h;
  }
  // 口语题分两块：q-main 是题目卡片，q-side 是话筒 / 自评 / 跳过（竖屏照常上下排，横屏左右两栏）
  const qSide = h => '<div class="q-side">' + h + '</div>';
  function wordsHTML(text) { return text.split(/\s+/).map(w => '<span class="w">' + esc(w) + '</span>').join(' '); }

  function renderQ() {
    const q = P.qs[P.idx];
    P.q = q; P.answered = false; P.tries = 0; P.miss = 0; P.hint = 0; P.lo = []; P.btChoose = false; P.pickedOk = false; P.selfReveal = false;
    // 按掌握程度撤提示：fade 见 fadeOf()；看图说英语一直是凭记忆说；Boss 的对话题掌握了以后先不给选项（只在 AI 打分时，自评要点选项）
    // aided：这题点过提示 / 看过原文 / 第 2 次才说对（不算 Perfect、不加连击、经验减半、复习里不升格）；blind：题面上没有答案
    const t = q.type, srm = speakMode() === 'sr';
    P.fade = t === 'sp' ? 2 : /^sr_/.test(t) ? fadeOf(q) : t === 'bt' && srm ? Math.min(1, fadeOf(q)) : 0;
    P.aided = false;
    P.blind = t === 'sp' || P.fade >= 2 || (t === 'bt' && P.fade >= 1);
    hideFb();
    window.scrollTo(0, 0);   // 上一题往下滚过，新题要从标题开始看
    $('#p-prog').style.width = (P.idx / P.total * 100) + '%';
    // 撤了提示的跟读题不再叫「跟读」：看首字母说 / 凭记忆说 / 改正说法
    const FADE_LABEL = { 1: '🔤 看首字母说', 2: '🧠 凭记忆说', 3: '✏️ 改正说法' };
    let h = '<div class="q-type">' + ((/^sr_/.test(t) && FADE_LABEL[P.fade]) || TYPE_LABEL[q.type]) + '</div>';
    const hintRow = '<div class="say-row"><button class="btn small ghost" data-act="hint" id="hintbtn">💡 提示</button></div>';
    const said = P.fade === 3 ? (S.rev.items[revKey(q)] || {}).said || '' : '';
    if (t === 'lw') h += '<h2 class="q-title">听一听，选出正确的意思</h2>' + audioBlock() + optsHTML(q);
    else if (t === 'ls') h += '<h2 class="q-title">听一听，选出你听到的英文</h2>' + audioBlock() + optsHTML(q, 'en');
    else if (t === 'lm') h += '<h2 class="q-title">听句子，选出正确的中文意思</h2>' + audioBlock() + optsHTML(q, '', true);
    else if (t === 'lr') h += '<h2 class="q-title">对方这样说，你该怎么回答？</h2>' + audioBlock() +
      '<div class="hidden-line blur" id="hl">' + esc(q.prompt) + '</div><div style="text-align:center"><button class="link" data-act="reveal">看原文（先试着只用耳朵听）</button></div>' + optsHTML(q, 'en', true);
    else if (t === 'lo') h += '<h2 class="q-title">听句子，按顺序点出单词</h2>' + audioBlock() +
      '<div class="lo-ans" id="lo-ans"></div><div class="lo-bank" id="lo-bank">' + q.bank.map(i => '<button class="tile" data-act="tile" data-i="' + i + '">' + esc(q.tokens[i]) + '</button>').join('') + '</div>' +
      '<button class="btn wide" data-act="loCheck" id="lo-check" disabled>检查</button>';
    else if ((t === 'sr_w' || t === 'sr_s') && !P.fade) h += '<h2 class="q-title">先听，再大声跟读</h2>' +
      '<div class="q-main"><div class="say-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') + '<div class="say-text" id="st">' + wordsHTML(q.target) + '</div><div class="say-zh">' + esc(q.zh) + '</div>' +
      '<div class="say-row"><button class="spk mini" data-act="sayT" aria-label="听原音">' + SPK + '</button><button class="slow" data-act="sayTSlow" aria-label="慢速"><span>🐢</span>慢速</button></div></div></div>' + qSide(micHTML(q));
    else if (t === 'sr_w' || t === 'sr_s') h += '<h2 class="q-title">' + (P.fade === 3 ? '这句话可以说得更好：直接说出正确的英文' : P.fade === 2 ? '看中文，凭记忆用英语说出来' : '看首字母提示，说出' + (t === 'sr_w' ? '这个词' : '整句话')) + '</h2>' +
      '<div class="q-main"><div class="say-card">' + (q.em ? '<div class="say-emoji">' + q.em + '</div>' : '') +
      (said ? '<div class="say-zh">你原来说的：<s>' + esc(said) + '</s></div>' : '') + (q.zh ? '<div class="say-zh">' + esc(q.zh) + '</div>' : '') +
      '<div class="say-text mask" id="st">' + esc(cueText(q.target, P.fade === 1 ? 1 : 2)) + '</div>' + hintRow + '</div></div>' + qSide(micHTML(q));
    else if (t === 'sr_d') h += '<h2 class="q-title">听对方说话，然后' + (P.fade >= 2 ? '凭记忆' : '') + '大声说出你的回答</h2>' +
      '<div class="q-main"><div class="bubble-row"><span class="be">🧑‍🏫</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="听对方说">' + SPK + '</button><span>' + esc(q.prompt) + '</span></div></div></div>' +
      '<div class="say-card"><div class="say-zh">你来说：</div>' + (P.fade
        ? '<div class="say-text mask" id="st">' + esc(cueText(q.target, P.fade, true)) + '</div>' + hintRow
        : '<div class="say-text" id="st">' + wordsHTML(q.target) + '</div><div class="say-row"><button class="spk mini" data-act="sayT" aria-label="听示范">' + SPK + '</button><button class="slow" data-act="sayTSlow"><span>🐢</span>慢速</button></div>') + '</div></div>' + qSide(micHTML(q));
    else if (t === 'sp') h += '<h2 class="q-title">看图，用英语说出来</h2>' +
      '<div class="q-main"><div class="say-card"><div class="say-emoji">' + q.em + '</div><div class="say-zh">' + esc(q.zh) + '</div><div class="say-text mask" id="st">' + esc(cueText(q.target, 2)) + '</div>' +
      hintRow + '</div></div>' + qSide(micHTML(q));
    else if (t === 'bt') {
      const b = WX[P.wi].boss, hide = P.fade >= 1;
      h += '<div class="q-main"><div class="bubble-row"><span class="be">' + b.emoji + '</span><div class="bubble"><div class="say-row" style="justify-content:flex-start"><button class="spk mini" data-act="say" aria-label="再听一遍">' + SPK + '</button><button class="slow" data-act="saySlow"><span>🐢</span>慢速</button></div>' +
        '<div class="hidden-line blur" id="hl">' + esc(q.prompt) + '</div><button class="link" data-act="reveal">看原文</button></div></div>' +
        '<p class="say-zh" style="text-align:center;margin:0">' + (hide ? '听懂它的话，<b>凭记忆用英语回答</b>攻击它！' : srm ? '选一句正确的回答，<b>大声说出来</b>攻击它！（点选项可以先听一听）' : '先点出正确的回答，再大声说出来攻击它！') + '</p></div>' +
        (hide ? optsHTML(q, 'en', true).replace('<div class="opts', '<div id="bt-opts" hidden class="opts') + '<div style="text-align:center"><button class="link" data-act="btShow" id="bt-show">👀 看看可以怎么回答（这题就不能暴击了）</button></div>' : optsHTML(q, 'en', true)) +
        qSide(srm ? micHTML(q) : '<div class="self" id="self" hidden></div>');
    }
    $('#p-body').innerHTML = h;
    $('#p-body').dataset.q = t;   // 横屏排版按题型分栏（style.css 横屏那段）
    if (SPEAK_TYPES.includes(t) && speakMode() === 'self' && !canRecord()) showSelf(false, true);
    // 自动先念一遍：跟读题撤了提示以后不念（不然等于把答案念出来）；说出回答 / Boss 念的是对方的问题，照常念
    if (t !== 'sp' && !(P.fade && (t === 'sr_w' || t === 'sr_s'))) setTimeout(() => { if (P && P.q === q) say(q.audio); }, 380);
  }
  // 撤了提示的题：亮出答案（marks：每个词说对没有，标绿 / 标红）
  function showAnswer(marks) {
    const st = $('#st'); if (!st || !P) return;
    if (st.classList.contains('mask')) { st.classList.remove('mask'); st.innerHTML = wordsHTML(P.q.target); }
    if (marks) $$('.w', st).forEach((w, k) => { w.classList.toggle('ok', !!marks[k]); w.classList.toggle('miss', !marks[k]); });
    const b = $('#hintbtn'); if (b) b.disabled = true;
  }
  // 撤了提示的题还没答完就听示范（键盘、录音自评的 🔊）：等于看了答案
  function peekAnswer() {
    const st = $('#st');
    if (!P || P.answered || P.selfReveal || !st || !st.classList.contains('mask')) return;
    P.aided = true; showAnswer();
  }
  // Boss 题的选项亮出来；aid：还没答完就看了（算带提示）
  function btReveal(aid) {
    const o = $('#bt-opts'); if (o) o.hidden = false;
    const b = $('#bt-show'); if (b) b.remove();
    if (aid && P && !P.answered) P.aided = true;
  }

  function praise() { return pick(PRAISE); }
  function showFb(ok, title, detail, btn) {
    const fb = $('#fb');
    fb.className = 'fb show ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
    $('#fb-t').textContent = title;
    $('#fb-d').innerHTML = detail || '';
    $('#fb-btn').textContent = btn || '继续';
    $('#p-prog').style.width = ((P.idx + 1) / P.total * 100) + '%';
    setTimeout(() => $('#fb-btn').focus({ preventScroll: true }), 60);
    // 标出对错的选项 / 排好的句子不要被反馈条盖住（横屏时屏幕矮，最常见）：往上滚一点，但别把它滚到顶栏下面
    setTimeout(() => {
      const ms = $$('#p-body .opt.right, #p-body .opt.wrong, #lo-ans').map(e => e.getBoundingClientRect()).filter(r => r.height);
      if (!ms.length || !fb.classList.contains('show')) return;
      const bot = Math.max(...ms.map(r => r.bottom)), top = Math.min(...ms.map(r => r.top));
      const limit = window.innerHeight - fb.offsetHeight - 8, head = ($('#play .p-top') || { offsetHeight: 0 }).offsetHeight + 8;
      const dy = Math.min(bot - limit, top - head);
      if (bot > limit && dy > 0) window.scrollBy({ top: dy, behavior: reduced ? 'auto' : 'smooth' });
    }, 40);
  }
  function hideFb() { $('#fb').className = 'fb'; }

  // 答对了。带着提示答对的（点过提示、看过原文、第 2 次才说对）：不算 Perfect、不加连击、经验减半、复习里不升格（明天再考），新学的按「弱」进复习
  function good(speak, perfect) {
    const aided = !!P.aided || (speak && P.tries > 0);
    P.aided = aided;
    P.correct++;
    if (aided) { P.aidedN++; dayLog().aided = (dayLog().aided || 0) + 1; }
    else { P.combo++; P.maxCombo = Math.max(P.maxCombo, P.combo); }
    perfect = perfect && !aided;
    let gain = Math.round((speak ? (perfect ? 20 : 15) : 10) * mult());
    if (aided) gain = Math.max(1, Math.round(gain / 2));
    P.xp += gain;
    if (speak) { S.stats.spoken++; qProg('spoken', 1); if (perfect) { S.stats.perfect++; qProg('perfect', 1); } logSpk(!aided); }
    else { S.stats.listen++; qProg('listen', 1); }
    // 不看字说对（凭记忆说出来的）：结算页「几题」；周报和神兽里程碑只数句子（dayLog().recall），单个词另记 recallW
    if (speak && P.blind && !aided) { P.recall++; const rk = KIND[P.q.type] === 'word' ? 'recallW' : 'recall'; dayLog()[rk] = (dayLog()[rk] || 0) + 1; }
    if (speak) { const e = S.rev.items[revKey(P.q)]; if (e && e.owe) delete e.owe; }   // 先跳过、欠着的那句补说了
    revRight(P.q, P.review, aided);
    SFX.ok(P.combo);
    showCombo();
    if (P.boss && P.q.type === 'bt') bossHit();
    return gain;
  }
  // 周报「一次说对的比例」：开口题做完一道记一次（spkQ），第一次就不带提示说对的记 spk1
  function logSpk(first) { const L = dayLog(); L.spkQ = (L.spkQ || 0) + 1; if (first) L.spk1 = (L.spk1 || 0) + 1; }
  function bad() {
    P.combo = 0; P.hearts--; P.lost++;
    addWrong(P.q);
    SFX.bad(); buzz(120);
    renderHearts(); showCombo();
  }
  function bossHit() {
    P.hits++;
    $('#p-boss').innerHTML = bossBar();
    const bar = $('#bosshp');
    bar.classList.add('hit');
    SFX.hit();
    const d = document.createElement('span');
    d.className = 'dmg'; d.textContent = '-' + Math.round(100 / P.bossMax) + '%';
    d.style.left = '60%'; d.style.top = '0';
    bar.style.position = 'relative';
    bar.appendChild(d);
  }
  function detailOf(q) {
    if (q.kind === 'dlg') return '<b>' + esc(q.prompt) + '</b> → ' + esc(q.en);
    return '<b>' + esc(q.en) + '</b> · ' + esc(q.zh);
  }

  // 选择题
  function onPick(i) {
    if (!P || P.answered) return;
    const q = P.q, o = q.opts[i];
    P.answered = true;
    $$('#p-body .opt').forEach((b, k) => {
      if (q.opts[k].c) b.classList.add('right');
      else if (k === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const hl = $('#hl'); if (hl) hl.classList.remove('blur');
    if (o.c) { const g = good(false); showFb(true, praise() + ' +' + g + ' 经验' + (P.aided ? '（看了原文，减半）' : ''), detailOf(q)); }
    else {
      bad();
      showFb(false, '哎呀，不对', '正确答案：' + detailOf(q));
      setTimeout(() => say(q.type === 'lr' ? q.en : q.audio), 300);
    }
  }
  // 听音排句
  function onTile(i, fromAns) {
    if (!P || P.answered) return;
    const q = P.q;
    if (fromAns) P.lo = P.lo.filter(x => x !== i);
    else if (!P.lo.includes(i)) P.lo.push(i);
    SFX.tap();
    $('#lo-ans').innerHTML = P.lo.map(k => '<button class="tile" data-act="untile" data-i="' + k + '">' + esc(q.tokens[k]) + '</button>').join('');
    $$('#lo-bank .tile').forEach(b => b.classList.toggle('used', P.lo.includes(+b.dataset.i)));
    $('#lo-check').disabled = P.lo.length !== q.tokens.length;
  }
  function onLoCheck() {
    if (!P || P.answered) return;
    const q = P.q;
    P.answered = true;
    const ok = P.lo.map(k => q.tokens[k].toLowerCase()).join(' ') === q.tokens.map(t => t.toLowerCase()).join(' ');
    $('#lo-ans').classList.add(ok ? 'right' : 'wrong');
    if (ok) { const g = good(false); showFb(true, praise() + ' +' + g + ' 经验', detailOf(q)); }
    else { bad(); showFb(false, '顺序不对', '正确句子：' + detailOf(q)); setTimeout(() => say(q.audio), 300); }
  }

  // 口语题
  function setMic(on, label) {
    const m = $('#mic'); if (!m) return;
    m.classList.toggle('on', on);
    m.innerHTML = on ? STOP : MIC;
    if (label !== undefined) $('#mic-hint').textContent = label;
  }
  async function onMic() {
    if (!P || P.answered) return;
    if (RT.listening || RT.recording) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const q = P.q;
    if (speakMode() === 'sr') {
      setMic(true, '正在听……说完会自动停止');
      $('#heard').textContent = '';
      $('#score').innerHTML = '';
      const res = await recognize(t => { const h = $('#heard'); if (h) h.textContent = t; }, q.type === 'bt' ? q.opts.map(o => o.t) : [q.target]);
      if (!P || P.q !== q || P.answered) return;
      setMic(false, '');
      if (res.err && FATAL.includes(res.err)) {
        RT.srBroken = true;
        if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
        toast(RT.noRec ? '用不了麦克风，已切换成「大声读 + 自评」模式' : '这个浏览器连不上语音识别，已切换成「录音自评」模式');
        if (q.type === 'bt') { P.btChoose = true; btReveal(false); const wrap = $('.mic-wrap'); if (wrap) wrap.remove(); toast('点出正确的回答，再大声说出来'); }
        else renderQ();
        return;
      }
      if (!res.alts.length) { noHeard(res); return; }
      if (q.type === 'bt') evalBoss(res.alts); else evalSpeak(res.alts);
    } else {
      startRecording();
    }
  }
  function evalSpeak(alts) {
    const q = P.q;
    const r = bestScore(q.target, alts);
    $('#heard').textContent = '我听到的是：“' + r.heard + '”';
    { const L = dayLog(); L.sayN = (L.sayN || 0) + 1; L.saySum = (L.saySum || 0) + r.score; }   // 周报：开口几次、平均几分
    if (r.score < 90) aiTip(q.target, r.heard, $('#heard'));
    const st = $('#st'), masked = st && st.classList.contains('mask');
    if (st && !masked) $$('.w', st).forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    const cls = r.score >= 85 ? 'good' : r.score >= 60 ? 'mid' : 'low';
    $('#score').innerHTML = '<div class="score ' + cls + '"><b>' + r.score + '</b><span>分</span></div>';
    if (r.score >= 60) passSpeak(r.score, true, r.marks);
    else {
      P.tries++;
      if (P.tries + P.miss >= 3) failSpeak(r.marks);
      else { SFX.bad(); $('#mic-hint').textContent = (masked ? '再试一次！想不起来可以点「💡 提示」' : '红色的词没读准，先点🔊听一遍，再试一次') + '（第 ' + (P.tries + P.miss + 1) + '/3 次）'; }
    }
  }
  // 话筒没拿到话：没听清算一次尝试（第 3 次还没听清就记进错题本）；没网 / 额度 / 没密钥说清原因，AI 用不了时亮出「先跳过」
  function noHeard(res) {
    const hint = $('#mic-hint'); if (!hint || !P) return;
    if (res.fail === 'unheard') {
      P.miss++;
      if (P.tries + P.miss >= 3) {
        if (P.q.type === 'bt') { P.btChoose = true; btReveal(true); hint.textContent = '没听清。直接点出正确的回答，再大声读一遍也行（这题不能暴击了）'; return; }
        failSpeak(); return;
      }
      SFX.bad();
      hint.textContent = failHint(res) + '（第 ' + (P.tries + P.miss + 1) + '/3 次）';
      return;
    }
    hint.textContent = failHint(res);
    if (aiDown()) { const sk = $('#p-skip'); if (sk) sk.hidden = false; }
  }
  function passSpeak(score, measured, marks) {
    const q = P.q;
    P.answered = true;
    if (P.tries > 0) P.aided = true;   // 第 2 次才说对：算带提示
    const perfect = measured && score >= 85 && !P.aided;
    showAnswer(marks);
    const g = good(true, perfect);
    showFb(true, (P.aided ? (P.review ? '过关！这次有提示，明天再考一次' : '过关！这次有提示，经验减半') : perfect ? 'Perfect！每个词都说对了' : score >= 75 ? 'Good！说得不错' : '过关！再多练练会更好') + ' +' + g + ' 经验', detailOf(q));
  }
  function failSpeak(marks) {
    const q = P.q;
    P.answered = true;
    P.combo = 0; showCombo();
    addWrong(q);
    logSpk(false);
    showAnswer(marks);
    showFb(false, '没关系，这句先记下来', '已放进错题本（不扣心）：' + detailOf(q));
    setTimeout(() => say(q.target || q.en), 300);
  }
  // 跳过：自评模式「现在不方便开口」；开口模式只有 AI 用不了时才有——这题放进复习（今天到期、不算答错），联网以后复习里要补说
  function onSkip() {
    if (!P || P.answered) return;
    stopListening();
    P.answered = true;
    P.combo = 0; showCombo();
    const q = P.q, ai = speakMode() === 'sr';
    if (ai) { revLater(q); const L = dayLog(); L.aiSkip = (L.aiSkip || 0) + 1; }
    showAnswer();
    btReveal(false);
    showFb(null, ai ? '先跳过了' : '已跳过', (ai ? '已放进复习，联网后要补说：' : '') + detailOf(q));
  }
  // 💡 提示：一级级给（凭记忆 → 首字母 → 整句并念一遍）。点了就算带提示（不算 Perfect、经验减半、复习里不升格）
  function onHint() {
    if (!P || P.answered) return;
    const q = P.q, st = $('#st'); if (!st) return;
    P.hint++; P.aided = true;
    const b = $('#hintbtn');
    if (P.fade - P.hint === 1) { st.textContent = cueText(q.target, 1); if (b) b.textContent = '💡 再给点提示'; }
    else { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); say(q.target); if (b) b.disabled = true; }
  }

  // 录音自评（识别不可用时）
  async function startRecording() {
    if (!canRecord()) { showSelf(false); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { RT.noRec = true; const w = $('.mic-wrap'); if (w) w.remove(); showSelf(false); return; }
    const q = P && P.q;
    let mr;
    try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(t => t.stop()); RT.noRec = true; showSelf(false); return; }
    const chunks = [];
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      RT.recording = false; RT.mr = null; clearTimeout(RT.recTimer);
      if (MUS()) MUS().hold(false);
      if (!P || P.q !== q) return;
      if (RT.recUrl) URL.revokeObjectURL(RT.recUrl);
      RT.recUrl = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
      setMic(false, '录好了！在下面比一比');
      showSelf(true);
    };
    RT.mr = mr; RT.recording = true;
    if (MUS()) MUS().hold(true);
    mr.start();
    setMic(true, '正在录音……说完点一下停止');
    RT.recTimer = setTimeout(() => { if (RT.recording) stopListening(); }, 9000);
  }
  // quiet：刚出题时直接显示（不滚动）；录完音、选对回答之后才出来的，滚到看得见的地方（横屏时常在屏幕下面）
  function showSelf(hasRec, quiet) {
    const q = P.q, box = $('#self');
    if (!box) return;
    const sp = q.type === 'sp', st = $('#st'), masked = !!st && st.classList.contains('mask');
    const reveal = () => { if (!quiet) setTimeout(() => { if (!box.hidden && box.isConnected) box.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }, 30); };
    // 撤了提示的题（看图说、凭记忆说）：先自己说，说完再看答案
    if (masked && !hasRec && !P.selfReveal && q.type !== 'bt') {
      box.hidden = false;
      box.innerHTML = '<p>' + (sp ? '先看图<b>大声说出英文</b>' : '先<b>凭记忆大声说出来</b>') + '，说完再看答案</p><button class="btn small" data-act="selfReveal">我说完了，看答案</button>';
      reveal();
      return;
    }
    if (masked) { st.classList.remove('mask'); st.innerHTML = wordsHTML(q.target); if (hasRec) say(q.target); }
    box.hidden = false;
    box.innerHTML = '<p>' + (q.type === 'bt' ? '现在对着' + WX[P.wi].boss.name + '大声说：<b>' + esc(q.target) + '</b>' : hasRec ? '听听自己的录音，和原音比一比，像不像？' : '大声读 2 遍，然后诚实地给自己打个分') + '</p>' +
      '<div class="say-row">' + (hasRec ? '<button class="btn small ghost" data-act="playMine">▶ 我的录音</button>' : '') + '<button class="btn small ghost" data-act="sayT">🔊 原音</button></div>' +
      '<div class="rate"><button class="btn coral" data-act="rate" data-v="0">😅 再练练</button><button class="btn sun" data-act="rate" data-v="1">🙂 还行</button><button class="btn leaf" data-act="rate" data-v="2">😎 很像</button></div>';
    reveal();
  }
  function onRate(v) {
    if (!P || P.answered) return;
    if (v === 0) {
      P.tries++;
      if (P.tries >= 3) { failSpeak(); return; }
      toast('再听一遍原音，跟着读 ' + (canRecord() && P.q.type !== 'bt' ? '，然后重新录音' : ''));
      say(P.q.target);
      if (canRecord() && P.q.type !== 'bt' && speakMode() === 'self') { $('#self').hidden = true; setMic(false, '点麦克风重新录音'); }
      return;
    }
    passSpeak(v === 2 ? 90 : 72, false);
  }

  // Boss 对话
  function evalBoss(alts) {
    const q = P.q;
    const scores = q.opts.map(o => bestScore(o.t, alts));
    let bi = 0; scores.forEach((s, k) => { if (s.score > scores[bi].score) bi = k; });
    const best = scores[bi];
    $('#heard').textContent = '我听到的是：“' + best.heard + '”';
    if (q.opts[bi].c && best.score >= 55) {
      markBt(bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      passBoss(best.score);
    } else if (!q.opts[bi].c && best.score >= 65) {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), bi);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, WX[P.wi].boss.name + ' 躲开了！这句回答不对', '正确回答：' + detailOf(q));
      setTimeout(() => say(q.en), 300);
    } else {
      P.tries++;
      const hidden = !!$('#bt-opts') && $('#bt-opts').hidden;
      if (hidden) { btReveal(true); $('#mic-hint').textContent = '没对上。看看这几个回答，把对的那句大声说出来（这题不能暴击了）'; }
      else if (P.tries + P.miss >= 3) { P.btChoose = true; $('#mic-hint').textContent = '识别不太准？直接点出正确回答，再大声读一遍也行'; }
      else $('#mic-hint').textContent = '没对上任何一个选项，再说一次（第 ' + (P.tries + P.miss + 1) + '/3 次）';
    }
  }
  function markBt(ri, wi) {
    btReveal(false);
    $$('#p-body .opt').forEach((b, k) => { b.classList.add(k === ri ? 'right' : k === wi ? 'wrong' : 'dim'); });
  }
  function passBoss(score) {
    P.answered = true;
    if (P.tries > 0) P.aided = true;
    const crit = score >= 85 && !P.aided, g = good(true, crit);
    showFb(true, (crit ? '暴击！' : '命中！') + ' +' + g + ' 经验' + (P.aided ? '（有提示，减半）' : ''), detailOf(P.q));
  }
  function onBtOpt(i) {
    if (!P || P.answered) return;
    const q = P.q;
    if (speakMode() === 'sr' && !P.btChoose) { say(q.opts[i].t); return; }
    if (P.pickedOk) return;
    if (q.opts[i].c) {
      P.pickedOk = true;
      markBt(i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      q.target = q.opts[i].t;
      const w = $('.mic-wrap'); if (w) w.remove();
      if (!$('#self')) $('#p-body').insertAdjacentHTML('beforeend', '<div class="self" id="self" hidden></div>');
      showSelf(false);
      say(q.target);
    } else {
      P.answered = true;
      markBt(q.opts.findIndex(o => o.c), i);
      const hl = $('#hl'); if (hl) hl.classList.remove('blur');
      bad();
      showFb(false, WX[P.wi].boss.name + ' 躲开了！这句回答不对', '正确回答：' + detailOf(q));
      setTimeout(() => say(q.en), 300);
    }
  }

  function onNext() {
    if (!P || !P.answered) return;
    stopListening();
    if (P.hearts <= 0) { failModal(); return; }
    P.idx++;
    if (P.idx >= P.total) finish(); else renderQ();
  }
  function failModal() {
    const can = S.coins >= 30 && !P.revived;
    openModal('<div class="big">💔</div><h2>小船没电了！</h2><p>3 颗心都用完了。错的题已经放进错题本。</p>' +
      '<button class="btn sun wide" data-act="revive" ' + (can ? '' : 'disabled') + '>花 30 金币复活，继续这关' + (P.revived ? '（每关只能复活一次）' : S.coins < 30 ? '（金币不够）' : '') + '</button>' +
      '<div class="row"><button class="btn ghost" data-act="home">回地图</button><button class="btn" data-act="retry">重新挑战</button></div>', { locked: true });
  }

  function finish() {
    hideFb();
    const acc = P.correct / P.total;
    const stars = P.lost === 0 && acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    const key = P.wi + '-' + P.li;
    const prev = P.review ? 0 : (S.stars[key] || 0);
    if (!P.review) S.stars[key] = Math.max(prev, stars);
    let coins = 5 + stars * 5 + (P.boss ? 20 : 0);
    const lucky = Math.random() < 0.15;
    if (lucky) coins *= 2;
    const firstThree = !P.review && stars === 3 && prev < 3;
    if (firstThree) coins += 15;
    const balls = stars === 3 ? 2 : 1;
    S.mon.balls += balls;
    const xp = P.xp + 20 + stars * 10;
    const before = lvInfo(S.xp).lv;
    S.xp += xp; S.coins += coins;
    const after = lvInfo(S.xp).lv;
    S.stats.levels++;
    if (stars === 3) { S.stats.threeStars++; qProg('three', 1); }
    if (P.boss && prev === 0) S.stats.bosses++;
    if (P.lost === 0 && P.correct === P.total) S.stats.flawless++;
    S.stats.maxCombo = Math.max(S.stats.maxCombo, P.maxCombo);
    qProg('combo', P.maxCombo, true);
    qProg('levels', 1);
    if (P.review && P.correct >= Math.ceil(P.total / 2)) dayLog().revSess = (dayLog().revSess || 0) + 1;
    // 多学一点换冒险时间：只数真的有进步的练习关（第一次通关或星星变多），反复刷最简单的一关不算
    if (!P.review && stars > prev) dayLog().pract = (dayLog().pract || 0) + 1;
    const newDay = markToday();
    if (after > before) S.coins += 20;
    save();
    renderTop();

    const w = WX[P.wi], r = RECIPES[P.li];
    const newWorld = P.boss && prev === 0 && P.wi + 1 < W.length;
    let nextBtn = '';
    if (!P.review) {
      if (P.li < 6) nextBtn = '<button class="btn wide" data-act="go" data-w="' + P.wi + '" data-l="' + (P.li + 1) + '" data-focus>下一关 →</button>';
      else if (P.wi + 1 < W.length) nextBtn = '<button class="btn wide" data-act="go" data-w="' + (P.wi + 1) + '" data-l="0" data-focus>出发去 ' + W[P.wi + 1].name + ' →</button>';
      else if (isUnit(P.wi) && P.wi + 1 < WX.length) nextBtn = '<button class="btn wide" data-act="go" data-w="' + (P.wi + 1) + '" data-l="0" data-focus>下一单元：' + esc(WX[P.wi + 1].name) + ' →</button>';
    }
    const gt = P.review && S.settings.gate !== false ? gate() : null;
    if (P.review && gt && gt.open) nextBtn = '<button class="btn sun wide" data-act="goAdventure" data-focus>🗺️ 去冒险</button>';
    // 复习做完了、还差聊天：主按钮直接去和岛民聊天
    else if (P.review && gt && gt.revDone && !gt.chatOk && gt.chatOn && !gt.keyBad) nextBtn = '<button class="btn sun wide" data-act="gateTalk" data-focus>🗣️ 去和岛民聊天</button>';
    const title = P.review ? '复习完成！' : P.boss ? '打败 ' + w.boss.name + '！' : stars === 3 ? '完美通关！' : '通关！';
    // r-hero（大图、标题、星星）和 r-body（奖励、数据、按钮）：竖屏照常一列，横屏左右两栏
    $('#result').innerHTML =
      '<div class="r-hero"><div class="big" style="font-size:64px">' + (P.boss ? w.boss.emoji + '💥' : S.pet) + '</div>' +
      '<h1 class="r-title">' + title + '</h1>' +
      '<p class="r-sub">' + (P.review ? (dueList().length ? '今天还有 ' + dueList().length + ' 题可以复习' : '今天的复习全部完成 ✅') : w.name + ' · ' + r.name) + '</p>' +
      '<div class="r-stars" id="rstars"><span>⭐</span><span>⭐</span><span>⭐</span></div></div><div class="r-body">' +
      (lucky ? '<div class="lucky">🍀 幸运暴击！金币翻倍</div>' : '') +
      (firstThree ? '<div class="lucky">首次三星奖励 +15 金币</div>' : '') +
      (window.MonsterGame ? '<div class="lucky">🔮 回声球 +' + balls + '（去怪兽冒险收服怪兽）</div>' : '') +
      (newWorld ? '<div class="lucky">🏝️ 新岛屿解锁：' + W[P.wi + 1].name + '</div>' : '') +
      (gt ? '<div class="lucky">' + (gt.open ? '🔓 冒险解锁了！今天可以去怪兽冒险了' : gt.revDone ? '✅ 复习完成 · 再和岛民用英语聊一聊（已开口说 ' + Math.min(gt.voice, gt.need) + '/' + gt.need + ' 句）就能去冒险' : '再复习一轮（答对一半以上）才算完成哦') + '</div>' : '') +
      '<div class="r-stats"><div class="stat xp"><b>+' + xp + '</b><small>经验</small></div><div class="stat cn"><b>+' + coins + '</b><small>金币</small></div><div class="stat cb"><b>' + P.maxCombo + '</b><small>最高连击</small></div></div>' +
      (P.recall ? '<div class="lucky">🔥 不看字说对 ' + P.recall + ' 题，记得真牢！</div>' : '') +
      '<p class="r-sub" style="margin:0">答对 ' + P.correct + ' / ' + P.total + (stars < 3 ? ' · ' + (P.lost ? '不丢心、' : '') + '答对 90% 以上可拿三星' : '') + '</p>' +
      (P.aidedN ? '<p class="r-sub" style="margin:0">💡 其中 ' + P.aidedN + ' 题用了提示（经验减半' + (P.review ? '，明天再考一次' : '') + '）</p>' : '') +
      '<div class="r-actions">' + nextBtn + '<div class="row" style="display:flex;gap:10px"><button class="btn ghost" style="flex:1" data-act="home">回地图</button>' +
      (P.review ? '' : '<button class="btn ghost" style="flex:1" data-act="retry">再玩一次</button>') + '</div></div></div>';
    show('result');
    SFX.win();
    confetti(stars === 3 ? 180 : 90);
    $$('#rstars span').forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); SFX.star(i); }, 400 + i * 380); });
    const f = $('#result [data-focus]') || $('#result button');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 100);

    setTimeout(() => {
      if (newDay) toast('🔥 今日打卡成功！已连续 ' + S.streak + ' 天', 'gold');
      checkAch();
      if (after > before) {
        confetti(200);
        openModal('<div class="big">🎖️</div><h2>升级啦！Lv ' + after + '</h2><p>新称号：<b>' + titleOf(after) + '</b>。奖励 20 金币，去宠物店看看吧！</p><button class="btn sun wide" data-act="close" data-focus>太好了</button>');
      } else if (Date.now() - RT.lastRest > 30 * 60e3) restModal();
    }, 1700);
  }
  function restModal() {
    RT.lastRest = Date.now();
    openModal('<div class="big">👀</div><h2>护眼时间</h2><p>已经连续练了 30 分钟，真厉害！看看窗外远处 20 秒，喝口水，让眼睛和嗓子歇一歇。</p><button class="btn wide" id="restbtn" data-act="close" disabled>休息中 20</button>', { locked: true });
    let n = 20;
    const t = setInterval(() => {
      n--;
      const b = $('#restbtn');
      if (!b) { clearInterval(t); return; }
      if (n <= 0) { clearInterval(t); b.disabled = false; b.textContent = '休息好了，继续'; }
      else b.textContent = '休息中 ' + n;
    }, 1000);
  }


  // ---------- 对话动画剧场：看动画 / 跟读 / 角色扮演 ----------
  let T = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MODE_TIP = {
    watch: '先完整看一遍。关掉英文字幕，就能练纯听力。点下面的对话记录可以单独再听一句。',
    shadow: '每句播完会停下来，你跟着说一遍，说对了自动继续。',
    role: '选一个角色，轮到你时大声说出台词，另一个角色由电脑来演。',
  };
  function gainXp(n) {
    if (!n) return;
    const b = lvInfo(S.xp).lv;
    S.xp += n;
    const a = lvInfo(S.xp).lv;
    if (a > b) { S.coins += 20; toast('🎖️ 升级啦！Lv ' + a + ' ' + titleOf(a) + ' +20 金币', 'gold'); confetti(160); }
  }
  function openScene(wi) {
    const sc = window.SCENES && window.SCENES[wi];
    if (!sc) return;
    primeTTS(); ac();
    T = { wi, sc, idx: -1, mode: 'watch', me: 1, run: 0, playing: false, slow: false, zh: true, en: true, spoke: 0, turn: null, done: false, tries: 0 };
    show('theater');
    renderTheater();
  }
  function stopScene() {
    if (!T) return;
    T.run++;
    T.playing = false;
    if (T.turn) { const r = T.turn; T.turn = null; r(false); }
    stopListening();
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
  }
  const playLabel = () => T.playing ? '⏸ 暂停' : (T.idx >= 0 && !T.done ? '▶ 继续' : T.done ? '🔁 再来一遍' : '▶ 开始播放');
  function updPlay() { const b = $('#th-play'); if (b) b.textContent = playLabel(); }
  function renderTheater() {
    const sc = T.sc, w = W[T.wi], toon = !!window.Cartoon;
    const modes = [['watch', '👀 看动画'], ['shadow', '🔁 跟读'], ['role', '🎭 角色扮演']];
    $('#theater').innerHTML =
      '<div class="p-top"><button class="x" data-act="thClose" aria-label="退出">✕</button><div class="th-title"><b>🎬 ' + esc(sc.title) + '</b><small>' + w.name + ' · ' + esc(sc.place) + '</small></div></div>' +
      '<div class="stage' + (toon ? ' cartoon' : '') + ' live" id="stage" style="--wc:' + w.color + '">' +
      (toon && Cartoon.set(sc.set) ? '<div class="stage-set">' + Cartoon.set(sc.set) + '</div>' : '<span class="stage-bg">' + sc.bg + '</span>') +
      sc.cast.map((c, k) => '<div class="actor a' + k + '" id="actor' + k + '">' +
        (toon && Cartoon.has(c[0]) ? Cartoon.actor(c[0]) : '<span class="ae"><span class="af">' + c[1] + '</span></span>') +
        '<span class="an">' + esc(c[0]) + (T.mode === 'role' && T.me === k ? ' · 你' : '') + '</span></div>').join('') +
      '<div class="stage-sub" id="th-sub"></div>' +
      '<div class="clap" id="th-clap" hidden><small>第 ' + (T.wi + 1) + ' 集</small><b>' + esc(sc.title) + '</b><span>' + esc(sc.place) + '</span></div></div>' +
      '<div class="th-side"><div class="seg th-modes">' + modes.map(([m, n]) => '<button class="' + (T.mode === m ? 'on' : '') + '" data-act="thMode" data-m="' + m + '">' + n + '</button>').join('') + '</div>' +
      (T.mode === 'role' ? '<div class="seg th-modes"><span class="th-lab">我来演</span>' + sc.cast.map((c, k) => '<button class="' + (T.me === k ? 'on' : '') + '" data-act="thMe" data-i="' + k + '">' + c[1] + ' ' + esc(c[0]) + '</button>').join('') + '</div>' : '') +
      '<div class="th-ctrl"><button class="btn" id="th-play" data-act="thPlay">' + playLabel() + '</button>' +
      '<button class="slow' + (T.slow ? ' on' : '') + '" data-act="thSlow" aria-pressed="' + T.slow + '"><span>🐢</span>慢速</button>' +
      '<button class="slow' + (T.en ? ' on' : '') + '" data-act="thEn" aria-pressed="' + T.en + '"><span>En</span>英文</button>' +
      '<button class="slow' + (T.zh ? ' on' : '') + '" data-act="thZh" aria-pressed="' + T.zh + '"><span>中</span>中文</button></div>' +
      '<p class="th-tip">' + MODE_TIP[T.mode] + '</p>' +
      '<div id="th-turn"></div><div class="th-log" id="th-log"></div></div>';   // th-side：横屏时放在动画右边，自己上下滚
    renderStage(); renderLog();
    window.scrollTo(0, 0);
  }
  function renderStage() {
    const L = T.sc.lines[T.idx];
    T.sc.cast.forEach((c, k) => {
      const a = $('#actor' + k); if (!a) return;
      a.classList.toggle('talk', !!L && L[0] === k && T.playing);
      a.classList.toggle('dim', !!L && L[0] !== k);
    });
    const sub = $('#th-sub'); if (!sub) return;
    if (!L) { sub.className = 'stage-sub'; sub.innerHTML = T.done ? '<span class="ss-en">The End</span><span class="ss-zh">🎉 演完啦！</span>' : '<span class="ss-zh">点「开始播放」，看看他们怎么说</span>'; return; }
    sub.className = 'stage-sub ' + (L[0] === 0 ? 'l' : 'r');
    sub.innerHTML = '<span class="ss-who">' + esc(T.sc.cast[L[0]][0]) + '</span>' +
      (T.en ? '<span class="ss-en">' + esc(L[1]) + '</span>' : '<span class="ss-en muted">🎧 只用耳朵听……</span>') +
      (T.zh ? '<span class="ss-zh">' + esc(L[2]) + '</span>' : '');
  }
  function renderLog() {
    const log = $('#th-log'); if (!log) return;
    const n = T.done ? T.sc.lines.length : Math.max(0, T.idx);
    log.innerHTML = (n ? '<div class="th-lab">对话记录（点一句再听一遍）</div>' : '') + T.sc.lines.slice(0, n).map((L, i) => {
      const c = T.sc.cast[L[0]];
      return '<button class="lg lg' + L[0] + '" data-act="thLine" data-i="' + i + '"><span class="lg-e">' + c[1] + '</span><span class="lg-b"><b>' + esc(L[1]) + '</b><small>' + esc(L[2]) + '</small></span></button>';
    }).join('');
  }
  // 关掉或切换模式后，还在等待的旧播放流程要安静退出
  const alive = (t, my) => T === t && t.run === my;
  async function intro(my) {
    const t = T;
    const stage = $('#stage'), clap = $('#th-clap');
    if (!stage || reduced) return;
    stage.classList.remove('live', 'bye');
    $('#th-sub').className = 'stage-sub gone';
    clap.hidden = false;
    SFX.tap();
    await sleep(1500);
    if (!alive(t, my)) return;
    clap.hidden = true;
    void stage.offsetWidth;
    stage.classList.add('live');
    await sleep(900);
  }
  async function playFrom(i) {
    const t = T, my = ++T.run;
    T.playing = true; T.done = false;
    updPlay();
    const lines = T.sc.lines;
    if (i === 0) { await intro(my); if (!alive(t, my)) return; }
    for (T.idx = i; T.idx < lines.length; T.idx++) {
      const [who, en] = lines[T.idx];
      renderStage(); renderLog();
      if (T.mode === 'role' && who === T.me) { await kidTurn(); if (!alive(t, my)) return; continue; }
      await say(en, T.slow ? 0.65 : S.settings.rate, T.sc.cast[who][2]);
      if (!alive(t, my)) return;
      if (T.mode === 'shadow') { await kidTurn(); if (!alive(t, my)) return; }
      else { await sleep(500); if (!alive(t, my)) return; }
    }
    T.playing = false; T.done = true; T.idx = lines.length;
    renderStage(); renderLog(); updPlay();
    const stage = $('#stage'); if (stage) stage.classList.add('bye');
    sceneDone();
  }
  function kidTurn() {
    return new Promise(res => {
      T.turn = res; T.tries = 0;
      const L = T.sc.lines[T.idx], sr = speakMode() === 'sr';
      const a = $('#actor' + L[0]); if (a) a.classList.add('talk');
      $('#th-turn').innerHTML = '<div class="say-card th-you"><div class="say-zh">' + (T.mode === 'role' ? '轮到你了，大声说：' : '跟着说一遍：') + '</div>' +
        '<div class="say-text" id="th-say">' + wordsHTML(L[1]) + '</div>' + (T.zh ? '<div class="say-zh">' + esc(L[2]) + '</div>' : '') +
        (sr ? '<button class="mic" id="th-mic" data-act="thMic" aria-label="开始说话">' + MIC + '</button>' : '') +
        '<div class="mic-hint" id="th-hint">' + (sr ? '点麦克风，然后大声说' : '大声说出来，说完点「我说完了」') + '</div><div class="heard" id="th-heard"></div>' +
        '<div class="say-row"><button class="btn small ghost" data-act="thHear">🔊 听示范</button><button class="btn small ' + (sr ? 'ghost' : 'leaf') + '" id="th-done" data-act="thDone">' + (sr ? '跳过这句' : '🎤 我说完了') + '</button></div></div>';
      $('#th-turn').scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  function endTurn(ok) {
    const r = T && T.turn; if (!r) return;
    T.turn = null;
    stopListening();
    $('#th-turn').innerHTML = '';
    if (ok) { T.spoke++; S.stats.spoken++; qProg('spoken', 1); }
    r(ok);
  }
  async function thMic() {
    if (!T || !T.turn) return;
    if (RT.listening) { stopListening(); return; }
    if (TTS.ok) speechSynthesis.cancel();
    if (RT.audio) RT.audio.pause();
    const turn = T.turn, L = T.sc.lines[T.idx], m = $('#th-mic');
    m.classList.add('on'); m.innerHTML = STOP;
    $('#th-hint').textContent = '正在听……说完会自动停止';
    const res = await recognize(t => { const h = $('#th-heard'); if (h) h.textContent = t; }, [L[1]]);
    if (!T || T.turn !== turn) return;
    m.classList.remove('on'); m.innerHTML = MIC;
    if (res.err && FATAL.includes(res.err)) {
      RT.srBroken = true;
      if (res.err === 'not-allowed' || res.err === 'audio-capture') RT.noRec = true;
      toast('这里用不了语音识别，改成自己说、自己确认');
      m.remove();
      $('#th-hint').textContent = '大声说出来，说完点「我说完了」';
      const d = $('#th-done'); d.textContent = '🎤 我说完了'; d.className = 'btn small leaf';
      return;
    }
    if (!res.alts.length) {
      // 对话剧场本来就有「跳过这句」：AI 用不了时只是把原因说清楚
      const h = failHint(res);
      if (res.fail === 'unheard') { T.tries++; $('#th-hint').textContent = h + (T.tries >= 2 ? '，或者点「跳过这句」' : ''); }
      else if (h) $('#th-hint').textContent = h + (aiDown() ? '（可以先点「跳过这句」）' : '');
      return;
    }
    const r = bestScore(L[1], res.alts);
    $('#th-heard').textContent = '我听到：“' + r.heard + '”';
    $$('#th-say .w').forEach((w, k) => { w.classList.toggle('ok', !!r.marks[k]); w.classList.toggle('miss', !r.marks[k]); });
    if (r.score >= 55) {
      SFX.ok(T.spoke);
      if (r.score >= 85) { S.stats.perfect++; qProg('perfect', 1); }
      $('#th-hint').innerHTML = '<b>' + r.score + ' 分</b> ' + (r.score >= 85 ? 'Perfect！' : 'Good！');
      setTimeout(() => { if (T && T.turn === turn) endTurn(true); }, 900);
    } else {
      T.tries++;
      SFX.bad();
      $('#th-hint').textContent = r.score + ' 分，红色的词再读准一点' + (T.tries >= 2 ? '，或者点「跳过这句」' : '');
    }
  }
  function sceneDone() {
    const rec = S.scenes[T.wi] || (S.scenes[T.wi] = {});
    const msg = [];
    let coins = 0, xp = 0;
    if (T.mode === 'watch' && !rec.watched) { rec.watched = 1; coins += 10; msg.push('第一次看完 +10 金币'); }
    if (T.mode === 'shadow') { rec.shadow = 1; xp += 20; msg.push('跟读完成 +20 经验'); }
    if (T.mode === 'role') { rec.role = 1; xp += 30; coins += 10; S.stats.roleplay++; qProg('roleplay', 1); msg.push('角色扮演完成 +30 经验 +10 金币'); }
    S.coins += coins;
    gainXp(xp);
    save(); checkAch();
    SFX.win(); confetti(90);
    const other = T.me === 0 ? 1 : 0;
    const nextBtn = T.mode === 'watch' ? '<button class="btn" data-act="thMode" data-m="shadow" data-go="1">🔁 接着跟读</button>'
      : T.mode === 'shadow' ? '<button class="btn" data-act="thMode" data-m="role" data-go="1">🎭 试试角色扮演</button>'
        : '<button class="btn" data-act="thMe" data-i="' + other + '" data-go="1">换演 ' + esc(T.sc.cast[other][0]) + '</button>';
    $('#th-turn').innerHTML = '<div class="th-end"><div class="big">🎉</div><b>' + (T.mode === 'role' ? '演得真棒！' : T.mode === 'shadow' ? '跟读完成！' : '看完啦！') + '</b>' +
      '<p>' + (msg.join(' · ') || '多看几遍，对话就能脱口而出') + '</p><div class="say-row">' + nextBtn + '<button class="btn ghost" data-act="thClose">回地图</button></div></div>';
    renderTop();
  }

  // ---------- 宝箱 / 商店 / 成就 / 设置 ----------
  function openChest() {
    if (S.quests.chest || !S.quests.list.every(q => q.claimed)) return;
    S.quests.chest = true;
    const r = Math.random();
    let prize, html;
    const unownedChest = CHEST_PETS.filter(p => !S.pets.includes(p[0]));
    // 先开冒险用的奖品（进化曲 / 怪兽蛋 / 稀有色蛋，world.js 的 chestPrize，评估第 10 条）；没开出来（约一成、或者还没有怪兽）再开原来的宠物 / 金币
    let wp = null;
    try { wp = window.EchoWorld && EchoWorld.chestPrize ? EchoWorld.chestPrize() : null; } catch (e) { console.error(e); wp = null; }
    if (wp) { prize = wp.prize; html = wp.html; }
    else if (r < 0.2 && unownedChest.length) {
      const p = pick(unownedChest); S.pets.push(p[0]); prize = p[0];
      html = '<h2>开出限定宠物：' + p[1] + '！</h2><p>宝箱限定，商店买不到哦。</p>';
    } else if (r < 0.32 && S.freeze < 2) {
      S.freeze++; prize = '🧊';
      html = '<h2>开出连胜保护卡！</h2><p>哪天忘了打卡，它会自动帮你保住连续天数。</p>';
    } else {
      const c = pick([30, 40, 50, 60, 80, 100, 150]); S.coins += c; prize = '💰';
      html = '<h2>开出 ' + c + ' 金币！</h2><p>明天再来，任务会刷新。</p>';
    }
    save();
    openModal('<div class="big" id="chestbig" style="animation:wiggle .5s 3">🎁</div><div id="chestres" hidden><div class="big">' + prize + '</div>' + html + '</div><button class="btn sun wide" data-act="close" id="chestok" hidden>收下</button>', { locked: true });
    SFX.tap();
    setTimeout(() => { $('#chestbig').hidden = true; $('#chestres').hidden = false; $('#chestok').hidden = false; SFX.win(); confetti(120); renderHome(); checkAch(); }, 1500);
  }
  function shopSheet() {
    const pets = PETS.map(([e, price, name]) => {
      const own = S.pets.includes(e), sel = S.pet === e;
      return '<button class="pet ' + (sel ? 'sel' : '') + (own || S.coins >= price ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + e + '</span>' + name +
        '<small>' + (sel ? '跟着你' : own ? '点击带上' : '<span class="coin"></span>' + price) + '</small></button>';
    }).join('');
    const chest = CHEST_PETS.map(([e, name]) => {
      const own = S.pets.includes(e);
      return '<button class="pet ' + (S.pet === e ? 'sel' : '') + (own ? '' : ' no') + '" data-act="pet" data-p="' + e + '"><span class="pe">' + (own ? e : '❓') + '</span>' + (own ? name : '宝箱限定') + '<small>' + (own ? (S.pet === e ? '跟着你' : '点击带上') : '每日宝箱开出') + '</small></button>';
    }).join('');
    openModal('<h2>宠物店</h2><p>你有 <b>' + S.coins + '</b> 金币。宠物会在地图上陪你闯关。</p><div class="grid3">' + pets + chest + '</div>' +
      '<div class="ach"><span class="ae">🧊</span><div style="flex:1"><b>连胜保护卡（有 ' + S.freeze + ' 张，最多 2 张）</b><small>忘记打卡一天时自动使用，保住连续天数</small></div><button class="btn small sun" data-act="buyFreeze" ' + (S.freeze >= 2 || S.coins < 100 ? 'disabled' : '') + '>100 金币</button></div>' +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function onPet(e) {
    if (S.pets.includes(e)) { S.pet = e; SFX.tap(); }
    else {
      const p = PETS.find(x => x[0] === e);
      if (!p) { toast('这只宠物只能从每日宝箱开出'); return; }
      if (S.coins < p[1]) { toast('金币还差 ' + (p[1] - S.coins) + '，去闯关赚金币吧'); return; }
      S.coins -= p[1]; S.pets.push(e); S.pet = e; SFX.coin(); toast('买到了 ' + p[2] + '！', 'gold');
    }
    save(); renderTop(); shopSheet(); checkAch();
  }
  function achSheet() {
    const n = Object.keys(S.ach).length;
    const L = lvInfo(S.xp);
    const totalStars = Object.values(S.stars).reduce((a, b) => a + b, 0);
    openModal('<h2>成就 ' + n + ' / ' + ACH.length + '</h2>' +
      '<p>Lv ' + L.lv + ' ' + titleOf(L.lv) + ' · 共 ' + totalStars + ' 颗星 · 开口说对 ' + S.stats.spoken + ' 次 · 完成 ' + S.stats.levels + ' 关</p>' +
      ACH.map(([id, e, name, desc]) => '<div class="ach ' + (S.ach[id] ? '' : 'no') + '"><span class="ae">' + e + '</span><div><b>' + name + '</b><small>' + desc + '</small></div></div>').join('') +
      '<button class="btn ghost wide" data-act="close">关闭</button>');
  }
  function envHTML(inSet) {   // inSet：在设置页里（上面已经有「请家长粘贴 AI 密钥」的提示）
    if (window.ECHO_APP) {   // 安卓 APK：不用讲浏览器的事
      return '<div class="env">✅ 朗读：自然配音（装在手机里，不用联网）<br>' +
        (cloudSR() ? '✅ 口语自动打分：说完一句交给阿里云识别（要联网）' : '⚠️ 口语自动打分：还没有 AI 密钥' + (inSet ? '（见上面）' : '，请家长在「设置 → 🔒 家长设置」里粘贴')) + '</div>';
    }
    const st = S.settings.tts || 'auto';
    const tts = st === 'device' ? (TTS.voices.length ? '✅ 朗读：本机声音 ' + esc(TTS.v ? TTS.v.name : '') : '⚠️ 朗读：这个浏览器没有英语声音，在「设置」里换成「自然配音」')
      : '✅ 朗读：自然配音（没有配音的句子联网时用阿里云现场合成' + (st === 'auto' && TTS.voices.length ? '，没网时用本机声音' : '') + '）';
    const wx = /MicroMessenger/i.test(navigator.userAgent) ? '<br>📱 你正在微信里打开：点右上角「···」→「在浏览器打开」，录音和语音识别会更稳定。' : '';
    const sr = SRC && !RT.srBroken ? '✅ 支持语音识别，开口会自动打分' : '⚠️ 语音识别不可用，口语题用「录音 + 自评」';
    return '<div class="env">' + tts + '<br>' + sr + '<br>在中国大陆，电脑上推荐用 <b>Edge 浏览器</b>，手机推荐 <b>iPhone 自带 Safari</b>；Chrome 的语音识别要连 Google 服务器，通常用不了。' + wx + '</div>';
  }
  // 设置分两块：「🙂 我的设置」孩子自己随便改；「🔒 家长设置」收起来，里面改什么都要家长密码（家长 2026-10-07，评估第 4 条）
  function settingsSheet() {
    const st = S.settings;
    const voices = TTS.voices.map(v => '<option value="' + esc(v.name) + '"' + (TTS.v && TTS.v.name === v.name ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
    // APK 里还没有 AI 密钥：设置页最上面就说清楚（口语没法自动打分，走「先跳过」）
    const noKey = aiNoKey() ? '<div class="set-warn"><b>🔑 请家长在这里粘贴 AI 密钥</b><small>还没有 AI 密钥：口语题没法自动打分（可以先跳过，联网有密钥以后再补说），也不能和岛民聊天。</small><button class="btn small" data-act="talk_cfg">粘贴密钥</button></div>' : '';
    openModal('<h2>设置</h2>' + noKey + envHTML(true) +
      '<h3 class="set-h">🙂 我的设置</h3>' +
      (speakMode() === 'sr' ? '<div class="set"><label>🩺 麦克风和网络</label><div class="say-row"><button class="btn small ghost" data-act="micCheck">检查一下（说一句 Hello）</button></div></div>' : '') +
      '<div class="set"><label for="set-rate">朗读速度 <span id="rate-v">' + st.rate.toFixed(2) + '</span></label><input type="range" id="set-rate" min="0.6" max="1.1" step="0.05" value="' + st.rate + '"><div class="say-row"><button class="btn small ghost" data-act="testVoice">🔊 试听</button></div></div>' +
      '<div class="set"><label>发音来源</label><div class="seg">' +
      [['auto', '自然配音'], ['device', '本机声音'], ['online', '只用配音']].map(([m, n]) => '<button class="' + ((st.tts || 'auto') === m ? 'on' : '') + '" data-act="setTts" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>「自然配音」：固定的句子用提前合成的真人感配音，拼了名字的句子联网时用阿里云现场合成，没网时用本机声音。「只用配音」不用本机声音。选「本机声音」就全部用浏览器自带的朗读。</small></div>' +
      (voices ? '<div class="set"><label for="set-voice">朗读声音</label><select id="set-voice">' + voices + '</select></div>' : '') +
      (window.ECHO_APP ? '<div class="set"><label>口语打分</label><small>🎤 一律开口说，AI 听写打分（阿里云语音识别），说得不准会给一句中文建议。要联网。</small></div>' :
      '<div class="set"><label>口语打分方式</label><div class="seg">' +
      [['auto', 'AI 打分（推荐）'], ['self', '录音自评']].map(([m, n]) => '<button class="' + (st.mode === m ? 'on' : '') + '" data-act="setMode" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>AI 打分：连得上对话服务就用阿里云语音识别打分，否则用浏览器自带的识别。</small></div>') +
      '<div class="set"><label>冒险画面</label><div class="seg wrap">' +
      [['auto', '自动'], ['high', '精美'], ['mid', '标准'], ['low', '省电'], ['2d', '2D 流畅']].map(([m, n]) => '<button class="' + ((st.gfx || 'auto') === m ? 'on' : '') + '" data-act="setGfx" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>' + ((st.gfx || 'auto') === 'auto' ? '自动：好手机先用精美画质，其他先用标准，跑不动会自动降一档' + (st.gfxAuto ? '（现在是「' + ({ high: '精美', mid: '标准', low: '省电', '2d': '2D 流畅' })[st.gfxAuto] + '」）' : '') + '。' : '手机发烫或者卡顿，就选省电或 2D 流畅。') + '</small></div>' +
      '<div class="set"><label>冒险里的操作</label><div class="seg">' +
        [['joy', '🕹️ 摇杆'], ['pad', '✚ 方向键']].map(([m, n]) => '<button class="' + ((st.ctl || 'joy') === m ? 'on' : '') + '" data-act="setCtl" data-m="' + m + '">' + n + '</button>').join('') +
        '</div><small>' + (st.ctl === 'pad' ? '方向键：左下角十字键走路；A / B 在右下角。' : '摇杆：左手按住屏幕左边任意地方推着走；A / B 在右下角。') + '</small></div>' +
      (window.EchoNative && EchoNative.setOrientation ? '<div class="set"><label>屏幕方向</label><div class="seg">' +
        [['portrait', '📱 竖屏'], ['landscape', '🎮 横屏'], ['auto', '🔄 跟着手机转']].map(([m, n]) => '<button class="' + ((st.orient || 'portrait') === m ? 'on' : '') + '" data-act="setOrient" data-m="' + m + '">' + n + '</button>').join('') +
        '</div><small>横屏玩冒险和对战更像掌机；做题、聊天竖着横着都能用。</small></div>' : '') +
      '<div class="set"><label>音效</label><div class="seg"><button class="' + (st.sfx ? 'on' : '') + '" data-act="sfx" data-v="1">开</button><button class="' + (st.sfx ? '' : 'on') + '" data-act="sfx" data-v="0">关</button></div></div>' +
      '<div class="set"><label>音乐</label><div class="seg">' + [['off', '关'], ['low', '小'], ['mid', '中'], ['high', '大']].map(([v, t]) => '<button class="' + ((st.music || 'mid') === v ? 'on' : '') + '" data-act="setMusic" data-v="' + v + '">' + t + '</button>').join('') + '</div></div>' +
      parentHTML() +
      '<p class="set-ver">' + esc(verText()) + ' · <button class="link" data-act="suDoc" data-doc="licenses">开源许可与致谢</button></p>' +
      '<button class="btn ghost wide" data-act="close">完成</button>');
  }
  // 「🔒 家长设置」：默认收起来；看可以随便看，改要家长密码（parentOk）
  function parentHTML() {
    const st = S.settings, c = limitCfg(), ps = pinState(), nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    const cloud = !!(window.EchoTalk && EchoTalk.cloudSR && EchoTalk.cloudSR()), pk = pushKind(st.push);
    const b = [];
    b.push('<div class="set"><label>先学习再冒险</label><div class="seg">' +
      [[true, '🔒 开（推荐）'], [false, '关']].map(([m, n]) => '<button class="' + ((st.gate !== false) === m ? 'on' : '') + '" data-act="setGate" data-m="' + (m ? 1 : 0) + '">' + n + '</button>').join('') +
      '</div><small>开着时，每天先做完每日复习、用英语和岛民聊一聊（用语音说满 6 句，或者完成一个小目标），才能去怪兽冒险。关掉要家长密码，关过的天周报上会标出来；关着时冒险也不限时。</small></div>');
    b.push('<div class="set"><label>⏱️ 冒险时间</label><div class="say-row"><span class="set-v">' + esc(limText(c)) + '</span><button class="btn small ghost" data-act="limEdit">改</button></div>' +
      '<small>只算大地图和对战的时间。时间到了不会半路掐断，等这一场战斗或这段对话结束再回首页。多做一轮复习、多完成一个聊天目标、多通关一关新练习（或拿到更多星星），每样 +10 分钟。</small></div>');
    if (BK.length) b.push('<div class="set"><label>冒险里的英语题</label><div class="seg">' +
      [[.6, '多出课本'], [.3, '少量课本'], [0, '只用岛上话题']].map(([m, n]) => '<button class="' + (S.book.mix === m ? 'on' : '') + '" data-act="setBookMix" data-m="' + m + '">' + n + '</button>').join('') +
      '</div><small>打怪兽、答村民的题时，有一部分换成课本正在学的单元（' + esc(curUnit().name) + '，在闯关页「📗 课本单元」里改）。</small></div>');
    if (window.EchoWorld && EchoWorld.storyZhHTML) b.push(EchoWorld.storyZhHTML());
    if (window.EchoNative) b.push('<div class="set"><label>🗣️ AI 聊天和口语打分</label><div class="say-row"><span class="set-v">' + (cloud ? '✅ 已连上阿里云' : '⚠️ 还没有 AI 密钥') + '</span><button class="btn small ghost" data-act="talk_cfg">' + (cloud ? '换密钥' : '粘贴密钥') + '</button></div>' +
      '<small>' + (cloud ? '用阿里云百炼的 API Key，只存在这台手机里，装新版也不用重填。' : '请家长在这里粘贴 AI 密钥（阿里云百炼的 API Key），只存在这台手机里。设好以后能和岛民用英语聊天，口语题也会自动打分。') + '</small></div>');
    b.push('<div class="set"><label>闯关练习：全部关卡直接开放</label><div class="seg"><button class="' + (st.unlockAll ? '' : 'on') + '" data-act="unlock" data-v="0">按顺序解锁</button><button class="' + (st.unlockAll ? 'on' : '') + '" data-act="unlock" data-v="1">全部直接开放</button></div>' +
      '<small>只对「📚 闯关练习」有效（想跟着课本直接练某个单元时打开）；冒险里的徽章、守卫、回声技能不受影响。</small></div>');
    b.push('<div class="set"><label>📲 学习日报发到微信</label><div class="say-row"><span class="set-v">' + (pk ? '✅ 每天 20 点以后发（' + (pk === 'wecom' ? '企业微信群机器人' : 'PushPlus') + '）' : '没开（默认不发）') + '</span><button class="btn small ghost" data-act="pushEdit">设置</button></div></div>');
    if (window.EchoTalk) b.push('<div class="set"><label>👪 聊天安全</label><div class="say-row"><button class="btn small ghost" data-act="talk_concerns">看需要注意的聊天' + (nc ? '（' + nc + ' 段）' : '') + '</button><button class="btn small ghost" data-act="talk_privacy">ℹ️ 家长须知</button></div>' +
      '<small>孩子在聊天里说到难过、被欺负、有危险时，那段聊天会标出来，输家长密码能看全文。</small></div>');
    b.push('<div class="set"><label>🔑 家长密码</label>' + (ps.native && ps.sales
      ? '<div class="say-row"><span class="set-v">' + (ps.has ? '已经设好了' : '还没设') + '</span><button class="btn small ghost" data-act="pinChange">' + (ps.has ? '改密码' : '设密码') + '</button></div>' +
        '<small>首次设置时家长设的 4 位密码（手机里只存加了随机盐的哈希），输错 5 次锁 10 分钟。忘了密码：先「💾 导出存档」（不用密码）→ 在手机设置里清除这个 App 的数据 → 重新走一遍家长设置、设新密码 → 「从备份恢复」，进度就回来了（手机「下载/EchoIsland」里每天也有自动备份）。</small>'
      : ps.native
      ? '<small>' + (ps.has ? '打包时设好的 4 位密码，输错 5 次锁 10 分钟。要换密码：改 echo.properties 的 PARENT_PIN，重新打包安装（存档不会丢）。' : '⚠️ 这个安装包没有设家长密码，上面这些都改不了。请家长在 echo.properties 里写 PARENT_PIN（4 位数字），重新打包安装。') + '</small>'
      : '<div class="say-row"><span class="set-v">' + (ps.has ? '已经设好了' : '还没设（第一次要用时由家长来设）') + '</span>' + (ps.has ? '<button class="btn small ghost" data-act="pinChange">改密码</button>' : '') + '</div><small>输错 5 次锁 10 分钟。</small>') + '</div>');
    // 销售版：家庭定制（昵称、形象、伙伴、家人）、设备检查、儿童隐私说明（家长首次设置向导 setup.js 里做过的，这里能改）
    if (window.EchoSetup && EchoSetup.sales()) {
      const fm = EchoSetup.members(), F = st.family || {};
      b.push('<div class="set"><label>👪 家庭定制</label><div class="say-row"><span class="set-v">' + esc((S.player && S.player.name) || F.nick || '（没起名）') + (fm.length ? ' · ' + esc(fm.map(m => m.call).join('、')) : '') + '</span><button class="btn small ghost" data-act="suFamily">改</button></div>' +
        '<small>孩子的英文昵称和形象、博士包里的 3 只伙伴（开始新冒险时生效）、家里的人。只存在这台手机里。</small></div>');
      b.push('<div class="set"><label>🩺 设备检查</label><div class="say-row"><span class="set-v">' + (F.device ? (F.device.ok === 'ok' ? '✅ 合格' : F.device.ok === 'warn' ? '⚠️ 能玩' : '❌ 不合格') : '没做过') + '</span><button class="btn small ghost" data-act="suDevice">再检查一次</button></div></div>');
      b.push('<div class="set"><label>📄 隐私和同意</label><div class="say-row"><button class="btn small ghost" data-act="suDoc" data-doc="privacy">儿童隐私说明</button><button class="btn small ghost" data-act="suDoc" data-doc="consent">监护人同意书</button></div>' +
        (F.consent && F.consent.at ? '<small>监护人 ' + esc(new Date(F.consent.at).toLocaleDateString('zh-CN')) + ' 同意过（' + esc(F.consent.v || '') + ' 版）。要撤回同意：在上面「AI 聊天和口语打分」里删掉密钥（就不再连 AI），或者卸载 App。</small>' : '') + '</div>');
    }
    // 存档备份（评估第 7 条）：导出（分享到微信 / 下载成文件）不用密码；从备份恢复要家长密码
    const meta = bakMeta(), nb = BAK.filter(k => parseSave(lsGet(k))).length;
    b.push('<div class="set"><label>💾 存档备份</label><div class="say-row"><button class="btn small ghost" data-act="bakExport">📤 导出存档</button><button class="btn small ghost" data-act="bakRestore">🗂️ 从备份恢复</button></div>' +
      '<small>每天第一次打开时自动备份：这台设备上留 3 份' + (nb ? '（最近一份是 ' + esc(meta.d1 || '以前') + ' 的）' : '') +
      (nat('backupWrite') ? '，手机「下载/EchoIsland」文件夹里留 7 份（卸载 App 也不会删）' : '') + '。「导出存档」可以发到微信里存着，换手机、重装以后用「从备份恢复」。</small></div>');
    b.push('<div class="set"><label>🆕 检查新版本</label><div class="say-row"><span class="set-v">' + esc(verText()) + '</span><button class="btn small ghost" data-act="verEdit">改地址</button></div>' +
      '<small>' + (myVer() ? (S.settings.verUrl || VER_URL0 ? '打开 App 时去看一眼有没有新版本（' + esc(S.settings.verUrl || '默认地址') + '），有就在首页提示「请家长更新」。' : '没有填地址：不检查新版本（新版本由帮您安装的人发给您）。') : '网页版总是最新的，不用检查。') + '</small></div>');
    const ne = window.EchoErr ? EchoErr.count(7) : 0;
    b.push('<div class="set"><label>🔧 出错记录</label><div class="say-row"><span class="set-v">最近 7 天 ' + ne + ' 条</span><button class="btn small ghost" data-act="errLog">看看</button></div><small>游戏出错时自动记下最近 50 条，只存在这台设备里。手机上有问题时，可以把它发给帮你装游戏的人。</small></div>');
    b.push('<div class="set"><label>清空进度</label><button class="btn small coral" data-act="reset" id="resetbtn">清空全部进度</button><small>星星、金币、怪兽、复习记录都会清零，无法恢复。要家长密码，还要输入「清空」两个字。</small></div>');
    return '<details class="parent" id="set-parent"' + (RT.parentOpen ? ' open' : '') + '><summary>🔒 家长设置</summary><div class="parent-in">' + b.join('') + '</div></details>';
  }
  // 版本号（APK 里原生给：日期 + 短哈希，见 android/README.md）
  function verText() {
    try { if (window.EchoNative && EchoNative.version) { const v = JSON.parse(EchoNative.version() || '{}'); if (v && v.name) return '回声岛 ' + v.name + '（' + v.code + '）'; } } catch (e) { /* 老版本的原生没有 version() */ }
    return window.ECHO_APP ? '回声岛 安卓版' : '回声岛 网页版';
  }

  // ---------- 新版本提示（家长 2026-10-07，评估第 19 条）----------
  // APK 打开时去看一眼 version.json（默认放在 GitHub Pages，家长设置里能改地址），格式 {"code":N,"name":"…","url":"…","notes":"…"}；
  // code 比装着的大（EchoNative.version().code）就在首页挂「有新版本，请家长更新」。网页版总是最新的，不查。查不到（没网、国内打不开）就算了
  // 默认地址只在家庭版的安装包里（原生 EchoNative.verUrl()，打包时 echo.properties 的 VER_URL）；网页里不写死。
  // 销售版没有默认地址（不让别人家的手机去连境外的网站；新版本由帮忙安装的人私下发），家长要查就自己填一个
  const VER_URL0 = (() => { try { return window.DEX && DEX.sales ? '' : nat('verUrl') ? String(EchoNative.verUrl() || '') : ''; } catch (e) { return ''; } })();
  function myVer() { try { if (nat('version')) { const v = JSON.parse(EchoNative.version() || '{}'); if (v && +v.code > 0) return { code: +v.code, name: String(v.name || '') }; } } catch (e) { /* 老版本的原生没有 version() */ } return null; }
  const updNew = () => { const me = myVer(); return !!(me && S.upd && +S.upd.code > me.code); };
  function verCheck() {
    if (!myVer() || typeof fetch !== 'function') return Promise.resolve(false);
    const url = String(S.settings.verUrl || VER_URL0).trim();
    if (!/^https:\/\/[^\s]+$/.test(url)) return Promise.resolve(false);
    const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = setTimeout(() => { if (ctl) ctl.abort(); }, 8000);
    return fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(r => (r.ok ? r.json() : null)).then(j => {
        clearTimeout(tm);
        if (!j || !(+j.code > 0)) return false;
        S.upd = { code: +j.code, name: String(j.name || '').slice(0, 40), url: /^https?:\/\/\S+$/.test(j.url || '') ? String(j.url).slice(0, 300) : '', notes: String(j.notes || '').slice(0, 400), at: Date.now() };
        save(); refreshBars();
        return true;
      }).catch(() => { clearTimeout(tm); return false; });
  }
  function updInfo() {
    const me = myVer(), u = S.upd || {};
    if (!updNew()) { refreshBars(); return; }
    openModal('<div class="big">🆕</div><h2>有新版本了</h2><p>现在装的是 <b>' + esc(me.name || '') + '（' + me.code + '）</b>，新版本是 <b>' + esc(u.name || '') + '（' + u.code + '）</b>。</p>' +
      (u.notes ? '<p class="tip">更新了什么：' + esc(u.notes) + '</p>' : '') +
      '<p>请家长把新版本覆盖安装到这台手机上（存档不会丢，安装前也可以先在设置里「导出存档」）。' + (u.url ? '下载地址：<br><b class="ver-url">' + esc(u.url) + '</b>' : '') + '</p>' +
      '<div class="row">' + (u.url && nat('shareText') ? '<button class="btn ghost" data-act="updShare">📤 把地址发给家长</button>' : '') + '<button class="btn" data-act="close" data-focus>知道了</button></div>');
  }
  function verSheet() {
    openModal('<h2>🆕 检查新版本的地址</h2><p>打开 App 时去这个地址看有没有新版本（一个 version.json 文件）。' + (VER_URL0 ? '留空就用默认地址：</p><p class="tip ver-url">' + esc(VER_URL0) + '</p>' : '留空就不检查。</p>') +
      '<input id="ver-in" class="txt-in" autocomplete="off" spellcheck="false" placeholder="https://…/version.json" value="' + esc(S.settings.verUrl || '') + '">' +
      '<div class="row"><button class="btn ghost" data-act="setBack">返回</button><button class="btn" data-act="verSave">保存</button></div>');
  }

  // ---------- 导出存档 / 从备份恢复（评估第 7 条）----------
  const saveName = () => 'echo-save-' + dayStr().replace(/-/g, '') + '.json';
  function exportSave() {
    save();
    const txt = JSON.stringify(S), name = saveName();
    try { if (nat('shareFile') && EchoNative.shareFile('回声岛存档（含 AI 生成的聊天文字）', name, txt)) { toast('📤 选「微信」发给家长或者「文件传输助手」存起来'); return true; } } catch (e) { /* 换下一种 */ }
    try { if (nat('shareText') && EchoNative.shareText('回声岛存档（含 AI 生成的聊天文字）', txt)) { toast('📤 选「微信」发给家长存起来'); return true; } } catch (e) { /* 换下一种 */ }
    // 网页版：下载成一个文件
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast('💾 存档下载好了：' + name);
      return true;
    } catch (e) { toast('导出失败了'); return false; }
  }
  // 一份存档的样子：名字 · 等级 · 徽章 · 怪兽
  function saveSum(o) {
    const nm = o && o.player && o.player.name, mon = (o && o.mon) || {};
    return [nm ? String(nm).slice(0, 12) : '', 'Lv ' + lvInfo(+(o && o.xp) || 0).lv, '🏅 ' + Object.keys(mon.badges || {}).length, '🐾 ' + (mon.box || []).length].filter(Boolean).join(' · ');
  }
  function restoreSheet() {
    const meta = bakMeta(), rows = [];
    BAK.forEach((k, i) => { const o = parseSave(lsGet(k)); if (o) rows.push(['l', i, '📱 这台设备 · ' + (meta['d' + (i + 1)] || '以前'), saveSum(o)]); });
    const pre = parseSave(lsGet(PRE)); if (pre) rows.push(['p', 0, (meta.preWhy === 'reset' ? '↩️ 清空之前的进度' : '↩️ 上次恢复之前的进度') + (meta.pre ? ' · ' + meta.pre : ''), saveSum(pre)]);
    if (nat('backupList')) { try { JSON.parse(EchoNative.backupList() || '[]').forEach(b => rows.push(['n', b.name, '📁 下载/EchoIsland · ' + (b.date || b.name), Math.max(1, Math.round((b.size || 0) / 1024)) + ' KB'])); } catch (e) { /* 读不到就不列 */ } }
    const list = rows.map(r => '<button class="pre-item bak-item" data-act="bakUse" data-src="' + r[0] + '" data-k="' + esc(r[1]) + '"><b>' + esc(r[2]) + '</b><span>' + esc(r[3]) + '</span></button>').join('');
    openModal('<h2>🗂️ 从备份恢复</h2><p>选一份备份，用它替换现在的进度。现在的进度会先另存一份（恢复错了还能换回来）。</p>' +
      '<div class="pre-list bak-list">' + (list || '<p class="tip">还没有备份。每天第一次打开游戏时会自动备份一份。</p>') + '</div>' +
      (nat('backupPick') ? '<button class="btn small ghost wide" data-act="bakFile">📂 从文件里选（换手机、重装以后用；微信里收到的存档文件先存到手机里）</button>'
        : '<label class="btn small ghost wide bak-file">📂 选一个存档文件（.json）<input type="file" id="bak-file" accept=".json,application/json,text/plain" hidden></label>') +
      '<button class="btn ghost wide" data-act="setBack">返回</button>');
  }
  function bakText(src, k) {
    if (src === 'l') return lsGet(BAK[+k]);
    if (src === 'p') return lsGet(PRE);
    if (src === 'n' && nat('backupRead')) { try { return EchoNative.backupRead(k); } catch (e) { return ''; } }
    return '';
  }
  function restoreConfirm(txt, label) {
    const o = parseSave(txt);
    if (!o) { toast('这个文件不是回声岛的存档，或者已经坏了'); return; }
    RT.restoreTxt = txt; RT.restoreLabel = label || '备份';
    openModal('<div class="big">🗂️</div><h2>用这份备份？</h2><p><b>' + esc(label || '') + '</b><br>' + esc(saveSum(o)) + '</p>' +
      '<p>现在的进度（' + esc(saveSum(S)) + '）会被换掉，不过会先另存一份。</p>' +
      '<div class="row"><button class="btn ghost" data-act="bakRestore">不了</button><button class="btn coral" data-act="bakGo">恢复</button></div>');
  }
  function doRestore(txt, label) {
    const o = parseSave(txt);
    if (!o) { toast('这个文件不是回声岛的存档，或者已经坏了'); return false; }
    save();
    const meta = bakMeta(); meta.pre = dayStr(); delete meta.preWhy;
    if (!lsSet(PRE, JSON.stringify(S))) { try { localStorage.removeItem(BAK[2]); } catch (e) { /* 忽略 */ } lsSet(PRE, JSON.stringify(S)); }
    lsSet(BAK_META, JSON.stringify(meta));
    if (!lsSet(KEY, txt)) { toast('存不进去（这台设备的空间满了？）'); return false; }
    RT.noSave = true;   // 马上重新打开：别让现在的进度又存回去
    try { sessionStorage.setItem('echo-restored', label || '备份'); } catch (e) { /* 忽略 */ }
    closeModal();
    setTimeout(() => location.reload(), 50);
    return true;
  }
  // 原生的文件选择器选好了（backupPick）
  window.addEventListener('echo-backup-picked', e => {
    const d = (e && e.detail) || {};
    if (!RT.pickWait) return;
    RT.pickWait = false;
    if (d.ok && d.text) restoreConfirm(d.text, '📂 ' + (d.name || '选的文件'));
    else if (d.error && d.error !== 'cancel') toast('读不了这个文件（' + d.error + '）');
  });
  // 出错记录（家长设置里看；可以发给帮忙的人）
  function errText() {
    const L = window.EchoErr ? EchoErr.list().reverse() : [];
    let diag = ''; try { if (nat('diag')) diag = EchoNative.diag(); } catch (e) { /* 忽略 */ }
    return verText() + '\n' + (diag ? '原生：' + diag + '\n' : '') + L.map(x => new Date(x.t).toLocaleString('zh-CN') + ' [' + x.k + '] ' + x.m + (x.s ? ' @' + x.s : '') + (x.n > 1 ? ' ×' + x.n : '')).join('\n');
  }
  function errSheet() {
    const L = window.EchoErr ? EchoErr.list().reverse() : [];
    const rows = L.slice(0, 50).map(x => '<li><small>' + esc(new Date(x.t).toLocaleString('zh-CN')) + (x.n > 1 ? ' ×' + x.n : '') + '</small>' + esc(x.m) + (x.s ? ' <i>' + esc(x.s) + '</i>' : '') + '</li>').join('');
    openModal('<h2>🔧 出错记录</h2><p class="tip">' + esc(verText()) + ' · 最近 ' + L.length + ' 条（最多留 50 条）</p>' +
      (rows ? '<ul class="err-list">' + rows + '</ul>' : '<p>没有出错记录 👍</p>') +
      (rows ? '<div class="say-row"><button class="btn small ghost" data-act="errShare">📤 发给帮忙的人</button><button class="btn small ghost" data-act="errClear">🧹 清空</button></div>' : '') +
      '<button class="btn wide" data-act="setBack">返回</button>');
  }
  // 家长首次设置做完了（setup.js）：回首页，给孩子看游戏说明（看完接着做「说一句 Hello」的小检查，家长那边测过就不用）
  function afterSetup() {
    RT.parentUntil = 0;
    show('home'); renderHome();
    if (!S.seenIntro) setTimeout(introSheet, 200);
    else if (window.ECHO_APP && !S.micCheck && speakMode() === 'sr') setTimeout(checkSheet, 300);
  }
  function introSheet() {
    openModal('<div class="big">🏝️</div><h2>欢迎来到回声岛！</h2>' +
      '<p><b>🐲 怪兽冒险</b>：选一只怪兽当伙伴，用英语念咒语攻击，听懂对手的英语来防御。收服新怪兽、升级进化，打败 13 个区域的岛主拿徽章。</p>' +
      '<p><b>📚 闯关练习</b>：📗 课本单元（适用于沪教版词汇，跟着学校的单元走）和 13 座话题小岛。每通关一关送回声球，用来收服怪兽。</p>' +
      '<p><b>🗣️ 和岛民聊天</b>：按住话筒，用英语和岛上的人真的聊天；聊完 AI 写评语，说错的句子第二天会出现在 📕 每日复习里。</p>' +
      '<p>🎁 每天 3 个任务，做完开宝箱 · 🔥 每天打一场就算打卡</p>' +
      envHTML() +
      '<div class="row"><button class="btn ghost" data-act="testVoice">🔊 试试声音</button><button class="btn" data-act="introGo" data-focus>出发！</button></div>', { locked: true });
  }

  // ---------- 事件 ----------
  const num = (t, k) => +t.dataset[k];
  const ACT = {
    level: t => { SFX.tap(); levelSheet(num(t, 'w'), num(t, 'l')); },
    quizView: t => { S.book.view = t.dataset.v; save(); RT.scrollCur = true; renderHome(); },
    bookAt: t => { const i = num(t, 'i'); if (!unitOpen(i)) return; S.book.at = i; S.book.vb = BK[i].book; save(); closeModal(); RT.scrollCur = true; renderHome(); toast('📍 现在学 ' + BK[i].bshort + ' Unit ' + BK[i].n + '，冒险里会多出它的题'); },
    bookView: t => {
      if (!bookOpen(t.dataset.b)) { const b = BOOKS.find(x => x.id === t.dataset.b) || {}; openModal('<div class="big">🔒</div><h2>' + esc(b.short || '') + '还没开放</h2><p>这台手机上开放的是这个学年的课本单元。下一学年的单元是另外的内容包，请家长联系帮您安装的人。</p><button class="btn wide" data-act="close" data-focus>知道了</button>'); return; }
      S.book.vb = t.dataset.b; save(); renderHome();
    },
    bookPick: () => {
      const ci = curIdx();
      openModal('<h2>📗 课本学到哪个单元了？</h2><p>选好以后，闯关页会标出这个单元；怪兽冒险里的英语题也会多出这个单元的单词和句子。</p>' +
        BOOKS.filter(b => bookOpen(b.id)).map(b => '<h3 class="pick-h">' + esc(b.name) + (b.old ? '（旧版）' : '') + '</h3><div class="fly-list">' +
          BK.map((u, i) => u.book !== b.id ? '' : '<button class="btn small ' + (i === ci ? '' : 'ghost') + '" data-act="bookAt" data-i="' + i + '">' + u.icon + ' U' + u.n + ' ' + esc(u.en) + '</button>').join('') + '</div>').join('') +
        '<button class="btn ghost wide" data-act="close">取消</button>');
    },
    bookGram: t => { const u = WX[num(t, 'w')]; openModal('<div class="big">📐</div><h2>Unit ' + u.n + ' 语法：' + esc(u.grammar.title) + '</h2><p>' + esc(u.grammar.tip) + '</p><button class="btn wide" data-act="close" data-focus>知道了</button>'); },
    setBookMix: t => { const m = +t.dataset.m; if (m === S.book.mix) return; parentOk('改冒险里的英语题', () => { S.book.mix = m; save(); settingsSheet(); }); },
    setGate: t => {
      const on = t.dataset.m === '1';
      if (on === (S.settings.gate !== false)) return;
      const go = () => { S.settings.gate = on; if (!on) dayLog().gateOff = 1; save(); settingsSheet(); };
      if (on) go(); else parentOk('关学习锁', go);
    },
    goAdventure: () => goHome('mon'),
    report: () => { closeModal(); reportSheet(); },
    gateTalk: () => { closeModal(); goHome('talk'); },
    // 学习锁卡片上「手机日期被改过」：家长输密码，从今天重新开始（maxDay 设成今天，周报记一笔）
    clockReset: () => parentOk('手机日期被改过：从今天重新开始', () => { S.maxDay = dayStr(); dayLog().clockReset = 1; save(); renderHome(); toast('📅 好了，从今天重新开始'); }),
    // 家长密码的数字键盘
    pinKey: t => pinKey(t.dataset.k),
    pinDel: () => { if (RT.pin) { RT.pin.buf = RT.pin.buf.slice(0, -1); pinUpd(); } },
    pinClr: () => { if (RT.pin) { RT.pin.buf = ''; pinUpd(); } },
    // 改家长密码：网页版和销售版的 APK 能改（销售版原生要 2 分钟内刚输对过旧密码，所以这里一律重新输一次）
    pinChange: () => {
      RT.parentUntil = 0; RT.pinPass = null;
      const setNew = () => pinPad('改家长密码', () => { toast('🔑 家长密码改好了'); settingsSheet(); }, 'set1');
      if (pinState().has) parentOk('改家长密码', setNew); else setNew();
    },
    // 冒险时间
    limEdit: () => parentOk('改冒险时间', limitSheet),
    limSet: t => {
      const k = t.dataset.k, v = t.dataset.v, c = S.settings.limit = limitCfg();
      c[k] = k === 'on' ? v === '1' : k === 'from' || k === 'to' ? v : +v;
      save(); limitSheet();
    },
    setBack: () => settingsSheet(),   // 家长设置里的小页面「完成 / 返回」：回到设置（家长设置保持展开）
    // 日报推送
    pushEdit: () => parentOk('改学习日报推送', pushSheet),
    pushSave: () => {
      const v = (($('#push-in') || {}).value || '').trim();
      if (v && !pushKind(v)) { toast('看不懂这个地址：要 32 位的 PushPlus token，或者 https://qyapi.weixin.qq.com/… 开头的机器人地址'); return; }
      S.settings.push = v; S.push = { sent: '' }; save(); toast(v ? '📲 好了：每天 20 点以后发一条学习日报' : '不发日报了'); settingsSheet();
    },
    pushOff: () => { S.settings.push = ''; save(); toast('不发日报了'); settingsSheet(); },
    pushTest: () => {
      const v = (($('#push-in') || {}).value || '').trim();
      if (!pushKind(v)) { toast('先填好 PushPlus token 或企业微信机器人地址'); return; }
      pushSend('回声岛：测试消息', '家长您好！以后每天晚上 8 点以后，会在这里收到孩子当天的学习小结。', v).then(ok => toast(ok ? '📲 发出去了，去微信里看看有没有收到' : '没发出去：检查一下网络和地址'));
    },
    setCtl: t => { S.settings.ctl = t.dataset.m; save(); if (window.EchoWorld && EchoWorld.ctlMode) EchoWorld.ctlMode(); settingsSheet(); },
    setOrient: t => { S.settings.orient = t.dataset.m; save(); applyOrient(); settingsSheet(); },
    start: t => { closeModal(); startLevel(num(t, 'w'), num(t, 'l')); },
    go: t => { const wi = num(t, 'w'), li = num(t, 'l'); if (!isUnlocked(wi, li)) { goHome(); return; } startLevel(wi, li); },
    close: () => { if ($('#restbtn') && $('#restbtn').disabled) return; closeModal(); },
    // 第一次打开：看完说明，开口模式下接着做「麦克风 + 网络 + 密钥」小检查
    introGo: () => { S.seenIntro = true; save(); closeModal(); primeTTS(); ac(); if (speakMode() === 'sr' && !S.micCheck) setTimeout(checkSheet, 200); },
    // 存档读不出来、用了备份的提示看完了：新存档（一份备份都没有）接着看游戏说明
    restoredOk: () => { closeModal(); if (!S.seenIntro) introSheet(); },
    // AI 打分用不了（评估第 3 条）
    aiBarInfo: () => aiBarInfo(),
    parentSet: () => { RT.parentOpen = true; settingsSheet(); setTimeout(() => { const d = $('#set-parent'); if (d) d.scrollIntoView({ block: 'start' }); }, 60); },
    micFix: () => { try { if (nat('openAppSettings')) EchoNative.openAppSettings(); } catch (e) { /* 忽略 */ } toast('在「权限 → 麦克风」里选「允许」，再回到游戏'); },
    micCheck: () => checkSheet(),
    chkMic: () => chkMic(),
    chkSkip: () => { if (!S.micCheck) S.micCheck = 'skip'; save(); stopListening(); closeModal(); },
    chkDone: () => closeModal(),
    // 新版本
    updInfo: () => updInfo(),
    updShare: () => { try { if (S.upd && S.upd.url) EchoNative.shareText('回声岛有新版本', '回声岛新版本 ' + (S.upd.name || '') + '：' + S.upd.url); } catch (e) { /* 忽略 */ } },
    verEdit: () => parentOk('改检查新版本的地址', verSheet),
    verSave: () => {
      const v = (($('#ver-in') || {}).value || '').trim();
      if (v && !/^https:\/\/\S+$/.test(v)) { toast('地址要以 https:// 开头'); return; }
      S.settings.verUrl = v; S.upd = {}; save(); toast(v ? '好了，以后去新地址检查' : '用回默认地址'); settingsSheet(); verCheck();
    },
    // 存档备份
    bakExport: () => exportSave(),
    bakRestore: () => parentOk('从备份恢复', restoreSheet),
    bakUse: t => { const txt = bakText(t.dataset.src, t.dataset.k); if (!txt) { toast('这份备份读不出来'); return; } restoreConfirm(txt, (t.querySelector('b') || t).textContent); },
    bakFile: () => { RT.pickWait = true; try { EchoNative.backupPick(); } catch (e) { RT.pickWait = false; toast('打不开文件选择'); } },
    bakGo: () => { if (RT.restoreTxt) doRestore(RT.restoreTxt, RT.restoreLabel); },
    // 出错记录
    errLog: () => errSheet(),
    errShare: () => {
      const txt = errText();
      try { if (nat('shareText') && EchoNative.shareText('回声岛出错记录', txt)) return; } catch (e) { /* 换下一种 */ }
      try { navigator.clipboard.writeText(txt).then(() => toast('复制好了，可以粘贴发给别人'), () => toast('复制不了')); } catch (e) { toast('复制不了'); }
    },
    errClear: () => { if (window.EchoErr) EchoErr.clear(); errSheet(); },
    say: () => P && P.q && say(P.q.audio),
    saySlow: () => P && P.q && say(P.q.audio, 0.6),
    sayT: () => P && P.q && (peekAnswer(), say(P.q.target || P.q.en)),
    sayTSlow: () => P && P.q && (peekAnswer(), say(P.q.target || P.q.en, 0.6)),
    sayText: t => say(t.dataset.t),
    // 看原文：听力题变成了读的题，算带提示（经验减半、复习里不升格）
    reveal: t => { const h = $('#hl'); if (h) h.classList.remove('blur'); t.remove(); if (P && !P.answered) P.aided = true; },
    btShow: () => btReveal(true),
    pick: t => onPick(num(t, 'i')),
    tile: t => onTile(num(t, 'i'), false),
    untile: t => onTile(num(t, 'i'), true),
    loCheck: onLoCheck,
    mic: onMic,
    hint: onHint,
    skip: onSkip,
    rate: t => onRate(num(t, 'v')),
    playMine: () => { if (RT.recUrl) { const a = new Audio(RT.recUrl); a.play().catch(() => toast('播放录音失败')); } },
    selfReveal: () => { P.selfReveal = true; const st = $('#st'); if (st) { st.classList.remove('mask'); st.innerHTML = wordsHTML(P.q.target); } const b = $('#hintbtn'); if (b) b.disabled = true; say(P.q.target); showSelf(false); },
    btOpt: t => onBtOpt(num(t, 'i')),
    bossGo: () => renderQ(),
    scene: t => { closeModal(); openScene(num(t, 'w')); },
    thClose: () => goHome(),
    thPlay: () => {
      if (!T) return;
      if (T.playing) {
        stopScene(); $('#th-turn').innerHTML = ''; updPlay(); renderStage();
        const clap = $('#th-clap'); if (clap) clap.hidden = true;
        const stage = $('#stage'); if (stage) stage.classList.add('live');
        return;
      }
      primeTTS();
      playFrom(T.done || T.idx < 0 ? 0 : T.idx);
    },
    thMode: t => { stopScene(); T.mode = t.dataset.m; T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thMe: t => { stopScene(); T.me = num(t, 'i'); T.idx = -1; T.done = false; renderTheater(); if (t.dataset.go) playFrom(0); },
    thSlow: t => { T.slow = !T.slow; t.classList.toggle('on', T.slow); t.setAttribute('aria-pressed', T.slow); },
    thEn: t => { T.en = !T.en; t.classList.toggle('on', T.en); t.setAttribute('aria-pressed', T.en); renderStage(); },
    thZh: t => { T.zh = !T.zh; t.classList.toggle('on', T.zh); t.setAttribute('aria-pressed', T.zh); renderStage(); },
    thLine: t => { if (!T || T.playing) return; const L = T.sc.lines[num(t, 'i')]; say(L[1], T.slow ? 0.65 : undefined, T.sc.cast[L[0]][2]); },
    thHear: () => { if (!T || !T.turn) return; const L = T.sc.lines[T.idx]; say(L[1], 0.75, T.sc.cast[L[0]][2]); },
    thMic: () => thMic(),
    thDone: () => endTurn(speakMode() !== 'sr'),
    next: onNext,
    quit: () => {
      if (!P) { goHome(); return; }
      openModal('<h2>要离开这一关吗？</h2><p>现在退出，这一关的进度不会保存。</p><div class="row"><button class="btn ghost" data-act="home">退出</button><button class="btn" data-act="close" data-focus>继续闯关</button></div>');
    },
    home: () => { closeModal(); goHome(); },
    retry: () => { closeModal(); const p = P; if (!p) { goHome(); return; } if (p.review) startLevel(0, 0, true); else startLevel(p.wi, p.li); },
    revive: () => {
      if (!P || S.coins < 30 || P.revived) return;
      S.coins -= 30; P.revived = true; P.hearts = 2; save(); renderHearts(); closeModal(); SFX.coin();
      toast('❤️ 复活成功！');
      P.idx++; if (P.idx >= P.total) finish(); else renderQ();
    },
    review: () => {
      const r = revSummary(), all = Object.values(S.rev.items);
      const wrongs = all.filter(e => e.x > 0 && e.due).sort((a, b) => b.x - a.x).slice(0, 30);
      const txt = e => e.k === 'free' ? [e.en, e.zh] : (() => { const w = WX[e.w], it = e.k === 'word' ? w.words[e.i] : e.k === 'sent' ? w.sents[e.i] : w.dlgs[e.i]; return e.k === 'dlg' ? [it[0] + ' → ' + it[1], ''] : [it[0], it[1]]; })();
      const list = wrongs.map(e => { const [en, zh] = txt(e); return '<button class="pre-item" data-act="sayText" data-t="' + esc(en.replace(' → ', ' ... ')) + '">🔊 <b>' + esc(en) + '</b><span>' + esc(zh) + (e.x > 1 ? ' · 错过 ' + e.x + ' 次' : '') + '</span></button>'; }).join('');
      const mastered = all.filter(e => !e.due).length, waiting = all.filter(e => e.due && e.due > dayStr()).length;
      openModal('<div class="big">📕</div><h2>每日复习</h2>' +
        '<p>' + (r.n ? '今天要复习 <b>' + r.n + '</b> 题：' + [r.wrong ? r.wrong + ' 道错题' : '', r.old ? r.old + ' 道学过的' : '', r.chat ? r.chat + ' 句 AI 聊天里学到的更好说法' : ''].filter(Boolean).join('、') + '。' : '今天的复习做完了！') +
        '答错的题当天就复习；复习答对一次，隔 1、2、4、7、15、30 天再考一次，都对了就算掌握。冒险里答对今天到期的题也算复习。</p>' +
        '<p class="tip">⏳ 以后会回来的 ' + waiting + ' 题 · 🏅 已经掌握 ' + mastered + ' 题</p>' +
        (list ? '<details class="pre"><summary>📖 错题本（点一句就能听）</summary><div class="pre-list">' + list + '</div></details>' : '') +
        '<div class="row"><button class="btn ghost" data-act="close">等会儿</button>' + (r.n ? '<button class="btn" data-act="startReview" data-focus>复习 ' + Math.min(REV_N, r.n) + ' 题</button>' : '') + '</div>');
    },
    startReview: () => { closeModal(); startLevel(0, 0, true); },
    claim: t => {
      const q = S.quests.list.find(x => x.id === t.dataset.q), d = QDEF[t.dataset.q];
      if (!q || !d || q.claimed || q.p < d.goal) return;
      q.claimed = true; S.coins += d.rw; S.xp += 20; save(); SFX.coin();
      toast('+' + d.rw + ' 金币 +20 经验', 'gold');
      renderHome(); checkAch();
    },
    chest: openChest,
    shop: shopSheet,
    pet: t => onPet(t.dataset.p),
    buyFreeze: () => { if (S.freeze >= 2 || S.coins < 100) return; S.coins -= 100; S.freeze++; save(); SFX.coin(); renderTop(); shopSheet(); },
    ach: achSheet,
    settings: () => { RT.parentOpen = false; settingsSheet(); },
    testVoice: () => { ac(); primeTTS(); say('Hello! Welcome to Echo Island. Let\'s learn English together!'); },
    setMode: t => { S.settings.mode = t.dataset.m; if (t.dataset.m === 'auto') { RT.srBroken = false; RT.noRec = false; if (!SRC) toast('这个浏览器不支持语音识别，会继续用录音自评'); } save(); settingsSheet(); },
    setTts: t => { S.settings.tts = t.dataset.m; RT.ttsBroken = false; save(); settingsSheet(); primeTTS(); say('Hello! How are you?'); },
    setGfx: t => { S.settings.gfx = t.dataset.m; if (t.dataset.m === 'auto') S.settings.gfxAuto = ''; save(); settingsSheet(); if (window.EchoWorld) EchoWorld.setGfx(); },
    sfx: t => { S.settings.sfx = t.dataset.v === '1'; save(); settingsSheet(); },
    setMusic: t => { S.settings.music = t.dataset.v; save(); musicVol(); sceneMusic(); settingsSheet(); },
    // 「全部关卡直接开放」只对闯关练习有效；打开要家长密码，关上不用
    unlock: t => {
      const on = t.dataset.v === '1', go = () => { S.settings.unlockAll = on; save(); settingsSheet(); renderHome(); };
      if (on === !!S.settings.unlockAll) return;
      if (on) parentOk('闯关练习全部直接开放', go); else go();
    },
    // 清空进度：家长密码 + 再输入「清空」两个字
    reset: () => parentOk('清空全部进度', () => openModal('<div class="big">⚠️</div><h2>清空全部进度</h2><p>星星、金币、怪兽、徽章、复习记录都会清零。清空前会先另存一份，清错了可以在「从备份恢复」里找回（要家长密码）。</p>' +
      '<p>真的要清空，请在下面输入「清空」两个字：</p><input id="reset-in" class="txt-in" autocomplete="off" aria-label="输入清空两个字">' +
      '<div class="row"><button class="btn ghost" data-act="setBack">不清空了</button><button class="btn coral" data-act="resetGo">清空</button></div>')),
    resetGo: () => {
      const i = $('#reset-in');
      if (!i || i.value.trim() !== '清空') { toast('要输入「清空」两个字才会清空'); return; }
      // 设置和每周的记录（家长看的）留着；今天的记录上标一笔「清空过进度」
      // 清空前先另存一份（和「从备份恢复」之前一样存在 PRE），清错了还能找回来
      const meta = bakMeta(); meta.pre = dayStr(); meta.preWhy = 'reset';
      if (!lsSet(PRE, JSON.stringify(S))) { try { localStorage.removeItem(BAK[2]); } catch (e) { /* 忽略 */ } lsSet(PRE, JSON.stringify(S)); }
      lsSet(BAK_META, JSON.stringify(meta));
      const keep = S.settings, weekly = S.weekly, maxDay = S.maxDay;
      S = fresh(); S.settings = keep; S.weekly = weekly; S.maxDay = maxDay; S.seenIntro = true; dayLog().reset = 1;
      if (window.EchoSetup) EchoSetup.apply(false);   // 销售版：家长设好的昵称、形象、伙伴接着用
      save(); closeModal(); renderHome(); toast('进度已清空');
    },
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (t) {
      if (t.disabled) return;
      const f = ACT[t.dataset.act];
      // 记下刚点的按钮：老写法 `if (!parentOk('…')) return;` 输对密码以后要把它再执行一次
      if (!/^pin/.test(t.dataset.act)) RT.lastAct = { act: t.dataset.act, el: t, t: Date.now() };
      if (f) f(t, e);
      return;
    }
    if (e.target.id === 'modal' && !RT.modalLocked) closeModal();
  });
  // 设置里「🔒 家长设置」展开 / 收起：重画设置页时保持原样
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'set-parent') RT.parentOpen = e.target.open; }, true);
  document.addEventListener('input', e => {
    if (e.target.id === 'set-rate') { S.settings.rate = +e.target.value; $('#rate-v').textContent = S.settings.rate.toFixed(2); save(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'set-voice') { S.settings.voice = e.target.value; pickVoice(); save(); say('Hello! How are you?'); }
    // 网页版「从备份恢复」：选了一个存档文件
    if (e.target.id === 'bak-file' && e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > 32 * 1024 * 1024) { toast('文件太大了，不像存档'); return; }
      const rd = new FileReader();
      rd.onload = () => restoreConfirm(String(rd.result || ''), '📂 ' + f.name);
      rd.onerror = () => toast('读不了这个文件');
      rd.readAsText(f);
    }
  });
  document.addEventListener('keydown', e => {
    // 家长密码键盘：电脑上也可以直接敲数字
    if (RT.pin && !$('#modal').hidden && $('#pin-pad')) {
      if (/^\d$/.test(e.key)) { e.preventDefault(); pinKey(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); ACT.pinDel(); return; }
    }
    if (!$('#modal').hidden) { if (e.key === 'Escape' && !RT.modalLocked) closeModal(); return; }
    if (!P || $('#play').hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Enter' && $('#fb').classList.contains('show')) { e.preventDefault(); onNext(); return; }
    if (/^[1-4]$/.test(e.key)) {
      const b = $$('#p-body .opt')[+e.key - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); if (P.q) { if (/^sr_[ws]$/.test(P.q.type)) peekAnswer(); say(P.q.audio || P.q.target); } }
  });

  // 冒险里出英语题用哪份内容：按设置有几成换成课本正在学的单元（其中三成复习前面学过的单元），其余用这座岛的话题。
  // 返回 { w: 编号（存进错题本的 q.w）, d: 内容（words/sents/dlgs） }
  function src(z) {
    const mix = S.book.mix, cur = curIdx();
    if (cur < 0 || !(Math.random() < mix)) return { w: z, d: W[z] };
    const i = cur > 0 && Math.random() < .3 ? cur - 1 - rnd(Math.min(cur, 8)) : cur;   // 三成复习最近学过的 8 个单元（可以是上一册的）
    return { w: NB + i, d: BK[i] };
  }

  // ---------- 怪兽对战模块（monsters.js）用到的工具 ----------
  if (window.MonsterGame) {
    const api = {
      get S() { return S; }, W, WX, RT, FATAL, SFX, MIC, STOP, SPK, src, curUnit, curIdx, revRight, revAddFree, revMiss, revPick, fadeOf, cueText,
      save, say, recognize, bestScore, speakMode, stopListening, primeTTS, ac, toast, openModal, closeModal, confetti,
      qProg, checkAch, addWrong, markToday, gainXp, renderTop, renderHome, show, goHome, esc, wordsHTML, aiTip, gate, gateCard, gateBlock, dayLog, parentOk, music, jingle, sceneMusic,
      reduced, dayStr,
      // AI 打分用不了时（评估第 3 条）：aiDown() 现在该不该给「先跳过 / 听音选」；failHint(res) 没听到时的一行提示；
      // revLater(q 或 {en, zh}) 先跳过的题放进复习、联网后要补说；SKIP_TXT 跳过按钮上的字
      aiDown, failHint, revLater, SKIP_TXT,
    };
    Object.assign(ACT, MonsterGame.init(api), window.EchoWorld ? EchoWorld.init(api, MonsterGame) : {}, window.EchoTalk ? EchoTalk.init(api) : {}, {
      tab: t => { S.homeTab = t.dataset.t; save(); renderHome(); window.scrollTo(0, 0); },
    });
    // 销售版的家长首次设置向导（setup.js）：Object.create 留着 api 的 S（getter，存档换了也拿到新的）
    if (window.EchoSetup) {
      Object.assign(ACT, EchoSetup.init(Object.assign(Object.create(api), {
        afterSetup, afterEdit: () => { if (!$('#home').hidden) renderHome(); },
        aiReset: () => { RT.aiBar = null; RT.aiFails = 0; RT.aiOkAt = Date.now(); refreshBars(); },
      })));
    }
    // 进大地图 / 乘风之前再看一眼冒险时间（学习锁本身由 world.js 查）；断网放行的 30 分钟从第一次进去时开始算
    for (const k of ['wEnter', 'wFly']) {
      const f = ACT[k];
      if (f) ACT[k] = (t, e) => { if (advEnterOk()) f(t, e); };
    }
    // 家长换了 AI 密钥：以前「密钥不对 / 额度用完」的红条和失败次数作废（下一次识别再看）
    if (ACT.talk_cfg) { const f = ACT.talk_cfg; ACT.talk_cfg = (t, e) => { RT.aiBar = null; RT.aiFails = 0; RT.aiOkAt = Date.now(); f(t, e); refreshBars(); }; }
    // 「剧情中文」在 🔒 家长设置里：改宽松（总是显示 / 自动）要家长密码；改严（点一下才显示）不用
    if (ACT.wZhMode) {
      const zf = ACT.wZhMode, ZR = { always: 0, auto: 1, tap: 2 };
      ACT.wZhMode = (t, e) => {
        if (t.classList.contains('on')) return;
        const cur = S.settings.storyZh || 'auto', v = t.dataset.m;
        if (!(v in ZR)) return;
        if (ZR[v] > (ZR[cur] != null ? ZR[cur] : 1)) { zf(t, e); return; }
        parentOk('改剧情中文', () => { zf(t, e); RT.parentOpen = true; settingsSheet(); });
      };
    }
  }

  // 安卓 APK 的返回键（android/MainActivity.java 调用）：关弹窗 → 聊天开着就「结束并评价」（评价出来了再按一次关掉）→ 回首页；
  // 已经在首页就返回 false，APK 退到后台
  window.EchoBack = () => {
    try { if (window.EchoSetup && EchoSetup.back && EchoSetup.back()) return true; } catch (e) { /* 向导出错就按老办法 */ }
    if (!$('#modal').hidden) {
      if (RT.modalLocked) return true;   // 护眼休息这种锁着的弹窗：返回键跳不过去
      if ($('#modal [data-act=close]')) closeModal();
      return true;
    }
    try { if (window.EchoTalk && EchoTalk.endIfOpen && EchoTalk.endIfOpen()) return true; } catch (e) { /* 聊天出错就按老办法关 */ }
    const tk = $('#tk-ov'); if (tk && ACT.talk_close) { ACT.talk_close(); return true; }
    if ($('#home').hidden) { goHome(); return true; }
    return false;
  };

  // ---------- 每天的学习记录（周报）----------
  // 学习锁 / 冒险时间 / 家长相关的字段：gateOpen 真的做完了学习任务、gateEx 聊天这一项整天免了（noai / daily）、
  // passAt / passWhy 断网放行开始的时间和原因、gateOff 关过学习锁、clockBack 手机日期被往回调、clockReset 家长从今天重新开始、
  // night 很晚还在冒险、warn5 冒险还剩 5 分钟提醒过、stopped 冒险被叫回首页的原因、pinFail / pinLock 家长密码输错几次 / 被锁几次、
  // reset 清空过进度、pract 通关的练习关、asrN / asrSec / tipN / aiFail AI 用量和失败、sayN / saySum / spkQ / spk1 / weekN / weekOk 能力指标
  function dayLog(d) {
    d = d || dayStr();
    if (!S.log) S.log = {};
    if (!S.log[d]) {
      S.log[d] = { min: 0, learn: 0, play: 0 };
      const ks = Object.keys(S.log).sort();
      while (ks.length > 45) delete S.log[ks.shift()];   // 只留最近一个多月（每周的数字另外永久存在 S.weekly）
    }
    return S.log[d];
  }
  // 玩的时间：页面在前台、最近 1 分钟内碰过屏幕才算。做题、复习、对话动画、和岛民聊天算「学习」，冒险和对战算「冒险」，
  // 首页上翻菜单（手册、队伍、商店、设置、周报）两边都不算，只算进总时间
  let lastInput = Date.now();
  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  // 手机日期被往回调（想骗学习锁）：记下见过的最晚日期，比它早就算改过（记在今天，周报上看得到）
  function trackDay() {
    const t = dayStr();
    if (!S.maxDay || t > S.maxDay) S.maxDay = t;
    else if (t < S.maxDay) dayLog().clockBack = 1;
  }
  setInterval(() => {
    if (!S) return;
    trackDay();
    const t = dayStr();
    if (RT.day && RT.day !== t) { weeklyRoll(); if (!$('#home').hidden) renderHome(); }   // 过了半夜：学习锁、今日复习换成新的一天
    RT.day = t;
    pushTick();
    if (document.hidden) return;
    if (Date.now() - lastInput > 5 * 60e3) RT.lastRest = Date.now();   // 停下来 5 分钟以上：护眼的「连续玩了多久」重新算
    if (Date.now() - lastInput > 60000) return;
    const L = dayLog(), dt = 0.25, tk = !!document.getElementById('tk-ov');
    const learn = tk || RT.scr === 'play' || RT.scr === 'result' || RT.scr === 'theater', play = !tk && (RT.scr === 'world' || RT.scr === 'battle');
    L.min = +(L.min + dt).toFixed(2);
    if (learn) L.learn = +((L.learn || 0) + dt).toFixed(2); else if (play) L.play = +((L.play || 0) + dt).toFixed(2);
    if (play && isNight(nowD(), limitCfg())) L.night = 1;   // 很晚还在冒险（学习锁关着、或者家长没限时的时候才可能）
    if (S.settings.gate === false) L.gateOff = 1;
    if (Math.round(L.min * 4) % 4 === 0) save();   // 每分钟存一次
  }, 15000);
  setInterval(() => advTick(), 1000);   // 每秒看一眼：打完一场、说完话的那一刻就停（别让孩子接着又撞进下一场）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { RT.parentUntil = 0; return; }   // 切出去再回来：家长要重新输密码
    if (!S) return;
    if (!$('#home').hidden) renderHome();
    advTick(); pushTick();
  });

  // ---------- 学习锁：先完成今天的复习和一次英语聊天，再去怪兽冒险（家长 2026-10-07 改过，评估第 2、5 条）----------
  // 复习：今天没有要复习的，或者今天认真做完过一轮复习（答对一半以上）
  // 聊天：今天完成过一个聊天小目标，或者今天用语音说满 6 句英语（EchoTalk.today()：≥3 个英文词、不含中文；打字的不算）
  // 聊天这一项免掉的情况：
  //   - AI 聊天没开通（noai）、今天的聊天时长用完了（daily）：整天免（周报标 🟡）
  //   - 没网、聊天连上以后服务器真出错了（chatFail，talk.js 只在这种时候记）：只临时放行 30 分钟，不写 gateOpen（周报标 📵）；
  //     30 分钟从第一次进大地图开始算；联网以后回首页 / 进出大地图时重新检查（又要聊天了）
  // 真的做完了（gateOpen）当天就一直开着（冒险里答错一题不会又锁上）；手机日期被往回调时不开
  const PASS_MIN = 30;
  const passLeft = L => (L.passAt ? Math.max(0, PASS_MIN * 60e3 - (Date.now() - L.passAt)) : PASS_MIN * 60e3);
  function talkToday() {
    try { if (window.EchoTalk && EchoTalk.today) return EchoTalk.today(); } catch (e) { /* 聊天模块出错：当成还没聊 */ }
    return { voiceLines: 0, goals: 0, typedLines: 0, need: 6, done: false };
  }
  // 聊天连不上是因为密钥不对 / 额度用完（不是没网，也不是连上以后出错）：返回 'auth' / 'quota'，没有就是 ''。
  // 这种情况学习锁不自动放行（家长要去处理），只在卡片上说清楚
  function chatKeyBad() {
    const st = aiBarState();
    if (st && st.cls === 'key' && (st.why === 'auth' || st.why === 'quota')) return st.why;
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    if (le && le.where === 'chat' && (le.why === 'auth' || le.why === 'quota') && le.at > (RT.aiOkAt || 0) && dayStr(new Date(le.at)) === dayStr()) return le.why;
    return '';
  }
  function gate() {
    const today = dayStr(), on = S.settings.gate !== false, L = dayLog();
    const back = !!(S.maxDay && today < S.maxDay);
    const due = dueList().length, revDone = due === 0 || (L.revSess || 0) > 0;
    const tk = talkToday(), chatOn = !!(window.EchoTalk && EchoTalk.relayUrl());
    // 没网：手机说没网；或者 Wi-Fi 连着但上不了网（最近 10 分钟 AI 报过「找不到服务器」、今天聊天也没连上过）
    const le = window.EchoTalk && EchoTalk.lastErr ? EchoTalk.lastErr() : null;
    const offline = navigator.onLine === false || (!!le && le.why === 'offline' && Date.now() - le.at < 10 * 60e3 && !L.chatConn);
    const chatFail = !!L.chatFail, chatDaily = !!L.chatDaily, chatDone = !!tk.done;
    // 今天的聊天时间用完了：真的开口说过 3 句以上才整天免；一直不说话把时间耗完的，只临时放行 30 分钟
    const dailyFull = chatDaily && (tk.voiceLines || 0) >= 3;
    const exWhy = chatDone ? '' : !chatOn ? 'noai' : dailyFull ? 'daily' : '';
    const passWhy = chatDone || exWhy ? '' : offline ? 'offline' : chatFail ? 'fail' : chatDaily ? 'daily' : '';
    // 真的做完了就记下（学习锁关着也记：周报的 ✅ 和「学习日」看这个）
    if (!back && revDone && chatDone && !L.gateOpen) L.gateOpen = 1;
    let open = !on, pass = false, passMin = 0;
    if (on && !back) {
      if (L.gateOpen) open = true;
      else if (revDone && (exWhy || L.gateEx)) { if (!L.gateEx) L.gateEx = exWhy; open = true; }
      else if (revDone && passWhy && passLeft(L) > 0) { open = true; pass = true; passMin = Math.ceil(passLeft(L) / 60e3); }
    }
    if (on && !chatOn && window.ECHO_APP) L.noChat = 1;
    const chatOk = chatDone || !!exWhy || !!L.gateEx || pass;
    return {
      on, back, due, revDone, chatOn, offline, chatDone, chatFail, chatDaily, chatOk, open, keyBad: chatOk ? '' : chatKeyBad(),
      pass, passMin, passWhy, passUsed: !!L.passAt && !open, exWhy: exWhy || L.gateEx || '',
      voice: tk.voiceLines || 0, need: tk.need || 6, goals: tk.goals || 0,
      steps: (revDone ? 0 : 1) + (chatOk ? 0 : 1),
    };
  }
  function gateCard() {
    const g = gate();
    if (!g.on) return '';
    const L = dayLog();
    const row = (ok, txt, act, btn) => '<div class="gate-row' + (ok ? ' ok' : '') + '">' + (ok ? '<span>✅</span>' : '<i class="todo"></i>') + '<b>' + txt + '</b>' + (ok || !act ? '' : '<button class="btn small" data-act="' + act + '">' + btn + '</button>') + '</div>';
    const revTxt = g.revDone ? ((L.revSess || 0) ? '每日复习 · 今天做完一轮了' : '每日复习（今天没有要复习的）') : '做一轮每日复习（' + Math.min(g.due, REV_N) + ' 题）';
    const prog = '已开口说 <em class="gate-n">' + Math.min(g.voice, g.need) + '/' + g.need + '</em> 句';
    const chatTxt = g.chatDone ? (g.goals ? '和岛民聊天：完成了小目标' : '和岛民聊天：今天开口说了 ' + g.voice + ' 句英语')
      : g.exWhy === 'noai' ? '和岛民聊天（AI 聊天还没开通，今天先跳过）'
      : g.exWhy === 'daily' ? '和岛民聊天（今天的聊天时间用完了，先跳过）'
      : g.pass ? '和岛民聊天：' + (g.passWhy === 'offline' ? '现在没网' : g.passWhy === 'daily' ? '今天的聊天时间用完了' : '今天聊天连不上') + '，先让你冒险 ' + g.passMin + ' 分钟'
      : g.keyBad ? '和岛民聊天：' + (g.keyBad === 'quota' ? 'AI 额度用完了' : 'AI 密钥不对') + '，现在聊不了，请告诉家长（家长可以在 🔒 家长设置 里暂时关学习锁）'
      : g.passUsed ? '用英语和岛民聊天：' + prog + '（' + (g.passWhy === 'daily' || g.chatDaily ? '明天再来聊' : '连上网说满就能接着冒险') + '）'
      : '用英语和岛民聊天：' + prog + '，或者完成一个小目标';
    const chatGood = g.chatOk && !g.pass, done = (g.revDone ? 1 : 0) + (chatGood ? 1 : 0);
    const title = g.back ? '📅 手机日期好像被改过了' : g.open ? (g.pass ? '📵 今天先去冒险吧（临时 ' + g.passMin + ' 分钟）' : '🎉 今天的学习完成了，出发冒险吧！') : '📚 冒险前的 2 个小任务（完成 ' + done + '/2）';
    return '<section class="gate-card' + (g.open ? ' open' : '') + (g.pass ? ' pass' : '') + '"><h3>' + title + '</h3>' +
      (g.back ? '<p class="tip">把手机改回「自动设置日期和时间」再来。</p><button class="link" data-act="clockReset">👪 家长：从今天重新开始</button>' : '') +
      row(g.revDone, revTxt, 'review', '去复习') + row(chatGood, chatTxt, g.chatOn && !g.pass && !g.keyBad ? 'gateTalk' : '', '去聊天') +
      playLine() +
      '<button class="link" data-act="report">📊 看这周的学习周报</button></section>';
  }
  function gateBlock() {
    const g = gate();
    toast(g.back ? '手机日期好像被改过了，改回自动时间再来'
      : !g.revDone ? '先把今天的每日复习做完，再去冒险'
      : g.keyBad ? (g.keyBad === 'quota' ? 'AI 额度用完了' : 'AI 密钥不对') + '，现在没法聊天：请告诉家长'
      : g.passUsed ? (g.chatDaily ? '临时冒险时间用完了，今天的聊天时间也用完了，明天再来吧' : '临时冒险时间用完了：连上网，用英语和岛民聊一聊就能接着玩')
      : '先用英语和岛民聊一聊：开口说满 ' + g.need + ' 句（现在 ' + Math.min(g.voice, g.need) + ' 句），或者完成一个小目标');
    const c = $('.gate-card');
    if (c) { c.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); }
  }

  // ---------- 冒险时间（家长 2026-10-07，评估第 18 条）----------
  // 上学日 45 分钟、周末 90 分钟（只算大地图和对战）；21:30–7:00 不能冒险；多学一点换时间：多做一轮复习 / 多完成一个聊天目标 /
  // 多通关一关新练习（或拿到更多星星），每样 +10 分钟，每天最多 +30 分钟。家长设置里能改（S.settings.limit）。
  // 只在「先学习再冒险」开着时管（家长关掉学习锁 = 今天全部放开）；新游戏还没有怪兽时（开场剧情）不管。
  // 时间到了不半路掐断：等这一场战斗 / 这段对话 / 这段剧情结束，再友好地提示、回首页。
  const LIM0 = { on: true, wd: 45, we: 90, from: '21:30', to: '07:00', max: 30 };
  const nowD = () => new Date(RT.fakeNow ? RT.fakeNow + (Date.now() - RT.fakeAt) : Date.now());   // 测试可以换掉（EchoGame.T.setNow）
  const limitCfg = () => Object.assign({}, LIM0, S.settings.limit || {});
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : -1; };
  const clockTxt = s => String(s || '').replace(/^0(\d)/, '$1');
  function isNight(d, c) {
    const f = hm(c.from), t = hm(c.to);
    if (f < 0 || t < 0 || f === t) return false;
    const m = d.getHours() * 60 + d.getMinutes();
    return f > t ? m >= f || m < t : m >= f && m < t;
  }
  function bonusMin(L, c) {
    const extra = Math.max(0, (L.revSess || 0) - 1) + Math.max(0, (L.chatGoals || 0) - 1) + (L.pract || 0);
    return Math.min(c.max || 0, extra * 10);
  }
  function playInfo() {
    const c = limitCfg(), d = nowD(), L = dayLog(), wkend = d.getDay() === 0 || d.getDay() === 6;
    const on = S.settings.gate !== false && c.on !== false;
    const base = wkend ? c.we : c.wd, bonus = bonusMin(L, c), left = base + bonus - (L.play || 0), night = isNight(d, c);
    return { on, base, bonus, used: Math.round(L.play || 0), left: Math.max(0, Math.ceil(left)), night, over: on && (night || left <= 0), wkend, c };
  }
  function limText(c) {
    if (c.on === false) return '不限时';
    return '上学日 ' + c.wd + ' 分钟 · 周末 ' + c.we + ' 分钟' + (hm(c.from) >= 0 ? ' · ' + c.from + '–' + clockTxt(c.to) + ' 不能冒险' : '');
  }
  // 首页学习锁卡片上的一行：还能冒险几分钟 / 时间用完了 / 太晚了
  function playLine() {
    const pi = playInfo(), c = pi.c;
    if (!pi.on || !(S.mon && S.mon.box || []).length) return '';
    const t = pi.night ? '🌙 ' + c.from + ' 到早上 ' + clockTxt(c.to) + ' 不能冒险'
      : pi.over ? '⏰ 今天的冒险时间用完了' + (pi.bonus < (c.max || 0) ? '（多学一点能换时间）' : '')
      : '🕹️ 今天还能冒险 <b>' + pi.left + '</b> 分钟' + (pi.bonus ? '（含多学奖励 ' + pi.bonus + ' 分钟）' : '');
    return '<p class="gate-time' + (pi.over ? ' over' : '') + '">' + t + '</p>';
  }
  const advLimitWhy = () => { const pi = playInfo(); return !pi.on ? '' : pi.night ? 'night' : pi.over ? 'time' : ''; };
  // 人在大地图 / 对战里时要不要停下来：'night' 太晚了 / 'time' 时间用完 / 'pass' 断网放行的 30 分钟到了；不用停返回 ''
  function advStopWhy() {
    if (!(S.mon && S.mon.box || []).length) return '';
    const w = advLimitWhy(); if (w) return w;
    const L = dayLog();
    if (S.settings.gate !== false && L.passAt && !L.gateOpen && !L.gateEx && !passLeft(L) && !gate().open) return 'pass';
    return '';
  }
  // 进大地图 / 乘风之前（包在 world.js 的 wEnter / wFly 外面）：学习锁开着、但时间用完或者太晚了 → 友好提示，不进；
  // 断网放行的 30 分钟从这里开始算。学习锁本身没开的由 world.js 自己拦（gateBlock）
  function advEnterOk() {
    if (!(S.mon && S.mon.box || []).length) return true;
    const g = gate();
    if (!g.on || !g.open || g.back) return true;
    const why = advLimitWhy();
    if (why) { stopSheet(why, true); return false; }
    if (g.pass && !dayLog().passAt) {
      const L = dayLog(); L.passAt = Date.now(); L.passWhy = g.passWhy; save();
      toast('📵 ' + (g.passWhy === 'offline' ? '今天没网' : g.passWhy === 'daily' ? '今天的聊天时间用完了' : '今天聊天连不上') + '：先让你冒险 ' + PASS_MIN + ' 分钟');
    }
    return true;
  }
  function stopSheet(why, entering) {
    const pi = playInfo(), c = pi.c;
    const more = (c.max || 0) - pi.bonus;
    const H = {
      night: ['🌙', '该睡觉啦！', c.from + ' 到早上 ' + clockTxt(c.to) + ' 不能冒险。怪兽们都睡着了，明天再来吧！'],
      time: ['⏰', '今天的冒险时间到啦！', '今天冒险了 ' + pi.used + ' 分钟，怪兽们也要休息了。' + (entering ? '' : '进度都存好了，') + '明天再来！'],
      pass: ['📵', '临时冒险时间到了', '今天没网（或者聊天连不上），先让你冒险了 ' + PASS_MIN + ' 分钟。连上网，用英语和岛民聊一聊，就能接着冒险。'],
    }[why] || ['⏰', '先休息一下吧', ''];
    openModal('<div class="big">' + H[0] + '</div><h2>' + H[1] + '</h2><p>' + H[2] + '</p>' +
      (why === 'time' && more > 0 ? '<p class="tip">想多玩一会儿？多做一轮复习、多完成一个聊天目标、或者多通关一关新练习（或拿到更多星星），每样能换 10 分钟（今天还能换 ' + more + ' 分钟）。</p>' : '') +
      '<button class="btn wide" data-act="close" data-focus>好的</button>');
  }
  // 大地图里现在空着吗（没在说话、没在播剧情、没有弹窗、没在和岛民聊天）
  function worldIdle() {
    if (!$('#modal').hidden || document.getElementById('tk-ov')) return false;
    const box = document.getElementById('w-dlg'); if (box && !box.hidden) return false;
    try {
      if (window.EchoWorld && typeof EchoWorld.idle === 'function') return !!EchoWorld.idle();   // world.js 以后给了正式接口就用它
      const d = window.EchoWorld && EchoWorld._debug && EchoWorld._debug(); if (d && (d.dlg || d.busy)) return false;
    } catch (e) { return false; }
    return true;
  }
  // 每秒看一眼：冒险快到时间提醒一次；该停了就等这场战斗 / 对话结束，再回首页；连续玩久了，打完一场提醒护眼
  function advTick() {
    if (!S) return;
    if (RT.scr !== 'world' && RT.scr !== 'battle') { RT.advStop = ''; return; }
    const pi = playInfo(), L = dayLog();
    if (pi.on && !pi.over && pi.left <= 5 && !L.warn5) { L.warn5 = 1; toast('⏰ 今天的冒险还剩 5 分钟，打完这一场就该休息啦'); }
    if (!RT.advStop) RT.advStop = advStopWhy();
    if (RT.scr !== 'world' || !worldIdle()) return;
    if (RT.advStop) {
      const why = advStopWhy(); RT.advStop = '';
      if (!why) return;   // 等的时候情况变了（比如家长刚放宽了时间）
      L.stopped = why; save();
      goHome('mon');
      stopSheet(why, false);
      return;
    }
    if (RT.battleEnd && Date.now() - RT.battleEnd < 8000 && Date.now() - RT.lastRest > 35 * 60e3) { RT.battleEnd = 0; restModal(); }
  }
  function limitSheet() {
    const c = limitCfg();
    const seg = (k, list, fmt) => '<div class="seg wrap">' + list.map(v => '<button class="' + (String(c[k]) === String(v) ? 'on' : '') + '" data-act="limSet" data-k="' + k + '" data-v="' + v + '">' + fmt(v) + '</button>').join('') + '</div>';
    openModal('<h2>⏱️ 冒险时间</h2><p>只算大地图和对战的时间（做题、复习、聊天不算）。时间到了不会半路掐断：等这一场战斗或这段对话结束，再提示回首页。</p>' +
      '<div class="set"><label>冒险限时</label><div class="seg"><button class="' + (c.on ? 'on' : '') + '" data-act="limSet" data-k="on" data-v="1">限时（推荐）</button><button class="' + (c.on ? '' : 'on') + '" data-act="limSet" data-k="on" data-v="0">不限时</button></div></div>' +
      (c.on ? '<div class="set"><label>上学日（周一到周五）每天</label>' + seg('wd', [30, 45, 60, 90, 120], v => v + ' 分钟') + '</div>' +
        '<div class="set"><label>周末每天</label>' + seg('we', [45, 60, 90, 120, 180], v => v + ' 分钟') + '</div>' +
        '<div class="set"><label>晚上几点以后不能冒险</label>' + seg('from', ['20:30', '21:00', '21:30', '22:00', ''], v => v || '不管') + '</div>' +
        '<div class="set"><label>早上几点以后才能冒险</label>' + seg('to', ['06:30', '07:00', '07:30', '08:00'], clockTxt) + '</div>' +
        '<div class="set"><label>多学一点换时间，每天最多</label>' + seg('max', [0, 30, 60], v => v ? '+' + v + ' 分钟' : '不奖励') + '<small>多做一轮复习、多完成一个聊天目标、多通关一关新练习（或拿到更多星星），每样 +10 分钟。</small></div>' : '') +
      '<button class="btn wide" data-act="setBack" data-focus>完成</button>');
  }

  // ---------- 家长密码（家长 2026-10-07，评估第 4 条）----------
  // APK：密码打包时写在 echo.properties 的 PARENT_PIN，原生只存加盐哈希：EchoNative.hasPin() / checkPin(pin) / pinStatus()，
  //      错 5 次锁 10 分钟（原生管，换时间也没用）。安装包里没有密码时一律拒绝（不再「谁先点谁设」）。
  // 网页版（没有原生桥）：沿用 S.settings.pin，第一次要用时由家长设；错 5 次锁 10 分钟（S.settings.pinLock）。
  // 输入用自己画的数字键盘，显示 ●。输对以后 2 分钟内、这个弹窗没关之前，接着改别的不用再输（RT.parentUntil）。
  // parentOk(why, onOk)：
  //   - 给了 onOk（推荐）：要输密码就弹键盘、马上返回 false，输对了调 onOk()；不用输（刚输过）就直接调 onOk() 并返回 true。
  //   - 没给 onOk（talk.js 的老写法 `if (!G.parentOk('…')) return;`）：弹键盘、返回 false；输对以后把刚才点的那个按钮
  //     （data-act）再执行一次，这一次 parentOk 返回 true。
  const PIN_TRIES = 5, PIN_LOCK = 10 * 60e3;
  const nativePin = () => { try { return !!(window.EchoNative && typeof EchoNative.hasPin === 'function'); } catch (e) { return false; } };
  // 销售版的 APK（EchoNative.setPin）：打包时没有密码，家长在首次设置向导里设、在家长设置里改（sales = true）
  const salesPin = () => !!(window.DEX && DEX.sales) && nat('setPin');
  function pinState() {
    if (nativePin()) {
      let st = {}, has = false;
      try { has = !!EchoNative.hasPin(); st = JSON.parse(EchoNative.pinStatus ? EchoNative.pinStatus() : '{}') || {}; } catch (e) { /* 读不到就当没锁 */ }
      return { native: true, sales: salesPin(), has, locked: !!st.locked, waitSec: st.waitSec || 0, triesLeft: st.triesLeft != null ? st.triesLeft : PIN_TRIES, lockouts: st.lockouts || 0 };
    }
    const lk = S.settings.pinLock || {}, wait = Math.max(0, (lk.until || 0) - Date.now());
    return { native: false, sales: false, has: /^\d{4}$/.test(S.settings.pin || ''), locked: wait > 0, waitSec: Math.ceil(wait / 1000), triesLeft: wait > 0 ? 0 : PIN_TRIES - (lk.n || 0), lockouts: lk.lockouts || 0 };
  }
  // 存新的家长密码：APK 交给原生（只有销售版能设，存加盐哈希；改密码要刚输对过），网页版存在存档里
  function pinSave(v) {
    if (nativePin()) { try { return salesPin() && !!EchoNative.setPin(v); } catch (e) { return false; } }
    S.settings.pin = v; S.settings.pinLock = { n: 0, until: 0, lockouts: (S.settings.pinLock || {}).lockouts || 0 }; save();
    return true;
  }
  function parentOk(why, onOk) {
    const now = Date.now();
    // 刚输过密码：只在那个家长弹窗（设置页）还开着时算数——弹窗关了、或者根本没弹窗，就要重新输
    if ((now < RT.parentUntil && !$('#modal').hidden) || (RT.pinPass && RT.pinPass.why === why && now < RT.pinPass.until)) {
      RT.pinPass = null;
      if (RT.parentUntil) RT.parentUntil = now + 2 * 60e3;
      if (onOk) onOk();
      return true;
    }
    const st = pinState();
    if (st.native && !st.has && st.sales) { pinPad(why, onOk, 'set1', !onOk && RT.lastAct && now - RT.lastAct.t < 2000 ? RT.lastAct : null); return false; }   // 销售版还没设密码（向导没做完）：现在设
    if (st.native && !st.has) {
      openModal('<div class="big">🔑</div><h2>还没有家长密码</h2><p>这个安装包打包时没有设家长密码，「' + esc(why || '这个设置') + '」现在改不了。</p>' +
        '<p class="tip">请家长在电脑上的 android/echo.properties 里写 PARENT_PIN（4 位数字），重新打包安装（存档不会丢）。</p><button class="btn wide" data-act="close" data-focus>知道了</button>');
      return false;
    }
    const redo = !onOk && RT.lastAct && now - RT.lastAct.t < 2000 ? RT.lastAct : null;
    pinPad(why, onOk, st.has ? 'check' : 'set1', redo);
    return false;
  }
  function pinPad(why, onOk, mode, redo) {
    RT.pin = { why: why || '', onOk: onOk || null, redo: redo || null, mode: mode || 'check', buf: '', first: '', msg: mode === 'set1' && !pinState().has ? '第一次用：请家长设一个 4 位数字密码，别告诉孩子' : '' };
    pinRender();
  }
  function pinRender(shake) {
    const p = RT.pin; if (!p) return;
    const st = pinState(), locked = p.mode === 'check' && st.locked;
    if (locked) p.msg = '输错太多次了，' + Math.max(1, Math.ceil(st.waitSec / 60)) + ' 分钟后再试';
    const t = p.mode === 'set1' ? '设一个 4 位数字的家长密码' : p.mode === 'set2' ? '再输一遍，确认一下' : '请家长输入 4 位密码';
    const dis = locked ? ' disabled' : '';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'].map(k =>
      k === 'clr' ? '<button class="pin-k fn" data-act="pinClr"' + dis + '>清除</button>'
        : k === 'del' ? '<button class="pin-k fn" data-act="pinDel" aria-label="删掉一位"' + dis + '>⌫</button>'
          : '<button class="pin-k" data-act="pinKey" data-k="' + k + '"' + dis + '>' + k + '</button>').join('');
    openModal('<div class="pin"><div class="pin-ico">🔒</div><h2>家长密码</h2>' + (p.why ? '<p class="pin-why">' + esc(p.why) + '</p>' : '') +
      '<p class="pin-t">' + t + '</p><div class="pin-dots' + (shake ? ' shake' : '') + '" id="pin-dots"></div><p class="pin-msg" id="pin-msg"></p>' +
      '<div class="pin-pad" id="pin-pad">' + keys + '</div></div><button class="btn ghost wide" data-act="close">取消</button>');
    pinUpd();
  }
  function pinUpd() {
    const p = RT.pin, d = $('#pin-dots'), m = $('#pin-msg');
    if (!p || !d) return;
    d.innerHTML = range(4).map(i => '<i class="' + (i < p.buf.length ? 'on' : '') + '">' + (i < p.buf.length ? '●' : '○') + '</i>').join('');
    d.setAttribute('aria-label', '已经输了 ' + p.buf.length + ' 位');
    if (m) m.textContent = p.msg || '';
  }
  function pinKey(k) {
    const p = RT.pin;
    if (!p || !/^\d$/.test(k) || p.buf.length >= 4 || p.busy) return;
    if (p.mode === 'check' && pinState().locked) { pinRender(true); return; }
    p.buf += k; p.msg = ''; pinUpd();
    if (p.buf.length === 4) { p.busy = true; setTimeout(() => { p.busy = false; if (RT.pin === p) pinDone(); }, 150); }
  }
  function pinDone() {
    const p = RT.pin; if (!p || p.buf.length < 4) return;
    const v = p.buf; p.buf = '';
    if (p.mode === 'set1') {
      // 销售版：太好猜的密码（1111、1234……）不要
      if (window.DEX && DEX.sales && (/^(\d)\1{3}$/.test(v) || '0123456789'.includes(v) || '9876543210'.includes(v))) { p.msg = '这个密码太好猜了，换一个吧'; pinRender(true); return; }
      p.first = v; p.mode = 'set2'; p.msg = ''; pinRender(); return;
    }
    if (p.mode === 'set2') {
      if (v !== p.first) { p.mode = 'set1'; p.first = ''; p.msg = '两次不一样，重新设一次'; pinRender(true); return; }
      if (!pinSave(v)) { RT.pin = null; closeModal(); toast('密码没改成：要先输对旧密码，2 分钟内改完。再点一次「改密码」'); return; }
      toast('🔑 家长密码设好了，别告诉孩子哦');
      pinGrant(p); return;
    }
    const r = pinCheck(v);
    if (r.ok) { pinGrant(p); return; }
    p.msg = r.locked ? '输错太多次了，' + r.min + ' 分钟后再试' : '密码不对，还能试 ' + r.left + ' 次';
    pinRender(true);
  }
  // 核对密码；输错记进今天的日志（周报「家长密码输错几次、被锁几次」）
  function pinCheck(v) {
    const L = dayLog();
    if (nativePin()) {
      const before = pinState();
      if (before.locked) return { ok: false, locked: true, min: Math.max(1, Math.ceil(before.waitSec / 60)) };
      let ok = false;
      try { ok = !!EchoNative.checkPin(v); } catch (e) { ok = false; }
      if (ok) return { ok: true };
      L.pinFail = (L.pinFail || 0) + 1;
      const st = pinState();
      if (st.locked) { L.pinLock = (L.pinLock || 0) + 1; save(); return { ok: false, locked: true, min: Math.max(1, Math.ceil(st.waitSec / 60)) }; }
      save();
      return { ok: false, left: st.triesLeft };
    }
    const lk = S.settings.pinLock = Object.assign({ n: 0, until: 0, lockouts: 0 }, S.settings.pinLock);
    if (lk.until > Date.now()) return { ok: false, locked: true, min: Math.max(1, Math.ceil((lk.until - Date.now()) / 60e3)) };
    if (v === S.settings.pin) { lk.n = 0; save(); return { ok: true }; }
    lk.n++; L.pinFail = (L.pinFail || 0) + 1;
    if (lk.n >= PIN_TRIES) { lk.n = 0; lk.until = Date.now() + PIN_LOCK; lk.lockouts++; L.pinLock = (L.pinLock || 0) + 1; save(); return { ok: false, locked: true, min: PIN_LOCK / 60e3 }; }
    save();
    return { ok: false, left: PIN_TRIES - lk.n };
  }
  function pinGrant(p) {
    closeModal();
    RT.parentUntil = Date.now() + 2 * 60e3;   // 2 分钟内、弹窗没关之前，接着改别的不用再输
    // 做完以后没有弹窗开着（比如「从今天重新开始」直接回首页、换密钥用的是系统输入框）：家长这一次就结束了，
    // 不留 2 分钟的空窗给孩子接着点
    const done = () => { if ($('#modal').hidden) RT.parentUntil = 0; };
    if (p.onOk) { try { p.onOk(); } finally { done(); } return; }
    const f = p.redo && ACT[p.redo.act];
    // 找不到刚才的按钮：只放行「同一件事」30 秒（再点一次那个按钮），别的家长设置照样要密码
    if (!f) { RT.parentUntil = 0; RT.pinPass = { why: p.why, until: Date.now() + 30e3 }; toast('密码对了，再点一次刚才的按钮'); return; }
    RT.pinPass = { why: p.why, until: Date.now() + 5000 };
    try { f(p.redo.el); } finally { RT.pinPass = null; done(); }
  }

  // ---------- 学习周报（孩子截图发给家长；家长 2026-10-07：要看得出能力有没有进步、要讲实话，评估第 12 条）----------
  function revText(e) {
    if (e.k === 'free') return [e.en, e.zh];
    const w = WX[e.w], it = w && (e.k === 'word' ? w.words[e.i] : e.k === 'sent' ? w.sents[e.i] : w.dlgs[e.i]);
    if (!it) return ['', ''];
    return e.k === 'dlg' ? ['问：' + it[0] + ' 答：' + it[1], ''] : [it[0], it[1]];
  }
  const r1 = x => Math.round(x * 10) / 10;
  const pct = x => (x == null ? null : Math.round(x * 100));
  // 最近 n 天的日期（最后一天是今天）
  const daysBack = n => range(n).map(k => { const d = new Date(); d.setDate(d.getDate() - (n - 1) + k); return dayStr(d); });
  // AI 花费估算（元）：单价按阿里云百炼的公开价估（会变，只让家长心里有数）。实时聊天（其中音频另算）和文字模型的 token
  // 只有 APK 直连时数得到（talk.js 记的）；口语识别按秒算（recognize 记的 asrSec）。
  // 实时聊天 qwen3.8-omni-flash-realtime 北京区（2026-10-07 在阿里云官网复核）：每百万 token 文本输入 ¥1.5、输出 ¥4.5，音频输入 ¥6、输出 ¥12；
  // 文字模型（评价、打勾、翻译、点评）qwen-plus 每百万 token 输入 ¥0.8、输出 ¥2
  const PRICE = { chatIn: 0.0015, chatAudioIn: 0.006, chatOut: 0.0045, chatAudioOut: 0.012, textIn: 0.0008, textOut: 0.002, asrSec: 0.00022 };   // 元 / 千 token、元 / 秒
  function aiCost(sum) {
    const ain = sum('aiChatAudioIn'), aout = sum('aiChatAudioOut');
    return (Math.max(0, sum('aiChatIn') - ain) * PRICE.chatIn + ain * PRICE.chatAudioIn + Math.max(0, sum('aiChatOut') - aout) * PRICE.chatOut + aout * PRICE.chatAudioOut +
      sum('aiTextIn') * PRICE.textIn + sum('aiTextOut') * PRICE.textOut) / 1000 + sum('asrSec') * PRICE.asrSec;
  }
  // 一段日子的统计：学习日（✅ 真做完 + 🟡 聊天整天免了）、能力指标（每句几个词、一次说对率、隔一周还记得）、AI 花费
  function weekStats(days) {
    const L = days.map(d => (S.log && S.log[d]) || null), has = L.filter(Boolean);
    const sum = k => has.reduce((a, x) => a + (+x[k] || 0), 0);
    const ratio = (a, b) => (b ? a / b : null);
    return {
      L, sum, n: k => has.filter(x => x[k]).length,
      study: has.filter(x => x.gateOpen || x.gateEx).length,
      wpl: ratio(sum('voiceWords'), sum('voiceLines')),
      first: ratio(sum('spk1'), sum('spkQ')),
      week: ratio(sum('weekOk'), sum('weekN')),
      cost: aiCost(sum),
    };
  }
  // 每天的标记：✅ 学习任务真做完了 🟡 聊天这一项整天免了 📵 断网放行 🔓 关过学习锁 ⏰ 手机日期被改过 / 家长重设 🌙 很晚还在冒险
  const dayMarks = x => (x.gateOpen ? '✅' : x.gateEx ? '🟡' : '') + (x.passAt ? '📵' : '') + (x.gateOff ? '🔓' : '') + (x.clockBack || x.clockReset ? '⏰' : '') + (x.night ? '🌙' : '');
  const EX_TXT = { noai: 'AI 聊天没开通', daily: '聊天时间用完了' };
  const arrow = (a, b, eps) => (a == null || b == null ? '' : a > b + eps ? '<i class="up">↑</i>' : a < b - eps ? '<i class="dn">↓</i>' : '<i class="eq">→</i>');
  // 诊断一行：AI 失败几次（没网 / 密钥和额度）、聊天连不上几天、程序出错几条（EchoErr）、画面重开过几次（原生 diag）、版本号
  function diagLine(W0) {
    const fails = W0.sum('aiFail'), chatErr = W0.n('chatErr'), errs = window.EchoErr ? EchoErr.count(7) : 0;
    let gone = 0; try { if (nat('diag')) gone = +(JSON.parse(EchoNative.diag() || '{}').renderGone || 0); } catch (e) { /* 老版本的原生没有 diag() */ }
    return 'AI 出错 ' + fails + ' 次' + (fails ? '（没网 ' + W0.sum('aiNet') + ' · 密钥/额度 ' + W0.sum('aiKey') + '）' : '') + (chatErr ? ' · 聊天连不上 ' + chatErr + ' 天' : '') +
      ' · 程序出错 ' + errs + ' 条' + (W0.sum('glLost') ? ' · 3D 画面丢过 ' + W0.sum('glLost') + ' 次' : '') + (gone ? ' · 画面重开过 ' + gone + ' 次' : '') + ' · ' + verText();
  }
  function reportSheet() {
    weeklyRoll();
    const days = daysBack(7), W0 = weekStats(days), W1 = weekStats(daysBack(14).slice(0, 7));
    const L = W0.L.map(x => x || {}), sum = W0.sum;
    const first = Object.keys(S.log || {}).sort()[0] || days[6];
    const maxMin = Math.max(20, ...L.map(x => x.min || 0));
    const wk = ['日', '一', '二', '三', '四', '五', '六'];
    const heavy = x => (x.play || 0) >= 30 && (x.play || 0) > 3 * (x.learn || 0);   // 冒险超过学习的 3 倍
    const bars = days.map((d, k) => {
      const x = L[k], lh = (x.learn || 0) / maxMin * 100, ph = (x.play || 0) / maxMin * 100, other = Math.max(0, (x.min || 0) - (x.learn || 0) - (x.play || 0)) / maxMin * 100, dt = new Date(d.replace(/-/g, '/'));
      return '<div class="rp-day"><em>' + (dayMarks(x) || '&nbsp;') + '</em><div class="rp-bar"><i class="o" style="height:' + other + '%"></i><i class="p" style="height:' + ph + '%"></i><i class="l" style="height:' + lh + '%"></i></div>' +
        '<b' + (heavy(x) ? ' class="warn" title="冒险超过学习的 3 倍"' : '') + '>' + (d < first ? '–' : Math.round(x.min || 0)) + '</b><small>' + (k === 6 ? '今天' : '周' + wk[dt.getDay()]) + '</small></div>';
    }).join('');
    const t0 = new Date(days[0].replace(/-/g, '/')).getTime();
    const chats = ((S.talk && S.talk.log) || []).filter(r => r.t >= t0);
    const rated = chats.filter(r => r.eval), avg = rated.length ? (rated.reduce((a, r) => a + r.eval.stars, 0) / rated.length).toFixed(1) : '';
    const chatMin = Math.round(chats.reduce((a, r) => a + (r.sec || 0), 0) / 60);
    const tips = []; chats.forEach(r => (r.eval && r.eval.tips || []).forEach(t => { if (tips.length < 3 && !tips.some(x => x.better === t.better)) tips.push(t); }));
    const items = Object.values(S.rev.items), mastered = items.filter(e => !e.due).length;
    const top = items.filter(e => e.x > 1 && e.due).sort((a, b) => b.x - a.x).slice(0, 4).map(e => { const [en, zh] = revText(e); return en ? '<li><b>' + esc(en) + '</b> <small>' + esc(zh) + ' · 错 ' + e.x + ' 次</small></li>' : ''; }).join('');
    const cu = curUnit(), cwi = cu ? NB + curIdx() : -1, ustars = cu ? range(7).reduce((a, l) => a + (S.stars[cwi + '-' + l] || 0), 0) : 0;
    const name = S.player && S.player.name;
    const exWhy = [...new Set(L.filter(x => x.gateEx).map(x => EX_TXT[x.gateEx] || x.gateEx))].join('、');
    const heavyN = L.filter(heavy).length, nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    const flags = [
      W0.n('gateOff') ? '🔓 ' + W0.n('gateOff') + ' 天关过学习锁' : '',
      W0.n('clockBack') ? '⏰ 手机日期被改过' : '',
      W0.n('clockReset') ? '⏰ 家长重设过日期' : '',
      W0.n('passAt') ? '📵 断网放行 ' + W0.n('passAt') + ' 天' : '',
      W0.n('gateEx') ? '🟡 聊天免了 ' + W0.n('gateEx') + ' 天（' + exWhy + '）' : '',
      W0.n('night') ? '🌙 ' + W0.n('night') + ' 天很晚还在冒险' : '',
      heavyN ? '冒险超过学习 3 倍 ' + heavyN + ' 天' : '',
      sum('pinFail') ? '🔑 家长密码输错 ' + sum('pinFail') + ' 次' + (sum('pinLock') ? '（锁住 ' + sum('pinLock') + ' 次）' : '') : '',
      W0.n('reset') ? '🧹 清空过进度' : '',
      W0.n('restore') ? '🗂️ 从备份恢复过存档' : '',
      window.ECHO_APP && !(window.EchoTalk && EchoTalk.relayUrl()) ? '⚠️ AI 聊天没开通' : '',
      // AI 打分用不了（评估第 3 条）：额度 / 密钥出问题的天数、没网的天数、先跳过了几题、麦克风被拒
      W0.n('aiKey') ? '💳 AI 额度或密钥出问题 ' + W0.n('aiKey') + ' 天' : '',
      W0.n('aiNet') ? '📶 AI 连不上网 ' + W0.n('aiNet') + ' 天' : '',
      sum('aiSkip') ? '⏭️ AI 用不了先跳过 ' + sum('aiSkip') + ' 题（都在复习里）' : '',
      sum('micDeny') ? '🎤 麦克风被拒 ' + sum('micDeny') + ' 次' : '',
    ].filter(Boolean).join(' · ');
    const pctS = x => (x == null ? '–' : pct(x) + '%');
    const ability = '<p class="rp-ab">💪 <b>能力</b>（和上周比）：每句 ' + (W0.wpl == null ? '–' : r1(W0.wpl)) + ' 个词' + arrow(W0.wpl, W1.wpl, 0.2) +
      ' · 一次说对 ' + pctS(W0.first) + arrow(pct(W0.first), pct(W1.first), 2) + ' · 隔一周还记得 ' + pctS(W0.week) + arrow(pct(W0.week), pct(W1.week), 2) + '</p>';
    const maxW = Math.max(0, ...L.map(x => x.voiceMax || 0));
    const habit = '<p class="rp-line">🔥 不看字说对 <b>' + sum('recall') + '</b> 句' + (sum('recallW') ? '（另有 ' + sum('recallW') + ' 个词）' : '') + ' · 💡 带提示 ' + sum('aided') + ' 次 · 🗣️ 聊天开口 ' + sum('voiceLines') + ' 句' + (maxW ? '（最长一句 ' + maxW + ' 个词）' : '') +
      (sum('chatSaidZh') ? ' · 说中文 ' + sum('chatSaidZh') + ' 句' : '') + ' · 看中文 ' + (sum('chatZh') + sum('zhTaps')) + ' 次 · 帮帮我 ' + sum('chatHelp') + ' 次</p>';
    const hist = (S.weekly || []).slice(-6);
    const histLine = hist.length >= 2 ? '<h3>最近几周</h3><p class="rp-line">📈 学习日 ' + hist.map(r => r.d).join(' · ') + '　🔥 不看字说对 ' + hist.map(r => r.rc || 0).join(' · ') + '</p>' : '';
    const cost = W0.cost, costTxt = cost <= 0 ? '0' : cost < 0.01 ? '不到 0.01' : cost.toFixed(2);
    const tile = (n, t) => '<div class="rp-tile"><b>' + n + '</b><small>' + t + '</small></div>';
    openModal('<div class="report"><h2>📊 ' + (name ? esc(name) + ' 的' : '我的') + '学习周报</h2>' +
      '<p class="rp-sub">' + days[0].slice(5).replace('-', '/') + ' – ' + days[6].slice(5).replace('-', '/') + ' · 学习日 <b>' + W0.study + '/7</b>' + (first > days[0] ? '（' + first.slice(5).replace('-', '/') + ' 开始记录）' : '') + '</p>' +
      (flags ? '<p class="rp-warn">' + flags + '</p>' : '') +
      (nc ? '<p class="rp-warn rp-concern">👪 有 ' + nc + ' 段聊天需要家长看看（设置 → 🔒 家长设置 → 聊天安全，要家长密码）</p>' : '') +
      '<div class="rp-chart">' + bars + '</div><p class="rp-legend">每天几分钟：<i class="l"></i>学习 ' + Math.round(sum('learn')) + ' <i class="p"></i>冒险 ' + Math.round(sum('play')) + ' <i class="o"></i>翻菜单　✅ 完成 🟡 免聊天 📵 断网放行 🔓 关锁 ⏰ 改日期 🌙 很晚</p>' +
      ability +
      '<div class="rp-tiles">' + tile(Math.max(0, sum('levels') - sum('revSess')), '完成关卡') + tile(sum('spoken'), '开口说对') + tile(sum('review'), '复习答对') +
      tile(chats.length, 'AI 聊天 ' + chatMin + ' 分钟' + (avg ? ' · ' + avg + '★' : '')) + tile(sum('fresh'), '新学的词句') + tile(mastered, '累计掌握') + '</div>' +
      habit +
      (cu ? '<p class="rp-line">📗 正在学 <b>' + esc(cu.bshort + ' Unit ' + cu.n + ' ' + cu.en) + '</b> · ★ ' + ustars + '/21 · 这周答错 ' + sum('wrongs') + ' 次（都进了复习）</p>' : '') +
      '<div class="rp-more">' +
      (top ? '<h3>最容易错的（累计）</h3><ul class="rp-list">' + top + '</ul>' : '') +
      (tips.length ? '<h3>聊天里 AI 改过的句子</h3><ul class="rp-list">' + tips.map(t => '<li><s>' + esc(t.said) + '</s> → <b>' + esc(t.better) + '</b></li>').join('') + '</ul>' : '') +
      histLine +
      '</div><p class="rp-diag">💰 本周 AI 花费约 ¥' + costTxt + (window.ECHO_APP ? '' : '（网页版的聊天费用记在中转服务那边）') + ' · 🔧 ' + esc(diagLine(W0)) + '</p>' +
      '<div class="rp-end"><span>📸 截个图发给家长吧！</span><button class="btn small ghost" data-act="close">关闭</button></div></div>');
  }

  // ---------- 每周一行，永久保留（S.weekly）----------
  // S.log 只留 45 天；每周（周一到周日）的关键数字压成一行存进 S.weekly，三年也就一百多行。过完的周算一次就不再改（那时 7 天的记录都还在）。
  // 一行：w 周一的日期、d 学习日、l 学习分钟、p 冒险分钟、lv 完成关卡、s 开口说对、r 复习答对、rc 不看字说对、a 带提示、v 聊天语音句数、
  // g 聊天目标、wpl 每句几个词、f1 一次说对 %、wk 隔一周还记得 %、pass 断网放行天数、off 关锁天数、y AI 花费（元）、m 累计掌握、fin 这周过完了、part 这周的记录不全
  function weekStart(d) { const x = new Date(d.replace(/-/g, '/')); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dayStr(x); }
  function weekRow(ws) {
    const days = range(7).map(k => { const x = new Date(ws.replace(/-/g, '/')); x.setDate(x.getDate() + k); return dayStr(x); });
    const st = weekStats(days), s = st.sum;
    return {
      w: ws, d: st.study, l: Math.round(s('learn')), p: Math.round(s('play')), lv: Math.max(0, s('levels') - s('revSess')), s: s('spoken'), r: s('review'),
      rc: s('recall'), a: s('aided'), v: s('voiceLines'), g: s('chatGoals'), wpl: st.wpl == null ? null : r1(st.wpl), f1: pct(st.first), wk: pct(st.week),
      pass: st.n('passAt'), off: st.n('gateOff'), y: +st.cost.toFixed(2),
    };
  }
  function weeklyRoll() {
    if (!Array.isArray(S.weekly)) S.weekly = [];
    const today = dayStr(), cur = weekStart(today), logDays = Object.keys(S.log || {}).filter(d => d <= today).sort();
    for (const ws of new Set(logDays.map(weekStart))) {
      const i = S.weekly.findIndex(r => r.w === ws), old = i >= 0 ? S.weekly[i] : null;
      if (old && old.fin) continue;
      const row = weekRow(ws);
      if (logDays[0] > ws) row.part = 1;
      if (ws < cur) { row.fin = 1; if (old && old.m != null) row.m = old.m; }
      else row.m = Object.values(S.rev.items).filter(e => !e.due).length;
      if (old) S.weekly[i] = row; else S.weekly.push(row);
    }
    S.weekly.sort((a, b) => a.w.localeCompare(b.w));
  }

  // ---------- 学习日报推送到家长微信（可选，默认不发；家长 2026-10-07，评估第 12 条）----------
  // 家长设置里填 PushPlus 的 token（32 位），或者企业微信群机器人的 webhook 地址（改要家长密码）。每天 20 点以后发一条当天的小结；
  // 没网 / 那天晚上没开游戏，就等下次打开时补发（第二天早上补前一天的）。聊天内容不发，有安全标记的聊天只提示一句。
  // 原生桥以后加了 pushPost(url, body, type)（只许连这两个地址）就走原生；现在用 fetch（no-cors：看不到回执，发出去就算）
  function pushKind(v) {
    v = String(v || '').trim();
    if (/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[\w-]+$/.test(v)) return 'wecom';
    if (/^[0-9a-f]{32}$/i.test(v)) return 'pushplus';
    return '';
  }
  function daySummary(d) {
    const x = (S.log && S.log[d]) || {}, name = S.player && S.player.name, dt = new Date(d.replace(/-/g, '/')), m = n => Math.round(n || 0);
    const status = x.gateOpen ? '✅ 学习任务完成了' : x.gateEx ? '🟡 复习做完了（聊天这一项免了：' + (EX_TXT[x.gateEx] || x.gateEx) + '）'
      : x.passAt ? '📵 ' + (x.passWhy === 'daily' ? '聊天时间用完了（没怎么开口）' : x.passWhy === 'fail' ? '聊天连不上' : '没网') + '，先临时冒险了 ' + PASS_MIN + ' 分钟（聊天没做）' : x.gateOff ? '🔓 学习锁关着' : '⬜ 学习任务还没完成';
    const lines = [status,
      '⏱️ 学习 ' + m(x.learn) + ' 分钟 · 冒险 ' + m(x.play) + ' 分钟',
      '📕 复习答对 ' + (x.review || 0) + ' 题 · 🎤 开口说对 ' + (x.spoken || 0) + ' 次 · 🔥 不看字说对 ' + (x.recall || 0) + ' 句',
      '🗣️ 和岛民聊天 ' + (x.chats || 0) + ' 段，用语音说了 ' + (x.voiceLines || 0) + ' 句英语' + (x.voiceMax ? '（最长一句 ' + x.voiceMax + ' 个词）' : '') + (x.chatGoals ? '，完成 ' + x.chatGoals + ' 个小目标' : ''),
    ];
    const warn = [x.gateOff ? '🔓 关过学习锁' : '', x.clockBack ? '⏰ 手机日期被改过' : '', x.night ? '🌙 很晚还在冒险' : '',
      x.aiKey ? (x.aiKeyWhy === 'quota' ? '💳 AI 额度用完了' : x.aiKeyWhy === 'busy' ? '⏳ AI 太忙' : '🔑 AI 密钥不对') : x.aiNoKey ? '🔑 还没有 AI 密钥' : '',
      x.aiSkip ? '⏭️ AI 用不了先跳过 ' + x.aiSkip + ' 题' : '',
      x.pinLock ? '🔑 家长密码输错太多次被锁了' : x.pinFail ? '🔑 家长密码输错 ' + x.pinFail + ' 次' : ''].filter(Boolean);
    if (warn.length) lines.push('⚠️ ' + warn.join(' · '));
    const nc = window.EchoTalk && EchoTalk.concerns ? EchoTalk.concerns() : 0;
    if (nc) lines.push('👪 有 ' + nc + ' 段聊天需要家长看看（游戏里：设置 → 🔒 家长设置 → 聊天安全）');
    lines.push('—— ' + verText());
    return { title: '回声岛日报 ' + d.slice(5).replace('-', '/') + '（周' + '日一二三四五六'[dt.getDay()] + '）' + (name ? ' · ' + name : ''), text: lines.join('\n') };
  }
  function pushSend(title, text, to) {
    const v = String(to != null ? to : S.settings.push || '').trim(), kind = pushKind(v);
    if (!kind) return Promise.resolve(false);
    const req = kind === 'wecom'
      ? { url: v, type: 'text/plain;charset=UTF-8', body: JSON.stringify({ msgtype: 'text', text: { content: title + '\n' + text } }) }
      : { url: 'https://www.pushplus.plus/send', type: 'application/x-www-form-urlencoded;charset=UTF-8', body: new URLSearchParams({ token: v, title, content: esc(text).replace(/\n/g, '<br>'), template: 'html' }).toString() };
    try { if (window.EchoNative && typeof EchoNative.pushPost === 'function') return Promise.resolve(!!EchoNative.pushPost(req.url, req.body, req.type)); } catch (e) { /* 原生不行就用 fetch */ }
    if (typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(req.url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': req.type }, body: req.body }).then(() => true, () => false);
  }
  function pushTick() {
    try {
      if (!S || !pushKind(S.settings.push) || navigator.onLine === false || RT.pushBusy || Date.now() - RT.pushTry < 5 * 60e3) return;
      const now = nowD(), y = new Date(now); y.setDate(y.getDate() - 1);
      const want = now.getHours() >= 20 ? dayStr(now) : dayStr(y);
      if (!S.push || typeof S.push !== 'object') S.push = { sent: '' };
      if ((S.push.sent || '') >= want) return;
      if (!S.log || !S.log[want]) { S.push.sent = want; save(); return; }   // 那天没开过游戏：不发
      RT.pushTry = Date.now(); RT.pushBusy = true;
      const msg = daySummary(want);
      pushSend(msg.title, msg.text).then(ok => { RT.pushBusy = false; if (ok) { S.push.sent = want; S.push.at = Date.now(); save(); } });
    } catch (e) { RT.pushBusy = false; }
  }
  function pushSheet() {
    const v = S.settings.push || '';
    openModal('<h2>📲 学习日报发到微信</h2><p>每天晚上 8 点以后，把孩子当天的学习小结（学了多久、冒险多久、开口说了几句、学习任务完成没有）发一条到家长微信。默认不发。两种方式选一种：</p>' +
      '<ul class="push-how"><li><b>PushPlus</b>：微信关注「pushplus 推送加」，在它的网站上复制你的 token（32 位）。</li>' +
      '<li><b>企业微信群机器人</b>：企业微信的群 → 群设置 → 群机器人 → 添加，复制 webhook 地址（https://qyapi.weixin.qq.com/… 开头）。</li></ul>' +
      '<input id="push-in" class="txt-in" autocomplete="off" spellcheck="false" placeholder="PushPlus token 或机器人地址" value="' + esc(v) + '">' +
      '<p class="tip">聊天的内容不会发出去；有需要家长看看的聊天，只提示一句。没网时等联网后补发。</p>' +
      '<div class="row"><button class="btn ghost" data-act="pushTest">发一条试试</button><button class="btn" data-act="pushSave">保存</button></div>' +
      (v ? '<button class="btn ghost wide" data-act="pushOff">不发了</button>' : '<button class="btn ghost wide" data-act="setBack">返回</button>'));
  }

  // 安卓 APK：竖屏 / 横屏 / 跟着手机转（原生那边记住，下次打开直接用）
  function applyOrient() {
    try { if (window.EchoNative && EchoNative.setOrientation) EchoNative.setOrientation(S.settings.orient || 'portrait'); } catch (e) { /* 忽略 */ }
  }

  // 测试用：课本出题来源、每日复习
  window.EchoGame = { src: z => src(z), dueList: () => dueList(), revAddFree: (en, zh) => revAddFree(en, zh), revRight: (q, r) => revRight(q, r), curIdx: () => curIdx(), curUnit: () => curUnit(), gate: () => gate(), dayLog: d => dayLog(d), reportSheet: () => reportSheet(), say: (t, r, g) => say(t, r, g), goHome: t => goHome(t), closeModal: () => closeModal(), get S() { return S; } };
  // 测试用：打分（tests/review.test.js）、复习排期引擎、直接出指定的题（[题型, 编号, 第几条] 的列表）
  Object.assign(window.EchoGame, {
    speech: { scoreSpeech, bestScore, earlyMatch, recognize: (on, tg) => recognize(on, tg) },
    rev: { pick: revPick, right: revRight, wrong: revWrong, miss: revMiss, build: () => buildReview(), due: () => dueList(), day: () => revDay(), fade: fadeOf, cue: cueText, addFree: revAddFree, trim: revTrim, key: revKey,
      K: { GAP, REV_N, REV_MAX, REV_NEW, REV_BACKLOG, REV_FIELD } },
    playQs: (list, review) => startLevel(NB, 0, !!review, list.map(([t, w, i]) => makeQ(t, w, i))),
    P: () => P,
    // 测试用（tests/gate.test.js）：学习锁、冒险时间、家长密码、周报、每周记录、日报推送
    T: {
      playInfo: () => playInfo(), advTick: () => advTick(), advStopWhy: () => advStopWhy(), advEnterOk: () => advEnterOk(), weeklyRoll: () => weeklyRoll(), pushTick: () => pushTick(),
      daySummary: d => daySummary(d), pinState: () => pinState(), parentOk: (why, f) => parentOk(why, f), settings: () => { RT.parentOpen = false; settingsSheet(); },
      // 假装现在是某个时刻（毫秒；0 = 用真的时间）：只影响冒险时间（几点、周几）和日报推送
      setNow: ms => { RT.fakeNow = ms || 0; RT.fakeAt = Date.now(); RT.pushTry = 0; },
      RT,
    },
    // 测试用（tests/apk.test.js）：AI 用不了的分类和出路、存档备份、新版本、第一次的小检查
    A: {
      down: () => aiDown(), noKey: () => aiNoKey(), bar: () => aiBarState(), note: (c, w) => aiNote(c, w), failOf: r => failOf(r), hint: r => failHint(r),
      check: () => checkSheet(), later: q => revLater(q), save: () => save(), bakMeta: () => bakMeta(), best: () => bestBackup(), exportSave: () => exportSave(),
      verCheck: () => verCheck(), myVer: () => myVer(), updNew: () => updNew(), homeBars: () => homeBars(), settings: () => { RT.parentOpen = true; settingsSheet(); },
    },
  });

  // ---------- 启动 ----------
  function start(data) {
    S = load(data && data.S);
    revMigrate();
    if (S.book.cur && S.book.at < 0) { S.book.at = S.book.cur - 1; delete S.book.cur; }
    applyOrient();
    trackDay();
    weeklyRoll();
    musicVol();
    if (window.MonsterGame) MonsterGame.migrate();
    if (window.EchoSetup) EchoSetup.apply(false);   // 销售版：家长设好的形象、伙伴（博士的包）、昵称
    // 链接带 ?quiet：不方便说话时，所有口语任务都改成按按钮（等同设置里的「录音自评」）
    if (/[?&](quiet|nomic)\b/.test(location.search)) { S.settings.mode = 'self'; save(); setTimeout(() => toast('🔇 不用说话模式：要说话的地方都变成按钮了'), 800); }
    checkStreak();
    ensureQuests();
    loadVoices();
    if (TTS.ok && 'onvoiceschanged' in speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
    setTimeout(() => { loadVoices(); TTS.loaded = true; }, 1500); // 一些安卓浏览器永远返回空列表
    // 字体在 assets/fonts（style.css 的 @font-face），不再连 Google（国内连不上，也让测试不稳）
    show('home');
    renderHome();
    // 存档读不出来（坏了）：告诉孩子用了哪份备份（评估第 7 条）
    let told = false;
    if (RT.restored) {
      told = true;
      setTimeout(() => openModal('<div class="big">🛟</div><h2>存档读不出来了</h2>' +
        (RT.restored === 'none' ? '<p>也没找到能用的备份，只好从头开始。</p>' : '<p>别担心，已经用<b>' + esc(RT.restored) + '</b>恢复了，最多少了最近一点点进度。</p>') +
        '<p class="tip">坏掉的那份另外存着没有删' + (RT.noSave ? '；这台设备的空间满了，这次的进度先不保存，请告诉家长' : '') + '。家长也可以在「设置 → 🔒 家长设置 → 💾 存档备份」里换一份备份。</p>' +
        '<button class="btn wide" data-act="restoredOk" data-focus>知道了</button>'), 400);
    }
    // 刚从备份恢复（restore 以后重新打开的）
    let rs = ''; try { rs = sessionStorage.getItem('echo-restored') || ''; sessionStorage.removeItem('echo-restored'); } catch (e) { /* 忽略 */ }
    if (rs) { dayLog().restore = 1; save(); setTimeout(() => toast('🗂️ 已经从备份恢复：' + rs), 500); }
    // 渲染进程挂了、原生刚重建过 WebView（评估第 15 条）
    try { if (nat('takeRecovered') && EchoNative.takeRecovered()) { if (window.EchoErr) EchoErr.log('app', '画面进程挂了，已经重新打开', 'native'); setTimeout(() => toast('刚才画面出了点问题，已经重新打开了，存档还在'), 600); } } catch (e) { /* 忽略 */ }
    // 销售版第一次打开：先做家长首次设置（家长密码、AI 密钥、家庭定制、设备检查），做完再给孩子看说明（afterSetup）
    if (window.EchoSetup && EchoSetup.needed()) setTimeout(() => EchoSetup.open(), 100);
    else if (!S.seenIntro) { if (!told) setTimeout(introSheet, 300); }   // 先说存档的事，「知道了」以后再看说明（restoredOk）
    // APK 第一次打开（或者从老版本升上来）：做一次「麦克风 + 网络 + 密钥」小检查
    else if (!told && window.ECHO_APP && !S.micCheck && speakMode() === 'sr') setTimeout(() => { if ($('#modal').hidden) checkSheet(); }, 900);
    setTimeout(pushTick, 4000);   // 打开游戏时补发没送到的日报（家长开了推送才会发）
    setTimeout(verCheck, 3000);   // 有没有新版本（只有 APK 查）
  }
  // 切到后台：隔 1 小时以上再往手机「下载/EchoIsland」写一份今天的备份（同一天覆盖同一份）
  // （只写手机里的备份，不另外存 localStorage：别把外面刚改过的存档盖掉）
  document.addEventListener('visibilitychange', () => { if (document.hidden && S && !RT.noSave && RT.bakDay && nat('backupWrite') && Date.now() - RT.natBakAt > 60 * 60e3) nativeBackup(); });
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S })); } catch (e) { /* 忽略 */ } }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})();
