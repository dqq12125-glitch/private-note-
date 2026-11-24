// 销售版（2026-10-07，评估「必须改」第 3、4、5、7、8、10 条）的端到端测试：假的安卓原生桥（tests/fake-native.js，edition 'sales'、没有打包的密码和密钥）+ ?edition=sales
// - 家长首次设置向导（顺序和销售流程一致：查完设备再付款，再设密码和密钥）：① 欢迎 / AI 说明 / 隐私要点 / 监护人单独同意（全文页）
//   ② 设备检查（安卓版本、WebView、WebGL2、剩余空间 ≥1GB、麦克风）的合格 / 不合格（不合格不能往下走、不提付款）
//   ③ 家长密码（太好猜的不要、两次要一样、原生 setPin 存好）
//   ④ AI 密钥：「测试」真的发一个最小的请求，分清不像密钥 / 密钥不对 / 欠费 / 没开通 / 能用；「怎么开通？」打开教程页；密钥不留在网页里
//   ⑤ 家庭定制：昵称校验（只能英文、像真名的拼音要确认）、预设部件拼形象、约 50 只原创伙伴里挑 3 只（没有保留的撞脸怪兽）、家人当 NPC ⑥ 完成 → 把手机交给孩子
// - 定制在 App 里生效：开场渡轮上念家长填好的通行证（不再选照片、起名）、家里是挑的家人（每天对他们说一句英语）、三个贝壳里是挑的 3 只、主角形象
// - 课本单元只开放本学年（七上、七下）；忘了家长密码：导出存档 → 清除数据 → 重新设置 → 从备份恢复，进度回来
// - AI 标识：聊天页顶上「AI 生成」（不写是哪家的模型）、每天第一次聊天开头写一句提示（不用语音念）；没有配音的句子用阿里云 qwen3-tts-flash，不再连有道
// - 周报 AI 花费按 qwen3.8-omni-flash-realtime 北京区现价；开源许可与致谢页；销售版改家长密码、改家庭定制；家庭版不出向导
// - iPhone 版（假桥 platform: 'ios'）：② 设备检查是 iOS 版本 + 机型（最低 18.4）、WebGL2、空间、麦克风，没有安卓的字；中文、英语界面各走一遍；横屏 844×390 按钮不压在内容上
// 运行：node tests/sales.test.js（大约 1–2 分钟）。和 tests/apk.test.js 一样起一个本机小网站（http://echo.localhost:端口），外面的网址一律挡掉
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const FN = require('./fake-native');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8' };
function serve() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]), f = path.normalize(path.join(ROOT, u === '/' ? 'index.html' : u));
    if (!f.startsWith(ROOT) || /[\\/](android|server|node_modules|art)[\\/]/.test(f.slice(ROOT.length))) { res.writeHead(404); res.end(); return; }
    fs.readFile(f, (e, data) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
let fails = 0;
const check = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 600) : '')); if (!ok) fails++; };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());
const KEY = 'sk-' + 'test0Key1Never2Print3'.repeat(2);   // 假的密钥：检查它不进网页的存储、不进控制台

