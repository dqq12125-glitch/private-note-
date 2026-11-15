# 回声岛 Echo Island — 给接手的 Claude 的交接说明

这是一个给中国初一学生（七年级）练**英语听说**的网页游戏。家长的目标：玩三年（初一到初三），能流利说英语。
和家长沟通用中文；代码注释用中文，和现有代码保持一致。

## 现状（已完成）

纯静态网页，没有构建步骤，直接打开 `index.html` 或 `python -m http.server 8000`（Mac/Linux 用 `python3`）。

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页面骨架，`<head>` 里先加载 `errlog.js`（出错记录，后面的文件加载时出错也记得到），再按顺序加载 data → book → cartoon → vendor/three.min.js → dex → monster3d → battle3d → monsters → people → maps → world → world3d → story → isles → sighting → （配乐三个文件）→ talk-npcs → quests → talk-core → talk → game |
| `errlog.js` | `window.EchoErr`：没接住的错误、Promise 失败、3D 画面丢了、聊天连不上的原文（`log(种类, 内容, 哪里)`），最近 50 条存 `localStorage['echo-errs']`；`list()` / `count(天数)` / `clear()`。周报底部诊断一行、家长设置「🔧 出错记录」用 |
| `style.css` | 全部样式（单一明亮主题，颜色变量在 `:root`） |
| `data.js` | `window.WORLDS`：13 个话题小镇的单词/句子/对话；`window.SCENES`：13 段对话动画台词 |
| `book.js` | **课本单元** `window.BOOKS`：沪教版（上海教育出版社 2024 新教材）初中英语七上、七下、八上、八下、九上（各 8 单元）、九下（新书 2027 春才出，先用旧版 6 单元）。每单元 = 书后单元词汇表里要学的全部单词短语 + 16 句 + 12 段对话 + 语法提示 + Boss，格式和 `WORLDS` 一样。**由 `node tools/book/build.js` 从 `tools/book/<册>.json` 生成**（同时把每单元的 AI 聊天角色写进 `talk-npcs.js` 的 BEGIN/END 之间），不要手改。哪些词是对着课本扫描页两人独立转写再核对的；**中文意思是我们自己写的**（2026-10-08 把和课本词汇表释义一字不差的多义项、短语、长释义 251 条重写了，只剩「吉他」「太阳系」这种只有一种说法的；评估「必须改」第 6 条：不搬课本释义）；句子对话是子代理按单元话题/语法新写、两轮审校的（不抄课文）。界面上叫「📗 课本单元 · 适用于沪教版词汇」，**不说「同步」、不写「配套」**（banned-terms 里查）。`BOOKS.start` = 弟弟上初一那年（2026），按日期猜现在学到哪册哪单元 |
| `cartoon.js` | `window.Cartoon`：SVG 画的对话动画角色、场景背景、16 种怪兽 |
| `dex.js` | `window.DEX`：**原创怪兽**（`all` 全部记录、`list` 这个版本里会出现的、`main` 有编号算总数的、`extra` 家庭版的番外、`byId` 一直有全部、`byNo` 按手册编号找；手册总数 `total`、第一大区 `region1Total`；版本 `edition` 见下面「两个版本」）、17 种属性和**我们自己的克制表** `eff()`（打中弱点 ×1.6、不太管用 ×0.6，**没有完全无效**；水灭火、冰冻水、电顺着金属跑、光（电）照亮黑暗……）、每属性 3 个招式 `MOVES`、7 首进化曲 `STONES`（id 还是 `firestone` 等，存档兼容）。怪兽列表由 `node tools/build-dex.js` 从 `tools/dex/*.json` 生成（会检查编号、重名、进化链、参数），数据规格见 `tools/DEX_SPEC.md`。**2026-10-08 评审 P0-C**：json 里的 `no` 是美术流程用的老编号，**不打包进 dex.js**；dex.js 里怪兽的先后就是手册编号 `dexNo` 的顺序（大区 → 这一家第一次在野外出现的岛 → 英文名，选伙伴的 / 只在蛋里的放后面，神兽在每个大区最后），每只带 `r`（大区 1/2/3，代替以前的 `no <= 151 / 251`）和 `sd`（0–999，能力值的固定小浮动，和以前按 `no` 算的一样）。21 只神兽、#25 那只（亮亮仓鼠，按等级进化）、烈阳骑士 / 峡谷卫士都换了属性和设定（很多改了英文名，id 用 `keepId` 留着）；三组草 / 火 / 水三阶伙伴链的进化等级不再是 16 / 36。`node tools/build-dex.js --sales=<目录>` 生成销售版安装包用的 dex.js 和两个 index.json（见「两个版本」） |
| `monster3d.js` | `window.Mon3D`：怪兽的样子。**默认用发布的会动的模型**（`assets/mon3d/<id>.glb`：蒙皮 + 贴图 + idle/walk/attack/hit/faint 五个动作，`play(R, 名字)` 播动作）：启动时读 `assets/mon3d/index.json`、`assets/mon2d/index.json`（`ready`，最多等 2 秒，读不到就不用），`preload(列表)` 按需下载、同时只下一次、最近用过的留 16 只（多了释放没在用的）；`build(sp)` 模型已下载就用，没有就先用程序拼的模型、后台下载。没有模型的怪兽用程序拼的卡通模型（12 种身体 + 头饰/尾巴/翅膀/花纹/装饰，描边、三阶明暗、眨眼、呼吸、摇尾巴）。稀有色：模型贴图在 shader 里转色相 150°，2D 图标逐像素转同样的色相。`snapshot()` 给菜单、手册、队伍和大地图用：有 2D 图标（`assets/mon2d/<id>.webp`）就用图标，没有就截 3D 图。`?art=proc`（或 `localStorage['echo-art']='proc'`）强制全用程序模型；`?art=blender / gemini / 3d` 是老的样品对比模式。`file://` 打开时读不了资源，全用程序模型（测试就是这样跑的）。预览：`tools/mon3d.html?from=1&to=356`（按手册编号 `dexNo`） |
| `assets/` | 随网页发布的美术：`arena/*.jpg` 战斗远景画、`mon3d/*.glb` 怪兽模型（meshopt 压缩 + WebP 贴图，每只约 145KB，368 只共 51.6MB）、`mon2d/*.webp` 怪兽图标（256×256 透明）、两个 `index.json`。`voice/{f,m}/<key>.ogg` 和 `voice/zh/ai-notice.ogg` 提前合成的自然配音（Opus 放在 Ogg 里，16 kbps 单声道，18,636 个约 94MB；原来是 32 kbps MP3 共 202MB，`index.json` 带 `fmt: 'ogg-opus'`；`gen.py` 把合成出来的 WAV 经 ffmpeg 管道压成同样的设置：libopus、voip、vbr、每帧 20 毫秒，PATH 里要有带 libopus 的 ffmpeg；安装包里 `mp3` / `ogg` 都不再压一遍）。模型和图标由 `node tools/mon3d/publish.js` 从 `art/` 生成，配音由 `tools/voice/gen.py` 生成，都不要手改 |
| `battle3d.js` | `window.Battle3D`：3D 战斗画面，出场、放招、受击、倒下、扔球收服，17 种属性各有小招/中招/大招特效（粒子、光束、闪电、冰刺、落石、陨石……）。**机位是侧面的**（2026-10-08 评审 P0-D）：自己在左（`POS.me` x = −1.75）、对手在右，一样大、一样远，两边平时侧过一点身子朝着观众（`TURN`），出招时转过去正对对手；镜头不转到怪兽背后（`shotShoulder` 是出招方的斜前方）。没有台子：脚下是第一属性颜色的三圈水波（`ripples` / `ripplesStep`）。画面窄（竖屏）就把镜头拉远（`resize`）。收服时海螺「传出一声回声」= 鼓一下、亮一下（`wobble`，不左右摇），一共两声。**流畅度（2026-11-15）**：开场预热分帧做（着色器后台编译、共用几何体一步一个，`fxStats().warm`），放招时不再现编译；没有东西在动时每秒画 30 帧，一动就回 60；战场没显示或切到后台时循环停下。`destroy()` 是收摊：渲染器、画布、编译好的着色器留给下一场（不再每场漏一份），`Battle3D.release()` 才真的放掉（这一场用 2D 画面时 monsters.js 会调），画质或阴影设置变了自动重建。原因和做法见 `tools/FX_SPEC.md` §7.1。预览：`tools/fx.html`（`?rig=1` 用发布的会动的模型，和游戏里一样；不加是程序拼的模型） |
| `battle-fx-elements.js` / `battle-fx-energy.js` / `battle-fx-physical.js` / `battle-sfx.js` | **战斗特效 2.0**（2026-10-07 家长：「技能特效更加炫酷，可以加入技能动画」）。规格和 `kit` 接口全在 `tools/FX_SPEC.md`：`battle3d.js` 的 `attack(side, type, tier, support, info)` 串起「蓄力（属性光、脚下光圈）→ 大招过场（属性色斜横幅 + 速度线 + 立绘 + 英文招式名大字，中招是顶上小横幅）→ 扑击 / 大招特殊动作 → 出招（`BattleFX.types[type].release`，**命中瞬间 resolve**）→ 通用命中层（命中星、冲击波、限频闪屏、大招放慢 + 发光后期）→ 余韵（地面贴花）」；三个 `battle-fx-*.js` 按属性登记 `charge/release/impact/after`，`battle-fx-physical.js` 还有 17 个属性的辅助招式；`battle-sfx.js`（`window.BattleSFX`）是合成音效。新工具：能量光束、分叉闪电、火焰、冲击波、命中星、贴花、拖尾、周身光、魔法阵、临时点光源、放慢、发光后期。画质 high / mid / low（粒子上限、灯光、后期按档缩减）。**安全**：全屏闪每秒 ≤ 3 次（`kit.flash` 自动限频）、不用饱和红色全屏闪、被打的怪兽只平滑淡出一次（不频闪）。检查：`tools/fx.html` 预览，`node tools/fx-shots.js <属性> <档>`（或 `all`）每招截 12 帧拼成接触印样 `tests/screenshots/fx/`，还查时长、闪屏次数、显存泄漏 |
| `monsters.js` | `window.MonsterGame`：战斗规则（说英语攻击/听英语防御、每只 4 个招式、双属性克制、本属性加成）、收服（回声球/金回声球，神兽难抓；睡着 / 冻住 ×1.6、别的异常 ×1.3、金回声球 ×1.4，海螺传出**两声**回声就收好了）、升级、按等级或进化曲进化、野外怪兽表（按区域、地形、稀有度；第一大区 = `r === 1`）、13 个主题属性挑战馆（主人叫**岛主**）、训练师；队伍 6 只 + 电脑箱子（**10 个 × 24 只**，老存档超过的照样留着）；背包道具 `ITEMS`；分页手册。**对战画面**（2026-10-08 评审 P0-D，`renderBattle` / `plate`）：顶上一整条状态栏 `.b-hud`——自己在左、对手在右，中间 VS（训练师 / 岛主的头像），没有「HP」小标签、没有血量数字；经验条只在结算画面（`.res-exp`）；2D 画面也是侧面对站 + 属性色水波圈（`.pad` 的 `--rc`）。战斗里的说法都是自己的（「念对英语，X 就出招！」「X，上场！」「X 累得不能再战斗了」「看！X 在长大……」，英文 "X, your turn!" "X is too tired to go on." "Look! X is growing up!" 等），banned-terms 里查老说法 |
| `people.js` | `window.EchoPeople`：日系 Q 版人物画法（4 方向 × 3 帧动作图集 `atlas()`、对话头像 `portrait()`、大立绘 `standing()`），全部造型 `LOOKS`（主角男/女、对手 Leo/Mia、妈妈、博士……）。改人物后打开 `tools/people.html` 看全部造型 |
| `setup.js` | `window.EchoSetup`：**销售版的家长首次设置向导** + 家庭定制（只在 `DEX.sales` 时出现）。顺序和销售流程一致（2026-10-08 评审 P0-E）：① 欢迎 / AI 说明 / 隐私要点 / 监护人单独同意 → ② **设备检查**（安卓版本、WebView、WebGL2、剩余空间 ≥1GB、麦克风；安装包里不合格就「下一步」按不了，合格了提示这时候付款）→ ③ 家长密码（原生 `setPin`，每台手机自己的随机盐）→ ④ AI 密钥（「测试」真的问一次阿里云，「✅ 密钥能用！」）→ ⑤ 家庭定制（昵称、预设部件拼的形象、约 50 只原创伙伴里挑 3 只、家人当 NPC）→ ⑥ 完成。对家长说「软件 / App」，不说「游戏」。开场 `familyWake`：渡轮上念家长填好的小岛通行证。文书版本 `DOC_V`（改了 pages 里的文书要改它，家长要重新同意） |
| `pages/` | 打包进 App 的全文页：`privacy.html`《儿童隐私说明》、`consent.html`《监护人同意书》、`bailian-guide.html` 开通阿里云百炼（先充 20 元、余额低于 10 元提醒、每月预算 40 元）、`licenses.html` 开源许可与致谢 + 许可证全文（`apache-2.0.txt`、`mit-three.txt`、`hunyuan3d-2-license.txt`） |
| `story.js` | `window.EchoStory`：剧情核心（开场、选伙伴画面、第一次遇到对手、英语冠军赛四位擂主规则、光荣榜）+ 各岛剧情的登记表 `EchoStory.isle(z, hooks)` 和公用工具 `EchoStory.lib`。world.js 在进地图/走一步/说话/对着地标按 A 时调用 `enter/step/talk/tile`，`hidden/look` 可以藏起或换掉地图上的人。剧情进度存在 `world.flags` 里 `s:` 开头的键 |
| `sighting.js` | `window.EchoSight`：**今日目击**（每天一只稀有怪兽 + 三条英文线索）。目标怎么挑 `pick` / `roll`、线索怎么拼 `clues`、首页卡片 `homeCard()`、冒险菜单那一行 `menuRow()`、告示板 `sheet()`、大地图的钩子 `onMap(M)` / `onStep(c)`、给配音用的 `lines()`。加载时不碰 DOM（`tools/voice/collect.js` 在 Node 沙箱里也加载它）。在 `index.html` 里排在 isles 后面 |
| `quests.js` | **支线委托**（`window.QUESTS` / Node 模块，游戏、中转服务、APK 共用）：17 条（前 4 座岛各 2 条，第 5–13 岛各 1 条），挂在本来就站在镇上的村民身上。每条有 id、哪张图的谁（`map` / `npc` / `who` / `g` / `kid`）、中英文名、按 A 时说的请求 `ask`、可选的旁白 `note`、聊天人设 `persona`、开场白、目标、3–4 个小步骤 `steps`、建议的词、前提 `need`（徽章 / 先做另一条）、奖励 `reward`（金币、道具、蛋、稀有色蛋）、感谢 `thanks`、做完以后的一句 `bye`。人设和目标只写在这里：手机只发委托 id，`talk-core.js` 的 `questNpc()` 拼人设，再经 `instructions()` 加安全规则 |
| `isles/*.js` | **13 座岛的内容**（每组岛一个文件）：手画的地图（`EchoMaps.define`）、本岛剧情、挑战馆机关。写法见 `ISLES.md`，世界设计见 `WORLD.md` |
| `maps.js` | `window.EchoMaps`：地图引擎。地块表、13 座岛的风格 `THEMES`（地面配色、树、房子）、地图登记表 `define(id, def)`、出入口分组和配对 `link()`（地图四边的出口、洞口、楼梯、门、地垫、潜海点）、到达点 `arrival()`（`from:来的地图@第几组:偏移`）。没登记的地图（休息站、商店、普通民房）用这里的老模板 |
| `world.js` | `window.EchoWorld`：大地图逻辑——按地图 id 切换、走路、跳台阶、冰面滑行、瀑布、潜海/浮上来、楼梯、机关门、门/洞口/出口、草丛和洞穴遇怪、训练师视线、护士/电脑/店员/岛主/出题人/送礼村民/渡轮、回声技能、悄悄喷雾、回程绳、掌机 RPG 式对话框（可以只听不看英文）；2D「流畅模式」渲染器；自动画质 |
| `world3d.js` | `window.EchoWorld3D`：three.js 的 2.5D 渲染器（地面贴图 + 低多边形树/房子/岩壁 + 随风摆的草丛 + 水面着色器 + 纸片人物 + 移轴景深）。三档画质 high/mid/low：自动画质在 APK 里、或内存 ≥8GB / 8 核以上且有 WebGL2（软件渲染不算）时从 high 开始（DPR 最高 3、限 60 帧），否则从 mid 开始，跑不动自动降档 |
| `vendor/three.min.js` | 裁剪过的 three.js（只打包用到的类，含 GLTFLoader + MeshoptDecoder + SkeletonUtils）。要加新的 three 类：改 `tools/three-entry.js`，跑 `npm run build:three` |
| `talk-npcs.js` / `talk-core.js` / `talk.js` | **和岛民用英语自由聊天（AI 语音）**：`talk-npcs.js` 是岛民名单（8 个岛民 + 每个课本单元一个角色，人设、音色、对话目标），游戏、中转服务、APK 共用；`talk-core.js`（`window.TalkCore` / Node 模块）是对话核心：安全规则和人设 `instructions()`、地图上随便一个人的临时人设、聊完打分的请求和解析、`session()`（游戏消息 ⇄ Qwen-Omni 实时语音事件的翻译、计时、记录）——**中转服务和 APK 直连跑的是同一份**；`talk.js`（`window.EchoTalk`）是首页第三个标签和对话界面——按住说话（16kHz PCM 分块发出；一按下就出现自己的气泡，Qwen 边听边回的 `you_live` 字实时填进去，松开后 `you` 换成整段结果，按服务器的 item 编号对气泡，空的那段岛民答完 5 秒删掉；内容一变就滚到底）、岛民用自己的音色回答（24kHz PCM 边收边播）、显示双方的话、聊完打星给金币、老师给的「更好的说法」进每日复习、本机聊天记录。APK 里有原生桥 `EchoNative` 时走 `directSocket()` 直连阿里云（装成和中转服务一样的 WebSocket），还提供 `listenOnce()`：口语题的识别（边说边送 qwen3-asr-flash-realtime，对上答案立刻结束；不行再整段走 qwen3-asr-flash），给口语题自动打分 |
| `android/` | **安卓 APK**（弟弟的手机是 REDMI Turbo 5）：全屏 WebView 壳，游戏文件打包时整个复制进 `assets/www`（离线能玩），用 `https://appassets.androidplatform.net` 打开（麦克风、fetch 才能用）；原生桥 `EchoNative`（OkHttp）带着百炼密钥连阿里云实时语音和 HTTPS，只许连 `dashscope.aliyuncs.com`，网页拿不到密钥本身；密钥来源：手机上「设置 → AI 聊天和口语打分」填的（SharedPreferences，优先），没有就用打包时 `echo.properties` 的 `KEY_FILE`（**家长 2026-10-07 定：密钥照旧打进 APK**，本机指向 `D:/Claude/tools/echo-relay/game-key.env`，游戏专用那把）。家长密码 `PARENT_PIN` 只以加盐 SHA-256 进 `BuildConfig`，`PinGuard.java` 核对（错 5 次锁 10 分钟）；`checkReleaseConfig` 没有正式签名或家长密码就停下（不再退回调试签名）；版本号 versionCode = git 提交数、versionName = 日期-短哈希；存档每天写一份到手机「下载/EchoIsland」（留 7 份，`BackupNames.java`）、`shareFile` 导出、`backupPick` 选文件恢复；渲染进程挂了 `onRenderProcessGone` 重建 WebView；麦克风永久拒绝能 `openAppSettings()`。方法全表在 `android/README.md`（加方法要同时改 README 和 `tests/fake-native.js`，`tests/native.test.js` 核对）。返回键交给 `window.EchoBack`。打包和安装见 `android/README.md`；JDK 17 / Gradle 8.10 / Android SDK 装在 `D:\Claude\tools\android`，模拟器 `echo35` |
| `server/` | AI 对话中转服务（Node + ws）：保管百炼密钥，按岛民 id 连 Qwen-Omni 实时语音，每天时长上限、家庭口令、对话记录 `/logs`。说明见 `server/README.md`（不在 GitHub Pages 上运行，要单独部署） |
| `music-core.js` / `music.js` / `music-data.js` | **配乐**（2026-10-06 家长要的）：全部用 WebAudio 现场合成，GBA 掌机风格，没有音频文件（APK 不变大、没网也能放、没有版权问题）。`music-core.js`（`window.MusicCore` / Node 模块）是乐谱格式的解析和检查；`music-data.js`（`window.MUSIC`）是 27 首曲子，**由 `node tools/music/build.js` 从 `tools/music/songs/<id>.js` 生成，不要手改**；`music.js`（`window.EchoMusic`）是合成器和播放器：`play(id)` 交叉淡入淡出换背景音乐、`jingle(id)` 一次性小音乐（背景音乐暂停、放完接着放）、`duck(on)` 朗读时压到 30%、`hold(on)` 麦克风在听时完全静音、`setVolume`、`render()` 离线渲染。乐谱写法、音色、曲目表在 `tools/music/SPEC.md`；试听页 `tools/music.html`；`node tools/music/render.js` 离线渲染全部曲子查电平/削波/循环接缝（`--levels` 生成各曲音量校正 `tools/music/levels.json`，build 时并进曲库）。自动化测试里引擎默认不出声，网址带 `?music` 才打开（`tests/music.test.js`） |
| `game.js` | 主程序：存档、朗读（打包的自然配音 `.ogg`，老 iOS Safari 放不了 Opus 时按没有配音处理 → 阿里云现场合成 → 本机声音）、语音识别与打分（APK 里用阿里云识别）、闯关练习（📗 课本单元每单元 7 关 + 13 岛 × 7 关；`WX = WORLDS.concat(课本单元)`，课本单元从第 13 号起编号）、**每日复习**（间隔复习 `S.rev`：答错当天复习，复习答对隔 1、2、4、7、15、30 天再来，第 7 格算掌握（不删，周报「累计掌握」）；课本新学的第二天复习一次，带提示学到的按「弱」进来；AI 聊天里老师改过的句子第二天练（存孩子原话 `said`）；家长定的量：一轮 `REV_N` 20 题、每天新进 `REV_NEW` ≤ 10 条（带提示的也占名额）、今天到期的积压 > `REV_BACKLOG` 40 条就不加新的、上限 `REV_MAX` 3000 条没掌握的；谁逾期最久谁先来；冒险里（对战、村民出题）答对今天到期的题也算一次复习、每天最多 `REV_FIELD` 20 次，对战没念准只降一格 `revMiss`，对战先出到期的题 `revPick`；首页「今日复习」卡片）、**冒险出题来源** `src(z)`（按设置有几成换成课本正在学的单元）、对话动画剧场、每日任务（连得上 AI 时每天固定一个「和岛民聊天」任务）、成就、宠物店、设置；最后把工具以 `api` 对象交给 MonsterGame / EchoWorld |

