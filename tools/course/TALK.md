# 别的语言的课：和岛民用这门语言聊天（AI 语音）

老板 2026-11-21：「把那些 AI 聊天做好，其他语言的。」这份是合同：服务器 / 聊天核心一边、游戏界面一边，照它各做各的，最后对得上。
英语课的聊天**一个字都不能变**（提示词、音色、判分、界面、测试）。别的课原来是关着的（`tools/course/ENGINE.md` §5「先关掉的」），这一轮打开：

- **做**：聊天页里这门课的单元角色（每门语言现在 8 个，`tools/course/<语言>/units/*.json` 的 `talk`）；大地图上和面前的人自由聊天（`npc=dyn`）；点气泡看意思、💡 帮帮我、小步骤打勾、评语和「更好的说法」、学习锁里聊天那一项、每日任务。
- **这一轮不做**：支线委托（17 条的内容还只有英语）、今日目击、AI 发音点评（`/tip`）。它们照旧关着。

## 0. 已经实测过的（2026-11-21，真的阿里云，`qwen3.8-omni-flash-realtime`）

- 模型能用西语、日语、中文对话，听学习者说的话不用指定语言（`input_audio_transcription` 不带 language 就行，和英语一样）。
- **音色要换**：英语的 Jennifer 说西语走样（本机识别工具听不出是西语）。这个模型认的音色里：
  - 西语：`Sonrisa`（女，拉美西语）、`Bodega`（男）——说出来的西语本机识别一字不差；
  - 日语：`Ono Anna`（女）；男声没有日语母语的，`Ryan` 说日语听写一字不差，先用它；
  - 中文：`Serena`、`Maia`、`Momo`（女）、`Ryan`（男）是标准普通话；`Dylan` `Sunny` `Li` `Marcus` `Peter` `Rocky` `Kiki` `Eric` 是方言口音，不用。
  - `Cherry`、`Ethan` 这个模型**不认**（合成模型才有）。音色名写错时 `session.update` 不报错，要到出声音那一步才报。
- 服务器固定在东京机房跑（`cloud/wrangler.toml` 的 `[placement]`），不然连阿里云很慢。

## 1. 角色从哪来：`talk-courses.js`（生成的）

手机只发角色 id，人设由服务器拼（和英语一样，手机发来的人设一律不理）。所以服务器要自己有一份别的语言的角色表。

- `node tools/course/build.js --talk` 读三门语言的源文件，写仓库根目录的 `talk-courses.js`（进仓库，和 `talk-npcs.js` 一样的写法：浏览器里 `window.TALK_COURSES`、Node 里 `module.exports`，能被 esbuild 当 CommonJS 打包，加载时不碰 DOM）。`--talk --check` 只核对是不是最新的（不是最新退出码 1）。平常 `node tools/course/build.js <语言>` 生成 course.json 时也顺手核对，不是最新就提醒一句。
- 形状：`{ langs: ['es','ja','zh'], list: [角色…], byId: { id: 角色 } }`。角色 = course.json 里 `TALK` 的那一条**原样**（`id` `book` `unit` `name` `zh` `gender` `kid` `topic…` `persona` `opener` `words…` `goals`），外加 `lang: 'es' | 'ja' | 'zh'`。id 形如 `es1-u1`，和英语角色的 id 不会重。
- 游戏界面照旧用课程包 course.json 里的 `TALK`（显示名字、目标、词卡），不加载 `talk-courses.js`。两份是同一个源文件生成的，测试核对 id 和 `goals` 的个数对得上。
- 中转服务 `server/relay.js`、公开版服务器 `cloud/` 都要带上它（`cloud/src/shared.js` import、relay `require`；relay 的静态文件白名单、cloud 的打包要过）。

## 2. 聊天核心 `talk-core.js`

角色对象上的 `lang` 决定一切；没有 `lang`（英语的角色、委托、老的 `dyn`）= 每个函数的结果和现在**一字不差**。

