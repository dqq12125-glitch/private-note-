# 回声岛 iPhone 版

一个全屏的 WKWebView 壳（Swift，不用任何第三方库），和 `android/` 的 WebView 壳是一对：

- 游戏网页（`index.html`、各个 `.js`、`assets/` 里的模型和配音）打包时整个复制进 App 的 `www/`，用 App 自己的地址 `echoisland://localhost/index.html` 打开（`WebAssetHandler.swift`）。**离线能玩**；这个地址算「安全的网页」，麦克风（`getUserMedia`）、`fetch` 都能用；配音的 `<audio>` 要一段一段读（`Range`），这里按 206 回。
- 原生桥 `window.EchoNative`：方法名、参数、返回值和安卓**一模一样**（`android/README.md` 的表），游戏的 `game.js` / `talk.js` / `setup.js` 不用为 iPhone 改。安卓上网页是同步调用原生的，iPhone 上做不到，所以 `App/Resources/echo-native.js`（页面一开始就注入）把它分成两条路：
  - 同步的 22 个：网页 `prompt('__echo_native__:{…}')` → 原生在 prompt 的回调里办完、把结果当返回值交回来（`Bridge.callSync`）；
  - 异步的 4 个（`wsOpen` / `wsSend` / `wsClose` / `post`，连阿里云的）：`webkit.messageHandlers.echo.postMessage` → 原生连好以后调 `window.__echoNative(id, 类型, 数据)`，和安卓一样（`Bridge.callAsync` → `DashScope.swift`）。
- 原生桥带着百炼密钥直连 `dashscope.aliyuncs.com`（`URLSessionWebSocketTask` + `Authorization` 头），**只许连这一个域名**，网页拿不到密钥本身。
- 家长密码 `PinGuard.swift`、备份文件名 `BackupNames.swift` 是照着安卓的 Java 一条一条写的（同一个盐、同样的 SHA-256、错 5 次锁 10 分钟、改手机时钟解不开）。
- 网页进程没了（内存不够被系统收掉）：重建网页、重新打开首页，存档还在，网页能用 `takeRecovered()` 知道刚恢复过；前台 2 分钟里连挂 3 次显示一句话，等孩子点一下。
- 公开版的**订阅**（App 内购买，StoreKit 2）和**通过 Apple 登录**：iPhone 才有的 9 个异步方法（`Store.swift`、`AppleSignIn.swift`），见「订阅和登录」。安卓以后接 Google Play 结算。
- **口语题的本机识别**（2026-11-20）：iPhone 才有的 3 个异步方法 + 事件 `echo-speech`（`LocalSpeech.swift`，手机自带的语音识别，只在手机上识别），见「口语题的本机识别」。

方法全表、哪些和安卓不完全一样，见下面「原生桥：和安卓不一样的地方」。

## 文件

| 文件 | 内容 |
| --- | --- |
| `project.yml` | XcodeGen 的工程定义（不手写 `.xcodeproj`）：App、单元测试、UI 测试三个 target；最低 iOS 18.4；Swift 语言版本钉在 5 |
| `Config/Base.xcconfig` | 进仓库的默认打包设置：App 标识 `ECHO_BUNDLE_ID` = **`com.echoisland.app`**（和安卓的包名一样，只写在这一处，`make-config.mjs` 也从这里读）、版本号、开发者团队。`Generated/Echo.xcconfig` 盖掉同名的 |
| `App/Info.plist` | App 名「回声岛」、麦克风说明和语音识别说明（中文）、竖屏 + 横屏、不显示状态栏、`ITSAppUsesNonExemptEncryption = false`、备份在「文件」App 里看得到 |
| `App/Resources/` | `echo-native.js`（EchoNative 那一层 + iPhone 才要管的声音、触摸、横屏标记）、`PrivacyInfo.xcprivacy`（隐私清单）、图标 |
| `App/Sources/` | `AppDelegate`（场景、屏幕常亮、一开 App 就听订阅的交易）、`GameViewController`（网页、prompt/alert、麦克风放行、方向、后台前存档、进程挂了重建）、`WebAssetHandler`、`Bridge`、`DashScope`、`PinGuard`、`BackupNames`、`Stores`（钥匙串里的密钥、「文稿」里的备份）、`AppAudio`（声音会话）、`Store`（订阅，StoreKit 2）、`AppleSignIn`（通过 Apple 登录）、`LocalSpeech`（口语题的本机识别） |
| `App/EchoIsland.entitlements` | 「通过 Apple 登录」的权限。**只有签名的包带**（`make-config.mjs` 的 `ECHO_APPLE_SIGNIN`），见「通过 Apple 登录的权限」 |
| `App/Store.storekit` | 本地的 App Store（测试用）：一个订阅组、月度 US$8.99、年度 US$59.99（年度 7 天免费试用是**例子**，真的在 App Store Connect 里定） |
| `Tests/LogicTests.swift` | 单元测试（模拟器里跑）：家长密码、备份轮换、Range、类型、只连阿里云、原生桥的入口 |
| `Tests/AccountLogicTests.swift` | 单元测试：订阅和登录里不碰 App Store 的那一层（参数不对当场回、买的四种结果、取消、没带权限的包说 unavailable） |
| `Tests/StoreKitTests.swift` | 订阅的真流程（用 `Store.storekit`）：商品、买（带账号 UUID）、请求购买、恢复、续费、过期、退款 → 事件。云上单独一步、挑 iOS 26.2 的模拟器 |
| `UITests/SmokeUITests.swift` | UI 测试：打开到首页（竖屏、横屏截图）、原生桥自测页一个都不能没过、麦克风弹窗、分享面板和文件选择器、订阅的商品问得到、大地图转屏、课程包装一遍 + 重开还在 |
| `www-test/selftest.html` | 原生桥自测页（**只打进调试包**）：把 26 个方法和 iPhone 才有的 13 个都调一遍，再看几样 WebKit 的本事 |
| `scripts/prepare.mjs` | 打包前一条命令做完：`make-config.mjs` → `copy-web.mjs` → 没有图标时 `make-icons.mjs` |
| `scripts/make-config.mjs` | 生成 `Generated/BuildConfig.swift`、`Generated/Echo.xcconfig`（版本、构建号、订阅的两个商品编号、带不带「通过 Apple 登录」、服务器地址 `ECHO_CLOUD_URL`、课程包地址 `ECHO_PACKS_URL`；家庭版另有密钥和家长密码的**哈希**） |
| `scripts/copy-web.mjs` | 把游戏网页复制进 `www/`：和安卓 `copyWeb` 同一份白名单，销售版不带保留怪兽；给了 `ECHO_PACKS_URL` 时不带英语配音（见「课程包」） |
| `www-test/packs/` | 课程包的小样（`tools/pack/build.js --only 12` 打的，几十 KB），自测页 `run=packs` / `packs2` 从这里装 |
| `scripts/make-icons.mjs` | 从 `android/icon-512.png` 生成 1024 的图标（垫底色、去透明） |
| `scripts/pick-simulator.mjs` | 云上挑一台 iPhone 模拟器（可以指定 iOS 版本，StoreKit 测试要 26.2） |
| `../.github/workflows/ios-simulator.yml` | 云上的 Mac 编译、跑测试 |
| `../.github/workflows/ios-testflight.yml` | 打正式包、签名、传到 TestFlight（**只能手动点**），见「上 TestFlight」 |
| `../tests/ios.test.js` | 不用 Mac 的核对（`node tests/ios.test.js`，几秒） |
| `../tools/ios/` | 用 Playwright 的 WebKit 检查网页在 iPhone 内核上的问题（见「WebKit 检查」） |

不进仓库（`.gitignore`）：`Generated/`、`www/`、`.sales-web/`、`*.xcodeproj`、`echo.properties`、证书和描述文件。

## 两个版本

