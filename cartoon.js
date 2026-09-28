// 回声岛 · 对话动画的角色和场景（全部用 SVG 画，不需要图片文件）
(function () {
  'use strict';

  // 角色造型：发型、衣服、下装颜色
  const CHARS = {
    Lily: { hair: 'pigtails', hairColor: '#3b2a20', shirt: '#ff7fa8', bottom: 'skirt', bottomColor: '#4f6db8' },
    Tom: { hair: 'short', hairColor: '#2b2b2b', shirt: '#3a86ff', bottom: 'pants', bottomColor: '#2e3a59', collar: '#ffffff' },
    'Ms Wang': { hair: 'bun', hairColor: '#1f1a17', shirt: '#2cae69', bottom: 'skirt', bottomColor: '#34495e', glasses: true, tall: true },
    Waiter: { hair: 'chef', hairColor: '#2b2b2b', shirt: '#f4f4f4', bottom: 'pants', bottomColor: '#333333', apron: '#ff6b57' },
  };
  const SKIN = '#ffdcc2';

  const HAIR_BACK = {
    pigtails: c => '<circle cx="24" cy="66" r="12" fill="' + c + '"/><circle cx="96" cy="66" r="12" fill="' + c + '"/>' +
      '<circle cx="31" cy="56" r="4" fill="#ff4d6d"/><circle cx="89" cy="56" r="4" fill="#ff4d6d"/>',
    bun: c => '<circle cx="60" cy="20" r="13" fill="' + c + '"/>',
    short: () => '',
    chef: () => '',
  };
  const HAIR_FRONT = {
    pigtails: c => '<path d="M28 60 Q25 22 60 22 Q95 22 92 60 Q88 42 72 38 Q62 48 44 42 Q34 46 28 60 Z" fill="' + c + '"/>',
    bun: c => '<path d="M28 60 Q25 24 60 24 Q95 24 92 60 Q84 40 60 38 Q36 40 28 60 Z" fill="' + c + '"/>',
    short: c => '<path d="M27 56 Q26 20 60 20 Q94 20 93 56 Q88 40 78 36 Q72 46 60 38 Q50 46 42 38 Q32 42 27 56 Z" fill="' + c + '"/>',
    chef: c => '<path d="M28 50 Q30 38 40 36 L80 36 Q90 38 92 50 Q84 44 60 44 Q36 44 28 50 Z" fill="' + c + '"/>' +
      '<path d="M34 38 L86 38 L85 22 Q98 16 90 5 Q82 -4 71 4 Q62 -7 50 4 Q39 -4 31 5 Q23 16 35 22 Z" fill="#ffffff" stroke="#d9d9d9" stroke-width="1.5"/>' +
      '<rect x="34" y="30" width="52" height="10" rx="3" fill="#ffffff" stroke="#d9d9d9" stroke-width="1.5"/>',
  };

  function actorSVG(name) {
    const c = CHARS[name];
    if (!c) return '';
    const legs = c.bottom === 'skirt'
      ? '<rect x="46" y="166" width="9" height="30" rx="4" fill="' + SKIN + '"/><rect x="65" y="166" width="9" height="30" rx="4" fill="' + SKIN + '"/>' +
        '<path d="M38 140 L82 140 L90 172 L30 172 Z" fill="' + c.bottomColor + '"/>'
      : '<rect x="43" y="138" width="15" height="58" rx="5" fill="' + c.bottomColor + '"/><rect x="62" y="138" width="15" height="58" rx="5" fill="' + c.bottomColor + '"/>';
    const shoes = '<ellipse cx="50" cy="199" rx="11" ry="5.5" fill="#3b2f2f"/><ellipse cx="70" cy="199" rx="11" ry="5.5" fill="#3b2f2f"/>';
    const body = '<path d="M36 102 Q36 90 48 88 L72 88 Q84 90 84 102 L84 146 L36 146 Z" fill="' + c.shirt + '"/>' +
      (c.collar ? '<path d="M50 88 L60 100 L70 88 Z" fill="' + c.collar + '"/>' : '') +
      (c.apron ? '<path d="M44 104 L76 104 L78 150 L42 150 Z" fill="' + c.apron + '"/>' : '') +
      (c.shirt === '#f4f4f4' ? '<path d="M36 102 Q36 90 48 88 L72 88 Q84 90 84 102 L84 146 L36 146 Z" fill="none" stroke="#d9d9d9" stroke-width="1.5"/>' : '');
    const arm = (side) => {
      const x = side === 'l' ? 24 : 84, cx = side === 'l' ? 30 : 90;
      return '<g class="arm arm-' + side + '" style="transform-origin:' + cx + 'px 94px"><rect x="' + x + '" y="90" width="12" height="46" rx="6" fill="' + c.shirt + '"' +
        (c.shirt === '#f4f4f4' ? ' stroke="#d9d9d9" stroke-width="1.5"' : '') + '/><circle cx="' + cx + '" cy="139" r="6.5" fill="' + SKIN + '"/></g>';
    };
    const face =
      '<g class="eyes"><ellipse cx="48" cy="58" rx="3.8" ry="4.8" fill="#2b2b2b"/><ellipse cx="72" cy="58" rx="3.8" ry="4.8" fill="#2b2b2b"/>' +
      '<circle cx="49.3" cy="56.4" r="1.3" fill="#fff"/><circle cx="73.3" cy="56.4" r="1.3" fill="#fff"/></g>' +
      '<path d="M42 49 Q48 46 53 49 M67 49 Q72 46 78 49" stroke="' + c.hairColor + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="41" cy="68" r="5" fill="#ff9aa2" opacity=".55"/><circle cx="79" cy="68" r="5" fill="#ff9aa2" opacity=".55"/>' +
      '<path class="m-c" d="M53 72 Q60 78 67 72" stroke="#8a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<g class="m-o"><ellipse cx="60" cy="74" rx="6.5" ry="5.5" fill="#7a2b22"/><ellipse cx="60" cy="77" rx="3.8" ry="2" fill="#ff8a8a"/></g>' +
      (c.glasses ? '<g stroke="#333" stroke-width="1.8" fill="none"><circle cx="48" cy="58" r="8"/><circle cx="72" cy="58" r="8"/><path d="M56 58 L64 58"/></g>' : '');
    return '<svg class="toon' + (c.tall ? ' tall' : '') + '" viewBox="0 -12 120 222" aria-hidden="true">' +
      '<g class="toon-body">' +
      HAIR_BACK[c.hair](c.hairColor) + legs + shoes + arm('l') + arm('r') + body +
      '<rect x="54" y="80" width="12" height="12" fill="' + SKIN + '"/>' +
      '<g class="head" style="transform-origin:60px 86px">' +
      '<circle cx="28" cy="60" r="6" fill="' + SKIN + '"/><circle cx="92" cy="60" r="6" fill="' + SKIN + '"/>' +
      '<circle cx="60" cy="56" r="32" fill="' + SKIN + '"/>' + HAIR_FRONT[c.hair](c.hairColor) + face + '</g>' +
      '</g></svg>';
  }

  // ---------- 场景背景 ----------
  const sky = '<rect width="400" height="300" fill="#bfe9ff"/><circle cx="350" cy="46" r="22" fill="#ffd54a"/>' +
    '<g fill="#ffffff" opacity=".9"><ellipse cx="80" cy="50" rx="30" ry="12"/><ellipse cx="105" cy="44" rx="20" ry="12"/><ellipse cx="250" cy="70" rx="26" ry="10"/></g>';
  const tree = (x, y, s) => '<rect x="' + (x - 4 * s) + '" y="' + y + '" width="' + 8 * s + '" height="' + 34 * s + '" fill="#8b5a2b"/>' +
    '<circle cx="' + x + '" cy="' + (y - 6 * s) + '" r="' + 24 * s + '" fill="#4caf50"/><circle cx="' + (x - 14 * s) + '" cy="' + (y + 6 * s) + '" r="' + 14 * s + '" fill="#43a047"/>';
  const planks = (y, color) => '<rect y="' + y + '" width="400" height="' + (300 - y) + '" fill="' + color + '"/>' +
    [0, 1, 2, 3].map(i => '<line x1="0" y1="' + (y + 12 + i * 14) + '" x2="400" y2="' + (y + 12 + i * 14) + '" stroke="rgba(0,0,0,.08)" stroke-width="2"/>').join('');
  const window_ = (x, y) => '<rect x="' + x + '" y="' + y + '" width="64" height="72" rx="4" fill="#bfe9ff" stroke="#ffffff" stroke-width="6"/>' +
    '<line x1="' + (x + 32) + '" y1="' + y + '" x2="' + (x + 32) + '" y2="' + (y + 72) + '" stroke="#fff" stroke-width="4"/>' +
    '<line x1="' + x + '" y1="' + (y + 36) + '" x2="' + (x + 64) + '" y2="' + (y + 36) + '" stroke="#fff" stroke-width="4"/>';
  const txt = (x, y, s, size, color) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" font-weight="700" fill="' + color + '" text-anchor="middle" font-family="Baloo 2, Nunito, sans-serif">' + s + '</text>';

  const SETS = {
    classroom: () => '<rect width="400" height="300" fill="#fff3d6"/>' + window_(24, 52) +
      '<rect x="116" y="44" width="176" height="92" rx="6" fill="#2f5d50" stroke="#8b5a2b" stroke-width="7"/>' +
      txt(204, 86, 'English', 22, '#ffffff') + txt(204, 114, 'Hello!  你好', 14, '#d7f5e9') +
      '<circle cx="350" cy="68" r="20" fill="#fff" stroke="#8b5a2b" stroke-width="4"/><path d="M350 68 L350 56 M350 68 L359 72" stroke="#333" stroke-width="3" stroke-linecap="round"/>' +
      planks(232, '#d9a86c'),
    gate: () => sky + '<rect y="210" width="400" height="90" fill="#9bd08a"/><path d="M160 300 L186 210 L214 210 L240 300 Z" fill="#e8d9b5"/>' +
      '<rect x="112" y="92" width="176" height="118" fill="#f4d6a0"/><rect x="104" y="84" width="192" height="14" fill="#e07a5f"/>' +
      [0, 1, 2].map(r => [0, 1, 2, 3].map(k => '<rect x="' + (128 + k * 40) + '" y="' + (108 + r * 30) + '" width="22" height="18" fill="#bfe9ff"/>').join('')).join('') +
      '<rect x="182" y="176" width="36" height="34" fill="#8b5a2b"/>' + txt(200, 78, 'Echo Middle School', 13, '#12304a') +
      '<line x1="330" y1="80" x2="330" y2="210" stroke="#999" stroke-width="3"/><path d="M330 82 L360 90 L330 98 Z" fill="#e63946"/>' + tree(50, 176, 1),
    campus: () => sky + '<rect y="214" width="400" height="86" fill="#9bd08a"/>' +
      '<rect x="30" y="110" width="110" height="104" fill="#f7c59f"/>' + txt(85, 102, 'Library', 14, '#12304a') +
      '<rect x="260" y="120" width="110" height="94" fill="#a8dadc"/>' + txt(315, 112, 'Gym', 14, '#12304a') +
      [0, 1].map(r => [0, 1, 2].map(k => '<rect x="' + (42 + k * 32) + '" y="' + (124 + r * 32) + '" width="20" height="18" fill="#fff8e6"/>').join('')).join('') +
      '<rect x="296" y="170" width="38" height="44" fill="#457b9d"/>' + tree(200, 186, .9),
    living: () => '<rect width="400" height="300" fill="#fde2e4"/>' + planks(232, '#c8a27c') +
      '<rect x="120" y="40" width="70" height="54" rx="3" fill="#fff" stroke="#8b5a2b" stroke-width="5"/>' +
      '<g fill="#f4a261"><circle cx="140" cy="68" r="7"/><circle cx="156" cy="64" r="8"/><circle cx="172" cy="70" r="6"/></g>' +
      '<rect x="214" y="52" width="46" height="40" rx="3" fill="#fff" stroke="#8b5a2b" stroke-width="5"/><path d="M220 86 L232 68 L242 80 L248 72 L256 86 Z" fill="#6a994e"/>' +
      '<rect x="130" y="176" width="140" height="44" rx="12" fill="#7fb3d5"/><rect x="122" y="160" width="156" height="30" rx="12" fill="#6aa3c8"/>' +
      '<rect x="330" y="120" width="6" height="100" fill="#666"/><path d="M314 124 L352 124 L342 96 L324 96 Z" fill="#ffd166"/>',
    club: () => '<rect width="400" height="300" fill="#e8f0ff"/>' + planks(232, '#cbb89d') +
      '<path d="M0 30 Q200 70 400 30" stroke="#666" stroke-width="2" fill="none"/>' +
      ['#ff6b57', '#ffc53d', '#2cae69', '#3a86ff', '#8e6cef', '#ff5e9c', '#ff6b57', '#ffc53d'].map((col, i) => { const x = 20 + i * 48, y = 34 + Math.sin(i / 7 * Math.PI) * 18; return '<path d="M' + x + ' ' + y + ' L' + (x + 24) + ' ' + y + ' L' + (x + 12) + ' ' + (y + 24) + ' Z" fill="' + col + '"/>'; }).join('') +
      '<rect x="130" y="84" width="140" height="56" rx="8" fill="#fff" stroke="#3a86ff" stroke-width="4"/>' + txt(200, 110, 'Join our club!', 17, '#3a86ff') + txt(200, 130, '♪ Music  ♟ Chess  🎨 Art', 12, '#4a6478') +
      '<rect x="120" y="176" width="160" height="16" fill="#8b5a2b"/><rect x="132" y="192" width="8" height="40" fill="#8b5a2b"/><rect x="260" y="192" width="8" height="40" fill="#8b5a2b"/>' +
      '<g class="float" fill="#8e6cef" font-size="22">' + txt(60, 150, '♪', 26, '#8e6cef') + txt(340, 130, '♫', 26, '#ff5e9c') + '</g>',
    street: () => sky + '<rect y="200" width="400" height="100" fill="#9e9e9e"/><rect y="196" width="400" height="10" fill="#cfcfcf"/>' +
      [0, 1, 2, 3, 4].map(i => '<rect x="' + (10 + i * 84) + '" y="250" width="44" height="6" fill="#fff"/>').join('') +
      '<rect x="20" y="104" width="80" height="92" fill="#f4a261"/><path d="M14 108 L60 76 L106 108 Z" fill="#e76f51"/>' +
      '<rect x="300" y="96" width="80" height="100" fill="#90be6d"/><path d="M294 100 L340 70 L386 100 Z" fill="#577590"/>' +
      '<line x1="200" y1="110" x2="200" y2="200" stroke="#666" stroke-width="4"/><rect x="178" y="96" width="44" height="26" rx="4" fill="#2a9d8f"/>' + txt(200, 114, 'BUS', 13, '#fff'),
    party: () => '<rect width="400" height="300" fill="#fff0f5"/>' + planks(232, '#e0b98f') +
      ['#ff6b57', '#ffc53d', '#2cae69', '#3a86ff', '#8e6cef', '#ff5e9c', '#ff6b57', '#ffc53d'].map((col, i) => '<path d="M' + (8 + i * 50) + ' 20 L' + (40 + i * 50) + ' 20 L' + (24 + i * 50) + ' 46 Z" fill="' + col + '"/>').join('') +
      txt(200, 84, 'Happy Birthday!', 24, '#e63946') +
      '<g class="float">' + [['#ff6b57', 50, 110], ['#3a86ff', 90, 90], ['#ffc53d', 320, 100], ['#2cae69', 356, 120]].map(([col, x, y]) => '<line x1="' + x + '" y1="' + (y + 24) + '" x2="' + x + '" y2="' + (y + 90) + '" stroke="#999"/><ellipse cx="' + x + '" cy="' + y + '" rx="18" ry="24" fill="' + col + '"/>').join('') + '</g>' +
      '<rect x="150" y="186" width="100" height="14" fill="#8b5a2b"/><rect x="170" y="150" width="60" height="36" rx="6" fill="#ffb4c6"/><rect x="170" y="150" width="60" height="10" rx="5" fill="#fff"/>' +
      '<rect x="198" y="132" width="4" height="18" fill="#3a86ff"/><path class="flame" d="M200 120 Q206 128 200 134 Q194 128 200 120 Z" fill="#ffb703"/>',
    zoo: () => sky + '<rect y="200" width="400" height="100" fill="#8bc34a"/>' +
      [0, 1, 2, 3, 4, 5].map(i => '<rect x="' + (140 + i * 22) + '" y="80" width="8" height="126" fill="#7cb342"/><rect x="' + (140 + i * 22) + '" y="120" width="8" height="3" fill="#558b2f"/>').join('') +
      '<rect y="186" width="400" height="8" fill="#a1887f"/>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => '<rect x="' + (8 + i * 40) + '" y="170" width="6" height="40" fill="#a1887f"/>').join('') +
      '<g transform="translate(200 170)"><ellipse cx="0" cy="14" rx="26" ry="20" fill="#fff"/><circle cx="0" cy="-12" r="18" fill="#fff"/><circle cx="-13" cy="-26" r="6" fill="#222"/><circle cx="13" cy="-26" r="6" fill="#222"/>' +
      '<ellipse cx="-7" cy="-13" rx="5" ry="6" fill="#222"/><ellipse cx="7" cy="-13" rx="5" ry="6" fill="#222"/><circle cx="0" cy="-5" r="2.5" fill="#222"/></g>' +
      '<rect x="20" y="90" width="80" height="30" rx="4" fill="#8b5a2b"/>' + txt(60, 110, 'ZOO', 16, '#fff') + tree(360, 160, 1),
    hallway: () => '<rect width="400" height="300" fill="#e3ecf3"/><rect y="222" width="400" height="78" fill="#b7c4cf"/>' +
      [30, 150, 270].map(x => '<rect x="' + x + '" y="84" width="90" height="138" rx="3" fill="#8d6e63"/><rect x="' + (x + 20) + '" y="100" width="50" height="40" fill="#bfe9ff"/><circle cx="' + (x + 76) + '" cy="160" r="4" fill="#ffd54a"/>').join('') +
      '<circle cx="200" cy="44" r="24" fill="#fff" stroke="#e63946" stroke-width="5"/><path d="M183 61 L217 27" stroke="#e63946" stroke-width="5"/>' + txt(200, 50, '🏃', 18, '#333') +
      txt(80, 76, 'Class 5', 12, '#4a6478') + txt(320, 76, 'Office', 12, '#4a6478'),
    shop: () => '<rect width="400" height="300" fill="#ffe8cc"/>' + planks(236, '#b08968') +
      [60, 340].map(x => '<line x1="' + x + '" y1="0" x2="' + x + '" y2="24" stroke="#8b5a2b" stroke-width="2"/><ellipse cx="' + x + '" cy="44" rx="20" ry="24" fill="#e63946"/><rect x="' + (x - 8) + '" y="16" width="16" height="6" fill="#ffc53d"/><rect x="' + (x - 8) + '" y="66" width="16" height="6" fill="#ffc53d"/>').join('') +
      '<rect x="120" y="36" width="160" height="90" rx="8" fill="#5d4037"/>' + txt(200, 64, 'MENU', 16, '#ffc53d') + txt(200, 88, 'Beef noodles  ¥15', 12, '#fff') + txt(200, 108, 'Dumplings  ¥12', 12, '#fff') +
      '<rect x="0" y="180" width="400" height="18" fill="#8b5a2b"/>' +
      '<path d="M178 176 Q200 196 222 176 Z" fill="#fff" stroke="#ddd"/><g class="steam" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M192 170 Q188 160 194 152"/><path d="M206 170 Q202 158 208 150"/></g>',
    phone: () => '<rect width="200" height="300" fill="#bfe9ff"/><rect x="200" width="200" height="300" fill="#d6e2ee"/>' +
      '<circle cx="150" cy="44" r="18" fill="#ffd54a"/><rect y="220" width="200" height="80" fill="#9bd08a"/><rect x="200" y="220" width="200" height="80" fill="#ffffff"/>' +
      '<rect x="60" y="120" width="70" height="100" fill="#f4a261"/>' + txt(100, 110, 'Beijing', 14, '#12304a') + txt(300, 110, 'Harbin', 14, '#12304a') +
      '<rect x="270" y="130" width="70" height="90" fill="#adb5bd"/><path d="M262 132 L305 108 L348 132 Z" fill="#ffffff"/>' +
      '<line x1="200" y1="0" x2="200" y2="300" stroke="#ffffff" stroke-width="6"/>' +
      '<g class="snow" fill="#ffffff">' + [[220, 20], [260, 60], [300, 10], [340, 50], [380, 30], [240, 100], [360, 90], [320, 140]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="3.5"/>').join('') + '</g>',
  };

  function setSVG(name) {
    const f = SETS[name];
    if (!f) return '';
    return '<svg class="set-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + f() + '</svg>';
  }

  // ---------- 怪兽：用参数拼出身体、耳朵、尾巴和进化后的装饰 ----------
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const BODY = { round: [74, 36, 34], tall: [70, 31, 40], wide: [78, 44, 30] };
  function monsterSVG(sp) {
    const [cy, rx, ry] = BODY[sp.shape] || BODY.round;
    const top = cy - ry, col = sp.color, dk = shade(col, .78), acc = sp.accent || '#ffca28';
    const bx = 60 + rx * .88, by = cy + ry * .3;
    let back = '', front = '';
    // 尾巴（画在身体后面）
    const tails = {
      flame: '<path d="M0 0 Q26 -4 24 -34 Q16 -20 10 -26 Q12 -40 2 -50 Q-2 -30 -8 -22 Q-12 -10 0 0 Z" fill="#ff7043"/><path d="M2 -5 Q16 -8 14 -24 Q8 -16 4 -20 Q2 -12 2 -5 Z" fill="#ffca28"/>',
      fin: '<path d="M-2 0 L24 -20 Q18 0 24 20 Z" fill="' + dk + '"/>',
      leaf: '<path d="M-2 0 Q16 -32 40 -22 Q26 -2 -2 0 Z" fill="#66bb6a"/><path d="M2 -2 Q18 -14 34 -20" stroke="#388e3c" stroke-width="2" fill="none"/>',
      bolt: '<path d="M-2 0 L14 -10 L8 -14 L26 -32 L14 -16 L20 -12 Z" fill="#ffca28" stroke="#e6a800" stroke-width="2" stroke-linejoin="round"/>',
    };
    if (tails[sp.tail]) back += '<g class="m-tail" style="transform-origin:' + bx + 'px ' + by + 'px"><g transform="translate(' + bx + ' ' + by + ')">' + tails[sp.tail] + '</g></g>';
    if (sp.extra === 'wings') {
      back += '<path d="M' + (60 - rx * .5) + ' ' + (cy - 8) + ' Q' + (60 - rx - 30) + ' ' + (cy - 46) + ' ' + (60 - rx - 16) + ' ' + (cy + 4) + ' Z" fill="rgba(255,255,255,.9)" stroke="' + dk + '" stroke-width="2"/>' +
        '<path d="M' + (60 + rx * .5) + ' ' + (cy - 8) + ' Q' + (60 + rx + 30) + ' ' + (cy - 46) + ' ' + (60 + rx + 16) + ' ' + (cy + 4) + ' Z" fill="rgba(255,255,255,.9)" stroke="' + dk + '" stroke-width="2"/>';
    }
    if (sp.extra === 'mane') {
      for (let k = 0; k < 9; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        back += '<circle cx="' + (60 + Math.cos(a) * (rx + 4)) + '" cy="' + (cy - 6 + Math.sin(a) * (ry + 2)) + '" r="11" fill="' + acc + '"/>';
      }
    }
    // 耳朵 / 头顶
    const ears = {
      cat: '<path d="M' + (60 - rx * .78) + ' ' + (top + 16) + ' L' + (60 - rx * .5) + ' ' + (top - 16) + ' L' + (60 - rx * .08) + ' ' + (top + 5) + ' Z" fill="' + col + '"/><path d="M' + (60 - rx * .66) + ' ' + (top + 11) + ' L' + (60 - rx * .5) + ' ' + (top - 6) + ' L' + (60 - rx * .24) + ' ' + (top + 7) + ' Z" fill="' + sp.belly + '"/>' +
        '<path d="M' + (60 + rx * .78) + ' ' + (top + 16) + ' L' + (60 + rx * .5) + ' ' + (top - 16) + ' L' + (60 + rx * .08) + ' ' + (top + 5) + ' Z" fill="' + col + '"/><path d="M' + (60 + rx * .66) + ' ' + (top + 11) + ' L' + (60 + rx * .5) + ' ' + (top - 6) + ' L' + (60 + rx * .24) + ' ' + (top + 7) + ' Z" fill="' + sp.belly + '"/>',
      dog: '<ellipse cx="' + (60 - rx * .86) + '" cy="' + (top + 20) + '" rx="9" ry="19" fill="' + dk + '" transform="rotate(22 ' + (60 - rx * .86) + ' ' + (top + 20) + ')"/><ellipse cx="' + (60 + rx * .86) + '" cy="' + (top + 20) + '" rx="9" ry="19" fill="' + dk + '" transform="rotate(-22 ' + (60 + rx * .86) + ' ' + (top + 20) + ')"/>',
      round: '<circle cx="' + (60 - rx * .62) + '" cy="' + (top + 6) + '" r="12" fill="' + col + '"/><circle cx="' + (60 - rx * .62) + '" cy="' + (top + 6) + '" r="6" fill="' + sp.belly + '"/><circle cx="' + (60 + rx * .62) + '" cy="' + (top + 6) + '" r="12" fill="' + col + '"/><circle cx="' + (60 + rx * .62) + '" cy="' + (top + 6) + '" r="6" fill="' + sp.belly + '"/>',
      leaf: '<path d="M60 ' + (top + 3) + ' L60 ' + (top - 10) + '" stroke="#388e3c" stroke-width="3"/><path d="M60 ' + (top - 8) + ' Q76 ' + (top - 28) + ' 90 ' + (top - 14) + ' Q74 ' + (top - 2) + ' 60 ' + (top - 8) + ' Z" fill="#66bb6a"/><path d="M60 ' + (top - 6) + ' Q48 ' + (top - 20) + ' 38 ' + (top - 10) + ' Q50 ' + (top) + ' 60 ' + (top - 6) + ' Z" fill="#81c784"/>',
      fin: '<path d="M48 ' + (top + 6) + ' Q60 ' + (top - 24) + ' 78 ' + (top + 6) + ' Z" fill="' + dk + '"/>',
      antenna: '<path d="M52 ' + (top + 4) + ' Q46 ' + (top - 10) + ' 40 ' + (top - 18) + ' M68 ' + (top + 4) + ' Q74 ' + (top - 10) + ' 80 ' + (top - 18) + '" stroke="' + dk + '" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="40" cy="' + (top - 19) + '" r="5" fill="' + acc + '"/><circle cx="80" cy="' + (top - 19) + '" r="5" fill="' + acc + '"/>',
    };
    back += ears[sp.ears] || '';
    // 手、脚、身体、肚子
    front += '<ellipse cx="' + (60 - rx * .45) + '" cy="' + (cy + ry - 2) + '" rx="11" ry="6.5" fill="' + dk + '"/><ellipse cx="' + (60 + rx * .45) + '" cy="' + (cy + ry - 2) + '" rx="11" ry="6.5" fill="' + dk + '"/>';
    front += '<ellipse cx="60" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + col + '"/>';
    front += '<ellipse cx="60" cy="' + (cy + ry * .42) + '" rx="' + (rx * .56) + '" ry="' + (ry * .42) + '" fill="' + sp.belly + '"/>';
    front += '<ellipse cx="' + (60 - rx * .92) + '" cy="' + (cy + ry * .18) + '" rx="7" ry="11" fill="' + col + '" stroke="' + dk + '" stroke-width="1.5"/><ellipse cx="' + (60 + rx * .92) + '" cy="' + (cy + ry * .18) + '" rx="7" ry="11" fill="' + col + '" stroke="' + dk + '" stroke-width="1.5"/>';
    if (sp.extra === 'horn') front += '<path d="M55 ' + (top + 5) + ' L60 ' + (top - 15) + ' L65 ' + (top + 5) + ' Z" fill="' + acc + '" stroke="' + dk + '" stroke-width="1.5"/>';
    if (sp.extra === 'crown') [[-13, 3], [0, -4], [13, 3]].forEach(([dx, dy]) => { front += '<circle cx="' + (60 + dx) + '" cy="' + (top + dy) + '" r="6.5" fill="' + acc + '"/><circle cx="' + (60 + dx) + '" cy="' + (top + dy) + '" r="2.5" fill="#fff3c4"/>'; });
    // 脸
    const ey = cy - ry * .22, ex = rx * .38;
    front += '<g class="m-eyes" style="transform-origin:60px ' + ey + 'px">' + [-1, 1].map(s => '<ellipse cx="' + (60 + s * ex) + '" cy="' + ey + '" rx="8" ry="9.5" fill="#fff"/><circle cx="' + (60 + s * ex + 1.5) + '" cy="' + (ey + 1) + '" r="5.2" fill="#1d2a36"/><circle cx="' + (60 + s * ex + 3) + '" cy="' + (ey - 1.5) + '" r="1.8" fill="#fff"/>').join('') + '</g>';
    if (sp.stage === 2) front += '<path d="M' + (60 - ex - 9) + ' ' + (ey - 13) + ' L' + (60 - ex + 7) + ' ' + (ey - 9) + ' M' + (60 + ex + 9) + ' ' + (ey - 13) + ' L' + (60 + ex - 7) + ' ' + (ey - 9) + '" stroke="' + shade(col, .5) + '" stroke-width="3" stroke-linecap="round"/>';
    const my = cy + ry * .1;
    front += '<circle cx="' + (60 - rx * .62) + '" cy="' + (my + 2) + '" r="5" fill="#ff8a80" opacity=".5"/><circle cx="' + (60 + rx * .62) + '" cy="' + (my + 2) + '" r="5" fill="#ff8a80" opacity=".5"/>';
    front += '<path class="m-c" d="M54 ' + my + ' Q60 ' + (my + 6) + ' 66 ' + my + '" stroke="#5d2a1e" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    front += '<g class="m-o"><ellipse cx="60" cy="' + (my + 2) + '" rx="7" ry="6" fill="#5d2a1e"/><ellipse cx="60" cy="' + (my + 5) + '" rx="4" ry="2" fill="#ff8a8a"/></g>';
    return '<svg class="mon-svg" viewBox="-14 -34 156 156" aria-hidden="true"><ellipse cx="60" cy="' + (cy + ry + 4) + '" rx="' + (rx + 4) + '" ry="6" fill="rgba(0,0,0,.14)"/><g class="m-body">' + back + front + '</g></svg>';
  }

  window.Cartoon = { actor: actorSVG, set: setSVG, has: name => !!CHARS[name], monster: monsterSVG };
})();
