# 回声岛 Echo Island — 给接手的 Claude 的交接说明

这是一个给中国初一学生（七年级）练**英语听说**的网页游戏。家长的目标：玩三年（初一到初三），能流利说英语。
和家长沟通用中文；代码注释用中文，和现有代码保持一致。

## 现状（已完成）

纯静态网页，没有构建步骤，直接打开 `index.html` 或 `python -m http.server 8000`（Mac/Linux 用 `python3`）。

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页面骨架，`<head>` 里先加载 `errlog.js`（出错记录，后面的文件加载时出错也记得到），再按顺序加载 data → book → cartoon → vendor/three.min.js → dex → monster3d → battle3d → monsters → people → maps → world → world3d → story → isles → talk-npcs → talk-core → talk → game |
| `errlog.js` | `window.EchoErr`：没接住的错误、Promise 失败、3D 画面丢了、聊天连不上的原文（`log(种类, 内容, 哪里)`），最近 50 条存 `localStorage['echo-errs']`；`list()` / `count(天数)` / `clear()`。周报底部诊断一行、家长设置「🔧 出错记录」用 |
| `style.css` | 全部样式（单一明亮主题，颜色变量在 `:root`） |
| `data.js` | `window.WORLDS`：13 个话题小镇的单词/句子/对话；`window.SCENES`：13 段对话动画台词 |
| `book.js` | **课本同步** `window.BOOKS`：沪教版（上海教育出版社 2024 新教材）初中英语七上、七下、八上、八下、九上（各 8 单元）、九下（新书 2027 春才出，先用旧版 6 单元）。每单元 = 书后单元词汇表的全部单词短语 + 16 句 + 12 段对话 + 语法提示 + Boss，格式和 `WORLDS` 一样。**由 `node tools/book/build.js` 从 `tools/book/<册>.json` 生成**（同时把每单元的 AI 聊天角色写进 `talk-npcs.js` 的 BEGIN/END 之间），不要手改。词表是对着课本扫描页两人独立转写再核对的；句子对话是子代理按单元话题/语法新写、两轮审校的（不抄课文）。`BOOKS.start` = 弟弟上初一那年（2026），按日期猜现在学到哪册哪单元 |
| `cartoon.js` | `window.Cartoon`：SVG 画的对话动画角色、场景背景、16 种怪兽 |
| `dex.js` | `window.DEX`：**386 只原创怪兽**（`list` / `byId`）、17 种属性和克制表 `eff()`、每属性 3 个招式 `MOVES`、7 种进化石 `STONES`。怪兽列表由 `node tools/build-dex.js` 从 `tools/dex/*.json` 生成（会检查编号、重名、进化链、参数），数据规格见 `tools/DEX_SPEC.md` |
| `monster3d.js` | `window.Mon3D`：怪兽的样子。**默认用发布的会动的模型**（`assets/mon3d/<id>.glb`：蒙皮 + 贴图 + idle/walk/attack/hit/faint 五个动作，`play(R, 名字)` 播动作）：启动时读 `assets/mon3d/index.json`、`assets/mon2d/index.json`（`ready`，最多等 2 秒，读不到就不用），`preload(列表)` 按需下载、同时只下一次、最近用过的留 16 只（多了释放没在用的）；`build(sp)` 模型已下载就用，没有就先用程序拼的模型、后台下载。没有模型的怪兽用程序拼的卡通模型（12 种身体 + 头饰/尾巴/翅膀/花纹/装饰，描边、三阶明暗、眨眼、呼吸、摇尾巴）。异色：模型贴图在 shader 里转色相 150°，2D 图标逐像素转同样的色相。`snapshot()` 给菜单、图鉴、队伍和大地图用：有 2D 图标（`assets/mon2d/<id>.webp`）就用图标，没有就截 3D 图。`?art=proc`（或 `localStorage['echo-art']='proc'`）强制全用程序模型；`?art=blender / gemini / 3d` 是老的样品对比模式。`file://` 打开时读不了资源，全用程序模型（测试就是这样跑的）。预览：`tools/mon3d.html?from=1&to=386` |
| `assets/` | 随网页发布的美术：`arena/*.jpg` 战斗远景画、`mon3d/*.glb` 怪兽模型（meshopt 压缩 + WebP 贴图，每只约 200KB）、`mon2d/*.webp` 怪兽图标（256×256 透明）、两个 `index.json`。由 `node tools/mon3d/publish.js` 从 `art/` 生成，不要手改 |
| `battle3d.js` | `window.Battle3D`：3D 战斗画面，出场、放招、受击、倒下、扔球收服，17 种属性各有小招/中招/大招特效（粒子、光束、闪电、冰刺、落石、陨石……）。预览：`tools/fx.html` |
| `battle-fx-elements.js` / `battle-fx-energy.js` / `battle-fx-physical.js` / `battle-sfx.js` | **战斗特效 2.0**（2026-10-07 家长：「技能特效更加炫酷，可以加入技能动画」）。规格和 `kit` 接口全在 `tools/FX_SPEC.md`：`battle3d.js` 的 `attack(side, type, tier, support, info)` 串起「蓄力（属性光、脚下光圈）→ 大招过场（属性色斜横幅 + 速度线 + 立绘 + 英文招式名大字，中招是顶上小横幅）→ 扑击 / 大招特殊动作 → 出招（`BattleFX.types[type].release`，**命中瞬间 resolve**）→ 通用命中层（命中星、冲击波、限频闪光、大招放慢 + 发光后期）→ 余韵（地面贴花）」；三个 `battle-fx-*.js` 按属性登记 `charge/release/impact/after`，`battle-fx-physical.js` 还有 17 个属性的辅助招式；`battle-sfx.js`（`window.BattleSFX`）是合成音效。新工具：能量光束、分叉闪电、火焰、冲击波、命中星、贴花、拖尾、周身光、魔法阵、临时点光源、放慢、发光后期。画质 high / mid / low（粒子上限、灯光、后期按档缩减）。**安全**：全屏闪每秒 ≤ 3 次（`kit.flash` 自动限频）、不用饱和红色全屏闪、被打的怪兽只平滑淡出一次（不频闪）。检查：`tools/fx.html` 预览，`node tools/fx-shots.js <属性> <档>`（或 `all`）每招截 12 帧拼成接触印样 `tests/screenshots/fx/`，还查时长、闪屏次数、显存泄漏 |
| `monsters.js` | `window.MonsterGame`：战斗规则（说英语攻击/听英语防御、每只 4 个招式、双属性克制、本属性加成）、收服（回声球/超级球，神兽难抓）、升级、按图鉴等级或进化石进化、野外怪兽表（按区域、地形、稀有度）、13 个主题属性道馆、训练师；队伍 6 只 + 电脑箱子；背包道具 `ITEMS`；分页图鉴 |
| `people.js` | `window.EchoPeople`：日系 Q 版人物画法（4 方向 × 3 帧动作图集 `atlas()`、对话头像 `portrait()`、大立绘 `standing()`），全部造型 `LOOKS`（主角男/女、对手 Leo/Mia、妈妈、博士……）。改人物后打开 `tools/people.html` 看全部造型 |
| `story.js` | `window.EchoStory`：剧情核心（开场、选伙伴画面、第一次遇到对手、英语冠军赛四大师规则、名人堂）+ 各岛剧情的登记表 `EchoStory.isle(z, hooks)` 和公用工具 `EchoStory.lib`。world.js 在进地图/走一步/说话/对着地标按 A 时调用 `enter/step/talk/tile`，`hidden/look` 可以藏起或换掉地图上的人。剧情进度存在 `world.flags` 里 `s:` 开头的键 |
| `isles/*.js` | **13 座岛的内容**（每组岛一个文件）：手画的地图（`EchoMaps.define`）、本岛剧情、道馆机关。写法见 `ISLES.md`，世界设计见 `WORLD.md` |
| `maps.js` | `window.EchoMaps`：地图引擎。地块表、13 座岛的风格 `THEMES`（地面配色、树、房子）、地图登记表 `define(id, def)`、出入口分组和配对 `link()`（地图四边的出口、洞口、楼梯、门、地垫、潜水点）、到达点 `arrival()`（`from:来的地图@第几组:偏移`）。没登记的地图（怪兽中心、商店、普通民房）用这里的老模板 |
| `world.js` | `window.EchoWorld`：大地图逻辑——按地图 id 切换、走路、跳台阶、冰面滑行、瀑布、潜水/浮上来、楼梯、机关门、门/洞口/出口、草丛和洞穴遇怪、训练师视线、护士/电脑/店员/馆主/出题人/送礼村民/渡轮、秘传技能、驱怪喷雾、逃生绳、宝可梦式对话框（可以只听不看英文）；2D「流畅模式」渲染器；自动画质 |
| `world3d.js` | `window.EchoWorld3D`：three.js 的 2.5D 渲染器（地面贴图 + 低多边形树/房子/岩壁 + 随风摆的草丛 + 水面着色器 + 纸片人物 + 移轴景深）。三档画质 high/mid/low：自动画质在 APK 里、或内存 ≥8GB / 8 核以上且有 WebGL2（软件渲染不算）时从 high 开始（DPR 最高 3、限 60 帧），否则从 mid 开始，跑不动自动降档 |
| `vendor/three.min.js` | 裁剪过的 three.js（只打包用到的类，含 GLTFLoader + MeshoptDecoder + SkeletonUtils）。要加新的 three 类：改 `tools/three-entry.js`，跑 `npm run build:three` |
| `talk-npcs.js` / `talk-core.js` / `talk.js` | **和岛民用英语自由聊天（AI 语音）**：`talk-npcs.js` 是岛民名单（8 个岛民 + 每个课本单元一个角色，人设、音色、对话目标），游戏、中转服务、APK 共用；`talk-core.js`（`window.TalkCore` / Node 模块）是对话核心：安全规则和人设 `instructions()`、地图上随便一个人的临时人设、聊完打分的请求和解析、`session()`（游戏消息 ⇄ Qwen-Omni 实时语音事件的翻译、计时、记录）——**中转服务和 APK 直连跑的是同一份**；`talk.js`（`window.EchoTalk`）是首页第三个标签和对话界面——按住说话（16kHz PCM 分块发出；一按下就出现自己的气泡，Qwen 边听边回的 `you_live` 字实时填进去，松开后 `you` 换成整段结果，按服务器的 item 编号对气泡，空的那段岛民答完 5 秒删掉；内容一变就滚到底）、岛民用自己的音色回答（24kHz PCM 边收边播）、显示双方的话、聊完打星给金币、老师给的「更好的说法」进每日复习、本机聊天记录。APK 里有原生桥 `EchoNative` 时走 `directSocket()` 直连阿里云（装成和中转服务一样的 WebSocket），还提供 `listenOnce()`：口语题的识别（边说边送 qwen3-asr-flash-realtime，对上答案立刻结束；不行再整段走 qwen3-asr-flash），给口语题自动打分 |
| `android/` | **安卓 APK**（弟弟的手机是 REDMI Turbo 5）：全屏 WebView 壳，游戏文件打包时整个复制进 `assets/www`（离线能玩），用 `https://appassets.androidplatform.net` 打开（麦克风、fetch 才能用）；原生桥 `EchoNative`（OkHttp）带着百炼密钥连阿里云实时语音和 HTTPS，只许连 `dashscope.aliyuncs.com`，网页拿不到密钥本身；密钥来源：手机上「设置 → AI 聊天和口语打分」填的（SharedPreferences，优先），没有就用打包时 `echo.properties` 的 `KEY_FILE`（**家长 2026-10-07 定：密钥照旧打进 APK**，本机指向 `D:/Claude/tools/echo-relay/game-key.env`，游戏专用那把）。家长密码 `PARENT_PIN` 只以加盐 SHA-256 进 `BuildConfig`，`PinGuard.java` 核对（错 5 次锁 10 分钟）；`checkReleaseConfig` 没有正式签名或家长密码就停下（不再退回调试签名）；版本号 versionCode = git 提交数、versionName = 日期-短哈希；存档每天写一份到手机「下载/EchoIsland」（留 7 份，`BackupNames.java`）、`shareFile` 导出、`backupPick` 选文件恢复；渲染进程挂了 `onRenderProcessGone` 重建 WebView；麦克风永久拒绝能 `openAppSettings()`。方法全表在 `android/README.md`（加方法要同时改 README 和 `tests/fake-native.js`，`tests/native.test.js` 核对）。返回键交给 `window.EchoBack`。打包和安装见 `android/README.md`；JDK 17 / Gradle 8.10 / Android SDK 装在 `D:\Claude\tools\android`，模拟器 `echo35` |
| `server/` | AI 对话中转服务（Node + ws）：保管百炼密钥，按岛民 id 连 Qwen-Omni 实时语音，每天时长上限、家庭口令、对话记录 `/logs`。说明见 `server/README.md`（不在 GitHub Pages 上运行，要单独部署） |
| `music-core.js` / `music.js` / `music-data.js` | **配乐**（2026-10-06 家长要的）：全部用 WebAudio 现场合成，GBA 掌机风格，没有音频文件（APK 不变大、没网也能放、没有版权问题）。`music-core.js`（`window.MusicCore` / Node 模块）是乐谱格式的解析和检查；`music-data.js`（`window.MUSIC`）是 27 首曲子，**由 `node tools/music/build.js` 从 `tools/music/songs/<id>.js` 生成，不要手改**；`music.js`（`window.EchoMusic`）是合成器和播放器：`play(id)` 交叉淡入淡出换背景音乐、`jingle(id)` 一次性小音乐（背景音乐暂停、放完接着放）、`duck(on)` 朗读时压到 30%、`hold(on)` 麦克风在听时完全静音、`setVolume`、`render()` 离线渲染。乐谱写法、音色、曲目表在 `tools/music/SPEC.md`；试听页 `tools/music.html`；`node tools/music/render.js` 离线渲染全部曲子查电平/削波/循环接缝（`--levels` 生成各曲音量校正 `tools/music/levels.json`，build 时并进曲库）。自动化测试里引擎默认不出声，网址带 `?music` 才打开（`tests/music.test.js`） |
| `game.js` | 主程序：存档、朗读（自然配音 + 有道在线兜底）、语音识别与打分（APK 里用阿里云识别）、闯关练习（📗 课本同步每单元 7 关 + 13 岛 × 7 关；`WX = WORLDS.concat(课本单元)`，课本单元从第 13 号起编号）、**每日复习**（间隔复习 `S.rev`：答错当天复习，复习答对隔 1、2、4、7、15、30 天再来，第 7 格算掌握（不删，周报「累计掌握」）；课本新学的第二天复习一次，带提示学到的按「弱」进来；AI 聊天里老师改过的句子第二天练（存孩子原话 `said`）；家长定的量：一轮 `REV_N` 20 题、每天新进 `REV_NEW` ≤ 10 条（带提示的也占名额）、今天到期的积压 > `REV_BACKLOG` 40 条就不加新的、上限 `REV_MAX` 3000 条没掌握的；谁逾期最久谁先来；冒险里（对战、村民出题）答对今天到期的题也算一次复习、每天最多 `REV_FIELD` 20 次，对战没念准只降一格 `revMiss`，对战先出到期的题 `revPick`；首页「今日复习」卡片）、**冒险出题来源** `src(z)`（按设置有几成换成课本正在学的单元）、对话动画剧场、每日任务（连得上 AI 时每天固定一个「和岛民聊天」任务）、成就、宠物店、设置；最后把工具以 `api` 对象交给 MonsterGame / EchoWorld |

