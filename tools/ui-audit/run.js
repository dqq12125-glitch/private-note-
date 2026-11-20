// 回声岛 · 细节检查：把各个画面在几种手机尺寸、两种界面语言、新老画风下走一遍，每个画面自动查：
//   够得着（要紧的按钮在屏幕里、在安全区里、不用滚、没被盖住）、压在一起（不同层的字和框）、被裁掉（省略号、出了框 / 屏幕）、按钮太小、要滚才看得到的主要按钮。
// 用法：
//   node tools/ui-audit/run.js                                   全部屏幕 × 中英文；户外的新画风只查 ip17-p / ip17-l / se-l；挑战馆和各岛剧情只查 DEEP_COMBOS
//   node tools/ui-audit/run.js --views ip17-l,se-l --langs en    只查这几种
//   node tools/ui-audit/run.js --only dlg-,gym-i0G               只查 id 开头是这些的画面（逗号分开）
//   node tools/ui-audit/run.js --deep --allnew                   挑战馆、各岛剧情、新画风在所有屏幕 + 语言上都查（很慢）
//   node tools/ui-audit/run.js --base HEAD --tag before          用 git 里 HEAD 的老文件查（改之前的样子），结果放进 before/
//   node tools/ui-audit/run.js --shots all|bad|none              截图：全部 / 只截有问题的（默认）/ 不截
//   node tools/ui-audit/run.js --jobs 4                          同时开几页（默认 4）
//   node tools/ui-audit/run.js --report [--tag x]                把上次的结果重新汇总打印
// 结果：tests/screenshots/ui-audit/<tag>/report.json、截图 <屏幕>-<语言>[-new]-<画面>.png（红框：够不着 / 要滚；橙：压在一起；紫：裁掉；灰：太小）
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const L = require('./lib'), SC = require('./screens');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] || ''); };
const has = k => argv.includes('--' + k);

const KINDS = ['stale-size', 'reach-off', 'reach-covered', 'scroll-trap', 'text-off', 'reach-unsafe', 'overlap', 'covered', 'clip', 'ellipsis', 'text-unsafe', 'tap-small', 'toast', 'setup-failed'];
const BLOCK = ['stale-size', 'reach-off', 'reach-covered', 'scroll-trap', 'text-off', 'setup-failed'];
// 慢的画面（挑战馆、各岛剧情：deep）默认只在这几种屏幕 + 语言上查；新画风（3D，慢）默认只在这几种屏幕上查。--deep / --allnew 全查
const DEEP_COMBOS = ['ip17-l-zh', 'ip17-l-en', 'se-l-en', 'ip17-p-zh', 'ip17-p-en'];
const NEW_VIEWS = ['ip17-p', 'ip17-l', 'se-l'];

function summarize(res, P) {
  P = P || console.log;
  const recs = res.recs || [];
  const byKind = {}, byScreen = {}, byView = {};
  recs.forEach(r => (r.problems || []).forEach(q => {
    byKind[q.k] = (byKind[q.k] || 0) + 1;
    const s = byScreen[r.screen] = byScreen[r.screen] || {}; s[q.k] = (s[q.k] || 0) + 1;
    const v = byView[r.view + '-' + r.lang + (r.look ? '-' + r.look : '')] = byView[r.view + '-' + r.lang + (r.look ? '-' + r.look : '')] || {}; v[q.k] = (v[q.k] || 0) + 1;
  }));
  P('\n== 细节检查（' + (res.tag || '') + '）：' + recs.length + ' 个画面 × 屏幕 × 语言' + (res.base ? '，用的是 ' + res.base + ' 的老文件' : '') + ' ==');
  P('按种类：' + KINDS.filter(k => byKind[k]).map(k => k + ' ' + byKind[k]).join(' · '));
  P('\n按画面（只列有问题的；挡路的种类在前）：');
  Object.entries(byScreen).sort((a, b) => BLOCK.reduce((n, k) => n + (b[1][k] || 0), 0) - BLOCK.reduce((n, k) => n + (a[1][k] || 0), 0) || Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0))
    .forEach(([s, c]) => P('  ' + s.padEnd(38) + KINDS.filter(k => c[k]).map(k => k + ' ' + c[k]).join(' · ')));
  P('\n按屏幕：');
  Object.entries(byView).forEach(([v, c]) => P('  ' + v.padEnd(18) + KINDS.filter(k => c[k]).map(k => k + ' ' + c[k]).join(' · ')));
  return { byKind, byScreen, byView };
}
// 一条一条列出来（同一个画面 + 种类 + 选择器只列一次，后面跟上在哪几种屏幕上出现）
function details(res, P, kinds) {
  P = P || console.log;
  const m = new Map();
  (res.recs || []).forEach(r => (r.problems || []).forEach(q => { if (kinds && !kinds.includes(q.k)) return; const k = r.screen + '|' + q.k + '|' + q.sel; const e = m.get(k) || Object.assign({}, q, { screen: r.screen, seen: [] }); e.seen.push(r.view + '-' + r.lang + (r.look ? '-' + r.look : '')); m.set(k, e); }));
  [...m.values()].sort((a, b) => KINDS.indexOf(a.k) - KINDS.indexOf(b.k)).forEach(e => P('  [' + e.k + '] ' + e.screen + '  ' + e.sel + (e.text ? ' 「' + e.text.slice(0, 30) + '」' : '') + '  ' + JSON.stringify(e.rect) + (e.by ? ' by ' + e.by : '') + (e.on ? ' on ' + e.on : '') + (e.where ? ' in ' + e.where : '') + (e.size ? ' ' + e.size : '') + (e.msg ? ' ' + e.msg : '') + '  @ ' + e.seen.slice(0, 5).join(',') + (e.seen.length > 5 ? ' +' + (e.seen.length - 5) : '')));
}

