# 用本机开源语音模型 Kokoro（Apache 2.0，免费）把 tools/voice/lines.json 合成配音
# 输出 assets/voice/f/<key>.ogg（女声）、assets/voice/m/<key>.ogg（男声）和 assets/voice/index.json；已有的跳过，可以反复跑
# 格式：Opus 放在 Ogg 里（16 kbps 单声道，voip 模式，经 ffmpeg 压；比原来的 32 kbps MP3 小），需要 PATH 里有带 libopus 的 ffmpeg
# 用法：D:/Claude/tools/kokoro/Scripts/python tools/voice/gen.py [--f=af_heart] [--m=am_michael] [--limit=N] [--force] [--prune]
#
# 别的语言（课程包，tools/pack/SPEC.md、tools/course/SPEC.md §7）：
#   python tools/voice/gen.py --lang es --lines dist/course/es/course.json --out dist/voice/es
#   --lang    en（默认）/ es / zh / ja。Kokoro 的语言代码：en 'a'、es 'e'、zh 'z'、ja 'j'；每门语言默认一个女声一个男声（--f / --m 可换）
#   --lines   句子表：tools/voice/lines.json 那样的 [{ t, g, p }]，或者 course.json（取里面的 VOICE）。别的语言一定要有（默认 dist/course/<语言>/course.json）
#   --out     输出目录（f/、m/、index.json）。英语默认 assets/voice，别的语言默认 dist/voice/<语言>；别的语言（或给了 --lines）时把句子表也存成 <out>/lines.json（打包排先后用）
#   --g2p     日语的读法：ojt（默认，pyopenjtalk，见 _OjtG2P）/ ojtu / cutlet（misaki 默认，日期钟点会读错）
#   --notrim  中文、日语默认剪掉首尾的长静音（见 trim），这个关掉
#   --readings 日语：读音表 { 原文: 读音 }（node tools/course/build.js ja 会在 course.json 旁边写 readings.json，默认读它）；有读音表就让 TTS 念课程写的读音
#             （见 fix_ja），并只重做 TTS 文字变了的配音（dist/voice/ja/inputs.json 记着每段当时的文字，fixes.json 是改了哪些）；--noreadfix 关掉
#   --dry     只数一数还有多少段没合成，不合成、不写任何文件
# 什么选项都不加 = 和以前一模一样（英语、af_heart / am_michael、assets/voice、tools/voice/lines.json）。
# 文件名 key = 原文的哈希（tools/voice/key.js：去掉表情符号、引号规范化、空白合并，按 UTF-16 码元算 FNV-1a）；配音念的是原文，不是读音。
import os, sys, json, time, subprocess, re

try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # Windows 控制台是 GBK，打印中日文不要崩
except Exception: pass
# 命令行：--k=v 和 --k v 都认
def _argv():
    VAL = {'--f', '--m', '--limit', '--speed', '--lang', '--lines', '--out', '--g2p', '--readings'}
    a, out, i = sys.argv[1:], [], 0
    while i < len(a):
        if a[i] in VAL and i + 1 < len(a) and not a[i + 1].startswith('--'): out.append(a[i] + '=' + a[i + 1]); i += 2
        else: out.append(a[i]); i += 1
    return out
ARGV = _argv()
opt = dict(a[2:].split('=', 1) for a in ARGV if a.startswith('--') and '=' in a)
LANG = opt.get('lang', 'en')
# 语言：(Kokoro 语言代码, 默认女声, 默认男声)
LANGS = {'en': ('a', 'af_heart', 'am_michael'), 'es': ('e', 'ef_dora', 'em_alex'), 'zh': ('z', 'zf_xiaoxiao', 'zm_yunxi'), 'ja': ('j', 'jf_alpha', 'jm_kumo')}
if LANG not in LANGS: sys.exit('--lang 要写 ' + ' / '.join(LANGS))
DRY = '--dry' in ARGV

