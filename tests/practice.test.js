// 端到端测试：闯关练习第 1 关全部答对，检查结算和回声球奖励；带提示答对（看了原文）经验减半、不加连击、结算页写出来
// 运行：npm test（需要先 npm install && npx playwright install chromium）
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
(async () => {
  const b = await launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.setDefaultTimeout(3000);
  let last = '';
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  p.on('request', r => { const m = /audio=([^&]+)/.exec(r.url()); if (m) last = decodeURIComponent(m[1]); });
  await p.goto(PAGE);
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self' }, book: { view: 'isle' } })));
  await p.reload(); await p.waitForTimeout(400);
  await p.click('[data-act=tab][data-t=quiz]'); await p.click('.node.cur'); await p.click('#sheet [data-act=start]');
  for (let k = 0; k < 14; k++) {
    await p.waitForTimeout(800);
    if (await p.isVisible('#result')) { console.log('RESULT'); break; }
    const info = await p.evaluate(word => {
      const opts = [...document.querySelectorAll('#p-body .opt[data-act=pick] .o-t')].map(e => e.textContent);
      const w = window.WORLDS[0].words.find(x => x[0] === word);
      return { opts, idx: opts.findIndex(t => t === word || (w && t === w[1])), modal: !document.getElementById('modal').hidden };
    }, last);
    console.log(k, last, JSON.stringify(info));
    if (info.modal) break;
    if (info.idx >= 0) await p.click('#p-body .opt[data-act=pick] >> nth=' + info.idx).catch(e => console.log('click fail'));
    await p.waitForTimeout(200);
    await p.click('#fb-btn').catch(e => console.log('fb fail'));
  }
  const txt = await p.textContent('#result').catch(() => '');
  console.log('balls line:', /回声球 \+/.test(txt), 'balls:', await p.evaluate(() => JSON.parse(localStorage.getItem('echo-island-v1')).mon.balls));
  let ok = /回声球 \+/.test(txt);

  // 带提示答对（听问选答点了「看原文」）：经验减半、不加连击，结算页写出来（评估第 8 条）
  await p.waitForTimeout(1800);   // 结算后会弹「升级啦」之类的弹窗，先关掉
  await p.evaluate(() => { window.EchoGame.closeModal(); window.EchoGame.playQs([['lr', 0, 0], ['lr', 0, 1]]); });
  await p.waitForTimeout(300);
  const pickRight = () => p.evaluate(() => { const P = window.EchoGame.P(), k = P.q.opts.findIndex(o => o.c); document.querySelectorAll('#p-body .opt')[k].click(); });
  await p.click('#p-body [data-act=reveal]');
  await pickRight(); await p.waitForTimeout(200);
  const a1 = await p.evaluate(() => ({ fb: document.querySelector('#fb-t').textContent, combo: window.EchoGame.P().combo, xp: window.EchoGame.P().xp }));
  await p.click('#fb-btn'); await p.waitForTimeout(300);
  await pickRight(); await p.waitForTimeout(200);
  const a2 = await p.evaluate(() => ({ combo: window.EchoGame.P().combo, xp: window.EchoGame.P().xp }));
  await p.click('#fb-btn'); await p.waitForTimeout(400);
  const r2 = await p.textContent('#result').catch(() => '');
  const aidedOk = /减半/.test(a1.fb) && a1.combo === 0 && a1.xp === 5 && a2.combo === 1 && a2.xp === 15 && /1 题用了提示/.test(r2);
  console.log('aided:', JSON.stringify({ a1, a2, result: /1 题用了提示/.test(r2) }), aidedOk ? 'ok' : 'WRONG');
  ok = ok && aidedOk;

  // 多学一点换冒险时间（dayLog().pract）：只数有进步的练习关（第一次通关、星星变多），同一关再刷一遍不算
  const pr1 = await p.evaluate(() => window.EchoGame.dayLog().pract || 0);
  await p.waitForTimeout(1800);
  await p.evaluate(() => { window.EchoGame.closeModal(); window.EchoGame.playQs([['lr', 0, 0], ['lr', 0, 1]]); });
  await p.waitForTimeout(300);
  for (let k = 0; k < 2; k++) { await pickRight(); await p.waitForTimeout(200); await p.click('#fb-btn'); await p.waitForTimeout(400); }
  const pr2 = await p.evaluate(() => window.EchoGame.dayLog().pract || 0);
  const practOk = pr1 === 2 && pr2 === 2;
  console.log('pract:', JSON.stringify({ afterTwoNewLevels: pr1, afterReplay: pr2 }), practOk ? 'ok' : 'WRONG');
  ok = ok && practOk;
  console.log(ok ? 'PASS' : 'FAIL');
  if (!ok) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
