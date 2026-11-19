// 回声岛公开版服务器 · 给 Worker 放三把「自己随机生成」的秘密：AUTH_PEPPER、DATA_KEY、ADMIN_TOKEN。
// 值在这里生成、直接从标准输入交给 wrangler，不打印、不写进仓库。已经有的不动（重新生成会让登录码哈希、存着的 Apple 令牌全部作废）。
// ADMIN_TOKEN 老板以后看举报要用：另存一份到仓库外面的文件（--admin-file 给路径），只写文件、不显示。
// 用法（在 cloud/ 里）：node scripts/put-random-secrets.mjs --admin-file D:/Claude/tools/echo-relay/cloud-admin-token.txt
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const adminFile = argv.includes('--admin-file') ? argv[argv.indexOf('--admin-file') + 1] : '';
const NAMES = ['AUTH_PEPPER', 'DATA_KEY', 'ADMIN_TOKEN'];
const wr = (args, input) => spawnSync('npx', ['wrangler', ...args], { input, encoding: 'utf8', shell: true });

const list = wr(['secret', 'list', '--format', 'json']);
let have = [];
try { have = JSON.parse(list.stdout.slice(list.stdout.indexOf('['))).map(x => x.name); } catch (e) { console.error('读不到现有的秘密名单：', (list.stderr || list.stdout).slice(0, 300)); process.exit(1); }

for (const name of NAMES) {
  if (have.includes(name)) { console.log(name + '：已经有了，不动'); continue; }
  const value = randomBytes(32).toString('base64');
  const r = wr(['secret', 'put', name], value + '\n');
  if (r.status !== 0) { console.error(name + '：没放上去'); process.exit(1); }
  if (name === 'ADMIN_TOKEN' && adminFile) {
    fs.mkdirSync(path.dirname(adminFile), { recursive: true });
    fs.writeFileSync(adminFile, value + '\n', { mode: 0o600 });
    console.log(name + '：放好了，另存了一份到 ' + adminFile);
  } else console.log(name + '：放好了');
}
