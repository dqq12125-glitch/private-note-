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

## 13. 名字牌、招牌、按钮（`terms.person` / `sign` / `ui`，2026-11-21）

**名字牌（person，297 个）**：短，最好 2–6 个字，名字和台词里的写法一模一样。
- 职业在前、名字在后：渔夫汤姆、学生安妮、画家里奥、巡林员罗莎、登山者小峰。称呼放后面：李警官、乔爷爷、玛丽阿姨、蒂克镇长、格雷老师、布朗先生、朴太太。
- 职业词定下来的：Fisher 渔夫、Hiker 登山者、Camper 露营者、Swimmer 游泳者、Skier 滑雪者、Student 学生、Artist / Painter 画家、Scientist 科学家、Miner 矿工、Farmer 农民、Sailor 水手、Ranger 巡林员、Ace Trainer 高手、Veteran 老将、Fan 观众、Guest 客人、Aide / Assistant 助手、Bug Kid 捉虫小孩、Juggler 杂耍人、Drummer 鼓手、Singer 歌手、Pianist 钢琴手、Dancer 舞者、Coach …教练、Officer …警官、Traffic Officer 交警、Clerk 店员、Guard 守卫、Tourist 游客、Zookeeper 饲养员、Reporter 记者、Explorer 探险家、Monitor 班长、Club Leader 社长、MC 主持人、Keeper 管理员、Weather Man 气象员、Sea Patrol 巡逻员。
- 不能用的说法要绕开：Diver → 潜泳者（不写那个两字老词）；Psychic Rin → 读心人凛；Monk Sen / Ren → 守护人阿森 / 阿任（不写宗教身份）；Hiker Rocky → 罗基（不写和外国电影角色撞名的写法）；Librarian Mrs Page → 佩吉老师（不用和动画角色一样的译名）。
- 外国名字的音译（台词里也照这个）：Leo 里奥 Lǐ ào、Mia 米娅、Lily 莉莉 Lì li、Lucy 露西、Kate 凯特、Tom 汤姆、Sam 山姆（不用「萨姆」）、Ben 本、Dan 丹、Joe 乔、Max 麦克斯、Amy 艾米、Ann 安妮、Anna 安娜、Rosa 罗莎、Rose 罗丝、Sue 苏、Pat 帕特、Ray 雷、Gus 加斯、Jack 杰克、Pete 皮特、Finn 芬恩、Nina 妮娜、Nora 诺拉、Ivy 艾薇、Emma 艾玛、Ella 艾拉、Zoe 佐伊、Rita 丽塔、Ada 艾达、Iris 艾瑞斯、Owen 欧文、Toby 托比、Tony 托尼、Nick 尼克、Jay 杰伊、Rick 里克、Bob 鲍勃、Ken 肯、Kim 小金 / 金警官、Mei 小梅、May 梅、Park 朴 Piáo、Li 李、Wu 吴、Chen 陈、Lin 林、Tang 唐、Wang 王。双关的名字给个中文小名：Baker Bun 面包师阿邦、Baker Sugar 蛋糕师小糖、Hiker Summit 登山者小峰、Ranger Frost 巡林员阿霜。
- 对手 Leo / Mia（`person.leo` / `person.mia`）照拉丁字母写，和台词里的 `{rival}` 一样（游戏填进去的是英文名）。
- 擂主照第 5 节，只写名字：智者、露娜、冰霜、利爪（拼音大写）。会说话的东西：黑板、控制台、收音机（Radio）、广播（Hall Radio / Hall Speaker）、天气机、天气开关、回忆牌、回忆之门。

**招牌和地板字（sign，41 个）**：越短越好。教室地板：图书馆、食堂、走廊、办公室、教室、出口、电脑室、实验室、音乐。学科地板：数学、**中文**（English）、科学、美术、体育、**语文**（Chinese）、历史、地理（照第 12 节的学科决定）。音符：哆、咪、嗦。回忆馆的牌：去了、看见了、吃了、买了、旅行、海滩。价钱照原样留 ¥：牛肉面 ¥15。

**按钮（ui，15 个）**：双语按钮里这门语言的那一半，照它回答的那句话说：要 / 不要（选伙伴「你要它吗？」）、出发！、先不了、游上去、谢谢！、好啊！、下次吧、按下去！、绿灯，走！、红灯，停！、打开！、蛋、箱子、光荣榜。

## 14. 支线委托和今日目击（`quests.json`、`sight.json`，2026-11-21 第二轮）

