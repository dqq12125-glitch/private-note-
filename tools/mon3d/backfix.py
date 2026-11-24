# 背后又画了一张脸的模型：把背面的脸抹掉（2026-11-24）。
# 原画是正面朝着看的人画的，生成贴图那一步看不到背后，常常把正面照搬到背面——从背后看还是一张脸
# （新画风的大地图里，跟着走的怪兽正是从背后看的）。形状不动，只改贴图：
#   ① 从正背后把模型「拍」成一张图（只画朝后的面，最靠后的那层盖住前面的）
#   ② 这张图里离轮廓近的一圈（黑边 + 身体靠外的颜色）照旧，更里面的（脸、肚皮、花纹）从这一圈往里抹开——和 inflate.py 的背面一个办法
#   ③ 把抹开的颜色写回贴图：只写朝后的地方（法线越朝后写得越实，侧面不动）、只写从背后看最外面的那层
#      （藏在身体前面的手、耳朵的背面不动）；贴图块之间的空隙跟着补上，缩小时不渗色
# 只适合正面朝着看的人画的那种（背后本来就该是一个光光的后背）。侧着画的、斜着画的别用：它们「背后」是另一侧的身子，花纹该留着。
# 用法：D:/Claude/tools/hy3d/Scripts/python tools/mon3d/backfix.py <id> [id ...] [--tag=p1] [--out=bf] [--band=0.10] [--debug]
#   读 art/hy3d/<id>_raw[_标签].glb（朝向和 Hunyuan3D 出来的一样：脸朝 +Z、头朝 +Y），写 art/hy3d/<id>_raw_<out>.glb
#   --debug：另存一张「改之前的背面 | 抹开的颜色 | 改之后的背面」到 art/hy3d/backfix/<id>.png
import os, sys
import numpy as np
from PIL import Image
import cv2
import trimesh

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
ids = [a for a in sys.argv[1:] if not a.startswith('--')]
D = os.path.join(ROOT, 'art', 'hy3d')
TAG = ('_' + opt['tag']) if opt.get('tag') else ''
OUTT = '_' + opt.get('out', 'bf')
BAND = float(opt.get('band', 0.10))
DEBUG = '--debug' in sys.argv
N = 512                 # 「拍」出来的背面图多大
A0, A1 = 0.10, 0.45     # 法线朝后多少开始改、多少算全改（法线的 z：0 是正侧面，-1 是正背后）
E = 0.08                # 三角形往外多算一点点，免得相邻三角形之间漏一条缝


def back_shot(P, M, Zb, pts, zc, order, col):
    for f in order:
        poly = np.rint(pts[f] * 16).astype(np.int32)
        c = col[f]
        cv2.fillConvexPoly(P, poly, (int(c[0]), int(c[1]), int(c[2])), lineType=cv2.LINE_8, shift=4)
        if M is not None:
            cv2.fillConvexPoly(M, poly, 255, lineType=cv2.LINE_8, shift=4)
            cv2.fillConvexPoly(Zb, poly, float(zc[f]), lineType=cv2.LINE_8, shift=4)


