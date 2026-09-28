# 各岛施工规格（给写 isles/*.js 的人看）

先读 `WORLD.md`（世界设计：13 座岛的地貌、建筑、剧情、道馆机关、秘传技能、配角）和 `CLAUDE.md`（项目约定）。本文件是**怎么写**。

- 每组岛一个文件：`isles/a-hello-crayon.js`（0–1）、`isles/b-farm-school-lab.js`（2–4）、`isles/c-circus-clock-party.js`（5–7）、`isles/d-jungle-city-sports.js`（8–10）、`isles/e-snow-ruins-league.js`（11–12 + 冠军之路 + 冠军赛大厅）。
- **只改自己的文件**和自己的测试 `tests/isle-X.test.js`。引擎（maps.js / world.js / world3d.js / story.js / monsters.js / people.js）不要改；缺什么功能写在你的最终报告里，或者在自己文件里用现有接口绕过去。
- 注释用中文；游戏里每句英文都要配中文。英语按初一水平：短句、常用词，**用这座岛的课本话题**（`window.WORLDS[z]` 的 words / sents / dlgs，见下）。
- 不能用宝可梦的名字、人物、怪兽；只借鉴玩法。
- 文件是普通 `<script>`，写成 `(function () { 'use strict'; ... })();`，加载时 `EchoMaps`、`EchoStory`、`EchoPeople` 已经在了。

## 1. 地图定义

```js
const EM = window.EchoMaps, ST = window.EchoStory, L = ST.lib, P = EchoPeople;
EM.define('t2', {
  kind: 'town',            // town / route / cave / inside / under（海底）
  z: 2,                    // 第几岛：决定野生怪兽等级（2+2z）、话题、主题风格
  name: '温馨家庭岛', en: 'Family Island', sub: '第 3 岛',  // 左上角和进地图时的横幅
  theme: 'farm',           // 可省略，默认按 z。可选：hello crayon farm school lab circus clock party jungle city sports snow ruins
  rows: [ ... ],           // 地图，每行一样长；最大 48 宽 × 80 高
  npc: { 1: {...}, 2: {...} },   // 地图里的数字 1–9 是人
  people: [{ x: 5, y: 7, ... }], // 数字不够用时直接写坐标（坐标上的地块要是能走的地）
  signs: [['Welcome to Family Island!', '欢迎来到温馨家庭岛！'], ...],  // 按 B 从上到下、从左到右的顺序
  marks: [['A big windmill.', '一座大风车。'], ...],   // 户外 Z 地标按 A 时的话（顺序同上）
  markKinds: ['scarecrow', 'fountain'],               // 地标的样子（默认按岛）：anchor crayon scarecrow bell telescope balloon clock gift totem light trophy snowman stone fountain boat statue
  items: ['potion', 'superball'],        // 地图上 o 的道具（顺序同上）；不写就随机
  hiddenItems: ['revive'],               // * 藏起来的道具
  links: { s: 'r1', n: 'r2', e: ['r2e', 'r2e'], K: ['c3'], '%': ['d6b'], e: 't3', D: ['u9'], U: ['s9', 's10'] },
  doors: { A: 'd11a', H2: 'i2H2' },      // 房子的门通向哪里（默认 'i' + z + 房子编号，比如 i2H、i2H2、i2A）
  styles: { A: 'windmill', H2: 'farm' }, // 某一栋房子换个样子（默认按岛）：见第 3 节
  lv: 2,                   // 野生怪兽再高几级（洞穴、迷宫常用）
  hab: 'cave',             // 野生怪兽的栖息地 grass / cave / water（不写：洞穴 cave，其余 grass）
  dark: true,              // 洞穴默认漆黑要闪光；ice / lava / base / temple 洞穴默认亮
  cave: 'rock',            // 洞穴的样子：rock / ice / lava / base（基地）/ temple（神殿）
  sea: true,               // 海上的路：地图外面画成海，不画树
  room: 'G',               // 室内的配色：C M G H J A L 1–5
  over: [ ... ], paint: { r: '#e53935', 1: { c: '#fff', t: 'Math' } },  // 室内机关地板图层（见第 5 节）
  oneWay: ['t5'],          // 单向出口（对面没有回来的出口也不报错）
  dungeon: true,           // 能用逃生绳
  start: [x, y],           // 没有入口信息时站哪里
});
```

