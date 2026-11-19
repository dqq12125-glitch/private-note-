-- 回声岛公开版服务器 · D1 表结构（第一版）
-- 原则：只存必要的。没有生日（只有年龄段）、没有聊天记录（只有孩子按了「举报」的那一段，90 天后删）、
-- 登录码 / 会话 / 家长同意链接都只存哈希；IP 和邮箱在限流表里也只存带密钥的哈希。
-- 时间都是毫秒（Date.now()）；day 是用户那个时区的本地日期 'YYYY-MM-DD'。

-- 账号
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- 'u_' + 随机
  email TEXT UNIQUE,                   -- 小写；只用 Apple 登录又没给邮箱时是 NULL
  apple_sub TEXT UNIQUE,               -- Sign in with Apple 的用户 id
  apple_refresh TEXT,                  -- Apple 的 refresh token（AES-GCM 加密；没配 DATA_KEY 就不存），删号时撤销用
  age_group TEXT,                      -- 'child' < 13 / 'teen' 13–17 / 'adult' / NULL 还没问
  ui TEXT,                             -- 界面语言 'zh' / 'en'
  level INTEGER,                       -- 能力级别 0–5
  tz_min INTEGER NOT NULL DEFAULT 0,   -- 设备报的时区（UTC 往东几分钟），决定每天几点重置用量
  tz_at INTEGER NOT NULL DEFAULT 0,    -- 上次改时区的时间（7 天内只认一次）
  iap_token TEXT NOT NULL UNIQUE,      -- 买订阅时的 appAccountToken（UUID）
  created_at INTEGER NOT NULL
);

-- 登录会话：只存 token 的 SHA-256
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- 'email' / 'apple'
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL          -- 每用一天往后推（最多一天写一次）
);
CREATE INDEX sessions_user ON sessions(user_id);

-- 邮箱登录码：一个邮箱同时只有一个有效的码
CREATE TABLE email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,             -- HMAC(AUTH_PEPPER, 邮箱 + 码)
  tries INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

-- 用过的 Sign in with Apple nonce（防止同一个身份令牌被重放）
CREATE TABLE apple_nonces (
  hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- 家长同意（只给 child 账号）。state: pending / granted / revoked
CREATE TABLE consents (
  user_id TEXT PRIMARY KEY,
  parent_email TEXT NOT NULL,
  state TEXT NOT NULL,
  token_hash TEXT UNIQUE,              -- 同意链接的 SHA-256（7 天有效）
  revoke_hash TEXT UNIQUE,             -- 撤回链接的 SHA-256
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  granted_at INTEGER,
  revoked_at INTEGER
);

-- 每人每天的用量
CREATE TABLE usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  talk_sec REAL NOT NULL DEFAULT 0,    -- 实时语音聊天的秒数（墙钟）
  asr_n INTEGER NOT NULL DEFAULT 0,    -- 识别片段
  aux_n INTEGER NOT NULL DEFAULT 0,    -- 点评 / 合成 / 翻译 / 打勾 / 检测判分
  PRIMARY KEY (user_id, day)
) WITHOUT ROWID;

-- 正在进行的实时聊天：开聊时插一行（同一个人同时只许一段），每 20 秒写一次进度，结束时并进 usage。
-- Worker 被系统停掉时这一行不会被删：心跳超过 TALK_STALE_SEC 没更新的，按最后一次进度记账后删掉
CREATE TABLE talk_live (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  beat_at INTEGER NOT NULL,
  sec REAL NOT NULL DEFAULT 0
);
CREATE INDEX talk_live_user ON talk_live(user_id);

-- 订阅（App Store）：一行一个 originalTransactionId，重复送来也只是更新这一行
CREATE TABLE entitlements (
  otid TEXT PRIMARY KEY,               -- originalTransactionId
  user_id TEXT,                        -- 还没人认领（先到了通知、App 还没送交易）时是 NULL
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL,                  -- 'monthly' / 'yearly'
  state TEXT NOT NULL,                 -- active / grace / expired / revoked
  expires_at INTEGER,
  grace_until INTEGER,
  revoked_at INTEGER,
  env TEXT NOT NULL,                   -- 'Production' / 'Sandbox'
  app_token TEXT,                      -- 交易里的 appAccountToken
  signed_at INTEGER NOT NULL,          -- 最新那份签名数据的时间：只接受不比它旧的（通知可能乱序）
  updated_at INTEGER NOT NULL
);
CREATE INDEX entitlements_user ON entitlements(user_id);

-- 处理过的 App Store 通知（去重）
CREATE TABLE iap_notes (
  uuid TEXT PRIMARY KEY,
  type TEXT,
  at INTEGER NOT NULL
);

-- 孩子按了「举报」的那一段对话（只留 REPORT_DAYS 天，默认 90）
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  age_group TEXT,
  npc TEXT,
  quest TEXT,
  reason TEXT NOT NULL,
  note TEXT,
  turns TEXT NOT NULL,                 -- JSON：最后几句 [{who, text}]
  created_at INTEGER NOT NULL
);
CREATE INDEX reports_at ON reports(created_at);
CREATE INDEX reports_user ON reports(user_id);

-- 限流计数（固定窗口）。k 是带密钥的哈希，不存原始 IP / 邮箱
CREATE TABLE rl (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  exp INTEGER NOT NULL
) WITHOUT ROWID;
