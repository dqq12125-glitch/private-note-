// 回声岛 AI 对话的核心逻辑（中转服务 server/relay.js 和安卓 APK 的「直连」模式共用）
// - instructions()：给 Qwen-Omni 的人设 + 安全规则（孩子改不了：中转服务里在服务器上拼；APK 里写死在打包进去的代码里）
// - personNpc()：大地图上随便一个人 → 临时人设（逐项限长、只留字母标点）
// - evalBody() / parseEval()：聊完后让文字模型给温和的评价
// - session()：一段对话。左边是游戏的消息（audio/commit/text/cancel/end），右边是 Qwen-Omni 实时语音的事件，中间翻译、记录、计时
(function (root) {
  'use strict';
  const VOICES = { f: ['Serena', 'Tina', 'Mione', 'Katerina', 'Maia', 'Jennifer'], m: ['Aiden', 'Ryan', 'Theo Calm', 'Joyner', 'Raymond', 'Dolce'], kf: ['Cici', 'Momo'], km: ['Evan'] };
  const MODEL = 'qwen3.8-omni-flash-realtime';
  const REALTIME_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
  const EVAL_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const EVAL_MODEL = 'qwen-plus';

  function instructions(npc, player) {
    return [
      npc.persona,
      'This is Echo Island, a friendly monster-collecting adventure game for learning English. You are talking with ' + (player || 'the player') + ', a Chinese junior high school student who is learning English (beginner to intermediate, CEFR A1 to A2).',
      'Rules:',
      '- Speak ONLY in English. Use short, simple sentences and common words. At most 2 short sentences per turn (about 20 words). Speak slowly and clearly, with a warm, lively tone that fits your character.',
      '- Keep the student talking: ask exactly one easy question each turn.',
      '- If the student is silent, answers in Chinese, or seems stuck, help with a tiny model sentence they can copy, e.g. "You can say: I want noodles." Then wait.',
      '- If the student makes a grammar or word mistake, do not say "wrong". Just repeat their idea correctly in your answer (recast), then continue.',
      '- Stay in character and inside the game world and everyday kid topics. Never ask for real personal information (real full name, school, address, phone, photos, passwords). Never talk about violence, scary, adult, political or unsafe topics; if the student brings one up, kindly change the subject back to the game.',
      '- Never mention that you are an AI model, and never mention any real games, brands or companies.',
      'Conversation goal for the student: ' + npc.goal + ' Guide the conversation step by step so the student can reach this goal. Useful words for them: ' + npc.words.join(', ') + '.',
      'When the goal is reached, praise the student in one short sentence and say goodbye in character.',
    ].join('\n');
  }

  const clean = (v, n) => String(v || '').replace(/[^\p{L}\p{N} .,!?'"’:;()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  function personNpc(d) {
    if (!d || typeof d !== 'object') return null;
    const name = clean(d.name, 30) || 'Friend', g = d.g === 'f' ? 'f' : 'm', kid = !!d.kid;
    const role = clean(d.role, 60) || 'a friendly villager', island = clean(d.island, 40) || 'Echo Island', place = clean(d.place, 30);
    const lines = (Array.isArray(d.lines) ? d.lines : []).slice(0, 5).map(x => clean(x, 160)).filter(Boolean);
    const words = (Array.isArray(d.words) ? d.words : []).slice(0, 10).map(x => clean(x, 24)).filter(Boolean);
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pool = VOICES[(kid ? 'k' : '') + g] || VOICES[g];
    return {
      id: 'dyn', name, zh: name, voice: pool[h % pool.length],
      persona: 'You are ' + name + ', ' + role + ' on ' + island + ' in the Echo Islands. You are ' + (kid ? 'a child' : 'a grown-up') + ', and you are ' + (place || 'outdoors') + ' right now. ' +
        (lines.length ? 'Here are things you have said before, keep the same personality and facts: "' + lines.join('" / "') + '". ' : '') +
        'This island\'s topic is: ' + island.replace(/ Island$/, '') + '.',
      goal: 'Have a friendly, natural chat with ' + name + ': greet each other, ask and answer a few simple questions about each other and about ' + island + '.',
      words: words.length ? words : ['Hello', 'How are you', 'I like', 'What about you'],
      opener: lines[0] || 'Hi there! Nice to meet you!',
    };
  }

  function evalBody(npc, turns) {
    if (!turns.some(t => t.who === 'you' && t.text)) return null;
    const transcript = turns.map(t => (t.who === 'you' ? 'Student: ' : npc.name + ': ') + t.text).join('\n');
    return {
      model: EVAL_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '你是一位温柔的初中英语老师，给一个中国初中生的英语口语对话打分。只输出 JSON：{"done":是否完成目标(true/false),"stars":1到3的整数,"praise":"一句具体的中文表扬（20字以内）","tips":[最多2条，{"said":"学生原句","better":"更好的英文说法","zh":"一句中文解释（20字以内）"}]}。tips 只挑学生原句里最重要的语法或用词错误：better 是把那句原话改对后的说法（意思不变，不要加新内容、不要编学生没说过的事），学生说对了的句子不要放进 tips，没有错误就给空数组。评分宽松，鼓励为主。' },
        { role: 'user', content: '对话目标：' + npc.goal + '\n\n对话记录（学生的话是语音识别出来的，可能有识别错误，不要因为识别错误扣分）：\n' + transcript },
      ],
    };
  }
  function parseEval(j) {
    try {
      const e = JSON.parse(j.choices[0].message.content);
      // 只要「改错」：原句本来就对、只是被加了几个词的（或者一字没改的）不算，免得把说对的句子塞进复习
      const nm = x => String(x || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
      const tips = (e.tips || []).map(t => ({ said: String(t.said || '').slice(0, 120), better: String(t.better || '').slice(0, 120), zh: String(t.zh || '').slice(0, 60) }))
        .filter(t => t.better && nm(t.better) !== nm(t.said) && !nm(t.better).startsWith(nm(t.said) + ' ')).slice(0, 2);
      return { done: !!e.done, stars: Math.max(1, Math.min(3, e.stars | 0 || 1)), praise: String(e.praise || '').slice(0, 60), tips };
    } catch (e) { return null; }
  }

  // 一段对话。o = { npc, player, limitSec, leftSec, up(obj) 发给 Qwen, out(obj) 发给游戏, evaluate(npc, turns) → Promise<评价|null>, onEnd({ turns, sec, eval }), log(...) }
  function session(o) {
    const t0 = Date.now(), turns = [], seen = new Set();
    let npcText = '', appended = 0, closed = false, timer = null;
    const log = o.log || (() => {});
    function start() {   // 连上 Qwen 之后调用
      o.up({ type: 'session.update', session: {
        modalities: ['text', 'audio'], voice: o.npc.voice, instructions: instructions(o.npc, o.player),
        input_audio_format: 'pcm', output_audio_format: 'pcm',
        input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },   // 不强制英语：说中文就显示中文，孩子一看就知道
        turn_detection: null,
      } });
      // 开场白：让岛民先开口
      o.up({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '(The student has just walked up to you. Start the conversation in character, for example: "' + o.npc.opener + '")' }] } });
      o.up({ type: 'response.create' });
      o.out({ type: 'ready', npc: o.npc.id, leftSec: Math.round(o.leftSec), sessionSec: Math.round(o.limitSec) });
      timer = setTimeout(() => { o.out({ type: 'limit', zh: o.leftSec <= o.limitSec ? '今天的聊天时间到了，明天再聊！' : '这段聊得够久啦，休息一下吧！' }); finish(); }, o.limitSec * 1000);
    }
    function fromUp(m) {   // Qwen 发来的事件
      switch (m.type) {
        case 'response.audio.delta': o.out({ type: 'audio', data: m.delta }); break;
        case 'response.audio_transcript.delta': npcText += m.delta || ''; o.out({ type: 'npc', delta: m.delta || '' }); break;
        case 'response.done':
          log('resp', m.response && m.response.id, npcText.slice(0, 60));
          if (m.response && m.response.id) { if (seen.has(m.response.id)) { npcText = ''; break; } seen.add(m.response.id); }
          if (npcText.trim()) turns.push({ who: 'npc', text: npcText.trim() });
          o.out({ type: 'npc_done', text: npcText.trim() }); npcText = ''; break;
        case 'conversation.item.input_audio_transcription.delta': {
          // 孩子还按着话筒在说：边说边把听到的字发给游戏（text 是定下来的那截，stash 是还没定的；两段合起来是目前听到的全部）
          const tx = ((m.text || '') + (m.stash || '')).replace(/<[^>]*>/g, '').trim();
          if (tx && m.item_id && !seen.has(m.item_id)) o.out({ type: 'you_live', text: tx, item: m.item_id });
          break;
        }
        case 'input_audio_buffer.committed':   // 松开话筒：这一段的编号（游戏按编号把字填进对的气泡）
          if (m.item_id) o.out({ type: 'you_item', item: m.item_id });
          break;
        case 'conversation.item.input_audio_transcription.completed': {
          // 识别器对杂音会给 <non_speech> 之类的标记，不算孩子说的话
          const tx = (m.transcript || '').replace(/<[^>]*>/g, '').trim();
          if (tx && !(m.item_id && seen.has(m.item_id))) {
            if (m.item_id) seen.add(m.item_id);
            turns.push({ who: 'you', text: tx }); o.out({ type: 'you', text: tx, item: m.item_id || '' });
            log('asr', m.item_id, tx);
          }
          break;
        }
        case 'error':
          log('upstream error', JSON.stringify(m).slice(0, 300));
          if (/no(ne)? active response|not active/i.test((m.error && m.error.message) || '')) break;   // 取消了一个已经说完的回答，不算错
          o.out({ type: 'error', code: 'upstream', zh: '对话服务出了点问题：' + String((m.error && m.error.message) || '').slice(0, 80) });
          break;
      }
    }
    function fromGame(m) {   // 游戏发来的消息
      if (closed || !m) return;
      if (m.type === 'audio' && typeof m.data === 'string' && m.data.length < 200000) {
        appended += m.data.length * 0.75 / 32;   // 16kHz 16 位单声道：每毫秒 32 字节
        o.up({ type: 'input_audio_buffer.append', audio: m.data });
      } else if (m.type === 'commit') {
        if (appended >= 300) { o.up({ type: 'input_audio_buffer.commit' }); o.up({ type: 'response.create' }); }
        else o.up({ type: 'input_audio_buffer.clear' });
        appended = 0;
      } else if (m.type === 'cancel') {
        o.up({ type: 'response.cancel' });
      } else if (m.type === 'text' && typeof m.text === 'string' && m.text.trim()) {
        const text = m.text.trim().slice(0, 200);
        turns.push({ who: 'you', text });
        o.up({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
        o.up({ type: 'response.create' });
      } else if (m.type === 'end') finish();
    }
    async function finish() {
      if (closed) return; closed = true;
      clearTimeout(timer);
      const sec = (Date.now() - t0) / 1000;
      let ev = null;
      try { ev = await o.evaluate(o.npc, turns); } catch (e) { ev = null; }
      if (o.onEnd) ev = o.onEnd({ turns, sec, eval: ev }) || ev;
      o.out({ type: 'eval', eval: ev, sec: Math.round(sec), left: Math.max(0, Math.round(o.leftSec - sec)) });
    }
    function upClosed(why) { if (!closed) { o.out({ type: 'error', code: 'closed', zh: why || '对话连接断开了' }); finish(); } }
    return { start, fromUp, fromGame, finish, upClosed, get closed() { return closed; }, turns };
  }

  const api = { VOICES, MODEL, REALTIME_URL, EVAL_URL, EVAL_MODEL, instructions, personNpc, evalBody, parseEval, session };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TalkCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