关键约定：
- 所有按钮用 `data-act="名字"`，由 `game.js` 里的 `ACT` 对象统一处理；monsters.js / world.js 通过 `init()` 返回自己的 actions 合并进去。
- 存档在 `localStorage['echo-island-v1']`，结构见 `game.js` 的 `fresh()`；新增字段要在 `fresh()` 里给默认值（`merge` 会自动补给老存档）。**不要在 `fresh()` 里放版本号**——merge 会让老存档看起来已经迁移过；版本号由迁移函数写（`EchoWorld` 的 `migrate()`、`MonsterGame.migrate()`）。
- 地图 id：`t0`–`t12` 小镇（乘风、`visited` 用），其余地图的编号见 `ISLES.md` 的接口表（道路 `r…`、海路 `s…`、洞穴/迷宫 `c…` `d…` `h…` `v…`、海底 `u…`、室内 `i{z}{房子编号}`）。改地图后跑 `node tests/maps.test.js`：每行长度、未知地块、出口两头配对、到达点能站、从每个入口都能走到所有出口/人物/道具，并且**按徽章数走一遍整个世界**：有 b 枚徽章能到第 b 岛的挑战馆、去不了第 b+1 岛（回声技能和守卫真的卡住主路）。`ISLES=2,3 node tests/maps.test.js` 只查某几座岛。
- 回声技能**只有四种**（2026-10-08 评审 P1-A，world.js 的 `GROUPS`）：开路 Clear Way（1 级砍小树、2 级敲碎裂石、3 级推大石头）、点灯 Light Up、水路 Water Way（1 级在水上走、2 级潜到海底、3 级爬上瀑布）、乘风 Sky Ride。剧情里的人送回声贝，后面几级的回声贝是给已有技能升级（id 还是 `hm_cut` / `hm_smash` / `hm_strength` / `hm_surf` / `hm_dive` / `hm_falls` 等，存档兼容；`SKILLS` 按障碍分的键名也没变，显示名在 monsters.js 的回声贝和 world.js 的 `SKILLS`）+ 要够徽章才能在野外用：点灯 2、开路 3 / 4 / 6、水路 8 / 10 / 12、乘风 9（在本岛拿到，打赢本岛挑战馆才能用，正好卡住去下一座岛的路）。对怪兽喊的英语指令（"X, cut the tree!" 等）没变。挑战馆的主人叫**岛主** Isle Master，英文建筑名 "… Hall" / Challenge Hall；休息站的人叫 Amy（站长）；嘘声团的小兵叫 Hush Crew。
- 剧情脚本写法：钩子返回一个 async 函数，用 world.js 提供的 `SC`（`talk` 对话、`spawn/walk/remove` 临时人物、`battle`、`scene()` 全屏画面、`setOverlay` 接管按键、`flag/set` 剧情进度、`openGate/closeGate` 机关门、`teleport`、`note` 提示条、`filter` 画面滤镜、`over/setOver/refresh` 机关地板）。台词里 `{name}` `{rival}` 会换成主角和对手的名字。完整故事线在 `STORY.md`，各岛的写法和 `C` 接口全表在 `ISLES.md`。
- 渲染器接口：`load(map)`、`resize()`、`draw(now, V)`、`destroy()`；`V` 由 `world.js` 的 `view()` 每帧给出（主角/跟随怪兽/人物/道具/提示的位置）。2D 和 3D 共用的画法（人物、地面）在 `EchoWorld._art`。
- 屏幕切换用 `show(id)`：home / play / result / theater / battle / world。切换时给 body 加 `scr-<画面>` 类，横屏排版靠它。
- **操作和横屏**（2026-10-06 家长要求「横屏选项」「摇杆和 AB 融进游戏里，像王者荣耀」）：大地图画面铺满全屏，HUD 半透明浮在顶上；操作浮在画面上——左半边按哪里摇杆就出在哪里（`world.js` ensureDom 里的 `#w-joy`，格子地图只取上下左右、带死区和防抖），右下角大 A、左边 B、上面「英语聊天」排成弧形；对话框/过场出来时操作自动藏起（CSS `:has()`）。设置「冒险里的操作」可换回方向键（`S.settings.ctl` = joy / pad，`EchoWorld.ctlMode()`）。横屏：设置「屏幕方向」竖屏 / 横屏 / 跟着手机转（`S.settings.orient`，APK 里 `EchoNative.setOrientation`，原生记住下次直接用）；浏览器里横过手机也会套横屏排版。横屏样式都在 style.css 末尾的 `@media (orientation: landscape) and (max-height: 600px)` 里（对战左战场右招式、题目四个选项一行、弹窗变宽分栏……），竖屏不受影响。
- 口语打分（家长 2026-10-06：**打分要 AI 来打、默认开口、必须开口说**）：`speakMode()` 返回 `'sr'` 或 `'self'`。APK 里一律 `'sr'`：录一句交给阿里云**不带答案地听写**，再和目标句子逐词比对打分。**识别是边说边送的**（家长 2026-10-06：「识别单词有没有办法秒识别」）：`EchoTalk.listenOnce` 一点话筒就录、同时连 `qwen3-asr-flash-realtime`（APK 走原生桥 `wsOpen`，网页版走中转服务的 WebSocket `/asr-rt`），连上前录到的先存着再补发；服务器边听边回文字（`stash` 是还没定下来的那截，界面上一个个冒出来）；`recognize(onInterim, 答案们)` 把这道题的答案交给它，**实时结果一和答案对上（90 分以上）就立刻结束**——说完 0.1–0.4 秒出分（以前要等 1.1 秒停顿再整段上传，2 秒多）；对不上就等服务器判断说完（单词停顿 0.4 秒、句子 0.6 秒）；实时识别没连上 / 没认完就用录好的整段走 qwen3-asr-flash。麦克风说完后预热 15 秒（连着说不用重新打开），切后台、开始和岛民聊天时关掉。`recognize()` 开始时停掉正在放的朗读（别让识别听到示范读音）（`scoreSpeech()`，0–100，没读准的词标红）；低于 90 分时 `aiTip()` 把「目标句子 + 听到的话」交给 qwen-plus 给一句中文点评（哪个词读错、怎么读对）。试过让 Qwen-Omni 直接听录音打分——它会被目标句子带偏（读错的句子也给 85、把 potion 听成目标里的 lotion），所以不用。开口模式下没有「跳过这题」：练习说三次不行记进每日复习；大地图的说话任务说三次不行才出现「先跳过」；没网时提示联网后再说，不会退回自评。网页版走中转服务的 `/asr`、`/tip`（要家庭口令），连不上才用浏览器识别 / 录音自评；`录音自评` 只留给 `?quiet` 测试链接和测试脚本（tests 里都设 `mode: 'self'`）。
- **先学习再冒险（学习锁）+ 学习周报**（家长 2026-10-06 要的，2026-10-07 按评估改过）：`game.js` 的 `gate()`——每天先做完「一轮每日复习」（`dayLog().revSess`，复习答对一半以上才算；没有到期的题自动算完成）和「聊天」（今天完成过一个聊天小目标，**或者用语音说满 6 句英语**：`EchoTalk.today()`，一句要 ≥3 个英文词、不含中文、不是重复的；打字的标 typed，不算句数、不给金币、不开锁），首页才放出「去冒险」，大地图的进入/乘风也拦（`gateBlock()`）。首页学习锁卡片、聊天界面顶上、复习结果页都显示「已开口说 n/6 句」；复习做完还差聊天时结果页主按钮是「🗣️ 去和岛民聊天」。豁免：AI 聊天没开通（`noai`）整天免（🟡 `gateEx`）；今天的聊天时间用完了（`chatDaily`）只有开口说过 ≥3 句才整天免，不然和没网一样；**没网**（`navigator.onLine` 为 false，或 Wi-Fi 连着上不了网：最近 10 分钟 AI 报过「找不到服务器」、今天聊天也没连上过 `chatConn`）或聊天连上以后服务器真出错（`chatFail`）只**临时放行 30 分钟**（不写 `gateOpen`，`passAt` 从第一次进大地图开始算，周报 📵），联网后回首页 / 进出地图重新检查；**密钥不对 / 额度用完**（`chatKeyBad()`）不放行，卡片写明「请告诉家长（家长可以在 🔒 家长设置 里暂时关学习锁）」、不给「去聊天」。真做完了（`gateOpen`）当天一直开着。过了零点人还在大地图里 / 切回前台时，等这段对话或战斗结束提示「新的一天！」回首页（world.js `kickCheck`）；手机日期往回改（`S.maxDay`）锁住并记下 `clockBack`，卡片上「👪 家长：从今天重新开始」（要密码，`clockReset`）。每天的学习记录在 `S.log[日期]`（`dayLog()`，留 45 天，字段说明在 `dayLog` 上面的注释；每周的关键数字另外永久存在 `S.weekly`）。周报 `reportSheet()`（首页工具栏 📊、学习锁卡片里的链接）：每天的标记 ✅🟡📵🔓⏰🌙、学习日 n/7、能力行（每句几个词、一次说对率、隔一周还记得，和上周比 ↑↓）、不看字说对几句（单个词另记 `recallW`）、需要家长看看的聊天、AI 花费估算、诊断一行（AI 失败、出错记录、版本号）——竖屏一屏放下给孩子截图发家长，横屏分两栏。可选日报推送（家长设置里填 PushPlus token 或企业微信群机器人地址，默认不发，每天 20 点以后发、没网排队）。测试存档里都设 `gate: false`。
- **家长密码**（评估第 4 条）：`parentOk(why, onOk)`。APK：打包时 `PARENT_PIN` 的加盐哈希，`EchoNative.hasPin()/checkPin(pin)/pinStatus()`，错 5 次原生锁 10 分钟（改时钟没用），**没打包密码就一律拒绝**（不再「谁先点谁设」）；网页版：`S.settings.pin`（第一次由家长设）、`S.settings.pinLock`。自己画的数字键盘、显示 ●，输错 / 被锁记进周报。输对以后只在**那个家长弹窗还开着时** 2 分钟内不用再输（`RT.parentUntil`；输完没有弹窗开着、关了弹窗、切后台都立刻作废）。要密码的：关学习锁、「全部关卡直接开放」（只对闯关练习生效，大地图的徽章 / 守卫 / 回声技能不再认它，测试用 `?debug`）、课本比例、清空进度（还要输入「清空」两个字，清空前另存一份能找回）、从备份恢复、看有安全标记的聊天、冒险时间、日报推送、版本检查地址、AI 密钥、「剧情中文」改宽松（改成「点一下才显示」不用）。设置分「我的设置」和收起来的「🔒 家长设置」。
- **冒险时间**（评估第 18 条）：`S.settings.limit`（默认上学日 45 分钟、周末 90 分钟、21:30–07:00 不能冒险，家长设置里改）。只算大地图和对战；多学一点换时间 `bonusMin()`：多做一轮复习、多完成一个聊天目标、多通关一关**新**练习（第一次通关或星星变多，刷同一关不算）各 +10 分钟，每天最多 +30。还剩 5 分钟提醒一次；时间到了不半路掐断，等这场战斗 / 这段对话 / 剧情结束再回首页（`advTick` / `advStopWhy`）。大地图连续玩 35 分钟以上，一场战斗结束后弹护眼休息（`restModal`）。
- **存档备份**（评估第 7 条）：每天第一次保存前轮换本机 3 份备份（`echo-island-v1-bak1..3`）；存档读坏了先原样另存（`-bad`）、改用最近一份好的备份并提示，不覆盖；APK 每天往手机「下载/EchoIsland」写一份；设置「💾 导出存档」（APK 分享到微信、网页下载文件）、「从备份恢复」（要密码，恢复前 / 清空前的进度另存在 `-pre`）。存不进去（空间满了）第一次就弹窗请家长导出。
- **存档越玩越大**（2026-11-15，`node tools/perf/bigsave.js` 造「玩了 1 年 / 3 年」的存档来量：约 34 万 / 97 万字，localStorage 一共约 524 万字）。备份压着存：本机 3 份、`-pre`、`-bad` 超过 2 万字的用 `lzPack`（LZW，`'LZ1:'` 开头，约六分之一，压完当场解一次，对不上就原样放），`parseSave` / `bakGet` 自动解开；存档本身、导出的文件、手机「下载/EchoIsland」里的一直是原样 JSON。`storeCheck()`（打开游戏、每天换完备份、存不进去时）：用到 60% 压没压过的备份、删一个月前的 `-bad` / `-pre`，90% 删 `bak2` / `bak3` / `-bad`，80% 首页挂红条「💾 存档空间快满了」，家长设置里写着用了百分之几。掌握了的聊天句子只留最近 200 条（`revTrim`，更早的删掉、个数记在 `S.rev.gone`，「累计掌握」用 `revMastered()`）；聊天记录另有 15 万字的总量上限（`talk.js trimLog`）。
- **走路不整份存**（2026-11-15）：`save()` 一调用当场整份写完（收服、徽章、复习、聊天、买东西都是这样）。存档 6 万字以上时，`world.js savePos()` → `E.savePos()` 每走一步只往 `echo-island-v1-pos` 写一条小记录（位置 + 喷雾 / 步数 / 蛋的步数），停下来 1 秒、换地图、开战、离开大地图、切后台（`visibilitychange` / `pagehide` / `freeze`）、返回键、任何一次 `save()` 时才整份存（`flushWalk`）；下次打开 `posApply` 把位置补上，和存档对不上就扔。6 万字以下照旧每步整份存（测试存档都是这样）。用大存档写测试、要直接读 localStorage 里的位置时先 `EchoGame.flush()`（`tests/helpers.js` 的 `t.flush()`）。实测（`node tools/perf/durable.js`，模拟器里的安装包）：110 万字连写 12 次后 0.06 秒杀进程，重开数据都在——安卓 WebView 落盘及时，不用为落盘再拆存档。
- **AI 用不了时**（评估第 3 条）：识别 / 点评的失败分成麦克风被拒、没网、密钥失效或额度用完、真没听清（`failOf` / `failHint`，`EchoTalk.lastErr()` 的 `why`）；没听清也算一次尝试；3 分钟里失败 2 次（`aiDown()`）时剧情说话任务、选伙伴、闯关题给「先跳过（已放进复习，联网后要补说）」（`revLater`，复习里欠着 `owe`），对战这一回合改成听音选招、不能暴击；麦克风被永久拒绝弹「去打开」（`openAppSettings`）；首页红条（`homeBars`）；第一次打开做「麦克风 + 网络 + 密钥」小检查（`S.micCheck`）。聊天连不上时孩子只看到一句话（「现在没网…」「AI 密钥不对，请告诉家长」「AI 额度用完了…」「AI 有点忙…」），原文只在灰色小字「（给家长看：…）」和出错记录里。
- **版本号**（评估第 19 条）：APK 的 `EchoNative.version()`，显示在设置页底部和周报角落；打开时查 `version.json`（默认 `https://dqq12125-glitch.github.io/private-note-/version.json`，家长设置里能改 `S.settings.verUrl`），code 比自己大就在首页挂蓝条「有新版本，请家长更新」。仓库根目录的 `version.json` 由家长发版时改。不做代码热更新。
- **聊天**（评估第 2、11、13、16 条）：`EchoTalk.today()` → `{ voiceLines, typedLines, goals, need, done, concern }`（学习锁用）、`EchoTalk.endIfOpen()`（返回键 / 切后台 = 结束并评价；评价超时也先存记录、照样计句数）。麦克风能用时打字框收起成「麦克风用不了？点这里打字」。帮孩子：💡 帮帮我（发 `[Game]` 提示，岛民给一句能照着说的）、🔁 再听一遍 / 🐢 慢一点、点岛民的气泡看中文、目标词卡带中文（说到了变绿）。每个角色 3 个目标（易 / 中 / 难，按聊过的次数轮换，`goalOf`），目标拆成 2–4 个小步骤实时打勾（`stepsBody`，打字的不算做到）；按步骤给星：全做到 3 星、差 1 步也算完成 2 星，用语音说的不到 3 句一律不算完成（`judge`）。岛民记得上次聊到的游戏里的小事和老师改过的一句（`S.talk.mem`，只存手机，`memOf` 过滤真名 / 学校 / 住址）。安全：开场白写在 instructions 里、孩子打的字加 `Student typed:`、评价记录包在 `<transcript>` 里、孩子认真问就承认是电脑做的游戏角色、说难过 / 被欺负时温和回应并让他找家长老师，打上 `concern` 标记（模型 + 本机关键词 `worried()`），家长输密码看全文，周报提示一行；起名时提醒用游戏昵称；聊天页「家长须知」写清哪些数据发到阿里云；中转服务的日志只留 90 天。
- **界面上不把 AI 叫「老师」**（2026-10-09，双减：教育部校外培训鉴别指南把「人工智能讲授、互动」也算作培训方式）：聊天评价叫「评语」、改过的句子叫「AI 改过的句子 / 更好的说法」；岛民只做任务式英语对话，不做情感陪伴（《人工智能拟人化互动服务管理暂行办法》）。「告诉爸爸妈妈或者老师」里的老师是真老师，照旧。
- **打分要诚实 / 撤提示**（评估第 8、9 条）：`scoreSpeech` 的模糊匹配只留给拼写变体（英式 / 美式、learnt / learned、识别结果丢了撇号的 dont / Its / whats 照样算对），易混的音（three/tree、went/want…）不算对，只错词尾算半对，同音词算对，漏掉四分之一以上关键实词不过关，有一个词没说对不给 Perfect / 暴击；人名（含短的拼音名 Li / Lin / Zhang / Wang Fang，`isPinyin`）放宽、不算「关键实词」（星期、月份、国家语言这类大写词照普通词打分，`NOT_NAME`）。秒出分要最后一个词已经按顺序说出来（`earlyMatch`）。点过提示 / 看过原文 / 第 2 次才说对 = 带提示通过（`P.aided`：不算 Perfect、不加连击、经验减半、复习里不升格）。AI 点评只说漏读 / 多读 / 说成了哪个词，不猜是哪个音。跟读题按复习格数撤提示（`fadeOf`：0–1 格看全文、2–3 格首字母「🔤 看首字母说」、4 格以上只给中文「🧠 凭记忆说」、聊天改过的句子显示原话「✏️ 改正说法」）；对战可选「🔥 不看字念」（念对 ×1.5）。
- **挑战馆跟着课本开**（评估第 10 条）：world.js `gymNeed(z)`——第 z 个岛主要先打败前 ceil((z+1)×16/13) 个课本单元的 BOSS 关（`S.stars[单元号-6]`），不够时岛主说 "Come back after you beat Unit N!"；`EchoWorld.nextGymNeed()` / `objective()` / `legendClues()` 给首页用（首页「继续冒险」下面的 📍 小字、「🏅 下一枚徽章」卡片、「✨ 传说的线索」卡片）。四只神兽是学习里程碑（story.js `MILES`：七上 8 个单元 BOSS 全过 → 愿望星 wishstar、聊天完成目标 30 次 → 天响 skyecho、连续打卡 30 天 → 时之芽 timesprout、不看字说对 300 句 → 摇篮灵 lullaby；旗标 `ml:book/chat/streak/recall`，老存档里的 `leg:frostwing` / `leg:stormwing` / `leg:blazewing` / `leg:lullaby` 也算收服过；累计数存 `world.mile`），达成后在户外飞来。打通后岛主能重赛（+15 级、出题换成最近学的单元、每天第一次赢送进化曲）；每日宝箱开进化曲 / 蛋 / 稀有色道具；「怪兽大师」成就是点亮第一大区全部（`DEX.region1Total` 种，家庭版的番外不算）。目标提示：story.js `objective()`，大地图 HUD 一行、冒险菜单最上面「📍 现在要做」、进地图弹 3 秒。
- **剧情中文**（评估第 17 条）：`S.settings.storyZh` = auto（默认）/ tap / always。auto：第 1–4 岛总显示；第 5 岛起人说的话收成「译」按钮（点一下记 `zhTaps`，周报「看中文 X 次」），任务说明、旁白、挑战馆规则、`zhKeep` 的页照常显示。设置在 🔒 家长设置里（`EchoWorld.storyZhHTML()`）。
- **出错记录 / 画面恢复**（评估第 15 条）：`errlog.js` 的 `EchoErr`（见上表）；3D 画布 `webglcontextlost` 后重建；APK 渲染进程挂了重建 WebView（连挂 3 次显示出错画面），`EchoNative.takeRecovered()` 让网页提示「已经重新打开了」；画质上限：精美档 DPR ≤ 2、所有档 ≤ 60 帧、站着不动 30 帧，每 30 秒复查一次帧率。
- **朗读兜底**：有道在线发音现在整句会 500，只用于 ≤3 个词；没有提前配音的句子（带名字的台词等）现场用阿里云 `qwen3-tts-flash`（`EchoTalk.cloudTTS`：APK 直连、网页走中转服务 `/tts`，6 秒超时，同一句只合成一次）。
- **战斗口语题**：念完先停一下亮出答案（念到的词绿、没念到的红，没念好再放一遍标准读音，`monsters.js` 的 `reveal()`，`B.turn = 'show'`），再出招；第一次没念准给第二次机会时答案已经亮出来，所以第二次念对也**不能暴击**（`B.hinted`，和「💡 听一下答案」一样）。
- **支线委托**（2026-11-15，家长：「把 AI 聊天做进冒险里」）：能接的委托，委托人头上有金色「?」（2D `questMark`，3D `bubbleSprite('?', …, 金色)`）。按 A → 请求（照「剧情中文」设置）→「🗣️ 用英语帮 TA」/「以后再说」→ `EchoTalk.openQuest(id, 造型, onResult)` → 聊天目标完成（照旧按 `judge()`）→ 回地图道谢、给奖励。完成记在 `world.flags['q:' + id]` = 星数（第一次完成就定了，不能重做刷星），结果一到就连奖励一起存好，再演道谢；评语在后台才到的弹一句、下次找 TA 时补说感谢。没完成随时再来。AI 聊不了：照样说完请求，再用一句现成的话说原因（没开通 / 没网 / 时间用完：同一个原因再按 A 就是 TA 平常的话；密钥 / 额度：给「🔄 再试一次」）。委托不挡主线，用的是和首页聊天同一份每天的聊天时间。冒险菜单「📋 委托」列去过的岛上的委托；`EchoWorld.quests()` 给测试用。**学习锁在进冒险之前，委托开不了锁**；每完成一条算一个聊天目标，并且一定算「多学」（`dayLog().quests`，`bonusMin()`：+10 分钟冒险时间，每天最多 +30）。写委托的规矩在 `quests.js` 开头：不问孩子的个人信息、委托人不做情感陪伴、奖励只用现成的道具和 `DEX.list` 里的第一阶怪兽。中转服务要一起部署 `quests.js`。真的 AI（Qwen-Omni）会不会「问了才说」、守门人会不会真的坚持，只用假 AI 测过，没在手机上试。
- **今日目击**（2026-11-15 家长批准；界面上叫「🔎 今日目击 Today's Sighting」，是回声博士的告示板，对怪兽不说「通缉」）：逻辑全在 `sighting.js`。每天一个目标，按「日期 + 主角名字 + 第一只怪兽的 uid」算出来写进 `world.sight`（定目标不调 `save()`，没存上重新打开算出来也一样；手机日期往回调不重抽）。**地点**只从去得了的野外地图里挑：`world.been`（world.js `loadMap` 里记）加上「去过相邻两座岛的小镇 → 中间那条路上的地图」（老存档靠这个）；陆上的路用草丛、洞穴用洞穴地面、海路用海面、海底用海草（后两种要有水路的回声贝和徽章）；小镇、室内、勇气之路和冠军高原、嘘声团基地、回忆神殿不算（`SKIP`）。**怪兽**：`DEX.list` 里第一大区的第一阶，不出神兽 / 初始伙伴 / 保留的，栖息地对得上地形或地貌（`extraHab`），平时在这座岛这种地形的野生表里没有、或者稀有度 ≥ 3，优先没收服过的；等级 = 地图野生等级 +1–2；稀有色 1/8。**三条线索**（哪座岛 / 什么地方、从小镇怎么走 / 什么地形 + 怪兽的一样特点）都是从 `EchoMaps.THEMES`、`WORLDS[z].words`、地图的种类 / 英文名 / 出口、怪兽的属性 / 身体 / 主色 / 大小拼出来的，所以一定是真的——**改地图英文名、出口、岛的风格、话题单词以后跑 `node tests/sighting.test.js`**；不显示地图名、地图上不做记号。中文收在「译」后面：和剧情中文同一个设置，点一次记一次 `zhTaps`，但「自动」档在哪座岛都先收起来（读懂英文才是玩法），「总是显示」直接给中文。🔊 走 `sayText` → `say()`；模板能拼出的每一句由 `EchoSight.lines()` 交给 `tools/voice/collect.js`（两个版本各拼一遍，现在 157 句，已合成），改了模板要重跑 collect 和 gen。**大地图**：`onStep` 在剧情、训练师、孵蛋之后、普通遇怪之前；在对的地图对的地形里第 4–8 步出来（上一步也得踩在这种地形上），见过以后再走 10–16 步；悄悄喷雾有效时不出来（步数照算）；传说怪兽站在这张图上时不出来；每步只在内存里记步数，跟着 `savePos()` 存。对战是普通野外对战，`MG.battle` 的 `opts.tag` 换掉顶上的标题。收服：金币 +30，三条都没点「译」再 +20，`sight.total / streak / last`，成就 `sight1` / `sight7`（按累计，不按连续天数）。首页卡片在「下一枚徽章」和「传说的线索」之间，收服后收成一行；冒险菜单里是「现在要做」下面的一行（不占按钮格子）。
- **新台词的配音**：`node tools/voice/collect.js`（收集固定英文，现在也读 `quests.js` 和 `sighting.js`）→ `D:/Claude/tools/kokoro/Scripts/python tools/voice/gen.py`（本机 Kokoro，只合成还没有的，直接出 Opus/Ogg；约每秒 1 段）。2026-11-15 给委托和今日目击补了 315 段。
- **路上的对手**（家长反映「没看到她就走过来找我打」）：1 号路、3 号路的对手进地图时就站在小路上（`EchoStory.lib.rivalStand`），走近几格才「!」一下走过来（`approach()`），不再从主角前面 5 格凭空出现。
- **配乐什么时候放哪首**：`game.js` 的 `sceneMusic()`——首页 `title`，闯关练习/复习/对话剧场 `study`，大地图问 `EchoWorld.music()`（`world.js` 的 `mapMusic()`：小镇按岛 `town_a` 0–4 / `town_b` 5–7 / `town_c` 8–10 / `town_d` 11–12，道路 `route`（0–5 岛）/ `route2`，踏浪、海路、海底 `sea`，洞穴 `cave`、嘘声团基地 `hush`，挑战馆 `gym`，其他室内 `center`，勇气之路和冠军赛 `league`）；战斗由 `monsters.js` 的 `battleMusic()` 选（岛主/冠军赛/神兽 `battle_boss`，训练师 `battle_trainer`，野生 `battle_wild`），打赢 `win`（第一次拿徽章 `badge`）再接 `victory`，输了 `lose`，收服 `catch`，进化 `evolve` + `levelup`，休息站恢复 `heal`，拿道具 `item`，对手走过来 `rival`。`E.jingle(id, 原来的音效)`：音乐关着时退回原来的音效。**朗读 `say()` 自动 duck，`recognize()` / 录音自评 / 和岛民聊天自动 hold**——新加会出声或开麦克风的地方要走这两个函数。设置「音乐」关/小/中/大（`S.settings.music`）。
- 字体在 `assets/fonts`（Baloo 2、Nunito，SIL OFL），不连 Google。
- 调试入口：`EchoWorld._debug()` 可以拿到当前地图、玩家位置、渲染器，`goMap(id, how)` 直接传送（测试里用）。
- **性能测量**（2026-11-15，`tools/perf/`，都用真显卡的无头浏览器 `--use-angle=d3d11`、CPU 降速 4 倍模拟手机，只读不改游戏）：`profile.js [start,world,battle,mem] --label x`（冷启动、各类地图一帧多少毫秒 / draw call / 三角形、每招特效最长一帧和超 33ms 的帧数、内存；结果存 `out/<label>.json`，改之前之后各跑一遍对比）、`cpuprof.js walk|idle|battle|home`（CPU 采样按函数汇总）、`trace.js`（启动时浏览器在忙什么）、`saveperf.js`（存一次多久、走路掉不掉帧，`--full 1` 对比老办法）、`leak.js`（节点 / 监听 / 内存涨不涨，`--why 1` 打印引用链；脚本里别用 `p.$()` / `waitForSelector` 留元素句柄，句柄会抓住整棵节点树，量出来像游戏在漏）、`idle.js`（各画面停着、切后台时主线程占多少）、`fxprof.js <属性>-<档>|all|idle`（按浏览器 trace 找放招时超过 33 毫秒的任务是谁；新加的着色器材质、`kit.geo` 几何体要登记进 `BattleFX.warm`，不然第一次用会卡一下）、`apk.js` / `durable.js`（在模拟器里装好的调试包上执行 JS、测存档落盘）。2026-11-15 这一轮的前后对比：安装包 288MB → 161MB；放招时超过 33 毫秒的帧 7.1% → 0（34 招 6800 多帧）、对战等孩子开口时主线程占用 65% → 23%；每打一场 3D 战斗漏 96 个节点 / 0.6MB → 不漏；3 年的大存档走路 53 帧（62 帧卡）→ 60 帧。量过不用改的：冷启动 0.6–0.8 秒到首页（其中约 0.7 秒是浏览器第一次排中文和表情加载系统字体）、大地图站着 30 帧 / 走路 60 帧、一帧约 6 毫秒。