if not DRY:   # 只数数的时候不加载模型
    os.environ.setdefault('HF_HOME', 'D:/Claude/tools/hf-home')
    import numpy as np, torch
    from kokoro import KPipeline

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HERE = os.path.dirname(__file__)
if 'out' in opt: OUT = os.path.abspath(opt['out'])
else: OUT = os.path.join(ROOT, 'assets', 'voice') if LANG == 'en' else os.path.join(ROOT, 'dist', 'voice', LANG)
if 'lines' in opt: LINES = os.path.abspath(opt['lines'])
elif LANG == 'en': LINES = os.path.join(HERE, 'lines.json')
else: LINES = os.path.join(ROOT, 'dist', 'course', LANG, 'course.json')
VOICES = {'f': opt.get('f', LANGS[LANG][1]), 'm': opt.get('m', LANGS[LANG][2])}
LIMIT = int(opt.get('limit', 0))
FORCE = '--force' in ARGV
SPEED = float(opt.get('speed', 0.92))   # 稍微慢一点，初一学生听得清
OPUS_KBPS = 16

# 中文、日语的 Kokoro 在句子前后各留很长的静音（实测中文开头约 0.4 秒、结尾 0.9–1.3 秒，男声更长）：放一个词要多等一秒多。
# 这两门语言把首尾静音剪到开头 0.1 秒、结尾 0.15 秒（下面再补 0.1 秒）；中间的停顿不动。英语、西语不剪（和以前、已有的文件一样）。--notrim 关掉
TRIM = LANG in ('zh', 'ja') and '--notrim' not in ARGV
def trim(wav, sr=24000):
    env = np.abs(wav)
    k = sr // 100   # 10 毫秒一格，取每格最大值
    n = len(env) // k
    if n < 2: return wav
    w = env[:n * k].reshape(n, k).max(axis=1)
    loud = np.where(w > max(0.002, 0.004 * w.max()))[0]
    if not len(loud): return wav
    a = max(0, loud[0] * k - int(0.10 * sr)); b = min(len(wav), (loud[-1] + 1) * k + int(0.15 * sr))
    return wav[a:b]

def write_ogg(fn, wav):   # 24 kHz 单声道浮点 → Opus/Ogg（经 ffmpeg 管道）；先写临时文件再改名，中途断了不留半截文件
    tmp = fn + '.part'
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '%dk' % OPUS_KBPS,
                        '-vbr', 'on', '-compression_level', '10', '-application', 'voip', '-frame_duration', '20', '-ac', '1', '-f', 'ogg', tmp],
                       input=wav.astype('<f4').tobytes(), capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace'))
    os.replace(tmp, fn)

# 表情符号不念：和 key.js 的 /[\p{Extended_Pictographic}\u200D\uFE0F]/gu 一样的范围（Python 的 re 没有 \p）
_EMOJI = re.compile('[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u2388\u23cf\u23e9-\u23f3\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe'
                    '\u2600-\u2605\u2607-\u2612\u2614-\u2685\u2690-\u2705\u2708-\u2712\u2714\u2716\u271d\u2721\u2728\u2733\u2734\u2744\u2747\u274c\u274e\u2753-\u2755\u2757\u2763-\u2767'
                    '\u2795-\u2797\u27a1\u27b0\u27bf\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299\U0001f000-\U0001faff\u200d\ufe0f]')
def norm(t):
    t = _EMOJI.sub('', t)
    return ' '.join(t.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"').split())
def key(t):   # 和 tools/voice/key.js、game.js 一样的 FNV-1a（JS 按 UTF-16 码元算，所以先转成码元再算）
    h = 0x811c9dc5
    b = norm(t).encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 0x01000193) & 0xffffffff
    s, n = '', h
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

def prep(t):   # 交给 Kokoro 的文字
    if LANG == 'en':
        # 单个单词念得太快太短：句末补个句号让语调完整
        return t if t[-1:] in '.!?"' or ' ' in t else t + '.'
    t = norm(t)
    end = '。' if LANG in ('zh', 'ja') else '.'
    return t if t[-1:] in '.!?。！？…"”」』' else t + end

