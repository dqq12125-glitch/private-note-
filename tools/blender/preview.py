# 预览模型：导入 glb，正面/侧面/背面/斜 45° 四张拼一排
# 用法：blender.exe -b --factory-startup --python tools/blender/preview.py -- in.glb out.png [texture]
import bpy, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
tex = len(a) > 2 and a[2] == 'texture'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr, size = (lo + hi) / 2, max(hi - lo)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'TEXTURE' if tex else 'SINGLE'
sc.display.shading.single_color = (0.8, 0.78, 0.74)
sc.display.shading.show_cavity = True
sc.render.resolution_x = sc.render.resolution_y = 512
sc.render.film_transparent = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.15
frames = []
for k, ang in enumerate([0, 90, 180, 45]):
    r = math.radians(ang); d = size * 3
    # glTF 导进来是 Z 朝上；正面朝 -Y
    cam.location = ctr + Vector((math.sin(r) * d, -math.cos(r) * d, size * 0.15))
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    p = out + '.%d.png' % k; sc.render.filepath = p
    bpy.ops.render.render(write_still=True); frames.append(p)
# 拼图
imgs = [bpy.data.images.load(p) for p in frames]
W = 512; strip = bpy.data.images.new('strip', W * 4, W, alpha=True)
px = [0.0] * (W * 4 * W * 4)
for k, im in enumerate(imgs):
    s = list(im.pixels)
    for y in range(W):
        row = s[y * W * 4:(y + 1) * W * 4]
        o = (y * W * 4 + k * W) * 4
        px[o:o + W * 4] = row
strip.pixels = px
strip.filepath_raw = out; strip.file_format = 'PNG'; strip.save()
for p in frames: os.remove(p)