```
TalkCore.LANGS            { es: { en: 'Spanish', … }, ja: { en: 'Japanese', … }, zh: { en: 'Mandarin Chinese', … } }
TalkCore.langOk(v)        'es' | 'ja' | 'zh' | ''          认得的语言代码，别的一概 ''
TalkCore.voiceOf(name, g, kid, lang)          按语言的音色表挑（§0）；没有 lang 和现在一样
TalkCore.instructions(npc, player, o)         npc.lang 有：见下面
TalkCore.isLine(text, level, lang)            一句算不算「开口说的这门语言的句子」
TalkCore.voiceLines(turns, level, lang)
TalkCore.judge(g, turns, ev, live, level, lang)
TalkCore.evalBody(npc, turns, o) / parseEval  npc.lang 有：评的是这门语言
TalkCore.stepsBody(npc, gi, turns, ui)        npc.lang 有：步骤的示范句是这门语言
TalkCore.zhBody(text, o)                      o = { lang, ui }：把这门语言的一句话翻成界面语言（zh → 中文，en → 英文）；不给 o 和现在一样
TalkCore.personNpc(d)                         d.lang 有：路人也说这门语言
TalkCore.worried(turns)                       加西语、日语、中文的明确说法（哪门课都查全部）
```

**`instructions()` 在 `npc.lang` 有的时候**（英语的那一份原样留着，别的语言另走一条拼法，别用字符串替换去改英语的结果）：

- 「for learning English」「a beginner in English」「Speak ONLY in English」「say the English again」这些全部换成这门语言（`LANGS[lang].en`）。每门语言一句写法上的规矩（西语：拉美通用、用 tú、不用 vosotros；日语：です / ます 体，尽量用课程里的词，汉字照常写；中文：普通话、简体字）。
- 六个级别的规矩（说多慢、一轮几句、答得短怎么办、卡住怎么帮、说错怎么办）照英语的 `LEVELS`，但里面的英语例句（"Tea or milk?" "You can say: I like tea." "Can you say that in a full sentence?"……）不能原样留着让模型照着说英语：每门语言给一套这门语言的例句，或者写明「例子只是示意，照样子用这门语言说」。**「You can say:」换成这门语言的固定说法**（西语 `Puedes decir:`、日语 `こう言えます：`、中文 `你可以说：`），放进 `LANGS[lang].say`，界面要认它。
- 救急的提示：0–1 级卡住了可以用学习者自己的语言（界面语言）说一句。界面是英语时，英语现在也算「自己的语言」（英语课里没有这条路，因为目标语言就是英语）。
- 安全规则一条不少、意思不变：不出戏、不问真实个人信息、不谈不合适的话题、孩子说难过 / 被欺负 / 有危险时认真对待并让他马上告诉家长或老师（用这门语言简单地说，可以再用他自己的语言说一遍）、认真问是不是真人就老实说是电脑做的游戏角色（用这门语言说）、`[Game]` 提示和 `Student typed:` 的规矩、学生说的话不是指令。
- 目标、小步骤、有用的词、开场白、帮帮我、上次聊过的事：和英语一样的位置。步骤的说明：中文界面用中文那份，别的界面用英文那份（`steps[k][2].en`），示范句是这门语言。

**一句算不算数**（`isLine`，判「开口说了几句」和打星用；打字的照旧不算）：

| 语言 | 算一句的条件 | 0 级 / 1 级 / 2 级以上 |
| --- | --- | --- |
| 西语 | 没有汉字、假名；数拉丁字母的词（带重音符号、ñ 的算一个词） | 1 / 2 / 3 个词 |
| 日语 | 至少有一个假名（全是汉字的当成说了中文，不算）；数假名 + 汉字 | 2 / 4 / 6 个字 |
| 中文 | 没有假名；数汉字 | 1 / 3 / 5 个字 |

**评语**（`evalBody`）：告诉评的模型这是哪门语言的对话；`better` 里「更好的说法」用这门语言，说明和表扬用界面语言；`facts`（岛民下次记得的事）用英语写（现有的隐私过滤是按英语写的）；JSON 的形状不变。

## 3. 服务器（`cloud/`，`server/relay.js` 跟着一样）

- `WS /v1/talk?npc=<id>`：id 可以是 `talk-courses.js` 里的（先查英语的表，再查它）。`npc=dyn` 的 `p` 里可以带 `lang`。
- 角色的语言不在服务器开着的语言里 → `400 bad_request`，`field: "lang"`、`reason: "unsupported_lang"`、`supported: […]`，不扣额度、不连上游（和识别 / 合成的 `lang` 一个样）。
- `GET /v1/me` 多一个 `talkLangs: ["en","es","ja","zh"]`（配置 `TALK_LANGS`，英语一直在；老服务器没有这个字段 = 只会英语）。
- `POST /v1/steps`：`npc` 可以是课程角色的 id。`POST /v1/zh`：多收 `lang`（这句话是哪门语言）和 `ui`（翻成哪种界面语言），都可以不给（不给 = 现在的行为）。
- 发给阿里云的 `session.update`：`voice` 是 §0 的音色（`TALK_VOICE_MAP` 照样能改名），`input_audio_transcription` 不变。
- 额度、限流、家长同意、举报、一个账号同时一段：全部照旧，不分语言。
- `cloud/API.md`、`cloud/README.md`、测试（`cloud/test/`、`tests/cloud.test.js` 的逐字比对、`tests/talk.test.js`）跟着改。**不部署**（主会话实测以后部署）。