| | 销售版 `sales`（**默认**，公开发的） | 家庭版 `family` |
| --- | --- | --- |
| 怎么打 | `node ios/scripts/prepare.mjs`（不写就是它） | `node ios/scripts/prepare.mjs --edition family --release` |
| App 标识 | `ECHO_BUNDLE_ID` | `ECHO_BUNDLE_ID` + `.family`（两个能装在同一台手机上） |
| 百炼密钥 | **没有**。家长在首次设置向导里粘贴，存在这台手机的钥匙串里（不进 iCloud） | 打包时 `KEY_FILE` 的进 App（手机上粘贴的优先） |
| 家长密码 | **没有**。家长在向导里设（每台手机自己的随机盐 + SHA-256，原文不存） | 打包时 `PARENT_PIN` 的「盐 + 密码」SHA-256 进 App，手机上不能改 |
| 中转服务、检查新版本的地址 | 没有（新版本走 TestFlight / App Store） | `TALK_URL` / `TALK_CODE` / `VER_URL` |
| 保留怪兽 | 连美术带记录都不打包 | 打包（番外） |
| 存档备份跟不跟 iCloud 备份走 | 不跟（和安卓销售版 `allowBackup=false` 一个意思） | 跟 |

销售版里给了密钥、家长密码或者地址（环境变量 `ECHO_DASHSCOPE_KEY` 等）`make-config.mjs` 直接停下；`echo.properties` 销售版根本不打开，所以同一份文件两个版本都能用（和安卓一样）。

## 课程包（2026-11-20，`tools/pack/SPEC.md`）

- 打包时给 `ECHO_PACKS_URL=https://…`（课程包放在网上的地址，不是秘密）：`make-config.mjs` → `BuildConfig.packsUrl` → 启动对象 `window.__ECHO_BOOT.packsUrl`（和 `cloudUrl` 同一条路）→ 网页的 `packs.js`；`copy-web.mjs` 不复制 `assets/voice/f/**`、`assets/voice/m/**`、`assets/voice/index.json`（包小约 100 MB），配音在 App 里选了语言再下载、存在 IndexedDB。不给 = 和以前一样配音打进包里。
- 云上：两个工作流都从**仓库变量** `vars.ECHO_PACKS_URL` 取（GitHub → Settings → Secrets and variables → Actions → Variables）；空 = 老模式。TestFlight 工作流只给销售版。
- 自测页 `run=packs`（UI 测试第 8 个）：`echoisland://` 能用 IndexedDB 存 ArrayBuffer；从 `www-test/packs/` 的小样装一遍；装好的那段 `blob:` 地址在 WKWebView 里 `play()` 不报错、`ended` 来了。然后关掉 App 再开 `run=packs2`：还在、照样放得出声，最后删掉小样。小样重新打：`node tools/pack/build.js --lang en --ver 20261120.1 --only 12 --bundle 20000 --core 30000 --out ios/www-test/packs` 再 `--catalog --out ios/www-test/packs`。

## 云上怎么编（GitHub Actions，不用自己有 Mac）

`.github/workflows/ios-simulator.yml`：推到 `echo-island/next` 并且改了 `ios/`、这个工作流或 `tools/ios/` 时自动跑；也可以在 Actions 页面手动点 **Run workflow**。仓库是公开的，macOS 的机器不要钱。

- 机器：`macos-26`（Apple 芯片），Xcode **26.6**（`/Applications/Xcode_26.6.app`），模拟器 **iPhone 17 / iOS 26.5**。
- 步骤（每一步单独一行，红在哪一步一眼看得出来）：浅克隆 → `node tests/ios.test.js` → 装 XcodeGen → `prepare.mjs`（销售版）→ `xcodegen` → 编译调试包（模拟器，不用开发者证书）→ 单元测试（不含 StoreKit 的）→ **StoreKit 测试**（同一份包，换一台 iOS 26.2 的模拟器）→ UI 测试 → 再编一遍正式包的设置（不签名，核对没有自测页）→ 导出截图 → **不管成没成**上传 `ios-simulator-results`：完整的编译日志、三个 `.xcresult`、截图和自测结果 → `Result`。
- 调试包编过了，单元测试、StoreKit 测试、UI 测试三步都跑（`if: !cancelled()` + 编译成功），工程生成了就编正式包：一步红了不挡后面的，日志里每一步的结果都看得到。最后一步 `Result` 把五步的结果列成表（也在 Actions 的 Summary 里），有一步不是 success 就让整个任务红。
- `.xcresult` 里带着模拟器的系统日志（`system.logarchive`，tracev3 格式）。没有 Mac 时也能看：解开 xcresult 里的 zstd、再解 tracev3 的 LZ4 块，StoreKit（`storekitd` 和 App 里的 `com.apple.storekit`）每一步都在里面，2026-11-20 查「请求购买」事件丢了就是这样查出来的。
- 为什么 StoreKit 测试要另一台模拟器：iOS 26.5 的模拟器上 `SKTestSession` 存不进本地 App Store 的配置（苹果开发者论坛上的已知问题 FB22237318，26.1 / 26.2 上好的；Xcode 26.6 的说明里说修了，实际还有人遇到）。`pick-simulator.mjs` 先挑 26.2、再 26.1；机器上都没有就用最新的，并出一条黄色提示——那时 StoreKit 测试红了先看是不是这个原因。
- 只编模拟器的包：**装不到真 iPhone 上**（要签名，见下）。
- 构建号：浅克隆数不出提交数，自动退回 1（模拟器包用不到）。打给人装的包要么把历史取全（`fetch-depth: 0`），要么设 `ECHO_VERSION_CODE`。

看结果（命令行）：

```bash
gh run list --workflow ios-simulator.yml --branch echo-island/next
gh run view <编号> --log-failed            # 只看红了的那一步
gh run download <编号> -n ios-simulator-results -D ios-ci
```

`ios-ci/attachments/ui-tests/` 里有截图（`portrait-home`、`landscape-home`、`selftest`、麦克风弹窗……）和 `selftest-result.json`（每个方法的结果；`warn` 是和模拟器 / 系统版本有关的，只记下来）。

## 在 Mac 上自己编

要 Xcode 26（App Store 现在只收 Xcode 26 / iOS 26 SDK 打的包）、Node 18 以上、`brew install xcodegen`。

```bash
node ios/scripts/prepare.mjs                    # 销售版；家庭版加 --edition family（打正式包再加 --release）
cd ios && xcodegen generate && open EchoIsland.xcodeproj
```

- 模拟器：选一个 iPhone 模拟器，⌘R。命令行跑测试：`xcodebuild test -project ios/EchoIsland.xcodeproj -scheme EchoIsland -destination 'platform=iOS Simulator,name=iPhone 17'`。
- 真机 / TestFlight：先在 `Config/Base.xcconfig` 把 `ECHO_BUNDLE_ID` 换成自己登记的（或者设环境变量 `ECHO_BUNDLE_ID`），设 `ECHO_TEAM_ID`（10 位团队编号）再跑一次 `prepare.mjs`；Xcode 的 Signing & Capabilities 选自己的团队（自动管理签名）。上 TestFlight：Product → Archive → Distribute App → App Store Connect。
- 调试包里网页能用 Mac 的 Safari 连（开发 → 模拟器 / 手机 → 回声岛）；正式包不行。
- 调试包的启动参数（UI 测试用）：`-EchoUITest`（屏幕最下面一行很小的状态字）、`-EchoSelfTest all|mic|share|pick|store`（打开原生桥自测页）、`-EchoOrient landscape`（这次横屏打开）。正式包里都没有。

## 家庭版：密钥和家长密码怎么进去

和安卓同一套规矩，同一份配置文件：`ios/echo.properties`，没有就读 `android/echo.properties`（`KEY_FILE`、`PARENT_PIN`、`TALK_URL`、`TALK_CODE`、`VER_URL`）。

