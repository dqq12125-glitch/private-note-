# 标骨骼用的参考图：模型归一化（脚底 z=0、身高 1、x/y 居中，正面朝 -Y）后，
# 渲正面（横轴 x）和侧面（横轴 y，右边是背后）两张，叠 0.1 间隔的坐标网格
# 用法：blender.exe -b --factory-startup --python tools/blender/gridview.py -- in.glb out.png [yaw] [thick]
import bpy, sys, os
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
from monrig import load_normalized
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
yaw = float(a[2]) if len(a) > 2 else 0; thick = float(a[3]) if len(a) > 3 else 1
obj, H = load_normalized(src, yaw, thick)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = sc.render.resolution_y = 700
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new('w'); sc.world.color = (1, 1, 1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.4
paths = []
for k, (loc, look) in enumerate([((0, -5, .5), (0, 0, .5)), ((5, 0, .5), (0, 0, .5))]):
    cam.location = loc; cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    p = out + '.%d.png' % k; sc.render.filepath = p; bpy.ops.render.render(write_still=True); paths.append(p)
# 叠网格（PIL 在 Blender 里没有，用系统 python 叠）
import subprocess, json
subprocess.run(['python', os.path.join(os.path.dirname(__file__), 'gridview_overlay.py'), out] + paths, check=True)
for p in paths: os.remove(p)
