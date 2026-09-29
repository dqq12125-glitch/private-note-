# 盯着下载文件夹：Gemini 每下载一张图，就按 D:/Claude/tools/gem_next.txt 第一行写的目标路径转存成 PNG，删掉原件，并删掉这一行（队列）
# 用法（后台常驻）：python tools/mon3d/gemwatch.py；日志写 D:/Claude/tools/gemwatch.log
import os, time
from PIL import Image
DL = r'C:/Users/Frank/Downloads'
NEXT = 'D:/Claude/tools/gem_next.txt'
LOG = 'D:/Claude/tools/gemwatch.log'
seen = set(os.listdir(DL))
def log(s):
    open(LOG, 'a', encoding='utf-8').write(time.strftime('%H:%M:%S ') + s + '\n')
log('start')
while True:
    time.sleep(1)
    try:
        now = set(os.listdir(DL))
    except OSError:
        continue
    for f in sorted(now - seen):
        if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            continue
        p = os.path.join(DL, f)
        try:
            s1 = os.path.getsize(p); time.sleep(1);
            if os.path.getsize(p) != s1: continue
            lines = [x.strip() for x in open(NEXT, encoding='utf-8').read().splitlines() if x.strip()]
            target = lines[0] if lines else ''
            if not target:
                log('no target for ' + f); seen.add(f); continue
            os.makedirs(os.path.dirname(target), exist_ok=True)
            im = Image.open(p); im.load()
            im.convert('RGB').save(target)
            os.remove(p)
            open(NEXT, 'w').write(''.join(x + '\n' for x in lines[1:]))
            log('saved %s -> %s %s' % (f, target, im.size))
            seen.add(f)
        except Exception as e:
            log('retry %s %s' % (f, e))
    seen |= {f for f in now if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))}
