# 回声岛 安卓版（APK）

一个全屏 WebView 壳：游戏网页（`index.html`、各个 `.js`、`assets/` 里的怪兽模型和配音）在打包时整个复制进 APK，
用 `https://appassets.androidplatform.net/assets/www/index.html` 这个虚拟安全地址打开，所以：

- **离线能玩**：冒险、闯关、课本单元、每日复习都不用联网（没有提前配音的句子联网时用阿里云 qwen3-tts-flash 现场合成；不再用有道）。
- **麦克风能用**：第一次开口时弹系统权限框（`RECORD_AUDIO`），WebView 里 `getUserMedia` 自动放行；被永久拒绝时网页可以用 `micPermission()` 看出来，`openAppSettings()` 跳到系统设置。
- **AI 聊天和口语打分要联网**：原生桥带着百炼密钥直连 `dashscope.aliyuncs.com`（只许连这一个域名），网页拿不到密钥本身。
- 返回键交给游戏处理（`window.EchoBack`：关弹窗 → 关聊天 → 回首页），首页再按就退到后台。
- 竖屏 / 横屏 / 跟着手机转（游戏设置里选，原生记住）、沉浸式全屏、不跟系统字体缩放、玩的时候屏幕常亮。
- 网页的渲染进程崩了或被系统杀了（切去微信很久再回来可能发生）：不闪退，原生重建 WebView 重新打开，存档还在。

## 打包

需要 JDK 17、Android SDK（platform 35、build-tools）、Gradle 8.9+。本机都装在 `D:\Claude\tools\android`：

```bash
cd android
cp echo.properties.example echo.properties   # 填家长密码、签名；KEY_FILE 指向游戏专用密钥文件
JAVA_HOME=D:/Claude/tools/android/jdk-17.0.20.1+1 GRADLE_USER_HOME=D:/Claude/tools/android/gradle-home \
ANDROID_HOME=D:/Claude/tools/android/sdk D:/Claude/tools/android/gradle-8.10.2/bin/gradle assembleRelease --console=plain
# 输出 app/build/outputs/apk/release/app-release.apk（约 300MB，要 15–30 分钟）
```

`echo.properties` 和签名文件（`*.jks`）不进仓库。

### 两个版本：家庭版 / 销售版（2026-10-07）

| | 家庭版 `family`（默认，弟弟用） | 销售版 `sales`（试卖给别的家庭） |
| --- | --- | --- |
| 怎么打 | `gradle assembleRelease` | `gradle assembleRelease -PECHO_EDITION=sales`（也可以设环境变量 `ORG_GRADLE_PROJECT_ECHO_EDITION=sales`） |
| applicationId | `com.echoisland.app` | `com.echoisland.english`（两个是不同的 App，能装在同一台手机上，销售版不会覆盖弟弟的家庭版） |
| 百炼密钥 | `KEY_FILE` 的打进 `BuildConfig.DASHSCOPE_KEY` | **不读 KEY_FILE**，`DASHSCOPE_KEY` 是空的；家长在首次设置向导里粘贴自己的密钥（`setKey`，只存在这台手机） |
| 家长密码 | `PARENT_PIN` 的加盐哈希打进 APK，不能在手机上改 | **不读 PARENT_PIN**，哈希是空的；家长在首次设置向导里设（`setPin`：每台手机一个随机盐 + SHA-256，存在原生，原文不存） |
| 中转服务 | `TALK_URL` / `TALK_CODE` | 一律空的（不替别的家庭跑服务器、不留聊天记录） |
| 系统自动备份 | `allowBackup=true` | `allowBackup=false`（App 数据里有家长的密钥和孩子的存档，不让系统传到云上） |
| 版本名 | `20261007-1a2b3c4` | 末尾加 `-s`：`20261007-1a2b3c4-s` |
| 网页里 | `EchoNative.edition()` = `family` | `EchoNative.edition()` = `sales`：怪兽手册不带撞脸的保留怪兽（`dex.js`）、第一次打开走「家长首次设置」向导（`setup.js`） |
| 保留怪兽（`tools/mon3d/lookalike.txt`） | 照旧打包（番外） | **连美术带记录都不打包**：`copyWeb` 先跑 `node tools/build-dex.js --sales=build/generated/sales-web`，换上没有保留怪兽记录的 `dex.js` 和两个 `index.json`，不复制 `assets/mon2d/<id>.webp`、`assets/mon3d/<id>.glb`（要先把 dex.js 生成成最新的，不然停下） |
| 课本 | 全部开放 | 只开放 `-PECHO_BOOKS`（默认 `hj7a,hj7b` 七上、七下；`EchoNative.books()`），别的册 🔒 |
| 检查新版本的默认地址 | `echo.properties` 的 `VER_URL`（不写就用原来的 GitHub Pages 地址；`EchoNative.verUrl()`） | 没有（新版本私下发） |
| 版本号 | `versionCode` = git 提交数 | 同左；`-PECHO_VERSION_CODE=n` 两个版本都能用：直接用这个号、完全不调用 git |

