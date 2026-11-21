// 测试用的小样：别的语言的课里的支线委托和今日目击的线索（tools/course/TALK.md 第二轮）。
// 翻译的正式内容（tools/course/<语言>/quests.json、sight.json）来没来，测试都用这一份，结果不跟着变。
// 格式就是 quests.json / sight.json 的格式：西语写字符串，日语、中文写 { t, seg, r }（词是 { t, r }）。
// 只有一两条委托、两三句线索（小样可以不全：check.js --quests / --sight 另给文件时缺的只提醒）。
// CommonJS：tests/*.js 直接 require，cloud/test/*.js 用 createRequire 读。
//   QUESTS[语言] / SIGHT[语言]   文件的内容
//   write(语言, 目录) → { quests, sight }   写成两个文件，交给 tools/course/build.js 的 { quests, sight } 或者 check.js 的 --quests / --sight
//   plain(语言) → { 委托 id: { opener, steps, words } }   服务器拼人设用的纯文字（和 build.js --talk 写进 talk-courses.js 的 quests 一个样）；
//   testQuests() → 三门语言的 plain，JSON 以后就是两个服务器的测试钩子 TEST_QUESTS 的值
'use strict';
const fs = require('fs');
const path = require('path');

const QUESTS = {
  es: { lang: 'es', quests: {
    'q0-cap': {
      ask: ['¡Ay, no! Alguien dejó una gorra azul en la playa.', 'Conozco al dueño, pero hoy tengo las piernas cansadas.', '¿Puedes llevársela por mí? ¡Pregúntame por el dueño!'],
      opener: '¡Gracias, cariño! Entonces, ¿qué quieres saber del dueño?',
      steps: ['¿Cómo se llama?', '¿Cómo es?', '¿Dónde está ahora?'],
      words: ['De quién', 'la gorra', 'el nombre', 'cómo es', 'Dónde', 'Gracias'],
      thanks: ['¡Encontraste a Ben! Está muy feliz de tener su gorra otra vez.', 'Gracias por tu ayuda. ¡Toma esto, por favor!'],
      bye: '¡Hola otra vez, cariño! Ahora Ben usa su gorra todos los días.',
    },
    'q1-stock': {
      ask: ['¡Hola! Hoy llegaron cajas nuevas a la papelería.', 'Pero no encuentro mis lentes y no puedo leer la lista.', 'Aquí está la lista. ¡Léemela en español, por favor!'],
      note: 'La lista dice: lápices rojos, doce. Reglas azules, ocho. Borradores amarillos, ninguno.',
      opener: '¡Gracias por ayudarme! Primero, ¿cuántos lápices rojos hay?',
      steps: ['Hay doce lápices rojos.', 'Hay ocho reglas azules.', 'No hay borradores amarillos.'],
      words: ['Hay', 'doce', 'ocho', 'los lápices', 'las reglas', 'los borradores', 'Cuántos'],
      thanks: ['Lápices, reglas y borradores. ¡Ahora sé qué hay en cada caja!', 'Tienes buena vista y una voz clara. Esto es para ti.'],
      bye: '¡Hola! Encontré mis lentes. ¡Estaban en mi cabeza!',
    },
  } },
  ja: { lang: 'ja', quests: {
    'q0-cap': {
      ask: [
        { t: 'あら！だれかが青いぼうしを砂浜にわすれました。', seg: ['あら！', 'だれかが', '青い', 'ぼうしを', '砂浜に', 'わすれました。'], r: ['あら', 'だれかが', 'あおい', 'ぼうしを', 'すなはまに', 'わすれました'] },
        { t: 'もちぬしは知っていますが、今日は足がつかれています。', seg: ['もちぬしは', '知って', 'いますが、', '今日は', '足が', 'つかれて', 'います。'], r: ['もちぬしは', 'しって', 'いますが', 'きょうは', 'あしが', 'つかれて', 'います'] },
        { t: 'かわりにとどけてくれますか？もちぬしのことを聞いてください！', seg: ['かわりに', 'とどけて', 'くれますか？', 'もちぬしの', 'ことを', '聞いて', 'ください！'], r: ['かわりに', 'とどけて', 'くれますか', 'もちぬしの', 'ことを', 'きいて', 'ください'] },
      ],
      opener: { t: 'ありがとう！では、もちぬしについて何を知りたいですか？', seg: ['ありがとう！', 'では、', 'もちぬしに', 'ついて', '何を', '知りたいですか？'], r: ['ありがとう', 'では', 'もちぬしに', 'ついて', 'なにを', 'しりたいですか'] },
      steps: [
        { t: 'かれの名前は何ですか？', seg: ['かれの', '名前は', '何ですか？'], r: ['かれの', 'なまえは', 'なんですか'] },
        { t: 'かれはどんな人ですか？', seg: ['かれは', 'どんな', '人ですか？'], r: ['かれは', 'どんな', 'ひとですか'] },
        { t: 'かれは今どこにいますか？', seg: ['かれは', '今', 'どこに', 'いますか？'], r: ['かれは', 'いま', 'どこに', 'いますか'] },
      ],
      words: [{ t: 'だれの', r: 'だれの' }, { t: 'ぼうし', r: 'ぼうし' }, { t: '名前', r: 'なまえ' }, { t: 'どんな人', r: 'どんなひと' }, { t: 'どこ', r: 'どこ' }, { t: 'ありがとう', r: 'ありがとう' }],
      thanks: [
        { t: 'ベンを見つけましたね！ぼうしがもどって、とてもよろこんでいます。', seg: ['ベンを', '見つけましたね！', 'ぼうしが', 'もどって、', 'とても', 'よろこんで', 'います。'], r: ['ベンを', 'みつけましたね', 'ぼうしが', 'もどって', 'とても', 'よろこんで', 'います'] },
        { t: 'てつだってくれてありがとう。これをどうぞ！', seg: ['てつだって', 'くれて', 'ありがとう。', 'これを', 'どうぞ！'], r: ['てつだって', 'くれて', 'ありがとう', 'これを', 'どうぞ'] },
      ],
      bye: { t: 'またこんにちは！ベンは今、毎日ぼうしをかぶっています。', seg: ['また', 'こんにちは！', 'ベンは', '今、', '毎日', 'ぼうしを', 'かぶって', 'います。'], r: ['また', 'こんにちは', 'ベンは', 'いま', 'まいにち', 'ぼうしを', 'かぶって', 'います'] },
    },
  } },
  zh: { lang: 'zh', quests: {
    'q0-cap': {
      ask: [
        { t: '哎呀！有人把一顶蓝帽子落在沙滩上了。', seg: ['哎呀！', '有人', '把', '一顶', '蓝帽子', '落在', '沙滩上', '了。'], r: ['āi yā', 'yǒu rén', 'bǎ', 'yì dǐng', 'lán mào zi', 'là zài', 'shā tān shang', 'le'] },
        { t: '我知道失主是谁，可是我今天腿很累。', seg: ['我', '知道', '失主', '是', '谁，', '可是', '我', '今天', '腿', '很累。'], r: ['wǒ', 'zhī dào', 'shī zhǔ', 'shì', 'shéi', 'kě shì', 'wǒ', 'jīn tiān', 'tuǐ', 'hěn lèi'] },
        { t: '你能帮我送回去吗？问问我失主是谁吧！', seg: ['你', '能', '帮我', '送回去', '吗？', '问问', '我', '失主', '是', '谁', '吧！'], r: ['nǐ', 'néng', 'bāng wǒ', 'sòng huí qù', 'ma', 'wèn wen', 'wǒ', 'shī zhǔ', 'shì', 'shéi', 'ba'] },
      ],
      opener: { t: '谢谢你！那么，关于失主，你想知道什么？', seg: ['谢谢', '你！', '那么，', '关于', '失主，', '你', '想', '知道', '什么？'], r: ['xiè xie', 'nǐ', 'nà me', 'guān yú', 'shī zhǔ', 'nǐ', 'xiǎng', 'zhī dào', 'shén me'] },
      steps: [
        { t: '他叫什么名字？', seg: ['他', '叫', '什么', '名字？'], r: ['tā', 'jiào', 'shén me', 'míng zi'] },
        { t: '他长什么样子？', seg: ['他', '长', '什么', '样子？'], r: ['tā', 'zhǎng', 'shén me', 'yàng zi'] },
        { t: '他现在在哪里？', seg: ['他', '现在', '在', '哪里？'], r: ['tā', 'xiàn zài', 'zài', 'nǎ lǐ'] },
      ],
      words: [{ t: '谁的', r: 'shéi de' }, { t: '帽子', r: 'mào zi' }, { t: '名字', r: 'míng zi' }, { t: '长什么样', r: 'zhǎng shén me yàng' }, { t: '哪里', r: 'nǎ lǐ' }, { t: '谢谢', r: 'xiè xie' }],
      thanks: [
        { t: '你找到本了！帽子回来了，他很高兴。', seg: ['你', '找到', '本', '了！', '帽子', '回来', '了，', '他', '很', '高兴。'], r: ['nǐ', 'zhǎo dào', 'Běn', 'le', 'mào zi', 'huí lái', 'le', 'tā', 'hěn', 'gāo xìng'] },
        { t: '谢谢你帮忙。这些请收下！', seg: ['谢谢', '你', '帮忙。', '这些', '请', '收下！'], r: ['xiè xie', 'nǐ', 'bāng máng', 'zhè xiē', 'qǐng', 'shōu xià'] },
      ],
      bye: { t: '又见面啦！本现在天天戴着那顶帽子。', seg: ['又', '见面', '啦！', '本', '现在', '天天', '戴着', '那顶', '帽子。'], r: ['yòu', 'jiàn miàn', 'la', 'Běn', 'xiàn zài', 'tiān tiān', 'dài zhe', 'nà dǐng', 'mào zi'] },
    },
  } },
};