## 怪兽 3D 资源

- `art/` 是**母版**（不进仓库，`.gitignore` 忽略）：`art/gemini/cut2/<id>.png` Gemini 画的抠好的图、`art/hy3d/` Hunyuan3D 生成的模型、`art/mon3d/<id>.glb` 绑好骨骼做好动作的模型（约 600KB，未压缩）。
- `assets/` 是**发布版**（进仓库、随 GitHub Pages 发布）：`assets/mon3d/<id>.glb`（约 145KB）、`assets/mon2d/<id>.webp`（约 15KB）和两个 `index.json`。游戏只读 `assets/`。
- 重新生成的流程：`tools/mon3d/gen.py`（图 → Hunyuan3D 模型）→ 写 `tools/mon3d/rigs/<id>.json`（骨骼位置，见 `tools/mon3d/RIGGING.md`）→ `bash tools/mon3d/rigtool.sh rig <id>`（`tools/blender/monrig.py` 绑骨骼、做五个动作，导出 `art/mon3d/<id>.glb`）→ **`node tools/mon3d/publish.js`**（压缩发布到 `assets/`，更新索引）。
- `publish.js` 按修改时间只做有变化的（可以反复跑；`--force` 全部重做，后面跟 id 只做这几只；刚写出来 10 秒内的文件先跳过）。`--force --3d` 只把 3D 全部重做、2D 图标不动。3D 由 `tools/mon3d/glbopt.mjs` 压（gltf-transform + meshoptimizer + sharp，还是 EXT_meshopt_compression + WebP，游戏这边不用改），设置在 `publish.js` 的 `PUB`（2026-11-15 重新定，368 只 77.7MB → 51.6MB）：① 动作里一直等于骨骼原位的通道删掉（每只 165 条 → 39 条，播出来一样）、JSON 去掉默认值；② 顶点位置 12 位存成小整数（缩放并进逆绑定矩阵；gltf-transform 自带的量化位数调低文件不变小）；③ 贴图 WebP 质量 75 + 准确色度，大小按贴图密度自动定（`texPx: 0.7`：战斗最大特写里每个屏幕像素至少 0.7 个贴图像素，448–1024，平均 622，神兽按大三成算；`TEX_SIZE=512` 强制固定大小）；④ 减面最多到六成、误差 0.3%、贴图坐标和法线加权（平均 9000 → 7934 个三角形，只删顶点不挪顶点，蒙皮不会坏）。个别怪兽不减面：`tools/mon3d/overrides.json`（22 只，写着原因和门槛；改了它，里面列的下次 publish 自动重做）。只能小三分之一：一半以上是几何，Hunyuan3D 的贴图接缝太碎，再减面花纹和明暗交界看得出变；贴图再小特写里会糊。2D 图标用 Python + Pillow（裁透明边、放进 256×256、脚贴底）。没有 cut2 图的用 `art/gemini/cut/` 的。
- 改压缩设置前后核对画面：`node tools/mon3d/vdiff.js --a <旧目录> --b <新目录>`（真显卡无头浏览器，用 monster3d.js 的材质和战斗的灯光，每只 11 个角度 / 姿势，算轮廓重合度、模糊后的像素差、SSIM，最差的存成「旧 | 新 | 差别」对比图到 `tools/mon3d/_vdiff/`；`--shiny` 稀有色，`--loadtime` 量加载时间）；`node tools/mon3d/fxcheck.js --pairs a:b` 在 `tools/fx.html` 的真战斗里出招、倒下截图并查报错。`node tools/mon3d/glbopt.mjs <母版> <输出>` 不带参数 = 不减面的老做法，可以当参照。
- 现状（2026-09-30）：全部怪兽都有原画，368 只有会动的 3D 模型，18 只（`hold.txt`，大多是生成出来像纸片的）先用原画纸片。
- 生成得太扁：`gen.py --pca --seeds=21,42,5,9` 用顶点主成分量厚度、多试种子挑最厚的；不加 `--turbo` 用完整版（50 步）有时更立体。脚下连着薄地面圆盘的：骨骼 json 里加 `"cutbase": 0.02`（`monrig.py` 删掉贴地的薄层）。
- 全部怪兽都有 Gemini 原画（`assets/mon2d`）。还没有 3D 模型的（没生成完、或列在 `tools/mon3d/hold.txt` 里暂不发布的：模型太扁/多了底座/等重画），战斗里用 2D 原画立一张面向镜头的纸片（`monster3d.js` 的 `iconTex` + `buildImg`），不再用程序拼的模型。
- 出图流程：`art/gemini/families.json` 每个家族一张图（Gemini 网页版，`tools/mon3d/gembatch.py` 生成浏览器动作，和现成角色太像的在它的 `OVERRIDE` 里改描述；`gemwatch.py` 按队列把下载的图存成 `art/gemini/fam/NNN.png`）→ `tools/mon3d/split.py` 切成单只。`redo.txt` / `lookalike.txt` / `regen.txt` 记着要重画、撞脸、要重新生成 3D 的。`lookalike.txt` 里的 id 同时写在 dex.js 的 `RESERVED`（`tests/dex-edition.test.js` 核对两边一样）：销售版里没有它们，重画复核以后从两边一起删掉就放回来了。
- 战斗：`monsters.js` 开战时 `prep()` 把双方队伍的模型都下载好（最多等 2.5 秒，没下完先用程序模型，出场前下完就换上）；换怪兽、对手换下一只、我方倒下换人前也会等一下；进大地图时后台下载自己队伍的，进化时下载新样子的。

