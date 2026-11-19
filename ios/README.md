# 回声岛 iPhone 版

一个全屏的 WKWebView 壳（Swift，不用任何第三方库），和 `android/` 的 WebView 壳是一对：

- 游戏网页（`index.html`、各个 `.js`、`assets/` 里的模型和配音）打包时整个复制进 App 的 `www/`，用 App 自己的地址 `echoisland://localhost/index.html` 打开（`WebAssetHandler.swift`）。**离线能玩**；这个地址算「安全的网页」，麦克风（`getUserMedia`）、`fetch` 都能用；配音的 `<audio>` 要一段一段读（`Range`），这里按 206 回。
- 原生桥 `window.EchoNative`：方法名、参数、返回值和安卓**一模一样**（`android/README.md` 的表），游戏的 `game.js` / `talk.js` / `setup.js` 不用为 iPhone 改。安卓上网页是同步调用原生的，iPhone 上做不到，所以 `App/Resources/echo-native.js`（页面一开始就注入）把它分成两条路：
  - 同步的 22 个：网页 `prompt('__echo_native__:{…}')` → 原生在 prompt 的回调里办完、把结果当返回值交回来（`Bridge.callSync`）；
  - 异步的 4 个（`wsOpen` / `wsSend` / `wsClose` / `post`，连阿里云的）：`webkit.messageHandlers.echo.postMessage` → 原生连好以后调 `window.__echoNative(id, 类型, 数据)`，和安卓一样（`Bridge.callAsync` → `DashScope.swift`）。
- 原生桥带着百炼密钥直连 `dashscope.aliyuncs.com`（`URLSessionWebSocketTask` + `Authorization` 头），**只许连这一个域名**，网页拿不到密钥本身。
- 家长密码 `PinGuard.swift`、备份文件名 `BackupNames.swift` 是照着安卓的 Java 一条一条写的（同一个盐、同样的 SHA-256、错 5 次锁 10 分钟、改手机时钟解不开）。
- 网页进程没了（内存不够被系统收掉）：重建网页、重新打开首页，存档还在，网页能用 `takeRecovered()` 知道刚恢复过；前台 2 分钟里连挂 3 次显示一句话，等孩子点一下。

方法全表、哪些和安卓不完全一样，见下面「原生桥：和安卓不一样的地方」。

## 文件

| 文件 | 内容 |
| --- | --- |
| `project.yml` | XcodeGen 的工程定义（不手写 `.xcodeproj`）：App、单元测试、UI 测试三个 target；最低 iOS 18.4；Swift 语言版本钉在 5 |
| `Config/Base.xcconfig` | 进仓库的默认打包设置：App 标识 `ECHO_BUNDLE_ID`（**现在是占位的 `com.example.echoisland`**）、版本号、开发者团队。`Generated/Echo.xcconfig` 盖掉同名的 |
| `App/Info.plist` | App 名「回声岛」、麦克风说明（中文）、竖屏 + 横屏、不显示状态栏、`ITSAppUsesNonExemptEncryption = false`、备份在「文件」App 里看得到 |
| `App/Resources/` | `echo-native.js`（EchoNative 那一层 + iPhone 才要管的声音、触摸、横屏标记）、`PrivacyInfo.xcprivacy`（隐私清单）、图标 |
| `App/Sources/` | `AppDelegate`（场景、屏幕常亮）、`GameViewController`（网页、prompt/alert、麦克风放行、方向、后台前存档、进程挂了重建）、`WebAssetHandler`、`Bridge`、`DashScope`、`PinGuard`、`BackupNames`、`Stores`（钥匙串里的密钥、「文稿」里的备份）、`AppAudio`（声音会话） |
| `Tests/LogicTests.swift` | 单元测试（模拟器里跑）：家长密码、备份轮换、Range、类型、只连阿里云、原生桥的入口 |
| `UITests/SmokeUITests.swift` | UI 测试：打开到首页（竖屏、横屏截图）、原生桥自测页一个都不能没过、麦克风弹窗、分享面板和文件选择器 |
| `www-test/selftest.html` | 原生桥自测页（**只打进调试包**）：把 26 个方法都调一遍，再看几样 WebKit 的本事 |
| `scripts/prepare.mjs` | 打包前一条命令做完：`make-config.mjs` → `copy-web.mjs` → 没有图标时 `make-icons.mjs` |
| `scripts/make-config.mjs` | 生成 `Generated/BuildConfig.swift`、`Generated/Echo.xcconfig`（版本、构建号；家庭版另有密钥和家长密码的**哈希**） |
| `scripts/copy-web.mjs` | 把游戏网页复制进 `www/`：和安卓 `copyWeb` 同一份白名单，销售版不带保留怪兽 |
| `scripts/make-icons.mjs` | 从 `android/icon-512.png` 生成 1024 的图标（垫底色、去透明） |
| `../.github/workflows/ios-simulator.yml` | 云上的 Mac 编译、跑测试 |
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