# ---------- 日语：让 TTS 念课程里写的读音（--readings，默认 <句子表目录>/readings.json，tools/course/build.js 一起生成） ----------
# pyopenjtalk 单看汉字猜读音，会猜错：何 + 量词 / 疑问（何時 なにじ、何日 なににち、何色 なにしょく）、十さい（じゅうさい，课程写じゅっさい）……
# 课程给每句话一个读音 r（助词 は へ を 照写）。做法（通用，不是手写名单）：
#   1. 把这句话交给 pyopenjtalk 的前端，得到每个词的读音（pron）；把它和课程的读音都「归一」成同一种写法（片假名 → 平假名、长音 ー / おう / えい 写成元音、
#      助词 は へ を → わ え お、づ ぢ → ず じ，标点和重音符号去掉；都是一个字对一个字，所以位置能对回去）；
#   2. 用 difflib 对齐两串；只处理「这几个字换成了别的几个字」（replace）。只多了或只少了字的（课程漏写助词之类）不动——那是读音表的毛病，不是读法的毛病，补上或删掉会改意思；
#   3. 把读音不一样的那几个词（整词）换成课程的读音（平假名）交给 TTS，别的词原样；换完再过一遍前端，必须比换以前更接近课程的读音才收，不然这句不动。
# 课程的读音当作对的；课程写错了，这里就跟着念错（reading-qa 里查）。
_VOW = {}
for _v, _ks in {'あ': 'あかがさざただなはばぱまやらわゃぁ', 'い': 'いきぎしじちぢにひびぴみりぃ', 'う': 'うくぐすずつづぬふぶぷむゆるゅぅゔ', 'え': 'えけげせぜてでねへべぺめれぇ', 'お': 'おこごそぞとどのほぼぽもよろをょぉ'}.items():
    for _k in _ks: _VOW[_k] = _v
_DROP = set(' 　\t\n、。！？!?,.…「」『』（）()・:：;；"“”‘’\'’〜~-—－ー_')
_DROP.discard('ー')
_DROP |= set('’')
def _k2h(ch):
    if 'ァ' <= ch <= 'ヶ': return chr(ord(ch) - 0x60)
    return ch
def _nrm(s):
    """→ (归一后的字符串, 每个字符在原串里的位置)。一个字对一个字。"""
    kept = [(i, _k2h(ch)) for i, ch in enumerate(s) if ch not in _DROP]
    out = []
    for i, ch in kept:
        if ch == 'ー':
            ch = _VOW.get(out[-1], 'ー') if out else 'ー'
        elif out and ch == 'う' and _VOW.get(out[-1]) == 'お': ch = 'お'
        elif out and ch == 'い' and _VOW.get(out[-1]) == 'え': ch = 'え'
        ch = {'は': 'わ', 'へ': 'え', 'を': 'お', 'づ': 'ず', 'ぢ': 'じ', 'ゔ': 'ぶ'}.get(ch, ch)
        out.append(ch)
    return ''.join(out), [i for i, _ in kept]

_OJT = None
def _frontend(text):
    global _OJT
    if _OJT is None:
        import pyopenjtalk as _OJT_M
        _OJT = _OJT_M
    return _OJT.run_frontend(text)

def fix_ja(text, r):
    """text：要念的原文；r：课程里这句的读音（一整串）。返回交给 TTS 的文字（没有要改的就是原文）。"""
    import difflib
    if not r or not text: return text
    fe = _frontend(text)
    if ''.join(w['string'] for w in fe) != ''.join(text.split()): return text   # 前端把字拆得和原文对不上：不动
    raw, spans = '', []
    for w in fe:
        p = w['pron']
        spans.append((len(raw), len(raw) + len(p))); raw += p
    NA, ia = _nrm(raw)
    NB, ib = _nrm(r)
    if not NA or not NB or NA == NB: return text
    sm = difflib.SequenceMatcher(None, NA, NB, autojunk=False)
    if sm.ratio() < 0.6: return text
    # 每个词在 NA 里占 [n0, n1)
    import bisect
    tk = [(bisect.bisect_left(ia, s0), bisect.bisect_left(ia, s1)) for s0, s1 in spans]
    bkeep = [_k2h(r[i]) for i in ib]
    groups = []   # [词下标起, 词下标止（含）, B 起, B 止]
    for tag, a1, a2, b1, b2 in sm.get_opcodes():
        if tag != 'replace': continue
        hit = [k for k, (n0, n1) in enumerate(tk) if n1 > n0 and n0 < a2 and n1 > a1]
        if not hit: continue
        k0, k1 = hit[0], hit[-1]
        ta1, ta2 = tk[k0][0], tk[k1][1]
        gb1, gb2 = b1 - (a1 - ta1), b2 + (ta2 - a2)
        if groups and k0 <= groups[-1][1]:   # 和上一处共用一个词：并成一处
            g = groups[-1]
            if k1 >= g[1]: g[1] = k1; g[3] = gb2
        else: groups.append([k0, k1, gb1, gb2])
    if not groups: return text
    outp, k = [], 0
    for k0, k1, gb1, gb2 in groups:
        while k < k0: outp.append(fe[k]['string']); k += 1
        rep = ''.join(bkeep[max(0, gb1):max(0, gb2)])
        na = tk[k1][1] - tk[k0][0]
        if not rep or len(rep) > 3 * na + 2 or na > 3 * len(rep) + 2:   # 对不上的（读音表缺一大段之类）：这一处不动
            while k <= k1: outp.append(fe[k]['string']); k += 1
        else:
            outp.append(rep); k = k1 + 1
    while k < len(fe): outp.append(fe[k]['string']); k += 1
    new = ''.join(outp)
    if new == text: return text
    # 换完要更接近课程的读音，否则不收
    fe2 = _frontend(new)
    NA2, _ = _nrm(''.join(w['pron'] for w in fe2))
    if difflib.SequenceMatcher(None, NA2, NB, autojunk=False).ratio() <= sm.ratio(): return text
    return new