## 两个版本：家庭版 / 销售版（2026-10-07，2026-10-08 按评审补）

- 家庭版 `family`（弟弟用，默认）照旧；销售版 `sales`（试卖给别的家庭）不带撞脸的怪兽。版本由 dex.js 的 `edition()` 决定，按顺序取：APK 原生桥 `EchoNative.edition()`（返回 `'sales'` / `'family'`，**安卓那边打销售版时要提供**）→ 页面先设好的 `window.ECHO_EDITION` → 网址 `?edition=sales` → `localStorage['echo-edition']`；都没有就是家庭版。结果在 `DEX.edition` / `DEX.sales`。
- 销售版：`DEX.list` 里没有 `RESERVED` 的怪兽（`byId` 里还在，老 id 查得到不会出错）；进化目标被拿掉的，接到它的下一阶（用下一阶的进化条件），后面也没有就不进化；上一阶全被拿掉的成了这条链的第一阶（`DEX.isBase`，野外、蛋里都会出）。家庭版留着它们，放在手册最后的「番外」，不编号、不算总数。
- 两个版本的手册总数和第一大区数都一样（不算保留的）。野外表、蛋、训练师配队都用 `DEX.isBase` 判断第一阶。
- 测试：`tests/dex-edition.test.js`（不开浏览器）两个版本各载一遍 dex.js：总数、第一大区、进化链、编号、和 `lookalike.txt` 一致；浏览器里打开 `?edition=sales` 看手册。
- **打安装包**（`android/app/build.gradle`）：`gradle assembleRelease -PECHO_EDITION=sales` 打销售版——不读 `KEY_FILE`、`PARENT_PIN`、`TALK_*`（BuildConfig 里是空的，`checkReleaseConfig` 再兜底）；`copyWeb` 先跑 `node tools/build-dex.js --sales=build/generated/sales-web`（要求 dex.js 是最新的），打包时**换上**没有保留怪兽记录、进化链已经接好的 dex.js 和去掉保留 id 的 `assets/mon3d/index.json`、`assets/mon2d/index.json`，**不复制**保留怪兽的 `assets/mon2d/<id>.webp`、`assets/mon3d/<id>.glb`（按 `tools/mon3d/lookalike.txt`）。`-PECHO_BOOKS=hj7a,hj7b` 是销售版开放的课本册（不写就是七上、七下，原生 `EchoNative.books()`）；检查新版本的默认地址只打进家庭版（`echo.properties` 的 `VER_URL`，原生 `EchoNative.verUrl()`，game.js 里不写死）。`-PECHO_VERSION_CODE=n` 直接用这个版本号、完全不调用 git。打完要「反编译」检查：没有密钥（`sk-`）、没有家长密码哈希、没有保留怪兽的文件和记录、有 `setup.js` 和 `pages/`、没有 `dictvoice`。
- **销售版只开放本学年的课本**（game.js 的 `BOOK_OPEN` / `bookOpen()`）：别的册在课本单元页显示 🔒，点了说「下一学年的内容包，请家长联系帮您安装的人」；猜「正在学」时停在开放的最后一个单元；挑战馆的课本门槛只用到七上、七下，不受影响。
- **忘了家长密码**（销售版，`tests/sales.test.js` 走过一遍）：家长设置「💾 导出存档」（不用密码）→ 清除 App 数据 → 重新走一遍首次设置、设新密码 →「从备份恢复」→「从文件里选」刚导出的文件，进度和家庭定制都回来。家长设置和向导第 ③ 步都写着这几步。
- 销售材料在 `D:/Claude/echo-island-sales`（SOP、长图、话术、合同、隐私说明……）；`_build/shots.js` 拍销售版的真实界面截图（含向导 6 步 `07-向导-*.png`），`_build/longimage.js` 生成长图，`_build/make-tracker.js` 生成跟踪表。改了 App 的界面要重新拍图、生成长图。