- 密钥：`KEY_FILE` 指的文件里 `DASHSCOPE_API_KEY=…` 那一行，写进 `Generated/BuildConfig.swift`（不进仓库）。手机上「设置 → AI」粘贴的存在钥匙串里、优先用。
- 家长密码：**只把「盐 + 密码」的 SHA-256 写进 App**，原文不进 App；`--release` 时没有 `PARENT_PIN` 就停下。
- 云上打家庭版（以后要的话）：在仓库的 Secrets 里放 `ECHO_DASHSCOPE_KEY`、`ECHO_PARENT_PIN`，工作流里用 `env` 传给 `prepare.mjs`。现在的工作流只打销售版、不用任何密钥。
- `make-config.mjs` 只说「有 / 没有」，不打印值；**不要 `cat` 生成的 `BuildConfig.swift`**，要核对就数个数（例如 `grep -c 'static let' ios/Generated/BuildConfig.swift`）。
- 家庭版的 App 被转发出去，密钥就跟着出去了：只装给自家人；发现泄露就在百炼控制台作废、换新的、重新打包。

## 最低 iOS：18.4

打包的配音是 **Ogg 里的 Opus**（18,636 段，`game.js` 的 `OGG_OK` 看 `canPlayType('audio/ogg; codecs="opus"')`）。WebKit 的说明：**Safari 18.4（iOS 18.4）起才支持 Ogg 容器里的 Opus 和 Vorbis**；以前 iOS 只认 CAF / WebM 里的 Opus。低于 18.4 时游戏会把每一句都交给阿里云现场合成——要联网、要花钱、慢。
能装 iOS 17 的 iPhone（XS / XR 起）都能升到 iOS 18.x，所以 18.4 没把任何「能装 iOS 17」的机型挡在外面，挡住的只有 iPhone 8 / X（最高 iOS 16）和不升级系统的。顺带：WebGL2（iOS 15）、自己地址算安全来源（iOS 15）、`navigator.audioSession`（16.4，17 起可靠）、`:has()` / `dvh`（15.4）、`color-mix()`（16.2）、`text-wrap: balance`（17.5）、不带前缀的 `backdrop-filter`（18）都有。
已知问题（WebKit bug 293310，到 iOS 26 还在）：Ogg Opus 的时长 / 进度差 5% 左右，播放本身没问题。

## 原生桥：和安卓不一样的地方

26 个方法都有，名字、参数个数、返回值的类型、同步 / 异步（异步 = 连阿里云的四个）都和安卓一样（`tests/ios.test.js` 核对三处：README、`echo-native.js`、`Bridge.swift`）。另有 iPhone 才有的 13 个（「订阅和登录」的 9 个、「口语题的本机识别」的 4 个，`tests/ios.test.js` 的 `IOS_ONLY` 表）。不一样的：

| 方法 | iPhone 上 |
| --- | --- |
| 同步的 22 个 | 走 `prompt()`：网页在等原生回答时停一下（几毫秒）。网页自己换掉 `window.prompt` 不影响（先留了一份） |
| `diag()` | 没有 `sdk` / `android`；有 `platform: "ios"`、`ios`（系统版本）、`model`；`webview` 是 `WebKit`；`lastCrash` 一直是 false（iPhone 分不出崩了还是被收内存）；`micLastDeny` 是空的 |
| `micPermission()` | `denied` = 还没问过（再开口会弹系统框）；被拒绝过一次就是 `blocked`（iPhone 不会再弹框，只能去「设置」里打开） |
| `openAppSettings()` | 打开「设置 → 回声岛」（里面有「麦克风」开关） |
| `backupWrite()` / `backupList()` / `backupRead()` | 写在 App 的「文稿」里：「文件」App →「我的 iPhone」→「回声岛」看得到、拷得走。**删掉 App 这个文件夹跟着没了**（安卓的「下载/EchoIsland」卸载也不删），所以「导出存档」更要紧 |
| `backupPick()` | 系统的文件选择器（先打开 App 自己的文件夹），选到的文件当场复制一份再读 |
| `shareText()` / `shareFile()` | 系统的分享面板（`title` 没用上：iPhone 的分享面板没有标题） |
| `setOrientation()` | 一样记住；`auto` = 跟着手机转（不倒过来） |
| `setPin()` | 一样只有销售版能用；随机盐和哈希存在 UserDefaults |
| `setKey()` / `hasKey()` | 密钥存在钥匙串（只在这台手机、不进 iCloud）。删掉 App 钥匙串可能还留着：重新装好第一次打开时先清掉 |
| `wsOpen()` 出错的说明 | 握手被拒写成 `HTTP 401 NSURLError -1011 …`、断网写成 `Unable to resolve host "dashscope.aliyuncs.com" (…)`，网页按 `HTTP 401` / `HTTP 429` / `Unable to resolve host` 分原因，和安卓的一样认得出来 |

**返回键**：iPhone 没有。游戏每个画面都有自己的关闭 / 返回按钮（网页版在 iPhone 上本来就这样玩），所以壳子不接「右划返回」（屏幕左边是摇杆的地方，会抢手指），也不调 `window.EchoBack`。安卓按返回键时会顺手整份存一次档；iPhone 上改成**离开前台时**（来电、下拉通知、切 App）原生调一次 `EchoGame.flush()`，并向系统多要几秒让 WebKit 落盘。

## 订阅和登录（iPhone 才有的方法）

公开版：免费每天 5 分钟 AI；Premium 月度 US$8.99、年度 US$59.99（自动续期订阅，苹果要求用 App 内购买）；登录用邮箱验证码或**通过 Apple 登录**。账号、用量、订阅状态都在服务器（`cloud/API.md`）；这里只是原生这一侧：网页调下面 9 个方法，拿到苹果签名的东西交给服务器。

都是**异步**的，和 `wsOpen` / `post` 一样：`webkit.messageHandlers.echo` 发过去，第一个参数是网页自己给的编号，结果回 `window.__echoNative(编号, 'ok' / 'fail', JSON 文字)`（`JSON.parse` 一下）；网页重建过就不回。`'fail'` 的 JSON 一律是 `{"error":"短代号","message":"英文说明"}`。安卓的 `EchoNative` 里没有它们（以后接 Google Play 结算）：网页先看 `typeof EchoNative.iapProducts === 'function'`。`diag()` 在 iPhone 上多两项：`appleSignIn`（这个包能不能通过 Apple 登录）、`iapProducts`（两个商品编号）。