def fix(i):
    src = os.path.join(D, i + '_raw' + TAG + '.glb')
    mesh = trimesh.load(src, force='mesh', process=False)
    V = np.asarray(mesh.vertices, np.float64); F = np.asarray(mesh.faces, np.int64)
    UV = np.asarray(mesh.visual.uv, np.float64)
    mat = mesh.visual.material
    key = 'baseColorTexture' if getattr(mat, 'baseColorTexture', None) is not None else 'image'
    tex = np.asarray(getattr(mat, key).convert('RGB')).copy(); H, W = tex.shape[:2]
    tu = UV[:, 0] * W - 0.5; tv = (1 - UV[:, 1]) * H - 0.5        # 每个顶点在贴图上的像素位置（trimesh 的 v 从下往上）
    fn = np.asarray(mesh.face_normals); vn = np.asarray(mesh.vertex_normals)
    # ① 从正背后拍一张
    mn, mx = V.min(0), V.max(0); s = (N - 24) / max(mx[0] - mn[0], mx[1] - mn[1])
    px = (V[:, 0] - (mn[0] + mx[0]) / 2) * s + N / 2; py = N / 2 - (V[:, 1] - (mn[1] + mx[1]) / 2) * s
    pts = np.stack([px[F], py[F]], -1)
    zc = V[F][:, :, 2].mean(1)
    backf = np.where(fn[:, 2] < -0.05)[0]
    order = backf[np.argsort(-zc[backf])]                         # 先画靠前的，最后画最靠后的
    cu = np.clip(np.rint(tu[F].mean(1)).astype(int), 0, W - 1); cw = np.clip(np.rint(tv[F].mean(1)).astype(int), 0, H - 1)
    P = np.zeros((N, N, 3), np.uint8); M = np.zeros((N, N), np.uint8); Zb = np.full((N, N), 1e9, np.float32)
    back_shot(P, M, Zb, pts, zc, order, tex[cw, cu])
    inside = cv2.morphologyEx(M, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    holes = ((inside > 0) & (M == 0)).astype(np.uint8)
    if holes.any(): P = cv2.inpaint(P, holes, 3, cv2.INPAINT_TELEA)
    Zmin = cv2.erode(Zb, np.ones((7, 7), np.uint8))               # 这一小块里最靠后的那层有多靠后
    # ② 离轮廓近的一圈照旧，里面的从这一圈往里抹开
    inside = (inside > 0).astype(np.uint8)
    dist = cv2.distanceTransform(inside, cv2.DIST_L2, 5); Rt = float(dist.max()) or 1.0
    band = max(5.0, Rt * BAND)
    # 颜色只取这一圈靠里的那一半（最外面是原画的黑边，取进来背后会发黑）；按远近加权平均，近的说了算，
    # 离哪边都远的身体正中再掺一点更大范围的平均。（试过 cv2.inpaint：会抹出一道道扇形的印子）
    ring = ((inside > 0) & (dist > band * 0.4) & (dist <= band)).astype(np.float32)
    Pf = P.astype(np.float32) * ring[..., None]
    s1, s2 = max(4.0, Rt * 0.18), max(8.0, Rt * 0.6)
    c1, w1 = cv2.GaussianBlur(Pf, (0, 0), s1), cv2.GaussianBlur(ring, (0, 0), s1)
    c2, w2 = cv2.GaussianBlur(Pf, (0, 0), s2), cv2.GaussianBlur(ring, (0, 0), s2)
    fill = (c1 + 0.02 * c2) / np.maximum(w1 + 0.02 * w2, 1e-6)[..., None]
    fill = cv2.GaussianBlur(fill, (9, 9), 0).astype(np.float32)
    wgt = np.clip((dist - band * 0.6) / (band * 0.4), 0, 1).astype(np.float32)
    # ③ 写回贴图
    orig = tex.astype(np.float32); new = orig.copy(); mod = np.zeros((H, W), np.float32)
    tol = 0.05 * (mx[1] - mn[1])
    cand = np.where(vn[F][:, :, 2].min(1) < -A0)[0]
    for f in cand:
        a, b, c = F[f]
        x0 = max(0, int(np.floor(min(tu[a], tu[b], tu[c])))); x1 = min(W - 1, int(np.ceil(max(tu[a], tu[b], tu[c]))))
        y0 = max(0, int(np.floor(min(tv[a], tv[b], tv[c])))); y1 = min(H - 1, int(np.ceil(max(tv[a], tv[b], tv[c]))))
        if x1 < x0 or y1 < y0: continue
        d = (tv[b] - tv[c]) * (tu[a] - tu[c]) + (tu[c] - tu[b]) * (tv[a] - tv[c])
        if abs(d) < 1e-9: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1, dtype=np.float64), np.arange(y0, y1 + 1, dtype=np.float64))
        l1 = ((tv[b] - tv[c]) * (gx - tu[c]) + (tu[c] - tu[b]) * (gy - tv[c])) / d
        l2 = ((tv[c] - tv[a]) * (gx - tu[c]) + (tu[a] - tu[c]) * (gy - tv[c])) / d
        l3 = 1 - l1 - l2
        ins = (l1 >= -E) & (l2 >= -E) & (l3 >= -E)
        if not ins.any(): continue
        ix = np.clip(np.rint(l1 * px[a] + l2 * px[b] + l3 * px[c]).astype(int), 0, N - 1)
        iy = np.clip(np.rint(l1 * py[a] + l2 * py[b] + l3 * py[c]).astype(int), 0, N - 1)
        z = l1 * V[a, 2] + l2 * V[b, 2] + l3 * V[c, 2]
        nz = l1 * vn[a, 2] + l2 * vn[b, 2] + l3 * vn[c, 2]
        w = np.clip((-nz - A0) / (A1 - A0), 0, 1) * wgt[iy, ix] * (z <= Zmin[iy, ix] + tol) * ins
        cur = mod[y0:y1 + 1, x0:x1 + 1]
        take = w > cur
        if not take.any(): continue
        w3 = w[..., None]
        blend = orig[y0:y1 + 1, x0:x1 + 1] * (1 - w3) + fill[iy, ix] * w3
        new[y0:y1 + 1, x0:x1 + 1][take] = blend[take]
        cur[take] = w[take]
    # 贴图块之间的空隙：挨着改过的地方的，用改过的颜色补（不然缩小时原来的脸会从缝里渗出来）
    cov = np.zeros((H, W), np.uint8)
    tri = np.rint(np.stack([tu[F], tv[F]], -1) * 16).astype(np.int32)
    for k in range(0, len(tri), 4096): cv2.fillPoly(cov, list(tri[k:k + 4096]), 255, lineType=cv2.LINE_8, shift=4)
    m = (mod > 0.5).astype(np.float32)
    near = cv2.dilate(m, np.ones((9, 9), np.uint8)) > 0
    gut = (cov == 0) & near
    if gut.any():
        bc = cv2.blur(new * m[..., None], (9, 9)); bm = cv2.blur(m, (9, 9))
        new[gut] = (bc / np.maximum(bm, 1e-4)[..., None])[gut]
    out8 = np.clip(new, 0, 255).astype(np.uint8)
    setattr(mat, key, Image.fromarray(out8, 'RGB'))
    out = os.path.join(D, i + '_raw' + OUTT + '.glb')
    mesh.export(out)
    n = int((mod > 0.5).sum())
    print('backfix', i, 'texels', n, '(%.0f%%)' % (100.0 * n / max(1, int((cov > 0).sum()))), flush=True)
    if DEBUG:
        after = np.zeros((N, N, 3), np.uint8)
        back_shot(after, None, None, pts, zc, order, out8[cw, cu])
        os.makedirs(os.path.join(D, 'backfix'), exist_ok=True)
        Image.fromarray(np.concatenate([P, np.clip(fill, 0, 255).astype(np.uint8), after], 1), 'RGB').save(os.path.join(D, 'backfix', i + '.png'))


for i in ids: fix(i)