版本只由 `-PECHO_EDITION` 决定（不写就是 family），不看 `echo.properties`——同一份 `echo.properties` 两个版本都能用（销售版不读里面的 `KEY_FILE` / `PARENT_PIN` / `TALK_*`，签名照用）。
销售版的 `checkReleaseConfig` 反过来查：`BuildConfig` 里有密钥或家长密码哈希就**报错停下**。打完自己再核对一遍（不要把值打印出来）：

```bash
# 解出 classes*.dex，数一数 sk- 开头的密钥、64 位十六进制（密码哈希的样子）有几处：销售版都应该是 0（只数个数，不打印内容）
mkdir -p /tmp/echo-s && cd /tmp/echo-s && unzip -o -q .../app-release.apk 'classes*.dex'
cat classes*.dex | grep -a -o -E 'sk-[A-Za-z0-9]{20,}' | wc -l       # 0
cat classes*.dex | grep -a -o -E '[0-9a-f]{64}' | wc -l              # 0（家庭版是 1：那就是家长密码的哈希）
```

### 公开测试版：销售版 + 云端模式 + 课程包模式（2026-11-24）

和 iPhone 的 TestFlight 版同一套：销售版（没有密钥、没有打包的家长密码），再加两个**可选**的网址（不是秘密，两个版本都能给；写法和 `ios/scripts/make-config.mjs` 的 `cloudUrlOf` / `packsUrlOf` 一样：`https://域名[:端口][/路径]`，本机试的 `http://localhost[:端口]` 也行，不带查询参数，写错就报错停下）：

| 属性（`-P…`，或环境变量 `ORG_GRADLE_PROJECT_…`） | 作用 |
| --- | --- |
| `ECHO_CLOUD_URL` | 公开版服务器（`cloud/`）。给了 = **云端模式**：网页登录账号、AI 走服务器，不问密钥（`account.js` 的 `EchoCloud.on`）。打进 `BuildConfig.CLOUD_URL`，原生在页面一开始设 `window.ECHO_CLOUD_URL`（末尾的 `/` 和 `/v1` 去掉） |
| `ECHO_PACKS_URL` | 课程包放在网上的地址。给了 = **课程包模式**：配音不进安装包（`copyWeb` 不复制 `assets/voice/f/**`、`assets/voice/m/**`、`assets/voice/index.json`，和 `ios/scripts/copy-web.mjs` 的 `PACKS_EXCLUDE` 一字不差），选了语言再下载（`packs.js` 的 `EchoPacks.on`）。打进 `BuildConfig.PACKS_URL`，原生设 `window.ECHO_PACKS_URL` |

不给就和以前一样：`BuildConfig` 里是空字符串、页面里没有这两个变量、复制的文件一个不少。没有新的原生桥方法。打包时会打出一行说这是不是云端 / 课程包的包。

