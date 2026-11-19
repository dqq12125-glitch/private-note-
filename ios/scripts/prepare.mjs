#!/usr/bin/env node
// 打 iPhone 包之前的准备，一条命令做完（Windows、Mac、云上的 Mac 都一样）：
//   ① make-config.mjs  生成 ios/Generated/（版本、版本号；家庭版另有密钥和家长密码的哈希）
//   ② copy-web.mjs     把游戏网页复制进 ios/www/（销售版换上没有保留怪兽的 dex.js）
//   ③ make-icons.mjs   还没有图标时生成一次
// 用法：node ios/scripts/prepare.mjs [--edition sales|family] [--props 文件] [--release]
// 然后：cd ios && xcodegen generate && xcodebuild …（见 ios/README.md）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const edition = String(arg('edition') || process.env.ECHO_EDITION || 'sales').trim().toLowerCase();
const run = (script, args) => execFileSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit', env: { ...process.env, ECHO_EDITION: edition } });

try {
  run('make-config.mjs', argv);
  run('copy-web.mjs', ['--edition', edition]);
  const icon = path.join(HERE, '..', 'App', 'Resources', 'Assets.xcassets', 'AppIcon.appiconset', 'icon-1024.png');
  if (!fs.existsSync(icon)) run('make-icons.mjs', []);
  console.log('prepare: 好了（' + edition + '）。接着：cd ios && xcodegen generate');
} catch (e) {
  console.error('prepare: 没做完，停下（上面有原因）');
  process.exit(1);
}
