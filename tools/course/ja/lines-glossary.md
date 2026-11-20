# Japanese story / battle lines: glossary and style guide

The source is `tools/course/lines-src.json`. The format rules are in `tools/course/SPEC.md` §8, §1 and §0. **`tools/course/ja/lines.json` is the file of record**: edit it directly. The `lines.part-*.json` batch files no longer exist.

**Checks.** Run `node tools/course/check.js ja` and expect 0 errors. Run `node tools/check-banned.js` as its own command and check its exit code. The checkers cannot tell a wrong reading from a right one, so re-read every reading you touch: counters, numbers, 何, rendaku, long vowels and もう一度 (もういちど).

**Terms.** Before you invent a term, look it up in `lines.json`: `terms.place`, `terms.item`, `terms.monster`, `terms.move`, `terms.skill` and `terms.crystal`. If a line names a place, item, monster or move, write it **exactly** as the term is written there.

## 1. Writing rules (copy towns.json)

### Kanji

Use only kanji taught in primary grades 1–4 (the 2020 list).

- If a word contains any harder kanji, write the whole word in kana. Examples: どうくつ, せきぞう, たき, ふんすい, きゅうけいじょ, じゅんび, ちょうせん, しつもん, ぼうけん, こども, はかせ (士 is grade 5), ハッシュだん (団 is grade 5), あしあと, とりもどす, いれかえる, めがね, わたる (渡 is not elementary), れきし (史 and 歴 are grade 5), じむしつ, よほう, まつり → お祭り (祭 is grade 3, so it stays kanji).
- Do not mix kanji and kana inside one word.
- The kanji in `lines.json` were checked against my own memory of the grade 1–4 list. They are **not** checked against a list kept in the repository, because there is no such list there.

### Always kana

These words are always written in kana: げんき (never 元気), あした (never 明日), こども, ねます / ねて, いっしょに, たまご, ねこ, ぞう, さる, くま, かめ, わかります, だいじょうぶ, すみません, おねがいします, あたたかい, はいいろ (the colour grey).

### Always kanji

These words are always written in kanji:

