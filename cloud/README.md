# 回声岛公开版服务器（cloud/）

公开发到 App Store（以后 Google Play）的回声岛不能带 AI 密钥，所以要有自己的服务器：

- 保管阿里云百炼（国际版，新加坡）的密钥，替 App 连 AI；
- 每个用户一个账号（邮箱验证码，iPhone 上还有 Sign in with Apple；没有密码）；
- 按账号、按天计 AI 用量（实时聊天按秒，识别和别的小调用按次）；
- 订阅（App Store 内购）的人多给额度。

公司：Echo of Forest Pty Ltd。**现在什么都没部署、没开任何账号**，全部在本机用假的阿里云 / Apple / 邮件测过（`npm test`）。

接口合同（App 照着写）：[`API.md`](API.md)。家庭版的中转服务 `server/` 照旧，和这里无关。

## 文件

| 文件 | 内容 |
| --- | --- |
| `API.md` | 接口合同：每个接口的请求、回答、错误码、WebSocket 怎么登录、额度字段、订阅状态 |
| `wrangler.toml` | Worker 的配置：D1 绑定、每天的定时任务、每分钟限流绑定、不保密的配置（`[vars]`） |
| `migrations/0001_init.sql` | D1 表结构（每张表在文件里有说明） |
| `src/index.js` | 入口和路由、CORS、定时任务 |
| `src/config.js` | 读配置（全部的默认值都在这里），正式环境的主机白名单 |
| `src/auth.js` | 邮箱验证码、Sign in with Apple、会话、退出、撤销 Apple 授权 |
| `src/me.js` | `/v1/me`：看、改、删号；家长同意挡哪些功能 |
| `src/consent.js` | 家长同意：发邮件、家长看的网页（中英文）、同意 / 撤回 |
| `src/iap.js` / `src/jws.js` / `src/x509.js` | 订阅：验 App Store 的签名数据（证书链到 Apple Root CA – G3）、服务器通知 V2；Apple 身份令牌；client_secret |
| `src/quota.js` | 三种计量、按用户时区过日子、实时聊天的开始 / 心跳 / 结算 |
| `src/talk.js` | WebSocket：`/v1/talk` 实时语音聊天、`/v1/asr-rt` 实时识别 |
| `src/ai.js` / `src/upstream.js` | 按次计的 AI 调用（asr、tip、tts、zh、steps、place）、连阿里云 |
| `src/report.js` | 举报、老板看举报、每天的清理 |
| `src/email.js` | 发邮件的接口：`console`（本机）和 `resend` 两种实现，邮件内容 |
| `src/ratelimit.js` | 限流 |
| `src/shared.js` | 从仓库根目录引 `talk-core.js`、`talk-npcs.js`、`talk-courses.js`（别的语言的课的聊天角色）、`quests.js`、`placement-data.js`（打包时一起打进去，不复制） |
| `test/` | 测试（见下面「测试」） |

## 架构和几个决定

**Cloudflare Workers + D1，不用 Durable Object。**

- 账号、会话、用量、订阅、同意、举报都在 D1（SQLite）。每次调用最多两次 D1 往返：一次查「会话 + 账号 + 家长同意 + 订阅」，一次「没到上限就 +1」（一条 SQL 原子完成，到上限就一行都不返回 → 402）。
- **实时语音就在普通 Worker 里转发**（手机 ⇄ Worker ⇄ 阿里云，两条 WebSocket）。Durable Object 有一条出站 WebSocket 时不能休眠，整段聊天按墙钟时间计费；普通 Worker 只按 CPU 时间计费，墙钟时间不收钱。实测转发的 CPU：在本机用和 Worker 一样的代码（JSON 解析 + talk-core 翻译 + 再序列化）跑「10 分钟、两边一直都有声音」（每 0.1 秒一块，上限情况），约 **0.2 秒 CPU**。按官方价算 1 万日活、每人每天一段 10 分钟：普通 Worker 的这部分 CPU 不到 1 美元 / 月；同样的东西放 Durable Object（128 MB × 600 秒 = 75 GB·秒一段）约 **276 美元 / 月**。所以不用。
- 「一个账号同时只能聊一段」和「Worker 被系统停掉也要记账」靠 D1 的 `talk_live` 表：开聊时在一个事务里插一行（同一个人已经有一行就插不进去 → 409）；聊天中每 `TALK_BEAT_SEC`（20 秒）写一次进度；结束时把秒数并进当天用量、删掉这一行；心跳超过 `TALK_STALE_SEC`（60 秒）没更新的行，在这个人下次开聊时、或者每天的定时任务里，按最后一次进度记账后删掉（最多少记 20 秒）。
- 每分钟的限流用 Cloudflare 的 Rate Limiting 绑定（不写 D1，每个机房各算各的，是挡滥用的第一道）；登录码、家长同意邮件、举报的次数少、又要全球准，放 D1。真正封住花费的是 D1 里每天的用量。
- 什么时候才需要 Durable Object：要「全球严格一致」的限流，或者以后想让一个账号的几台设备实时同步。现在都不需要。