格式看 `tools/course/TALK.md` 第二轮 A1 / A2：整句 `{ t, seg, r }`，词卡 `{ t, r }`。委托 17 条（185 句、121 个词卡），线索 157 句。检查：`node tools/course/check.js zh --quests --sight`。拿不准的地方和改了做法的地方记在 `review.md` 末尾。

### 14.1 属性名（线索里的 "It is a X monster."）

主会话 2026-11-21 定的规矩：属性名是这个游戏自己起的，中文课用 `dex.js` 的 `TYPES` 里游戏自己的中文名 + 「系」，**不用别的现成怪兽系列的中文属性叫法**（Kungfu / Mind / Shadow 这三个最容易顺手写错）。句式全文一个：「它是X系的怪兽。」，切成 `它|是|X系的|怪兽。`。

| 英文 | 中文 | 拼音 | | 英文 | 中文 | 拼音 |
| --- | --- | --- | --- | --- | --- | --- |
| Normal | 普通系 | pǔ tōng xì | | Flying | 飞行系 | fēi xíng xì |
| Fire | 火系 | huǒ xì | | Mind | 心灵系 | xīn líng xì |
| Water | 水系 | shuǐ xì | | Bug | 虫系 | chóng xì |
| Grass | 草系 | cǎo xì | | Rock | 岩石系 | yán shí xì |
| Spark | 电系 | diàn xì | | Ghost | 幽灵系 | yōu líng xì |
| Ice | 冰系 | bīng xì | | Dragon | 龙系 | lóng xì |
| Kungfu | 功夫系 | gōng fu xì | | Shadow | 暗系 | àn xì |
| Poison | 毒系 | dú xì | | Steel | 钢系 | gāng xì |
| Earth | 大地系 | dà dì xì | | | | |

「功夫」的「夫」读轻声（gōng fu）；「飞行」的「行」读 xíng。157 句里带属性的 50 句，对着 `dex.js` 逐句核对过。

### 14.2 委托里的人和名字

名字牌照 `terms.person`，句子里用到的：

| 英文 | 中文 | 拼音 | 在哪 |
| --- | --- | --- | --- |
| Ben（丢帽子的男孩） | 本 | Běn | q0-cap 的感谢 |
| Bobo（小露西的弟弟） | 波波 | Bō bō | q2-photo；和主持人波波同一个写法 |
| Mayor Tick / the mayor | 蒂克镇长 / 镇长 | Dì kè zhèn zhǎng | q6-tea |
| **Pop**（气球小丑的小怪兽，新定） | 波普 | Bō pǔ | q7-party；是起的名字，拼音大写 |
| Nightpaw | 夜爪狸 | yè zhǎo lí | q8-missing；照 `terms.monster` |
| Coach Tom's team | 汤姆教练的运动队 | Tāng mǔ jiào liàn de yùn dòng duì | q10-order |
| dear（老太太叫主角） | 孩子 | hái zi | 和海龟奶奶一样 |
| young trainer / a good trainer | 小训练师 / 好训练师 | | |

只在服务器的英文人设里出现、译文里没写到的名字，岛民说中文时该这样叫（给拼人设的人参考）：Fisher Tom 渔夫汤姆、Finn 芬恩（科斯塔先生扮的客人，从彩色文具岛来）、Lucy 露西、Farmer Joe 农民乔。

### 14.3 委托里的东西、地方、说法

