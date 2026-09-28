# 回声岛怪兽图鉴 · 数据规格（386 只）

每只怪兽一条记录。所有名字、外形、图鉴文字都必须**原创**：不能用宝可梦的名字（英文、中文、日文都不行），也不能是一眼就能认出的宝可梦改名（比如 Pikachu→Pikachew、皮卡丘→皮卡秋）。
这是给中国初一学生学英语的游戏：英文名要由真实、常见、好拼读的英语单词拼成（例：Emberpup = ember + pup，Tidalfin = tidal + fin），孩子看到名字就能学到单词。

## 字段

```json
{
  "no": 10,
  "id": "twigling",
  "en": "Twigling",
  "zh": "小枝虫",
  "types": ["bug"],
  "stage": 1,
  "evo": [{ "to": "barkbug", "lv": 8 }],
  "hp": 36, "atk": 10,
  "b": "bug", "c": "#8bc34a", "k": "#f1f8e9", "a": "#795548",
  "e": "antenna", "t": "none", "w": "none", "p": "stripes", "m": "smile", "x": [], "sz": 1,
  "habitat": ["forest", "grass"],
  "rarity": 2,
  "words": ["twig", "-ling"],
  "dexEn": "Twigling looks like a small stick. Birds cannot find it.",
  "dexZh": "小枝虫看起来像一根小树枝，鸟儿都找不到它。"
}
```

| 字段 | 规则 |
| --- | --- |
| `no` | 图鉴编号，分给你的范围里每个号都要有，不能重复，不能缺 |
| `id` | 全小写英文字母，等于 `en` 去掉空格转小写；全表唯一 |
| `en` | 英文名，3–12 个字母，首字母大写，不带空格和符号；由 1–2 个常见英语单词（或单词 + 常见词缀 -let -ling -y -er）组成 |
| `zh` | 中文名 2–4 个字，好读好记，不能用宝可梦的官方中文名 |
| `types` | 1 或 2 个属性，只能从下面 17 个里选：`normal` 普通、`fire` 火、`water` 水、`grass` 草、`spark` 电、`ice` 冰、`fight` 格斗、`poison` 毒、`ground` 地面、`flying` 飞行、`psychic` 超能、`bug` 虫、`rock` 岩石、`ghost` 幽灵、`dragon` 龙、`dark` 恶、`steel` 钢 |
| `stage` | 进化阶段 1 / 2 / 3（不进化的单只写 1） |
| `evo` | 进化方式数组，最后一阶写 `[]`。等级进化 `{"to": "id", "lv": 16}`；道具进化 `{"to": "id", "item": "firestone"}`。道具只能是：`firestone` `waterstone` `leafstone` `thunderstone` `moonstone` `sunstone` `icestone`。一只可以有多个进化方向（分支进化） |
| `hp` `atk` | 基础体力和攻击。一阶 hp 30–48、atk 8–13；二阶 hp 44–64、atk 12–18；三阶 hp 58–82、atk 16–24；不进化的单只按强弱在 36–75、10–21 之间 |
| `b` | 身体：`blob` 团子 `biped` 两脚站 `quad` 四脚兽 `bird` 鸟 `fish` 鱼 `serpent` 蛇/龙身 `bug` 虫 `golem` 岩石/金属巨人 `ghost` 幽灵 `plant` 植物球 `shell` 背壳（龟、蟹、贝） `dragon` 带翅膀的大龙 |
| `c` `k` `a` | 主色、肚皮色、点缀色，6 位十六进制。颜色要和属性搭（火系偏红橙、水系偏蓝、草系偏绿……），同一进化链配色一致 |
| `e` | 头上：`cat` `dog` `round` `bunny` `fin` `leaf` `antenna` `horn` `horns` `curl` `crest` `flame` `ice` `flower` `spikes` `crown` `cloud` `gem` `none` |
| `t` | 尾巴：`flame` `fin` `leaf` `bolt` `fluffy` `curl` `spike` `feather` `stinger` `club` `cloud` `long` `none` |
| `w` | 翅膀：`feather` `bat` `bug` `fairy` `none` |
| `p` | 花纹：`spots` `stripes` `mask` `star` `none` |
| `m` | 嘴：`smile` `fang` `beak` `grin` `o` |
| `x` | 其他装饰，0–3 个：`mane` `crown` `shell` `leafback` `crystals` `flames` `cloud` `scarf` `antlers` `whiskers` `spikesback` `aura`（`aura` 只给神兽） |
| `sz` | 大小倍数 0.8–1.3，默认 1 |
| `habitat` | 出没地点 1–3 个：`grass` 草地 `forest` 森林 `water` 河湖 `sea` 海 `cave` 洞穴 `mountain` 山 `sky` 天空 `town` 城镇 `desert` 沙漠 `snow` 雪地 `volcano` 火山 `swamp` 沼泽 `ruins` 遗迹 `night` 夜晚 |
| `rarity` | 稀有度 1（到处都是）– 5（非常少见） |
| `words` | 英文名里的英语单词/词缀，给孩子学单词用 |
| `dexEn` | 图鉴英文：1–2 句，简单现在时，用初一学生认识的词（A1–A2），每句不超过 12 个词 |
| `dexZh` | 图鉴中文，对应翻译 |

## 设计要求

- 进化链：同一链的外形要看得出是一家（同一种身体或自然变化，比如 blob → biped → dragon），越往后越大、越帅气，装饰越多（二阶加角/鬃毛/花纹，三阶加翅膀/王冠/背上的水晶等）。
- 分给你的范围里：大约 30% 三阶进化链、45% 二阶、25% 不进化；至少 2 条道具进化链，至少 1 条分支进化。
- 17 个属性都要照顾到，双属性大约占三分之一。
- 前面的编号放早期常见的怪兽（虫、鸟、小动物），`rarity` 低；后面的更稀有、更强。
- 同一范围里身体类型要多样，不要连着一大串都是同一种。
- 名字要可爱、酷、适合 12 岁的孩子；避免恐怖、暴力、不雅的词。