## 4. 游戏界面（`talk.js`、`game.js`、`world.js`、`account.js`、字表）

- 别的课里聊天什么时候开：服务器说它会（云端模式：`GET /v1/me` 的 `talkLangs` 里有这门语言，`account.js` 给 `EchoAccount.talkLang(lang)`；网页版的中转服务：`GET /health` 回的 JSON 里 `talkLangs` 有它——中转服务这一轮一起加）。不会（老服务器、APK 直连）→ 照旧写「这门语言的 AI 聊天还在做」，学习锁里聊天那一项照旧整天免。
- 开着的时候：聊天页列这门课的角色（`TALK_NPCS` 已经换成课程的）；目标、小步骤、词卡的意思按界面语言（中文 / 英文那份）；示范句、词、岛民的开场白带读音（日语、中文，`EchoGame.ruby`；岛民现场说的话没有读音，不硬加）。
- 「已开口说 n/6 句」「说满 6 句」用 `TalkCore.isLine(text, level, lang)`；别的地方凡是写着「英语」的句子用字表的 `.c` 写法（`{lang}`）。
- 点气泡看意思：中文界面翻成中文，英语界面翻成英文（英语课的英语界面照旧没有这个按钮）。请求里带 `lang` 和 `ui`。
- 帮帮我给的那句以 `TalkCore.LANGS[lang].say` 开头（界面要是对「You can say:」做了什么，这里跟着认）。
- 评语里「更好的说法」：西语、中文照英语课那样第二天进复习（没有课程条目的句子按这门语言的规则打分）；**日语先不进复习**（没有读音的句子打不了分），只在评语里显示。
- 大地图上「英语聊天」那个按钮：别的课里显示这门语言的名字，点了是 `npc=dyn`、`p` 里带 `lang`；委托的「?」照旧不出现。
- 学习锁：聊天开着时，聊天那一项和英语课一样要做（做一个小目标，或者用语音说满 6 句）；每日任务里「和岛民聊天」照样出现。聊天记录、岛民记得的事按课分开存（跟着这门课的存档走）。
- 岛民的安全标记（`concern`）、家长看全文、举报按钮、AI 生成的标识、每天第一次的提示：一样都不能少。
- 测试用假的 AI（现有 `tests/talk.test.js` 的假中转、`tests/account.test.js` 的本机 Worker + 假上游，挑合适的）：三门语言各走一遍 打开 → 岛民开口 → 说几句（假识别结果）→ 打勾 → 结束 → 评语；数句子的规则；老服务器时还是「还在做」；英语课一切照旧。**不许调真的 AI。**

## 5. 分工和规矩

- 服务器这一边改：`talk-core.js`、`tools/course/build.js`（`--talk`）、`talk-courses.js`（生成）、`cloud/src/**`、`cloud/API.md`、`cloud/README.md`、`cloud/test/**`、`server/relay.js`、`server/README.md`、`tests/talk.test.js`、`tests/cloud.test.js`、`tests/course-build.test.js`。
- 界面这一边改：`talk.js`、`game.js`、`world.js`、`account.js`、`style.css`、`index.html`（只在必要时）、`tests/course-talk.test.js`（新）、`tests/course.test.js`、`tests/i18n.test.js`（只在必要时）、`tools/test-all.js` / `package.json`（登记新测试）、`tools/course/ENGINE.md`、`CLAUDE.md`。
- **`talk-core.js` 只有服务器这一边能改**；界面这一边照 §2 的写法调用，那边还没写好的函数先用 `typeof` 兜住，等它写好再对。发现合同不够用：在这份文件末尾「改动记录」里写一条（谁、改了什么、为什么），别各改各的。
- 都不做任何改动 git 的事；不安装、不下载、不联网；不调真的 AI；不部署；不读钥匙文件和 `ios/Generated/`、`android/echo.properties`；临时文件放自己的 scratchpad 子目录。

## 改动记录

（合同有改动写在这里）

