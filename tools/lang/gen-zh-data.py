# 生成 lang-zh-data.js：常用汉字 → 不带声调的拼音（中文课的口语打分用，见 lang-zh.js）
# 用法（本机 Kokoro 的 Python 环境里有 jieba 和 pypinyin）：
#   D:/Claude/tools/kokoro/Scripts/python tools/lang/gen-zh-data.py [--n 7000]
# 做法：
#   1. 读 jieba 自带的词频表（dict.txt，约 35 万个词）。只留全是汉字的词。
#   2. 每个字的「常用程度」= 含这个字的所有词的词频之和；取最常用的 N 个字（默认 7000，盖住日常文字和识别结果里几乎所有的字）。
#   3. 每个字有哪些读音：把每个词交给 pypinyin（它带词组表，多音字按词定读音，例如 银行 → yin hang、觉得 → jue de），
#      数出每个字每种读音出现在多少个词里、这些词的词频加起来多少。
#      默认读音 = 词频加权最多的那个；另外的读音只在「常用」时才留下（词频占比 ≥ 5%，或者在 ≥ 15% 的词里、至少 3 个词）——
#      生僻的读音不留，免得别的字靠一个冷门读音冒充（打分时「听到的字有这个读音就算对」）。
#   4. 声调全部去掉（识别结果是文字，判断不了声调，打分也不比声调）；ü 写成 v（女 nv、绿 lv、略 lve），和 pypinyin 一样。
# 输出很紧凑：py = 按默认读音分组「音节 + 这一组的字」接成一串；alt = 「字 + 另外的读音（逗号分开）」接成一串。
import os, re, sys, io, collections
import jieba
from pypinyin import lazy_pinyin, pinyin, Style

N = 7000
args = sys.argv[1:]
if '--n' in args:
    N = int(args[args.index('--n') + 1])
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'lang-zh-data.js')
HAN = re.compile(r'^[\u4e00-\u9fff]+$')
SYL = re.compile(r'^[a-z]+$')

dict_path = os.path.join(os.path.dirname(jieba.__file__), 'dict.txt')
words = []
with io.open(dict_path, encoding='utf-8') as f:
    for line in f:
        p = line.split()
        if len(p) < 2:
            continue
        w, fq = p[0], int(p[1])
        if HAN.match(w):
            words.append((w, fq))
print('词：', len(words))

cf = collections.Counter()
for w, fq in words:
    for c in w:
        cf[c] += fq
chars = [c for c, _ in cf.most_common(N)]
keep = set(chars)
print('字：', len(chars))

wt = collections.defaultdict(collections.Counter)   # 字 → 读音 → 词频之和
cnt = collections.defaultdict(collections.Counter)  # 字 → 读音 → 几个词
for k, (w, fq) in enumerate(words):
    if not any(c in keep for c in w):
        continue
    py = lazy_pinyin(w, style=Style.NORMAL, errors='ignore')
    if len(py) != len(w):
        continue
    for c, s in zip(w, py):
        if c in keep and SYL.match(s):
            wt[c][s] += fq
            cnt[c][s] += 1
    if k % 50000 == 0:
        print('  …', k)

default, extra = {}, {}
for c in chars:
    if not wt[c]:
        s = lazy_pinyin(c, style=Style.NORMAL, errors='ignore')
        if s and SYL.match(s[0]):
            default[c] = s[0]
        continue
    tot_w = sum(wt[c].values())
    tot_n = sum(cnt[c].values())
    ranked = sorted(wt[c].items(), key=lambda kv: -kv[1])
    default[c] = ranked[0][0]
    ex = []
    for s, v in ranked[1:]:
        n = cnt[c][s]
        if v / tot_w >= 0.05 or (n >= 3 and n / tot_n >= 0.15):
            ex.append(s)
    if ex:
        extra[c] = ex

# 识别结果里常见、词表里少见的几个字补上（语气词、儿化的「儿」）
for c, s in (('儿', 'er'), ('嗯', 'en'), ('呃', 'e'), ('哦', 'o'), ('噢', 'o'), ('哟', 'yo'), ('呀', 'ya'), ('啦', 'la'), ('嘛', 'ma'), ('呢', 'ne'), ('吧', 'ba'), ('哈', 'ha'), ('〇', 'ling')):
    if c not in default:
        default[c] = s
        chars.append(c)
# 「嗯」pypinyin 默认给 n，识别结果里它是语气词 en
default['嗯'] = 'en'

groups = collections.OrderedDict()
for c in chars:
    s = default.get(c)
    if not s:
        continue
    groups.setdefault(s, []).append(c)
py = ''.join(s + ''.join(cs) for s, cs in sorted(groups.items()))
alt = ''.join(c + ','.join(extra[c]) for c in chars if c in extra)

# 按首字母分行（好看、好比对）
def chunks(s, pat):
    out, cur, first = [], '', None
    for m in re.finditer(pat, s):
        k = m.group(0)
        f = re.search(r'[a-z]', k).group(0) if pat.startswith('[a-z]') else k[0]
        if first is not None and f != first and len(cur) > 0:
            out.append(cur); cur = ''
        first = f
        cur += k
    if cur:
        out.append(cur)
    return out

py_lines = chunks(py, r'[a-z]+[^a-z]+')
alt_lines = []
cur = ''
for m in re.finditer(r'[^a-z,][a-z,]+', alt):
    cur += m.group(0)
    if len(cur) > 900:
        alt_lines.append(cur); cur = ''
if cur:
    alt_lines.append(cur)

n_alt = len(extra)
head = (
    '// 中文课的汉字 → 拼音表（不带声调）。生成的文件，不要手改：D:/Claude/tools/kokoro/Scripts/python tools/lang/gen-zh-data.py\n'
    '// 来源：jieba 词频表 + pypinyin（按词定多音字）。' + str(len(chars)) + ' 个常用字；其中 ' + str(n_alt) + ' 个字另有常用读音（alt）。\n'
    '// py：「音节 + 默认读这个音的字」接成一串；alt：「字 + 另外的常用读音（逗号分开）」接成一串。ü 写成 v。用法见 lang-zh.js。\n'
)
js = head + "(function (root) {\n  'use strict';\n  var D = {\n    v: 1,\n    n: " + str(len(chars)) + ",\n    py: [\n"
js += ',\n'.join("      '" + l + "'" for l in py_lines)
js += "\n    ].join(''),\n    alt: [\n"
js += ',\n'.join("      '" + l + "'" for l in alt_lines)
js += "\n    ].join(''),\n  };\n  if (typeof module !== 'undefined' && module.exports) module.exports = D;\n  else root.EchoZhPinyin = D;\n})(typeof window !== 'undefined' ? window : globalThis);\n"
with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
print('写好了：', OUT, len(js.encode('utf-8')), '字节；音节', len(groups), '；多音字', n_alt)
for c in '长行了还得重觉乐便地的着都和朝传为数调发种中会少好要看干几只给教空量藏差系':
    print(c, default.get(c), extra.get(c))
