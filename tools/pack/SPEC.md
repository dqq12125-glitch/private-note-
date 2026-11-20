# 课程包（2026-11-20）

老板：「把这些语言的课程包放到网上，而不是放到程序里面，要学什么语言再下载。」先做四门：英语、中文、日语、西班牙语。

这份是施工说明：课程包里有什么、放在哪、手机上怎么下载和存、游戏怎么用。内容怎么写见 `tools/course/SPEC.md`。

## 1. 两种模式

| | 老模式（bundled） | 课程包模式（packs） |
| --- | --- | --- |
| 谁用 | 家庭版 APK、弟弟的线上版、所有现有测试 | 公开版（iPhone / 以后的安卓销售版）、网址带 `?packs=<地址>` |
| 开关 | 没有课程包地址 | 有课程包地址：原生启动对象 `__ECHO_BOOT.packsUrl`（打包时的 `ECHO_PACKS_URL`）→ `window.ECHO_PACKS_URL` → `?packs=` 记在 `localStorage['echo-packs-url']` |
| 配音 | 包里的 `assets/voice/{f,m}/<key>.ogg` | 不进安装包；从课程包下载，存在手机上 |
| 英语的文字内容 | 包里的 data.js / book.js / … | 第一步照旧在包里（不到 1 MB，剧情台词本来就写在代码里） |
| 别的语言 | 没有 | 全部来自课程包的 `course.json` |

**老模式一个字节都不许变**：`EchoPacks.on === false` 时所有路径和现在一样，现有测试不改就要全过。

## 2. 放在网上的样子

```
<地址>/catalog.json
<地址>/<语言>/<版本>/manifest.json
<地址>/<语言>/<版本>/course.json          （英语第一步没有）
<地址>/<语言>/<版本>/voice-000.bin …
```

- 托管：Cloudflare 上只有静态文件的 Worker `echo-island-packs`（配置 `tools/pack/wrangler.toml`，没有代码、数据库、定时任务；2026-11-20 已发，`https://echo-island-packs.dqq12125-study.workers.dev`；单个文件 ≤ 25 MiB，配音包每个约 8 MiB）。`_headers` 给 `Access-Control-Allow-Origin: *`；带版本的路径 `Cache-Control: public, max-age=31536000, immutable`，`catalog.json` `max-age=300`。
- 版本号：`YYYYMMDD.n`。同一个版本的文件永远不改；内容变了就出新版本、改 `catalog.json`。

`catalog.json`
```json
{ "fmt": 1, "packs": {
  "en": { "ver": "20261120.1", "name": { "zh": "英语", "en": "English", "self": "English" },
          "bytes": 103800000, "core": 15000000, "course": false } } }
```

`manifest.json`
```json
{ "fmt": 1, "lang": "en", "ver": "20261120.1",
  "voice": { "fmt": "ogg-opus", "f": "af_heart", "m": "am_michael", "n": { "f": 13767, "m": 5464 } },
  "files": [
    { "name": "course.json", "kind": "course", "bytes": 0, "crc": "…" },
    { "name": "voice-000.bin", "kind": "voice", "core": true, "bytes": 15000000, "crc": "9f3a01c2", "n": 2800 } ] }
```

配音包 `voice-NNN.bin`（一个文件自己说得清自己）：
```
4 字节  "EPK1"
4 字节  头的长度 H（小端 u32）
H 字节  UTF-8 的 JSON：{ "items": [["f","k3x9a",5321], ["m","k3x9a",4980], …] }   每条 = [声音, key, 这段多少字节]
后面    各段 .ogg 原样接在一起，顺序和 items 一样
```
- key 就是 `tools/voice/key.js` / game.js `clipKey` 的那个哈希。**别的语言的 key 是那门语言的文字的哈希**（`say(显示出来的那句话)` 不变）。
- `crc` = 整个文件的 CRC-32（8 位十六进制）。只防下坏、下一半；传输安全靠 HTTPS。
- **先下要紧的**：配音按「先用到的在前」排好再切包，前面约 15 MB 标 `core: true`。core 装完就能开始玩，其余在后台接着下；没下到的句子照现有的兜底走（云端合成 → 本机声音）。排序（英语）：能力检测 → 13 个话题小镇和对话动画 → story / world / game / monsters 里的固定句子 → isles/a → 第一册课本 → 委托 → 今日目击 → 怪兽的对战句子（按手册编号）→ 其余课本 → 其余岛 → misses。`tools/voice/collect.js` 给每句记一个来源顺序 `p`（不改 key、不改现有字段的意思）。

