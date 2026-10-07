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
    // 名字会说给 AI 岛民听（聊天的人设里）：提醒用游戏昵称，不用真名（评估第 16 条）
    await C.talk([prof("What's your name?", '你叫什么名字？选一个英文名，也可以自己起一个游戏昵称（不要用真名哦）。', {
      kind: 'custom',
      html: '<div class="nm-grid">' + names.map(n => '<button class="btn ghost nm" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<div class="nm-own"><input id="nm-in" maxlength="12" placeholder="自己输入英文名" autocomplete="off" autocapitalize="words" spellcheck="false"><button class="btn sun" id="nm-ok">好了</button></div><small class="tip" id="nm-tip">只能用英文字母，比如 Kevin、Coco。起个游戏昵称就好，不用写真名</small>',
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
  const LOOP0 = [[7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [11, 7], [11, 8], [10, 8], [9, 8], [8, 8], [7, 8], [7, 7]];
  async function rescue(C) {
    const E = C.E, MG = C.MG, LOOP = (C.map.def && C.map.def.rescueLoop) || LOOP0;
    const p = C.spawn({ look: P.LOOKS.prof, name: 'Professor Echo', g: 'f', x: LOOP[2][0], y: LOOP[2][1], face: 'right' });
    const w = C.spawn({ mon: 'zappy', x: LOOP[0][0], y: LOOP[0][1], face: 'right' });
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
      prof('But Captain Polly only battles students who study hard.', '不过鹦鹉船长只和用功的学生对战：先在「📚 闯关练习」里打败课本前两个单元的 BOSS 吧！', { zhKeep: true }),
      prof('Then the guard will let you go north to Route 1. My child {rival} is there.', '有了徽章，守卫就会让你往北去 1 号路。我的孩子 {rival} 就在那里。'),
      prof('Talk to people in town. They will teach you English!', '多和镇上的人说说话，他们会教你英语！'),
    ]));
    C.set('starter');
    C.remove(p);
    E.save();
  }

  // ---------- 路上的对手：进地图时就站在路上（远远就能看见），走近了「!」一下再走过来，不会凭空冒出来 ----------
  function rivalStand(C, id, x, y) {
    if (C.npc(n => n.id === id)) return;
    const R = C.rivalInfo();
    C.spawn({ id, look: R.look, name: R.name, g: R.g, x, y, face: 'down' });
  }
  // 走到主角面前：先沿自己那一列（路）上下走，再横着对齐
  async function approach(C, r) {
    const pl = C.pl;
    if (C.E.music) C.E.music('rival');   // 对手的主题曲，开战后换成战斗音乐
    await C.alert(r);
    const ty = r.y < pl.y ? pl.y - 1 : pl.y + 1;
    if (r.y !== ty) await C.walk(r, ty > r.y ? 'down' : 'up', Math.abs(ty - r.y), 220);
    if (r.x !== pl.x) await C.walk(r, r.x < pl.x ? 'right' : 'left', Math.abs(pl.x - r.x), 220);
    C.faceEach(r);
  }

  // ---------- 1 号路：第一次遇到对手 ----------
  async function rival1(C) {
    const E = C.E, MG = C.MG, R = C.rivalInfo(), pl = C.pl;
    const r = C.npc(n => n.id === 'rival1') || C.spawn({ id: 'rival1', look: R.look, name: R.name, g: R.g, x: pl.x, y: pl.y - 5, face: 'down' });
    await approach(C, r);
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
    const MG = C.MG, sp = MG.species(n.mon), lv = C.map.kind === 'town' ? MG.zoneLv(C.map.z) + 9 : MG.zoneLv(C.map.route != null ? C.map.route : C.map.z) + 10;
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

  // ---------- 第一年主线：嘘声团偷走每座岛的词语水晶（第 2–13 镇） ----------
  // stages：要打败的人，按顺序站在道馆门口；say：夺回水晶后大声念的句子（这座岛的主题）
  const CH = [
    null,
    { crystal: 'Color Crystal', zh: '颜色水晶', hush: ['poison', 'dark'], stages: ['grunt', 'gruntF'],
      flavor: ['Look! All the colors are gone. Everything is grey!', '你看！颜色全不见了，到处都是灰色的！'],
      say: 'Red, yellow, blue and green. Colors, come back!', sayZh: '红、黄、蓝、绿，颜色们，快回来！' },
    { crystal: 'Family Crystal', zh: '家庭水晶', hush: ['poison', 'dark'], stages: ['grunt', 'grunt'],
      flavor: ['A little boy forgot the words for his mom and dad!', '一个小男孩连“妈妈”“爸爸”都说不出来了！'],
      say: 'My family is the best family in the world!', sayZh: '我的家是世界上最好的家！' },
    { crystal: 'School Crystal', zh: '校园水晶', hush: ['poison', 'dark', 'ghost'], stages: ['grunt', 'whisper'],
      flavor: ['They want to stop our English class!', '他们要取消我们的英语课！'],
      say: "Let's learn English together!", sayZh: '我们一起学英语吧！' },
    { crystal: 'Subject Crystal', zh: '学科水晶', hush: ['poison', 'dark'], stages: ['gruntF', 'grunt'],
      flavor: ["Doctor Octo's books are all mixed up!", '八爪博士的书全被弄乱了！'],
      say: 'I like English, math and science.', sayZh: '我喜欢英语、数学和科学。' },
    { crystal: 'Club Crystal', zh: '社团水晶', hush: ['dark', 'ghost'], stages: ['grunt', 'rumble'],
      flavor: ['They broke the speakers at the talent show!', '他们把才艺表演的音响弄坏了！'],
      say: 'We can sing and dance together!', sayZh: '我们可以一起唱歌跳舞！' },
    { crystal: 'Clock Crystal', zh: '时钟水晶', hush: ['dark', 'steel'], stages: ['grunt', 'gruntF'],
      flavor: ['The clock tower stopped. Nobody knows the time!', '钟楼停了，谁都不知道现在几点！'],
      say: "It's seven o'clock. Time to get up!", sayZh: '七点了，该起床了！' },
    { crystal: 'Party Crystal', zh: '派对水晶', hush: ['poison', 'dark'], stages: ['gruntF', 'whisper'],
      flavor: ["They took the crystal from {rival}'s birthday cake!", '他们把 {rival} 生日蛋糕里的水晶抢走了！'],
      say: 'Happy birthday to you!', sayZh: '祝你生日快乐！' },
    { crystal: 'Animal Crystal', zh: '动物水晶', hush: ['poison', 'dark', 'bug'], stages: ['grunt', 'grunt'],
      flavor: ['They are catching wild monsters and putting them in cages!', '他们在抓野生怪兽，把它们关进笼子！'],
      say: 'Animals are our friends.', sayZh: '动物是我们的朋友。' },
    { crystal: 'Rule Crystal', zh: '规则水晶', hush: ['dark', 'poison'], stages: ['gruntF', 'rumble'],
      flavor: ['They are breaking all the rules in town!', '他们在镇上乱闯红灯、乱扔垃圾！'],
      say: "Don't break the rules!", sayZh: '不要破坏规则！' },
    { crystal: 'Health Crystal', zh: '健康水晶', hush: ['poison', 'dark'], stages: ['grunt', 'gruntF'],
      flavor: ['Everyone is eating junk food and staying in bed!', '大家都在吃垃圾食品、躺在床上不动！'],
      say: 'Eat well and keep fit!', sayZh: '好好吃饭，锻炼身体！' },
    { crystal: 'Weather Crystal', zh: '天气水晶', hush: ['dark', 'ghost', 'ice'], stages: ['whisper', 'rumble'],
      flavor: ['Their weather machine made a storm that never stops!', '他们的天气机让暴风雨一直下个不停！'],
      say: 'Rain, rain, go away!', sayZh: '雨呀雨，快走开！' },
    { crystal: 'Memory Crystal', zh: '回忆水晶', hush: ['dark', 'ghost', 'poison'], stages: ['grunt', 'gruntF', 'mute'],
      flavor: ['Mr. Mute is here! He wants to wake the Hush King!', '默先生来了！他要唤醒寂静之王！'],
      say: 'We remember! Echodrake, wake up!', sayZh: '我们记得！回声龙，醒来吧！' },
  ];
  const HUSH = {
    grunt: { name: 'Hush Grunt', look: 'grunt', g: 'm', n: 2, lines: [['Shh! Words only make trouble!', '嘘！说话只会惹麻烦！'], ['Silence is peace!', '安静就是和平！'], ['You talk too much, kid!', '小朋友，你话太多了！']] },
    gruntF: { name: 'Hush Grunt', look: 'gruntF', g: 'f', n: 2, lines: [['Be quiet! This crystal is ours now!', '安静！这颗水晶现在是我们的了！'], ['Shh... go home, little trainer.', '嘘……回家去吧，小训练师。']] },
    whisper: { name: 'Admin Whisper', look: 'whisper', g: 'f', n: 3, lines: [['Shh... I am Whisper. I only need to whisper.', '嘘……我是低语。我说话只需要悄悄话。']] },
    rumble: { name: 'Admin Rumble', look: 'rumble', g: 'm', n: 3, lines: [["I'm Rumble! I don't talk, I fight!", '我是闷雷！我不说话，我只对战！']] },
    mute: { name: 'Mr. Mute', look: 'mute', g: 'm', n: 4, lines: [['So you are the child who talks to monsters.', '你就是那个和怪兽说话的孩子。'], ['Words make people fight. A quiet world is a happy world.', '话说多了，人们就会吵架。安静的世界才是快乐的世界。']] },
  };
  const chFlag = z => 'ch' + z;
  const chStage = (C, z) => C.E.S.world.flags['s:chs' + z] || 0;
  const hushAt = (C, z) => C.npc(n => n.role === 'hush');
  function spawnHush(C, z) {
    const ch = CH[z], k = chStage(C, z), b = C.map.buildings.G;
    if (!ch || C.flag(chFlag(z)) || k >= ch.stages.length || !b || hushAt(C, z)) return null;
    const h = HUSH[ch.stages[k]];
    return C.spawn({ role: 'hush', look: P.LOOKS[h.look], name: h.name, g: h.g, x: b.door.x, y: b.door.y + 1, face: 'down', stage: k });
  }
  // 第一次来到这座岛：村民跑过来求助
  async function chapterIntro(C, z) {
    const ch = CH[z], w = C.E.W[z], pl = C.pl;
    const v = C.spawn({ look: P.VILLAGERS[z % P.VILLAGERS.length][2], name: P.VILLAGERS[z % P.VILLAGERS.length][0], g: P.VILLAGERS[z % P.VILLAGERS.length][1], x: pl.x + 1, y: pl.y - 1, face: 'left' });
    await C.alert(v);
    C.faceEach(v);
    const V = (en, zh) => ({ who: v.name, look: v.look, g: v.g, en, zh });
    await C.talk([
      V('Oh, a trainer! Please help us!', '啊，是训练师！请帮帮我们！'),
      V('Team Hush took our ' + ch.crystal + '!', '嘘声团把我们的' + ch.zh + '偷走了！'),
      V(ch.flavor[0], ch.flavor[1]),
      V('Without the crystal, people forget the words of ' + w.en.replace(/[!?]/g, '') + '.', '没有水晶，大家会慢慢忘掉这座岛的英语。'),
      V('They are standing at the Gym door. Please get it back!', '他们就守在道馆门口。请你帮我们抢回来！'),
    ]);
    C.set('chint' + z);
    C.remove(v);
    spawnHush(C, z);
  }
  // 和嘘声团对战；打完最后一个就夺回水晶，要大声念出这座岛的句子
  async function hushBattle(C, n) {
    const z = C.map.z, ch = CH[z], key = ch.stages[n.stage], h = HUSH[key], MG = C.MG;
    C.faceEach(n);
    const H = (en, zh) => ({ who: h.name, look: n.look, g: h.g, en, zh });
    await C.talk(h.lines.map(([en, zh]) => H(en, zh)));
    const lv = MG.zoneLv(z) + (key === 'mute' ? 6 : key === 'grunt' || key === 'gruntF' ? 1 : 3);
    const res = await C.battle('trainer', { foes: MG.teamOf(ch.hush, h.n, lv, 'hush' + z + key), trainer: { name: h.name, img: C.portrait(n.look) } });
    if (res !== 'win') return;
    await C.talk([H(key === 'mute' ? 'How... how can words be so strong?' : 'Shh... You win this time!', key === 'mute' ? '怎么……话语怎么会这么有力量？' : '嘘……这次算你赢！')]);
    C.remove(n);
    C.E.S.world.flags['s:chs' + z] = n.stage + 1;
    C.E.save();
    if (n.stage + 1 < ch.stages.length) { const nx = spawnHush(C, z); if (nx) { await C.alert(nx); await C.talk([{ who: HUSH[ch.stages[n.stage + 1]].name, look: nx.look, g: HUSH[ch.stages[n.stage + 1]].g, en: 'Not so fast!', zh: '别想走！' }]); } return; }
    await restoreCrystal(C, z);
  }
  async function restoreCrystal(C, z) {
    const ch = CH[z], E = C.E, nar = (en, zh, x) => Object.assign({ who: '旁白', emo: '💎', en, zh }, x || {});
    await C.talk([
      nar('You got the ' + ch.crystal + ' back!', '你夺回了' + ch.zh + '！'),
      nar('Say the magic words to make it shine again!', '大声念出这句话，让水晶重新亮起来！'),
      { who: '{name}', look: C.plook(), g: E.S.player.gender === 'girl' ? 'f' : 'm', en: ch.say, zh: ch.sayZh, kind: 'speak', target: ch.say },
      nar('The crystal is shining! Everyone remembers the words again!', '水晶亮起来了！大家又想起了这些英语！', { onShow: () => { E.SFX.win(); E.confetti(180); } }),
    ]);
    C.set(chFlag(z));
    C.MG.addItem('superball', 3);
    E.toast('💠 超级球 +3（村民的谢礼）', 'gold');
    if (z === 12) await echodrakeWakes(C);
    else await C.talk([nar('Now you can challenge the Gym Leader!', '现在可以去挑战道馆馆主了！')]);
  }
  // 最后一章：13 座岛的声音一起唤醒回声龙
  async function echodrakeWakes(C) {
    const b = C.map.buildings.G || { door: { x: C.pl.x, y: C.pl.y - 3 } }, nar = (en, zh) => ({ who: '旁白', emo: '🐉', en, zh });
    C.E.SFX.win();
    await C.talk([
      nar('The ground is shaking...', '大地在摇晃……'),
      nar('The voices of thirteen islands woke up Echodrake!', '十三座岛的声音唤醒了回声龙！'),
      prof('{name}! Echodrake wants to see how strong your voice is!', '{name}！回声龙想看看你的声音有多强！'),
    ]);
    if (!C.flag('leg:echodrake')) C.spawn({ mon: 'echodrake', role: 'legend', x: b.door.x, y: b.door.y + 2, face: 'down' });
  }

  // ---------- 道馆：点亮三座雕像（回答英语问题），馆主才接受挑战 ----------
  const litN = (C, z) => Object.keys(C.E.S.world.flags).filter(k => k.startsWith('s:g' + z + ':')).length;
  async function statueQuiz(C, f) {
    const z = C.map.z, key = 'g' + z + ':' + f.x + ':' + f.y, w = C.E.W[z], nar = (en, zh, x) => Object.assign({ who: '雕像', emo: '🗿', en, zh }, x || {});
    if (C.flag(key)) { await C.talk([nar('The statue is shining.', '这座雕像已经亮了。')]); return; }
    const sr = C.E.src ? C.E.src(z) : { w: z, d: w }, k = Math.floor(Math.random() * sr.d.dlgs.length), it = sr.d.dlgs[k];   // 有几成换成课本正在学的单元
    const opts = [{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))].sort(() => Math.random() - .5);
    let ok = false;
    await C.talk([nar(it[0], '雕像在问你问题。选出合适的回答，再大声说出来。', { kind: 'answer', opts, q: { kind: 'dlg', w: sr.w, i: k }, pass: () => { ok = true; return []; }, fail: () => [nar('The statue stays dark. Try again!', '雕像没有亮。再试一次吧！')] })]);
    if (!ok) return;
    C.set(key);
    const n = litN(C, z);
    C.E.SFX.ok(3);
    await C.talk([nar('The statue lights up! (' + n + '/4)', '雕像亮起来了！（' + n + '/4）' + (n >= 3 ? '现在可以挑战馆主了！' : '再点亮 ' + (3 - n) + ' 座就能挑战馆主。'))]);
  }
  function leaderGate(C, n) {
    const z = C.map.z, b = C.E.W[z].boss;
    const L = (en, zh) => ({ who: b.name, emo: b.emoji, g: 'm', en, zh });
    if (ISLES[C.map.isle]) {
      if (z >= 1 && !C.flag(chFlag(z)) && !C.E.S.mon.badges[z]) return () => C.talk([L(...(ISLES[C.map.isle].busy || ['Something is wrong on our island. I cannot battle now.', '岛上出事了，我现在没心思对战。'])), L('Please help the people on the island first!', '请你先去帮帮岛上的人吧！')]);
      return null;
    }
    if (z >= 1 && !C.flag(chFlag(z)) && !C.E.S.mon.badges[z]) return () => C.talk([L('Team Hush took our crystal! I cannot battle now.', '嘘声团偷走了我们的水晶！我现在没心思对战。'), L('Please get it back first!', '请你先把水晶抢回来！')]);
    if (litN(C, z) < 3 && !C.E.S.mon.badges[z]) return () => C.talk([L('Welcome to my Gym!', '欢迎来到我的道馆！'), L('Light up three statues first. Answer their questions in English!', '先点亮三座雕像：用英语回答它们的问题！')]);
    return null;
  }

  // ---------- 对手：在第 4、8、11 条路上再来比 ----------
  const RIVAL_AT = { r3: 2, r7: 3, r10: 4 };
  async function rivalAgain(C, k) {
    const MG = C.MG, R = C.rivalInfo(), pl = C.pl, z = C.map.z;
    const r = C.spawn({ look: R.look, name: R.name, g: R.g, x: pl.x, y: pl.y - 5, face: 'down' });
    await C.alert(r);
    await C.walk(r, 'down', 4, 160);
    C.faceEach(r);
    const say = (en, zh) => ({ who: R.name, look: R.look, g: R.g, en, zh });
    const lines = {
      2: [["{name}! I got a new badge too. Let's battle again!", '{name}！我也拿到新徽章了，再比一场吧！']],
      3: [['Team Hush is everywhere. We must get stronger!', '到处都是嘘声团，我们得变得更强！'], ['Show me your best!', '拿出你最强的本事吧！']],
      4: [['This is our last battle before the English League!', '这是英语冠军赛之前我们最后一场对战了！'], ["I won't lose this time!", '这次我可不会输！']],
    }[k];
    await C.talk(lines.map(([en, zh]) => say(en, zh)));
    const lead = MG.leadSpecies(), mine = lead ? lead.type : 'fire';
    const star = MG.STARTERS.find(id => MG.STRONG[MG.species(id).type].includes(mine)) || MG.STARTERS[0];
    const lv = MG.zoneLv(z) + 2;
    const foes = MG.teamOf(['normal', 'flying', 'spark', 'bug', 'rock'], k - 1, lv - 1, 'rival' + k).concat([MG.newMon(MG.grown(star, lv + 1), lv + 1)]);
    const res = await C.battle('trainer', { foes, trainer: { name: R.name, img: C.portrait(R.look) }, noWhiteout: true });
    if (res === 'lose') { MG.healAll(); await C.talk([say("I won! But you're getting stronger. Let me heal your team.", '我赢了！不过你越来越强了。我帮你的队伍恢复一下。')]); }
    else await C.talk([say('You beat me again! See you at the next island!', '又输给你了！下个岛见！')]);
    C.set('rival' + k);
    await C.walk(r, 'up', 6, 140);
    C.remove(r);
  }

  // 对手的队伍：克制你的初始怪兽 + 几只别的；k 越大越强
  function rivalTeam(C, k, lv) {
    const MG = C.MG, lead = MG.leadSpecies(), mine = lead ? lead.type : 'fire';
    const star = MG.STARTERS.find(id => MG.STRONG[MG.species(id).type].includes(mine)) || MG.STARTERS[0];
    return MG.teamOf(['normal', 'flying', 'spark', 'bug', 'rock', 'water', 'psychic'], Math.min(5, k - 1), lv - 1, 'rival' + k).concat([MG.newMon(MG.grown(star, lv + 1), lv + 1)]);
  }
  async function rivalFight(C, k, lv) {
    const R = C.rivalInfo(), say = (en, zh) => ({ who: R.name, look: R.look, g: R.g, en, zh });
    const res = await C.battle('trainer', { foes: rivalTeam(C, k, lv || C.MG.zoneLv(C.map.z) + 2), trainer: { name: R.name, img: C.portrait(R.look) }, noWhiteout: true });
    if (res === 'lose') { C.MG.healAll(); await C.talk([say("I won! But you're getting stronger. Let me heal your team.", '我赢了！不过你越来越强了。我帮你的队伍恢复一下。')]); }
    return res;
  }
  // 和嘘声团打一场（key：grunt / gruntF / whisper / rumble / mute）
  async function hushFight(C, n, key, o) {
    o = o || {};
    const h = HUSH[key], MG = C.MG, z = C.map.z, look = n && n.look ? (typeof n.look === 'string' ? P.LOOKS[n.look] || P.LOOKS[h.look] : n.look) : P.LOOKS[h.look];
    if (n) C.faceEach(n);
    const H = (en, zh) => ({ who: h.name, look, g: h.g, en, zh });
    await C.talk((o.lines || h.lines).map(([en, zh]) => H(en, zh)));
    const lv = MG.zoneLv(z) + (o.lv != null ? o.lv : key === 'mute' ? 6 : key === 'grunt' || key === 'gruntF' ? 1 : 3);
    const res = await C.battle('trainer', { foes: MG.teamOf(o.types || ['poison', 'dark'], o.n || h.n, lv, 'hush' + C.map.id + key + (n ? n.id : '')), trainer: { name: h.name, img: C.portrait(look) } });
    if (res === 'win' && o.win !== false) await C.talk([H(...(o.win || ['Shh... You win this time!', '嘘……这次算你赢！']))]);
    return res;
  }
  // 说话的人：S = sayer('Kai', 'kai', 'm')；S('Hi!', '你好！')
  const sayer = (who, look, g) => (en, zh, x) => Object.assign({ who, look: typeof look === 'string' ? P.LOOKS[look] : look, g: g || 'm', en, zh }, x || {});
  const me = C => (en, zh, x) => Object.assign({ who: '{name}', look: C.plook(), g: C.E.S.player && C.E.S.player.gender === 'girl' ? 'f' : 'm', en, zh }, x || {});
  // 让玩家大声说一句
  const speak = (C, target, zh, x) => Object.assign(me(C)(target, zh || '大声说出来！'), { kind: 'speak', target }, x || {});
  // 听一句话，选出正确的回答再说出来（right：正确回答；wrong：错的选项）
  const ask = (S, en, zh, right, wrong, x) => S(en, zh, Object.assign({ kind: 'answer', opts: [{ c: true, t: right }].concat(wrong.map(t => ({ t }))).sort(() => Math.random() - .5) }, x || {}));

  // ---------- 英语冠军赛：四位大师 + 冠军 ----------
  const LEAGUE = {
    1: { name: 'Master Sage', look: 'master1', g: 'm', types: ['steel', 'rock'], rule: 'words', ruleLines: [['In my room, every word is strong. Your small moves hit harder!', '在我的房间里，每个词都很有力量。你的小招伤害 ×1.5！']], lines: [['I am Sage, the master of words.', '我是智者，词语大师。'], ['Every word has power. Show me yours!', '每个词都有力量。让我看看你的！']] },
    2: { name: 'Master Luna', look: 'master2', g: 'f', types: ['ghost', 'dark'], rule: 'listen', ruleLines: [['In the dark, you must listen fast. You have only eight seconds to defend!', '在黑暗里要听得快。防御只有 8 秒！']], lines: [['I am Luna. I love stories in the dark.', '我是露娜，我喜欢在黑暗里讲故事。'], ['Tell me your story with your monsters!', '用你的怪兽告诉我你的故事吧！']] },
    3: { name: 'Master Frost', look: 'master3', g: 'f', types: ['ice', 'water'], rule: 'clear', ruleLines: [['Clear words hit hard. Unclear words are weak!', '说得清楚，招式就强；说得含糊，招式就弱（很准 ×1.6，一般 ×0.8）！']], lines: [['I am Frost. My English is cool and clear.', '我是冰霜，我的英语又酷又清楚。'], ['Can you speak clearly in the cold?', '你在寒冷里也能说得清楚吗？']] },
    4: { name: 'Master Talon', look: 'master4', g: 'm', types: ['dragon', 'fire'], rule: 'talk', ruleLines: [["Let's talk with our biggest moves! You start with full energy!", '让我们用最强的招式对话吧！你一上场就有 3 格能量！']], lines: [['I am Talon, the last master.', '我是利爪，最后一位大师。'], ['Only the bravest speakers can pass!', '只有最勇敢的说话者才能通过！']] },
    5: { name: 'Champion Aria', look: 'champion', g: 'f', types: ['water', 'flying', 'psychic', 'dragon'], rotate: ['words', 'listen', 'clear', 'talk', 'words'], ruleLines: [['Each of my monsters brings a different rule. Watch the top of the screen!', '我的每只怪兽都带着不同的规则。注意看屏幕上方的提示！']], lines: [['Welcome, {name}. I am Aria, the English Champion.', '欢迎你，{name}。我是英语冠军阿丽娅。'], ['You came all the way from Hello Island.', '你从你好岛一路走到了这里。'], ['Now, show me everything you have learned!', '现在，让我看看你学到的一切吧！']] },
  };
  async function leagueBattle(C, n) {
    const k = C.map.room, L = LEAGUE[k], MG = C.MG, look = P.LOOKS[L.look];
    C.faceEach(n);
    const S = (en, zh) => ({ who: L.name, look, g: L.g, en, zh });
    await C.talk(L.lines.concat(L.ruleLines || []).map(([en, zh]) => S(en, zh)));
    const lv = MG.zoneLv(12) + 4 + (+k) * 2;
    const rules = L.rotate ? { rotate: L.rotate } : L.rule ? { kind: L.rule } : null;
    const res = await C.battle('trainer', { foes: MG.teamOf(L.types, k === '5' ? 5 : 3, lv, 'league' + k), trainer: { name: L.name, img: C.portrait(look) }, rules });
    if (res !== 'win') return;
    C.set('lg' + k);
    if (k !== '5') { await C.talk([S('You are strong. The next room is waiting for you.', '你很强。下一个房间在等你。')]); C.remove(n); return; }
    await C.talk([S('Amazing! You are the new English Champion!', '太棒了！你就是新的英语冠军！')]);
    await hallOfFame(C);
  }
  async function hallOfFame(C) {
    const E = C.E, MG = C.MG, sc = C.scene(), team = E.S.mon.team.map(u => E.S.mon.box.find(m => m.uid === u)).filter(Boolean);
    sc.className = 'w-scene fame'; sc.hidden = false;
    sc.innerHTML = '<div class="fame-in"><h2>🏆 名人堂 Hall of Fame</h2><p class="fame-name">' + E.esc(C.pname()) + '</p><div class="fame-team">' +
      team.map(m => { const s = MG.species(m.sp); return '<span class="fame-mon">' + Cartoon.monster(s) + '<b>' + s.en + '</b><small>Lv ' + m.lv + '</small></span>'; }).join('') + '</div><p>英语冠军赛冠军 · ' + new Date().toLocaleDateString('zh-CN') + '</p></div>';
    E.SFX.win(); E.confetti(300);
    C.set('champion');
    E.S.coins += 500; E.renderTop();
    await C.wait(600);
    await C.talk([
      { who: '旁白', emo: '🏆', en: 'Congratulations, {name}! You are the Champion!', zh: '恭喜你，{name}！你成为了英语冠军！' },
      { who: '旁白', emo: '🏆', en: 'Your monsters and your English made it happen.', zh: '是你的怪兽和你的英语一起做到的。' },
      prof('Wonderful, {name}! But the world is bigger than these islands...', '太棒了，{name}！不过世界比这些岛大得多……'),
      prof('Far to the north, new islands are waiting. See you next year!', '在遥远的北方，还有新的群岛在等你。明年见！'),
    ]);
    sc.classList.add('out'); await C.wait(700); sc.hidden = true; sc.className = 'w-scene'; sc.innerHTML = '';
    E.toast('💰 金币 +500', 'gold');
    // 打通以后还有事做：馆主重赛（更强、题目换成最近学的课本单元）、传说的线索
    await C.talk([
      prof('Oh, and one more thing! The Gym Leaders want to battle you again.', '对了，还有一件事！各岛的馆主都想再和你比一场。'),
      prof('They are much stronger now. And they will ask about your new English lessons!', '他们变得更强了，还会考你课本里最近学的英语！'),
      prof('Some legendary monsters are watching you, too. Keep learning every day!', '还有几只传说中的怪兽在悄悄看着你。每天都要坚持学习哦！'),
    ]);
  }

  // ---------- 各岛的剧情（isles/*.js 用 EchoStory.isle(z, hooks) 登记） ----------
  const ISLES = {};
  const isleHook = (hook, C, arg) => { const h = ISLES[C.map.isle]; return h && h[hook] ? h[hook](C, arg) : null; };
  const legacy = C => !ISLES[C.map.isle];

  // ---------- 现在该去哪、做什么（大地图顶上的 📍、冒险菜单、首页「继续冒险」下面、进地图时的提示）----------
  // 只看徽章、去过的岛和剧情旗标，不看当前地图（首页也能用）。返回 { zh, z }：一句中文目标，带上关键的英文
  const LEADER_EN = ['Captain Polly', 'Crabby', 'Granny Turtle', 'Principal Owl', 'Doctor Octo', 'Flo', 'Rooster Rex', 'Puffy', 'Croc', 'Sharky', 'Coach Seal', 'Whaley', 'the Memory Dragon'];
  const GYM_HOW = [
    '问候之门：看窗外的天色，说对问候语（Good morning / afternoon / evening）',
    '彩色地板：听广播 "Walk on red!"，只踩那种颜色',
    '家族树迷宫：听描述找到奶奶、爸爸、妹妹，问 "Are you the grandma?"',
    '教室换座：对着黑板按 A 答题，答对开门',
    '课程表开关：按广播的顺序踩学科开关',
    '音符地板：听广播，按顺序踩音符',
    '时钟转门：听报时，把钟拨到对的时间',
    '礼物盒：听生日日期，踩写着那天的盒子',
    '脚印小路：听描述，跟着对的脚印走',
    '红绿灯：只走斑马线，绿灯才能走',
    '冰面滑行：只捡健康的食物',
    '天气开关：按天气预报的顺序打开开关',
    '回忆牌：翻牌，把英文和中文配成对',
  ];
  const HM_OK = (C, k) => C.MG.itemCount('hm_' + k) > 0;
  // 去第 z 座岛的路（还没去过那座岛时）
  const TRAVEL = {
    1: C => '沿 1 号路 Route 1 往北走，去彩色文具岛' + (C.flag('rival1') ? '' : '（{rival} 在路上等你）'),
    2: () => '穿过涂鸦森林 Graffiti Woods 和 2 号路，往北去温馨家庭岛',
    3: C => HM_OK(C, 'cut') ? '用「居合斩」砍掉北边路口的小树，走 3 号路去校园岛' : '去北边路口的小屋找树医生 Tree Doctor，拿「居合斩」的秘传学习器',
    4: C => HM_OK(C, 'smash') ? '用「碎岩」打碎隧道里的裂石，穿过碎岩隧道去学科岛' : '去北边的隧道口找矿工 Miner，拿「碎岩」的秘传学习器',
    5: () => '去港口坐盖尔船长 Captain Gale 的渡轮 ferry，去社团岛',
    6: C => HM_OK(C, 'strength') ? '用「怪力」推开沙丘道的大石头，去作息岛' : '去沙滩边找大力士 Strongman，拿「怪力」的秘传学习器',
    7: () => '钻进钟山 Clock Mountain 的山洞爬到山顶，再沿 7 号路往北去生日派对岛',
    8: C => HM_OK(C, 'surf') ? '冲浪 surf 往东过 8 号水路，去动物岛' : '去港口找爸爸 Dad，拿「冲浪」的秘传学习器',
    9: () => '冲浪往东过 9 号水路，去规则城',
    10: C => HM_OK(C, 'dive') ? '去城东的 10 号水路，在深蓝色的水上潜水 dive，从海底去运动美食岛' : '去海边找导师欧瑞 Orion，拿「潜水」的秘传学习器',
    11: () => '穿过北边的冰洞 Ice Cave，去天气岛',
    12: C => HM_OK(C, 'falls') ? '去 12 号路，冲浪爬上瀑布 waterfall，去回忆岛' : '去气象台找斯凯博士 Dr. Skye，拿「攀瀑」的秘传学习器',
  };
  // 各岛的剧情还没做完时：下一步做什么（做完了返回 null）
  const n3 = (C, ks) => ks.filter(k => C.flag(k)).length;
  const STEPS = {
    0: C => !C.flag('mom') ? '和妈妈说说话，然后走到门口的红地垫出门' : !C.flag('starter') ? '出门去找邻居回声博士 Professor Echo' : null,
    1: C => C.flag('ch1') ? null : !C.flag('z1intro') ? '在彩色文具岛走走看看' : '颜色水晶 Color Crystal 被偷了！去小镇北边的涂鸦森林 Graffiti Woods，打败森林深处的嘘声团（' + n3(C, ['z1h0', 'z1h1']) + '/2）',
    2: C => {
      if (C.flag('ch2')) return null;
      if (!C.flag('f2call')) return '在温馨家庭岛走走看看';
      if (!C.flag('f2tim')) return '井边 well 有个小男孩在哭，去问问他';
      const left = [['f2mom', '妈妈'], ['f2dad', '爸爸'], ['f2gran', '奶奶']].filter(([k]) => !C.flag(k)).map(q => q[1]);
      return left.length ? '帮蒂姆 Tim 找家人：问 "Are you Tim\'s mom?"（还差' + left.join('、') + '）' : '风车田 windmill field 里的稻草人在动？去看看！';
    },
    3: C => C.flag('ch3') ? null : !C.flag('f3in') ? '在校园岛走走看看'
      : !C.flag('f3note') ? '嘘声团的低语 Whisper 跑进了红砖教学楼（有钟楼的那栋），去找她'
        : !C.flag('f3lib') ? '找人问一问："Where is the library?"（走廊里的艾米 Amy）'
          : !C.flag('f3lab') ? '图书馆在食堂旁边，去问图书管理员 librarian'
            : !C.flag('f3grunt') ? '实验室 lab 在二楼，音乐教室旁边，去打败那里的团员'
              : !C.flag('f3c5') ? '问问二楼的萨姆 Sam："Where is Class Five?"' : '五班 Class Five 在实验室旁边，快去堵住低语！',
    4: C => C.flag('ch4') ? null : !C.flag('f4in') ? '在学科岛走走看看'
      : !C.flag('f4books') ? '去八爪博士的实验室（镇子中间的玻璃圆顶），听课程表 timetable 帮他摆书' : '嘘声团在东边的卫星天线 satellite dish 旁，去打败他们',
    5: C => {
      if (C.flag('ch5')) return null;
      if (!C.flag('c5intro')) return '在社团岛走走看看';
      const n = n3(C, ['c5club_music', 'c5club_dance', 'c5club_art']);
      return n < 3 ? '集齐三个社团的贴纸：去找音乐社、舞蹈社、美术社的人（' + n + '/3）' : '去中间的大帐篷参加才艺表演 Talent Show';
    },
    6: C => {
      if (C.flag('ch6')) return null;
      if (!C.flag('c6call')) return '在作息岛走走看看';
      if (!C.flag('c6grunt')) return '钟楼 clock tower 停了！去钟楼里看看';
      const n = n3(C, ['c6ask_baker', 'c6ask_student', 'c6ask_mayor']);
      return n < 3 ? '问面包师、学生和镇长："What time do you get up?"（' + n + '/3）' : '回钟楼找管理员托克 Tock，把大钟拨好';
    },
    7: C => {
      if (C.flag('ch7') && C.flag('rival3')) return null;
      if (!C.flag('c7intro')) return '在生日派对岛走走看看';
      const n = n3(C, ['c7cal_granny', 'c7cal_amy', 'c7cal_baker7']);
      return n < 3 ? '问罗丝奶奶、艾米和蛋糕师："When is your birthday?"（' + n + '/3）' : '去蛋糕房子 Cake House 参加 {rival} 的生日派对';
    },
    8: C => C.flag('ch8') ? null : !C.flag('a8in') ? '在动物岛走走看看'
      : !C.flag('a8find') ? '去东边的动物公园 Animal Park，找出巡林员罗莎说的那只怪兽（small, long tail）'
        : !C.flag('a8cloud') ? '去镇子北边的丛林 jungle，找跑散的怪兽'
          : !C.flag('a8bush') ? '丛林里岩壁旁边有一丛奇怪的灌木 bush，去看看' : '潜进嘘声团基地：偷听口令 password，打开笼子，打败低语',
    9: C => {
      if (C.flag('ch9')) return null;
      if (!C.flag('a9in')) return '在规则城走走看看';
      if (!C.flag('a9spyq')) return '当小交警：在马路上找到不守规矩的人，用英语提醒他们（' + n3(C, ['a9r1', 'a9r2', 'a9r3']) + '/3）';
      return '喷泉旁边有个乔装的团员：red cap（红帽子）、glasses（眼镜）、bag（背包），找出他';
    },
    10: C => C.flag('ch10') ? null : !C.flag('a10mom') ? '在运动美食岛走走看看'
      : !C.flag('rival4') ? '{rival} 在运动场旁边，去找他聊聊' : '嘘声团在集市 market 发垃圾食品，打败两个团员（' + n3(C, ['a10h1', 'a10h2']) + '/2）',
    11: C => C.flag('ch11') ? null : !C.flag('w11in') ? '在天气岛走走看看'
      : !C.flag('w11fc') ? '去气象台 Weather Station（玻璃圆顶的房子）找斯凯博士 Dr. Skye'
        : !C.flag('w11door') ? '打败气象塔 Weather Tower 门口的嘘声团团员' : '爬上气象塔，按天气预报 sunny → rainy → windy 的顺序关掉天气机',
    12: C => C.flag('ch12') ? null : !C.flag('rival5') ? '在回忆岛的雾里走走，{rival} 在等你'
      : !C.flag('m12orion') ? '去镇子北边的回忆神殿 Memory Temple 门口找欧瑞 Orion' : '进回忆神殿：读石板 tablets、回答记忆之门，到最里面阻止默先生 Mr. Mute',
  };
  const MASTERS = [['智者 Master Sage', '单词大师'], ['露娜 Master Luna', '听力大师'], ['冰霜 Master Frost', '口语大师'], ['利爪 Master Talon', '对话大师'], ['冠军阿丽娅 Champion Aria', '冠军']];
  function objective(C) {
    const E = C.E, S = E.S, b = (S.mon && S.mon.badges) || {}, vis = (S.world && S.world.visited) || {};
    const out = (zh, z) => ({ zh: zh.split('{rival}').join(C.rivalInfo().name), z });
    if (S.mon && S.mon.box && S.mon.box.length && C.MG.anyAlive && !C.MG.anyAlive()) return out('怪兽们都累倒了：先去怪兽中心 Monster Center 找护士恢复体力', -1);
    let z = 0; while (z < E.W.length && b[z]) z++;
    if (z >= E.W.length) {
      if (C.flag('champion')) return out('🏆 你是英语冠军了！回各岛找馆主重赛（更强，还会考最近学的课本单元），也去找找「传说的线索」', 13);
      const k = [1, 2, 3, 4, 5].find(i => !C.flag('lg' + i)) || 5;
      if (k === 1 && !C.flag('kai_final')) return out('从回忆岛北边走冠军之路 Champion Road，去冠军高原参加英语冠军赛（小凯 Kai 在洞窟 2 楼等你）', 13);
      return out('英语冠军赛：挑战' + (k < 5 ? '第 ' + k + ' 位大师 ' : '') + MASTERS[k - 1][0] + (k < 5 ? '（' + MASTERS[k - 1][1] + '）' : '，赢了就是英语冠军！'), 13);
    }
    if (z > 0 && !vis[z]) return out(TRAVEL[z](C), z);
    const st = STEPS[z] && STEPS[z](C);
    if (st) return out(st, z);
    const g = C.gymNeed ? C.gymNeed(z) : { ok: true };
    const who = E.W[z].boss.name + ' ' + LEADER_EN[z];
    if (!g.ok) return out('馆主' + who + ' 要你先学好课本：去「📚 闯关练习」打败 ' + g.unitLabel + ' 的 BOSS（课本 BOSS ' + g.done + '/' + g.need + '）', z);
    return out('去道馆 Gym 挑战' + who + '。' + GYM_HOW[z], z);
  }

  // ---------- 传说的线索：四只神兽是学习的里程碑（七上全过、聊天完成 30 次、连续打卡 30 天、不看字说对 300 句）----------
  // 达成以后，下次走到户外（小镇、道路）时它会飞来找你；打倒了明天再来，收服了才算数。进度存在 world.mile
  // 聊天目标次数读 dayLog().talk（每日任务「和岛民聊天」完成时 +1），不看字说对读 dayLog().recall（凭记忆说对一句 +1）
  function mile(C) {
    const E = C.E, S = E.S, ws = S.world;
    const m = ws.mile = Object.assign({ upto: '', talk: 0, recall: 0, streak: 0 }, ws.mile || {});
    const today = E.dayStr ? E.dayStr() : '', log = S.log || {};
    // 过去的日子（今天以前、还没算过的）累加进总数：日志只留 45 天，加进来以后就不怕被删
    Object.keys(log).sort().forEach(d => { if (d > m.upto && d < today) { m.talk += log[d].talk || 0; m.recall += log[d].recall || 0; m.upto = d; } });
    m.streak = Math.max(m.streak || 0, S.streak || 0);
    const L = log[today] || {};
    return { talk: m.talk + (L.talk || 0), recall: m.recall + (L.recall || 0), streak: m.streak };
  }
  const bookBoss = (C, bi) => { const E = C.E, NB = E.W.length; return (E.WX || []).slice(NB).filter((u, i) => u.bi === bi && (E.S.stars[(NB + i) + '-6'] || 0) > 0).length; };
  const orionS = sayer('Orion', 'orion', 'm');
  const call = who => nar('Ring, ring! ' + who + ' is calling!', '📞 叮铃铃！' + (who === 'Orion' ? '导师欧瑞' : '回声博士') + '打来电话！');
  const MILES = [
    { id: 'frostwing', icon: '❄️', task: '七上 8 个单元的 BOSS 全部打败', need: 8, have: C => bookBoss(C, 0),
      call: () => [call('Professor Echo'), prof('{name}! You beat all eight units of your first English book!', '{name}！七年级上册 8 个单元的 BOSS，你全都打败了！'), prof('A legendary bird heard about you. It is called Frostwing.', '一只传说中的鸟听说了你，它叫霜羽鸟。'), prof('It loves children who learn every day. Look up at the sky!', '它最喜欢天天学习的孩子。快抬头看天上！')],
      meet: C => [nar('Whoosh! A cold wind... Snow is falling from a blue sky!', '呼——！一阵冷风吹过……晴朗的天空竟然飘起了雪！'), nar('Frostwing landed in front of you!', '霜羽鸟落在了你面前！'), speak(C, 'Frostwing, I am ready!', '对霜羽鸟大声说：我准备好了！')] },
    { id: 'stormwing', icon: '⚡', task: '和岛民用英语聊天，完成目标 30 次', need: 30, have: C => mile(C).talk,
      call: () => [call('Professor Echo'), prof('{name}! You finished thirty chats with the islanders in English!', '{name}！你已经用英语和岛民聊天、完成了 30 次目标！'), prof('Your voice is like thunder now. Stormwing heard it!', '你的声音现在像雷声一样响亮，雷羽鸟听见了！')],
      meet: C => [nar('Boom! Lightning flashes across the sky!', '轰隆！天上划过一道闪电！'), nar('Stormwing came down to see you!', '雷羽鸟飞下来找你了！'), speak(C, "Stormwing, let's battle!", '对雷羽鸟大声说：我们来对战吧！')] },
    { id: 'blazewing', icon: '🔥', task: '连续打卡 30 天', need: 30, have: C => mile(C).streak,
      call: () => [call('Professor Echo'), prof('{name}! You came back and learned for thirty days in a row!', '{name}！你已经连续打卡 30 天了！'), prof('Your heart is like a fire that never goes out. Blazewing saw it!', '你的心像一团永不熄灭的火，焰羽鸟看见了！')],
      meet: C => [nar('The air is getting warm... A bird of fire is flying down!', '空气变暖了……一只火焰之鸟飞了下来！'), nar('Blazewing is looking at you!', '焰羽鸟正看着你！'), speak(C, 'Blazewing, I never give up!', '对焰羽鸟大声说：我永不放弃！')] },
    { id: 'lullaby', icon: '🌙', task: '不看字说对 300 句英语', need: 300, have: C => mile(C).recall,
      call: () => [call('Orion'), orionS('{name}, I heard you can say three hundred sentences without looking!', '{name}，听说你已经不看字说对了 300 句英语！'), orionS('Lullaby is a shy monster. It only visits people with English in their hearts.', '摇篮灵是只害羞的怪兽，只会去找心里装满英语的人。')],
      meet: C => [nar('You hear a soft song... La, la, la...', '你听见一首轻轻的歌……啦，啦，啦……'), nar('Lullaby appeared!', '摇篮灵出现了！'), speak(C, 'Hello, Lullaby. Nice to meet you!', '对摇篮灵说：你好，很高兴认识你！')] },
  ];
  function legendClues(C) {
    const today = C.E.dayStr ? C.E.dayStr() : '';
    return MILES.map(m => {
      const sp = C.MG.species(m.id) || { en: m.id, zh: m.id }, have = Math.min(m.need, m.have(C) || 0);
      return { id: m.id, icon: m.icon, en: sp.en, zh: sp.zh, task: m.task, have, need: m.need, done: have >= m.need, caught: C.flag('leg:' + m.id), back: C.E.S.world.flags['s:mlday:' + m.id] === today };
    });
  }
  // 主角旁边能站的一格（神兽落在这里）
  function spotNear(C) {
    const M = C.map, W = (window.EchoMaps && EchoMaps.WALK) || '.,=F';
    const ok = (x, y) => x > 0 && y > 0 && x < M.W - 1 && y < M.H - 1 && W.includes(C.tile(x, y)) && C.tile(x, y) !== 'I' && !M.npcs.some(n => n.x === x && n.y === y) && !(M.warps || []).some(w => w.x === x && w.y === y) && !(x === C.fl.x && y === C.fl.y) && !(x === C.pl.x && y === C.pl.y);
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[C.pl.dir] || [0, -1];
    const tries = [[d[0], d[1]], [0, -1], [1, 0], [-1, 0], [0, 1], [d[0] * 2, d[1] * 2], [1, -1], [-1, -1], [1, 1], [-1, 1]];
    for (const [dx, dy] of tries) if (ok(C.pl.x + dx, C.pl.y + dy)) return { x: C.pl.x + dx, y: C.pl.y + dy };
    return null;
  }
  // 进户外地图时：有达成了、还没收服、今天没被打跑的神兽，就飞过来
  function mileReady(C) {
    const m = C.map;
    if (!C.flag('starter') || (m.kind !== 'town' && m.kind !== 'route') || C.pl.surf || !C.MG.anyAlive() || C.npc(n => n.role === 'mlegend')) return null;
    const today = C.E.dayStr ? C.E.dayStr() : '';
    return MILES.find(q => !C.flag('leg:' + q.id) && C.E.S.world.flags['s:mlday:' + q.id] !== today && (q.have(C) || 0) >= q.need) || null;
  }
  async function mileAppear(C, q) {
    const at = spotNear(C);
    if (!at) return;
    const first = !C.flag('mlseen:' + q.id), sp = C.MG.species(q.id);
    if (first) await C.talk(q.call(C));
    const n = C.spawn({ mon: q.id, role: 'mlegend', x: at.x, y: at.y, face: 'down' });
    C.E.SFX.win();
    await C.alert(n);
    C.faceEach(n);
    C.set('mlseen:' + q.id);
    if (!first) { await C.talk([nar(sp.en + ' is back! It is looking at you.', sp.zh + '又飞回来了！它正看着你。准备好了就对着它按 A。')]); return; }
    await C.talk(q.meet(C));
    await mileMeet(C, n);
  }
  async function mileMeet(C, n) {
    const MG = C.MG, sp = MG.species(n.mon), lv = Math.max(12, MG.zoneLv(Math.min(12, C.badges())) + 6);
    await C.talk([nar('The legendary ' + sp.en + ' wants to see your power!', '传说中的' + sp.zh + '想看看你的力量！收服它要多扔几个球哦。')]);
    const res = await C.battle('wild', { foes: [MG.newMon(n.mon, lv)], hab: C.map.hab || 'grass' });
    if (res === 'caught') {
      C.set('leg:' + n.mon);
      C.remove(n);
      await C.talk([nar(sp.en + ' joined your team! Keep learning, and more legends will come.', sp.zh + '加入了你的队伍！继续加油，还会有别的传说怪兽来找你。')]);
    } else if (res === 'win') {
      C.E.S.world.flags['s:mlday:' + n.mon] = C.E.dayStr ? C.E.dayStr() : 1;
      C.E.save();
      C.remove(n);
      await C.talk([nar(sp.en + ' flew away. It will come back tomorrow!', sp.zh + '飞走了。明天它还会回来，下次试着收服它吧！')]);
    }
    // 输了 / 逃跑：它还在这里，准备好了再对着它按 A
  }

  // ---------- 对外 ----------
  window.EchoStory = {
    isle(z, hooks) { ISLES[z] = hooks; },
    lib: { P, prof, mom, nar, HUSH, CH, rival1, rivalStand, approach, sayer, me, speak, ask, hushFight, rivalFight, rivalTeam, restoreCrystal, echodrakeWakes, legendMeet, leagueBattle, hallOfFame, chFlag },
    // 现在该去哪、做什么：{ zh, z }（z = 下一枚徽章的岛，13 = 冠军赛 / 打通以后，-1 = 先去怪兽中心）
    objective: C => objective(C),
    // 传说的线索：四只学习里程碑神兽的进度 [{ id, icon, en, zh, task, have, need, done, caught, back }]
    legendClues: C => legendClues(C),
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
      const ih = isleHook('enter', C, how); if (ih) return ih;
      // 主线：第 2–13 镇的嘘声团（还没做成独立剧情的岛用这套模板）
      if (C.map.kind === 'town' && CH[C.map.z] && C.flag('starter') && legacy(C)) {
        const z = C.map.z;
        if (!C.flag(chFlag(z)) && !C.E.S.mon.badges[z]) {
          if (!C.flag('chint' + z)) return () => chapterIntro(C, z);
          if (!hushAt(C, z)) return () => { spawnHush(C, z); };
        } else if (z === 12 && !C.flag('leg:echodrake') && !C.npc(n => n.mon === 'echodrake')) {
          const b = C.map.buildings.G;
          return () => { C.spawn({ mon: 'echodrake', role: 'legend', x: b.door.x, y: b.door.y + 2, face: 'down' }); };
        }
      }
      const L = legacy(C) && LEGENDS[id];
      if (L && !C.flag('leg:' + L[0]) && !C.npc(n => n.mon === L[0])) return () => { C.spawn({ mon: L[0], role: 'legend', x: L[1], y: L[2], face: 'down' }); };
      // 学习里程碑的神兽：别的剧情都没有的时候才飞来
      const ml = mileReady(C);
      if (ml) return () => mileAppear(C, ml);
      return null;
    },
    step(C) {
      const m = C.map, pl = C.pl;
      const ih = isleHook('step', C); if (ih) return ih;
      if (!legacy(C)) return null;
      const rk = RIVAL_AT[m.id];
      if (rk && C.flag('starter') && !C.flag('rival' + rk) && C.MG.anyAlive() && (pl.x === 9 || pl.x === 10) && pl.y <= m.H - 7 && pl.y >= 6) return () => rivalAgain(C, rk);
      if (m.id === 'r0' && C.flag('starter') && !C.flag('rival1') && C.MG.anyAlive() && (pl.x === 9 || pl.x === 10) && pl.y <= m.H - 7 && pl.y >= 6) return () => rival1(C);
      return null;
    },
    talk(C, n) {
      if (n.role === 'mlegend') return () => mileMeet(C, n);
      if (C.map.id === 'i0H' && n.role === 'house') return () => momTalk(C, n);
      const ih = isleHook('talk', C, n); if (ih) return ih;
      if (n.role === 'legend') return () => legendMeet(C, n);
      if (n.role === 'hush') return () => hushBattle(C, n);
      if ((n.role === 'master' || n.role === 'champion') && !C.flag('lg' + C.map.room)) return () => leagueBattle(C, n);
      if (n.role === 'leader') { const g = leaderGate(C, n); if (g) return g; }
      // 拿到第一枚徽章以后，博士送学习装置
      if (C.map.id === 't0' && n.role === 'talk' && n.id === '1' && C.E.S.mon.badges[0] && !C.flag('expshare')) return () => giveExpShare(C, n);
      return null;
    },
    tile(C, f) {
      const ih = isleHook('tile', C, f); if (ih) return ih;
      if (C.map.kind === 'inside' && C.map.room === 'G' && legacy(C)) return () => statueQuiz(C, f);
      return null;
    },
    hidden(C, n) {
      const h = ISLES[C.map.isle];
      if (h && h.hidden) { const r = h.hidden(C, n); if (r != null) return r; }
      if (n.role === 'master' && C.flag('lg' + C.map.room)) return true;
      // 博士开场时在外面被追，救下她以前她不在老地方
      return C.map.id === 't0' && n.role === 'talk' && n.id === '1' && !C.flag('starter');
    },
    look(C, n) {
      const h = ISLES[C.map.isle];
      if (h && h.look) { const r = h.look(C, n); if (r) return r; }
      if (C.map.id === 'i0H' && n.role === 'house') return { name: 'Mom', g: 'f', look: P.LOOKS.mom };
      return null;
    },
  };
})();
