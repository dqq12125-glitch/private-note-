// 跑测试时收集「没有配音的句子」：NODE_OPTIONS="--require ./tools/voice/misshook.js" npm test
// 给 playwright 开的每个浏览器挂上控制台监听，game.js 在自动化测试里遇到没配音的句子会打印 [voice-miss]["句子","f|m|"]
// 结果追加到 tools/voice/misses.jsonl，之后 node tools/voice/collect.js 会把它们并进 lines.json
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'misses.jsonl');
const Module = require('module');
const orig = Module.prototype.require;
let patched = false;
Module.prototype.require = function (id) {
  const m = orig.apply(this, arguments);
  if (!patched && /(^|[\\/])playwright$/.test(id) && m && m.chromium) {
    patched = true;
    const launch = m.chromium.launch.bind(m.chromium);
    m.chromium.launch = async (...a) => {
      const b = await launch(...a);
      const newContext = b.newContext.bind(b);
      b.newContext = async (...c) => {
        const ctx = await newContext(...c);
        ctx.on('console', msg => {
          const t = msg.text();
          if (t.startsWith('[voice-miss]')) { try { fs.appendFileSync(OUT, t.slice(12) + '\n'); } catch (e) {} }
        });
        return ctx;
      };
      return b;
    };
  }
  return m;
};
