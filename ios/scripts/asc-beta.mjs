// TestFlight 的测试员这一头（App Store Connect API）：看现在的状态、开一个带公开链接（邀请码）的外部测试组并送测试版审核。
// 只在 GitHub Actions 里跑（.github/workflows/ios-testers.yml），钥匙是仓库密钥 ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8，本机没有。
//   node ios/scripts/asc-beta.mjs status          只看，不改
//   node ios/scripts/asc-beta.mjs link            建组 + 公开链接 + 把最新的包加进去 + 送测试版审核（已经送过 / 通过了就只报状态）
// 这个仓库是公开的，Actions 的日志谁都看得到：联系人、邮箱、公开链接这些**不打印原文**。
// 要拿回本机的（公开链接）用下面这把公钥加密成一行 SEALED:…，只有老板电脑上的私钥解得开
// （D:\Claude\echo-island-sales\_private\asc-out-key.pem；解法见文件末尾的注释）。
import crypto from 'node:crypto';

const PUB = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxitGZPIVOXnd3DC7D4BT
J6A5a/Pq4FxvElrRwl3g3E1nfEpIl7WGG/amFXsMITz6gmKdB0JZp7+8T7zDsxhR
TLakapP0w+73I65GMmKIUPc6UA9/BrxiU9wnZP/9zzqDau90mGktGnKVigd4oJqo
sYbEdZFpw1APE0QHc2joTArjbLgUG5N1WUskTLENnKO0FGvuioE6IoiLna8FhoBT
ybGH3H/1fhVg59vdi92AiPKkhwNmtJRNw1NsQQhqy31Qs2E1AC2GEmFbAeFi9Rba
Znzle/spcF253Lq6bxhtEuvp7r4cVRvNj6/qjpcqB80tumN5zDdT6tBnm3lmE1dB
4wIDAQAB
-----END PUBLIC KEY-----`;
const BUNDLE = process.env.ECHO_BUNDLE_ID || 'com.echoisland.app';
const GROUP = process.env.ASC_GROUP || 'Friends';
const LINK_LIMIT = +(process.env.ASC_LINK_LIMIT || 30);   // 公开链接最多让多少人装（每个测试员登录后每天有免费的 AI 额度，是老板出钱，先别放太开）
const DESC = 'Echo Island is a listening-and-speaking adventure game for learning languages. Explore the islands, collect original monsters and win battles by speaking. This beta has courses in English, Spanish, Japanese and Mandarin Chinese; the voice pack for a course is downloaded inside the app the first time you choose it.';
const WHAT = 'Play the first island in any course. Speaking tasks are scored on the device when the phone supports that language; otherwise sign in with Apple in Settings to use our server. Voice chat with islanders also needs sign-in and has a small free allowance each day. Please tell us about anything that looks wrong or feels slow.';
const NOTES = 'No account is needed to start playing. AI features (voice chat with islanders, server-side speech scoring) need Sign in with Apple inside the app and have a small free daily allowance. Microphone and speech recognition permissions are requested when the first speaking task starts. Course voice packs (60-100 MB) are downloaded from our own server when a course is chosen.';

const KID = process.env.ASC_KEY_ID, ISS = process.env.ASC_ISSUER_ID, P8 = process.env.ASC_KEY_P8;
if (!KID || !ISS || !P8) { console.log('✗ 缺仓库密钥 ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8'); process.exit(2); }
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' })), body = b64u(JSON.stringify({ iss: ISS, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: P8, dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}
const TOKEN = jwt();
const seal = (label, text) => console.log('SEALED:' + label + ':' + crypto.publicEncrypt({ key: PUB, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(String(text))).toString('base64'));
// 出错时只报苹果给的错误码和标题（detail 里可能带邮箱之类，不打印）
async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + TOKEN }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* 不是 JSON */ }
  if (!r.ok) {
    const errs = ((j && j.errors) || []).map(e => (e.code || '') + ' ' + (e.title || '')).join(' | ');
    const e = new Error(method + ' ' + path.split('?')[0] + ' → ' + r.status + ' ' + errs); e.status = r.status; e.codes = ((j && j.errors) || []).map(x => x.code); throw e;
  }
  return j;
}
const get = p => api('GET', p);
const has = v => (v == null || v === '' ? '没填' : '有');

async function appOf() {
  const a = (await get('/v1/apps?filter[bundleId]=' + encodeURIComponent(BUNDLE) + '&limit=1')).data[0];
  if (!a) { console.log('✗ App Store Connect 里没有 ' + BUNDLE); process.exit(1); }
  return a;
}
async function buildsOf(appId) {
  const bs = (await get('/v1/builds?filter[app]=' + appId + '&sort=-uploadedDate&limit=6&fields[builds]=version,uploadedDate,processingState,expired,usesNonExemptEncryption')).data;
  for (const b of bs) { try { b.beta = (await get('/v1/builds/' + b.id + '/buildBetaDetail')).data.attributes; } catch (e) { b.beta = { err: e.message }; } }
  return bs;
}
async function status(app) {
  console.log('App：' + app.attributes.name + '（' + app.attributes.bundleId + '）');
  const groups = (await get('/v1/apps/' + app.id + '/betaGroups?limit=50')).data;
  console.log('测试组 ' + groups.length + ' 个：');
  for (const g of groups) {
    const a = g.attributes; let n = '?';
    try { const t = await get('/v1/betaGroups/' + g.id + '/betaTesters?limit=1'); n = (t.meta && t.meta.paging && t.meta.paging.total) != null ? t.meta.paging.total : t.data.length; } catch (e) { n = '?'; }
    console.log('  - ' + a.name + '：' + (a.isInternalGroup ? '内部' : '外部') + '，测试员 ' + n + ' 人，公开链接 ' + (a.publicLinkEnabled ? '开着' + (a.publicLinkLimitEnabled ? '（上限 ' + a.publicLinkLimit + ' 人）' : '（不限人数）') : '没开'));
    if (a.publicLink) seal('link ' + a.name, a.publicLink);
  }
  const bs = await buildsOf(app.id);
  console.log('最近的包：');
  for (const b of bs) console.log('  - ' + b.attributes.version + '  ' + String(b.attributes.uploadedDate).slice(0, 16) + '  ' + b.attributes.processingState + (b.attributes.expired ? ' 已过期' : '') + '  内部 ' + (b.beta.internalBuildState || '?') + '  外部 ' + (b.beta.externalBuildState || '?'));
  const locs = (await get('/v1/apps/' + app.id + '/betaAppLocalizations?limit=20')).data;
  console.log('测试说明（给测试员看的）：' + (locs.length ? locs.map(l => l.attributes.locale + ' 说明' + has(l.attributes.description) + ' 反馈邮箱' + has(l.attributes.feedbackEmail) + ' 隐私网址' + has(l.attributes.privacyPolicyUrl)).join('；') : '还没有'));
  let rd = null; try { rd = (await get('/v1/apps/' + app.id + '/betaAppReviewDetail')).data; } catch (e) { console.log('审核联系人：读不到（' + e.message + '）'); }
  if (rd) { const a = rd.attributes; console.log('审核联系人：名 ' + has(a.contactFirstName) + '，姓 ' + has(a.contactLastName) + '，电话 ' + has(a.contactPhone) + '，邮箱 ' + has(a.contactEmail) + '，要不要演示账号 ' + a.demoAccountRequired + '，备注 ' + has(a.notes)); }
  return { groups, bs, locs, rd };
}

async function link(app) {
  const S = await status(app);
  console.log('—— 开始办 ——');
  // 1) 审核联系人：苹果要名、姓、电话、邮箱。没填的从环境变量补（仓库密钥 ASC_REVIEW_*），补不齐就停，不送审
  const rd = S.rd, ra = (rd && rd.attributes) || {};
  const want = { contactFirstName: process.env.ASC_REVIEW_FIRST, contactLastName: process.env.ASC_REVIEW_LAST, contactPhone: process.env.ASC_REVIEW_PHONE, contactEmail: process.env.ASC_REVIEW_EMAIL };
  const patch = {}; const missing = [];
  for (const k of Object.keys(want)) { if (!ra[k]) { if (want[k]) patch[k] = want[k]; else missing.push(k); } }
  if (!ra.notes) patch.notes = NOTES;
  if (ra.demoAccountRequired !== false) patch.demoAccountRequired = false;
  if (rd && Object.keys(patch).length) { await api('PATCH', '/v1/betaAppReviewDetails/' + rd.id, { data: { type: 'betaAppReviewDetails', id: rd.id, attributes: patch } }); console.log('审核联系人 / 备注：补了 ' + Object.keys(patch).join('、')); }
  // 2) 给测试员看的说明和反馈邮箱
  const fb = process.env.ASC_FEEDBACK_EMAIL || ra.contactEmail || want.contactEmail || '';
  let loc = S.locs.find(l => l.attributes.locale === 'en-US') || S.locs[0];
  if (!loc) {
    if (!fb) missing.push('feedbackEmail');
    else { loc = (await api('POST', '/v1/betaAppLocalizations', { data: { type: 'betaAppLocalizations', attributes: { locale: 'en-US', description: DESC, feedbackEmail: fb }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data; console.log('测试说明：新建了 en-US'); }
  } else {
    const p = {}; if (!loc.attributes.description) p.description = DESC; if (!loc.attributes.feedbackEmail) { if (fb) p.feedbackEmail = fb; else missing.push('feedbackEmail'); }
    if (Object.keys(p).length) { await api('PATCH', '/v1/betaAppLocalizations/' + loc.id, { data: { type: 'betaAppLocalizations', id: loc.id, attributes: p } }); console.log('测试说明：补了 ' + Object.keys(p).join('、')); }
  }
  if (missing.length) { console.log('✗ 还缺：' + missing.join('、') + '（老板用 tools/ios-testers-dialog.ps1 存进仓库密钥，或者在 App Store Connect 的 TestFlight → 测试信息 里填）。没有送审。'); process.exit(3); }
  // 3) 外部测试组 + 公开链接
  let g = S.groups.find(x => !x.attributes.isInternalGroup && x.attributes.name === GROUP);
  if (!g) {
    g = (await api('POST', '/v1/betaGroups', { data: { type: 'betaGroups', attributes: { name: GROUP, isInternalGroup: false, publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: LINK_LIMIT, feedbackEnabled: true }, relationships: { app: { data: { type: 'apps', id: app.id } } } } })).data;
    console.log('建了外部测试组「' + GROUP + '」，公开链接上限 ' + LINK_LIMIT + ' 人');
  } else if (!g.attributes.publicLinkEnabled) {
    g = (await api('PATCH', '/v1/betaGroups/' + g.id, { data: { type: 'betaGroups', id: g.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: LINK_LIMIT } } })).data;
    console.log('「' + GROUP + '」打开了公开链接');
  }
  // 4) 最新的、处理好的、没过期的包
  const want_v = process.env.ASC_BUILD || '';
  const b = S.bs.find(x => x.attributes.processingState === 'VALID' && !x.attributes.expired && (!want_v || x.attributes.version === want_v));
  if (!b) { console.log('✗ 没有可用的包' + (want_v ? '（要的是 ' + want_v + '）' : '')); process.exit(1); }
  console.log('用的包：' + b.attributes.version + '（外部状态 ' + b.beta.externalBuildState + '）');
  // 5) 这个包的「测试什么」
  const bl = (await get('/v1/builds/' + b.id + '/betaBuildLocalizations?limit=20')).data;
  const en = bl.find(l => l.attributes.locale === 'en-US') || bl[0];
  if (!en) await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', whatsNew: WHAT }, relationships: { build: { data: { type: 'builds', id: b.id } } } } });
  else if (!en.attributes.whatsNew) await api('PATCH', '/v1/betaBuildLocalizations/' + en.id, { data: { type: 'betaBuildLocalizations', id: en.id, attributes: { whatsNew: WHAT } } });
  // 6) 把包加进组
  try { await api('POST', '/v1/betaGroups/' + g.id + '/relationships/builds', { data: [{ type: 'builds', id: b.id }] }); console.log('包已加进「' + GROUP + '」'); }
  catch (e) { console.log('把包加进组：' + e.message); }
  // 组里只留这一个包：更早的包拿出去（比如 466560 连的是老网址，国内打不开——别让朋友装到它）。它们在内部测试组里照旧
  try {
    const old = (await get('/v1/betaGroups/' + g.id + '/builds?limit=50&fields[builds]=version')).data.filter(x => x.id !== b.id);
    if (old.length) { await api('DELETE', '/v1/betaGroups/' + g.id + '/relationships/builds', { data: old.map(x => ({ type: 'builds', id: x.id })) }); console.log('从「' + GROUP + '」拿掉了更早的包：' + old.map(x => x.attributes.version).join('、')); }
  } catch (e) { console.log('拿掉更早的包：' + e.message); }
  // 7) 送测试版审核（已经在审 / 已通过的不重复送）
  const st = b.beta.externalBuildState;
  if (st === 'READY_FOR_BETA_SUBMISSION' || st === 'BETA_REJECTED') {
    try { await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: b.id } } } } }); console.log('已送测试版审核'); }
    catch (e) { console.log('送审没成：' + e.message); }
  } else console.log('不用送审（现在是 ' + st + '）');
  const after = (await get('/v1/builds/' + b.id + '/buildBetaDetail')).data.attributes;
  console.log('现在：内部 ' + after.internalBuildState + '，外部 ' + after.externalBuildState);
  g = (await get('/v1/betaGroups/' + g.id)).data;
  if (g.attributes.publicLink) seal('link ' + GROUP, g.attributes.publicLink); else console.log('公开链接还没生成（一般要等包通过测试版审核）');
}

const act = process.argv[2] || 'status';
appOf().then(app => (act === 'link' ? link(app) : status(app))).then(() => process.exit(0)).catch(e => { console.log('✗ ' + (e && e.message || e)); process.exit(1); });

// 在老板电脑上把 SEALED 那一行解开（b64 = 冒号后面最后那一段）：
//   node -e "const c=require('crypto'),fs=require('fs');console.log(c.privateDecrypt({key:fs.readFileSync('D:/Claude/echo-island-sales/_private/asc-out-key.pem'),padding:c.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(process.argv[1],'base64')).toString())" <b64>
