#!/usr/bin/env node
// 生成 iPhone 版的打包设置（都写进 ios/Generated/，不进仓库）：
//   BuildConfig.swift  版本（sales / family）、版本号、销售版开放的课本；家庭版另有百炼密钥、家长密码的哈希、中转服务、检查新版本的地址
//   Echo.xcconfig      构建号、App 标识的后缀、开发者团队编号……（盖掉 Config/Base.xcconfig 里的同名设置）
// 和安卓 android/app/build.gradle 读 echo.properties 是同一套规矩：
//   - 销售版（公开发的版本，默认）：**什么秘密都不读、不带**——没有密钥、没有打包的家长密码、没有中转服务；家长第一次打开时在向导里设；
//   - 家庭版（ECHO_EDITION=family）：密钥从 KEY_FILE 指的文件读（写着 DASHSCOPE_API_KEY=… 的那一行），家长密码 PARENT_PIN
//     **只把「盐 + 密码」的 SHA-256 写进 App**，原文不进 App；这个脚本不打印密钥和密码，只说「有 / 没有」。
// 用法：
//   node ios/scripts/make-config.mjs                                   销售版
//   ECHO_EDITION=family node ios/scripts/make-config.mjs               家庭版（读 ios/echo.properties，没有就读 android/echo.properties）
//   node ios/scripts/make-config.mjs --edition family --props <文件>   家庭版，换一份配置
//   加 --release：家庭版没有家长密码就停下（和安卓打正式包一样）
// 环境变量（云上打包用，优先于配置文件）：ECHO_EDITION、ECHO_BOOKS、ECHO_VERSION_CODE、ECHO_MARKETING_VERSION、ECHO_BUNDLE_ID、
//   ECHO_BUNDLE_SUFFIX、ECHO_TEAM_ID；家庭版另有 ECHO_DASHSCOPE_KEY、ECHO_PARENT_PIN、ECHO_TALK_URL、ECHO_TALK_CODE、ECHO_VER_URL。
// 订阅和登录（两个版本都能给，**不是秘密**）：
//   ECHO_IAP_MONTHLY / ECHO_IAP_YEARLY  App Store Connect 里两个订阅的商品编号；不给就是「App 标识 + .premium.monthly / .premium.yearly」
//   ECHO_APPLE_SIGNIN=1 / 0             这个包带不带「通过 Apple 登录」的权限（App/EchoIsland.entitlements，要签名）。
//                                       不写：给了 ECHO_TEAM_ID（要签名的包）就带，没给（云上的模拟器包）就不带
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const IOS = path.resolve(HERE, '..');

// 和 build.gradle 的 PIN_SALT、VER_URL 默认值一样（tests/ios.test.js 核对）
export const PIN_SALT = 'echo-island-parent-pin-v1:';
export const DEFAULT_VER_URL = 'https://dqq12125-glitch.github.io/private-note-/version.json';
export const DEFAULT_BOOKS = 'hj7a,hj7b';
// 只有家庭版能用的环境变量（销售版给了就停下）
export const SECRET_ENV = ['ECHO_DASHSCOPE_KEY', 'ECHO_PARENT_PIN', 'ECHO_TALK_URL', 'ECHO_TALK_CODE', 'ECHO_VER_URL'];

export const pinHash = pin => crypto.createHash('sha256').update(PIN_SALT + pin, 'utf8').digest('hex');

// App 标识的默认值只写在一处：Config/Base.xcconfig 的 ECHO_BUNDLE_ID 那一行（这里读它，订阅的商品编号跟着它）
export function baseBundleId(file = path.join(IOS, 'Config', 'Base.xcconfig')) {
  const m = fs.readFileSync(file, 'utf8').match(/^\s*ECHO_BUNDLE_ID\s*=\s*([A-Za-z0-9.-]+)\s*$/m);
  if (!m) throw new Error('Config/Base.xcconfig 里找不到 ECHO_BUNDLE_ID = …');
  return m[1];
}
export const DEFAULT_BUNDLE_ID = baseBundleId();
// 商品编号：字母、数字、点、下划线（App Store Connect 的规矩，和 Store.swift 的 okId 一样）
export const okProductId = id => /^[A-Za-z0-9._]{1,100}$/.test(id);
export const iapIds = bundle => ({ monthly: bundle + '.premium.monthly', yearly: bundle + '.premium.yearly' });

