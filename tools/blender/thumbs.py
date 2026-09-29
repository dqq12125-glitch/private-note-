# 流程说明图：同一个 3/4 角度渲白模和贴图版（按 rigs.json 的 yaw/thick 摆正）
# 用法：blender.exe -b --factory-startup --python tools/blender/thumbs.py -- outdir id [id ...]
import bpy, sys, os, json, math
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from monrig import load_normalized, ROOT
a = sys.argv[sys.argv.index('--') + 1:]
out, ids = a[0], a[1:]
specs = json.load(open(os.path.join(ROOT, 'tools', 'mon3d', 'rigs.json'), encoding='utf-8'))
for i in ids:
    sp = specs.get(i, {})
    for kind, tex in (('shape', False), ('raw', True)):
        load_normalized(os.path.join(ROOT, 'art', 'hy3d', i + '_' + kind + '.glb'), sp.get('yaw', 0), sp.get('thick', 1))
        sc = bpy.context.scene
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE' if tex else 'SINGLE'
        sc.display.shading.single_color = (0.82, 0.8, 0.76); sc.display.shading.show_cavity = not tex
        sc.render.resolution_x = sc.render.resolution_y = 320; sc.render.film_transparent = True
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.35
        r = math.radians(-35); cam.location = Vector((math.sin(r) * 6, -math.cos(r) * 6, 1.8))
        cam.rotation_euler = (Vector((0, 0, 0.48)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        os.makedirs(os.path.join(out, kind), exist_ok=True)
        sc.render.filepath = os.path.join(out, kind, i + '.png'); bpy.ops.render.render(write_still=True)
