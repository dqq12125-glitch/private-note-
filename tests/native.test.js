// 安卓原生部分的检查（不开浏览器、不用安卓手机，几秒钟）：node tests/native.test.js
// 1. MainActivity.java 里每个 @JavascriptInterface 方法：android/README.md 有说明、tests/fake-native.js 的假桥有同名同参数个数的方法
// 2. build.gradle：KEY_FILE 的密钥照旧进 BuildConfig（家长决定，手机上粘贴的优先）、PARENT_PIN 只放哈希、正式包找不到签名就停下（不退回调试签名）、版本号来自 git
// 3. 用 JDK 编译 PinGuard.java / BackupNames.java 真跑一遍：密码对错、错 5 次锁 10 分钟、改手机时钟解不开、重启后按手机时钟；
//    备份留最新 7 份、刚写的那份不删。哈希和 build.gradle 的算法（盐 + 密码的 SHA-256）一致。找不到 JDK 就跳过这一部分
// 4. 假桥本身的行为（tests/apk.test.js 之类的浏览器测试用它模拟 APK）
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AND = path.join(ROOT, 'android');
const SRC = path.join(AND, 'app/src/main/java/com/echoisland/app');
let fails = 0;
const check = (ok, what) => { console.log((ok ? '✓ ' : '✗ ') + what); if (!ok) fails++; return ok; };

// ---------- 1. 原生桥的方法：README、假桥都要对得上 ----------
const java = fs.readFileSync(path.join(SRC, 'MainActivity.java'), 'utf8');
const methods = {};
for (const m of java.matchAll(/@JavascriptInterface\s+public\s+[\w<>]+\s+(\w+)\s*\(([^)]*)\)/g)) {
  methods[m[1]] = m[2].trim() ? m[2].split(',').length : 0;
}
const want = { hasKey: 0, setKey: 1, setOrientation: 1, wsOpen: 2, wsSend: 2, wsClose: 1, post: 3,
  version: 0, diag: 0, takeRecovered: 0, hasPin: 0, checkPin: 1, pinStatus: 0, micPermission: 0, openAppSettings: 0,
  backupWrite: 1, backupList: 0, backupRead: 1, backupPick: 0, shareText: 2, shareFile: 3 };
for (const [n, c] of Object.entries(want)) check(methods[n] === c, `原生桥有 EchoNative.${n}（${c} 个参数）`);
check(Object.keys(methods).every(n => n in want), '原生桥没有没登记的方法：' + Object.keys(methods).filter(n => !(n in want)).join(', '));

const readme = fs.readFileSync(path.join(AND, 'README.md'), 'utf8');
const undocumented = Object.keys(methods).filter(n => !readme.includes('`' + n + '('));
check(!undocumented.length, 'android/README.md 写了每个方法' + (undocumented.length ? '（缺 ' + undocumented.join(', ') + '）' : ''));

const FN = require('./fake-native');
const ctx = { window: null, setTimeout, TextEncoder, Date, JSON, Math, String, Object };
ctx.window = ctx;
const events = [];
ctx.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } };
ctx.dispatchEvent = e => events.push(e);
vm.createContext(ctx);
vm.runInContext('(' + FN.install.toString() + ')', ctx)({ pin: '2468' });
const fake = ctx.EchoNative, FS = ctx.__fakeNative;
const fakeDiff = Object.keys(want).filter(n => typeof fake[n] !== 'function' || fake[n].length !== methods[n])
  .concat(Object.keys(fake).filter(n => !(n in methods)));
check(!fakeDiff.length, 'tests/fake-native.js 的方法和原生一一对应' + (fakeDiff.length ? '（对不上：' + fakeDiff.join(', ') + '）' : ''));

// ---------- 2. build.gradle 和清单 ----------
const gradle = fs.readFileSync(path.join(AND, 'app/build.gradle'), 'utf8');
check(!/signingConfigs\.debug/.test(gradle), 'release 包不再退回调试签名');
check(/if \(!hasSigning\) throw new GradleException/.test(gradle) && /t\.name == 'preReleaseBuild'\) t\.dependsOn 'checkReleaseConfig'/.test(gradle),
  '找不到正式签名时 release 包报错停下（checkReleaseConfig 挂在 preReleaseBuild 前面）');
check(/if \(!pinHash\) throw new GradleException/.test(gradle), 'release 包没有家长密码就停下');
check(/buildConfigField 'String', 'PARENT_PIN_HASH', q\(pinHash\)/.test(gradle) && !/buildConfigField[^\n]*getProperty\('PARENT_PIN'\)/.test(gradle),
  'BuildConfig 只放家长密码的哈希，不放原文');
