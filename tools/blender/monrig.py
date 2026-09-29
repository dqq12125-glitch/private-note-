# 怪兽绑骨骼 + 做动作 + 导出（给 Hunyuan3D 生成的带贴图模型用）
# 用法：blender.exe -b --factory-startup --python tools/blender/monrig.py -- id [id ...]
# 输入 art/hy3d/{id}_raw.glb + tools/mon3d/rigs.json（每只的骨骼关节，归一化坐标：脚底 z=0、身高 1、正面朝 -Y）
# 输出 art/mon3d/{id}.glb（减面、1024 贴图、骨骼蒙皮、动作 idle/walk/attack/hit/faint）和 art/mon3d/{id}.png 预览
# 骨骼名决定动作怎么做：body 身体、head 头、tail1..n 尾巴链、leg.* 腿（fl/fr/bl/br 或 L/R）、arm.* 手、ear.* 耳朵、wing.* 翅膀、fin.* 鳍、horn/crest 头饰
import bpy, sys, os, json, math
from mathutils import Vector, Quaternion, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FPS = 30


def load_normalized(src, yaw=0, thick=1):
    """导入 glb，合并成一个网格，放到脚底 z=0、身高 1、x/y 居中。
    yaw：绕竖轴转多少度让脸朝 -Y（Gemini 图是侧面/3/4 时生成的模型脸朝旁边）；thick：左右（x）方向加厚倍数（太扁的时候）"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(o in ms)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o != obj and o.type != 'MESH': bpy.data.objects.remove(o)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if yaw or thick != 1:
        M = Matrix.Diagonal((thick, 1, 1)).to_4x4() @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
        obj.data.transform(M)
    vs = [v.co for v in obj.data.vertices]
    lo = Vector([min(v[i] for v in vs) for i in range(3)]); hi = Vector([max(v[i] for v in vs) for i in range(3)])
    H = hi.z - lo.z
    off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in obj.data.vertices: v.co = (v.co - off) / H
    obj.data.update(); obj.name = 'mon'
    return obj, H


def local_rot(pb, axis, ang):
    """绕世界轴 axis 转 ang 弧度 → 这根骨头自己的旋转四元数"""
    R = pb.bone.matrix_local.to_3x3()
    a = (R.inverted() @ Vector(axis)).normalized()
    return Quaternion(a, ang)


def local_vec(pb, v):
    return pb.bone.matrix_local.to_3x3().inverted() @ Vector(v)


class Anim:
    """往一个动作里打关键帧：key(frame, bone, rot=[(轴,角度),...], loc=世界位移, scale=(沿骨头, 横向))"""
    def __init__(self, arm, name, frames, loop):
        self.arm, self.name, self.frames, self.loop = arm, name, frames, loop
        arm.animation_data_create()
        self.act = bpy.data.actions.new(name)
        arm.animation_data.action = self.act
        for pb in arm.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)

    def key(self, f, bone, rot=None, loc=None, scale=None):
        pb = self.arm.pose.bones.get(bone)
        if not pb: return
        q = Quaternion()
        for axis, ang in (rot or []): q = local_rot(pb, axis, ang) @ q
        pb.rotation_quaternion = q
        pb.location = local_vec(pb, loc) if loc else Vector()
        pb.scale = (scale[1], scale[0], scale[1]) if scale else (1, 1, 1)
        for p in ('rotation_quaternion', 'location', 'scale'):
            pb.keyframe_insert(p, frame=f, group=bone)

    def done(self):
        ad = self.arm.animation_data
        tr = ad.nla_tracks.new(); tr.name = self.name
        tr.strips.new(self.name, 1, self.act)
        ad.action = None


def bones_of(arm, prefix):
    return sorted([b.name for b in arm.data.bones if b.name.startswith(prefix)])


def side(name):
    """左右：.L/.fl/.bl → +1，.R/.fr/.br → -1"""
    s = name.split('.')[-1].lower()
    return 1 if s in ('l', 'fl', 'bl') or s.endswith('l') else -1


def front(name):
    s = name.split('.')[-1].lower()
    return 1 if s.startswith('f') else (-1 if s.startswith('b') else 0)


def make_anims(arm, spec):
    X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
    tails, legs, arms_, ears, wings, fins = (bones_of(arm, p) for p in ('tail', 'leg.', 'arm.', 'ear.', 'wing.', 'fin.'))
    fly = spec.get('fly', False)
    sw, S = math.sin, math.radians
    # 待机（2 秒循环）：呼吸、点头歪头、摇尾巴、耳朵翅膀轻动；会飞的上下飘
    a = Anim(arm, 'idle', 60, True)
    for f in range(0, 61, 5):
        t = f / 60 * 2 * math.pi
        a.key(f + 1, 'root', loc=(0, 0, (0.04 + 0.03 * sw(t)) if fly else 0))
        a.key(f + 1, 'body', scale=(1 + 0.025 * sw(t), 1 - 0.012 * sw(t)))
        a.key(f + 1, 'head', rot=[(X, S(3) * sw(t + 1)), (Y, S(3) * sw(t * 0.5))])
        ta = 36 / max(1, len(tails))  # 整条尾巴合起来摆 ±36°，一节一节往后传
        for i, b in enumerate(tails): a.key(f + 1, b, rot=[(Z, S(ta) * sw(t * 2 - i * 0.7))])
        for b in ears: a.key(f + 1, b, rot=[(Y, side(b) * S(6) * sw(t + 0.5))])
        for b in wings: a.key(f + 1, b, rot=[(Y, side(b) * S(25 if fly else 8) * sw(t * (3 if fly else 1)))])
        for b in arms_: a.key(f + 1, b, rot=[(X, S(5) * sw(t))])
        for b in fins: a.key(f + 1, b, rot=[(Z, side(b) * S(12) * sw(t * 2))])
    a.done()
    # 走路 / 跳着走（0.6 秒循环）
    a = Anim(arm, 'walk', 18, True)
    for f in range(0, 19, 3):
        t = f / 18 * 2 * math.pi
        a.key(f + 1, 'root', loc=(0, 0, 0.05 * abs(sw(t)) + (0.05 if fly else 0)))
        a.key(f + 1, 'body', rot=[(Y, S(4) * sw(t))])
        a.key(f + 1, 'head', rot=[(X, S(4) * sw(t * 2))])
        for b in legs:
            ph = (0 if side(b) > 0 else math.pi) + (math.pi if front(b) < 0 else 0)
            a.key(f + 1, b, rot=[(X, S(28) * sw(t + ph))])
        for b in arms_: a.key(f + 1, b, rot=[(X, S(20) * sw(t + (math.pi if side(b) > 0 else 0)))])
        for i, b in enumerate(tails): a.key(f + 1, b, rot=[(Z, S(48 / max(1, len(tails))) * sw(t * 2 - i * 0.8))])
        for b in wings: a.key(f + 1, b, rot=[(Y, side(b) * S(30 if fly else 10) * sw(t * 2))])
        for b in ears: a.key(f + 1, b, rot=[(X, S(8) * sw(t * 2))])
    a.done()
    # 攻击（0.9 秒）：往后蓄力 → 扑出去 → 回来
    a = Anim(arm, 'attack', 27, False)
    for f, back, lunge, lean, headn, tailu in [(1, 0, 0, 0, 0, 0), (8, .06, 0, -12, -8, 20), (13, 0, -.32, 16, 14, -10), (18, 0, -.28, 12, 8, 0), (27, 0, 0, 0, 0, 0)]:
        a.key(f, 'root', loc=(0, back + lunge, 0.06 if 8 < f < 18 else 0), rot=[(X, S(lean))])
        a.key(f, 'head', rot=[(X, S(headn))])
        for b in tails: a.key(f, b, rot=[(X, S(-tailu * 1.6 / max(1, len(tails))))])
        for b in arms_: a.key(f, b, rot=[(X, S(lean * 3))])
        for b in legs: a.key(f, b, rot=[(X, S(-lean * front(b) if front(b) else lean))])
        for b in wings: a.key(f, b, rot=[(Y, side(b) * S(lean * 2.5))])
    a.done()
    # 被打（0.5 秒）：往后一缩、压扁
    a = Anim(arm, 'hit', 15, False)
    for f, back, lean, sq in [(1, 0, 0, 1), (4, .14, -14, .9), (9, .08, -6, 1.04), (15, 0, 0, 1)]:
        a.key(f, 'root', loc=(0, back, 0), rot=[(X, S(lean))])
        a.key(f, 'body', scale=(sq, 1 + (1 - sq) * .5))
        a.key(f, 'head', rot=[(X, S(-lean * .8))])
        for b in ears: a.key(f, b, rot=[(X, S(lean * 1.5))])
        for b in tails: a.key(f, b, rot=[(X, S(lean * 3 / max(1, len(tails))))])
    a.done()
    # 倒下（1.2 秒，停在最后一帧）：晃一下、侧倒
    a = Anim(arm, 'faint', 36, False)
    for f, tilt, sink, headd in [(1, 0, 0, 0), (8, -8, 0, 10), (22, 70, -.02, 25), (28, 84, -.04, 30), (36, 82, -.04, 30)]:
        a.key(f, 'root', loc=(0, 0, sink + (-0.04 if fly else 0)), rot=[(Y, S(tilt))])
        a.key(f, 'head', rot=[(X, S(headd))])
        for b in wings + ears: a.key(f, b, rot=[(Y, side(b) * S(-headd))])
    a.done()


def build(id_, spec):
    obj, H = load_normalized(os.path.join(ROOT, 'art', 'hy3d', id_ + '_raw.glb'), spec.get('yaw', 0), spec.get('thick', 1))
    # 减面（保留 UV），合并重复点，方便算权重
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
    # 去掉飘在旁边的小碎块（和主体不相连、顶点数不到最大块 2% 的部分）
    import bmesh
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o.index not in seen: seen.add(o.index); stack.append(o)
        parts.append(comp)
    big = max(len(c) for c in parts)
    junk = [x for c in parts if len(c) < big * 0.02 for x in c]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context='VERTS'); bm.to_mesh(obj.data); obj.data.update()
    print('PARTS', id_, len(parts), 'removed', len(junk), 'verts')
    bm.free()
    m = obj.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1, spec.get('faces', 9000) / len(obj.data.polygons))
    bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.shade_smooth()
    # 贴图缩到 1024
    for s in obj.material_slots:
        for n in s.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 1024:
                n.image.scale(1024, 1024)
    # 骨骼
    ad = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    eb = ad.edit_bones.new('root'); eb.head = (0, 0, 0); eb.tail = (0, 0.15, 0)
    for name, parent, h, t in spec['bones']:
        e = ad.edit_bones.new(name); e.head = h; e.tail = t
        e.parent = ad.edit_bones[parent or 'root']
        e.use_connect = False
    ad.edit_bones['root'].use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')
    # 自动权重（热扩散），失败就退回包络
    for o in bpy.context.scene.objects: o.select_set(o in (obj, arm))
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    empty = [v for v in obj.data.vertices if not v.groups]
    print('RIG', id_, 'faces', len(obj.data.polygons), 'unweighted verts', len(empty))
    make_anims(arm, spec)
    # 导出
    out = os.path.join(ROOT, 'art', 'mon3d'); os.makedirs(out, exist_ok=True)
    for o in bpy.context.scene.objects: o.select_set(o in (obj, arm))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, id_ + '.glb'), export_format='GLB', use_selection=True,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_image_format='JPEG', export_image_quality=85, export_optimize_animation_size=True,
                              export_apply=False, export_yup=True)
    print('EXPORT', id_, os.path.getsize(os.path.join(out, id_ + '.glb')) // 1024, 'KB')
    return obj, arm


if __name__ == '__main__' and '--' in sys.argv:
    ids = sys.argv[sys.argv.index('--') + 1:]
    # 每只一个文件 tools/mon3d/rigs/<id>.json（并行标注不打架）；没有的再看老的合并文件 rigs.json
    specs = json.load(open(os.path.join(ROOT, 'tools', 'mon3d', 'rigs.json'), encoding='utf-8'))
    for i in ids:
        p1 = os.path.join(ROOT, 'tools', 'mon3d', 'rigs', i + '.json')
        build(i, json.load(open(p1, encoding='utf-8')) if os.path.exists(p1) else specs[i])
