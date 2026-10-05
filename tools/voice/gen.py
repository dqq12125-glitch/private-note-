# 用本机开源语音模型 Kokoro（Apache 2.0，免费）把 tools/voice/lines.json 合成配音
# 输出 assets/voice/f/<key>.mp3（女声）、assets/voice/m/<key>.mp3（男声）和 assets/voice/index.json；已有的跳过，可以反复跑
# 用法：D:/Claude/tools/kokoro/Scripts/python tools/voice/gen.py [--f=af_heart] [--m=am_michael] [--limit=N] [--force] [--prune]
import os, sys, json, time
os.environ.setdefault('HF_HOME', 'D:/Claude/tools/hf-home')
import numpy as np, soundfile as sf, torch
from kokoro import KPipeline

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'voice')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
VOICES = {'f': opt.get('f', 'af_heart'), 'm': opt.get('m', 'am_michael')}
LIMIT = int(opt.get('limit', 0))
FORCE = '--force' in sys.argv
SPEED = float(opt.get('speed', 0.92))   # 稍微慢一点，初一学生听得清

def norm(t):
    return ' '.join(t.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"').split())
def key(t):   # 和 tools/voice/key.js、game.js 一样的 FNV-1a
    h = 0x811c9dc5
    for ch in norm(t):
        h ^= ord(ch); h = (h * 0x01000193) & 0xffffffff
    s, n = '', h
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

lines = json.load(open(os.path.join(os.path.dirname(__file__), 'lines.json'), encoding='utf-8'))
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', device=dev)
print('device', dev, 'voices', VOICES, 'lines', len(lines), flush=True)
for g in 'fm': os.makedirs(os.path.join(OUT, g), exist_ok=True)
done, t0, n = 0, time.time(), 0
for e in lines:
    for g in e['g']:
        fn = os.path.join(OUT, g, key(e['t']) + '.mp3')
        if os.path.exists(fn) and not FORCE: continue
        # 单个单词念得太快太短：句末补个句号让语调完整
        text = e['t'] if e['t'][-1:] in '.!?"' or ' ' in e['t'] else e['t'] + '.'
        parts = [a for _, _, a in pipe(text, voice=VOICES[g], speed=SPEED)]
        if not parts: print('empty', e['t']); continue
        wav = np.concatenate([p.cpu().numpy() if hasattr(p, 'cpu') else p for p in parts])
        wav = np.concatenate([wav, np.zeros(2400, dtype=wav.dtype)])   # 结尾留 0.1 秒
        sf.write(fn, wav, 24000, format='MP3', bitrate_mode='CONSTANT', compression_level=0.85)
        n += 1
        if n % 100 == 0: print(n, 'clips', '%.0fs' % (time.time() - t0), flush=True)
        if LIMIT and n >= LIMIT: break
    if LIMIT and n >= LIMIT: break
# --prune：删掉名单里已经没有的旧配音（改了台词、换了名字过滤之后）
if '--prune' in sys.argv:
    want = {g: {key(e['t']) for e in lines if g in e['g']} for g in 'fm'}
    gone = 0
    for g in 'fm':
        for f in os.listdir(os.path.join(OUT, g)):
            if f.endswith('.mp3') and f[:-4] not in want[g]: os.remove(os.path.join(OUT, g, f)); gone += 1
    print('pruned', gone)
# 索引：每个声音有哪些文件（游戏启动时读，没有的句子就不去请求）
idx = {'v': VOICES}
for g in 'fm':
    idx[g] = sorted(f[:-4] for f in os.listdir(os.path.join(OUT, g)) if f.endswith('.mp3'))
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
print('done', n, 'new clips;', len(idx['f']), 'f /', len(idx['m']), 'm', '%.0fs' % (time.time() - t0))
