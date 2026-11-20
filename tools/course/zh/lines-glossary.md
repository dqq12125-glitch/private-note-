# 中文课台词翻译：术语表和写法（给翻 b / c / d 批的人）

2026-11-21。批 g（模板 + 全部词）和批 a（开场、公共台词）已经写好：`lines.part-g.json`、`lines.part-a.json`。下面的说法照着用，别另起一套；拿不准的先在这两个文件里搜原文，看我们怎么翻的。

格式规矩看 `tools/course/SPEC.md` §8 和 §1；读音、切块的写法照 `tools/course/zh/towns.json`。

## 1. 学的人是谁、写成什么样

- 学的人**不会中文**，界面是英语：上面一行拼音、中间中文、下面一行英文原文。所以中文要**短、口语、常用词**，学过前几课的人大部分词认得出；能用「是 / 有 / 在 / 要 / 想 / 去 / 来 / 说」说清楚的，不用书面词，不用成语、四字格、文言（「之」只留在已有的专有名词里：寂静之王、勇气之路）。
- 说的是这个游戏世界里的话，不是从英语逐字搬过来：「Let's see how strong your monster is!」→「来看看你的怪兽有多厉害吧！」
- 全年龄，孩子也在用：不写恋爱、暴力、烟酒、赌博、宗教、政治、身材。英文里的 fight / attack 说成「对战」「出招」；坏人「拿走」「偷走」水晶，不「抢」不「打」。
- 语气：岛民、家人、对手说话亲切随便（用「你」，句尾常带「吧 / 呢 / 啊 / 呀 / 哦 / 啦」，别每句都带）；嘘声团冷冰冰、短；旁白平实。玩家对长辈、陌生大人第一次开口可以用「您」（批 a：「博士，很高兴认识您！」「请问，您是蒂姆的妈妈吗？」），别的一律「你」。

## 2. 要开口说的（`speak` / `ask` / `opt`）

- 越短越好，最好 2–6 个词块，一口气说得完；不用生僻字、多音字能避就避（ASR 认字，不认拼音）。
- 喊怪兽的指令统一成「{mon}，……！」：`{mon}，该你了！`、`{mon}，快醒醒！`、`{mon}，休息一下！`、`{mon}，用{move}！`。
- 同一题里对的答案和错的选项**意思要不一样**，不能只差「他 / 她」、只差声调、只差「了 / 的」。英文的错选项本来就是答非所问的，照意思翻，别为了好听改成意思相近的。
- `opt` 的选项要能单独看懂，不要靠前一句。

## 3. 「English / 英语」怎么办

学的人在学中文，台词里说到 English 的，一律改说**中文**（游戏会把下面英文那行里的 English 换成 Chinese，对得上）：

| 英文 | 中文 |
| --- | --- |
| speak / learn English | 说中文 / 学中文 |
| Monsters here listen to English. | 这里的怪兽听得懂中文。 |
| They will teach you English! | 他们会教你中文！ |
| What is this in English? | 这个用中文怎么说？ |
| English Cup | 中文冠军赛 |
| English Champion | 中文冠军 |
| English class / book / words | 中文课 / 中文书 / 中文词 |
| (subjects) English, math and science | 中文、数学和科学 |

- 「Say it in English」「answer in English」→「用中文说」。
- 说「英文名」的地方去掉「英文」：名字现在只能用拉丁字母，写「名字」就行（批 a：「现在写上你的名字吧。」）。
- 英文里在讲英语本身的（比如字母、拼写、"a / an"），改成讲中文能说通的就改，说不通的整句换个说法讲同一件事；实在不行在报告里列出来。

## 4. 名字和占位符

- `{name}`（玩家）、`{rival}`（对手）原样留着，个数和原文一样；它们自己是一块（后面只能跟标点），这一块的 `r` 就写 `{name}` / `{rival}`。玩家的名字是拉丁字母，前后不加空格：`谢谢|你，|{name}！`。
- 模板里的空（`{mon}` `{x1}`…）也一样：自己一块，后面只能跟标点。**「的」不是标点**：`{x1}的脚印` 要切成 `{x1}|的|脚印`。
- 空后面紧跟引号时用「」，不用“”（检查器只认 」』）。没有空的句子里引号用“”：`说“|妈妈”|和“|爸爸”！`。
- **前引号、前括号跟着前一块**（和别的标点一样），后引号跟着引号里最后一块：`写着：“|知识|就是|力量。”`、`九号水路（|海路）。`；句子开头的前引号跟着第一块：`“很久|以前，|…`。前一块是空的话不挪（空后面只能跟 」』）等）。
- 怪兽名、地名、道具名都在 `terms` 里，句子里遇到就照抄（见第 6 节）。

