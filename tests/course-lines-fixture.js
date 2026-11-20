// 台词翻译表的小样（tools/course/SPEC.md §8）：tests/course-build.test.js、tests/course-lines.test.js 用。
// 不是正式的翻译（正式的在 tools/course/<语言>/lines.json，内容那一路写）：只挑测试要走到的几句——开场（选照片、写名字、念通行证）、
// 选伙伴的贝壳、大地图的一页对话、告示牌、说话任务、回声技能的指令、对战喊话、拿到 / 捡到道具，和它们用到的词；
// 第三批：「现在要做」引着的原句（从剧情台词的引号里来）、意思里引着英语的、意思是讲英语的（不显示）、带对手名字的。
// 这里按英语原文写（好读），toLines(语言) 按 tools/course/lines-src.json 换成 id，写成 lines.json 的样子
'use strict';
const fs = require('fs');
const path = require('path');

const ES = {
  lines: {
    'Which photo is you?': '¿Qué foto eres tú?',
    'Now write your English name on it.': 'Ahora escribe tu nombre.',
    'Read your pass out loud: "My name is {name}."': 'Lee tu pase en voz alta: «Me llamo {name}.»',
    'My name is {name}.': 'Me llamo {name}.',
    'Great! Your Island Pass is ready.': '¡Genial! Tu pase de la isla está listo.',
    "I'm a boy.": 'Soy un chico.',
    "I'm a girl.": 'Soy una chica.',
    'Which shell will you open?': '¿Qué concha vas a abrir?',
    'Talk to everyone. They will teach you English!': 'Habla con todos. ¡Te enseñarán español!',
    'Hello again, {name}! How is your monster?': '¡Hola otra vez, {name}! ¿Cómo está tu monstruo?',
    'Now, can you say this to me?': 'Ahora, ¿me lo puedes decir?',
    'Nice to meet you, Professor!': '¡Mucho gusto, profesora!',
    // 学科岛：课程表上的 English 和 Chinese 是两门课（意思那一行不能都变成同一个名字）
    'On Monday we have maths, English and science.': 'El lunes tenemos matemáticas, español y ciencias.',
    'On Tuesday we have Chinese, music and PE.': 'El martes tenemos chino, música y educación física.',
    // 回忆挑战馆的词牌
    went: 'fue',
    // 第三批：提示里引着的原句（「现在要做」从这句的引号里拿到译文）、意思里引着英语的、意思是讲英语的、带对手名字的
    'Please find them! Ask them: "Are you Tim\'s mom?"': '¡Búscalos, por favor! Pregúntales: “¿Eres la mamá de Tim?”',
    'Please ask the baker, the student and the mayor: "What time do you get up?"': 'Por favor, pregunta al panadero, a la estudiante y al alcalde: “¿A qué hora te levantas?”',
    'Half past six means six thirty.': 'Las seis y media son las seis treinta.',
    '{rival} wants to be the English Champion!': '¡{rival} quiere ser el campeón!',
  },
  templates: {
    '{mon} is a {type} monster. Will you take it?': '{mon} es de tipo {type}. ¿Te lo llevas?',
    '{mon}, be my partner!': '¡{mon}, sé mi compañero!',
    "{mon}, let's surf!": '¡{mon}, vamos a surfear!',
    '{mon}, your turn!': '¡{mon}, te toca!',
    'Look out! Here comes {mon}!': '¡Cuidado! ¡Ahí viene {mon}!',
    'You got {item}!': '¡Conseguiste: {item}!',
    'You found a {item}!': { t: '¡Encontraste un {item}!', f: '¡Encontraste una {item}!' },
  },
  // 怪兽名不写：游戏里照英文原样填（专有名词）
  terms: {
    item: { Potion: { t: 'poción', g: 'f' }, 'Echo Ball': { t: 'bola eco', g: 'f' }, 'Big Potion': { t: 'poción grande', g: 'f' }, 'Return Rope': 'cuerda de regreso' },
    type: { fire: 'fuego', water: 'agua', grass: 'planta', electric: 'eléctrico' },
    place: { 'Hello Island': 'Isla Hola' },
    // 画面上的名字（SPEC §8.1）：对话框的名字牌、房子的招牌、按钮上的词、招式
    person: { Mom: 'Mamá', 'Professor Echo': 'Profesora Echo' },
    sign: { 'REST STOP': 'DESCANSO', SHOP: 'TIENDA', 'CHALLENGE HALL': 'SALA' },
    ui: { YES: 'SÍ', NO: 'NO' },
    move: { 'Bubble Shot': 'Disparo de burbujas', 'Body Bump': 'Empujón', 'Sweet Rest': 'Dulce descanso' },
  },
};

