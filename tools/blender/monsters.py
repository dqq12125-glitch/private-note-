# 回声岛 · 用 Blender 脚本建怪兽模型（样品）
# 做法：身体由几个椭球 / 圆管拼起来 → 体素重建网格（融成一整块，像捏的黏土）→ 平滑 → 减面 → 按「离哪个零件最近」上颜色；
#       眼睛、高光、腮红、鼻子、嘴、火焰这些小零件单独贴上去
# 用法：blender.exe -b --factory-startup --python tools/blender/monsters.py -- [编号 ...]
# 输出：art/blender/{id}.glb（给游戏用：顶点颜色；发光部分单独一个材质）、art/blender/{id}.png（Blender 渲染的预览）
import bpy, math, sys, os
from mathutils import Vector, Euler, Matrix, Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'art', 'blender')
os.makedirs(OUT, exist_ok=True)

def hexc(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

PARTS = []   # (object, kind)：kind = 'body' 普通 / 'glow' 发光

def deselect():
    for o in bpy.context.selected_objects: o.select_set(False)

def paint(obj, fn):
    me = obj.data
    if 'Col' not in me.color_attributes: me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    ca = me.color_attributes['Col']; mw = obj.matrix_world
    for v in me.vertices: ca.data[v.index].color = fn(mw @ v.co)

def smooth_shade(ob):
    for p in ob.data.polygons: p.use_smooth = True

def apply_mod(ob, mod):
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)

# ---------- 黏土身体 ----------
class Clay:
    """身体：若干椭球（ell）和圆管（tube）融在一起"""
    def __init__(self): self.parts = []
    def ell(self, c, r, col, rot=(0, 0, 0)):
        R = Euler([math.radians(a) for a in rot]).to_matrix()
        self.parts.append(('e', Vector(c), Vector(r), R, col)); return self
    def tube(self, pts, radii, col):
        self.parts.append(('t', [Vector(p) for p in pts], list(radii), None, col)); return self
    def sdf(self, part, p):
        k = part[0]
        if k == 'e':
            _, c, r, R, _ = part
            q = R.transposed() @ (p - c)
            return (Vector((q.x / r.x, q.y / r.y, q.z / r.z)).length - 1) * min(r)
        pts, radii = part[1], part[2]
        best = 1e9
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]; ab = b - a
            t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            d = (p - (a + ab * t)).length - (radii[i] * (1 - t) + radii[i + 1] * t)
            best = min(best, d)
        return best
    def build(self, voxel=0.018, smooth=8, keep=0.1, kind='body', name='body'):
        objs = []
        for part in self.parts:
            if part[0] == 'e':
                _, c, r, R, _ = part
                bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20)
                ob = bpy.context.active_object
                M = Matrix.Translation(c) @ R.to_4x4() @ Matrix.Diagonal((r.x, r.y, r.z, 1))
                ob.data.transform(M)
            else:
                pts, radii = part[1], part[2]
                cu = bpy.data.curves.new('t', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1; cu.bevel_resolution = 6; cu.resolution_u = 12; cu.use_fill_caps = True
                sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
                for i, (pp, rr) in enumerate(zip(pts, radii)):
                    bp = sp.bezier_points[i]; bp.co = pp; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = rr
                ob = bpy.data.objects.new('t', cu); bpy.context.collection.objects.link(ob)
                deselect(); bpy.context.view_layer.objects.active = ob; ob.select_set(True)
                bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object
                # 圆管两头加个圆球，免得是平的
                for pp, rr in ((pts[0], radii[0]), (pts[-1], radii[-1])):
                    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=rr, location=pp)
                    objs.append(bpy.context.active_object)
            objs.append(ob)
        deselect()
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        ob = bpy.context.active_object; ob.name = name
        m = ob.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.use_smooth_shade = True
        apply_mod(ob, m)
        m = ob.modifiers.new('sm', 'LAPLACIANSMOOTH'); m.iterations = smooth; m.lambda_factor = 0.6; m.use_volume_preserve = True
        apply_mod(ob, m)
        parts = self.parts
        def col(p):
            best, bc = 1e9, parts[0][4]
            for part in parts:
                d = self.sdf(part, p)
                if d < best: best, bc = d, part[4]
            return bc
        paint(ob, col)
        m = ob.modifiers.new('dc', 'DECIMATE'); m.ratio = keep
        apply_mod(ob, m)
        smooth_shade(ob)
        PARTS.append((ob, kind))
        return ob