### 地块

```
户外：# 边界树  T 树  . 草地  , 草丛(遇怪)  = 小路  ~ 水(冲浪)  D 深水(潜水点)  w 瀑布(攀瀑往上，往下会冲下去)
      F 花  B 告示牌  o 道具  * 藏起来的道具  S 沙地  R 岩壁  r 石头  L 台阶(只能往下跳)  f 栅栏  Z 地标  I 冰面(一直滑)
      n 小树(居合斩)  b 裂开的岩石(碎岩)  O 大石头(怪力推)
      ^ 北出口  v 南出口  < 西出口  > 东出口（必须在地图边上；连在一起的算一个出口）  K 洞口  % 楼梯/梯子  @ 起点  1–9 人
      C/c 怪兽中心/门  M/m 商店/门  G/g 道馆/门  H/h J/j A/a 房子/门（同一个字母可以有好几栋，连在一起的算一栋）  E 只能看的房子（没有门）
洞穴：X 岩壁  : 地面(遇怪)  e 出口地垫  （也能用 ~ I % r O b ^ v < >）
海底：. 沙  , 海草(遇怪)  R 礁石  U 浮上去的光圈
室内：W 墙  _ 地板  u 地毯  Q 柜台  P 电脑  Y 桌子  k 书架  p 盆栽  d 床  t 电视  Z 雕像  e 门口地垫  | 机关门  % 楼梯  I 冰面
```

- 房子：用大写字母画一个长方形，门（小写）放在最下面一行，门下面一格要能走。房子至少 3 宽 × 3 高。
- 地图四周一圈要围住（`#` / `R` / `X` / `W`），出口格除外。
- 道路要有草丛或者水；训练师站在草丛里时写 `under: ','`。

### 出口怎么连

- 每组出口通向 `links` 里的一张图；**对面那张图也必须有通回来的出口**（测试会查）。到了对面就站在「通回来的那组出口」旁边，所以不用写坐标。
- 地图边上的出口：`n`（`^`）/ `s`（`v`）/ `w`（`<`）/ `e`（`>`）。同一边有好几个出口：写成数组，从左到右 / 从上到下。
- `K` 洞口（在岩壁上，从下面往上走进去）、`%` 楼梯（踩上去就走）、`e` 地垫（室内、洞穴的出口）、房子的门：按从上到下、从左到右的顺序对应数组。
- `D` 深水：连在一起的一片算一个潜水点，冲浪到上面按 A，要有「潜水」。`U` 海底光圈：按 A 浮上去。
- 两张图之间连了两次（比如一条环路两头都通回小镇）：两边都写两次，按顺序配对。
- 室内地图的门口地垫 `e` 要写 `links: { e: 't2' }`（通回有这扇门的那张图）。用模板的房子（i2C、i2M、i2H、i2J……）不用写。
- 怪兽中心 `C` 和商店 `M` 用模板就行（不用自己画室内）。道馆 `G` 要自己画（有机关），剧情用的房子自己画，普通民房可以用模板（`H` 模板里是随机村民，`J` 模板里是答题送药水的人）。

### 各组地图的编号和接口（跨组的出口必须按这张表连）

| 组 | 地图 | 连到别的组 |
| --- | --- | --- |
| A（0–1） | t0 r0 r0b c0 t1 r1w f1 r1 + 室内（i0G i1G …） | r1 的北出口 `^` → t2 |
| B（2–4） | t2 r2e r2 t3 r3m c3 r3 t4 r4 + 室内 | t2 的南出口 `v` → r1；t4 渡轮（ferry 人物，`to: 't5'`，要 5 枚徽章） |
| C（5–7） | t5 r5 t6 d6a d6b r6 t7 s7 u7 + 室内 | t5 渡轮回 t4（ferry 人物 `to: 't4'`）；s7 的东出口 `>` → t8 |
| D（8–10） | t8 j8 h8a h8b s8 t9 s9 u9 s10 t10 c10 r10 + 室内 | t8 的西出口 `<` → s7；r10 的北出口 `^` → t11 |
| E（11–12） | t11 d11a d11b r11 t12 d12a d12b v1 v2 v3 vL + i12L（冠军赛大厅，`links: { e: 'vL', n: 'i121' }`）+ 室内 | t11 的南出口 `v` → r10 |

