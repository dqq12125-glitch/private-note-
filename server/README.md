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

## 放到服务器上给手机用

手机上的游戏是 HTTPS（GitHub Pages），所以服务也必须是 `wss://`（有证书的域名），而且在国内能访问：

1. 国内云服务器（例如阿里云轻量应用服务器）装 Node 20+，拷 `server/` 和 `talk-npcs.js`、`talk-core.js`、`quests.js`（保持相对位置：`server/relay.js` 读 `../talk-npcs.js`、`../talk-core.js`、`../quests.js`——大地图上的支线委托也是手机只发 id、人设在服务器这边读）。
2. 设好 `DASHSCOPE_API_KEY`、`ACCESS_CODE`、`ADMIN_TOKEN`，用 pm2 / systemd 常驻。
3. 用 Caddy 或 Nginx 反向代理到 8787 并自动申请证书（WebSocket 要开 Upgrade）。
4. 手机上：游戏首页「和岛民聊天」→「设置服务」填 `wss://你的域名`，再填家庭口令。

## 对话记录

每段对话结束写一行到 `server/logs/日期.jsonl`（孩子说的、岛民说的、评价），`/logs` 页面按天查看。游戏里「聊天记录」按钮只看这台设备上最近 30 次。
