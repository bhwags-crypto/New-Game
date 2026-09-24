// The field view: the true land, visible only as far as the party can see.
(function () {
  const LF = (window.LF = window.LF || {});
  const { T, W, H, hash2, idx, inb } = LF;

  const COLORS = {
    [T.DEEP]: [28, 55, 72],
    [T.SEA]: [44, 88, 102],
    [T.BEACH]: [201, 184, 140],
    [T.MEADOW]: [128, 146, 74],
    [T.FOREST]: [60, 88, 50],
    [T.SWAMP]: [86, 98, 66],
    [T.HILLS]: [138, 122, 86],
    [T.MOUNTAIN]: [118, 112, 106],
  };

  LF.sightRadius = function (t) {
    if (t === T.MOUNTAIN) return 7;
    if (t === T.HILLS) return 5;
    if (t === T.FOREST) return 2.5;
    if (t === T.SWAMP) return 2.5;
    if (t === T.BEACH) return 4;
    return 3.5;
  };

  function rgb(c, k) {
    return `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
  }

  function tile(g, world, x, y, px, py, s, time) {
    const i = idx(x, y);
    const k = world.t[i];
    const c = COLORS[k];
    const shade = 0.92 + hash2(x, y, 1) * 0.14;
    g.fillStyle = rgb(c, shade);
    g.fillRect(px, py, s + 1, s + 1);

    if (k === T.SEA || k === T.DEEP) {
      g.strokeStyle = 'rgba(200,225,230,0.18)';
      g.lineWidth = 1.2;
      for (let n = 0; n < 2; n++) {
        const yy = py + s * (0.3 + 0.4 * n) + Math.sin(time / 700 + x + n) * 2;
        const xx = px + s * hash2(x, y, 5 + n) * 0.5;
        g.beginPath();
        g.moveTo(xx, yy);
        g.quadraticCurveTo(xx + s * 0.15, yy - 3, xx + s * 0.3, yy);
        g.stroke();
      }
    } else if (k === T.FOREST) {
      for (let n = 0; n < 4; n++) {
        const cx = px + s * (0.15 + 0.7 * hash2(x, y, 10 + n)), cy = py + s * (0.15 + 0.7 * hash2(x, y, 20 + n));
        g.fillStyle = rgb([34, 58, 32], 0.9 + hash2(x, y, 30 + n) * 0.3);
        g.beginPath();
        g.arc(cx, cy, s * (0.16 + 0.08 * hash2(x, y, 40 + n)), 0, Math.PI * 2);
        g.fill();
      }
      if (world.game[i]) {
        g.fillStyle = 'rgba(70,40,20,0.8)';
        for (let n = 0; n < 3; n++) g.fillRect(px + s * (0.2 + n * 0.22), py + s * (0.8 - n * 0.08), s * 0.06, s * 0.05);
      }
    } else if (k === T.SWAMP) {
      for (let n = 0; n < 3; n++) {
        const cx = px + s * (0.15 + 0.7 * hash2(x, y, 50 + n)), cy = py + s * (0.2 + 0.6 * hash2(x, y, 60 + n));
        g.fillStyle = 'rgba(52,70,64,0.85)';
        g.beginPath();
        g.ellipse(cx, cy, s * 0.18, s * 0.08, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(160,160,90,0.7)';
      g.lineWidth = 1;
      for (let n = 0; n < 4; n++) {
        const cx = px + s * hash2(x, y, 70 + n), cy = py + s * (0.4 + 0.5 * hash2(x, y, 80 + n));
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 1, cy - s * 0.2);
        g.stroke();
      }
    } else if (k === T.MEADOW) {
      g.fillStyle = 'rgba(190,200,110,0.5)';
      for (let n = 0; n < 5; n++) g.fillRect(px + s * hash2(x, y, 90 + n), py + s * hash2(x, y, 100 + n), 2, 2);
    } else if (k === T.HILLS) {
      const hx = px + s * (0.35 + 0.3 * hash2(x, y, 7)), hy = py + s * 0.72;
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
      for (let n = 0; n < 5; n++) g.fillRect(px + s * hash2(x, y, 110 + n), py + s * hash2(x, y, 120 + n), 1.5, 1.5);
    }
  }

  function rivers(g, world, x, y, px, py, s) {
    const i = idx(x, y);
    if (!world.river[i]) return;
    const cx = px + s / 2, cy = py + s / 2;
    g.strokeStyle = '#4d86a0';
    g.lineCap = 'round';
    g.lineWidth = Math.max(3, s * 0.22);
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

  function person(g, x, y, s, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y - s * 0.22, s * 0.09, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - s * 0.07, y - s * 0.13, s * 0.14, s * 0.26);
  }

  // opts: { world, party, cam:{s,dpr,cx,cy}, time, hover, path, stakes, villages, camp, ship }
  LF.drawField = function (canvas, o) {
    const g = canvas.getContext('2d');
    const dpr = o.cam.dpr;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d0b09';
    g.fillRect(0, 0, cw, ch);

    const s = o.cam.s;
    const p = o.party;
    const r = LF.sightRadius(o.world.t[idx(p.x, p.y)]);
    const ox = cw / 2 - (o.cam.cx + 0.5) * s, oy = ch / 2 - (o.cam.cy + 0.5) * s;
    const vis = (x, y) => Math.hypot(x - p.x, y - p.y) <= r + 0.01;

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
      }

    if (o.path && o.path.length) {
      g.fillStyle = 'rgba(245,225,170,0.55)';
      for (const [x, y] of o.path) {
        g.beginPath();
        g.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, s * 0.08, 0, Math.PI * 2);
        g.fill();
      }
    }

    // Things in the land: the landing camp, the ship, villages, stakes.
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
      for (const [dx, dy] of [[-0.25, 0.1], [0.25, -0.05], [0, 0.3]]) {
        g.fillStyle = '#7a5a3a';
        g.beginPath();
        g.ellipse(cx + dx * s, cy + dy * s, s * 0.2, s * 0.14, 0, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = 'rgba(210,210,210,0.35)';
      g.beginPath();
      g.arc(cx + s * 0.1, cy - s * 0.4 - Math.sin(o.time / 500) * 2, s * 0.08, 0, Math.PI * 2);
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

    // The party.
    const px = ox + (p.x + 0.5) * s, py = oy + (p.y + 0.5) * s;
    const n = p.alive.length;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      person(g, px + Math.cos(a) * s * 0.18 * (n > 1), py + Math.sin(a) * s * 0.12 * (n > 1), s, k === 0 ? '#f0e4c8' : '#d8c9a6');
    }

    if (o.hover && vis(o.hover[0], o.hover[1])) {
      g.strokeStyle = 'rgba(245,225,170,0.8)';
      g.lineWidth = 1.5;
      g.strokeRect(ox + o.hover[0] * s + 1, oy + o.hover[1] * s + 1, s - 2, s - 2);
    }

    // Darkness beyond sight.
    const grad = g.createRadialGradient(px, py, s * (r - 1.2), px, py, s * (r + 0.6));
    grad.addColorStop(0, 'rgba(13,11,9,0)');
    grad.addColorStop(1, 'rgba(13,11,9,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);

    return { ox, oy };
  };
})();