关键约定：
- 所有按钮用 `data-act="名字"`，由 `game.js` 里的 `ACT` 对象统一处理；monsters.js / world.js 通过 `init()` 返回自己的 actions 合并进去。
- 存档在 `localStorage['echo-island-v1']`，结构见 `game.js` 的 `fresh()`；新增字段要在 `fresh()` 里给默认值（`merge` 会自动补给老存档）。**不要在 `fresh()` 里放版本号**——merge 会让老存档看起来已经迁移过；版本号由迁移函数写（`EchoWorld` 的 `migrate()`、`MonsterGame.migrate()`）。
- 地图 id：`t0`–`t12` 小镇（飞空、`visited` 用），其余地图的编号见 `ISLES.md` 的接口表（道路 `r…`、海路 `s…`、洞穴/迷宫 `c…` `d…` `h…` `v…`、海底 `u…`、室内 `i{z}{房子编号}`）。改地图后跑 `node tests/maps.test.js`：每行长度、未知地块、出口两头配对、到达点能站、从每个入口都能走到所有出口/人物/道具，并且**按徽章数走一遍整个世界**：有 b 枚徽章能到第 b 岛的道馆、去不了第 b+1 岛（秘传技能和守卫真的卡住主路）。`ISLES=2,3 node tests/maps.test.js` 只查某几座岛。
- 秘传技能（仿绿宝石）：剧情里的人送秘传学习器（`hm_cut` 等重要物品）+ 要够徽章才能在野外用：闪光 2、居合斩 3、碎岩 4、怪力 6、冲浪 8、飞空 9、潜水 10、攀瀑 12（在本岛拿到，打赢本岛道馆才能用，正好卡住去下一座岛的路）。
- 剧情脚本写法：钩子返回一个 async 函数，用 world.js 提供的 `SC`（`talk` 对话、`spawn/walk/remove` 临时人物、`battle`、`scene()` 全屏画面、`setOverlay` 接管按键、`flag/set` 剧情进度、`openGate/closeGate` 机关门、`teleport`、`note` 提示条、`filter` 画面滤镜、`over/setOver/refresh` 机关地板）。台词里 `{name}` `{rival}` 会换成主角和对手的名字。完整故事线在 `STORY.md`，各岛的写法和 `C` 接口全表在 `ISLES.md`。
- 渲染器接口：`load(map)`、`resize()`、`draw(now, V)`、`destroy()`；`V` 由 `world.js` 的 `view()` 每帧给出（主角/跟随怪兽/人物/道具/提示的位置）。2D 和 3D 共用的画法（人物、地面）在 `EchoWorld._art`。
- 屏幕切换用 `show(id)`：home / play / result / theater / battle / world。切换时给 body 加 `scr-<画面>` 类，横屏排版靠它。
- **操作和横屏**（2026-10-06 家长要求「横屏选项」「摇杆和 AB 融进游戏里，像王者荣耀」）：大地图画面铺满全屏，HUD 半透明浮在顶上；操作浮在画面上——左半边按哪里摇杆就出在哪里（`world.js` ensureDom 里的 `#w-joy`，格子地图只取上下左右、带死区和防抖），右下角大 A、左边 B、上面「英语聊天」排成弧形；对话框/过场出来时操作自动藏起（CSS `:has()`）。设置「冒险里的操作」可换回方向键（`S.settings.ctl` = joy / pad，`EchoWorld.ctlMode()`）。横屏：设置「屏幕方向」竖屏 / 横屏 / 跟着手机转（`S.settings.orient`，APK 里 `EchoNative.setOrientation`，原生记住下次直接用）；浏览器里横过手机也会套横屏排版。横屏样式都在 style.css 末尾的 `@media (orientation: landscape) and (max-height: 600px)` 里（对战左战场右招式、题目四个选项一行、弹窗变宽分栏……），竖屏不受影响。
- 口语打分（家长 2026-10-06：**打分要 AI 来打、默认开口、必须开口说**）：`speakMode()` 返回 `'sr'` 或 `'self'`。APK 里一律 `'sr'`：录一句交给阿里云**不带答案地听写**，再和目标句子逐词比对打分。**识别是边说边送的**（家长 2026-10-06：「识别单词有没有办法秒识别」）：`EchoTalk.listenOnce` 一点话筒就录、同时连 `qwen3-asr-flash-realtime`（APK 走原生桥 `wsOpen`，网页版走中转服务的 WebSocket `/asr-rt`），连上前录到的先存着再补发；服务器边听边回文字（`stash` 是还没定下来的那截，界面上一个个冒出来）；`recognize(onInterim, 答案们)` 把这道题的答案交给它，**实时结果一和答案对上（90 分以上）就立刻结束**——说完 0.1–0.4 秒出分（以前要等 1.1 秒停顿再整段上传，2 秒多）；对不上就等服务器判断说完（单词停顿 0.4 秒、句子 0.6 秒）；实时识别没连上 / 没认完就用录好的整段走 qwen3-asr-flash。麦克风说完后预热 15 秒（连着说不用重新打开），切后台、开始和岛民聊天时关掉。`recognize()` 开始时停掉正在放的朗读（别让识别听到示范读音）（`scoreSpeech()`，0–100，没读准的词标红）；低于 90 分时 `aiTip()` 把「目标句子 + 听到的话」交给 qwen-plus 给一句中文点评（哪个词读错、怎么读对）。试过让 Qwen-Omni 直接听录音打分——它会被目标句子带偏（读错的句子也给 85、把 potion 听成目标里的 lotion），所以不用。开口模式下没有「跳过这题」：练习说三次不行记进每日复习；大地图的说话任务说三次不行才出现「先跳过」；没网时提示联网后再说，不会退回自评。网页版走中转服务的 `/asr`、`/tip`（要家庭口令），连不上才用浏览器识别 / 录音自评；`录音自评` 只留给 `?quiet` 测试链接和测试脚本（tests 里都设 `mode: 'self'`）。
- **先学习再冒险（学习锁）+ 学习周报**（家长 2026-10-06 要的，2026-10-07 按评估改过）：`game.js` 的 `gate()`——每天先做完「一轮每日复习」（`dayLog().revSess`，复习答对一半以上才算；没有到期的题自动算完成）和「聊天」（今天完成过一个聊天小目标，**或者用语音说满 6 句英语**：`EchoTalk.today()`，一句要 ≥3 个英文词、不含中文、不是重复的；打字的标 typed，不算句数、不给金币、不开锁），首页才放出「去冒险」，大地图的进入/飞空也拦（`gateBlock()`）。首页学习锁卡片、聊天界面顶上、复习结果页都显示「已开口说 n/6 句」；复习做完还差聊天时结果页主按钮是「🗣️ 去和岛民聊天」。豁免：AI 聊天没开通（`noai`）整天免（🟡 `gateEx`）；今天的聊天时间用完了（`chatDaily`）只有开口说过 ≥3 句才整天免，不然和没网一样；**没网**（`navigator.onLine` 为 false，或 Wi-Fi 连着上不了网：最近 10 分钟 AI 报过「找不到服务器」、今天聊天也没连上过 `chatConn`）或聊天连上以后服务器真出错（`chatFail`）只**临时放行 30 分钟**（不写 `gateOpen`，`passAt` 从第一次进大地图开始算，周报 📵），联网后回首页 / 进出地图重新检查；**密钥不对 / 额度用完**（`chatKeyBad()`）不放行，卡片写明「请告诉家长（家长可以在 🔒 家长设置 里暂时关学习锁）」、不给「去聊天」。真做完了（`gateOpen`）当天一直开着。过了零点人还在大地图里 / 切回前台时，等这段对话或战斗结束提示「新的一天！」回首页（world.js `kickCheck`）；手机日期往回改（`S.maxDay`）锁住并记下 `clockBack`，卡片上「👪 家长：从今天重新开始」（要密码，`clockReset`）。每天的学习记录在 `S.log[日期]`（`dayLog()`，留 45 天，字段说明在 `dayLog` 上面的注释；每周的关键数字另外永久存在 `S.weekly`）。周报 `reportSheet()`（首页工具栏 📊、学习锁卡片里的链接）：每天的标记 ✅🟡📵🔓⏰🌙、学习日 n/7、能力行（每句几个词、一次说对率、隔一周还记得，和上周比 ↑↓）、不看字说对几句（单个词另记 `recallW`）、需要家长看看的聊天、AI 花费估算、诊断一行（AI 失败、出错记录、版本号）——竖屏一屏放下给孩子截图发家长，横屏分两栏。可选日报推送（家长设置里填 PushPlus token 或企业微信群机器人地址，默认不发，每天 20 点以后发、没网排队）。测试存档里都设 `gate: false`。
- **家长密码**（评估第 4 条）：`parentOk(why, onOk)`。APK：打包时 `PARENT_PIN` 的加盐哈希，`EchoNative.hasPin()/checkPin(pin)/pinStatus()`，错 5 次原生锁 10 分钟（改时钟没用），**没打包密码就一律拒绝**（不再「谁先点谁设」）；网页版：`S.settings.pin`（第一次由家长设）、`S.settings.pinLock`。自己画的数字键盘、显示 ●，输错 / 被锁记进周报。输对以后只在**那个家长弹窗还开着时** 2 分钟内不用再输（`RT.parentUntil`；输完没有弹窗开着、关了弹窗、切后台都立刻作废）。要密码的：关学习锁、「全部关卡直接开放」（只对闯关练习生效，大地图的徽章 / 守卫 / 秘传不再认它，测试用 `?debug`）、课本比例、清空进度（还要输入「清空」两个字，清空前另存一份能找回）、从备份恢复、看有安全标记的聊天、冒险时间、日报推送、版本检查地址、AI 密钥、「剧情中文」改宽松（改成「点一下才显示」不用）。设置分「我的设置」和收起来的「🔒 家长设置」。
- **冒险时间**（评估第 18 条）：`S.settings.limit`（默认上学日 45 分钟、周末 90 分钟、21:30–07:00 不能冒险，家长设置里改）。只算大地图和对战；多学一点换时间 `bonusMin()`：多做一轮复习、多完成一个聊天目标、多通关一关**新**练习（第一次通关或星星变多，刷同一关不算）各 +10 分钟，每天最多 +30。还剩 5 分钟提醒一次；时间到了不半路掐断，等这场战斗 / 这段对话 / 剧情结束再回首页（`advTick` / `advStopWhy`）。大地图连续玩 35 分钟以上，一场战斗结束后弹护眼休息（`restModal`）。
- **存档备份**（评估第 7 条）：每天第一次保存前轮换本机 3 份备份（`echo-island-v1-bak1..3`）；存档读坏了先原样另存（`-bad`）、改用最近一份好的备份并提示，不覆盖；APK 每天往手机「下载/EchoIsland」写一份；设置「💾 导出存档」（APK 分享到微信、网页下载文件）、「从备份恢复」（要密码，恢复前 / 清空前的进度另存在 `-pre`）。存不进去（空间满了）第一次就弹窗请家长导出。
- **AI 用不了时**（评估第 3 条）：识别 / 点评的失败分成麦克风被拒、没网、密钥失效或额度用完、真没听清（`failOf` / `failHint`，`EchoTalk.lastErr()` 的 `why`）；没听清也算一次尝试；3 分钟里失败 2 次（`aiDown()`）时剧情说话任务、选伙伴、闯关题给「先跳过（已放进复习，联网后要补说）」（`revLater`，复习里欠着 `owe`），对战这一回合改成听音选招、不能暴击；麦克风被永久拒绝弹「去打开」（`openAppSettings`）；首页红条（`homeBars`）；第一次打开做「麦克风 + 网络 + 密钥」小检查（`S.micCheck`）。聊天连不上时孩子只看到一句话（「现在没网…」「AI 密钥不对，请告诉家长」「AI 额度用完了…」「AI 有点忙…」），原文只在灰色小字「（给家长看：…）」和出错记录里。
- **版本号**（评估第 19 条）：APK 的 `EchoNative.version()`，显示在设置页底部和周报角落；打开时查 `version.json`（默认 `https://dqq12125-glitch.github.io/private-note-/version.json`，家长设置里能改 `S.settings.verUrl`），code 比自己大就在首页挂蓝条「有新版本，请家长更新」。仓库根目录的 `version.json` 由家长发版时改。不做代码热更新。
- **聊天**（评估第 2、11、13、16 条）：`EchoTalk.today()` → `{ voiceLines, typedLines, goals, need, done, concern }`（学习锁用）、`EchoTalk.endIfOpen()`（返回键 / 切后台 = 结束并评价；评价超时也先存记录、照样计句数）。麦克风能用时打字框收起成「麦克风用不了？点这里打字」。帮孩子：💡 帮帮我（发 `[Game]` 提示，岛民给一句能照着说的）、🔁 再听一遍 / 🐢 慢一点、点岛民的气泡看中文、目标词卡带中文（说到了变绿）。每个角色 3 个目标（易 / 中 / 难，按聊过的次数轮换，`goalOf`），目标拆成 2–4 个小步骤实时打勾（`stepsBody`，打字的不算做到）；按步骤给星：全做到 3 星、差 1 步也算完成 2 星，用语音说的不到 3 句一律不算完成（`judge`）。岛民记得上次聊到的游戏里的小事和老师改过的一句（`S.talk.mem`，只存手机，`memOf` 过滤真名 / 学校 / 住址）。安全：开场白写在 instructions 里、孩子打的字加 `Student typed:`、评价记录包在 `<transcript>` 里、孩子认真问就承认是电脑做的游戏角色、说难过 / 被欺负时温和回应并让他找家长老师，打上 `concern` 标记（模型 + 本机关键词 `worried()`），家长输密码看全文，周报提示一行；起名时提醒用游戏昵称；聊天页「家长须知」写清哪些数据发到阿里云；中转服务的日志只留 90 天。
- **打分要诚实 / 撤提示**（评估第 8、9 条）：`scoreSpeech` 的模糊匹配只留给拼写变体（英式 / 美式、learnt / learned、识别结果丢了撇号的 dont / Its / whats 照样算对），易混的音（three/tree、went/want…）不算对，只错词尾算半对，同音词算对，漏掉四分之一以上关键实词不过关，有一个词没说对不给 Perfect / 暴击；人名（含短的拼音名 Li / Lin / Zhang / Wang Fang，`isPinyin`）放宽、不算「关键实词」（星期、月份、国家语言这类大写词照普通词打分，`NOT_NAME`）。秒出分要最后一个词已经按顺序说出来（`earlyMatch`）。点过提示 / 看过原文 / 第 2 次才说对 = 带提示通过（`P.aided`：不算 Perfect、不加连击、经验减半、复习里不升格）。AI 点评只说漏读 / 多读 / 说成了哪个词，不猜是哪个音。跟读题按复习格数撤提示（`fadeOf`：0–1 格看全文、2–3 格首字母「🔤 看首字母说」、4 格以上只给中文「🧠 凭记忆说」、聊天改过的句子显示原话「✏️ 改正说法」）；对战可选「🔥 不看字念」（念对 ×1.5）。
- **道馆跟着课本开**（评估第 10 条）：world.js `gymNeed(z)`——第 z 个馆主要先打败前 ceil((z+1)×16/13) 个课本单元的 BOSS 关（`S.stars[单元号-6]`），不够时馆主说 "Come back after you beat Unit N!"；`EchoWorld.nextGymNeed()` / `objective()` / `legendClues()` 给首页用（首页「继续冒险」下面的 📍 小字、「🏅 下一枚徽章」卡片、「✨ 传说的线索」卡片）。四只神兽是学习里程碑（story.js `MILES`：七上 8 个单元 BOSS 全过 → 霜羽鸟、聊天完成目标 30 次 → 雷羽鸟、连续打卡 30 天 → 焰羽鸟、不看字说对 300 句 → 摇篮灵；累计数存 `world.mile`），达成后在户外飞来。打通后馆主能重赛（+15 级、出题换成最近学的单元、每天第一次赢送进化石）；每日宝箱开进化石 / 蛋 / 异色道具；「怪兽大师」成就是点亮第一大区 151 种。目标提示：story.js `objective()`，大地图 HUD 一行、冒险菜单最上面「📍 现在要做」、进地图弹 3 秒。
- **剧情中文**（评估第 17 条）：`S.settings.storyZh` = auto（默认）/ tap / always。auto：第 1–4 岛总显示；第 5 岛起人说的话收成「译」按钮（点一下记 `zhTaps`，周报「看中文 X 次」），任务说明、旁白、道馆规则、`zhKeep` 的页照常显示。设置在 🔒 家长设置里（`EchoWorld.storyZhHTML()`）。
- **出错记录 / 画面恢复**（评估第 15 条）：`errlog.js` 的 `EchoErr`（见上表）；3D 画布 `webglcontextlost` 后重建；APK 渲染进程挂了重建 WebView（连挂 3 次显示出错画面），`EchoNative.takeRecovered()` 让网页提示「已经重新打开了」；画质上限：精美档 DPR ≤ 2、所有档 ≤ 60 帧、站着不动 30 帧，每 30 秒复查一次帧率。
- **朗读兜底**：有道在线发音现在整句会 500，只用于 ≤3 个词；没有提前配音的句子（带名字的台词等）现场用阿里云 `qwen3-tts-flash`（`EchoTalk.cloudTTS`：APK 直连、网页走中转服务 `/tts`，6 秒超时，同一句只合成一次）。
- **战斗口语题**：念完先停一下亮出答案（念到的词绿、没念到的红，没念好再放一遍标准读音，`monsters.js` 的 `reveal()`，`B.turn = 'show'`），再出招；第一次没念准给第二次机会时答案已经亮出来，所以第二次念对也**不能暴击**（`B.hinted`，和「💡 听一下答案」一样）。
- **路上的对手**（家长反映「没看到她就走过来找我打」）：1 号路、3 号路的对手进地图时就站在小路上（`EchoStory.lib.rivalStand`），走近几格才「!」一下走过来（`approach()`），不再从主角前面 5 格凭空出现。
- **配乐什么时候放哪首**：`game.js` 的 `sceneMusic()`——首页 `title`，闯关练习/复习/对话剧场 `study`，大地图问 `EchoWorld.music()`（`world.js` 的 `mapMusic()`：小镇按岛 `town_a` 0–4 / `town_b` 5–7 / `town_c` 8–10 / `town_d` 11–12，道路 `route`（0–5 岛）/ `route2`，冲浪、海路、海底 `sea`，洞穴 `cave`、嘘声团基地 `hush`，道馆 `gym`，其他室内 `center`，冠军之路和冠军赛 `league`）；战斗由 `monsters.js` 的 `battleMusic()` 选（馆主/冠军赛/神兽 `battle_boss`，训练师 `battle_trainer`，野生 `battle_wild`），打赢 `win`（第一次拿徽章 `badge`）再接 `victory`，输了 `lose`，收服 `catch`，进化 `evolve` + `levelup`，怪兽中心恢复 `heal`，拿道具 `item`，对手走过来 `rival`。`E.jingle(id, 原来的音效)`：音乐关着时退回原来的音效。**朗读 `say()` 自动 duck，`recognize()` / 录音自评 / 和岛民聊天自动 hold**——新加会出声或开麦克风的地方要走这两个函数。设置「音乐」关/小/中/大（`S.settings.music`）。
- 字体在 `assets/fonts`（Baloo 2、Nunito，SIL OFL），不连 Google。
- 调试入口：`EchoWorld._debug()` 可以拿到当前地图、玩家位置、渲染器，`goMap(id, how)` 直接传送（测试里用）。

