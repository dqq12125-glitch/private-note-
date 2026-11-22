# Echo Island cloud API — v1

回声岛公开版服务器的接口合同（App 照这个写）。实现在 `cloud/src/`，部署和配置见 `cloud/README.md`。

This file is the contract the iPhone and Android apps code against. Paths, field names, status codes and
message types here are exact. Anything not written here is not part of the contract.

- Base URL: `https://<worker host>` (the owner picks the host; see README). Every path starts with `/v1/`.
- Bodies are JSON (`Content-Type: application/json`, UTF-8) unless stated. Field names are camelCase.
- Times: `...At` fields are ISO 8601 strings in UTC (`2026-11-19T13:00:00.000Z`); `...Sec` / `...Min` are numbers.
- Unknown request fields are ignored. Clients must ignore unknown response fields (we may add some).

## 1. Authentication

All endpoints except `auth/*`, `consent/c/*`, `consent/r/*`, `iap/apple/notifications`, `admin/*` and `health`
need a session:

```
Authorization: Bearer <token>
```

A token is an opaque string (`eis_` + 43 characters). It is long-lived: it stays valid for `SESSION_DAYS`
(default 180) days **after its last use** (each day of use pushes the expiry forward). There are no passwords
and no refresh tokens. A token stops working on sign-out, on account deletion, or after 180 unused days; the
app then gets `401 auth` and signs in again.

### WebSockets

The browser `WebSocket` API cannot set headers, so a WebSocket authenticates **one** of two ways:

1. **First message (recommended):** open the socket without a token and send, as the very first message,
   `{"type":"auth","token":"<token>"}`. The server waits up to 10 seconds for it; anything sent before it
   is dropped. Keeps the token out of URLs and logs.
2. **Query parameter:** `?token=<token>` on the URL. Accepted for simplicity; then do not send an `auth` message.

If the token is missing or wrong the server sends an `error` message and closes the socket (see §8).

## 2. Errors

Every error response has a JSON body:

```json
{ "error": "quota", "message": "Daily allowance used up", "...": "extra fields per error" }
```

| HTTP | `error` | When | Extra fields |
| --- | --- | --- | --- |
| 400 | `bad_request` | Missing or malformed field | `field` |
| 401 | `auth` | No token, unknown / expired / signed-out token; wrong or expired email code; bad Apple identity token | `reason`: `token` · `code` · `expired` · `apple` |
| 402 | `quota` | Today's allowance for this meter is used up | `meter`: `talk` · `asr` · `aux`; `limit`, `used`, `resetsAt` |
| 403 | `consent` | A voice-AI feature for an account that may not use it yet | `need`: `age` (age group not set) · `parent` (child without parent consent); `feature` |
| 404 | `not_found` | Unknown path or id | |
| 405 | `method` | Wrong HTTP method | |
| 409 | `conflict` | State conflict | `reason` (see each endpoint) |
| 413 | `too_large` | Body or message over the size limit | `limit` (bytes) |
| 429 | `rate` | Too many requests | `retryAfter` (seconds); header `Retry-After` |
| 500 | `server` | Bug on our side | |
| 503 | `provider` | The AI provider failed or timed out (the call is **not** counted) | `up`: provider error code, may be `""` |
| 503 | `unavailable` | A part of the server is not configured yet (e.g. email sending) | `what` |

Metered calls that fail with `503 provider` are refunded (not counted).

## 3. Accounts and sign-in

### `POST /v1/auth/email/start`

Request: `{ "email": "kid@example.com", "ui": "zh" }` (`ui` optional: language of the email, `zh` or `en`, default `en`).

Response `200`: `{ "ok": true, "expiresInSec": 600 }` — always the same answer whether or not the address
has an account. A 6-digit code is mailed; it is valid for 10 minutes and for 5 wrong tries.
Errors: `400 bad_request` (`field: "email"`), `429 rate` (per address and per IP), `503 unavailable` (`what: "email"`).

### `POST /v1/auth/email/verify`

Request: `{ "email": "kid@example.com", "code": "123456", "tzOffsetMin": 600, "ui": "zh" }`

- `tzOffsetMin` (optional, default 0): the device's offset from UTC in minutes, **east positive**
  (JavaScript: `-new Date().getTimezoneOffset()`; Swift: `TimeZone.current.secondsFromGMT() / 60`). See §6.
- `ui` (optional): stored as the interface language if the account has none.