## 必须遵守的限制

- **孩子的手机是 REDMI Turbo 5**（天玑 8500-Ultra、12+4GB、2756×1268、HyperOS 3），**最终交付是 APK**（`android/`）。家长的要求：孩子要真的能和 AI 用英语对话（不只是背单词），每天有错题本、温故而知新；课本是沪教版，要覆盖整个初中。
- **用户在中国大陆**：Google 服务（字体、Chrome 语音识别）基本不可用；很多安卓浏览器没有英语 TTS 声音，已用有道在线发音兜底。新功能都要在"没有语音识别"的情况下也能玩（自评模式）。
- **不能用任何现成游戏 / 动画 IP 的内容**：名字、角色、怪兽、Logo、道具名、招式名、地名、官方中文译名都不能用（近义的改法也不行），只做"类似的玩法"，怪兽和人物都是原创；代码注释、文档里也不写「仿某某」。`node tools/check-banned.js`（`npm test` 的第一步，不开浏览器）按 `tools/banned-terms.txt` 查全部源码、测试和文档，有一处就失败；新加道具、招式、地名、技能前先看一眼这个清单。
- **儿童安全**：AI 对话只扮演游戏角色、限定话题、不收集个人信息；对话记录家长可查。
- **密钥永远不进仓库**：仓库要开 GitHub Pages，是公开的。AI 平台的密钥放在中转服务的环境变量 / `KEY_FILE`（`D:/Claude/tools/echo-relay/game-key.env`）里；APK 打包时从 `KEY_FILE` 读进 BuildConfig（家长定的，APK 只发给自家人）。`android/echo.properties` 里有签名密码和家长密码 `PARENT_PIN`：**不要读出来、不要打印、不要写进日志**。中转服务的静态文件只放白名单（根目录的 html/js/css 和 assets/ vendor/ isles/ dl/）。
- 手机上麦克风和语音识别需要 HTTPS（或 localhost）。用 `http://电脑IP:8000` 在手机上打开时麦克风会被浏览器禁止，手机测语音要用 GitHub Pages 或 HTTPS 隧道。

