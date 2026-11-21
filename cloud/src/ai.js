// 按次计的 AI 调用：/v1/asr、/tip、/tts、/zh、/steps、/place。做法和中转服务（server/relay.js 的 cloudHelp）一样：
// 提示词都在 talk-core.js 里拼，手机只发数据（题目按 id 查、岛民按 id 查），不能自己写提示词。API.md §8
import { HttpError, bad, json, clean, readJson } from './util.js';
import { CORE, npcById, questNpc, placeBank } from './shared.js';
import { dsPost, EVAL_PATH, TTS_PATH, ProviderError } from './upstream.js';
import { take, refund } from './quota.js';
import { aiLimit } from './ratelimit.js';
import { requireConsent } from './me.js';
import { speechLang, talkLang, questLang, tipLang, noLang, SPEECH_KNOWN } from './config.js';

const METER = { asr: 'asr', tip: 'aux', tts: 'aux', zh: 'aux', steps: 'aux', place: 'aux' };
const GATE = { steps: 'steps', place: 'place' };

// 每个调用：先看输入对不对（不对不扣次数）→ 扣一次 → 调上游（失败退回）
const H = {
  async asr(R, j) {
    if (typeof j.audio !== 'string' || j.audio.length < 1000) throw bad('audio');
    const language = speechLang(R.cfg, j.lang);   // 别的语言的课：es / ja / zh；没给 = en（和以前一字不差）
    return async () => {
      const r = await dsPost(R, EVAL_PATH, { model: R.cfg.ds.asrModel, stream: false, asr_options: { language, enable_itn: false }, messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + j.audio } }] }] });
      return { text: String((r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '').trim() };
    };
  },
  // lang：别的语言的课的发音点评（这句话是哪门语言；没给 / en = 英语，和以前一字不差）。不在 tipLangs 里的：400（不扣次数、不连上游）
  async tip(R, j) {
    const lang = tipLang(R.cfg, j.lang), cl = lang ? CORE.cleanText : clean;   // 别的语言留着这门语言的标点和重音符号
    const target = cl(j.target, 200), heard = cl(j.heard, 200);
    if (!target || !heard) throw bad(target ? 'heard' : 'target');
    const body = CORE.tipBody(target, heard, j.ui, lang); body.model = R.cfg.ds.evalModel;
    return async () => ({ tip: CORE.parseTip(await dsPost(R, EVAL_PATH, body), j.ui) });
  },
  async tts(R, j) {
    const text = clean(j.text, 300); if (!text) throw bad('text');
    // lang：en / es / ja / zh（以前的 "English" / "Chinese" 照样认）；英语用原来的音色，别的语言用 TTS_VOICES 里那门语言的
    const code = speechLang(R.cfg, j.lang, true), voices = code === 'en' ? R.cfg.ds.ttsVoice : R.cfg.ds.ttsVoices[code];
    return async () => {
      const o = await dsPost(R, TTS_PATH, { model: R.cfg.ds.ttsModel, input: { text, voice: j.g === 'm' ? voices.m : voices.f, language_type: SPEECH_KNOWN[code] } });
      const url = o.output && o.output.audio && o.output.audio.url;
      if (!url) throw new ProviderError(o.code || 'no-url');
      return { url: String(url).replace(/^http:/, 'https:') };
    };
  },
  // lang：这句话是哪门语言（别的语言的课；没给 = 英语）；ui：翻成哪种界面语言（zh 中文 / en 英文；没给、认不得 = 中文）。
  // 都没给 = 和以前一字不差（英文 → 中文）。回答的字段名照旧叫 zh
  async zh(R, j) {
    const lang = talkLang(R.cfg, j.lang);   // 不认得的、关掉的语言：400（不扣次数、不连上游）
    const text = lang ? CORE.cleanText(j.text, 400) : clean(j.text, 400); if (!text) throw bad('text');
    const body = CORE.zhBody(text, { lang, ui: j.ui });
    if (!body) throw bad('ui', 'Nothing to translate: the text is already in that language');
    body.model = R.cfg.ds.evalModel;
    return async () => ({ zh: CORE.parseZh(await dsPost(R, EVAL_PATH, body)) });
  },
  // npc 可以是别的语言的课的角色 id（talk-courses.js）；npc=dyn 时 lang 说地图上那个人说哪门语言（没给 = 英语）；
  // q（委托的 id）+ lang：别的语言的课里的委托（步骤的示范句是这门语言的；这门语言没有这条委托的译文：400 unsupported_lang）
  async steps(R, j) {
    const npc = j.q ? questNpc(j.q, questLang(R.cfg, j.lang), R.cfg.quests) : j.npc === 'dyn' ? CORE.personNpc({ name: j.nm, lang: talkLang(R.cfg, j.lang) }) : npcById(j.npc);
    if (npc === undefined) throw noLang(R.cfg.questLangs);
    if (!npc) throw bad('npc', 'Unknown islander');
    const lang = talkLang(R.cfg, npc.lang), cl = lang ? CORE.cleanText : clean;   // 课程角色的语言服务器没开：400
    const turns = (Array.isArray(j.turns) ? j.turns : []).slice(-30).map(t => ({ who: t && t.who === 'you' ? 'you' : 'npc', text: cl(t && t.text, 300), typed: !!(t && t.typed) })).filter(t => t.text);
    const g = CORE.goalOf(npc, j.g), body = CORE.stepsBody(npc, g.i, turns, j.ui);
    if (!body) return null;   // 只打了字：不用问 AI（和中转服务一样回空，不扣次数）
    body.model = R.cfg.ds.evalModel;
    return async () => ({ done: CORE.parseSteps(await dsPost(R, EVAL_PATH, body), g.steps.length) });
  },
  async place(R, j) {
    const lang = /^[a-z]{2,3}$/.test(String(j.lang || '')) ? String(j.lang) : 'en', id = String(j.id || '');
    const item = placeBank(lang).find(x => x.id === id && x.skill === 'speak' && x.kind === 'answer');
    if (!item) throw bad('id', 'Unknown placement item');
    const body = CORE.placeBody(item, clean(j.heard, 500), { lang }); if (!body) throw bad('heard');
    body.model = R.cfg.ds.evalModel;
    return async () => { const r = CORE.parsePlace(await dsPost(R, EVAL_PATH, body)); if (!r) throw new ProviderError('score'); return r; };
  },
};
export const AI_PATHS = Object.keys(H);

export async function aiCall(R, U, name) {
  await aiLimit(R, U);
  if (GATE[name]) requireConsent(R, U, GATE[name]);
  const j = await readJson(R.req, name === 'asr' ? R.cfg.limits.asrBytes : R.cfg.limits.jsonBytes);
  const run = await H[name](R, j);
  if (!run) return json(200, { done: [] });
  const t = await take(R, U, METER[name]);
  try {
    const out = await run();
    return json(200, Object.assign(out, { quota: { meter: t.meter, left: t.left } }));
  } catch (e) {
    await refund(R, U, t).catch(() => {});
    if (e instanceof HttpError) throw e;
    throw new ProviderError('error');
  }
}