## 怪兽 3D 资源

- `art/` 是**母版**（不进仓库，`.gitignore` 忽略）：`art/gemini/cut2/<id>.png` Gemini 画的抠好的图、`art/hy3d/` Hunyuan3D 生成的模型、`art/mon3d/<id>.glb` 绑好骨骼做好动作的模型（约 600KB，未压缩）。
- `assets/` 是**发布版**（进仓库、随 GitHub Pages 发布）：`assets/mon3d/<id>.glb`（约 200KB）、`assets/mon2d/<id>.webp`（约 15KB）和两个 `index.json`。游戏只读 `assets/`。
- 重新生成的流程：`tools/mon3d/gen.py`（图 → Hunyuan3D 模型）→ 写 `tools/mon3d/rigs/<id>.json`（骨骼位置，见 `tools/mon3d/RIGGING.md`）→ `bash tools/mon3d/rigtool.sh rig <id>`（`tools/blender/monrig.py` 绑骨骼、做五个动作，导出 `art/mon3d/<id>.glb`）→ **`node tools/mon3d/publish.js`**（压缩发布到 `assets/`，更新索引）。
- `publish.js` 按修改时间只做有变化的（可以反复跑；`--force` 全部重做，后面跟 id 只做这几只；刚写出来 10 秒内的文件先跳过）。3D 用 `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify false`（蒙皮和五个动作都保留，已核对过姿势和原文件一致）；贴图改 512（`TEX_SIZE=512 node tools/mon3d/publish.js --force`）只小两成左右，大头是几何。2D 图标用 Python + Pillow（裁透明边、放进 256×256、脚贴底）。没有 cut2 图的用 `art/gemini/cut/` 的。
- 现状（2026-09-30）：386 只都有原画，368 只有会动的 3D 模型，18 只（`hold.txt`，大多是生成出来像纸片的）先用原画纸片。
- 生成得太扁：`gen.py --pca --seeds=21,42,5,9` 用顶点主成分量厚度、多试种子挑最厚的；不加 `--turbo` 用完整版（50 步）有时更立体。脚下连着薄地面圆盘的：骨骼 json 里加 `"cutbase": 0.02`（`monrig.py` 删掉贴地的薄层）。
- 386 只都有 Gemini 原画（`assets/mon2d`）。还没有 3D 模型的（没生成完、或列在 `tools/mon3d/hold.txt` 里暂不发布的：模型太扁/多了底座/等重画），战斗里用 2D 原画立一张面向镜头的纸片（`monster3d.js` 的 `iconTex` + `buildImg`），不再用程序拼的模型。
- 出图流程：`art/gemini/families.json` 每个家族一张图（Gemini 网页版，`tools/mon3d/gembatch.py` 生成浏览器动作，撞脸宝可梦的在它的 `OVERRIDE` 里改描述；`gemwatch.py` 按队列把下载的图存成 `art/gemini/fam/NNN.png`）→ `tools/mon3d/split.py` 切成单只。`redo.txt` / `lookalike.txt` / `regen.txt` 记着要重画、撞脸、要重新生成 3D 的。
- 战斗：`monsters.js` 开战时 `prep()` 把双方队伍的模型都下载好（最多等 2.5 秒，没下完先用程序模型，出场前下完就换上）；换怪兽、对手换下一只、我方倒下换人前也会等一下；进大地图时后台下载自己队伍的，进化时下载新样子的。

