# 回声岛 安卓版（APK）

一个全屏 WebView 壳：游戏网页（`index.html`、各个 `.js`、`assets/` 里的怪兽模型和配音）在打包时整个复制进 APK，
用 `https://appassets.androidplatform.net/assets/www/index.html` 这个虚拟安全地址打开，所以：

- **离线能玩**：冒险、闯关、课本同步、每日复习都不用联网（有道在线发音只在没有配音的句子上兜底）。
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

`echo.properties` 和签名文件（`*.jks`）不进仓库。打正式包（release）前 `checkReleaseConfig` 会检查，不对就**报错停下**：

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
（4 位数字的哈希挡得住孩子，挡不住会反编译的人；它防的是「随手点开」，不是黑客。）

### 版本号

`versionCode` = git 提交数（只增不减，覆盖安装才装得上），`versionName` = 打包日期-短哈希，例如 `20261007-1a2b3c4`；有没提交的改动时末尾加 `+`。
只读 git（`--no-optional-locks`，不碰 `.git/index.lock`）。没有 git（从源码压缩包打包）时用 `echo.properties` 的 `VERSION_CODE`（默认 1，要比手机上那版大才装得上），名字里写 `nogit`。
网页用 `EchoNative.version()` 拿到，显示在设置页底部和周报角落。注意：换到提交更少的分支打包，`versionCode` 会变小、装不上，要卸载重装。

## 原生桥 `window.EchoNative`

只在 APK 里有（网页版、自动化测试里没有，测试用 `tests/fake-native.js` 模拟）。所有方法都是同步调用（在 WebView 的桥线程上跑），返回值是 boolean / 字符串；
返回 JSON 的方法要 `JSON.parse`。页面一开始原生会设 `window.ECHO_APP = 1`、`window.ECHO_TALK_URL`。

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

**家长密码**

| 方法 | 说明 |
| --- | --- |
| `hasPin()` → boolean | 打包时设了家长密码。false 时家长功能一律拒绝，提示「请家长先设密码」 |
| `checkPin(pin)` → boolean | 对不对。锁着的时候、没设密码、空字符串一律 false（空的不算一次）；对了清零错的次数 |
| `pinStatus()` → JSON | `{"has":true,"locked":false,"waitSec":0,"triesLeft":5,"lockouts":0,"lastLock":0}`：是不是锁着、还要等几秒、还能试几次、一共被锁过几次、最近一次被锁的时间（毫秒）。`checkPin` 返回 false 后看它，分清「密码不对」和「锁着」；`lockouts` 进周报 |

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
