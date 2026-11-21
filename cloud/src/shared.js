// 和游戏共用的文件：直接从仓库根目录引进来（wrangler 打包时一起打进去），不复制。
// 这几个文件末尾本来就是「有 module.exports 就导出给 Node」的写法，打包工具把它们当 CommonJS 处理，这里不用改它们。
// talk-core.js 在 Node 环境里会 require('./i18n.js')（界面上的几句话：时间到了、连接断了），打包时一起带上。
// talk-courses.js：别的语言的课（西语 / 日语 / 中文）的聊天角色，tools/course/build.js --talk 生成（tools/course/TALK.md §1）
import CORE from '../../talk-core.js';
import NPCS from '../../talk-npcs.js';
import COURSES from '../../talk-courses.js';
import QUESTS from '../../quests.js';
import PLACE from '../../placement-data.js';

export { CORE, NPCS, COURSES, QUESTS, PLACE };
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// 岛民：按 id 查（只认自己的键，'constructor' 之类不算）。先查英语的表，再查别的语言的课的角色（id 形如 es1-u1，和英语的不会重）
export const npcById = id => (own(NPCS.byId, id) ? NPCS.byId[id] : own(COURSES.byId, id) ? COURSES.byId[id] : null);
// 支线委托：只认 quests.js 里有的 id（和中转服务的 questNpc 一样）
export const questNpc = id => { id = String(id || ''); return own(QUESTS.byId, id) ? CORE.questNpc(QUESTS.byId[id]) : null; };
export const placeBank = lang => (own(PLACE, lang) ? PLACE[lang].items : []);
