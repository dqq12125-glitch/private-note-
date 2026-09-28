// 回声岛 · 人物画法：日系 Q 版小人（四个方向 × 站立/迈左脚/迈右脚）、对话头像、大立绘
// 所有人物都用代码画（生图模型画不出前后一致的走路帧），2D 和 3D 共用
(function () {
  'use strict';

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  }
  function rr(g, x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    g.beginPath();
    g.moveTo(x + a, y); g.lineTo(x + w - b, y); g.quadraticCurveTo(x + w, y, x + w, y + b);
    g.lineTo(x + w, y + h - c); g.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    g.lineTo(x + d, y + h); g.quadraticCurveTo(x, y + h, x, y + h - d);
    g.lineTo(x, y + a); g.quadraticCurveTo(x, y, x + a, y); g.closePath();
  }
  const ell = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot || 0, 0, Math.PI * 2); };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };

  const GIRL = { long: 1, bob: 1, pigtails: 1, ponytail: 1, bun: 1 };

  // ---------- 小人 ----------
  // 设计尺寸：格子 40，脚底在 (0,0)，头顶大约在 -46。s 是缩放后的格子大小
  function drawPerson(g, cx, fy, s, L, dir, phase, moving, noShadow) {
    const k = s / 40, sw = moving ? Math.sin(phase) : 0, bob = moving ? Math.abs(Math.sin(phase)) * 1.1 : 0;
    const side = dir === 'left' || dir === 'right', back = dir === 'up', front = dir === 'down';
    const HY = -30.5, skin = L.skin, hair = L.hair, girl = L.lash != null ? L.lash : !!GIRL[L.style];
    const sleeve = L.jacket || L.coat || L.shirt, legC = L.skirt ? skin : L.bottom, shoes = L.shoes || '#4a3a35';
    // P：填色 + 用同色系深色描边
    const P = (fill, lw) => { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 1.25; g.strokeStyle = fill === skin ? shade(skin, .62) : shade(fill, .52); g.stroke(); };
    const shadeIn = (clip, x, y, w, h, a) => { g.save(); clip(); g.clip(); g.fillStyle = 'rgba(40,20,40,' + (a || .1) + ')'; g.fillRect(x, y, w, h); g.restore(); };
    g.save();
    g.translate(cx, fy); g.scale(k, k);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (!noShadow) { g.fillStyle = 'rgba(0,0,0,.2)'; ell(g, 0, 0, 10.5, 3.2); g.fill(); }
    g.translate(0, -bob);
    if (dir === 'left') g.scale(-1, 1);

    // ---- 身后的长头发 ----
    const backHair = () => {
      if (L.style === 'long') {
        if (side) { rr(g, -13.8, HY - 6, 15, 24, [8, 4, 7, 6]); P(hair); }
        else { rr(g, -13.2, HY - 6.5, 26.4, 24, [9, 9, 7, 7]); P(hair); }
      } else if (L.style === 'bob' && !back) { rr(g, -13, HY - 6, 26, 17, [9, 9, 6, 6]); P(hair); }
      else if (L.style === 'pigtails') {
        const tail = sx => { g.save(); g.translate(sx * 14.8, HY + 3.5); g.rotate(sx * .28); ell(g, 0, 0, 4.2, 7.8); P(hair); g.restore(); };
        if (side) tail(-1); else { tail(-1); tail(1); }
      } else if (L.style === 'ponytail') {
        if (side) { g.beginPath(); g.moveTo(-9, HY - 9); g.quadraticCurveTo(-19, HY - 4, -16.5, HY + 11 + sw); g.quadraticCurveTo(-13, HY + 3, -6, HY - 3); g.closePath(); P(hair); }
        else if (front) { g.save(); g.translate(10.5, HY - 7); g.rotate(.7); ell(g, 0, 0, 4.2, 7.5); P(hair); g.restore(); }
      }
    };
    backHair();

    // ---- 腿和鞋 ----
    if (side) {
      [[-1, .86], [1, 1]].forEach(([i, f]) => {
        const x = i * sw * 2.8;
        rr(g, x - 2.2, -11.5, 4.4, 9.5, 2); P(shade(legC, f));
        if (L.skirt) { rr(g, x - 2.2, -5.4, 4.4, 2.6, 1); g.fillStyle = '#ffffff'; g.fill(); }
        rr(g, x - 2.4, -3.5, 7.2, 3.7, [1.6, 2.2, 1.4, 1.2]); P(shade(shoes, f));
      });
    } else {
      [-1, 1].forEach(i => {
        const lift = moving && (i < 0 ? sw > .2 : sw < -.2) ? -1.4 : 0, x = i * 3.3;
        rr(g, x - 2.3, -11.5 + lift, 4.6, 9.5, 2); P(legC);
        if (L.skirt) { rr(g, x - 2.3, -5.6 + lift, 4.6, 2.6, 1); g.fillStyle = '#ffffff'; g.fill(); }
        rr(g, x - 3, -3.5 + lift, 6, 3.7, [1.6, 1.6, 1.4, 1.4]); P(shoes);
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x - 1.8, -2.9 + lift, 2.4, .9);
      });
    }
    // ---- 裤腰 / 裙子 ----
    if (!L.skirt) { if (side) rr(g, -4.8, -14, 9.6, 5, 2); else rr(g, -6.6, -14, 13.2, 5, 2); P(L.bottom); }
    else {
      if (side) poly(g, [[-5, -14.5], [5, -14.5], [7.6, -6.8], [-7.2, -6.8]]); else poly(g, [[-6.6, -14.5], [6.6, -14.5], [9.4, -6.8], [-9.4, -6.8]]);
      P(L.bottom);
      g.strokeStyle = shade(L.bottom, .72); g.lineWidth = .8;
      (side ? [-2, 2] : [-4, 0, 4]).forEach(x => { g.beginPath(); g.moveTo(x, -13); g.lineTo(x * 1.35, -7.5); g.stroke(); });
    }
    // ---- 侧面：后面那只手 ----
    if (side) { rr(g, -2 - sw * 3.2, -21, 4, 9.5, 2); P(shade(sleeve, .82)); circ(g, -sw * 3.2, -11.2, 2.1); P(shade(skin, .92)); }
    // ---- 背包（侧面和背面） ----
    if (L.bag && side) { rr(g, -9.2, -21.5, 5, 10.5, 2.2); P(L.bag); }
    // ---- 身体 ----
    const torso = () => side ? rr(g, -5.4, -22.5, 10.8, 11, [4.5, 4.5, 2.5, 2.5]) : rr(g, -7, -22.5, 14, 11, [5, 5, 2.5, 2.5]);
    if (L.jacket && !side) { g.beginPath(); g.ellipse(0, -22.5, 6.2, 2.4, 0, Math.PI, 0); P(L.jacket); }   // 帽衫的帽子
    torso(); P(L.jacket || L.shirt);
    shadeIn(torso, side ? -5.4 : 2.6, -23, 6, 12, .1);
    if (front) {
      if (L.jacket) { rr(g, -2.4, -22.3, 4.8, 10.6, 1); P(L.shirt, 1); g.strokeStyle = shade(L.jacket, .6); g.lineWidth = .8; g.beginPath(); g.moveTo(-2.4, -21.5); g.lineTo(-2.4, -12); g.moveTo(2.4, -21.5); g.lineTo(2.4, -12); g.stroke(); }
      else { poly(g, [[-2.8, -22.4], [0, -19.2], [2.8, -22.4]]); g.fillStyle = L.shirt2 || shade(L.shirt, 1.15); g.fill(); }
      if (L.logo) { circ(g, -3.6, -16.6, 1.5); g.fillStyle = L.logo; g.fill(); }
    }
    if (L.apron && !back) { rr(g, side ? -2 : -5.2, -19.5, side ? 7 : 10.4, 12.5, 2); P(L.apron, 1); }
    if (L.coat) {
      const coat = () => side ? rr(g, -5.8, -22.6, 11.6, 16, [4.5, 4.5, 2, 2]) : rr(g, -7.6, -22.6, 15.2, 16, [5, 5, 2, 2]);
      coat(); P(L.coat);
      shadeIn(coat, side ? -5.8 : 2.8, -23, 6, 17, .08);
      if (front) { rr(g, -2.3, -22.3, 4.6, 7.5, 1); P(L.shirt, 1); g.strokeStyle = shade(L.coat, .7); g.lineWidth = .8; g.beginPath(); g.moveTo(0, -15); g.lineTo(0, -7.2); g.stroke(); }
    }
    if (L.bag && front) { g.fillStyle = shade(L.bag, .85); rr(g, -6.2, -22.2, 2, 8.5, 1); g.fill(); rr(g, 4.2, -22.2, 2, 8.5, 1); g.fill(); }
    if (L.bag && back) {
      rr(g, -6.6, -21.6, 13.2, 11.6, 3.5); P(L.bag);
      rr(g, -6.6, -21.6, 13.2, 4.6, [3.5, 3.5, 1, 1]); P(shade(L.bag, .9));
      rr(g, -3.5, -15.4, 7, 3.8, 1.5); P(shade(L.bag, 1.08), 1);
    }
    // ---- 手臂 ----
    if (side) { rr(g, -2 + sw * 3.2, -21, 4, 9.5, 2); P(sleeve); circ(g, sw * 3.2, -11.2, 2.1); P(skin); }
    else [-1, 1].forEach(i => {
      const ay = i * sw * 1.3;
      rr(g, i * 8.3 - 2, -21.2 + ay, 4, 8.8, 2); P(sleeve);
      circ(g, i * 8.3, -12 + ay, 2.1); P(skin);
    });
    // ---- 头 ----
    if (!back) { rr(g, -2, -24, 4, 3, 1); g.fillStyle = shade(skin, .9); g.fill(); }
    if (front) [-1, 1].forEach(i => { circ(g, i * 11.8, HY + 1.6, 2.3); P(skin); });
    ell(g, side ? .6 : 0, HY, 12.4, 11.8); P(skin);
    // ---- 脸 ----
    const eye = (x, y, rx) => {
      g.fillStyle = '#2b2233'; ell(g, x, y, rx, 3); g.fill();
      g.fillStyle = L.eye || '#6b4a32'; ell(g, x + (side ? .3 : 0), y + .9, rx * .8, 1.9); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; circ(g, x - .6, y - 1.1, .95); g.fill(); circ(g, x + .7, y + 1.4, .42); g.fill();
      g.strokeStyle = '#2b2233'; g.lineWidth = girl ? 1.25 : .9;
      g.beginPath(); g.moveTo(x - rx - .4, y - 2.1); g.quadraticCurveTo(x, y - 4.1, x + rx + .5, y - 2.5); if (girl) g.lineTo(x + rx + 1.4, y - 3.3); g.stroke();
    };
    if (front) {
      eye(-4.7, HY + 1.8, 2.2); eye(4.7, HY + 1.8, 2.2);
      g.fillStyle = 'rgba(255,120,135,.38)'; ell(g, -7.4, HY + 5.8, 2.2, 1.2); g.fill(); ell(g, 7.4, HY + 5.8, 2.2, 1.2); g.fill();
      g.fillStyle = shade(skin, .8); circ(g, 0, HY + 4, .45); g.fill();
      g.strokeStyle = '#9a4a3c'; g.lineWidth = 1; g.beginPath(); g.moveTo(-1.7, HY + 6.4); g.quadraticCurveTo(0, HY + 8.1, 1.7, HY + 6.4); g.stroke();
    } else if (side) {
      eye(6.4, HY + 1.8, 1.6);
      g.fillStyle = 'rgba(255,120,135,.38)'; ell(g, 5.4, HY + 5.8, 2, 1.2); g.fill();
      g.strokeStyle = '#9a4a3c'; g.lineWidth = 1; g.beginPath(); g.moveTo(8.6, HY + 6.8); g.quadraticCurveTo(9.6, HY + 7.4, 10.4, HY + 6.6); g.stroke();
    }
    // ---- 前面的头发 ----
    const hl = () => { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.7; g.beginPath(); g.arc(side ? -1 : -1.5, HY - 3.5, 9.4, Math.PI * 1.17, Math.PI * 1.4); g.stroke(); };
    if (L.style === 'bald') {
      g.beginPath(); g.moveTo(-12.4, HY + 2); g.quadraticCurveTo(-13.2, HY - 6, -9.5, HY - 7.5); g.lineTo(-10.4, HY + 3); g.closePath(); P(hair);
      if (!side) { g.beginPath(); g.moveTo(12.4, HY + 2); g.quadraticCurveTo(13.2, HY - 6, 9.5, HY - 7.5); g.lineTo(10.4, HY + 3); g.closePath(); P(hair); }
    } else if (back) {
      // 后脑勺：一整块，下沿是一缕缕的发梢
      const long = L.style === 'long', bobS = L.style === 'bob', low = long ? 19 : bobS ? 9 : 5;
      g.beginPath();
      g.moveTo(-12.9, HY + 2);
      g.bezierCurveTo(-14.4, HY - 11, -8, HY - 15.2, 0, HY - 15);
      g.bezierCurveTo(8, HY - 15.2, 14.4, HY - 11, 12.9, HY + 2);
      g.lineTo(12.6, HY + low - 2);
      const n = long ? 5 : 6;
      for (let i = 0; i <= n; i++) { const x = 12.2 - i * 24.4 / n; g.lineTo(x, HY + low + (i % 2 ? -2.6 : 1.2)); }
      g.lineTo(-12.9, HY + low - 2);
      g.closePath(); P(hair);
      if (L.style === 'ponytail') { g.beginPath(); g.moveTo(-3.5, HY - 7); g.quadraticCurveTo(-6, HY + 10, 0, HY + 16 + sw); g.quadraticCurveTo(6, HY + 10, 3.5, HY - 7); g.closePath(); P(hair); }
      if (L.style === 'bun') { circ(g, 0, HY - 12.5, 5.2); P(hair); }
      hl();
    } else if (side) {
      g.beginPath();
      g.moveTo(10.8, HY - 1.5);
      g.bezierCurveTo(12.8, HY - 12, 4, HY - 15.4, -3, HY - 14.4);
      g.bezierCurveTo(-11.5, HY - 13, -14.6, HY - 3.5, -12.8, HY + (L.style === 'bob' || L.style === 'long' ? 9 : 5.5));
      g.lineTo(-8.8, HY + (L.style === 'bob' || L.style === 'long' ? 9.5 : 7.5));
      g.quadraticCurveTo(-4.8, HY + 3, -3.4, HY - 2);
      [[1.2, HY - 6.8], [3.8, HY - 2], [6.6, HY - 7.2], [8.8, HY - 1.2]].forEach(([x, y]) => g.lineTo(x, y));
      g.closePath(); P(hair);
      if (L.style === 'spiky' && !L.hat) { poly(g, [[-2, HY - 14], [-6.5, HY - 19.5], [-7.5, HY - 12.5]]); P(hair); poly(g, [[3, HY - 14.6], [1.5, HY - 20], [-2.5, HY - 14.4]]); P(hair); }
      if (L.style === 'bun') { circ(g, -6.5, HY - 11.5, 5); P(hair); }
      hl();
    } else {
      if (L.style === 'spiky' && !L.hat) { poly(g, [[-7, HY - 12.5], [-4, HY - 19], [-1, HY - 13.8]]); P(hair); poly(g, [[0, HY - 14], [4, HY - 19.4], [6.5, HY - 12.6]]); P(hair); }
      if (L.style === 'bun') { circ(g, 0, HY - 13.2, 5.2); P(hair); }
      g.beginPath();
      g.moveTo(-12.9, HY + 3);
      g.bezierCurveTo(-14.3, HY - 10.5, -8, HY - 15, 0, HY - 14.8);
      g.bezierCurveTo(8, HY - 15, 14.3, HY - 10.5, 12.9, HY + 3);
      const bangs = GIRL[L.style]
        ? [[11.8, HY + 2], [9.2, HY - 4.4], [6.8, HY - 1.2], [3.8, HY - 5.4], [.4, HY - 2.2], [-3, HY - 6], [-6.4, HY - 2.4], [-9.4, HY - 4.8], [-12.4, HY + 1]]
        : [[11.6, HY - .5], [9.6, HY - 5.6], [7.8, HY - 1.8], [5.2, HY - 6.4], [2.6, HY - 2.2], [-.4, HY - 6.8], [-3.2, HY - 2.4], [-6, HY - 6.2], [-8.4, HY - 2], [-10.4, HY - 5.4], [-12.2, HY - .6]];
      bangs.forEach(([x, y]) => g.lineTo(x, y));
      g.closePath(); P(hair);
      // 两边的鬓发
      const lock = (i, len) => { g.beginPath(); g.moveTo(i * 12.9, HY - 2); g.quadraticCurveTo(i * 14.4, HY + len * .6, i * 12, HY + len); g.lineTo(i * 9.8, HY + len * .55); g.quadraticCurveTo(i * 10.9, HY + 2, i * 10.6, HY - 3); g.closePath(); P(hair); };
      if (L.style === 'long' || L.style === 'bob') { lock(-1, 13); lock(1, 13); }
      else if (GIRL[L.style]) { lock(-1, 8.5); lock(1, 8.5); }
      else { lock(-1, 5); lock(1, 5); }
      hl();
    }
    // ---- 帽子、发带 ----
    const H = L.hat, hc = L.hatC || '#e53935';
    if (H === 'cap') {
      if (side) {
        g.beginPath(); g.moveTo(-12, HY - 3.8); g.bezierCurveTo(-12.6, HY - 14, -5, HY - 17, 1.5, HY - 16.6); g.bezierCurveTo(8, HY - 16.4, 12.4, HY - 12, 11.6, HY - 4.4); g.closePath(); P(hc);
        rr(g, 7.5, HY - 6.2, 10.8, 2.8, 1.4); P(shade(hc, .75));
        if (L.hatLogo) { circ(g, 4.5, HY - 11, 2.4); g.fillStyle = L.hatLogo; g.fill(); }
      } else {
        g.beginPath(); g.moveTo(-12.8, HY - 3.6); g.bezierCurveTo(-13.4, HY - 14, -7, HY - 17.2, 0, HY - 17); g.bezierCurveTo(7, HY - 17.2, 13.4, HY - 14, 12.8, HY - 3.6); g.closePath(); P(hc);
        rr(g, -12.9, HY - 5.4, 25.8, 2.2, 1); g.fillStyle = shade(hc, .8); g.fill();
        if (front) {
          ell(g, 0, HY - 4.2, 12.6, 2.9); P(shade(hc, .75));
          if (L.hatLogo) { circ(g, 0, HY - 10.8, 3.1); g.fillStyle = L.hatLogo; g.fill(); g.strokeStyle = hc; g.lineWidth = .9; g.beginPath(); g.moveTo(-1.8, HY - 10.6); g.quadraticCurveTo(-.9, HY - 12.2, 0, HY - 10.6); g.quadraticCurveTo(.9, HY - 9, 1.8, HY - 10.6); g.stroke(); }
        } else { rr(g, -4, HY - 6.2, 8, 2.2, 1); P(shade(hc, .85), 1); }
      }
    } else if (H === 'band') {
      if (side) { g.beginPath(); g.moveTo(-11.5, HY - 2); g.quadraticCurveTo(-4, HY - 17, 9, HY - 8); g.lineTo(9.6, HY - 5.5); g.quadraticCurveTo(-3, HY - 14.5, -11, HY + .5); g.closePath(); P(hc); }
      else {
        g.beginPath(); g.moveTo(-12.4, HY - 5.4); g.quadraticCurveTo(0, HY - 16.4, 12.4, HY - 5.4); g.lineTo(12.2, HY - 2.8); g.quadraticCurveTo(0, HY - 13.6, -12.2, HY - 2.8); g.closePath(); P(hc);
        const bx = front ? 8.6 : -8.6;
        poly(g, [[bx, HY - 10.5], [bx + 5, HY - 14.5], [bx + 4.4, HY - 8]]); P(hc, 1);
        poly(g, [[bx, HY - 10.5], [bx - 2.6, HY - 15.6], [bx - 4.2, HY - 10.8]]); P(hc, 1);
        circ(g, bx, HY - 10.6, 1.6); P(shade(hc, .85), 1);
      }
    } else if (H === 'helmet') {
      g.beginPath(); g.arc(0, HY - 2.5, 13.6, Math.PI, 0); g.closePath(); P(hc);
      rr(g, -14, HY - 3.6, 28, 3, 1.5); P(shade(hc, .75));
      if (!back) { circ(g, side ? 4 : 0, HY - 9.5, 2.8); P('#ffc53d', 1); }
    } else if (H === 'nurse') {
      rr(g, -6.5, HY - 18.5, 13, 7, 2.2); P('#ffffff');
      g.fillStyle = '#e53935'; g.fillRect(-1, HY - 17.5, 2, 5); g.fillRect(-2.5, HY - 16, 5, 2);
    } else if (H === 'chef') {
      rr(g, -8.5, HY - 15, 17, 6, 1.5); P('#ffffff');
      g.beginPath(); g.arc(-5, HY - 18, 5.4, 0, Math.PI * 2); g.arc(5, HY - 18, 5.4, 0, Math.PI * 2); g.arc(0, HY - 21.5, 6, 0, Math.PI * 2); P('#ffffff');
    } else if (H === 'straw') {
      ell(g, 0, HY - 6.5, 17, 4); P('#e9c46a');
      g.beginPath(); g.arc(0, HY - 7.5, 9, Math.PI, 0); g.closePath(); P('#e9c46a');
      g.fillStyle = '#c0392b'; g.fillRect(-9, HY - 9.8, 18, 2.2);
    }
    // ---- 眼镜 ----
    if (L.glasses && !back) {
      g.strokeStyle = '#3b3b4a'; g.lineWidth = .95;
      if (side) { circ(g, 6.4, HY + 1.8, 3.2); g.stroke(); g.beginPath(); g.moveTo(3.2, HY + 1.2); g.lineTo(-.5, HY + .5); g.stroke(); }
      else { circ(g, -4.7, HY + 1.8, 3.3); g.stroke(); circ(g, 4.7, HY + 1.8, 3.3); g.stroke(); g.beginPath(); g.moveTo(-1.4, HY + 1.4); g.lineTo(1.4, HY + 1.4); g.stroke(); }
    }
    g.restore();
  }

  // ---------- 动作图集：4 列方向（下左右上）× 3 行（站、迈左脚、迈右脚） ----------
  const atlasCache = {};
  function atlas(look, S) {
    const key = S + JSON.stringify(look);
    if (atlasCache[key]) return atlasCache[key];
    const c = document.createElement('canvas');
    c.width = S * 4; c.height = S * 3;
    const g = c.getContext('2d');
    ['down', 'left', 'right', 'up'].forEach((dir, col) => [[0, false], [Math.PI / 2, true], [Math.PI * 1.5, true]].forEach(([ph, mv], row) => {
      drawPerson(g, col * S + S / 2, row * S + S * .96, S * .7, look, dir, ph, mv, true);
    }));
    return (atlasCache[key] = c);
  }

  // ---------- 对话头像（圆形，半身） ----------
  const portraitCache = {};
  function portrait(look) {
    const key = JSON.stringify(look);
    if (!portraitCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#e8f6f3'); gr.addColorStop(1, '#bfe3dd');
      g.fillStyle = gr; circ(g, 80, 80, 80); g.fill();
      g.save(); circ(g, 80, 80, 78); g.clip();
      drawPerson(g, 80, 188, 142, look, 'down', 0, false, true);
      g.restore();
      portraitCache[key] = c.toDataURL();
    }
    return portraitCache[key];
  }
  // 大立绘（开场、选男孩女孩用）：返回 dataURL
  const standCache = {};
  function standing(look, w, h) {
    const key = w + 'x' + h + JSON.stringify(look);
    if (!standCache[key]) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      drawPerson(c.getContext('2d'), w / 2, h * .97, h * .82, look, 'down', 0, false, false);
      standCache[key] = c.toDataURL();
    }
    return standCache[key];
  }

  // ---------- 造型 ----------
  const LOOKS = {
    boy: { skin: '#ffdcc2', hair: '#3a2a24', style: 'spiky', eye: '#5a3a26', hat: 'cap', hatC: '#16a3a0', hatLogo: '#ffffff', shirt: '#ffffff', jacket: '#1f8f8c', bottom: '#2f3a57', shoes: '#ef5a3c', bag: '#ffc233' },
    girl: { skin: '#ffe1c8', hair: '#7a4a2c', style: 'ponytail', eye: '#3d5f96', hat: 'band', hatC: '#ff6f91', shirt: '#ff7fa3', shirt2: '#ffffff', bottom: '#3f5fa8', skirt: true, shoes: '#ffffff', bag: '#ffc233' },
    leo: { skin: '#f7d2b4', hair: '#e2a33b', style: 'spiky', eye: '#2f6e4a', shirt: '#ffe082', jacket: '#ff7a3d', bottom: '#34495e', shoes: '#3949ab', bag: '#66bb6a' },
    mia: { skin: '#ffe3cc', hair: '#2f2a3a', style: 'pigtails', eye: '#6a3fa0', hat: 'band', hatC: '#ffca28', shirt: '#9575cd', shirt2: '#ffffff', bottom: '#ffb74d', skirt: true, shoes: '#7e57c2', bag: '#4fc3f7' },
    mom: { skin: '#ffdcc2', hair: '#6b3f2a', style: 'bob', eye: '#5a3a26', shirt: '#f4a261', apron: '#ffffff', bottom: '#8d6e9e', skirt: true, shoes: '#6d4c41' },
    prof: { skin: '#ffe0c8', hair: '#8b6f5c', style: 'bun', eye: '#4a6a3a', shirt: '#8e6cef', coat: '#ffffff', bottom: '#455a64', skirt: true, glasses: true, shoes: '#5d4037' },
    nurse: { skin: '#ffdcc2', hair: '#e57373', style: 'long', eye: '#6b3a3a', hat: 'nurse', shirt: '#f8bbd0', shirt2: '#ffffff', bottom: '#f48fb1', skirt: true, shoes: '#ffffff' },
    guard: { skin: '#f1c7a0', hair: '#2b2b2b', style: 'short', eye: '#3a2a20', hat: 'helmet', hatC: '#1e3a8a', shirt: '#1e40af', bottom: '#1e293b', shoes: '#111827' },
    teacher: { skin: '#f5d0b0', hair: '#5d4037', style: 'short', eye: '#3a2a20', shirt: '#2cae69', shirt2: '#ffffff', bottom: '#34495e', glasses: true },
    clerk: { skin: '#ffdcc2', hair: '#1b1b1b', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#3d8fe0', shirt: '#ffffff', jacket: '#3d8fe0', bottom: '#2f3a57' },
    leader: { skin: '#f1c7a0', hair: '#3e2723', style: 'spiky', eye: '#3a2a20', shirt: '#e53935', coat: '#263238', bottom: '#212121' },
    hiker: { skin: '#e8b88f', hair: '#5d4037', style: 'short', eye: '#3a2a20', hat: 'straw', shirt: '#8d6e63', bottom: '#4e342e', bag: '#ff8f00' },
    grunt: { skin: '#f1d0b8', hair: '#4a4a55', style: 'short', eye: '#3a3a4a', hat: 'cap', hatC: '#5a5f6e', hatLogo: '#cfd4dc', shirt: '#cfd4dc', jacket: '#5a5f6e', bottom: '#3a3f4b', shoes: '#22252c' },
    gruntF: { skin: '#f6d5c0', hair: '#5a4a6a', style: 'ponytail', eye: '#3a3a4a', hat: 'cap', hatC: '#5a5f6e', hatLogo: '#cfd4dc', shirt: '#cfd4dc', jacket: '#5a5f6e', bottom: '#3a3f4b', skirt: true, shoes: '#22252c' },
    whisper: { skin: '#f3e0d6', hair: '#9575cd', style: 'long', eye: '#6a3fa0', shirt: '#b39ddb', coat: '#4a4458', bottom: '#2f2a3a', skirt: true, shoes: '#2a2433' },
    rumble: { skin: '#e6b995', hair: '#3e2723', style: 'spiky', eye: '#4a2a1a', shirt: '#ff7043', jacket: '#455a64', bottom: '#263238', shoes: '#1c1c1c' },
    mute: { skin: '#eed7c5', hair: '#cfd8dc', style: 'short', eye: '#37474f', shirt: '#37474f', coat: '#212121', bottom: '#212121', glasses: true, shoes: '#111111' },
    champion: { skin: '#ffe0c8', hair: '#26a69a', style: 'long', eye: '#00796b', hat: 'band', hatC: '#ffd54f', shirt: '#ffffff', coat: '#00897b', bottom: '#004d40', skirt: true, shoes: '#ffd54f' },
    master1: { skin: '#f1c7a0', hair: '#9e9e9e', style: 'short', eye: '#455a64', shirt: '#b0bec5', coat: '#546e7a', bottom: '#37474f', glasses: true },
    master2: { skin: '#f3e0e6', hair: '#4a148c', style: 'bob', eye: '#7b1fa2', shirt: '#ce93d8', coat: '#311b92', bottom: '#1a0f3a', skirt: true },
    master3: { skin: '#fbe9e7', hair: '#e1f5fe', style: 'long', eye: '#0288d1', shirt: '#b3e5fc', coat: '#ffffff', bottom: '#4fc3f7', skirt: true },
    master4: { skin: '#e0a878', hair: '#bf360c', style: 'spiky', eye: '#5d4037', shirt: '#ffab40', jacket: '#4e342e', bottom: '#3e2723' },
    // 配角：爸爸（船长）、小凯（腼腆的朋友）、导师欧瑞（探险家）、渡轮船长盖尔
    dad: { skin: '#f1c7a0', hair: '#3a2a24', style: 'short', eye: '#3a2a20', hat: 'cap', hatC: '#1e3a5f', hatLogo: '#ffd54f', shirt: '#ffffff', jacket: '#1e3a5f', bottom: '#1e293b', shoes: '#3e2723' },
    kai: { skin: '#fbe3d0', hair: '#7cc47a', style: 'short', eye: '#2e7d32', shirt: '#ffffff', jacket: '#9ccc65', bottom: '#546e7a', shoes: '#ffffff', bag: '#fff176' },
    orion: { skin: '#f1d0b8', hair: '#b0bec5', style: 'spiky', eye: '#37474f', shirt: '#eceff1', coat: '#37474f', bottom: '#263238', shoes: '#111111' },
    gale: { skin: '#e8b88f', hair: '#eeeeee', style: 'bald', eye: '#3a2a20', hat: 'cap', hatC: '#ffffff', hatLogo: '#1565c0', shirt: '#1565c0', bottom: '#0d47a1', shoes: '#3e2723', glasses: true },
    // 各岛的人
    treedoc: { skin: '#efc9a8', hair: '#795548', style: 'short', eye: '#3a2a20', hat: 'straw', shirt: '#aed581', coat: '#ffffff', bottom: '#5d4037', glasses: true },
    miner: { skin: '#d9a57b', hair: '#3e2723', style: 'short', eye: '#3a2a20', hat: 'helmet', hatC: '#ffca28', shirt: '#795548', bottom: '#37474f', shoes: '#212121' },
    strong: { skin: '#d9a57b', hair: '#212121', style: 'bald', eye: '#3a2a20', shirt: '#e53935', bottom: '#1e88e5', shoes: '#212121' },
    octo: { skin: '#ffe0c8', hair: '#8e24aa', style: 'spiky', eye: '#4a148c', shirt: '#ce93d8', coat: '#ffffff', bottom: '#4a148c', glasses: true },
    weather: { skin: '#ffe0c8', hair: '#455a64', style: 'bob', eye: '#1565c0', hat: 'band', hatC: '#29b6f6', shirt: '#ffffff', coat: '#90caf9', bottom: '#37474f', skirt: true, glasses: true },
    swimmer: { skin: '#f1c7a0', hair: '#1b1b1b', style: 'short', eye: '#3a2a20', hat: 'band', hatC: '#29b6f6', shirt: '#29b6f6', bottom: '#0277bd', shoes: '#f1c7a0' },
    swimmerF: { skin: '#ffe0c4', hair: '#ffb74d', style: 'ponytail', eye: '#2e6fa0', hat: 'band', hatC: '#ff4081', shirt: '#ff4081', bottom: '#ff80ab', skirt: true, shoes: '#ffe0c4' },
    ranger: { skin: '#e8b88f', hair: '#5d4037', style: 'short', eye: '#3a2a20', hat: 'straw', shirt: '#6d8b3a', jacket: '#8d6e63', bottom: '#4e5b31', shoes: '#3e2723' },
    police: { skin: '#f1c7a0', hair: '#212121', style: 'short', eye: '#3a2a20', hat: 'helmet', hatC: '#0d47a1', shirt: '#90caf9', jacket: '#1565c0', bottom: '#0d47a1', shoes: '#111111' },
    athlete: { skin: '#e0a878', hair: '#212121', style: 'spiky', eye: '#3a2a20', hat: 'band', hatC: '#e53935', shirt: '#ffeb3b', bottom: '#e53935', shoes: '#ffffff' },
    chef: { skin: '#ffdcc2', hair: '#3e2723', style: 'short', eye: '#3a2a20', hat: 'chef', shirt: '#ffffff', apron: '#ffffff', bottom: '#424242' },
    clown: { skin: '#fff3e0', hair: '#ff7043', style: 'spiky', eye: '#1565c0', hat: 'band', hatC: '#ffd54f', shirt: '#ffeb3b', jacket: '#e53935', bottom: '#1e88e5', shoes: '#e53935' },
    kid: { skin: '#ffe0c4', hair: '#6d4c41', style: 'spiky', eye: '#2e6fa0', shirt: '#ffca28', bottom: '#1e88e5', shoes: '#e53935' },
    kidF: { skin: '#ffe0c4', hair: '#212121', style: 'pigtails', eye: '#6a3fa0', shirt: '#f48fb1', bottom: '#7e57c2', skirt: true, shoes: '#ffffff' },
    granny: { skin: '#f6d5bd', hair: '#e6e6e6', style: 'bun', eye: '#5a3a26', shirt: '#b388ff', bottom: '#6a5acd', skirt: true, glasses: true },
    grandpa: { skin: '#efc9a8', hair: '#cfcfcf', style: 'bald', eye: '#3a2a20', shirt: '#8d6e63', shirt2: '#d7ccc8', bottom: '#5d4037', glasses: true },
    fisher: { skin: '#e8b88f', hair: '#5d4037', style: 'short', eye: '#3a2a20', hat: 'straw', shirt: '#4fc3f7', jacket: '#ffb300', bottom: '#455a64', shoes: '#212121' },
    scientist: { skin: '#ffe0c8', hair: '#5d4037', style: 'short', eye: '#3a2a20', shirt: '#b3e5fc', coat: '#ffffff', bottom: '#455a64', glasses: true },
    student: { skin: '#ffdcc2', hair: '#212121', style: 'short', eye: '#3a2a20', shirt: '#ffffff', jacket: '#1e40af', bottom: '#1e293b', shoes: '#111827', bag: '#e53935' },
    studentF: { skin: '#ffe1c8', hair: '#3e2723', style: 'ponytail', eye: '#3a2a20', shirt: '#ffffff', jacket: '#1e40af', bottom: '#1e3a8a', skirt: true, shoes: '#111827', bag: '#ec407a' },
    skier: { skin: '#ffe0c8', hair: '#6d4c41', style: 'short', eye: '#3a2a20', hat: 'band', hatC: '#e53935', shirt: '#ffffff', jacket: '#e53935', bottom: '#1e293b', shoes: '#111111' },
    monk: { skin: '#e8b88f', hair: '#9e9e9e', style: 'bald', eye: '#3a2a20', shirt: '#ffb74d', coat: '#8d6e63', bottom: '#6d4c41', shoes: '#3e2723' },
  };
  const VILLAGERS = [
    ['Granny', 'f', { skin: '#f6d5bd', hair: '#e6e6e6', style: 'bun', shirt: '#b388ff', bottom: '#6a5acd', skirt: true, glasses: true }],
    ['Grandpa', 'm', { skin: '#efc9a8', hair: '#cfcfcf', style: 'bald', shirt: '#8d6e63', shirt2: '#d7ccc8', bottom: '#5d4037', glasses: true }],
    ['Ms Li', 'f', { skin: '#ffdcc2', hair: '#212121', style: 'long', eye: '#3a2a20', shirt: '#ff8a65', bottom: '#455a64', skirt: true }],
    ['Farmer Joe', 'm', { skin: '#e8b88f', hair: '#6d4c41', style: 'short', hat: 'straw', shirt: '#43a047', bottom: '#1565c0' }],
    ['Chef Mei', 'f', { skin: '#ffdcc2', hair: '#3e2723', style: 'bob', hat: 'chef', shirt: '#ffffff', apron: '#ffcc80', bottom: '#424242' }],
    ['Mr Brown', 'm', { skin: '#d9a57b', hair: '#4e342e', style: 'short', shirt: '#0288d1', shirt2: '#ffffff', bottom: '#37474f' }],
    ['Lily', 'f', { skin: '#ffe0c4', hair: '#6d4c41', style: 'pigtails', eye: '#2e7d32', shirt: '#ffca28', bottom: '#5c6bc0', skirt: true }],
    ['Uncle Wang', 'm', { skin: '#f1c7a0', hair: '#212121', style: 'short', shirt: '#78909c', jacket: '#546e7a', bottom: '#263238', glasses: true }],
  ];
  const TRAINERS = [
    ['m', { skin: '#ffdcc2', hair: '#2b2b2b', style: 'spiky', hat: 'cap', hatC: '#43a047', shirt: '#ffb300', bottom: '#1e3a8a' }],
    ['f', { skin: '#ffe0c4', hair: '#f4a261', style: 'pigtails', eye: '#2e6fa0', shirt: '#ec407a', shirt2: '#ffffff', bottom: '#6a1b9a', skirt: true }],
    ['m', { skin: '#e8b88f', hair: '#5d4037', style: 'short', shirt: '#ffffff', jacket: '#26a69a', bottom: '#37474f' }],
    ['f', { skin: '#ffdcc2', hair: '#c62828', style: 'long', eye: '#5a2a6a', shirt: '#7e57c2', bottom: '#263238', skirt: true }],
    ['m', { skin: '#ffd9b8', hair: '#1b1b1b', style: 'short', hat: 'cap', hatC: '#1e88e5', shirt: '#e53935', bottom: '#2e3a59' }],
    ['f', { skin: '#ffe0c4', hair: '#ffd54f', style: 'ponytail', eye: '#2e6fa0', hat: 'band', hatC: '#29b6f6', shirt: '#ffffff', jacket: '#29b6f6', bottom: '#455a64' }],
  ];

  window.EchoPeople = { drawPerson, atlas, portrait, standing, LOOKS, VILLAGERS, TRAINERS, shade };
})();