## 必须遵守的限制

- **孩子的手机是 REDMI Turbo 5**（天玑 8500-Ultra、12+4GB、2756×1268、HyperOS 3），**最终交付是 APK**（`android/`）。家长的要求：孩子要真的能和 AI 用英语对话（不只是背单词），每天有错题本、温故而知新；课本是沪教版，要覆盖整个初中。
- **用户在中国大陆**：Google 服务（字体、Chrome 语音识别）基本不可用；很多安卓浏览器没有英语 TTS 声音，已用有道在线发音兜底。新功能都要在"没有语音识别"的情况下也能玩（自评模式）。
- **不能用宝可梦的版权内容**：名字、角色、怪兽、Logo 都不能用，只做"类似的玩法和风格"，怪兽和人物都是原创。
- **儿童安全**：AI 对话只扮演游戏角色、限定话题、不收集个人信息；对话记录家长可查。
- **密钥永远不进仓库**：仓库要开 GitHub Pages，是公开的。AI 平台的密钥放在中转服务的环境变量 / `KEY_FILE`（`D:/Claude/tools/echo-relay/game-key.env`）里；APK 打包时从 `KEY_FILE` 读进 BuildConfig（家长定的，APK 只发给自家人）。`android/echo.properties` 里有签名密码和家长密码 `PARENT_PIN`：**不要读出来、不要打印、不要写进日志**。中转服务的静态文件只放白名单（根目录的 html/js/css 和 assets/ vendor/ isles/ dl/）。
- 手机上麦克风和语音识别需要 HTTPS（或 localhost）。用 `http://电脑IP:8000` 在手机上打开时麦克风会被浏览器禁止，手机测语音要用 GitHub Pages 或 HTTPS 隧道。