| 方法 | 说明 |
| --- | --- |
| `iapProducts(id, ids)` | 商品。`ids` 可以是数组或逗号分开的文字，空的 = 月度、年度两个。`ok`：`{products:[{id, kind:'monthly'/'yearly', title, description, displayPrice:'$8.99', price:'8.99', currency:'USD', groupId, period:{unit:'month',value:1}, introOffer:{paymentMode:'freeTrial'/'payAsYouGo'/'payUpFront', period, periodCount, displayPrice} 或 null, introEligible, trial}], missing:[App Store 里没有的编号], canPay}`。`trial` = 有免费试用且这个 Apple 账户还能用。`fail`：`bad-product`、`network`、`store`… |
| `iapBuy(id, productId, appAccountToken)` | 买。`appAccountToken` 是服务器给这个账号的 UUID（`GET /v1/me` 的 `iapToken`），放进 `Product.PurchaseOption.appAccountToken`，苹果的服务器通知靠它找到账号；不是 UUID 就不买（`fail bad-token`）。在游戏画面上弹苹果的购买确认。`ok` 的 `status` 四种：`purchased`（核对过）/ `unverified`（手机这边核对没过，照样交给服务器，由服务器定）/ `pending`（「请求购买」等家长批准、或者付款要先处理，批准以后从 `echo-iap` 事件来）/ `cancelled`。`purchased` / `unverified` 带交易（见下）。`fail`：`busy`（上一个还没完）、`payments-disabled`（屏幕使用时间禁止了购买）、`not-found`、`network`、`purchase`… |
| `iapRestore(id)` | 恢复购买：`AppStore.sync()`（可能要输 Apple 账户密码）再列有效的订阅。`ok`：`{synced, syncError?, cancelled?, entitlements:[交易…]}`——同步失败也照样列 |
| `iapCurrent(id)` | 现在有效的订阅（`Transaction.currentEntitlements`，不弹界面）。`ok`：`{entitlements:[交易…]}` |
| `iapPending(id)` | 还没 `finish` 的交易（`Transaction.unfinished`）。`ok`：`{transactions:[交易 + kind…]}`。**网页每次打开（登录以后）问一次**：上次买完 App 被杀、或者网页还没打开时来的续费都在这里 |
| `iapFinish(id, transactionId)` | 服务器存好了这一笔（`POST /v1/iap/apple` 回了 200）才调：`finish()`。`ok`：`{finished:true}`；已经 finish 过、没有这一笔是 `{finished:false, reason:'not-unfinished'}`（不算错）。**原生自己从不 finish**：没 finish 的苹果下次打开 App 再给一次 |
| `iapManage(id)` | 系统的「管理订阅」面板（取消、换月度 / 年度）。关掉以后回 `ok {shown:true}`，网页再 `iapCurrent` |
| `appleSignIn(id, nonce)` | 通过 Apple 登录。`nonce` 是网页生成的随机串（16–256 个看得见的 ASCII 字），原生把它的 SHA-256（小写十六进制）放进请求，网页把**原文**和 `identityToken` 一起交给 `POST /v1/auth/apple`。`ok`：`{identityToken, authorizationCode, user, email?, fullName?:{givenName, familyName…}, realUserStatus}`（`email`、`fullName` 只有第一次授权才给）；自己点了取消：`ok {cancelled:true}`。`fail`：`bad-nonce`、`unavailable`（这个包没有登录权限，见下）、`busy`、`unknown`（1000 号，带 `hint`）、`failed`… |
| `appleCredentialState(id, user)` | 这个 Apple 用户编号还授权着没有：`ok {state:'authorized'/'revoked'/'notFound'/'transferred'}`。`revoked` = 用户在「设置」里停用了，网页应该退出登录。没有登录权限的包：`fail unavailable` |

**交易**（`iapBuy`、`iapCurrent`、`iapRestore`、`iapPending` 和事件里的每一项）：`{jws, verified, verifyError?, transactionId, originalId, productId, purchaseDate, expires, revoked, revocationReason?, upgraded, appAccountToken, environment, ownership}`。`jws` = `VerificationResult.jwsRepresentation`，原样作为 `signedTransaction` 交给服务器；编号是**字符串**（UInt64，JavaScript 的数字放不下全部）；时间是毫秒，没有就是 `null`；`environment` 是 `Production` / `Sandbox` / `Xcode`。

**事件** `echo-iap`（`window.addEventListener('echo-iap', e => …)`，和 `echo-mic` 一样的写法）：一开 App 原生就听 `Transaction.updates`，续费、退款 / 撤销、「请求购买」被批准、别的设备上买的、优惠码，来一笔发一次，`e.detail` = 交易 + `kind`：`purchase` / `renewal` / `revoked` / `expired` / `upgraded`（退款最先判）。网页收到就交给服务器，服务器回 200 再 `iapFinish`。网页还没打开时来的没 finish 的不会丢（`iapPending` 拿）；已经 finish 过、后来退了款的不在 `iapPending` 里，以服务器收到的 App Store 通知为准。
StoreKit 只把交易交给**当时正在听**的人，所以 `Store.start()` 用 `userInitiated` 优先级（以前用 `background`，云上测试里任务一直没排上，家长批准的那一笔就丢了），序列自己结束了会重新订阅。

网页那边的顺序（下一步做账号页和付费墙时照这个）：登录（邮箱验证码，或 `appleSignIn` → `POST /v1/auth/apple`）→ `GET /v1/me` 拿 `iapToken` → `iapPending`，有就逐笔交给服务器再 `iapFinish` → 付费墙 `iapProducts` → `iapBuy(…, iapToken)` → `purchased` / `unverified` 交给服务器 → `iapFinish`；「恢复购买」按钮 `iapRestore` → 每个 `jws` 交给服务器。苹果审核要求付费墙上写清价格、周期、自动续费、怎么取消，并有《使用条款》和《隐私政策》的链接（见下面的清单）。

### 通过 Apple 登录的权限：不签名的包 / 签名的包

`com.apple.developer.applesignin` 这个权限要描述文件（要签名）；云上模拟器的包都不签名。所以权限文件 `App/EchoIsland.entitlements` **不写在 `project.yml` 里**，由 `make-config.mjs` 决定带不带：

| | 云上的模拟器包（`ios-simulator.yml`）、自己在 Mac 上不设团队 | 签名的包（`ios-testflight.yml`、设了 `ECHO_TEAM_ID`） |
| --- | --- | --- |
| `ECHO_APPLE_SIGNIN` | 不写 = 没有团队编号就不带 | 不写 = 有团队编号就带；`0` 不带 |
| `Generated/Echo.xcconfig` | 没有 `CODE_SIGN_ENTITLEMENTS` | `CODE_SIGN_ENTITLEMENTS = App/EchoIsland.entitlements` |
| `BuildConfig.appleSignIn` | `false`：`appleSignIn` / `appleCredentialState` 当场回 `fail {error:'unavailable', message:'Sign in with Apple is not available in this build …'}`，不碰系统、不崩 | `true` |

TestFlight 的工作流先带着它签；苹果不肯（App ID 上没勾「Sign In with Apple」、密钥的权限不够）就自动不带它再签一次、照样传上去，并在 Actions 页面上出一条黄色提示，说要去哪里勾。勾上以后再跑一次就有了。

### 本地 App Store（StoreKit 测试）

- `App/Store.storekit`：Xcode 的 StoreKit 配置文件，一个订阅组「Echo Island Premium」，两个自动续期订阅 `com.echoisland.app.premium.monthly`（US$8.99 / 月）、`com.echoisland.app.premium.yearly`（US$59.99 / 年，7 天免费试用——**例子**，真的价格和试用在 App Store Connect 里定，这个文件只给测试用）。改了 App 标识，这里的两个编号也要跟着改（`tests/ios.test.js` 核对）。
- 在 Mac 的 Xcode 里 ⌘R：scheme 的运行设置用它（`project.yml` 的 `storeKitConfiguration`），买东西不花钱、不连苹果；Debug → StoreKit → Manage Transactions 里能退款、让订阅过期、批准「请求购买」。正式包、TestFlight 不受影响。
- 单元测试 `Tests/StoreKitTests.swift` 用 `SKTestSession(contentsOf:)` 读测试包里的那一份（不弹界面）：商品、买月度（JWS 里带着账号的 UUID）、`iapPending` → `iapFinish`、请求购买 → 批准以后从事件来、恢复、强制续费 → `renewal` 事件 → 过期以后不再有效、退款 → `revoked` 事件。要事件的测试先等 `store.listening`（听的任务跑起来了）再买，和 App 里一打开就听一样。`kind` 的规则（退款优先）另有不用 StoreKit 的单元测试（`AccountLogicTests.testTransactionKinds`）。取消只测了结果怎么回（`AccountLogicTests`：关掉了确认界面的测试里点不了「取消」）；`unverified` 在本地 App Store 里造不出来。
- Xcode 本地 App Store 的交易是 Xcode 的证书签的：手机上算核对过，**服务器那边会拒**（`cloud/API.md`：只认 Apple Root CA – G3），这是对的。
- UI 测试（`-EchoSelfTest store`）只要求异步桥一路通（网页 → `Store.swift` → `window.__echoNative`，用一个当场回的 `bad-token`）；问商品、有商品时弹不弹购买面板只记下来：`xcodebuild test` 不把配置文件交给模拟器（UI 测试里 `SKTestSession` 也管不到被测的 App），云上多半一个商品都没有。

## 口语题的本机识别（iPhone 才有，2026-11-20）