## 5. 人物

| 英文 | 中文 | 拼音 | 备注 |
| --- | --- | --- | --- |
| Professor Echo | 回声博士 | huí shēng bó shì | 你家邻居，对手的妈妈；叫他 / 她「博士」 |
| Mom | 妈妈 | mā ma | 玩家的妈妈 |
| {rival}（Leo / Mia） | 占位符原样 | | 博士的孩子；在 i0J 地名里叫「对手的家」 |
| Captain Polly | 鹦鹉船长 | yīng wǔ chuán zhǎng | 你好岛岛主 |
| Crabby / Rainbow Crab | 彩虹蟹 | cǎi hóng xiè | 彩色文具岛岛主 |
| Granny Turtle | 海龟奶奶 | hǎi guī nǎi nai | 温馨家庭岛岛主 |
| Principal Owl | 猫头鹰校长 | māo tóu yīng xiào zhǎng | |
| Doctor Octo | 八爪博士 | bā zhuǎ bó shì | 「爪」在这里读 zhuǎ |
| Flo | 火烈鸟乐手 | huǒ liè niǎo yuè shǒu | 「乐」读 yuè |
| Rooster Rex | 闹钟公鸡 | nào zhōng gōng jī | |
| Puffy | 河豚派对王 | hé tún pài duì wáng | |
| Croc | 鳄鱼巡查员 | è yú xún chá yuán | |
| Sharky | 鲨鱼纪律官 | shā yú jì lǜ guān | |
| Coach Seal | 海狮教练 | hǎi shī jiào liàn | |
| Whaley | 天气鲸 | tiān qì jīng | |
| Memory Dragon | 回忆巨龙 | huí yì jù lóng | |
| Isle Master(s) | 岛主 | dǎo zhǔ | 「各个岛主 / 每个岛主」 |
| Amy（Rest Stop 的人） | 艾米站长 / 艾米 | Ài mǐ zhàn zhǎng | 不叫护士 |
| Team Hush | 嘘声团 | xū shēng tuán | |
| Hush Crew（小兵） | 嘘声团团员 | xū shēng tuán tuán yuán | 不叫「手下」「喽啰」 |
| Admin Whisper / Rumble | 干部低语 / 干部闷雷 | gàn bù Dī yǔ / Mèn léi | 称呼时就叫「低语」「闷雷」；是人名，拼音首字母大写 |
| Mr. Mute | 默先生 | Mò xiān sheng | 嘘声团首领 |
| the Hush King | 寂静之王 | jì jìng zhī wáng | |
| Echodrake | 回声龙 | huí shēng lóng | |
| Kai | 小凯 | Xiǎo Kǎi | 害羞的男孩 |
| Orion | 欧瑞 | Ōu ruì | 研究古老词语的人 |
| Captain Gale | 盖尔船长 | Gài ěr chuán zhǎng | 渡轮船长 |
| Officer Lee | 李警官 | Lǐ jǐng guān | |
| Junior Officer（玩家在规则城的身份） | 小交警 | xiǎo jiāo jǐng | |
| Assistant Nova | 助手诺娃 | zhù shǒu Nuò wá | |
| Ms Bell | 贝尔老师 | Bèi ěr lǎo shī | |
| Tim | 蒂姆 | Dì mǔ | |
| Master Sage / Luna / Frost / Talon | 智者 / 露娜 / 冰霜 / 利爪 | Zhì zhě / Lù nà / Bīng shuāng / Lì zhǎo | 中文冠军赛的四位**擂主**（lèi zhǔ） |
| Champion Aria | 阿丽娅 | Ā lì yà | 「中文冠军阿丽娅」 |
| Tickturtle / Skyecho / Daysprout / Lullaby | 发条龟 / 天响 / 日日芽 / 摇篮灵 | fā tiáo guī / tiān xiǎng / rì rì yá / yáo lán líng | 学习里程碑的四只传说怪兽 |
| Nibbler（博士的怪兽） | 啃啃鼠 | kěn kěn shǔ | |