Response `200` — the session:

```json
{ "token": "eis_…", "expiresAt": "2027-05-18T13:00:00.000Z", "created": true, "me": { …see §4… } }
```

`created` is `true` when this sign-in made a new account.
Errors: `401 auth` (`reason: "code"` wrong code, `reason: "expired"` no live code), `429 rate`.

### `POST /v1/auth/apple`

Sign in with Apple (iPhone). Request:

```json
{ "identityToken": "<JWT from ASAuthorizationAppleIDCredential>", "nonce": "<raw nonce>",
  "authorizationCode": "<optional, from the same credential>", "tzOffsetMin": 600, "ui": "en" }
```

- The app makes a random raw nonce (at least 16 characters), puts **SHA-256(raw nonce) as lowercase hex** into
  `ASAuthorizationAppleIDRequest.nonce`, and sends the **raw** nonce here. Each nonce works once.
- The server checks the token's signature against Apple's keys, `iss = https://appleid.apple.com`,
  `aud` = our bundle id, `exp`, and the nonce.
- `authorizationCode` lets the server revoke the Apple sign-in when the account is deleted (§4 `DELETE /v1/me`).
  Send it at sign-in when you have it.
- If Apple gives a verified e-mail that already belongs to an e-mail account, the Apple ID is linked to that account.

Response `200`: same shape as email verify. Errors: `401 auth` (`reason: "apple"`), `429 rate`, `503 unavailable` (`what: "apple"`, server not configured).

### `POST /v1/auth/signout`

Request: `{}` or `{ "all": true }` (sign out every device of this account). Response `200`: `{ "ok": true }`.

## 4. The account: `/v1/me`

### `GET /v1/me`

Response `200`:

```json
{
  "id": "u_8Xc…",
  "email": "kid@example.com",
  "apple": false,
  "ageGroup": "child",
  "ui": "zh",
  "level": 2,
  "tzOffsetMin": 600,
  "iapToken": "3f1d2c4e-…-…",
  "createdAt": "2026-11-19T13:00:00.000Z",
  "consent": {
    "required": true,
    "state": "pending",
    "parentEmail": "p***@example.com",
    "requestedAt": "2026-11-19T13:05:00.000Z",
    "grantedAt": null
  },
  "features": { "talk": false, "place": false, "steps": false },
  "speechLangs": ["en", "es", "ja", "zh"],
  "talkLangs": ["en", "es", "ja", "zh"],
  "questLangs": ["en", "es", "ja", "zh"],
  "tipLangs": ["en", "es", "ja", "zh"],
  "plan": "free",
  "subscription": { "state": "none", "plan": null, "productId": null, "expiresAt": null, "graceUntil": null, "environment": null },
  "quota": {
    "day": "2026-11-19",
    "tzOffsetMin": 600,
    "resetsAt": "2026-11-19T14:00:00.000Z",
    "talk": { "limitSec": 300, "usedSec": 0, "leftSec": 300 },
    "asr":  { "limit": 400, "used": 0, "left": 400 },
    "aux":  { "limit": 300, "used": 0, "left": 300 }
  }
}
```

- `email` is `null` for an Apple account without a shared e-mail. `apple` tells whether Sign in with Apple is linked.
- `ageGroup`: `"child"` (under 13), `"teen"` (13–17), `"adult"`, or `null` (not asked yet). No birth date is stored.
- `level`: placement level `0`–`5` or `null`. `ui`: `"zh"`, `"en"` or `null`.
- `iapToken`: a UUID. **Pass it as `appAccountToken` when buying** (StoreKit 2 `Product.PurchaseOption.appAccountToken`),
  so Apple's server notifications reach the right account.
- `consent.state`: `"none"` · `"pending"` (mail sent, parent has not agreed) · `"granted"` · `"revoked"`.
  `consent.required` is `true` when `ageGroup` is `"child"` or `null`.
- `features.<name>` is `true` when that voice-AI feature may be used now (see §5).
- `speechLangs`: the languages this server accepts as `lang` on `/v1/asr`, `/v1/asr-rt` and `/v1/tts` (§8), always starting
  with `"en"`. A server without this field (older version) only does English: the app must then not send `lang` and must not use
  server recognition / synthesis for other courses.
- `talkLangs`: the languages this server can hold a voice chat in (`WS /v1/talk`, §8 **Chat language**), always starting with
  `"en"` (server config `TALK_LANGS`). A server without this field (older version) only chats in English: the app must then keep
  chat switched off in other courses.