## 3. 工具

- `node tools/pack/build.js --lang en [--ver 20261120.1] [--out dist/packs] [--only N]`：生成上面的文件（`--only N` 只取前 N 句，给测试做小样）；同一份输入生成的文件逐字节一样。再跑一次 `--catalog` 把 `dist/packs` 里现有的各语言最新版本写成 `catalog.json` 和 `_headers`。
- `node tools/pack/check.js <目录>`：照 manifest 核对每个文件的大小、crc、items 加起来等于文件长度、key 不重复。
- `dist/` 不进仓库（`.gitignore`）。
- 发布由主会话做，**代理不要部署、不要建 Cloudflare 项目**：`cd cloud && npx wrangler deploy --config ../tools/pack/wrangler.toml`（先加 `--dry-run` 看一眼：只该有 assets、没有绑定；**一定带 `--config`**，原因写在那个配置文件开头）。发完从外面整个下一遍核对大小和 crc。
- 别的语言：`tools/course/build.js` 出 `course.json` 的内容和要配音的句子表，配音生成以后同一个 `tools/pack/build.js --lang ja` 打包（等课程内容那一路落地再接，接口先留好：`--course <文件> --voice <目录>`）。

## 4. 手机上：`packs.js`（`window.EchoPacks`，index.html 里排在 i18n.js 后面）

存在 IndexedDB（库 `echo-packs`）——iPhone、安卓、浏览器同一份代码，不加原生方法：
- `meta`：`<语言>` → `{ ver, state, files: { 文件名: 'done' }, bytes, done, keys: { f: [...], m: [...] }, at }`
- `clip`：`<语言>/<声音>/<key>` → ArrayBuffer（一段一条，读的时候只读这一段；**不存 Blob**，老 WebKit 的 IndexedDB 存 Blob 有毛病）
- `doc`：`<语言>/course` → course.json 的内容

```
EchoPacks.on            有没有课程包地址
EchoPacks.base          地址
EchoPacks.course()      现在学哪门（localStorage['echo-course']，没有就是 'en'）
EchoPacks.ready()       Promise：这门课启动要用的读好了（已装的 key 表；非英语的 course 内容）。老模式立刻好
EchoPacks.state(lang)   'none' | 'part'（下了一部分，core 没齐）| 'core' | 'full'
EchoPacks.info(lang)    { ver, bytes, done, state, busy, err, update }
EchoPacks.catalog()     Promise<目录>（内存里缓存；没网时用上次存的）
EchoPacks.install(lang) 开始 / 接着下载。一个文件一个文件来：下载（有进度）→ 核对 crc → 拆成一段段写进 clip（一批几百条一个事务）→ 记 files[name]='done'。
                        断了、切后台、杀进程以后再叫一次，从没做完的那个文件接着来。同时最多两个文件。失败重试 3 次（1 秒、3 秒、8 秒）
EchoPacks.pause(lang) / EchoPacks.remove(lang)
EchoPacks.hasClip(key, g)   同步：这段装了没有
EchoPacks.clip(key, g)      Promise<blob: 地址 | null>（用完由 packs.js 自己回收：下一段开始放时回收上一段）
EchoPacks.content()         这门课的 course 内容（英语 = null）
EchoPacks.setCourse(lang)   记下来、重新打开页面
EchoPacks.on_(事件, fn)      'progress' / 'state'
```
- 空间：下载前 `navigator.storage.estimate()`（有原生 `storage()` 时用它的剩余空间），不够就不下、说清楚差多少。
- 流量：**第一次下载一门课要人点一下**（界面写明多少 MB）；点过以后（`meta.state` 不是 none）下次打开自动接着下。
- 更新：catalog 里的版本比装的新 → `info().update`；第一步只提示、点了才更新（先装新的、齐了再删旧的）。
- 坏了的路都要有出口：IndexedDB 打不开（隐私模式等）→ `EchoPacks.store === 'none'`，配音当作没有（照兜底走），界面上说一句；catalog 取不到 → 用已装的；crc 不对 → 这个文件重下。
- 加载时不碰 DOM、不读存档；Node 里能 `require`（给测试用，拆包 / crc 这些纯函数挂在 `EchoPacks._`）。