## 和家长已经商定的路线

目标：做成经典掌机 RPG 那种复杂度的 2.5D 冒险 RPG，剧情越往后越难，覆盖初中三年（约 1600 个课标词汇），并接入 AI 语音模型，让孩子能和游戏角色真正用英语对话。

范围（已和家长确认的取舍）：
- 地图：13 个小镇 + 约 12 条道路 + 3–4 个洞穴/小岛，约 30 张地图，房子能进去
- 怪兽全部原创（家长 2026-09-28 改成大约四百种，原来定 40–50；手册显示的总数不算 `RESERVED` 里保留的），17 种属性、双属性，Lv 1–100，按等级/进化曲进化，21 只神兽；招式 51 个（17 属性 × 小招/中招/大招），每个招式对应一个英语任务；**怪兽和战斗都是 3D**，招式有特效
- 队伍 6 只 + 电脑箱子；背包约 20 种道具；回声技能（砍树、踏浪、推石头、照明）解锁新区域
- 一个反派组织的主线剧情 + 支线；13 个岛主 + 最终英语冠军赛
- 做状态异常；**不做**个体值/努力值/特性/性格（对初一太复杂，冲淡学英语）
- 通关目标 10–15 小时

三年结构：
- 初一：第一大区（现在的 13 个小镇），入门，单词、简单句、有提示的对话
- 初二：第二大区，过去时/将来时/比较，带目标的自由对话（点餐、问路、讲一件事）
- 初三：第三大区 + 勇气之路，表达观点、讲故事；专门练**中考英语听说考试**题型（朗读短文、情景问答、话题简述）
- 后面的区域按孩子的进度和掌握程度逐步开放