老板在 iPhone 上试：口语题「识别还是太慢，有时候还不准」。以前 iPhone 上的口语题也是网页开麦克风 → 连服务器 → 阿里云实时识别（北京），每题新连一次、要登录、算每天的 AI 额度。现在口语题（闯关、每日复习、对战、大地图的说话任务、能力检测的朗读题——凡是走 `game.js` 的 `recognize()` → `EchoTalk.listenOnce` 的）**先用手机自带的语音识别在手机上听写**：不联网、不用登录、不算额度，边说边出字。和岛民自由聊天还是实时语音模型，不变；安卓不变。

`LocalSpeech.swift`：`SFSpeechRecognizer`（`en-US`、`requiresOnDeviceRecognition = true`、边说边出字），**只管识别**；麦克风归网页（第二版，2026-11-20 晚）：`talk.js` 用和云端识别同一个 `lmOpen`（`getUserMedia` + AudioWorklet）录音，换成 16kHz 16 位 PCM，每 0.1 秒一段 `speechFeed` 送过来。

第一版是原生自己用 `AVAudioEngine` 录音（`AppAudio.configure()` 打开 App 自己的声音会话、自己要麦克风权限、听来电打断和声音设备变了）。在老板的 iPhone 16 Pro（iOS 26.6）上一点话筒就停在「🎤 请说……」、什么都认不出来：App 进程的声音会话和网页那一层（WebKit 在另一个进程里放声音）的声音会话互相打断，原生收到「被打断」就停了，网页把它当成「自己点了停」，没有提示（这是按代码推的，没有真机日志）。云上的模拟器没有本机识别，碰不到这一步。所以第二版原生一点声音会话都不碰（不录音、不 `setActive`、不改类别、不要麦克风权限）。

- **只在手机上识别**：这台手机这门语言没有本机识别就回 `unavailable`，网页同一次里改走云端，**不退回苹果的服务器识别**。
- **打分照样诚实**：不把答案交给识别（不设 `contextualStrings`、不用自定义语言模型），打分还是网页的 `scoreSpeech()`。
- **什么时候算说完由网页定**（`talk.js` 的 `nativeListen`），不等苹果的「最终结果」：有字以后字停住不变 0.4 秒（单词）/ 0.6 秒（句子），并且原生说人已经不出声了（`voice` 事件；一直「在出声」最多再等 1.2 秒）；对上答案当场结束；最长 8 秒。2026-11-24 起：听到的词比这句话少（game.js 给 `listenOnce` 的 `units`，只管等多久、不交给识别和原生）时不这么快交卷——字停住、并且不出声都要满 1.3 秒（只差一点）/ 2 秒（差得多），超过 5 个词的句子最长听「3 秒 + 每个词 1 秒」（最多 15 秒）；零基础、入门和初级两档（`patient`）再放宽一半：2 秒 / 3 秒，最长「4 秒 + 每个词 1.5 秒」（最多 18 秒）。角标的 `w2000` / `w1300` / `w3000` / `w1950` 就是这一次多等过。
- **声音**：和云端识别完全一样，网页 `getUserMedia` 时 `echo-native.js` 把 `navigator.audioSession` 换成 `play-and-record`，麦克风的轨道都停了换回 `playback`。原生不碰。
- 切到后台、网页重建：当场停，发 `end`。来电 / Siri 打断由 WebKit 管网页的麦克风（声音断了原生就收不到 `speechFeed`，网页按计时结束）。
- 识别引擎是单独一层（`SpeechEngine`），权限顺序、收声音、事件不归它管。2026-11-22 起是 `HybridSpeechEngine`：iOS 26 上这门语言的新模型（`SpeechAnalyzer` + `SpeechTranscriber`，预设 `.progressiveTranscription`：临时结果 + 快速结果）装好了就用新的，没装好用 `SFSpeechRecognizer`、同时在后台用 `AssetInventory` 装（系统的资源，第一次要联网）；装好就 `prepareToAnalyze` 一次，模型留到 App 退出（`modelRetention: .processLifetime`）。网页送来的 16kHz 浮点 PCM 由 `PCMConvert` 转成 `bestAvailableAudioFormat` 给的格式（新引擎自己不转，格式不对不报错、只是认不出来）。新引擎也不收答案（没有 `contextualStrings`）。`speechStart` 的回话 `engine` 写着这一次用的哪个，测试版角标是 `device:sa` / `device:sf`；调试时 `localStorage['echo-sr-engine'] = 'sf'` 只用老的（对比快慢）。老板 iPhone 16 Pro（iOS 26.6.1）上老引擎要等人说完才一下子出整句（11-22 的截图：开始听 1 秒、第一个字 4.6 秒）——新引擎快不快只能在真手机上看。
- 权限：原生只弹「语音识别」（说明在 `Info.plist` 的 `NSSpeechRecognitionUsageDescription`，中文）；麦克风是网页的 `getUserMedia` 弹的。第一次（语音识别还没允许）网页等原生问完、回了 `ok` 才开麦克风，两个框不一起弹；平时两边一起开。拒绝了语音识别网页就安静地改走云端，不再问。

都是异步的，第一个参数是网页给的编号，结果回 `window.__echoNative(编号, 'ok' / 'fail', JSON 文字)`；`'fail'` 一律是 `{"error":"短代号","message":"英文说明"}`。网页先看 `window.ECHO_IOS` 和 `typeof EchoNative.speechStart === 'function'`。

| 方法 | 说明 |
| --- | --- |
| `speechState(id)` | 现在能不能用，**不弹任何框**：`ok {auth:'authorized'/'notDetermined'/'denied'/'restricted', mic:'granted'/'denied'/'blocked', onDevice, available, locale:'en-US', engine:'SFSpeechRecognizer', listening}` |
| `speechStart(id, opts)` | 开始一次识别。`opts` 是 JSON 文字 `{short, long, ask, locale, rate}`（`ask:false` 不弹权限框，自测页用；`rate` 是送来的声音的采样率，默认 16000）。识别任务建好了就回 `ok {listening:true, sid:id, ms, locale, short, rate, engine}`；不行回 `fail`：`unavailable`（没有本机识别）/ `denied`、`restricted`（语音识别没允许）/ `busy`（正在弹权限框）/ `not-asked`（`ask:false` 又还没问过）/ `cancelled`（弹框时网页叫停了）/ `background`（App 在后台）。上一次没停的先停掉（`end`，`replaced`） |
| `speechFeed(sid, base64)` | 一段声音：16 位有符号、小端、单声道 PCM（采样率是 `speechStart` 的 `rate`），base64。一秒约 10 段，**不回话**（和 `wsSend` 一样）；编号不对、已经停了、解不开的一律不管。原生换成 32 位浮点单声道交给识别，顺便量出声 / 不出声 |
| `speechStop(id)` | 停：`ok {stopped:true/false}`。正在弹权限框的，答完了也不开 |

**事件** `echo-speech`（`e.detail.sid` = `speechStart` 的编号，`t` = 开始以后几毫秒）：`partial` / `final` `{text}`（到目前为止听到的整句）、`voice` `{on}`（送来的声音开始 / 停止出声，只在变的时候发）、`error` `{code, message, fed}`、`end` `{reason: stop / final / error / background / page / replaced, fed}`（`fed` = 收到几段声音）。

网页那边（`talk.js` 的 `nativeListen`）：麦克风和 `speechStart` 一起开（第一次要弹语音识别的框时，等原生回了再开麦克风），原生回 `ok` 以前录到的先存着、回了一起补发，之后边录边送。**不让学的人卡住**：本机这一次没认出字，除了学的人自己点了停（`aborted`，提示「停了」）和真的没说话（网页没量到人声、原生也没说出声 → 「没听清」），一律同一次里接着走云端识别——用同一个麦克风，录好的声音一起交过去，不用再说一遍；云端也用不了（没有密钥 / 没登录）就按「没听清」回（本机已经记成用不了时照旧走「先跳过 / 请登录」）。原因记在 `fell`（`unavailable` / `denied` / `restricted` / `busy` / `timeout` / `error` / `notext` / `end-<reason>`……）。`unavailable` / `denied` / `restricted` 这次打开 App 记住（回到前台再问一次 `speechState`，打开了就又用本机）；别的原因连着两次也记住（`off = 'fails'`，这次打开 App 不再试本机）。麦克风被拒和云端一样弹「去打开」。每次识别的计时（点了到开始听、第一个字、结束、最后一个字到结束、用的哪个）和本机那几样（送了几段 `fed`、原生说收到几段 `nfed`、有没有人声 `vo`、`off`）留在内存里：`EchoTalk.lastSpeech()` / `EchoTalk.speechLog()`（最近 20 次，不上传），TestFlight 包的版本角标显示最近一次的；周报诊断一行有「口语识别：本机 n 次、云端 m 次，本机说完约 x 秒出分」。调试时 `localStorage['echo-sr'] = 'cloud'` 可以临时只用云端（界面上没有开关；第一版出事那晚的临时包每次打开都写这个值，`echo-native.js` 第一次打开时清掉一次，记号 `echo-sr-v2`）。

