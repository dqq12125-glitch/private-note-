// 实测别的语言的「和岛民聊天」（**会花钱：真的阿里云额度，三门语言聊一遍约几毛钱；跑之前先问老板**）
//   cd cloud && node scripts/live-talk.mjs [es ja zh en]          每门课第 1 单元的角色
//   cd cloud && node scripts/live-talk.mjs es:q0-cap zh:q9-guard    支线委托（语言:委托 id），学习者说的是每一步的示范句；最后各试一次发音点评
// 做法和 live-speech.mjs 一样：本机起同一份服务器程序（Miniflare），上游接真的阿里云；假邮件拿登录态。
// 每门语言用这门课第 1 单元的角色（英语用 talk-npcs.js 的第一个）：
//   岛民开口 → 学习者说两句（先让服务器合成这两句，再当成麦克风的声音送进去）→ 按「帮帮我」→ 小步骤打勾（/v1/steps）
//   → 点气泡看意思（/v1/zh）→ 结束拿评语。
// 岛民说的声音存成 dist/live-talk/<语言>-<第几句>.wav（24 kHz），可以再用本机的识别工具听写一遍确认是那门语言。
// 钥匙只在这个进程里读（ECHO_KEY_FILE），不打印。PATH 里要有 ffmpeg。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { startWorker, CLOUD } from '../test/lib.js';
import { startFakes } from '../test/fakes.js';
const ROOT = path.resolve(CLOUD, '..').replace(/\\/g, '/') + '/';
const require = createRequire(ROOT);
const OUT = path.join(CLOUD, 'dist', 'live-talk');
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(2);
const UI = process.env.TALK_UI || 'zh', LV = process.env.TALK_LV || '1';
const km = /^\s*DASHSCOPE_API_KEY\s*=\s*(\S+)\s*$/m.exec(fs.readFileSync(process.env.ECHO_KEY_FILE || 'D:/Claude/tools/echo-relay/game-key.env', 'utf8'));
if (!km || !km[1].startsWith('sk-')) { console.log('✗ 钥匙文件里没有找到钥匙（不打印内容）'); process.exit(2); }
const KEY = km[1], scrub = s => String(s).split(KEY).join('sk-***');
const COURSES = require(ROOT + 'talk-courses.js'), NPCS = require(ROOT + 'talk-npcs.js');
// 学习者说的两句：对着第 1 单元目标的头两步
const SAY = {
  es: ['Soy simpático y divertido.', 'Mi mejor amiga es muy valiente.'],
  ja: ['ゆいさんは友だちです。', 'ゆいさんは一年生です。'],
  zh: ['我叫小云。', '你姓什么？'],
  en: ['I like apples very much.', 'My friend is very kind.'],
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wav16 = (inFile, outFile) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inFile, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outFile]); return fs.readFileSync(outFile); };
const pcmOf = wav => { const i = wav.indexOf(Buffer.from('data')); return wav.subarray(i + 8); };
const wavOf = (pcm, rate) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };

(async () => {
  const bin = path.join(CLOUD, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  execFileSync(process.execPath, [bin, 'deploy', '--dry-run', '--outdir', 'dist'], { cwd: CLOUD, stdio: 'pipe', env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false', CI: '1', NO_UPDATE_NOTIFIER: '1' }) });
  const F = await startFakes({ jwks: { keys: [] }, asrModel: 'x', asrRtModel: 'x' });
  const A = await startWorker(path.join(CLOUD, 'dist', 'index.js'), {
    ENVIRONMENT: 'test', TEST_HOOKS: '1', AUTH_PEPPER: 'live-test-pepper',
    DASHSCOPE_API_KEY: KEY, DS_HTTP_BASE: process.env.DS_HTTP_BASE || 'https://dashscope.aliyuncs.com', DS_WS_BASE: process.env.DS_WS_BASE || 'wss://dashscope.aliyuncs.com',
    EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_fake_key', RESEND_API_URL: F.url + '/resend/emails', EMAIL_FROM: 'Echo Island <noreply@example.test>',
    RATE: JSON.stringify({ emailPerAddrHour: 3, emailPerIpHour: 10000, signinPerIpHour: 10000, reportPerUserDay: 3, consentPerUserDay: 5 }),
  }, { RL_AI_USER: 1000, RL_AI_IP: 100000, RL_WS_USER: 1000 });
  const email = 'live-' + Date.now().toString(36) + '@example.test';
  await A.api('POST', '/v1/auth/email/start', { body: { email } });
  const code = /\b(\d{6})\b/.exec(F.mails[F.mails.length - 1].text)[1];
  const tk = (await A.api('POST', '/v1/auth/email/verify', { body: { email, code } })).json.token;
  await A.api('PATCH', '/v1/me', { token: tk, body: { ageGroup: 'adult' } });
  const me = (await A.api('GET', '/v1/me', { token: tk })).json;
  console.log('talkLangs', JSON.stringify(me.talkLangs), 'speechLangs', JSON.stringify(me.speechLangs));

  const JOBS = ONLY.length ? ONLY : ['es', 'ja', 'zh', 'en'];
  for (const job of JOBS) {
    const lang = job.split(':')[0], qid = job.split(':')[1] || '';
    const QL = qid ? (COURSES.quests && COURSES.quests[lang] && COURSES.quests[lang][qid]) : null;
    if (qid && !QL) { console.log('✗ 没有这条委托的译文：' + job); continue; }
    const npc = qid ? { id: qid, name: '委托 ' + qid } : lang === 'en' ? NPCS.list[0] : COURSES.list.find(n => n.lang === lang);
    const says = qid ? QL.steps.slice() : SAY[lang];
    console.log('\n===== ' + lang + '：' + npc.id + '（' + npc.name + '）=====');
    // 学习者的两句：让服务器合成，转成 16 kHz
    const clips = [];
    for (let i = 0; i < says.length; i++) {
      const r = await A.api('POST', '/v1/tts', { token: tk, body: lang === 'en' ? { text: says[i], g: 'm' } : { text: says[i], g: 'm', lang } });
      if (r.status !== 200) { console.log('✗ 合成学习者的话没成：', r.status, scrub(r.text).slice(0, 200)); continue; }
      const f0 = path.join(OUT, 'say-' + lang + '-' + i + '.wav'); fs.writeFileSync(f0, Buffer.from(await (await fetch(r.json.url)).arrayBuffer()));
      clips.push(pcmOf(wav16(f0, path.join(OUT, 'say-' + lang + '-' + i + '.16k.wav'))));
    }
    const c = await A.ws('/v1/talk?' + (qid ? 'quest=' + encodeURIComponent(qid) + '&lang=' + lang : 'npc=' + encodeURIComponent(npc.id)) + '&name=Coco&g=0&lv=' + LV + '&ui=' + UI, { first: tk });
    let audio = [], n = 0; const turns = [];
    const flush = tag => { const b = Buffer.concat(audio); audio = []; if (b.length) fs.writeFileSync(path.join(OUT, lang + '-' + tag + '.wav'), wavOf(b, 24000)); return +(b.length / 48000).toFixed(1); };
    c.ws.on('message', d => { let m; try { m = JSON.parse(String(d)); } catch (e) { return; } if (m.type === 'audio' && m.data) audio.push(Buffer.from(m.data, 'base64')); });
    const npcSays = async (what, ms) => {
      const k = c.msgs.filter(m => m.type === 'npc_done').length, t0 = Date.now();
      const m = await c.next(x => (x.type === 'npc_done' && c.msgs.filter(y => y.type === 'npc_done').indexOf(x) >= k) || x.type === 'error', ms || 25000);
      await sleep(300);
      const sec = flush(String(++n));
      if (!m || m.type === 'error') { console.log('✗ ' + what + '：' + (m ? scrub(JSON.stringify(m)).slice(0, 300) : '等了 ' + ((ms || 25000) / 1000) + ' 秒没回')); return null; }
      turns.push({ who: 'npc', text: m.text });
      console.log(what + '（' + (Date.now() - t0) + 'ms，声音 ' + sec + ' 秒）：' + m.text);
      return m.text;
    };
    const ready = await c.next(m => m.type === 'ready' || m.type === 'error', 15000);
    if (!ready || ready.type === 'error') { console.log('✗ 没连上：', ready ? scrub(JSON.stringify(ready)).slice(0, 300) : '超时', JSON.stringify(c.closed)); c.close(); continue; }
    let last = await npcSays('岛民开口');
    for (let i = 0; i < clips.length; i++) {
      const pcm = clips[i];
      for (let p = 0; p < pcm.length; p += 3200) { c.send({ type: 'audio', data: pcm.subarray(p, p + 3200).toString('base64') }); await sleep(25); }
      const k = c.msgs.filter(m => m.type === 'you').length;
      c.send({ type: 'commit' });
      const you = await c.next(x => x.type === 'you' && c.msgs.filter(y => y.type === 'you').indexOf(x) >= k, 12000);
      console.log('学习者说「' + says[i] + '」→ 听成：' + (you ? you.text : '（没等到）'));
      if (you && you.text) turns.push({ who: 'you', text: you.text });
      last = await npcSays('岛民回答') || last;
    }
    c.send({ type: 'help' });
    await npcSays('按了帮帮我');
    // 小步骤打勾、点气泡看意思
    const st = await A.api('POST', '/v1/steps', { token: tk, body: qid ? { q: qid, lang, g: 0, ui: UI, turns } : { npc: npc.id, g: 0, ui: UI, turns } });
    console.log('小步骤打勾：', st.status, st.status === 200 ? JSON.stringify(st.json.done) : scrub(st.text).slice(0, 200));
    if (last) {
      const z = await A.api('POST', '/v1/zh', { token: tk, body: lang === 'en' ? { text: last } : { text: last, lang, ui: UI } });
      console.log('看意思：', z.status, z.status === 200 ? z.json.zh : scrub(z.text).slice(0, 200));
    }
    c.send({ type: 'end', steps: (st.json && st.json.done) ? [0, 1, 2, 3].map(i => st.json.done.includes(i)) : [] });
    const ev = await c.next(m => m.type === 'eval' || m.type === 'error', 30000);
    console.log('评语：', ev ? scrub(JSON.stringify(ev.eval || ev)).slice(0, 900) : '（没等到）');
    const use = c.msgs.filter(m => m.type === 'usage').reduce((a, m) => ({ in: a.in + m.in, out: a.out + m.out, ain: a.ain + m.ain, aout: a.aout + m.aout }), { in: 0, out: 0, ain: 0, aout: 0 });
    console.log('用量（token）：', JSON.stringify(use));
    c.close(); await sleep(500);
    // 发音点评：把最后一句示范句当目标，听到的故意错一个词
    if (lang !== 'en') {
      const target = says[says.length - 1], heard = target.replace(/[\p{L}]+(?=[^\p{L}]*$)/u, lang === 'es' ? 'casa' : lang === 'ja' ? 'ねこ' : '苹果');
      const tp = await A.api('POST', '/v1/tip', { token: tk, body: { target, heard, ui: UI, lang } });
      console.log('发音点评（目标「' + target + '」，听到「' + heard + '」）：', tp.status, tp.status === 200 ? tp.json.tip : scrub(tp.text).slice(0, 200));
    }
  }
  await A.dispose(); await F.close();
  process.exit(0);
})().catch(e => { console.log('✗ 没跑起来：' + scrub(e && e.stack || e)); process.exit(1); });