## 云上怎么编（GitHub Actions，不用自己有 Mac）

`.github/workflows/ios-simulator.yml`：推到 `echo-island/next` 并且改了 `ios/`、这个工作流或 `tools/ios/` 时自动跑；也可以在 Actions 页面手动点 **Run workflow**。仓库是公开的，macOS 的机器不要钱。

- 机器：`macos-26`（Apple 芯片），Xcode **26.6**（`/Applications/Xcode_26.6.app`），模拟器 **iPhone 17 / iOS 26.5**。
- 步骤（每一步单独一行，红在哪一步一眼看得出来）：浅克隆 → `node tests/ios.test.js` → 装 XcodeGen → `prepare.mjs`（销售版）→ `xcodegen` → 编译调试包（模拟器，不用开发者证书）→ 单元测试 → UI 测试 → 再编一遍正式包的设置（不签名，核对没有自测页）→ 导出截图 → **不管成没成**上传 `ios-simulator-results`：完整的编译日志、两个 `.xcresult`、截图和自测结果。
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
- 调试包的启动参数（UI 测试用）：`-EchoUITest`（屏幕最下面一行很小的状态字）、`-EchoSelfTest all|mic|share|pick`（打开原生桥自测页）、`-EchoOrient landscape`（这次横屏打开）。正式包里都没有。

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

26 个方法都有，名字、参数个数、返回值的类型、同步 / 异步（异步 = 连阿里云的四个）都和安卓一样（`tests/ios.test.js` 核对三处：README、`echo-native.js`、`Bridge.swift`）。不一样的：

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

## iPhone 上才要管的（都在壳子里，安卓不变）

- **声音**：App 的声音会话一开始就是「边录边放」+ 默认扬声器 + 蓝牙耳机（`AppAudio.swift`），静音键关不掉配音和岛民说话；网页那一层另外用 `navigator.audioSession` 平时设 `playback`、开麦克风时 `play-and-record`（`echo-native.js`）。来电、闹钟、Siri 打断以后：原生重新打开声音会话，网页把 `interrupted` 的 AudioContext 接上。
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

Claude 不能注册账号、同意协议、付钱，也不能碰证书。下面这些要本人来：

1. **加入 Apple Developer Program**（developer.apple.com/programs）：每年 **US$99（中国区 ¥688）**。
   - 个人：卖家名字是本人的名字。
   - 公司（推荐，App Store 上显示公司名）：要公司的法律实体、**D-U-N-S 编号**（免费申请，要几天到几周）、有权代表公司签字、公司网站、公司域名的邮箱。
2. 登录 App Store Connect，**同意协议**（免费 App 只要「Apple Developer Program 许可协议」；以后收费或内购才要签「付费 App 协议」并填银行和税务）。
3. 在开发者后台登记 **App ID**（Bundle ID，例如 `com.公司域名倒过来.echoisland`），告诉我（Claude）换掉 `Config/Base.xcconfig` 的占位值；把 **团队编号**（Team ID，10 位）告诉我。
4. 证书和描述文件：用 Xcode 的「自动管理签名」就行（要一台装了 Xcode 的 Mac 登录这个 Apple 账号）；或者在云上签名：要把分发证书（.p12 + 密码）和 App Store Connect API 密钥放进仓库的 Secrets——**这两样只能本人去建、去放**，不要发给别人、不要贴进聊天。
5. 在 App Store Connect 里**建这个 App 的记录**（名字、主要语言、Bundle ID、SKU）。

三条路装到 iPhone 上：

| 路 | 要什么 | 限制 |
| --- | --- | --- |
| **TestFlight 内部测试** | 上面 1–5；把包传到 App Store Connect（Xcode Archive，或者云上签名后上传）；测试的人要是 App Store Connect 里的成员（账户持有人、管理、App 管理、开发、营销任一角色） | 最多 **100 人**、每人最多 30 台设备；不用 Apple 审核，传上去处理完就能装；每个包 **90 天**后过期 |
| **TestFlight 外部测试** | 同上，再建一个外部测试组，填测试说明、联系方式 | 最多 **10,000 人**（邮件邀请或公开链接）；每个版本**第一次给外部测试要过 Apple 的测试审核**（通常一两天）；同样 90 天过期 |
| **Ad Hoc** | 每台手机的 **UDID** 先登记到开发者后台，用 Ad Hoc 描述文件签名，把 `.ipa` 发过去装 | 每种设备每个会员年最多 **100 台**（删掉也不还名额，续费时能清一次）；换手机要重新登记、重新签 |