**WebSocket 怎么计时：** 墙钟秒数，从连上阿里云、对话开始那一刻，到这段结束（手机点结束、手机断开、时间到）。开聊时算出今天还剩多少秒 `left`，这一段最长 `min(TALK_SESSION_MAX_SEC, left)`；到点前 `TALK_WARN_SEC`（60 秒）发一条 `{"type":"quota","warn":true}`，到点由 talk-core 自己收尾（说一句「时间到了」、照样评价）。记账不超过 `left`，所以永远不会超过每天的上限。连不上阿里云的那次不记。一段聊天跨过零点，全部算在开始的那天。

**额度几点重置：** 按用户设备报的时区（登录时报 `tzOffsetMin`，`PATCH /v1/me` 也能改）的本地零点。时区夹在 −12:00…+14:00、按 15 分钟取整；**第一次报的直接用，以后离上次改不到 7 天的不认**（不然来回换时区就能每天多拿一份额度；夏令时一年只改两次，不受影响）。从没报过就按 UTC。

**孩子：** 只存年龄段（`child` 13 岁以下、`teen` 13–17、`adult`），不存生日。年龄段没设、或者是 `child` 又没有家长同意时，**实时聊天、检测的自由回答判分、聊天打勾**（会把孩子自由说的话发给 AI 的三样，配置 `CONSENT_GATED`）回 403。读句子的识别、点评、合成、翻译不挡（识别结果只拿来和目标句子比，什么都不存）。孩子不能自己把年龄段改大（家长同意过的除外）。家长同意用「email plus」：家长邮件 → 网页（打开不算，按按钮才算，因为邮箱的安全扫描会自动打开链接）→ 记下同意时间 → 再发一封确认信，里面有随时撤回的链接。

**存什么：** 不存聊天记录、录音；只有孩子在某句 AI 的话上按了「举报」，那段的最后几句（最多 8 句）存 90 天。登录码、会话、同意链接只存哈希；限流表里的 IP、邮箱也只存带密钥的哈希。Apple 的 refresh token（删号时撤销用）用 `DATA_KEY` 加密存。删号马上删光这个人的所有行。

**和游戏共用的文件：** `src/shared.js` 直接 `import '../../talk-core.js'` 等五个文件，wrangler（esbuild）打包时当 CommonJS 一起打进去，`talk-core.js` 需要的 `i18n.js` 也跟着进去。这几个文件**一个字都没改**。所以实时聊天的人设和安全规则和家庭版中转服务一模一样（测试里两边同样的参数发给阿里云的 `session.update` 逐字比对），手机发来的人设、规矩一概不用。

**别的语言的课和岛民聊天（2026-11-21，合同 `tools/course/TALK.md`）：** 西语 / 日语 / 中文课的聊天角色在仓库根目录的 `talk-courses.js`（`node tools/course/build.js --talk` 从课程源文件生成，**改了聊天角色要重新生成再部署**；`--talk --check` 核对是不是最新的）。手机照旧只发角色 id（形如 `es1-u1`）；地图上随便一个人（`npc=dyn`）在 `p` 里带 `lang`。角色上的 `lang` 决定一切，都在 `talk-core.js` 里：这门语言的规矩和例句、音色（`LANGS[语言].voices`：西语 Sonrisa / Bodega，日语 Ono Anna / Ryan，中文 Serena · Maia · Momo / Ryan——2026-11-21 对着真的实时模型试过，英语的 Jennifer 说西语走样）、评语、打勾、开口句数怎么数。服务器这边只多三样：`TALK_LANGS`（开着哪些语言，`GET /v1/me` 的 `talkLangs`）、不支持的语言回 400（不扣额度、不连阿里云）、`/v1/zh` 的 `lang` / `ui`。额度、限流、家长同意、举报都不分语言。英语的一切不变（`t-05`、`t-13` 逐字比对）。

**别的语言的课里的支线委托、AI 发音点评（第二轮，2026-11-21，合同 `tools/course/TALK.md` 末尾）：** 委托的人设、事实、目标还是 `quests.js` 的英文原文；每门语言的开场白、每一步的示范句、有用的词在 `talk-courses.js` 的 `quests`（`node tools/course/build.js --talk` 从 `tools/course/<语言>/quests.json` 生成，另带一张名字表 `names`——这条委托的英文原文里出现的、这门课 `lines.json` 的 `terms` 里定了写法的名字；**翻译改了 `quests.json` 或者名字的写法要重新生成再部署**）。手机发 `quest=<id>&lang=<语言>`，`talk-core.js` 的 `questNpc(q, lang, loc)` 拼：规矩走别的语言那条路，人设后面多三句（事实是英文写的、照实用这门语言说；原文里靠英语才成立的条件——`May I … please`、`went`、`English classroom`——换成这门语言里对应的；名字照名字表写）。`/v1/tip` 多收 `lang`（日语、中文按读音比，不讲罗马字 / 拼音 / 音标）。`questLangs` 只列服务器上真有委托译文的语言，`tipLangs` 看 `TIP_LANGS`。不带 `lang` 的委托和点评发给阿里云的一字不差（`t-05`、`t-14`）。**只用假的阿里云测过**：别的语言的委托在真的模型上守不守规矩（不替学的人说步骤、名字照名字表说、礼貌请求算不算数）要部署以后试。

