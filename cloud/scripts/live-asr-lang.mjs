// 实测：聊天（Qwen-Omni 实时语音）里「学习者说的话」那段听写，指定的语言管不管用（**会花钱，几分钱；跑之前先问老板**）
//   cd cloud && node scripts/live-asr-lang.mjs <16kHz 单声道 wav> [语言 …]       语言写 none 表示不指定；默认 none es ja
// 做法：直连阿里云的实时语音（和服务器一样的模型、一样的 session.update，只改 input_audio_transcription.language），
// 把这段声音送进去、提交，打印听写出来的字。用一门「明显不对」的语言（比如西语的话指定 ja）看它是不是真的照指定的听。
// 2026-11-22：老板在西语课的聊天里说「Soy Jack…」被听成了法语。钥匙只在这个进程里从钥匙文件读，不打印。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const WebSocket = require('ws');
const km = /^\s*DASHSCOPE_API_KEY\s*=\s*(\S+)\s*$/m.exec(fs.readFileSync(process.env.ECHO_KEY_FILE || 'D:/Claude/tools/echo-relay/game-key.env', 'utf8'));
if (!km || !km[1].startsWith('sk-')) { console.log('✗ 钥匙文件里没有找到钥匙（不打印内容）'); process.exit(2); }
const KEY = km[1], scrub = s => String(s).split(KEY).join('sk-***');
const MODEL = process.env.TALK_MODEL || 'qwen3.8-omni-flash-realtime';
const WS = (process.env.DS_WS_BASE || 'wss://dashscope.aliyuncs.com') + '/api-ws/v1/realtime?model=' + MODEL;
const file = process.argv[2], langs = process.argv.slice(3).length ? process.argv.slice(3) : ['none', 'es', 'ja'];
if (!file) { console.log('用法：node scripts/live-asr-lang.mjs <16kHz 单声道 wav> [none es ja …]'); process.exit(2); }
const wav = fs.readFileSync(file), pcm = wav.subarray(wav.indexOf(Buffer.from('data')) + 8);

function once(lang) {
  return new Promise(resolve => {
    const ws = new WebSocket(WS, { headers: { Authorization: 'Bearer ' + KEY } });
    const done = r => { try { ws.close(); } catch (e) { /* 关了 */ } resolve(r); };
    const tm = setTimeout(() => done({ lang, err: 'timeout' }), 20000);
    ws.on('error', e => { clearTimeout(tm); done({ lang, err: scrub(e.message) }); });
    ws.on('open', () => {
      const tr = { model: 'qwen3-asr-flash-realtime' };
      if (lang !== 'none') tr.language = lang;
      ws.send(JSON.stringify({ type: 'session.update', session: { modalities: ['text'], instructions: 'Reply with one short word.', input_audio_format: 'pcm', output_audio_format: 'pcm', input_audio_transcription: tr, turn_detection: null } }));
      for (let p = 0; p < pcm.length; p += 3200) ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm.subarray(p, p + 3200).toString('base64') }));
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      ws.send(JSON.stringify({ type: 'response.create' }));
    });
    ws.on('message', d => {
      let m; try { m = JSON.parse(String(d)); } catch (e) { return; }
      if (m.type === 'conversation.item.input_audio_transcription.completed') { clearTimeout(tm); done({ lang, text: m.transcript }); }
      else if (m.type === 'error') { clearTimeout(tm); done({ lang, err: scrub(JSON.stringify(m.error || m)).slice(0, 300) }); }
    });
  });
}

for (const l of langs) {
  const r = await once(l);
  console.log((l === 'none' ? '不指定' : '指定 ' + l) + ' → ' + (r.err ? '✗ ' + r.err : r.text));
}
process.exit(0);