- 别的路人（Fisher Tom、Hiker Ben…）：`who` 不用翻；台词里提到他们时用「职业 + 短的音译名」，名字只取一两个字的常见音译（汤姆、本、凯特、莉莉、山姆…），拿不准就只说职业（「那位钓鱼的叔叔」）。英文原文里已经有中文提示的（`zh` 字段里写了名字），照提示。
- 新起的中文名字只给真的需要叫名字的人；同一个人全游戏只用一个写法，写进这张表后面（发给负责合并的人）。

## 6. 东西、地方、说法

| 英文 | 中文 | 拼音 |
| --- | --- | --- |
| monster | 怪兽 | guài shòu |
| trainer | 训练师（「小训练师」） | xùn liàn shī |
| partner | 伙伴 | huǒ bàn |
| team（队伍） | 队伍 | duì wu |
| battle（名词 / 动词） | 对战 / 来一场对战 | duì zhàn |
| move（招式） | 招（「小招」「大招」）/ 招式 | zhāo |
| Echo Ball / Gold Echo Ball | 回声球 / 金回声球 | huí shēng qiú / jīn huí shēng qiú |
| potion | 药水（「这瓶药水」） | yào shuǐ |
| badge | 徽章（「一枚徽章」） | huī zhāng |
| Challenge Hall | 挑战馆（「你好岛挑战馆」） | tiǎo zhàn guǎn |
| Rest Stop | 休息站 | xiū xi zhàn |
| crystal / Word Crystal | 水晶 / 词语水晶（「一颗水晶」） | shuǐ jīng / cí yǔ shuǐ jīng |
| statue | 雕像 | diāo xiàng |
| Echo Shell | 回声贝（道具名：「开路回声贝」「水路二级回声贝」） | huí shēng bèi |
| shell（海边的） | 贝壳 | bèi ké |
| echo skills: Clear Way / Light Up / Water Way / Sky Ride | 开路 / 点灯 / 水路 / 乘风 | kāi lù / diǎn dēng / shuǐ lù / chéng fēng |
| Clear Way 2 / Water Way 3 | 开路二级 / 水路三级 | kāi lù èr jí … |
| Team Headset | 共学耳机 | gòng xué ěr jī |
| Quiet Spray | 悄悄喷雾 | qiāo qiāo pēn wù |
| Return Rope | 回程绳 | huí chéng shéng |
| Fire Tune 等进化曲 | 火焰曲、海浪曲…（「曲」读 qǔ） | huǒ yàn qǔ |
| handbook / Monster Book | 手册 / 怪兽手册（别用老叫法，见清单） | guài shòu shǒu cè |
| egg / shining egg | 怪兽蛋 / 闪闪发亮的怪兽蛋（稀有色，别用老叫法） | guài shòu dàn |
| daycare | 怪兽幼儿园 | guài shòu yòu ér yuán |
| computer box | 怪兽箱子（「用电脑换队伍里的怪兽」） | guài shòu xiāng zi |
| Island Pass | 小岛通行证 | xiǎo dǎo tōng xíng zhèng |
| ferry | 渡轮（名称里）/ 船、小船（平常说） | dù lún / chuán |
| Ferry Ticket | 船票 | chuán piào |
| Route 1 / Sea Route 8 | 一号路 / 八号水路（数字用汉字） | yī hào lù |
| legendary monster | 传说中的怪兽 / 传说怪兽 | chuán shuō zhōng de guài shòu |
| coins | 金币（「十个金币」） | jīn bì |
| wild monsters / tall grass | 野生怪兽 / 草丛（「高高的草丛」） | yě shēng guài shòu / cǎo cóng |
| type（fire / water / grass / electric） | 火 / 水 / 草 / 电 +「系」（「火系的怪兽」） | huǒ / shuǐ / cǎo / diàn |
| Echo Island(s) | 回声岛 / 回声群岛 | huí shēng dǎo |
| Isle Master rematch / Unit N | 再比一场 / 第 N 单元 | |