// 读 .properties（key=value，# 开头是注释）
export function readProps(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const i = line.search(/[=:]/);
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/\\([\\:=# ])/g, '$1');
  }
  return out;
}

// KEY_FILE 里写着 DASHSCOPE_API_KEY=… 的那一行
export function keyFromFile(file) {
  if (!file || !fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.trim().startsWith('DASHSCOPE_API_KEY'));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

function git(args) {
  try { return execFileSync('git', ['--no-optional-locks', '-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return ''; }
}

const swiftStr = v => '"' + String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
const ymd = d => '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

// 算出全部设置。o：{ edition, props（已经读好的配置）, env, release, now }。不碰磁盘上的配置文件，方便测试
export function compute(o) {
  const env = o.env || {}, props = o.props || {};
  const edition = String(o.edition || env.ECHO_EDITION || 'sales').trim().toLowerCase();
  if (edition !== 'sales' && edition !== 'family') throw new Error('ECHO_EDITION must be family or sales (got: ' + edition + ')');
  const sales = edition === 'sales';
  const warn = [];
  // 销售版：明明白白给了密钥、家长密码、中转服务、检查新版本的地址（环境变量）就停下——多半是把家庭版的设置用错了地方。
  // （配置文件 echo.properties 销售版根本不打开，所以同一份文件两个版本都能用，和安卓一样）
  // 订阅的商品编号（ECHO_IAP_MONTHLY / ECHO_IAP_YEARLY）、ECHO_APPLE_SIGNIN 不是秘密，销售版可以给（销售版就是卖订阅的那个）
  if (sales) {
    const given = SECRET_ENV.filter(k => String(env[k] || '').trim());
    if (given.length) throw new Error('Sales edition must not be given a DashScope key, a parent PIN, a relay or an update URL (set: ' + given.join(', ') + ').');
  }

  // 密钥和家长密码：销售版根本不读
  let key = '', hash = '';
  if (!sales) {
    key = String(env.ECHO_DASHSCOPE_KEY || keyFromFile(props.KEY_FILE) || '').trim();
    const pin = String(env.ECHO_PARENT_PIN || props.PARENT_PIN || '').trim();
    if (pin) {
      if (!/^\d{4}$/.test(pin)) throw new Error('PARENT_PIN must be exactly 4 digits (value not shown).');
      hash = pinHash(pin);
    }
    if (!key) warn.push('没有密钥（KEY_FILE 是空的或者里面没有 DASHSCOPE_API_KEY 那一行）：要家长在手机「设置 → AI」里粘贴一次');
    if (!hash) {
      if (o.release) throw new Error('家庭版的正式包要有家长密码：在 echo.properties 里填 PARENT_PIN（4 位数字）');
      warn.push('没有 PARENT_PIN：App 里家长才能动的设置会一直锁着');
    }
  }

  // 版本号：构建号 = git 提交数（只增不减），名字 = 打包日期-短哈希（有没提交的改动加 +，销售版末尾加 -s）
  const fixed = String(env.ECHO_VERSION_CODE || '').trim();
  let code = 0, hashShort = '', dirty = false;
  if (/^\d+$/.test(fixed)) code = +fixed;
  hashShort = git(['rev-parse', '--short=7', 'HEAD']);
  if (!code) {
    const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
    const n = git(['rev-list', '--count', 'HEAD']);
    if (/^\d+$/.test(n) && !shallow) code = +n;
    else {
      code = /^\d+$/.test(String(props.VERSION_CODE || '')) ? +props.VERSION_CODE : 1;
      warn.push((shallow ? '仓库是浅克隆的，数不出提交数' : '没有 git') + '：构建号用 ' + code + '（发给人装的包请设 ECHO_VERSION_CODE，或者把历史取全）');
    }
  }
  if (hashShort) dirty = !!git(['status', '--porcelain', '--untracked-files=no']);
  const name = ymd(o.now || new Date()) + '-' + (hashShort || (fixed ? 'v' + fixed : 'nogit')) + (dirty ? '+' : '') + (sales ? '-s' : '');

  const bundleId = String(env.ECHO_BUNDLE_ID || '').trim();
  if (bundleId && !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(bundleId)) throw new Error('ECHO_BUNDLE_ID 只能有字母、数字、点和减号');
  const suffix = env.ECHO_BUNDLE_SUFFIX !== undefined ? String(env.ECHO_BUNDLE_SUFFIX).trim() : sales ? '' : '.family';
  if (suffix && !/^\.[A-Za-z0-9.-]+$/.test(suffix)) throw new Error('ECHO_BUNDLE_SUFFIX 要以点开头，只能有字母、数字、点和减号');
  const team = String(env.ECHO_TEAM_ID || '').trim();
  if (team && !/^[A-Z0-9]{10}$/.test(team)) throw new Error('ECHO_TEAM_ID 应该是 10 位的大写字母和数字');
  const marketing = String(env.ECHO_MARKETING_VERSION || '').trim();
  if (marketing && !/^\d+(\.\d+){0,2}$/.test(marketing)) throw new Error('ECHO_MARKETING_VERSION 要写成 1.2.3 这样');

  // 订阅的两个商品编号：给了就用给的，没给就按这个包最后的 App 标识（家庭版带 .family）推出来
  const fullBundle = (bundleId || o.baseBundle || DEFAULT_BUNDLE_ID) + suffix;
  const iapMonthly = String(env.ECHO_IAP_MONTHLY || '').trim() || iapIds(fullBundle).monthly;
  const iapYearly = String(env.ECHO_IAP_YEARLY || '').trim() || iapIds(fullBundle).yearly;
  for (const [k, v] of [['ECHO_IAP_MONTHLY', iapMonthly], ['ECHO_IAP_YEARLY', iapYearly]]) {
    if (!okProductId(v)) throw new Error(k + ' 只能有字母、数字、点和下划线（最长 100）');
  }
  if (iapMonthly === iapYearly) throw new Error('ECHO_IAP_MONTHLY 和 ECHO_IAP_YEARLY 不能一样');
  // 「通过 Apple 登录」的权限：要描述文件，只给签名的包。不写 = 有团队编号（要签名）才带
  const siwaRaw = String(env.ECHO_APPLE_SIGNIN || '').trim().toLowerCase();
  if (siwaRaw && !['1', '0', 'true', 'false', 'yes', 'no', 'on', 'off'].includes(siwaRaw)) throw new Error('ECHO_APPLE_SIGNIN 写 1 或 0');
  const appleSignIn = siwaRaw ? ['1', 'true', 'yes', 'on'].includes(siwaRaw) : !!team;
  if (appleSignIn && !team) warn.push('ECHO_APPLE_SIGNIN 开着但没有 ECHO_TEAM_ID：这个权限要签名，不签名的包装不上 / 编不过');

  const cfg = {
    edition,
    dashscopeKey: key,
    parentPinSalt: PIN_SALT,
    parentPinHash: hash,
    // 销售版只开放买了的学年的课本（不写就是七上、七下）；家庭版是空的 = 全部开放
    books: sales ? String(env.ECHO_BOOKS || DEFAULT_BOOKS).trim() : '',
    // 检查新版本的默认地址只打进家庭版；销售版没有（新版本走商店 / TestFlight）
    verUrl: sales ? '' : String(env.ECHO_VER_URL || props.VER_URL || DEFAULT_VER_URL).trim(),
    // 销售版不带中转服务（不替别的家庭跑服务器、不留聊天记录）
    talkUrl: sales ? '' : String(env.ECHO_TALK_URL || props.TALK_URL || '').trim(),
    talkCode: sales ? '' : String(env.ECHO_TALK_CODE || props.TALK_CODE || '').trim(),
    versionCode: code,
    versionName: name,
    // 订阅（Store.swift）和「通过 Apple 登录」（AppleSignIn.swift）
    iapMonthly,
    iapYearly,
    appleSignIn,
  };
  // 兜底：销售版里不许有密钥、家长密码、中转服务（和安卓的 checkReleaseConfig 一样）；商品编号要有（公开发的版本靠它收费）
  if (sales && (cfg.dashscopeKey || cfg.parentPinHash || cfg.talkUrl || cfg.talkCode || cfg.verUrl)) throw new Error('Sales edition must not contain a DashScope key, a baked parent PIN, a relay or an update URL.');
  if (sales && !(okProductId(cfg.iapMonthly) && okProductId(cfg.iapYearly))) throw new Error('Sales edition needs both subscription product ids.');

  const swift = '// 由 ios/scripts/make-config.mjs 生成，不要手改、不进仓库。\n' +
    '// 销售版里 dashscopeKey、parentPinHash、talkUrl、talkCode、verUrl 一定是空的。\n' +
    'enum BuildConfig {\n' +
    Object.entries(cfg).map(([k, v]) => '    static let ' + k + (typeof v === 'number' ? ': Int = ' + v : typeof v === 'boolean' ? ': Bool = ' + v : ' = ' + swiftStr(v))).join('\n') +
    '\n}\n';
  const xc = ['// 由 ios/scripts/make-config.mjs 生成，不要手改、不进仓库。',
    'CURRENT_PROJECT_VERSION = ' + code,
    'ECHO_BUNDLE_SUFFIX = ' + suffix,
    bundleId ? 'ECHO_BUNDLE_ID = ' + bundleId : '',
    team ? 'DEVELOPMENT_TEAM = ' + team : '',
    marketing ? 'MARKETING_VERSION = ' + marketing : '',
    // 只有签名的包带「通过 Apple 登录」的权限（路径相对 ios/）
    appleSignIn ? 'CODE_SIGN_ENTITLEMENTS = App/EchoIsland.entitlements' : '',
  ].filter(Boolean).join('\n') + '\n';
  return { cfg, swift, xcconfig: xc, warn, summary: 'edition ' + edition + '，版本 ' + name + '（' + code + '）' +
    '，密钥：' + (key ? '有' : '没有') + '，家长密码：' + (hash ? '有（只存哈希）' : '没有') + (sales ? '，课本 ' + cfg.books : '') +
    '，订阅 ' + iapMonthly + ' / ' + iapYearly + '，通过 Apple 登录：' + (appleSignIn ? '带' : '不带') };
}

function main(argv) {
  const arg = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
  const env = process.env;
  const edition = String(arg('edition') || env.ECHO_EDITION || 'sales').trim().toLowerCase();
  let props = {};
  if (edition === 'family') {      // 销售版不打开任何配置文件
    const file = arg('props') || env.ECHO_PROPS || [path.join(IOS, 'echo.properties'), path.join(ROOT, 'android', 'echo.properties')].find(f => fs.existsSync(f));
    if (file) { if (!fs.existsSync(file)) throw new Error('找不到配置文件 ' + file); props = readProps(file); }
  }
  const r = compute({ edition, props, env, release: argv.includes('--release') || env.ECHO_RELEASE === '1' });
  const out = path.resolve(arg('out') || path.join(IOS, 'Generated'));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'BuildConfig.swift'), r.swift);
  fs.writeFileSync(path.join(out, 'Echo.xcconfig'), r.xcconfig);
  console.log('make-config: ' + r.summary);
  for (const w of r.warn) console.warn('make-config: 注意：' + w);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('make-config: ' + e.message); process.exit(1); }
}