- 静か, 友だち (the course's exception), 先生, 大好き, 全部, 勉強, 練習, 本当, 一番, 安全, 伝説, 楽しい, 働く, 手伝う, 消しゴム, 島, 船, 天気, 日本語, 名前
- 覚える, 目を覚ます, 目が覚める, 目覚める

### Numbers

Running text uses kanji numerals: 七時, 三つ, 十まい, 三十回, 二ひき, 六ぴき, 一人 / 二人.

Arabic digits appear only in three places:

- route names: ルート1, 海のルート8
- skill levels: 道開きレベル2
- numbers that a slot fills in: （{n}/4）, ユニット{n}

### Counters

The course writes these counters in kana: 〜ひき / 〜ぴき, 〜まい, 〜こ, 〜さい, 〜本. Write their readings with the real sound change: いっぴき, ろっぴき, さんじゅっかい, じゅうまい, じゅっぽん, じゅっこ.

**Badges are always counted with 〜こ:**

| Kanji | Reading | Kanji | Reading |
| --- | --- | --- | --- |
| 二こ | にこ | 八こ | はっこ |
| 三こ | さんこ | 九こ | きゅうこ |
| 四こ | よんこ | 十こ | じゅっこ |
| 五こ | ごこ | 十一こ | じゅういっこ |
| 六こ | ろっこ | 十二こ | じゅうにこ |
| 七こ | ななこ | 十三こ | じゅうさんこ |

### Punctuation, Latin letters and symbols

- Use full-width 、。！？ and 「」. Ellipses are written …. Questions end in ？, as in towns.json.
- No emoji and no signature letters. Whisper's note ends 「…ウィスパーより」.
- The only Latin letter allowed is the on-screen button: **Aボタン**, read エーボタン.

### seg and r

- **Chunks.** Chunks are bunsetsu: a particle stays with the word before it (島へ, モンスターが). Punctuation stays with the chunk before it, and the reading leaves punctuation out.
- **です.** A noun or な-adjective and the です after it are separate chunks (`友だち|です。`, `大好き|です！`). An い-adjective + です is one chunk (`強いですね。`).
- **ください.** A te-form and the ください after it are separate chunks (`聞いて|ください。`).
- **Readings.** Write readings in hiragana. Katakana words keep katakana inside the reading (`ルートいち`, `しまマスターに`). The particles は / へ / を stay as written. No kanji.
- **Rendaku.** Compound readings: エコー貝 = エコーがい, エコー島 = エコーじま, 休み小屋 = やすみごや, 島々 = しまじま, 大声 = おおごえ.
- **開.** A door, gate or cage that opens is 開きます = **あきます**. A road, a hall or a flower that opens is ひらきます.

### Slots

- `{name}`, `{rival}`, `{mon}`, `{x1}` and the other slots must each appear exactly as often as in the source.
- A slot is a chunk of its own, and its `r` is the slot itself.
- Only closing punctuation can follow a slot in the same chunk: 、。！？」）…. An opening 「 or （ belongs to the chunk **before** the slot (`言いましょう。「` then `{text}」`).
- A particle after a slot either starts the next chunk (`{mon}|がチームに|入りました！`) or stands alone (`{mon}|は|{type}|の…`).
- Do not put a space after a slot.

## 2. Register

| Speaker | Style | Example |
| --- | --- | --- |
| Default: narrator, signs, Professor Echo, Amy, clerks, Isle Masters, Champion, villagers, the learner | です・ます | 「北への道が、開きましたよ。」 |
| Professor Echo | Warm です・ます with 〜ね / 〜よ / 〜ましょう / 〜てください | 「今日から パートナーです。大切にしてくださいね！」 |
| The rival `{rival}` | です・ます, like the children in the towns.json scenes. Short plain exclamations are allowed: やった！ すごい！ わあ！ Uses わたし (the rival can be a boy or a girl). | 「やった、勝ちました！でも、げんきを出して。」 |
| Children and kid NPCs | です・ます plus short exclamations. Boys (Kai, Tim) say ぼく. | 「あっ、トレーナーさん！助けてください！」 |
| Family: Mom, Dad, grandparents, siblings | Soft です・ます with ね / よ, plus 〜てね requests. Address the player as bare `{name}` with no さん. | 「おかえり、{name}！つかれているみたいですね。」 |
| Villains: Hush Crew, Admins, Mr. Mute | **Plain style allowed, but only in short, simple sentences** (〜だ, 〜ない, 待て！, 静かに！, くやしい！). Never rude words (おまえ, 〜しろ, きさま) and never threats. Mr. Mute speaks plain until he says 「ごめんなさい」; after that he speaks です・ます (「話してくれて、ありがとう。」). The switch is intended: it shows his change of heart. | 「シーッ！ことばはいらない！」 |
| Commands to a monster (learner `speak`) | Plain te-form request 〜て！ (taught as a chunk on island 9) | 「{mon}、木を切って！」 |
| Learner `speak` / `ask` / `opt` to people | Short です・ます or set phrases (はじめまして, おめでとう). Keep it shorter than the English if possible. Adults are addressed with さん (オリオンさん). | 「はかせ、はじめまして！」 |

### Address and "you"

- **Addressing the player:** everyone except family says `{name}さん`, written as two chunks: `{name}|さん！`. Family says bare `{name}`.
- **"You":** never use あなた, and do not use そちら as a pronoun. Japanese leaves the pronoun out. Rewrite the sentence:

| English | Japanese |
| --- | --- |
| Is this your pencil? | この えんぴつ、落としましたか？ |
| What colour is your bag? | かばんは何色ですか？ |
| And you? | ask the question again: …げんきですか？ / 海は好きですか？ |
| When is yours? | たんじょうびは、いつですか？ |
| You win! | わたしの負けです！ |
| You and {rival} are the stars | {rival}さんと二人で、今夜のスターです！ |

- **Villains:** only villains may say きみ.
- **Other named kids:** ティムくん, カイくん, キムくん. Use くん / さん as in the towns.json scenes.

### Level

The course teaches the 〜てください / 〜ないでください / 〜てもいいですか / 〜てはいけません family for rules.

- **Must / have to.** Do not use 〜なければなりません / 〜なければいけません. Rewrite it in one of these ways:

| English | Japanese |
| --- | --- |
| You must wait for the green light. | 青信号まで待ってください。 |
| We must save the animals. | 動物を守りましょう。 |
| We must wear a uniform. | せいふくを着ます。 |
| I have to wash the dishes. | お皿をあらいます。 |
| Do you have to clean your room? | 部屋のそうじをしますか？ |

- **Proverbs.** Do not use proverbs. 「時は金なり」 becomes 「時間は大切です！」.
- **Clipped speech.** Do not use clipped forms (〜ないと, 〜なくちゃ). Say it fully: もっと泳ぎたいです！, もう ねます。

## 3. Lines that mention English, and school subjects

The learner is learning Japanese, so English becomes **日本語** everywhere. The game swaps 英语 / English in the meaning line underneath, so the Japanese text must also say 日本語.

**Names that change:**

- "English Champion" = 日本語チャンピオン.
- "English Cup" = 日本語カップ.
- "Monsters here listen to English" = 「ここのモンスターは日本語を聞きます。」
- "They will teach you English" = 「日本語を教えてくれますよ！」
- "Write your English name" = 「お名前を書いてね。」 (name only; no ローマ字 and no 英語).
- "What is this in English?" = 「これは日本語で何ですか？」

**School subjects** are also translated to match the line underneath:

| English | Japanese |
| --- | --- |
| English (class, teacher, books) | **日本語** (日本語のじゅぎょう, 日本語の先生) |
| Chinese (the subject) | 中国語 |
| maths | **数学** (towns.json word; not 算数) |
| science | 理科 |
| art | **びじゅつ** (towns.json word; not 図工); art club = びじゅつ部 |
| PE | 体育 |
| music | 音楽 |
| history | れきし |
| geography | 地理 |
| biology | 生物 |

**School places** use the towns.json island 3 words:

| English | Japanese |
| --- | --- |
| school library | **図書室** (a city library, or one where a monster lives, is 図書館) |
| lab in a school | **理科室** (Doctor Octo's lab is 研究所) |
| gym | 体育館 |
| playground / track | **校庭** |
| music room | 音楽室 |
| dining hall | しょくどう |
| computer room | コンピューター室 |
| office | じむしつ |
| principal's office | 校長室 |
| classes | 〜組: Class 1A = 一組 (いちくみ), Class Five = 五組 (ごくみ) |

The school bell is チャイム. A clock-tower bell or an old bell is かね.

## 4. People and titles

People with English names are written in katakana. Isle Masters with animal titles use the Japanese animal word plus a title.

| English | Japanese (reading) |
| --- | --- |
| Professor Echo | エコーはかせ. She is Mr Park's daughter. Address her as はかせ. |
| Amy (Rest Stop keeper) | エイミーさん |
| Mom / Dad / Grandma / Grandpa | お母さん / お父さん / おばあさん / おじいさん |
| Brother / Sister | お兄さん / お姉さん; little sister = 妹 (someone else's: 妹さん) |
| the rival | `{rival}` (others say `{rival}さん`) |
| Isle Master | 島マスター (しまマスター); plural 島マスターたち |
| Captain Polly (parrot, Hello Island) | ポリー船長 |
| Rainbow Crab (Crayon Island) | にじいろガニ |
| Granny Turtle (Family Island) | かめおばあさん |
| Doctor Octo (Subject Island) | オクトはかせ |
| Flo (Music Hall) | フロー |
| Rex the rooster (Clock Hall) | レックス |
| Puffy (Party Hall) | **パフィー** |
| Croc (Animal Island) | クロコさん |
| Sharky (Rule City) | シャーキー |
| Coach Seal (Sports Island) | アシカコーチ (the statue is a sea lion: アシカ) |
| Memory Dragon (Memory Island) | 思い出ドラゴン |
| Champion Aria | アリア, 日本語チャンピオン |
| Master Sage / Luna / Frost / Talon | セージ / ルナ / フロスト / タロン; generic: マスター |
| Captain Gale (ferry) | ゲイル船長 |
| Orion (mentor) | オリオン; children and the learner say オリオンさん |
| Assistant Nova | ノバ (Doctor Octo's 助手) |
| Bobo (Talent Show host) | ボボ |
| Tock (clock keeper) | トック |
| Mayor Tick / Baker Bun / Student Lucy (Clock Island) | 町長さん / パン屋さん / 学生 (as roles) |
| Ranger Rosa | ロサさん |
| Lily (music club), Rosa (dance club), Ken (art club) | リリー, ロサ, ケン |
| Mr Grey (school office) | **グレイ先生** (グレー is not used for the name) |
| Miner Max | マックスさん |
| Granny Rose | ローズおばあさん |
| Dr. Skye (Weather Station) | スカイはかせ |
| Officer Lee / Junior (Traffic) Officer | リーさん (けいさつかん) / 見習いおまわりさん (みならいおまわりさん) |
| Kai / Tim / Kim | カイくん / ティムくん / キムくん |
| traveller | 旅人さん |
| Team Hush | ハッシュだん |
| Hush Crew member, "grunt" | ハッシュだんのメンバー |
| Admin Whisper / Admin Rumble | ウィスパー / ランブル (かんぶ) |
| Mr. Mute | ミスターミュート; Orion calls him ミュートさん |
| Hush King / Echodrake (monsters) | ハッシュキング / エコードレイク |
| trainer | トレーナー / トレーナーさん |
| Parrot sound "Squawk!" | クワッ！ |
| phone ringing | プルルル！ (always; never リンリン) |
| Weather Machine / Weather Switch / Memory Card / Memory Door | 天気マシン / 天気スイッチ / 思い出カード / 思い出のとびら |
| Silence Machine (Rumble's) | 静かマシン |
| Hush Stone | ハッシュストーン |
| Sea Patrol | 海のパトロール |
| satellite dish | パラボラアンテナ |
| password | あいことば |

## 5. Places (full list in `terms.place`)

- **Island names:** use the towns.json names.
  - t0 あいさつの島
  - t1 ぶんぼうぐの島 (the game's "Crayon Island")
  - t2 家族の島
  - t3 学校の島
  - t4 科目の島
  - t5 しゅみの島
  - t6 毎日の島 (the game's "Clock Island")
  - t7 たんじょうびの島
  - t8 動物の島
  - t9 きまりの島 (the game's "Rule City")
  - t10 スポーツとごはんの島
  - t11 天気の島
  - t12 思い出の島
- **The whole archipelago or game:** エコー島 (エコーじま).
- **Roads:** Route N = ルートN (ルートいち…). Sea routes = 海のルートN.
- **Halls:** Challenge Hall = チャレンジホール. One name per building:

| Island | Hall | Notes |
| --- | --- | --- |
| Hello Island | あいさつホール | |
| Crayon Island | クレヨンホール | |
| Family Island | 家族ホール | |
| Campus Island | 学校ホール | |
| Subject Island | 科目ホール | the speaker's "Timetable Hall" is also 科目ホール |
| Club Island | 音楽ホール | |
| Clock Island | 時計ホール | |
| Party Island | パーティーホール | |
| Rule City | きまりホール | the sign says きまりの島のチャレンジホール; "Traffic Hall" is also きまりホール |
| Sports Island | スタジアム（チャレンジホール） | |
| Weather Island | 天気ホール | |
| Memory Island | 思い出ホール | |

- **Other buildings:**
  - Rest Stop (healing station) = きゅうけいじょ.
  - Shop = お店.
  - Daycare = モンスターようちえん.
  - Monster box = モンスターボックス; the PC itself = パソコン.
  - Ranger Station = レンジャー小屋.
  - Police Station = けいさつしょ.
  - Weather Station = きしょうだい.
  - Weather Tower = 天気のとう.
  - Clock Tower = 時計台.
  - Memory Temple = 思い出のしんでん.
  - The Sea Door = 海のとびら.
  - Hush Base = ハッシュだんのきち.
- **Other places:**
  - Echo Cave = エコーどうくつ.
  - Brave Road = 勇気の道.
  - Champion Plateau = チャンピオン高原.
  - Animal Park = 動物公園.
  - nature park = 自然公園.
  - Food Festival = 食べ物のお祭り.
  - Sports Day = 運動会.
- **Floors:** 一階 / 二階 (いっかい / にかい).

## 6. Objects and game terms

| English | Japanese (reading) |
| --- | --- |
| monster | モンスター |
| shell (the starters' shells) | 貝 (かい) |
| Echo Shell (skill item) | エコー貝 (エコーがい); item names are エコー貝：道開き and so on |
| Echo Ball / Gold Echo Ball | エコーボール / 金のエコーボール |
| badge | バッジ (counted 〜こ) |
| crystal | クリスタル (the 12 crystals: 〜のクリスタル, see `terms.crystal`) |
| handbook (monster list) | モンスター手帳 (モンスターてちょう); **never** ずかん |
| Island Pass | 島のパス (しまのパス) |
| ferry / boat | 船 (ふね) |
| statue (Challenge Hall statues) | せきぞう (it shines = 光ります) |
| stone tablet | 石板 (せきばん) |
| gate (mechanism door) | 門 (もん); opens = 開きます (あきます) |
| move (attack) | わざ |
| battle | バトル; battle against = 〜とバトルします; a "monster battle" = モンスターバトル; match = 勝負 |
| team (party of 6) | チーム |
| egg | たまご; hatch = 生まれます |
| Team Headset | チームヘッドホン |
| potion | くすり |
| Quiet Spray | 静かスプレー |
| coins | コイン (〜まい) |
| bag | かばん |
| milk | ぎゅうにゅう |
| evolution / growing up | 大きくなります (never しんか) |
| clue | ヒント |
| tall grass / wild monster | 高い草 / 野生のモンスター |

**Echo skills** (`terms.skill`). A skill level is written with **no space**, the same way in terms and inside sentences. In a sentence, chunk it as `道開き|レベル2で`, or as one chunk `道開きレベル3を`.

| Skill | Japanese (reading) | Level 2 / Level 3 |
| --- | --- | --- |
| Clear Way | 道開き (みちひらき) | 道開きレベル2 / 道開きレベル3 |
| Light Up | ライトアップ | — |
| Water Way | 水の道 (みずのみち) | 水の道レベル2 / 水の道レベル3 |
| Sky Ride | 風乗り (かぜのり) | — |

The spoken commands are:

- 「{mon}、木を切って！」
- 「{mon}、どうくつを明るくして！」
- 「{mon}、岩をわって！」
- 「{mon}、岩をおして！」
- 「{mon}、海をわたって！」
- 「{mon}、もぐって！」
- 「{mon}、たきを登って！」
- 「{mon}、あそこまで飛んで！」

**Monster types.** `terms.type` has only the four starter types. Use the names below whenever a line names a type. A "fire monster" is 火のモンスター. Do not use the big monster series' type names (ほのお, でんき, エスパー, かくとう, ひこう, あく, はがね…).

| Type | English | Japanese (reading) | Type | English | Japanese (reading) |
| --- | --- | --- | --- | --- | --- |
| normal | Normal | ふつう | bug | Bug | 虫 (むし) |
| fire | Fire | 火 (ひ) | rock | Rock | 岩 (いわ) |
| water | Water | 水 (みず) | ghost | Ghost | おばけ |
| grass | Grass | 草 (くさ) | dragon | Dragon | ドラゴン |
| spark | Spark / electric | 電気 (でんき) | dark | Shadow | かげ |
| ice | Ice | 氷 (こおり) | steel | Steel | 鉄 (てつ) |
| fight | Kungfu | カンフー | ground | Earth | 大地 (だいち) |
| poison | Poison | どく | flying | Flying | 空 (そら) |
| psychic | Mind | 心 (こころ) | | | |

**Monster names** are katakana transliterations. The suffixes are rendered the same way everywhere:

| English | Katakana | English | Katakana |
| --- | --- | --- | --- |
| -let | レット | -ling | リング |
| -pup | パップ | -kit | キット |
| -paw | ポー | -wing | ウイング |
| -hawk | ホーク | -owl | オウル |
| -drake | ドレイク | -dragon | ドラゴン |
| -bug | バグ | -moth | モス |
| -beetle | ビートル | -fin | フィン |
| -shell | シェル | -horn | ホーン |
| -giant | ジャイアント | -guard | ガード |
| -knight | ナイト | -king | キング |
| -queen | クイーン | -cake | ケーキ |
| a final -y | ー | | |

Knightcrab is カニナイト: ナイトクラブ would mean "nightclub". A monster nickname (`{mon}`) stays exactly as the player wrote it.

## 7. Questions with answer options

**Different meanings.** In every `ask` with `opt` lines, the right answer and the wrong options must differ in meaning and must sound clearly different when spoken.

**Generic short answers** are reused across several questions, so they have fixed translations:

| id | English | Japanese |
| --- | --- | --- |
| l1c7f9yh | Yes, I can. | はい、できます。 |
| l1epbp78 | Yes, I can! | はい、できます！ |
| lyzxcza | Yes, I do. | はい、好きです。 |
| l1detn6z | Yes, it is. | はい、そうです。 |
| l1jjnxe7 | Yes, I am. | はい、わたしです。 |
| l1u0uim8 | No, it isn't. | いいえ、そうじゃありません。 |
| lp9hvcr | No, I don't. | いいえ、しません。 |
| l426h7s | Yes, I did. | はい、しました。 |
| l1ua2sj4 | Me too! | わたしも！ |

**Matching questions.** A question whose right answer is 「はい、できます」 must ask "can you…": 「手伝えますか？」, 「オクトはかせを助けられますか？」, 「歌えますか？」.

**Past tense.** In past-tense lessons (Memory Island, the questions about Route 1 and Weather Island, and Mom's 「今日、何を食べましたか？」), the right answer is the past form (〜ました). The present form (〜ます) is a wrong option.

**Templates with values.** A template's `vals` must match the stand-alone line with the same English, word for word:

- the colour broadcasts: 「赤いところを歩いてください！」
- Tim's descriptions
- the club answers
- the tourists' 「この人は、めがねをかけていません。」 and the others
- the weather words
- the dates

## 8. Banned and franchise wording (Japanese side)

Do not use the Japanese wording of the well-known monster series:

- ポケモン, モンスターボール, ジム / ジムリーダー, してんのう, チャンピオンロード, ずかん
- わざマシン / ひでんマシン, なみのり, いあいぎり, かいりき, いわくだき, フラッシュ, そらをとぶ, ダイビング, たきのぼり
- キズぐすり, げんきのかけら, あなぬけのヒモ, むしよけスプレー, ふしぎなアメ, がくしゅうそうち, 〜のいし
- 「やせいの〜があらわれた！」, 「ゆけっ！」, 「きみにきめた！」, 「〜はたおれた」, 「〜のようすが…！」, 「しんかした」, 「こうかはばつぐんだ」, 「1、2の…ポカン」, 「〜をおぼえたい…」
- move names such as たいあたり, ひのこ, あわ, はっぱカッター, つるのムチ, でんきショック, ねむる, てっぺき, こわいかお

The game's own phrasings are:

- 「{mon}が来ました！」
- 「{mon}、出番です！」
- 「{mon}はつかれて、もう動けません。」
- 「{mon}が大きくなっていきます！」
- 「{mon}は{move}を覚えられます！」
- 「やった！{mon}が新しい友だちになりました！」
- 「見て！たまごがゆれています！」

## 9. Examples of level and tone

| Source | Japanese | Notes |
| --- | --- | --- |
| My name is {name}. (speak) | わたしの名前は{name}です。 | `わたしの\|名前は\|{name}\|です。` |
| Now write your English name on it. | お名前を書いてね。 | Mom; no "English name" |
| Hi there! You must be {name}, my new neighbour! | こんにちは！{name}さんですね。新しいおとなりさんですね！ | |
| Choose one shell and say hello in English! | 貝を一つ選んで、日本語であいさつしてください！ | |
| I'm Ms Bell, the English teacher. | わたしはベル先生です。日本語の先生です。 | subject → 日本語 |
| Is this your pencil? | このえんぴつ、落としましたか？ | no あなた / そちら |
| Yay, I won! Don't be sad. Let me heal your monster. | やった、勝ちました！でも、げんきを出して。モンスターをげんきにしますね。 | rival |
| Shh! Words only make trouble! | シーッ！ことばはいらない！ | villain, plain style, short |
| Words make people fight. A quiet world is a happy world. | ことばは、けんかを生む。静かな世界は、しあわせな世界だ。 | Mr. Mute |
| You must wait for the green light! (speak) | 青信号まで待ってください！ | no 〜なければなりません |
| Don't break the rules! (speak) | きまりをやぶらないでください！ | |
| Stop! You can't go north without this town's badge. | 止まってください！この町のバッジがないと、北へは行けません。 | |
| With nine badges, a flying monster can fly you to any town you visited. | バッジが九こあれば、飛べるモンスターが、行ったことのある町へ、どこにでも連れていってくれます。 | badges = 〜こ |
| {mon}, climb the waterfall! (speak) | {mon}、たきを登って！ | |
| Hmm, not quite. You can say: "{text}" | うーん、おしいです。こう言いましょう。「{text}」 | 「 sits at the end of the chunk before the slot |