正式公开发：在 App Store Connect 填好商品页、截图、隐私信息、年龄分级，提交审核。

## App Store 审核要点（这个 App 的）

- **隐私清单** `App/Resources/PrivacyInfo.xcprivacy`：不追踪；收集的数据写了「音频」和「其他用户内容」（口语录音、聊天的话发到阿里云识别和回答，不和身份关联、不用于追踪）。代码里真的用到的「要说明原因的接口」：
  - UserDefaults（家长密码的状态、屏幕方向、渲染挂了几次）→ `CA92.1`；
  - 文件修改时间（列「文稿」里的备份）→ `C617.1`；
  - 开机以来的时间（`ProcessInfo.systemUptime`：2 分钟里网页挂了几次）→ `35F9.1`；
  - 剩余空间（首次设置的设备检查，显示还剩几 GB）→ `E174.1`、`85F4.1`。
  （家长密码锁定用的 `clock_gettime` 和 `kern.bootsessionuuid` 不在苹果的清单上，值也不离开手机。）App Store Connect 里的「App 隐私」问卷要和这里一致，再加上隐私政策的网址（可以用 `pages/privacy.html` 的内容放到公司网站上）。
- **出口合规**：只用系统的 HTTPS / WSS 和 CryptoKit 的 SHA-256，`Info.plist` 写了 `ITSAppUsesNonExemptEncryption = false`，上传时不用再填加密文件。
- **麦克风说明**（`NSMicrophoneUsageDescription`）：「回声岛要听你说的英语，才能给口语打分、让你和岛民用英语聊天。声音只用来识别和打分。」——要和真实用途一致，审核会看。
- **年龄分级**（2025 年起是 4+ / 9+ / 13+ / 16+ / 18+，问卷里新加了「家长控制」「年龄验证」「AI 聊天」这类问题）：如实答；有家长密码、学习锁、冒险时间这些「App 内的控制」。AI 岛民说什么由云上的模型决定，审核会关心它会不会说出不合适的话——岛民的人设和安全规则（`talk-core.js` 的 `instructions()`）、本机的关键词标记、家长能看全文，在审核备注里写清楚。
- **AI 内容**（审核指南 1.2、5.1.2(i)）：用第三方 AI 时要在用之前清楚告诉用户数据发给了谁（阿里云）、征得同意（销售版向导的第 ① 步和聊天页「家长须知」就是这个）；要有举报不合适内容的办法和联系方式。
- **不要放进「儿童」分类**（Kids Category，指南 1.3 / 5.1.4）：「儿童」分类不许把孩子的个人信息（包括声音）发给第三方，而这个 App 的核心就是把孩子的声音发给阿里云识别、和 AI 自由对话；一旦进了「儿童」分类，以后每次更新都要守它的规矩。面向所有年龄、按普通 App 上架。
- **审核用的账号**：销售版第一次打开要家长设密码、粘贴百炼密钥。给审核员准备一把**单独的、额度很小的**测试密钥写在审核备注里（不要用家里那把），或者说明没有密钥时哪些功能能用（闯关、冒险、复习都不用 AI）。

## 中国大陆

在中国大陆的 App Store 上架**游戏**要有国家新闻出版署的**游戏版号**（审核时上传批准文件），带 AI 生成内容的还要做生成式 AI 的备案（2026-11 起 App Store Connect 里有单独的申报页）。这两样短期内办不下来，所以**第一次公开发布选中国大陆以外的地区**（在 App Store Connect 的「价格与销售范围」里不勾中国大陆）。TestFlight 测试不受这条限制。

## 还没验证过的（要在真 iPhone / 云上的 Mac 上看）

- 第一次在云上编译：这台电脑编不了 Swift，Swift 的写法是对着苹果的文档和 WebKit 的头文件核过的，但还没真编过。
- 真 iPhone 上：麦克风录音和阿里云实时识别、AI 聊天（直连）、配音的 Ogg Opus、静音键、来电打断以后声音接不接得上、横屏的灵动岛、长按会不会出放大镜、存档在 WebKit 里能放多少、内存大的 3D 场景会不会把网页进程挤掉。
- 销售版的首次设置向导第 ② 步「设备检查」是按安卓写的（系统版本那一行、「iPhone 装不上」那句说明），iPhone 上要改成认 `diag().platform === 'ios'`（`setup.js`，见交接说明）。
