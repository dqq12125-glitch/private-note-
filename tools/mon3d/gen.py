# Gemini 画的图 → 带贴图的 3D 模型（腾讯开源的 Hunyuan3D-2，本机显卡跑）
# 用法：D:/Claude/tools/hy3d/Scripts/python tools/mon3d/gen.py [id ...] [--noshape] [--notex] [--mini] [--seed=N] [--tag=X] [--turbo] [--src=cut2] [--skipdone]
# 输入 art/gemini/cut/{id}.png（tools/cutout.py 抠好的透明图）
# 输出 art/hy3d/{id}_shape.glb（白模）、art/hy3d/{id}_raw.glb（带贴图），给 tools/blender/rig.py 绑骨骼做动作
import os, sys, time
os.environ.setdefault('HY3DGEN_MODELS', 'D:/Claude/tools/hy3d-models')
sys.path.insert(0, 'D:/Claude/tools/Hunyuan3D-2')
import torch
# 本机上 safetensors 的内存映射读法会 access violation：在 diffusers/transformers 导入之前，换成逐个 seek/read 的读法
import safetensors.torch as _st
from hy3dgen.shapegen.utils import read_safetensors
_st.load_file = lambda filename, device='cpu': read_safetensors(filename, device if isinstance(device, str) else 'cpu')
import trimesh
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
# --src=cut2 用家族图切出来的新图（art/gemini/cut2）
SRC, OUT = os.path.join(ROOT, 'art', 'gemini', 'cut'), os.path.join(ROOT, 'art', 'hy3d')
os.makedirs(OUT, exist_ok=True)
# --seed=N 换随机种子（生成得太扁时多试几个）；--tag=X 输出文件名加后缀 {id}_shape_X.glb，方便对比
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
SEED, TAG = int(opt.get('seed', 7)), ('_' + opt['tag'] if 'tag' in opt else '')
if 'src' in opt: SRC = os.path.join(ROOT, 'art', 'gemini', opt['src'])
# --skipdone：已经有 _raw.glb 的跳过
SKIPDONE = '--skipdone' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
ids = args or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png') and not f.startswith('_'))
if SKIPDONE: ids = [i for i in ids if not os.path.exists(os.path.join(OUT, i + '_raw' + TAG + '.glb'))]
print('todo', len(ids), flush=True)

def square(im):
    # 模型要主体居中、四周留白的方图
    im = im.convert('RGBA'); bb = im.getbbox(); im = im.crop(bb)
    s = int(max(im.size) * 1.15); c = Image.new('RGBA', (s, s), (255, 255, 255, 0))
    c.paste(im, ((s - im.width) // 2, (s - im.height) // 2), im)
    return c.resize((1024, 1024), Image.LANCZOS)

if '--noshape' not in sys.argv:
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FloaterRemover, DegenerateFaceRemover, FaceReducer
    # --mini 用 0.6B 的小模型（内存紧的时候）
    # --turbo：步数蒸馏版 + FlashVDM，5 步出形状（快很多）
    TURBO = '--turbo' in sys.argv
    repo, sub = ('tencent/Hunyuan3D-2mini', 'hunyuan3d-dit-v2-mini') if '--mini' in sys.argv else ('tencent/Hunyuan3D-2', 'hunyuan3d-dit-v2-0-turbo' if TURBO else 'hunyuan3d-dit-v2-0')
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(repo, subfolder=sub, variant='fp16')
    if TURBO: shape.enable_flashvdm()
    STEPS, OCT = (5, 380) if TURBO else (50, 320)
    for i in ids:
        if SKIPDONE and os.path.exists(os.path.join(OUT, i + '_shape' + TAG + '.glb')): continue   # 白模已有就不重做
        t = time.time()
        img = square(Image.open(os.path.join(SRC, i + '.png')))
        # 生成得太扁（最薄的一边 < 最长边的 25%）就换种子重来，最多试 4 个种子，挑最厚的
        best = None
        for sd in [SEED, 1, 3, 11][:4]:
            m = shape(image=img, num_inference_steps=STEPS, octree_resolution=OCT, guidance_scale=6.0,
                      generator=torch.manual_seed(sd))[0]
            e = m.bounds[1] - m.bounds[0]; ratio = float(min(e) / max(e))
            if best is None or ratio > best[0]: best = (ratio, m, sd)
            if ratio >= 0.25: break
            print('  flat', i, 'seed', sd, round(ratio, 2), flush=True)
        mesh = best[1]
        mesh = FloaterRemover()(mesh); mesh = DegenerateFaceRemover()(mesh); mesh = FaceReducer()(mesh, max_facenum=60000)
        mesh.export(os.path.join(OUT, i + '_shape' + TAG + '.glb'))
        print('shape', i, len(mesh.faces), 'faces', 'seed', best[2], 'thick', round(best[0], 2), round(time.time() - t), 's', flush=True)
    del shape; torch.cuda.empty_cache()

if '--notex' not in sys.argv:
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    paint = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2', subfolder='hunyuan3d-paint-v2-0')
    for i in ids:
        t = time.time()
        img = square(Image.open(os.path.join(SRC, i + '.png')))
        mesh = trimesh.load(os.path.join(OUT, i + '_shape' + TAG + '.glb'), force='mesh')
        mesh = paint(mesh, image=img)
        mesh.export(os.path.join(OUT, i + '_raw' + TAG + '.glb'))
        print('paint', i, round(time.time() - t), 's', flush=True)
