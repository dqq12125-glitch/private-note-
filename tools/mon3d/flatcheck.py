# 查已生成白模的厚度：太扁的（最薄边/最长边 < 0.25）删掉 shape 和 raw，让后台流水线用新的「换种子」逻辑重做
import os, sys, trimesh
D = 'art/hy3d'; bad = []
for f in sorted(os.listdir(D)):
    if not f.endswith('_shape.glb'): continue
    m = trimesh.load(os.path.join(D, f), force='mesh'); e = m.bounds[1] - m.bounds[0]; r = min(e) / max(e)
    if r < 0.25: bad.append((f[:-10], round(float(r), 2)))
print(bad)
if '--delete' in sys.argv:
    for i, _ in bad:
        for suf in ('_shape.glb', '_raw.glb'):
            p = os.path.join(D, i + suf)
            if os.path.exists(p): os.rename(p, p + '.flat')