渡轮：`{ role: 'ferry', name: 'Captain Gale', look: 'gale', to: 't5', how: 'door:C' 或 'from:xxx'（可省：到对面的起点）, badge: 5, need: '剧情旗标（可省）', toName: '社团岛', say: [[en, zh], ...], no: [[en, zh], ...] }`。对面的港口要站得下。

### 主路要被卡住（测试会查）

有 b 枚徽章（打赢了第 0…b-1 岛的馆主）时：**能走到第 b 岛的道馆，但去不了第 b+1 岛**。用下面这些东西卡：

| 秘传技能 | 谁送（剧情里） | 几枚徽章能用 | 卡在 |
| --- | --- | --- | --- |
| 闪光 hm_flash | 回声洞的登山家（A） | 2 | 可选的暗洞 |
| 居合斩 hm_cut | 家庭岛树医生（B） | 3 | t2 → r2 的小树 `n` |
| 碎岩 hm_smash | 校园岛矿工（B） | 4 | 碎岩隧道 c3 的岩石 `b` |
| 怪力 hm_strength | 社团岛大力士（C） | 6 | 沙丘道 r5 的大石头 `O` |
| 冲浪 hm_surf | 爸爸（C，生日派对岛） | 8 | s7 海路 |
| 飞空 hm_fly | 小凯（D，动物岛） | 9 | 不卡路 |
| 潜水 hm_dive | 导师欧瑞（D，规则城） | 10 | s9 → 海底 u9 → s10 → t10 |
| 攀瀑 hm_falls | 天气岛气象台台长（E） | 12 | r11 的瀑布 `w` |

没有秘传技能卡的出口用**守卫**：`{ role: 'guard', badge: 7, name: 'Ranger Tom', look: 'ranger', say: [['The mountain path is closed. Only trainers with seven badges can go.', '山路封了，只有 7 枚徽章的训练师才能过去。']] }`——徽章够了守卫就不见了。守卫要站在窄路上真的挡住（测试会查）。
需要守卫的地方：t0→r0（1）、t1→f1（2）、t6→d6a 钟山（7）、s8 的海上巡逻（9，站在水上窄道也行）、t10→c10 冰洞（11）、t12→v1 冠军之路（13）。
- 秘传学习器用人物的 `give` 送：`{ name: 'Tree Doctor', look: 'treedoc', give: { item: 'hm_cut', flag: 'got_cut', say: [[en, zh]...], after: [[en, zh]...] }, say: [[...]] /* 送完以后说的话 */ }`，送过一次就不再送。要剧情做完才出现的人加 `showIf: '旗标'`；剧情做完就消失的人加 `hideIf: '旗标'`（旗标不带 `s:`，就是 `C.set('xxx')` 里的名字）。

## 2. 人物（npc / people）

```js
{ role: 'talk', name: 'Farmer Joe', look: 'farmer' 或造型对象, g: 'm'/'f', face: 'down', say: [[en, zh], ...], speak: '要跟读的一句（可省，读完送 10 金币，每天一次）' }
{ role: 'trainer', name: 'Camper Amy', look: 'kidF', g: 'f', face: 'left', sight: 4, under: ',', lines: [[en, zh]], win: [en, zh], after: [[en, zh]], types: ['grass', 'bug'], n: 2, lv: 1 }
      // types：队伍的属性；n：几只；lv：比这里的野生怪兽高几级；也可以 team: [['sprouty', 0], ['bubbly', 1]]（编号, 加几级）
{ role: 'guard', badge: 7, ... }   { role: 'ferry', ... }   { role: 'nurse' } { role: 'clerk' } { role: 'leader' }（道馆馆主，用 data.js 里的 boss）
{ role: 'quiz' }（答题送回声球）  { role: 'gift' }（看图说单词送药水）  { role: 'hiker' }（小贴士）
{ role: 'story', id: 'kai', ... }  // 剧情人物：talk 钩子里按 n.id 接管
```