云上的模拟器多半没有本机识别：自测页只证明桥通、`unavailable` / `not-asked` 网页认得（`speechStart` 带 `ask:false`，不弹框），单元测试用假引擎走一遍 `speechFeed`（PCM 换算、编号不对不管、出声事件、`end` 带 `fed`）。准不准、快不快、权限框、和配乐 / 朗读一起时声音对不对，要在真 iPhone 上看。

## iPhone 上才要管的（都在壳子里，安卓不变）

- **声音**：App 的声音会话一开始就是「边录边放」+ 默认扬声器 + 蓝牙耳机（`AppAudio.swift`），静音键关不掉配音和岛民说话；网页那一层另外用 `navigator.audioSession` 平时设 `playback`、开麦克风时 `play-and-record`（`echo-native.js`）。来电、闹钟、Siri 打断以后：原生重新打开声音会话，网页把 `interrupted` 的 AudioContext 接上。
- **口语题的本机识别**：录音是原生自己录的（`LocalSpeech.swift`），见上一节「口语题的本机识别」。
- **麦克风**：第一次开口弹系统的「允许使用麦克风」（说明文字在 `Info.plist`）；之后壳子直接放行自己的网页（`requestMediaCapturePermissionFor`），不会每次打开都再问。麦克风用的 16kHz AudioContext 在 iPhone 上会丢四分之一的样本（WebKit bug 251350），`echo-native.js` 去掉这个选项用系统默认的采样率，`talk.js` 本来就会换算成 16k。
- **横屏和刘海 / 灵动岛**：网页铺满整个屏幕。竖屏的上下原来就让开了；横屏时左右两边各约 59px、下面约 21px：`style.css` 末尾只给 iPhone 版的几条（`<html class="echo-ios">`）让开（首页、做题、能力检测、家长首次设置、反馈条、弹窗、聊天、对战）。
- **存档的空间**：iPhone 的 WebKit 一个网站只给 5MB localStorage，值里只要有一个中文字就按一个字 2 字节算（约 262 万字，安卓约 524 万字），`game.js` 的「存档空间快满了」在 iPhone 上按一半算。WebKit 自己的规矩：手机空间紧张时可能清掉不常用网站的数据——壳子请求了「持久存储」，原生每天另存一份备份到「文件」App。
- **不回弹、不选字、长按不出菜单、不缩放、没有链接预览、不显示状态栏、底部横条自动淡掉**；网页检查器只有调试包能连。

## WebKit 检查（这台 Windows 电脑上能做的）

Playwright 带的 WebKit 不是 iPhone 的 Safari（没有麦克风、解码器是 Windows 的），只能查「WebKit 内核」的排版和脚本问题；结果在 `tests/screenshots/ios/`（不进仓库）。

```bash
npx playwright install webkit            # 第一次（这台机器上 PowerShell 里先 $env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT='600000'）
node tools/ios/audit.js                  # WebKit 对 Chromium：首页、闯关、设置、家长设置、大地图 2D / 3D、对战、销售版向导，竖屏横屏，加能力探测和 localStorage 配额
node tools/ios/safearea.js               # 刘海 / 灵动岛 / 底部横条会挡住什么（Chromium 模拟 iPhone 的安全区）
node tools/ios/look.js                   # 新画风（?look=new）在 WebKit 里画不画得出来、一帧多少毫秒
node tools/ios/scan.js                   # 列出用到的、iOS 要特别注意的 JS / CSS 写法
```

## 装到真 iPhone：家长（老板）自己要做的

Claude 不能注册账号、同意协议、付钱，也不能碰证书和密钥。下面这些要本人来（2026-11-19：公司账号 **Echo of Forest Pty Ltd** 已经开通，另一个 App 已经在用 TestFlight；签了「免费 App 协议」，**还没签「付费 App 协议」**）：

1. ~~加入 Apple Developer Program~~（已经有了，公司名义）。
2. App Store Connect 里**签「付费 App 协议」**（协议、税务和银行 → 付费 App）：要填银行账户和税务（澳洲公司填 ABN）。**不签它，订阅在沙盒和 TestFlight 里都买不了**（`iapProducts` 回 `missing`），也上不了架。
3. 开发者后台登记 **App ID** `com.echoisland.app`，勾 **Sign In with Apple**（见「上 TestFlight」第 1 步）。
4. 证书和描述文件：不用自己建。TestFlight 的工作流用 App Store Connect API 密钥让苹果的云签名签（API 密钥、团队编号放进仓库的 Secrets——**只能本人去建、去放**，不要发给别人、不要贴进聊天）。自己有 Mac 时也可以 Xcode 的「自动管理签名」。
5. 在 App Store Connect 里**建这个 App 的记录**（名字、主要语言、Bundle ID、SKU）。

## 上 TestFlight（每个版本先给老板自己装）

`.github/workflows/ios-testflight.yml`，照老板另一个仓库（restaurantweb-site-stack）已经跑通的做法：Linux 上先看密钥都放了 → Mac 上 `tests/ios.test.js` → 正式包的设置编一个模拟器包、装上打开、25 秒后还在、网页打开了（坏的包到这里就停）→ `xcodebuild archive`（临时签名，权限文件带进去）→ `-exportArchive`（`app-store-connect`，API 密钥 + `-allowProvisioningUpdates`：苹果的云签名，自动登记 App ID、生成描述文件，不在用完就扔的 Mac 上建证书）→ 看签好的包（构建号、权限、没有自测页）→ `altool` 用 API 密钥上传，不行再用 xcodebuild 的上传。

- **只能手动点**，推代码不会自己跑；同一个分支后来的排队，不取消正在传的。
- 构建号 = 2026-01-01（UTC）以来的分钟数（和老板另一个 App 一样：只增不减）；版本号（`1.0.0` 这种）不写就用 `Config/Base.xcconfig` 的 `MARKETING_VERSION`，写了用写的。
- 仓库是公开的：**只上传日志**（`ios-testflight-logs`），不传 `.ipa`、`.xcarchive`、签过名的东西；密钥只放进要用的那几步，xcodebuild 跑的时候去掉它们（它会把环境变量写进日志），上传前再把团队编号、密钥编号从日志里抹掉。
- 输入：`edition`（默认 `sales`；`family` 要另外两个 Secrets `ECHO_PARENT_PIN`、`ECHO_DASHSCOPE_KEY`，App 标识多 `.family`、要在 App Store Connect 另建一个 App，**只给自家人**）、`version`、`apple_signin`（默认带）。

**老板第一次要做的（按顺序）：**

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → ＋ → App IDs → App → 描述「Echo Island」、Bundle ID 选 **Explicit**：`com.echoisland.app` → Capabilities 里勾 **Sign In with Apple**（选 Enable as a primary App ID）；**In-App Purchase** 默认就有 → Continue → Register。
   （不勾也能传：工作流会不带登录权限再签一次、照样传上去，并提示去这里勾。）