**App Store 的证书：** 签名数据的证书链最后一张必须是 Apple Root CA – G3。代码里放的是 Apple 公布的它的 **SHA-256 指纹**（`63 34 3A BF B8 9A 6A 03 EB B5 7E 9B 3F 5F A7 BE 7C 4F 5C 75 6F 30 17 B3 A8 C4 88 C3 65 3E 91 79`，来源：Apple 的根证书列表 support.apple.com/121728，ECDSA 384 位、序列号 2D C5 FC 88 D2 C5 4B 95、2039-04-30 到期）——只认这个指纹就等于只认这一张证书。证书文件本身这次没有下载；想把它也放进去：从 https://www.apple.com/certificateauthority/AppleRootCA-G3.cer 下载，先核对指纹（PowerShell：`(Get-FileHash AppleRootCA-G3.cer -Algorithm SHA256).Hash`），再把它的 base64 设成 `APPLE_ROOT_CERT_B64`，这样还会逐字节比对。不查证书吊销（OCSP 要联网，Apple 官方库关掉联网检查时也不查）。

## 老板要开 / 要建的东西

1. **Cloudflare 账号**（公司名义），开 **Workers Paid**（每月 5 美元：WebSocket 长连接、CPU 时间、D1 都要它）。
2. **D1 数据库**：`npx wrangler d1 create echo-island --location=apac`（主库放亚太，离新加坡的阿里云近），把它给的 `database_id` 填进 `wrangler.toml`。
3. **一个域名**（比如 `api.<你的域名>`），在 Cloudflare 上，接到这个 Worker（`wrangler.toml` 里加 `routes = [{ pattern = "api.你的域名", custom_domain = true }]`），再把 `PUBLIC_URL` 设成 `https://api.你的域名`。
4. **阿里云国际版账号**（alibabacloud.com，不是 aliyun.com），开通 **Model Studio（百炼）新加坡**，建一把 API Key（新加坡和北京的 Key 不通用）。**上线前对着控制台核对**：
   - 实时语音模型名（默认 `qwen3.8-omni-flash-realtime`；文档说这个模型在新加坡要用工作空间专属域名 `{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`——那就把 `DS_HTTP_BASE` 设成 `https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com`、`DS_WS_BASE` 设成 `wss://` 开头的同一个地址；也可以换文档里列的 `qwen3.5-omni-flash-realtime` 等）；
   - `qwen3-asr-flash-realtime`、`qwen3-asr-flash`、`qwen-plus`、`qwen3-tts-flash` 在新加坡都有；
   - 岛民用的音色在国际版的实时模型里有没有：英语的 Jennifer、Aiden、Mione（`talk-npcs.js`、`talk-core.js` 的 `VOICES`），别的语言的 Sonrisa、Bodega、Ono Anna、Ryan、Serena、Maia、Momo（`talk-core.js` 的 `LANGS`）。没有的写进 `TALK_VOICE_MAP`（`{"老名字":"新名字"}`），不用改游戏文件；合成用的音色同理（英语 `TTS_VOICE_F` / `TTS_VOICE_M`，别的语言 `TTS_VOICES`）。
   - 别的语言的课（西语 / 日语 / 中文）：`qwen3-asr-flash` 和 `qwen3-asr-flash-realtime` 认不认 `es` / `ja` / `zh` 这几个语言代码（实时识别的 `input_audio_transcription.language` 也是）、
     `qwen3-tts-flash` 的 `language_type` 认不认 `Spanish` / `Japanese` / `Chinese`、`TTS_VOICES` 里的默认音色和聊天用的音色在国际版有没有、合不合适——
     现在用的北京区 2026-11-21 都实测过（见「本机开发和测试」），**国际版还没试过**：换过去以前每种语言各试一句识别、一句合成、一段聊天；
     哪门不行就先从 `SPEECH_LANGS`（识别 / 合成）或 `TALK_LANGS`（聊天）去掉（App 会照旧让那门课用手机自带的识别 / 声音、聊天写「还在做」）。
   - 每月预算和余额提醒（测试会花钱：先用少量额度在 TestFlight 上试）。
