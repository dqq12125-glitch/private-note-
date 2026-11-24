# 回声岛 AI 语音对话中转服务

孩子的浏览器 ⇄ 这个服务（WebSocket `/talk`）⇄ 阿里云百炼 Qwen-Omni 实时语音（`qwen3.8-omni-flash-realtime`）。

为什么要中转：网页在 GitHub Pages 上是公开的，密钥不能放进网页；浏览器的 WebSocket 也带不了鉴权头。人设、音色、安全规则都在服务器这边按 NPC 的 id 读 `../talk-npcs.js`，孩子的手机只能选岛民、送声音和文字。

## 本机试用

```bash
cd server
npm install
KEY_FILE=D:/path/to/.env node relay.js    # 或者把 DASHSCOPE_API_KEY=... 写进 server/.env（不进仓库）
```

游戏在本机打开（`http://localhost:8765`）时会自动连 `ws://localhost:8787`。首页第三个标签「和岛民聊天」。

## 配置（环境变量，或写在 server/.env）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | 必填 | 百炼 API Key（北京区）。建议给游戏单独建一把 |
| `PORT` | 8787 | |
| `TALK_MODEL` | qwen3.8-omni-flash-realtime | 实时语音模型 |
| `EVAL_MODEL` | qwen-plus | 聊完打分用的文字模型 |
| `DAILY_MIN` | 30 | 每台设备每天最多聊几分钟 |
| `SESSION_MIN` | 8 | 每段对话最多几分钟 |
| `MAX_LIVE` | 4 | 同时最多几段对话 |
| `ACCESS_CODE` | 空 | 家庭口令；设了以后要在游戏「设置服务」里填同样的口令，防止别人用你的额度 |
| `ADMIN_TOKEN` | 空 | 看对话记录 `/logs?token=...`；没设只允许本机打开 `http://localhost:8787/logs` |
| `ALLOWED_ORIGINS` | 本机、GitHub Pages、*.ts.net | 允许哪些网页连 |
| `TTS_VOICES` | 西语 `Sonrisa` / `Bodega`，日语 `Ono Anna` / `Ryan`，中文 `Serena` / `Ryan`（女 / 男） | 别的语言的课现场合成（`/tts` 带 `lang`）用的音色，`{"es":{"f":"…","m":"…"}}`；英语照旧 Jennifer / Aiden。默认是说这门语言地道的那几个，2026-11-21 对着真的阿里云实测过 |
| `TALK_LANGS` | `en,es,ja,zh` | 和岛民聊天会用哪些语言（别的语言的课，见下面）。只认 `talk-core.js` 认得的，英语一直在；`/health` 的 `talkLangs` 就是它 |
| `QUEST_LANGS` | 和 `TALK_LANGS` 一样 | 别的语言的课里的支线委托会用哪些语言。还要 `TALK_LANGS` 里开着、这里真有这门语言的委托译文（`../talk-courses.js` 的 `quests`）才算，英语一直在；`/health` 的 `questLangs` 就是它 |
| `TIP_LANGS` | 和 `TALK_LANGS` 一样 | AI 发音点评（`/tip` 的 `lang`）会用哪些语言。只认 `talk-core.js` 认得的，英语一直在；`/health` 的 `tipLangs` 就是它 |
| `GEN_LANGS` | 和 `TALK_LANGS` 一样 | 「为你出的题」（`/gen` 的 `lang`）会用哪些语言。只认 `talk-core.js` 认得的，英语一直在；`/health` 的 `genLangs` 就是它。老的中转服务没有这个字段 = 不会出题 |
| `ASR_URL` / `TTS_URL` / `ASR_RT_URL` | 阿里云的地址 | 只给测试指到假的上游（`cloud/test/t-05-relay.js`），平时不用设 |
| `TEST_HOOKS` / `TEST_QUESTS` | 空 | 只给测试用：`TEST_HOOKS=1` 时把 `TEST_QUESTS`（JSON，形状和 `talk-courses.js` 的 `quests` 一样）并到委托的译文上，测试不用等正式的译文（`cloud/test/quests-sample.cjs` 是现成的小样）。平时不用设 |

口语题的识别（`/asr`、`/asr-rt?lang=`）和现场合成（`/tts`）可以带 `lang`：`es` / `ja` / `zh`（别的语言的课；`/tts` 也认 `Spanish` 这种写法），
没带就是英语，发给阿里云的和以前一字不差；不认得的 `/asr`、`/tts` 回 400 `lang`，`/asr-rt` 直接断开。和公开版服务器 `cloud/` 同一套（`cloud/API.md` §8）。

**别的语言的课和岛民聊天**（西语 / 日语 / 中文，2026-11-21，合同 `tools/course/TALK.md`；和 `cloud/` 同一套，`cloud/API.md` §8「Chat language」）：

- `/talk?npc=<id>`：id 可以是 `../talk-courses.js` 里的课程角色（形如 `es1-u1`；先查英语的 `talk-npcs.js`，再查它）。`npc=dyn` 的 `p` 里可以带 `lang`（`es` / `ja` / `zh`）。
  手机照旧只发 id，人设、这门语言的规矩和例句、音色（西语 Sonrisa / Bodega，日语 Ono Anna / Ryan，中文 Serena · Maia · Momo / Ryan）都由 `talk-core.js` 按角色的 `lang` 拼。