## 和家长已经商定的路线

目标：做成接近《宝可梦 绿宝石》复杂度的 2.5D 冒险 RPG，剧情越往后越难，覆盖初中三年（约 1600 个课标词汇），并接入 AI 语音模型，让孩子能和游戏角色真正用英语对话。

范围（已和家长确认的取舍）：
- 地图：13 个小镇 + 约 12 条道路 + 3–4 个洞穴/小岛，约 30 张地图，房子能进去
- 怪兽 **386 种**原创（家长 2026-09-28 改成和绿宝石一样多，原来定 40–50），17 种属性、双属性，Lv 1–100，按等级/进化石进化，21 只神兽；招式 51 个（17 属性 × 小招/中招/大招），每个招式对应一个英语任务；**怪兽和战斗都是 3D**，招式有特效
- 队伍 6 只 + 电脑箱子；背包约 20 种道具；野外技能（砍树、冲浪、推石头、照明）解锁新区域
- 一个反派组织的主线剧情 + 支线；13 个馆主 + 最终英语冠军赛
- 做状态异常；**不做**个体值/努力值/特性/性格（对初一太复杂，冲淡学英语）
- 通关目标 10–15 小时

三年结构：
- 初一：第一大区（现在的 13 个小镇），入门，单词、简单句、有提示的对话
- 初二：第二大区，过去时/将来时/比较，带目标的自由对话（点餐、问路、讲一件事）
- 初三：第三大区 + 冠军之路，表达观点、讲故事；专门练**中考英语听说考试**题型（朗读短文、情景问答、话题简述）
- 后面的区域按孩子的进度和掌握程度逐步开放