5. **发邮件的服务：Resend**（resend.com）。验证发信域名（加 SPF / DKIM 记录，Cloudflare DNS 里点几下），建 API Key，`EMAIL_FROM` 设成 `Echo Island <no-reply@你的域名>`。换别家要改 `src/email.js`（加一个同样参数的函数）。
6. **App Store Connect**（等苹果开发者账号批下来）：
   - App 的 **Bundle ID** → `APPLE_BUNDLE_ID`；
   - 一个订阅组，两个自动续期订阅：月付 US$8.99、年付 US$59.99；产品 id 自己起，写进 `APPLE_PRODUCTS`（例如 `{"premium.monthly":"monthly","premium.yearly":"yearly"}`）；
   - **App Store Server Notifications**：版本选 **Version 2**，正式和沙盒的地址都填 `https://api.你的域名/v1/iap/apple/notifications`；
   - **Sign in with Apple 的钥匙**（Certificates, Identifiers & Profiles → Keys → 勾 Sign in with Apple）：下载 `.p8`（只能下一次），记下 Key ID → `APPLE_SIGNIN_KEY_ID`、Team ID → `APPLE_TEAM_ID`、`.p8` 的内容 → 秘密 `APPLE_SIGNIN_KEY`。删号时撤销 Apple 授权要它（审核要求）；没配时删号照删，撤销跳过、日志里记一句警告。
7. **律师 / 老板定稿**（上架前）：隐私政策（`PRIVACY_URL`）、同意页和邮件的文字（`src/consent.js`、`src/email.js`）。要问的：13 岁以下的孩子用自己的邮箱注册是否可以，还是要家长的邮箱；欧盟各国「需要家长同意」的年龄是 13–16 岁不等，现在只有 `child` < 13 一档；澳洲隐私法。

## 配置和秘密

**秘密**（`npx wrangler secret put 名字`，不写进任何文件）：