// 假原生桥的家长密码、密钥、开关跨刷新保留（真手机上存在原生里）；假的阿里云：按模型名回 window.__route 里写好的结果
function keep() {
  const F = window.__fakeNative; if (!F) return;
  try { Object.assign(F, JSON.parse(localStorage.getItem('__fakeOpts') || '{}')); } catch (e) { /* 忽略 */ }
  const N = window.EchoNative, store = () => { try { const o = JSON.parse(localStorage.getItem('__fakeOpts') || '{}'); o.pin = F.pin; o.key = F.key; localStorage.setItem('__fakeOpts', JSON.stringify(o)); } catch (e) { /* 忽略 */ } };
  const sp = N.setPin, sk = N.setKey;
  N.setPin = p => { const r = sp(p); store(); return r; };
  N.setKey = k => { sk(k); store(); };
  window.__posts = [];
  F.onPost = (id, url, body, cb) => {
    let m = ''; try { m = JSON.parse(body).model || ''; } catch (e) { /* 忽略 */ }
    window.__posts.push({ url, model: m });
    const r = (window.__route || {})[m];
    if (r) setTimeout(() => cb(id, r.type, typeof r.data === 'string' ? r.data : JSON.stringify(r.data)), 10);
    else cb(id, 'fail', 'HTTP 500');
  };
}
// 假麦克风：deny 不让用，别的给一个有声音的假话筒
function fakeMic() {
  const md = navigator.mediaDevices; if (!md) return;
  md.getUserMedia = async () => {
    if (localStorage.getItem('__mic') === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
    const ac = new AudioContext(), dest = ac.createMediaStreamDestination(), osc = ac.createOscillator();
    osc.connect(dest); osc.start();
    return dest.stream;
  };
}

(async () => {
  const srv = await serve();
  const HOST = 'http://echo.localhost:' + srv.address().port;
  const PAGE = HOST + '/index.html?edition=sales';
  const b = await chromium.launch(Object.assign({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  const outside = [];
  await ctx.route(u => !u.href.startsWith(HOST), r => { outside.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [], logs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => logs.push(m.text()));
  await p.addInitScript(FN.install, { edition: 'sales', pin: null, key: '', net: 'ok', mic: 'granted' });
  await p.addInitScript(keep);
  await p.addInitScript(fakeMic);
  const W = ms => p.waitForTimeout(ms);
  const E = (f, a) => p.evaluate(f, a);
  const until = async (fn, max = 60, gap = 150) => { for (let i = 0; i < max; i++) { if (await fn()) return true; await W(gap); } return false; };
  const fake = o => E(o => { Object.assign(window.__fakeNative, o); const k = JSON.parse(localStorage.getItem('__fakeOpts') || '{}'); localStorage.setItem('__fakeOpts', JSON.stringify(Object.assign(k, o))); }, o);
  const route = r => E(r => { window.__route = r; }, r);
  const box = () => p.textContent('#su-box').catch(() => '');
  const step = () => E(() => { const s = document.querySelector('#su-box .su-step'); return s ? s.dataset.step : ''; });
  const next = async () => { await p.click('#su-next'); await W(250); };
  const S = () => E(() => window.EchoGame.S);

  // ---------- 0. 第一次打开：直接是家长首次设置 ----------
  await p.goto(PAGE);
  await E(() => { localStorage.clear(); });
  await p.reload();
  check(await until(() => E(() => !!document.querySelector('#setup'))), '销售版第一次打开：出现「家长首次设置」向导');
  check(await E(() => window.DEX.sales && window.EchoNative.edition() === 'sales' && !window.EchoNative.hasPin() && !window.EchoNative.hasKey()), '销售版：原生说 sales，没有打包的家长密码和密钥');
  check(await step() === 'welcome' && await p.locator('.su-tabs li').count() === 6, '① 欢迎页，上面 6 步进度');
  let t = await box();
  check(/人工智能/.test(t) && !/通义千问/.test(t) && /只存在这台手机里/.test(t) && /您自己的阿里云账号/.test(t) && /英文昵称/.test(t) && /练英语听说的软件/.test(t) && !/游戏/.test(t), '欢迎页（对家长说「软件」，不说「游戏」）：AI 说明（阿里云通义千问）+ 隐私要点', t.slice(0, 300));
  check(await p.isDisabled('#su-next'), '没勾同意不能往下走');
  await p.screenshot({ path: out + '/sales-1-welcome.png' });
  // 全文页
  await p.click('[data-act=suDoc][data-doc=privacy]'); await W(400);
  const docText = async () => { const f = p.frameLocator('#su-doc iframe'); return f.locator('body').textContent({ timeout: 4000 }).catch(() => ''); };
  check(/儿童隐私说明/.test(await docText()) && /阿里云百炼/.test(await docText()), '《儿童隐私说明》全文页打得开（打包在 pages/）');
  await p.click('[data-act=suDocClose]'); await W(150);
  await p.click('[data-act=suDoc][data-doc=consent]'); await W(400);
  check(/单独/.test(await docText()) && /撤回同意/.test(await docText()), '《监护人同意书》全文页（单独同意、可以撤回）');
  check(await E(() => window.EchoBack()) && !(await p.$('#su-doc')), '返回键先关掉全文页');
  await p.click('#su-consent'); await W(150);
  const F = () => E(() => window.EchoGame.S.settings.family);
  check(!(await p.isDisabled('#su-next')) && (await F()).consent.v === await E(() => window.EchoSetup.DOC_V) && (await F()).consent.at > 0, '勾了同意：记下同意的时间和文书版本，可以往下走');
  await next();

  // ---------- ② 设备检查（第二步：合格了才付款） ----------
  check(await step() === 'device', '② 设备检查（紧跟在欢迎页后面）');
  check(await until(() => E(() => !!document.querySelector('#su-verdict'))), '检查完给结论');
  const rows = () => E(() => Object.fromEntries([...document.querySelectorAll('.su-dev li[data-k]')].map(li => [li.dataset.k, li.className])));
  let r = await rows();
  check(r.android === 'ok' && r.storage === 'ok' && r.mic === 'ok' && 'webgl2' in r && 'webview' in r, '安卓版本、剩余空间、麦克风合格；也查了 WebGL2 和 WebView', r);
  check(!/不合格/.test(await p.textContent('#su-verdict')), '这台设备合格（或者能玩）', await p.textContent('#su-verdict'));
  check(/付款链接/.test(await box()) && !(await p.isDisabled('#su-next')), '合格：提示这时候付款（00 号第 8 步），可以往下走');
  await fake({ storage: { free: 5e8, total: 64e9, ram: 4e9 } });
  await p.click('[data-act=suDevRun]');
  await until(() => E(() => !!document.querySelector('#su-verdict')));
  r = await rows();
  check(r.storage === 'bad' && /不合格/.test(await p.textContent('#su-verdict')) && /1 GB/.test(await box()), '剩余空间不到 1GB：不合格，说清楚怎么办');
  check(await p.isDisabled('#su-next') && !/付款链接/.test(await box()) && /不收费/.test(await box()), '不合格：不能往下走、不提付款（不过不收钱）');
  await E(() => localStorage.setItem('__mic', 'deny')); await fake({ storage: { free: 8e9, total: 128e9, ram: 12e9 }, mic: 'blocked' });
  await p.click('[data-act=suDevRun]');
  await until(() => E(() => !!document.querySelector('#su-verdict')));
  r = await rows();
  check(r.mic === 'bad' && /被永久拒绝/.test(await box()) && await p.isVisible('[data-act=suMicFix]'), '麦克风被拒：不合格，给「去打开」');
  await E(() => localStorage.setItem('__mic', 'ok')); await fake({ mic: 'granted' });
  await p.click('[data-act=suDevRun]');
  await until(() => E(() => !!document.querySelector('#su-verdict')));
  check((await rows()).mic === 'ok' && (await F()).device.ok !== 'bad', '重新检查：好了');
  await p.screenshot({ path: out + '/sales-5-device.png' });
  await next();

  // ---------- ③ 家长密码 ----------
  check(await step() === 'pin' && await p.isDisabled('#su-next'), '③ 家长密码：必须设，没设不能往下走');
  const pinKeys = async ds => { for (const d of ds) await p.click('#su-box [data-act=suPin][data-k="' + d + '"]'); await W(350); };
  await pinKeys('1111');
  check(/太好猜/.test(await p.textContent('#su-pin-msg')), '1111 太好猜，不要');
  await pinKeys('3691'); await pinKeys('3692');
  check(/两次不一样/.test(await p.textContent('#su-pin-msg')), '两次不一样：重新设');
  await pinKeys('3691'); await pinKeys('3691');
  let fk = await E(() => ({ pin: window.__fakeNative.pin, calls: window.__fakeNative.calls.filter(c => c === 'setPin').length, has: window.EchoNative.hasPin() }));
  check(fk.pin === '3691' && fk.calls >= 1 && fk.has, '密码交给原生存（EchoNative.setPin），hasPin() 变成 true', fk);
  check(/已经设好了/.test(await box()) && !(await p.isDisabled('#su-next')), '设好了：可以往下走');
  check(await E(() => !window.EchoGame.S.settings.pin && !/"pin":"3691"/.test(localStorage.getItem('echo-island-v1') || '')), '网页的存档里没有家长密码');
  await next();

  // ---------- ④ AI 密钥 ----------
  check(await step() === 'key' && /您自己的阿里云百炼账号/.test(await box()), '④ AI 密钥：说明用的是家长自己的阿里云账号');
  await p.click('[data-act=suDoc][data-doc=guide]'); await W(400);
  t = await docText();
  check(/API Key/.test(t) && /实名认证/.test(t) && /开通服务/.test(t) && /费用预警|余额预警/.test(t), '「怎么开通？」打开图文教程（实名认证、开通服务、费用预警、创建 API Key）');
  await p.click('[data-act=suDocClose]'); await W(150);
  const keyTest = async (k, r) => { if (r) await route({ 'qwen-plus': r }); await p.fill('#su-key', k); await p.click('#su-key-test'); await until(() => E(() => !!document.querySelector('#su-key-res p'))); return p.textContent('#su-key-res'); };
  check(/不像百炼的 API Key/.test(await keyTest('hello')), '不像密钥（不是 sk- 开头）：直接说，不去连');
  check(/密钥不对/.test(await keyTest(KEY, { type: 'fail', data: { code: 'InvalidApiKey', message: 'Invalid API-key provided.' } })), '阿里云说 InvalidApiKey：「密钥不对」');
  check(/欠费或额度用完/.test(await keyTest(KEY, { type: 'fail', data: { code: 'Arrearage', message: 'Access denied, please make sure your account is in good standing.' } })), '阿里云说 Arrearage：「欠费或额度用完」');
  check(/还没开通/.test(await keyTest(KEY, { type: 'fail', data: { code: 'AccessDenied.Unpurchased', message: 'Access to model denied.' } })), '没开通服务：「还没开通」');
  t = await keyTest(KEY, { type: 'ok', data: { choices: [{ message: { content: 'H' } }], usage: { prompt_tokens: 9, completion_tokens: 1 } } });
  check(/密钥能用/.test(t), '能用：「✅ 密钥能用」', t);
  let k = await E(() => ({ key: window.__fakeNative.key, posts: window.__posts.filter(x => x.model === 'qwen-plus').length, input: document.querySelector('#su-key').value, ok: window.EchoGame.S.settings.family.keyOk }));
  check(k.key.length > 20 && k.posts === 4 && k.input === '' && k.ok === TODAY, '密钥存进原生（setKey），测试真的发了请求；能用以后输入框清空', { posts: k.posts, input: k.input.length, ok: k.ok });
  const leak = await E(K => Object.keys(localStorage).filter(x => x !== '__fakeOpts' && String(localStorage.getItem(x)).includes(K)), KEY);
  check(!leak.length && !logs.some(l => l.includes(KEY)), '密钥不进网页的存储、不进控制台日志', leak);
  await p.screenshot({ path: out + '/sales-3-key.png' });
  await next();

  // ---------- ⑤ 家庭定制 ----------
  check(await step() === 'nick', '⑤ 家庭定制 1/3：昵称和形象');
  await p.fill('#su-nick', 'Tom1');
  check(/只能用英文字母/.test(await p.textContent('#su-nick-msg')), '昵称只能用英文字母');
  await p.click('#su-next'); await W(200);
  check(await step() === 'nick', '昵称不对不能往下走');
  await p.fill('#su-nick', 'Zhang Wei');
  check(/像中文名字的拼音/.test(await p.textContent('#su-nick-msg')), '像真名的拼音（Zhang Wei）：提醒用英文昵称');
  await p.click('#su-next'); await W(200);
  check(await step() === 'nick', '像真名的不确认就不能往下走');
  await p.fill('#su-nick', 'kevin');
  check(/App 里叫：Kevin/.test(await p.textContent('#su-nick-msg')), '普通的英文名：首字母大写（Kevin）');
  const img0 = await p.getAttribute('#su-av-img', 'src');
  for (const [pp, v] of [['g', 'girl'], ['style', 'long'], ['hair', '3'], ['cloth', '2'], ['hat', 'none']]) { await p.click('#su-box [data-act=suPart][data-p="' + pp + '"][data-v="' + v + '"]'); await W(80); }
  check(await p.getAttribute('#su-av-img', 'src') !== img0 && await p.inputValue('#su-nick') === 'Kevin', '换部件：预览跟着变，昵称不丢');
  await next();
  check(await step() === 'mons', '⑤ 家庭定制 2/3：挑伙伴');
  const lib = await E(() => [...document.querySelectorAll('#su-box .su-mon')].map(b => b.dataset.id).map(id => ({ id, res: window.DEX.reserved(id), base: window.DEX.isBase(window.DEX.byId[id]), type: window.DEX.byId[id].type, legend: !!window.DEX.byId[id].legend })));
  check(lib.length >= 45 && lib.length <= 55, '伙伴库大约 50 只', lib.length);
  check(lib.every(x => !x.res && x.base && !x.legend && ['fire', 'water', 'grass', 'spark'].includes(x.type)), '伙伴库：都是原创第一阶、没有保留的撞脸怪兽、没有神兽，只有火水草电');
  const pick = ['fire', 'water', 'spark'].map(tp => lib.filter(x => x.type === tp)[1].id);
  for (const id of pick) { await p.click('#su-box [data-act=suMon][data-id="' + id + '"]'); await W(120); }
  const fourth = lib.find(x => !pick.includes(x.id)).id;
  check(await p.isDisabled('#su-box [data-act=suMon][data-id="' + fourth + '"]') && /已选 3/.test(await p.textContent('#su-count')), '选满 3 只：别的不能再点');
  await next();
  check(await step() === 'fam', '⑤ 家庭定制 3/3：家里的人');
  await p.click('#su-box [data-act=suFamAdd][data-rel=dad]'); await W(100);
  await p.click('#su-box [data-act=suFamAdd][data-rel=grandma]'); await W(100);
  await p.click('#su-box [data-act=suFamLook][data-i="1"][data-v="2"]'); await W(100);
  check(JSON.stringify((await F()).members) === JSON.stringify([{ rel: 'dad', look: 0 }, { rel: 'grandma', look: 2 }]), '家人：Dad、Grandma（换了造型）', (await F()).members);
  await p.screenshot({ path: out + '/sales-4-family.png' });
  await next();

  // ---------- ⑥ 完成 ----------
  t = await box();
  check(await step() === 'done' && /Kevin/.test(t) && /Dad、Grandma/.test(t) && /测试通过/.test(t), '⑥ 完成：汇总（昵称、伙伴、家人、密钥、设备）', t.slice(0, 300));
  await p.click('[data-act=suFinish]'); await W(500);
  const st = await E(() => ({ setup: !!document.querySelector('#setup'), intro: /欢迎来到回声岛/.test(document.querySelector('#sheet').textContent), S: window.EchoGame.S, starters: window.MonsterGame.STARTERS.slice(), girl: Object.assign({}, window.EchoPeople.LOOKS.girl) }));
  check(!st.setup && st.intro, '「把手机交给孩子」：向导关掉，给孩子看游戏说明');
  check(st.S.settings.family.done === TODAY && st.S.player.name === 'Kevin' && st.S.player.gender === 'girl' && st.S.micCheck === TODAY, '昵称、性别写进存档；家长测过密钥和麦克风，孩子不用再做小检查', { p: st.S.player, mc: st.S.micCheck });
  check(JSON.stringify(st.starters) === JSON.stringify(pick), '博士的包（MonsterGame.STARTERS）换成挑的 3 只', st.starters);
  check(st.girl.style === 'long' && !st.girl.hat, '主角形象换成家长拼的（长发、不戴帽子）');
  await p.click('[data-act=introGo]'); await W(300);
  // 再打开：不再出向导，定制照样生效
  await p.reload();
  await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden);
  await W(400);
  check(!(await p.$('#setup')) && await E(p => JSON.stringify(window.MonsterGame.STARTERS) === p && window.EchoPeople.LOOKS.girl.style === 'long', JSON.stringify(pick)), '再打开：不再出向导，伙伴和形象照样是定制的');

  // ---------- 定制在冒险里：开场、家里的人、博士的包 ----------
  await E(() => { const s = window.EchoGame.S.settings; s.gate = false; s.mode = 'self'; s.tts = 'online'; s.gfx = '2d'; s.music = 'off'; s.limit = Object.assign({}, s.limit, { on: false }); window.EchoGame.A.save(); });
  await p.reload();
  await p.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await W(300);
  await p.click('[data-act=wEnter]'); await W(900);
  const dbg = () => E(() => { const d = window.EchoWorld._debug(); const pg = d.dlg && d.dlg.pages[d.dlg.i]; return { map: d.M.id, dlg: !!d.dlg, busy: d.busy, en: pg ? pg.en : '', who: pg ? pg.who : '', kind: pg ? pg.kind : '' }; });
  const A = () => E(() => document.querySelector('#world [data-act=wA].ba').click());
  const seen = [];
  // 一直按 A（说话任务点「我说完了」），直到剧情播完
  const play = async max => {
    for (let i = 0; i < (max || 80); i++) {
      const d = await dbg();
      if (d.dlg) { if (d.en && !seen.includes(d.en)) seen.push(d.en); }
      if (!d.busy && !d.dlg) return;
      if (await p.$('#w-dlg [data-act=wSelfDone]')) { await p.click('#w-dlg [data-act=wSelfDone]'); await W(350); continue; }
      if (d.dlg) { for (let k = 0; k < 20 && await E(() => { const x = window.EchoWorld._debug().dlg; return !!(x && x.typing); }); k++) await W(80); await A(); }
      await W(220);
    }
  };
  await play();
  const fl = await E(() => window.EchoGame.S.world.flags);
  check(fl['s:intro'] && fl['s:mom'] && (await dbg()).map === 'i0H', '开场演完（在家里醒来）');
  check(seen.some(x => /Island Pass/.test(x)) && seen.some(x => /My name is (\{name\}|Kevin)/.test(x)) && !seen.some(x => /Welcome to the Echo Islands|People call me|You must be/.test(x)) && !(await p.$('.nm-grid')), '开场：渡轮上念家长填好的通行证（不再选照片、起名字，也不是博士的自我介绍）', seen.slice(0, 8));
  const home = await E(() => { const d = window.EchoWorld._debug(); return { npcs: d.M.npcs.map(n => ({ role: n.role, fam: n.fam, name: n.name, x: n.x, y: n.y })), look: window.EchoStory.look({ map: { id: 'i0H', isle: 0 } }, { role: 'house' }) }; });
  check(home.look && home.look.name === 'Dad', '家里本来那位（妈妈的位置）换成挑的第一位家人 Dad', home.look);
  const gm = home.npcs.find(n => n.fam === 'grandma');
  check(!!gm && gm.name === 'Grandma' && !home.npcs.some(n => n.fam === 'dad'), 'Grandma 站在家里（Dad 不重复出现）', home.npcs);
  check(seen.some(x => /Good morning, (\{name\}|Kevin)/.test(x)), '家里的人叫醒孩子', seen);
  await p.screenshot({ path: out + '/sales-6-home.png' });
  // 和 Grandma 说话：她的台词 + 每天一次对她说英语
  await E(g => { const d = window.EchoWorld._debug(); const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => d.M.grid[g.y + dy] && d.M.grid[g.y + dy][g.x + dx] === '_' && !d.M.npcs.some(n => n.x === g.x + dx && n.y === g.y + dy));
    const x = g.x + free[0], y = g.y + free[1]; d.PL.x = d.PL.fx = x; d.PL.y = d.PL.fy = y; d.PL.dir = free[0] === 1 ? 'left' : free[0] === -1 ? 'right' : free[1] === 1 ? 'up' : 'down'; d.PL.moving = false; }, gm);
  seen.length = 0;
  await A(); await W(300);
  await play();
  check(seen.some(x => /Come and have some fruit/.test(x)) && seen.includes('I love you, Grandma!'), '和 Grandma 说话：她的台词 + 每天对她说一句「I love you, Grandma!」', seen);
  // 博士的包：出门以后就是挑的 3 只
  await E(() => window.EchoWorld._debug().goMap('t0', 'door:H'));
  await until(() => E(() => document.querySelectorAll('#w-scene .bg-ball').length > 0 || !!window.EchoWorld._debug().dlg), 60);
  for (let i = 0; i < 30 && !(await E(() => document.querySelectorAll('#w-scene .bg-ball').length)); i++) {
    if (await p.$('#w-dlg [data-act=wSelfDone]')) await p.click('#w-dlg [data-act=wSelfDone]'); else await A();
    await W(300);
  }
  const bag = await E(() => ({ n: document.querySelectorAll('#w-scene .bg-ball').length, prev: (document.querySelector('#bg-prev b') || {}).textContent }));
  const want = await E(id => window.DEX.byId[id].en, pick[1]);
  check(bag.n === 3 && bag.prev === want, '博士的包里是挑的 3 只伙伴', bag);
  await p.screenshot({ path: out + '/sales-7-bag.png' });
  await E(() => window.EchoGame.goHome()); await W(300);

  // ---------- AI 标识、朗读 ----------
  // 假的阿里云实时语音：连上就一直开着（不回话），聊天页留在屏幕上
  await E(() => { window.__fakeNative.onWsOpen = (id, url, cb) => setTimeout(() => cb(id, 'open', ''), 10); });
  await E(() => window.EchoTalk.open('lily')); await W(600);
  const tk = await E(() => ({ label: (document.querySelector('#tk-ai') || {}).textContent, sys: (document.querySelector('#tk-log .tk-b.sys') || {}).textContent, n: window.EchoGame.dayLog().aiNotice }));
  check(tk.label === 'AI 生成', '聊天页顶上：「AI 生成」（不写是哪家的模型）', tk);
  check(/人工智能生成/.test(tk.sys || '') && !/千问|阿里云/.test(tk.sys || '') && tk.n === 1, '今天第一次聊天：开头写一句 AI 提示（只写字，不提是哪家的）', tk);
  await E(() => { const x = document.querySelector('[data-act=talk_end]'); if (x) x.click(); }); await W(300);
  await E(() => { if (document.querySelector('#tk-ov')) window.EchoTalk.endIfOpen(); document.querySelectorAll('#tk-ov').forEach(e => e.remove()); });
  // 同一天再聊一次：不再写那句提示（每天一次），顶上的「AI 生成」还在
  await E(() => window.EchoTalk.open('lily')); await W(600);
  const tk2 = await E(() => ({ sys: document.querySelectorAll('#tk-log .tk-b.sys').length, n: window.EchoGame.dayLog().aiNotice, label: (document.querySelector('#tk-ai') || {}).textContent }));
  check(tk2.sys === 0 && tk2.n === 1 && tk2.label === 'AI 生成', '同一天第二次聊天：开头不再写提示，顶上的「AI 生成」还在', tk2);
  await E(() => { const x = document.querySelector('[data-act=talk_end]'); if (x) x.click(); }); await W(300);
  await E(() => { if (document.querySelector('#tk-ov')) window.EchoTalk.endIfOpen(); document.querySelectorAll('#tk-ov').forEach(e => e.remove()); });
  await route({ 'qwen3-tts-flash': { type: 'ok', data: { output: { audio: { url: HOST + '/assets/voice/zh/ai-notice.ogg' } } } } });
  await E(() => window.EchoGame.say('Hello Kevin, welcome back to the island!'));
  check(await E(() => window.__posts.some(x => x.model === 'qwen3-tts-flash')), '没有配音的句子：用阿里云 qwen3-tts-flash 现场合成');
  check(!outside.some(u => /youdao/i.test(u)) && !/youdao|dictvoice/i.test(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8').replace(/\/\/[^\n]*/g, '')), '不再连有道（dictvoice）', outside.filter(u => /youdao/.test(u)));

  // ---------- 周报：AI 花费按 qwen3.8-omni-flash-realtime 北京区现价 ----------
  await E(() => { const L = window.EchoGame.dayLog(); Object.assign(L, { aiChatIn: 1e6, aiChatAudioIn: 1e6, aiChatOut: 1e6, aiChatAudioOut: 1e6, aiTextIn: 0, aiTextOut: 0, asrSec: 0 }); window.EchoGame.reportSheet(); });
  await W(300);
  check(/本周 AI 花费约 ¥18\.00/.test(await p.textContent('#sheet .report')), '周报：音频输入 ¥6 + 输出 ¥12（每百万 token）= ¥18.00', (await p.textContent('#sheet .rp-diag')).slice(0, 80));
  await E(() => { const L = window.EchoGame.dayLog(); Object.assign(L, { aiChatIn: 2e6, aiChatAudioIn: 1e6, aiChatOut: 2e6, aiChatAudioOut: 1e6 }); window.EchoGame.reportSheet(); });
  await W(200);
  check(/本周 AI 花费约 ¥24\.00/.test(await p.textContent('#sheet .report')), '文本部分：输入 ¥1.5 + 输出 ¥4.5（每百万 token）');
  await E(() => window.EchoGame.closeModal());

  // ---------- 设置：开源许可、改家长密码、改家庭定制 ----------
  await E(() => window.EchoGame.A.settings()); await W(300);
  t = await p.textContent('#sheet');
  check(/家庭定制/.test(t) && /设备检查/.test(t) && /儿童隐私说明/.test(t) && /开源许可与致谢/.test(t), '家长设置：家庭定制、设备检查、隐私和同意；设置底部有「开源许可与致谢」');
  await p.click('#sheet [data-act=suDoc][data-doc=licenses]'); await W(400);
  t = await docText();
  check(/Kokoro/.test(t) && /Apache License 2\.0/.test(t) && /Open Font License/.test(t) && /three\.js/.test(t) && /MIT/.test(t) && /Hunyuan 3D 2\.0 Community License/.test(t) && /原创/.test(t), '开源许可与致谢：Kokoro（Apache-2.0）、OFL 字体、three.js（MIT）、混元 3D 许可声明、原创配乐');
  await p.click('[data-act=suDocClose]'); await W(150);
  await p.click('#sheet [data-act=pinChange]'); await W(250);
  const pin = async ds => { for (const d of ds) await p.click('#sheet [data-act=pinKey][data-k="' + d + '"]'); await W(350); };
  check(/请家长输入 4 位密码/.test(await p.textContent('#sheet')), '改家长密码：先输旧密码');
  await pin('3691'); await pin('4826'); await pin('4826');
  check(await E(() => window.__fakeNative.pin) === '4826', '销售版改家长密码：原生（输对旧密码 2 分钟内才让改）');
  await p.click('#sheet [data-act=suFamily]'); await W(300);
  if (await p.isVisible('#sheet #pin-pad').catch(() => false)) await pin('4826');
  check(await until(() => E(() => !!document.querySelector('#setup'))) && await step() === 'nick', '改家庭定制：要家长密码，打开向导的家庭定制几页');
  await p.fill('#su-nick', 'Max');
  await next(); await next(); await next();
  check(!(await p.$('#setup')) && (await S()).player.name === 'Max', '保存：孩子的昵称改成 Max');

  // ---------- 课本单元：销售版只开放本学年（七上、七下），下一学年的册 🔒；不写「同步」「配套」 ----------
  await E(() => window.EchoGame.closeModal()); await W(150);
  await E(() => { const b = document.querySelector('[data-act=tab][data-t=quiz]'); if (b) b.click(); }); await W(250);
  await E(() => { const b = document.querySelector('[data-act=quizView][data-v=book]'); if (b) b.click(); }); await W(250);
  const bk = await E(() => [...document.querySelectorAll('.seg.books button')].map(b => b.dataset.b + (b.classList.contains('locked') ? ':locked' : '')));
  const head = await p.textContent('.book-head').catch(() => '');
  check(bk.includes('hj7a') && bk.includes('hj7b') && bk.includes('hj8a:locked') && bk.includes('hj9b:locked') && /适用于沪教版词汇/.test(head) && !/同步|配套/.test(head), '课本单元：七上、七下开放，八上以后 🔒；标题写「适用于沪教版词汇」', { bk, head: head.slice(0, 120) });
  await p.click('.seg.books [data-b=hj8a]'); await W(250);
  check(/下一学年/.test(await p.textContent('#sheet')), '点 🔒 的册：说明是下一学年的内容包');
  await E(() => window.EchoGame.closeModal()); await W(150);

  // ---------- 忘了家长密码：导出存档（不用密码）→ 清除 App 数据 → 重新走一遍向导 → 从备份恢复，进度回来 ----------
  await E(() => window.EchoGame.A.settings()); await W(250);
  check(/导出存档/.test(await p.textContent('#sheet')) && /忘了密码：先「💾 导出存档」/.test(await p.textContent('#sheet')), '家长设置写清楚忘了密码怎么办（导出 → 清除数据 → 重新设置 → 从备份恢复）');
  await E(() => document.querySelector('#sheet [data-act=bakExport]').click()); await W(250);
  const exported = await E(() => { const s = window.__fakeNative.shared.filter(x => /^echo-save-/.test(x.name)).pop(); return s ? s.text : ''; });
  const before = await E(() => ({ name: window.EchoGame.S.player.name, coins: window.EchoGame.S.coins, starters: window.EchoGame.S.settings.family.starters.slice() }));
  check(!!exported && JSON.parse(exported).player.name === 'Max', '导出存档不用密码（分享成 echo-save-日期.json）');
  // 清除 App 数据：网页存档、原生里的密码和密钥都没了（「下载/EchoIsland」里的备份文件不受影响）
  await E(() => { localStorage.clear(); localStorage.setItem('__fakeOpts', JSON.stringify({ pin: null, key: '' })); });
  await p.reload();
  check(await until(() => E(() => !!document.querySelector('#setup'))) && await E(() => !window.EchoNative.hasPin()), '清除数据以后：又是家长首次设置，原来的密码没了');
  await p.click('#su-consent'); await W(150); await next();
  await until(() => E(() => !!document.querySelector('#su-verdict')));
  await next();
  await pinKeys('5827'); await pinKeys('5827');
  check(await E(() => window.__fakeNative.pin) === '5827', '设了新的家长密码');
  await next();
  await p.click('[data-act=suKeySkip]'); await W(250);
  await p.fill('#su-nick', 'Temp'); await next();
  const lib2 = await E(() => [...document.querySelectorAll('#su-box .su-mon')].slice(0, 3).map(b => b.dataset.id));
  for (const id of lib2) { await p.click('#su-box [data-act=suMon][data-id="' + id + '"]'); await W(100); }
  await next(); await next();
  await p.click('[data-act=suFinish]'); await W(500);
  await E(() => { const x = document.querySelector('[data-act=introGo]'); if (x) x.click(); }); await W(300);
  await E(() => window.EchoGame.closeModal()); await W(150);
  // 从备份恢复：要新密码；选导出的那个文件
  await E(t => { window.__fakeNative.picked = { ok: true, name: 'echo-save-export.json', text: t }; }, exported);
  await E(() => window.EchoGame.A.settings()); await W(250);
  await E(() => document.querySelector('#sheet [data-act=bakRestore]').click()); await W(250);
  if (await p.isVisible('#sheet #pin-pad').catch(() => false)) await pin('5827');
  await p.click('#sheet [data-act=bakFile]'); await W(400);
  check(/Max/.test(await p.textContent('#sheet')), '从文件里选：确认页是导出的那份（Max）');
  await p.click('#sheet [data-act=bakGo]');
  await p.waitForFunction(() => window.EchoGame && window.EchoGame.S.player && window.EchoGame.S.player.name === 'Max', null, { timeout: 8000 }).catch(() => {});
  await W(600);
  const after = await E(() => ({ name: window.EchoGame.S.player.name, coins: window.EchoGame.S.coins, starters: window.EchoGame.S.settings.family.starters.slice(), setup: !!document.querySelector('#setup'), pin: window.__fakeNative.pin }));
  check(after.name === before.name && after.coins === before.coins && JSON.stringify(after.starters) === JSON.stringify(before.starters) && !after.setup && after.pin === '5827',
    '恢复好了：进度、家庭定制都回来了，用的是新密码，不再出向导', { before, after });

  check(!errs.length, '没有页面错误', errs);

  // ---------- 家庭版：不出向导 ----------
  const q = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  await q.context().route(u => !u.href.startsWith(HOST), r => r.abort());
  await q.addInitScript(FN.install, { key: 'sk-fake', net: 'offline', pin: '1234' });
  await q.goto(HOST + '/index.html');
  await q.waitForFunction(() => window.EchoGame && !document.querySelector('#home').hidden); await q.waitForTimeout(600);
  check(await q.evaluate(() => !window.DEX.sales && !document.querySelector('#setup') && !window.EchoSetup.needed() && window.EchoNative.setPin('5555') === false),
    '家庭版：不出向导，原生不让在手机上设密码');
  await q.close();

  // ---------- iPhone 版：② 设备检查认 diag().platform === 'ios'（假桥照 ios/App/Sources/Bridge.swift 回）——iOS 版本 + 机型（最低 18.4）、WebGL2、空间、麦克风 ----------
  const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;   // 和 tests/i18n.test.js 的一样
  const ic = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ic.route(u => !u.href.startsWith(HOST), r => r.abort());
  const ip = await ic.newPage();
  ip.setDefaultTimeout(6000);
  const ierrs = []; ip.on('pageerror', e => ierrs.push(e.message));
  await ip.addInitScript(FN.install, { edition: 'sales', pin: null, key: '', net: 'ok', mic: 'granted', platform: 'ios', ios: '18.4', model: 'iPhone15,2' });
  await ip.addInitScript(keep);
  await ip.addInitScript(fakeMic);
  const IE = (f, a) => ip.evaluate(f, a);
  const iuntil = async fn => { for (let i = 0; i < 60; i++) { if (await fn()) return true; await ip.waitForTimeout(150); } return false; };
  const ifake = o => IE(o => { Object.assign(window.__fakeNative, o); const k = JSON.parse(localStorage.getItem('__fakeOpts') || '{}'); localStorage.setItem('__fakeOpts', JSON.stringify(Object.assign(k, o))); }, o);
  const irun = async () => { await ip.click('[data-act=suDevRun]'); await iuntil(() => IE(() => !!document.querySelector('#su-verdict'))); };
  const idev = () => IE(() => ({ rows: Object.fromEntries([...document.querySelectorAll('.su-dev li[data-k]')].map(li => [li.dataset.k, li.className])), txt: document.querySelector('#su-box').innerText,
    verdict: (document.querySelector('#su-verdict') || {}).className || '', next: document.querySelector('#su-next').disabled }));
  await ip.goto(PAGE);
  await IE(() => localStorage.clear());
  await ip.reload();
  await iuntil(() => IE(() => !!document.querySelector('#setup')));
  await ip.click('#su-consent'); await ip.waitForTimeout(150);
  await ip.click('#su-next'); await ip.waitForTimeout(250);
  check(await iuntil(() => IE(() => !!document.querySelector('#su-verdict'))) && await IE(() => window.EchoNative.diag().includes('"platform":"ios"')), 'iPhone 版（diag 的 platform = ios）② 设备检查：检查完给结论');
  let dv = await idev();
  check(dv.rows.ios === 'ok' && !('android' in dv.rows) && !('webview' in dv.rows) && 'webgl2' in dv.rows && dv.rows.storage === 'ok' && dv.rows.mic === 'ok', 'iPhone 版：iOS 版本、WebGL2、剩余空间、麦克风，没有安卓版本、WebView 两行', dv.rows);
  check(/iOS 系统/.test(dv.txt) && /iOS 18\.4（iPhone15,2）/.test(dv.txt) && /这台 iPhone/.test(dv.txt), 'iPhone 版：显示 iOS 版本和机型「iOS 18.4（iPhone15,2）」', dv.txt.slice(0, 200));
  check(!/安卓|Android|WebView|装不上|应用商店|权限/.test(dv.txt), 'iPhone 版：没有安卓的字（安卓版本、WebView、「iPhone 装不上」）', dv.txt.slice(0, 300));
  check(!/bad/.test(dv.verdict) && /付款链接/.test(dv.txt) && !dv.next, 'iOS 18.4：合格，提示这时候付款，可以往下走（和安卓一样）', dv);
  await ip.screenshot({ path: out + '/sales-8-ios-device.png' });
  await ifake({ ios: '17.5' }); await irun();
  dv = await idev();
  check(dv.rows.ios === 'bad' && /bad/.test(dv.verdict) && /不合格/.test(dv.txt) && /iOS 17\.5（iPhone15,2）/.test(dv.txt) && /要 iOS 18\.4 以上/.test(dv.txt) && /软件更新/.test(dv.txt), 'iOS 17.5：不合格，说清楚要 iOS 18.4 以上、到「软件更新」升级', dv.txt.slice(0, 400));
  check(dv.next && !/付款链接/.test(dv.txt) && /不收费/.test(dv.txt), 'iOS 17.5：不能往下走、不提付款', dv);
  await ip.screenshot({ path: out + '/sales-8-ios-device-bad.png' });
  await ifake({ ios: '18.3.2' }); await irun();
  const v183 = (await idev()).rows.ios;
  await ifake({ ios: '26.0' }); await irun();
  check(v183 === 'bad' && (await idev()).rows.ios === 'ok', '版本按「主.次」比：18.3.2 不合格，26.0 合格', v183);
  await IE(() => localStorage.setItem('__mic', 'deny')); await ifake({ mic: 'blocked' }); await irun();
  dv = await idev();
  check(dv.rows.mic === 'bad' && /打开「麦克风」开关/.test(dv.txt) && !/「权限」/.test(dv.txt) && await ip.isVisible('[data-act=suMicFix]'), 'iPhone 版麦克风被拒：「去打开」→ 直接是「麦克风」开关（没有安卓「权限」那一层）', dv.txt.slice(0, 400));
  await IE(() => localStorage.setItem('__mic', 'ok')); await ifake({ mic: 'granted' }); await irun();
  check((await idev()).rows.mic === 'ok', 'iPhone 版：麦克风好了，重新检查合格');
  // 英语界面：回第一页换成 English，再来设备检查
  await ip.click('[data-act=suBack]'); await ip.waitForTimeout(250);
  await ip.click('[data-act=suUi][data-l=en]'); await ip.waitForTimeout(250);
  await ifake({ ios: '26.1', model: 'iPhone17,3' });
  await ip.click('#su-next'); await ip.waitForTimeout(250);
  await irun();
  dv = await idev();
  check(!CJK.test(dv.txt) && /iOS version/.test(dv.txt) && /iOS 26\.1 \(iPhone17,3\)/.test(dv.txt) && /this iPhone/.test(dv.txt) && !/Android|WebView/.test(dv.txt) && /payment link/.test(dv.txt) && !dv.next,
    '英语界面 · iPhone 版设备检查：没有中文，「iOS 26.1 (iPhone17,3)」合格，可以往下走', dv.txt.slice(0, 400));
  await ifake({ ios: '17.5' }); await irun();
  dv = await idev();
  check(!CJK.test(dv.txt) && dv.rows.ios === 'bad' && /Needs iOS 18\.4 or newer/.test(dv.txt) && /Software Update/.test(dv.txt) && dv.next, '英语界面 · iOS 17.5：不合格（Needs iOS 18.4 or newer），没有中文，不能往下走', dv.txt.slice(0, 400));
  await ip.screenshot({ path: out + '/sales-8-ios-device-en.png' });
  // 横屏（844×390）：左边标题和步骤，右边内容一栏自己滚动，「上一步 / 下一步」在内容下面——按钮不压在内容上，整个框不用滚
  const land = () => IE(() => {
    const box = document.querySelector('#su-box'), step = box.querySelector('.su-step'), R = e => e.getBoundingClientRect(), sr = R(step);
    const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 0.5 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 0.5;
    const btns = [...box.querySelectorAll('.su-nav button')].map(R);
    return { scrolls: getComputedStyle(step).overflowY === 'auto', apart: !btns.some(x => hit(x, sr)), boxOver: box.scrollHeight - box.clientHeight, inView: btns.every(x => x.top >= 0 && x.bottom <= innerHeight) };
  });
  await ip.setViewportSize({ width: 844, height: 390 }); await ip.waitForTimeout(300);
  let ld = await land();
  check(ld.scrolls && ld.apart && ld.boxOver <= 1 && ld.inView, '横屏 844×390 · 设备检查：内容一栏自己滚动，按钮在它下面、不压在内容上', ld);
  await ip.click('[data-act=suBack]'); await ip.waitForTimeout(250);
  ld = await land();
  check(ld.scrolls && ld.apart && ld.boxOver <= 1 && ld.inView, '横屏 844×390 · 第一页（语言、谁来用）：按钮不压在内容上', ld);
  await ip.screenshot({ path: out + '/sales-9-land-welcome.png' });
  check(!ierrs.length, 'iPhone 版向导没有页面错误', ierrs);
  await ic.close();

  await b.close(); srv.close();
  console.log(fails ? `\n✗ ${fails} 项没过` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
