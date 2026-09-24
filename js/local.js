// The town site up close: each world square split into 4 x 4 plots of about ten acres.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, hash2 } = LF;

  const R = (LF.LOCAL_R = 6);
  const SUB = (LF.LOCAL_SUB = 4);
  const N = (LF.LOCAL_N = (2 * R + 1) * SUB);

  // src: { t, river, feat } arrays over world squares (t = -1 for unknown). truth adds small patches.
  LF.buildLocal = function (src, cx, cy, truth, seed) {
    const t = new Int8Array(N * N).fill(-1);
    const river = new Uint8Array(N * N);
    const feat = new Map();
    const nj = LF.valueNoise(seed * 5 + 17);
    const nk = LF.valueNoise(seed * 7 + 19);
    const x0 = cx - R, y0 = cy - R;
    const at = (wx, wy) => (inb(wx, wy) ? src.t[idx(wx, wy)] : -1);

    for (let ly = 0; ly < N; ly++)
      for (let lx = 0; lx < N; lx++) {
        const fx = x0 + (lx + 0.5) / SUB, fy = y0 + (ly + 0.5) / SUB;
        const jx = (LF.fbm(nj, lx / 3.5, ly / 3.5, 2) - 0.5) * 0.9;
        const jy = (LF.fbm(nk, lx / 3.5, ly / 3.5, 2) - 0.5) * 0.9;
        let k = at(Math.floor(fx + jx), Math.floor(fy + jy));
        if (k < 0) k = at(Math.floor(fx), Math.floor(fy));
        if (truth && k >= 0) {
          const h = hash2(lx + x0 * SUB, ly + y0 * SUB, seed);
          if (LF.isOpen(k) && h < 0.06) k = T.FOREST;
          else if (LF.isWoods(k) && h < 0.05) k = T.MEADOW;
          else if (k === T.SWAMP && h < 0.08) k = T.LAKE;
        }
        t[ly * N + lx] = k;
      }

    // Rivers as wandering lines through the centres of river squares.
    const segs = [];
    const wob = (wx, wy, s) => (hash2(wx, wy, s) - 0.5) * 0.5;
    for (let wy = y0 - 1; wy <= y0 + 2 * R + 1; wy++)
      for (let wx = x0 - 1; wx <= x0 + 2 * R + 1; wx++) {
        if (!inb(wx, wy) || !src.river[idx(wx, wy)] || src.t[idx(wx, wy)] < 0) continue;
        const a = [wx + 0.5 + wob(wx, wy, 1), wy + 0.5 + wob(wx, wy, 2)];
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const bx = wx + dx, by = wy + dy;
          if (!inb(bx, by)) continue;
          const bj = idx(bx, by);
          if (src.river[bj] && src.t[bj] >= 0) {
            if (dx < 0 || dy < 0) continue;
            segs.push([a, [bx + 0.5 + wob(bx, by, 1), by + 0.5 + wob(bx, by, 2)]]);
          } else if (LF.isWater(src.t[bj])) segs.push([a, [wx + 0.5 + dx * 0.7, wy + 0.5 + dy * 0.7]]);
        }
      }
    const width = 0.13;
    for (let ly = 0; ly < N; ly++)
      for (let lx = 0; lx < N; lx++) {
        const px = x0 + (lx + 0.5) / SUB, py = y0 + (ly + 0.5) / SUB;
        for (const [a, b] of segs) {
          const vx = b[0] - a[0], vy = b[1] - a[1];
          const L = vx * vx + vy * vy || 1;
          const u = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / L));
          const dx = px - (a[0] + u * vx), dy = py - (a[1] + u * vy);
          if (dx * dx + dy * dy < width * width) { river[ly * N + lx] = 1; break; }
        }
      }

    for (let wy = y0; wy <= y0 + 2 * R; wy++)
      for (let wx = x0; wx <= x0 + 2 * R; wx++) {
        if (!inb(wx, wy)) continue;
        const f = src.feat[idx(wx, wy)];
        if (!f) continue;
        let lx = (wx - x0) * SUB + 1 + Math.floor(hash2(wx, wy, 5) * 2), ly = (wy - y0) * SUB + 1 + Math.floor(hash2(wx, wy, 6) * 2);
        if (river[ly * N + lx] && f !== F.FALLS && f !== F.FORD && f !== F.BEAVER) lx = Math.min(N - 1, lx + 1);
        if (f === F.FALLS || f === F.FORD || f === F.BEAVER) {
          // Put river features on the river itself.
          let best = null, bd = Infinity;
          for (let yy = (wy - y0) * SUB; yy < (wy - y0 + 1) * SUB; yy++)
            for (let xx = (wx - x0) * SUB; xx < (wx - x0 + 1) * SUB; xx++)
              if (river[yy * N + xx]) { const d = Math.hypot(xx - lx, yy - ly); if (d < bd) { bd = d; best = [xx, yy]; } }
          if (best) [lx, ly] = best;
        }
        feat.set(ly * N + lx, f);
      }
    return { t, river, feat, cx, cy, x0, y0 };
  };

  LF.localWater = (L, i) => L.t[i] >= 0 && (LF.isWater(L.t[i]) || L.river[i]);
  LF.localIn = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

  // ---------------------------------------------------------------- drawing

  const INK = '59,42,26';
  const SEASON_TINT = { spring: null, summer: null, autumn: 'rgba(200,130,40,0.10)', winter: 'rgba(235,240,245,0.42)' };

  function drawChartLocal(g, L, cam) {
    const s = cam.s;
    g.fillStyle = '#e6d6b0';
    g.fillRect(cam.ox, cam.oy, N * s, N * s);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x, k = L.t[i];
        const px = cam.ox + x * s, py = cam.oy + y * s;
        if (k < 0) {
          g.fillStyle = 'rgba(120,90,50,0.06)';
          if (hash2(x, y, 3) > 0.5) g.fillRect(px, py, s, s);
          continue;
        }
        if (LF.isWater(k)) {
          g.fillStyle = 'rgba(120,150,140,0.28)';
          g.fillRect(px, py, s + 0.5, s + 0.5);
          continue;
        }
        g.strokeStyle = `rgba(${INK},0.6)`;
        g.fillStyle = `rgba(${INK},0.6)`;
        g.lineWidth = 1;
        const h = (n) => hash2(x, y, n);
        if (LF.isWoods(k)) {
          g.beginPath(); g.arc(px + s * (0.3 + 0.4 * h(1)), py + s * (0.35 + 0.3 * h(2)), s * 0.22, Math.PI, 0); g.stroke();
        } else if (LF.isWet(k)) {
          g.beginPath(); g.moveTo(px + s * 0.2, py + s * 0.6); g.lineTo(px + s * 0.8, py + s * 0.6); g.stroke();
        } else if (LF.isHigh(k)) {
          g.beginPath(); g.moveTo(px + s * 0.15, py + s * 0.75); g.quadraticCurveTo(px + s * 0.5, py + s * 0.1, px + s * 0.85, py + s * 0.75); g.stroke();
        } else if (k === T.OLDFIELD) {
          g.beginPath(); g.moveTo(px + s * 0.15, py + s * 0.35); g.lineTo(px + s * 0.85, py + s * 0.3); g.moveTo(px + s * 0.15, py + s * 0.7); g.lineTo(px + s * 0.85, py + s * 0.65); g.stroke();
        } else if (h(4) > 0.6) g.fillRect(px + s * h(5), py + s * h(6), 1.5, 1.5);
      }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (L.river[y * N + x] && L.t[y * N + x] >= 0) {
        g.fillStyle = 'rgba(52,74,92,0.65)';
        g.fillRect(cam.ox + x * s, cam.oy + y * s, s + 0.5, s + 0.5);
      }
  }

  function drawTrueLocal(g, L, cam, season, time) {
    const s = cam.s;
    const C = LF.FIELD_COLORS;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x, k = L.t[i];
        const px = cam.ox + x * s, py = cam.oy + y * s;
        if (k < 0) { g.fillStyle = '#1a140e'; g.fillRect(px, py, s + 1, s + 1); continue; }
        const c = C[k];
        const sh = 0.92 + hash2(x, y, 1) * 0.14;
        g.fillStyle = `rgb(${Math.round(c[0] * sh)},${Math.round(c[1] * sh)},${Math.round(c[2] * sh)})`;
        g.fillRect(px, py, s + 1, s + 1);
        const h = (n) => hash2(x, y, n);
        if (LF.isWoods(k)) {
          for (let n = 0; n < 3; n++) {
            g.fillStyle = k === T.PINE ? 'rgba(34,58,40,0.9)' : 'rgba(34,58,32,0.9)';
            g.beginPath();
            g.arc(px + s * (0.2 + 0.6 * h(10 + n)), py + s * (0.2 + 0.6 * h(20 + n)), s * 0.2, 0, Math.PI * 2);
            g.fill();
          }
        } else if (LF.isWet(k)) {
          g.fillStyle = 'rgba(52,72,66,0.8)';
          g.beginPath(); g.ellipse(px + s * (0.3 + 0.4 * h(3)), py + s * 0.5, s * 0.25, s * 0.1, 0, 0, Math.PI * 2); g.fill();
        } else if (LF.isHigh(k)) {
          g.fillStyle = 'rgba(80,65,40,0.3)';
          g.fillRect(px + s * 0.5, py, s * 0.5, s);
        } else if (LF.isWater(k)) {
          g.strokeStyle = 'rgba(200,225,230,0.2)';
          g.beginPath(); g.moveTo(px + s * 0.2, py + s * 0.5 + Math.sin(time / 800 + x) * 1.5); g.lineTo(px + s * 0.6, py + s * 0.5); g.stroke();
        }
      }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (L.river[y * N + x]) {
        g.fillStyle = season === 'winter' ? '#9bb8c4' : '#4d86a0';
        g.fillRect(cam.ox + x * s, cam.oy + y * s, s + 1, s + 1);
      }
  }

  function drawFeatures(g, L, cam, col) {
    const s = cam.s;
    for (const [i, f] of L.feat) {
      const x = i % N, y = (i / N) | 0;
      if (L.t[i] < 0) continue;
      LF.featGlyph(g, f, cam.ox + (x + 0.5) * s, cam.oy + (y + 0.5) * s, Math.max(12, s * 1.6), col, 0.95);
    }
  }

  // Buildings, drawn as small plan views.
  const BCOL = { house: '#8a5a36', storehouse: '#7a4a2a', well: '#5b7d8a', blockhouse: '#5a4632', meetinghouse: '#9a6a3c', dock: '#6b4a2c', sawpit: '#8a6a44', kiln: '#a0522d', mill: '#7a5a3a', smithy: '#4a3a30', tradehouse: '#8a6a3a' };

  function drawBuilding(g, b, cam, opts) {
    const s = cam.s;
    const px = cam.ox + b.x * s, py = cam.oy + b.y * s;
    const bw = b.w * s, bh = b.h * s;
    const done = b.progress >= 1;
    const planned = opts.plan || (!done && !b.progress);
    const bad = b.blocked;
    if (b.type === 'field') {
      if (planned) {
        g.strokeStyle = bad ? '#b33' : 'rgba(59,42,26,0.8)';
        g.setLineDash([3, 3]);
        g.strokeRect(px + 1.5, py + 1.5, bw - 3, bh - 3);
        g.setLineDash([]);
        g.strokeStyle = bad ? 'rgba(179,51,51,0.6)' : 'rgba(59,42,26,0.4)';
        g.beginPath();
        for (let k = 1; k < 4; k++) { g.moveTo(px + 3, py + (k * bh) / 4); g.lineTo(px + bw - 3, py + (k * bh) / 4); }
        g.stroke();
      } else {
        const stage = opts.cropStage ? opts.cropStage(b) : 'bare';
        const col = { bare: '#7a6040', sprout: '#8faa50', green: '#5e8a34', ripe: '#c9a040', stubble: '#a08a60', tobacco: '#6f8f3a', tobaccoRipe: '#b09040' }[stage] || '#7a6040';
        g.fillStyle = col;
        g.fillRect(px + 1, py + 1, bw - 2, bh - 2);
        g.strokeStyle = 'rgba(40,28,16,0.35)';
        g.beginPath();
        for (let k = 1; k < 5; k++) { g.moveTo(px + 2, py + (k * bh) / 5); g.lineTo(px + bw - 2, py + (k * bh) / 5); }
        g.stroke();
        if (!done) { g.fillStyle = 'rgba(30,20,10,0.35)'; g.fillRect(px + 1, py + 1 + (bh - 2) * b.progress, bw - 2, (bh - 2) * (1 - b.progress)); }
      }
      return;
    }
    if (b.type === 'palisade') return;
    const col = BCOL[b.type] || '#7a5a3a';
    if (planned) {
      g.strokeStyle = bad ? '#b33' : 'rgba(59,42,26,0.9)';
      g.lineWidth = 1.5;
      g.setLineDash([3, 2]);
      g.strokeRect(px + 2, py + 2, bw - 4, bh - 4);
      g.setLineDash([]);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(px + 3, py + 4, bw - 4, bh - 4);
      g.fillStyle = col;
      g.globalAlpha = done ? 1 : 0.45;
      g.fillRect(px + 2, py + 2, bw - 4, bh - 4);
      g.globalAlpha = 1;
      if (done) {
        g.fillStyle = 'rgba(255,240,210,0.15)';
        g.fillRect(px + 2, py + 2, bw - 4, (bh - 4) / 2);
        if (b.type === 'well') { g.fillStyle = '#2e4450'; g.beginPath(); g.arc(px + bw / 2, py + bh / 2, s * 0.2, 0, Math.PI * 2); g.fill(); }
        if (b.type === 'meetinghouse') { g.fillStyle = '#e8dcc0'; g.fillRect(px + bw / 2 - 1, py + 3, 2, bh * 0.35); }
        if (b.type === 'blockhouse') { g.strokeStyle = '#2a1e14'; g.lineWidth = 2; g.strokeRect(px + 4, py + 4, bw - 8, bh - 8); }
      } else {
        g.strokeStyle = 'rgba(40,28,16,0.8)';
        g.lineWidth = 1;
        g.strokeRect(px + 2, py + 2, bw - 4, bh - 4);
        g.fillStyle = col;
        g.fillRect(px + 2, py + bh - 2 - (bh - 4) * b.progress, bw - 4, (bh - 4) * b.progress);
      }
    }
    if (s >= 14 && opts.labels) {
      g.fillStyle = planned ? 'rgba(59,42,26,0.9)' : '#f2e6cc';
      g.font = `${Math.max(9, Math.round(s * 0.42))}px "Alegreya Sans", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const lbl = { house: 'H', storehouse: 'Store', well: 'W', blockhouse: 'Fort', meetinghouse: 'Meeting', dock: 'Dock', sawpit: 'Saw', kiln: 'Kiln', mill: 'Mill', smithy: 'Smith', tradehouse: 'Trade' }[b.type];
      if (lbl) g.fillText(lbl, px + bw / 2, py + bh / 2);
    }
    if (bad) {
      g.strokeStyle = '#c0392b';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(px + 3, py + 3); g.lineTo(px + bw - 3, py + bh - 3); g.moveTo(px + bw - 3, py + 3); g.lineTo(px + 3, py + bh - 3); g.stroke();
    }
  }

  function drawPalisade(g, p, cam, planned) {
    const s = cam.s;
    const x0 = cam.ox + p.x0 * s + s * 0.5, y0 = cam.oy + p.y0 * s + s * 0.5, x1 = cam.ox + p.x1 * s + s * 0.5, y1 = cam.oy + p.y1 * s + s * 0.5;
    g.lineWidth = Math.max(2, s * 0.18);
    if (planned || p.progress < 1) {
      g.setLineDash([s * 0.4, s * 0.3]);
      g.strokeStyle = p.blocked ? '#b33' : 'rgba(59,42,26,0.8)';
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.setLineDash([]);
    }
    if (!planned && p.progress > 0) {
      g.strokeStyle = '#4a3522';
      const per = 2 * (x1 - x0 + y1 - y0);
      g.setLineDash([per * p.progress, per]);
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.setLineDash([]);
    }
  }

  // opts: { L, cam, truth, plan (items), season, time, hover (cells + ok), labels, cropStage, center, people }
  LF.drawLocal = function (canvas, o) {
    const g = canvas.getContext('2d');
    const dpr = o.cam.dpr;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = o.truth ? '#120d09' : '#20150e';
    g.fillRect(0, 0, cw, ch);
    const cam = o.cam;
    g.save();
    g.beginPath();
    g.rect(cam.ox, cam.oy, N * cam.s, N * cam.s);
    g.clip();
    if (o.truth) drawTrueLocal(g, o.L, cam, o.season, o.time);
    else drawChartLocal(g, o.L, cam);
    drawFeatures(g, o.L, cam, o.truth ? '40,28,16' : INK);
    const items = o.items || [];
    for (const b of items) if (b.type === 'field') drawBuilding(g, b, cam, { plan: !o.truth, cropStage: o.cropStage });
    for (const b of items) if (b.type === 'palisade') drawPalisade(g, b, cam, !o.truth);
    for (const b of items) if (b.type !== 'field' && b.type !== 'palisade') drawBuilding(g, b, cam, { plan: !o.truth, labels: true });
    if (o.people) {
      for (const pp of o.people) {
        g.fillStyle = pp.c;
        g.beginPath();
        g.arc(cam.ox + pp.x * cam.s, cam.oy + pp.y * cam.s, Math.max(1.5, cam.s * 0.1), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (o.truth && SEASON_TINT[o.season]) {
      g.fillStyle = SEASON_TINT[o.season];
      g.fillRect(cam.ox, cam.oy, N * cam.s, N * cam.s);
    }
    if (o.hover) {
      g.fillStyle = o.hover.ok ? 'rgba(240,220,160,0.35)' : 'rgba(200,50,40,0.35)';
      for (const [x, y] of o.hover.cells) g.fillRect(cam.ox + x * cam.s, cam.oy + y * cam.s, cam.s, cam.s);
    }
    if (o.ring) {
      g.strokeStyle = 'rgba(155,42,34,0.5)';
      g.setLineDash([4, 4]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cam.ox + (N / 2) * cam.s, cam.oy + (N / 2) * cam.s, o.ring * cam.s, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    g.strokeStyle = o.truth ? 'rgba(230,214,176,0.3)' : `rgba(${INK},0.8)`;
    g.lineWidth = 2;
    g.strokeRect(cam.ox, cam.oy, N * cam.s, N * cam.s);
    // Scale: a quarter mile is two plots.
    const bx = cam.ox + 12, by = cam.oy + N * cam.s - 14;
    g.strokeStyle = o.truth ? '#e6d6b0' : `rgba(${INK},0.9)`;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 8 * cam.s, by); g.stroke();
    g.font = '12px "IM Fell English", Georgia, serif';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('One mile', bx, by - 4);
    if (o.title) {
      g.font = '15px "IM Fell English SC", Georgia, serif';
      g.textBaseline = 'top';
      g.fillText(o.title, cam.ox + 12, cam.oy + 10);
    }
  };
})();