- **2026-11-21 · 服务器 / 聊天核心这一边**（`talk-core.js`、`cloud/`、`server/relay.js` 做完时写的；§2 §3 没写到、或者做出来和写的不完全一样的地方）：
  1. `TalkCore.goalOf()`：课程角色的步骤是 `[中文, 示范句, { en }]`，`goalOf` 给出来的每一步是 `{ zh 中文说明, en 这门语言的示范句, task 英文说明 }`（字段名照旧，`en` 放的是示范句）。原来第 3 项是对象时 `task` 会变成 `[object Object]`。
  2. `TalkCore.parseEval(j, ui, lang)` 多一个 `lang`：老的比法只看英文字母，日语、中文的「更好的说法」会全被当成「没改」丢掉。自己解析评语的地方（直连）要把角色的 `lang` 传进去；走服务器的不用管。日语、中文只有一字没改的才丢（句尾补「です」「了」算改错），西语照英语的规矩。
  3. `TalkCore.memOf(m, lang)` 多一个 `lang`：`facts` 照旧只留英文写的；`better`（改过的那句）是这门语言的句子，按这门语言再筛一遍名字 / 住址 / 电话。`session()` 和两个服务器已经带上了。
  4. 多导出的：`lineUnits(句子, lang)`（这句有几个词 / 字，`isLine` 用的同一个数法）、`cleanText(v, n)`（留这几门语言标点的清洗）、`voiceFor(角色)`、`levelRules(level, ui, lang)`。课程角色**没有 `voice` 字段**，`session()` 用 `voiceFor()`：自己写了的用自己的，没写的按名字、性别、语言挑。
  5. `instructions()` 别的语言那条路：没给级别 = 用初中级（2）那几条、学习者说成「入门到初中级」（英语没给级别时也是这个意思）；没给 `ui` = 中文；**中文课 + 中文界面**自己的语言就是在学的语言，没有「用自己的语言提示一句」这条路。比英语多一条规矩：「你是有任务的游戏角色，不是学生的伙伴 / 知己」（英语只有委托有这句）。支线委托这条路不管（这一轮不做）。
  6. `personNpc(d)` 带 `d.lang` 时：`role / island / place` 还是用英文写（拼进给 AI 的英文人设），`lines`（说过的话）、`words` 是这门语言的，`name` 可以是这门语言的写法；目标的英文那句会写明「in Spanish」，中文那句用字表的 `tc.p.goal.c`（「用{lang}随便聊聊」）。
  7. `zhBody(text, { lang, ui })`：没有可翻的（英语课 + `ui: 'en'`、中文课 + `ui: 'zh'`）返回 `null`，服务器回 400 `field: "ui"`。翻成英文的提示词也是用中文写的。
  8. `/v1/steps`（中转服务的 `/steps` 一样）：`npc: "dyn"` 时多收一个 `lang`（不然地图上的人的步骤示范句还是英语的那一套）。
  9. 不支持的语言不只 `/v1/talk`：`/v1/steps`、`/v1/zh` 也是 400（`field: "lang"`、`reason: "unsupported_lang"`、`supported`）。`dyn` 的 `p.lang` 写了不认得的东西（`fr`、大小写不对、不是字符串）也是 400，不悄悄当成英语；`"en"` / 不写 = 英语。
  10. 中转服务出错的样子（它本来就和 cloud 不一样）：`/talk` 发 `{"type":"error","code":"lang","zh":"这里还不会用这门语言聊天"}` 后断开；`/steps`、`/zh` 回 400 `{"error":"lang"}`（没有可翻的是 `{"error":"ui"}`）。`/health` 多了 `talkLangs`，配置 `TALK_LANGS`。
  11. 写测试的假 AI 怎么认是哪种请求（现有的假上游照旧能用）：打勾的系统提示都含「打勾」；看意思的都含「翻译」；评语——英语课中文界面含「打分」，英语课英语界面和**别的语言的课（不分界面）**含 `gentle, encouraging feedback` 和 `praise in `。先认「打勾」「翻译」再认评语就不会混。
  12. 现场合成（`/v1/tts`）别的语言的默认音色换成了和聊天同名的（主会话追加的）：西语 Sonrisa / Bodega、日语 Ono Anna / Ryan、中文 Serena / Ryan（`cloud/src/config.js` 的 `DEF_TTS_VOICES`、`server/relay.js`）。`talk.js` 里 APK 直连用的 `TTS_V`（Cherry / Ethan）是界面那一边的文件，没动。
