# 抠图：把 Gemini 画的白底宠物图去掉背景，裁到主体，存成 512px 透明 PNG
# 用法：python tools/cutout.py [id ...]   （默认处理 art/gemini/ 下全部）
# 输出：art/gemini/cut/{id}.png 和一张检查用的拼图 art/gemini/cut/_sheet.png
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = os.path.join(os.path.dirname(__file__), '..', 'art', 'gemini')
OUT = os.path.join(SRC, 'cut')
os.makedirs(OUT, exist_ok=True)

def cut(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    lo, hi = im.min(2), im.max(2)
    # 背景候选：很亮；或者较亮而且只是淡淡的光晕色（Gemini 爱加的发光底）
    cand = (lo > 232) | ((lo > 170) & (hi - lo < 90) & (hi > 225))
    lab, n = ndi.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # 主体里被包住的白色（眼睛高光、肚皮）不算背景；主体外的小碎渣算背景
    fg = ~bg
    fl, fn = ndi.label(fg)
    if fn > 1:
        sizes = ndi.sum(fg, fl, range(1, fn + 1))
        keep = np.zeros(fn + 1, bool); keep[1:] = sizes >= sizes.max() * 0.02
        fg = keep[fl]
    fg = ndi.binary_fill_holes(fg)
    # 软边：向外 1px、再轻微模糊
    a = ndi.gaussian_filter(ndi.binary_dilation(fg, iterations=1).astype(np.float32), 1.2)
    a = np.clip(a * 1.15, 0, 1)
    # 去白边：边缘像素里混进的白色按透明度扣掉
    m = (a > 0.02) & (a < 0.98)
    rgb = im.copy()
    rgb[m] = np.clip((im[m] - 255 * (1 - a[m, None])) / a[m, None], 0, 255)
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
    # 放进正方形画布、脚贴底边，缩到 512
    s = max(crop.size); pad = int(s * 0.04); S = s + pad * 2
    can = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    can.paste(crop, ((S - crop.width) // 2, S - pad - crop.height), crop)
    return can.resize((512, 512), Image.LANCZOS)

ids = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
tiles = []
for i in ids:
    c = cut(os.path.join(SRC, i + '.png'))
    c.save(os.path.join(OUT, i + '.png'), optimize=True)
    tiles.append(c); print('cut', i, os.path.getsize(os.path.join(OUT, i + '.png')) // 1024, 'KB')
# 检查拼图：深色棋盘底，白边一眼就能看出来
W = 256; cols = 5; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGBA', (W * cols, W * rows), (60, 70, 90, 255))
for k, t in enumerate(tiles):
    x, y = (k % cols) * W, (k // cols) * W
    bgc = (60, 70, 90, 255) if (k + k // cols) % 2 == 0 else (120, 150, 110, 255)
    sheet.paste(Image.new('RGBA', (W, W), bgc), (x, y))
    sheet.alpha_composite(t.resize((W, W), Image.LANCZOS), (x, y))
sheet.save(os.path.join(OUT, '_sheet.png'))
