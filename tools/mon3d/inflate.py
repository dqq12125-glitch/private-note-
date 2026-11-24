# 不用生成模型，直接从原画的轮廓「吹」出一个立体的壳（2026-11-24，老板：「你不能自己做吗？为什么一定要那个模型呢？」）。
# 给补了明暗也还是生成成薄片的那几只用（带大鳍、大翅膀的，比如水花花）：
#   · 形状：在轮廓里解一遍「吹气球」（泊松方程，和 puff.py 同一个办法）——身体宽的地方厚，鳍、尾巴这种窄的地方薄；前后各一面，在轮廓边上合拢
#   · 正面的贴图就是原画；背面没有脸：把轮廓里面靠外一圈（身体的颜色、黑边）往里抹开，脸和肚皮就没了
# 出来的是一个「鼓鼓的布偶」：正面和原画一模一样，侧过来有厚度，从背后看是身体的颜色。手脚叠在身体前面的，还是画在正面上，不单独鼓出来。
# 用法：D:/Claude/tools/hy3d/Scripts/python tools/mon3d/inflate.py <id> [id ...] [--tag=i1] [--src=cut2] [--depth=0.9] [--n=224]
#   输入 art/gemini/<src>/<id>.png（没有就找 cut），输出 art/hy3d/<id>_raw_<标签>.glb（和 Hunyuan3D 出来的一样的朝向：脸朝 +Z，头朝 +Y）
#   --depth：最厚的地方有多厚（1 = 最宽处的一半那么厚，也就是圆球；默认 0.62，像一个鼓鼓的靠垫）；--pow：窄的地方（鳍、尾巴）薄多少；--n：网格有多细
import os, sys
import numpy as np
from PIL import Image
import cv2
import trimesh

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
TAG = '_' + opt['tag'] if 'tag' in opt else '_i1'
SRCS = [os.path.join(ROOT, 'art', 'gemini', opt.get('src', 'cut2')), os.path.join(ROOT, 'art', 'gemini', 'cut')]
OUT = os.path.join(ROOT, 'art', 'hy3d')
DEPTH, N = float(opt.get('depth', 0.62)), int(opt.get('n', 224))
POW = float(opt.get('pow', 0.62))   # 窄的地方薄多少：0.5 = 截面是圆的（鳍也鼓成香肠），越大窄的地方越薄
ids = [a for a in sys.argv[1:] if not a.startswith('--')]


def square(im, size):
    # 和 gen.py 一样：主体居中、四周留白的方图
    im = im.convert('RGBA'); im = im.crop(im.getbbox())
    s = int(max(im.size) * 1.15); c = Image.new('RGBA', (s, s), (255, 255, 255, 0))
    c.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
    return c.resize((size, size), Image.LANCZOS)


def balloon(m):
    # 泊松方程（边上 0，里面处处往上鼓）：反复「糊一下 + 加一点 + 轮廓外清零」
    u = np.zeros_like(m)
    for _ in range(1400):
        u = (cv2.blur(u, (3, 3)) + 1.0) * m
    return u