- **2026-11-21 · 游戏界面这一边**（`talk.js`、`game.js`、`world.js`、`account.js`、`tests/course-talk.test.js` 做完时写的；§4 没写到、或者做出来和写的不完全一样的地方）：
  1. **开关**：`EchoTalk.langOk()`（game.js 的 `talkLang()` 问它）= 服务器会（§4 那两条）**而且**打包进来的 talk-core.js 认这门语言（`TalkCore.langOk`）。后一条只是兜底——核心和界面是一起发的。
  2. **云端模式没登录**：`GET /v1/me` 要登录才问得到，没登录 = 不知道服务器会不会 → 照「这门语言的 AI 聊天还在做」算（学习锁按 `lang` 整天免，不是英语课的 `nosign`；每日任务没有聊天）。登录以后就开。想让没登录的人也看到聊天页（像英语课那样先请他登录），得有一个不用登录也问得到的地方（比如 `/v1/health` 也回 `talkLangs`）——没做，等定。
  3. **网页版问 `/health`**：每次打开游戏、换了服务地址、重新连上网问一次，结果按服务地址记在 `localStorage['echo-talk-langs']`（`{ u, l }`）。第一次打开时还没问到：学习锁先按 `lang` 免，问到会聊以后这次免的不算数（`gateEx === 'lang'` 删掉）；今天的每日任务要是已经排好了，把最后一个还没动过的换成「和岛民聊天」（只有别的课这样补，英语课不动）。
  4. **读音**：course.json 的 `TALK` 里开场白、示范句、词都没带读音（源文件只有 `opener.r`，是整句的），`E.ruby` 只认条目表里有的整句。界面用 game.js 新加的 `rubyLine()`：条目表里有就照条目标；没有就拿课程里写过读音的词块去对——只认课程里只有一种读法的写法，日语一串汉字要整串对上、前面带 お / ご 的连着对上，对不上的字不标。**已知的不足**：中文里课程没教过的多音字可能标成课程里的那个读法（量很小）。`build.js` 以后要是给 `TALK` 的 opener / steps / words 带上 `seg` / `r`，这里改成直接照它标就行。开场白只有岛民一字不差照着剧本说出来才标，现场说的话不标。
  5. **帮帮我**：界面原来就没有对「You can say:」做任何处理，所以 `LANGS[lang].say` 界面没用到（测试核对了岛民那句以它开头）。
  6. **打勾的请求**：别的课一律带 `lang`（课程角色也带；服务器对课程角色按 id 查的为准，`dyn` 靠它——和上面第 8 条对上了）。
  7. **大地图上的人**（`npc=dyn`）：`name` 用这门课的名字牌写法（没翻就是英文名），`island` 用小镇地图的英文名（`w.en` 是这门语言的岛名），`lines` 是台词翻译表里这门语言的那一句（没翻的不带；一句都没有就用这座岛课程里的前三句），`words` 是课程里的词。界面上目标那一句用自己的字表（`tk.dyn.goal`，两种界面语言都有），没用 `goalZh`。talk-core 拼出来的人不是这门语言（`base.lang` 对不上）时不显示示范句。
  8. **「更好的说法」进复习**：第二个参数（意思）照英语课的做法——中文界面存评语里那句解释，英语界面不存。日语不进（评语页那一栏的标题换成不说「明天复习」的 `tk.r.tips.only`）。
  9. **服务器连接时才说不会**（中转服务 `code: "lang"`、cloud `reason: "unsupported_lang"`）：状态行写「还在做」，不记成聊天连不上（不写 `chatErr`、不亮首页红条）；网页版把记着的结果改掉、重新问一次，云端模式刷新一次账号。
  10. **字表**：`.c` 写法是别的课一律用的（不看聊天开没开），所以服务器不会的时候也有几句跟着从「英语」变成了这门语言的名字：设置里学习锁的说明（`g.set.gate.d`）、日报里「用语音说了 n 句英语」（`g.push.l.chat`）、周报「看中文 n 次」→「看意思」（`g.rp.hb.look`）、家长粘贴密钥那句不再说能聊天（`g.set.ai.off.d`）、向导那句不写是哪门语言（`ac.su.p1`）。别的行为（「还在做」、整天免、没有任务）没变。周报 / 日报里「每句 n 个词」「最长一句 n 个词」日语、中文写成「字」（`.ch`）。
  11. **没动的**：`talk.js` 里 APK 直连现场合成用的 `TTS_V`（Cherry / Ethan，见上面第 12 条）——不是聊天，这一轮没碰；APK 直连的聊天照合同是「不会」。