- **地名**全在 `terms.place`（83 个）。句子里提到地名照抄那里的写法（「你好岛」「八爪博士的实验室」「中文冠军赛」）。楼层写「一楼 / 二楼」，路号写汉字（「十二号路」），不写 1F、不写阿拉伯数字。
- **怪兽名**在 `terms.monster`（386 monsters），照抄；台词里第一次提到一只怪兽可以加「一只」：「一只小发条龟」。
- 招式名、道具名、水晶名、技能名在各自的 `terms` 里，照抄。技能名在句子里用「」括起来：要用「开路」……。
- 不能用的词照 `tools/banned-terms.txt`（这里不重抄，免得这份文件自己被查出来）：先看一遍里面的中文词——野外技能的老说法（在水上走、潜到海里、照明、劈开石头那几样的常见两字词）、属性名、球和道具名、手册和稀有色的老叫法、挑战馆和岛主的老叫法、对战里的几句固定说法，中文里都很容易顺手写出来。我们的说法：小心！{mon}来了！／{mon}，该你了！／看！{mon}在长大！／{mon}累得不能再战斗了。水上走说「带我游过去」，潜海说「潜下去」，照明说「点灯 / 照亮」，属性说「火系」「电系」。写完自己跑 `node tools/check-banned.js`。

## 7. 标点和切块

- 全角中文标点：，。！？、：；……「」“”（）。省略号用「……」，破折号尽量不用。
- 切块按词，标点跟在前一块后面；语气词、助词单独一块或跟着前面的词，照 towns.json：`你|是|老师|吗？`、`七点|了，`、`我们的|新家！`、`岛上的|人`。「的」跟着前面的词（`我的`、`绿色的`、`中文书的`），空后面的「的」单独一块。
- 「一个」「一只」「十个」这种数量词一块；「打个|招呼」「看看」「说说话」一块。
- 不要出现阿拉伯数字（除了模板里 `num` 类的空本身）：拼音里不能有数字，「10 coins」写「十个金币」。

## 8. 拼音

- 带调号，音节之间空格，一个汉字一个音节；一块里的音节连着写，块和块分开（`r` 是数组，每块一项）。
- **轻声不标调**：朋友 péng you、谢谢 xiè xie、名字 míng zi、学生 xué sheng、早上 zǎo shang、喜欢 xǐ huan、认识 rèn shi、没关系 méi guān xi、不客气 bú kè qi、对不起 duì bu qǐ、知道 zhī dao、清楚 qīng chu、厉害 lì hai、队伍 duì wu、休息 xiū xi、精神 jīng shen、故事 gù shi、钥匙 yào shi、什么 shén me、怎么 zěn me、这个 zhè ge、妈妈 mā ma、爸爸 bà ba、奶奶 nǎi nai、哥哥 gē ge、风筝 fēng zheng、灯笼 dēng long；叠字动词第二个轻声（看看 kàn kan、试试 shì shi、说说 shuō shuo、醒醒 xǐng xing）；了 le、的 de、得 de（补语）、着 zhe、过 guo（「说过 shuō guo」）、吗 ma、吧 ba、呢 ne、们 men、子 zi（孩子 hái zi）、头 tou（石头 shí tou）；句尾的「哦」写 o，句首的「哦！」写 ó。
- 方位词「上」「里」跟在名词后面读轻声：岛上 dǎo shang、镇上 zhèn shang、路上 lù shang、背包里 bēi bāo li、心里 xīn li；但这里 zhè lǐ、那里 nà lǐ、哪里 nǎ lǐ、里面 lǐ miàn、上面 shàng miàn 照本调（和 towns.json 一样）。
- **一、不按读出来的写**：一个 yí gè、一下 yí xià、一遍 yí biàn、一起 yì qǐ、一天 yì tiān、一只 yì zhī、一场 yì chǎng；数数、序数、日期、楼层读 yī：第一 dì yī、一号路 yī hào lù、一月 yī yuè、一楼 yī lóu、十一 shí yī。不是 bú shì、不会 bú huì、不要 bú yào；不能 bù néng、不行 bù xíng；中间的「不」轻声：对不起 duì bu qǐ、听不见 tīng bu jiàn、了不起 liǎo bu qǐ。「个」在数字后面写 gè（一个 yí gè、三个 sān gè），在「这个 / 那个 / 哪个 / 打个」里写 ge。
- 三声连读**不改**，照本调：你好 nǐ hǎo、很好 hěn hǎo。
- 大写：只有人的名字大写（Xiǎo Kǎi、Dì mǔ、Ā lì yà、Mò xiān sheng、Lì li）；怪兽名、地名、道具名、称号小写（huí shēng bó shì、nǐ hǎo dǎo）。句首不大写。
- 我们查过的多音字：长大 zhǎng dà / 长颈鹿 cháng；得 dé（得到）/ de（说得）/ děi（我们得变强）；还 hái（还有）；都 dōu；行 xíng（不行、自行车、飞行员）；觉 jiào（睡觉、小觉）；了 le / liǎo（了不起）；着 zhe（看着、睡着一只小怪兽）/ zháo（睡着了 = 睡过去了）；乐 lè（快乐）/ yuè（音乐）；教 jiāo（教你中文）/ jiào（教学楼）；种 zhǒng（哪种、种子）；重 chóng（重新）；发 fā（发条、发亮、出发）；好 hǎo / hào（爱好）；为 wèi（为你骄傲）；只 zhī（一只、每只）/ zhǐ（只有、只会）；当 dāng（当冠军）；招 zhāo；转 zhuàn（钥匙在转）/ zhuǎn（旋转）；朝 cháo（朝你走过来）/ zhāo（朝阳）；场 chǎng（一场对战）；晃 huàng（蛋在晃）；倒 dǎo（砍倒）；爪 zhǎo（利爪）/ zhuǎ（八爪）；壳 ké（贝壳）；冠 guàn（冠军）/ guān（四叶冠）；薄 bò（薄荷）；照片 zhào piàn；谁 shéi。检查器只数音节，不认声调，写完自己再看一遍。