def build(i):
    p = next((os.path.join(d, i + '.png') for d in SRCS if os.path.exists(os.path.join(d, i + '.png'))), None)
    if not p: print('没有原画', i); return
    T = 1024
    art = np.asarray(square(Image.open(p), T), dtype=np.float32) / 255.0
    rgb, al = art[..., :3], art[..., 3]
    # 轮廓（网格的分辨率）：小碎块（不到 0.4% 的）不要
    m = (cv2.resize(al, (N, N), interpolation=cv2.INTER_AREA) > 0.5).astype(np.uint8)
    # 只有一两格宽的细丝先去掉（开运算）：那种地方前后两面会完全贴在一起，成了没有厚度的重叠面，Blender 算不了蒙皮权重
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    nlab, lab, st, _ = cv2.connectedComponentsWithStats(m, 4)
    for k in range(1, nlab):
        if st[k, cv2.CC_STAT_AREA] < N * N * 0.004: m[lab == k] = 0
    mf = m.astype(np.float32)
    R = float(cv2.distanceTransform(m, cv2.DIST_L2, 5).max()) or 1.0   # 最宽处的一半（格）
    u = balloon(mf); u = u / (float(u.max()) or 1.0)
    h = np.power(np.clip(u, 0, 1), POW) * R * DEPTH                     # 每个格点鼓多高（格）
    h = cv2.GaussianBlur(h, (5, 5), 0) * mf
    # 边上的格点（旁边有轮廓外的）也留一点厚度（半格）：前后两面在轮廓边上不合成一条线，而是用一圈窄窄的侧壁接起来——
    # 这样出来的是一个真正封闭的壳。（第一版让边上的高度是 0、靠合并顶点合拢：细的地方前后两面叠成没有厚度的重叠面，Blender 算不了蒙皮权重）
    edge = (cv2.erode(m, np.ones((3, 3), np.uint8)) == 0) & (m == 1)
    h = np.maximum(h, 0.5) * mf
    h[edge] = 0.5
    idx = -np.ones((N, N), dtype=np.int64)
    # 面：四个角都在轮廓里的格子
    inm = m.astype(bool)
    cell = inm[:-1, :-1] & inm[:-1, 1:] & inm[1:, :-1] & inm[1:, 1:]
    usedv = np.zeros((N, N), dtype=bool)
    usedv[:-1, :-1] |= cell; usedv[:-1, 1:] |= cell; usedv[1:, :-1] |= cell; usedv[1:, 1:] |= cell
    ys, xs = np.nonzero(usedv)
    n = len(ys)
    idx[ys, xs] = np.arange(n)
    # 顶点：正面一份、背面一份。x 右、y 上、z 朝着看的人；归一化到高约 1
    sc = 1.0 / N
    P = np.stack([(xs - N / 2) * sc, (N / 2 - ys) * sc], 1)
    Z = h[ys, xs] * sc
    U = (xs + 0.5) / N; W = 1 - (ys + 0.5) / N
    a, b, c, d = idx[:-1, :-1][cell], idx[:-1, 1:][cell], idx[1:, :-1][cell], idx[1:, 1:][cell]
    front = np.concatenate([np.stack([a, c, b], 1), np.stack([b, c, d], 1)])
    # 轮廓边磨圆一点（格子的锯齿）：只动 x、y，前后两面同一个格点一起动
    e = edge[ys, xs]
    nb = [[] for _ in range(n)]
    for tri in front:
        for k in range(3): nb[tri[k]].append(tri[(k + 1) % 3]); nb[tri[k]].append(tri[(k + 2) % 3])
    for _ in range(6):
        Q = P.copy()
        for v in np.nonzero(e)[0]:
            q = [w for w in nb[v] if e[w]]
            if len(q) >= 2: Q[v] = 0.5 * P[v] + 0.5 * np.mean(P[q], 0)
        P = Q
    # 侧壁：格子的哪条边外面没有格子，就在那条边上立一块（正面的边 → 背面的边），法线朝外。
    # 侧壁的顶点另算一份（位置和正面 / 背面的边上顶点一样，贴图坐标都用正面那张的轮廓边——就是原画的黑边）
    cp = np.pad(cell, 1)
    ci, cj = np.nonzero(cell)
    side = []
    def wall(sel, p, q, flip):
        # p → q 是这条边的两个角（顶点编号）；sel：哪些格子的这条边露在外面
        pf, qf = p[sel], q[sel]
        if not len(pf): return
        pb, qb = pf + n, qf + n          # 背面的（在 S 这张表里先用同样的编号规则，下面统一挪）
        t1 = np.stack([pf, qf, qb], 1); t2 = np.stack([pf, qb, pb], 1)
        if flip: t1 = t1[:, ::-1]; t2 = t2[:, ::-1]
        side.append(t1); side.append(t2)
    A, B, C, D = idx[:-1, :-1][cell], idx[:-1, 1:][cell], idx[1:, :-1][cell], idx[1:, 1:][cell]
    wall(~cp[ci, cj + 1], A, B, False)        # 上边（上面没有格子）：法线朝上
    wall(~cp[ci + 2, cj + 1], C, D, True)     # 下边：朝下
    wall(~cp[ci + 1, cj], A, C, True)         # 左边：朝左
    wall(~cp[ci + 1, cj + 2], B, D, False)    # 右边：朝右
    S = np.concatenate(side) if side else np.zeros((0, 3), dtype=np.int64)
    # 顶点表：[正面 n][背面 n][侧壁的正面那一圈 n][侧壁的背面那一圈 n]（侧壁用不到的不会被引用，导出前去掉）
    V = np.concatenate([np.column_stack([P, Z]), np.column_stack([P, -Z]), np.column_stack([P, Z]), np.column_stack([P, -Z])])
    uvF = np.stack([U * 0.5, W], 1); uvB = np.stack([0.5 + U * 0.5, W], 1)
    UV = np.concatenate([uvF, uvB, uvF, uvF])
    back = front[:, ::-1] + n
    F = np.concatenate([front, back, S + 2 * n])
    keep = np.zeros(len(V), dtype=bool); keep[F.ravel()] = True
    rm = -np.ones(len(V), dtype=np.int64); rm[keep] = np.arange(int(keep.sum()))
    V, UV, F = V[keep], UV[keep], rm[F]
    # 正面贴图：原画，轮廓外面用边上的颜色往外补（不然贴图缩小时边上会渗进透明的黑）
    hole = (al < 0.5).astype(np.uint8)
    rgb8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    front_tex = cv2.inpaint(rgb8, cv2.dilate(hole, np.ones((3, 3), np.uint8)) & (cv2.erode(hole, np.ones((41, 41), np.uint8)) == 0).astype(np.uint8), 6, cv2.INPAINT_TELEA)
    # 背面贴图：轮廓里面离边 band 以内的照原画（黑边 + 身体靠外的颜色），更里面的（脸、肚皮、花纹）从这一圈往里抹
    inside = (al >= 0.5).astype(np.uint8)
    dist = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
    Rt = float(dist.max()) or 1.0
    band = max(10.0, Rt * 0.16)
    small = 256
    s_rgb = cv2.resize(front_tex, (small, small), interpolation=cv2.INTER_AREA)
    s_core = (cv2.resize((dist > band).astype(np.uint8), (small, small), interpolation=cv2.INTER_NEAREST) > 0).astype(np.uint8)
    s_back = cv2.inpaint(s_rgb, s_core, 8, cv2.INPAINT_TELEA)
    s_back = cv2.GaussianBlur(s_back, (9, 9), 0)
    back_fill = cv2.resize(s_back, (T, T), interpolation=cv2.INTER_CUBIC)
    wgt = np.clip((dist - band * 0.6) / (band * 0.4), 0, 1)[..., None]   # 从照原画到抹开的，过渡一小段
    back_tex = (front_tex * (1 - wgt) + back_fill * wgt).astype(np.uint8)
    # 陡的地方（靠近轮廓边，几乎侧对着看的人）：正面贴图也换成抹开的身体颜色。不然原画轮廓上那一圈黑边会在侧面被拉成一道道黑条
    # （游戏里另有一圈描边，黑边不靠贴图）
    gy, gx = np.gradient(cv2.resize(h, (T, T), interpolation=cv2.INTER_CUBIC) * (T / N))
    steep = np.clip((np.sqrt(gx * gx + gy * gy) - 1.2) / 1.6, 0, 1)
    steep = np.maximum(steep, np.clip(1 - dist / max(6.0, Rt * 0.07), 0, 1))[..., None]     # 最外面一圈（黑边）也算
    steep = cv2.GaussianBlur(steep, (9, 9), 0)[..., None] if steep.ndim == 2 else cv2.GaussianBlur(steep[..., 0], (9, 9), 0)[..., None]
    front_tex = (front_tex * (1 - steep) + back_fill * steep).astype(np.uint8)
    back_tex = (back_tex * (1 - steep) + back_fill * steep).astype(np.uint8)
    atlas = np.concatenate([front_tex, back_tex], 1)
    mesh = trimesh.Trimesh(vertices=V, faces=F, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=UV, image=Image.fromarray(atlas, 'RGB'))
    out = os.path.join(OUT, i + '_raw' + TAG + '.glb')
    mesh.export(out)
    v = V - V.mean(0); ev = np.sqrt(np.maximum(np.linalg.eigvalsh(np.cov(v.T)), 0))
    print('inflate', i, len(F), 'faces', 'thick %.2f' % (ev[0] / ev[2]), 'paper %.2f' % (ev[0] / ev[1]), flush=True)


for i in ids: build(i)