```bash
# 公开测试版（正式签名，发给人装）；iPhone 测试版用的就是这两个地址，课本默认 hj7a,hj7b
gradle assembleRelease -PECHO_EDITION=sales -PECHO_CLOUD_URL=https://echo-api.restaurantweb.com.au -PECHO_PACKS_URL=https://echo-packs.restaurantweb.com.au
# 模拟器上看（调试包，WebView 能用开发者工具连）：同样的参数，任务换成 assembleDebug
```

网页的 `fetch` / `WebSocket` 直接从 WebView 连这两个站：外壳没有网络安全配置、`shouldInterceptRequest` 只接管 `appassets.androidplatform.net`、`index.html` 没有 CSP，所以不用改外壳；服务器那边要放行来源 `https://appassets.androidplatform.net`（课程包站是 `Access-Control-Allow-Origin: *`）。

打完销售版以后照常 `gradle assembleRelease`（不带参数）就是家庭版。打正式包（release）前 `checkReleaseConfig` 会检查，不对就**报错停下**：

- **正式签名**：`STORE_FILE` / `STORE_PASSWORD` 没填或签名文件找不到 → 停下。以前会悄悄改用调试签名，那样的包装不上去（签名不同），只能卸载重装，存档就丢了。签名文件和 `echo.properties` 要另外备份两处（网盘 + U 盘）。
- **家长密码**：没有 `PARENT_PIN`（4 位数字）→ 停下。
- 密钥不拦：`KEY_FILE` 有没有都能打（见下）。

### 密钥

家长 2026-10-07 定的：百炼密钥**照旧打进 APK**。`echo.properties` 的 `KEY_FILE` 指向一个写着 `DASHSCOPE_API_KEY=...` 的文件
（本机是 `D:/Claude/tools/echo-relay/game-key.env`，游戏专用的那把，中转服务也用它），打包时读出来写进 `BuildConfig.DASHSCOPE_KEY`。
手机上「设置 → AI」粘贴的密钥**优先**（存在这台手机的 SharedPreferences 里，`setKey()`，装新版不用重填）。
两个都没有时原生桥不去连，直接按「密钥失效」回（WebSocket 回 `HTTP 401 no key`，HTTPS 回 `{"code":"InvalidApiKey",…}`），网页据此提示「请家长在设置里粘贴 AI 密钥」。
APK 被转发出去密钥就跟着出去了：APK 只发给自家人；发现泄露就在百炼控制台作废、换新的、重新打包。

### 家长密码

打包时从 `echo.properties` 的 `PARENT_PIN` 读，**只把「盐 + 密码」的 SHA-256 写进 APK**（`BuildConfig.PARENT_PIN_HASH`，盐是 `BuildConfig.PARENT_PIN_SALT`），原文不进 APK，构建也不打印它。
手机上 `PinGuard.java` 用同一个盐算哈希比对；连续输错 5 次锁 10 分钟，次数和锁定时间存在原生，同一次开机里改手机时钟解不开。
APK 里没有家长密码时 `hasPin()` 是 false、`checkPin()` 一律 false——不再「谁先点谁来设」。改密码 = 改 `echo.properties` 重新打包。
销售版不一样：打包时没有密码，第一次打开时家长在向导里设（`setPin`），之后在「设置 → 🔒 家长设置」里输对旧密码就能改；忘了密码只能清除 App 数据（存档会丢，先「导出存档」）。
（4 位数字的哈希挡得住孩子，挡不住会反编译的人；它防的是「随手点开」，不是黑客。）

### 版本号

`versionCode` = git 提交数（只增不减，覆盖安装才装得上），`versionName` = 打包日期-短哈希，例如 `20261007-1a2b3c4`；有没提交的改动时末尾加 `+`。
只读 git（`--no-optional-locks`，不碰 `.git/index.lock`）。没有 git（从源码压缩包打包）时用 `echo.properties` 的 `VERSION_CODE`（默认 1，要比手机上那版大才装得上），名字里写 `nogit`。
网页用 `EchoNative.version()` 拿到，显示在设置页底部和周报角落。注意：换到提交更少的分支打包，`versionCode` 会变小、装不上，要卸载重装。

