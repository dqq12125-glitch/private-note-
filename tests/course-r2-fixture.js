// 第二轮（tools/course/TALK.md「第二轮」）的小样内容：别的语言的课里的支线委托、今日目击的线索。
// tests/course-talk.test.js（委托）、tests/course-sight.test.js（目击）用。不是正式的翻译（正式的在 tools/course/<语言>/quests.json、sight.json，
// 由 tools/course/build.js 并进 course.json）——只挑测试要走到的：第一条委托（q0-cap）的请求 / 感谢 / 开场白 / 示范句 / 词卡、几条线索。
// apply(course, 语言, { quests, sight }) 照 build.js 出的样子塞进一份 course.json：
//   LINES[英语原文] = 译文（委托的 ask / thanks / bye、线索的整句）；QUESTS[id] = { opener, steps, words }；TERMS.person 委托人的名字牌
// 西语是字符串，日语、中文带读音（{ t, seg, r }；词 { t, r }）——界面那边两种都要认
'use strict';

// ---------- 委托 q0-cap（你好岛的 Ms Rosa：蓝帽子是谁的）----------
const ASK = ['Oh dear! Somebody left a blue cap on the beach.', 'I know the owner, but my legs are tired today.', 'Can you take it back for me? Ask me about the owner!'];
const THANKS = ['You found Ben! He is so happy to have his cap back.', 'Thank you for your help. Please take these!'];
const BYE = 'Hello again, dear! Ben wears his cap every day now.';
const S = (t, seg, r) => ({ t, seg, r });
const QUEST = {
  es: {
    who: 'Sra. Rosa',
    ask: ['¡Ay, no! Alguien dejó una gorra azul en la playa.', 'Conozco al dueño, pero hoy tengo las piernas cansadas.', '¿Puedes devolvérsela por mí? ¡Pregúntame por el dueño!'],
    thanks: ['¡Encontraste a Ben! Está muy feliz de tener su gorra otra vez.', 'Gracias por tu ayuda. ¡Toma esto, por favor!'],
    bye: '¡Hola otra vez, cariño! Ahora Ben lleva su gorra todos los días.',
    opener: '¡Gracias, cariño! Entonces, ¿qué quieres saber del dueño?',
    steps: ['¿Cómo se llama?', '¿Cómo es?', '¿Dónde está ahora?'],
    // 词卡照正式翻译的写法：名词带冠词、问句带问号（聊天里说到了要变绿：talk.js 的 wordHit）；
    // 第 4 个词的中文意思带着讲英语的括号（quests.js 里给学英语的人写的那种）：别的课里显示时要去掉
    words: [['¿De quién?', '谁的', 'Whose'], ['la gorra', '帽子', 'cap'], ['el nombre', '名字', 'name'], ['¿Cómo es?', '长什么样（look like 后面接名词）', 'look like'], ['¿Dónde?', '在哪里', 'Where'], ['gracias', '谢谢', 'Thank you']],
  },
  ja: {
    who: { t: 'ローザさん', r: 'ろーざさん' },
    ask: [
      S('あら！だれかが青いぼうしを浜べにわすれました。', ['あら！', 'だれかが', '青い', 'ぼうしを', '浜べに', 'わすれました。'], ['あら', 'だれかが', 'あおい', 'ぼうしを', 'はまべに', 'わすれました']),
      S('持ち主を知っていますが、今日は足がつかれています。', ['持ち主を', '知って', 'いますが、', '今日は', '足が', 'つかれて', 'います。'], ['もちぬしを', 'しって', 'いますが', 'きょうは', 'あしが', 'つかれて', 'います']),
      S('かわりに返してくれますか？持ち主のことを聞いてください！', ['かわりに', '返して', 'くれますか？', '持ち主の', 'ことを', '聞いて', 'ください！'], ['かわりに', 'かえして', 'くれますか', 'もちぬしの', 'ことを', 'きいて', 'ください']),
    ],
    thanks: [
      S('ベンを見つけましたね！ぼうしがもどって、とてもよろこんでいます。', ['ベンを', '見つけましたね！', 'ぼうしが', 'もどって、', 'とても', 'よろこんで', 'います。'], ['べんを', 'みつけましたね', 'ぼうしが', 'もどって', 'とても', 'よろこんで', 'います']),
      S('手伝ってくれてありがとう。これをどうぞ！', ['手伝って', 'くれて', 'ありがとう。', 'これを', 'どうぞ！'], ['てつだって', 'くれて', 'ありがとう', 'これを', 'どうぞ']),
    ],
    bye: S('また会いましたね！ベンは毎日ぼうしをかぶっています。', ['また', '会いましたね！', 'ベンは', '毎日', 'ぼうしを', 'かぶって', 'います。'], ['また', 'あいましたね', 'べんは', 'まいにち', 'ぼうしを', 'かぶって', 'います']),
    opener: S('ありがとう！では、持ち主の何を知りたいですか？', ['ありがとう！', 'では、', '持ち主の', '何を', '知りたいですか？'], ['ありがとう', 'では', 'もちぬしの', 'なにを', 'しりたいですか']),
    steps: [
      S('名前は何ですか？', ['名前は', '何ですか？'], ['なまえは', 'なんですか']),
      S('どんな人ですか？', ['どんな', '人ですか？'], ['どんな', 'ひとですか']),
      S('今どこにいますか？', ['今', 'どこに', 'いますか？'], ['いま', 'どこに', 'いますか']),
    ],
    words: [[{ t: 'だれの', r: 'だれの' }, '谁的', 'Whose'], [{ t: 'ぼうし', r: 'ぼうし' }, '帽子', 'cap'], [{ t: '名前', r: 'なまえ' }, '名字', 'name'], [{ t: 'どんな人', r: 'どんなひと' }, '什么样的人（look like）', 'look like'],
      [{ t: 'どこ', r: 'どこ' }, '在哪里', 'Where'], [{ t: 'ありがとう', r: 'ありがとう' }, '谢谢', 'Thank you']],
  },
  zh: {
    who: { t: '罗莎奶奶', r: 'luó shā nǎi nai' },
    ask: [
      S('哎呀！有人把一顶蓝帽子落在沙滩上了。', ['哎呀！', '有人', '把', '一顶', '蓝帽子', '落在', '沙滩上', '了。'], ['āi yā', 'yǒu rén', 'bǎ', 'yì dǐng', 'lán mào zi', 'là zài', 'shā tān shang', 'le']),
      S('我知道失主是谁，可是我今天腿很累。', ['我', '知道', '失主', '是', '谁，', '可是', '我', '今天', '腿', '很', '累。'], ['wǒ', 'zhī dào', 'shī zhǔ', 'shì', 'shéi', 'kě shì', 'wǒ', 'jīn tiān', 'tuǐ', 'hěn', 'lèi']),
      S('你能帮我送回去吗？问问我失主的事吧！', ['你', '能', '帮', '我', '送回去', '吗？', '问问', '我', '失主', '的', '事', '吧！'], ['nǐ', 'néng', 'bāng', 'wǒ', 'sòng huí qù', 'ma', 'wèn wen', 'wǒ', 'shī zhǔ', 'de', 'shì', 'ba']),
    ],
    thanks: [
      S('你找到本了！帽子回来了，他很高兴。', ['你', '找到', '本', '了！', '帽子', '回来了，', '他', '很', '高兴。'], ['nǐ', 'zhǎo dào', 'běn', 'le', 'mào zi', 'huí lái le', 'tā', 'hěn', 'gāo xìng']),
      S('谢谢你帮忙。这些请收下！', ['谢谢', '你', '帮忙。', '这些', '请', '收下！'], ['xiè xie', 'nǐ', 'bāng máng', 'zhè xiē', 'qǐng', 'shōu xià']),
    ],
    bye: S('又见面了！本现在天天戴着那顶帽子。', ['又', '见面了！', '本', '现在', '天天', '戴着', '那顶', '帽子。'], ['yòu', 'jiàn miàn le', 'běn', 'xiàn zài', 'tiān tiān', 'dài zhe', 'nà dǐng', 'mào zi']),
    opener: S('谢谢你！那么，你想知道失主的什么事？', ['谢谢', '你！', '那么，', '你', '想', '知道', '失主', '的', '什么', '事？'], ['xiè xie', 'nǐ', 'nà me', 'nǐ', 'xiǎng', 'zhī dào', 'shī zhǔ', 'de', 'shén me', 'shì']),
    steps: [
      S('他叫什么名字？', ['他', '叫', '什么', '名字？'], ['tā', 'jiào', 'shén me', 'míng zi']),
      S('他长什么样？', ['他', '长', '什么样？'], ['tā', 'zhǎng', 'shén me yàng']),
      S('他现在在哪里？', ['他', '现在', '在', '哪里？'], ['tā', 'xiàn zài', 'zài', 'nǎ lǐ']),
    ],
    words: [[{ t: '谁的', r: 'shéi de' }, '', 'Whose'], [{ t: '帽子', r: 'mào zi' }, '', 'cap'], [{ t: '名字', r: 'míng zi' }, '', 'name'], [{ t: '长什么样', r: 'zhǎng shén me yàng' }, '', 'look like'],
      [{ t: '在哪里', r: 'zài nǎ lǐ' }, '', 'Where'], [{ t: '谢谢', r: 'xiè xie' }, '', 'Thank you']],
  },
};

