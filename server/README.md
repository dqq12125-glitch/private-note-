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
| `TTS_VOICES` | 西语 / 日语 / 中文都是 `Cherry`（女）/ `Ethan`（男） | 别的语言的课现场合成（`/tts` 带 `lang`）用的音色，`{"es":{"f":"…","m":"…"}}`；英语照旧 Jennifer / Aiden。默认值要对着阿里云的音色表核对 |
| `ASR_URL` / `TTS_URL` / `ASR_RT_URL` | 阿里云的地址 | 只给测试指到假的上游（`cloud/test/t-05-relay.js`），平时不用设 |

口语题的识别（`/asr`、`/asr-rt?lang=`）和现场合成（`/tts`）可以带 `lang`：`es` / `ja` / `zh`（别的语言的课；`/tts` 也认 `Spanish` 这种写法），
没带就是英语，发给阿里云的和以前一字不差；不认得的 `/asr`、`/tts` 回 400 `lang`，`/asr-rt` 直接断开。和公开版服务器 `cloud/` 同一套（`cloud/API.md` §8）。

## 放到服务器上给手机用

手机上的游戏是 HTTPS（GitHub Pages），所以服务也必须是 `wss://`（有证书的域名），而且在国内能访问：

1. 国内云服务器（例如阿里云轻量应用服务器）装 Node 20+，拷 `server/` 和 `talk-npcs.js`、`talk-core.js`、`quests.js`（保持相对位置：`server/relay.js` 读 `../talk-npcs.js`、`../talk-core.js`、`../quests.js`——大地图上的支线委托也是手机只发 id、人设在服务器这边读）。能力检测的口语问答题（`/place`）还要 `placement-data.js`（题库：手机只发题目的 id，评分要点在服务器这边查；没有这个文件时 `/place` 回 400，检测会把口语记成「未测」）。
2. 设好 `DASHSCOPE_API_KEY`、`ACCESS_CODE`、`ADMIN_TOKEN`，用 pm2 / systemd 常驻。
3. 用 Caddy 或 Nginx 反向代理到 8787 并自动申请证书（WebSocket 要开 Upgrade）。
4. 手机上：游戏首页「和岛民聊天」→「设置服务」填 `wss://你的域名`，再填家庭口令。

## 对话记录

每段对话结束写一行到 `server/logs/日期.jsonl`（孩子说的、岛民说的、评价），`/logs` 页面按天查看。游戏里「聊天记录」按钮只看这台设备上最近 30 次。