## 原生桥 `window.EchoNative`

只在 APK 里有（网页版、自动化测试里没有，测试用 `tests/fake-native.js` 模拟）。所有方法都是同步调用（在 WebView 的桥线程上跑），返回值是 boolean / 字符串；
返回 JSON 的方法要 `JSON.parse`。页面一开始原生会设 `window.ECHO_APP = 1`、`window.ECHO_TALK_URL`（打包时给了 `ECHO_CLOUD_URL` / `ECHO_PACKS_URL` 的还有 `window.ECHO_CLOUD_URL` / `window.ECHO_PACKS_URL`）。

**AI 连接（直连阿里云，带密钥）**

| 方法 | 说明 |
| --- | --- |
| `hasKey()` → boolean | 手机上存了百炼密钥（或打包时带了） |
| `setKey(k)` | 存密钥（空字符串 = 清掉）。网页要先过家长密码 |
| `wsOpen(id, url)` | 带密钥连 `wss://dashscope.aliyuncs.com/…`。结果回调 `window.__echoNative(id, 'open' / 'message' / 'closed' / 'error', 数据)`；失败的数据形如 `HTTP 401 …`、`HTTP 429 …`，没密钥时是 `HTTP 401 no key` |
| `wsSend(id, text)` / `wsClose(id)` | 发一条文字消息 / 关掉 |
| `post(id, url, body)` | 带密钥 POST `https://dashscope.aliyuncs.com/…`（JSON）。回调 `__echoNative(id, 'ok' / 'fail', 响应正文)`；失败时正文是阿里云的错误 JSON（`InvalidApiKey`、`Arrearage` 额度用完、`Throttling`…），没正文时是 `HTTP 状态码`，没密钥时是 `{"code":"InvalidApiKey","message":"no key","status":401}` |

**设置、版本、诊断**

| 方法 | 说明 |
| --- | --- |
| `setOrientation(m)` | 屏幕方向 `portrait` / `landscape` / `auto`，原生记住下次直接用 |
| `version()` → JSON | `{"code":321,"name":"20261007-1a2b3c4"}`（versionCode / versionName） |
| `diag()` → JSON | `{"renderGone":0,"lastGone":0,"lastCrash":false,"sdk":35,"android":"15","webview":"131.0…","debug":false,"micLastDeny":{…}}`：渲染进程挂过几次、最近一次的时间（毫秒）和是不是崩溃（false = 被系统收回内存），系统和 WebView 版本，最近一次麦克风被拒的情况（`ms` 多久回来、`before`/`after` 系统还肯不肯再问、`blocked` 判成了永久拒绝）。周报诊断行用 |
| `takeRecovered()` → boolean | 渲染进程挂了、原生刚重建过 WebView 时，**第一次**调用返回 true（之后 false）。网页启动时问一下，可以提示孩子「刚才画面出了点问题，已经重新打开了，存档还在」 |
| `edition()` → 字符串 | `family` 家庭版 / `sales` 销售版（打包时的 `-PECHO_EDITION`）。`dex.js` 第一个看它 |
| `books()` → 字符串 | 销售版开放哪几册课本（逗号分开的册 id，打包时 `-PECHO_BOOKS=hj7a,hj7b`，不写就是七上、七下）；家庭版是空的 = 全部开放。`game.js` 的课本单元页只开放这几册，别的册显示 🔒「下一学年的内容包」 |
| `verUrl()` → 字符串 | 检查新版本的默认地址（`version.json`）：家庭版是 `echo.properties` 的 `VER_URL`（没写就用原来的 GitHub Pages 地址），**销售版是空的**（不连境外网站，新版本私下发）。网页里不再写死这个地址；家长设置里填的地址优先 |
| `storage()` → JSON | `{"free":12345678901,"total":128000000000,"ram":12000000000}`：App 所在分区剩余 / 总共多少字节、手机内存多少字节。首次设置的设备检查用（剩余空间要 ≥1GB） |

