// 公开版服务器（cloud/）的测试：薄薄一层，照原样跑 cloud/test/run.js（它自己打包、起假上游和本机 Worker），输出和退出码原样带回来。
// cloud/ 有自己的依赖（wrangler、miniflare、ws），没装就提示先装：cd cloud && npm install
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CLOUD = path.join(__dirname, '..', 'cloud');

if (!fs.existsSync(path.join(CLOUD, 'node_modules', 'wrangler')) || !fs.existsSync(path.join(CLOUD, 'node_modules', 'miniflare'))) {
  console.log('✗ cloud/ 的依赖没装：cd cloud && npm install（装在 cloud/node_modules，不进仓库）');
  process.exit(1);
}
const ch = spawn(process.execPath, ['test/run.js'].concat(process.argv.slice(2)), { cwd: CLOUD, stdio: 'inherit', env: process.env });
ch.on('close', code => process.exit(code == null ? 1 : code));