READ = {}
if LANG == 'ja' and '--noreadfix' not in ARGV:
    _rf = os.path.abspath(opt['readings']) if 'readings' in opt else os.path.join(os.path.dirname(LINES), 'readings.json')
    if os.path.exists(_rf): READ = json.load(open(_rf, encoding='utf-8'))
def tts_text(t):
    """这一句交给 Kokoro 的文字（日语有读音表时纠正读法；别的语言就是 prep）。"""
    if READ:
        n = norm(t)
        return prep(fix_ja(n, READ.get(n)) if READ.get(n) else t)
    return prep(t)
INPUTS_FN = os.path.join(OUT, 'inputs.json')   # 每段配音当时交给 TTS 的文字（只有日语读音纠正开着时才记）：读音表改了，只重做文字变了的
INPUTS = json.load(open(INPUTS_FN, encoding='utf-8')) if READ and os.path.exists(INPUTS_FN) else {}

def load_lines(fn):
    d = json.load(open(fn, encoding='utf-8'))
    if isinstance(d, dict): d = d.get('VOICE')
    if not isinstance(d, list): sys.exit('句子表要是 [{ t, g }] 或者带 VOICE 的 course.json：' + fn)
    return d

if not os.path.exists(LINES): sys.exit('找不到句子表 ' + LINES + '（--lines）；别的语言先 node tools/course/build.js <语言>')
lines = load_lines(LINES)
def _todo(e, g, inp):   # 这一段要不要（重新）合成
    fn = os.path.join(OUT, g, key(e['t']) + '.ogg')
    if not os.path.exists(fn): return True
    return bool(READ) and INPUTS.get(g + '/' + key(e['t']), prep(e['t'])) != inp
if DRY:
    todo = chg = 0
    for e in lines:
        inp = tts_text(e['t']) if READ else None
        if READ and inp != prep(e['t']): chg += 1
        for g in e['g']:
            if _todo(e, g, inp): todo += 1
    print('dry', LANG, 'lines', len(lines), 'clips', sum(len(e['g']) for e in lines), 'todo', todo, 'out', OUT + ('；读音纠正开着：' + str(chg) + ' 句的 TTS 文字和原文不一样' if READ else ''))
    sys.exit(0)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
try:
    pipe = KPipeline(lang_code=LANGS[LANG][0], repo_id='hexgrad/Kokoro-82M', device=dev)
except ModuleNotFoundError as ex:   # 日语要 pyopenjtalk 等：不装，说清楚缺什么
    sys.exit('missing component for lang ' + LANG + ' (not synthesized): ' + str(ex) + ' | 这门语言缺组件，没法合成')