- 这门语言这里没开（`TALK_LANGS`）、或者 `lang` 不认得：`/talk` 回 `{"type":"error","code":"lang"}` 后断开，不连阿里云、不算时长；`/steps`、`/zh` 回 400 `lang`。
- `/steps`：`npc` 可以是课程角色的 id；`npc=dyn` 时多带 `lang`。`/zh`：多收 `lang`（这句话是哪门语言）和 `ui`（翻成 `zh` 中文 / `en` 英文），都不带 = 以前的行为（英文 → 中文）；已经是那门语言了回 400 `ui`。
- `/health` 的 JSON 多一个 `talkLangs`（比如 `["en","es","ja","zh"]`）：游戏看它决定别的语言的课开不开聊天；老的中转服务没有这个字段 = 只会英语。
- 没有 lang 的（英语的岛民、课本角色、委托、老的 dyn）发给阿里云的和以前一字不差。

**别的语言的课里的支线委托、AI 发音点评**（第二轮，2026-11-21，合同 `tools/course/TALK.md` 末尾；和 `cloud/` 同一套，`cloud/API.md` §8「Quests and pronunciation tips in other languages」）：

- `/talk?quest=<id>&lang=<es|ja|zh>`：人设、事实、目标还是 `../quests.js` 的英文原文；开场白、每一步的示范句、有用的词、名字表用 `../talk-courses.js` 的 `quests[语言][id]`
  （`node tools/course/build.js --talk` 从 `tools/course/<语言>/quests.json` 生成——**翻译改了要重新生成，中转服务要带着新的 `talk-courses.js` 重启**）。规矩、音色由 `talk-core.js` 的 `questNpc(q, lang, loc)` 按这门语言拼。
  不带 `lang`（或者 `lang=en`）就是英语的委托，一字不差。`/steps` 带 `q` 时多收 `lang`，一个道理。
- `/tip` 多收 `lang`（这句话是哪门语言；日语、中文按读音比，点评用 `ui` 那门界面语言写）。不带就是英语的点评，一字不差。
- 这门语言这里不会（`QUEST_LANGS` / `TIP_LANGS`）、`lang` 不认得、这条委托没有这门语言的译文：`/talk` 回 `{"type":"error","code":"lang"}` 后断开，不连阿里云；`/steps`、`/tip` 回 400 `lang`。没有这条委托照旧是 `npc` 的错。
- `/health` 的 JSON 多两个：`questLangs`（会做委托的语言，只列真有译文的）、`tipLangs`（会点评的语言）。老的中转服务没有这两个字段 = 只有英语的。

**为你出的题**（2026-11-24，`talk-core.js` 的 `genIn` / `genBody` / `parseGen`；和 `cloud/` 同一套，`cloud/API.md` §8「Practice sentences」）：

- `POST /gen`，请求 `{ lang?, ui?, band?, n?, dlg?, focus, known?, avoid? }`：手机只发数据（要练的词、难度档、学过的词、上一轮的句子），提示词由 `genBody` 按洗过的数据拼，手机写不了。
  `focus` 必填（最多 8 个词、每个 ≤ 40 字；`known` 最多 50 个、`avoid` 最多 10 句；`band` 0–4、`n` 3–8、`dlg` 0–3，超出范围按默认）。
- 回 `{ "s": [{ t, m, f }], "d": [{ q, qm, a, am, x, xm, f }] }`，模型回的每一条都核对过（不是这门语言的、太长的、意思不是界面语言的、带不合适的词的不要）。
- `lang` 这里不会（`GEN_LANGS`）：400 `lang`；一个能用的要练的词都没有：400 `focus`；上游出错、或者核对完一句能用的都没有：502 `{"error":"upstream"}`。
- 出题要 4–10 秒：这一个调用的上游超时是 25 秒（别的是 12 秒）。
- `/health` 多 `genLangs`。

## 放到服务器上给手机用

手机上的游戏是 HTTPS（GitHub Pages），所以服务也必须是 `wss://`（有证书的域名），而且在国内能访问：

1. 国内云服务器（例如阿里云轻量应用服务器）装 Node 20+，拷 `server/` 和 `talk-npcs.js`、`talk-core.js`、`quests.js`（保持相对位置：`server/relay.js` 读 `../talk-npcs.js`、`../talk-core.js`、`../quests.js`——大地图上的支线委托也是手机只发 id、人设在服务器这边读）。`talk-core.js` 要的 `i18n.js` 也一起拷。别的语言的课要聊天还要 `talk-courses.js`（聊天角色表，`node tools/course/build.js --talk` 生成；没有这个文件时只有英语的角色，课程角色回「没有这个岛民」）。能力检测的口语问答题（`/place`）还要 `placement-data.js`（题库：手机只发题目的 id，评分要点在服务器这边查；没有这个文件时 `/place` 回 400，检测会把口语记成「未测」）。
2. 设好 `DASHSCOPE_API_KEY`、`ACCESS_CODE`、`ADMIN_TOKEN`，用 pm2 / systemd 常驻。
3. 用 Caddy 或 Nginx 反向代理到 8787 并自动申请证书（WebSocket 要开 Upgrade）。
4. 手机上：游戏首页「和岛民聊天」→「设置服务」填 `wss://你的域名`，再填家庭口令。

## 对话记录

每段对话结束写一行到 `server/logs/日期.jsonl`（孩子说的、岛民说的、评价），`/logs` 页面按天查看。游戏里「聊天记录」按钮只看这台设备上最近 30 次。