const JA = {
  lines: {
    'Which photo is you?': { t: 'どの写真があなた？', seg: ['どの', '写真が', 'あなた？'], r: ['どの', 'しゃしんが', 'あなた'] },
    'Now write your English name on it.': { t: '名前を書いてね。', seg: ['名前を', '書いてね。'], r: ['なまえを', 'かいてね'] },
    'Read your pass out loud: "My name is {name}."': { t: 'パスを読んでね：「わたしは{name}です。」', seg: ['パスを', '読んでね：', '「わたしは', '{name}', 'です。」'], r: ['ぱすを', 'よんでね', 'わたしは', '{name}', 'です'] },
    'My name is {name}.': { t: 'わたしは{name}です。', seg: ['わたしは', '{name}', 'です。'], r: ['わたしは', '{name}', 'です'] },
    'Great! Your Island Pass is ready.': { t: 'できた！島のパスだよ。', seg: ['できた！', '島の', 'パスだよ。'], r: ['できた', 'しまの', 'ぱすだよ'] },
    "I'm a boy.": { t: 'ぼくは男の子です。', seg: ['ぼくは', '男の子', 'です。'], r: ['ぼくは', 'おとこのこ', 'です'] },
    "I'm a girl.": { t: 'わたしは女の子です。', seg: ['わたしは', '女の子', 'です。'], r: ['わたしは', 'おんなのこ', 'です'] },
    'Which shell will you open?': { t: 'どの貝を開ける？', seg: ['どの', '貝を', '開ける？'], r: ['どの', 'かいを', 'あける'] },
    'Talk to everyone. They will teach you English!': { t: 'みんなと話そう。日本語を教えてくれるよ！', seg: ['みんなと', '話そう。', '日本語を', '教えて', 'くれるよ！'], r: ['みんなと', 'はなそう', 'にほんごを', 'おしえて', 'くれるよ'] },
    'Hello again, {name}! How is your monster?': { t: 'また会ったね、{name}！モンスターは元気？', seg: ['また', '会ったね、', '{name}！', 'モンスターは', '元気？'], r: ['また', 'あったね', '{name}', 'もんすたーは', 'げんき'] },
    'Now, can you say this to me?': { t: 'じゃあ、これを言ってみて。', seg: ['じゃあ、', 'これを', '言ってみて。'], r: ['じゃあ', 'これを', 'いってみて'] },
    'Nice to meet you, Professor!': { t: '博士、はじめまして！', seg: ['博士、', 'はじめまして！'], r: ['はかせ', 'はじめまして'] },
    'On Monday we have maths, English and science.': { t: '月曜日は、算数、日本語、理科です。', seg: ['月曜日は、', '算数、', '日本語、', '理科です。'], r: ['げつようびは', 'さんすう', 'にほんご', 'りかです'] },
    'On Tuesday we have Chinese, music and PE.': { t: '火曜日は、中国語、音楽、体育です。', seg: ['火曜日は、', '中国語、', '音楽、', '体育です。'], r: ['かようびは', 'ちゅうごくご', 'おんがく', 'たいいくです'] },
    went: { t: '行った', seg: ['行った'], r: ['いった'] },
    'Please find them! Ask them: "Are you Tim\'s mom?"': { t: 'さがしてね！聞いてね：「ティムのお母さんですか？」', seg: ['さがしてね！', '聞いてね：', '「ティムの', 'お母さんですか？」'], r: ['さがしてね', 'きいてね', 'てぃむの', 'おかあさんですか'] },
    'Please ask the baker, the student and the mayor: "What time do you get up?"': { t: 'パン屋さんと学生と町長に聞いてね：「何時に起きますか？」', seg: ['パン屋さんと', '学生と', '町長に', '聞いてね：', '「何時に', '起きますか？」'], r: ['ぱんやさんと', 'がくせいと', 'ちょうちょうに', 'きいてね', 'なんじに', 'おきますか'] },
    'Half past six means six thirty.': { t: '六時半は、六時三十分です。', seg: ['六時半は、', '六時三十分です。'], r: ['ろくじはんは', 'ろくじさんじっぷんです'] },
    '{rival} wants to be the English Champion!': { t: '{rival}はチャンピオンになりたいんだ！', seg: ['{rival}', 'は', 'チャンピオンに', 'なりたいんだ！'], r: ['{rival}', 'は', 'ちゃんぴおんに', 'なりたいんだ'] },
  },
  templates: {
    '{mon} is a {type} monster. Will you take it?': { t: '{mon}は{type}タイプだよ。つれていく？', seg: ['{mon}', 'は', '{type}', 'タイプだよ。', 'つれていく？'], r: ['{mon}', 'は', '{type}', 'たいぷだよ', 'つれていく'] },
    '{mon}, be my partner!': { t: '{mon}、なかまになって！', seg: ['{mon}、', 'なかまに', 'なって！'], r: ['{mon}', 'なかまに', 'なって'] },
    "{mon}, let's surf!": { t: '{mon}、波に乗ろう！', seg: ['{mon}、', '波に', '乗ろう！'], r: ['{mon}', 'なみに', 'のろう'] },
    '{mon}, your turn!': { t: '{mon}、きみの番だ！', seg: ['{mon}、', 'きみの', '番だ！'], r: ['{mon}', 'きみの', 'ばんだ'] },
    'Look out! Here comes {mon}!': { t: 'あぶない！{mon}が来た！', seg: ['あぶない！', '{mon}', 'が', '来た！'], r: ['あぶない', '{mon}', 'が', 'きた'] },
    'You got {item}!': { t: '{item}をもらった！', seg: ['{item}', 'を', 'もらった！'], r: ['{item}', 'を', 'もらった'] },
    'You found a {item}!': { t: '{item}を見つけた！', seg: ['{item}', 'を', '見つけた！'], r: ['{item}', 'を', 'みつけた'] },
  },
  terms: {
    monster: { Sprouty: { t: 'メブキ', r: 'めぶき' }, Emberpup: { t: 'ヒノコ', r: 'ひのこ' }, Bubbly: { t: 'アワワ', r: 'あわわ' }, Tidalfin: { t: 'シオヒレ', r: 'しおひれ' } },
    item: { Potion: { t: 'くすり', r: 'くすり' }, 'Echo Ball': { t: 'エコーボール', r: 'えこーぼーる' }, 'Big Potion': { t: 'いいくすり', r: 'いいくすり' } },
    type: { fire: { t: 'ほのお', r: 'ほのお' }, water: { t: 'みず', r: 'みず' }, grass: { t: 'くさ', r: 'くさ' }, electric: { t: 'でんき', r: 'でんき' } },
    place: { 'Hello Island': { t: 'ハロー島', r: 'はろーじま' } },
    person: { Mom: { t: 'ママ', r: 'まま' }, 'Professor Echo': { t: 'エコー博士', r: 'えこーはかせ' }, Tim: { t: 'ティム', r: 'てぃむ' }, Leo: { t: 'レオ', r: 'れお' } },
    sign: { 'REST STOP': { t: 'やすみどころ', r: 'やすみどころ' }, SHOP: { t: 'ショップ', r: 'しょっぷ' }, 'CHALLENGE HALL': { t: 'チャレンジ館', r: 'ちゃれんじかん' } },
    ui: { YES: { t: 'はい', r: 'はい' }, NO: { t: 'いいえ', r: 'いいえ' } },
    move: { 'Bubble Shot': { t: 'あわ鉄砲', r: 'あわでっぽう' }, 'Body Bump': { t: 'ぶつかり', r: 'ぶつかり' }, 'Sweet Rest': { t: 'ひと休み', r: 'ひとやすみ' } },
  },
};