## 5. 游戏里怎么接

- **配音**（game.js 的 `clipKey` / `clipUrl` / `sayRaw` 那一段）：课程包模式下 `CLIP` 换成问 `EchoPacks.hasClip`，有就 `EchoPacks.clip()` 拿到地址再 `playUrl`；没有照旧往下走。老模式不变。`[voice-miss]` 的记录照旧。
- **启动**：`start()` 要等 `EchoPacks.ready()`（老模式同步直接走，行为和现在一模一样）。
- **界面**（字都进 i18n，前缀 `pk.*`，中英文都写）：
  1. 首页一条：这门课的语音包没下 / 下了一部分 →「📦 下载英语语音包（99 MB）」；下载中显示进度；下完不占地方。
  2. 设置里「📦 课程和语音包」一页：现在学的语言、每门课的状态 / 大小 / 进度条、下载 / 暂停 / 删除、占了多少空间。孩子模式下「删除」要家长密码。
  3. 全新的开始（能力检测的「选语言」之后）：一页「下载课程」，写明大小，core 下完才能「继续」，其余在后台下。
- 第一步「要学的语言」只列得出英语（别的语言的引擎和内容在做）；目录里有、引擎还不支持的语言不显示。
- **存档分开（留好口子，先不做）**：以后每门课一份自己的存档（`echo-island-v1` 是英语，别的 `echo-island-v1@<语言>`），换语言 = 换存档再重开页面。这一步由后面「引擎支持多语言」那一路做，这一路不要动存档。

## 6. 安装包

- iPhone：`ECHO_PACKS_URL` → `make-config.mjs` → `BuildConfig.packsUrl` → 启动对象 `packsUrl`（和 `cloudUrl` 同一条路）。给了地址时 `copy-web.mjs` 不复制 `assets/voice/f/**`、`assets/voice/m/**`、`assets/voice/index.json`（必备文件检查跟着改）；`ios-testflight.yml` / `ios-simulator.yml` 从仓库变量取地址。
- 云上模拟器要证明的（这台 Windows 证明不了）：`echoisland://` 这个来源能用 IndexedDB 存 ArrayBuffer、重开 App 还在；从 `www-test/packs/` 的小样课程包装一遍；装好的那段在 WKWebView 里放得出声（`audio` 的 `play()` 不报错、`ended` 来了）。写进 `selftest.html` 和 UI 测试。
- 安卓：家庭版不变。销售版以后同一份 JS 就能用，这一步先不改 gradle。

## 7. 测试

- `tests/packs.test.js`（Playwright Chromium，本机小网站放一份 `--only` 生成的小样）：装、断了接着装、crc 坏了重下、core 好了就能放、`say()` 真的放了课程包里的那段、删掉、空间不够、IndexedDB 打不开、老模式完全不走这些代码。
- 不开浏览器的：打包 ↔ 拆包一来一回一样、crc、排序稳定。
- 登记进 `tools/test-all.js` 和 `package.json`。
