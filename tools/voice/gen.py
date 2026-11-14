# 用本机开源语音模型 Kokoro（Apache 2.0，免费）把 tools/voice/lines.json 合成配音
# 输出 assets/voice/f/<key>.ogg（女声）、assets/voice/m/<key>.ogg（男声）和 assets/voice/index.json；已有的跳过，可以反复跑
# 格式：Opus 放在 Ogg 里（16 kbps 单声道，voip 模式，经 ffmpeg 压；比原来的 32 kbps MP3 小），需要 PATH 里有带 libopus 的 ffmpeg
# 用法：D:/Claude/tools/kokoro/Scripts/python tools/voice/gen.py [--f=af_heart] [--m=am_michael] [--limit=N] [--force] [--prune]
import os, sys, json, time, subprocess
os.environ.setdefault('HF_HOME', 'D:/Claude/tools/hf-home')
import numpy as np, torch
from kokoro import KPipeline

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'voice')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
VOICES = {'f': opt.get('f', 'af_heart'), 'm': opt.get('m', 'am_michael')}
LIMIT = int(opt.get('limit', 0))
FORCE = '--force' in sys.argv
SPEED = float(opt.get('speed', 0.92))   # 稍微慢一点，初一学生听得清
OPUS_KBPS = 16

def write_ogg(fn, wav):   # 24 kHz 单声道浮点 → Opus/Ogg（经 ffmpeg 管道）；先写临时文件再改名，中途断了不留半截文件
    tmp = fn + '.part'
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '%dk' % OPUS_KBPS,
                        '-vbr', 'on', '-compression_level', '10', '-application', 'voip', '-frame_duration', '20', '-ac', '1', '-f', 'ogg', tmp],
                       input=wav.astype('<f4').tobytes(), capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace'))
    os.replace(tmp, fn)

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
        fn = os.path.join(OUT, g, key(e['t']) + '.ogg')
        if os.path.exists(fn) and not FORCE: continue
        # 单个单词念得太快太短：句末补个句号让语调完整
        text = e['t'] if e['t'][-1:] in '.!?"' or ' ' in e['t'] else e['t'] + '.'
        parts = [a for _, _, a in pipe(text, voice=VOICES[g], speed=SPEED)]
        if not parts: print('empty', e['t']); continue
        wav = np.concatenate([p.cpu().numpy() if hasattr(p, 'cpu') else p for p in parts])
        wav = np.concatenate([wav, np.zeros(2400, dtype=wav.dtype)])   # 结尾留 0.1 秒
        write_ogg(fn, wav)
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
            if f.endswith(('.ogg', '.mp3')) and f[:-4] not in want[g]: os.remove(os.path.join(OUT, g, f)); gone += 1
    print('pruned', gone)
# 索引：每个声音有哪些文件（游戏启动时读，没有的句子就不去请求）
idx = {'v': VOICES, 'fmt': 'ogg-opus'}   # fmt：配音文件格式
for g in 'fm':
    idx[g] = sorted(f[:-4] for f in os.listdir(os.path.join(OUT, g)) if f.endswith('.ogg'))
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'))
print('done', n, 'new clips;', len(idx['f']), 'f /', len(idx['m']), 'm', '%.0fs' % (time.time() - t0))
