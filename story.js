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
    const k = Math.floor(Math.random() * w.dlgs.length), it = w.dlgs[k];
    const opts = [{ c: true, t: it[1] }, ...it[2].map(t => ({ t }))].sort(() => Math.random() - .5);
    let ok = false;
    await C.talk([nar(it[0], '雕像在问你问题。选出合适的回答，再大声说出来。', { kind: 'answer', opts, q: { kind: 'dlg', w: z, i: k }, pass: () => { ok = true; return []; }, fail: () => [nar('The statue stays dark. Try again!', '雕像没有亮。再试一次吧！')] })]);
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
  }

  // ---------- 各岛的剧情（isles/*.js 用 EchoStory.isle(z, hooks) 登记） ----------
  const ISLES = {};
  const isleHook = (hook, C, arg) => { const h = ISLES[C.map.isle]; return h && h[hook] ? h[hook](C, arg) : null; };
  const legacy = C => !ISLES[C.map.isle];

  // ---------- 对外 ----------
  window.EchoStory = {
    isle(z, hooks) { ISLES[z] = hooks; },
    lib: { P, prof, mom, nar, HUSH, CH, rival1, sayer, me, speak, ask, hushFight, rivalFight, rivalTeam, restoreCrystal, echodrakeWakes, legendMeet, leagueBattle, hallOfFame, chFlag },
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