const ZH = {
  lines: {
    'Which photo is you?': { t: '哪张照片是你？', seg: ['哪张', '照片', '是', '你？'], r: ['nǎ zhāng', 'zhào piàn', 'shì', 'nǐ'] },
    'Now write your English name on it.': { t: '再写上你的名字。', seg: ['再', '写上', '你的', '名字。'], r: ['zài', 'xiě shàng', 'nǐ de', 'míng zi'] },
    'Read your pass out loud: "My name is {name}."': { t: '大声念出通行证：“我叫{name}。”', seg: ['大声', '念出', '通行证：', '“我叫', '{name}。”'], r: ['dà shēng', 'niàn chū', 'tōng xíng zhèng', 'wǒ jiào', '{name}'] },
    'My name is {name}.': { t: '我叫{name}。', seg: ['我', '叫', '{name}。'], r: ['wǒ', 'jiào', '{name}'] },
    'Great! Your Island Pass is ready.': { t: '好啦！你的小岛通行证做好了。', seg: ['好啦！', '你的', '小岛', '通行证', '做好了。'], r: ['hǎo la', 'nǐ de', 'xiǎo dǎo', 'tōng xíng zhèng', 'zuò hǎo le'] },
    "I'm a boy.": { t: '我是男孩。', seg: ['我', '是', '男孩。'], r: ['wǒ', 'shì', 'nán hái'] },
    "I'm a girl.": { t: '我是女孩。', seg: ['我', '是', '女孩。'], r: ['wǒ', 'shì', 'nǚ hái'] },
    'Which shell will you open?': { t: '你要打开哪个贝壳？', seg: ['你', '要', '打开', '哪个', '贝壳？'], r: ['nǐ', 'yào', 'dǎ kāi', 'nǎ ge', 'bèi ké'] },
    'Talk to everyone. They will teach you English!': { t: '和大家说说话。他们会教你中文！', seg: ['和', '大家', '说说话。', '他们', '会', '教', '你', '中文！'], r: ['hé', 'dà jiā', 'shuō shuo huà', 'tā men', 'huì', 'jiāo', 'nǐ', 'zhōng wén'] },
    'Hello again, {name}! How is your monster?': { t: '又见面了，{name}！你的怪兽还好吗？', seg: ['又', '见面了，', '{name}！', '你的', '怪兽', '还好吗？'], r: ['yòu', 'jiàn miàn le', '{name}', 'nǐ de', 'guài shòu', 'hái hǎo ma'] },
    'Now, can you say this to me?': { t: '现在，你能跟我说这句话吗？', seg: ['现在，', '你', '能', '跟', '我', '说', '这句话', '吗？'], r: ['xiàn zài', 'nǐ', 'néng', 'gēn', 'wǒ', 'shuō', 'zhè jù huà', 'ma'] },
    'Nice to meet you, Professor!': { t: '博士，很高兴认识你！', seg: ['博士，', '很', '高兴', '认识', '你！'], r: ['bó shì', 'hěn', 'gāo xìng', 'rèn shi', 'nǐ'] },
    'On Monday we have maths, English and science.': { t: '星期一我们有数学、中文和科学。', seg: ['星期一', '我们', '有', '数学、', '中文', '和', '科学。'], r: ['xīng qī yī', 'wǒ men', 'yǒu', 'shù xué', 'zhōng wén', 'hé', 'kē xué'] },
    'On Tuesday we have Chinese, music and PE.': { t: '星期二我们有语文、音乐和体育。', seg: ['星期二', '我们', '有', '语文、', '音乐', '和', '体育。'], r: ['xīng qī èr', 'wǒ men', 'yǒu', 'yǔ wén', 'yīn yuè', 'hé', 'tǐ yù'] },
    went: { t: '去了', seg: ['去了'], r: ['qù le'] },
    'Please find them! Ask them: "Are you Tim\'s mom?"': { t: '请帮我找到他们！问他们：“你是蒂姆的妈妈吗？”', seg: ['请', '帮', '我', '找到', '他们！', '问', '他们：', '“你', '是', '蒂姆', '的', '妈妈', '吗？”'], r: ['qǐng', 'bāng', 'wǒ', 'zhǎo dào', 'tā men', 'wèn', 'tā men', 'nǐ', 'shì', 'dì mǔ', 'de', 'mā ma', 'ma'] },
    'Please ask the baker, the student and the mayor: "What time do you get up?"': { t: '请你去问面包师、学生和镇长：“你几点起床？”', seg: ['请', '你', '去', '问', '面包师、', '学生', '和', '镇长：', '“你', '几点', '起床？”'], r: ['qǐng', 'nǐ', 'qù', 'wèn', 'miàn bāo shī', 'xué sheng', 'hé', 'zhèn zhǎng', 'nǐ', 'jǐ diǎn', 'qǐ chuáng'] },
    'Half past six means six thirty.': { t: '六点半就是六点三十分。', seg: ['六点半', '就是', '六点', '三十分。'], r: ['liù diǎn bàn', 'jiù shì', 'liù diǎn', 'sān shí fēn'] },
    '{rival} wants to be the English Champion!': { t: '{rival}想当冠军！', seg: ['{rival}', '想', '当', '冠军！'], r: ['{rival}', 'xiǎng', 'dāng', 'guàn jūn'] },
  },
  templates: {
    '{mon} is a {type} monster. Will you take it?': { t: '{mon}是{type}系的怪兽。要带走它吗？', seg: ['{mon}', '是', '{type}', '系的', '怪兽。', '要', '带走', '它', '吗？'], r: ['{mon}', 'shì', '{type}', 'xì de', 'guài shòu', 'yào', 'dài zǒu', 'tā', 'ma'] },
    '{mon}, be my partner!': { t: '{mon}，做我的伙伴吧！', seg: ['{mon}，', '做', '我的', '伙伴', '吧！'], r: ['{mon}', 'zuò', 'wǒ de', 'huǒ bàn', 'ba'] },
    "{mon}, let's surf!": { t: '{mon}，带我游过去！', seg: ['{mon}，', '带', '我', '游过去！'], r: ['{mon}', 'dài', 'wǒ', 'yóu guò qù'] },
    '{mon}, your turn!': { t: '{mon}，该你了！', seg: ['{mon}，', '该', '你', '了！'], r: ['{mon}', 'gāi', 'nǐ', 'le'] },
    'Look out! Here comes {mon}!': { t: '小心！{mon}来了！', seg: ['小心！', '{mon}', '来了！'], r: ['xiǎo xīn', '{mon}', 'lái le'] },
    'You got {item}!': { t: '得到了{item}！', seg: ['得到了', '{item}！'], r: ['dé dào le', '{item}'] },
    'You found a {item}!': { t: '捡到了{item}！', seg: ['捡到了', '{item}！'], r: ['jiǎn dào le', '{item}'] },
  },
  terms: {
    monster: { Sprouty: { t: '小芽芽', r: 'xiǎo yá ya' }, Emberpup: { t: '火苗狗', r: 'huǒ miáo gǒu' }, Bubbly: { t: '泡泡鱼', r: 'pào pao yú' }, Tidalfin: { t: '潮汐鳍', r: 'cháo xī qí' } },
    item: { Potion: { t: '药水', r: 'yào shuǐ' }, 'Echo Ball': { t: '回声球', r: 'huí shēng qiú' }, 'Big Potion': { t: '大瓶药水', r: 'dà píng yào shuǐ' } },
    type: { fire: { t: '火', r: 'huǒ' }, water: { t: '水', r: 'shuǐ' }, grass: { t: '草', r: 'cǎo' }, electric: { t: '电', r: 'diàn' } },
    place: { 'Hello Island': { t: '你好岛', r: 'nǐ hǎo dǎo' } },
    person: { Mom: { t: '妈妈', r: 'mā ma' }, 'Professor Echo': { t: '回声博士', r: 'huí shēng bó shì' }, Tim: { t: '蒂姆', r: 'dì mǔ' }, Leo: { t: '里奥', r: 'lǐ ào' } },
    sign: { 'REST STOP': { t: '休息站', r: 'xiū xi zhàn' }, SHOP: { t: '商店', r: 'shāng diàn' }, 'CHALLENGE HALL': { t: '挑战馆', r: 'tiǎo zhàn guǎn' } },
    ui: { YES: { t: '要', r: 'yào' }, NO: { t: '不要', r: 'bú yào' } },
    move: { 'Bubble Shot': { t: '泡泡射击', r: 'pào pao shè jī' }, 'Body Bump': { t: '碰一碰', r: 'pèng yi pèng' }, 'Sweet Rest': { t: '甜甜休息', r: 'tián tian xiū xi' } },
  },
};

