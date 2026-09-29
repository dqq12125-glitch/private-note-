# gridview.py 的第二步：给两张正交渲染图叠坐标网格并拼在一起（系统 python + PIL）
# 画面 700px 对应 1.4 个单位，中心 (0, 0.5)
import sys
from PIL import Image, ImageDraw, ImageFont
out, front, side = sys.argv[1:4]
S, U = 700, 700 / 1.4
def px(h, v): return (S / 2 + h * U, S / 2 - (v - .5) * U)
tiles = []
for path, hname in [(front, 'x'), (side, 'y')]:
    im = Image.open(path).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA')
    try: f = ImageFont.truetype('arial.ttf', 13)
    except OSError: f = ImageFont.load_default()
    for i in range(-7, 8):
        v = i / 10; x, _ = px(v, 0)
        d.line([(x, 0), (x, S)], fill=(0, 90, 255, 150 if i % 5 == 0 else 60), width=1)
        d.text((x + 2, S - 16), '%.1f' % v, fill=(0, 60, 200), font=f)
    for i in range(-2, 13):
        v = i / 10; _, y = px(0, v)
        d.line([(0, y), (S, y)], fill=(255, 40, 40, 150 if i % 5 == 0 else 60), width=1)
        d.text((2, y - 14), '%.1f' % v, fill=(200, 0, 0), font=f)
    d.text((S / 2 - 60, 4), ('FRONT  horizontal = x (left of image = -x)' if hname == 'x' else 'SIDE  horizontal = y (right = back +y)'), fill=(0, 0, 0), font=f)
    tiles.append(im)
sheet = Image.new('RGB', (S * 2, S), 'white')
for k, t in enumerate(tiles): sheet.paste(t, (k * S, 0))
sheet.save(out)