## 9. 模板里的空（批 g 的做法，供参考）

- `free` 的空要么写 `vals`（值和译文都在模板里），要么值本身就是一句 `lines` 里有的台词（游戏会去 `lines` 里找）。批 g 里这些模板**没写 vals、靠你们翻的台词**：鹦鹉门的问候语（Good morning! 等，`t1y18tyn`）、彩虹蟹广播 Walk on red! 等（`tex39sh`、`t10pe8m`）、蒂姆说的 desc 句子（`t1e2dden`）、社团岛的回答（Yes, I can. 等，`txg17ur`）、规则城游客的 miss 句子（`t1upuzq1`）。这些台词请照常翻成完整的句子（带句末标点），它们会被直接拼进模板。
- 数量读音：`还剩{x1}个` 的 x1 写「一 yí / 两 liǎng」；`第{x1}个按钮` 写「一 yī / 二 èr / 三 sān」。
- 颜色、天气、动物、家人、日期等我们在 vals 里用的词：红色、蓝色、黄色；晴天、下雨、刮风、下雪、多云；大象、猴子、长颈鹿、考拉、老虎、熊猫、斑马、企鹅、狮子；妈妈、爸爸、奶奶、爷爷、哥哥、姐姐、妹妹；日期「五月十五号」（汉字数字 + 月 + 号）；唱名「哆、咪、嗦」（duō mī suō）；面包师、学生、镇长；薯条、甜甜圈、糖果、汉堡包；苹果、西兰花、香蕉。同一岛的台词里出现这些东西，用同一个词。

## 10. 例句（批 a / 批 g 里的，看水平和语气）