| 英文 | 中文 | 拼音 |
| --- | --- | --- |
| You remember:（旁白） | 你记得： | nǐ jì de |
| the owner | 帽子的主人 / 帽子是谁的 | zhǔ rén |
| take it back | 送回去（不用「把」） | sòng huí qù |
| visitor | 客人 | kè rén |
| the island greeter | 不用名词：我在岛上欢迎客人 | |
| the stationery store | 文具店 | wén jù diàn |
| the list / the team's note | 单子 / 纸条 | dān zi / zhǐ tiáo |
| the lost and found | 不说地方：有人捡到了三个书包（照第 12 节，不用那个五字词） | |
| eraser / pencil box | 橡皮 / 铅笔盒 | xiàng pí / qiān bǐ hé |
| gate（农场、学校的） | 大门 | dà mén |
| windmill / cow / little pig | 风车 / 牛（一头牛）/ 小猪 | fēng chē / niú / xiǎo zhū |
| These fruits（奖励的道具） | 元气果（照 `terms.item`） | yuán qì guǒ |
| across from / next to | 对面 / 旁边 | duì miàn / páng biān |
| the English classroom | **教室**（为什么不写是哪门课的，见 review.md） | jiào shì |
| the school shop / the PE room | 学校商店 / 体育室 | tǐ yù shì |
| sports day / the plan / notice board | 运动会 / 计划 / 公告栏 | yùn dòng huì / jì huà / gōng gào lán |
| meet（集合） | 集合 | jí hé |
| the maths club / chess club / art club | 数学社 / 国际象棋社 / 美术社 | shù xué shè |
| join（社团） | 参加（第 5 岛教的；台词里已有的「加入」不动） | cān jiā |
| free（有空） | 有时间（不用「有空」：空 kòng 是多音字，「有时间」1 级教过） | yǒu shí jiān |
| the club show | 社团的画展 | huà zhǎn |
| come for tea / tea time | 来喝茶 / 喝茶的时间 | hē chá |
| surprise party / party bag | 惊喜派对 / 派对礼包 | jīng xǐ pài duì / lǐ bāo |
| the Animal Park / the tree house / bin | 动物公园 / 树屋 / 垃圾桶 | shù wū |
| a black mask on its face | 脸上有黑色的面具 | miàn jù |
| the City Garden | 城市花园 | chéng shì huā yuán |
| politely / polite | 有礼貌地 / 有礼貌 | yǒu lǐ mào de |
| reason | 理由 | lǐ yóu |
| food stall | 小吃摊 | xiǎo chī tān |
| order（点吃的） | 点菜 | diǎn cài |
| beef noodles / orange juice | 牛肉面（三碗）/ 橙汁（两杯） | niú ròu miàn / chéng zhī |
| Snow Mountain / the ice lake / the station | 雪山 / 冰湖 / 气象台 | xuě shān / bīng hú / qì xiàng tái |
| the weather report / heavy snow | 天气预报 / 下大雪 | tiān qì yù bào / xià dà xuě |
| warm coat / gloves | 暖和的外套 / 手套 | nuǎn huo de wài tào / shǒu tào |
| photo album / the fog / memories / trip | 相册 / 雾 / 回忆 / 旅行 | xiàng cè / wù / huí yì / lǚ xíng |
| waterfall / rainbow / little dragon | 瀑布 / 彩虹 / 小龙 | pù bù / cǎi hóng |
| went / saw / took photos | 去了 / 看见了 / 拍了照片（和回忆馆的牌子一样） | qù le / kàn jiàn le |
| egg | 怪兽蛋 | guài shòu dàn |
| Take these / This is for you | 这些送给你 / 这个送给你 | sòng gěi |
| Hello again | 又见面了 | yòu jiàn miàn le |
| Hmm...（犹豫） | 不用「嗯」：哎…… / 直接去掉（照第 12 节） | āi |
| Psst! / Shh! | 嘘！ | xū |
| Ahem! | 咳咳！ | ké ké |

- 示范句不用「把」、不用可能补语，尽量是小镇和 1 级教过的句型：有 / 没有 + 数量、在 + 方位、你会 / 喜欢做什么、星期几、几点、是……的、了。
- 词卡片要整词出现在学的人说的话里才变绿，所以词卡照示范句里的原样写（「长什么样子」「你的书包里」「有一头」「在吃」），不照英文逐词写；"Let's" 写「吧」，"o'clock" 写「点」。

### 14.4 线索的对照表（英语的每个半句只有一个译法）

线索是模板拼的，译文也是一个半句一个半句对着拼的；以后改哪个半句，带这个半句的每一句都要一起改（一共 98 种半句，读音看 `sight.json`）。