# ---------- 小零件 ----------
def ellipsoid(center, radii, color, normal=None, kind='body', seg=14):
    """椭球小零件；normal：把它的 z 轴（厚度方向）转到这个方向，贴在曲面上"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2)
    ob = bpy.context.active_object
    M = Matrix.Diagonal((radii[0], radii[1], radii[2], 1))
    if normal is not None: M = Vector(normal).to_track_quat('Z', 'Y').to_matrix().to_4x4() @ M
    ob.data.transform(Matrix.Translation(Vector(center)) @ M)
    smooth_shade(ob); deselect()
    paint(ob, lambda p: color)
    PARTS.append((ob, kind)); return ob

def cone(base, tip, r, color, kind='body'):
    base, tip = Vector(base), Vector(tip); d = tip - base
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=r, radius2=0, depth=d.length)
    ob = bpy.context.active_object
    ob.data.transform(Matrix.Translation((base + tip) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    smooth_shade(ob); deselect(); paint(ob, lambda p: color)
    PARTS.append((ob, kind)); return ob

def curve_line(pts, r, color, kind='body'):
    cu = bpy.data.curves.new('l', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 1; cu.resolution_u = 6; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = Vector(p); bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new('l', cu); bpy.context.collection.objects.link(ob)
    deselect(); bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target='MESH'); ob = bpy.context.active_object; smooth_shade(ob); deselect()
    paint(ob, lambda p: color); PARTS.append((ob, kind)); return ob

def hit(obj, origin, direction):
    inv = obj.matrix_world.inverted()
    ok, loc, nor, _ = obj.ray_cast(inv @ Vector(origin), (inv.to_3x3() @ Vector(direction)).normalized())
    if not ok: return None, None
    return obj.matrix_world @ loc, (obj.matrix_world.to_3x3() @ nor).normalized()

def on_surface(obj, center, dirv, reach=3.0):
    """从中心朝 dirv 方向找身体表面"""
    c = Vector(center); d = Vector(dirv).normalized()
    p, n = hit(obj, c + d * reach, -d)
    return (p, n) if p is not None else (c + d * 0.3, d)

# 脸：两只大眼睛（黑眼珠 + 两个高光）、腮红、嘴。center 是头的中心，look 是脸朝的方向
# eyes：round 圆眼睛 / happy 眯眼笑 / owl 大金眼 / fierce 有点凶的眼睛（上面一道眉）
def face(head, center, size, eye=0.24, spread=0.38, up=0.12, iris='#2a2233', blush='#ff8fa3', mouth='smile', mcol='#4a2020', look=(0, -1, 0), eyes='round', gold='#ffc629'):
    C = Vector(center); L = Vector(look).normalized()
    side = L.cross(Vector((0, 0, 1))).normalized()
    upv = side.cross(L).normalized()
    er = size * eye
    for s in (-1, 1):
        p, n = on_surface(head, C, L + side * s * spread + upv * up)
        if eyes == 'happy':
            o = n * 0.008
            curve_line([p - side * er * 0.7 - upv * er * 0.2 + o, p + upv * er * 0.35 + o, p + side * er * 0.7 - upv * er * 0.2 + o], size * 0.022, hexc(iris))
        elif eyes == 'owl':
            ellipsoid(p + n * er * 0.04, (er * 1.05, er * 1.05, er * 0.3), hexc('#fffaf0'), normal=n)
            ellipsoid(p + n * er * 0.14, (er * 0.85, er * 0.85, er * 0.3), hexc(gold), normal=n)
            ellipsoid(p + n * er * 0.26, (er * 0.45, er * 0.5, er * 0.25), hexc('#1f1a24'), normal=n)
            ellipsoid(p + n * er * 0.46 + upv * er * 0.3 - side * er * 0.2, (er * 0.2, er * 0.2, er * 0.08), hexc('#ffffff'), normal=n)
        else:
            sy = 0.75 if eyes == 'fierce' else 0.92
            ellipsoid(p + n * er * 0.05, (er * 0.72, er * sy, er * 0.32), hexc(iris), normal=n)
            ellipsoid(p + n * er * 0.3 + upv * er * 0.36 - side * er * 0.22, (er * 0.28, er * 0.3, er * 0.12), hexc('#ffffff'), normal=n)
            ellipsoid(p + n * er * 0.3 - upv * er * 0.34 + side * er * 0.22, (er * 0.13, er * 0.13, er * 0.07), hexc('#ffffff'), normal=n)
            if eyes == 'fierce':   # 斜着的眉毛：外高内低
                o = n * er * 0.2
                curve_line([p + side * s * er * 0.9 + upv * er * 1.25 + o, p - side * s * er * 0.6 + upv * er * 0.85 + o], size * 0.02, hexc('#2a1a1a'))
        if blush:
            bp, bn = on_surface(head, C, L + side * s * (spread + 0.3) - upv * 0.2)
            ellipsoid(bp + bn * 0.003, (er * 0.62, er * 0.36, er * 0.06), hexc(blush), normal=bn)
    if mouth:
        mp, mn = on_surface(head, C, L - upv * 0.3)
        w = size * 0.13
        if mouth == 'beak':
            cone(mp - mn * 0.02, mp + mn * size * 0.3 - upv * size * 0.06, size * 0.13, hexc('#ff9f1c'))
        else:
            o = mn * 0.006
            curve_line([mp - side * w + upv * w * 0.35 + o, mp - side * w * 0.3 - upv * w * 0.1 + o, mp + o + upv * w * 0.12, mp + side * w * 0.3 - upv * w * 0.1 + o, mp + side * w + upv * w * 0.35 + o], size * 0.014, hexc(mcol))
            if mouth == 'fang':
                for s in (-1, 1): cone(mp + side * s * w * 0.45 + mn * 0.004, mp + side * s * w * 0.45 - upv * w * 0.6 + mn * 0.02, w * 0.2, hexc('#ffffff'))
    return side, upv

# 火焰（发光）：外层橙、里层黄，一簇向上的尖
def flame(base, h, w, lean=(0, 0, 0)):
    b = Vector(base); up = Vector((lean[0], lean[1], 1)).normalized()
    side = up.cross(Vector((0, 1, 0)))
    outer = Clay().ell(b, (w, w, w), hexc('#ff6d1f')).tube([b, b + up * h * 0.5, b + up * h], [w * 0.9, w * 0.55, w * 0.06], hexc('#ff6d1f')) \
        .tube([b + side * w * 0.5, b + up * h * 0.55 + side * w * 0.9], [w * 0.4, w * 0.05], hexc('#ff6d1f')).tube([b - side * w * 0.5, b + up * h * 0.45 - side * w * 0.8], [w * 0.4, w * 0.05], hexc('#ff6d1f'))
    outer.build(voxel=w * 0.14, smooth=4, keep=0.2, kind='glow', name='flame')
    inner = Clay().ell(b + Vector((0, -w * 0.35, 0)), (w * 0.6, w * 0.6, w * 0.6), hexc('#ffe45c')).tube([b + Vector((0, -w * 0.35, 0)), b + up * h * 0.55 + Vector((0, -w * 0.35, 0))], [w * 0.5, w * 0.05], hexc('#ffe45c'))
    inner.build(voxel=w * 0.12, smooth=3, keep=0.2, kind='glow', name='flame2')

# ---------- 合成、导出、渲染 ----------
def finish(mid, view=(-0.55, -1.0, 0.32)):
    mats = {}
    def mat(kind):
        if kind in mats: return mats[kind]
        m = bpy.data.materials.new(kind); m.use_nodes = True
        nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.6
        if kind == 'glow': nt.links.new(vc.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1.0
        mats[kind] = m; return m
    groups = {}
    for ob, kind in PARTS:
        ob.data.materials.clear(); ob.data.materials.append(mat(kind)); groups.setdefault(kind, []).append(ob)
    finals = []
    for kind, obs in groups.items():
        deselect()
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active; j.name = mid + '_' + kind; finals.append(j)
    zmin = min((o.matrix_world @ v.co).z for o in finals for v in o.data.vertices)
    for o in finals:
        o.data.transform(Matrix.Translation((0, 0, -zmin)))
    deselect()
    for o in finals: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, mid + '.glb'), use_selection=True, export_format='GLB', export_apply=True)
    tris = sum(len(p.vertices) - 2 for o in finals for p in o.data.polygons)
    print('TRIS', mid, tris)
    render(mid, finals, view)

def render(mid, finals, view):
    sc = bpy.context.scene
    for e in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: sc.render.engine = e; break
        except Exception: pass
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.use_freestyle = True
    ls = sc.view_layers[0].freestyle_settings.linesets.new('outline')
    ls.select_by_visibility = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_contour = True
    ls.linestyle.color = (0.14, 0.09, 0.08); ls.linestyle.thickness = 2.2
    for m in bpy.data.materials:
        nt = m.node_tree
        if not nt or 'Principled BSDF' not in nt.nodes: continue
        vc = [n for n in nt.nodes if n.type == 'VERTEX_COLOR'][0]; out = nt.nodes['Material Output']
        diff = nt.nodes.new('ShaderNodeBsdfDiffuse'); s2r = nt.nodes.new('ShaderNodeShaderToRGB'); ramp = nt.nodes.new('ShaderNodeValToRGB')
        cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
        cr.elements[0].position = 0.0; cr.elements[0].color = (0.66, 0.62, 0.74, 1)
        cr.elements[1].position = 0.2; cr.elements[1].color = (1, 1, 1, 1)
        e = cr.elements.new(0.8); e.color = (1.1, 1.1, 1.08, 1)
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
        emit = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(diff.outputs['BSDF'], s2r.inputs['Shader']); nt.links.new(s2r.outputs['Color'], ramp.inputs['Fac'])
        nt.links.new(vc.outputs['Color'], mul.inputs[6]); nt.links.new(ramp.outputs['Color'], mul.inputs[7])
        nt.links.new(mul.outputs[2], emit.inputs['Color'])
        emit.inputs['Strength'].default_value = 1.2 if m.name == 'glow' else 1.0
        nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5
    sun.rotation_euler = Euler((math.radians(40), math.radians(15), math.radians(-40))); bpy.context.collection.objects.link(sun)
    world = bpy.data.worlds.new('w'); world.color = (0.9, 0.9, 0.95); sc.world = world
    cd = bpy.data.cameras.new('cam'); cd.lens = 60
    co = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(co); sc.camera = co
    pts = [o.matrix_world @ v.co for o in finals for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (lo + hi) / 2; size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    co.location = ctr + Vector(view).normalized() * size * 2.9
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, mid + '.png')
    bpy.ops.render.render(write_still=True)

# ======================================================================
# 各只怪兽（朝 -Y 方向，脚在 z=0 附近，一般高 1.2 左右）
# ======================================================================
def emberpup():
    O, CR, D = hexc('#ff8a4c'), hexc('#ffe7c4'), hexc('#d9652e')
    c = Clay()
    c.ell((0, 0, 0.44), (0.3, 0.27, 0.33), O)
    c.ell((0, -0.14, 0.4), (0.2, 0.14, 0.24), CR)
    c.ell((0, 0, 0.98), (0.4, 0.36, 0.34), O)
    c.ell((0, -0.3, 0.9), (0.17, 0.13, 0.12), CR)
    for s in (-1, 1):
        c.ell((s * 0.15, -0.03, 0.1), (0.11, 0.15, 0.1), O)
        c.tube([(s * 0.26, -0.03, 0.62), (s * 0.34, -0.1, 0.46)], [0.08, 0.075], O)
    body = c.build(voxel=0.016)
    for s in (-1, 1):
        Clay().tube([(s * 0.3, 0.02, 1.2), (s * 0.44, 0.0, 1.06), (s * 0.44, -0.02, 0.86)], [0.08, 0.1, 0.07], D).build(voxel=0.014, name='ear')
    ellipsoid((0, -0.43, 0.95), (0.055, 0.04, 0.035), hexc('#3a2420'))
    face(body, (0, 0, 1.0), 0.38, eye=0.26, spread=0.42, up=0.16, mouth='smile')
    Clay().tube([(0, 0.24, 0.3), (0, 0.46, 0.34), (0.05, 0.6, 0.55)], [0.07, 0.06, 0.05], O).build(voxel=0.014, name='tail')
    flame((0.05, 0.62, 0.6), 0.38, 0.12, lean=(0, 0.15, 0))
    finish('emberpup', view=(-0.6, -1.0, 0.3))

def flamewolf():
    R, CR, G, DR = hexc('#c62828'), hexc('#ffcc80'), hexc('#ffc629'), hexc('#8e1b1b')
    c = Clay()
    c.ell((0, 0.05, 0.62), (0.34, 0.6, 0.32), R)                     # 身体（横着）
    c.ell((0, -0.38, 0.62), (0.26, 0.24, 0.28), CR)                  # 胸口
    c.ell((0, -0.6, 1.04), (0.36, 0.34, 0.33), R)                      # 头
    c.ell((0, -0.86, 0.94), (0.15, 0.2, 0.12), R)                    # 嘴筒
    c.ell((0, -0.9, 0.88), (0.12, 0.15, 0.07), CR)                   # 下巴
    for s in (-1, 1):
        for fz, fy in ((-0.34, -0.32), (0.4, 0.42)):
            c.tube([(s * 0.2, fy, 0.5), (s * 0.23, fy - 0.03, 0.22), (s * 0.23, fy - 0.05, 0.07)], [0.14, 0.12, 0.13], R)
            c.ell((s * 0.235, fy - 0.03, 0.28), (0.135, 0.13, 0.045), DR)      # 腿上的深色条纹
        c.ell((s * 0.2, -0.72, 1.24), (0.07, 0.07, 0.13), R, rot=(0, s * -20, 0))   # 耳朵
    body = c.build(voxel=0.018)
    ellipsoid((0, -1.02, 0.97), (0.05, 0.035, 0.035), hexc('#2a1a1a'))
    for s in (-1, 1): cone((s * 0.13, -0.56, 1.24), (s * 0.2, -0.42, 1.5), 0.05, G)       # 金色的角
    face(body, (0, -0.62, 1.06), 0.35, eye=0.26, spread=0.46, up=0.2, mouth='fang', eyes='fierce', blush=None, look=(0, -1, 0.05))
    # 脖子一圈火焰鬃毛
    for k in range(7):
        a = -1.2 + k * 0.4
        flame((math.sin(a) * 0.3, -0.34 + math.cos(a) * 0.05, 0.82 + math.cos(a) * 0.16), 0.3, 0.09, lean=(math.sin(a) * 0.6, 0.3, 0))
    Clay().tube([(0, 0.6, 0.72), (0, 0.84, 0.86), (0, 0.92, 1.05)], [0.09, 0.08, 0.06], R).build(voxel=0.016, name='tail')
    flame((0, 0.94, 1.08), 0.42, 0.13, lean=(0, 0.3, 0))
    finish('flamewolf', view=(-0.7, -1.0, 0.35))

def bubbly():
    B, P, A = hexc('#4fc3f7'), hexc('#e6f7ff'), hexc('#81d4fa')
    c = Clay()
    c.ell((0, 0, 0.5), (0.5, 0.46, 0.46), B)
    c.ell((0, -0.26, 0.34), (0.3, 0.2, 0.24), P)
    c.ell((0, 0, 0.12), (0.34, 0.3, 0.14), B)
    body = c.build(voxel=0.018)
    for s in (-1, 1):
        Clay().tube([(s * 0.46, 0.02, 0.5), (s * 0.66, 0.06, 0.58), (s * 0.74, 0.1, 0.72)], [0.08, 0.06, 0.02], A).ell((s * 0.6, 0.05, 0.6), (0.05, 0.12, 0.14), A, rot=(0, s * 40, 0)).build(voxel=0.012, name='fin')
    Clay().tube([(0, 0.06, 0.94), (0, 0.2, 1.08)], [0.07, 0.02], A).ell((0, 0.12, 0.98), (0.03, 0.14, 0.09), A).build(voxel=0.012, name='top')
    Clay().tube([(0, 0.42, 0.34), (0, 0.6, 0.5), (0, 0.7, 0.68)], [0.09, 0.06, 0.02], A).ell((0, 0.6, 0.5), (0.04, 0.14, 0.2), A, rot=(40, 0, 0)).build(voxel=0.012, name='tailfin')
    face(body, (0, 0, 0.56), 0.46, eye=0.26, spread=0.4, up=0.14, mouth='smile')
    for (x, z, r) in [(-0.5, 1.02, 0.07), (-0.62, 1.2, 0.05), (-0.52, 1.34, 0.035)]:
        ellipsoid((x, -0.3, z), (r, r, r), hexc('#dff6ff'), kind='glow')
    finish('bubbly', view=(-0.55, -1.0, 0.3))

def leaf(base, tip, width, col, vein):
    """一片叶子：扁椭球 + 中间一条叶脉"""
    b, t = Vector(base), Vector(tip); d = t - b; mid = (b + t) / 2
    q = d.to_track_quat('Z', 'Y')
    Clay().ell(mid, (width, width * 0.25, d.length / 2), col, rot=[math.degrees(a) for a in q.to_euler()]).build(voxel=width * 0.12, smooth=4, name='leaf')
    curve_line([b + d * 0.08, mid + Vector((0, -width * 0.18, 0)), t - d * 0.12], width * 0.05, vein)

def sprouty():
    G, P, L, V = hexc('#8bc34a'), hexc('#f1f8e9'), hexc('#4caf50'), hexc('#2e7d32')
    c = Clay()
    c.ell((0, 0, 0.5), (0.46, 0.42, 0.46), G)
    c.ell((0, -0.24, 0.36), (0.28, 0.2, 0.24), P)
    for s in (-1, 1): c.ell((s * 0.2, -0.08, 0.08), (0.13, 0.16, 0.09), G)
    c.tube([(0, 0, 0.9), (0, 0.02, 1.06)], [0.05, 0.035], L)          # 小茎
    body = c.build(voxel=0.017)
    leaf((0, 0.02, 1.04), (-0.34, 0.06, 1.4), 0.2, L, V)
    leaf((0, 0.02, 1.04), (0.2, 0.08, 1.3), 0.12, L, V)
    leaf((0, 0.4, 0.3), (0, 0.66, 0.5), 0.1, L, V)
    face(body, (0, 0, 0.56), 0.42, eye=0.26, spread=0.4, up=0.12, mouth='smile')
    finish('sprouty', view=(-0.55, -1.0, 0.35))

def zappy():
    Y, CR, O = hexc('#ffd54f'), hexc('#fff8e1'), hexc('#ff8f00')
    c = Clay()
    c.ell((0, 0.08, 0.34), (0.28, 0.36, 0.25), Y)
    c.ell((0, -0.08, 0.28), (0.18, 0.2, 0.16), CR)
    c.ell((0, -0.3, 0.64), (0.32, 0.3, 0.28), Y)                     # 大头
    c.ell((0, -0.52, 0.56), (0.14, 0.1, 0.09), CR)
    for s in (-1, 1):
        for fy in (-0.14, 0.3):
            c.ell((s * 0.16, fy, 0.08), (0.08, 0.1, 0.08), Y)
    body = c.build(voxel=0.015)
    for s in (-1, 1):   # 圆耳朵，耳朵尖是橙色的
        Clay().ell((s * 0.26, -0.22, 0.98), (0.15, 0.05, 0.19), Y, rot=(0, s * -25, 0)).ell((s * 0.32, -0.22, 1.12), (0.09, 0.055, 0.08), O, rot=(0, s * -25, 0)).build(voxel=0.012, name='ear')
    ellipsoid((0, -0.6, 0.6), (0.04, 0.03, 0.03), hexc('#3a2420'))
    face(body, (0, -0.3, 0.66), 0.3, eye=0.28, spread=0.44, up=0.15, mouth='smile', blush='#ff7043')
    for s in (-1, 1):   # 胡须
        for dz in (0.0, -0.04):
            curve_line([(s * 0.12, -0.55, 0.58 + dz), (s * 0.28, -0.54, 0.6 + dz * 2)], 0.006, hexc('#8a6a3a'))
    # 闪电尾巴
    Clay().tube([(0, 0.4, 0.34), (0.02, 0.56, 0.5), (0.14, 0.62, 0.62), (0.02, 0.74, 0.76), (0.16, 0.8, 0.94)], [0.05, 0.05, 0.055, 0.06, 0.03], O).build(voxel=0.012, name='tail')
    for (x, z) in [(-0.34, 0.66), (0.34, 0.68)]:
        ellipsoid((x, -0.46, z), (0.025, 0.025, 0.06), hexc('#fff59d'), kind='glow')
    finish('zappy', view=(-0.65, -1.0, 0.35))

def songlet():
    Y, P, O = hexc('#fdd835'), hexc('#fff9c4'), hexc('#ff7043')
    c = Clay()
    c.ell((0, 0, 0.5), (0.4, 0.38, 0.42), Y)
    c.ell((0, -0.22, 0.38), (0.24, 0.16, 0.22), P)
    for s in (-1, 1):
        c.ell((s * 0.38, 0.06, 0.5), (0.08, 0.22, 0.26), hexc('#f9c21a'), rot=(20, 0, s * 12))     # 翅膀
    c.tube([(0, 0.34, 0.4), (0, 0.52, 0.52)], [0.1, 0.04], hexc('#f9c21a'))                    # 尾羽
    body = c.build(voxel=0.015)
    for k, (x, h) in enumerate([(-0.07, 0.22), (0.0, 0.28), (0.07, 0.2)]):
        Clay().tube([(x * 0.5, 0.0, 0.86), (x, 0.06, 0.86 + h)], [0.05, 0.02], O).build(voxel=0.01, name='crest')
    for s in (-1, 1): Clay().tube([(s * 0.12, -0.02, 0.1), (s * 0.12, -0.06, 0.0)], [0.03, 0.03], O).ell((s * 0.12, -0.1, 0.02), (0.05, 0.07, 0.02), O).build(voxel=0.01, name='foot')
    face(body, (0, 0, 0.58), 0.4, eye=0.24, spread=0.34, up=0.2, mouth='beak', eyes='happy')
    for (x, z) in [(-0.46, 0.96), (-0.6, 1.14)]:   # 音符
        ellipsoid((x, -0.3, z), (0.05, 0.03, 0.04), hexc('#7e57c2'), kind='glow')
        curve_line([(x + 0.045, -0.3, z), (x + 0.045, -0.3, z + 0.16)], 0.01, hexc('#7e57c2'), kind='glow')
    finish('songlet', view=(-0.55, -1.0, 0.3))

def owlet():
    BR, CR, G = hexc('#8d6e63'), hexc('#efebe9'), hexc('#ffc629')
    c = Clay()
    c.ell((0, 0, 0.52), (0.42, 0.38, 0.48), BR)
    c.ell((0, -0.26, 0.66), (0.3, 0.14, 0.24), CR)                   # 脸盘
    c.ell((0, -0.24, 0.3), (0.24, 0.14, 0.2), CR)                    # 肚子
    for s in (-1, 1):
        c.ell((s * 0.4, 0.04, 0.46), (0.09, 0.2, 0.28), hexc('#6d4c41'), rot=(15, 0, s * 10))
        c.tube([(s * 0.22, -0.04, 0.9), (s * 0.3, -0.02, 1.08)], [0.08, 0.02], BR)            # 耳羽
    body = c.build(voxel=0.015)
    for s in (-1, 1): Clay().tube([(s * 0.12, -0.02, 0.1), (s * 0.12, -0.08, 0.0)], [0.03, 0.03], hexc('#ffb74d')).build(voxel=0.01, name='foot')
    face(body, (0, -0.1, 0.68), 0.4, eye=0.3, spread=0.36, up=0.1, mouth='beak', eyes='owl', blush=None)
    # 淡淡的紫色光圈
    for k in range(3): ellipsoid((-0.3 + k * 0.3, -0.05, 1.16 + (k % 2) * 0.08), (0.035, 0.035, 0.035), hexc('#b39ddb'), kind='glow')
    finish('owlet', view=(-0.5, -1.0, 0.3))

def twigling():
    G, P, BR = hexc('#8bc34a'), hexc('#f1f8e9'), hexc('#795548')
    c = Clay()
    segs = [((0, 0.5, 0.1), 0.1), ((0, 0.34, 0.12), 0.12), ((0, 0.16, 0.14), 0.13), ((0, -0.02, 0.18), 0.13)]
    for k, (p, r) in enumerate(segs):
        c.ell(p, (r, r * 0.9, r), G)
        if k: c.ell((p[0], p[1] + 0.09, p[2]), (r * 0.9, 0.03, r * 0.95), BR)       # 棕色条纹
    c.ell((0, -0.24, 0.38), (0.22, 0.2, 0.22), G)                    # 头（抬起来）
    c.tube([(0, -0.1, 0.22), (0, -0.2, 0.3)], [0.11, 0.13], G)
    for s in (-1, 1):
        for fy in (0.34, 0.16, -0.02): c.tube([(s * 0.08, fy, 0.06), (s * 0.13, fy - 0.02, 0.0)], [0.025, 0.022], BR)
    body = c.build(voxel=0.012)
    for s in (-1, 1): curve_line([(s * 0.08, -0.26, 0.58), (s * 0.14, -0.3, 0.72), (s * 0.22, -0.26, 0.8)], 0.012, BR)
    for s in (-1, 1): ellipsoid((s * 0.22, -0.26, 0.8), (0.03, 0.03, 0.03), hexc('#a5d6a7'))
    leaf((0, 0.2, 0.26), (0.06, 0.36, 0.46), 0.1, hexc('#66bb6a'), hexc('#2e7d32'))
    face(body, (0, -0.24, 0.4), 0.22, eye=0.3, spread=0.44, up=0.1, mouth='smile')
    finish('twigling', view=(-0.8, -1.0, 0.45))

def moonbunny():
    W, CR, G = hexc('#f7f7fa'), hexc('#fffde7'), hexc('#ffc629')
    c = Clay()
    c.ell((0, 0, 0.42), (0.28, 0.25, 0.32), W)
    c.ell((0, -0.14, 0.38), (0.18, 0.13, 0.22), CR)
    c.ell((0, 0, 0.92), (0.34, 0.31, 0.3), W)
    for s in (-1, 1):
        c.ell((s * 0.14, -0.05, 0.08), (0.1, 0.16, 0.09), W)
        c.tube([(s * 0.24, -0.05, 0.6), (s * 0.12, -0.24, 0.5)], [0.07, 0.065], W)      # 手捧在前面
    body = c.build(voxel=0.015)
    for s in (-1, 1):   # 长耳朵，里面是金色
        Clay().tube([(s * 0.12, 0.02, 1.14), (s * 0.18, 0.04, 1.44), (s * 0.2, 0.08, 1.66)], [0.08, 0.09, 0.05], W).build(voxel=0.013, name='ear')
        ellipsoid((s * 0.18, -0.03, 1.44), (0.045, 0.02, 0.18), G, normal=(0, -1, 0.1))
    Clay().ell((0, 0.28, 0.36), (0.13, 0.12, 0.13), hexc('#ffffff')).build(voxel=0.012, smooth=3, name='tail')
    ellipsoid((0, -0.32, 0.5), (0.13, 0.1, 0.09), hexc('#fffef8'))    # 手里的年糕
    fp, fn = on_surface(body, (0, 0, 0.98), (0, -0.45, 1))
    ellipsoid(fp + fn * 0.004, (0.05, 0.05, 0.015), G, normal=fn)   # 额头的小星星
    face(body, (0, 0, 0.94), 0.34, eye=0.27, spread=0.42, up=0.12, mouth='smile')
    finish('moonbunny', view=(-0.55, -1.0, 0.3))

def echodrake():
    T, M, G, D = hexc('#26a69a'), hexc('#e0f2f1'), hexc('#ffc629'), hexc('#1b7d74')
    c = Clay()
    c.ell((0, 0.1, 0.72), (0.42, 0.56, 0.44), T)
    c.ell((0, -0.24, 0.66), (0.28, 0.3, 0.34), M)
    c.tube([(0, -0.3, 0.98), (0, -0.52, 1.3), (0, -0.62, 1.5)], [0.2, 0.17, 0.16], T)     # 脖子
    c.ell((0, -0.66, 1.62), (0.28, 0.32, 0.26), T)                  # 头
    c.ell((0, -0.92, 1.56), (0.16, 0.18, 0.12), T)                   # 嘴筒
    c.ell((0, -0.92, 1.5), (0.13, 0.14, 0.06), M)
    for s in (-1, 1):
        for fy in (-0.24, 0.42):
            c.tube([(s * 0.26, fy, 0.56), (s * 0.3, fy - 0.04, 0.24), (s * 0.3, fy - 0.08, 0.06)], [0.13, 0.11, 0.12], T)
    c.tube([(0, 0.6, 0.66), (0, 0.98, 0.5), (0.2, 1.28, 0.42), (0.42, 1.4, 0.56)], [0.2, 0.14, 0.09, 0.04], T)   # 尾巴
    body = c.build(voxel=0.02)
    for s in (-1, 1):
        cone((s * 0.14, -0.6, 1.8), (s * 0.26, -0.36, 2.12), 0.06, G)                 # 角
        # 翅膀：一把扇子一样的羽毛
        for k in range(5):
            a = math.radians(-10 + k * 22)
            root = Vector((s * 0.36, 0.1, 1.02))
            tip = root + Vector((s * math.cos(a) * 0.95, 0.15 + k * 0.05, math.sin(a) * 0.8 + 0.2))
            Clay().tube([root, (root + tip) / 2 + Vector((0, 0, 0.1)), tip], [0.1, 0.09, 0.03], D if k % 2 else T).build(voxel=0.016, smooth=5, name='wing')
    for k in range(5):   # 背上像声波一样的水晶（发光）
        y = -0.3 + k * 0.24
        cone((0, y, 1.1 - k * 0.04), (0, y + 0.06, 1.34 - k * 0.04), 0.07, G, kind='glow')
    ellipsoid((0, -1.1, 1.6), (0.04, 0.03, 0.03), hexc('#1a2a2a'))
    face(body, (0, -0.68, 1.64), 0.28, eye=0.26, spread=0.48, up=0.22, mouth='fang', eyes='fierce', blush=None, look=(0, -1, 0.05))
    finish('echodrake', view=(-0.75, -1.0, 0.3))

WHO = {'emberpup': emberpup, 'flamewolf': flamewolf, 'bubbly': bubbly, 'sprouty': sprouty, 'zappy': zappy, 'songlet': songlet, 'owlet': owlet, 'twigling': twigling, 'moonbunny': moonbunny, 'echodrake': echodrake}

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(WHO)
    for mid in args:
        reset(); PARTS.clear()
        WHO[mid]()
        print('BUILT', mid)