| 原文 | 中文 | 说明 |
| --- | --- | --- |
| Hi there! You must be {name}, my new neighbour! | 你好！你就是{name}吧？我的新邻居！ | 「就是……吧」猜对方是谁 |
| I'm Professor Echo. I study how monsters learn English. | 我是回声博士。我研究怪兽怎么学中文。 | English → 中文 |
| Choose one shell and say hello in English! | 选一个贝壳，用中文跟它打个招呼吧！ | |
| Yay, I won! Don't be sad. Let me heal your monster. | 耶，我赢了！别难过。我来帮你的怪兽恢复体力。 | 对手：活泼 |
| Team Hush is everywhere. We must get stronger! | 到处都是嘘声团。我们得变得更强！ | 得 děi |
| Shh... go home, little trainer. | 嘘……回家吧，小训练师。 | 嘘声团：短、冷 |
| Words make people fight. A quiet world is a happy world. | 话一多，大家就会吵架。安静的世界才是快乐的世界。 | 不说「打架」 |
| Silence is peace! | 安静就是和平！ | 嘘声团口号（STORY.md） |
| Stop! You can't go north without this town's badge. | 站住！没有这个镇的徽章，不能往北走。 | 守卫 |
| Hi! What is this in English? | 嗨！这个用中文怎么说？ | 出题的村民 |
| Use a Quiet Spray, and wild monsters will not hear you. | 用了悄悄喷雾，野生怪兽就听不见你。 | 道具名照抄 |
| Let's learn English together!（speak） | 我们一起学中文吧！ | 要开口说的：短 |
| Don't break the rules!（speak） | 要守规则！ | 正面说更顺口 |
| {mon}, let's surf!（speak） | {mon}，带我游过去！ | 水上走不用那个两字老词 |
| {mon} is too tired to go on. | {mon}累得不能再战斗了。 | 不用「倒下了」 |
| Read your pass: "My name is {name}." | 读一读通行证：「我叫{name}。」 | 空后面的引号用「」 |
| Oops! These are {x1} prints. Back to the start! | 哎呀！这是{x1}的脚印。回到起点去！ | 「的」单独一块 |

## 11. 写完以后

现在只改 `tools/course/zh/lines.json`（分批文件已经合进去、不再用）。

1. `node tools/course/check.js zh`（0 处错；只查台词时加 `--lines`）。
2. 新加或改了的句子：对一下第 12 节的决定，名字、说法和别处一样。
3. `node tools/check-banned.js`（单独一条命令，看退出码）。
4. 再从头读一遍拼音：多音字、轻声、一 / 不。

## 12. 合并以后一致性检查的决定（2026-11-21，lines.json 是唯一的文件）

**名字**
- 人名一律拼音首字母大写，包括用词语当名字的：低语 Dī yǔ、闷雷 Mèn léi、智者 Zhì zhě、冰霜 Bīng shuāng（招式「冰霜咬」照小写）、利爪 Lì zhǎo、露娜 Lù nà。称号和怪兽、地名照小写（huí shēng bó shì、鹦鹉船长 yīng wǔ chuán zhǎng）。
- 定下来的音译名（全文件已统一，新句子照抄）：斯凯博士 Sī kǎi bó shì（Dr. Skye，气象台）、蒂姆 Dì mǔ（Tim，家庭岛的小男孩和 1 号路的小训练师都这样写）、山姆 Shān mǔ、凯特 Kǎi tè、汤姆 Tāng mǔ、莉莉 Lì li、罗莎 Luó shā（舞蹈社、巡林员、阿姨、王牌训练师几位都叫 Rosa 的都写罗莎）、罗丝奶奶 Luó sī nǎi nai、艾米 Ài mǐ、肯 Kěn、小金 Xiǎo Jīn（Kim）、托克 Tuō kè（钟楼管理员 Tock）、波波 Bō bō（才艺表演主持人 Bobo）、欧瑞 Ōu ruì、小凯 Xiǎo Kǎi、诺娃 Nuò wá、贝尔老师、盖尔船长、李警官、格雷老师、默先生 Mò xiān sheng。
- **Ann → 安妮 Ān nī**（单字「安」容易看成「安静」的安，已改）。
- 英文只写职业 + 名字的路人（Fisher Tom…）台词里不提名字就不用起。

**地方、东西**
- 挑战馆：`terms.place` 里有的照抄；英文给某座馆另起了名字的照英文译：Timetable Hall 课程表挑战馆、Traffic Hall 红绿灯挑战馆（规则城的那座，告示牌上叫规则城挑战馆，英文也是两个名字）、Birthday Hall 派对挑战馆、Sports Island Stadium 运动美食岛体育场（挑战馆）。gym 也译「挑战馆」。
- Memory Door 回忆之门、the sea door 大海之门（和 `terms.place.d12b` 一样）。the seal「封印」太难，说成门上的「锁」：锁快坏了！
- Route 11 是水路：十一号水路（和 `terms.place.s10` 一样）。
- 回声贝送技能时说道具全名，不加「」：这个送给你，它是开路回声贝。／你得到了水路回声贝！
- 升级的回声贝一律说：现在你能用「开路二级」打碎裂石了！／现在你能用「水路二级」潜下去了！（不说「『水路』升到二级」）。技能名在句子里加「」，照 `terms.skill`：开路、开路二级、开路三级、点灯、水路、水路二级、水路三级、乘风。
- smash 一律「打碎」（不用「敲碎」）。
- 属性照游戏的中文名 + 系：火系、水系、草系、电系、冰系、功夫系、毒系、大地系、飞行系、心灵系（Mind）、虫系、岩石系、幽灵系、龙系、暗系、钢系；普通的叫「普通系」。
- 按键：画面上的按钮写着 A，就写「按A键」（`按|A|键`，A 那一块的读音写 A），不说「大按钮」。

