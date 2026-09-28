// 回声岛 · 剧情脚本（设定见 STORY.md）
// 开场：博士介绍 → 选男孩女孩、起英文名 → 在家醒来、妈妈 → 博士被野生怪兽追 → 从博士的包里选伙伴 → 第一场战斗 → 博士道谢
// 1 号路：第一次遇到对手
// world.js 在进地图（enter）/ 走一步（step）/ 和人说话（talk）时来问要不要播剧情；hidden、look 可以藏起或换掉地图上的人
(function () {
  'use strict';
  const P = window.EchoPeople;
  const $ = id => document.getElementById(id);
  const NAMES = {
    boy: ['Tom', 'Jack', 'Sam', 'Ben', 'Max', 'Nick', 'Alex', 'Danny'],
    girl: ['Lily', 'Amy', 'Emma', 'Anna', 'Lucy', 'Kate', 'Grace', 'Sophie'],
  };
  const TYPE_EN = { fire: 'fire', water: 'water', grass: 'grass', spark: 'electric' };
  const TYPE_ZH = { fire: '火', water: '水', grass: '草', spark: '电' };
  const prof = (en, zh, x) => Object.assign({ who: 'Professor Echo', look: P.LOOKS.prof, g: 'f', en, zh }, x || {});
  const mom = (en, zh, x) => Object.assign({ who: 'Mom', look: P.LOOKS.mom, g: 'f', en, zh }, x || {});
  const nar = (en, zh) => ({ who: '旁白', emo: '📣', en, zh });

  // ---------- 开场：博士的介绍 ----------
  async function intro(C, short) {
    const E = C.E, sc = C.scene();
    sc.className = 'w-scene intro'; sc.hidden = false;
    sc.innerHTML = '<div class="in-light"></div><img class="in-prof" alt="" src="' + P.standing(P.LOOKS.prof, 240, 330) + '"><div class="in-mon" id="in-mon">' + Cartoon.monster(C.MG.species('bubbly')) + '</div>';
    await C.wait(400);
    if (short) await C.talk([prof('Oh! Hello again!', '哎呀，你好！'), prof('I never asked about you. Let me ask now.', '我之前忘了问你的情况，现在补上吧。')]);
    else {
      await C.talk([
        prof('Hello there! Welcome to the Echo Islands!', '你好呀！欢迎来到回声群岛！'),
        prof('My name is Echo. People call me Professor Echo.', '我叫回声，大家都叫我回声博士。'),
        prof('This world is full of monsters. And they understand English!', '这个世界住着许多怪兽，而且它们都听得懂英语！', { onShow: () => { const m = $('in-mon'); if (m) m.classList.add('on'); } }),
        prof('When you speak clearly, your monsters become strong.', '你的英语说得越清楚，你的怪兽就越强。'),
      ]);
    }
    // 男孩还是女孩
    const S = E.S;
    S.player = S.player || {};
    const card = (g, zh, en) => '<span class="ch-card"><img alt="" src="' + P.standing(P.LOOKS[g], 120, 170) + '"><b>' + zh + '</b><small>' + en + '</small></span>';
    await C.talk([prof('Now, tell me about yourself. Are you a boy or a girl?', '先说说你自己吧。你是男孩还是女孩？', {
      kind: 'choice',
      opts: [{ html: card('boy', '男孩', 'Boy') }, { html: card('girl', '女孩', 'Girl') }],
      pick: i => { S.player.gender = i ? 'girl' : 'boy'; E.save(); E.say(i ? "I'm a girl." : "I'm a boy."); return []; },
    })]);
    // 英文名
    const names = NAMES[S.player.gender] || NAMES.boy;
    await C.talk([prof("What's your name?", '你叫什么名字？选一个英文名，也可以自己输入。', {
      kind: 'custom',
      html: '<div class="nm-grid">' + names.map(n => '<button class="btn ghost nm" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<div class="nm-own"><input id="nm-in" maxlength="12" placeholder="自己输入英文名" autocomplete="off" autocapitalize="words" spellcheck="false"><button class="btn sun" id="nm-ok">好了</button></div><small class="tip" id="nm-tip">只能用英文字母，比如 Kevin、Coco</small>',
      mount: (el, done) => {
        const pickName = n => { S.player.name = n; E.save(); E.say(n); done([]); };
        el.addEventListener('click', e => {
          e.stopPropagation();
          const b = e.target.closest('.nm');
          if (b) pickName(b.dataset.n);
          if (e.target.id === 'nm-ok') {
            const v = ($('nm-in').value || '').trim().replace(/\s+/g, ' ');
            if (!/^[A-Za-z][A-Za-z ]{0,11}$/.test(v)) { $('nm-tip').textContent = '要用英文字母写哦，比如 Kevin'; return; }
            pickName(v.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' '));
          }
        });
      },
    })]);
    await C.talk([
      prof("Now say it to me: \"My name is {name}.\"", '跟我说一遍：My name is {name}.', { kind: 'speak', target: 'My name is {name}.' }),
      prof('{name}! What a nice name!', '{name}！真是个好名字！'),
    ]);
    if (!short) {
      await C.talk([
        prof("You just moved to Hello Island with your mom, right?", '你刚和妈妈搬到你好岛，对吧？'),
        prof('Your adventure starts today. See you soon!', '你的冒险今天就要开始了。一会儿见！'),
      ]);
    } else await C.talk([prof('Thank you, {name}! Good luck on your journey!', '谢谢你，{name}！旅途加油！')]);
    sc.classList.add('out');
    await C.wait(700);
    sc.hidden = true; sc.className = 'w-scene'; sc.innerHTML = '';
  }

  // ---------- 在家醒来 ----------
  async function wakeUp(C) {
    await intro(C, false);
    const m = C.npc(n => n.role === 'house');
    await C.wait(300);
    if (m) { C.face(m, 'up'); C.facePlayer('down'); }
    await C.talk([
      mom('Good morning, {name}! Did you sleep well?', '早上好，{name}！睡得好吗？'),
      mom('Today is a big day. Go and say hello to our neighbour, Professor Echo!', '今天是个大日子。去跟我们的邻居回声博士打个招呼吧！'),
      mom('Walk to the red mat and go outside.', '走到门口的红地垫，就能出门啦。'),
    ]);
    C.set('intro'); C.set('mom');
  }
  // 妈妈：还没有怪兽时提醒去找博士；有了怪兽就帮它们休息
  async function momTalk(C, m) {
    C.faceEach(m);
    if (!C.flag('starter')) { await C.talk([mom('Professor Echo lives next door. Go and say hello!', '回声博士就住在隔壁，快去打个招呼吧！')]); return; }
    await C.talk([
      mom('Welcome home, {name}! You look tired.', '欢迎回家，{name}！你看起来累了。'),
      mom('Let your monsters have a good rest.', '让你的怪兽们好好休息一下吧。', { onShow: () => { C.MG.healAll(); C.E.SFX.win(); C.E.toast('💖 怪兽们的体力都恢复了', 'gold'); } }),
      mom("Don't forget to eat well and sleep early!", '记得好好吃饭，早点睡觉！'),
    ]);
  }

  // ---------- 选伙伴画面（仿绿宝石：博士的包 + 三个球） ----------
  const BAG_SVG = '<svg viewBox="0 0 240 170" aria-hidden="true">' +
    '<path d="M44 58 Q120 8 196 58 L186 70 Q120 30 54 70Z" fill="#6d3f22"/>' +
    '<path d="M30 64 Q120 34 210 64 L200 92 L40 92Z" fill="#7a4a2a"/>' +
    '<ellipse cx="120" cy="72" rx="78" ry="14" fill="#2e1a0e"/>' +
    '<rect x="24" y="70" width="192" height="92" rx="22" fill="#a0643a"/>' +
    '<rect x="24" y="128" width="192" height="34" rx="18" fill="#8a532d"/>' +
    '<rect x="34" y="80" width="172" height="74" rx="16" fill="none" stroke="#e3b07a" stroke-width="3" stroke-dasharray="7 6"/>' +
    '<rect x="70" y="96" width="100" height="44" rx="12" fill="#8d5530"/>' +
    '<rect x="108" y="88" width="24" height="22" rx="4" fill="#f2c14e" stroke="#b8862b" stroke-width="3"/>' +
    '<rect x="115" y="95" width="10" height="8" rx="2" fill="#8d5530"/>' +
    '<path d="M28 74 Q14 40 40 34" fill="none" stroke="#6d3f22" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M212 74 Q226 40 200 34" fill="none" stroke="#6d3f22" stroke-width="9" stroke-linecap="round"/></svg>';
  const BALL_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="58" rx="20" ry="5" fill="rgba(0,0,0,.2)"/>' +
    '<circle cx="32" cy="32" r="24" fill="#fff" stroke="#2b2b3a" stroke-width="3.5"/><path d="M8 32 A24 24 0 0 1 56 32Z" fill="#8e6cef" stroke="#2b2b3a" stroke-width="3.5"/>' +
    '<circle cx="32" cy="32" r="7.5" fill="#fff" stroke="#2b2b3a" stroke-width="3.5"/><circle cx="32" cy="32" r="3" fill="#dcd3ff"/><ellipse cx="21" cy="20" rx="5" ry="3" fill="rgba(255,255,255,.6)" transform="rotate(-30 21 20)"/></svg>';
  const HAND_SVG = '<svg viewBox="0 0 40 50" aria-hidden="true"><path d="M17 46c0 2 5 2 5 0V24l2 7c1 2 4 1 4-1v-3c1 2 4 1 4-1v-3c1 2 4 1 4-1V12C36 5 30 2 24 2S14 5 12 10l-5 11c-1 3 2 4 4 2l6-7z" fill="#fff" stroke="#2b2b3a" stroke-width="2.5" stroke-linejoin="round" transform="rotate(180 20 25)"/></svg>';
  function starterBag(C) {
    return new Promise(done => {
      const E = C.E, MG = C.MG, ids = MG.STARTERS, sc = C.scene(), esc = E.esc;
      let i = 1, asking = false, over = false;
      sc.className = 'w-scene bag'; sc.hidden = false;
      sc.innerHTML = '<div class="bg-field"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="bg-preview" id="bg-prev"></div>' +
        '<div class="bg-bag">' + BAG_SVG + '</div>' +
        '<div class="bg-balls">' + ids.map((id, k) => '<button class="bg-ball" data-k="' + k + '" aria-label="第 ' + (k + 1) + ' 个球">' + BALL_SVG + '</button>').join('') + '</div>' +
        '<div class="bg-hand" id="bg-hand">' + HAND_SVG + '</div>' +
        '<div class="bg-box" id="bg-box"></div>';
      const render = () => {
        const sp = MG.species(ids[i]), t = sp.type;
        sc.querySelectorAll('.bg-ball').forEach((b, k) => b.classList.toggle('on', k === i));
        $('bg-hand').style.left = (22 + i * 28) + '%';
        const fresh = render.last !== i; render.last = i;
        $('bg-prev').innerHTML = '<div class="bg-circle' + (fresh ? ' new' : '') + '" style="--tc:' + ({ fire: '#f0642f', water: '#2f8fdd', grass: '#3fa34d', spark: '#d9a000' })[t] + '">' + Cartoon.monster(sp) + '</div><b>' + sp.en + '</b><small>' + sp.zh + ' · ' + TYPE_ZH[t] + '系</small>';
        $('bg-box').innerHTML = asking
          ? '<p class="bg-en">Do you choose ' + esc(sp.en) + ', the ' + TYPE_EN[t] + ' monster?</p><p class="bg-zh">要选' + TYPE_ZH[t] + '系的 ' + esc(sp.en) + '（' + sp.zh + '）吗？</p><div class="bg-yn"><button class="btn sun" id="bg-yes">是 YES</button><button class="btn ghost" id="bg-no">不 NO</button></div>'
          : '<p class="bg-en">Take a monster from my bag!</p><p class="bg-zh">◀ ▶ 选一个球，按 <b>A</b> 打开看看</p>';
      };
      const move = d => { if (asking || over) return; i = (i + d + ids.length) % ids.length; E.SFX.tap(); render(); E.say(MG.species(ids[i]).en); };
      const ask = () => { if (over) return; asking = true; render(); const sp = MG.species(ids[i]); E.say('Do you choose ' + sp.en + ', the ' + TYPE_EN[sp.type] + ' monster?', undefined, 'f'); };
      const yes = () => {
        if (over) return;
        over = true; C.setOverlay(null);
        E.SFX.ok(3);
        sc.querySelectorAll('.bg-ball')[i].classList.add('open');
        setTimeout(() => { sc.classList.add('out'); }, 500);
        setTimeout(() => { sc.hidden = true; sc.className = 'w-scene'; sc.innerHTML = ''; done(ids[i]); }, 1100);
      };
      const no = () => { asking = false; render(); };
      sc.addEventListener('click', e => {
        e.stopPropagation();
        const b = e.target.closest('.bg-ball');
        if (b && !asking) { const k = +b.dataset.k; if (k === i) ask(); else { i = k; E.SFX.tap(); render(); E.say(MG.species(ids[i]).en); } }
        if (e.target.closest('#bg-yes')) yes();
        if (e.target.closest('#bg-no')) no();
      });
      C.setOverlay(key => {
        if (key === 'left') move(-1);
        else if (key === 'right') move(1);
        else if (key === 'A') asking ? yes() : ask();
        else if (key === 'B' && asking) no();
      });
      render();
      E.say(MG.species(ids[i]).en);
    });
  }

  // ---------- 博士被野生怪兽追 ----------
  const LOOP = [[7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [11, 7], [11, 8], [10, 8], [9, 8], [8, 8], [7, 8], [7, 7]];
  async function rescue(C) {
    const E = C.E, MG = C.MG;
    const p = C.spawn({ look: P.LOOKS.prof, name: 'Professor Echo', g: 'f', x: 9, y: 6, face: 'right' });
    const w = C.spawn({ mon: 'zappy', x: 7, y: 6, face: 'right' });
    let run = true, k = 2;
    const at = j => LOOP[((j % LOOP.length) + LOOP.length) % LOOP.length];
    const place = (n, j) => { const [x, y] = at(j), [nx, ny] = at(j + 1); n.x = x; n.y = y; n.face = nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up'; };
    (async () => { while (run) { place(p, k); place(w, k - 2); k = (k + 1) % LOOP.length; await C.wait(230); } })();
    await C.wait(500);
    await C.talk([{ who: '???', emo: '😱', en: 'Help! Help me!', zh: '救命！救救我！', g: 'f' }]);
    C.facePlayer('right');
    await C.talk([
      nar('Professor Echo is being chased by a wild monster!', '回声博士正被一只野生怪兽追着跑！'),
      prof('You there! Please help me!', '那边的小朋友！快帮帮我！'),
      prof('My bag is on the ground. Take a monster from it!', '我的包掉在地上了，快从里面拿一只怪兽出来！'),
    ]);
    const id = await starterBag(C), sp = MG.species(id);
    await C.talk([{ who: '{name}', look: C.plook(), g: E.S.player.gender === 'girl' ? 'f' : 'm', en: sp.en + ', I choose you!', zh: '对它大声说：' + sp.en + '，就决定是你了！', kind: 'speak', target: sp.en + ', I choose you!' }]);
    MG.giveStarter(id);
    E.renderHome();
    run = false;
    await C.wait(250);
    w.x = C.pl.x + 2; w.y = C.pl.y; w.face = 'left'; p.x = C.pl.x + 3; p.y = C.pl.y - 1; p.face = 'left';
    const res = await C.battle('wild', { foes: [MG.newMon('zappy', 2)], noCatch: true, noWhiteout: true });
    C.remove(w);
    MG.healAll();
    p.x = C.pl.x + 1; p.y = C.pl.y; C.faceEach(p);
    await C.wait(300);
    const pages = res === 'win'
      ? [prof('Phew... Thank you, {name}! You saved me!', '呼……谢谢你，{name}！你救了我！')]
      : [prof('Oh my! That was close. Thank you for trying, {name}!', '哎呀，好险！谢谢你挺身而出，{name}！'), prof('Your monster was brave. It just needs a rest.', '你的怪兽很勇敢，只是需要休息一下。')];
    await C.talk(pages.concat([
      prof(sp.en + ' likes you very much. Please keep it!', sp.en + ' 很喜欢你。它就送给你当伙伴吧！', { onShow: () => { E.SFX.win(); E.confetti(160); } }),
      prof('Take these potions, too.', '这两瓶药水也拿着。', { onShow: () => { MG.addItem('potion', 2); E.toast('🧪 药水 +2', 'gold'); } }),
      prof('Monsters here listen to English. Speak clearly, and ' + sp.en + ' will be strong.', '这里的怪兽听英语。你说得越清楚，' + sp.en + ' 就越强。'),
      prof('First, visit the Gym and meet Captain Polly. Win her badge!', '先去道馆见见鹦鹉船长，赢下她的徽章！'),
      prof('Then the guard will let you go north to Route 1. My child {rival} is there.', '有了徽章，守卫就会让你往北去 1 号路。我的孩子 {rival} 就在那里。'),
      prof('Talk to people in town. They will teach you English!', '多和镇上的人说说话，他们会教你英语！'),
    ]));
    C.set('starter');
    C.remove(p);
    E.save();
  }

  // ---------- 1 号路：第一次遇到对手 ----------
  async function rival1(C) {
    const E = C.E, MG = C.MG, R = C.rivalInfo(), pl = C.pl;
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x, y: pl.y - 5, face: 'down' });
    await C.alert(r);
    await C.walk(r, 'down', 4, 170);
    C.faceEach(r);
    const say = (en, zh, x) => Object.assign({ who: R.name, look: R.look, g: R.g, en, zh }, x || {});
    await C.talk([
      say('Hi! You must be {name}! Mom told me about you.', '嗨！你就是 {name} 吧！妈妈跟我说过你。'),
      say("I'm {rival}. I want to be the English Champion!", '我叫 {rival}，我的梦想是当上英语冠军！'),
      say("Let's see how strong your monster is!", '来看看你的怪兽有多厉害吧！'),
    ]);
    const lead = MG.leadSpecies(), mine = lead ? lead.type : 'fire';
    const rid = MG.STARTERS.find(id => MG.STRONG[MG.species(id).type].includes(mine)) || MG.STARTERS[0];
    const res = await C.battle('trainer', { foes: [MG.newMon(rid, 5)], trainer: { name: R.name, img: C.portrait(R.look) }, noWhiteout: true });
    if (res === 'lose') {
      MG.healAll();
      await C.talk([say("Yay, I won! Don't be sad. Let me heal your monster.", '耶，我赢了！别难过，我帮你的怪兽恢复体力。'), say('You will be strong soon!', '你很快就会变强的！')]);
    } else {
      await C.talk([say('Wow, you are good! Your English is so clear!', '哇，你好厉害！你的英语说得真清楚！'), say('I will train harder. See you on the next island!', '我也要更努力地训练。下个岛见！')]);
    }
    C.set('rival1');
    await C.walk(r, 'up', 6, 150);
    C.remove(r);
    E.save();
  }

  // ---------- 洞穴深处的神兽（每只只有一次机会） ----------
  const LEGENDS = { c0: ['rockgiant', 4, 1], c1: ['icegiant', 16, 1], c2: ['irongiant', 15, 1] };
  async function legendMeet(C, n) {
    const MG = C.MG, sp = MG.species(n.mon), lv = MG.zoneLv(C.map.route) + 10;
    await C.talk([
      nar('The legendary ' + sp.en + ' is looking at you!', '传说中的' + sp.zh + '正盯着你！'),
      nar('Are you ready? Here it comes!', '准备好了吗？它冲过来了！'),
    ]);
    const res = await C.battle('wild', { foes: [MG.newMon(n.mon, lv)], hab: 'cave', noWhiteout: false });
    if (res === 'win' || res === 'caught') {
      C.set('leg:' + n.mon);
      C.remove(n);
      if (res === 'win') await C.talk([nar(sp.en + ' went back to sleep deep in the cave.', sp.zh + '回到洞穴深处睡着了。再也见不到它了。')]);
    }
  }

  async function giveExpShare(C, n) {
    C.faceEach(n);
    await C.talk([
      prof('{name}! You won the first badge! Well done!', '{name}！你拿到第一枚徽章了！真棒！'),
      prof('Take this. It is an Exp. Share.', '这个送给你，它叫学习装置。', { onShow: () => { C.MG.addItem('expshare', 1); C.E.SFX.win(); C.E.toast('📡 得到了学习装置！', 'gold'); } }),
      prof('With it, all the monsters in your team can learn from every battle.', '带着它，队伍里没出场的怪兽也能分到经验。'),
      prof('You can turn it on or off in your bag.', '在背包里可以打开或者关掉它。'),
    ]);
    C.set('expshare');
    C.E.save();
  }

  // ---------- 对外 ----------
  window.EchoStory = {
    enter(C, how) {
      const id = C.map.id, has = C.MG.leadSpecies();
      // 老存档：已经有怪兽，开场就算看过了；还没起名字的补问一次
      if (has && !C.flag('starter')) {
        ['intro', 'mom', 'starter'].forEach(k => C.set(k));
        const ws = C.E.S.world;
        if (Object.keys(C.E.S.mon.badges).length >= 2 || (ws.visited && ws.visited[2])) C.set('rival1');
      }
      if (has && !(C.E.S.player && C.E.S.player.name)) return () => intro(C, true);
      if (id === 'i0H' && !C.flag('intro')) return () => wakeUp(C);
      if (id === 't0' && C.flag('mom') && !C.flag('starter')) return () => rescue(C);
      const L = LEGENDS[id];
      if (L && !C.flag('leg:' + L[0]) && !C.npc(n => n.mon === L[0])) return () => { C.spawn({ mon: L[0], role: 'legend', x: L[1], y: L[2], face: 'down' }); };
      return null;
    },
    step(C) {
      const m = C.map, pl = C.pl;
      if (m.id === 'r0' && C.flag('starter') && !C.flag('rival1') && C.MG.anyAlive() && (pl.x === 9 || pl.x === 10) && pl.y <= m.H - 7 && pl.y >= 6) return () => rival1(C);
      return null;
    },
    talk(C, n) {
      if (C.map.id === 'i0H' && n.role === 'house') return () => momTalk(C, n);
      if (n.role === 'legend') return () => legendMeet(C, n);
      // 拿到第一枚徽章以后，博士送学习装置
      if (C.map.id === 't0' && n.role === 'talk' && n.id === '1' && C.E.S.mon.badges[0] && !C.flag('expshare')) return () => giveExpShare(C, n);
      return null;
    },
    hidden(C, n) {
      // 博士开场时在外面被追，救下她以前她不在老地方
      return C.map.id === 't0' && n.role === 'talk' && n.id === '1' && !C.flag('starter');
    },
    look(C, n) {
      if (C.map.id === 'i0H' && n.role === 'house') return { name: 'Mom', g: 'f', look: P.LOOKS.mom };
      return null;
    },
  };
})();