| 名字 | 是什么 | 怎么来 |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | 阿里云国际版百炼的 API Key | 控制台建 |
| `AUTH_PEPPER` | 登录码和限流哈希用的密钥（正式环境没有它就 503） | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ADMIN_TOKEN` | 看举报的管理口令（`GET /v1/admin/reports`） | 同上，自己保管 |
| `RESEND_API_KEY` | Resend 的 API Key | Resend 控制台 |
| `DATA_KEY` | 加密 Apple refresh token 的钥匙（32 字节 base64） | 同上 |
| `APPLE_SIGNIN_KEY` | Sign in with Apple 的 `.p8` 内容 | PowerShell：`Get-Content AuthKey_XXXX.p8 -Raw \| npx wrangler secret put APPLE_SIGNIN_KEY` |

**普通配置**（`wrangler.toml` 的 `[vars]`；不写就用 `src/config.js` 里的默认值）：

| 名字 | 默认 | 说明 |
| --- | --- | --- |
| `ENVIRONMENT` | `production`（toml 里） | `production` 时：测试钩子不认、上游只许 `*.aliyuncs.com` / `appleid.apple.com` / `api.resend.com`、邮件不许只打印 |
| `COMPANY_NAME` | Echo of Forest Pty Ltd | 邮件和同意页上 |
| `PUBLIC_URL` | 空（用请求的地址） | 家长同意链接的前缀，填真的 `https://` 域名 |
| `PRIVACY_URL` | 空 | 同意页上的隐私政策链接 |
| `PLANS` | 免费 5 分钟 / 400 / 300，月付 30 / 1500 / 1500，年付 20 / 1500 / 1500 | 每天的额度：`talkMin` 聊天分钟、`asrN` 识别次数、`auxN` 别的 AI 调用次数 |
| `CONSENT_GATED` | `talk,place,steps` | 孩子没有家长同意时不能用的功能 |
| `RATE` | 见 `src/config.js` 的 `DEF_RATE` | 登录码（每邮箱每小时 5、每 IP 20）、登录尝试（每 IP 每小时 60）、举报（每天 20）、同意邮件（每天 5）；没有限流绑定时的每分钟上限 |
| `[[ratelimits]]` `RL_AI_USER` / `RL_AI_IP` / `RL_WS_USER` | 60 / 240 / 12 每分钟 | 每个账号 / 每个 IP 的 AI 调用、每个账号开 WebSocket |
| `DS_HTTP_BASE` / `DS_WS_BASE` | `https://` / `wss://dashscope-intl.aliyuncs.com` | 阿里云地址（工作空间专属域名见上） |
| `TALK_MODEL` | `qwen3.8-omni-flash-realtime` | 实时语音 |
| `TALK_ASR_MODEL` | `qwen3-asr-flash-realtime` | 实时语音里转写孩子说的话 |
| `ASR_RT_MODEL` / `ASR_MODEL` | `qwen3-asr-flash-realtime` / `qwen3-asr-flash` | 口语题的实时识别 / 整段识别 |
| `EVAL_MODEL` | `qwen-plus` | 评价、打勾、点评、翻译、检测判分 |
| `TTS_MODEL` / `TTS_VOICE_F` / `TTS_VOICE_M` | `qwen3-tts-flash` / `Jennifer` / `Aiden` | 现场合成（英语；别的语言的音色在 `TTS_VOICES`） |
| `TALK_VOICE_MAP` | `{}` | 岛民音色改名（`{"talk-core / talk-npcs 里的名字":"要换成的名字"}`，英语和别的语言的音色都能改，比如 `{"Ono Anna":"…"}`） |
| `TALK_LANGS` | `en,es,ja,zh` | 和岛民聊天（`/v1/talk`，连带 `/v1/steps`、`/v1/zh` 的 `lang`）开着哪些语言（API.md §8「Chat language」）。只认 `talk-core.js` 的 `LANGS` 里有的，写别的会被忽略，英语一直在；`GET /v1/me` 的 `talkLangs` 就是它——App 看这个决定别的语言的课开不开聊天。某门语言聊起来不行，从这里去掉即可（改 `[vars]`，不用改 App）；和 `SPEECH_LANGS` 各管各的 |
| `QUEST_LANGS` | 和 `TALK_LANGS` 一样 | 别的语言的课里的支线委托（`/v1/talk?quest=&lang=`、`/v1/steps` 的 `q` + `lang`）开着哪些语言。还要 `TALK_LANGS` 里开着、**服务器上真有这门语言的委托译文**（`talk-courses.js` 的 `quests`）才算；英语一直在。`GET /v1/me`、`/v1/health` 的 `questLangs` 就是它——App 看这个决定别的语言的课出不出委托的「?」 |
| `TIP_LANGS` | 和 `TALK_LANGS` 一样 | AI 发音点评（`/v1/tip` 的 `lang`）开着哪些语言。只认 `talk-core.js` 认得的，英语一直在；`tipLangs` 就是它。和聊天各管各的（聊天关掉了某门语言，点评可以照开） |
| `TEST_QUESTS` | 空 | **只给测试用**（`TEST_HOOKS=1` 而且不是正式环境才认）：委托译文的小样，JSON，形状和 `talk-courses.js` 的 `quests` 一样，并到它上面（同一个 id 以小样为准）。`test/quests-sample.cjs` 是现成的小样 |
| `SPEECH_LANGS` | `en,es,ja,zh` | 口语题识别（`/v1/asr`、`/v1/asr-rt`）和现场合成（`/v1/tts`）认哪些语言（API.md §8 的 `lang`）。只认这四种，写别的会被忽略，英语一直在；`GET /v1/me` 的 `speechLangs` 就是它——App 看这个决定别的语言的课走不走服务器。某门语言的识别 / 合成上线后发现不行，从这里去掉即可（改 `[vars]`，不用改 App） |
| `TTS_VOICES` | `{"es":{"f":"Sonrisa","m":"Bodega"},"ja":{"f":"Ono Anna","m":"Ryan"},"zh":{"f":"Serena","m":"Ryan"}}` | 别的语言现场合成用的音色（女 `f` / 男 `m`；只写要改的那几个就行，英语照旧 `TTS_VOICE_F` / `TTS_VOICE_M`）。默认是说这门语言地道的那几个，和实时聊天用的同名；**2026-11-21 对着真的阿里云（北京区）实测过**：合成模型认这些名字，合成出来的西语 / 日语 / 中文识别一字不差。换国际版时再对着它的音色表核对一遍 |
| `TALK_SESSION_MAX_SEC` | 600 | 每段聊天最长几秒 |
| `TALK_WARN_SEC` | 60 | 还剩几秒时提醒 |
| `TALK_MIN_START_SEC` | 20 | 今天剩下不到几秒就不让开新的一段 |
| `TALK_BEAT_SEC` / `TALK_STALE_SEC` | 20 / 60 | 心跳间隔 / 多久没心跳算断了 |
| `TALK_MAX_PER_USER` | 1 | 一个账号同时几段 |
| `WS_AUTH_WAIT_SEC` | 10 | 等 WebSocket 第一条 `auth` 消息几秒 |
| `ASR_RT_MAX_SEC` / `ASR_RT_MAX_B64` | 15 / 700000 | 一次实时识别最长几秒 / 最多多少声音 |
| `SESSION_DAYS` | 180 | 登录多少天不用就过期（每用一天往后推） |
| `TZ_CHANGE_DAYS` | 7 | 时区多少天内只认一次改动 |
| `REPORT_DAYS` / `USAGE_KEEP_DAYS` / `CONSENT_LINK_DAYS` | 90 / 40 / 7 | 举报、每日用量、家长链接留几天 |
| `EMAIL_CODE_MIN` / `EMAIL_CODE_TRIES` | 10 / 5 | 登录码几分钟有效、能错几次 |
| `MAX_JSON_BYTES` / `MAX_ASR_BYTES` / `MAX_WS_MSG_BYTES` | 65536 / 1500000 / 262144 | 请求体、`/v1/asr` 的录音、一条 WebSocket 消息的上限 |
| `ALLOWED_ORIGINS` | `echoisland://localhost,https://appassets.androidplatform.net` | CORS：App 里网页的来源 |
| `APPLE_BUNDLE_ID` | 空（不填内购和 Apple 登录 503） | App 的 Bundle ID |
| `APPLE_AUDIENCES` | = Bundle ID | Apple 身份令牌认哪些 `aud`（以后有网页版登录再加 Services ID） |
| `APPLE_PRODUCTS` | `{}` | 产品 id → `monthly` / `yearly` |
| `APPLE_ENVIRONMENTS` | `Production,Sandbox` | 认哪些环境的交易。**要留着 Sandbox**：App 审核和 TestFlight 都是沙盒交易（沙盒测试账号只有我们自己在 App Store Connect 里能建） |
| `APPLE_TEAM_ID` / `APPLE_SIGNIN_KEY_ID` / `APPLE_CLIENT_ID` | 空 / 空 / = Bundle ID | 撤销 Apple 授权用 |
| `APPLE_ROOT_SHA256` / `APPLE_ROOT_CERT_B64` | Apple Root CA – G3 的指纹 / 空 | 只给测试换根证书用；正式环境不用设 |
| `EMAIL_PROVIDER` / `EMAIL_FROM` / `RESEND_API_URL` | `resend` / 空 / Resend 的地址 | 本机开发可以设 `console`（只打印到日志） |
| `TEST_HOOKS` | 空 | 只有测试设 `1`（`x-test-now` 请求头改「现在」）；`ENVIRONMENT=production` 时无论如何不认 |