- `look` 可以用 `EchoPeople.LOOKS` 里的名字：boy girl leo mia mom prof nurse guard teacher clerk leader hiker grunt gruntF whisper rumble mute champion master1–4，
  配角 **dad kai orion gale**，还有 treedoc miner strong octo weather swimmer swimmerF ranger police athlete chef clown kid kidF granny grandpa fisher scientist student studentF skier monk。
  也可以直接写造型对象：`{ skin, hair, style: spiky/ponytail/pigtails/bob/bun/long/short/bald, eye, hat: cap/band/nurse/helmet/straw/chef, hatC, hatLogo, shirt, shirt2, jacket, coat, apron, bottom, skirt: true, shoes, bag, glasses: true }`。
- 人的 `id`：数字人物是 `'1'`…，people 里是 `'p0'`… 或者你写的 `id`（剧情人物一定要写 id）。
- 训练师名字要有岛的特色（Farmer Joe、Student Amy、Swimmer Kate、Chef Mei……），台词用这座岛的话题。

## 3. 建筑和地貌风格

每座岛默认风格（`theme`）已经决定了树和房子的样子，3D 和 2D 都会画：

| theme | 树 | 房子 |
| --- | --- | --- |
| hello | 棕榈 | med 白墙红瓦 |
| crayon | 彩色铅笔 | crayon 糖果色方块 + 铅笔尖屋顶 |
| farm | 秋天的树 | farm 木板墙茅草顶 |
| school | 圆树 | brick 红砖平顶（宽的楼有钟楼） |
| lab | 细高柏树 | dome 玻璃圆顶 |
| circus | 棕榈 | tent 条纹帐篷 |
| clock | 松树 | tower 石塔铜顶 + 钟面 |
| party | 棒棒糖 | cake 蛋糕圆房子 |
| jungle | 热带大树 | hut 高脚树屋 |
| city | 圆树 | city 高楼 |
| sports | 果树 | market 遮阳棚小店 |
| snow | 雪松 | chalet 雪顶木屋 |
| ruins | 枯树 | temple 石头神殿 |

某一栋可以用 `styles` 换：上面这些，再加 `lighthouse` 灯塔、`windmill` 风车（会转）、`stadium` 体育场、`std` 普通房子。怪兽中心和商店不管哪座岛都是红顶 / 蓝顶（好认）。
**地貌要靠地图本身画出来**：海岛多沙滩和水，农场多栅栏 `f` 和花田，火山多岩壁和台阶，丛林多树和河，城市多直直的马路 `=` 和栅栏，雪山多冰面 `I` 和岩壁，古迹多石头和雾里的枯树。

## 4. 剧情（EchoStory.isle）

```js
ST.isle(2, {
  enter(C, how) { ... },   // 进这座岛的任何一张图（包括室内）；返回一个 async 函数就播放剧情，返回 null 什么也不做
  step(C) { ... },         // 每走一步（道馆机关、路上被对手拦住）
  talk(C, n) { ... },      // 和人说话；返回 async 函数就接管，返回 null 用默认对话
  tile(C, f) { ... },      // 对着 Z（雕像/地标）或 | 机关门按 A；f = { x, y, statue|gate }
  hidden(C, n) { ... },    // 返回 true 藏起这个人、false 显示、null 不管（每帧都会调，要快）
  look(C, n) { ... },      // 换掉某个人的名字 / 造型：返回 { name, g, look }
  busy: ['Our Family Crystal is gone! I cannot battle now.', '我们的家庭水晶不见了！我现在没心思对战。'],  // 剧情没做完时馆主说的话
});
```

钩子要**很快地判断**（每走一步都会调），没事就 `return null`。剧情函数里用 `C`：

