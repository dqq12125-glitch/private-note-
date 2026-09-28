// 端到端测试：闯关练习第 1 关全部答对，检查结算和回声球奖励
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
  await p.evaluate(() => localStorage.setItem('echo-island-v1', JSON.stringify({ seenIntro: true, settings: { tts: 'online', mode: 'self' } })));
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
  const ok = /回声球 \+/.test(txt);
  console.log(ok ? 'PASS' : 'FAIL');
  if (!ok) process.exitCode = 1;
  await b.close();
})().catch(e => { console.log('FAIL', e.message.split('\n')[0]); process.exit(1); });