check(/buildConfigField 'String', 'DASHSCOPE_KEY', q\(bakedKey\)/.test(gradle) && /def bakedKey = keyFromFile\(\)/.test(gradle)
  && !/ALLOW_KEY_IN_APK|allowKey/.test(gradle), 'KEY_FILE 的密钥照旧写进 BuildConfig.DASHSCOPE_KEY（家长决定），正式包不因此停下');
check(/prefs\.getString\("key", ""\)[\s\S]{0,80}BuildConfig\.DASHSCOPE_KEY/.test(java), '手机上粘贴的密钥优先，没有才用打包时的');
check(/versionCode vCode/.test(gradle) && /'rev-list', '--count', 'HEAD'/.test(gradle) && /--no-optional-locks/.test(gradle),
  '版本号来自 git 提交数（只读，不抢 index.lock），有退路');
const salt = (gradle.match(/def PIN_SALT = '([^']+)'/) || [])[1];
check(!!salt && /BuildConfig\.PARENT_PIN_SALT, BuildConfig\.PARENT_PIN_HASH/.test(java), 'Java 用的是 build.gradle 的同一个盐');
const example = fs.readFileSync(path.join(AND, 'echo.properties.example'), 'utf8');
check(/^KEY_FILE=\S*game-key\.env\s*$/m.test(example) && !/ALLOW_KEY_IN_APK/.test(example) && /^PARENT_PIN=\s*$/m.test(example),
  'echo.properties.example：KEY_FILE 指向游戏专用密钥文件、PARENT_PIN 留空待填');