2.5D 画面：推荐 HD-2D（《八方旅人》那种）——three.js 程序生成 3D 方块地图 + 斜视角 + 光影/景深；人物和怪兽是 2D 纸片放进 3D 场景；人物走路动画继续用代码画（生图模型画不出一致的动作帧）。three.js 要放进仓库本地加载，不依赖国外 CDN。保留一个"流畅模式"可以退回现在的 2D 画面。

AI 语音：推荐**火山引擎（豆包）端到端实时语音大模型**（中英文、低延迟），以后可加**讯飞英语口语评测**做音素级发音打分。需要一个小中转服务保管密钥（浏览器 WebSocket 不能带鉴权头，也不能暴露密钥）。没网或服务出错时退回现在的"选答案 + 跟读"模式。

## 开发阶段（每个阶段结束都要能玩、要提交）

1. ✅ **2.5D 引擎 + 多地图**（2026-09-28 完成）：进房子、道路、洞穴；队伍 6 只、电脑箱子、背包；迁移现有存档（保留怪兽、徽章、金币）
2. **战斗和剧情系统**：更多招式、状态异常、双属性、回声技能、剧情事件和过场；学习记录（每个词的掌握度、每天开口时长）和家长周报
3. **接入 AI 对话**：中转服务、语音识别、自由对话 NPC、带目标的对话任务、温和纠错、发音评分、语音合成、每日对话上限
4. **第一大区完整内容 + 美术图**：初一内容做完，换上家长用生图模型出的图（怪兽约 50 张、人物立绘/头像约 30 张、战斗背景 13 张、主视觉）
5. **第二、第三大区**：跟着孩子升年级陆续做

## 要补的系统（2026-09-28 和家长定的顺序）