## 部署（在 PowerShell 里，一行一行跑）

```powershell
cd C:\Claude\echo-island\cloud
npm ci
npx wrangler login
npx wrangler d1 create echo-island --location=apac      # 把 database_id 填进 wrangler.toml
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put DASHSCOPE_API_KEY                # 每个秘密一次，粘贴后回车
npx wrangler secret put AUTH_PEPPER
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put DATA_KEY
npx wrangler secret put APPLE_SIGNIN_KEY
# 改 wrangler.toml 的 [vars]：PUBLIC_URL、APPLE_BUNDLE_ID、APPLE_PRODUCTS、APPLE_TEAM_ID、APPLE_SIGNIN_KEY_ID、EMAIL_FROM、PRIVACY_URL
npm test                                                 # 先在本机全部测一遍
npx wrangler deploy
curl https://api.你的域名/v1/health                       # {"ok":true,...}
```

以后改了表结构：在 `migrations/` 加 `0002_….sql`，`npx wrangler d1 migrations apply DB --remote`，再 `npx wrangler deploy`。
看日志：`npx wrangler tail`。看举报：`curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://api.你的域名/v1/admin/reports`。

## 放在哪个机房（`wrangler.toml` 的 `[placement]`）

Cloudflare 默认让程序跑在离用户最近的机房。这样**从机房去连 AI 供应商**那一段就看运气：2026-11-21 老板在悉尼，程序跑在悉尼机房，从那里连阿里云（北京）丢包很厉害——iPhone 上口语题等 20 秒后报「AI 有点忙」，11-20 说的「识别太慢」也是它。本机起的服务器（`live-speech.mjs`）完全正常，只有线上才看得出来。

量出来的数（不带钥匙的测量程序，往 `dashscope.aliyuncs.com` 传 300KB / 每次来回）：

| 程序跑在 | 传 300KB | 来回一趟 |
| --- | --- | --- |
| 悉尼（默认） | 40 秒，还失败 | 1.4–5 秒 |
| 东京 `aws:ap-northeast-1` | 0.6–0.9 秒 | 0.1–0.6 秒 |
| 香港 `aws:ap-east-1` | 1.9–2.8 秒 | 0.1–0.8 秒（偶尔 7 秒） |
| 新加坡 `aws:ap-southeast-1` | 1.0–2.3 秒 | 0.2–1.2 秒 |
| 首尔 `aws:ap-northeast-2` | 2–9.5 秒 | 0.2–2.3 秒 |

所以现在固定在东京。改完以后用真的登录态量线上（三遍都一样）：整段识别 0.7–1.7 秒，实时识别说完 0.4–0.6 秒出字；改之前实时识别不出字或晚八九秒，整段识别时好时坏（1–5 秒，或者 12 秒超时）。