const manifest = fs.readFileSync(path.join(AND, 'app/src/main/AndroidManifest.xml'), 'utf8');
check(/android:name="\.ShareProvider"[\s\S]*?android:exported="false"[\s\S]*?android:grantUriPermissions="true"/.test(manifest), '分享用的 ShareProvider 不对外公开、只发一次性读权限');
check(/WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28"/.test(manifest), '存储权限只在安卓 9 及以下要');
check(/onRenderProcessGone/.test(java) && /renderGone\(view/.test(java), '渲染进程挂了重建 WebView（onRenderProcessGone）');
check(/shouldShowRequestPermissionRationale/.test(java) && /ACTION_APPLICATION_DETAILS_SETTINGS/.test(java), '麦克风区分这次拒绝 / 永久拒绝，能跳到设置页');

// ---------- 3. 用 JDK 真跑 PinGuard / BackupNames ----------
const jdks = [process.env.JAVA_HOME, 'D:/Claude/tools/android/jdk-17.0.20.1+1'].filter(Boolean);
const jdk = jdks.find(d => fs.existsSync(path.join(d, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac')));
if (!jdk) console.log('- 找不到 JDK（JAVA_HOME），跳过 PinGuard / BackupNames 的实测');
else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-native-'));
  const pkg = path.join(dir, 'src/com/echoisland/app');
  fs.mkdirSync(pkg, { recursive: true });
  for (const f of ['PinGuard.java', 'BackupNames.java']) fs.copyFileSync(path.join(SRC, f), path.join(pkg, f));
  fs.writeFileSync(path.join(pkg, 'Harness.java'), `package com.echoisland.app;
import java.util.*;
public class Harness {
  static Map<String, Long> m = new HashMap<>();
  static long wall = 1_790_000_000_000L, elapsed = 3_600_000L, boot = 7;
  static void out(String k, Object v) { System.out.println(k + "=" + v); }
  static PinGuard.Store st = new PinGuard.Store() {
    public long getLong(String k, long d) { Long v = m.get(k); return v == null ? d : v; }
    public void putLongs(String[] ks, long[] vs) { for (int i = 0; i < ks.length; i++) m.put(ks[i], vs[i]); }
  };
  static PinGuard.Clock ck = new PinGuard.Clock() {
    public long wall() { return wall; } public long elapsed() { return elapsed; } public long boot() { return boot; }
  };
  static void wrong(PinGuard g, int n) { for (int i = 0; i < n; i++) g.check("0000"); }
  public static void main(String[] a) {
    String salt = a[0], hash = a[1], pin = a[2];
    out("hash", PinGuard.sha256Hex(salt + pin));
    PinGuard none = new PinGuard(salt, "", st, ck);
    out("none.has", none.has()); out("none.check", none.check(pin));
    PinGuard g = new PinGuard(salt, hash, st, ck);
    out("has", g.has()); out("right", g.check(pin)); out("empty", g.check("")); out("emptyLeft", g.triesLeft());
    wrong(g, 4); out("left4", g.triesLeft()); out("rightAfter4", g.check(pin)); out("leftReset", g.triesLeft());
    wrong(g, 5); out("locked", g.statusJson()); out("rightWhileLocked", g.check(pin));
    wall += 24L * 3600_000; out("clockForward", g.waitMs() > 0);          // 同一次开机：把手机时钟往后调没用
    elapsed += 9 * 60_000; out("after9", g.waitMs() > 0);
    elapsed += 61_000; out("after10", g.waitMs() > 0); out("rightAfterLock", g.check(pin));
    wrong(g, 5); boot = 8; elapsed = 1_000; wall += 5 * 60_000;          // 重启过：按手机时钟，还剩 5 分钟
    out("rebootWait", (g.waitMs() + 999) / 1000);
    wall += 6 * 60_000; out("rebootAfter", g.waitMs() > 0);
    wrong(g, 5); boot = 9; wall -= 24L * 3600_000;                       // 重启 + 时钟往回调一天：最多锁 10 分钟
    out("backWait", (g.waitMs() + 999) / 1000);
    out("final", g.statusJson());
    // 备份文件名
    out("forDay", BackupNames.forDay("20261007"));
    out("valid", BackupNames.valid("echo-save-20261007.json") + "," + BackupNames.valid("echo-save-20261007 (1).json") + "," +
        BackupNames.valid("../echo-save-20261007.json") + "," + BackupNames.valid("echo-save-2026107.json") + "," + BackupNames.valid("echo-save-20261007.json.tmp"));
    List<BackupNames.Item> ten = new ArrayList<>();
    for (int d = 1; d <= 10; d++) ten.add(new BackupNames.Item(d, String.format("echo-save-202610%02d.json", d), 100 + d, d * 1000L));
    StringBuilder del = new StringBuilder();
    for (BackupNames.Item it : BackupNames.toDelete(ten, "echo-save-20261010.json")) del.append(it.id).append(' ');
    out("del10", del.toString().trim());
    List<BackupNames.Item> fut = new ArrayList<>(ten);                    // 有一份是日期被往后调时写的（2027 年），刚写的是 10/3
    fut.add(new BackupNames.Item(99, "echo-save-20271231.json", 5, 1L));
    del = new StringBuilder();
    for (BackupNames.Item it : BackupNames.toDelete(fut, "echo-save-20261003.json")) del.append(it.id).append(' ');
    out("delFuture", del.toString().trim());
    List<BackupNames.Item> dup = new ArrayList<>();
    dup.add(new BackupNames.Item(1, "echo-save-20261007.json", 10, 1000L));
    dup.add(new BackupNames.Item(2, "echo-save-20261007 (1).json", 20, 2000L));
    dup.add(new BackupNames.Item(3, "echo-save-20261006.json", 30, 3000L));
    dup.add(new BackupNames.Item(4, "notes.json", 1, 1L));
    out("list", BackupNames.listJson(dup));
  }
}
`);
  const bin = f => path.join(jdk, 'bin', f + (process.platform === 'win32' ? '.exe' : ''));
  const TEST_PIN = '2468';
  const hash = crypto.createHash('sha256').update(salt + TEST_PIN, 'utf8').digest('hex');
  let r = {};
  try {
    execFileSync(bin('javac'), ['-encoding', 'UTF-8', '-d', path.join(dir, 'out'), ...['PinGuard', 'BackupNames', 'Harness'].map(n => path.join(pkg, n + '.java'))], { stdio: 'pipe' });
    const txt = execFileSync(bin('java'), ['-cp', path.join(dir, 'out'), 'com.echoisland.app.Harness', salt, hash, TEST_PIN], { encoding: 'utf8' });
    for (const line of txt.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) r[line.slice(0, i)] = line.slice(i + 1); }
    check(true, 'PinGuard / BackupNames 用 JDK 编译通过');
  } catch (e) {
    check(false, 'PinGuard / BackupNames 编译运行失败：' + (e.stderr ? e.stderr.toString() : e.message));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const J = k => { try { return JSON.parse(r[k]); } catch (e) { return {}; } };
  check(r.hash === hash, 'Java 算的哈希 = build.gradle 的算法（盐 + 密码的 SHA-256）');
  check(r['none.has'] === 'false' && r['none.check'] === 'false', '打包时没设家长密码：hasPin() false，checkPin 一律 false（不能「谁先点谁设」）');
  check(r.has === 'true' && r.right === 'true', '密码对了 checkPin 是 true');
  check(r.empty === 'false' && r.emptyLeft === '5', '空密码不算一次');
  check(r.left4 === '1' && r.rightAfter4 === 'true' && r.leftReset === '5', '错 4 次还剩 1 次，输对就清零');
  const L = J('locked');
  check(L.locked === true && L.waitSec === 600 && L.triesLeft === 0 && L.lockouts === 1 && L.lastLock > 0, '连续错 5 次锁 10 分钟（pinStatus 有 waitSec、lockouts）');
  check(r.rightWhileLocked === 'false', '锁着的时候对的密码也不放行');
  check(r.clockForward === 'true' && r.after9 === 'true', '同一次开机把手机时钟往后调解不开锁');
  check(r.after10 === 'false' && r.rightAfterLock === 'true', '10 分钟后解锁');
  check(r.rebootWait === '300' && r.rebootAfter === 'false', '重启以后按手机时钟算剩下的时间');
  check(r.backWait === '600', '重启 + 手机时钟往回调：最多锁 10 分钟');
  check(J('final').lockouts === 3, '被锁过几次记着（周报用）');
  check(r.forDay === 'echo-save-20261007.json', '备份文件名 echo-save-YYYYMMDD.json');
  check(r.valid === 'true,true,false,false,false', '只认 echo-save-YYYYMMDD(.json / (n).json)，路径和别的名字一律不认');
  check(r.del10 === '3 2 1', '10 份备份删掉最旧的 3 份，留 7 份');
  check(r.delFuture === '5 4 2 1', '刚写的那份不是最新的（手机日期被调过）也不删，共留 7 份');
  const list = J('list');
  check(Array.isArray(list) && list.length === 3 && list[0].name === 'echo-save-20261007 (1).json' && list[1].name === 'echo-save-20261007.json' &&
    list[2].date === '2026-10-06' && list[2].size === 30 && list[0].time === 2000, 'backupList：新的在前，{name, date, size, time}，别的文件不列');
}

// ---------- 4. 假桥的行为 ----------
(async () => {
  check(fake.hasPin() && !fake.checkPin('1111') && fake.checkPin('2468'), '假桥：家长密码');
  for (let i = 0; i < 5; i++) fake.checkPin('0000');
  const st = JSON.parse(fake.pinStatus());
  check(st.locked && st.waitSec === 600 && !fake.checkPin('2468'), '假桥：错 5 次锁 10 分钟');
  const t0 = FS.now(); FS.now = () => t0 + 600001;
  check(fake.checkPin('2468'), '假桥：10 分钟后解锁');
  for (let d = 1; d <= 9; d++) { FS.now = () => new Date(2026, 9, d, 12).getTime(); fake.backupWrite('{"day":' + d + '}'); }
  const bl = JSON.parse(fake.backupList());
  check(bl.length === 7 && bl[0].name === 'echo-save-20261009.json' && bl[0].date === '2026-10-09' && fake.backupRead(bl[0].name) === '{"day":9}', '假桥：备份留最新 7 份');
  check(!fake.backupWrite('not json') && fake.backupRead('../x') === '', '假桥：不是存档不写、乱名字不读');
  FS.mic = 'blocked'; FS.micAfterSettings = 'granted';
  check(fake.micPermission() === 'blocked' && fake.openAppSettings(), '假桥：麦克风永久拒绝 → 去设置');
  FS.key = '';
  const got = [];
  ctx.__echoNative = (id, type, data) => got.push([id, type, data]);
  fake.post(5, 'https://dashscope.aliyuncs.com/x', '{}');
  fake.wsOpen(6, 'wss://dashscope.aliyuncs.com/x');
  await new Promise(r => setTimeout(r, 20));
  check(events.some(e => e.type === 'echo-mic' && e.detail === 'granted'), '假桥：从设置回来发 echo-mic 事件');
  check(got.some(g => g[0] === 5 && g[1] === 'fail' && /InvalidApiKey/.test(g[2])) && got.some(g => g[0] === 6 && g[1] === 'error' && /HTTP 401/.test(g[2])),
    '假桥：没密钥时和原生一样回 401 / InvalidApiKey');
  check(JSON.parse(fake.version()).code > 0 && fake.shareText('t', 'x'.repeat(9000)) && FS.shared[0].file, '假桥：版本号、太长的文字改成文件分享');
  console.log(fails ? `\n✗ ${fails} 项没过` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})();
