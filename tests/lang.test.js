// 要学的语言的引擎（lang.js + lang-es.js / lang-ja.js / lang-zh.js + lang-zh-data.js）：不开浏览器，几秒出结果
// 1. 加载：Node 里 require、浏览器那样（只有 window）按顺序加载、中文的拼音表后加载也行；登记表；每个模块的接口齐不齐；拼音表的大小
// 2. 西班牙语 / 日语 / 中文各 60 条以上：全对、识别服务的不同写法、数字、漏词、说错词、易混的词不能过、只错词尾算半对、
//    前后多说几个词、单个词、名字、秒出分、提示两级、排句子来回、聊天算句数（0–3 级）、去重的键、玩家名字、数字读法
// 3. 黄金表：一批固定的「目标 + 听到的」和它们的分数、每块的对错一字不差——以后改规则不能悄悄放松（改了要在这里说明为什么）
// 4. 读音表（EchoLang.lexicon）：课程条目做出来的表、交给打分以后读得出课程里的词
// 运行：node tests/lang.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
const check = (ok, what, extra) => { total++; console.log((ok ? '✓ ' : '✗ ') + what + (!ok && extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!ok) fails++; };

const L = require('../lang.js');
require('../lang-es.js'); require('../lang-ja.js'); require('../lang-zh.js');
const ES = L.get('es'), JA = L.get('ja'), ZH = L.get('zh');
const E = (t, seg, r) => ({ t, seg, r });
// 打分：返回 { s 分数, m 每块对错 '101', full, last }
const S = (mod, t, h, ctx) => {
  const ent = typeof t === 'string' ? null : t;
  const r = mod.score(ent ? ent.t : t, h, Object.assign(ent ? { entry: ent } : {}, ctx || {}));
  return { s: r.score, m: r.marks.map(x => (x ? 1 : 0)).join(''), full: r.full, last: r.last };
};
const perfect = r => r.s >= 85 && r.full;
const fail = r => r.s < 60;
const half = r => r.s >= 60 && r.s < 85 && !r.full;   // 过关但不是 Perfect

// ======================= 1. 加载和接口 =======================
console.log('— 加载和接口');
check(['es', 'ja', 'zh'].every(c => L.has(c)) && L.list().length >= 3 && !L.has('xx') && L.get('xx') === null, '登记表：es / ja / zh 都登记了，不认识的是 null');
const FN = ['units', 'pieces', 'score', 'best', 'early', 'short', 'tiles', 'joinTiles', 'cue', 'countUnits', 'isLine', 'key', 'nameOk', 'num', 'lexPairs'];
[ES, JA, ZH].forEach(m => {
  check(FN.every(k => typeof m[k] === 'function') && typeof m.code === 'string' && m.name && m.name.zh && m.name.en && m.name.self &&
    /^(latin|kana|han)$/.test(m.script) && m.asr && m.asr.cloud && m.asr.apple && Array.isArray(m.asr.appleAlt) && m.asr.web &&
    m.tts && typeof m.tts.cloud === 'string' && m.tts.web instanceof RegExp && typeof m.aiName === 'string', m.code + '：接口齐全（名字、文字、识别、朗读、AI 名、' + FN.length + ' 个函数）');
});
check(ES.asr.apple === 'es-MX' && JA.asr.apple === 'ja-JP' && ZH.asr.apple === 'zh-CN' && ZH.tones === false, '识别的语言区域：es-MX / ja-JP / zh-CN；中文不打声调分（tones: false）');
check(ZH.tts.web.test('zh-CN') && !ZH.tts.web.test('zh-HK') && ES.tts.web.test('es-MX') && JA.tts.web.test('ja-JP'), '本机声音的匹配：中文不挑粤语（zh-HK）');
// 浏览器那样：只有 window，没有 module / require；拼音表故意放在 lang-zh.js 后面加载（用到时才读）
(() => {
  const win = {}, ctx = vm.createContext({ window: win });
  ['lang.js', 'lang-es.js', 'lang-ja.js', 'lang-zh.js', 'lang-zh-data.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  const W = win.EchoLang;
  const ok = W && W.list().join(',') === 'es,ja,zh' && W.get('zh').score('我在学校', '我再学校').score === 100 && W.get('ja').score('猫', 'ねこ').score === 100 && W.get('es').score('hola', 'ola').score === 100;
  check(!!ok, '浏览器那样加载（window.EchoLang，拼音表后加载也行），三门语言都能打分');
})();
const dataSize = fs.statSync(path.join(ROOT, 'lang-zh-data.js')).size, D = require('../lang-zh-data.js');
check(dataSize < 120 * 1024 && D.n >= 3500, '拼音表 lang-zh-data.js：' + (dataSize / 1024).toFixed(1) + ' KB（< 120 KB），' + D.n + ' 个字（≥ 3500）');
check(ZH.pinyin('行').includes('xing') && ZH.pinyin('行').includes('hang') && ZH.pinyin('女')[0] === 'nv' && ZH.pinyin('猫')[0] === 'mao' && ZH.pinyin('𠀀').length === 0, '拼音表：多音字有几个读音、ü 写成 v、生僻字查不到');
const b1 = ES.best('Buenos días.', ['buenos dias', 'bueno día', 'nuevo día']), b0 = ES.best('Buenos días.', []);
check(b1.score === 100 && b1.heard === 'buenos dias' && b0.score === 0 && b0.marks.length === 2 && b0.heard === '', 'best：几个候选挑最好的（带 heard），没有候选是 0 分');

// ======================= 2a. 西班牙语 =======================
console.log('— 西班牙语');
const es = (t, h, c) => S(ES, t, h, c);
let r;
r = es('¿Cómo te llamas?', 'cómo te llamas'); check(r.s === 100 && r.full && r.last, 'es 全对：¿Cómo te llamas? = cómo te llamas', r);
r = es('¿Cómo te llamas?', 'Como te llamas'); check(r.s === 100, 'es 识别服务没写重音、没写 ¿?：照样满分', r);
r = es('Me llamo Sofía.', 'me llamo sofía'); check(r.s === 100, 'es 大小写、句号不影响', r);
r = es('Mi mamá cocina muy bien.', 'mi mama cocina muy bien'); check(r.s === 100, 'es 整句都没写重音：mamá = mama', r);
r = es('Voy a la escuela.', 'boy a la escuela'); check(r.s === 100, 'es 同音：b / v（voy = boy）', r);
r = es('Hola, Ana.', 'ola ana'); check(r.s === 100, 'es 同音：不发音的 h（hola = ola）', r);
r = es('La casa es azul.', 'la caza es azul'); check(r.s === 100, 'es 同音：s / z（casa = caza，拉美 seseo）', r);
r = es('Yo hago la tarea.', 'yo ago la tarea'); check(r.s === 100, 'es 同音：hago = ago', r);
r = es('Me gusta la lluvia.', 'me gusta la yuvia'); check(r.s === 100, 'es 同音：ll / y', r);
r = es('El cine está cerca.', 'el sine está serca'); check(r.s === 100, 'es 同音：软 c / s', r);
r = es('Hace sol hoy.', 'ase sol oy'); check(r.s === 100, 'es 同音：hace = ase、hoy = oy', r);
r = es('Tengo dos hermanos.', 'tengo 2 hermanos'); check(r.s === 100, 'es 数字：2 = dos', r);
r = es('Tengo una hermana.', 'tengo 1 hermana'); check(r.s === 100, 'es 数字：1 = una（阴性）', r);
r = es('Tengo veintiún años.', 'tengo 21 años'); check(r.s === 100, 'es 数字：21 = veintiún', r);
r = es('Son las tres y media.', 'son las 3:30'); check(r.s === 100, 'es 钟点：3:30 = tres y media', r);
r = es('Es la una.', 'es la 1'); check(r.s === 100, 'es 钟点：la 1 = la una', r);
r = es('Hay doscientas personas.', 'hay 200 personas'); check(r.s === 100, 'es 数字：200 = doscientas', r);
r = es('Vivo en el tercer piso.', 'vivo en el 3er piso'); check(r.s === 100, 'es 序数：3er = tercer', r);
r = es('Mi hermano juega al fútbol.', 'mi hermano juega'); check(fail(r), 'es 漏了关键实词（al fútbol）：不过关', r);
r = es('No me gusta el té.', 'me gusta el té'); check(fail(r) && r.m[0] === '0', 'es 漏了 no（意思反了）：不过关', r);
r = es('Me gusta el té.', 'no me gusta el té'); check(fail(r) && !r.full, 'es 多说了 no（意思反了）：不过关', r);
r = es('Quiero un vaso de agua.', 'quiero vaso de agua'); check(half(r), 'es 漏了虚词（un）：过关、不是 Perfect', r);
r = es('Hoy es lunes.', 'hoy es martes'); check(fail(r) && r.m === '110', 'es 说错了词：lunes ≠ martes', r);
r = es('Tengo un gato negro.', 'tengo un perro negro'); check(fail(r) && r.m === '1101', 'es 说错了词：gato ≠ perro', r);
r = es('Mi perro es grande.', 'mi pero es grande'); check(fail(r) && r.m === '1011', 'es 易混：perro ≠ pero（rr / r）', r);
r = es('El carro es caro.', 'el caro es caro'); check(fail(r) && r.m[1] === '0', 'es 易混：carro ≠ caro', r);
r = es('Tengo diez años.', 'tengo diez anos'); check(fail(r), 'es 易混：años ≠ anos（ñ 不去掉）', r);
r = es('El pelo es negro.', 'el pero es negro'); check(fail(r), 'es 易混：pelo ≠ pero（l / r）', r);
r = es('Mi casa es grande.', 'mi caso es grande'); check(fail(r), 'es casa ≠ caso（o / a 换了意思，不算词尾）', r);
r = es('Mi papá está en casa.', 'Mi papa está en casa'); check(fail(r) && r.m[1] === '0', 'es 识别结果写了重音、papá 却写成 papa：不算对', r);
r = es('Mi papá está en casa.', 'mi papa esta en casa'); check(r.s === 100, 'es 识别结果一个重音都没写：看不出来，算对', r);
r = es('Esta es mi casa.', 'Está es mi casa'); check(r.s < 85 && !r.full && r.m[0] === '0', 'es 听到的词自己带着另一个重音（esta → está）：不算对', r);
r = es('Ella es alta.', 'ella es alto'); check(half(r) && r.m === '110', 'es 只错了阴阳性（alta / alto）：半对', r);
r = es('Nosotros hablamos español.', 'nosotros hablan español'); check(half(r) && r.m === '101', 'es 只错了动词人称（hablamos / hablan）：半对', r);
r = es('Los gatos son negros.', 'los gato son negros'); check(half(r), 'es 只错了单复数：半对', r);
r = es('Ayer él habló con Ana.', 'Ayer él hablo con Ana'); check(half(r) && r.m[2] === '0', 'es habló → hablo（识别服务会写重音）：只错了时态，半对', r);
r = es('Ayer él habló con Ana.', 'ayer el hablo con ana'); check(r.s === 100, 'es habló → hablo（识别服务从来不写重音）：算对', r);
r = es('Yo como pan.', 'yo comes pan'); check(half(r), 'es como / comes：半对', r);
r = es('Mis amigas son simpáticas.', 'mis amigos son simpáticos'); check(half(r), 'es 两个词都只错了阴阳性：半对', r);
r = es('Yo soy alto.', 'yo estoy alto'); check(r.s < 85 && r.m[1] === '0', 'es ser / estar 是两个词（soy ≠ estoy）', r);
r = es('Gracias.', 'muchas gracias amiga'); check(r.s === 100, 'es 前后多说了几个词：短句满分', r);
r = es('Buenos días.', 'eh buenos días profesor'); check(r.s === 100, 'es 前后多说了：buenos días', r);
r = es('Me llamo Luis y vivo en el pueblo.', 'hola me llamo luis y vivo en el pueblo'); check(perfect(r) && r.s >= 90, 'es 长句前面多说一个词：还是 Perfect', r);
r = es('gato', 'gatos'); check(half(r), 'es 单个词：gatos（多了复数）过关、不是 Perfect', r);
r = es('ventana', 'bentana'); check(r.s === 100, 'es 单个词：ventana = bentana', r);
r = es('año', 'ano'); check(fail(r), 'es 单个词：año ≠ ano', r);
r = es('zapato', 'sapato'); check(r.s === 100, 'es 单个词：zapato = sapato', r);
r = es('perro', 'pero'); check(fail(r) && r.s >= 40, 'es 单个词说成易混的词：给参考分、不过关', r);
r = es('Me llamo Sofía.', 'me llamo Sofi'); check(r.s >= 85, 'es 名字差一个字母：算对', r);
r = es('Hola, Mariana.', 'hola mari ana'); check(r.s >= 85, 'es 名字被拆成两个词：拼回去', r);
r = es('Hoy viene Valentina.', 'hoy viene'); check(r.s < 85 && !r.full, 'es 名字整个没说：不给 Perfect', r);
r = es('Mi amiga Amy canta.', 'mi amiga emi canta', { names: ['Amy'] }); check(r.s >= 85, 'es ctx.names 给的名字（Amy / emi）：算对', r);
r = es('Vivo en México.', 'vivo en Perú'); check(fail(r), 'es 国家名不放宽：México ≠ Perú', r);
check(!ES.early('Me gusta jugar al fútbol.', 'me gusta jugar al') && ES.early('Me gusta jugar al fútbol.', 'me gusta jugar al futbol'), 'es 秒出分：少最后一个词不触发，说全了才触发');
check(!ES.early('Tengo dos hermanos.', 'tengo dos'), 'es 秒出分：半句不提前结束');
check(ES.cue('¿Cómo te llamas?', 1) === '¿C___  t_  l_____?', 'es 提示 1 级：留第一个字母', ES.cue('¿Cómo te llamas?', 1));
check(ES.cue('¿Cómo te llamas?', 2, null, true) === '¿Cómo  __  ______?' && ES.cue('Mañana voy.', 2) === '______  ___.', 'es 提示 2 级：全遮住（first 留第一个词，ñ 也遮）', [ES.cue('¿Cómo te llamas?', 2, null, true), ES.cue('Mañana voy.', 2)]);
const tl = ES.tiles('¿Dónde está la biblioteca?');
check(tl.join('|') === 'Dónde|está|la|biblioteca' && ES.joinTiles(tl) === 'Dónde está la biblioteca' && ES.joinTiles(ES.tiles('Hola, ¿cómo estás?')) === 'Hola cómo estás', 'es 排句子：去掉 ¿? 和逗号，接回去一样', tl);
check(ES.countUnits('¿Cómo estás, Ana?') === 3 && ES.countUnits('') === 0, 'es 几个词：¿Cómo estás, Ana? = 3');
check(ES.isLine('hola', 0) && !ES.isLine('hola', 1) && ES.isLine('hola amigo', 1) && !ES.isLine('hola amigo', 2) && ES.isLine('yo tengo un gato', 3) && !ES.isLine('me gusta', null), 'es 算不算一句：入门 1 个词、初级 2 个、其余 3 个');
check(!ES.isLine('I like it very much', 2) && !ES.isLine('我喜欢猫', 0) && !ES.isLine('', 0), 'es 英语、中文、空的不算');
check(ES.key('¿Cómo estás?') === ES.key('como estas') && ES.key('Mañana') !== ES.key('manana') && ES.key('Hola!') === ES.key('hola') && ES.key('hola') === 'hola', 'es 去重的键：重音、标点、大小写不管，ñ 留着');
check(ES.nameOk('sofía') === 'Sofía' && ES.nameOk('  maría   josé ') === 'María José' && ES.nameOk('ñandú') === 'Ñandú', 'es 玩家名字：首字母大写、可以带重音和 ñ');
check(ES.nameOk('Ana3') === null && ES.nameOk('李明') === null && ES.nameOk('') === null && ES.nameOk('abcdefghijklm') === null, 'es 玩家名字：数字、汉字、空的、超过 12 个字不行');
check(ES.num(0) === 'cero' && ES.num(16) === 'dieciséis' && ES.num(21) === 'veintiuno' && ES.num(31) === 'treinta y uno' && ES.num(100) === 'cien' && ES.num(101) === 'ciento uno', 'es 数字读法 0–101');
check(ES.num(555) === 'quinientos cincuenta y cinco' && ES.num(1000) === 'mil' && ES.num(2026) === 'dos mil veintiséis' && ES.num(9999) === 'nueve mil novecientos noventa y nueve' && ES.num(21000) === 'veintiún mil', 'es 数字读法 555–21000');
check(ES.time(3, 30) === 'tres y media' && ES.time(1, 0) === 'una' && ES.date(5, 1) === 'primero de mayo' && ES.date(9, 16) === 'dieciséis de septiembre', 'es 钟点和日期');
check(ES.short('Hola') && ES.short('Buenos días') && !ES.short('Me llamo Ana'), 'es 短的：两个词以内');
check(ES.units('Tengo 21 años.').join(' ') === 'tengo veintiuno años' && ES.head('¿Cómo estás?') === 'como', 'es units / head');

// ======================= 2b. 日语 =======================
console.log('— 日语');
const ja = (t, h, c) => S(JA, t, h, c);
const J = {
  a: E('わたしは学生です。', ['わたしは', '学生', 'です。'], ['わたしは', 'がくせい', 'です']),
  likes: E('ねこが好きです。', ['ねこが', '好きです。'], ['ねこが', 'すきです']),
  water: E('水をください。', ['水を', 'ください。'], ['みずを', 'ください']),
  weather: E('今日はいい天気ですね。', ['今日は', 'いい', '天気ですね。'], ['きょうは', 'いい', 'てんきですね']),
  three: E('三時に起きます。', ['三時に', '起きます。'], ['さんじに', 'おきます']),
  cats: E('ねこが三匹います。', ['ねこが', '三匹', 'います。'], ['ねこが', 'さんびき', 'います']),
  gran: E('おばあさんは元気です。', ['おばあさんは', '元気です。'], ['おばあさんは', 'げんきです']),
  wait: E('ここで待ってください。', ['ここで', '待ってください。'], ['ここで', 'まってください']),
  coffee: E('コーヒーを飲みます。', ['コーヒーを', '飲みます。'], ['コーヒーを', 'のみます']),
  sakura: E('さくらさんは先生です。', ['さくらさんは', '先生です。'], ['さくらさんは', 'せんせいです']),
  school: E('学校に行きます。', ['学校に', '行きます。'], ['がっこうに', 'いきます']),
  morning: E('毎朝七時に起きます。', ['毎朝', '七時に', '起きます。'], ['まいあさ', 'しちじに', 'おきます']),
  bday: E('誕生日は五月三日です。', ['誕生日は', '五月', '三日です。'], ['たんじょうびは', 'ごがつ', 'みっかです']),
  bro: E('兄が二人います。', ['兄が', '二人', 'います。'], ['あにが', 'ふたり', 'います']),
  hobby: E('私の趣味は読書です。', ['私の', '趣味は', '読書です。'], ['わたしの', 'しゅみは', 'どくしょです']),
  haruto: E('はるとくんは十二歳です。', ['はるとくんは', '十二歳です。'], ['はるとくんは', 'じゅうにさいです']),
  apples: E('りんごを四つください。', ['りんごを', '四つ', 'ください。'], ['りんごを', 'よっつ', 'ください']),
  now: E('今、八時半です。', ['今、', '八時半です。'], ['いま', 'はちじはんです']),
  lib: E('図書館で本を読みました。', ['図書館で', '本を', '読みました。'], ['としょかんで', 'ほんを', 'よみました']),
  ohayo: E('おはようございます。', ['おはようございます。'], ['おはようございます']),
  amy: E('エイミーさんはやさしいです。', ['エイミーさんは', 'やさしいです。'], ['エイミーさんは', 'やさしいです']),
  meat: E('肉を食べます。', ['肉を', '食べます。'], ['にくを', 'たべます']),
};
const W = { neko: { t: 'ねこ', r: 'ねこ' }, gaku: { t: '学生', r: 'がくせい' }, taberu: { t: '食べる', r: 'たべる' }, konnichiwa: { t: 'こんにちは', r: 'こんにちは' },
  arigato: { t: 'ありがとう', r: 'ありがとう' }, nana: { t: '七', r: 'なな' }, ichigatsu: { t: '一月', r: 'いちがつ' }, koko: { t: 'ここ', r: 'ここ' }, kitte: { t: '切手', r: 'きって' } };
r = ja(J.a, '私は学生です'); check(r.s === 100 && r.full && r.last, 'ja 全对：私は学生です（私 = わたし）', r);
r = ja(J.a, 'わたしは学生です。'); check(r.s === 100, 'ja 和课本一字不差', r);
r = ja(J.a, 'わたし は がくせい です'); check(r.s === 100, 'ja 全是平假名、中间有空格：照样满分', r);
r = ja(J.school, '学校に行きます'); check(r.s === 100, 'ja 全对：学校に行きます', r);
r = ja(J.water, '水を下さい'); check(r.s === 100, 'ja 写法不同：下さい = ください', r);
r = ja(J.weather, '今日は良い天気ですね'); check(r.s === 100, 'ja 写法不同：良い = いい', r);
r = ja(J.coffee, 'こーひーを飲みます'); check(r.s === 100, 'ja 片假名写成平假名：照样满分', r);
r = ja(J.coffee, 'コーヒーを のみます'); check(r.s === 100, 'ja 汉字写成假名（飲みます / のみます）', r);
r = ja(J.hobby, 'わたしの趣味は読書です'); check(r.s === 100, 'ja 私 / わたし 反过来也行', r);
r = ja(W.arigato, '有難う'); check(r.s === 100, 'ja 单个词：有難う = ありがとう', r);
r = ja(J.ohayo, 'お早うございます'); check(r.s === 100, 'ja お早う = おはよう', r);
r = ja(W.konnichiwa, 'こんにちわ'); check(r.s === 100, 'ja こんにちわ（识别服务写 わ）= こんにちは', r);
r = ja(J.three, '3時に起きます'); check(r.s === 100, 'ja 数字：3時 = さんじ', r);
r = ja(J.morning, '毎朝7時に起きます'); check(r.s === 100, 'ja 数字：7時 = しちじ（也认 ななじ）', r);
r = ja(J.bday, '誕生日は5月3日です'); check(r.s === 100, 'ja 日期：5月3日 = ごがつみっか', r);
r = ja(J.bro, '兄が2人います'); check(r.s === 100, 'ja 量词：2人 = ふたり', r);
r = ja(J.haruto, 'はるとくんは12歳です'); check(r.s === 100, 'ja 量词：12歳 = じゅうにさい', r);
r = ja(J.apples, 'りんごを4つください'); check(r.s === 100, 'ja 量词：4つ = よっつ', r);
r = ja(J.now, '今8時半です'); check(r.s === 100, 'ja 8時半 = はちじはん', r);
r = ja(J.now, '今8:30です'); check(r.s === 100, 'ja 8:30 = はちじはん', r);
r = ja(J.cats, '猫が3匹います'); check(r.s === 100, 'ja 量词：3匹 = さんびき', r);
r = ja(W.nana, '7'); check(r.s === 100, 'ja 单个数字：7 = なな', r);
r = ja(W.ichigatsu, '1月'); check(r.s === 100, 'ja 1月 = いちがつ', r);
r = ja(J.three, '4時に起きます'); check(fail(r) && r.m[0] === '0', 'ja 数字不对：4時（よじ）≠ 三時', r);
r = ja(J.bro, '兄が3人います'); check(fail(r), 'ja 量词不对：3人 ≠ 二人', r);
r = ja(J.a, 'わたしはがくせい'); check(half(r) && r.m === '110', 'ja 漏了虚词块（です）：过关、不是 Perfect', r);
r = ja(J.lib, '図書館で読みました'); check(fail(r) && r.m === '101', 'ja 漏了关键实词（本を）：不过关', r);
r = ja(J.school, '学校に'); check(fail(r), 'ja 只说了一半：不过关', r);
r = ja(J.a, '私は先生です'); check(fail(r) && r.m === '101', 'ja 说错了词：先生 ≠ 学生', r);
r = ja(J.likes, '猫が嫌いです'); check(fail(r), 'ja 说错了词：嫌い ≠ 好き', r);
r = ja(J.coffee, 'コーヒーを飲みません'); check(fail(r), 'ja 否定（飲みません）不是半对，算错', r);
r = ja(J.meat, '肉を食べません'); check(fail(r) && !r.full, 'ja 多了否定：意思反了，不过关', r);
r = ja(J.school, '学校に来ます'); check(fail(r), 'ja 行きます ≠ 来ます', r);
r = ja(J.gran, 'おばさんは元気です'); check(fail(r) && r.m[0] === '0', 'ja 易混：おばさん ≠ おばあさん（长音）', r);
r = ja(J.gran, 'お婆さんは元気です'); check(r.s === 100, 'ja お婆さん = おばあさん', r);
r = ja(J.wait, 'ここで待てください'); check(fail(r), 'ja 易混：待て ≠ 待って（促音）', r);
r = ja(W.gaku, '先生'); check(fail(r), 'ja 单个词：先生 ≠ 学生', r);
r = ja(W.neko, 'ねご'); check(fail(r) && r.s >= 40, 'ja 单个词：ねご ≠ ねこ（浊音），给参考分', r);
r = ja(W.koko, '高校'); check(fail(r), 'ja 易混：ここ ≠ こうこう（长音）', r);
r = ja(W.kitte, '来て'); check(fail(r), 'ja 易混：きて ≠ きって', r);
r = ja(J.a, '私は学生でした'); check(half(r) && r.m === '110', 'ja 只差词尾（でした / です）：半对', r);
r = ja(J.a, '私が学生です'); check(half(r) && r.m === '011', 'ja 只差助词（が / は）：半对', r);
r = ja(J.three, '三時に起きました'); check(half(r), 'ja 起きました / 起きます：半对', r);
r = ja(J.coffee, 'コーヒーを飲んだ'); check(half(r), 'ja 飲んだ / 飲みます：半对', r);
r = ja(J.likes, 'ネコが好きだ'); check(half(r), 'ja 好きだ / 好きです：半对', r);
r = ja(J.school, '学校で行きます'); check(half(r) && r.m === '01', 'ja 学校で / 学校に：半对', r);
r = ja(W.taberu, '食べます'); check(half(r), 'ja 单个词：食べます / 食べる 半对', r);
r = ja(W.taberu, '食べない'); check(fail(r), 'ja 单个词：食べない（否定）不算半对', r);
r = ja(W.konnichiwa, 'あ、こんにちは'); check(r.s === 100, 'ja 前面多说了「あ」：满分', r);
r = ja(J.ohayo, 'はい、おはようございます'); check(r.s === 100, 'ja 前面多说了「はい」：满分', r);
r = ja(J.a, 'えっと私は学生です'); check(r.s === 100, 'ja 前面多说了「えっと」：满分', r);
r = ja(J.lib, 'はい図書館で本を読みました'); check(r.s === 100, 'ja 三块的句子前面多说了：满分', r);
r = ja(J.sakura, '桜さんは先生です'); check(r.s === 100, 'ja 名字写成汉字（桜 = さくら）', r);
r = ja(J.sakura, '遥香さんは先生です'); check(half(r) && r.m === '01', 'ja 名字写成读不出来的汉字：半对（不扣关键实词，不给 Perfect）', r);
r = ja(J.haruto, '陽翔くんは12歳です'); check(r.s === 100, 'ja 名字写成常见的汉字（陽翔 = はると）', r);
r = ja(J.amy, 'エミーさんは優しいです'); check(r.s >= 85, 'ja 片假名名字差一拍：算对', r);
r = ja(E('わたしはアメリカじんです。', ['わたしは', 'アメリカじんです。'], ['わたしは', 'アメリカじんです']), '私はアメリカ人です'); check(r.s === 100, 'ja 国籍的 人 读 じん（アメリカ人）', r);
r = ja(E('はるとくんは元気です。', ['はるとくんは', '元気です。'], ['はるとくんは', 'げんきです']), 'はると君は元気です'); check(r.s === 100, 'ja 君 读 くん', r);
r = ja(E('姉は二十歳です。', ['姉は', '二十歳です。'], ['あねは', 'はたちです']), '姉は20歳です'); check(r.s === 100, 'ja 20歳 = はたち', r);
// 课程里写假名、识别结果爱写成汉字 / 片假名的词（2026-11-21 实测云端识别后补进自带的读音表）
r = ja(E('きっぷを買います。', ['きっぷを', '買います。'], ['きっぷを', 'かいます']), '切符を買います'); check(r.s === 100, 'ja 假名词被写成汉字：切符 = きっぷ', r);
r = ja(E('びじゅつかんはどこですか？', ['びじゅつかんは', 'どこ', 'ですか？'], ['びじゅつかんは', 'どこ', 'ですか']), '美術館はどこですか'); check(r.s === 100, 'ja 假名词被写成汉字：美術館 = びじゅつかん', r);
r = ja(E('ごみはごみ箱にすててください。', ['ごみは', 'ごみ箱に', 'すてて', 'ください。'], ['ごみは', 'ごみばこに', 'すてて', 'ください']), 'ゴミはゴミ箱に捨てて下さい'); check(r.s === 100, 'ja 捨てて = すてて，ゴミ = ごみ，下さい = ください', r);
r = ja(E('冬は雪がふります。', ['冬は', '雪が', 'ふります。'], ['ふゆは', 'ゆきが', 'ふります']), '冬は雪が降ります'); check(r.s === 100, 'ja 降ります 读 ふります（下雪）', r);
r = ja(E('バスをおります。', ['バスを', 'おります。'], ['バスを', 'おります']), 'バスを降ります'); check(r.s === 100, 'ja 降ります 也读 おります（下车）', r);
r = ja(E('ピアノができます。', ['ピアノが', 'できます。'], ['ピアノが', 'できます']), 'ピアノが出来ます'); check(r.s === 100, 'ja 出来ます = できます', r);
r = ja(E('朝ごはんを食べます。', ['朝ごはんを', '食べます。'], ['あさごはんを', 'たべます']), '朝ご飯を食べます'); check(r.s === 100, 'ja ご飯 = ごはん', r);
r = ja(E('きっぷを買います。', ['きっぷを', '買います。'], ['きっぷを', 'かいます']), '切手を買います'); check(fail(r) || half(r), 'ja 写成别的词（切手）：不算对', r);
r = ja(J.a, 'わたしは鰯です'); check(fail(r) && r.m === '101', 'ja 读不出来的汉字（鰯）：只有那一块按写法比，别的块照常', r);
r = ja('これは薔薇です', 'これは薔薇です'); check(r.s === 100, 'ja 没有读音的目标、读音表里没有的汉字：按写法比', r);
r = ja('猫が好きです', 'ねこがすきです'); check(r.s === 100 && r.m.length === 6, 'ja 没有 seg 的目标：按读音比，每个字一块', r);
check(!JA.early(J.a.t, '私は学生', { entry: J.a }) && JA.early(J.a.t, '私は学生です', { entry: J.a }), 'ja 秒出分：です 说出来了才触发');
check(!JA.early(J.lib.t, '図書館で本を', { entry: J.lib }), 'ja 秒出分：半句不提前结束');
check(JA.cue(J.a.t, 1, J.a) === 'わ＿＿＿  が＿＿＿  で＿。', 'ja 提示 1 级：每块读音的第一拍', JA.cue(J.a.t, 1, J.a));
check(JA.cue(J.a.t, 2, J.a, true) === 'わたしは  ＿＿＿＿  ＿＿。' && JA.cue(J.coffee.t, 1, J.coffee) === 'コ＿＿＿＿  の＿＿＿。', 'ja 提示 2 级（first 留第一块）、片假名的块用片假名', [JA.cue(J.a.t, 2, J.a, true), JA.cue(J.coffee.t, 1, J.coffee)]);
check(JA.cue('ねこ', 1, W.neko) === 'ね＿' && JA.cue('ねこ', 2, W.neko) === '＿＿', 'ja 单个词的提示');
const jt = JA.tiles(J.a.t, J.a);
check(jt.join('|') === 'わたしは|学生|です' && JA.joinTiles(jt) === 'わたしは学生です' && JA.tiles(J.now.t, J.now).join('|') === '今|八時半です', 'ja 排句子：seg 去掉标点，接回去一样', jt);
check(JA.countUnits('わたしは学生です。') === 8 && JA.countUnits('きょう') === 2 && JA.countUnits('コーヒー') === 2, 'ja 几个字：假名汉字各一个，ゃゅょ、ー、标点不算');
check(JA.isLine('はい', 0) && !JA.isLine('はい', 1) && JA.isLine('ねこがすき', 1) && !JA.isLine('ねこがすき', 2) && JA.isLine('わたしは学生です', 3), 'ja 算不算一句：入门 2 个字、初级 4 个、其余 6 个');
check(!JA.isLine('我是学生', 0) && JA.isLine('先生', 0) && !JA.isLine('hello', 0) && !JA.isLine('안녕', 0) && !JA.isLine('', 2), 'ja 没有假名的只在入门级算（三个字以内）；英语、韩语、空的不算');
check(JA.key('わたしは 学生です。') === JA.key('わたしは学生です') && JA.key('コーヒー') === JA.key('こーひー') && JA.key('ねこ') === 'ねこ', 'ja 去重的键：空格标点不管、片假名 = 平假名、不会变成空的');
check(JA.nameOk('さくら') === 'さくら' && JA.nameOk('ハルト') === 'ハルト' && JA.nameOk('  ゆい ') === 'ゆい' && JA.nameOk('ﾊﾙﾄ') === 'ハルト', 'ja 玩家名字：平假名、片假名（半角的变全角）');
check(JA.nameOk('桜') === null && JA.nameOk('Sakura') === null && JA.nameOk('ーあ') === null && JA.nameOk('あいうえおかきくけ') === null, 'ja 玩家名字：汉字、字母、ー 开头、超过 8 个字不行');
check(JA.num(0) === 'ぜろ' && JA.num(10) === 'じゅう' && JA.num(16) === 'じゅうろく' && JA.num(300) === 'さんびゃく' && JA.num(600) === 'ろっぴゃく' && JA.num(800) === 'はっぴゃく', 'ja 数字读法 0–800');
check(JA.num(3000) === 'さんぜん' && JA.num(8000) === 'はっせん' && JA.num(1234) === 'せんにひゃくさんじゅうよん' && JA.num(9999) === 'きゅうせんきゅうひゃくきゅうじゅうきゅう' && JA.num(20000) === 'にまん', 'ja 数字读法 1234–20000');
check(JA.time(4, 0) === 'よじ' && JA.time(3, 30) === 'さんじはん' && JA.date(4, 1) === 'しがつついたち' && JA.date(5, 20) === 'ごがつはつか', 'ja 钟点和日期');
check(JA.count(1, '人')[0] === 'ひとり' && JA.count(3, '本')[0] === 'さんぼん' && JA.count(6, '匹')[0] === 'ろっぴき' && JA.count(14, '日')[0] === 'じゅうよっか' && JA.count(30, '分').includes('さんじゅっぷん'), 'ja 量词读法');
check(JA.short('おはよう') && JA.short('ねこ', W.neko) && !JA.short(J.a.t, J.a), 'ja 短的：6 拍以内');
check(JA.units(J.a.t, { entry: J.a }).join('') === 'わたしはがくせいです' && JA.units('猫と犬').join('') === 'ねこといぬ', 'ja units：平假名的拍');

// ======================= 2c. 中文 =======================
console.log('— 中文');
const zh = (t, h, c) => S(ZH, t, h, c);
const Z = {
  cat: E('我有一只猫。', ['我', '有', '一只', '猫。'], ['wǒ', 'yǒu', 'yì zhī', 'māo']),
  friend: E('他是我的朋友。', ['他', '是', '我的', '朋友。'], ['tā', 'shì', 'wǒ de', 'péngyou']),
  school: E('我在学校。', ['我', '在', '学校。'], ['wǒ', 'zài', 'xuéxiào']),
  two: E('我有两只猫。', ['我', '有', '两只', '猫。'], ['wǒ', 'yǒu', 'liǎng zhī', 'māo']),
  half: E('现在三点半。', ['现在', '三点半。'], ['xiànzài', 'sān diǎn bàn']),
  rice: E('我吃米饭。', ['我', '吃', '米饭。'], ['wǒ', 'chī', 'mǐfàn']),
  milk: E('牛奶很好喝。', ['牛奶', '很', '好喝。'], ['niúnǎi', 'hěn', 'hǎohē']),
  where: E('你去哪儿？', ['你', '去', '哪儿？'], ['nǐ', 'qù', 'nǎr']),
  think: E('我觉得很好。', ['我', '觉得', '很', '好。'], ['wǒ', 'juéde', 'hěn', 'hǎo']),
  ming: E('小明是我的朋友。', ['小明', '是', '我的', '朋友。'], ['Xiǎo Míng', 'shì', 'wǒ de', 'péngyou']),
  apple: E('我喜欢吃苹果。', ['我', '喜欢', '吃', '苹果。'], ['wǒ', 'xǐhuan', 'chī', 'píngguǒ']),
  came: E('他来了。', ['他', '来了。'], ['tā', 'lái le']),
  date: E('今天五月三号。', ['今天', '五月', '三号。'], ['jīntiān', 'wǔ yuè', 'sān hào']),
  bank: E('我们去银行。', ['我们', '去', '银行。'], ['wǒmen', 'qù', 'yínháng']),
  rain: E('我不喜欢下雨。', ['我', '不', '喜欢', '下雨。'], ['wǒ', 'bù', 'xǐhuan', 'xià yǔ']),
  eat: E('我们一起去吃饭吧。', ['我们', '一起', '去', '吃饭', '吧。'], ['wǒmen', 'yìqǐ', 'qù', 'chīfàn', 'ba']),
  name: E('你叫什么名字？', ['你', '叫', '什么', '名字？'], ['nǐ', 'jiào', 'shénme', 'míngzi']),
  hill: E('我住在山上。', ['我', '住', '在', '山上。'], ['wǒ', 'zhù', 'zài', 'shān shàng']),
  book: E('他买了一本书。', ['他', '买了', '一本', '书。'], ['tā', 'mǎi le', 'yì běn', 'shū']),
  wang: E('王老师是我们的老师。', ['王老师', '是', '我们的', '老师。'], ['Wáng lǎoshī', 'shì', 'wǒmen de', 'lǎoshī']),
  age: E('我今年十二岁。', ['我', '今年', '十二岁。'], ['wǒ', 'jīnnián', "shí'èr suì"]),
  bit: E('我要一点儿水。', ['我', '要', '一点儿', '水。'], ['wǒ', 'yào', 'yìdiǎnr', 'shuǐ']),
  girl: E('她是我的女儿。', ['她', '是', '我的', '女儿。'], ['tā', 'shì', 'wǒ de', "nǚ'ér"]),
  anna: E('我叫安娜。', ['我', '叫', '安娜。'], ['wǒ', 'jiào', 'Ānnà']),
  likecat: E('我喜欢猫。', ['我', '喜欢', '猫。'], ['wǒ', 'xǐhuan', 'māo']),
};
const ZW = { hello: { t: '你好', r: 'nǐ hǎo' }, four: { t: '四', r: 'sì' }, cat: { t: '猫', r: 'māo' }, teacher: { t: '老师', r: 'lǎoshī' }, boat: { t: '船', r: 'chuán' },
  hot: { t: '热', r: 'rè' }, heart: { t: '心', r: 'xīn' }, thanks: { t: '谢谢', r: 'xièxie' }, hundred: { t: '一百', r: 'yì bǎi' }, twenty: { t: '二十', r: 'èrshí' } };
r = zh(Z.cat, '我有一只猫'); check(r.s === 100 && r.full && r.last, 'zh 全对：我有一只猫', r);
r = zh(Z.eat, '我们一起去吃饭吧'); check(r.s === 100, 'zh 全对：我们一起去吃饭吧', r);
r = zh(Z.name, '你叫什么名字？'); check(r.s === 100, 'zh 带问号也满分', r);
r = zh(Z.age, '我今年十二岁'); check(r.s === 100, 'zh 全对：十二岁', r);
r = zh(Z.friend, '她是我的朋友'); check(r.s === 100, 'zh 同音字：他 = 她', r);
r = zh(Z.school, '我再学校'); check(r.s === 100, 'zh 同音字：在 = 再', r);
r = zh(Z.think, '我觉的很好'); check(r.s === 100, 'zh 同音字：得 = 的（轻声）', r);
r = zh(ZW.cat, '毛'); check(r.s === 100, 'zh 单个字同音：猫 = 毛（声调不打分）', r);
r = zh(Z.name, '你叫什么名子'); check(r.s === 100, 'zh 同音字：字 = 子', r);
r = zh(Z.ming, '晓明是我的朋友'); check(r.s === 100, 'zh 名字同音：小明 = 晓明', r);
r = zh(Z.wang, '汪老师是我们的老师'); check(r.s === 100, 'zh 同音：王 = 汪', r);
r = zh(Z.bank, '我们去银行'); check(r.s === 100, 'zh 多音字按课本的拼音：银行 yin hang', r);
r = zh(Z.two, '我有2只猫'); check(r.s === 100, 'zh 数字：2只 = 两只', r);
r = zh(Z.half, '现在3:30'); check(r.s === 100, 'zh 钟点：3:30 = 三点半', r);
r = zh(Z.half, '现在3点半'); check(r.s === 100, 'zh 钟点：3点半', r);
r = zh(Z.date, '今天5月3日'); check(r.s === 100, 'zh 日期：5月3日 = 五月三号（日 / 号）', r);
r = zh(E('我家有四口人。', ['我家', '有', '四口', '人。'], ['wǒ jiā', 'yǒu', 'sì kǒu', 'rén']), '我家有4口人'); check(r.s === 100, 'zh 数字：4口人', r);
r = zh(Z.age, '我今年12岁'); check(r.s === 100, 'zh 数字：12岁 = 十二岁', r);
r = zh(ZW.hundred, '100'); check(r.s === 100, 'zh 数字：100 = 一百', r);
r = zh(ZW.twenty, '20'); check(r.s === 100, 'zh 数字：20 = 二十', r);
r = zh(ZW.four, '4'); check(r.s === 100, 'zh 数字：4 = 四', r);
r = zh(Z.where, '你去哪'); check(r.s === 100, 'zh 儿化：哪儿 = 哪（儿不算一个音节）', r);
r = zh(Z.where, '你去哪儿'); check(r.s === 100, 'zh 儿化：哪儿 = 哪儿', r);
r = zh(Z.bit, '我要一点水'); check(r.s === 100, 'zh 儿化：一点儿 = 一点', r);
r = zh(Z.bit, '我要一点儿水'); check(r.s === 100, 'zh 儿化：一点儿 = 一点儿', r);
r = zh(Z.girl, '她是我的女儿'); check(r.s === 100, 'zh 女儿的「儿」是一个音节', r);
r = zh(ZW.thanks, '谢谢'); check(r.s === 100, 'zh 轻声不影响：谢谢', r);
r = zh(Z.apple, '我喜欢吃'); check(fail(r) && r.m === '1110', 'zh 漏了关键实词（苹果）：不过关', r);
r = zh(Z.cat, '我有猫'); check(fail(r), 'zh 漏了 一只：不过关', r);
r = zh(Z.eat, '我们去吃饭吧'); check(fail(r) && r.m === '10111', 'zh 漏了 一起：不过关', r);
r = zh(Z.rain, '我喜欢下雨'); check(fail(r) && r.m[1] === '0', 'zh 漏了 不（意思反了）：不过关', r);
r = zh(Z.likecat, '我不喜欢猫'); check(fail(r) && !r.full, 'zh 多说了 不（意思反了）：不过关', r);
r = zh(Z.friend, '他是我朋友'); check(half(r) && r.m === '1101', 'zh 少了块尾的 的：半对', r);
r = zh(Z.cat, '我有一只狗'); check(fail(r) && r.m === '1110', 'zh 说错了词：狗 ≠ 猫', r);
r = zh(Z.name, '你叫什么名单'); check(fail(r), 'zh 说错了词：名单 ≠ 名字', r);
r = zh(ZW.four, '十'); check(fail(r), 'zh 易混 s / sh：四 ≠ 十', r);
r = zh(Z.rice, '我次米饭'); check(fail(r) && r.m === '101', 'zh 易混 ch / c：吃 ≠ 次', r);
r = zh(Z.milk, '流奶很好喝'); check(fail(r) && r.m[0] === '0', 'zh 易混 n / l：牛 ≠ 流', r);
r = zh(Z.hill, '我住在三上'); check(fail(r), 'zh 易混 sh / s：山 ≠ 三', r);
r = zh(Z.hill, '我组在山上'); check(fail(r), 'zh 易混 zh / z：住 ≠ 组', r);
r = zh(ZW.boat, '床'); check(fail(r), 'zh 易混 -n / -ng：船 ≠ 床', r);
r = zh(ZW.hot, '乐'); check(fail(r), 'zh 易混 r / l：热 ≠ 乐', r);
r = zh(ZW.heart, '星'); check(fail(r), 'zh 易混 -n / -ng：心 ≠ 星', r);
r = zh(ZW.teacher, '老西'); check(fail(r), 'zh 易混 sh / x：师 ≠ 西', r);
r = zh(ZW.teacher, '老是'); check(r.s === 100, 'zh 只差声调（师 / 是）：算对（声调不打分）', r);
r = zh(E('你好啊！', ['你好', '啊！'], ['nǐ hǎo', 'a']), '你好呀'); check(r.s === 100, 'zh 句尾的 啊 连读成 呀：算一样', r);
r = zh(E('请坐。', ['请', '坐。'], ['qǐng', 'zuò']), '请错'); check(fail(r), 'zh 易混 z / c（送气）：坐 ≠ 错', r);
r = zh(Z.cat, '我有一个猫'); check(half(r) && r.m === '1101', 'zh 只差量词（只 / 个）：半对', r);
r = zh(Z.came, '他来'); check(half(r), 'zh 少了 了：半对', r);
r = zh(Z.book, '他买一本书'); check(half(r), 'zh 买了 / 买：半对', r);
r = zh(ZW.hello, '嗯你好啊'); check(r.s === 100, 'zh 前后多说了几个字：满分', r);
r = zh(Z.school, '嗯我在学校呢'); check(r.s === 100, 'zh 三块的句子前后多说了：满分', r);
r = zh(Z.name, '请问你叫什么名字'); check(perfect(r) && r.s >= 90, 'zh 四块的句子前面多说了：还是 Perfect', r);
r = zh(ZW.hello, '李好'); check(fail(r) && r.s >= 40, 'zh 单个词：李好 ≠ 你好（n / l），给参考分', r);
r = zh(Z.ming, '小林是我的朋友'); check(half(r) && r.m === '0111', 'zh 名字差得多（小林 ≠ 小明）：名字标红、不扣关键实词', r);
r = zh(Z.anna, '我叫安那'); check(r.s === 100, 'zh 名字同音：安娜 = 安那', r);
r = zh(Z.anna, '我叫安拉', { names: ['安娜'] }); check(r.s === 100, 'zh ctx.names：名字差一个字母也算对', r);
r = zh('我在学校', '我再学校'); check(r.s === 100, 'zh 没有 seg 的目标：每个字一块，照样按音节比', r);
r = zh('我们去银行', '我们去银行'); check(r.s === 100 && ZH.units('我们去银行').join(' ') === 'wo men qu yin hang', 'zh 没有拼音的目标：多音词按读音表（银行 hang）', r);
check(!ZH.early(Z.cat.t, '我有一只', { entry: Z.cat }) && ZH.early(Z.cat.t, '我有一只猫', { entry: Z.cat }), 'zh 秒出分：猫 说出来了才触发');
check(!ZH.early(Z.eat.t, '我们一起去吃饭', { entry: Z.eat }), 'zh 秒出分：最后的 吧 没说，不提前结束');
check(ZH.cue(Z.cat.t, 1, Z.cat) === 'w  y  yz  m。' && ZH.cue(Z.where.t, 1, Z.where) === 'n  q  n？', 'zh 提示 1 级：拼音的第一个字母', ZH.cue(Z.cat.t, 1, Z.cat));
check(ZH.cue(Z.cat.t, 2, Z.cat, true) === '我  ＿  ＿＿  ＿。' && ZH.cue('老师', 1, ZW.teacher) === 'ls' && ZH.cue('老师', 2, ZW.teacher) === '＿＿', 'zh 提示 2 级（first 留第一块）、单个词', ZH.cue(Z.cat.t, 2, Z.cat, true));
const zt = ZH.tiles(Z.cat.t, Z.cat);
check(zt.join('|') === '我|有|一只|猫' && ZH.joinTiles(zt) === '我有一只猫' && ZH.tiles(Z.where.t, Z.where).join('|') === '你|去|哪儿', 'zh 排句子：seg 去掉标点，接回去一样', zt);
check(ZH.countUnits('你好吗？') === 2 && ZH.countUnits('我是学生。') === 4 && ZH.countUnits('') === 0, 'zh 几个字：不算 吗 呢 吧 这些语气词');
check(ZH.isLine('猫', 0) && !ZH.isLine('猫', 1) && ZH.isLine('你好', 1) && !ZH.isLine('你好吗', 2) && ZH.isLine('我是学生', 2) && ZH.isLine('我是学生', 3), 'zh 算不算一句：入门 1 个字、初级 2 个、其余 4 个');
check(!ZH.isLine('わたしは学生', 0) && !ZH.isLine('hello', 0) && !ZH.isLine('', 0) && !ZH.isLine('OK OK OK 好', 0), 'zh 有假名、英语、空的、字母比汉字多的不算');
check(ZH.key('我是学生。') === ZH.key('我是 学生') && ZH.key('你好！') === '你好' && ZH.key('你好') !== '', 'zh 去重的键：空格标点不管、不会变成空的');
check(ZH.nameOk('小明') === '小明' && ZH.nameOk('王小明') === '王小明' && ZH.nameOk(' 李 华 ') === '李华', 'zh 玩家名字：1–4 个常用汉字');
check(ZH.nameOk('Li') === null && ZH.nameOk('小明明明明') === null && ZH.nameOk('さくら') === null && ZH.nameOk('') === null && ZH.nameOk('𠀀') === null, 'zh 玩家名字：字母、超过 4 个字、假名、空的、拼音表里没有的字不行');
check(ZH.num(0) === '零' && ZH.num(10) === '十' && ZH.num(15) === '十五' && ZH.num(20) === '二十' && ZH.num(105) === '一百零五' && ZH.num(110) === '一百一十', 'zh 数字读法 0–110');
check(ZH.num(1005) === '一千零五' && ZH.num(2000) === '两千' && ZH.num(2026) === '两千零二十六' && ZH.num(10000) === '一万' && ZH.num(9999) === '九千九百九十九', 'zh 数字读法 1005–10000');
check(ZH.time(2, 0) === '两点' && ZH.time(3, 30) === '三点半' && ZH.time(3, 5) === '三点零五' && ZH.date(5, 3) === '五月三日', 'zh 钟点和日期');
check(ZH.short('你好') && ZH.short('一只猫') && !ZH.short('我有一只猫'), 'zh 短的：三个字以内');
check(ZH.units(Z.where.t, { entry: Z.where }).join(' ') === 'ni qu na' && ZH.head('你好') === '你', 'zh units：不带声调的音节，儿化不算');

// ======================= 3. 黄金表 =======================
// 改打分规则以后这里会变：先确认变了的每一行是更诚实（或修了错），再改这里的数，并在提交说明里写清楚
console.log('— 黄金表');
const GJ = {
  a: J.a, b: J.school, c: J.morning, d: J.bday, e: J.lib, f: J.apples, g: E('雨が降っています。', ['雨が', '降っています。'], ['あめが', 'ふっています']),
};
const GZ = {
  a: Z.rain, b: E('我家有四口人。', ['我家', '有', '四口', '人。'], ['wǒ jiā', 'yǒu', 'sì kǒu', 'rén']), c: Z.eat, d: Z.name, e: Z.hill, f: Z.book, g: Z.age,
};
const GOLD = [
  ['es', '¿Dónde está la biblioteca?', 'donde esta la biblioteca', 100, '1111'],
  ['es', '¿Dónde está la biblioteca?', 'dónde está la librería', 50, '1110'],
  ['es', 'Mi hermana tiene once años.', 'mi hermana tiene 11 años', 100, '11111'],
  ['es', 'Mi hermana tiene once años.', 'mi hermana tiene años', 50, '11101'],
  ['es', 'Los niños juegan en el parque.', 'los niños juega en el parque', 84, '110111'],
  ['es', 'Los niños juegan en el parque.', 'los niños juegan en el parque hoy', 97, '111111'],
  ['es', 'Me gusta la clase de música.', 'me gusta la clase de musica', 100, '111111'],
  ['es', 'Me gusta la clase de música.', 'me gusta la casa de música', 50, '111011'],
  ['es', 'Hace mucho calor.', 'ase mucho calor', 100, '111'],
  ['es', 'Hace mucho calor.', 'hace mucho color', 50, '110'],
  ['es', 'Mi perro se llama Toby.', 'mi perro se llama tobi', 100, '11111'],
  ['es', 'Mi perro se llama Toby.', 'mi pero se llama toby', 50, '10111'],
  ['es', 'Tengo una hermana.', 'tengo 1 hermana', 100, '111'],
  ['es', 'Son las siete y cuarto.', 'son las 7:15', 100, '11111'],
  ['es', 'Son las siete y cuarto.', 'son las 7:30', 50, '11110'],
  ['es', 'pero', 'perro', 50, '0'],
  ['es', 'caro', 'carro', 50, '0'],
  ['es', 'vaca', 'baca', 100, '1'],
  ['es', 'Quiero un helado.', 'quiero helado', 77, '101'],
  ['es', '¿Te gusta el chocolate?', 'te gusta el chocolate', 100, '1111'],
  ['es', 'Él está cansado.', 'él está cansada', 84, '110'],
  ['es', 'Ellos comen pan.', 'ellos come pan', 84, '101'],
  ['ja', 'a', '私は学生です', 100, '111'],
  ['ja', 'a', '私は学生でした', 84, '110'],
  ['ja', 'a', '私が学生です', 84, '011'],
  ['ja', 'a', '私は先生です', 43, '101'],
  ['ja', 'a', 'わたしはがくせい', 78, '110'],
  ['ja', 'b', '学校に行きます', 100, '11'],
  ['ja', 'b', '学校で行きます', 84, '01'],
  ['ja', 'b', '学校に来ます', 50, '10'],
  ['ja', 'b', '学校に行った', 84, '10'],
  ['ja', 'c', '毎朝7時に起きます', 100, '111'],
  ['ja', 'c', '毎朝8時に起きます', 50, '101'],
  ['ja', 'c', '毎朝7時に起きる', 84, '110'],
  ['ja', 'd', '誕生日は5月3日です', 100, '111'],
  ['ja', 'd', '誕生日は5月4日です', 50, '110'],
  ['ja', 'e', '図書館で本を読みました', 100, '111'],
  ['ja', 'e', '図書館で読みました', 50, '101'],
  ['ja', 'e', 'としょかんでほんをよみました', 100, '111'],
  ['ja', 'f', 'りんごを4つください', 100, '111'],
  ['ja', 'f', 'りんごを4つ下さい', 100, '111'],
  ['ja', 'f', 'りんごを5つください', 50, '101'],
  ['ja', 'g', '雨が降っています', 100, '11'],
  ['ja', 'g', '雨が降っていません', 50, '10'],
  ['zh', 'a', '我不喜欢下雨', 100, '1111'],
  ['zh', 'a', '我喜欢下雨', 50, '1011'],
  ['zh', 'a', '我不喜欢下鱼', 100, '1111'],     // 雨 / 鱼 只差声调：声调不打分（已知的不足）
  ['zh', 'b', '我家有4口人', 100, '1111'],
  ['zh', 'b', '我家有四个人', 84, '1101'],
  ['zh', 'b', '我家有十口人', 50, '1101'],
  ['zh', 'c', '我们一起去吃饭吧', 100, '11111'],
  ['zh', 'c', '我们去吃饭吧', 50, '10111'],
  ['zh', 'c', '我们一起去吃饭', 84, '11110'],
  ['zh', 'c', '我们一起去次饭吧', 50, '11101'],
  ['zh', 'd', '你叫什么名字', 100, '1111'],
  ['zh', 'd', '你叫什么名子', 100, '1111'],
  ['zh', 'd', '请问你叫什么名字', 94, '1111'],
  ['zh', 'e', '我住在山上', 100, '1111'],
  ['zh', 'e', '我住在三上', 50, '1110'],
  ['zh', 'e', '我组在山上', 50, '1011'],
  ['zh', 'f', '他买了一本书', 100, '1111'],
  ['zh', 'f', '他买一本书', 84, '1011'],
  ['zh', 'f', '他买了一个书', 84, '1101'],
  ['zh', 'f', '他卖了一本书', 100, '1111'],     // 买 / 卖 只差声调：声调不打分（已知的不足）
  ['zh', 'g', '我今年12岁', 100, '111'],
  ['zh', 'g', '我今年11岁', 45, '110'],
];
const gbad = [];
GOLD.forEach(([lang, t, h, sc, mk]) => {
  const mod = L.get(lang), ent = lang === 'ja' ? GJ[t] : lang === 'zh' ? GZ[t] : null;
  const rr = S(mod, ent || t, h);
  if (rr.s !== sc || rr.m !== mk) gbad.push([lang, ent ? ent.t : t, h, '应该 ' + sc + ' ' + mk, '现在 ' + rr.s + ' ' + rr.m]);
});
check(!gbad.length, '黄金表 ' + GOLD.length + ' 行（西语 ' + GOLD.filter(g => g[0] === 'es').length + '、日语 ' + GOLD.filter(g => g[0] === 'ja').length + '、中文 ' + GOLD.filter(g => g[0] === 'zh').length + '）分数和每块的对错都没变', gbad.slice(0, 6));
// 分数线的总规矩：三门语言都一样
const rows = GOLD.map(([lang, t, h]) => { const ent = lang === 'ja' ? GJ[t] : lang === 'zh' ? GZ[t] : null; const mod = L.get(lang); return mod.score(ent ? ent.t : t, h, ent ? { entry: ent } : {}); });
check(rows.every(x => x.full || x.score <= 84) && rows.every(x => !x.full || x.marks.every(Boolean)) && rows.every(x => x.score >= 0 && x.score <= 100 && Number.isInteger(x.score)), '总规矩：有一块不对就不超过 84 分；full = 每块都对；分数是 0–100 的整数');

// ======================= 4. 读音表 =======================
console.log('— 读音表');
const course = {
  towns: [{ words: [{ t: '湖', r: 'みずうみ', zh: '湖', en: 'lake' }, { t: '先週', r: 'せんしゅう', zh: '上周', en: 'last week' }],
    sents: [{ t: '湖で泳ぎました。', seg: ['湖で', '泳ぎました。'], r: ['みずうみで', 'およぎました'] }] }],
};
const lexJ = L.lexicon('ja', course);
check(lexJ.lang === 'ja' && lexJ.map.get('湖')[0] === 'みずうみ' && lexJ.map.has('湖で') && lexJ.map.has('泳ぎ') && lexJ.n >= 4, 'lexicon(ja)：嵌套的课程内容里每个词、每块都进了表（湖、湖で、泳ぎ……）', [...lexJ.map.keys()]);
r = ja('先週、湖に行きました', 'せんしゅうみずうみにいきました'); check(r.s < 85 && !r.full && r.m === '110111111', 'ja 没给读音表：目标里的 湖 读不出来，只有这个字对不上（不给 Perfect）', r);
r = ja('先週、湖に行きました', 'せんしゅうみずうみにいきました', { lex: lexJ }); check(r.s === 100, 'ja 给了读音表（ctx.lex）：湖 = みずうみ，满分', r);
r = ja('先週、湖に行きました', '先週湖に行きました', { lex: lexJ }); check(r.s === 100, 'ja 两边都是汉字：照样满分', r);
// 日语：这句话能不能整句读出来（JA.readable：聊天评语里「更好的说法」读得出来的才进每日复习，tools/course/TALK.md 第二轮 C）
{
  const R = (t, lex) => JA.readable(t, lex);
  check(typeof JA.readable === 'function' && typeof ES.readable !== 'function' && typeof ZH.readable !== 'function', 'ja readable：只有日语有这条规矩（西语、中文的句子一律能打分）');
  check(R('ゆいさんはともだちです。') && R('コーヒーをください！') && R('はい。'), 'ja readable：全是假名（平假名、片假名、长音）的句子读得出来');
  check(R('私は学生です。') && R('父は先生です。') && R('毎日、学校に行きます。') && R('切符を買います'), 'ja readable：汉字在自带的读音表里（私、学生、父、先生、毎日、学校、行きます、切符、買います）');
  check(R('三時に起きます。') && R('りんごを3つ食べました') && R('友達が二人います') && R('7:30に行きます'), 'ja readable：数字和量词按读法读（三時、3つ、二人、7:30）');
  check(!R('先週、湖に行きました') && R('先週、湖に行きました', lexJ) && R('湖で泳ぎました。', lexJ), 'ja readable：自带的表里没有的汉字（湖）读不出来；课程的读音表里有就读得出来');
  check(!R('鬱です。') && !R('鬱です。', lexJ) && !R('父は醤油を買います', lexJ), 'ja readable：哪张表里都没有的汉字（鬱、醤油）：有一处读不出来就不算');
  check(!R('Kaiさんは友達です') && !R('I like sushi.') && !R('すしが好きです😀'), 'ja readable：有拉丁字母（名字多半识别成片假名，对不上）、表情的不算');
  check(!R('') && !R('。！？') && !R(null) && !R('   '), 'ja readable：空的、只有标点的不算');
  // 读得出来的句子，没有条目（没有 seg / r）也按读音打得了分：识别结果写成汉字、写成假名都对
  r = ja('父は先生です。', 'ちちはせんせいです'); check(r.s === 100, 'ja 读得出来的句子（没有条目）：听到的全是假名，满分', r);
  r = ja('父は先生です。', '父は先生です'); check(r.s === 100, 'ja 读得出来的句子（没有条目）：听到的是汉字，满分', r);
  r = ja('父は先生です。', 'ははは先生です'); check(r.s < 85 && !r.full, 'ja 读得出来的句子（没有条目）：说错一个词（父 → 母）不给满分', r);
}
// 委托的示范句、词卡里会被识别结果写成汉字的写法（2026-11-21 日语译者列的）：自带的读音表、量词表里要有
r = ja(E('ぎゅうにくめんを三ばいください。', ['ぎゅうにくめんを', '三ばい', 'ください。'], ['ぎゅうにくめんを', 'さんばい', 'ください']), '牛肉麺を3杯ください'); check(r.s === 100, 'ja 假名词被写成汉字 + 量词：牛肉麺を3杯 = ぎゅうにくめんをさんばい', r);
r = ja(E('川のそばにあひるが三羽います。', ['川の', 'そばに', 'あひるが', '三羽', 'います。'], ['かわの', 'そばに', 'あひるが', 'さんわ', 'います']), '川のそばにアヒルが3羽います'); check(r.s === 100, 'ja 量词 羽：3羽 = さんわ（アヒル = あひる）', r);
r = ja('川のそばにあひるが三羽います。', '川のそばに家鴨が三羽います'); check(r.s === 100, 'ja 没有条目的目标也一样：家鴨 = あひる、三羽 两边都按量词读', r);
r = ja('牛が一頭います', '牛が1頭います'); check(r.s === 100, 'ja 量词 頭：1頭 = いっとう', r);
r = ja('牛が一頭います', 'うしがいっとういます'); check(r.s === 100, 'ja 量词 頭：听到的全是假名（いっとう）也满分', r);
r = ja('牛が一頭います', 'うしがにとういます'); check(r.s < 85 && !r.full, 'ja 量词 頭：说成二頭不给满分', r);
check(JA.count(3, '羽').join('|') === 'さんわ|さんば' && JA.count(6, '頭')[0] === 'ろくとう' && JA.count(11, '羽')[0] === 'じゅういちわ' && JA.count(3, '杯')[0] === 'さんばい', 'ja 量词表：羽（さんわ / さんば）、頭（ろくとう）、杯（さんばい）、11 以上接个位的读法');
check(['滝で手袋をなくしました', '灰色の模様です', '向かいの庭園に屋台があります', '大雪で午前中の予定はありません', '農場に風車があります', '注文の理由を持ち主に聞きます', 'みんなが集まります', '役に立ちます'].every(t => JA.readable(t)),
  'ja 自带的读音表：滝、手袋、灰色、模様、向かい、庭園、屋台、大雪、午前中、予定、農場、風車、注文、理由、持ち主、集まる、役に立つ 都读得出来');
// 聊天里词卡变绿：按读音比（JA.hasWord），不按写法
{
  const H = (w, t, ctx) => JA.hasWord(w, t, ctx);
  check(typeof JA.hasWord === 'function' && H('ぼうし', '青い帽子をわすれました') && H('ぼうし', '青いぼうしをわすれました') && H('ぼうし', 'アオイボウシです') && H('帽子', 'ぼうしをかぶっています'), 'ja hasWord：词卡是假名（ぼうし）——听到的写成汉字（帽子）、假名、片假名都算；词卡是汉字、听到的是假名也算');
  check(H('あひる', '川に家鴨がいます') && H('あひる', 'アヒルが三羽います') && H('家鴨', 'あひるがいます') && H('ぎゅうにくめん', '牛肉麺を3杯ください'), 'ja hasWord：读音表里有的汉字写法（家鴨、牛肉麺）和假名的词卡对得上，反过来也对得上');
  check(H('どんな人', '彼はどんな人ですか') && H('名前', 'なまえは何ですか') && H('名前', 'お名前は') && H('三ばい', '3杯ください') && H('今', 'いまどこにいますか'), 'ja hasWord：一个写法有几种读音的都试（人 ひと / じん / にん）、数字和量词按读法');
  check(!H('ぼうし', 'かばんをわすれました') && !H('名前', '前の人です') && !H('', 'なまえ') && !H('ぼうし', ''), 'ja hasWord：没说到的不算，空的不算');
  check(H('湖', 'みずうみで泳ぎました', { lex: lexJ }) && !H('湖', 'みずうみで泳ぎました') && H('みずうみ', '湖で泳ぎました', { lex: lexJ }) && H('帽子', 'ぼうしです', { entry: { t: '帽子', r: 'ぼうし' } }), 'ja hasWord：课程的读音表（ctx.lex）、词卡自己带的读音（ctx.entry.r）都用上');
  check(typeof ES.hasWord !== 'function' && typeof ZH.hasWord !== 'function', 'ja hasWord：只有日语按读音比（西语、中文照写法比）');
}
const lexZ = L.lexicon('zh', [{ t: '一点儿', r: 'yìdiǎnr' }, { t: '我们去银行。', seg: ['我们', '去', '银行。'], r: ['wǒmen', 'qù', 'yínháng'] }, { t: '重新', r: 'chóngxīn' }]);
check(lexZ.map.get('一点')[0] === 'yi dian' && lexZ.map.get('银行')[0] === 'yin hang' && lexZ.map.get('重新')[0] === 'chong xin', 'lexicon(zh)：儿化的「儿」去掉、多音字按课本（银行、重新）', [...lexZ.map.entries()]);
check(L.lexicon('es', course).n === 0 && L.lexicon('xx', course).n === 0, 'lexicon：西语和不认识的语言是空表');
check(ZH._.parsePy('yìdiǎnr').map(x => x.s + (x.r ? 'r' : '')).join(' ') === 'yi dianr' && ZH._.parsePy("nǚ'ér").map(x => x.s).join(' ') === 'nv er' && ZH._.parsePy('Wáng lǎoshī').map(x => x.s).join(' ') === 'wang lao shi', 'zh 拼音解析：连写、儿化、隔音符号、ü、大写');

console.log((fails ? 'FAIL ' + fails : 'PASS') + '（' + total + ' 项）');
if (fails) process.exitCode = 1;