**学科**
- 原文的 English（学科）→ **中文**：星期一我们有数学、中文和科学。下面那行英文会被游戏改成 Chinese，对得上。
- 原文的 Chinese（学科）→ **语文**（中国学校的语文课，下面那行英文本来就是 Chinese）：星期二我们有语文、音乐和体育。／最后一门是语文。
- 所以中文课里同一个英文词 Chinese 对着两个中文词：「中文」是在学的这门语言，「语文」是课程表上的那门课。学科岛的书架和课程表地板分得开（一边是中文、一边是语文），可是下面那行英文两门都叫 Chinese——这一点只能由引擎在那两关里处理，已报给负责人。

**问答**
- 通用的短回答要和每一题都说得通、又和对的答案意思不一样：Yes, I can. → 好的，没问题！（用在「你能帮帮我们吗」「你会唱歌吗」）；No, it isn't. → 不，它不是。；Yes, I am. → 是的，我是。；Yes, it is. → 是的，它是。；Yes, I do. → 是的，我有。；No, I don't. → 不，我没有。；Me too! → 我也是！（生日那题的错选项）；Yes, please. → 要，谢谢！
- 钟点题：八点五十 / 八点一刻（不用「八点十五」，和「八点五十」只差前后顺序，听不出来；一刻在作息岛教过）。
- 过去 / 现在的对比选项用「每天、天天」对「了、昨天」，让意思听得出不一样（我天天关掉天气机 ／ 我关掉了天气机）。

**嗯**
- 只在问话的「嗯？」里用，读 ńg。想一想、犹豫的「嗯……」不用：去掉，或者换成「是啊」「这个……」「哎」。
- 「咦？」yí 表示没听懂、觉得奇怪。

**用词**
- 换掉的难词：封印 → 锁；温柔的世界 → 友好的世界；敲碎 → 打碎；失物招领处 → 我会帮它找到主人的；小鬼 / 小孩（嘘声团叫主角）→ 小朋友。
- 嘘声团的口号照 STORY.md：安静就是和平！

**拼音（全文件已经按这些改过）**
- 趋向补语读本调：看起来 kàn qǐ lái、走过来 zǒu guò lái、拿回来 ná huí lái、跳下去 tiào xià qù、出来 chū lái。例外：名词后面的「上」还是方位词：回到座位上去 zuò wèi shang qù。
- 方位词「边」读本调：北边 běi biān、旁边 páng biān、海边 hǎi biān；「上」「里」在名词后面读轻声（第 8 节）。
- 星星 xīng xing（怪兽名、招式名里也是）、月亮 yuè liang、力量 lì liang、力气 lì qi、故事 gù shi、知道 zhī dao、时候 shí hou、笑话 xiào hua、风筝 fēng zheng、灯笼 dēng long、肚子 dù zi、哎呀 āi yā、咕噜 gū lū、客人 kè rén、等等（叫人等一下）děng deng。
- 「个」：数词、每、整、几、哪一后面写 gè（一个 yí gè、每个 měi gè）；这个 / 那个 / 哪个，和动词后面的有个 / 是个 / 像个 / 打个 / 睡个写 ge。
- 动态助词「过」读轻声：说过 shuō guo、见过 jiàn guo、去过 qù guo；过来、过去、过关、过马路里的「过」读 guò。
- 地：做副词后缀时读 de（开心地 kāi xīn de、慢慢地），地方、地图、地上、基地里读 dì。
- 一、不：照第 8 节；星期一、周一、一班、石板一、数「一、二、三」读 yī；「是不是」「看不清」这种中间的「不」轻声 bu。