| 英语半句 | 中文 |
| --- | --- |
| It hides in the tall grass. | 它躲在高高的草丛里。 |
| It hides in the cave. Walk around inside. | 它躲在山洞里。在里面多走走。 |
| It swims on top of the water. Ride on the water to find it. | 它在水面上游泳。去水上找它。 |
| It hides in the seaweed. | 它躲在海草里。 |
| It is a X monster. | 它是X系的怪兽。（14.1） |
| It is blue / green / grey / orange / red / white / yellow. | 它是蓝色的 / 绿色的 / 灰色的 / 橙色的 / 红色的 / 白色的 / 黄色的。 |
| It is big. / It is very small. | 它很大。/ 它非常小。 |
| It is round like a ball. | 它圆圆的，像一个球。 |
| It has a long body like a snake. | 它的身体长长的，像一条蛇。 |
| It has a shell on its back. | 它背上有一个壳。 |
| It looks like a bird / a bug / a fish / a little ghost / a plant. | 它看起来像一只鸟 / 一只虫子 / 一条鱼 / 一个小幽灵 / 一棵植物。 |
| It stands on two legs. / It walks on four legs. | 它用两条腿站着。/ 它用四条腿走路。 |
| It is on a road. / on a sandy road. | 它在一条路上。/ 它在一条全是沙子的路上。 |
| It is on a road by the sea / by a river / around the farms. | 它在海边的 / 河边的 / 绕着农田的一条路上。 |
| It is in the woods. / on a beach. / on a cliff by the sea. | 它在树林里。/ 它在一片沙滩上。/ 它在海边的悬崖上。 |
| It is high on a mountain. / in a field of snow. | 它在高高的山上。/ 它在一片雪地里。 |
| It is on a path in the jungle. | 它在丛林里的一条小路上。 |
| It is in a dark cave. / in a cave of ice. / in a tunnel. | 它在一个很黑的山洞里。/ 它在一个冰洞里。/ 它在一条隧道里。 |
| It is in a hot cave inside a mountain. | 它在山里面的一个很热的山洞里。 |
| It is out at sea. / under the sea. / on an island. | 它在海上。/ 它在海底。/ 它在一座岛上。 |
| Go north / south / east / west from the town. | 从小镇往北 / 往南 / 往东 / 往西走。 |
| The way in is in the town. | 入口就在小镇里。 |
| It is far from the town. | 它离小镇很远。 |
| Walk along a road first. / Walk along a cliff first. | 要先走过一条路。/ 要先沿着悬崖走一段。 |
| Climb a mountain first. | 要先爬上一座山。 |
| Walk through the woods / a tunnel / a hot cave / a cave of ice first. | 要先穿过树林 / 一条隧道 / 一个很热的山洞 / 一个冰洞。 |
| Go out to sea and dive down. | 先到海上去，再潜下去。 |
| People there say hello and good morning to everyone. | 那里的人对大家说“你好”和“早上好”。 |
| … love pens, pencils and rulers in every colour. | 那里的人很喜欢各种颜色的钢笔、铅笔和尺子。 |
| … love to talk about their father, mother and family. | 那里的人很喜欢聊爸爸、妈妈和家人。 |
| … talk about the classroom, the library and the playground. | 那里的人常常聊教室、图书馆和操场。 |
| … love English, maths and science. | 那里的人很喜欢**中文**、数学和科学。（照第 3 节） |
| … sing, dance and play chess in their clubs. | 那里的人在社团里唱歌、跳舞、下棋。 |
| … always get up and have breakfast on time. | 那里的人总是准时起床、准时吃早饭。 |
| … love birthday parties, cakes and balloons. | 那里的人很喜欢生日派对、蛋糕和气球。 |
| … talk about pandas, tigers and monkeys. | 那里的人常常聊熊猫、老虎和猴子。 |
| … must follow many rules and be quiet. | 那里的人要守很多规则，还要安静。 |
| … play basketball and eat healthy food. | 那里的人打篮球、吃健康的食物。 |
| … talk about sunny, rainy and snowy weather. | 那里的人常常聊晴天、下雨天和下雪天。 |
| There are palm trees and white houses with red roofs there. | 那里有棕榈树和红屋顶的白房子。 |
| … trees like big pencils and houses in bright colours … | 那里有像大铅笔一样的树和彩色的房子。 |
| … orange autumn trees and wooden farm houses … | 那里有橙色的秋天的树和农场的木头房子。 |
| … round green trees and red brick buildings / tall buildings … | 那里有圆圆的绿树和红砖楼 / 高楼。 |
| … tall thin trees and round glass houses … | 那里有又高又细的树和圆圆的玻璃房子。 |
| … palm trees and big tents … | 那里有棕榈树和大帐篷。 |
| … dark green pine trees and stone towers with clocks … | 那里有深绿色的松树和有钟的石塔。 |
| … trees like lollipops and houses like cakes … | 那里有像棒棒糖一样的树和像蛋糕一样的房子。 |
| … big jungle trees and tree houses … | 那里有丛林大树和树屋。 |
| … fruit trees and small shops … | 那里有果树和小商店。 |
| … pine trees with snow on them and wooden houses with snow on the roofs … | 那里的松树上有雪，木头房子的屋顶上也有雪。 |

- 方向、地形、颜色、大小一个字都不能含糊：north 北、south 南、east 东、west 西；"hides" 一律「躲在」；水上去找不用那个两字老词，潜下去照第 6 节。
- 新写到的读音：棕榈树 zōng lǘ shù、悬崖 xuán yá、隧道 suì dào、丛林 cóng lín、入口 rù kǒu、植物 zhí wù、壳 ké、背上 bèi shang（背 bèi）、长长的 cháng cháng de、看起来 kàn qǐ lái、走走 zǒu zou、穿过 / 走过 chuān guò / zǒu guò（「过」是「经过」，不是轻声的「过」）、各种 gè zhǒng、准时 zhǔn shí、木头 mù tou、玻璃 bō li、帐篷 zhàng peng。
