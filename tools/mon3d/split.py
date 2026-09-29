# 把 Gemini 的家族图（白底、从左到右一排）切成一只一只：连通块 → 按 x 排序 → 对上家族里的编号 → 抠图存 512 透明 PNG
# 用法：python tools/mon3d/split.py [家族号 ...]（默认处理 art/gemini/fam/ 下全部，已切过的跳过，加 --force 重切）
# 输出 art/gemini/cut2/{id}.png；数目对不上的记进 art/gemini/cut2/_problems.txt，并出一张检查拼图 _sheet_<起>-<止>.png
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
FAM = os.path.join(ROOT, 'art', 'gemini', 'fam')
OUT = os.path.join(ROOT, 'art', 'gemini', 'cut2')
os.makedirs(OUT, exist_ok=True)
F = {f['fam']: f for f in json.load(open(os.path.join(ROOT, 'art', 'gemini', 'families.json'), encoding='utf-8'))}

def bgmask(im):
    lo, hi = im.min(2), im.max(2)
    cand = (lo > 232) | ((lo > 170) & (hi - lo < 90) & (hi > 225))
    lab, n = ndi.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    return np.isin(lab, edge[edge > 0])

def alpha_cut(im, fg):
    fg = ndi.binary_fill_holes(fg)
    a = ndi.gaussian_filter(ndi.binary_dilation(fg, iterations=1).astype(np.float32), 1.2)
    a = np.clip(a * 1.15, 0, 1)
    m = (a > 0.02) & (a < 0.98)
    rgb = im.copy()
    rgb[m] = np.clip((im[m] - 255 * (1 - a[m, None])) / a[m, None], 0, 255)
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.05)
    crop = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
    s = max(crop.size); pad = int(s * 0.04); S = s + pad * 2
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    can.paste(crop, ((S - crop.width) // 2, S - pad - crop.height), crop)
    return can.resize((512, 512), Image.LANCZOS)

def split(k, force=False):
    f = F[k]; ids = f['ids']; n = len(ids)
    if not force and all(os.path.exists(os.path.join(OUT, i + '.png')) for i in ids): return 'skip'
    p = os.path.join(FAM, '%03d.png' % k)
    if not os.path.exists(p): return 'missing'
    im = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    fg = ~bgmask(im)
    # 同一只身上断开的小零件（触角、火苗）先连起来再分块
    big = ndi.binary_dilation(fg, iterations=max(6, im.shape[1] // 180))
    lab, m = ndi.label(big)
    if m == 0: return 'empty'
    sizes = ndi.sum(fg, lab, range(1, m + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.06]
    comps = sorted(keep, key=lambda c: ndi.center_of_mass(lab == c)[1])
    if len(comps) != n:
        return 'COUNT %d != %d' % (len(comps), n)
    for id_, c in zip(ids, comps):
        part = fg & (lab == c)
        alpha_cut(im, part).save(os.path.join(OUT, id_ + '.png'), optimize=True)
    return 'ok %d' % n

if __name__ == '__main__':
    force = '--force' in sys.argv
    ks = [int(a) for a in sys.argv[1:] if not a.startswith('--')] or sorted(int(x[:3]) for x in os.listdir(FAM) if x[:3].isdigit())
    bad = []
    for k in ks:
        r = split(k, force)
        if r not in ('skip',): print(k, F[k]['ids'], r, flush=True)
        if r.startswith('COUNT') or r in ('empty',): bad.append('%d %s %s' % (k, F[k]['ids'], r))
    if bad: open(os.path.join(OUT, '_problems.txt'), 'a').write('\n'.join(bad) + '\n')
    # 检查拼图
    done = [i for k in ks for i in F[k]['ids'] if os.path.exists(os.path.join(OUT, i + '.png'))]
    if done:
        W = 160; cols = 10; rows = (len(done) + cols - 1) // cols
        sheet = Image.new('RGBA', (W * cols, W * rows), (70, 80, 100, 255))
        for j, i in enumerate(done):
            sheet.alpha_composite(Image.open(os.path.join(OUT, i + '.png')).resize((W, W)), ((j % cols) * W, (j // cols) * W))
        sheet.save(os.path.join(OUT, '_sheet_%d-%d.png' % (ks[0], ks[-1])))