**家长密码**

| 方法 | 说明 |
| --- | --- |
| `hasPin()` → boolean | 打包时设了家长密码。false 时家长功能一律拒绝，提示「请家长先设密码」 |
| `checkPin(pin)` → boolean | 对不对。锁着的时候、没设密码、空字符串一律 false（空的不算一次）；对了清零错的次数 |
| `pinStatus()` → JSON | `{"has":true,"locked":false,"waitSec":0,"triesLeft":5,"lockouts":0,"lastLock":0,"canSet":false}`：是不是锁着、还要等几秒、还能试几次、一共被锁过几次、最近一次被锁的时间（毫秒）、现在能不能 `setPin`。`checkPin` 返回 false 后看它，分清「密码不对」和「锁着」；`lockouts` 进周报 |
| `setPin(pin)` → boolean | **只有销售版**：设 / 改家长密码（必须 4 位数字）。还没有密码时直接设（首次设置向导）；已经有了，要**同一次开机里 2 分钟内刚 `checkPin` 对过**才能改（网页先过家长密码再调）。每次换一个新的随机盐，只存「盐 + 密码」的 SHA-256。家庭版（打包时带了密码）一律 false |

**麦克风**

| 方法 | 说明 |
| --- | --- |
| `micPermission()` → 字符串 | `granted` 允许了；`denied` 还没允许（再开口会弹系统框）；`blocked` 永久拒绝了（系统不再弹框，只能去设置里打开）。原生在每次被拒后判断：系统还肯再问（`shouldShowRequestPermissionRationale`）= denied；之前肯问、这次不肯了，或者不到 0.9 秒就被拒（系统根本没弹框）= blocked，之后在允许之前一直是 blocked。**网页在 `getUserMedia` 报 `NotAllowedError` 之后再问它**（还没开过口时是 denied） |
| `openAppSettings()` → boolean | 打开系统里回声岛的「应用信息」页（里面有「权限 → 麦克风」）。打开后回到游戏，原生会发 `echo-mic` 事件；同一个页面里直接再 `getUserMedia` 就能用（模拟器实测，不用重新载入）。WebView 不记上一次的拒绝，denied 时再开口会重新弹系统框 |

**存档备份和导出**

| 方法 | 说明 |
| --- | --- |
| `backupWrite(json)` → boolean | 把存档写进手机的 `下载/EchoIsland/echo-save-YYYYMMDD.json`（同一天覆盖同一份），只留最新的 7 份。**卸载 App 也不会删**。安卓 10 起用 MediaStore，不要权限；安卓 9 及以下第一次会弹「存储」权限框（这次返回 false，允许后自动补写）。不是 `{` 开头的不写。建议每天第一次保存时调用 |
| `backupList()` → JSON | 这个 App 写的备份，新的在前：`[{"name":"echo-save-20261007.json","date":"2026-10-07","size":12345,"time":1791234567890}, …]`（time 是修改时间，毫秒）。卸载重装后，以前装的那个写的备份**列不出来**（安卓的规矩），要用 `backupPick()` |
| `backupRead(name)` → 字符串 | 读一份备份的内容（名字必须是 `backupList` 里的，形如 `echo-save-YYYYMMDD.json` 或 `echo-save-YYYYMMDD (1).json`），没有就返回空字符串 |
| `backupPick()` → boolean | 打开系统的文件选择器（先进 `下载/EchoIsland`），家长点一个文件后发事件 `echo-backup-picked`。卸载重装、换手机（把文件拷过来）后恢复存档用这个 |
| `shareText(title, text)` → boolean | 打开安卓的分享面板（可以选微信）。文字超过 8000 字时自动改成发文件：`{`/`[` 开头的叫 `echo-save-YYYYMMDD.json`，别的叫 `echo-island-YYYYMMDD.txt` |
| `shareFile(title, name, text)` → boolean | 把 text 写成文件 `name`（只许字母数字 `._-`、以 `.json` / `.txt` 结尾）再分享。「导出存档」用它：`shareFile('回声岛存档', 'echo-save-20261007.json', 存档)`，微信里收到的是一个文件，以后用 `backupPick()` 选它就能恢复 |

