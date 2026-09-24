// The map table: draws the colony's hand-made chart. It never reads the true world.
(function () {
  const LF = (window.LF = window.LF || {});
  const { T, W, H, hash2, idx, inb } = LF;

  const INK = '59,42,26';
  const PENCIL = '96,94,92';
  const SEAL = '#9b2a22';
  const WASH = '120,150,140';

  let parchment = null;
  function parchmentTexture() {
    if (parchment) return parchment;
    const c = document.createElement('canvas');
    const S = 12;
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    g.fillStyle = '#e6d6b0';
    g.fillRect(0, 0, c.width, c.height);
    // Soft stains: a tiny random image scaled up with smoothing.
    const st = document.createElement('canvas');
    st.width = 24;
    st.height = 18;
    const sg = st.getContext('2d');
    for (let y = 0; y < st.height; y++)
      for (let x = 0; x < st.width; x++) {
        sg.fillStyle = `rgba(120,86,40,${hash2(x, y, 9) * 0.16})`;
        sg.fillRect(x, y, 1, 1);
      }
    g.imageSmoothingEnabled = true;
    g.drawImage(st, 0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        const blot = 0;
        const grain = hash2(x, y, 3) * 9;
        const ex = Math.min(x, c.width - x, y, c.height - y);
        const edge = ex < 40 ? (40 - ex) * 0.9 : 0;
        const v = blot + grain + edge;
        d[k] -= v;
        d[k + 1] -= v * 1.1;
        d[k + 2] -= v * 1.4;
      }
    g.putImageData(img, 0, 0);
    parchment = c;
    return c;
  }

  // A knowledge layer: what the colony believes. Used for both ink (committed) and pencil (field notes).
  LF.newKnowledge = function () {
    return {
      t: new Int8Array(W * H).fill(-1),
      q: new Float32Array(W * H),
      seen: new Int16Array(W * H),
      river: new Uint8Array(W * H),
      game: new Uint8Array(W * H),
      src: new Uint8Array(W * H),
    };
  };

  function line(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  }

  function glyph(g, kind, px, py, s, x, y, rgb, a) {
    const r = (k) => hash2(x, y, k);
    g.strokeStyle = `rgba(${rgb},${a})`;
    g.fillStyle = `rgba(${rgb},${a})`;
    g.lineWidth = Math.max(0.6, s / 16);
    const small = s < 9;
    if (kind === T.FOREST) {
      const n = small ? 1 : 2 + (r(1) > 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const cx = px + s * (0.2 + 0.6 * r(10 + i)), cy = py + s * (0.25 + 0.5 * r(20 + i));
        const rr = s * 0.16;
        g.beginPath();
        g.arc(cx, cy, rr, Math.PI * 0.9, Math.PI * 2.1);
        g.stroke();
        line(g, [cx, cy, cx, cy + rr * 1.8]);
      }
    } else if (kind === T.MEADOW) {
      const n = small ? 1 : 3;
      for (let i = 0; i < n; i++) {
        const cx = px + s * (0.15 + 0.7 * r(30 + i)), cy = py + s * (0.2 + 0.6 * r(40 + i));
        g.fillRect(cx, cy, Math.max(0.8, s / 18), Math.max(0.8, s / 18));
      }
      if (!small && r(5) > 0.55) {
        const cx = px + s * 0.5, cy = py + s * 0.7;
        line(g, [cx - s * 0.1, cy, cx - s * 0.14, cy - s * 0.14]);
        line(g, [cx, cy, cx, cy - s * 0.18]);
        line(g, [cx + s * 0.1, cy, cx + s * 0.14, cy - s * 0.14]);
      }
    } else if (kind === T.SWAMP) {
      for (let i = 0; i < (small ? 1 : 3); i++) {
        const cx = px + s * (0.15 + 0.5 * r(50 + i)), cy = py + s * (0.25 + 0.55 * r(60 + i));
        line(g, [cx, cy, cx + s * 0.3, cy]);
      }
      if (!small) {
        const cx = px + s * (0.3 + 0.4 * r(7)), cy = py + s * 0.55;
        line(g, [cx, cy, cx - s * 0.08, cy - s * 0.2]);
        line(g, [cx, cy, cx, cy - s * 0.25]);
        line(g, [cx, cy, cx + s * 0.08, cy - s * 0.2]);
      }
    } else if (kind === T.HILLS) {
      const cx = px + s * (0.3 + 0.4 * r(8)), cy = py + s * 0.72;
      g.beginPath();
      g.moveTo(cx - s * 0.36, cy);
      g.quadraticCurveTo(cx, cy - s * 0.62, cx + s * 0.36, cy);
      g.stroke();
      if (!small) for (let i = 1; i <= 2; i++) line(g, [cx + s * 0.06 * i, cy - s * 0.26 + i * s * 0.06, cx + s * 0.06 * i + s * 0.07, cy - s * 0.02]);
    } else if (kind === T.MOUNTAIN) {
      const cx = px + s * 0.5, cy = py + s * 0.85, h = s * (0.7 + 0.2 * r(9));
      line(g, [cx - s * 0.45, cy, cx, cy - h, cx + s * 0.45, cy]);
      if (!small) for (let i = 1; i <= 3; i++) line(g, [cx + s * 0.08 * i, cy - h + h * 0.2 * i, cx + s * 0.08 * i, cy]);
    } else if (kind === T.BEACH) {
      for (let i = 0; i < (small ? 2 : 5); i++) {
        g.fillRect(px + s * r(70 + i), py + s * r(80 + i), Math.max(0.6, s / 22), Math.max(0.6, s / 22));
      }
    }
  }

  function lodge(g, cx, cy, s, a) {
    g.strokeStyle = `rgba(${INK},${a})`;
    g.fillStyle = `rgba(${INK},${a * 0.15})`;
    g.lineWidth = Math.max(1, s / 12);
    for (const off of [-0.45, 0.35]) {
      const x = cx + off * s, y = cy + s * 0.3;
      g.beginPath();
      g.moveTo(x - s * 0.35, y);
      g.quadraticCurveTo(x, y - s * 0.75, x + s * 0.35, y);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  function flag(g, cx, cy, s) {
    g.strokeStyle = `rgba(${INK},0.95)`;
    g.lineWidth = Math.max(1.2, s / 10);
    line(g, [cx, cy + s * 0.5, cx, cy - s * 0.7]);
    g.fillStyle = SEAL;
    g.beginPath();
    g.moveTo(cx, cy - s * 0.7);
    g.lineTo(cx + s * 0.6, cy - s * 0.5);
    g.lineTo(cx, cy - s * 0.3);
    g.fill();
  }

  function seal(g, cx, cy, s, letter) {
    const r = Math.max(7, s * 0.55);
    g.fillStyle = SEAL;
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rr = r * (0.92 + 0.12 * hash2(i, letter.charCodeAt(0), 2));
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fill();
    g.fillStyle = '#f1e2c2';
    g.font = `${Math.round(r * 1.2)}px "IM Fell English SC", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, cx, cy + r * 0.08);
  }

  function label(g, text, x, y, size, a, italic) {
    g.font = `${italic ? 'italic ' : ''}${size}px "IM Fell English", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = `rgba(230,214,176,${a * 0.9})`;
    g.strokeText(text, x, y);
    g.fillStyle = `rgba(${INK},${a})`;
    g.fillText(text, x, y);
  }

  // Draw one knowledge layer's terrain in ink or pencil.
  function drawLayer(g, K, cam, day, rgb, isPencil) {
    const s = cam.s;
    const x0 = Math.max(0, Math.floor(-cam.ox / s) - 1), x1 = Math.min(W, Math.ceil((g.canvas.width / cam.dpr - cam.ox) / s) + 1);
    const y0 = Math.max(0, Math.floor(-cam.oy / s) - 1), y1 = Math.min(H, Math.ceil((g.canvas.height / cam.dpr - cam.oy) / s) + 1);
    const alphaOf = (i) => {
      const fade = isPencil ? 1 : Math.max(0.4, 1 - (day - K.seen[i]) / 70);
      return (0.3 + 0.7 * K.q[i]) * fade;
    };
    const isSea = (x, y) => inb(x, y) && (K.t[idx(x, y)] === T.SEA || K.t[idx(x, y)] === T.DEEP);
    const isLand = (x, y) => inb(x, y) && K.t[idx(x, y)] > T.SEA;

    // Sea wash near the coast.
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        const k = K.t[i];
        if (k !== T.SEA && k !== T.DEEP) continue;
        const px = cam.ox + x * s, py = cam.oy + y * s;
        g.fillStyle = `rgba(${isPencil ? PENCIL : WASH},${(k === T.SEA ? 0.2 : 0.1) * alphaOf(i)})`;
        g.fillRect(px, py, s + 0.5, s + 0.5);
        let nearLand = false;
        for (const [dx, dy] of LF.N8) if (isLand(x + dx, y + dy)) nearLand = true;
        if (nearLand && s >= 7) {
          g.strokeStyle = `rgba(${rgb},${0.35 * alphaOf(i)})`;
          g.lineWidth = Math.max(0.5, s / 22);
          const yy = py + s * (0.35 + 0.3 * hash2(x, y, 12));
          g.beginPath();
          g.moveTo(px + s * 0.15, yy);
          g.quadraticCurveTo(px + s * 0.35, yy - s * 0.12, px + s * 0.5, yy);
          g.quadraticCurveTo(px + s * 0.65, yy + s * 0.12, px + s * 0.85, yy);
          g.stroke();
        }
      }

    // Coastline: marching squares between tile centers, so the shore runs on diagonals like a drawn line.
    g.lineCap = 'round';
    for (let y = y0 - 1; y < y1; y++)
      for (let x = x0 - 1; x < x1; x++) {
        if (!inb(x, y) || !inb(x + 1, y + 1)) continue;
        const ids = [idx(x, y), idx(x + 1, y), idx(x + 1, y + 1), idx(x, y + 1)];
        if (ids.some((i) => K.t[i] < 0)) continue;
        const land = ids.map((i) => (K.t[i] > T.SEA ? 1 : 0));
        const code = land[0] * 8 + land[1] * 4 + land[2] * 2 + land[3];
        if (code === 0 || code === 15) continue;
        const a = Math.min(...ids.map(alphaOf));
        const cx = cam.ox + (x + 0.5) * s, cy = cam.oy + (y + 0.5) * s;
        const jit = (ex, ey) => (hash2(ex, ey, 77) - 0.5) * s * 0.35;
        const P = {
          T: [cx + s * 0.5 + jit(2 * x + 1, 2 * y), cy + jit(2 * x + 1, 2 * y + 900)],
          R: [cx + s + jit(2 * x + 2, 2 * y + 1), cy + s * 0.5 + jit(2 * x + 2, 2 * y + 901)],
          B: [cx + s * 0.5 + jit(2 * x + 1, 2 * y + 2), cy + s + jit(2 * x + 1, 2 * y + 902)],
          L: [cx + jit(2 * x, 2 * y + 1), cy + s * 0.5 + jit(2 * x, 2 * y + 901)],
        };
        const SEG = { 1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['TR'], 5: ['LT', 'BR'], 6: ['TB'], 7: ['LT'], 8: ['LT'], 9: ['TB'], 10: ['TR', 'LB'], 11: ['TR'], 12: ['LR'], 13: ['BR'], 14: ['LB'] }[code];
        g.strokeStyle = `rgba(${rgb},${0.9 * a})`;
        g.lineWidth = Math.max(1, s / 8);
        for (const sg of SEG) line(g, [...P[sg[0]], ...P[sg[1]]]);
        // A faint second line offshore, the way chartmakers hatched a coast.
        if (s >= 8) {
          g.strokeStyle = `rgba(${rgb},${0.3 * a})`;
          g.lineWidth = Math.max(0.6, s / 18);
          const seaSide = (pt) => {
            let sx = 0, sy = 0, n = 0;
            const corners = [[cx, cy], [cx + s, cy], [cx + s, cy + s], [cx, cy + s]];
            corners.forEach((c, k) => { if (!land[k]) { sx += c[0]; sy += c[1]; n++; } });
            const tx = sx / n - pt[0], ty = sy / n - pt[1];
            const len = Math.hypot(tx, ty) || 1;
            return [pt[0] + (tx / len) * s * 0.22, pt[1] + (ty / len) * s * 0.22];
          };
          for (const sg of SEG) line(g, [...seaSide(P[sg[0]]), ...seaSide(P[sg[1]])]);
        }
      }
    g.lineCap = 'butt';

    // Terrain glyphs and doubt marks.
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        const k = K.t[i];
        if (k <= T.SEA) continue;
        const a = alphaOf(i);
        const px = cam.ox + x * s, py = cam.oy + y * s;
        glyph(g, k, px, py, s, x, y, rgb, a);
        if (K.game[i] && s >= 9 && hash2(x, y, 33) > 0.6) {
          g.fillStyle = `rgba(${rgb},${a})`;
          g.font = `${Math.round(s * 0.5)}px Georgia, serif`;
          g.textAlign = 'center';
          g.fillText('❧', px + s * 0.75, py + s * 0.35);
        }
        if (K.q[i] < 0.62 && s >= 10 && hash2(x, y, 44) > 0.72) {
          g.fillStyle = `rgba(${rgb},${0.8 * a})`;
          g.font = `italic ${Math.round(s * 0.7)}px "IM Fell English", Georgia, serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('?', px + s * 0.8, py + s * 0.3);
        }
      }

    // Rivers as a wavering line between drawn river tiles.
    g.lineCap = 'round';
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        if (!K.river[i] || K.t[i] < 0) continue;
        const a = alphaOf(i);
        const cx = cam.ox + (x + 0.5) * s, cy = cam.oy + (y + 0.5) * s;
        g.strokeStyle = `rgba(${isPencil ? PENCIL : '52,74,92'},${0.95 * a})`;
        g.lineWidth = Math.max(1.2, s / 6);
        let any = false;
        for (const [dx, dy] of LF.N4) {
          const ax = x + dx, ay = y + dy;
          if (!inb(ax, ay)) continue;
          const j = idx(ax, ay);
          if (!K.river[j] && !isSea(ax, ay)) continue;
          any = true;
          // Each river-to-river link is drawn once, from its left or upper end.
          if (K.river[j] && (dx < 0 || dy < 0)) continue;
          const mx = cx + dx * s * 0.5 + (hash2(x, y, 90 + dx + dy * 3) - 0.5) * s * 0.3;
          const my = cy + dy * s * 0.5 + (hash2(x, y, 95 + dx + dy * 3) - 0.5) * s * 0.3;
          g.beginPath();
          g.moveTo(cx, cy);
          g.quadraticCurveTo(mx, my, cx + dx * s, cy + dy * s);
          g.stroke();
        }
        if (!any) {
          g.beginPath();
          g.arc(cx, cy, s * 0.15, 0, Math.PI * 2);
          g.stroke();
        }
      }
    g.lineCap = 'butt';
  }

  function compass(g, cx, cy, r) {
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = `rgba(${INK},0.7)`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const len = k % 2 ? r * 0.55 : r * 0.95;
      const side = r * 0.12;
      const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len;
      const nx = Math.cos(ang + Math.PI / 2) * side, ny = Math.sin(ang + Math.PI / 2) * side;
      g.beginPath();
      g.moveTo(nx, ny);
      g.lineTo(ex, ey);
      g.lineTo(-nx, -ny);
      g.closePath();
      g.fillStyle = k === 0 ? SEAL : `rgba(${INK},${k % 2 ? 0.45 : 0.8})`;
      g.fill();
    }
    g.fillStyle = `rgba(${INK},0.9)`;
    g.font = `${Math.round(r * 0.45)}px "IM Fell English SC", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('N', 0, -r * 1.02);
    g.restore();
  }

  // Main entry. opts: { K, notes, day, cam, villages, sites, camp, party, title, reveal }
  LF.drawChart = function (canvas, opts) {
    const g = canvas.getContext('2d');
    const cam = opts.cam;
    const dpr = cam.dpr;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#20150e';
    g.fillRect(0, 0, cw, ch);
    const s = cam.s;

    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 6;
    g.drawImage(parchmentTexture(), cam.ox, cam.oy, W * s, H * s);
    g.restore();

    g.save();
    g.beginPath();
    g.rect(cam.ox, cam.oy, W * s, H * s);
    g.clip();

    if (opts.truth) drawTruth(g, opts.truth, cam);
    else {
      drawLayer(g, opts.K, cam, opts.day, INK, false);
      if (opts.notes) drawLayer(g, opts.notes, cam, opts.day, PENCIL, true);
    }

    // Unknown country.
    if (!opts.truth) {
      let unknown = 0, sx = 0, sy = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W * 0.45; x++)
          if (opts.K.t[idx(x, y)] < 0 && !(opts.notes && opts.notes.t[idx(x, y)] >= 0)) { unknown++; sx += x; sy += y; }
      if (unknown > 120) {
        const ux = cam.ox + (sx / unknown) * s, uy = cam.oy + (sy / unknown) * s;
        g.save();
        g.translate(ux, uy);
        g.rotate(-0.12);
        label(g, 'Terra Incognita', 0, 0, Math.max(12, s * 1.6), 0.55, true);
        g.restore();
      }
    }

    // Hunting grounds that villagers have described.
    for (const v of opts.villages || []) {
      if (!v.drawn || !v.territoryKnown) continue;
      const cx = cam.ox + (v.drawn.x + 0.5) * s, cy = cam.oy + (v.drawn.y + 0.5) * s;
      g.setLineDash([s * 0.5, s * 0.35]);
      g.strokeStyle = 'rgba(155,42,34,0.7)';
      g.lineWidth = Math.max(1, s / 10);
      g.beginPath();
      g.arc(cx, cy, v.radius * s, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      if (s >= 7) label(g, v.promised ? 'hunting grounds (promised)' : 'hunting grounds', cx, cy + (v.radius - 0.8) * s, Math.max(10, s * 0.8), 0.75, true);
    }

    for (const v of opts.villages || []) {
      const d = v.drawn || v.pencil;
      if (!d) continue;
      const cx = cam.ox + (d.x + 0.5) * s, cy = cam.oy + (d.y + 0.5) * s;
      lodge(g, cx, cy, Math.max(8, s * 0.9), v.drawn ? 0.95 : 0.6);
      if (s >= 6) label(g, v.contacted ? cap(v.name) : 'a village', cx, cy + Math.max(10, s * 1.1), Math.max(11, s * 0.95), 0.9, true);
    }

    if (opts.camp) {
      const cx = cam.ox + (opts.camp.x + 0.5) * s, cy = cam.oy + (opts.camp.y + 0.5) * s;
      flag(g, cx, cy, Math.max(10, s * 1.1));
      if (s >= 6) label(g, 'The Landing', cx - Math.max(28, s * 2.4), cy, Math.max(11, s), 0.95, true);
    }

    for (const site of opts.sites || []) {
      if (site.isLanding) continue;
      const cx = cam.ox + (site.x + 0.5) * s, cy = cam.oy + (site.y + 0.5) * s;
      seal(g, cx, cy, s, site.letter);
      if (s >= 7) label(g, site.name, cx, cy - Math.max(14, s * 1.2), Math.max(11, s * 0.9), 0.95, false);
    }
    for (const st of (opts.party && opts.party.stakes) || []) {
      const cx = cam.ox + (st.x + 0.5) * s, cy = cam.oy + (st.y + 0.5) * s;
      g.globalAlpha = 0.65;
      seal(g, cx, cy, s, st.letter);
      g.globalAlpha = 1;
    }

    if (opts.highlight) {
      const h = opts.highlight;
      g.strokeStyle = SEAL;
      g.lineWidth = 2;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.arc(cam.ox + (h.x + 0.5) * s, cam.oy + (h.y + 0.5) * s, h.r * s, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }

    if (opts.party) {
      const p = opts.party;
      const cx = cam.ox + (p.x + p.drift.x + 0.5) * s, cy = cam.oy + (p.y + p.drift.y + 0.5) * s;
      g.strokeStyle = SEAL;
      g.lineWidth = 2.5;
      const r = Math.max(6, s * 0.5);
      line(g, [cx - r, cy - r, cx + r, cy + r]);
      line(g, [cx + r, cy - r, cx - r, cy + r]);
      label(g, 'our reckoning', cx, cy + r + 10, 12, 0.9, true);
    }
    g.restore();

    // Frame, cartouche, compass, scale.
    g.strokeStyle = `rgba(${INK},0.8)`;
    g.lineWidth = 2;
    g.strokeRect(cam.ox + 6, cam.oy + 6, W * s - 12, H * s - 12);
    g.lineWidth = 0.8;
    g.strokeRect(cam.ox + 10, cam.oy + 10, W * s - 20, H * s - 20);
    const cr = Math.max(18, s * 2.2);
    compass(g, cam.ox + W * s - cr * 1.8, cam.oy + H * s - cr * 1.8, cr);
    const bx = cam.ox + 24, by = cam.oy + H * s - 22;
    g.strokeStyle = `rgba(${INK},0.9)`;
    g.lineWidth = 1.2;
    line(g, [bx, by, bx + 5 * s, by]);
    for (let k = 0; k <= 5; k++) line(g, [bx + k * s, by - (k % 5 ? 3 : 5), bx + k * s, by]);
    g.fillStyle = `rgba(${INK},0.9)`;
    g.font = `${Math.max(10, Math.round(s * 0.8))}px "IM Fell English", Georgia, serif`;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('Five miles', bx, by - 6);
    if (opts.title) {
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.font = `${Math.max(12, Math.round(s * 1.1))}px "IM Fell English SC", Georgia, serif`;
      g.fillText(opts.title, cam.ox + 22, cam.oy + 20);
    }
  };

  // The land as it really was, painted in the same chart style for the epilogue reveal.
  function drawTruth(g, world, cam) {
    const K = LF.newKnowledge();
    K.t.set(world.t);
    K.q.fill(1);
    K.river.set(world.river);
    K.game.set(world.game);
    drawLayer(g, K, cam, 0, '70,40,30', false);
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  LF.cap = cap;
})();
