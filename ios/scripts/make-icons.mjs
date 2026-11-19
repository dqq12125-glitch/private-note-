#!/usr/bin/env node
// 从安卓的图标 android/icon-512.png 生成 iPhone 的 App 图标：
//   ios/App/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png（1024×1024、没有透明通道——苹果不收带透明的图标）
// 现在的 Xcode 只要这一张 1024 的，别的尺寸它自己缩。只用 Node 自带的模块（自己解 / 写 PNG），Windows、Mac 都能跑。
// 安卓的图标四个角是透明的圆角：这里垫上图标边上的颜色铺成方的（iPhone 自己会切圆角）。
// 512 放大到 1024 会有一点糊：以后有 1024 的原图就用  node ios/scripts/make-icons.mjs <原图.png>  重新生成。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'android', 'icon-512.png'));
const OUT = path.join(HERE, '..', 'App', 'Resources', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');
const SIZE = 1024;

// ---- 读 PNG（8 位、RGB 或 RGBA、不隔行）→ { w, h, px: RGBA 字节 } ----
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let p = 8, w = 0, h = 0, ch = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 6 && data[9] !== 2) || data[12] !== 0) throw new Error('只认 8 位、RGB / RGBA、不隔行的 PNG');
      ch = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let add = 0;
      if (f === 1) add = a;
      else if (f === 2) add = b;
      else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      px[o] = line[s]; px[o + 1] = line[s + 1]; px[o + 2] = line[s + 2]; px[o + 3] = ch === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { w, h, px };
}

// ---- 写 PNG（RGB，没有透明通道）----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(8), tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}
function writePngRgb(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const src = readPng(fs.readFileSync(SRC));
// 垫底的颜色：从左上角沿对角线往里走，第一个完全不透明的点（就是图标边上的颜色）
let bg = [0x12, 0x30, 0x4a];
for (let i = 0; i < Math.min(src.w, src.h) / 2; i++) { const o = (i * src.w + i) * 4; if (src.px[o + 3] === 255) { bg = [src.px[o], src.px[o + 1], src.px[o + 2]]; break; } }
// 放大（双线性，按预乘透明度取样免得边上发黑），垫到底色上
const out = Buffer.alloc(SIZE * SIZE * 3);
for (let y = 0; y < SIZE; y++) {
  const fy = Math.min(src.h - 1, Math.max(0, (y + 0.5) * src.h / SIZE - 0.5)), y0 = Math.floor(fy), y1 = Math.min(src.h - 1, y0 + 1), ty = fy - y0;
  for (let x = 0; x < SIZE; x++) {
    const fx = Math.min(src.w - 1, Math.max(0, (x + 0.5) * src.w / SIZE - 0.5)), x0 = Math.floor(fx), x1 = Math.min(src.w - 1, x0 + 1), tx = fx - x0;
    const acc = [0, 0, 0, 0];
    for (const [xx, yy, wt] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) {
      const o = (yy * src.w + xx) * 4, a = src.px[o + 3] / 255;
      acc[0] += src.px[o] * a * wt; acc[1] += src.px[o + 1] * a * wt; acc[2] += src.px[o + 2] * a * wt; acc[3] += a * wt;
    }
    const d = (y * SIZE + x) * 3;
    for (let k = 0; k < 3; k++) out[d + k] = Math.max(0, Math.min(255, Math.round(acc[k] + bg[k] * (1 - acc[3]))));
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, writePngRgb(SIZE, SIZE, out));
console.log('make-icons: ' + path.relative(ROOT, SRC).replace(/\\/g, '/') + '（' + src.w + '×' + src.h + '）→ ' + path.relative(ROOT, OUT).replace(/\\/g, '/') + '（' + SIZE + '×' + SIZE + '，底色 #' + bg.map(v => v.toString(16).padStart(2, '0')).join('') + '）');