- 回应头 `cf-placement: remote-NRT` 说明在东京跑；`local-XXX` 就是没生效。
- **换成阿里云国际版（新加坡）、或者换供应商以后要重新量、改 `[placement]`**：
  1. `scripts/placement-probe/`（不带钥匙的测量程序，用法写在它的 `wrangler.toml` 开头，**一定带 `--config`**，量完 `wrangler delete`）——比几个地区；
  2. `scripts/live-prod-probe.mjs`（用法写在文件开头：先把同一份程序以预览方式跑在 Cloudflare 上、邮件改成打印来拿登录态，再打线上；会花几分钱、会在线上的库里建一个测试账号再删掉）——确认线上真的快了。
- `hostname = "dashscope.aliyuncs.com"`（让 Cloudflare 自己找近的机房）试过，部署后没有马上生效（还是 `local-SYD`），所以写死地区。

## App 怎么接

App 里设一个服务器地址 `https://api.你的域名`，照 `API.md` 调：登录拿 token → 每个请求带 `Authorization: Bearer <token>`；实时聊天 `wss://api.你的域名/v1/talk?npc=…`，连上后第一条消息发 `{"type":"auth","token":"…"}`，后面的消息和家庭版中转服务的 `/talk` 一样（区别写在 API.md §8：`daily` 改叫 `quota`，多了 `quota` 提醒消息）。买订阅时把 `me.iapToken` 当 `appAccountToken`，买完、恢复购买、`Transaction.updates` 来了都把 `jwsRepresentation` 发给 `POST /v1/iap/apple`。额度、几点重置、订阅状态都以 `GET /v1/me` 为准。

## 本机开发和测试

```powershell
cd cloud
npm ci                 # 依赖装在 cloud/node_modules（不进仓库）
npm test               # 打包 + 假上游 + 两个本机 Worker，约 30 秒
npm run dev            # 本机跑（wrangler dev --local）：先 npm run migrate:local，秘密写在 cloud/.dev.vars（不进仓库），EMAIL_PROVIDER=console 时登录码打印在终端
```

**对着真的阿里云实测别的语言的识别 / 合成**（会花钱，先问老板；跑一遍约几分钱）：`node scripts/live-speech.mjs [en es ja zh]`。本机起同一份程序、上游接真的阿里云，每门语言合成两句（女声、男声）再整段识别、实时识别，用游戏自己的打分算分；钥匙只在进程里从钥匙文件读（`ECHO_KEY_FILE`），不打印。线上的服务器只能从 iPhone 用 Apple 登录，所以不直接打线上。2026-11-21 跑过（北京区）：四门语言全部对上，当时用的 Cherry / Ethan 两个音色西语、日语、中文都能用，说完到出字约 0.5–1.3 秒；当天把带 `lang` 的版本部署到了线上。同一天又把别的语言合成的默认音色换成了说这门语言地道的（Sonrisa / Bodega、Ono Anna / Ryan、Serena / Ryan；对着真的阿里云实测过：合成模型认这些名字，合成出来的识别一字不差），这一版还没部署。换国际版（`DS_HTTP_BASE` / `DS_WS_BASE`）或换模型以后要重跑。

**别的语言的聊天**（`/v1/talk` 的课程角色、`TALK_LANGS`）在本机只用假的阿里云测过（`test/t-13-talk-lang.js`：发给上游的 `session.update` 和 talk-core 拼的一字不差）；模型说这几门语言、这几个音色是 2026-11-21 对着真的阿里云单独试的（`tools/course/TALK.md` §0）。拼出来的整份提示词在真的模型上聊得怎么样，要部署以后在手机上试。

`npm test`（`test/run.js`）：用 wrangler 打包（和部署的同一份 `dist/index.js`）→ 本机起假的阿里云（HTTP + WebSocket，记下服务器发了什么、回写好的事件）、假的 Resend（收邮件）、假的 Apple（JWKS、换 token、撤销）→ 自己造一套和 App Store 一样形状的证书链（用 Node 自带的 OpenSSL 核对过）→ 用 Miniflare（和线上一样的 workerd）起两个 Worker → 跑 `test/t-*.js`。仓库的全套测试里是 `tests/cloud.test.js`（照原样跑这个）。只跑几个：`node test/run.js talk iap`。