**原生发给网页的事件**（`window.addEventListener(名字, e => …)`）

| 事件 | `e.detail` |
| --- | --- |
| `echo-mic` | 麦克风状态变了（比如从设置里打开回来）：`'granted'` / `'denied'` / `'blocked'` |
| `echo-backup-picked` | `backupPick()` 的结果：`{ok:true, name:'echo-save-20261007.json', text:'{…}'}`，或 `{ok:false, name, error:'cancel' / 'read' / 'too big' / 'no picker'}`（最大 32MB） |

加新方法时：MainActivity 的 `Native` 里写、这张表里写、`tests/fake-native.js` 里写同名同参数个数的假方法——`node tests/native.test.js` 会核对三处对得上，
还会用 JDK 编译 `PinGuard.java` / `BackupNames.java` 实测密码锁定和备份轮换。

### iPhone 才有的方法（安卓：以后）

公开版的订阅和「通过 Apple 登录」只在 iPhone 版里有（`ios/README.md`「订阅和登录」）：`iapProducts`、`iapBuy`、`iapRestore`、`iapCurrent`、`iapPending`、`iapFinish`、`iapManage`、`appleSignIn`、`appleCredentialState`，都是异步的（第一个参数是编号，结果回 `window.__echoNative(id, 'ok' / 'fail', JSON)`），另有事件 `echo-iap`。
**安卓对应的：以后**（Google Play 结算 + 安卓的登录）。到时候在 MainActivity 里加，把它们从 `tests/ios.test.js` 的 `IOS_ONLY` 表里拿掉、写进上面的表；在那之前网页先看 `EchoNative.iapProducts` 有没有再用。
口语题的本机识别（2026-11-20，`ios/README.md`「口语题的本机识别」）也只在 iPhone 版里有：`speechState`、`speechStart`、`speechFeed`（网页录到的声音一段段送过去，麦克风归网页）、`speechStop`，同样是异步的，过程走事件 `echo-speech`。安卓这边口语题照旧走阿里云识别（`talk.js` 只在 `window.ECHO_IOS` 并且有 `EchoNative.speechStart` 时才用本机识别），**安卓不做**。

## 在模拟器上看原生桥

模拟器 `echo35`（`D:\Claude\tools\android\start-echo-emulator.bat`）是 userdebug 系统，正式包的 WebView 也能用开发者工具连：

```bash
ADB=D:/Claude/tools/android/sdk/platform-tools/adb.exe
$ADB install -r app/build/outputs/apk/release/app-release.apk     # 同一个签名覆盖安装，存档还在
$ADB shell cat /proc/net/unix | grep webview_devtools_remote       # 找到 webview_devtools_remote_<pid>
$ADB forward tcp:9222 localabstract:webview_devtools_remote_<pid>
# 然后用 Chrome 打开 chrome://inspect，或者用 CDP 的 Runtime.evaluate 执行 EchoNative.version() 等
```

CDP 的 `Page.crash` 可以模拟渲染进程崩溃，看 WebView 是不是重建、`takeRecovered()` 是不是 true、存档还在不在。

## 装到手机（REDMI Turbo 5 / HyperOS）

把 APK 发到手机（微信文件传输、QQ、数据线都行）→ 点开 → 允许「安装未知应用」→ 安装。
HyperOS 可能提示「未经安全检测」，选继续安装即可。用同一个签名的新版本会直接覆盖安装，存档、密钥都还在。