const SIGHT = {
  es: { lang: 'es', lines: {
    'It hides in the tall grass. It is blue.': 'Se esconde en la hierba alta. Es azul.',
    'It is in the woods. Go north from the town.': 'Está en el bosque. Ve al norte desde el pueblo.',
    'It is on an island. People there say hello and good morning to everyone.': 'Está en una isla. Allí la gente saluda y da los buenos días a todos.',
  } },
  ja: { lang: 'ja', lines: {
    'It hides in the tall grass. It is blue.': { t: 'せの高い草むらにかくれています。青いです。', seg: ['せの', '高い', '草むらに', 'かくれて', 'います。', '青いです。'], r: ['せの', 'たかい', 'くさむらに', 'かくれて', 'います', 'あおいです'] },
    'It is in the woods. Go north from the town.': { t: '森の中にいます。町から北へ行きます。', seg: ['森の', '中に', 'います。', '町から', '北へ', '行きます。'], r: ['もりの', 'なかに', 'います', 'まちから', 'きたへ', 'いきます'] },
  } },
  zh: { lang: 'zh', lines: {
    'It hides in the tall grass. It is blue.': { t: '它躲在高高的草丛里。它是蓝色的。', seg: ['它', '躲在', '高高的', '草丛里。', '它', '是', '蓝色的。'], r: ['tā', 'duǒ zài', 'gāo gāo de', 'cǎo cóng lǐ', 'tā', 'shì', 'lán sè de'] },
    'It is in the woods. Go north from the town.': { t: '它在树林里。从小镇往北走。', seg: ['它', '在', '树林里。', '从', '小镇', '往北', '走。'], r: ['tā', 'zài', 'shù lín lǐ', 'cóng', 'xiǎo zhèn', 'wǎng běi', 'zǒu'] },
  } },
};

const txt = x => (typeof x === 'string' ? x : x.t);
function plain(lang) {
  const out = {};
  for (const [id, q] of Object.entries(QUESTS[lang].quests)) out[id] = { opener: txt(q.opener), steps: q.steps.map(txt), words: q.words.map(txt) };
  return out;
}
function write(lang, dir) {
  const quests = path.join(dir, 'quests-' + lang + '.json'), sight = path.join(dir, 'sight-' + lang + '.json');
  fs.writeFileSync(quests, JSON.stringify(QUESTS[lang]));
  fs.writeFileSync(sight, JSON.stringify(SIGHT[lang]));
  return { quests, sight };
}
module.exports = { QUESTS, SIGHT, plain, write, testQuests: () => ({ es: plain('es'), ja: plain('ja'), zh: plain('zh') }) };