2.5D 画面：推荐 HD-2D（《八方旅人》那种）——three.js 程序生成 3D 方块地图 + 斜视角 + 光影/景深；人物和怪兽是 2D 纸片放进 3D 场景；人物走路动画继续用代码画（生图模型画不出一致的动作帧）。three.js 要放进仓库本地加载，不依赖国外 CDN。保留一个"流畅模式"可以退回现在的 2D 画面。

AI 语音：推荐**火山引擎（豆包）端到端实时语音大模型**（中英文、低延迟），以后可加**讯飞英语口语评测**做音素级发音打分。需要一个小中转服务保管密钥（浏览器 WebSocket 不能带鉴权头，也不能暴露密钥）。没网或服务出错时退回现在的"选答案 + 跟读"模式。

## 开发阶段（每个阶段结束都要能玩、要提交）

1. ✅ **2.5D 引擎 + 多地图**（2026-09-28 完成）：进房子、道路、洞穴；队伍 6 只、电脑箱子、背包；迁移现有存档（保留怪兽、徽章、金币）
2. **战斗和剧情系统**：更多招式、状态异常、双属性、野外技能、剧情事件和过场；学习记录（每个词的掌握度、每天开口时长）和家长周报
3. **接入 AI 对话**：中转服务、语音识别、自由对话 NPC、带目标的对话任务、温和纠错、发音评分、语音合成、每日对话上限
4. **第一大区完整内容 + 美术图**：初一内容做完，换上家长用生图模型出的图（怪兽约 50 张、人物立绘/头像约 30 张、战斗背景 13 张、主视觉）
5. **第二、第三大区**：跟着孩子升年级陆续做