| 接口 | 用法 |
| --- | --- |
| `C.map` `C.pl` | 当前地图（`id kind z isle W H grid npcs buildings over gates def`）、主角位置 `{x, y, dir}` |
| `C.flag(k)` `C.set(k)` | 剧情旗标（存档）。约定：**这座岛主线做完 `C.set('ch' + z)`**（`L.restoreCrystal(C, z)` 会帮你设），馆主才接受挑战 |
| `await C.talk([页, 页…])` | 对话。页：`{ who, look, g, en, zh }`；任务页 `kind: 'speak', target`（大声说）、`kind: 'answer', opts: [{t, c: true}, {t}]`（听了选回答再说）、`kind: 'choice', opts: [{html}], pick: i => []`（选项）；`hideEn: true` 只听不看英文 |
| `C.spawn({...})` `C.remove(n)` | 临时人物（离开地图就没了）。`{ look, name, g, x, y, face, role: 'story', id }`；`mon: 'zappy'` 画成怪兽 |
| `await C.walk(n, 'up', 3, 180)` `await C.walkPlayer('left', 2)` `C.face(n, dir)` `C.facePlayer(dir)` `C.faceEach(n)` `await C.alert(n)` | 走路、转身、头上冒「!」 |
| `await C.battle('trainer', { foes, trainer: { name, img: C.portrait(look) }, noWhiteout })` | 对战，返回 `'win' / 'lose' / 'caught' / 'run'`；野生：`C.battle('wild', { foes: [C.MG.newMon('zappy', 10)] })` |
| `C.MG.newMon(id, lv)` `C.MG.teamOf(types, n, lv, seed)` `C.MG.grown(id, lv)` `C.MG.zoneLv(z)` `C.MG.addItem(id, n)` `C.MG.healAll()` | 怪兽和道具 |
| `C.give(item, n)` | 送道具（带提示） |
| `C.openGate(i 或 'all', keep)` `C.closeGate(i 或 'all')` `C.gateOpen(i)` | 机关门 `|`（按从上到下、从左到右编号）；`keep` 存档记住一直开着 |
| `C.teleport(x, y, dir)` | 把主角放到某格（机关踩错了回起点） |
| `C.note(html)` / `C.note(null)` | 画面上方的提示条（现在要踩的颜色、红绿灯……） |
| `C.over(x, y)` `C.setOver(x, y, ch)` `C.refresh()` | 机关地板图层；改了以后 `refresh()` 重画 |
| `C.tile(x, y)` `C.skillReady('surf')` `C.hasHM('surf')` `C.badges()` | 查询 |
| `C.goMap(id, how)` | 换地图（`how` 同出口：`'from:t2'`、`'door:C'`、`{x, y, dir}`） |
| `C.E.say(text)` `C.E.SFX.win()` `C.E.toast(text, 'gold')` `C.E.confetti(160)` `C.wait(ms)` | 朗读、音效、提示、彩带、等待 |
| `C.rivalInfo()` `C.pname()` `C.plook()` | 对手（`{name, look, g}`）、主角名字、主角造型。台词里 `{name}` `{rival}` 会自动替换 |
| `C.E.W[z]` | 这座岛的课本内容：`words [[en, zh, emoji]]`、`sents [[en, zh]]`、`dlgs [[问, 答, [错的答案]]]`、`boss { name, emoji, hello }` |

`EchoStory.lib`（上面的 `L`）：

- `L.sayer(who, look, g)` → `S(en, zh, extra)` 生成对话页；`L.me(C)` 主角说话的页；`L.speak(C, target, zh)` 让主角大声说一句；`L.ask(S, en, zh, 对的回答, [错的], extra)` 听了选回答。
- `await L.hushFight(C, n, 'grunt' | 'gruntF' | 'whisper' | 'rumble' | 'mute', { lines, types, n, lv, win })` 和嘘声团打（n 是地图上那个人，可以 null）。返回 `'win'` 才算赢。
- `await L.rivalFight(C, k, lv)` 和对手打（k：第几次，2–6；队伍自动克制主角）。
- `await L.restoreCrystal(C, z)` 夺回水晶的收尾：念这座岛的句子（`L.CH[z].say`）、送 3 个超级球、`C.set('ch' + z)`。
- `await L.legendMeet(C, n)` 和地图上的神兽（`C.spawn({ mon: 'mindra', role: 'legend', x, y })`）对战；旗标 `leg:mindra`。在 enter 钩子里：`if (!C.flag('leg:mindra') && !C.npc(n => n.mon === 'mindra')) return () => { C.spawn(...); };`
- `L.P`（EchoPeople）、`L.prof`、`L.mom`、`L.nar`（旁白页）。

**每座岛的剧情要按 WORLD.md 的「本岛剧情」做成独特的事件**（不要又是「村民求助 → 两个团员挡门 → 念句子」的模板），要让孩子在剧情里**听懂英语、说英语**：听描述找人、问路、按时间表摆书……每个事件至少有一两个 `speak` / `answer` 任务。剧情结束调 `L.restoreCrystal(C, z)`。