// 「改之前」：把网页的全部 js / css / html 在 HEAD 里的样子放进一个临时目录，小网站优先读它（查的时候再改别的文件也不会混进来）
function baseDir(rev) {
  const dir = path.join(os.tmpdir(), 'echo-ui-audit-base-' + rev.replace(/[^\w]/g, ''));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const files = cp.execSync('git ls-tree -r --name-only ' + rev, { cwd: L.ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').map(s => s.trim()).filter(f => /\.(js|css|html)$/.test(f) && !/^(tools|tests|ios|android|cloud|server)\//.test(f));
  files.forEach(f => { let body; try { body = cp.execSync('git show ' + rev + ':' + f, { cwd: L.ROOT, maxBuffer: 64 << 20 }); } catch (e) { return; } const to = path.join(dir, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, body); });
  return { dir, files };
}

async function runCombo(browser, base, combo, list, outDir, shots, log) {
  const pages = {};
  const recs = [];
  const pageFor = async cfg => {
    const key = JSON.stringify([cfg.bridge, (cfg.init || []).map(String)]);
    if (!pages[key]) pages[key] = await L.open(browser, base, { view: combo.view, lang: combo.lang, look: combo.look, bridge: cfg.bridge === undefined ? {} : cfg.bridge, init: cfg.init });
    return pages[key];
  };
  for (const s of list) {
    const cfg = s.cfg || {};
    let t;
    try { t = await pageFor(cfg); } catch (e) { recs.push({ screen: s.id, view: combo.view, lang: combo.lang, look: combo.look, problems: [{ k: 'setup-failed', sev: 0, sel: '', text: 'open: ' + String(e.message).split('\n')[0].slice(0, 160) }] }); continue; }
    const measure = async sub => {
      await t.settle(250);
      await t.clearToasts().catch(() => {});
      const name = s.id + (sub ? ':' + sub : '');
      let r;
      try { r = await t.E(L.AUDIT, { ins: t.V.ins, primary: s.primary || [], ellipsisOk: SC.OK_ELL.concat(s.ok || []) }); }
      catch (e) { r = { problems: [{ k: 'setup-failed', sev: 0, sel: '', text: 'audit: ' + String(e.message).split('\n')[0].slice(0, 160) }] }; }
      const rec = { screen: name, grp: s.grp, view: combo.view, lang: combo.lang, look: combo.look, primary: r.primary || 0, problems: r.problems || [] };
      const bad = rec.problems.some(q => q.k !== 'tap-small' && q.k !== 'toast');
      if (shots === 'all' || (shots === 'bad' && bad)) {
        const file = combo.view + '-' + combo.lang + (combo.look ? '-' + combo.look : '') + '-' + name.replace(/[:/]/g, '_') + '.png';
        try { await t.E(L.MARK, rec.problems); await t.p.screenshot({ path: path.join(outDir, file), timeout: 20000 }); rec.shot = file; } catch (e) { /* 截不到就算了 */ }
        await t.E(() => { const o = document.getElementById('__audit_mark'); if (o) o.remove(); }).catch(() => {});
      }
      recs.push(rec);
    };
    const t0 = Date.now();
    if (t.view !== combo.view) { await t.rotate(combo.view).catch(() => {}); }
    try {
      await Promise.race([
        s.multi ? s.setup(t, sub => measure(sub)) : s.setup(t).then(() => measure()),
        new Promise((_, rej) => setTimeout(() => rej(new Error('超时 ' + (s.multi ? 240 : 75) + ' 秒')), (s.multi ? 240 : 75) * 1000)),
      ]);
    } catch (e) {
      recs.push({ screen: s.id, grp: s.grp, view: combo.view, lang: combo.lang, look: combo.look, problems: [{ k: 'setup-failed', sev: 0, sel: '', text: String(e.message).split('\n')[0].slice(0, 200) }] });
      // 页面可能卡在半路：重开
      const key = Object.keys(pages).find(k => pages[k] === t); if (key) { await t.ctx.close().catch(() => {}); delete pages[key]; }
    }
    recs.filter(r => r.screen.split(':')[0] === s.id && r.ms == null).forEach(r => { r.ms = Date.now() - t0; });
    log(combo, s.id, Date.now() - t0, recs.filter(r => r.screen.split(':')[0] === s.id).reduce((n, r) => n + r.problems.filter(q => q.k !== 'tap-small' && q.k !== 'toast').length, 0));
  }
  const errs = Object.values(pages).flatMap(t => t.errs);
  for (const t of Object.values(pages)) await t.ctx.close().catch(() => {});
  return { recs, errs };
}

async function main() {
  const tag = arg('tag', has('base') ? 'before' : 'after');
  const outDir = path.join(L.OUT, tag);
  if (has('report')) { const res = JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8')); summarize(res); if (has('details')) details(res, console.log, arg('kinds', '') ? arg('kinds').split(',') : null); return; }
  fs.mkdirSync(outDir, { recursive: true });
  const views = arg('views', Object.keys(L.VIEWS).join(',')).split(',').filter(Boolean);
  const langs = arg('langs', 'zh,en').split(',').filter(Boolean);
  const looks = arg('looks', 'old,new').split(',').filter(Boolean);
  const only = arg('only', '').split(',').filter(Boolean);
  const shots = arg('shots', 'bad');
  const jobs = +arg('jobs', '4');
  const all = SC.screens().filter(s => !only.length || only.some(o => s.id.startsWith(o) || s.grp === o));
  let over = null, baseFiles = [];
  if (has('base')) { const b = baseDir(arg('base', 'HEAD')); over = b.dir; baseFiles = b.files; console.log('改之前：' + arg('base', 'HEAD') + ' 的 ' + b.files.length + ' 个文件（' + b.files.join(', ') + '）'); }
  const srv = await L.serve(over);
  const browser = await L.IL.launch('chromium');
  const combos = [];
  for (const view of views) for (const lang of langs) for (const look of looks) {
    if (look === 'new' && !has('allnew') && !NEW_VIEWS.includes(view)) continue;
    const list = all.filter(s => !s.views || s.views.includes(view)).filter(s => look === 'new' ? !!s.outdoor : s.outdoor !== 'new').filter(s => !s.deep || has('deep') || DEEP_COMBOS.includes(view + '-' + lang));
    if (list.length) combos.push({ view, lang, look: look === 'new' ? 'new' : '', list });
  }
  const t0 = Date.now(), recs = [], errs = [];
  let done = 0; const total = combos.reduce((n, c) => n + c.list.length, 0);
  const log = (c, id, ms, n) => { done++; if (has('v') || n) process.stdout.write('  [' + done + '/' + total + '] ' + c.view + '-' + c.lang + (c.look ? '-new' : '') + ' ' + id + ' ' + (ms / 1000).toFixed(1) + 's' + (n ? '  问题 ' + n : '') + '\n'); };
  const queue = combos.slice();
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) { const c = queue.shift(); const r = await runCombo(browser, srv.base, c, c.list, outDir, shots, log); recs.push(...r.recs); errs.push(...r.errs.map(e => c.view + '-' + c.lang + ': ' + e)); } }));
  await browser.close(); srv.close();
  const res = { tag, at: new Date().toISOString(), base: has('base') ? arg('base', 'HEAD') : '', baseFiles, views, langs, looks, ms: Date.now() - t0, recs, pageErrors: [...new Set(errs)].slice(0, 50) };
  // 只查了一部分时：和上次的结果合并（同一个画面 + 屏幕 + 语言 + 画风换成新的）
  const file = path.join(outDir, 'report.json');
  if ((only.length || has('merge')) && fs.existsSync(file)) {
    const old = JSON.parse(fs.readFileSync(file, 'utf8')), key = r => [r.screen, r.view, r.lang, r.look].join('|'), fresh = new Set(recs.map(r => r.screen.split(':')[0] + '|' + r.view + '|' + r.lang + '|' + r.look));
    res.recs = old.recs.filter(r => !fresh.has(r.screen.split(':')[0] + '|' + r.view + '|' + r.lang + '|' + r.look)).concat(recs);
    res.merged = true;
  }
  fs.writeFileSync(file, JSON.stringify(res, null, 1));
  summarize(res);
  if (has('details')) details(res, console.log, arg('kinds', '') ? arg('kinds').split(',') : null);
  if (res.pageErrors.length) console.log('\n页面报错：\n  ' + res.pageErrors.slice(0, 12).join('\n  '));
  console.log('\n用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + ' 秒；结果 ' + file);
}

if (require.main === module) main().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
module.exports = { runCombo, summarize, details, KINDS, BLOCK, baseDir };