- `questLangs`: the languages in which this server can run side quests (`WS /v1/talk?quest=…&lang=…`, `POST /v1/steps` with
  `q` + `lang`; §8 **Quests and pronunciation tips in other languages**), always starting with `"en"`. A language is listed only
  when it is allowed by config (`QUEST_LANGS`, default: the same as `talkLangs`), is one of `talkLangs`, **and the server really
  has the quest translations for it** (`talk-courses.js` → `quests`). A server without this field only has the English quests:
  the app must then not offer quests in other courses.
- `tipLangs`: the languages `POST /v1/tip` can comment on (`lang`), always starting with `"en"` (server config `TIP_LANGS`,
  default: the same as `talkLangs`). A server without this field only comments on English.
- `plan`: the plan in effect now: `"free"`, `"monthly"` or `"yearly"`; `"tester"` for accounts listed in the server's `TESTERS` secret (our own test accounts: effectively unlimited — 1440 chat minutes a day and a million of each count — still counted; the app shows it like the free plan's name but with the server's numbers). `subscription`: see §7.
- `quota`: see §6.

### `PATCH /v1/me`

Request: any of `{ "ageGroup": "teen", "ui": "en", "level": 3, "tzOffsetMin": 660 }` (`level: null` clears it).
Response `200`: the new `me`.

- `ageGroup` may be set when it is `null`, and may always be **lowered** (adult → teen → child).
  Raising it from `"child"` is refused with `409 conflict`, `reason: "age_locked"`, unless a parent has consented.
  (A neutral age gate: a child cannot type a different age to get past it. To start over, delete the account.)
- `tzOffsetMin`: see §6 (a change may be ignored; the response shows the value in effect).

### `DELETE /v1/me`

Deletes the account and everything stored for it **immediately**: sessions, usage, consent records, reports,
entitlement records. Request body optional: `{ "appleAuthorizationCode": "<fresh code>" }` — if the account
uses Sign in with Apple, the server revokes the Apple tokens (with this fresh code, or with the token saved
at sign-in).

Response `200`: `{ "deleted": true, "apple": "revoked" }` — `apple` is `"none"` (not an Apple account),
`"revoked"`, `"skipped"` (revocation not configured on the server) or `"failed"`. The account is deleted in all cases.
An App Store subscription is **not** cancelled by this: the app must tell the user to cancel it in the
App Store settings.

## 5. Children and parent consent

Voice-AI features that send free speech to the AI are **consent-gated**: `talk` (`WS /v1/talk`),
`place` (`POST /v1/place`), `steps` (`POST /v1/steps`). (The list is server config `CONSENT_GATED`.)
They answer `403 consent` when

- `ageGroup` is `null` → `need: "age"` (ask the age group first, then `PATCH /v1/me`), or
- `ageGroup` is `"child"` and consent is not `"granted"` → `need: "parent"`.

Reading-aloud scoring (`asr`, `asr-rt`, `tip`), `tts` and `zh` are not gated (the recognised text is only
compared with the target sentence and nothing is kept).

### `POST /v1/consent/request`

