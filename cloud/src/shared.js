// 和游戏共用的文件：直接从仓库根目录引进来（wrangler 打包时一起打进去），不复制。
// 这几个文件末尾本来就是「有 module.exports 就导出给 Node」的写法，打包工具把它们当 CommonJS 处理，这里不用改它们。
// talk-core.js 在 Node 环境里会 require('./i18n.js')（界面上的几句话：时间到了、连接断了），打包时一起带上。
import CORE from '../../talk-core.js';
import NPCS from '../../talk-npcs.js';
import QUESTS from '../../quests.js';
import PLACE from '../../placement-data.js';

export { CORE, NPCS, QUESTS, PLACE };
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// 岛民：按 id 查（只认自己的键，'constructor' 之类不算）
export const npcById = id => (own(NPCS.byId, id) ? NPCS.byId[id] : null);
// 支线委托：只认 quests.js 里有的 id（和中转服务的 questNpc 一样）
export const questNpc = id => { id = String(id || ''); return own(QUESTS.byId, id) ? CORE.questNpc(QUESTS.byId[id]) : null; };
export const placeBank = lang => (own(PLACE, lang) ? PLACE[lang].items : []);
