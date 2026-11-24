# 平涂的正面原画 → 带立体明暗的图（给 Hunyuan3D 的「形状」那一步看；贴图那一步还是用原画）。
# 起因（2026-11-24 老板：「怪物的模型还是像纸片人一样」）：原画是正面、平涂、没有明暗的卡通画，形状模型看不出厚度，
# 生成出来就是一张薄片（雨滴滴试了 6 个种子，厚 / 长都不到 0.25）。这里按轮廓把它「吹鼓」：
#   轮廓里每个点离边多远 → 当成一个鼓起来的高度 → 算出法线 → 打一盏左上方的灯，边上压暗、鼓的地方提亮。
# 颜色还是原画的颜色，只是多了明暗，看着像一个鼓鼓的玩具。
# 用法：D:/Claude/tools/hy3d/Scripts/python tools/mon3d/puff.py [id ...] [--src=cut2] [--out=puff] [--k=1.0]
#   输入 art/gemini/<src>/<id>.png（透明底），输出 art/gemini/<out>/<id>.png；再 gen.py <id> --src=<out> --notex 生成形状
import os, sys
import numpy as np
from PIL import Image
import cv2

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
SRC = os.path.join(ROOT, 'art', 'gemini', opt.get('src', 'cut2'))
OUT = os.path.join(ROOT, 'art', 'gemini', opt.get('out', 'puff'))
K = float(opt.get('k', 1.0))   # 鼓的程度（越大明暗越重）
os.makedirs(OUT, exist_ok=True)
ids = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png') and not f.startswith('_'))


def puff(im):
    im = im.convert('RGBA')
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    mask = (al > 0.5).astype(np.uint8)
    # 最宽处的一半（像素）：鼓起来有多高按它算
    dmax = float(cv2.distanceTransform(mask, cv2.DIST_L2, 5).max()) or 1.0
    # 高度：在轮廓里解「吹气球」（泊松方程：边上是 0，里面处处往上鼓）。缩小了反复「糊一下 + 加一点 + 轮廓外清零」就是它的解，
    # 出来是一个光滑的鼓包（直接拿「离边多远」当高度会在中线上留下一道道棱）
    H, W = mask.shape
    sc = 192.0 / max(H, W)
    m = cv2.resize(mask.astype(np.float32), (max(8, int(W * sc)), max(8, int(H * sc))), interpolation=cv2.INTER_AREA)
    m = (m > 0.5).astype(np.float32)
    u = np.zeros_like(m)
    for _ in range(900):
        u = (cv2.blur(u, (3, 3)) + 1.0) * m
    u = u / (float(u.max()) or 1.0)
    h = np.sqrt(np.clip(u, 0, 1))              # 开方：边上更陡，像圆球的侧面
    h = cv2.resize(h, (W, H), interpolation=cv2.INTER_CUBIC)
    s = max(3, int(dmax * 0.06) | 1)
    h = cv2.GaussianBlur(h, (s, s), 0) * (al > 0.02)
    # 法线：高度的坡度（高度按最宽处的一半换成像素，才是真的圆）
    gy, gx = np.gradient(h * dmax * K)
    n = np.dstack([-gx, -gy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    # 左上前方的主灯 + 天光 + 边上的暗（法线越朝外越暗）+ 一点高光
    L = np.array([-0.45, -0.60, 0.66]); L /= np.linalg.norm(L)
    ndl = np.clip((n * L).sum(2), 0, 1)
    rim = np.clip(n[..., 2], 0, 1)
    shade = 0.42 + 0.62 * ndl
    shade *= 0.55 + 0.45 * rim ** 0.6
    spec = np.clip((n * np.array([-0.3, -0.45, 0.84])).sum(2), 0, 1) ** 28 * 0.22
    out = np.clip(rgb * shade[..., None] + spec[..., None], 0, 1)
    res = np.dstack([out, al])
    return Image.fromarray((res * 255 + 0.5).astype(np.uint8), 'RGBA')


for i in ids:
    p = os.path.join(SRC, i + '.png')
    if not os.path.exists(p): print('没有', p); continue
    puff(Image.open(p)).save(os.path.join(OUT, i + '.png'))
    print('puff', i, flush=True)