1. ✅ **战斗加深**：速度决定先后手、四项能力（体力/攻击/防御/速度）、按等级学招（4 招上限，学新招要忘旧招并说 "X, learn Y!"）、12 个辅助招式、异常状态（烧伤/中毒/麻痹/睡眠/冰冻/混乱，睡着冻住要喊 "Wake up!"）、能力升降、战斗中换怪兽、共学耳机、徽章听话等级、训练师会用药、怪兽详情页
2. ✅ **大地图能力**：开路（三级）/点灯/水路（三级）/乘风按徽章数解锁（2026-10-08 起合成四种技能），队伍里要有对应属性的怪兽，使用时说英语指令；新路段 grove/lake/rubble/boulder 的障碍只挡支线（道具、稀有草丛、湖心岛）；洞穴不点灯很黑；水上遇怪；钓竿（听词选意思）、自行车、回声探测器、藏起来的道具（`*`，每个小镇和洞穴也自动藏一个）
3. ✅ **剧情**：第 2–13 镇嘘声团章节（`story.js` 的 `CH` 表：水晶、团员/干部、夺回后要念的句子），挑战馆 4 座雕像答英语题点亮 3 座才能挑战岛主，对手在 4/8/11 号路再战，第 13 镇默先生 + 回声龙，第 13 镇北边英语冠军赛（`i12L` 大厅、`i121`–`i124` 四位擂主、`i125` 冠军）+ 光荣榜
3½. ✅ **完整的冒险流程**（2026-09-29）：13 座岛全部手画（`isles/*.js`，约 150 张地图：分岔、环路、海路、潜海、瀑布、冰洞、火山、嘘声团基地、神殿、三层的勇气之路），每座岛地貌和建筑风格不同、剧情是自己独特的事件（世界设计 `WORLD.md`），回声技能从剧情人物拿并卡住主路，配角（爸爸、小凯、导师欧瑞、盖尔船长、妈妈电话），13 个挑战馆各有机关，四位擂主各有规则
4. ✅ **养成收集**（2026-09-29）：英文昵称（收服 / 孵出来时起名，要说 "Your name is …!"，战斗和野外指令都用昵称）、亲密度（每天用英语和怪兽说一句——详情页或面对跟着走的怪兽按 A；走路、打赢、升级也会变亲；很亲时有机会咬牙坚持住、伤害略高）、稀有色（野外 1/64，蛋 1/32，换一套颜色）、电脑箱子（现在 10 个 × 24 只）（搬家、排序）、家庭岛怪兽幼儿园（奶奶先送一个蛋；寄养两只同属性的会出蛋，每走 100 步长 1 级）、蛋走路孵化、手册出没地点（按地图的野生表算）
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
npm test            # 并行跑全套（tools/test-all.js，默认同时 6 个，约 15 分钟；失败的自动单独再跑一次）；完整输出在 tests/logs/
npm run test:serial # 老办法一个个跑（约 1 小时）；node tools/test-all.js battle talk 只跑名字里带这些字的
```

- `tools/check-banned.js`：查 `tools/banned-terms.txt` 里不能出现的词（不开浏览器，`npm test` 第一步）。清单分几类（具体的词只写在清单里，这里不重复，免得自己被查出来）：系列名 / 官方译名、野外技能和道具、地点和联赛、对战的固定说法、开场博士自我介绍那段的老台词、对战和养成里的老说法（进化、倒下、学招、蛋在动、「去吧」、野生出现、选招提示……）、建筑和建筑主人、休息站的人、反派小兵的老叫法、课本的「同步」说法、和那套系列一样的数字。**新加台词前先看一眼**；这个检查器只查字面，玩法和数值上的相像（克制表、收服、开场结构……）要人看
- `tests/dex-edition.test.js`：家庭版 / 销售版的怪兽手册（不开浏览器）：总数和第一大区不等于那两个数、销售版没有保留的怪兽、进化链接好、编号连着、`RESERVED` 和 `tools/mon3d/lookalike.txt` 一致；dex.js 里没有老编号 `no`、手册按大区排、神兽在每个大区最后、初始伙伴不在最前、神兽和几只三阶换了属性；`build-dex.js --sales` 生成的销售版 dex.js 没有保留怪兽的记录、和运行时过滤的销售版一样、两个 index.json 去掉了保留的
- `tests/sales.test.js`：销售版（假原生桥 `edition: 'sales'`）：向导 6 步的顺序和每一步（设备不合格不能往下走、提示付款）、对家长不说「游戏」、开场渡轮念通行证、家人、三个贝壳里是挑的 3 只、AI 标识、周报 AI 单价、开源许可页、改密码、改家庭定制、课本只开放七上七下、**忘了家长密码的恢复流程**；家庭版不出向导
- `tests/maps.test.js`：地图数据检查（不开浏览器，秒出结果）
- `tests/adventure.test.js`：2D 模式下走一遍：博士 → 休息站（护士、电脑）→ 商店 → 守卫 → 拿徽章 → 1 号路（跳台阶、训练师、草丛、战斗背包）→ 第 2 镇；最后测老存档迁移
- `tests/render3d.test.js`：3D 渲染器在每类地图都能画出来、切地图不泄漏显存、设置里 2D/3D 切换、慢设备自动降档（无头浏览器用软件渲染，正好很慢）
- `tests/story.test.js`：开场剧情走一遍（渡轮上选照片、写名字、念通行证 → 妈妈 → 邻居博士走过来 → 三个贝壳里选伙伴 → 和博士的啃啃鼠练习赛 → 1 号路对手），以及老存档补问名字
- `tests/league.test.js`：英语冠军赛四位擂主的规则（单词 / 听力 8 秒 / 口语 / 对话满能量）、冠军换规则、光荣榜
- `tests/raise.test.js`：怪兽幼儿园送蛋、寄养出蛋、孵蛋起名、和怪兽说话（亲密度）、面对跟着走的怪兽说话、稀有色、电脑分箱子、手册出没地点
- `tests/field.test.js`：在测试专用小地图上测回声技能（回声贝 + 徽章、开路砍树 / 敲碎裂石 / 推石头、水路在水上走、钓鱼、爬上 / 冲下瀑布、潜到海底再浮上、冰面滑行、楼梯、点灯、乘风、自行车、藏起来的道具）
- `tests/isle-a.test.js` … `isle-e.test.js`：每组岛的主线剧情、挑战馆机关、回声贝、卡点，外加 2D / 3D 截图；公用工具在 `tests/helpers.js`
- `tests/battle.test.js`：战斗规则（先后手、睡眠叫醒、换怪兽、辅助招式、学新招忘旧招、共学耳机、详情页）
- `tests/practice.test.js`：闯关练习第 1 关全对，检查三星和回声球奖励
- `tests/music.test.js`：配乐——每类画面/地图/战斗放对的曲子、朗读压低、麦克风静音、胜利号角接结算音乐、离线渲染不爆音、设置里关掉
- `tests/book.test.js`：课本单元（选单元、单元第 1 关通关、老存档迁移）、每日复习的排期（答错当天、答对隔 1/2/4/7… 天、AI 聊天句子进复习）、冒险出题里课本占的比例、聊天页课本角色排序
- `tests/apk.test.js`：用假原生桥（`tests/fake-native.js`，`FN.install`）模拟 APK：额度用完 / 密钥失效 / 没网的提示和「先跳过」、对战听音选、麦克风被拒「去打开」、首页红条、第一次的小检查、聊天连不上时孩子看到的话、学习锁、家长密码走原生、存档备份 / 导出 / 恢复、出错记录、版本检查、画面丢了重建
- `tests/gate.test.js`：学习锁（6 句 / 小目标、30 分钟临时放行、Wi-Fi 上不了网、聊天时间用完）、返回键、家长密码（数字键盘、错 5 次锁、要密码的设置、输完没弹窗就作废、剧情中文改宽松要密码）、清空前另存、改日期、冒险时间、周报、日报推送
- `tests/native.test.js`：不开浏览器——原生桥方法和 README / 假桥一一对应、build.gradle（KEY_FILE 进 BuildConfig、PIN 只放哈希、没签名停下、版本号）、用 JDK 实跑 `PinGuard` / `BackupNames`
- `tests/review.test.js`：诚实打分（易混音、词尾、同音词、拼写变体、丢撇号、拼音人名）、秒出分、复习本的规则和 120 天模拟、撤提示和题型标签
- `tests/save.test.js`：备份压缩来回压、大存档走路只记位置 / 各种时候整份存 / 被杀掉后位置还在、3 年的大存档打得开、压着的备份恢复、存档空间提示
- `tests/quests.test.js`：支线委托——数据（17 条、委托人在地图上、小步骤、英文里没有中文、不能出现的词、不问个人信息、奖励是真的、销售版也有这些怪兽）、`questNpc` 带安全规则、中转服务按 id 拼人设并且不理手机发来的人设、游戏里走一遍（「?」→ 请求 → 聊天 → 奖励 → 存档 → 委托本）、没完成能再来、前提、AI 用不了的四种情况、评语后台才到、多玩 10 分钟、老存档、2D / 3D 的「?」
- `tests/sighting.test.js`：今日目击——（不开浏览器）目击地点只有道路 / 洞穴 / 海路 / 海底、那种地形从入口走得到、线索模板句子；同一天同一份存档同一个目标，刚过第一条路 / 玩到一半 / 打通了三种存档各模拟 60 天，每张地图 × 每只候选 × 每种说法的线索对着地图和怪兽数据查（家庭版、销售版；没有保留的、没有神兽）；首页卡片、冒险菜单、告示板（竖屏横屏截图 `sight-*.png`）、「译」和 🔊；不对的地图 / 地形不出来，对的地形第 4–8 步出来，逃跑后再遇，收服（金币、累计、连续、成就），悄悄喷雾，传说怪兽在场，洞穴 / 海面 / 海底，过零点，老存档，大存档走路不整份存
- `tests/talk.test.js`：talk-core（安全规则、`<transcript>`、打字不算步骤、judge）、聊天界面（句数、帮帮我、再听、看中文、打勾、打字、返回键、安全标记 + 家长密码看全文、家长须知）、中转服务
- `tests/world-goals.test.js`：目标提示、挑战馆的课本门槛、首页三样（📍 小字、下一枚徽章、传说的线索）、剧情中文、岛主重赛、四只神兽、宝箱、过零点回首页
- 测试里把发音来源设成在线、口语设成自评，这样不依赖本机声音和麦克风
- 改完画面要看截图确认；改完逻辑要跑 `npm test`（全部测试都过才提交；岛的测试比较慢，并行跑大约 15 分钟）