## 对照《绿宝石》要补的系统（2026-09-28 和家长定的顺序）

1. ✅ **战斗加深**：速度决定先后手、四项能力（体力/攻击/防御/速度）、按等级学招（4 招上限，学新招要忘旧招并说 "X, learn Y!"）、12 个辅助招式、异常状态（烧伤/中毒/麻痹/睡眠/冰冻/混乱，睡着冻住要喊 "Wake up!"）、能力升降、战斗中换怪兽、学习装置、徽章听话等级、训练师会用药、怪兽详情页
2. ✅ **大地图能力**：居合斩/闪光/碎岩/怪力/冲浪/飞空按徽章数（1–6 枚）解锁，队伍里要有对应属性的怪兽，使用时说英语指令；新路段 grove/lake/rubble/boulder 的障碍只挡支线（道具、稀有草丛、湖心岛）；洞穴没闪光很黑；水上遇怪；钓竿（听词选意思）、自行车、寻宝器、藏起来的道具（`*`，每个小镇和洞穴也自动藏一个）
3. ✅ **剧情**：第 2–13 镇嘘声团章节（`story.js` 的 `CH` 表：水晶、团员/干部、夺回后要念的句子），道馆 4 座雕像答英语题点亮 3 座才能挑战馆主，对手在 4/8/11 号路再战，第 13 镇默先生 + 回声龙，第 13 镇北边英语冠军赛（`i12L` 大厅、`i121`–`i124` 四位大师、`i125` 冠军）+ 名人堂
3½. ✅ **还原并超越绿宝石的流程**（2026-09-29）：13 座岛全部手画（`isles/*.js`，约 150 张地图：分岔、环路、海路、潜水、瀑布、冰洞、火山、嘘声团基地、神殿、三层的冠军之路），每座岛地貌和建筑风格不同、剧情是自己独特的事件（世界设计 `WORLD.md`），秘传技能按绿宝石从剧情人物拿并卡住主路，配角（爸爸、小凯、导师欧瑞、盖尔船长、妈妈电话），13 个道馆各有机关，四大师各有规则
4. ✅ **养成收集**（2026-09-29）：英文昵称（收服 / 孵出来时起名，要说 "Your name is …!"，战斗和野外指令都用昵称）、亲密度（每天用英语和怪兽说一句——详情页或面对跟着走的怪兽按 A；走路、打赢、升级也会变亲；很亲时有机会咬牙坚持住、伤害略高）、异色（野外 1/64，蛋 1/32，换一套颜色）、电脑 8 个箱子 × 30 只（搬家、排序）、家庭岛养育屋（奶奶先送一个蛋；寄养两只同属性的会出蛋，每走 100 步长 1 级）、蛋走路孵化、图鉴出没地点（按地图的野生表算）
5. **以后**：双打、天气、树果、秘密基地、英语演讲比赛、英语挑战塔
不做：个体值、努力值、特性、性格、赌博类游戏、联机

