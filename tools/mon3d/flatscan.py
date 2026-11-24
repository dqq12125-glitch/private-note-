# 量每只怪兽的白模 / 贴图模型有多「扁」：顶点的主成分（PCA）三个方向的长度 a ≥ b ≥ c。
#   paper = c / b：最薄的方向比上中间那个方向——纸片一样的东西这个数很小；蛇、龙这种细长的（a 很长、b 和 c 差不多）不会被冤枉
#   thick = c / a：gen.py --pca 用的那个数（最薄 / 最长）
# 用法：D:/Claude/tools/hy3d/Scripts/python tools/mon3d/flatscan.py [--dir=art/hy3d] [--suffix=_raw.glb] [--out=文件.csv] [id ...]
# 打印 paper < 0.45 的（最扁的在前）；--out 把全部写成 csv（id,a,b,c,paper,thick）
import os, sys
import numpy as np
import trimesh

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
D = os.path.join(ROOT, opt.get('dir', 'art/hy3d'))
SUF = opt.get('suffix', '_raw.glb')
want = [a for a in sys.argv[1:] if not a.startswith('--')]
rows = []
for f in sorted(os.listdir(D)):
    if not f.endswith(SUF): continue
    i = f[:-len(SUF)]
    if want and i not in want: continue
    if not want and '_' in i: continue          # 带后缀的试验品（xxx_raw_p1.glb 这种）不算
    try:
        m = trimesh.load(os.path.join(D, f), force='mesh')
        v = np.asarray(m.vertices, dtype=np.float64); v = v - v.mean(0)
        ev = np.sqrt(np.maximum(np.linalg.eigvalsh(np.cov(v.T)), 0))
        c, b, a = float(ev[0]), float(ev[1]), float(ev[2])
        rows.append((i, a, b, c, c / b if b else 0, c / a if a else 0))
    except Exception as e:
        print('读不了', f, e, flush=True)
rows.sort(key=lambda r: r[4])
if 'out' in opt:
    with open(opt['out'], 'w', encoding='utf-8') as fh:
        fh.write('id,a,b,c,paper,thick\n')
        for r in rows: fh.write('%s,%.4f,%.4f,%.4f,%.3f,%.3f\n' % r)
print(len(rows), '个。paper < 0.45 的：')
for r in rows:
    if r[4] < 0.45: print('  %-14s paper %.2f  thick %.2f' % (r[0], r[4], r[5]))