2. App Store Connect → 我的 App → ＋ 新建 App：平台 iOS、名称（商店里的名字，全球不能重名，例如「Echo Island: English Adventure」）、主要语言、Bundle ID 选 `com.echoisland.app`、SKU（自己起，例如 `echoisland-ios`）、用户访问权限「完全访问」。
3. App Store Connect → 用户和访问 → 集成 → App Store Connect API → 团队密钥 → ＋：名字「GitHub TestFlight」、访问权限 **管理（Admin）**（要能登记 App ID、生成描述文件）→ 下载 `AuthKey_XXXXXXXXXX.p8`（**只能下载一次**），记下密钥 ID 和页面上方的 Issuer ID。
   （另一个 App 已经有一把 Admin 的团队密钥的话，同一把也能用。）
4. 把四个值放进**这个仓库**的 Secrets（Settings → Secrets and variables → Actions）：`ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_KEY_P8`（.p8 文件的全文，从 BEGIN 那一行到 END 那一行都要）、`APPLE_TEAM_ID`（10 位团队编号）。用 `tools/` 里准备好的那个设置小窗口，或者 `gh secret set 名字 -R 仓库`（值从剪贴板 / 文件来，不要贴进聊天）。
5. 触发（下面）。第一次传上去以后 App Store Connect → TestFlight 里：处理完（5–30 分钟）→「出口合规」已经在 Info.plist 里答了（只用标准加密）→ 把自己加进内部测试组 → iPhone 上装 TestFlight App 就能装。

**怎么触发：**

```bash
gh workflow run ios-testflight.yml --ref echo-island/next                      # 销售版，带通过 Apple 登录
gh workflow run ios-testflight.yml --ref echo-island/next -f version=1.0.1     # 换版本号
gh workflow run ios-testflight.yml --ref echo-island/next -f apple_signin=false
gh run list --workflow ios-testflight.yml                                       # 看结果；日志：gh run download <编号> -n ios-testflight-logs
```

**注意：这个工作流只在 `echo-island/next` 分支上，不在默认分支 `main` 上**（这个仓库的 `main` 不是游戏，不往那边放）。GitHub 只认得「默认分支上有、或者已经跑过一次」的手动工作流，所以第一次 `gh workflow run` 可能说找不到（HTTP 404）。**最省事的办法是推一个 `testflight-` 开头的标签**，它按默认的设置（销售版、`Base.xcconfig` 里的版本号、带通过 Apple 登录）传一次；跑过一次以后 `gh workflow run` 也认得了：

```bash
git tag testflight-20261119-1
git push origin testflight-20261119-1
```

三条路装到 iPhone 上：

| 路 | 要什么 | 限制 |
| --- | --- | --- |
| **TestFlight 内部测试** | 上面 1–5；把包传到 App Store Connect（Xcode Archive，或者云上签名后上传）；测试的人要是 App Store Connect 里的成员（账户持有人、管理、App 管理、开发、营销任一角色） | 最多 **100 人**、每人最多 30 台设备；不用 Apple 审核，传上去处理完就能装；每个包 **90 天**后过期 |
| **TestFlight 外部测试** | 同上，再建一个外部测试组，填测试说明、联系方式 | 最多 **10,000 人**（邮件邀请或公开链接）；每个版本**第一次给外部测试要过 Apple 的测试审核**（通常一两天）；同样 90 天过期 |
| **Ad Hoc** | 每台手机的 **UDID** 先登记到开发者后台，用 Ad Hoc 描述文件签名，把 `.ipa` 发过去装 | 每种设备每个会员年最多 **100 台**（删掉也不还名额，续费时能清一次）；换手机要重新登记、重新签 |

正式公开发：在 App Store Connect 填好商品页、截图、隐私信息、年龄分级，提交审核。

## App Store 审核要点（这个 App 的）

- **隐私清单** `App/Resources/PrivacyInfo.xcprivacy`：不追踪（`NSPrivacyTracking` = false，没有追踪域名）；收集的数据（公开版有账号，所以都**和身份关联**、都只为 App 的功能）：邮箱、用户 ID、购买记录、音频（口语打分、和岛民聊天时说的话，经服务器转给 AI，服务器不留）、其他用户内容（聊天打的字、举报时发的几句）。代码里真的用到的「要说明原因的接口」：
  - UserDefaults（家长密码的状态、屏幕方向、渲染挂了几次）→ `CA92.1`；
  - 文件修改时间（列「文稿」里的备份）→ `C617.1`；
  - 开机以来的时间（`ProcessInfo.systemUptime`：2 分钟里网页挂了几次）→ `35F9.1`；
  - 剩余空间（首次设置的设备检查，显示还剩几 GB）→ `E174.1`、`85F4.1`。
  （家长密码锁定用的 `clock_gettime` 和 `kern.bootsessionuuid` 不在苹果的清单上，值也不离开手机。）App Store Connect 里的「App 隐私」问卷要和这里一致，再加上隐私政策的网址（可以用 `pages/privacy.html` 的内容放到公司网站上）。
- **出口合规**：只用系统的 HTTPS / WSS 和 CryptoKit 的 SHA-256，`Info.plist` 写了 `ITSAppUsesNonExemptEncryption = false`，上传时不用再填加密文件。
- **麦克风说明**（`NSMicrophoneUsageDescription`）：「回声岛要听你说的英语，才能给口语打分、让你和岛民用英语聊天。声音只用来识别和打分。」——要和真实用途一致，审核会看。
- **语音识别说明**（`NSSpeechRecognitionUsageDescription`，2026-11-20）：「口语题用 iPhone 自带的语音识别，在这台手机上把你说的英语写成文字来打分。识别在手机上完成，这段声音不会上传。」——代码里只用本机识别（`requiresOnDeviceRecognition = true`），和说明一致。
- **年龄分级**（2025 年起是 4+ / 9+ / 13+ / 16+ / 18+，问卷里新加了「家长控制」「年龄验证」「AI 聊天」这类问题）：如实答；有家长密码、学习锁、冒险时间这些「App 内的控制」。AI 岛民说什么由云上的模型决定，审核会关心它会不会说出不合适的话——岛民的人设和安全规则（`talk-core.js` 的 `instructions()`）、本机的关键词标记、家长能看全文，在审核备注里写清楚。
- **AI 内容**（审核指南 1.2、5.1.2(i)）：用第三方 AI 时要在用之前清楚告诉用户数据发给了谁（阿里云）、征得同意（销售版向导的第 ① 步和聊天页「家长须知」就是这个）；要有举报不合适内容的办法和联系方式。
- **不要放进「儿童」分类**（Kids Category，指南 1.3 / 5.1.4）：「儿童」分类不许把孩子的个人信息（包括声音）发给第三方，而这个 App 的核心就是把孩子的声音发给阿里云识别、和 AI 自由对话；一旦进了「儿童」分类，以后每次更新都要守它的规矩。面向所有年龄、按普通 App 上架。
- **审核用的账号**：公开版的 AI 走服务器（`cloud/`）、要登录：给审核员一个**演示账号**（见下面清单的「审核备注」）。还没接服务器的老销售版（家长粘贴百炼密钥）不要拿去公开审核。

## App Store Connect 清单（Echo of Forest Pty Ltd 上架这个 App 要填的）

本人在 App Store Connect / 开发者后台填；Claude 只能写草稿、不能替你点「提交」。

**1. 订阅（App 内购买）** —— 先签「付费 App 协议」（协议、税务和银行）

- 我的 App → 回声岛 → 订阅 → 新建**订阅组**：参考名称 `Echo Island Premium`（组的显示名称可以写「回声岛 Premium」/「Echo Island Premium」）。
- 组里两个**自动续期订阅**（两个放同一个级别：只是长短不同，换档在下一个周期生效）：

  | 参考名称 | 产品 ID（**和 `make-config.mjs` 的默认值一字不差**） | 时长 | 价格 |
  | --- | --- | --- | --- |
  | Premium Monthly | `com.echoisland.app.premium.monthly` | 1 个月 | US$8.99（价格表按美国定，别的地区自动换算，可以单独改） |
  | Premium Yearly | `com.echoisland.app.premium.yearly` | 1 年 | US$59.99 |

  要换编号：打包时设 `ECHO_IAP_MONTHLY` / `ECHO_IAP_YEARLY`，服务器的 `APPLE_PRODUCTS` 也要一样（`cloud/API.md` §7）。