// ---------- 今日目击的线索：1 号路（r0，草丛）上的书虫虫（bookworm）----------
// LOOK / TOPIC：第 1 座岛的两种说法；DIR：从小镇往北；TYPE：躲在草丛里 + 属性。别的说法（颜色、样子……）故意不翻：测「查不到译文这一天不出」
const LOOK = 'It is on an island. There are palm trees and white houses with red roofs there.';
const TOPIC = 'It is on an island. People there say hello and good morning to everyone.';
const DIR = 'It is on a road. Go north from the town.';
const TYPE = 'It hides in the tall grass. It is a Bug monster.';
// 第 5 座岛（学科岛）海边那条路（r4）：ENG 这一句原文说的是「English」，译文里是在学的这门语言——下面那行意思也要跟着换；SEA：海边的路、往东
const ENG = 'It is on an island. People there love English, maths and science.';
const SEA = 'It is on a road by the sea. Go east from the town.';
const SIGHT = {
  es: {
    [LOOK]: 'Está en una isla. Allí hay palmeras y casas blancas con techos rojos.',
    [TOPIC]: 'Está en una isla. Allí la gente dice hola y buenos días a todos.',
    [DIR]: 'Está en un camino. Ve al norte desde el pueblo.',
    [TYPE]: 'Se esconde en la hierba alta. Es un monstruo de tipo Bicho.',
    [ENG]: 'Está en una isla. Allí a la gente le encantan el español, las matemáticas y las ciencias.',
    [SEA]: 'Está en un camino junto al mar. Ve al este desde el pueblo.',
  },
  ja: {
    [LOOK]: S('それは島にいます。ヤシの木と赤い屋根の白い家があります。', ['それは', '島に', 'います。', 'ヤシの', '木と', '赤い', '屋根の', '白い', '家が', 'あります。'], ['それは', 'しまに', 'います', 'やしの', 'きと', 'あかい', 'やねの', 'しろい', 'いえが', 'あります']),
    [TOPIC]: S('それは島にいます。そこの人はみんなに「こんにちは」と言います。', ['それは', '島に', 'います。', 'そこの', '人は', 'みんなに', '「こんにちは」と', '言います。'], ['それは', 'しまに', 'います', 'そこの', 'ひとは', 'みんなに', 'こんにちはと', 'いいます']),
    [DIR]: S('それは道にいます。町から北へ行ってください。', ['それは', '道に', 'います。', '町から', '北へ', '行って', 'ください。'], ['それは', 'みちに', 'います', 'まちから', 'きたへ', 'いって', 'ください']),
    [TYPE]: S('それは高い草の中にかくれています。むしタイプのモンスターです。', ['それは', '高い', '草の', '中に', 'かくれて', 'います。', 'むしタイプの', 'モンスターです。'], ['それは', 'たかい', 'くさの', 'なかに', 'かくれて', 'います', 'むしたいぷの', 'もんすたーです']),
    [ENG]: S('それは島にいます。そこの人は日本語と数学と理科が大好きです。', ['それは', '島に', 'います。', 'そこの', '人は', '日本語と', '数学と', '理科が', '大好きです。'], ['それは', 'しまに', 'います', 'そこの', 'ひとは', 'にほんごと', 'すうがくと', 'りかが', 'だいすきです']),
    [SEA]: S('それは海のそばの道にいます。町から東へ行ってください。', ['それは', '海の', 'そばの', '道に', 'います。', '町から', '東へ', '行って', 'ください。'], ['それは', 'うみの', 'そばの', 'みちに', 'います', 'まちから', 'ひがしへ', 'いって', 'ください']),
  },
  zh: {
    [LOOK]: S('它在一座岛上。那里有棕榈树和红屋顶的白房子。', ['它', '在', '一座', '岛上。', '那里', '有', '棕榈树', '和', '红屋顶', '的', '白房子。'], ['tā', 'zài', 'yí zuò', 'dǎo shang', 'nà lǐ', 'yǒu', 'zōng lǘ shù', 'hé', 'hóng wū dǐng', 'de', 'bái fáng zi']),
    [TOPIC]: S('它在一座岛上。那里的人见到谁都说你好和早上好。', ['它', '在', '一座', '岛上。', '那里', '的', '人', '见到', '谁', '都', '说', '你好', '和', '早上好。'], ['tā', 'zài', 'yí zuò', 'dǎo shang', 'nà lǐ', 'de', 'rén', 'jiàn dào', 'shéi', 'dōu', 'shuō', 'nǐ hǎo', 'hé', 'zǎo shang hǎo']),
    [DIR]: S('它在一条路上。从小镇往北走。', ['它', '在', '一条', '路上。', '从', '小镇', '往', '北', '走。'], ['tā', 'zài', 'yì tiáo', 'lù shang', 'cóng', 'xiǎo zhèn', 'wǎng', 'běi', 'zǒu']),
    [TYPE]: S('它躲在高高的草丛里。它是虫系的怪兽。', ['它', '躲在', '高高的', '草丛里。', '它', '是', '虫系', '的', '怪兽。'], ['tā', 'duǒ zài', 'gāo gāo de', 'cǎo cóng lǐ', 'tā', 'shì', 'chóng xì', 'de', 'guài shòu']),
    [ENG]: S('它在一座岛上。那里的人很喜欢中文、数学和科学。', ['它', '在', '一座', '岛上。', '那里', '的', '人', '很', '喜欢', '中文、', '数学', '和', '科学。'], ['tā', 'zài', 'yí zuò', 'dǎo shang', 'nà lǐ', 'de', 'rén', 'hěn', 'xǐ huan', 'zhōng wén', 'shù xué', 'hé', 'kē xué']),
    [SEA]: S('它在海边的一条路上。从小镇往东走。', ['它', '在', '海边', '的', '一条', '路上。', '从', '小镇', '往', '东', '走。'], ['tā', 'zài', 'hǎi biān', 'de', 'yì tiáo', 'lù shang', 'cóng', 'xiǎo zhèn', 'wǎng', 'dōng', 'zǒu']),
  },
};
// 目击的怪兽在这门课里的名字（TERMS.monster；西语照英文不翻）
const MON = { ja: { Bookworm: { t: 'ホンムシ', r: 'ほんむし' } }, zh: { Bookworm: { t: '书虫虫', r: 'shū chóng chong' } } };