配角出场（按 WORLD.md 第四节）：小凯 kai（A 认识、B 校园岛、C 钟山、D 送飞空、E 冠军之路最后对战）、导师欧瑞 orion（A 回声洞、B 天文台、C 钟山山顶、D 送潜水、E 回忆神殿）、爸爸 dad（C 回来送冲浪）、盖尔船长 gale（B/C 渡轮）、妈妈打电话（B t2、C t6、D t10：旁白「📞 Mom is calling!」+ 妈妈的对话页）。
对手 {rival}：B 在 r2（`rival2`）、C 在 t7 生日派对（`rival3`）、D 在 t10 运动会（`rival4`）、E 在 t12（`rival5`，之后一起对付嘘声团）。用 `L.rivalFight`。
神兽：A 岩石巨人 rockgiant（c0 深处，要碎岩）、B 念灵 mindra（r3m 山顶）、C 炎狮 flamelion（d6b 火山口，剧情后）、D 冰晶巨人 icegiant（c10 深处）、E 钢铁巨人 irongiant（v2）+ 回声龙 echodrake（d12b）。

## 5. 道馆机关

道馆是自己画的室内图（`kind: 'inside', room: 'G'`），馆主 `role: 'leader'` 在最里面，被机关门 `|` 挡着；道馆里再放 2–4 个训练师（`role: 'trainer'`，台词是这座岛的话题）。机关在 `step` / `tile` / `talk` 钩子里写（判断 `C.map.id === 'i2G'`）。
- **彩色地板 / 音符 / 脚印 / 日期**：`over` 图层（和 rows 一样大，`.` 表示没有）+ `paint`（字符 → 颜色，或 `{ c: 颜色, t: '文字', tc: 字的颜色 }`）。`C.over(x, y)` 查主角脚下是什么。
- 踩错：`C.teleport(起点x, 起点y, 'up')` + 提示；踩对：`C.openGate(i, true)`（`true` 存档记住，下次来直接开着）。
- 广播用 `hideEn: true` 的对话页（只听不看），`C.note('🎨 现在要踩：<b>🔴</b>')` 提示条。
- 冰面 `I`：主角会一直滑到撞上东西，`step` 钩子在滑停以后才调。
- **每个道馆都要真的能解开**（测试里走一遍），解开以后门一直开着（`keep`）；输给馆主回来不用再解。
- 馆主对话（`role: 'leader'`）引擎已经做好：说 hello、对战、赢了给徽章。剧情没做完（没有 `ch` + z）时馆主不接受挑战（`busy` 那句话）。

## 6. 数量和难度

- 野生怪兽等级 `2 + 2z`（+ `lv`）。训练师默认比野生高 1 级，`lv` 再加。每条路 3–6 个训练师，道馆 2–4 个。
- **比绿宝石复杂**：小镇 24–40 宽高，道路 20–40 宽 × 30–70 高，有分岔、环路、只能跳下的台阶近路、要回来用秘传技能才能拿的道具、藏起来的道具 `*`、钓鱼的水塘；迷宫有死胡同和多条路。每张户外图至少 2 个道具、1 个藏起来的道具。
- 每座岛：小镇（C、M、G + 至少 3 栋房子，1–2 栋剧情建筑）、1–3 条路 / 迷宫、自己画的道馆、剧情里用到的室内。

## 7. 测试（交之前必须全过）

1. `ISLES=2,3,4 node tests/maps.test.js`（换成你的岛号）：地块、出口配对、从每个入口都能走到所有东西。
2. 写 `tests/isle-b.test.js`（用 `tests/helpers.js`，看 `tests/isle-a.test.js` 的写法）：
   - 用存档直接跳到你的岛（`t.save({ map, badges, flags, team, bag })`），**把主线剧情从头走一遍**（`t.idle()` 自动点对话、完成任务、打完战斗），检查旗标；
   - 每个道馆机关按正确的解法走一遍，门打开，能和馆主对战；踩错一次会回起点；
   - 秘传学习器能拿到；守卫在徽章不够时挡路；
   - 截图（2D：`gfx: '2d'`；再用 `gfx: 'mid'` 截 3D 的小镇和道馆），**用 Read 看截图**，确认好看、没有穿帮。
3. `node tests/isle-b.test.js` 全过、没有页面报错。

跑测试：`cd /d/Claude/echo-island && node tests/isle-b.test.js`（Windows 的 Git Bash）。Bash 里 heredoc 会把 `\n` 折成换行，写文件用 Write 工具。
