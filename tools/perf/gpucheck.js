// 看无头浏览器能不能用上真显卡（用得上，量出来的帧时间才有意义）
const { chromium } = require('playwright');
(async () => {
  for (const [name, o] of [['default', {}], ['d3d11', { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] }], ['chrome-new', { channel: 'chromium', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] }]]) {
    try {
      const b = await chromium.launch(o);
      const p = await b.newPage();
      const r = await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no webgl2'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'no ext'; });
      console.log(name, '=>', r);
      await b.close();
    } catch (e) { console.log(name, 'ERR', e.message.split('\n')[0]); }
  }
})();
