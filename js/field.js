// The field view: the true land, visible only as far as the party can see.
(function () {
  const LF = window.LF;
  const { T, F, hash2, idx, inb } = LF;

  const COLORS = {
    [T.DEEP]: [28, 55, 72],
    [T.SEA]: [44, 88, 102],
    [T.LAKE]: [50, 94, 108],
    [T.BEACH]: [201, 184, 140],
    [T.SALTMARSH]: [118, 128, 92],
    [T.MEADOW]: [128, 146, 74],
    [T.OLDFIELD]: [152, 142, 84],
    [T.FOREST]: [60, 88, 50],
    [T.PINE]: [80, 100, 64],
    [T.SWAMP]: [86, 98, 66],
    [T.HILLS]: [138, 122, 86],
    [T.MOUNTAIN]: [118, 112, 106],
  };
  LF.FIELD_COLORS = COLORS;

  function rgb(c, k) {
    return `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  }

  function tile(g, world, x, y, px, py, s, time) {
    const i = idx(x, y);
    const k = world.t[i];
    const c = COLORS[k];
    g.fillStyle = rgb(c, 0.92 + hash2(x, y, 1) * 0.14);
    g.fillRect(px, py, s + 1, s + 1);
    const h = (n) => hash2(x, y, n);

    if (LF.isWater(k)) {
      g.strokeStyle = 'rgba(200,225,230,0.18)';
      g.lineWidth = 1.2;
      for (let n = 0; n < 2; n++) {
        const yy = py + s * (0.3 + 0.4 * n) + Math.sin(time / 700 + x + n) * 2;
        const xx = px + s * h(5 + n) * 0.5;
        g.beginPath();
        g.moveTo(xx, yy);
        g.quadraticCurveTo(xx + s * 0.15, yy - 3, xx + s * 0.3, yy);
        g.stroke();
      }
    } else if (k === T.FOREST) {
      for (let n = 0; n < 4; n++) {
        g.fillStyle = rgb([34, 58, 32], 0.9 + h(30 + n) * 0.3);
        g.beginPath();
        g.arc(px + s * (0.15 + 0.7 * h(10 + n)), py + s * (0.15 + 0.7 * h(20 + n)), s * (0.16 + 0.08 * h(40 + n)), 0, Math.PI * 2);
        g.fill();
      }
    } else if (k === T.PINE) {
      for (let n = 0; n < 4; n++) {
        const cx = px + s * (0.15 + 0.7 * h(10 + n)), cy = py + s * (0.2 + 0.65 * h(20 + n));
        g.fillStyle = rgb([38, 64, 44], 0.9 + h(30 + n) * 0.3);
        g.beginPath();
        g.moveTo(cx, cy - s * 0.22);
        g.lineTo(cx + s * 0.12, cy + s * 0.12);
        g.lineTo(cx - s * 0.12, cy + s * 0.12);
        g.fill();
      }
    } else if (k === T.SWAMP || k === T.SALTMARSH) {
      for (let n = 0; n < 3; n++) {
        g.fillStyle = k === T.SWAMP ? 'rgba(52,70,64,0.85)' : 'rgba(60,96,104,0.7)';
        g.beginPath();
        g.ellipse(px + s * (0.15 + 0.7 * h(50 + n)), py + s * (0.2 + 0.6 * h(60 + n)), s * 0.18, s * 0.08, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(170,165,95,0.7)';
      g.lineWidth = 1;
      for (let n = 0; n < 5; n++) {
        const cx = px + s * h(70 + n), cy = py + s * (0.4 + 0.5 * h(80 + n));
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 1, cy - s * 0.2);
        g.stroke();
      }
    } else if (k === T.MEADOW) {
      g.fillStyle = 'rgba(190,200,110,0.5)';
      for (let n = 0; n < 5; n++) g.fillRect(px + s * h(90 + n), py + s * h(100 + n), 2, 2);
    } else if (k === T.OLDFIELD) {
      g.strokeStyle = 'rgba(110,92,52,0.5)';
      g.lineWidth = 1.2;
      for (let n = 0; n < 4; n++) {
        const yy = py + s * (0.15 + n * 0.23);
        g.beginPath();
        g.moveTo(px + 2, yy);
        g.lineTo(px + s - 2, yy - s * 0.05);
        g.stroke();
      }
      g.fillStyle = 'rgba(90,120,50,0.6)';
      for (let n = 0; n < 4; n++) g.fillRect(px + s * h(90 + n), py + s * h(100 + n), 3, 3);
    } else if (k === T.HILLS) {
      const hx = px + s * (0.35 + 0.3 * h(7)), hy = py + s * 0.72;
      g.fillStyle = 'rgba(176,156,110,0.75)';
      g.beginPath();
      g.ellipse(hx, hy, s * 0.36, s * 0.3, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = 'rgba(70,56,34,0.35)';
      g.beginPath();
      g.ellipse(hx, hy, s * 0.36, s * 0.3, 0, Math.PI * 1.5, 0);
      g.lineTo(hx, hy);
      g.fill();
    } else if (k === T.MOUNTAIN) {
      g.fillStyle = 'rgba(60,56,54,0.55)';
      g.beginPath();
      g.moveTo(px + s * 0.1, py + s * 0.9);
      g.lineTo(px + s * 0.5, py + s * 0.1);
      g.lineTo(px + s * 0.9, py + s * 0.9);
      g.fill();
      g.fillStyle = 'rgba(235,235,230,0.7)';
      g.beginPath();
      g.moveTo(px + s * 0.4, py + s * 0.3);
      g.lineTo(px + s * 0.5, py + s * 0.1);
      g.lineTo(px + s * 0.6, py + s * 0.3);
      g.fill();
    } else if (k === T.BEACH) {
      g.fillStyle = 'rgba(240,230,200,0.5)';
      for (let n = 0; n < 5; n++) g.fillRect(px + s * h(110 + n), py + s * h(120 + n), 1.5, 1.5);
    }
    if (world.game[i] && LF.isLand(k)) {
      g.fillStyle = 'rgba(70,40,20,0.7)';
      for (let n = 0; n < 3; n++) g.fillRect(px + s * (0.2 + n * 0.22), py + s * (0.82 - n * 0.06), s * 0.05, s * 0.04);
    }
  }

  function rivers(g, world, x, y, px, py, s) {
    if (!world.river[idx(x, y)]) return;
    const cx = px + s / 2, cy = py + s / 2;
    g.strokeStyle = '#4d86a0';
    g.lineCap = 'round';
    g.lineWidth = Math.max(3, s * 0.24);
    for (const [dx, dy] of LF.N4) {
      const ax = x + dx, ay = y + dy;
      if (!inb(ax, ay)) continue;
      const j = idx(ax, ay);
      if (!world.river[j] && !LF.isWater(world.t[j])) continue;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + dx * s * 0.5, cy + dy * s * 0.5);
      g.stroke();
    }
    g.lineCap = 'butt';
  }

  function feature(g, f, px, py, s) {
    const cx = px + s / 2, cy = py + s / 2;
    switch (f) {
      case F.SPRING:
        g.fillStyle = '#9fd0de';
        g.beginPath(); g.arc(cx + s * 0.2, cy - s * 0.15, s * 0.14, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#e8f6fa'; g.lineWidth = 1; g.stroke();
        break;
      case F.CLAY:
        g.fillStyle = 'rgba(176,96,62,0.9)';
        g.beginPath(); g.ellipse(cx - s * 0.15, cy + s * 0.2, s * 0.25, s * 0.12, 0, 0, Math.PI * 2); g.fill();
        break;
      case F.STONE:
        g.fillStyle = '#a7a39c';
        for (const [dx, dy, r] of [[-0.15, 0.1, 0.14], [0.12, 0.18, 0.1], [0.05, -0.1, 0.12]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); g.fill(); }
        break;
      case F.SALTLICK:
        g.fillStyle = 'rgba(236,232,220,0.85)';
        g.beginPath(); g.ellipse(cx, cy, s * 0.22, s * 0.14, 0.3, 0, Math.PI * 2); g.fill();
        break;
      case F.BEAVER:
        g.strokeStyle = '#5a3b22'; g.lineWidth = Math.max(2, s * 0.08);
        g.beginPath(); g.moveTo(cx - s * 0.35, cy + s * 0.1); g.lineTo(cx + s * 0.35, cy - s * 0.05); g.stroke();
        g.fillStyle = '#6b4a2c'; g.beginPath(); g.arc(cx + s * 0.1, cy - s * 0.2, s * 0.12, Math.PI, 0); g.fill();
        break;
      case F.FALLS:
        g.strokeStyle = 'rgba(245,250,250,0.9)'; g.lineWidth = 1.5;
        for (let n = -1; n <= 1; n++) { g.beginPath(); g.moveTo(cx + n * s * 0.1, cy - s * 0.2); g.lineTo(cx + n * s * 0.1, cy + s * 0.2); g.stroke(); }
        break;
      case F.FORD:
        g.fillStyle = '#b8ab8e';
        for (let n = -1; n <= 1; n++) { g.beginPath(); g.arc(cx + n * s * 0.18, cy + n * s * 0.05, s * 0.07, 0, Math.PI * 2); g.fill(); }
        break;
      case F.CLIFF:
        g.strokeStyle = 'rgba(50,40,30,0.8)'; g.lineWidth = 2;
        for (let n = 0; n < 4; n++) { g.beginPath(); g.moveTo(px + s * (0.6 + n * 0.1), py + s * 0.1); g.lineTo(px + s * (0.65 + n * 0.1), py + s * 0.9); g.stroke(); }
        break;
      case F.BURIAL:
        g.fillStyle = 'rgba(110,96,70,0.95)';
        for (const [dx, dy] of [[-0.18, 0.1], [0.18, 0.15], [0, -0.12]]) { g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, s * 0.14, s * 0.08, 0, Math.PI, 0); g.fill(); }
        g.strokeStyle = '#d8c9a6'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx, cy - s * 0.12); g.lineTo(cx, cy - s * 0.4); g.stroke();
        break;
      case F.BERRIES:
        g.fillStyle = '#9b2a3a';
        for (let n = 0; n < 6; n++) { g.beginPath(); g.arc(cx + (hash2(n, 1, 3) - 0.5) * s * 0.5, cy + (hash2(n, 2, 3) - 0.5) * s * 0.5, s * 0.04, 0, Math.PI * 2); g.fill(); }
        break;
      case F.IRON:
        g.fillStyle = 'rgba(150,72,34,0.8)';
        g.beginPath(); g.ellipse(cx, cy + s * 0.1, s * 0.25, s * 0.12, 0, 0, Math.PI * 2); g.fill();
        break;
      case F.WRECK:
        g.strokeStyle = '#3b2a1a'; g.lineWidth = Math.max(2, s * 0.06);
        g.beginPath(); g.moveTo(cx - s * 0.35, cy); g.quadraticCurveTo(cx, cy + s * 0.3, cx + s * 0.35, cy); g.stroke();
        for (let n = -2; n <= 2; n++) { g.beginPath(); g.moveTo(cx + n * s * 0.13, cy + s * 0.12); g.lineTo(cx + n * s * 0.12, cy - s * 0.2); g.stroke(); }
        break;
      case F.RUIN:
        g.fillStyle = 'rgba(90,70,50,0.8)';
        g.beginPath(); g.ellipse(cx - s * 0.15, cy + s * 0.1, s * 0.2, s * 0.14, 0, Math.PI, 0); g.fill();
        g.strokeStyle = 'rgba(90,70,50,0.9)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx + s * 0.1, cy + s * 0.15); g.lineTo(cx + s * 0.3, cy - s * 0.15); g.stroke();
        break;
    }
  }

  function person(g, x, y, s, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y - s * 0.22, s * 0.09, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - s * 0.07, y - s * 0.13, s * 0.14, s * 0.26);
  }

  // opts: { world, party, cam, time, hover, path, stakes, camp, ship, sight, light, fire }
  LF.drawField = function (canvas, o) {
    const g = canvas.getContext('2d');
    const dpr = o.cam.dpr;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d0b09';
    g.fillRect(0, 0, cw, ch);

    const s = o.cam.s;
    const p = o.party;
    const r = o.sight;
    const ox = cw / 2 - (o.cam.cx + 0.5) * s, oy = ch / 2 - (o.cam.cy + 0.5) * s;
    const vis = (x, y) => Math.hypot(x - p.x, y - p.y) <= r + 0.01;
    const close = (x, y) => Math.hypot(x - p.x, y - p.y) <= Math.min(r, 2.3);

    const span = Math.ceil(r) + 1;
    for (let y = p.y - span; y <= p.y + span; y++)
      for (let x = p.x - span; x <= p.x + span; x++) {
        if (!inb(x, y) || !vis(x, y)) continue;
        tile(g, o.world, x, y, ox + x * s, oy + y * s, s, o.time);
      }
    for (let y = p.y - span; y <= p.y + span; y++)
      for (let x = p.x - span; x <= p.x + span; x++) {
        if (!inb(x, y) || !vis(x, y)) continue;
        rivers(g, o.world, x, y, ox + x * s, oy + y * s, s);
        const f = o.world.feat[idx(x, y)];
        if (f && close(x, y)) feature(g, f, ox + x * s, oy + y * s, s);
      }

    if (o.path && o.path.length) {
      g.fillStyle = 'rgba(245,225,170,0.6)';
      for (const [x, y] of o.path) {
        g.beginPath();
        g.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, s * 0.08, 0, Math.PI * 2);
        g.fill();
      }
    }

    const c = o.camp;
    if (vis(c.x, c.y)) {
      const cx = ox + (c.x + 0.5) * s, cy = oy + (c.y + 0.5) * s;
      g.fillStyle = '#e8dcc0';
      g.beginPath();
      g.moveTo(cx - s * 0.35, cy + s * 0.3);
      g.lineTo(cx, cy - s * 0.35);
      g.lineTo(cx + s * 0.35, cy + s * 0.3);
      g.fill();
      g.fillStyle = '#9b2a22';
      g.fillRect(cx - 1, cy - s * 0.55, 2, s * 0.25);
    }
    const sh = o.ship;
    if (vis(sh.x, sh.y)) {
      const cx = ox + (sh.x + 0.5) * s, cy = oy + (sh.y + 0.5) * s;
      g.fillStyle = '#3b2a1a';
      g.beginPath();
      g.moveTo(cx - s * 0.45, cy);
      g.lineTo(cx + s * 0.45, cy);
      g.lineTo(cx + s * 0.3, cy + s * 0.2);
      g.lineTo(cx - s * 0.3, cy + s * 0.2);
      g.fill();
      g.fillStyle = '#efe5cc';
      g.fillRect(cx - s * 0.05, cy - s * 0.5, s * 0.3, s * 0.4);
      g.fillRect(cx - s * 0.3, cy - s * 0.4, s * 0.2, s * 0.3);
    }
    for (const v of o.world.villages) {
      if (!vis(v.x, v.y)) continue;
      const cx = ox + (v.x + 0.5) * s, cy = oy + (v.y + 0.5) * s;
      for (const [dx, dy] of [[-0.25, 0.1], [0.25, -0.05], [0, 0.3], [-0.05, -0.28]]) {
        g.fillStyle = '#7a5a3a';
        g.beginPath();
        g.ellipse(cx + dx * s, cy + dy * s, s * 0.2, s * 0.14, 0, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = 'rgba(210,210,210,0.35)';
      g.beginPath();
      g.arc(cx + s * 0.1, cy - s * 0.5 - Math.sin(o.time / 500) * 2, s * 0.08, 0, Math.PI * 2);
      g.fill();
    }
    for (const st of o.stakes || []) {
      if (!vis(st.tx, st.ty)) continue;
      const cx = ox + (st.tx + 0.5) * s, cy = oy + (st.ty + 0.5) * s;
      g.strokeStyle = '#e8dcc0';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy + s * 0.3);
      g.lineTo(cx, cy - s * 0.3);
      g.stroke();
      g.fillStyle = '#9b2a22';
      g.fillRect(cx, cy - s * 0.3, s * 0.2, s * 0.12);
    }

    // The party, and its fire at night.
    const px = ox + (p.x + 0.5) * s, py = oy + (p.y + 0.5) * s;
    if (o.fire) {
      const flick = 0.8 + Math.sin(o.time / 90) * 0.1 + Math.sin(o.time / 37) * 0.08;
      const glow = g.createRadialGradient(px, py + s * 0.25, 0, px, py + s * 0.25, s * 1.4 * flick);
      glow.addColorStop(0, 'rgba(255,170,70,0.45)');
      glow.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = glow;
      g.fillRect(px - s * 2, py - s * 2, s * 4, s * 4);
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.moveTo(px - s * 0.08, py + s * 0.35);
      g.quadraticCurveTo(px, py + s * (0.1 - 0.05 * flick), px + s * 0.08, py + s * 0.35);
      g.fill();
    }
    const n = p.alive.length;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      person(g, px + Math.cos(a) * s * 0.2 * (n > 1), py + Math.sin(a) * s * 0.13 * (n > 1), s, k === 0 ? '#f0e4c8' : '#d8c9a6');
    }
    if (p.canoeOn) {
      g.strokeStyle = '#6b4a2c';
      g.lineWidth = Math.max(3, s * 0.1);
      g.beginPath();
      g.moveTo(px - s * 0.4, py + s * 0.2);
      g.quadraticCurveTo(px, py + s * 0.38, px + s * 0.4, py + s * 0.2);
      g.stroke();
    }

    if (o.hover && vis(o.hover[0], o.hover[1])) {
      g.strokeStyle = 'rgba(245,225,170,0.8)';
      g.lineWidth = 1.5;
      g.strokeRect(ox + o.hover[0] * s + 1, oy + o.hover[1] * s + 1, s - 2, s - 2);
    }

    // Daylight: warm at dusk, blue and dark at night.
    const L = o.light;
    if (L < 1) {
      if (L > 0.5) {
        g.fillStyle = `rgba(230,120,40,${(1 - L) * 0.35})`;
      } else {
        g.fillStyle = `rgba(10,18,40,${0.25 + (0.5 - L) * 0.9})`;
      }
      g.fillRect(0, 0, cw, ch);
      if (o.fire) {
        const glow = g.createRadialGradient(px, py, 0, px, py, s * 1.6);
        glow.addColorStop(0, 'rgba(255,160,60,0.25)');
        glow.addColorStop(1, 'rgba(255,160,60,0)');
        g.fillStyle = glow;
        g.fillRect(px - s * 2, py - s * 2, s * 4, s * 4);
      }
    }

    const grad = g.createRadialGradient(px, py, Math.max(0, s * (r - 1.2)), px, py, s * (r + 0.6));
    grad.addColorStop(0, 'rgba(13,11,9,0)');
    grad.addColorStop(1, 'rgba(13,11,9,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
    return { ox, oy };
  };
})();
