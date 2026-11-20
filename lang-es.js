// 回声岛 · 西班牙语（EchoLang.reg('es')；也是 Node 模块）——口语打分、提示、排句子、聊天算句数、名字、数字
// 先加载 lang.js。接口见 lang.js 和 tests/lang.test.js。
//
// 打分（和英语 game.js 的 scoreSpeech 同一套分数线，规矩见 lang.js 开头）：
// · 单位是词：目标按空格切成显示的块（pieces），每块再切成打分的词（数字会变成几个词）。识别服务不知道答案。
// · 写法统一：小写；重音符号和 ü 去掉再比（识别服务有的写有的不写），ñ 保留（año ≠ ano）；¿¡ 和标点去掉；数字变成西语的词
//   （1 → uno / un / una 都行，21 → veintiuno / veintiún / veintiuna，200 → doscientos / doscientas；3:30 → tres y media / tres treinta）。
//   al、del 照原样（识别服务写 a el 的合起来）。
// · 拉美西语里本来就同音的算对：b / v、不发音的 h、s / z / 软 c（seseo）、ll / y（yeísmo）、qu / k、软 g / j——识别服务挑哪种写法说明不了学的人说得对不对。
// · 易混的不算对：r / rr（pero ≠ perro、caro ≠ carro）、n / ñ、l / r、元音不同（mesa ≠ misa）……都是不同的音，照字面就不一样。
// · 重音位置不同的词（papá / papa、está / esta、habló / hablo）：识别服务不写重音时看不出来，算对；
//   **识别结果里别处写了重音（说明它会写）而这个词的重音和目标不一样**才算不对：papa / papá、esta / está 这类意思完全不同的不算对，
//   动词 -o / -ó、-e / -é（hablo / habló，人称时态不同）算只错了词尾。听到的词自己带着另一个重音（目标 esta、听到 está）一律不算对，动词那种除外。
// · 只错词尾算半对（¾，不给 Perfect）：阴阳性、单复数（gato / gata / gatos、grande / grandes、feliz / felices）、
//   动词人称时态（hablo / hablas / hablamos / habló、comer / come）、常用不规则动词的各种形式（soy / es / son、tengo / tiene、voy / va……）、
//   冠词和指示词（el / la / los、un / una、este / esta）。ser 和 estar 是两个词（es ≠ está）。
//   o / a 换了意思就完全不同的常见词（casa / caso、puerta / puerto、mesa / meses……）写在 NOGEN 里，不算半对。
// · 虚词（冠词、介词、代词、ser / estar / haber 的常用形式、muy、también……）权重 1，其余是实词（权重 2）。no 改变意思，算实词；
//   带重音的疑问词（qué、cómo、dónde……）算实词。漏掉四分之一以上的关键实词不过关；多说了一个目标里没有的 no / nunca 也不过关。
// · 名字：大写开头、不在句首（句首的后面紧跟另一个大写词、或者后面是逗号才算）、不是星期 / 月份 / 国家 / 称呼，三个字母以上——
//   按发音差四分之一个字母以内也算对、被拆成两个词的先拼回去，不算进「关键实词」（ctx.names 也可以直接给名字）。
// 已知的不足：拼写变体靠一张小表（vídeo / video、fútbol / futbol……）；o / a 换意思的词只收了常见的；
//   重音规则按「识别服务这一句写没写重音」来猜，混着写的识别结果可能误判；没有词典，不认识的词一律按字面比。
(function (root) {
  'use strict';
  const L = root.EchoLang || (typeof module !== 'undefined' && module.exports && typeof require === 'function' ? require('./lang.js') : null);

  // ---------- 写法 ----------
  const fold = s => String(s).replace(/ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ');
  const ACC = /[áéíóú]/;
  // 发音一样的写法合成一种（拉美西语）：ch 留着，h 不发音，qu(e/i) = k，gu(e/i) = 硬 g，g(e/i) = j，c(e/i) = s，c = k，z = s，ll = y，v = b，词尾的 y = i
  function pk(w) {
    return String(w)
      .replace(/ch/g, '#').replace(/h/g, '')
      .replace(/qu(?=[ei])/g, 'k').replace(/gu(?=[ei])/g, 'G').replace(/g(?=[ei])/g, 'j').replace(/G/g, 'g')
      .replace(/c(?=[ei])/g, 's').replace(/c/g, 'k').replace(/z/g, 's')
      .replace(/ll/g, 'y').replace(/v/g, 'b').replace(/y$/, 'i');
  }
  // 重音在倒数第几个音节（0 = 最后一个）；音节按元音组数（强元音 a e o 之间分开，带重音的 í ú 自己一个），qu / gu 里的 u 不算
  const STRONG = new Set('aeoáéó'), WEAKACC = new Set('íú');
  function stress(a) {
    const s = String(a), groups = [];
    let prev = '', cur = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const vowel = /[aeiouáéíóúü]/.test(c) || (c === 'y' && i === s.length - 1 && i > 0 && /[aeiou]/.test(s[i - 1]));
      if (vowel && c === 'u' && (s[i - 1] === 'q' || s[i - 1] === 'g') && /[eiéí]/.test(s[i + 1] || '')) { prev = ''; continue; }   // que、gui 里的 u 不发音
      if (!vowel) { cur = null; prev = ''; continue; }
      const join = cur && prev && !(STRONG.has(prev) && STRONG.has(c)) && !WEAKACC.has(prev) && !WEAKACC.has(c);
      if (join) cur.push(i); else { cur = [i]; groups.push(cur); }
      prev = c;
    }
    const n = groups.length;
    if (n <= 1) return { n, pos: 0 };
    const k = groups.findIndex(g => g.some(i => ACC.test(s[i])));
    if (k >= 0) return { n, pos: n - 1 - k };
    return { n, pos: /[aeiouns]$/.test(fold(s)) ? 1 : 0 };
  }
  const stressDiff = (a, b) => { const x = stress(a), y = stress(b); return x.n >= 2 && y.n >= 2 && x.pos !== y.pos; };

  // ---------- 数字 ----------
  const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
    'veintisiete', 'veintiocho', 'veintinueve'];
  const T10 = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C100 = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const apoc = s => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
  function esNum(n) {
    n = Math.floor(Math.abs(+n) || 0);
    if (n < 30) return U[n];
    if (n < 100) return T10[Math.floor(n / 10)] + (n % 10 ? ' y ' + U[n % 10] : '');
    if (n === 100) return 'cien';
    if (n < 1000) return C100[Math.floor(n / 100)] + (n % 100 ? ' ' + esNum(n % 100) : '');
    if (n < 1e6) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? 'mil' : apoc(esNum(k)) + ' mil') + (r ? ' ' + esNum(r) : ''); }
    if (n < 1e9) { const k = Math.floor(n / 1e6), r = n % 1e6; return (k === 1 ? 'un millón' : apoc(esNum(k)) + ' millones') + (r ? ' ' + esNum(r) : ''); }
    return String(n);
  }
  const hourW = h => (h % 12 === 1 && h !== 11 ? 'una' : esNum(h));
  // 钟点的几种说法（识别服务把「las tres y media」写成 3:30）
  function timeWays(h, m) {
    const H = hourW(h), H1 = hourW(h === 12 ? 1 : h + 1);
    if (m === 0) return [H, H + ' en punto'];
    if (m === 15) return [H + ' y cuarto', H + ' y quince', H + ' quince'];
    if (m === 30) return [H + ' y media', H + ' y treinta', H + ' treinta'];
    if (m === 45) return [H + ' y cuarenta y cinco', H + ' cuarenta y cinco', H1 + ' menos cuarto', H1 + ' menos quince'];
    return [H + ' y ' + esNum(m), H + ' ' + esNum(m)];
  }
  const ORD = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- 词表 ----------
  const set = s => new Set(s.split(/\s+/).filter(Boolean));
  // 虚词（权重 1），按去掉重音的写法
  const FUNC = set('el la los las lo un una unos unas uno al del de a en con por para sin sobre entre hasta desde hacia y e o u ni que pero si como cuando donde ' +
    'me te se nos le les mi mis tu tus su sus yo ella ellos ellas nosotros nosotras usted ustedes ' +
    'es soy eres somos son era eras eramos eran fue fui esta estoy estas estamos estan estaba hay ha he has han hemos ' +
    'muy tambien ya pues bueno oh ah eh este estos esto ese esa esos esas eso favor');
  // 带重音的疑问词：实词
  const QW = set('qué cómo dónde cuándo cuánto cuánta cuántos cuántas quién quiénes cuál cuáles adónde');
  // 大写但不是人名的词：照普通词打分
  const NOT_NAME = set('lunes martes miercoles jueves viernes sabado domingo enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre ' +
    'espana mexico china japon peru chile argentina colombia ecuador venezuela cuba bolivia uruguay paraguay panama guatemala honduras nicaragua ' +
    'inglaterra francia alemania italia rusia india corea canada estados unidos america europa asia africa australia ' +
    'espanol ingles chino japones frances aleman navidad pascua tierra luna sol marte internet tv ' +
    'senor senora senorita don dona doctor doctora profesor profesora hola gracias buenos buenas');
  // 拼写变体（按带重音的小写写法）
  const SPELL = { 'vídeo': 'video', 'fútbol': 'futbol', 'béisbol': 'beisbol', 'básquetbol': 'basquetbol', 'chófer': 'chofer', 'setiembre': 'septiembre',
    'sicología': 'psicología', 'quizás': 'quizá', 'okey': 'ok', 'okay': 'ok', 'oká': 'ok' };
  const ABBR = { 'sr': 'señor', 'sra': 'señora', 'srta': 'señorita', 'dr': 'doctor', 'dra': 'doctora', 'ud': 'usted', 'uds': 'ustedes', 'prof': 'profesor', 'profa': 'profesora' };
  // 同一个词的不同形式（算只错了词尾）：冠词、指示词、物主词、不规则动词……（去掉重音的写法）
  const FAM = new Map();
  ['el la los las lo', 'un una unos unas uno', 'este esta estos estas esto', 'ese esa esos esas eso', 'aquel aquella aquellos aquellas aquello',
    'mi mis', 'tu tus', 'su sus', 'nuestro nuestra nuestros nuestras', 'mio mia mios mias', 'tuyo tuya tuyos tuyas', 'suyo suya suyos suyas',
    'y e', 'o u', 'bueno buena buenos buenas buen', 'malo mala malos malas mal', 'grande grandes gran', 'primero primera primer', 'tercero tercera tercer',
    'alguno alguna algunos algunas algun', 'ninguno ninguna ningun', 'mucho mucha muchos muchas', 'poco poca pocos pocas', 'todo toda todos todas',
    'otro otra otros otras', 'cual cuales', 'quien quienes', 'cuanto cuanta cuantos cuantas',
    'ser soy eres es somos son era eras eramos eran fui fuiste fue fuimos fueron sera seran sido siendo sea',
    'estar estoy estas esta estamos estan estaba estaban estuve estuvo estuvieron estado estando este',
    'haber he has ha hemos han habia hubo habra haya hay',
    'tener tengo tienes tiene tenemos tienen tenia tenian tuve tuvo tuvieron tendra tenido',
    'ir voy vas va vamos van iba iban fui fue fueron ira ido yendo',
    'hacer hago haces hace hacemos hacen hice hizo hicieron hara hecho haciendo',
    'poder puedo puedes puede podemos pueden pude pudo podia podra',
    'querer quiero quieres quiere queremos quieren quise quiso queria',
    'jugar juego juegas juega jugamos juegan jugue jugo jugaba',
    'dormir duermo duermes duerme dormimos duermen dormi durmio dormia',
    'venir vengo vienes viene venimos vienen vine vino venia',
    'decir digo dices dice decimos dicen dije dijo decia dicho',
    'ver veo ves ve vemos ven vi vio veia visto',
    'saber se sabes sabe sabemos saben supe supo sabia',
    'dar doy das da damos dan di dio daba',
    'salir salgo sales sale salimos salen sali salio',
    'poner pongo pones pone ponemos ponen puse puso puesto',
    'traer traigo traes trae traemos traen traje trajo',
    'oir oigo oyes oye oimos oyen oi oyo',
    'pensar pienso piensas piensa pensamos piensan',
    'empezar empiezo empiezas empieza empezamos empiezan empece empezo',
    'volver vuelvo vuelves vuelve volvemos vuelven volvi volvio',
    'preferir prefiero prefieres prefiere preferimos prefieren',
    'sentir siento sientes siente sentimos sienten',
    'pedir pido pides pide pedimos piden',
    'seguir sigo sigues sigue seguimos siguen',
    'gustar gusta gustan gusto gustaba encantar encanta encantan',
    'llover llueve llovio', 'nevar nieva nevo',
    'conocer conozco conoces conoce conocemos conocen',
    'leer leo lees lee leemos leen lei leyo',
    'llegar llego llegas llega llegamos llegan llegue',
    'buscar busco buscas busca buscamos buscan busque',
    'comenzar comienzo comienzas comienza', 'cerrar cierro cierras cierra', 'despertar despierto despierta', 'entender entiendo entiendes entiende',
    'perder pierdo pierdes pierde', 'encontrar encuentro encuentras encuentra', 'contar cuento cuentas cuenta', 'mostrar muestro muestra',
    'recordar recuerdo recuerdas recuerda', 'costar cuesta cuestan', 'almorzar almuerzo almuerzas almuerza',
    'vestir visto vistes viste', 'repetir repito repites repite', 'servir sirvo sirves sirve', 'elegir elijo eliges elige',
  ].forEach((g, k) => g.split(' ').forEach(w => { const a = FAM.get(w) || []; a.push(k); FAM.set(w, a); }));
  // o / a（或者多一个 s / es）换了意思的常见词：不算「只错了词尾」
  const NOGEN = new Set();
  ('casa|caso cosa|caso cosa|cose cosa|coso puerta|puerto libro|libra pera|pero moda|modo rama|ramo cuenta|cuento punta|punto fruta|fruto bolsa|bolso ' +
    'barca|barco cesta|cesto palo|pala suelo|suela foca|foco giro|gira manga|mango plata|plato partida|partido banca|banco cara|caro mesa|meses mesa|mes ' +
    'mano|mana pelo|pela sala|salo cola|col sola|sol mar|mara pan|pana flor|flora tema|temo pasta|pasto marca|marco lista|listo')
    .split(' ').forEach(p => { const [a, b] = p.split('|'); NOGEN.add(a + '|' + b); NOGEN.add(b + '|' + a); });
  // 名词形容词的性、数：去掉一样的开头后，剩下的两截是这些（无序）
  const NOM = new Set();
  [['o', 'a'], ['o', 'os'], ['a', 'as'], ['os', 'as'], ['o', 'as'], ['a', 'os'], ['e', 'es'], ['', 's'], ['', 'es'], ['z', 'ces']].forEach(([a, b]) => { NOM.add(a + '|' + b); NOM.add(b + '|' + a); });
  // 动词词尾（去掉重音，长的在前）
  const VEND = ('ieramos aramos abamos iamos asteis isteis aremos eremos iremos arian erian irian ieron aron ando iendo aste iste amos emos imos ' +
    'aban abas aria eria iria aba ian ias ado ido ada ida are ere ire ara era an en as es ar er ir io ia a e o i').split(' ');
  function vstem(w) {
    for (const e of VEND) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
    return '';
  }
  const cp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  // 只错了词尾（去掉重音的写法）
  function inflect(a, b) {
    if (a === b) return false;
    const fa = FAM.get(a), fb = FAM.get(b);
    if (fa && fb && fa.some(x => fb.includes(x))) return true;
    if (NOGEN.has(a + '|' + b)) return false;
    const p = cp(a, b);
    if (p >= 3 && NOM.has(a.slice(p) + '|' + b.slice(p))) return true;
    const sa = vstem(a), sb = vstem(b);
    return !!sa && sa === sb;
  }
  // 重音位置不一样、只差在一个重音符号上的两个写法：papa / papá、esta / está 意思完全不同
  const STRESS0 = new Set();
  'papa|papá mama|mamá esta|está estas|estás este|esté sabana|sábana ejercito|ejército publico|público practico|práctico termino|término numero|número critico|crítico calculo|cálculo deposito|depósito'
    .split(' ').forEach(p => { const [a, b] = p.split('|'); STRESS0.add(a + '|' + b); STRESS0.add(b + '|' + a); });

  // ---------- 切词 ----------
  // 一段话 → [{ w 去掉重音的写法, a 带重音的小写写法, alts 别的说法（数字） }]
  const NUMK = '\u0002';   // 数字变出来的词带这个记号（tokens 里给 uno / un / una 这种）
  function toks(s) {
    let x = ' ' + String(s || '').normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'") + ' ';
    x = x.replace(/\b(sr|sra|srta|dr|dra|ud|uds|prof|profa)\./g, (m, k) => ABBR[k] + ' ');
    x = x.replace(/(\d+)(?:\.?º|\.?ª|°|ero|era|er|ro|ra|do|da|to|ta|vo|va|no|na|mo|ma)(?![a-zñáéíóú])/g, m => {
      const d = m.match(/\d+/)[0];
      const n = +d, fem = /[ªa]$/.test(m);
      if (n < 1 || n > 10) return ' ' + esNum(n) + ' ';
      let w = ORD[n]; if (fem) w = w.replace(/o$/, 'a'); else if (/er$/.test(m)) w = w.replace(/ero$/, 'er');
      return ' ' + w + ' ';
    });
    x = x.replace(/(\d+)\s*%/g, (m, d) => ' ' + d + ' por ciento ');
    x = x.replace(/\b(\d{1,3})(?:[.,]\d{3})+\b/g, m => m.replace(/[.,]/g, ''));
    x = x.replace(/\d+/g, d => ' ' + esNum(+d).split(' ').map(w => NUMK + w).join(' ') + ' ');
    x = x.replace(/[^\p{L}\u0002\s]/gu, ' ');
    const raw = x.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      let a = raw[i], num = false;
      if (a[0] === NUMK) { num = true; a = a.slice(1); }
      if (!a) continue;
      // a el → al、de el → del（带重音的 él 是代词，不合）
      if ((a === 'a' || a === 'de') && raw[i + 1] === 'el') { a = a === 'a' ? 'al' : 'del'; i++; }
      a = SPELL[a] || a;
      const t = { w: fold(a), a };
      if (num) {
        const alt = [];
        if (a === 'uno') alt.push('un', 'una');
        else if (a === 'un') alt.push('uno', 'una');
        else if (a === 'veintiuno') alt.push('veintiún', 'veintiuna');
        else if (/cientos$/.test(a)) alt.push(a.replace(/os$/, 'as'));
        if (alt.length) t.alts = alt.map(y => ({ w: fold(y), a: y }));
      }
      out.push(t);
    }
    return out;
  }
  // 识别结果里有钟点（3:30）：几种说法都试一遍
  function variants(heard) {
    let vs = [String(heard || '')];
    const re = /(\d{1,2})\s*:\s*(\d{2})/;
    for (let k = 0; k < 3; k++) {
      if (!re.test(vs[0])) break;
      const nx = [];
      vs.forEach(v => { const m = re.exec(v); if (!m) { nx.push(v); return; } timeWays(+m[1], +m[2]).forEach(w => nx.push(v.slice(0, m.index) + ' ' + w + ' ' + v.slice(m.index + m[0].length))); });
      vs = nx.slice(0, 8);
    }
    return vs;
  }

  // ---------- 名字 ----------
  const lead = /^[¿¡"'«(“‘]+/;
  function nameIdx(words, names) {
    const out = new Set();
    const nm = (names || []).map(n => fold(String(n).toLowerCase()));
    words.forEach((w0, k) => {
      const w = w0.replace(lead, '');
      if (nm.length && nm.includes(fold(w.toLowerCase().replace(/[^\p{L}]/gu, '')))) { out.add(k); return; }
      if (!/^\p{Lu}/u.test(w)) return;
      if (k > 0) { if (!/[.!?…]["'»”’)]*$/.test(words[k - 1])) out.add(k); }
      else if (/,$/.test(w) || (words.length > 1 && /^\p{Lu}/u.test(words[1].replace(lead, '')) && !/[.!?]$/.test(w))) out.add(k);
    });
    return out;
  }
  const nameTol = w => Math.max(1, Math.floor(w.length / 4));

  // ---------- 两个词对得上多少：4 对、3 只错了词尾、0 不对 ----------
  function tok1(t, h, nm, acc) {
    let v = 0;
    if (t.w === h.w || pk(t.w) === pk(h.w)) {
      v = 4;
      if (t.a !== h.a && stressDiff(t.a, h.a)) {
        const vb = (/[óé]$/.test(t.a) || /[óé]$/.test(h.a)) && t.a.slice(0, -1) === h.a.slice(0, -1);
        if (STRESS0.has(t.a + '|' + h.a)) v = acc ? 0 : 4;        // papá / papa：识别服务会写重音时才算不对
        else if (ACC.test(h.a)) v = vb ? 3 : 0;                     // 听到的词自己带着另一个重音
        else if (acc && vb) v = 3;                                  // habló → hablo：识别服务这一句写了重音、这里没写
      }
    }
    if (v < 4 && nm && L.lev(pk(t.w), pk(h.w)) <= nameTol(t.w)) v = 4;
    if (!v && inflect(t.w, h.w)) v = 3;
    return v;
  }
  const forms = t => (t.alts ? [t].concat(t.alts) : [t]);
  function tokM(t, h, nm, acc) {
    let v = 0;
    for (const x of forms(t)) for (const y of forms(h)) { v = Math.max(v, tok1(x, y, nm, acc)); if (v === 4) return 4; }
    return v;
  }
  // 名字被识别服务拆成两个词（Mari Carmen → maricarmen）：拼回去
  function rejoin(T, H, isName) {
    T.forEach((t, i) => {
      if (!isName[i] || H.some(h => pk(h.w) === pk(t.w))) return;
      for (let j = 0; j + 1 < H.length; j++) {
        const jw = H[j].w + H[j + 1].w;
        if (L.lev(pk(jw), pk(t.w)) <= nameTol(t.w)) { H = H.slice(0, j).concat([{ w: jw, a: H[j].a + H[j + 1].a }], H.slice(j + 2)); break; }
      }
    });
    return H;
  }

  // ---------- 打分 ----------
  const pieces = text => String(text || '').split(/\s+/).filter(Boolean);
  function score(target, heard, ctx) {
    ctx = ctx || {};
    const words = pieces(target), P = words.length;
    const zero = { score: 0, marks: new Array(P).fill(false), last: false, full: false };
    const T = [], owner = [];
    words.forEach((w, k) => toks(w).forEach(t => { T.push(t); owner.push(k); }));
    if (!T.length || !String(heard || '').trim()) return zero;
    const names = nameIdx(words, ctx.names);
    const isName = T.map((t, i) => names.has(owner[i]) && !FUNC.has(t.w) && !NOT_NAME.has(t.w) && t.w.length >= 3);
    const wt = T.map(t => (FUNC.has(t.w) && !QW.has(t.a) ? 1 : 2));
    const acc = ACC.test(String(heard).toLowerCase());
    let best = null;
    for (const hv of variants(heard)) {
      let H = toks(hv);
      if (!H.length) continue;
      H = rejoin(T, H, isName);
      const r = one(T, H, owner, P, isName, wt, acc);
      if (!best || r.score > best.score) best = r;
    }
    return best || zero;
  }
  function one(T, H, owner, P, isName, wt, acc) {
    const n = T.length, memo = new Map();
    const val = (i, k, j) => {
      if (j !== k + 1) return 0;
      const key = i * 4096 + k;
      if (!memo.has(key)) memo.set(key, tokM(T[i], H[k], isName[i], acc));
      return memo.get(key);
    };
    const sp = () => [1, 1];
    const { got, at } = L.alignSpans(n, H.length, wt, val, sp, () => 1);
    // 多说了一个 no / nunca……（目标里没有）：意思反了
    const cov = L.covered(at, got, H.length), negs = x => x.filter(t => NEGW.has(t.w)).length;
    const extraNeg = negs(H) > negs(T) && H.some((t, k) => NEGW.has(t.w) && !cov[k]);
    const items = T.map((t, i) => ({ wt: wt[i], n: 1, piece: owner[i], name: isName[i] }));
    let whole = null;
    if (n <= 2) {
      const a = T.map(t => pk(t.w)).join(''), b = H.map(t => pk(t.w)).join('');
      let eq = a === b;
      if (eq && n === H.length) eq = T.every((t, i) => tokM(t, H[i], isName[i], acc) === 4);
      whole = { eq, split: n !== H.length, sim: (1 - L.lev(a, b) / Math.max(a.length, b.length, 1)) * 0.95 };
    }
    const contig = n <= 3 && L.contig(n, H.length, val, sp);
    return L.negCap(L.finish({ items, got, pieces: P, nH: H.length, whole, contig }), extraNeg);
  }
  const NEGW = set('no nunca jamas tampoco ni');

  // ---------- 提示、排句子、聊天 ----------
  const minWords = level => { const v = L.lvOk(level); return v === 0 ? 1 : v === 1 ? 2 : 3; };
  const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/;
  // 只在英语里有的常用词（西语里不是词）：一句话里占一半以上、又没有西语常用词，就是说的英语
  const EN_ONLY = set('the is are you i and what this that it she we they my your have do does with for to of in on at be was were not ' +
    'like very much yes hello thanks thank please how where when who why can will would there here from about just all an but or if up out ' +
    'get go know want good great nice am');
  const ES_HINT = set('el la los las de que y en un una es no por con para me te se mi tu su lo le yo muy pero como mas hola si gracias que esta estoy soy tengo quiero me gusta');
  const words = s => (String(s || '').match(/\p{L}+/gu) || []);
  const mod = {
    code: 'es',
    name: { zh: '西班牙语', en: 'Spanish', self: 'Español' },
    script: 'latin',
    asr: { cloud: 'es', apple: 'es-MX', appleAlt: ['es-ES', 'es-US'], web: 'es-MX' },
    tts: { cloud: 'Spanish', web: /^es/i },
    aiName: 'Spanish',
    tones: false,
    units: text => toks(text).map(t => t.w),
    pieces,
    score,
    best: (target, alts, ctx) => L.best(mod, target, alts, ctx),
    early: (target, heard, ctx) => L.early(mod, target, heard, ctx),
    // 一两个词：说完停 0.4 秒就算说完
    short: text => pieces(text).length <= 2,
    // 排句子的块：按空格切，去掉 ¿¡ 和后面的标点
    tiles: text => pieces(text).map(w => w.replace(/^[¿¡"'«(“‘]+/, '').replace(/[.,!?;:…"'»)”’]+$/, '')).filter(Boolean),
    joinTiles: t => (t || []).join(' '),
    // 提示：1 = 每个词留第一个字母（¿C___  t_  l_____?），2 = 字母全遮住（first：留下第一个词）
    cue(text, lv, entry, first) {
      const initial = w => { let seen = false; return w.replace(/\p{L}/gu, c => (seen ? '_' : (seen = true, c))); };
      return pieces(text).map((w, k) => (lv >= 2 ? (first && k === 0 ? w : w.replace(/\p{L}/gu, '_')) : initial(w))).join('  ');
    },
    // 几个词（聊天算句数、周报的「每句几个词」）
    countUnits: text => words(text).length,
    // 算不算「用西语说了一句」：没有中日韩文字、词数够（入门 1 个、初级 2 个、其余 3 个），不是一看就是英语
    isLine(text, level) {
      const s = String(text || '');
      if (CJK.test(s)) return false;
      const ws = words(s).map(w => fold(w.toLowerCase()));
      if (ws.length < minWords(level)) return false;
      const en = ws.filter(w => EN_ONLY.has(w)).length, es = ws.filter(w => ES_HINT.has(w)).length;
      return !(ws.length >= 2 && !es && en / ws.length >= 0.5);
    },
    minUnits: minWords,
    key: text => fold(String(text || '').normalize('NFC').toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 80),
    head: text => { const w = words(text)[0]; return w ? fold(w.toLowerCase()) : ''; },
    // 玩家名字：拉丁字母（可以带重音、ñ）和空格，1–12 个字，每个词首字母大写
    nameOk(s) {
      const v = String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ');
      if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{0,11}$/.test(v)) return null;
      return v.split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    },
    num: n => esNum(n),
    time: (h, m) => timeWays(+h || 0, +m || 0)[0],
    date: (mo, d) => (+d === 1 ? 'primero' : esNum(+d)) + ' de ' + (MONTHS[(+mo || 1) - 1] || ''),
    lexPairs: () => [],
    // 给测试和以后的调试用
    _: { toks, pk, fold, stress, inflect, variants, esNum },
  };
  if (L) L.reg('es', mod);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : globalThis);