- 每个订阅填：显示名称和描述（至少英文、简体中文）、**审核截图**（付费墙的截图）、审核备注。
- **首次优惠**（可选）：年度 7 天免费试用只是 `Store.storekit` 里的**例子**，在这里定真的（订阅 → 订阅价格 → 推介促销优惠）。
- 第一次提交审核时，订阅要和 App 的版本**一起**提交（版本页面「App 内购买项目和订阅」里勾上）。

**2. App Store 服务器通知（V2）** —— App 信息 → App Store 服务器通知

- 正式环境和沙盒环境的网址都填：`https://<服务器的域名>/v1/iap/apple/notifications`（`cloud/API.md` §7 `POST /v1/iap/apple/notifications`；域名等 `cloud/README.md` 定了再填）。版本选 **Version 2**。

**3. 通过 Apple 登录**

- App ID `com.echoisland.app` 勾 **Sign In with Apple**（Enable as a primary App ID）——见「上 TestFlight」第 1 步。
- 服务器要能撤销 Apple 登录（删账号时，`cloud/API.md` §4 `DELETE /v1/me`）：开发者后台 → Keys → ＋ → 勾 Sign In with Apple → Configure 选 `com.echoisland.app` → 下载 `.p8`（只能下载一次），记下 Key ID；这把钥匙、团队编号、`com.echoisland.app` 交给服务器的设置（放进服务器的密钥里，不进仓库）。
- 服务器核对 identityToken 的 `aud` = `com.echoisland.app`。

**4. 年龄分级**（2025 年起的问卷：4+ / 9+ / 13+ / 16+ / 18+）

- 「用户生成内容」「和别人聊天 / 发消息」：**是**——岛民的话是 AI 当场生成的，内容不是我们提前写死、审过的，按「用户生成内容」答最稳妥；有安全规则（只扮演游戏角色、限定话题）、本机关键词标记、举报按钮（`POST /v1/report`，留 90 天）、家长能看全文。孩子之间不能互相聊天。
- 「家长控制」：**是**（家长密码、学习锁、冒险时间、儿童账号要家长邮件同意）。「年龄验证 / 年龄确认」：只问年龄段（自己选，不验证证件），按「否」或「自我申报」如实答。
- 不是赌博、没有不受限制的网页浏览、没有暴力 / 色情内容；医疗、健康话题：否。
- 结果多半是 **9+ 或 13+**，以问卷算出来的为准。**不要勾「为儿童设计」/ 不进「儿童」分类**（上面「审核要点」说了原因）。

**5. App 隐私（营养标签）**——和隐私清单一致

| 数据类型 | 收集 | 和身份关联 | 用于追踪 | 用途 |
| --- | --- | --- | --- | --- |
| 联系信息 → 电子邮件地址 | 是（登录、儿童账号的家长同意邮件） | 是 | 否 | App 功能 |
| 标识符 → 用户 ID | 是（账号编号、Apple 的用户编号） | 是 | 否 | App 功能 |
| 购买项目 → 购买历史记录 | 是（订阅） | 是 | 否 | App 功能 |
| 用户内容 → 音频数据 | 是（说的话，转给 AI 识别和回答，不保存） | 是 | 否 | App 功能 |
| 用户内容 → 其他用户内容 | 是（聊天打的字、举报的那几句） | 是 | 否 | App 功能 |

再按服务器最后的样子核对一遍（`cloud/README.md` 出来以后）：年龄段、能力级别、每天用了多少分钟也存在服务器上——按「其他数据类型」或「产品交互」申报更稳妥。隐私政策网址必填（`pages/privacy.html` 的内容改成公开版放到公司网站上），付费墙和商品页还要有《使用条款》（EULA）的链接（用苹果的标准 EULA 就在描述里写那个链接）。

**6. 审核备注**（App 审核 → 登录信息 + 备注）

- 演示账号：给一个审核员用的邮箱，服务器那边要能让它不用收邮件就登录（例如固定的验证码，只对这一个邮箱有效、上架后换掉）——**要和做服务器的那一步一起做**，这里先占位：`review@<公司域名>` / 验证码 `<服务器设的>`；年龄段选「成人」（不用家长同意就能用 AI 聊天）。也可以用「通过 Apple 登录」。
- 怎么找到 AI 聊天：打开 → 登录 → 首页第三个标签「和岛民聊天」→ 选一个岛民 → 按住话筒说英语（或点「麦克风用不了？点这里打字」）；免费每天 5 分钟。
- 写明：AI 是第三方模型（阿里云通义千问）经我们的服务器调用；数据发给谁在首次打开和聊天页的说明里写了；有举报按钮和联系邮箱。
- 订阅：写明在哪里看到付费墙、怎么恢复购买。沙盒测试账号审核员自己有，不用给。

**7. 欧盟的「交易商」身份（数字服务法 DSA）**

- App Store Connect → 业务 / 协议 → **交易商身份**：公司卖订阅，是交易商，选「是，我是交易商」。
- 要填并经苹果验证：公司地址（Echo of Forest Pty Ltd 的注册地址）、电话、邮箱；这些会**显示在欧盟区的商品页上**（用公司的电话和邮箱，不用私人的）。
- 不填的话 App 在欧盟 27 国的商店里不上架（别的地区不受影响）。

## 中国大陆

在中国大陆的 App Store 上架**游戏**要有国家新闻出版署的**游戏版号**（审核时上传批准文件），带 AI 生成内容的还要做生成式 AI 的备案（2026-11 起 App Store Connect 里有单独的申报页）。这两样短期内办不下来，所以**第一次公开发布选中国大陆以外的地区**（在 App Store Connect 的「价格与销售范围」里不勾中国大陆）。TestFlight 测试不受这条限制。

## 还没验证过的（要在真 iPhone / 云上的 Mac 上看）

- 第一次在云上编译：这台电脑编不了 Swift，Swift 的写法是对着苹果的文档和 WebKit 的头文件核过的，但还没真编过。
- 订阅和登录（2026-11-19 加的 `Store.swift`、`AppleSignIn.swift`、StoreKit 测试、TestFlight 工作流）：还没在云上编过、没传过 TestFlight；`-allowProvisioningUpdates` 能不能自己给 App ID 加上「通过 Apple 登录」没试过（工作流不行就不带它再签一次）；沙盒里真的买要等「付费 App 协议」签好、App Store Connect 里建好两个订阅。
- 课程包（2026-11-20）：自测页 `run=packs` / `packs2`、UI 测试第 8 个还没在云上跑过——`echoisland://` 的 IndexedDB 存 ArrayBuffer、重开还在、`blob:` 的 Ogg Opus 在 WKWebView 里放不放得出声，只有云上的模拟器 / 真 iPhone 能证明（Windows 上的 WebKit 连 WAV 都放不了，证明不了）。真 iPhone 上 100 MB 下载切后台、断网、杀进程以后接着下，也要实际试。
- 口语题的本机识别（2026-11-20）：真 iPhone 上孩子的口音认得准不准、说完到出分多快（周报诊断一行、`EchoTalk.lastSpeech()`）、第一次的两个权限框、问完以后配乐和朗读是不是还从扬声器出来、音量照旧、来电打断以后。
- 真 iPhone 上：麦克风录音和阿里云实时识别、AI 聊天（直连）、配音的 Ogg Opus、静音键、来电打断以后声音接不接得上、横屏的灵动岛、长按会不会出放大镜、存档在 WebKit 里能放多少、内存大的 3D 场景会不会把网页进程挤掉。
- 销售版的首次设置向导第 ② 步「设备检查」是按安卓写的（系统版本那一行、「iPhone 装不上」那句说明），iPhone 上要改成认 `diag().platform === 'ios'`（`setup.js`，见交接说明）。