const textOf = v => (typeof v === 'string' ? v : v.t);
// 往一份 course.json 里塞小样（改的是传进来的那份）。o.quests / o.sight：要哪一样（不给 = 两样都要）
function apply(course, lang, o) {
  o = o || { quests: true, sight: true };
  course.LINES = Object.assign({}, course.LINES);
  course.TERMS = Object.assign({}, course.TERMS);
  if (o.quests) {
    const Q = QUEST[lang];
    ASK.forEach((en, k) => { course.LINES[en] = Q.ask[k]; });
    THANKS.forEach((en, k) => { course.LINES[en] = Q.thanks[k]; });
    course.LINES[BYE] = Q.bye;
    course.TERMS.person = Object.assign({}, course.TERMS.person, { 'Ms Rosa': Q.who });
    // names：这条委托的英文原文里出现的名字在这门课里的写法（build.js 按台词翻译表的词配的那张名字表）——界面拿它换目标说明里的名字
    course.QUESTS = Object.assign({}, course.QUESTS, { 'q0-cap': { opener: Q.opener, steps: Q.steps, words: Q.words, names: [['Ms Rosa', textOf(Q.who)]] } });
  }
  if (o.sight) {
    Object.assign(course.LINES, SIGHT[lang]);
    if (MON[lang]) course.TERMS.monster = Object.assign({}, course.TERMS.monster, MON[lang]);
  }
  return course;
}
module.exports = { QUEST, SIGHT, MON, ASK, THANKS, BYE, LOOK, TOPIC, DIR, TYPE, ENG, SEA, textOf, apply };
