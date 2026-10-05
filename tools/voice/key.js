// 配音文件名 = 规范化文本的 FNV-1a 32 位哈希（36 进制）。游戏里 game.js 用同样的算法找文件，改了两边要一起改
'use strict';
function norm(t) {
  return String(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}
function key(t) {
  const s = norm(t);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
module.exports = { norm, key };