## 已经定下来的

- **孩子的手机：REDMI Turbo 5（2026-10-06 家长拍照确认；之前说的 OPPO 2000 元档作废）**。天玑 8500-Ultra、12+4GB 内存、2756×1268：3D 默认「精美」（WebGL2 + 内存够或 APK 里），开头几秒测帧率，跑不动自动降档，WebGL 不可用时退回 2D 流畅模式。APK 的 WebView 没有能用的浏览器语音识别、也没有 speechSynthesis——朗读靠打包进去的自然配音（没有的句子用有道在线），口语打分靠阿里云识别（listenOnce），没密钥/没网时录音自评。

## 还没定下来的（开始相关阶段前要问家长）

- 生图工具和画风（夜晚霓虹城市 还是 白天明亮海岛）——第 4 阶段前定
- 火山引擎账号和密钥——第 3 阶段需要；家长只把密钥配进中转服务的环境变量，不要贴进聊天或代码

## 测试

```bash
npm install
npx playwright install chromium
npm test            # 跑 tests/ 里的端到端测试，截图存到 tests/screenshots/
```

- `tests/maps.test.js`：地图数据检查（不开浏览器，秒出结果）
- `tests/adventure.test.js`：2D 模式下走一遍：博士 → 怪兽中心（护士、电脑）→ 商店 → 守卫 → 拿徽章 → 1 号路（跳台阶、训练师、草丛、战斗背包）→ 第 2 镇；最后测老存档迁移
- `tests/render3d.test.js`：3D 渲染器在每类地图都能画出来、切地图不泄漏显存、设置里 2D/3D 切换、慢设备自动降档（无头浏览器用软件渲染，正好很慢）
- `tests/story.test.js`：开场剧情走一遍（选女孩、起名、妈妈、救博士、包里选伙伴、第一场战斗、1 号路对手），以及老存档补问名字
- `tests/league.test.js`：英语冠军赛四位大师的规则（单词 / 听力 8 秒 / 口语 / 对话满能量）、冠军换规则、名人堂
- `tests/raise.test.js`：养育屋送蛋、寄养出蛋、孵蛋起名、和怪兽说话（亲密度）、面对跟着走的怪兽说话、异色、电脑分箱子、图鉴出没地点
- `tests/field.test.js`：在测试专用小地图上测野外技能（秘传学习器 + 徽章、砍树、碎岩、推石头、冲浪、钓鱼、攀瀑上下、潜水浮上、冰面滑行、楼梯、闪光、飞空、自行车、藏起来的道具）
- `tests/isle-a.test.js` … `isle-e.test.js`：每组岛的主线剧情、道馆机关、秘传学习器、卡点，外加 2D / 3D 截图；公用工具在 `tests/helpers.js`
- `tests/battle.test.js`：战斗规则（先后手、睡眠叫醒、换怪兽、辅助招式、学新招忘旧招、学习装置、详情页）
- `tests/practice.test.js`：闯关练习第 1 关全对，检查三星和回声球奖励
- `tests/music.test.js`：配乐——每类画面/地图/战斗放对的曲子、朗读压低、麦克风静音、胜利号角接结算音乐、离线渲染不爆音、设置里关掉
- `tests/book.test.js`：课本同步（选单元、单元第 1 关通关、老存档迁移）、每日复习的排期（答错当天、答对隔 1/2/4/7… 天、AI 聊天句子进复习）、冒险出题里课本占的比例、聊天页课本角色排序
- `tests/apk.test.js`：用假原生桥（`tests/fake-native.js`，`FN.install`）模拟 APK：额度用完 / 密钥失效 / 没网的提示和「先跳过」、对战听音选、麦克风被拒「去打开」、首页红条、第一次的小检查、聊天连不上时孩子看到的话、学习锁、家长密码走原生、存档备份 / 导出 / 恢复、出错记录、版本检查、画面丢了重建
- `tests/gate.test.js`：学习锁（6 句 / 小目标、30 分钟临时放行、Wi-Fi 上不了网、聊天时间用完）、返回键、家长密码（数字键盘、错 5 次锁、要密码的设置、输完没弹窗就作废、剧情中文改宽松要密码）、清空前另存、改日期、冒险时间、周报、日报推送
- `tests/native.test.js`：不开浏览器——原生桥方法和 README / 假桥一一对应、build.gradle（KEY_FILE 进 BuildConfig、PIN 只放哈希、没签名停下、版本号）、用 JDK 实跑 `PinGuard` / `BackupNames`
- `tests/review.test.js`：诚实打分（易混音、词尾、同音词、拼写变体、丢撇号、拼音人名）、秒出分、复习本的规则和 120 天模拟、撤提示和题型标签
- `tests/talk.test.js`：talk-core（安全规则、`<transcript>`、打字不算步骤、judge）、聊天界面（句数、帮帮我、再听、看中文、打勾、打字、返回键、安全标记 + 家长密码看全文、家长须知）、中转服务
- `tests/world-goals.test.js`：目标提示、道馆的课本门槛、首页三样（📍 小字、下一枚徽章、传说的线索）、剧情中文、馆主重赛、四只神兽、宝箱、过零点回首页
- 测试里把发音来源设成在线、口语设成自评，这样不依赖本机声音和麦克风
- 改完画面要看截图确认；改完逻辑要跑 `npm test`（全部测试都过才提交；岛的测试比较慢，整套大约 1 小时）