const FIX = { es: ES, ja: JA, zh: ZH };
// 英语原文 → lines.json（按 lines-src.json 的 id）；原文在 lines-src.json 里找不到就抛错（源码改了，这里跟着改）
function toLines(lang) {
  const SRC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'course', 'lines-src.json'), 'utf8')), F = JSON.parse(JSON.stringify(FIX[lang]));   // 拷一份：测试会改坏它
  const out = { lang, lines: {}, templates: {}, terms: {} };
  const find = (arr, en, what) => { const x = arr.find(e => e.en === en); if (!x) throw new Error('lines-src.json 里没有这' + what + '：' + en); return x.id; };
  for (const [en, v] of Object.entries(F.lines)) out.lines[find(SRC.lines, en, '句')] = v;
  for (const [en, v] of Object.entries(F.templates)) out.templates[find(SRC.templates, en, '个模板')] = v;
  for (const [ty, m] of Object.entries(F.terms)) { out.terms[ty] = {}; for (const [en, v] of Object.entries(m)) out.terms[ty][find(SRC.terms[ty], en, '个词')] = v; }
  return out;
}
// 写到 dir/<语言>-lines.json，返回路径
function write(lang, dir) { const f = path.join(dir, lang + '-lines.json'); fs.writeFileSync(f, JSON.stringify(toLines(lang), null, 1)); return f; }
module.exports = { FIX, toLines, write };