# 日语：misaki 默认的 cutlet 读法会把日期、钟点、数字读错（四月 → よんがつ、七時 → ななじ、九月 → きゅうがつ）；
# pyopenjtalk 的读法是对的（しがつ、しちじ、くがつ），但它返回的是「音素 + 同样长的音高串」（_ - ^ j），Kokoro 会把音高串当音素念，
# 每句末尾多出一串「い / イ」（实测女声 35% 的词被识别器听出多余的 い）。所以只取前半（音素），丢掉音高串。
# 它还用了 Kokoro 词表里没有的符号（ASCII 的 g、拼出来的 ᶄ ᶀ ᶃ ᶉ ᶈ），模型会直接丢掉——が行全部念成没有辅音（ごはん → おはん）。换成词表里有的写法
# （g → ɡ U+0261，ᶄ → kʲ …，和 cutlet 的一样）。--g2p=cutlet 退回默认；--g2p=ojtu 另外把 u 换成 cutlet 用的 ɯ
_OJT_FIX = {'g': 'ɡ', 'ᶄ': 'kʲ', 'ᶀ': 'bʲ', 'ᶃ': 'ɡʲ', 'ᶉ': 'ɾʲ', 'ᶈ': 'pʲ'}
class _OjtG2P:
    def __init__(self, u=False):
        from misaki import ja as _ja
        self.g = _ja.JAG2P(version='pyopenjtalk'); self.u = u
    def __call__(self, text):
        s, toks = self.g(text)
        s = ''.join(_OJT_FIX.get(c, c) for c in s[:len(s) // 2])
        if self.u: s = s.replace('u', 'ɯ')
        return s, toks
if LANG == 'ja' and opt.get('g2p', 'ojt') in ('ojt', 'ojtu'):
    pipe.g2p = _OjtG2P(opt.get('g2p') == 'ojtu')
print('device', dev, 'lang', LANG, 'voices', VOICES, 'lines', len(lines), flush=True)
for g in 'fm': os.makedirs(os.path.join(OUT, g), exist_ok=True)
if LANG != 'en' or 'lines' in opt:   # 句子表也存一份在配音旁边：tools/pack/build.js 按 p 排先后
    json.dump([{'t': e['t'], 'g': e['g'], 'p': e['p']} if 'p' in e else {'t': e['t'], 'g': e['g']} for e in lines], open(os.path.join(OUT, 'lines.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
done, t0, n = 0, time.time(), 0
FIXES = {}
def _save_inputs():
    if not READ: return
    json.dump(INPUTS, open(INPUTS_FN, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(FIXES, open(os.path.join(OUT, 'fixes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for e in lines:
    inp = tts_text(e['t']) if READ else None
    if READ and inp != prep(e['t']): FIXES[key(e['t'])] = [norm(e['t']), inp]
    for g in e['g']:
        fn = os.path.join(OUT, g, key(e['t']) + '.ogg')
        if not FORCE and not _todo(e, g, inp): continue
        text = inp if READ else prep(e['t'])
        parts = [a for _, _, a in pipe(text, voice=VOICES[g], speed=SPEED)]
        if not parts: print('empty', e['t']); continue
        wav = np.concatenate([p.cpu().numpy() if hasattr(p, 'cpu') else p for p in parts])
        if TRIM: wav = trim(wav)
        wav = np.concatenate([wav, np.zeros(2400, dtype=wav.dtype)])   # 结尾留 0.1 秒
        write_ogg(fn, wav)
        if READ: INPUTS[g + '/' + key(e['t'])] = inp
        n += 1
        if n % 100 == 0: print(n, 'clips', '%.0fs' % (time.time() - t0), flush=True); _save_inputs()
        if LIMIT and n >= LIMIT: break
    if LIMIT and n >= LIMIT: break
_save_inputs()
# --prune：删掉名单里已经没有的旧配音（改了台词、换了名字过滤之后）
if '--prune' in ARGV:
    want = {g: {key(e['t']) for e in lines if g in e['g']} for g in 'fm'}
    gone = 0
    for g in 'fm':
        for f in os.listdir(os.path.join(OUT, g)):
            if f.endswith(('.ogg', '.mp3')) and f[:-4] not in want[g]: os.remove(os.path.join(OUT, g, f)); gone += 1
    print('pruned', gone)
# 索引：每个声音有哪些文件（游戏启动时读，没有的句子就不去请求）
idx = {'v': VOICES, 'fmt': 'ogg-opus'}   # fmt：配音文件格式
if LANG != 'en': idx['lang'] = LANG
for g in 'fm':
    idx[g] = sorted(f[:-4] for f in os.listdir(os.path.join(OUT, g)) if f.endswith('.ogg'))
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
print('done', n, 'new clips;', len(idx['f']), 'f /', len(idx['m']), 'm', '%.0fs' % (time.time() - t0))
