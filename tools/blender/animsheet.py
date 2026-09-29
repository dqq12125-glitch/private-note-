# 检查动作：导入导出好的 glb，每个动作取 5 帧，3/4 角度渲染，拼成一张（行 = 动作）
# 用法：blender.exe -b --factory-startup --python tools/blender/animsheet.py -- in.glb out.png
import bpy, sys, os, math, subprocess
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = sc.render.resolution_y = 320; sc.render.film_transparent = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.9
# glTF 导入后 Y 朝上被转回 Z 朝上；从左前方 45° 看（正面朝 -Y）
r = math.radians(-40); cam.location = Vector((math.sin(r) * 6, -math.cos(r) * 6, 1.6))
cam.rotation_euler = (Vector((0, 0, 0.45)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
tiles = []
acts = [x for x in bpy.data.actions]
order = ['idle', 'walk', 'attack', 'hit', 'faint']
acts.sort(key=lambda x: next((i for i, n in enumerate(order) if x.name.startswith(n)), 9))
MINI = len(a) > 2 and a[2] == 'mini'   # mini：只出一排 4 张（待机、攻击最远、走路、倒下最后）给标骨骼的检查用
PICK = {'idle': [0], 'attack': [0.45], 'walk': [0.3], 'faint': [1]}
for act in acts:
    arm.animation_data_create(); arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    row = []
    base = act.name.split('|')[-1].split('.')[0]
    ks = PICK.get(base, []) if MINI else [k / 4 for k in range(5)]
    for k, frac in enumerate(ks):
        f = round(f0 + (f1 - f0) * frac); sc.frame_set(f)
        p = out + '.%s.%d.png' % (act.name, k); sc.render.filepath = p
        bpy.ops.render.render(write_still=True); row.append(p)
    if row: tiles.append((act.name, row))
script = '''
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]; rows = [r.split('|') for r in sys.argv[2:]]
S = 320; sheet = Image.new('RGB', (S * 5 + 90, S * len(rows)), (235, 240, 245)); d = ImageDraw.Draw(sheet)
for y, r in enumerate(rows):
    d.text((8, y * S + S // 2), r[0], fill=(0, 0, 0))
    for x, p in enumerate(r[1:]):
        im = Image.open(p).convert('RGBA'); sheet.paste(im, (90 + x * S, y * S), im)
sheet.save(out)
'''
if MINI:
    tiles = [('check', [p for _, r in tiles for p in r])]
    script = script.replace('S * 5 + 90', 'S * 4 + 90')
subprocess.run(['python', '-c', script, out] + [n + '|' + '|'.join(r) for n, r in tiles], check=True)
for _, r in tiles:
    for p in r: os.remove(p)