测到的：两种登录、会话过期 / 往后推 / 退出、`/v1/me` 的修改规矩、计数和到上限、聊天额度快用完的提醒和到点收尾、免费 / 月付 / 年付的额度、本地零点重置、上游失败退回、孩子没同意被挡和整个同意流程、内购验签（正常、bundleId 不对、产品不对、环境不对、不认识的根、签名不对、叶子过期、内容被改、过期的交易、别人的订阅）和通知（宽限期、到期、退款、撤销退款、去重、按 appAccountToken 找主人）、删号删干净（含撤销 Apple 授权、没配钥匙时跳过）、举报和 90 天清理（定时任务）、和 `server/relay.js` 逐字比对 `session.update`（英语的岛民 / 课本角色 / 委托 / 地图上的人，和西语、日语、中文课的角色）、手机发的人设不用、限流、消息大小、正式环境的保护、cloud/ 里没有禁用词；别的语言的识别 / 合成（`t-12`）；别的语言的聊天（`t-13`：`talkLangs`、课程角色和 dyn 的 `lang`、音色、不支持的语言 400 不扣额度、评语和开口句数按这门语言、`/v1/steps`、`/v1/zh` 的 `lang` / `ui`、`TALK_LANGS`、`TALK_VOICE_MAP`）；别的语言的委托和发音点评（`t-14`：`questLangs` / `tipLangs`、`/v1/talk?quest=&lang=` 逐字比对、名字表和「原文是给英语课写的」那一段、没有译文 / 不支持的语言 400 不扣额度、`/v1/steps` 的 `q` + `lang`、`/v1/tip` 的 `lang`、`QUEST_LANGS` / `TIP_LANGS`、测试钩子在正式环境里不认；`t-05` 里和中转服务逐字比对了三门语言的委托和带 `lang` 的点评）。委托的译文在测试里用小样（`test/quests-sample.cjs`，经测试钩子 `TEST_QUESTS` 给两个服务器），正式的译文交没交结果都一样。

## 成本（按官方标价，不算赠送额度）

**AI（阿里云）**：老板查的是一段 10 分钟的实时聊天约 0.06–0.08 美元（这里没有再核对国际版的价格表，上线前对着控制台的价格页再算一次；识别、评价、合成另算，没算在里面）。按每天用满算：

| 档位 | 每天最多聊 | 用满一个月的聊天成本 | 收入（扣苹果 15–30% 以后） |
| --- | --- | --- | --- |
| 免费 | 5 分钟 | 约 0.9–1.2 美元 | 0 |
| 月付 US$8.99 | 30 分钟 | 约 5.4–7.2 美元 | 约 6.3–7.6 美元 / 月 |
| 年付 US$59.99 | 20 分钟 | 约 3.6–4.8 美元 | 约 3.5–4.25 美元 / 月 |

**注意：年付的人如果每天都用满 20 分钟，聊天成本可能超过收入**；月付天天用满也几乎不赚。大多数人用不满，但定价和额度最好等 TestFlight 上量到真实用量再定（额度都在 `PLANS` 里，改了不用发版）。免费用户每人每月最多约 1 美元。

**Cloudflare**（Workers Paid：每月 5 美元，含 1000 万次请求、3000 万 CPU 毫秒、D1 每月 250 亿行读 / 5000 万行写 / 5 GB；超出部分：请求每百万 0.30 美元、CPU 每百万毫秒 0.02 美元、D1 写每百万行 1 美元）。估算每个日活每天：约 60 次请求、约 1 秒 CPU（实时聊天转发约 0.2 秒 + 每次 HTTP 调用几毫秒）、约 100 行 D1 写（每次调用 1 行用量、聊天的心跳每 20 秒 1 行）：

| 日活 | 请求 / 月 | CPU / 月 | D1 写 / 月 | Cloudflare 每月 |
| --- | --- | --- | --- | --- |
| 1,000 | 180 万 | 约 3000 万毫秒 | 300 万行 | **约 5 美元**（都在包含的额度里） |
| 10,000 | 1800 万 | 约 3 亿毫秒 | 3000 万行 | **约 13 美元**（5 + 请求 2.4 + CPU 5.4） |

和老板查的 6–24 美元 / 月一致（偏低一头）。Rate Limiting 绑定没有单独标价。如果实时聊天放进 Durable Object，1 万日活要多约 276 美元 / 月（见「架构」）。

## 没能在本机验证的

- 真的阿里云国际版：地址（公共域名还是工作空间域名）、模型名、岛民音色、限流和报错的样子。测试里是假的阿里云，只证明服务器发出去的东西和家庭版中转服务一样。
- 真的 Apple：StoreKit 2 真交易的 JWS（测试用的是自己造的同样形状的证书链；正式的根证书指纹来自 Apple 公布的列表，但没拿真交易验过）、真的 Sign in with Apple 身份令牌和撤销接口、服务器通知 V2 真的送到。第一次在 TestFlight 上买沙盒订阅时看 `npx wrangler tail`。
- 真的 Resend 发信和到达率（要先验证域名）。
- Cloudflare 线上：几分钟长的 WebSocket 转发（本机只跑过几秒到十几秒的）、CPU 上限、Rate Limiting 绑定在线上的行为、远离 D1 主库的用户的延迟、定时任务。
- iPhone 的 WKWebView 从 `echoisland://localhost` 发 `fetch` 时 `Origin` 头是不是这个值（不是的话改 `ALLOWED_ORIGINS`；原生代码发的请求不受 CORS 影响）。
- 证书吊销（OCSP）不查。