Child accounts only. Request: `{ "parentEmail": "parent@example.com", "ui": "zh" }`.
Mails the parent a link (valid 7 days) to a page that explains what the app does and asks for consent.
Asking again replaces the earlier request (and its link).
Response `200`: `{ "consent": { …as in me.consent… } }`.
Errors: `400 bad_request` (`field: "parentEmail"`, also when it is the account's own e-mail),
`409 conflict` (`reason: "not_child"` or `reason: "granted"`), `429 rate`.

### `GET /v1/consent`

Response `200`: `{ "consent": { …as in me.consent… }, "features": { …as in me.features… } }`.

### Consent pages (opened by the parent in a browser, not by the app)

- `GET /v1/consent/c/<token>` — HTML page (English and Chinese) with an "I agree" button. Opening it changes nothing
  (mail scanners open links).
- `POST /v1/consent/c/<token>` — the button. Records the consent time, then mails the parent a confirmation
  with a link to withdraw consent ("email plus").
- `GET /v1/consent/r/<token>` / `POST /v1/consent/r/<token>` — withdraw consent (the voice features are blocked again).

## 6. Daily quota

Three meters, each counted per user per **quota day**:

| Meter | What counts | Free | Monthly | Yearly |
| --- | --- | --- | --- | --- |
| `talk` | seconds of wall-clock time on `WS /v1/talk` | 5 min | 30 min | 20 min |
| `asr` | each `POST /v1/asr` and each `WS /v1/asr-rt` connection (speech-recognition clips) | 400 | 1,500 | 1,500 |
| `aux` | each `POST /v1/tip`, `/v1/tts`, `/v1/zh`, `/v1/steps`, `/v1/place` | 300 | 1,500 | 1,500 |

(All numbers are server config `PLANS`; the app shows what `GET /v1/me` says, never its own copy.)

**Quota day and reset:** the day runs from local midnight to local midnight **in the time zone offset the device
reported** (`tzOffsetMin`, from sign-in or `PATCH /v1/me`). The offset is clamped to −720…+840 and rounded to
15 minutes. To stop "time-zone hopping" for extra minutes, a **change takes effect only if the previous change
was at least 7 days ago** (the first value always applies); otherwise the old offset stays and `me.tzOffsetMin`
shows it. Accounts that never sent an offset use UTC. `quota.resetsAt` is the next local midnight as a UTC instant,
`quota.day` is the local date.

A talk session that crosses midnight is charged entirely to the day it started.

Metered HTTP responses carry the meter's state: `"quota": { "meter": "asr", "left": 399 }` in the JSON body.

## 7. Subscriptions (Apple In-App Purchase)

Product ids are server config (`APPLE_PRODUCTS`, each mapped to `monthly` or `yearly`).

`subscription.state`:

| state | meaning | premium? |
| --- | --- | --- |
| `none` | never subscribed on this account | no |
| `active` | paid up to `expiresAt` | yes |
| `grace` | renewal failed, Apple's billing grace period runs until `graceUntil` | yes |
| `expired` | ended (cancelled, billing retry without grace, grace over) | no |
| `revoked` | refunded or revoked by Apple | no |

`plan` is `"monthly"` / `"yearly"` while premium, else `"free"`. If several subscriptions are active, the one with
the larger talk allowance wins.

### `POST /v1/iap/apple`

After a purchase, on "Restore purchases", and whenever `Transaction.updates` delivers a transaction, send the
StoreKit 2 signed transaction (`VerificationResult.jwsRepresentation`):

```json
{ "signedTransaction": "<JWS>" }
```

The server verifies the JWS (certificate chain up to Apple Root CA – G3, signature, `bundleId`, `productId`,
environment) and stores the entitlement keyed by `originalTransactionId` (sending the same one again is safe).

Response `200`: `{ "subscription": { …as in me.subscription… }, "me": { …§4… } }` — also for an expired or refunded
transaction (then `state` says so).
Errors: `400 bad_request` with `field: "signedTransaction"` and `reason`:
`format` · `chain` (certificate chain not from Apple) · `signature` · `bundle` · `product` · `environment`;
`409 conflict` with `reason: "iap_owned"` (this subscription belongs to another Echo Island account).

### `POST /v1/iap/apple/notifications`

For **Apple's servers only** (App Store Server Notifications V2 URL). Body `{ "signedPayload": "<JWS>" }`.
`200 {"ok":true}` when handled (also for duplicates and types we ignore); `400` when the payload does not verify.

## 8. Voice AI

### `WS /v1/talk` — realtime voice chat with an islander

URL: `wss://<host>/v1/talk?npc=<id>&g=<goal>&lv=<0-5>&ui=<zh|en>&m=<memory>&name=<player>` (+ `&token=` if not using the
first-message auth). Same parameters as the family relay:

| param | meaning |
| --- | --- |
| `npc` | islander id from `talk-npcs.js` (English), a course character id from `talk-courses.js` (other courses, e.g. `es1-u1`, `ja1-u3`, `zh1-u8`), or `dyn` for a person on the map (then `p` is required) |
| `p` | `dyn` only: base64url JSON `{name, g, kid, role, island, place, lines, words, lang}` (cleaned and length-limited on the server). `lang` is optional: `"es"` / `"ja"` / `"zh"` makes this person speak that language (see **Chat language**); absent or `"en"` = English, as before |
| `quest` | side-quest id from `quests.js`; when present `npc` and `p` are ignored |
| `lang` | with `quest` only: `"es"` / `"ja"` / `"zh"` = the quest in that course language (see **Quests and pronunciation tips in other languages**); absent or `"en"` = the English quest, as before. Ignored without `quest` (a character's language comes from its id or from `p.lang`) |
| `g` | which goal (0–9) |
| `lv` | placement level 0–5 (omit for book-track saves) |
| `ui` | interface language `zh` / `en` |
| `m` | base64url JSON `{facts:[…], better:"…"}` memory hints (filtered on the server) |
| `name` | the player's in-game name (letters, digits, spaces; 16 chars) |

The server builds the islander's instructions itself (`talk-core.js`, same as the relay). **Any persona,
instructions or goal text sent by the client is ignored.**

Before the session the server checks, in this order, and on failure sends `{"type":"error",...}` then closes:
auth → consent → rate → `npc` / `quest` / `p` valid (`bad_request`, `field: "npc"`) → the character's language is one of
`me.talkLangs` — for a quest with `lang`: one of `me.questLangs`, and that quest has a translation —
(`bad_request`, `field: "lang"`, `reason: "unsupported_lang"`, `supported: [...]`, close `4400`) → another live
talk session of this account (`conflict`, `reason: "live_session"`) → daily allowance (needs at least `TALK_MIN_START_SEC`,
default 20 seconds, left: `quota`) → provider reachable (`provider`).

Client → server (JSON text messages, same as the relay):

| message | meaning |
| --- | --- |
| `{"type":"auth","token":"…"}` | first message (see §1) |
| `{"type":"audio","data":"<base64 PCM16 16 kHz mono>"}` | microphone chunk (each message ≤ 256 KB) |
| `{"type":"commit"}` | push-to-talk released |
| `{"type":"cancel"}` | interrupt the islander |
| `{"type":"text","text":"…"}` | typed line (≤ 200 chars) |
| `{"type":"help"}` | "help me" button |
| `{"type":"end","steps":[true,false,…]}` | finish and evaluate (`steps` = live ticks) |
| `{"type":"ping"}` | keep-alive, optional (send every 30 s when idle) |

Server → client:

| message | meaning |
| --- | --- |
| `{"type":"ready","npc":"…","goal":0,"leftSec":280,"sessionSec":280,"warnSec":60}` | connected; `leftSec` = today's talk allowance left, `sessionSec` = this session's maximum |
| `{"type":"audio","data":"<base64 PCM16 24 kHz mono>"}` | islander voice |
| `{"type":"npc","delta":"…"}` / `{"type":"npc_done","text":"…"}` | islander text |
| `{"type":"you_live","text":"…","item":"…"}` / `{"type":"you_item","item":"…"}` / `{"type":"you","text":"…","item":"…"}` | learner's recognised speech |
| `{"type":"usage","in":…,"out":…,"ain":…,"aout":…}` | provider tokens for one answer (information only) |
| `{"type":"quota","warn":true,"leftSec":60,"why":"daily"}` | **new:** 60 s (`warnSec`) before the session ends; `why` = `daily` (allowance) or `session` (max session length) |
| `{"type":"limit","zh":"…"}` | time is up (text in the session's `ui` language; field name kept from the relay) |
| `{"type":"eval","eval":{…},"sec":95,"left":185}` | final evaluation; then the server closes with code 1000 |
| `{"type":"error","code":"…","status":402,"zh":"…","message":"…"}` | see below |
| `{"type":"pong"}` | answer to `ping` |

`error.code` is one of the HTTP `error` names (`auth`, `quota`, `consent`, `conflict`, `rate`, `bad_request`,
`too_large`, `provider`, `unavailable`, `server`) or `timeout` (no `auth` message in time) for problems before or outside
the conversation — then `status` is the matching HTTP status (408 for `timeout`) and the error's extra fields from §2 are
included (e.g. `need`, `meter`, `resetsAt`, `reason`, `field`) — or talk-core's in-session codes `upstream` / `closed`
(the provider reported an error or dropped; no `status`; the session then ends with an `eval` as usual).
`zh` is a short text for the learner in the session's `ui` language (`ui` query parameter; Chinese if missing).
**Changes from the family relay:** relay `daily` → `quota`; relay `npc` → `bad_request`; relay `code`/`origin`/`busy` do not exist.

Close codes: `1000` normal end; `4400` bad request; `4401` auth; `4402` quota; `4403` consent; `4409` conflict;
`4413` message too large; `4429` rate; `4503` provider; `4408` no `auth` message within 10 s.

Metering: wall-clock seconds from the moment the session is accepted until it ends, charged to the account.
One live talk session per account at a time. Maximum session length `TALK_SESSION_MAX_SEC` (default 600 s).

#### Chat language — `/v1/talk`, `/v1/steps`, `/v1/zh`

For courses in other languages (Spanish, Japanese, Mandarin Chinese). The language of a chat is the language of its character:

- a course character (`npc=es1-u1` …) carries its language in `talk-courses.js` (generated from the course sources by
  `node tools/course/build.js --talk`); the client sends only the id, exactly as for English islanders;
- a person on the map (`npc=dyn`) speaks the language in `p.lang`;
- a quest (`quest=<id>`) is in the language given by `lang` (next section); without `lang` it is English;
- the islanders of `talk-npcs.js` are English.

Everything that depends on the language is decided on the server by `talk-core.js` from that one field: the rules and the
example sentences in the instructions (same safety rules as English), the voice (a native voice of that language;
`TALK_VOICE_MAP` can rename it), the final evaluation (`eval.tips[].better` is in the course language; `praise`, the tip
explanation and `concernWhy` are in the `ui` language; `voice` counts lines spoken in the course language), and the live ticks.
The provider's input transcription is not told a language (as for English). The messages on the socket are the same as for English.

- **A character without a language (every English islander, quest and old `dyn` request) gets byte-for-byte the same provider
  request as before.**
- The language must be one of `me.talkLangs` (§4). Otherwise — a course character whose language is switched off, or a `lang`
  that is not `"en"` / `"es"` / `"ja"` / `"zh"` (another code, wrong case, not a string) — the answer is `400 bad_request` with
  `field: "lang"`, `reason: "unsupported_lang"`, `supported: ["en", …]` (on the socket: an `error` message with these fields,
  then close `4400`). Checked before anything is opened or counted: no allowance is used and the provider is not contacted.
- Allowance, rate limits, consent, reporting and the one-live-session rule are the same for every language.
- `POST /v1/steps`: `npc` may be a course character id; with `npc: "dyn"` send the person's `lang` too (optional, same values
  and the same `400` as above).
- `POST /v1/zh`: `lang` = the language of `text` (optional; absent or `"en"` = English) and `ui` = the language to translate
  into (`"zh"` Chinese, `"en"` English; absent or unknown = Chinese). With neither field the provider request is exactly as
  before (English → Chinese). The answer field is still called `zh`, whatever the target language. When there is nothing to
  translate (the text's language is the `ui` language: Chinese → Chinese, English → English) the answer is `400 bad_request`,
  `field: "ui"`, not counted.

#### Quests and pronunciation tips in other languages — `/v1/talk?quest=`, `/v1/steps`, `/v1/tip`

Side quests (`quests.js`) are written in English. In another course the client adds `lang`:

- `WS /v1/talk?quest=<id>&lang=<es|ja|zh>` and `POST /v1/steps` with `{ "q": "<id>", "lang": "es", … }`.
  The quest giver's persona, the facts and the goal stay the English originals of `quests.js` (the facts must not change);
  the opening line, the example sentence of each step and the useful words come from the server's translation table
  (`talk-courses.js` → `quests[lang][id]`, generated by `node tools/course/build.js --talk` from
  `tools/course/<lang>/quests.json`). `talk-core.js` (`questNpc(q, lang, loc)`) then gives the character that language, so the
  rules, voice, evaluation and line counting are those of **Chat language** above, with the quest rules (the learner leads,
  the character never says a step for them). Three sentences are added for these quests only: the facts are written in
  English and must be told faithfully in the course language; wherever the original relies on English words or grammar
  ("May I … please", "went", "the English classroom") the equivalents in the course language are used and accepted; and, when
  the translation entry has a `names` list (`[[English name, course-language form], …]`, taken from the course's term table),
  "Names in this chat, written in <Language> (use exactly these forms): …".
- **Without `lang` (or with `"en"`) the quest is the English one and the provider request is byte-for-byte as before.**
- `lang` must be one of `me.questLangs` (§4) and the quest must have a translation in that language; otherwise
  `400 bad_request`, `field: "lang"`, `reason: "unsupported_lang"`, `supported: [questLangs…]` (socket: `error`, then close
  `4400`), before anything is opened or counted. An unknown quest id is still `bad_request` with `field: "npc"`.
- `POST /v1/tip` with `{ "target": "…", "heard": "…", "ui": "zh", "lang": "ja" }`: `lang` = the language of the sentence
  (optional; absent or `"en"` = English, the provider request is exactly as before). The prompt then names that language;
  Japanese and Chinese are compared by reading (kanji / kana spellings or same-sound characters produced by speech
  recognition are not mistakes; no romaji, pinyin or phonetic symbols; no comments on Chinese tones); the comment is written
  in the `ui` language (`"zh"` Chinese — also when absent or unknown —, `"en"` English). `target` / `heard` keep that
  language's punctuation and accents. `lang` must be one of `me.tipLangs`; otherwise the same `400` (`supported: [tipLangs…]`),
  not counted, provider not contacted.
- Test hook (never in production): with `TEST_HOOKS=1`, `TEST_QUESTS` (JSON, the shape of `quests` in `talk-courses.js`:
  `{ "es": { "<id>": { "opener": "…", "steps": ["…"], "words": ["…"], "names": [["Ben", "…"]] } } }`) is merged over the built-in
  table, so tests can use sample translations. The family relay has the same hook.

### `WS /v1/asr-rt` — realtime transcription for speaking questions

URL: `wss://<host>/v1/asr-rt` or `wss://<host>/v1/asr-rt?lang=<es|ja|zh|en>` (see **Speech language** below; absent = English,
the provider request is exactly as before). Any language written by the client inside `session.update` is ignored.
Auth as in §1 (send `auth` first, then the messages below; they are queued until the provider is connected).
Each connection counts 1 on the `asr` meter (refunded if the provider cannot be reached).
Checks in this order: auth → rate → `lang` (unsupported → `error` `bad_request`, `status` 400, `field: "lang"`,
`reason: "unsupported_lang"`, `supported: [...]`, close `4400`; not counted, provider not contacted) → quota → provider.
Client → server: `session.update` (only `session.turn_detection.silence_duration_ms` is read, 300–1200),
`input_audio_buffer.append` `{audio}` (base64 PCM16 16 kHz), `session.finish`. Everything else is dropped.
Server → client: the provider's realtime-ASR events, unchanged (as the relay). Limits: 15 seconds per connection,
about 15 seconds of audio (700,000 base64 characters). Errors before connecting: same `error` message and close codes as `/v1/talk`.

### HTTP AI calls

All need a session, are metered (§6) and answer `503 provider` (not counted) when the provider fails.

| Endpoint | Request | Response `200` | Meter | Gated |
| --- | --- | --- | --- | --- |
| `POST /v1/asr` | `{ "audio": "<base64 WAV, 16 kHz mono 16-bit>", "lang": "es" }` (≤ 1.5 MB; `lang` optional) | `{ "text": "…" }` | asr | no |
| `POST /v1/tip` | `{ "target": "…", "heard": "…", "ui": "en", "lang": "ja" }` (`lang` optional: see **Quests and pronunciation tips in other languages**) | `{ "tip": "…" }` | aux | no |
| `POST /v1/tts` | `{ "text": "…", "g": "f"\|"m", "lang": "es" }` (`lang` optional) | `{ "url": "https://…" }` (provider's audio URL, expires within hours) | aux | no |
| `POST /v1/zh` | `{ "text": "…", "lang": "es", "ui": "zh" }` (`lang`, `ui` optional: see **Chat language**) | `{ "zh": "…" }` | aux | no |
| `POST /v1/steps` | `{ "npc": "…", "nm": "…", "lang": "es", "q": "…", "g": 0, "ui": "en", "turns": [{ "who": "you"\|"npc", "text": "…", "typed": false }] }` (`npc`: an islander or course character id, or `"dyn"` with `nm` and optional `lang`; or `q`: a quest id, with optional `lang` for a quest in another course language) | `{ "done": [0, 2] }` | aux | yes |
| `POST /v1/place` | `{ "id": "<placement item id>", "lang": "en", "heard": "…" }` | `{ "score": 0\|1\|2 }` | aux | yes |

Every `200` also has `"quota": { "meter": "…", "left": n }`. Field meanings and limits are the relay's
(`server/relay.js`): texts are cleaned and cut (`target`/`heard` 200, `zh` 400, `place.heard` 500, turns 30 × 300).
`/v1/place` looks the question and rubric up by `id`; unknown id → `400 bad_request` (`field: "id"`).
`/v1/steps` with no spoken (non-typed) learner turn answers `{ "done": [] }` without calling the AI and without counting (as the relay).

### Speech language (`lang`) — `/v1/asr`, `/v1/asr-rt`, `/v1/tts`

For courses in other languages. `lang` is one of the codes in `me.speechLangs` (§4): `"en"` English, `"es"` Spanish,
`"ja"` Japanese, `"zh"` Chinese (server config `SPEECH_LANGS` may switch some off; `"en"` is always on).

- **Absent (or `"en"`) = English, and the request sent to the provider is byte-for-byte the same as before this field existed.**
- `/v1/asr`: the recognition language (`asr_options.language`). `/v1/asr-rt`: query parameter `?lang=`, the realtime
  recognition language (`input_audio_transcription.language`).
- `/v1/tts`: the synthesis language (`language_type` `English` / `Spanish` / `Japanese` / `Chinese`) and a voice for that
  language from server config (English keeps `TTS_VOICE_F` / `TTS_VOICE_M`; others `TTS_VOICES`, by default native voices of
  that language: Spanish `Sonrisa` / `Bodega`, Japanese `Ono Anna` / `Ryan`, Chinese `Serena` / `Ryan`). For compatibility `/v1/tts`
  also accepts the language names `"English"`, `"Spanish"`, `"Japanese"`, `"Chinese"` (the old `"Chinese"` now uses the
  Chinese voice from `TTS_VOICES`).
- Anything else (another code, wrong case, a name on `/v1/asr`) → `400 bad_request` with `field: "lang"`,
  `reason: "unsupported_lang"`, `supported: ["en", …]`. Checked before counting: not counted, the provider is not contacted.
- Metering, rate limits, auth and consent rules are the same for every language (one call = one count on its meter).
- This section is about recognition and synthesis only (`me.speechLangs`). Voice chat in other languages has its own switch
  and rules (`me.talkLangs`, **Chat language** above: `/v1/talk`, `/v1/steps`, `/v1/zh`); quests and `/v1/tip` have theirs
  (`me.questLangs`, `me.tipLangs`, **Quests and pronunciation tips in other languages**). `/v1/place` keeps its own `lang`
  (which question bank), as before.

## 9. Reporting an AI message

### `POST /v1/report`

When the learner presses **Report** on an islander's message. The server keeps no transcripts, so the app sends
the exchange it has (the last few turns, at most 8):

```json
{ "npc": "t0-anna", "quest": null, "reason": "rude", "note": "optional, ≤ 300 chars",
  "turns": [ { "who": "npc", "text": "…" }, { "who": "you", "text": "…" } ] }
```

`reason`: `rude` · `scary` · `wrong` · `personal` · `other`. Response `200`: `{ "ok": true, "id": "r_…" }`.
Kept for review for **90 days**, then deleted automatically. Errors: `400`, `429 rate` (20 per account per day).

### `GET /v1/admin/reports` (owner only)

`Authorization: Bearer <ADMIN_TOKEN>`. Query: `limit` (≤ 100, default 50), `before` (a `createdAt` for paging).
Response `200`: `{ "reports": [ { "id", "createdAt", "userId", "ageGroup", "npc", "quest", "reason", "note", "turns" } ], "next": "<before value or null>" }`.
Wrong or missing admin token → `401 auth`.

## 10. Health

`GET /v1/health` → `200 { "ok": true, "version": "…", "time": "…", "speechLangs": ["en", …], "talkLangs": ["en", …], "questLangs": ["en", …], "tipLangs": ["en", …] }`. No authentication.
The language lists are the same as in `GET /v1/me` (§4); they are here so that an app that is not signed in can tell
"the server can do this language, the user only needs to sign in" from "the server cannot do this language".

## 11. Limits and CORS

- Per IP and per account rate limits on sign-in and AI calls (`429 rate`). Defaults: e-mail codes 5 per address
  and 20 per IP per hour; sign-in attempts 60 per IP per hour; AI calls 60 per account and 240 per IP per minute;
  WebSocket opens 12 per account per minute.
- JSON bodies ≤ 64 KB (`/v1/asr` ≤ 1.5 MB). WebSocket messages ≤ 256 KB.
- Browser origins allowed by CORS: server config `ALLOWED_ORIGINS` (the app's web view origins:
  `echoisland://localhost`, `https://appassets.androidplatform.net`). Native code (no `Origin` header) is not affected.
